import * as THREE from 'three';
import { rand, range, pick, chance, clamp, lerp, damp } from '../../rng.js';
import { CELL } from '../../particles.js';
import { buildTanker, MAT } from '../../vehicles.js';
import { Gunman } from '../../characters.js';
import { POWER, DIST } from './kit.js';
import { SKY } from './sky.js';
import { buildSpanMeshes } from './east.js';
import { HINGE } from './tower.js';
import { Searchlights } from './searchlights.js';
import { buildCanopy, GlideRail, buildGunboat } from './glide.js';
import { Landslide } from './slide.js';
import { F1, F2, PSPAN, TANKER, SUBST, PLAZA, TOWER, TERRACE, LOBBY, LOCKER, CHAOTIAN, BOAT, WATER_Y, GLIDE_SPEED, CLIMB, SKYST, FOOTB, groundAt } from './layout.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = 1e9;
  for (const a of ['x', 'y', 'z']) { const inv = 1 / (d[a] || 1e-9); let ta = (mn[a] - o[a]) * inv, tb = (mx[a] - o[a]) * inv; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1; }
  return t0 > 0 ? t0 : -1;
}

// =====================================================================================
//  LIGHTS OUT set pieces:
//   - the tanker on the top deck of the interchange → the double-decker span over the substation
//     sags, drops onto the lower deck, and both pancake onto the substation (sparks, transformer
//     blasts);
//   - the BLACKOUT: district by district (the east bank, the arch bridge, Lantern Street, Lantern
//     Cliff tier by tier, the Chaotian bridge span by span, the far bank, the towers floor by floor),
//     then searchlights on generators and fires are all that's left;
//   - Jinlong Tower: groaning, glass going, the BASE rig, the jump, and — once you're out over the
//     river and looking back — it shears off the cliff and comes down into the Yan;
//   - the glide: the canopy, the jumpers, searchlights and gunners on the barges and the bridge, the
//     gunboat, the landing.
//  Two warm point lights (made at load, never added / removed) hop to the nearest fires.
// =====================================================================================
export class SetPieces {
  constructor(game) {
    this.g = game; this.audio = game.audio;
    const g = game, scene = g.scene;
    this.fires = [];
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xff8a3a, 0, 26, 2); scene.add(l); return { l, k: 0, p: new THREE.Vector3() }; });
    this.search = new Searchlights(g, 16);
    this._buildSpans();
    this._buildTanker();
    this.tw = g.world.named.tower || null;
    this.slide = new Landslide(g, g.world.named.slide || null);
    this.mono = g.world.named.mono || null;
    this.rail = new GlideRail();
    this.canopy = buildCanopy({ top: [0.16, 0.17, 0.15], stripe: [0.85, 0.3, 0.06], lit: true });
    this.canopy.visible = false; scene.add(this.canopy);
    this.boat = buildGunboat(); this.boat.position.set(BOAT.x0, WATER_Y + 0.15, BOAT.z); this.boat.visible = false; scene.add(this.boat);
    this.blackT = -1; this.state = {};
    this.glide = null;
    this.riding = false;
  }
  warmMaterials() {
    const out = [];
    for (const o of [this.spans.f1, this.canopy, this.boat]) o.traverse(m => { if (m.isMesh || m.isLine) for (const mm of [].concat(m.material)) if (!out.includes(mm)) out.push(mm); });
    out.push(this.search.mesh.material);
    return out;
  }
  // the terrace's gap: you can step to the very edge once you have the rig
  extraWalk(x, z) { return !!this.rigOn && x > TERRACE.gap[0] + 0.4 && x < TERRACE.gap[1] - 0.4 && z > TERRACE.z0 && z < TERRACE.z1 + 0.6; }

  // ================================================================== fires (persistent, light the scene)
  addFire(p, size = 1, { smoke = true, life = 1e9 } = {}) { const f = { p: p.clone(), size, smoke, t: 0, life }; this.fires.push(f); return f; }
  _updateFires(dt) {
    const g = this.g, head = g.headPos;
    const near = [];
    for (const f of this.fires) {
      f.t += dt; if (f.t > f.life) { f.dead = true; continue; }
      const d = f.p.distanceTo(head);
      near.push({ f, d });
      if (d > 140) continue;
      if (rand() < dt * 14 * f.size) g.fx.flame(_v.set(f.p.x + range(-1, 1) * f.size, f.p.y + range(0, 0.6), f.p.z + range(-1, 1) * f.size), range(0.9, 1.6) * f.size);
      if (f.smoke && rand() < dt * 1.2) g.clouds.spawn({ x: f.p.x + range(-1, 1), y: f.p.y + 2 * f.size, z: f.p.z + range(-1, 1), vx: range(-0.5, 0.5) - 0.6, vy: range(2.5, 4), vz: range(-0.5, 0.5), drag: 0.2, buoy: 0.3, s0: 2 * f.size, s1: 9 * f.size, life: range(6, 9), a: 0.8, fadeIn: 0.05, fadeOut: 0.5, r: 0.05, g: 0.045, b: 0.04, r1: 0.1, g1: 0.09, b1: 0.08, glow: 1.8, glowFade: 3 });
    }
    this.fires = this.fires.filter(f => !f.dead);
    near.sort((a, b) => a.d - b.d);
    this.lights.forEach((L, i) => {
      const n = near[i];
      if (n && n.d < 70) { L.p.copy(n.f.p).setY(n.f.p.y + 1.8); L.k = damp(L.k, 12 * n.f.size * (0.8 + 0.2 * Math.sin(g.time * 17 + i * 3) + 0.1 * Math.sin(g.time * 41 + i)), 6, dt); } else L.k = damp(L.k, 0, 3, dt);
      L.l.position.copy(L.p); L.l.intensity = L.k;
    });
  }

  // ================================================================== the interchange span + the tanker
  _buildSpans() {
    const g = this.g;
    this.spans = buildSpanMeshes();
    const mk = (D, mesh) => {
      const piv = new THREE.Group(); piv.position.set(PSPAN.x0, D.y - D.t, (D.z0 + D.z1) / 2);
      mesh.position.set(-PSPAN.x0, -(D.y - D.t), -(D.z0 + D.z1) / 2);
      piv.add(mesh); g.scene.add(piv);
      const box = g.col.add([PSPAN.x0, D.y - D.t, D.z0], [PSPAN.x1, D.y, D.z1], { mat: 'concrete', kind: 'deck', layer: 'deck' });
      return { piv, mesh, D, box, ang: 0, drop: 0, vy: 0 };
    };
    this.s1 = mk(F1, this.spans.f1); this.s2 = mk(F2, this.spans.f2);
    this.pancake = { phase: 'idle', t: 0 };
  }
  _buildTanker() {
    const g = this.g, t = buildTanker();
    // it rides the top span (a child of its pivot) so it goes down with it
    t.root.position.set(TANKER.x - PSPAN.x0, F2.t, TANKER.z - (F2.z0 + F2.z1) / 2);
    t.root.rotation.y = Math.PI / 2 + 0.08;
    t.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.s2.piv.add(t.root);
    const hx = t.half.z, hz = t.half.x;
    this.tanker = { m: t, hp: 16, state: 'ok', leak: 0, box: { min: new THREE.Vector3(TANKER.x - hx, F2.y, TANKER.z - hz), max: new THREE.Vector3(TANKER.x + hx, F2.y + t.half.y * 2.1, TANKER.z + hz) }, center: new THREE.Vector3(TANKER.x, F2.y + 1.6, TANKER.z) };
    const T = this.tanker;
    T._tg = {
      active: () => T.state === 'ok' || T.state === 'leak',
      ray: (o, d) => rayBox(o, d, T.box.min, T.box.max),
      hit: (P, dir) => { g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.7 }); g.hitMarker(false); this.damageTanker(1); },
      near: (p) => p.x > T.box.min.x - 0.5 && p.x < T.box.max.x + 0.5 && p.z > T.box.min.z - 0.5 && p.z < T.box.max.z + 0.5 && p.y < T.box.max.y + 0.5 && p.y > T.box.min.y - 0.5,
      direct: () => this.damageTanker(99),
      blast: (P, r) => { if (P.distanceTo(T.center) < r + 4) this.damageTanker(8); },
      aim: () => T.center,
      auto: (head) => (T.state === 'ok' || T.state === 'leak') && this.autoTanker && head.distanceTo(T.center) < 80 ? { kind: 'target', p: T.center.clone(), score: 120, ref: T._tg, tol: 0.05, heavy: true, minNade: 8 } : null,
    };
    g.targets.push(T._tg);
  }
  damageTanker(n) {
    const T = this.tanker; if (!T || T.state === 'boom' || !this.tankerArmed) return;
    T.hp -= n;
    if (T.state === 'ok' && T.hp < 10) { T.state = 'leak'; this.audio.play('barrel_hiss', { x: T.center.x, y: T.center.y, z: T.center.z, volume: 0.9 }); this.g.events.push({ type: 'tankerLeak' }); }
    if (T.hp <= 0) this.blowTanker();
  }
  blowTanker() {
    const T = this.tanker, g = this.g; if (!T || T.state === 'boom') return;
    T.state = 'boom';
    const P = T.center.clone();
    const lean = (fn) => () => { const m = g.fx.smokeMul ?? 1; g.fx.smokeMul = m * 0.2; fn(); g.fx.smokeMul = m; };
    lean(() => g.boom(P, 2.7, { radius: 15, dmg: 30, shake: 1.6, lift: 1 }))();
    g.fx.later(0.14, lean(() => g.boom(P.clone().add(_v.set(-5, 4, -2)), 2.1, { radius: 10, dmg: 10, player: false, lift: 1 })));
    g.fx.later(0.32, lean(() => g.boom(P.clone().add(_v.set(5, 8, -3)), 1.9, { radius: 8, dmg: 10, player: false, noRing: true, lift: 1 })));
    this.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
    g.slowmo(2.4, 0.3, true);
    g.callout('TANKER!', P.clone().setY(P.y + 9), 'big', '+2000');
    g.nadeCool = Math.max(g.nadeCool || 0, 12); g.noNades = 12;
    g.addScore(2000, null);
    g.fire = Math.max(g.fire, 0.4);
    if (T.m.setBurnt) T.m.setBurnt(); else if (Array.isArray(T.m.mesh?.material)) T.m.mesh.material = T.m.mesh.material.map(() => MAT.charred); else if (T.m.mesh) T.m.mesh.material = MAT.charred;
    for (let i = 0; i < 6; i++) g.fx.later(1.1 + i * 0.3, () => { const s0 = range(2, 3); g.clouds.spawn({ x: P.x + range(-3, 3), y: P.y + range(10, 14), z: P.z - 4 + range(-2, 2), vx: range(-1, 1), vy: range(10, 13), vz: range(-3.5, -1.5), drag: 0.3, buoy: 0.5, s0, s1: s0 * range(3.5, 4.5), life: range(8, 11), a: 0.85, fadeIn: 0.05, fadeOut: 0.55, r: 0.07, g: 0.055, b: 0.045, r1: 0.14, g1: 0.12, b1: 0.1, glow: 1.8, glowFade: 3 }); });
    this.pancake.phase = 'sag'; this.pancake.t = 0;
    g.events.push({ type: 'tankerBoom' });
  }
  _updatePancake(dt) {
    const g = this.g, PK = this.pancake; if (PK.phase === 'idle' || PK.phase === 'done') return;
    PK.t += dt;
    const s1 = this.s1, s2 = this.s2;
    const midX = (PSPAN.x0 + PSPAN.x1) / 2, zc = (F2.z0 + F2.z1) / 2;
    if (PK.phase === 'sag') {
      // the top span sags on its torn east bearing: jolts, sparks, concrete raining off
      s2.ang = damp(s2.ang, -0.05, 2.5, dt);
      if (rand() < dt * 18) g.fx.sparks.spawn({ x: PSPAN.x1 + range(-1, 0.5), y: F2.y - F2.t, z: zc + range(-6, 6), vx: range(-2, 2), vy: range(-1, 3), vz: range(-2, 2), grav: 9.8, drag: 0.2, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.12, life: range(0.6, 1.4), r: 3, g: 2.2, b: 1.2, a: 1, fadeOut: 0.4 });
      if (rand() < dt * 8) g.fx.spawnDebris(_v.set(range(PSPAN.x0 + 10, PSPAN.x1), F2.y - F2.t - 1, zc + range(-6, 6)), range(-1, 1), range(-1, 0), range(-1, 1), range(0.3, 0.7), 0);
      if (PK.t > 0.4 && !PK.groan) { PK.groan = true; this.audio.play('metal_groan', { x: midX, y: F2.y, z: zc, volume: 1 }); }
      if (PK.t > 1.5) { PK.phase = 'drop2'; PK.t = 0; this.audio.play('collapse_rumble', { x: midX, y: F2.y, z: zc, volume: 1 }); }
    } else if (PK.phase === 'drop2') {
      // the east end of the top span swings down onto the lower deck
      const target = -Math.atan2(F2.y - F2.t - F1.y, PSPAN.x1 - PSPAN.x0) * 1.0;
      s2.av = (s2.av || 0) - 1.1 * dt;   // slow enough to watch the top span swing down
      s2.ang = Math.max(target, s2.ang + s2.av * dt);
      if (s2.ang <= target + 1e-3) {
        PK.phase = 'drop1'; PK.t = 0;
        this._slam(new THREE.Vector3(PSPAN.x1 - 4, F1.y + 1, zc), 1.3);
      }
    } else if (PK.phase === 'drop1') {
      // the lower deck's bearings let go: the whole stack pancakes onto the substation
      if (PK.t > 0.55) {
        s1.vy -= 9.8 * dt;
        const floor = PLAZA.y + 0.8;
        s1.drop += s1.vy * dt;
        const bottom1 = F1.y - F1.t + s1.drop;
        if (bottom1 <= floor) { s1.drop = floor - (F1.y - F1.t); if (!PK.landed) { PK.landed = true; this._landed(); } }
        s2.drop = s1.drop; s1.ang = damp(s1.ang, -0.035, 3, dt);
      }
    }
    for (const S of [s1, s2]) { S.piv.rotation.z = S.ang; S.piv.position.y = S.D.y - S.D.t + S.drop; }
    // the burning tanker's fuel runs along the top deck: a line of fire that rides the span down (it shows the tilt)
    if (PK.phase !== 'done') {
      s2.piv.updateMatrixWorld();
      for (let k = 0; k < 2; k++) if (rand() < dt * 30) g.fx.flame(_v.set(range(2, PSPAN.x1 - PSPAN.x0 - 1), F2.t + 0.3, range(-5, 5)).applyMatrix4(s2.piv.matrixWorld), range(1.0, 1.7));
      if (rand() < dt * 10) { const p = _v.set(PSPAN.x1 - PSPAN.x0 - range(0, 3), 0, range(-6, 6)).applyMatrix4(s2.piv.matrixWorld); for (let i = 0; i < 6; i++) g.fx.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: range(-3, 3), vy: range(-2, 2), vz: range(-3, 3), grav: 9.8, drag: 0.2, frame: CELL.SPARK, s0: 1.2, w: 0.05, len: 0.18, life: range(0.6, 1.4), r: 3, g: 2.2, b: 1.2, a: 1, fadeOut: 0.4 }); }
    }
    // colliders follow (roughly: the span's deck box)
    if (PK.landed && !PK.colDone) {
      PK.colDone = true;
      g.col.update(s2.box, [PSPAN.x0, PLAZA.y, F2.z0], [PSPAN.x1, PLAZA.y + 4.2, F2.z1]);
      g.col.update(s1.box, [PSPAN.x0, PLAZA.y, F1.z0], [PSPAN.x1, PLAZA.y + 2.2, F1.z1]);
      s1.box.data.layer = null; s2.box.data.layer = null; s1.box.data.kind = 'rubble'; s2.box.data.kind = 'rubble';
      PK.phase = 'done';
    }
  }
  _slam(P, k) {
    const g = this.g;
    g.lastExplosionT = g.time; g.lastExplosionShake = 1.0 * k;
    this.audio.play('collapse_impact', { x: P.x, y: P.y, z: P.z, volume: 1 });
    // a beige dust skirt blasting out along the ground (the impact reads at any distance), then a slower rolling cloud
    for (let i = 0; i < 22; i++) { const a = rand() * 6.283, sp = range(8, 18) * k * 0.7, s0 = range(2.5, 4) * k; g.clouds.spawn({ x: P.x + range(-14, 14), y: P.y + range(-1.5, 0.5), z: P.z + range(-6, 6), vx: Math.cos(a) * sp, vy: range(0.5, 2.5), vz: Math.sin(a) * sp, drag: 1.4, buoy: 0.1, s0, s1: s0 * range(3, 4.2), life: range(4, 7), a: 0.8, fadeIn: 0.03, fadeOut: 0.6, r: 0.42, g: 0.38, b: 0.33, r1: 0.3, g1: 0.28, b1: 0.25, glow: 0.5, glowFade: 1.5 }); }
    for (let i = 0; i < 8; i++) { const s0 = range(4, 6) * k; g.clouds.spawn({ x: P.x + range(-14, 14), y: P.y + range(0, 3), z: P.z + range(-6, 6), vx: range(-3, 3), vy: range(2, 5), vz: range(-3, 3), drag: 0.9, buoy: 0.3, s0, s1: s0 * range(2.6, 3.6), life: range(6, 9), a: 0.7, fadeIn: 0.04, fadeOut: 0.55, r: 0.3, g: 0.27, b: 0.24, r1: 0.22, g1: 0.2, b1: 0.18, glow: 0.4, glowFade: 2 }); }
    g.fx.light(P, 80, 0.25, 0xffb070, true, 40);
    for (let i = 0; i < 40; i++) g.fx.sparks.spawn({ x: P.x + range(-14, 14), y: P.y, z: P.z + range(-6, 6), vx: range(-5, 5), vy: range(0, 8), vz: range(-5, 5), grav: 9.8, drag: 0.2, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.12, life: range(0.5, 1.5), r: 3, g: 2.2, b: 1.2, a: 1, fadeOut: 0.4 });
    for (let i = 0; i < 10; i++) g.fx.spawnDebris(_v.set(P.x + range(-12, 12), P.y + 1, P.z + range(-5, 5)), range(-5, 5), range(3, 8), range(-5, 5), range(0.4, 1.0), chance(0.3) ? 2 : 0);
  }
  _landed() {
    const g = this.g;
    const P = new THREE.Vector3((PSPAN.x0 + PSPAN.x1) / 2, PLAZA.y + 2, (F1.z0 + F1.z1) / 2);
    this._slam(P, 1.8);
    g.slowmo(1.6, 0.3, true);
    // the substation goes: transformer blasts one after another, arcs crawling over the yard
    const T = g.world.named.subst?.transformers || [];
    T.forEach((p, i) => g.fx.later(0.3 + i * 0.45, () => {
      g.boom(p.clone(), 1.5, { radius: 9, dmg: 20, player: true, glass: true });
      this.addFire(p.clone().setY(PLAZA.y + 0.4), 1.3);
      for (let k = 0; k < 30; k++) g.fx.sparks.spawn({ x: p.x, y: p.y + 1, z: p.z, vx: range(-8, 8), vy: range(2, 12), vz: range(-8, 8), grav: 9.8, drag: 0.15, frame: CELL.SPARK, s0: 1.4, w: 0.05, len: 0.2, life: range(0.8, 2.0), r: 2.2, g: 2.6, b: 3.4, a: 1, fadeOut: 0.4 });
      g.fx.light(p, 60, 0.12, 0x9ec8ff, true, 60);
    }));
    for (const x of [PSPAN.x0 + 6, (PSPAN.x0 + PSPAN.x1) / 2, PSPAN.x1 - 4]) this.addFire(new THREE.Vector3(x, PLAZA.y + 4.5, (F2.z0 + F2.z1) / 2 + range(-3, 3)), 1.4);
    g.fire = Math.max(g.fire, 0.75);
    g.events.push({ type: 'pancake' });
    this.blackoutArmed = true;   // the director starts the blackout once you're looking at the city (VR: it has to earn the look)
    // kill anything that was standing on / under the span
    for (const s of g.soldiers) if (s.alive && s.pos.x > PSPAN.x0 - 2 && s.pos.x < PSPAN.x1 + 2 && s.pos.z > F2.z0 - 3 && s.pos.z < SUBST.z1) g.killSoldier(s, new THREE.Vector3(0, 1, 0), 2, false, 'FLATTENED');
  }
  spanDownNow() {
    // ?beat jumps past it: the stack lies on the plaza, the substation burns
    this.tanker.state = 'boom';
    const s1 = this.s1, s2 = this.s2;
    s1.drop = PLAZA.y + 0.8 - (F1.y - F1.t); s2.drop = s1.drop; s1.ang = -0.035; s2.ang = -Math.atan2(F2.y - F2.t - F1.y, PSPAN.x1 - PSPAN.x0);
    for (const S of [s1, s2]) { S.piv.rotation.z = S.ang; S.piv.position.y = S.D.y - S.D.t + S.drop; }
    this.pancake = { phase: 'done', landed: true, colDone: true };
    this.g.col.update(s2.box, [PSPAN.x0, PLAZA.y, F2.z0], [PSPAN.x1, PLAZA.y + 4.2, F2.z1]); this.g.col.update(s1.box, [PSPAN.x0, PLAZA.y, F1.z0], [PSPAN.x1, PLAZA.y + 2.2, F1.z1]);
    for (const p of this.g.world.named.subst?.transformers || []) this.addFire(p.clone().setY(PLAZA.y + 0.4), 1.2);
    for (const x of [PSPAN.x0 + 6, (PSPAN.x0 + PSPAN.x1) / 2, PSPAN.x1 - 4]) this.addFire(new THREE.Vector3(x, PLAZA.y + 4.5, (F2.z0 + F2.z1) / 2), 1.3);
    if (this.tanker.m.setBurnt) this.tanker.m.setBurnt();
  }

  // ================================================================== the blackout
  // events: [t, district, kind, (cut from, cut to, dur)] — 'cut' sweeps the district's light line down (floor by floor / tier by tier)
  startBlackout(fast = false) {
    if (this.blackT >= 0) return;
    this.blackT = 0;
    const D = DIST;
    this.bo = [
      [0.0, D.EAST, 'flick'], [0.8, D.ARCH, 'flick'], [1.9, D.LST, 'cut', 72, 40, 1.6], [2.4, D.CLIFF_HI, 'cut', 60, 20, 2.4], [3.4, D.CLIFF_LO, 'cut', 26, 0, 1.8],
      [3.0, D.WEST, 'cut', 260, 40, 5], [3.8, D.MONO, 'flick'],
      [4.6, D.CH_A, 'flick'], [5.2, D.CH_B, 'flick'], [5.8, D.CH_C, 'flick'], [6.4, D.CH_D, 'flick'],
      [5.0, D.FAR_C, 'cut', 330, 40, 7], [6.4, D.FAR_W, 'cut', 330, 40, 7], [7.6, D.FAR_E, 'cut', 330, 40, 7],
      [9.0, D.TOWER, 'cut', 260, 70, 4.0],   // Jinlong's generators keep its lower floors (and the sky lobby) on
    ].map(([t, id, kind, c0, c1, dur]) => ({ t: fast ? 0 : t, id, kind, c0, c1, dur: fast ? 0.01 : dur, done: false, p: 0 }));
    this.audio.play('alarm_klaxon', { volume: 0.4 });
    this.g.events.push({ type: 'blackout' });
  }
  _updateBlackout(dt) {
    if (this.blackT < 0) return;
    this.blackT += dt;
    const P = POWER.pow.value, C = POWER.cut.value, g = this.g;
    let lit = 0, n = 0;
    for (const e of this.bo) {
      if (e.id === DIST.TOWER && this.fall) continue;   // the fall owns the tower's power now
      if (this.blackT < e.t) { lit += 1; n++; continue; }
      const k = (this.blackT - e.t);
      if (e.kind === 'flick') {
        // brown-out flicker, a pop, dark
        P[e.id] = k < 0.7 ? (Math.sin(k * 60 + e.id) > 0 ? 0.9 : 0.15) * (1 - k / 0.7 * 0.5) : 0;
      } else {
        const u = clamp(k / e.dur, 0, 1);
        C[e.id] = e.c0 + (e.c1 - e.c0) * u;
        P[e.id] = u >= 1 ? (e.id === DIST.TOWER ? 0.85 : 0) : (Math.sin(k * 47 + e.id) > -0.2 ? 1 : 0.4);
      }
      if (!e.done && k > 0.05) {
        e.done = true;
        this._arcs(e.id);
        this.audio.play('power_down', { volume: 0.9 }) || this.audio.play('collapse_rumble', { volume: 0.35, pitch: 1.6 });
        this.audio.play('impact_metal', { volume: 0.4, pitch: 0.4 });
      }
      lit += P[e.id] * (e.kind === 'cut' ? clamp(1 - (this.blackT - e.t) / e.dur, 0, 1) : 1); n++;
    }
    // a minute later the city is not quite dead: generators, candles, the far districts on another grid —
    // a scattering of dim windows comes back (the dark city reads as a city, not as grey boxes)
    if (this.blackT > 13) {
      const u = clamp((this.blackT - 13) / 8, 0, 1);
      for (const [id, rest] of [[DIST.FAR_W, 0.22], [DIST.FAR_C, 0.2], [DIST.FAR_E, 0.24], [DIST.EAST, 0.1], [DIST.WEST, 0.1], [DIST.CLIFF_HI, 0.08], [DIST.CLIFF_LO, 0.08], [DIST.LST, 0.08]]) {
        if (C[id] < 5000) { C[id] = 1e5; P[id] = 0; }
        P[id] = Math.max(P[id], rest * u * (0.85 + 0.15 * Math.sin(this.blackT * 0.7 + id)));
      }
    }
    g.glow = damp(g.glow, n ? lit / n : 0, 2, dt);
    if (this.blackT > 10 && !this.boDone) { this.boDone = true; g.events.push({ type: 'blackoutDone' }); }
  }
  // transformer arcs: blue-white flashes popping across a district as it goes (pole cans, substations, rooftop plant)
  _arcs(id) {
    const g = this.g;
    if (!this._distPts) { this._distPts = {}; for (const L of g.world.glowList) { const c = (L.code ?? 16) % 16; const p = L.p.isVector3 ? L.p : new THREE.Vector3(...L.p); (this._distPts[c] ||= []).push(p); } }
    const pts = this._distPts[id] || []; if (!pts.length) return;
    const n = Math.min(pts.length, 5 + (rand() * 4 | 0));
    for (let i = 0; i < n; i++) g.fx.later(rand() * 0.9, () => {
      const p = pts[(rand() * pts.length) | 0], d = p.distanceTo(g.headPos), sz = 4 + d * 0.05;
      g.fx.main.spawn({ x: p.x, y: p.y, z: p.z, frame: CELL.FLASH, s0: sz, s1: sz * 2.4, life: 0.18, r: 2.4, g: 3.0, b: 4.2, fadeIn: 0, fadeOut: 0.5 });
      g.fx.main.spawn({ x: p.x, y: p.y, z: p.z, frame: CELL.GLOW, s0: sz * 3, s1: sz * 4, life: 0.35, r: 0.5, g: 0.8, b: 1.4, a: 1, fadeIn: 0, fadeOut: 0.6 });
      for (let k = 0; k < 14; k++) g.fx.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: range(-6, 6), vy: range(0, 8), vz: range(-6, 6), grav: 9.8, drag: 0.15, frame: CELL.SPARK, s0: 1 + d * 0.004, w: 0.05 + d * 0.0003, len: 0.2, life: range(0.5, 1.4), r: 2.2, g: 2.6, b: 3.4, a: 1, fadeOut: 0.4 });
      if (d < 160) g.fx.light(p, 50, 0.1, 0x9ec8ff, true, 50);
      if (d < 400) this.audio.play('impact_metal', { x: p.x, y: p.y, z: p.z, volume: 0.6, pitch: 1.8 });
    });
  }
  // the lights that come on after the blackout (generators): plaza, the climb, Sky Street
  postBlackoutLights(shooters = []) {
    if (this.pbl) return; this.pbl = true;
    const S = this.search;
    const mk = (x, y, z, yaw0, pitch0, sweep, sh) => S.add({ p: new THREE.Vector3(x, y, z), yaw0, pitch0, sweep, len: 120, spread: 0.07, shooters: sh || [] });
    this.plazaLights = [
      mk(300, 70, 40, Math.PI + 0.4, -0.3, [0.5, 0.18, 0.22], shooters),
      mk(212, 64, 36, 0.3, -0.35, [0.6, 0.15, 0.18], shooters),
      mk(352, 68, 44, Math.PI * 0.95, -0.25, [0.5, 0.15, 0.2], shooters),
    ];
  }

  // ================================================================== Jinlong Tower: groan, the rig, the jump, the fall
  towerGroan(k) {
    const g = this.g, T = TOWER;
    this.groanK = k;
    if (!this._groanT || g.time > this._groanT) {
      this._groanT = g.time + range(2.5, 5) / Math.max(0.3, k);
      this.audio.play('metal_groan', { x: 340, y: LOBBY.y + 6, z: 140, volume: 0.6 + 0.4 * k });
      g.lastExplosionShake = 0.25 + 0.5 * k; g.lastExplosionT = g.time;
      // dust sifting down from the ceiling, a window blowing out somewhere above
      for (let i = 0; i < 8; i++) g.fx.main.spawn({ x: range(T.x0 + 2, T.x1 - 2), y: LOBBY.y + 8, z: range(LOBBY.z0, TERRACE.z1), vy: -range(0.5, 1.5), drag: 1, frame: CELL.DUST, s0: 0.4, s1: 2.4, life: 2, rot: rand() * 6, r: 0.5, g: 0.47, b: 0.44, a: 0.4, fadeOut: 0.5 });
      if (chance(0.6)) { const y = range(70, 200), x = chance(0.5) ? T.x0 - 0.5 : T.x1 + 0.5; g.glass.burst?.(new THREE.Vector3(x, y, range(T.z0, T.z1)), new THREE.Vector3(Math.sign(x - 340), 0, 0), 20, { spread: 2, speed: 4, size: 0.3, life: 8 }); g.fx.main.spawn({ x, y, z: range(T.z0, T.z1), frame: CELL.FLASH, s0: 2, s1: 6, life: 0.15, r: 3, g: 2, b: 1, fadeIn: 0, fadeOut: 0.4 }); }
    }
  }
  takeRig() {
    if (this.rigOn) return; this.rigOn = true;
    this.g.audio.play('reload', { volume: 1 }); this.g.audio.play('gear_rattle', { volume: 1 });
    this.g.hud.objective('BASE RIG ON — off the edge!', 4);
    this.g.events.push({ type: 'rig' });
  }
  nearLocker() { const h = this.g.headPos; return Math.hypot(h.x - LOCKER.x, h.z - LOCKER.z) < 2.2 && Math.abs(h.y - LOBBY.y - 1.6) < 1.5; }
  atEdge() { const h = this.g.headPos; return this.rigOn && h.x > TERRACE.gap[0] && h.x < TERRACE.gap[1] && h.z > TERRACE.z1 - 0.9; }

  // the jump: slow-mo, the rig carries you off the edge onto the rail; the canopy opens fast
  jump() {
    if (this.glide) return;
    const g = this.g;
    const r0 = this.rail;
    this.glide = { state: 'jump', t: 0, from: g.rig.position.clone() };
    this.riding = true;
    if (g.loco) g.loco.enabled = false;
    g.slowmo(1.8, 0.3, true);
    this.audio.play('whiz', { volume: 1, pitch: 0.5 });
    for (const s of g.soldiers) if (s.alive && s.role !== 'jumper') { s.alive = false; s.root.visible = false; }
    // the tower's lobby glass shatters as it starts to go (it would hang in the air otherwise)
    for (const p of g.glass.panes) if (p.hinged === undefined && p.c.x > TOWER.x0 - 1 && p.c.x < TOWER.x1 + 1 && p.c.z > TOWER.z0 - 1 && p.c.z < TOWER.z1 + 1) { if (p.state === 'ok') g.glass.shatter(p, p.c.clone(), new THREE.Vector3(0, 0, 1), 2); }
    g.events.push({ type: 'jump' });
    void r0;
  }
  // the bank goes first: the riverside block east of Jinlong slides into the river piece by piece, running along the
  // bank toward the tower; then the tower (its footing gone) comes over — body pivoting on its base, the crown section
  // lagging and folding — and once it is well over it tears off the stump and drops into the hole in the bank
  landslide(fast = false) { if (this.slide.active) return; this.slide.start(fast); if (fast) this.towerFall(true); else this.g.fx.later(7.6, () => this.towerFall()); }
  towerFall(fast = false) {
    if (this.fall) return;
    this.fall = { t: 0, a: 0, av: 0.045, c: 0, cv: 0, hit: false };
    POWER.pow.value[DIST.TOWER] = 1; POWER.cut.value[DIST.TOWER] = 9999;
    if (fast) { Object.assign(this.fall, { hit: true, free: true, gone: true }); POWER.pow.value[DIST.TOWER] = 0; if (this.tw) this.tw.body.visible = false; return; }
    this.audio.play('collapse_rumble', { x: 340, y: 60, z: 140, volume: 1 });
    this.audio.play('metal_groan', { x: 340, y: 60, z: 140, volume: 1 });
    // the shear at the base: a ring of blasts and dust where the body tears off the stump
    const g = this.g;
    for (let i = 0; i < 6; i++) g.fx.later(i * 0.12, () => { const p = new THREE.Vector3(range(TOWER.x0, TOWER.x1), 50 + range(-2, 3), range(TOWER.z0, TOWER.z1)); g.fx.explosion(p, 1.2, { noRing: true }); });
    for (const p of g.glass.panes) if (p.state === 'ok' && p.c.x > TOWER.x0 - 1 && p.c.x < TOWER.x1 + 1 && p.c.z > TOWER.z0 - 1 && p.c.z < TOWER.z1 + 1) g.glass.shatter(p, p.c.clone(), new THREE.Vector3(0, 0, 1), 2);
    g.events.push({ type: 'towerFall' });
  }
  _updateFall(dt) {
    const F = this.fall; if (!F || !this.tw) return;
    const g = this.g, tw = this.tw;
    F.t += dt;
    // a falling rod: a'' = 1.5 g / L · sin a (L ~ 190 m), plus the shear's kick
    if (F.gone) return;
    const L = 190, axis = _v.set(0.35, 0, -1).normalize();
    if (!F.free) {
      F.av += (1.5 * 9.8 / L * Math.sin(F.a + 0.04)) * dt;
      F.a += F.av * dt;
      // well over: it tears off the stump — a free body now (spinning on, its centre of mass falling) into the river
      if (F.a > 0.95) {
        F.free = true; F.rc = new THREE.Vector3(-20, 95, 0);
        const q = _q.setFromAxisAngle(axis, F.a);
        F.com = F.rc.clone().applyQuaternion(q).add(HINGE);
        F.vc = axis.clone().multiplyScalar(F.av).cross(F.com.clone().sub(HINGE));
        F.w = F.av; F.vc.y -= 7;   // the stump crushes under it: it drops as it goes
        this.audio.play('metal_groan', { x: HINGE.x, y: 50, z: HINGE.z, volume: 1, pitch: 0.6 });
        for (let i = 0; i < 5; i++) g.fx.later(i * 0.1, () => g.fx.explosion(new THREE.Vector3(HINGE.x - range(0, 30), 50 + range(-1, 3), HINGE.z + range(-18, 18)), 1.3, { noRing: true }));
        g.events.push({ type: 'towerFree' });
      }
    }
    if (F.free) {
      const wet = F.com.y < WATER_Y + 8;
      F.vc.y -= 9.8 * dt;
      if (wet) { F.vc.multiplyScalar(Math.exp(-1.4 * dt)); F.w *= Math.exp(-1.2 * dt); }
      if (F.a > 1.2) F.w *= Math.exp(-4 * dt);
      F.com.addScaledVector(F.vc, dt); F.a += F.w * dt;
      if (F.com.y < WATER_Y - 70) { F.gone = true; tw.body.visible = false; return; }
    }
    // the crown section lags then whips: a damped spring on its own hinge
    if (!F.hit) { F.cv += (-(F.c - (F.free ? F.w : F.av) * -0.55) * 6 - F.cv * 2.2) * dt; F.c += F.cv * dt; }
    tw.body.quaternion.setFromAxisAngle(axis, F.a);
    if (F.free) tw.body.position.copy(F.rc).applyQuaternion(tw.body.quaternion).multiplyScalar(-1).add(F.com);
    tw.crown.quaternion.setFromAxisAngle(axis, F.c * 0.25);
    tw.body.updateMatrixWorld(true);
    // the top: where it is now
    const top = _v2.set(TOWER.x0 + 20, TOWER.base + TOWER.h, (TOWER.z0 + TOWER.z1) / 2).sub(tw.crown.position.clone().add(HINGE)).applyMatrix4(tw.crown.matrixWorld);
    // lights die as it goes (from the top down), the halo / red light ride along
    // the generators hold until the impact: a gold tower going over (it flickers as the risers tear), dark after
    POWER.pow.value[DIST.TOWER] = F.hit ? 0 : F.a < 0.25 ? (Math.sin(F.t * 50) > 0 ? 1 : 0.5) : (Math.sin(F.t * 31) > 0.85 ? 0.45 : 0.9);
    for (const gl of tw.riding) { const loc = _v3.copy(gl.local).sub(gl.crown ? tw.crown.position.clone().add(HINGE) : HINGE); gl.p.copy(loc).applyMatrix4(gl.crown ? tw.crown.matrixWorld : tw.body.matrixWorld); }
    // it sheds: glass, chunks, dust off the leading face and the shear
    if (!F.hit) {
      if (rand() < dt * 20) { const h = range(60, 200); const p = _v3.set(range(TOWER.x0, TOWER.x1), h, range(TOWER.z0, TOWER.z1)).sub(HINGE).applyMatrix4(tw.body.matrixWorld).add(HINGE.clone().multiplyScalar(0)); g.glass.burst?.(p.clone(), new THREE.Vector3(range(-1, 1), 0.5, range(-1, 1)), 14, { spread: 3, speed: 3, size: 0.35, life: 10 }); }
      if (rand() < dt * 6) g.clouds.spawn({ x: HINGE.x + range(-20, 0), y: 50 + range(-2, 4), z: HINGE.z + range(-20, 20), vx: range(-3, 3), vy: range(1, 4), vz: range(-3, 3), drag: 0.6, buoy: 0.2, s0: 6, s1: 22, life: range(8, 12), a: 0.8, fadeIn: 0.05, fadeOut: 0.5, r: 0.12, g: 0.11, b: 0.1, r1: 0.2, g1: 0.18, b1: 0.16, glow: 0.8, glowFade: 3 });
    }
    // two floors burning where the shear tore the risers, smoke trailing off them as it goes over
    if (!F.hit && !F.free && F.a > 0.03) for (const [hy, k] of [[88, 1.4], [121, 1.1]]) if (rand() < dt * 8) {
      const p = _v3.set(range(TOWER.x0 + 2, TOWER.x1 - 2), hy, rand() < 0.5 ? TOWER.z0 - 0.5 : TOWER.z1 + 0.5).sub(HINGE).applyMatrix4(tw.body.matrixWorld);
      g.fx.flame(p, range(1.4, 2.2) * k);
      if (rand() < 0.4) g.clouds.spawn({ x: p.x, y: p.y + 2, z: p.z, vx: range(-2, 2), vy: range(2, 5), vz: range(-2, 2), drag: 0.5, buoy: 0.3, s0: 4, s1: 18, life: range(6, 9), a: 0.8, fadeIn: 0.05, fadeOut: 0.5, r: 0.06, g: 0.05, b: 0.045, r1: 0.1, g1: 0.09, b1: 0.08, glow: 0.6, glowFade: 2.5 });
    }
    // impact: the top hits the river / the east bank
    if (!F.hit && top.y < WATER_Y + 3) {
      F.hit = true;
      const P = top.clone(); P.y = Math.max(WATER_Y + 1, P.y);
      g.slowmo(2.0, 0.3, true);
      g.lastExplosionT = g.time; g.lastExplosionShake = 0.9;
      this.audio.play('collapse_impact', { x: P.x, y: P.y, z: P.z, volume: 1 });
      this.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
      // a wall of white water and spray along the body's length (the stump end to the top)
      this._waterLine(_v3.set(TOWER.x0 + 20, 52, (TOWER.z0 + TOWER.z1) / 2).sub(HINGE).applyMatrix4(tw.body.matrixWorld).clone(), P, 1.1);
      g.events.push({ type: 'towerDown' });
      g.addScore(5000, null);
    }
    // the body slaps down flat: a second, longer wall of water
    if (F.free && !F.slap && F.com.y < WATER_Y + 6) {
      F.slap = true;
      const a = _v3.set(TOWER.x0 + 20, 52, (TOWER.z0 + TOWER.z1) / 2).sub(HINGE).applyMatrix4(tw.body.matrixWorld).clone();
      this._waterLine(a, top.clone(), 1.4);
      this.audio.play('collapse_impact', { x: F.com.x, y: 2, z: F.com.z, volume: 1, pitch: 0.7 });
      g.lastExplosionT = g.time; g.lastExplosionShake = 0.7;
    }
  }
  // white water along a line on the river (a, b: world points; k: size)
  _waterLine(a, b, k = 1) {
    const g = this.g, n = Math.max(3, Math.min(9, Math.round(a.distanceTo(b) / 22)));
    for (let j = 0; j <= n; j++) {
      const q = new THREE.Vector3().lerpVectors(a, b, j / n); q.y = WATER_Y;
      if (q.z < 150) continue;
      g.fx.later(j * 0.07 + rand() * 0.06, () => {
        for (let i = 0; i < 2; i++) { const s0 = range(9, 14) * k; g.clouds.spawn({ x: q.x + range(-6, 6), y: q.y + range(5, 10), z: q.z + range(-6, 6), vx: range(-3, 3), vy: range(14, 26) * k, vz: range(-3, 3) + 2, drag: 0.8, buoy: 0.3, s0, s1: s0 * range(3.2, 4.2), life: range(6, 8), a: 0.65, fadeIn: 0.04, fadeOut: 0.6, r: 0.2, g: 0.19, b: 0.18, r1: 0.15, g1: 0.14, b1: 0.13, glow: 0.3, glowFade: 2 }); }
        for (let i = 0; i < 12; i++) g.fx.main.spawn({ x: q.x + range(-7, 7), y: q.y + 1, z: q.z + range(-7, 7), vx: range(-7, 7), vy: range(14, 32) * k, vz: range(-7, 7), grav: 9.8, drag: 0.35, frame: CELL.WISP, s0: 3 * k, s1: 9 * k, life: range(2, 3.4), rot: rand() * 6, r: 0.42, g: 0.42, b: 0.42, a: 0.4, fadeOut: 0.5 });
        if (j % 3 === 0) g.fx.ring?.(q, 22 * k, 1.6, WATER_Y + 0.3);
      });
    }
  }

  // ================================================================== the glide
  _startRail() {
    const g = this.g, G = this.glide;
    G.state = 'fly'; G.t = 0;
    this.canopy.visible = true;
    this.canopy.scale.setScalar(0.05);
    this.audio.play('container_doors', { volume: 0.8, pitch: 1.6 });   // the canopy cracking open
    // the gunboat: put it where it will be under the end of the line when you get there
    const T = this.rail.len / GLIDE_SPEED;
    this.boat.visible = true;
    this.boatX = (this.rail.curve.points[this.rail.curve.points.length - 1].x - this.boat.userData.deck.x) - BOAT.speed * T;
    this.boat.position.set(this.boatX, WATER_Y + 0.15, BOAT.z);
    this._spawnGlideEnemies();
  }
  _spawnGlideEnemies() {
    const g = this.g, S = this.search;
    // the boat's crew + gunner, a searchlight on the wheelhouse
    const ud = this.boat.userData;
    this.boatCrew = [ud.gunner, ...ud.crew].map((p, i) => g.spawnSoldier({ x: this.boat.position.x + p.x, y: p.y, z: this.boat.position.z + p.z, role: 'deck', carrier: { obj: this.boat, local: p.clone(), vel: new THREE.Vector3(BOAT.speed, 0, 0) }, delay: 30 + i, range: 90, noNade: true }));
    this.boatLight = S.add({ p: ud.lamp.clone(), carrier: { obj: this.boat, local: ud.lamp.clone() }, yaw0: Math.PI, pitch0: 0.55, sweep: [0.6, 0.2, 0.3], len: 150, spread: 0.06, shooters: this.boatCrew });
    // the drums: shoot them and the boat's deck goes up (crew and all)
    const drumsP = () => ud.drumsP.clone().applyMatrix4(this.boat.matrixWorld);
    this.drums = { hp: 6, dead: false };
    const D = this.drums, self = this;
    g.targets.push({
      active: () => !D.dead && this.boat.visible,
      ray: (o, d) => { const c = drumsP(); _v.subVectors(o, c); const b = _v.dot(d), cc = _v.lengthSq() - 1.0, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; },
      hit: (P) => { D.hp--; g.fx.impact(P, _v.set(0, 1, 0), 'metal'); g.hitMarker(false); if (D.hp <= 0) self.blowDrums(); },
      blast: (P, r) => { if (P.distanceTo(drumsP()) < r + 1) self.blowDrums(); },
      aim: drumsP,
      auto: (head) => { const p = drumsP(); const d = p.distanceTo(head); return D.dead || d > 110 || !self.glide || self.rail.u < 0.7 ? null : { kind: 'target', p, score: 90, ref: g.targets[g.targets.length - 1], tol: 0.03 }; },
    });
    // the Chaotian bridge: gunmen along the deck, two searchlights on the pylons
    const ch = CHAOTIAN;
    this.bridgeMen = [[ch.x - 9, 300], [ch.x + 8, 316], [ch.x - 6, 334], [ch.x + 10, 290]].map(([x, z], i) => g.spawnSoldier({ x, y: ch.y, z, role: 'perch', delay: 18 + i * 1.3, range: 100, noNade: true }));
    this.bridgeLights = [S.add({ p: new THREE.Vector3(ch.x - 12, ch.y + 22, ch.pylons[0] - 3), yaw0: Math.PI * 0.6, pitch0: 0.25, sweep: [0.8, 0.25, 0.3], len: 170, spread: 0.06, shooters: this.bridgeMen }),
      S.add({ p: new THREE.Vector3(ch.x + 12, ch.y + 22, ch.pylons[0] - 3), yaw0: Math.PI * 0.4, pitch0: 0.3, sweep: [0.7, 0.2, 0.26], len: 170, spread: 0.06, shooters: this.bridgeMen })];
    // two armed barges out on the river under the line (gunners + a searchlight each)
    this.barges = [];
    for (const [x, z, v] of [[150, 340, 0.6], [-10, 270, -0.5]]) {
      const b = new THREE.Group(); b.position.set(x, WATER_Y + 0.2, z); g.scene.add(b);
      const crew = [new THREE.Vector3(-4, 2.2, 1.5), new THREE.Vector3(5, 2.2, -1.5)].map((p, i) => g.spawnSoldier({ x: x + p.x, y: p.y, z: z + p.z, role: 'deck', carrier: { obj: b, local: p.clone(), vel: new THREE.Vector3(v, 0, 0) }, delay: 8 + i * 2 + (x < 0 ? 22 : 0), range: 110, noNade: true }));
      const L = S.add({ p: new THREE.Vector3(x, 6, z), carrier: { obj: b, local: new THREE.Vector3(0, 6.2, 0) }, yaw0: Math.PI, pitch0: 0.7, sweep: [1.0, 0.25, 0.35], len: 130, spread: 0.07, shooters: crew });
      this.barges.push({ g: b, v, crew, L });
    }
    this.bargeModels();
    // the jumpers (three, from the tower's roof after you): they appear behind you a few seconds in
    this.jumpers = [];
  }
  bargeModels() {
    for (const B of this.barges) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(34, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0x24221f, roughness: 0.8, metalness: 0.3 }));
      m.position.y = 0.6; B.g.add(m);
      const h = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 7), new THREE.MeshStandardMaterial({ color: 0x3a3833, roughness: 0.7 })); h.position.set(12, 3.5, 0); B.g.add(h);
      const c = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x5a3f22, roughness: 0.9 })); c.position.set(-4, 2.6, 0); B.g.add(c);
    }
  }
  spawnJumper(i) {
    const g = this.g;
    const can = buildCanopy({ top: [0.06, 0.06, 0.065], stripe: [0.55, 0.05, 0.04], drop: 6.0 });
    g.scene.add(can);
    const J = { can, i, off: new THREE.Vector3([-10, 12, -16][i % 3], [3.5, 1.5, 5][i % 3], 0), back: [26, 34, 44][i % 3], t: 0, hp: 4, state: 'fly', vel: new THREE.Vector3(), spin: new THREE.Vector3() };
    J.s = g.spawnSoldier({ x: 0, y: 0, z: 0, role: 'jumper', carrier: { obj: can, local: new THREE.Vector3(0, -6.0 - 1.15, 0), vel: new THREE.Vector3() }, delay: 1.5, range: 90, noNade: true });
    J.s.hitR = true;   // a bigger target (he's a silhouette against the fog)
    const self = this;
    J.tg = {
      active: () => J.state === 'fly',
      ray: (o, d) => { const c = can.position; _v.subVectors(o, c); const b = _v.dot(d), cc = _v.lengthSq() - 2.6 * 2.6, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; },
      hit: (P) => { J.hp--; g.fx.impact(P, _v.set(0, -1, 0), 'body'); g.hitMarker(false); g.audio.play('impact_flesh', { x: P.x, y: P.y, z: P.z, volume: 0.5, pitch: 1.4 }); if (J.hp <= 0) self.collapseCanopy(J); },
      aim: () => can.position,
      auto: (head) => J.state === 'fly' && J.s.alive ? { kind: 'target', p: can.position.clone(), score: 50 - can.position.distanceTo(head) * 0.2, ref: J.tg, tol: 0.04 } : null,
    };
    g.targets.push(J.tg);
    this.jumpers.push(J);
    return J;
  }
  collapseCanopy(J) {
    if (J.state !== 'fly') return;
    const g = this.g;
    J.state = 'fall'; J.vel.set(range(-2, 2), -2, range(-2, 2)); J.spin.set(range(-2, 2), range(-3, 3), range(-2, 2));
    g.jumpersDown++;
    g.addScore(400, 'CANOPY DOWN', J.can.position.clone().setY(J.can.position.y + 2), 'big');
    g.audio.play('impact_glass', { x: J.can.position.x, y: J.can.position.y, z: J.can.position.z, volume: 0.4, pitch: 0.4 });
    g.events.push({ type: 'canopyDown', J });
  }
  _updateJumpers(dt) {
    const g = this.g;
    for (const J of this.jumpers || []) {
      J.t += dt;
      if (J.state === 'fly') {
        // they hold station behind / beside you, closing in slowly, bobbing
        J.back = Math.max(10 + J.i * 4, J.back - dt * 0.9);
        this.rail.at(Math.max(0, this.rail.s - J.back), _v);
        this.rail.curve.getTangentAt(clamp((this.rail.s - J.back) / this.rail.len, 0, 1), _v2);
        const side = _v3.set(-_v2.z, 0, _v2.x).normalize();
        const tgt = _v.addScaledVector(side, J.off.x).add(_v2.set(0, J.off.y + Math.sin(J.t * 0.7 + J.i) * 0.8 + 6.4, 0));
        if (J.t < 0.1) J.can.position.copy(tgt).add(_v2.set(0, 30, 0));
        const prev = J.can.position.clone();
        J.can.position.lerp(tgt, 1 - Math.exp(-dt * (J.t < 4 ? 0.8 : 1.6)));
        J.s.carrier.vel.subVectors(J.can.position, prev).divideScalar(Math.max(dt, 1e-4));
        J.can.rotation.y = this.rail.yaw;
        if (!J.s.alive && !J.pilotless) { J.pilotless = true; J.state = 'drift'; g.events.push({ type: 'jumperDown', J }); }
      } else if (J.state === 'drift') {
        // pilot dead: the canopy drifts off, sinking slowly, his body hanging in the harness
        J.can.position.y -= dt * 2.2; J.can.position.x += dt * 1.2; J.can.rotation.z = Math.min(0.5, J.can.rotation.z + dt * 0.05);
        if (J.can.position.y < WATER_Y - 2) { J.can.visible = false; J.state = 'gone'; }
      } else if (J.state === 'fall') {
        J.vel.y -= 9.8 * dt; J.vel.multiplyScalar(Math.exp(-dt * 0.2));
        J.can.position.addScaledVector(J.vel, dt);
        J.can.rotation.x += J.spin.x * dt; J.can.rotation.y += J.spin.y * dt; J.can.rotation.z += J.spin.z * dt;
        J.can.scale.set(Math.max(0.3, J.can.scale.x - dt * 0.6), Math.max(0.4, J.can.scale.y - dt * 0.4), 1);
        J.s.carrier.vel.copy(J.vel);
        if (J.can.position.y < WATER_Y + 1) {
          J.state = 'gone'; J.can.visible = false;
          if (J.s.alive) { J.s.alive = false; J.s.root.visible = false; }
          const p = J.can.position; for (let i = 0; i < 12; i++) g.fx.main.spawn({ x: p.x, y: WATER_Y + 0.3, z: p.z, vx: range(-2, 2), vy: range(4, 9), vz: range(-2, 2), grav: 9.8, drag: 0.4, frame: CELL.WISP, s0: 0.6, s1: 2.2, life: 1.4, rot: rand() * 6, r: 0.75, g: 0.78, b: 0.8, a: 0.5, fadeOut: 0.5 });
        }
      }
    }
  }
  blowDrums() {
    const D = this.drums; if (!D || D.dead) return;
    D.dead = true;
    const g = this.g, P = this.boat.userData.drumsP.clone().applyMatrix4(this.boat.matrixWorld);
    g.boom(P, 2.0, { radius: 16, dmg: 10, player: false });
    g.fx.later(0.25, () => g.boom(P.clone().add(_v.set(4, 1, 1)), 1.4, { radius: 10, dmg: 5, player: false }));
    this.addFire(P.clone().setY(P.y - 0.4), 1.2, { life: 120 });
    this.boat.userData.drums.visible = false;
    for (const s of this.boatCrew) if (s.alive) g.killSoldier(s, new THREE.Vector3(0, 1, 0), 2.4, false, 'OVERBOARD!');
    this.boatLight && this.search.kill(this.boatLight);
    g.addScore(1500, 'GUNBOAT!', P.clone().setY(P.y + 6), 'big');
    g.events.push({ type: 'boatDown' });
  }
  get boatClear() { return !this.boatCrew || this.boatCrew.every(s => !s.alive); }

  _updateGlide(rdt, dt) {
    const G = this.glide; if (!G) return;
    const g = this.g;
    G.t += dt;
    // the boat steams east
    // after the landing the boat throttles back and idles mid-river under the credits
    this.boatV = G.state === 'landed' && G.t > 6 ? damp(this.boatV ?? BOAT.speed, 0.35, 0.4, dt) : BOAT.speed;
    if (this.boat.visible) { this.boat.position.x += this.boatV * dt; this.boat.position.y = WATER_Y + 0.15 + Math.sin(g.time * 0.9) * 0.08; this.boat.rotation.z = Math.sin(g.time * 0.7) * 0.012; }
    for (const B of this.barges || []) B.g.position.x += B.v * dt;
    // the gunner turns his gun on you
    // the nav lights (red / green / white) as glows, so they carry across the water
    if (this.boat.visible) for (const [lp, c] of this.boat.userData.nav || []) { _v.copy(lp).applyMatrix4(this.boat.matrixWorld); g.fx.main.spawn({ x: _v.x, y: _v.y, z: _v.z, frame: CELL.GLOW, s0: 2.2, life: 0.04, r: c[0] * 0.8, g: c[1] * 0.8, b: c[2] * 0.8, a: 1, anchored: false }); }
    if (this.boat.visible) { const gun = this.boat.userData.gun; gun.lookAt(_v.copy(g.headPos)); gun.rotateY(-Math.PI / 2); gun.rotation.x = 0; gun.rotation.z = 0; }
    if (G.state === 'jump') {
      // off the edge: out and a little down, in slow-mo
      const k = clamp(G.t / 0.75, 0, 1);
      const p0 = this.rail.at(0, _v);
      G.pos = new THREE.Vector3().copy(G.from).lerp(p0, k * k * (3 - 2 * k)).add(_v2.set(0, -k * 1.4, 0));
      if (G.t > 0.75) this._startRail();
    }
    if (G.state === 'fly') {
      // steering from the left stick / A-D
      let st = 0;
      const P = g.player;
      if (P?.mode === 'vr') { for (const c of P.controllers) if (c.hand === 'left') { const ax = c.source?.gamepad?.axes?.[2] ?? 0; if (Math.abs(ax) > 0.2) st = ax; } }
      else if (P?.keys) st = (P.keys.KeyD ? 1 : 0) - (P.keys.KeyA ? 1 : 0);
      if (g.auto) st = 0;
      this.rail.step(dt, st);
      // the canopy pops open
      const k = clamp(G.t / 0.8, 0, 1);
      this.canopy.scale.set(lerp(0.05, 1, k), lerp(0.2, 1, k * k), lerp(0.4, 1, k));
      // the last stretch: line up with the boat's deck and settle onto it
      const left = this.rail.remaining;
      const deck = this.boat.userData.deck.clone().applyMatrix4(this.boat.matrixWorld);
      G.pos = this.rail.pos.clone();
      if (left < 4) { const b = 1 - left / 4; G.pos.lerp(deck, b * b * (3 - 2 * b)); }
      if (left <= 0.02) { G.state = 'landed'; G.t = 0; this._landing(); }
      g.rigVel = new THREE.Vector3().copy(this.rail.tan).multiplyScalar(GLIDE_SPEED);
    }
    if (G.state === 'landed') {
      G.pos = this.boat.userData.deck.clone().applyMatrix4(this.boat.matrixWorld);
      // the canopy drops behind you into the river
      this.canopy.position.y -= rdt * 2; this.canopy.rotation.x = Math.max(-1.3, this.canopy.rotation.x - rdt * 0.7);
      g.rigVel = new THREE.Vector3(this.boatV, 0, 0);
    }
  }
  _landing() {
    const g = this.g;
    this.audio.play('body_fall', { volume: 0.6 });
    this.audio.play('step_metal', { volume: 1 });
    g.haptic(0.6, 120);
    this.canopy.removeFromParent(); g.scene.add(this.canopy);
    this.canopy.position.copy(g.rig.position).add(_v.set(0, 6.4 + 1.7, 0));
    g.events.push({ type: 'landed' });
  }

  // ================================================================== frame
  update(dt) {
    const g = this.g;
    this._updatePancake(dt);
    this._updateBlackout(dt);
    this._updateFall(dt);
    this.slide.update(dt);
    this._updateJumpers(dt);
    this._updateGlide(dt, dt);
    this.search.update(dt);
    this._updateFires(dt);
    if (this.mono && this.blackT > 3.8) this.mono.stopped = false;
    // the tanker leaks / burns once it's been hit
    const T = this.tanker;
    if (T && T.state === 'leak') { T.leak += dt; if (rand() < dt * 10) g.fx.flame(_v.set(T.center.x + range(-3, 3), F2.y + range(0.2, 1.4), T.center.z + range(-1.5, 1.5)), range(0.8, 1.3)); if (T.leak > 6) this.blowTanker(); }
  }
  afterPlayer(rdt, dt) {
    const g = this.g, G = this.glide;
    if (!G || !G.pos) return;
    g.rig.position.copy(G.pos);
    // the rig turns with the line (slowly, rate-limited in GlideRail): keep whatever offset you jumped with
    if (G.state === 'fly' || G.state === 'landed') { if (this.yawOff === undefined) this.yawOff = g.rig.rotation.y - this.rail.yaw; g.rig.rotation.y = this.rail.yaw + this.yawOff; }
    g.rig.updateMatrixWorld(true);
    if (G.state === 'fly' && this.canopy.parent !== g.rig) { g.rig.add(this.canopy); this.canopy.position.set(0, 1.55 + this.canopy.userData.drop, 0.28); this.canopy.rotation.set(0, 0, 0); }   // the risers at your shoulders, just behind your head
  }
}
