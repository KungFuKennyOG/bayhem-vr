import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { mergeGeometries };

// Box with UVs in world units (uvScale m per repeat)
export function box(w, h, d, uvScale = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (uvScale) {
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / uvScale, uv.getY(i) * dims[f][1] / uvScale);
    }
  }
  return g;
}
export function at(g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  g.applyMatrix4(m);
  return g;
}
export function cyl(rt, rb, h, seg = 12, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
}
// Extrude a 2D profile (in XY plane) along Z from z0 to z1 with uv: u = profile length/uvU, v = z/uvV
export function profileStrip(pts, z0, z1, uvU = 1, uvV = 1) {
  const pos = [], uvs = [], idx = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pos.push(pts[i][0], pts[i][1], z0, pts[i][0], pts[i][1], z1);
    uvs.push(acc / uvU, z0 / uvV, acc / uvU, z1 / uvV);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// Ensure all geometries share the same attribute set before merging
export function normalizeAttrs(geos) {
  const allColor = geos.every(g => g.attributes.color);
  const keep = allColor ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  for (const g of geos) {
    if (!g.attributes.uv) {
      const n = g.attributes.position.count;
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
    g.morphAttributes = {};
  }
  return geos.map(g => (g.index ? g.toNonIndexed() : g));
}
function indexify(g) {
  const n = g.attributes.position.count;
  const idx = []; for (let i = 0; i < n; i++) idx.push(i);
  g.setIndex(idx); return g;
}
export function merge(geos, groups = false) {
  return mergeGeometries(normalizeAttrs(geos), groups);
}
// Merge an array of [geometry, materialIndex] into a grouped geometry
export function mergeGrouped(list, nMat) {
  const byMat = [];
  for (let i = 0; i < nMat; i++) byMat.push([]);
  for (const [g, mi] of list) byMat[mi].push(g);
  const parts = [], mats = [];
  byMat.forEach((arr, mi) => { if (arr.length) { parts.push(merge(arr)); mats.push(mi); } });
  const g = mergeGeometries(normalizeAttrs(parts), true);
  g.groups.forEach((gr, i) => { gr.materialIndex = mats[i]; });
  return { geometry: g, matIndices: mats };
}
// Add vertex colors to a geometry (solid)
export function tint(g, r, gg, b) {
  const n = g.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = gg; c[i * 3 + 2] = b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
