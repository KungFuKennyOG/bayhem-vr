import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, em, mul3, hexc, GOLD, SODIUM, DIST, DUSK } from './kit.js';
import { materials, SHADOW_KEYS } from './mats.js';
import { lampPost } from './kitbuild.js';
import { Y, LZ, PLZ, ROAD, BLOCK_X, BRIDGE, PODIUM, TOWER, LIFT, ROOFTOP, COVER, WATER_Y, QUAY, RIVER, roadDist, bridgeDist } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the route: Kuixing Plaza and the cliff road on the south bank, the bridge, the
//  tower's forecourt on the north bank. One level (y 64), wide, open to the gorge on the river side.
//
//  THE RULE: the middle of the road, of the bridge and of the forecourt carries nothing. Lamps,
//  railings, barriers, planters, masts and stays all stand at the edges; nothing spans the lane
//  below ~20 m. Cover is 0.85–1.0 m (under a standing eye). Tall things (buses, shopfronts, masts)
//  are beside the lane, never in it.
// =====================================================================================
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const WALLS = [hexc(0xc9bba3), hexc(0xd8c7b6), hexc(0xb8b0a4), hexc(0xc7a99a), hexc(0xa89e94), hexc(0xd2c19d), hexc(0x9fa6ab)];

// a dark, thick railing along a → b (posts, a top rail, a mid rail): never a thin bright line
function railing(B, reg, a, b, { h = 1.1, step = 2.4 } = {}) {
  const M = B.get('metal', reg); M.set({ col: [0.1, 0.11, 0.12], rm: [0.55, 0.6, 0], em: [0, 0, 0, 0] });
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.round(L / step));
  for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t; M.box(x - 0.05, a[1], z - 0.05, x + 0.05, a[1] + h, z + 0.05, { faces: 'xXzZ' }); }
  M.beam([a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], 0.1, 0.07);
  M.beam([a[0], a[1] + h * 0.52, a[2]], [b[0], b[1] + h * 0.52, b[2]], 0.05, 0.05);
  M.beam([a[0], a[1] + 0.12, a[2]], [b[0], b[1] + 0.12, b[2]], 0.05, 0.05);
}

export function buildRoute(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'route';
  const glows = [], lights = [], colliders = [], perches = [];
  const r = makeRng(5150);
  const solid = (x0, y0, z0, x1, y1, z1, data = {}) => colliders.push({ min: V3(x0, y0, z0), max: V3(x1, y1, z1), data });

  // ================================================================== the south bank
  {
    const As = B.get('asphalt', 's'), St = B.get('stone', 's'), Cc = B.get('concrete', 's');
    const X0 = ROAD.x0 - 70, X1 = ROAD.x1 + 190;
    // the carriageway (it runs on east past the barricade), the promenade by the rail, the pavement by the shops
    As.set({ col: [0.52, 0.52, 0.54], rm: [0.34, 0, 0], em: [0, 0, 0, 0] });
    As.box(X0, Y - 0.6, ROAD.lane[0], X1, Y, ROAD.lane[1], { faces: 'Y', s: 1 });
    St.set({ col: [0.62, 0.6, 0.57], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    St.box(X0, Y - 0.6, ROAD.rail - 0.3, X1, Y + 0.02, ROAD.lane[0], { faces: 'Yz', s: 1 });
    St.box(PLZ.x0, Y - 0.6, ROAD.front, PLZ.x1, Y + 0.02, PLZ.z1, { faces: 'Y', s: 1 });
    Cc.set({ col: [0.6, 0.59, 0.57], rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
    Cc.box(X0, Y - 0.6, ROAD.lane[1], PLZ.x0, Y + 0.02, ROAD.front, { faces: 'Y', s: 1 });
    Cc.box(PLZ.x0, Y - 0.6, ROAD.lane[1], X1, Y + 0.02, ROAD.front, { faces: 'Y', s: 1 });
    // lane paint: a broken centre line, solid edge lines (they point down the road)
    const P = B.get('plain', 's'); P.set({ col: [0.62, 0.6, 0.52], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
    for (let x = ROAD.x0 + 30; x < X1; x += 9) P.box(x, Y, LZ - 0.08, x + 4, Y + 0.012, LZ + 0.08, { faces: 'Y' });
    P.box(ROAD.x0, Y, ROAD.lane[0] + 0.3, X1, Y + 0.012, ROAD.lane[0] + 0.42, { faces: 'Y' });
    P.box(ROAD.x0, Y, ROAD.lane[1] - 0.42, X1, Y + 0.012, ROAD.lane[1] - 0.3, { faces: 'Y' });
    // the railing over the gorge (a gap where the bridge leaves)
    railing(B, 's', [X0, Y, ROAD.rail], [BRIDGE.x0 - 1.2, Y, ROAD.rail]);
    railing(B, 's', [BRIDGE.x1 + 1.2, Y, ROAD.rail], [X1, Y, ROAD.rail]);

    // ---- the frontage: shophouses and slabs along the south side (z 446+), a wall of lit windows beside you, never over you
    const T = B.get('tile', 's'), Rf = B.get('concrete', 's');
    let x = X0;
    while (x < X1) {
      const w = 13 + r() * 13, gap = r() < 0.3 ? 2.4 : 0, h = (x > ROAD.x0 - 10 && x < ROAD.x1 + 10 ? 15 : 22) + r() * r() * 34, d = 18 + r() * 8;
      const x1 = Math.min(X1, x + w), col = WALLS[Math.floor(r() * WALLS.length)], code = roadDist((x + x1) / 2), style = r() < 0.3 ? 2 : 0;
      if (x1 > PLZ.x0 - 0.5 && x < PLZ.x1 + 0.5) { x = PLZ.x1 + 0.5; continue; }               // the plaza's bay is open (its own back wall below)
      T.set({ col, rm: [0.85, 0, 0], em: [0, 0, 0, code], cell: [3.0, 3.1, 11 + Math.round(x), style] });
      T.box(x, Y, ROAD.front, x1, Y + h, ROAD.front + d, { faces: 'xXzZ', s: 1, wy0: Y, foot: 0.25 });
      Rf.set({ col: [0.32, 0.32, 0.33], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); Rf.box(x - 0.2, Y + h, ROAD.front - 0.2, x1 + 0.2, Y + h + 0.5, ROAD.front + d + 0.2, { faces: 'xXzZY', s: 1 });
      solid(x, Y, ROAD.front, x1, Y + h, ROAD.front + d, { mat: 'concrete' });
      // a first-floor terrace on some (their gunmen stand on it: beside the road, 4 m up)
      if (x > ROAD.x0 + 50 && x1 < BLOCK_X - 20 && r() < 0.42 && x1 - x > 14) {
        const bx0 = x + 1, bx1 = x1 - 1, by = Y + 4.3;
        Rf.set({ col: [0.42, 0.41, 0.39] }); Rf.box(bx0, by - 0.3, ROAD.front - 2.6, bx1, by, ROAD.front, { faces: 'xXzyY', s: 1 });
        railing(B, 's', [bx0, by, ROAD.front - 2.5], [bx1, by, ROAD.front - 2.5], { h: 1.0 });
        solid(bx0, by - 0.3, ROAD.front - 2.6, bx1, by, ROAD.front, { mat: 'concrete' });
        perches.push({ x: (bx0 + bx1) / 2, y: by, z: ROAD.front - 1.3, x0: bx0 + 0.6, x1: bx1 - 0.6 });
      }
      x = x1 + gap;
    }
    // the plaza's back: a low terrace wall and a tall slab behind it (the plaza is this slab's forecourt)
    T.set({ col: WALLS[1], rm: [0.85, 0, 0], em: [0, 0, 0, DIST.R0], cell: [3.0, 3.1, 77, 0] });
    T.box(PLZ.x0 - 0.5, Y, PLZ.z1, PLZ.x1 + 0.5, Y + 46, PLZ.z1 + 22, { faces: 'xXzZ', s: 1, wy0: Y, foot: 0.25 });
    solid(PLZ.x0 - 0.5, Y, PLZ.z1, PLZ.x1 + 0.5, Y + 46, PLZ.z1 + 22, { mat: 'concrete' });
    // the road's west end: closed by the block the plaza belongs to (you start with your back to it)
    T.set({ col: WALLS[4], rm: [0.85, 0, 0], em: [0, 0, 0, DIST.R0], cell: [3.0, 3.1, 31, 2] });
    T.box(ROAD.x0 - 26, Y, ROAD.rail + 0.6, ROAD.x0, Y + 30, ROAD.front, { faces: 'xXzZ', s: 1, wy0: Y, foot: 0.25 });
    Rf.box(ROAD.x0 - 26.2, Y + 30, ROAD.rail + 0.4, ROAD.x0 + 0.2, Y + 30.5, ROAD.front + 0.2, { faces: 'xXzZY', s: 1 });
    solid(ROAD.x0 - 26, Y, ROAD.rail + 0.6, ROAD.x0, Y + 30, ROAD.front, { mat: 'concrete' });

    // ---- street lamps: along the shops' kerb (heads over the road) and short ones on the promenade. All at the edges.
    for (let lx = ROAD.x0 + 16; lx < X1; lx += 28) {
      if (lx > BRIDGE.x0 - 6 && lx < BRIDGE.x1 + 6) continue;
      lampPost(B, 's', lx, Y, ROAD.lane[1] + 0.7, { dir: [0, 0, -1], h: 8, code: roadDist(lx), lights, glows, grp: lx < 544 ? 0 : 1, col: SODIUM });
    }
    for (let lx = ROAD.x0 + 30; lx < X1; lx += 28) {
      if (lx > BRIDGE.x0 - 8 && lx < BRIDGE.x1 + 8) continue;
      lampPost(B, 's', lx, Y, ROAD.rail + 0.5, { dir: [0, 0, 1], h: 4.4, code: roadDist(lx), lights, glows, grp: lx < 544 ? 0 : 1, col: [1.0, 0.72, 0.42] });
    }
    // ---- the barricade east of the bridge mouth: the road goes on, you don't
    Cc.set({ col: [0.55, 0.54, 0.5], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    for (let z = ROAD.lane[0] - 2; z < ROAD.front - 1; z += 3.2) { Cc.box(BLOCK_X - 0.3, Y, z, BLOCK_X + 0.3, Y + 0.85, z + 2.8, { s: 1 }); }
    solid(BLOCK_X - 0.3, Y, ROAD.rail, BLOCK_X + 0.3, Y + 0.85, ROAD.front, { mat: 'concrete' });
  }

  // ================================================================== the bridge: a cable-stayed deck, 260 m, the masts and stays outside the kerbs
  {
    const As = B.get('asphalt', 'b'), Cc = B.get('concrete', 'b'), Lp = B.get('plain', 'b'), Mt = B.get('metal', 'b');
    const { x0, x1, z0, z1 } = BRIDGE;
    As.set({ col: [0.5, 0.5, 0.52], rm: [0.36, 0, 0], em: [0, 0, 0, 0] }); As.box(x0 + 0.6, Y - 0.4, z0, x1 - 0.6, Y, z1, { faces: 'Y', s: 1 });
    Cc.set({ col: [0.46, 0.45, 0.43], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    Cc.box(x0 - 1.4, Y - 2.6, z0, x1 + 1.4, Y - 0.4, z1, { faces: 'xXyzZ', s: 1 });                  // the box girder
    Cc.box(x0 - 1.4, Y - 0.4, z0, x0 + 0.6, Y + 0.02, z1, { faces: 'xXY', s: 1 }); Cc.box(x1 - 0.6, Y - 0.4, z0, x1 + 1.4, Y + 0.02, z1, { faces: 'xXY', s: 1 });
    // parapets: a 0.75 m concrete upstand + a dark rail (cover for whoever crouches behind them; below the eye)
    Cc.box(x0, Y, z0, x0 + 0.5, Y + 0.75, z1, { faces: 'xXY', s: 1 }); Cc.box(x1 - 0.5, Y, z0, x1, Y + 0.75, z1, { faces: 'xXY', s: 1 });
    Mt.set({ col: [0.1, 0.11, 0.12], rm: [0.55, 0.6, 0], em: [0, 0, 0, 0] });
    Mt.box(x0 + 0.18, Y + 1.02, z0, x0 + 0.32, Y + 1.1, z1, {}); Mt.box(x1 - 0.32, Y + 1.02, z0, x1 - 0.18, Y + 1.1, z1, {});
    for (let z = z0 + 2; z < z1; z += 4) { Mt.box(x0 + 0.2, Y + 0.75, z, x0 + 0.3, Y + 1.02, z + 0.1, { faces: 'xXzZ' }); Mt.box(x1 - 0.3, Y + 0.75, z, x1 - 0.2, Y + 1.02, z + 0.1, { faces: 'xXzZ' }); }
    solid(x0, Y, z0, x0 + 0.5, Y + 0.75, z1, { mat: 'concrete' }); solid(x1 - 0.5, Y, z0, x1, Y + 0.75, z1, { mat: 'concrete' });
    // lane paint
    Lp.set({ col: [0.62, 0.6, 0.52], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
    for (let z = z0 + 6; z < z1 - 4; z += 9) Lp.box(691.92, Y, z, 692.08, Y + 0.012, z + 4, { faces: 'Y' });
    // the masts: a pair of free-standing pylons at each of two stations, outside the deck (no cross-beam over the road)
    for (const mz of BRIDGE.masts) for (const sx of [-1, 1]) {
      const cx = sx < 0 ? x0 - 3.2 : x1 + 3.2, top = Y + BRIDGE.mastH;
      Cc.set({ col: [0.5, 0.49, 0.46], em: em(GOLD, 0.05, DUSK + bridgeDist(mz)) });
      Cc.box(cx - 2.0, WATER_Y - 4, mz - 3.2, cx + 2.0, Y - 2.6, mz + 3.2, { faces: 'xXzZ', s: 1 });                          // the pier
      Cc.box(cx - 1.5, Y - 2.6, mz - 2.4, cx + 1.5, top, mz + 2.4, { faces: 'xXzZY', s: 1, top: [0.62, 0.58, 0.5] });          // the mast (floodlit gold)
      Cc.box(cx - 1.5 - sx * 0, Y - 2.6, mz - 2.4, cx + 1.5, Y - 1.2, mz + 2.4, { faces: 'y', s: 1 });
      // the outrigger that carries the deck (under it)
      Cc.set({ em: [0, 0, 0, 0] }); Cc.box(Math.min(cx, sx < 0 ? x0 : x1), Y - 4.2, mz - 1.6, Math.max(cx, sx < 0 ? x0 : x1), Y - 2.6, mz + 1.6, { faces: 'xXyzZ', s: 1 });
      solid(cx - 1.5, Y - 3, mz - 2.4, cx + 1.5, top, mz + 2.4, { mat: 'concrete' });
      glows.push({ p: [cx, top + 2.2, mz], color: [3, 0.2, 0.1], size: 3.2, blink: true, code: DUSK + DIST.ALWAYS, far: true, rate: 2.2 });
      // the stays: fans down to the deck's edge both ways (gold-lit, thick, in the plane beside the kerb)
      const St = B.get('plain', 'b');
      for (const dir of [-1, 1]) for (let k = 1; k <= 6; k++) {
        const zd = mz + dir * k * 10.4; if (zd < z0 + 2 || zd > z1 - 2) continue;
        const ya = top - 4 - (6 - k) * 10.5, code = bridgeDist(zd);
        St.set({ col: [0.5, 0.42, 0.28], rm: [0.4, 0.6, 0], em: em(GOLD, 0.5, DUSK + code) });
        St.tube([cx - sx * 1.2, ya, mz + dir * 2.2], [sx < 0 ? x0 - 0.9 : x1 + 0.9, Y - 0.3, zd], 0.16, 5);
      }
    }
    // the bridge's lamps: on the parapets, both sides, staggered (codes south → north so they can die behind you)
    let side = 0;
    for (let z = z1 - 9; z > z0 + 6; z -= 12) {
      const sx = (side++ % 2) ? x1 - 0.25 : x0 + 0.25;
      lampPost(B, 'b', sx, Y + 0.75, z, { dir: [sx < 692 ? 1 : -1, 0, 0], h: 5.6, code: bridgeDist(z), lights, glows, grp: 2, col: [1.0, 0.78, 0.5] });
    }
    // piers under the deck at the banks
    Cc.set({ col: [0.44, 0.43, 0.41], em: [0, 0, 0, 0] });
    Cc.box(x0 - 1, WATER_Y - 4, z1 - 4, x1 + 1, Y - 2.6, z1, { faces: 'xXz', s: 1 });
  }

  // ================================================================== the north bank: the tower's podium and its forecourt
  {
    const Cc = B.get('concrete', 'n'), St = B.get('stone', 'n');
    const P = PODIUM;
    Cc.set({ col: [0.45, 0.44, 0.42], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    Cc.box(P.x0, WATER_Y - 4, P.z0, P.x1, Y - 0.4, P.z1, { faces: 'xXzZ', s: 1, foot: 0.3 });
    St.set({ col: [0.64, 0.62, 0.58], rm: [0.55, 0, 0], em: [0, 0, 0, 0] });
    St.box(P.x0, Y - 0.4, P.z0, P.x1, Y, P.z1, { faces: 'xXzZY', s: 1 });
    // the edge rail: all round, open where the bridge arrives
    railing(B, 'n', [P.x0 + 0.3, Y, P.z1 - 0.3], [BRIDGE.x0 - 0.2, Y, P.z1 - 0.3]);
    railing(B, 'n', [BRIDGE.x1 + 0.2, Y, P.z1 - 0.3], [P.x1 - 0.3, Y, P.z1 - 0.3]);
    railing(B, 'n', [P.x0 + 0.3, Y, P.z0 + 0.3], [P.x0 + 0.3, Y, P.z1 - 0.3]);
    railing(B, 'n', [P.x1 - 0.3, Y, P.z0 + 0.3], [P.x1 - 0.3, Y, P.z1 - 0.3]);
    // a lit inlay from the bridge mouth to the lift: it draws the line you walk
    const In = B.get('plain', 'n'); In.set({ col: [0.3, 0.26, 0.18], rm: [0.5, 0.3, 0], em: em(GOLD, 0.55, DUSK + DIST.FORE) });
    In.box(LIFT.x0 - 0.5, Y, LIFT.z1 + 0.6, LIFT.x0 - 0.3, Y + 0.015, P.z1 - 1, { faces: 'Y' }); In.box(LIFT.x1 + 0.3, Y, LIFT.z1 + 0.6, LIFT.x1 + 0.5, Y + 0.015, P.z1 - 1, { faces: 'Y' });
    // forecourt lamps at the corners and along the sides
    for (const [lx, lz, d] of [[P.x0 + 2, P.z1 - 2, [1, 0, 0]], [P.x1 - 2, P.z1 - 2, [-1, 0, 0]], [P.x0 + 2, 138, [1, 0, 0]], [P.x1 - 2, 138, [-1, 0, 0]], [672, P.z1 - 1.4, [0, 0, -1]], [712, P.z1 - 1.4, [0, 0, -1]]])
      lampPost(B, 'n', lx, Y, lz, { dir: d, h: 7, code: DIST.FORE, lights, glows, grp: 3, col: [1.0, 0.8, 0.55] });
    void TOWER; void QUAY; void RIVER; void mul3;
  }

  // ================================================================== low cover along the lane edges (layout.COVER): barriers, planters, crates
  {
    const Cc = B.get('concrete', 'cover');
    for (const [x0, z0, x1, z1, h] of COVER) {
      const roof = x0 >= ROOFTOP.x0 && x1 <= ROOFTOP.x1 && z0 >= ROOFTOP.z0 && z1 <= ROOFTOP.z1;
      if (roof) continue;                                                     // the roof's housings ride the tower (jinlong.js)
      Cc.set({ col: h > 0.9 ? [0.36, 0.35, 0.33] : [0.56, 0.55, 0.51], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
      Cc.box(x0, Y, z0, x1, Y + h, z1, { s: 1, foot: 0.3 });
      solid(x0, Y, z0, x1, Y + h, z1, { mat: 'concrete', kind: 'cover' });
    }
  }

  const { tris } = B.finish(root, { shadowKeys: SHADOW_KEYS });
  root.userData.tris = tris;
  return { root, colliders, anchors: { glows, lights, named: { perches } }, tris };
}
