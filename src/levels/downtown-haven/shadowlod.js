import * as THREE from 'three';

// =====================================================================================
//  Shadow LOD: a mesh casts its shadow with a decimated copy of itself, at no extra draw
//  calls. The decimated triangles are appended to the mesh's own (non-indexed) geometry;
//  the eye passes draw only the original range, and onBeforeShadow/onAfterShadow swap the
//  draw range to the cheap copy for the sun's shadow pass. Used for the traffic: ~10k-tri
//  car bodies were half of the whole shadow pass.
// =====================================================================================

// vertex clustering: snap every vertex to a `cell` grid (cluster = mean of its members),
// drop triangles that collapse, and drop duplicates
function decimate(pos, count, cell) {
  const key = new Int32Array(count), sums = new Map();
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const k = (Math.floor(x / cell) + 512) * 1048576 + (Math.floor(y / cell) + 512) * 1024 + (Math.floor(z / cell) + 512);
    key[i] = k;
    const s = sums.get(k); if (s) { s[0] += x; s[1] += y; s[2] += z; s[3]++; } else sums.set(k, [x, y, z, 1]);
  }
  const out = [], seen = new Set();
  for (let t = 0; t < count; t += 3) {
    const a = key[t], b = key[t + 1], c = key[t + 2];
    if (a === b || b === c || a === c) continue;
    const id = [a, b, c].sort((p, q) => p - q).join(',');
    if (seen.has(id)) continue;
    seen.add(id);
    for (const k of [a, b, c]) { const s = sums.get(k); out.push(s[0] / s[3], s[1] / s[3], s[2] / s[3]); }
  }
  return out;
}

export function attachShadowLOD(mesh, { cell = 0.2 } = {}) {
  const g = mesh.geometry;
  if (g.index || g.groups.length) return null;
  const pos = g.attributes.position, n = pos.count;
  const lod = decimate(pos.array, n, cell), m = lod.length / 3;
  if (m < 3 || m > n * 0.6) return null; // not worth it
  const ng = new THREE.BufferGeometry();
  for (const [name, A] of Object.entries(g.attributes)) {
    const s = A.itemSize, arr = new A.array.constructor((n + m) * s);
    arr.set(A.array.subarray(0, n * s));
    if (name === 'position') arr.set(lod, n * 3);
    ng.setAttribute(name, new THREE.BufferAttribute(arr, s, A.normalized));
  }
  ng.boundingBox = g.boundingBox?.clone() || null; ng.boundingSphere = g.boundingSphere?.clone() || null;
  if (!ng.boundingSphere) ng.computeBoundingSphere();
  ng.setDrawRange(0, n);
  mesh.geometry = ng;
  g.dispose();
  const prevB = mesh.onBeforeShadow, prevA = mesh.onAfterShadow;
  mesh.onBeforeShadow = function (...a) { ng.drawRange.start = n; ng.drawRange.count = m; prevB.apply(this, a); };
  mesh.onAfterShadow = function (...a) { ng.drawRange.start = 0; ng.drawRange.count = n; prevA.apply(this, a); };
  return { full: n / 3, shadow: m / 3 };
}
