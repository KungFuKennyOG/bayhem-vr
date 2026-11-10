import * as THREE from 'three';
import { rand, range, chance, clamp, lerp, damp } from '../../rng.js';
import { CELL, BillboardBatch } from '../../particles.js';
import { buildHeli } from '../../heli.js';
import { MAT } from '../../vehicles.js';
import { ROOFTOP, TOWER, ROAD, RIVER, CRASH, Y, groundAt } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the two gunships (the engine's WIDOWMAKER from src/heli.js).
//
//  mode 'river' — NIGHT HERON ONE, at the cliff road: it comes up out of the gorge beside you and
//  holds over the river, 35–60 m off the railing, rocketing the traffic and walking its chin gun
//  down the road. Shot down, it limps away across the river (look-gated) into the gold tower on the
//  crest of the hillside district — and the hill lets go (setpieces.landslide).
//
//  mode 'roof' — NIGHT HERON TWO, on Jinlong's roof: it rises off the west edge, circles the crown,
//  ducks under the roof line and comes back up somewhere else, hovers over the deck to rope men down
//  onto it. This one you finish: it spins into the tower's own west face under the parapet, and the
//  tower starts to go (setpieces.towerHit).
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const TC = new THREE.Vector3((TOWER.x0 + TOWER.x1) / 2, 0, (TOWER.z0 + TOWER.z1) / 2);
const R = ROOFTOP;
const HILL = new THREE.Vector3(...CRASH);
const FACE = new THREE.Vector3(TOWER.x0 - 2.5, R.y - 26, TC.z);        // where Heron Two ends: the west face, under the jump gap
const HOVER = new THREE.Vector3(TC.x + 3, R.y + 27, TC.z + 1);          // over the deck, clear of the crown's ring and the mast
const onRoof = (x, z) => x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1;
const floorAt = (x, z) => onRoof(x, z) ? R.y : groundAt(x, z);
function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r, h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}

export class Gunship {
  constructor(g, sp, { mode = 'river', name = 'NIGHT HERON', hp = 150 } = {}) {
    this.g = g; this.sp = sp; this.mode = mode; this.name = name; this.hp0 = hp; this.H = null; this.rockets = [];
    const m = buildHeli();
    m.root.scale.setScalar(1.6);
    // a warm lift on the paint (the city's light under it): never a black toy against the fog
    m.root.traverse(o => { if (o.isMesh && o.material && !o.material.isShaderMaterial) { o.material = [].concat(o.material).map(mm => { if (!mm.isMeshStandardMaterial) return mm; const c = mm.clone(); c.emissive = new THREE.Color(0x4a3420); c.emissiveIntensity = 1; return c; }); if (o.material.length === 1) o.material = o.material[0]; } });
    m.root.visible = false; g.scene.add(m.root);
    this.m = m;
    { const L = 80, cg = new THREE.ConeGeometry(8, L, 18, 1, true); cg.translate(0, -L / 2, 0);
      const cm = new THREE.ShaderMaterial({ vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y / ${L.toFixed(1)}; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float a = pow(abs(dot(vN, vV)), 1.5) * pow(1.0 - vY, 1.8) * 0.28; gl_FragColor = vec4(vec3(0.9, 0.92, 1.0) * a, a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      this.spot = new THREE.Mesh(cg, cm); this.spot.frustumCulled = false; this.spot.renderOrder = 18; this.spot.visible = false; g.scene.add(this.spot); }
    const rm = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.9 });
    const rg = new THREE.CylinderGeometry(0.045, 0.045, 1, 5, 1, true); rg.translate(0, -0.5, 0);
    this.ropes = [0, 1].map(() => { const o = new THREE.Mesh(rg, rm); o.visible = false; o.frustumCulled = false; g.scene.add(o); return o; });
    const mk = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); m.tilt.add(o); return o; };
    this.doors = [mk(1.95, -0.5, -0.4), mk(-1.95, -0.5, -0.4)];
    this.hit = [[mk(0, 0.2, -0.8), 1.9], [mk(0, 0.4, -3.4), 1.3], [mk(0, 0.4, 3.0), 1.1], [mk(0, 0.5, 6.5), 0.8]];
    this.glowB = new BillboardBatch(24, g.E.atlas, { boost: 1, renderOrder: 19, fog: g.scene.fog, ground: -20 });
    g.scene.add(this.glowB.mesh);
    this.target = {
      active: () => !!this.H && this.H.alive && this.H.phase !== 'dying',
      ray: (o, d) => { let best = -1; for (const [pt, r] of this.hit) { pt.getWorldPosition(_v); const t = raySphere(o, d, _v, r); if (t > 0 && (best < 0 || t < best)) best = t; } return best; },
      hit: (P, dir) => { g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.8, pitch: 0.75 }); this.damage(0.35, P); g.hitMarker(false); },
      near: (p) => this.H.pos.distanceTo(p) < 4.2,
      direct: (p) => { this.damage(20, p); g.hitMarker(true); },
      blast: (P, r, dmg) => { const d = this.H.pos.distanceTo(P); if (d < r + 4) this.damage(dmg * 0.12 * (1 - d / (r + 4)) + 2, P); },
      aim: () => this.H.pos,
      auto: (head, A) => {
        const H = this.H; if (H.phase === 'rise' && H.t < 2.5) return null;
        const d = H.pos.distanceTo(head); if (d > 140) return null;
        if (!g.col.visible(head, H.pos, b => b.data.noBullet)) return null;
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
  // ?beat= past this bird: it is already down
  skip() { this.H = { alive: false, phase: 'gone' }; this.m.root.visible = false; this.spot.visible = false; }
  get alive() { return !!this.H && this.H.alive; }
  get crashed() { return !!this.H && this.H.phase === 'gone'; }

  spawn() {
    if (this.H) return this.H;
    const g = this.g, m = this.m, head = g.headPos;
    m.root.visible = true;
    const hp = this.hp0 * (g.auto ? 1.3 : 1);   // the autopilot (demo / trailer) is a crack shot: a longer fight for the camera
    const river = this.mode === 'river';
    const p0 = river ? [head.x + 34, Y - 34, 384] : [TOWER.x0 - 46, R.y - 46, TC.z + 6];
    this.H = { pos: m.root.position.set(...p0), vel: new THREE.Vector3(0, 15, 0), yaw: river ? 0 : -Math.PI / 2, hp, maxHp: hp, phase: 'rise', t: 0, rocketT: 4.5, gunT: 1.4, burst: 0, wp: new THREE.Vector3(), wpT: 0, alive: true, bank: 0, pitch: 0, hitT: 0, orbit: Math.PI, diveT: 16, drops: river ? [] : [4, 2], dropT: 6, fightT: 0, rise: new THREE.Vector3(p0[0], river ? Y + 20 : R.y + 8, p0[2]) };
    g.audio.musicStinger('boss');
    g.events.push({ type: 'heliUp', mode: this.mode });
    return this.H;
  }
  damage(d, P) {
    const H = this.H; if (!H || !H.alive || H.phase === 'dying') return;
    H.hp -= d; H.hitT = 1;
    if (this.m.setDamage?.(clamp(1 - H.hp / H.maxHp, 0, 1))) {
      const p = this.m.sparkPt.getWorldPosition(new THREE.Vector3());
      this.g.fx.smallExplosion(p, 0.7);
      for (let i = 0; i < 4; i++) this.g.fx.spawnDebris(p, H.vel.x + range(-5, 5), range(2, 6), H.vel.z + range(-5, 5), range(0.15, 0.35), true);
      this.g.audio.play('metal_crash', { x: p.x, y: p.y, z: p.z, volume: 0.7, pitch: 1.3 });
      this.g.callout('ENGINE HIT!', p.clone().setY(p.y + 3), 'small');
      this.g.events.push({ type: 'heliHurt', mode: this.mode });
    }
    if (H.hp <= 0) this.kill();
  }
  kill() {
    const H = this.H, g = this.g; if (!H || H.phase === 'dying' || !H.alive) return;
    H.phase = 'dying'; H.t = 0; H.commit = false; H.lookT = 0; H.c0 = H.pos.clone();
    this._cutRopes(true);
    g.bossInfo = null;
    const p = H.pos.clone();
    g.fx.explosion(p, 1.6, { noRing: true });
    g.audio.play('explosion_big', { x: p.x, y: p.y, z: p.z, volume: 0.9 });
    g.audio.play('alarm_klaxon', { x: p.x, y: p.y, z: p.z, volume: 0.7, pitch: 1.4 });
    const T = this.m.breakTail?.();
    if (T) H.tail = { o: T.object, v: T.velocityHint.clone().add(H.vel), w: T.spinHint.clone() };
    this.m.setDamage?.(1);
    g.addScore(2500, 'GUNSHIP DOWN!', p.clone().setY(p.y + 5), 'big');
    g.events.push({ type: 'heliDying', mode: this.mode });
  }

  // ---------------------------------------------------------------- fast-ropes onto the roof (mode 'roof')
  _startDrop(n) { const H = this.H; H.phase = 'drop'; H.t = 0; H.dropN = n; H.ropeK = 0; H.men = []; this.g.events.push({ type: 'heliDrop' }); }
  _updDrop(dt) {
    const H = this.H, g = this.g;
    const near = H.pos.distanceTo(HOVER) < 3 && H.vel.length() < 4;
    if (!H.ropesOut && (near || H.t > 12)) { H.ropesOut = true; H.ropeT = 0; g.audio.play('gear_rattle', { x: H.pos.x, y: H.pos.y, z: H.pos.z, volume: 0.9, pitch: 0.7 }); }
    if (!H.ropesOut) return;
    H.ropeT += dt;
    H.ropeK = clamp(H.ropeT / 0.7, 0, 1);
    const slot = (i) => 0.9 + Math.floor(i / 2) * 1.5 + (i % 2) * 0.35;
    for (let i = 0; i < H.dropN; i++) {
      if (!H.men[i] && H.ropeT > slot(i)) {
        const d = this.doors[i % 2].getWorldPosition(new THREE.Vector3());
        const lx = clamp(d.x, R.x0 + 2.4, R.x1 - 2.4), lz = clamp(d.z, R.z0 + 2.4, R.z1 - 2.4), ly = R.y;
        const s = g.spawnSoldier({ x: lx, z: lz, y: ly, role: 'perch', delay: 99, noNade: i % 2 === 1, range: 70 });
        s.roper = true; s.hp = 2;
        s.rope = { i: i % 2, t: 0, land: new THREE.Vector3(lx, ly, lz) };
        s.perchBox = { min: { x: Math.max(R.x0 + 1.6, lx - 2.5), z: Math.max(R.z0 + 1.6, lz - 2.5) }, max: { x: Math.min(R.x1 - 1.6, lx + 2.5), z: Math.min(R.z1 - 1.6, lz + 2.5) } };
        H.men[i] = s;
      }
    }
    for (const s of H.men) {
      if (!s || !s.rope || s.rope.done) continue;
      const Rp = s.rope;
      if (!s.alive) { Rp.done = true; continue; }
      Rp.t += dt;
      const top = this.doors[Rp.i].getWorldPosition(_v);
      const k = clamp(Rp.t / 2.3, 0, 1), e = k < 0.75 ? k / 0.75 * 0.92 : 0.92 + (k - 0.75) / 0.25 * 0.08;
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
  }
  _drawRopes() {
    const H = this.H;
    for (let i = 0; i < 2; i++) {
      const r = this.ropes[i];
      r.visible = H.phase === 'drop' && !!H.ropesOut;
      if (!r.visible) continue;
      const top = this.doors[i].getWorldPosition(_v);
      const bot = _v2.set(top.x + Math.sin(this.g.time * 1.3 + i) * 0.4, floorAt(top.x, top.z) + 0.1, top.z + Math.cos(this.g.time * 1.1 + i) * 0.4);
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
    const m = this.m, head = g.headPos, river = this.mode === 'river';
    const target = _v.set(0, 0, 0);
    let speedK = 1.1, maxV = 30;
    if (H.alive && H.phase !== 'dying') g.bossInfo = { frac: Math.max(0, H.hp / H.maxHp), name: 'GUNSHIP  "' + this.name + '"' };
    if (H.phase === 'rise') {
      target.copy(H.rise); speedK = 1.0; maxV = 20;
      if (H.t > 0.6 && !H.flyby) { H.flyby = true; g.audio.play('heli_flyby', { x: H.pos.x, y: H.pos.y, z: H.pos.z }); }
      if (H.t > 5) { H.phase = 'fight'; H.wpT = 0; }
    }
    if (H.phase === 'fight') {
      H.fightT += dt; H.wpT -= dt; H.diveT -= dt; H.dropT -= dt;
      if (H.wpT <= 0) {
        H.wpT = range(3.5, 5.5);
        if (river) {
          // over the gorge beside the road: ahead of you or level with you, 35–60 m off the rail, a little above the road
          H.wp.set(clamp(head.x + range(-26, 46), ROAD.x0 + 20, ROAD.x1 - 10), Y + range(9, 24), RIVER.z1 - range(34, 60));
        } else {
          const toP = Math.atan2(head.z - TC.z, head.x - TC.x);
          H.orbit = toP + range(-0.95, 0.95);
          const Rr = range(56, 80);
          H.wp.set(TC.x + Math.cos(H.orbit) * Rr, R.y + range(-4, 18), TC.z + Math.sin(H.orbit) * Rr);
        }
      }
      target.copy(H.wp);
      if (!river) {
        const next = H.drops.length ? H.drops[0] : 0;
        if (next && (H.dropT <= 0 || (next === 2 && H.hp < H.maxHp * 0.6)) && (next === 4 || H.hp < H.maxHp * 0.6)) { H.drops.shift(); this._startDrop(next); }
        else if (H.diveT <= 0 && H.phase === 'fight') { H.phase = 'dive'; H.t = 0; H.diveT = range(20, 28); H.diveA = H.orbit + (chance(0.5) ? 1 : -1) * range(1.3, 2.2); g.events.push({ type: 'heliDive' }); }
      }
      this._weapons(dt);
    }
    if (H.phase === 'dive') {
      // under the roof line, round the tower, up again somewhere else
      const a = lerp(H.orbit, H.diveA, clamp(H.t / 5, 0, 1)), k = Math.sin(clamp(H.t / 5.6, 0, 1) * Math.PI);
      target.set(TC.x + Math.cos(a) * 66, R.y + 8 - k * 46, TC.z + Math.sin(a) * 66); maxV = 34; speedK = 1.3;
      if (H.t > 5.6) { H.phase = 'fight'; H.orbit = H.diveA; H.wpT = 0; }
    }
    if (H.phase === 'drop') { target.copy(HOVER); speedK = 0.9; maxV = 16; this._updDrop(dt); if (H.t > 3) this._gunOnly(dt); }
    if (H.phase === 'dying') {
      // it holds, burning and spinning, until you are looking (or 4 s); then it goes where it is going
      const goalP = river ? HILL : FACE;
      if (!H.commit) {
        g.camera.getWorldDirection(_v2); _v3.subVectors(H.pos, head).normalize();
        H.lookT = _v2.dot(_v3) > 0.78 ? H.lookT + dt : 0;
        if (H.lookT > 0.3 || H.t > 4 || g.auto) { H.commit = true; H.ct = 0; g.events.push({ type: 'heliCommit', mode: this.mode }); }
        target.copy(H.c0).add(_v3.set(Math.cos(H.t * 1.1) * 7, -H.t * 1.6, Math.sin(H.t * 1.1) * 7)); maxV = 12;
      } else {
        H.ct += dt;
        if (river) { target.copy(goalP); maxV = 46; speedK = 1.6; }
        else {
          // round the tower to its west side (never through it), then into the face under the parapet
          const a0 = Math.atan2(H.pos.z - TC.z, H.pos.x - TC.x); let da = Math.PI - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > 0.5) { const a = a0 + Math.sign(da) * 0.5; target.set(TC.x + Math.cos(a) * 50, R.y - 8, TC.z + Math.sin(a) * 50); } else target.copy(goalP);
          maxV = 34; speedK = 1.5;
        }
      }
      H.yaw += dt * (2.5 + H.t * 0.6);
      const p = m.smokePt.getWorldPosition(_v2);
      g.fx.trailEmit(H, p, 0.9, (q) => g.fx.smoke(q, 1.6, 0.1, 3.4, 0.75, 0.9), 0);
      if (rand() < dt * 14) g.fx.flame(p, range(1.2, 2));
      const d = H.pos.distanceTo(goalP);
      if ((H.commit && (d < 7 || (d < 26 && _v3.subVectors(goalP, H.pos).dot(H.vel) < 0))) || H.t > 20) { this._crash(goalP); return; }
    }
    _v2.subVectors(target, H.pos).multiplyScalar(speedK);
    if (_v2.length() > maxV) _v2.setLength(maxV);
    H.vel.lerp(_v2, 1 - Math.exp(-dt * 1.6));
    this._avoid(H, dt);
    H.pos.addScaledVector(H.vel, dt);
    if (H.phase !== 'dying') {
      const faceYaw = H.phase === 'drop' && H.pos.distanceTo(HOVER) < 12 ? -Math.PI / 2 : (H.phase === 'dive' && H.t > 1.8 && H.t < 4.6) ? Math.atan2(-H.vel.x, -H.vel.z) : Math.atan2(-(head.x - H.pos.x), -(head.z - H.pos.z));
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
    // rotor wash on the roof deck when it is low over it
    if (!river && H.pos.y - R.y < 30 && H.phase !== 'dying') {
      H.dustT = (H.dustT || 0) - dt;
      if (H.dustT <= 0) {
        H.dustT = 0.05;
        const a = 1 - (H.pos.y - R.y) / 30, ang = rand() * 6.28, r = range(2, 9);
        const x = H.pos.x + Math.cos(ang) * r, z = H.pos.z + Math.sin(ang) * r;
        if (onRoof(x, z)) g.fx.main.spawn({ x, y: R.y + 0.3, z, vx: Math.cos(ang) * range(6, 11), vz: Math.sin(ang) * range(6, 11), vy: range(0.3, 1.2), drag: 1.1, frame: CELL.DUST, s0: 1.5, s1: 6, life: 1.4, rot: rand() * 6, r: 0.5, g: 0.46, b: 0.42, a: 0.35 * a, fadeOut: 0.35 });
      }
    }
    this.spot.visible = H.phase !== 'dying' && H.alive;
    if (this.spot.visible) { m.lightPt.getWorldPosition(_v); this.spot.position.copy(_v); const tg = _v2.copy(H.aimAt || g.headPos); if (H.phase === 'rise' || H.burst <= 0) tg.copy(g.headPos).y -= 1.2; tg.y = Math.min(tg.y, _v.y - 2); _v3.subVectors(tg, _v).normalize(); this.spot.quaternion.setFromUnitVectors(_v.set(0, -1, 0), _v3); }
    const G = this.glowB, blink = Math.sin(g.time * 6) > 0.3;
    let gi = 0;
    if (H.phase !== 'dying') for (const [pt, col] of m.navLights) { if (col[3] && !blink) continue; pt.getWorldPosition(_v); G.set(gi++, _v.x, _v.y, _v.z, 1.3, 1.3, 0, CELL.GLOW, 0, col[0] * 1.4, col[1] * 1.4, col[2] * 1.4, 1); }
    if (H.phase !== 'dying') { m.lightPt.getWorldPosition(_v); G.set(gi++, _v.x, _v.y, _v.z, 3, 3, 0, CELL.GLOW, 0, 2.2, 2.0, 1.7, 0.9); }
    G.commit(gi);
  }
  // keep out of the tower / the crown (roof mode) and off the cliff road (river mode)
  _avoid(H, dt) {
    const p = H.pos;
    if (this.mode === 'river') {
      if (H.phase !== 'dying' && p.z > RIVER.z1 - 22) H.vel.z -= (p.z - (RIVER.z1 - 22)) * 5 * dt;
      if (p.y < Y - 40) H.vel.y = damp(H.vel.y, 8, 3, dt);
      return;
    }
    const hx = (TOWER.x1 - TOWER.x0) / 2 + 13, hz = (TOWER.z1 - TOWER.z0) / 2 + 13;
    const dx = p.x - TC.x, dz = p.z - TC.z;
    const top = H.phase === 'drop' ? R.y + 22 : R.y + 60, crash = H.phase === 'dying' && H.commit && p.distanceTo(FACE) < 40;
    if (!crash && Math.abs(dx) < hx && Math.abs(dz) < hz && p.y < top) { const ox = hx - Math.abs(dx), oz = hz - Math.abs(dz); if (ox < oz) H.vel.x += Math.sign(dx || 1) * ox * 6 * dt; else H.vel.z += Math.sign(dz || 1) * oz * 6 * dt; }
    if (p.y < R.y - 70) H.vel.y = damp(H.vel.y, 8, 3, dt);
  }
  _gunOnly(dt) { const H = this.H; H.rocketT = Math.max(H.rocketT, 1.5); this._weapons(dt, true); }
  _weapons(dt, gunOnly = false) {
    const g = this.g, H = this.H, m = this.m, head = g.headPos;
    H.rocketT -= dt; H.gunT -= dt;
    const hpFrac = H.hp / H.maxHp;
    if (!gunOnly && H.rocketT <= 0) {
      H.rocketT = range(3.8, 5.6) * (hpFrac < 0.5 ? 0.8 : 1);
      const pod = m.pods[Math.floor(rand() * 2)];
      const p = pod.getWorldPosition(new THREE.Vector3());
      // short of you: onto the deck / the road, the car beside you — big, loud, mostly survivable
      const aim = head.clone().add(_v.set(range(-6, 6), -1.6, range(-6, 6)));
      const dir = aim.clone().sub(p).normalize();
      this.rockets.push({ pos: p, vel: dir.multiplyScalar(44), life: 5 });
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
      tgt.y = floorAt(tgt.x, tgt.z) + range(-0.2, 0.6);
      tgt.x += range(-0.8, 0.8); tgt.z += range(-0.8, 0.8);
      this._gunRound(mz, tgt.clone());
    }
  }
  _gunRound(mz, tgt) {
    const g = this.g;
    (this.H.aimAt ||= new THREE.Vector3()).copy(tgt);
    _v.subVectors(tgt, mz).normalize();
    g.fx.muzzle(mz, _v, 'enemy', false);
    if (rand() < 0.4) g.fx.light(mz, 12, 0.05, 0xffb060, true, 12);
    g.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, pitch: 0.62, volume: 1 });
    const { end } = g._round(mz, tgt, null, { speed: 300, color: [2.0, 0.65, 0.28], width: 0.09, len: 6, carDmg: 2 });
    g.fx.later(mz.distanceTo(end) / 300, () => {
      g.fx.main.spawn({ x: end.x, y: end.y + 0.3, z: end.z, vy: range(2, 4), frame: CELL.DIRT, s0: 0.6, s1: 2.2, ease: 0.5, life: 0.9, rot: rand() * 6, r: 0.7, g: 0.68, b: 0.64, a: 0.85, fadeIn: 0.02, fadeOut: 0.3 });
      if (end.distanceTo(g.headPos) < 1.6 + (g.trailer ? -0.6 : 0)) g.hurt(6, end);
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
      const gy = floorAt(r.pos.x, r.pos.z);
      if (hit || r.pos.y < gy + 0.2 || r.life <= 0) {
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
      if (T.o.position.y < floorAt(T.o.position.x, T.o.position.z) + 0.8) { T.done = true; T.o.visible = false; g.fx.smallExplosion(T.o.position.clone(), 1.2); }
    }
  }
  // ---------------------------------------------------------------- the end of each bird
  _crash(I0) {
    const g = this.g, H = this.H, m = this.m, river = this.mode === 'river';
    H.phase = 'gone'; H.alive = false;
    g.audio.stopLoop('heli'); this.glowB.commit(0); this.spot.visible = false; for (const r of this.ropes) r.visible = false;
    const I = I0.clone();
    m.root.position.copy(I).add(river ? _v.set(0, 0, 2.5) : _v.set(-1.5, 0, 0)); m.root.rotation.set(0.45, river ? Math.PI * 0.85 : Math.PI * 0.5, 0.7);
    m.tilt.rotation.set(0, 0, 0);
    m.root.traverse(o => { if (o.isMesh && !o.material?.isShaderMaterial) o.material = Array.isArray(o.material) ? o.material.map(() => MAT.charred) : MAT.charred; });
    m.rotorBlur?.(0, true);
    m.rotor.visible = false; if (m.cone) m.cone.visible = false;
    const head = g.headPos, far = I.distanceTo(head);
    const out = river ? [0, 0, 1] : [-1, 0, 0];   // the face it hit looks this way
    g.fx.explosion(I.clone(), 5.0, { noRing: true });
    for (let k = 1; k <= 8; k++) g.fx.later(0.1 * k + rand() * 0.1, () => g.fx.explosion(I.clone().add(_v.set(range(-9, 9) * Math.abs(out[2]) + out[0] * range(0, 6), range(-12, 8), range(-9, 9) * Math.abs(out[0]) + out[2] * range(0, 6))), range(2.2, 3.4), { noRing: true }));
    g.fx.light(I, 2400, 2.0, 0xff9040, true, far + 60);
    g.lastExplosionT = g.time; g.lastExplosionShake = river ? 0.5 : 1.3;
    g.audio.play('explosion_big', { x: I.x, y: I.y, z: I.z, volume: 1 });
    g.audio.play('explosion_big', { volume: 0.55, pitch: 0.7 });   // it carries across the gorge
    g.audio.play('metal_crash', { x: I.x, y: I.y, z: I.z, volume: 1 });
    for (let k = 0; k < 90; k++) g.fx.sparks.spawn({ x: I.x + range(-6, 6), y: I.y + range(-4, 8), z: I.z + range(-6, 6), vx: out[0] * range(0, 9) + range(-9, 9) * Math.abs(out[2]), vy: range(-3, 8), vz: out[2] * range(0, 9) + range(-9, 9) * Math.abs(out[0]), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 2, w: 0.4, len: 1.4, life: range(2, 4), r: 2.6, g: 1.6, b: 0.6, a: 0.9, fadeOut: 0.5 });
    for (let k = 0; k < 24; k++) g.fx.spawnDebris(_v.set(I.x + range(-6, 6), I.y + range(-4, 6), I.z + range(-6, 6)), out[0] * range(2, 12) + range(-8, 8) * Math.abs(out[2]), range(0, 9), out[2] * range(2, 12) + range(-8, 8) * Math.abs(out[0]), range(0.5, 1.4), chance(0.4));
    g.glass.burst?.(I.clone().add(_v.set(out[0], 4, out[2])), new THREE.Vector3(out[0], 0.3, out[2]), 60, { spread: 9, speed: 7, size: 0.5, life: 10 });
    g.slowmo(2.2, 0.35, true);
    g.fx.main.bigBudget += 90; g.fx.later(5, () => { g.fx.main.bigBudget -= 90; });
    this.megaFireball(I.clone(), river ? 3.6 : 2.6, out);
    g.fx.later(0.3, () => this.megaFireball(I.clone().add(_v.set(range(-6, 6), 12, range(-6, 6))), river ? 2.6 : 2.0, out));
    g.events.push({ type: 'heliCrash', mode: this.mode, P: I.clone() });
    if (river) {
      this.wreck = this.sp.slide.attach(m.root, I);
      g.fx.later(1.6, () => !g.quietScore && g.addScore(1500, 'STRAIGHT INTO THE HILL!', head.clone().addScaledVector(g.playerFwd, 6).setY(head.y - 0.5), 'big'));
      g.fx.later(0.5, () => this.sp.landslide(false, 1));
    } else {
      // wedged in the west face, burning; it goes down with the tower
      this.sp.tw?.inner.attach(m.root);
      this.wreck = { world: (o) => m.root.getWorldPosition(o), t: 0 };
      g.fx.later(0.4, () => this.sp.towerHit(I));
    }
  }
  megaFireball(P, k = 1, out = [0, 0, 1]) {
    const g = this.g;
    g.fx.main.spawn({ x: P.x, y: P.y, z: P.z, frame: CELL.FLASH, s0: 16 * k, s1: 34 * k, life: 0.25, r: 2.2, g: 1.1, b: 0.4, a: 1, fadeIn: 0, fadeOut: 0.3, force: true });
    for (let i = 0; i < 12; i++) g.fx.later(i * 0.04, () => {
      const el = range(0.1, 1.2), sp = range(6, 16) * k, sd = range(-1, 1);
      g.fx.main.spawn({ x: P.x + range(-4, 4) * k, y: P.y + range(-2, 3) * k, z: P.z + range(-4, 4) * k, vx: (out[0] * Math.abs(sd) + out[2] * sd) * Math.cos(el) * sp, vy: Math.sin(el) * sp + 4, vz: (out[2] * Math.abs(sd) + out[0] * sd) * Math.cos(el) * sp, drag: 1.6, grav: 2, frameKind: 1, s0: range(9, 13) * k, s1: range(22, 32) * k, ease: 0.55, life: range(1.8, 2.6), rot: rand() * 6, vrot: range(-0.6, 0.6), r: 2.4, g: 1.25, b: 0.62, a: 1, fadeIn: 0.02, fadeOut: 0.8 });
    });
    for (let i = 0; i < 9; i++) g.fx.later(range(0.4, 1.3), () => g.clouds.spawn({ x: P.x + range(-8, 8) * k, y: P.y + range(3, 10) * k, z: P.z + range(-6, 6), vx: range(-2, 2) + out[0] * 2, vy: range(5, 9), vz: range(-2, 2) + out[2] * 2, drag: 0.45, buoy: 0.5, s0: 12 * k, s1: range(30, 42) * k, life: range(8, 11), a: 0.95, fadeIn: 0.08, fadeOut: 0.45, vrot: range(-0.12, 0.12), r: 0.07, g: 0.06, b: 0.055, r1: 0.15, g1: 0.13, b1: 0.115, glow: 1.2, glowFade: 2 }));
  }
  // the wreck burns where it is wedged (riding the hill's tower down the slope / the tower's face over the edge)
  _updWreck(dt) {
    const W = this.wreck; if (!W || W.done) return;
    const g = this.g;
    W.t = (W.t || 0) + dt;
    const p = W.world(_v);
    if (!p || p.y < -6 || W.t > 90) { W.done = true; this.m.root.visible = false; return; }
    if (p.distanceTo(g.headPos) > 420) return;
    if (rand() < dt * 22) g.fx.flame(_v2.set(p.x + range(-3, 3), p.y + range(-2, 3), p.z + range(-3, 3)), range(3, 5));
    if (rand() < dt * 2.2) g.clouds.spawn({ x: p.x + range(-2, 2), y: p.y + 4, z: p.z + range(-2, 2), vx: range(-1, 1), vy: range(4, 7), vz: range(-1, 1), drag: 0.25, buoy: 0.4, s0: 5, s1: range(22, 30), life: range(8, 11), a: 0.9, fadeIn: 0.05, fadeOut: 0.5, r: 0.05, g: 0.045, b: 0.04, r1: 0.11, g1: 0.1, b1: 0.09, glow: 1.8, glowFade: 3 });
  }
}
