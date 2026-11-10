import * as THREE from 'three';
import { rand, range, clamp } from '../../rng.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../../particles.js';
import { buildHammer, heliMaterials } from './helimodel.js';

// =====================================================================================
//  SAND CASTLES — the close threats. The rooftop squads are 100 m below the door; these come to you:
//   • DRONES: one-way attack drones in swarms of 3–6, out of the haze on the door side, weaving in at
//     the cabin. A third aim true (shoot them or eat 12 damage), the rest scream past the door at
//     8–20 m. Three rounds each; a dying drone's blast takes out its neighbours (swarm chains).
//   • VIPERS: enemy attack helicopters (the HAMMER airframe in charcoal) that make strafing passes
//     across the door at 40–70 m, nose gun + rocket pods, then swing wide and come round again.
//   • BOOM: fuel depots and parked helicopters on the fight roofs, and a fuel-tanker convoy on the
//     street inside the strike loop. Shoot one: it goes up, takes the squad round it with it, and
//     sets off anything explosive close by (chains, with a beat between links).
//  Everything is instanced or pooled: drones 1 draw, depots 1 draw, tankers 1 draw; each Viper /
//  parked heli is a HAMMER (5 draws), never more than 2 Vipers up at once.
// =====================================================================================

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const MAX_DRONES = 14, MAX_DEPOTS = 24, MAX_TANKERS = 6;

function colorize(g, c) {
  g = g.index ? g.toNonIndexed() : g;
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
const mat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.2 });

// a delta-wing one-way attack drone, ~3.5 m long, nose -z (built 1.5x so it reads against the haze)
function droneGeo() {
  const tan = [0.42, 0.4, 0.35], dark = [0.12, 0.12, 0.12], red = [0.5, 0.06, 0.04];
  const parts = [];
  parts.push(colorize(new THREE.CylinderGeometry(0.2, 0.24, 2.6, 8).rotateX(Math.PI / 2), tan));
  parts.push(colorize(new THREE.ConeGeometry(0.2, 0.7, 8).rotateX(-Math.PI / 2).translate(0, 0, -1.65), dark));
  const sh = new THREE.Shape(); sh.moveTo(0, -0.6); sh.lineTo(1.7, 1.25); sh.lineTo(-1.7, 1.25); sh.lineTo(0, -0.6);
  parts.push(colorize(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.03, 0), tan));
  for (const sx of [-1.65, 1.65]) parts.push(colorize(new THREE.BoxGeometry(0.05, 0.55, 0.5).translate(sx, 0.25, 1.05), dark));
  parts.push(colorize(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10).rotateX(Math.PI / 2).translate(0, 0, 1.35), dark)); // the pusher prop disc
  parts.push(colorize(new THREE.BoxGeometry(0.42, 0.04, 0.2).translate(0, 0.21, -0.6), red));
  return mergeGeometries(parts).scale(1.5, 1.5, 1.5);
}
// a rooftop fuel depot: a white bulk tank on saddles with a red band, a cluster of red drums (1.5x)
function depotGeo() {
  const white = [0.72, 0.71, 0.66], red = [0.52, 0.07, 0.05], grey = [0.22, 0.22, 0.21];
  const p = [];
  p.push(colorize(new THREE.CylinderGeometry(1.3, 1.3, 6, 16).rotateZ(Math.PI / 2).translate(0, 1.75, 0), white));
  p.push(colorize(new THREE.CylinderGeometry(1.34, 1.34, 0.5, 16).rotateZ(Math.PI / 2).translate(0, 1.75, 0), red));
  for (const sx of [-2, 2]) p.push(colorize(new THREE.BoxGeometry(0.4, 0.8, 2.2).translate(sx, 0.4, 0), grey));
  for (const [dx, dz] of [[-1.2, 2.3], [-0.4, 2.6], [0.5, 2.25], [1.3, 2.6], [-0.8, 3.2]]) p.push(colorize(new THREE.CylinderGeometry(0.36, 0.36, 0.95, 10).translate(dx, 0.48, dz), red));
  return mergeGeometries(p).scale(1.5, 1.5, 1.5);
}
// a fuel tanker truck (cab + chassis + tank + wheels), nose -z, ~12 m long (1.3x)
function tankerGeo() {
  const cab = [0.62, 0.6, 0.52], silver = [0.6, 0.6, 0.6], dark = [0.08, 0.08, 0.08], glass = [0.05, 0.07, 0.08];
  const p = [];
  p.push(colorize(new THREE.BoxGeometry(2.5, 2.4, 2.4).translate(0, 2.0, -3.9), cab));
  p.push(colorize(new THREE.BoxGeometry(2.3, 0.8, 0.1).translate(0, 2.6, -5.12), glass));
  p.push(colorize(new THREE.BoxGeometry(2.2, 0.5, 9.5).translate(0, 0.95, 0.4), dark));
  p.push(colorize(new THREE.CylinderGeometry(1.25, 1.25, 7.4, 16).rotateX(Math.PI / 2).translate(0, 2.4, 1.3), silver));
  p.push(colorize(new THREE.CylinderGeometry(1.0, 1.25, 0.4, 16).rotateX(Math.PI / 2).translate(0, 2.4, 5.2), silver));
  for (const z of [-3.9, 1.5, 3.6]) for (const sx of [-1.15, 1.15]) p.push(colorize(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 12).rotateZ(Math.PI / 2).translate(sx, 0.55, z), dark));
  return mergeGeometries(p).scale(1.3, 1.3, 1.3);
}
// ray vs oriented box (box in the matrix's local frame, half extents `half`)
function rayOBB(o, d, M, half) {
  _inv.copy(M).invert();
  const ro = _v3.copy(o).applyMatrix4(_inv), rd = _v2.copy(d).transformDirection(_inv);
  let t0 = -Infinity, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    const oo = ro.getComponent(a), dd = rd.getComponent(a), h = half.getComponent(a);
    if (Math.abs(dd) < 1e-8) { if (oo < -h || oo > h) return -1; continue; }
    let ta = (-h - oo) / dd, tb = (h - oo) / dd; if (ta > tb) { const q = ta; ta = tb; tb = q; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
  }
  if (t1 < 0) return -1;
  return t0 > 0 ? t0 : t1;
}
function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r, h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}

export class Threats {
  constructor(g) {
    this.g = g;
    const scene = g.scene;
    this.drones = []; this.vipers = []; this.depots = []; this.parked = []; this.tankers = [];
    this.pending = []; this.dpend = []; // chain links waiting their beat (fuel / drones)
    this.down = { drones: 0, vipers: 0, booms: 0 };
    this.dMesh = new THREE.InstancedMesh(droneGeo(), mat(), MAX_DRONES); this.dMesh.frustumCulled = false;
    this.pMesh = new THREE.InstancedMesh(depotGeo(), mat(), MAX_DEPOTS); this.pMesh.frustumCulled = false;
    this.tMesh = new THREE.InstancedMesh(tankerGeo(), mat(), MAX_TANKERS); this.tMesh.frustumCulled = false;
    for (const M of [this.dMesh, this.pMesh, this.tMesh]) { for (let i = 0; i < M.count; i++) M.setMatrixAt(i, ZERO); M.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(M); }
    this.enemyMats = heliMaterials({ enemy: true });
    this._id = 0;
  }
  // things main.js should compile before gameplay
  warmObjects() { const h = buildHammer(this.enemyMats); h.root.position.set(0, -500, 0); return [this.dMesh, this.pMesh, this.tMesh, h.root]; }
  get active() { return this.drones.length + this.vipers.filter(v => v.phase !== 'gone').length; }
  clearAir() { for (const d of this.drones) this._dropDrone(d); this.drones = []; for (const v of this.vipers) if (v.phase !== 'gone') this._removeViper(v); }

  // ------------------------------------------------------------------ DRONES
  // a swarm out of the door side, `ahead` m forward, `out` m out, staggered `gap` s apart
  spawnSwarm(n, { ahead = 300, out = 400, gap = 0.45, trueFrac = 0.34 } = {}) { // ~35° ahead of the door's line: in the opening, clear of the cockpit
    const g = this.g, H = g.heliPos, f = this._cabinFrame();
    const free = []; for (let i = 0; i < MAX_DRONES; i++) if (!this.drones.some(d => d.slot === i)) free.push(i);
    n = Math.min(n, free.length);
    for (let i = 0; i < n; i++) {
      const pos = H.clone().addScaledVector(f.fwd, ahead + range(-60, 60) + i * 18).addScaledVector(f.left, out + range(-70, 70)).add(_v.set(0, range(-15, 45), 0));
      const onTarget = rand() < trueFrac * g.enemyAcc;
      // the miss, in the heli's frame (x = forward, y = up, z = out of the door): always out on the door side
      // (above / ahead / below the door, never across the cabin), so it screams past where you can see it
      const miss = onTarget ? new THREE.Vector3(range(-1, 1), range(-0.5, 0.5), range(1, 2)) : new THREE.Vector3(range(-10, 12), range(-6, 12), range(7, 18));
      this.drones.push({ slot: free[i], id: ++this._id, pos, vel: _v.subVectors(H, pos).normalize().multiplyScalar(30).clone(), hp: 3, t: -i * gap, miss, passed: false, whiz: false, speed: range(46, 56), weave: rand() * 6.28 });
    }
    if (n) g.events.push({ type: 'swarm', n });
    return n;
  }
  _dropDrone(d) { this.dMesh.setMatrixAt(d.slot, ZERO); this.dMesh.instanceMatrix.needsUpdate = true; this.g.audio.stopLoop('forklift:d' + d.id); d.dead = true; }
  _killDrone(d, how) {
    if (d.dead) return;
    const g = this.g, P = d.pos.clone();
    this._dropDrone(d);
    g.fx.explosion(P, 0.75, { noRing: true });
    for (let k = 0; k < 4; k++) g.fx.spawnDebris(P, d.vel.x * 0.4 + range(-8, 8), range(-2, 8), d.vel.z * 0.4 + range(-8, 8), 0.5, k < 2);
    g.lastExplosionT = g.time; g.lastExplosionShake = Math.min(0.6, 18 / Math.max(10, P.distanceTo(g.headPos)));
    if (how === 'shot') { this.down.drones++; g.addScore(200, 'DRONE DOWN', P.clone().setY(P.y + 3), 'small'); g.events.push({ type: 'droneDown' }); }
    // a swarm flies tight: the blast takes its neighbours
    this.blast(P, 9, 3, 0.12);
  }
  _updateDrones(dt) {
    const g = this.g, H = g.headPos, vH = g.W.rail.vel || _v2.set(0, 0, 0);
    for (const d of this.drones) {
      if (d.dead) continue;
      d.t += dt;
      if (d.t < 0) { this.dMesh.setMatrixAt(d.slot, ZERO); continue; }
      const toH = _v.subVectors(H, d.pos), dist = toH.length();
      if (!d.passed) {
        // lead the heli, weave, aim through the miss point
        const lead = Math.min(4, dist / d.speed);
        const f = this._cabinFrame();
        const aim = _v2.copy(H).addScaledVector(vH, lead).addScaledVector(f.fwd, d.miss.x).addScaledVector(f.left, d.miss.z).add(_v3.set(0, d.miss.y, 0));
        aim.x += Math.sin(d.t * 2.2 + d.weave) * Math.min(14, dist * 0.05); aim.y += Math.cos(d.t * 1.7 + d.weave) * Math.min(8, dist * 0.03);
        const want = aim.sub(d.pos).normalize().multiplyScalar(d.speed);
        d.vel.lerp(want, Math.min(1, dt * (dist < 120 ? 3.5 : 1.6)));
        if (dist < 5.5) { // into the door frame: it goes off just outside the opening
          d.pos.copy(H).addScaledVector(toH.normalize(), -4);
          this._killDrone(d, 'hit');
          g.hurt(12, d.pos); g.haptic(1, 200); g.events.push({ type: 'heliHit', src: 'drone' });
          g.W.cabin.U.uWarn.value = 1; g.audio.play('warn_tone', {}); g.fx.later(2.5, () => { g.W.cabin.U.uWarn.value = 0; });
          continue;
        }
        if (toH.dot(d.vel) < 0 && dist < 60) d.passed = true;
      } else {
        // past the door: it pulls up and away on the door side (you watch it go; it never crosses behind the cabin)
        const f = this._cabinFrame();
        const want = _v2.copy(f.left).multiplyScalar(0.75).addScaledVector(f.fwd, 0.3).add(_v3.set(0, 0.45, 0)).normalize().multiplyScalar(d.speed);
        d.vel.lerp(want, Math.min(1, dt * 1.4));
      }
      d.pos.addScaledVector(d.vel, dt);
      if (dist < 28 && !d.whiz) { d.whiz = true; g.audio.play('whiz', { x: d.pos.x, y: d.pos.y, z: d.pos.z, volume: 1, pitch: 0.75 }); }
      // into a tower / the ground, or gone into the haze behind you
      const tw = g.towerRay(d.pos, _v3.copy(d.vel).normalize(), d.vel.length() * dt + 0.5);
      if (tw || d.pos.y < 1) { this._killDrone(d, 'crash'); continue; }
      if ((d.passed && dist > 500) || d.t > 30) { this._dropDrone(d); continue; }
      _q.setFromRotationMatrix(_m.lookAt(d.pos, _v.copy(d.pos).add(d.vel), _v2.set(0, 1, 0))); // -z (the nose) along the velocity
      _q.multiply(_q.clone().setFromEuler(_e.set(0, 0, Math.sin(d.t * 2.2 + d.weave) * 0.5)));
      this.dMesh.setMatrixAt(d.slot, _m.compose(d.pos, _q, _s.set(1, 1, 1)));
      // the engine: a hot point at the tail (so a swarm reads at 400 m) and its whine
      const tail = _v.copy(d.vel).normalize().multiplyScalar(-2.4).add(d.pos);
      g.fx.main.spawn({ x: tail.x, y: tail.y, z: tail.z, frame: CELL.FLASH, s0: 0.9 + dist * 0.004, s1: 0.5, life: 0.05, r: 2.0, g: 1.1, b: 0.45, a: 1 });
      g.audio.setLoop('forklift:d' + d.id, { x: d.pos.x, y: d.pos.y, z: d.pos.z, volume: 0.9, intensity: 1 });
    }
    this.drones = this.drones.filter(d => !d.dead);
    this.dMesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ VIPERS
  spawnViper({ side = 1, delay = 0 } = {}) {
    if (this.vipers.filter(v => v.phase !== 'gone').length >= 2) return null;
    const g = this.g, H = g.heliPos, f = this._cabinFrame();
    const m = buildHammer(this.enemyMats);
    g.scene.add(m.root);
    const pos = H.clone().addScaledVector(f.fwd, 650).addScaledVector(f.left, 380 * side).add(_v.set(0, 50, 0));
    const v = { m, id: ++this._id, pos, vel: f.fwd.clone().multiplyScalar(-30), yaw: 0, hp: 70, maxHp: 70, phase: delay > 0 ? 'wait' : 'pass', t: -delay, passX: 260, lat: range(45, 70), up: range(-6, 18), gunT: 1.5, burst: 0, rocketT: range(2, 4), hit: 0, spin: 0, side };
    m.root.visible = delay <= 0; m.root.position.copy(pos);
    this.vipers.push(v);
    return v;
  }
  _removeViper(v) { v.phase = 'gone'; v.m.root.visible = false; this.g.scene.remove(v.m.root); this.g.audio.stopLoop('heli:v' + v.id); }
  _killViper(v) {
    if (v.phase === 'dying' || v.phase === 'gone') return;
    const g = this.g;
    v.phase = 'dying'; v.t = 0; v.spin = 0.8;
    g.fx.explosion(v.pos.clone().add(_v.set(0, 2, 4)), 1.2, { noRing: true });
    g.audio.play('metal_crash', { x: v.pos.x, y: v.pos.y, z: v.pos.z });
    g.slowmoReq(1.3, 0.35);
    this.down.vipers++;
    g.addScore(1500, 'VIPER DOWN!', g.calloutAt(v.pos), 'huge');
    g.events.push({ type: 'viperDown' });
  }
  _viperMatrix(v) { v.m.root.updateMatrixWorld(); return _m.copy(v.m.root.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(0, 1.6, 1.8)); }
  // the cabin's own frame (rail yaw, crab included): the door is where the pilot has turned it, not the path's left
  _cabinFrame() { const y = this.g.W.rail.yaw; return { fwd: new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y)), left: new THREE.Vector3(-Math.cos(y), 0, Math.sin(y)) }; }
  _updateVipers(dt) {
    const g = this.g, H = g.heliPos, f = this._cabinFrame();
    for (const v of this.vipers) {
      if (v.phase === 'gone') continue;
      v.t += dt;
      const m = v.m;
      if (v.phase === 'wait') { if (v.t >= 0) { v.phase = 'pass'; m.root.visible = true; } else continue; }
      if (v.phase === 'pass' || v.phase === 'wide') {
        // a strafing run: a station that slides from ahead of the door to behind it at ~30 m/s relative,
        // 45–70 m out; then swing wide (250 m out) and come round ahead for the next pass
        if (v.phase === 'pass') { v.passX -= dt * 30; if (v.passX < -200) { v.phase = 'wide'; v.wideT = 0; } }
        else { v.wideT += dt; v.passX = 300; if (v.wideT > 7) { v.phase = 'pass'; v.lat = range(42, 70); v.up = range(-8, 20); } }
        const lat = v.phase === 'wide' ? 260 : v.lat;
        const want = _v.copy(H).addScaledVector(f.fwd, v.passX).addScaledVector(f.left, lat * v.side).add(_v2.set(0, v.phase === 'wide' ? 40 : v.up, 0));
        // track the station's own velocity too (the heli's, plus the slide), or it lags ~60 m and swings across the cabin
        const wantVel = _v3.copy(g.W.rail.vel || _v3.set(0, 0, 0)).addScaledVector(f.fwd, v.phase === 'pass' ? -30 : 0);
        const acc = _v2.subVectors(want, v.pos).multiplyScalar(0.55).add(wantVel.sub(v.vel).multiplyScalar(1.1));
        // and never across: inside 30 m of the cabin's door-side plane, push it back out
        const outD = _v3.subVectors(v.pos, H).dot(f.left) * v.side;
        if (outD < 30) acc.addScaledVector(f.left, (30 - outD) * 1.5 * v.side);
        if (acc.length() > 18) acc.setLength(18);
        v.vel.addScaledVector(acc, dt); v.pos.addScaledVector(v.vel, dt);
        const toH = _v.subVectors(H, v.pos), dist = toH.length();
        const strafing = v.phase === 'pass' && v.passX > -60 && dist < 260;
        const face = strafing ? Math.atan2(-toH.x, -toH.z) : Math.atan2(-v.vel.x, -v.vel.z);
        let dy = face - v.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        v.yaw += dy * Math.min(1, dt * 2.4);
        const side = v.vel.dot(_v2.set(Math.cos(v.yaw), 0, -Math.sin(v.yaw))), fwdv = v.vel.dot(_v3.set(-Math.sin(v.yaw), 0, -Math.cos(v.yaw)));
        m.root.position.copy(v.pos); m.root.rotation.set(clamp(-fwdv * 0.008, -0.35, 0.35), v.yaw, clamp(-side * 0.014, -0.6, 0.6), 'YXZ');
        if (strafing && !g.ceasefire) {
          v.gunT -= dt;
          if (v.gunT <= 0) {
            if (v.burst <= 0) v.burst = 10;
            v.burst--; v.gunT = v.burst > 0 ? 0.08 : range(1.4, 2.4);
            const mz = _v2.set(0, 0.9, -6.4).applyMatrix4(m.root.matrixWorld).clone();
            const hit = rand() < 0.07 * g.enemyAcc;
            const aim = _v.copy(g.headPos).add(_v3.set(range(-1, 1), range(-1, 1), range(-1, 1)).multiplyScalar(hit ? 0.4 : range(2.5, 8)));
            g.fx.tracer(mz, aim.clone().addScaledVector(_v3.subVectors(aim, mz).normalize(), hit ? 0 : 50), { speed: 460, width: 0.2, len: 6, color: [2.0, 0.55, 0.18] });
            g.fx.muzzle(mz, _v3.subVectors(aim, mz).normalize(), 'rifle', false);
            if (v.burst % 2 === 0) g.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, volume: 1, pitch: 0.8 });
            if (hit) g.hurt(3, mz);
          }
          v.rocketT -= dt;
          if (v.rocketT <= 0) { v.rocketT = range(5, 8); const pod = _v2.set(rand() < 0.5 ? -2.4 : 2.4, 1.0, -0.6).applyMatrix4(m.root.matrixWorld).clone(); g.fireRocket(pod, 'gunship'); }
        }
        v.hit *= Math.exp(-dt * 6);
        if (v.hp < v.maxHp * 0.5) g.fx.trailEmit(v, _v2.set(0.8, 2.6, 1.5).applyMatrix4(m.root.matrixWorld), 0.7, (q) => g.fx.smoke(q, 2.6, 0.17, 3, 1, 0.5), 0);
        m.update(dt, 1);
        g.audio.setLoop('heli:v' + v.id, { x: v.pos.x, y: v.pos.y, z: v.pos.z, volume: 1, intensity: 0.9 });
      } else if (v.phase === 'dying') {
        // spins down trailing fire into the roofs / the street
        v.vel.y -= 9.8 * 0.6 * dt; v.vel.multiplyScalar(Math.exp(-dt * 0.2));
        v.pos.addScaledVector(v.vel, dt);
        v.spin = Math.min(5, v.spin + dt * 2.6); v.yaw += v.spin * dt;
        m.root.position.copy(v.pos); m.root.rotation.set(0.25 + v.t * 0.05, v.yaw, 0.35 * Math.sin(v.t * 3), 'YXZ');
        g.fx.trailEmit(v, _v2.set(0, 2.2, 6).applyMatrix4(m.root.matrixWorld), 1.4, (q) => { g.fx.smoke(q, 2.4, 0.08, 4.5, 1.2, 0.85); g.fx.flame(q, 1.3); }, 0);
        m.update(dt, Math.max(0.3, 1 - v.t * 0.2));
        g.audio.setLoop('heli:v' + v.id, { x: v.pos.x, y: v.pos.y, z: v.pos.z, volume: 0.9, intensity: 1 });
        const tw = g.towerRay(v.pos, _v.copy(v.vel).normalize(), v.vel.length() * dt + 2);
        if (tw || v.pos.y < 2 || v.t > 12) {
          const P = v.pos.clone();
          this._removeViper(v);
          g.fx.explosion(P, 1.8); g.fx.later(0.18, () => g.fx.explosion(P.clone().add(_v.set(5, 2, -3)), 1.5, { noRing: true }));
          for (let k = 0; k < 6; k++) g.fx.spawnDebris(P, range(-14, 14), range(4, 14), range(-14, 14), 1.2, true);
          g.lastExplosionT = g.time; g.lastExplosionShake = 0.5;
          this.blast(P, 16, 99, 0.2);
          g.events.push({ type: 'viperCrash', p: P });
        }
      }
    }
    this.vipers = this.vipers.filter(v => v.phase !== 'gone' || v.m.root.parent);
  }

  // ------------------------------------------------------------------ BOOM: depots, parked helis, tankers
  // fuel depots on a roof, on the edge facing `from` (the route), spread round it
  addDepots(tower, n = 2, from = null, rK = 0.3) {
    const g = this.g, inner = g.W.city.roofs.get(tower)?.inner ?? Math.min(tower.w, tower.d) * 0.8;
    const H = from || g.heliPos, base = Math.atan2(H.z - tower.z, H.x - tower.x);
    const out = [];
    for (let i = 0; i < n; i++) {
      const slot = this.depots.length; if (slot >= MAX_DEPOTS) break;
      const a = base + (i - (n - 1) / 2) * 0.9 + 0.45, r = inner * rK;
      const p = new THREE.Vector3(tower.x + Math.cos(a) * r, tower.h, tower.z + Math.sin(a) * r);
      const yaw = a + Math.PI / 2;
      this.pMesh.setMatrixAt(slot, _m.compose(p, _q.setFromAxisAngle(_v.set(0, 1, 0), -yaw), _s.set(1, 1, 1)));
      const d = { kind: 'depot', slot, tower, pos: p, center: p.clone().setY(p.y + 2.6), hp: 10, alive: true, r: 5.5, power: 1.6 };
      this.depots.push(d); out.push(d);
    }
    this.pMesh.instanceMatrix.needsUpdate = true;
    return out;
  }
  // an enemy helicopter parked on a helipad roof, blades turning slowly
  addParked(tower, from = null) {
    const g = this.g, m = buildHammer(this.enemyMats);
    const inner = g.W.city.roofs.get(tower)?.inner ?? Math.min(tower.w, tower.d) * 0.8;
    // on the pad, set back from the route-side edge (the squad and the fuel are on that edge)
    const H = from || g.heliPos, base = Math.atan2(H.z - tower.z, H.x - tower.x);
    const p = new THREE.Vector3(tower.x - Math.cos(base) * inner * 0.1, tower.h + 0.2, tower.z - Math.sin(base) * inner * 0.1);
    m.root.position.copy(p); m.root.rotation.y = -base;
    g.scene.add(m.root);
    const d = { kind: 'parked', m, tower, pos: p, center: p.clone().setY(p.y + 2), hp: 16, alive: true, r: 8, power: 1.9 };
    this.parked.push(d);
    return d;
  }
  // a tanker convoy driving a straight street from a to b (n trucks, `gap` m apart)
  addConvoy(a, b, n = 4, { speed = 13, gap = 26 } = {}) {
    const dir = new THREE.Vector3().subVectors(b, a).setY(0).normalize(), len = a.distanceTo(b);
    // all on the street from the start (nothing pops in), the lead truck first; at the end of the street they queue up
    for (let i = 0; i < n; i++) {
      const slot = this.tankers.length; if (slot >= MAX_TANKERS) break;
      this.tankers.push({ kind: 'tanker', slot, a: a.clone(), dir, len, s: (n - 1 - i) * gap, maxS: len - i * gap, speed, pos: a.clone(), center: a.clone(), hp: 8, alive: true, r: 7.5, power: 2.2, id: ++this._id });
    }
  }
  _updateBoom(dt) {
    const g = this.g;
    for (const p of this.parked) if (p.alive) p.m.update(dt, 0.25);
    for (const t of this.tankers) {
      if (!t.alive) continue;
      t.s = Math.min(t.maxS, t.s + t.speed * dt);
      t.pos.copy(t.a).addScaledVector(t.dir, t.s); t.center.copy(t.pos).setY(2.4);
      this.tMesh.setMatrixAt(t.slot, _m.compose(t.pos, _q.setFromAxisAngle(_v.set(0, 1, 0), Math.atan2(-t.dir.x, -t.dir.z)), _s.set(1, 1, 1)));
      if (t.slot === 0) g.audio.setLoop('suv:convoy', { x: t.pos.x, y: 2, z: t.pos.z, volume: 0.8, intensity: 0.7 });
    }
    this.tMesh.instanceMatrix.needsUpdate = true;
    // chain links waiting their beat
    for (const q of this.pending) { q.t -= dt; if (q.t <= 0) this._detonate(q.o); }
    this.pending = this.pending.filter(q => q.t > 0);
    // burning wrecks
    for (const o of [...this.depots, ...this.parked, ...this.tankers]) {
      if (o.alive || !(o.burnT > 0)) continue;
      o.burnT -= dt; o.fireAcc = (o.fireAcc ?? 0) + dt;
      if (o.fireAcc > 0.12) { o.fireAcc = 0; g.fx.flame(_v.copy(o.center).add(_v2.set(range(-2, 2), range(-0.5, 1), range(-2, 2))), 2.6); if (rand() < 0.35) g.fx.smoke(_v.copy(o.center).setY(o.center.y + 3), 4, 0.08, 6, 4, 0.7); }
    }
  }
  _detonate(o) {
    if (!o.alive) return;
    const g = this.g, P = o.center.clone();
    o.alive = false; o.burnT = o.kind === 'tanker' ? 14 : 10;
    if (o.kind === 'depot') { this.pMesh.setMatrixAt(o.slot, ZERO); this.pMesh.instanceMatrix.needsUpdate = true; }
    if (o.kind === 'tanker') { this.tMesh.setMatrixAt(o.slot, ZERO); this.tMesh.instanceMatrix.needsUpdate = true; if (o.slot === 0) g.audio.stopLoop('suv:convoy'); }
    if (o.kind === 'parked') o.m.root.visible = false;
    // the fireball: a big blast, a second one up the column, burning debris thrown high
    g.fx.explosion(P, o.power);
    g.fx.later(0.12, () => g.fx.explosion(P.clone().add(_v.set(range(-3, 3), 4 + o.power * 2, range(-3, 3))), o.power * 0.85, { noRing: true }));
    for (let k = 0; k < 7; k++) g.fx.spawnDebris(P, range(-16, 16), range(8, 24), range(-16, 16), o.kind === 'tanker' ? 1.4 : 1.0, k < 4);
    for (let k = 0; k < 5; k++) g.fx.smoke(_v.copy(P).add(_v2.set(range(-4, 4), 4 + k * 3, range(-4, 4))), 6 + k * 2, 0.07, 8, 5, 0.85);
    g.fx.scorchAt?.(P.x, P.z, 9, o.kind === 'tanker' ? 0 : o.tower.h);
    g.lastExplosionT = g.time; g.lastExplosionShake = Math.min(0.9, 40 / Math.max(20, P.distanceTo(g.headPos)));
    // chains count up in the callout
    const now = g.time; this.chainN = now - (this.chainT ?? -9) < 2.5 ? (this.chainN || 1) + 1 : 1; this.chainT = now;
    this.down.booms++;
    const label = this.chainN > 1 ? `CHAIN x${this.chainN}!` : o.kind === 'tanker' ? 'TANKER!' : o.kind === 'parked' ? 'GROUNDED!' : 'KABOOM!';
    g.addScore(o.kind === 'parked' ? 800 : 400, label, P.clone().setY(P.y + 10), this.chainN > 2 ? 'huge' : 'big');
    g.events.push({ type: 'boom', o, chain: this.chainN });
    this.blast(P, o.kind === 'tanker' ? 30 : 18, 99, 0.3);
  }
  // blast damage round P: gunmen (thrown), AA guns, drones, Vipers, and the next fuel along (a beat later)
  blast(P, R, dmg, chainDelay = 0.3) {
    const g = this.g;
    for (const m of g.men) if (m.alive && m.delay <= 0) { const d = m.pos.distanceTo(P); if (d < R * 0.8) g.killMan(m, _v.subVectors(m.pos, P).setY(Math.max(2, d * 0.3)).normalize(), false); }
    for (const a of g.aas) if (a.alive && a.center.distanceTo(P) < R * 0.7) { a.hp -= 60; if (a.hp <= 0) g.killAA(a, 'boom'); }
    for (const d of this.drones) if (!d.dead && d.t >= 0 && d.pos.distanceTo(P) < R && d.pos.distanceTo(P) > 0.5) { d.hp -= dmg; if (d.hp <= 0 && !d.queued) { d.queued = true; this.dpend.push({ t: chainDelay * 0.5, d }); } }
    for (const v of this.vipers) if ((v.phase === 'pass' || v.phase === 'wide') && v.pos.distanceTo(P) < R + 6) { v.hp -= dmg * 0.5; if (v.hp <= 0) this._killViper(v); }
    for (const o of [...this.depots, ...this.parked, ...this.tankers]) {
      if (!o.alive || o.queued) continue;
      const d = o.center.distanceTo(P);
      if (d < R + o.r && d > 0.5) { o.queued = true; this.pending.push({ t: chainDelay + range(0, 0.15), o }); }
    }
  }

  // ------------------------------------------------------------------ hit tests (the door gun / grenades)
  ray(origin, dir, best) {
    const g = this.g;
    for (const d of this.drones) {
      if (d.dead || d.t < 0) continue;
      const t = raySphere(origin, dir, d.pos, 2.2 + d.pos.distanceTo(origin) * 0.005);
      if (t > 0 && t < best.t) best = { t, kind: 'threat', o: d, sub: 'drone' };
    }
    for (const v of this.vipers) {
      if (v.phase !== 'pass' && v.phase !== 'wide') continue;
      const k = 1 + v.pos.distanceTo(origin) * 0.003;
      const t = rayOBB(origin, dir, this._viperMatrix(v), _v.set(2.0 * k, 1.8 * k, 8.8));
      if (t > 0 && t < best.t) best = { t, kind: 'threat', o: v, sub: 'viper' };
    }
    for (const o of [...this.depots, ...this.parked, ...this.tankers]) {
      if (!o.alive) continue;
      const t = raySphere(origin, dir, o.center, o.r + o.center.distanceTo(origin) * 0.004);
      if (t > 0 && t < best.t) best = { t, kind: 'threat', o, sub: o.kind };
    }
    return best;
  }
  shot(hit, dir, P) {
    const g = this.g, o = hit.o;
    if (hit.sub === 'drone') { o.hp -= 1; g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.hitMarker(o.hp <= 0); if (o.hp <= 0) this._killDrone(o, 'shot'); return; }
    if (hit.sub === 'viper') { o.hp -= 1.15 * g.dmgMul; o.hit = 1; g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.hitMarker(false); if (o.hp <= 0) this._killViper(o); return; }
    // fuel: sparks, a vapour puff, then it goes
    o.hp -= 1; g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.hitMarker(o.hp <= 0);
    if (o.hp <= 0) this._detonate(o);
  }
  nade(P) {
    for (const d of this.drones) if (!d.dead && d.t >= 0 && d.pos.distanceTo(P) < 10) this._killDrone(d, 'shot');
    for (const v of this.vipers) if ((v.phase === 'pass' || v.phase === 'wide') && v.pos.distanceTo(P) < 14) { v.hp -= 45; v.hit = 1; if (v.hp <= 0) this._killViper(v); }
    for (const o of [...this.depots, ...this.parked, ...this.tankers]) if (o.alive && o.center.distanceTo(P) < 8 + o.r) this._detonate(o);
  }
  // a grenade stops on a drone / Viper it flies into
  nadeHits(P) { return this.drones.some(d => !d.dead && d.t >= 0 && d.pos.distanceTo(P) < 4) || this.vipers.some(v => (v.phase === 'pass' || v.phase === 'wide') && v.pos.distanceTo(P) < 9); }

  // ------------------------------------------------------------------ autopilot / aim assist
  aimPoints(tryP) {
    for (const d of this.drones) if (!d.dead && d.t >= 0) tryP(d.pos);
    for (const v of this.vipers) if (v.phase === 'pass' || v.phase === 'wide') tryP(v.pos);
  }
  autoTargets(c, A, head) {
    for (const d of this.drones) { if (d.dead || d.t < 0 || d.passed) continue; const dd = d.pos.distanceTo(head); if (dd < 420 && dd > 10) c.push({ kind: 'drone', p: d.pos, score: 130 - dd * 0.2 + (d.miss.z < 3 ? 30 : 0) + (A.target?.ref === d ? 25 : 0), ref: d, tol: 0.04 }); }
    for (const v of this.vipers) if (v.phase === 'pass' || v.phase === 'wide') { const dd = v.pos.distanceTo(head); if (dd < 450) c.push({ kind: 'viper', p: v.pos, score: 95 - dd * 0.05 + (A.target?.ref === v ? 25 : 0), ref: v, tol: 0.07 }); }
    // fuel next to a live squad first (that's the fun), any fuel in range after the men; only what the door
    // opening can see (not a roof the heli has already passed over, behind the cabin wall)
    const L = this._cabinFrame().left;
    for (const o of [...this.depots, ...this.parked, ...this.tankers]) {
      if (!o.alive) continue;
      const dd = o.center.distanceTo(head); if (dd > 480) continue;
      if (_v.subVectors(o.center, head).setY(0).normalize().dot(L) < 0.15) continue;
      const near = this.g.men.some(m => m.alive && m.delay <= 0 && m.pos.distanceTo(o.center) < 14);
      c.push({ kind: 'boom', p: o.center, score: (near ? 95 : 40) - dd * 0.08 + (o.kind === 'tanker' ? 35 : 0) + (A.target?.ref === o ? 25 : 0), ref: o, tol: 0.05 });
    }
  }
  autoDead(t) {
    if (t.kind === 'drone') return t.ref.dead || t.ref.passed;
    if (t.kind === 'viper') return t.ref.phase !== 'pass' && t.ref.phase !== 'wide';
    if (t.kind === 'boom') return !t.ref.alive;
    return null;
  }

  update(dt) {
    this._updateDrones(dt);
    this._updateVipers(dt);
    // drones a neighbour's blast killed (queued so a swarm pops one after another)
    for (const q of this.dpend) { q.t -= dt; if (q.t <= 0) this._killDrone(q.d, 'shot'); }
    this.dpend = this.dpend.filter(q => q.t > 0);
    this._updateBoom(dt);
  }
}
