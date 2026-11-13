import * as THREE from 'three';
import { makeCanvas } from '../../textures.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  LIGHTS OUT — the sign atlas: shop lightboxes and blade signs in simplified Chinese (system CJK
//  fonts), the landmark plaques, highway gantry boards, lantern faces. All names are fictional /
//  generic (no real brands). One 2048² canvas, shelf-packed; SIGN[name] = uv rect [u0, v0, u1, v1].
//  The print is the albedo; the lit part (light text or light box) glows through emMap.
// =====================================================================================
export const CN = '"Noto Sans CJK SC","Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
export const CNS = '"Noto Serif CJK SC","Noto Serif SC","Songti SC",serif';
const LAT = '"Oswald","Arial Narrow","DejaVu Sans Condensed",sans-serif';

const SPECS = [];
const H = (name, w, h, o) => SPECS.push({ name, w, h, ...o });
// horizontal shop fascias (lightboxes): [text, sub, bg, fg]
const SHOPS = [
  ['老灶火锅', 'HOTPOT', '#b3140f', '#ffe9a8'], ['龙雾小面', 'NOODLES', '#f2d04a', '#7a0d0a'], ['串串香', 'SKEWERS', '#c41a12', '#ffffff'],
  ['烧烤', 'BBQ', '#1c1c1c', '#ff5a2a'], ['大药房', 'PHARMACY', '#1b8a3c', '#ffffff'], ['江景宾馆', 'HOTEL', '#16357a', '#ffe7a0'],
  ['便利超市', 'MART', '#e9e3d4', '#c4161c'], ['网吧', 'NET CAFE', '#14214f', '#4ee0ff'], ['茶馆', 'TEA HOUSE', '#3d2012', '#f3c46a'],
  ['美发', 'SALON', '#efe9f2', '#9c1e6e'], ['五金店', 'HARDWARE', '#ffd21c', '#141414'], ['麻辣烫', 'MALATANG', '#d9261c', '#fff2c4'],
  ['手机维修', 'PHONE REPAIR', '#0f5fb8', '#ffffff'], ['包子铺', 'BUNS', '#f6efe0', '#b02218'], ['酸辣粉', 'NOODLES', '#ff7a14', '#2a0e05'],
  ['火锅底料', 'SPICES', '#8c0f0c', '#ffd56a'], ['钟表眼镜', 'WATCHES', '#20202a', '#e6e6e6'], ['电器', 'APPLIANCES', '#2d6fc4', '#fff'],
];
SHOPS.forEach(([t, s, bg, fg], i) => H('shop' + i, 512, 128, { kind: 'fascia', t, s, bg, fg }));
// vertical blade signs
const BLADES = [['火锅', '#c11810', '#fff1b0'], ['旅馆', '#173a86', '#ffffff'], ['小面', '#f0c93a', '#7a0d0a'], ['足浴', '#7b1fa2', '#ffe0ff'], ['棋牌', '#14532d', '#fff'], ['酒', '#2a1608', '#ffb347'], ['烤鱼', '#d22b1e', '#fff'], ['中医', '#ffffff', '#a31515'], ['KTV', '#0d0d26', '#ff3fb4']];
BLADES.forEach(([t, bg, fg], i) => H('blade' + i, 112, 448, { kind: 'blade', t, bg, fg }));
// landmark plaques / big signs
H('lantern', 1024, 192, { kind: 'plaque', t: '魁星广场', s: 'KUIXING PLAZA', bg: '#2b0d08', fg: '#ffcf6a' });
H('dept', 1024, 160, { kind: 'big', t: '龙雾百货', s: 'LONGWU DEPARTMENT STORE', bg: '#101010', fg: '#ff4136' });
H('jinlong', 512, 256, { kind: 'crown', t: '金龙', s: 'JINLONG', bg: '#000000', fg: '#ffd27a' });
H('qiansi', 768, 160, { kind: 'plaque', t: '千丝桥', s: 'QIANSI BRIDGE', bg: '#1b1b1b', fg: '#f0c060' });
H('steps', 512, 160, { kind: 'plaque', t: '滨江路', s: 'RIVERSIDE ROAD', bg: '#5c0f0a', fg: '#ffd88a' });
H('gate', 768, 192, { kind: 'plaque', t: '金龙大厦 · 观光梯', s: 'JINLONG TOWER  •  SKY LIFT', bg: '#8a120c', fg: '#ffe2a0' });
H('highway1', 768, 320, { kind: 'gantry', t: '南岸 ↓', s: 'NAN\'AN  •  JIANGBEI ↑', bg: '#0c5c35', fg: '#ffffff' });
H('highway2', 768, 320, { kind: 'gantry', t: '千丝桥 ←', s: 'QIANSI BR.  •  CBD →', bg: '#0c5c35', fg: '#ffffff' });
H('danger', 512, 256, { kind: 'warn', t: '高压危险', s: 'DANGER  HIGH VOLTAGE', bg: '#ffd21c', fg: '#111111' });
H('exit', 256, 128, { kind: 'exit', t: '安全出口', s: 'EXIT', bg: '#0f8a3a', fg: '#ffffff' });
H('mono', 512, 128, { kind: 'fascia', t: '轨道交通 2号线', s: 'LINE 2', bg: '#ffffff', fg: '#0f5fb8' });
H('skyst', 512, 128, { kind: 'fascia', t: '天街', s: 'SKY STREET', bg: '#101826', fg: '#ffd27a' });
H('lantern_face', 128, 128, { kind: 'lantern' });
H('paper', 128, 128, { kind: 'paper' });
H('poster0', 256, 360, { kind: 'poster', seed: 1 }); H('poster1', 256, 360, { kind: 'poster', seed: 2 }); H('poster2', 256, 360, { kind: 'poster', seed: 3 });
H('ad0', 512, 256, { kind: 'ad', t: '江城之夜', s: 'NIGHT RIVER CRUISE', bg: '#0a1838', fg: '#ffd27a', seed: 4 });
H('ad1', 512, 256, { kind: 'ad', t: '辣', s: 'SPICY KING', bg: '#9b0d0a', fg: '#fff2c0', seed: 5 });
H('ad2', 512, 256, { kind: 'ad', t: '云端', s: 'SKY RESIDENCES', bg: '#e8e2d6', fg: '#1b3d6e', seed: 6 });
H('police', 384, 96, { kind: 'fascia', t: '警务站', s: 'POLICE', bg: '#14388f', fg: '#ffffff' });
H('stripe', 128, 128, { kind: 'stripe' });
// rooftop names (every Chinese tower wears its name in lit characters on a frame on the roof)
const ROOFS = [['江景花园', '#ff2a14'], ['山城人家', '#ffc23a'], ['金色家园', '#ff2a14'], ['云端国际', '#ffd27a'], ['龙雾中心', '#ff3a20'], ['嘉华大厦', '#ffc23a'], ['滨江一号', '#ff2a14'], ['天和广场', '#ffd27a'], ['渝都酒店', '#ff2a14'], ['长江国际', '#ffc23a'], ['朝天门', '#ff3a20'], ['解放碑', '#ffd27a']];
ROOFS.forEach(([t, fg], i) => H('roof' + i, 640, 160, { kind: 'roofname', t, fg }));

export const SIGN = {};
export const SIGN_LIST = { roofs: ROOFS.map((_, i) => 'roof' + i), shops: SHOPS.map((_, i) => 'shop' + i), blades: BLADES.map((_, i) => 'blade' + i), posters: ['poster0', 'poster1', 'poster2'], ads: ['ad0', 'ad1', 'ad2'] };
let _tex = null;
export function signTexture() {
  if (_tex) return _tex;
  const W = 2048, HH = 4096, c = makeCanvas(W, HH), x = c.getContext('2d');
  x.fillStyle = '#222'; x.fillRect(0, 0, W, HH);
  // shelf packing
  let cx = 0, cy = 0, rowH = 0;
  const sorted = [...SPECS].sort((a, b) => b.h - a.h);
  for (const s of sorted) {
    if (cx + s.w > W) { cx = 0; cy += rowH + 4; rowH = 0; }
    s.x = cx; s.y = cy; cx += s.w + 4; rowH = Math.max(rowH, s.h);
    drawSign(x, s);
    SIGN[s.name] = [s.x / W, 1 - (s.y + s.h) / HH, (s.x + s.w) / W, 1 - s.y / HH];
    if (s.y + s.h > HH) console.warn('sign atlas overflow', s.name);
  }
  // weather every sign (reviews: "saturated primaries, spotless"): pull the colours 22 % toward grey and darken a soot band
  // round each panel's edge, heavier along the bottom where the rain runs off
  { const img = x.getImageData(0, 0, W, HH), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const L = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] += (L - d[i]) * 0.22; d[i + 1] += (L - d[i + 1]) * 0.22; d[i + 2] += (L - d[i + 2]) * 0.22; }
    for (const sp of SPECS) { if (sp.x === undefined) continue;
      for (let yy = 0; yy < sp.h; yy++) for (let xx = 0; xx < sp.w; xx++) {
        const ex = Math.min(xx, sp.w - 1 - xx) / sp.w, ey = yy / sp.h, eb = (sp.h - 1 - yy) / sp.h, e = Math.min(ex * 1.6, ey * 2, eb * 1.2);
        if (e > 0.07) continue; const k = 1 - (1 - e / 0.07) * (eb < ey ? 0.45 : 0.3), q = ((sp.y + yy) * W + sp.x + xx) * 4; d[q] *= k; d[q + 1] *= k; d[q + 2] *= k; } }
    x.putImageData(img, 0, 0); }
  _tex = new THREE.CanvasTexture(c);
  _tex.colorSpace = THREE.SRGBColorSpace; _tex.anisotropy = 8; _tex.needsUpdate = true;
  return _tex;
}

function fit(x, text, font, maxW, size) { let s = size; x.font = `900 ${s}px ${font}`; while (x.measureText(text).width > maxW && s > 8) { s -= 2; x.font = `900 ${s}px ${font}`; } return s; }
function drawSign(x, s) {
  const { w, h } = s; x.save(); x.translate(s.x, s.y); x.beginPath(); x.rect(0, 0, w, h); x.clip();   // nothing bleeds into the neighbours
  const r = makeRng((s.name.length * 977 + w + h) >>> 0);
  const grime = () => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,12,6,0.35)'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(30,20,10,${0.08 + r() * 0.12})`; x.fillRect(r() * w, r() * h * 0.4, 2 + r() * 6, h * (0.3 + r() * 0.7)); } };
  switch (s.kind) {
    case 'fascia': case 'big': {
      x.fillStyle = s.bg; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 4; x.strokeRect(6, 6, w - 12, h - 12);
      x.fillStyle = s.fg; x.textBaseline = 'middle'; x.textAlign = 'left';
      // Chinese first and big; the English is a small tag in the corner (a mainland shopfront, not a Chinatown one)
      const hs = fit(x, s.t, CN, w * 0.8, h * 0.78); x.font = `900 ${hs}px ${CN}`; x.fillText(s.t, w * 0.05, h * 0.52);
      x.font = `600 ${Math.round(h * 0.13)}px ${LAT}`; x.textAlign = 'right'; x.globalAlpha = 0.55; x.fillText(s.s, w * 0.96, h * 0.86); x.globalAlpha = 1;
      grime(); break;
    }
    case 'blade': {
      x.fillStyle = s.bg; x.fillRect(0, 0, w, h);
      x.strokeStyle = s.fg; x.globalAlpha = 0.5; x.lineWidth = 5; x.strokeRect(8, 8, w - 16, h - 16); x.globalAlpha = 1;
      x.fillStyle = s.fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      const ch = [...s.t], n = ch.length, cs = Math.min(w * 0.78, (h - 40) / n * 0.9);
      x.font = `900 ${cs}px ${CN}`; ch.forEach((c2, i) => x.fillText(c2, w / 2, 20 + (h - 40) * (i + 0.5) / n));
      grime(); break;
    }
    case 'plaque': {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, s.bg); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = s.fg; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20); x.lineWidth = 2; x.strokeRect(20, 20, w - 40, h - 40);
      x.fillStyle = s.fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      const hs = fit(x, s.t, CNS, w * 0.8, h * 0.56); x.font = `900 ${hs}px ${CNS}`; x.fillText(s.t, w / 2, h * 0.42);
      x.font = `600 ${Math.round(h * 0.16)}px ${LAT}`; x.fillText(s.s, w / 2, h * 0.8); break;
    }
    case 'crown': {
      x.fillStyle = s.bg; x.fillRect(0, 0, w, h); x.fillStyle = s.fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = s.fg; x.shadowBlur = 18;
      const hs = fit(x, s.t, CNS, w * 0.9, h * 0.62); x.font = `900 ${hs}px ${CNS}`; x.fillText(s.t, w / 2, h * 0.4);
      x.font = `700 ${Math.round(h * 0.17)}px ${LAT}`; x.fillText(s.s, w / 2, h * 0.84); x.shadowBlur = 0; break;
    }
    case 'gantry': {
      x.fillStyle = s.bg; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(14, 14, w - 28, h - 28);
      x.fillStyle = s.fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      const hs = fit(x, s.t, CN, w * 0.8, h * 0.4); x.font = `900 ${hs}px ${CN}`; x.fillText(s.t, w / 2, h * 0.38);
      x.font = `700 ${Math.round(h * 0.13)}px ${LAT}`; x.fillText(s.s, w / 2, h * 0.75); grime(); break;
    }
    case 'warn': {
      x.fillStyle = s.bg; x.fillRect(0, 0, w, h); x.fillStyle = s.fg;
      x.beginPath(); x.moveTo(h * 0.5, h * 0.12); x.lineTo(h * 0.88, h * 0.82); x.lineTo(h * 0.12, h * 0.82); x.closePath(); x.lineWidth = 12; x.strokeStyle = s.fg; x.stroke();
      x.font = `900 ${h * 0.4}px ${LAT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('⚡', h * 0.5, h * 0.58);
      x.textAlign = 'left'; const hs = fit(x, s.t, CN, w - h - 20, h * 0.34); x.font = `900 ${hs}px ${CN}`; x.fillText(s.t, h, h * 0.38);
      x.font = `700 ${Math.round(h * 0.14)}px ${LAT}`; x.fillText(s.s, h, h * 0.72); grime(); break;
    }
    case 'exit': {
      x.fillStyle = s.bg; x.fillRect(0, 0, w, h); x.fillStyle = s.fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = `900 ${h * 0.36}px ${CN}`; x.fillText(s.t, w * 0.55, h * 0.36); x.font = `700 ${h * 0.24}px ${LAT}`; x.fillText(s.s, w * 0.55, h * 0.74);
      x.fillRect(w * 0.06, h * 0.25, w * 0.1, h * 0.5); break;
    }
    case 'lantern': {
      // a red silk lantern's face: ribs, gold bands top and bottom, a fu character
      const g = x.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.6); g.addColorStop(0, '#ff6a30'); g.addColorStop(0.6, '#d8160c'); g.addColorStop(1, '#6a0603');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = 'rgba(80,0,0,0.5)'; x.lineWidth = 2; for (let i = 1; i < 8; i++) { x.beginPath(); x.moveTo(0, i * h / 8); x.lineTo(w, i * h / 8); x.stroke(); }
      x.fillStyle = '#e8b13a'; x.fillRect(0, 0, w, h * 0.09); x.fillRect(0, h * 0.91, w, h * 0.09);
      x.fillStyle = 'rgba(255,220,120,0.9)'; x.font = `900 ${h * 0.42}px ${CNS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('福', w / 2, h / 2); break;
    }
    case 'paper': {
      // a lattice window with lit paper behind it
      x.fillStyle = '#ffd9a0'; x.fillRect(0, 0, w, h);
      const g = x.createRadialGradient(w / 2, h * 0.55, 4, w / 2, h / 2, w * 0.75); g.addColorStop(0, 'rgba(255,240,200,0.6)'); g.addColorStop(1, 'rgba(160,80,30,0.6)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#2a1206'; x.lineWidth = 5; x.strokeRect(2, 2, w - 4, h - 4);
      x.lineWidth = 3; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); x.beginPath(); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); }
      x.lineWidth = 2; x.strokeRect(w * 0.3, h * 0.3, w * 0.4, h * 0.4); break;
    }
    case 'poster': {
      const hue = [8, 210, 45][s.seed % 3];
      x.fillStyle = `hsl(${hue},55%,${30 + s.seed * 6}%)`; x.fillRect(0, 0, w, h);
      x.fillStyle = `hsl(${(hue + 180) % 360},60%,70%)`; x.beginPath(); x.arc(w * 0.5, h * 0.38, w * 0.28, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.font = `900 ${w * 0.2}px ${CN}`; x.textAlign = 'center'; x.fillText(['演唱会', '新品', '招聘'][s.seed % 3], w / 2, h * 0.8);
      x.font = `700 ${w * 0.07}px ${LAT}`; x.fillText('11.08', w / 2, h * 0.92); grime(); break;
    }
    case 'ad': {
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, s.bg); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = s.fg; x.textAlign = 'left'; x.textBaseline = 'middle';
      const hs = fit(x, s.t, CNS, w * 0.6, h * 0.6); x.font = `900 ${hs}px ${CNS}`; x.fillText(s.t, w * 0.06, h * 0.42);
      x.font = `700 ${Math.round(h * 0.11)}px ${LAT}`; x.fillText(s.s, w * 0.06, h * 0.82);
      // the right third: a vertical strip of small Chinese copy in a bright frame, LED-screen scanlines over all of it
      x.strokeStyle = s.fg; x.lineWidth = 4; x.strokeRect(w * 0.7, h * 0.12, w * 0.24, h * 0.76);
      x.font = `900 ${Math.round(h * 0.13)}px ${CNS}`; x.textAlign = 'center';
      const sub = { ad0: '夜游两江', ad1: '老火锅', ad2: '江景洋房' }[s.name] || '新品';
      for (let i = 0; i < sub.length; i++) x.fillText(sub[i], w * 0.82, h * (0.24 + i * 0.17));
      x.fillStyle = 'rgba(0,0,0,0.18)'; for (let yy = 0; yy < h; yy += 4) x.fillRect(0, yy, w, 1.5);
      break;
    }
    case 'roofname': {
      x.fillStyle = '#050505'; x.fillRect(0, 0, w, h);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const hs = fit(x, s.t, CN, w * 0.94, h * 0.86); x.font = `900 ${hs}px ${CN}`;
      x.shadowColor = s.fg; x.shadowBlur = 14; x.fillStyle = s.fg; x.fillText(s.t, w / 2, h * 0.53); x.shadowBlur = 0;
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.font = `900 ${hs}px ${CN}`; x.globalAlpha = 0.35; x.fillText(s.t, w / 2, h * 0.5); x.globalAlpha = 1;
      break;
    }
    case 'stripe': {
      for (let i = -4; i < 8; i++) { x.fillStyle = i % 2 ? '#111' : '#f2c21a'; x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 32 + h, h); x.lineTo(i * 32 + h, h); x.closePath(); x.fill(); }
      break;
    }
  }
  x.restore();
}
