import * as THREE from 'three';
import { rand, range, chance, clamp, damp, pick } from '../../rng.js';
import { CELL } from '../../particles.js';
import { buildTanker, MAT } from '../../vehicles.js';
import { Acc, rmMat, hex } from './kit.js';
import { signAtlas } from './signs.js';
import { signQuad, signMaterial } from './city.js';
import { STATE, SPAN, XWAY, SLAB, TANKER, GASWORKS, MANHOLES, CENTER, CURB, DIVE_Z, CROSS_ST } from './layout.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

// =====================================================================================
//  TOKYO SCRAMBLE set pieces:
//   - the TANKER in the expressway jam: shoot it (or it gets shot) -> it goes up, takes the east pier
//     of its span with it, and the span hinges down into the cross street (slow-mo), still burning;
//   - the GAS MAIN: burning fuel in the drains at the north end of Center-gai -> the works blow, and a
//     chain of blasts runs down the street after you — manhole covers launch, shopfronts erupt one
//     after another, signs rain sparks — rubber-banded a few metres behind you;
//   - the DIVE: out of the street mouth into the crossing as the last one goes off, in slow-mo.
// =====================================================================================
export class SetPieces {
  constructor(game) {
    this.g = game; this.scene = game.scene; this.fx = game.fx; this.audio = game.audio;
    const W = game.world;
    this.xw = W.xway;
    this.span = null; this.gas = null;
    this._buildTanker();
    this._buildWorks();
    this._buildCovers();
    // Center-gai storefronts (for the chain): the lots fronting the street, both sides
    this.shops = (W.city?.lots || []).filter(L => L.hot && ((L.face === 'e' && Math.abs(L.x1 + CENTER.half) < 0.6) || (L.face === 'w' && Math.abs(L.x0 - CENTER.half) < 0.6)) && L.z1 > CENTER.z0 && L.z0 < CENTER.z1)
      .map(L => ({ z: (L.z0 + L.z1) / 2, side: L.face === 'e' ? -1 : 1, len: L.z1 - L.z0, h: L.h, done: false }))
      .sort((a, b) => a.z - b.z);
  }
  warmMaterials() { return [this.worksMat, MAT.charred].filter(Boolean); }

  // ---------------------------------------------------------------- the tanker (rides the span group)
  _buildTanker() {
    const S = this.xw?.span; if (!S) return;
    const t = buildTanker();
    t.root.position.set(TANKER.x - SPAN.x0, 0, TANKER.z);
    t.root.rotation.y = TANKER.yaw * Math.PI / 180;
    t.root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    S.add(t.root);
    // two cars stuck behind it on the same span (from the city's car kit)
    const carMod = this.g.world.mods.carMod;
    this.spanCars = [];
    if (carMod?.buildCar) for (const [x, z, yaw, type] of [[12.5, -146, 90, 'sedan'], [-6, -154.5, 272, 'taxi'], [-9.5, -145.4, 96, 'van']]) {
      const m = carMod.buildCar(type, { seed: 77 + x, city: 'tokyo' });
      m.root.position.set(x - SPAN.x0, 0, z); m.root.rotation.y = yaw * Math.PI / 180;
      S.add(m.root); this.spanCars.push(m);
    }
    const hx = Math.abs(Math.cos(t.root.rotation.y)) * t.half.x + Math.abs(Math.sin(t.root.rotation.y)) * t.half.z;
    const hz = Math.abs(Math.sin(t.root.rotation.y)) * t.half.x + Math.abs(Math.cos(t.root.rotation.y)) * t.half.z;
    this.tanker = { m: t, hp: 16, state: 'ok', leak: 0, box: { min: new THREE.Vector3(TANKER.x - hx, XWAY.y, TANKER.z - hz), max: new THREE.Vector3(TANKER.x + hx, XWAY.y + t.half.y * 2.1, TANKER.z + hz) }, center: new THREE.Vector3(TANKER.x, XWAY.y + 1.6, TANKER.z) };
    const T = this.tanker, g = this.g;
    g.targets.push({
      active: () => T.state === 'ok' || T.state === 'leak',
      ray: (o, d) => rayBox(o, d, T.box.min, T.box.max),
      hit: (P, dir) => { g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.7 }); g.hitMarker(false); this.damageTanker(1, P); },
      near: (p) => p.x > T.box.min.x - 0.5 && p.x < T.box.max.x + 0.5 && p.z > T.box.min.z - 0.5 && p.z < T.box.max.z + 0.5 && p.y < T.box.max.y + 0.5,
      direct: () => this.damageTanker(99),
      blast: (P, r) => { if (P.distanceTo(T.center) < r + 4) this.damageTanker(8); },
      aim: () => T.center,
      auto: (head, A) => (T.state === 'ok' || T.state === 'leak') && this.autoTanker && head.distanceTo(T.center) < 70 ? { kind: 'target', p: T.center.clone(), score: 120, ref: T._tg, tol: 0.05, heavy: true, minNade: 8 } : null,
    });
    T._tg = g.targets[g.targets.length - 1];
  }
  damageTanker(n, P) {
    const T = this.tanker; if (!T || T.state === 'boom' || !this.tankerArmed) return;
    T.hp -= n;
    if (T.state === 'ok' && T.hp < 10) { T.state = 'leak'; this.audio.play('barrel_hiss', { x: T.center.x, y: T.center.y, z: T.center.z, volume: 0.9 }); this.g.events.push({ type: 'tankerLeak' }); }
    if (T.hp <= 0) this.blowTanker();
  }
  // ---------------------------------------------------------------- BOOM + the span drop
  blowTanker() {
    const T = this.tanker, g = this.g; if (!T || T.state === 'boom') return;
    T.state = 'boom';
    const P = T.center.clone();
    g.boom(P, 2.6, { radius: 14, dmg: 40, shake: 1.6 });
    g.fx.later(0.12, () => g.boom(P.clone().add(_v.set(-4, 1, 1)), 2.2, { radius: 10, dmg: 10, player: false }));
    g.fx.later(0.3, () => g.boom(P.clone().add(_v.set(4, 2.5, -1)), 2.0, { radius: 8, dmg: 10, player: false, noRing: true }));
    this.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
    this.audio.play('braaam', { volume: 0.7 });
    g.slowmo(2.6, 0.3, true);
    g.callout('TANKER!', P.clone().setY(P.y + 8), 'big', '+2000');
    g.addScore(2000, null);
    g.dusk = Math.max(g.dusk, 0.35);
    for (const m of [T.m, ...this.spanCars]) { if (m.setBurnt) m.setBurnt(); else if (Array.isArray(m.mesh?.material)) m.mesh.material = m.mesh.material.map(() => MAT.charred); else if (m.mesh) m.mesh.material = MAT.charred; }
    // the big column of black smoke (fire-lit from below)
    for (let i = 0; i < 6; i++) g.fx.later(1.1 + i * 0.3, () => { const s0 = range(4, 6); g.clouds.spawn({ x: P.x + range(-4, 4), y: P.y + range(3, 7), z: P.z - 5 + range(-2, 2), vx: range(-1, 1), vy: range(5, 8), vz: range(-2, -0.5), drag: 0.4, buoy: 0.4, s0, s1: s0 * range(4, 6), life: range(8, 11), a: 0.85, fadeIn: 0.05, fadeOut: 0.55, r: 0.07, g: 0.055, b: 0.045, r1: 0.14, g1: 0.12, b1: 0.1, glow: 1.6, glowFade: 3 }); });
    // the east pier goes: concrete chunks, dust, it shears and drops
    g.fx.later(0.35, () => this._pierFails());
    g.fx.later(0.6, () => { if (this.xw?.breakFixed) this.xw.breakFixed.visible = this.xw.breakSpan.visible = true; this.span = { phase: 'fall', th: 0, w: 0.05, t: 0, max: Math.asin(SLAB.drop / SLAB.len) }; this.audio.play('metal_groan', { x: SPAN.x1, y: 8, z: -150, volume: 1 }); this.audio.play('collapse_rumble', { x: SPAN.x1, y: 8, z: -150, volume: 1 }); });
    g.events.push({ type: 'tankerBoom', P });
  }
  _pierFails() {
    const g = this.g, x = SPAN.x1, pm = this.xw.spanPier;
    this.pierDrop = { t: 0 };
    for (const b of g.col.boxes) if (b.data.ref === 'spanPier') g.col.remove(b);
    for (let i = 0; i < 14; i++) g.fx.spawnDebris(_v.set(x + range(-1.5, 1.5), range(3, 9), -150 + range(-2, 2)), range(-8, 8), range(2, 9), range(-8, 8), range(0.3, 0.7), chance(0.3));
    for (let i = 0; i < 5; i++) { const s0 = range(3, 5); g.clouds.spawn({ x: x + range(-3, 3), y: range(2, 9), z: -150 + range(-4, 4), vx: range(-3, 3), vy: range(1, 3), vz: range(-3, 3), drag: 0.9, buoy: 0.1, s0, s1: s0 * 3.5, life: range(5, 7), a: 0.7, fadeIn: 0.05, fadeOut: 0.5, r: 0.36, g: 0.33, b: 0.3, r1: 0.3, g1: 0.28, b1: 0.26 }); }
    g.boom(_v.set(x, 6, -150).clone(), 1.4, { radius: 6, dmg: 0, player: false, noRing: true });
    pm.userData.v = 0;
  }
  _updateSpan(dt) {
    const S = this.span, g = this.g, grp = this.xw?.span; if (!S || !grp) return;
    S.t += dt;
    if (this.pierDrop) { const pm = this.xw.spanPier; pm.userData.v = (pm.userData.v || 0) + 9.8 * dt; pm.position.y = Math.max(-XWAY.y, pm.position.y - pm.userData.v * dt); pm.rotation.z = Math.min(0.5, pm.rotation.z + dt * 0.4); pm.position.x = -Math.sin(pm.rotation.z) * 4; }
    if (S.phase === 'fall') {
      // a rod hinged at its west end: α = (3g / 2L) cos θ, a little help from the blast
      S.w += (1.5 * 9.8 / SLAB.len) * Math.cos(S.th) * dt + 0.05 * dt;
      S.th += S.w * dt;
      // the deck tears at the hinge: sparks + grinding
      if (rand() < dt * 30) g.fx.sparks.spawn({ x: SPAN.x0 + range(-0.5, 0.5), y: XWAY.y - range(0, 1.5), z: range(XWAY.z0 + 1, XWAY.z1 - 1), vx: range(-1, 3), vy: range(-1, 3), vz: range(-2, 2), grav: 9.8, drag: 0.3, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.1, life: range(0.6, 1.4), r: 2.8, g: 1.9, b: 0.9, a: 1, fadeOut: 0.4 });
      if (S.th >= S.max) { S.th = S.max; S.phase = 'down'; S.t = 0; this._spanImpact(); }
    } else if (S.phase === 'down') {
      // a small bounce, then still
      S.th = S.max - Math.abs(Math.sin(S.t * 9)) * Math.exp(-S.t * 6) * 0.02;
    }
    grp.rotation.z = -S.th;
    // glows on the span ride with it
    for (const gl of this.xw.spanGlows || []) { gl._p0 ||= new THREE.Vector3(...gl.p); _v.set(gl._p0.x - SPAN.x0, gl._p0.y - XWAY.y, gl._p0.z).applyAxisAngle(_v2.set(0, 0, 1), -S.th); gl.p = [SPAN.x0 + _v.x, XWAY.y + _v.y, _v.z]; gl._p = null; }
    // the tanker keeps burning on it
    if (this.tanker?.state === 'boom') {
      const tp = this.tanker.m.root.getWorldPosition(_v);
      if (rand() < dt * 30) g.fx.flame(_v2.copy(tp).add(_v.set(range(-5, 5), range(0.5, 2.5), range(-1.5, 1.5))), range(1.2, 2.2));
      if (rand() < dt * 1.2) { tp.copy(this.tanker.m.root.getWorldPosition(_v)); const s0 = range(4, 6); g.clouds.spawn({ x: tp.x + range(-3, 3), y: tp.y + 3, z: tp.z + range(-2, 2), vx: range(-0.5, 0.5) + 0.6, vy: range(4, 6), vz: range(-0.5, 0.5), drag: 0.1, buoy: 0.3, s0, s1: s0 * 7, life: range(10, 14), a: 0.85, fadeIn: 0.1, fadeOut: 0.5, r: 0.07, g: 0.06, b: 0.05, r1: 0.14, g1: 0.12, b1: 0.1, glow: 1.2, glowFade: 5 }); }
      g.audio.setLoop('fire_big', { x: tp.x, y: tp.y, z: tp.z, volume: 0.9 });
    }
    if (S.phase === 'down') {
      // burning fuel pooled at the foot of the slab, running toward Center-gai
      if (rand() < dt * 22) g.fx.flame(_v.set(range(SPAN.x0 + 22, SPAN.x1 + 2), range(0.3, 1.2), range(CROSS_ST.z0 + 2, CROSS_ST.z1 - 1)), range(0.9, 1.7));
    }
  }
  _spanImpact() {
    const g = this.g;
    STATE.spanDown = true;
    if (this.xw.spanBox?.box) g.col.remove(this.xw.spanBox.box);
    const P = new THREE.Vector3(SPAN.x0 + SLAB.len * Math.cos(this.span.max) - 1, 1.2, -150);
    this.audio.play('collapse_impact', { x: P.x, y: P.y, z: P.z, volume: 1 });
    this.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 0.8, pitch: 0.7 });
    g.lastExplosionT = g.time; g.lastExplosionShake = 1.3;
    g.haptic(1, 300);
    // dust + sparks + a fireball where the fuel lands, the street's glass goes
    for (let i = 0; i < 10; i++) { const s0 = range(4, 7); g.clouds.spawn({ x: P.x + range(-12, 4), y: range(1, 4), z: -150 + range(-9, 9), vx: range(-5, 5), vy: range(1, 4), vz: range(-6, 6), drag: 0.8, buoy: 0.15, s0, s1: s0 * 3, life: range(6, 9), a: 0.75, fadeIn: 0.04, fadeOut: 0.55, r: 0.3, g: 0.27, b: 0.24, r1: 0.2, g1: 0.18, b1: 0.16, glow: 0.6, glowFade: 2 }); }
    g.boom(P.clone(), 2.2, { radius: 12, dmg: 0, player: false });
    for (let i = 0; i < 40; i++) g.fx.sparks.spawn({ x: P.x + range(-14, 2), y: range(0.5, 4), z: -150 + range(-9, 9), vx: range(-6, 6), vy: range(2, 9), vz: range(-6, 6), grav: 9.8, drag: 0.2, frame: CELL.SPARK, s0: 1, w: 0.05, len: 0.12, life: range(0.8, 2), r: 2.8, g: 1.8, b: 0.8, a: 1, fadeOut: 0.4 });
    for (let i = 0; i < 10; i++) g.fx.spawnDebris(P.clone().add(_v.set(range(-10, 2), 1, range(-8, 8))), range(-7, 7), range(4, 10), range(-7, 7), range(0.3, 0.8), chance(0.5));
    g.glass.blast(P, 40, 1.5);
    g.dusk = Math.max(g.dusk, 0.5);
    g.events.push({ type: 'spanDown', P });
  }

  // jump straight to the aftermath (?beat= past the tanker)
  spanDownNow() {
    const max = Math.asin(SLAB.drop / SLAB.len);
    this.span = { phase: 'down', th: max, w: 0, t: 5, max };
    STATE.spanDown = true;
    if (this.xw?.spanBox?.box) this.g.col.remove(this.xw.spanBox.box);
    if (this.xw?.spanPier) { this.xw.spanPier.position.y = -XWAY.y; this.pierDrop = null; }
    this.g.dusk = Math.max(this.g.dusk, 0.5);
    for (const c of this.g.hud.callouts) this.g.hud.scene.remove(c.s); this.g.hud.callouts.length = 0;
  }
  // ---------------------------------------------------------------- the gas works at the north end of Center-gai
  _buildWorks() {
    const A = new Acc({ rm: true }), S = new Acc();
    const { E: SE } = signAtlas();
    const x = GASWORKS.x, z = GASWORKS.z;
    // the pit: a dark hole with a yellow gas pipe across it, steel plates, a spoil heap
    A.set({ col: hex(0x0c0b0a), rm: [0.9, 0, 0] }); A.box(x - 2.2, CURB - 0.02, z - 1.6, x + 2.2, CURB + 0.005, z + 1.6, { faces: 'Y' });
    A.set({ col: hex(0xd8b21a), rm: [0.5, 0.3, 0] }); A.tube([x - 2.4, CURB - 0.3, z], [x + 2.4, CURB - 0.3, z], 0.22, 10);
    A.set({ col: hex(0x5a4a3a), rm: [0.95, 0, 0] }); A.box(x + 2.1, CURB, z - 1.2, x + 3.2, CURB + 0.6, z + 1.4);
    A.set({ col: hex(0x3a3a3a), rm: [0.5, 0.7, 0] }); A.box(x - 3.0, CURB, z - 1.5, x - 2.2, CURB + 0.04, z + 1.5);
    // striped barriers (orange / white) round it, with ガス工事中 plates and blinking lamps
    const bar = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(L / 1.8));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t;
        for (const [y, c] of [[0.95, 0xb8561a], [0.7, 0xc8c6be], [0.45, 0xb8561a]]) { A.set({ col: hex(c), rm: [0.65, 0, 0.04] }); A.obox(cx, CURB + y, cz, 0.03, 0.09, L / n / 2 - 0.05, ang); }
        A.set({ col: hex(0x6a6a6a), rm: [0.5, 0.5, 0] }); A.obox(cx, CURB + 0.55, cz, 0.05, 0.55, 0.05, ang);
      }
    };
    bar(x - 3.2, z - 2.6, x - 3.2, z + 2.6); bar(x + 3.4, z - 2.6, x + 3.4, z + 2.6); bar(x - 3.2, z + 2.6, x + 3.4, z + 2.6); bar(x - 3.2, z - 2.6, x + 3.4, z - 2.6);
    const plate = SE.plate.find((p, i) => i === 12) || SE.plate[0], plate2 = SE.plate[14] || SE.plate[0];
    signQuad(S, [x, CURB + 1.4, z + 2.66], [0, 0, 1], 1.6, 0.2, plate.uv, 1.3); signQuad(S, [x + 1.9, CURB + 1.4, z + 2.66], [0, 0, 1], 1.6, 0.2, plate2.uv, 1.3);
    A.set({ col: hex(0x5a5a5a), rm: [0.5, 0.5, 0] }); A.box(x - 0.85, CURB, z + 2.62, x - 0.8, CURB + 1.55, z + 2.66); A.box(x + 2.75, CURB, z + 2.62, x + 2.8, CURB + 1.55, z + 2.66);
    for (const [bx, bz] of [[x - 3.2, z + 2.6], [x + 3.4, z + 2.6], [x - 3.2, z - 2.6], [x + 3.4, z - 2.6]]) this.g.world.glowList.push({ p: [bx, CURB + 1.2, bz], color: [2.8, 1.1, 0.15], size: 0.5, blink: true, rate: 4.5 });
    // a mini excavator (boom up), a light tower throwing a white pool, a blinking arrow board
    const dx = -6.6, dz = -5.2; // the digger parked north of the pit, inside the closure
    A.set({ col: hex(0xa8801a), rm: [0.6, 0.2, 0] }); A.box(x + 6 + dx, CURB + 0.5, z - 3 + dz, x + 8.2 + dx, CURB + 1.7, z - 0.8 + dz); A.box(x + 6.2 + dx, CURB + 1.7, z - 2.8 + dz, x + 7.6 + dx, CURB + 2.7, z - 1.2 + dz);
    A.set({ col: hex(0x14181c), rm: [0.2, 0.3, 0] }); A.box(x + 6.25 + dx, CURB + 1.8, z - 1.25 + dz, x + 7.55 + dx, CURB + 2.6, z - 1.18 + dz, { faces: 'Z' });
    A.set({ col: hex(0xa8801a), rm: [0.6, 0.2, 0] });
    A.tube([x + 7.6 + dx, CURB + 1.6, z - 1.9 + dz], [x + 9.2 + dx, CURB + 3.0, z - 1.9 + dz], 0.1, 6); A.tube([x + 9.2 + dx, CURB + 3.0, z - 1.9 + dz], [x + 9.8 + dx, CURB + 1.0, z - 1.9 + dz], 0.08, 6);
    A.set({ col: hex(0x2a2a2a), rm: [0.6, 0.5, 0] }); A.box(x + 9.5 + dx, CURB + 0.5, z - 2.3 + dz, x + 10.2 + dx, CURB + 1.0, z - 1.5 + dz);
    A.set({ col: hex(0x1a1a1a), rm: [0.8, 0, 0] }); A.box(x + 5.8 + dx, CURB, z - 3.3 + dz, x + 8.4 + dx, CURB + 0.5, z - 0.5 + dz);
    A.set({ col: hex(0x8a8a8a), rm: [0.5, 0.6, 0] }); A.cyl(x - 2.8, CURB, z + 2.2, 0.08, 0.08, CURB + 6, 6, { cap: false });
    A.set({ col: [1, 1, 1], rm: [0.3, 0, 3.4] }); A.box(x - 3.4, CURB + 5.8, z + 1.9, x - 2.2, CURB + 6.3, z + 2.5);
    this.g.world.glowList.push({ p: [x - 2.8, CURB + 6, z + 2.3], color: [2.6, 2.6, 2.6], size: 2.2 });
    // the arrow board: a small trailer sign by the closure, its lamps chasing toward the open side
    A.set({ col: hex(0x3a3a3c), rm: [0.5, 0.5, 0] }); A.box(x + 3.9, CURB, z + 2.9, x + 4.0, CURB + 1.0, z + 3.0); A.box(x + 5.4, CURB, z + 2.9, x + 5.5, CURB + 1.0, z + 3.0);
    A.set({ col: hex(0x161618), rm: [0.5, 0.3, 0] }); A.box(x + 3.8, CURB + 1.0, z + 2.85, x + 5.6, CURB + 2.0, z + 3.0);
    for (let i = 0; i < 5; i++) this.g.world.glowList.push({ p: [x + 4.0 + i * 0.35, CURB + 1.5, z + 3.05], color: [2.8, 1.6, 0.2], size: 0.3, blink: true, rate: 6 + i * 0.4 });
    this.worksMat = rmMat({});
    const m = A.mesh(this.worksMat, { shadow: true }); this.scene.add(m); this.worksMesh = m;
    this.scene.add(S.mesh(signMaterial()));
    for (const b of [this.g.col.add([x - 3.3, 0, z - 2.7], [x + 3.5, 1.1, z + 2.7], { kind: 'barrier', mat: 'metal' }), this.g.col.add([x + 5.8 - 6.6, 0, z - 3.3 - 5.2], [x + 8.4 - 6.6, 3, z - 0.5 - 5.2], { kind: 'digger', mat: 'metal' })])
      this.g.world.nav?.blockBox(b.min, b.max); // the nav grid was built before the set pieces
  }
  // manhole covers: one instanced mesh, flipped into the air when the main goes under them
  _buildCovers() {
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.6, metalness: 0.6 });
    this.covers = new THREE.InstancedMesh(geo, mat, MANHOLES.length);
    this.covers.count = 0; this.covers.frustumCulled = false; this.covers.castShadow = true;
    this.scene.add(this.covers);
    this.flying = [];
  }

  // ---------------------------------------------------------------- the chain down Center-gai
  startGas() {
    if (this.gas) return;
    const g = this.g;
    this.gas = { phase: 'run', F: GASWORKS.z, v: 7, t: 0, next: 0, manI: 0, done: false };
    const P = new THREE.Vector3(GASWORKS.x, 1.2, GASWORKS.z);
    g.boom(P, 2.4, { radius: 9, dmg: 30, shake: 1.5 });
    g.fx.later(0.15, () => g.boom(P.clone().add(_v.set(2, 3, -2)), 1.8, { radius: 6, dmg: 0, player: false, noRing: true }));
    this.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
    this.audio.play('braaam', { volume: 0.6 });
    g.slowmo(1.3, 0.35, true);
    this.worksMesh.visible = false;
    // the gas pipe jet: a roaring column of fire out of the pit for the rest of the level
    this.jet = P.clone().setY(CURB);
    g.dusk = Math.max(g.dusk, 0.6);
    g.events.push({ type: 'gasBoom', P });
  }
  _updateGas(dt) {
    const G = this.gas, g = this.g; if (!G || G.phase === 'done') return;
    G.t += dt;
    const pz = g.headPos.z;
    // rubber band: the front stays 8–15 m behind you; it never catches a player who keeps running
    const gap = pz - G.F;
    const want = gap > 15 ? 13 : gap > 9 ? 7.5 : gap > 5 ? 4.5 : 3.0;
    G.v = damp(G.v, want, 2, dt);
    if (G.phase === 'run') G.F = Math.min(G.F + G.v * dt, DIVE_Z - 6);
    // manholes: cover off, a jet of fire
    while (G.manI < MANHOLES.length && MANHOLES[G.manI].z < G.F + 1) this._blowManhole(MANHOLES[G.manI++]);
    // shopfronts erupt as the front passes them (alternating sides)
    for (const S of this.shops) if (!S.done && S.z < G.F) { S.done = true; this._blowShop(S); }
    // the carpet of fire behind the front
    if (rand() < dt * 30) g.fx.flame(_v.set(range(-CENTER.half + 1, CENTER.half - 1), range(0.2, 1.0), G.F - range(0, 16)), range(1.0, 2.0));
    if (rand() < dt * 2.2) { const s0 = range(4, 6); g.clouds.spawn({ x: range(-5, 5), y: range(3, 6), z: G.F - range(2, 10), vx: range(-1, 1), vy: range(3, 5), vz: range(-1, 1) - 1, drag: 0.4, buoy: 0.3, s0, s1: s0 * 4, life: range(7, 10), a: 0.85, fadeIn: 0.08, fadeOut: 0.5, r: 0.07, g: 0.055, b: 0.045, r1: 0.14, g1: 0.12, b1: 0.1, glow: 1.6, glowFade: 3 }); }
    g.audio.setLoop('fire_big', { x: 0, y: 2, z: G.F, volume: 1 });
    // too close: it hurts (the rubber band makes this a warning, not a wall)
    if (gap < 3.5 && G.phase === 'run') g.hurt(26 * dt, _v.set(0, 1.5, G.F));
    // the light of it on everything
    if (this.fx.lights.some(l => l.userData.life <= 0) && rand() < dt * 6) this.fx.light(_v.set(range(-4, 4), 3, G.F + 2), 60, 0.25, 0xff7a2a, true, 22);
  }
  _blowManhole(M) {
    const g = this.g, P = new THREE.Vector3(M.x, CURB + 0.1, M.z);
    g.fx.explosion(P, 0.9, { noRing: true });
    this.audio.play('explosion_small', { x: P.x, y: P.y, z: P.z, volume: 0.9 });
    this.audio.play('metal_crash', { x: P.x, y: P.y, z: P.z, volume: 0.8, pitch: 1.3 });
    g.lastExplosionT = g.time; g.lastExplosionShake = Math.max(0.3, 0.9 - P.distanceTo(g.headPos) / 40);
    this.flying.push({ p: P.clone(), v: new THREE.Vector3(range(-1.5, 1.5), range(14, 19), range(-1, 2)), q: new THREE.Quaternion(), w: new THREE.Vector3(range(-9, 9), range(-3, 3), range(-9, 9)), t: 0, i: this.flying.length });
    M.jetT = 3.2; M.P = P;
    this.covers.count = this.flying.length;
    for (const s of g.soldiers) if (s.alive && s.pos.distanceTo(P) < 3) g.killSoldier(s, _v.set(0, 1, 0), 3, false, 'MANHOLE!');
  }
  _blowShop(S) {
    const g = this.g;
    const x = S.side * (CENTER.half + 0.6), P = new THREE.Vector3(x, 1.8, S.z);
    g.fx.explosion(P.clone().setX(x - S.side * 0.8), 1.2, { noRing: true });
    for (let i = 0; i < 6; i++) g.fx.flame(_v.set(x - S.side * range(1, 3.5), range(0.5, 3), S.z + range(-S.len / 2, S.len / 2)), range(1.2, 2.2), _v2.set(-S.side * range(3, 7), range(0, 2), range(-1, 1)));
    g.glass.blast(P, S.len * 0.75 + 2, 1.2);
    this.audio.play(chance(0.5) ? 'explosion_small' : 'fuel_whoomp', { x: P.x, y: P.y, z: P.z, volume: 0.9 });
    this.audio.play('glass_break', { x: P.x, y: P.y, z: P.z, volume: 0.8 });
    // the signs above short out in a shower of sparks
    for (let i = 0; i < 26; i++) g.fx.later(range(0, 0.6), () => g.fx.sparks.spawn({ x: x + S.side * range(0.3, 1.3), y: range(5, Math.min(S.h, 14)), z: S.z + range(-S.len / 2, S.len / 2), vx: -S.side * range(0.5, 3), vy: range(-1, 2.5), vz: range(-1, 1), grav: 9.8, drag: 0.2, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.09, life: range(0.8, 1.8), r: 2.8, g: 2.1, b: 1.2, a: 1, fadeOut: 0.3 }));
    g.recentExplosions.push(g.time);
    g.lastExplosionT = g.time; g.lastExplosionShake = Math.max(g.lastExplosionShake * 0.5, 0.5 - P.distanceTo(g.headPos) / 60);
    for (const s of g.soldiers) if (s.alive && s.pos.distanceTo(P) < 5) g.killSoldier(s, _v.set(-S.side, 0.8, 0).normalize(), 2.5, false, 'TOASTED');
  }
  // the dive: the last one comes out of the mouth of the street behind you
  finale() {
    if (this.dove) return; this.dove = true;
    const g = this.g;
    if (this.gas) this.gas.phase = 'done';
    g.slowmo(3.2, 0.22, true);
    const P = new THREE.Vector3(0, 2, -32);
    g.boom(P, 2.3, { radius: 10, dmg: 0, player: false, shake: 1.8 });
    g.fx.later(0.1, () => g.boom(P.clone().add(_v.set(-4, 1.5, 3)), 1.6, { radius: 6, dmg: 0, player: false, noRing: true }));
    g.fx.later(0.2, () => g.boom(P.clone().add(_v.set(4, 3, 4)), 1.6, { radius: 6, dmg: 0, player: false, noRing: true }));
    this.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
    // the arch sign comes down in sparks
    for (let i = 0; i < 60; i++) g.fx.later(range(0, 1.2), () => g.fx.sparks.spawn({ x: range(-7, 7), y: range(6.4, 7.8), z: -30 + range(-0.4, 0.4), vx: range(-2, 2), vy: range(-1, 3), vz: range(0, 4), grav: 9.8, drag: 0.2, frame: CELL.SPARK, s0: 1, w: 0.05, len: 0.12, life: range(1, 2.4), r: 2.9, g: 2.2, b: 1.2, a: 1, fadeOut: 0.3 }));
    // a rolling fireball out into the crossing (forced: this one gets the budget)
    for (let i = 0; i < 7; i++) g.fx.later(0.08 + i * 0.09, () => g.fx.explosion(_v.set(range(-5, 5), range(2, 5), -26 + i * 1.6).clone(), 1.25 - i * 0.07, { noRing: true }));
    g.events.push({ type: 'dive' });
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const g = this.g;
    this._updateSpan(dt);
    this._updateGas(dt);
    // tanker leaking: a fuel spray + it catches
    const T = this.tanker;
    if (T && T.state === 'leak') {
      T.leak += dt;
      if (rand() < dt * 20) g.fx.main.spawn({ x: T.center.x + range(-2, 2), y: T.center.y - 0.6, z: T.center.z + 1.3, vx: range(-0.3, 0.3), vy: range(0.5, 2), vz: range(1, 3), grav: 9.8, drag: 0.6, frame: CELL.WISP, s0: 0.15, s1: 0.5, life: 0.7, rot: rand() * 6, r: 0.7, g: 0.65, b: 0.5, a: 0.4, fadeOut: 0.4 });
      if (T.leak > 1.2 && rand() < dt * 18) g.fx.flame(_v.set(T.center.x + range(-3, 3), XWAY.y + range(0.2, 1.4), T.center.z + range(-1.5, 1.5)), range(0.8, 1.4));
      if (T.leak > 4.5) this.damageTanker(99);
    }
    // manhole covers in the air; fire jets out of the open holes
    for (const f of this.flying) {
      f.t += dt;
      if (f.p.y > CURB + 0.03 || f.v.y > 0) { f.v.y -= 9.8 * dt; f.p.addScaledVector(f.v, dt); f.q.multiply(_q.setFromEuler(new THREE.Euler(f.w.x * dt, f.w.y * dt, f.w.z * dt))); if (f.p.y < CURB + 0.03) { f.p.y = CURB + 0.03; f.v.multiplyScalar(0); this.audio.play('metal_crash', { x: f.p.x, y: f.p.y, z: f.p.z, volume: 0.7, pitch: 1.6 }); f.q.setFromAxisAngle(UP, rand() * 6); } }
      _m.compose(f.p, f.q, _v.set(1, 1, 1)); this.covers.setMatrixAt(f.i, _m);
    }
    if (this.flying.length) this.covers.instanceMatrix.needsUpdate = true;
    for (const M of MANHOLES) if (M.jetT > 0) {
      M.jetT -= dt;
      if (rand() < dt * 26) g.fx.flame(_v.set(M.x + range(-0.2, 0.2), CURB + range(0.2, 1.5), M.z + range(-0.2, 0.2)), range(0.9, 1.5), _v2.set(range(-0.5, 0.5), range(5, 9), range(-0.5, 0.5)));
    }
    if (this.jet && rand() < dt * 24) g.fx.flame(_v.set(this.jet.x + range(-0.4, 0.4), CURB + range(0.4, 2), this.jet.z + range(-0.4, 0.4)), range(1.2, 2), _v2.set(range(-1, 1), range(6, 11), range(-1, 1)));
  }
  afterPlayer() {}
}

function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = 1e9;
  for (const k of ['x', 'y', 'z']) {
    const inv = 1 / (d[k] || 1e-9);
    let ta = (mn[k] - o[k]) * inv, tb = (mx[k] - o[k]) * inv;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return t0 > 0 ? t0 : -1;
}
