import * as THREE from 'three';
import { makeNoise, fbm, makeCanvas, canvasTex, heightToNormal } from '../../textures.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  LIGHTS OUT — tiling surface textures (canvas, generated at load). Every map is world-scaled:
//  the size in metres one tile covers is in TS (geometry uses uv = metres / TS[key]).
//  Chongqing's surfaces: board-marked concrete retaining walls streaked black with rain and green
//  with moss, worn granite steps, wet asphalt, stained plaster, dark timber, grey clay tile roofs,
//  layered sandstone.
// =====================================================================================
export const TS = { concrete: 4, stone: 3, asphalt: 6, plaster: 4, wood: 2, roof: 2.4, rock: 9, tile: 2, metal: 3, steel: 3, deck: 2, granite: 1.6 };
const S = 512;

function px(c) { const x = c.getContext('2d'); return { x, img: x.createImageData(c.width, c.height) }; }
const cl = (v) => Math.max(0, Math.min(255, v));

// ---------------------------------------------------------------- board-marked concrete (retaining walls, piers, decks)
export function concreteTex(seed = 11) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 32), n3 = makeNoise(seed + 2, 64), n4 = makeNoise(seed + 3, 16);
  const r = makeRng(seed);
  // vertical rain streaks (per column strength)
  const streak = new Float32Array(S); for (let i = 0; i < S; i++) streak[i] = 0;
  for (let k = 0; k < 70; k++) { const x0 = Math.floor(r() * S), w = 1 + Math.floor(r() * 7), a = 0.2 + r() * 0.8; for (let i = -w; i <= w; i++) streak[(x0 + i + S) % S] += a * (1 - Math.abs(i) / (w + 1)); }
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const big = fbm(n1, u, v, 2, 4), mid = fbm(n2, u, v, 8, 3), fine = n3(u * 64, v * 64);
    // board marks: horizontal boards every 1/8 of the tile (0.5 m), with tie holes
    const bv = (v * 8) % 1, board = Math.min(bv, 1 - bv) < 0.025 ? 1 : 0;
    const bx = (u * 4 + Math.floor(v * 8) * 0.37) % 1;
    const tie = (Math.hypot((bx - 0.5) * 2.1, (bv - 0.5) * 1.0) < 0.06) ? 1 : 0;
    const st = Math.min(1, streak[xx] * (0.45 + 0.55 * fbm(n4, u, v * 0.3, 4, 2)) * (0.6 + 0.4 * v));
    let L = 0.53 + (big - 0.5) * 0.22 + (mid - 0.5) * 0.12 + (fine - 0.5) * 0.06;
    L -= board * 0.07 + tie * 0.25;
    L *= 1 - st * 0.42;
    const moss = Math.max(0, (fbm(n2, u + 0.3, v, 4, 3) - 0.56) * 3.2) * (0.4 + 0.6 * v);
    const i4 = (y * S + xx) * 4;
    d[i4] = cl(L * 236 * (1 - moss * 0.35)); d[i4 + 1] = cl(L * 232 * (1 + moss * 0.05)); d[i4 + 2] = cl(L * 222 * (1 - moss * 0.45)); d[i4 + 3] = 255;
    H[y * S + xx] = big * 0.3 + fine * 0.15 - board * 0.5 - tie * 0.8;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 2.2) };
}

// ---------------------------------------------------------------- granite slabs (steps, paving, gallery floors)
export function stoneTex(seed = 21) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 16), n2 = makeNoise(seed + 1, 64), n3 = makeNoise(seed + 5, 8);
  const rows = 5, cols = [3, 4, 3, 5, 4];
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const row = Math.floor(v * rows), rv = (v * rows) % 1;
    const nc = cols[row], off = row * 0.37;
    const cu = ((u + off) * nc) % 1, cid = Math.floor((u + off) * nc) + row * 17;
    const jx = Math.min(cu, 1 - cu) * S / nc, jy = Math.min(rv, 1 - rv) * S / rows;
    const joint = Math.min(jx, jy) < 2.2 ? 1 : 0;
    const tint = ((cid * 7919) % 97) / 97;
    const sp = n2(u * 64, v * 64);
    let L = 0.5 + (tint - 0.5) * 0.12 + (fbm(n1, u, v, 4, 3) - 0.5) * 0.2 + (sp - 0.5) * 0.14;
    // worn centres: slightly lighter, polished
    L += 0.05 * Math.sin(cu * Math.PI) * Math.sin(rv * Math.PI);
    L *= joint ? 0.42 : 1;
    const dirt = Math.max(0, fbm(n3, u, v, 2, 3) - 0.55) * 1.4;
    L *= 1 - dirt * 0.3;
    const i4 = (y * S + xx) * 4;
    d[i4] = cl(L * 222); d[i4 + 1] = cl(L * 214); d[i4 + 2] = cl(L * 204); d[i4 + 3] = 255;
    H[y * S + xx] = joint ? -0.8 : sp * 0.2 + tint * 0.1;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 2.6) };
}

// ---------------------------------------------------------------- asphalt (wet, patched)
export function asphaltTex(seed = 31) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data;
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 128), n3 = makeNoise(seed + 2, 16);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const agg = n2(u * 128, v * 128);
    let L = 0.2 + (fbm(n1, u, v, 2, 4) - 0.5) * 0.08 + Math.max(0, agg - 0.72) * 0.07 + (agg - 0.5) * 0.03;
    const patch = fbm(n3, u, v, 3, 2); if (patch > 0.6) L *= 0.82;
    const i4 = (y * S + xx) * 4;
    d[i4] = cl(L * 255); d[i4 + 1] = cl(L * 250); d[i4 + 2] = cl(L * 246); d[i4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c) };
}

// ---------------------------------------------------------------- old plaster / painted render (stained, patched)
export function plasterTex(seed = 41) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 32), n3 = makeNoise(seed + 2, 128);
  const r = makeRng(seed);
  const streak = new Float32Array(S);
  for (let k = 0; k < 40; k++) { const x0 = Math.floor(r() * S), w = 2 + Math.floor(r() * 10), a = 0.2 + r() * 0.6; for (let i = -w; i <= w; i++) streak[(x0 + i + S) % S] += a * (1 - Math.abs(i) / (w + 1)); }
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const big = fbm(n1, u, v, 2, 4), mid = fbm(n2, u, v, 6, 3), fine = n3(u * 128, v * 128);
    const peel = mid > 0.64 ? 1 : 0;
    let L = 0.8 + (big - 0.5) * 0.16 + (fine - 0.5) * 0.05;
    L *= 1 - Math.min(0.5, streak[xx] * (0.3 + 0.7 * fbm(n2, u, v * 0.25, 3, 2)) * 0.6);
    let rr = L, gg = L * 0.97, bb = L * 0.9;
    if (peel) { rr *= 0.72; gg *= 0.66; bb *= 0.6; }   // the brick / render underneath
    const i4 = (y * S + xx) * 4;
    d[i4] = cl(rr * 245); d[i4 + 1] = cl(gg * 245); d[i4 + 2] = cl(bb * 245); d[i4 + 3] = 255;
    H[y * S + xx] = peel ? -0.4 : fine * 0.15;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 1.6) };
}

// ---------------------------------------------------------------- dark timber boards (stilt houses)
export function woodTex(seed = 51) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 64);
  const boards = 8;
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const b = Math.floor(u * boards), bu = (u * boards) % 1;
    const gap = Math.min(bu, 1 - bu) < 0.03 ? 1 : 0;
    const tone = ((b * 4337) % 53) / 53;
    const grain = n2(u * 16 + b * 3.1, v * 64 * 0.25) * 0.6 + n2(u * 64, v * 4) * 0.4;
    let L = 0.42 + (tone - 0.5) * 0.14 + (grain - 0.5) * 0.18 + (fbm(n1, u, v, 2, 3) - 0.5) * 0.1;
    L *= gap ? 0.35 : 1;
    const i4 = (y * S + xx) * 4;
    d[i4] = cl(L * 200); d[i4 + 1] = cl(L * 150); d[i4 + 2] = cl(L * 112); d[i4 + 3] = 255;
    H[y * S + xx] = gap ? -0.6 : grain * 0.25;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 1.8) };
}

// ---------------------------------------------------------------- grey clay tile roof (u across the slope, v up it)
export function roofTex(seed = 61) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 16), n2 = makeNoise(seed + 1, 64);
  const cols = 12, rows = 10;
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const cu = (u * cols) % 1, rv = (v * rows) % 1, col = Math.floor(u * cols), row = Math.floor(v * rows);
    // alternating channels (concave pan tiles) and ridges (convex covers)
    const ridge = Math.cos(cu * Math.PI * 2);
    const lap = rv < 0.12 ? (1 - rv / 0.12) : 0;   // the lower tile's lip shadow
    const h = ridge * 0.5 + lap * 0.4;
    const tone = ((col * 131 + row * 71) % 37) / 37;
    let L = 0.34 + h * 0.08 + (tone - 0.5) * 0.06 + (fbm(n1, u, v, 4, 3) - 0.5) * 0.16 - lap * 0.12;
    const moss = Math.max(0, fbm(n2, u, v, 6, 2) - 0.6) * 2;
    const i4 = (y * S + xx) * 4;
    d[i4] = cl(L * 230 * (1 - moss * 0.3)); d[i4 + 1] = cl(L * 232); d[i4 + 2] = cl(L * 236 * (1 - moss * 0.4)); d[i4 + 3] = 255;
    H[y * S + xx] = h;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 3.2) };
}

// ---------------------------------------------------------------- layered sandstone (the gorge walls)
export function rockTex(seed = 71) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 32), n3 = makeNoise(seed + 2, 4);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const warp = fbm(n3, u, v, 1, 3) * 0.15;
    const band = Math.sin((v + warp) * Math.PI * 2 * 9) * 0.5 + 0.5, band2 = Math.sin((v + warp * 1.7) * Math.PI * 2 * 23) * 0.5 + 0.5;
    const big = fbm(n1, u, v, 2, 4), cr = fbm(n2, u * 1.5, v, 6, 3);
    const crack = Math.abs(cr - 0.5) < 0.012 ? 1 : 0;
    let L = 0.42 + (big - 0.5) * 0.25 + band * 0.08 + band2 * 0.04;
    L *= crack ? 0.45 : 1;
    const wet = Math.max(0, fbm(n2, u, v * 0.3, 3, 2) - 0.55) * 1.8;
    L *= 1 - wet * 0.35;
    const moss = Math.max(0, fbm(n1, u + 0.4, v + 0.2, 6, 3) - 0.58) * 2.4;
    const i4 = (y * S + xx) * 4;
    d[i4] = cl(L * 236 * (1 - moss * 0.45)); d[i4 + 1] = cl(L * 206 * (1 - moss * 0.08)); d[i4 + 2] = cl(L * 168 * (1 - moss * 0.5)); d[i4 + 3] = 255;
    H[y * S + xx] = big * 0.6 + band * 0.3 - crack * 0.6;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 3.0) };
}

// ---------------------------------------------------------------- small ceramic facade tiles (old Chongqing blocks)
export function tileTex(seed = 81) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data;
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 32);
  const g = 24;
  const r = makeRng(seed); const streak = new Float32Array(S); for (let k = 0; k < 50; k++) { const x0 = Math.floor(r() * S), w = 1 + Math.floor(r() * 6), a = 0.3 + r() * 0.7; for (let i = -w; i <= w; i++) streak[(x0 + i + S) % S] += a * (1 - Math.abs(i) / (w + 1)); }
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const tu = (u * g) % 1, tv = (v * g * 1.5) % 1;
    const grout = Math.min(tu, 1 - tu) < 0.06 || Math.min(tv, 1 - tv) < 0.09;
    const tone = (((Math.floor(u * g) * 31 + Math.floor(v * g * 1.5) * 17) % 23) / 23 - 0.5) * 0.06;
    let L = (grout ? 0.62 : 0.86) + tone + (fbm(n1, u, v, 2, 3) - 0.5) * 0.12;
    L *= 1 - Math.min(0.3, streak[xx] * fbm(n2, u, v * 0.3, 3, 2) * 0.35);
    const i4 = (y * S + xx) * 4;
    d[i4] = cl(L * 236); d[i4 + 1] = cl(L * 232); d[i4 + 2] = cl(L * 222); d[i4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c) };
}

// ---------------------------------------------------------------- painted steel (bridges, railings, signs' backs)
export function metalTex(seed = 91) {
  const c = makeCanvas(256, 256), x = c.getContext('2d'), img = x.createImageData(256, 256), d = img.data;
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 64);
  for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) {
    const u = xx / 256, v = y / 256;
    let L = 0.78 + (fbm(n1, u, v, 2, 4) - 0.5) * 0.3 + (n2(u * 64, v * 64) - 0.5) * 0.06;
    const rust = Math.max(0, fbm(n1, u + 0.5, v, 4, 3) - 0.62) * 2.5;
    const i4 = (y * 256 + xx) * 4;
    d[i4] = cl(L * 245 * (1 + rust * 0.1)); d[i4 + 1] = cl(L * 245 * (1 - rust * 0.35)); d[i4 + 2] = cl(L * 245 * (1 - rust * 0.6)); d[i4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c) };
}

// ---------------------------------------------------------------- painted ship steel (the gunboat, the barges): welded plates
// (1.5 × 1 m), seams with a highlight above and a shadow below, chipped paint showing primer and rust, rust weeping DOWN
// from the seams and the fixings, rain streaks. Near-neutral grey: vertex colours tint it.
export function steelTex(seed = 61) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 32), n3 = makeNoise(seed + 2, 128), n4 = makeNoise(seed + 3, 16);
  const r = makeRng(seed);
  // rust runs: start on a horizontal seam or a random fixing, run down the canvas (= down the wall)
  const runs = new Float32Array(S * S);
  for (let k = 0; k < 40; k++) {
    const x0 = Math.floor(r() * S), y0 = r() < 0.75 ? Math.floor(Math.floor(r() * 3) * S / 3) : Math.floor(r() * S), len = 15 + r() * 110, w = 0.6 + r() * 1.8, a = 0.2 + r() * 0.45;
    for (let yy = 0; yy < len; yy++) { const fy = (y0 + yy) % S, fall = (1 - yy / len) * a, wob = Math.sin(yy * 0.07 + k) * 1.2;
      for (let i = -Math.ceil(w); i <= Math.ceil(w); i++) { const fx = (x0 + i + Math.round(wob) + S) % S; runs[fy * S + fx] = Math.max(runs[fy * S + fx], fall * (1 - Math.abs(i) / (w + 1))); } }
  }
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S, i = y * S + xx;
    const pu = (u * 2) % 1, pv = (v * 3) % 1;                       // plates: 2 across, 3 down a 3 m tile
    const sx = Math.min(pu, 1 - pu) * S / 2, sy = Math.min(pv, 1 - pv) * S / 3;
    const seam = Math.min(sx, sy) < 1.6 ? 1 : 0, bead = Math.min(sx, sy) < 3.2 ? 1 - Math.min(sx, sy) / 3.2 : 0;
    const big = fbm(n1, u, v, 2, 4), mid = fbm(n2, u, v, 8, 3), fine = n3(u * 128, v * 128);
    const chip = Math.max(0, fbm(n4, u, v, 16, 3) - 0.66) * 5;      // paint chips
    const streak = (fbm(n2, u * 6, v * 0.4, 4, 2) - 0.5) * 0.12;   // rain streaks (stretched vertically)
    let L = 0.74 + (big - 0.5) * 0.12 + (mid - 0.5) * 0.08 + (fine - 0.5) * 0.04 + streak;
    L *= seam ? 0.55 : 1;
    // rust: a dull orange-brown (not red: bright red runs read as blood at night), mixed over the paint
    const a = Math.min(0.7, runs[i] * 0.8 + chip * 0.35 + seam * 0.12 * mid), rk = 0.65 + 0.35 * mid;
    const dark = Math.min(1, chip * 0.4), g = L * (1 - dark * 0.25);
    const R = g * (1 - a) + 0.46 * rk * a, G = g * (1 - a) + 0.3 * rk * a, Bb = g * (1 - a) + 0.18 * rk * a;
    const i4 = i * 4; d[i4] = cl(R * 255); d[i4 + 1] = cl(G * 255); d[i4 + 2] = cl(Bb * 255); d[i4 + 3] = 255;
    H[i] = bead * 0.6 - seam * 0.3 + (big - 0.5) * 0.25 - chip * 0.08 + fine * 0.04;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 2.4) };
}
// ---------------------------------------------------------------- anti-skid deck: grit, scuffed walkways, rust spots, weld lines
export function deckTex(seed = 71) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 32), n3 = makeNoise(seed + 2, 256), n4 = makeNoise(seed + 3, 16);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S, i = y * S + xx;
    const grit = n3(u * 256, v * 256), big = fbm(n1, u, v, 2, 4), mid = fbm(n2, u, v, 8, 3);
    const weld = Math.min((u * 1) % 1, 1 - (u * 1) % 1) * S < 1.4 ? 1 : 0;
    const scuff = Math.max(0, fbm(n4, u * 0.6, v * 2.2, 4, 3) - 0.48) * 1.6;      // boot wear
    const rust = Math.max(0, fbm(n4, u + 0.37, v + 0.11, 8, 3) - 0.68) * 3.5;
    let L = 0.6 + (big - 0.5) * 0.16 + (mid - 0.5) * 0.1 + (grit - 0.5) * 0.22 + scuff * 0.14;
    L *= weld ? 0.6 : 1;
    const i4 = i * 4; d[i4] = cl((L * (1 - rust * 0.2) + rust * 0.18) * 255); d[i4 + 1] = cl((L * (1 - rust * 0.5) + rust * 0.07) * 255); d[i4 + 2] = cl((L * (1 - rust * 0.7) + rust * 0.02) * 255); d[i4 + 3] = 255;
    H[i] = (grit - 0.5) * 0.5 - weld * 0.3 - scuff * 0.15;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 1.6) };
}
// ---------------------------------------------------------------- speckled granite (the Hundred Steps' treads): no joints, so it
// can run across any tread; black and white flecks, a soft mottle, polished where feet go, grime in the low spots
export function graniteTex(seed = 81) {
  const c = makeCanvas(S, S), { x, img } = px(c), d = img.data, H = new Float32Array(S * S);
  const n1 = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 64), n3 = makeNoise(seed + 2, 256), n4 = makeNoise(seed + 3, 24);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S, i = y * S + xx;
    const fleck = n3(u * 256, v * 256), f2 = n2(u * 64, v * 64), big = fbm(n1, u, v, 2, 4);
    let L = 0.66 + (big - 0.5) * 0.1 + (f2 - 0.5) * 0.1;
    if (fleck > 0.78) L *= 0.45; else if (fleck < 0.12) L *= 1.22;    // biotite / quartz
    const dirt = Math.max(0, fbm(n4, u, v, 4, 3) - 0.55) * 1.5;
    L *= 1 - dirt * 0.25;
    const pink = (fbm(n1, u + 0.4, v, 4, 2) - 0.5) * 0.06;
    const i4 = i * 4; d[i4] = cl((L + pink) * 240); d[i4 + 1] = cl(L * 232); d[i4 + 2] = cl((L - pink * 0.5) * 224); d[i4 + 3] = 255;
    H[i] = (fleck - 0.5) * 0.2 + (big - 0.5) * 0.3 - dirt * 0.2;
  }
  x.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(H, S, S, 1.2) };
}

// ---------------------------------------------------------------- one place to get them (built once)
let _T = null;
export function textures() {
  if (_T) return _T;
  _T = { concrete: concreteTex(), stone: stoneTex(), asphalt: asphaltTex(), plaster: plasterTex(), wood: woodTex(), roof: roofTex(), rock: rockTex(), tile: tileTex(), metal: metalTex(), steel: steelTex(), deck: deckTex(), granite: graniteTex() };
  return _T;
}
export { THREE };
