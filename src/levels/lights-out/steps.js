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
  {
    // granite steps (polish pass, Nov 13): flat granite treads (no texture: the board-marked concrete made the
    // flights read as one brown ramp), a worn pale nosing on every step and a dark riser under it, so from the top
    // the flight reads as STEPS; a stepped granite cheek down both sides; landings in granite paving.
    const S = B.get('plain', 'stairs'), Pv = B.get('stone', 'stairs');
    Pv.set({ col: [0.62, 0.6, 0.57], rm: [0.62, 0, 0], em: [0, 0, 0, 0] });
    const CHEEK = 0.4;
    for (let i = 1; i < STAIR_PROFILE.length; i++) {
      const [x0, y0] = STAIR_PROFILE[i - 1], [x1, y1] = STAIR_PROFILE[i];
      if (Math.abs(y1 - y0) < 0.01) { Pv.box(x0, y0 - 0.8, STAIRS.z0, x1, y0, STAIRS.z1, { faces: 'Y', s: 1 }); continue; }
      const n = Math.round((y0 - y1) / 0.16), run = (x1 - x0) / n, rise = (y0 - y1) / n;
      for (let k = 0; k < n; k++) {
        const xa = x0 + k * run, ya = y0 - k * rise, yb = ya - rise;
        const g = 0.94 + ((k * 37) % 7) / 70;
        // the tread (worn darker down the middle where people walk), the riser below its front edge
        S.set({ col: [0.5 * g, 0.49 * g, 0.47 * g], rm: [0.55, 0, 0], em: [0, 0, 0, 0] });
        S.box(xa, yb - 0.6, STAIRS.z0, xa + run, ya, STAIRS.z1, { faces: 'Y' });
        S.set({ col: [0.43 * g, 0.42 * g, 0.4 * g] }); S.box(xa + 0.02, ya, STAIRS.z0 + 3.2, xa + run - 0.06, ya + 0.003, STAIRS.z1 - 3.2, { faces: 'Y' });
        S.set({ col: [0.27 * g, 0.26 * g, 0.25 * g] }); S.box(xa + run - 0.02, yb, STAIRS.z0, xa + run, ya, STAIRS.z1, { faces: 'X' });
        // the nosing: a pale, polished lip along each tread's edge
        S.set({ col: [0.74 * g, 0.72 * g, 0.68 * g], rm: [0.35, 0, 0] }); S.box(xa + run - 0.06, ya, STAIRS.z0 + CHEEK, xa + run, ya + 0.004, STAIRS.z1 - CHEEK, { faces: 'Y' });
        // the cheeks: a stepped granite kerb 12 cm proud of the treads down both edges
        S.set({ col: [0.38 * g, 0.37 * g, 0.355 * g], rm: [0.7, 0, 0] });
        for (const [za, zb] of [[STAIRS.z0, STAIRS.z0 + CHEEK], [STAIRS.z1 - CHEEK, STAIRS.z1]]) S.box(xa, yb, za, xa + run, ya + 0.12, zb, { faces: 'YXzZ' });
      }
    }
    // wall handrails down both sides (steel tube on brackets off the plinths): the middle of the flight stays open
    // (the first version's centre rail split the stair into two lanes and was the first thing in your eye line)
    const Mt = B.get('metal', 'stairs'); Mt.set({ col: [0.6, 0.62, 0.64], rm: [0.3, 0.9, 0], em: [0, 0, 0, 0] });
    for (const [zw, zr] of [[STAIRS.z0, STAIRS.z0 + 0.16], [STAIRS.z1, STAIRS.z1 - 0.16]]) {
      for (let i = 1; i < STAIR_PROFILE.length; i++) {
        const [x0, y0] = STAIR_PROFILE[i - 1], [x1, y1] = STAIR_PROFILE[i];
        if (Math.abs(y1 - y0) < 0.01) continue;   // flights only (the landings have the planters along their edges)
        Mt.beam([x0, y0 + 0.95, zr], [x1, y1 + 0.95, zr], 0.05, 0.05);
        for (let x = x0 + 0.6; x < x1 - 0.3; x += 2.4) { const y = stairY(x) + 0.95; Mt.box(x - 0.025, y - 0.12, Math.min(zw, zr), x + 0.025, y - 0.02, Math.max(zw, zr), { faces: 'xXyY' }); }
      }
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
    const zA = -20, zB = 118;   // (it used to end at 100, in a 150 m block on the cliff edge: that block would now stand between the roof and Jinlong)
    C.box(F.x0, F.y - F.t, zA, F.x1, F.y, zB, { faces: 'xXyz', s: 1 });
    A.set({ col: [0.55, 0.55, 0.56], rm: [0.4, 0, 0], em: [0, 0, 0, 0] }); A.box(F.x0, F.y - 0.1, zA, F.x1, F.y, zB, { faces: 'Y', s: 1 });
    for (const x of [F.x0, F.x1 - 0.4]) { C.box(x, F.y, zA, x + 0.4, F.y + 1.05, zB, { faces: 'xXYz', s: 1 }); colliders.push({ min: [x, F.y, zA], max: [x + 0.4, F.y + 1.05, zB], data: { mat: 'concrete', kind: 'parapet', layer: 'deck' } }); }
    colliders.push({ min: [F.x0, F.y - F.t, 56], max: [F.x1, F.y, 96], data: { mat: 'concrete', kind: 'deck', layer: 'deck' } });
    // piers either side of the stairs (in the gaps between the shophouses)
    for (const z of [-6, 26, 60, 92]) { C.box(F.x0 + 3, 40, z - 1.8, F.x1 - 3, F.y - F.t, z + 1.8, { faces: 'xXzZ', s: 1 }); colliders.push({ min: [F.x0 + 3, 40, z - 1.8], max: [F.x1 - 3, F.y - F.t, z + 1.8], data: { mat: 'concrete', kind: 'pier' } }); }
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
  for (const li of lights) li.p = P(li.p);
  for (const c of colliders) { const a = P(c.min), b = P(c.max); c.min = [Math.min(a[0], b[0]), a[1], Math.min(a[2], b[2])]; c.max = [Math.max(a[0], b[0]), b[1], Math.max(a[2], b[2])]; }
  root.userData.tris = tris;
  return { root, colliders, anchors: { glows, lights, named: {} }, tris };
}
