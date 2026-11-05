import * as THREE from 'three';

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
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rm;\nvarying vec3 vRM;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = rm;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRM;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = emissive * diffuseColor.rgb * vRM.z;');
  };
  m.customProgramCacheKey = () => 'tkRM' + (params.map ? 'M' : '');
  return m;
}
export const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map(v => Math.pow(v, 2.2));
