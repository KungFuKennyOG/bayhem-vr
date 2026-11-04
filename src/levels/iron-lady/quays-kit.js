import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeRng } from '../../rng.js';
import { makeNoise, fbm, makeCanvas, canvasTex, heightToNormal } from '../../textures.js';

// =====================================================================================
//  THE IRON LADY — toolkit for quays.js: geometry buckets (world space, per-vertex albedo /
//  roughness / metal / baked light), procedural textures (limestone ashlar, worn pavés, wet
//  asphalt, park gravel, lawn, autumn plane-tree leaves, props atlas, ground decals) and the
//  "baked" material: MeshStandardMaterial + per-vertex roughness/metal + per-vertex emission
//  (= baked lamp light × albedo), so light pools, lit walls and warm undersides cost nothing.
// =====================================================================================

export const TS = 2.4;   // stone ashlar tile (m): 4 courses of 0.6 m, blocks 1.2 m
export const TC = 4;     // cobbles tile
export const TA = 5;     // asphalt tile
export const TG = 3;     // gravel tile
export const TL = 2;     // lawn / hedge tile
export const PA = 1024;  // props atlas
export const DA = 1024;  // decal atlas
export const Z3 = [0, 0, 0];
export const FONT = '"Anton", Impact, "Arial Black", "DejaVu Sans", sans-serif';
export const FONT2 = '"Oswald", "Arial Narrow", "DejaVu Sans Condensed", sans-serif';
export const SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';

// roughness, metalness, bake (receives baked lamp light)
export const RM = {
  stone: [0.78, 0, 1], wet: [0.5, 0, 1], cobble: [0.7, 0, 1], asph: [0.55, 0, 1], gravel: [0.9, 0, 1], lawn: [0.95, 0, 1],
  iron: [0.42, 0.65, 1], paint: [0.42, 0.25, 1], wood: [0.72, 0, 1], glass: [0.08, 0.3, 1], bronze: [0.4, 0.75, 1],
  rubber: [0.85, 0, 1], plastic: [0.45, 0, 1], gold: [0.3, 1, 1], leaf: [0.85, 0, 1], fabric: [0.9, 0, 1], glow: [0.4, 0, 0], galv: [0.38, 0.85, 1],
};
export const COL = {
  white: [1, 1, 1], iron: [0.03, 0.032, 0.034], ironG: [0.02, 0.034, 0.028], bronze: [0.07, 0.075, 0.055], galv: [0.3, 0.31, 0.32],
  stone: [0.78, 0.72, 0.62], granite: [0.36, 0.35, 0.34], dark: [0.02, 0.02, 0.022], rubber: [0.03, 0.03, 0.03],
  bouq: [0.03, 0.075, 0.048], wood: [0.42, 0.3, 0.2], brass: [0.55, 0.38, 0.14],
};
export const WARM = [1.0, 0.7, 0.38];       // gas-lamp gold
export const SODIUM = [1.0, 0.55, 0.2];

// ---------------------------------------------------------------------- small math
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export function steps(a, b, st) { const n = Math.max(1, Math.round(Math.abs(b - a) / st)), o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; }
export function brk(...lists) { const s = [...new Set(lists.flat().map((v) => Math.round(v * 1000) / 1000))]; return s.sort((a, b) => a - b); }
// world-space value noise / fbm
const WN = makeNoise(9001, 512), WN2 = makeNoise(9002, 512);
export const wn = (x, z) => WN(x + 1000, z + 1000);
export const wfbm = (x, z, oct = 3) => { let s = 0, a = 0.5, f = 1, nrm = 0; for (let o = 0; o < oct; o++) { s += a * WN2(x * f + 700, z * f + 700); nrm += a; a *= 0.5; f *= 2.03; } return s / nrm; };

// ---------------------------------------------------------------------- geometry
export const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
export const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const CYL = (rt, rb, h, s = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
export const SPH = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
export const RBOX = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 1, Math.max(0.005, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
export const LATHE = (pts, seg = 8) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg);
export const TOR = (R, r, rs = 4, ts = 10, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, rs, ts, arc);
export const CONE = (r, h, s = 8) => new THREE.ConeGeometry(r, h, s, 1);
export const rUV = (r, S = PA) => [r[0] / S, 1 - (r[1] + r[3]) / S, (r[0] + r[2]) / S, 1 - r[1] / S];
export const WUV = [16 / PA, 1 - 16 / PA];
export function wsUV(p, n, sc) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [p[0] / sc, p[2] / sc];
  if (ax >= az) return [p[2] / sc, p[1] / sc];
  return [p[0] / sc, p[1] / sc];
}
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _n3 = new THREE.Matrix3();

// a bucket = one merged mesh: position, normal, uv, color (albedo tint), rm (rough, metal, bake), e (fixed emission)
export class Bk {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.R = []; this.E = []; this.I = []; }
  get n() { return this.P.length / 3; }
  v(p, nn, uv, c, rm, e = Z3) {
    this.P.push(p[0], p[1], p[2]); this.N.push(nn[0], nn[1], nn[2]); this.U.push(uv[0], uv[1]);
    this.C.push(c[0], c[1], c[2]); this.R.push(rm[0], rm[1], rm[2]); this.E.push(e[0], e[1], e[2]);
    return this.P.length / 3 - 1;
  }
  t(a, b, c) { this.I.push(a, b, c); }
  q(a, b, c, d) { this.I.push(a, b, c, a, c, d); }
}
// push a three geometry. o: { col: [rgb] | fn(p,n), rm, e, rect | ws (world uv scale) | uv: [u,v] }
export function addGeo(bk, geo, m4, o = {}) {
  const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv;
  _n3.getNormalMatrix(m4);
  const base = bk.n, rect = o.rect ? rUV(o.rect, o.S || PA) : null, rm = o.rm || RM.stone, e = o.e || Z3;
  for (let i = 0; i < P.count; i++) {
    _v.fromBufferAttribute(P, i).applyMatrix4(m4); const p = [_v.x, _v.y, _v.z];
    _w.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); const n = [_w.x, _w.y, _w.z];
    let uv;
    if (o.ws) uv = wsUV(p, n, o.ws);
    else if (rect) uv = U ? [rect[0] + (rect[2] - rect[0]) * U.getX(i), rect[1] + (rect[3] - rect[1]) * U.getY(i)] : [rect[0], rect[1]];
    else uv = o.uv || WUV;
    const c = typeof o.col === 'function' ? o.col(p, n) : (o.col || COL.white);
    bk.v(p, n, uv, c, typeof rm === 'function' ? rm(p, n) : rm, typeof e === 'function' ? e(p, n) : e);
  }
  if (geo.index) { const I = geo.index.array; for (let i = 0; i < I.length; i++) bk.I.push(base + I[i]); }
  else for (let i = 0; i < P.count; i++) bk.I.push(base + i);
  geo.dispose();
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// parametric surface over us × vs. o: { n(u,v,p) | hint ([xyz] | fn(p)), uv(p,n,u,v) | ws, col, rm, e, skip(u0,u1,v0,v1) }
export function surf(bk, us, vs, f, o = {}) {
  const base = bk.n, nu = us.length, nv = vs.length;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u = us[i], v = vs[j], p = f(u, v);
    let n;
    if (o.n) n = o.n(u, v, p);
    else {
      const du = sub(f(us[Math.min(nu - 1, i + 1)], v), f(us[Math.max(0, i - 1)], v));
      const dv = sub(f(u, vs[Math.min(nv - 1, j + 1)]), f(u, vs[Math.max(0, j - 1)]));
      n = norm(cross(du, dv));
      const h = typeof o.hint === 'function' ? o.hint(p) : o.hint;
      if (h && dot(n, h) < 0) n = [-n[0], -n[1], -n[2]];
    }
    const uv = o.uv ? o.uv(p, n, u, v) : wsUV(p, n, o.ws || TS);
    const c = typeof o.col === 'function' ? o.col(p, n) : (o.col || COL.white);
    const rm = typeof o.rm === 'function' ? o.rm(p, n) : (o.rm || RM.stone);
    bk.v(p, n, uv, c, rm, typeof o.e === 'function' ? o.e(p, n) : (o.e || Z3));
  }
  for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
    if (o.skip && o.skip(us[i], us[i + 1], vs[j], vs[j + 1])) continue;
    const a = base + i * nv + j; bk.q(a, a + nv, a + nv + 1, a + 1);
  }
}
// sweep a 2D profile [[a,b],...] (solid on the RIGHT when walking the list) along us.
// map(u, a, b) -> [x,y,z]; nmap(na, nb) -> [nx,ny,nz]. Normals are smoothed across joints < 40°.
export function prof(bk, us, pts, map, nmap, o = {}) {
  const segN = [];
  for (let k = 0; k < pts.length - 1; k++) { const da = pts[k + 1][0] - pts[k][0], db = pts[k + 1][1] - pts[k][1], l = Math.hypot(da, db) || 1; segN.push([-db / l, da / l]); }
  const vn = (k, side) => { // normal at vertex k for segment (k-1 if side 0, else k)
    const s = side ? k : k - 1, a = segN[s], b = side ? segN[k - 1] : segN[k];
    if (!b) return a;
    const c = a[0] * b[0] + a[1] * b[1];
    if (c > 0.77) { const m = [a[0] + b[0], a[1] + b[1]], l = Math.hypot(m[0], m[1]); return [m[0] / l, m[1] / l]; }
    return a;
  };
  const sc = o.ws || TS;
  let arc = o.arc0 || 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const A = pts[k], B = pts[k + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (L < 1e-5) continue;
    const nA = vn(k, 1), nB = vn(k + 1, 0);
    const base = bk.n;
    for (const u of us) {
      for (const [P2, N2, av] of [[A, nA, arc], [B, nB, arc + L]]) {
        const p = map(u, P2[0], P2[1]), n = nmap(N2[0], N2[1]);
        const uv = o.uv ? o.uv(p, n, u, av) : [u / sc, av / sc];
        const c = typeof o.col === 'function' ? o.col(p, n) : (o.col || COL.white);
        const rm = typeof o.rm === 'function' ? o.rm(p, n) : (o.rm || RM.stone);
        bk.v(p, n, uv, c, rm, o.e || Z3);
      }
    }
    for (let i = 0; i < us.length - 1; i++) { const a = base + i * 2; bk.q(a, a + 2, a + 3, a + 1); }
    arc += L;
  }
}
// flat quad from 4 corners (any winding — fixed at finalize against n)
export function quad4(bk, a, b, c, d, n, uvs, col, rm, e = Z3) {
  const i0 = bk.v(a, n, uvs[0], col, rm, e), i1 = bk.v(b, n, uvs[1], col, rm, e), i2 = bk.v(c, n, uvs[2], col, rm, e), i3 = bk.v(d, n, uvs[3], col, rm, e);
  bk.q(i0, i1, i2, i3);
}
// textured quad centred at c with right / up axes
export function quadRU(bk, c, right, up, w, h, rect, col, rm, e = Z3, S = PA) {
  const n = norm(cross(right, up)), r = rUV(rect, S), hw = w / 2, hh = h / 2;
  const P = (a, b) => [c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b];
  quad4(bk, P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh), n, [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], col, rm, e);
}
// ground decal: centre, size, rotation about y, rect in decal atlas
export function decal(bk, x, y, z, w, l, rot, rect, col = COL.white, rm = [0.6, 0, 1]) {
  const c = Math.cos(rot), s = Math.sin(rot);
  quadRU(bk, [x, y, z], [c, 0, -s], [-s, 0, -c], w, l, rect, col, rm, Z3, DA);
}
// vertical decal on a wall: centre, outward normal n (horizontal), up axis (usually [0,1,0] or [0,-1,0])
export function wallDecal(bk, c, n, up, w, h, rect, col = COL.white, rm = [0.6, 0, 1]) {
  const right = cross(up, n);
  quadRU(bk, c, right, up, w, h, rect, col, rm, Z3, DA);
}
// cylinder between two points (r0 at a, r1 at b)
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function seg(bk, a, b, r0, r1, sides, o, open = true) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = _d.length(); if (L < 1e-4) return; _d.multiplyScalar(1 / L);
  _q.setFromUnitVectors(_up, _d);
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, new THREE.Vector3(1, 1, 1));
  addGeo(bk, new THREE.CylinderGeometry(r1, r0, L, sides, 1, open), m, o);
}
// box between two points (square section w x h, h along `upHint` side)
export function beam(bk, a, b, w, h, o) {
  _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = _d.length(); if (L < 1e-4) return; _d.multiplyScalar(1 / L);
  _q.setFromUnitVectors(_up, _d);
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, new THREE.Vector3(1, 1, 1));
  addGeo(bk, new THREE.BoxGeometry(w, L, h), m, o);
}

// ---------------------------------------------------------------------- light baking
// lights: { p:[x,y,z], c:[r,g,b], r: radius, k: intensity, wrap }
export class LightField {
  constructor() { this.list = []; this.big = []; this.cell = 16; this.map = new Map(); }
  add(L) {
    if (L.r > 18) { this.big.push(L); return; }
    this.list.push(L);
    const c = this.cell, x0 = Math.floor((L.p[0] - L.r) / c), x1 = Math.floor((L.p[0] + L.r) / c), z0 = Math.floor((L.p[2] - L.r) / c), z1 = Math.floor((L.p[2] + L.r) / c);
    for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) { const key = i * 4096 + k; let a = this.map.get(key); if (!a) this.map.set(key, a = []); a.push(L); }
  }
  at(px, py, pz, nx, ny, nz, out) {
    out[0] = out[1] = out[2] = 0;
    const a = this.map.get(Math.floor(px / this.cell) * 4096 + Math.floor(pz / this.cell));
    const f = (L) => {
      const dx = L.p[0] - px, dy = L.p[1] - py, dz = L.p[2] - pz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d >= L.r) return;
      const id = 1 / Math.max(d, 1e-3), w = L.wrap ?? 0.35;
      const lam = Math.max(0, Math.min(1, ((dx * nx + dy * ny + dz * nz) * id + w) / (1 + w)));
      const t = 1 - d / L.r, att = L.k * t * t * lam;
      out[0] += L.c[0] * att; out[1] += L.c[1] * att; out[2] += L.c[2] * att;
    };
    if (a) for (const L of a) f(L);
    for (const L of this.big) f(L);
    return out;
  }
}
// bucket -> geometry (+ winding fix against vertex normals + light bake). split(cx,cy,cz) -> part key (optional)
export function finalize(bk, field, split = null) {
  if (!bk.I.length) return [];
  const P = bk.P, N = bk.N, I = bk.I;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ex = P[b] - P[a], ey = P[b + 1] - P[a + 1], ez = P[b + 2] - P[a + 2], fx = P[c] - P[a], fy = P[c + 1] - P[a + 1], fz = P[c + 2] - P[a + 2];
    const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
    const sx = N[a] + N[b] + N[c], sy = N[a + 1] + N[b + 1] + N[c + 1], sz = N[a + 2] + N[b + 2] + N[c + 2];
    if (cx * sx + cy * sy + cz * sz < 0) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
  }
  const n = bk.n, G = new Float32Array(n * 3), o = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    let gx = bk.E[i * 3], gy = bk.E[i * 3 + 1], gz = bk.E[i * 3 + 2];
    const k = bk.R[i * 3 + 2];
    if (k > 0 && field) { field.at(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], o); gx += o[0] * k; gy += o[1] * k; gz += o[2] * k; }
    G[i * 3] = gx; G[i * 3 + 1] = gy; G[i * 3 + 2] = gz;
  }
  const parts = new Map();
  if (split) {
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const key = split((P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3);
      let arr = parts.get(key); if (!arr) parts.set(key, arr = []); arr.push(I[t], I[t + 1], I[t + 2]);
    }
  } else parts.set(0, I);
  const out = [];
  for (const [key, idx] of parts) {
    const remap = new Int32Array(n).fill(-1); let m = 0;
    for (const i of idx) if (remap[i] < 0) remap[i] = m++;
    const pos = new Float32Array(m * 3), nor = new Float32Array(m * 3), uv = new Float32Array(m * 2), col = new Float32Array(m * 3), rm = new Float32Array(m * 3), gl = new Float32Array(m * 3);
    for (let i = 0; i < n; i++) {
      const j = remap[i]; if (j < 0) continue;
      for (let c = 0; c < 3; c++) { pos[j * 3 + c] = P[i * 3 + c]; nor[j * 3 + c] = N[i * 3 + c]; col[j * 3 + c] = bk.C[i * 3 + c]; rm[j * 3 + c] = bk.R[i * 3 + c]; gl[j * 3 + c] = G[i * 3 + c]; }
      uv[j * 2] = bk.U[i * 2]; uv[j * 2 + 1] = bk.U[i * 2 + 1];
    }
    const ix = m > 65535 ? new Uint32Array(idx.length) : new Uint16Array(idx.length);
    for (let t = 0; t < idx.length; t++) ix[t] = remap[idx[t]];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('rm', new THREE.BufferAttribute(rm, 3)); g.setAttribute('glow', new THREE.BufferAttribute(gl, 3));
    g.setIndex(new THREE.BufferAttribute(ix, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    out.push({ key, geometry: g, tris: idx.length / 3 });
  }
  return out;
}

// ---------------------------------------------------------------------- materials
export function bakedMat(params = {}, { leaves = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, emissive: 0xffffff, emissiveIntensity: 1, ...params });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rm;\nattribute vec3 glow;\nvarying vec3 vRM;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = rm; vGlow = glow;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRM;\nvarying vec3 vGlow;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * vRM.x, 0.03, 1.0);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = emissive * vGlow * diffuseColor.rgb;');
    if (leaves) s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  m.customProgramCacheKey = () => 'ilBaked' + (leaves ? 'L' : '');
  m.userData.duskEmissive = 1;
  return m;
}

// ---------------------------------------------------------------------- textures
function gen(S, fn) {
  const c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S);
  const rc = makeCanvas(S, S), rg = rc.getContext('2d'), rimg = rg.createImageData(S, S);
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = fn(x, y), i = (y * S + x) * 4;
    img.data[i] = o[0]; img.data[i + 1] = o[1]; img.data[i + 2] = o[2]; img.data[i + 3] = 255; H[y * S + x] = o[3];
    const rr = o[4] * 255; rimg.data[i] = rr; rimg.data[i + 1] = rr; rimg.data[i + 2] = rr; rimg.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); rg.putImageData(rimg, 0, 0);
  return { c, g, H, rc };
}
function pack(o, S, strength, aniso) {
  const map = canvasTex(o.c, { aniso }), normal = heightToNormal(o.H, S, S, strength), rough = canvasTex(o.rc, { srgb: false, aniso });
  normal.anisotropy = aniso;
  return { map, normal, rough };
}
// rusticated limestone ashlar: 4 courses / 2.4 m, V-chamfered joints, pitted rough faces
function stoneTex(aniso) {
  const S = 512, rows = 4, rh = S / rows, bw = S / 2, r = makeRng(34);
  const n1 = makeNoise(31, 16), n2 = makeNoise(32, 128), n3 = makeNoise(33, 64);
  const tone = []; for (let k = 0; k < 16; k++) tone.push((r() - 0.5) * 0.16);
  const split = []; for (let k = 0; k < 16; k++) split.push(r() < 0.22 ? 0.3 + r() * 0.4 : -1);
  const o = gen(S, (x, y) => {
    const row = (y / rh) | 0, off = row % 2 ? bw / 2 : 0, xx = (x + off) % S, col = (xx / bw) | 0;
    let lx = xx - col * bw, L = bw; const ly = y - row * rh, id = (row * 2 + col) % 16;
    if (split[id] > 0) { const sp = split[id] * bw; if (lx < sp) L = sp; else { lx -= sp; L = bw - sp; } }
    const u = x / S, v = y / S;
    const wob = (n3(u * 64, v * 64) - 0.5) * 3;
    const e = Math.min(lx, L - lx, ly, rh - ly) + wob, ch = 10;
    const big = fbm(n1, u, v, 4, 4), fine = n2(u * 128, v * 128), mid = fbm(n3, u, v, 16, 3);
    let t = Math.max(0, Math.min(1, e / ch)); t = t * t * (3 - 2 * t);
    let h = t * (0.8 + 0.2 * mid) + (fine - 0.5) * 0.1;
    let b = 0.66 + tone[id] + (big - 0.5) * 0.16 + (mid - 0.5) * 0.1 + (fine - 0.5) * 0.07;
    if (e < ch) b *= 0.6 + 0.4 * Math.max(0, e) / ch;
    if (e < 1.5) b *= 0.55;
    const pit = n2(u * 128 + 17, v * 128 + 5);
    if (pit > 0.82) { b *= 0.78; h -= 0.15; }
    const w = (big - 0.5) * 0.06;
    return [b * (1.02 + w) * 255, b * 0.95 * 255, b * 0.84 * 255, h, e < ch ? 0.92 : 0.8 + (mid - 0.5) * 0.25];
  });
  return pack(o, S, 3.2, aniso);
}
// worn granite pavés: 20 rows / 4 m, random lengths, domed polished tops, wet mud joints
function cobbleTex(aniso) {
  const S = 1024, rows = 20, rh = S / rows, r = makeRng(71), n1 = makeNoise(72, 32), n2 = makeNoise(73, 256), n3 = makeNoise(74, 64);
  const R = [];
  for (let j = 0; j < rows; j++) {
    const b = [0]; let x = 0;
    for (;;) { const L = (0.17 + r() * 0.14) * S / 4; if (x + L > S - 34) { b.push(S); break; } x += L; b.push(x); }
    R.push({ off: Math.floor(r() * S), b, tone: b.map(() => (r() - 0.5) * 0.34), hue: b.map(() => r()), dome: b.map(() => 0.5 + r() * 0.5) });
  }
  const o = gen(S, (x, y) => {
    const j = Math.min(rows - 1, (y / rh) | 0), row = R[j], xx = (x + row.off) % S;
    let k = 0; while (row.b[k + 1] <= xx) k++;
    const L = row.b[k + 1] - row.b[k], lx = xx - row.b[k], ly = y - j * rh, u = x / S, v = y / S;
    const wob = (n3(u * 64, v * 64) - 0.5) * 6, rr = 11;
    const dx = Math.max(0, Math.abs(lx - L / 2) - (L / 2 - rr)), dy = Math.max(0, Math.abs(ly - rh / 2) - (rh / 2 - rr));
    const e = rr - Math.hypot(dx, dy) + wob, gap = 3.4;
    const fine = n2(u * 256, v * 256), big = fbm(n1, u, v, 4, 3);
    if (e < gap) { const m = 0.075 + fine * 0.05 + big * 0.03; return [m * 270, m * 255, m * 230, 0, 0.22]; }
    const t = Math.min(1, (e - gap) / 16), dome = row.dome[k];
    const cx = (lx / L - 0.5) * 2, cy = (ly / rh - 0.5) * 2;
    const h = (1 - (1 - t) * (1 - t)) * (0.5 + 0.5 * dome * (1 - 0.4 * (cx * cx + cy * cy))) + (fine - 0.5) * 0.14;
    const hue = row.hue[k];
    const base = hue < 0.5 ? [0.46, 0.45, 0.44] : hue < 0.75 ? [0.5, 0.45, 0.39] : hue < 0.9 ? [0.37, 0.38, 0.41] : [0.56, 0.5, 0.43];
    const speck = n2(u * 256 + 31, v * 256 + 11) > 0.78 ? 0.12 : 0;
    const k2 = (1 + row.tone[k] + (fine - 0.5) * 0.2 + speck) * (0.7 + 0.3 * t) * (0.88 + (big - 0.5) * 0.3);
    const pol = t * dome;
    return [base[0] * k2 * 255, base[1] * k2 * 255, base[2] * k2 * 255, h, 0.74 - pol * 0.32 + (fine - 0.5) * 0.1];
  });
  return pack(o, S, 4.5, aniso);
}
function asphaltTex(aniso) {
  const S = 512, n1 = makeNoise(81, 16), n2 = makeNoise(82, 256), n3 = makeNoise(83, 64), r = makeRng(84);
  const o = gen(S, (x, y) => {
    const u = x / S, v = y / S, big = fbm(n1, u, v, 3, 4), fine = n2(u * 256, v * 256), mid = fbm(n3, u, v, 8, 3), q = r();
    let b = 0.3 + (big - 0.5) * 0.12 + (mid - 0.5) * 0.06 + (fine - 0.5) * 0.08, h = fine * 0.6 + q * 0.3;
    if (q > 0.97) { b += 0.08; h += 0.3; } else if (q < 0.03) { b -= 0.06; h -= 0.2; }
    const bit = Math.max(0, mid - 0.6) * 2.5; b -= bit * 0.1;
    return [b * 255 * 1.03, b * 255, b * 255 * 0.95, h, 0.8 - bit * 0.5 + (big - 0.5) * 0.2];
  });
  // sealed cracks (glossy tar)
  const g = o.g, rg = o.rc.getContext('2d');
  for (let k = 0; k < 6; k++) {
    let x = r() * S, y = r() * S, a = r() * 6; g.beginPath(); rg.beginPath(); g.moveTo(x, y); rg.moveTo(x, y);
    for (let s = 0; s < 30; s++) { a += (r() - 0.5) * 0.6; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); rg.lineTo(x, y); }
    g.strokeStyle = 'rgba(12,12,14,0.35)'; g.lineWidth = 5; g.stroke(); rg.strokeStyle = 'rgb(60,60,60)'; rg.lineWidth = 6; rg.stroke();
  }
  return pack(o, S, 2.2, aniso);
}
function gravelTex(aniso) {
  const S = 512, r = makeRng(91), n1 = makeNoise(92, 16), n2 = makeNoise(93, 256);
  const c = makeCanvas(S, S), g = c.getContext('2d'), hc = makeCanvas(S, S), hg = hc.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, b = 0.5 + (fbm(n1, u, v, 4, 3) - 0.5) * 0.2 + (n2(u * 256, v * 256) - 0.5) * 0.12, i = (y * S + x) * 4;
    img.data[i] = b * 240; img.data[i + 1] = b * 222; img.data[i + 2] = b * 192; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); hg.fillStyle = '#404040'; hg.fillRect(0, 0, S, S);
  for (let k = 0; k < 7000; k++) {
    const x = r() * S, y = r() * S, rr = 1.6 + r() * 3.2, a = r() * 3, t = 0.62 + r() * 0.5;
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      if (x + dx < -8 || x + dx > S + 8 || y + dy < -8 || y + dy > S + 8) continue;
      g.fillStyle = `rgba(30,26,20,0.35)`; g.beginPath(); g.ellipse(x + dx + 0.8, y + dy + 1.2, rr, rr * 0.7, a, 0, 7); g.fill();
      const tint = r() < 0.15 ? [200, 175, 150] : r() < 0.3 ? [170, 168, 160] : [222, 208, 182];
      g.fillStyle = `rgb(${tint[0] * t | 0},${tint[1] * t | 0},${tint[2] * t | 0})`; g.beginPath(); g.ellipse(x + dx, y + dy, rr, rr * 0.7, a, 0, 7); g.fill();
      const hgr = hg.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr); hgr.addColorStop(0, '#fff'); hgr.addColorStop(1, '#505050');
      hg.fillStyle = hgr; hg.beginPath(); hg.ellipse(x + dx, y + dy, rr, rr * 0.7, a, 0, 7); hg.fill();
    }
  }
  const hd = hg.getImageData(0, 0, S, S).data, H = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) H[i] = hd[i * 4] / 255;
  const map = canvasTex(c, { aniso }), normal = heightToNormal(H, S, S, 2.0); normal.anisotropy = aniso;
  return { map, normal };
}
function greenTex(aniso) {
  const S = 256, r = makeRng(101), n1 = makeNoise(102, 16), n2 = makeNoise(103, 128);
  const o = gen(S, (x, y) => {
    const u = x / S, v = y / S, a = fbm(n1, u, v, 4, 4), f = n2(u * 128, v * 128), q = r();
    const b = 0.5 + (a - 0.5) * 0.5 + (f - 0.5) * 0.5 + (q - 0.5) * 0.25;
    return [b * 70, b * 96, b * 46, f * 0.7 + q * 0.3, 0.9];
  });
  return pack(o, S, 3.5, aniso);
}
// autumn plane-tree clusters: sparse, palmate leaves in ochre / rust / faded olive, visible twigs
function leafTex() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = makeRng(911);
  g.fillStyle = 'rgb(44,30,16)'; g.fillRect(0, 0, S, S);
  const a = makeCanvas(S, S), ag = a.getContext('2d'); ag.fillStyle = '#000'; ag.fillRect(0, 0, S, S);
  const twig = (x0, y0, x1, y1, w) => { for (const [cx, col] of [[g, 'rgb(46,36,26)'], [ag, '#fff']]) { cx.strokeStyle = col; cx.lineWidth = w; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke(); } };
  const subs = [];
  for (let k = 0; k < 7; k++) { const an = r() * 6.283, d = (0.12 + r() * 0.26) * S; subs.push([S / 2 + Math.cos(an) * d, S / 2 + Math.sin(an) * d * 0.9, (0.09 + r() * 0.07) * S]); }
  for (const [sx, sy] of subs) { twig(S / 2, S / 2 + 40, sx, sy, 4); twig(sx, sy, sx + (r() - 0.5) * 70, sy + (r() - 0.5) * 70, 2); }
  const pal = [[156, 112, 40], [170, 128, 52], [128, 78, 34], [104, 62, 30], [150, 136, 66], [96, 90, 44], [182, 150, 70]];
  for (const [sx, sy, sr] of subs) {
    for (let k = 0; k < 64; k++) {
      const an = r() * 6.283, d = Math.pow(r(), 0.7) * sr, x = sx + Math.cos(an) * d, y = sy + Math.sin(an) * d * 0.85;
      const l = 7 + r() * 8, rot = r() * 6.283, p = pal[(r() * pal.length) | 0], lit = (0.62 + r() * 0.45) * (y < sy ? 1.08 : 0.8);
      g.fillStyle = `rgb(${p[0] * lit | 0},${p[1] * lit | 0},${p[2] * lit | 0})`;
      for (const cx of [g, ag]) {
        if (cx === ag) cx.fillStyle = '#fff';
        cx.save(); cx.translate(x, y); cx.rotate(rot);
        for (let lb = -2; lb <= 2; lb++) { cx.beginPath(); cx.ellipse(Math.sin(lb * 0.6) * l * 0.5, -Math.cos(lb * 0.6) * l * 0.45, l * 0.5, l * 0.24, lb * 0.6, 0, 7); cx.fill(); }
        cx.restore();
      }
    }
  }
  // seed balls dangling (plane trees keep them through winter)
  for (let k = 0; k < 9; k++) { const x = 60 + r() * (S - 120), y = 60 + r() * (S - 120); twig(x, y - 14, x, y, 1.5); for (const [cx, col] of [[g, 'rgb(84,60,34)'], [ag, '#fff']]) { cx.fillStyle = col; cx.beginPath(); cx.arc(x, y, 5, 0, 7); cx.fill(); } }
  const id = g.getImageData(0, 0, S, S), ad = ag.getImageData(0, 0, S, S).data;
  for (let i = 0; i < id.data.length; i += 4) id.data[i + 3] = ad[i];
  g.putImageData(id, 0, 0);
  return canvasTex(c, { repeat: false, aniso: 4 });
}

// props atlas rects [x, y, w, h]
export const A = {
  white: [0, 0, 32, 32], bark: [32, 0, 224, 256], bouq: [256, 0, 256, 128], posters: [512, 0, 512, 256],
  shutter: [0, 256, 256, 256], buvette: [256, 128, 256, 64], crepes: [256, 192, 256, 64], billets: [256, 256, 256, 64], secu: [256, 320, 256, 64],
  presse: [256, 384, 256, 128], metro: [512, 256, 512, 96], carousel: [512, 352, 512, 96], carTxt: [512, 448, 512, 64],
  wood: [0, 512, 256, 128], crate: [256, 512, 128, 128], sandbag: [384, 512, 128, 128], window: [512, 512, 128, 128], lantern: [640, 512, 128, 128],
  plaque: [768, 512, 256, 64], quaiSign: [768, 576, 256, 64], truck: [0, 640, 256, 128], souvenir: [256, 640, 256, 128], menu: [512, 640, 128, 128],
  graffiti: [640, 640, 384, 128], poster2: [0, 768, 256, 256], bouq2: [256, 768, 256, 128], mirror: [512, 768, 256, 128], kiosk: [768, 768, 256, 128],
  medal: [256, 896, 128, 128], stripes: [384, 896, 128, 128], bulbs: [512, 896, 256, 64], ticket: [768, 896, 256, 64],
};
function propsAtlas() {
  const c = makeCanvas(PA, PA), g = c.getContext('2d'), r = makeRng(1201), nz = makeNoise(1202, 32);
  g.fillStyle = '#fff'; g.fillRect(0, 0, PA, PA);
  const txt = (s, x, y, size, col, font = FONT, maxW = 0, weight = 400) => {
    g.font = `${weight} ${size}px ${font}`; if (maxW) { const w = g.measureText(s).width; if (w > maxW) g.font = `${weight} ${Math.floor(size * maxW / w)}px ${font}`; }
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y);
  };
  const grime = (x, y, w, h, n = 60, a = 0.12) => { for (let k = 0; k < n; k++) { const px = x + r() * w, py = y + r() * h, rr = 4 + r() * 18; const gr = g.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, `rgba(20,16,10,${a})`); gr.addColorStop(1, 'rgba(20,16,10,0)'); g.fillStyle = gr; g.fillRect(px - rr, py - rr, rr * 2, rr * 2); } };
  const streaks = (x, y, w, h, n = 20, a = 0.18) => { for (let k = 0; k < n; k++) { const px = x + r() * w, len = h * (0.3 + r() * 0.7); const gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, `rgba(18,14,8,${a})`); gr.addColorStop(1, 'rgba(18,14,8,0)'); g.fillStyle = gr; g.fillRect(px, y, 1 + r() * 3, len); } };
  // plane-tree bark: jigsaw patches of cream / olive / grey / brown
  { const [x0, y0, w, h] = A.bark, img = g.createImageData(w, h), seeds = [];
    for (let k = 0; k < 46; k++) seeds.push([r() * w, r() * h, r()]);
    const pal = [[0.62, 0.6, 0.48], [0.5, 0.5, 0.38], [0.42, 0.42, 0.36], [0.55, 0.48, 0.36], [0.68, 0.66, 0.56], [0.36, 0.36, 0.3]];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let d1 = 1e9, d2 = 1e9, best = 0;
      for (let k = 0; k < seeds.length; k++) { let dx = Math.abs(x - seeds[k][0]); dx = Math.min(dx, w - dx); const dy = (y - seeds[k][1]) * 0.6, d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d; }
      const edge = Math.sqrt(d2) - Math.sqrt(d1), p = pal[(seeds[best][2] * pal.length) | 0], n = nz(x / w * 16, y / h * 16);
      let b = (0.85 + n * 0.3) * (edge < 2 ? 0.55 : 1);
      const i = (y * w + x) * 4; img.data[i] = p[0] * b * 255; img.data[i + 1] = p[1] * b * 255; img.data[i + 2] = p[2] * b * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, x0, y0); }
  // bouquiniste box faces: dark green painted steel, ribs, rivets, worn edges, stickers
  for (const [rect, v] of [[A.bouq, 0], [A.bouq2, 1]]) {
    const [x, y, w, h] = rect; g.fillStyle = '#26402f'; g.fillRect(x, y, w, h);
    for (let k = 0; k < 7; k++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 8 + k * 36, y, 3, h); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x + 11 + k * 36, y, 2, h); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y + h - 10, w, 10); g.fillRect(x, y, w, 6);
    for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(10,14,10,0.6)'; g.beginPath(); g.arc(x + 6 + k * 8.4, y + 12, 1.6, 0, 7); g.fill(); g.beginPath(); g.arc(x + 6 + k * 8.4, y + h - 14, 1.6, 0, 7); g.fill(); }
    for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(${90 + r() * 40 | 0},${60 + r() * 30 | 0},${30 + r() * 20 | 0},${0.3 + r() * 0.4})`; g.fillRect(x + r() * w, y + (r() < 0.5 ? r() * 10 : h - r() * 14), 1 + r() * 4, 1 + r() * 2); }
    streaks(x, y + 10, w, h - 10, 26, 0.22); grime(x, y, w, h, 40, 0.14);
    if (v) { g.fillStyle = '#cdbf9c'; g.fillRect(x + 150, y + 30, 46, 60); g.fillStyle = '#7a2a1c'; g.fillRect(x + 154, y + 36, 38, 10); txt('LIVRES', x + 173, y + 64, 12, '#2a1a10', FONT2); g.fillStyle = '#d8d2c2'; g.fillRect(x + 40, y + 44, 28, 20); }
    else { g.fillStyle = '#b9a77a'; g.fillRect(x + 60, y + 40, 40, 30); txt('ESTAMPES', x + 80, y + 55, 9, '#2a1a10', FONT2); }
  }
  // Morris column posters (wrap): four fictional bills
  { const [x, y, w, h] = A.posters, pw = w / 4;
    const P = [['LA NUIT', 'OPÉRA BASTIEN', '#1b1c3a', '#d8c27a'], ['BLAST RADIUS', 'AU CINÉMA', '#3a1208', '#ffb04a'], ['CIRQUE D\'HIVER', 'DERNIÈRES', '#5a1414', '#f0e0c0'], ['JAZZ', 'CAVEAU DES QUAIS', '#0f2a2a', '#e6d9a8']];
    P.forEach(([t1, t2, bg, fg], i) => {
      const px = x + i * pw; g.fillStyle = bg; g.fillRect(px + 3, y + 6, pw - 6, h - 12);
      const gr = g.createRadialGradient(px + pw / 2, y + 120, 0, px + pw / 2, y + 120, 70); gr.addColorStop(0, fg + '88'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px, y + 40, pw, 160);
      txt(t1, px + pw / 2, y + 40, 26, fg, FONT, pw - 14); txt(t2, px + pw / 2, y + h - 34, 13, fg, FONT2, pw - 14);
      g.fillStyle = fg + '55'; g.fillRect(px + 20, y + 80, pw - 40, 2); g.fillRect(px + 20, y + 170, pw - 40, 2);
      grime(px, y, pw, h, 20, 0.2);
    });
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(x + k * pw, y, 3, h); }
  // roller shutter: corrugated steel, faded tags
  { const [x, y, w, h] = A.shutter; g.fillStyle = '#7d8084'; g.fillRect(x, y, w, h);
    for (let k = 0; k < h; k += 8) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + k, w, 2); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y + k + 3, w, 1); }
    g.save(); g.globalAlpha = 0.55; g.lineWidth = 7; g.lineCap = 'round'; for (const col of ['#5a6a8a', '#8a4a4a', '#3a3a3a']) { g.strokeStyle = col; g.beginPath(); let px = x + 20 + r() * 60, py = y + 120 + r() * 80; g.moveTo(px, py); for (let s = 0; s < 8; s++) { px += 12 + r() * 20; py += (r() - 0.5) * 50; g.lineTo(px, py); } g.stroke(); } g.restore();
    grime(x, y, w, h, 50, 0.16); streaks(x, y, w, h, 30, 0.2); }
  // signs
  const sign = (rect, t, bg, fg, sub = null, font = FONT) => { const [x, y, w, h] = rect; g.fillStyle = bg; g.fillRect(x, y, w, h); g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, w - 10, h - 10); txt(t, x + w / 2, y + h / 2 + (sub ? -6 : 2), sub ? 30 : 38, fg, font, w - 30); if (sub) txt(sub, x + w / 2, y + h - 14, 12, fg, FONT2, w - 30); grime(x, y, w, h, 10, 0.12); };
  sign(A.buvette, 'BUVETTE DU QUAI', '#1d3a2c', '#efe2b8', 'BIÈRES · VINS · GUINGUETTE');
  sign(A.crepes, 'CRÊPES · GAUFRES', '#6a1a14', '#f6e6c4', 'NUTELLA · SUCRE · CITRON');
  sign(A.billets, 'BILLETTERIE', '#1d2a3a', '#e8e4d8', 'SOMMET · 2e ÉTAGE');
  sign(A.secu, 'SÉCURITÉ', '#2a2a2c', '#e8e8e8', 'CONTRÔLE DES SACS');
  sign(A.ticket, 'TICKETS · 3 €', '#5a1218', '#f4dca0');
  // newspaper kiosk panel: rows of magazines
  { const [x, y, w, h] = A.presse; g.fillStyle = '#183224'; g.fillRect(x, y, w, h);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 7; k++) { const hue = r(); g.fillStyle = `hsl(${(hue * 360) | 0},${25 + r() * 25 | 0}%,${35 + r() * 30 | 0}%)`; g.fillRect(x + 6 + k * 35, y + 6 + row * 40, 31, 36); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x + 9 + k * 35, y + 10 + row * 40, 25, 5); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + 9 + k * 35, y + 20 + row * 40, 18, 2); } }
  // MÉTROPOLITAIN (Art Nouveau cartouche)
  { const [x, y, w, h] = A.metro; g.fillStyle = '#1c3324'; g.fillRect(x, y, w, h); g.fillStyle = '#d6c79a'; g.fillRect(x + 20, y + 14, w - 40, h - 28); g.strokeStyle = '#1c3324'; g.lineWidth = 4; g.strokeRect(x + 26, y + 20, w - 52, h - 40);
    txt('METROPOLITAIN', x + w / 2, y + h / 2 + 2, 46, '#1c3324', SERIF, w - 80, 700); }
  // carousel frieze: painted panels, mirrors, gilt
  { const [x, y, w, h] = A.carousel; g.fillStyle = '#7a1c1a'; g.fillRect(x, y, w, h);
    for (let k = 0; k < 8; k++) { const px = x + k * 64; g.fillStyle = '#c89a3a'; g.fillRect(px + 2, y + 4, 60, h - 8); g.fillStyle = k % 2 ? '#f0e3c0' : '#2a4a6a'; g.fillRect(px + 7, y + 10, 50, h - 20);
      if (k % 2) { g.fillStyle = '#c84a3a'; g.beginPath(); g.ellipse(px + 32, y + h / 2, 14, 24, 0, 0, 7); g.fill(); } else { const gr = g.createLinearGradient(px, y, px + 64, y + h); gr.addColorStop(0, '#9ab4c8'); gr.addColorStop(0.5, '#e8f0f4'); gr.addColorStop(1, '#6a8aa0'); g.fillStyle = gr; g.fillRect(px + 12, y + 16, 40, h - 32); } }
    g.fillStyle = '#e8c868'; for (let k = 0; k < 32; k++) { g.beginPath(); g.arc(x + 8 + k * 16, y + 3, 2.5, 0, 7); g.fill(); g.beginPath(); g.arc(x + 8 + k * 16, y + h - 3, 2.5, 0, 7); g.fill(); } }
  { const [x, y, w, h] = A.carTxt; g.fillStyle = '#7a1c1a'; g.fillRect(x, y, w, h); g.fillStyle = '#c89a3a'; g.fillRect(x, y, w, 5); g.fillRect(x, y + h - 5, w, 5); txt('CARROUSEL  ·  1900  ·  MANÈGE', x + w / 2, y + h / 2 + 2, 34, '#f2d890', SERIF, w - 30, 700); }
  { const [x, y, w, h] = A.mirror; const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#f4dc9a'); gr.addColorStop(0.5, '#fff6dc'); gr.addColorStop(1, '#d8a850'); g.fillStyle = gr; g.fillRect(x, y, w, h); for (let k = 0; k < 4; k++) { g.strokeStyle = '#8a5a20'; g.lineWidth = 4; g.strokeRect(x + 4 + k * 64, y + 4, 56, h - 8); } }
  { const [x, y, w, h] = A.bulbs; g.fillStyle = '#3a1a10'; g.fillRect(x, y, w, h); for (let k = 0; k < 16; k++) { const gr = g.createRadialGradient(x + 8 + k * 16, y + h / 2, 0, x + 8 + k * 16, y + h / 2, 8); gr.addColorStop(0, '#fff8e0'); gr.addColorStop(0.5, '#ffc860'); gr.addColorStop(1, '#3a1a10'); g.fillStyle = gr; g.fillRect(x + k * 16, y, 16, h); } }
  // weathered wood planks
  { const [x, y, w, h] = A.wood; for (let k = 0; k < 8; k++) { const t = 0.7 + r() * 0.35; g.fillStyle = `rgb(${120 * t | 0},${92 * t | 0},${64 * t | 0})`; g.fillRect(x, y + k * 16, w, 16); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(x, y + k * 16, w, 2); for (let s = 0; s < 14; s++) { g.fillStyle = `rgba(40,28,16,${0.15 + r() * 0.2})`; g.fillRect(x + r() * w, y + k * 16 + 3 + r() * 10, 20 + r() * 60, 1); } g.fillStyle = 'rgba(20,20,20,0.6)'; g.fillRect(x + 20 + r() * 10, y + k * 16 + 7, 3, 3); g.fillRect(x + w - 30, y + k * 16 + 7, 3, 3); } grime(x, y, w, h, 20, 0.15); }
  { const [x, y, w, h] = A.crate; g.fillStyle = '#8a6a44'; g.fillRect(x, y, w, h); g.strokeStyle = '#5a4228'; g.lineWidth = 10; g.strokeRect(x + 5, y + 5, w - 10, h - 10); g.beginPath(); g.moveTo(x + 8, y + 8); g.lineTo(x + w - 8, y + h - 8); g.stroke(); txt('FRAGILE', x + w / 2, y + 40, 16, 'rgba(30,20,10,0.75)', FONT2); txt('QUAI 7', x + w / 2, y + 92, 18, 'rgba(30,20,10,0.6)'); grime(x, y, w, h, 12, 0.18); }
  { const [x, y, w, h] = A.sandbag; g.fillStyle = '#8a7c5c'; g.fillRect(x, y, w, h); for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(${r() < 0.5 ? 60 : 150},${r() < 0.5 ? 50 : 130},30,0.25)`; g.fillRect(x + r() * w, y + r() * h, 2, 2); } for (let k = 0; k < h; k += 4) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, y + k, w, 1); } grime(x, y, w, h, 16, 0.2); }
  { const [x, y, w, h] = A.window; const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#ffd890'); gr.addColorStop(0.6, '#e89a48'); gr.addColorStop(1, '#6a3a18'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(40,20,10,0.5)'; g.fillRect(x + 20, y + 60, 30, 68); g.fillRect(x + 80, y + 40, 20, 88); }
  { const [x, y, w, h] = A.lantern; const gr = g.createRadialGradient(x + w / 2, y + h * 0.55, 2, x + w / 2, y + h * 0.55, w * 0.62); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.35, '#ffd890'); gr.addColorStop(0.8, '#c27a30'); gr.addColorStop(1, '#5a3010'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(30,20,10,0.6)'; g.fillRect(x + w / 2 - 2, y, 4, h); }
  { const [x, y, w, h] = A.plaque; g.fillStyle = '#3a3630'; g.fillRect(x, y, w, h); g.strokeStyle = '#b89a5a'; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, w - 10, h - 10); txt('PONT SAINT-AUBIN  ·  MDCCCXCVII', x + w / 2, y + h / 2 + 2, 22, '#c8aa6a', SERIF, w - 24, 700); }
  { const [x, y, w, h] = A.quaiSign; g.fillStyle = '#1a3a6a'; g.fillRect(x, y, w, h); g.strokeStyle = '#2a6a4a'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, h - 6); g.strokeStyle = '#e8e8e8'; g.lineWidth = 2; g.strokeRect(x + 9, y + 9, w - 18, h - 18); txt('7e Arrt', x + 36, y + h / 2, 11, '#e8e8e8', FONT2); txt('QUAI DES BRUMES', x + w / 2 + 16, y + h / 2 + 2, 26, '#f0f0f0', FONT2, w - 90); }
  { const [x, y, w, h] = A.truck; g.fillStyle = '#d6d6d0'; g.fillRect(x, y, w, h); g.fillStyle = '#2a5a3a'; g.fillRect(x, y + 70, w, 20); txt('SERVICE DES QUAIS', x + w / 2, y + 40, 26, '#2a5a3a', FONT2, w - 20); txt('VOIRIE · 75', x + w / 2, y + 108, 14, '#333', FONT2); grime(x, y, w, h, 40, 0.18); streaks(x, y + 90, w, 38, 20, 0.2); }
  { const [x, y, w, h] = A.souvenir; g.fillStyle = '#2a2420'; g.fillRect(x, y, w, h); for (let k = 0; k < 10; k++) { g.fillStyle = '#c8a050'; g.beginPath(); g.moveTo(x + 14 + k * 24, y + 60); g.lineTo(x + 6 + k * 24, y + 60); g.lineTo(x + 10 + k * 24, y + 14); g.fill(); } for (let k = 0; k < 9; k++) { g.fillStyle = `hsl(${r() * 360 | 0},30%,${55 + r() * 20 | 0}%)`; g.fillRect(x + 8 + k * 27, y + 72, 22, 30); } txt('SOUVENIRS DE PARIS', x + w / 2, y + 116, 14, '#f0d890', FONT2); }
  { const [x, y, w, h] = A.menu; g.fillStyle = '#1e2220'; g.fillRect(x, y, w, h); g.strokeStyle = '#8a6a40'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, h - 6); txt('FERMÉ', x + w / 2, y + 26, 24, '#e8e4d8', SERIF); for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(230,230,220,0.6)'; g.fillRect(x + 18, y + 48 + k * 12, 60 + r() * 30, 2); } }
  { const [x, y, w, h] = A.graffiti; g.clearRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,0)'; g.fillRect(x, y, w, h); g.save(); g.lineCap = 'round'; for (let k = 0; k < 5; k++) { g.strokeStyle = ['rgba(70,80,110,0.7)', 'rgba(120,60,60,0.6)', 'rgba(40,40,40,0.75)', 'rgba(150,150,150,0.5)'][k % 4]; g.lineWidth = 5 + r() * 6; g.beginPath(); let px = x + 20 + k * 70, py = y + 40 + r() * 50; g.moveTo(px, py); for (let s = 0; s < 6; s++) { px += 8 + r() * 14; py += (r() - 0.5) * 60; g.quadraticCurveTo(px - 10, py - 20, px, py); } g.stroke(); } g.restore(); }
  { const [x, y, w, h] = A.poster2; g.fillStyle = '#101418'; g.fillRect(x, y, w, h); const gr = g.createRadialGradient(x + 128, y + 150, 0, x + 128, y + 150, 120); gr.addColorStop(0, '#ffd27a'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillStyle = '#0a0a0a'; g.beginPath(); g.moveTo(x + 128, y + 40); g.lineTo(x + 100, y + 230); g.lineTo(x + 156, y + 230); g.fill(); txt('LA DAME DE FER', x + 128, y + 26, 26, '#f2e6c8', FONT, w - 20); txt('SON & LUMIÈRE · 21H', x + 128, y + 244, 14, '#f2e6c8', FONT2); }
  { const [x, y, w, h] = A.kiosk; g.fillStyle = '#183224'; g.fillRect(x, y, w, h); g.fillStyle = '#d8c48a'; g.fillRect(x + 8, y + 8, w - 16, 40); txt('KIOSQUE · PRESSE', x + w / 2, y + 28, 26, '#183224', SERIF, w - 30, 700); for (let k = 0; k < 4; k++) { g.fillStyle = `hsl(${r() * 360 | 0},20%,45%)`; g.fillRect(x + 12 + k * 60, y + 58, 52, 62); } }
  { const [x, y, w, h] = A.medal; g.fillStyle = '#8a8478'; g.fillRect(x, y, w, h); g.strokeStyle = '#5a564c'; g.lineWidth = 10; g.beginPath(); g.arc(x + 64, y + 64, 50, 0, 7); g.stroke(); txt('RF', x + 64, y + 66, 44, '#5a564c', SERIF, 0, 700); }
  { const [x, y, w, h] = A.stripes; for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#e8e0cc' : '#2a4a3a'; g.fillRect(x + k * 16, y, 16, h); } grime(x, y, w, h, 20, 0.2); }
  return canvasTex(c, { repeat: false, aniso: 8 });
}

// ground decal atlas (RGBA)
export const D = {
  line: [0, 0, 512, 64], line2: [512, 0, 512, 64], puddle: [0, 64, 256, 256], puddle2: [256, 64, 256, 256], leaves: [512, 64, 256, 256], leaves2: [768, 64, 256, 256],
  ao: [0, 320, 256, 256], oil: [256, 320, 256, 256], streak: [512, 320, 128, 512], streak2: [640, 320, 128, 512], manhole: [768, 320, 256, 256], grate: [768, 576, 256, 256],
  drain: [0, 576, 256, 128], graffiti: [0, 704, 512, 192], moss: [256, 576, 256, 128], crack: [512, 832, 256, 192], aoRect: [768, 832, 256, 192],
};
function decalAtlas() {
  const S = DA, c = makeCanvas(S, S), g = c.getContext('2d'), r = makeRng(1301), n = makeNoise(1302, 32);
  g.clearRect(0, 0, S, S);
  const alphaFill = (rect, fn) => { const [x0, y0, w, h] = rect, img = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = fn(x / w, y / h), i = (y * w + x) * 4; img.data[i] = o[0]; img.data[i + 1] = o[1]; img.data[i + 2] = o[2]; img.data[i + 3] = o[3] * 255; } g.putImageData(img, x0, y0); };
  for (const [rect, sd] of [[D.line, 0], [D.line2, 3.7]]) alphaFill(rect, (u, v) => { const wear = fbm(n, u * 4 + sd, v * 0.5 + sd, 8, 4), edge = 1 - Math.pow(Math.abs(v - 0.5) * 2, 8); const a = Math.min(1, Math.max(0, (wear - 0.34) * 3.5)) * edge * (0.7 + r() * 0.3); return [236, 234, 226, a * 0.9]; });
  for (const [rect, sd] of [[D.puddle, 0], [D.puddle2, 5.3]]) alphaFill(rect, (u, v) => { const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2, d = Math.hypot(dx, dy); const e = d + (fbm(n, u + sd, v + sd, 3, 4) - 0.5) * 1.1; const a = Math.min(1, Math.max(0, (0.72 - e) * 5)) * 0.95 + Math.min(1, Math.max(0, (0.95 - e) * 2.5)) * 0.05; return [255, 255, 255, a]; });
  alphaFill(D.ao, (u, v) => { const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2, d = Math.hypot(dx, dy); return [0, 0, 0, Math.pow(Math.max(0, 1 - d), 1.6) * 0.85]; });
  alphaFill(D.aoRect, (u, v) => { const dx = Math.max(0, Math.abs(u - 0.5) * 2 - 0.55) / 0.45, dy = Math.max(0, Math.abs(v - 0.5) * 2 - 0.45) / 0.55, d = Math.min(1, Math.hypot(dx, dy)); return [0, 0, 0, Math.pow(1 - d, 1.5) * 0.8]; });
  alphaFill(D.oil, (u, v) => { const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2, d = Math.hypot(dx, dy); const f = fbm(n, u * 2 + 9, v * 2 + 1, 3, 4); return [10, 9, 8, Math.max(0, Math.min(1, (f - d * 0.6 - 0.05) * 3)) * 0.75]; });
  alphaFill(D.moss, (u, v) => { const f = fbm(n, u * 3 + 2, v + 4, 4, 4); return [30, 42, 22, Math.max(0, Math.min(1, (f - 0.45) * 3)) * (1 - v) * 0.8]; });
  for (const [rect, tint] of [[D.streak, [14, 12, 10]], [D.streak2, [16, 24, 14]]]) alphaFill(rect, (u, v) => { const col = fbm(n, u * 6 + tint[1], 0.3, 4, 3), band = Math.max(0, col - 0.42) * 3; const fade = Math.pow(1 - v, 1.4) * Math.sin(Math.min(1, u * 1.0) * Math.PI); return [tint[0], tint[1], tint[2], Math.min(1, band * fade * (0.6 + 0.4 * fbm(n, u * 20, v * 3, 3, 2))) * 0.8]; });
  // leaf litter: scattered palmate leaves
  for (const rect of [D.leaves, D.leaves2]) { const [x0, y0, w, h] = rect; for (let k = 0; k < 160; k++) { const d = Math.pow(r(), 0.6) * w * 0.46, a = r() * 7, x = x0 + w / 2 + Math.cos(a) * d, y = y0 + h / 2 + Math.sin(a) * d, l = 5 + r() * 6, t = 0.6 + r() * 0.5; const p = [[140, 96, 40], [110, 66, 30], [160, 128, 60], [84, 56, 30]][(r() * 4) | 0]; g.fillStyle = `rgba(${p[0] * t | 0},${p[1] * t | 0},${p[2] * t | 0},${0.75 + r() * 0.25})`; g.save(); g.translate(x, y); g.rotate(r() * 7); for (let lb = -2; lb <= 2; lb++) { g.beginPath(); g.ellipse(Math.sin(lb * 0.6) * l * 0.5, -Math.cos(lb * 0.6) * l * 0.45, l * 0.5, l * 0.24, lb * 0.6, 0, 7); g.fill(); } g.restore(); } }
  // manhole
  { const [x, y, w] = D.manhole, cx = x + w / 2, cy = y + w / 2, R = w / 2 - 6; g.fillStyle = '#2a2826'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); g.strokeStyle = '#151413'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, R - 4, 0, 7); g.stroke(); g.strokeStyle = '#403c37'; g.lineWidth = 5; for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(cx, cy, k * 22, 0, 7); g.stroke(); } for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.beginPath(); g.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22); g.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); g.stroke(); } g.fillStyle = '#4c4843'; g.font = `700 18px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ÉGOUTS', cx, cy); }
  // tree grate (cast iron, radial slots)
  { const [x, y, w] = D.grate, cx = x + w / 2, cy = y + w / 2; g.fillStyle = 'rgba(28,26,24,1)'; g.fillRect(x + 4, y + 4, w - 8, w - 8); g.fillStyle = '#070606'; for (let k = 1; k <= 5; k++) for (let a = 0; a < 36; a++) { const an = a / 36 * 6.283, rr = 26 + k * 19; g.save(); g.translate(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); g.rotate(an); g.fillRect(-6, -2.2, 12, 4.4); g.restore(); } g.fillStyle = '#100d0b'; g.beginPath(); g.arc(cx, cy, 28, 0, 7); g.fill(); g.strokeStyle = '#3a3633'; g.lineWidth = 6; g.strokeRect(x + 6, y + 6, w - 12, w - 12); }
  { const [x, y, w, h] = D.drain; g.fillStyle = '#24221f'; g.fillRect(x + 4, y + 8, w - 8, h - 16); g.fillStyle = '#050505'; for (let k = 0; k < 13; k++) g.fillRect(x + 16 + k * 17.5, y + 18, 9, h - 36); }
  { const [x, y, w, h] = D.graffiti; g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; for (let k = 0; k < 6; k++) { g.strokeStyle = ['rgba(60,70,100,0.75)', 'rgba(110,50,50,0.6)', 'rgba(30,30,30,0.8)', 'rgba(140,140,140,0.55)', 'rgba(90,90,60,0.6)'][k % 5]; g.lineWidth = 6 + r() * 8; g.beginPath(); let px = x + 20 + k * 78, py = y + 60 + r() * 70; g.moveTo(px, py); for (let s = 0; s < 7; s++) { const qx = px + 6 + r() * 16, qy = py + (r() - 0.5) * 90; g.quadraticCurveTo(px + (r() - 0.5) * 30, py - 40 * r(), qx, qy); px = qx; py = Math.max(y + 20, Math.min(y + h - 20, qy)); } g.stroke(); } g.restore(); }
  { const [x, y, w, h] = D.crack; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); for (let k = 0; k < 3; k++) { let px = x + w / 2, py = y + h / 2, a = r() * 7; g.strokeStyle = 'rgba(10,10,10,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); for (let s = 0; s < 26; s++) { a += (r() - 0.5) * 0.7; px += Math.cos(a) * 6; py += Math.sin(a) * 6; g.lineTo(px, py); } g.stroke(); } g.restore(); }
  return canvasTex(c, { repeat: false, aniso: 8 });
}

let TEX = null;
export function textures(renderer) {
  if (TEX) return TEX;
  const aniso = renderer?.capabilities?.getMaxAnisotropy?.() || 8;
  TEX = { stone: stoneTex(aniso), cobble: cobbleTex(aniso), asph: asphaltTex(aniso), gravel: gravelTex(aniso), green: greenTex(aniso), leaf: leafTex(), atlas: propsAtlas(), decal: decalAtlas() };
  TEX.decal.anisotropy = aniso;
  return TEX;
}
let MAT = null;
export function materials(renderer) {
  if (MAT) return MAT;
  const T = textures(renderer), V = (k) => new THREE.Vector2(k, k);
  MAT = {
    stone: bakedMat({ map: T.stone.map, normalMap: T.stone.normal, normalScale: V(0.9), roughnessMap: T.stone.rough, envMapIntensity: 0.7 }),
    cobble: bakedMat({ map: T.cobble.map, normalMap: T.cobble.normal, normalScale: V(1.0), roughnessMap: T.cobble.rough, envMapIntensity: 1.15 }),
    asph: bakedMat({ map: T.asph.map, normalMap: T.asph.normal, normalScale: V(0.6), roughnessMap: T.asph.rough, envMapIntensity: 1.15 }),
    gravel: bakedMat({ map: T.gravel.map, normalMap: T.gravel.normal, normalScale: V(0.8), envMapIntensity: 0.6 }),
    green: bakedMat({ map: T.green.map, normalMap: T.green.normal, normalScale: V(1.0), envMapIntensity: 0.25 }),
    props: bakedMat({ map: T.atlas, envMapIntensity: 1.0 }),
    leaves: bakedMat({ map: T.leaf, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.2 }, { leaves: true }),
    decal: bakedMat({ map: T.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMapIntensity: 0.6 }),
    puddle: bakedMat({ map: T.decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, envMapIntensity: 1.7 }),
  };
  return MAT;
}
