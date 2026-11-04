import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex, concreteTexture } from '../../textures.js';
import { buildAtlas, BillboardBatch, CELL } from '../../particles.js';
import { TOWER, LEGS } from './layout.js';

// =====================================================================================
//  THE IRON LADY — a fictional wrought-iron lattice tower (300 m with the antenna), built as:
//   - primary structure: ~2 400 instanced girders (one draw): four splayed box-truss legs that
//     curve in and merge at the second platform, a tapering shaft, the arches between the legs;
//   - secondary lattice: cut-out "skin" panels on every truss face (one draw, alpha-to-coverage) so
//     it reads as dense riveted lace up close and as a glowing gold mass from across the river;
//   - platforms, friezes, lantern, spire, stone plinths (one draw each material);
//   - lights: gold floodlit emission per girder (ramped with dusk, cut floor by floor when the
//     power dies), sparkle bulbs, red aviation lights, a twin rotating beacon.
//  Collapse rig: every vertex is deformed in the vertex shader by a SPINE (25 nodes, position +
//  rotation, solved on the CPU) above the second platform, and by per-leg quadratic curves (foot
//  displacement + bow) below it, so legs buckle and bow, the shaft bends, twists and drapes over
//  the bridge instead of breaking into boxes. `deformPoint()` mirrors the GLSL for CPU-side things
//  (glows, beacon, debris spawn points, colliders).
// =====================================================================================

export const NODES = 25;
export const NODE_H = TOWER.antenna / (NODES - 1);      // 12.5 m
export const HA = TOWER.p2.y;                           // legs merge into the shaft here
export const W = (y) => 6 + 51 * Math.exp(-y / 70);     // outer half-width of the silhouette
export const IN = (y) => 43 * Math.pow(Math.max(0, 1 - y / HA), 1.3); // inner offset of a leg (0 at HA)
export const LEGC = (y) => 0.5 * (W(y) + IN(y));        // leg centreline offset (both x and z)

const IRON = 0x33261d, GOLD = new THREE.Color(1.0, 0.52, 0.17);
// sodium floods sit at the feet and on each platform, aimed up: the iron is brightest just above them
const FLOODS = [[0, 1.0], [TOWER.p1.y - 3, 0.85], [TOWER.p2.y - 2, 0.8], [TOWER.p3.y - 2, 0.7]];
const floodK = (y) => { let k = 0.18; for (const [yf, a] of FLOODS) if (y >= yf - 2) k += a * Math.exp(-(y - yf) / 38); return Math.min(1.25, k); };

// ------------------------------------------------------------------ shared deformation (GLSL + JS)
const DEFORM_GLSL = /* glsl */`
uniform vec3 uS[${NODES}];
uniform vec3 uRx[${NODES}];
uniform vec3 uRy[${NODES}];
uniform vec3 uRz[${NODES}];
uniform vec4 uFoot[4];
uniform vec4 uBow[4];
uniform float uActive;
float twW(float y) { return 6.0 + 51.0 * exp(-y / 70.0); }
float twI(float y) { return 43.0 * pow(max(0.0, 1.0 - y / ${HA.toFixed(1)}), 1.3); }
mat3 twR(float h) {
  float f = clamp(h / ${NODE_H.toFixed(4)}, 0.0, ${(NODES - 1.001).toFixed(3)});
  int i = int(f); float a = f - float(i);
  mat3 A = mat3(uRx[i], uRy[i], uRz[i]);
  mat3 B = mat3(uRx[i + 1], uRy[i + 1], uRz[i + 1]);
  return A * (1.0 - a) + B * a;
}
vec3 twS(float h) {
  float f = clamp(h / ${NODE_H.toFixed(4)}, 0.0, ${(NODES - 1.001).toFixed(3)});
  int i = int(f); float a = f - float(i);
  return mix(uS[i], uS[i + 1], a);
}
vec3 twDeform(vec3 P) {
  if (uActive < 0.5) return P;
  float h = max(P.y, 0.0);
  mat3 R = twR(h);
  if (h >= ${HA.toFixed(1)}) return twS(h) + R * vec3(P.x, P.y - h, P.z);
  float sx = P.x >= 0.0 ? 1.0 : -1.0, sz = P.z >= 0.0 ? 1.0 : -1.0;
  int L = sx > 0.0 ? (sz > 0.0 ? 1 : 2) : (sz > 0.0 ? 0 : 3);
  float c = 0.5 * (twW(h) + twI(h)), cA = 0.5 * twW(${HA.toFixed(1)});
  vec3 C = vec3(sx * c, h, sz * c);
  vec3 o = P - C;
  float t = h / ${HA.toFixed(1)};
  vec3 CA = vec3(sx * cA, ${HA.toFixed(1)}, sz * cA);
  vec3 Td = twS(${HA.toFixed(1)}) + twR(${HA.toFixed(1)}) * (CA - vec3(0.0, ${HA.toFixed(1)}, 0.0));
  vec3 dT = Td - CA, dF = uFoot[L].xyz;
  vec3 dB = 0.5 * (dF + dT) + uBow[L].xyz;
  vec3 dQ = (1.0 - t) * (1.0 - t) * dF + 2.0 * t * (1.0 - t) * dB + t * t * dT;
  return C + dQ + R * o;
}
`;

// The rig: CPU state that drives the uniforms
export class TowerRig {
  constructor() {
    this.S = Array.from({ length: NODES }, (_, i) => new THREE.Vector3(0, i * NODE_H, 0));
    this.R = Array.from({ length: NODES }, () => new THREE.Matrix3());
    this.foot = Array.from({ length: 4 }, () => new THREE.Vector4());
    this.bow = Array.from({ length: 4 }, () => new THREE.Vector4());
    this.active = 0;
    this.u = {
      uS: { value: this.S }, uRx: { value: Array.from({ length: NODES }, () => new THREE.Vector3(1, 0, 0)) },
      uRy: { value: Array.from({ length: NODES }, () => new THREE.Vector3(0, 1, 0)) }, uRz: { value: Array.from({ length: NODES }, () => new THREE.Vector3(0, 0, 1)) },
      uFoot: { value: this.foot }, uBow: { value: this.bow }, uActive: { value: 0 },
      uLight: { value: 1 }, uPowerLo: { value: -10 }, uPowerHi: { value: 1000 }, uTime: { value: 0 }, uFlicker: { value: 0 },
    };
  }
  // push R matrices into the column uniforms
  commit() {
    const { uRx, uRy, uRz } = this.u;
    for (let i = 0; i < NODES; i++) {
      const e = this.R[i].elements;
      uRx.value[i].set(e[0], e[1], e[2]); uRy.value[i].set(e[3], e[4], e[5]); uRz.value[i].set(e[6], e[7], e[8]);
    }
    this.u.uActive.value = this.active ? 1 : 0;
  }
  _R(h, out) {
    const f = Math.min(Math.max(h / NODE_H, 0), NODES - 1.001), i = f | 0, a = f - i;
    const A = this.R[i].elements, B = this.R[i + 1].elements, o = out.elements;
    for (let k = 0; k < 9; k++) o[k] = A[k] * (1 - a) + B[k] * a;
    return out;
  }
  _S(h, out) {
    const f = Math.min(Math.max(h / NODE_H, 0), NODES - 1.001), i = f | 0, a = f - i;
    return out.copy(this.S[i]).lerp(this.S[i + 1], a);
  }
  // tower-space rest point -> tower-space deformed point (mirrors twDeform)
  deform(P, out = new THREE.Vector3()) {
    if (!this.active) return out.copy(P);
    const h = Math.max(P.y, 0), R = this._R(h, _m3);
    if (h >= HA) { this._S(h, out); return out.add(_a.set(P.x, P.y - h, P.z).applyMatrix3(R)); }
    const sx = P.x >= 0 ? 1 : -1, sz = P.z >= 0 ? 1 : -1, L = sx > 0 ? (sz > 0 ? 1 : 2) : (sz > 0 ? 0 : 3);
    const c = LEGC(h), cA = 0.5 * W(HA);
    _c.set(sx * c, h, sz * c);
    _o.subVectors(P, _c).applyMatrix3(R);
    const t = h / HA;
    _ca.set(sx * cA, HA, sz * cA);
    this._S(HA, _td).add(_b.set(sx * cA, 0, sz * cA).applyMatrix3(this._R(HA, _m3b)));
    const dT = _td.sub(_ca), dF = _df.set(this.foot[L].x, this.foot[L].y, this.foot[L].z);
    const dB = _db.addVectors(dF, dT).multiplyScalar(0.5).add(_a.set(this.bow[L].x, this.bow[L].y, this.bow[L].z));
    const k0 = (1 - t) * (1 - t), k1 = 2 * t * (1 - t), k2 = t * t;
    return out.set(_c.x + k0 * dF.x + k1 * dB.x + k2 * dT.x + _o.x, _c.y + k0 * dF.y + k1 * dB.y + k2 * dT.y + _o.y, _c.z + k0 * dF.z + k1 * dB.z + k2 * dT.z + _o.z);
  }
  // rotation of the structure at height h (for orienting attached things)
  rotAt(h, out = new THREE.Matrix3()) { return this.active ? this._R(h, out) : out.identity(); }
  reset() {
    for (let i = 0; i < NODES; i++) { this.S[i].set(0, i * NODE_H, 0); this.R[i].identity(); }
    for (const v of this.foot) v.set(0, 0, 0, 0);
    for (const v of this.bow) v.set(0, 0, 0, 0);
    this.active = 0; this.commit();
  }
}
const _m3 = new THREE.Matrix3(), _m3b = new THREE.Matrix3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _o = new THREE.Vector3(), _ca = new THREE.Vector3(), _td = new THREE.Vector3(), _df = new THREE.Vector3(), _db = new THREE.Vector3();

// patch a standard material so its vertices go through the rig (instanced = custom iM0..iM3 attributes)
function rigMaterial(mat, rig, { instanced = false, emissive = true } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, rig.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${DEFORM_GLSL}\n${instanced ? 'attribute vec4 iM0; attribute vec4 iM1; attribute vec4 iM2; attribute vec4 iM3; attribute float aEmi;' : 'attribute float aEmi;'}\nvarying float vEmi; varying float vH; varying float vSeed; varying vec3 vWN;`)
      .replace('#include <beginnormal_vertex>', `
        ${instanced ? 'mat4 IM = mat4(iM0, iM1, iM2, iM3); vec3 restP = (IM * vec4(position, 1.0)).xyz; vec3 objectNormal = normalize(mat3(IM) * normal);' : 'vec3 restP = position; vec3 objectNormal = normal;'}
        if (uActive > 0.5) objectNormal = normalize(twR(max(restP.y, 0.0)) * objectNormal);
        vWN = objectNormal;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = twDeform(restP); vEmi = aEmi; vH = restP.y; vSeed = fract(sin(dot(restP.xz, vec2(12.9898, 78.233))) * 43758.5453);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vEmi; varying float vH; varying float vSeed; varying vec3 vWN;\nuniform float uLight; uniform float uPowerLo; uniform float uPowerHi; uniform float uTime; uniform float uFlicker;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float pw = step(uPowerLo, vH) * step(vH, uPowerHi);
          float fl = 1.0 - uFlicker * step(0.5, fract(sin(floor(uTime * 9.0 + vSeed * 31.0) * 12.7 + vSeed * 91.0) * 437.5));
          // floods sit at the feet and on the platforms, aimed up: faces looking down / out catch them
          float fd = 0.38 + 0.62 * clamp(0.35 - vWN.y * 0.65 + 0.25 * length(vWN.xz), 0.0, 1.0);
          totalEmissiveRadiance *= ${emissive ? 'vEmi * uLight * pw * fl * fd' : '0.0'};
        }`);
  };
  mat.customProgramCacheKey = () => 'ironlady-rig-' + (instanced ? 'i' : 'p') + (emissive ? 'e' : '');
  return mat;
}

// ------------------------------------------------------------------ textures
function latticeTexture() {
  // secondary lattice: diagonal flat bars, a frame, rivet heads; alpha = metal (cut-out)
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const bar = (x0, y0, x1, y1, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineCap = 'butt';
  const n = 4; // diamonds across
  for (let i = -n; i <= n * 2; i++) { bar(i * S / n, 0, i * S / n + S, S, 7); bar(i * S / n, 0, i * S / n - S, S, 7); }
  // horizontal stiffeners
  for (const y of [0, S / 2, S]) bar(0, y, S, y, 10);
  // frame at the panel edge
  bar(0, 0, 0, S, 14); bar(S, 0, S, S, 14);
  // rivet plates at the crossings
  g.fillStyle = 'rgba(255,255,255,1)';
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) { const x = (i + (j % 2) * 0.5) * S / n, y = j * S / n; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); }
  const t = canvasTex(c, { repeat: true });
  t.anisotropy = 4;
  return t;
}
function friezeTexture() {
  // the first-platform frieze: an arcade of small arches (cut-out) with a solid band above and below
  const S = 256, c = makeCanvas(S * 2, S / 2), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, S * 2, S / 2);
  g.globalCompositeOperation = 'destination-out';
  const n = 8, w = (S * 2) / n;
  for (let i = 0; i < n; i++) { const x = i * w + w / 2; g.beginPath(); g.moveTo(x - w * 0.34, S / 2 - 22); g.lineTo(x - w * 0.34, 50); g.arc(x, 50, w * 0.34, Math.PI, 0); g.lineTo(x + w * 0.34, S / 2 - 22); g.closePath(); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#fff';
  for (let i = 0; i <= n; i++) g.fillRect(i * w - 4, 0, 8, S / 2);
  return canvasTex(c, { repeat: true });
}

// ------------------------------------------------------------------ builder
export async function buildTower(ctx = {}) {
  const rng = makeRng(1889);
  const rig = new TowerRig();
  const root = new THREE.Group();
  root.position.set(TOWER.x, 0, TOWER.z);
  root.name = 'ironlady';

  // ---------------- primary girders (instanced) ----------------
  const beams = []; // { m: Matrix4, emi, a, b, w, kind }
  const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const beam = (a, b, w, emi = 1, d = w, kind = 0) => {
    _d.subVectors(b, a); const L = _d.length(); if (L < 0.05) return;
    _q.setFromUnitVectors(_up, _d.divideScalar(L));
    _p.addVectors(a, b).multiplyScalar(0.5);
    const m = new THREE.Matrix4().compose(_p, _q, _s.set(w, L + w * 0.6, d));
    beams.push({ m, emi, a: a.clone(), b: b.clone(), w, kind });
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // leg corner chords at a height: quadrant corners (inner/outer in x and z)
  const legCorner = (L, y, ox, oz) => { const i = IN(y), w = W(y), x = ox ? w : i, z = oz ? w : i; return V(L.sx * x, y, L.sz * z); };
  const legPanels = [];
  { const n = 22; for (let k = 0; k <= n; k++) legPanels.push(HA * k / n); }
  // skin quads collected here (4 corners each, tower space)
  const skin = [];
  const quad = (p0, p1, p2, p3, u = 1, v = 1, emi = 0.8) => skin.push({ p: [p0, p1, p2, p3], u, v, emi });

  for (const L of LEGS) {
    for (let k = 0; k < legPanels.length - 1; k++) {
      const y0 = legPanels[k], y1 = legPanels[k + 1];
      const C0 = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => legCorner(L, y0, a, b));
      const C1 = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([a, b]) => legCorner(L, y1, a, b));
      // light: brightest at the feet and around the first platform, the inner faces glow (floods inside the legs)
      const yl = (y0 + y1) / 2, emi = floodK(yl);
      for (let c = 0; c < 4; c++) beam(C0[c], C1[c], c === 2 ? 1.25 : 1.0, emi * 1.1, c === 2 ? 1.25 : 1.0, 1); // corner chords (outer corner heavier)
      for (let f = 0; f < 4; f++) {
        const a0 = C0[f], b0 = C0[(f + 1) % 4], a1 = C1[f], b1 = C1[(f + 1) % 4];
        beam(a1, b1, 0.55, emi * 0.8, 0.45, 2);                       // tie at panel top
        beam(a0, b1, 0.36, emi, 0.3, 3); beam(b0, a1, 0.36, emi, 0.3, 3); // X lacing
        quad(a0, b0, b1, a1, Math.max(1, Math.round(a0.distanceTo(b0) / 4)), Math.max(1, Math.round((y1 - y0) / 4)), emi * 0.85);
      }
      if (k % 3 === 1) { beam(C1[0], C1[2], 0.4, emi * 0.7, 0.4, 2); beam(C1[1], C1[3], 0.4, emi * 0.7, 0.4, 2); } // internal diaphragm
    }
  }
  // the shaft: from the second platform to the top (four corner chords on the silhouette)
  const shaftY = []; { let y = HA; while (y < TOWER.p3.y) { shaftY.push(y); y += Math.max(4.2, W(y) * 0.7); } shaftY.push(TOWER.p3.y); }
  const shaftC = (y) => { const w = W(y) * 0.98; return [V(-w, y, -w), V(w, y, -w), V(w, y, w), V(-w, y, w)]; };
  for (let k = 0; k < shaftY.length - 1; k++) {
    const y0 = shaftY[k], y1 = shaftY[k + 1], C0 = shaftC(y0), C1 = shaftC(y1);
    const emi = floodK((y0 + y1) / 2);
    for (let c = 0; c < 4; c++) beam(C0[c], C1[c], 0.95, emi * 1.1, 0.95, 1);
    for (let f = 0; f < 4; f++) {
      const a0 = C0[f], b0 = C0[(f + 1) % 4], a1 = C1[f], b1 = C1[(f + 1) % 4];
      beam(a1, b1, 0.45, emi * 0.8, 0.4, 2);
      beam(a0, b1, 0.3, emi, 0.26, 3); beam(b0, a1, 0.3, emi, 0.26, 3);
      quad(a0, b0, b1, a1, Math.max(1, Math.round(a0.distanceTo(b0) / 3.5)), Math.max(1, Math.round((y1 - y0) / 3.5)), emi * 0.9);
    }
    if (k % 2 === 0) { beam(C1[0], C1[2], 0.32, emi * 0.6, 0.32, 2); beam(C1[1], C1[3], 0.32, emi * 0.6, 0.32, 2); }
  }
  // spire: from the top platform to the tip, then the antenna mast
  {
    const yb = TOWER.p3.y + 3, yt = TOWER.h, n = 5;
    for (let k = 0; k < n; k++) {
      const y0 = yb + (yt - yb) * k / n, y1 = yb + (yt - yb) * (k + 1) / n, w0 = 4.2 * (1 - k / n) + 0.6, w1 = 4.2 * (1 - (k + 1) / n) + 0.6;
      const C0 = [V(-w0, y0, -w0), V(w0, y0, -w0), V(w0, y0, w0), V(-w0, y0, w0)], C1 = [V(-w1, y1, -w1), V(w1, y1, -w1), V(w1, y1, w1), V(-w1, y1, w1)];
      for (let c = 0; c < 4; c++) { beam(C0[c], C1[c], 0.5, 1.1, 0.5, 1); beam(C0[c], C1[(c + 1) % 4], 0.22, 1, 0.22, 3); }
    }
    beam(V(0, yt - 2, 0), V(0, TOWER.antenna, 0), 0.7, 0.6, 0.7, 4);
    beam(V(0, yt + 4, 0), V(0, yt + 4.5, 0), 3.2, 0.9, 3.2, 4); // dish ring
  }
  // the four decorative arches between the legs (lattice girder: intrados + extrados + lacing)
  for (let side = 0; side < 4; side++) {
    // side 0 = north (+z), 1 = east (+x), 2 = south, 3 = west
    const dirX = side === 1 ? 1 : side === 3 ? -1 : 0, dirZ = side === 0 ? 1 : side === 2 ? -1 : 0;
    const spring = 9, crown = TOWER.arch.y, n = 26;
    const pt = (u, off) => { // u in [0,1] across, off = radial thickness
      const span = IN(spring) + 0.5, ph = Math.PI * u;
      const along = -Math.cos(ph) * (span - off * 0.3), y = spring + (crown - spring + off) * Math.sin(ph);
      const fz = W(y) - 0.8;
      return dirZ ? V(along, y, dirZ * fz) : V(dirX * fz, y, along);
    };
    let pi = pt(0, 0), po = pt(0, 2.6);
    for (let k = 1; k <= n; k++) {
      const u = k / n, ci = pt(u, 0), co = pt(u, 2.6);
      const emi = 1.05;
      beam(pi, ci, 0.7, emi, 0.9, 5); beam(po, co, 0.55, emi, 0.7, 5);
      beam(ci, co, 0.3, emi, 0.3, 5); if (k % 2) beam(pi, co, 0.25, emi, 0.25, 5); else beam(po, ci, 0.25, emi, 0.25, 5);
      pi = ci; po = co;
    }
  }
  // first + second platform girders (deck edge beams, cross girders, consoles)
  const platform = (y, half, inner, depth) => {
    const ring = [[-half, -half], [half, -half], [half, half], [-half, half]];
    for (let c = 0; c < 4; c++) {
      const [x0, z0] = ring[c], [x1, z1] = ring[(c + 1) % 4];
      beam(V(x0, y, z0), V(x1, y, z1), 1.1, 1.3, 1.6, 6);                 // edge girder
      beam(V(x0, y - depth, z0), V(x1, y - depth, z1), 0.8, 1.2, 0.8, 6); // lower chord
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 4);
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        beam(V(x, y - depth, z), V(x, y, z), 0.35, 1.2, 0.35, 6);
        if (k < n) { const xn = x0 + (x1 - x0) * (k + 1) / n, zn = z0 + (z1 - z0) * (k + 1) / n; beam(V(x, y - depth, z), V(xn, y, zn), 0.25, 1.1, 0.25, 6); }
        // cross girder to the inner edge
        const ix = Math.sign(x) * Math.min(Math.abs(x), inner), iz = Math.sign(z) * Math.min(Math.abs(z), inner);
        if (k % 2 === 0) beam(V(x, y - 0.4, z), V(ix || x * 0.4, y - 0.4, iz || z * 0.4), 0.45, 0.9, 0.7, 6);
      }
    }
  };
  platform(TOWER.p1.y, TOWER.p1.half, TOWER.p1.half - 13, 4.5);
  platform(TOWER.p2.y, TOWER.p2.half, TOWER.p2.half - 7, 3);
  platform(TOWER.p3.y, TOWER.p3.half + 1, 2, 2);

  const NB = beams.length;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index; geo.setAttribute('position', box.attributes.position); geo.setAttribute('normal', box.attributes.normal); geo.setAttribute('uv', box.attributes.uv);
  const iM = [0, 1, 2, 3].map(() => new Float32Array(NB * 4));
  const aEmi = new Float32Array(NB);
  beams.forEach((b, i) => {
    const e = b.m.elements;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) iM[c][i * 4 + r] = e[c * 4 + r];
    aEmi[i] = b.emi * (0.45 + rng() * 0.9);
  });
  const iMa = iM.map(a => new THREE.InstancedBufferAttribute(a, 4).setUsage(THREE.DynamicDrawUsage));
  iMa.forEach((a, c) => geo.setAttribute('iM' + c, a));
  geo.setAttribute('aEmi', new THREE.InstancedBufferAttribute(aEmi, 1));
  geo.instanceCount = NB;
  const ironMat = rigMaterial(new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.52, metalness: 0.62, emissive: GOLD, emissiveIntensity: 0.72 }), rig, { instanced: true });
  ironMat.userData.duskEmissive = 0.72;
  const girders = new THREE.Mesh(geo, ironMat);
  girders.frustumCulled = false; girders.name = 'girders';
  root.add(girders);

  // ---------------- secondary lattice skin (cut-out panels) ----------------
  {
    const pos = [], nor = [], uv = [], emi = [];
    const _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
    for (const q of skin) {
      const [p0, p1, p2, p3] = q.p;
      _e1.subVectors(p1, p0); _e2.subVectors(p3, p0); _n.crossVectors(_e1, _e2).normalize();
      const U = q.u, Vv = q.v;
      for (const [p, s, t] of [[p0, 0, 0], [p1, U, 0], [p2, U, Vv], [p0, 0, 0], [p2, U, Vv], [p3, 0, Vv]]) {
        pos.push(p.x, p.y, p.z); nor.push(_n.x, _n.y, _n.z); uv.push(s, t); emi.push(q.emi);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aEmi', new THREE.Float32BufferAttribute(emi, 1));
    const m = rigMaterial(new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.6, metalness: 0.5, emissive: GOLD, emissiveIntensity: 0.5, alphaMap: latticeTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), rig);
    m.alphaToCoverage = true; m.userData.duskEmissive = 0.5;
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.name = 'skin';
    root.add(mesh);
  }

  // ---------------- platforms: decks, friezes, railings, lantern, plinths ----------------
  const solid = { pos: [], nor: [], uv: [], emi: [], col: [] };
  const addBox = (cx, cy, cz, sx, sy, sz, emi = 0, col = [1, 1, 1]) => {
    const b = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed(); b.translate(cx, cy, cz);
    const p = b.attributes.position.array, n = b.attributes.normal.array, u = b.attributes.uv.array;
    for (let i = 0; i < p.length; i++) { solid.pos.push(p[i]); solid.nor.push(n[i]); }
    for (let i = 0; i < u.length; i++) solid.uv.push(u[i] * Math.max(sx, sz) / 4);
    for (let i = 0; i < p.length / 3; i++) { solid.emi.push(emi); const k = 0.55 + 0.45 * Math.min(1, (p[i * 3 + 1] - cy + sy / 2) / Math.max(sy, 1e-3)); solid.col.push(col[0] * k, col[1] * k, col[2] * k); }
  };
  const deckRing = (y, half, inner, th, emi) => {
    // four slabs around the central hole
    addBox(0, y + th / 2, (half + inner) / 2, half * 2, th, half - inner, emi); addBox(0, y + th / 2, -(half + inner) / 2, half * 2, th, half - inner, emi);
    addBox((half + inner) / 2, y + th / 2, 0, half - inner, th, inner * 2, emi); addBox(-(half + inner) / 2, y + th / 2, 0, half - inner, th, inner * 2, emi);
  };
  deckRing(TOWER.p1.y, TOWER.p1.half, TOWER.p1.half - 13, 0.6, 0.15);
  deckRing(TOWER.p2.y, TOWER.p2.half, TOWER.p2.half - 7, 0.5, 0.15);
  // first-platform pavilions (glass restaurant boxes on the deck, warm lit) — they make the platform read as a place
  for (const [x, z, sx, sz] of [[0, TOWER.p1.half - 6.5, 30, 8], [0, -TOWER.p1.half + 6.5, 30, 8], [TOWER.p1.half - 6.5, 0, 8, 22], [-TOWER.p1.half + 6.5, 0, 8, 22]]) addBox(x, TOWER.p1.y + 3.2, z, sx, 5.2, sz, 0.75, [0.55, 0.5, 0.45]);
  addBox(0, TOWER.p2.y + 2.6, 0, TOWER.p2.half * 1.2, 4.6, TOWER.p2.half * 1.2, 0.6, [0.5, 0.46, 0.42]);
  // top: lantern cabin + cornice
  addBox(0, TOWER.p3.y + 2, 0, TOWER.p3.half * 2, 4, TOWER.p3.half * 2, 1.2, [0.5, 0.45, 0.4]);
  addBox(0, TOWER.p3.y + 4.3, 0, TOWER.p3.half * 2 + 1.6, 0.6, TOWER.p3.half * 2 + 1.6, 0.6);
  // railings on the decks (dark, thick enough not to read as laser lines)
  const rail = (y, half) => { for (const s of [-1, 1]) { addBox(0, y + 1.2, s * half, half * 2, 0.16, 0.16, 0.4); addBox(s * half, y + 1.2, 0, 0.16, 0.16, half * 2, 0.4); } };
  rail(TOWER.p1.y + 0.6, TOWER.p1.half + 0.3); rail(TOWER.p2.y + 0.5, TOWER.p2.half + 0.2);
  const solidGeo = new THREE.BufferGeometry();
  solidGeo.setAttribute('position', new THREE.Float32BufferAttribute(solid.pos, 3));
  solidGeo.setAttribute('normal', new THREE.Float32BufferAttribute(solid.nor, 3));
  solidGeo.setAttribute('uv', new THREE.Float32BufferAttribute(solid.uv, 2));
  solidGeo.setAttribute('aEmi', new THREE.Float32BufferAttribute(solid.emi, 1));
  solidGeo.setAttribute('color', new THREE.Float32BufferAttribute(solid.col, 3));
  const deckMat = rigMaterial(new THREE.MeshStandardMaterial({ color: 0x2c221b, roughness: 0.85, metalness: 0.15, emissive: new THREE.Color(1.0, 0.62, 0.3), emissiveIntensity: 1, vertexColors: true }), rig);
  deckMat.userData.duskEmissive = 1;
  const decks = new THREE.Mesh(solidGeo, deckMat); decks.frustumCulled = false; decks.name = 'decks';
  root.add(decks);
  // the first-platform frieze (arcade skirt), lit from behind
  {
    const pos = [], nor = [], uv = [], emi = [];
    const y0 = TOWER.p1.y - 4.6, y1 = TOWER.p1.y + 0.6, h = TOWER.p1.half + 0.4;
    const y2 = TOWER.p2.y - 3, y3 = TOWER.p2.y + 0.5, h2 = TOWER.p2.half + 0.3;
    for (const [a, b, H, U] of [[y0, y1, h, 14], [y2, y3, h2, 8]]) for (let s = 0; s < 4; s++) {
      const c = [[-H, -H], [H, -H], [H, H], [-H, H]], [x0, z0] = c[s], [x1, z1] = c[(s + 1) % 4];
      const nx = (z1 - z0) / (2 * H), nz = -(x1 - x0) / (2 * H);
      for (const [x, y, z, u, v] of [[x0, a, z0, 0, 0], [x1, a, z1, U, 0], [x1, b, z1, U, 1], [x0, a, z0, 0, 0], [x1, b, z1, U, 1], [x0, b, z0, 0, 1]]) { pos.push(x, y, z); nor.push(-nx, 0, -nz); uv.push(u, v); emi.push(1.4); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aEmi', new THREE.Float32BufferAttribute(emi, 1));
    const m = rigMaterial(new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.5, metalness: 0.5, emissive: GOLD, emissiveIntensity: 1.1, alphaMap: friezeTexture(), alphaTest: 0.5, side: THREE.DoubleSide }), rig);
    m.alphaToCoverage = true; m.userData.duskEmissive = 1.1;
    const fr = new THREE.Mesh(g, m); fr.frustumCulled = false; fr.name = 'frieze';
    root.add(fr);
  }
  // stone plinths at the feet (not rigged: the masonry stays, the iron tears off it)
  const colliders = [];
  {
    const tex = concreteTexture(31, [0.72, 0.68, 0.6], 256); tex.repeat.set(3, 1);
    const parts = [];
    for (const L of LEGS) {
      const x = L.x - TOWER.x, z = L.z - TOWER.z, s = TOWER.foot;
      const b = new THREE.BoxGeometry(s, 3.2, s); b.translate(x, 1.6, z); parts.push(b);
      const c = new THREE.BoxGeometry(s - 2.2, 1.0, s - 2.2); c.translate(x, 3.7, z); parts.push(c);
      const d = new THREE.BoxGeometry(s + 1.4, 0.6, s + 1.4); d.translate(x, 0.3, z); parts.push(d);
      colliders.push({ min: [L.x - s / 2 - 0.7, 0, L.z - s / 2 - 0.7], max: [L.x + s / 2 + 0.7, 4.2, L.z + s / 2 + 0.7], data: { mat: 'concrete', kind: 'plinth', leg: L.i } });
      // the lattice of the leg above the plinth: blocks walking, not bullets
      colliders.push({ min: [L.x - s / 2, 4.2, L.z - s / 2], max: [L.x + s / 2, 14, L.z + s / 2], data: { mat: 'metal', kind: 'leg', leg: L.i, noBullet: true } });
    }
    const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
    const pg = mergeGeometries(parts.map(p => p.toNonIndexed()));
    const pm = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: tex, color: 0xb9ad98, roughness: 0.7 }));
    pm.position.set(-TOWER.x, 0, -TOWER.z); // plinth geometry was built in world xz offsets relative to tower; undo root offset below
    pm.position.set(0, 0, 0);
    pm.receiveShadow = true; pm.castShadow = true;
    root.add(pm);
  }

  // ---------------- lights: sparkle, aviation, beacon ----------------
  const atlas = ctx.atlas || buildAtlas(ctx.renderer);
  const fog = ctx.scene?.fog || { color: new THREE.Color(0.2, 0.17, 0.3), near: 60, far: 1400 };
  const glow = new BillboardBatch(900, atlas, { boost: 1, renderOrder: 19, fog });
  glow.mesh.name = 'towerGlows';
  // sparkle points: random spots along random girders
  const sparkle = [];
  for (let i = 0; i < 620; i++) { const b = beams[(rng() * NB) | 0]; if (b.kind === 4) { i--; continue; } sparkle.push({ p: b.a.clone().lerp(b.b, rng()), ph: rng() * 100, r: rng() }); }
  // steady warm bulbs on the platform edges and the leg corners (the "necklace")
  const bulbs = [];
  for (const [y, h] of [[TOWER.p1.y - 4.4, TOWER.p1.half + 0.6], [TOWER.p2.y - 2.8, TOWER.p2.half + 0.5]]) for (let s = 0; s < 4; s++) for (let k = 0; k < 14; k++) { const t = (k + 0.5) / 14, c = [[-h, -h], [h, -h], [h, h], [-h, h]], [x0, z0] = c[s], [x1, z1] = c[(s + 1) % 4]; bulbs.push(V(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t)); }
  const red = [V(0, TOWER.antenna, 0), V(0, TOWER.h + 6, 0), V(3, TOWER.p3.y + 5, 3), V(-3, TOWER.p3.y + 5, -3)];
  const beaconP = V(0, TOWER.h - 4, 0);
  // beacon: two long soft additive beams, rotating
  const beacon = new THREE.Group(); beacon.name = 'beacon';
  {
    const L = 1300, R0 = 1.2, R1 = 70;
    const g = new THREE.CylinderGeometry(R1, R0, L, 20, 12, true); g.translate(0, L / 2, 0); g.rotateZ(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({
      uniforms: { uK: { value: 1 } },
      vertexShader: /* glsl */`varying float vA; varying vec3 vN; varying vec3 vV;
        void main(){ vA = position.x / ${L.toFixed(1)}; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`uniform float uK; varying float vA; varying vec3 vN; varying vec3 vV;
        void main(){ float side = abs(dot(vN, vV)); float a = pow(side, 1.6) * pow(1.0 - vA, 2.2) * smoothstep(0.0, 0.02, vA) * 0.22 * uK;
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const b1 = new THREE.Mesh(g, m), b2 = new THREE.Mesh(g, m); b2.rotation.y = Math.PI;
    b1.frustumCulled = b2.frustumCulled = false; b1.renderOrder = b2.renderOrder = 18;
    beacon.add(b1, b2); beacon.userData.mat = m;
  }
  root.add(beacon);

  const state = { sparkle: 1, sparkleT: 0, beacon: 1, aviation: 1, light: 1, dusk: 0.9 };
  const _w = new THREE.Vector3(), _w2 = new THREE.Vector3(), _rm = new THREE.Matrix3(), _rm4 = new THREE.Matrix4();
  const rootPos = root.position;
  // reflection anchors for the river / wet ground: sample points on the lit body (static rest positions, the
  // level re-samples them through deform() during the collapse)
  const reflect = [];
  for (let i = 0; i < 18; i++) { const y = 6 + i * 14.5; const w = y < HA ? LEGC(y) : W(y) * 0.6; reflect.push({ rest: V(0, y, w * 0.2), color: [1.6, 0.95, 0.42], len: 40, width: Math.max(4, w * 0.6) }); }

  function update(dt, t, dusk, head) {
    rig.u.uTime.value = t;
    state.dusk = dusk;
    const L = state.light;
    rig.u.uLight.value = L;
    let gi = 0;
    // sparkle: the hourly bulbs (white flashes), only while lit
    if (state.sparkle > 0.01 && L > 0.2) {
      for (let i = 0; i < sparkle.length; i++) {
        const s = sparkle[i];
        const on = Math.sin(t * (7 + s.r * 9) + s.ph) > 0.82;
        if (!on) continue;
        const p = rig.deform(s.p, _w).add(rootPos);
        const k = state.sparkle * L * (0.6 + s.r * 0.6);
        glow.set(gi++, p.x, p.y, p.z, 1.6, 1.6, 0, CELL.STAR, 0, 3.2 * k, 3.0 * k, 2.7 * k, 0.9 * k);
        if (gi > 640) break;
      }
    }
    // warm necklace bulbs (hidden where the power is out)
    for (const b of bulbs) {
      if (L < 0.05 || b.y < rig.u.uPowerLo.value || b.y > rig.u.uPowerHi.value) continue;
      const p = rig.deform(b, _w).add(rootPos);
      glow.set(gi++, p.x, p.y, p.z, 2.2, 2.2, 0, CELL.GLOW, 0, 2.4 * L, 1.45 * L, 0.6 * L, 0.8 * L);
    }
    // red aviation lights (blink)
    if (state.aviation > 0 && Math.sin(t * 3.1) > -0.2) for (const r of red) {
      const p = rig.deform(r, _w).add(rootPos);
      glow.set(gi++, p.x, p.y, p.z, 4.5, 4.5, 0, CELL.GLOW, 0, 3.5 * state.aviation, 0.25 * state.aviation, 0.15 * state.aviation, 1);
    }
    // beacon: source glow + rotating beams following the structure
    const bk = state.beacon * Math.min(1, dusk * 1.4);
    beacon.visible = bk > 0.01;
    if (beacon.visible) {
      const p = rig.deform(beaconP, _w);
      beacon.position.copy(p);
      _rm.copy(rig.rotAt(beaconP.y, _rm));
      _rm4.setFromMatrix3(_rm);
      beacon.quaternion.setFromRotationMatrix(_rm4);
      beacon.rotateY(t * 0.55);
      beacon.rotateZ(0.06);
      beacon.userData.mat.uniforms.uK.value = bk;
      _w2.copy(p).add(rootPos);
      glow.set(gi++, _w2.x, _w2.y, _w2.z, 14, 14, 0, CELL.GLOW, 0, 3.0 * bk, 2.4 * bk, 1.6 * bk, 0.9 * bk);
    }
    glow.commit(gi);
  }

  root.updateMatrixWorld(true);
  // glows are in world space: the batch lives in the scene, not under the tower root
  const extra = new THREE.Group(); extra.add(glow.mesh);
  return {
    root, extra, rig, colliders, state, update, beams, girders, glow,
    anchors: { reflect, crash: V(LEGS[TOWER.crashLeg].x, TOWER.crashY, LEGS[TOWER.crashLeg].z), p1y: TOWER.p1.y },
    info: { beams: NB, skin: skin.length, tris: NB * 12 + skin.length * 2 + solid.pos.length / 9 },
  };
}

// viewer helper: tower + a lit-ground stand-in, optionally bent (?args=[bend])
export async function buildPreview(bend = 0, ctx) {
  if (typeof bend === 'object') { ctx = bend; bend = 0; }
  const T = await buildTower(ctx);
  const g = new THREE.Group(); g.add(T.root, T.extra);
  if (bend) {
    const R = T.rig; R.active = 1;
    const ax = new THREE.Vector3(1, 0, 0);
    let th = 0; const S = R.S;
    for (let i = 0; i < NODES; i++) {
      th = bend * Math.min(1, i / 6) * 0.9 + (i > 9 ? bend * 0.6 * (i - 9) / 15 : 0);
      R.R[i].setFromMatrix4(new THREE.Matrix4().makeRotationAxis(ax, th));
      if (i > 0) S[i].copy(S[i - 1]).add(new THREE.Vector3(0, NODE_H, 0).applyMatrix3(R.R[i - 1]));
    }
    R.foot[1].set(0, -2, 3, 0); R.bow[1].set(6, -4, 6, 0);
    R.commit();
  }
  return { root: g, update: (dt, t) => T.update(dt, t, 0.9, new THREE.Vector3()), info: T.info };
}
