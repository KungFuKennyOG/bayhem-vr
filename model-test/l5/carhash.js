// hashes every default car build (geometry + atlas pixels) so a cars.js edit can be proven bit-identical
import * as THREE from 'three';
import * as C from '/src/levels/downtown-haven/cars.js';
function h32(arr, h = 2166136261) { const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619); } return h >>> 0; }
function hashAll() {
  const out = {};
  for (const type of ['sedan', 'taxi', 'police', 'suv', 'van', 'bus', 'wreck']) for (const seed of [7, 101, 102, 113]) for (const doorOpen of [false, true]) {
    const m = C.buildCar(type, { seed, doorOpen });
    let h = 2166136261;
    m.root.traverse((o) => { if (o.isMesh) for (const k of Object.keys(o.geometry.attributes).sort()) h = h32(o.geometry.attributes[k].array, h); });
    out[`${type}:${seed}:${doorOpen ? 1 : 0}`] = h + ':' + JSON.stringify(m.half) + ':' + m.info.tris + ':' + JSON.stringify(m.anchors.lights.map(l => l.kind + l.p.map(v => v.toFixed(4)).join(',')));
  }
  const mats = C.carMaterials();
  const cv = mats.body.map.image, g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
  out.atlas = h32(d);
  let all = 2166136261; for (const k of Object.keys(out).sort()) { const s = new TextEncoder().encode(k + out[k]); all = h32(s, all); }
  return { all, atlas: out.atlas, n: Object.keys(out).length };
}
export function carHash(ctx) {
  const before = hashAll();
  const paris = [];
  for (const type of ['sedan', 'taxi', 'police', 'suv', 'van', 'bus', 'wreck']) { const m = C.buildCar(type, { seed: 101, city: 'paris' }); paris.push(type + ':' + m.info.tris + ':' + (m.info.city || '-')); }
  const after = hashAll();
  return { root: new THREE.Group(), info: { before, after, paris } };
}
