import * as THREE from 'three';
import { rand, range, chance, clamp, lerp, damp } from '../../rng.js';
import { CELL, BillboardBatch } from '../../particles.js';
import { buildHeli } from '../../heli.js';
import { MAT } from '../../vehicles.js';
import { ROOFTOP, TOWER, groundAt } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the roof fight and the chase. On the roof it can't be finished: under 42 % it puts a rocket salvo into
//  the tower and drops away; once you've jumped it comes back up out of the gorge and chases the glide (it holds station
//  off your shoulder, on the hill's side), and that is where you bring it down. The roof fight: A gunship (the engine's WIDOWMAKER, as in Level 5) comes up over the
//  edge of Jinlong's roof, 240 m over the city, searchlight in your face; it circles the crown, ducks
//  under the roof line and comes back up somewhere else, hovers over the roof to rope men down onto it,
//  rockets and a chin gun at you. Shoot it down and it spirals into the hillside district below — into
//  the gold LED tower on the crest — and the hill lets go (setpieces.landslide).
//  The crash waits for the look (VR); the hover / orbit keep clear of the crown's cage and mast.
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const TC = new THREE.Vector3((TOWER.x0 + TOWER.x1) / 2, 0, (TOWER.z0 + TOWER.z1) / 2);
const MAST = new THREE.Vector3(TC.x, 0, TC.z);
export const CRASH = new THREE.Vector3(447, 150, 57.5);    // the south face of the gold LED tower on the crest (the slide's c1 block)
const HOVER = new THREE.Vector3(329, 263, 132);             // over the roof's west end, clear of the mast (the rotor is 11 m)
const R = ROOFTOP;
const onRoof = (x, z) => x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1;
const roofGround = (x, z) => onRoof(x, z) ? (x > 331 && x < 349 && z < 130 ? R.y + 4.2 : R.y) : groundAt(x, z);
// does the xz segment a→b cross Jinlong's footprint (+ the rotor's reach)?
function segHitsTower(a, b) {
  const m = 14, x0 = TOWER.x0 - m, x1 = TOWER.x1 + m, z0 = TOWER.z0 - m, z1 = TOWER.z1 + m;
  let t0 = 0, t1 = 1;
  for (const [p, q, lo, hi] of [[a.x, b.x, x0, x1], [a.z, b.z, z0, z1]]) {
    const d = q - p;
    if (Math.abs(d) < 1e-6) { if (p < lo || p > hi) return false; continue; }
    let ta = (lo - p) / d, tb = (hi - p) / d; if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false;
  }
  return true;
}
function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r, h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}

export class Gunship {
  constructor(g, sp) {
    this.g = g; this.sp = sp; this.H = null; this.rockets = [];
    const m = buildHeli();
    m.root.scale.setScalar(1.6);
    // a warm lift on the paint (the roof floods / the burning city under it): never a black toy against the fog
    m.root.traverse(o => { if (o.isMesh && o.material && !o.material.isShaderMaterial) { o.material = [].concat(o.material).map(mm => { if (!mm.isMeshStandardMaterial) return mm; const c = mm.clone(); c.emissive = new THREE.Color(0x4a3420); c.emissiveIntensity = 1; return c; }); if (o.material.length === 1) o.material = o.material[0]; } });
    m.root.visible = false; g.scene.add(m.root);
    this.m = m;
    // a visible searchlight cone
    { const L = 80, cg = new THREE.ConeGeometry(8, L, 18, 1, true); cg.translate(0, -L / 2, 0);
      const cm = new THREE.ShaderMaterial({ vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y / ${L.toFixed(1)}; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float a = pow(abs(dot(vN, vV)), 1.5) * pow(1.0 - vY, 1.8) * 0.28; gl_FragColor = vec4(vec3(0.9, 0.92, 1.0) * a, a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      this.spot = new THREE.Mesh(cg, cm); this.spot.frustumCulled = false; this.spot.renderOrder = 18; this.spot.visible = false; g.scene.add(this.spot); }
    // the fast-ropes: two dark lines off the cabin doors
    const rm = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.9 });
    const rg = new THREE.CylinderGeometry(0.045, 0.045, 1, 5, 1, true); rg.translate(0, -0.5, 0);
    this.ropes = [0, 1].map(() => { const o = new THREE.Mesh(rg, rm); o.visible = false; o.frustumCulled = false; g.scene.add(o); return o; });
    const mk = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); m.tilt.add(o); return o; };
    this.doors = [mk(0, -0.5, 1.95), mk(0, -0.5, -1.95)].map((o, i) => { o.position.set(i ? -1.95 : 1.95, -0.5, -0.4); return o; });
    this.hit = [[mk(0, 0.2, -0.8), 1.9], [mk(0, 0.4, -3.4), 1.3], [mk(0, 0.4, 3.0), 1.1], [mk(0, 0.5, 6.5), 0.8]];
    this.glowB = new BillboardBatch(24, g.E.atlas, { boost: 1, renderOrder: 19, fog: g.scene.fog, ground: -20 });
    g.scene.add(this.glowB.mesh);
    this.target = {
      active: () => !!this.H && this.H.alive && this.H.phase !== 'dying' && this.H.phase !== 'retreat' && this.H.phase !== 'lurk',
      ray: (o, d) => { let best = -1; for (const [pt, r] of this.hit) { pt.getWorldPosition(_v); const t = raySphere(o, d, _v, r); if (t > 0 && (best < 0 || t < best)) best = t; } return best; },
      hit: (P, dir) => { g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.8, pitch: 0.75 }); this.damage(0.35, P); g.hitMarker(false); },
      near: (p) => this.H.pos.distanceTo(p) < 4.2,
      direct: (p) => { this.damage(20, p); g.hitMarker(true); },
      blast: (P, r, dmg) => { const d = this.H.pos.distanceTo(P); if (d < r + 4) this.damage(dmg * 0.12 * (1 - d / (r + 4)) + 2, P); },
      aim: () => this.H.pos,
      auto: (head, A) => {
        const H = this.H; if (H.phase === 'rise' && H.t < 2.5) return null;
        const d = H.pos.distanceTo(head); if (d > 130) return null;
        if (!g.col.visible(head, H.pos, b => b.data.noBullet)) return null;
        // the ropers first (they're on the roof with you), then the bird
        const ropers = g.enemiesAlive(s => s.roper && s.delay <= 0);
        return { kind: 'target', p: H.pos.clone(), score: 72 + (A.target?.ref === this.target ? 25 : 0) + (H.hp < H.maxHp * 0.35 ? 30 : 0) - ropers * 18, ref: this.target, heavy: true, minNade: 12, tol: 0.07 };
      },
    };
    g.targets.push(this.target);
  }
  warmMaterials() {
    const out = [];
    this.m.root.traverse(o => { if (o.isMesh) for (const mm of [].concat(o.material)) if (!out.includes(mm)) out.push(mm); });
    out.push(this.spot.material, this.ropes[0].material, this.glowB.mesh.material);
    return out;
  }
  // ?beat= past the roof: it's already in the hill
  skip() { this.H = { alive: false, phase: 'gone' }; this.m.root.visible = false; }
  // ?beat=jump / glide: it has already rocketed the tower and is lurking in the gorge
  lurk() { this.spawn(); this.g.events = this.g.events.filter(e => e.type !== 'heliUp'); const H = this.H; H.hp = H.maxHp * 0.42; H.phase = 'lurk'; H.t = 0; H.pos.set(430, 150, 230); H.vel.set(0, 0, 0); this.m.setDamage?.(0.58); }
  get alive() { return !!this.H && this.H.alive; }
  get dead() { return !!this.H && !this.H.alive; }

  // ---------------------------------------------------------------- up over the edge, out of the river's fog
  spawn() {
    if (this.H) return this.H;
    const g = this.g, m = this.m;
    m.root.visible = true;
    const hp = g.auto ? 240 : 185;   // the autopilot (demo / trailer) is a crack shot: a longer fight for the camera
    this.H = { pos: m.root.position.set(348, 188, 208), vel: new THREE.Vector3(0, 16, -4), yaw: 0, hp, maxHp: hp, phase: 'rise', t: 0, rocketT: 4.5, gunT: 1.2, burst: 0, wp: new THREE.Vector3(), wpT: 0, spin: 0, alive: true, bank: 0, pitch: 0, hitT: 0, orbit: Math.PI / 2, diveT: 15, drops: [4, 2], dropT: 5, fightT: 0 };
    g.audio.musicStinger('boss');
    g.events.push({ type: 'heliUp' });
    return this.H;
  }
  damage(d, P) {
    const H = this.H; if (!H || !H.alive || H.phase === 'dying' || H.phase === 'retreat' || H.phase === 'lurk') return;
    H.hp -= d; H.hitT = 1;
    // on the roof it won't go down: badly hurt, it rockets the tower and backs off (the kill is in the glide)
    if (H.phase !== 'chase' && H.hp < H.maxHp * 0.42) { H.hp = H.maxHp * 0.42; this.retreat(); return; }
    if (this.m.setDamage?.(clamp(1 - H.hp / H.maxHp, 0, 1))) {
      const p = this.m.sparkPt.getWorldPosition(new THREE.Vector3());
      this.g.fx.smallExplosion(p, 0.7);
      for (let i = 0; i < 4; i++) this.g.fx.spawnDebris(p, H.vel.x + range(-5, 5), range(2, 6), H.vel.z + range(-5, 5), range(0.15, 0.35), true);
      this.g.audio.play('metal_crash', { x: p.x, y: p.y, z: p.z, volume: 0.7, pitch: 1.3 });
      this.g.callout('ENGINE HIT!', p.clone().setY(p.y + 3), 'small');
      this.g.events.push({ type: 'heliHurt' });
    }
    if (H.hp <= 0) this.kill();
  }
  retreat() {
    const H = this.H, g = this.g;
    if (!H || H.phase === 'retreat' || H.phase === 'lurk' || H.phase === 'chase') return;
    if (H.men) for (const s of H.men) if (s && s.rope && !s.rope.done && s.alive) { s.rope.done = true; s.pos.copy(s.rope.land); s.root.position.copy(s.pos); s.floorY = s.rope.land.y; s.delay = 0.4; }
    for (const r of this.ropes) r.visible = false;
    H.phase = 'retreat'; H.t = 0; H.salvo = 0; H.ropesOut = false;
    g.bossInfo = null;
    g.events.push({ type: 'heliRetreat' });
  }
  // back up out of the gorge behind you: it chases the glide
  startChase() {
    const H = this.H, g = this.g, R = this.sp.rail;
    if (!H || !H.alive || H.phase === 'chase') return;
    H.phase = 'chase'; H.t = 0; H.rocketT = 5; H.gunT = 2.5; H.burst = 0;
    R.at(Math.max(0, R.s - 70), _v); H.pos.set(_v.x + 40, _v.y - 45, _v.z - 10); H.vel.set(0, 18, 0);
    this.m.root.visible = true;
    g.audio.play('heli_flyby', { x: H.pos.x, y: H.pos.y, z: H.pos.z });
    g.events.push({ type: 'heliChase' });
  }
  kill() {
    const g = this.g, H = this.H;
    if (H.phase === 'dying') return;
    H.phase = 'dying'; H.t = 0; H.spin = 0.6; H.c0 = H.pos.clone();
    g.fx.explosion(H.pos.clone(), 1.4, { noRing: true });
    g.slowmo(2.4, 0.28, true);
    const hp0 = H.pos.clone(); g.fx.later(1.4, () => !g.quietScore && g.addScore(5000, 'BIRD DOWN!', hp0.clone().lerp(g.headPos, 0.7).setY(g.headPos.y - 0.6), 'huge'));
    g.audio.play('metal_crash', { x: H.pos.x, y: H.pos.y, z: H.pos.z });
    g.bossInfo = null;
    this._cutRopes(true);
    g.events.push({ type: 'heliDying' });
    H.lookT = 0; H.commit = false;
  }
  // ---------------------------------------------------------------- the ropers: fast-roped down onto the roof, then they fight from where they land
  _startDrop(n) {
    const H = this.H, g = this.g;
    H.phase = 'drop'; H.t = 0; H.dropN = n; H.ropeK = 0; H.men = [];
    g.events.push({ type: 'heliDrop' });
  }
  _updDrop(dt) {
    const H = this.H, g = this.g;
    const near = H.pos.distanceTo(HOVER) < 3 && H.vel.length() < 4;
    if (!H.ropesOut && (near || H.t > 12)) { H.ropesOut = true; H.ropeT = 0; g.audio.play('gear_rattle', { x: H.pos.x, y: H.pos.y, z: H.pos.z, volume: 0.9, pitch: 0.7 }); }
    if (!H.ropesOut) return;
    H.ropeT += dt;
    H.ropeK = clamp(H.ropeT / 0.7, 0, 1);
    // men out of the doors, one per rope at a time
    const slot = (i) => 0.9 + Math.floor(i / 2) * 1.5 + (i % 2) * 0.35;
    for (let i = 0; i < H.dropN; i++) {
      if (!H.men[i] && H.ropeT > slot(i)) {
        const d = this.doors[i % 2].getWorldPosition(new THREE.Vector3());
        const lx = clamp(d.x, R.x0 + 1.2, R.x1 - 1.2), lz = clamp(d.z, R.z0 + 1.2, R.z1 - 1.2), ly = roofGround(lx, lz);
        const s = g.spawnSoldier({ x: lx, z: lz, y: ly, role: 'perch', delay: 99, noNade: i % 2 === 1, range: 70 });
        s.roper = true; s.hp = 2;
        s.rope = { i: i % 2, t: 0, land: new THREE.Vector3(lx, ly, lz) };
        // they hold a little patch of roof around where they land (perch AI walks the box toward you)
        s.perchBox = { min: { x: Math.max(R.x0 + 0.6, lx - 2.5), z: Math.max(R.z0 + 0.6, lz - 2.5) }, max: { x: Math.min(R.x1 - 0.6, lx + 2.5), z: Math.min(R.z1 - 0.6, lz + 2.5) } };
        if (ly > R.y + 1) s.perchBox = { min: { x: 331.6, z: R.z0 + 0.6 }, max: { x: 348.4, z: 129.4 } };
        H.men[i] = s;
      }
    }
    for (const s of H.men) {
      if (!s || !s.rope || s.rope.done) continue;
      const Rp = s.rope;
      if (!s.alive) { Rp.done = true; continue; }
      Rp.t += dt;
      const top = this.doors[Rp.i].getWorldPosition(_v);
      const k = clamp(Rp.t / 2.3, 0, 1), e = k < 0.75 ? k / 0.75 * 0.92 : 0.92 + (k - 0.75) / 0.25 * 0.08;   // fast, then a brake at the bottom
      s.pos.set(lerp(top.x, Rp.land.x, e), lerp(top.y - 1.6, Rp.land.y, e), lerp(top.z, Rp.land.z, e));
      s.root.position.copy(s.pos);
      s.root.rotation.y = Math.atan2(-(g.headPos.x - s.pos.x), -(g.headPos.z - s.pos.z));
      if (k >= 1) { Rp.done = true; s.floorY = Rp.land.y; s.pos.y = Rp.land.y; s.delay = 0.4; s.stateT = 0; g.audio.play('step_metal', { x: s.pos.x, y: s.pos.y, z: s.pos.z, volume: 0.8 }); }
    }
    const allDown = H.men.length === H.dropN && H.men.every(s => !s.rope || s.rope.done);
    if (allDown && !H.dropEnd) H.dropEnd = H.ropeT;
    if (H.dropEnd && H.ropeT > H.dropEnd + 1.2) { this._cutRopes(); H.phase = 'fight'; H.wpT = 0; H.ropesOut = false; H.dropEnd = 0; }
  }
  _cutRopes(dying = false) {
    const H = this.H;
    for (const r of this.ropes) r.visible = false;
    if (!H?.men) return;
    for (const s of H.men) if (s && s.rope && !s.rope.done && s.alive) {
      s.rope.done = true;
      if (dying) this.g.killSoldier(s, new THREE.Vector3(range(-1, 1), -1, range(-1, 1)), 1.2, false, 'OFF THE ROPE!');
    }
    // the ones still in the cabin go down with it
    if (dying) H.dropN = H.men.length;
  }
  _drawRopes() {
    const H = this.H;
    for (let i = 0; i < 2; i++) {
      const r = this.ropes[i];
      r.visible = H.phase === 'drop' && H.ropesOut;
      if (!r.visible) continue;
      const top = this.doors[i].getWorldPosition(_v);
      const bot = _v2.set(top.x + Math.sin(this.g.time * 1.3 + i) * 0.4, roofGround(top.x, top.z) + 0.1, top.z + Math.cos(this.g.time * 1.1 + i) * 0.4);
      const L = top.distanceTo(bot) * H.ropeK;
      r.position.copy(top);
      _v3.subVectors(bot, top).normalize();
      r.quaternion.setFromUnitVectors(_v.set(0, -1, 0), _v3);
      r.scale.set(1, Math.max(0.01, L), 1);
    }
  }

  // ---------------------------------------------------------------- flight
  update(dt) {
    this._updRockets(dt);
    this._updWreck(dt);
    const g = this.g, H = this.H;
    if (!H || H.phase === 'gone') return;
    H.t += dt; H.hitT = Math.max(0, H.hitT - dt * 6);
    const m = this.m, head = g.headPos;
    const target = _v.set(0, 0, 0);
    let speedK = 1.1, maxV = 30;
    if (H.alive && H.phase !== 'dying' && H.phase !== 'retreat' && H.phase !== 'lurk') g.bossInfo = { frac: Math.max(0, H.hp / H.maxHp), name: 'GUNSHIP  "NIGHT HERON"' };
    if (H.phase === 'rise') {
      // straight up out of the gorge over the gap in the parapet, nose on you, light in your eyes
      target.set(350, 247, 194); speedK = 1.0; maxV = 20;
      if (H.t > 0.6 && !H.flyby) { H.flyby = true; g.audio.play('heli_flyby', { x: H.pos.x, y: H.pos.y, z: H.pos.z }); }
      if (H.t > 5.5) { H.phase = 'fight'; H.wpT = 0; }
    }
    if (H.phase === 'fight') {
      H.fightT += dt; H.wpT -= dt; H.diveT -= dt; H.dropT -= dt;
      if (H.wpT <= 0) {
        // circle the crown on your side of it, outside the cage; up and down a little
        H.wpT = range(3.5, 5.5);
        const toP = Math.atan2(head.z - TC.z, head.x - TC.x);
        H.orbit = toP + range(-0.95, 0.95);
        const Rr = range(58, 82);
        H.wp.set(TC.x + Math.cos(H.orbit) * Rr, range(234, 256), TC.z + Math.sin(H.orbit) * Rr);
      }
      target.copy(H.wp);
      const next = H.drops.length ? H.drops[0] : 0;
      if (next && (H.dropT <= 0 || (next === 2 && H.hp < H.maxHp * 0.7)) && (next === 4 || H.hp < H.maxHp * 0.7)) { H.drops.shift(); this._startDrop(next); }
      else if (H.diveT <= 0) {
        // under the roof line: it drops out of sight past the edge and comes back up somewhere else
        H.phase = 'dive'; H.t = 0; H.diveT = range(20, 26);
        H.a0 = Math.atan2(H.pos.z - TC.z, H.pos.x - TC.x); H.a1 = H.a0 + (chance(0.5) ? 1 : -1) * range(1.3, 1.9);
        g.events.push({ type: 'heliDive' });
      }
    }
    if (H.phase === 'drop') { target.copy(HOVER); speedK = 1.0; maxV = 22; this._updDrop(dt); }
    if (H.phase === 'retreat') {
      // a salvo into the tower under the roof (glass, fire, the whole crown shudders), then it drops away into the gorge
      const a = Math.atan2(H.pos.z - TC.z, H.pos.x - TC.x);
      if (H.t < 1.6) { target.copy(H.pos); speedK = 0.5; maxV = 6; }
      else { target.set(TC.x + Math.cos(a) * 120, 150, TC.z + Math.sin(a) * 120); speedK = 1.2; maxV = 34; }
      while (H.salvo < 4 && H.t > 0.25 + H.salvo * 0.3) {
        H.salvo++;
        const pod = m.pods[H.salvo % 2], p = pod.getWorldPosition(new THREE.Vector3());
        const f = new THREE.Vector3(clamp(H.pos.x, TOWER.x0 - 0.5, TOWER.x1 + 0.5), range(212, 232), clamp(H.pos.z, TOWER.z0 - 0.5, TOWER.z1 + 0.5));
        const dir = f.clone().sub(p).normalize();
        this.rockets.push({ pos: p, vel: dir.multiplyScalar(48), life: 4, tgt: f });
        g.audio.play('rocket_launch', { x: p.x, y: p.y, z: p.z });
        g.fx.muzzle(p, dir, 'launcher', false);
      }
      if (H.t > 6.5) { H.phase = 'lurk'; H.t = 0; }
    }
    if (H.phase === 'lurk') { target.copy(H.pos); speedK = 0.3; maxV = 4; }
    if (H.phase === 'chase') {
      // off your shoulder on the hill's side, a little behind and above, weaving; it climbs out of the gorge first
      const R = this.sp.rail, back = 16 + 8 * Math.sin(H.t * 0.31);
      R.at(Math.max(0, R.s - back), _v2);
      const sd = _v3.set(-R.tan.z, 0, R.tan.x).normalize();
      const sg = Math.sign(sd.x * (CRASH.x - _v2.x) + sd.z * (CRASH.z - _v2.z)) || 1;
      target.copy(_v2).addScaledVector(sd, sg * (30 + 7 * Math.sin(H.t * 0.47))); target.y += 5 + 4 * Math.sin(H.t * 0.7);
      speedK = H.t < 3 ? 1.2 : 1.5; maxV = 40;
    }
    if (H.phase === 'dive') {
      const T = H.t, Rr = 72;
      if (T < 2.2) { target.set(TC.x + Math.cos(H.a0) * Rr, 200, TC.z + Math.sin(H.a0) * Rr); speedK = 1.8; maxV = 34; }
      else if (T < 4.8) { const a = lerp(H.a0, H.a1, (T - 2.2) / 2.6); target.set(TC.x + Math.cos(a) * Rr, 198, TC.z + Math.sin(a) * Rr); speedK = 1.8; maxV = 40; }
      else { target.set(TC.x + Math.cos(H.a1) * 64, 250, TC.z + Math.sin(H.a1) * 64); speedK = 1.6; maxV = 30; if (T > 5 && !H.upSnd) { H.upSnd = true; g.audio.play('heli_flyby', { x: H.pos.x, y: H.pos.y, z: H.pos.z, volume: 0.8 }); } }
      if (T > 8) { H.phase = 'fight'; H.wpT = 0; H.upSnd = false; }
    }
    if (H.phase === 'fight' || H.phase === 'drop' || (H.phase === 'dive' && H.t > 6) || (H.phase === 'rise' && H.t > 3.5) || (H.phase === 'chase' && H.t > 3)) this._weapons(dt);
    m.aimGun?.(H.aimAt || head, dt, H.phase !== 'dying' && H.burst > 0);
    if (H.hp < H.maxHp * 0.5 && rand() < dt * 25) { m.sparkPt.getWorldPosition(_v2); g.fx.flame(_v2, 0.5, H.vel); }
    if (H.phase !== 'dying' && H.alive) {
      if (H.hp < H.maxHp * 0.5) g.fx.trailEmit(H, m.smokePt.getWorldPosition(_v2), 0.8, (q) => g.fx.smoke(q, 1.1, 0.13, 2.5, 0.5, 0.65), 0);
      if (H.hp < H.maxHp * 0.6) g.fx.trailEmit(H.ribbon ||= {}, m.smokePt.getWorldPosition(_v2), 2.2, (q) => g.clouds.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.4, 0.4), vy: range(0.3, 1), vz: range(-0.4, 0.4), drag: 0.5, buoy: 0.1, s0: 2.2, s1: range(9, 13), life: range(6, 8), a: H.hp < H.maxHp * 0.3 ? 0.92 : 0.7, fadeIn: 0.05, fadeOut: 0.55, vrot: range(-0.2, 0.2), r: 0.07, g: 0.062, b: 0.058, r1: 0.2, g1: 0.18, b1: 0.16 }), 0);
    }
    if (H.phase === 'dying') {
      H.spin = Math.min(5.5, H.spin + dt * 2.2);
      H.yaw += H.spin * dt;
      // VR: the dive waits until you're looking at it (or 4 s): a burning, spinning, sinking limp where it was hit
      if (!H.commit) {
        g.camera.getWorldDirection(_v3); const to = _v2.subVectors(H.pos, g.headPos).normalize();
        H.lookT = _v3.dot(to) > 0.8 ? H.lookT + dt : 0;
        if (H.lookT > 0.3 || H.t > 4 || g.auto) { H.commit = true; H.ct = 0; g.events.push({ type: 'heliCommit' }); }
      }
      if (H.commit) H.ct += dt;
      // the dive goes round the tower, never through it: while the line to the hill crosses the tower, it swings round it
      const thru = H.commit && H.pos.y < 300 && segHitsTower(H.pos, CRASH);
      let goal;
      if (thru) {
        const a0 = Math.atan2(H.pos.z - TC.z, H.pos.x - TC.x), a1 = Math.atan2(CRASH.z - TC.z, CRASH.x - TC.x);
        let d = a1 - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        const a = a0 + Math.sign(d) * Math.min(Math.abs(d), 0.7);
        goal = _v.set(TC.x + Math.cos(a) * 64, Math.min(H.pos.y, 226), TC.z + Math.sin(a) * 64);
      } else goal = H.commit ? CRASH : _v.copy(H.c0).add(_v3.set(Math.cos(H.t * 1.1) * 9, -H.t * 3, Math.sin(H.t * 1.1) * 9));
      const sp = H.commit ? Math.min(46, 18 + H.ct * 9) : 12;
      _v2.subVectors(goal, H.pos).normalize();
      _v2.x += Math.sin(H.t * 2.3) * 0.25; _v2.y += Math.sin(H.t * 3.1) * 0.15; _v2.normalize();
      H.vel.lerp(_v2.multiplyScalar(sp), 1 - Math.exp(-dt * (H.commit ? 2.0 : 2.5)));
      g.fx.trailEmit(H, m.smokePt.getWorldPosition(_v3), 0.7, (q) => { g.fx.flame(q, 1.4); g.fx.smoke(q, 1.8, 0.1, 3.5, 1, 0.85); }, 0);
      g.fx.trailEmit(H.ribbon ||= {}, m.smokePt.getWorldPosition(_v3), 2.0, (q) => g.clouds.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.5, 0.5), vy: range(0.5, 1.5), vz: range(-0.5, 0.5), drag: 0.5, buoy: 0.1, s0: 3, s1: range(12, 16), life: range(7, 9), a: 0.94, fadeIn: 0.03, fadeOut: 0.5, vrot: range(-0.2, 0.2), r: 0.06, g: 0.052, b: 0.048, r1: 0.18, g1: 0.16, b1: 0.14, glow: 1.2, glowFade: 6 }), 0);
      if (H.t > 0.8 && !H.tail && m.breakTail) {
        const tb = m.breakTail();
        if (tb) { H.tail = { o: tb.object, v: tb.velocityHint.clone().add(H.vel), w: tb.spinHint.clone() }; g.fx.smallExplosion(tb.object.getWorldPosition(new THREE.Vector3()), 0.9); }
      }
      const d = H.pos.distanceTo(CRASH);
      if ((H.commit && (d < 7 || (d < 25 && _v3.subVectors(CRASH, H.pos).dot(H.vel) < 0))) || H.t > 22) { this._crash(); return; }
    } else {
      _v2.subVectors(target, H.pos).multiplyScalar(speedK);
      if (_v2.length() > maxV) _v2.setLength(maxV);
      H.vel.lerp(_v2, 1 - Math.exp(-dt * 1.6));
      this._avoid(H, dt);
    }
    H.pos.addScaledVector(H.vel, dt);
    if (H.phase !== 'dying') {
      // nose on you (in the drop: broadside to the roof, the doors over it)
      const faceYaw = H.phase === 'drop' && H.pos.distanceTo(HOVER) < 12 ? -Math.PI / 2 : (H.phase === 'dive' && H.t > 1.8 && H.t < 4.8) ? Math.atan2(-H.vel.x, -H.vel.z) : Math.atan2(-(head.x - H.pos.x), -(head.z - H.pos.z));
      let dy = faceYaw - H.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      H.yaw += dy * (1 - Math.exp(-dt * 2.4));
    }
    const cy = Math.cos(H.yaw), sy = Math.sin(H.yaw);
    const fwd = H.vel.x * -sy + H.vel.z * -cy, side = H.vel.x * cy - H.vel.z * sy;
    H.pitch = damp(H.pitch, -clamp(fwd * 0.012, -0.35, 0.35), 3, dt);
    H.bank = damp(H.bank, -clamp(side * 0.02, -0.55, 0.55), 3, dt);
    m.root.position.copy(H.pos);
    m.root.rotation.set(0, H.yaw, 0);
    m.tilt.rotation.set(H.pitch, 0, H.bank + (H.phase === 'dying' ? Math.sin(H.t * 3) * 0.3 : 0));
    m.rotor.rotation.y += dt * 38; m.tailRotor.rotation.x += dt * 60;
    m.root.updateMatrixWorld();
    this._drawRopes();
    g.audio.setLoop('heli', { x: H.pos.x, y: H.pos.y, z: H.pos.z, volume: 1 });
    // rotor wash on the roof: grit and grime whipped off the deck when it's low over it
    const gy = roofGround(H.pos.x, H.pos.z);
    if (H.pos.y - gy < 30 && H.phase !== 'dying') {
      H.dustT = (H.dustT || 0) - dt;
      if (H.dustT <= 0) {
        H.dustT = 0.05;
        const a = 1 - (H.pos.y - gy) / 30, ang = rand() * 6.28, r = range(2, 9);
        const x = H.pos.x + Math.cos(ang) * r, z = H.pos.z + Math.sin(ang) * r;
        if (onRoof(x, z)) g.fx.main.spawn({ x, y: roofGround(x, z) + 0.3, z, vx: Math.cos(ang) * range(6, 11), vz: Math.sin(ang) * range(6, 11), vy: range(0.3, 1.2), drag: 1.1, frame: CELL.DUST, s0: 1.5, s1: 6, life: 1.4, rot: rand() * 6, r: 0.5, g: 0.46, b: 0.42, a: 0.35 * a, fadeOut: 0.35 });
      }
    }
    // the searchlight: from the nose, on you (or where the gun is walking)
    this.spot.visible = H.phase !== 'dying' && H.phase !== 'lurk' && H.alive;
    if (this.spot.visible) { m.lightPt.getWorldPosition(_v); this.spot.position.copy(_v); const tg = _v2.copy(H.aimAt || g.headPos); if (H.phase === 'rise' || H.burst <= 0) tg.copy(g.headPos).y -= 1.2; tg.y = Math.min(tg.y, _v.y - 2); _v3.subVectors(tg, _v).normalize(); this.spot.quaternion.setFromUnitVectors(_v.set(0, -1, 0), _v3); }
    // nav lights + the lamp's glow
    const G = this.glowB, blink = Math.sin(g.time * 6) > 0.3;
    let gi = 0;
    if (H.phase !== 'dying') for (const [pt, col] of m.navLights) { if (col[3] && !blink) continue; pt.getWorldPosition(_v); G.set(gi++, _v.x, _v.y, _v.z, 1.3, 1.3, 0, CELL.GLOW, 0, col[0] * 1.4, col[1] * 1.4, col[2] * 1.4, 1); }
    if (H.phase !== 'dying') { m.lightPt.getWorldPosition(_v); G.set(gi++, _v.x, _v.y, _v.z, 3, 3, 0, CELL.GLOW, 0, 2.2, 2.0, 1.7, 0.9); }
    G.commit(gi);
  }
  // keep out of the crown's cage and off the mast (the rotor is 11 m); never below the river fog
  _avoid(H, dt) {
    const p = H.pos;
    if (p.y < 300) {
      const hx = (TOWER.x1 - TOWER.x0) / 2 + 13, hz = (TOWER.z1 - TOWER.z0) / 2 + 13;
      const dx = p.x - TC.x, dz = p.z - TC.z;
      const inBox = Math.abs(dx) < hx && Math.abs(dz) < hz && !(H.phase === 'drop' && p.y > 258);
      if (inBox) { const ox = hx - Math.abs(dx), oz = hz - Math.abs(dz); if (ox < oz) H.vel.x += Math.sign(dx || 1) * ox * 6 * dt; else H.vel.z += Math.sign(dz || 1) * oz * 6 * dt; }
      const dm = Math.hypot(p.x - MAST.x, p.z - MAST.z);
      if (dm < 13.5 && p.y < 290) { H.vel.x += (p.x - MAST.x) / (dm || 1) * (13.5 - dm) * 8 * dt; H.vel.z += (p.z - MAST.z) / (dm || 1) * (13.5 - dm) * 8 * dt; }
    }
    if (p.y < (H.phase === 'chase' ? 22 : 150)) H.vel.y = damp(H.vel.y, 8, 3, dt);
  }
  _weapons(dt) {
    const g = this.g, H = this.H, m = this.m, head = g.headPos;
    H.rocketT -= dt; H.gunT -= dt;
    const hpFrac = H.hp / H.maxHp;
    if (H.rocketT <= 0 && H.phase !== 'drop') {
      H.rocketT = range(3.8, 5.6) * (hpFrac < 0.5 ? 0.8 : 1);
      const pod = m.pods[Math.floor(rand() * 2)];
      const p = pod.getWorldPosition(new THREE.Vector3());
      // short of you onto the deck, the parapet beside you, the housing behind you: big, loud, mostly survivable
      const chase = H.phase === 'chase';
      const aim = head.clone().add(chase ? _v.set(range(-5, 5), range(-3, 2), range(-5, 5)) : _v.set(range(-6, 6), -1.6, range(-6, 6)));
      const dir = aim.clone().sub(p).normalize();
      this.rockets.push({ pos: p, vel: dir.multiplyScalar(44), life: 5, prox: chase });
      g.audio.play('rocket_launch', { x: p.x, y: p.y, z: p.z });
      g.fx.muzzle(p, dir, 'launcher', false);
    }
    if (H.gunT <= 0) {
      if (H.burst <= 0) { H.burst = 16; H.walk0 = head.clone().add(_v.set(range(-7, 7), 0, range(-7, 7))); H.walk1 = head.clone(); }
      H.burst--;
      H.gunT = H.burst > 0 ? 0.075 : range(2.2, 3.4);
      const mz = m.gun.getWorldPosition(new THREE.Vector3());
      const prog = 1 - H.burst / 16;
      const tgt = _v2.lerpVectors(H.walk0, H.walk1, prog);
      const air = H.phase === 'chase';
      tgt.y = air ? head.y + range(-2, 0.6) : roofGround(tgt.x, tgt.z) + range(-0.2, 0.6);
      tgt.x += range(-0.8, 0.8); tgt.z += range(-0.8, 0.8);
      this._gunRound(mz, tgt.clone(), air);
    }
  }
  _gunRound(mz, tgt, air = false) {
    const g = this.g;
    (this.H.aimAt ||= new THREE.Vector3()).copy(tgt);
    _v.subVectors(tgt, mz).normalize();
    g.fx.muzzle(mz, _v, 'enemy', false);
    if (rand() < 0.4) g.fx.light(mz, 12, 0.05, 0xffb060, true, 12);
    g.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, pitch: 0.62, volume: 1 });
    const { end } = g._round(mz, tgt, null, { speed: 300, color: [2.0, 0.65, 0.28], width: 0.09, len: 6, carDmg: 2 });
    g.fx.later(mz.distanceTo(end) / 300, () => {
      g.fx.main.spawn({ x: end.x, y: end.y + 0.3, z: end.z, vy: range(2, 4), frame: CELL.DIRT, s0: 0.6, s1: 2.2, ease: 0.5, life: 0.9, rot: rand() * 6, r: 0.7, g: 0.68, b: 0.64, a: 0.85, fadeIn: 0.02, fadeOut: 0.3 });
      if ((air ? tgt : end).distanceTo(g.headPos) < (air ? 1.1 : 1.6) + (g.trailer ? -0.6 : 0)) g.hurt(air ? 4 : 6, end);
    });
  }
  _updRockets(dt) {
    const g = this.g;
    for (const r of this.rockets) {
      r.life -= dt;
      const prev = _v2.copy(r.pos);
      r.pos.addScaledVector(r.vel, dt);
      g.fx.trailEmit(r, r.pos, 0.35, (q) => { g.fx.main.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.3, 0.3), vy: range(0.2, 0.6), vz: range(-0.3, 0.3), drag: 1.2, frameKind: 2, frame: rand() * 40, frames: 12, s0: 0.5, s1: 2.4, life: range(1.6, 2.4), rot: rand() * 6, r: 0.55, g: 0.52, b: 0.5, a: 0.55, fadeOut: 0.5 }); }, 0);
      g.fx.main.spawn({ x: r.pos.x, y: r.pos.y, z: r.pos.z, frame: CELL.GLOW, s0: 0.9, life: 0.04, r: 3.8, g: 1.8, b: 0.6, a: 1, anchored: false });
      g.audio.setLoop('rocket:' + (r.id ||= Math.floor(rand() * 1e6)), { x: r.pos.x, y: r.pos.y, z: r.pos.z, volume: 0.8 });
      _v.subVectors(r.pos, prev); const L = _v.length(); _v.divideScalar(L || 1);
      const hit = L > 0 ? g.col.raycast(prev, _v, L, b => b.data.noBullet || b.data.kind === 'glass') : null;
      const gy = roofGround(r.pos.x, r.pos.z);
      const prox = r.prox && (r.pos.distanceTo(g.headPos) < 6 || (r.pos.distanceTo(g.headPos) < 16 && _v3.subVectors(g.headPos, r.pos).dot(r.vel) < 0));
      if (r.tgt && r.pos.distanceTo(r.tgt) < 3) {
        r.dead = true; g.audio.stopLoop('rocket:' + r.id);
        g.boom(r.pos.clone(), 1.5, { radius: 8, dmg: 0, player: false });
        g.glass.burst?.(r.pos.clone(), new THREE.Vector3(Math.sign(r.pos.x - TC.x), 0.3, Math.sign(r.pos.z - TC.z)), 30, { spread: 4, speed: 6, size: 0.4, life: 9 });
        this.sp.towerGroan(1); g.lastExplosionShake = 0.8; g.lastExplosionT = g.time;
        continue;
      }
      if (hit || prox || r.pos.y < gy + 0.2 || r.life <= 0) {
        r.dead = true;
        const P = hit ? prev.clone().addScaledVector(_v, hit.t - 0.2) : r.pos.clone().setY(Math.max(r.pos.y, gy + 0.3));
        g.audio.stopLoop('rocket:' + r.id);
        g.boom(P, 1.0, { radius: 6.5, dmg: 34 });
      }
    }
    this.rockets = this.rockets.filter(r => !r.dead);
    if (this.H?.tail && !this.H.tail.done) {
      const T = this.H.tail;
      T.v.y -= 9.8 * dt; T.o.position.addScaledVector(T.v, dt);
      const q = new THREE.Quaternion().setFromAxisAngle(_v.copy(T.w).normalize(), T.w.length() * dt); T.o.quaternion.premultiply(q);
      g.fx.trailEmit(T, T.o.position, 0.6, (p) => g.fx.smoke(p, 1.0, 0.12, 2.5, 0.6, 0.7), 0);
      if (T.o.position.y < groundAt(T.o.position.x, T.o.position.z) + 0.8) { T.done = true; T.o.visible = false; g.fx.smallExplosion(T.o.position.clone(), 1.2); }
    }
  }
  // ---------------------------------------------------------------- into the hill: the gold tower on the crest takes it, and the slope lets go
  _crash() {
    const g = this.g, H = this.H, m = this.m;
    H.phase = 'gone'; H.alive = false;
    g.audio.stopLoop('heli'); this.glowB.commit(0); this.spot.visible = false; for (const r of this.ropes) r.visible = false;
    const I = CRASH.clone();
    // wedged in the tower's face, nose first, burning: it rides the tower down the slope
    m.root.position.copy(I).add(_v.set(0, 0, 2.5)); m.root.rotation.set(0.45, Math.PI * 0.85, 0.7);
    m.tilt.rotation.set(0, 0, 0);
    m.root.traverse(o => { if (o.isMesh && !o.material?.isShaderMaterial) o.material = Array.isArray(o.material) ? o.material.map(() => MAT.charred) : MAT.charred; });
    m.rotorBlur?.(0, true);
    m.rotor.visible = false; if (m.cone) m.cone.visible = false;
    this.wreck = this.sp.slide.attach(m.root, I);
    const head = g.headPos, far = I.distanceTo(head);
    g.fx.explosion(I.clone(), 5.0, { noRing: true });
    for (let k = 1; k <= 8; k++) g.fx.later(0.1 * k + rand() * 0.1, () => g.fx.explosion(I.clone().add(_v.set(range(-9, 9), range(-12, 8), range(-2, 6))), range(2.2, 3.4), { noRing: true }));
    for (let k = 0; k < 14; k++) g.fx.later(0.15 + k * 0.08, () => g.clouds.spawn({ x: I.x + range(-10, 10), y: I.y + range(-6, 8), z: I.z + range(0, 8), vx: range(-4, 4), vy: range(4, 9), vz: range(0, 5), drag: 0.5, buoy: 0.6, s0: range(10, 16), s1: range(36, 52), life: range(10, 14), a: 0.95, fadeIn: 0.02, fadeOut: 0.4, vrot: range(-0.1, 0.1), r: 0.06, g: 0.052, b: 0.047, r1: 0.14, g1: 0.125, b1: 0.11, glow: 1.4, glowFade: 1.6 }));
    g.fx.light(I, 2400, 2.0, 0xff9040, true, far + 60);
    g.lastExplosionT = g.time; g.lastExplosionShake = 0.5;
    g.audio.play('explosion_big', { x: I.x, y: I.y, z: I.z, volume: 1 });
    g.audio.play('explosion_big', { volume: 0.55, pitch: 0.7 });   // it carries up to the roof (160 m off)
    g.audio.play('metal_crash', { x: I.x, y: I.y, z: I.z, volume: 1 });
    for (let k = 0; k < 90; k++) g.fx.sparks.spawn({ x: I.x + range(-6, 6), y: I.y + range(-4, 8), z: I.z + range(0, 6), vx: range(-9, 9), vy: range(-3, 8), vz: range(0, 9), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 2, w: 0.4, len: 1.4, life: range(2, 4), r: 2.6, g: 1.6, b: 0.6, a: 0.9, fadeOut: 0.5 });
    for (let k = 0; k < 24; k++) g.fx.spawnDebris(_v.set(I.x + range(-6, 6), I.y + range(-4, 6), I.z + 2), range(-8, 8), range(0, 9), range(2, 12), range(0.5, 1.4), chance(0.4));
    g.glass.burst?.(I.clone().add(_v.set(0, 4, 1)), new THREE.Vector3(0, 0.3, 1), 60, { spread: 9, speed: 7, size: 0.5, life: 10 });
    g.slowmo(2.2, 0.35, true);
    g.fx.later(1.6, () => !g.quietScore && g.addScore(1500, 'STRAIGHT INTO THE HILL!', head.clone().addScaledVector(g.playerFwd, 6).setY(head.y - 0.5), 'big'));
    g.fx.main.bigBudget += 90; g.fx.later(5, () => { g.fx.main.bigBudget -= 90; });
    this.megaFireball(I.clone(), 3.6);
    g.fx.later(0.3, () => this.megaFireball(I.clone().add(_v.set(range(-6, 6), 12, 4)), 2.6));
    g.events.push({ type: 'heliCrash', P: I.clone() });
    g.fx.later(0.5, () => this.sp.landslide(false, 1));
  }
  megaFireball(P, k = 1) {
    const g = this.g;
    g.fx.main.spawn({ x: P.x, y: P.y, z: P.z, frame: CELL.FLASH, s0: 16 * k, s1: 34 * k, life: 0.25, r: 2.2, g: 1.1, b: 0.4, a: 1, fadeIn: 0, fadeOut: 0.3, force: true });
    for (let i = 0; i < 12; i++) g.fx.later(i * 0.04, () => {
      const a = rand() * 6.28, el = range(0.1, 1.2), sp = range(6, 16) * k;
      g.fx.main.spawn({ x: P.x + range(-4, 4) * k, y: P.y + range(-2, 3) * k, z: P.z + range(0, 4) * k, vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp + 4, vz: Math.abs(Math.sin(a)) * Math.cos(el) * sp, drag: 1.6, grav: 2, frameKind: 1, s0: range(9, 13) * k, s1: range(22, 32) * k, ease: 0.55, life: range(1.8, 2.6), rot: rand() * 6, vrot: range(-0.6, 0.6), r: 2.4, g: 1.25, b: 0.62, a: 1, fadeIn: 0.02, fadeOut: 0.8 });
    });
    for (let i = 0; i < 9; i++) g.fx.later(range(0.4, 1.3), () => g.clouds.spawn({ x: P.x + range(-8, 8) * k, y: P.y + range(3, 10) * k, z: P.z + range(-2, 6), vx: range(-2, 2), vy: range(5, 9), vz: range(-1, 3), drag: 0.45, buoy: 0.5, s0: 12 * k, s1: range(30, 42) * k, life: range(8, 11), a: 0.95, fadeIn: 0.08, fadeOut: 0.45, vrot: range(-0.12, 0.12), r: 0.07, g: 0.06, b: 0.055, r1: 0.15, g1: 0.13, b1: 0.115, glow: 1.2, glowFade: 2 }));
  }
  // the wreck burns where it's wedged, riding the tower down the slope into the river
  _updWreck(dt) {
    const W = this.wreck; if (!W || W.done) return;
    const g = this.g;
    W.t = (W.t || 0) + dt;
    const p = W.world(_v);
    if (!p || p.y < -6) { W.done = true; this.m.root.visible = false; return; }
    if (rand() < dt * 22) g.fx.flame(_v2.set(p.x + range(-3, 3), p.y + range(-2, 3), p.z + range(0, 3)), range(3, 5));
    if (rand() < dt * 2.2) g.clouds.spawn({ x: p.x + range(-2, 2), y: p.y + 4, z: p.z + 2, vx: range(-1, 1), vy: range(4, 7), vz: range(0, 2), drag: 0.25, buoy: 0.4, s0: 5, s1: range(22, 30), life: range(8, 11), a: 0.9, fadeIn: 0.05, fadeOut: 0.5, r: 0.05, g: 0.045, b: 0.04, r1: 0.11, g1: 0.1, b1: 0.09, glow: 1.8, glowFade: 3 });
  }
}
