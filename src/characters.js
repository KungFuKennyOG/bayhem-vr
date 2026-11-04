import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeRng } from './rng.js';

// =====================================================================================
//  BAYHEM characters: one SkinnedMesh (1 draw call) per person, one shared vertex-coloured
//  material. Sculpted lofted bodies (superellipse rings), a sculpted head (skull, jaw, nose,
//  brow, cheekbones, ears), plate carrier gear, and a bake of AO + cavity + cloth folds into
//  vertex colours. Gunmen: procedural aim/IK + verlet/PBD ragdoll. Driver: seated hero
//  sidekick for the player's pickup (steering, mirror checks, glances back, talking).
//  Model space: forward = -z, up = +y, the character's right = +x.
// =====================================================================================

// ---------------- skeleton ----------------
export const BONE = {
  pelvis: 0, spine: 1, chest: 2, neck: 3, head: 4,
  clavL: 5, uarmL: 6, farmL: 7, handL: 8, clavR: 9, uarmR: 10, farmR: 11, handR: 12,
  thighL: 13, shinL: 14, footL: 15, thighR: 16, shinR: 17, footR: 18, gun: 19, mag: 20,
};
const B = BONE;
const NB = 21;
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 2, 9, 10, 11, 0, 13, 14, 0, 16, 17, -1, -1];
const UA = 0.3, FA = 0.265, TH = 0.42, SH = 0.415;
const SHX = 0.19, ELX = SHX + UA, WRX = ELX + FA, HIPX = 0.095;
const GUN0 = new THREE.Vector3(0.34, 1.12, -0.55); // bind placement of the rifle (irrelevant after skinning)
const MAG_OFF = new THREE.Vector3(0, -0.02, -0.36); // mag well in rifle space
const HEADS = [
  [0, 0.97, 0], [0, 1.075, 0], [0, 1.22, 0], [0, 1.49, -0.005], [0, 1.585, -0.008],
  [-0.035, 1.45, 0], [-SHX, 1.44, 0], [-ELX, 1.44, 0], [-WRX, 1.44, 0],
  [0.035, 1.45, 0], [SHX, 1.44, 0], [ELX, 1.44, 0], [WRX, 1.44, 0],
  [-HIPX, 0.92, 0], [-HIPX, 0.92 - TH, 0], [-HIPX, 0.92 - TH - SH, 0],
  [HIPX, 0.92, 0], [HIPX, 0.92 - TH, 0], [HIPX, 0.92 - TH - SH, 0],
  [GUN0.x, GUN0.y, GUN0.z], [GUN0.x + MAG_OFF.x, GUN0.y + MAG_OFF.y, GUN0.z + MAG_OFF.z],
].map(a => new THREE.Vector3(...a));
const OFF = HEADS.map((h, i) => (PARENT[i] < 0 ? h.clone() : h.clone().sub(HEADS[PARENT[i]])));
const HEAD_C = new THREE.Vector3(0, 1.672, -0.012); // head centre (bind)
const HEAD_C_LOCAL = HEAD_C.clone().sub(HEADS[B.head]);

// rifle-space constants (origin = butt pad, barrel along -z)
const MUZZLE = new THREE.Vector3(0, 0.036, -0.8);
const POCKET = new THREE.Vector3(0.12, 0.245, -0.145); // chest-space shoulder pocket
const GRIP_R = new THREE.Vector3(0.026, -0.066, -0.245); // right palm centre on the pistol grip
const GRIP_L = new THREE.Vector3(-0.012, -0.022, -0.47); // left palm centre under the handguard
const MAG_GRIP = new THREE.Vector3(-0.036, -0.095, -0.37); // left palm on the magazine
const PALM_R = new THREE.Vector3(0.05, -0.014, 0); // palm centre relative to wrist, bind hand space
const PALM_L = new THREE.Vector3(-0.05, -0.014, 0);

// ---------------- colour slots / surface ----------------
const S = {
  FAT: 0, FAT2: 1, VEST: 2, VEST2: 3, GLOVE: 4, BOOT: 5, SOLE: 6, SKIN: 7, SKIN2: 8, MASK: 9, HAT: 10, LENS: 11, STRAP: 12, POLY: 13, GMET: 14, FURN: 15,
  MAGC: 16, HW: 17, BELT: 18, HAIR: 19, KNEE: 20, BEARD: 21, LIP: 22, EYE: 23, IRIS: 24, TEE: 25, JEANS: 26, JACKET: 27, RIB: 28, WATCH: 29, BROW: 30, GOLD: 31, ALENS: 32,
};
const NS = 33;
// [roughness, metalness]
const SURF = [[0.9, 0], [0.92, 0], [0.82, 0], [0.85, 0], [0.6, 0], [0.55, 0], [0.9, 0], [0.5, 0], [0.6, 0], [0.95, 0], [0.78, 0], [0.06, 0.9], [0.72, 0], [0.5, 0.08], [0.36, 0.75], [0.58, 0.02],
  [0.45, 0.3], [0.32, 0.85], [0.78, 0], [0.8, 0], [0.45, 0], [0.82, 0], [0.42, 0], [0.18, 0], [0.12, 0], [0.88, 0], [0.86, 0], [0.62, 0], [0.95, 0], [0.24, 0.9], [0.85, 0], [0.22, 0.95], [0.04, 0.55]];

// ---------------- build-time math ----------------
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sst = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const gs = (t) => Math.exp(-t * t);
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _be = new THREE.Euler(), _bt = new THREE.Vector3(), _bs = new THREE.Vector3();
const YAX = new THREE.Vector3(0, 1, 0);
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }

// ---------------- geometry helpers (build-time only) ----------------
function place(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _bm.compose(_bt.set(x, y, z), _bq.setFromEuler(_be.set(rx, ry, rz)), _bs.set(sx, sy, sz));
  return g.applyMatrix4(_bm);
}
// indexed rounded box: one bevel step, n* = segments per axis (>= 3; extra segments subdivide the flat faces for bending)
function rbox(w, h, d, r, nx = 3, ny = 3, nz = 3) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  if (r < 0.0055 && nx === 3 && ny === 3 && nz === 3) return new THREE.BoxGeometry(w, h, d);
  r = Math.max(r, 0.002);
  const N = [nx, ny, nz], g = new THREE.BoxGeometry(1, 1, 1, nx, ny, nz);
  g.deleteAttribute('uv');
  const pos = g.attributes.position, nor = g.attributes.normal, hw = [w / 2, h / 2, d / 2], u = [0, 0, 0], n = [0, 0, 0], e = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    u[0] = pos.getX(i); u[1] = pos.getY(i); u[2] = pos.getZ(i);
    let l = 0;
    for (let a = 0; a < 3; a++) { e[a] = Math.abs(Math.abs(u[a]) - 0.5) < 1e-4; n[a] = e[a] ? Math.sign(u[a]) : 0; l += n[a] * n[a]; }
    l = Math.sqrt(l) || 1;
    const p = [0, 0, 0];
    for (let a = 0; a < 3; a++) { n[a] /= l; p[a] = e[a] ? Math.sign(u[a]) * (hw[a] - r) + n[a] * r : (u[a] / (0.5 - 1 / N[a])) * (hw[a] - r); }
    pos.setXYZ(i, p[0], p[1], p[2]);
    nor.setXYZ(i, n[0], n[1], n[2]);
  }
  return mergeVertices(g, 1e-5);
}
function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
// curve a part around the body: z += k * x^2 (and optionally y += ky * x^2)
function bend(g, k, ky = 0, by = 'x') {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = by === 'x' ? p.getX(i) : p.getY(i); p.setZ(i, p.getZ(i) + k * x * x); if (ky) p.setY(i, p.getY(i) + ky * x * x); }
  g.computeVertexNormals();
  return g;
}
function segGeo(g, a, b, sx = 1, sz = 1) {
  const d = _bt.subVectors(b, a); const L = d.length(); d.divideScalar(L);
  const q = new THREE.Quaternion().setFromUnitVectors(YAX, d);
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(sx, 1, sz));
  return g.applyMatrix4(m);
}
function cylAB(a, b, r1, r2, seg = 10, open = false) { return segGeo(new THREE.CylinderGeometry(r2, r1, a.distanceTo(b), seg, 1, open), a, b); }
function ellip(r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8) { return place(new THREE.SphereGeometry(r, ws, hs), x, y, z, 0, 0, 0, sx, sy, sz); }

// closed-loop rings -> indexed surface (outward winding is fixed up automatically)
function loftGeo(rings, capA = false, capB = false) {
  const M = rings[0].length, R = rings.length, pos = [], idx = [];
  for (const r of rings) for (const p of r) pos.push(p[0], p[1], p[2]);
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M;
    idx.push(a, c, b, b, c, d);
  }
  const cent = (r) => { const c = [0, 0, 0]; for (const p of r) { c[0] += p[0] / M; c[1] += p[1] / M; c[2] += p[2] / M; } return c; };
  const capIdx = [];
  if (capA) { const c = cent(rings[0]), ci = pos.length / 3; pos.push(...c); for (let j = 0; j < M; j++) capIdx.push(ci, (j + 1) % M, j); }
  if (capB) { const c = cent(rings[R - 1]), ci = pos.length / 3, o = (R - 1) * M; pos.push(...c); for (let j = 0; j < M; j++) capIdx.push(ci, o + j, o + (j + 1) % M); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx.concat(capIdx));
  g.computeVertexNormals();
  // orientation: normals should point away from each ring's centroid
  let sgn = 0;
  const nor = g.attributes.normal;
  for (let i = 0; i < R; i++) {
    const c = cent(rings[i]);
    for (let j = 0; j < M; j++) { const k = i * M + j; sgn += (pos[k * 3] - c[0]) * nor.getX(k) + (pos[k * 3 + 1] - c[1]) * nor.getY(k) + (pos[k * 3 + 2] - c[2]) * nor.getZ(k); }
  }
  if (sgn < 0) {
    const ix = g.index.array;
    for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; }
    g.computeVertexNormals();
  }
  return g;
}
// superellipse ring. C centre, U/V unit axes, ru along U, rvp/rvn along +V/-V; n exponent (or [n+V, n-V]); tw(t) warps the angle
function seRing(C, U, V, ru, rvp, rvn, n, M, post, tw) {
  const pts = [], nP = Array.isArray(n) ? n[0] : n, nN = Array.isArray(n) ? n[1] : n;
  for (let j = 0; j < M; j++) {
    const th = (tw ? tw(j / M) : j / M) * Math.PI * 2;
    const c = Math.cos(th), s = Math.sin(th), ne = s >= 0 ? nP : nN;
    const u = ru * Math.sign(c) * Math.pow(Math.abs(c), 2 / ne), v = (s >= 0 ? rvp : rvn) * Math.sign(s) * Math.pow(Math.abs(s), 2 / ne);
    const p = [C[0] + U[0] * u + V[0] * v, C[1] + U[1] * u + V[1] * v, C[2] + U[2] * u + V[2] * v];
    pts.push(post ? post(p, th, u, v) : p);
  }
  return pts;
}
// smooth (Hermite / Catmull-Rom) profile lookup: keys rows [s, v1, v2, ...]
function prof(keys, s) {
  const n = keys.length;
  if (s <= keys[0][0]) return keys[0].slice(1);
  if (s >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (keys[i + 1][0] < s) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const h = k2[0] - k1[0], t = (s - k1[0]) / h, t2 = t * t, t3 = t2 * t, out = [];
  for (let c = 1; c < k1.length; c++) {
    const m1 = (k2[c] - k0[c]) / ((k2[0] - k0[0]) || 1) * h, m2 = (k3[c] - k1[c]) / ((k3[0] - k1[0]) || 1) * h;
    out.push((2 * t3 - 3 * t2 + 1) * k1[c] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * k2[c] + (t3 - t2) * m2);
  }
  return out;
}
// stacked horizontal rings [[y, rx, rBack, rFront, cz], ...] (open ends) e.g. collars
function ringStack(list, M = 16, post) { return loftGeo(list.map(([y, rx, rb, rf, cz], i) => seRing([0, y, cz], [1, 0, 0], [0, 0, 1], rx, rb, rf, 2, M, post ? (p, th) => post(p, th, i) : null)), false, false); }
const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
// tube along a straight axis A + D*s. keys rows: [s, ru, rv+, rv-, cu, cv, n]
function tubeLoft(o) {
  const { A, D, U, V, keys, ss, M = 12, capA = true, capB = true, post, tw } = o;
  const rings = ss.map((s) => {
    const p = prof(keys, s);
    const C = [A[0] + D[0] * s + U[0] * p[3] + V[0] * p[4], A[1] + D[1] * s + U[1] * p[3] + V[1] * p[4], A[2] + D[2] * s + U[2] * p[3] + V[2] * p[4]];
    return seRing(C, U, V, p[0], p[1], p[2], p[5], M, post ? (q, th, u, v) => post(q, th, s, u, v) : null, tw);
  });
  return loftGeo(rings, capA, capB);
}
// tube along a polyline (parallel-transport frames). pr(t) -> [ru, rv, n]
function pathTube(pts, U0, pr, M = 8, capA = true, capB = true) {
  const P = pts.map(p => v3(...p)), N = P.length, rings = [];
  const U = v3(...U0), T = new THREE.Vector3(), Vv = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    T.subVectors(P[Math.min(N - 1, i + 1)], P[Math.max(0, i - 1)]).normalize();
    U.addScaledVector(T, -U.dot(T)).normalize();
    Vv.crossVectors(T, U);
    const [ru, rv, n] = pr(i / (N - 1));
    rings.push(seRing(P[i].toArray(), U.toArray(), Vv.toArray(), ru, rv, rv, n, M));
  }
  return loftGeo(rings, capA, capB);
}
function mirrorGeo(g) {
  const m = g.clone();
  const p = m.attributes.position, n = m.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); if (n) n.setX(i, -n.getX(i)); }
  const ix = m.index.array;
  for (let t = 0; t < ix.length; t += 3) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; }
  return m;
}
const MIR_S = [0, 1, 2, 3, 4, 9, 10, 11, 12, 5, 6, 7, 8, 16, 17, 18, 13, 14, 15, 19, 20];

// weights along a chain: pts [[s, bone], ...] (blend linearly between differing neighbours)
function chainW(s, pts, W) {
  if (s <= pts[0][0]) { W[0] = pts[0][1]; W[1] = 1; return 1; }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (s <= b[0]) {
      if (a[1] === b[1]) { W[0] = a[1]; W[1] = 1; return 1; }
      const t = sst(a[0], b[0], s);
      W[0] = a[1]; W[1] = 1 - t; W[2] = b[1]; W[3] = t; return 2;
    }
  }
  W[0] = pts[pts.length - 1][1]; W[1] = 1; return 1;
}

// ---------------- head sculpt ----------------
// head-local space (origin = head centre, eye level); front = -z. Horizontal rings from the chin up.
// rows: [y, half-width, back, front, cz, nBack, nFront]
const HEAD_KEYS = [
  [-0.108, 0.02, 0.014, 0.012, -0.06, 2, 2.4],
  [-0.1, 0.036, 0.026, 0.022, -0.05, 2, 2.6],
  [-0.088, 0.05, 0.046, 0.034, -0.033, 2, 2.8],
  [-0.072, 0.059, 0.068, 0.056, -0.016, 2.1, 2.8],
  [-0.055, 0.064, 0.082, 0.074, -0.005, 2.1, 2.8],
  [-0.035, 0.068, 0.092, 0.083, 0.0, 2.1, 2.8],
  [-0.012, 0.071, 0.1, 0.087, 0.003, 2.1, 2.7],
  [0.012, 0.074, 0.104, 0.088, 0.005, 2.1, 2.6],
  [0.035, 0.075, 0.106, 0.087, 0.007, 2.1, 2.5],
  [0.06, 0.073, 0.103, 0.08, 0.008, 2.1, 2.4],
  [0.082, 0.064, 0.092, 0.066, 0.01, 2.1, 2.2],
  [0.098, 0.05, 0.074, 0.048, 0.012, 2, 2.1],
  [0.109, 0.031, 0.047, 0.028, 0.014, 2, 2],
  [0.115, 0.012, 0.018, 0.011, 0.015, 2, 2],
];
const HEAD_YS = [-0.108, -0.1, -0.092, -0.084, -0.076, -0.068, -0.061, -0.054, -0.047, -0.04, -0.033, -0.026, -0.019, -0.012, -0.005, 0.002, 0.009, 0.017, 0.026, 0.037, 0.05, 0.065, 0.08, 0.094, 0.106, 0.115];
const HS = 1.05; // heads read a touch large, PS2 style
// angle warp: ring parameter t (0 = +x side) -> denser sampling at the face (t = 0.75 is -V = front)
const headWarp = (t) => { const s = (t - 0.75); const w = s - 0.11 * Math.sin(s * Math.PI * 2); return 0.75 + w; };
function faceFeatures(p, o) {
  let [x, y, z] = p;
  const ax = Math.abs(x), sx = x < 0 ? -1 : 1;
  const fr = sst(-0.02, -0.07, z); // frontness
  // lower face forward (maxilla / chin), jaw angle flare
  z -= 0.006 * gs(x / 0.04) * gs((y + 0.06) / 0.03) * fr;
  // chin
  z -= 0.008 * gs(x / 0.022) * gs((y + 0.09) / 0.014) * fr;
  x += sx * 0.006 * gs((y + 0.068) / 0.02) * gs((z - 0.01) / 0.03);
  // lips (upper / lower) and the mouth line
  z -= 0.0045 * gs(x / 0.021) * gs((y + 0.046) / 0.0055) * fr;
  z -= 0.004 * gs(x / 0.019) * gs((y + 0.061) / 0.006) * fr;
  z += 0.0025 * gs(x / 0.024) * gs((y + 0.0535) / 0.0028) * fr;
  // nose: bridge -> tip -> base
  if (y > -0.04 && y < 0.02) {
    const t = sat((0.014 - y) / 0.044);
    let h = 0.004 + 0.02 * Math.pow(t, 1.25);
    if (t > 0.8) h *= 1 - Math.pow((t - 0.8) / 0.2, 2) * 0.85;
    const w = 0.0075 + 0.0085 * t;
    z -= h * gs(x / w) * fr;
    // nostril wings
    z -= 0.005 * gs((ax - 0.013) / 0.006) * gs((y + 0.027) / 0.006) * fr;
    x += sx * 0.003 * gs((ax - 0.013) / 0.007) * gs((y + 0.027) / 0.006) * fr;
  }
  // brow ridge + eye sockets + cheekbones + temples
  z -= 0.0065 * gs((y - 0.024) / 0.01) * sst(0.07, 0.03, ax) * fr;
  z += 0.011 * gs((ax - 0.031) / 0.015) * gs((y - 0.006) / 0.011) * fr;
  z -= 0.005 * gs((ax - 0.05) / 0.013) * gs((y + 0.012) / 0.011) * fr;
  x += sx * 0.003 * gs((ax - 0.058) / 0.012) * gs((y + 0.012) / 0.014) * fr;
  x -= sx * 0.004 * gs((ax - 0.058) / 0.014) * gs((y + 0.045) / 0.015) * fr; // cheek hollow
  x -= sx * 0.003 * gs((y - 0.03) / 0.02) * gs((z + 0.045) / 0.03);
  // occiput
  z += 0.005 * gs((y - 0.005) / 0.03) * sst(0.04, 0.09, z);
  // hair volume (displaced outward above the hairline)
  if (o && o.hairVol) {
    const hv = o.hairVol(x, y, z);
    if (hv > 0) { const l = Math.hypot(x, y - 0.0, z - 0.01) || 1; x += x / l * hv; y += y / l * hv; z += (z - 0.01) / l * hv; }
  }
  return [x, y, z];
}
function headGeo(o) {
  const rings = HEAD_YS.map((y) => {
    const p = prof(HEAD_KEYS, y);
    return seRing([0, y, p[3]], [1, 0, 0], [0, 0, 1], p[0], p[1], p[2], [p[4], p[5]], o.M || 22, (q) => faceFeatures(q, o), headWarp);
  });
  return loftGeo(rings, true, true);
}
// hairline height as a function of position (short cut): front 0.06, sides 0.02, nape -0.05
function hairline(x, z) {
  const a = Math.atan2(x, -z); // 0 = front
  const c = Math.cos(a);
  return c > 0 ? lerp(0.016, 0.058, Math.pow(c, 1.5)) : lerp(0.016, -0.064, Math.pow(-c, 0.8));
}
// paint the head. o.face: 'skin' | 'mask' | 'eyes' (mask with an eye opening). o.beard 0..1, o.hair (bool), o.brows
function paintHead(P, N, out, o) {
  const x = P.x, y = P.y, z = P.z, ax = Math.abs(x), fr = sst(-0.02, -0.07, z);
  const socket = gs((ax - 0.031) / 0.016) * gs((y - 0.005) / 0.012) * fr;
  out.k *= 1 - 0.28 * socket;
  if (o.face === 'mask') { out.s1 = S.MASK; return; }
  if (o.face === 'eyes') {
    const open = sst(0.012, 0.004, Math.abs(y - 0.005) - 0.008 * gs(x / 0.05)) * sst(0.068, 0.058, ax) * sst(-0.03, -0.05, z);
    out.s1 = S.MASK; out.s2 = S.SKIN; out.m = open; out.k *= 1 - 0.25 * socket; return;
  }
  out.s1 = S.SKIN;
  // lips
  const lip = gs(x / 0.019) * (gs((y + 0.047) / 0.005) * 0.45 + gs((y + 0.061) / 0.006) * 0.7) * fr;
  out.k *= 1 - 0.3 * gs(x / 0.02) * gs((y + 0.0535) / 0.0035) * fr;
  // warm flush on nose, cheeks
  const flush = (gs(x / 0.012) * gs((y + 0.02) / 0.012) * 0.5 + gs((ax - 0.045) / 0.015) * gs((y + 0.025) / 0.015) * 0.35) * fr;
  let m = 0, s2 = S.LIP;
  if (lip > 0.05) { m = Math.min(1, lip) * 0.7; }
  else m = flush * 0.3;
  // beard / stubble
  if (o.beard > 0) {
    const bl = -0.038 + 0.3 * Math.max(0, ax - 0.012) - 0.004 * gs(x / 0.01);
    let bm = sst(bl + 0.004, bl - 0.008, y) * sst(0.045, 0.015, z);
    const side = sst(0.055, 0.066, ax) * sst(0.03, 0.012, y) * sst(-0.015, -0.005, z) * sst(0.032, 0.022, z);
    bm = Math.max(bm, side) * (1 - sat(lip * 1.6));
    if (bm > m) { m = bm * o.beard; s2 = S.BEARD; }
  }
  // eyebrows
  if (o.brows) {
    const br = gs((y - 0.027 + 0.004 * Math.pow((ax - 0.01) / 0.05, 2)) / 0.0055) * sst(0.008, 0.014, ax) * sst(0.066, 0.05, ax) * fr;
    if (br > 0.3 && br > m) { m = Math.min(1, br * 1.2); s2 = S.BROW; }
  }
  // hair
  if (o.hair) {
    const hl = hairline(x, z);
    const h = sst(hl - 0.009, hl + 0.011, y) * (y > -0.07 ? 1 : 0) * (1 - sst(-0.02, -0.035, z) * sst(0.045, 0.058, ax) * sst(0.035, 0.02, y));
    if (h > 0.02) { m = Math.max(m * (1 - h), h); s2 = S.HAIR; if (h > 0.5) out.k *= 0.92 + 0.12 * hash3(x * 300, y * 300, z * 300); }
  }
  out.s2 = s2; out.m = m;
}
// ear (right side): flattened cup with a rim
function earGeo() {
  const g = new THREE.SphereGeometry(1, 8, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rim = y * y + z * z;
    if (x > 0) x *= 0.25 + 0.75 * Math.pow(rim, 1.5);
    y *= y < 0 ? 0.85 : 1;
    p.setXYZ(i, x * 0.011, y * 0.03, z * 0.019);
  }
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-6); m.computeVertexNormals();
  return place(m, 0, 0, 0, 0.12, 0.28, 0);
}

// =====================================================================================
//  BODY: shared builders (soldier and driver use the same sculpt, different outfits)
// =====================================================================================
const TORSO_KEYS = [ // [y, half-width, back, front, cx, cz, n]
  [0.85, 0.105, 0.075, 0.065, 0, 0.005, 2.2],
  [0.89, 0.15, 0.1, 0.085, 0, 0.008, 2.4],
  [0.94, 0.166, 0.118, 0.098, 0, 0.008, 2.5],
  [1.0, 0.163, 0.106, 0.098, 0, 0.004, 2.5],
  [1.06, 0.158, 0.096, 0.102, 0, 0.0, 2.5],
  [1.13, 0.161, 0.098, 0.108, 0, 0.0, 2.5],
  [1.21, 0.167, 0.1, 0.112, 0, -0.002, 2.6],
  [1.29, 0.179, 0.106, 0.12, 0, -0.004, 2.7],
  [1.36, 0.187, 0.11, 0.118, 0, -0.004, 2.7],
  [1.415, 0.19, 0.104, 0.104, 0, -0.002, 2.6],
  [1.455, 0.176, 0.084, 0.08, 0, 0.0, 2.4],
  [1.49, 0.142, 0.068, 0.06, 0, 0.004, 2.2],
  [1.515, 0.088, 0.062, 0.054, 0, 0.004, 2.1],
  [1.53, 0.068, 0.056, 0.05, 0, 0.004, 2.0],
];
const TORSO_W = [[0.96, B.pelvis], [1.03, B.pelvis], [1.12, B.spine], [1.19, B.spine], [1.29, B.chest], [1.49, B.chest], [1.535, B.neck]];
function torsoWF(P, W) {
  let c = chainW(P.y, TORSO_W, W);
  // shoulder corners follow the clavicles a little
  const k = sst(0.13, 0.19, Math.abs(P.x)) * sst(1.34, 1.43, P.y) * 0.55;
  if (k > 0.01) { for (let i = 0; i < c; i++) W[i * 2 + 1] *= 1 - k; W[c * 2] = P.x > 0 ? B.clavR : B.clavL; W[c * 2 + 1] = k; c++; }
  return c;
}
// torso ring at height y with outward offset (for gear bands)
function torsoRing(y, off, M, post, bulk = 0) {
  const p = prof(TORSO_KEYS, y);
  return seRing([p[3], y, p[4]], [1, 0, 0], [0, 0, 1], p[0] + off + bulk, p[1] + off + bulk, p[2] + off + bulk, p[5], M, post);
}
function torsoGeo(o) {
  const M = o.M || 24, ys = o.ys || lin(0.85, 1.53, 21);
  const rings = ys.map((y) => torsoRing(y, 0, M, o.post ? (q, th) => o.post(q, th, y) : null, o.bulk || 0));
  return loftGeo(rings, true, true);
}
// band around the torso: profile [[y, off], ...]
function torsoBand(profile, M = 24, post) { return loftGeo(profile.map(([y, off]) => torsoRing(y, off, M, post)), false, false); }

// right arm (T-pose along +x); keys [x, r up, r back, r front, cu, cv, n]
const ARM_KEYS = [
  [0.12, 0.062, 0.062, 0.062, 0, 0, 2],
  [0.19, 0.07, 0.066, 0.066, 0.002, 0, 2.1],
  [0.25, 0.064, 0.06, 0.061, 0, 0, 2.1],
  [0.31, 0.056, 0.054, 0.058, 0, 0, 2.1],
  [0.39, 0.051, 0.051, 0.054, 0, 0, 2.1],
  [0.46, 0.046, 0.05, 0.046, 0, 0, 2.1],
  [0.49, 0.045, 0.053, 0.043, 0, 0.002, 2.1],
  [0.53, 0.046, 0.05, 0.049, 0, 0, 2.1],
  [0.6, 0.041, 0.046, 0.045, 0, 0, 2.2],
  [0.67, 0.032, 0.04, 0.04, 0, 0, 2.3],
  [0.73, 0.026, 0.034, 0.034, 0, 0, 2.4],
];
const ARM_W = [[0.15, B.clavR], [0.17, B.clavR], [0.245, B.uarmR], [0.462, B.uarmR], [0.518, B.farmR], [0.745, B.farmR], [0.77, B.handR]];
const armWF = (P, W) => chainW(P.x, ARM_W, W);
// shoulder cap bridging torso and arm (half clavicle, half upper arm)
function deltoid(sc = 1) { return ellip(1, 0.198, 1.447, 0.0, 0.072 * sc, 0.07 * sc, 0.074 * sc, 9, 7); }
const deltWF = (P, W) => { const t = sst(0.17, 0.25, P.x) * 0.6 + 0.2; W[0] = B.clavR; W[1] = 1 - t; W[2] = B.uarmR; W[3] = t; return 2; };
// sleeve folds: ripples around the elbow crease and above the cuff
function sleeveFolds(amp = 1) {
  return (q, th, s, u, v) => {
    const front = Math.max(0, -Math.sin(th)), k = 1
      + amp * 0.07 * gs((s - 0.485) / 0.035) * front * Math.sin(s * 260 + th * 1.5)
      + amp * 0.05 * gs((s - 0.62) / 0.05) * Math.sin(s * 210 + th * 2.2)
      + amp * 0.04 * gs((s - 0.33) / 0.05) * Math.sin(s * 150 - th * 2) * (0.4 + front);
    return [q[0], 1.44 + (q[1] - 1.44) * k, q[2] * k];
  };
}
function armGeo(keys, ss, M, folds) { return tubeLoft({ A: [0, 1.44, 0], D: [1, 0, 0], U: [0, 1, 0], V: [0, 0, 1], keys, ss, M, post: folds }); }

// right leg (straight down); s = 1.0 - y; keys [s, r out, r back, r front, cu, cv, n]
const LEG_KEYS = [
  [0.0, 0.1, 0.1, 0.09, -0.01, 0.005, 2.2],
  [0.08, 0.098, 0.106, 0.092, 0.006, 0.005, 2.2],
  [0.18, 0.09, 0.09, 0.088, 0.004, 0, 2.2],
  [0.3, 0.08, 0.077, 0.08, 0.002, -0.002, 2.2],
  [0.4, 0.068, 0.066, 0.07, 0, -0.004, 2.2],
  [0.47, 0.06, 0.058, 0.063, 0, -0.004, 2.2],
  [0.5, 0.058, 0.056, 0.064, 0, -0.004, 2.2],
  [0.54, 0.056, 0.06, 0.058, 0, 0.0, 2.2],
  [0.62, 0.055, 0.066, 0.054, 0, 0.004, 2.2],
  [0.7, 0.056, 0.062, 0.054, 0, 0.004, 2.2],
  [0.75, 0.06, 0.064, 0.058, 0, 0.006, 2.2],
  [0.8, 0.05, 0.054, 0.05, 0, 0.006, 2.2],
];
const LEG_W = [[0.04, B.pelvis], [0.1, B.thighR], [0.47, B.thighR], [0.53, B.shinR], [0.9, B.shinR]];
const legWF = (P, W) => chainW(1.0 - P.y, LEG_W, W);
function trouserFolds(amp = 1) {
  return (q, th, s) => {
    const back = Math.max(0, Math.sin(th)), k = 1
      + amp * 0.06 * gs((s - 0.73) / 0.04) * Math.sin(s * 220 + th * 3)
      + amp * 0.05 * gs((s - 0.5) / 0.03) * back * Math.sin(th * 5)
      + amp * 0.035 * gs((s - 0.12) / 0.05) * Math.sin(s * 120 + th * 2) * Math.max(0, -Math.sin(th));
    const cx = HIPX;
    return [cx + (q[0] - cx) * k, q[1], q[2] * k];
  };
}
function legGeo(keys, M, folds, n = 14) { return tubeLoft({ A: [HIPX, 1.0, 0], D: [0, -1, 0], U: [1, 0, 0], V: [0, 0, 1], keys, ss: lin(0.0, keys[keys.length - 1][0], n), M, post: folds }); }

// boots (right): foot loft along -z from the heel, sole, shaft. foot-space origin = ankle (x, 0.085, 0)
function bootParts(add, o = {}) {
  const x = HIPX, keys = [ // [s=-z, halfW, top, bottom]
    [-0.088, 0.03, 0.085, 0.03], [-0.072, 0.042, 0.125, 0.026], [-0.04, 0.048, 0.16, 0.025], [0.0, 0.05, 0.165, 0.025], [0.04, 0.052, 0.138, 0.025],
    [0.09, 0.054, 0.103, 0.025], [0.13, 0.054, 0.087, 0.025], [0.17, 0.05, 0.074, 0.025], [0.2, 0.042, 0.064, 0.026], [0.218, 0.028, 0.055, 0.03],
  ].map(([s, w, t, b]) => [s, w, (t - b) / 2, (t - b) / 2, 0, (t + b) / 2, 2.6]);
  const tl = o.toeLen || 0;
  if (tl) for (const k of keys) if (k[0] > 0.05) k[0] += tl * (k[0] - 0.05) / 0.17;
  const ss = [-0.088, -0.07, -0.035, 0.01, 0.06, 0.11, 0.16 + tl * 0.6, 0.198 + tl * 0.9, 0.218 + tl];
  const foot = tubeLoft({ A: [x, 0, 0], D: [0, 0, -1], U: [1, 0, 0], V: [0, 1, 0], keys, ss, M: 10 });
  const fw = (P, W) => { const t = sst(0.1, 0.16, P.y) * sst(-0.03, 0.02, P.z); W[0] = B.footR; W[1] = 1 - t; W[2] = B.shinR; W[3] = t; return 2; };
  // laces: dark band over the instep
  const lace = (P, N, out) => { const t = gs((P.x - x) / 0.016) * sst(0.02, -0.02, P.z) * sst(-0.12, -0.06, P.z) * sst(0.09, 0.12, P.y); if (t > 0.05) { out.s2 = o.laceSlot ?? S.STRAP; out.m = t * 0.8; } };
  add({ g: foot, wf: fw, slot: o.slot ?? S.BOOT, paint: lace });
  const sk = keys.map(([s, w, , , , c]) => [s, w + 0.007, 0.015, 0.015, 0, 0.015, 5]);
  sk[0][1] = 0.034; sk[sk.length - 1][1] = 0.034;
  const sole = tubeLoft({ A: [x, 0, 0], D: [0, 0, -1], U: [1, 0, 0], V: [0, 1, 0], keys: sk, ss: [-0.094, -0.075, -0.02, 0.06, 0.14, 0.195 + tl * 0.8, 0.225 + tl], M: 8 });
  add({ g: sole, bone: B.footR, slot: o.soleSlot ?? S.SOLE, paint: (P, N, out) => { if (P.y > 0.026) { out.s2 = o.slot ?? S.BOOT; out.m = 0.3; } } });
  if (o.shaft !== false) {
    const shk = [[0.06, 0.058, 0.062, 0.058, 0, 0.004, 2.3], [0.16, 0.055, 0.058, 0.056, 0, 0.004, 2.2], [0.235, 0.056, 0.058, 0.057, 0, 0.004, 2.2], [0.25, 0.059, 0.061, 0.06, 0, 0.004, 2.2]];
    const shaft = tubeLoft({ A: [x, 0, 0], D: [0, 1, 0], U: [1, 0, 0], V: [0, 0, 1], keys: shk, ss: [0.06, 0.14, 0.235, 0.25], M: 12, capA: false, capB: true });
    add({ g: shaft, wf: (P, W) => { const t = sst(0.13, 0.07, P.y); W[0] = B.shinR; W[1] = 1 - t; W[2] = B.footR; W[3] = t; return 2; }, slot: o.slot ?? S.BOOT, paint: (P, N, out) => { const t = gs((P.x - x) / 0.014) * sst(-0.03, -0.05, P.z); if (t > 0.05) { out.s2 = o.laceSlot ?? S.STRAP; out.m = t * 0.7; } if (P.y > 0.24) out.k *= 0.8; } });
  }
}

// gloved/bare right hand in canonical bind space (wrist at origin, fingers +x, palm -y, thumb -z), then moved to W
function handParts(add, o) {
  const { W, slot, bone = B.handR, fbone = bone, knuckle = false } = o;
  const T = (g) => { g.translate(W[0], W[1], W[2]); return g; };
  add({ g: T(place(rbox(0.086, 0.028, 0.08, 0.011), 0.046, -0.002, 0.003)), bone, slot });
  // curled finger block with knuckle ridge; grooves painted between the fingers
  const fpts = [[0.082, 0.004, 0.002], [0.106, -0.006, 0.002], [0.114, -0.034, 0.002], [0.1, -0.06, 0.002], [0.077, -0.07, 0.002]];
  const fg = T(pathTube(fpts, [0, 0, 1], (t) => [0.0375 - 0.004 * t, 0.011 - 0.002 * t, 3.2], o.M || 10));
  const groove = (P, N, out) => { const z = P.z - W[2] - 0.002; const gg = gs((Math.abs(z) - 0.0195) / 0.0028) + gs(z / 0.0028); out.k *= 1 - 0.32 * Math.min(1, gg); };
  add({ g: fg, bone: fbone, slot, paint: groove });
  // thumb
  add({ g: T(pathTube([[0.018, -0.008, -0.028], [0.05, -0.022, -0.052], [0.08, -0.042, -0.052]], [0, 1, 0], (t) => [0.0125 - 0.003 * t, 0.0115 - 0.0025 * t, 2.2], o.M ? 8 : 6)), bone, slot });
  if (knuckle) add({ g: T(place(rbox(0.026, 0.012, 0.072, 0.005), 0.074, 0.016, 0.002)), bone, slot: S.POLY });
}

// =====================================================================================
//  SOLDIER
// =====================================================================================
// kind: 0 = helmet + goggles + balaclava, 1 = cap + sunglasses (bare face), 2 = balaclava + headset (eyes visible)
function soldierParts(kind) {
  const parts = [];
  const add = (p) => { parts.push(p); return p; };
  const addM = (p) => { add(p); add({ ...p, mirror: true }); };
  const simple = (g, bone, slot, soft, paint) => add({ g, bone, slot, soft, paint });
  const soft = (b, j, ax, r) => ({ b, j: v3(...j), ax: v3(...ax).normalize(), r });

  // ---- torso (combat shirt) + collar
  const torso = torsoGeo({ M: 20, ys: lin(0.85, 1.53, 16), post: (q, th, y) => { // shirt folds at the waist, spine groove
    const k = 1 + 0.025 * gs((y - 1.06) / 0.03) * Math.sin(th * 6 + y * 40) - 0.02 * gs((th - Math.PI / 2) / 0.18) * sst(1.0, 1.15, y);
    return [q[0] * k, q[1], q[2] * k];
  } });
  add({ g: torso, wf: torsoWF, slot: S.FAT });
  add({ g: ringStack([[1.472, 0.06, 0.06, 0.058, 0.004], [1.474, 0.075, 0.076, 0.072, 0.004], [1.538, 0.07, 0.071, 0.066, 0.0], [1.541, 0.059, 0.06, 0.056, 0.0]], 18), wf: (P, W) => chainW(P.y, [[1.49, B.chest], [1.54, B.neck]], W), slot: S.FAT2 });
  // ---- neck + head
  addNeckHead(add, kind === 1 ? 'skin' : kind === 2 ? 'eyes' : 'mask', { beard: kind === 1 ? 1 : 0, hair: kind === 1, brows: kind === 1 || kind === 2, eyes: kind === 2, ears: true });
  // ---- arms
  addM({ g: armGeo(ARM_KEYS, lin(0.12, 0.735, 12), 12, sleeveFolds(1)), wf: armWF, slot: S.FAT });
  addM({ g: deltoid(0.9), wf: deltWF, slot: S.FAT });
  addM({ g: place(box(0.1, 0.014, 0.074), 0.315, 1.5, 0), bone: B.uarmR, slot: S.FAT2 }); // shoulder pocket
  addM({ g: place(box(0.062, 0.01, 0.046), 0.315, 1.508, 0), bone: B.uarmR, slot: S.VEST }); // velcro patch
  addM({ g: cylAB(v3(WRX - 0.07, 1.44, 0), v3(WRX + 0.006, 1.44, 0), 0.039, 0.041, 12), wf: (P, W) => chainW(P.x, [[WRX - 0.03, B.farmR], [WRX, B.handR]], W), slot: S.GLOVE }); // gauntlet
  for (const m of [false, true]) {
    const hp = []; handParts((p) => hp.push(p), { W: [WRX, 1.44, 0], slot: S.GLOVE, knuckle: true });
    for (const p of hp) add(m ? { ...p, mirror: true } : p);
  }
  // ---- legs
  addM({ g: legGeo(LEG_KEYS, 12, trouserFolds(1)), wf: legWF, slot: S.FAT });
  { const bp = []; bootParts((p) => bp.push(p)); for (const p of bp) { add(p); add({ ...p, mirror: true }); } }
  // knee pads
  addM({ g: bend(rbox(0.1, 0.125, 0.03, 0.013, 4, 3, 3), 3.2), bone: B.shinR, slot: S.KNEE, xf: [HIPX, 0.5, -0.07] });
  addM({ g: cylAB(v3(HIPX, 0.455, 0.0), v3(HIPX, 0.475, 0.0), 0.06, 0.059, 12, true), bone: B.shinR, slot: S.STRAP });

  // ---- plate carrier
  const pc = (g, bone, slot, paint) => add({ g, bone, slot, paint });
  const chestSoft = [soft(B.spine, [0, 1.2, 0], [0, 1, 0], 0.05)];
  // front & back plate bags, curved to the chest
  add({ g: place(bend(rbox(0.305, 0.33, 0.054, 0.02, 5, 3, 3), 1.6), 0, 1.318, -0.153), bone: B.chest, slot: S.VEST, soft: chestSoft });
  add({ g: place(bend(rbox(0.3, 0.34, 0.05, 0.02, 5, 3, 3), -1.6), 0, 1.33, 0.137), bone: B.chest, slot: S.VEST, soft: chestSoft });
  // MOLLE rows on the front panel (proud webbing strips catch the rim light)
  for (let k = 0; k < 3; k++) pc(place(bend(box(0.29, 0.011, 0.01), 1.6), 0, 1.28 + k * 0.042, -0.183), B.chest, S.VEST2);
  for (let k = 0; k < 4; k++) pc(place(bend(box(0.28, 0.011, 0.01), -1.6), 0, 1.24 + k * 0.045, 0.166), B.chest, S.VEST2);
  // cummerbund (swept around the torso) + side MOLLE
  add({ g: torsoBand([[1.115, 0.004], [1.118, 0.028], [1.19, 0.032], [1.262, 0.028], [1.265, 0.004]], 22), bone: B.chest, slot: S.VEST, soft: chestSoft,
    paint: (P, N, out) => { const r = Math.abs(Math.sin((P.y - 1.115) / 0.15 * Math.PI * 3)); if (r < 0.3 && Math.abs(P.x) > 0.1) { out.s2 = S.VEST2; out.m = 0.7; } } });
  // shoulder straps
  for (const sx of [-1, 1]) add({ g: pathTube([[sx * 0.1, 1.45, -0.14], [sx * 0.11, 1.5, -0.08], [sx * 0.115, 1.522, 0], [sx * 0.11, 1.5, 0.075], [sx * 0.1, 1.45, 0.13]], [1, 0, 0], () => [0.042, 0.009, 4], 8), bone: B.chest, slot: S.VEST2 });
  // mag pouches with flaps + pull tabs
  for (let i = -1; i <= 1; i++) {
    const x = i * 0.078, z = -0.205 + 1.6 * x * x;
    pc(place(rbox(0.07, 0.11, 0.046, 0.01), x, 1.225, z), B.chest, S.VEST2);
    pc(place(box(0.074, 0.026, 0.05), x, 1.283, z - 0.002, 0.12), B.chest, S.VEST);
    pc(place(box(0.022, 0.03, 0.006), x, 1.262, z - 0.027), B.chest, S.STRAP);
  }
  pc(place(bend(rbox(0.17, 0.075, 0.03, 0.01, 5, 3, 3), 1.6), 0, 1.415, -0.18), B.chest, S.VEST2); // admin pouch
  pc(place(rbox(0.06, 0.038, 0.008, 0.003), 0.045, 1.42, -0.198), B.chest, S.FAT2); // patch
  // radio (left) + whip antenna, grenade + flashbang (right), IFAK at the back
  pc(place(rbox(0.066, 0.13, 0.062, 0.014), -0.215, 1.215, 0.04), B.chest, S.VEST2);
  pc(place(box(0.044, 0.05, 0.036), -0.22, 1.3, 0.04), B.chest, S.POLY);
  pc(cylAB(v3(-0.22, 1.34, 0.045), v3(-0.25, 1.76, 0.12), 0.0065, 0.004, 5), B.chest, S.STRAP);
  pc(cylAB(v3(0.2, 1.155, -0.07), v3(0.2, 1.27, -0.07), 0.031, 0.031, 10), B.chest, S.VEST2);
  pc(cylAB(v3(0.2, 1.27, -0.07), v3(0.2, 1.3, -0.07), 0.025, 0.02, 8), B.chest, S.HW);
  pc(place(rbox(0.15, 0.1, 0.05, 0.016), 0, 1.2, 0.185), B.chest, S.VEST2);
  // ---- belt + pouches + drop-leg holster
  const pelvisSoft = [soft(B.spine, [0, 1.06, 0], [0, 1, 0], 0.04)];
  add({ g: torsoBand([[0.968, 0.002], [0.968, 0.016], [1.03, 0.016], [1.03, 0.002]], 20), bone: B.pelvis, slot: S.BELT, soft: pelvisSoft });
  pc(place(rbox(0.06, 0.042, 0.014, 0.005), 0, 1.0, -0.12), B.pelvis, S.HW);
  pc(place(rbox(0.15, 0.1, 0.06, 0.02), -0.05, 0.955, 0.15), B.pelvis, S.VEST2); // dump pouch
  pc(place(rbox(0.05, 0.1, 0.085, 0.015), -0.192, 0.955, -0.01), B.pelvis, S.VEST2);
  pc(place(rbox(0.05, 0.175, 0.098, 0.016), HIPX + 0.09, 0.77, 0.0), B.thighR, S.VEST2);
  pc(place(rbox(0.034, 0.075, 0.038, 0.009), HIPX + 0.093, 0.878, -0.025, 0.25), B.thighR, S.POLY);
  for (const yy of [0.71, 0.82]) pc(place(new THREE.CylinderGeometry(0.091, 0.088, 0.022, 14, 1, true), HIPX, yy, 0), B.thighR, S.STRAP);
  pc(place(rbox(0.032, 0.14, 0.11, 0.012), -HIPX - 0.082, 0.74, 0.0), B.thighL, S.FAT2); // cargo pocket

  // ---- headgear
  headgear(add, kind);
  // ---- rifle
  riflePart(add);
  return parts;
}

// neck + head + ears (+ eyes). face: 'skin' | 'mask' | 'eyes'
function addNeckHead(add, face, o = {}) {
  const neck = tubeLoft({ A: [0, 0, 0], D: [0, 1, 0], U: [1, 0, 0], V: [0, 0, 1], keys: [[1.45, 0.072, 0.07, 0.062, 0, 0.0, 2], [1.52, 0.066, 0.068, 0.058, 0, -0.002, 2], [1.59, 0.061, 0.064, 0.055, 0, -0.005, 2], [1.63, 0.056, 0.058, 0.048, 0, -0.006, 2]], ss: lin(1.45, 1.63, 5), M: 12 });
  const nslot = face === 'skin' ? S.SKIN : S.MASK;
  add({ g: neck, wf: (P, W) => chainW(P.y, [[1.5, B.chest], [1.54, B.neck], [1.585, B.neck], [1.625, B.head]], W), slot: nslot,
    paint: (P, N, out) => { if (face === 'skin' && o.beard) { const t = sst(1.562, 1.592, P.y) * sst(0.02, -0.03, P.z); out.s2 = S.BEARD; out.m = t * o.beard * 0.8; } } });
  const hd = headGeo({ hairVol: o.hair ? (x, y, z) => { const hl = hairline(x, z); return y > hl ? (o.hairVol ?? 0.006) * sst(hl, hl + 0.025, y) : 0; } : null });
  hd.scale(HS, HS, HS); hd.translate(HEAD_C.x, HEAD_C.y, HEAD_C.z);
  const ho = { face, beard: o.beard || 0, hair: !!o.hair, brows: !!o.brows };
  add({ g: hd, slot: S.SKIN, wf: o.wf || ((P, W) => { const t = sst(1.582, 1.547, P.y) * sst(-0.03, 0.02, P.z); W[0] = B.head; W[1] = 1 - t; W[2] = B.neck; W[3] = t; return 2; }),
    paint: (P, N, out) => { _hp.set((P.x - HEAD_C.x) / HS, (P.y - HEAD_C.y) / HS, (P.z - HEAD_C.z) / HS); paintHead(_hp, N, out, ho); } });
  if (o.ears) for (const m of [false, true]) {
    const e = earGeo(); e.translate(0.073, -0.004, 0.014); e.scale(HS, HS, HS); e.translate(HEAD_C.x, HEAD_C.y, HEAD_C.z);
    add({ g: e, bone: B.head, slot: face === 'skin' ? S.SKIN : S.MASK, mirror: m, paint: (P, N, out) => { if (face === 'skin') { out.s2 = S.LIP; out.m = 0.25; } } });
  }
  if (o.eyes) for (const sx of [-1, 1]) {
    const c = v3(sx * 0.031 * HS, HEAD_C.y + 0.006 * HS, HEAD_C.z - 0.064 * HS);
    const g = new THREE.SphereGeometry(0.0118, 10, 8); g.translate(c.x, c.y, c.z);
    add({ g, bone: B.head, slot: S.EYE, paint: (P, N, out) => { const f = -N.z; out.s2 = S.IRIS; out.m = sst(0.82, 0.9, f); if (N.y > 0.5) out.k *= 0.7; } });
  }
}
const _hp = new THREE.Vector3();

function headgear(add, kind) {
  const H = (g) => { g.scale(HS, HS, HS); g.translate(HEAD_C.x, HEAD_C.y, HEAD_C.z); return g; };
  const hb = (g, slot, paint) => add({ g: H(g), bone: B.head, slot, paint });
  if (kind === 0) {
    // high-cut helmet: shell lofted from crown to a rim that is cut high over the ears
    const rimT = (a) => Math.PI * (0.47 - 0.09 * Math.cos(a)) - 0.16 * gs((Math.abs(a) - Math.PI / 2) / 0.4);
    const ring = (t, rr) => { const pts = []; for (let j = 0; j < 18; j++) { const a = (j / 18) * Math.PI * 2 - Math.PI; const th = rimT(a) * t; const sx = Math.sin(a), sz = -Math.cos(a); pts.push([0.094 * rr * Math.sin(th) * sx, 0.018 + 0.112 * rr * Math.cos(th), 0.008 + (sz < 0 ? 0.1 : 0.112) * rr * Math.sin(th) * sz]); } return pts; };
    const rs = [0.1, 0.3, 0.5, 0.67, 0.81, 0.92, 1.0].map(t => ring(t, 1)); rs.push(ring(1.0, 0.93));
    hb(loftGeo(rs, true, false), S.HAT, (P, N, out) => { const y = P.y - HEAD_C.y; if (y < 0.035) out.k *= 0.85; });
    for (const sx of [-1, 1]) {
      hb(place(rbox(0.016, 0.026, 0.12, 0.005), sx * 0.098, 0.034, 0.012, 0, 0, -sx * 0.25), S.POLY); // rails
      hb(cylAB(v3(sx * 0.072, -0.006, 0.006), v3(sx * 0.112, -0.006, 0.006), 0.044, 0.042, 10), S.STRAP); // comms cups
      hb(cylAB(v3(sx * 0.11, -0.006, 0.006), v3(sx * 0.118, -0.006, 0.006), 0.036, 0.03, 10), S.POLY);
    }
    hb(place(rbox(0.06, 0.044, 0.022, 0.007), 0, 0.1, -0.105, 0.55), S.POLY); // NVG shroud
    hb(place(rbox(0.07, 0.006, 0.05, 0.002), 0, 0.128, 0.02), S.FAT2); // velcro patch
    hb(place(box(0.07, 0.05, 0.025), 0, 0.03, 0.12, -0.25), S.VEST2); // counterweight pouch
    // wraparound goggles + strap
    hb(place(bend(rbox(0.158, 0.05, 0.028, 0.012, 5, 3, 3), 2.6), 0, 0.008, -0.094), S.STRAP);
    hb(place(bend(rbox(0.142, 0.036, 0.01, 0.006, 5, 3, 3), 2.6), 0, 0.008, -0.11), S.LENS, (P, N, out) => { out.s2 = S.HW; out.m = sst(0.0, 0.03, P.y - HEAD_C.y) * 0.4; });
    hb(place(new THREE.CylinderGeometry(0.1, 0.1, 0.018, 18, 1, true), 0, 0.012, 0.008, 0, 0, 0, 0.98, 1, 1.12), S.STRAP);
  } else if (kind === 1) {
    // ball cap: crown (lofted), seam lines painted, curved brim, button
    const ring = (t, rr) => { const pts = []; for (let j = 0; j < 20; j++) { const a = (j / 20) * Math.PI * 2 - Math.PI; const th = Math.PI * (0.49 - 0.075 * Math.cos(a)) * t; const sx = Math.sin(a), sz = -Math.cos(a); pts.push([0.081 * rr * Math.sin(th) * sx, 0.018 + 0.102 * rr * Math.cos(th), 0.008 + (sz < 0 ? 0.094 : 0.112) * rr * Math.sin(th) * sz]); } return pts; };
    const rs = [0.08, 0.3, 0.52, 0.72, 0.88, 1.0].map(t => ring(t, 1)); rs.push(ring(1.0, 0.95));
    hb(loftGeo(rs, true, false), S.HAT, (P, N, out) => { if (P.y - HEAD_C.y < 0.04) out.k *= 0.85; });
    hb(place(bend(rbox(0.148, 0.01, 0.078, 0.0045, 6, 3, 4), 0, -1.6), 0, 0.047, -0.124, -0.1), S.HAT, (P, N, out) => { if (N.y < -0.3) out.k *= 0.6; });
    hb(ellip(0.009, 0, 0.122, 0.012, 1, 0.5, 1, 8, 4), S.HAT);
    // wrap sunglasses
    hb(place(bend(rbox(0.128, 0.027, 0.009, 0.006, 5, 3, 3), 2.9), 0, 0.007, -0.104), S.LENS, (P, N, out) => { out.s2 = S.HW; out.m = sst(-0.01, 0.02, P.y - HEAD_C.y) * 0.25; });
    for (const sx of [-1, 1]) hb(place(box(0.005, 0.008, 0.1), sx * 0.076, 0.012, -0.045, 0, -sx * 0.06, 0), S.STRAP);
    hb(place(rbox(0.016, 0.028, 0.02, 0.006), 0.079, -0.012, 0.012), S.STRAP); // earpiece
    add({ g: cylAB(v3(0.08, 1.647, 0.02), v3(0.07, 1.5, 0.05), 0.003, 0.003, 4), bone: B.neck, slot: S.STRAP });
  } else {
    // balaclava + over-the-head headset + boom mic
    hb(new THREE.TorusGeometry(0.104, 0.009, 5, 16, Math.PI), S.STRAP);
    for (const sx of [-1, 1]) {
      hb(cylAB(v3(sx * 0.07, -0.006, 0.006), v3(sx * 0.11, -0.006, 0.006), 0.044, 0.042, 10), S.STRAP);
      hb(cylAB(v3(sx * 0.108, -0.006, 0.006), v3(sx * 0.116, -0.006, 0.006), 0.035, 0.03, 10), S.POLY);
    }
    hb(pathTube([[-0.1, -0.02, -0.01], [-0.085, -0.05, -0.06], [-0.04, -0.062, -0.1]], [0, 1, 0], () => [0.004, 0.004, 2], 5), S.STRAP);
    hb(ellip(0.009, -0.035, -0.062, -0.102, 1.3, 1, 1, 8, 6), S.POLY);
  }
}

function riflePart(add) {
  const G = (g) => { g.translate(GUN0.x, GUN0.y, GUN0.z); return g; };
  const gun = (g, slot) => add({ g: G(g), bone: B.gun, slot, ao: false });
  gun(place(rbox(0.044, 0.125, 0.026, 0.008), 0, -0.008, -0.013), S.POLY); // butt pad
  gun(place(rbox(0.04, 0.09, 0.17, 0.014), 0, 0.0, -0.1), S.FURN); // stock
  gun(place(rbox(0.036, 0.03, 0.08, 0.01), 0, 0.058, -0.12), S.FURN); // cheek riser
  gun(cylAB(v3(0, 0.03, -0.16), v3(0, 0.03, -0.215), 0.018, 0.018, 10), S.GMET);
  gun(place(rbox(0.044, 0.05, 0.17, 0.006), 0, -0.006, -0.3), S.GMET); // lower
  gun(place(rbox(0.05, 0.052, 0.25, 0.006), 0, 0.042, -0.335), S.GMET); // upper
  gun(place(box(0.024, 0.013, 0.39), 0, 0.074, -0.39), S.GMET); // rail
  gun(place(box(0.03, 0.01, 0.03), 0, 0.06, -0.205), S.GMET);
  gun(place(box(0.004, 0.026, 0.065), 0.027, 0.04, -0.31), S.HW); // ejection port
  gun(place(rbox(0.04, 0.02, 0.07, 0.004), 0, 0.09, -0.3), S.POLY); // optic mount
  gun(cylAB(v3(0, 0.118, -0.255), v3(0, 0.118, -0.345), 0.022, 0.022, 12), S.POLY); // red dot
  gun(cylAB(v3(0, 0.118, -0.257), v3(0, 0.118, -0.252), 0.018, 0.018, 8, true), S.LENS);
  gun(cylAB(v3(0, 0.118, -0.348), v3(0, 0.118, -0.343), 0.018, 0.018, 8, true), S.LENS);
  gun(place(rbox(0.056, 0.062, 0.235, 0.012), 0, 0.035, -0.568), S.FURN); // handguard
  for (let k = 0; k < 4; k++) gun(place(box(0.058, 0.012, 0.035), 0, 0.04, -0.49 - k * 0.055), S.GMET);
  gun(cylAB(v3(0, 0.036, -0.68), v3(0, 0.036, -0.76), 0.0115, 0.0115, 8), S.GMET); // barrel
  gun(place(rbox(0.02, 0.045, 0.025, 0.004), 0, 0.07, -0.673), S.GMET); // front sight
  gun(cylAB(v3(0, 0.036, -0.752), v3(0, 0.036, -0.8), 0.018, 0.017, 10), S.GMET); // muzzle brake
  gun(cylAB(v3(0.038, 0.028, -0.57), v3(0.038, 0.028, -0.66), 0.015, 0.015, 10), S.GMET); // light
  gun(cylAB(v3(0.038, 0.028, -0.663), v3(0.038, 0.028, -0.658), 0.012, 0.012, 8, true), S.LENS);
  gun(place(rbox(0.033, 0.105, 0.044, 0.01), 0, -0.077, -0.245, -0.35), S.POLY); // pistol grip
  gun(place(box(0.006, 0.008, 0.075), 0, -0.042, -0.29), S.GMET); // trigger guard
  gun(place(box(0.006, 0.026, 0.006), 0, -0.03, -0.287, 0.3), S.GMET);
  gun(place(box(0.008, 0.012, 0.3), 0, -0.07, -0.42, 0.18), S.STRAP); // sling hanging under
  gun(place(box(0.008, 0.012, 0.17), 0, -0.07, -0.13, -0.42), S.STRAP);
  const M = (g) => { g.translate(GUN0.x + MAG_OFF.x, GUN0.y + MAG_OFF.y, GUN0.z + MAG_OFF.z); return g; };
  add({ g: M(place(rbox(0.031, 0.1, 0.066, 0.008), 0, -0.04, 0.0)), bone: B.mag, slot: S.MAGC, ao: false });
  add({ g: M(place(rbox(0.031, 0.085, 0.062, 0.008), 0, -0.115, -0.022, 0.3)), bone: B.mag, slot: S.MAGC, ao: false });
  add({ g: M(place(rbox(0.035, 0.013, 0.068, 0.004), 0, -0.16, -0.04, 0.36)), bone: B.mag, slot: S.POLY, ao: false });
}

// =====================================================================================
//  TEMPLATE BUILD: weights, paint, cavity + AO bake, merge, skeleton
// =====================================================================================
function prepGeo(g) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.index) g = mergeVertices(g, 1e-6);
  else if (g.type !== 'BufferGeometry') { g = mergeVertices(g, 1e-5); }
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  return g;
}
// per-vertex convexity (<0 convex edge, >0 crevice) from 1-ring neighbours
function cavity(g) {
  const pos = g.attributes.position.array, nor = g.attributes.normal.array, ix = g.index.array, n = pos.length / 3;
  const sum = new Float32Array(n), len = new Float32Array(n);
  const acc = (i, j) => {
    const dx = pos[j * 3] - pos[i * 3], dy = pos[j * 3 + 1] - pos[i * 3 + 1], dz = pos[j * 3 + 2] - pos[i * 3 + 2];
    sum[i] += dx * nor[i * 3] + dy * nor[i * 3 + 1] + dz * nor[i * 3 + 2]; len[i] += Math.sqrt(dx * dx + dy * dy + dz * dz);
  };
  for (let t = 0; t < ix.length; t += 3) { const a = ix[t], b = ix[t + 1], c = ix[t + 2]; acc(a, b); acc(a, c); acc(b, a); acc(b, c); acc(c, a); acc(c, b); }
  for (let i = 0; i < n; i++) sum[i] = len[i] > 0 ? sum[i] / len[i] : 0;
  return sum;
}
function vertexArea(g) {
  const pos = g.attributes.position.array, ix = g.index.array, A = new Float32Array(pos.length / 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < ix.length; t += 3) {
    a.fromArray(pos, ix[t] * 3); b.fromArray(pos, ix[t + 1] * 3); c.fromArray(pos, ix[t + 2] * 3);
    const ar = b.sub(a).cross(c.sub(a)).length() / 6;
    A[ix[t]] += ar; A[ix[t + 1]] += ar; A[ix[t + 2]] += ar;
  }
  return A;
}
// point-cloud ambient occlusion (disc approximation), build-time only
function bakeAO(P, N, A, rec, n, R = 0.085) {
  const cs = R, grid = new Map(), key = (x, y, z) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0;
  for (let i = 0; i < n; i++) {
    if (rec[i] === 0) continue; // parts that neither cast nor receive (rifle: its bind placement is arbitrary)
    const k = key(Math.floor(P[i * 3] / cs), Math.floor(P[i * 3 + 1] / cs), Math.floor(P[i * 3 + 2] / cs));
    let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(i);
  }
  const ao = new Float32Array(n).fill(1), R2 = R * R;
  for (let i = 0; i < n; i++) {
    if (!rec[i]) continue;
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2], nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    const cx = Math.floor(px / cs), cy = Math.floor(py / cs), cz = Math.floor(pz / cs);
    let occ = 0;
    for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) for (let c = -1; c <= 1; c++) {
      const bk = grid.get(key(cx + a, cy + b2, cz + c)); if (!bk) continue;
      for (const j of bk) {
        const dx = P[j * 3] - px, dy = P[j * 3 + 1] - py, dz = P[j * 3 + 2] - pz, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > R2 || d2 < 1e-7) continue;
        const d = Math.sqrt(d2), ci = (dx * nx + dy * ny + dz * nz) / d;
        if (ci < 0.12) continue;
        occ += (ci - 0.12) * (A[j] / (A[j] + 3.14 * d2)) * (1 - d / R) * 2.6;
      }
    }
    ao[i] = Math.max(0.32, 1 / (1 + occ));
  }
  return ao;
}
const _psq = new THREE.Quaternion(), _psv = new THREE.Vector3();
function buildTemplate(parts, skel = { heads: HEADS, parent: PARENT, mir: MIR_S }, bounds) {
  const geos = [], s1 = [], s2 = [], mx = [], shade = [], recAO = [], cavA = [];
  const W = [0, 0, 0, 0, 0, 0, 0, 0], PT = { s1: 0, s2: 0, m: 0, k: 1 };
  const P = new THREE.Vector3(), N = new THREE.Vector3(), MP = new THREE.Vector3(), MN = new THREE.Vector3();
  const mir = skel.mir;
  for (const p of parts) {
    let g = prepGeo(p.g.clone());
    if (p.xf) { const [x, y, z, rx = 0, ry = 0, rz = 0] = p.xf; place(g, x, y, z, rx, ry, rz); }
    if (p.mat) g.applyMatrix4(p.mat);
    if (p.mirror) g = mirrorGeo(g);
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const cav = cavity(g);
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), sf = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      P.fromBufferAttribute(pos, i); N.fromBufferAttribute(nor, i);
      // functions are authored for the right side: evaluate on the mirrored point
      if (p.mirror) { MP.set(-P.x, P.y, P.z); MN.set(-N.x, N.y, N.z); } else { MP.copy(P); MN.copy(N); }
      let c;
      if (p.wf) c = p.wf(MP, W);
      else {
        W[0] = p.bone; W[1] = 1; c = 1;
        if (p.soft) {
          let wo = 0, ob = 0;
          for (const s of p.soft) {
            const t = (MP.x - s.j.x) * s.ax.x + (MP.y - s.j.y) * s.ax.y + (MP.z - s.j.z) * s.ax.z;
            const w = Math.min(1, Math.max(0, 0.5 - 0.5 * t / s.r));
            if (w > wo) { wo = w; ob = s.b; }
          }
          if (wo > 0) { W[1] = 1 - wo; W[2] = ob; W[3] = wo; c = 2; }
        }
      }
      let tw = 0;
      for (let k = 0; k < c; k++) tw += W[k * 2 + 1];
      for (let k = 0; k < 4; k++) {
        if (k < c) { si[i * 4 + k] = p.mirror ? mir[W[k * 2]] : W[k * 2]; sw[i * 4 + k] = W[k * 2 + 1] / (tw || 1); } else { si[i * 4 + k] = 0; sw[i * 4 + k] = 0; }
      }
      if (p.preskin) { // bake a rotation into the bind pose, blended by the vertex weights (smooth shoulders)
        const ps = p.preskin; let t = 0;
        for (let k = 0; k < c; k++) if (ps.set.includes(W[k * 2])) t += W[k * 2 + 1] / (tw || 1);
        _psq.identity().slerp(ps.q, t);
        _psv.copy(P).sub(ps.pivot).applyQuaternion(_psq).add(ps.pivot); pos.setXYZ(i, _psv.x, _psv.y, _psv.z);
        _psv.copy(N).applyQuaternion(_psq); nor.setXYZ(i, _psv.x, _psv.y, _psv.z);
      }
      PT.s1 = p.slot; PT.s2 = p.slot; PT.m = 0; PT.k = 1;
      if (p.paint) p.paint(MP, MN, PT);
      const a = SURF[PT.s1], b = SURF[PT.s2];
      sf[i * 2] = lerp(a[0], b[0], PT.m); sf[i * 2 + 1] = lerp(a[1], b[1], PT.m);
      // cloth/hard-surface cavity: lighter worn edges, darker creases
      const cv = cav[i], ck = 1 + Math.min(0.28, Math.max(0, -cv - 0.12) * 0.7) - Math.min(0.45, Math.max(0, cv - 0.02) * 1.6);
      const sky = 0.86 + 0.14 * (N.y * 0.5 + 0.5), noise = 0.95 + 0.1 * hash3(P.x * 61, P.y * 61, P.z * 61);
      s1.push(PT.s1); s2.push(PT.s2); mx.push(PT.m); shade.push(PT.k * ck * sky * noise); recAO.push(p.ao === false ? 0 : 1);
    }
    if (p.postMat) g.applyMatrix4(p.postMat);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setAttribute('surf', new THREE.Float32BufferAttribute(sf, 2));
    geos.push(g);
  }
  const geo = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const count = geo.attributes.position.count;
  // AO bake across every part (gear casts onto the body and vice versa)
  const A = new Float32Array(count); { let o = 0; for (const g of geos) { const a = vertexArea(g); A.set(a, o); o += a.length; } }
  const ao = bakeAO(geo.attributes.position.array, geo.attributes.normal.array, A, recAO, count);
  const shadeF = Float32Array.from(shade); for (let i = 0; i < count; i++) shadeF[i] *= ao[i];
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(0.5), 3));
  const bb = bounds || { c: [0, 1.0, -0.2], r: 1.6, min: [-1, -0.2, -1.4], max: [1, 2.0, 1] };
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(...bb.c), bb.r);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(...bb.min), new THREE.Vector3(...bb.max));
  // skeleton
  const heads = skel.heads, parent = skel.parent, bones = [];
  for (let i = 0; i < NB; i++) { const b = new THREE.Bone(); b.name = 'b' + i; b.position.copy(parent[i] < 0 ? heads[i] : heads[i].clone().sub(heads[parent[i]])); bones.push(b); }
  const mesh = new THREE.SkinnedMesh(geo, gunmanMaterial());
  for (let i = 0; i < NB; i++) (parent[i] < 0 ? mesh : bones[parent[i]]).add(bones[i]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return { mesh, geo, count, s1: Uint8Array.from(s1), s2: Uint8Array.from(s2), mx: Float32Array.from(mx), shade: shadeF, pool: [] };
}

const TEMPLATES = [];
let sharedMat = null;
export function gunmanMaterial() {
  if (sharedMat) return sharedMat;
  sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, envMapIntensity: 1.0 });
  sharedMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 surf;\nvarying vec2 vSurf;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = surf;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSurf;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurf.y;');
  };
  sharedMat.customProgramCacheKey = () => 'bayhem-gunman-v1';
  return sharedMat;
}
function getTemplate(kind) { return TEMPLATES[kind] || (TEMPLATES[kind] = buildTemplate(soldierParts(kind))); }

// per-instance geometry: shares every attribute with the template except the colour buffer (pooled, never disposed)
function acquireGeometry(tpl) {
  if (tpl.pool.length) return tpl.pool.pop();
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'skinIndex', 'skinWeight', 'surf']) g.setAttribute(k, tpl.geo.attributes[k]);
  g.setIndex(tpl.geo.index);
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(tpl.count * 3), 3));
  g.boundingSphere = tpl.geo.boundingSphere.clone();
  g.boundingBox = tpl.geo.boundingBox.clone();
  g.userData.tpl = tpl;
  return g;
}
function releaseGeometry(g) { if (g && g.userData.tpl) g.userData.tpl.pool.push(g); }

const _col = new THREE.Color();
const hexes = (arr) => arr.map(h => new THREE.Color(h));
// albedos kept >= ~0.06 linear so backlit silhouettes never crush to black (rim light does the rest)
const PAL = {
  fat: hexes(['#45474a', '#4a4d45', '#504c44', '#43474e', '#474846', '#4f4f49']),
  vest: hexes(['#6e7552', '#94815e', '#5c654c', '#4c4e50', '#7e7860', '#545c48', '#8c7a5c']),
  skin: hexes(['#d9a582', '#bf8660', '#9a6545', '#764c36', '#e6bc9a', '#ad7754']),
  hair: hexes(['#3a2e26', '#4a3a2c', '#5c4632', '#36322e', '#6a5440']),
  helm: hexes(['#6e7552', '#8a7a5e', '#4c4e50', '#5c654c', '#807a62']),
  cap: hexes(['#47494c', '#5c6448', '#8f7a58', '#3e4658', '#7a6448', '#6e3a30']),
  glove: hexes(['#3e3e40', '#6f604c', '#454545', '#525548']),
  boot: hexes(['#433e38', '#64523c', '#4a423b', '#6e5a40']),
  furn: hexes(['#38383b', '#38383b', '#38383b', '#7f6e52', '#5a5e4a']),
  lensG: hexes(['#d0792c', '#9aa4b0', '#c8a040', '#704028']),
  lensS: hexes(['#30343c', '#b08a3a', '#3a2a20', '#506070']),
  mask: hexes(['#3a3a3d', '#38383a', '#4a4e44', '#47433e']),
};
function makePalette(seed, kind) {
  const r = makeRng((seed * 2654435761) >>> 0 ^ 0x5bd1e995);
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  const pal = new Float32Array(NS * 3);
  const set = (slot, c, k = 1) => { pal[slot * 3] = c.r * k; pal[slot * 3 + 1] = c.g * k; pal[slot * 3 + 2] = c.b * k; };
  const fat = pick(PAL.fat), vest = pick(PAL.vest), skin = pick(PAL.skin), hair = pick(PAL.hair);
  set(S.FAT, fat); set(S.FAT2, fat, 0.8);
  set(S.VEST, vest); _col.copy(vest).multiplyScalar(0.8).lerp(fat, 0.15); set(S.VEST2, _col);
  set(S.GLOVE, pick(PAL.glove)); const boot = pick(PAL.boot); set(S.BOOT, boot); set(S.SOLE, _col.setRGB(0.05, 0.047, 0.044));
  set(S.SKIN, skin); _col.copy(skin).multiplyScalar(0.45); set(S.SKIN2, _col);
  set(S.LIP, _col.copy(skin).multiply(new THREE.Color(0.82, 0.58, 0.56)));
  set(S.MASK, pick(PAL.mask));
  set(S.HAT, kind === 1 ? pick(PAL.cap) : (r() < 0.6 ? vest : pick(PAL.helm)));
  set(S.LENS, kind === 1 ? pick(PAL.lensS) : pick(PAL.lensG));
  set(S.STRAP, _col.setRGB(0.05, 0.05, 0.052));
  set(S.POLY, _col.setRGB(0.045, 0.045, 0.048)); set(S.GMET, _col.setRGB(0.05, 0.051, 0.055));
  set(S.FURN, pick(PAL.furn));
  set(S.MAGC, r() < 0.7 ? _col.setRGB(0.045, 0.045, 0.048) : _col.set('#7b6d58'));
  set(S.HW, _col.setRGB(0.3, 0.3, 0.31)); set(S.BELT, _col.copy(vest).multiplyScalar(0.6));
  set(S.HAIR, hair); set(S.BROW, _col.copy(hair).multiplyScalar(0.8)); set(S.KNEE, r() < 0.5 ? _col.setRGB(0.06, 0.06, 0.062) : _col.copy(vest).multiplyScalar(0.85));
  const beard = r(); set(S.BEARD, _col.copy(skin).lerp(hair, beard < 0.35 ? 0.25 : beard < 0.7 ? 0.55 : 0.85));
  set(S.EYE, _col.setRGB(0.55, 0.5, 0.46)); set(S.IRIS, _col.setRGB(0.04, 0.03, 0.025));
  return pal;
}
function recolor(g, pal) {
  const tpl = g.userData.tpl, col = g.attributes.color.array, a1 = tpl.s1, a2 = tpl.s2, mx = tpl.mx, sh = tpl.shade;
  for (let i = 0, n = tpl.count; i < n; i++) {
    const s = a1[i] * 3, t = a2[i] * 3, m = mx[i], k = sh[i];
    col[i * 3] = (pal[s] + (pal[t] - pal[s]) * m) * k; col[i * 3 + 1] = (pal[s + 1] + (pal[t + 1] - pal[s + 1]) * m) * k; col[i * 3 + 2] = (pal[s + 2] + (pal[t + 2] - pal[s + 2]) * m) * k;
  }
  g.attributes.color.needsUpdate = true;
}

// ---------------- math scratch (no per-frame allocation) ----------------
const _P = Array.from({ length: NB }, () => new THREE.Vector3());
const _Q = Array.from({ length: NB }, () => new THREE.Quaternion());
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();
const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _m1 = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const _fx = new THREE.Vector3(), _fy = new THREE.Vector3(), _fz = new THREE.Vector3();
const X_AX = new THREE.Vector3(1, 0, 0), Y_AX = new THREE.Vector3(0, 1, 0), Z_AX = new THREE.Vector3(0, 0, 1);
const QID = new THREE.Quaternion();

function bindInv(dir, ref) {
  const x = dir.clone().normalize(), y = ref.clone().addScaledVector(x, -ref.dot(x)).normalize(), z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z).transpose();
}
// rotation taking the bind frame (dir0, ref0) to (dir, ref)
function frameQuat(out, dir, ref, binv) {
  _fx.copy(dir).normalize();
  _fy.copy(ref).addScaledVector(_fx, -ref.dot(_fx));
  if (_fy.lengthSq() < 1e-10) { _fy.set(0, 1, 0).addScaledVector(_fx, -_fx.y); if (_fy.lengthSq() < 1e-8) _fy.set(1, 0, 0).addScaledVector(_fx, -_fx.x); }
  _fy.normalize();
  _fz.crossVectors(_fx, _fy);
  _m1.makeBasis(_fx, _fy, _fz).multiply(binv);
  return out.setFromRotationMatrix(_m1);
}
// orientation whose -z looks along dir with +y close to up
function lookQuat(out, dir, up) {
  _fz.copy(dir).negate().normalize();
  _fx.crossVectors(up, _fz);
  if (_fx.lengthSq() < 1e-8) _fx.set(1, 0, 0);
  _fx.normalize();
  _fy.crossVectors(_fz, _fx);
  _m1.makeBasis(_fx, _fy, _fz);
  return out.setFromRotationMatrix(_m1);
}
const BI_ARM_L = bindInv(v3(-1, 0, 0), v3(0, -1, 0));
const BI_ARM_R = bindInv(v3(1, 0, 0), v3(0, 1, 0));
const BI_LEG = bindInv(v3(0, -1, 0), v3(-1, 0, 0));
const BI_TORSO = bindInv(v3(0, 1, 0), v3(1, 0, 0));
const BI_CLAV_L = bindInv(HEADS[B.uarmL].clone().sub(HEADS[B.clavL]), v3(0, 1, 0));
const BI_CLAV_R = bindInv(HEADS[B.uarmR].clone().sub(HEADS[B.clavR]), v3(0, 1, 0));
const BI_GUN = bindInv(v3(0, 0, 1), v3(0, 1, 0));
const BI_HAND_R = bindInv(v3(1, 0, 0), v3(0, -1, 0)); // (finger dir, palm normal)
const BI_HAND_L = bindInv(v3(-1, 0, 0), v3(0, -1, 0));
const handInGun = (bi, dir, palm) => { const q = new THREE.Quaternion(); frameQuat(q, dir.normalize(), palm.normalize(), bi); return q; };
const HQ_R = handInGun(BI_HAND_R, v3(0.12, -0.32, -0.94), v3(-1, 0, 0));
const HQ_L = handInGun(BI_HAND_L, v3(0.5, 0.12, -0.86), v3(0.35, 1, 0));
const HQ_MAG = handInGun(BI_HAND_L, v3(0.05, -0.45, -0.89), v3(1, 0, 0));
// wrists in rifle space
const WRIST_R = GRIP_R.clone().sub(PALM_R.clone().applyQuaternion(HQ_R));
const WRIST_L = GRIP_L.clone().sub(PALM_L.clone().applyQuaternion(HQ_L));
const WRIST_M = MAG_GRIP.clone().sub(PALM_L.clone().applyQuaternion(HQ_MAG));
// magazine relative to the left hand while it holds it
const MAGQ_IN_HAND = HQ_MAG.clone().invert();
const MAGP_IN_HAND = MAG_OFF.clone().sub(WRIST_M).applyQuaternion(MAGQ_IN_HAND);
// rifle relative to the right hand (for a ragdoll that keeps its rifle)
const GUNQ_FROM_HAND = HQ_R.clone().invert();
const GUNP_IN_HAND = WRIST_R.clone().negate().applyQuaternion(GUNQ_FROM_HAND);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const qEuler = (q, x, y, z) => q.setFromEuler(_e.set(x, y, z, 'YXZ'));

// two-bone IK: writes elbow into outE, bend normal into outN; returns reach-clamped target in outT
function ik2(S, T, a, b, pole, outE, outN, outT) {
  _d.subVectors(T, S);
  let d = _d.length();
  if (d < 1e-5) { _d.set(0, -1, 0); d = 1e-5; } else _d.divideScalar(d);
  d = clamp(d, Math.abs(a - b) + 0.01, a + b - 0.0015);
  const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  _o.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_o.lengthSq() < 1e-8) _o.set(0, -1, 0).addScaledVector(_d, _d.y);
  _o.normalize();
  outE.copy(S).addScaledVector(_d, a * ca).addScaledVector(_o, a * sa);
  outT.copy(S).addScaledVector(_d, d);
  outN.crossVectors(_o, _d).normalize();
}

// ---------------- springs ----------------
function spring(s, k, c, h) { s.v += (-k * s.x - c * s.v) * h; s.x += s.v * h; }

const RELOAD_T = 2.3, MAG_SIZE = 30, CLAVS = [B.clavL, B.clavR];
const THROW_T = 1.05, THROW_REL = 0.55;
const _bn = new THREE.Vector3();

// =====================================================================================
export class Gunman {
  constructor(opts = {}) {
    this.pose = opts.pose || (opts.side ? 'window' : 'roof');
    this.side = this.pose === 'window' ? (opts.side || -1) : 0;
    this.seed = (opts.seed ?? 1) >>> 0;
    const r = makeRng((this.seed * 0x9e3779b1) >>> 0 ^ 0x1234567);
    this.rng = r;
    this.kind = opts.headgear ?? Math.floor(r() * 3) % 3;
    const tpl = getTemplate(this.kind);
    this.mesh = cloneSkinned(tpl.mesh);
    this.mesh.geometry = acquireGeometry(tpl);
    recolor(this.mesh.geometry, makePalette(this.seed, this.kind));
    this.mesh.castShadow = true; this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.bones = this.mesh.skeleton.bones;
    this.root = new THREE.Group();
    this.root.name = 'gunman';
    this.root.add(this.mesh);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.copy(MUZZLE); this.bones[B.gun].add(this.muzzle);
    this.headCenter = new THREE.Object3D(); this.headCenter.position.copy(HEAD_C_LOCAL); this.bones[B.head].add(this.headCenter);
    this.chestCenter = new THREE.Object3D(); this.chestCenter.position.set(0, 0.1, -0.01); this.bones[B.chest].add(this.chestCenter);
    // hip placement relative to the slot pivot
    this.hip = new THREE.Vector3();
    if (opts.hipOffset) this.hip.copy(opts.hipOffset);
    else if (this.pose === 'window') this.hip.set(-this.side * 0.16, 0.05, 0);
    else if (this.pose === 'ground') this.hip.set(0, HEADS[B.pelvis].y, 0);
    else this.hip.set(0, 0.37, 0);
    // on-foot locomotion state (pose 'ground': root sits on the floor at the feet, body faces root -z)
    this.ground = this.pose === 'ground';
    this.vel = new THREE.Vector3(); this.velW = new THREE.Vector3(); this.gait = r(); this.crouch = 0; this.crouchTarget = 0;
    this.peek = 0; this.peekTarget = 0; this.runK = 0; this.forceLow = 0; this.throwT = -1; this.thrown = false;
    this.feet = [new THREE.Vector3(-0.13, 0.085, -0.1), new THREE.Vector3(0.13, 0.085, 0.14)];
    this.stepEvents = 0; this._lastFootDown = [true, true];
    // state
    this.t = r() * 10; this.ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
    this.out = this.pose === 'window' ? (this.side < 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
    this.rel = 0; this.yaw = this.out; this.pitch = 0; this.pelYaw = this.out * 0.5;
    this.lean = this.pose === 'window' ? 0.5 : 0; this.ready = 0; this.aimable = true; this.aimErr = 0; this.excess = 0;
    this.rec = { x: 0, v: 0 }; this.flinch = { x: 0, v: 0 }; this.climb = 0;
    this.stag = new THREE.Vector3(); this.stagV = new THREE.Vector3();
    this.hitT = 0; this.ammo = 18 + Math.floor(r() * (MAG_SIZE - 17)); this.reloadT = -1;
    this.acc = new THREE.Vector3(); this._wp = new THREE.Vector3(); this._wv = new THREE.Vector3(); this._frames = 0;
    this.aimOrigin = new THREE.Vector3().copy(this.hip).add(_v1.set(0, 0.48, 0));
    this.nL = new THREE.Vector3(0, -1, 0); this.nR = new THREE.Vector3(0, 1, 0);
    this.dead = false; this.disposed = false;
    // default target: out the window / ahead
    this._idle = new THREE.Vector3(this.pose === 'window' ? this.side * 12 : 0, 1.6, this.pose === 'window' ? 3 : -12);
    this._pose(0, this._idle);
  }

  get canFire() { return !this.dead && this.reloadT < 0 && this.aimable && this.hitT <= 0 && this.aimErr < 0.3 && this.ready < 0.25 && this.throwT < 0; }
  // on-foot controls (pose 'ground'): world-space velocity, crouch 0..1, lean -1 (left) .. +1 (right)
  setMove(vx, vz) { this.velW.set(vx, 0, vz); }
  setCrouch(c) { this.crouchTarget = c; }
  setPeek(p) { this.peekTarget = p; }
  throwGrenade() { if (this.throwT < 0 && !this.dead && this.reloadT < 0) { this.throwT = 0; this.thrown = false; return true; } return false; }
  get reloading() { return this.reloadT >= 0; }

  reload() { if (this.reloadT < 0 && !this.dead) this.reloadT = 0; }

  fire() {
    if (this.dead || this.reloadT >= 0) return false;
    this.rec.v += 11 + this.rng() * 3;
    this.flinch.v += 2.5;
    this.climb = Math.min(0.09, this.climb + 0.012);
    this.climbYaw = (this.climbYaw || 0) + (this.rng() - 0.5) * 0.02;
    if (--this.ammo <= 0) this.reloadT = 0;
    return true;
  }

  hit(dirWorld) {
    if (this.dead) return;
    const root = this.root;
    root.updateWorldMatrix(true, false);
    _v1.copy(dirWorld).normalize().transformDirection(_inv.copy(root.matrixWorld).invert());
    // torque that rocks the upper body along the shot
    _v2.crossVectors(Y_AX, _v1);
    const k = 4.2 + this.rng() * 2.0;
    this.stagV.addScaledVector(_v2, k);
    this.stagV.y += (this.rng() - 0.5) * 4;
    this.flinch.v += 9;
    this.hitT = 0.45 + this.rng() * 0.25;
  }

  update(dt, targetWorld) {
    if (this.dead) return;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const root = this.root;
    root.updateWorldMatrix(true, false);
    _inv.copy(root.matrixWorld).invert();
    // car acceleration in slot space (body sways against it)
    _v1.setFromMatrixPosition(root.matrixWorld);
    if (dt > 1e-5) {
      if (this._frames > 1) {
        _v2.subVectors(_v1, this._wp).divideScalar(dt);
        _v3.subVectors(_v2, this._wv).divideScalar(dt);
        if (_v3.lengthSq() > 400) _v3.setLength(20);
        // world -> local direction (rotation part only)
        const e = _inv.elements;
        const ax = e[0] * _v3.x + e[4] * _v3.y + e[8] * _v3.z, ay = e[1] * _v3.x + e[5] * _v3.y + e[9] * _v3.z, az = e[2] * _v3.x + e[6] * _v3.y + e[10] * _v3.z;
        const k = 1 - Math.exp(-3 * dt);
        this.acc.x += (ax - this.acc.x) * k; this.acc.y += (ay - this.acc.y) * k; this.acc.z += (az - this.acc.z) * k;
        this._wv.copy(_v2);
      } else if (this._frames === 1) this._wv.subVectors(_v1, this._wp).divideScalar(dt);
      this._frames++;
      this._wp.copy(_v1);
    }
    // springs / timers
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      spring(this.rec, 420, 30, h);
      spring(this.flinch, 160, 14, h);
      this.stagV.addScaledVector(this.stag, -55 * h).multiplyScalar(Math.max(0, 1 - 7.5 * h));
      this.stag.addScaledVector(this.stagV, h);
    }
    if (this.stag.lengthSq() > 0.2) this.stag.setLength(0.45);
    this.climb *= Math.exp(-3.5 * dt);
    this.climbYaw = (this.climbYaw || 0) * Math.exp(-3.5 * dt);
    if (this.hitT > 0) this.hitT -= dt;
    if (this.reloadT >= 0) { this.reloadT += dt; if (this.reloadT >= RELOAD_T) { this.reloadT = -1; this.ammo = MAG_SIZE; } }
    if (this.ground) {
      const e = _inv.elements, w = this.velW;
      _v2.set(e[0] * w.x + e[8] * w.z, 0, e[2] * w.x + e[10] * w.z);
      this.vel.lerp(_v2, 1 - Math.exp(-9 * dt));
      this.crouch += (this.crouchTarget - this.crouch) * (1 - Math.exp(-7 * dt));
      this.peek += (this.peekTarget - this.peek) * (1 - Math.exp(-8 * dt));
      if (this.throwT >= 0) { this.throwT += dt; if (this.throwT >= THROW_T) this.throwT = -1; }
    }
    if (targetWorld) _t.copy(targetWorld).applyMatrix4(_inv); else _t.copy(this._idle);
    this._pose(dt, _t);
  }

  // ---------------------------------------------------------------- procedural pose
  _pose(dt, T) {
    const P = _P, Q = _Q, win = this.pose === 'window', side = this.side, tt = this.t, ph = this.ph;
    const k = dt > 0 ? 1 - Math.exp(-7 * dt) : 1;
    // ---- aim angles (from last frame's shoulder line)
    _d.subVectors(T, this.aimOrigin);
    const yawD = Math.atan2(-_d.x, -_d.z), pitD = clamp(Math.atan2(_d.y, Math.hypot(_d.x, _d.z)), -0.8, 1.0);
    let excess = 0;
    if (win) {
      const relD = wrap(yawD - this.out), lim = 1.62;
      excess = Math.max(0, Math.abs(relD) - lim);
      // far across the roof: give up the angle, pull back in and wait at low ready (head still tracks)
      const giveUp = smoothstep(0.6, 1.0, excess);
      const relG = clamp(relD, -lim, lim) * (1 - giveUp * 0.6);
      this.rel += dt > 0 ? clamp((relG - this.rel) * k, -4.5 * dt, 4.5 * dt) : relG - this.rel;
      this.yaw = this.out + this.rel;
    } else {
      this.yaw = wrap(this.yaw + (dt > 0 ? clamp(wrap(yawD - this.yaw) * k, -4.5 * dt, 4.5 * dt) : wrap(yawD - this.yaw)));
      this.pelYaw = wrap(this.pelYaw + wrap(this.yaw - 0.25 - this.pelYaw) * (dt > 0 ? 1 - Math.exp(-2 * dt) : 1));
    }
    this.pitch += dt > 0 ? clamp((pitD - this.pitch) * k, -3 * dt, 3 * dt) : pitD - this.pitch;
    this.excess = excess;
    this.aimable = excess < 0.3;
    this.aimErr = Math.abs(wrap(yawD - this.yaw)) * (excess > 0 ? 0 : 1) + Math.abs(pitD - this.pitch);
    const reloadW = this.reloadT >= 0 ? smoothstep(0, 0.12, this.reloadT / RELOAD_T) * (1 - smoothstep(0.84, 1, this.reloadT / RELOAD_T)) : 0;
    const sp = this.ground ? Math.hypot(this.vel.x, this.vel.z) : 0;
    if (this.ground) this.runK += (smoothstep(2.6, 4.4, sp) - this.runK) * (dt > 0 ? 1 - Math.exp(-6 * dt) : 1);
    const throwW = this.throwT >= 0 ? smoothstep(0, 0.15, this.throwT) * (1 - smoothstep(THROW_T - 0.25, THROW_T, this.throwT)) : 0;
    const readyG = Math.max(this.aimable ? 0 : 1, this.runK * (1 - (this.aimWhileRunning ? 1 : 0)), this.forceLow, throwW);
    this.ready += (readyG - this.ready) * (dt > 0 ? 1 - Math.exp(-5 * dt) : 1);
    const pitch = this.pitch;
    // ---- lean (window shooters hang out of the frame)
    if (win) {
      const reach = smoothstep(0, 0.4, excess) * (1 - smoothstep(0.6, 1.0, excess)), back = smoothstep(0.6, 1.0, excess);
      const lg = 0.6 + 0.3 * reach - 0.22 * back + 0.22 * Math.max(0, pitch) + 0.12 * Math.abs(Math.sin(this.rel));
      this.lean += (lg - this.lean) * (dt > 0 ? 1 - Math.exp(-3 * dt) : 1);
    }
    const lean = this.lean;
    // ---- breathing / sway / car motion
    const breath = Math.sin(tt * 1.7 + ph[0]) * 0.018;
    const swayX = Math.sin(tt * 1.3 + ph[1]) * 0.009 + Math.sin(tt * 2.9 + ph[2]) * 0.005;
    const swayY = Math.sin(tt * 1.1 + ph[3]) * 0.008 + Math.sin(tt * 3.3 + ph[0]) * 0.004 + breath * 0.25;
    const ax = clamp(this.acc.x, -12, 12), az = clamp(this.acc.z, -12, 12);
    const bob = Math.sin(tt * 8.5 + ph[2]) * 0.004 + Math.sin(tt * 13.1) * 0.002;
    // stagger rotation
    const sa = this.stag.length();
    if (sa > 1e-5) _q3.setFromAxisAngle(_v1.copy(this.stag).divideScalar(sa), sa); else _q3.identity();
    // car-motion lean (outermost)
    qEuler(_q2, -az * 0.012, 0, ax * 0.012);

    // ---- pelvis
    P[B.pelvis].copy(this.hip); P[B.pelvis].y += bob;
    const blade = -0.36 + reloadW * 0.25;
    let pelY, chestY = this.yaw + blade;
    if (win) {
      pelY = this.out * 0.28 + this.rel * 0.3;
      _q1.setFromAxisAngle(Z_AX, -side * lean * 0.3);
      Q[B.pelvis].copy(_q1).multiply(qEuler(_qi, 0, pelY, 0));
    } else if (this.ground) {
      const crouch = this.crouch, run = this.runK;
      if (sp > 0.4) { const my = Math.atan2(-this.vel.x, -this.vel.z); const back = Math.abs(wrap(my - this.yaw)) > 1.9; const tgtY = back ? wrap(my + Math.PI) : my; this.pelYaw = wrap(this.pelYaw + wrap(wrap(tgtY + (this.yaw - 0.25 - tgtY) * (1 - run) * 0.6) - this.pelYaw) * (dt > 0 ? 1 - Math.exp(-6 * dt) : 1)); }
      pelY = this.pelYaw;
      const ph = this.gait * Math.PI * 4;
      const bobA = (0.012 + 0.03 * run) * smoothstep(0.2, 1.2, sp);
      P[B.pelvis].y = HEADS[B.pelvis].y - crouch * 0.38 - run * 0.05 - (1 - Math.cos(ph)) * bobA + bob * 0.3;
      P[B.pelvis].x += this.peek * 0.22 * (0.5 + 0.5 * crouch);
      P[B.pelvis].addScaledVector(_v1.set(-Math.sin(pelY), 0, -Math.cos(pelY)), 0.04 * run + 0.06 * crouch);
      _q1.setFromAxisAngle(Z_AX, -this.peek * 0.08 + Math.sin(ph * 0.5) * 0.03 * smoothstep(0.3, 2, sp));
      Q[B.pelvis].copy(qEuler(_qi, 0.03 + crouch * 0.25 + run * 0.12, pelY, 0)).multiply(_q1);
    } else {
      pelY = this.pelYaw;
      Q[B.pelvis].copy(qEuler(_qi, 0.03, pelY, 0));
    }
    const twist = wrap(chestY - pelY);
    const spineY = pelY + twist * 0.5;
    chestY = pelY + twist;
    const counter = win ? lean * 0.55 * Math.max(0, Math.cos(this.rel)) : 0;
    const rec = this.rec.x;
    // spine
    if (win) _q1.setFromAxisAngle(Z_AX, -side * lean * 0.8); else if (this.ground) _q1.setFromAxisAngle(Z_AX, -this.peek * 0.22); else _q1.identity();
    const gLean = this.ground ? this.runK * 0.22 + this.crouch * 0.1 - throwW * 0.15 : 0;
    _q4.copy(_q3).slerp(QID, 0.5);
    Q[B.spine].copy(_q2).multiply(_q4).multiply(_q1).multiply(qEuler(_qi, pitch * 0.18 + (win ? counter * 0.4 : 0.06) - reloadW * 0.05 - gLean * 0.5, spineY, 0));
    // chest
    if (win) _q1.setFromAxisAngle(Z_AX, -side * lean); else if (this.ground) _q1.setFromAxisAngle(Z_AX, -this.peek * 0.3); else _q1.identity();
    Q[B.chest].copy(_q2).multiply(_q3).multiply(_q1).multiply(qEuler(_qi, pitch * 0.38 + counter + breath - rec * 0.05 - reloadW * 0.12 + (win ? 0 : 0.05) - gLean * 0.5, chestY + (this.ground ? throwW * 0.6 * Math.sin(Math.min(1, this.throwT / THROW_T) * Math.PI * 2) : 0), 0));
    // FK torso
    P[B.spine].copy(OFF[B.spine]).applyQuaternion(Q[B.pelvis]).add(P[B.pelvis]);
    P[B.chest].copy(OFF[B.chest]).applyQuaternion(Q[B.spine]).add(P[B.spine]);
    P[B.neck].copy(OFF[B.neck]).applyQuaternion(Q[B.chest]).add(P[B.chest]);
    this.aimOrigin.set(0, 0.22, 0).applyQuaternion(Q[B.chest]).add(P[B.chest]);
    // clavicles (protract toward the rifle)
    Q[B.clavR].copy(Q[B.chest]).multiply(qEuler(_qi, 0, 0.18 - reloadW * 0.1, -0.04 + rec * 0.02));
    Q[B.clavL].copy(Q[B.chest]).multiply(qEuler(_qi, 0, -0.34 + reloadW * 0.15, 0.03));
    for (const c of CLAVS) {
      P[c].copy(OFF[c]).applyQuaternion(Q[B.chest]).add(P[B.chest]);
      P[c + 1].copy(OFF[c + 1]).applyQuaternion(Q[c]).add(P[c]);
    }

    // ---- rifle
    const pocket = _v4.copy(POCKET).applyQuaternion(Q[B.chest]).add(P[B.chest]);
    const dir = _v5.subVectors(T, pocket).normalize();
    if (this.ready > 0.001) { // low ready: muzzle down/forward of the chest
      _v1.set(0.1, -0.5, -1).normalize().applyQuaternion(Q[B.chest]);
      dir.lerp(_v1, this.ready).normalize();
    }
    if (reloadW > 0.001) {
      _v1.set(0.25, -0.2, -1).normalize().applyQuaternion(Q[B.chest]);
      dir.lerp(_v1, reloadW).normalize();
    }
    // sway, muzzle climb, recoil, stagger
    _v1.set(1, 0, 0).applyQuaternion(Q[B.chest]); _v2.set(0, 1, 0).applyQuaternion(Q[B.chest]);
    const st = this.hitT > 0 ? 3 : 1;
    dir.addScaledVector(_v1, swayX * st + this.climbYaw).addScaledVector(_v2, swayY * st + this.climb + rec * 0.11).normalize();
    if (sa > 1e-5) dir.applyQuaternion(_q4.copy(_q3).slerp(QID, 0.4));
    const gunPos = P[B.gun].copy(pocket).addScaledVector(dir, -rec * 0.055);
    if (reloadW > 0.001) gunPos.add(_v3.set(-0.03, -0.07, 0.02).multiplyScalar(reloadW).applyQuaternion(Q[B.chest]));
    if (this.ready > 0.001) gunPos.add(_v3.set(0.0, -0.04, 0.03).multiplyScalar(this.ready).applyQuaternion(Q[B.chest]));
    // up vector: chest up with a slight cant (big cant while reloading)
    _v3.set(Math.sin(0.06 + reloadW * 0.75), Math.cos(0.06 + reloadW * 0.75), 0).applyQuaternion(Q[B.chest]);
    lookQuat(Q[B.gun], dir, _v3);
    const gunQ = Q[B.gun];

    // ---- hands
    // right: pistol grip
    _v1.copy(WRIST_R).applyQuaternion(gunQ).add(gunPos);
    Q[B.handR].copy(gunQ).multiply(HQ_R);
    this._arm(B.clavR, _v1, _v2.set(0.75, -0.62, 0.25).normalize().applyQuaternion(Q[B.chest]), BI_ARM_R, this.nR);
    // left: handguard, or magazine change path while reloading
    let magInHand = false;
    if (this.reloadT >= 0) {
      const p = this.reloadT / RELOAD_T;
      const pouch = _v6.set(-0.085, 0.13, -0.27).applyQuaternion(Q[B.chest]).add(P[B.chest]);
      const wM = _v3.copy(WRIST_M).applyQuaternion(gunQ).add(gunPos);
      const wA = _v2.copy(WRIST_L).applyQuaternion(gunQ).add(gunPos);
      let s;
      if (p < 0.12) { s = smoothstep(0, 0.12, p); _v1.copy(wA).lerp(wM, s); _q1.copy(gunQ).multiply(HQ_L); _qi.copy(gunQ).multiply(HQ_MAG); Q[B.handL].copy(_q1).slerp(_qi, s); }
      else if (p < 0.3) { s = smoothstep(0.12, 0.3, p); _v1.copy(wM).lerp(pouch, s); Q[B.handL].copy(gunQ).multiply(HQ_MAG); magInHand = p > 0.14; }
      else if (p < 0.42) { _v1.copy(pouch); _v1.y += Math.sin((p - 0.3) * 40) * 0.01; Q[B.handL].copy(gunQ).multiply(HQ_MAG); magInHand = true; }
      else if (p < 0.62) { s = smoothstep(0.42, 0.62, p); _v1.copy(pouch).lerp(wM, s); Q[B.handL].copy(gunQ).multiply(HQ_MAG); magInHand = true; }
      else if (p < 0.72) { s = Math.sin((p - 0.62) / 0.1 * Math.PI) * 0.025; _v1.copy(wM).addScaledVector(_v6.set(0, 1, 0).applyQuaternion(gunQ), s); Q[B.handL].copy(gunQ).multiply(HQ_MAG); magInHand = p < 0.66; }
      else { s = smoothstep(0.72, 0.9, p); _v1.copy(wM).lerp(wA, s); _q1.copy(gunQ).multiply(HQ_MAG); _qi.copy(gunQ).multiply(HQ_L); Q[B.handL].copy(_q1).slerp(_qi, s); }
    } else if (throwW > 0.001) {
      // grenade throw: left hand goes back over the shoulder, then whips forward and releases at THROW_REL
      const p = this.throwT / THROW_T;
      const back = _v6.set(-0.25, 0.32, 0.22).applyQuaternion(Q[B.chest]).add(P[B.chest]);
      const fwdP = _v2.set(-0.12, 0.22, -0.62).applyQuaternion(Q[B.chest]).add(P[B.chest]);
      const grip = _v3.copy(WRIST_L).applyQuaternion(gunQ).add(gunPos);
      if (p < 0.4) _v1.copy(grip).lerp(back, smoothstep(0, 0.4, p));
      else if (p < 0.62) _v1.copy(back).lerp(fwdP, smoothstep(0.4, 0.62, p));
      else _v1.copy(fwdP).lerp(grip, smoothstep(0.62, 1, p));
      Q[B.handL].copy(Q[B.chest]).multiply(qEuler(_qi, -0.6 + p * 1.2, 0.4, 1.2));
      this.handLWorld = this.handLWorld || new THREE.Vector3();
      if (!this.thrown && p >= THROW_REL) { this.thrown = true; this.releaseNow = true; }
    } else {
      _v1.copy(WRIST_L).applyQuaternion(gunQ).add(gunPos);
      Q[B.handL].copy(gunQ).multiply(HQ_L);
    }
    this._arm(B.clavL, _v1, _v2.set(-0.3, -0.92, 0.1).normalize().applyQuaternion(Q[B.chest]), BI_ARM_L, this.nL);
    // magazine
    if (magInHand) {
      Q[B.mag].copy(Q[B.handL]).multiply(MAGQ_IN_HAND);
      P[B.mag].copy(MAGP_IN_HAND).applyQuaternion(Q[B.handL]).add(P[B.handL]);
    } else {
      Q[B.mag].copy(gunQ);
      P[B.mag].copy(MAG_OFF).applyQuaternion(gunQ).add(gunPos);
    }

    // ---- head: look at the target (or the mag well while reloading), cheek on the stock when aiming
    _v1.set(0, 0.2, -0.01).applyQuaternion(Q[B.chest]).add(P[B.neck]);
    if (this.reloadT >= 0) _v2.copy(MAG_OFF).applyQuaternion(gunQ).add(gunPos).lerp(T, 1 - reloadW);
    else _v2.copy(T);
    _v2.sub(_v1).normalize();
    _v3.set(0, 1, 0).applyQuaternion(Q[B.chest]);
    lookQuat(_q1, _v2, _v3);
    _qi.copy(Q[B.chest]).invert().multiply(_q1); // relative to chest
    const ang = 2 * Math.acos(Math.min(1, Math.abs(_qi.w)));
    if (ang > 1.25) _q1.identity().slerp(_qi, 1.25 / ang), _qi.copy(_q1);
    const weld = (1 - this.ready) * (1 - reloadW) * (this.hitT > 0 ? 0.3 : 1);
    _qi.multiply(qEuler(_q1, -0.22 * weld - this.flinch.x * 0.06, 0.06 * weld, -0.3 * weld + this.flinch.x * 0.03));
    Q[B.head].copy(Q[B.chest]).multiply(_qi);
    Q[B.neck].copy(Q[B.chest]).multiply(_q1.identity().slerp(_qi, 0.45));

    // ---- legs
    let lp = Q[B.pelvis];
    if (win) {
      lp = qEuler(_q4, 0, -this.out * 0.16, side * 0.05); // seated: legs stay in the car's frame, not the twisting hips
      Q[B.thighL].copy(lp).multiply(qEuler(_qi, 1.42, 0.06, 0));
      Q[B.thighR].copy(lp).multiply(qEuler(_qi, 1.42, -0.06, 0));
      Q[B.shinL].copy(lp).multiply(qEuler(_qi, -0.12, 0.1, 0));
      Q[B.shinR].copy(lp).multiply(qEuler(_qi, -0.04, -0.1, 0));
      Q[B.footL].copy(Q[B.shinL]).multiply(qEuler(_qi, 0.12, 0, 0));
      Q[B.footR].copy(Q[B.shinR]).multiply(qEuler(_qi, 0.06, 0, 0));
    } else if (this.ground) {
      this._legs(dt, sp);
    } else {
      Q[B.thighL].copy(lp).multiply(qEuler(_qi, 0.12, 0.06, -0.05));
      Q[B.thighR].copy(lp).multiply(qEuler(_qi, 0.02, -0.06, 0.07));
      Q[B.shinL].copy(lp).multiply(qEuler(_qi, -0.1, 0.06, -0.03));
      Q[B.shinR].copy(lp).multiply(qEuler(_qi, -0.03, -0.06, 0.04));
      Q[B.footL].copy(Q[B.shinL]).multiply(qEuler(_qi, 0.1, 0, 0));
      Q[B.footR].copy(Q[B.shinR]).multiply(qEuler(_qi, 0.03, 0, 0));
    }
    this._apply(P, Q);
  }

  // ---- on-foot legs: procedural gait (stance/swing cycle along the travel direction) + 2-bone leg IK
  _legs(dt, sp) {
    const P = _P, Q = _Q, run = this.runK, crouch = this.crouch;
    const cyc = 0.82 + 0.3 * sp;                        // gait cycles per second
    if (dt > 0) this.gait = (this.gait + cyc * dt * smoothstep(0.02, 0.25, sp + 0.0)) % 1;
    const L = sp / cyc;                                  // stride length
    const duty = 0.62 - 0.22 * run;                      // stance fraction
    const gw = smoothstep(0.08, 0.5, sp);
    const dirX = sp > 1e-4 ? this.vel.x / sp : 0, dirZ = sp > 1e-4 ? this.vel.z / sp : -1;
    const fy = Math.atan2(-Math.sin(this.pelYaw), -Math.cos(this.pelYaw)); // pelvis forward yaw
    const cy = Math.cos(this.pelYaw), sy = Math.sin(this.pelYaw);
    for (let s = 0; s < 2; s++) {
      const thigh = s ? B.thighR : B.thighL, shin = thigh + 1, foot = thigh + 2;
      // hip (FK from the pelvis)
      P[thigh].copy(OFF[thigh]).applyQuaternion(Q[B.pelvis]).add(P[B.pelvis]);
      const hip = P[thigh];
      const side = s ? 1 : -1;
      // idle / crouch stance in pelvis-yaw space: left foot forward, right back (bladed rifle stance)
      const fwdOff = s ? 0.16 + crouch * 0.12 : -0.12 - crouch * 0.18, latOff = side * (0.13 + crouch * 0.07);
      _v1.set(cy * latOff + sy * fwdOff, 0.085, -sy * latOff + cy * fwdOff); // rotate (lat, fwd) by pelvis yaw
      _v1.x += this.hip.x * 0 + P[B.pelvis].x * 0.6; _v1.z += P[B.pelvis].z * 0.6;
      // gait
      const phi = (this.gait + s * 0.5) % 1;
      let along, lift = 0;
      if (phi < duty) along = L * (0.5 - phi / duty);
      else { const u = (phi - duty) / (1 - duty); along = L * (-0.5 + u * u * (3 - 2 * u)); lift = Math.sin(Math.PI * u) * (0.1 + 0.12 * run) * (1 - crouch * 0.5); }
      _v2.set(hip.x * 0.4 + side * 0.04 * (1 - run) * cy, 0.085 + lift, hip.z * 0.4 - side * 0.04 * (1 - run) * sy);
      _v2.x += dirX * along; _v2.z += dirZ * along;
      const tgt = _v3.copy(_v1).lerp(_v2, gw);
      const down = phi < duty || gw < 0.5;
      if (down && !this._lastFootDown[s] && gw > 0.5) this.stepEvents++;
      this._lastFootDown[s] = down;
      // knee pole: forward of the pelvis, splayed out a little (more when crouched)
      const pole = _v4.set(-sy + side * cy * (0.25 + crouch * 0.5), 0.05, -cy - side * sy * (0.25 + crouch * 0.5)).normalize();
      ik2(hip, tgt, TH, SH, pole, _v5, _fy, _v6);
      _bn.copy(_fy);
      _v1.subVectors(_v5, hip); frameQuat(Q[thigh], _v1, _bn, BI_LEG);
      _v1.subVectors(_v6, _v5); frameQuat(Q[shin], _v1, _bn, BI_LEG);
      P[shin].copy(_v5); P[foot].copy(_v6);
      // foot: flat, heel-toe roll during swing, pointing along the pelvis (toes out a bit)
      const roll = phi < duty ? 0 : Math.sin(Math.PI * (phi - duty) / (1 - duty)) * 0.5 * gw;
      Q[foot].copy(qEuler(_qi, -roll + 0.06, fy + Math.PI + side * -0.12, 0));
    }
  }

  _arm(c, wrist, pole, binv, nStore) {
    const P = _P, Q = _Q, u = c + 1, f = c + 2, h = c + 3;
    ik2(P[u], wrist, UA, FA, pole, P[f], _fy, _v6);
    nStore.copy(_fy);
    _v3.subVectors(P[f], P[u]);
    frameQuat(Q[u], _v3, nStore, binv);
    _v3.subVectors(_v6, P[f]);
    frameQuat(Q[f], _v3, nStore, binv);
    P[h].copy(_v6);
  }

  _apply(P, Q) {
    const bones = this.bones;
    for (let b = 0; b < NB; b++) {
      const bone = bones[b], p = PARENT[b];
      if (p < 0) { bone.position.copy(P[b]); bone.quaternion.copy(Q[b]); }
      else bone.quaternion.copy(Q[p]).invert().multiply(Q[b]);
    }
  }

  // ---------------------------------------------------------------- death
  die(carVelocity, impulseDirWorld, scene, power = 1) {
    if (this.dead) return this.ragdoll;
    this.dead = true;
    const root = this.root;
    root.updateWorldMatrix(true, true);
    // outward direction of the car (world)
    const outW = new THREE.Vector3();
    if (this.pose === 'window' && root.parent) outW.set(this.side, 0, 0).transformDirection(root.parent.matrixWorld);
    else { const a = this.rng() * Math.PI * 2; outW.set(Math.cos(a), 0, Math.sin(a)); }
    const rd = new Ragdoll(this, carVelocity, impulseDirWorld, outW, power);
    if (root.parent) root.parent.remove(root);
    root.position.set(0, 0, 0); root.quaternion.identity(); root.scale.set(1, 1, 1);
    this.mesh.position.set(0, 0, 0); this.mesh.quaternion.identity(); this.mesh.scale.set(1, 1, 1);
    (scene || null)?.add(root);
    rd._writeBones();
    root.updateMatrixWorld(true);
    this.ragdoll = rd;
    return rd;
  }

  dispose() {
    if (this.disposed) return;
    if (this.dead && this.ragdoll && !this.ragdoll.disposed) return; // the ragdoll owns the mesh now
    this.disposed = true;
    this.root.removeFromParent();
    releaseGeometry(this.mesh.geometry);
    this.mesh.skeleton.dispose();
  }
}

// =====================================================================================
//  Ragdoll: 15 body particles + 3 rifle particles, PBD with distance / range / collision
// =====================================================================================
const RP = { HL: 0, HR: 1, SP: 2, NK: 3, HD: 4, SL: 5, SR: 6, EL: 7, ER: 8, WL: 9, WR: 10, KL: 11, KR: 12, FL: 13, FR: 14, GB: 15, GM: 16, GG: 17 };
const NP = 18, NBODY = 15;
const P_MASS = [12, 12, 14, 7, 5, 6, 6, 2.2, 2.2, 1.1, 1.1, 6, 6, 2.6, 2.6, 1.2, 1.2, 1.2];
const P_RAD = [0.09, 0.09, 0.11, 0.09, 0.11, 0.07, 0.07, 0.05, 0.05, 0.045, 0.045, 0.06, 0.06, 0.055, 0.055, 0.025, 0.025, 0.03];
const P_DRAG = [0.05, 0.05, 0.05, 0.06, 0.07, 0.06, 0.06, 0.14, 0.14, 0.22, 0.22, 0.09, 0.09, 0.15, 0.15, 0.12, 0.12, 0.12];
const PB = [B.thighL, B.thighR, B.chest, B.neck, -1, B.uarmL, B.uarmR, B.farmL, B.farmR, B.handL, B.handR, B.shinL, B.shinR, B.footL, B.footR];
const BIND_P = PB.map((b) => (b < 0 ? HEAD_C.clone() : HEADS[b].clone()));
const RIGID = [[0, 1], [0, 2], [1, 2], [2, 3], [2, 5], [2, 6], [3, 5], [3, 6], [5, 6], [3, 4], [5, 7], [7, 9], [6, 8], [8, 10], [0, 11], [11, 13], [1, 12], [12, 14]];
const RANGES = [ // [a, b, minFrac, maxFrac] of bind distance
  [0, 3, 0.8, 1.03], [1, 3, 0.8, 1.03], [0, 6, 0.86, 1.08], [1, 5, 0.86, 1.08], [0, 5, 0.82, 1.08], [1, 6, 0.82, 1.08],
  [4, 2, 0.8, 1.02], [4, 5, 0.75, 1.12], [4, 6, 0.75, 1.12],
  [5, 9, 0.25, 1.0], [6, 10, 0.25, 1.0], [0, 13, 0.32, 1.0], [1, 14, 0.32, 1.0],
  [11, 2, 0.45, 1.06], [12, 2, 0.45, 1.06], [11, 12, 0.5, 3.6], [13, 14, 0.5, 6], [9, 2, 0.35, 9], [10, 2, 0.35, 9], [4, 11, 0.4, 9], [4, 12, 0.4, 9],
];
const GUN_RIGID = [[15, 16], [15, 17], [16, 17]];
const GUN_PTS = [new THREE.Vector3(0, 0.0, -0.02), MUZZLE.clone(), new THREE.Vector3(0, -0.17, -0.41)];
const ROAD_MU = 0.85, REST = 0.28;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _w = new THREE.Vector3();
const _RQ = Array.from({ length: NB }, () => new THREE.Quaternion());
let _px = null;
const p = (i, out) => out.set(_px[i * 3], _px[i * 3 + 1], _px[i * 3 + 2]);
const _rdP = new THREE.Vector3(), _rdOut = { hit: false, nx: 0, ny: 0, nz: 0 };

export class Ragdoll {
  constructor(gm, carVel, dirWorld, outW, power = 1) {
    this.gm = gm; this.mesh = gm.mesh; this.bones = gm.bones; this._root = gm.root;
    this.rng = makeRng((gm.seed * 747796405 + 2891336453) >>> 0);
    const r = this.rng;
    this.age = 0; this.impact = 0; this.gunImpact = 0; this.disposed = false;
    this._pos = new THREE.Vector3();
    const x = this.x = new Float64Array(NP * 3), v = this.v = new Float64Array(NP * 3), x0 = this.x0 = new Float64Array(NP * 3);
    this.vy0 = new Float64Array(NP); this.contact = new Uint8Array(NP);
    this.w = Float64Array.from(P_MASS, (m) => 1 / m);
    const bones = this.bones;
    // particles from the current pose (world)
    for (let i = 0; i < NBODY; i++) {
      if (PB[i] < 0) _a.copy(HEAD_C_LOCAL).applyMatrix4(bones[B.head].matrixWorld);
      else _a.setFromMatrixPosition(bones[PB[i]].matrixWorld);
      x[i * 3] = _a.x; x[i * 3 + 1] = _a.y; x[i * 3 + 2] = _a.z;
    }
    for (let i = 0; i < 3; i++) {
      _a.copy(GUN_PTS[i]).applyMatrix4(bones[B.gun].matrixWorld);
      x[(15 + i) * 3] = _a.x; x[(15 + i) * 3 + 1] = _a.y; x[(15 + i) * 3 + 2] = _a.z;
    }
    this.keepGun = r() < 0.3;
    // constraints
    const ca = [], cb = [], cmin = [], cmax = [];
    const dist = (i, j) => Math.hypot(x[i * 3] - x[j * 3], x[i * 3 + 1] - x[j * 3 + 1], x[i * 3 + 2] - x[j * 3 + 2]);
    for (const [i, j] of RIGID) { const d = dist(i, j); ca.push(i); cb.push(j); cmin.push(d); cmax.push(d); }
    this.nRigid = ca.length;
    for (const [i, j, lo, hi] of RANGES) {
      const d0 = BIND_P[i].distanceTo(BIND_P[j]), d = dist(i, j);
      ca.push(i); cb.push(j); cmin.push(Math.min(d0 * lo, d * 0.98)); cmax.push(Math.max(d0 * hi, d * 1.02));
    }
    if (!this.keepGun) for (const [i, j] of GUN_RIGID) { const d = dist(i, j); ca.push(i); cb.push(j); cmin.push(d); cmax.push(d); }
    this.ca = Int16Array.from(ca); this.cb = Int16Array.from(cb); this.cmin = Float64Array.from(cmin); this.cmax = Float64Array.from(cmax);
    this.np = this.keepGun ? NBODY : NP;
    // initial velocities: car velocity + the hit, biased to the upper body so they pitch out and over
    const dir = _b.copy(dirWorld || _b.set(0, 1, 0));
    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
    dir.normalize();
    const od = dir.dot(outW);
    if (gm.pose === 'window' && od < 0) dir.addScaledVector(outW, -od); // never shove them back into the car
    const out = gm.pose === 'window' ? 2.6 : gm.pose === 'ground' ? 0.25 : 1.4;
    const upK = gm.pose === 'ground' ? 0.35 : 1;
    for (let i = 0; i < NP; i++) {
      const upper = i >= 2 && i <= 10 ? 1 : i >= 15 ? 0.9 : 0.45;
      const limb = (i >= 7 && i <= 14) ? 1 : 0;
      v[i * 3] = (carVel ? carVel.x : 0) + dir.x * 3.4 * power * upper + outW.x * out * (0.6 + upper * 0.6) + (r() - 0.5) * (1 + limb * 3);
      v[i * 3 + 1] = (carVel ? carVel.y : 0) + dir.y * 3.4 * power * upper + (1.8 + upper * 1.2) * upK + (r() - 0.5) * (1 + limb * 3);
      v[i * 3 + 2] = (carVel ? carVel.z : 0) + dir.z * 3.4 * power * upper + outW.z * out * (0.6 + upper * 0.6) + (r() - 0.5) * (1 + limb * 3);
    }
    if (!this.keepGun) { // fling the rifle with spin
      const sp = 1.5 + r() * 2.5;
      v[16 * 3 + 1] += sp; v[15 * 3 + 1] -= sp * 0.3; v[16 * 3] += (r() - 0.5) * sp; v[17 * 3 + 2] += (r() - 0.5) * sp;
    }
    // limb bend normals (fallbacks for straight limbs)
    this.nArm = [gm.nL.clone(), gm.nR.clone()];
    this.nLeg = [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-1, 0, 0)];
    this.twitch = 0.9 + r() * 0.6;
  }
  get root() { return this._root; }
  get position() { return this._pos; }
  get done() { return Ragdoll.world ? false : (this.age > 12 || this._pos.z > 320); }

  // Ragdoll.world: optional CollisionWorld (on-foot levels) -> floors from groundAt(), walls/box tops from collidePoint()
  update(dt, groundV = 0) {
    this.impact = 0; this.gunImpact = 0;
    if (!(dt > 0) || this.disposed || this.asleep) return;
    dt = Math.min(dt, 0.05);
    this.age += dt;
    const W = Ragdoll.world;
    if (W) {
      const x = this.x; this.floor ||= new Float64Array(NP);
      for (let i = 0; i < this.np; i++) this.floor[i] = W.groundAt(x[i * 3], x[i * 3 + 2], x[i * 3 + 1] + 0.3, 0.2);
    }
    const n = Math.max(1, Math.ceil(dt * 240 - 1e-6)), h = dt / n;
    for (let s = 0; s < n; s++) { this._substep(h, groundV); if (W && (s % 3 === 2 || s === n - 1)) this._boxes(W); }
    this._writeBones();
    // settle: once a body has come to rest it stops simulating (on-foot levels keep the bodies around)
    if (W && this.age > 2.5) {
      let ke = 0; const v = this.v; for (let i = 0; i < NBODY * 3; i++) ke += v[i] * v[i];
      this.still = ke < 0.6 ? (this.still || 0) + dt : 0;
      if (this.still > 0.8) this.asleep = true;
    }
  }
  _boxes(W) {
    const x = this.x, o = _rdOut;
    for (let i = 0; i < this.np; i++) {
      const j = i * 3; _rdP.set(x[j], x[j + 1], x[j + 2]);
      W.collidePoint(_rdP, P_RAD[i], o);
      if (o.hit) {
        if (o.ny > 0.5) { this.contact[i] = 1; const dx = _rdP.x - x[j], dz = _rdP.z - x[j + 2]; x[j] = _rdP.x - (x[j] - this.x0[j]) * 0.5 + dx * 0; x[j + 2] = _rdP.z - (x[j + 2] - this.x0[j + 2]) * 0.5; x[j + 1] = _rdP.y; }
        else { x[j] = _rdP.x; x[j + 1] = _rdP.y; x[j + 2] = _rdP.z; }
      }
    }
  }

  _substep(h, G) {
    const x = this.x, v = this.v, x0 = this.x0, w = this.w, np = this.np, r = this.rng;
    // flailing death throes
    if (this.age < this.twitch) {
      const k = 1 - this.age / this.twitch;
      for (const i of FLAIL) if (r() < 22 * h) { v[i * 3] += (r() - 0.5) * 7 * k; v[i * 3 + 1] += (r() - 0.35) * 7 * k; v[i * 3 + 2] += (r() - 0.5) * 7 * k; }
    }
    for (let i = 0; i < np; i++) {
      const j = i * 3, dr = P_DRAG[i] * h;
      v[j] -= v[j] * dr; v[j + 1] -= 9.81 * h + v[j + 1] * dr; v[j + 2] += (G - v[j + 2]) * dr; // still air = moving at road speed
      this.vy0[i] = v[j + 1];
      x0[j] = x[j]; x0[j + 1] = x[j + 1]; x0[j + 2] = x[j + 2];
      x[j] += v[j] * h; x[j + 1] += v[j + 1] * h; x[j + 2] += v[j + 2] * h;
      this.contact[i] = 0;
    }
    const ca = this.ca, cb = this.cb, cmin = this.cmin, cmax = this.cmax, nc = ca.length;
    for (let it = 0; it < 5; it++) {
      for (let c = 0; c < nc; c++) {
        const i = ca[c] * 3, jj = cb[c] * 3;
        if (cb[c] >= np || ca[c] >= np) continue;
        const dx = x[jj] - x[i], dy = x[jj + 1] - x[i + 1], dz = x[jj + 2] - x[i + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        let target;
        if (d < cmin[c]) target = cmin[c]; else if (d > cmax[c]) target = cmax[c]; else continue;
        const wi = w[ca[c]], wj = w[cb[c]], f = (d - target) / (d * (wi + wj));
        x[i] += dx * f * wi; x[i + 1] += dy * f * wi; x[i + 2] += dz * f * wi;
        x[jj] -= dx * f * wj; x[jj + 1] -= dy * f * wj; x[jj + 2] -= dz * f * wj;
      }
      this._torsoCollide();
      if (it === 2) this._kneeHinge();
      this._ground(h, G);
    }
    // velocities, bounce, impacts
    for (let i = 0; i < np; i++) {
      const j = i * 3;
      v[j] = (x[j] - x0[j]) / h; v[j + 1] = (x[j + 1] - x0[j + 1]) / h; v[j + 2] = (x[j + 2] - x0[j + 2]) / h;
      const sp2 = v[j] * v[j] + v[j + 1] * v[j + 1] + (v[j + 2] - G) * (v[j + 2] - G);
      if (sp2 > 3600) { const k = 60 / Math.sqrt(sp2); v[j] *= k; v[j + 1] *= k; v[j + 2] = G + (v[j + 2] - G) * k; }
      if (this.contact[i]) {
        const vy0 = this.vy0[i];
        if (vy0 < -1.2) v[j + 1] = Math.max(v[j + 1], -vy0 * (i >= 15 ? 0.42 : REST));
        const imp = -vy0;
        if (i < 15) { if (imp > this.impact && (i <= 6 || i >= 11)) this.impact = imp; } else if (imp > this.gunImpact) this.gunImpact = imp;
        // asphalt is rough: fast sliding contacts get kicked up -> tumbling
        const rel = Math.hypot(v[j], v[j + 2] - G);
        if (rel > 6 && r() < 30 * h) v[j + 1] += r() * Math.min(2.2, rel * 0.08);
      }
    }
  }

  _ground(h, G) {
    const x = this.x, x0 = this.x0, np = this.np, fl = Ragdoll.world ? this.floor : null;
    for (let i = 0; i < np; i++) {
      const j = i * 3, rad = P_RAD[i], f = fl ? fl[i] : 0;
      if (x[j + 1] >= f + rad) continue;
      const depth = f + rad - x[j + 1];
      x[j + 1] = f + rad;
      this.contact[i] = 1;
      // positional Coulomb friction against the moving road
      const dx = x[j] - x0[j], dz = (x[j + 2] - x0[j + 2]) - G * h;
      const dl = Math.sqrt(dx * dx + dz * dz);
      const mf = ROAD_MU * depth;
      if (dl <= mf) { x[j] -= dx; x[j + 2] -= dz; }
      else if (dl > 1e-9) { const s = mf / dl; x[j] -= dx * s; x[j + 2] -= dz * s; }
    }
  }

  _torsoCollide() {
    const x = this.x;
    // capsules: hip-mid -> spine, spine -> neck
    const C = CAPS;
    C[0] = (x[0] + x[3]) * 0.5; C[1] = (x[1] + x[4]) * 0.5; C[2] = (x[2] + x[5]) * 0.5;
    C[3] = x[6]; C[4] = x[7]; C[5] = x[8]; C[6] = x[9]; C[7] = x[10]; C[8] = x[11];
    for (let ci = 0; ci < 2; ci++) {
      const o = ci * 3, px = C[o], py = C[o + 1], pz = C[o + 2], qx = C[o + 3], qy = C[o + 4], qz = C[o + 5], cr = ci ? 0.14 : 0.12;
      const ux = qx - px, uy = qy - py, uz = qz - pz, uu = ux * ux + uy * uy + uz * uz || 1e-6;
      for (const i of COLL[ci]) {
        const j = i * 3;
        let t = ((x[j] - px) * ux + (x[j + 1] - py) * uy + (x[j + 2] - pz) * uz) / uu;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = px + ux * t, cy = py + uy * t, cz = pz + uz * t;
        const dx = x[j] - cx, dy = x[j + 1] - cy, dz = x[j + 2] - cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz), md = cr + P_RAD[i];
        if (d < md && d > 1e-6) { const f = (md - d) / d; x[j] += dx * f; x[j + 1] += dy * f; x[j + 2] += dz * f; }
      }
    }
  }

  _kneeHinge() {
    const x = this.x;
    _n.set(x[3] - x[0], x[4] - x[1], x[5] - x[2]); // pelvis right
    for (let s = 0; s < 2; s++) {
      const H = s * 3, K = (11 + s) * 3, F = (13 + s) * 3;
      _a.set(x[K] - x[H], x[K + 1] - x[H + 1], x[K + 2] - x[H + 2]);
      _b.set(x[F] - x[K], x[F + 1] - x[K + 1], x[F + 2] - x[K + 2]);
      _c.crossVectors(_a, _b);
      if (_c.dot(_n) > 0) { // hyper-extended: push the knee back across the hip-foot line
        _w.set(x[F] - x[H], x[F + 1] - x[H + 1], x[F + 2] - x[H + 2]);
        const ww = _w.lengthSq() || 1e-6;
        const t = _a.dot(_w) / ww;
        const ox = _a.x - _w.x * t, oy = _a.y - _w.y * t, oz = _a.z - _w.z * t;
        // limit, not flip: straighten the knee toward the hip-foot line by at most 1.2 cm per pass
        const ol = Math.sqrt(ox * ox + oy * oy + oz * oz), k = ol > 0.012 ? 0.012 / ol : 1;
        x[K] -= ox * k * 0.7; x[K + 1] -= oy * k * 0.7; x[K + 2] -= oz * k * 0.7;
        x[F] += ox * k * 0.3; x[F + 1] += oy * k * 0.3; x[F + 2] += oz * k * 0.3;
      }
    }
  }

  _writeBones() {
    const x = this.x, Q = _RQ;
    _px = x;
    // pelvis
    p(0, _a); p(1, _b);
    this._pos.addVectors(_a, _b).multiplyScalar(0.5);
    _n.subVectors(_b, _a); // right
    p(2, _c).sub(this._pos); // up
    frameQuat(Q[B.pelvis], _c, _n, BI_TORSO);
    // chest
    p(3, _c).sub(p(2, _w)); p(6, _a); p(5, _b); _a.sub(_b);
    frameQuat(Q[B.chest], _c, _a, BI_TORSO);
    Q[B.spine].copy(Q[B.pelvis]).slerp(Q[B.chest], 0.45);
    // head / neck
    p(4, _c).sub(p(3, _w));
    frameQuat(Q[B.head], _c, _a, BI_TORSO);
    Q[B.neck].copy(Q[B.chest]).slerp(Q[B.head], 0.5);
    // clavicles
    p(3, _w); _c.set(0, 1, 0).applyQuaternion(Q[B.chest]);
    p(5, _b).sub(_w); frameQuat(Q[B.clavL], _b, _c, BI_CLAV_L);
    p(6, _b).sub(_w); frameQuat(Q[B.clavR], _b, _c, BI_CLAV_R);
    // arms
    for (let s = 0; s < 2; s++) {
      const S0 = 5 + s, E = 7 + s, W = 9 + s, u = s ? B.uarmR : B.uarmL, bi = s ? BI_ARM_R : BI_ARM_L;
      p(E, _a).sub(p(S0, _w)); p(W, _b).sub(p(E, _w));
      _c.crossVectors(_a, _b);
      const nn = this.nArm[s];
      if (_c.lengthSq() > 4e-5) nn.lerp(_c.normalize(), 0.5).normalize();
      frameQuat(Q[u], _a, nn, bi); frameQuat(Q[u + 1], _b, nn, bi);
      Q[u + 2].copy(Q[u + 1]).multiply(qEuler(_q1, 0, 0, s ? -0.35 : 0.35));
    }
    // legs
    p(1, _w); p(0, _n); _n.sub(_w); // -right
    for (let s = 0; s < 2; s++) {
      const H = s, K = 11 + s, F = 13 + s, t = s ? B.thighR : B.thighL;
      p(K, _a).sub(p(H, _w)); p(F, _b).sub(p(K, _w));
      _c.crossVectors(_a, _b);
      const nn = this.nLeg[s];
      if (_c.lengthSq() > 4e-5) nn.copy(_c).normalize(); else nn.copy(_n).normalize();
      frameQuat(Q[t], _a, nn, BI_LEG); frameQuat(Q[t + 1], _b, nn, BI_LEG);
      Q[t + 2].copy(Q[t + 1]).multiply(qEuler(_q1, 0.25, 0, 0));
    }
    // pelvis bone position (hip midpoint sits 5 cm below the pelvis head)
    _P[B.pelvis].set(0, 0.05, 0).applyQuaternion(Q[B.pelvis]).add(this._pos);
    // rifle
    if (this.keepGun) {
      // FK to the right hand
      const P = _P;
      for (const b of RARM_CHAIN) P[b].copy(OFF[b]).applyQuaternion(Q[PARENT[b]]).add(P[PARENT[b]]);
      Q[B.gun].copy(Q[B.handR]).multiply(GUNQ_FROM_HAND);
      _P[B.gun].copy(GUNP_IN_HAND).applyQuaternion(Q[B.handR]).add(P[B.handR]);
    } else {
      p(15, _a); p(16, _b); p(17, _c);
      _w.subVectors(_a, _b); // muzzle -> butt = +z
      _n.subVectors(_a, _c); // roughly up
      frameQuat(Q[B.gun], _w, _n, BI_GUN_UP);
      _P[B.gun].copy(GUN_PTS[0]).negate().applyQuaternion(Q[B.gun]).add(_a);
    }
    Q[B.mag].copy(Q[B.gun]);
    _P[B.mag].copy(MAG_OFF).applyQuaternion(Q[B.gun]).add(_P[B.gun]);
    // write locals
    const bones = this.bones;
    for (let b = 0; b < NB; b++) {
      const bone = bones[b], pa = PARENT[b];
      if (pa < 0) { bone.position.copy(_P[b]); bone.quaternion.copy(Q[b]); }
      else bone.quaternion.copy(Q[pa]).invert().multiply(Q[b]);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._root.removeFromParent();
    releaseGeometry(this.mesh.geometry);
    this.mesh.skeleton.dispose();
    this.gm.disposed = true;
  }
}
const CAPS = new Float64Array(9), FLAIL = [9, 10, 13, 14, 7, 8], RARM_CHAIN = [B.spine, B.chest, B.clavR, B.uarmR, B.farmR, B.handR];
// particles tested against [pelvis capsule, chest capsule]
const COLL = [[4, 7, 8, 9, 10, 13, 14], [7, 8, 9, 10, 11, 12, 13, 14]];
// rifle frame from (butt - muzzle) = +z and (butt - magTip) projected = up
const BI_GUN_UP = bindInv(GUN_PTS[0].clone().sub(GUN_PTS[1]), GUN_PTS[0].clone().sub(GUN_PTS[2]));

// ---------------- helpers for the game ----------------
// Build every headgear template up front (call once at load to avoid a spawn hitch) and return a
// group of posed soldiers suitable for renderer.compile() warm-up.
export function warmupGunmen() {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) { const gm = new Gunman({ pose: k === 2 ? 'roof' : 'window', side: k === 2 ? 0 : -1, seed: k + 1, headgear: k }); g.add(gm.root); }
  return g;
}

// =====================================================================================
//  DRIVER: the player's buddy at the wheel of the pickup. Seated bind pose (arms reaching
//  for the wheel, legs bent) so the skin deforms cleanly; 21 bones (19 = jaw, 20 = right
//  fingers). Root goes at DRIVER_SEAT.position inside the truck root; local forward = -z.
// =====================================================================================
// measured from vehicles.js pickupGeometry(): bench top y 0.96 (cushion z -0.5..0, back rest
// leaning back from z -0.14 @ y 0.95 to z -0.04 @ y 1.44); steering(): torus centre
// (-0.45, 1.27, -0.75), radius 0.185, rotated about x by +0.42 rad.
export const DRIVER_SEAT = { position: [-0.45, 0.92, -0.25], wheel: [-0.45, 1.27, -0.75], wheelTilt: 0.42, wheelRadius: 0.185 };
const D_OFF = new THREE.Vector3(0, -0.87, 0); // mesh offset inside the root (pelvis 0.10 above the seat point)
const DPARENT = PARENT.slice(); DPARENT[19] = B.head; DPARENT[20] = B.handR;
const MIR_D = MIR_S.slice(); MIR_D[20] = B.handL;
// bind: arms straight toward the wheel, legs seated (in soldier/mesh coordinates)
const D_ARM_R = v3(-0.02, -0.36, -0.93).normalize(), D_ARM_L = v3(0.02, -0.36, -0.93).normalize();
const orth = (a, d) => a.clone().addScaledVector(d, -a.dot(d)).normalize();
const E_ARM_R = orth(v3(0.85, -0.45, 0.2), D_ARM_R), E_ARM_L = orth(v3(-0.85, -0.45, 0.2), D_ARM_L);
const REF_ARM_R = new THREE.Vector3().crossVectors(E_ARM_R, D_ARM_R).normalize(), REF_ARM_L = new THREE.Vector3().crossVectors(E_ARM_L, D_ARM_L).normalize();
const BI_DARM_R = bindInv(D_ARM_R, REF_ARM_R), BI_DARM_L = bindInv(D_ARM_L, REF_ARM_L);
const Q_ARM_R = new THREE.Quaternion(), Q_ARM_L = new THREE.Quaternion();
frameQuat(Q_ARM_R, D_ARM_R, REF_ARM_R, BI_ARM_R); Q_ARM_R.copy(Q_ARM_R);
frameQuat(Q_ARM_L, D_ARM_L, REF_ARM_L, BI_ARM_L);
const BI_DHAND_R = bindInv(D_ARM_R, REF_ARM_R.clone().negate()), BI_DHAND_L = bindInv(D_ARM_L, REF_ARM_L); // palm normal = -ref (right) / +ref (left) in the T-pose frames
const D_PALM_R = PALM_R.clone().applyQuaternion(Q_ARM_R), D_PALM_L = PALM_L.clone().applyQuaternion(Q_ARM_L);
const D_KNUCKLE_AX = v3(0, 0, 1).applyQuaternion(Q_ARM_R);
const D_TH = v3(0.06, -0.08, -1).normalize(), D_SH = v3(0.03, -0.583, -0.81).normalize();
const DHEADS = HEADS.map(h => h.clone());
{
  for (const [s, D] of [[1, D_ARM_R], [-1, D_ARM_L]]) {
    const u = s > 0 ? B.uarmR : B.uarmL;
    DHEADS[u + 1].copy(DHEADS[u]).addScaledVector(D, UA);
    DHEADS[u + 2].copy(DHEADS[u + 1]).addScaledVector(D, FA);
  }
  for (const s of [1, -1]) {
    const t = s > 0 ? B.thighR : B.thighL, dth = v3(s * D_TH.x, D_TH.y, D_TH.z), dsh = v3(s * D_SH.x, D_SH.y, D_SH.z);
    DHEADS[t + 1].copy(DHEADS[t]).addScaledVector(dth, TH);
    DHEADS[t + 2].copy(DHEADS[t + 1]).addScaledVector(dsh, SH);
  }
  DHEADS[19].set(0, HEAD_C.y - 0.032, HEAD_C.z + 0.022); // jaw hinge
  DHEADS[20].set(WRX + 0.083, 1.44, 0).sub(DHEADS[B.uarmR]).applyQuaternion(Q_ARM_R).add(DHEADS[B.uarmR]); // right knuckles
}
const DOFF = DHEADS.map((h, i) => (DPARENT[i] < 0 ? h.clone() : h.clone().sub(DHEADS[DPARENT[i]])));
const pivotMat = (q, p) => new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));

function driverParts() {
  const parts = [], add = (p) => { parts.push(p); return p; };
  // ---- leather bomber over a tee: torso with the zip open at the front, seated bunching, rib hem
  const openW = (y) => lerp(0.05, 0.034, sst(1.1, 1.47, y));
  const torso = torsoGeo({ M: 26, bulk: 0.012, ys: lin(0.85, 1.53, 22), post: (q, th, y) => {
    let [x, yy, z] = q;
    const back = Math.max(0, Math.sin(th)), front = Math.max(0, -Math.sin(th));
    // horizontal seated folds over the lower back, diagonal drag folds from the armpits
    let k = 1 + 0.028 * gs((y - 1.06) / 0.05) * Math.sin(y * 150 + th * 1.5) * (0.4 + back)
      + 0.018 * back * Math.sin((y * 60 + Math.abs(x) * 45)) * sst(1.15, 1.25, y) * sst(1.42, 1.32, y)
      + 0.03 * gs((y - 0.975) / 0.02); // rib hem rolls out a little
    x *= k; z = z * k;
    // open front: the tee sits ~1.5 cm behind the jacket fronts
    if (front > 0.3 && y > 0.99 && y < 1.5) { const t = sst(openW(y) + 0.006, openW(y) - 0.006, Math.abs(x)) * sst(0.99, 1.02, y); z += 0.016 * t; }
    return [x, yy, z];
  } });
  add({ g: torso, wf: torsoWF, slot: S.JACKET, paint: (P, N, out) => {
    if (P.y < 0.955) { out.s1 = S.JEANS; return; }
    if (P.y < 0.998) { out.s1 = S.KNEE; out.k *= 0.85 + 0.15 * Math.abs(Math.sin(Math.atan2(P.x, P.z) * 40)); return; }
    if (P.z < 0 && P.y < 1.5) { const t = sst(openW(P.y) + 0.004, openW(P.y) - 0.004, Math.abs(P.x)); if (t > 0) { out.s2 = S.TEE; out.m = t; } }
  } });
  // shearling collar + crew neck
  add({ g: ringStack([[1.455, 0.07, 0.078, 0.064, 0.012], [1.458, 0.096, 0.104, 0.084, 0.014], [1.5, 0.094, 0.104, 0.074, 0.016], [1.54, 0.08, 0.09, 0.064, 0.018], [1.546, 0.066, 0.074, 0.056, 0.014]], 20,
    (p, th, i) => { const b = Math.max(0, Math.sin(th)); p[1] += (i > 1 ? 0.04 : 0.012) * b * b - (i > 1 ? 0.012 : 0) * Math.max(0, -Math.sin(th)); return p; }),
    wf: (P, W) => chainW(P.y, [[1.49, B.chest], [1.545, B.neck]], W), slot: S.RIB, paint: (P, N, out) => { out.k *= 0.9 + 0.2 * hash3(P.x * 400, P.y * 400, P.z * 400); } });
  add({ g: ringStack([[1.47, 0.058, 0.058, 0.056, 0.0], [1.472, 0.066, 0.066, 0.064, 0.0], [1.5, 0.062, 0.062, 0.06, -0.002]], 16), wf: (P, W) => chainW(P.y, [[1.49, B.chest], [1.52, B.neck]], W), slot: S.TEE });
  // ---- neck + head (stubble, short hair) + aviators
  const jawWF = (P, W) => {
    const y = P.y - HEAD_C.y, z = P.z - HEAD_C.z;
    const nk = sst(1.582, 1.547, P.y) * sst(-0.03, 0.02, z);
    const jw = sst(-0.046, -0.062, y) * sst(0.03, -0.012, z) * (1 - nk);
    W[0] = B.head; W[1] = 1 - jw - nk; W[2] = 19; W[3] = jw; W[4] = B.neck; W[5] = nk; return 3;
  };
  addNeckHead(add, 'skin', { beard: 0.8, hair: true, hairVol: 0.007, brows: true, ears: true, wf: jawWF });
  aviators(add);
  // ---- arms: leather sleeves with folds, rib cuffs, bare wrists, watch on the left
  const ak = [[0.15, 0.048, 0.056, 0.056, -0.012, 0, 2], [0.19, 0.056, 0.066, 0.066, -0.008, 0, 2.1], [0.25, 0.058, 0.064, 0.065, -0.004, 0, 2.1]]
    .concat(ARM_KEYS.filter(k => k[0] > 0.3 && k[0] < 0.64).map(([s, a, b, c, cu, cv, n]) => [s, a * 1.1, b * 1.1, c * 1.1, cu, cv, n]));
  ak.push([0.655, 0.043, 0.046, 0.046, 0, 0, 2.2], [0.672, 0.036, 0.039, 0.039, 0, 0, 2.2], [0.705, 0.034, 0.037, 0.037, 0, 0, 2.3]);
  const SHR = DHEADS[B.uarmR].clone(), SHL = DHEADS[B.uarmL].clone(), MR = pivotMat(Q_ARM_R, SHR), ML = pivotMat(Q_ARM_L, SHL);
  const ARMSET = [B.uarmR, B.farmR, B.handR, 20];
  const PSR = { q: Q_ARM_R, pivot: SHR, set: ARMSET }, PSL = { q: Q_ARM_L, pivot: SHL, set: ARMSET };
  const sym = (p) => { add({ ...p, preskin: PSR }); add({ ...p, mirror: true, preskin: PSL }); };
  sym({ g: armGeo(ak, [0.15, 0.175, 0.2, 0.245, 0.29, 0.335, 0.38, 0.425, 0.465, 0.495, 0.525, 0.56, 0.6, 0.635, 0.655, 0.672, 0.69, 0.705], 13, sleeveFolds(1.6)), wf: armWF, slot: S.JACKET,
    paint: (P, N, out) => { if (P.x > 0.648) { out.s1 = S.KNEE; out.k *= 0.85 + 0.15 * Math.abs(Math.sin(Math.atan2(P.y - 1.44, P.z) * 30)); } } });
  sym({ g: armGeo([[0.68, 0.025, 0.031, 0.031, 0, 0, 2.3], [0.76, 0.022, 0.03, 0.03, 0, 0, 2.4]], [0.68, 0.72, 0.76], 10), wf: (P, W) => chainW(P.x, [[0.72, B.farmR], [0.75, B.handR]], W), slot: S.SKIN });
  add({ g: cylAB(v3(0.711, 1.44, 0), v3(0.729, 1.44, 0), 0.031, 0.031, 12), bone: B.farmR, slot: S.WATCH, mirror: true, postMat: ML });
  add({ g: cylAB(v3(0.72, 1.463, 0), v3(0.72, 1.473, 0), 0.0165, 0.0165, 12), bone: B.farmR, slot: S.WATCH, mirror: true, postMat: ML });
  add({ g: cylAB(v3(0.72, 1.4725, 0), v3(0.72, 1.4745, 0), 0.0135, 0.0135, 12), bone: B.farmR, slot: S.ALENS, mirror: true, postMat: ML, ao: false });
  for (const m of [false, true]) {
    const hp = []; handParts((p) => hp.push(p), { W: [WRX, 1.44, 0], slot: S.SKIN, fbone: m ? B.handR : 20 });
    for (const p of hp) add({ ...p, mirror: m, postMat: m ? ML : MR, paint: (P, N, out) => { if (p.paint) p.paint(P, N, out); out.s2 = S.LIP; out.m = 0.18 * sst(-0.2, 0.6, N.y); } });
  }
  // ---- legs: jeans, seated
  for (const s of [1, -1]) {
    const t = s > 0 ? B.thighR : B.thighL, hip = DHEADS[t], knee = DHEADS[t + 1], ank = DHEADS[t + 2];
    const dth = knee.clone().sub(hip).normalize(), dsh = ank.clone().sub(knee).normalize();
    const U1 = orth(v3(s, 0, 0), dth), V1 = new THREE.Vector3().crossVectors(U1, dth).multiplyScalar(s);
    add({ g: tubeLoft({ A: hip.toArray(), D: dth.toArray(), U: U1.toArray(), V: V1.toArray(), keys: [[-0.06, 0.09, 0.095, 0.09, 0, 0, 2.2], [0.05, 0.092, 0.1, 0.088, 0, 0, 2.2], [0.2, 0.082, 0.08, 0.08, 0, 0, 2.2], [0.36, 0.064, 0.064, 0.064, 0, 0, 2.2], [0.44, 0.058, 0.058, 0.06, 0, 0, 2.2]], ss: lin(-0.06, 0.44, 7), M: 13 }),
      wf: (P, W) => { const d = P.clone().sub(hip).dot(dth); return chainW(d, [[-0.02, B.pelvis], [0.08, t], [0.4, t], [0.44, t + 1]], W); }, slot: S.JEANS });
    const U2 = orth(v3(s, 0, 0), dsh), V2 = new THREE.Vector3().crossVectors(U2, dsh).multiplyScalar(s);
    add({ g: tubeLoft({ A: knee.toArray(), D: dsh.toArray(), U: U2.toArray(), V: V2.toArray(), keys: [[-0.05, 0.06, 0.06, 0.062, 0, 0, 2.2], [0.1, 0.056, 0.06, 0.055, 0, 0, 2.2], [0.3, 0.05, 0.052, 0.05, 0, 0, 2.2], [0.36, 0.054, 0.056, 0.054, 0, 0, 2.2]], ss: lin(-0.05, 0.36, 6), M: 13 }), bone: t + 1, slot: S.JEANS });
    const bp = []; bootParts((p) => bp.push(p), { shaft: false, toeLen: 0.03, slot: S.BOOT, laceSlot: S.SOLE });
    const qf = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0));
    const ank0 = v3(HIPX, 0.085, 0), fm = new THREE.Matrix4().makeTranslation(ank.x, ank.y, ank.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(qf)).multiply(new THREE.Matrix4().makeTranslation(-ank0.x, -ank0.y, -ank0.z));
    const fmL = new THREE.Matrix4().makeTranslation(ank.x, ank.y, ank.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(qf)).multiply(new THREE.Matrix4().makeTranslation(ank0.x, -ank0.y, -ank0.z));
    for (const p of bp) add({ ...p, wf: null, bone: B.footR, mirror: s < 0, postMat: s > 0 ? fm : fmL });
  }
  return parts;
}
function aviators(add) {
  const H = (g) => { g.scale(HS, HS, HS); g.translate(HEAD_C.x, HEAD_C.y, HEAD_C.z); return g; };
  const outline = (sx, sc, z, M = 18) => {
    const pts = [];
    for (let j = 0; j < M; j++) {
      const th = (j / M) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      let x = 0.029 * c, y = 0.022 * s;
      if (s > 0) { y *= 0.7; x *= 1 + 0.08 * s * Math.max(0, c); } // flat brow line, squared outer corner
      const inner = Math.max(0, -c), lower = Math.max(0, -s);
      y -= 0.0095 * lower * (0.25 + 0.75 * inner); x -= 0.003 * lower * inner; // teardrop droop toward the nose
      x *= sc; y *= sc;
      const X = sx * (0.035 + x), Y = 0.003 + y;
      pts.push([X, Y, z + 1.6 * X * X + 0.4 * Y * Y]);
    }
    return pts;
  };
  for (const sx of [-1, 1]) {
    // gold rim (slightly larger, behind) + mirrored gradient lens
    add({ g: H(loftGeo([outline(sx, 1.075, -0.1012), outline(sx, 1.075, -0.0985)], true, true)), bone: B.head, slot: S.GOLD });
    add({ g: H(loftGeo([outline(sx, 1.0, -0.1045), outline(sx, 1.0, -0.1015)], true, true)), bone: B.head, slot: S.ALENS, ao: false,
      paint: (P, N, out) => { out.s2 = S.LENS; out.m = sst(0.012, -0.02, P.y - HEAD_C.y) * 0.75; } });
    // temples back to the ears
    add({ g: H(pathTube([[sx * 0.064, 0.017, -0.098], [sx * 0.078, 0.014, -0.06], [sx * 0.08, 0.008, -0.01], [sx * 0.078, -0.004, 0.012]], [0, 1, 0], () => [0.0022, 0.0022, 2], 4)), bone: B.head, slot: S.GOLD });
  }
  // double bridge
  add({ g: H(pathTube(lin(-0.062, 0.062, 7).map(x => [x, 0.0225, -0.1035 + 1.6 * x * x]), [0, 1, 0], () => [0.0018, 0.0018, 2], 5)), bone: B.head, slot: S.GOLD });
  add({ g: H(pathTube([[-0.009, 0.012, -0.104], [0, 0.015, -0.106], [0.009, 0.012, -0.104]], [0, 1, 0], () => [0.002, 0.002, 2], 5)), bone: B.head, slot: S.GOLD });
}
let D_TEMPLATE = null;
function getDriverTemplate() {
  return D_TEMPLATE || (D_TEMPLATE = buildTemplate(driverParts(), { heads: DHEADS, parent: DPARENT, mir: MIR_D }, { c: [0, 1.2, -0.25], r: 1.0, min: [-0.6, 0.3, -1.0], max: [0.6, 1.9, 0.4] }));
}
function driverPalette(seed) {
  const r = makeRng((seed * 2246822519) >>> 0 ^ 0x27d4eb2d);
  const pal = new Float32Array(NS * 3);
  const set = (slot, c, k = 1) => { pal[slot * 3] = c.r * k; pal[slot * 3 + 1] = c.g * k; pal[slot * 3 + 2] = c.b * k; };
  const skin = new THREE.Color('#c48a62').multiplyScalar(0.94 + 0.12 * r()), hair = new THREE.Color('#4a3524');
  set(S.SKIN, skin); set(S.SKIN2, skin, 0.5); set(S.LIP, _col.copy(skin).multiply(new THREE.Color(0.86, 0.6, 0.56)));
  set(S.BEARD, _col.copy(skin).lerp(new THREE.Color('#3a3a40'), 0.6)); set(S.HAIR, hair); set(S.BROW, hair, 0.85);
  set(S.JACKET, new THREE.Color('#5a3c2b')); set(S.RIB, new THREE.Color('#c2b090')); set(S.TEE, new THREE.Color('#74726d')); set(S.KNEE, new THREE.Color('#34302d'));
  set(S.JEANS, new THREE.Color('#3b4762')); set(S.BOOT, new THREE.Color('#7a5638')); set(S.SOLE, new THREE.Color('#3a3430'));
  set(S.WATCH, new THREE.Color('#b8b8b4')); set(S.GOLD, new THREE.Color('#d8b060')); set(S.ALENS, new THREE.Color('#3a2a18')); set(S.LENS, new THREE.Color('#a8763c'));
  set(S.EYE, _col.setRGB(0.55, 0.5, 0.46)); set(S.IRIS, _col.setRGB(0.04, 0.03, 0.025)); set(S.STRAP, _col.setRGB(0.05, 0.05, 0.05));
  return pal;
}

const _dq = Array.from({ length: NB }, () => new THREE.Quaternion());
const _dp = Array.from({ length: NB }, () => new THREE.Vector3());
const _gw = new THREE.Vector3(), _gq = new THREE.Quaternion(), _hq = new THREE.Quaternion(), _tg = new THREE.Vector3(), _hn = new THREE.Vector3();
const D_LOOK = { // look targets in mesh space
  mirror: v3(0.45, 1.74, -0.47), side: v3(-0.56, 1.22, -0.76), back: v3(0.45, 2.05, 1.7),
};
function damp1(a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); }

export class Driver {
  constructor(opts = {}) {
    this.seed = (opts.seed ?? 7) >>> 0;
    this.rng = makeRng((this.seed * 0x9e3779b1) >>> 0 ^ 0xabc123);
    const tpl = getDriverTemplate();
    this.mesh = cloneSkinned(tpl.mesh);
    this.mesh.geometry = acquireGeometry(tpl);
    recolor(this.mesh.geometry, driverPalette(this.seed));
    this.mesh.castShadow = true; this.mesh.receiveShadow = false; this.mesh.frustumCulled = false;
    this.mesh.position.copy(D_OFF);
    this.bones = this.mesh.skeleton.bones;
    this.root = new THREE.Group(); this.root.name = 'driver'; this.root.add(this.mesh);
    this.headCenter = new THREE.Object3D(); this.headCenter.position.copy(HEAD_C).sub(DHEADS[B.head]); this.bones[B.head].add(this.headCenter);
    const seat = opts.seat || DRIVER_SEAT, ta = seat.wheelTilt ?? 0.42;
    this.wc = v3(...seat.wheel).sub(v3(...seat.position)).sub(D_OFF);
    this.wr = seat.wheelRadius ?? 0.185;
    this.wX = v3(1, 0, 0); this.wY = v3(0, Math.cos(ta), Math.sin(ta)); this.wN = v3(0, -Math.sin(ta), Math.cos(ta));
    this.wheelAngle = 0; this.t = 0;
    this.steer = 0; this.steerPrev = 0; this.lat = 0;
    this.bumpS = { x: 0, v: 0 }; this.duckS = { x: 0, v: 0 }; this.lastBump = 0; this.lastFlinch = 0; this.duckHold = 0;
    this.yaw = 0; this.pitch = 0; this.yawV = 0; this.pitchV = 0; this.twist = 0;
    this.look = 'road'; this.lookT = 0; this.lookDur = 0; this.nextLook = 2 + this.rng() * 3;
    this.talkW = 0; this.wasTalking = false; this.jaw = 0;
    this.gest = null; this.gestW = 0; this.finger = 0;
    this.nL = new THREE.Vector3(); this.nR = new THREE.Vector3();
    this.disposed = false;
    this.update(0, { steer: 0, bump: 0, talking: false, lookBack: 0, flinch: 0, time: 0 });
  }

  update(dt, st = {}) {
    if (this.disposed) return;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const r = this.rng, t = this.t;
    // ---- inputs
    const steer = clamp(st.steer || 0, -1, 1);
    const sPrev = this.steer;
    this.steer = dt > 0 ? damp1(this.steer, steer, 5, dt) : steer;
    if (dt > 0) this.lat = damp1(this.lat, clamp((this.steer - sPrev) / dt, -3, 3), 6, dt);
    this.wheelAngle = this.steer * 1.05 + 0.035 * Math.sin(t * 0.73) + 0.02 * Math.sin(t * 1.91 + 1.3);
    const bump = st.bump || 0, flinch = st.flinch || 0;
    if (bump > this.lastBump + 0.25) this.bumpS.v += 3.2 * bump;
    if (flinch > this.lastFlinch + 0.2) { this.duckS.v += 7 * flinch; this.duckHold = Math.max(this.duckHold, 0.5 + 0.6 * flinch); if (this.look === 'back' && r() < 0.5) this.lookT = this.lookDur; }
    this.lastBump = bump; this.lastFlinch = flinch;
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n; i++) {
      spring(this.bumpS, 160, 11, h);
      this.duckS.v += (Math.min(1, flinch * 0.8 + (this.duckHold > 0 ? 0.6 : 0)) - this.duckS.x) * 60 * h; spring(this.duckS, 90, 13, h);
    }
    this.duckHold = Math.max(0, this.duckHold - dt);
    // ---- talking: jaw, gestures, turn to the player
    const talking = !!st.talking;
    this.talkW = dt > 0 ? damp1(this.talkW, talking ? 1 : 0, 6, dt) : (talking ? 1 : 0);
    if (talking && !this.wasTalking) {
      if (!this.gest && r() < 0.75) this.gest = { type: r() < 0.45 ? 'thumb' : r() < 0.6 ? 'beat' : 'fist', t: -0.15 - r() * 0.3, dur: 1.3 + r() * 0.9 };
      if (r() < 0.55 && this.look !== 'back') this._setLook('back', 0.9 + r() * 0.8);
    }
    this.wasTalking = talking;
    const syl = Math.max(0, Math.sin(t * 13.7) * 0.6 + Math.sin(t * 8.3 + 1.1) * 0.5 + 0.15) * (0.55 + 0.45 * Math.sin(t * 2.3));
    this.jaw = dt > 0 ? damp1(this.jaw, talking ? syl * 0.2 : 0, 18, dt) : 0;
    if (this.gest) { this.gest.t += dt; if (this.gest.t > this.gest.dur) this.gest = null; }
    const g = this.gest, gw = g && g.t > 0 ? sst(0, 0.28, g.t) * (1 - sst(g.dur - 0.32, g.dur, g.t)) : 0;
    this.gestW = gw;
    // ---- where to look
    const lb = st.lookBack || 0;
    this.lookT += dt;
    if (lb > 0.45 && this.duckHold <= 0) { if (this.look !== 'back') this._setLook('back', 0.8); else this.lookDur = Math.max(this.lookDur, this.lookT + 0.3); }
    if (this.look !== 'road' && this.lookT > this.lookDur) { this.look = 'road'; this.lookT = 0; this.nextLook = 2.5 + r() * 4.5; }
    if (this.look === 'road' && this.lookT > this.nextLook) {
      const p = r();
      if (p < 0.42) this._setLook('mirror', 0.55 + r() * 0.45); else if (p < 0.68) this._setLook('side', 0.5 + r() * 0.4); else this._setLook('back', 0.7 + r() * 0.7);
    }
    this._pose(dt, st);
  }
  _setLook(mode, dur) { this.look = mode; this.lookT = 0; this.lookDur = dur; }

  _pose(dt, st) {
    const P = _dp, Q = _dq, t = this.t, duck = Math.max(0, this.duckS.x), bmp = this.bumpS.x;
    // ---- pelvis on the bench (vibration, bumps, lateral g)
    P[B.pelvis].copy(DHEADS[B.pelvis]);
    P[B.pelvis].y += 0.0025 * Math.sin(t * 23.1) + 0.0015 * Math.sin(t * 37.7) - 0.03 * bmp;
    const roll = clamp(0.045 * this.steer + 0.05 * this.lat, -0.12, 0.12);
    qEuler(Q[B.pelvis], 0.1 + 0.03 * bmp, 0, roll * 0.4);
    // ---- look: target angles relative to the chest
    const back = this.look === 'back';
    let tgt;
    if (this.look === 'road') tgt = _tg.set(this.steer * 4 + Math.sin(t * 0.37) * 1.6 + Math.sin(t * 1.13) * 0.4, 1.5 + Math.sin(t * 0.51) * 0.25, -30);
    else tgt = _tg.copy(D_LOOK[this.look]);
    const twistG = back ? -0.38 : 0;
    this.twist = dt > 0 ? damp1(this.twist, twistG, back ? 5 : 3.5, dt) : twistG;
    // spine / chest
    const hunch = -0.07 - 0.32 * duck + 0.06 * bmp + 0.012 * Math.sin(t * 1.6);
    qEuler(_q1, -0.03 - 0.14 * duck, this.twist * 0.45, roll * 0.5 + (back ? -0.04 : 0));
    Q[B.spine].copy(Q[B.pelvis]).multiply(_q1);
    qEuler(_q1, hunch, this.twist * 0.55, roll * 0.6 + (back ? -0.05 : 0));
    Q[B.chest].copy(Q[B.spine]).multiply(_q1);
    P[B.spine].copy(DOFF[B.spine]).applyQuaternion(Q[B.pelvis]).add(P[B.pelvis]);
    P[B.chest].copy(DOFF[B.chest]).applyQuaternion(Q[B.spine]).add(P[B.spine]);
    P[B.neck].copy(DOFF[B.neck]).applyQuaternion(Q[B.chest]).add(P[B.chest]);
    // head yaw/pitch toward the target (chest frame), clamped, second-order smoothing for natural turns
    _v1.copy(P[B.neck]).add(_v2.set(0, 0.13, 0).applyQuaternion(Q[B.chest]));
    _v2.subVectors(tgt, _v1).applyQuaternion(_qi.copy(Q[B.chest]).invert());
    let yawG = clamp(Math.atan2(-_v2.x, -_v2.z), -1.5, 1.2), pitG = clamp(Math.atan2(_v2.y, Math.hypot(_v2.x, _v2.z)), -0.55, 0.45);
    if (back) pitG = clamp(pitG, -0.1, 0.35);
    pitG += -0.35 * duck + 0.04 * Math.sin(t * 5.1) * this.talkW + 0.025 * Math.sin(t * 2.7 + 0.7) * this.talkW - 0.05 * bmp;
    if (dt > 0) {
      const k = back || this.look !== 'road' ? 90 : 40, c = 2 * Math.sqrt(k) * 1.05;
      const m = Math.max(1, Math.ceil(dt / (1 / 120))), hh = dt / m;
      for (let i = 0; i < m; i++) {
        this.yawV += ((yawG - this.yaw) * k - this.yawV * c) * hh; this.yaw += this.yawV * hh;
        this.pitchV += ((pitG - this.pitch) * k - this.pitchV * c) * hh; this.pitch += this.pitchV * hh;
      }
    } else { this.yaw = yawG; this.pitch = pitG; }
    const tilt = -0.25 * roll + (back ? 0.12 : 0) + 0.04 * Math.sin(t * 3.3) * this.talkW;
    qEuler(_q1, this.pitch, this.yaw, tilt);
    Q[B.head].copy(Q[B.chest]).multiply(_q1);
    Q[B.neck].copy(Q[B.chest]).slerp(Q[B.head], 0.45);
    P[B.head].copy(DOFF[B.head]).applyQuaternion(Q[B.neck]).add(P[B.neck]);
    // jaw
    Q[19].copy(Q[B.head]).multiply(_q1.setFromAxisAngle(X_AX, -this.jaw));
    // ---- clavicles (shrug when ducking)
    for (const c of CLAVS) {
      const s = c === B.clavR ? 1 : -1;
      qEuler(_q1, 0, s * 0.1, s * (0.2 * duck + 0.03));
      Q[c].copy(Q[B.chest]).multiply(_q1);
      P[c].copy(DOFF[c]).applyQuaternion(Q[B.chest]).add(P[B.chest]);
      P[c + 1].copy(DOFF[c + 1]).applyQuaternion(Q[c]).add(P[c]);
    }
    // ---- hands on the wheel (rim points rotate with the wheel angle; clockwise = steering right)
    const wa = this.wheelAngle;
    for (const s of [1, -1]) {
      const phi = (s > 0 ? 0.32 : Math.PI - 0.32) - wa;
      const R = _v3.copy(this.wX).multiplyScalar(Math.cos(phi)).addScaledVector(this.wY, Math.sin(phi));
      const Tg = _v4.copy(this.wX).multiplyScalar(-Math.sin(phi)).addScaledVector(this.wY, Math.cos(phi));
      const palmN = _v5.copy(R).multiplyScalar(-0.75).addScaledVector(this.wN, -0.66).normalize();
      const F = _v6.crossVectors(palmN, Tg).normalize();
      const hq = s > 0 ? _hq : _gq;
      frameQuat(hq, F, palmN, s > 0 ? BI_DHAND_R : BI_DHAND_L);
      // palm centre sits outside / driver-side of the rim tube
      const pc = _gw.copy(this.wc).addScaledVector(R, this.wr + 0.024).addScaledVector(this.wN, 0.018);
      if (s > 0) { this._wR = (this._wR || new THREE.Vector3()).copy(pc).sub(_v1.copy(D_PALM_R).applyQuaternion(hq)); this._qR = (this._qR || new THREE.Quaternion()).copy(hq); }
      else { this._wL = (this._wL || new THREE.Vector3()).copy(pc).sub(_v1.copy(D_PALM_L).applyQuaternion(hq)); this._qL = (this._qL || new THREE.Quaternion()).copy(hq); }
    }
    // ---- gesture (right hand leaves the wheel)
    let wristR = this._wR, fingerOpen = 0;
    Q[B.handR].copy(this._qR); Q[B.handL].copy(this._qL);
    if (this.gestW > 0.001) {
      const g = this.gest, tt = Math.max(0, g.t), w = this.gestW;
      let off, F, Pn;
      if (g.type === 'thumb') { // jerk a thumb back over the shoulder at the player
        const j = Math.max(0, Math.sin(tt * 11)) * sst(0.25, 0.4, tt) * (1 - sst(0.9, 1.1, tt));
        off = _v1.set(0.25, 0.36 + 0.015 * j, -0.12 + 0.06 * j); F = _v2.set(0.05, 1, -0.3); Pn = _v3.set(-1, 0.05, -0.1);
      } else if (g.type === 'beat') { // open-hand beats while explaining
        const j = Math.max(0, Math.sin(tt * 8.5));
        off = _v1.set(0.2, 0.26 + 0.04 * j, -0.32); F = _v2.set(-0.3, 0.5, -0.8); Pn = _v3.set(-0.5, 0.75, 0.35); fingerOpen = 1;
      } else { // fist shake toward the road ahead
        const j = Math.sin(tt * 14) * sst(0.25, 0.4, tt);
        off = _v1.set(0.17, 0.33 + 0.03 * j, -0.36); F = _v2.set(-0.1, 0.85, -0.5); Pn = _v3.set(-1, 0.0, 0.1);
      }
      _v4.copy(off).applyQuaternion(Q[B.chest]).add(P[B.chest]);
      F.applyQuaternion(Q[B.chest]).normalize(); Pn.applyQuaternion(Q[B.chest]).normalize();
      frameQuat(_q2, F, Pn, BI_DHAND_R);
      _v4.sub(_v5.copy(D_PALM_R).applyQuaternion(_q2));
      // arc up off the rim
      wristR = _gw.copy(this._wR).lerp(_v4, w).addScaledVector(Y_AX, 0.07 * Math.sin(Math.PI * w));
      Q[B.handR].slerp(_q2, w);
      fingerOpen *= w;
    }
    this.finger = dt > 0 ? damp1(this.finger, fingerOpen, 10, dt) : fingerOpen;
    driverArm(B.clavR, wristR, _v2.set(0.75, -0.6, 0.25).normalize().applyQuaternion(Q[B.chest]), BI_DARM_R, this.nR);
    driverArm(B.clavL, this._wL, _v2.set(-0.75, -0.6, 0.25).normalize().applyQuaternion(Q[B.chest]), BI_DARM_L, this.nL);
    Q[20].copy(Q[B.handR]).multiply(_q1.setFromAxisAngle(D_KNUCKLE_AX, 1.05 * this.finger));
    // ---- legs stay planted in the cab frame
    for (const b of [B.thighL, B.shinL, B.footL, B.thighR, B.shinR, B.footR]) Q[b].identity();
    // write locals
    const bones = this.bones;
    for (let b = 0; b < NB; b++) {
      const bone = bones[b], p = DPARENT[b];
      if (p < 0) { if (b === B.pelvis) { bone.position.copy(P[b]); bone.quaternion.copy(Q[b]); } }
      else bone.quaternion.copy(Q[p]).invert().multiply(Q[b]);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    releaseGeometry(this.mesh.geometry);
    this.mesh.skeleton.dispose();
  }
}
function driverArm(c, wrist, pole, binv, nStore) {
  const P = _dp, Q = _dq, u = c + 1, f = c + 2, h = c + 3;
  ik2(P[u], wrist, UA, FA, pole, P[f], _fy, _v6);
  nStore.copy(_fy);
  _v3.subVectors(P[f], P[u]); frameQuat(Q[u], _v3, nStore, binv);
  _v3.subVectors(_v6, P[f]); frameQuat(Q[f], _v3, nStore, binv);
  P[h].copy(_v6);
}

// Legacy shim so the current game.js keeps running until it is switched to `new Gunman()`.
export function buildGunman(opts = {}) {
  const gm = new Gunman({ pose: 'roof', seed: opts.seed ?? 1, hipOffset: new THREE.Vector3(0, 0, 0), ...opts });
  return { root: gm.root, mesh: gm.mesh, muzzle: gm.muzzle, head: gm.headCenter, gunman: gm };
}

