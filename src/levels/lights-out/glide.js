import * as THREE from 'three';
import { range, rand, clamp, damp, lerp } from '../../rng.js';
import { CELL } from '../../particles.js';
import { makeRng } from '../../rng.js';
import { Buckets, em, hexc, mix3, mul3, DUSK, DIST } from './kit.js';
import { materials } from './mats.js';
import { GLIDE, GLIDE_SPEED, STEER_MAX, BOAT, WATER_Y } from './layout.js';
import { RIVER_U } from './river.js';

// =====================================================================================
//  The glide: a ram-air canopy over you (a fixed frame, like the heli cabin in Level 8), its
//  lines down to your shoulders; a rail through the gorge you can nudge sideways; enemy jumpers
//  on their own canopies (shoot the canopy: it folds and he drops past you into the fog); the
//  gunboat waiting under the end of the line (you land on its deck).
//  Comfort: barely any free fall (the canopy opens 0.7 s after the jump, in slow-mo), a slow
//  steady descent, no swing / no roll, the yaw follows the line at ≤ 3°/s.
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// a ram-air canopy: an arched wing of cells, lines to two risers. y up, the wing's centre at the origin,
// the risers at (±0.24, -drop, 0). col: [top colour, stripe colour]
export function buildCanopy({ top = hexc(0x2a2d30), stripe = hexc(0xc8501a), drop = 6.4, span = 9.2, chord = 3.4, lit = false } = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const g = new THREE.Group();
  const A = B.get('dbl', 'c');
  const cells = 11, arc = 0.9;   // arc: how far the wing curls down at its tips (radians either side)
  const R = span / 2 / Math.sin(arc);
  const P = (t, c, h) => { const a = (t - 0.5) * 2 * arc; return [Math.sin(a) * (R + h), Math.cos(a) * (R + h) - R, c]; };
  for (let i = 0; i < cells; i++) {
    const t0 = i / cells, t1 = (i + 1) / cells;
    const col = i === 5 || i === 2 || i === 8 ? stripe : top;
    // the underside catches the fires below (a faint warm wash) so the canopy reads against the night sky
    A.set({ col, rm: [0.75, 0, 0], em: em([1, 0.45, 0.2], lit ? 0.12 : 0.05, DUSK + DIST.ALWAYS) });
    // top skin (curved chordwise: thicker at the leading edge), bottom skin, the rib wall
    for (let k = 0; k < 3; k++) {
      const c0 = -chord / 2 + chord * k / 3, c1 = -chord / 2 + chord * (k + 1) / 3;
      const th = (c) => 0.42 * Math.max(0, 1 - Math.pow((c + chord * 0.15) / (chord * 0.62), 2));
      A.quad(P(t0, c0, th(c0)), P(t1, c0, th(c0)), P(t1, c1, th(c1)), P(t0, c1, th(c1)));
      // the underside: dark nylon, every other cell a shade lighter (the cell structure reads from below), seams dark
      // (lighter than it was: from under it, the canopy read as a flat black slab over your head; the stripes show too)
      { const u = (i % 2 ? 0.2 : 0.15) * (k === 1 ? 1.12 : 1); const st = col === stripe; A.set({ col: st ? stripe.map(v => v * 0.6) : [u, u, u * 1.08], em: em([1, 0.45, 0.2], st ? 0.06 : 0.03, DUSK + DIST.ALWAYS) }); }
      A.quad(P(t0, c1, 0), P(t1, c1, 0), P(t1, c0, 0), P(t0, c0, 0));
      A.set({ col, em: em([1, 0.45, 0.2], 0.05, DUSK + DIST.ALWAYS) });
    }
    // the rib seams under each cell wall
    A.set({ col: [0.03, 0.03, 0.035], em: [0, 0, 0, 0] });
    { const a0 = P(t0, -chord / 2, -0.01), a1 = P(t0, chord / 2, -0.01), b0 = P(t0 + 0.006, -chord / 2, -0.01), b1 = P(t0 + 0.006, chord / 2, -0.01); A.quad(a0, a1, b1, b0); }
    // the open cell mouths at the leading edge (dark)
    A.set({ col: [0.04, 0.04, 0.04] }); A.quad(P(t0, -chord / 2, 0), P(t1, -chord / 2, 0), P(t1, -chord / 2, 0.42 * 0.94), P(t0, -chord / 2, 0.42 * 0.94));
  }
  // lines: from the bottom skin at the cell walls down to the two risers
  // (1-px GL lines: thin at any distance — a beam this close to your eye fills the view with a white wedge)
  const lp = [];
  for (let i = 0; i <= cells; i += 2) for (const c of [-chord * 0.35, chord * 0.1, chord * 0.42]) {
    const p = P(i / cells, c, 0), side = p[0] < 0 ? -1 : 1;
    lp.push(...p, side * 0.32, -drop, 0);
  }
  // the risers and the slider
  for (const s of [-1, 1]) lp.push(s * 0.32, -drop, 0, s * 0.26, -drop - 0.38, 0.03);   // the risers (lines too: a mesh this close to the eye blows out)
  { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x15130f, transparent: true, opacity: 0.85 })); ls.frustumCulled = false; g.add(ls); }
  B.finish(g);
  g.userData.drop = drop;
  return g;
}

export class GlideRail {
  constructor() {
    this.curve = new THREE.CatmullRomCurve3(GLIDE.map(p => new THREE.Vector3(...p)), false, 'centripetal', 0.5);
    this.curve.arcLengthDivisions = 2000;
    this.len = this.curve.getLength();
    this.s = 0; this.steer = 0; this.steerV = 0;
    this.pos = new THREE.Vector3(...GLIDE[0]); this.tan = this.curve.getTangentAt(0, new THREE.Vector3());
    this.yaw = Math.atan2(-this.tan.x, -this.tan.z);
  }
  get u() { return clamp(this.s / this.len, 0, 1); }
  get remaining() { return (this.len - this.s) / GLIDE_SPEED; }
  at(s, out) { return this.curve.getPointAt(clamp(s / this.len, 0, 1), out); }
  step(dt, steerIn) {
    this.s = Math.min(this.len, this.s + GLIDE_SPEED * dt);
    const u = this.u;
    this.curve.getPointAt(u, this.pos); this.curve.getTangentAt(u, this.tan);
    // steering: a soft lateral offset (right of travel = +), slows to zero near the end so you still land
    const lim = STEER_MAX * clamp((this.len - this.s) / 60, 0, 1);
    this.steerV = damp(this.steerV, steerIn * 4, 3, dt);
    this.steer = clamp(this.steer + this.steerV * dt, -lim, lim);
    _v.set(-this.tan.z, 0, this.tan.x).normalize();
    this.pos.addScaledVector(_v, this.steer);
    // yaw follows the line, rate-limited (3°/s)
    const want = Math.atan2(-this.tan.x, -this.tan.z);
    let d = want - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += clamp(d, -0.052 * dt, 0.052 * dt);
  }
}

// the gunboat: a 32 m grey river patrol boat. A lofted hull (raked, flared bow; the sheer rising forward;
// a white boot-top at the waterline, a hull number), a stepped superstructure with a lit bridge, a lattice
// radar mast, a twin gun on the foredeck (turns to track you), red / green / white nav lights, fuel drums
// lashed on the stern (its weak spot) and a foam wake. Deck at y 1.25; x = forward.
export function buildGunboat() {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const g = new THREE.Group(); g.name = 'gunboat';
  const A = B.get('plain', 'b'), Mt = B.get('metal', 'b'), W = B.get('win', 'b'), Lt = B.get('plain', 'b');
  const L = 32, x0 = -L / 2, x1 = L / 2;
  // hull sections: [x, half-width at the deck, deck height, half-width at the chine, chine height, keel depth]
  const sec = [];
  for (let i = 0; i <= 16; i++) {
    const x = x0 + L * i / 16, u = (x - x0) / L;
    const bow = Math.max(0, (u - 0.62) / 0.38);                       // 0 aft of the shoulder .. 1 at the stem
    const hwD = 3.8 * Math.sqrt(Math.max(0, 1 - bow * bow * 0.98)) * (1 - bow * 0.15);
    const hwC = 3.4 * Math.sqrt(Math.max(0, 1 - Math.pow(bow, 1.4))) ;
    const yD = 1.25 + bow * bow * 1.4 + (u < 0.06 ? 0 : 0);
    const keel = -1.7 + bow * bow * 1.3 + (u < 0.08 ? (0.08 - u) * 6 : 0);
    sec.push([x, hwD, yD, hwC, 0.15 + bow * 0.6, keel]);
  }
  const HULL = [0.26, 0.29, 0.32], HULL2 = [0.18, 0.2, 0.22], BOOT = [0.7, 0.7, 0.68], PAINT = [0.26, 0.29, 0.28];   // naval grey-green
  const St = B.get('steel', 'b'), Dk = B.get('deck', 'b');
  const ALW = DUSK + DIST.ALWAYS;
  // a torus in the plane spanned by unit vectors e1, e2 around centre c (proper shared faces: no sawtooth where colours change)
  const torus = (Acc, c, e1, e2, R, r, N, M, colAt) => {
    const nrm = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const P = (i, j) => { const a = i / N * Math.PI * 2, b = j / M * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), rr = R + r * Math.cos(b);
      return [0, 1, 2].map(k => c[k] + (e1[k] * ca + e2[k] * sa) * rr + nrm[k] * r * Math.sin(b)); };
    for (let i = 0; i < N; i++) { Acc.set({ col: colAt(i) }); for (let j = 0; j < M; j++) Acc.quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)); }
  };
  // a quad on the hull with metre uvs (so the plate texture is the same scale everywhere); sd < 0 mirrors the winding
  const hq = (Acc, sd, p0, p1, p2, p3, col, u0, v0, u1, v1) => { Acc.set({ col }); if (sd > 0) Acc.quad(p0, p1, p2, p3, [u0, v0, u1, v1]); else Acc.quad(p1, p0, p3, p2, [u1, v0, u0, v1]); };
  St.set({ col: HULL, rm: [0.55, 0.3, 0], em: [0, 0, 0, 0] });
  for (let i = 0; i < sec.length - 1; i++) {
    const [xa, wa, ya, ca, cya, ka] = sec[i], [xb, wb, yb, cb, cyb, kb] = sec[i + 1];
    for (const sd of [-1, 1]) {
      // topsides (chine to the sheer), the boot-top, the bottom (chine to keel)
      hq(St, sd, [xa, cya + 0.3, sd * ca], [xb, cyb + 0.3, sd * cb], [xb, yb, sd * wb], [xa, ya, sd * wa], HULL, xa, cya + 0.3, xb, ya);
      hq(A, sd, [xa, cya, sd * ca], [xb, cyb, sd * cb], [xb, cyb + 0.3, sd * cb], [xa, cya + 0.3, sd * ca], BOOT, 0, 0, 1, 1);
      hq(St, sd, [xa, ka, 0], [xb, kb, 0], [xb, cyb, sd * cb], [xa, cya, sd * ca], [0.22, 0.1, 0.07], xa, ka, xb, cya);
    }
  }
  A.set({ col: HULL2, rm: [0.55, 0.35, 0], em: [0, 0, 0, 0] });
  // the transom
  { const [x, w, y, c, cy, k] = sec[0]; St.set({ col: HULL2 }); const K = [x, k, 0], Cp = [x, cy, c], Cm = [x, cy, -c], Wp = [x, y, w], Wm = [x, y, -w]; for (const [a1, b1] of [[Cp, Wp], [Wp, Wm], [Wm, Cm]]) { St.tri(K, a1, b1, [[0, k], [c, cy], [-c, y]]); St.tri(K, b1, a1, [[0, k], [-c, y], [c, cy]]); } }
  // ---- the deck: anti-skid steel on a 1 m grid, so it can carry the floodlights' warm pools (baked per vertex) and
  // contact grime at the bulkheads and the bulwarks
  const FLOOD = [[-7.3, 3.55, -2.3], [-7.3, 3.55, 2.3], [4.6, 3.8, 0]];
  const pool = (x, z) => { let k = 0; for (const [fx, , fz] of FLOOD) { const dx = (x - (fx - (fx < 0 ? 2.0 : -2.0))) / 1.7, dz = (z - fz * 0.75) / 1.4; k += Math.exp(-(dx * dx + dz * dz)); } return Math.min(1.2, k); };
  const inHouse = (x, z) => x > -7 && x < 4.5 && Math.abs(z) < 2.6;
  const grime = (x, z, hw) => { let k = 1; const dh = Math.max(Math.max(-7 - x, x - 4.5), Math.abs(z) - 2.6); if (dh > -0.01) k *= 0.62 + 0.38 * Math.min(1, dh / 0.9); k *= 0.7 + 0.3 * Math.min(1, (hw - Math.abs(z)) / 0.6); return k; };
  const DC = [0.27, 0.3, 0.28];
  for (let i = 0; i < sec.length - 1; i++) {
    const [xa, wa, ya] = sec[i], [xb, wb, yb] = sec[i + 1];
    const NZ = 8;
    for (let j = 0; j < NZ; j++) {
      const ta = -1 + 2 * j / NZ, tb = -1 + 2 * (j + 1) / NZ, ia = wa - 0.12, ib = wb - 0.12;
      const P = [[xa, ya, ta * ia], [xb, yb, ta * ib], [xb, yb, tb * ib], [xa, ya, tb * ia]];
      if (P.every(q => inHouse(q[0], q[2]))) continue;
      const cols = P.map(q => DC.map(c => c * grime(q[0], q[2], q[0] === xa ? wa : wb)));
      const ems = P.map(q => { const k = pool(q[0], q[2]); const e = 0.16 * k * k; return [1.0 * e, 0.78 * e, 0.5 * e, ALW]; });
      Dk.set({ col: DC, rm: [0.78, 0.3, 0] });
      Dk.quad(P[0], P[3], P[2], P[1], [P[0][0], P[0][2], P[1][0], P[3][2]], DC, [cols[0], cols[3], cols[2], cols[1]], [ems[0], ems[3], ems[2], ems[1]]);
    }
  }
  // bulwark: a 25 cm steel lip round the deck edge, freeing ports, then the guard rail (dark, thick: thin bright rails
  // read as laser lines) on stanchions every 1.2 m with a middle rail
  for (let i = 0; i < sec.length - 1; i++) for (const sd of [-1, 1]) {
    const [xa, wa, ya] = sec[i], [xb, wb, yb] = sec[i + 1];
    hq(St, -sd, [xa, ya, sd * (wa - 0.12)], [xb, yb, sd * (wb - 0.12)], [xb, yb + 0.28, sd * (wb - 0.1)], [xa, ya + 0.28, sd * (wa - 0.1)], mul3(PAINT, 0.8), xa, ya, xb, ya + 0.28);
    St.set({ col: mul3(PAINT, 0.7) }); St.beam([xa, ya + 0.29, sd * (wa - 0.11)], [xb, yb + 0.29, sd * (wb - 0.11)], 0.06, 0.04);
    Mt.set({ col: [0.26, 0.28, 0.29], rm: [0.4, 0.75, 0], em: [0, 0, 0, 0] });
    Mt.tube([xa, ya + 1.0, sd * (wa - 0.12)], [xb, yb + 1.0, sd * (wb - 0.12)], 0.028, 6);
    Mt.tube([xa, ya + 0.62, sd * (wa - 0.12)], [xb, yb + 0.62, sd * (wb - 0.12)], 0.018, 5);
    for (let x = xa; x < xb - 0.05; x += 1.0) if (wa > 0.5) { const t = (x - xa) / (xb - xa), w = lerp(wa, wb, t) - 0.12, y = lerp(ya, yb, t); Mt.tube([x, y + 0.28, sd * w], [x, y + 1.02, sd * w], 0.022, 5); Mt.box(x - 0.05, y + 0.28, sd * w - 0.05, x + 0.05, y + 0.31, sd * w + 0.05, { faces: 'xXzZY' }); }
  }
  // the hull number on both bows: see the 7-segment digits further down
  // ---- superstructure: a long deckhouse, the bridge on top with framed windows all round, a funnel aft. Painted steel with
  // grime gradients at the base, a darker roof edge, the plating seams in the texture
  St.set({ col: PAINT, rm: [0.6, 0.25, 0], em: [0, 0, 0, 0] });
  St.box(-7, 1.25, -2.6, 4.5, 3.6, 2.6, { faces: 'XzZ', s: 1, foot: 0.4, top: mul3(PAINT, 1.05) });
  // the aft bulkhead as a 0.4 m grid, so the lamp over the door and the floods can lay warm light on it (baked per vertex),
  // with grime toward the deck
  { const lampA = [3.3, -1.28], NZ = 13, NY = 6;
    const lit = (y, z) => { const dy = (y - lampA[0]) / 0.9, dz = (z - lampA[1]) / 0.8; const k = Math.exp(-(dy * dy + dz * dz)) * 0.9 + Math.exp(-((y - 3.6) * (y - 3.6) / 0.4 + (Math.abs(z) - 2.3) * (Math.abs(z) - 2.3) / 0.5)) * 0.3; const e = 0.085 * k; return [e, e * 0.78, e * 0.5, ALW]; };
    const colY = (y) => mul3(PAINT, 0.6 + 0.4 * Math.min(1, (y - 1.25) / 1.0));
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NY; j++) {
      const za = -2.6 + 5.2 * i / NZ, zb = -2.6 + 5.2 * (i + 1) / NZ, ya = 1.25 + 2.35 * j / NY, yb = 1.25 + 2.35 * (j + 1) / NY;
      const P = [[-7, ya, za], [-7, ya, zb], [-7, yb, zb], [-7, yb, za]];
      St.set({ col: PAINT }); St.quad(P[0], P[1], P[2], P[3], [za, ya, zb, yb], PAINT, P.map(q => colY(q[1])), P.map(q => lit(q[1], q[2])));
    } }
  St.set({ col: mul3(PAINT, 0.82) }); St.box(-7, 3.6, -2.6, 4.5, 3.62, 2.6, { faces: 'Y', s: 1 });
  St.set({ col: mul3(PAINT, 0.7) }); St.box(-7.06, 3.55, -2.66, 4.56, 3.68, 2.66, { faces: 'xXzZy', s: 1 });   // roof edge gutter
  St.set({ col: mul3(PAINT, 1.02) }); St.box(-3.5, 3.6, -2.2, 3.5, 6.0, 2.2, { faces: 'xXzZ', s: 1, foot: 0.3 });
  St.set({ col: mul3(PAINT, 0.8) }); St.box(-3.6, 6.0, -2.3, 3.6, 6.12, 2.3, { faces: 'xXzZYy', s: 1 });
  // windows: dark glass with a faint lit interior, steel frames with a sill; the bridge gets a continuous band
  const win = (x0w, x1w, y0w, y1w, zf, sd, lit, rows = 1) => {
    const Gl = B.get('plain', 'b'); Gl.set({ col: [0.06, 0.07, 0.08], rm: [0.12, 0.6, 0], em: em(lit > 0.3 ? [0.8, 0.92, 1] : [1, 0.8, 0.55], lit, ALW) });
    Gl.box(x0w, y0w, zf - 0.01, x1w, y1w, zf + 0.01, { faces: sd > 0 ? 'Z' : 'z' });
    Mt.set({ col: [0.2, 0.21, 0.22], rm: [0.4, 0.7, 0] });
    const fz = zf + sd * 0.03;
    for (const [a, b, c, d] of [[x0w - 0.05, y0w - 0.05, x1w + 0.05, y0w], [x0w - 0.05, y1w, x1w + 0.05, y1w + 0.05], [x0w - 0.05, y0w, x0w, y1w], [x1w, y0w, x1w + 0.05, y1w]]) Mt.box(a, b, Math.min(zf, fz), c, d, Math.max(zf, fz), { faces: 'xXzZyY' });
    Mt.box(x0w - 0.08, y0w - 0.09, Math.min(zf, zf + sd * 0.08), x1w + 0.08, y0w - 0.05, Math.max(zf, zf + sd * 0.08), { faces: 'xXzZY' });
    void rows;
  };
  for (const sd of [-1, 1]) {
    for (let x = -5.9; x < 3.8; x += 1.35) if (Math.abs(x + 5.3) > 0.9) win(x, x + 0.7, 2.25, 3.0, sd * 2.605, sd, 0.18 + ((x * 7) % 2 > 1 ? 0.12 : 0));
    for (let x = -3.2; x < 3.2; x += 0.92) win(x, x + 0.8, 4.55, 5.55, sd * 2.205, sd, 0.36);
  }
  { const Gl = B.get('plain', 'b'); Gl.set({ col: [0.06, 0.07, 0.08], rm: [0.12, 0.6, 0], em: em([0.8, 0.92, 1], 0.4, ALW) });
    for (let z = -1.9; z < 1.8; z += 0.95) { Gl.box(3.495, 4.55, z, 3.51, 5.55, z + 0.8, { faces: 'X' }); Mt.box(3.5, 4.5, z - 0.05, 3.54, 5.6, z, { faces: 'xXzZ' }); }
    Mt.box(3.5, 4.48, -2.2, 3.62, 4.53, 2.2, { faces: 'XY' }); }
  // the funnel: an oval stack with a red band and a black cap (soot down its aft side)
  A.set({ col: [0.28, 0.3, 0.31], rm: [0.6, 0.2, 0], em: [0, 0, 0, 0] }); const fsv = A.push(new THREE.Matrix4().makeScale(1, 1, 0.62).setPosition(-5.3, 0, 0)); A.cyl(0, 3.6, 0, 1.0, 0.92, 6.2, 14);
  A.set({ col: [0.42, 0.05, 0.03] }); A.cyl(0, 5.3, 0, 0.94, 0.935, 5.75, 14, { cap: false }); A.set({ col: [0.03, 0.03, 0.03] }); A.cyl(0, 6.2, 0, 0.92, 0.9, 6.6, 14); A.pop(fsv);
  // ---- the deckhouse's aft bulkhead: you land 1.5 m from it and look at it under the credits, so it gets the most:
  // a watertight door (frame, six dogs, a lit round port), a caged bulkhead lamp, a lifebuoy ring on its rack, a fire
  // extinguisher, a junction box and conduit, a vent louvre, a ladder to the roof, a hazard-striped kick plate
  const BX = -7.0;
  St.set({ col: mul3(PAINT, 0.72) });
  St.box(BX - 0.08, 1.28, -1.86, BX, 3.32, -0.7, { faces: 'xzZY', s: 1 });                       // the door frame (a raised coaming)
  St.set({ col: mul3(PAINT, 0.88) }); St.box(BX - 0.12, 1.4, -1.78, BX - 0.08, 3.22, -0.78, { faces: 'xzZYy', s: 1 });   // the door leaf
  Mt.set({ col: [0.35, 0.35, 0.33], rm: [0.35, 0.8, 0] });
  for (const [y, zz] of [[1.75, -1.72], [2.35, -1.72], [2.95, -1.72], [1.75, -0.84], [2.35, -0.84], [2.95, -0.84]]) { Mt.box(BX - 0.17, y - 0.025, zz - 0.02, BX - 0.11, y + 0.025, zz + 0.02); Mt.box(BX - 0.19, y - 0.11, zz - 0.015, BX - 0.16, y + 0.03, zz + 0.015); }
  { Mt.set({ col: [0.42, 0.28, 0.12], rm: [0.35, 0.85, 0] });
    torus(Mt, [BX - 0.16, 2.72, -1.28], [0, 1, 0], [0, 0, 1], 0.15, 0.035, 16, 6, () => [0.42, 0.28, 0.12]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; Mt.box(BX - 0.18, 2.72 + Math.sin(a) * 0.2 - 0.015, -1.28 + Math.cos(a) * 0.2 - 0.015, BX - 0.14, 2.72 + Math.sin(a) * 0.2 + 0.015, -1.28 + Math.cos(a) * 0.2 + 0.015); }
    const gsv = Lt.push(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(BX - 0.11, 2.72, -1.28)); Lt.set({ col: [0.1, 0.09, 0.08], rm: [0.06, 0.4, 0], em: em([1, 0.7, 0.4], 0.22, ALW) }); Lt.cyl(0, 0, 0, 0.125, 0.125, 0.05, 14); Lt.pop(gsv); }
  // the caged lamp over the door
  Mt.set({ col: [0.16, 0.17, 0.17], rm: [0.4, 0.6, 0] }); Mt.box(BX - 0.12, 3.38, -1.42, BX, 3.46, -1.14, { faces: 'xzZYy' });
  Lt.set({ col: [0.75, 0.62, 0.45], em: em([1, 0.78, 0.5], 0.75, ALW) }); Lt.tube([BX - 0.1, 3.3, -1.28], [BX - 0.1, 3.38, -1.28], 0.1, 10); Lt.tube([BX - 0.1, 3.22, -1.28], [BX - 0.1, 3.3, -1.28], 0.085, 10);
  Mt.set({ col: [0.12, 0.12, 0.12] }); for (const zz of [-1.4, -1.33, -1.23, -1.16]) Mt.tube([BX - 0.21, 3.19, zz], [BX - 0.21, 3.38, zz], 0.009, 4); for (const yy of [3.19, 3.28]) Mt.tube([BX - 0.21, yy, -1.4], [BX - 0.21, yy, -1.16], 0.009, 4);
  // the lifebuoy: an orange ring with four white bands (a real torus), a grab line round it, on a bracket; a coiled line under it
  { const cz = 0.95, cy = 2.35, R = 0.3;
    Mt.set({ col: [0.22, 0.23, 0.23], rm: [0.4, 0.6, 0] }); Mt.box(BX - 0.12, cy + R + 0.02, cz - 0.05, BX, cy + R + 0.1, cz + 0.05); Mt.box(BX - 0.12, cy - 0.04, cz - R - 0.1, BX, cy + 0.04, cz - R + 0.02);
    torus(Lt, [BX - 0.11, cy, cz], [0, 1, 0], [0, 0, 1], R, 0.065, 32, 10, (i) => (i % 6 === 0 || i % 6 === 1) ? [0.8, 0.79, 0.75] : [0.78, 0.26, 0.06]);
    A.set({ col: [0.55, 0.5, 0.38], rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; torus(A, [BX - 0.11, cy + Math.sin(a) * R, cz + Math.cos(a) * R], [Math.cos(a) * 0, Math.cos(a), -Math.sin(a)].map((v, i) => i === 0 ? 1 : 0), [0, Math.sin(a), Math.cos(a)], 0.075, 0.009, 8, 3, () => [0.55, 0.5, 0.38]); }
    A.set({ col: [0.2, 0.17, 0.12] }); for (let l = 0; l < 3; l++) torus(A, [BX - 0.08, 1.75, cz], [0, 1, 0], [0, 0, 1], 0.15 - l * 0.02, 0.018, 14, 4, () => [0.2, 0.17, 0.12]); }
  // fire extinguisher on a bracket, a red cabinet, a junction box with conduit up to the roof edge, a vent louvre
  A.set({ col: [0.55, 0.06, 0.04], rm: [0.4, 0.2, 0] }); A.cyl(BX - 0.14, 1.36, 1.9, 0.09, 0.09, 1.92, 10); A.set({ col: [0.08, 0.08, 0.08] }); A.cyl(BX - 0.14, 1.92, 1.9, 0.04, 0.03, 2.02, 6);
  // a fire-hose reel: a red drum on a wall bracket, the hose wound on it, a brass nozzle, the valve wheel beside it
  { const hc = [1.92, 2.82];
    Mt.set({ col: [0.22, 0.23, 0.23], rm: [0.4, 0.6, 0] }); Mt.box(BX - 0.3, hc[1] - 0.04, hc[0] - 0.04, BX, hc[1] + 0.04, hc[0] + 0.04);
    for (const dx of [-0.08, -0.36]) { const rsv = A.push(new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(BX + dx, hc[1], hc[0])); A.set({ col: [0.2, 0.045, 0.035], rm: [0.5, 0.25, 0] }); A.cyl(0, 0, 0, 0.23, 0.23, 0.02, 28); A.set({ col: [0.2, 0.04, 0.03] }); A.cyl(0, 0.02, 0, 0.06, 0.06, 0.05, 12); A.pop(rsv); }
    for (let l = 0; l < 5; l++) torus(A, [BX - 0.12 - l * 0.045, hc[1], hc[0]], [0, 1, 0], [0, 0, 1], 0.17, 0.022, 24, 6, () => [0.22, 0.07, 0.04]);
    Mt.set({ col: [0.55, 0.42, 0.15], rm: [0.3, 0.9, 0] }); Mt.tube([BX - 0.25, hc[1] - 0.22, hc[0] + 0.05], [BX - 0.25, hc[1] - 0.48, hc[0] + 0.12], 0.025, 6);
    torus(A, [BX - 0.08, 2.3, 1.45], [0, 1, 0], [0, 0, 1], 0.09, 0.015, 12, 4, () => [0.45, 0.06, 0.04]); }
  Mt.set({ col: [0.32, 0.34, 0.34], rm: [0.4, 0.6, 0] }); Mt.box(BX - 0.14, 2.0, -0.42, BX, 2.36, -0.1, { faces: 'xzZYy' });
  Mt.tube([BX - 0.06, 2.36, -0.26], [BX - 0.06, 3.55, -0.26], 0.025, 6); Mt.tube([BX - 0.06, 2.0, -0.18], [BX - 0.06, 1.3, -0.18], 0.025, 6);
  for (const [yy, zz] of [[2.7, -0.26], [3.1, -0.26], [3.45, -0.26], [1.7, -0.18]]) Mt.box(BX - 0.1, yy - 0.025, zz - 0.045, BX, yy + 0.025, zz + 0.045);
  St.set({ col: mul3(PAINT, 0.6) }); for (let k = 0; k < 6; k++) St.box(BX - 0.06, 3.0 + k * 0.08, -0.05, BX, 3.04 + k * 0.08, 0.45, { faces: 'xYy', s: 1 });
  // hazard stripes on the kick plate along the bulkhead's foot (worn: dark yellow on black)
  for (let k = 0; k < 13; k++) { const z = -2.6 + k * 0.4; A.set({ col: k % 2 ? [0.42, 0.33, 0.06] : [0.05, 0.05, 0.05], rm: [0.7, 0, 0] }); A.box(BX - 0.02, 1.25, z, BX, 1.45, Math.min(2.6, z + 0.4), { faces: 'x' }); }
  // the ladder up the port aft corner to the deckhouse roof
  Mt.set({ col: [0.24, 0.25, 0.26], rm: [0.4, 0.7, 0] });
  for (const zz of [-2.45, -2.05]) Mt.tube([BX - 0.22, 1.25, zz], [BX - 0.22, 4.4, zz], 0.025, 6);
  for (let y = 1.55; y < 3.7; y += 0.3) Mt.tube([BX - 0.22, y, -2.45], [BX - 0.22, y, -2.05], 0.018, 5);
  // the deckhouse's long sides: a cable tray under the gutter, a pipe run on clamps, recessed access panels, junction boxes,
  // rust weeping under every fitting
  for (const sd of [-1, 1]) {
    const zf = sd * 2.6, zo = (d) => zf + sd * d, fz = sd > 0 ? 'Z' : 'z';
    Mt.set({ col: [0.16, 0.17, 0.17], rm: [0.45, 0.6, 0], em: [0, 0, 0, 0] });
    Mt.box(-6.9, 3.3, Math.min(zf, zo(0.16)), 4.4, 3.33, Math.max(zf, zo(0.16)), { faces: 'xXyYzZ' }); Mt.box(-6.9, 3.33, Math.min(zo(0.14), zo(0.16)), 4.4, 3.42, Math.max(zo(0.14), zo(0.16)), { faces: fz });
    for (let x = -6.6; x < 4.4; x += 0.9) Mt.box(x, 3.33, Math.min(zf, zo(0.16)), x + 0.03, 3.42, Math.max(zf, zo(0.16)));
    Mt.tube([-6.9, 1.62, zo(0.1)], [4.4, 1.62, zo(0.1)], 0.045, 8);
    for (let x = -6.4; x < 4.4; x += 1.1) { Mt.box(x - 0.03, 1.55, Math.min(zf, zo(0.15)), x + 0.03, 1.69, Math.max(zf, zo(0.15)));
      A.set({ col: [0.28, 0.16, 0.08], rm: [0.8, 0, 0], em: [0, 0, 0, 0] }); A.box(x - 0.025 + (x % 0.7) * 0.02, 1.25, Math.min(zo(0.004), zo(0.008)), x + 0.02, 1.55, Math.max(zo(0.004), zo(0.008)), { faces: fz }); }
    for (const x of [-4.4, 1.2]) { St.set({ col: mul3(PAINT, 0.7) }); St.box(x, 1.75, Math.min(zf, zo(0.03)), x + 0.9, 2.15, Math.max(zf, zo(0.03)), { faces: fz + 'xXyY', s: 1 }); St.set({ col: mul3(PAINT, 0.88) }); St.box(x + 0.05, 1.8, Math.min(zf, zo(0.035)), x + 0.85, 2.1, Math.max(zf, zo(0.035)), { faces: fz, s: 1 });
      Mt.set({ col: [0.35, 0.35, 0.33] }); for (const [bx, by] of [[0.08, 0.07], [0.82, 0.07], [0.08, 0.33], [0.82, 0.33]]) Mt.box(x + bx - 0.015, 1.75 + by - 0.015, Math.min(zf, zo(0.045)), x + bx + 0.015, 1.75 + by + 0.015, Math.max(zf, zo(0.045)));
      A.set({ col: [0.28, 0.16, 0.08], rm: [0.8, 0, 0] }); A.box(x + 0.1, 1.25, Math.min(zo(0.004), zo(0.008)), x + 0.13, 1.75, Math.max(zo(0.004), zo(0.008)), { faces: fz }); }
  }
  // stiffener ribs and seams down the deckhouse's long sides
  St.set({ col: mul3(PAINT, 0.76) }); for (const sd of [-1, 1]) for (let x = -5.8; x < 4.4; x += 1.3) St.box(x - 0.03, 1.25, Math.min(sd * 2.6, sd * 2.64), x + 0.03, 3.6, Math.max(sd * 2.6, sd * 2.64), { faces: sd > 0 ? 'ZxX' : 'zxX', s: 1 });
  // the lattice radar mast with a yard, a horn antenna on top
  Mt.set({ col: [0.3, 0.32, 0.34], rm: [0.4, 0.7, 0] });
  for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) Mt.beam([dx * 2, 6.0, dz * 2], [dx * 0.4, 11, dz * 0.4], 0.07, 0.07);
  for (let y = 7; y < 11; y += 1.3) { const k = (y - 6) / 5, r = 1 - k * 0.8; Mt.box(-r, y, -r, r, y + 0.05, r, { faces: 'xXzZ' }); }
  Mt.box(-0.25, 9.6, -2.6, 0.25, 9.7, 2.6); Mt.cyl(0, 11, 0, 0.08, 0.05, 13.2, 6);
  // the foredeck gun: a ring mount; the turret is its own mesh so it can turn
  Mt.set({ col: [0.22, 0.24, 0.24], rm: [0.4, 0.7, 0] });
  const gun = new THREE.Group(); gun.position.set(9.5, 1.9, 0);
  Mt.cyl(9.5, 1.6, 0, 1.0, 1.0, 1.95, 12);
  // nav lights (housing + emissive lens): red port, green starboard, white masthead, white stern
  Lt.set({ col: [1, 0.15, 0.1], rm: [0.3, 0, 0], em: em([1, 0.08, 0.05], 3, DUSK + DIST.ALWAYS) }); Lt.box(-0.3, 6.1, -2.3, 0.3, 6.4, -2.15);
  Lt.set({ col: [0.1, 1, 0.3], rm: [0.3, 0, 0], em: em([0.1, 1, 0.25], 3, DUSK + DIST.ALWAYS) }); Lt.box(-0.3, 6.1, 2.15, 0.3, 6.4, 2.3);
  Lt.set({ col: [1, 1, 1], rm: [0.3, 0, 0], em: em([1, 0.95, 0.85], 3, DUSK + DIST.ALWAYS) }); Lt.box(-0.15, 13.2, -0.15, 0.15, 13.5, 0.15);
  Mt.set({ col: [0.13, 0.14, 0.14], rm: [0.4, 0.6, 0], em: [0, 0, 0, 0] }); Mt.box(x0 + 0.3, 1.25, -0.06, x0 + 0.42, 2.25, 0.06); Mt.box(x0 + 0.24, 2.25, -0.1, x0 + 0.48, 2.3, 0.1);
  Lt.set({ col: [0.9, 0.9, 0.85], rm: [0.2, 0, 0], em: em([1, 0.95, 0.85], 1.2, DUSK + DIST.ALWAYS) }); Lt.cyl(x0 + 0.36, 2.3, 0, 0.07, 0.07, 2.44, 10); Mt.cyl(x0 + 0.36, 2.44, 0, 0.09, 0.08, 2.48, 10);
  // ---- polish (Nov 13): the details that make it read as a working warship up close, where you land on it
  const hwAt = (x, y) => { const i = clamp(Math.floor((x - x0) / L * 16), 0, 15), [, wd, yd, wc, yc] = sec[i]; return lerp(wc, wd, clamp((y - yc) / Math.max(0.1, yd - yc), 0, 1)); };
  // hull number on both bows: 7-segment digits (107), white stencil
  { const SEG = { 0: 'abcdef', 1: 'bc', 7: 'abc' }, sw = 0.12;
    A.set({ col: [0.86, 0.86, 0.83], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    for (const sd of [-1, 1]) [1, 0, 7].forEach((d, k) => {
      const xl = 6.4 + k * 0.95 * (sd > 0 ? 1 : -1) + (sd > 0 ? 0 : 1.9), y0 = 0.95, h = 0.9, w = 0.62, z = sd * (hwAt(xl + 0.3, 1.4) + 0.025);
      const bar = (u0, v0, u1, v1) => { const xa = sd > 0 ? xl + u0 : xl + w - u1, xb = sd > 0 ? xl + u1 : xl + w - u0; A.box(xa, y0 + v0, z - 0.02, xb, y0 + v1, z + 0.02, { faces: sd > 0 ? 'Z' : 'z' }); };
      for (const c of SEG[d]) ({ a: () => bar(0, h - sw, w, h), b: () => bar(w - sw, h / 2, w, h), c: () => bar(w - sw, 0, w, h / 2), d: () => bar(0, 0, w, sw), e: () => bar(0, 0, sw, h / 2), f: () => bar(0, h / 2, sw, h), g: () => bar(0, h / 2 - sw / 2, w, h / 2 + sw / 2) })[c]();
    });
  }
  // a rubbing strake along the sheer, rust weeping from the scuppers, lit portholes down both sides
  for (const sd of [-1, 1]) {
    Mt.set({ col: [0.2, 0.22, 0.23], rm: [0.5, 0.6, 0], em: [0, 0, 0, 0] });
    for (let i = 0; i < sec.length - 1; i++) { const [xa, wa, ya] = sec[i], [xb, wb, yb] = sec[i + 1]; Mt.beam([xa, ya - 0.18, sd * (wa + 0.04)], [xb, yb - 0.18, sd * (wb + 0.04)], 0.12, 0.1); }
    A.set({ col: [0.3, 0.17, 0.1], rm: [0.8, 0.2, 0] });
    for (let x = x0 + 2.2; x < 9; x += 2.6) { const z = sd * (hwAt(x, 1.0) + 0.012); A.box(x, 0.55, z - 0.006, x + 0.08 + (x % 3) * 0.03, 1.2, z + 0.006, { faces: sd > 0 ? 'Z' : 'z' }); }
    Lt.set({ col: [1, 0.85, 0.6], rm: [0.3, 0, 0], em: em([1, 0.78, 0.5], 1.6, DUSK + DIST.ALWAYS) });
    for (let x = -9; x < 5; x += 2.2) { const z = sd * (hwAt(x, 0.9) + 0.02); Lt.box(x, 0.78, z - 0.02, x + 0.3, 1.02, z + 0.02, { faces: sd > 0 ? 'Z' : 'z' }); }
  }
  // tyre fenders on ropes along the aft half, both sides
  { const T = B.get('plain', 'b'); T.set({ col: [0.035, 0.035, 0.04], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    for (const sd of [-1, 1]) for (let x = -13; x < 1; x += 3.4) { const z = sd * (hwAt(x, 0.8) + 0.2); T.tube([x - 0.12, 0.75, z], [x + 0.12, 0.75, z], 0.36, 8); T.beam([x, 0.95, z], [x, 1.3, sd * (hwAt(x, 1.25) - 0.05)], 0.03, 0.03, [0.45, 0.4, 0.3]); } }
  // the ensign on a staff over the transom (the boat's colours: a dark red field, a gold disc)
  { Mt.set({ col: [0.55, 0.55, 0.52], rm: [0.4, 0.8, 0] }); Mt.tube([x0 + 0.5, 1.25, 1.6], [x0 + 0.2, 5.0, 1.6], 0.035, 6);
    const F = B.get('dbl', 'b'); F.set({ col: [0.42, 0.04, 0.03], rm: [0.8, 0, 0], em: em([1, 0.4, 0.2], 0.04, DUSK + DIST.ALWAYS) });
    F.quad([x0 + 0.22, 4.95, 1.6], [x0 - 1.3, 4.85, 1.75], [x0 - 1.3, 3.95, 1.75], [x0 + 0.25, 4.05, 1.6]);
    F.set({ col: [0.75, 0.55, 0.12] }); F.quad([x0 - 0.35, 4.62, 1.69], [x0 - 0.75, 4.6, 1.72], [x0 - 0.75, 4.25, 1.72], [x0 - 0.35, 4.27, 1.69]); }
  // the bridge roof: a searchlight on a yoke (the lamp you see sweeping), whip antennas, two life-raft canisters
  Mt.set({ col: [0.25, 0.27, 0.28], rm: [0.4, 0.7, 0] });
  Mt.cyl(0.6, 6.0, 0, 0.12, 0.12, 6.25, 8); Mt.box(0.35, 6.25, -0.32, 0.85, 6.32, 0.32); Mt.box(0.35, 6.3, -0.34, 0.85, 6.7, -0.3); Mt.box(0.35, 6.3, 0.3, 0.85, 6.7, 0.34);
  Mt.tube([0.2, 6.45, 0], [1.05, 6.45, 0], 0.27, 10); Lt.set({ col: [1, 1, 0.95], em: em([1, 0.97, 0.9], 4, DUSK + DIST.ALWAYS) }); Lt.box(1.06, 6.22, -0.22, 1.1, 6.68, 0.22, { faces: 'X' });
  Mt.set({ col: [0.15, 0.15, 0.16] }); for (const [x, z, h] of [[-3.2, -2, 4.2], [-3.2, 2, 3.4], [2.8, 1.9, 3.8]]) Mt.tube([x, 6.0, z], [x - 0.2, 6.0 + h, z], 0.025, 4);
  { const R = B.get('plain', 'b'); R.set({ col: [0.86, 0.86, 0.82], rm: [0.5, 0, 0], em: [0, 0, 0, 0] });
    for (const z of [-1.7, 1.7]) { R.tube([-6.4, 3.95, z], [-4.7, 3.95, z], 0.3, 10); R.set({ col: [0.75, 0.25, 0.08] }); R.tube([-5.65, 3.95, z], [-5.45, 3.95, z], 0.31, 10); R.set({ col: [0.86, 0.86, 0.82] }); } }
  // the gun tub: a sandbagged ring round the foredeck mount (where the gunner stands), an ammo box
  { const Sb = B.get('plain', 'b'); for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 1.6 + Math.PI * 0.2 + Math.PI, c = Math.cos(a), sn = Math.sin(a), g2 = 0.85 + (k % 3) * 0.08;
      Sb.set({ col: [0.42 * g2, 0.38 * g2, 0.27 * g2], rm: [0.95, 0, 0], em: [0, 0, 0, 0] }); for (const yy of [1.45, 1.75]) Sb.obox(9.5 + c * 1.75, yy + 0.15, sn * 1.75, 0.38, 0.15, 0.22, -a + Math.PI / 2); }
    Mt.set({ col: [0.22, 0.27, 0.18], rm: [0.6, 0.4, 0] }); Mt.box(7.5, 1.6, 1.3, 8.1, 1.95, 1.75); }
  // deck floods on the deckhouse's aft corners: a warm pool on the aft deck you land on
  // the deck floods: caged housings on the deckhouse roof's aft corners, tilted down at the aft deck (their pools are baked
  // into the deck's vertices above), and one at the foot of the mast over the foredeck
  for (const [fx, fy, fz, dir] of [[-7.3, 3.68, -2.3, -1], [-7.3, 3.68, 2.3, -1], [4.62, 3.68, 0, 1]]) {
    // a short can on a yoke, aimed down at the deck; the lens a warm disc (dim enough not to blow out)
    const T0 = new THREE.Matrix4().makeRotationZ(dir * (Math.PI / 2 + 0.6)).setPosition(fx, fy + 0.22, fz);
    const hsv = Mt.push(T0); Mt.set({ col: [0.13, 0.14, 0.14], rm: [0.4, 0.6, 0] }); Mt.cyl(0, -0.05, 0, 0.13, 0.15, 0.22, 12, { cap: false }); Mt.cyl(0, -0.08, 0, 0.1, 0.12, -0.05, 12); Mt.pop(hsv);
    const lsv = Lt.push(T0); Lt.set({ col: [0.9, 0.85, 0.7], rm: [0.2, 0, 0], em: em([1, 0.85, 0.6], 1.5, ALW) }); Lt.cyl(0, 0.2, 0, 0.12, 0.12, 0.215, 12); Lt.pop(lsv);
    Mt.set({ col: [0.13, 0.14, 0.14] }); Mt.box(fx - 0.03, 3.62, fz - 0.03, fx + 0.03, fy + 0.2, fz + 0.03, { faces: 'xXzZ' }); Mt.box(fx - 0.2, fy + 0.16, fz - 0.025, fx + 0.2, fy + 0.2, fz + 0.025);
  }
  // the stern: mooring bitts, a fairlead, two coils of line, a towing hook on the transom
  Mt.set({ col: [0.12, 0.12, 0.13], rm: [0.45, 0.6, 0] });
  for (const sd of [-1, 1]) { for (const dx of [0, 0.55]) Mt.cyl(-14.9 + dx, 1.25, sd * 2.7, 0.14, 0.14, 1.72, 10); Mt.box(-14.95, 1.25, sd * 2.7 - 0.18, -14.3, 1.32, sd * 2.7 + 0.18); }
  A.set({ col: [0.16, 0.13, 0.09], rm: [0.95, 0, 0], em: [0, 0, 0, 0] });
  for (const [cx, cz] of [[-11.0, -1.95], [-9.7, 2.2]]) { const turns = 5, N = 24 * turns; let prev = null;
    for (let k = 0; k <= N; k++) { const t = k / N, a = t * turns * Math.PI * 2, R = 0.44 - t * 0.26, y = 1.25 + 0.033 + (k % 24 < 12 ? 0.004 : 0), p = [cx + Math.cos(a) * R, y + t * 0.02, cz + Math.sin(a) * R];
      if (prev) A.tube(prev, p, 0.032, 6); prev = p; } }
  // a deck hatch with its dogs, tie-down rings, two ammo crates (cover), oil stains
  { St.set({ col: mul3(PAINT, 0.75) }); St.box(-13.0, 1.25, -0.55, -11.9, 1.45, 0.55, { faces: 'xXzZY', s: 1 }); St.set({ col: mul3(PAINT, 0.6) }); St.box(-12.9, 1.45, -0.45, -12.0, 1.47, 0.45, { faces: 'Y', s: 1 });
    Mt.set({ col: [0.2, 0.2, 0.2], rm: [0.4, 0.7, 0] }); for (const [x, z] of [[-13.05, 0], [-11.85, 0], [-12.45, -0.6], [-12.45, 0.6]]) Mt.box(x - 0.05, 1.3, z - 0.05, x + 0.05, 1.42, z + 0.05);
    for (const [x, z] of [[-9.5, -2.0], [-12.0, -2.2], [-15.2, 1.6], [-15.2, -1.6]]) { Mt.box(x - 0.09, 1.25, z - 0.09, x + 0.09, 1.27, z + 0.09, { faces: 'xXzZY' }); torus(Mt, [x, 1.285, z], [1, 0, 0], [0, 0, 1], 0.065, 0.013, 12, 4, () => [0.2, 0.2, 0.2]); }
    const Cr = B.get('steel', 'b'); for (const [x, z, yw, t] of [[-11.6, 1.85, 0.08, 0], [-11.6, 1.85, -0.05, 1]]) { Cr.set({ col: [0.2, 0.24, 0.15], rm: [0.6, 0.3, 0] }); Cr.obox(x, 1.25 + 0.2 + t * 0.4, z, 0.5, 0.2, 0.3, yw, { faces: 'xXzZY', s: 1 });
      A.set({ col: [0.6, 0.55, 0.3] }); A.obox(x, 1.25 + 0.2 + t * 0.4, z + 0.301, 0.3, 0.05, 0.002, yw, { faces: 'Z' }); }
  }
  Mt.set({ col: [0.2, 0.21, 0.22] }); Mt.box(x0 - 0.12, 1.6, -0.3, x0 + 0.05, 1.9, 0.3); Mt.tube([x0 - 0.12, 1.75, 0], [x0 - 0.4, 1.5, 0], 0.05, 6);
  B.finish(g);
  const B2 = new Buckets(); for (const [k, m] of Object.entries(M)) B2.mat(k, m);
  // a twin heavy-MG mount: a pedestal, the cradle, an angled shield, two barrels with flash hiders, ammo cans
  const G = B2.get('metal', 'g'); G.set({ col: [0.2, 0.23, 0.21], rm: [0.45, 0.6, 0], em: [0, 0, 0, 0] });
  G.cyl(0, -0.3, 0, 0.28, 0.24, 0.55, 10);
  G.box(-0.55, 0.55, -0.42, 0.35, 1.05, 0.42, { faces: 'xXzZY' });
  G.quad([0.55, 0.45, -0.95], [0.55, 0.45, 0.95], [0.3, 1.55, 0.85], [0.3, 1.55, -0.85]); G.quad([0.5, 0.45, 0.95], [0.5, 0.45, -0.95], [0.25, 1.55, -0.85], [0.25, 1.55, 0.85]);
  for (const z of [-0.18, 0.18]) { G.tube([0.2, 0.85, z], [2.6, 0.88, z], 0.05, 6); G.tube([2.45, 0.875, z], [2.75, 0.88, z], 0.075, 6); }
  G.set({ col: [0.24, 0.28, 0.18] }); for (const z of [-0.62, 0.62]) G.box(-0.4, 0.62, z - 0.14, 0.1, 0.92, z + 0.14, { faces: 'xXzZY' });
  G.set({ col: [0.1, 0.1, 0.1] }); G.box(-0.85, 0.75, -0.06, -0.55, 0.85, 0.06);   // spade grips
  B2.finish(gun); g.add(gun);
  // the stern: red fuel drums lashed by the rail (the boat's weak spot)
  const drums = new THREE.Group(); const B3 = new Buckets(); for (const [k, m] of Object.entries(M)) B3.mat(k, m);
  // (on a pallet, under a ratchet strap: ribbed steel drums, chipped red with grey lids and a hazard label)
  const Dr = B3.get('steel', 'd'), Pw = B3.get('wood', 'd'), Ds = B3.get('plain', 'd');
  Pw.set({ col: [0.34, 0.26, 0.18], rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); for (let k = 0; k < 5; k++) Pw.box(-14.55, 1.25, -2.45 + k * 0.6, -12.45, 1.37, -2.3 + k * 0.6, { faces: 'xXzZY', s: 1 });
  for (const [x, z, t] of [[-14, -1.9, 0], [-14, -0.9, 1], [-13, -1.9, 2], [-13, -0.9, 0], [-14, 0.1, 1], [-13, 0.1, 2]]) {
    const c = [[0.4, 0.08, 0.05], [0.44, 0.17, 0.06], [0.3, 0.06, 0.05], [0.18, 0.24, 0.3]][(t + Math.round(x + z * 3)) & 3];
    // (each leans a little and turns its own way: a row of identical upright cylinders read as placeholders)
    const T0 = new THREE.Matrix4().makeRotationY(t * 1.3 + x).premultiply(new THREE.Matrix4().makeRotationX((t - 1) * 0.035)).setPosition(x, 1.37, z);
    const sv1 = Dr.push(T0), sv2 = Ds.push(T0);
    Dr.set({ col: c, rm: [0.5, 0.35, 0], em: [0, 0, 0, 0] }); Dr.cyl(0, 0, 0, 0.29, 0.29, 0.88, 20, { cap: false, uS: 1 });
    for (const yy of [0.29, 0.59]) Dr.cyl(0, yy, 0, 0.302, 0.302, yy + 0.04, 20, { cap: false }); Dr.cyl(0, 0.85, 0, 0.3, 0.3, 0.89, 20, { cap: false });
    Ds.set({ col: [0.3, 0.31, 0.31], rm: [0.4, 0.6, 0], em: [0, 0, 0, 0] }); Ds.cyl(0, 0.88, 0, 0.285, 0.28, 0.9, 20); Ds.set({ col: [0.12, 0.12, 0.12] }); Ds.cyl(0.14, 0.9, 0.08, 0.04, 0.04, 0.925, 8); Ds.cyl(-0.15, 0.9, -0.06, 0.025, 0.025, 0.915, 6);
    Ds.set({ col: [0.6, 0.48, 0.1], rm: [0.7, 0, 0] }); Ds.box(-0.08, 0.38, -0.296, 0.08, 0.53, -0.29, { faces: 'z' });
    Dr.pop(sv1); Ds.pop(sv2);
  }
  Ds.set({ col: [0.65, 0.5, 0.08], rm: [0.8, 0, 0] }); for (const x of [-14.3, -12.75]) Ds.box(x, 2.28, -2.25, x + 0.05, 2.3, 0.45, { faces: 'Y' });
  B3.finish(drums); g.add(drums);
  // the wake: a foam V spreading behind the stern, and the bow wave (noise-streaked, scrolling with the boat)
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: RIVER_U.uTime },
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform float uTime; varying vec2 vUv; varying vec3 vW;
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
      void main(){
        float along = vUv.y, across = abs(vUv.x - 0.5) * 2.0;
        float edge = smoothstep(0.55, 0.95, across) * 0.8 + (1.0 - smoothstep(0.0, 0.35, across)) * 0.9 * (1.0 - along);   // the two arms + the churned centre
        float n = vn(vec2(vUv.x * 18.0, vUv.y * 40.0 - uTime * 1.6)) * vn(vec2(vUv.x * 7.0 + 3.0, vUv.y * 13.0 - uTime * 0.9));
        float a = edge * smoothstep(0.18, 0.55, n) * (1.0 - smoothstep(0.35, 1.0, along)) * smoothstep(0.0, 0.03, along);
        gl_FragColor = vec4(vec3(0.62, 0.64, 0.66) * 0.55, a * 0.75);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const wake = new THREE.Mesh(new THREE.BufferGeometry(), wakeMat);
  { // a trapezoid from the stern (6 m wide) out to 70 m behind (34 m wide), on the water
    const p = [], uv = [], idx = [];
    const xs = x0 + 0.5, len = 70;
    for (let i = 0; i <= 10; i++) { const t = i / 10, x = xs - t * len, w = 3.2 + t * 17; p.push(x, -0.12, -w, x, -0.12, w); uv.push(0, t, 1, t); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    wake.geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); wake.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wake.geometry.setIndex(idx);
  }
  wake.renderOrder = 16; wake.frustumCulled = false; g.add(wake);
  g.userData = { gun, drums, wake, deck: new THREE.Vector3(-8.5, 1.3, 0.8), lamp: new THREE.Vector3(0.6, 6.4, 0), gunner: new THREE.Vector3(8.2, 1.25, 0), crew: [new THREE.Vector3(-5, 1.25, -2.4), new THREE.Vector3(5.8, 1.6, 2.4)], drumsP: new THREE.Vector3(-13.5, 1.7, -1.2),
    nav: [[new THREE.Vector3(0, 6.25, -2.4), [3, 0.15, 0.1]], [new THREE.Vector3(0, 6.25, 2.4), [0.15, 3, 0.4]], [new THREE.Vector3(0, 13.4, 0), [3, 2.9, 2.6]],
      [new THREE.Vector3(-7.52, 3.74, -2.3), [1.2, 1.0, 0.7]], [new THREE.Vector3(-7.52, 3.74, 2.3), [1.2, 1.0, 0.7]], [new THREE.Vector3(4.84, 3.74, 0), [1.2, 1.0, 0.7]], [new THREE.Vector3(x1 - 1, 2.9, 0), [1.4, 1.2, 0.8]]],
    funnel: new THREE.Vector3(-5.3, 6.7, 0) };
  return g;
}

// what the landslide put in the river: burning wreckage drifting downstream past the gunboat (the outro's foreground).
// kind 0: a tiled roof section riding on its rafters; 1: a city bus on its side, half under; 2: a raft of timbers, a
// door, a shop sign; 3: a shipping container nose-down. userData.fire = where its fire sits (local), userData.tilt.
export function buildWreck(kind, seed = 1) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const g = new THREE.Group(); g.name = 'wreck';
  const r = makeRng(seed * 131 + kind);
  const A = B.get('plain', 'w'), Wd = B.get('wood', 'w'), St = B.get('steel', 'w'), Rf = B.get('roof', 'w');
  const CH = [0.05, 0.045, 0.04];   // charred
  let fire = [0, 1, 0], tilt = [0, 0];
  // everything on a burning wreck is lit by its own fire: a warm emissive on every surface (the fire's flicker on top comes
  // from the pooled point lights), so it reads as burning debris rather than a black box with a flame on it
  const FL = em([1, 0.4, 0.1], 0.12, DUSK + DIST.ALWAYS);
  const setF = (Acc) => { const s0 = Acc.set.bind(Acc); Acc.set = (o) => s0({ ...o, em: o.em && o.em[3] === 0 && o.em[0] === 0 ? FL : (o.em ?? FL) }); };
  for (const Acc of [A, Wd, St, Rf]) setF(Acc);
  if (kind === 0) {
    Rf.set({ col: [0.2, 0.12, 0.09], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
    Rf.quad([-4.5, 0.2, -3], [4.5, 0.2, -3], [4.5, 2.4, 0], [-4.5, 2.4, 0], [-4.5, 0, 4.5, 3.6]); Rf.quad([4.5, 0.2, 3], [-4.5, 0.2, 3], [-4.5, 2.4, 0], [4.5, 2.4, 0], [-4.5, 0, 4.5, 3.6]);
    A.set({ col: CH, rm: [0.95, 0, 0], em: [0, 0, 0, 0] }); for (const [x0, z0, x1, z1] of [[-1.5, -2.6, 0.8, -0.6], [1.6, 0.8, 3.5, 2.6]]) A.quad([x0, 0.4 + (z0 + 3) * 0.73 + 0.02, z0], [x1, 0.4 + (z0 + 3) * 0.73 + 0.02, z0], [x1, 0.4 + (z1 + 3) * 0.73 * (z1 < 0 ? 1 : 0) + 0.02, z1], [x0, 0.4 + (z1 + 3) * 0.73 * (z1 < 0 ? 1 : 0) + 0.02, z1]);
    Wd.set({ col: [0.2, 0.14, 0.09], rm: [0.9, 0, 0] }); for (let x = -4.2; x < 4.4; x += 0.9) Wd.beam([x, 0.1, -3.2], [x + (r() - 0.5) * 0.3, 2.5, 0.1], 0.12, 0.12); Wd.beam([-5, 2.4, 0], [4.8, 2.45, 0], 0.18, 0.18);
    A.set({ col: [0.6, 0.55, 0.48] }); A.box(-2.5, 0.2, 1.2, -1.4, 1.4, 1.35, { faces: 'zZxXY' });   // a chimney stub
    fire = [0.5, 2.2, -0.3]; tilt = [0.12, -0.08];
  } else if (kind === 1) {
    // the bus, lying on its right side: roof toward the boat, windows a dark row along the top
    St.set({ col: [0.1, 0.2, 0.18], rm: [0.6, 0.3, 0], em: [0, 0, 0, 0] }); St.box(-5.5, -1.2, -1.25, 5.5, 1.3, 1.25, { faces: 'xXzZY', s: 1, foot: 0.5 });
    A.set({ col: [0.03, 0.035, 0.04], rm: [0.15, 0.4, 0], em: [0, 0, 0, 0] }); for (let x = -4.8; x < 4.6; x += 1.25) A.box(x, 0.2, 1.25, x + 1.05, 1.05, 1.27, { faces: 'Z' });
    A.set({ col: [0.36, 0.34, 0.3] }); A.box(-5.2, -0.4, 1.25, 5.2, -0.15, 1.27, { faces: 'Z' });
    A.set({ col: CH }); A.box(-1.5, 1.3, -1.0, 2.8, 1.32, 1.0, { faces: 'Y' });
    A.set({ col: [0.02, 0.02, 0.02] }); for (const x of [-3.6, 3.4]) A.cyl(x, 1.3, -1.25, 0.55, 0.55, 1.62, 12);
    fire = [0.8, 1.6, 0]; tilt = [0.06, 0.1];
  } else if (kind === 2) {
    Wd.set({ col: [0.26, 0.18, 0.11], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    for (let k = 0; k < 9; k++) { const a = (r() - 0.5) * 0.9, L = 3 + r() * 4, cx = (r() - 0.5) * 3, cz = (r() - 0.5) * 3, y = 0.1 + (k % 3) * 0.22; Wd.beam([cx - Math.cos(a) * L / 2, y, cz - Math.sin(a) * L / 2], [cx + Math.cos(a) * L / 2, y + 0.05, cz + Math.sin(a) * L / 2], 0.22, 0.2); }
    A.set({ col: [0.45, 0.12, 0.08], rm: [0.7, 0, 0], em: [0, 0, 0, 0] }); A.obox(0.4, 0.55, -0.6, 1.1, 0.04, 0.5, 0.4, { faces: 'yY' });
    A.set({ col: [0.55, 0.45, 0.2] }); A.obox(-0.9, 0.62, 0.7, 1.0, 0.03, 0.3, -0.3, { faces: 'yY' });
    fire = [0, 0.8, 0]; tilt = [0.04, 0.05];
  } else {
    St.set({ col: [0.26, 0.13, 0.08], rm: [0.7, 0.4, 0], em: [0, 0, 0, 0] }); St.box(-6, -1.3, -1.22, 6, 1.3, 1.22, { faces: 'xXzZY', s: 1, foot: 0.5 });
    St.set({ col: [0.14, 0.08, 0.05] }); for (let x = -5.6; x < 5.8; x += 0.4) St.box(x, -1.2, 1.22, x + 0.12, 1.2, 1.25, { faces: 'Z', s: 1 });
    A.set({ col: CH }); A.box(1.2, 0.2, 1.255, 6, 1.3, 1.26, { faces: 'Z' });   // the burnt end
    A.set({ col: CH, rm: [0.95, 0, 0], em: [0, 0, 0, 0] }); A.box(-1, 1.3, -1.1, 4, 1.32, 1.1, { faces: 'Y' });
    fire = [2.5, 1.5, 0]; tilt = [0.0, 0.22];
  }
  B.finish(g);
  g.userData = { fire: new THREE.Vector3(...fire), tilt };
  return g;
}

// an armed river barge (a Yangtze push-barge with its own wheelhouse): a long black hull with a raked spoon bow and a
// red-oxide bottom, a hold of containers or a heaped sand cargo, a white two-tier wheelhouse aft with lit windows and a
// searchlight on its roof, fenders, bollards, nav lights, a sandbagged nest on the open deck. x = forward, deck at y 2.0.
// userData: lamp (the searchlight), crew (where the gunmen stand), nav (glow points), len.
export function buildBarge({ len = 36, beam = 10, cargo = 'boxes', seed = 1, lit = true } = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const g = new THREE.Group(); g.name = 'barge';
  const A = B.get('plain', 'g'), Mt = B.get('metal', 'g'), W = B.get('win', 'g'), Lt = B.get('plain', 'g');
  const L = len, x0 = -L / 2, x1 = L / 2, hw = beam / 2, DECK = 2.0, k = (v) => v * L / 36;
  const code = DUSK + DIST.ALWAYS;
  const HULL = [0.055, 0.055, 0.06], OX = [0.3, 0.09, 0.06];
  // hull: flat sides; the last 14 % rakes up into a spoon bow
  const N = 12, sec = [];
  for (let i = 0; i <= N; i++) { const u = i / N, x = x0 + L * u, b = Math.max(0, (u - 0.86) / 0.14);
    sec.push([x, hw * (1 - b * b * 0.35), DECK + b * 0.5, -1.2 + b * b * 2.4]); }
  for (let i = 0; i < N; i++) { const [xa, wa, ya, ka] = sec[i], [xb, wb, yb, kb] = sec[i + 1];
    for (const sd of [-1, 1]) {
      const q = (p0, p1, p2, p3, col) => { A.set({ col, rm: [0.7, 0.3, 0], em: [0, 0, 0, 0] }); if (sd > 0) A.quad(p0, p1, p2, p3); else A.quad(p0, p3, p2, p1); };
      q([xa, Math.max(ka, 0.25), sd * wa], [xb, Math.max(kb, 0.25), sd * wb], [xb, yb, sd * wb], [xa, ya, sd * wa], i % 2 ? HULL : mul3(HULL, 1.2));
      q([xa, ka, sd * wa * 0.92], [xb, kb, sd * wb * 0.92], [xb, Math.max(kb, 0.25), sd * wb], [xa, Math.max(ka, 0.25), sd * wa], OX);
    }
    A.set({ col: OX }); A.quad([xa, ka, -wa * 0.92], [xb, kb, -wb * 0.92], [xb, kb, wb * 0.92], [xa, ka, wa * 0.92]);
  }
  { const [x, w, y, kk] = sec[0]; A.set({ col: mul3(HULL, 1.1) }); A.quad([x, kk, w * 0.92], [x, y, w], [x, y, -w], [x, kk, -w * 0.92]); }
  { const [x, w, y, kk] = sec[N]; A.set({ col: mul3(HULL, 1.1) }); A.quad([x, kk, -w * 0.92], [x, y, -w], [x, y, w], [x, kk, w * 0.92]); }
  // the deck (dark steel, worn), a coaming lip, rust streaks down the topsides, a name board on the bow
  const D = B.get('metal', 'g'); D.set({ col: [0.16, 0.15, 0.14], rm: [0.8, 0.4, 0], em: em([1, 0.75, 0.5], lit ? 0.02 : 0, code) });
  for (let i = 0; i < N; i++) { const [xa, wa, ya] = sec[i], [xb, wb, yb] = sec[i + 1]; D.quad([xa, ya, wa], [xb, yb, wb], [xb, yb, -wb], [xa, ya, -wa]); }
  Mt.set({ col: [0.6, 0.18, 0.08], rm: [0.6, 0.4, 0], em: [0, 0, 0, 0] });
  for (let i = 0; i < N; i++) for (const sd of [-1, 1]) { const [xa, wa, ya] = sec[i], [xb, wb, yb] = sec[i + 1]; Mt.beam([xa, ya + 0.22, sd * (wa - 0.12)], [xb, yb + 0.22, sd * (wb - 0.12)], 0.24, 0.44); }
  A.set({ col: [0.28, 0.12, 0.06], rm: [0.8, 0.2, 0] });
  for (const sd of [-1, 1]) for (let x = x0 + 1.5; x < x1 - 5; x += 2.3 + ((x * 7) % 3) * 0.4) A.box(x, 0.7, sd * (hw + 0.01) - 0.005, x + 0.1, DECK - 0.1, sd * (hw + 0.01) + 0.005, { faces: sd > 0 ? 'Z' : 'z' });
  A.set({ col: [0.82, 0.8, 0.74] }); for (const sd of [-1, 1]) A.box(x1 - k(9), DECK - 0.75, sd * (hw * 0.95 + 0.03) - 0.01, x1 - k(5), DECK - 0.35, sd * (hw * 0.95 + 0.03) + 0.01, { faces: sd > 0 ? 'Z' : 'z' });
  // fenders (old tyres) and bollards
  const T = B.get('plain', 'g'); T.set({ col: [0.03, 0.03, 0.035], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
  for (const sd of [-1, 1]) for (let x = x0 + 2; x < x1 - 4; x += k(4.2)) T.tube([x - 0.13, 1.2, sd * (hw + 0.22)], [x + 0.13, 1.2, sd * (hw + 0.22)], 0.42, 8);
  Mt.set({ col: [0.12, 0.12, 0.13], rm: [0.5, 0.6, 0] });
  for (const [x, z] of [[x0 + 1.2, -hw + 0.6], [x0 + 1.2, hw - 0.6], [x1 - 2, -hw * 0.6], [x1 - 2, hw * 0.6], [0, -hw + 0.6], [0, hw - 0.6]]) { Mt.cyl(x, DECK, z, 0.22, 0.22, DECK + 0.5, 8); Mt.cyl(x, DECK + 0.5, z, 0.3, 0.3, DECK + 0.58, 8); }
  // the cargo, in the hold forward of the wheelhouse
  const hx0 = x0 + k(11), hx1 = x1 - k(4);
  if (cargo === 'boxes') {
    const COLS = [[0.45, 0.08, 0.05], [0.07, 0.2, 0.35], [0.5, 0.36, 0.08], [0.15, 0.28, 0.16], [0.35, 0.35, 0.36]];
    const C = B.get('metal', 'g'); let n = seed;
    for (let x = hx0; x + 6.1 <= hx1 + 0.1; x += 6.25) for (const z of [-2.5, 0, 2.5]) { if (z === 0 && ((n * 13) % 5) === 0) { n++; continue; }
      const hgt = ((n * 7) % 3) === 0 ? 2 : 1; for (let t = 0; t < hgt; t++) { const c = COLS[(n * 31 + t * 7) % COLS.length]; n++;
        C.set({ col: c, rm: [0.7, 0.4, 0], em: [0, 0, 0, 0] }); const y = DECK + t * 2.6; C.box(x, y, z - 1.2, x + 6.05, y + 2.55, z + 1.2, { faces: 'xXzZY' });
        C.set({ col: mul3(c, 0.6) }); for (let u = x + 0.4; u < x + 6; u += 0.45) for (const zz of [z - 1.205, z + 1.205]) C.box(u, y + 0.1, zz - 0.006, u + 0.07, y + 2.45, zz + 0.006, { faces: zz < z ? 'z' : 'Z' });
        C.set({ col: mul3(c, 0.5) }); C.box(x + 6.05, y + 0.15, z - 1.0, x + 6.07, y + 2.4, z + 1.0, { faces: 'X' }); } }
  } else {
    // sand: a long heap in the hold with a timber hold-side
    const Wd = B.get('wood', 'g'); Wd.set({ col: [0.22, 0.17, 0.12], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    for (const sd of [-1, 1]) Wd.box(hx0, DECK, sd * (hw - 0.6) - 0.1, hx1, DECK + 1.3, sd * (hw - 0.6) + 0.1, { faces: 'xXzZY', s: 1 });
    Wd.box(hx0 - 0.2, DECK, -hw + 0.5, hx0, DECK + 1.3, hw - 0.5, { faces: 'xXY', s: 1 }); Wd.box(hx1, DECK, -hw + 0.5, hx1 + 0.2, DECK + 1.3, hw - 0.5, { faces: 'xXY', s: 1 });
    const Sd = B.get('dbl', 'g'); const ridge = (x) => DECK + 1.2 + 2.6 * Math.pow(Math.abs(Math.sin(3 * Math.PI * (x - hx0) / (hx1 - hx0))), 0.75) * (0.85 + 0.15 * Math.sin(x * 0.9 + seed));   // three heaps
    for (let x = hx0; x < hx1 - 0.01; x += 0.9) { const xb = Math.min(hx1, x + 0.9), ya = ridge(x), yb = ridge(xb), e = DECK + 1.25;
      for (const sd of [-1, 1]) { Sd.set({ col: sd > 0 ? [0.52, 0.43, 0.3] : [0.44, 0.36, 0.25], rm: [0.95, 0, 0], em: [0, 0, 0, 0] }); const w0 = hw - 0.7;
        if (sd > 0) Sd.quad([x, e, w0], [xb, e, w0], [xb, yb, 0], [x, ya, 0]); else Sd.quad([x, ya, 0], [xb, yb, 0], [xb, e, -w0], [x, e, -w0]); } }
  }
  // the wheelhouse aft: a white deckhouse, the wheelhouse on top with windows all round, a funnel, a mast and the lamp
  const wx0 = x0 + k(1.5), wx1 = x0 + k(8.5);
  A.set({ col: [0.72, 0.72, 0.68], rm: [0.6, 0.1, 0], em: [0, 0, 0, 0] });
  A.box(wx0, DECK, -hw + 0.8, wx1, DECK + 2.5, hw - 0.8, { faces: 'xXzZY' });
  A.box(wx0 + 1, DECK + 2.5, -2.4, wx1 - 1.2, DECK + 4.6, 2.4, { faces: 'xXzZ' });
  A.set({ col: [0.6, 0.6, 0.56] }); A.box(wx0 + 0.8, DECK + 4.6, -2.7, wx1 - 1, DECK + 4.8, 2.7, { faces: 'xXzZYy' });
  A.set({ col: [0.3, 0.3, 0.29] }); for (let x = wx0 + 0.6; x < wx1; x += 1.5) for (const sd of [-1, 1]) A.box(x, DECK + 0.3, sd * (hw - 0.8) - 0.01, x + 0.6, DECK + 1.6, sd * (hw - 0.8) + 0.01, { faces: sd > 0 ? 'Z' : 'z' });
  W.set({ col: [0.2, 0.22, 0.24], rm: [0.25, 0, 0], em: em([0.95, 0.9, 0.7], lit ? 0.4 : 0.05, code), cell: [0, 0, 0, 0] });
  W.box(wx0 + 0.98, DECK + 3.2, -2.42, wx1 - 1.18, DECK + 4.3, 2.42, { faces: 'xXzZ', s: 1, wy0: DECK + 3.1 });
  A.set({ col: [0.08, 0.08, 0.08] }); A.box(wx0 + 1.8, DECK + 4.8, -0.5, wx0 + 2.8, DECK + 6.2, 0.5, { faces: 'xXzZY' });
  A.set({ col: [0.55, 0.08, 0.05] }); A.box(wx0 + 1.79, DECK + 5.5, -0.51, wx0 + 2.81, DECK + 5.8, 0.51, { faces: 'xXzZ' });
  const lx = wx1 - 2.2; Mt.set({ col: [0.25, 0.26, 0.27], rm: [0.4, 0.7, 0] }); Mt.cyl(lx, DECK + 4.8, 0, 0.08, 0.06, DECK + 7.8, 6);
  Mt.cyl(lx, DECK + 4.8, 0, 0.16, 0.16, DECK + 5.0, 8); Mt.tube([lx - 0.35, DECK + 5.25, 0], [lx + 0.4, DECK + 5.25, 0], 0.26, 10);
  Lt.set({ col: [1, 1, 0.95], rm: [0.3, 0, 0], em: em([1, 0.97, 0.9], lit ? 4 : 0, code) }); Lt.box(lx + 0.41, DECK + 5.05, -0.2, lx + 0.44, DECK + 5.45, 0.2, { faces: 'X' });
  Lt.set({ col: [1, 0.15, 0.1], em: em([1, 0.08, 0.05], lit ? 3 : 0, code) }); Lt.box(wx1 - 1.6, DECK + 4.0, -2.75, wx1 - 1.3, DECK + 4.25, -2.6);
  Lt.set({ col: [0.1, 1, 0.3], em: em([0.1, 1, 0.25], lit ? 3 : 0, code) }); Lt.box(wx1 - 1.6, DECK + 4.0, 2.6, wx1 - 1.3, DECK + 4.25, 2.75);
  Lt.set({ col: [1, 0.9, 0.7], em: em([1, 0.8, 0.55], lit ? 2.6 : 0, code) }); Lt.box(wx1 + 0.02, DECK + 2.2, -0.3, wx1 + 0.1, DECK + 2.4, 0.3, { faces: 'Xy' });
  // a sandbag nest on the open deck between the wheelhouse and the cargo (where the gunmen work)
  const nx = wx1 + 1.6;
  { const Sb = B.get('plain', 'g'); for (let i = 0; i < 9; i++) for (const yy of [0, 0.3]) { const z = -2.8 + i * 0.7, g2 = 0.85 + ((i + yy * 10) % 3) * 0.07;
      Sb.set({ col: [0.4 * g2, 0.36 * g2, 0.25 * g2], rm: [0.95, 0, 0], em: [0, 0, 0, 0] }); Sb.obox(nx + 1.2, DECK + 0.15 + yy, z + (yy ? 0.35 : 0), 0.25, 0.15, 0.36, 0); } }
  B.finish(g);
  const span = (L / 2) | 0;
  g.userData = { len: L, deckY: DECK, lamp: new THREE.Vector3(lx + 0.3, DECK + 5.25, 0), crew: [new THREE.Vector3(nx + 0.4, DECK, 1.6), new THREE.Vector3(nx + 0.4, DECK, -1.8)],
    nav: lit ? [[new THREE.Vector3(wx1 - 1.45, DECK + 4.12, -2.8), [3, 0.15, 0.1]], [new THREE.Vector3(wx1 - 1.45, DECK + 4.12, 2.8), [0.15, 3, 0.4]], [new THREE.Vector3(lx, DECK + 7.9, 0), [3, 2.9, 2.6]], [new THREE.Vector3(wx1 + 0.2, DECK + 2.3, 0), [1.6, 1.3, 0.9]]] : [], span };
  return g;
}
export { BOAT, WATER_Y };
