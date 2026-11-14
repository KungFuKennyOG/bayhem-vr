import * as THREE from 'three';
import { rand, range, chance, clamp, lerp, damp } from '../../rng.js';
import { CELL } from '../../particles.js';
import { POWER, DIST } from './kit.js';
import { Searchlights } from './searchlights.js';
import { buildCanopy, GlideRail, buildGunboat, buildBarge, buildWreck } from './glide.js';
import { Landslide } from './slide.js';
import { Gunship } from './boss.js';
import { TOWER, LIFT, ROOFTOP, HINGE, FALL_DIR, BOAT, WATER_Y, GLIDE_SPEED, SLIDE, STATE, Y, groundAt } from './layout.js';

const _m4d = new THREE.Matrix4();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion();
const TCX = (TOWER.x0 + TOWER.x1) / 2, TCZ = (TOWER.z0 + TOWER.z1) / 2;
// every district the blackout can take, and how much each counts toward "the city is lit" (the sky's glow, the fog)
const CITY = [[DIST.FAR_E, 1], [DIST.HILL, 1.2], [DIST.FAR_W, 1], [DIST.R0, 0.3], [DIST.R1, 0.3], [DIST.R2, 0.3], [DIST.R3, 0.3], [DIST.FAR_S, 1.4], [DIST.BR0, 0.2], [DIST.BR1, 0.2], [DIST.BR2, 0.2], [DIST.FAR_N, 1.4], [DIST.FORE, 0.2], [DIST.TOWER, 1.0], [DIST.EAST, 0.3]];

// =====================================================================================
//  LIGHTS OUT set pieces:
//   - the POWER going, district by district: every cut is its own event (cut()); the director
//     decides when. The city's glow (sky, fog) follows whatever is still lit;
//   - NIGHT HERON ONE over the river → into the hill → the landslide (boss.js, slide.js);
//   - the lift up Jinlong's south face (a real ride; ?lift=blink for a blink to black);
//   - NIGHT HERON TWO on the roof → into the tower's west face → the tower starts to go;
//   - the BASE rig, the jump, the glide (rail), the tower falling past your right shoulder and into
//     the river (its lights dying as it goes: when it lands, Longwu is dark), jumpers, barges, the
//     gunboat, the landing; then the lights coming back.
// =====================================================================================
export class SetPieces {
  constructor(game) {
    this.g = game; this.audio = game.audio;
    const g = game, scene = g.scene;
    this.fires = [];
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xff8a3a, 0, 26, 2); scene.add(l); return { l, k: 0, p: new THREE.Vector3() }; });
    this.search = new Searchlights(g, 16);
    this.tw = g.world.named.tower || null;
    this.slide = new Landslide(g, g.world.named.slide || null);
    this.heron1 = new Gunship(g, this, { mode: 'river', name: 'NIGHT HERON ONE', hp: 115 });
    this.heron2 = new Gunship(g, this, { mode: 'roof', name: 'NIGHT HERON TWO', hp: 180 });
    this.rail = new GlideRail();
    this.canopy = buildCanopy({ top: [0.16, 0.17, 0.15], stripe: [0.85, 0.3, 0.06], lit: true });
    this.canopy.visible = false; scene.add(this.canopy);
    this.boat = buildGunboat(); this.boat.position.set(BOAT.x0, WATER_Y + 0.15, BOAT.z); this.boat.visible = false; scene.add(this.boat);
    // the two armed barges of the glide (one with containers, one with sand), hidden until the canopy opens
    this.bargeMeshes = [buildBarge({ cargo: 'boxes', seed: 3 }), buildBarge({ cargo: 'sand', seed: 8, len: 32 })];
    for (const b of this.bargeMeshes) { b.visible = false; scene.add(b); }
    // the slide's wreckage, drifting downstream on fire (hidden until the glide)
    this.wreckMeshes = [0, 1, 2, 3, 2, 0].map((k, i) => { const w = buildWreck(k, i + 1); w.visible = false; scene.add(w); return w; });
    this.drift = [];   // bow upstream (east), coming at you; it swings broadside before you land (see _updateGlide)
    this.cuts = [];
    this.fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }));
    this.fadeMesh.renderOrder = 9999; this.fadeMesh.frustumCulled = false; this.fadeMesh.visible = false; g.camera.add(this.fadeMesh);
    this.lift = { state: 'bottom', y: LIFT.y0, v: 0, t: 0, blink: g.params.get('lift') === 'blink' };
    this.fallDir = new THREE.Vector3(...FALL_DIR);
    if (g.params.get('fall') === 'far') this.fallDir.set(-0.97, 0, -0.24);      // comfort option: the tower goes further from the glide line
    this.fallDir.normalize();
    this.glide = null; this.riding = false; this.onRoof = false;
    // two lamps the pooled lights can take: the roof deck under the crown's floods, and the lift platform's own light
    const twOn = () => this.fall ? 0 : POWER.pow.value[DIST.TOWER];
    this.fires.push({ p: new THREE.Vector3(TCX, ROOFTOP.y + 7, TCZ), size: 1.7, t: 0, life: 1e9, lamp: twOn });
    this.liftLamp = { p: new THREE.Vector3((LIFT.x0 + LIFT.x1) / 2, Y + 2.6, LIFT.z1 - 1), size: 0.8, t: 0, life: 1e9, lamp: () => this.lift.state === 'top' ? 0 : 1 };
    this.fires.push(this.liftLamp);
  }
  warmMaterials() {
    const out = [];
    for (const o of [this.canopy, this.boat, ...this.bargeMeshes, ...this.wreckMeshes]) o.traverse(m => { if (m.isMesh || m.isLine) for (const mm of [].concat(m.material)) if (!out.includes(mm)) out.push(mm); });
    out.push(this.search.mesh.material, this.fadeMesh.material, ...this.heron1.warmMaterials(), ...this.heron2.warmMaterials());
    return out;
  }

  // ================================================================== the wreckage in the river
  // Placed so that `tLeft` seconds later (when you are on the gunboat's deck) it is drifting past: two pieces abeam within
  // 25–40 m, one upstream coming down, others further off. The current takes it west at 1.2 m/s; it bobs, turns slowly,
  // burns (its fires are the two pooled lights' nearest sources, so they light the deck with a flicker).
  spawnDrift(tLeft = null) {
    if (this.drift.length) return;
    if (tLeft === null) tLeft = this.rail ? this.rail.remaining + 1 : 0;
    const bx = 206, bz = 225, V0 = 1.2;
    const at = [[bx + 9, bz + 26, 0.4], [bx - 15, bz - 26, 2.6], [bx + 55, bz - 42, 1.2], [bx - 70, bz + 40, 0.2], [bx + 95, bz + 12, 1.9], [bx + 30, bz - 75, 3.0]];
    this.wreckMeshes.forEach((w, i) => {
      const [x, z, yaw] = at[i]; w.visible = true; w.position.set(x + V0 * tLeft, WATER_Y, z); w.rotation.set(w.userData.tilt[0], yaw, w.userData.tilt[1]);
      w.updateMatrixWorld(true);
      const f = this.addFire(w.userData.fire.clone().applyMatrix4(w.matrixWorld), i < 3 ? 1.5 : 1.2, { life: 1e9 });
      this.drift.push({ w, f, v: V0 * (0.9 + 0.2 * ((i * 37) % 5) / 5), spin: ((i % 2) ? 1 : -1) * 0.02, ph: i * 1.7 });
    });
  }
  _updateDrift(dt) {
    for (const D of this.drift) {
      const w = D.w; w.position.x -= D.v * dt; w.rotation.y += D.spin * dt;
      w.position.y = WATER_Y + Math.sin(this.g.time * 0.7 + D.ph) * 0.12; w.rotation.x = w.userData.tilt[0] + Math.sin(this.g.time * 0.5 + D.ph) * 0.03;
      w.updateMatrixWorld(true); D.f.p.copy(w.userData.fire).applyMatrix4(w.matrixWorld);
    }
  }

  // ================================================================== fires (persistent, light the scene)
  addFire(p, size = 1, { smoke = true, life = 1e9 } = {}) { const f = { p: p.clone(), size, smoke, t: 0, life }; this.fires.push(f); return f; }
  _updateFires(dt) {
    const g = this.g, head = g.headPos;
    const near = [];
    for (const f of this.fires) {
      f.t += dt; if (f.t > f.life) { f.dead = true; continue; }
      const d = f.p.distanceTo(head);
      if (f.lamp) { const k = f.lamp(); if (k > 0.02 && d < 60) near.push({ f, d: d * 0.5, k }); continue; }   // a lamp: light only (the two pooled lights go to whatever is nearest)
      near.push({ f, d });
      if (d > 420) continue;
      const far = d > 110 ? 0.45 : 1, big = d > 110 ? 1.7 : 1;
      if (rand() < dt * 14 * f.size * far) g.fx.flame(_v.set(f.p.x + range(-1, 1) * f.size, f.p.y + range(0, 0.6), f.p.z + range(-1, 1) * f.size), range(0.9, 1.6) * f.size * big);
      if (f.smoke && rand() < dt * 1.2 * far) g.clouds.spawn({ x: f.p.x + range(-1, 1), y: f.p.y + 2 * f.size, z: f.p.z + range(-1, 1), vx: range(-0.5, 0.5) - 0.6, vy: range(2.5, 4), vz: range(-0.5, 0.5), drag: 0.2, buoy: 0.3, s0: 2 * f.size, s1: 9 * f.size, life: range(6, 9), a: 0.8, fadeIn: 0.05, fadeOut: 0.5, r: 0.05, g: 0.045, b: 0.04, r1: 0.1, g1: 0.09, b1: 0.08, glow: 1.8, glowFade: 3 });
    }
    this.fires = this.fires.filter(f => !f.dead);
    near.sort((a, b) => a.d - b.d);
    this.lights.forEach((L, i) => {
      const n = near[i];
      if (n && n.d < 70) { L.p.copy(n.f.p).setY(n.f.p.y + 1.8); L.k = damp(L.k, n.f.lamp ? 16 * n.f.size * n.k : 12 * n.f.size * (0.8 + 0.2 * Math.sin(g.time * 17 + i * 3) + 0.1 * Math.sin(g.time * 41 + i)), 6, dt); L.l.distance = n.f.lamp ? 46 : 26; } else L.k = damp(L.k, 0, 3, dt);
      L.l.position.copy(L.p); L.l.intensity = L.k;
    });
  }

  // ================================================================== the power
  // kind 'flick': a brown-out stutter, a pop, dark. 'cut': dark from the top down (c0 → c1 world y over dur), flickering.
  // 'on': it comes back (a stutter, then steady). rest: what it settles at (emergency lighting).
  cut(id, { delay = 0, kind = 'flick', c0 = 300, c1 = 40, dur = 2, rest = 0, arcs = true, quiet = false } = {}) {
    this.cuts.push({ id, t: -delay, kind, c0, c1, dur, rest, arcs, quiet, done: false });
  }
  cutNow(ids, rest = 0) { for (const id of ids) { POWER.pow.value[id] = rest; POWER.cut.value[id] = 9999; } this._glowNow(); }
  _glowNow() { let s = 0, n = 0; for (const [id, w] of CITY) { s += POWER.pow.value[id] * w; n += w; } this.g.glow = s / n; }
  _updatePower(dt) {
    const P = POWER.pow.value, C = POWER.cut.value, g = this.g;
    for (const e of this.cuts) {
      e.t += dt; if (e.t < 0) continue;
      const k = e.t;
      if (!e.done) {
        e.done = true;
        if (e.kind !== 'on') { if (e.arcs) this._arcs(e.id); if (!e.quiet) { this.audio.play('power_down', { volume: 0.9 }) || this.audio.play('collapse_rumble', { volume: 0.35, pitch: 1.6 }); this.audio.play('impact_metal', { volume: 0.4, pitch: 0.4 }); } }
        g.events.push({ type: e.kind === 'on' ? 'powerOn' : 'powerCut', id: e.id });
      }
      if (e.kind === 'flick') { P[e.id] = k < 0.7 ? Math.max(e.rest, (Math.sin(k * 60 + e.id) > 0 ? 0.9 : 0.15) * (1 - k / 0.7 * 0.5)) : e.rest; if (k >= 0.7) e.over = true; }
      else if (e.kind === 'cut') {
        const u = clamp(k / e.dur, 0, 1);
        C[e.id] = e.c0 + (e.c1 - e.c0) * u;
        P[e.id] = u >= 1 ? e.rest : (Math.sin(k * 47 + e.id) > -0.2 ? 1 : 0.4);
        if (u >= 1) { C[e.id] = 9999; e.over = true; }
      } else { C[e.id] = 9999; P[e.id] = k < 0.9 ? (Math.sin(k * 52 + e.id * 3) > 0.1 ? 0.85 : 0.1) * (0.3 + 0.7 * k / 0.9) : 1; if (k >= 0.9) e.over = true; }
    }
    this.cuts = this.cuts.filter(e => !e.over);
    let s = 0, n = 0; for (const [id, w] of CITY) { s += Math.min(1, P[id]) * w; n += w; }
    g.glow = damp(g.glow, s / n, 2, dt);
  }
  // transformer arcs: blue-white flashes popping across a district as it goes
  _arcs(id) {
    const g = this.g;
    if (!this._distPts) { this._distPts = {}; for (const L of g.world.glowList) { const c = (L.code ?? 16) % 16; const p = L.p.isVector3 ? L.p : new THREE.Vector3(...L.p); (this._distPts[c] ||= []).push(p); } }
    const pts = this._distPts[id] || []; if (!pts.length) return;
    const n = Math.min(pts.length, 5 + (rand() * 4 | 0));
    for (let i = 0; i < n; i++) g.fx.later(rand() * 0.9, () => {
      const p = pts[(rand() * pts.length) | 0], d = p.distanceTo(g.headPos), sz = Math.min(11, 4 + d * 0.05);
      g.fx.main.spawn({ x: p.x, y: p.y, z: p.z, frame: CELL.FLASH, s0: sz * 0.35, s1: sz * 0.9, life: 0.14, r: 0.9, g: 1.25, b: 1.9, fadeIn: 0, fadeOut: 0.5 });
      g.fx.main.spawn({ x: p.x, y: p.y, z: p.z, frame: CELL.GLOW, s0: sz * 0.8, s1: sz * 1.3, life: 0.3, r: 0.22, g: 0.36, b: 0.7, a: 1, fadeIn: 0, fadeOut: 0.6 });
      for (let k = 0; k < 14; k++) g.fx.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: range(-6, 6), vy: range(0, 8), vz: range(-6, 6), grav: 9.8, drag: 0.15, frame: CELL.SPARK, s0: 1 + d * 0.004, w: 0.05 + d * 0.0003, len: 0.2, life: range(0.5, 1.4), r: 2.2, g: 2.6, b: 3.4, a: 1, fadeOut: 0.4 });
      if (d < 160) g.fx.light(p, 50, 0.1, 0x9ec8ff, true, 50);
      if (d < 400) this.audio.play('impact_metal', { x: p.x, y: p.y, z: p.z, volume: 0.6, pitch: 1.8 });
    });
  }
  // the end: when the tower lands, whatever was still on goes with it
  lightsOut() {
    if (this.dark) return; this.dark = true;
    for (const [id] of CITY) if (POWER.pow.value[id] > 0.01 && id !== DIST.TOWER && !(id === DIST.HILL && !SLIDE.gone)) this.cut(id, { delay: rand() * 0.5, kind: 'flick', arcs: false, quiet: true, rest: id === DIST.FORE ? 0 : 0.1 });
    this.audio.play('power_down', { volume: 1 });
    this.g.events.push({ type: 'lightsOut' });
  }
  // ...and after the landing: Longwu comes back, district by district, from downstream up
  lightsReturn() {
    if (this.back) return; this.back = true;
    const order = [DIST.FAR_W, DIST.R0, DIST.R1, DIST.FAR_S, DIST.R2, DIST.R3, DIST.BR0, DIST.BR1, DIST.BR2, DIST.FAR_N, DIST.FORE, DIST.FAR_E, DIST.EAST];
    order.forEach((id, i) => this.cut(id, { delay: 0.4 + i * 0.55, kind: 'on' }));
    this.g.events.push({ type: 'lightsReturn' });
  }

  // ================================================================== NIGHT HERON ONE → the hill
  landslide(fast = false, c0 = null) {
    if (this.slide.active) return;
    this.slide.start(fast, c0);
    if (fast) { POWER.pow.value[DIST.HILL] = 0; POWER.pow.value[DIST.EAST] = 0.12; this._glowNow(); }
    else {
      this.cut(DIST.HILL, { delay: 15, kind: 'flick', arcs: false, quiet: true }); if (POWER.pow.value[DIST.EAST] > 0.3) this.cut(DIST.EAST, { delay: 13, kind: 'flick', rest: 0.14 });
      // fire follows the slide down: along the crest first, then the broken terraces, then the quay; it keeps burning (the scar is lit for the rest of the level)
      const g = this.g;
      for (let i = 0; i < 46; i++) g.fx.later(2.5 + i * 0.2 + rand() * 0.2, () => { const x = range(SLIDE.x0 + 10, SLIDE.x1 - 10), s0 = range(12, 18); g.clouds.spawn({ x, y: range(4, 22), z: range(140, 172), vx: range(-2, 2), vy: range(1, 5), vz: range(5, 11), drag: 0.5, buoy: 0.06, s0, s1: s0 * range(2.8, 3.6), life: range(9, 13), a: 0.7, fadeIn: 0.06, fadeOut: 0.5, r: 0.3, g: 0.22, b: 0.14, r1: 0.2, g1: 0.165, b1: 0.13, glow: 1.6, glowFade: 4 }); });
      for (const [t, bx, by, bz, k] of [[1.4, 447, 80, 50, 4.2], [5.0, 520, 40, 96, 3.4], [8.6, 430, 22, 132, 3.6]]) g.fx.later(t, () => { const P = new THREE.Vector3(bx, by, bz); g.fx.explosion(P, 5, { noRing: true }); this.heron1.megaFireball(P, k, [0, 0, 1]); g.fx.light(P, 2400, 1.8, 0xff9040, true, 500); g.lastExplosionShake = 0.4; g.lastExplosionT = g.time; this.audio.play('explosion_big', { volume: 0.6, pitch: 0.75 }); });
      for (const [t, fx, fy, fz, k] of [[1.0, 447, 66, 46, 4.2], [1.6, 458, 62, 50, 1.6], [2.4, 505, 60, 50, 1.2], [3.2, 400, 58, 52, 2.2], [4.5, 470, 40, 86, 3.4], [4.9, 482, 36, 92, 1.4], [5.2, 552, 44, 80, 1.0], [6.4, 418, 30, 104, 1.4], [7.0, 515, 26, 112, 3.8], [7.3, 528, 22, 118, 1.8], [8.2, 580, 30, 110, 1.1], [9.0, 452, 14, 142, 2.8], [9.8, 546, 12, 148, 1.2], [10.6, 392, 12, 150, 1.6], [11.4, 600, 22, 120, 1.0]])
        g.fx.later(t, () => { const P = new THREE.Vector3(fx, fy, fz); g.fx.explosion(P.clone().setY(fy + 4), 2.2, { noRing: true }); this.addFire(P, k * 1.3, { life: 1e9 }); });
    }
  }

  // ================================================================== the lift
  inLift(h = this.g.headPos) { return h.x > LIFT.x0 + 0.5 && h.x < LIFT.x1 - 0.5 && h.z > LIFT.z0 + 0.3 && h.z < LIFT.z1 - 0.4 && Math.abs(h.y - 1.6 - this.lift.y) < 2.5; }
  // the platform is ground while you are over it and near its level
  liftFloor(x, z, y) { const L = this.lift; if (x > LIFT.x0 && x < LIFT.x1 && z > LIFT.z0 && z < LIFT.z1 + (L.state === 'bottom' ? 0.5 : 0) && Math.abs(y - L.y) < 2.5) return L.y; return undefined; }
  liftStart() {
    const L = this.lift; if (L.state !== 'bottom') return;
    L.state = 'up'; L.t = 0; L.v = 0;
    if (this.tw) this.tw.gate.visible = true;
    for (const s of this.g.soldiers) if (s.alive) { s.alive = false; s.root.visible = false; }   // nobody snipes the lift from the ground
    this.audio.play('container_doors', { volume: 0.7, pitch: 1.3 });
    this.audio.play('gear_rattle', { volume: 0.6, pitch: 0.6 });
    this.g.events.push({ type: 'liftUp' });
  }
  liftTop() { const L = this.lift; L.state = 'top'; L.y = LIFT.y1; L.v = 0; this._liftPose(); this.onRoof = true; if (this.tw) this.tw.gate.visible = false; }
  _liftPose() { const y = this.lift.y; STATE.liftY = y; this.liftLamp.p.y = y + 2.6; if (this.tw) { this.tw.lift.position.y = y; this.tw.liftGlow.p.y = y + 0.6; this.tw.liftGlow.dead = y > LIFT.y0 + 0.4; } }
  _updateLift(dt) {
    const L = this.lift; if (L.state !== 'up') return;
    const g = this.g;
    L.t += dt;
    if (L.blink) {
      // comfort option: doors, a blink to black, out on the roof
      const o = L.t < 0.5 ? L.t / 0.5 : L.t < 2.8 ? 1 : Math.max(0, 1 - (L.t - 2.8) / 0.6);
      this.fadeMesh.material.opacity = o; this.fadeMesh.visible = o > 0.002;
      if (L.t > 0.6 && L.y < LIFT.y1) { L.y = LIFT.y1; this._liftPose(); }
      if (L.t > 3.4) { this.fadeMesh.visible = false; this._liftArrive(); }
      return;
    }
    // a steady ride: ease out of the bottom, ease into the top (never a jolt)
    const left = LIFT.y1 - L.y, vmax = Math.min(LIFT.speed, Math.sqrt(2 * 1.6 * Math.max(0, left)) + 0.25);
    L.v = Math.min(vmax, L.v + 1.6 * dt);
    L.y = Math.min(LIFT.y1, L.y + L.v * dt);
    this._liftPose();
    this.audio.setLoop?.('wind', { volume: 0.3 + 0.4 * L.v / LIFT.speed, intensity: 0.5 });
    if (rand() < dt * 3) g.fx.sparks.spawn({ x: chance(0.5) ? LIFT.x0 : LIFT.x1, y: L.y - 0.3, z: LIFT.z0 + 0.3, vx: range(-1, 1), vy: range(-3, 0), vz: range(0, 2), grav: 9.8, drag: 0.2, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.2, life: range(0.3, 0.8), r: 2.6, g: 1.8, b: 0.8, a: 1, fadeOut: 0.4 });
    if (left <= 0.001) this._liftArrive();
  }
  _liftArrive() {
    const L = this.lift; L.state = 'top'; L.v = 0; L.y = LIFT.y1; this._liftPose();
    this.onRoof = true; if (this.tw) this.tw.gate.visible = false;
    this.audio.play('container_doors', { volume: 0.8, pitch: 1.2 });
    this.g.events.push({ type: 'roof' });
  }

  // ================================================================== Jinlong: hit, groaning, the rig, the jump, the fall
  // Heron Two is in its west face: fires on the floors under the parapet, blasts walking down the shaft
  towerHit(I) {
    if (this.hitT !== undefined) return;
    const g = this.g;
    this.hitT = g.time; this.hitP = I ? I.clone() : new THREE.Vector3(TOWER.x0 - 1, ROOFTOP.y - 26, TCZ);
    for (let i = 1; i <= 5; i++) g.fx.later(0.5 + i * 0.5, () => { const p = new THREE.Vector3(TOWER.x0 - 1.5, this.hitP.y - i * 24 + range(-4, 4), TCZ + range(-12, 12)); g.fx.explosion(p, range(1.6, 2.4), { noRing: true }); g.glass.burst?.(p.clone(), new THREE.Vector3(-1, 0.2, 0), 30, { spread: 5, speed: 6, size: 0.4, life: 9 }); this.audio.play('explosion_big', { x: p.x, y: p.y, z: p.z, volume: 0.8 }); });
    g.events.push({ type: 'towerHit' });
  }
  towerGroan(k) {
    const g = this.g, T = TOWER;
    if (!this._groanT || g.time > this._groanT) {
      this._groanT = g.time + range(2.5, 5) / Math.max(0.3, k);
      this.audio.play('metal_groan', { x: TCX, y: ROOFTOP.y - 10, z: TCZ, volume: 0.6 + 0.4 * k });
      g.lastExplosionShake = 0.25 + 0.5 * k; g.lastExplosionT = g.time;
      // grit jumping off the deck, a window blowing out somewhere below, smoke up past the west edge
      for (let i = 0; i < 8; i++) g.fx.main.spawn({ x: range(T.x0 + 2, T.x1 - 2), y: ROOFTOP.y + 0.2, z: range(T.z0 + 2, T.z1 - 2), vy: range(0.5, 1.5), drag: 1, frame: CELL.DUST, s0: 0.4, s1: 2.4, life: 2, rot: rand() * 6, r: 0.5, g: 0.47, b: 0.44, a: 0.4, fadeOut: 0.5 });
      if (chance(0.6)) { const y = range(90, 220), x = chance(0.5) ? T.x0 - 0.5 : T.x1 + 0.5; g.glass.burst?.(new THREE.Vector3(x, y, range(T.z0, T.z1)), new THREE.Vector3(Math.sign(x - TCX), 0, 0), 20, { spread: 2, speed: 4, size: 0.3, life: 8 }); }
    }
    if (this.hitP && rand() < 0.05) g.clouds.spawn({ x: TOWER.x0 - 3, y: this.hitP.y + range(0, 8), z: this.hitP.z + range(-8, 8), vx: range(-3, -1), vy: range(6, 10), vz: range(-1, 1), drag: 0.3, buoy: 0.4, s0: 5, s1: range(18, 26), life: range(6, 9), a: 0.85, fadeIn: 0.05, fadeOut: 0.5, r: 0.05, g: 0.045, b: 0.04, r1: 0.11, g1: 0.1, b1: 0.09, glow: 1.8, glowFade: 3 });
  }
  takeRig() {
    if (this.rigOn) return; this.rigOn = true;
    for (const b of this.g.world.col.boxes) if (b.data.kind === 'gapbar') b.enabled = false;
    this.barUp = 0;   // the barrier arm swings up (see _liftPose)
    this.g.audio.play('reload', { volume: 1 }); this.g.audio.play('gear_rattle', { volume: 1 });
    this.g.hud.objective('BASE RIG ON — off the west edge!', 4);
    this.g.events.push({ type: 'rig' });
  }
  nearLocker() { const h = this.g.headPos, R = ROOFTOP; return Math.hypot(h.x - R.locker.x, h.z - R.locker.z) < 2.7 && Math.abs(h.y - R.y - 1.6) < 1.5; }
  atEdge() { const h = this.g.headPos, R = ROOFTOP; return this.rigOn && h.y > R.y && h.z > R.gap[0] && h.z < R.gap[1] && h.x < R.x0 + 1.5; }
  // the jump: slow-mo, the rig carries you off the edge onto the rail; the canopy opens at once (no free fall)
  jump() {
    if (this.glide) return;
    const g = this.g;
    this.glide = { state: 'jump', t: 0, from: g.rig.position.clone() };
    this.riding = true;
    if (g.loco) g.loco.enabled = false;
    g.slowmo(1.8, 0.3, true);
    this.audio.play('whiz', { volume: 1, pitch: 0.5 });
    for (const s of g.soldiers) if (s.alive && s.role !== 'jumper') { s.alive = false; s.root.visible = false; }
    g.events.push({ type: 'jump' });
  }
  towerFall(fast = false) {
    if (this.fall) return;
    this.fall = { t: 0, a: 0, av: 0.04, hit: false };
    const g = this.g, tw = this.tw;
    POWER.pow.value[DIST.TOWER] = 1; POWER.cut.value[DIST.TOWER] = 9999; POWER.die.value = 0;
    if (tw) for (const c of tw.colliders) if (c.box) c.box.enabled = false;
    if (fast) { Object.assign(this.fall, { hit: true, free: true, gone: true }); POWER.pow.value[DIST.TOWER] = 0; if (tw) { tw.pivot.visible = false; for (const gl of tw.riding) gl.dead = true; } this._glowNow(); return; }
    this.audio.play('collapse_rumble', { x: HINGE.x, y: Y, z: HINGE.z, volume: 1 });
    this.audio.play('metal_groan', { x: HINGE.x, y: Y, z: HINGE.z, volume: 1 });
    // the shear at the base: a ring of blasts where the shaft tears off the podium, a skirt of dust over the forecourt
    for (let i = 0; i < 6; i++) g.fx.later(i * 0.12, () => { const p = new THREE.Vector3(range(TOWER.x0, TOWER.x1), Y + range(1, 6), chance(0.5) ? TOWER.z0 - 1 : TOWER.z1 + 1); g.fx.explosion(p, 1.4, { noRing: true }); });
    for (let i = 0; i < 22; i++) g.fx.later(rand() * 1.6, () => { const a = rand() * 6.283, s0 = range(10, 16); g.clouds.spawn({ x: TCX + Math.cos(a) * 22, y: Y + range(2, 20), z: TCZ + Math.sin(a) * 22, vx: Math.cos(a) * range(5, 12), vy: range(-1, 3), vz: Math.sin(a) * range(5, 12), drag: 0.7, buoy: 0.08, s0, s1: s0 * range(3, 4), life: range(10, 15), a: 0.8, fadeIn: 0.05, fadeOut: 0.5, r: 0.2, g: 0.16, b: 0.12, r1: 0.17, g1: 0.15, b1: 0.13, glow: 0.8, glowFade: 3 }); });
    g.events.push({ type: 'towerFall' });
  }
  // where a point of the standing tower is now
  twPoint(p, out) { return out.set(p.x - HINGE.x, p.y - HINGE.y, p.z - HINGE.z).applyMatrix4(this.tw.pivot.matrixWorld); }
  _updateFall(dt) {
    const F = this.fall; if (!F || !this.tw || F.gone) return;
    const g = this.g, tw = this.tw, d = this.fallDir;
    F.t += dt;
    const L = TOWER.h, axis = _v.set(d.z, 0, -d.x).normalize();
    if (!F.free && !F.rest) {
      // a falling rod: a'' = 1.2 g / L · sin a
      F.av += (1.2 * 9.8 / L * Math.sin(F.a + 0.04)) * dt;
      F.a += F.av * dt;
      if (F.a > 1.0) {
        // well over: it tears off the podium — a free body now, its centre of mass falling into the hole the hill left
        F.free = true; F.rc = new THREE.Vector3(16, L * 0.5, 0);
        const q = _q.setFromAxisAngle(axis, F.a);
        F.com = F.rc.clone().applyQuaternion(q).add(_v2.set(HINGE.x, HINGE.y, HINGE.z));
        F.vc = axis.clone().multiplyScalar(F.av).cross(F.com.clone().sub(_v2));
        F.w = F.av; F.vc.y -= 5;
        this.audio.play('metal_groan', { x: HINGE.x, y: Y, z: HINGE.z, volume: 1, pitch: 0.6 });
        for (let i = 0; i < 5; i++) g.fx.later(i * 0.1, () => g.fx.explosion(new THREE.Vector3(HINGE.x + range(-4, 24), Y + range(-1, 4), HINGE.z + range(-18, 18)), 1.4, { noRing: true }));
      }
    }
    if (F.free && !F.rest) {
      F.vc.y -= 9.8 * dt;
      if (F.a > 1.5) F.w *= Math.exp(-3 * dt);
      F.com.addScaledVector(F.vc, dt); F.a = Math.min(1.62, F.a + F.w * dt);
      const floor = Math.max(WATER_Y, groundAt(F.com.x, F.com.z)) + 13;
      if (F.com.y < floor) { F.com.y = floor; F.rest = true; this.addFire(F.com.clone().setY(floor - 6), 2.4, { life: 600 }); }
    }
    tw.pivot.quaternion.setFromAxisAngle(axis, F.a);
    if (F.free) tw.pivot.position.copy(F.rc).applyQuaternion(tw.pivot.quaternion).multiplyScalar(-1).add(F.com);
    tw.pivot.updateMatrixWorld(true);
    const top = this.twPoint(tw.top, _v2).clone();
    F.top = top;
    // the lights die as it goes, section by section (kit.js dieK): a gold tower going over, dark when it lands
    POWER.pow.value[DIST.TOWER] = F.hit ? 0 : 1;
    POWER.die.value = F.hit ? 1 : Math.max(0.001, Math.pow(clamp((F.a - 0.2) / 1.15, 0, 1), 1.4));
    { const e = _m4d.copy(tw.pivot.matrixWorld).invert().elements; POWER.dieRow.value.set(e[1], e[5], e[9], e[13] + HINGE.y); }
    for (const gl of tw.riding) { this.twPoint(gl.local, gl.p); if (F.hit) gl.dead = true; }
    if (!F.hit) {
      // it sheds glass and dust off its leading face on the way down, fire trailing from where the gunship went in
      if (rand() < dt * 18) { const p = this.twPoint(_v3.set(TOWER.x0 - 1, range(Y + 30, ROOFTOP.y), range(TOWER.z0, TOWER.z1)), new THREE.Vector3()); g.glass.burst?.(p, new THREE.Vector3(range(-1, 1), 0.5, range(-1, 1)), 14, { spread: 3, speed: 3, size: 0.35, life: 10 }); }
      if (rand() < dt * 5) { const p = this.twPoint(_v3.set(range(TOWER.x0, TOWER.x1), range(Y + 40, ROOFTOP.y), chance(0.5) ? TOWER.z0 - 2 : TOWER.z1 + 2), new THREE.Vector3()); g.clouds.spawn({ x: p.x, y: p.y, z: p.z, vx: range(-2, 2), vy: range(1, 4), vz: range(-2, 2), drag: 0.6, buoy: 0.2, s0: 6, s1: 22, life: range(5, 8), a: 0.55, fadeIn: 0.05, fadeOut: 0.5, r: 0.12, g: 0.11, b: 0.1, r1: 0.2, g1: 0.18, b1: 0.16, glow: 0.8, glowFade: 3 }); }
      if (this.hitP && rand() < dt * 9) { const p = this.twPoint(_v3.set(TOWER.x0 - 2, this.hitP.y + range(-10, 6), this.hitP.z + range(-8, 8)), new THREE.Vector3()); g.fx.flame(p, range(2, 3.4)); }
    }
    // impact: the crown reaches the ground / the river
    if (!F.hit && (top.y < Math.max(WATER_Y, groundAt(top.x, top.z)) + 6 || F.rest)) {
      F.hit = true;
      const P = top.clone(); P.y = Math.max(WATER_Y + 1, P.y);
      g.slowmo(2.0, 0.3, true);
      g.lastExplosionT = g.time; g.lastExplosionShake = 0.9;
      this.audio.play('collapse_impact', { x: P.x, y: P.y, z: P.z, volume: 1 });
      this.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
      this.audio.play('collapse_rumble', { x: P.x, y: P.y, z: P.z, volume: 1 });
      const base = this.twPoint(_v3.set(TCX, Y + 6, TCZ), new THREE.Vector3());
      this._waterLine(base, P, 1.9); this._groundLine(base, P);
      g.fx.light(P, 1800, 1.6, 0xffa050, true, 500);
      g.events.push({ type: 'towerDown', P: P.clone() });
      g.addScore(5000, null);
      // THE money shot: she lands on the hillside district, still lit, and the hill lets go under her. It goes into the
      // river beside you with its lights on; then Longwu is dark
      this.lightsOut();   // (the hill stays lit: director.js lets it go as you come level with it)
    }
  }
  // the impact on the ground: a wall of dust thrown out both sides along its whole length, panels and steel flung
  // outward, fires breaking out along it
  _groundLine(a, b) {
    const g = this.g, n = Math.max(6, Math.round(a.distanceTo(b) / 15));
    const px = -(b.z - a.z), pz = b.x - a.x, pl = Math.hypot(px, pz) || 1, ux = px / pl, uz = pz / pl;
    for (let j = 0; j <= n; j++) {
      const q = new THREE.Vector3().lerpVectors(a, b, j / n);
      if (q.z > 162) continue;                                   // (over the river it's the water line)
      q.y = Math.max(WATER_Y + 2, groundAt(q.x, q.z) + 2);
      g.fx.later(j * 0.05 + rand() * 0.05, () => {
        for (const sg of [-1, 1]) for (let i = 0; i < 2; i++) { const s0 = range(11, 17), sp = range(11, 22); g.clouds.spawn({ x: q.x + ux * sg * 14 + range(-5, 5), y: q.y + range(2, 9), z: q.z + uz * sg * 14 + range(-5, 5), vx: ux * sg * sp, vy: range(1, 6), vz: uz * sg * sp, drag: 0.75, buoy: 0.1, s0, s1: s0 * range(3, 3.8), life: range(8, 12), a: 0.72, fadeIn: 0.03, fadeOut: 0.5, r: 0.25, g: 0.19, b: 0.12, r1: 0.19, g1: 0.16, b1: 0.13, glow: 1.0, glowFade: 3 }); }
        g.clouds.spawn({ x: q.x, y: q.y + 8, z: q.z, vx: range(-2, 2), vy: range(13, 22), vz: range(-2, 2), drag: 0.7, buoy: 0.3, s0: 14, s1: range(40, 54), life: range(9, 13), a: 0.7, fadeIn: 0.03, fadeOut: 0.5, r: 0.22, g: 0.17, b: 0.11, r1: 0.17, g1: 0.15, b1: 0.13, glow: 1.4, glowFade: 2 });
        for (let i = 0; i < 5; i++) { const sg = rand() < 0.5 ? -1 : 1, sp = range(8, 20); g.fx.spawnDebris(new THREE.Vector3(q.x + range(-8, 8), q.y + range(2, 12), q.z + range(-8, 8)), ux * sg * sp + range(-4, 4), range(6, 18), uz * sg * sp + range(-4, 4), range(2, 5), rand() < 0.3); }
        for (let i = 0; i < 12; i++) g.fx.sparks.spawn({ x: q.x + range(-8, 8), y: q.y + range(2, 10), z: q.z + range(-8, 8), vx: range(-14, 14), vy: range(4, 18), vz: range(-14, 14), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 2, w: 0.4, len: 1.5, life: range(1.5, 3), r: 2.6, g: 1.6, b: 0.6, a: 0.9, fadeOut: 0.5 });
        if (j % 3 === 1) { g.fx.explosion(q.clone().setY(q.y + 6), range(2, 3), { noRing: true }); this.addFire(q.clone().setY(q.y + 3), range(1.4, 2.2), { life: 600 }); }
      });
    }
  }
  // white water along a line on the river
  _waterLine(a, b, k = 1) {
    const g = this.g, n = Math.max(3, Math.min(9, Math.round(a.distanceTo(b) / 22)));
    for (let j = 0; j <= n; j++) {
      const q = new THREE.Vector3().lerpVectors(a, b, j / n); q.y = WATER_Y;
      if (q.z < 156) continue;
      g.fx.later(j * 0.07 + rand() * 0.06, () => {
        for (let i = 0; i < 2; i++) { const s0 = range(9, 14) * k; g.clouds.spawn({ x: q.x + range(-6, 6), y: q.y + range(5, 10), z: q.z + range(-6, 6), vx: range(-3, 3), vy: range(14, 26) * k, vz: range(-3, 3) + 2, drag: 0.8, buoy: 0.3, s0, s1: s0 * range(3.2, 4.2), life: range(6, 8), a: 0.65, fadeIn: 0.04, fadeOut: 0.6, r: 0.25, g: 0.2, b: 0.14, r1: 0.19, g1: 0.16, b1: 0.12, glow: 0.3, glowFade: 2 }); }
        for (let i = 0; i < 16; i++) g.fx.main.spawn({ x: q.x + range(-7, 7), y: q.y + 1, z: q.z + range(-7, 7), vx: range(-7, 7), vy: range(16, 40) * k, vz: range(-7, 7), grav: 9.8, drag: 0.35, frame: CELL.WISP, s0: 3 * k, s1: 9 * k, life: range(2, 3.4), rot: rand() * 6, r: 0.44, g: 0.38, b: 0.3, a: 0.4, fadeOut: 0.5 });
        if (j % 3 === 0) g.fx.ring?.(q, 22 * k, 1.6, WATER_Y + 0.3);
      });
    }
  }

  // ================================================================== the glide
  _startRail() {
    const G = this.glide;
    G.state = 'fly'; G.t = 0;
    this.canopy.visible = true;
    this.canopy.scale.setScalar(0.05);
    this.audio.play('container_doors', { volume: 0.8, pitch: 1.6 });   // the canopy cracking open
    // the gunboat: put it where it will be under the end of the line when you get there
    const T = this.rail.len / GLIDE_SPEED;
    this.boat.visible = true;
    // it ends broadside (yaw 90°, bow north): the aft deck is then 8.5 m south of its middle, and from it you look
    // west across the beam at open river, with the deckhouse beside you instead of in your face
    const dk = this.boat.userData.deck;
    this.boatX = (this.rail.curve.points[this.rail.curve.points.length - 1].x - dk.z) - BOAT.speed * T;
    this.boat.rotation.y = 0;
    this.boat.position.set(this.boatX, WATER_Y + 0.15, BOAT.z + dk.x);
    this._spawnGlideEnemies();
    // what the hill left: fires all down the scar and along the quay, so the wreckage is lit when you fly along it
    if (this.fires.length < 8) for (const [fx, fy, fz, k] of [[575, 30, 110, 2.2], [545, 14, 150, 1.8], [515, 36, 92, 2.0], [488, 10, 158, 1.6], [460, 28, 104, 2.4], [432, 12, 150, 1.8], [405, 30, 96, 2.0], [384, 9, 156, 1.6], [620, 24, 118, 1.8]]) this.addFire(new THREE.Vector3(fx, fy, fz), k, { life: 200 });   // (a ?beat= jump: the slide's own fires never ran)
    this.g.events.push({ type: 'canopy' });
  }
  _spawnGlideEnemies() {
    const g = this.g, S = this.search, T = this.rail.len / GLIDE_SPEED;
    const ud = this.boat.userData;
    this.boatCrew = [ud.gunner, ...ud.crew].map((p, i) => g.spawnSoldier({ x: this.boat.position.x + p.x, y: p.y, z: this.boat.position.z + p.z, role: 'deck', carrier: { obj: this.boat, local: p.clone(), vel: new THREE.Vector3(BOAT.speed, 0, 0) }, delay: T - 24 + i, range: 90, noNade: true }));
    this.boatLight = S.add({ p: ud.lamp.clone(), carrier: { obj: this.boat, local: ud.lamp.clone() }, yaw0: 0, pitch0: 0.55, sweep: [0.6, 0.2, 0.3], len: 150, spread: 0.06, shooters: this.boatCrew, color: [0.4, 0.39, 0.36] });
    const drumsP = () => ud.drumsP.clone().applyMatrix4(this.boat.matrixWorld);
    this.drums = { hp: 6, dead: false };
    const D = this.drums, self = this;
    g.targets.push({
      active: () => !D.dead && this.boat.visible,
      ray: (o, d) => { const c = drumsP(); _v.subVectors(o, c); const b = _v.dot(d), cc = _v.lengthSq() - 1.0, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; },
      hit: (P) => { D.hp--; g.fx.impact(P, _v.set(0, 1, 0), 'metal'); g.hitMarker(false); if (D.hp <= 0) self.blowDrums(); },
      blast: (P, r) => { if (P.distanceTo(drumsP()) < r + 1) self.blowDrums(); },
      aim: drumsP,
      auto: (head) => { const p = drumsP(); const d = p.distanceTo(head); return D.dead || d > 110 || !self.glide || self.rail.len - self.rail.s > 205 ? null : { kind: 'target', p, score: 90, ref: g.targets[g.targets.length - 1], tol: 0.03 }; },
    });
    // two armed barges on the river either side of the line (gunners + a searchlight each): they open up as you come over them
    this.barges = [];
    // (built once, in setpieces' constructor: see this.bargeMeshes)
    for (const [i, [x, z, v, s]] of [[372, 254, 0.5, 338], [306, 214, -0.4, 404]].entries()) {
      const b = this.bargeMeshes[i]; b.position.set(x, WATER_Y + 0.15, z); b.rotation.y = v < 0 ? Math.PI : 0; b.visible = true; b.updateMatrixWorld(true);
      const t0 = Math.max(4, s / GLIDE_SPEED - 15), ud = b.userData;
      const wp = (p) => p.clone().applyMatrix4(b.matrixWorld);
      const crew = ud.crew.map((p, i) => { const W = wp(p); return g.spawnSoldier({ x: W.x, y: W.y, z: W.z, role: 'deck', carrier: { obj: b, local: p.clone(), vel: new THREE.Vector3(v, 0, 0) }, delay: t0 + i * 2, range: 110, noNade: true }); });
      const L = S.add({ p: wp(ud.lamp), carrier: { obj: b, local: ud.lamp.clone() }, yaw0: 0, pitch0: 0.7, sweep: [1.0, 0.25, 0.35], len: 130, spread: 0.07, shooters: crew, color: [0.4, 0.39, 0.36] });
      this.barges.push({ g: b, v, crew, L });
    }
    this.jumpers = [];
  }
  spawnJumper(i) {
    const g = this.g;
    const can = buildCanopy({ top: [0.06, 0.06, 0.065], stripe: [0.55, 0.05, 0.04], drop: 6.0 });
    g.scene.add(can);
    const J = { can, i, off: new THREE.Vector3([-10, 12, -16][i % 3], [3.5, 1.5, 5][i % 3], 0), back: [26, 34, 44][i % 3], t: 0, hp: 4, state: 'fly', vel: new THREE.Vector3(), spin: new THREE.Vector3() };
    J.s = g.spawnSoldier({ x: 0, y: 0, z: 0, role: 'jumper', carrier: { obj: can, local: new THREE.Vector3(0, -6.0 - 1.15, 0), vel: new THREE.Vector3() }, delay: 1.5, range: 90, noNade: true });
    J.s.hitR = true;
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
        J.can.position.y -= dt * 2.2; J.can.position.x -= dt * 1.2; J.can.rotation.z = Math.min(0.5, J.can.rotation.z + dt * 0.05);
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
    // after the landing the boat throttles back and idles mid-river under the credits
    this.boatV = G.state === 'landed' && G.t > 6 ? damp(this.boatV ?? BOAT.speed, 0.2, 0.4, dt) : BOAT.speed;
    if (this.boat.visible) { this.boat.position.x += this.boatV * dt; this.boat.position.y = WATER_Y + 0.15 + Math.sin(g.time * 0.9) * 0.08; this.boat.rotation.z = Math.sin(g.time * 0.7) * 0.012; if (G.state === 'fly') { const k = clamp((80 - this.rail.remaining) / 62, 0, 1); this.boat.rotation.y = k * k * (3 - 2 * k) * Math.PI / 2; } else if (G.state === 'landed') this.boat.rotation.y = Math.PI / 2; this.boat.updateMatrixWorld(true); }
    for (const B of this.barges || []) { B.g.position.x += B.v * dt; B.g.position.y = WATER_Y + 0.15 + Math.sin(g.time * 0.8 + B.v * 9) * 0.06; B.g.updateMatrixWorld(true); }
    // nav lights and deck floods: small points of light (they used to be 2 m blobs from the air)
    const navGlow = (obj, list) => { for (const [lp, c] of list || []) { _v.copy(lp).applyMatrix4(obj.matrixWorld); const d = _v.distanceTo(g.headPos); g.fx.main.spawn({ x: _v.x, y: _v.y, z: _v.z, frame: CELL.GLOW, s0: clamp(d * 0.011, 0.18, 0.9), life: 0.04, r: c[0] * 0.7, g: c[1] * 0.7, b: c[2] * 0.7, a: 1, anchored: false }); } };
    if (this.boat.visible) navGlow(this.boat, this.boat.userData.nav);
    for (const B of this.barges || []) navGlow(B.g, B.g.userData.nav);
    // the funnel's exhaust: a thin grey wisp trailing aft
    if (this.boat.visible && (this._smokeT = (this._smokeT || 0) - dt) <= 0) { this._smokeT = 0.12; _v.copy(this.boat.userData.funnel).applyMatrix4(this.boat.matrixWorld);
      g.fx.main.spawn({ x: _v.x, y: _v.y, z: _v.z, vx: -0.8 + range(-0.2, 0.2), vy: 1.4, vz: range(-0.2, 0.2), drag: 0.3, frame: CELL.WISP, s0: 0.6, s1: 3.2, life: 4, rot: rand() * 6, r: 0.14, g: 0.14, b: 0.15, a: 0.35, fadeOut: 0.6 }); }
    if (this.boat.visible) { const gun = this.boat.userData.gun; gun.lookAt(_v.copy(g.headPos)); gun.rotateY(-Math.PI / 2); gun.rotation.x = 0; gun.rotation.z = 0; }
    if (G.state === 'jump') {
      // off the edge: out and a little down, in slow-mo
      const k = clamp(G.t / 0.75, 0, 1);
      const p0 = this.rail.at(0, _v);
      G.pos = new THREE.Vector3().copy(G.from).lerp(p0, k * k * (3 - 2 * k)).add(_v2.set(0, -k * 0.6, 0));
      if (G.t > 0.75) this._startRail();
    }
    if (G.state === 'fly') {
      let st = 0;
      const P = g.player;
      if (P?.mode === 'vr') { for (const c of P.controllers) if (c.hand === 'left') { const ax = c.source?.gamepad?.axes?.[2] ?? 0; if (Math.abs(ax) > 0.2) st = ax; } }
      else if (P?.keys) st = Math.max(-1, Math.min(1, (P.keys.KeyD ? 1 : 0) - (P.keys.KeyA ? 1 : 0) + (P.touch?.mx || 0))); // touch: the stick's x
      if (g.auto) st = 0;
      this.rail.step(dt, st);
      const k = clamp(G.t / 0.8, 0, 1);
      this.canopy.scale.set(lerp(0.05, 1, k), lerp(0.2, 1, k * k), lerp(0.4, 1, k));
      const left = this.rail.remaining;
      const deck = this.boat.userData.deck.clone().applyMatrix4(this.boat.matrixWorld);
      G.pos = this.rail.pos.clone();
      if (left < 4) { const b = 1 - left / 4; G.pos.lerp(deck, b * b * (3 - 2 * b)); }
      if (left <= 0.02) { G.state = 'landed'; G.t = 0; this._landing(); }
      g.rigVel = new THREE.Vector3().copy(this.rail.tan).multiplyScalar(GLIDE_SPEED);
    }
    if (G.state === 'landed') {
      G.pos = this.boat.userData.deck.clone().applyMatrix4(this.boat.matrixWorld);
      // the canopy is cut away: it blows back up the river behind you (never down through your view)
      // it loses its shape as it goes (no longer a rigid fan hanging in the sky): it folds, sags and settles on the water
      { const C = this.canopy, k = Math.min(1, G.t / 4.5), sag = k * k;
        C.position.x += rdt * (5 - 3 * k); C.position.y = Math.max(WATER_Y + 0.25 - Math.max(0, G.t - 5.5) * 0.5, C.position.y - rdt * (1.2 + 3.2 * sag));   // settles on the water, then, soaked through, goes under
        C.scale.set(1 - 0.45 * k, Math.max(0.12, 1 - 0.95 * sag), 1 - 0.35 * k);
        C.rotation.z = Math.min(1.0, C.rotation.z + rdt * 0.35); C.rotation.x = Math.sin(G.t * 2.1) * 0.12 * (1 - k);
        if (G.t > 10) C.visible = false; }
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
    this._updateDrift(dt);
    this._updatePower(dt);
    this._updateFall(dt);
    this._updateLift(dt);
    if (this.barUp !== undefined && this.tw && this.barUp < 1) { this.barUp = Math.min(1, this.barUp + dt * 1.2); const k = this.barUp; this.tw.bar.rotation.x = -1.35 * k * k * (3 - 2 * k); }
    this.slide.update(dt);
    if (this.slide.active && !SLIDE.gone && this.slide.T > 14) SLIDE.gone = true;
    this.heron1.update(dt);
    this.heron2.update(dt);
    this._updateJumpers(dt);
    this._updateGlide(dt, dt);
    this.search.update(dt);
    this._updateFires(dt);
  }
  afterPlayer(rdt, dt) {
    const g = this.g, G = this.glide, L = this.lift;
    // on the lift: the platform carries you; you can walk about on it but not off it while it moves
    if (L.state === 'up' && !G) {
      const h = g.headPos, rig = g.rig.position;
      const cx = clamp(h.x, LIFT.x0 + 0.45, LIFT.x1 - 0.45), cz = clamp(h.z, LIFT.z0 + 0.35, LIFT.z1 - 0.45);
      rig.x += cx - h.x; rig.z += cz - h.z; rig.y = L.y;
      g.rig.updateMatrixWorld(true);
      return;
    }
    if (!G || !G.pos) return;
    g.rig.position.copy(G.pos);
    // the rig turns with the line (slowly, rate-limited in GlideRail): keep whatever offset you jumped with
    if (G.state === 'fly' || G.state === 'landed') { if (this.yawOff === undefined) this.yawOff = g.rig.rotation.y - this.rail.yaw; g.rig.rotation.y = this.rail.yaw + this.yawOff; }
    g.rig.updateMatrixWorld(true);
    // the canopy: a fixed frame over you. Its risers sit above and just behind your head along the line of flight
    // (wherever your head is in the room), so the lines run up and back out of your view unless you look up
    if (G.state === 'fly') {
      if (this.canopy.parent !== g.rig) g.rig.add(this.canopy);
      const a = -(this.yawOff || 0), hp = g.camera.position, bx = Math.sin(a) * 0.34, bz = Math.cos(a) * 0.34;
      this.canopy.position.set(hp.x + bx, Math.max(1.98, hp.y + 0.32) + this.canopy.userData.drop, hp.z + bz);
      this.canopy.rotation.set(0, a, 0);
    }
  }
}
