import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, hexc, mul3, em, DIST, DUSK, SODIUM } from './kit.js';
import { materials } from './mats.js';
import { RIVER, QUAY, FARBANK, CLIFF_W, LSTREET, ROOF, RAVINE, BRIDGE, PLAZA, SKYST, TOWER, CLIMB, G40, WATER_Y } from './layout.js';
import { hillW, hillE } from './city.js';

// =====================================================================================
//  LIGHTS OUT — the ground the city stands on: the cliff faces (layered sandstone behind the
//  stilt houses, board-marked retaining walls where the roads cut in), the ravine's walls and its
//  stream, the quay road along the river with its lamp necklace and river wall, the hill terraces
//  under the towers. Rock faces are displaced grids (strata + overhangs), everything else boxes.
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

export function buildTerrain(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'terrain';
  const glows = [], colliders = [];
  const r = makeRng(4242);
  // rock: stained sandstone, wet at the foot, with ferns / moss in the ledges (Chongqing's cliffs are green)
  const rockCol = (p) => { const k = 0.75 + fbm(p[0] * 0.05, p[1] * 0.08) * 0.5; const wet = p[1] < 10 ? 0.75 : 1; const c = [0.52 * k * wet, 0.46 * k * wet, 0.4 * k * wet];
    const g = Math.max(0, fbm(p[0] * 0.09 + 7, p[1] * 0.14 + 3) - 0.56) * 3.2; return [c[0] * (1 - g) + 0.16 * g, c[1] * (1 - g) + 0.22 * g, c[2] * (1 - g) + 0.1 * g]; };
  // floodlit from the quay: a warm wash fading up the face (dims with the cliff's district in the blackout)
  const rockEm = (code) => (p) => { const k = Math.max(0, 1 - (p[1] - QUAY.y) / 34); return [1.0 * 0.12 * k * k, 0.62 * 0.12 * k * k, 0.32 * 0.12 * k * k, DUSK + code]; };

  // ---------------------------------------------------------------- the west bank cliff (behind Lantern Cliff and the store)
  {
    const A = B.get('rock', 'cliffw'); A.set({ rm: [0.92, 0, 0], em: [0, 0, 0, 0] });
    const x0 = -620, x1 = RAVINE.x0;
    gridFace(A, (u, v) => {
      const x = x0 + (x1 - x0) * u;
      const top = x < -128 ? 62 : 49.4;
      const y = QUAY.y - 1 + (top - QUAY.y + 1) * v;
      // the face leans back from the quay to the street edge, with ledges / overhangs from the strata
      const zt = CLIFF_W.zTop + 1.5, zb = QUAY.z0 - 1.5;
      const strata = Math.sin(y * 0.9 + fbm(x * 0.03, y * 0.05) * 3) * 0.6;
      const z = zb + (zt - zb) * Math.pow(v, 0.85) + (fbm(x * 0.04, y * 0.06) - 0.5) * 4 + strata;
      return [x, y, z];
    }, 120, 18, { colFn: rockCol, emFn: rockEm(DIST.CLIFF_LO) });
    // the ravine's west wall (faces +x), and its east wall (faces -x)
    for (const side of [0, 1]) {
      const xw = side ? RAVINE.x1 : RAVINE.x0;
      gridFace(A, (u, v) => {
        const z = side ? -400 + (QUAY.z0 + 408) * u : QUAY.z0 + 8 - (QUAY.z0 + 408) * u;
        const top = side ? (z > 40 ? PLAZA.y - 0.6 : 64) : (z > 96 ? 39.4 : 49.4);
        const y = RAVINE.floor - 1 + (top - RAVINE.floor + 1) * v;
        const lean = (fbm(z * 0.04, y * 0.07) - 0.5) * 5 + Math.sin(y * 0.8 + fbm(z * 0.02, y * 0.03) * 4) * 0.7 - (1 - v) * 3;
        return [xw + (side ? -lean - 1 : lean + 1), y, z];
      }, 110, 16, { colFn: rockCol, emFn: rockEm(DIST.ARCH) });
    }
    // the east bank cliff under the plaza / Sky Street / the tower's shelf
    gridFace(A, (u, v) => {
      const x = RAVINE.x1 + (900 - RAVINE.x1) * u;
      const top = x > SKYST.x0 ? 55.4 : 39.4;
      const y = QUAY.y - 1 + (top - QUAY.y + 1) * v;
      const z = QUAY.z0 - 1 + (PLAZA.z1 + 1 - QUAY.z0 + 1) * Math.pow(v, 0.8) + (fbm(x * 0.04, y * 0.06) - 0.5) * 3 + Math.sin(y * 0.9 + fbm(x * 0.03, y * 0.05) * 3) * 0.5;
      return [x, y, z];
    }, 100, 14, { colFn: rockCol, emFn: rockEm(DIST.EAST) });
  }
  // ---------------------------------------------------------------- the ravine floor: a stream over boulders, mist
  {
    const A = B.get('rock', 'ravine'); A.set({ col: [0.3, 0.28, 0.25], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    gridFace(A, (u, v) => { const x = RAVINE.x0 + 2 + (RAVINE.x1 - RAVINE.x0 - 4) * u, z = -400 + (QUAY.z1 + 400) * v; return [x, RAVINE.floor - 1 + fbm(x * 0.2, z * 0.2) * 2.2 * Math.abs(u - 0.5) * 2, z]; }, 12, 60);
  }
  // ---------------------------------------------------------------- the quay road along the river (both banks of the ravine), the river wall, lamps
  {
    const As = B.get('asphalt', 'quay'), Ac = B.get('concrete', 'quay'), Am = B.get('metal', 'quay');
    As.set({ col: [0.55, 0.55, 0.56], rm: [0.35, 0, 0], em: [0, 0, 0, 0] });
    Ac.set({ col: [0.55, 0.55, 0.53], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    for (const [x0, x1] of [[-1400, RAVINE.x0], [RAVINE.x1, 1600]]) {
      As.box(x0, QUAY.y - 0.5, QUAY.z0, x1, QUAY.y, RIVER.z0, { faces: 'Y', s: 1 });
      Ac.box(x0, WATER_Y - 3, RIVER.z0, x1, QUAY.y + 0.05, RIVER.z0 + 1.2, { faces: 'YzZ', s: 1 });      // the river wall
      Ac.box(x0, QUAY.y, RIVER.z0 - 0.4, x1, QUAY.y + 1.0, RIVER.z0, { faces: 'yYzZ', s: 1 });          // its parapet
    }
    // a little bridge carrying the quay road over the ravine's mouth
    Ac.box(RAVINE.x0 - 2, QUAY.y - 1.6, QUAY.z0 + 6, RAVINE.x1 + 2, QUAY.y, RIVER.z0, { faces: 'yYzZ', s: 1 });
    Am.set({ col: [0.25, 0.26, 0.27], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] });
    for (let x = -1380; x < 1580; x += 28) {
      if (x > RAVINE.x0 - 4 && x < RAVINE.x1 + 4) continue;
      const z = RIVER.z0 - 0.8;
      Am.cyl(x, QUAY.y, z, 0.1, 0.07, QUAY.y + 6.5, 6, { cap: false });
      Am.beam([x, QUAY.y + 6.4, z], [x, QUAY.y + 6.6, z - 1.4], 0.12, 0.12);
      const d = x < RAVINE.x0 ? DIST.CLIFF_LO : DIST.EAST;
      const L = B.get('plain', 'quay'); L.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em(SODIUM, 3, DUSK + d) }); L.box(x - 0.25, QUAY.y + 6.25, z - 1.65, x + 0.25, QUAY.y + 6.4, z - 1.1);
      glows.push({ p: [x, QUAY.y + 6.1, z - 1.4], color: [2.4, 1.3, 0.5], size: 2.6, code: DUSK + d, far: true });
    }
  }
  // ---------------------------------------------------------------- hill terraces under the backdrop towers (north banks)
  {
    const As = B.get('asphalt', 'nw'), Ac = B.get('concrete', 'nw');
    As.set({ col: [0.45, 0.45, 0.46], rm: [0.6, 0, 0], em: [0, 0, 0, 0] }); Ac.set({ col: [0.55, 0.55, 0.53], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    const bandsW = [[50, 96, 50], [-40, 50, 64], [-140, -40, 80], [-260, -140, 98], [-700, -260, 118]];
    for (const [z0, z1, y] of bandsW) {
      // west of the play terrace only where nothing else covers it
      As.box(-1400, y - 0.4, z0, z0 >= 50 ? -175 : RAVINE.x0 - 1, y, z1, { faces: 'Y', s: 1 });
      Ac.box(-1400, y - 30, z1 - 0.6, z0 >= 50 ? -175 : RAVINE.x0 - 1, y, z1, { faces: 'Z', s: 1 });
    }
    const Ae = B.get('asphalt', 'ne'), Aec = B.get('concrete', 'ne');
    Ae.set({ col: [0.45, 0.45, 0.46], rm: [0.6, 0, 0], em: [0, 0, 0, 0] }); Aec.set({ col: [0.55, 0.55, 0.53], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    const bandsE = [[-60, 40, 64], [-180, -60, 82], [-700, -180, 104]];
    for (const [z0, z1, y] of bandsE) { Ae.box(RAVINE.x1 + 1, y - 0.4, z0, 1600, y, z1, { faces: 'Y', s: 1 }); Aec.box(RAVINE.x1 + 1, y - 30, z1 - 0.6, 1600, y, z1, { faces: 'Z', s: 1 }); }
    // the east bank's riverside terrace beyond the play space (y 40 / 56)
    Ae.box(SKYST.x1 + 6, 55.6, 40, 1600, 56, PLAZA.z1, { faces: 'Y', s: 1 });
    Aec.box(SKYST.x1 + 6, QUAY.y, PLAZA.z1 - 0.6, 1600, 56, PLAZA.z1, { faces: 'Z', s: 1 });
    // the up/downstream north bank terraces (the glide sees these)
    Ac.box(-1400, 30, 60, -620, 34, QUAY.z0, { faces: 'YZ', s: 1 });
  }
  const { tris } = B.finish(root);
  root.userData.tris = tris;
  return { root, anchors: { glows }, colliders, tris };
}
