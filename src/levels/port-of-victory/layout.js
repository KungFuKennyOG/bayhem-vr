// =====================================================================================
//  PORT OF VICTORY — yard layout (container maze), shared by world building, AI and the director.
//  Containers in the blocks run with their long axis along z (aisles point at the setting sun).
// =====================================================================================
import { makeRng } from '../../rng.js';

export const CW = 2.44, CH = 2.59, C40 = 12.19, C20 = 6.06;
export const QUAY_Z = -151.0, WATER_Y = -2.2, DECK_Y = 9.0;
export const YARD = { x0: -56, x1: 56, z0: -110.6, z1: 12 };

// block columns: [x0, rows]  (x0 = left edge, rows of 2.44 m)
export const COLUMNS = {
  A: [-50.76, 4], B: [-33.76, 4], C: [-16.6, 5], D: [4.6, 4], E: [21.0, 4], F: [38.0, 4],
};
// block segments along z: [zTop (the +z end), containers along z]
export const SEGMENTS = [[12.0, 3], [-31.0, 3], [-74.0, 3]];
export const MAIN_AISLE = { x0: -4.4, x1: 4.6 };
export const CROSS = [[-24.57, -31.0], [-67.57, -74.0]]; // cross-aisle z ranges [zTop, zBottom]
export const RTG = { x: -6.0, z: -82, legs: [-17.5, 5.5] };
export const GATE_Z = 28;

const LIVERIES = 8;
// deterministic stack heights with gameplay overrides
export function buildContainerList() {
  const r = makeRng(9001);
  const list = [];
  const push = (x, z, tier, rot, len, extra = {}) => list.push({ x, z, tier, rot, len, livery: Math.floor(r() * LIVERIES), seed: Math.floor(r() * 1e6), ...extra });
  for (const [name, [x0, rows]] of Object.entries(COLUMNS)) {
    for (let si = 0; si < SEGMENTS.length; si++) {
      const [zTop, n] = SEGMENTS[si];
      for (let row = 0; row < rows; row++) {
        const x = x0 + CW * (row + 0.5);
        for (let k = 0; k < n; k++) {
          const zc = zTop - C40 * (k + 0.5);
          // passages: a 20 ft box instead of a 40 ft one in every row (6 m gap through the block)
          const gap = PASSAGES.some(p => p[0] === name && p[1] === si && p[2] === k);
          // height: outer columns tall (walls), inner ones varied, never 0
          const outer = name === 'A' || name === 'F';
          let h = outer ? 3 + Math.floor(r() * 2) : 1 + Math.floor(r() * 3);
          if (HEIGHT.has(`${name}${si}${k}`)) h = HEIGHT.get(`${name}${si}${k}`);
          if (row === 0 || row === rows - 1) h = Math.max(1, h - (r() < 0.35 ? 1 : 0));
          for (let t = 0; t < h; t++) {
            if (gap) { push(x, zc + (C40 - C20) / 2, t, 1, 20, { block: name }); continue; }
            // occasionally the top box is a 20 footer (silhouette variety)
            if (t === h - 1 && t > 0 && r() < 0.18) push(x, zc + (r() < 0.5 ? 1 : -1) * (C40 - C20) / 2, t, 1, 20, { block: name });
            else push(x, zc, t, 1, 40, { block: name, hero: HERO.has(`${name}${si}${k}r${row}t${t}`) });
          }
        }
      }
    }
  }
  // perimeter walls of tall stacks (rot 1 along z) at the far left/right of the yard
  for (const x of [-54.5, 54.5]) for (let k = 0; k < 10; k++) for (let t = 0; t < 4; t++) push(x, 12 - C40 * (k + 0.5), t, 1, 40, { block: 'W' });
  // loose boxes in the plaza and aisles (cover), long axis along x
  for (const [x, z, tiers, len, rot] of LOOSE) for (let t = 0; t < tiers; t++) push(x, z, t, rot ?? 0, len, { block: 'L', hero: t === 0 && HERO_LOOSE.has(`${x},${z}`) });
  return list;
}
// [column, segment, index along z] passages
const PASSAGES = [['C', 0, 1], ['D', 0, 2], ['B', 1, 1], ['C', 1, 2], ['D', 1, 0], ['E', 1, 1], ['C', 2, 0], ['E', 2, 2]];
// fixed heights (key = column + segment + index)
const HEIGHT = new Map([['C00', 2], ['D00', 1], ['C01', 3], ['D01', 2], ['C10', 1], ['D10', 2], ['C11', 2], ['D11', 1], ['C20', 2], ['C21', 2], ['C22', 2], ['D20', 2], ['D21', 3], ['D22', 1]]);
const HERO = new Set();
// loose boxes: [x, z, tiers, len, rot]
export const LOOSE = [
  [-9.5, 19.5, 1, 40, 0], [13.5, 16.5, 2, 40, 0], [24, 22, 1, 20, 1], [-26, 15, 1, 20, 0],
  [0.6, -8.5, 1, 20, 0],          // main aisle chicane 1 (cover)
  [-20.3, -12, 1, 20, 1],          // left aisle
  [17.7, -45, 1, 20, 1],           // right aisle
  [-1.4, -48.5, 1, 20, 0],         // main aisle chicane 2
  [-12.0, -28, 1, 20, 0],          // cross aisle 1 cover
  [26, -70.5, 1, 20, 0],           // cross aisle 2
];
const HERO_LOOSE = new Set(['0.6,-8.5', '-1.4,-48.5', '-12,-28', '17.7,-45']);

// light masts (x, z)
export const MASTS = [[-22, 19], [22, 24], [-20.3, -27.8], [17.6, -27.8], [-37.4, -70.8], [17.7, -70.8], [-22, -118], [16, -118], [52, -118], [-52, -118]];

// explosive drums: clusters [x, z, count, layout 'pallet'|'stack'|'row']
export const DRUMS = [
  [6.5, 21.5, 4, 'pallet'], [-14.0, 22.5, 3, 'row'], [-2.8, -21, 4, 'pallet'], [3.8, -36, 3, 'row'],
  [-19.8, -40, 4, 'pallet'], [11.5, -71, 5, 'stack'], [-2.6, -63, 3, 'row'],
  // apron: the forklift / fuel depot set piece
  [24, -121, 8, 'stack'], [30, -126, 6, 'stack'], [8, -132, 4, 'pallet'], [-14, -128, 4, 'pallet'], [-30, -122, 5, 'stack'], [34, -114, 4, 'pallet'],
];
