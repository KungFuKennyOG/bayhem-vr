import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, hexc, mul3, em, DIST, DUSK, SODIUM } from './kit.js';
import { materials } from './mats.js';
import { RIVER, QUAY, FARBANK, PLAZA, PODIUM, BRIDGE, ROAD, PLZ, WATER_Y, SLIDE, HILLE, TERR, Y, hillY } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the ground the city stands on: the south bank's cliff under the road, the north
//  bank's terraces and river face either side of the hillside district, the plateau behind both.
// =====================================================================================
function vn(x, z) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }
function sn(x, z) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = vn(xi, zi), b = vn(xi + 1, zi), c = vn(xi, zi + 1), d = vn(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, z, o = 4) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * sn(x * f + i * 17.1, z * f - i * 9.3); a *= 0.5; f *= 2.03; } return s; }

// a displaced grid: P(u, v) → [x, y, z]; normals by finite differences; uv in metres (horizontal arc, world y)
export function gridFace(A, P, nu, nv, { col = A.col, colFn = null, emFn = null } = {}) {
  const base = A.vn, e = 1e-3;
  let arc = 0, prev = null;
  const arcs = [];
  for (let i = 0; i <= nu; i++) { const p = P(i / nu, 0.5); if (prev) arc += Math.hypot(p[0] - prev[0], p[2] - prev[2]); arcs.push(arc); prev = p; }
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv, p = P(u, v);
    const pu = P(Math.min(1, u + e), v), pv = P(u, Math.min(1, v + e)), pu0 = P(Math.max(0, u - e), v), pv0 = P(u, Math.max(0, v - e));
    const tu = [pu[0] - pu0[0], pu[1] - pu0[1], pu[2] - pu0[2]], tv = [pv[0] - pv0[0], pv[1] - pv0[1], pv[2] - pv0[2]];
    let nx = tu[1] * tv[2] - tu[2] * tv[1], ny = tu[2] * tv[0] - tu[0] * tv[2], nz = tu[0] * tv[1] - tu[1] * tv[0];
    const L = Math.hypot(nx, ny, nz) || 1;
    A.vert(p[0], p[1], p[2], nx / L, ny / L, nz / L, arcs[i], p[1], colFn ? colFn(p, u, v) : col, emFn ? emFn(p, u, v) : A.em);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
    A.idx.push(a, b, c, a, c, d);
  }
}

// the north bank's river face west of the hillside district (slide.js closes its west flank against this profile):
// v 0 = the quay, 1 = the shelf's edge
export function eastP(x, v) {
  const top = 55.4;
  const y = QUAY.y - 1 + (top - QUAY.y + 1) * v;
  const z = QUAY.z0 - 1 + (PLAZA.z1 + 1 - QUAY.z0 + 1) * Math.pow(v, 0.8) + (fbm(x * 0.04, y * 0.06) - 0.5) * 3 + Math.sin(y * 0.9 + fbm(x * 0.03, y * 0.05) * 3) * 0.5;
  return [x, y, z];
}
// the rock's colour / floodlight (shared with slide.js)
export const rockCol = (p) => { const k = 0.75 + fbm(p[0] * 0.05, p[1] * 0.08) * 0.5; const wet = p[1] < 10 ? 0.75 : 1; const c = [0.52 * k * wet, 0.46 * k * wet, 0.4 * k * wet];
  const g = Math.max(0, fbm(p[0] * 0.09 + 7, p[1] * 0.14 + 3) - 0.56) * 3.2; return [c[0] * (1 - g) + 0.16 * g, c[1] * (1 - g) + 0.22 * g, c[2] * (1 - g) + 0.1 * g]; };
export const rockEm = (code) => (p) => { const k = Math.max(0, 1 - (p[1] - QUAY.y) / 34); return [1.0 * 0.12 * k * k, 0.62 * 0.12 * k * k, 0.32 * 0.12 * k * k, DUSK + code]; };

// the south cliff's face under the road: v 0 = the water, 1 = the road's edge. Layered sandstone, overhangs, a talus foot.
export function southP(x, v) {
  const y = WATER_Y - 3 + (Y - 0.4 - WATER_Y + 3) * v;
  const lean = (1 - v) * (1 - v) * 16;                                       // the foot runs out into the river
  const z = FARBANK.z - 0.4 - lean - (fbm(x * 0.035, y * 0.07) - 0.5) * 5 * (1 - v * v) - Math.sin(y * 0.8 + fbm(x * 0.03, y * 0.05) * 3) * 0.6 * (1 - v);
  return [x, y, Math.min(FARBANK.z - 0.3, z)];
}

export function buildTerrain(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'terrain';
  const glows = [], colliders = [];
  // ---------------------------------------------------------------- the south bank: the cliff under the road (the face you see from the bridge and the glide)
  {
    const A = B.get('rock', 'cliffs'); A.set({ rm: [0.92, 0, 0], em: [0, 0, 0, 0] });
    for (let x = -900; x < 1500; x += 120) gridFace(A, (u, v) => southP(x + 120 * (1 - u), v), 30, 12, { colFn: rockCol });
    // the land behind the frontage: it steps up away from the river (the city stands on it)
    const G = B.get('concrete', 'souths'); G.set({ col: [0.2, 0.2, 0.2], rm: [0.95, 0, 0], em: [0, 0, 0, 0] });
    G.box(-900, Y - 1, FARBANK.z - 0.3, ROAD.x0 - 30, Y - 0.05, 1300, { faces: 'Y', s: 1 });
    G.box(ROAD.x1 + 30, Y - 1, FARBANK.z - 0.3, 1500, Y - 0.05, 1300, { faces: 'Y', s: 1 });
    G.box(ROAD.x0 - 30, Y - 1, ROAD.z1 + 20, ROAD.x1 + 30, Y - 0.05, 1300, { faces: 'Y', s: 1 });
  }
  // ---------------------------------------------------------------- the north bank west of the hillside district: a shelf, a rock face, the quay
  {
    const A = B.get('rock', 'cliffn'); A.set({ rm: [0.92, 0, 0], em: [0, 0, 0, 0] });
    for (let x = -900; x < SLIDE.x0; x += 127) { const w = Math.min(127, SLIDE.x0 - x); gridFace(A, (u, v) => eastP(x + w * u, v), 30, 10, { colFn: rockCol }); }
    const C = B.get('concrete', 'cliffn'); C.set({ col: [0.22, 0.22, 0.21], rm: [0.95, 0, 0], em: [0, 0, 0, 0] });
    C.box(-900, 55, SLIDE.crack, SLIDE.x0 - 0.05, 56, PLAZA.z1 + 1.5, { faces: 'Y', s: 1 });
    C.box(-900, QUAY.y - 1, QUAY.z0 - 2, SLIDE.x0, QUAY.y, RIVER.z0, { faces: 'YZ', s: 1 });
    C.box(-900, WATER_Y - 3, RIVER.z0, SLIDE.x0, QUAY.y, RIVER.z0 + 1.2, { faces: 'YZ', s: 1 });
    // the step up from the shelf to the plateau behind
    C.set({ col: [0.36, 0.35, 0.33] }); C.box(-900, 55, SLIDE.crack - 1.5, SLIDE.x0, Y, SLIDE.crack, { faces: 'ZY', s: 1 });
  }
  // ---------------------------------------------------------------- the north bank east of the tower's podium: terraces down to the quay
  {
    const C = B.get('concrete', 'cliffe');
    for (let k = 0; k < TERR.n; k++) {
      const z0 = TERR.z0 + k * TERR.d, z1 = k === TERR.n - 1 ? TERR.quay : z0 + TERR.d, y = hillY(z0 + 0.1), yn = k === TERR.n - 1 ? QUAY.y : hillY(z1 + 0.1);
      C.set({ col: [0.21, 0.21, 0.2], rm: [0.95, 0, 0], em: [0, 0, 0, 0] }); C.box(PODIUM.x1, y - 1, z0, 1500, y, z1, { faces: 'Y', s: 1 });
      C.set({ col: [0.4, 0.39, 0.36] }); C.box(PODIUM.x1, yn, z1 - 0.6, 1500, y, z1, { faces: 'Z', s: 1, foot: 0.3 });
    }
    C.set({ col: [0.22, 0.22, 0.21] }); C.box(PODIUM.x1, QUAY.y - 1, TERR.quay, 1500, QUAY.y, RIVER.z0, { faces: 'Y', s: 1 });
    C.box(PODIUM.x1, WATER_Y - 3, RIVER.z0, 1500, QUAY.y, RIVER.z0 + 1.2, { faces: 'YZ', s: 1 });
  }
  // ---------------------------------------------------------------- the plateau behind the north bank (the towers stand on it)
  {
    const G = B.get('concrete', 'northp'); G.set({ col: [0.18, 0.18, 0.18], rm: [0.95, 0, 0], em: [0, 0, 0, 0] });
    G.box(-900, Y - 1, -900, 1500, Y - 0.05, SLIDE.crack - 1.4, { faces: 'Y', s: 1 });
    void HILLE; void BRIDGE; void PLZ;
  }
  const { tris } = B.finish(root, { shadowKeys: [] });
  root.userData.tris = tris;
  return { root, colliders, anchors: { glows }, tris };
}
