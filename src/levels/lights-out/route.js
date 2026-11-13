import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, em, mul3, hexc, GOLD, SODIUM, DIST, DUSK } from './kit.js';
import { materials, SHADOW_KEYS } from './mats.js';
import { lampPost, shopLot, Frame, frontM, lantern, lanternString, tree, hotpot, scooter } from './kitbuild.js';
import { SIGN, SIGN_LIST } from './signs.js';
import { signQuad } from './kit.js';
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
    As.set({ col: [0.95, 0.95, 0.98], rm: [0.36, 0, 0], em: [0, 0, 0, 0] });
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

    // ---- the frontage: a Chongqing street wall along the south side (z 326+): a shop at street level in every lot
    // (lit glass or a half-up shutter, a lightbox fascia, blade signs, awnings), old tiled floors over it. A wall of
    // light BESIDE you, never over you; behind it the city stacks up the bank in two more tiers.
    const T = B.get('tile', 's'), Rf = B.get('concrete', 's');
    const F = new Frame(frontM('x', -1, [X1, ROAD.front]));                       // local u = X1 - x, +z out into the street
    const U = (x) => X1 - x;
    let x = X0, li = 0;
    while (x < X1 - 4) {
      const near = x > ROAD.x0 - 14 && x < BLOCK_X + 46;
      const w = near ? 6.5 + r() * 5 : 14 + r() * 12, x1 = Math.min(X1, x + w), xc = (x + x1) / 2, code = roadDist(xc);
      if (x1 > PLZ.x0 - 0.5 && x < PLZ.x1 + 0.5) { x = PLZ.x1 + 0.5; continue; }               // the plaza's bay is open (its own back wall below)
      const depth = 11 + r() * 3;
      if (near) {
        const storeys = r() < 0.36 ? 2 : 3 + Math.floor(r() * 4);
        const { top } = shopLot(B, 's', F, null, { u0: U(x1), u1: U(x), y: Y, seed: 4000 + li * 13, code, depth, storeys, colliders, glows, lights, grp: xc < 544 ? 0 : 1, ends: 'xX' });
        // a flat roof with a parapet; on the low ones their gunmen stand at the edge (beside the road, 10 m up)
        Rf.set({ col: [0.3, 0.3, 0.31], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); Rf.box(x, top, ROAD.front, x1, top + 0.12, ROAD.front + depth, { faces: 'Y', s: 1 });
        Rf.set({ col: [0.44, 0.43, 0.41] }); Rf.box(x, top, ROAD.front, x1, top + 0.45, ROAD.front + 0.25, { faces: 'zZY', s: 1 });
        if (storeys === 2 && xc > ROAD.x0 + 60 && xc < BLOCK_X - 26 && x1 - x > 7) perches.push({ x: xc, y: top, z: ROAD.front + 1.3, x0: x + 0.8, x1: x1 - 0.8 });
      } else {
        const h = 18 + r() * r() * 30, col = WALLS[Math.floor(r() * WALLS.length)];
        T.set({ col, rm: [0.85, 0, 0], em: [0, 0, 0, code], cell: [3.0, 3.1, 11 + Math.round(x), r() < 0.3 ? 2 : 0] });
        T.box(x, Y, ROAD.front, x1, Y + h, ROAD.front + depth + 6, { faces: 'xXz', s: 1, wy0: Y, foot: 0.25 });
        Rf.set({ col: [0.32, 0.32, 0.33], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); Rf.box(x - 0.2, Y + h, ROAD.front - 0.2, x1 + 0.2, Y + h + 0.5, ROAD.front + depth + 6.2, { faces: 'xXzZY', s: 1 });
        solid(x, Y, ROAD.front, x1, Y + h, ROAD.front + depth + 6, { mat: 'concrete' });
      }
      x = x1 + (near && r() < 0.16 ? 1.6 : 0); li++;
    }
    // the second tier: slabs and point towers standing on a terrace behind the shophouses (their lit backs fill the
    // sky to your right), and a retaining wall under them
    {
      const Cw = B.get('concrete', 's2');
      let x2 = X0;
      while (x2 < X1 - 10) {
        const w = 15 + r() * 12, x1 = Math.min(X1, x2 + w), z0 = ROAD.front + 17 + r() * 4, d = 13 + r() * 8, base = Y + 9 + r() * 5, code = roadDist((x2 + x1) / 2);
        const h = 26 + r() * r() * 56;   // (none west of x 540: from the store's roof you look over the shophouses at the gorge, the bridge and Jinlong)
        if (x2 < 540) { x2 = 540; continue; }   // the steps, the flyover and the block it drives into stand behind here (steps.js)
        const st = r() < 0.25 ? 1 : r() < 0.3 ? 2 : 0;
        const A2 = B.get(st === 1 ? 'win' : 'tile', 's2');
        A2.set({ col: st === 1 ? hexc(0x4a5560) : WALLS[Math.floor(r() * WALLS.length)], rm: [st === 1 ? 0.35 : 0.85, st === 1 ? 0.2 : 0, 0], em: [0, 0, 0, code], cell: [st === 1 ? 1.6 : 3.0, st === 1 ? 3.9 : 3.0, 60 + Math.round(x2), st] });
        A2.box(x2, base, z0, x1, base + h, z0 + d, { faces: 'xXz', s: 1, wy0: base });
        Cw.set({ col: [0.3, 0.3, 0.31], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); Cw.box(x2 - 0.2, base + h, z0 - 0.2, x1 + 0.2, base + h + 0.6, z0 + d + 0.2, { faces: 'xXzY', s: 1 });
        Cw.set({ col: [0.36, 0.35, 0.33], em: em(SODIUM, 0.03, DUSK + code) }); Cw.box(x2 - 2, Y, z0 - 1.5, x1 + 2, base, z0 - 1.0, { faces: 'z', s: 1, foot: 0.3 });
        if (h > 50 && r() < 0.6) glows.push({ p: [(x2 + x1) / 2, base + h + 2.4, z0 + d / 2], color: [3, 0.2, 0.1], size: 2.6, blink: true, code: DUSK + DIST.ALWAYS, far: true, rate: 1.6 + r() });
        x2 = x1 + 3 + r() * 6;
      }
    }
    // Kuixing Plaza: the bay in the street wall where you start. A tall slab behind it carries the plaza's name in
    // lights; lantern strings run round its edge; two banyans in the back corners
    T.set({ col: WALLS[1], rm: [0.85, 0, 0], em: [0, 0, 0, DIST.R0], cell: [3.0, 3.1, 77, 0] });
    // the plaza's back: the HUNDRED STEPS come down into it between their shophouses (steps.js); a block either side of them closes the corners
    for (const [xa, xb] of [[PLZ.x0 - 0.5, 377], [415, PLZ.x1 + 0.5]]) { T.box(xa, Y, PLZ.z1, xb, Y + 17, PLZ.z1 + 13, { faces: 'xXz', s: 1, wy0: Y, foot: 0.25 }); solid(xa, Y, PLZ.z1, xb, Y + 17, PLZ.z1 + 13, { mat: 'concrete' }); }
    T.set({ col: WALLS[3], cell: [3.0, 3.1, 78, 2] });
    T.box(PLZ.x0 - 0.5, Y, ROAD.front, PLZ.x0, Y + 17, PLZ.z1, { faces: 'X', s: 1, wy0: Y, foot: 0.25 }); T.box(PLZ.x1, Y, ROAD.front, PLZ.x1 + 0.5, Y + 17, PLZ.z1, { faces: 'x', s: 1, wy0: Y, foot: 0.25 });
    { // the two gables that face the plaza either side of the steps' mouth: the plaza's name on one, the steps' on the other
      const S = B.get('sign', 's'); S.set({ col: [1, 1, 1], rm: [0.6, 0, 0], em: em([1, 1, 1], 1.5, DUSK + DIST.R0) });
      signQuad(S, [383.5, Y + 9.2, 339.86], [0, 0, -1], 11.5, 2.2, SIGN.lantern);
      signQuad(S, [408.5, Y + 9.2, 339.86], [0, 0, -1], 7.4, 2.3, SIGN.steps || SIGN.lantern);
      const G2 = B.get('plain', 's'); G2.set({ col: [0.3, 0.22, 0.1], rm: [0.4, 0.7, 0], em: em(GOLD, 1.2, DUSK + DIST.R0) });
      for (const cx of [383.5, 408.5]) { G2.box(cx - 6, Y + 7.7, 339.8, cx + 6, Y + 7.8, 339.9, {}); G2.box(cx - 6, Y + 10.6, 339.8, cx + 6, Y + 10.7, 339.9, {}); }
      glows.push({ p: [383.5, Y + 9.2, 338.6], color: [1.5, 0.8, 0.3], size: 5, code: DUSK + DIST.R0 }); glows.push({ p: [408.5, Y + 9.2, 338.6], color: [1.5, 0.8, 0.3], size: 4, code: DUSK + DIST.R0 });
      for (const px of [PLZ.x0 + 0.4, PLZ.x1 - 0.4]) lanternString(B, 's', [px, Y + 6.5, ROAD.front + 1], [px, Y + 6.5, PLZ.z1 - 1], 6, 0.9, DIST.R0, glows, 0.9);
      lanternString(B, 's', [PLZ.x0 + 0.6, Y + 6.5, PLZ.z1 - 0.8], [PLZ.x1 - 0.6, Y + 6.5, PLZ.z1 - 0.8], 9, 1.1, DIST.R0, glows, 0.9);
      tree(B, 's', PLZ.x0 + 4, Y, PLZ.z1 - 5, 1.2, 5, colliders); tree(B, 's', PLZ.x1 - 4, Y, PLZ.z1 - 5, 1.15, 9, colliders);
      lights.push({ p: [(PLZ.x0 + PLZ.x1) / 2, Y + 8, PLZ.z1 - 3], color: [1, 0.6, 0.35], r: 16, k: 2.2, grp: 0 }); }
    // the road's west end: it runs into a tunnel in the bank (closed: a barrier, the portal lit red behind it)
    {
      const Tn = B.get('concrete', 's');
      Tn.set({ col: [0.42, 0.41, 0.39], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
      Tn.box(ROAD.x0 - 26, Y, ROAD.rail + 0.3, ROAD.x0, Y + 26, ROAD.front, { faces: 'XzZY', s: 1, foot: 0.3 });
      const D = B.get('plain', 's'); D.set({ col: [0.015, 0.015, 0.02], rm: [0.9, 0, 0], em: em([1, 0.2, 0.08], 0.05, DUSK + DIST.ALWAYS) });
      D.box(ROAD.x0 - 0.2, Y, ROAD.lane[0] + 0.6, ROAD.x0 + 0.04, Y + 6.2, ROAD.lane[1] - 0.6, { faces: 'X' });
      D.set({ col: [0.3, 0.22, 0.1], rm: [0.4, 0.7, 0], em: em(GOLD, 1.3, DUSK + DIST.R0) });
      D.box(ROAD.x0, Y + 6.2, ROAD.lane[0], ROAD.x0 + 0.15, Y + 6.5, ROAD.lane[1], {}); D.box(ROAD.x0, Y, ROAD.lane[0] + 0.3, ROAD.x0 + 0.15, Y + 6.5, ROAD.lane[0] + 0.6, {}); D.box(ROAD.x0, Y, ROAD.lane[1] - 0.6, ROAD.x0 + 0.15, Y + 6.5, ROAD.lane[1] - 0.3, {});
      const S = B.get('sign', 's'); S.set({ col: [1, 1, 1], rm: [0.6, 0, 0], em: em([1, 1, 1], 1.2, DUSK + DIST.R0) });
      signQuad(S, [ROAD.x0 + 0.2, Y + 8.6, LZ], [1, 0, 0], 9, 2.8, SIGN.steps);
      solid(ROAD.x0 - 26, Y, ROAD.rail + 0.3, ROAD.x0, Y + 26, ROAD.front, { mat: 'concrete' });
      Tn.set({ col: [0.56, 0.55, 0.51] }); for (let z = ROAD.lane[0] + 1; z < ROAD.lane[1] - 1; z += 3.2) Tn.box(ROAD.x0 + 3, Y, z, ROAD.x0 + 3.6, Y + 0.85, z + 2.8, { s: 1 });
    }
    // ---- the pavement in front of the shops: hotpot tables, scooters, crates (all against the wall, nothing in the road)
    for (let px = ROAD.x0 + 58; px < BLOCK_X + 30; px += 9 + r() * 12) {
      if (px > PLZ.x0 - 3 && px < PLZ.x1 + 3) continue;
      const k = r();
      if (k < 0.34) hotpot(B, 's', px, Y + 0.02, ROAD.front - 1.4 - r() * 0.6, li++, roadDist(px), glows);
      else if (k < 0.7) { scooter(B, 's', px, Y + 0.02, ROAD.front - 1.0, Math.PI / 2 + (r() - 0.5) * 0.5, li++); if (r() < 0.5) scooter(B, 's', px + 0.9, Y + 0.02, ROAD.front - 1.05, Math.PI / 2 + (r() - 0.5) * 0.5, li++); }
      else { const C2 = B.get('wood', 's'); C2.set({ col: [0.45, 0.36, 0.26], rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); C2.box(px, Y, ROAD.front - 1.5, px + 0.9, Y + 0.7, ROAD.front - 0.6, { s: 1 }); C2.box(px + 0.15, Y + 0.7, ROAD.front - 1.4, px + 0.8, Y + 1.25, ROAD.front - 0.7, { s: 1 }); }
    }
    // ---- lantern strings from lamp to lamp along the shops' kerb (they run WITH the road, at its edge)
    for (let lx = ROAD.x0 + 30; lx < BLOCK_X + 60; lx += 28) {
      if ((lx > BRIDGE.x0 - 36 && lx < BRIDGE.x1 + 8)) continue;
      // (on the SHOP side, between the kerb lamps: a string along the rail hung across your view of the hill)
      lanternString(B, 's', [lx - 14, Y + 6.2, ROAD.lane[1] + 0.7], [lx + 14, Y + 6.2, ROAD.lane[1] + 0.7], 7, 0.9, roadDist(lx), glows, 0.85);
    }
    // road wear: darker wheel tracks and patches, manholes, a zebra at the plaza (flat decals just over the asphalt)
    {
      const D = B.get('plain', 's');
      for (let dx = ROAD.x0 + 6; dx < X1; dx += 22 + r() * 30) { const w = 5 + r() * 12, z0 = ROAD.lane[0] + 1 + r() * 11; D.set({ col: [0.05, 0.05, 0.055], rm: [0.6, 0, 0], em: [0, 0, 0, 0] }); D.box(dx, Y, z0, dx + w, Y + 0.006, z0 + 1.6 + r() * 2.6, { faces: 'Y' }); }
      for (let dx = ROAD.x0 + 24; dx < X1; dx += 34 + r() * 20) { const z0 = ROAD.lane[0] + 3 + r() * 9; D.set({ col: [0.035, 0.035, 0.04], rm: [0.85, 0, 0], em: [0, 0, 0, 0] }); D.cyl(dx, Y - 0.05, z0, 0.42, 0.42, Y + 0.008, 12); }
      D.set({ col: [0.62, 0.6, 0.52], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
      for (let z = ROAD.lane[0] + 0.9; z < ROAD.lane[1] - 0.9; z += 1.3) D.box(PLZ.x1 + 3, Y, z, PLZ.x1 + 7, Y + 0.012, z + 0.6, { faces: 'Y' });
    }
    // ---- street lamps: along the shops' kerb (heads over the road) and short ones on the promenade. All at the edges.
    for (let lx = ROAD.x0 + 16; lx < X1; lx += 28) {
      if (lx > BRIDGE.x0 - 6 && lx < BRIDGE.x1 + 6) continue;
      lampPost(B, 's', lx, Y, ROAD.lane[1] + 0.7, { dir: [0, 0, -1], h: 8, code: roadDist(lx), lights, glows, grp: lx < 544 ? 0 : 1, col: SODIUM });
    }
    for (let lx = ROAD.x0 + 30; lx < X1; lx += 28) {
      if (lx > BRIDGE.x0 - 8 && lx < BRIDGE.x1 + 8) continue;
      lampPost(B, 's', lx, Y, ROAD.rail + 0.5, { dir: [0, 0, 1], h: 4.4, code: roadDist(lx), lights, glows, grp: lx < 544 ? 0 : 1, col: [1.0, 0.72, 0.42] });
    }
    // ---- under the road: the retaining wall is a wall of old riverside houses hanging over the water (stilt houses:
    // lit windows, tiled roofs under the promenade, a gold lamp line along the road's edge). You see it from the bridge,
    // the lift and the whole glide
    {
      const Tw = B.get('tile', 'sw'), Rw = B.get('roof', 'sw'), Lw = B.get('plain', 'sw'), Ww = B.get('wood', 'sw');
      let wx = X0 - 220;
      while (wx < X1 + 220) {
        const w = 8 + r() * 9, h = 7 + r() * 9, out = 2.5 + r() * 3.5, y1 = Y - 1.2 - r() * 2.5, code = wx < 250 ? DIST.FAR_W : wx > 800 ? DIST.FAR_E : roadDist(wx + w / 2);
        if (wx + w > BRIDGE.x0 - 6 && wx < BRIDGE.x1 + 6) { wx = BRIDGE.x1 + 6; continue; }
        Tw.set({ col: WALLS[Math.floor(r() * WALLS.length)], rm: [0.85, 0, 0], em: [0, 0, 0, code], cell: [2.8, 3.0, 500 + Math.round(wx), 2] });
        Tw.box(wx, y1 - h, ROAD.rail - 0.4 - out, wx + w, y1, ROAD.rail - 0.3, { faces: 'xXz', s: 1, wy0: y1 - h, emHi: [0.18, 0.11, 0.04, DUSK + code], emLo: [0.05, 0.035, 0.02, DUSK + code] });   // (the gold lamp line above washes down the fronts)
        Rw.set({ col: [0.24, 0.23, 0.24], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); Rw.box(wx - 0.3, y1, ROAD.rail - 0.9 - out, wx + w + 0.3, y1 + 0.35, ROAD.rail - 0.3, { faces: 'xXzY', s: 1 });
        Ww.set({ col: [0.2, 0.17, 0.14], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
        for (let px = wx + 1; px < wx + w; px += 3) Ww.box(px - 0.12, WATER_Y - 2, ROAD.rail - 0.6 - out, px + 0.12, y1 - h, ROAD.rail - 0.36 - out, { faces: 'xXz' });
        // somebody is always home: a candle or a storm lantern in a window here and there. They are what is left of
        // the south bank in the blackout (seen from the lift and the whole glide)
        { const hsh = (n) => { const q = Math.sin(wx * 12.9898 + n * 78.233) * 43758.5453; return q - Math.floor(q); };
          for (let c = 0; c < 2; c++) if (hsh(c) < 0.42) { const cx = wx + 1 + hsh(c + 5) * (w - 2.6), cy = y1 - 1.6 - hsh(c + 9) * (h - 3.2), cz = ROAD.rail - 0.4 - out;
            Lw.set({ col: [0.5, 0.3, 0.12], rm: [0.5, 0, 0], em: em([1, 0.58, 0.22], 1.5, DUSK + DIST.ALWAYS) }); Lw.box(cx, cy, cz - 0.04, cx + 0.8, cy + 1.0, cz, { faces: 'z' });
            glows.push({ p: [cx + 0.4, cy + 0.5, cz - 0.3], color: [1.5, 0.75, 0.25], size: 1.5, code: DUSK + DIST.ALWAYS, far: true }); } }
        wx += w + (r() < 0.2 ? 3 + r() * 5 : 0.4);
      }
      for (let lx = X0 - 220; lx < X1 + 220; lx += 60) { const code = lx < 250 ? DIST.FAR_W : lx > 800 ? DIST.FAR_E : roadDist(lx + 30); Lw.set({ col: [0.3, 0.22, 0.1], rm: [0.4, 0.7, 0], em: em(GOLD, 1.3, DUSK + code) }); Lw.box(lx, Y - 0.5, ROAD.rail - 0.42, lx + 60, Y - 0.32, ROAD.rail - 0.36, { faces: 'z' }); }
    }
    // ---- the barricade east of the bridge mouth: the road goes on, you don't
    Cc.set({ col: [0.55, 0.54, 0.5], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    for (let z = ROAD.lane[0] - 2; z < ROAD.front - 1; z += 3.2) { Cc.box(BLOCK_X - 0.3, Y, z, BLOCK_X + 0.3, Y + 0.85, z + 2.8, { s: 1 }); }
    solid(BLOCK_X - 0.3, Y, ROAD.rail, BLOCK_X + 0.3, Y + 0.85, ROAD.front, { mat: 'concrete' });
    // road flares in front of the barrier: the road visibly ends here
    { const Fl = B.get('plain', 's'); Fl.set({ col: [0.6, 0.1, 0.05], rm: [0.5, 0, 0], em: em([1, 0.16, 0.06], 3, DUSK + DIST.ALWAYS) });
      for (const [fx, fz] of [[BLOCK_X - 1.6, 307.5], [BLOCK_X - 2.4, 311], [BLOCK_X - 1.8, 314.6], [BLOCK_X - 2.6, 318], [BLOCK_X - 1.7, 321.2]]) { Fl.box(fx - 0.14, Y + 0.02, fz - 0.03, fx + 0.14, Y + 0.08, fz + 0.03, {}); glows.push({ p: [fx, Y + 0.25, fz], color: [3, 0.45, 0.15], size: 1.5, code: DUSK + DIST.ALWAYS, far: true, flick: true }); } }
    // a roadworks arrow board behind the barrier (its own battery: it outlives the blackout), pointing left onto the
    // bridge. From 150 m down the dark road it is the thing that says 'the road ends, turn here'
    { const Bd = B.get('plain', 's'), bx = BLOCK_X + 0.9, zc = (ROAD.lane[0] + ROAD.lane[1]) / 2, yc = Y + 3.3;
      Bd.set({ col: [0.05, 0.05, 0.055], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
      Bd.box(bx, yc - 1.05, zc - 2.3, bx + 0.14, yc + 1.05, zc + 2.3, {});
      for (const pz of [zc - 1.7, zc + 1.7]) Bd.box(bx + 0.02, Y, pz - 0.06, bx + 0.12, yc - 1.05, pz + 0.06, {});
      Bd.set({ col: [0.6, 0.4, 0.1], rm: [0.5, 0, 0], em: em([1, 0.62, 0.16], 2.4, DUSK + DIST.ALWAYS) });
      const lamp = (z, y) => Bd.box(bx - 0.03, y - 0.13, z - 0.13, bx, y + 0.13, z + 0.13, { faces: 'x' });
      for (let i = 0; i < 6; i++) lamp(zc + 1.8 - i * 0.55, yc);
      lamp(zc - 1.9, yc); for (const k of [1, 2]) for (const sd of [-1, 1]) lamp(zc - 1.9 + k * 0.5, yc + sd * k * 0.38);
      glows.push({ p: [bx - 0.4, yc, zc], color: [2.2, 1.2, 0.3], size: 2.4, code: DUSK + DIST.ALWAYS, far: true, blink: true, rate: 2.2 }); }
  }

  // ================================================================== the bridge: a cable-stayed deck, 260 m, the masts and stays outside the kerbs
  {
    const As = B.get('asphalt', 'b'), Cc = B.get('concrete', 'b'), Lp = B.get('plain', 'b'), Mt = B.get('metal', 'b');
    const { x0, x1, z0, z1 } = BRIDGE;
    As.set({ col: [0.95, 0.95, 0.98], rm: [0.38, 0, 0], em: [0, 0, 0, 0] }); As.box(x0 + 0.6, Y - 0.4, z0, x1 - 0.6, Y, z1, { faces: 'Y', s: 1 });
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
      Cc.set({ col: [0.5, 0.49, 0.46], em: em(GOLD, 0.11, DUSK + bridgeDist(mz)) });
      Cc.box(cx - 2.0, WATER_Y - 4, mz - 3.2, cx + 2.0, Y - 2.6, mz + 3.2, { faces: 'xXzZ', s: 1 });                          // the pier
      Cc.box(cx - 1.5, Y - 2.6, mz - 2.4, cx + 1.5, Y + BRIDGE.mastH * 0.55, mz + 2.4, { faces: 'xXzZY', s: 1, top: [0.62, 0.58, 0.5] });   // the mast (floodlit gold), stepping in twice on the way up
      Cc.box(cx - 1.15, Y + BRIDGE.mastH * 0.55, mz - 1.9, cx + 1.15, top - 6, mz + 1.9, { faces: 'xXzZY', s: 1 });
      Cc.box(cx - 0.8, top - 6, mz - 1.4, cx + 0.8, top, mz + 1.4, { faces: 'xXzZY', s: 1 });
      { const Gc = B.get('plain', 'b'); Gc.set({ col: [0.4, 0.3, 0.14], rm: [0.35, 0.8, 0], em: em(GOLD, 1.6, DUSK + bridgeDist(mz)) }); Gc.box(cx - 0.9, top, mz - 1.5, cx + 0.9, top + 0.7, mz + 1.5, {}); Gc.box(cx - 1.25, Y + BRIDGE.mastH * 0.55 - 0.4, mz - 2.0, cx + 1.25, Y + BRIDGE.mastH * 0.55 + 0.1, mz + 2.0, { faces: 'xXzZ' }); }
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
        St.set({ col: [0.34, 0.3, 0.24], rm: [0.45, 0.7, 0], em: em(GOLD, 0.1, DUSK + code) });   // painted steel catching the floods, not a strip light
        St.tube([cx - sx * 1.2, ya, mz + dir * 2.2], [sx < 0 ? x0 - 0.9 : x1 + 0.9, Y - 0.3, zd], 0.16, 5);
      }
    }
    // a gold LED line along the outside of each parapet (the deck reads as two lines of light from anywhere), in the
    // bridge's three power sections; gate piers with lanterns where the deck leaves the road, the name on the west one
    for (const [za, zb] of [[z0, 207], [207, 254], [254, z1]]) {
      Lp.set({ col: [0.3, 0.22, 0.1], rm: [0.4, 0.7, 0], em: em(GOLD, 1.5, DUSK + bridgeDist((za + zb) / 2)) });
      Lp.box(x0 - 1.46, Y - 0.5, za, x0 - 1.4, Y - 0.2, zb, { faces: 'x' }); Lp.box(x1 + 1.4, Y - 0.5, za, x1 + 1.46, Y - 0.2, zb, { faces: 'X' });
      Lp.box(x0 + 0.5, Y + 0.3, za, x0 + 0.53, Y + 0.38, zb, { faces: 'X' }); Lp.box(x1 - 0.53, Y + 0.3, za, x1 - 0.5, Y + 0.38, zb, { faces: 'x' });
    }
    Lp.set({ col: [0.62, 0.6, 0.52], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
    for (const px of [x0 - 1.3, x1 + 0.1]) {
      Cc.set({ col: [0.5, 0.48, 0.45], em: [0, 0, 0, 0] }); Cc.box(px, Y, z1 - 2.6, px + 1.2, Y + 3.4, z1 - 1.4, { s: 1, foot: 0.25 });
      solid(px, Y, z1 - 2.6, px + 1.2, Y + 3.4, z1 - 1.4, { mat: 'concrete' });
      lantern(B, 'b', px + 0.6, Y + 4.1, z1 - 2.0, 1.5, DIST.BR0, glows, true);
      // the bridge mouth is a gate of light: a 10 m gold-lit pylon on each pier (beside the deck, nothing over it). After
      // the wave it is the brightest thing on the road: 'onto the bridge' needs no arrow
      Cc.box(px + 0.2, Y + 3.4, z1 - 2.4, px + 1.0, Y + 10, z1 - 1.6, { s: 1 });
      { const Gp = B.get('plain', 'b'); Gp.set({ col: [0.5, 0.38, 0.16], rm: [0.4, 0.6, 0], em: em(GOLD, 1.5, DUSK + DIST.BR0) });
        Gp.box(px + 0.3, Y + 3.6, z1 - 1.6, px + 0.9, Y + 9.8, z1 - 1.56, { faces: 'Z' }); Gp.box(px + 0.16, Y + 3.6, z1 - 2.3, px + 0.2, Y + 9.8, z1 - 1.7, { faces: 'x' }); Gp.box(px + 1.0, Y + 3.6, z1 - 2.3, px + 1.04, Y + 9.8, z1 - 1.7, { faces: 'X' });
        Gp.box(px + 0.1, Y + 10, z1 - 2.5, px + 1.1, Y + 10.5, z1 - 1.5, {}); }
      glows.push({ p: [px + 0.6, Y + 10.6, z1 - 2.0], color: [2.6, 1.7, 0.7], size: 3.2, code: DUSK + DIST.BR0, far: true });
      glows.push({ p: [px + 0.6, Y + 6.5, z1 - 1.3], color: [1.6, 1.05, 0.45], size: 4.5, code: DUSK + DIST.BR0, far: true });
    }
    { const S = B.get('sign', 'b'); S.set({ col: [1, 1, 1], rm: [0.6, 0, 0], em: em([1, 1, 1], 1.1, DUSK + DIST.BR0) }); signQuad(S, [x0 - 0.7, Y + 2.2, z1 - 1.36], [0, 0, 1], 1.15, 1.5, SIGN.qiansi ? [SIGN.qiansi[0], SIGN.qiansi[1], SIGN.qiansi[0] + (SIGN.qiansi[2] - SIGN.qiansi[0]) * 0.36, SIGN.qiansi[3]] : SIGN.steps); }
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
    // paving bands across the forecourt (they run toward the tower), banyans in the far corners, the tower's name on the
    // podium's river wall (you read it from the road and the bridge)
    const Pb = B.get('plain', 'n'); Pb.set({ col: [0.16, 0.15, 0.14], rm: [0.5, 0.2, 0], em: [0, 0, 0, 0] });
    for (let bx = P.x0 + 6; bx < P.x1 - 4; bx += 6) { if (bx > LIFT.x0 - 2 && bx < LIFT.x1 + 2) continue; Pb.box(bx, Y, TOWER.z1 + 0.4, bx + 0.25, Y + 0.008, P.z1 - 0.8, { faces: 'Y' }); }
    for (const [tx, tz, sd] of [[P.x0 + 4, P.z1 - 5, 3], [P.x1 - 4, P.z1 - 5, 7], [P.x0 + 4, 124, 11], [P.x1 - 4, 124, 13], [P.x0 + 4, 104, 17], [P.x1 - 4, 104, 19]]) tree(B, 'n', tx, Y, tz, 1.25, sd, colliders);
    { const S = B.get('sign', 'n'); S.set({ col: [1, 1, 1], rm: [0.6, 0, 0], em: em([1, 1, 1], 1.4, DUSK + DIST.TOWER) });
      signQuad(S, [P.x0 + 17, Y - 7, P.z1 + 0.08], [0, 0, 1], 22, 11, SIGN.jinlong); signQuad(S, [P.x1 - 17, Y - 7, P.z1 + 0.08], [0, 0, 1], 22, 11, SIGN.jinlong); }
    Cc.set({ col: [0.3, 0.3, 0.3], em: em(GOLD, 0.1, DUSK + DIST.TOWER) }); Cc.box(P.x0, WATER_Y, P.z1, P.x1, Y - 0.4, P.z1 + 0.05, { faces: 'Z', s: 1 });
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
