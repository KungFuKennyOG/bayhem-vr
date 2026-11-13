import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, em, mul3, hexc, GOLD, SODIUM, DUSK, signQuad, hipRoof } from './kit.js';
import { materials } from './mats.js';
import { SIGN, SIGN_LIST } from './signs.js';
import { Frame, frontM, shopRow, lampPost, lantern, lanternString, cables, tree, hotpot, scooter } from './kitbuild.js';
import { towerBlock } from './city.js';
import { DIST, STEPS_AT } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the opening: the Longwu Department Store's roof and the HUNDRED STEPS.
//
//  This is the first version's opening, the part of it that worked (Kenny: "I really liked the first
//  stairs"): the rooftop car park where the ring road comes out, granite flights and landings
//  between old shophouses, lanterns strung overhead, the ring-road flyover crossing over the stairs.
//
//  It is built exactly as it was, IN ITS OWN OLD FRAME (the numbers below are the first version's
//  layout: the steps fall toward +x from the roof at y 64 to y 50), and then the whole thing is
//  turned a quarter turn and set down so the steps fall NORTH into Kuixing Plaza (layout.STEPS_AT):
//    new x = 320 + old z,   new y = old y − 30,   new z = 278 − old x.
//  Colliders, glows and lights are carried through the same transform. Gameplay never reads the old
//  frame: layout.js has the steps' profile and the roof in world coordinates (STEPS, TOPROOF, stepY).
// =====================================================================================
const ROOF = { x0: -172, x1: -128, z0: 50, z1: 96, y: 64 };
const RING = { x0: -164, x1: -146, z0: 20, z1: 50, y: 64 };            // the ring road arriving on the roof (barricaded)
const RING_BLOCK = 34;
const STAIRS = { x0: -128, x1: -64, z0: 70, z1: 82 };
const STAIR_PROFILE = [[-128, 64], [-119, 64], [-112, 59.5], [-99, 59.5], [-92, 55], [-77, 55], [-69, 50], [-64, 50]];
const FLYOVER_W = { x0: -94, x1: -80, z0: -40, z1: 200, y: 64.6, t: 1.4 };
const stairY = (x) => { const P = STAIR_PROFILE; if (x <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const [x0, y0] = P[i - 1], [x1, y1] = P[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return P[P.length - 1][1]; };

export function buildSteps(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'steps';
  const glows = [], lights = [], panes = [], colliders = [];
  const r = makeRng(77);
  const W0 = DIST.R0, LS = DIST.R0;   // the steps are on the road's first section: they go out with it in the wave

  // ================================================================== the roof (y 64) and the ring road
  {
    const S = B.get('stone', 'roof'), C = B.get('concrete', 'roof'), A = B.get('asphalt', 'roof'), P = B.get('plain', 'roof');
    S.set({ col: [0.62, 0.6, 0.58], rm: [0.55, 0, 0], em: [0, 0, 0, 0] });
    A.set({ col: [0.6, 0.6, 0.6], rm: [0.4, 0, 0], em: [0, 0, 0, 0] });
    C.set({ col: [0.4, 0.39, 0.38], rm: [0.75, 0, 0], em: [0, 0, 0, 0] }); C.box(ROOF.x0, ROOF.y - 1.2, ROOF.z0, ROOF.x1, ROOF.y, ROOF.z1, { faces: 'Y', s: 1 });   // the car-park deck: concrete (the asphalt texture read as leopard spots)
    A.box(RING.x0, ROOF.y - 1.2, RING.z0, RING.x1, ROOF.y, ROOF.z0, { faces: 'Y', s: 1 });
    // painted parking bays + arrows (thin light quads just over the asphalt)
    P.set({ col: [0.8, 0.78, 0.7], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    for (let x = ROOF.x0 + 3; x < ROOF.x1 - 6; x += 2.8) { P.box(x, ROOF.y + 0.005, ROOF.z0 + 2, x + 0.12, ROOF.y + 0.01, ROOF.z0 + 7, { faces: 'Y' }); P.box(x, ROOF.y + 0.005, ROOF.z1 - 7, x + 0.12, ROOF.y + 0.01, ROOF.z1 - 2, { faces: 'Y' }); }
    for (let z = RING.z0; z < ROOF.z0; z += 9) P.box((RING.x0 + RING.x1) / 2 - 0.08, ROOF.y + 0.005, z, (RING.x0 + RING.x1) / 2 + 0.08, ROOF.y + 0.01, z + 4.5, { faces: 'Y' });
    P.set({ col: [0.85, 0.65, 0.12] });
    P.box(RING.x0 + 0.3, ROOF.y + 0.005, RING.z0, RING.x0 + 0.45, ROOF.y + 0.01, ROOF.z0, { faces: 'Y' }); P.box(RING.x1 - 0.45, ROOF.y + 0.005, RING.z0, RING.x1 - 0.3, ROOF.y + 0.01, ROOF.z0, { faces: 'Y' });
    // parapets (the east edge opens onto the stairs)
    C.set({ col: [0.56, 0.54, 0.5], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    const par = (x0, z0, x1, z1) => { C.box(x0, ROOF.y, z0, x1, ROOF.y + 1.15, z1, { faces: 'xXzZY', s: 1 }); colliders.push({ min: [x0, ROOF.y, z0], max: [x1, ROOF.y + 1.15, z1], data: { mat: 'concrete', kind: 'parapet' } }); };
    par(ROOF.x0 - 0.5, ROOF.z0, ROOF.x0, ROOF.z1 + 0.5);
    // the gorge side: a low kerb and a steel rail you can see over (the river, the cliff houses, the bridge below)
    {
      const z0 = ROOF.z1, z1 = ROOF.z1 + 0.5, xa = ROOF.x0, xb = ROOF.x1 + 0.5;
      C.box(xa, ROOF.y, z0, xb, ROOF.y + 0.45, z1, { faces: 'xXzZY', s: 1 });
      const Rl = B.get('metal', 'roof'); Rl.set({ col: [0.62, 0.64, 0.66], rm: [0.35, 0.85, 0], em: [0, 0, 0, 0] });
      Rl.box(xa, ROOF.y + 1.08, z0 + 0.12, xb, ROOF.y + 1.16, z1 - 0.12, { faces: 'zZYy' });
      Rl.box(xa, ROOF.y + 0.78, z0 + 0.2, xb, ROOF.y + 0.82, z1 - 0.2, { faces: 'zZYy' });
      for (let x = xa + 0.6; x < xb; x += 1.8) Rl.box(x - 0.04, ROOF.y + 0.45, z0 + 0.21, x + 0.04, ROOF.y + 1.08, z1 - 0.21, { faces: 'xXzZ' });
      colliders.push({ min: [xa, ROOF.y, z0], max: [xb, ROOF.y + 1.16, z1], data: { mat: 'metal', kind: 'rail', noBullet: false } });
    }
    par(ROOF.x1, ROOF.z0, ROOF.x1 + 0.5, STAIRS.z0); par(ROOF.x1, STAIRS.z1, ROOF.x1 + 0.5, ROOF.z1);
    par(ROOF.x0, ROOF.z0 - 0.5, RING.x0, ROOF.z0); par(RING.x1, ROOF.z0 - 0.5, ROOF.x1 + 0.5, ROOF.z0);
    // the ring road's guard rails and the police barricade where it's closed
    const Mt = B.get('metal', 'roof'); Mt.set({ col: [0.7, 0.72, 0.74], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
    for (const x of [RING.x0 - 0.1, RING.x1 + 0.1]) { Mt.box(x - 0.08, ROOF.y + 0.55, RING.z0, x + 0.08, ROOF.y + 0.85, ROOF.z0, { faces: 'xXY' }); for (let z = RING.z0; z < ROOF.z0; z += 4) Mt.box(x - 0.06, ROOF.y, z, x + 0.06, ROOF.y + 0.8, z + 0.12, { faces: 'xXzZ' }); }
    // barricade: jersey barriers and a crashed bus across the road
    C.set({ col: [0.7, 0.68, 0.64] });
    for (let x = RING.x0; x < RING.x1; x += 3.2) { C.box(x + 0.1, ROOF.y, RING_BLOCK - 0.4, x + 3.0, ROOF.y + 0.95, RING_BLOCK + 0.4, { faces: 'xXzZY', s: 1 }); }
    colliders.push({ min: [RING.x0, ROOF.y, RING_BLOCK - 0.4], max: [RING.x1, ROOF.y + 0.95, RING_BLOCK + 0.4], data: { mat: 'concrete', kind: 'jersey' } });
    const Sg = B.get('sign', 'roof');
    Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 0.8, DUSK + W0) });
    for (let x = RING.x0 + 1.2; x < RING.x1 - 1; x += 3.2) signQuad(Sg, [x + 1.2, ROOF.y + 0.62, RING_BLOCK + 0.42], [0, 0, 1], 2.6, 0.5, SIGN.stripe);
    // the ring road comes out of the block next door (it is only a barricaded stub now)
    towerBlock(B, { x0: -172, z0: -12, x1: -138, z1: 20, y0: 3, h: 104, style: 2, seed: 4403, crown: 'led', roofSign: null, dist: W0, podium: false }, 'roof', glows);
    // rooftop plant: HVAC units, a water tank on legs, a stair house, a satellite dish
    P.set({ col: [0.62, 0.63, 0.62], rm: [0.6, 0.2, 0], em: [0, 0, 0, 0] });
    for (const [x, z] of [[-168, 56], [-160, 56], [-152, 56], [-168, 92], [-160, 92]]) { P.box(x, ROOF.y, z - 1.6, x + 3.6, ROOF.y + 1.8, z + 1.6, { faces: 'xXzZY' }); colliders.push({ min: [x, ROOF.y, z - 1.6], max: [x + 3.6, ROOF.y + 1.8, z + 1.6], data: { mat: 'metal', kind: 'hvac' } }); }
    C.set({ col: [0.6, 0.58, 0.55] }); C.box(-140, ROOF.y, 52, -132, ROOF.y + 3.4, 60, { faces: 'xXzZY', s: 1 }); colliders.push({ min: [-140, ROOF.y, 52], max: [-132, ROOF.y + 3.4, 60], data: { mat: 'concrete', kind: 'shack' } });
    P.set({ col: [0.5, 0.55, 0.6] }); P.cyl(-136, ROOF.y + 3.4, 56, 2.2, 2.2, ROOF.y + 6.4, 10);
    // the store's name on a steel frame along the west edge, facing the roof and the stairs (red, lit)
    const F = B.get('metal', 'roof'); F.set({ col: [0.2, 0.2, 0.22], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
    const sx = ROOF.x0 + 1.5, sy = ROOF.y + 6.2;
    for (let z = 58; z <= 88; z += 6) { F.box(sx - 0.15, ROOF.y, z - 0.15, sx + 0.15, sy + 3.6, z + 0.15); F.beam([sx - 3, ROOF.y, z], [sx, sy, z], 0.2, 0.2); }
    F.box(sx - 0.3, sy - 2.6, 56, sx + 0.1, sy - 2.4, 90); F.box(sx - 0.3, sy + 3.5, 56, sx + 0.1, sy + 3.7, 90);
    Sg.set({ em: em([1, 1, 1], 2.2, DUSK + W0) });
    signQuad(Sg, [sx + 0.2, sy + 0.55, 73], [1, 0, 0], 32, 5.2, SIGN.dept);
    glows.push({ p: [sx + 2.5, sy + 0.5, 73], color: [1.2, 0.2, 0.1], size: 16, code: DUSK + W0, far: true });
    // a few roof lamps (sodium) on the parapet
    for (const [x, z, d] of [[-150, 96, [0, 0, -1]], [-170, 76, [1, 0, 0]], [-130, 60, [-1, 0, 0]]]) lampPost(B, 'roof', x, ROOF.y, z, { dir: d, h: 6.5, code: W0, lights, glows, grp: 0, col: SODIUM });
    for (const z of [30]) { lampPost(B, 'roof', RING.x0 - 0.8, ROOF.y, z, { dir: [1, 0, 0], h: 9, code: W0, lights, glows, grp: 0, col: SODIUM }); }
    // the store itself: its south face over the gorge (lit display windows) and west face
    const T = B.get('tile', 'roof'); T.set({ col: hexc(0xcfc5b4), rm: [0.8, 0, 0], em: [0, 0, 0, W0], cell: [4.2, 4.6, 31, 3] });
    T.box(ROOF.x0, 30, ROOF.z0, ROOF.x1, ROOF.y - 1.2, ROOF.z1, { faces: 'xZ', s: 1, wy0: 30 });
  }

  // ================================================================== the Hundred Steps
  // The light on the stair floor, baked into its vertices (emissive, old frame): red pools under the lantern strings, warm
  // pools under the two lamps and the cart, sodium under the flyover, shop light spilling a metre or two off both walls.
  // The albedo is kept dark so the pools are what you see (it read as a floor lit at noon).
  const POOLS = [];
  for (let x = STAIRS.x0 + 6; x < STAIRS.x1 - 4; x += 7.5) { if (x > -98 && x < -76) continue; POOLS.push([x + 2.5, (STAIRS.z0 + STAIRS.z1) / 2, 3.2, [1.0, 0.32, 0.14], 0.55]); }
  POOLS.push([-104.5, STAIRS.z0 + 2.4, 3.6, [1.0, 0.68, 0.36], 0.75], [-72, STAIRS.z1 - 2.4, 3.6, [1.0, 0.68, 0.36], 0.75], [-86.2, STAIRS.z1 - 2.2, 2.6, [1.0, 0.72, 0.42], 0.6], [-87, 76, 4.2, [1.0, 0.55, 0.22], 0.7]);
  const floorLight = (x, z) => {
    let r0 = 0, g0 = 0, b0 = 0;
    for (const [px, pz, rad, c, k] of POOLS) { const d2 = ((x - px) ** 2 + (z - pz) ** 2) / (rad * rad); if (d2 < 6) { const w = Math.exp(-d2) * k; r0 += c[0] * w; g0 += c[1] * w; b0 += c[2] * w; } }
    if (x > STAIRS.x0 + 0.5) { const dw = Math.min(z - STAIRS.z0, STAIRS.z1 - z), w = Math.exp(-dw / 1.0) * 0.5; r0 += w; g0 += 0.74 * w; b0 += 0.48 * w; }
    const e = 0.035; return [r0 * e, g0 * e, b0 * e, DUSK + W0];
  };
  const dimF = 0.62;   // albedo scale for the stair floor
  {
    // granite steps (polish pass, Nov 13): flat granite treads (no texture: the board-marked concrete made the
    // flights read as one brown ramp), a worn pale nosing on every step and a dark riser under it, so from the top
    // the flight reads as STEPS; a stepped granite cheek down both sides; landings in granite paving.
    const S = B.get('granite', 'stairs'), Pv = B.get('granite', 'stairs'), Jt = B.get('plain', 'stairs');
    Pv.set({ col: [0.62, 0.6, 0.57], rm: [0.62, 0, 0], em: [0, 0, 0, 0] });
    const CHEEK = 0.4;
    for (let i = 1; i < STAIR_PROFILE.length; i++) {
      const [x0, y0] = STAIR_PROFILE[i - 1], [x1, y1] = STAIR_PROFILE[i];
      if (Math.abs(y1 - y0) < 0.01) {
        // landings: 1 m flags (the paving texture at half scale), each a slightly different stone, darker toward the walls
        Pv.set({ col: [0.3, 0.29, 0.28], rm: [0.6, 0, 0], em: [0, 0, 0, 0] }); Pv.box(x0, y0 - 0.8, STAIRS.z0, x1, y0 - 0.01, STAIRS.z1, { faces: 'Y', s: 1 });
        for (let xx = x0; xx < x1 - 0.01; xx += 1) for (let zz = STAIRS.z0; zz < STAIRS.z1 - 0.01; zz += 1) {
          const h = Math.sin(xx * 12.9898 + zz * 78.233) * 43758.5453, v = h - Math.floor(h), edge = Math.min(zz - STAIRS.z0, STAIRS.z1 - zz - 1);
          const k = (0.82 + v * 0.3) * (edge < 0.5 ? 0.72 : edge < 1.5 ? 0.88 : 1), tint = (v - 0.5) * 0.06;
          const c = [(0.47 * k + tint) * dimF, 0.45 * k * dimF, (0.43 * k - tint) * dimF], xb2 = Math.min(x1, xx + 1), zb2 = Math.min(STAIRS.z1, zz + 1);
          const P = [[xx, y0, zb2], [xb2, y0, zb2], [xb2, y0, zz], [xx, y0, zz]];
          Pv.set({ col: c }); Pv.quad(P[0], P[1], P[2], P[3], [xx, -zb2, xb2, -zz], c, null, P.map(p => floorLight(p[0], p[2])));
        }
        // the joints between the flags: dark, mossy toward the walls
        Jt.set({ col: [0.08, 0.075, 0.07], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
        for (let xx = x0 + 1; xx < x1 - 0.05; xx += 1) Jt.box(xx - 0.012, y0, STAIRS.z0, xx + 0.012, y0 + 0.003, STAIRS.z1, { faces: 'Y' });
        for (let zz = STAIRS.z0 + 1; zz < STAIRS.z1 - 0.05; zz += 1) { const mz = Math.min(zz - STAIRS.z0, STAIRS.z1 - zz) < 1.5; Jt.set({ col: mz ? [0.04, 0.06, 0.035] : [0.08, 0.075, 0.07] }); Jt.box(x0, y0, zz - 0.012, x1, y0 + 0.003, zz + 0.012, { faces: 'Y' }); }
        continue;
      }
      const n = Math.round((y0 - y1) / 0.16), run = (x1 - x0) / n, rise = (y0 - y1) / n;
      for (let k = 0; k < n; k++) {
        const xa = x0 + k * run, ya = y0 - k * rise, yb = ya - rise;
        const g = 0.94 + ((k * 37) % 7) / 70;
        // the tread (worn darker down the middle where people walk), the riser below its front edge
        S.set({ col: [0.44 * g, 0.43 * g, 0.41 * g], rm: [0.55, 0, 0], em: [0, 0, 0, 0] });
        // (the tread darkens toward both cheeks: grime and wet where nobody walks)
        { const ZS = [STAIRS.z0, STAIRS.z0 + 0.8, STAIRS.z0 + 2, 74, 76, 78, STAIRS.z1 - 2, STAIRS.z1 - 0.8, STAIRS.z1];
          const cAt = (z) => { const dw = Math.min(z - STAIRS.z0, STAIRS.z1 - z), k = (0.55 + 0.45 * Math.min(1, dw / 1.6)) * g * dimF; return [0.44 * k, 0.43 * k, 0.41 * k]; };
          for (let q = 0; q < ZS.length - 1; q++) { const za = ZS[q], zb = ZS[q + 1];
            const P = [[xa, ya, zb], [xa + run, ya, zb], [xa + run, ya, za], [xa, ya, za]];
            S.quad(P[0], P[1], P[2], P[3], [xa, -zb, xa + run, -za], cAt(za), P.map(p => cAt(p[2])), P.map(p => floorLight(p[0], p[2]))); } }
        S.set({ col: [0.2 * g, 0.195 * g, 0.19 * g] }); S.box(xa + run - 0.02, yb, STAIRS.z0, xa + run, ya, STAIRS.z1, { faces: 'X', s: 1, foot: 0.55 });
        // the nosing: a pale, polished lip along each tread's edge
        S.set({ col: [0.13 * g, 0.13 * g, 0.13 * g], rm: [0.35, 0.6, 0] }); S.box(xa + run - 0.05, ya - 0.012, STAIRS.z0 + CHEEK, xa + run + 0.004, ya + 0.008, STAIRS.z1 - CHEEK, { faces: 'YX', s: 1 });
        // the cheeks: a stepped granite kerb 12 cm proud of the treads down both edges
        S.set({ col: [0.38 * g, 0.37 * g, 0.355 * g], rm: [0.7, 0, 0] });
        for (const [za, zb] of [[STAIRS.z0, STAIRS.z0 + CHEEK], [STAIRS.z1 - CHEEK, STAIRS.z1]]) S.box(xa, yb, za, xa + run, ya + 0.12, zb, { faces: 'YXzZ', s: 1, foot: 0.35 });
      }
    }
    // wall handrails down both sides (steel tube on brackets off the plinths): the middle of the flight stays open
    // (the first version's centre rail split the stair into two lanes and was the first thing in your eye line)
    const Mt = B.get('metal', 'stairs'); Mt.set({ col: [0.16, 0.17, 0.18], rm: [0.35, 0.8, 0], em: [0, 0, 0, 0] });   // dark steel: pale rails read as laser lines at night
    for (const [zw, zr] of [[STAIRS.z0, STAIRS.z0 + 0.16], [STAIRS.z1, STAIRS.z1 - 0.16]]) {
      for (let i = 1; i < STAIR_PROFILE.length; i++) {
        const [x0, y0] = STAIR_PROFILE[i - 1], [x1, y1] = STAIR_PROFILE[i];
        if (Math.abs(y1 - y0) < 0.01) continue;   // flights only (the landings have the planters along their edges)
        Mt.tube([x0, y0 + 0.95, zr], [x1, y1 + 0.95, zr], 0.032, 8);
        for (let x = x0 + 0.6; x < x1 - 0.3; x += 2.4) { const y = stairY(x) + 0.95; Mt.box(x - 0.025, y - 0.12, Math.min(zw, zr), x + 0.025, y - 0.02, Math.max(zw, zr), { faces: 'xXyY' }); }
      }
    }
    // stone side kerbs with planters at the landings
    const Pl = B.get('plain', 'stairs');
    for (const [x0, x1, y] of [[-110, -102, 59.5], [-89, -80, 55]]) for (const z of [STAIRS.z0 + 0.6, STAIRS.z1 - 0.6]) {
      S.set({ col: [0.55, 0.52, 0.5] }); S.box(x0 + 1, y, z - 0.5, x0 + 3, y + 0.7, z + 0.5, { faces: 'xXzZY', s: 1 });
      // a shrub of leaf cards (crossed double-sided quads), dark at the heart, lighter at the tips
      Pl.set({ col: [0.07, 0.06, 0.05], rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); Pl.box(x0 + 1.05, y + 0.68, z - 0.45, x0 + 2.95, y + 0.72, z + 0.45, { faces: 'Y' });
      { const Lf = B.get('dbl', 'stairs'); for (let k = 0; k < 22; k++) { const a = k * 2.399 + x0, rr = 0.15 + ((k * 37) % 11) / 11 * 0.75, cx = x0 + 2 + Math.cos(a) * rr * 0.9, cz = z + Math.sin(a) * rr * 0.4, yy = y + 0.72 + ((k * 53) % 7) / 7 * 0.7, L = 0.28 + ((k * 29) % 5) * 0.05, yw = a * 1.7;
        const dx = Math.cos(yw) * L, dz = Math.sin(yw) * L, g0 = [0.02, 0.035, 0.018], g1 = [0.07 + (k % 3) * 0.015, 0.12 + (k % 4) * 0.012, 0.05];
        Lf.set({ col: g1, rm: [0.75, 0, 0], em: [0, 0, 0, 0] }); Lf.quad([cx - dx, yy, cz - dz], [cx + dx, yy, cz + dz], [cx + dx * 0.6, yy + L * 0.9, cz + dz * 0.6], [cx - dx * 0.6, yy + L * 0.9, cz - dz * 0.6], [0, 0, 1, 1], g1, [g0, g0, g1, g1]); } }
    }
    // ---- street life along the edges (polish, Nov 13): never in the middle of the flight. Wet patches and a drain gutter on
    // every landing; outside the stalls: produce crates, stacked plastic stools, a tub of mops, bagged rubbish, potted
    // plants by the doors; laundry on poles out of the upper windows (high over the edges, never across the stair)
    {
      const r2 = makeRng(4421), Pd = B.get('plain', 'stairs'), Wd = B.get('wood', 'stairs');
      const LAND = [[-127.5, -119.5, 64], [-111.5, -99.5, 59.5], [-91.5, -77.5, 55], [-68.8, -64.2, 50]];
      for (const [la, lb, y] of LAND) {
        // gutters: a dark slot with a grate along both edges
        for (const z of [STAIRS.z0 + 0.25, STAIRS.z1 - 0.25]) { Pd.set({ col: [0.05, 0.05, 0.05], rm: [0.5, 0.2, 0], em: [0, 0, 0, 0] }); Pd.box(la, y + 0.002, z - 0.12, lb, y + 0.006, z + 0.12, { faces: 'Y' });
          Pd.set({ col: [0.16, 0.16, 0.16], rm: [0.4, 0.8, 0] }); for (let x = la + 0.1; x < lb - 0.1; x += 0.12) Pd.box(x, y + 0.006, z - 0.12, x + 0.04, y + 0.012, z + 0.12, { faces: 'Y' }); }
        // props against both walls
        for (const side of [0, 1]) {
          const zw = side ? STAIRS.z1 : STAIRS.z0, inn = side ? -1 : 1;
          let x = la + 0.6 + r2() * 1.2;
          while (x < lb - 1.2) {
            const kind = Math.floor(r2() * 5), zc = zw + inn * (0.75 + r2() * 0.25);
            if (kind === 0) {       // produce crates, two high, fruit on top
              for (let t = 0; t < 1 + (r2() < 0.6 ? 1 : 0); t++) { Wd.set({ col: [0.36, 0.27, 0.17], rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); Wd.obox(x + 0.3, y + 0.17 + t * 0.34, zc, 0.3, 0.17, 0.22, (r2() - 0.5) * 0.3, { faces: 'xXzZY', s: 1 }); }
              const fc = [[0.55, 0.25, 0.04], [0.35, 0.42, 0.08], [0.5, 0.08, 0.05]][Math.floor(r2() * 3)];
              Pd.set({ col: fc, rm: [0.6, 0, 0] }); for (let f = 0; f < 6; f++) Pd.cyl(x + 0.1 + (f % 3) * 0.2, y + 0.68, zc - 0.08 + Math.floor(f / 3) * 0.16, 0.07, 0.05, y + 0.76, 6);
              colliders.push({ min: [x, y, zc - 0.25], max: [x + 0.6, y + 0.72, zc + 0.25], data: { mat: 'wood', kind: 'crate' } }); x += 0.9;
            } else if (kind === 1) {   // a stack of plastic stools
              const sc = [[0.6, 0.1, 0.07], [0.1, 0.25, 0.55], [0.12, 0.4, 0.2]][Math.floor(r2() * 3)], n = 2 + Math.floor(r2() * 4);
              Pd.set({ col: sc, rm: [0.45, 0, 0] }); for (let t = 0; t < n; t++) Pd.cyl(x + 0.2, y + 0.38 + t * 0.07, zc, 0.17, 0.16, y + 0.42 + t * 0.07, 10);
              for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) Pd.box(x + 0.2 + dx - 0.02, y, zc + dz - 0.02, x + 0.2 + dx + 0.02, y + 0.38, zc + dz + 0.02, { faces: 'xXzZ' });
              x += 0.7;
            } else if (kind === 2) {   // bagged rubbish
              for (let b = 0; b < 2 + Math.floor(r2() * 3); b++) { Pd.set({ col: r2() < 0.7 ? [0.03, 0.03, 0.035] : [0.08, 0.15, 0.3], rm: [0.25, 0, 0] }); Pd.obox(x + 0.25 + b * 0.32, y + 0.2, zc + (r2() - 0.5) * 0.2, 0.2, 0.2 + r2() * 0.06, 0.18, r2() * 3, { faces: 'xXzZY' }); Pd.cyl(x + 0.25 + b * 0.32, y + 0.38, zc, 0.06, 0.02, y + 0.5, 5); }
              x += 1.2;
            } else if (kind === 3) {   // a potted plant
              Pd.set({ col: [0.32, 0.16, 0.1], rm: [0.8, 0, 0] }); Pd.cyl(x + 0.3, y, zc, 0.2, 0.26, y + 0.42, 10);
              for (let f = 0; f < 5; f++) { const a = f * 1.26 + x, g2 = 0.7 + (f % 2) * 0.3; Pd.set({ col: [0.05 * g2, 0.1 * g2, 0.04 * g2], rm: [0.8, 0, 0] }); Pd.cyl(x + 0.3 + Math.cos(a) * 0.12, y + 0.42, zc + Math.sin(a) * 0.12, 0.12, 0.2, y + 0.75 + (f % 3) * 0.12, 6); }
              x += 0.8;
            } else {                   // a yellow tub with mops
              Pd.set({ col: [0.55, 0.42, 0.06], rm: [0.5, 0, 0] }); Pd.cyl(x + 0.25, y, zc, 0.2, 0.24, y + 0.32, 10);
              Pd.set({ col: [0.4, 0.34, 0.25] }); for (const dz of [-0.06, 0.06]) Pd.beam([x + 0.25, y + 0.1, zc + dz], [x + 0.28, y + 1.35, zc + dz + inn * 0.2], 0.03, 0.03);
              x += 0.8;
            }
            x += 0.4 + r2() * 1.6;
          }
        }
      }
      // laundry: a pole out of a third-floor window every few lots, shirts and towels pegged along it (over the edge, high)
      const Lw = B.get('dbl', 'stairs');
      for (const side of [0, 1]) for (let x = -124; x < -66; x += 6 + r2() * 5) {
        const zw = side ? STAIRS.z1 : STAIRS.z0, inn = side ? -1 : 1, y = stairY(x) + 8.6 + r2() * 1.6, len = 1.4 + r2() * 0.6;
        Mt.set({ col: [0.3, 0.3, 0.3], rm: [0.4, 0.7, 0] }); Mt.tube([x, y, zw], [x, y + 0.05, zw + inn * len], 0.02, 4);
        for (let c = 0; c < 3; c++) { const z = zw + inn * (0.35 + c * 0.42), h = 0.5 + r2() * 0.35, w = 0.32 + r2() * 0.1;
          const lc = [[0.6, 0.6, 0.62], [0.55, 0.15, 0.12], [0.15, 0.25, 0.45], [0.5, 0.45, 0.3], [0.25, 0.35, 0.25]][Math.floor(r2() * 5)];
          Lw.set({ col: lc, rm: [0.95, 0, 0], em: [0, 0, 0, 0] }); Lw.quad([x - w, y - h, z], [x + w, y - h, z], [x + w, y, z], [x - w, y, z]); }
      }
    }
    // the shophouses on both sides (shops on every landing and along the flights, stepping down with them)
    const signsN = ['shop0', 'shop13', 'shop1', 'shop5', 'shop2', 'shop8', 'shop15'], signsS = ['shop3', 'shop11', 'shop4', 'shop9', 'shop14', 'shop6'];
    const lots = (face, zf, signs) => {
      let i = 0;
      // the flights get shophouses; the landing under the flyover gets a row of single-storey stalls (it used to be a
      // gap that showed the shophouses' bare gable walls on both sides)
      const ranges = [[STAIRS.x0 + 0.5, -97, null], [-97, -77, 0], [-77, STAIRS.x1 + 2, null]];
      for (const [ua, ub, st] of ranges) {
        let u = ua;
        while (u < ub - 3) {
          const w = Math.min(ub - u, 5.5 + r() * 3);
          const y = stairY(u + w / 2 + (face > 0 ? 0 : 0)), yLo = Math.min(stairY(u), stairY(u + w));
          const F = new Frame(frontM('x', face, [0, zf]));
          // in the -z facing frame local x runs west: flip the lot range
          const lu0 = face > 0 ? u : -(u + w), lu1 = face > 0 ? u + w : -u;
          shopRow(B, 'stairs', F, { u0: lu0, u1: lu1, y, seed: 900 + i * 13 + (face > 0 ? 0 : 500), code: W0, depth: 13, storeys: st ?? (2 + Math.floor(r() * 3)), lotW: w, lotV: 0, lights, glows, panes, colliders, grp: 0, signs: [signs[i % signs.length]], endL: true, endR: true });
          // a plinth from the lowest step at this lot up to its shop floor
          const C = B.get('stone', 'stairs'); C.set({ col: [0.5, 0.48, 0.45], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
          const zz0 = face > 0 ? zf - 13 : zf, zz1 = face > 0 ? zf : zf + 13;
          C.box(u, yLo - 1, zz0, u + w, y, zz1, { faces: face > 0 ? 'Z' : 'z', s: 1 });
          u += w; i++;
        }
      }
    };
    lots(1, STAIRS.z0, signsN); lots(-1, STAIRS.z1, signsS);
    // LED billboards on the two gable walls facing the roof (what you see first: hotpot, and the river cruise)
    {
      const Sb = B.get('sign', 'stairs'), Fb = B.get('metal', 'stairs');
      for (const [zc, ad, k] of [[(STAIRS.z1 + STAIRS.z1 + 13) / 2, SIGN.ad1, 1.5], [(STAIRS.z0 + STAIRS.z0 - 13) / 2, SIGN.ad0, 1.3]]) {
        const x = STAIRS.x0 + 0.5 - 0.25, yc = ROOF.y + 9.5, w = 12, h = 6;
        Fb.set({ col: [0.12, 0.12, 0.13], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
        Fb.box(x - 0.2, yc - h / 2 - 0.35, zc - w / 2 - 0.35, x + 0.02, yc + h / 2 + 0.35, zc + w / 2 + 0.35, { faces: 'xzZyY' });
        Sb.set({ col: [1, 1, 1], rm: [0.4, 0, 0], em: em([1, 1, 1], k, DUSK + W0) });
        signQuad(Sb, [x - 0.22, yc, zc], [-1, 0, 0], w, h, ad);
        glows.push({ p: [x - 2.5, yc, zc], color: zc > 80 ? [1.0, 0.18, 0.1] : [0.25, 0.35, 0.9], size: 9, code: DUSK + W0, far: true });
        lights.push({ p: [x - 4, yc - 2, zc], color: zc > 80 ? [1, 0.25, 0.15] : [0.4, 0.5, 1], r: 14, k: 0.6, grp: 0 });
      }
    }
    // lanterns strung across the stairs, zig-zagging down; a plaque at the top
    for (let x = STAIRS.x0 + 6; x < STAIRS.x1 - 4; x += 7.5) {
      if (x > -98 && x < -76) continue;
      const y = stairY(x) + 6.8, y2 = stairY(x + 5) + 7.0;
      lanternString(B, 'stairs', [x, y, STAIRS.z0 + 0.3], [x + 5, y2, STAIRS.z1 - 0.3], 4, 0.9, LS, glows, 0.75);
      lights.push({ p: [x + 2.5, (y + y2) / 2 - 1, (STAIRS.z0 + STAIRS.z1) / 2], color: [1, 0.35, 0.18], r: 6, k: 0.6, grp: 0 });
      cables(B, 'stairs', [x + 1, y + 2.2, STAIRS.z0 + 0.2], [x - 3, y + 1.5, STAIRS.z1 - 0.2], 3, 0.9, x | 0);
    }
    const Sg = B.get('sign', 'stairs'); Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.6, DUSK + W0) });
    signQuad(Sg, [STAIRS.x0 + 1.5, ROOF.y + 3.6, (STAIRS.z0 + STAIRS.z1) / 2], [1, 0, 0], 6.5, 2.0, SIGN.steps || SIGN.lantern);
    const Mf = B.get('metal', 'stairs'); Mf.set({ col: [0.22, 0.2, 0.18], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
    Mf.box(STAIRS.x0 + 1.2, ROOF.y, STAIRS.z0 + 0.2, STAIRS.x0 + 1.5, ROOF.y + 4.8, STAIRS.z0 + 0.5); Mf.box(STAIRS.x0 + 1.2, ROOF.y, STAIRS.z1 - 0.5, STAIRS.x0 + 1.5, ROOF.y + 4.8, STAIRS.z1 - 0.2);
    glows.push({ p: [STAIRS.x0 + 2.4, ROOF.y + 3.6, (STAIRS.z0 + STAIRS.z1) / 2], color: [1.5, 0.85, 0.32], size: 2.6, code: DUSK + W0 });
    // a few lamps on the landings
    lampPost(B, 'stairs', -106, 59.5, STAIRS.z0 + 0.9, { dir: [0, 0, 1], h: 5.6, code: W0, lights, glows, grp: 0 });
    lampPost(B, 'stairs', -72, stairY(-72), STAIRS.z1 - 0.9, { dir: [0, 0, -1], h: 5.6, code: W0, lights, glows, grp: 0 });
    // the noodle cart and scooters under the flyover
    const Pc = B.get('plain', 'stairs');
    // (a stainless cart on wheels: a lit glass hood over the pots, a striped awning on poles, a gas bottle, stools)
    { const z0c = STAIRS.z1 - 2.4, z1c = STAIRS.z1 - 0.9, Mc = B.get('metal', 'stairs');
      Mc.set({ col: [0.38, 0.38, 0.37], rm: [0.3, 0.85, 0], em: [0, 0, 0, 0] }); Mc.box(-88, 55.25, z0c, -84.5, 56.0, z1c, { faces: 'xXzZY' });
      Mc.set({ col: [0.2, 0.2, 0.2] }); Mc.box(-88.05, 55.95, z0c - 0.05, -84.45, 56.02, z1c + 0.05, { faces: 'xXzZY' });
      Pc.set({ col: [0.03, 0.03, 0.03], rm: [0.8, 0, 0], em: [0, 0, 0, 0] }); for (const x of [-87.6, -84.9]) for (const z of [z0c + 0.1, z1c - 0.1]) Pc.cyl(x, 55, z, 0.13, 0.13, 55.25, 8);
      Pc.set({ col: [0.7, 0.62, 0.45], rm: [0.15, 0, 0], em: em([1, 0.7, 0.4], 0.5, DUSK + W0) }); Pc.box(-87.7, 56.02, z0c + 0.15, -84.8, 56.45, z1c - 0.15, { faces: 'xXzZY' });
      Pc.set({ col: [0.25, 0.24, 0.22], rm: [0.4, 0.7, 0], em: [0, 0, 0, 0] }); for (const x of [-87.2, -86.2, -85.3]) Pc.cyl(x, 56.02, (z0c + z1c) / 2, 0.22, 0.24, 56.28, 10);
      const Aw = B.get('dbl', 'stairs'); for (let k = 0; k < 6; k++) { Aw.set({ col: k % 2 ? [0.6, 0.55, 0.45] : [0.5, 0.1, 0.07], rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); const xa2 = -88.3 + k * 0.68; Aw.quad([xa2, 57.4, z0c - 0.4], [xa2 + 0.68, 57.4, z0c - 0.4], [xa2 + 0.68, 57.75, z1c + 0.1], [xa2, 57.75, z1c + 0.1]); }
      Mc.set({ col: [0.18, 0.18, 0.18] }); for (const x of [-88.2, -84.3]) Mc.tube([x, 56, z1c], [x, 57.75, z1c + 0.1], 0.025, 5);
      Pc.set({ col: [0.2, 0.35, 0.55], rm: [0.5, 0.2, 0] }); Pc.cyl(-84.1, 55, z1c - 0.3, 0.16, 0.16, 55.6, 10);
      Pc.set({ col: [0.55, 0.1, 0.07], rm: [0.45, 0, 0] }); for (const [x, z] of [[-89.2, z0c - 0.6], [-83.4, z0c - 0.3]]) Pc.cyl(x, 55.38, z, 0.17, 0.16, 55.44, 10); }
    colliders.push({ min: [-88, 55, STAIRS.z1 - 2.4], max: [-84.5, 56.5, STAIRS.z1 - 0.9], data: { mat: 'metal', kind: 'cart' } });
    glows.push({ p: [-86.2, 56.8, STAIRS.z1 - 1.6], color: [1.8, 1.1, 0.5], size: 2.2, code: DUSK + W0 });
    lights.push({ p: [-86.2, 57.2, STAIRS.z1 - 1.6], color: [1, 0.7, 0.4], r: 5, k: 1, grp: 0 });
    for (let i = 0; i < 5; i++) scooter(B, 'stairs', -95 + i * 1.1, 55, STAIRS.z0 + 1.2, 0.2 + i * 0.05, 300 + i);
  }

  // ================================================================== the ring-road flyover over the stairs (and on into the cliff tower)
  {
    const F = FLYOVER_W, C = B.get('concrete', 'fly'), L = B.get('plain', 'fly'), A = B.get('asphalt', 'fly');
    C.set({ col: [0.6, 0.6, 0.58], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    const zA = -20, zB = 118;   // (it used to end at 100, in a 150 m block on the cliff edge: that block would now stand between the roof and Jinlong)
    C.box(F.x0, F.y - F.t, zA, F.x1, F.y, zB, { faces: 'xXyz', s: 1 });
    A.set({ col: [0.55, 0.55, 0.56], rm: [0.4, 0, 0], em: [0, 0, 0, 0] }); A.box(F.x0, F.y - 0.1, zA, F.x1, F.y, zB, { faces: 'Y', s: 1 });
    for (const x of [F.x0, F.x1 - 0.4]) { C.box(x, F.y, zA, x + 0.4, F.y + 1.05, zB, { faces: 'xXYz', s: 1 }); colliders.push({ min: [x, F.y, zA], max: [x + 0.4, F.y + 1.05, zB], data: { mat: 'concrete', kind: 'parapet', layer: 'deck' } }); }
    colliders.push({ min: [F.x0, F.y - F.t, 56], max: [F.x1, F.y, 96], data: { mat: 'concrete', kind: 'deck', layer: 'deck' } });
    // piers either side of the stairs (in the gaps between the shophouses)
    for (const z of [-6, 26, 60, 92]) { C.box(F.x0 + 3, 40, z - 1.8, F.x1 - 3, F.y - F.t, z + 1.8, { faces: 'xXzZ', s: 1 }); colliders.push({ min: [F.x0 + 3, 40, z - 1.8], max: [F.x1 - 3, F.y - F.t, z + 1.8], data: { mat: 'concrete', kind: 'pier' } }); }
    // the LED line along both fascias (Chongqing outlines its flyovers in light)
    L.set({ col: [0.12, 0.13, 0.15], rm: [0.5, 0, 0], em: em([0.55, 0.75, 1.0], 0.12, DUSK + W0) });   // a soft LED band, not a laser line
    L.box(F.x0 - 0.08, F.y - 0.7, zA, F.x0, F.y - 0.4, zB); L.box(F.x1, F.y - 0.7, zA, F.x1 + 0.08, F.y - 0.4, zB);
    for (let z = zA + 4; z < zB; z += 10) { glows.push({ p: [F.x0 - 0.3, F.y - 0.5, z], color: [0.8, 1.1, 1.6], size: 1.5, code: DUSK + W0 }); glows.push({ p: [F.x1 + 0.3, F.y - 0.5, z], color: [0.8, 1.1, 1.6], size: 1.5, code: DUSK + W0 }); }
    for (const z of [50, 74]) lampPost(B, 'fly', F.x0 + 0.6, F.y, z, { dir: [1, 0, 0], h: 8, code: W0, lights: null, glows, grp: 0, col: SODIUM });
    // under-deck: a sodium light over landing B
    // under the deck: four steel girders with drip stains, cross-bracing, a pipe run on brackets, and a caged sodium fitting
    { const Gd = B.get('steel', 'fly'); Gd.set({ col: [0.34, 0.34, 0.33], rm: [0.65, 0.4, 0], em: [0, 0, 0, 0] });
      for (let k = 0; k < 4; k++) { const xg = F.x0 + 1.4 + k * (F.x1 - F.x0 - 2.8) / 3; Gd.box(xg - 0.25, F.y - F.t - 0.9, zA, xg + 0.25, F.y - F.t, zB, { faces: 'xXy', s: 1, foot: 0.4 }); }
      for (let z = 60; z < 94; z += 4.5) Gd.box(F.x0 + 1.2, F.y - F.t - 0.7, z, F.x1 - 1.2, F.y - F.t - 0.5, z + 0.25, { faces: 'zZy', s: 1 });
      const Mp = B.get('metal', 'fly'); Mp.set({ col: [0.15, 0.15, 0.15], rm: [0.4, 0.7, 0], em: [0, 0, 0, 0] }); Mp.tube([F.x0 + 0.8, F.y - F.t - 0.4, zA], [F.x0 + 0.8, F.y - F.t - 0.4, zB], 0.12, 8);
      for (let z = zA + 2; z < zB; z += 3) Mp.box(F.x0 + 0.65, F.y - F.t - 0.55, z, F.x0 + 0.95, F.y - F.t, z + 0.08); 
      Mp.set({ col: [0.12, 0.12, 0.12] }); Mp.box(-88.7, F.y - F.t - 0.35, 75.3, -85.3, F.y - F.t, 76.7, { faces: 'xXzZy' });
      for (let x = -88.4; x < -85.4; x += 0.5) Mp.box(x, F.y - F.t - 0.42, 75.3, x + 0.03, F.y - F.t - 0.35, 76.7, { faces: 'y' }); }
    L.set({ col: [1, 1, 1], em: em(SODIUM, 1.6, DUSK + W0) }); L.box(-88.4, F.y - F.t - 0.36, 75.5, -85.6, F.y - F.t - 0.34, 76.5, { faces: 'y' });
    lights.push({ p: [-87, F.y - F.t - 0.2, 76], color: [1, 0.55, 0.22], r: 9, k: 1.4, grp: 0 });
    glows.push({ p: [-87, F.y - F.t - 0.3, 76], color: [2.2, 1.1, 0.4], size: 2.4, code: DUSK + W0 });
    // the tower it drives into on the cliff edge (the road goes in at its 21st floor)
    towerBlock(B, { x0: -106, z0: -50, x1: -68, z1: -20, y0: 3, h: 96, style: 1, seed: 4402, crown: 'flat', roofSign: null, dist: W0, podium: false }, 'fly', glows);
    const tw = { x0: -104, z0: 118, x1: -70, z1: 140, y0: 3, h: 84, style: 0, seed: 4401, crown: 'pagoda', roofSign: null, dist: W0, podium: false };
    towerBlock(B, tw, 'fly', glows);
    C.box(F.x0, F.y - F.t, zB, F.x1, F.y + 5, zB + 0.6, { faces: 'z', s: 1 });
    L.set({ col: [0.05, 0.05, 0.05], em: em([1.0, 0.75, 0.45], 0.9, DUSK + W0) }); L.box(F.x0 + 0.6, F.y, zB - 0.1, F.x1 - 0.6, F.y + 4.4, zB + 0.62, { faces: 'z' });
    glows.push({ p: [(F.x0 + F.x1) / 2, F.y + 2.4, zB - 1], color: [0.7, 0.5, 0.3], size: 6, code: DUSK + W0 });
  }

  const { tris } = B.finish(root, { shadowKeys: ['plain', 'metal', 'concrete'] });
  // ---- out of the old frame, into the world
  const { dx, dy, dz } = STEPS_AT;
  root.rotation.y = Math.PI / 2; root.position.set(dx, dy, dz); root.updateMatrixWorld(true);
  const P = (p) => [dx + p[2], dy + p[1], dz - p[0]];
  for (const gl of glows) gl.p = P(gl.p);
  // the stairs are walled in by lit shops on both sides: at full strength their baked pools added up to a floor lit like
  // noon (reviews). Half strength leaves pools with dark between them; the lanterns' red pools are baked into the floor.
  for (const li of lights) { li.p = P(li.p); li.k = (li.k ?? 1) * 0.35; li.r = (li.r ?? 8) * 0.6; }
  for (const c of colliders) { const a = P(c.min), b = P(c.max); c.min = [Math.min(a[0], b[0]), a[1], Math.min(a[2], b[2])]; c.max = [Math.max(a[0], b[0]), b[1], Math.max(a[2], b[2])]; }
  root.userData.tris = tris;
  return { root, colliders, anchors: { glows, lights, named: {} }, tris };
}
