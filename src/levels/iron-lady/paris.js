import * as THREE from 'three';
import { makeCanvas, canvasTex, makeNoise, concreteTexture } from '../../textures.js';
import { makeRng } from '../../rng.js';
import { SNIPERS, PARK, QUAY_N, QUAY_S } from './layout.js';

// =====================================================================================
//  PARIS — the Haussmann frontage on both banks, the blocks flanking the tower park, the
//  snipers' fifth-floor balconies, and far Paris (a lit roofscape, a floodlit basilica on its
//  hill to the NNE, a gilded dome to the ESE).
//  Facades are painted bays (one 1024² atlas: 8 bay variants, albedo + lit-window emission)
//  on real relief: cornices, string courses, balcony slabs on consoles, wrought-iron rails,
//  zinc mansards with dormers, chimney stacks with pots, café awnings. Everything is merged per
//  material (≈ 9 draws). Colliders are world space.
// =====================================================================================

const BAY = 3.2;
// main river frontage: shop, entresol, étage noble, 2nd (balcony), 3rd, 4th, 5th (balcony) — cornice 22.2
const FL_MAIN = [0, 4.0, 6.6, 9.8, 13.0, 16.1, 19.2, 22.2];
const FL_LOW = [0, 4.2, 7.4, 10.5, 13.5, 16.5];
const BALC_D = 1.1, RAIL_H = 1.05;
const AW = 1024, AH = 1024, VW = AW / 8;      // atlas: 8 bay variants, each 128 px wide, 22.2 m tall
const PXM = AH / 22.2;                         // atlas pixels per metre (vertical)

// ------------------------------------------------------------------ the facade atlas (albedo + emission)
function facadeAtlas(rng) {
  const A = makeCanvas(AW, AH), E = makeCanvas(AW, AH);
  const a = A.getContext('2d'), e = E.getContext('2d');
  const noise = makeNoise(7, 256);
  e.fillStyle = '#000'; e.fillRect(0, 0, AW, AH);
  const Y = (m) => AH - m * PXM;               // metres above ground -> canvas y
  // limestone with grain
  a.fillStyle = '#d9cbb0'; a.fillRect(0, 0, AW, AH);
  const img = a.getImageData(0, 0, AW, AH), d = img.data;
  for (let i = 0; i < AW * AH; i++) {
    const x = i % AW, y = (i / AW) | 0;
    const n = (noise ? noise(x * 0.05, y * 0.05) : 0.5) * 0.18 + rng() * 0.07;
    const k = 0.86 + n;
    d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k * 0.98;
  }
  a.putImageData(img, 0, 0);
  // horizontal stone courses (fine joints), rustication on the ground floor + entresol
  a.strokeStyle = 'rgba(70,60,48,0.22)'; a.lineWidth = 1;
  for (let m = 0; m < 22.2; m += 0.55) { a.beginPath(); a.moveTo(0, Y(m)); a.lineTo(AW, Y(m)); a.stroke(); }
  a.strokeStyle = 'rgba(40,32,24,0.55)'; a.lineWidth = 3;
  for (let m = 0.6; m < 6.6; m += 0.6) { a.beginPath(); a.moveTo(0, Y(m)); a.lineTo(AW, Y(m)); a.stroke(); }
  // string-course bands (light top edge, shadow under)
  for (const m of [4.0, 6.6, 9.8, 19.2]) {
    a.fillStyle = 'rgba(245,236,214,0.6)'; a.fillRect(0, Y(m + 0.18), AW, 6);
    a.fillStyle = 'rgba(30,24,18,0.35)'; a.fillRect(0, Y(m) , AW, 7);
  }
  const lit = (p) => rng() < p;
  for (let v = 0; v < 8; v++) {
    const x0 = v * VW, cx = x0 + VW / 2;
    // ---- shop floor (0..4): café / closed shutter / boutique / carriage door
    const kind = ['cafe', 'shutter', 'boutique', 'shutter', 'door', 'cafe', 'shutter', 'boutique'][v];
    const sw = VW * 0.82, sx = cx - sw / 2;
    if (kind === 'door') {
      a.fillStyle = '#2a2a24'; a.fillRect(cx - 34, Y(3.7), 68, 3.7 * PXM);
      a.fillStyle = '#1d2a22'; a.fillRect(cx - 30, Y(3.5), 60, 3.5 * PXM);
      a.strokeStyle = 'rgba(160,140,90,0.6)'; a.lineWidth = 2; a.strokeRect(cx - 26, Y(3.3), 24, 3.0 * PXM); a.strokeRect(cx + 2, Y(3.3), 24, 3.0 * PXM);
      a.beginPath(); a.arc(cx, Y(3.5), 30, Math.PI, 0); a.fillStyle = '#1a1a16'; a.fill();
    } else {
      a.fillStyle = '#3a342c'; a.fillRect(sx - 4, Y(3.6), sw + 8, 3.4 * PXM);           // frame
      if (kind === 'shutter') {
        a.fillStyle = '#5b5c5a'; a.fillRect(sx, Y(3.4), sw, 3.2 * PXM);
        a.fillStyle = 'rgba(20,20,20,0.35)'; for (let y = Y(3.4); y < Y(0.2); y += 5) a.fillRect(sx, y, sw, 2);
        a.fillStyle = 'rgba(30,30,30,0.5)'; for (let k = 0; k < 6; k++) a.fillRect(sx + rng() * sw, Y(1.4 + rng()), 10 + rng() * 25, 6); // tags
      } else {
        a.fillStyle = '#16130f'; a.fillRect(sx, Y(3.4), sw, 3.2 * PXM);
        a.fillStyle = '#4a3c2c'; a.fillRect(cx - 2, Y(3.4), 4, 3.2 * PXM); a.fillRect(sx, Y(1.0), sw, 4); // mullion + transom
        // lit interior (emission): warm gradient, a counter, bottles / clothes rails
        const g = e.createLinearGradient(0, Y(3.4), 0, Y(0.2));
        const warm = kind === 'cafe' ? ['rgba(255,190,110,1)', 'rgba(200,110,40,1)'] : ['rgba(230,200,160,0.75)', 'rgba(140,100,70,0.75)'];
        g.addColorStop(0, warm[0]); g.addColorStop(1, warm[1]);
        e.fillStyle = g; e.fillRect(sx + 2, Y(3.35), sw - 4, 3.1 * PXM);
        e.fillStyle = 'rgba(40,20,8,0.85)'; e.fillRect(sx + 2, Y(1.1), sw - 4, 1.0 * PXM);          // counter / tables
        for (let k = 0; k < 5; k++) { e.fillStyle = 'rgba(30,15,6,0.7)'; e.fillRect(sx + 6 + rng() * (sw - 20), Y(2.2 + rng() * 0.8), 6, 18 + rng() * 14); } // people / chairs
        e.fillStyle = '#000'; e.fillRect(cx - 2, Y(3.4), 4, 3.2 * PXM); e.fillRect(sx, Y(1.0), sw, 4);
        if (kind === 'cafe') { a.fillStyle = '#c7b48a'; a.font = 'bold 15px Oswald, sans-serif'; a.textAlign = 'center'; a.fillText(['CAFÉ', 'BRASSERIE', 'TABAC', 'BISTROT'][v % 4], cx, Y(3.75)); }
      }
    }
    // ---- upper floors: tall French windows with carved surrounds
    const wins = [[4.0, 6.6, 0.7, 0.55, 0.4], [6.6, 9.8, 1.25, 0.35, 0.45], [9.8, 13.0, 1.25, 0.25, 0.4], [13.0, 16.1, 1.2, 0.25, 0.42], [16.1, 19.2, 1.15, 0.25, 0.42], [19.2, 22.2, 1.05, 0.2, 0.5]];
    for (const [f0, f1, ww, sill, pl] of wins) {
      const w = ww * 40, wx = cx - w / 2, y0 = f0 + sill, y1 = f1 - 0.55;
      // surround
      a.fillStyle = 'rgba(238,228,206,0.9)'; a.fillRect(wx - 7, Y(y1 + 0.18), w + 14, (y1 - y0 + 0.3) * PXM);
      a.fillStyle = 'rgba(60,50,38,0.4)'; a.fillRect(wx - 7, Y(y1 + 0.2), w + 14, 3);
      if (f0 === 6.6) { // the étage noble gets a pediment
        a.fillStyle = 'rgba(240,230,210,0.95)'; a.beginPath(); a.moveTo(wx - 12, Y(y1 + 0.25)); a.lineTo(cx, Y(y1 + 0.75)); a.lineTo(wx + w + 12, Y(y1 + 0.25)); a.fill();
        a.strokeStyle = 'rgba(70,58,44,0.5)'; a.lineWidth = 2; a.stroke();
      }
      // glass + frame + glazing bars
      a.fillStyle = '#1b1d22'; a.fillRect(wx, Y(y1), w, (y1 - y0) * PXM);
      a.fillStyle = '#e8e2d4'; a.fillRect(cx - 1.5, Y(y1), 3, (y1 - y0) * PXM);
      for (let k = 1; k < 4; k++) a.fillRect(wx, Y(y0 + (y1 - y0) * k / 4) - 1, w, 2);
      // window guard (garde-corps) on the floors without a continuous balcony
      if (f0 !== 9.8 && f0 !== 19.2 && f0 !== 4.0) { a.fillStyle = 'rgba(16,16,18,0.9)'; a.fillRect(wx - 3, Y(y0 + 1.0), w + 6, 3); for (let k = 0; k <= 8; k++) a.fillRect(wx - 3 + k * (w + 6) / 8, Y(y0 + 1.0), 2, 1.0 * PXM); }
      // grime streak under the sill
      const gr = a.createLinearGradient(0, Y(y0), 0, Y(y0 - 1.6));
      gr.addColorStop(0, 'rgba(40,34,26,0.35)'); gr.addColorStop(1, 'rgba(40,34,26,0)');
      a.fillStyle = gr; a.fillRect(wx + w * 0.2, Y(y0), w * 0.6, 1.6 * PXM);
      // emission: lit rooms — warm, curtains, a lamp spot
      if (lit(f0 === 4.0 ? 0.25 : f0 === 19.2 ? 0.3 : pl)) {
        const g = e.createRadialGradient(cx + (rng() - 0.5) * w * 0.5, Y(y0 + (y1 - y0) * 0.65), 2, cx, Y(y0 + (y1 - y0) * 0.5), w);
        const t = rng();
        const c0 = t < 0.7 ? 'rgba(255,196,120,1)' : t < 0.9 ? 'rgba(255,226,180,1)' : 'rgba(170,190,255,0.8)';
        g.addColorStop(0, c0); g.addColorStop(1, 'rgba(120,60,20,0.6)');
        e.fillStyle = g; e.fillRect(wx + 1, Y(y1) + 1, w - 2, (y1 - y0) * PXM - 2);
        // curtains (dark folds on each side), sometimes drawn
        e.fillStyle = 'rgba(0,0,0,0.55)';
        const cw = rng() < 0.3 ? w * 0.45 : w * 0.18;
        for (let k = 0; k < 5; k++) { e.fillRect(wx + 1 + k * cw / 5, Y(y1), 2, (y1 - y0) * PXM); e.fillRect(wx + w - 1 - k * cw / 5, Y(y1), 2, (y1 - y0) * PXM); }
        e.fillStyle = '#000'; e.fillRect(cx - 1.5, Y(y1), 3, (y1 - y0) * PXM);
        for (let k = 1; k < 4; k++) e.fillRect(wx, Y(y0 + (y1 - y0) * k / 4) - 1, w, 2);
        if (f0 !== 9.8 && f0 !== 19.2 && f0 !== 4.0) { e.fillRect(wx - 3, Y(y0 + 1.0), w + 6, 3); for (let k = 0; k <= 8; k++) e.fillRect(wx - 3 + k * (w + 6) / 8, Y(y0 + 1.0), 2, 1.0 * PXM); }
      }
    }
    // pilaster edge of the bay (helps the rhythm)
    a.fillStyle = 'rgba(80,66,50,0.12)'; a.fillRect(x0, 0, 2, AH);
  }
  // soot from the cornice, wet darkening at the base, vertical rain streaks
  let g = a.createLinearGradient(0, 0, 0, 0.12 * AH); g.addColorStop(0, 'rgba(30,26,22,0.5)'); g.addColorStop(1, 'rgba(30,26,22,0)'); a.fillStyle = g; a.fillRect(0, 0, AW, 0.12 * AH);
  g = a.createLinearGradient(0, Y(1.2), 0, AH); g.addColorStop(0, 'rgba(20,18,16,0)'); g.addColorStop(1, 'rgba(20,18,16,0.55)'); a.fillStyle = g; a.fillRect(0, Y(1.2), AW, 1.2 * PXM);
  for (let k = 0; k < 160; k++) { const x = rng() * AW, y = rng() * AH * 0.8, h = 40 + rng() * 220; const gg = a.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, 'rgba(50,42,32,0.18)'); gg.addColorStop(1, 'rgba(50,42,32,0)'); a.fillStyle = gg; a.fillRect(x, y, 2 + rng() * 5, h); }
  // street-lamp wash on the ground floor + entresol (the lamps on the quay light the stone)
  g = e.createLinearGradient(0, Y(7.5), 0, AH); g.addColorStop(0, 'rgba(60,34,12,0)'); g.addColorStop(1, 'rgba(60,34,12,0.5)');
  e.globalCompositeOperation = 'lighter'; e.fillStyle = g; e.fillRect(0, Y(7.5), AW, 7.5 * PXM); e.globalCompositeOperation = 'source-over';
  const at = canvasTex(A), et = canvasTex(E);
  return { albedo: at, emissive: et };
}
function zincTexture(rng) {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#6c7177'; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 16) { g.fillStyle = 'rgba(200,210,220,0.35)'; g.fillRect(x, 0, 2, S); g.fillStyle = 'rgba(20,22,26,0.4)'; g.fillRect(x + 2, 0, 2, S); }
  for (let k = 0; k < 60; k++) { const x = rng() * S, y = rng() * S; const gr = g.createLinearGradient(0, y, 0, y + 80); gr.addColorStop(0, 'rgba(30,32,36,0.3)'); gr.addColorStop(1, 'rgba(30,32,36,0)'); g.fillStyle = gr; g.fillRect(x, y, 6, 80); }
  return canvasTex(c);
}
function railTexture() {
  // wrought-iron balcony rail: posts, a scroll band, top rail (alpha = iron)
  const W = 256, H = 64, c = makeCanvas(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H); g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.fillRect(0, 0, W, 6); g.fillRect(0, H - 5, W, 5); g.fillRect(0, 26, W, 3);
  for (let x = 0; x < W; x += 8) g.fillRect(x, 6, 2, H - 10);
  g.lineWidth = 2.5;
  for (let x = 0; x < W; x += 32) { g.beginPath(); g.arc(x + 16, 17, 7, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x + 8, 44, 5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x + 24, 44, 5, 0, Math.PI * 2); g.stroke(); }
  const t = canvasTex(c, { srgb: false });
  return t;
}
function farWindowTexture(rng) {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  // 16 cols x 16 floors of windows; ~22% lit, warm
  // unlit glass (faint) so the walls read as windowed even where dark
  g.fillStyle = 'rgba(30,26,22,1)';
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) g.fillRect(i * 32 + 12, j * 32 + 9, 8, 13);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (rng() < 0.14) {
    const t = rng(), k = 0.45 + rng() * 0.55;
    g.fillStyle = t < 0.75 ? `rgba(${(255 * k) | 0},${((150 + rng() * 50) * k) | 0},${(70 * k) | 0},1)` : `rgba(${(255 * k) | 0},${(220 * k) | 0},${(170 * k) | 0},1)`;
    g.fillRect(i * 32 + 12, j * 32 + 9, 8, 13);
  }
  return canvasTex(c);
}

// ------------------------------------------------------------------ geometry batches
class Batch {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; }
  tri(a, b, c, n, ua, ub, uc, ca, cb, cc) {
    this.P.push(...a, ...b, ...c); this.N.push(...n, ...n, ...n); this.U.push(...ua, ...ub, ...uc); this.C.push(...ca, ...cb, ...cc);
  }
  // quad p0 p1 p2 p3 (counter-clockwise seen from the side the normal `n` points to)
  quad(p0, p1, p2, p3, n, uv = [0, 0, 1, 1], c0 = [1, 1, 1], c1 = c0) {
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const [u0, v0, u1, v1] = uv;
    if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) {
      this.tri(p0, p1, p2, n, [u0, v0], [u1, v0], [u1, v1], c0, c0, c1); this.tri(p0, p2, p3, n, [u0, v0], [u1, v1], [u0, v1], c0, c1, c1);
    } else {
      this.tri(p0, p2, p1, n, [u0, v0], [u1, v1], [u1, v0], c0, c1, c0); this.tri(p0, p3, p2, n, [u0, v0], [u0, v1], [u1, v1], c0, c1, c1);
    }
  }
  // axis-aligned box in world space, uv scaled by size / tile
  box(x0, y0, z0, x1, y1, z1, col = [1, 1, 1], tile = 4, top = null) {
    const c = col, cb = top || col;
    const sx = (x1 - x0) / tile, sy = (y1 - y0) / tile, sz = (z1 - z0) / tile;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [0, 0, sx, sy], c, cb);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [0, 0, sx, sy], c, cb);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [0, 0, sz, sy], c, cb);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [0, 0, sz, sy], c, cb);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [0, 0, sx, sz], cb, cb);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [0, 0, sx, sz], c, c);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// a frontage frame: origin on the facade line, A along the street, N out toward the street
function frame(o, A, N) {
  return { P: (s, d, y) => [o[0] + A[0] * s - N[0] * d, y, o[2] + A[2] * s - N[2] * d], N, A };
}

// ------------------------------------------------------------------ one building on a frontage
function building(B, f, s0, s1, opts, rng, out) {
  const { FL, cornice, tint, depth = 26, low = false } = opts;
  const P = f.P, N = f.N, A = f.A;
  const nb = Math.max(2, Math.round((s1 - s0) / BAY)), bw = (s1 - s0) / nb;
  const yC = FL[FL.length - 1];
  const vtop = yC / 22.2;
  const shade = (y) => { const k = (0.62 + 0.38 * Math.min(1, y / 3)) * (0.92 + 0.08 * (1 - y / yC)); return [tint[0] * k, tint[1] * k, tint[2] * k]; };
  // ---- facade bays (painted atlas)
  for (let b = 0; b < nb; b++) {
    const v = (rng() * 8) | 0, a0 = s0 + b * bw, a1 = a0 + bw;
    // mirror half the bays (doubles the variety); a touch of per-bay tint so neighbours never match exactly
    const flip = rng() < 0.5, u0 = (v + (flip ? 1 : 0)) / 8, u1 = (v + (flip ? 0 : 1)) / 8;
    const bt = 0.95 + rng() * 0.1;
    // two slices: ground (darker, wet) and the rest
    B.fac.quad(P(a0, 0, 0), P(a1, 0, 0), P(a1, 0, 3), P(a0, 0, 3), N, [u0, 0, u1, 3 / 22.2], mul(shade(0), bt), mul(shade(3), bt));
    B.fac.quad(P(a0, 0, 3), P(a1, 0, 3), P(a1, 0, yC), P(a0, 0, yC), N, [u0, 3 / 22.2, u1, vtop], mul(shade(3), bt), mul(shade(yC), bt));
    // dormer in the mansard (front face uses the 5th-floor window of the same variant)
    if (b % (low ? 2 : 1) === 0) {
      const dc = (a0 + a1) / 2, dw = 0.75, y0 = yC + 0.9, y1 = yC + 2.9, dd = 1.5;
      B.fac.quad(P(dc - dw, dd, y0), P(dc + dw, dd, y0), P(dc + dw, dd, y1), P(dc - dw, dd, y1), N, [u0 + 0.25 / 8, 19.4 / 22.2, u1 - 0.25 / 8, 22.0 / 22.2], [0.9, 0.88, 0.84]);
      for (const sd of [-1, 1]) B.zinc.quad(P(dc + sd * dw, dd, y0), P(dc + sd * dw, dd + 1.6, y0), P(dc + sd * dw, dd + 1.6, y1 + 0.5), P(dc + sd * dw, dd, y1 + 0.5), [A[0] * sd, 0, A[2] * sd], [0, 0, 0.5, 0.8], [0.8, 0.82, 0.86]);
      // pitched cap
      B.zinc.quad(P(dc - dw - 0.15, dd - 0.15, y1), P(dc, dd - 0.15, y1 + 0.75), P(dc, dd + 1.7, y1 + 0.75), P(dc - dw - 0.15, dd + 1.7, y1), [-A[0] * 0.7, 0.7, -A[2] * 0.7], [0, 0, 0.4, 0.7], [0.7, 0.72, 0.76]);
      B.zinc.quad(P(dc, dd - 0.15, y1 + 0.75), P(dc + dw + 0.15, dd - 0.15, y1), P(dc + dw + 0.15, dd + 1.7, y1), P(dc, dd + 1.7, y1 + 0.75), [A[0] * 0.7, 0.7, A[2] * 0.7], [0, 0, 0.4, 0.7], [0.7, 0.72, 0.76]);
      B.stone.quad(P(dc - dw - 0.12, dd - 0.02, y0 - 0.15), P(dc + dw + 0.12, dd - 0.02, y0 - 0.15), P(dc + dw + 0.12, dd - 0.02, y0), P(dc - dw - 0.12, dd - 0.02, y0), N, [0, 0, 0.5, 0.1], [0.75, 0.7, 0.62]);
    }
    // console brackets under the balconies
    for (const yb of low ? [FL[2], FL[4]] : [FL[3], FL[6]]) for (const t of [0.12, 0.88]) {
      const s = a0 + bw * t;
      stoneBox(B, f, s - 0.12, s + 0.12, -BALC_D + 0.15, 0, yb - 0.55, yb - 0.02, [0.78, 0.72, 0.62]);
    }
    // café awnings + their lamp glows
    if ((v === 0 || v === 5) && !low) {
      const ac = (a0 + a1) / 2, aw = bw * 0.46;
      const col = [[0.36, 0.08, 0.07], [0.12, 0.2, 0.14], [0.32, 0.22, 0.12]][(rng() * 3) | 0];
      B.awn.quad(P(ac - aw, 0, 3.9), P(ac + aw, 0, 3.9), P(ac + aw, -1.9, 3.2), P(ac - aw, -1.9, 3.2), [N[0] * 0.35, 0.94, N[2] * 0.35], [0, 0, 1, 1], mul(col, 1.1), col);
      B.awn.quad(P(ac - aw, -1.9, 3.2), P(ac + aw, -1.9, 3.2), P(ac + aw, -1.9, 2.85), P(ac - aw, -1.9, 2.85), N, [0, 0, 1, 0.2], col);
      const lp = P(ac, -0.35, 3.45);
      out.glows.push({ p: lp, color: [3.0, 1.75, 0.75], size: 1.3, dusk: true });
      out.reflect.push({ p: lp, color: [1.6, 0.9, 0.4], len: 6, width: 2.2, ground: 0 });
    }
  }
  // ---- relief: string course, balcony slabs + rails, cornice
  const L = (y) => [P(s0, 0, y), P(s1, 0, y)];
  stoneBox(B, f, s0, s1, -0.18, 0, FL[1] - 0.12, FL[1] + 0.06, [0.82, 0.76, 0.66]);
  stoneBox(B, f, s0, s1, -0.14, 0, FL[2] - 0.1, FL[2] + 0.05, [0.82, 0.76, 0.66]);
  for (const yb of low ? [FL[2], FL[4]] : [FL[3], FL[6]]) {
    stoneBox(B, f, s0, s1, -BALC_D, 0, yb - 0.22, yb, [0.8, 0.74, 0.64]);
    // wrought-iron rail (alpha tested), its top bar
    B.rail.quad(P(s0, -BALC_D + 0.06, yb), P(s1, -BALC_D + 0.06, yb), P(s1, -BALC_D + 0.06, yb + RAIL_H), P(s0, -BALC_D + 0.06, yb + RAIL_H), N, [0, 0, (s1 - s0) / 1.8, 1]);
    stoneBox(B, f, s0, s1, -BALC_D + 0.02, -BALC_D + 0.12, yb + RAIL_H - 0.05, yb + RAIL_H + 0.03, [0.12, 0.12, 0.13]);
  }
  stoneBox(B, f, s0, s1, -0.75, 0, yC - 0.1, yC + 0.55, [0.86, 0.8, 0.7]);
  stoneBox(B, f, s0, s1, -0.45, 0, yC - 0.55, yC - 0.1, [0.7, 0.64, 0.56]);
  // party-wall pilasters (break the frontage into houses)
  stoneBox(B, f, s0, s0 + 0.35, -0.12, 0, 0, yC, mul(tint, 0.95));
  // ---- the mansard: steep zinc slope, then the dark roof
  const yM = yC + 0.55, yT = yC + 4.6 + (opts.tall ? 1.2 : 0);
  B.zinc.quad(P(s0, 0.3, yM), P(s1, 0.3, yM), P(s1, 2.6, yT), P(s0, 2.6, yT), [N[0] * 0.85, 0.5, N[2] * 0.85], [0, 0, (s1 - s0) / 3, 1.6], [0.62, 0.66, 0.72], [0.48, 0.5, 0.56]);
  B.zinc.quad(P(s0, 2.6, yT), P(s1, 2.6, yT), P(s1, depth, yT), P(s0, depth, yT), [0, 1, 0], [0, 0, (s1 - s0) / 3, 6], [0.4, 0.42, 0.46]);
  // gable ends of the mansard
  for (const [s, sg] of [[s0, -1], [s1, 1]]) B.zinc.quad(P(s, 0.3, yM), P(s, depth, yM), P(s, depth, yT), P(s, 2.6, yT), [A[0] * sg, 0, A[2] * sg], [0, 0, 6, 1.4], [0.45, 0.47, 0.52]);
  // chimney stacks with terracotta pots
  for (const s of [s0 + 0.6, s1 - 1.5]) {
    if (rng() < 0.25) continue;
    const d0 = 4 + rng() * 6, h = 2.2 + rng() * 2;
    stoneBox(B, f, s, s + 0.9, d0, d0 + 2.4, yT - 0.2, yT + h, [0.62, 0.48, 0.4]);
    for (let k = 0; k < 3; k++) stoneBox(B, f, s + 0.2, s + 0.5, d0 + 0.3 + k * 0.7, d0 + 0.6 + k * 0.7, yT + h, yT + h + 0.55, [0.62, 0.32, 0.2]);
  }
  // ---- block body (sides / back seen down the cross streets) and its collider
  const p0 = P(s0, 0, 0), p1 = P(s1, depth, 0);
  out.colliders.push({ min: [Math.min(p0[0], p1[0]), 0, Math.min(p0[2], p1[2])], max: [Math.max(p0[0], p1[0]), yC, Math.max(p0[2], p1[2])], data: { mat: 'concrete', kind: 'building' } });
  return { yC, yT };
}
function stoneBox(B, f, s0, s1, d0, d1, y0, y1, col) {
  const a = f.P(s0, d0, y0), b = f.P(s1, d1, y1);
  B.stone.box(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]), col, 2, mul(col, 1.08));
}
const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// a whole frontage from s0 to s1 with gaps (cross streets); returns nothing, fills B / out
function frontage(B, f, s0, s1, gaps, opts, rng, out) {
  let s = s0;
  while (s < s1 - 6) {
    const gap = gaps.find(([g0, g1]) => s >= g0 - 0.01 && s < g1);
    if (gap) { s = gap[1]; continue; }
    const next = gaps.filter(([g0]) => g0 > s).reduce((m, [g0]) => Math.min(m, g0), s1);
    let w = BAY * (4 + ((rng() * 4) | 0));
    if (s + w > next - BAY * 2) w = next - s;
    const T = 0.9 + rng() * 0.12;
    const tint = [T, T * (0.96 + rng() * 0.03), T * (0.9 + rng() * 0.05)];
    building(B, f, s, s + w, { ...opts, tint, tall: rng() < 0.3 }, rng, out);
    s += w;
  }
}
// the side walls of the blocks along a cross street (stone, windows) and a lit street receding
function crossStreet(B, f, g0, g1, opts, out, rng) {
  const depth = 60;
  for (const [s, sd] of [[g0, 1], [g1, -1]]) {
    // the side facade of the corner block, facing into the street (atlas bays)
    const n = [f.A[0] * sd, 0, f.A[2] * sd];
    for (let d = 0.5; d < depth - 3; d += BAY) {
      const v = (rng() * 8) | 0, u0 = v / 8, u1 = (v + 1) / 8;
      B.fac.quad(f.P(s, d, 0), f.P(s, d + BAY, 0), f.P(s, d + BAY, 22.2), f.P(s, d, 22.2), n, [u0, 0, u1, 1], [0.7, 0.66, 0.6], [0.85, 0.8, 0.74]);
    }
    // lamps down the street
    for (let d = 8; d < depth; d += 14) { const p = f.P(s + sd * 1.4, d, 4.6); out.glows.push({ p, color: [2.8, 1.6, 0.7], size: 1.2, dusk: true }); }
  }
  // the far end: another facade across the street, lit
  const v = 1;
  for (let s = g0; s < g1 - 0.5; s += BAY) B.fac.quad(f.P(s, depth, 0), f.P(Math.min(g1, s + BAY), depth, 0), f.P(Math.min(g1, s + BAY), depth, 22.2), f.P(s, depth, 22.2), f.N, [v / 8, 0, (v + 1) / 8, 1], [0.6, 0.56, 0.5]);
  out.colliders.push({ min: [Math.min(f.P(g0, 0, 0)[0], f.P(g1, depth, 0)[0]), 0, Math.min(f.P(g0, 0, 0)[2], f.P(g1, depth, 0)[2])], max: [Math.max(f.P(g0, 0, 0)[0], f.P(g1, depth, 0)[0]), 6, Math.max(f.P(g0, 0, 0)[2], f.P(g1, depth, 0)[2])], data: { kind: 'bound', noBullet: true } });
}

// ------------------------------------------------------------------ far Paris
function farCity(rng, out) {
  const B = new Batch(), R = new Batch();
  const ok = (x, z, r) => {
    if (Math.abs(z) < 60 + r) return false;                                // the river corridor
    if (Math.abs(x) < 540 && z > 70 && z < 112 + r) return false;            // the near north frontage
    if (Math.abs(x) < 540 && z < -70 && z > -112 - r && Math.abs(x) > 80) return false;
    if (Math.abs(x) < 140 + r && z < -60 && z > -320 - r) return false;      // the tower park + flanks
    if (Math.abs(x) < 30 + r && z > 60 && z < 400) return false;             // the avenue north of the bridge
    return true;
  };
  let n = 0;
  for (let k = 0; k < 2600 && n < 1300; k++) {
    const ang = rng() * Math.PI * 2, rad = 130 + Math.pow(rng(), 0.7) * 1500;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad * 0.9;
    const w = 18 + rng() * 34, d = 18 + rng() * 34, h = 14 + rng() * 14 + (rng() < 0.04 ? 25 : 0);
    if (!ok(x, z, Math.max(w, d) * 0.5)) continue;
    n++;
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const T = 0.55 + rng() * 0.25, col = [T, T * 0.96, T * 0.9];
    // walls: uv in "window units" (4 m x 3.2 m), the texture is 16 x 16 windows
    const wall = (p0, p1, nrm) => { const L = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]); const uo = rng(); B.quad([p0[0], 0, p0[2]], [p1[0], 0, p1[2]], [p1[0], h, p1[2]], [p0[0], h, p0[2]], nrm, [uo, 0, uo + L / 64, h / 51.2], mul(col, 0.7), col); };
    wall([x0, 0, z1], [x1, 0, z1], [0, 0, 1]); wall([x1, 0, z0], [x0, 0, z0], [0, 0, -1]); wall([x1, 0, z1], [x1, 0, z0], [1, 0, 0]); wall([x0, 0, z0], [x0, 0, z1], [-1, 0, 0]);
    // zinc roof cap (mansard-ish)
    R.box(x0 + 1, h, z0 + 1, x1 - 1, h + 3.5, z1 - 1, [0.35, 0.37, 0.41], 8);
  }
  // street-lamp rows receding across the city (far glows)
  for (let r = 0; r < 7; r++) {
    const a = rng() * Math.PI * 2, ox = Math.cos(a) * (300 + rng() * 500), oz = Math.sin(a) * (300 + rng() * 500), dir = rng() * Math.PI;
    for (let i = 0; i < 14; i++) { const x = ox + Math.cos(dir) * i * 34, z = oz + Math.sin(dir) * i * 34; if (ok(x, z, 0)) out.glows.push({ p: [x, 5, z], color: [2.4, 1.4, 0.6], size: 3.2, far: true, dusk: true }); }
  }
  return { walls: B, roofs: R, n };
}
function landmarks(rng) {
  const W = new Batch(), G = new Batch(), H = new Batch();
  const sphere = (B, cx, cy, cz, r, col, rings = 10, segs = 20, half = true, sy = 1) => {
    for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
      const t0 = (i / rings) * (half ? Math.PI / 2 : Math.PI), t1 = ((i + 1) / rings) * (half ? Math.PI / 2 : Math.PI), p0 = (j / segs) * Math.PI * 2, p1 = ((j + 1) / segs) * Math.PI * 2;
      const pt = (t, p) => [cx + r * Math.sin(Math.PI / 2 - t) * Math.cos(p) * (half ? 1 : 1), cy + r * Math.cos(Math.PI / 2 - t) * sy, cz + r * Math.sin(Math.PI / 2 - t) * Math.sin(p)];
      const a = pt(t0, p0), b = pt(t0, p1), c = pt(t1, p1), d = pt(t1, p0);
      const n = [Math.cos((p0 + p1) / 2), Math.sin((t0 + t1) / 2), Math.sin((p0 + p1) / 2)];
      B.quad(a, b, c, d, n, [0, 0, 1, 1], col);
    }
  };
  const cyl = (B, cx, y0, y1, cz, r, col, segs = 20) => { for (let j = 0; j < segs; j++) { const p0 = j / segs * Math.PI * 2, p1 = (j + 1) / segs * Math.PI * 2; B.quad([cx + Math.cos(p0) * r, y0, cz + Math.sin(p0) * r], [cx + Math.cos(p1) * r, y0, cz + Math.sin(p1) * r], [cx + Math.cos(p1) * r, y1, cz + Math.sin(p1) * r], [cx + Math.cos(p0) * r, y1, cz + Math.sin(p0) * r], [Math.cos((p0 + p1) / 2), 0, Math.sin((p0 + p1) / 2)], [0, 0, 1, 1], col); } };
  // the hill to the NNE with the white basilica on top (floodlit)
  const hx = 260, hz = 1250, hy = 110;
  for (let i = 0; i < 24; i++) { const a0 = i / 24 * Math.PI * 2, a1 = (i + 1) / 24 * Math.PI * 2; for (let k = 0; k < 4; k++) { const r0 = 420 * (1 - k / 4), r1 = 420 * (1 - (k + 1) / 4), y0 = hy * Math.pow(k / 4, 0.7), y1 = hy * Math.pow((k + 1) / 4, 0.7); H.quad([hx + Math.cos(a0) * r0, y0, hz + Math.sin(a0) * r0], [hx + Math.cos(a1) * r0, y0, hz + Math.sin(a1) * r0], [hx + Math.cos(a1) * r1, y1, hz + Math.sin(a1) * r1], [hx + Math.cos(a0) * r1, y1, hz + Math.sin(a0) * r1], [Math.cos((a0 + a1) / 2) * 0.5, 0.86, Math.sin((a0 + a1) / 2) * 0.5], [0, 0, (r0 + r1) / 40, 3], [0.5, 0.48, 0.45]); } }
  const by = hy - 2;
  W.box(hx - 34, by, hz - 26, hx + 34, by + 24, hz + 30, [1, 0.98, 0.94], 8);
  cyl(W, hx, by + 24, by + 40, hz, 16, [0.98, 0.96, 0.92]); sphere(W, hx, by + 40, hz, 17, [1, 0.99, 0.96], 8, 24, true, 1.35);
  cyl(W, hx, by + 62, by + 70, hz, 3.2, [1, 0.98, 0.95], 12); sphere(W, hx, by + 70, hz, 3.4, [1, 0.98, 0.95], 4, 12, true, 1.6);
  for (const [dx, dz] of [[-24, -14], [24, -14], [-24, 20], [24, 20]]) { cyl(W, hx + dx, by + 24, by + 32, hz + dz, 6, [0.96, 0.94, 0.9], 14); sphere(W, hx + dx, by + 32, hz + dz, 6.2, [0.98, 0.96, 0.92], 5, 14, true, 1.4); }
  W.box(hx + 30, by, hz + 26, hx + 44, by + 64, hz + 40, [0.98, 0.96, 0.92], 8); sphere(W, hx + 37, by + 64, hz + 33, 7, [1, 0.98, 0.95], 4, 12, true, 1.4);
  // the gilded dome to the ESE (floodlit gold on a pale drum)
  const gx = 720, gz = -300;
  W.box(gx - 40, 0, gz - 40, gx + 40, 28, gz + 40, [0.86, 0.82, 0.74], 8);
  cyl(W, gx, 28, 52, gz, 22, [0.9, 0.86, 0.78], 24);
  sphere(G, gx, 52, gz, 24, [1, 0.85, 0.45], 10, 28, true, 1.25);
  cyl(G, gx, 82, 94, gz, 4, [1, 0.85, 0.45], 12); sphere(G, gx, 94, gz, 4.4, [1, 0.85, 0.45], 4, 12, true, 1.5);
  cyl(G, gx, 98, 112, gz, 0.6, [1, 0.85, 0.45], 6);
  return { W, G, H, glows: [{ p: [gx, 108, gz], color: [3, 2, 0.8], size: 10, far: true }, { p: [hx, by + 78, hz], color: [2.5, 2.4, 2.2], size: 12, far: true }] };
}

// =====================================================================================
export async function buildParis() {
  const rng = makeRng(1853);
  const root = new THREE.Group(); root.name = 'paris';
  const out = { colliders: [], glows: [], reflect: [] };
  const B = { fac: new Batch(), stone: new Batch(), zinc: new Batch(), rail: new Batch(), awn: new Batch() };
  // ---- the river frontages
  const fN = frame([0, 0, QUAY_N.face], [1, 0, 0], [0, 0, -1]);
  const gapsN = [[-14, 14], [-160, -150], [146, 156], [-340, -330], [330, 340]];
  frontage(B, fN, -520, 520, gapsN, { FL: FL_MAIN }, rng, out);
  for (const [g0, g1] of gapsN) if (g1 - g0 < 20) crossStreet(B, fN, g0, g1, {}, out, rng);
  const fS = frame([0, 0, QUAY_S.face], [1, 0, 0], [0, 0, 1]);
  const gapsS = [[-PARK.half - 6, PARK.half + 6], [-250, -240], [236, 246], [-430, -420], [420, 430]];
  frontage(B, fS, -520, 520, gapsS, { FL: FL_MAIN }, rng, out);
  for (const [g0, g1] of gapsS) if (g1 - g0 < 20) crossStreet(B, fS, g0, g1, {}, out, rng);
  // ---- the park's flanking blocks (lower, one storey less), facing the park
  const fW = frame([-PARK.half - 6, 0, 0], [0, 0, 1], [1, 0, 0]);
  frontage(B, fW, -262, -104, [], { FL: FL_LOW, low: true }, rng, out);
  const fE = frame([PARK.half + 6, 0, 0], [0, 0, -1], [-1, 0, 0]);
  frontage(B, fE, 104, 262, [], { FL: FL_LOW, low: true }, rng, out);
  // the far end of the park: a long low block closing the view (with a lit gap in the middle)
  const fP = frame([0, 0, PARK.z0 - 6], [1, 0, 0], [0, 0, 1]);
  frontage(B, fP, -PARK.half - 6, PARK.half + 6, [[-12, 12]], { FL: FL_LOW, low: true }, rng, out);
  // the sniper balconies: their rails are cover (and stop bullets)
  for (const s of [SNIPERS.n1, SNIPERS.n2]) out.colliders.push({ min: [s.x - 12, 19.2, 76.85], max: [s.x + 12, 19.2 + RAIL_H, 77.0], data: { mat: 'metal', kind: 'rail' } });
  // ---- materials
  const atlas = facadeAtlas(rng);
  const facMat = new THREE.MeshStandardMaterial({ map: atlas.albedo, emissiveMap: atlas.emissive, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.82, metalness: 0.0, vertexColors: true });
  facMat.userData.duskEmissive = 1.15;
  const stoneTex = concreteTexture(23, [0.82, 0.76, 0.66], 256);
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xd6c9b0, roughness: 0.8, vertexColors: true });
  const zincMat = new THREE.MeshStandardMaterial({ map: zincTexture(rng), color: 0xb8c0ca, roughness: 0.45, metalness: 0.55, vertexColors: true });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.5, metalness: 0.7, alphaMap: railTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  railMat.alphaToCoverage = true;
  const awnMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true, side: THREE.DoubleSide, emissive: 0x3a1a08, emissiveIntensity: 0.6 });
  const mesh = (b, m, cast = false) => { const o = new THREE.Mesh(b.geometry(), m); o.receiveShadow = true; o.castShadow = cast; root.add(o); return o; };
  mesh(B.fac, facMat); mesh(B.stone, stoneMat, true); mesh(B.zinc, zincMat); mesh(B.rail, railMat); mesh(B.awn, awnMat);
  // ---- far Paris
  const far = farCity(rng, out);
  const farTex = farWindowTexture(rng);
  const farMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.9, emissiveMap: farTex, emissive: 0xffffff, emissiveIntensity: 0.75, vertexColors: true });
  farMat.userData.duskEmissive = 0.75;
  mesh(far.walls, farMat);
  mesh(far.roofs, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.4, vertexColors: true }));
  const L = landmarks(rng);
  const lmW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, vertexColors: true, emissive: 0xd8d2c4, emissiveIntensity: 0.55 });
  lmW.userData.duskEmissive = 0.55;
  const lmG = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.8, vertexColors: true, emissive: 0xffb040, emissiveIntensity: 0.8 });
  lmG.userData.duskEmissive = 0.8;
  mesh(L.W, lmW); mesh(L.G, lmG);
  const farLit = farTex.clone(); farLit.repeat.set(4, 4); farLit.needsUpdate = true;
  mesh(L.H, new THREE.MeshStandardMaterial({ color: 0x4a443c, roughness: 0.95, vertexColors: true, map: farLit, emissiveMap: farLit, emissive: 0xffffff, emissiveIntensity: 0.8 }));
  for (const g of L.glows) out.glows.push(g);
  root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
  let tris = 0; root.traverse(o => { if (o.isMesh) tris += o.geometry.attributes.position.count / 3; });
  return { root, colliders: out.colliders, anchors: { glows: out.glows, reflect: out.reflect }, info: { tris: Math.round(tris), farBlocks: far.n, glows: out.glows.length } };
}
