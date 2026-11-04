import * as THREE from 'three';
import { makeCanvas, canvasTex, makeNoise, fbm, glowTexture } from '../../textures.js';
import { makeRng } from '../../rng.js';
import { SNIPERS, PARK, QUAY_N, QUAY_S, TOWER } from './layout.js';

// =====================================================================================
//  PARIS — the Haussmann frontage on both banks of the Seine, the park's flanking blocks,
//  the snipers' 5th-floor balconies and far Paris (roofscape, a floodlit basilica on its hill
//  to the NNE, a gilded dome to the ESE, the warm haze of a city at night).
//
//  Draw calls: stone, rustic stone, windows/shops atlas, wrought iron (alpha rails), zinc,
//  awning canvas, far city (procedural windows), landmarks (floodlit, unlit), haze band = 9.
//  Everything is merged per material across every building. Colliders are world space.
// =====================================================================================

const FL_MAIN = [            // the river frontages: shops, entresol, 5 storeys; continuous balconies at 9.8 and 19.2
  { k: 'shop', y0: 0, y1: 4.0 },
  { k: 'ent', y0: 4.0, y1: 6.6 },
  { k: 'noble', y0: 6.6, y1: 9.8 },
  { k: 'balc', y0: 9.8, y1: 13.0 },
  { k: 'std', y0: 13.0, y1: 16.1 },
  { k: 'std', y0: 16.1, y1: 19.2, top: true },
  { k: 'balc', y0: 19.2, y1: 22.2 },
];
const FL_LOW = [             // the park's flanking blocks: one storey less, no entresol
  { k: 'shop', y0: 0, y1: 4.2 },
  { k: 'noble', y0: 4.2, y1: 7.4 },
  { k: 'balc', y0: 7.4, y1: 10.5 },
  { k: 'std', y0: 10.5, y1: 13.5, top: true },
  { k: 'balc', y0: 13.5, y1: 16.5 },
];
const BALC_D = 1.1;          // continuous balcony projection (north: z 78 -> 76.9)
const RAIL_H = 1.05;
const REVEAL = 0.28;

// ------------------------------------------------------------------ geometry batch
class Batch {
  constructor(extra = 0) { this.P = []; this.N = []; this.U = []; this.C = []; this.I = []; this.X = extra ? [] : null; this.xs = extra; this.cur = [0, 0, 0]; }
  get count() { return this.P.length / 3; }
  v(p, n, u, vv, c) {
    this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.U.push(u, vv); this.C.push(c[0], c[1], c[2]);
    if (this.X) for (let k = 0; k < this.xs; k++) this.X.push(this.cur[k]);
  }
  // quad from 4 points (p0 p1 along the bottom, p3 p2 along the top), uv [u0 v0 u1 v1], colours bottom / top
  quad4(p0, p1, p2, p3, uv, c0, c1 = c0) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p3[0] - p0[0], by = p3[1] - p0[1], bz = p3[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1; const n = [nx / l, ny / l, nz / l];
    const i = this.count;
    this.v(p0, n, uv[0], uv[1], c0); this.v(p1, n, uv[2], uv[1], c0); this.v(p2, n, uv[2], uv[3], c1); this.v(p3, n, uv[0], uv[3], c1);
    this.I.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  quad(o, a, b, uv, c0, c1 = c0) {
    this.quad4(o, [o[0] + a[0], o[1] + a[1], o[2] + a[2]], [o[0] + a[0] + b[0], o[1] + a[1] + b[1], o[2] + a[2] + b[2]], [o[0] + b[0], o[1] + b[1], o[2] + b[2]], uv, c0, c1);
  }
  tri(a, b, c, uvs, col) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...n) || 1; n = n.map(q => q / l);
    const i = this.count;
    this.v(a, n, uvs[0], uvs[1], col); this.v(b, n, uvs[2], uvs[3], col); this.v(c, n, uvs[4], uvs[5], col);
    this.I.push(i, i + 1, i + 2);
  }
  // world axis-aligned box, uv in world metres / T; skip = faces to omit (x X y Y z Z); col(c, normal) optional per-face colour
  box(x0, y0, z0, x1, y1, z1, o = {}) {
    if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
    const T = o.T || 4, sk = o.skip || '', c0 = o.c0 || o.c || WHITE, c1 = o.c1 || c0, ct = o.ct || c1, cb = o.cb || c0;
    const U = o.uv;
    const uvF = (a0, a1, b0, b1) => U || [a0 / T, b0 / T, a1 / T, b1 / T];
    if (!sk.includes('Z')) this.quad([x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], uvF(x0, x1, y0, y1), c0, c1);
    if (!sk.includes('z')) this.quad([x1, y0, z0], [x0 - x1, 0, 0], [0, y1 - y0, 0], uvF(-x1, -x0, y0, y1), c0, c1);
    if (!sk.includes('X')) this.quad([x1, y0, z1], [0, 0, z0 - z1], [0, y1 - y0, 0], uvF(-z1, -z0, y0, y1), c0, c1);
    if (!sk.includes('x')) this.quad([x0, y0, z0], [0, 0, z1 - z0], [0, y1 - y0, 0], uvF(z0, z1, y0, y1), c0, c1);
    if (!sk.includes('Y')) this.quad([x0, y1, z1], [x1 - x0, 0, 0], [0, 0, z0 - z1], uvF(x0, x1, -z1, -z0), ct, ct);
    if (!sk.includes('y')) this.quad([x0, y0, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], uvF(x0, x1, z0, z1), cb, cb);
  }
  // append a THREE geometry transformed by matrix m, solid colour, uv * uvS
  geo(g, m, c, uvS = 1, uvO = null) {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), base = this.count;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); const p = [v.x, v.y, v.z];
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); const n = [v.x, v.y, v.z];
      const cc = typeof c === 'function' ? c(p, n) : c;
      if (uvO) this.v(p, n, uvO[0], uvO[1], cc); else this.v(p, n, uv.getX(i) * uvS, uv.getY(i) * uvS, cc);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.I.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) this.I.push(base + i);
  }
  geometry(extraName) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    if (this.X) g.setAttribute(extraName || 'aF', new THREE.Float32BufferAttribute(this.X, this.xs));
    g.setIndex(this.I);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  get tris() { return this.I.length / 3; }
}
const WHITE = [1, 1, 1];
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ------------------------------------------------------------------ faces
// A facade face: outward normal n (axis), plane coordinate `at`. Local coords: s along the face
// (along = (nz, 0, -nx), so along x up = n), d outward from the wall plane, y up.
function mkFace(n, at) {
  const [nx, nz] = n;
  const along = [nz, -nx];
  return { nx, nz, ax: along[0], az: along[1], at, P: (s, d, y) => (nx !== 0 ? [at + nx * d, y, s * along[1]] : [s * along[0], y, at + nz * d]) };
}
// local -> world (s is measured so that world = along * s on the face plane)
function LP(f, s, d, y) { return f.P(s, d, y); }
// wall quad on face f from s0..s1 (s0 < s1), y0..y1 at outward offset d; uv world / T
function wq(B, f, s0, s1, y0, y1, d, c0, c1, T = 4, uv = null) {
  if (s1 - s0 < 1e-4 || y1 - y0 < 1e-4) return;
  const o = LP(f, s0, d, y0);
  const a = [f.ax * (s1 - s0), 0, f.az * (s1 - s0)];
  B.quad(o, a, [0, y1 - y0, 0], uv || [s0 / T, y0 / T, s1 / T, y1 / T], c0, c1);
}
// local box (s, d, y ranges) -> world AABB box
function lbox(B, f, s0, s1, d0, d1, y0, y1, o) {
  const a = LP(f, s0, d0, y0), b = LP(f, s1, d1, y1);
  B.box(a[0], a[1], a[2], b[0], b[1], b[2], o);
}
// window recess: jambs, head, sill (stone), then the window quad (atlas tile) at depth -R
function recess(B, f, s0, s1, y0, y1, R, c) {
  const n = [f.nx, 0, f.nz], al = [f.ax, 0, f.az], w = s1 - s0, h = y1 - y0, T = 4;
  const cIn = mul(c, 0.52), cHead = mul(c, 0.38), cSill = mul(c, 0.7);
  // left jamb (normal +along)
  B.quad(LP(f, s0, 0, y0), mul(n, -R), [0, h, 0], [0, y0 / T, R / T, y1 / T], cIn, mul(cIn, 0.8));
  // right jamb (normal -along)
  B.quad(LP(f, s1, -R, y0), mul(n, R), [0, h, 0], [0, y0 / T, R / T, y1 / T], cIn, mul(cIn, 0.8));
  // head soffit (normal down)
  B.quad(LP(f, s0, -R, y1), mul(al, w), mul(n, R), [s0 / T, 0, s1 / T, R / T], cHead, cHead);
  // sill (normal up)
  B.quad(LP(f, s0, 0, y0), mul(al, w), mul(n, -R), [s0 / T, 0, s1 / T, R / T], cSill, cSill);
}
// a tile quad (windows atlas) on face f
function tileQuad(B, f, s0, s1, y0, y1, d, tile, k = 1, flip = false) {
  const t = tile;
  const uv = flip ? [t[2], t[1], t[0], t[3]] : t;
  const o = LP(f, s0, d, y0);
  B.quad(o, [f.ax * (s1 - s0), 0, f.az * (s1 - s0)], [0, y1 - y0, 0], uv, [k, k, k], [k, k, k]);
}
// extrude a (d, y) profile along s0..s1 on face f (profile bottom -> out -> up -> back in), with end caps
function extrude(B, f, s0, s1, prof, cFn, T = 4, caps = true) {
  const al = [f.ax * (s1 - s0), 0, f.az * (s1 - s0)];
  let acc = 0;
  for (let i = 0; i < prof.length - 1; i++) {
    const [d0, y0] = prof[i], [d1, y1] = prof[i + 1];
    const L = Math.hypot(d1 - d0, y1 - y0);
    const o = LP(f, s0, d0, y0), p = LP(f, s0, d1, y1);
    const b = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    const nY = (d1 - d0) === 0 ? 0 : (d1 > d0 ? -1 : 1) * Math.abs(d1 - d0) / L;
    const c = cFn(nY, y0);
    B.quad(o, al, b, [s0 / T, acc / T, s1 / T, (acc + L) / T], c, c);
    acc += L;
  }
  if (!caps) return;
  // end caps: fan from the wall point at the profile's mid height
  const yc = (prof[0][1] + prof[prof.length - 1][1]) / 2;
  for (const [s, sg] of [[s0, -1], [s1, 1]]) {
    const ctr = LP(f, s, 0, yc), c = cFn(0, yc);
    for (let i = 0; i < prof.length - 1; i++) {
      const a = LP(f, s, prof[i][0], prof[i][1]), b = LP(f, s, prof[i + 1][0], prof[i + 1][1]);
      const uvs = [0, yc / T, prof[i][0] / T, prof[i][1] / T, prof[i + 1][0] / T, prof[i + 1][1] / T];
      if (sg > 0) B.tri(ctr, a, b, uvs, mul(c, 0.8)); else B.tri(ctr, b, a, uvs, mul(c, 0.8));
    }
  }
}

// TEMP_BUILDER_START
export async function buildParis() {
  const root = new THREE.Group(); root.name = 'paris';
  const colliders = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0xcdbfa6, roughness: 0.85 });
  const add = (x0, x1, z0, z1, h) => { const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat); g.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); root.add(g); colliders.push({ min: [x0, 0, Math.min(z0, z1)], max: [x1, h, Math.max(z0, z1)], data: { mat: 'concrete' } }); };
  for (let x = -520; x < 520; x += 20) if (Math.abs(x + 10) > 24) add(x, x + 20, 78, 104, 22.2);
  for (let x = -520; x < 520; x += 20) if (Math.abs(x + 10) > 100) add(x, x + 20, -104, -78, 22.2);
  for (const s of [SNIPERS.n1, SNIPERS.n2]) colliders.push({ min: [s.x - 10, 19.2, 76.85], max: [s.x + 10, 20.25, 77.0], data: { mat: 'metal' } });
  return { root, colliders, anchors: { glows: [], reflect: [] }, info: { placeholder: true } };
}
// TEMP_BUILDER_END
