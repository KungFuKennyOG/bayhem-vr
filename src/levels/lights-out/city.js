import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, hexc, mix3, mul3, em, GOLD, DIST, DUSK, hipRoof, signQuad } from './kit.js';
import { SIGN, SIGN_LIST } from './signs.js';
import { materials, SHADOW_KEYS } from './mats.js';
import { FARBANK, RIVER, RAVINE, ROOF, RING, LSTREET, PLAZA, SKYST, TOWER, F2, RAMP_N, CLIMB, CHAOTIAN } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the city around the play space: residential slabs, office towers and old tiled
//  blocks stacked up the hills behind both banks and along the far bank, every window procedural
//  (lit at random as the night falls, dark when the district's power goes), gold LED crowns and
//  corner strips on the landmarks, red aviation lights, concrete plinths and retaining walls
//  stepping the terraces. All in a few merged meshes per region.
// =====================================================================================
const WALLS = [hexc(0xc9bba3), hexc(0xd8c7b6), hexc(0xb8b0a4), hexc(0xe0dad0), hexc(0xc7a99a), hexc(0xa89e94), hexc(0xd2c19d), hexc(0x9fa6ab)];
const GLASSY = [hexc(0x5b6670), hexc(0x4a5560), hexc(0x6f6a5e), hexc(0x3d4650)];

// terrace heights of the hills behind the play space
export function hillW(x, z) { if (z > 50) return 50; if (z > -40) return 64; if (z > -140) return 80; if (z > -260) return 98; return 118; }
export function hillE(x, z) { if (z > 40) return x > SKYST.x0 - 4 ? 56 : 40; if (z > -60) return 64; if (z > -180) return 82; return 104; }
export function farBase(x, z) { return Math.min(150, 58 + (z - (FARBANK.z + 40)) * 0.13); }
const sideBase = (z) => 34 + Math.max(0, (60 - z)) * 0.22;

// keep-out boxes (play space, landmarks, the river): [x0, z0, x1, z1]
const KEEP = [
  [ROOF.x0 - 6, -80, ROOF.x1 + 2, 100], [RING.x0 - 8, -200, RING.x1 + 8, 50],
  [-130, 52, 112, 130], [RAVINE.x0 - 4, -900, RAVINE.x1 + 4, 200], [PLAZA.x0 - 2, 38, 420, 200], [F2.x0, F2.z0 - 6, 700, F2.z1 + 6],
  [RAMP_N.x0 - 6, -140, RAMP_N.x1 + 6, 50], [CLIMB.x0 - 4, 84, CLIMB.x1 + 4, 114], [SKYST.x0 - 6, 30, SKYST.x1 + 10, 200], [TOWER.x0 - 10, 110, TOWER.x1 + 10, 200],
  [8, 24, 56, 64],                                         // the monorail tower (built by street.js)
  [-1500, RIVER.z0 - 30, 2000, FARBANK.z + 34],
  [CHAOTIAN.x - 30, FARBANK.z - 10, CHAOTIAN.x + 30, FARBANK.z + 120],
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
    P.box(x0 - 2, y0 - 6, z0 - 2, x1 + 2, y0 + podH, z1 + 2, { faces: 'xXzZ', s: 1, wy0: y0 - 6 });
    const R = B.get('concrete', region); R.set({ col: [0.5, 0.5, 0.5], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    R.box(x0 - 2, y0 + podH, z0 - 2, x1 + 2, y0 + podH + 0.6, z1 + 2, { faces: 'Y', s: 1 });
  }
  const sets = h > 130 && r() < 0.18 ? [0.7, 0.9] : h > 90 && r() < 0.12 ? [0.82] : [];   // few setbacks: Chinese towers go straight up
  let bx0 = x0, bz0 = z0, bx1 = x1, bz1 = z1, ya = y0 + podH;
  const levels = [...sets, 1];
  for (let i = 0; i < levels.length; i++) {
    const yb = y0 + h * levels[i];
    // uplight: a warm wash fading up the face's lower band (gold on the landmarks)
    const flood = t.flood ? em(t.flood, 1, code) : [0, 0, 0, code];
    A.set({ col, rm: [style === 1 || style === 4 ? 0.35 : 0.85, style === 1 ? 0.2 : 0, 0], cell: [bay, floor, t.seed * 0.137 % 1 * 50 + i, style] });
    const fy = Math.min(yb, ya + 22);
    if (t.flood && i === 0) {
      A.set({ em: flood }); A.box(bx0, ya, bz0, bx1, fy, bz1, { faces: 'xXzZ', s: 1, wy0: y0, top: col });
      A.set({ em: [0, 0, 0, code] }); if (yb > fy) A.box(bx0, fy, bz0, bx1, yb, bz1, { faces: 'xXzZ', s: 1, wy0: y0 });
    } else { A.set({ em: [0, 0, 0, code] }); A.box(bx0, ya, bz0, bx1, yb, bz1, { faces: 'xXzZ', s: 1, wy0: y0 }); }
    // the roof slab of this stage
    const R = B.get('concrete', region); R.set({ col: [0.42, 0.42, 0.43], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    R.box(bx0 - 0.3, yb, bz0 - 0.3, bx1 + 0.3, yb + 0.9, bz1 + 0.3, { faces: 'xXzZY', s: 1 });
    ya = yb + 0.9;
    if (i < levels.length - 1) { const ix = (bx1 - bx0) * 0.12, iz = (bz1 - bz0) * 0.12; bx0 += ix; bx1 -= ix; bz0 += iz; bz1 -= iz; }
  }
  const top = ya, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  // roof clutter: plant rooms, water tanks
  const Rf = B.get('concrete', region); Rf.set({ col: [0.38, 0.38, 0.4], rm: [0.9, 0, 0] });
  const nb = 1 + Math.floor(r() * 3);
  for (let k = 0; k < nb; k++) { const w = 2 + r() * 5, d = 2 + r() * 4, px = bx0 + 1 + r() * Math.max(0.1, bx1 - bx0 - 2 - w), pz = bz0 + 1 + r() * Math.max(0.1, bz1 - bz0 - 2 - d); Rf.box(px, top, pz, px + w, top + 2 + r() * 3, pz + d, { faces: 'xXzZY', s: 1 }); }
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
  if (t.corners) {
    // LED corner strips up the whole height (Chongqing's outlined skyline)
    const L = B.get('plain', region); const c = t.ledCol || GOLD; const w = Math.max(0.35, h / 260);
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(c, 1.1, code) });
    for (const [px, pz] of [[x0 - w, z0 - w], [x1, z0 - w], [x0 - w, z1], [x1, z1]]) L.box(px, y0 + podH, pz, px + w, top, pz + w, { faces: 'xXzZ' });
  }
  if (t.bands) {
    // horizontal LED bands every few floors (the Chongqing waterfront look); a thin line, not a laser
    const L = B.get('plain', region); const c = t.bandCol || [0.6, 0.85, 1.0];
    L.set({ col: [0.15, 0.15, 0.16], rm: [0.5, 0.5, 0], em: em(c, 1.0, code + 32), cell: [0, 0, 0, 0] });   // animated (kit.js: codes >= 32)
    const step = floor * (t.bands | 0 || 4);
    for (let y = y0 + podH + step; y < top - 2; y += step) { L.box(x0 - 0.12, y, z0 - 0.12, x1 + 0.12, y + 0.22, z0); L.box(x0 - 0.12, y, z1, x1 + 0.12, y + 0.22, z1 + 0.12); L.box(x0 - 0.12, y, z0, x0, y + 0.22, z1); L.box(x1, y, z0, x1 + 0.12, y + 0.22, z1); }
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
  const r = makeRng(9091);
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
      bands: (style === 1 && r() < 0.45) || (h > 90 && r() < 0.25) ? 3 + Math.floor(r() * 3) : 0, bandCol: r() < 0.5 ? [0.55, 0.85, 1.0] : r() < 0.6 ? GOLD : [1.0, 0.95, 0.85],
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
  for (let k = 0; k < 7; k++) estate('far', -900 + r() * 2200, FARBANK.z + 120 + r() * 400, farBase, 4 + Math.floor(r() * 3), DIST.FAR_C, [0, 0, -1]);
  for (let k = 0; k < 3; k++) estate('ne', 260 + r() * 400, -420 + r() * 300, hillE, 4, DIST.EAST, [0, 0, 1]);
  for (let k = 0; k < 3; k++) estate('nw', -520 + r() * 400, -440 + r() * 280, hillW, 4, DIST.WEST, [0, 0, 1]);
  // north hill, west bank
  place('nw', 90, () => { const x = -560 + r() * 660, z = -480 + r() * 530; const base = hillW(x, z); const h = 40 + Math.pow(r(), 1.6) * 150 + (z < -150 ? 30 : 0); return slab(x, z, base, h, { dist: x < -60 ? DIST.WEST : DIST.LST }); });
  // east hill
  place('ne', 70, () => { const x = 172 + r() * 560, z = -480 + r() * 520; const base = hillE(x, z); const h = 40 + Math.pow(r(), 1.5) * 160; return slab(x, z, base, h, { dist: DIST.EAST }); });
  // far bank (the south shore: a dense lit skyline over its own cliff)
  place('far', 230, () => {
    const x = -1300 + r() * 2900, z = FARBANK.z + 40 + Math.pow(r(), 0.8) * 640; const base = farBase(x, z);
    const near = z < FARBANK.z + 160; const h = 30 + Math.pow(r(), 1.4) * (near ? 150 : 230) + (Math.abs(x - 300) < 400 ? 40 : 0);
    return slab(x, z, base, h, { dist: x < -100 ? DIST.FAR_W : x < 700 ? DIST.FAR_C : DIST.FAR_E, plinth: 30, w: 14 + r() * 18, d: 11 + r() * 12, signN: [0, 0, -1] });
  });
  // the north bank up- and downstream (seen from the glide)
  place('dn', 70, () => { const x = 420 + r() * 1300, z = -500 + r() * 620; const base = sideBase(z); const h = 30 + Math.pow(r(), 1.5) * 170; return slab(x, z, base, h, { dist: DIST.EAST, plinth: 40 }); });
  place('up', 80, () => { const x = -1400 + r() * 1180, z = -500 + r() * 620; const base = sideBase(z); const h = 30 + Math.pow(r(), 1.5) * 170; return slab(x, z, base, h, { dist: DIST.WEST, plinth: 40 }); });
  // two landmark supertalls on the far bank: the Twin Sky towers with a lit sky-bridge across their tops
  {
    const tw = [[340, 700], [400, 700]];
    for (const [x, z] of tw) towerBlock(B, { x0: x - 14, z0: z - 14, x1: x + 14, z1: z + 14, y0: farBase(x, z), h: 250, style: 1, seed: seed++, crown: 'led', corners: true, flood: GOLD, ledCol: [0.8, 0.9, 1.0], dist: DIST.FAR_C, plinth: 40, podium: true }, 'far', glows);
    const A = B.get('win', 'far'), y = farBase(370, 700) + 236;
    A.set({ col: GLASSY[0], rm: [0.3, 0.2, 0], em: [0, 0, 0, DIST.FAR_C], cell: [1.6, 3.6, 7, 1] });
    A.box(326, y, 690, 414, y + 11, 710, { faces: 'xXzZy', s: 1, wy0: y });
    const L = B.get('plain', 'far'); L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em([0.8, 0.9, 1.0], 2.2, DIST.FAR_C), cell: [0, 0, 0, 0] });
    L.box(326, y - 0.5, 689.5, 414, y, 690.2); L.box(326, y + 11, 689.5, 414, y + 11.5, 690.2);
  }
  // the far bank climbs a mountain: terraced shelves held up by tall stained retaining walls, a lamp line along
  // every terrace road (the towers stand on these shelves at different heights), a dark ridge behind
  {
    const Cw = B.get('concrete', 'far'), Gt = B.get('plain', 'far'), Lr = B.get('plain', 'far');
    const lampsOn = [];
    for (let z = FARBANK.z + 70; z < FARBANK.z + 760; z += 48 + r() * 14) {
      for (let x = -1400; x < 1700; x += 40) {
        const wob = Math.sin(x * 0.011 + z * 0.03) * 6, yTop = farBase(x + 20, z) + wob, yBot = farBase(x + 20, z - 50) + wob - 2;
        if (yTop - yBot < 3) continue;
        const d = x < -100 ? DIST.FAR_W : x < 700 ? DIST.FAR_C : DIST.FAR_E;
        Cw.set({ col: [0.5, 0.49, 0.46], rm: [0.92, 0, 0], em: em([1.0, 0.65, 0.35], 0.035, DUSK + d), cell: [0, 0, 0, 0] });
        Cw.box(x, yBot - 4, z - 2, x + 40, yTop, z, { faces: 'z', s: 1, foot: 0.35 });
        Gt.set({ col: [0.11, 0.13, 0.09], rm: [0.95, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
        Gt.box(x, yTop - 0.3, z - 2, x + 40, yTop, z + 46, { faces: 'Y' });
        if (r() < 0.7) { Lr.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em([1.0, 0.62, 0.28], 1.0, DUSK + d), cell: [0, 0, 0, 0] }); Lr.box(x + 1, yTop + 0.1, z - 2.2, x + 39, yTop + 0.35, z - 1.9); }
        if (r() < 0.35) glows.push({ p: [x + 20, yTop + 5, z - 3], color: [1.6, 0.95, 0.4], size: 4.5, code: DUSK + d, far: true });
      }
    }
    // the ridge behind (Nanshan): a dark mountain silhouette with a broadcast tower blinking on top
    const Rg = B.get('rock', 'far'); Rg.set({ col: [0.16, 0.17, 0.16], rm: [0.95, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    let px = -1500, py = 260;
    for (let x = -1500; x <= 1900; x += 60) { const y = 300 + Math.sin(x * 0.0021) * 70 + Math.sin(x * 0.007 + 1) * 25; if (x > -1500) Rg.quad([x, 0, FARBANK.z + 700], [px, 0, FARBANK.z + 700], [px, py, FARBANK.z + 700], [x, y, FARBANK.z + 700]); px = x; py = y; }
    glows.push({ p: [620, 300 + Math.sin(620 * 0.0021) * 70 + Math.sin(620 * 0.007 + 1) * 25 + 80, FARBANK.z + 700], color: [3, 0.2, 0.1], size: 8, blink: true, code: DUSK + DIST.ALWAYS, far: true });
  }
  // the far bank's cliff and its waterfront: a rock wall with a lit quay road and stilt buildings at its foot
  {
    const R = B.get('rock', 'far'), Q = B.get('tile', 'far');
    R.set({ col: [0.55, 0.5, 0.45], rm: [0.95, 0, 0], em: [0, 0, 0, 0] });
    for (let x = -1400; x < 1700; x += 40) {
      const top = 52 + Math.sin(x * 0.013) * 8 + r() * 6;
      // the rock face floodlit from the quay (warm at the foot, fading up) — at night it's a lit wall, not a black band
      const zr = FARBANK.z + 8 + r() * 6, dR = x < -100 ? DIST.FAR_W : x < 700 ? DIST.FAR_C : DIST.FAR_E;
      R.set({ em: em([1.0, 0.62, 0.32], 0.16, DUSK + dR) }); R.box(x, -2, zr, x + 40, 16, FARBANK.z + 48, { faces: 'z', s: 1 });
      R.set({ em: em([1.0, 0.62, 0.32], 0.05, DUSK + dR) }); R.box(x, 16, zr, x + 40, top, FARBANK.z + 48, { faces: 'z', s: 1 });
      // a gold LED line along the cliff-top railing
      { const Lc = B.get('plain', 'far'); Lc.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(GOLD, 1.6, DUSK + dR), cell: [0, 0, 0, 0] }); Lc.box(x, top - 0.4, zr - 0.3, x + 40, top, zr); }
      // waterfront blocks (shops / restaurants / old stilt houses), lit
      if (Math.abs(x - CHAOTIAN.x) > 30) {
        const bh = 9 + r() * 14, d = x < -100 ? DIST.FAR_W : x < 700 ? DIST.FAR_C : DIST.FAR_E;
        Q.set({ col: WALLS[Math.floor(r() * WALLS.length)], rm: [0.85, 0, 0], em: [0, 0, 0, d], cell: [3.2, 3.0, r() * 40, r() < 0.5 ? 3 : 2] });
        Q.box(x + 2, 2, FARBANK.z + 2, x + 36, 2 + bh, FARBANK.z + 10, { faces: 'xXz', s: 1, wy0: 2 });
        const Rf = B.get('roof', 'far'); Rf.set({ col: [0.5, 0.5, 0.52], rm: [0.9, 0, 0] }); Rf.box(x + 1.5, 2 + bh, FARBANK.z + 1.5, x + 36.5, 3 + bh, FARBANK.z + 10.5, { faces: 'Yz', s: 1 });
        // the quay road's lamps (a gold necklace along the water)
        glows.push({ p: [x + 20, 4.5, FARBANK.z - 1], color: [2.2, 1.3, 0.5], size: 3.2, code: DUSK + d, far: true });
        { const Lq = B.get('plain', 'far'); Lq.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.5, 0], em: em(GOLD, 1.3, DUSK + d), cell: [0, 0, 0, 0] }); Lq.box(x + 2, 2 + bh - 0.05, FARBANK.z + 1.4, x + 36, 2 + bh + 0.25, FARBANK.z + 1.6); }
      }
    }
  }
  const { meshes, tris } = B.finish(root, { shadowKeys: [] });
  root.userData.tris = tris;
  return { root, anchors: { glows }, tris };
}
