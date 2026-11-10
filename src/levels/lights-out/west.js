import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, em, mul3, hexc, GOLD, SODIUM, DIST, DUSK, signQuad, hipRoof } from './kit.js';
import { materials } from './mats.js';
import { SIGN, SIGN_LIST } from './signs.js';
import { Frame, frontM, shopRow, lampPost, lantern, lanternString, cables, tree, hotpot, scooter } from './kitbuild.js';
import { towerBlock } from './city.js';
import { ROOF, RING, RING_BLOCK, STAIRS, STAIR_PROFILE, stairY, FLYOVER_W, LSTREET, GATE, CLIFF_W, RAVINE } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the west bank play space:
//   - the Longwu Department Store's roof, where the ring road comes out (a rooftop car park);
//   - the Hundred Steps: granite flights and landings between old shophouses, lanterns strung
//     overhead, the ring-road flyover crossing over the stairs on its piers;
//   - Lantern Street along the cliff top: the shop wall on the north, the balustrade over the gorge
//     on the south, lamps, banyans, hotpot tables, the red gate down into Lantern Cliff;
//   - the monorail on its guideway, running through a residential tower (Longwu's Liziba);
//   - the tower the flyover drives into at the cliff edge.
// =====================================================================================
export function buildWest(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'west';
  const glows = [], lights = [], panes = [], colliders = [];
  const r = makeRng(77);
  const W0 = DIST.WEST, LS = DIST.LST;

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
    for (const [x, z, d] of [[-150, 96, [0, 0, -1]], [-130, 96, [0, 0, -1]], [-170, 76, [1, 0, 0]], [-130, 60, [-1, 0, 0]]]) lampPost(B, 'roof', x, ROOF.y, z, { dir: d, h: 6.5, code: W0, lights, glows, grp: 0, col: SODIUM });
    for (const z of [10, -18, -46]) { lampPost(B, 'roof', RING.x0 - 0.8, ROOF.y, z, { dir: [1, 0, 0], h: 9, code: W0, lights, glows, grp: 0, col: SODIUM }); }
    // the store itself: its south face over the gorge (lit display windows) and west face
    const T = B.get('tile', 'roof'); T.set({ col: hexc(0xcfc5b4), rm: [0.8, 0, 0], em: [0, 0, 0, W0], cell: [4.2, 4.6, 31, 3] });
    T.box(ROOF.x0, 30, ROOF.z0, ROOF.x1, ROOF.y - 1.2, ROOF.z1, { faces: 'xZ', s: 1, wy0: 30 });
  }

  // ================================================================== the Hundred Steps
  {
    // granite steps: a plain worn surface (the paving texture's block joints fought the treads and read as a ramp)
    const S = B.get('concrete', 'stairs');
    S.set({ col: [0.66, 0.63, 0.6], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    // flights: individual steps (16 cm risers) with worn, darker nosings; landings as slabs
    for (let i = 1; i < STAIR_PROFILE.length; i++) {
      const [x0, y0] = STAIR_PROFILE[i - 1], [x1, y1] = STAIR_PROFILE[i];
      if (Math.abs(y1 - y0) < 0.01) { S.box(x0, y0 - 0.8, STAIRS.z0, x1, y0, STAIRS.z1, { faces: 'Y', s: 1 }); continue; }
      const n = Math.round((y0 - y1) / 0.16), run = (x1 - x0) / n;
      for (let k = 0; k < n; k++) {
        const xa = x0 + k * run, ya = y0 - k * (y0 - y1) / n, yb = ya - (y0 - y1) / n;
        const g = 0.92 + ((k * 37) % 7) / 60;
        S.set({ col: [0.66 * g, 0.63 * g, 0.6 * g] });
        S.box(xa, yb - 0.6, STAIRS.z0, xa + run, ya - (y0 - y1) / n * 0, STAIRS.z1, { faces: 'Y', s: 1 });
        S.set({ col: [0.5 * g, 0.48 * g, 0.46 * g] });
        S.box(xa + run - 0.02, yb, STAIRS.z0, xa + run, ya, STAIRS.z1, { faces: 'X', s: 1 });
        // the worn nosing: a darker lip along each tread's edge, and the shadow under the step above
        S.set({ col: [0.26 * g, 0.24 * g, 0.22 * g] }); S.box(xa + run - 0.13, ya, STAIRS.z0, xa + run, ya + 0.004, STAIRS.z1, { faces: 'Y', s: 1 });   // a dark worn nosing: the flight reads as stripes from above
        S.set({ col: [0.42 * g, 0.4 * g, 0.38 * g] }); S.box(xa, ya, STAIRS.z0, xa + 0.06, ya + 0.004, STAIRS.z1, { faces: 'Y', s: 1 });
      }
    }
    // the centre handrail (two lanes) and side rails on posts
    const Mt = B.get('metal', 'stairs'); Mt.set({ col: [0.55, 0.57, 0.6], rm: [0.35, 0.85, 0], em: [0, 0, 0, 0] });
    const zc = (STAIRS.z0 + STAIRS.z1) / 2;
    for (let x = STAIRS.x0 + 6; x < STAIRS.x1 - 2; x += 2) {
      const y = stairY(x), y2 = stairY(x + 2);
      Mt.box(x - 0.03, y, zc - 0.03, x + 0.03, y + 0.95, zc + 0.03, { faces: 'xXzZ' });
      Mt.beam([x, y + 0.95, zc], [x + 2, y2 + 0.95, zc], 0.06, 0.06);
    }
    // stone side kerbs with planters at the landings
    const Pl = B.get('plain', 'stairs');
    for (const [x0, x1, y] of [[-110, -102, 59.5], [-89, -80, 55]]) for (const z of [STAIRS.z0 + 0.6, STAIRS.z1 - 0.6]) {
      S.set({ col: [0.55, 0.52, 0.5] }); S.box(x0 + 1, y, z - 0.5, x0 + 3, y + 0.7, z + 0.5, { faces: 'xXzZY', s: 1 });
      // a clipped shrub: a few leafy clumps, dark inside, lighter on top
      Pl.set({ col: [0.07, 0.06, 0.05], rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); Pl.box(x0 + 1.05, y + 0.68, z - 0.45, x0 + 2.95, y + 0.72, z + 0.45, { faces: 'Y' });
      for (let k = 0; k < 6; k++) { const a = k * 1.9 + x0, d = k ? 0.45 : 0, cx = x0 + 2 + Math.cos(a) * d * 1.6, cz = z + Math.sin(a) * d * 0.6, rr = 0.42 + ((k * 37) % 5) * 0.05, g = 0.6 + (k % 3) * 0.15;
        Pl.set({ col: [0.045 * g, 0.07 * g, 0.04 * g] }); Pl.cyl(cx, y + 0.7, cz, rr * 0.7, rr, y + 0.7 + rr * 0.8, 8, { cap: false }); Pl.cyl(cx, y + 0.7 + rr * 0.8, cz, rr, rr * 0.3, y + 0.7 + rr * 1.5, 8); }
    }
    // the shophouses on both sides (shops on every landing and along the flights, stepping down with them)
    const signsN = ['shop0', 'shop13', 'shop1', 'shop5', 'shop2', 'shop8', 'shop15'], signsS = ['shop3', 'shop11', 'shop4', 'shop9', 'shop14', 'shop6'];
    const lots = (face, zf, signs) => {
      let i = 0;
      const ranges = [[STAIRS.x0 + 0.5, -97], [-77, STAIRS.x1 + 2]];
      for (const [ua, ub] of ranges) {
        let u = ua;
        while (u < ub - 3) {
          const w = Math.min(ub - u, 5.5 + r() * 3);
          const y = stairY(u + w / 2 + (face > 0 ? 0 : 0)), yLo = Math.min(stairY(u), stairY(u + w));
          const F = new Frame(frontM('x', face, [0, zf]));
          // in the -z facing frame local x runs west: flip the lot range
          const lu0 = face > 0 ? u : -(u + w), lu1 = face > 0 ? u + w : -u;
          shopRow(B, 'stairs', F, { u0: lu0, u1: lu1, y, seed: 900 + i * 13 + (face > 0 ? 0 : 500), code: W0, depth: 13, storeys: 2 + Math.floor(r() * 3), lotW: w, lotV: 0, lights, glows, panes, colliders, grp: 0, signs: [signs[i % signs.length]], endL: true, endR: true });
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
    signQuad(Sg, [STAIRS.x0 + 1.5, ROOF.y + 3.6, (STAIRS.z0 + STAIRS.z1) / 2], [1, 0, 0], 6.5, 2.0, SIGN.steps);
    const Mf = B.get('metal', 'stairs'); Mf.set({ col: [0.22, 0.2, 0.18], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
    Mf.box(STAIRS.x0 + 1.2, ROOF.y, STAIRS.z0 + 0.2, STAIRS.x0 + 1.5, ROOF.y + 4.8, STAIRS.z0 + 0.5); Mf.box(STAIRS.x0 + 1.2, ROOF.y, STAIRS.z1 - 0.5, STAIRS.x0 + 1.5, ROOF.y + 4.8, STAIRS.z1 - 0.2);
    glows.push({ p: [STAIRS.x0 + 2.4, ROOF.y + 3.6, (STAIRS.z0 + STAIRS.z1) / 2], color: [1.5, 0.85, 0.32], size: 2.6, code: DUSK + W0 });
    // a few lamps on the landings
    lampPost(B, 'stairs', -106, 59.5, STAIRS.z0 + 0.9, { dir: [0, 0, 1], h: 5.6, code: W0, lights, glows, grp: 0 });
    lampPost(B, 'stairs', -72, stairY(-72), STAIRS.z1 - 0.9, { dir: [0, 0, -1], h: 5.6, code: W0, lights, glows, grp: 0 });
    // the noodle cart and scooters under the flyover
    const Pc = B.get('plain', 'stairs');
    Pc.set({ col: [0.75, 0.74, 0.7], rm: [0.4, 0.6, 0], em: [0, 0, 0, 0] }); Pc.box(-88, 55, STAIRS.z1 - 2.4, -84.5, 56.0, STAIRS.z1 - 0.9, { faces: 'xXzZY' });
    Pc.set({ col: [1, 0.9, 0.7], em: em([1, 0.7, 0.4], 1.2, DUSK + W0) }); Pc.box(-88, 56.0, STAIRS.z1 - 2.4, -84.5, 56.5, STAIRS.z1 - 0.9, { faces: 'xXzZ' });
    colliders.push({ min: [-88, 55, STAIRS.z1 - 2.4], max: [-84.5, 56.5, STAIRS.z1 - 0.9], data: { mat: 'metal', kind: 'cart' } });
    glows.push({ p: [-86.2, 56.8, STAIRS.z1 - 1.6], color: [1.8, 1.1, 0.5], size: 2.2, code: DUSK + W0 });
    lights.push({ p: [-86.2, 57.2, STAIRS.z1 - 1.6], color: [1, 0.7, 0.4], r: 5, k: 1, grp: 0 });
    for (let i = 0; i < 5; i++) scooter(B, 'stairs', -95 + i * 1.1, 55, STAIRS.z0 + 1.2, 0.2 + i * 0.05, 300 + i);
  }

  // ================================================================== the ring-road flyover over the stairs (and on into the cliff tower)
  {
    const F = FLYOVER_W, C = B.get('concrete', 'fly'), L = B.get('plain', 'fly'), A = B.get('asphalt', 'fly');
    C.set({ col: [0.6, 0.6, 0.58], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    const zA = 40, zB = 100;
    C.box(F.x0, F.y - F.t, zA, F.x1, F.y, zB, { faces: 'xXyz', s: 1 });
    A.set({ col: [0.55, 0.55, 0.56], rm: [0.4, 0, 0], em: [0, 0, 0, 0] }); A.box(F.x0, F.y - 0.1, zA, F.x1, F.y, zB, { faces: 'Y', s: 1 });
    for (const x of [F.x0, F.x1 - 0.4]) { C.box(x, F.y, zA, x + 0.4, F.y + 1.05, zB, { faces: 'xXYz', s: 1 }); colliders.push({ min: [x, F.y, zA], max: [x + 0.4, F.y + 1.05, zB], data: { mat: 'concrete', kind: 'parapet', layer: 'deck' } }); }
    colliders.push({ min: [F.x0, F.y - F.t, 56], max: [F.x1, F.y, 96], data: { mat: 'concrete', kind: 'deck', layer: 'deck' } });
    // piers either side of the stairs (in the gaps between the shophouses)
    for (const z of [60, 92]) { C.box(F.x0 + 3, 40, z - 1.8, F.x1 - 3, F.y - F.t, z + 1.8, { faces: 'xXzZ', s: 1 }); colliders.push({ min: [F.x0 + 3, 40, z - 1.8], max: [F.x1 - 3, F.y - F.t, z + 1.8], data: { mat: 'concrete', kind: 'pier' } }); }
    // the LED line along both fascias (Chongqing outlines its flyovers in light)
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em([0.55, 0.75, 1.0], 0.35, DUSK + W0) });
    L.box(F.x0 - 0.06, F.y - 0.55, zA, F.x0, F.y - 0.4, zB); L.box(F.x1, F.y - 0.55, zA, F.x1 + 0.06, F.y - 0.4, zB);
    for (let z = zA + 4; z < zB; z += 10) { glows.push({ p: [F.x0 - 0.3, F.y - 0.5, z], color: [0.8, 1.1, 1.6], size: 1.5, code: DUSK + W0 }); glows.push({ p: [F.x1 + 0.3, F.y - 0.5, z], color: [0.8, 1.1, 1.6], size: 1.5, code: DUSK + W0 }); }
    for (const z of [50, 74]) lampPost(B, 'fly', F.x0 + 0.6, F.y, z, { dir: [1, 0, 0], h: 8, code: W0, lights: null, glows, grp: 0, col: SODIUM });
    // under-deck: a sodium light over landing B
    L.set({ col: [1, 1, 1], em: em(SODIUM, 3, DUSK + W0) }); L.box(-88.5, F.y - F.t - 0.08, 75, -85.5, F.y - F.t, 77, { faces: 'y' });
    lights.push({ p: [-87, F.y - F.t - 0.2, 76], color: [1, 0.55, 0.22], r: 9, k: 1.4, grp: 0 });
    glows.push({ p: [-87, F.y - F.t - 0.3, 76], color: [2.2, 1.1, 0.4], size: 2.4, code: DUSK + W0 });
    // the tower it drives into on the cliff edge (the road goes in at its 21st floor)
    const tw = { x0: -104, z0: 100, x1: -70, z1: 128, y0: 3, h: 150, style: 0, seed: 4401, crown: 'pagoda', roofSign: null, dist: W0, podium: false };
    towerBlock(B, tw, 'fly', glows);
    C.box(F.x0, F.y - F.t, zB, F.x1, F.y + 5, zB + 0.6, { faces: 'z', s: 1 });
    L.set({ col: [0.05, 0.05, 0.05], em: em([1.0, 0.75, 0.45], 0.9, DUSK + W0) }); L.box(F.x0 + 0.6, F.y, zB - 0.1, F.x1 - 0.6, F.y + 4.4, zB + 0.62, { faces: 'z' });
    glows.push({ p: [(F.x0 + F.x1) / 2, F.y + 2.4, zB - 1], color: [0.7, 0.5, 0.3], size: 6, code: DUSK + W0 });
  }

  // ================================================================== Lantern Street
  {
    const Ls = LSTREET, A = B.get('asphalt', 'lst'), S = B.get('stone', 'lst'), P = B.get('plain', 'lst');
    A.set({ col: [0.5, 0.5, 0.52], rm: [0.3, 0, 0], em: [0, 0, 0, 0] });
    A.box(Ls.x0, Ls.y - 1, Ls.road[0], Ls.x1 + 4, Ls.y - 0.01, Ls.road[1], { faces: 'Y', s: 1 });
    S.set({ col: [0.6, 0.58, 0.55], rm: [0.55, 0, 0], em: [0, 0, 0, 0] });
    S.box(Ls.x0, Ls.y - 1, Ls.z0, Ls.x1 + 4, Ls.y, Ls.road[0], { faces: 'Y', s: 1 }); S.box(Ls.x0, Ls.y - 1, Ls.road[1], Ls.x1 + 4, Ls.y, Ls.z1, { faces: 'Y', s: 1 });
    S.set({ col: [0.5, 0.49, 0.47] }); S.box(Ls.x0, Ls.y - 0.15, Ls.road[0] - 0.25, Ls.x1 + 4, Ls.y + 0.02, Ls.road[0], { faces: 'YZ', s: 1 }); S.box(Ls.x0, Ls.y - 0.15, Ls.road[1], Ls.x1 + 4, Ls.y + 0.02, Ls.road[1] + 0.25, { faces: 'Yz', s: 1 });
    // road paint: double yellow centre, white dashed lanes, a zebra at the gate
    P.set({ col: [0.85, 0.65, 0.12], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    const zc = (Ls.road[0] + Ls.road[1]) / 2;
    P.box(Ls.x0, Ls.y + 0.004, zc - 0.25, Ls.x1, Ls.y + 0.008, zc - 0.1, { faces: 'Y' }); P.box(Ls.x0, Ls.y + 0.004, zc + 0.1, Ls.x1, Ls.y + 0.008, zc + 0.25, { faces: 'Y' });
    P.set({ col: [0.82, 0.8, 0.76] });
    for (let x = Ls.x0; x < Ls.x1; x += 9) for (const z of [Ls.road[0] + 4, Ls.road[1] - 4]) P.box(x, Ls.y + 0.004, z - 0.08, x + 4, Ls.y + 0.008, z + 0.08, { faces: 'Y' });
    for (let z = Ls.road[0] + 0.5; z < Ls.road[1] - 0.5; z += 1.1) P.box(78, Ls.y + 0.004, z, 84, Ls.y + 0.008, z + 0.55, { faces: 'Y' });
    // the north shop wall (the monorail tower's podium breaks it)
    const sigN = ['shop0', 'shop11', 'shop1', 'shop7', 'shop9', 'shop2', 'shop5', 'shop16', 'shop12', 'shop10'];
    for (const [ua, ub, sd] of [[Ls.x0, 6, 61], [58, Ls.x1, 63]]) {
      const F = new Frame(frontM('x', 1, [0, Ls.z0]));
      shopRow(B, 'lst', F, { u0: ua, u1: ub, y: Ls.y, seed: sd, code: LS, depth: 12, lights, glows, panes, colliders, grp: 1, signs: sigN.slice(sd % 3), lotW: 7, lotV: 4, endL: true, endR: true });
    }
    // the gorge railing: a white stone balustrade with lotus posts, lamps, banyans and benches
    const Rl = B.get('stone', 'lst'); Rl.set({ col: [0.78, 0.76, 0.72], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    const zr = Ls.rail;
    for (let x = Ls.x0; x < Ls.x1; x += 2.4) {
      if (x + 2.4 > GATE.x0 && x < GATE.x1) continue;
      Rl.box(x, Ls.y, zr - 0.35, x + 0.3, Ls.y + 1.2, zr + 0.05, { faces: 'xXzZY', s: 1 });
      Rl.box(x + 0.3, Ls.y + 0.15, zr - 0.25, x + 2.4, Ls.y + 0.3, zr - 0.05, { faces: 'zZY', s: 1 });
      Rl.box(x + 0.3, Ls.y + 0.9, zr - 0.3, x + 2.4, Ls.y + 1.05, zr, { faces: 'zZYy', s: 1 });
      for (let b = x + 0.6; b < x + 2.3; b += 0.42) Rl.box(b - 0.05, Ls.y + 0.3, zr - 0.2, b + 0.05, Ls.y + 0.9, zr - 0.1, { faces: 'xXzZ', s: 1 });
    }
    colliders.push({ min: [Ls.x0, Ls.y, zr - 0.35], max: [GATE.x0, Ls.y + 1.15, zr + 0.05], data: { mat: 'stone', kind: 'rail' } });
    colliders.push({ min: [GATE.x1, Ls.y, zr - 0.35], max: [Ls.x1 + 4, Ls.y + 1.15, zr + 0.05], data: { mat: 'stone', kind: 'rail' } });
    for (let x = Ls.x0 + 6; x < Ls.x1; x += 16) {
      if (Math.abs(x - (GATE.x0 + GATE.x1) / 2) < 7) continue;
      lampPost(B, 'lst', x, Ls.y, zr - 1.0, { dir: [0, 0, -1], two: true, h: 7.2, code: LS, lights, glows, grp: 1 });
      // lanterns strung between the lamps along the railing
      if (x + 16 < Ls.x1) lanternString(B, 'lst', [x, Ls.y + 6.4, zr - 1.0], [x + 16, Ls.y + 6.4, zr - 1.0], 7, 0.8, LS, glows, 0.7);
    }
    for (let x = Ls.x0 + 14; x < Ls.x1 - 4; x += 24) { if (Math.abs(x - 84) < 10) continue; tree(B, 'lst', x, Ls.y, 91.6, 1.05, 500 + x | 0, colliders); }
    // north side: utility poles with the wire tangle across the street, hotpot tables, scooters
    const Mt = B.get('metal', 'lst'); Mt.set({ col: [0.32, 0.3, 0.28], rm: [0.7, 0.3, 0], em: [0, 0, 0, 0] });
    for (let x = Ls.x0 + 10; x < Ls.x1; x += 21) {
      Mt.cyl(x, Ls.y, Ls.z0 + 1.6, 0.14, 0.11, Ls.y + 9.5, 7);
      Mt.box(x - 0.9, Ls.y + 8.6, Ls.z0 + 1.5, x + 0.9, Ls.y + 8.75, Ls.z0 + 1.7);
      cables(B, 'lst', [x, Ls.y + 8.8, Ls.z0 + 1.6], [x + 21, Ls.y + 8.8, Ls.z0 + 1.6], 4, 1.2, x | 0);
      cables(B, 'lst', [x, Ls.y + 8.4, Ls.z0 + 1.6], [x + 3, Ls.y + 7.2, Ls.z0 - 0.2], 2, 0.4, (x | 0) + 7);
    }
    for (const [x, z, n] of [[-50, 69.2, 2], [-12, 69.4, 3], [40, 69.2, 2], [96, 69.3, 2]]) for (let i = 0; i < n; i++) hotpot(B, 'lst', x + i * 2.6, Ls.y, z, 700 + x + i, LS, glows);
    for (let i = 0; i < 7; i++) scooter(B, 'lst', 8 + i * 1.0, Ls.y, Ls.z0 + 3.4, Math.PI / 2 + 0.15, 400 + i);
    for (let i = 0; i < 5; i++) scooter(B, 'lst', 62 + i * 1.0, Ls.y, Ls.z0 + 3.4, Math.PI / 2 - 0.1, 450 + i);
    // the bus shelter
    const Bs = B.get('metal', 'lst'); Bs.set({ col: [0.25, 0.26, 0.27], rm: [0.4, 0.7, 0] });
    Bs.box(24, Ls.y, Ls.road[1] + 1.2, 34, Ls.y + 0.06, Ls.road[1] + 3.2); Bs.box(24, Ls.y + 2.6, Ls.road[1] + 0.9, 34, Ls.y + 2.8, Ls.road[1] + 3.4, { faces: 'xXzZYy' });
    for (const x of [24.2, 33.6]) Bs.box(x, Ls.y, Ls.road[1] + 2.9, x + 0.2, Ls.y + 2.6, Ls.road[1] + 3.1);
    const Sg = B.get('sign', 'lst'); Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.4, DUSK + LS) });
    signQuad(Sg, [29, Ls.y + 1.5, Ls.road[1] + 3.15], [0, 0, -1], 3.2, 1.6, SIGN.ad0);
    colliders.push({ min: [24, Ls.y, Ls.road[1] + 2.9], max: [34, Ls.y + 2.6, Ls.road[1] + 3.2], data: { mat: 'glass', kind: 'shelter' } });
    lights.push({ p: [29, Ls.y + 2.4, Ls.road[1] + 2], color: [0.8, 0.9, 1.0], r: 5, k: 0.8, grp: 1 });
    // the east end: barricaded where the street turns along the ravine (a burning bus, barriers)
    const C = B.get('concrete', 'lst'); C.set({ col: [0.7, 0.68, 0.64], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    for (let z = Ls.z0 + 1; z < Ls.z1 - 1; z += 3.2) C.box(Ls.x1 - 0.4, Ls.y, z, Ls.x1 + 0.4, Ls.y + 0.95, z + 3.0, { faces: 'xXzZY', s: 1 });
    colliders.push({ min: [Ls.x1 - 0.4, Ls.y, Ls.z0], max: [Ls.x1 + 0.4, Ls.y + 0.95, Ls.z1], data: { mat: 'concrete', kind: 'jersey' } });
    // the gate: a red paifang over the stair head with the plaque, lanterns hung under its beams
    {
      const G = GATE, Pw = B.get('plain', 'lst'), R = B.get('roof', 'lst');
      const gx0 = G.x0 - 0.6, gx1 = G.x1 + 0.6, gz = G.z0 + 0.4, gy = Ls.y;
      Pw.set({ col: [0.55, 0.06, 0.04], rm: [0.45, 0, 0], em: [0, 0, 0, 0] });
      for (const x of [gx0, gx1 - 0.7]) { Pw.box(x, gy, gz - 0.35, x + 0.7, gy + 6.8, gz + 0.35, { faces: 'xXzZ' }); Pw.set({ col: [0.32, 0.3, 0.28] }); Pw.box(x - 0.2, gy, gz - 0.55, x + 0.9, gy + 0.6, gz + 0.55, { faces: 'xXzZY' }); Pw.set({ col: [0.55, 0.06, 0.04] }); colliders.push({ min: [x, gy, gz - 0.35], max: [x + 0.7, gy + 6.8, gz + 0.35], data: { mat: 'wood', kind: 'post' } }); }
      Pw.box(gx0 - 0.8, gy + 5.4, gz - 0.3, gx1 + 0.8, gy + 6.0, gz + 0.3, { faces: 'xXzZYy' });
      Pw.box(gx0 - 1.2, gy + 6.8, gz - 0.45, gx1 + 1.2, gy + 7.3, gz + 0.45, { faces: 'xXzZYy' });
      R.set({ col: [0.25, 0.28, 0.3], rm: [0.6, 0, 0], em: [0, 0, 0, 0] }); hipRoof(R, gx0 - 1.2, gz - 0.5, gx1 + 1.2, gz + 0.5, gy + 7.3, 1.2, { over: 0.9, curl: 0.55, ridge: 0.6 });
      const Sg2 = B.get('sign', 'lst'); Sg2.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.8, DUSK + LS) });
      signQuad(Sg2, [(gx0 + gx1) / 2, gy + 6.4, gz - 0.47], [0, 0, -1], 5.5, 1.0, SIGN.gate);
      signQuad(Sg2, [(gx0 + gx1) / 2, gy + 6.4, gz + 0.47], [0, 0, 1], 5.5, 1.0, SIGN.gate);
      const Lg = B.get('plain', 'lst'); Lg.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em(GOLD, 1.4, DUSK + LS) });
      Lg.box(gx0 - 1.2, gy + 7.25, gz - 0.5, gx1 + 1.2, gy + 7.35, gz - 0.42); Lg.box(gx0 - 1.2, gy + 7.25, gz + 0.42, gx1 + 1.2, gy + 7.35, gz + 0.5);
      for (const x of [gx0 + 1.4, (gx0 + gx1) / 2, gx1 - 1.4]) lantern(B, 'lst', x, gy + 4.7, gz, 1.3, LS, glows, true);
      lights.push({ p: [(gx0 + gx1) / 2, gy + 4.5, gz], color: [1, 0.3, 0.12], r: 7, k: 1.2, grp: 1 });
    }
  }

  // ================================================================== the monorail: guideway, the tower it runs through, the train
  const mono = {};
  {
    const C = B.get('concrete', 'mono'), L = B.get('plain', 'mono');
    const gz = 46, gy = 71, x0 = -700, x1 = RAVINE.x0 + 2;
    C.set({ col: [0.66, 0.65, 0.62], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
    // the beam (it stops inside the tower: the station is in there)
    for (const [a, b] of [[x0, 8], [56, x1]]) C.box(a, gy - 2.2, gz - 0.85, b, gy, gz + 0.85, { faces: 'zZyY', s: 1 });
    for (let x = x0 + 15; x < x1; x += 30) {
      if (x > 4 && x < 60) continue;
      const base = x < -130 ? 64 : 50;
      C.box(x - 0.9, base, gz - 0.9, x + 0.9, gy - 3.2, gz + 0.9, { faces: 'xXzZ', s: 1 });
      C.box(x - 1.1, gy - 3.2, gz - 2.6, x + 1.1, gy - 2.2, gz + 2.6, { faces: 'xXzZy', s: 1 });
    }
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em([0.6, 0.85, 1.0], 0.8, DUSK + DIST.MONO) });
    for (const [a, b] of [[x0, 8], [56, x1]]) { L.box(a, gy - 2.25, gz - 0.9, b, gy - 2.15, gz - 0.85); L.box(a, gy - 2.25, gz + 0.85, b, gy - 2.15, gz + 0.9); }
    // the tower: 32 floors of flats, a three-storey hole where the line goes through (the station platform inside, lit)
    const T = { x0: 8, z0: 26, x1: 56, z1: 64 };
    const hole0 = gy - 6, hole1 = gy + 6;
    towerBlock(B, { x0: T.x0, z0: T.z0, x1: T.x1, z1: T.z1, y0: hole1, h: 100, style: 0, seed: 7171, crown: null, roofSign: 'roof4', signN: [0, 0, 1], dist: LS, podium: false }, 'mono', glows);
    const Tb = B.get('tile', 'mono');
    Tb.set({ col: hexc(0xd2c3ad), rm: [0.85, 0, 0], em: [0, 0, 0, LS], cell: [3.0, 3.0, 17, 0] });
    Tb.box(T.x0, 50, T.z0, T.x1, hole0, T.z1, { faces: 'xXzZ', s: 1, wy0: 50 });
    // the hole: deep inset walls, a lit platform, the line running through
    const Ph = B.get('plain', 'mono');
    Ph.set({ col: [0.55, 0.55, 0.55], rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
    Ph.box(T.x0, hole0, T.z0, T.x1, hole0 + 0.4, T.z1, { faces: 'Y' });
    Ph.box(T.x0, hole1 - 0.4, T.z0, T.x1, hole1, T.z1, { faces: 'y' });
    for (const [za, zb] of [[T.z0, gz - 7], [gz + 7, T.z1]]) Ph.box(T.x0 + 2, hole0, za, T.x1 - 2, hole1, zb, { faces: 'zZxX' });
    Ph.set({ col: [1, 1, 1], em: em([0.85, 0.92, 1.0], 2.2, DUSK + DIST.MONO) });
    for (let x = T.x0 + 3; x < T.x1 - 2; x += 4) Ph.box(x, hole1 - 0.5, gz - 5, x + 2.4, hole1 - 0.4, gz + 5, { faces: 'y' });
    C.box(T.x0, gy - 2.2, gz - 0.85, T.x1, gy, gz + 0.85, { faces: 'zZyY', s: 1 });
    const Sg = B.get('sign', 'mono'); Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.5, DUSK + DIST.MONO) });
    signQuad(Sg, [T.x1 - 6, hole1 - 1.6, T.z1 + 0.05], [0, 0, 1], 6, 1.5, SIGN.mono); signQuad(Sg, [T.x0 + 6, hole1 - 1.6, T.z1 + 0.05], [0, 0, 1], 6, 1.5, SIGN.mono);
    lights.push({ p: [32, gy, 66], color: [0.8, 0.9, 1.0], r: 10, k: 1.0, grp: 1 });
    glows.push({ p: [32, gy + 1, T.z1 + 1], color: [0.5, 0.6, 0.75], size: 9, code: DUSK + DIST.MONO });
    mono.gz = gz; mono.gy = gy; mono.x0 = x0; mono.x1 = x1;
  }
  // the train (its own small group: 6 cars, white with a blue band, lit windows; it runs back and forth)
  const train = new THREE.Group(); train.name = 'monorail';
  {
    const B2 = new Buckets(); for (const [k, m] of Object.entries(M)) B2.mat(k, m);
    const A = B2.get('plain', 't'), W = B2.get('win', 't');
    for (let i = 0; i < 6; i++) {
      const x = i * 15.2;
      A.set({ col: [0.85, 0.86, 0.88], rm: [0.35, 0.2, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
      A.box(x, 0, -1.45, x + 14.8, 0.9, 1.45, { faces: 'xXzZy' }); A.box(x + 0.2, 3.0, -1.35, x + 14.6, 3.4, 1.35, { faces: 'xXzZY' });
      A.set({ col: [0.08, 0.3, 0.7], rm: [0.4, 0.2, 0] }); A.box(x, 0.9, -1.47, x + 14.8, 1.3, 1.47, { faces: 'xXzZ' });
      W.set({ col: [0.7, 0.72, 0.75], rm: [0.3, 0, 0], em: [0, 0, 0, DUSK + DIST.MONO], cell: [1.9, 1.7, 40 + i, 1] });
      W.box(x, 1.3, -1.4, x + 14.8, 3.0, 1.4, { faces: 'xXzZ', s: 1, wy0: 1.0 });
    }
    B2.finish(train);
    mono.train = train; mono.len = 6 * 15.2;
    root.add(train);
  }
  const { tris } = B.finish(root, { shadowKeys: ['plain', 'metal', 'concrete'] });
  // the train runs east-west on a loop timetable: through the tower, out over Lantern Street
  let tt = 0;
  const update = (dt) => {
    tt += dt;
    const period = 70, ph = (tt % period) / period;
    const span = mono.x1 - mono.x0 - mono.len;
    const k = ph < 0.5 ? ph * 2 : 2 - ph * 2;
    const s = k * k * (3 - 2 * k);
    train.position.set(mono.x0 + span * s, mono.gy + 0.05, mono.gz);
    train.visible = !mono.stopped;
  };
  return { root, update, anchors: { glows, lights, named: { mono } }, panes, colliders, tris };
}
