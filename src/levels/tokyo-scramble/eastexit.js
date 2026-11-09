import { vendAtlas } from './vending.js';
import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex, signMat, zelkova } from './kit.js';
import { facadeMaterial, cellRect, FCELL } from './facade.js';
import { signAtlas, JP } from './signs.js';
import { signAtlas2 } from './signs2.js';
import { signQuad } from './city.js';
import { plazaTex, asphaltTex } from './street.js';
import { PLAZA_E, EDECK, STAIR_W, STAIR_E, R2, R2LAND, DECK_B, ETOWER, GORE, CURB } from './layout.js';

// =====================================================================================
//  THE EAST EXIT — Shibuya's east-exit pedestrian deck under the expressway, Shinjuku's bus pool.
//  Street level: a granite bus plaza (abandoned buses, shelters, zelkovas, a shabby old kiosk under
//  the sleek decks — Ghostwire's old-next-to-new). Over it, at y 6: a ring of pedestrian decks on
//  round steel columns — west / east / north arms and a bridge across the middle — with frosted
//  glass balustrades, open stairs down to the avenue, the big station sign on the north arm. The
//  station's east building closes the north side: glass entrance under the deck, a long open stair
//  up its face to the roof terrace (y 12, a sky garden), the station tower on the terrace's west end,
//  and the link bridge from the terrace onto the expressway.
//
//  The decks are walkable collider tops layered over the walkable plaza (see layout.js); their
//  balustrades are tagged layer:'deck' so the street nav ignores them.
// =====================================================================================
function deckTex() {
  // pale porcelain pavers (45 cm), a darker border course every 3 m, scuffs, gum
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), rng = makeRng(61);
  g.fillStyle = '#8f8c86'; g.fillRect(0, 0, S, S);
  const n = 8, t = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const edge = y === 0;
    const v = (edge ? 0.7 : 0.95) + rng() * 0.12;
    g.fillStyle = `rgb(${Math.round(176 * v)},${Math.round(172 * v)},${Math.round(164 * v)})`;
    g.fillRect(x * t + 1.5, y * t + 1.5, t - 3, t - 3);
  }
  for (let i = 0; i < 14000; i++) { const v = rng(); g.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${0.1 * rng()})`; g.fillRect(rng() * S, rng() * S, 1.6, 1.6); }
  for (let i = 0; i < 26; i++) { const x = rng() * S, y = rng() * S, r = 2 + rng() * 5; g.fillStyle = 'rgba(30,28,24,0.3)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(40,36,30,${0.06 + rng() * 0.06})`; g.lineWidth = 10 + rng() * 20; g.beginPath(); g.moveTo(rng() * S, 0); g.lineTo(rng() * S, S); g.stroke(); }
  return canvasTex(c, { aniso: 8 });
}
// the station sign that hangs off the north arm's fascia (white on navy, the line badges)
function stationSignTex() {
  const W = 2048, H = 160, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#1d2a44'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e8e6e0'; g.fillRect(0, 0, W, 6); g.fillRect(0, H - 6, W, 6);
  const badge = (x, col, t) => { g.fillStyle = col; g.fillRect(x, 34, 92, 92); g.fillStyle = '#fff'; g.font = '700 60px Anton, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x + 46, 84); };
  g.textBaseline = 'middle';
  for (const off of [0, 1024]) {
    badge(off + 40, '#2e9a46', 'JK'); badge(off + 146, '#f2a51a', 'G'); badge(off + 252, '#b3242c', 'H');
    g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.font = `900 72px ${JP}`; g.fillText('黒金駅 東口', off + 380, 64);
    g.font = '400 40px Anton, sans-serif'; g.fillStyle = '#c8d0dc'; g.fillText('KUROGANE STA.  EAST EXIT', off + 382, 124);
    g.fillStyle = '#f2c21a'; g.font = '700 70px Anton, sans-serif'; g.fillText('→', off + 930, 84);
  }
  return canvasTex(c, { repeat: false, aniso: 8 });
}
// the blue pedestrian direction sign on the decks
function dirSignTex() {
  const W = 512, H = 192, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#18407e'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e8eef6'; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12);
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.font = `900 40px ${JP}`; g.fillText('← 黒金駅', 24, 52); g.fillText('首都高 入口 ↑', 24, 136);
  g.font = '400 24px Anton, sans-serif'; g.fillStyle = '#c8d6ec'; g.fillText('KUROGANE STA.', 290, 52); g.fillText('EXPRESSWAY', 300, 136);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(16, 94, W - 32, 3);
  return canvasTex(c, { repeat: false, aniso: 4 });
}
// the deck's own name, on the centre bridge's fascias
function deckNameTex() {
  const W = 2048, H = 128, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#e9e7e1'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2e9a46'; g.fillRect(0, H - 14, W, 14);
  g.textBaseline = 'middle'; g.fillStyle = '#20242a';
  g.font = `900 64px ${JP}`; g.textAlign = 'left'; g.fillText('黒金イーストデッキ', 60, 58);
  g.font = '400 46px Anton, sans-serif'; g.fillText('KUROGANE EAST DECK', 700, 60);
  g.font = `700 44px ${JP}`; g.textAlign = 'right'; g.fillText('← 銀鶏坂   ハチ口 →', W - 60, 58);
  return canvasTex(c, { repeat: false, aniso: 8 });
}

export function buildEastExit(ctx = {}) {
  const rng = makeRng(606);
  const R = (a, b) => a + (b - a) * rng();
  const root = new THREE.Group(); root.name = 'eastexit';
  const colliders = [], glows = [], lights = [], walks = [], shade = [];
  const fac = new Acc({ cell: true, info: true }), prop = new Acc({ rm: true }), glass = new Acc({ rm: true }), sign = new Acc(), sign2 = new Acc();
  const top = new Acc(), pave = new Acc(), tact = new Acc();
  const { E: SE } = signAtlas(); const { E: E2 } = signAtlas2();
  const { E: VE } = vendAtlas(), vacc = new Acc();   // vending fronts: their own hi-res atlas
  const Y = EDECK.y, T = EDECK.t, B = DECK_B.y;
  const col = (min, max, data = {}) => colliders.push({ min, max, data: { mat: 'concrete', ...data } });
  const wall = (O, Tn, L, y0, y1, cell, info, bay = 3, floorH = 3, c = [1, 1, 1]) => { fac.set({ cell: cellRect(cell), info, col: c }); const a = [O[0], y0, O[2]], b = [O[0] + Tn[0] * L, y0, O[2] + Tn[2] * L]; fac.quad(a, b, [b[0], y1, b[2]], [a[0], y1, a[2]], [0, 0, Math.max(1, Math.round(L / bay)), (y1 - y0) / floorH]); };
  const rect = (A, x0, z0, x1, z1, y, s) => A.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / s, -z1 / s, x1 / s, -z0 / s]);

  // ================================================================ street level: the bus plaza
  rect(pave, PLAZA_E.x0, PLAZA_E.z0, PLAZA_E.x1, PLAZA_E.z1, CURB, 4.8);
  // tactile guide strips (yellow): from the stair feet and the station doors out to the avenue
  const strip = (x0, z0, x1, z1) => rect(tact, x0, z0, x1, z1, CURB + 0.012, 0.3);
  strip(STAIR_W.x1, -27.2, STAIR_W.x1 + 8, -26.8); strip(STAIR_E.x0 - 8, -27.2, STAIR_E.x0, -26.8);
  strip(78.8, -79, 79.2, -18); strip(60, -40.2, 100, -39.8);
  // ================================================================ the deck ring
  const slab = (x0, z0, x1, z1, faces = 'xXzZy') => {
    rect(top, x0, z0, x1, z1, Y, 3);
    prop.set({ col: hex(0xb4b2ac), rm: [0.85, 0, 0] }); prop.box(x0, Y - T, z0, x1, Y - 0.01, z1, { faces });
    // the fascia's steel nosing (catches the light) and a drip line
    prop.set({ col: hex(0xc8ccd0), rm: [0.35, 0.7, 0] });
    if (faces.includes('z')) prop.box(x0, Y - 0.22, z0 - 0.04, x1, Y + 0.02, z0, { faces: 'zY' });
    if (faces.includes('Z')) prop.box(x0, Y - 0.22, z1, x1, Y + 0.02, z1 + 0.04, { faces: 'ZY' });
    if (faces.includes('x')) prop.box(x0 - 0.04, Y - 0.22, z0, x0, Y + 0.02, z1, { faces: 'xY' });
    if (faces.includes('X')) prop.box(x1, Y - 0.22, z0, x1 + 0.04, Y + 0.02, z1, { faces: 'XY' });
    // recessed downlights in the soffit
    prop.set({ col: [1, 0.97, 0.9], rm: [0.4, 0, 2.2] });
    const lx = Math.max(1, Math.round((x1 - x0) / 6)), lz = Math.max(1, Math.round((z1 - z0) / 6));
    for (let i = 0; i < lx; i++) for (let k = 0; k < lz; k++) { const cx = x0 + (i + 0.5) * (x1 - x0) / lx, cz = z0 + (k + 0.5) * (z1 - z0) / lz; prop.box(cx - 0.35, Y - T - 0.02, cz - 0.35, cx + 0.35, Y - T - 0.01, cz + 0.35, { faces: 'y' }); }
    col([x0, Y - T, z0], [x1, Y, z1], { kind: 'deckslab', noBlock: true });
    shade.push([x0, z0, x1, z1, 0.62]);
  };
  const A = EDECK.arms;
  slab(...A.w, 'xzZy'); slab(...A.e, 'XzZy'); slab(...A.n, 'zZy'); slab(...A.c, 'zZy');
  // ---- balustrades: frosted glass between steel posts, a steel handrail, a kick plate
  const bal = (x0, z0, x1, z1, y = Y, h = 1.1) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), L = alongX ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.round(L / 1.6));
    prop.set({ col: hex(0x5e6266), rm: [0.4, 0.7, 0] });
    for (let i = 0; i <= n; i++) { const t = i / n, px = alongX ? x0 + L * t : (x0 + x1) / 2, pz = alongX ? (z0 + z1) / 2 : z0 + L * t; prop.box(px - 0.04, y, pz - 0.04, px + 0.04, y + h, pz + 0.04, { faces: 'xXzZ' }); }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (alongX) { prop.box(x0, y + h - 0.06, cz - 0.05, x1, y + h + 0.02, cz + 0.05); prop.box(x0, y, cz - 0.05, x1, y + 0.12, cz + 0.05, { faces: 'zZY' }); }
    else { prop.box(cx - 0.05, y + h - 0.06, z0, cx + 0.05, y + h + 0.02, z1); prop.box(cx - 0.05, y, z0, cx + 0.05, y + 0.12, z1, { faces: 'xXY' }); }
    glass.set({ col: hex(0x7d8a88), rm: [0.15, 0.25, 0.0] });
    if (alongX) glass.box(x0, y + 0.14, cz - 0.012, x1, y + h - 0.1, cz + 0.012, { faces: 'zZ' });
    else glass.box(cx - 0.012, y + 0.14, z0, cx + 0.012, y + h - 0.1, z1, { faces: 'xX' });
    col(alongX ? [x0, y - 0.3, cz - 0.12] : [cx - 0.12, y - 0.3, z0], alongX ? [x1, y + h, cz + 0.12] : [cx + 0.12, y + h, z1], { kind: 'rail', mat: 'metal', layer: 'deck' });
  };
  const e = 0.08;
  // west arm: outer edge, inner edge between the junctions, its south end
  bal(A.w[0] + e, -80, A.w[0] + e, -24); bal(A.w[2] - e, -74, A.w[2] - e, -56); bal(A.w[2] - e, -50, A.w[2] - e, STAIR_W.z0); bal(A.w[0], -24 - e, A.w[2], -24 - e);
  // east arm
  bal(A.e[2] - e, -80, A.e[2] - e, -24); bal(A.e[0] + e, -74, A.e[0] + e, -56); bal(A.e[0] + e, -50, A.e[0] + e, STAIR_E.z0); bal(A.e[0], -24 - e, A.e[2], -24 - e);
  // north arm's plaza side, the centre bridge both sides
  bal(A.w[2], -74 + e, A.e[0], -74 + e); bal(A.w[2], -56 + e, A.e[0], -56 + e); bal(A.w[2], -50 - e, A.e[0], -50 - e);
  // ---- columns: round steel, painted silver-grey, a base plate
  const column = (x, z) => {
    prop.set({ col: hex(0xb8bcc0), rm: [0.4, 0.6, 0] }); prop.cyl(x, CURB, z, 0.42, 0.42, Y - T, 14, { cap: false });
    prop.set({ col: hex(0x7a7e82), rm: [0.5, 0.6, 0] }); prop.cyl(x, CURB, z, 0.62, 0.62, CURB + 0.12, 14);
    prop.set({ col: hex(0xa0a4a8), rm: [0.4, 0.6, 0] }); prop.cyl(x, Y - T - 0.5, z, 0.42, 0.7, Y - T, 14, { cap: false });
    col([x - 0.45, 0, z - 0.45], [x + 0.45, Y - T, z + 0.45], { kind: 'pillar', mat: 'metal' });
  };
  for (const z of [-71, -60, -45, -35]) { column(49, z); column(107, z); }
  for (const x of [60, 72, 86, 98]) column(x, -77);
  for (const x of [66, 79, 92]) column(x, -53);
  // ================================================================ the open stairs down to the avenue
  const stair = (S, outer) => {
    walks.push({ type: 'ramp', x0: S.x0, x1: S.x1, y0: S.y0, y1: S.y1, z0: S.z0, z1: S.z1 });
    const yAt = (x) => S.y0 + (S.y1 - S.y0) * (x - S.x0) / (S.x1 - S.x0);
    const n = Math.ceil(Math.abs(S.y1 - S.y0) / 0.165), run = (S.x1 - S.x0) / n;
    for (let i = 0; i < n; i++) {
      const xa = S.x0 + i * run, xb = xa + run, yt = yAt((xa + xb) / 2) + 0.075;
      prop.set({ col: hex(i % 2 ? 0x77746e : 0x7e7b75), rm: [0.8, 0, 0] }); prop.box(xa, yt - 0.17, S.z0 + 0.1, xb, yt, S.z1 - 0.1, { faces: 'Y' });
      prop.set({ col: hex(0x5e5b56), rm: [0.85, 0, 0] }); prop.box(xa, yt - 0.17, S.z0 + 0.1, xb, yt, S.z1 - 0.1, { faces: S.y1 < S.y0 ? 'X' : 'x' });
      prop.set({ col: hex(0xd8b21a), rm: [0.7, 0, 0.05] }); const nx = S.y1 < S.y0 ? xb - 0.05 : xa; prop.box(nx, yt, S.z0 + 0.3, nx + 0.05, yt + 0.004, S.z1 - 0.3, { faces: 'Y' });
    }
    // the soffit and the side stringers (concrete, a steel cap)
    const lo = Math.min(S.y0, S.y1), hi = Math.max(S.y0, S.y1), xl = S.y0 < S.y1 ? S.x0 : S.x1, xh = S.y0 < S.y1 ? S.x1 : S.x0;
    prop.set({ col: hex(0x9e9c96), rm: [0.85, 0, 0] });
    prop.quad([xh, hi - 0.45, S.z0], [xl, lo - 0.3, S.z0], [xl, lo - 0.3, S.z1], [xh, hi - 0.45, S.z1]);
    for (const z of [S.z0, S.z1]) {
      const s = z === S.z0 ? -1 : 1;
      prop.set({ col: hex(0xb4b2ac), rm: [0.85, 0, 0] });
      const P = (x, y) => [x, y, z + s * 0.06];
      if (s > 0) prop.quad(P(xl, lo - 0.3), P(xh, hi - 0.45), P(xh, hi + 0.25), P(xl, lo + 0.25)); else prop.quad(P(xh, hi - 0.45), P(xl, lo - 0.3), P(xl, lo + 0.25), P(xh, hi + 0.25));
      // sloped glass balustrade above the stringer
      glass.set({ col: hex(0x7d8a88), rm: [0.15, 0.25, 0.0] });
      const G = (x, y) => [x, y, z];
      glass.quad(G(xl, lo + 0.3), G(xh, hi + 0.3), G(xh, hi + 1.0), G(xl, lo + 1.0)); glass.quad(G(xh, hi + 0.3), G(xl, lo + 0.3), G(xl, lo + 1.0), G(xh, hi + 1.0));
      prop.set({ col: hex(0x5e6266), rm: [0.4, 0.7, 0] }); prop.tube([xl, lo + 1.1, z], [xh, hi + 1.1, z], 0.04, 6);
      for (let x = xl; x <= xh + 0.01; x += 1.8) prop.box(x - 0.04, yAt(x), z - 0.04, x + 0.04, yAt(x) + 1.1, z + 0.04, { faces: 'xXzZ' });
      // cheeks: block the stair's sides at every height (the street nav sees them too)
      for (let x = S.x0; x < S.x1 - 0.01; x += 2) { const ya = yAt(x), yb = yAt(x + 2); col([x, 0, z - (s < 0 ? 0.25 : 0)], [x + 2, Math.max(ya, yb) + 1.1, z + (s > 0 ? 0.25 : 0)], { kind: 'rail', mat: 'metal' }); }
    }
    // nobody walks under the high end
    const xs = S.y0 > S.y1 ? [S.x0, S.x0 + (S.y0 - 2.4) / (S.y0 - S.y1) * (S.x1 - S.x0)] : [S.x1 - (S.y1 - 2.4) / (S.y1 - S.y0) * (S.x1 - S.x0), S.x1];
    col([xs[0], 0, S.z0], [xs[1], 2.0, S.z1], { kind: 'wall', noStand: true });
    shade.push([S.x0, S.z0, S.x1, S.z1, 0.35]);
  };
  stair(STAIR_W); stair(STAIR_E);
  // ================================================================ the station's east building + its face stair
  {
    const x0 = 44, x1 = 112, zS = PLAZA_E.z0, zN = DECK_B.z0;
    // ground floor under the north arm: the glass station entrance (lit gates inside), a granite base
    wall([x0, 0, zS], [1, 0, 0], 8, 0, Y - T, FCELL.base, [91, 0, 0, 3], 3, Y - T);
    wall([x0 + 8, 0, zS], [1, 0, 0], x1 - x0 - 8, 0, Y - T, FCELL.stationGlass, [92, 0, 0, 3], 4, Y - T);
    // the 2F wall beside the stair's high end, the stair's stringer wall (sloped top), the set-back face above the stair
    wall([x0, Y - T, zS], [1, 0, 0], R2.x0 - x0, Y - T, B + 1.1, FCELL.tileWhite, [93, 0.0, 0.3, 0], 3, 3);
    for (let x = R2.x0; x < R2.x1; x += 4) {
      const ya = R2.y0 + (R2.y1 - R2.y0) * (x - R2.x0) / (R2.x1 - R2.x0), yb = R2.y0 + (R2.y1 - R2.y0) * (x + 4 - R2.x0) / (R2.x1 - R2.x0);
      prop.set({ col: hex(0xbcb9b2), rm: [0.85, 0, 0] });
      prop.quad([x, Y - T, zS + 0.01], [x + 4, Y - T, zS + 0.01], [x + 4, yb + 0.25, zS + 0.01], [x, ya + 0.25, zS + 0.01]);
      glass.set({ col: hex(0x7d8a88), rm: [0.15, 0.25, 0.0] });
      glass.quad([x, ya + 0.3, zS + 0.03], [x + 4, yb + 0.3, zS + 0.03], [x + 4, yb + 1.0, zS + 0.03], [x, ya + 1.0, zS + 0.03]);
      glass.quad([x + 4, yb + 0.3, zS + 0.02], [x, ya + 0.3, zS + 0.02], [x, ya + 1.0, zS + 0.02], [x + 4, yb + 1.0, zS + 0.02]);
      prop.set({ col: hex(0x5e6266), rm: [0.4, 0.7, 0] }); prop.tube([x, ya + 1.1, zS], [x + 4, yb + 1.1, zS], 0.04, 6); prop.box(x - 0.04, ya, zS - 0.04, x + 0.04, ya + 1.1, zS + 0.04, { faces: 'xXzZ' });
      col([x, Y - 0.3, zS - 0.35], [x + 4, Math.max(ya, yb) + 1.1, zS + 0.05], { kind: 'rail', mat: 'metal' });
      // the set-back face from the stair up to the terrace
      fac.set({ cell: cellRect(FCELL.stationGlass), info: [94 + x, 0, 0, 3], col: [1, 1, 1] });
      fac.quad([x, ya, R2.z0], [x + 4, yb, R2.z0], [x + 4, B, R2.z0], [x, ya, R2.z0].map((v, i) => i === 1 ? B : v), [0, 0, 1, (B - Math.min(ya, yb)) / 3]);
      // the walking surface: a gentle paved ramp (7°, the station's "slope" — a stair this shallow read
      // as a ribbed ramp in the headset), the deck's pavers, yellow guide lines at both edges
      top.quad([x, ya, R2.z1], [x + 4, yb, R2.z1], [x + 4, yb, R2.z0], [x, ya, R2.z0], [x / 3, -R2.z1 / 3, (x + 4) / 3, -R2.z0 / 3]);
      for (const zz of [R2.z0 + 0.35, R2.z1 - 0.65]) tact.quad([x, ya + 0.012, zz + 0.3], [x + 4, yb + 0.012, zz + 0.3], [x + 4, yb + 0.012, zz], [x, ya + 0.012, zz], [x / 0.3, -(zz + 0.3) / 0.3, (x + 4) / 0.3, -zz / 0.3]);

    }
    // the landing at the stair's foot: the 2F gate line behind glass, the face above it
    wall([R2LAND.x0, Y, R2.z0], [1, 0, 0], R2LAND.x1 - R2LAND.x0, Y, B, FCELL.stationGlass, [95, 0, 0, 3], 4, B - Y);
    rect(top, R2LAND.x0, R2LAND.z0, R2LAND.x1, R2LAND.z1, Y, 3);
    // walls / bodies
    col([x0, 0, zS - 0.3], [x1, Y - T, zS], { kind: 'wall' });                                            // the station face (street)
    col([x0, Y - 0.3, zS - 0.35], [R2.x0, B + 1.1, zS + 0.05], { kind: 'wall' });                        // beside the stair's top landing
    col([R2.x0, Y, R2.z0 - 0.35], [x1, B + 1.1, R2.z0], { kind: 'wall' });                                // the set-back face (stair ↔ terrace)
    col([R2LAND.x1, Y - 0.3, R2.z0], [R2LAND.x1 + 0.4, B, zS], { kind: 'wall' });
    col([x0, 0, zN], [x1, B - 0.02, R2.z0], { kind: 'deckbody', noBlock: true });
    col([R2.x0, 0, R2.z0], [x1, Y - 0.02, zS], { kind: 'deckbody', noBlock: true });
    // the north face (toward the expressway) and the east / west ends
    wall([x1, 0, zN], [-1, 0, 0], x1 - x0, 0, B, FCELL.garageWall, [96, 0, 0, 3], 3, 3, [0.92, 0.92, 0.9]);
    wall([x0, 0, zN], [0, 0, 1], zS - zN, 0, B + 1.1, FCELL.side, [97, 0, 0, 1], 3, 3);
    wall([x1, 0, zS], [0, 0, -1], zS - zN, 0, B + 1.1, FCELL.side, [98, 0, 0, 1], 3, 3);
    col([x0 - 0.3, 0, zN], [x0, B + 1.1, zS]); col([x1, 0, zN], [x1 + 0.3, B + 1.1, zS]); col([x0, 0, zN - 0.3], [x1, B, zN]);
    // ---- the roof terrace: pavers, balustrades, planters + trees, benches, the billboard over the expressway
    rect(top, DECK_B.x0, DECK_B.z0, DECK_B.x1, DECK_B.z1, B, 3);
    rect(top, x0 + 2, R2.z0, R2.x0, zS, B, 3);
    bal(x0 + 2 + e, ETOWER.z1, x0 + 2 + e, zS, B); bal(x0 + 2, zS - e, R2.x0, zS - e, B);
    bal(R2.x0, R2.z0 - e, x1, R2.z0 - e, B); bal(x1 - e, zN, x1 - e, R2.z0, B);
    bal(ETOWER.x1, zN + e, GORE.x0 + 6, zN + e, B); bal(GORE.x1, zN + e, x1, zN + e, B);
    const planter = (cx, cz, w, d, tree) => {
      prop.set({ col: hex(0x8a857c), rm: [0.8, 0, 0] }); prop.box(cx - w / 2, B, cz - d / 2, cx + w / 2, B + 0.7, cz + d / 2);
      prop.set({ col: hex(0x3a4a26), rm: [0.95, 0, 0] }); prop.box(cx - w / 2 + 0.12, B + 0.7, cz - d / 2 + 0.12, cx + w / 2 - 0.12, B + 1.05, cz + d / 2 - 0.12, { faces: 'Y' });
      col([cx - w / 2, B, cz - d / 2], [cx + w / 2, B + 1.05, cz + d / 2], { kind: 'planter' });
      if (tree) for (const [tx, tz] of tree) {
        zelkova(prop, tx, B + 0.7, tz, 0.75, tx + tz);
        col([tx - 0.2, B, tz - 0.2], [tx + 0.2, B + 3.6, tz + 0.2], { kind: 'tree', mat: 'wood' });
      }
    };
    planter(86, -98, 8, 2.2, [[83, -98], [89, -98]]); planter(100, -112, 2.2, 8, [[100, -110]]); planter(80, -118, 6, 2.2, null); planter(60, -94, 8, 2.2, [[57, -94], [63, -94]]);
    for (const [bx, bz] of [[92, -106], [72, -94]]) { prop.set({ col: hex(0x6a5a46), rm: [0.8, 0, 0] }); prop.box(bx - 1.2, B + 0.42, bz - 0.25, bx + 1.2, B + 0.5, bz + 0.25); prop.set({ col: hex(0x8a8e92), rm: [0.4, 0.7, 0] }); prop.box(bx - 1.1, B, bz - 0.2, bx - 1.0, B + 0.42, bz + 0.2); prop.box(bx + 1.0, B, bz - 0.2, bx + 1.1, B + 0.42, bz + 0.2); }
    // the sky garden: a timber deck with café tables and parasols by the kiosk, a lawn strip with a clipped hedge,
    // the roof plant (a bank of AC condensers, a cooling tower) along the north edge — cover with a reason to exist
    { prop.set({ col: hex(0x7a5a3a), rm: [0.85, 0, 0] });
      prop.box(86, B, -126, 108, B + 0.025, -110, { faces: 'YxXzZ' });
      prop.set({ col: hex(0x5a4028), rm: [0.9, 0, 0] }); for (let z = -125.6; z < -110; z += 0.6) prop.box(86, B + 0.026, z, 108, B + 0.028, z + 0.03, { faces: 'Y' });
      for (const [tx, tz, pc] of [[89, -122, 0xe8e4dc], [89, -114, 0x2a6a4a], [109.5 - 2.5, -112.5, 0xc8402a], [91.5, -118, 0xe8e4dc]]) {
        prop.set({ col: hex(0xd8d6d0), rm: [0.5, 0.4, 0] }); prop.cyl(tx, B + 0.08, tz, 0.45, 0.45, B + 0.76, 12); prop.cyl(tx, B + 0.08, tz, 0.05, 0.05, B + 0.72, 6, { cap: false });
        prop.set({ col: hex(0x8a8e92), rm: [0.4, 0.7, 0] }); prop.cyl(tx, B + 0.76, tz, 0.03, 0.03, B + 2.3, 6, { cap: false });
        prop.set({ col: hex(pc), rm: [0.8, 0, 0] }); prop.cyl(tx, B + 2.05, tz, 1.4, 0.05, B + 2.45, 10, { cap: false });
        for (const a_ of [0.4, 2.2, 4.0]) { const cx_ = tx + Math.cos(a_) * 0.85, cz_ = tz + Math.sin(a_) * 0.85; prop.set({ col: hex(0x3a3c40), rm: [0.5, 0.5, 0] }); prop.box(cx_ - 0.22, B + 0.42, cz_ - 0.22, cx_ + 0.22, B + 0.47, cz_ + 0.22); prop.box(cx_ - 0.03, B + 0.08, cz_ - 0.03, cx_ + 0.03, B + 0.42, cz_ + 0.03); }
        col([tx - 0.5, B, tz - 0.5], [tx + 0.5, B + 0.76, tz + 0.5], { kind: 'table', mat: 'metal' });
      }
      // lawn + hedge in front of the tower
      prop.set({ col: hex(0x34481e), rm: [0.95, 0, 0] }); prop.box(50, B, -101, 74, B + 0.06, -92, { faces: 'Y' });
      { const r2 = makeRng(5150); for (let i = 0; i < 90; i++) { const x = 50.4 + r2() * 23.2, z = -100.6 + r2() * 8.2, h = 0.08 + r2() * 0.18, w = 0.15 + r2() * 0.35;
        prop.set({ col: hex([0x2a3c18, 0x40562a, 0x4a5e26, 0x5a6a30][i % 4]), rm: [0.95, 0, 0] }); prop.obox(x, B + 0.06 + h / 2, z, w, h / 2, w * 0.8, r2() * 3); } }
      for (const [sx, sz] of [[54, -95], [61, -97.5], [68, -94.5], [72, -98]]) { prop.set({ col: hex(0x2e4a1e), rm: [0.95, 0, 0] }); prop.cyl(sx, B + 0.06, sz, 0.7, 0.4, B + 0.9, 8); }
      prop.set({ col: hex(0x8a857c), rm: [0.8, 0, 0] }); prop.box(49.8, B, -101.2, 74.2, B + 0.18, -101, { faces: 'zZY' }); prop.box(49.8, B, -92, 74.2, B + 0.18, -91.8, { faces: 'zZY' });
      prop.set({ col: hex(0x2e4a1e), rm: [0.95, 0, 0] }); prop.box(50.2, B + 0.06, -100.9, 74, B + 0.9, -100.1);
      col([50.2, B, -100.9], [74, B + 0.9, -100.1], { kind: 'hedge', mat: 'wood' });
      // roof plant along the north parapet, east of the gore link: condensers, ducts, a cooling tower
      for (let i = 0; i < 5; i++) { const x = GORE.x1 + 1.5 + i * 1.5;
        prop.set({ col: hex(0xd8d8d2), rm: [0.5, 0.3, 0] }); prop.box(x - 0.65, B, -127.4, x + 0.65, B + 1.3, -126.2);
        prop.set({ col: hex(0x3a3c40), rm: [0.5, 0.5, 0] }); prop.cyl(x, B + 0.65, -126.19, 0.48, 0.48, B + 0.66, 12); }
      col([GORE.x1 + 0.8, B, -127.4], [GORE.x1 + 8.2, B + 1.3, -126.2], { kind: 'plant', mat: 'metal' });
      prop.set({ col: hex(0x9aa0a4), rm: [0.5, 0.5, 0] }); prop.box(GORE.x1 + 0.8, B + 1.4, -127.2, 112, B + 1.75, -126.5);
      prop.set({ col: hex(0xb8bcbc), rm: [0.6, 0.3, 0] }); prop.cyl(110.2, B, -104, 1.4, 1.4, B + 2.6, 14); prop.set({ col: hex(0x3a3c40), rm: [0.5, 0.5, 0] }); prop.cyl(110.2, B + 2.6, -104, 1.4, 0.95, B + 3.1, 14, { cap: false });
      col([108.8, B, -105.4], [111.6, B + 2.6, -102.6], { kind: 'plant', mat: 'metal' });
    }
    // a kiosk pavilion (glass + white canopy) on the terrace — cover
    prop.set({ col: hex(0xe6e4de), rm: [0.6, 0, 0] }); prop.box(94, B + 3, -124, 106, B + 3.25, -116);
    prop.set({ col: hex(0x5e6266), rm: [0.4, 0.7, 0] }); for (const [px, pz] of [[94.3, -123.7], [105.7, -123.7], [94.3, -116.3], [105.7, -116.3]]) prop.box(px - 0.08, B, pz - 0.08, px + 0.08, B + 3, pz + 0.08);
    prop.set({ col: hex(0xd8d6d0), rm: [0.5, 0.2, 0] }); prop.box(97, B, -123, 103, B + 1.1, -120);
    col([97, B, -123], [103, B + 1.1, -120], { kind: 'counter' });
    // the billboard on the terrace's north edge, facing the expressway (and its back facing the plaza)
    const ep = SE.panel.find(p => p.kind === 'race') || SE.panel[0];
    const w = 12, hh = 4, cx = 84, y0 = B + 2.4, z = zN + 0.8;
    prop.set({ col: hex(0x5a5e62), rm: [0.5, 0.6, 0] }); for (const dx of [-5, 0, 5]) prop.box(cx + dx - 0.12, B, z - 0.12, cx + dx + 0.12, y0 + hh, z + 0.12);
    prop.set({ col: hex(0x2a2c30), rm: [0.6, 0.4, 0] }); prop.box(cx - w / 2, y0 - 0.1, z - 0.12, cx + w / 2, y0 + hh + 0.1, z + 0.12);
    signQuad(sign, [cx, y0 + hh / 2, z - 0.13], [0, 0, -1], w, hh, ep.uv, 1.0);
    signQuad(sign, [cx, y0 + hh / 2, z + 0.13], [0, 0, 1], w, hh, (SE.panel.find(p => p.kind === 'air') || ep).uv, 1.0);
    colliders.push({ min: [cx - w / 2, y0 - 0.1, z - 0.15], max: [cx + w / 2, y0 + hh, z + 0.15], data: { mat: 'metal', kind: 'billboard', noBlock: true } });
    for (const dx of [-5, 0, 5]) col([cx + dx - 0.15, B, z - 0.15], [cx + dx + 0.15, y0 + hh, z + 0.15], { mat: 'metal', kind: 'pole', thin: true });
    // a vending pair against the tower's base
    for (const [i, xx] of [[0, 79.2], [1, 80.3]]) { const v = VE.vend[(i * 3 + 1) % SE.vend.length]; prop.set({ col: hex(0xd8d6d0), rm: [0.4, 0.3, 0] }); prop.box(xx - 0.5, B, ETOWER.z1 - 0.1, xx + 0.5, B + 1.9, ETOWER.z1 + 0.9); signQuad(vacc, [xx, B + 0.95, ETOWER.z1 + 0.91], [0, 0, 1], 0.98, 1.84, v.uv, 1.1); col([xx - 0.5, B, ETOWER.z1 - 0.1], [xx + 0.5, B + 1.9, ETOWER.z1 + 0.9], { mat: 'metal', kind: 'vending' }); }
    // a big poster billboard on the set-back face above the stair (seen from the plaza and the avenue)
    { const bw = 22, bh = 5, bx = 76, by = 9.6; prop.set({ col: hex(0x2a2c30), rm: [0.6, 0.4, 0] }); prop.box(bx - bw / 2 - 0.2, by - bh / 2 - 0.2, R2.z0 + 0.02, bx + bw / 2 + 0.2, by + bh / 2 + 0.2, R2.z0 + 0.2);
      signQuad(sign2, [bx - bw / 4, by, R2.z0 + 0.22], [0, 0, 1], bw / 2 - 0.1, bh, E2.band[1].uv, 1.0); signQuad(sign2, [bx + bw / 4, by, R2.z0 + 0.22], [0, 0, 1], bw / 2 - 0.1, bh, E2.band[3].uv, 1.0); }
  }
  // ---- the station tower on the terrace's west end (the Scramble Square stand-in): a stone-banded glass
  // shaft with vertical silver fins, two set-backs, and the open-air observation deck on top (a glass
  // parapet ring, the crown frame over it) — a recognisable stepped silhouette instead of a glass slab
  {
    const { x0, x1, z0, z1, h } = ETOWER, h1 = h * 0.72, h2 = h * 0.9, s1 = 2.5, s2 = 5;
    const shaft = (X0, Z0, X1, Z1, ya, yb, cell, seed) => {
      wall([X0, 0, Z1], [1, 0, 0], X1 - X0, ya, yb, cell, [seed, 0.0, 0.2, 2], 3, 4); wall([X1, 0, Z1], [0, 0, -1], Z1 - Z0, ya, yb, cell, [seed + 1, 0.0, 0.2, 2], 3, 4);
      wall([X1, 0, Z0], [-1, 0, 0], X1 - X0, ya, yb, cell, [seed + 2, 0.0, 0.2, 2], 3, 4); wall([X0, 0, Z0], [0, 0, 1], Z1 - Z0, ya, yb, cell, [seed + 3, 0.0, 0.2, 2], 3, 4);
      // stone bands every 8 floors, silver fins at the corners and the thirds
      prop.set({ col: hex(0xd4d0c6), rm: [0.6, 0.1, 0] });
      for (let y = ya + 32; y < yb - 2; y += 32) prop.box(X0 - 0.25, y, Z0 - 0.25, X1 + 0.25, y + 1.2, Z1 + 0.25, { faces: 'xXzZ' });
      prop.set({ col: hex(0xc8ccd0), rm: [0.3, 0.8, 0] });
      for (const t of [0, 1 / 3, 2 / 3, 1]) { const fx = X0 + (X1 - X0) * t; prop.box(fx - 0.18, ya, Z1, fx + 0.18, yb, Z1 + 0.6, { faces: 'xXZ' }); prop.box(fx - 0.18, ya, Z0 - 0.6, fx + 0.18, yb, Z0, { faces: 'xXz' }); }
      prop.set({ col: hex(0x9aa0a6), rm: [0.5, 0.6, 0] }); prop.box(X0, yb - 0.01, Z0, X1, yb + 0.6, Z1, { faces: 'xXzZY' });
    };
    shaft(x0, z0, x1, z1, B, h1, FCELL.ribbon, 120);
    shaft(x0 + s1, z0 + s1, x1 - s1, z1 - s1, h1, h2, FCELL.curtain, 130);
    shaft(x0 + s2, z0 + s2, x1 - s2, z1 - s2, h2, h, FCELL.curtainBlue, 140);
    // the lobby band
    wall([x0, 0, z1 + 0.02], [1, 0, 0], x1 - x0, B, B + 5, FCELL.stationGlass, [124, 0, 0, 3], 4, 5);
    prop.set({ col: hex(0xd8dadc), rm: [0.4, 0.6, 0] }); prop.box(x0 - 1, B + 5, z0 - 1, x1 + 1, B + 5.5, z1 + 1.6);
    // the observation deck: a glass parapet ring, people-height, the crown frame over it, the name
    glass.set({ col: hex(0x9fb2b8), rm: [0.1, 0.4, 0] });
    const X0 = x0 + s2, X1 = x1 - s2, Z0 = z0 + s2, Z1 = z1 - s2;
    glass.box(X0, h + 0.6, Z0, X1, h + 2.0, Z0 + 0.05, { faces: 'zZ' }); glass.box(X0, h + 0.6, Z1 - 0.05, X1, h + 2.0, Z1, { faces: 'zZ' });
    glass.box(X0, h + 0.6, Z0, X0 + 0.05, h + 2.0, Z1, { faces: 'xX' }); glass.box(X1 - 0.05, h + 0.6, Z0, X1, h + 2.0, Z1, { faces: 'xX' });
    prop.set({ col: hex(0xe8e8e4), rm: [0.4, 0.5, 0] });
    for (const [px, pz] of [[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]]) prop.box(px - 0.3, h + 0.6, pz - 0.3, px + 0.3, h + 9, pz + 0.3);
    prop.box(X0 - 0.3, h + 8.6, Z0 - 0.3, X1 + 0.3, h + 9.2, Z0 + 0.3); prop.box(X0 - 0.3, h + 8.6, Z1 - 0.3, X1 + 0.3, h + 9.2, Z1 + 0.3);
    prop.box(X0 - 0.3, h + 8.6, Z0, X0 + 0.3, h + 9.2, Z1); prop.box(X1 - 0.3, h + 8.6, Z0, X1 + 0.3, h + 9.2, Z1);
    prop.set({ col: hex(0x6a6e74), rm: [0.5, 0.7, 0] }); prop.tube([(X0 + X1) / 2, h + 9.2, (Z0 + Z1) / 2], [(X0 + X1) / 2, h + 22, (Z0 + Z1) / 2], 0.2, 6);
    glows.push({ p: [(X0 + X1) / 2, h + 22.3, (Z0 + Z1) / 2], color: [3.2, 0.3, 0.15], size: 2.2, blink: true, rate: 1.6, far: true });
    for (const [px, pz] of [[X0, Z0], [X1, Z1], [X1, Z0], [X0, Z1]]) glows.push({ p: [px, h + 9.6, pz], color: [3.2, 0.3, 0.15], size: 1.6, blink: true, rate: 1.6, far: true });
    col([x0, B - 0.3, z0], [x1, h, z1], { kind: 'building' });
  }
  // ================================================================ life on the decks: a canopy over the north arm, benches,
  // planters, ad pillars, ticket machines by the station doors, things people dropped running
  {
    const dk = { layer: 'deck' };
    // the north arm's canopy: white steel roof on slim posts, a gutter, downlights
    prop.set({ col: hex(0xe8e8e4), rm: [0.5, 0.2, 0] }); prop.box(A.n[0] + 6, Y + 3.6, A.n[1] + 0.3, A.n[2] - 2, Y + 3.8, A.n[3] - 0.4);
    prop.set({ col: hex(0x6a6e72), rm: [0.4, 0.7, 0] }); prop.box(A.n[0] + 6, Y + 3.45, A.n[3] - 0.5, A.n[2] - 2, Y + 3.6, A.n[3] - 0.3);
    for (let x = A.n[0] + 8; x < A.n[2] - 2; x += 8) { prop.box(x - 0.08, Y, A.n[3] - 0.55, x + 0.08, Y + 3.6, A.n[3] - 0.39); col([x - 0.12, Y, A.n[3] - 0.6], [x + 0.12, Y + 3.6, A.n[3] - 0.35], { kind: 'pole', mat: 'metal', thin: true, ...dk }); }
    const bench = (x, z, alongX) => { prop.set({ col: hex(0x7a5a3a), rm: [0.8, 0, 0] }); if (alongX) prop.box(x - 1.2, Y + 0.42, z - 0.25, x + 1.2, Y + 0.5, z + 0.25); else prop.box(x - 0.25, Y + 0.42, z - 1.2, x + 0.25, Y + 0.5, z + 1.2);
      prop.set({ col: hex(0x5e6266), rm: [0.4, 0.7, 0] }); for (const d of [-1, 1]) { if (alongX) prop.box(x + d * 1.0 - 0.05, Y, z - 0.22, x + d * 1.0 + 0.05, Y + 0.42, z + 0.22); else prop.box(x - 0.22, Y, z + d * 1.0 - 0.05, x + 0.22, Y + 0.42, z + d * 1.0 + 0.05); }
      col(alongX ? [x - 1.2, Y, z - 0.25] : [x - 0.25, Y, z - 1.2], alongX ? [x + 1.2, Y + 0.5, z + 0.25] : [x + 0.25, Y + 0.5, z + 1.2], { kind: 'bench', mat: 'wood', ...dk }); };
    const pot = (x, z) => { prop.set({ col: hex(0x8a857c), rm: [0.8, 0, 0] }); prop.box(x - 0.9, Y, z - 0.9, x + 0.9, Y + 0.8, z + 0.9); prop.set({ col: hex(0x3c5226), rm: [0.95, 0, 0] }); prop.cyl(x, Y + 0.8, z, 0.85, 0.3, Y + 1.9, 8); col([x - 0.9, Y, z - 0.9], [x + 0.9, Y + 1.0, z + 0.9], { kind: 'planter', ...dk }); };
    const pillar = (x, z, k) => { prop.set({ col: hex(0x8a857c), rm: [0.8, 0, 0] }); prop.box(x - 0.7, Y, z - 0.7, x + 0.7, Y + 0.25, z + 0.7); prop.set({ col: hex(0x2a2c30), rm: [0.5, 0.5, 0] }); prop.box(x - 0.55, Y + 0.25, z - 0.55, x + 0.55, Y + 2.6, z + 0.55); prop.box(x - 0.6, Y + 2.6, z - 0.6, x + 0.6, Y + 2.75, z + 0.6); for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) signQuad(sign2, [x + nx * 0.56, Y + 1.45, z + nz * 0.56], [nx, 0, nz], 0.95, 1.9, E2.poster[(k + Math.abs(nx) * 2 + (nz > 0 ? 1 : 0)) % 4].uv, 1.0); col([x - 0.55, Y, z - 0.55], [x + 0.55, Y + 2.6, z + 0.55], { kind: 'pillar', ...dk }); };
    bench(49, -46, false); bench(107, -48, false); bench(70, -76.4, true); pot(49, -62); pot(107, -66); pot(60, -53); pot(98, -53);
    pillar(46.9, -38, 0); pillar(109.1, -42, 2); pillar(80, -55.1, 1);
    // ticket machines + a vending pair against the station face under the canopy
    for (let i = 0; i < 4; i++) { const x = 84 + i * 1.3; prop.set({ col: hex(0xd8d8d4), rm: [0.4, 0.3, 0] }); prop.box(x - 0.6, Y, A.n[1] + 0.05, x + 0.6, Y + 1.8, A.n[1] + 0.75); prop.set({ col: hex(0x1a3a6a), rm: [0.3, 0, 0.6] }); prop.box(x - 0.45, Y + 1.0, A.n[1] + 0.76, x + 0.45, Y + 1.55, A.n[1] + 0.77, { faces: 'Z' }); }
    col([83.4, Y, A.n[1]], [89.1, Y + 1.8, A.n[1] + 0.8], { kind: 'vending', mat: 'metal', ...dk });
    for (const [i, x] of [[0, 92], [1, 93.1]]) { const v = VE.vend[(i * 5 + 3) % SE.vend.length]; prop.set({ col: hex(0xc63a32), rm: [0.4, 0.3, 0] }); prop.box(x - 0.5, Y, A.n[1] + 0.05, x + 0.5, Y + 1.9, A.n[1] + 0.9); signQuad(vacc, [x, Y + 0.95, A.n[1] + 0.91], [0, 0, 1], 0.98, 1.84, v.uv, 1.0); }
    col([91.5, Y, A.n[1]], [93.6, Y + 1.9, A.n[1] + 0.9], { kind: 'vending', mat: 'metal', ...dk });
    // dropped in the rush: umbrellas, shopping bags, a shoe
    for (const [x, z, k] of [[50, -52, 0], [106, -31, 1], [72, -54, 2], [90, -76, 0], [49.5, -70, 1], [101, -52, 2], [64, -77, 1]]) {
      if (k === 0) { prop.set({ col: hex([0x1a1a1a, 0xc8281c, 0x2a4a8a][(x | 0) % 3]), rm: [0.6, 0, 0] }); prop.tube([x, Y + 0.05, z], [x + 0.85, Y + 0.08, z + 0.2], 0.05, 6); prop.cyl(x + 0.85, Y + 0.05, z + 0.2, 0.05, 0.42, Y + 0.25, 8, { cap: false }); }
      else if (k === 1) { prop.set({ col: hex([0xe8e4dc, 0xd8a83a, 0x1a1a1a][(z | 0) % 3 < 0 ? 0 : (z | 0) % 3]), rm: [0.8, 0, 0] }); prop.obox(x, Y + 0.18, z, 0.2, 0.18, 0.08, x); }
      else { prop.set({ col: hex(0xe8e4dc), rm: [0.8, 0, 0] }); prop.obox(x, Y + 0.12, z, 0.25, 0.12, 0.12, z); prop.set({ col: hex(0x2a2a2a), rm: [0.8, 0, 0] }); prop.obox(x + 0.5, Y + 0.05, z + 0.3, 0.12, 0.05, 0.05, 1.1); }
    }
    // the gate line sign over the landing at the arm's north-east corner (the end of the run along the deck)
    const gt = gateSignTex(), gm = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.0), signMat(gt, { color: 1.15, vc: false }));
    gm.position.set((R2LAND.x0 + R2LAND.x1) / 2, Y + 3.3, R2.z0 + 0.06); root.add(gm);
  }
  // ================================================================ deck signage
  // the station sign along the north arm's fascia (facing the plaza and the avenue)
  {
    const t = stationSignTex(), m = new THREE.Mesh(new THREE.PlaneGeometry(A.e[0] - A.w[2] - 6, 1.6), signMat(t, { color: 1.2, vc: false }));
    m.position.set((A.w[2] + A.e[0]) / 2, Y - 1.25, A.n[3] + 0.06); root.add(m);
    prop.set({ col: hex(0x2a2c30), rm: [0.5, 0.5, 0] }); prop.box(A.w[2] + 2.8, Y - 2.1, A.n[3] - 0.02, A.e[0] - 2.8, Y - 0.4, A.n[3] + 0.04);
    for (let x = A.w[2] + 6; x < A.e[0] - 4; x += 9) prop.box(x - 0.04, Y - 0.85, A.n[3] - 0.02, x + 0.04, Y - 0.4, A.n[3] + 0.02);
  }
  // the deck's name band on the centre bridge (both faces)
  {
    const t = deckNameTex(), L = A.c[2] - A.c[0] - 2, g = new THREE.PlaneGeometry(L, 0.62), m = signMat(t, { color: 1.0, vc: false });
    const a = new THREE.Mesh(g, m); a.position.set((A.c[0] + A.c[2]) / 2, Y - 0.42, A.c[3] + 0.05); root.add(a);
    const b = new THREE.Mesh(g, m); b.position.set((A.c[0] + A.c[2]) / 2, Y - 0.42, A.c[1] - 0.05); b.rotation.y = Math.PI; root.add(b);
  }
  // blue direction signs on posts on the decks
  {
    const t = dirSignTex(), g = new THREE.PlaneGeometry(1.8, 0.68), m = signMat(t, { color: 1.0, vc: false });
    for (const [x, z, ry] of [[49, -36, Math.PI / 2], [107, -36, -Math.PI / 2], [79, -76, 0], [56, -53, Math.PI / 2]]) {
      prop.set({ col: hex(0x8a8e92), rm: [0.4, 0.7, 0] }); prop.cyl(x, Y, z, 0.05, 0.05, Y + 2.9, 6, { cap: false });
      for (const s of [1, -1]) { const p = new THREE.Mesh(g, m); p.position.set(x + Math.sin(ry) * 0.04 * s, Y + 2.5, z + Math.cos(ry) * 0.04 * s); p.rotation.y = ry + (s < 0 ? Math.PI : 0); root.add(p); }
    }
  }
  // hanging banners on the outer balustrades over the plaza (fashion / cola / idol / news posters)
  for (const [x, z, n, k] of [[A.w[2] + 0.12, -64, [1, 0, 0], 0], [A.e[0] - 0.12, -64, [-1, 0, 0], 2], [A.w[2] + 0.12, -40, [1, 0, 0], 3], [A.e[0] - 0.12, -40, [-1, 0, 0], 1]]) {
    signQuad(sign2, [x, Y - 0.9, z], n, 2.4, 3.3, E2.poster[k].uv, 1.0);
    prop.set({ col: hex(0x8a8e92), rm: [0.4, 0.7, 0] }); prop.box(x - 0.03 + n[0] * -0.02, Y + 0.7, z - 1.3, x + 0.03, Y + 0.76, z + 1.3);
  }
  // ================================================================ the plaza: buses' shelters, zelkovas, the old kiosk, vending, bikes
  {
    const y = CURB;
    // zelkova trees in round granite planters
    for (const [x, z] of [[70.6, -42.6], [87.4, -42.6], [70.6, -61.4], [87.4, -61.4]]) {   // on the island's corners
      prop.set({ col: hex(0x8a857c), rm: [0.75, 0, 0] }); prop.cyl(x, y, z, 1.3, 1.3, y + 0.55, 14);
      zelkova(prop, x, y + 0.5, z, 0.82, x * 3 + z);
      col([x - 1.3, 0, z - 1.3], [x + 1.3, y + 0.55, z + 1.3], { kind: 'planter' });
      col([x - 0.25, 0, z - 0.25], [x + 0.25, 4.4, z + 0.25], { kind: 'tree', mat: 'wood' });
    }
    // two bus shelters (glass, a white roof, the route board)
    const shelter = (cx, cz) => {
      prop.set({ col: hex(0xe8e6e0), rm: [0.55, 0.1, 0] }); prop.box(cx - 3.5, y + 2.5, cz - 1.0, cx + 3.5, y + 2.7, cz + 1.0);
      prop.set({ col: hex(0x5e6266), rm: [0.4, 0.7, 0] }); for (const dx of [-3.3, 0, 3.3]) prop.box(cx + dx - 0.05, y, cz - 0.95, cx + dx + 0.05, y + 2.5, cz - 0.85);
      glass.set({ col: hex(0x7d8a88), rm: [0.15, 0.25, 0.0] }); glass.box(cx - 3.3, y + 0.3, cz - 0.92, cx + 3.3, y + 2.3, cz - 0.9, { faces: 'zZ' });
      prop.set({ col: hex(0x6a5a46), rm: [0.8, 0, 0] }); prop.box(cx - 2.5, y + 0.42, cz - 0.8, cx + 2.5, y + 0.5, cz - 0.4);
      signQuad(sign, [cx + 2.2, y + 1.6, cz - 0.87], [0, 0, 1], 1.0, 1.4, SE.plate[(Math.floor(cx) % SE.plate.length + SE.plate.length) % SE.plate.length].uv, 1.0);
      col([cx - 3.4, 0, cz - 1.0], [cx + 3.4, y + 2.4, cz - 0.82], { kind: 'shelter', mat: 'glass' });
    };
    shelter(79, -60); shelter(79, -45);
    // the old newspaper kiosk: rusty green, taped posters, shutters half down (old next to new)
    { const kx = 68, kz = -32;
      prop.set({ col: hex(0x3c5a48), rm: [0.7, 0.2, 0] }); prop.box(kx - 1.6, y, kz - 1.2, kx + 1.6, y + 2.3, kz + 1.2);
      prop.set({ col: hex(0x6a3a2a), rm: [0.8, 0.1, 0] }); prop.box(kx - 1.8, y + 2.3, kz - 1.5, kx + 1.8, y + 2.5, kz + 1.5);
      prop.set({ col: hex(0x8e9092), rm: [0.6, 0.3, 0] }); prop.box(kx - 1.4, y + 1.3, kz + 1.2, kx + 1.4, y + 2.2, kz + 1.24, { faces: 'Z' });
      signQuad(sign, [kx, y + 0.8, kz + 1.25], [0, 0, 1], 2.6, 0.9, SE.fascia[3].uv, 1.0);
      signQuad(sign2, [kx - 1.62, y + 1.3, kz], [-1, 0, 0], 1.6, 1.8, E2.poster[2].uv, 1.0);
      col([kx - 1.6, 0, kz - 1.2], [kx + 1.6, y + 2.3, kz + 1.2], { kind: 'kiosk' }); }
    // a vending bank under the west arm, against the building, in the deck's shade
    for (let i = 0; i < 5; i++) { const zz = -70 + i * 1.05, v = VE.vend[i % SE.vend.length]; prop.set({ col: hex(i % 2 ? 0xd8d6d0 : 0xc63a32), rm: [0.4, 0.3, 0] }); prop.box(44.05, y, zz - 0.5, 44.9, y + 1.9, zz + 0.5); signQuad(vacc, [44.91, y + 0.95, zz], [1, 0, 0], 0.98, 1.84, v.uv, 1.0); }
    col([44, 0, -70.6], [44.9, y + 1.9, -65.3], { kind: 'vending', mat: 'metal' });
    // bike rack with bikes (under the east arm)
    for (let i = 0; i < 9; i++) { const zz = -70 + i * 0.75; prop.set({ col: hex([0x2a2c30, 0xc8c8c8, 0x8a2a2a, 0x2a4a8a][i % 4]), rm: [0.5, 0.6, 0] }); prop.box(110.4, y + 0.35, zz - 0.03, 111.8, y + 0.95, zz + 0.03); prop.cyl(110.6, y + 0.35, zz, 0.33, 0.33, y + 0.36, 10); prop.cyl(111.6, y + 0.35, zz, 0.33, 0.33, y + 0.36, 10); }
    col([110.2, 0, -70.4], [112, y + 1.0, -63.6], { kind: 'bikes', mat: 'metal' });
    // bollards along the avenue edge (keep the buses' tracks honest)
    prop.set({ col: hex(0x8a8e92), rm: [0.45, 0.6, 0] });
    for (let x = 46; x < 111; x += 2.5) if (!(x > STAIR_W.x0 - 1 && x < STAIR_W.x1 + 1) && !(x > STAIR_E.x0 - 1 && x < STAIR_E.x1 + 1) && !(x > 72 && x < 86)) prop.cyl(x, y, -17.6, 0.1, 0.1, y + 0.8, 8);
    // an info board and two bins
    prop.set({ col: hex(0x2a2c30), rm: [0.5, 0.5, 0] }); prop.box(86, y, -35.15, 88, y + 2.0, -34.85);
    signQuad(sign, [87, y + 1.35, -34.84], [0, 0, 1], 1.8, 1.1, SE.panel[2].uv, 1.0);
    col([86, 0, -35.2], [88, y + 2.0, -34.8], { kind: 'board' });
    for (const [bx, bz] of [[74, -46], [84, -58]]) { prop.set({ col: hex(0x5a6a5e), rm: [0.6, 0.3, 0] }); prop.box(bx - 0.4, y, bz - 0.3, bx + 0.4, y + 0.95, bz + 0.3); }
  }

  // ================================================================ the bus pool proper (the plaza was one big empty
  // granite sheet): an asphalt loop round a raised island, lane paint, zebra crossings on the tactile line,
  // バス専用 / 止まれ on the road, numbered stop poles, tall lamp posts, cones and barriers from the evacuation
  const road = new Acc(), mark = new Acc(), roadTxt = new Acc();
  {
    const y = CURB, O = { x0: 54, x1: 102, z0: -72, z1: -32 }, I = { x0: 68, x1: 90, z0: -64, z1: -40 };
    const ry = y + 0.006, my = y + 0.012;
    const rq = (x0, z0, x1, z1) => rect(road, x0, z0, x1, z1, ry, 8);
    rq(O.x0, O.z0, O.x1, I.z0); rq(O.x0, I.z1, O.x1, O.z1); rq(O.x0, I.z0, I.x0, I.z1); rq(I.x1, I.z0, O.x1, I.z1);
    const mq = (x0, z0, x1, z1) => mark.quad([x0, my, z1], [x1, my, z1], [x1, my, z0], [x0, my, z0]);
    // edge lines round the outside and the island, a dashed centre line down the loop
    for (const [a0, a1, a2, a3] of [[O.x0, O.z0, O.x1, O.z1], [I.x0, I.z0, I.x1, I.z1]]) { const o = a0 === O.x0 ? 0.3 : -0.3;
      mq(a0 + o - 0.075, a1 + o, a0 + o + 0.075, a3 - o); mq(a2 - o - 0.075, a1 + o, a2 - o + 0.075, a3 - o); mq(a0 + o, a1 + o - 0.075, a2 - o, a1 + o + 0.075); mq(a0 + o, a3 - o - 0.075, a2 - o, a3 - o + 0.075); }
    const cx0 = (O.x0 + I.x0) / 2, cx1 = (O.x1 + I.x1) / 2, cz0 = (O.z0 + I.z0) / 2, cz1 = (O.z1 + I.z1) / 2;
    for (let z = cz0 + 1; z < cz1 - 2; z += 4) { mq(cx0 - 0.07, z, cx0 + 0.07, z + 2); mq(cx1 - 0.07, z, cx1 + 0.07, z + 2); }
    for (let x = cx0 + 1; x < cx1 - 2; x += 4) { mq(x, cz0 - 0.07, x + 2, cz0 + 0.07); mq(x, cz1 - 0.07, x + 2, cz1 + 0.07); }
    // zebras where the station-door tactile line crosses the loop (north and south)
    for (const [z0, z1] of [[O.z0 + 0.6, I.z0 - 0.6], [I.z1 + 0.6, O.z1 - 0.6]]) for (let x = 76.2; x < 81.8; x += 0.9) mq(x, z0, x + 0.45, z1);
    // stop lines before the zebras
    mq(75.1, O.z0 + 0.4, 75.5, I.z0 - 0.4); mq(82.5, I.z1 + 0.4, 82.9, O.z1 - 0.4);   // (left-hand traffic: clockwise round the island)
    // the island: a granite curb all round (visual: it's only 12 cm)
    prop.set({ col: hex(0xa8a49c), rm: [0.8, 0, 0] });
    prop.box(I.x0, y, I.z0, I.x1, y + 0.12, I.z0 + 0.25, { faces: 'zY' }); prop.box(I.x0, y, I.z1 - 0.25, I.x1, y + 0.12, I.z1, { faces: 'ZY' });
    prop.box(I.x0, y, I.z0, I.x0 + 0.25, y + 0.12, I.z1, { faces: 'xY' }); prop.box(I.x1 - 0.25, y, I.z0, I.x1, y + 0.12, I.z1, { faces: 'XY' });
    // road lettering (read from a bus coming round the loop)
    const word = (cx, cz, ang, k) => { const c = Math.cos(ang), s_ = Math.sin(ang), hw = 1.5, hl = 2.6;
      const P = (u, v) => [cx + c * u - s_ * v, my + 0.002, cz + s_ * u + c * v];
      const t = RT[k]; roadTxt.quad(P(-hw, hl), P(hw, hl), P(hw, -hl), P(-hw, -hl), t); };
    word(cx0, -48, 0, 0); word(cx1, -56, Math.PI, 0); word(84, cz1, -Math.PI / 2, 1); word(73, cz0, Math.PI / 2, 1);
    // numbered stop poles along the island (the round-topped bus-stop sign), facing the lanes
    const stopTex = busStopTex(), stopM = signMat(stopTex, { color: 1.0, vc: false }); stopM.alphaTest = 0.5; stopM.side = THREE.DoubleSide;
    [[I.x0 - 0.4, -46, -Math.PI / 2, 0], [I.x0 - 0.4, -58, -Math.PI / 2, 1], [I.x1 + 0.4, -46, Math.PI / 2, 2], [I.x1 + 0.4, -58, Math.PI / 2, 3]].forEach(([x, z, ry_, k]) => {
      prop.set({ col: hex(0x8a8e92), rm: [0.4, 0.7, 0] }); prop.cyl(x, y, z, 0.05, 0.05, y + 2.3, 8, { cap: false });
      prop.set({ col: hex(0x6a6e72), rm: [0.5, 0.5, 0] }); prop.cyl(x, y, z, 0.28, 0.28, y + 0.12, 10);
      for (const sd of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), stopM); m.geometry.translate(0, 0, 0);
        m.position.set(x + Math.sin(ry_) * 0.03 * sd, y + 2.6, z + Math.cos(ry_) * 0.03 * sd); m.rotation.y = ry_ + (sd < 0 ? Math.PI : 0);
        const u0 = (k % 4) * 0.25; const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.25); root.add(m); }
      prop.set({ col: hex(0xe8e6e0), rm: [0.6, 0.1, 0] }); prop.box(x - 0.05, y + 1.0, z - 0.3, x + 0.05, y + 1.7, z + 0.3);   // the timetable
      col([x - 0.15, 0, z - 0.15], [x + 0.15, y + 2.3, z + 0.15], { kind: 'pole', mat: 'metal', thin: true });
    });
    // tall lamp posts round the loop (a slim mast, a long arm, a flat LED head)
    for (const [x, z, d] of [[56, -36, 1], [56, -68, 1], [100, -36, -1], [100, -68, -1], [79, -73.4, 0], [79, -30.6, 0]]) {
      prop.set({ col: hex(0x6a6e72), rm: [0.4, 0.7, 0] }); prop.cyl(x, y, z, 0.12, 0.09, y + 8.5, 8, { cap: false });
      const ax = d ? x + d * 2.2 : x, az = d ? z : z + (z < -50 ? 2.2 : -2.2);
      prop.tube([x, y + 8.4, z], [ax, y + 8.6, az], 0.06, 6);
      prop.box(ax - 0.45, y + 8.5, az - 0.2, ax + 0.45, y + 8.66, az + 0.2);
      prop.set({ col: [1.0, 0.98, 0.92], rm: [0.4, 0, 0.6] }); prop.box(ax - 0.38, y + 8.48, az - 0.15, ax + 0.38, y + 8.5, az + 0.15, { faces: 'y' });
      col([x - 0.15, 0, z - 0.15], [x + 0.15, y + 8.5, z + 0.15], { kind: 'pole', mat: 'metal', thin: true });
    }
    // the evacuation: a run of crowd barriers knocked askew, cones, a dropped traffic baton
    for (const [x, z, a] of [[60, -38, 0.2], [62.5, -38.6, 0.5], [65.2, -38.1, -0.3], [98, -66, 1.4], [97.4, -63.2, 1.9]]) {
      const c = Math.cos(a), s_ = Math.sin(a), L = 1.0;
      prop.set({ col: hex(0xe8e6e0), rm: [0.6, 0.2, 0] }); prop.tube([x - c * L, y + 0.95, z + s_ * L], [x + c * L, y + 0.95, z - s_ * L], 0.03, 5);
      prop.tube([x - c * L, y + 0.25, z + s_ * L], [x + c * L, y + 0.25, z - s_ * L], 0.03, 5);
      for (let k = -2; k <= 2; k++) prop.tube([x + c * k * 0.45, y + 0.25, z - s_ * k * 0.45], [x + c * k * 0.45, y + 0.95, z - s_ * k * 0.45], 0.015, 4);
      prop.set({ col: hex(0x2a2c30), rm: [0.6, 0.3, 0] }); for (const e_ of [-1, 1]) prop.obox(x + c * e_ * 0.95, y + 0.03, z - s_ * e_ * 0.95, 0.12, 0.03, 0.35, a);
    }
    for (const [x, z] of [[66.5, -36], [67.2, -33.6], [91, -69], [92.4, -70.6], [101, -47], [55.4, -55], [86, -33]]) {
      prop.set({ col: hex(0xe8501a), rm: [0.7, 0, 0] }); prop.cyl(x, y + 0.04, z, 0.2, 0.04, y + 0.72, 8, { cap: false });
      prop.set({ col: hex(0xf2f2ee), rm: [0.5, 0, 0] }); prop.cyl(x, y + 0.36, z, 0.12, 0.09, y + 0.5, 8, { cap: false });
      prop.set({ col: hex(0x2a2a2a), rm: [0.8, 0, 0] }); prop.box(x - 0.25, y, z - 0.25, x + 0.25, y + 0.04, z + 0.25);
    }
  }
  // ================================================================ the decks: roofed walkways (Shibuya's decks are mostly
  // covered), hanging direction signs under the roofs, lit ad boxes along the balustrades
  {
    const dk = { layer: 'deck' };
    const roofed = (x0, x1, z0, z1, postX) => {
      prop.set({ col: hex(0xeceae6), rm: [0.5, 0.15, 0] }); prop.box(x0, Y + 3.5, z0, x1, Y + 3.72, z1, { faces: 'YxXzZ' });
      prop.set({ col: hex(0x8e8e8a), rm: [0.7, 0.1, 0] }); prop.box(x0, Y + 3.5, z0, x1, Y + 3.72, z1, { faces: 'y' });      // the soffit: aluminium slats in shade
      prop.set({ col: hex(0x6e6e6a), rm: [0.7, 0.2, 0] }); for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.2) prop.box(x0 + 0.1, Y + 3.44, z, x1 - 0.1, Y + 3.5, z + 0.08, { faces: 'yzZ' });
      prop.set({ col: hex(0x5e6266), rm: [0.4, 0.7, 0] }); prop.box(x0 - 0.05, Y + 3.38, z0, x0 + 0.12, Y + 3.5, z1); prop.box(x1 - 0.12, Y + 3.38, z0, x1 + 0.05, Y + 3.5, z1);
      prop.set({ col: [1.0, 0.98, 0.94], rm: [0.4, 0, 1.4] }); prop.box((x0 + x1) / 2 - 0.08, Y + 3.48, z0 + 0.5, (x0 + x1) / 2 + 0.08, Y + 3.5, z1 - 0.5, { faces: 'y' });   // the light strip
      prop.set({ col: hex(0x8a8e92), rm: [0.4, 0.7, 0] });
      for (let z = z0 + 1.5; z < z1; z += 7.5) { prop.cyl(postX, Y, z, 0.09, 0.09, Y + 3.5, 8, { cap: false }); col([postX - 0.12, Y, z - 0.12], [postX + 0.12, Y + 3.5, z + 0.12], { kind: 'pole', mat: 'metal', thin: true, ...dk }); }
      // the roof: shades the deck (sun map) but is not a floor anyone reaches
      col([x0, Y + 3.5, z0], [x1, Y + 3.72, z1], { kind: 'canopy', noBlock: true, ...dk });
    };
    roofed(A.w[0] + 0.3, A.w[2] - 0.2, -72, -34, A.w[0] + 0.55);
    roofed(A.e[0] + 0.2, A.e[2] - 0.3, -72, -34, A.e[2] - 0.55);
    // the north arm's existing canopy gets a collider too, so it shades its deck
    col([A.n[0] + 6, Y + 3.6, A.n[1] + 0.3], [A.n[2] - 2, Y + 3.8, A.n[3] - 0.4], { kind: 'canopy', noBlock: true, ...dk });
    // direction signs hung under the roofs (both faces), at the junctions and halfway
    const t = dirSignTex(), g = new THREE.PlaneGeometry(2.2, 0.82), m = signMat(t, { color: 1.05, vc: false });
    for (const [x, z] of [[49, -40], [49, -62], [107, -40], [107, -62], [70, -77], [92, -77]]) {
      const facesZ = z > -74;                 // on the arms you walk along z: the sign faces you (normal ±z)
      prop.set({ col: hex(0x5e6266), rm: [0.4, 0.7, 0] });
      for (const e_ of [-0.9, 0.9]) facesZ ? prop.box(x + e_ - 0.02, Y + 3.1, z - 0.02, x + e_ + 0.02, Y + 3.5, z + 0.02) : prop.box(x - 0.02, Y + 3.1, z + e_ - 0.02, x + 0.02, Y + 3.6, z + e_ + 0.02);
      for (const sd of [1, -1]) {
        const p = new THREE.Mesh(g, m);
        if (facesZ) { p.position.set(x, Y + 2.75, z + 0.03 * sd); p.rotation.y = sd > 0 ? 0 : Math.PI; }
        else { p.position.set(x + 0.03 * sd, Y + 2.75, z); p.rotation.y = sd > 0 ? Math.PI / 2 : -Math.PI / 2; }
        root.add(p);
      }
    }
    // lit ad boxes standing against the outer balustrades, facing in (a dark steel frame, the poster)
    for (const [x, z, nx, k] of [[A.w[0] + 0.45, -52, 1, 0], [A.w[0] + 0.45, -67, 1, 2], [A.e[2] - 0.45, -52, -1, 1], [A.e[2] - 0.45, -67, -1, 3], [A.w[0] + 0.45, -44, 1, 3], [A.e[2] - 0.45, -44, -1, 0]]) {
      prop.set({ col: hex(0x2a2c30), rm: [0.5, 0.5, 0] }); prop.box(x - 0.18, Y, z - 0.75, x + 0.18, Y + 2.25, z + 0.75);
      signQuad(sign2, [x + nx * 0.19, Y + 1.2, z], [nx, 0, 0], 1.3, 1.85, E2.poster[k].uv, 1.15);
      col([x - 0.2, Y, z - 0.75], [x + 0.2, Y + 2.25, z + 0.75], { kind: 'board', ...dk });
    }
  }
  // ================================================================ meshes
  root.add(fac.mesh(facadeMaterial()));
  const tm = new THREE.MeshStandardMaterial({ map: deckTex(), color: 0xd4d0c8, roughness: 0.75 });
  const mt = top.mesh(tm); mt.receiveShadow = true; root.add(mt);
  const pm = new THREE.MeshStandardMaterial({ map: plazaTex(), color: 0xe4ddd2, roughness: 0.62 });
  const mp = pave.mesh(pm); mp.receiveShadow = true; root.add(mp);
  const ym = new THREE.MeshStandardMaterial({ color: 0xd8b21a, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  root.add(tact.mesh(ym));
  { const rm_ = new THREE.MeshStandardMaterial({ map: asphaltTex(), color: 0x9a9a9e, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const mr = road.mesh(rm_); mr.receiveShadow = true; root.add(mr);
    const pm_ = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const mm = mark.mesh(pm_); mm.receiveShadow = true; root.add(mm);
    const tm_ = new THREE.MeshStandardMaterial({ map: roadTextTex(), transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, depthWrite: false });
    const mt_ = roadTxt.mesh(tm_); mt_.receiveShadow = true; root.add(mt_);
    rm_.userData.noAO = false; }
  root.add(prop.mesh(rmMat({}), { shadow: false }));
  root.add(glass.mesh(rmMat({ envMapIntensity: 1.3 })));
  if (sign.vn) root.add(sign.mesh(signMat(signAtlas().tex)));
  if (sign2.vn) root.add(sign2.mesh(signMat(signAtlas2().tex)));
  if (vacc.vn) root.add(vacc.mesh(signMat(vendAtlas().tex)));
  tm.userData.noAO = true; ym.userData.noAO = false;
  return { root, colliders, walks, shade, groundMats: [tm, pm, ym], anchors: { glows, lights } };
}

function gateSignTex() {
  const W = 1024, H = 146, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#1d2a44'; g.fillRect(0, 0, W, H); g.fillStyle = '#e8e6e0'; g.fillRect(0, H - 6, W, 6);
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = `900 64px ${JP}`; g.fillText('東口改札  ↑ 屋上・首都高', 30, 62);
  g.font = '400 30px Anton, sans-serif'; g.fillStyle = '#c8d0dc'; g.fillText('EAST GATES  •  ROOF TERRACE  •  EXPRESSWAY LINK', 34, 118);
  return canvasTex(c, { repeat: false, aniso: 4 });
}

// road lettering, 2 cells side by side: バス専用 (bus only) and 止まれ (stop), white paint, worn
const RT = [[0, 0, 0.5, 1], [0.5, 0, 1, 1]];   // [u0, v0, u1, v1]
function roadTextTex() {
  const W = 512, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), rng = makeRng(919);
  g.clearRect(0, 0, W, H);
  const col = (cx, words) => { g.save(); g.translate(cx, H / 2); g.fillStyle = 'rgba(240,240,236,0.92)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const n = words.length, step = H / n; words.forEach((w, i) => { g.font = `900 ${Math.floor(step * 0.92)}px ${JP}`; g.save(); g.translate(0, -H / 2 + step * (i + 0.5)); g.scale(0.62, 1.0); g.fillText(w, 0, 0); g.restore(); }); g.restore(); };
  col(W * 0.25, ['バ', 'ス', '専', '用']); col(W * 0.75, ['止', 'ま', 'れ']);
  // wear: knock holes in the paint
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + rng() * 0.6})`; g.fillRect(rng() * W, rng() * H, 1 + rng() * 4, 1 + rng() * 3); }
  g.globalCompositeOperation = 'source-over';
  return canvasTex(c, { repeat: false, aniso: 8 });
}
// the round bus-stop plates (4 cells across): a white disc, a green ring, a bus pictogram, the stop number
function busStopTex() {
  const S = 128, c = makeCanvas(S * 4, S), g = c.getContext('2d');
  g.clearRect(0, 0, S * 4, S);
  for (let k = 0; k < 4; k++) {
    const cx = k * S + S / 2, cy = S / 2;
    g.fillStyle = '#1f7a46'; g.beginPath(); g.arc(cx, cy, S * 0.48, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, S * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1f7a46'; g.fillRect(cx - 26, cy - 34, 52, 30); g.fillStyle = '#fff'; g.fillRect(cx - 21, cy - 30, 18, 12); g.fillRect(cx + 3, cy - 30, 18, 12);
    g.fillStyle = '#1f7a46'; g.beginPath(); g.arc(cx - 15, cy - 3, 5, 0, Math.PI * 2); g.arc(cx + 15, cy - 3, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.font = `900 30px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${k + 1}番`, cx, cy + 26);
  }
  const t = canvasTex(c, { repeat: false, aniso: 4 });
  return t;
}
