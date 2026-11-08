import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeNoise, fbm, makeCanvas, canvasTex, heightToNormal } from '../../textures.js';

// =====================================================================================
//  WHITEOUT textures (all procedural, tileable, ≤ 512²; built once and shared).
// =====================================================================================
const cache = {};
const once = (k, fn) => cache[k] || (cache[k] = fn());

// height field helper: run fn(u, v) over a W² grid, return Float32Array
function field(W, fn) { const h = new Float32Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) h[y * W + x] = fn(x / W, y / W, x, y); return h; }
function toCanvas(W, fn) {
  const c = makeCanvas(W, W), x = c.getContext('2d'), img = x.createImageData(W, W);
  for (let i = 0; i < W * W; i++) { const [r, g, b] = fn(i % W, (i / W) | 0, i); img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  return c;
}

// ---- granite / gneiss for the exposed rock: dark grey, lighter feldspar flecks, strata, crack network
export function rockTextures() {
  return once('rock', () => {
    const W = 512, n1 = makeNoise(11, 16), n2 = makeNoise(12, 64), n3 = makeNoise(13, 8), rr = makeRng(14);
    // cracks: a few random walks, stamped into a mask
    const crack = new Float32Array(W * W);
    for (let k = 0; k < 26; k++) {
      let x = rr() * W, y = rr() * W, a = rr() * 6.28;
      const L = 60 + rr() * 220;
      for (let s = 0; s < L; s++) {
        a += (rr() - 0.5) * 0.5; x += Math.cos(a); y += Math.sin(a) * 0.6;   // strata-ish: mostly horizontal
        const xi = ((x | 0) % W + W) % W, yi = ((y | 0) % W + W) % W;
        crack[yi * W + xi] = 1; crack[yi * W + (xi + 1) % W] = Math.max(crack[yi * W + (xi + 1) % W], 0.5);
      }
    }
    const h = field(W, (u, v, x, y) => {
      const strata = Math.sin((v * 7 + fbm(n3, u, v, 2, 3) * 1.6) * 6.283) * 0.5 + 0.5;
      return fbm(n1, u, v, 4, 5) * 0.65 + strata * 0.18 + fbm(n2, u, v, 16, 3) * 0.17 - crack[y * W + x] * 0.35;
    });
    const c = toCanvas(W, (x, y, i) => {
      const u = x / W, v = y / W;
      const base = h[i];
      const fleck = n2(u * 64 * 4.1, v * 64 * 4.1) > 0.82 ? 0.16 : 0;
      const lich = fbm(n3, u + 0.3, v, 3, 3);
      let g = 0.25 + base * 0.32 + fleck - crack[i] * 0.16;
      // a little ochre rust / lichen in places (keeps the rock from reading as flat grey)
      const r = g * (1.0 + Math.max(0, lich - 0.62) * 0.35), gg = g * (1.0 + Math.max(0, lich - 0.65) * 0.1), b = g * (1.05 - Math.max(0, lich - 0.62) * 0.25);
      return [Math.min(255, r * 255), Math.min(255, gg * 255), Math.min(255, b * 255)];
    });
    const map = canvasTex(c);
    const normal = heightToNormal(h, W, W, 5);
    return { map, normal };
  });
}

// ---- wind-packed snow: sastrugi ripples (elongated across the wind), soft dimples, crust plates
export function snowTextures() {
  return once('snow', () => {
    const W = 512, n1 = makeNoise(21, 32), n2 = makeNoise(22, 8), n3 = makeNoise(23, 64);
    const h = field(W, (u, v) => {
      const warp = fbm(n2, u, v, 2, 3) * 1.8;
      const rip = Math.sin((u * 22 + v * 3 + warp * 3.2) * 6.283) * 0.5 + 0.5;
      const rip2 = Math.sin((u * 47 - v * 6 + warp * 5) * 6.283) * 0.5 + 0.5;
      return rip * 0.42 * fbm(n1, u, v, 4, 3) + rip2 * 0.12 + fbm(n3, u, v, 16, 3) * 0.3 + fbm(n1, u + 0.5, v, 2, 4) * 0.45;
    });
    const normal = heightToNormal(h, W, W, 3.2);
    // a faint albedo variation (wind-blown hollows a touch bluer / greyer)
    const c = toCanvas(W, (x, y, i) => { const k = 0.93 + (h[i] - 0.5) * 0.12; return [Math.min(255, 238 * k), Math.min(255, 243 * k), 255 * Math.min(1, k * 1.0)]; });
    return { map: canvasTex(c), normal };
  });
}

// ---- packed snow on the road: two tyre-rut bands of compacted, dirtier snow, gravel grit, plough lines
// u across the road (0..1 = full width), v along (tiles every 12 m)
export function roadSnowTexture() {
  return once('roadsnow', () => {
    const W = 512, n1 = makeNoise(31, 32), n2 = makeNoise(32, 128), n3 = makeNoise(33, 8), rr = makeRng(34);
    const h = new Float32Array(W * W);
    const c = toCanvas(W, (x, y, i) => {
      const u = x / W, v = y / W;
      const wob = (fbm(n3, u * 0.2, v, 2, 3) - 0.5) * 0.04;
      // ruts (one lane each way): dark compacted bands with a tread texture
      let rut = 0;
      for (const c0 of [0.17, 0.33, 0.67, 0.83]) rut = Math.max(rut, 1 - Math.min(1, Math.abs(u - c0 - wob) / (0.075 + (fbm(n1, u * 0.3, v, 3, 2) - 0.5) * 0.04)));
      rut *= 0.55 + 0.45 * fbm(n3, u * 0.5, v * 2.0, 3, 3);
      rut = rut * rut * (3 - 2 * rut);
      const tread = (Math.sin(v * W * 0.9) * 0.5 + 0.5) * rut * 0.25;
      const grit = n2(u * 128 * 3, v * 128 * 3) > 0.8 ? 1 : 0;
      const slush = fbm(n1, u, v, 8, 4);
      let s = 0.86 - rut * (0.3 + slush * 0.2) - tread * 0.2 - grit * rut * 0.3 - (slush - 0.5) * 0.14;
      // the crown between the ruts stays whiter, the edges are ploughed into ridges
      const edge = Math.min(u, 1 - u);
      s += (1 - Math.min(1, edge / 0.06)) * 0.06;
      h[i] = 1 - rut * 0.6 + slush * 0.2 + (1 - Math.min(1, edge / 0.05)) * 0.3;
      const r = s * 236, g = s * 238, b = s * 245;
      // warm-grey road grime in the ruts
      return [Math.min(255, r - rut * 6), Math.min(255, g - rut * 14), Math.min(255, b - rut * 26)];
    });
    const map = canvasTex(c);
    const normal = heightToNormal(h, W, W, 2.5);
    return { map, normal };
  });
}

// ---- dressed stone (retaining walls, the fortress base): coursed blocks, dark mortar, weathering
export function stoneTextures() {
  return once('stone', () => {
    const W = 512, n1 = makeNoise(41, 32), n2 = makeNoise(42, 8), rr = makeRng(43);
    const rows = 8, h = new Float32Array(W * W), tone = [];
    for (let r = 0; r < rows; r++) { const cols = []; let x = 0; while (x < 1) { const w = 0.18 + rr() * 0.22; cols.push([x, Math.min(1, x + w), 0.85 + rr() * 0.3]); x += w; } tone.push(cols); }
    const c = toCanvas(W, (x, y, i) => {
      const u = x / W, v = y / W;
      const r = Math.floor(v * rows), fv = v * rows - r;
      const off = (r % 2) * 0.37;
      const uu = (u + off) % 1;
      const blk = tone[r].find(b => uu >= b[0] && uu < b[1]) || tone[r][0];
      const fu = (uu - blk[0]) / (blk[1] - blk[0]);
      const m = Math.min(fv, 1 - fv) * rows * 0.5, mu = Math.min(fu, 1 - fu) * (blk[1] - blk[0]) * 8;
      const mortar = 1 - Math.min(1, Math.min(m, mu) / 0.07);
      const pitted = fbm(n1, u, v, 8, 4);
      h[i] = (1 - mortar) * (0.7 + (pitted - 0.5) * 0.5 - Math.pow(Math.max(Math.abs(fu - 0.5), Math.abs(fv - 0.5)) * 2, 6) * 0.3);
      let g = (0.56 + (pitted - 0.5) * 0.14) * (0.92 + (blk[2] - 1) * 0.6) * (1 - mortar * 0.32);
      // streaks down from the joints
      g *= 1 - Math.max(0, fbm(n2, u * 6, v * 0.5, 2, 3) - 0.55) * 0.5;
      return [Math.min(255, g * 255 * 1.02), Math.min(255, g * 255), Math.min(255, g * 255 * 0.97)];
    });
    return { map: canvasTex(c), normal: heightToNormal(h, W, W, 4) };
  });
}

// ---- board-formed concrete (fortress blocks, the station): plank lines, form-tie holes, water streaks
export function concreteTextures() {
  return once('concrete', () => {
    const W = 512, n1 = makeNoise(51, 32), n2 = makeNoise(52, 8), n3 = makeNoise(53, 64);
    const h = new Float32Array(W * W);
    const c = toCanvas(W, (x, y, i) => {
      const u = x / W, v = y / W;
      const plank = Math.floor(v * 16), pv = v * 16 - plank;
      const seam = 1 - Math.min(1, Math.min(pv, 1 - pv) / 0.06);
      const grain = fbm(n3, u * 4, v * 0.25 + plank * 0.37, 4, 3);
      const tie = ((Math.abs(((u * 4) % 1) - 0.5) < 0.012 && Math.abs(((v * 4) % 1) - 0.5) < 0.012)) ? 1 : 0;
      const stain = Math.max(0, fbm(n2, u * 3, v * 0.4, 2, 4) - 0.45) * 1.4;
      h[i] = 0.5 + grain * 0.25 - seam * 0.2 - tie * 0.5;
      let g = 0.58 + (grain - 0.5) * 0.12 - seam * 0.05 - tie * 0.3 - stain * 0.22 + (fbm(n1, u, v, 8, 3) - 0.5) * 0.08;
      return [Math.min(255, g * 255), Math.min(255, g * 252), Math.min(255, g * 248)];
    });
    return { map: canvasTex(c), normal: heightToNormal(h, W, W, 2) };
  });
}

// ---- soft round flake / glint sprite (snowfall), mipmapped
export function flakeTexture() {
  return once('flake', () => {
    const S = 64, c = makeCanvas(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.75)'); g.addColorStop(0.65, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return canvasTex(c, { repeat: false });
  });
}

// ---- stencilled text on a plate (signs): returns a texture
export function signTexture(lines, { w = 512, h = 256, bg = '#e8e2d2', fg = '#1c1c1c', border = '#1c1c1c', font = 'Oswald', weight = 700, size = 90, stripe = null, rot = 0, age = 0.5, seed = 1 } = {}) {
  const c = makeCanvas(w, h), x = c.getContext('2d'), r = makeRng(seed);
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  if (stripe) { x.save(); x.fillStyle = stripe; for (let i = -h; i < w; i += 60) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + 30, h); x.lineTo(i + 30 + h, 0); x.lineTo(i + h, 0); x.fill(); } x.restore(); }
  if (border) { x.strokeStyle = border; x.lineWidth = Math.round(h * 0.05); x.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); }
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((L, i) => {
    const s = Array.isArray(L) ? L[1] : (i === 0 ? size : size * 0.55);
    x.font = `${weight} ${s}px ${font}, Impact, sans-serif`;
    x.fillText(Array.isArray(L) ? L[0] : L, w / 2, h * (n === 1 ? 0.52 : 0.32 + i * (0.42 / Math.max(1, n - 1)) * 1.0));
  });
  // weathering: chipped paint, rust bleed, frost at the edges
  for (let i = 0; i < 260 * age; i++) { const px = r() * w, py = r() * h, s = 1 + r() * 4; x.fillStyle = r() < 0.5 ? `rgba(90,60,40,${0.15 + r() * 0.3})` : `rgba(255,255,255,${0.1 + r() * 0.25})`; x.fillRect(px, py, s, s * (0.5 + r())); }
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(240,246,255,0.35)'); g.addColorStop(0.18, 'rgba(240,246,255,0)'); g.addColorStop(0.85, 'rgba(70,50,35,0)'); g.addColorStop(1, `rgba(70,50,35,${0.35 * age})`);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  return canvasTex(c, { repeat: false });
}

export const SHARED = {};
// one MeshStandardMaterial per (texture-set, tint) pair, shared across modules
export function stdMat(key, fn) { return SHARED[key] || (SHARED[key] = fn()); }
export { THREE };
