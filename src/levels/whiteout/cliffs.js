import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../../rng.js';
import { terrainAt, ridged, GAZEX, CONVOY, CORNICE, LINE, PYLON, TRACK_X, lineY } from './layout.js';
import { Bucket, M4, mats } from './kit.js';

// =====================================================================================
//  Authored-looking rock: the heightfield alone reads as "crumpled paper", so real rock
//  bodies stand out of it.
//   - Buttresses on the Grauhorn face, along the rib crests and down the fall line: long faceted
//     granite prisms (planar breaks, a jointed top), snow settled on every ledge by snowPatch.
//   - Cliff bands across the face (horizontal steps the couloirs cut through).
//   - The gorge under the cable line: rock walls close beside the cabin's path (parallax, the
//     drop under you), pinnacles, a waterfall of ice.
//   - The cornice along the ridge: an overhanging snow lip with its shadowed underside.
// =====================================================================================
const PI = Math.PI;

// a faceted rock body: a box subdivided, pushed out by layered noise, then quantised in a few
// planes (joints), squashed; vertices merged so the snow / normals are smooth where they should be
function rockGeo(rng, { sx = 1, sy = 1, sz = 1, seg = [6, 3, 5], facet = 0.55 } = {}) {
  let g = new THREE.BoxGeometry(1, 1, 1, ...seg);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const P = g.attributes.position, v = new THREE.Vector3();
  const o = [rng() * 9, rng() * 9, rng() * 9];
  const planes = [0, 1, 2].map(() => new THREE.Vector3(rng() - 0.5, rng() * 0.6, rng() - 0.5).normalize());
  for (let i = 0; i < P.count; i++) {
    v.set(P.getX(i), P.getY(i), P.getZ(i));
    // round the box toward an ellipsoid, then break it on a few planes
    _s.copy(v).normalize().multiplyScalar(0.5);
    v.lerp(_s, 0.55);
    const n = Math.sin(v.x * 5.1 + o[0]) * 0.08 + Math.sin(v.z * 6.3 + o[1]) * 0.07 + Math.sin((v.x + v.y) * 11 + o[2]) * 0.03;
    v.multiplyScalar(1 + n);
    for (const pl of planes) { const d = v.dot(pl); if (d > facet * 0.5) v.addScaledVector(pl, -(d - facet * 0.5) * 0.7); }
    v.set(v.x * sx, Math.max(-0.5, v.y) * sy, v.z * sz);
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const _s = new THREE.Vector3();
export function buildCliffs() {
  const root = new THREE.Group();
  const rng = makeRng(31337);
  const R = new Bucket(), S = new Bucket(), G = new Bucket();
  const colliders = [];
  const shade = (k) => (p, n) => { const up = Math.max(0, n.y); const c = (0.62 + 0.25 * up) * k; return [c * 1.02, c, c * 0.97]; };
  // wet dark gorge rock with strata: bands every ~3 m, snow on the ledge tops
  const strata = (k) => (p, n) => { const band = (Math.floor(p.y / 3.1) % 2 ? 0.82 : 1.0) * (0.92 + 0.08 * Math.sin(p.y * 1.7 + p.x * 0.1)); const up = Math.max(0, n.y); const c = (0.5 + 0.45 * up * up) * k * band; return [c, c * 0.98, c * 0.96]; };
  const near = (x, z, list, r) => list.some(([a, b]) => Math.hypot(x - a, z - b) < r);

  // ---- buttresses along the rib crests (the face: z -420 .. -690)
  let placed = 0;
  for (let i = 0; i < 900 && placed < 24; i++) {
    const x = -30 + rng() * 300, z = -500 - rng() * 190;
    const rib = ridged(x * 0.024, z * 0.006);
    if (rib < 0.6) continue;
    if (near(x, z, GAZEX, 30) || near(x, z, CONVOY, 18)) continue;
    const y = terrainAt(x, z);
    const e = 4, slope = (terrainAt(x, z - e) - terrainAt(x, z + e)) / (2 * e);   // rise per metre going north
    const L = 30 + rng() * 34, W = 7 + rng() * 7, H = 8 + rng() * 8 + (rib - 0.6) * 24;
    const g = rockGeo(rng, { sx: W, sy: H, sz: L, facet: 0.4 + rng() * 0.3 });
    // lie along the fall line, pitched with the slope; sunk a third
    const pitch = Math.atan(slope);
    R.add(g, M4(x, y - H * 0.18, z, pitch, (rng() - 0.5) * 0.35, (rng() - 0.5) * 0.2), shade(1.0 + rng() * 0.15), { uvScale: 6 });
    placed++;
  }
  // ---- cliff bands: broken steps across the face at two heights (the couloirs cut gaps in them)
  for (const zb of [-545, -625]) {
    for (let x = -40; x < 290; x += 14 + rng() * 10) {
      if (rng() < 0.32) { x += 14; continue; }                   // a couloir through the band
      const z = zb + Math.sin(x * 0.03) * 10 + (rng() - 0.5) * 4;
      if (near(x, z, GAZEX, 28) || near(x, z, CONVOY, 16)) continue;
      const y = terrainAt(x, z), W = 18 + rng() * 14, H = 9 + rng() * 6, D = 6 + rng() * 4;
      R.add(rockGeo(rng, { sx: W, sy: H, sz: D, seg: [6, 3, 3], facet: 0.35 }), M4(x, y - H * 0.1, z, 0.35, (rng() - 0.5) * 0.3, 0), shade(0.95 + rng() * 0.12), { uvScale: 6 });
    }
  }
  // ---- the cornice: an overhanging lip of wind-packed snow along the ridge, its underside in shade
  {
    const n = 90, pos = [], idx = [], col = [];
    for (let i = 0; i <= n; i++) {
      const x = CORNICE.x0 - 30 + (CORNICE.x1 - CORNICE.x0 + 60) * i / n;
      const z = CORNICE.z + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.17) * 2;
      const y = terrainAt(x, z), over = 3.5 + 2.5 * Math.sin(x * 0.11 + 1.3) + rng() * 1.2, th = 2.2 + rng() * 1.2;
      // cross-section: back (on the ridge) → top → overhang tip → curling underside → back into the face
      const prof = [[-6, 0.4], [-2, th], [over * 0.6, th * 0.95], [over, th * 0.55], [over * 0.8, -0.3], [over * 0.3, -th * 0.6], [-1, -th * 0.9]];
      for (const [f, h] of prof) { pos.push(x, y + h, z + f); const k = h > th * 0.5 ? 0.97 : h > 0 ? 0.85 : 0.6; col.push(k * 0.93, k * 0.96, k); }
    }
    const m = 7;
    for (let i = 0; i < n; i++) for (let j = 0; j < m - 1; j++) { const a = i * m + j, b = a + m; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    S.add(g, null, [1, 1, 1], { uvScale: 4 });
  }
  // ---- the gorge under the cable line: rock walls close beside the cabin's path (both sides),
  //      stepping down into the fog, pinnacles, an ice fall
  {
    const tx = (TRACK_X[0] + TRACK_X[1]) / 2;
    for (let z = -34; z > -290; z -= 12 + rng() * 8) {
      if (Math.abs(z - PYLON.z) < 16) continue;
      const cabY = lineY(z) - 6.6;
      for (const side of [-1, 1]) {
        if (rng() < 0.25) continue;
        const off = 34 + rng() * 26, x = tx + side * off;
        const ground = terrainAt(x, z);
        // a wall that rises from the ground to just under (or past) the cabin, so the drop reads
        const top = Math.min(cabY + 6 - rng() * 22, ground + 90);
        if (top < ground + 8) continue;
        const H = top - ground, W = 14 + rng() * 14, D = 14 + rng() * 12;
        G.add(rockGeo(rng, { sx: W, sy: H, sz: D, seg: [4, 10, 4], facet: 0.3 }), M4(x, ground + H * 0.5 - 2, z, 0, rng() * PI, 0), strata(0.62 + rng() * 0.12), { uvScale: 7 });
        // a snow ledge on top
        S.add(rockGeo(rng, { sx: W * 0.8, sy: 1.6, sz: D * 0.8, seg: [4, 2, 4], facet: 0.6 }), M4(x, top - 1.6, z, 0, rng() * PI, 0), [0.95, 0.97, 1], { uvScale: 4 });
      }
    }
  }
  root.add(R.mesh(mats.rock(), { shadow: true, name: 'cliffs-rock' }));
  root.add(S.mesh(mats.snow(), { shadow: false, name: 'cliffs-snow' }));
  if (G.vn) root.add(G.mesh(mats.rockBare(), { shadow: true, name: 'cliffs-gorge' }));
  return { root, colliders, anchors: { glows: [], pools: [], named: {}, plumes: [] } };
}
