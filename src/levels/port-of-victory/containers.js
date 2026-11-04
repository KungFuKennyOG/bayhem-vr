// BAYHEM — Port of Victory: ISO shipping containers (procedural).
// Field = 2 InstancedMeshes (40 ft / 20 ft) sharing ONE material; livery chosen per instance in the shader
// (atlas row offset), corrugation is analytic in the fragment shader (crisp at 1 m, fades with distance),
// per-instance weathering (rust streaks / dirt / scratches) comes from a tiled grime texture with a
// per-instance offset so ~600 boxes don't repeat. HeroContainer = same material (+damage attribute),
// subdivided shell with interior, two hinged door leaves (3 draw calls).
import * as THREE from 'three';
import '@fontsource/anton/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import { makeRng } from '../../rng.js';
import { makeNoise, fbm, makeCanvas, canvasTex } from '../../textures.js';

export const CONTAINER = { L40: 12.19, L20: 6.06, W: 2.44, H: 2.59 };
const { W, H } = CONTAINER;
const C = 0.16;          // corner post footprint
const SIDE_IN = 0.035;   // side / blind-end panel inset from the outer frame plane
const DOOR_IN = 0.06;    // door plane inset at the door end
const SILL = 0.16, HEAD = 0.16; // door sill / header height
const BARS_U = [0.56, 1.06, 1.38, 1.88]; // locking bar positions across the door end (m, from the left seen from outside)

// ---------------------------------------------------------------- liveries
const LIVERIES = [
  { name: 'VICTORY LINES', short: 'VICTORY', code: 'VCTU', serial: '482913', chk: '2', base: '#a3241c', text: '#f3eee4', logo: 'star' },
  { name: 'OCEANIX', short: 'OCEANIX', code: 'OCXU', serial: '730164', chk: '8', base: '#1e5ba6', text: '#eef3f7', logo: 'wave' },
  { name: 'HANSA BLUE', short: 'HANSA', code: 'HBLU', serial: '215587', chk: '0', base: '#1b2847', text: '#eef0f3', logo: 'band' },
  { name: 'KRONOS', short: 'KRONOS', code: 'KRNU', serial: '903372', chk: '5', base: '#d0601c', text: '#2a2522', logo: 'hourglass' },
  { name: 'EVERFAR', short: 'EVERFAR', code: 'EVFU', serial: '617240', chk: '3', base: '#2d653a', text: '#f0f0e8', logo: 'ring' },
  { name: 'TRITON', short: 'TRITON', code: 'TRTU', serial: '358016', chk: '7', base: '#587a78', text: '#f1f3f0', logo: 'trident' },
  { name: 'SEAHAUL', short: 'SEAHAUL', code: 'SHLU', serial: '144859', chk: '1', base: '#6a2026', text: '#efe6df', logo: 'diamond' },
  { name: 'NORDLEASE', short: 'NORDLEASE', code: 'NRLU', serial: '560731', chk: '4', base: '#d6cdb8', text: '#3a3e45', logo: 'lease' },
];
export const CONTAINER_LIVERIES = LIVERIES.map(l => l.name);

// ---------------------------------------------------------------- atlas layout
// Main atlas 2048x2048: 8 rows x 256 px. Per row: side40 [0,1344) | side20 [1344,2016) | base swatch [2016,2048)
// Door atlas 2048x1024: 4x2 tiles of 512x512 (one door end per livery).
const AW = 2048, RH = 256;
const S40 = [0, 1344], S20 = [1344, 672], SWX = [2016, 32];
const SWU = (SWX[0] + SWX[1] / 2) / AW;

let M = null; // shared materials / textures

function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(h, k, add = 0) { const [r, g, b] = hexRgb(h); const f = v => Math.max(0, Math.min(255, Math.round(v * k + add))); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }

function noiseCanvas(seed, size = 256, base = 6, oct = 4, contrast = 1.6) {
  const n = makeNoise(seed, 64), c = makeCanvas(size, size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = fbm(n, x / size, y / size, base, oct);
    v = Math.max(0, Math.min(1, (v - 0.5) * contrast + 0.5));
    const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// height (Float32, w*h, tileable) -> normal map, x right, y UP (canvas y down)
function hToN(h, w, hh, strength) {
  const c = makeCanvas(w, hh), ctx = c.getContext('2d'), img = ctx.createImageData(w, hh);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const l = h[y * w + ((x - 1 + w) % w)], r = h[y * w + ((x + 1) % w)];
    const up = h[((y - 1 + hh) % hh) * w + x], dn = h[((y + 1) % hh) * w + x];
    let nx = (l - r) * strength, ny = (dn - up) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * w + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------ text helpers (metric, keeps glyph aspect when sx != sy)
function fontStr(px, fam = 'Anton', wt = 400) {
  return fam === 'Anton' ? `400 ${px}px Anton, Impact, sans-serif` : `${wt} ${px}px Oswald, 'Arial Narrow', sans-serif`;
}
// draws text with cap height capM (m), centred on (cx, cy) metres (y up from bottom); returns width in m
function mText(R, str, cx, cy, capM, { maxW = 1e9, color = '#fff', fam = 'Anton', wt = 400, align = 'center', spacing = 0, alpha = 1 } = {}) {
  const { ctx } = R;
  const capRatio = fam === 'Anton' ? 0.735 : 0.72;
  let px = capM / capRatio * R.sy;
  ctx.save();
  ctx.font = fontStr(px, fam, wt);
  ctx.letterSpacing = `${spacing * px}px`;
  let tw = ctx.measureText(str).width / R.sy; // metres
  if (tw > maxW) { px *= maxW / tw; capM *= maxW / tw; ctx.font = fontStr(px, fam, wt); ctx.letterSpacing = `${spacing * px}px`; tw = maxW; }
  ctx.translate(R.X(cx), R.Y(cy - capM / 2));
  ctx.scale(R.sx / R.sy, 1);
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillText(str, 0, 0);
  ctx.restore();
  return tw;
}
// metric drawing context: origin at (cx, cy) metres, y up, 1 unit = 1 m
function mDraw(R, cx, cy, fn) {
  const { ctx } = R; ctx.save(); ctx.translate(R.X(cx), R.Y(cy)); ctx.scale(R.sx, -R.sy); fn(ctx); ctx.restore();
}
function region(ctx, x0, y0, wpx, hpx, wm, hm) {
  const sx = wpx / wm, sy = hpx / hm;
  return { ctx, x0, y0, wpx, hpx, wm, hm, sx, sy, X: m => x0 + m * sx, Y: m => y0 + (hm - m) * sy };
}

function drawLogo(R, liv, cx, cy, s) { // s = logo height (m)
  const col = liv.text;
  mDraw(R, cx, cy, (c) => {
    c.fillStyle = col; c.strokeStyle = col;
    switch (liv.logo) {
      case 'star': {
        c.beginPath(); c.arc(0, 0, s / 2, 0, Math.PI * 2); c.fill();
        c.fillStyle = liv.base; c.beginPath();
        for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.19 : 0.46) * s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        c.closePath(); c.fill();
        break;
      }
      case 'wave': {
        c.lineWidth = s * 0.11; c.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          c.beginPath();
          for (let i = 0; i <= 24; i++) { const t = i / 24, x = (t - 0.5) * s * 1.3; c.lineTo(x, (k - 1) * s * 0.3 + Math.sin(t * Math.PI * 2) * s * 0.09); }
          c.stroke();
        }
        break;
      }
      case 'hourglass': {
        c.beginPath(); c.moveTo(-s * 0.4, s / 2); c.lineTo(s * 0.4, s / 2); c.lineTo(0, 0.02 * s); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(-s * 0.4, -s / 2); c.lineTo(s * 0.4, -s / 2); c.lineTo(0, -0.02 * s); c.closePath(); c.fill();
        break;
      }
      case 'ring': {
        c.lineWidth = s * 0.14; c.beginPath(); c.arc(0, 0, s * 0.42, 0.5, Math.PI * 2 - 0.2); c.stroke();
        c.fillRect(-s * 0.12, -s * 0.07, s * 0.5, s * 0.14);
        break;
      }
      case 'trident': {
        const w = s * 0.08;
        c.fillRect(-w / 2, -s / 2, w, s * 0.85);
        c.fillRect(-s * 0.3, s * 0.08, s * 0.6, w);
        for (const x of [-s * 0.3, s * 0.3 - w]) c.fillRect(x, s * 0.08, w, s * 0.34);
        for (const x of [-s * 0.3 + w / 2, 0, s * 0.3 - w / 2]) { c.beginPath(); c.moveTo(x - w * 1.1, s * 0.4); c.lineTo(x + w * 1.1, s * 0.4); c.lineTo(x, s * 0.52); c.closePath(); c.fill(); }
        break;
      }
      case 'diamond': {
        c.beginPath(); c.moveTo(0, s / 2); c.lineTo(s * 0.45, 0); c.lineTo(0, -s / 2); c.lineTo(-s * 0.45, 0); c.closePath(); c.fill();
        c.strokeStyle = liv.base; c.lineWidth = s * 0.09; c.beginPath();
        for (let i = 0; i <= 20; i++) { const t = i / 20; c.lineTo((t - 0.5) * s * 0.5, Math.sin(t * Math.PI * 2) * s * 0.09); }
        c.stroke();
        break;
      }
      case 'lease': {
        c.fillRect(-s / 2, -s / 2, s, s); c.fillStyle = liv.base;
        c.fillRect(-s * 0.3, -s * 0.3, s * 0.2, s * 0.6); c.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.2);
        break;
      }
      default: break;
    }
  });
}

// --------------------------------------------------------------- side panel painter
function paintSide(ctx, x0, y0, wpx, Lm, liv, rng, nc, is20) {
  const R = region(ctx, x0, y0, wpx, RH, Lm, H);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, wpx, RH); ctx.clip();
  ctx.fillStyle = liv.base; ctx.fillRect(x0, y0, wpx, RH);
  // sheet-to-sheet paint variation (sheets ~1.1 m) + vertical seam lines
  for (let m = 0; m < Lm;) {
    const sw = 0.85 + rng() * 0.55;
    ctx.fillStyle = rng() < 0.5 ? `rgba(0,0,0,${0.02 + rng() * 0.05})` : `rgba(255,250,240,${0.02 + rng() * 0.04})`;
    ctx.fillRect(R.X(m), y0, sw * R.sx, RH);
    ctx.fillStyle = 'rgba(30,20,15,0.12)'; ctx.fillRect(R.X(m + sw) - 0.5, y0, 1, RH);
    m += sw;
  }
  // mottling
  const pat = ctx.createPattern(nc, 'repeat');
  pat.setTransform(new DOMMatrix().translate(x0 + rng() * 256, y0).scale(1.6, 0.9));
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.22; ctx.fillStyle = pat; ctx.fillRect(x0, y0, wpx, RH);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // ---- livery graphics
  const tc = liv.text;
  const mid = Lm / 2;
  if (liv.logo === 'band') {
    ctx.fillStyle = tc; ctx.fillRect(R.X(0), R.Y(2.28), wpx, 0.2 * R.sy);
    ctx.fillStyle = rgba(tc, 0.9); ctx.fillRect(R.X(0), R.Y(0.62), wpx, 0.06 * R.sy);
  }
  if (liv.logo === 'lease') {
    drawLogo(R, liv, 0.62, 2.05, 0.34);
    mText(R, liv.name, 0.92, 2.05, 0.2, { color: tc, fam: 'Oswald', wt: 700, align: 'left', spacing: 0.04, alpha: 0.85 });
    mText(R, 'LEASED UNIT  ·  RETURN TO DEPOT', 0.92, 1.82, 0.065, { color: tc, fam: 'Oswald', wt: 500, align: 'left', alpha: 0.7 });
    if (!is20) mText(R, 'NORD', Lm - 2.6, 1.3, 0.55, { color: rgba(tc, 0.18), alpha: 1 });
  } else {
    const txt = is20 ? liv.short : liv.name;
    const cap = is20 ? (txt.length > 7 ? 0.62 : 0.78) : 1.0;
    const logoS = is20 ? 0.9 : 1.25;
    const maxW = Lm - (is20 ? 2.1 : 3.4);
    const gap = 0.35;
    // measure, then draw logo + text as a centred group
    ctx.font = fontStr(cap / 0.735 * R.sy); ctx.letterSpacing = `${0.03 * cap / 0.735 * R.sy}px`;
    let tw = Math.min(maxW, ctx.measureText(txt).width / R.sy);
    const groupW = logoS + gap + tw, gx = mid - groupW / 2;
    const cy = 1.42;
    drawLogo(R, liv, gx + logoS / 2, cy, logoS);
    mText(R, txt, gx + logoS + gap, cy, cap, { maxW, color: tc, align: 'left', spacing: 0.03, alpha: 0.96 });
    if (!is20 && liv.logo !== 'band') {
      mText(R, liv.logo === 'star' ? '★  WE DELIVER  ★' : (liv.logo === 'hourglass' ? 'ON TIME. EVERY TIME.' : 'GLOBAL CONTAINER SERVICE'), mid, 0.62, 0.12, { color: tc, fam: 'Oswald', wt: 500, spacing: 0.15, alpha: 0.75 });
    }
  }
  // code markings (top right corner, like real side markings)
  const ccol = liv.logo === 'lease' || liv.logo === 'hourglass' ? '#2b2b2b' : '#f2f0ea';
  mText(R, `${liv.code} ${liv.serial} ${liv.chk}`, Lm - 0.35, 2.22, 0.1, { color: ccol, fam: 'Oswald', wt: 700, align: 'right', alpha: 0.9 });
  mText(R, is20 ? '22G1' : '45G1', Lm - 0.35, 2.05, 0.1, { color: ccol, fam: 'Oswald', wt: 700, align: 'right', alpha: 0.9 });

  // ---- repaired / patched panels (sometimes painted over the lettering)
  const nPatch = 1 + Math.floor(rng() * (is20 ? 2 : 3));
  for (let p = 0; p < nPatch; p++) {
    const pw = 0.6 + rng() * 1.4, ph = 0.5 + rng() * 1.7;
    const px = 0.4 + rng() * (Lm - pw - 0.8), py = 0.2 + rng() * (H - ph - 0.45);
    const kind = rng();
    ctx.fillStyle = kind < 0.2 ? '#7d7a72' : shade(liv.base, 0.86 + rng() * 0.24, (rng() - 0.5) * 12);
    ctx.fillRect(R.X(px), R.Y(py + ph), pw * R.sx, ph * R.sy);
    ctx.strokeStyle = 'rgba(90,40,15,0.55)'; ctx.lineWidth = 1.2;
    ctx.strokeRect(R.X(px), R.Y(py + ph), pw * R.sx, ph * R.sy);
  }
  // ---- sun fade (top lighter / chalky), bottom dirt
  let g = ctx.createLinearGradient(0, y0, 0, y0 + RH);
  g.addColorStop(0, 'rgba(255,244,228,0.22)'); g.addColorStop(0.45, 'rgba(255,244,228,0.06)'); g.addColorStop(1, 'rgba(255,244,228,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, wpx, RH);
  g = ctx.createLinearGradient(0, y0 + RH, 0, y0 + RH * 0.55);
  g.addColorStop(0, 'rgba(48,36,24,0.45)'); g.addColorStop(1, 'rgba(48,36,24,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, wpx, RH);
  // ---- paint chipping on lettering: base-colour speckles + bare-metal flecks
  for (let i = 0; i < Lm * 120; i++) {
    const x = R.X(rng() * Lm), y = y0 + rng() * RH, r = 0.4 + rng() * rng() * 2.2;
    ctx.fillStyle = rng() < 0.75 ? rgba(liv.base, 0.75) : 'rgba(110,100,90,0.6)';
    ctx.fillRect(x, y, r * (0.6 + rng()), r);
  }
  // ---- a few baked rust runs under the top rail
  for (let i = 0; i < Lm * 1.2; i++) {
    const x = R.X(rng() * Lm), len = (0.2 + rng() * rng() * 1.6) * R.sy, w = 0.8 + rng() * 1.8;
    const gr = ctx.createLinearGradient(0, y0, 0, y0 + len);
    gr.addColorStop(0, `rgba(105,45,15,${0.35 + rng() * 0.4})`); gr.addColorStop(1, 'rgba(105,45,15,0)');
    ctx.fillStyle = gr; ctx.fillRect(x, y0, w, len);
  }
  ctx.restore();
}

function paintSwatch(ctx, y0, liv, nc) {
  const [x0, w] = SWX;
  ctx.fillStyle = liv.base; ctx.fillRect(x0, y0, w, RH);
  const pat = ctx.createPattern(nc, 'repeat');
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.22; ctx.fillStyle = pat; ctx.fillRect(x0, y0, w, RH);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  let g = ctx.createLinearGradient(0, y0, 0, y0 + RH);
  g.addColorStop(0, 'rgba(255,244,228,0.22)'); g.addColorStop(0.45, 'rgba(255,244,228,0.06)'); g.addColorStop(1, 'rgba(255,244,228,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, RH);
  g = ctx.createLinearGradient(0, y0 + RH, 0, y0 + RH * 0.55);
  g.addColorStop(0, 'rgba(48,36,24,0.45)'); g.addColorStop(1, 'rgba(48,36,24,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, RH);
}

// --------------------------------------------------------------- door end painter (512x512 tile = 2.44 x 2.59 m)
const LEAF_L = [C, W / 2 - 0.006], LEAF_R = [W / 2 + 0.006, W - C];
function doorLayoutHeight() {
  // grayscale height map of the door end shared by all liveries
  const S = 512, c = makeCanvas(S, S), ctx = c.getContext('2d');
  const R = region(ctx, 0, 0, S, S, W, H);
  ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, S, S);
  const rect = (u0, v0, u1, v1, col) => { ctx.fillStyle = col; ctx.fillRect(R.X(u0), R.Y(v1), (u1 - u0) * R.sx, (v1 - v0) * R.sy); };
  for (const [a, b] of [LEAF_L, LEAF_R]) {
    // leaf frame (flat, raised) + 4 flutes inside
    rect(a, SILL, b, H - HEAD, 'rgb(150,150,150)');
    const fa = a + 0.07, fb = b - 0.07, n = 4, pw = (fb - fa) / n;
    for (let k = 0; k < n; k++) {
      const u0 = fa + k * pw;
      // trapezoid flute: ramps as gradient
      const g = ctx.createLinearGradient(R.X(u0), 0, R.X(u0 + pw), 0);
      g.addColorStop(0, 'rgb(150,150,150)'); g.addColorStop(0.18, 'rgb(150,150,150)'); g.addColorStop(0.36, 'rgb(95,95,95)');
      g.addColorStop(0.64, 'rgb(95,95,95)'); g.addColorStop(0.82, 'rgb(150,150,150)'); g.addColorStop(1, 'rgb(150,150,150)');
      ctx.fillStyle = g; ctx.fillRect(R.X(u0), R.Y(H - HEAD - 0.16), pw * R.sx, (H - HEAD - SILL - 0.32) * R.sy);
    }
    // top/bottom flute end bevels
    rect(fa, SILL + 0.13, fb, SILL + 0.16, 'rgb(122,122,122)');
    rect(fa, H - HEAD - 0.16, fb, H - HEAD - 0.13, 'rgb(122,122,122)');
    // seals at edges
    rect(a, SILL, a + 0.015, H - HEAD, 'rgb(70,70,70)'); rect(b - 0.015, SILL, b, H - HEAD, 'rgb(70,70,70)');
    rect(a, SILL, b, SILL + 0.015, 'rgb(70,70,70)'); rect(a, H - HEAD - 0.015, b, H - HEAD, 'rgb(70,70,70)');
  }
  rect(W / 2 - 0.006, SILL, W / 2 + 0.006, H - HEAD, 'rgb(40,40,40)');
  // hinges (outer edges)
  for (const v of [0.45, 1.02, 1.62, 2.18]) {
    rect(C - 0.02, v - 0.035, C + 0.085, v + 0.035, 'rgb(190,190,190)');
    rect(W - C - 0.085, v - 0.035, W - C + 0.02, v + 0.035, 'rgb(190,190,190)');
  }
  // bar brackets + handle retainers + cam keepers
  for (const u of BARS_U) {
    for (const v of [0.78, 1.78]) rect(u - 0.045, v - 0.03, u + 0.045, v + 0.03, 'rgb(185,185,185)');
    rect(u - 0.045, SILL + 0.015, u + 0.045, SILL + 0.11, 'rgb(200,200,200)');
    rect(u - 0.045, H - HEAD - 0.11, u + 0.045, H - HEAD - 0.015, 'rgb(200,200,200)');
    const hs = u < W / 2 ? 1 : -1;
    rect(Math.min(u, u + hs * 0.07) - 0.012, 1.0, Math.max(u, u + hs * 0.07) + 0.012, 1.06, 'rgb(180,180,180)');
  }
  // CSC plate
  rect(0.30, 1.36, 0.50, 1.50, 'rgb(165,165,165)');
  ctx.filter = 'blur(1.2px)'; ctx.drawImage(c, 0, 0); ctx.filter = 'none';
  const d = ctx.getImageData(0, 0, S, S).data, h = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) h[i] = d[i * 4] / 255;
  return { canvas: c, h, S };
}

function paintDoor(ctx, x0, y0, liv, rng, nc) {
  const S = 512;
  const R = region(ctx, x0, y0, S, S, W, H);
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.clip();
  const rect = (u0, v0, u1, v1, col) => { ctx.fillStyle = col; ctx.fillRect(R.X(u0), R.Y(v1), (u1 - u0) * R.sx, (v1 - v0) * R.sy); };
  ctx.fillStyle = liv.base; ctx.fillRect(x0, y0, S, S);
  const pat = ctx.createPattern(nc, 'repeat');
  pat.setTransform(new DOMMatrix().translate(x0 + rng() * 200, y0).scale(1.3, 1.3));
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.2; ctx.fillStyle = pat; ctx.fillRect(x0, y0, S, S);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // flute AO / sheen (consistent with height map)
  for (const [a, b] of [LEAF_L, LEAF_R]) {
    const fa = a + 0.07, fb = b - 0.07, n = 4, pw = (fb - fa) / n;
    for (let k = 0; k < n; k++) {
      const u0 = fa + k * pw;
      rect(u0 + pw * 0.36, SILL + 0.16, u0 + pw * 0.64, H - HEAD - 0.16, 'rgba(0,0,0,0.07)');
      rect(u0 + pw * 0.18, SILL + 0.16, u0 + pw * 0.36, H - HEAD - 0.16, 'rgba(255,255,255,0.035)');
    }
    // seals
    rect(a, SILL, a + 0.016, H - HEAD, 'rgba(18,16,15,0.9)'); rect(b - 0.016, SILL, b, H - HEAD, 'rgba(18,16,15,0.9)');
    rect(a, SILL, b, SILL + 0.016, 'rgba(18,16,15,0.9)'); rect(a, H - HEAD - 0.016, b, H - HEAD, 'rgba(18,16,15,0.9)');
  }
  rect(W / 2 - 0.007, SILL, W / 2 + 0.007, H - HEAD, '#0d0c0b');
  // frame (posts/header/sill) slightly darker
  rect(0, 0, C, H, shade(liv.base, 0.85)); rect(W - C, 0, W, H, shade(liv.base, 0.85));
  rect(0, 0, W, SILL, shade(liv.base, 0.8)); rect(0, H - HEAD, W, H, shade(liv.base, 0.85));
  // hinges
  const metal = shade(liv.base, 0.62, 8);
  for (const v of [0.45, 1.02, 1.62, 2.18]) {
    for (const [u0, u1] of [[C - 0.02, C + 0.085], [W - C - 0.085, W - C + 0.02]]) {
      rect(u0, v - 0.035, u1, v + 0.035, metal);
      rect(u0, v + 0.02, u1, v + 0.035, 'rgba(255,255,255,0.15)');
      rect(u0 + 0.01, v - 0.012, u1 - 0.01, v + 0.012, 'rgba(0,0,0,0.35)');
    }
  }
  // bars: AO strip behind the geometry bar, brackets, cam keepers, handles
  for (const u of BARS_U) {
    rect(u - 0.03, SILL, u + 0.03, H - HEAD, 'rgba(0,0,0,0.22)');
    for (const v of [0.78, 1.78]) { rect(u - 0.045, v - 0.03, u + 0.045, v + 0.03, metal); rect(u - 0.045, v - 0.032, u + 0.045, v - 0.026, 'rgba(0,0,0,0.4)'); }
    rect(u - 0.045, SILL + 0.015, u + 0.045, SILL + 0.11, shade(liv.base, 0.55, 6));
    rect(u - 0.045, H - HEAD - 0.11, u + 0.045, H - HEAD - 0.015, shade(liv.base, 0.55, 6));
    const hs = u < W / 2 ? 1 : -1;
    rect(Math.min(u, u + hs * 0.07) - 0.012, 1.0, Math.max(u, u + hs * 0.07) + 0.012, 1.06, metal);
    // handle lever lying alongside the bar
    rect(u + hs * 0.035 - 0.011, 0.92, u + hs * 0.035 + 0.011, 1.5, 'rgba(25,22,20,0.55)');
    rect(u + hs * 0.035 - 0.011, 0.92, u + hs * 0.035 - 0.004, 1.5, 'rgba(255,255,255,0.12)');
  }
  // CSC plate
  rect(0.30, 1.36, 0.50, 1.50, '#a9aba6');
  rect(0.30, 1.36, 0.50, 1.37, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = 'rgba(40,40,40,0.75)';
  for (let k = 0; k < 7; k++) ctx.fillRect(R.X(0.315), R.Y(1.48 - k * 0.016), (0.06 + rng() * 0.11) * R.sx, 1.2);
  mText(R, 'CSC SAFETY APPROVAL', 0.40, 1.485, 0.009, { color: '#222', fam: 'Oswald', wt: 700 });
  // markings
  const mcol = liv.logo === 'lease' || liv.logo === 'hourglass' ? '#262422' : '#f1efe8';
  const cx = (LEAF_R[0] + LEAF_R[1]) / 2;
  const w1 = mText(R, `${liv.code} ${liv.serial}`, cx - 0.09, 2.2, 0.085, { color: mcol, fam: 'Oswald', wt: 700, spacing: 0.04 });
  const bx = cx - 0.09 + w1 / 2 + 0.07;
  ctx.strokeStyle = mcol; ctx.lineWidth = 2; ctx.strokeRect(R.X(bx - 0.045), R.Y(2.26), 0.09 * R.sx, 0.12 * R.sy);
  mText(R, liv.chk, bx, 2.2, 0.085, { color: mcol, fam: 'Oswald', wt: 700 });
  mText(R, '45G1', cx, 2.05, 0.085, { color: mcol, fam: 'Oswald', wt: 700, spacing: 0.05 });
  const lx = (LEAF_L[0] + LEAF_L[1]) / 2 + 0.03;
  const rows = ['MAX. GROSS  30,480 KG', '67,200 LB', 'TARE  3,750 KG', '8,270 LB', 'NET  26,730 KG', 'CU. CAP.  33.2 CU.M'];
  rows.forEach((s, k) => mText(R, s, lx, 2.24 - k * 0.06, 0.03, { color: mcol, fam: 'Oswald', wt: 500, alpha: 0.9 }));
  // logo + name on right leaf
  drawLogo(R, liv, cx, 1.55, 0.26);
  mText(R, liv.short, cx, 1.30, 0.085, { color: liv.text, maxW: 0.9, spacing: 0.04 });
  // small warning sticker remnants
  if (rng() < 0.8) { const u = 0.35 + rng() * 0.4, v = 0.55 + rng() * 0.25; rect(u, v, u + 0.11, v + 0.11, 'rgba(235,225,200,0.7)'); rect(u + 0.02, v + 0.06, u + 0.09, v + 0.08, 'rgba(160,30,20,0.6)'); }
  // weathering: sun fade, bottom rust & dirt, streaks from hinges/brackets
  let g = ctx.createLinearGradient(0, y0, 0, y0 + S);
  g.addColorStop(0, 'rgba(255,244,228,0.18)'); g.addColorStop(0.5, 'rgba(255,244,228,0.04)'); g.addColorStop(1, 'rgba(255,244,228,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, S, S);
  g = ctx.createLinearGradient(0, y0 + S, 0, y0 + S * 0.62);
  g.addColorStop(0, 'rgba(60,36,18,0.6)'); g.addColorStop(1, 'rgba(60,36,18,0)');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, S, S);
  const streak = (u, v, len, a) => {
    const gr = ctx.createLinearGradient(0, R.Y(v), 0, R.Y(v - len));
    gr.addColorStop(0, `rgba(110,45,14,${a})`); gr.addColorStop(1, 'rgba(110,45,14,0)');
    ctx.fillStyle = gr; ctx.fillRect(R.X(u), R.Y(v), 1.5 + rng() * 2.5, len * R.sy);
  };
  for (const v of [0.45, 1.02, 1.62, 2.18]) { streak(C + 0.03 + rng() * 0.04, v - 0.03, 0.15 + rng() * 0.5, 0.5); streak(W - C - 0.06 + rng() * 0.04, v - 0.03, 0.15 + rng() * 0.5, 0.5); }
  for (const u of BARS_U) { streak(u - 0.03 + rng() * 0.06, 1.75, 0.2 + rng() * 0.6, 0.4); streak(u - 0.03 + rng() * 0.06, 0.75, 0.2 + rng() * 0.4, 0.45); }
  for (let i = 0; i < 26; i++) {
    const u = C + rng() * (W - 2 * C), v = SILL + rng() * 0.25, r = (0.01 + rng() * 0.05) * R.sx;
    const gr = ctx.createRadialGradient(R.X(u), R.Y(v), 0, R.X(u), R.Y(v), r);
    gr.addColorStop(0, 'rgba(95,40,12,0.8)'); gr.addColorStop(1, 'rgba(95,40,12,0)');
    ctx.fillStyle = gr; ctx.fillRect(R.X(u) - r, R.Y(v) - r, r * 2, r * 2);
  }
  for (let i = 0; i < 260; i++) {
    const x = x0 + rng() * S, y = y0 + rng() * S, r = 0.5 + rng() * rng() * 2.5;
    ctx.fillStyle = rng() < 0.7 ? rgba(liv.base, 0.7) : 'rgba(105,95,85,0.6)';
    ctx.fillRect(x, y, r * (0.6 + rng()), r);
  }
  ctx.restore();
}

// --------------------------------------------------------------- grime (R rust streaks, G dirt, B scratches)
// 512x512 covers 4 m (u, tiles) x container height (v: canvas top = container top). G and B tile in both axes.
function grimeTexture() {
  const S = 512, rng = makeRng(7771);
  const rc = makeCanvas(S, S), r = rc.getContext('2d');
  r.fillStyle = '#000'; r.fillRect(0, 0, S, S);
  r.globalCompositeOperation = 'lighter';
  const wrapX = (x, fn) => { fn(x); if (x < 40) fn(x + S); if (x > S - 40) fn(x - S); };
  for (let i = 0; i < 300; i++) {
    const top = rng() < 0.72;
    const x = rng() * S, y0 = top ? rng() * 14 : 40 + rng() * 380;
    const len = top ? 20 + Math.pow(rng(), 1.8) * 420 : 15 + rng() * 140;
    const w = 0.8 + rng() * rng() * 4, a = 0.15 + rng() * 0.65;
    wrapX(x, (xx) => {
      const g = r.createLinearGradient(0, y0, 0, y0 + len);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.3, `rgba(255,255,255,${a * 0.7})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      r.fillStyle = g; r.fillRect(xx - w / 2, y0, w, len);
      if (!top) { const rg = r.createRadialGradient(xx, y0, 0, xx, y0, 3 + rng() * 6); rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); r.fillStyle = rg; r.fillRect(xx - 10, y0 - 10, 20, 20); }
    });
  }
  // rust along the bottom rail and top rail
  for (let i = 0; i < 90; i++) {
    const x = rng() * S, y = rng() < 0.65 ? S - rng() * 46 : rng() * 14, rad = 3 + rng() * 22, a = 0.2 + rng() * 0.6;
    wrapX(x, (xx) => { const rg = r.createRadialGradient(xx, y, 0, xx, y, rad); rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); r.fillStyle = rg; r.fillRect(xx - rad, y - rad, rad * 2, rad * 2); });
  }
  r.globalCompositeOperation = 'source-over';
  r.filter = 'blur(0.7px)'; r.drawImage(rc, 0, 0); r.filter = 'none';
  // scratches
  const bc = makeCanvas(S, S), b = bc.getContext('2d');
  b.fillStyle = '#000'; b.fillRect(0, 0, S, S); b.lineCap = 'round';
  for (let i = 0; i < 320; i++) {
    const x = rng() * S, y = Math.pow(rng(), 0.8) * S, len = 4 + rng() * rng() * 70;
    const ang = (rng() < 0.7 ? (rng() - 0.5) * 0.6 : rng() * Math.PI);
    const a = 0.3 + rng() * 0.7;
    b.strokeStyle = `rgba(255,255,255,${a})`; b.lineWidth = 0.5 + rng() * 1.3;
    for (const ox of [0, S, -S]) for (const oy of [0, S, -S]) {
      b.beginPath(); b.moveTo(x + ox, y + oy); b.lineTo(x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len); b.stroke();
    }
  }
  for (let i = 0; i < 160; i++) { // chips
    const x = rng() * S, y = rng() * S, s = 1 + rng() * 3;
    b.fillStyle = `rgba(255,255,255,${0.5 + rng() * 0.5})`; b.fillRect(x, y, s, s * (0.5 + rng()));
  }
  const rd = r.getImageData(0, 0, S, S).data, bd = b.getImageData(0, 0, S, S).data;
  const n = makeNoise(4242, 64);
  const out = makeCanvas(S, S), o = out.getContext('2d'), img = o.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    let d = fbm(n, x / S, y / S, 5, 5);
    d = Math.max(0, Math.min(1, (d - 0.42) * 2.4));
    img.data[i] = rd[i]; img.data[i + 1] = d * 255; img.data[i + 2] = bd[i]; img.data[i + 3] = 255;
  }
  o.putImageData(img, 0, 0);
  return out;
}

// dents / dings height -> normal (tile 2.7 x 2.1 m)
function detailNormal() {
  const S = 512, rng = makeRng(991), h = new Float32Array(S * S), n = makeNoise(77, 32);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = fbm(n, x / S, y / S, 3, 4) * 1.2;
  for (let k = 0; k < 46; k++) {
    const cx = rng() * S, cy = rng() * S, rad = 6 + Math.pow(rng(), 2) * 60, dep = (0.4 + rng()) * (rad / 40);
    const R = Math.ceil(rad * 2.5);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = ((Math.floor(cx) + dx) % S + S) % S, y = ((Math.floor(cy) + dy) % S + S) % S;
      h[y * S + x] -= dep * Math.exp(-(dx * dx + dy * dy) / (2 * rad * rad));
    }
  }
  for (let k = 0; k < 40; k++) { // grooves
    let x = rng() * S, y = rng() * S; const ang = (rng() - 0.5) * 0.8 + (rng() < 0.3 ? 1.5 : 0), len = 10 + rng() * 80;
    for (let t = 0; t < len; t++) { const xi = ((Math.floor(x) % S) + S) % S, yi = ((Math.floor(y) % S) + S) % S; h[yi * S + xi] -= 0.25; x += Math.cos(ang); y += Math.sin(ang); }
  }
  return hToN(h, S, S, 2.2);
}

// --------------------------------------------------------------- material
const VERT_PRE = /* glsl */`
attribute vec2 aA; attribute vec3 aD; attribute vec3 aT; attribute vec4 aInst;
varying vec2 vA; varying vec3 vD; varying vec4 vI; varying vec3 vT;
#ifdef CTR_DMG
attribute vec2 aDmg; varying vec2 vDmg;
#endif
`;
const VERT_MAIN = /* glsl */`
vA = aA; vD = aD; vI = aInst;
{ vec3 tO = aT;
#ifdef USE_INSTANCING
  tO = mat3(instanceMatrix) * tO;
#endif
  vT = normalize(mat3(modelViewMatrix) * tO); }
#ifdef CTR_DMG
vDmg = aDmg;
#endif
`;
const FRAG_PRE = /* glsl */`
uniform sampler2D tAtlas; uniform sampler2D tDoor; uniform sampler2D tGrime; uniform sampler2D tDetN; uniform sampler2D tDoorN;
varying vec2 vA; varying vec3 vD; varying vec4 vI; varying vec3 vT;
#ifdef CTR_DMG
varying vec2 vDmg;
#endif
float cbox(float t, float a, float b, float e) { return smoothstep(a - e, a + e, t) - smoothstep(b - e, b + e, t); }
// trapezoidal corrugation: returns dh/du, 'inner' = 1 on the recessed flats
float trap(float u, float P, float depth, out float inner) {
  float fw = fwidth(u) / P;
  float t = fract(u / P);
  float e = clamp(fw * 1.2, 0.03, 0.14);
  float fade = 1.0 - smoothstep(0.09, 0.3, fw);
  inner = cbox(t, 0.37, 0.63, e) * fade;
  return (cbox(t, 0.63, 0.87, e) - cbox(t, 0.13, 0.37, e)) * depth / (0.24 * P) * fade;
}
`;
const FRAG_MAP = /* glsl */`
int fti = int(vD.z + 0.5);
vec2 gs = fract(vec2(vI.z * 17.13, vI.z * 5.71 + 0.3));
float hgt = clamp(vD.y / ${H.toFixed(2)}, 0.0, 1.0);
vec3 col; float cRough = 0.6; float cMetal = 0.12;
bool horiz = (fti == 1 || fti == 5);
vec3 gr = texture2D(tGrime, horiz ? vD.xy / vec2(4.0, 2.44) + gs : vec2(vD.x / 4.0 + gs.x, clamp(hgt, 0.004, 0.996))).rgb;
if (fti == 3) {
  float gx = mod(vI.x, 4.0), gy = floor(vI.x / 4.0 + 0.01);
  vec2 l = clamp(vA, 0.003, 0.997);
  col = texture2D(tDoor, vec2((gx + l.x) * 0.25, 1.0 - (gy + 1.0 - l.y) * 0.5)).rgb;
} else if (fti <= 5) {
  col = texture2D(tAtlas, vec2(vA.x, 1.0 - (vI.x + 1.0 - clamp(vA.y, 0.012, 0.988)) * 0.125)).rgb;
} else if (fti == 6) {
  col = vec3(0.30, 0.29, 0.27) * (0.85 + 0.3 * gr.g); cRough = 0.95; cMetal = 0.0;
} else if (fti == 7) {
  float pl = fract(vD.y / 0.305);
  float grain = texture2D(tGrime, vec2(vD.x / 7.0, vD.y / 0.5)).g;
  col = vec3(0.40, 0.26, 0.15) * (0.7 + 0.55 * grain) * (0.55 + 0.45 * smoothstep(0.0, 0.04, pl) * smoothstep(1.0, 0.96, pl));
  cRough = 0.85; cMetal = 0.0;
} else {
  col = vec3(0.55, 0.40, 0.24) * (0.85 + 0.25 * gr.g);
  if (abs(vA.x - 0.5) < 0.07) col = vec3(0.62, 0.52, 0.36);
  cRough = 0.9; cMetal = 0.0;
}
if (fti <= 5) {
  float rustA = vI.w;
  float streak = horiz ? smoothstep(0.62, 0.9, gr.g) * rustA * 0.8 : gr.r * (0.2 + 1.1 * rustA);
  if (fti == 3) streak *= 0.7;
  vec3 rustC = mix(vec3(0.24, 0.085, 0.03), vec3(0.50, 0.22, 0.07), gr.g);
  float rs = clamp(streak, 0.0, 1.0) * 0.8;
  col = mix(col, rustC, rs);
  float dirt = horiz ? gr.g * 0.6 : gr.g * (smoothstep(0.5, 0.0, hgt) * 0.9 + 0.2);
  dirt *= 0.45 + rustA * 0.7;
  col = mix(col, col * vec3(0.5, 0.46, 0.4), clamp(dirt, 0.0, 1.0));
  float scr = smoothstep(0.35, 0.95, gr.b) * (0.35 + rustA * 0.8);
  col = mix(col, vec3(0.40, 0.385, 0.36), scr * 0.65);
  if (fti == 1) { float lum = dot(col, vec3(0.3, 0.59, 0.11)); col = mix(col, vec3(lum) * vec3(1.04, 1.0, 0.95), 0.3) * 1.04; }
  if (fti == 5) col *= 0.25;
  col *= vI.y;
  cRough = mix(cRough, 0.92, rs) ; cRough = mix(cRough, 0.42, scr * 0.6);
  cMetal = mix(cMetal, 0.55, scr * 0.6); cMetal = mix(cMetal, 0.0, rs);
}
#ifdef CTR_DMG
col = mix(col, vec3(0.42, 0.40, 0.37) * (0.8 + 0.4 * gr.g), clamp(vDmg.y, 0.0, 1.0));
cRough = mix(cRough, 0.4, clamp(vDmg.y, 0.0, 1.0)); cMetal = mix(cMetal, 0.65, clamp(vDmg.y, 0.0, 1.0));
col *= 1.0 - clamp(vDmg.x, 0.0, 0.95);
#endif
diffuseColor.rgb *= col;
`;
const FRAG_NRM = /* glsl */`
{
  vec3 Tv = vT - dot(vT, normal) * normal; float tl = length(Tv);
  Tv = tl > 1e-4 ? Tv / tl : vec3(1.0, 0.0, 0.0);
  vec3 Bv = cross(normal, Tv);
  float inner = 0.0; float sl = 0.0;
  if (fti == 0 || fti == 2) sl = trap(vD.x, 0.278, 0.022, inner);
  else if (fti == 6) sl = -0.7 * trap(vD.x, 0.278, 0.036, inner);
  else if (fti == 1) { float P = 0.46; float fw = fwidth(vD.x) / P; sl = 0.09 * cos(6.2832 * vD.x / P) * (1.0 - smoothstep(0.2, 0.5, fw)); }
  vec2 dn = vec2(0.0);
  if (fti <= 3) dn = (texture2D(tDetN, vD.xy / vec2(2.7, 2.1) + gs * 3.0).xy * 2.0 - 1.0) * (0.45 + vI.w * 0.7);
  if (fti == 3) dn += (texture2D(tDoorN, clamp(vA, 0.0, 1.0)).xy * 2.0 - 1.0) * 1.1;
  normal = normalize(normal - Tv * sl + Tv * dn.x + Bv * dn.y);
  diffuseColor.rgb *= 1.0 - inner * 0.06;
}
`;

function makeMaterial(dmg) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.12 });
  if (dmg) m.defines = { CTR_DMG: 1 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tAtlas = { value: M.atlas }; sh.uniforms.tDoor = { value: M.door }; sh.uniforms.tGrime = { value: M.grime };
    sh.uniforms.tDetN = { value: M.detN }; sh.uniforms.tDoorN = { value: M.doorN };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_PRE)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_MAIN);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_PRE)
      .replace('#include <map_fragment>', FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = cMetal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NRM);
  };
  m.customProgramCacheKey = () => 'bayhem-container-' + (dmg ? 1 : 0);
  return m;
}

export function initContainerMaterials(renderer) {
  if (M) return M;
  const t0 = performance.now();
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;
  const nc = noiseCanvas(31, 256, 6, 4, 1.8);
  // main atlas
  const ac = makeCanvas(AW, AW), actx = ac.getContext('2d');
  LIVERIES.forEach((liv, i) => {
    const rng = makeRng(1000 + i * 77);
    paintSide(actx, S40[0], i * RH, S40[1], CONTAINER.L40, liv, rng, nc, false);
    paintSide(actx, S20[0], i * RH, S20[1], CONTAINER.L20, liv, rng, nc, true);
    paintSwatch(actx, i * RH, liv, nc);
  });
  // door atlas
  const dc = makeCanvas(2048, 1024), dctx = dc.getContext('2d');
  LIVERIES.forEach((liv, i) => paintDoor(dctx, (i % 4) * 512, Math.floor(i / 4) * 512, liv, makeRng(500 + i * 31), nc));
  const dh = doorLayoutHeight();
  const atlas = canvasTex(ac, { repeat: false, aniso }); atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;
  const door = canvasTex(dc, { repeat: false, aniso }); door.wrapS = door.wrapT = THREE.ClampToEdgeWrapping;
  const grime = canvasTex(grimeTexture(), { srgb: false, aniso });
  const detN = canvasTex(detailNormal(), { srgb: false, aniso });
  const doorN = canvasTex(hToN(dh.h, dh.S, dh.S, 3.0), { srgb: false, aniso, repeat: false });
  M = { atlas, door, grime, detN, doorN, canvases: { ac, dc } };
  M.field = makeMaterial(false);
  M.hero = makeMaterial(true);
  M.cardboard = cardboardMaterial();
  M.buildMs = Math.round(performance.now() - t0);
  M.texBytes = Math.round((AW * AW + 2048 * 1024 + 3 * 512 * 512) * 4 * 4 / 3);
  return M;
}

function cardboardMaterial() {
  const c = makeCanvas(128, 128), x = c.getContext('2d'), rng = makeRng(55);
  x.fillStyle = '#8c6a43'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${rng() < 0.5 ? '60,40,20' : '170,140,100'},0.08)`; x.fillRect(rng() * 128, rng() * 128, 2 + rng() * 10, 1); }
  x.fillStyle = '#b39a74'; x.fillRect(54, 0, 20, 128);
  x.fillStyle = 'rgba(30,25,20,0.8)'; x.font = '700 13px Oswald, sans-serif'; x.fillText('THIS SIDE UP', 6, 112); x.fillText('↑↑', 100, 20);
  return new THREE.MeshStandardMaterial({ map: canvasTex(c, { aniso: 4 }), roughness: 0.92, metalness: 0 });
}

// --------------------------------------------------------------- geometry builder
function GB() { return { p: [], n: [], a: [], d: [], t: [], dm: [], w: [], i: [] }; }
const v3 = (x, y, z) => [x, y, z];
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// detail coords (wu, wv) in metres for a point on a face with normal n
function wuv(p, n, L) {
  if (Math.abs(n[1]) > 0.5) return [p[0] + L / 2, p[2] + W / 2];
  if (Math.abs(n[2]) > 0.5) return [n[2] > 0 ? p[0] + L / 2 : L / 2 - p[0], p[1]];
  return [n[0] > 0 ? W / 2 - p[2] : p[2] + W / 2, p[1]];
}
// face: o = bottom-left corner seen from outside, U = right, V = up
function face(g, o, U, V, ft, L, { nu = 1, nv = 1, side = null, dm = null, wgt = 1, cargo = false } = {}) {
  const n = norm(cross(U, V)), t = norm(U), base = g.p.length / 3;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const su = i / nu, sv = j / nv;
    const p = [o[0] + U[0] * su + V[0] * sv, o[1] + U[1] * su + V[1] * sv, o[2] + U[2] * su + V[2] * sv];
    const [wu, wv] = wuv(p, n, L);
    let a;
    if (cargo) a = [su, sv];
    else if (ft === 0) a = [(side[0] + Math.min(1, Math.max(0, wu / L)) * side[1]) / AW, p[1] / H];
    else if (ft === 3) a = [wu / W, p[1] / H];
    else if (Math.abs(n[1]) > 0.5) a = [SWU, n[1] > 0 ? 0.97 : 0.03];
    else a = [SWU, p[1] / H];
    g.p.push(...p); g.n.push(...n); g.t.push(...t); g.a.push(...a); g.d.push(wu, wv, ft);
    const d = dm ? dm(p) : [0, 0]; g.dm.push(d[0], d[1]); g.w.push(wgt);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
    g.i.push(a, b, c, a, c, d);
  }
}
// axis-aligned box faces subset: keys '+x','-x','+y','-y','+z','-z'
function boxF(g, mn, mx, faces, ft, L, opt = {}) {
  const dx = mx[0] - mn[0], dy = mx[1] - mn[1], dz = mx[2] - mn[2];
  const sub = opt.sub || [1, 1, 1]; // subdivisions along x, y, z
  for (const f of faces) {
    const o = { ...opt };
    switch (f) {
      case '+x': face(g, v3(mx[0], mn[1], mx[2]), v3(0, 0, -dz), v3(0, dy, 0), ft, L, { ...o, nu: sub[2], nv: sub[1] }); break;
      case '-x': face(g, v3(mn[0], mn[1], mn[2]), v3(0, 0, dz), v3(0, dy, 0), ft, L, { ...o, nu: sub[2], nv: sub[1] }); break;
      case '+z': face(g, v3(mn[0], mn[1], mx[2]), v3(dx, 0, 0), v3(0, dy, 0), ft, L, { ...o, nu: sub[0], nv: sub[1] }); break;
      case '-z': face(g, v3(mx[0], mn[1], mn[2]), v3(-dx, 0, 0), v3(0, dy, 0), ft, L, { ...o, nu: sub[0], nv: sub[1] }); break;
      case '+y': face(g, v3(mn[0], mx[1], mx[2]), v3(dx, 0, 0), v3(0, 0, -dz), ft, L, { ...o, nu: sub[0], nv: sub[2] }); break;
      case '-y': face(g, v3(mn[0], mn[1], mn[2]), v3(dx, 0, 0), v3(0, 0, dz), ft, L, { ...o, nu: sub[0], nv: sub[2] }); break;
    }
  }
}
function toGeometry(g, dmg = false) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
  geo.setAttribute('aA', new THREE.Float32BufferAttribute(g.a, 2));
  geo.setAttribute('aD', new THREE.Float32BufferAttribute(g.d, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(g.t, 3));
  if (dmg) geo.setAttribute('aDmg', new THREE.Float32BufferAttribute(g.dm, 2));
  geo.setIndex(g.i);
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  return geo;
}

// frame (posts, rails) shared by field + hero. hero: subdivided, open door end.
function buildFrame(g, L, hero) {
  const hx = L / 2, hz = W / 2;
  const nL = hero ? Math.max(4, Math.ceil(L / 0.3)) : 1, nH = hero ? 8 : 1;
  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx > 0 ? hx - C : -hx, z0 = sz > 0 ? hz - C : -hz;
    boxF(g, [x0, 0, z0], [x0 + C, H, z0 + C], ['+x', '-x', '+z', '-z', '+y'], 4, L, { sub: [1, nH, 1] });
  }
  // side rails
  for (const sz of [-1, 1]) {
    const zo = sz * hz;
    const zb = sz > 0 ? [hz - 0.045, hz - 0.002] : [-hz + 0.002, -hz + 0.045];
    boxF(g, [-hx + C, 0, zb[0]], [hx - C, SILL, zb[1]], [sz > 0 ? '+z' : '-z', '+y'], 4, L, { sub: [nL, 1, 1] });
    const zt = sz > 0 ? [hz - 0.1, hz - 0.002] : [-hz + 0.002, -hz + 0.1];
    boxF(g, [-hx + C, H - 0.1, zt[0]], [hx - C, H - 0.004, zt[1]], [sz > 0 ? '+z' : '-z', '-y', '+y', sz > 0 ? '-z' : '+z'], 4, L, { sub: [nL, 1, 1] });
    void zo;
  }
  // blind end rails (-x)
  boxF(g, [-hx + 0.002, 0, -hz + C], [-hx + 0.05, SILL, hz - C], ['-x', '+y'], 4, L, { sub: [1, 1, hero ? 6 : 1] });
  boxF(g, [-hx + 0.002, H - HEAD, -hz + C], [-hx + 0.11, H - 0.004, hz - C], ['-x', '-y', '+y', '+x'], 4, L, { sub: [1, 1, hero ? 6 : 1] });
  // door end sill + header (+x)
  boxF(g, [hx - 0.12, 0, -hz + C], [hx - 0.002, SILL, hz - C], ['+x', '+y'], 4, L, { sub: [1, 1, hero ? 6 : 1] });
  boxF(g, [hx - HEAD, H - HEAD, -hz + C], [hx - 0.002, H - 0.004, hz - C], ['+x', '-y', '+y', '-x'], 4, L, { sub: [1, 1, hero ? 6 : 1] });
}
function buildPanels(g, L, side, hero, dmFn) {
  const hx = L / 2, hz = W / 2;
  const nL = hero ? Math.max(4, Math.ceil(L / 0.3)) : 1, nH = hero ? 8 : 1, nW = hero ? 8 : 1;
  const zs = hz - SIDE_IN, y0 = SILL, y1 = H - 0.1;
  face(g, v3(-hx + C, y0, zs), v3(L - 2 * C, 0, 0), v3(0, y1 - y0, 0), 0, L, { nu: nL, nv: nH, side });
  face(g, v3(hx - C, y0, -zs), v3(-(L - 2 * C), 0, 0), v3(0, y1 - y0, 0), 0, L, { nu: nL, nv: nH, side });
  // roof
  face(g, v3(-hx + 0.1, H - 0.025, hz - 0.1), v3(L - 0.2, 0, 0), v3(0, 0, -(W - 0.2)), 1, L, { nu: nL, nv: nW });
  // blind end
  face(g, v3(-hx + SIDE_IN, SILL, -hz + C), v3(0, 0, W - 2 * C), v3(0, H - HEAD - SILL, 0), 2, L, { nu: nW, nv: nH });
  // underside
  face(g, v3(-hx, 0.001, -hz), v3(L, 0, 0), v3(0, 0, W), 5, L, { nu: hero ? 12 : 1, nv: 1 });
  void dmFn;
}
function addBars(g, L, x0, zFilter = () => true) {
  for (const u of BARS_U) {
    const z = W / 2 - u;
    if (!zFilter(z)) continue;
    boxF(g, [x0, SILL + 0.01, z - 0.017], [x0 + 0.042, H - HEAD - 0.01, z + 0.017], ['+x', '+z', '-z'], 4, L);
  }
}

function fieldGeometry(L) {
  const g = GB();
  const side = L > 10 ? S40 : S20;
  buildPanels(g, L, side, false);
  buildFrame(g, L, false);
  // door face + bars
  face(g, v3(L / 2 - DOOR_IN, SILL, W / 2 - C), v3(0, 0, -(W - 2 * C)), v3(0, H - HEAD - SILL, 0), 3, L);
  addBars(g, L, L / 2 - DOOR_IN);
  return toGeometry(g);
}

// --------------------------------------------------------------- field
function hash01(n) {
  n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967296;
}

export function buildContainerField(list, opts = {}) {
  initContainerMaterials(opts.renderer || null);
  const root = new THREE.Group(); root.name = 'containers';
  const geos = { 40: M.geo40 || (M.geo40 = fieldGeometry(CONTAINER.L40)), 20: M.geo20 || (M.geo20 = fieldGeometry(CONTAINER.L20)) };
  const bySize = { 40: [], 20: [] };
  list.forEach((c, i) => bySize[c.len === 20 ? 20 : 40].push(i));
  const slot = new Array(list.length), meshes = {};
  const colliders = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  for (const size of [40, 20]) {
    const idxs = bySize[size];
    if (!idxs.length) continue;
    const mesh = new THREE.InstancedMesh(geos[size], M.field, idxs.length);
    const inst = new Float32Array(idxs.length * 4);
    idxs.forEach((li, k) => {
      const c = list[li];
      const s = (c.seed ?? li * 7919 + 13) >>> 0;
      const r1 = hash01(s * 3 + 1), r2 = hash01(s * 5 + 2), r3 = hash01(s * 7 + 3), r4 = hash01(s * 11 + 4);
      const flip = r1 < 0.5 ? Math.PI : 0;
      q.setFromAxisAngle(up, (c.rot ? Math.PI / 2 : 0) + flip + (r4 - 0.5) * 0.012);
      pos.set(c.x, (c.tier || 0) * H, c.z);
      m4.compose(pos, q, one);
      mesh.setMatrixAt(k, m4);
      const liv = ((c.livery ?? 0) % LIVERIES.length + LIVERIES.length) % LIVERIES.length;
      inst[k * 4] = liv;
      inst[k * 4 + 1] = 0.86 + r2 * 0.2;
      inst[k * 4 + 2] = r3;
      inst[k * 4 + 3] = Math.pow(hash01(s * 13 + 5), 1.4);
      slot[li] = { mesh, k };
      const L = size === 40 ? CONTAINER.L40 : CONTAINER.L20;
      const hx = c.rot ? W / 2 : L / 2, hz = c.rot ? L / 2 : W / 2;
      colliders.push({ min: [c.x - hx, pos.y, c.z - hz], max: [c.x + hx, pos.y + H, c.z + hz] });
    });
    mesh.geometry = geos[size];
    // per-instance attribute must live on a geometry per mesh: clone shallowly
    const geo = geos[size].clone();
    geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
    mesh.geometry = geo;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = `containers${size}`;
    meshes[size] = mesh;
    root.add(mesh);
  }
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const tri40 = geos[40].index.count / 3, tri20 = geos[20].index.count / 3;
  return {
    root, colliders: opts.colliders ? colliders : [], count: list.length,
    info: { instances40: bySize[40].length, instances20: bySize[20].length, trisPerBox40: tri40, trisPerBox20: tri20, drawCalls: Object.keys(meshes).length, texMB: +(M.texBytes / 1048576).toFixed(1), texBuildMs: M.buildMs, aabbs: colliders },
    remove(i) {
      const s = slot[i]; if (!s) return;
      s.mesh.setMatrixAt(s.k, zero); s.mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// --------------------------------------------------------------- hero container
export class HeroContainer {
  constructor({ len = 40, livery = 0, seed = 1 } = {}) {
    initContainerMaterials(null);
    this.L = len === 20 ? CONTAINER.L20 : CONTAINER.L40;
    this.livery = livery % LIVERIES.length;
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed * 9973 + 17);
    const L = this.L, hx = L / 2, hz = W / 2;
    const inst = [this.livery, 0.92 + hash01(this.seed) * 0.12, hash01(this.seed * 3 + 1), 0.25 + 0.6 * hash01(this.seed * 7 + 2)];
    this.root = new THREE.Group(); this.root.name = 'heroContainer';

    // ---- shell (outer + frame + interior + cargo)
    const g = GB();
    const side = len === 20 ? S20 : S40;
    buildPanels(g, L, side, true);
    buildFrame(g, L, true);
    const ao = (p) => [0.55 + 0.4 * Math.min(1, (hx - p[0]) / Math.min(L, 4)), 0];
    const nI = Math.max(3, Math.ceil(L / 0.5));
    const zi = hz - 0.075, yc = H - 0.06;
    face(g, v3(hx - C, SILL, zi), v3(-(L - C - 0.08), 0, 0), v3(0, yc - SILL, 0), 6, L, { nu: nI, nv: 5, dm: ao }); // inner +z wall (faces -z)
    face(g, v3(-hx + 0.08, SILL, -zi), v3(L - C - 0.08, 0, 0), v3(0, yc - SILL, 0), 6, L, { nu: nI, nv: 5, dm: ao });
    face(g, v3(-hx + 0.08, yc, -zi), v3(L - C - 0.08, 0, 0), v3(0, 0, 2 * zi), 6, L, { nu: nI, nv: 4, dm: ao }); // ceiling
    face(g, v3(-hx + 0.08, SILL, zi), v3(L - 0.12 - 0.08, 0, 0), v3(0, 0, -2 * zi), 7, L, { nu: nI, nv: 4, dm: ao }); // floor
    face(g, v3(-hx + 0.08, SILL, zi), v3(0, 0, -2 * zi), v3(0, yc - SILL, 0), 6, L, { nu: 4, nv: 5, dm: ao }); // back wall
    // cargo: cardboard stacks toward the back + a loose pile mid
    const cr = makeRng(this.seed * 31 + 5);
    let x = -hx + 0.12;
    while (x < hx - (len === 20 ? 2.4 : 4.0)) {
      const bd = 0.5 + cr() * 0.3;
      for (let z = -zi + 0.04; z < zi - 0.45;) {
        const bw = 0.45 + cr() * 0.35;
        const nStack = 2 + Math.floor(cr() * 3);
        let y = SILL;
        for (let s = 0; s < nStack && y < yc - 0.6; s++) {
          const bh = 0.4 + cr() * 0.25, jx = (cr() - 0.5) * 0.06, jz = (cr() - 0.5) * 0.06;
          boxF(g, [x + jx, y, z + jz], [x + jx + bd, y + bh, z + jz + Math.min(bw, zi - z - 0.02)], ['+x', '+y', '-z', '+z'], 8, L, { cargo: true, wgt: 0, dm: ao });
          y += bh;
        }
        z += bw + 0.02;
      }
      x += bd + 0.03;
    }
    this.shellGeo = toGeometry(g, true);
    this.base = Float32Array.from(this.shellGeo.attributes.position.array);
    this.wgt = Float32Array.from(g.w);
    this.off = new Float32Array(this.base.length);
    this.dmg = this.shellGeo.attributes.aDmg;
    this.dmg0 = Float32Array.from(this.dmg.array);
    const nv = this.base.length / 3;
    this.shellGeo.setAttribute('aInst', new THREE.Float32BufferAttribute(new Float32Array(nv * 4).map((_, i) => inst[i % 4]), 4));
    this.shell = new THREE.Mesh(this.shellGeo, M.hero);
    this.shell.castShadow = this.shell.receiveShadow = true;
    this.root.add(this.shell);

    // ---- door leaves (pivot at hinge)
    this.doors = [];
    for (const sz of [1, -1]) {
      const dg = GB();
      const zH = sz * (hz - C), zS = sz * 0.006, xf = hx - DOOR_IN, xb = xf - 0.05;
      const zmin = Math.min(zH, zS), zmax = Math.max(zH, zS);
      boxF(dg, [xb, SILL + 0.004, zmin], [xf, H - HEAD - 0.004, zmax], ['+x'], 3, L, { sub: [1, 8, 4] });
      boxF(dg, [xb, SILL + 0.004, zmin], [xf, H - HEAD - 0.004, zmax], ['-x'], 6, L, { sub: [1, 4, 2], dm: () => [0.35, 0] });
      boxF(dg, [xb, SILL + 0.004, zmin], [xf, H - HEAD - 0.004, zmax], ['+z', '-z', '+y', '-y'], 4, L);
      addBars(dg, L, xf, (z) => z * sz > 0);
      const pivot = new THREE.Vector3(hx - 0.04, 0, sz * (hz - 0.02));
      const dgeo = toGeometry(dg, true);
      dgeo.translate(-pivot.x, 0, -pivot.z);
      const n = dgeo.attributes.position.count;
      dgeo.setAttribute('aInst', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => inst[i % 4]), 4));
      const mesh = new THREE.Mesh(dgeo, M.hero);
      mesh.position.copy(pivot); mesh.castShadow = mesh.receiveShadow = true;
      this.root.add(mesh);
      // left (+z hinge) opens with negative angle, right with positive
      this.doors.push({ mesh, sign: sz > 0 ? -1 : 1, ang: 0, vel: 0, attached: true });
    }
    this._crush = 0; this._crushVec = null;
    this.burstDone = false;
    this.info = { tris: this.shellGeo.index.count / 3, doorTris: this.doors[0].mesh.geometry.index.count / 3, drawCalls: 3 };
  }

  _apply() {
    const pos = this.shellGeo.attributes.position, a = pos.array, cv = this._crushVec, k = this._crush;
    for (let i = 0; i < a.length; i++) a[i] = this.base[i] + this.off[i] + (cv ? cv[i] * k : 0);
    pos.needsUpdate = true;
    this.shellGeo.computeVertexNormals();
    this.shellGeo.computeBoundingSphere();
    this.dmg.needsUpdate = true;
  }

  dent(pointWorld, dirWorld, radius = 0.6, depth = 0.15) {
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const p = pointWorld.clone().applyMatrix4(inv);
    const d = dirWorld.clone().transformDirection(inv).normalize();
    const a = this.shellGeo.attributes.position.array, dm = this.dmg.array, r2 = radius * radius;
    for (let i = 0, v = 0; i < a.length; i += 3, v++) {
      const dx = a[i] - p.x, dy = a[i + 1] - p.y, dz = a[i + 2] - p.z, dd = dx * dx + dy * dy + dz * dz;
      if (dd >= r2) continue;
      const t = 1 - dd / r2, w = t * t * this.wgt[v];
      // ground-locked bottom: the floor of the box doesn't push into the ground
      const yLock = Math.min(1, this.base[i + 1] / 0.3);
      this.off[i] += d.x * depth * w; this.off[i + 1] += d.y * depth * w * yLock; this.off[i + 2] += d.z * depth * w;
      dm[v * 2] = Math.min(0.6, dm[v * 2] + 0.22 * w);
      dm[v * 2 + 1] = Math.min(0.9, dm[v * 2 + 1] + Math.max(0, w - 0.35) * 1.2 * (0.6 + 0.4 * this.rng()));
    }
    this._apply();
  }

  crush(amount = 1) {
    const L = this.L, hx = L / 2;
    if (!this._crushVec) {
      const b = this.base, cv = new Float32Array(b.length), rr = makeRng(this.seed * 13 + 3);
      const ph = rr() * 6.28;
      for (let i = 0, v = 0; i < b.length; i += 3, v++) {
        const x = b[i], y = b[i + 1], z = b[i + 2], w = this.wgt[v];
        const sx = Math.sin(Math.PI * Math.min(1, Math.max(0, (x + hx) / L)));
        const yn = Math.min(1, Math.max(0, y / H));
        const zn = z / (W / 2);
        const e = THREE.MathUtils.smoothstep(x, -hx + 2.0, -hx); // buckled end
        let dy = -0.75 * Math.pow(sx, 1.3) * (1 - 0.45 * zn * zn) * Math.pow(yn, 1.5);
        let dz = Math.sign(z) * 0.24 * sx * Math.sin(Math.PI * yn) * Math.min(1, Math.abs(zn) * 1.2);
        let dx = 0.5 * e * yn;
        dy += -0.5 * e * yn + 0.09 * e * Math.sin(y * 7 + ph) * Math.sin(Math.PI * yn);
        dz += 0.12 * e * Math.sin(y * 9 + x * 3 + ph) * Math.sign(z || 1) * Math.sin(Math.PI * yn);
        const ww = w > 0 ? 1 : 0.6; // cargo gets squashed less
        cv[i] = dx * ww; cv[i + 1] = dy * ww; cv[i + 2] = dz * ww;
      }
      this._crushVec = cv;
    }
    const prev = this._crush;
    this._crush = Math.max(this._crush, Math.min(1.2, amount));
    // scuff paint in the crumple zones
    const dm = this.dmg.array, cv = this._crushVec;
    for (let v = 0; v < dm.length / 2; v++) {
      const m = Math.hypot(cv[v * 3], cv[v * 3 + 1], cv[v * 3 + 2]) * (this._crush - prev);
      if (m <= 0) continue;
      dm[v * 2] = Math.min(0.55, dm[v * 2] + m * 0.35);
      dm[v * 2 + 1] = Math.min(0.85, dm[v * 2 + 1] + Math.max(0, m - 0.25) * 1.4 * this.rng());
    }
    this._apply();
  }

  burst(dirWorld = new THREE.Vector3(0, 0, -1)) {
    const out = { pieces: [], spill: [] };
    if (this.burstDone) return out;
    this.burstDone = true;
    const r = this.rng, L = this.L, hx = L / 2;
    this.root.updateMatrixWorld(true);
    const top = (() => { let o = this.root; while (o.parent) o = o.parent; return o; })();
    const toW = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(this.root.matrixWorld);
    const outward = new THREE.Vector3(1, 0, 0).transformDirection(this.root.matrixWorld);
    // internal blast: sides / roof bulge out near the door end, scorch the opening
    for (const sz of [1, -1]) this.dent(toW(hx - 1.2 - r() * 1.2, 1.3, sz * W / 2), new THREE.Vector3(0, 0, sz).transformDirection(this.root.matrixWorld), 1.4, 0.16);
    this.dent(toW(hx - 1.5, H, 0), new THREE.Vector3(0, 1, 0).transformDirection(this.root.matrixWorld), 1.5, 0.14);
    const dm = this.dmg.array, b = this.base;
    for (let v = 0; v < dm.length / 2; v++) {
      const x = b[v * 3];
      const s = THREE.MathUtils.smoothstep(x, hx - 1.6, hx);
      dm[v * 2] = Math.min(0.92, dm[v * 2] + s * 0.45);
    }
    this.dmg.needsUpdate = true;
    // doors fly open; maybe one tears off
    const tear = r() < 0.65 ? (r() < 0.5 ? 0 : 1) : -1;
    this.doors.forEach((d, k) => {
      d.vel = d.sign * (11 + r() * 7);
      if (k === tear) {
        d.attached = false;
        d.mesh.rotation.y = d.sign * 0.5; d.mesh.updateMatrixWorld(true);
        top.attach(d.mesh);
        const vel = outward.clone().multiplyScalar(8 + r() * 5).addScaledVector(dirWorld, 2).add(new THREE.Vector3(0, 3.5 + r() * 3, 0));
        out.pieces.push({ obj: d.mesh, vel, angVel: new THREE.Vector3((r() - 0.5) * 8, (r() - 0.5) * 10, (r() - 0.5) * 8) });
      }
    });
    // spill cardboard boxes out of the doors
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s = 0.35 + r() * 0.3;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(s * (1 + r() * 0.4), s, s * (0.8 + r() * 0.4)), M.cardboard);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.copy(toW(hx - 0.4 - r() * 1.2, SILL + s / 2 + r() * 1.2, (r() - 0.5) * 1.6));
      mesh.rotation.set(r() * 3, r() * 3, r() * 3);
      top.attach(mesh);
      const vel = outward.clone().multiplyScalar(4 + r() * 6).add(new THREE.Vector3((r() - 0.5) * 3, 2 + r() * 4, (r() - 0.5) * 3)).addScaledVector(dirWorld, 1.5);
      out.spill.push({ obj: mesh, vel });
    }
    return out;
  }

  update(dt) {
    const lim = 3 * Math.PI / 2 - 0.06;
    for (const d of this.doors) {
      if (!d.attached || (d.vel === 0 && d.ang === 0)) continue;
      d.vel *= Math.exp(-1.6 * dt);
      d.ang += d.vel * dt;
      const a = d.ang * d.sign; // positive = opening
      if (a > lim) { d.ang = d.sign * lim; d.vel = -d.vel * 0.3; }
      if (a < 0) { d.ang = 0; d.vel = -d.vel * 0.3; }
      if (Math.abs(d.vel) < 0.02) d.vel = 0;
      d.mesh.rotation.y = d.ang;
    }
  }
}

// --------------------------------------------------------------- demo
export async function _demo(ctx = {}) {
  try { await Promise.all([document.fonts.load('400 64px Anton'), document.fonts.load('700 64px Oswald'), document.fonts.load('500 64px Oswald')]); } catch (e) { /* fallback fonts */ }
  initContainerMaterials(ctx.renderer);
  const rng = makeRng(2024);
  const list = [];
  const rowX = [-3.42, -5.92, -8.42, -15.4, -17.9, 3.42, 5.92, 8.42, 15.4, 17.9];
  const slotsZ = [5.9, -6.6, -19.1, -31.6];
  let seed = 1;
  for (const x of rowX) {
    const outer = Math.abs(x) > 12;
    for (const z of slotsZ) {
      const tiers = 1 + Math.floor(rng() * (outer ? 4 : 3.4));
      for (let t = 0; t < tiers; t++) {
        if (rng() < 0.22 && t === 0) {
          for (const dz of [-3.08, 3.08]) list.push({ x, z: z + dz, tier: 0, rot: 1, len: 20, livery: Math.floor(rng() * 8), seed: seed++ });
        } else list.push({ x, z, tier: t, rot: 1, len: 40, livery: Math.floor(rng() * 8), seed: seed++ });
      }
    }
  }
  // a cross row at the far end (long axis along x)
  for (let k = 0; k < 4; k++) for (let t = 0; t < 1 + (k % 3); t++) list.push({ x: -19 + k * 12.5, z: -42, tier: t, rot: 0, len: 40, livery: Math.floor(rng() * 8), seed: seed++ });
  const field = buildContainerField(list, { renderer: ctx.renderer });
  const root = new THREE.Group();
  root.add(field.root);

  // heroes
  const burst = new HeroContainer({ len: 20, livery: 0, seed: 3 });
  burst.root.position.set(-4.4, 0, 13.6); burst.root.rotation.y = -Math.PI / 2 + 0.25;
  const dented = new HeroContainer({ len: 20, livery: 3, seed: 8 });
  dented.root.position.set(4.6, 0, 13.0); dented.root.rotation.y = -Math.PI / 2 - 0.2;
  const crushed = new HeroContainer({ len: 40, livery: 1, seed: 5 });
  crushed.root.position.set(0.6, 0, -50); crushed.root.rotation.y = 0.12;
  root.add(burst.root, dented.root, crushed.root);
  if (ctx.scene) ctx.scene.add(root);
  root.updateMatrixWorld(true);
  // dents on the aisle-facing side of the dented box (its local -z side faces -x world-ish)
  const dz = new THREE.Vector3();
  for (const [lx, ly, r, dep] of [[0.8, 1.2, 0.7, 0.22], [-1.6, 0.6, 0.5, 0.15], [-0.3, 2.1, 0.9, 0.12], [2.0, 1.6, 0.35, 0.1]]) {
    const p = new THREE.Vector3(lx, ly, -W / 2).applyMatrix4(dented.root.matrixWorld);
    dz.set(0, 0, 1).transformDirection(dented.root.matrixWorld);
    dented.dent(p, dz, r, dep);
  }
  crushed.crush(1.0);
  const res = burst.burst(new THREE.Vector3(0, 0, -1));
  const parent = ctx.scene || root;
  for (const s of [...res.spill, ...res.pieces]) {
    parent.attach(s.obj);
    // fake "landed" pose for screenshots
    const tLand = 0.45;
    s.obj.position.addScaledVector(s.vel, tLand); s.obj.position.y = s.obj === res.pieces[0]?.obj ? 0.05 : 0.25;
    if (s.obj === res.pieces[0]?.obj) s.obj.rotation.set(-Math.PI / 2, 0, 0.6);
  }
  for (let i = 0; i < 90; i++) burst.update(1 / 30);
  const tris = field.info.trisPerBox40 * field.info.instances40 + field.info.trisPerBox20 * field.info.instances20;
  return {
    root,
    update(dt) { burst.update(dt); dented.update(dt); crushed.update(dt); },
    info: { field: { ...field.info, aabbs: undefined }, fieldTris: tris, hero: burst.info, count: list.length },
  };
}

// dev: show the texture atlases flat (viewer: fn=_atlas&cx=0&cy=0&cz=0&px=0&py=0&pz=2.2&ground=0)
export async function _atlas(which = 'side', ctx = {}) {
  if (typeof which === 'object') { ctx = which; which = 'side'; }
  try { await Promise.all([document.fonts.load('400 64px Anton'), document.fonts.load('700 64px Oswald'), document.fonts.load('500 64px Oswald')]); } catch (e) { /* */ }
  initContainerMaterials(ctx.renderer);
  const t = which === 'door' ? M.door : M.atlas;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(which === 'door' ? 3.2 : 2.4, which === 'door' ? 1.6 : 2.4), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, fog: false }));
  return { root: m };
}
