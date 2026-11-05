import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp } from '../../rng.js';
import { buildHeli } from '../../heli.js';
import { railPoints } from './layout.js';

// =====================================================================================
//  DOOR-GUNNER RAIL — the player rides a grey-box cabin around the city on a closed spline.
//  Level 1's rail idea (the vehicle carries the rig; the player never moves the head) on a
//  loop instead of a treadmill: a straight treadmill can't circle a collapsing skyline.
//  Comfort rules baked in:
//   - the cabin is a fixed frame: the rig is parented to it, every visual reference around
//     you (door frame, floor, skid, rotor) moves with you,
//   - speed changes are jerk-limited (the heli runs on REAL time, so world slow-mo never
//     yanks the cabin to a crawl),
//   - heading follows the path through a critically damped spring (no yaw-rate steps at
//     the spline knots), bank and pitch are capped (&bank / &pitch, 0 = horizon locked),
//   - code never moves the head: only the rig.
//  Comfort numbers (yaw rate, accelerations, bank) are tracked for the debug panel.
// =====================================================================================

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class HeliRail {
  constructor(E, F, game, towers = []) {
    this.E = E; this.F = F; this.g = game;
    this.curve = new THREE.CatmullRomCurve3(railPoints(F, towers).map(p => new THREE.Vector3(...p)), true, 'centripetal');
    // arc-length table at ~1 m (the default 200 divisions = 20 m chords: the speed steps a few % at every chord,
    // which is a real micro-stutter at 40 m/s, not just noise in the stats)
    this.curve.arcLengthDivisions = Math.ceil(this.curve.getLength());
    this.curve.updateArcLengths();
    this.L = this.curve.getLength();
    this.s = 0; this.v = F.speed; this.a = 0;
    this.yaw = 0; this.yawV = 0; this.bank = 0; this.bankV = 0; this.pitch = 0;
    this.root = new THREE.Group();
    this.root.add(buildCabin());
    E.scene.add(this.root);
    // the seat: by the open left door, facing out (heli forward = -z, left = -x)
    this.seat = new THREE.Object3D(); this.seat.position.set(-0.45, 0, 0.1); this.seat.rotation.y = Math.PI / 2;
    this.root.add(this.seat);
    this.rotor = this.root.getObjectByName('rotor');
    // stats
    this.st = { yawRate: 0, latA: 0, lonA: 0, vertA: 0, maxYawRate: 0, maxLat: 0, maxLon: 0, maxVert: 0, maxBank: 0, maxJerk: 0 };
    // escort: the WIDOWMAKER gunship (heli.js) flying alongside on the inside of the turn
    if (F.escort) {
      this.escort = buildHeli();
      this.escort.root.scale.setScalar(1.2);
      E.scene.add(this.escort.root);
    }
    const p0 = this.curve.getPointAt(0), t0 = this.curve.getTangentAt(0);
    this.yaw = Math.atan2(-t0.x, -t0.z);
    this.place(0);
  }
  // seconds into the loop -> place everything (real time dt)
  update(rdt) {
    const F = this.F;
    // speed profile: slower on the inner stretches (closer to the hero tower), faster on the outside
    const u = (this.s / this.L) % 1;
    const p = this.curve.getPointAt(u);
    const rIn = clamp((Math.hypot(p.x, p.z) - F.radius * 0.8) / (F.radius * 0.35), 0, 1);
    const vT = F.speed * (0.72 + 0.4 * rIn);
    // jerk-limited approach: accel moves toward what the speed error asks for at ≤ 0.6 m/s³, capped at 0.8 m/s²
    const aWant = clamp((vT - this.v) * 0.4, -0.8, 0.8);
    this.a += clamp(aWant - this.a, -0.6 * rdt, 0.6 * rdt);
    this.v = Math.max(3, this.v + this.a * rdt);
    this.s += this.v * rdt;
    this.place(rdt);
  }
  place(rdt) {
    const F = this.F, u = (this.s / this.L) % 1;
    const p = this.curve.getPointAt(u), t = this.curve.getTangentAt((u + 60 / this.L) % 1); // look 60 m ahead
    // heading spring (critically damped, ω = 1.1 rad/s): no yaw-rate steps where the spline curvature jumps
    let yT = Math.atan2(-t.x, -t.z), dy = yT - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    const w = 1.1;
    if (rdt > 0) { this.yawV += (dy * w * w - 2 * w * this.yawV) * rdt; this.yaw += this.yawV * rdt; }
    // bank into the turn: the coordinated-turn angle atan(v·ω/g), scaled down and capped for comfort
    const bankT = clamp(Math.atan(this.v * this.yawV / 9.8) * 0.45, -F.bank * Math.PI / 180, F.bank * Math.PI / 180);
    const wb = 1.4;
    if (rdt > 0) { this.bankV += ((bankT - this.bank) * wb * wb - 2 * wb * this.bankV) * rdt; this.bank += this.bankV * rdt; }
    const pitchT = clamp(-this.a * 0.03, -F.pitch * Math.PI / 180, F.pitch * Math.PI / 180);
    this.pitch += (pitchT - this.pitch) * Math.min(1, rdt * 1.5);
    this.root.position.copy(p);
    _e.set(this.pitch, this.yaw, this.bank, 'YXZ');
    this.root.quaternion.setFromEuler(_e);
    this.root.updateMatrixWorld(true);
    // the player's rig rides the seat
    const rig = this.E.rig;
    this.seat.getWorldPosition(rig.position);
    this.seat.getWorldQuaternion(rig.quaternion);
    rig.updateMatrixWorld(true);
    if (this.rotor) this.rotor.rotation.y += rdt * 24;
    if (this.escort) this._escort(rdt);
    if (rdt > 0) this._stats(rdt, p);
  }
  _escort(rdt) {
    const e = this.escort, u = ((this.s + 110) / this.L) % 1;
    const p = this.curve.getPointAt(u), t = this.curve.getTangentAt(u);
    const left = _v.set(-t.z, 0, t.x).negate(); // centre side (left of travel)
    // orbit: off the inside of the turn; low route: on the path ahead and above (beside us it would clip towers)
    const low = this.F.route === 'low';
    e.root.position.copy(p).addScaledVector(left, low ? 0 : 55).add(new THREE.Vector3(0, (low ? 28 : -18) + Math.sin(this.g.time * 0.4) * 4, 0));
    e.root.rotation.set(0.06, Math.atan2(-t.x, -t.z), this.bank * 1.5, 'YXZ');
    if (e.rotor) e.rotor.rotation.y += rdt * 26;
    if (e.tailRotor) e.tailRotor.rotation.x += rdt * 60;
    const ep = e.root.position;
    this.g.audio.setLoop('heli:escort', { x: ep.x, y: ep.y, z: ep.z, volume: 0.7, intensity: 0.8 });
  }
  _stats(rdt, p) {
    // analytic, in the heli's frame: longitudinal = the speed controller, lateral = v × heading rate,
    // vertical = the path's height curvature × v² + slope × a (finite differences of positions are too noisy)
    const S = this.st, u = (this.s / this.L) % 1, ds = 15 / this.L;
    const y0 = this.curve.getPointAt((u - ds + 1) % 1).y, y1 = p.y, y2 = this.curve.getPointAt((u + ds) % 1).y;
    const dyds = (y2 - y0) / 30, d2y = (y2 - 2 * y1 + y0) / (15 * 15);
    const lon = this.a, lat = this.v * this.yawV, vert = d2y * this.v * this.v + dyds * this.a;
    const jerk = Math.hypot(lon - S.lonA, lat - S.latA, vert - S.vertA) / Math.max(1e-3, rdt);
    S.jerkF = (S.jerkF ?? 0) + (jerk - (S.jerkF ?? 0)) * Math.min(1, rdt * 4);
    S.latA = lat; S.lonA = lon; S.vertA = vert; S.yawRate = this.yawV * 180 / Math.PI;
    if (this.g.time > 3) {
      S.maxYawRate = Math.max(S.maxYawRate, Math.abs(S.yawRate)); S.maxLat = Math.max(S.maxLat, Math.abs(lat));
      S.maxLon = Math.max(S.maxLon, Math.abs(lon)); S.maxVert = Math.max(S.maxVert, Math.abs(vert));
      S.maxBank = Math.max(S.maxBank, Math.abs(this.bank * 180 / Math.PI)); S.maxJerk = Math.max(S.maxJerk, S.jerkF);
    }
  }
  get speed() { return this.v; }
  // unit xz vector pointing from the nearest point of the route toward (x, z): things fall that way, away from the heli
  awayFrom(x, z) {
    let best = 1e18, bx = 0, bz = 0;
    for (let i = 0; i < 400; i++) { const p = this.curve.getPointAt(i / 400), d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) { best = d; bx = p.x; bz = p.z; } }
    const dx = x - bx, dz = z - bz, l = Math.hypot(dx, dz) || 1;
    return { x: dx / l, z: dz / l, dist: Math.sqrt(best) };
  }
}

// grey-box door-gunner cabin, one merged mesh (vertex colours) + a rotor disc. Heli frame: forward -z, floor y = 0.
function buildCabin() {
  const g = new THREE.Group();
  const parts = [];
  const box = (w, h, d, x, y, z, c) => { const b = new THREE.BoxGeometry(w, h, d).toNonIndexed(); b.translate(x, y, z); const n = b.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(c, i * 3); b.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(b); };
  const D = [0.22, 0.23, 0.22], M = [0.32, 0.33, 0.3], L = [0.5, 0.5, 0.46], Y = [0.75, 0.6, 0.12];
  box(2.6, 0.08, 3.6, 0, -0.04, 0, M);           // floor
  box(2.6, 0.08, 3.6, 0, 2.38, 0, D);            // roof (tall: a seated or standing head sees the skyline under the header)
  box(0.08, 2.4, 3.6, 1.3, 1.2, 0, D);           // right wall
  box(2.6, 2.4, 0.08, 0, 1.2, -1.8, D);          // front bulkhead (cockpit behind it)
  box(2.6, 2.4, 0.08, 0, 1.2, 1.8, D);           // rear bulkhead
  box(0.1, 2.4, 0.35, -1.3, 1.2, -1.6, M);       // door pillars (the frame you see the city through)
  box(0.1, 2.4, 0.35, -1.3, 1.2, 1.6, M);
  box(0.1, 0.16, 3.6, -1.3, 2.3, 0, M);          // door header
  box(0.1, 0.12, 3.6, -1.3, 0.04, 0, Y);         // yellow sill stripe (a near reference low in view)
  box(0.04, 0.04, 2.6, -1.18, 2.15, 0, L);       // grab bar
  box(0.9, 0.45, 1.6, 0.75, 0.22, 0, M);         // bench
  box(0.08, 0.08, 4.4, -1.55, -0.62, 0, L);      // skid (look down: it rides with you)
  box(0.08, 0.6, 0.08, -1.45, -0.32, -1.2, L); box(0.08, 0.6, 0.08, -1.45, -0.32, 1.2, L);
  box(0.25, 0.25, 7.5, 0, 1.0, 5.4, D);          // tail boom stub (visible leaning out)
  const geo = mergeGeometries(parts);
  const cab = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.2 }));
  g.add(cab);
  const rotor = new THREE.Mesh(new THREE.CircleGeometry(7.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  rotor.position.y = 3.0; rotor.name = 'rotor';
  g.add(rotor);
  return g;
}
