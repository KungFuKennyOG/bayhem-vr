import * as THREE from 'three';
import { clamp, damp } from '../../rng.js';
import { routePoints } from './layout.js';

// =====================================================================================
//  HAMMER ONE's flight — an open path through Al-Sarab (layout.js ROUTE), flown on REAL time
//  (world slow-mo never yanks the cabin). Comfort rules, all tunable from the URL:
//   - speed: jerk-limited (≤ 0.7 m/s³, ≤ 1 m/s² along the path); the director sets a cruise
//     speed per beat and can ask to HOLD at a point (it brakes to a hover in time to stop there),
//   - heading: a critically damped spring capped at &yaw deg/s. The pilot can crab the nose so
//     the open door faces what you're fighting (&crab=0 turns that off),
//   - bank: the coordinated-turn angle, scaled down and capped at &bank deg (0 = horizon locked),
//   - pitch: nose-down when accelerating, capped at &pitch deg,
//   - the finale dive: a vertical offset with capped acceleration (≤ 2.5 m/s²),
//   - code never moves your head: the rig rides the seat.
// =====================================================================================

const _v = new THREE.Vector3(), _e = new THREE.Euler();
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class Rail {
  constructor(E, F, cabin) {
    this.E = E; this.F = F; this.cabin = cabin;
    const pts = routePoints(F);
    this.curve = new THREE.CatmullRomCurve3(pts.map(r => r.p), false, 'centripetal');
    this.curve.arcLengthDivisions = Math.ceil(this.curve.getLength());
    this.curve.updateArcLengths();
    this.L = this.curve.getLength();
    // where each tagged control point sits along the path
    this.tags = {};
    const N = Math.ceil(this.L / 4);
    for (const r of pts) if (r.tag) {
      let best = 1e18, bs = 0;
      for (let i = 0; i <= N; i++) { const p = this.curve.getPointAt(i / N); const d = p.distanceToSquared(r.p); if (d < best) { best = d; bs = (i / N) * this.L; } }
      this.tags[r.tag] = bs;
    }
    this.s = 0; this.v = F.speed; this.a = 0; this.cruise = F.speed; this.stopS = null;
    this.yaw = 0; this.yawV = 0; this.bank = 0; this.pitch = 0; this.crab = 0;
    this.dy = 0; this.dyV = 0; this.dyT = 0;
    this.faceP = null;
    this.st = { yawRate: 0, latA: 0, lonA: 0, vertA: 0, maxYawRate: 0, maxLat: 0, maxLon: 0, maxVert: 0, maxBank: 0, maxJerk: 0, jerkF: 0 };
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.jumpTo(0);
  }
  tag(name) { return this.tags[name] ?? 0; }
  point(s, out = new THREE.Vector3()) { return out.copy(this.curve.getPointAt(clamp(s / this.L, 0, 1))); }
  pathYaw(s) { const t = this.curve.getTangentAt(clamp(s / this.L, 0, 1)); return Math.atan2(-t.x, -t.z); }
  // beat jumps / screenshots: teleport (settled, not moving the head: the rig rides the seat)
  jumpTo(s, v = null) {
    this.s = clamp(s, 0, this.L - 1); if (v != null) this.v = v;
    this.yaw = this.pathYaw(this.s + 40); this.yawV = 0; this.a = 0; this.bank = 0; this.pitch = 0;
    this.place(0);
  }
  setCruise(v) { this.cruise = v; }
  holdAt(s) { this.stopS = s; }
  release() { this.stopS = null; }
  face(P) { this.faceP = P ? P.clone() : null; }
  dive(dy) { this.dyT = dy; }
  get holding() { return this.stopS != null && this.v < 1.5 && this.s > this.stopS - 15; }
  get speed() { return this.v; }

  update(rdt) {
    const F = this.F;
    // speed: brake in time for a hold point (v² = 2 a d with a gentle 0.8 m/s²), never past the end
    let vT = this.cruise;
    const end = this.L - 5;
    const stop = this.stopS != null ? Math.min(this.stopS, end) : end;
    const d = stop - this.s;
    // (conservative: the jerk limit needs ~1.3 s to build full braking, so leave that distance spare)
    vT = Math.min(vT, Math.sqrt(Math.max(0, 2 * 0.6 * Math.max(0, d - 3 - 1.4 * this.v))) + (d > 4 ? 0.8 : 0));
    const aWant = clamp((vT - this.v) * 0.55, -1.0, 0.9);
    this.a += clamp(aWant - this.a, -0.7 * rdt, 0.7 * rdt);
    if (d < 0.5 && this.v < 0.8) { this.v = Math.max(0, this.v - rdt); this.a = Math.min(this.a, 0); }
    this.v = Math.max(0, this.v + this.a * rdt);
    this.s = Math.min(end, this.s + this.v * rdt);
    // dive offset: spring with capped acceleration
    const dyA = clamp((this.dyT - this.dy) * 0.8 * 0.8 - 2 * 0.8 * this.dyV, -2.5, 2.5);
    this.dyV += dyA * rdt; this.dy += this.dyV * rdt;
    this.place(rdt);
  }
  place(rdt) {
    const F = this.F;
    const u = clamp(this.s / this.L, 0, 1);
    const p = this.curve.getPointAt(u);
    const pathYaw = this.pathYaw(Math.min(this.L, this.s + Math.max(25, this.v * 2)));
    // crab: put the open door (left) toward the fight
    let crabT = 0;
    if (this.faceP && F.crab > 0) {
      _v.subVectors(this.faceP, p); _v.y = 0;
      if (_v.lengthSq() > 25) {
        _v.normalize();
        const want = Math.atan2(_v.z, -_v.x);
        const max = (this.v < 6 ? 115 : this.v < 15 ? 75 : 50) * Math.PI / 180 * F.crab;
        crabT = clamp(wrap(want - pathYaw), -max, max);
      }
    }
    this.crab = crabT;
    const yT = pathYaw + crabT;
    const dy = wrap(yT - this.yaw);
    // the yaw-rate cap shrinks with speed so the sideways pull (v·ω) stays under ~3 m/s²;
    // the yaw acceleration is capped too (no lateral-jerk steps)
    const w = 0.9, cap = Math.min(F.yawRate * Math.PI / 180, 3.0 / Math.max(1, this.v));
    if (rdt > 0) {
      const want = clamp(this.yawV + (dy * w * w - 2 * w * this.yawV) * rdt, -cap, cap);
      this.yawV += clamp(want - this.yawV, -0.05 * rdt, 0.05 * rdt);
      this.yaw = wrap(this.yaw + this.yawV * rdt);
    }
    // bank from the turn rate at speed (a hover pivot doesn't bank)
    const maxB = F.bank * Math.PI / 180;
    const bankT = clamp(Math.atan(this.v * this.yawV / 9.8) * 0.45 * clamp(this.v / 18, 0, 1), -maxB, maxB);
    if (rdt > 0) { const wb = 1.3; this.bankV = (this.bankV || 0) + ((bankT - this.bank) * wb * wb - 2 * wb * (this.bankV || 0)) * rdt; this.bank += this.bankV * rdt; }
    const maxP = F.pitch * Math.PI / 180;
    const pitchT = clamp(-this.a * 0.035, -maxP, maxP);
    this.pitch = damp(this.pitch, pitchT, 1.5, rdt || 0.016);
    this.pos.copy(p); this.pos.y += this.dy;
    this.vel.copy(this.curve.getTangentAt(u)).multiplyScalar(this.v);
    const root = this.cabin.root;
    root.position.copy(this.pos);
    _e.set(this.pitch, this.yaw, this.bank, 'YXZ');
    root.quaternion.setFromEuler(_e);
    root.updateMatrixWorld(true);
    const rig = this.E.rig;
    this.cabin.seat.getWorldPosition(rig.position);
    this.cabin.seat.getWorldQuaternion(rig.quaternion);
    rig.updateMatrixWorld(true);
    if (rdt > 0) this._stats(rdt, p);
  }
  _stats(rdt, p) {
    const S = this.st, u = this.s / this.L, ds = 15 / this.L;
    const y0 = this.curve.getPointAt(clamp(u - ds, 0, 1)).y, y2 = this.curve.getPointAt(clamp(u + ds, 0, 1)).y;
    const dyds = (y2 - y0) / 30, d2y = (y2 - 2 * p.y + y0) / 225;
    const lon = this.a, lat = this.v * this.yawV, vert = d2y * this.v * this.v + dyds * this.a + this.dyV * 0;
    const jerk = Math.hypot(lon - S.lonA, lat - S.latA, vert - S.vertA) / Math.max(1e-3, rdt);
    S.jerkF += (jerk - S.jerkF) * Math.min(1, rdt * 4);
    S.latA = lat; S.lonA = lon; S.vertA = vert; S.yawRate = this.yawV * 180 / Math.PI;
    this.statT = (this.statT || 0) + rdt; if (this.statT < 2.5) return;
    S.maxYawRate = Math.max(S.maxYawRate, Math.abs(S.yawRate)); S.maxLat = Math.max(S.maxLat, Math.abs(lat));
    S.maxLon = Math.max(S.maxLon, Math.abs(lon)); S.maxVert = Math.max(S.maxVert, Math.abs(vert));
    S.maxBank = Math.max(S.maxBank, Math.abs(this.bank * 180 / Math.PI)); S.maxJerk = Math.max(S.maxJerk, S.jerkF);
  }
}
