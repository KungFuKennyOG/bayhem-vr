import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, em, mul3, hexc, GOLD, SODIUM, COOLW, DIST, DUSK, signQuad } from './kit.js';
import { materials } from './mats.js';
import { SIGN } from './signs.js';
import { Frame, frontM, shopRow, lampPost, lantern, lanternString, cables, tree, hotpot, scooter } from './kitbuild.js';
import { PLAZA, EROAD, F1, F2, FPIERS, PSPAN, RAMP_N, SUBST, CLIMB, CLIMB_PROFILE, climbY, SKYST, FOOTB, TOWER, RAVINE, QUAY } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the east bank: the plaza under the stacked interchange (Longwu's Huangjueyuan:
//  two decks of flyover one over the other, LED-lined, on shared piers, a ramp curling up the
//  hill), the substation under its south edge, the stair street up to the cliff top and Sky
//  Street with the footbridge into Jinlong Tower. The span of the double-decker over the
//  substation is built separately (setpieces drops it).
// =====================================================================================
const DECKC = [0.6, 0.6, 0.58];
function deckRun(B, reg, D, xa, xb, code, { led = [0.55, 0.78, 1.0] } = {}) {
  const C = B.get('concrete', reg), A = B.get('asphalt', reg), L = B.get('plain', reg), P = B.get('plain', reg);
  C.set({ col: DECKC, rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
  C.box(xa, D.y - D.t, D.z0, xb, D.y - 0.1, D.z1, { faces: 'yzZ', s: 1 });
  A.set({ col: [0.46, 0.46, 0.48], rm: [0.35, 0, 0], em: [0, 0, 0, 0] }); A.box(xa, D.y - 0.4, D.z0 + 0.5, xb, D.y, D.z1 - 0.5, { faces: 'Y', s: 1 });
  for (const z of [D.z0, D.z1 - 0.5]) C.box(xa, D.y - 0.4, z, xb, D.y + 1.0, z + 0.5, { faces: 'zZY', s: 1 });
  P.set({ col: [0.82, 0.8, 0.76], rm: [0.6, 0, 0] });
  const zc = (D.z0 + D.z1) / 2;
  for (let x = xa; x < xb - 3; x += 9) P.box(x, D.y + 0.004, zc - 0.08, x + 4, D.y + 0.008, zc + 0.08, { faces: 'Y' });
  L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em(led, 2.4, DUSK + code) });
  L.box(xa, D.y - 0.7, D.z0 - 0.07, xb, D.y - 0.5, D.z0); L.box(xa, D.y - 0.7, D.z1, xb, D.y - 0.5, D.z1 + 0.07);
  L.set({ em: em(GOLD, 0.15, DUSK + code) }); L.box(xa, D.y - D.t + 0.05, D.z0 - 0.06, xb, D.y - D.t + 0.18, D.z0); L.box(xa, D.y - D.t + 0.05, D.z1, xb, D.y - D.t + 0.18, D.z1 + 0.06);
}
// the double-decker span over the substation as its own meshes (setpieces drops them)
export function buildSpanMeshes() {
  const M = materials();
  const out = {};
  for (const [name, D] of [['f1', F1], ['f2', F2]]) {
    const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
    const g = new THREE.Group(); g.name = 'span-' + name;
    deckRun(B, 's', { ...D }, PSPAN.x0 + 0.3, PSPAN.x1 - 0.3, DIST.EAST);
    B.finish(g, { shadowKeys: ['concrete'] });
    out[name] = g;
  }
  return out;
}

export function buildEast(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'east';
  const glows = [], lights = [], panes = [], colliders = [];
  const r = makeRng(5151);
  const EC = DIST.EAST;

  // ================================================================== the plaza floor: road, paving, the river railing
  {
    const A = B.get('asphalt', 'pl'), S = B.get('stone', 'pl'), P = B.get('plain', 'pl');
    A.set({ col: [0.46, 0.46, 0.48], rm: [0.3, 0, 0], em: [0, 0, 0, 0] }); A.box(PLAZA.x0, PLAZA.y - 1, EROAD.z0, PLAZA.x1, PLAZA.y, EROAD.z1, { faces: 'Y', s: 1 });
    S.set({ col: [0.58, 0.56, 0.53], rm: [0.55, 0, 0], em: [0, 0, 0, 0] });
    S.box(PLAZA.x0, PLAZA.y - 1, PLAZA.z0, PLAZA.x1, PLAZA.y, EROAD.z0, { faces: 'Y', s: 1 }); S.box(PLAZA.x0, PLAZA.y - 1, EROAD.z1, PLAZA.x1, PLAZA.y, PLAZA.z1, { faces: 'Y', s: 1 });
    P.set({ col: [0.85, 0.65, 0.12], rm: [0.6, 0, 0] }); const zc = (EROAD.z0 + EROAD.z1) / 2;
    P.box(PLAZA.x0, PLAZA.y + 0.004, zc - 0.2, PLAZA.x1, PLAZA.y + 0.008, zc - 0.08, { faces: 'Y' }); P.box(PLAZA.x0, PLAZA.y + 0.004, zc + 0.08, PLAZA.x1, PLAZA.y + 0.008, zc + 0.2, { faces: 'Y' });
    P.set({ col: [0.82, 0.8, 0.76] }); for (let z = EROAD.z0 + 0.5; z < EROAD.z1 - 0.5; z += 1.1) P.box(196, PLAZA.y + 0.004, z, 202, PLAZA.y + 0.008, z + 0.55, { faces: 'Y' });
    // the river railing (steel + glass) along the south edge, lamps
    const Mt = B.get('metal', 'pl'); Mt.set({ col: [0.55, 0.57, 0.6], rm: [0.35, 0.8, 0], em: [0, 0, 0, 0] });
    Mt.box(PLAZA.x0, PLAZA.y + 1.0, PLAZA.z1 - 0.1, CLIMB.x0, PLAZA.y + 1.1, PLAZA.z1); for (let x = PLAZA.x0; x < CLIMB.x0; x += 1.8) Mt.box(x - 0.04, PLAZA.y, PLAZA.z1 - 0.08, x + 0.04, PLAZA.y + 1.05, PLAZA.z1 - 0.02);
    colliders.push({ min: [PLAZA.x0, PLAZA.y, PLAZA.z1 - 0.2], max: [CLIMB.x0, PLAZA.y + 1.1, PLAZA.z1], data: { mat: 'metal', kind: 'rail' } });
    for (let x = PLAZA.x0 + 10; x < CLIMB.x0 - 4; x += 18) lampPost(B, 'pl', x, PLAZA.y, PLAZA.z1 - 1, { dir: [0, 0, -1], two: true, h: 8, code: EC, lights, glows, grp: 2 });
    for (let x = PLAZA.x0 + 14; x < CLIMB.x0; x += 26) tree(B, 'pl', x, PLAZA.y, PLAZA.z1 - 4.2, 1.0, 900 + x, colliders);
    // the north edge: shopfronts under the flyovers' shadow (facing south at z 40)
    const F = new Frame(frontM('x', 1, [0, PLAZA.z0]));
    shopRow(B, 'pl', F, { u0: PLAZA.x0 + 2, u1: RAMP_N.x0 - 4, y: PLAZA.y, seed: 151, code: EC, depth: 10, storeys: 3, lights, glows, panes, colliders, grp: 2, lotW: 7, lotV: 3, endL: true, endR: true });
    shopRow(B, 'pl', F, { u0: RAMP_N.x1 + 4, u1: 232, y: PLAZA.y, seed: 153, code: EC, depth: 10, storeys: 3, lights, glows, panes, colliders, grp: 2, lotW: 7, lotV: 3, endL: true, endR: true });
    // the plaza dressing: a kiosk, a burnt bus, crowd barriers, scooters, hotpot tables by the shops
    const Pp = B.get('plain', 'pl');
    Pp.set({ col: [0.6, 0.16, 0.1], rm: [0.6, 0, 0], em: [0, 0, 0, 0] }); Pp.box(186, PLAZA.y, 72, 190, PLAZA.y + 2.6, 76, { faces: 'xXzZY' });
    Pp.set({ col: [1, 0.9, 0.7], em: em([1, 0.75, 0.45], 1.0, DUSK + EC) }); Pp.box(186.2, PLAZA.y + 1.0, 75.95, 189.8, PLAZA.y + 2.0, 76.05, { faces: 'Z' });
    colliders.push({ min: [186, PLAZA.y, 72], max: [190, PLAZA.y + 2.6, 76], data: { mat: 'metal', kind: 'kiosk' } });
    lights.push({ p: [188, PLAZA.y + 2.2, 77.5], color: [1, 0.7, 0.4], r: 6, k: 1.0, grp: 2 });
    Pp.set({ col: [0.7, 0.72, 0.74], rm: [0.4, 0.8, 0] });
    for (const [x, z, yaw] of [[204, 82, 0.1], [222, 79, -0.2], [240, 86, 0.05], [276, 80, 0.3]]) { const L = 2.4, c = Math.cos(yaw), s = Math.sin(yaw); Pp.obox(x, PLAZA.y + 0.55, z, L / 2, 0.55, 0.04, -yaw); colliders.push({ min: [x - L / 2, PLAZA.y, z - 0.3], max: [x + L / 2, PLAZA.y + 1.1, z + 0.3], data: { mat: 'metal', kind: 'barrier' } }); void c; void s; }
    for (let i = 0; i < 6; i++) scooter(B, 'pl', 180 + i * 1.0, PLAZA.y, 44.2, Math.PI / 2 + 0.1, 600 + i);
    for (const [x, z] of [[214, 43.5], [217, 43.6], [224, 43.4]]) hotpot(B, 'pl', x, PLAZA.y, z, 640 + x, EC, glows);
    // lanterns strung from the flyover's piers across the plaza (they survive until the power goes)
    for (const x of [184, 216]) lanternString(B, 'pl', [x, F1.y - 2.4, F1.z1 + 0.5], [x + 10, PLAZA.y + 6.5, EROAD.z0 - 2], 6, 1.2, EC, glows, 0.8);
  }
  // ================================================================== the stacked interchange
  {
    const reg = 'ic', C = B.get('concrete', reg);
    // both decks, west tunnel portal → past the plaza east, the pancake span left out
    for (const D of [F1, F2]) { deckRun(B, reg, D, RAVINE.x0, PSPAN.x0, EC); deckRun(B, reg, D, PSPAN.x1, D.x1, EC); }
    // rebar at the torn ends (hidden inside the span until it goes): bent bars and a ragged lip
    { const Rb = B.get('metal', reg); Rb.set({ col: [0.22, 0.16, 0.12], rm: [0.7, 0.6, 0], em: [0, 0, 0, 0] });
      let q = 7;
      for (const D of [F1, F2]) for (const [xe, sx] of [[PSPAN.x0, 1], [PSPAN.x1, -1]]) for (let z = D.z0 + 0.6; z < D.z1 - 0.4; z += 0.55) {
        q = (q * 9301 + 49297) % 233280; const r1 = q / 233280; q = (q * 9301 + 49297) % 233280; const r2 = q / 233280;
        const y = D.y - D.t * (0.25 + 0.5 * r1), L = 0.6 + r2 * 1.4;
        Rb.beam([xe, y, z], [xe + sx * L, y - (r1 - 0.3) * 0.9, z + (r2 - 0.5) * 0.4], 0.035, 0.035);
      } }
    for (const D of [F1, F2]) for (const [a, b] of [[RAVINE.x0, PSPAN.x0], [PSPAN.x1, 300]]) {
      colliders.push({ min: [Math.max(a, PLAZA.x0), D.y - D.t, D.z0], max: [b, D.y, D.z1], data: { mat: 'concrete', kind: 'deck', layer: 'deck' } });
      colliders.push({ min: [Math.max(a, PLAZA.x0), D.y, D.z1 - 0.5], max: [b, D.y + 1.0, D.z1], data: { mat: 'concrete', kind: 'parapet', layer: 'deck' } });
    }
    // the pancake span's colliders are added by setpieces (they move)
    // piers: tall twin columns up to F2 with a cap beam, F1 sitting on corbels; tunnel portals in the west ravine wall
    C.set({ col: [0.62, 0.62, 0.6], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
    for (const x of FPIERS) {
      const base = PLAZA.y;
      for (const z of [F2.z0 + 2.2, F2.z1 - 2.2]) { C.cyl(x, base, z, 1.3, 1.1, F2.y - F2.t, 12); if (x <= 300) colliders.push({ min: [x - 1.2, base, z - 1.2], max: [x + 1.2, F2.y - F2.t, z + 1.2], data: { mat: 'concrete', kind: 'pier' } }); }
      C.box(x - 1.6, F2.y - F2.t - 1.4, F2.z0 - 0.5, x + 1.6, F2.y - F2.t, F2.z1 + 0.5, { faces: 'xXzZy', s: 1 });
      C.box(x - 1.4, F1.y - F1.t - 1.2, F1.z0 - 0.4, x + 1.4, F1.y - F1.t, F1.z1 + 0.4, { faces: 'xXzZy', s: 1 });
    }
    C.box(RAVINE.x0 - 4, F1.y - 8, F2.z0 - 4, RAVINE.x0, F2.y + 8, F2.z1 + 4, { faces: 'X', s: 1 });
    // the east terrace wall the decks tunnel into (Sky Street sits on top of it)
    C.box(F2.x1, PLAZA.y, 20, F2.x1 + 2, 56, 84, { faces: 'x', s: 1 });
    { const Lp = B.get('plain', reg); Lp.set({ col: [0.03, 0.03, 0.03], rm: [0.9, 0, 0], em: em([1.0, 0.6, 0.3], 0.8, DUSK + EC) }); Lp.box(F2.x1 - 0.02, F1.y, F1.z0 + 1, F2.x1 + 0.2, F1.y + 5, F1.z1 - 1, { faces: 'x' }); Lp.box(F2.x1 - 0.02, F2.y, F2.z0 + 1, F2.x1 + 0.2, F2.y + 5.5, F2.z1 - 1, { faces: 'x' }); }
    const L = B.get('plain', reg); L.set({ col: [0.03, 0.03, 0.03], rm: [0.9, 0, 0], em: em([1.0, 0.6, 0.3], 0.8, DUSK + EC) });
    L.box(RAVINE.x0 - 0.2, F1.y, F1.z0 + 1, RAVINE.x0 + 0.02, F1.y + 5, F1.z1 - 1, { faces: 'X' }); L.box(RAVINE.x0 - 0.2, F2.y, F2.z0 + 1, RAVINE.x0 + 0.02, F2.y + 5.5, F2.z1 - 1, { faces: 'X' });
    // the ramp curling up the hill off F2 (scenery): a rising deck north on its own piers
    {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const za = F2.z0 - i * 11, zb = za - 11, ya = F2.y + i * 0.9, yb = ya + 0.9;
        C.set({ col: DECKC }); C.quad([RAMP_N.x0, ya - 1.8, za], [RAMP_N.x1, ya - 1.8, za], [RAMP_N.x1, yb - 1.8, zb], [RAMP_N.x0, yb - 1.8, zb]);
        C.quad([RAMP_N.x0, ya, za], [RAMP_N.x0, yb, zb], [RAMP_N.x1, yb, zb], [RAMP_N.x1, ya, za]);
        C.quad([RAMP_N.x0, ya - 1.8, za], [RAMP_N.x0, yb - 1.8, zb], [RAMP_N.x0, yb + 1, zb], [RAMP_N.x0, ya + 1, za]);
        C.quad([RAMP_N.x1, yb - 1.8, zb], [RAMP_N.x1, ya - 1.8, za], [RAMP_N.x1, ya + 1, za], [RAMP_N.x1, yb + 1, zb]);
        if (i % 2 === 1) C.cyl((RAMP_N.x0 + RAMP_N.x1) / 2, i < 4 ? PLAZA.y : 64, zb, 1.2, 1.0, yb - 1.8, 10);
        L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em([0.55, 0.78, 1.0], 0.15, DUSK + EC) });
        L.beam([RAMP_N.x0 - 0.05, ya - 0.6, za], [RAMP_N.x0 - 0.05, yb - 0.6, zb], 0.1, 0.18); L.beam([RAMP_N.x1 + 0.05, ya - 0.6, za], [RAMP_N.x1 + 0.05, yb - 0.6, zb], 0.1, 0.18);
      }
    }
    // gantry signs over F2 and over the plaza road (green, lit)
    const Sg = B.get('sign', reg), Mt = B.get('metal', reg);
    Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 0.9, DUSK + EC) }); Mt.set({ col: [0.5, 0.52, 0.55], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
    for (const [x, D, name] of [[268, F2, 'highway1'], [200, F2, 'highway2']]) {
      Mt.box(x - 0.2, D.y, D.z0 + 0.3, x + 0.2, D.y + 7.2, D.z0 + 0.7); Mt.box(x - 0.2, D.y, D.z1 - 0.7, x + 0.2, D.y + 7.2, D.z1 - 0.3); Mt.box(x - 0.25, D.y + 6.8, D.z0 + 0.3, x + 0.25, D.y + 7.2, D.z1 - 0.3);
      signQuad(Sg, [x - 0.3, D.y + 5.2, (D.z0 + D.z1) / 2], [-1, 0, 0], 8, 3.4, SIGN[name]);
      glows.push({ p: [x - 1.2, D.y + 5.2, (D.z0 + D.z1) / 2], color: [0.4, 1.0, 0.6], size: 4, code: DUSK + EC });
    }
    for (let x = 160; x < 300; x += 24) for (const D of [F2]) lampPost(B, reg, x, D.y + 1, D.z1 - 0.3, { dir: [0, 0, -1], h: 8, code: EC, lights: null, glows, col: SODIUM });
    // the plaza under the decks: sodium lights on the piers' cap beams
    for (const x of FPIERS) { L.set({ col: [1, 1, 1], em: em(SODIUM, 3, DUSK + EC) }); L.box(x - 0.4, F1.y - F1.t - 1.3, F1.z1 + 0.3, x + 0.4, F1.y - F1.t - 1.2, F1.z1 + 0.9, { faces: 'y' }); lights.push({ p: [x, F1.y - F1.t - 1.5, F1.z1 + 0.6], color: [1, 0.55, 0.22], r: 11, k: 1.6, grp: 2 }); glows.push({ p: [x, F1.y - F1.t - 1.6, F1.z1 + 0.6], color: [2.2, 1.1, 0.4], size: 2.6, code: DUSK + EC }); }
  }
  // ================================================================== the substation (fenced, under the flyovers' south edge)
  const subst = { transformers: [] };
  {
    const reg = 'ss', S = SUBST, Mt = B.get('metal', reg), P = B.get('plain', reg), C = B.get('concrete', reg);
    C.set({ col: [0.5, 0.5, 0.48], rm: [0.85, 0, 0], em: [0, 0, 0, 0] }); C.box(S.x0, PLAZA.y, S.z0, S.x1, PLAZA.y + 0.3, S.z1, { faces: 'xXzZY', s: 1 });
    // chain-link fence (a dark see-through grid of thin bars) with the warning plates
    Mt.set({ col: [0.38, 0.4, 0.42], rm: [0.4, 0.8, 0] });
    const fence = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 0.25); for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; Mt.box(x - 0.012, PLAZA.y, z - 0.012, x + 0.012, PLAZA.y + 2.6, z + 0.012, { faces: 'xXzZ' }); } Mt.beam([x0, PLAZA.y + 2.6, z0], [x1, PLAZA.y + 2.6, z1], 0.05, 0.05); Mt.beam([x0, PLAZA.y + 0.1, z0], [x1, PLAZA.y + 0.1, z1], 0.05, 0.05); colliders.push({ min: [Math.min(x0, x1) - 0.05, PLAZA.y, Math.min(z0, z1) - 0.05], max: [Math.max(x0, x1) + 0.05, PLAZA.y + 2.6, Math.max(z0, z1) + 0.05], data: { mat: 'fence', kind: 'fence', noBullet: true } }); };
    fence(S.x0, S.z1, S.x1, S.z1); fence(S.x0, S.z0, S.x0, S.z1); fence(S.x1, S.z0, S.x1, S.z1);
    const Sg = B.get('sign', reg); Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 0.4, DUSK + EC) });
    for (const x of [S.x0 + 6, S.x1 - 8]) signQuad(Sg, [x, PLAZA.y + 1.6, S.z1 + 0.05], [0, 0, 1], 1.6, 0.8, SIGN.danger);
    // transformers: finned tanks with insulator bushings; a gantry of insulators and the bus bars over them
    for (let i = 0; i < 3; i++) {
      const x = S.x0 + 6 + i * 11, z = (S.z0 + S.z1) / 2 + 1;
      P.set({ col: [0.24, 0.28, 0.26], rm: [0.5, 0.5, 0], em: [0, 0, 0, 0] });   // utility green-grey, oil-stained
      P.box(x - 2.2, PLAZA.y + 0.3, z - 1.6, x + 2.2, PLAZA.y + 3.6, z + 1.6, { faces: 'xXzZY' });
      for (let f = -1.8; f <= 1.8; f += 0.3) { P.box(x + f - 0.03, PLAZA.y + 0.6, z - 2.2, x + f + 0.03, PLAZA.y + 3.2, z - 1.6, { faces: 'xXzZY' }); P.box(x + f - 0.03, PLAZA.y + 0.6, z + 1.6, x + f + 0.03, PLAZA.y + 3.2, z + 2.2, { faces: 'xXzZY' }); }
      P.set({ col: [0.3, 0.16, 0.09], rm: [0.3, 0, 0] }); for (const dx of [-1.2, 0, 1.2]) P.cyl(x + dx, PLAZA.y + 3.6, z, 0.18, 0.12, PLAZA.y + 5.2, 6);
      colliders.push({ min: [x - 2.3, PLAZA.y, z - 2.3], max: [x + 2.3, PLAZA.y + 3.7, z + 2.3], data: { mat: 'metal', kind: 'transformer' } });
      subst.transformers.push(new THREE.Vector3(x, PLAZA.y + 4.5, z));
    }
    Mt.set({ col: [0.5, 0.52, 0.55], rm: [0.4, 0.8, 0] });
    for (const x of [S.x0 + 2, S.x1 - 2]) for (const z of [S.z0 + 2, S.z1 - 2]) Mt.box(x - 0.2, PLAZA.y, z - 0.2, x + 0.2, PLAZA.y + 9, z + 0.2);
    for (const z of [S.z0 + 2, S.z1 - 2]) Mt.box(S.x0 + 2, PLAZA.y + 8.8, z - 0.2, S.x1 - 2, PLAZA.y + 9.2, z + 0.2);
    for (let i = 0; i < 3; i++) Mt.beam([S.x0 + 2, PLAZA.y + 8.5, S.z0 + 4 + i * 5], [S.x1 - 2, PLAZA.y + 8.5, S.z0 + 4 + i * 5], 0.1, 0.1);
    // the floodlights over the yard (sodium): the brightest light on the plaza
    for (const x of [S.x0 + 4, S.x1 - 4]) { const L = B.get('plain', reg); L.set({ col: [1, 1, 1], em: em(SODIUM, 3.5, DUSK + EC) }); L.box(x - 0.5, PLAZA.y + 9.4, S.z1 - 2.5, x + 0.5, PLAZA.y + 9.9, S.z1 - 2, { faces: 'yZ' }); glows.push({ p: [x, PLAZA.y + 9.6, S.z1 - 1.8], color: [2.4, 1.2, 0.45], size: 3.4, code: DUSK + EC }); lights.push({ p: [x, PLAZA.y + 9.6, S.z1 + 1], color: [1, 0.55, 0.22], r: 14, k: 1.8, grp: 2 }); }
  }
  // ================================================================== the climb (a stair street up to the cliff top)
  {
    const reg = 'cl', S = B.get('stone', reg);
    S.set({ col: [0.64, 0.61, 0.58], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    for (let i = 1; i < CLIMB_PROFILE.length; i++) {
      const [x0, y0] = CLIMB_PROFILE[i - 1], [x1, y1] = CLIMB_PROFILE[i];
      if (Math.abs(y1 - y0) < 0.01) { S.box(x0, y0 - 0.8, CLIMB.z0, x1, y0, CLIMB.z1, { faces: 'Y', s: 1 }); continue; }
      const n = Math.round((y1 - y0) / 0.16), run = (x1 - x0) / n;
      for (let k = 0; k < n; k++) {
        const xa = x0 + k * run, yb = y0 + (k + 1) * (y1 - y0) / n, ya = y0 + k * (y1 - y0) / n;
        const g = 0.92 + ((k * 37) % 7) / 60;
        S.set({ col: [0.64 * g, 0.61 * g, 0.58 * g] }); S.box(xa, ya - 0.6, CLIMB.z0, xa + run, yb, CLIMB.z1, { faces: 'Y', s: 1 });
        S.set({ col: [0.5 * g, 0.48 * g, 0.46 * g] }); S.box(xa, ya, CLIMB.z0, xa + 0.02, yb, CLIMB.z1, { faces: 'x', s: 1 });
        S.set({ col: [0.38 * g, 0.36 * g, 0.34 * g] }); S.box(xa, yb, CLIMB.z0, xa + 0.07, yb + 0.004, CLIMB.z1, { faces: 'Y', s: 1 });
      }
    }
    // north side: shophouses stepping up; south side: a stone wall over the river with lamps
    for (let u = CLIMB.x0 + 1; u < CLIMB.x1 - 3; u += 7) {
      const F = new Frame(frontM('x', 1, [0, CLIMB.z0]));
      shopRow(B, reg, F, { u0: u, u1: u + 7, y: climbY(u + 3.5), seed: 170 + u, code: EC, depth: 10, storeys: 3 + Math.floor(r() * 3), lights, glows, panes, colliders, grp: 2, lotW: 7, lotV: 0, endL: true, endR: true });
      const C2 = B.get('stone', reg); C2.set({ col: [0.5, 0.48, 0.45], rm: [0.8, 0, 0] }); C2.box(u, Math.min(climbY(u), climbY(u + 7)) - 1, CLIMB.z0 - 10, u + 7, climbY(u + 3.5), CLIMB.z0, { faces: 'Z', s: 1 });
    }
    const W = B.get('stone', reg); W.set({ col: [0.6, 0.58, 0.55], rm: [0.7, 0, 0] });
    for (let x = CLIMB.x0; x < CLIMB.x1; x += 2) { const y = climbY(x + 1); W.box(x, y - 0.5, CLIMB.z1, x + 2, y + 1.1, CLIMB.z1 + 0.5, { faces: 'zZY', s: 1 }); colliders.push({ min: [x, y - 0.5, CLIMB.z1], max: [x + 2, y + 1.1, CLIMB.z1 + 0.5], data: { mat: 'stone', kind: 'parapet' } }); }
    for (const x of [300, 318]) lampPost(B, reg, x, climbY(x), CLIMB.z1 - 0.6, { dir: [0, 0, -1], h: 6, code: EC, lights, glows, grp: 2 });
    for (let x = CLIMB.x0 + 4; x < CLIMB.x1 - 4; x += 8) lanternString(B, reg, [x, climbY(x) + 6.5, CLIMB.z0 + 0.3], [x + 5, climbY(x + 5) + 6.5, CLIMB.z1 - 0.3], 4, 0.8, EC, glows, 0.75);
  }
  // ================================================================== Sky Street (the cliff top) and the footbridge
  {
    const reg = 'sk', S = SKYST, A = B.get('asphalt', reg), St = B.get('stone', reg), P = B.get('plain', reg);
    A.set({ col: [0.46, 0.46, 0.48], rm: [0.3, 0, 0], em: [0, 0, 0, 0] }); A.box(S.x0 + 6, S.y - 1, S.z0, S.x1 - 6, S.y, S.z1 - 14, { faces: 'Y', s: 1 });
    St.set({ col: [0.6, 0.58, 0.55], rm: [0.55, 0, 0], em: [0, 0, 0, 0] });
    St.box(S.x0, S.y - 1, S.z0, S.x0 + 6, S.y, S.z1, { faces: 'Y', s: 1 }); St.box(S.x1 - 6, S.y - 1, S.z0, S.x1, S.y, S.z1, { faces: 'Y', s: 1 }); St.box(S.x0 + 6, S.y - 1, S.z1 - 14, S.x1 - 6, S.y, S.z1, { faces: 'Y', s: 1 });
    // shop walls both sides (west side leaves the opening the climb arrives through)
    shopRow(B, reg, new Frame(frontM('z', 1, [S.x0, 0])), { u0: -(CLIMB.z0 - 0.5), u1: -S.z0, y: S.y, seed: 181, code: EC, depth: 10, storeys: 5, lights, glows, panes, colliders, grp: 2, lotW: 8, lotV: 3, endL: true, endR: true });
    shopRow(B, reg, new Frame(frontM('z', -1, [S.x1, 0])), { u0: S.z0, u1: S.z1 - 14, y: S.y, seed: 183, code: EC, depth: 10, storeys: 6, lights, glows, panes, colliders, grp: 2, lotW: 8, lotV: 3, endL: true, endR: true });
    // the railing at the south end with the footbridge's gap; lamps; a big LED ad on the east block's end
    const Mt = B.get('metal', reg); Mt.set({ col: [0.55, 0.57, 0.6], rm: [0.35, 0.8, 0], em: [0, 0, 0, 0] });
    for (const [x0, x1] of [[S.x0, FOOTB.x0], [FOOTB.x1, S.x1]]) { Mt.box(x0, S.y + 1.0, S.z1 - 0.1, x1, S.y + 1.1, S.z1); for (let x = x0; x < x1; x += 1.6) Mt.box(x - 0.04, S.y, S.z1 - 0.08, x + 0.04, S.y + 1.05, S.z1 - 0.02); colliders.push({ min: [x0, S.y, S.z1 - 0.2], max: [x1, S.y + 1.1, S.z1], data: { mat: 'metal', kind: 'rail' } }); }
    for (const [x, z, d] of [[S.x0 + 2, 52, [1, 0, 0]], [S.x1 - 2, 70, [-1, 0, 0]], [S.x0 + 2, 88, [1, 0, 0]], [S.x1 - 2, 100, [-1, 0, 0]]]) lampPost(B, reg, x, S.y, z, { dir: d, two: false, h: 7.5, code: EC, lights, glows, grp: 2 });
    const Sg = B.get('sign', reg); Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.5, DUSK + EC) });
    signQuad(Sg, [S.x0 + 0.1, S.y + 14, (S.z0 + CLIMB.z0) / 2], [1, 0, 0], 16, 8, SIGN.ad1);
    signQuad(Sg, [(S.x0 + S.x1) / 2, S.y + 7.2, S.z0 + 0.2], [0, 0, 1], 9, 2.2, SIGN.skyst);
    glows.push({ p: [S.x0 + 3, S.y + 14, (S.z0 + CLIMB.z0) / 2], color: [1.6, 0.3, 0.15], size: 12, code: DUSK + EC });
    // the north end: a lit archway the street disappears through (closed off)
    const C = B.get('concrete', reg); C.set({ col: [0.55, 0.55, 0.53], rm: [0.85, 0, 0] }); C.box(S.x0, S.y, S.z0 - 1, S.x1, S.y + 12, S.z0, { faces: 'Z', s: 1 });
    colliders.push({ min: [S.x0, S.y, S.z0 - 1], max: [S.x1, S.y + 12, S.z0], data: { mat: 'concrete', kind: 'wall' } });
    // the footbridge: a glass-sided bridge into the tower's sky lobby
    const Fb = FOOTB;
    St.set({ col: [0.5, 0.5, 0.52], rm: [0.4, 0, 0] }); St.box(Fb.x0, Fb.y - 1, Fb.z0, Fb.x1, Fb.y, Fb.z1 + 1, { faces: 'Yyx X', s: 1 });
    Mt.set({ col: [0.3, 0.32, 0.34], rm: [0.4, 0.8, 0] });
    Mt.box(Fb.x0 - 0.2, Fb.y - 1.2, Fb.z0, Fb.x0, Fb.y + 3.4, Fb.z1, { faces: 'x' }); Mt.box(Fb.x1, Fb.y - 1.2, Fb.z0, Fb.x1 + 0.2, Fb.y + 3.4, Fb.z1, { faces: 'X' });
    Mt.box(Fb.x0 - 0.3, Fb.y + 3.4, Fb.z0, Fb.x1 + 0.3, Fb.y + 3.7, Fb.z1, { faces: 'xXYy' });
    for (let z = Fb.z0; z <= Fb.z1; z += 3) { Mt.box(Fb.x0 - 0.25, Fb.y, z - 0.1, Fb.x0, Fb.y + 3.4, z + 0.1); Mt.box(Fb.x1, Fb.y, z - 0.1, Fb.x1 + 0.25, Fb.y + 3.4, z + 0.1); }
    for (const x of [Fb.x0 - 0.1, Fb.x1 + 0.1]) { panes.push({ c: [x, Fb.y + 1.7, (Fb.z0 + Fb.z1) / 2], n: [1, 0, 0], w: Fb.z1 - Fb.z0, h: 3.3, kind: 'lobby' }); colliders.push({ min: [x - 0.15, Fb.y, Fb.z0], max: [x + 0.15, Fb.y + 3.4, Fb.z1], data: { mat: 'metal', kind: 'wall', noBullet: true } }); }
    // a dark ceiling with two strip lights (a whole lit ceiling blows out)
    P.set({ col: [0.16, 0.16, 0.17], rm: [0.6, 0, 0], em: [0, 0, 0, 0] }); P.box(Fb.x0, Fb.y + 3.38, Fb.z0, Fb.x1, Fb.y + 3.4, Fb.z1, { faces: 'y' });
    P.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em(COOLW, 1.3, DUSK + DIST.TOWER) }); for (const x of [Fb.x0 + 2.5, Fb.x1 - 2.7]) P.box(x, Fb.y + 3.3, Fb.z0 + 0.5, x + 0.2, Fb.y + 3.36, Fb.z1 - 0.5, { faces: 'yxX' });
    lights.push({ p: [(Fb.x0 + Fb.x1) / 2, Fb.y + 3.2, (Fb.z0 + Fb.z1) / 2], color: COOLW, r: 6, k: 0.45, grp: 2 });
  }
  const { tris } = B.finish(root, { shadowKeys: ['concrete', 'metal', 'plain'] });
  return { root, anchors: { glows, lights, named: { subst } }, panes, colliders, tris };
}
