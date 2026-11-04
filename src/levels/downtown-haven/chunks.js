import * as THREE from 'three';

// =====================================================================================
//  Spatial chunking for the merged static meshes (city facades, street, lobby).
//  The art modules merge everything per material, so each mesh spans the whole level and
//  is never frustum-culled: every eye pass AND the sun's shadow pass draws all of it.
//  Splitting each mesh into ground-plane cells (fine near the avenue, coarse for the far
//  skyline) lets three.js cull per cell. Same materials, same vertices: looks identical.
// =====================================================================================

// cell index along one axis: 48 m cells across the playable canyon, 300 m cells for the skyline
const cellOf = (v) => (Math.abs(v) < 144 ? Math.floor(v / 48) : Math.sign(v) * (100 + Math.floor(Math.abs(v) / 300)));
const MIN_TRIS = 1200; // smaller cells merge into one leftover chunk (draw calls cost too)

export function splitByCells(root, { skip = () => false } = {}) {
  root.updateMatrixWorld(true);
  const targets = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    if (o.material.transparent || skip(o)) return;
    const g = o.geometry; if (!g || g.groups.length > 1 || g.morphAttributes.position) return;
    const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    if (n < MIN_TRIS * 2) return;
    targets.push(o);
  });
  let made = 0;
  for (const m of targets) made += splitMesh(m);
  return { meshes: targets.length, chunks: made };
}

const _c = new THREE.Vector3();
function splitMesh(mesh) {
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  const nTri = idx ? idx.count / 3 : pos.count / 3;
  const vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  const bins = new Map();
  for (let t = 0; t < nTri; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    _c.set((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3).applyMatrix4(mesh.matrixWorld);
    const key = cellOf(_c.x) * 4096 + cellOf(_c.z);
    let l = bins.get(key); if (!l) bins.set(key, l = []);
    l.push(t);
  }
  // fold the small cells together
  const groups = [], rest = [];
  for (const l of bins.values()) (l.length < MIN_TRIS ? rest.push(...l) : groups.push(l));
  if (rest.length) groups.push(rest);
  if (groups.length < 2) return 0;
  const names = Object.keys(g.attributes);
  for (let gi = 0; gi < groups.length; gi++) {
    const tris = groups[gi], remap = new Map(), order = [];
    const index = new Uint32Array(tris.length * 3);
    for (let i = 0; i < tris.length; i++) for (let k = 0; k < 3; k++) {
      const v = vi(tris[i], k);
      let r = remap.get(v); if (r === undefined) { r = order.length; remap.set(v, r); order.push(v); }
      index[i * 3 + k] = r;
    }
    const ng = new THREE.BufferGeometry();
    for (const nm of names) {
      const A = g.attributes[nm], s = A.itemSize, src = A.array, out = new src.constructor(order.length * s);
      if (A.isInterleavedBufferAttribute) { for (let i = 0; i < order.length; i++) for (let k = 0; k < s; k++) out[i * s + k] = A.getComponent ? A.getComponent(order[i], k) : [A.getX, A.getY, A.getZ, A.getW][k].call(A, order[i]); }
      else for (let i = 0; i < order.length; i++) for (let k = 0; k < s; k++) out[i * s + k] = src[order[i] * s + k];
      ng.setAttribute(nm, new THREE.BufferAttribute(out, s, A.normalized));
    }
    ng.setIndex(new THREE.BufferAttribute(order.length > 65535 ? index : new Uint16Array(index), 1));
    ng.computeBoundingBox(); ng.computeBoundingSphere();
    const c = new THREE.Mesh(ng, mesh.material);
    c.name = `${mesh.name}#${gi}`;
    c.castShadow = mesh.castShadow; c.receiveShadow = mesh.receiveShadow; c.renderOrder = mesh.renderOrder;
    c.frustumCulled = mesh.frustumCulled; c.layers.mask = mesh.layers.mask; c.userData = mesh.userData;
    c.position.copy(mesh.position); c.quaternion.copy(mesh.quaternion); c.scale.copy(mesh.scale);
    mesh.parent.add(c);
  }
  mesh.parent.remove(mesh);
  g.dispose();
  return groups.length;
}
