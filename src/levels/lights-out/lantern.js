import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, em, mul3, hexc, GOLD, DIST, DUSK, signQuad, hipRoof } from './kit.js';
import { materials } from './mats.js';
import { SIGN, SIGN_LIST } from './signs.js';
import { Frame, frontM, shopRow, lantern, lanternString } from './kitbuild.js';
import { CLIFF_W, QUAY, G40, GSTAIR, GLAND, GATE, BALC, LOWROOF, LSTREET, RAVINE, gstairY } from './layout.js';

// =====================================================================================
//  LANTERN CLIFF — the stilt-house wall (Longwu's Hongyadong): eleven storeys of timber-framed
//  rooms stacked down the cliff from Lantern Street to the river, every storey stepping out a
//  little further, each with its own sweep of grey tile eave outlined in gold light, red lanterns
//  hung under every eave, paper-lattice windows glowing, red balcony rails, timber stilts under
//  the bottom rooms. From the river it is a wall of gold; from the gallery (y 40, halfway down)
//  it is the ceiling, the floor and the view.
//
//  Playable: the gate + open stair (an atrium cut down the back of the complex), the gallery
//  G40 (stone floor, shops along the cliff side, red rail on the river side, lanterns overhead),
//  the balconies of the storey above it (gunmen shoot down) and the roof terraces one storey
//  below it (gunmen shoot up).
// =====================================================================================
const WOOD = hexc(0x3a2216), WOOD2 = hexc(0x4a2c1a), RED = hexc(0x8a1a10), PLASTER = hexc(0xe6dccb), TILEC = [0.3, 0.32, 0.34];
const zFront = (y) => 117 + Math.max(0, (G40.y - y)) / (G40.y - QUAY.y) * 9;     // storeys below the gallery step out toward the river

export function buildLantern(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'lantern';
  const glows = [], lights = [], panes = [], colliders = [];
  const r = makeRng(1717);
  const HI = DIST.CLIFF_HI, LO = DIST.CLIFF_LO;

  // one storey module of the wall: a lot u0..u1 (world x), floor y, height h, front z
  const storey = (reg, x0, x1, y, h, zf, depth, code, o = {}) => {
    const Pl = B.get('plaster', reg), Wd = B.get('wood', reg), Rf = B.get('roof', reg), Sg = B.get('sign', reg), Lt = B.get('plain', reg);
    const wl = o.wall ?? (r() < 0.6 ? PLASTER : mul3(WOOD2, 1.6));
    // the wall glows: floodlit gold from the eave lights and the lanterns (Hongyadong's golden-palace look)
    Pl.set({ col: wl, rm: [0.85, 0, 0], em: em([1.0, 0.58, 0.26], o.glow ?? 0.07, DUSK + code), cell: [0, 0, 0, 0] });
    // the wall (front + the ends showing between lots)
    Pl.box(x0, y, zf - depth, x1, y + h, zf, { faces: 'Z' + (o.ends ? 'xX' : ''), s: 1 });
    // timber frame: posts at the lot ends and every ~3 m, a beam at the floor and under the eave
    Wd.set({ col: WOOD, rm: [0.75, 0, 0], em: [0, 0, 0, 0] });
    Wd.box(x0, y, zf, x1, y + 0.32, zf + 0.12, { faces: 'zZYy', s: 1 });
    Wd.box(x0, y + h - 0.4, zf, x1, y + h, zf + 0.12, { faces: 'ZYy', s: 1 });
    const nb = Math.max(2, Math.round((x1 - x0) / 3.1));
    for (let i = 0; i <= nb; i++) { const x = x0 + (x1 - x0) * i / nb; Wd.box(x - 0.13, y, zf, x + 0.13, y + h, zf + 0.16, { faces: 'xXZ', s: 1 }); }
    // paper-lattice windows, lit (most of them) — the wall of gold
    Sg.set({ col: [0.9, 0.85, 0.75], rm: [0.7, 0, 0], em: em([1, 1, 1], 1.0, DUSK + code) });
    for (let i = 0; i < nb; i++) {
      const xa = x0 + (x1 - x0) * i / nb, xb = x0 + (x1 - x0) * (i + 1) / nb;
      if (r() < 0.12) continue;
      const lit = r() < 0.7, hue = r();
      const tint = hue < 0.55 ? [1, 0.78, 0.5] : hue < 0.88 ? [1, 0.62, 0.32] : [1, 0.36, 0.2];
      Sg.set({ em: em(tint, lit ? 0.85 + r() * 0.45 : 0.05, DUSK + code) });
      const ww = Math.min(1.9, xb - xa - 0.5), wh = Math.min(1.7, h - 1.3);
      signQuad(Sg, [(xa + xb) / 2, y + 0.55 + wh / 2 + 0.25, zf + 0.04], [0, 0, 1], ww, wh, SIGN.paper);
    }
    // a shop's lightbox sign under the eave on some storeys (Hongyadong is covered in them: colour, not just gold)
    if (o.signs !== false && r() < 0.3 && x1 - x0 > 6) {
      const sw = Math.min(x1 - x0 - 1.5, 6 + r() * 4), shop = SIGN_LIST.shops[Math.floor(r() * SIGN_LIST.shops.length)];
      Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 0.95, DUSK + code) });
      signQuad(Sg, [x0 + (x1 - x0) * (0.3 + r() * 0.4), y + h - 0.75, zf + 0.22], [0, 0, 1], sw, sw / 4.2, SIGN[shop]);
    }
    // the eave: a sweep of grey tile projecting from the top of the storey, its edge outlined in gold
    const ov = o.eave ?? 2.4, ey = y + h, ex0 = x0 - 0.5, ex1 = x1 + 0.5;
    Rf.set({ col: TILEC, rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
    const lip = 0.55;
    // two quads: a steep upper slope and a flatter sweep at the lip, the corners curling up
    Rf.quad([ex0, ey + 0.55, zf + ov], [ex1, ey + 0.55, zf + ov], [ex1, ey + 1.3, zf + 0.1], [ex0, ey + 1.3, zf + 0.1]);
    Rf.quad([ex0 - 0.3, ey + 0.55 + lip, zf + ov + 0.35], [ex1 + 0.3, ey + 0.55 + lip, zf + ov + 0.35], [ex1, ey + 0.55, zf + ov], [ex0, ey + 0.55, zf + ov]);
    Rf.set({ col: mul3(WOOD, 1.4), em: em([1.0, 0.5, 0.16], 0.75, DUSK + code) });   // the soffit, lit by the lanterns under it
    Rf.quad([ex0, ey + 0.5, zf + ov], [ex0, ey + 0.5, zf + 0.1], [ex1, ey + 0.5, zf + 0.1], [ex1, ey + 0.5, zf + ov]);
    Rf.set({ col: TILEC, em: [0, 0, 0, 0] });
    // the gold LED line along the eave's lip (Hongyadong's outline) and up the ridge ends
    Lt.set({ col: [0.25, 0.2, 0.12], rm: [0.5, 0.3, 0], em: em(GOLD, 1.9, DUSK + code) });
    Lt.box(ex0 - 0.3, ey + 0.5 + lip, zf + ov + 0.3, ex1 + 0.3, ey + 0.62 + lip, zf + ov + 0.42);
    // the swept-up corners: a flick of tile rising at each end of the eave, its edge in gold too
    for (const [xe, sx] of [[ex0 - 0.3, -1], [ex1 + 0.3, 1]]) {
      const base = [xe, ey + 0.55 + lip, zf + ov + 0.35], tip = [xe + sx * 0.55, ey + 1.15 + lip, zf + ov + 0.6], back = [xe, ey + 1.15, zf + ov - 0.4];
      if (sx < 0) { Rf.tri(base, back, tip); Rf.tri(base, tip, back); } else { Rf.tri(base, tip, back); Rf.tri(base, back, tip); }
      Lt.beam(base, tip, 0.1, 0.1);
    }
    // the timber corner posts outlined in a thinner gold line (the wall reads as a lit lattice from the river)
    if (o.posts !== false) { Lt.set({ em: em(GOLD, 1.1, DUSK + code) }); for (const xe of [x0, x1]) Lt.box(xe - 0.07, y + 0.3, zf + 0.16, xe + 0.07, y + h - 0.4, zf + 0.24, { faces: 'xXZ' }); }
    // red lanterns hung along the eave (every other storey gets them)
    if (o.lanterns !== false) for (let x = ex0 + 1.4; x < ex1 - 0.6; x += 2.8) lantern(B, reg, x, ey - 0.15, zf + ov - 0.35, 0.95, code, r() < 0.6 ? glows : null);
    // a balcony with a red rail on some storeys
    if (o.balcony) {
      Wd.set({ col: WOOD2, rm: [0.8, 0, 0] });
      Wd.box(x0, y - 0.25, zf, x1, y, zf + o.balcony, { faces: 'zZxXYy', s: 1 });
      Wd.set({ col: RED, rm: [0.5, 0, 0] });
      Wd.box(x0, y + 0.95, zf + o.balcony - 0.1, x1, y + 1.05, zf + o.balcony, { faces: 'zZYy', s: 1 });
      for (let x = x0 + 0.3; x < x1; x += 0.45) Wd.box(x - 0.03, y, zf + o.balcony - 0.08, x + 0.03, y + 0.95, zf + o.balcony - 0.02, { faces: 'xXzZ' });
    }
    // a little warm light on the eave soffit / the storey's face (light map only reaches play floors)
    return { ey, ov };
  };

  // ================================================================== the wall, x -60 .. 112
  const lotsX = []; { let x = CLIFF_W.x0; while (x < CLIFF_W.x1 - 4) { const w = 8 + r() * 7; lotsX.push([x, Math.min(CLIFF_W.x1, x + w)]); x += w; } }
  for (const [x0, x1] of lotsX) {
    const reg = x0 < 20 ? 'lw' : 'le';
    const atrium = x1 > GSTAIR.x0 - 4 && x0 < GSTAIR.x1 + 2;
    // below the gallery: storeys from the quay up, stepping out toward the river; stilts under the lowest
    // the lowest rooms stand on timber stilts (diaojiaolou) over the rock: a ragged line 7–12 m up the cliff
    const stiltTop = QUAY.y + 7 + r() * 5;
    {
      const Wd = B.get('wood', reg), zs = zFront(stiltTop + 2) - 0.4;
      Wd.set({ col: mul3(WOOD, 0.9), rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
      for (let x = x0 + 0.8; x < x1 - 0.3; x += 2.6) for (const dz of [0, -3.2]) Wd.box(x - 0.17, QUAY.y - 2, zs + dz - 0.17, x + 0.17, stiltTop, zs + dz + 0.17, { faces: 'xXzZ' });
      // cross-bracing between the front stilts, a beam under the floor
      for (let x = x0 + 0.8; x < x1 - 2.9; x += 2.6) { Wd.beam([x, QUAY.y + 0.5, zs + 0.1], [x + 2.6, stiltTop - 1.2, zs + 0.1], 0.12, 0.12); Wd.beam([x + 2.6, QUAY.y + 0.5, zs + 0.1], [x, stiltTop - 1.2, zs + 0.1], 0.12, 0.12); }
      Wd.box(x0 + 0.2, stiltTop - 0.5, zs - 3.6, x1 - 0.2, stiltTop, zs + 0.3, { faces: 'zZy' });
      // a couple of lanterns hung among the stilts, light on the rock behind
      for (let x = x0 + 2.5; x < x1 - 1; x += 5.5) if (r() < 0.6) lantern(B, reg, x, stiltTop - 1.6, zs - 1.4, 0.9, LO, r() < 0.5 ? glows : null);
    }
    let y = stiltTop;
    const base = 2.6 + r() * 3.2;   // the first storey: its own height per lot, so no floor line runs the whole wall
    const hs = [base, 4.6, 4.2, 4.8, 4.4, 4.6, 4.2, 5.0];
    let k = 0;
    while (y < G40.y - 0.5) {
      let h = Math.min(hs[k % hs.length], G40.y - y);
      if (G40.y - (y + h) < 2.2) h = G40.y - y;   // no sliver storeys under the gallery
      const zf = zFront(y + h * 0.5) + (r() - 0.5) * 1.6 + (k % 2) * 0.4;
      const code = y < 24 ? LO : HI;
      storey(reg, x0 + 0.15, x1 - 0.15, y, h, zf, zf - CLIFF_W.zTop + 2, code, { balcony: k % 3 === 1 ? 1.4 : 0, lanterns: k % 2 === 0 || r() < 0.4, ends: true });
      // the roof terrace one storey below the gallery (gunmen stand on it)
      if (y + h > LOWROOF.y - 1 && y + h < LOWROOF.y + 1) {
        const Rt = B.get('stone', reg); Rt.set({ col: [0.5, 0.48, 0.45], rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
        Rt.box(x0 + 0.15, y + h - 0.3, LOWROOF.z0, x1 - 0.15, LOWROOF.y, LOWROOF.z1, { faces: 'Y', s: 1 });
        colliders.push({ min: [x0 + 0.15, LOWROOF.y - 1, LOWROOF.z0], max: [x1 - 0.15, LOWROOF.y, LOWROOF.z1], data: { mat: 'stone', kind: 'deck', layer: 'deck' } });
      }
      y += h; k++;
    }
    // a long red banner hung down the face every few lots (gold characters): the complex's vertical signs
    if (!atrium && r() < 0.42) {
      const bx = x0 + (x1 - x0) * (0.3 + r() * 0.4), by1 = BALC.y - 1.2, bh = 10 + r() * 4, bz = zFront(by1 - bh / 2) + 2.7;
      const Sb = B.get('sign', reg), Wb = B.get('wood', reg);
      Wb.set({ col: WOOD, rm: [0.8, 0, 0], em: [0, 0, 0, 0] }); Wb.box(bx - 1.6, by1, bz - 2.8, bx + 1.6, by1 + 0.25, bz + 0.1);
      Sb.set({ col: [1, 1, 1], rm: [0.7, 0, 0], em: em([1, 0.85, 0.7], 0.9, DUSK + HI) });
      signQuad(Sb, [bx, by1 - bh / 2, bz + 0.12], [0, 0, 1], bh / 4, bh, SIGN['blade' + [0, 2, 5, 6, 7][Math.floor(r() * 5)]]);
      glows.push({ p: [bx, by1 - bh / 2, bz + 1.5], color: [1.0, 0.25, 0.1], size: 6, code: DUSK + HI, far: true });
    }
    // stilts: timber columns from the lowest rooms down onto the rock
    // (the stilts are built with the stack above)
    // the gallery storey's outer structure: columns at the rail line, the ceiling, the storey above with its balcony
    {
      const Wd = B.get('wood', reg), St = B.get('stone', reg);
      Wd.set({ col: RED, rm: [0.5, 0, 0], em: [0, 0, 0, 0] });
      for (let x = x0 + 1.5; x < x1 - 0.5; x += 3.6) { Wd.box(x - 0.2, G40.y, G40.z1 - 0.4, x + 0.2, G40.roof, G40.z1, { faces: 'xXzZ', s: 1 }); colliders.push({ min: [x - 0.2, G40.y, G40.z1 - 0.4], max: [x + 0.2, G40.roof, G40.z1], data: { mat: 'wood', kind: 'post' } }); }
      // the ceiling over the gallery: dark timber with beams
      Wd.set({ col: mul3(WOOD, 1.3), rm: [0.8, 0, 0], em: em([1.0, 0.42, 0.18], 0.1, DUSK + HI) });   // lit warm by the lanterns hung under it
      Wd.box(x0, G40.roof, G40.z0 - (atrium ? 0 : 4), x1, G40.roof + 0.8, G40.z1 + 3.4, { faces: 'yZ', s: 1 });
      Wd.set({ col: RED, rm: [0.45, 0, 0], em: em([1.0, 0.3, 0.12], 0.06, DUSK + HI) });   // red-lacquered beams with brackets at the posts
      for (let x = x0 + 0.8; x < x1; x += 2.2) { Wd.box(x - 0.16, G40.roof - 0.6, G40.z0, x + 0.16, G40.roof, G40.z1, { faces: 'xXy', s: 1 }); Wd.box(x - 0.45, G40.roof - 0.85, G40.z1 - 0.7, x + 0.45, G40.roof - 0.6, G40.z1 - 0.25, { faces: 'xXyzZ', s: 1 }); }
      Wd.set({ col: mul3(WOOD, 1.3), rm: [0.8, 0, 0], em: em([1.0, 0.42, 0.18], 0.1, DUSK + HI) });
      // the red rail
      Wd.set({ col: RED, rm: [0.5, 0, 0] });
      Wd.box(x0, G40.y + 0.95, G40.z1 - 0.32, x1, G40.y + 1.08, G40.z1 - 0.08, { faces: 'zZYy', s: 1 });
      Wd.box(x0, G40.y, G40.z1 - 0.3, x1, G40.y + 0.12, G40.z1 - 0.1, { faces: 'zZY', s: 1 });
      for (let x = x0 + 0.25; x < x1; x += 0.5) Wd.box(x - 0.035, G40.y + 0.12, G40.z1 - 0.24, x + 0.035, G40.y + 0.95, G40.z1 - 0.16, { faces: 'xXzZ' });
      // a front storey above the gallery (and the balcony gunmen use)
      storey(reg, x0 + 0.15, x1 - 0.15, BALC.y, 4.2, BALC.z0 - 0.2, 14, HI, { balcony: BALC.z1 - BALC.z0, eave: 1.6, ends: true });
      colliders.push({ min: [x0 + 0.15, BALC.y - 0.6, BALC.z0], max: [x1 - 0.15, BALC.y, BALC.z1], data: { mat: 'wood', kind: 'deck', layer: 'deck' } });
      colliders.push({ min: [x0 + 0.15, BALC.y, BALC.z1 - 0.12], max: [x1 - 0.15, BALC.y + 1.05, BALC.z1], data: { mat: 'wood', kind: 'rail', layer: 'deck', noBlock: true } });
      // the roofs above that: a hip roof per lot, some with a second tier (pavilions over the street line)
      const Rf = B.get('roof', reg); Rf.set({ col: TILEC, rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
      const ry = BALC.y + 4.2 + 1.3;
      const E = hipRoof(Rf, x0 + 0.4, LSTREET.z1 + 4.5, x1 - 0.4, BALC.z0 - 0.8, ry, 2.4 + r() * 0.8, { over: 1.0, curl: 0.7, ridge: 0.55 });
      const Lt = B.get('plain', reg); Lt.set({ col: [0.25, 0.2, 0.12], rm: [0.5, 0.3, 0], em: em(GOLD, 2.4, DUSK + HI) });
      Lt.box(E.X0, ry + 0.62, E.Z1 - 0.06, E.X1, ry + 0.74, E.Z1 + 0.06);
      if (r() < 0.35 && !atrium) {
        const Pl = B.get('plaster', reg); Pl.set({ col: PLASTER, rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
        const cx = (x0 + x1) / 2, w = Math.min(6, (x1 - x0) * 0.5);
        Pl.box(cx - w / 2, ry + 1.5, 104, cx + w / 2, ry + 5.5, 110, { faces: 'xXzZ', s: 1 });
        Rf.set({ col: TILEC }); const E2 = hipRoof(Rf, cx - w / 2, 104, cx + w / 2, 110, ry + 5.5, 2.2, { over: 1.1, curl: 0.8, ridge: 0.3 });
        Lt.box(E2.X0, ry + 6.3, E2.Z1 - 0.06, E2.X1, ry + 6.4, E2.Z1 + 0.06); Lt.box(E2.X0, ry + 6.3, E2.Z0 - 0.06, E2.X1, ry + 6.4, E2.Z0 + 0.06);
        const Sg = B.get('sign', reg); Sg.set({ col: [0.9, 0.85, 0.75], rm: [0.7, 0, 0], em: em([1, 1, 1], 1.2, DUSK + HI) });
        signQuad(Sg, [cx, ry + 3.5, 110.04], [0, 0, 1], w * 0.6, 1.8, SIGN.paper);
        lantern(B, reg, cx - w / 2 - 0.6, ry + 5.1, 111, 1.1, HI, glows); lantern(B, reg, cx + w / 2 + 0.6, ry + 5.1, 111, 1.1, HI, glows);
      }
    }
  }
  // gallery lights (light map): lanterns under the ceiling every 3.6 m and the shops' spill
  for (let x = G40.x0 + 2; x < G40.x1; x += 3.6) {
    { const k = (Math.sin(x * 1.7) + 1) / 2; lantern(B, x < 20 ? 'lw' : 'le', x, G40.roof - 1.0 - k * 0.6, G40.z1 - 1.6 - (x % 7.2 < 3.6 ? 0 : 1.2), 0.85 + k * 0.4, HI, glows); }
    lights.push({ p: [x, G40.roof - 1, G40.z1 - 1.6], color: [1, 0.36, 0.16], r: 4.5, k: 0.7, grp: 1 });
  }
  // ================================================================== the gallery floor, its shops on the cliff side
  {
    const St = B.get('stone', 'le'); St.set({ col: [0.55, 0.53, 0.5], rm: [0.5, 0, 0], em: [0, 0, 0, 0] });
    St.box(G40.x0, G40.y - 0.8, G40.z0, G40.x1, G40.y, G40.z1, { faces: 'Y', s: 1 });
    St.box(GLAND.x0, G40.y - 0.8, GLAND.z0, GLAND.x1, G40.y, GLAND.z1, { faces: 'Y', s: 1 });
    // shops along the back, except where the atrium stair comes down
    const F = new Frame(frontM('x', 1, [0, G40.z0]));
    const sig = ['shop8', 'shop12', 'shop0', 'shop14', 'shop2', 'shop5', 'shop11', 'shop1'];
    for (const [ua, ub, sd] of [[G40.x0, GLAND.x0, 81], [GSTAIR.x1 + 0.5, G40.x1, 83]]) {
      shopRow(B, 'le', F, { u0: ua, u1: ub, y: G40.y, seed: sd, code: HI, depth: 4.2, storeys: 0, lights, glows, panes, colliders, grp: 1, signs: sig.slice(sd % 4), lotW: 6, lotV: 3, endL: true, endR: true });
    }
    // under the atrium stair: a stone wall with doors
    const Pl = B.get('plaster', 'le'); Pl.set({ col: [0.65, 0.6, 0.55], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
    Pl.box(GLAND.x0, G40.y, GSTAIR.z0, GSTAIR.x1, G40.roof, GSTAIR.z0 + 0.4, { faces: 'Z', s: 1 });
    // stalls and crates on the gallery (cover)
    const Pc = B.get('plain', 'le');
    for (const [x, z, w, d, h, c] of [[30, 109, 2.4, 1.2, 1.1, [0.45, 0.3, 0.2]], [46, 111.5, 1.4, 1.4, 1.2, [0.3, 0.25, 0.2]], [70, 108.5, 2.6, 1.2, 1.15, [0.5, 0.15, 0.1]], [92, 110.5, 1.6, 1.6, 1.3, [0.28, 0.24, 0.2]], [103, 107.5, 2.2, 1.2, 1.1, [0.4, 0.3, 0.2]]]) {
      Pc.set({ col: c, rm: [0.8, 0, 0], em: [0, 0, 0, 0] }); Pc.box(x - w / 2, G40.y, z - d / 2, x + w / 2, G40.y + h, z + d / 2, { faces: 'xXzZY' });
      colliders.push({ min: [x - w / 2, G40.y, z - d / 2], max: [x + w / 2, G40.y + h, z + d / 2], data: { mat: 'wood', kind: 'crate' } });
    }
    colliders.push({ min: [G40.x0, G40.y, G40.z1 - 0.32], max: [G40.x1, G40.y + 1.08, G40.z1 - 0.08], data: { mat: 'wood', kind: 'rail' } });
    colliders.push({ min: [G40.x0, G40.roof, G40.z0], max: [G40.x1, G40.roof + 0.8, G40.z1 + 3.4], data: { mat: 'wood', kind: 'ceiling', noBlock: true } });
    // west end of the gallery: a lit stair going down out of sight (closed off)
    Pl.set({ col: [0.6, 0.55, 0.5] }); Pl.box(G40.x0 - 0.5, G40.y, G40.z0, G40.x0, G40.roof, G40.z1, { faces: 'X', s: 1 });
    colliders.push({ min: [G40.x0 - 0.5, G40.y, G40.z0], max: [G40.x0, G40.roof, G40.z1], data: { mat: 'concrete', kind: 'wall' } });
  }
  // ================================================================== the atrium stair from the gate down to the gallery
  {
    const St = B.get('stone', 'le'), Wd = B.get('wood', 'le');
    St.set({ col: [0.6, 0.57, 0.54], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    St.box(GATE.x0, GATE.y - 0.6, GATE.z0, GATE.x1, GATE.y, GATE.z1, { faces: 'Y', s: 1 });
    St.box(GSTAIR.xTop, GATE.y - 0.6, GSTAIR.z0, GSTAIR.x1, GATE.y, GSTAIR.z1, { faces: 'Y', s: 1 });
    const n = Math.round((GSTAIR.y0 - GSTAIR.y1) / 0.17), run = (GSTAIR.xTop - GSTAIR.x0) / n;
    for (let k = 0; k < n; k++) {
      const xa = GSTAIR.xTop - (k + 1) * run, ya = GSTAIR.y0 - k * (GSTAIR.y0 - GSTAIR.y1) / n, yb = ya - (GSTAIR.y0 - GSTAIR.y1) / n;
      // solid steps down to the gallery floor: the tread, and the riser facing down the flight (no floating planks)
      const g = 0.9 + ((k * 37) % 7) / 50;
      St.set({ col: [0.6 * g, 0.57 * g, 0.54 * g] }); St.box(xa, yb - 0.05, GSTAIR.z0, xa + run, yb, GSTAIR.z1, { faces: 'Y', s: 1 });
      St.set({ col: [0.36 * g, 0.34 * g, 0.32 * g] }); St.box(xa, yb - 0.004, GSTAIR.z0, xa + 0.07, yb + 0.002, GSTAIR.z1, { faces: 'Y', s: 1 });   // the worn nosing
      St.set({ col: [0.44 * g, 0.42 * g, 0.4 * g] }); St.box(xa, G40.y, GSTAIR.z0, xa + run, yb - 0.05, GSTAIR.z1, { faces: 'x', s: 1 });
    }
    // under the stair: a solid stone body; the side facing the gallery: a timber balustrade
    St.set({ col: [0.5, 0.48, 0.45] });
    for (let x = GSTAIR.x0; x < GSTAIR.xTop; x += 1.5) St.box(x, G40.y, GSTAIR.z1 - 0.35, x + 1.5, gstairY(x + 1.5) - 0.2, GSTAIR.z1, { faces: 'Z', s: 1 });
    Wd.set({ col: RED, rm: [0.5, 0, 0], em: [0, 0, 0, 0] });
    for (let x = GSTAIR.x0; x < GSTAIR.x1; x += 1.0) {
      const y = gstairY(x), y2 = gstairY(x + 1);
      Wd.box(x - 0.04, y, GSTAIR.z1 - 0.2, x + 0.04, y + 1.0, GSTAIR.z1 - 0.1, { faces: 'xXzZ' });
      Wd.beam([x, y + 1.0, GSTAIR.z1 - 0.15], [x + 1, y2 + 1.0, GSTAIR.z1 - 0.15], 0.1, 0.1);
    }
    for (let x = GSTAIR.x0; x < GSTAIR.x1; x += 2) colliders.push({ min: [x, gstairY(x + 2) - 0.2, GSTAIR.z1 - 0.25], max: [x + 2, gstairY(x) + 1.0, GSTAIR.z1], data: { mat: 'wood', kind: 'rail' } });
    // the cliff wall behind the stair (z 100): board-marked concrete with lanterns down the void
    const Cw = B.get('concrete', 'le'); Cw.set({ col: [0.5, 0.5, 0.48], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    Cw.box(GSTAIR.x0 - 8, G40.y, GSTAIR.z0 - 0.5, GSTAIR.x1 + 1, LSTREET.y, GSTAIR.z0, { faces: 'Z', s: 1 });
    colliders.push({ min: [GSTAIR.x0 - 8, G40.y, GSTAIR.z0 - 0.5], max: [GSTAIR.x1 + 1, LSTREET.y - 0.7, GSTAIR.z0], data: { mat: 'concrete', kind: 'wall' } });
    // the atrium's end walls (the storey above, either side of the void)
    const Pl = B.get('plaster', 'le'); Pl.set({ col: PLASTER, rm: [0.85, 0, 0] });
    Pl.box(GSTAIR.x1 + 0.5, G40.roof, GSTAIR.z0, GSTAIR.x1 + 1, LSTREET.y + 1.5, G40.z0, { faces: 'x', s: 1 });
    // lanterns hanging down the void on long cords, a big plaque on the cliff wall
    for (let x = GSTAIR.x0 + 2; x < GSTAIR.x1 - 1; x += 4) {
      const y = gstairY(x) + 3.6;
      const P = B.get('plain', 'le'); P.set({ col: [0.05, 0.05, 0.05], rm: [0.8, 0, 0], em: [0, 0, 0, 0] }); P.box(x - 0.015, y + 0.4, 101.8, x + 0.015, LSTREET.y + 2, 101.83);
      lantern(B, 'le', x, y, 101.8, 1.3, HI, glows, true);
      lights.push({ p: [x, y, 101.8], color: [1, 0.32, 0.14], r: 6, k: 1.0, grp: 1 });
    }
    const Sg = B.get('sign', 'le'); Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.6, DUSK + HI) });
    signQuad(Sg, [70, 47.6, GSTAIR.z0 + 0.02], [0, 0, 1], 10, 1.9, SIGN.lantern);
  }
  // ================================================================== the west run of old houses (backdrop, under the store and the drive-in tower)
  for (let x = -330; x < -110; x += 9 + r() * 6) {
    const w = 8 + r() * 6;
    if (x + w > -172 && x < -128) continue;   // the Chaotian bridge runs into the cliff here
    let y = QUAY.y, k = 0;
    const topY = x < -128 ? 58 : 46;
    while (y < topY) {
      const h = 4.2 + r() * 0.6, zf = 118 + (topY - y) / topY * 8 + (r() - 0.5);
      storey('lw', x, x + w, y, h, zf, 14, DIST.WEST, { balcony: k % 3 === 2 ? 1.2 : 0, lanterns: r() < 0.25, ends: true, glow: 0.05, wall: r() < 0.5 ? hexc(0xcbbfae) : hexc(0xb8a894) });
      y += h; k++;
    }
    const Rf = B.get('roof', 'lw'); Rf.set({ col: TILEC, rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
    hipRoof(Rf, x, 104, x + w, 116, y, 2.2, { over: 0.9, curl: 0.5, ridge: 0.5 });
  }
  // ================================================================== three pavilion towers rising over the cliff top (between the street rail and the gallery's roofs)
  for (const [cx, tiers, w0] of [[-36, 4, 11], [16, 5, 13], [46, 3, 10]]) {
    const reg = cx < 20 ? 'lw' : 'le';
    let y = BALC.y + 4.2 + 1.3, w = w0;
    const cz = 106.5;
    const Pl = B.get('plaster', reg), Wd = B.get('wood', reg), Rf = B.get('roof', reg), Lt = B.get('plain', reg), Sg = B.get('sign', reg);
    for (let t = 0; t < tiers; t++) {
      const h = t === 0 ? 5.2 : 4.0, d = Math.min(w, 9);
      // the storey: red-timber posts, plaster panels, lit lattice windows on all four faces
      Pl.set({ col: PLASTER, rm: [0.85, 0, 0], em: [0, 0, 0, 0] }); Pl.box(cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2, { faces: 'xXzZ', s: 1 });
      Wd.set({ col: RED, rm: [0.55, 0, 0], em: [0, 0, 0, 0] });
      for (const [px, pz] of [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx - w / 2, cz + d / 2], [cx + w / 2, cz + d / 2]]) Wd.box(px - 0.25, y, pz - 0.25, px + 0.25, y + h, pz + 0.25, { faces: 'xXzZ' });
      Sg.set({ col: [0.9, 0.85, 0.75], rm: [0.7, 0, 0], em: em([1, 0.72, 0.42], 1.1, DUSK + HI) });
      const nw = Math.max(2, Math.round(w / 2.6));
      for (let i = 0; i < nw; i++) { const u = (i + 0.5) / nw - 0.5; signQuad(Sg, [cx + u * w, y + h * 0.52, cz + d / 2 + 0.03], [0, 0, 1], w / nw - 0.6, h * 0.55, SIGN.paper); signQuad(Sg, [cx + u * w, y + h * 0.52, cz - d / 2 - 0.03], [0, 0, -1], w / nw - 0.6, h * 0.55, SIGN.paper); }
      const nd = Math.max(1, Math.round(d / 2.6));
      for (let i = 0; i < nd; i++) { const u = (i + 0.5) / nd - 0.5; signQuad(Sg, [cx + w / 2 + 0.03, y + h * 0.52, cz + u * d], [1, 0, 0], d / nd - 0.6, h * 0.55, SIGN.paper); signQuad(Sg, [cx - w / 2 - 0.03, y + h * 0.52, cz + u * d], [-1, 0, 0], d / nd - 0.6, h * 0.55, SIGN.paper); }
      // the roof of this tier: deep, swept, outlined in gold on all four eaves
      Rf.set({ col: TILEC, rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
      const last = t === tiers - 1;
      const E = hipRoof(Rf, cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, y + h, last ? 3.4 : 1.6, { over: 1.8, curl: 1.1, ridge: last ? 0.2 : 0.75 });
      Lt.set({ col: [0.25, 0.2, 0.12], rm: [0.5, 0.3, 0], em: em(GOLD, 0.45, DUSK + HI) });
      const ly = y + h + 1.1;
      Lt.box(E.X0, ly - 0.1, E.Z0 - 0.08, E.X1, ly, E.Z0 + 0.08); Lt.box(E.X0, ly - 0.1, E.Z1 - 0.08, E.X1, ly, E.Z1 + 0.08);
      Lt.box(E.X0 - 0.08, ly - 0.1, E.Z0, E.X0 + 0.08, ly, E.Z1); Lt.box(E.X1 - 0.08, ly - 0.1, E.Z0, E.X1 + 0.08, ly, E.Z1);
      for (const [px, pz] of [[E.X0, E.Z0], [E.X1, E.Z0], [E.X0, E.Z1], [E.X1, E.Z1]]) lantern(B, reg, px + Math.sign(cx - px) * 0.6, y + h - 0.3, pz + Math.sign(cz - pz) * 0.6, 1.25, HI, t % 2 ? null : glows);
      if (last) { Lt.set({ col: [0.6, 0.45, 0.15], rm: [0.3, 0.9, 0], em: em(GOLD, 1.4, DUSK + HI) }); Lt.cyl(cx, y + h + 3.0, cz, 0.22, 0.05, y + h + 5.8, 6); glows.push({ p: [cx, y + h + 5.6, cz], color: [1.4, 0.8, 0.3], size: 2.2, code: DUSK + HI, far: true }); }
      y += h + (last ? 0 : 1.9); w *= 0.8;
    }
    glows.push({ p: [cx, BALC.y + 12, cz + 6], color: [1.2, 0.55, 0.2], size: w0 * 1.1, code: DUSK + HI, far: true });
  }
  // ================================================================== the ravine side of the cliff: a zigzag stair down the rock, lamps on
  // its landings, three little houses perched on ledges (the cliff's end face was a dead slab from the river)
  {
    const C = B.get('concrete', 'le'), Mt = B.get('metal', 'le'), xr = RAVINE.x0 + 1.2;
    C.set({ col: [0.52, 0.5, 0.47], rm: [0.9, 0, 0], em: em([1.0, 0.6, 0.3], 0.04, DUSK + LO) });
    let y = 38, z = 100, dir = 1;
    while (y > QUAY.y + 1) {
      const z2 = Math.min(124, Math.max(100, z + dir * 16)), y2 = Math.max(QUAY.y, y - 5.5);
      // the flight: a stepped slab (seen from the side as a sawtooth), a steel rail on the outside
      const n = 16; for (let k = 0; k < n; k++) { const za = z + (z2 - z) * k / n, zb = z + (z2 - z) * (k + 1) / n, ya = y + (y2 - y) * (k + 1) / n; C.box(xr, ya - 0.6, Math.min(za, zb), xr + 1.8, ya, Math.max(za, zb), { faces: 'XYz Z', s: 1 }); }
      Mt.set({ col: [0.3, 0.31, 0.32], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] }); Mt.beam([xr + 1.75, y + 1, z], [xr + 1.75, y2 + 1, z2], 0.05, 0.05);
      // the landing + a lamp
      C.box(xr, y2 - 0.6, z2 - 1.5, xr + 2.2, y2, z2 + 1.5, { faces: 'XYzZ', s: 1 });
      Mt.box(xr + 1.9, y2, z2 - 0.05, xr + 2.0, y2 + 3.2, z2 + 0.05);
      glows.push({ p: [xr + 1.95, y2 + 3.3, z2], color: [1.8, 1.1, 0.45], size: 2.4, code: DUSK + LO, far: true });
      y = y2; z = z2; dir = -dir;
    }
    // little houses on ledges: plaster walls facing the river side, a lit window or two, a tile roof
    const Pl = B.get('plaster', 'le'), Rf = B.get('roof', 'le'), Sg = B.get('sign', 'le');
    for (const [hy, hz, hw, hh] of [[30, 108, 5, 3.6], [19, 118, 6, 3.4], [10, 104, 4.5, 3.2]]) {
      Pl.set({ col: hexc(0xc9bba6), rm: [0.85, 0, 0], em: em([1.0, 0.58, 0.26], 0.05, DUSK + LO) });
      Pl.box(xr - 1, hy, hz - hw / 2, xr + 3.4, hy + hh, hz + hw / 2, { faces: 'XzZ', s: 1 });
      Sg.set({ col: [0.9, 0.85, 0.75], rm: [0.7, 0, 0], em: em([1, 0.72, 0.42], 1.0, DUSK + LO) });
      for (const dz of hw > 5 ? [-1.4, 1.4] : [0]) signQuad(Sg, [xr + 3.43, hy + hh * 0.55, hz + dz], [1, 0, 0], 1.3, 1.2, SIGN.paper);
      Rf.set({ col: TILEC, rm: [0.7, 0, 0], em: [0, 0, 0, 0] }); hipRoof(Rf, xr - 1, hz - hw / 2, xr + 3.4, hz + hw / 2, hy + hh, 1.4, { over: 0.8, curl: 0.5, ridge: 0.4 });
      lantern(B, 'le', xr + 3.9, hy + hh - 0.4, hz + hw / 2 - 0.4, 0.8, LO, glows);
    }
  }
  // a plaque over the wall seen from the river: the complex's name in gold
  { const Sg = B.get('sign', 'le'); Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 2.2, DUSK + HI) }); signQuad(Sg, [30, BALC.y + 4.2 + 0.2, BALC.z1 + 1.4], [0, 0, 1], 18, 3.4, SIGN.lantern); }

  const { tris } = B.finish(root, { shadowKeys: ['wood', 'plain'] });
  return { root, anchors: { glows, lights }, panes, colliders, tris };
}
