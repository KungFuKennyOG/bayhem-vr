import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, hexc, mix3, mul3, em, GOLD, DIST, DUSK, hipRoof, signQuad } from './kit.js';
import { SIGN, SIGN_LIST } from './signs.js';
import { materials, SHADOW_KEYS } from './mats.js';
import { gridFace } from './terrain.js';
import { RIVER, ROAD, PODIUM, SLIDE, HILLE, TOWER, TERR, Y } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the city around the play space: residential slabs, office towers and old tiled
//  blocks stacked up the hills behind both banks, every window procedural (lit at random as the
//  night falls, dark when the district's power goes), gold LED crowns and corner strips on the
//  landmarks, red aviation lights. All in a few merged meshes per region.
//  Four skyline districts (FAR_N behind the hillside, FAR_S behind the cliff road, FAR_E upstream,
//  FAR_W downstream) so the blackout can take them one at a time.
// =====================================================================================
const WALLS = [hexc(0xc9bba3), hexc(0xd8c7b6), hexc(0xb8b0a4), hexc(0xe0dad0), hexc(0xc7a99a), hexc(0xa89e94), hexc(0xd2c19d), hexc(0x9fa6ab)];
const GLASSY = [hexc(0x5b6670), hexc(0x4a5560), hexc(0x6f6a5e), hexc(0x3d4650)];

// the ground the skylines stand on: both banks climb away from the river
export const northBase = (x, z) => TERR.y0 + Math.min(90, Math.max(0, (SLIDE.crack - 10 - z)) * 0.11);
export const southBase = (x, z) => Y + Math.min(150, Math.max(0, (z - ROAD.z1 - 24)) * 0.3);   // the south bank climbs steeply: the city stacks up behind the road

// keep-out boxes (the route, the hillside, the tower, the river): [x0, z0, x1, z1]
const KEEP = [
  [-1500, RIVER.z0 - 4, 2000, RIVER.z1 + 4],
  [ROAD.x0 - 40, RIVER.z1, ROAD.x1 + 40, ROAD.z1 + 34],                    // the road and its frontage (route.js)
  [SLIDE.x0 - 10, 18, PODIUM.x1 + 16, RIVER.z0],                          // the hillside district, the podium
  [TOWER.x0 - 60, TOWER.z0 - 70, TOWER.x1 + 60, TOWER.z1],                // Jinlong stands alone
  [262, 336, 482, 466],                                                    // the department store, the Hundred Steps, the flyover (steps.js)
  [-1500, 20, 2000, RIVER.z0],                                             // the north bank's terraces
];
const free = (x0, z0, x1, z1) => !KEEP.some(k => x1 > k[0] && x0 < k[2] && z1 > k[1] && z0 < k[3]);

export function towerBlock(B, t, region, glows) {
  const { x0, z0, x1, z1, y0, h } = t;
  const r = makeRng(t.seed);
  const style = t.style, floor = style === 1 || style === 4 ? 3.9 : 3.0;
  const bay = style === 1 ? 1.6 : style === 4 ? 2.0 : style === 2 ? 3.4 : 3.0;
  const key = style === 1 || style === 4 ? 'win' : 'tile';
  const A = B.get(key, region);
  const col = style === 1 || style === 4 ? GLASSY[t.seed % GLASSY.length] : WALLS[t.seed % WALLS.length];
  const code = t.dist;
  // a 2-floor podium of shops, then the shaft (one or two setbacks on the tall ones)
  const podH = t.podium ? 8 : 0;
  if (podH) {
    const P = B.get('tile', region);
    P.set({ col: mul3(col, 0.8), rm: [0.8, 0, 0], em: [0, 0, 0, code], cell: [5, 4, 3.0 + t.seed, 3] });
    P.box(x0 - 2, y0 - 6, z0 - 2, x1 + 2, y0 + podH, z1 + 2, { faces: 'xXzZ', s: 1, wy0: y0 - 6, emLo: [0.2, 0.12, 0.05, code] });   // street light washing up the podium (it crushed to black from the river)
    const R = B.get('concrete', region); R.set({ col: [0.5, 0.5, 0.5], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    R.box(x0 - 2, y0 + podH, z0 - 2, x1 + 2, y0 + podH + 0.6, z1 + 2, { faces: 'Y', s: 1 });
  }
  const sets = h > 130 && r() < 0.45 ? [0.7, 0.9] : h > 90 && r() < 0.3 ? [0.82] : [];   // setbacks on the tall ones (reviews: "the towers are pillars")
  // the plan: residential towers are cruciform (notched corners: the re-entrant balconies of a Chinese point tower), some
  // office towers too (smaller notches): the notches catch shadow and break the silhouette of every edge
  const notch = style === 0 || style === 2 ? 0.2 : (t.seed % 3 === 0 ? 0.1 : 0);
  let bx0 = x0, bz0 = z0, bx1 = x1, bz1 = z1, ya = y0 + podH;
  const levels = [...sets, 1], stages = [];
  for (let i = 0; i < levels.length; i++) {
    const yb = y0 + h * levels[i];
    // uplight: a warm wash fading up the face's lower band (gold on the landmarks)
    const flood = t.flood ? em(t.flood, 1, code) : [0, 0, 0, code];
    A.set({ col, rm: [style === 1 || style === 4 ? 0.35 : 0.85, style === 1 ? 0.2 : 0, 0], cell: [bay, floor, t.seed * 0.137 % 1 * 50 + i, style] });
    const fy = Math.min(yb, ya + 22);
    if (t.flood && i === 0) {
      A.set({ em: flood }); A.box(bx0, ya, bz0, bx1, fy, bz1, { faces: 'xXzZ', s: 1, wy0: y0, top: col });
      A.set({ em: [0, 0, 0, code] }); if (yb > fy) A.box(bx0, fy, bz0, bx1, yb, bz1, { faces: 'xXzZ', s: 1, wy0: y0 });
    } else {
      // the shaft: a faint street-glow at its foot, a touch lighter toward the sky (it read as one flat dark prism)
      A.set({ em: [0, 0, 0, code] }); const lo = i === 0 ? [0.05, 0.032, 0.015, code] : null, topc = mul3(col, 1.12);
      if (notch) { const nx = (bx1 - bx0) * notch, nz = (bz1 - bz0) * notch;
        A.box(bx0, ya, bz0 + nz, bx1, yb, bz1 - nz, { faces: 'xXzZ', s: 1, wy0: y0, emLo: lo, top: topc });
        A.box(bx0 + nx, ya, bz0, bx1 - nx, yb, bz1, { faces: 'xXzZ', s: 1, wy0: y0, emLo: lo, top: topc });
      } else A.box(bx0, ya, bz0, bx1, yb, bz1, { faces: 'xXzZ', s: 1, wy0: y0, emLo: lo, top: topc });
    }
    // the roof slab of this stage (following the notches), a dark parapet coping
    const R = B.get('concrete', region); R.set({ col: [0.42, 0.42, 0.43], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    if (notch && (!t.flood || i > 0)) { const nx = (bx1 - bx0) * notch, nz = (bz1 - bz0) * notch;
      R.box(bx0 - 0.3, yb, bz0 + nz - 0.3, bx1 + 0.3, yb + 0.9, bz1 - nz + 0.3, { faces: 'xXzZY', s: 1 }); R.box(bx0 + nx - 0.3, yb, bz0 - 0.3, bx1 - nx + 0.3, yb + 0.9, bz1 + 0.3, { faces: 'xXzZY', s: 1 });
    } else R.box(bx0 - 0.3, yb, bz0 - 0.3, bx1 + 0.3, yb + 0.9, bz1 + 0.3, { faces: 'xXzZY', s: 1 });
    stages.push({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, ya, yb, n: t.flood && i === 0 ? 0 : notch });
    ya = yb + 0.9;
    if (i < levels.length - 1) { const ix = (bx1 - bx0) * 0.12, iz = (bz1 - bz0) * 0.12; bx0 += ix; bx1 -= ix; bz0 += iz; bz1 -= iz; }
  }
  const top = ya, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  // roof clutter: plant rooms, water tanks
  const Rf = B.get('concrete', region); Rf.set({ col: [0.38, 0.38, 0.4], rm: [0.9, 0, 0] });
  const nb = 1 + Math.floor(r() * 3);
  for (let k = 0; k < nb; k++) { const w = 2 + r() * 5, d = 2 + r() * 4, px = bx0 + 1 + r() * Math.max(0.1, bx1 - bx0 - 2 - w), pz = bz0 + 1 + r() * Math.max(0.1, bz1 - bz0 - 2 - d); Rf.box(px, top, pz, px + w, top + 2 + r() * 3, pz + d, { faces: 'xXzZY', s: 1 }); }
  // antenna masts and a lift overrun on the tall ones, a red light on each mast
  if (h > 95 && t.crown !== 'spire') { const Mm = B.get('metal', region); Mm.set({ col: [0.2, 0.2, 0.22], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    const nm = 1 + Math.floor(r() * 2);
    for (let k = 0; k < nm; k++) { const mx = bx0 + 2 + r() * Math.max(0.5, bx1 - bx0 - 4), mz = bz0 + 2 + r() * Math.max(0.5, bz1 - bz0 - 4), mh = 6 + r() * 16;
      Mm.cyl(mx, top, mz, 0.35, 0.12, top + mh, 5, { cap: false }); glows.push({ p: [mx, top + mh + 0.3, mz], color: [2.6, 0.12, 0.06], size: 2.2, blink: true, rate: 1.6 + r(), code: DUSK + code, far: true }); } }
  // one tower in six: its roof edge outlined in LED (the Chongqing waterfront's outlined tops); a few helipads
  if (h > 80 && t.seed % 6 === 1 && !t.crown) { const L = B.get('plain', region), c = t.ledCol || GOLD; L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(c, 1.4, code), cell: [0, 0, 0, 0] });
    const e = 0.6, yy = top - 0.2; L.box(bx0 - 0.4, yy, bz0 - 0.4, bx1 + 0.4, yy + e, bz0 - 0.1, { faces: 'xXzZY' }); L.box(bx0 - 0.4, yy, bz1 + 0.1, bx1 + 0.4, yy + e, bz1 + 0.4, { faces: 'xXzZY' }); L.box(bx0 - 0.4, yy, bz0 - 0.1, bx0 - 0.1, yy + e, bz1 + 0.1, { faces: 'xXzZY' }); L.box(bx1 + 0.1, yy, bz0 - 0.1, bx1 + 0.4, yy + e, bz1 + 0.1, { faces: 'xXzZY' }); }
  if (h > 110 && t.seed % 7 === 3 && !t.crown && bx1 - bx0 > 16 && bz1 - bz0 > 16) { const Hp = B.get('concrete', region), L = B.get('plain', region), R2 = Math.min(bx1 - bx0, bz1 - bz0) * 0.38;
    Hp.set({ col: [0.32, 0.33, 0.3], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); Hp.cyl(cx, top, cz, R2, R2, top + 1.2, 16);
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em([0.4, 1.0, 0.5], 1.6, code), cell: [0, 0, 0, 0] }); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; L.box(cx + Math.cos(a) * R2 - 0.2, top + 1.2, cz + Math.sin(a) * R2 - 0.2, cx + Math.cos(a) * R2 + 0.2, top + 1.45, cz + Math.sin(a) * R2 + 0.2); } }
  // a tower crane on one tall roof in eleven (the city is never finished): mast, jib and counter-jib against the sky, a
  // red light on the jib tip and the mast top. Breaks the skyline's run of flat tops with a silhouette that reads at 1 km
  if (h > 75 && t.seed % 11 === 5 && !t.crown && !t.roofSign) {
    const Cr = B.get('metal', region); Cr.set({ col: [0.55, 0.42, 0.12], rm: [0.6, 0.5, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    const mx = cx + (r() - 0.5) * (bx1 - bx0) * 0.4, mz = cz + (r() - 0.5) * (bz1 - bz0) * 0.4, mh = 24 + r() * 14, a = r() * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a), jy = top + mh, jl = 34 + r() * 14, cl = 12;
    for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) Cr.box(mx + ox - 0.15, top, mz + oz - 0.15, mx + ox + 0.15, jy + 4, mz + oz + 0.15, { faces: 'xXzZ' });
    for (let y = top + 3; y < jy; y += 3) { Cr.beam([mx - 0.7, y, mz - 0.7], [mx + 0.7, y + 3, mz + 0.7], 0.08, 0.08); Cr.beam([mx + 0.7, y, mz - 0.7], [mx - 0.7, y + 3, mz + 0.7], 0.08, 0.08); }
    Cr.beam([mx - ca * cl, jy, mz - sa * cl], [mx + ca * jl, jy, mz + sa * jl], 0.9, 0.7);              // jib + counter-jib
    Cr.beam([mx, jy + 4, mz], [mx + ca * jl * 0.6, jy + 0.7, mz + sa * jl * 0.6], 0.12, 0.12);         // tie rods
    Cr.beam([mx, jy + 4, mz], [mx - ca * cl, jy + 0.7, mz - sa * cl], 0.12, 0.12);
    const Cw = B.get('concrete', region); Cw.set({ col: [0.35, 0.35, 0.36], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    Cw.box(mx - ca * cl - 1.6, jy - 2.4, mz - sa * cl - 1.6, mx - ca * cl + 1.6, jy - 0.4, mz - sa * cl + 1.6, { faces: 'xXzZY' });   // counterweight
    Cw.box(mx - 1.1, jy - 2.6, mz - 1.1, mx + 1.1, jy - 0.5, mz + 1.1, { faces: 'xXzZY' });                                          // cab
    glows.push({ p: [mx + ca * jl, jy + 0.6, mz + sa * jl], color: [2.6, 0.12, 0.06], size: 2.4, blink: true, rate: 1.3 + r(), code: DUSK + code, far: true });
    glows.push({ p: [mx, jy + 4.6, mz], color: [2.6, 0.12, 0.06], size: 2.2, code: DUSK + code, far: true });
  }
  // crowns
  const crown = t.crown;
  if (crown === 'led' || crown === 'lantern') {
    const L = B.get('plain', region); const c = t.ledCol || GOLD;
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(c, 1.5, code) });
    const e = 0.35, y1 = top + (crown === 'lantern' ? 9 : 1.2);
    if (crown === 'lantern') {
      // an open lit lantern box (frame posts + lit bands)
      L.set({ em: em(c, 1.1, code) });
      for (const yy of [top + 0.5, top + 4.5, top + 8.5]) { L.box(bx0, yy, bz0, bx1, yy + 0.5, bz0 + e); L.box(bx0, yy, bz1 - e, bx1, yy + 0.5, bz1); L.box(bx0, yy, bz0, bx0 + e, yy + 0.5, bz1); L.box(bx1 - e, yy, bz0, bx1, yy + 0.5, bz1); }
      for (const [px, pz] of [[bx0, bz0], [bx1 - e, bz0], [bx0, bz1 - e], [bx1 - e, bz1 - e]]) L.box(px, top, pz, px + e, y1, pz + e);
    } else {
      L.box(bx0 - 0.4, top - 0.4, bz0 - 0.4, bx1 + 0.4, top, bz0 - 0.4 + e, { faces: 'xXzZY' }); L.box(bx0 - 0.4, top - 0.4, bz1 + 0.4 - e, bx1 + 0.4, top, bz1 + 0.4, { faces: 'xXzZY' });
      L.box(bx0 - 0.4, top - 0.4, bz0 - 0.4, bx0 - 0.4 + e, top, bz1 + 0.4, { faces: 'xXzZY' }); L.box(bx1 + 0.4 - e, top - 0.4, bz0 - 0.4, bx1 + 0.4, top, bz1 + 0.4, { faces: 'xXzZY' });
    }
    glows.push({ p: [cx, y1 + 1, cz], color: mul3(c, 0.6), size: Math.max(bx1 - bx0, bz1 - bz0) * 0.45, code, far: true });
  }
  // the stage's plan outline (the cruciform notches included): LED trims follow the walls, not the bounding box
  // (they used to run round the box: on a notched or set-back tower they stood off the facade like a cage)
  const outline = (S) => {
    if (!S.n) return [[S.x0, S.z0], [S.x1, S.z0], [S.x1, S.z1], [S.x0, S.z1]];
    const nx = (S.x1 - S.x0) * S.n, nz = (S.z1 - S.z0) * S.n;
    return [[S.x0 + nx, S.z0], [S.x1 - nx, S.z0], [S.x1 - nx, S.z0 + nz], [S.x1, S.z0 + nz], [S.x1, S.z1 - nz], [S.x1 - nx, S.z1 - nz], [S.x1 - nx, S.z1], [S.x0 + nx, S.z1], [S.x0 + nx, S.z1 - nz], [S.x0, S.z1 - nz], [S.x0, S.z0 + nz], [S.x0 + nx, S.z0 + nz]];
  };
  const outer = (S) => { const P = outline(S); return S.n ? [P[0], P[1], P[3], P[4], P[6], P[7], P[9], P[10]] : P; };
  if (t.corners) {
    // LED strips up the outer corners of each stage (Chongqing's outlined skyline)
    const L = B.get('plain', region); const c = t.ledCol || GOLD; const w = Math.max(0.3, h / 300) / 2;
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(c, 0.75, code) });   // (dimmer: bright thin edges read as a wireframe)
    for (const S of stages) for (const [px, pz] of outer(S)) L.box(px - w, S.ya, pz - w, px + w, S.yb, pz + w, { faces: 'xXzZ' });
  }
  if (t.bands) {
    // horizontal LED bands every few floors (the Chongqing waterfront look); a thin line, not a laser, on the wall
    const L = B.get('plain', region); const c = t.bandCol || [0.6, 0.85, 1.0];
    L.set({ col: [0.15, 0.15, 0.16], rm: [0.5, 0.5, 0], em: em(c, t.bandEm || 1.0, code + 32), cell: [0, 0, 0, 0] });   // animated (kit.js: codes >= 32)
    const step = floor * (t.bands | 0 || 4);
    const bh = Math.max(0.3, Math.min(0.6, h / 220)), o = 0.1;
    for (let y = y0 + podH + step; y < top - 2; y += step) {
      const S = stages.find(S => y >= S.ya && y + bh <= S.yb - 1); if (!S) continue;
      const P = outline(S);
      for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length];
        L.box(Math.min(a[0], b[0]) - o, y, Math.min(a[1], b[1]) - o, Math.max(a[0], b[0]) + o, y + bh, Math.max(a[1], b[1]) + o); }
    }
  }
  if (crown === 'diamond') {
    // a faceted glass pyramid cap with lit edges
    const Gd = B.get('win', region), L = B.get('plain', region), c = t.ledCol || GOLD, ph = Math.min(bx1 - bx0, bz1 - bz0) * 0.9;
    Gd.set({ col, rm: [0.3, 0.3, 0], em: em(c, 0.12, code), cell: [0, 0, 0, 0] });
    const ap = [cx, top + ph, cz], cr = [[bx0, top, bz0], [bx1, top, bz0], [bx1, top, bz1], [bx0, top, bz1]];
    for (let k = 0; k < 4; k++) { const a1 = cr[k], b1 = cr[(k + 1) % 4]; Gd.tri(a1, ap, b1); Gd.tri(a1, b1, ap); }
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(c, 1.3, code), cell: [0, 0, 0, 0] });
    for (const q of cr) L.beam(q, ap, 0.35, 0.35);
    glows.push({ p: [cx, top + ph + 1, cz], color: mul3(c, 0.9), size: 3, code, far: true });
  }
  if (crown === 'frame') {
    // the decorative roof frame of a Chinese residential tower: an open portal frame with a lit edge
    const F = B.get('concrete', region), L = B.get('plain', region), fh = 7;
    F.set({ col: [0.62, 0.6, 0.57], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    for (const [ax, az] of [[bx0, bz0], [bx1 - 0.8, bz0], [bx0, bz1 - 0.8], [bx1 - 0.8, bz1 - 0.8]]) F.box(ax, top, az, ax + 0.8, top + fh, az + 0.8, { faces: 'xXzZ' });
    F.box(bx0, top + fh - 1, bz0, bx1, top + fh, bz1, { faces: 'xXzZYy' });
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(t.ledCol || [1.0, 0.85, 0.6], 0.9, code), cell: [0, 0, 0, 0] });
    L.box(bx0 - 0.05, top + fh - 1.05, bz0 - 0.05, bx1 + 0.05, top + fh - 0.85, bz0 + 0.1); L.box(bx0 - 0.05, top + fh - 1.05, bz1 - 0.1, bx1 + 0.05, top + fh - 0.85, bz1 + 0.05);
  }
  if (crown === 'pagoda') {
    // a two-tier Chinese roof pavilion on the tower top, gold LED along every eave
    const Rr = B.get('roof', region), Lp = B.get('plain', region), Pw = B.get('plaster', region);
    const w = (bx1 - bx0) * 0.7, d = (bz1 - bz0) * 0.7;
    Pw.set({ col: [0.7, 0.32, 0.22], rm: [0.8, 0, 0], em: [0, 0, 0, 0] }); Pw.box(cx - w / 2, top, cz - d / 2, cx + w / 2, top + 5, cz + d / 2, { faces: 'xXzZ', s: 1 });
    Rr.set({ col: [0.35, 0.36, 0.38], rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
    const e1 = hipRoof(Rr, cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, top + 5, 4, { over: 2.2, curl: 1.0, ridge: 0.3 });
    Pw.box(cx - w * 0.3, top + 8, cz - d * 0.3, cx + w * 0.3, top + 11, cz + d * 0.3, { faces: 'xXzZ', s: 1 });
    const e2 = hipRoof(Rr, cx - w * 0.3, cz - d * 0.3, cx + w * 0.3, cz + d * 0.3, top + 11, 4, { over: 1.6, curl: 0.8, ridge: 0.25 });
    Lp.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(GOLD, 0.9, code) });
    for (const [E, yy] of [[e1, top + 5 + 1.0], [e2, top + 11 + 0.8]]) { Lp.box(E.X0, yy - 0.25, E.Z0 - 0.1, E.X1, yy, E.Z0 + 0.15); Lp.box(E.X0, yy - 0.25, E.Z1 - 0.15, E.X1, yy, E.Z1 + 0.1); Lp.box(E.X0 - 0.1, yy - 0.25, E.Z0, E.X0 + 0.15, yy, E.Z1); Lp.box(E.X1 - 0.15, yy - 0.25, E.Z0, E.X1 + 0.1, yy, E.Z1); }
    glows.push({ p: [cx, top + 9, cz], color: mul3(GOLD, 1.3), size: w * 0.9, code, far: true });
  }
  if (t.roofSign && crown !== 'pagoda' && crown !== 'lantern') {
    // the building's name in lit characters on a steel frame on the roof, facing the river / the route
    const N = t.signN || [0, 0, 1], S = B.get('sign', region), F = B.get('metal', region);
    const along = Math.abs(N[2]) > 0.5 ? bx1 - bx0 : bz1 - bz0, sw = Math.min(along * 0.92, 42), sh = sw / 4;
    const px = cx + N[0] * ((bx1 - bx0) / 2 - 1.2), pz = cz + N[2] * ((bz1 - bz0) / 2 - 1.2), py = top + 1.2 + sh / 2;
    F.set({ col: [0.18, 0.18, 0.2], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
    for (let k = -1; k <= 1; k += 2) { const ox = px + N[2] * k * sw * 0.42, oz = pz - N[0] * k * sw * 0.42; F.box(ox - 0.15, top, oz - 0.15, ox + 0.15, py + sh / 2, oz + 0.15); F.beam([ox - N[0] * 3, top, oz - N[2] * 3], [ox, py + sh * 0.3, oz], 0.18, 0.18); }
    S.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.9, code), cell: [0, 0, 0, 0] });
    signQuad(S, [px + N[0] * 0.2, py, pz + N[2] * 0.2], N, sw, sh, SIGN[t.roofSign]);
    const sc = t.roofSign && SIGN_LIST.roofs.indexOf(t.roofSign) % 2 ? [3, 1.9, 0.6] : [3, 0.5, 0.2];
    glows.push({ p: [px + N[0] * 2, py, pz + N[2] * 2], color: mul3(sc, 0.45), size: sw * 0.55, code, far: true });
  }
  if (crown === 'spire') {
    const S = B.get('metal', region); S.set({ col: [0.2, 0.2, 0.22], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
    S.cyl(cx, top, cz, 1.4, 0.15, top + h * 0.18, 6, { cap: false });
    glows.push({ p: [cx, top + h * 0.18 + 1, cz], color: [3, 0.15, 0.08], size: 4, blink: true, code: DUSK + code, far: true });
  }
  if (h > 85) for (const [px, pz] of [[bx0, bz0], [bx1, bz1]]) glows.push({ p: [px, top + 1.5, pz], color: [2.6, 0.12, 0.06], size: 2.6, blink: true, rate: 2.2 + r(), code: DUSK + code, far: true });
  // the plinth down to the terrace below (the hill steps): concrete, streaked
  if (t.plinth) { const P = B.get('concrete', region); P.set({ col: [0.6, 0.6, 0.58], rm: [0.92, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); P.box(x0 - 3, y0 - t.plinth, z0 - 3, x1 + 3, y0 - (podH ? 6 : 0), z1 + 3, { faces: 'xXzZ', s: 1 }); }
  return { top };
}

export function buildCity(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'city';
  const glows = [];
  const r = makeRng(7741);
  let seed = 100;
  const place = (region, n, gen) => {
    let tries = 0, made = 0;
    while (made < n && tries < n * 30) {
      tries++;
      const t = gen(); if (!t) continue;
      if (!free(t.x0 - 4, t.z0 - 4, t.x1 + 4, t.z1 + 4)) continue;
      KEEP.push([t.x0 - 3, t.z0 - 3, t.x1 + 3, t.z1 + 3]);
      t.seed = seed++;
      towerBlock(B, t, region, glows); made++;
    }
  };
  const slab = (x, z, base, h, o = {}) => {
    const w = o.w ?? 13 + r() * 11, d = o.d ?? 11 + r() * 7, rot = r() < 0.5;
    const W = rot ? d : w, D = rot ? w : d;
    const style = o.style ?? (r() < 0.22 ? 1 : r() < 0.12 ? 4 : r() < 0.3 ? 2 : 0);
    const big = h > 120;
    return { x0: x - W / 2, z0: z - D / 2, x1: x + W / 2, z1: z + D / 2, y0: base, h, style, podium: r() < 0.35, plinth: o.plinth ?? 14,
      crown: big && r() < 0.75 ? (r() < 0.3 ? 'led' : r() < 0.3 ? 'diamond' : r() < 0.35 ? 'lantern' : r() < 0.5 ? 'pagoda' : 'spire') : h > 70 && r() < 0.35 ? (r() < 0.3 ? 'pagoda' : r() < 0.5 ? 'frame' : r() < 0.5 ? 'diamond' : 'led') : null,
      bands: (style === 1 && r() < 0.5) || (h > 90 && r() < 0.42) ? 3 + Math.floor(r() * 3) : 0, bandCol: (() => { if (r() < 0.4) return [0.55, 0.85, 1.0]; const c2 = r(); return c2 < 0.5 ? GOLD : [1.0, 0.32, 0.78]; })(),
      roofSign: h > 60 && r() < 0.42 ? SIGN_LIST.roofs[Math.floor(r() * SIGN_LIST.roofs.length)] : null, signN: o.signN,
      corners: h > 90 && r() < 0.3, flood: h > 70 && r() < 0.3 ? GOLD : null, ledCol: r() < 0.75 ? GOLD : r() < 0.5 ? [0.85, 0.92, 1.0] : [1.0, 0.3, 0.12], dist: o.dist };
  };
  // residential estates (xiaoqu): rows of identical 30-odd-storey point towers with roof frames — the real texture of the city
  const estate = (region, cx, cz, base, n, dist, signN) => {
    const h = 85 + r() * 40, w = 18 + r() * 4, d = 17 + r() * 4, gap = w + 8 + r() * 4, ang = r() < 0.5;
    const name = SIGN_LIST.roofs[Math.floor(r() * SIGN_LIST.roofs.length)];
    for (let i = 0; i < n; i++) {
      const x = cx + (ang ? i * gap : (i % 2) * 6), z = cz + (ang ? (i % 2) * 6 : i * gap);
      const t = { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, y0: base(x, z), h, style: 0, podium: false, plinth: 20, crown: 'frame', ledCol: [1.0, 0.82, 0.55], roofSign: i === 0 ? name : null, signN, dist };
      if (!free(t.x0 - 3, t.z0 - 3, t.x1 + 3, t.z1 + 3)) continue;
      KEEP.push([t.x0 - 2, t.z0 - 2, t.x1 + 2, t.z1 + 2]); t.seed = seed++;
      towerBlock(B, t, region, glows);
    }
  };
  // two landmark clusters (one each side of the river, both on the way's sightlines): three glass towers in a row joined
  // across their tops by a lit horizontal skybridge (a Raffles City), LED-outlined. Silhouettes no other city has.
  const hero = (region, cx, cz, base, dist, signN) => {
    const hs = [205, 232, 214], W = 26, D = 24, gap = 34, tops = [];
    for (let i = 0; i < 3; i++) { const x = cx + (i - 1) * (W + gap), t = { x0: x - W / 2, z0: cz - D / 2, x1: x + W / 2, z1: cz + D / 2, y0: base(x, cz), h: hs[i], style: 1, podium: true, plinth: 24, crown: null, corners: false, ledCol: [0.6, 0.85, 1.0], bands: 4, bandEm: 1.7, bandCol: [0.45, 0.8, 1.0], roofSign: i === 1 ? SIGN_LIST.roofs[0] : null, signN, dist };
      KEEP.push([t.x0 - 3, t.z0 - 3, t.x1 + 3, t.z1 + 3]); t.seed = seed++; tops.push(towerBlock(B, t, region, glows).top); }
    const by = Math.min(...tops) - 26, bx0 = cx - 1.5 * W - gap + W, bx1 = cx + 1.5 * W + gap - W, G2 = B.get('win', region), L = B.get('plain', region);
    G2.set({ col: GLASSY[1], rm: [0.3, 0.3, 0], em: [0, 0, 0, dist], cell: [1.6, 3.9, 77, 1] });
    G2.box(cx - 1.5 * W - gap * 0.5, by, cz - D * 0.35, cx + 1.5 * W + gap * 0.5, by + 16, cz + D * 0.35, { faces: 'xXzZ', s: 1, wy0: by });
    const Rc = B.get('concrete', region); Rc.set({ col: [0.4, 0.4, 0.42], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    Rc.box(cx - 1.5 * W - gap * 0.5, by + 16, cz - D * 0.35, cx + 1.5 * W + gap * 0.5, by + 17, cz + D * 0.35, { faces: 'xXzZY', s: 1 }); Rc.box(cx - 1.5 * W - gap * 0.5, by - 1, cz - D * 0.35, cx + 1.5 * W + gap * 0.5, by, cz + D * 0.35, { faces: 'xXzZy', s: 1 });
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em([0.6, 0.85, 1.0], 1.5, dist + 32), cell: [0, 0, 0, 0] });
    for (const yy of [by - 1.6, by + 17.2]) for (const zz of [cz - D * 0.35 - 0.3, cz + D * 0.35]) L.box(cx - 1.5 * W - gap * 0.5, yy, zz, cx + 1.5 * W + gap * 0.5, yy + 0.8, zz + 0.3);
    glows.push({ p: [cx, by + 8, cz], color: [0.3, 0.5, 0.8], size: 30, code: dist, far: true });   // (size 70 washed the whole cluster milky)
    void bx0; void bx1;
  };
  hero('ne', 960, -230, northBase, DIST.FAR_E, [0, 0, 1]);
  hero('sw', 60, ROAD.z1 + 240, southBase, DIST.FAR_W, [0, 0, -1]);
  const nearJin = (x, z) => Math.hypot(x - (TOWER.x0 + TOWER.x1) / 2, z - (TOWER.z0 + TOWER.z1) / 2) < 320;
  const distN = (x) => x < 250 ? DIST.FAR_W : x > 800 ? DIST.FAR_E : DIST.FAR_N;
  const distS = (x) => x < 250 ? DIST.FAR_W : x > 800 ? DIST.FAR_E : DIST.FAR_S;
  // the north bank's hills, behind the hillside district and the tower (Jinlong must stay the tallest thing near it)
  for (let k = 0; k < 6; k++) { const x = -500 + r() * 1900; estate(x < 250 ? 'nw' : x > 800 ? 'ne' : 'nc', x, -420 + r() * 300, northBase, 4, distN(x), [0, 0, 1]); }
  place('nc', 110, () => { const x = 250 + r() * 550, z = -520 + r() * 520; const h = (nearJin(x, z) ? 34 : 44) + Math.pow(r(), 1.6) * (nearJin(x, z) ? 80 : 150); return slab(x, z, northBase(x, z), h, { dist: DIST.FAR_N, signN: [0, 0, 1] }); });
  place('nw', 120, () => { const x = -1100 + r() * 1350, z = -520 + r() * 540; const h = 36 + Math.pow(r(), 1.5) * 160; return slab(x, z, northBase(x, z), h, { dist: DIST.FAR_W, signN: [0, 0, 1], plinth: 30 }); });
  place('ne', 110, () => { const x = 800 + r() * 800, z = -520 + r() * 540; const h = (nearJin(x, z) ? 34 : 40) + Math.pow(r(), 1.5) * 160; return slab(x, z, northBase(x, z), h, { dist: DIST.FAR_E, signN: [0, 0, 1], plinth: 30 }); });
  // the south bank's hills, behind the cliff road's frontage
  for (let k = 0; k < 7; k++) { const x = -500 + r() * 1900; estate(x < 250 ? 'sw' : x > 800 ? 'se' : 'sc', x, ROAD.z1 + 150 + r() * 380, southBase, 4 + Math.floor(r() * 3), distS(x), [0, 0, -1]); }
  place('sc', 120, () => { const x = 250 + r() * 550, z = ROAD.z1 + 44 + Math.pow(r(), 0.8) * 560; const h = 34 + Math.pow(r(), 1.5) * (z < ROAD.z1 + 120 ? 70 : 190); return slab(x, z, southBase(x, z), h, { dist: DIST.FAR_S, signN: [0, 0, -1], plinth: 24 }); });
  place('sw', 120, () => { const x = -1100 + r() * 1350, z = RIVER.z1 + 30 + Math.pow(r(), 0.8) * 620; const h = 34 + Math.pow(r(), 1.4) * 180; return slab(x, z, southBase(x, z), h, { dist: DIST.FAR_W, signN: [0, 0, -1], plinth: 30 }); });
  place('se', 120, () => { const x = 800 + r() * 800, z = RIVER.z1 + 30 + Math.pow(r(), 0.8) * 620; const h = 34 + Math.pow(r(), 1.4) * 180; return slab(x, z, southBase(x, z), h, { dist: DIST.FAR_E, signN: [0, 0, -1], plinth: 30 }); });
  // the old town packed up the hill round the store (low tiled blocks between the towers): the hill read as a bare ramp
  // from the start roof once it had a surface
  place('sc', 140, () => { const x = 120 + r() * 600, z = ROAD.z1 + 40 + Math.pow(r(), 1.3) * 380; const h = 10 + Math.pow(r(), 1.3) * 26;
    const t = slab(x, z, southBase(x, z), h, { dist: distS(x), signN: [0, 0, -1], plinth: 10, w: 9 + r() * 9, d: 8 + r() * 7, style: r() < 0.6 ? 0 : 2 }); t.podium = r() < 0.5; return t; });
  // the south bank's hill itself: the towers climb it on plinths, but the ground between them was the flat plain at road
  // level 150 m below, so from the roof, the lift and the glide the skyline stood on stilts over a grey void. A dark
  // heightfield on southBase, its street grid washed in sodium (the lamps between the blocks), out with each district.
  {
    const Gd = B.get('concrete', 'shill'); Gd.set({ col: [0.15, 0.15, 0.16], rm: [0.95, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    const hole = [235, 330, 500, 485];   // the department store, the Hundred Steps, the plaza (steps.js builds its own ground)
    const street = (v, p) => Math.pow(Math.max(0, Math.cos(v * Math.PI / p)), 6);
    const emFn = (q) => { const x = q[0], z = q[2], k = Math.max(street(x + 17, 60), street(z - 360, 45) * 0.8) * (0.6 + 0.4 * Math.sin(x * 0.013 + z * 0.021) ** 2);
      return [1.0 * 0.09 * k, 0.58 * 0.09 * k, 0.26 * 0.09 * k, DUSK + distS(x)]; };
    const colFn = (q) => { const k = 0.8 + 0.2 * Math.sin(q[0] * 0.031) * Math.sin(q[2] * 0.027); return [0.15 * k, 0.15 * k, 0.16 * k]; };
    const T = 30, Z0 = 360, gy = (X, Z) => southBase(X, Z) - 0.6;
    let hx0 = 1e9, hx1 = -1e9, hz1 = -1e9;
    for (let x = -1200; x < 1800; x += T) for (let z = Z0; z < 1080; z += T) {
      if (x + T > hole[0] && x < hole[2] && z + T > hole[1] && z < hole[3]) { hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x + T); hz1 = Math.max(hz1, z + T); continue; }
      gridFace(Gd, (u, v) => { const X = x + T * u, Z = z + T * (1 - v); return [X, gy(X, Z), Z]; }, 2, 2, { colFn, emFn });
    }
    // retaining walls where the hill is cut: round the store's hole and along the hill's foot behind the frontage
    // (Chongqing's walls: wet concrete, lamps along the top washing down it)
    // the walls are built into: tiled cliff-houses stacked against them, windows lit like the rest of the city
    const W = B.get('tile', 'shill');
    const wall = (ax, az, bx, bz, n) => {   // a vertical face from the flat ground to the hill along a→b (normal = dir × up)
      const code = distS((ax + bx) / 2);
      W.set({ col: WALLS[(ax * 7 + az) & 7], rm: [0.88, 0, 0], em: [0, 0, 0, code], cell: [3.2, 3.0, Math.abs(ax * 0.37 + az * 0.11) % 50, 0] });
      const wemFn = (q, u, v) => { const k = Math.pow(v, 3) * (0.55 + 0.45 * Math.cos(q[0] * 0.21 + q[2] * 0.21) ** 8); return [0.08 * k, 0.05 * k, 0.025 * k, code]; };
      gridFace(W, (u, v) => { const X = ax + (bx - ax) * u, Z = az + (bz - az) * u, top = gy(X, Z); return [X, Y - 1 + (top + 0.4 - Y + 1) * v, Z]; }, n, 4, { emFn: wemFn, colFn: (q) => { const k = 0.6 + 0.2 * Math.sin(q[0] * 0.07 + q[2] * 0.07); return mul3(W.col, k); } });
    };
    wall(hx0, hz1, hx0, Z0, 10); wall(hx1, hz1, hx0, hz1, 14); wall(hx1, Z0, hx1, hz1, 10);
    wall(hx0, Z0, -1200, Z0, 40); wall(1800, Z0, hx1, Z0, 40);
  }
  // the ridges behind both banks: dark mountain silhouettes, a broadcast tower blinking on the southern one
  {
    const Rg = B.get('rock', 'ridge'); Rg.set({ col: [0.045, 0.05, 0.055], rm: [0.95, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    const rid = (zz, flip, ph) => { let px = -1700, py = 240; for (let x = -1700; x <= 2100; x += 60) { const y = 300 + Math.sin(x * 0.0021 + ph) * 70 + Math.sin(x * 0.007 + 1 + ph) * 25; if (x > -1700) { if (flip) Rg.quad([px, 0, zz], [x, 0, zz], [x, y, zz], [px, py, zz]); else Rg.quad([x, 0, zz], [px, 0, zz], [px, py, zz], [x, y, zz]); } px = x; py = y; } };
    rid(ROAD.z1 + 760, false, 0);
    glows.push({ p: [620, 300 + Math.sin(620 * 0.0021) * 70 + Math.sin(620 * 0.007 + 1) * 25 + 80, ROAD.z1 + 760], color: [3, 0.2, 0.1], size: 8, blink: true, code: DUSK + DIST.ALWAYS, far: true });
  }
  // the moon, low over the south-west (down the river: the glide flies toward it), and fires burning out in the city
  glows.push({ p: [-900, 620, 900], color: [1.5, 1.7, 2.1], size: 150, code: DUSK + DIST.ALWAYS, far: true, prio: 2 });
  glows.push({ p: [-900, 620, 900], color: [3.2, 3.4, 3.8], size: 44, code: DUSK + DIST.ALWAYS, far: true, prio: 2 });
  for (let k = 0; k < 14; k++) { const sth = r() < 0.5, x = -500 + r() * 1700, z = sth ? ROAD.z1 + 80 + r() * 380 : -60 - r() * 380; glows.push({ p: [x, (sth ? southBase(x, z) : northBase(x, z)) + 10 + r() * 50, z], color: [2.6, 0.95, 0.28], size: 9 + r() * 12, flick: true, code: DUSK + DIST.ALWAYS, far: true, prio: 1 }); }
  void HILLE; void PODIUM; void hipRoof; void signQuad; void SIGN; void mix3; void em; void SHADOW_KEYS;
  const { tris } = B.finish(root, { shadowKeys: [] });
  root.userData.tris = tris;
  return { root, anchors: { glows }, tris };
}
