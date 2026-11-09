import * as THREE from 'three';
import { DAY } from './tod.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  Geometry accumulator for the level's merged static meshes. Quads / boxes / cylinders / prisms
//  with per-vertex colour and up to two custom vec4 attributes, flattened into one BufferGeometry
//  per material. A transform stack (matrix) lets builders place parts in local frames.
// =====================================================================================
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();

export class Acc {
  constructor({ cell = false, info = false, rm = false } = {}) {
    this.p = []; this.n = []; this.uv = []; this.c = [];
    this.cell = cell ? [] : null; this.info = info ? [] : null; this.rm = rm ? [] : null;
    this.idx = []; this.vn = 0;
    this.M = null; // optional Matrix4 applied to everything added
    this.col = [1, 1, 1]; this.rmv = [0.8, 0, 0]; this.cellv = [0, 0, 1, 1]; this.infov = [0, 0, 0, 0];
  }
  get tris() { return this.idx.length / 3; }
  // set state for following primitives
  set({ col, rm, cell, info } = {}) { if (col) this.col = col; if (rm) this.rmv = rm; if (cell) this.cellv = cell; if (info) this.infov = info; return this; }
  vert(x, y, z, nx, ny, nz, u, v, col = this.col) {
    if (this.M) { _v.set(x, y, z).applyMatrix4(this.M); x = _v.x; y = _v.y; z = _v.z; _m3.getNormalMatrix(this.M); _n.set(nx, ny, nz).applyMatrix3(_m3).normalize(); nx = _n.x; ny = _n.y; nz = _n.z; }
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(col[0], col[1], col[2]);
    if (this.rm) this.rm.push(...this.rmv);
    if (this.cell) this.cell.push(...this.cellv);
    if (this.info) this.info.push(...this.infov);
    return this.vn++;
  }
  // quad a b c d (counter-clockwise seen from the normal side), uv rect [u0, v0, u1, v1] (a = u0 v0, b = u1 v0, c = u1 v1, d = u0 v1)
  quad(a, b, c, d, uv = [0, 0, 1, 1], col = this.col, cols = null) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, uv[0], uv[1], cols ? cols[0] : col);
    this.vert(b[0], b[1], b[2], nx, ny, nz, uv[2], uv[1], cols ? cols[1] : col);
    this.vert(c[0], c[1], c[2], nx, ny, nz, uv[2], uv[3], cols ? cols[2] : col);
    this.vert(d[0], d[1], d[2], nx, ny, nz, uv[0], uv[3], cols ? cols[3] : col);
    this.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  // axis-aligned box; faces: string of which faces to emit ('xXyYzZ': -x +x -y +y -z +z); uvScale: world metres per uv unit (0 = 0..1 per face)
  box(x0, y0, z0, x1, y1, z1, { faces = 'xXyYzZ', uvScale = 0, col = this.col, bottomDark = 0 } = {}) {
    const u = (a, b) => (uvScale ? [a / uvScale, b / uvScale] : null);
    const cA = col, cB = bottomDark ? col.map(v => v * (1 - bottomDark)) : col;
    const vc = (lo) => (lo ? cB : cA);
    const Q = (a, b, c, d, w, h, lo) => this.quad(a, b, c, d, uvScale ? [0, 0, w / uvScale, h / uvScale] : [0, 0, 1, 1], col, bottomDark ? [vc(lo[0]), vc(lo[1]), vc(lo[2]), vc(lo[3])] : null);
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    if (faces.includes('Z')) Q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], dx, dy, [1, 1, 0, 0]);
    if (faces.includes('z')) Q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], dx, dy, [1, 1, 0, 0]);
    if (faces.includes('X')) Q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], dz, dy, [1, 1, 0, 0]);
    if (faces.includes('x')) Q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], dz, dy, [1, 1, 0, 0]);
    if (faces.includes('Y')) Q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], dx, dz, [0, 0, 0, 0]);
    if (faces.includes('y')) Q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], dx, dz, [1, 1, 1, 1]);
    void u;
  }
  // box centred at (cx, cy, cz) with half sizes, rotated by yaw about y
  obox(cx, cy, cz, hx, hy, hz, yaw = 0, opts = {}) {
    const save = this.M;
    const M = new THREE.Matrix4().makeRotationY(yaw).setPosition(cx, cy, cz);
    this.M = save ? save.clone().multiply(M) : M;
    this.box(-hx, -hy, -hz, hx, hy, hz, opts);
    this.M = save;
  }
  // vertical cylinder (open or capped)
  cyl(cx, y0, cz, r0, r1, y1, seg = 8, { cap = true, col = this.col } = {}) {
    const base = this.vn;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const sl = (r0 - r1) / Math.max(1e-3, y1 - y0);
      const L = Math.hypot(1, sl);
      this.vert(cx + c * r0, y0, cz + s * r0, c / L, sl / L, s / L, i / seg, 0, col);
      this.vert(cx + c * r1, y1, cz + s * r1, c / L, sl / L, s / L, i / seg, 1, col);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    if (cap) { const c0 = this.vert(cx, y1, cz, 0, 1, 0, 0.5, 0.5, col); const b2 = this.vn; for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; this.vert(cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1, 0, 1, 0, 0, 0, col); } for (let i = 0; i < seg; i++) this.idx.push(c0, b2 + i + 1, b2 + i); }
  }
  // a cylinder between two points (pipes, poles, truss members)
  tube(a, b, r, seg = 6, col = this.col) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const save = this.M; const M = new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1));
    this.M = save ? save.clone().multiply(M) : M;
    this.cyl(0, 0, 0, r, r, L, seg, { cap: false, col });
    this.M = save;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.rm) g.setAttribute('rm', new THREE.Float32BufferAttribute(this.rm, 3));
    if (this.cell) g.setAttribute('aCell', new THREE.Float32BufferAttribute(this.cell, 4));
    if (this.info) g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.info, 4));
    g.setIndex(this.vn > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  mesh(mat, { shadow = false, receive = true } = {}) {
    const m = new THREE.Mesh(this.geometry(), mat);
    m.castShadow = shadow; m.receiveShadow = receive;
    return m;
  }
}

// MeshStandardMaterial driven per vertex: roughness / metalness / emissive multiplier from the `rm` attribute
export function rmMat(params = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, emissive: 0xffffff, emissiveIntensity: 1, ...params });
  m.onBeforeCompile = (s) => {
    s.uniforms.uEmK = DAY.emK;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rm;\nvarying vec3 vRM;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = rm;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRM;\nuniform float uEmK;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = emissive * diffuseColor.rgb * vRM.z * (vRM.z > 3.5 ? 1.0 : uEmK);');
  };
  m.customProgramCacheKey = () => 'tkRM' + (params.map ? 'M' : '');
  return m;
}
export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map(v => Math.pow(v, 2.2));

// A sign face that is lit by the day: the printed atlas is the albedo, and the vertex colour (the
// night "glow" gain) only scales a little self-illumination on top (DAY.signK). Halos / additive
// letters are night-only. `color` scales a single-texture sign (old MeshBasic signs passed 1.3–1.6).
export function signMat(tex, { color = null, rough = 0.55, vc = true } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1, roughness: rough, metalness: 0, vertexColors: vc });
  m.onBeforeCompile = (s) => {
    s.uniforms.uSignK = DAY.signK;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSignK;')
      .replace('#include <color_fragment>', '')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance *= ${vc ? 'vColor.rgb' : 'vec3(1.0)'} * uSignK * ${(color ?? 1).toFixed(2)};`);
  };
  m.customProgramCacheKey = () => 'tkSign' + (vc ? 'v' : '') + (color ?? 1);
  return m;
}

// A zelkova (keyaki, Tokyo's street tree): a short trunk forking into a vase of branches, a broad
// rounded crown of leaf clusters (each an ellipsoid of three frusta), darker and denser underneath.
export function zelkova(A, x, y, z, s = 1, seed = 0, L = null) {
  const h = (k) => { const t = Math.sin((seed + 1) * 12.9898 + k * 78.233) * 43758.5453; return t - Math.floor(t); };
  A.set({ col: hex(0x4a3e32), rm: [0.9, 0, 0] });
  const ty = y + 2.6 * s;
  A.tube([x, y, z], [x + 0.1 * s, ty, z], 0.2 * s, 7);
  const tips = [];
  for (let k = 0; k < 5; k++) { const a = k * 1.26 + h(k) * 0.5, r = (1.3 + h(k + 9) * 0.6) * s; const tip = [x + Math.cos(a) * r, ty + (1.6 + h(k + 3) * 0.8) * s, z + Math.sin(a) * r]; A.tube([x + 0.1 * s, ty - 0.2 * s, z], tip, 0.09 * s, 5); tips.push(tip);
    // a couple of twigs off each limb, up into the crown
    for (let j = 0; j < 2; j++) { const b = 0.5 + 0.3 * j, m = [x + (tip[0] - x) * b, ty + (tip[1] - ty) * b, z + (tip[2] - z) * b]; A.tube(m, [m[0] + (h(k * 7 + j) - 0.5) * 1.6 * s, m[1] + (0.8 + h(k * 5 + j) * 0.7) * s, m[2] + (h(k * 3 + j + 40) - 0.5) * 1.6 * s], 0.045 * s, 4); } }
  if (L) {
    // leaf clumps: alpha-tested cards of a painted leaf texture, several per clump at random angles, their
    // normals bent outward from the crown's centre so the crown shades like a soft dome (lit side / shade side),
    // darker underneath; one per limb tip + the top, plus a few filling the gaps
    const cx = x, cy = ty + 2.0 * s, cz = z, tint = [[0.86, 0.95, 0.82], [1.0, 1.0, 1.0], [0.78, 0.86, 0.72], [1.05, 1.08, 0.95]];
    const clumps = tips.map(([tx, tyy, tz], k) => [tx, tyy + 0.2 * s, tz, (1.25 + h(k + 20) * 0.5) * s]);
    clumps.push([x, ty + 2.6 * s, z, 1.7 * s]);
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.7 + h(k + 60) * 0.4; clumps.push([x + Math.cos(a) * 1.0 * s, ty + (1.2 + h(k + 70) * 1.2) * s, z + Math.sin(a) * 1.0 * s, 1.1 * s]); }
    clumps.forEach(([px, py, pz, r], k) => {
      for (let c = 0; c < 5; c++) {
        const yaw = h(k * 11 + c) * Math.PI * 2, pit = (h(k * 13 + c + 5) - 0.5) * 1.6, R = r * (1.05 + h(k * 17 + c) * 0.35);
        const ux = Math.cos(yaw), uz = -Math.sin(yaw), vx = Math.sin(yaw) * Math.sin(pit), vy = Math.cos(pit), vz = Math.cos(yaw) * Math.sin(pit);
        const ox = px + (h(k * 19 + c) - 0.5) * r * 0.5, oy = py + (h(k * 23 + c) - 0.5) * r * 0.4, oz = pz + (h(k * 29 + c) - 0.5) * r * 0.5;
        const t = tint[(k + c) % 4], i0 = L.vn;
        for (const [a, b, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
          const X = ox + (ux * a + vx * b) * R, Y = oy + vy * b * R, Z = oz + (uz * a + vz * b) * R;
          let nx = X - cx, ny = (Y - cy) * 0.8 + 0.6 * s, nz = Z - cz; const nl = Math.hypot(nx, ny, nz) || 1;
          const shade = 0.55 + 0.45 * Math.min(1, Math.max(0, (Y - (cy - 2.2 * s)) / (3.6 * s)));
          L.vert(X, Y, Z, nx / nl, ny / nl, nz / nl, u, v, [t[0] * shade, t[1] * shade, t[2] * shade]);
        }
        L.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      }
    });
    // a dark core so you never see straight through the crown
    A.set({ col: hex(0x1e2c14), rm: [0.95, 0, 0] }); A.cyl(x, ty + 0.6 * s, z, 1.2 * s, 1.4 * s, ty + 2.8 * s, 7);
    return;
  }
  const blob = (cx, cy, cz, r, ry, c) => {
    A.set({ col: c, rm: [0.95, 0, 0] });
    A.cyl(cx, cy - ry, cz, r * 0.35, r * 0.95, cy - ry * 0.35, 9, { cap: false });
    A.cyl(cx, cy - ry * 0.35, cz, r * 0.95, r * 0.92, cy + ry * 0.35, 9, { cap: false });
    A.cyl(cx, cy + ry * 0.35, cz, r * 0.92, r * 0.25, cy + ry, 9, { cap: true });
  };
  const greens = [hex(0x3a5226), hex(0x456230), hex(0x2f4620), hex(0x50703a)];
  for (let k = 0; k < tips.length; k++) { const [tx, tyy, tz] = tips[k]; blob(tx, tyy + 0.2 * s, tz, (1.25 + h(k + 20) * 0.5) * s, (0.95 + h(k + 30) * 0.3) * s, greens[k % 4]); }
  blob(x, ty + 2.6 * s, z, 1.7 * s, 1.1 * s, greens[3]);
}
// a shrub out of the same leaf cards: a few clumps in a low dome (planters, pots, the terrace beds)
export function bush(L, x, y, z, r = 0.8, seed = 0) {
  const h = (k) => { const t = Math.sin((seed + 3) * 12.9898 + k * 78.233) * 43758.5453; return t - Math.floor(t); };
  const n = 3 + Math.round(r * 2);
  for (let k = 0; k < n; k++) {
    const a = h(k) * 6.28, d = k === 0 ? 0 : r * (0.35 + h(k + 9) * 0.4), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = y + r * (0.55 + h(k + 4) * 0.35), R = r * (0.55 + h(k + 7) * 0.25);
    for (let c = 0; c < 4; c++) {
      const yaw = h(k * 11 + c) * 6.28, pit = (h(k * 13 + c) - 0.5) * 1.4, ux = Math.cos(yaw), uz = -Math.sin(yaw), vx = Math.sin(yaw) * Math.sin(pit), vy = Math.cos(pit), vz = Math.cos(yaw) * Math.sin(pit);
      const i0 = L.vn;
      for (const [aa, bb, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
        const X = px + (ux * aa + vx * bb) * R, Y = py + vy * bb * R, Z = pz + (uz * aa + vz * bb) * R;
        let nx = X - x, ny = (Y - y) + 0.3, nz = Z - z; const nl = Math.hypot(nx, ny, nz) || 1;
        const sh = 0.6 + 0.4 * Math.min(1, Math.max(0, (Y - y) / (r * 1.4)));
        L.vert(X, Y, Z, nx / nl, ny / nl, nz / nl, u, v, [0.9 * sh, 0.98 * sh, 0.85 * sh]);
      }
      L.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
  }
}
// the painted leaf texture for the clumps: a few hundred small serrated-oval zelkova leaves, light on the
// upper side, overlapping densely in the middle and thinning to single leaves at the edge (alpha cut-out)
let _leafTex = null;
export function leafMaterial() {
  if (!_leafTex) {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), rng = makeRng(2718);
    g.clearRect(0, 0, S, S);
    for (let i = 0; i < 520; i++) {
      const rr = Math.sqrt(rng()) * S * 0.47 * (0.7 + 0.3 * rng()), a = rng() * Math.PI * 2;
      const lx = S / 2 + Math.cos(a) * rr, ly = S / 2 + Math.sin(a) * rr * 0.92;
      const len = 11 + rng() * 9, wid = 4.5 + rng() * 3, rot = rng() * Math.PI * 2;
      const depth = 1 - rr / (S * 0.47), hue = 88 + rng() * 26, sat = 32 + rng() * 26, lit = 16 + rng() * 14 + (1 - ly / S) * 16 - depth * 4;
      g.save(); g.translate(lx, ly); g.rotate(rot);
      g.fillStyle = `hsl(${hue},${sat}%,${lit}%)`; g.beginPath(); g.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `hsla(${hue - 6},${sat + 8}%,${lit + 14}%,0.55)`; g.beginPath(); g.ellipse(-len * 0.08, -wid * 0.12, len * 0.36, wid * 0.24, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `hsla(${hue},${sat}%,${lit - 8}%,0.7)`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke();
      g.restore();
    }
    // twigs
    g.strokeStyle = 'rgba(60,46,34,0.9)'; g.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) { const a = rng() * Math.PI * 2; g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S / 2 + Math.cos(a) * S * 0.3, S / 2 + Math.sin(a) * S * 0.3); g.stroke(); }
    _leafTex = canvasTex(c, { repeat: false, aniso: 4 });
  }
  return new THREE.MeshStandardMaterial({ map: _leafTex, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 0.88, metalness: 0 });
}
