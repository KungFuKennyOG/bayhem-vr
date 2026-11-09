import { makeCanvas, canvasTex } from '../../textures.js';
import { makeRng } from '../../rng.js';
import { JP } from './signs.js';

// =====================================================================================
//  Drinks vending machines, up close. They used to be 120×186 px slots in the shared sign atlas,
//  which at arm's length in a headset read as a grid of coloured squares. This is their own atlas:
//  8 fronts at 256×496 (≈ 260 px per metre), drawn like the real thing — a brand header, a backlit
//  window with three shelves of cans and PET bottles (rounded, banded, highlighted) over price tags
//  and the blue つめた～い / red あったか～い strips, the round select buttons, a dark coin and card
//  panel with its little LED, an ad panel, and the 取出口 flap at the bottom. Fictional brands only.
// =====================================================================================
const LAT = 'Anton, Oswald, "Arial Narrow", sans-serif';
const W = 256, H = 496, N = 8;
const BRANDS = [
  { body: '#d4202c', head: '#b0141e', name: 'NEO COLA', ink: '#fff', ad: ['#d4202c', '#fff', 'ZERO'] },
  { body: '#1d4fa8', head: '#123a80', name: 'BREW', ink: '#fff', ad: ['#0e1c3a', '#e8c070', '微糖'] },
  { body: '#f2f2ee', head: '#2a8a4a', name: 'お茶の園', ink: '#fff', ad: ['#2a8a4a', '#fff', '緑茶'] },
  { body: '#1f9a52', head: '#14743c', name: 'GREEN', ink: '#fff', ad: ['#e8f4e8', '#14743c', '野菜'] },
  { body: '#f08a12', head: '#c86a08', name: 'SUNNY', ink: '#fff', ad: ['#fff4dc', '#e06a08', 'みかん'] },
  { body: '#2b2b2b', head: '#141414', name: 'COFFEE', ink: '#e8c070', ad: ['#3a2a1a', '#e8c070', 'BLACK'] },
  { body: '#e8e6e0', head: '#d4202c', name: 'AQUA+', ink: '#fff', ad: ['#bfe4f4', '#1d6aa8', '天然水'] },
  { body: '#5a2a8a', head: '#401a68', name: 'BOLT', ink: '#f2e040', ad: ['#1a1a1a', '#f2e040', 'ENERGY'] },
];
const PRODUCTS = [
  ['#c81a1a', '#f4f4f4'], ['#1a4ac8', '#f4f4f4'], ['#e8dcb8', '#2a6a3a'], ['#2a8a4a', '#f4f4f4'], ['#e88a12', '#fff4dc'], ['#3a2a1a', '#e8c070'],
  ['#f2d21a', '#c81a1a'], ['#9a1aa8', '#fff'], ['#dfe8ee', '#1d6aa8'], ['#1a1a1a', '#e8c070'], ['#f4f4f4', '#c81a1a'], ['#8ac83a', '#1a4a1a'],
];

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function text(g, s, cx, cy, maxW, size, font, fill, weight = 900) {
  g.font = `${weight} ${size}px ${font}`;
  const k = Math.min(1, maxW / Math.max(1, g.measureText(s).width));
  g.save(); g.translate(cx, cy); g.scale(k, 1); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
}
// a can: a cylinder seen front-on (shaded band left to right), the lid's silver rim, a logo band
function can(g, x, y, w, h, [c0, c1]) {
  const gr = g.createLinearGradient(x, 0, x + w, 0);
  gr.addColorStop(0, shade(c0, -0.35)); gr.addColorStop(0.3, shade(c0, 0.12)); gr.addColorStop(0.55, c0); gr.addColorStop(1, shade(c0, -0.45));
  rr(g, x, y + 4, w, h - 4, 3); g.fillStyle = gr; g.fill();
  const lg = g.createLinearGradient(x, 0, x + w, 0); lg.addColorStop(0, '#8a8e92'); lg.addColorStop(0.35, '#f0f2f4'); lg.addColorStop(1, '#6a6e72');
  g.fillStyle = lg; rr(g, x + 1, y, w - 2, 6, 2); g.fill();
  g.fillStyle = c1; g.fillRect(x + 2, y + h * 0.42, w - 4, h * 0.16);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(x + w * 0.24, y + 7, 2, h - 12);
}
// a PET bottle: cap, neck, shoulder, a wrap label, the liquid colour through clear plastic
function bottle(g, x, y, w, h, [c0, c1]) {
  const cx = x + w / 2;
  g.fillStyle = c1 === '#fff' || c1 === '#f4f4f4' ? '#e8e8e8' : c1; rr(g, cx - w * 0.2, y, w * 0.4, h * 0.09, 2); g.fill();          // cap
  g.fillStyle = 'rgba(210,225,230,0.9)'; g.fillRect(cx - w * 0.16, y + h * 0.09, w * 0.32, h * 0.08);                                  // neck
  g.beginPath(); g.moveTo(cx - w * 0.16, y + h * 0.17); g.quadraticCurveTo(x, y + h * 0.22, x, y + h * 0.36); g.lineTo(x, y + h - 2); g.quadraticCurveTo(cx, y + h + 2, x + w, y + h - 2);
  g.lineTo(x + w, y + h * 0.36); g.quadraticCurveTo(x + w, y + h * 0.22, cx + w * 0.16, y + h * 0.17); g.closePath();
  const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, shade(c0, -0.3)); gr.addColorStop(0.35, shade(c0, 0.2)); gr.addColorStop(1, shade(c0, -0.35));
  g.fillStyle = gr; g.fill();
  g.fillStyle = c1; g.fillRect(x, y + h * 0.46, w, h * 0.3);
  g.fillStyle = shade(c0, -0.1); g.fillRect(x + 2, y + h * 0.55, w - 4, h * 0.08);
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + w * 0.22, y + h * 0.24, 2, h * 0.66);
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(r)},${f(gg)},${f(b)})`;
}
function drawFront(g, x0, y0, i, rng) {
  const B = BRANDS[i];
  // cabinet face + a soft vertical sheen
  g.fillStyle = B.body; g.fillRect(x0, y0, W, H);
  const sh = g.createLinearGradient(x0, 0, x0 + W, 0); sh.addColorStop(0, 'rgba(0,0,0,0.18)'); sh.addColorStop(0.15, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = sh; g.fillRect(x0, y0, W, H);
  // header
  g.fillStyle = B.head; g.fillRect(x0 + 8, y0 + 8, W - 16, 40);
  text(g, B.name, x0 + W / 2, y0 + 29, W - 40, 30, /[A-Z]/.test(B.name) ? LAT : JP, B.ink, /[A-Z]/.test(B.name) ? 400 : 900);
  // the backlit window
  const wx = x0 + 12, wy = y0 + 56, ww = W - 24, wh = 250;
  g.fillStyle = '#1a1c1e'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
  const bl = g.createLinearGradient(0, wy, 0, wy + wh); bl.addColorStop(0, '#ffffff'); bl.addColorStop(1, '#e4ecee');
  g.fillStyle = bl; g.fillRect(wx, wy, ww, wh);
  const rows = 3, cols = 8, rh = wh / rows, cw = ww / cols;
  for (let r = 0; r < rows; r++) {
    const ry = wy + r * rh, hot = i % 3 === 1 && r === 2;            // the coffee machines keep a hot row at the bottom
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(wx, ry + rh - 26, ww, 3);                 // shelf lip shadow
    for (let k = 0; k < cols; k++) {
      const P = PRODUCTS[Math.floor(rng() * PRODUCTS.length)], isB = rng() < 0.45, px = wx + k * cw + 3, pw = cw - 6;
      if (isB) bottle(g, px + 1, ry + 6, pw - 2, rh - 34, P); else can(g, px + 2, ry + 18, pw - 4, rh - 46, P);
      // price tag + the select button under it
      g.fillStyle = '#fff'; g.fillRect(px, ry + rh - 23, pw, 9);
      g.font = '700 9px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#111';
      g.fillText(isB ? (rng() < 0.5 ? '160' : '150') : (rng() < 0.5 ? '130' : '120'), px + pw / 2, ry + rh - 18.5);
      g.fillStyle = hot ? '#d4202c' : '#1d5ac8'; g.fillRect(px, ry + rh - 14, pw, 5);
      const lit = rng() < 0.85;
      g.fillStyle = '#d8d8d4'; rr(g, px + pw / 2 - 6, ry + rh - 8, 12, 6, 3); g.fill();
      g.fillStyle = lit ? (rng() < 0.15 ? '#ff3a2a' : '#3ae05a') : '#5a5a5a'; g.fillRect(px + pw / 2 - 2, ry + rh - 6.5, 4, 3);
    }
    text(g, hot ? 'あったか～い' : 'つめた～い', wx + 30, ry + rh - 11.5, 50, 6, JP, '#fff', 700);
  }
  // glare across the window glass
  const gl = g.createLinearGradient(wx, wy, wx + ww, wy + wh); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.42, 'rgba(255,255,255,0)'); gl.addColorStop(0.47, 'rgba(255,255,255,0.22)'); gl.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.fillRect(wx, wy, ww, wh);
  // lower half: the ad panel (left) and the coin / card panel (right)
  const ly = wy + wh + 12;
  g.fillStyle = B.ad[0]; g.fillRect(x0 + 12, ly, 150, 100);
  text(g, B.ad[2], x0 + 87, ly + 42, 130, 44, /[A-Z]/.test(B.ad[2]) ? LAT : JP, B.ad[1], /[A-Z]/.test(B.ad[2]) ? 400 : 900);
  text(g, B.name, x0 + 87, ly + 82, 120, 14, /[A-Z]/.test(B.name) ? LAT : JP, B.ad[1], 400);
  g.fillStyle = '#2a2c2e'; g.fillRect(x0 + 172, ly, 72, 100);
  g.fillStyle = '#0a1a0a'; g.fillRect(x0 + 180, ly + 8, 56, 14); g.fillStyle = '#ff4a2a'; g.font = '700 11px monospace'; g.textAlign = 'right'; g.fillText('0', x0 + 232, ly + 16);
  g.fillStyle = '#9a9ea2'; rr(g, x0 + 184, ly + 30, 22, 8, 2); g.fill(); g.fillStyle = '#111'; g.fillRect(x0 + 186, ly + 33, 18, 2);          // coin slot
  g.fillStyle = '#9a9ea2'; g.fillRect(x0 + 182, ly + 46, 52, 10); g.fillStyle = '#111'; g.fillRect(x0 + 186, ly + 50, 44, 2);               // note slot
  g.fillStyle = '#1d6aa8'; g.beginPath(); g.arc(x0 + 208, ly + 76, 14, 0, Math.PI * 2); g.fill();                                             // the IC card pad
  g.fillStyle = '#fff'; g.font = '700 10px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('IC', x0 + 208, ly + 77);
  g.fillStyle = '#c8c8c4'; g.fillRect(x0 + 226, ly + 88, 14, 8);                                                                         // return lever
  // the 取出口 flap
  const fy = y0 + H - 66;
  g.fillStyle = '#121212'; rr(g, x0 + 22, fy, W - 44, 46, 4); g.fill();
  const fl = g.createLinearGradient(0, fy, 0, fy + 46); fl.addColorStop(0, 'rgba(120,130,135,0.55)'); fl.addColorStop(1, 'rgba(40,44,46,0.4)');
  g.fillStyle = fl; rr(g, x0 + 28, fy + 4, W - 56, 38, 3); g.fill();
  text(g, '取出口', x0 + W / 2, fy + 23, 80, 12, JP, 'rgba(255,255,255,0.75)', 700);
  // kick plate, scuffs, a sticker or two
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0, y0 + H - 14, W, 14);
  for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(30,24,18,${0.05 + rng() * 0.08})`; g.fillRect(x0 + rng() * W, y0 + H * 0.6 + rng() * H * 0.4, 2 + rng() * 10, 1 + rng() * 3); }
  if (rng() < 0.6) { g.fillStyle = '#f2e040'; g.fillRect(x0 + 14, ly + 104, 40, 10); text(g, '故障時連絡', x0 + 34, ly + 109, 36, 7, JP, '#111', 700); }
}

let cached = null;
export function vendAtlas() {
  if (cached) return cached;
  const c = makeCanvas(W * N, 512), g = c.getContext('2d'), rng = makeRng(707);
  g.fillStyle = '#222'; g.fillRect(0, 0, W * N, 512);
  const vend = [];
  for (let i = 0; i < N; i++) { drawFront(g, i * W, 8, i, rng); vend.push({ uv: [(i * W + 1) / (W * N), 1 - (8 + H - 1) / 512, (W - 2) / (W * N), (H - 2) / 512] }); }
  cached = { tex: canvasTex(c, { repeat: false, aniso: 8 }), E: { vend } };
  return cached;
}
