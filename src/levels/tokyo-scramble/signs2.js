import * as THREE from 'three';
import { makeCanvas, canvasTex } from '../../textures.js';
import { makeRng } from '../../rng.js';
import { JP, JPM } from './signs.js';

// =====================================================================================
//  The Tokyo signs that make it Tokyo (2048² atlas, second sign material):
//   - DIRECTORY PLATES: the zakkyo building's vertical tenant tower, one backlit plate per floor
//     (floor number + tenant), stacked up the building's edge — the single most Japanese thing on a
//     Shibuya side street;
//   - WINDOW LETTERING: big characters stuck on the window glass, lit from the room behind
//     (drawn on black: they're added, so only the letters show);
//   - FACADE POSTERS: whole-facade backlit adverts in portrait (fashion, a game, a singer, a drink).
//  Today's Tokyo is mostly white LED / light boxes, not neon tube: the palette here is white, yellow,
//  red and a few strong brand colours.
// =====================================================================================
const LAT = 'Anton, Oswald, "Arial Narrow", sans-serif';
const S = 2048;
// [tenant, background, text]
const TENANTS = [
  ['カラオケ', '#d8261c', '#fff'], ['居酒屋 和楽', '#f2efe6', '#b01818'], ['鳥福', '#1a1a1a', '#f2b81a'], ['バー SOL', '#14162a', '#f2e9d0'],
  ['スナック 蘭', '#f6e8ee', '#c2185b'], ['麻雀 白', '#1d6b3a', '#fff'], ['ネイル', '#fbe9f0', '#d63a7a'], ['英会話', '#1e5fd8', '#fff'],
  ['歯科', '#f4f6f8', '#1e64b4'], ['整骨院', '#ffffff', '#2a7a3a'], ['美容室 LUX', '#2b2b2b', '#e8d7a8'], ['占い 星', '#3a1450', '#f3c623'],
  ['ダーツ', '#e8e8e8', '#d8261c'], ['ビリヤード', '#0e5a2e', '#f2f2f2'], ['カフェ', '#f2e6d0', '#6a3a1a'], ['マッサージ', '#fff7d6', '#c2681a'],
  ['個室居酒屋', '#b5160f', '#fff4dc'], ['焼肉', '#141210', '#ff8a1a'], ['ラーメン', '#f4c51c', '#141210'], ['寿司', '#f2efe6', '#141210'],
  ['中華', '#c81a14', '#f6d23a'], ['タイ料理', '#f2c21a', '#1a4ac8'], ['カレー', '#e8a01a', '#3a1a0a'], ['ゲーム', '#141414', '#3ad0f0'],
  ['スタジオ', '#2a2a2a', '#ffffff'], ['不動産', '#ffffff', '#1a6a3a'], ['クリニック', '#eaf3fb', '#1e64b4'], ['学習塾', '#ffffff', '#d8261c'],
  ['ホットヨガ', '#ff7a2a', '#ffffff'], ['まつげ', '#fbe9f0', '#a8285a'], ['メガネ', '#ffffff', '#141414'], ['古着', '#f2c21a', '#141414'],
  ['トレカ', '#1e3ad8', '#f2f2f2'], ['漫画喫茶', '#1e5fd8', '#fff'], ['ネットカフェ', '#f2f2f2', '#1e5fd8'], ['串カツ', '#141210', '#f2c21a'],
  ['焼鳥', '#f2efe6', '#b01818'], ['餃子', '#d8261c', '#fff'], ['そば', '#2a2420', '#f2e6d0'], ['うどん', '#f2f2f2', '#1a3a8a'],
  ['ジム', '#141414', '#f2c21a'], ['テナント募集', '#ffffff', '#5a5a5a'], ['司法書士', '#ffffff', '#1a1a1a'], ['眼科', '#eaf3fb', '#1a5aa8'],
  ['ボウリング', '#d8261c', '#fff'], ['スナック 夢', '#2a1a3a', '#f2b8d8'], ['シーシャ', '#141414', '#c89a3a'], ['エステ', '#f6f0f8', '#8a3aa8'],
];
const WINDOW = [
  ['カラオケ', '#ffffff'], ['居酒屋', '#ffd23a'], ['英会話', '#ffffff'], ['歯科', '#ffffff'], ['美容室', '#ffd8e8'], ['まつエク', '#ffd8e8'],
  ['ネイル', '#ffffff'], ['ダーツ', '#ff5a3a'], ['24時間営業', '#ffffff'], ['焼肉食べ放題', '#ffd23a'], ['BAR', '#ffb03a'], ['麻雀', '#9aff8a'],
];
let cached = null;
export function signAtlas2() {
  if (cached) return cached;
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const rng = makeRng(2026);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const E = { plate: [], win: [], poster: [] };
  const uv = (x, y, w, h) => [x / S, 1 - (y + h) / S, w / S, h / S];
  const fit = (t, cx, cy, maxW, size, font, fill, weight = 900, maxH = 999) => {
    g.font = `${weight} ${size}px ${font}`;
    const w = g.measureText(t).width, k = Math.min(1, maxW / Math.max(1, w));
    g.save(); g.translate(cx, cy); g.scale(k, Math.min(1, maxH / size)); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(t, 0, 0); g.restore();
  };
  // ---- directory plates: 16 × 4 rows of 124×148 (a plate ≈ 0.9 × 1.1 m), floor number up top
  TENANTS.forEach(([name, bg, fg], i) => {
    const x = (i % 16) * 128 + 2, y = Math.floor(i / 16) * 152 + 2, w = 124, h = 148;
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    const gr = g.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.9); gr.addColorStop(0, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0.22)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, 26);
    fit(['B1', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F'][i % 9], x + 18, y + 14, 30, 20, LAT, '#fff', 400);
    // tenant: vertical when short and Japanese, else two lines horizontal
    const chars = [...name.replace(' ', '')];
    if (!/[A-Z]/.test(name) && chars.length <= 3) { const n = chars.length, st = (h - 36) / n; chars.forEach((ch, k) => fit(ch, x + w / 2, y + 30 + st * (k + 0.5), w - 20, Math.min(st * 0.9, 74), chars.length === 1 ? JPM : JP, fg)); }
    else { const parts = name.includes(' ') ? name.split(' ') : chars.length > 4 ? [chars.slice(0, Math.ceil(chars.length / 2)).join(''), chars.slice(Math.ceil(chars.length / 2)).join('')] : [name]; parts.forEach((p, k) => fit(p, x + w / 2, y + 30 + (h - 30) * (k + 0.5) / parts.length, w - 14, parts.length > 1 ? 40 : 46, /[A-Z]/.test(p) ? LAT : JP, fg, /[A-Z]/.test(p) ? 400 : 900)); }
    g.strokeStyle = 'rgba(30,30,30,0.9)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    E.plate.push({ uv: uv(x, y, w, h), glow: hexGlow(bg) });
  });
  // ---- window lettering on black: 6 × 2 rows of 336×116 at y 612
  WINDOW.forEach(([t, col], i) => {
    const x = (i % 6) * 340 + 2, y = 612 + Math.floor(i / 6) * 120, w = 336, h = 116;
    g.save(); g.shadowColor = col; g.shadowBlur = 6; fit(t, x + w / 2, y + h / 2 + 4, w - 20, 86, JP, col, 900); g.restore();
    E.win.push({ uv: uv(x, y, w, h), col });
  });
  // ---- facade posters, portrait 5:7: 4 × 500×700 at y 860
  for (let i = 0; i < 4; i++) { const x = i * 512 + 6, y = 860, w = 500, h = 700; drawPoster(g, i, x, y, w, h, rng, fit); E.poster.push({ uv: uv(x, y, w, h), glow: [[1.6, 1.4, 1.5], [0.6, 1.2, 1.9], [1.8, 0.8, 1.2], [1.9, 0.5, 0.35]][i] }); }
  // ---- landscape store fronts for the big buildings (brand bands): 4 × 1016×120 at y 1580
  const BANDS = [['K-FRONT', '#141414', '#f2c21a'], ['BOOKS & MUSIC  ブックス', '#1e3ad8', '#ffffff'], ['ドラッグ 黒金薬局', '#f2c21a', '#1a3a8a'], ['UNI-MART  ユニマート', '#d8261c', '#ffffff']];
  E.band = [];
  BANDS.forEach(([t, bg, fg], i) => { const x = (i % 2) * 1024 + 4, y = 1580 + Math.floor(i / 2) * 124, w = 1016, h = 120; g.fillStyle = bg; g.fillRect(x, y, w, h); fit(t, x + w / 2, y + h / 2 + 2, w - 60, 84, /[ぁ-ヿ一-龯]/.test(t) && !/[A-Z]/.test(t[0]) ? JP : LAT, fg, 900); E.band.push({ uv: uv(x, y, w, h) }); });
  // ---- the 108 tower's vertical sign (white on black), and the train livery strip
  { const x = 4, y = 1830, w = 1200, h = 100; g.fillStyle = '#0c0c0e'; g.fillRect(x, y, w, h); fit('KUROGANE 108', x + w / 2, y + h / 2 + 3, w - 40, 86, LAT, '#ffffff', 400); E.tower108 = { uv: uv(x, y, w, h) }; }
  { const x = 1220, y = 1830, w = 820, h = 100; drawTrain(g, x, y, w, h); E.train = { uv: uv(x, y, w, h) }; }
  { const x = 4, y = 1940, w = 1020, h = 100; g.fillStyle = '#f4f4f2'; g.fillRect(x, y, w, h); g.fillStyle = '#d8261c'; g.fillRect(x, y + h - 14, w, 14); fit('黒金センター街', x + w * 0.33, y + h / 2 - 4, w * 0.6, 78, JP, '#d8261c'); fit('CENTER GAI', x + w * 0.8, y + h / 2 - 4, w * 0.34, 56, LAT, '#1e3ad8', 400); E.arch = { uv: uv(x, y, w, h) }; }
  { const x = 1030, y = 1940, w = 1010, h = 100; g.fillStyle = '#167a3a'; g.fillRect(x, y, w, h); fit('黒金  KUROGANE', x + w / 2, y + h / 2 + 2, w - 60, 70, JP, '#ffffff'); E.jr = { uv: uv(x, y, w, h) }; }
  const tex = canvasTex(c, { repeat: false, aniso: 4 });
  cached = { tex, E, canvas: c };
  return cached;
}
function hexGlow(h) { const n = parseInt(h.slice(1), 16); const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255; return [0.4 + r * 1.3, 0.4 + g * 1.3, 0.4 + b * 1.3]; }
function drawPoster(g, i, x, y, w, h, rng, fit) {
  const grd = (stops, x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  if (i === 0) { // fashion: pale backdrop, a tall model silhouette, a thin serif brand
    g.fillStyle = grd([[0, '#f1ece6'], [1, '#d9cfc4']], x, y, x, y + h); g.fillRect(x, y, w, h);
    g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(x + w * 0.55, y + h * 0.2, 34, 42, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x + w * 0.42, y + h * 0.3); g.lineTo(x + w * 0.7, y + h * 0.3); g.lineTo(x + w * 0.76, y + h * 0.95); g.lineTo(x + w * 0.36, y + h * 0.95); g.closePath(); g.fill();
    g.fillStyle = '#b8a07a'; g.fillRect(x + w * 0.4, y + h * 0.42, w * 0.38, 18);
    fit('MIRAI', x + w * 0.5, y + h * 0.08, w * 0.7, 80, '"Noto Serif CJK JP", Georgia, serif', '#2a2420', 400);
    fit('2026 AUTUMN / WINTER', x + w * 0.5, y + h * 0.97, w * 0.8, 22, 'Oswald, sans-serif', '#2a2420', 400);
  } else if (i === 1) { // a game: night-blue key art, a mech silhouette, big katakana title
    g.fillStyle = grd([[0, '#0a1a3a'], [1, '#1a4a8a']], x, y, x, y + h); g.fillRect(x, y, w, h);
    for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(120,200,255,${0.2 + rng() * 0.5})`; g.fillRect(x + rng() * w, y + rng() * h * 0.6, 2, 2); }
    g.fillStyle = '#071226'; g.beginPath(); g.moveTo(x + w * 0.5, y + h * 0.25); g.lineTo(x + w * 0.8, y + h * 0.45); g.lineTo(x + w * 0.72, y + h * 0.9); g.lineTo(x + w * 0.28, y + h * 0.9); g.lineTo(x + w * 0.2, y + h * 0.45); g.closePath(); g.fill();
    g.fillStyle = '#3ad0f0'; g.fillRect(x + w * 0.44, y + h * 0.36, w * 0.12, 8);
    fit('ネオン戦記', x + w / 2, y + h * 0.12, w * 0.9, 96, JP, '#ffffff'); fit('発売中  NOW ON SALE', x + w / 2, y + h * 0.96, w * 0.8, 28, JP, '#3ad0f0');
  } else if (i === 2) { // a singer: pink/violet, a face in profile, the album title
    g.fillStyle = grd([[0, '#f7c6dc'], [1, '#7a3ab8']], x, y, x + w, y + h); g.fillRect(x, y, w, h);
    g.fillStyle = '#2a1030'; g.beginPath(); g.ellipse(x + w * 0.5, y + h * 0.42, w * 0.26, h * 0.2, 0, 0, 7); g.fill(); g.fillRect(x + w * 0.3, y + h * 0.56, w * 0.4, h * 0.3);
    fit('AKANE', x + w / 2, y + h * 0.1, w * 0.8, 100, LAT, '#ffffff', 400); fit('東京ドーム 12.24', x + w / 2, y + h * 0.93, w * 0.85, 44, JP, '#ffffff');
  } else { // a drink: red, a sweating can, ゼロ
    g.fillStyle = grd([[0, '#d81a14'], [1, '#7a0907']], x, y, x, y + h); g.fillRect(x, y, w, h);
    g.fillStyle = grd([[0, '#8a0c0a'], [0.35, '#ff5a4a'], [0.6, '#e01c14'], [1, '#600806']], x + w * 0.3, 0, x + w * 0.7, 0); g.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.5);
    g.fillStyle = '#d8d8d8'; g.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, 12);
    fit('ネオコーラ', x + w / 2, y + h * 0.12, w * 0.9, 90, JP, '#ffffff'); fit('ZERO', x + w / 2, y + h * 0.9, w * 0.5, 70, LAT, '#ffffff', 400);
  }
}
function drawTrain(g, x, y, w, h) { // the Kurogane Loop Line livery: stainless, a green band, windows
  g.fillStyle = '#c8ccd0'; g.fillRect(x, y, w, h);
  g.fillStyle = '#1f9a4a'; g.fillRect(x, y + h * 0.66, w, h * 0.12);
  for (let k = 0; k < 8; k++) { g.fillStyle = '#20262c'; g.fillRect(x + 20 + k * 100, y + h * 0.18, 70, h * 0.36); g.fillStyle = 'rgba(255,250,235,0.9)'; g.fillRect(x + 22 + k * 100, y + h * 0.2, 66, h * 0.32); }
  g.fillStyle = '#8a9096'; for (let k = 0; k < 4; k++) g.fillRect(x + 90 + k * 200, y + h * 0.1, 6, h * 0.8);
}
