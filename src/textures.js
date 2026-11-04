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

// ---------- ROAD ----------
// 512 x 1024 px covers 19m wide x 20m long.
export const ROAD = { width: 19, tileLen: 20, left: -9.0 };
export function roadTextures() {
  const W = 512, H = 1024;
  const pxPerM = W / ROAD.width;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const n1 = makeNoise(11, 64), n2 = makeNoise(23, 32), n3 = makeNoise(37, 128);
  const height = new Float32Array(W * H);
  const r = makeRng(99);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const xm = x / pxPerM;
      const large = fbm(n2, u, v * 2, 2, 4);
      const fine = n3(u * 128 * 1.0, v * 256);
      const grain = r();
      let base = 0.165 + (large - 0.5) * 0.07 + (fine - 0.5) * 0.03;
      // aggregate speckle
      if (grain > 0.985) base += 0.09; else if (grain < 0.02) base -= 0.04;
      // shoulders slightly lighter/dustier
      const inLanes = xm > 1.6 && xm < 16.4;
      if (!inLanes) base += 0.035 + (fbm(n1, u, v, 8, 3) - 0.5) * 0.06;
      // tire wear: darker, smoother bands in each lane
      if (inLanes) {
        const lanePos = ((xm - 1.6) % 3.7);
        const d1 = Math.abs(lanePos - 0.95), d2 = Math.abs(lanePos - 2.75);
        const wear = Math.exp(-(d1 * d1) / 0.09) + Math.exp(-(d2 * d2) / 0.09);
        base -= wear * 0.03;
        // oil drip line at lane center
        const dc = Math.abs(lanePos - 1.85);
        base -= Math.exp(-(dc * dc) / 0.04) * 0.035 * fbm(n1, u, v, 16, 3);
      }
      height[y * W + x] = fine * 0.6 + grain * 0.4;
      const i = (y * W + x) * 4;
      // slightly cool asphalt
      img.data[i] = base * 255 * 1.06; img.data[i + 1] = base * 255 * 1.0; img.data[i + 2] = base * 255 * 0.92;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // tar patches / sealed cracks
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 7; k++) {
    const x0 = r() * W, y0 = r() * H, w = 30 + r() * 120, h = 40 + r() * 200;
    ctx.fillStyle = `rgba(18,18,22,${0.25 + r() * 0.25})`;
    ctx.fillRect(x0, y0, w, h);
  }
  ctx.strokeStyle = 'rgba(12,12,14,0.85)';
  for (let k = 0; k < 22; k++) {
    let x = r() * W, y = r() * H;
    ctx.lineWidth = 1 + r() * 2.2;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 8 + r() * 30;
    let ang = r() * Math.PI * 2;
    for (let s = 0; s < steps; s++) {
      ang += (r() - 0.5) * 1.2;
      x += Math.cos(ang) * 8; y += Math.sin(ang) * 8;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // markings
  const paint = (xm, wm, y0, y1, col) => {
    for (let y = Math.floor(y0); y < y1; y++) {
      const wobble = 0;
      for (let x = Math.floor((xm) * pxPerM); x < (xm + wm) * pxPerM; x++) {
        const wear = fbm(n1, x / W, y / H, 32, 3);
        if (wear < 0.32) continue;
        ctx.fillStyle = col;
        ctx.globalAlpha = Math.min(1, (wear - 0.3) * 3) * 0.92;
        ctx.fillRect(x + wobble, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  };
  const pxM = H / ROAD.tileLen;
  paint(1.42, 0.15, 0, H, '#d9a92a'); // yellow left edge
  paint(16.4, 0.16, 0, H, '#e8e4da'); // white right edge
  for (const lx of [5.3, 9.0, 12.7]) {
    for (let d = 0; d < 2; d++) paint(lx - 0.07, 0.14, (d * 10 + 1) * pxM, (d * 10 + 4) * pxM, '#ebe7dd');
  }
  // rumble strip on right shoulder
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < H; y += 6) ctx.fillRect(16.8 * pxPerM, y, 0.5 * pxPerM, 3);
  for (let y = 0; y < H; y += 6) ctx.fillRect(0.6 * pxPerM, y, 0.5 * pxPerM, 3);

  const map = tex(c, { aniso: 16 });
  const normalMap = heightToNormal(height, W, H, 1.2);
  normalMap.anisotropy = 16;
  return { map, normalMap };
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

export function groundTexture() {
  const W = 512, H = 512;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  const n = makeNoise(77, 64), n2 = makeNoise(78, 32);
  const r = makeRng(5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const m = fbm(n, u, v, 3, 5);
    const g = fbm(n2, u, v, 12, 3);
    // dry grass (olive/ochre) vs dirt
    const grass = [0.46, 0.42, 0.24], dirt = [0.52, 0.40, 0.28], dark = [0.25, 0.25, 0.15];
    let t = Math.min(1, Math.max(0, (m - 0.42) * 4));
    let col = grass.map((gv, k) => gv * (1 - t) + dirt[k] * t);
    const d = (g - 0.5) * 0.5 + (r() - 0.5) * 0.12;
    col = col.map((cv, k) => cv * (1 + d) * (1 - 0.3 * (g > 0.62 ? 1 : 0)) + (g > 0.66 ? dark[k] * 0.2 : 0));
    const i = (y * W + x) * 4;
    img.data[i] = col[0] * 255; img.data[i + 1] = col[1] * 255; img.data[i + 2] = col[2] * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, { aniso: 8 });
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
    ctx.fillText('HURT IN A CHASE? CALL VINNY', W / 2, H * 0.42);
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
