import * as THREE from 'three';
import { makeCanvas, canvasTex } from '../../textures.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  Kurogane's signage: one 2048² canvas atlas of every sign in the level.
//   - blade signs (tategaki, vertical, 96×512): backlit light boxes and neon tubes
//   - fascia signs (horizontal, 512×128): shop names, chains, neon script
//   - big panels (1024×256): rooftop billboards, the station name
//   - small plates (256×64): floor directories, "24H", prices
//  Most real Tokyo signage is a backlit box (white / cream / colour field + coloured characters),
//  not neon tube — so the mix is about 70 / 30, and the neon ones get halos in the level.
//  Japanese text is drawn with the system CJK gothic / mincho (Noto CJK on Quest and in the sandbox).
// =====================================================================================
export const JP = '"Noto Sans CJK JP","Noto Sans JP","Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo",sans-serif';
export const JPM = '"Noto Serif CJK JP","Noto Serif JP","Hiragino Mincho ProN","Yu Mincho",serif';
const LAT = 'Anton, Oswald, "Arial Narrow", sans-serif';
const S = 2048;

// palette: [background, text, accent, glow] — glow is the HDR colour of the light the sign throws
const P = {
  white: ['#f2efe6', '#c21b1b', '#1a1a1a', [1.6, 1.45, 1.35]],
  cream: ['#efe2c0', '#1a1410', '#b2261c', [1.6, 1.3, 0.9]],
  yellow: ['#f4c51c', '#141210', '#c11a10', [1.8, 1.35, 0.35]],
  red: ['#b5160f', '#fbf3e3', '#f6c33a', [1.8, 0.35, 0.22]],
  black: ['#120f0e', '#f1a12a', '#e8e1d0', [1.6, 0.75, 0.2]],
  blue: ['#123f8c', '#f4f2ea', '#f3c623', [0.45, 0.8, 1.9]],
  green: ['#1d6b3a', '#f4f2ea', '#f3c623', [0.4, 1.5, 0.7]],
  pink: ['#f2e6ea', '#d11a6a', '#1a1a1a', [1.7, 0.7, 1.1]],
  orange: ['#e2661a', '#fff6e8', '#141210', [1.9, 0.8, 0.25]],
  navy: ['#14162a', '#f4f2ea', '#e1342b', [0.7, 0.75, 1.4]],
  purple: ['#3a1450', '#f6e9ff', '#f3c623', [1.2, 0.5, 1.8]],
};
const NEON = { pink: '#ff3fb4', cyan: '#3ff4ff', red: '#ff3a2e', violet: '#b45cff', yellow: '#ffe35a', green: '#56ff8a', orange: '#ff9a2e', blue: '#4f8cff', white: '#fff4f0' };
const NEONG = { pink: [2.4, 0.5, 1.5], cyan: [0.4, 2.0, 2.4], red: [2.6, 0.4, 0.3], violet: [1.4, 0.6, 2.6], yellow: [2.4, 2.0, 0.6], green: [0.6, 2.4, 1.0], orange: [2.6, 1.2, 0.35], blue: [0.6, 1.0, 2.6], white: [2.2, 2.0, 1.9] };

// blade signs: [text, palette | 'neon:<col>', font 'g'|'m', small top line]
const BLADES = [
  ['カラオケ', 'white', 'g', 'KARAOKE'], ['ラーメン', 'yellow', 'g', '黒金家'], ['居酒屋', 'red', 'm', '炉端'], ['焼肉', 'neon:red', 'g', ''],
  ['ホテル', 'neon:violet', 'g', 'HOTEL'], ['薬', 'white', 'g', 'くすり'], ['マッサージ', 'pink', 'g', '60分'], ['寿司', 'cream', 'm', '江戸前'],
  ['麻雀', 'green', 'g', '3F'], ['漫画喫茶', 'blue', 'g', '24H'], ['焼鳥', 'neon:orange', 'm', ''], ['バー月光', 'neon:cyan', 'g', 'BAR'],
  ['中華料理', 'red', 'g', '餃子'], ['占い', 'purple', 'g', '手相'], ['歯科', 'white', 'g', '診療中'], ['牛丼', 'orange', 'g', 'うまい'],
  ['質', 'cream', 'm', '質屋'], ['ゲーム', 'neon:pink', 'g', 'GAME'], ['クラブ', 'neon:blue', 'g', 'B1F'], ['美容室', 'pink', 'g', 'HAIR'],
  ['天ぷら', 'cream', 'm', '老舗'], ['うどん', 'white', 'm', '手打'], ['夜桜', 'neon:pink', 'm', ''], ['スナック', 'navy', 'g', '2F'],
  ['ネットカフェ', 'blue', 'g', 'NET'], ['パチンコ', 'neon:yellow', 'g', ''], ['ホルモン', 'black', 'g', '炭火'], ['鉄板焼', 'red', 'm', ''],
  ['カフェ', 'neon:green', 'g', 'CAFE'], ['銀河', 'neon:violet', 'm', 'BAR'], ['酒', 'white', 'm', '地酒'], ['整体', 'green', 'g', '腰痛'],
  ['黒金ビル', 'navy', 'g', '第二'], ['花火', 'neon:orange', 'm', 'SNACK'], ['クリニック', 'white', 'g', '内科'], ['そば', 'black', 'm', '立喰'],
  ['居酒屋', 'neon:red', 'm', '炎'], ['ラーメン', 'red', 'g', '豚骨'], ['カラオケ', 'neon:cyan', 'g', '歌宴'], ['古着', 'yellow', 'g', 'USED'],
];
// fascia signs (horizontal): [main, sub, palette | 'neon:<col>', font, layout]
const FASCIA = [
  ['NIGHTMART', '24 HOURS  ナイトマート', 'mart', 'lat'], ['ドラッグストア', 'DRUG STORE  黒金', 'yellow', 'g'],
  ['PACHINKO GALAXY', 'パチンコ・ギャラクシー', 'neon:pink', 'lat'], ['カラオケ歌宴', 'KARAOKE  UTAGE  2F〜8F', 'red', 'g'],
  ['居酒屋 はなび', '飲み放題 2時間 ¥1980', 'cream', 'm'], ['ラーメン 龍', 'RAMEN  RYU  豚骨・醤油', 'black', 'g'],
  ['24H OPEN', '', 'neon:cyan', 'lat'], ['ゲームセンター', 'GAME CENTER  NEO', 'neon:violet', 'g'],
  ['焼肉 炎', 'YAKINIKU  HOMURA', 'red', 'm'], ['MANGA CAFE', 'まんが・ネット 黒金店', 'blue', 'lat'],
  ['HOTEL MOON', 'ホテル・ムーン', 'neon:pink', 'lat'], ['回転寿司', '一皿 ¥110〜', 'white', 'g'],
  ['SALE 50%OFF', 'セール開催中', 'neon:red', 'lat'], ['黒金書店', 'BOOKS  KUROGANE', 'green', 'g'],
  ['CAFE & BAR 夜', 'OPEN 18:00', 'neon:orange', 'lat'], ['ATM', '黒金銀行', 'navy', 'lat'],
];
// big panels: rooftop billboards + the station name
const PANELS = [
  ['NEO COLA', 'ネオコーラ  ゼロ  新登場', 'cola'], ['MIRAI', '未来フォン  X  発売中', 'phone'],
  ['黒金駅', 'KUROGANE  STATION', 'station'], ['SKYWAY', 'スカイウェイ航空  羽田→那覇 ¥9,800', 'air'],
  ['黒金銀行', 'KUROGANE BANK', 'bank'], ['HAVEN WHISKY', '夜は、ハイボール。', 'whisky'],
  ['AKANE', 'NEW SINGLE  「夜明け」', 'idol'], ['NIGHT RACE', 'ナイトレース  開幕', 'race'],
];
// small plates
const PLATES = [
  ['B1F クラブ', 'navy'], ['2F 麻雀', 'green'], ['3F スナック', 'pink'], ['4F 整体', 'white'], ['5F 占い', 'purple'], ['6F バー', 'black'],
  ['営業中', 'red'], ['空室あり', 'white'], ['駐車場', 'blue'], ['P 満車', 'blue'], ['禁煙', 'white'], ['出口 EXIT', 'green'],
  ['ガス工事中', 'yellow'], ['立入禁止', 'red'], ['黒金ガス', 'orange'], ['止まれ', 'red'],
];

function bg(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
// backlit box: hot centre, darker rim (the tubes are behind the face), a thin frame
function lightbox(g, x, y, w, h, col, frame = '#1a1a1a') {
  bg(g, x, y, w, h, col);
  const gr = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.1, x + w / 2, y + h / 2, Math.max(w, h) * 0.7);
  gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = frame; g.lineWidth = Math.max(3, Math.min(w, h) * 0.05); g.strokeRect(x + g.lineWidth / 2, y + g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
}
// neon tube text: dark panel, a wide soft glow, the tube, a white-hot core
function neonText(g, text, cx, cy, size, font, col, opts = {}) {
  g.save();
  g.font = `${opts.weight || 700} ${size}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = col; g.shadowBlur = size * 0.45;
  g.lineJoin = 'round';
  g.strokeStyle = col; g.lineWidth = size * 0.11; g.globalAlpha = 0.55; g.strokeText(text, cx, cy);
  g.shadowBlur = size * 0.2; g.globalAlpha = 1; g.lineWidth = size * 0.065; g.strokeText(text, cx, cy);
  g.shadowBlur = 0; g.strokeStyle = '#fffaf6'; g.lineWidth = size * 0.022; g.strokeText(text, cx, cy);
  g.restore();
}
function vertText(g, text, cx, y0, y1, maxW, font, fill, opts = {}) {
  const chars = [...text].map(c => (c === 'ー' ? '｜' : c));
  const n = chars.length, step = (y1 - y0) / n;
  const size = Math.min(maxW, step * 0.92);
  for (let i = 0; i < n; i++) {
    const cy = y0 + step * (i + 0.5);
    if (opts.neon) neonText(g, chars[i], cx, cy, size, font, fill, { weight: 900 });
    else {
      g.font = `900 ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (opts.outline) { g.strokeStyle = opts.outline; g.lineWidth = size * 0.12; g.lineJoin = 'round'; g.strokeText(chars[i], cx, cy); }
      g.fillStyle = fill; g.fillText(chars[i], cx, cy);
    }
  }
}
function fitText(g, text, cx, cy, maxW, size, font, fill, weight = 900, stroke = null) {
  g.font = `${weight} ${size}px ${font}`;
  const w = g.measureText(text).width;
  const k = Math.min(1, maxW / Math.max(1, w));
  g.save(); g.translate(cx, cy); g.scale(k, 1);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = size * 0.1; g.lineJoin = 'round'; g.strokeText(text, 0, 0); }
  g.fillStyle = fill; g.fillText(text, 0, 0);
  g.restore();
}
function dirt(g, x, y, w, h, rng, k = 1) {
  // grime: a darker bottom edge, a few streaks, dead pixels in the tubes
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.75, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(20,14,10,${0.35 * k})`);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  for (let i = 0; i < 4 * k; i++) { g.fillStyle = `rgba(30,22,16,${0.06 + rng() * 0.1})`; g.fillRect(x + rng() * w, y + rng() * h * 0.5, 1 + rng() * 3, h * (0.2 + rng() * 0.5)); }
}

let cached = null;
export function signAtlas() {
  if (cached) return cached;
  const c = makeCanvas(S, S), g = c.getContext('2d');
  const rng = makeRng(606);
  bg(g, 0, 0, S, S, '#0b0a0c');
  const E = { blade: [], fascia: [], panel: [], plate: [] };
  const uv = (x, y, w, h) => [x / S, 1 - (y + h) / S, w / S, h / S]; // [u0, v0, du, dv] (flipY canvas texture)
  // ---- blades: 2 rows of 20, 96×470 (pitch 102×474)
  BLADES.forEach(([text, pal, font, top], i) => {
    const x = (i % 20) * 102 + 3, y = Math.floor(i / 20) * 474 + 2, w = 96, h = 470;
    const F = font === 'm' ? JPM : JP;
    let glow;
    if (pal.startsWith('neon:')) {
      const col = pal.slice(5);
      bg(g, x, y, w, h, '#100a0e');
      g.strokeStyle = '#2a2026'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
      if (top) neonText(g, top, x + w / 2, y + 34, 22, LAT, NEON.white);
      vertText(g, text, x + w / 2, y + (top ? 64 : 22), y + h - 22, 70, F, NEON[col], { neon: true });
      glow = NEONG[col];
      E.blade.push({ uv: uv(x, y, w, h), glow, neon: true, flick: rng() < 0.35 });
    } else {
      const [b, t, a, gl] = P[pal];
      lightbox(g, x, y, w, h, b);
      if (top) { g.fillStyle = a; g.fillRect(x + 6, y + 6, w - 12, 46); fitText(g, top, x + w / 2, y + 30, w - 18, 30, top.match(/[A-Z0-9]/) ? LAT : F, b === '#f2efe6' || b === '#efe2c0' ? '#fff' : b, 700); }
      vertText(g, text, x + w / 2, y + (top ? 62 : 18), y + h - 16, 76, F, t, { outline: pal === 'yellow' || pal === 'white' ? null : null });
      dirt(g, x, y, w, h, rng);
      glow = gl;
      E.blade.push({ uv: uv(x, y, w, h), glow, neon: false });
    }
  });
  // ---- fascia: 4 cols × 4 rows of 504×118 at y 952 (pitch 512×122)
  FASCIA.forEach(([main, sub, pal, font], i) => {
    const x = (i % 4) * 512 + 4, y = 952 + Math.floor(i / 4) * 122, w = 504, h = 118;
    const F = font === 'm' ? JPM : font === 'lat' ? LAT : JP;
    if (pal === 'mart') {
      bg(g, x, y, w, h, '#f4f2ec');
      for (const [yy, col] of [[0.62, '#1d8a4a'], [0.74, '#f08a12'], [0.86, '#2a62c9']]) { g.fillStyle = col; g.fillRect(x, y + h * yy, w, h * 0.11); }
      fitText(g, main, x + w / 2, y + h * 0.3, w - 40, 64, LAT, '#1d8a4a', 400);
      E.fascia.push({ uv: uv(x, y, w, h), glow: [1.6, 1.6, 1.5], neon: false });
    } else if (pal.startsWith('neon:')) {
      const col = pal.slice(5);
      bg(g, x, y, w, h, '#0e090c');
      neonText(g, main, x + w / 2, y + (sub ? h * 0.4 : h / 2), sub ? 58 : 76, F, NEON[col], { weight: font === 'lat' ? 400 : 900 });
      if (sub) neonText(g, sub, x + w / 2, y + h * 0.82, 22, JP, NEON.white, { weight: 700 });
      E.fascia.push({ uv: uv(x, y, w, h), glow: NEONG[col], neon: true, flick: rng() < 0.3 });
    } else {
      const [b, t, a, gl] = P[pal];
      lightbox(g, x, y, w, h, b);
      g.fillStyle = a; g.fillRect(x + 8, y + h - 34, w - 16, 26);
      fitText(g, main, x + w / 2, y + h * 0.4, w - 36, 70, F, t, font === 'lat' ? 400 : 900);
      if (sub) fitText(g, sub, x + w / 2, y + h - 21, w - 40, 20, JP, b, 700);
      dirt(g, x, y, w, h, rng, 0.6);
      E.fascia.push({ uv: uv(x, y, w, h), glow: gl, neon: false });
    }
  });
  // ---- panels (3:1): 4 cols × 2 rows of 504×168 at y 1444 (pitch 512×172)
  PANELS.forEach(([main, sub, kind], i) => {
    const x = (i % 4) * 512 + 4, y = 1444 + Math.floor(i / 4) * 172, w = 504, h = 168;
    drawPanel(g, kind, main, sub, x, y, w, h, rng);
    E.panel.push({ uv: uv(x, y, w, h), glow: PANEL_GLOW[kind] || [1.6, 1.4, 1.2], kind });
  });
  // ---- plates: 8 cols × 2 rows of 250×27 at y 1792
  PLATES.forEach(([text, pal], i) => {
    const x = (i % 8) * 256 + 3, y = 1792 + Math.floor(i / 8) * 30, w = 250, h = 27;
    const [b, t, a, gl] = P[pal];
    lightbox(g, x, y, w, h, b, '#222');
    fitText(g, text, x + w / 2, y + h / 2 + 1, w - 16, 21, JP, t, 900);
    E.plate.push({ uv: uv(x, y, w, h), glow: gl });
  });
  // ---- vending machine fronts (8 × 120×186) and lit shop interiors (4 × 248×186) at y 1856
  E.vend = []; E.shop = [];
  for (let i = 0; i < 8; i++) { const x = i * 128 + 4, y = 1858, w = 120, h = 186; drawVend(g, x, y, w, h, i, rng); E.vend.push({ uv: uv(x, y, w, h) }); }
  for (let i = 0; i < 4; i++) { const x = 1024 + i * 256 + 4, y = 1858, w = 248, h = 186; drawShop(g, x, y, w, h, i, rng); E.shop.push({ uv: uv(x, y, w, h), kind: ['mart', 'ramen', 'pachinko', 'clothes'][i] }); }
  const tex = canvasTex(c, { repeat: false, aniso: 4 });
  cached = { tex, E, canvas: c };
  return cached;
}
const PANEL_GLOW = { cola: [1.8, 0.4, 0.35], phone: [0.6, 0.9, 1.9], station: [1.6, 1.6, 1.6], air: [0.5, 1.2, 1.9], bank: [1.4, 1.3, 1.0], whisky: [1.9, 1.2, 0.4], idol: [1.8, 0.7, 1.4], race: [1.9, 1.5, 0.4] };
function drawPanel(g, kind, main, sub, x, y, w, h, rng) {
  const grd = (stops, x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  if (kind === 'cola') {
    g.fillStyle = grd([[0, '#c3120f'], [1, '#7a0907']], x, y, x, y + h); g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y + h * 0.82); g.bezierCurveTo(x + w * 0.3, y + h * 0.45, x + w * 0.6, y + h * 1.05, x + w, y + h * 0.6); g.stroke();
    fitText(g, main, x + w * 0.36, y + h * 0.42, w * 0.6, 70, LAT, '#fff8ee', 400);
    fitText(g, sub, x + w * 0.36, y + h * 0.84, w * 0.6, 18, JP, '#ffe7c0', 700);
    // the can
    g.fillStyle = grd([[0, '#8a0c0a'], [0.4, '#ff4a3a'], [0.6, '#e01c14'], [1, '#600806']], x + w * 0.78, 0, x + w * 0.9, 0); g.fillRect(x + w * 0.78, y + 8, w * 0.1, h - 16);
    g.fillStyle = '#d8d8d8'; g.fillRect(x + w * 0.78, y + 8, w * 0.1, 6);
  } else if (kind === 'phone') {
    g.fillStyle = grd([[0, '#0d1b3a'], [1, '#2a5ad8']], x, y, x + w, y); g.fillRect(x, y, w, h);
    g.fillStyle = '#e8eef8'; g.fillRect(x + w * 0.08, y + 6, w * 0.07, h - 12);
    g.fillStyle = grd([[0, '#3ff4ff'], [1, '#b45cff']], x + w * 0.08, y, x + w * 0.15, y + h); g.fillRect(x + w * 0.085, y + 12, w * 0.06, h - 24);
    fitText(g, main, x + w * 0.55, y + h * 0.4, w * 0.6, 72, LAT, '#ffffff', 400);
    fitText(g, sub, x + w * 0.55, y + h * 0.84, w * 0.6, 18, JP, '#c9dcff', 700);
  } else if (kind === 'station') {
    bg(g, x, y, w, h, '#f1f1ee');
    g.fillStyle = '#1f7a3a'; g.fillRect(x, y + h - 14, w, 14);
    g.fillStyle = '#1f7a3a'; g.beginPath(); g.arc(x + 60, y + h * 0.45, 32, 0, Math.PI * 2); g.fill();
    fitText(g, 'K', x + 60, y + h * 0.47, 40, 40, LAT, '#fff', 400);
    fitText(g, main, x + w * 0.45, y + h * 0.4, w * 0.5, 64, JP, '#141414', 900);
    fitText(g, sub, x + w * 0.45, y + h * 0.8, w * 0.5, 18, LAT, '#333', 400);
  } else if (kind === 'air') {
    g.fillStyle = grd([[0, '#7fc6f2'], [1, '#e8f4fb']], x, y, x, y + h); g.fillRect(x, y, w, h);
    g.fillStyle = '#123f8c'; g.beginPath(); g.moveTo(x + w * 0.7, y + h * 0.5); g.lineTo(x + w * 0.95, y + h * 0.35); g.lineTo(x + w * 0.97, y + h * 0.42); g.lineTo(x + w * 0.76, y + h * 0.56); g.fill();
    fitText(g, main, x + w * 0.33, y + h * 0.4, w * 0.5, 66, LAT, '#123f8c', 400);
    fitText(g, sub, x + w * 0.33, y + h * 0.82, w * 0.55, 18, JP, '#123f8c', 700);
  } else if (kind === 'bank') {
    bg(g, x, y, w, h, '#0f2a52');
    g.fillStyle = '#d6b54a'; g.fillRect(x, y + h - 10, w, 6);
    fitText(g, main, x + w * 0.5, y + h * 0.42, w * 0.6, 62, JP, '#f4f0e2', 900);
    fitText(g, sub, x + w * 0.5, y + h * 0.82, w * 0.6, 18, LAT, '#d6b54a', 400);
  } else if (kind === 'whisky') {
    g.fillStyle = grd([[0, '#2a1606'], [0.5, '#6a3a0c'], [1, '#2a1606']], x, y, x + w, y); g.fillRect(x, y, w, h);
    g.fillStyle = grd([[0, '#f6b84a'], [1, '#a35a10']], 0, y, 0, y + h); g.fillRect(x + w * 0.82, y + 10, w * 0.08, h - 20);
    fitText(g, main, x + w * 0.42, y + h * 0.42, w * 0.6, 60, '"Noto Serif CJK JP", Georgia, serif', '#f6dca0', 700);
    fitText(g, sub, x + w * 0.42, y + h * 0.82, w * 0.6, 20, JPM, '#f2c878', 700);
  } else if (kind === 'idol') {
    g.fillStyle = grd([[0, '#f7c6dc'], [1, '#9c5ad8']], x, y, x + w, y + h); g.fillRect(x, y, w, h);
    // a stylised profile in silhouette + star sparkles
    g.fillStyle = '#2a1030'; g.beginPath(); g.ellipse(x + w * 0.8, y + h * 0.45, h * 0.32, h * 0.38, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(x + w * 0.76, y + h * 0.7, h * 0.4, h * 0.3);
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(255,255,255,0.9)'; const sx = x + rng() * w * 0.6, sy = y + rng() * h; g.fillRect(sx, sy, 3, 3); }
    fitText(g, main, x + w * 0.35, y + h * 0.42, w * 0.5, 70, LAT, '#ffffff', 400, '#7a2a8a');
    fitText(g, sub, x + w * 0.35, y + h * 0.84, w * 0.55, 18, JP, '#3a1040', 700);
  } else if (kind === 'race') {
    g.fillStyle = grd([[0, '#111'], [1, '#2b2b2b']], x, y, x, y + h); g.fillRect(x, y, w, h);
    for (let i = 0; i < 20; i++) { g.fillStyle = (i % 2) ? '#f2f2f2' : '#111'; g.fillRect(x + w - 120 + (i % 4) * 30, y + Math.floor(i / 4) * 20, 30, 20); }
    g.fillStyle = '#f3c623'; g.fillRect(x, y + h * 0.7, w - 130, 6);
    fitText(g, main, x + w * 0.42, y + h * 0.38, w * 0.6, 66, LAT, '#f3c623', 400);
    fitText(g, sub, x + w * 0.42, y + h * 0.85, w * 0.6, 18, JP, '#f2f2f2', 700);
  }
  dirt(g, x, y, w, h, rng, 0.5);
}

// a drinks vending machine: brand header, three rows of dummy cans under a lit window, the buttons, the slot
const VEND = [['#d81e2a', 'COLA'], ['#1e5fd8', 'BOSS'], ['#f2f2f2', 'お茶'], ['#1f9a52', 'GREEN'], ['#f08a12', 'ORANGE'], ['#2b2b2b', 'COFFEE'], ['#d81e2a', 'NEO'], ['#1e5fd8', 'AQUA']];
function drawVend(g, x, y, w, h, i, rng) {
  const [col, name] = VEND[i];
  bg(g, x, y, w, h, col);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, w * 0.12, h);
  fitText(g, name, x + w / 2, y + 14, w - 16, 18, /[A-Z]/.test(name) ? LAT : JP, col === '#f2f2f2' ? '#1f6a3a' : '#fff', 700);
  // the display window: white backlit, 3 shelves of cans with price tags
  bg(g, x + 6, y + 26, w - 12, h * 0.52, '#f6f6f0');
  const cans = ['#c81a1a', '#1a4ac8', '#e8e0c8', '#2a8a4a', '#e88a12', '#3a2a1a', '#f2d21a', '#9a1aa8'];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
    const cx = x + 10 + k * ((w - 20) / 6), cy = y + 30 + r * (h * 0.52 / 3);
    g.fillStyle = cans[Math.floor(rng() * cans.length)]; g.fillRect(cx + 2, cy + 2, (w - 20) / 6 - 4, h * 0.52 / 3 - 12);
    g.fillStyle = '#fff'; g.fillRect(cx + 2, cy + h * 0.52 / 3 - 9, (w - 20) / 6 - 4, 4);
    g.fillStyle = '#20c040'; g.fillRect(cx + 4, cy + h * 0.52 / 3 - 9, 3, 3);
  }
  bg(g, x + 6, y + 30 + h * 0.52, w - 12, 14, '#1a1a1a');
  for (let k = 0; k < 6; k++) { g.fillStyle = '#f0e040'; g.fillRect(x + 12 + k * ((w - 24) / 6), y + 34 + h * 0.52, 8, 5); }
  bg(g, x + 14, y + h - 34, w - 28, 22, '#141414');
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 10, w, 10);
}
// lit interiors seen through the shop glass (flat cards, bright, a little busy)
function drawShop(g, x, y, w, h, i, rng) {
  if (i === 0) { // convenience store: white light, shelves of colour, the counter
    bg(g, x, y, w, h, '#f4f4ee');
    for (let r = 0; r < 4; r++) for (let k = 0; k < 18; k++) { g.fillStyle = `hsl(${Math.floor(rng() * 360)},${50 + rng() * 40}%,${45 + rng() * 25}%)`; g.fillRect(x + 6 + k * 13, y + 40 + r * 30, 11, 22); }
    g.fillStyle = '#d8d8d0'; for (let r = 0; r < 4; r++) g.fillRect(x, y + 62 + r * 30, w, 4);
    g.fillStyle = '#c8c8c0'; g.fillRect(x, y + h - 30, w, 30);
    g.fillStyle = '#1d8a4a'; g.fillRect(x, y, w, 14); g.fillStyle = '#f08a12'; g.fillRect(x, y + 14, w, 6);
  } else if (i === 1) { // ramen counter: warm wood, noren, steam-yellow light
    bg(g, x, y, w, h, '#e8b46a');
    g.fillStyle = '#8a4a1c'; g.fillRect(x, y + h * 0.55, w, h * 0.45);
    g.fillStyle = '#5a2a10'; g.fillRect(x, y + h * 0.55, w, 8);
    for (let k = 0; k < 6; k++) { g.fillStyle = '#2a1a10'; g.fillRect(x + 14 + k * 40, y + h * 0.66, 22, 40); g.fillStyle = '#c03020'; g.beginPath(); g.arc(x + 25 + k * 40, y + h * 0.66, 11, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#20202a'; g.fillRect(x, y, w, 40);
    for (let k = 0; k < 5; k++) { g.fillStyle = '#f2eee4'; g.fillRect(x + 6 + k * 49, y + 44, 42, 30); fitText(g, ['醤油', '味噌', '塩', '豚骨', '餃子'][k], x + 27 + k * 49, y + 59, 38, 18, JP, '#1a1a1a', 900); }
  } else if (i === 2) { // pachinko hall: rows of machines, chrome and lights
    bg(g, x, y, w, h, '#2a1a3a');
    for (let k = 0; k < 9; k++) {
      const mx = x + 4 + k * 27;
      g.fillStyle = '#c8c8d8'; g.fillRect(mx, y + 30, 24, 120);
      g.fillStyle = `hsl(${Math.floor(rng() * 360)},90%,60%)`; g.fillRect(mx + 3, y + 40, 18, 40);
      g.fillStyle = '#f8f0a0'; g.fillRect(mx + 3, y + 84, 18, 30);
      g.fillStyle = '#ff3a6a'; g.fillRect(mx, y + 24, 24, 6);
    }
    g.fillStyle = '#18101e'; g.fillRect(x, y + h - 30, w, 30);
  } else { // clothes shop: racks, mannequins, warm spots
    bg(g, x, y, w, h, '#e8ddd0');
    for (let k = 0; k < 14; k++) { g.fillStyle = `hsl(${Math.floor(rng() * 40 + (rng() < 0.3 ? 200 : 0))},${30 + rng() * 40}%,${25 + rng() * 40}%)`; g.fillRect(x + 8 + k * 17, y + 60, 14, 70); }
    g.fillStyle = '#8a8a8a'; g.fillRect(x, y + 58, w, 3);
    for (let k = 0; k < 2; k++) { g.fillStyle = '#d8d0c8'; g.fillRect(x + 60 + k * 120, y + 30, 16, 120); g.beginPath(); g.arc(x + 68 + k * 120, y + 26, 9, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#b8a890'; g.fillRect(x, y + h - 24, w, 24);
  }
}
