import * as THREE from 'three';
import { DAY } from './tod.js';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex, signMat } from './kit.js';
import { facadeMaterial, cellRect, FCELL } from './facade.js';
import { signAtlas } from './signs.js';
import { buildScreen } from './screens.js';
import { BLOCKS, SNIPERS, EXCL } from './layout.js';
import { signAtlas2 } from './signs2.js';

// =====================================================================================
//  Kurogane's buildings. Each block is split into narrow lots along its street fronts (Tokyo's
//  "pencil buildings": 6–14 m wide, 4–12 floors). A lot = facade box (one atlas material for the
//  whole city) + a shopfront (breakable glass, a lit interior card behind it, or a roller shutter)
//  + blade signs (tategaki light boxes / neon) + floor fascias + rooftop clutter / billboards.
//  Neon throws coloured light on the wall behind it (additive halos) and on the pavement (anchors
//  for the ground light map). The giant screens hang on the corner towers.
// =====================================================================================
const GROUND_H = 4.2;
const STYLES = [
  [FCELL.tileWhite, 9], [FCELL.tileWhiteAC, 8], [FCELL.tileBeige, 9], [FCELL.tileBeigeAC, 7], [FCELL.ribbon, 7], [FCELL.ribbonDark, 4],
  [FCELL.curtain, 6], [FCELL.curtainBlue, 5], [FCELL.brick, 2], [FCELL.brickAC, 2], [FCELL.balcony, 4], [FCELL.balconyLaundry, 3],
  [FCELL.darkPanel, 4], [FCELL.darkPanelSlot, 3], [FCELL.tileGreen, 5], [FCELL.office, 6],
];
const SIDES = [FCELL.side, FCELL.sideWin, FCELL.sideStain, FCELL.sideTile];
const FACE = {
  s: { n: [0, 0, 1], t: [1, 0, 0] }, n: { n: [0, 0, -1], t: [-1, 0, 0] },
  e: { n: [1, 0, 0], t: [0, 0, -1] }, w: { n: [-1, 0, 0], t: [0, 0, 1] },
};
const ADJ = { s: { e: 1, w: 0 }, n: { w: 1, e: 0 }, e: { n: 1, s: 0 }, w: { s: 1, n: 0 } }; // which end (0 start / 1 end) of face A meets face B

function weighted(rng, list) { let tot = 0; for (const [, w] of list) tot += w; let r = rng() * tot; for (const [v, w] of list) { if ((r -= w) <= 0) return v; } return list[0][0]; }

export function haloTexture() {
  const S = 64, c = makeCanvas(S, S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = Math.abs(x + 0.5 - S / 2) / (S / 2), dy = Math.abs(y + 0.5 - S / 2) / (S / 2);
    const d = Math.pow(Math.pow(dx, 3) + Math.pow(dy, 3), 1 / 3);
    const v = Math.max(0, 1 - d); const k = v * v * (3 - 2 * v);
    const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * k); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return canvasTex(c, { repeat: false, srgb: false, aniso: 1 });
}

export function signMaterial() {
  const { tex } = signAtlas();
  return signMat(tex);
}
export function haloMaterial() {
  return new THREE.MeshBasicMaterial({ visible: !DAY.on, map: haloTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
}

// signs / halos helpers (shared with street.js / station.js)
export function signQuad(acc, C, N, w, h, uv, k = 1, up = [0, 1, 0]) {
  // viewer's right = up × N
  const r = [up[1] * N[2] - up[2] * N[1], up[2] * N[0] - up[0] * N[2], up[0] * N[1] - up[1] * N[0]];
  const P = (sr, su) => [C[0] + r[0] * sr * w / 2 + up[0] * su * h / 2, C[1] + r[1] * sr * w / 2 + up[1] * su * h / 2, C[2] + r[2] * sr * w / 2 + up[2] * su * h / 2];
  const col = Array.isArray(k) ? k : [k, k, k];
  acc.quad(P(-1, -1), P(1, -1), P(1, 1), P(-1, 1), [uv[0], uv[1], uv[0] + uv[2], uv[1] + uv[3]], col);
}

// the giant screens: [x, yCentre, z, yaw, w, h, seed, programme panels] (on the facade planes, 0.3–0.4 m out)
export const SCREENS = [
  [17, 17.6, -27.6, 0, 16.4, 17.6, 0, [0, 6, 4, 2]],       // K-FRONT: the glass corner building that is one giant screen (QFRONT)
  [-56, 15, 29.7, Math.PI, 15, 8.4, 3.4, [5, 0, 4, 2]],    // over Hachikō square
  [-18, 16, -27.6, 0, 12, 7.2, 4.6, [6, 7, 4, 2]],          // the NW corner, beside the Center-gai gate
  [-22.5, 13, 27.7, Math.PI, 9.5, 5.6, 5.2, [0, 5, 4, 2]],  // the SW corner
  [74, 15.5, 16.7, Math.PI, 14, 7.9, 2.1, [7, 6, 5, 2]],   // down the avenue (Yasukuni-dōri style)
  [152, 18, -16.7, 0, 12, 6.8, 1.3, [6, 0, 4, 2]],
];
function screenOn(x0, z0, x1, z1, face) {
  // a screen on this lot's front: returns the height the lot must reach
  for (const [x, y, z, yaw, w, h] of SCREENS) {
    const N = [Math.round(Math.sin(yaw)), Math.round(Math.cos(yaw))];
    const F = FACE[face].n;
    if (N[0] !== F[0] || N[1] !== F[2]) continue;
    const plane = face === 's' ? z1 : face === 'n' ? z0 : face === 'e' ? x1 : x0;
    if (Math.abs((F[0] ? x : z) - plane) > 1.0) continue;
    const a0 = F[0] ? z0 : x0, a1 = F[0] ? z1 : x1, c = F[0] ? z : x;
    if (c + w / 2 + 1 > a0 && c - w / 2 - 1 < a1) return y + h / 2 + 3;
  }
  return 0;
}

export function buildCity(ctx = {}) {
  const rng = makeRng(6061);
  const fac = new Acc({ cell: true, info: true });
  const prop = new Acc({ rm: true });
  const sign = new Acc(), halo = new Acc();
  const colliders = [], panes = [], glows = [], lights = [], lots = [];
  const { E: SE } = signAtlas(), { E: S2 } = signAtlas2();
  const sign2 = new Acc(), win2 = new Acc();
  // today's Tokyo is mostly white LED light boxes: neon tube is the exception (bars, pachinko, karaoke)
  const BL = SE.blade.filter(b => !b.neon), BN = SE.blade.filter(b => b.neon), FL = SE.fascia.filter(f => !f.neon), FN = SE.fascia.filter(f => f.neon);
  const pickBlade = () => (rng() < 0.16 ? pickOf(BN) : pickOf(BL));
  const pickFascia = () => (rng() < 0.18 ? pickOf(FN) : pickOf(FL));
  const R = (a, b) => a + (b - a) * rng();
  const pickOf = (arr) => arr[Math.floor(rng() * arr.length)];
  let seedN = 1;

  // ---------------------------------------------------------------- a wall quad on the facade material
  // origin O (bottom-left as seen from outside), along T for L metres, up from y0 to y1; outward normal N
  const wall = (O, T, N, L, y0, y1, cell, info, col, { bay = 3.0, floorH = 3.3, v0 = 0 } = {}) => {
    const nb = Math.max(1, Math.round(L / bay)), fl = (y1 - y0) / floorH;
    fac.set({ cell: cellRect(cell), info, col });
    const a = [O[0], y0, O[2]], b = [O[0] + T[0] * L, y0, O[2] + T[2] * L];
    fac.quad(a, b, [b[0], y1, b[2]], [a[0], y1, a[2]], [0, v0, nb, v0 + fl], col);
  };

  // ---------------------------------------------------------------- one lot
  const sniperIn = (x0, z0, x1, z1) => Object.values(SNIPERS).find(s => s.x > x0 && s.x < x1 && s.z > z0 && s.z < z1);
  function lot(L) {
    // L: { x0, z0, x1, z1, face, hot, corner?: face2, h?, style?, shop? }
    if (EXCL.some(([a, b, c, d]) => L.x1 > a && L.x0 < c && L.z1 > b && L.z0 < d)) return null;
    const F = FACE[L.face], N = F.n, T = F.t;
    const seed = seedN++;
    const snp = sniperIn(L.x0, L.z0, L.x1, L.z1);
    let h = L.h ?? (L.hot ? (rng() < 0.15 ? R(36, 52) : R(16, 34)) : R(12, 30));
    const scr = screenOn(L.x0, L.z0, L.x1, L.z1, L.face);
    if (scr) { h = Math.max(h, scr); L.noSigns = true; }
    if (snp && !L.tower) h = snp.y;
    const floors = Math.max(2, Math.round((h - GROUND_H) / 3.3)), floorH = (h - GROUND_H) / floors;
    const style = L.style ?? weighted(rng, STYLES), side = pickOf(SIDES);
    const lit = L.lit ?? R(0.18, 0.55), warm = R(0.25, 0.8);
    // Tokyo tile colours by day: off-white, warm beige, cool grey, a pinkish or sage tile, the odd chocolate
    const tintK = R(0.84, 1.06), hue = R(-0.03, 0.03);
    const TT = [[1, 1, 1], [1.06, 1.0, 0.9], [0.92, 0.96, 1.02], [1.06, 0.95, 0.93], [0.95, 1.02, 0.95], [0.78, 0.68, 0.6], [1.0, 0.98, 0.94]];
    const tt = DAY.on ? TT[Math.floor(rng() * TT.length)] : [1, 1, 1];
    const col = [tintK * (1 + hue) * tt[0], tintK * tt[1], tintK * (1 - hue) * tt[2]];
    const info = [seed, lit, warm, 0], infoS = [seed, lit * 0.6, warm, 1];
    const { x0, z0, x1, z1 } = L;
    // the four walls, each drawn from its own outside-left corner
    const walls = {
      s: { O: [x0, 0, z1], T: [1, 0, 0], N: [0, 0, 1], L: x1 - x0 }, n: { O: [x1, 0, z0], T: [-1, 0, 0], N: [0, 0, -1], L: x1 - x0 },
      e: { O: [x1, 0, z1], T: [0, 0, -1], N: [1, 0, 0], L: z1 - z0 }, w: { O: [x0, 0, z0], T: [0, 0, 1], N: [-1, 0, 0], L: z1 - z0 },
    };
    for (const k of 'snew') {
      const Wl = walls[k], isFront = k === L.face, isCorner = k === L.corner;
      if (isFront || isCorner) {
        wall(Wl.O, Wl.T, Wl.N, Wl.L, GROUND_H, h, style, info, col, { floorH });
        if (isCorner) wall(Wl.O, Wl.T, Wl.N, Wl.L, 0, GROUND_H, FCELL.pilaster, [seed, 0, 0, 3], col, { floorH: GROUND_H, bay: Wl.L });
      } else wall(Wl.O, Wl.T, Wl.N, Wl.L, 0, h, side, infoS, col.map(v => v * 0.9), { floorH: 3.3, bay: 3.6 });
    }
    // roof + parapet + floor ledges on some styles
    fac.set({ cell: cellRect(FCELL.roof), info: [seed, 0, 0, 3], col: [0.8, 0.8, 0.8] });
    fac.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 0, (x1 - x0) / 4, (z1 - z0) / 4]);
    prop.set({ col: hex(0x8a8780).map(v => v * tintK), rm: [0.9, 0, 0] });
    const pH = 0.9, pT = 0.25;
    prop.box(x0, h, z0, x1, h + pH, z0 + pT); prop.box(x0, h, z1 - pT, x1, h + pH, z1); prop.box(x0, h, z0 + pT, x0 + pT, h + pH, z1 - pT); prop.box(x1 - pT, h, z0 + pT, x1, h + pH, z1 - pT);
    // the facade's slab edges: a shadow line every floor (reads as relief from the street)
    if (L.hot && (style === FCELL.tileWhite || style === FCELL.tileBeige || style === FCELL.ribbon || style === FCELL.balcony || style === FCELL.office)) {
      const Wl = walls[L.face];
      prop.set({ col: hex(0x9c9a94).map(v => v * tintK), rm: [0.85, 0, 0] });
      for (let f = 1; f <= floors; f++) {
        const y = GROUND_H + f * floorH - 0.12;
        const a = Wl.O, b = [a[0] + Wl.T[0] * Wl.L, 0, a[2] + Wl.T[2] * Wl.L];
        const ox = Wl.N[0] * 0.22, oz = Wl.N[2] * 0.22;
        prop.box(Math.min(a[0], b[0], a[0] + ox), y, Math.min(a[2], b[2], a[2] + oz), Math.max(a[0], b[0], a[0] + ox), y + 0.14, Math.max(a[2], b[2], a[2] + oz), { faces: 'xXYyzZ' });
      }
    }
    // collider: upper floors on the facade line, the ground floor set back behind the shop glass
    const Wf = walls[L.face];
    const shopOpen = L.hot && (L.shop ?? rng() < 0.68);
    const inset = shopOpen ? 1.3 : 0.05;
    const ib = [x0, z0, x1, z1];
    if (L.face === 's') ib[3] -= inset; if (L.face === 'n') ib[1] += inset; if (L.face === 'e') ib[2] -= inset; if (L.face === 'w') ib[0] += inset;
    colliders.push({ min: [ib[0], 0, ib[1]], max: [ib[2], GROUND_H, ib[3]], data: { mat: 'concrete', kind: 'building' } });
    colliders.push({ min: [x0, GROUND_H, z0], max: [x1, h + pH, z1], data: { mat: 'concrete', kind: 'building' } });
    const lotRec = { ...L, h, seed, floors, floorH, style, roof: h, info };
    lots.push(lotRec);
    if (L.hot) shopfront(lotRec, Wf, shopOpen);
    else if (!L.far) { // plain ground floor: tiled base + a door
      wall(Wf.O, Wf.T, Wf.N, Wf.L, 0, GROUND_H, FCELL.base, [seed, 0, 0, 3], col, { floorH: GROUND_H, bay: 2 });
    }
    if (L.hot && !L.noSigns) signsFor(lotRec, Wf);
    else if (L.hot && L.tower) kfront(lotRec, Wf);
    if (!L.far) roofClutter(lotRec);
    return lotRec;
  }

  // ---------------------------------------------------------------- shopfront
  function shopfront(lot, Wl, open) {
    const { O, T, N, L } = Wl, seed = lot.seed;
    const at = (a, y, out = 0) => [O[0] + T[0] * a + N[0] * out, y, O[2] + T[2] * a + N[2] * out];
    // pilasters at both ends + the fascia band above the glass
    prop.set({ col: hex(pickOf([0x3a3836, 0x5a5650, 0x2a2c30, 0x8a8478])), rm: [0.6, 0.1, 0] });
    for (const a of [0, L - 0.45]) { const p = at(a, 0, 0), q = at(a + 0.45, GROUND_H, 0.18); prop.box(Math.min(p[0], q[0]), 0, Math.min(p[2], q[2]), Math.max(p[0], q[0]), GROUND_H, Math.max(p[2], q[2])); }
    const fb0 = at(0.45, 3.15, 0), fb1 = at(L - 0.45, GROUND_H, 0.32);
    prop.set({ col: hex(0x1c1c1e), rm: [0.5, 0.3, 0] });
    prop.box(Math.min(fb0[0], fb1[0]), 3.15, Math.min(fb0[2], fb1[2]), Math.max(fb0[0], fb1[0]), GROUND_H - 0.05, Math.max(fb0[2], fb1[2]));
    // the fascia sign (most shops have one)
    const fw = L - 1.1, fh = Math.min(0.95, fw / 4.27);
    const fc = at(L / 2, 3.15 + (GROUND_H - 3.2) / 2, 0.335);
    const fe = pickFascia();
    signQuad(sign, fc, N, fw, fh, fe.uv, fe.neon ? 1.9 : 1.35);
    if (fe.neon) haloQuad(at(L / 2, 3.6, 0.34), N, fw * 1.25, 2.2, fe.glow, 0.14);
    if (open) {
      const kind = Math.floor(rng() * 4), card = SE.shop[kind];
      // the glass (breakable) from 0.25 to 3.1, the interior card 1.25 m behind, a lit ceiling strip, the recess walls
      const gw = L - 0.9, gc = at(L / 2, 0.25 + 2.85 / 2, 0.06);
      panes.push({ c: gc, n: N, w: gw, h: 2.85, kind: 'store' });
      { const np = Math.max(1, Math.round(gw / 3.6)), pw = gw / np; for (let i = 0; i < np; i++) { const cd = rng() < 0.75 ? card : pickOf(SE.shop); signQuad(sign, at(0.45 + pw * (i + 0.5), 1.65, -1.25), N, pw, 3.1, cd.uv, kind === 2 ? 1.25 : 1.15); } }
      prop.set({ col: [1, 1, 1], rm: [0.4, 0, 2.2] });
      const c0 = at(0.45, 3.1, -1.3), c1 = at(L - 0.45, 3.15, 0);
      prop.box(Math.min(c0[0], c1[0]), 3.1, Math.min(c0[2], c1[2]), Math.max(c0[0], c1[0]), 3.15, Math.max(c0[2], c1[2]), { faces: 'y' });
      prop.set({ col: hex(0x2a2826), rm: [0.5, 0, 0] });
      const f0 = at(0.45, 0.0, -1.3), f1 = at(L - 0.45, 0.16, 0);
      prop.box(Math.min(f0[0], f1[0]), 0.0, Math.min(f0[2], f1[2]), Math.max(f0[0], f1[0]), 0.16, Math.max(f0[2], f1[2]), { faces: 'Y' });
      const LC = [[1.5, 1.55, 1.6], [1.6, 1.15, 0.6], [1.5, 0.75, 1.4], [1.5, 1.3, 1.0]][kind];
      lights.push({ x: gc[0] + N[0] * 2.2, z: gc[2] + N[2] * 2.2, w: gw * 1.15, d: 6.5, ang: Math.atan2(T[2], T[0]), color: LC, k: 1.0 });
      // izakaya / ramen: red lanterns by the door, noren over it
      if (kind === 1 && rng() < 0.8) for (const a of [0.8, L - 0.8]) { const p = at(a, 2.6, 0.45); prop.set({ col: hex(0xc8281c), rm: [0.6, 0, 1.4] }); prop.cyl(p[0], 2.3, p[2], 0.2, 0.2, 2.85, 8); glows.push({ p: [p[0], 2.58, p[2]], color: [2.4, 0.5, 0.25], size: 0.9 }); }
    } else {
      wall(at(0.45, 0, 0.05), T, N, L - 0.9, 0, 3.15, rng() < 0.4 ? FCELL.shutterTag : FCELL.shutter, [seed, 0, 0, 3], [0.9, 0.9, 0.9], { floorH: 3.15, bay: Math.max(1, L - 0.9) });
    }
    // floor-directory plates up the pilaster beside the entrance
    if (rng() < 0.55) for (let f = 0; f < 4; f++) { const pl = pickOf(SE.plate); signQuad(sign, at(L - 0.23, 1.0 + f * 0.36, 0.2), N, 0.42, 0.3, [pl.uv[0], pl.uv[1], pl.uv[2] * 0.5, pl.uv[3]], 1.1); }
  }

  // ---------------------------------------------------------------- blade signs, fascias, halos
  function haloQuad(C, N, w, h, glow, k) {
    halo.set({ col: glow.map(v => v * k) });
    signQuad(halo, C, N, w, h, [0, 0, 1, 1], glow.map(v => v * k));
  }
  function blade(lot, Wl, a, y0, H, entry) {
    const { O, T, N } = Wl;
    const w = H / 4.9, out0 = 0.25, out1 = out0 + w;
    const ox = (o) => [O[0] + T[0] * a + N[0] * o, O[2] + T[2] * a + N[2] * o];
    const [cx, cz] = ox((out0 + out1) / 2);
    // casing (dark box, 0.26 thick along T) + two arms to the wall
    prop.set({ col: hex(0x18181a), rm: [0.5, 0.4, 0] });
    const hx = Math.abs(T[0]) * 0.13 + Math.abs(N[0]) * w / 2, hz = Math.abs(T[2]) * 0.13 + Math.abs(N[2]) * w / 2;
    prop.box(cx - hx, y0 - 0.06, cz - hz, cx + hx, y0 + H + 0.06, cz + hz);
    for (const yy of [y0 + 0.4, y0 + H - 0.4]) { const [ax, az] = ox(out0 / 2); const ahx = Math.abs(T[0]) * 0.04 + Math.abs(N[0]) * out0 / 2, ahz = Math.abs(T[2]) * 0.04 + Math.abs(N[2]) * out0 / 2; prop.box(ax - ahx, yy - 0.04, az - ahz, ax + ahx, yy + 0.04, az + ahz); }
    const k = entry.neon ? 2.0 : 1.4;
    signQuad(sign, [cx + T[0] * 0.135, y0 + H / 2, cz + T[2] * 0.135], T, w, H, entry.uv, k);
    signQuad(sign, [cx - T[0] * 0.135, y0 + H / 2, cz - T[2] * 0.135], [-T[0], 0, -T[2]], w, H, entry.uv, k);
    // the light it throws on the wall, and down on the pavement
    const [wx, wz] = ox(0.03);
    haloQuad([wx, y0 + H / 2, wz], N, w * 3.0, H + 2.4, entry.glow, entry.neon ? 0.22 : 0.1);
    lights.push({ x: cx + N[0] * 1.5, z: cz + N[2] * 1.5, r: 3.4, color: entry.glow, k: entry.neon ? 0.45 : 0.25 });
    glows.push({ p: [cx, y0 + H / 2, cz], color: entry.glow.map(v => v * (entry.neon ? 0.55 : 0.3)), size: H * 0.9, far: true, dusk: false });
  }
  // the zakkyo tenant tower: one backlit plate per floor, stacked up a projecting frame at the building's edge
  function directory(lot, Wl, a) {
    const { O, T, N } = Wl;
    const w = 0.95, out0 = 0.3, out1 = out0 + w;
    const ox = (o) => [O[0] + T[0] * a + N[0] * o, O[2] + T[2] * a + N[2] * o];
    const [cx, cz] = ox((out0 + out1) / 2);
    const y0 = GROUND_H + 0.25, y1 = Math.min(lot.h - 0.4, y0 + lot.floors * lot.floorH);
    const ph = Math.min(1.25, lot.floorH * 0.36), n = Math.max(2, Math.floor((y1 - y0) / (ph + 0.06)));
    const top = y0 + n * (ph + 0.06);
    prop.set({ col: hex(0x1c1c1e), rm: [0.5, 0.4, 0] });
    const hx = Math.abs(T[0]) * 0.12 + Math.abs(N[0]) * (w / 2 + 0.06), hz = Math.abs(T[2]) * 0.12 + Math.abs(N[2]) * (w / 2 + 0.06);
    prop.box(cx - hx, y0 - 0.1, cz - hz, cx + hx, top + 0.25, cz + hz);
    for (const yy of [y0 + 0.5, (y0 + top) / 2, top - 0.3]) { const [ax, az] = ox(out0 / 2); const ahx = Math.abs(T[0]) * 0.04 + Math.abs(N[0]) * out0 / 2, ahz = Math.abs(T[2]) * 0.04 + Math.abs(N[2]) * out0 / 2; prop.box(ax - ahx, yy - 0.04, az - ahz, ax + ahx, yy + 0.04, az + ahz); }
    // a lit cap with the building's name on top
    const cap = pickOf(SE.plate);
    for (const s_ of [1, -1]) {
      const Ns = [T[0] * s_, 0, T[2] * s_];
      for (let i = 0; i < n; i++) { const p = pickOf(S2.plate); signQuad(sign2, [cx + T[0] * 0.125 * s_, y0 + i * (ph + 0.06) + ph / 2, cz + T[2] * 0.125 * s_], Ns, w, ph, p.uv, 1.3); }
      signQuad(sign, [cx + T[0] * 0.125 * s_, top + 0.12, cz + T[2] * 0.125 * s_], Ns, w, 0.22, [cap.uv[0], cap.uv[1], cap.uv[2] * 0.55, cap.uv[3]], 1.2);
    }
    const [wx, wz] = ox(0.03);
    haloQuad([wx, (y0 + top) / 2, wz], N, w * 2.6, top - y0 + 1.5, [1.2, 1.15, 1.1], 0.07);
    lights.push({ x: cx + N[0] * 1.4, z: cz + N[2] * 1.4, r: 3, color: [1.2, 1.15, 1.1], k: 0.3 });
    glows.push({ p: [cx, (y0 + top) / 2, cz], color: [0.35, 0.33, 0.3], size: (top - y0) * 0.8, far: true });
  }
  // characters stuck on the window glass, lit by the room behind (added: only the letters show)
  function windowLetters(lot, Wl, f) {
    const { O, T, N, L } = Wl;
    const e = pickOf(S2.win), w = Math.min(L * 0.7, 5.5), hh = w / 2.9;
    const y = GROUND_H + f * lot.floorH + lot.floorH * 0.55;
    const C = [O[0] + T[0] * L / 2 + N[0] * 0.04, y, O[2] + T[2] * L / 2 + N[2] * 0.04];
    signQuad(win2, C, N, w, hh, e.uv, 1.5);
  }
  // a whole-facade backlit poster over a few floors
  function poster(lot, Wl) {
    const { O, T, N, L } = Wl;
    const e = pickOf(S2.poster), w = Math.min(L * 0.82, 11), hh = w * 1.4;
    const y = GROUND_H + 1.5 + hh / 2; if (y + hh / 2 > lot.h - 1) return false;
    const C = [O[0] + T[0] * L / 2 + N[0] * 0.25, y, O[2] + T[2] * L / 2 + N[2] * 0.25];
    prop.set({ col: hex(0x161618), rm: [0.5, 0.4, 0] });
    const hx = Math.abs(T[0]) * (w / 2 + 0.15) + Math.abs(N[0]) * 0.15, hz = Math.abs(T[2]) * (w / 2 + 0.15) + Math.abs(N[2]) * 0.15;
    prop.box(C[0] - N[0] * 0.12 - hx, y - hh / 2 - 0.15, C[2] - N[2] * 0.12 - hz, C[0] - N[0] * 0.12 + hx, y + hh / 2 + 0.15, C[2] - N[2] * 0.12 + hz);
    signQuad(sign2, [C[0] + N[0] * 0.04, y, C[2] + N[2] * 0.04], N, w, hh, e.uv, 1.25);
    haloQuad([C[0] - N[0] * 0.2, y, C[2] - N[2] * 0.2], N, w * 1.3, hh * 1.2, e.glow, 0.08);
    lights.push({ x: C[0] + N[0] * 5, z: C[2] + N[2] * 5, r: w, color: e.glow, k: 0.3 });
    glows.push({ p: C, color: e.glow.map(v => v * 0.25), size: w, far: true });
    return true;
  }
  function signsFor(lot, Wl) {
    const { L } = Wl;
    const y0 = GROUND_H + 0.5;
    const a = rng() < 0.5 ? 0.55 : L - 0.55;
    const nearX = Math.hypot((lot.x0 + lot.x1) / 2, (lot.z0 + lot.z1) / 2) < 75;
    const big = L >= 7 && lot.floors >= 5 && rng() < (nearX ? 0.5 : 0.16) && poster(lot, Wl);
    // the edge: a tenant directory tower (most), or a tall single-tenant blade (karaoke, ramen, a bar)
    const k = rng();
    if (k < 0.58 && lot.floors >= 3) directory(lot, Wl, a);
    else if (k < 0.93) {
      const H = R(4.2, 6.6);
      if (y0 + H < lot.h - 0.5) blade(lot, Wl, a, y0, H, pickBlade());
      let yy = y0 + H + 0.5;
      while (lot.h > yy + 3.5 && rng() < 0.55) { const H2 = Math.min(R(3.6, 6), lot.h - yy - 0.6); blade(lot, Wl, a, yy, H2, pickBlade()); yy += H2 + 0.5; }
    }
    if (!big && L > 8 && rng() < 0.4 && lot.floors >= 3) { if (rng() < 0.5) directory(lot, Wl, L - a); else if (y0 + 5 < lot.h) blade(lot, Wl, L - a, y0 + R(0, 2), R(3.5, 5.5), pickBlade()); }
    // lettering on the windows of a floor or two; the odd tenant box across a floor
    if (!big) for (let f = 0; f < Math.min(3, lot.floors - 1); f++) if (rng() < 0.32) windowLetters(lot, Wl, f);
    if (!big && rng() < 0.22 && lot.floors >= 3) {
      const f = 1 + Math.floor(rng() * Math.min(3, lot.floors - 1));
      const y = GROUND_H + (f - 1) * lot.floorH + lot.floorH * 0.5;
      const e = pickFascia(), w = Math.min(L * R(0.5, 0.75), 7), hh = Math.min(w / 4.27, lot.floorH * 0.6);
      const { O, T, N } = Wl;
      const C = [O[0] + T[0] * L / 2 + N[0] * 0.12, y, O[2] + T[2] * L / 2 + N[2] * 0.12];
      signQuad(sign, C, N, w, hh, e.uv, e.neon ? 1.8 : 1.3);
      if (e.neon) haloQuad([C[0] - N[0] * 0.08, y, C[2] - N[2] * 0.08], N, w * 1.3, hh + 2, e.glow, 0.16);
    }
    if (lot.h < 34 && L > 7 && rng() < 0.36 && !lot.noBill) billboard(lot, Wl);
  }
  // K-FRONT (the QFRONT stand-in): the giant screen covers its crossing face; a café band at 2F under it,
  // the brand band at street level, a vertical name at the corner
  function kfront(lot, Wl) {
    const { O, T, N, L } = Wl;
    const at = (a, y, out = 0) => [O[0] + T[0] * a + N[0] * out, y, O[2] + T[2] * a + N[2] * out];
    signQuad(sign2, at(L / 2, 3.6, 0.36), N, L - 1.2, 1.1, S2.band[0].uv, 1.4);
    // the café floor under the screen: warm, a long counter, silhouettes against the window
    prop.set({ col: hex(0xd8a868), rm: [0.5, 0, 1.0] }); const c0 = at(0.6, 4.6, -1.6), c1 = at(L - 0.6, 7.9, -1.5);
    prop.box(Math.min(c0[0], c1[0]), 4.6, Math.min(c0[2], c1[2]), Math.max(c0[0], c1[0]), 7.9, Math.max(c0[2], c1[2]), { faces: N[2] > 0 ? 'Z' : 'z' });
    prop.set({ col: hex(0x1a1410), rm: [0.6, 0, 0] }); for (let a = 1.5; a < L - 1; a += 1.7) { const p = at(a, 5.2, -1.0); prop.box(p[0] - 0.2, 4.6, p[2] - 0.2, p[0] + 0.2, 5.6 + (a % 3 > 1.5 ? 0.3 : 0), p[2] + 0.2); }
    panes.push({ c: at(L / 2, 6.25, 0.05), n: N, w: L - 1, h: 3.1, kind: 'lobby' });
    lights.push({ x: at(L / 2, 0, 3)[0], z: at(L / 2, 0, 3)[2], w: L, d: 5, ang: Math.atan2(T[2], T[0]), color: [1.6, 1.2, 0.8], k: 0.6 });
    // the vertical K-FRONT name at the west corner (both faces)
    const e = S2.band[0];
    signQuad(sign2, [O[0] - 0.45, 18, O[2] - N[2] * 0.8], [-1, 0, 0], 14, 1.4, e.uv, 1.5, [0, 0, 1]);
    prop.set({ col: hex(0x161618), rm: [0.5, 0.4, 0] }); prop.box(O[0] - 0.42, 10.8, O[2] - N[2] * 0.8 - 0.8, O[0], 25.2, O[2] - N[2] * 0.8 + 0.8);
  }
  function billboard(lot, Wl) {
    const { O, T, N, L } = Wl, h = lot.h;
    const w = Math.min(L - 1, 11), hh = w / 3, y0 = h + 1.6;
    const back = 2.2;
    const C = [O[0] + T[0] * L / 2 - N[0] * back, y0 + hh / 2, O[2] + T[2] * L / 2 - N[2] * back];
    const e = pickOf(SE.panel.filter(p => p.kind !== 'station'));
    // truss legs + catwalk
    prop.set({ col: hex(0x3a3c40), rm: [0.6, 0.6, 0] });
    for (const s of [-0.45, 0, 0.45]) for (const d of [0, 1.6]) { const x = C[0] + T[0] * w * s - N[0] * d, z = C[2] + T[2] * w * s - N[2] * d; prop.box(x - 0.1, h, z - 0.1, x + 0.1, y0 + hh, z + 0.1); }
    for (const d of [0, 1.6]) { const a = [C[0] - T[0] * w / 2 - N[0] * d, C[2] - T[2] * w / 2 - N[2] * d], b = [C[0] + T[0] * w / 2 - N[0] * d, C[2] + T[2] * w / 2 - N[2] * d]; prop.tube([a[0], y0 + hh * 0.5, a[1]], [b[0], y0 + hh * 0.5, b[1]], 0.06, 5); prop.tube([a[0], h + 0.8, a[1]], [b[0], y0 + hh, b[1]], 0.05, 5); }
    prop.set({ col: hex(0x222326), rm: [0.6, 0.4, 0] });
    const hx = Math.abs(T[0]) * w / 2 + Math.abs(N[0]) * 0.15, hz = Math.abs(T[2]) * w / 2 + Math.abs(N[2]) * 0.15;
    prop.box(C[0] - hx, y0 - 0.1, C[2] - hz, C[0] + hx, y0 + hh + 0.1, C[2] + hz);
    signQuad(sign, [C[0] + N[0] * 0.17, C[1], C[2] + N[2] * 0.17], N, w, hh, e.uv, 0.95);
    // floodlights on arms in front: warm cones up the face
    for (const s of [-0.3, 0.3]) { const p = [C[0] + T[0] * w * s + N[0] * 1.0, y0 - 0.2, C[2] + T[2] * w * s + N[2] * 1.0]; glows.push({ p, color: [2.2, 2.0, 1.7], size: 0.6, far: true }); }
    haloQuad([C[0] + N[0] * 0.2, C[1], C[2] + N[2] * 0.2], N, w * 1.15, hh * 1.4, [1, 0.95, 0.85], 0.08);
  }
  function roofClutter(lot) {
    const { x0, z0, x1, z1, h } = lot;
    const n = Math.floor(R(1, 4));
    for (let i = 0; i < n; i++) {
      const x = R(x0 + 1.5, x1 - 1.5), z = R(z0 + 1.5, z1 - 1.5), t = rng();
      if (t < 0.35) { prop.set({ col: hex(0xb8b4aa), rm: [0.7, 0.2, 0] }); prop.cyl(x, h, z, 1.1, 1.1, h + 2.4, 10); prop.set({ col: hex(0x5a5a5a), rm: [0.7, 0.5, 0] }); for (const [dx, dz] of [[-0.8, -0.8], [0.8, 0.8]]) prop.box(x + dx - 0.08, h, z + dz - 0.08, x + dx + 0.08, h + 0.9, z + dz + 0.08); }
      else if (t < 0.75) { prop.set({ col: hex(0xc8c6be), rm: [0.6, 0.3, 0] }); prop.box(x - 0.5, h, z - 0.35, x + 0.5, h + 0.75, z + 0.35); prop.set({ col: hex(0x303030), rm: [0.8, 0, 0] }); prop.cyl(x, h + 0.75, z, 0.3, 0.3, h + 0.78, 8); }
      else { prop.set({ col: hex(0x6a6a6a), rm: [0.5, 0.7, 0] }); prop.tube([x, h, z], [x, h + R(3, 7), z], 0.05, 5); }
    }
    // aviation lights on the tall ones
    if (h > 38) for (const [x, z] of [[x0 + 0.5, z0 + 0.5], [x1 - 0.5, z1 - 0.5]]) glows.push({ p: [x, h + 1.4, z], color: [3.2, 0.25, 0.15], size: 0.8, blink: true, rate: 2.2, far: true });
  }

  // ---------------------------------------------------------------- blocks -> lots
  for (const B of BLOCKS) {
    const [bx0, bz0, bx1, bz1] = B.r;
    if (B.far) { farBlock(B); continue; }
    const done = [];
    for (const f of B.faces) {
      const hot = (B.hot || '').includes(f);
      const deep = (f === 's' || f === 'n') ? bz1 - bz0 : bx1 - bx0;
      const D = Math.min(15, deep / (B.faces.includes(opposite(f)) ? 2 : 1));
      const len = (f === 's' || f === 'n') ? bx1 - bx0 : bz1 - bz0;
      let a0 = 0, a1 = len;
      for (const g of done) { const e = ADJ[f][g.f]; if (e === 0) a0 = g.D; if (e === 1) a1 = len - g.D; }
      if (B.tower) { // the corner tower: one lot for the whole block, fronts on both streets
        if (done.length) continue;
        const t = lot({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, face: f, corner: B.faces[1], hot: true, h: 33, style: FCELL.curtain, tower: true, lit: 0.8, noBill: true, shop: true });
        if (t) t.isTower = true;
        done.push({ f, D: 99 });
        continue;
      }
      let a = a0;
      while (a < a1 - 0.5) {
        let w = rng() < 0.2 ? R(5.5, 7) : R(7, 13.5);
        if (a1 - (a + w) < 5) w = a1 - a;
        const b = Math.min(a1, a + w);
        const r = faceRect(B.r, f, a, b, D);
        const isCorner = (a === a0 && a0 === 0 && B.faces.includes(prevFace(f))) ? prevFace(f) : (b === a1 && a1 === len && B.faces.includes(nextFace(f)) ? nextFace(f) : null);
        lot({ ...r, face: f, hot, corner: isCorner && !done.find(d => d.f === isCorner) ? isCorner : undefined });
        a = b;
      }
      done.push({ f, D });
    }
  }
  function opposite(f) { return { s: 'n', n: 's', e: 'w', w: 'e' }[f]; }
  function prevFace(f) { return { s: 'w', n: 'e', e: 's', w: 'n' }[f]; }   // the face met at along = 0
  function nextFace(f) { return { s: 'e', n: 'w', e: 'n', w: 's' }[f]; }   // the face met at along = len
  function faceRect([x0, z0, x1, z1], f, a, b, D) {
    if (f === 's') return { x0: x0 + a, x1: x0 + b, z0: z1 - D, z1 };
    if (f === 'n') return { x0: x1 - b, x1: x1 - a, z0, z1: z0 + D };
    if (f === 'e') return { x0: x1 - D, x1, z0: z1 - b, z1: z1 - a };
    return { x0, x1: x0 + D, z0: z0 + a, z1: z0 + b };
  }
  // far skyline: tall office towers / apartment slabs facing the player, dim, with aviation lights
  function farBlock(B) {
    const [bx0, bz0, bx1, bz1] = B.r;
    const f = B.faces[0];
    const len = (f === 's' || f === 'n') ? bx1 - bx0 : bz1 - bz0;
    let a = 0, row = 0;
    while (a < len - 4) {
      const w = R(14, 34), b = Math.min(len, a + w);
      const D = R(14, 28);
      const r = faceRect(B.r, f, a, b, D);
      const snp = sniperIn(r.x0, r.z0, r.x1, r.z1);
      const back = snp ? 0 : row % 2 ? R(4, 30) : 0;
      if (f === 's') { r.z0 -= back; r.z1 -= back; } else if (f === 'n') { r.z0 += back; r.z1 += back; } else if (f === 'w') { r.x0 += back; r.x1 += back; } else { r.x0 -= back; r.x1 -= back; }
      const tall = rng() < 0.3;
      const near = !!snp || (B.hot && back < 1 && rng() < 0.7);
      lot({ ...r, face: f, hot: near, far: !near, h: near ? R(18, 34) : tall ? R(60, 130) : R(24, 60), style: near ? undefined : weighted(rng, [[FCELL.farGrid, 3], [FCELL.farGrid2, 2], [FCELL.curtain, 1], [FCELL.balcony, 2], [FCELL.office, 2]]) });
      a = b + (near ? 0 : R(0, 6)); row++;
    }
  }

  // ---------------------------------------------------------------- the giant screens
  const screens = [];
  const addScreen = (x, y, z, ny, w, h, seed, panels) => {
    const S = buildScreen(w, h, { seed, panels });
    S.root.position.set(x, y, z); S.root.rotation.y = ny; S.root.updateMatrixWorld(true);
    screens.push(S);
    // frame + maintenance catwalk under it
    const N = [Math.sin(ny), 0, Math.cos(ny)], T = [Math.cos(ny), 0, -Math.sin(ny)];
    prop.set({ col: hex(0x161618), rm: [0.5, 0.5, 0] });
    const ext = (u, v, o) => [x + T[0] * u + N[0] * o, y + v, z + T[2] * u + N[2] * o];
    const bx = (u0, v0, o0, u1, v1, o1) => { const a = ext(u0, v0, o0), b = ext(u1, v1, o1); prop.box(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])); };
    bx(-w / 2 - 0.35, -h / 2 - 0.35, -0.6, w / 2 + 0.35, h / 2 + 0.35, -0.02);
    bx(-w / 2 - 0.35, -h / 2 - 0.55, -0.6, w / 2 + 0.35, -h / 2 - 0.35, 0.9);
    bx(-w / 2 - 0.35, h / 2 + 0.35, -0.6, w / 2 + 0.35, h / 2 + 0.5, 1.3);
    haloQuad(ext(0, 0, -0.03), N, w * 1.5, h * 1.6, [1.2, 0.8, 1.0], 0.12);
    lights.push({ x: x + N[0] * 14, z: z + N[2] * 14, r: w * 1.2, color: [1.0, 0.75, 0.95], k: 0.35 });
    glows.push({ p: ext(0, 0, 0.3), color: [0.6, 0.45, 0.6], size: w * 1.1, far: true });
    return S;
  };
  for (const S of SCREENS) addScreen(...S);

  // ---------------------------------------------------------------- meshes
  const root = new THREE.Group(); root.name = 'city';
  const facMat = facadeMaterial();
  const mFac = fac.mesh(facMat, { shadow: false }); root.add(mFac);
  const propMat = rmMat({ roughness: 1 });
  const mProp = prop.mesh(propMat, { shadow: true }); root.add(mProp);
  const mSign = sign.mesh(signMaterial()); mSign.renderOrder = 2; root.add(mSign);
  const mHalo = halo.mesh(haloMaterial()); mHalo.renderOrder = 6; mHalo.receiveShadow = false; root.add(mHalo);
  const a2 = signAtlas2().tex;
  const mS2 = sign2.mesh(signMat(a2)); mS2.renderOrder = 2; root.add(mS2);
  const mW2 = win2.mesh(new THREE.MeshBasicMaterial({ visible: !DAY.on, map: a2, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })); mW2.renderOrder = 5; root.add(mW2);
  for (const S of screens) root.add(S.root);
  let t = 0;
  const update = (dt) => { t += dt; for (const S of screens) S.update(t); };
  return { root, colliders, panes, lots, screens, anchors: { glows, lights }, update, facMat, info: { tris: fac.tris + prop.tris + sign.tris + halo.tris, lots: lots.length } };
}
