import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeRng } from './rng.js';

// =====================================================================================
//  BAYHEM soldiers: one SkinnedMesh (1 draw call) per goon, 21 bones, procedural aim/IK,
//  and a verlet/PBD ragdoll that tumbles down the treadmill road.
//  Model space: forward = -z, up = +y, the soldier's right = +x.
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
const HEAD_C = new THREE.Vector3(0, 1.69, -0.012); // head centre (bind)
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
const S = { FAT: 0, FAT2: 1, VEST: 2, VEST2: 3, GLOVE: 4, BOOT: 5, SOLE: 6, SKIN: 7, SKIN2: 8, MASK: 9, HAT: 10, LENS: 11, STRAP: 12, POLY: 13, GMET: 14, FURN: 15, MAGC: 16, HW: 17, BELT: 18, HAIR: 19, KNEE: 20, BEARD: 21 };
const NS = 22;
// [roughness, metalness]
const SURF = [[0.92, 0], [0.92, 0], [0.84, 0], [0.86, 0], [0.62, 0], [0.5, 0], [0.9, 0], [0.55, 0], [0.62, 0], [0.95, 0], [0.55, 0], [0.07, 0.9], [0.7, 0], [0.52, 0.08], [0.38, 0.75], [0.6, 0.02], [0.45, 0.3], [0.32, 0.85], [0.78, 0], [0.85, 0], [0.45, 0], [0.8, 0]];

// ---------------- geometry helpers (build-time only) ----------------
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _be = new THREE.Euler(), _bt = new THREE.Vector3(), _bs = new THREE.Vector3();
const YAX = new THREE.Vector3(0, 1, 0);
function place(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _bm.compose(_bt.set(x, y, z), _bq.setFromEuler(_be.set(rx, ry, rz)), _bs.set(sx, sy, sz));
  return g.applyMatrix4(_bm);
}
// indexed rounded box (56 verts, one bevel step with smooth normals); tiny radii fall back to a plain box
function rbox(w, h, d, r) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  if (r < 0.0055) return new THREE.BoxGeometry(w, h, d);
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
  g.deleteAttribute('uv');
  const pos = g.attributes.position, nor = g.attributes.normal, hw = [w / 2, h / 2, d / 2], u = [0, 0, 0], n = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    u[0] = pos.getX(i); u[1] = pos.getY(i); u[2] = pos.getZ(i);
    let l = 0;
    for (let a = 0; a < 3; a++) { n[a] = Math.abs(u[a]) > 0.4 ? Math.sign(u[a]) : 0; l += n[a] * n[a]; }
    l = Math.sqrt(l) || 1;
    for (let a = 0; a < 3; a++) n[a] /= l;
    pos.setXYZ(i, Math.sign(u[0]) * (hw[0] - r) + n[0] * r, Math.sign(u[1]) * (hw[1] - r) + n[1] * r, Math.sign(u[2]) * (hw[2] - r) + n[2] * r);
    nor.setXYZ(i, n[0], n[1], n[2]);
  }
  return mergeVertices(g, 1e-5);
}
function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function segGeo(g, a, b, sx = 1, sz = 1) {
  const d = _bt.subVectors(b, a); const L = d.length(); d.divideScalar(L);
  const q = new THREE.Quaternion().setFromUnitVectors(YAX, d);
  const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(sx, 1, sz));
  return g.applyMatrix4(m);
}
function capsuleAB(a, b, r, rad = 10, cap = 3, sx = 1, sz = 1) { return segGeo(new THREE.CapsuleGeometry(r, a.distanceTo(b), cap, rad), a, b, sx, sz); }
function taperAB(a, b, ra, rb, rad = 10, cap = 3, sx = 1, sz = 1) {
  const L = a.distanceTo(b), pts = [];
  for (let i = 0; i <= cap; i++) { const t = -Math.PI / 2 + (i / cap) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(t) * ra), -L / 2 + Math.sin(t) * ra)); }
  for (let i = 0; i <= cap; i++) { const t = (i / cap) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(t) * rb), L / 2 + Math.sin(t) * rb)); }
  return segGeo(new THREE.LatheGeometry(pts, rad), a, b, sx, sz);
}
function cylAB(a, b, r1, r2, seg = 10, open = false) { return segGeo(new THREE.CylinderGeometry(r2, r1, a.distanceTo(b), seg, 1, open), a, b); }
function ellip(r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8) { return place(new THREE.SphereGeometry(r, ws, hs), x, y, z, 0, 0, 0, sx, sy, sz); }
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const soft = (b, j, ax, r) => ({ b, j: v3(...j), ax: v3(...ax).normalize(), r });

// ---------------- body template ----------------
// kind: 0 = helmet + goggles + balaclava, 1 = cap + sunglasses (bare face), 2 = balaclava + headset
function buildParts(kind) {
  const parts = [];
  const add = (g, bone, slot, sft) => parts.push({ g, bone, slot, soft: sft || null });
  const faceSlot = kind === 1 ? S.SKIN : S.MASK;

  // ---- pelvis / hips
  add(place(rbox(0.33, 0.2, 0.225, 0.075), 0, 0.935, 0.005), B.pelvis, S.FAT);
  add(place(rbox(0.346, 0.05, 0.242, 0.02), 0, 1.0, 0.005), B.pelvis, S.BELT);
  add(place(rbox(0.056, 0.04, 0.014, 0.005), 0, 1.0, -0.119), B.pelvis, S.HW);
  add(place(rbox(0.15, 0.1, 0.06, 0.02), -0.04, 0.955, 0.142), B.pelvis, S.VEST2); // dump pouch
  add(place(rbox(0.05, 0.1, 0.085, 0.015), -0.188, 0.955, -0.01), B.pelvis, S.VEST2); // hip pouch
  // ---- abdomen
  add(place(rbox(0.3, 0.2, 0.2, 0.075), 0, 1.125, 0), B.spine, S.FAT, [soft(B.pelvis, [0, 1.05, 0], [0, 1, 0], 0.05), soft(B.chest, [0, 1.2, 0], [0, -1, 0], 0.05)]);
  // ---- chest + plate carrier
  const cs = [soft(B.spine, [0, 1.23, 0], [0, 1, 0], 0.05)];
  add(place(rbox(0.37, 0.31, 0.215, 0.09), 0, 1.335, 0), B.chest, S.FAT, cs);
  add(capsuleAB(v3(-0.155, 1.452, 0.005), v3(0.155, 1.452, 0.005), 0.066, 10, 2), B.chest, S.FAT);
  add(place(rbox(0.32, 0.33, 0.06, 0.025), 0, 1.325, -0.118), B.chest, S.VEST);
  add(place(rbox(0.33, 0.35, 0.056, 0.022), 0, 1.335, 0.12), B.chest, S.VEST);
  add(place(rbox(0.4, 0.13, 0.25, 0.045), 0, 1.212, 0), B.chest, S.VEST, cs);
  for (const sx of [-1, 1]) add(place(rbox(0.075, 0.035, 0.282, 0.014), sx * 0.1, 1.48, 0), B.chest, S.VEST);
  for (let i = -1; i <= 1; i++) {
    add(place(rbox(0.072, 0.115, 0.05, 0.012), i * 0.08, 1.222, -0.17), B.chest, S.VEST2);
    add(place(rbox(0.05, 0.05, 0.026, 0.006), i * 0.08, 1.29, -0.168), B.chest, S.MAGC);
    add(place(box(0.054, 0.009, 0.03), i * 0.08, 1.3, -0.168), B.chest, S.STRAP);
  }
  add(place(rbox(0.17, 0.08, 0.03, 0.01), 0, 1.4, -0.158), B.chest, S.VEST2); // admin pouch
  add(place(rbox(0.06, 0.04, 0.008, 0.003), 0.045, 1.405, -0.175), B.chest, S.FAT2); // velcro patch
  add(place(rbox(0.065, 0.13, 0.065, 0.014), -0.205, 1.27, 0.06), B.chest, S.VEST2); // radio
  add(cylAB(v3(-0.21, 1.33, 0.08), v3(-0.25, 1.74, 0.15), 0.0065, 0.0045, 5), B.chest, S.STRAP); // whip antenna
  add(cylAB(v3(0.17, 1.165, -0.085), v3(0.17, 1.29, -0.085), 0.03, 0.03, 10), B.chest, S.VEST2); // flashbang pouch
  add(cylAB(v3(0.17, 1.29, -0.085), v3(0.17, 1.315, -0.085), 0.024, 0.02, 8), B.chest, S.HW);
  add(place(rbox(0.23, 0.29, 0.065, 0.02), 0, 1.32, 0.178), B.chest, S.VEST2); // back panel
  for (let k = 0; k < 4; k++) add(place(box(0.236, 0.012, 0.068), 0, 1.22 + k * 0.065, 0.179), B.chest, S.STRAP);
  add(place(rbox(0.17, 0.045, 0.15, 0.02), 0, 1.488, -0.002), B.chest, S.FAT2); // collar

  // ---- neck
  add(cylAB(v3(0, 1.46, 0), v3(0, 1.63, -0.01), 0.058, 0.053, 10), B.neck, faceSlot, [soft(B.chest, [0, 1.49, 0], [0, 1, 0], 0.03), soft(B.head, [0, 1.6, 0], [0, -1, 0], 0.03)]);

  // ---- head
  add(ellip(0.1, 0, 1.692, -0.008, 0.95, 1.12, 1.05, 14, 10), B.head, faceSlot);
  add(place(rbox(0.122, 0.072, 0.12, 0.04), 0, 1.62, -0.042), B.head, kind === 1 ? S.BEARD : faceSlot); // jaw
  add(place(rbox(0.03, 0.05, 0.04, 0.012), 0, 1.672, -0.11, -0.25), B.head, faceSlot); // nose
  add(place(rbox(0.15, 0.028, 0.05, 0.012), 0, 1.718, -0.088), B.head, faceSlot); // brow
  if (kind === 0) {
    // high-cut helmet tilted back, rails, NVG shroud, comms cups, goggles
    add(place(new THREE.SphereGeometry(0.128, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.53), 0, 1.703, 0.012, 0.26, 0, 0, 1.0, 0.95, 1.1), B.head, S.HAT);
    for (const sx of [-1, 1]) {
      add(place(rbox(0.018, 0.03, 0.13, 0.005), sx * 0.127, 1.73, 0.01), B.head, S.STRAP);
      add(cylAB(v3(sx * 0.096, 1.675, 0.0), v3(sx * 0.137, 1.675, 0.0), 0.046, 0.044, 12), B.head, S.STRAP);
      add(place(place(rbox(0.088, 0.056, 0.042, 0.016), 0, 0, 0), sx * 0.044, 1.695, -0.098, 0, -sx * 0.4, 0), B.head, S.STRAP);
      add(place(place(rbox(0.074, 0.042, 0.014, 0.01), 0, 0, -0.019), sx * 0.044, 1.695, -0.098, 0, -sx * 0.4, 0), B.head, S.LENS);
    }
    add(place(new THREE.CylinderGeometry(0.112, 0.112, 0.024, 18, 1, true), 0, 1.695, 0.004, 0, 0, 0, 1, 1, 1.07), B.head, S.STRAP);
    add(place(rbox(0.058, 0.042, 0.02, 0.006), 0, 1.79, -0.128, 0.45), B.head, S.STRAP);
  } else if (kind === 1) {
    for (const sx of [-1, 1]) add(ellip(0.026, sx * 0.097, 1.682, 0.0, 0.45, 1.0, 0.75, 8, 6), B.head, S.SKIN);
    add(place(new THREE.SphereGeometry(0.104, 16, 5, Math.PI * 1.5 + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.3, Math.PI * 0.26), 0, 1.692, -0.006, 0, 0, 0, 0.98, 1.12, 1.06), B.head, S.HAIR);
    add(place(new THREE.SphereGeometry(0.112, 16, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), 0, 1.728, -0.006, 0.12, 0, 0, 1.0, 0.8, 1.06), B.head, S.HAT);
    add(place(new THREE.CylinderGeometry(0.096, 0.096, 0.03, 16, 1, true), 0, 1.72, -0.006, 0.12, 0, 0, 1.06, 1, 1.12), B.head, S.HAT); // cap band
    add(cylAB(v3(0, 1.47, 0.0), v3(0, 1.545, -0.004), 0.074, 0.068, 12), B.neck, S.FAT2, [soft(B.chest, [0, 1.49, 0], [0, 1, 0], 0.03)]); // neck gaiter
    add(place(rbox(0.165, 0.014, 0.1, 0.006), 0, 1.722, -0.155, -0.08), B.head, S.HAT); // brim
    for (const sx of [-1, 1]) {
      add(place(place(rbox(0.074, 0.036, 0.012, 0.008), 0, 0, 0), sx * 0.038, 1.694, -0.108, 0, -sx * 0.32, 0), B.head, S.LENS);
      add(place(box(0.006, 0.008, 0.1), sx * 0.097, 1.7, -0.05), B.head, S.STRAP);
    }
    add(place(box(0.042, 0.007, 0.01), 0, 1.633, -0.104), B.head, S.SKIN2); // mouth
    add(place(rbox(0.06, 0.013, 0.012, 0.004), 0, 1.646, -0.107), B.head, S.BEARD); // moustache
    add(place(rbox(0.018, 0.03, 0.022, 0.006), 0.112, 1.68, 0.0), B.head, S.STRAP); // earpiece
    add(cylAB(v3(0.11, 1.665, 0.008), v3(0.085, 1.48, 0.04), 0.004, 0.004, 4), B.neck, S.STRAP);
  } else {
    for (const sx of [-1, 1]) {
      add(place(place(rbox(0.072, 0.03, 0.02, 0.008), 0, 0, 0), sx * 0.034, 1.697, -0.097, 0, -sx * 0.33, 0), B.head, S.SKIN);
      add(place(rbox(0.022, 0.012, 0.008, 0.003), sx * 0.034, 1.697, -0.108), B.head, S.SKIN2);
      add(cylAB(v3(sx * 0.097, 1.68, 0.0), v3(sx * 0.135, 1.68, 0.0), 0.044, 0.042, 12), B.head, S.STRAP);
    }
    add(place(new THREE.TorusGeometry(0.12, 0.01, 4, 14, Math.PI), 0, 1.688, 0.0), B.head, S.STRAP);
    add(cylAB(v3(-0.12, 1.665, -0.02), v3(-0.045, 1.628, -0.1), 0.005, 0.005, 4), B.head, S.STRAP);
    add(ellip(0.012, -0.042, 1.627, -0.104), B.head, S.STRAP);
  }

  // ---- arms
  for (const sx of [-1, 1]) {
    const c = sx < 0 ? B.clavL : B.clavR, u = c + 1, f = c + 2, h = c + 3;
    const X = (x) => sx * x;
    add(ellip(0.078, X(0.2), 1.448, 0.002, 1.1, 0.95, 1.0), u, S.FAT, [soft(B.chest, [X(0.165), 1.45, 0], [sx, 0, 0], 0.03)]);
    add(taperAB(v3(X(0.2), 1.44, 0), v3(X(ELX), 1.44, 0), 0.068, 0.054), u, S.FAT, [soft(f, [X(ELX), 1.44, 0], [-sx, 0, 0], 0.05)]);
    add(place(rbox(0.1, 0.016, 0.078, 0.007), X(0.315), 1.5, 0), u, S.FAT2); // shoulder pocket (lateral = +y in T-pose)
    add(place(rbox(0.06, 0.016, 0.046, 0.006), X(0.315), 1.506, 0), u, S.VEST); // flag/velcro
    add(taperAB(v3(X(ELX), 1.44, 0), v3(X(WRX - 0.02), 1.44, 0), 0.054, 0.043), f, S.FAT, [soft(u, [X(ELX), 1.44, 0], [sx, 0, 0], 0.05)]);
    add(place(rbox(0.065, 0.05, 0.028, 0.012), X(ELX + 0.005), 1.44, 0.046), f, S.KNEE); // elbow pad
    add(cylAB(v3(X(WRX - 0.065), 1.44, 0), v3(X(WRX + 0.006), 1.44, 0), 0.044, 0.046, 10), f, S.GLOVE); // glove cuff
    add(place(rbox(0.09, 0.036, 0.088, 0.015), X(WRX + 0.045), 1.44, 0), h, S.GLOVE);
    add(place(rbox(0.032, 0.076, 0.084, 0.013), X(WRX + 0.088), 1.409, 0, 0, 0, -sx * 0.35), h, S.GLOVE);
    add(place(rbox(0.04, 0.012, 0.078, 0.005), X(WRX + 0.066), 1.46, 0), h, S.STRAP);
    add(capsuleAB(v3(X(WRX + 0.015), 1.43, -0.042), v3(X(WRX + 0.06), 1.415, -0.07), 0.015, 6, 2), h, S.GLOVE);
  }
  // ---- legs
  for (const sx of [-1, 1]) {
    const t = sx < 0 ? B.thighL : B.thighR, s = t + 1, f = t + 2, x = sx * HIPX;
    add(taperAB(v3(x, 0.975, 0), v3(x, 0.5, 0), 0.095, 0.063), t, S.FAT, [soft(B.pelvis, [x, 0.9, 0], [0, -1, 0], 0.06), soft(s, [x, 0.5, 0], [0, 1, 0], 0.05)]);
    if (sx < 0) {
      add(place(rbox(0.032, 0.14, 0.115, 0.012), x - 0.078, 0.74, 0.0), t, S.FAT2); // cargo pocket
    } else {
      add(place(rbox(0.05, 0.17, 0.095, 0.015), x + 0.088, 0.77, 0.0), t, S.VEST2); // drop holster
      add(place(rbox(0.032, 0.065, 0.036, 0.008), x + 0.09, 0.875, -0.025, 0.25), t, S.POLY);
      for (const yy of [0.71, 0.82]) add(place(new THREE.CylinderGeometry(0.087, 0.084, 0.022, 12, 1, true), x, yy, 0), t, S.STRAP);
    }
    add(place(rbox(0.095, 0.12, 0.045, 0.018), x, 0.5, -0.07), s, S.KNEE);
    add(taperAB(v3(x, 0.5, 0), v3(x, 0.14, 0.005), 0.061, 0.047), s, S.FAT, [soft(t, [x, 0.5, 0], [0, -1, 0], 0.05)]);
    add(cylAB(v3(x, 0.06, 0.008), v3(x, 0.24, 0.008), 0.06, 0.056, 12), s, S.BOOT);
    add(cylAB(v3(x, 0.215, 0.008), v3(x, 0.275, 0.008), 0.066, 0.062, 12), s, S.FAT);
    add(place(rbox(0.105, 0.085, 0.265, 0.035), x, 0.05, -0.055), f, S.BOOT);
    add(place(rbox(0.112, 0.026, 0.278, 0.01), x, 0.013, -0.055), f, S.SOLE);
  }

  // ---- rifle (rifle space, then moved to its bind placement)
  const G = (g) => { g.translate(GUN0.x, GUN0.y, GUN0.z); return g; };
  const gun = (g, slot) => add(G(g), B.gun, slot);
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
  gun(cylAB(v3(0, 0.118, -0.257), v3(0, 0.118, -0.252), 0.018, 0.018, 12), S.LENS);
  gun(cylAB(v3(0, 0.118, -0.348), v3(0, 0.118, -0.343), 0.018, 0.018, 12), S.LENS);
  gun(place(rbox(0.056, 0.062, 0.235, 0.012), 0, 0.035, -0.568), S.FURN); // handguard
  for (let k = 0; k < 4; k++) gun(place(box(0.058, 0.012, 0.035), 0, 0.04, -0.49 - k * 0.055), S.GMET);
  gun(cylAB(v3(0, 0.036, -0.68), v3(0, 0.036, -0.76), 0.0115, 0.0115, 8), S.GMET); // barrel
  gun(place(rbox(0.02, 0.045, 0.025, 0.004), 0, 0.07, -0.673), S.GMET); // front sight
  gun(cylAB(v3(0, 0.036, -0.752), v3(0, 0.036, -0.8), 0.018, 0.017, 10), S.GMET); // muzzle brake
  gun(cylAB(v3(0.038, 0.028, -0.57), v3(0.038, 0.028, -0.66), 0.015, 0.015, 10), S.GMET); // light
  gun(cylAB(v3(0.038, 0.028, -0.663), v3(0.038, 0.028, -0.658), 0.012, 0.012, 10), S.LENS);
  gun(place(rbox(0.033, 0.105, 0.044, 0.01), 0, -0.077, -0.245, -0.35), S.POLY); // pistol grip
  gun(place(box(0.006, 0.008, 0.075), 0, -0.042, -0.29), S.GMET); // trigger guard
  gun(place(box(0.006, 0.026, 0.006), 0, -0.03, -0.287, 0.3), S.GMET);
  gun(place(box(0.008, 0.012, 0.3), 0, -0.07, -0.42, 0.18), S.STRAP); // sling hanging under
  gun(place(box(0.008, 0.012, 0.17), 0, -0.07, -0.13, -0.42), S.STRAP);
  // magazine (own bone, local origin = mag well)
  const M = (g) => { g.translate(GUN0.x + MAG_OFF.x, GUN0.y + MAG_OFF.y, GUN0.z + MAG_OFF.z); return g; };
  add(M(place(rbox(0.031, 0.1, 0.066, 0.008), 0, -0.04, 0.0)), B.mag, S.MAGC);
  add(M(place(rbox(0.031, 0.085, 0.062, 0.008), 0, -0.115, -0.022, 0.3)), B.mag, S.MAGC);
  add(M(place(rbox(0.035, 0.013, 0.068, 0.004), 0, -0.16, -0.04, 0.36)), B.mag, S.POLY);
  return parts;
}

function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }

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

function buildTemplate(kind) {
  const parts = buildParts(kind);
  const geos = [], slotArr = [], shadeArr = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  for (const p of parts) {
    let g = p.g;
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (!g.index) { const n = g.attributes.position.count; const idx = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.type !== 'BufferGeometry') g = mergeVertices(g, 1e-5); // weld smooth seams (spheres, lathes)
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    g.computeBoundingBox();
    const bb = g.boundingBox, hY = bb.max.y - bb.min.y;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), sf = new Float32Array(n * 2);
    const sr = SURF[p.slot];
    for (let i = 0; i < n; i++) {
      P.fromBufferAttribute(pos, i); N.fromBufferAttribute(nor, i);
      let wo = 0, ob = 0;
      if (p.soft) for (const s of p.soft) {
        const t = (P.x - s.j.x) * s.ax.x + (P.y - s.j.y) * s.ax.y + (P.z - s.j.z) * s.ax.z;
        const w = Math.min(1, Math.max(0, 0.5 - 0.5 * t / s.r));
        if (w > wo) { wo = w; ob = s.b; }
      }
      si[i * 4] = p.bone; sw[i * 4] = 1 - wo; si[i * 4 + 1] = ob; sw[i * 4 + 1] = wo;
      sf[i * 2] = sr[0]; sf[i * 2 + 1] = sr[1];
      // baked shading: piece-local vertical gradient, down-facing darkening, a touch of noise
      const yn = hY > 0.02 ? (P.y - bb.min.y) / hY : 1;
      let sh = (1 - 0.2 * (1 - yn)) * (0.86 + 0.14 * (N.y * 0.5 + 0.5)) * (0.96 + 0.08 * hash3(P.x * 40, P.y * 40, P.z * 40));
      slotArr.push(p.slot); shadeArr.push(sh);
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setAttribute('surf', new THREE.Float32BufferAttribute(sf, 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight', 'surf'].includes(k)) g.deleteAttribute(k);
    g.morphAttributes = {};
    geos.push(g);
  }
  const geo = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  const count = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(0.5), 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, -0.2), 1.6);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -0.2, -1.4), new THREE.Vector3(1, 2.0, 1));
  // skeleton
  const bones = [];
  for (let i = 0; i < NB; i++) { const b = new THREE.Bone(); b.name = 'b' + i; b.position.copy(OFF[i]); bones.push(b); }
  const mesh = new THREE.SkinnedMesh(geo, gunmanMaterial());
  for (let i = 0; i < NB; i++) (PARENT[i] < 0 ? mesh : bones[PARENT[i]]).add(bones[i]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return { kind, mesh, geo, count, slots: Uint8Array.from(slotArr), shade: Float32Array.from(shadeArr), pool: [] };
}
function getTemplate(kind) { return TEMPLATES[kind] || (TEMPLATES[kind] = buildTemplate(kind)); }

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
const PAL = {
  fat: hexes(['#28292c', '#2e2f33', '#232629', '#302e2b', '#26292c', '#2b2d2a']),
  vest: hexes(['#5a6043', '#82704f', '#4a5340', '#2d2e30', '#6c6650', '#3f4636', '#7a6a50']),
  skin: hexes(['#d4a27f', '#b47c58', '#8f5d40', '#6c4532', '#e2b997', '#a26f4f']),
  hair: hexes(['#1a1410', '#2b1f17', '#3d2c1e', '#151515', '#4a3a2a']),
  helm: hexes(['#5a6043', '#7a6a50', '#2c2d2f', '#4a5340', '#6e6852']),
  cap: hexes(['#2a2b2e', '#4a5038', '#7d6a4c', '#30384a', '#6a5640', '#5c2a22']),
  glove: hexes(['#1c1c1d', '#5f5241', '#262626', '#3c3f33']),
  boot: hexes(['#1e1c1a', '#4a3c2a', '#2c2622', '#56462f']),
  furn: hexes(['#1c1c1e', '#1c1c1e', '#1c1c1e', '#6f5f45', '#4a4e3c']),
  lensG: hexes(['#d0792c', '#9aa4b0', '#c8a040', '#704028']),
  lensS: hexes(['#30343c', '#b08a3a', '#3a2a20', '#506070']),
  mask: hexes(['#1b1b1d', '#1b1b1d', '#2a2d25', '#25221f']),
};
function makePalette(seed, kind) {
  const r = makeRng((seed * 2654435761) >>> 0 ^ 0x5bd1e995);
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  const pal = new Float32Array(NS * 3);
  const set = (slot, c, k = 1) => { pal[slot * 3] = c.r * k; pal[slot * 3 + 1] = c.g * k; pal[slot * 3 + 2] = c.b * k; };
  const fat = pick(PAL.fat), vest = pick(PAL.vest), skin = pick(PAL.skin), hair = pick(PAL.hair);
  set(S.FAT, fat); set(S.FAT2, fat, 0.78);
  set(S.VEST, vest); _col.copy(vest).multiplyScalar(0.8).lerp(fat, 0.15); set(S.VEST2, _col);
  set(S.GLOVE, pick(PAL.glove)); const boot = pick(PAL.boot); set(S.BOOT, boot); set(S.SOLE, _col.setRGB(0.012, 0.011, 0.01));
  set(S.SKIN, skin); _col.copy(skin).multiplyScalar(0.45); set(S.SKIN2, _col);
  set(S.MASK, pick(PAL.mask));
  set(S.HAT, kind === 1 ? pick(PAL.cap) : (r() < 0.6 ? vest : pick(PAL.helm)));
  set(S.LENS, kind === 1 ? pick(PAL.lensS) : pick(PAL.lensG));
  set(S.STRAP, _col.setRGB(0.013, 0.013, 0.014));
  set(S.POLY, _col.setRGB(0.016, 0.016, 0.018)); set(S.GMET, _col.setRGB(0.03, 0.031, 0.034));
  set(S.FURN, pick(PAL.furn));
  set(S.MAGC, r() < 0.7 ? _col.setRGB(0.02, 0.02, 0.022) : _col.set('#6b5d48'));
  set(S.HW, _col.setRGB(0.25, 0.25, 0.26)); set(S.BELT, _col.copy(vest).multiplyScalar(0.55));
  set(S.HAIR, hair); set(S.KNEE, r() < 0.5 ? _col.setRGB(0.02, 0.02, 0.022) : _col.copy(vest).multiplyScalar(0.85));
  const beard = r(); set(S.BEARD, _col.copy(skin).lerp(hair, beard < 0.35 ? 0.0 : beard < 0.7 ? 0.45 : 0.8));
  return pal;
}
function recolor(g, pal) {
  const tpl = g.userData.tpl, col = g.attributes.color.array, sl = tpl.slots, sh = tpl.shade;
  for (let i = 0, n = tpl.count; i < n; i++) {
    const s = sl[i] * 3, k = sh[i];
    col[i * 3] = pal[s] * k; col[i * 3 + 1] = pal[s + 1] * k; col[i * 3 + 2] = pal[s + 2] * k;
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

// Legacy shim so the current game.js keeps running until it is switched to `new Gunman()`.
export function buildGunman(opts = {}) {
  const gm = new Gunman({ pose: 'roof', seed: opts.seed ?? 1, hipOffset: new THREE.Vector3(0, 0, 0), ...opts });
  return { root: gm.root, mesh: gm.mesh, muzzle: gm.muzzle, head: gm.headCenter, gunman: gm };
}

