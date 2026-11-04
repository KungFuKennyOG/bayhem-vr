import * as THREE from 'three';
import { makeRng } from './rng.js';

// ---------- tileable value noise (CPU) ----------
function makeNoise(seed, period) {
  const r = makeRng(seed);
  const N = period;
  const lat = new Float32Array(N * N);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const f = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % N) + N) % N, y0 = ((yi % N) + N) % N;
    const x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
    const a = lat[y0 * N + x0], b = lat[y0 * N + x1], c = lat[y1 * N + x0], d = lat[y1 * N + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return f;
}
// fbm over [0,1)^2 tileable: freq = base cells across
function fbm(noise, u, v, base, oct = 5, gain = 0.5) {
  let amp = 0.5, sum = 0, norm = 0, fr = base;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise(u * fr, v * fr);
    norm += amp; amp *= gain; fr *= 2;
  }
  return sum / norm;
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tex(c, { repeat = true, srgb = true, aniso = 8, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = mips;
  t.needsUpdate = true;
  return t;
}
function heightToNormal(h, w, hh, strength) {
  const c = canvas(w, hh);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const l = h[y * w + ((x - 1 + w) % w)], rr = h[y * w + ((x + 1) % w)];
    const d = h[((y - 1 + hh) % hh) * w + x], u = h[((y + 1) % hh) * w + x];
    let nx = (l - rr) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

// Draw the same feature into colour / roughness / height canvases in step.
function layered(W, H) {
  const L = { c: canvas(W, H), r: canvas(W, H), h: canvas(W, H) };
  for (const k in L) L[k + 'x'] = L[k].getContext('2d');
  L.each = (fn) => { fn(L.cx, 'c'); fn(L.rx, 'r'); fn(L.hx, 'h'); };
  return L;
}
const grey = (v, a = 1) => `rgba(${v * 255 | 0},${v * 255 | 0},${v * 255 | 0},${a})`;

// ---------- ROAD ----------
// 1024 x 512 px covers 19m wide x 20m long (along-road texels are foreshortened at grazing angles anyway). Warm grey aged asphalt: aggregate, polished wheel tracks,
// oil-dripped lane centres, sealed seams + cracks, repair patches, skid marks, worn paint.
export const ROAD = { width: 19, tileLen: 20, left: -9.0 };
export function roadTextures() {
  const W = 1024, H = 512;
  const pxX = W / ROAD.width, pxY = H / ROAD.tileLen;
  const n1 = makeNoise(11, 64), n2 = makeNoise(23, 32), n3 = makeNoise(37, 256), n4 = makeNoise(41, 16), n5 = makeNoise(53, 64);
  const r = makeRng(99);
  const LANE0 = 1.6, LANE1 = 16.4;
  const col = new Float32Array(W * H), rough = new Float32Array(W * H), hgt = new Float32Array(W * H), warm = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W, xm = x / pxX, i = y * W + x;
      const large = fbm(n2, u, v, 3, 3), mid = fbm(n1, u, v, 12, 2), fine = n3(u * 256, v * 128);
      let b = 0.5 + (large - 0.5) * 0.12 + (mid - 0.5) * 0.06 + (fine - 0.5) * 0.025;
      let rr = 0.88 + (mid - 0.5) * 0.1, h = fine * 0.45, w = 0;
      const g = r();
      if (g > 0.975) { b += 0.03 + r() * 0.06; h += 0.35; w = (r() - 0.5) * 0.04; rr += 0.03; }
      else if (g < 0.035) { b -= 0.03 + r() * 0.025; h -= 0.2; }
      if (xm < LANE0 || xm > LANE1) {
        const dust = fbm(n4, u, v, 4, 3);
        b += 0.055 + (dust - 0.5) * 0.1; w += 0.03;
      } else {
        const lp = (xm - LANE0) % 3.7;
        const d1 = lp - 0.92, d2 = lp - 2.78;
        const wv = 0.7 + 0.3 * mid;
        const wear = (Math.exp(-d1 * d1 / 0.075) + Math.exp(-d2 * d2 / 0.075)) * wv;
        b -= wear * 0.085; rr -= wear * 0.25; h *= 1 - wear * 0.55;
        const dc = lp - 1.85, ob = Math.exp(-dc * dc / 0.1);
        const blot = Math.min(1, Math.max(0, fbm(n5, u * 2, v * 2, 16, 2) - 0.47) * 4.5);
        const oil = ob * blot;
        b -= oil * 0.13; rr -= oil * 0.42; w -= oil * 0.04;
      }
      col[i] = b; rough[i] = rr; hgt[i] = h; warm[i] = w;
    }
  }
  // worn paint straight into the arrays (thermoplastic: brighter, a bit raised, mid rough)
  const paint = (xm, wm, y0, y1, pc) => {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, y1); y++) for (let x = Math.floor(xm * pxX); x < (xm + wm) * pxX; x++) {
      const wear = fbm(n1, x / W, y / H, 32, 3);
      if (wear < 0.3) continue;
      const a = Math.min(1, (wear - 0.28) * 3.2) * 0.95, i = y * W + x;
      col[i] = col[i] * (1 - a) + pc * a; rough[i] = rough[i] * (1 - a) + 0.72 * a; hgt[i] += 0.25 * a; warm[i] = (warm[i] * (1 - a)) + (pc < 0.7 ? 0.25 : 0) * a;
    }
  };
  paint(1.42, 0.15, 0, H, 0.66); // yellow (warm channel carries the hue)
  paint(16.4, 0.16, 0, H, 0.86);
  for (const lx of [5.3, 9.0, 12.7]) for (let d = 0; d < 2; d++) paint(lx - 0.07, 0.14, (d * 10 + 1) * pxY, (d * 10 + 4) * pxY, 0.86);
  const L = layered(W, H);
  const imgs = { c: L.cx.createImageData(W, H), r: L.rx.createImageData(W, H), h: L.hx.createImageData(W, H) };
  for (let i = 0; i < W * H; i++) {
    const b = col[i], w = warm[i], k = i * 4;
    const R = b * (1.07 + w * 1.6), G = b * (1.02 + w * 0.7), B = b * (0.86 - w * 1.6);
    imgs.c.data[k] = Math.min(255, R * 255); imgs.c.data[k + 1] = Math.min(255, G * 255); imgs.c.data[k + 2] = Math.max(0, Math.min(255, B * 255)); imgs.c.data[k + 3] = 255;
    const rv = Math.max(0, Math.min(1, rough[i])) * 255; imgs.r.data[k] = imgs.r.data[k + 1] = imgs.r.data[k + 2] = rv; imgs.r.data[k + 3] = 255;
    const hv = Math.max(0, Math.min(1, hgt[i] * 0.6 + 0.2)) * 255; imgs.h.data[k] = imgs.h.data[k + 1] = imgs.h.data[k + 2] = hv; imgs.h.data[k + 3] = 255;
  }
  L.cx.putImageData(imgs.c, 0, 0); L.rx.putImageData(imgs.r, 0, 0); L.hx.putImageData(imgs.h, 0, 0);
  const sty = { c: null, r: null, h: null };
  const feat = (styles, path, fill = false, lw = 1) => L.each((x, k) => { if (!styles[k]) return; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round'; if (fill) { x.fillStyle = styles[k]; x.fill(path); } else { x.strokeStyle = styles[k]; x.stroke(path); } });
  void sty;
  // repair patches: newer, darker, smoother asphalt with a crisp sealed edge
  for (let k = 0; k < 4; k++) {
    const lane = Math.floor(r() * 4), x0 = (LANE0 + lane * 3.7 + r() * 1.2) * pxX, w = (0.8 + r() * 2.2) * pxX, y0 = r() * H, h = (0.8 + r() * 4) * pxY;
    const p = new Path2D(); p.rect(x0, y0, w, h);
    feat({ c: `rgba(40,37,34,${0.12 + r() * 0.1})`, r: grey(0.76, 0.5), h: grey(0.3, 0.3) }, p, true);
    feat({ c: 'rgba(24,22,21,0.55)', r: grey(0.45, 0.9), h: grey(0.7, 0.8) }, p, false, 2);
  }
  // longitudinal construction seams near the lane lines + transverse cracks + meandering sealant
  for (const lx of [LANE0, 5.3, 9.0, 12.7, LANE1]) {
    const p = new Path2D(); let x = (lx + 0.28 + (r() - 0.5) * 0.08) * pxX; p.moveTo(x, -4);
    for (let y = 0; y <= H + 8; y += 24) { x += (r() - 0.5) * 3; p.lineTo(x, y); }
    feat({ c: 'rgba(52,46,40,0.32)', r: grey(0.42), h: grey(0.6) }, p, false, 2.2);
  }
  for (let k = 0; k < 17; k++) {
    const p = new Path2D(); let x = r() * W, y = r() * H, ang = k < 6 ? (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.4 : r() * Math.PI * 2;
    p.moveTo(x, y); const steps = 10 + r() * (k < 6 ? 60 : 30);
    for (let s = 0; s < steps; s++) { ang += (r() - 0.5) * 0.9; x += Math.cos(ang) * 9; y += Math.sin(ang) * 9; p.lineTo(x, y); }
    feat({ c: `rgba(58,50,43,${0.14 + r() * 0.12})`, r: grey(0.45), h: grey(0.55) }, p, false, 0.8 + r() * 1.0);
    feat({ c: 'rgba(20,18,16,0.18)', r: null, h: grey(0.1) }, p, false, 0.5);
  }
  // oil spots along the lane centres
  for (let k = 0; k < 70; k++) {
    const lane = Math.floor(r() * 4), cx = (LANE0 + lane * 3.7 + 1.85 + (r() - 0.5) * 0.7) * pxX, cy = r() * H, rr0 = 3 + r() * 14;
    const p = new Path2D(); p.ellipse(cx, cy, rr0 * (0.35 + r() * 0.3), rr0 * (1.6 + r() * 1.6), (r() - 0.5) * 0.3, 0, Math.PI * 2);
    feat({ c: `rgba(22,18,14,${0.07 + r() * 0.12})`, r: grey(0.3, 0.7), h: null }, p, true);
  }
  // skid marks (somebody else had a Bay day too)
  for (let k = 0; k < 3; k++) {
    const x0 = (LANE0 + 0.6 + r() * 13) * pxX, y0 = r() * H * 0.6, len = (6 + r() * 8) * pxY, bend = (r() - 0.5) * 2.2 * pxX;
    for (const off of [0, 1.6 * pxX]) {
      const p = new Path2D(); p.moveTo(x0 + off, y0); p.quadraticCurveTo(x0 + off + bend * 0.3, y0 + len * 0.5, x0 + off + bend, y0 + len);
      feat({ c: 'rgba(12,11,10,0.32)', r: grey(0.55, 0.6), h: null }, p, false, 0.2 * pxX);
    }
  }
  // rumble strips on the shoulders (grooves) + shoulder gravel / litter
  for (const sx of [0.55, 16.85]) for (let y = 0; y < H; y += 5) {
    const p = new Path2D(); p.rect(sx * pxX, y, 0.45 * pxX, 2);
    feat({ c: 'rgba(0,0,0,0.3)', r: null, h: grey(0.05, 0.8) }, p, true);
  }
  for (let k = 0; k < 1400; k++) {
    const xm = r() < 0.5 ? r() * (LANE0 - 0.1) : LANE1 + 0.2 + r() * (ROAD.width - LANE1 - 0.2);
    const p = new Path2D(); const s = 1 + r() * 3; p.ellipse(xm * pxX, r() * H, s, s * (0.6 + r() * 0.6), r() * 3, 0, Math.PI * 2);
    const lit = r() < 0.6, v = lit ? 0.55 + r() * 0.3 : 0.12 + r() * 0.1;
    feat({ c: `rgba(${v * 255 | 0},${v * 240 | 0},${v * 215 | 0},0.85)`, r: null, h: grey(lit ? 0.85 : 0.2) }, p, true);
  }
  for (let k = 0; k < 14; k++) { // tire shreds on the shoulders
    const xm = r() < 0.5 ? 0.2 + r() * 1.1 : 16.7 + r() * 2;
    const p = new Path2D(); const cx = xm * pxX, cy = r() * H, a = r() * 6, l = 10 + r() * 30;
    p.moveTo(cx, cy); p.quadraticCurveTo(cx + Math.cos(a) * l * 0.5 + 6, cy + Math.sin(a) * l * 0.5, cx + Math.cos(a) * l, cy + Math.sin(a) * l);
    feat({ c: 'rgba(14,14,15,0.9)', r: grey(0.8), h: grey(0.8) }, p, false, 3 + r() * 4);
  }
  const map = tex(L.c, { aniso: 16 });
  const roughnessMap = tex(L.r, { srgb: false, aniso: 16 });
  const hd = L.hx.getImageData(0, 0, W, H).data, hh = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) hh[i] = hd[i * 4] / 255;
  const normalMap = heightToNormal(hh, W, H, 1.6);
  normalMap.anisotropy = 16;
  return { map, normalMap, roughnessMap };
}

// ---------- generic tileable surfaces ----------
export function concreteTexture(seed = 5, tint = [0.62, 0.58, 0.52], size = 256, streaks = true) {
  const W = size, H = size;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const n = makeNoise(seed, 64), n2 = makeNoise(seed + 7, 16);
  const r = makeRng(seed * 13);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    let b = 0.85 + (fbm(n, u, v, 4, 5) - 0.5) * 0.35 + (r() - 0.5) * 0.06;
    if (streaks) b -= Math.max(0, fbm(n2, u * 3, v * 0.3, 2, 3) - 0.55) * 0.9 * (0.4 + v * 0.8);
    const i = (y * W + x) * 4;
    img.data[i] = tint[0] * b * 255; img.data[i + 1] = tint[1] * b * 255; img.data[i + 2] = tint[2] * b * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

// Verge / embankment: 1024² covers 16 m. Dry straw grass, bare dirt, gravel, rocks and freeway litter.
export function groundTexture() {
  const W = 768, H = 768;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const n = makeNoise(77, 64), n2 = makeNoise(78, 32), n3 = makeNoise(79, 256), n4 = makeNoise(80, 16);
  const r = makeRng(5);
  const straw = [0.66, 0.57, 0.36], olive = [0.5, 0.49, 0.3], dirt = [0.62, 0.49, 0.36], gravel = [0.57, 0.55, 0.51];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const m = fbm(n, u, v, 3, 4), g = fbm(n2, u, v, 10, 2), f = n3(u * 256, v * 256), q = fbm(n4, u, v, 6, 2);
    const tDirt = Math.min(1, Math.max(0, (m - 0.45) * 4.5));
    const tGrav = Math.min(1, Math.max(0, (q - 0.6) * 6)) * (1 - tDirt * 0.5);
    const tOl = Math.min(1, Math.max(0, (0.42 - g) * 5));
    const k = r();
    let col = straw.map((s, i) => s * (1 - tOl) + olive[i] * tOl);
    col = col.map((s, i) => s * (1 - tDirt) + dirt[i] * tDirt);
    col = col.map((s, i) => s * (1 - tGrav) + gravel[i] * tGrav);
    // grass blades / tufts: high-frequency light/dark, strongest where it's grassy
    const grassK = (1 - tDirt) * (1 - tGrav);
    let d = (f - 0.5) * 0.35 * grassK + (k - 0.5) * (0.12 + 0.2 * tGrav);
    if (grassK > 0.4 && k > 0.93) d += 0.22; // sunlit blade tips
    if (k < 0.05) d -= 0.25; // pebble shadows / gaps
    const i = (y * W + x) * 4;
    img.data[i] = Math.min(255, col[0] * (1 + d) * 255); img.data[i + 1] = Math.min(255, col[1] * (1 + d) * 255); img.data[i + 2] = Math.min(255, col[2] * (1 + d) * 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // grass tufts (short strokes, radiating)
  for (let t = 0; t < 900; t++) {
    const cx = r() * W, cy = r() * H; if (fbm(n, cx / W, cy / H, 3, 5) > 0.5) continue;
    const s = 4 + r() * 9, nb = 5 + r() * 6, lit = r();
    for (let b = 0; b < nb; b++) {
      const a = r() * Math.PI * 2, l = s * (0.5 + r() * 0.6), v = 0.35 + lit * 0.4 + r() * 0.15;
      ctx.strokeStyle = `rgba(${v * 230 | 0},${v * 200 | 0},${v * 120 | 0},0.7)`; ctx.lineWidth = 1 + r();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke();
    }
  }
  // rocks with a sun-side highlight and contact shadow
  for (let k = 0; k < 160; k++) {
    const cx = r() * W, cy = r() * H, s = 2 + Math.pow(r(), 3) * 16, v = 0.45 + r() * 0.3;
    ctx.fillStyle = 'rgba(30,24,18,0.45)'; ctx.beginPath(); ctx.ellipse(cx + s * 0.3, cy + s * 0.35, s * 1.05, s * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgb(${v * 255 | 0},${v * 245 | 0},${v * 228 | 0})`; ctx.beginPath(); ctx.ellipse(cx, cy, s, s * (0.6 + r() * 0.3), r() * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,220,0.3)'; ctx.beginPath(); ctx.ellipse(cx - s * 0.25, cy - s * 0.25, s * 0.45, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // freeway litter: paper, cans, bottle glass, tyre scraps, a hubcap
  for (let k = 0; k < 60; k++) {
    const cx = r() * W, cy = r() * H, kind = r();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(r() * 6);
    if (kind < 0.35) { ctx.fillStyle = `rgba(${225 + r() * 30 | 0},${220 + r() * 30 | 0},${205 + r() * 30 | 0},0.92)`; ctx.fillRect(-6, -4, 8 + r() * 10, 6 + r() * 6); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-6, 2, 14, 2); }
    else if (kind < 0.55) { const cc = [[190, 30, 25], [200, 200, 205], [40, 90, 170]][Math.floor(r() * 3)]; ctx.fillStyle = `rgb(${cc})`; ctx.fillRect(-5, -2.5, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-5, -2.5, 10, 1.2); }
    else if (kind < 0.72) { ctx.fillStyle = r() < 0.5 ? 'rgba(60,110,50,0.85)' : 'rgba(120,70,30,0.85)'; ctx.fillRect(-7, -2, 14, 4); ctx.fillStyle = 'rgba(255,255,240,0.8)'; ctx.fillRect(-4, -1.5, 5, 1); }
    else if (kind < 0.95) { ctx.strokeStyle = 'rgba(16,16,17,0.95)'; ctx.lineWidth = 4 + r() * 4; ctx.beginPath(); ctx.arc(0, 0, 14 + r() * 16, 0, 0.8 + r()); ctx.stroke(); }
    else { ctx.fillStyle = 'rgb(180,182,186)'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgb(90,92,96)'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  return tex(c, { aniso: 8 });
}
// Large-scale variation multiplied over the ground (linear, 0.5 = neutral): watered patches, burnt grass, bare dirt
export function groundMacroTexture() {
  const S = 256; const c = canvas(S, S), ctx = c.getContext('2d'); const img = ctx.createImageData(S, S);
  const n = makeNoise(91, 16), n2 = makeNoise(92, 32);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, a = fbm(n, u, v, 3, 4), b = fbm(n2, u, v, 6, 3);
    let R = 0.5, G = 0.5, B = 0.5;
    const green = Math.min(1, Math.max(0, (a - 0.58) * 5)), burnt = Math.min(1, Math.max(0, (0.38 - a) * 5)), bare = Math.min(1, Math.max(0, (b - 0.6) * 5));
    R += -0.07 * green - 0.1 * burnt + 0.04 * bare; G += 0.03 * green - 0.11 * burnt + 0.0 * bare; B += -0.06 * green - 0.1 * burnt - 0.02 * bare;
    const k = 0.92 + (fbm(n2, u, v, 12, 2) - 0.5) * 0.25;
    const i = (y * S + x) * 4; img.data[i] = R * k * 255; img.data[i + 1] = G * k * 255; img.data[i + 2] = B * k * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { srgb: false, aniso: 4 });
}

// Back of an overhead sign: galvanised extruded panels, rivets, grime
export function signBackTexture() {
  const W = 512, H = 256; const c = canvas(W, H), x = c.getContext('2d');
  const n = makeNoise(61, 32); const r = makeRng(62);
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const b = 0.6 + (fbm(n, xx / W, y / H * 0.5, 6, 4) - 0.5) * 0.22 + (r() - 0.5) * 0.05;
    const i = (y * W + xx) * 4; img.data[i] = b * 240; img.data[i + 1] = b * 242; img.data[i + 2] = b * 246; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  for (let k = 1; k < 8; k++) { const y = k * H / 8; x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, y - 1.5, W, 3); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, y + 1.5, W, 1.5); }
  for (let k = 0; k < 6; k++) { const xx = 20 + k * (W - 40) / 5; for (let y = 8; y < H; y += 16) { x.fillStyle = 'rgba(30,30,32,0.7)'; x.fillRect(xx - 1.5, y - 1.5, 3, 3); } }
  for (let k = 0; k < 220; k++) { x.fillStyle = `rgba(60,48,36,${0.04 + r() * 0.08})`; x.fillRect(r() * W, r() * H * 0.6, 2 + r() * 4, 20 + r() * 80); }
  x.fillStyle = 'rgba(40,40,42,0.85)'; x.font = '600 14px Oswald, sans-serif'; x.fillText('CALTRANS  D7  0412-B', 24, H - 14);
  return tex(c, { repeat: false });
}

export function metalTexture(seed = 3) {
  const W = 128, H = 128;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const n = makeNoise(seed, 32);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const b = 0.75 + (fbm(n, x / W, y / H * 0.2, 4, 4) - 0.5) * 0.4;
    const i = (y * W + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = b * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

// ---------- palms ----------
export function palmFrondTexture() {
  const W = 128, H = 512;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const r = makeRng(42);
  ctx.clearRect(0, 0, W, H);
  // leaflets: lines from rib out to the sides, drooping
  for (let y = 10; y < H - 4; y += 3) {
    const t = y / H;
    const len = (Math.sin(t * Math.PI) * 0.85 + 0.15) * (W * 0.5) * (0.85 + r() * 0.3);
    for (const side of [-1, 1]) {
      const g = 60 + r() * 50;
      ctx.strokeStyle = `rgb(${g * 0.55 | 0},${g | 0},${g * 0.35 | 0})`;
      ctx.lineWidth = 1.6 + r();
      ctx.beginPath();
      ctx.moveTo(W / 2, y);
      ctx.quadraticCurveTo(W / 2 + side * len * 0.6, y + 6, W / 2 + side * len, y + 18 + r() * 14);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgb(70,64,34)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  const t = tex(c, { repeat: false });
  return t;
}
export function palmBarkTexture() {
  const W = 64, H = 256;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const r = makeRng(8);
  for (let y = 0; y < H; y += 1) {
    const ring = (y % 12) / 12;
    const b = 0.42 + (ring < 0.25 ? -0.14 : 0) + (r() - 0.5) * 0.05;
    ctx.fillStyle = `rgb(${b * 255 * 1.05 | 0},${b * 255 * 0.88 | 0},${b * 255 * 0.66 | 0})`;
    ctx.fillRect(0, y, W, 1);
  }
  return tex(c);
}

// ---------- buildings ----------
export function facadeTextures(seed, { cols = 8, rows = 16, warm = 0.18, style = 0 } = {}) {
  const W = 256, H = 512;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const e = canvas(W, H), ectx = e.getContext('2d');
  const r = makeRng(seed);
  const wall = style === 0 ? [92, 86, 84] : style === 1 ? [120, 108, 92] : [70, 78, 88];
  ctx.fillStyle = `rgb(${wall})`; ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);
  // noise
  for (let k = 0; k < 4000; k++) {
    ctx.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
    ctx.fillRect(r() * W, r() * H, 2 + r() * 6, 2 + r() * 6);
  }
  const cw = W / cols, rh = H / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * cw + cw * 0.14, y = j * rh + rh * 0.2, w = cw * 0.72, h = rh * 0.58;
    const lit = r() < warm;
    const glass = 28 + r() * 30;
    ctx.fillStyle = lit ? `rgb(${200 + r() * 55 | 0},${150 + r() * 50 | 0},${80 + r() * 40 | 0})` : `rgb(${glass * 0.8 | 0},${glass * 0.9 | 0},${glass * 1.1 | 0})`;
    ctx.fillRect(x, y, w, h);
    if (lit) {
      ectx.fillStyle = `rgb(${230 + r() * 25 | 0},${160 + r() * 50 | 0},${80 + r() * 40 | 0})`;
      ectx.fillRect(x, y, w, h);
    }
  }
  return { map: tex(c), emissiveMap: tex(e) };
}

// Distant skyline strip: silhouette + lit windows (RGBA, alpha = silhouette)
export function skylineTexture(seed) {
  const W = 2048, H = 256;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const r = makeRng(seed);
  ctx.clearRect(0, 0, W, H);
  let x = 0;
  while (x < W) {
    const w = 18 + r() * 60;
    const tall = r() < 0.12;
    const h = (tall ? 120 + r() * 120 : 30 + r() * 90);
    const shade = 30 + r() * 25;
    ctx.fillStyle = `rgb(${shade + 8 | 0},${shade | 0},${shade + 14 | 0})`;
    ctx.fillRect(x, H - h, w, h);
    if (tall && r() < 0.5) { ctx.fillRect(x + w * 0.45, H - h - 25, 2, 25); }
    // windows
    for (let wy = H - h + 6; wy < H - 4; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) {
      if (r() < 0.16) {
        ctx.fillStyle = `rgba(255,${180 + r() * 60 | 0},${90 + r() * 60 | 0},${0.5 + r() * 0.5})`;
        ctx.fillRect(wx, wy, 2, 2);
      }
    }
    x += w + (r() < 0.3 ? r() * 12 : 0);
  }
  const t = tex(c, { repeat: true });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------- sprites ----------
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,200,120,0.35)') {
  const S = 128; const c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner); g.addColorStop(0.18, mid); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return tex(c, { repeat: false });
}
export function streakTexture() {
  const W = 512, H = 64; const c = canvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / W - 0.5) * 2, v = (y / H - 0.5) * 2;
    const a = Math.exp(-v * v * 40) * Math.pow(1 - Math.abs(u), 2.2) + Math.exp(-(u * u + v * v) * 30) * 0.6;
    const i = (y * W + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 230; img.data[i + 2] = 200; img.data[i + 3] = Math.min(255, a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}
export function ringTexture() {
  const S = 256; const c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,230,200,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return tex(c, { repeat: false });
}
export function scorchTexture() {
  const S = 256; const c = canvas(S, S), ctx = c.getContext('2d');
  const n = makeNoise(4, 16);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x / S - 0.5, dy = y / S - 0.5;
    const d = Math.hypot(dx, dy) * 2;
    const nn = fbm(n, x / S, y / S, 3, 4);
    const a = Math.max(0, 1 - d * (0.8 + nn * 0.6)) ;
    const i = (y * S + x) * 4;
    img.data[i] = 10; img.data[i + 1] = 8; img.data[i + 2] = 6; img.data[i + 3] = Math.min(255, a * 1.6 * 255);
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}
export function bulletHoleTexture() {
  const S = 64; const c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.18, 'rgba(10,10,10,1)');
  g.addColorStop(0.28, 'rgba(190,190,195,0.9)'); g.addColorStop(0.45, 'rgba(60,60,60,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return tex(c, { repeat: false });
}
export function crackedGlassTexture() {
  const S = 256; const c = canvas(S, S), ctx = c.getContext('2d');
  const r = makeRng(31);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(230,235,240,0.85)';
  for (let k = 0; k < 4; k++) {
    const cx = r() * S, cy = r() * S;
    for (let a = 0; a < 14; a++) {
      let x = cx, y = cy, ang = a / 14 * Math.PI * 2 + r() * 0.3;
      ctx.lineWidth = 1 + r();
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) { ang += (r() - 0.5) * 0.5; x += Math.cos(ang) * 14; y += Math.sin(ang) * 14; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    for (let ring = 1; ring < 4; ring++) {
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, ring * 14 + r() * 6, 0, Math.PI * 2); ctx.stroke();
    }
  }
  return tex(c, { repeat: false });
}

// Highway sign
export function signTexture(lines, { arrow = true, exit = null } = {}) {
  const W = 512, H = 256; const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#0c5a34'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#f2f2ea'; ctx.lineWidth = 8; ctx.strokeRect(10, 10, W - 20, H - 20);
  // grime
  const r = makeRng(lines.join('').length * 7);
  for (let k = 0; k < 600; k++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.08})`; ctx.fillRect(r() * W, r() * H * 1.0, 3, 3 + r() * 20); }
  ctx.fillStyle = '#f4f4ec';
  ctx.font = '700 64px Oswald, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const yy = lines.length === 1 ? [H * 0.42] : [H * 0.3, H * 0.56];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, yy[i]));
  if (arrow) {
    ctx.beginPath();
    const ax = W / 2, ay = H * 0.82;
    ctx.moveTo(ax, ay - 24); ctx.lineTo(ax + 22, ay + 2); ctx.lineTo(ax + 8, ay + 2); ctx.lineTo(ax + 8, ay + 26);
    ctx.lineTo(ax - 8, ay + 26); ctx.lineTo(ax - 8, ay + 2); ctx.lineTo(ax - 22, ay + 2); ctx.closePath(); ctx.fill();
  }
  if (exit) {
    ctx.fillStyle = '#0c5a34'; ctx.fillRect(W - 190, 0, 180, 54);
    ctx.strokeRect(W - 190, 10, 180, 44);
    ctx.fillStyle = '#f4f4ec'; ctx.font = '600 34px Oswald, sans-serif'; ctx.fillText(exit, W - 100, 34);
  }
  return tex(c, { repeat: false });
}

export function billboardTexture(kind) {
  const W = 512, H = 192; const c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  if (kind === 0) {
    g.addColorStop(0, '#d22b1f'); g.addColorStop(1, '#7d0d0a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe9c4'; ctx.font = '400 92px Anton, Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('KABLAM', 30, H * 0.45);
    ctx.font = '600 30px Oswald, sans-serif'; ctx.fillText('ENERGY DRINK — NOW 40% LOUDER', 34, H * 0.83);
  } else if (kind === 1) {
    g.addColorStop(0, '#0f2742'); g.addColorStop(1, '#1d5e8c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f5b335'; ctx.font = '400 76px Anton, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('HAVEN CITY', W / 2, H * 0.42);
    ctx.fillStyle = '#fff'; ctx.font = '500 30px Oswald, sans-serif'; ctx.fillText('WHERE EVERY DAY IS GOLDEN HOUR', W / 2, H * 0.8);
  } else if (kind === 3) {
    g.addColorStop(0, '#111'); g.addColorStop(1, '#2b2b2b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff6a1a'; ctx.font = '400 84px Anton, Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('EXPLOSIONS 4', 26, H * 0.42);
    ctx.fillStyle = '#ddd'; ctx.font = '600 28px Oswald, sans-serif'; ctx.fillText('IN THEATERS FRIDAY  •  RATED R FOR RELENTLESSNESS', 30, H * 0.82);
  } else if (kind === 4) {
    g.addColorStop(0, '#f6d23a'); g.addColorStop(1, '#e08a14');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a1208'; ctx.font = '400 72px Anton, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CHASE GONE BAD? CALL VINNY', W / 2, H * 0.42);
    ctx.font = '700 32px Oswald, sans-serif'; ctx.fillText('1-800-WRECKED', W / 2, H * 0.8);
  } else {
    g.addColorStop(0, '#f0e2c0'); g.addColorStop(1, '#c9a56a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#20140a'; ctx.font = '400 70px Anton, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('DUSTY\'S DINER', W / 2, H * 0.42);
    ctx.font = '600 30px Oswald, sans-serif'; ctx.fillText('EXIT 42B  •  OPEN 24 HRS', W / 2, H * 0.8);
  }
  return tex(c, { repeat: false });
}

// Text texture for HUD/3D callouts. Returns {texture, aspect}
export function textTexture(text, { font = 'Anton', size = 120, color = 'chrome', stroke = 8, glow = 'rgba(255,120,20,0.9)', padding = 40, sub = null } = {}) {
  const meas = canvas(8, 8).getContext('2d');
  meas.font = `400 ${size}px ${font}, Impact, sans-serif`;
  let tw = meas.measureText(text).width;
  if (sub) { meas.font = `500 ${size * 0.3}px Oswald, sans-serif`; tw = Math.max(tw, meas.measureText(sub).width); meas.font = `400 ${size}px ${font}, Impact, sans-serif`; }
  const W = Math.ceil(tw + padding * 2), H = Math.ceil(size * 1.35 + padding * 2 + (sub ? size * 0.4 : 0));
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.font = meas.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cy = padding + size * 0.68;
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.35; }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10,6,2,0.95)'; ctx.lineWidth = stroke * 2;
  ctx.strokeText(text, W / 2, cy);
  ctx.shadowBlur = 0;
  let fill;
  if (color === 'chrome') {
    fill = ctx.createLinearGradient(0, cy - size * 0.55, 0, cy + size * 0.55);
    fill.addColorStop(0, '#ffffff'); fill.addColorStop(0.42, '#e8d2b0'); fill.addColorStop(0.5, '#6a4a2c');
    fill.addColorStop(0.58, '#ffc46b'); fill.addColorStop(1, '#fff2d6');
  } else if (color === 'fire') {
    fill = ctx.createLinearGradient(0, cy - size * 0.55, 0, cy + size * 0.55);
    fill.addColorStop(0, '#fff6c8'); fill.addColorStop(0.45, '#ffb21a'); fill.addColorStop(1, '#e2340b');
  } else fill = color;
  ctx.fillStyle = fill;
  ctx.fillText(text, W / 2, cy);
  // top sheen line
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, cy - size * 0.5, W, size * 0.12);
  ctx.globalCompositeOperation = 'source-over';
  if (sub) {
    ctx.font = `500 ${size * 0.3}px Oswald, sans-serif`;
    ctx.fillStyle = '#ffe7c2';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
    ctx.fillText(sub, W / 2, cy + size * 0.78);
  }
  const t = tex(c, { repeat: false, aniso: 4 });
  return { texture: t, aspect: W / H, canvas: c };
}

// LA-style freeway sound wall: split-face block panels, ivy creeping from the base, a few tags.
export function soundWallTexture(seed = 21) {
  const W = 512, H = 512; // covers 10m wide x 5m tall
  const c = canvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const n = makeNoise(seed, 64), n2 = makeNoise(seed + 3, 16), n3 = makeNoise(seed + 9, 32);
  const r = makeRng(seed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    // block courses: 0.2m tall rows, 0.4m blocks, running bond
    const row = Math.floor(v * 25);
    const bx = (u * 25 + (row % 2) * 0.5) % 1;
    const by = (v * 25) % 1;
    const mortar = (bx < 0.04 || by < 0.08) ? 0.78 : 1.0;
    let b = (0.74 + (fbm(n, u, v, 8, 4) - 0.5) * 0.22 + (r() - 0.5) * 0.08) * mortar;
    // grime streaks from the top
    b -= Math.max(0, fbm(n2, u * 4, v * 0.25, 2, 3) - 0.5) * 0.5 * (1 - v * 0.6);
    // pilaster every 5m (half texture)
    const pil = (u % 0.5) < 0.035;
    if (pil) b *= 0.82;
    let col = [0.78 * b, 0.70 * b, 0.60 * b];
    // ivy from the bottom (v increases downward in canvas)
    const ivyH = 0.18 + fbm(n3, u, 0.5, 6, 4) * 0.5;
    const ivyN = fbm(n3, u * 4, v * 4, 16, 4);
    const leaf = r();
    if (1 - v < ivyH * (0.6 + ivyN * 0.8) && ivyN > 0.42 && leaf > 0.18) {
      const g = 0.12 + ivyN * 0.28 + (leaf - 0.5) * 0.14;
      col = [g * 0.5, g * 0.66, g * 0.32];
    }
    const i = (y * W + x) * 4;
    img.data[i] = Math.min(255, col[0] * 255); img.data[i + 1] = Math.min(255, col[1] * 255); img.data[i + 2] = Math.min(255, col[2] * 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // graffiti tags
  const tags = ['BAY', 'K-RAD', 'BOOM', '405', 'DUSK'];
  for (let k = 0; k < 1; k++) {
    ctx.save();
    ctx.translate(60 + r() * (W - 220), 170 + r() * 90);
    ctx.rotate((r() - 0.5) * 0.2);
    ctx.font = `400 ${50 + r() * 30}px Anton, Impact`;
    const hue = [['#d43a2a', '#1a1a1a'], ['#3a7bd4', '#f2f2f2'], ['#e0b02a', '#2a1a10']][k % 3];
    ctx.lineWidth = 6; ctx.strokeStyle = hue[1]; ctx.globalAlpha = 0.5;
    const t = tags[Math.floor(r() * tags.length)];
    ctx.strokeText(t, 0, 0); ctx.fillStyle = hue[0]; ctx.fillText(t, 0, 0);
    ctx.restore();
  }
  return tex(c, { aniso: 8 });
}

export function shrubTexture(seed = 3, tint = [0.32, 0.46, 0.2], flowers = null) {
  const W = 256, H = 256; const c = canvas(W, H), ctx = c.getContext('2d');
  const r = makeRng(seed);
  ctx.clearRect(0, 0, W, H);
  for (let k = 0; k < 900; k++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 118;
    const x = W / 2 + Math.cos(a) * d, y = H * 0.58 + Math.sin(a) * d * 0.75;
    if (y > H - 4) continue;
    const g = 0.55 + r() * 0.6;
    const shade = (y / H) * 0.45 + 0.75;
    ctx.fillStyle = `rgb(${tint[0] * g * 255 / shade | 0},${tint[1] * g * 255 / shade | 0},${tint[2] * g * 255 / shade | 0})`;
    ctx.beginPath(); ctx.ellipse(x, y, 3 + r() * 5, 1.5 + r() * 2.5, r() * 3, 0, Math.PI * 2); ctx.fill();
    if (flowers && r() < 0.06) { ctx.fillStyle = flowers; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  return tex(c, { repeat: false });
}

export function blobShadowTexture() {
  const S = 128; const c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.55, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return tex(c, { repeat: false, srgb: false });
}

// Varied stucco/concrete mid-rise facades (LA: beige, terracotta, pastel, glass)
export function facadeTextures2(seed, floors, bays) {
  const W = 512, H = 512;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const e = canvas(W, H), ectx = e.getContext('2d');
  const r = makeRng(seed);
  const palettes = [[198, 172, 138], [184, 120, 92], [214, 196, 170], [168, 160, 150], [205, 170, 160], [120, 134, 146]];
  const base = palettes[Math.floor(r() * palettes.length)];
  const glassy = r() < 0.25;
  ctx.fillStyle = `rgb(${base})`; ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, W, H);
  for (let k = 0; k < 6000; k++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.05})`; ctx.fillRect(r() * W, r() * H, 1 + r() * 4, 1 + r() * 4); }
  const fh = H / floors, bw = W / bays;
  const winW = glassy ? 0.9 : 0.5 + r() * 0.25, winH = glassy ? 0.8 : 0.45 + r() * 0.2;
  for (let j = 0; j < floors; j++) {
    // floor band
    ctx.fillStyle = `rgba(0,0,0,0.12)`; ctx.fillRect(0, j * fh, W, fh * 0.07);
    ctx.fillStyle = `rgba(255,255,255,0.08)`; ctx.fillRect(0, j * fh + fh * 0.07, W, fh * 0.03);
    for (let i = 0; i < bays; i++) {
      const x = i * bw + bw * (1 - winW) / 2, y = j * fh + fh * (1 - winH) * 0.6, w = bw * winW, h = fh * winH;
      const lit = r() < 0.12;
      const blinds = r() < 0.3;
      const gl = 30 + r() * 26;
      // frame
      ctx.fillStyle = 'rgba(40,34,30,0.9)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      // glass reflects sky: gradient
      const gg = ctx.createLinearGradient(0, y, 0, y + h);
      gg.addColorStop(0, `rgb(${gl * 2.2 | 0},${gl * 1.7 | 0},${gl * 1.6 | 0})`); gg.addColorStop(1, `rgb(${gl * 0.7 | 0},${gl * 0.8 | 0},${gl | 0})`);
      ctx.fillStyle = lit ? `rgb(${220 + r() * 35 | 0},${160 + r() * 50 | 0},${90 + r() * 30 | 0})` : gg;
      ctx.fillRect(x, y, w, h);
      if (blinds && !lit) { ctx.fillStyle = 'rgba(200,190,170,0.5)'; for (let b = 0; b < h * 0.5; b += 3) ctx.fillRect(x, y + b, w, 1.5); }
      if (lit) { const tv = r() < 0.2; ectx.fillStyle = tv ? 'rgb(120,160,255)' : `rgb(${230 + r() * 25 | 0},${150 + r() * 60 | 0},${70 + r() * 40 | 0})`; ectx.fillRect(x, y, w, h); }
      if (!glassy) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 2, y + h + 2, w + 4, 3); }
    }
  }
  // storefront at the bottom
  ctx.fillStyle = 'rgba(20,16,14,0.9)'; ctx.fillRect(0, H - fh, W, fh);
  for (let i = 0; i < bays; i++) if (r() < 0.6) { ectx.fillStyle = `rgb(${200 + r() * 55 | 0},${120 + r() * 60 | 0},${60 + r() * 40 | 0})`; ectx.fillRect(i * bw + 4, H - fh + 6, bw - 8, fh - 10); ctx.fillStyle = '#c9a070'; ctx.fillRect(i * bw + 4, H - fh + 6, bw - 8, fh - 10); }
  return { map: tex(c), emissiveMap: tex(e) };
}
export { makeNoise, fbm, canvas as makeCanvas, tex as canvasTex, heightToNormal };

// =====================================================================================
// BUILDING ATLAS — one texture for every building (1 draw call per variant).
// RGB = albedo, A = 1 - 0.5 * tint, where tint = how much the per-building instance colour applies (walls 1, glass 0).
// Regions are sampled with fract() tiling in the shader (see world.js). GL uv rects [x, y, w, h], y up.
// =====================================================================================
const SHOPS = ['LIQUOR', 'TACOS', 'NAILS', 'DONUTS', 'PHO 99', 'PAWN', 'TIRES', 'LAUNDRY', 'CHECKS CASHED', 'PHARMACY', 'VIDEO', 'INSURANCE', 'BAIL BONDS', 'BURGERS', 'DENTIST', 'WIGS', 'MATTRESS', 'TATTOO', 'BOBA', 'GUNS & AMMO', 'DISCOUNT', 'CELL REPAIR', 'BBQ', 'MOTEL'];
export function buildingAtlas() {
  const S = 2048, ES = 1024;
  const cc = canvas(S, S), c = cc.getContext('2d');
  const mc = canvas(S, S), m = mc.getContext('2d'); // alpha = 1 - 0.5 * tint (never < 0.5: keeps premultiplied RGB intact)
  const ec = canvas(ES, ES), e = ec.getContext('2d');
  c.fillStyle = '#808080'; c.fillRect(0, 0, S, S);
  m.fillStyle = '#000'; m.fillRect(0, 0, S, S);
  e.fillStyle = '#000'; e.fillRect(0, 0, ES, ES);
  const r = makeRng(2024);
  const mask = (x, y, w, h, a) => { m.clearRect(x, y, w, h); m.fillStyle = `rgba(0,0,0,${1 - 0.5 * a})`; m.fillRect(x, y, w, h); };
  const rect = (x, y, w, h, fill, a = null) => { c.fillStyle = fill; c.fillRect(x, y, w, h); if (a !== null) mask(x, y, w, h, a); };
  const glow = (x, y, w, h, fill) => { e.fillStyle = fill; e.fillRect(x / 2, y / 2, w / 2, h / 2); };
  const speckle = (x0, y0, w, h, n, a = 0.05) => { for (let k = 0; k < n; k++) { c.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * a})` : `rgba(255,255,255,${r() * a})`; c.fillRect(x0 + r() * w, y0 + r() * h, 1 + r() * 4, 1 + r() * 4); } };
  const glassGrad = (y, h, top, bot) => { const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bot); return g; };
  const LIT = () => { const k = r(); return k < 0.55 ? `rgb(${235 + r() * 20 | 0},${170 + r() * 40 | 0},${90 + r() * 40 | 0})` : k < 0.85 ? `rgb(${200 + r() * 30 | 0},${215 + r() * 25 | 0},${230 + r() * 25 | 0})` : `rgb(${90 + r() * 40 | 0},${130 + r() * 50 | 0},${230 + r() * 25 | 0})`; };
  const regions = {};
  const reg = (name, x, y, w, h, tw, th) => { regions[name] = { r: [x / S, 1 - (y + h) / S, w / S, h / S], t: [tw, th] }; };

  // ---- F0: stucco apartments, punched windows (12 bays x 12 floors, 3.4 x 3.3 m)
  {
    const X0 = 0, Y0 = 0, N = 12, bp = 1024 / N, fp = 1024 / N;
    rect(X0, Y0, 1024, 1024, 'rgb(236,229,216)', 1);
    speckle(X0, Y0, 1024, 1024, 9000, 0.06);
    const colType = []; for (let i = 0; i < N; i++) colType.push(i % 4 === 0 ? 2 : (i % 2 ? 0 : 1));
    for (let j = 0; j < N; j++) {
      const top = Y0 + (N - 1 - j) * fp;
      c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(X0, top + fp - 3, 1024, 3);
      for (let i = 0; i < N; i++) {
        const t = colType[i], bx = X0 + i * bp;
        const ww = bp * (t === 2 ? 0.34 : t === 1 ? 0.62 : 0.5), wh = fp * (t === 2 ? 0.62 : 0.5), wx = bx + (bp - ww) / 2, wy = top + fp * (t === 2 ? 0.16 : 0.22);
        const lit = r() < 0.055;
        rect(wx - 3, wy - 3, ww + 6, wh + 6, 'rgb(58,52,46)', 0);
        const k = 0.75 + r() * 0.5;
        c.fillStyle = lit ? glassGrad(wy, wh, 'rgb(225,180,120)', 'rgb(160,110,60)') : glassGrad(wy, wh, `rgb(${180 * k | 0},${154 * k | 0},${148 * k | 0})`, `rgb(${46 * k | 0},${46 * k | 0},${54 * k | 0})`);
        c.fillRect(wx, wy, ww, wh);
        const it = r();
        if (it < 0.3) { c.fillStyle = 'rgba(215,205,185,0.75)'; const bh = wh * (0.3 + r() * 0.6); for (let b = 0; b < bh; b += 3) c.fillRect(wx, wy + b, ww, 1.6); }
        else if (it < 0.45) { const cc2 = ['rgba(170,60,50,0.8)', 'rgba(200,180,120,0.8)', 'rgba(70,90,130,0.8)'][Math.floor(r() * 3)]; c.fillStyle = cc2; c.fillRect(wx, wy, ww * 0.28, wh); c.fillRect(wx + ww * 0.72, wy, ww * 0.28, wh); }
        else if (it < 0.53 && t !== 2) { c.fillStyle = 'rgb(150,150,146)'; c.fillRect(wx + ww * 0.25, wy + wh * 0.58, ww * 0.5, wh * 0.42); c.fillStyle = 'rgba(0,0,0,0.4)'; for (let b = 0; b < 5; b++) c.fillRect(wx + ww * 0.28, wy + wh * 0.64 + b * 4, ww * 0.44, 1.5); }
        if (t === 1) rect(wx + ww / 2 - 1.5, wy, 3, wh, 'rgb(58,52,46)', 0);
        if (lit) { const L = LIT(); glow(wx, wy, ww, wh, L); if (it < 0.3) { e.fillStyle = 'rgba(0,0,0,0.6)'; for (let b = 0; b < wh; b += 6) e.fillRect(wx / 2, (wy + b) / 2, ww / 2, 1); } if (it >= 0.3 && it < 0.45) { e.fillStyle = '#000'; e.fillRect(wx / 2, wy / 2, ww * 0.14, wh / 2); e.fillRect((wx + ww * 0.72) / 2, wy / 2, ww * 0.14, wh / 2); } }
        rect(wx - 6, wy + wh + 3, ww + 12, 5, 'rgb(222,216,206)', 0.3);
        const g = c.createLinearGradient(0, wy + wh + 8, 0, wy + wh + 40); g.addColorStop(0, 'rgba(70,60,50,0.22)'); g.addColorStop(1, 'rgba(70,60,50,0)');
        c.fillStyle = g; c.fillRect(wx - 2, wy + wh + 8, ww + 4, 32);
      }
    }
    reg('F0', X0, Y0, 1024, 1024, N * 3.4, N * 3.3);
  }
  // ---- F1: office ribbon windows (16 modules x 12 floors, 1.5 x 3.8 m)
  {
    const X0 = 1024, Y0 = 0, NM = 16, NF = 12, mp = 1024 / NM, fp = 1024 / NF;
    rect(X0, Y0, 1024, 1024, 'rgb(226,221,213)', 1);
    speckle(X0, Y0, 1024, 1024, 6000, 0.05);
    for (let j = 0; j < NF; j++) {
      const top = Y0 + (NF - 1 - j) * fp, gh = fp * 0.6;
      const k = 0.8 + r() * 0.35;
      rect(X0, top, 1024, gh, glassGrad(top, gh, `rgb(${168 * k | 0},${150 * k | 0},${142 * k | 0})`, `rgb(${36 * k | 0},${40 * k | 0},${50 * k | 0})`), 0);
      if (r() < 0.35) { c.fillStyle = 'rgba(205,200,188,0.7)'; c.fillRect(X0, top, 1024, gh * (0.15 + r() * 0.3)); }
      let run = 0; let L = null;
      for (let i = 0; i < NM; i++) {
        if (run <= 0 && r() < 0.035) { run = 2 + Math.floor(r() * 5); L = LIT(); }
        if (run > 0) { glow(X0 + i * mp, top, mp, gh, L); c.fillStyle = 'rgba(255,240,215,0.25)'; c.fillRect(X0 + i * mp, top, mp, gh); run--; }
        rect(X0 + i * mp - 2, top, 4, gh, 'rgb(84,86,90)', 0.3);
        if (i % 2 === 0) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(X0 + i * mp - 1, top + gh, 2, fp - gh); }
      }
      rect(X0, top + gh, 1024, 4, 'rgb(84,86,90)', 0.3);
      c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(X0, top + gh + 4, 1024, 6);
    }
    reg('F1', X0, Y0, 1024, 1024, NM * 1.5, NF * 3.8);
  }
  // ---- F2: glass curtain wall (16 x 12, 1.5 x 3.8 m), sunset reflected across the panes
  {
    const X0 = 0, Y0 = 1024, NM = 16, NF = 12, mp = 1024 / NM, fp = 1024 / NF;
    for (let j = 0; j < NF; j++) for (let i = 0; i < NM; i++) {
      const x = X0 + i * mp, y = Y0 + (NF - 1 - j) * fp, k = 0.85 + r() * 0.3;
      const tY = (NF - 1 - j) / NF;
      const top = [170 - tY * 90, 140 - tY * 70, 150 - tY * 60].map(v => v * k | 0), bot = [60 - tY * 25, 82 - tY * 30, 96 - tY * 30].map(v => v * k | 0);
      rect(x, y, mp, fp, glassGrad(y, fp, `rgb(${top})`, `rgb(${bot})`), 0);
      if (r() < 0.03) { const L = LIT(); glow(x, y + 6, mp, fp * 0.7, L); c.fillStyle = 'rgba(255,240,220,0.2)'; c.fillRect(x, y, mp, fp); }
      rect(x - 1.5, y, 3, fp, 'rgb(70,76,82)', 0.35);
    }
    for (let j = 0; j < NF; j++) { const y = Y0 + (NF - 1 - j) * fp; rect(X0, y + fp - 8, 1024, 8, 'rgb(36,42,48)', 0.2); rect(X0, y + fp - 9, 1024, 2, 'rgb(110,116,122)', 0.35); }
    reg('F2', X0, Y0, 1024, 1024, NM * 1.5, NF * 3.8);
  }
  // ---- SF0 / SF1: storefront strips (8 bays x 4.5 m, 5 m tall)
  const shopPal = [['#b8261c', '#fff4dc'], ['#f2c230', '#2a1a0c'], ['#1c4f8c', '#ffffff'], ['#2a7a48', '#f4f0e0'], ['#f0ece2', '#c0201a'], ['#1a1a1c', '#ffcc33'], ['#e86a1a', '#ffffff'], ['#7a2a7a', '#ffe0f0']];
  const store = (Y0, seed) => {
    const X0 = 1024, nb = 8, bp = 1024 / nb, H = 256;
    rect(X0, Y0, 1024, H, 'rgb(234,226,212)', 1);
    speckle(X0, Y0, 1024, H, 1500, 0.05);
    for (let i = 0; i < nb; i++) {
      const x = X0 + i * bp + 7, w = bp - 14, kind = r();
      const [bg, fg] = shopPal[Math.floor(r() * shopPal.length)];
      const name = SHOPS[Math.floor(r() * SHOPS.length)];
      const lightbox = r() < 0.45;
      rect(x, Y0 + 6, w, 52, bg, 0);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, Y0 + 54, w, 4);
      c.font = `400 ${name.length > 8 ? 22 : 32}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fg; c.fillText(name, x + w / 2, Y0 + 32, w - 10);
      if (lightbox) { e.fillStyle = bg; e.globalAlpha = 0.55; e.fillRect(x / 2, (Y0 + 6) / 2, w / 2, 26); e.globalAlpha = 1; e.font = `400 ${name.length > 8 ? 11 : 16}px Anton, Impact, sans-serif`; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillStyle = fg; e.fillText(name, (x + w / 2) / 2, (Y0 + 32) / 2, w / 2 - 5); }
      rect(x, Y0 + 62, w, 4, 'rgb(50,48,46)', 0);
      if (kind < 0.22) { // roll-down shutter
        rect(x, Y0 + 66, w, 170, 'rgb(148,148,144)', 0);
        c.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = Y0 + 68; y < Y0 + 236; y += 5) c.fillRect(x, y, w, 1.5);
        if (r() < 0.6) { c.save(); c.translate(x + w * 0.5, Y0 + 150); c.rotate((r() - 0.5) * 0.3); c.font = '400 30px Anton, Impact'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(20,20,20,0.6)'; const tg = ['K-RAD', 'BAY', 'LA', '405', 'SKRT'][Math.floor(r() * 5)]; c.strokeText(tg, 0, 0); c.fillStyle = ['#d43a2a', '#3a7bd4', '#e0b02a', '#33b060'][Math.floor(r() * 4)]; c.fillText(tg, 0, 0); c.restore(); }
      } else {
        const lit = r() < 0.28;
        rect(x, Y0 + 66, w, 170, 'rgb(64,62,60)', 0);
        c.fillStyle = lit ? glassGrad(Y0 + 70, 162, 'rgb(128,114,96)', 'rgb(66,58,50)') : glassGrad(Y0 + 70, 162, 'rgb(132,122,124)', 'rgb(30,32,38)');
        c.fillRect(x + 4, Y0 + 70, w - 8, 162);
        c.fillStyle = 'rgba(200,190,170,0.18)'; for (let s = 0; s < 3; s++) c.fillRect(x + 8, Y0 + 120 + s * 34, w - 16, 3);
        for (let p = 0; p < 2; p++) if (r() < 0.6) { c.fillStyle = shopPal[Math.floor(r() * shopPal.length)][0]; c.fillRect(x + 10 + r() * (w - 40), Y0 + 84 + r() * 60, 18, 24); }
        rect(x + w / 2 - 2, Y0 + 70, 4, 162, 'rgb(64,62,60)', 0);
        if (r() < 0.5) { rect(x + w * 0.6, Y0 + 104, w * 0.32, 128, 'rgb(40,38,36)', 0); c.fillStyle = 'rgba(140,130,120,0.5)'; c.fillRect(x + w * 0.62, Y0 + 108, w * 0.28, 120); rect(x + w * 0.64, Y0 + 168, 3, 14, 'rgb(200,200,200)', 0); }
        if (lit) { const cool = r() < 0.4, kk = 0.6 + r() * 0.4; glow(x + 4, Y0 + 70, w - 8, 162, cool ? `rgb(${78 * kk | 0},${86 * kk | 0},${92 * kk | 0})` : `rgb(${96 * kk | 0},${70 * kk | 0},${38 * kk | 0})`); e.fillStyle = 'rgba(0,0,0,0.5)'; for (let s2 = 0; s2 < 3; s2++) e.fillRect((x + 8) / 2, (Y0 + 120 + s2 * 34) / 2, (w - 16) / 2, 4); if (r() < 0.5) { e.fillStyle = 'rgb(255,40,60)'; e.fillRect((x + 12) / 2, (Y0 + 80) / 2, 14, 5); c.fillStyle = 'rgb(255,90,100)'; c.fillRect(x + 12, Y0 + 80, 28, 10); } }
      }
      rect(x - 7, Y0 + 236, w + 14, 20, 'rgb(96,92,86)', 0.2);
    }
    void seed;
  };
  store(1024, 1); reg('SF0', 1024, 1024, 1024, 256, 8 * 4.5, 5);
  store(1280, 2); reg('SF1', 1024, 1280, 1024, 256, 8 * 4.5, 5);
  // ---- 256² swatches
  const sw = (name, x, y, tw, th, fn) => { c.save(); c.beginPath(); c.rect(x, y, 256, 256); c.clip(); fn(x, y); c.restore(); reg(name, x, y, 256, 256, tw, th); };
  sw('TRIM', 1024, 1536, 4, 4, (x, y) => { rect(x, y, 256, 256, 'rgb(226,220,210)', 0.35); speckle(x, y, 256, 256, 900, 0.06); });
  sw('ROOF', 1280, 1536, 8, 8, (x, y) => { rect(x, y, 256, 256, 'rgb(132,126,118)', 0); speckle(x, y, 256, 256, 3000, 0.12); c.fillStyle = 'rgba(30,28,26,0.5)'; for (let k = 0; k < 4; k++) c.fillRect(x, y + 32 + k * 64, 256, 2); c.fillStyle = 'rgba(200,195,185,0.25)'; c.fillRect(x + 40, y + 90, 90, 60); });
  sw('WALK', 1536, 1536, 3, 3, (x, y) => { rect(x, y, 256, 256, 'rgb(190,184,174)', 0); speckle(x, y, 256, 256, 2500, 0.08); c.fillStyle = 'rgba(40,36,32,0.55)'; c.fillRect(x, y, 256, 3); c.fillRect(x, y + 128, 256, 2); c.fillRect(x, y, 3, 256); c.fillRect(x + 128, y, 2, 256); for (let k = 0; k < 30; k++) { c.fillStyle = 'rgba(40,36,34,0.35)'; c.beginPath(); c.arc(x + r() * 256, y + r() * 256, 1.5 + r() * 2, 0, Math.PI * 2); c.fill(); } c.fillStyle = 'rgba(70,60,50,0.12)'; c.beginPath(); c.ellipse(x + 180, y + 70, 40, 22, 0.4, 0, Math.PI * 2); c.fill(); });
  sw('METAL', 1792, 1536, 2, 2, (x, y) => { rect(x, y, 256, 256, 'rgb(166,168,170)', 0); for (let k = 0; k < 256; k += 16) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + k, y, 3, 256); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x + k + 3, y, 2, 256); } const g = c.createLinearGradient(0, y + 150, 0, y + 256); g.addColorStop(0, 'rgba(90,70,50,0)'); g.addColorStop(1, 'rgba(90,70,50,0.35)'); c.fillStyle = g; c.fillRect(x, y + 150, 256, 106); });
  sw('AWNS', 1024, 1792, 2, 1, (x, y) => { for (let k = 0; k < 8; k++) rect(x + k * 32, y, 32, 256, k % 2 ? 'rgb(232,224,206)' : 'rgb(176,40,34)', 0); speckle(x, y, 256, 256, 800, 0.08); });
  sw('AWNG', 1280, 1792, 2, 1, (x, y) => { rect(x, y, 256, 256, 'rgb(40,92,66)', 0); c.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 256; k += 4) c.fillRect(x, y + k, 256, 1); });
  sw('AD', 1536, 1792, 1, 1, (x, y) => { const g = c.createLinearGradient(x, y, x, y + 256); g.addColorStop(0, '#f6d23a'); g.addColorStop(1, '#e07a14'); rect(x, y, 256, 256, g, 0); c.fillStyle = '#1a1208'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '400 60px Anton, Impact'; c.fillText('MOTEL', x + 128, y + 80); c.font = '400 40px Anton, Impact'; c.fillText('VACANCY', x + 128, y + 150); c.font = '600 22px Oswald'; c.fillText('HBO • ICE • POOL', x + 128, y + 205); rect(x, y, 256, 8, '#333', 0); rect(x, y + 248, 256, 8, '#333', 0); });
  sw('DARK', 1792, 1792, 2, 2, (x, y) => { rect(x, y, 256, 256, 'rgb(34,34,36)', 0); speckle(x, y, 256, 256, 600, 0.1); });
  // ---- tint mask -> colour canvas alpha (no CPU readback)
  c.save(); c.globalCompositeOperation = 'destination-in'; c.drawImage(mc, 0, 0); c.restore();
  const map = tex(cc, { repeat: false, aniso: 4 });
  map.minFilter = THREE.LinearMipmapLinearFilter;
  const emissiveMap = tex(ec, { repeat: false, aniso: 4 });
  return { map, emissiveMap, R: regions };
}
