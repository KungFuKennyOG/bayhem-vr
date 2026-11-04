// VICTORY STAR — procedural container / general cargo ship moored along the Port of Victory quay.
// World coordinates (see DESIGN.md): quay-side hull face z = -153, far side z = -180, bow x = -95 (points -x),
// stern x = +65, main deck y = 9, waterline y = -2.2.
import * as THREE from 'three';
import { box, at, cyl, merge, tint } from '../../geom.js';
import { makeNoise, fbm, makeCanvas, canvasTex, heightToNormal } from '../../textures.js';
import { makeRng } from '../../rng.js';
import { hullDetailTexture, walkwayTextures, WALK, makeBurn, buildBreaches, lifeboatParts, beaconGlowTexture } from './ship-detail.js';

const V = THREE.Vector3;
const ZC = -166.5, B = 13.5, DECK = 9.0, FC_DECK = 11.7, FC_X = -81;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ hull form
function stemX(y) {
  const bump = 3.9 * Math.exp(-(((y + 4.3) / 2.1) ** 2));
  const cut = y < -8 ? Math.pow(-8 - y, 1.5) * 1.6 : 0;
  return -95.5 + (13.4 - y) * 0.28 - bump + cut;
}
function sternX(y) { return y >= 2.0 ? 65 - (13.6 - y) * 0.16 : 63.14 - (2.0 - y) * 1.1; }
function secF(y) {
  const R = 2.6, yb = -10.2 + R;
  if (y >= yb) return 1;
  const dy = (yb - y) / R;
  return (B - R + R * Math.sqrt(Math.max(0, 1 - dy * dy))) / B;
}
function hbAt(x, y) {
  const xf = stemX(y), xa = sternX(y);
  if (x <= xf || x > xa + 1e-4) return 0.12;
  const d = x - xf, L = lerp(34, 22, clamp01((y + 10) / 22)), t = clamp01(d / L);
  const p = 1.6 + 1.3 * clamp01((y + 3) / 12);
  let fb = 1 - Math.pow(1 - t, p);
  const bb = Math.exp(-(((y + 4.3) / 2.0) ** 2));
  fb = Math.max(fb, bb * 0.21 * Math.sqrt(clamp01(d / 4.5)));
  const dA = xa - x, La = 30 * clamp01((0.5 - y) / 7);
  let fa = La < 0.05 ? 1 : 1 - Math.pow(1 - clamp01(dA / La), 1.8);
  if (y >= 0.3) { const q = clamp01((x - 54) / (xa - 54)); fa *= Math.sqrt(Math.max(0, 1 - 0.38 * q ** 3)); }
  return Math.max(0.12, B * secF(y) * fb * fa);
}
// top edge of the hull side (sheer): forecastle bulwark, low sheer strake + railings in the cargo zone, poop bulwark
// cargo-zone bulwark top: flat aft of x -10, rising toward the forecastle step (sheer)
const cargoSheer = (x) => 9.35 + (x < -10 ? 1.6 * ((-10 - x) / 66) ** 2 : 0);
function topY(x) {
  if (x < FC_X) return 12.9 + 0.35 * clamp01((FC_X - x) / 14);
  if (x < -76) return lerp(12.9, cargoSheer(-76), sstep(FC_X, -76, x));
  if (x < 37) return cargoSheer(x);
  return lerp(9.35, 10.2, sstep(37, 40, x));
}
const deckYAt = (x) => (x < FC_X ? FC_DECK : DECK);

// ------------------------------------------------------------------ mesh builder with outward check
class MB {
  constructor() { this.p = []; this.uv = []; this.uv1 = []; this.idx = []; }
  v(x, y, z, u = 0, w = 0, u1 = 0, w1 = 0) { this.p.push(x, y, z); this.uv.push(u, w); this.uv1.push(u1, w1); return this.p.length / 3 - 1; }
  tri(a, b, c, out) {
    const P = this.p;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const e1 = [P[b * 3] - ax, P[b * 3 + 1] - ay, P[b * 3 + 2] - az], e2 = [P[c * 3] - ax, P[c * 3 + 1] - ay, P[c * 3 + 2] - az];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) this.idx.push(a, c, b); else this.idx.push(a, b, c);
  }
  quad(a, b, c, d, out) { this.tri(a, b, c, out); this.tri(a, c, d, out); }
  geo(uv1 = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (uv1) g.setAttribute('uv1', new THREE.Float32BufferAttribute(this.uv1, 2));
    g.setIndex(this.idx); g.computeVertexNormals();
    return g;
  }
}

// ------------------------------------------------------------------ textures
function noiseCanvas(w, h, seed, base, lo, hi, stretch = 1) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  const n = makeNoise(seed, 64), n2 = makeNoise(seed + 3, 64);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    let b = fbm(n, u, v, base, 5);
    b = b * 0.8 + fbm(n2, u * 1, v / stretch, base * 4, 3) * 0.2;
    const val = Math.round(255 * lerp(lo, hi, clamp01((b - 0.3) / 0.4)));
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = val; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}

const HX0 = -96.5, HX1 = 66.5, HY0 = -10.6, HY1 = 13.6, HW = 4096, HBAND = 512, HH = HBAND * 3;
const hpx = (x) => (x - HX0) / (HX1 - HX0) * HW;
const hpy = (y, band) => band * HBAND + (HY1 - y) / (HY1 - HY0) * HBAND;
const PXM = HW / (HX1 - HX0); // px per metre (horizontal)
const PYM = HBAND / (HY1 - HY0);

function hullTexture() {
  const c = makeCanvas(HW, HH), ctx = c.getContext('2d');
  const r = makeRng(77);
  // per-band drawing helpers: band 0 = quay side (u = x), band 1 = far side (mirrored), band 2 = transom (u = -z)
  const X = (x, band) => (band === 1 ? HW - hpx(x) : hpx(x));
  for (let band = 0; band < 3; band++) {
    const top = band * HBAND, bw = band === 2 ? 27 * PXM + 40 : HW;
    ctx.save(); ctx.beginPath(); ctx.rect(0, top, HW, HBAND); ctx.clip();
    // navy topsides
    let g = ctx.createLinearGradient(0, hpy(13, band), 0, hpy(-0.5, band));
    g.addColorStop(0, '#55607a'); g.addColorStop(0.5, '#465064'); g.addColorStop(1, '#394052');
    ctx.fillStyle = g; ctx.fillRect(0, top, HW, HBAND);
    // two-tone hull: red antifouling up to y 1.4 (she rides light, so the red shows above the quay coping)
    g = ctx.createLinearGradient(0, hpy(1.4, band), 0, hpy(-10.6, band));
    g.addColorStop(0, '#8e2a1e'); g.addColorStop(0.1, '#84281d'); g.addColorStop(0.17, '#6e2619'); g.addColorStop(0.26, '#4a2418'); g.addColorStop(0.6, '#33261c'); g.addColorStop(1, '#2a241c');
    ctx.fillStyle = g; ctx.fillRect(0, hpy(1.4, band), HW, hpy(-10.6, band) - hpy(1.4, band));
    // weathered red: lighter sun-faded mottling + darker drips from the topsides
    for (let i = 0; i < (band === 2 ? 30 : 260); i++) {
      const px = r() * bw, py = hpy(lerp(-1.8, 1.3, r()), band), w = (0.4 + r() * 3) * PXM, h = (0.1 + r() * 0.5) * PYM;
      ctx.fillStyle = r() < 0.5 ? `rgba(170,70,50,${0.08 + r() * 0.1})` : `rgba(40,14,10,${0.08 + r() * 0.12})`; ctx.fillRect(px, py, w, h);
    }
    // thin white boot-top line with a crisp cut-in
    ctx.fillStyle = '#d6d3c8'; ctx.fillRect(0, hpy(1.56, band), HW, hpy(1.4, band) - hpy(1.56, band));
    ctx.fillStyle = 'rgba(20,22,28,0.5)'; ctx.fillRect(0, hpy(1.56, band) - 1, HW, 1);
    // shadow / grime band under the deck-edge rubbing strake (defines the sheer line)
    g = ctx.createLinearGradient(0, hpy(8.75, band), 0, hpy(7.6, band));
    g.addColorStop(0, 'rgba(8,10,16,0.45)'); g.addColorStop(1, 'rgba(8,10,16,0)');
    ctx.fillStyle = g; ctx.fillRect(0, hpy(8.75, band), HW, hpy(7.6, band) - hpy(8.75, band));
    // large-scale paint tone variation: repainted / faded vertical panels
    for (let i = 0; i < (band === 2 ? 4 : 26); i++) {
      const px = r() * bw, w = (3 + r() * 14) * PXM, y0 = lerp(1.4, 6, r()), y1 = lerp(7, 9.4, r());
      ctx.fillStyle = r() < 0.5 ? `rgba(22,28,40,${0.08 + r() * 0.1})` : `rgba(120,130,150,${0.04 + r() * 0.06})`;
      ctx.fillRect(px, hpy(y1, band), w, (y1 - y0) * PYM);
    }
    // touched-up primer patches
    for (let i = 0; i < (band === 2 ? 6 : 44); i++) {
      const px = r() * bw, py = hpy(lerp(1.5, 8.5, r()), band), w = (0.6 + r() * 2.5) * PXM, h = (0.3 + r() * 1.2) * PYM;
      ctx.fillStyle = r() < 0.55 ? 'rgba(30,36,50,0.26)' : 'rgba(120,64,44,0.2)'; ctx.fillRect(px, py, w, h);
    }
    // weathering streaks (grime runs + salt bloom)
    for (let i = 0; i < (band === 2 ? 160 : 1100); i++) {
      const px = r() * bw, y0 = lerp(0, 9.2, r()), len = (0.8 + r() * 5) * PYM;
      const py = hpy(y0, band), w = 1 + r() * 4;
      g = ctx.createLinearGradient(0, py, 0, py + len);
      const dark = r() < 0.62;
      const a = 0.07 + r() * 0.15;
      g.addColorStop(0, dark ? `rgba(10,12,18,${a})` : `rgba(175,160,140,${a * 0.75})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px, py, w, len);
    }
    // fender / tug scrapes: horizontal scuffs through the paint near quay level
    for (let i = 0; i < (band === 2 ? 0 : 22); i++) {
      const cx = r() * bw, cy = lerp(1.4, 3.6, r()), wz = (1.2 + r() * 2.8) * PXM;
      for (let k = 0; k < 14; k++) {
        const sx = cx + (r() - 0.5) * wz, sy = hpy(cy + (r() - 0.5) * 1.3, band), sl = (0.3 + r() * 1.8) * PXM;
        ctx.fillStyle = r() < 0.55 ? `rgba(120,128,142,${0.12 + r() * 0.16})` : `rgba(140,72,38,${0.18 + r() * 0.22})`;
        ctx.fillRect(sx, sy, sl, 1 + r() * 2.5);
      }
    }
    // plate seams that read at distance (aligned with the uv1 detail tile: strakes every 2.4 m, butts every 12 m staggered)
    if (band < 2) {
      for (let j = 0; j <= 4; j++) {
        const y = 2.4 * j, py = hpy(y, band);
        ctx.fillStyle = 'rgba(5,7,12,0.42)'; ctx.fillRect(0, py - 2, HW, 3); ctx.fillStyle = 'rgba(150,160,180,0.16)'; ctx.fillRect(0, py + 1, HW, 1.5);
        if (y + 2.4 > 9.4) continue;
        const odd = [1, 3].includes(((j % 5) + 5) % 5);
        for (let xx = odd ? -78 : -72; xx < 62; xx += 12) {
          const px = X(xx, band), y0 = hpy(y + 2.4, band), hh = 2.4 * PYM;
          ctx.fillStyle = 'rgba(5,7,12,0.4)'; ctx.fillRect(px - 1.5, y0, 3, hh); ctx.fillStyle = 'rgba(150,160,180,0.14)'; ctx.fillRect(px + 1.5, y0, 1.5, hh);
          // rust bleeding from the butt / seam crossing
          if (r() < 0.35) { const gg = ctx.createLinearGradient(0, py, 0, py + (0.6 + r() * 1.6) * PYM); gg.addColorStop(0, 'rgba(140,70,34,0.45)'); gg.addColorStop(1, 'rgba(120,60,30,0)'); ctx.fillStyle = gg; ctx.fillRect(px - 2, py, 4, 2.2 * PYM); }
        }
      }
      // dented / oil-canned plates: soft shading blobs inside a few plates
      for (let i = 0; i < 70; i++) {
        const j = 1 + Math.floor(r() * 3), x = lerp(-76, 60, r()), y = 2.4 * j + 1.2 + (r() - 0.5) * 0.6;
        const px = X(x, band), py = hpy(y, band), rx = (1.2 + r() * 2.5) * PXM, ry = (0.5 + r() * 0.5) * PYM;
        const gg = ctx.createRadialGradient(px - rx * 0.25, py - ry * 0.35, 1, px, py, rx);
        const dark = r() < 0.6;
        gg.addColorStop(0, dark ? 'rgba(6,8,14,0.3)' : 'rgba(150,160,185,0.14)'); gg.addColorStop(0.6, dark ? 'rgba(6,8,14,0.12)' : 'rgba(150,160,185,0.05)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save(); ctx.translate(px, py); ctx.scale(1, ry / rx); ctx.translate(-px, -py); ctx.fillStyle = gg; ctx.fillRect(px - rx, py - rx, rx * 2, rx * 2); ctx.restore();
      }
    }
    // waterline scum
    g = ctx.createLinearGradient(0, hpy(-1.4, band), 0, hpy(-2.6, band));
    g.addColorStop(0, 'rgba(60,50,30,0)'); g.addColorStop(0.6, 'rgba(70,60,35,0.45)'); g.addColorStop(1, 'rgba(30,30,20,0.2)');
    ctx.fillStyle = g; ctx.fillRect(0, hpy(-1.4, band), HW, hpy(-2.6, band) - hpy(-1.4, band));
    ctx.restore();
  }
  const rust = (px, py, w, len, a) => {
    for (let k = 0; k < 3; k++) {
      const ww = w * (0.5 + r() * 0.8), ox = (r() - 0.5) * w * 0.8, ll = len * (0.5 + r() * 0.6);
      const g = ctx.createLinearGradient(0, py, 0, py + ll);
      g.addColorStop(0, `rgba(150,80,42,${Math.min(1, a * 1.1)})`); g.addColorStop(0.3, `rgba(120,64,36,${a * 0.7})`); g.addColorStop(1, 'rgba(110,50,20,0)');
      ctx.fillStyle = g; ctx.fillRect(px + ox - ww / 2, py, ww, ll);
    }
  };
  for (const band of [0, 1]) {
    // scuppers along the deck edge + rust streaks
    for (let x = -74; x < 63; x += 5.5 + r() * 2.5) {
      const px = X(x, band), py = hpy(8.75, band);
      ctx.fillStyle = '#07080a'; ctx.beginPath(); ctx.ellipse(px, py, 0.18 * PXM, 0.12 * PYM, 0, 0, Math.PI * 2); ctx.fill();
      rust(px, py + 2, 0.4 * PXM, (2.5 + r() * 6.5) * PYM, 0.5 + r() * 0.35);
      if (r() < 0.5) rust(px + (r() - 0.5) * 6, py + 2, 0.15 * PXM, (4 + r() * 4) * PYM, 0.5);
    }
    // rust bleeding from the deck edge / sheer strake welds (thin runs)
    for (let i = 0; i < 160; i++) {
      const x = lerp(-76, 62, r()), px = X(x, band), py = hpy(8.7, band);
      const len = (0.4 + r() * 2.6) * PYM, w = 1 + r() * 2.5, a = 0.2 + r() * 0.35;
      const gg = ctx.createLinearGradient(0, py, 0, py + len); gg.addColorStop(0, `rgba(140,72,36,${a})`); gg.addColorStop(1, 'rgba(120,60,30,0)');
      ctx.fillStyle = gg; ctx.fillRect(px, py, w, len);
    }
    // overboard discharges: dark outlet + bolted ring + stain running down to the waterline
    for (const [x, y, s] of [[-52, 2.6, 0.22], [-36, 3.4, 0.16], [-21, 2.2, 0.2], [9, 2.9, 0.26], [33.5, 3.2, 0.18], [50, 2.5, 0.22]]) {
      const px = X(x, band), py = hpy(y, band);
      let gg = ctx.createLinearGradient(0, py, 0, hpy(-0.6, band));
      gg.addColorStop(0, 'rgba(14,16,18,0.5)'); gg.addColorStop(0.4, 'rgba(60,50,40,0.25)'); gg.addColorStop(1, 'rgba(40,36,30,0)');
      ctx.fillStyle = gg; ctx.fillRect(px - s * 1.6 * PXM, py, s * 3.2 * PXM, hpy(-0.6, band) - py);
      gg = ctx.createLinearGradient(0, py, 0, hpy(-0.6, band)); gg.addColorStop(0, 'rgba(190,185,170,0.22)'); gg.addColorStop(1, 'rgba(190,185,170,0)');
      ctx.fillStyle = gg; ctx.fillRect(px - s * 2.4 * PXM, py + 4, s * 0.6 * PXM, (y - 0.2) * PYM);
      rust(px, py + 4, s * 2 * PXM, (1.2 + r() * 1.6) * PYM, 0.5);
      ctx.fillStyle = '#050606'; ctx.beginPath(); ctx.arc(px, py, s * PYM, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(150,150,145,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, s * PYM + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // freeing ports / panama chocks at the bulwarks (bow + stern)
    for (const x of [-89, -84, 46, 52, 60]) {
      const px = X(x, band), py = hpy(x < 0 ? 12.2 : 9.75, band);
      ctx.fillStyle = '#0a0b0d'; ctx.beginPath(); ctx.ellipse(px, py, 0.55 * PXM, 0.25 * PYM, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,200,190,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      rust(px, py + 6, 0.5 * PXM, (2 + r() * 3) * PYM, 0.4);
    }
    // anchor pocket / hawse pipe + heavy rust
    {
      const px = X(-88.6, band), py = hpy(8.1, band);
      ctx.fillStyle = '#050607'; ctx.beginPath(); ctx.ellipse(px, py, 1.15 * PXM, 0.9 * PYM, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,40,0.8)'; ctx.lineWidth = 4; ctx.stroke();
      rust(px, py + 0.9 * PYM, 1.6 * PXM, 10.2 * PYM, 0.7);
      rust(px, py + 0.9 * PYM, 0.8 * PXM, 10 * PYM, 0.65);
      rust(px + 0.6 * PXM, py + 0.9 * PYM, 0.3 * PXM, 9 * PYM, 0.6);
    }
    // portholes along the accommodation / engine-room flat below the superstructure
    for (let x = 41.2; x < 61; x += 2.35) {
      const px = X(x, band), py = hpy(7.15, band);
      rust(px, py + 0.25 * PYM, 0.18 * PXM, (0.8 + r() * 1.6) * PYM, 0.4);
      ctx.fillStyle = '#c9c7bd'; ctx.beginPath(); ctx.arc(px, py, 0.27 * PYM, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#121820'; ctx.beginPath(); ctx.arc(px, py, 0.2 * PYM, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(160,180,200,0.35)'; ctx.beginPath(); ctx.arc(px - 0.06 * PYM, py - 0.06 * PYM, 0.07 * PYM, 0, Math.PI * 2); ctx.fill();
    }
    // sheer strake highlight following the hull top
    ctx.strokeStyle = 'rgba(210,205,190,0.55)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = -95; x <= 65; x += 0.5) { const px = X(x, band), py = hpy(topY(x) - 0.12, band); if (x === -95) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.stroke();
    // bow name
    ctx.save(); ctx.fillStyle = '#efece2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(1.25 * PYM)}px "Arial Black", Arial, Helvetica, sans-serif`;
    ctx.fillText('VICTORY STAR', X(-86.2, band), hpy(11.6, band));
    // line livery amidships
    ctx.font = `bold ${Math.round(3.6 * PYM)}px "Arial Black", Arial, Helvetica, sans-serif`;
    ctx.fillStyle = 'rgba(236,233,224,0.93)';
    ctx.fillText('VICTORY STAR LINE', X(-16, band), hpy(5.0, band));
    // grime + rust runs over the livery (it's been through a few winters)
    for (let i = 0; i < 70; i++) {
      const px = X(lerp(-32, 0, r()), band), py = hpy(lerp(6.2, 8.8, r()), band), len = (1 + r() * 4) * PYM;
      const gg = ctx.createLinearGradient(0, py, 0, py + len);
      gg.addColorStop(0, r() < 0.5 ? 'rgba(20,24,32,0.3)' : 'rgba(130,68,34,0.32)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.fillRect(px, py, 1 + r() * 3, len);
    }
    ctx.fillStyle = 'rgba(236,233,224,0.93)';
    // tug marks
    ctx.font = `bold ${Math.round(0.55 * PYM)}px Arial, Helvetica, sans-serif`;
    for (const x of [-66, 30, 56]) {
      const px = X(x, band), py = hpy(2.6, band);
      ctx.strokeStyle = '#e8e6dc'; ctx.lineWidth = 3; ctx.strokeRect(px - 0.9 * PXM, py - 0.4 * PYM, 1.8 * PXM, 0.8 * PYM);
      ctx.fillStyle = '#e8e6dc'; ctx.fillText('TUG', px, py);
    }
    // draft marks (bow follows the stem rake, midship, stern): whole metres + even decimetres
    for (const kind of [0, 1, 2]) for (let d = 4; d <= 13; d++) {
      const y = -10.2 + d, x = kind === 0 ? stemX(y) + 2.4 : kind === 1 ? -17.5 : 62.6;
      const px = X(x, band), py = hpy(y, band);
      ctx.fillStyle = '#ecebe3';
      ctx.font = `bold ${Math.round(0.5 * PYM)}px Arial, Helvetica, sans-serif`; ctx.fillText(d + 'M', px, py - 0.25 * PYM);
      ctx.font = `bold ${Math.round(0.2 * PYM)}px Arial, Helvetica, sans-serif`;
      for (let s = 2; s <= 8; s += 2) ctx.fillText(String(s), px + 0.42 * PXM, hpy(y + s / 10, band) - 0.1 * PYM);
    }
    // deck line mark (amidships, at deck level above the load line mark)
    ctx.fillStyle = '#ecebe3'; ctx.fillRect(X(-13.0, band) - 0.9 * PXM, hpy(8.45, band), 1.8 * PXM, 0.1 * PYM);
    // plimsoll mark
    {
      const px = X(-12, band), py = hpy(2.45, band);
      ctx.font = `bold ${Math.round(0.42 * PYM)}px Arial, Helvetica, sans-serif`;
      ctx.strokeStyle = '#ecebe3'; ctx.lineWidth = 0.08 * PYM; ctx.beginPath(); ctx.arc(px, py, 0.55 * PYM, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ecebe3'; ctx.fillRect(px - 0.75 * PXM, py - 0.04 * PYM, 1.5 * PXM, 0.08 * PYM);
      ctx.fillRect(px - 1.0 * PXM, py - 1.0 * PYM, 2.0 * PXM, 0.08 * PYM);
      ctx.fillText('L', px - 0.8 * PXM, py - 0.5 * PYM); ctx.fillText('R', px + 0.8 * PXM, py - 0.5 * PYM);
      ctx.fillRect(px + 1.8 * PXM, py - 0.9 * PYM, 0.08 * PXM, 1.4 * PYM);
      for (let k = 0; k < 4; k++) ctx.fillRect(px + 1.8 * PXM, py - (0.9 - k * 0.42) * PYM, 0.6 * PXM, 0.07 * PYM);
    }
    // bow thruster + bulb symbols
    {
      let px = X(-85, band), py = hpy(1.2, band);
      ctx.strokeStyle = '#ecebe3'; ctx.lineWidth = 0.08 * PYM; ctx.beginPath(); ctx.arc(px, py, 0.5 * PYM, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 0.35 * PYM, py - 0.35 * PYM); ctx.lineTo(px + 0.35 * PYM, py + 0.35 * PYM);
      ctx.moveTo(px + 0.35 * PYM, py - 0.35 * PYM); ctx.lineTo(px - 0.35 * PYM, py + 0.35 * PYM); ctx.stroke();
      px = X(stemX(1.2) + 3.6, band);
      ctx.beginPath(); ctx.arc(px, py, 0.45 * PYM, Math.PI * 0.5, Math.PI * 1.5, band === 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (band === 1 ? -1 : 1) * 0.7 * PXM, py); ctx.stroke();
    }
    ctx.restore();
  }
  // transom: name + port of registry, rust from the stern chocks
  {
    const tx = (z) => (-153 - z) * PXM + 20; // u = -z
    const zc = ZC;
    ctx.save(); ctx.fillStyle = '#efece2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(1.7 * PYM)}px "Arial Black", Arial, Helvetica, sans-serif`;
    ctx.fillText('VICTORY STAR', tx(zc), hpy(6.6, 2));
    ctx.font = `bold ${Math.round(1.15 * PYM)}px "Arial Black", Arial, Helvetica, sans-serif`;
    ctx.fillText('MONROVIA', tx(zc), hpy(4.4, 2));
    for (const z of [zc - 8, zc - 3, zc + 3, zc + 8]) {
      const px = tx(z), py = hpy(9.3, 2);
      ctx.fillStyle = '#07080a'; ctx.beginPath(); ctx.ellipse(px, py, 0.5 * PXM, 0.25 * PYM, 0, 0, Math.PI * 2); ctx.fill();
      rust(px, py + 5, 0.5 * PXM, (3 + r() * 3) * PYM, 0.45);
    }
    ctx.restore();
  }
  // grime overlay
  const nc = noiseCanvas(512, 256, 91, 6, 0.8, 1.0, 3);
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = ctx.createPattern(nc, 'repeat'); ctx.fillRect(0, 0, HW, HH);
  ctx.restore();
  const t = canvasTex(c, { repeat: false, aniso: 8 });
  return t;
}

function plateNormal() {
  const W = 512, H = 512, h = new Float32Array(W * H), n = makeNoise(31, 32);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const sv = v * 5, k = Math.floor(sv), fv = sv - k;
    const ff = u * 16 - Math.floor(u * 16);
    let hh = -0.25 * Math.sin(Math.PI * ff) * (0.5 + 0.5 * Math.sin(Math.PI * fv));
    const dv = Math.min(fv, 1 - fv) * 2.4;
    if (dv < 0.05) hh += 1.6 * (1 - dv / 0.05);
    const bu = (u + (k & 1) * 0.5) % 1, du = Math.min(bu, 1 - bu) * 12;
    if (du < 0.05) hh += 1.6 * (1 - du / 0.05);
    hh += (fbm(n, u, v, 8, 4) - 0.5) * 0.8;
    h[y * W + x] = hh;
  }
  const t = heightToNormal(h, W, H, 1.1); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function deckTextures() {
  const W = 512, H = 512, c = makeCanvas(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  const n = makeNoise(41, 64), n2 = makeNoise(42, 32), r = makeRng(43);
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const m = fbm(n, u, v, 4, 5), s = fbm(n2, u, v, 16, 3);
    let col = [0.3, 0.39, 0.28];
    const rustT = clamp01((m - 0.62) * 6) * (0.6 + s * 0.6);
    col = col.map((cv, k) => lerp(cv, [0.36, 0.2, 0.1][k], rustT));
    const wear = clamp01((fbm(n2, u * 0.5, v * 2, 4, 3) - 0.55) * 4);
    col = col.map((cv) => cv * (1 + wear * 0.45));
    const b = 0.86 + (s - 0.5) * 0.35 + (r() - 0.5) * 0.06;
    // weld seams every 2 m
    const fu = (u * 4) % 1, fv = (v * 4) % 1, dd = Math.min(fu, 1 - fu, fv, 1 - fv) * 2;
    let hh = (s - 0.5) * 0.6 - rustT * 0.6;
    let k2 = 1;
    if (dd < 0.03) { hh += 1.2 * (1 - dd / 0.03); k2 = 0.75; }
    h[y * W + x] = hh;
    const i = (y * W + x) * 4;
    img.data[i] = Math.min(255, col[0] * b * k2 * 255); img.data[i + 1] = Math.min(255, col[1] * b * k2 * 255); img.data[i + 2] = Math.min(255, col[2] * b * k2 * 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // scratches
  ctx.strokeStyle = 'rgba(160,160,140,0.12)'; ctx.lineWidth = 1;
  for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H, a = r() * Math.PI; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); ctx.stroke(); }
  return { map: canvasTex(c), normal: heightToNormal(h, W, H, 1.5) };
}

function paintTextures() {
  const W = 512, H = 512, c = makeCanvas(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  const n = makeNoise(51, 64), n2 = makeNoise(52, 64), r = makeRng(53);
  const h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const m = fbm(n, u, v, 4, 5);
    const st = fbm(n2, u * 6, v * 0.5, 8, 3);
    let b = 0.93 + (m - 0.5) * 0.18 + (r() - 0.5) * 0.04;
    b -= Math.max(0, st - 0.6) * 0.45 * (0.3 + v);
    const fu = (u * 2) % 1, fv = (v * 2) % 1, dd = Math.min(fu, 1 - fu, fv, 1 - fv) * 2;
    let hh = (m - 0.5) * 0.5;
    if (dd < 0.012) { hh += 1.0; b *= 0.82; }
    const rs = clamp01((fbm(n2, u, v, 10, 3) - 0.74) * 6) * 0.6;
    const i = (y * W + x) * 4;
    img.data[i] = Math.min(255, (b * (1 - rs * 0.2)) * 255); img.data[i + 1] = Math.min(255, b * (1 - rs * 0.45) * 255); img.data[i + 2] = Math.min(255, b * (1 - rs * 0.6) * 255); img.data[i + 3] = 255;
    h[y * W + x] = hh;
  }
  ctx.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(h, W, H, 1.2) };
}

function containerTextures() {
  const W = 256, H = 256, c = makeCanvas(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  const n = makeNoise(61, 32), h = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const cor = Math.max(-1, Math.min(1, Math.sin(u * Math.PI * 2 * 9) * 1.6));
    let b = 0.86 + cor * 0.08 + (fbm(n, u, v, 6, 4) - 0.5) * 0.25;
    const rail = v < 0.045 || v > 0.955;
    if (rail) b *= 0.62;
    b *= 1 - 0.25 * clamp01((v - 0.75) / 0.25);
    h[y * W + x] = rail ? 1.5 : cor;
    const i = (y * W + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.min(255, b * 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { map: canvasTex(c), normal: heightToNormal(h, W, H, 2.0) };
}

// patchy ember mask (black with hot cracks/blotches) used as emissiveMap; emissive colour stays black until setBurnt
function emberTexture() {
  const W = 256, c = makeCanvas(W, W), ctx = c.getContext('2d'), img = ctx.createImageData(W, W);
  const n = makeNoise(71, 32), n2 = makeNoise(72, 64);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / W;
    const m = fbm(n, u, v, 3, 4), cr = Math.abs(fbm(n2, u, v, 6, 4) - 0.5);
    const e = clamp01((m - 0.62) * 5) * 0.5 + clamp01(1 - cr * 30) * clamp01((m - 0.55) * 4);
    const i = (y * W + x) * 4;
    img.data[i] = Math.min(255, e * 255); img.data[i + 1] = Math.min(255, e * e * 150); img.data[i + 2] = Math.min(255, e * e * e * 60); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTex(c);
}

// sign atlas
const ATL = 1024;
const REG = {
  fuel: [0, 0, 1024, 256], hazard: [0, 256, 512, 64], redwhite: [512, 256, 512, 64], star: [0, 320, 256, 256],
  name: [256, 320, 768, 128], nosmoke: [256, 448, 256, 128], fire: [512, 448, 256, 128], muster: [768, 448, 256, 128],
  imo: [0, 576, 512, 96], swl: [512, 576, 256, 96], danger: [0, 672, 512, 96], lifeboat: [512, 672, 256, 96],
  flag: [768, 576, 256, 192], ppe: [0, 768, 512, 96], gangway: [512, 768, 512, 96],
  fuelword: [0, 864, 320, 160], flam: [320, 864, 160, 160],
  hn1: [480, 864, 108, 160], hn2: [588, 864, 108, 160], hn3: [696, 864, 108, 160], hn4: [804, 864, 108, 160], hn5: [912, 864, 108, 160],
};
function atlasTexture() {
  const c = makeCanvas(ATL, ATL), ctx = c.getContext('2d');
  ctx.fillStyle = '#888'; ctx.fillRect(0, 0, ATL, ATL);
  const F = (s, w = 'bold') => `${w} ${s}px "Arial Black", Arial, Helvetica, sans-serif`;
  const text = (t, x, y, s, col, w) => { ctx.font = F(s, w); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); };
  const plate = (k, bg, border) => { const [x, y, w, h] = REG[k]; ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); if (border) { ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(x + 6, y + 6, w - 12, h - 12); } return [x, y, w, h]; };
  // fuel bunker station
  {
    const [x, y, w, h] = plate('fuel', '#f2c21b', '#111');
    // warning triangle
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(x + 40, y + 200); ctx.lineTo(x + 130, y + 40); ctx.lineTo(x + 220, y + 200); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2c21b'; ctx.beginPath(); ctx.moveTo(x + 66, y + 186); ctx.lineTo(x + 130, y + 72); ctx.lineTo(x + 194, y + 186); ctx.closePath(); ctx.fill();
    text('!', x + 130, y + 145, 90, '#111');
    text('FUEL BUNKER STATION', x + 620, y + 82, 70, '#111');
    ctx.fillStyle = '#c4161c'; ctx.fillRect(x + 250, y + 140, w - 280, 86);
    text('NO NAKED LIGHTS', x + 635, y + 184, 58, '#fff');
  }
  // hazard stripes
  for (const [k, a, b] of [['hazard', '#f0b81a', '#141414'], ['redwhite', '#c81e1e', '#f2f2ee']]) {
    const [x, y, w, h] = REG[k]; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = a; ctx.fillRect(x, y, w, h); ctx.fillStyle = b;
    for (let i = -2; i < 12; i++) { ctx.beginPath(); ctx.moveTo(x + i * 64, y + h); ctx.lineTo(x + i * 64 + 32, y + h); ctx.lineTo(x + i * 64 + 32 + h, y); ctx.lineTo(x + i * 64 + h, y); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // funnel star
  {
    const [x, y, w, h] = plate('star', '#f1efe8');
    ctx.fillStyle = '#c4161c'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 46 : 118; ctx.lineTo(x + w / 2 + Math.cos(a) * rr, y + h / 2 + 8 + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  { const [x, y, w, h] = plate('name', '#f1efe8', '#1b2434'); text('VICTORY STAR', x + w / 2, y + h / 2 + 4, 84, '#1b2434'); }
  { const [x, y, w, h] = plate('nosmoke', '#f4f4f0', '#c4161c'); text('NO', x + w / 2, y + 42, 38, '#c4161c'); text('SMOKING', x + w / 2, y + 88, 36, '#c4161c'); }
  { const [x, y, w, h] = plate('fire', '#c4161c', '#fff'); text('FIRE', x + w / 2, y + 44, 40, '#fff'); text('STATION 4', x + w / 2, y + 90, 32, '#fff'); }
  { const [x, y, w, h] = plate('muster', '#1c8a3c', '#fff'); text('MUSTER', x + w / 2, y + 44, 38, '#fff'); text('STATION', x + w / 2, y + 90, 34, '#fff'); }
  { const [x, y, w, h] = plate('imo', '#1b2434'); text('IMO 9471326', x + w / 2, y + h / 2 + 3, 64, '#f1efe8'); }
  { const [x, y, w, h] = plate('swl', '#f2c21b', '#111'); text('SWL 40 T', x + w / 2, y + h / 2 + 3, 44, '#111'); }
  { const [x, y, w, h] = plate('danger', '#c4161c', '#fff'); text('DANGER — FUEL OIL', x + w / 2, y + h / 2 + 3, 44, '#fff'); }
  { const [x, y, w, h] = plate('lifeboat', '#f1efe8', '#111'); text('LIFEBOAT 1', x + w / 2, y + h / 2 + 3, 36, '#111'); }
  { const [x, y, w, h] = plate('ppe', '#1d4fa0', '#fff'); text('WEAR PPE AT ALL TIMES', x + w / 2, y + h / 2 + 3, 36, '#fff'); }
  { const [x, y, w, h] = plate('gangway', '#f2c21b', '#111'); text('GANGWAY — SWL 6 PERSONS', x + w / 2, y + h / 2 + 3, 34, '#111'); }
  // big FUEL word plate, flammable-liquid diamond, hatch numbers
  {
    const [x, y, w, h] = plate('fuelword', '#c4161c', '#fff');
    text('FUEL', x + w / 2, y + 62, 92, '#fff'); text('DANGER', x + w / 2, y + 126, 40, '#ffd21a');
  }
  {
    const [x, y, w, h] = REG.flam; ctx.fillStyle = '#7a8088'; ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(-56, -56, 112, 112); ctx.fillStyle = '#d0141a'; ctx.fillRect(-50, -50, 100, 100); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); // flame
    ctx.moveTo(x + 80, y + 36); ctx.quadraticCurveTo(x + 104, y + 70, x + 96, y + 92); ctx.quadraticCurveTo(x + 80, y + 104, x + 64, y + 92); ctx.quadraticCurveTo(x + 58, y + 70, x + 80, y + 36); ctx.fill();
    text('3', x + 80, y + 124, 30, '#fff');
  }
  for (let i = 1; i <= 5; i++) { const [x, y, w, h] = REG['hn' + i]; ctx.fillStyle = '#52605e'; ctx.fillRect(x, y, w, h); text(String(i), x + w / 2, y + h / 2 + 8, 128, '#ecebe3'); }
  // Liberian ensign
  {
    const [x, y, w, h] = REG.flag;
    for (let i = 0; i < 11; i++) { ctx.fillStyle = i % 2 ? '#f4f4f0' : '#bf1e2e'; ctx.fillRect(x, y + i * h / 11, w, h / 11 + 1); }
    ctx.fillStyle = '#002868'; ctx.fillRect(x, y, w * 0.42, h * 5 / 11);
    ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 11 : 28; ctx.lineTo(x + w * 0.21 + Math.cos(a) * rr, y + h * 2.5 / 11 + Math.sin(a) * rr); }
    ctx.fill();
  }
  return canvasTex(c, { repeat: false, aniso: 8 });
}
// plane quad with atlas UVs. faces +z before rotation.
function decal(k, w, h, x, y, z, ry = 0, rx = 0, rep = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  const [rx0, ry0, rw, rh] = REG[k];
  const u0 = rx0 / ATL, u1 = (rx0 + rw) / ATL, v1 = 1 - ry0 / ATL, v0 = 1 - (ry0 + rh) / ATL;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const uu = uv.getX(i), vv = uv.getY(i);
    // repeated stripes stay inside the region by stretching
    uv.setXY(i, u0 + (u1 - u0) * uu * (rep === 1 ? 1 : 1), v0 + (v1 - v0) * vv);
  }
  return at(g, x, y, z, rx, ry, 0);
}

// ------------------------------------------------------------------ builder
export function buildShip(opts = {}) {
  const rng = makeRng(20261104);
  const root = new THREE.Group(); root.name = 'VictoryStar';
  const colliders = [], walk = [], lights = [];
  const col = (x0, y0, z0, x1, y1, z1) => colliders.push({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)] });

  // ---------- materials
  const hullTex = hullTexture(), plateN = plateNormal();
  plateN.channel = 1;
  const deckT = deckTextures(), paintT = paintTextures(), contT = containerTextures(), atlas = atlasTexture();
  const mHull = new THREE.MeshStandardMaterial({ map: hullTex, normalMap: plateN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.58, metalness: 0.12,
    emissive: 0xffffff, emissiveMap: hullTex, emissiveIntensity: 0.2 }); // self-lit floor: never pure black on the shadowed quay side
  const emberT = emberTexture();
  const mDeck = new THREE.MeshStandardMaterial({ map: deckT.map, normalMap: deckT.normal, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.8, metalness: 0.15, emissive: 0x000000, emissiveMap: emberT });
  const mPaint = new THREE.MeshStandardMaterial({ map: paintT.map, normalMap: paintT.normal, normalScale: new THREE.Vector2(0.5, 0.5), vertexColors: true, roughness: 0.62, metalness: 0.2, emissive: 0x000000, emissiveMap: emberT });
  const mCont = new THREE.MeshStandardMaterial({ map: contT.map, normalMap: contT.normal, roughness: 0.72, metalness: 0.3, emissive: 0x000000, emissiveMap: emberT });
  const mLit = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.22, metalness: 0.5, emissive: 0xffc27a, emissiveIntensity: 0 });
  mLit.userData.duskEmissive = 1.6;
  if (opts && opts.lit) mLit.emissiveIntensity = 1.6 * opts.lit;
  const mGlass = new THREE.MeshStandardMaterial({ color: 0x31404c, roughness: 0.12, metalness: 0.75 });
  const mSign = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6, metalness: 0.1 });
  // quay-side walkway: unique non-slip paint / seams / rust / stencils texture
  const walkT = walkwayTextures([
    { t: 'NO SMOKING', x: 12.5, z: -155.35, size: 0.42, col: 'rgba(236,232,220,0.8)' },
    { t: 'KEEP CLEAR', x: -2.2, z: -155.5, size: 0.4, col: 'rgba(240,200,40,0.85)' },
    { t: 'KEEP CLEAR', x: -9.8, z: -155.5, size: 0.4, col: 'rgba(240,200,40,0.85)' },
    { t: 'FUEL STATION', x: 0.6, z: -155.4, size: 0.34, col: 'rgba(236,232,220,0.75)' },
    { arrow: true, x: 29.5, z: -155.3, len: 1.5, col: 'rgba(236,232,220,0.75)' },
    { arrow: true, x: -17.5, z: -155.3, len: 1.5, col: 'rgba(236,232,220,0.75)' },
    { t: 'MUSTER', x: 34.5, z: -155.3, size: 0.32, col: 'rgba(236,232,220,0.7)' },
    { arrow: true, x: -36, z: -155.3, len: 1.5, col: 'rgba(236,232,220,0.75)' },
  ]);
  const mWalk = new THREE.MeshStandardMaterial({ map: walkT.map, normalMap: walkT.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.82, metalness: 0.12,
    emissive: 0x000000, emissiveMap: emberT, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // burn shader: scorch gradient around the blast, breaches + ember rims on the hull (setBurnt drives uBurn)
  const BURN = makeBurn();
  const hullDet = hullDetailTexture();
  BURN.patch(mHull, 'hull', { tDet: hullDet });
  for (const m of [mDeck, mPaint, mCont, mWalk]) BURN.patch(m, 'ember');
  const mBeacon = new THREE.MeshStandardMaterial({ color: 0x5a1606, roughness: 0.3, metalness: 0.0, emissive: 0xff3a0a, emissiveIntensity: 2.2 });

  const P = [], DK = [], LIT = [], GL = [], SG = [], HUL = [], WALKG = [];
  const C = (hex) => new THREE.Color(hex);
  let SINK = P; // painted parts go to SINK (normally P; the wreckable jib / funnel top collect separately)
  const JIB = [], FTOP = [];
  const pnt = (g, hex) => { const c = C(hex); tint(g, c.r, c.g, c.b); SINK.push(g); return g; };
  const bx = (w, h, d, x, y, z, hex, rx = 0, ry = 0, rz = 0) => pnt(at(box(w, h, d, 4), x, y, z, rx, ry, rz), hex);
  const blk = (x0, x1, y0, y1, z0, z1, hex) => bx(x1 - x0, y1 - y0, Math.abs(z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, hex);
  const tubeG = (a, b, r, seg = 8, open = true) => {
    const d = new V().subVectors(b, a), len = d.length();
    const g = cyl(r, r, len, seg, open);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), d.normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  };
  const tube = (a, b, r, hex, seg = 8) => pnt(tubeG(a, b, r, seg), hex);
  const line = (pts, r, hex, seg = 6) => { for (let i = 0; i < pts.length - 1; i++) tube(pts[i], pts[i + 1], r, hex, seg); };
  const catenary = (a, b, sag, n = 10) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new V().lerpVectors(a, b, t).add(new V(0, -sag * 4 * t * (1 - t), 0))); } return pts; };
  const lamp = (x, y, z, s = 0.32) => { LIT.push(at(box(s * 0.78, s * 0.14, s * 0.5), x, y + s * 0.18, z)); lights.push(new V(x, y, z)); };

  const WHITE = 0xe9e5da, LGREY = 0xbfc2bf, GREY = 0x80868a, DGREY = 0x3e4448, BLACK = 0x18191b, RED = 0xb8231b,
    YEL = 0xe6ae1c, ORANGE = 0xff6510, HATCH = 0x52605e, NAVY = 0x1c2636, CRANE = 0xd99e1c, RUSTY = 0x6b3a22, GREEN = 0x3c4a3a;

  // ---------- hull (outer shell, transom, keel) — hull material with hull-wide UVs + tiled plate normal on uv1
  const XS0 = -95.5;
  const cols = [];
  for (let x = XS0; x < -70; x += 1.0) cols.push(x);
  const mid = [];
  for (let x = -70; x < 50; x += 4) mid.push(x);
  mid.push(22, 25, 21, 26, 37, 38.5, 40, -6, -2);
  mid.sort((a, b) => a - b);
  for (const x of mid) if (!cols.length || x - cols[cols.length - 1] > 0.6) cols.push(x);
  for (let x = 50; x <= 65.001; x += 1.25) if (x - cols[cols.length - 1] > 0.6) cols.push(x);
  const mapX = (cx, y) => {
    if (cx < -70) { const s = (cx - XS0) / (-70 - XS0); const xf = stemX(y); return xf + s * (-70 - xf); }
    if (cx > 50) { const s = (cx - 50) / 15; return 50 + s * (sternX(y) - 50); }
    return cx;
  };
  const ROWS = [-10.2, -9.9, -9.4, -8.8, -8.0, -7.0, -5.6, -4.2, -3.0, -1.8, -0.6, 0.6, 2.2, 4, 6, 7.6, 9.0, 'T'];
  const hm = new MB();
  const huv = (x, y, band) => [band === 1 ? 1 - hpx(x) / HW : hpx(x) / HW, 1 - hpy(y, band) / HH];
  const grid = [[], []]; // [side][row][col] -> {i, x, y, z}
  for (const side of [0, 1]) {
    const sg = side === 0 ? 1 : -1;
    for (let j = 0; j < ROWS.length; j++) {
      const row = [];
      for (const cx of cols) {
        let y = ROWS[j], x;
        if (y === 'T') { x = mapX(cx, 12); y = topY(x); x = mapX(cx, y); y = topY(x); } else x = mapX(cx, y);
        const z = ZC + sg * hbAt(x, y);
        const [u, w] = huv(x, y, side);
        row.push({ i: hm.v(x, y, z, u, w, x / 12, y / 12), x, y, z });
      }
      grid[side].push(row);
    }
    const out = [0, 0, sg];
    for (let j = 0; j < ROWS.length - 1; j++) for (let c = 0; c < cols.length - 1; c++) {
      const a = grid[side][j][c], b = grid[side][j][c + 1], cc = grid[side][j + 1][c + 1], d = grid[side][j + 1][c];
      if (side === 0 && j === ROWS.length - 2 && a.x >= 21.99 && b.x <= 25.01) continue; // gangway gap in the sheer strake
      hm.quad(a.i, b.i, cc.i, d.i, out);
    }
  }
  // stem + transom + keel strips (own vertices so normals stay crisp)
  {
    const nC = cols.length - 1, nR = ROWS.length;
    for (let j = 0; j < nR - 1; j++) {
      for (const [c, out] of [[0, [-1, 0, 0]], [nC, [1, 0, 0]]]) {
        const p = [grid[0][j][c], grid[1][j][c], grid[1][j + 1][c], grid[0][j + 1][c]];
        const ids = p.map((q) => {
          const u = c === 0 ? hpx(q.x) / HW : ((-153 - q.z) * PXM + 20) / HW;
          return hm.v(q.x, q.y, q.z, u, 1 - hpy(q.y, c === 0 ? 0 : 2) / HH, q.z / 12, q.y / 12);
        });
        hm.quad(ids[0], ids[1], ids[2], ids[3], out);
      }
    }
    for (let c = 0; c < nC; c++) {
      const p = [grid[0][0][c], grid[0][0][c + 1], grid[1][0][c + 1], grid[1][0][c]];
      const ids = p.map((q) => hm.v(q.x, q.y, q.z, hpx(q.x) / HW, 1 - hpy(-10.4, 0) / HH, q.x / 12, q.z / 12));
      hm.quad(ids[0], ids[1], ids[2], ids[3], [0, -1, 0]);
    }
  }
  const hullGeo = hm.geo(true);
  const hullMesh = new THREE.Mesh(hullGeo, mHull); hullMesh.castShadow = hullMesh.receiveShadow = true; hullMesh.name = 'hull';
  root.add(hullMesh);

  // ---------- hull-side hardware (raised so it catches the rim light)
  for (const side of [0, 1]) {
    const sg = side === 0 ? 1 : -1, zs = ZC + sg * (B + 0.04);
    // deck-edge rubbing strake: half-round bar that catches the light along the sheer
    pnt(tubeG(new V(-75.5, 8.85, zs + sg * 0.02), new V(37, 8.85, zs + sg * 0.02), 0.1, 8, true), 0x4a5468);
    for (let x = -75.5; x < 37; x += 4) { const x2 = Math.min(37, x + 4); pnt(tubeG(new V(x, topY(x) - 0.05, zs + sg * 0.02), new V(x2, topY(x2) - 0.05, zs + sg * 0.02), 0.03, 4, true), 0x8c939c); } // sheer strake cap edge
    // porthole rims (the glass is painted in the hull texture)
    for (let x = 41.2; x < 61; x += 2.35) {
      const z = ZC + sg * (hbAt(x, 7.15) + 0.02), ry = Math.atan2(sg * (hbAt(x + 0.1, 7.15) - hbAt(x - 0.1, 7.15)) / 0.2, 1) * -1;
      const g = new THREE.TorusGeometry(0.235, 0.035, 5, 14); g.rotateY(ry); g.translate(x, 7.15, z); pnt(g, 0x9a9c98);
    }
    // hawse pipe bolster ring around the anchor pocket
    {
      const hx = -88.6, hy = 8.85, e = 0.05;
      const hz = (x, y) => ZC + sg * hbAt(x, y);
      const n = new V(-(hz(hx + e, hy) - hz(hx - e, hy)) / (2 * e), -(hz(hx, hy + e) - hz(hx, hy - e)) / (2 * e), 1).multiply(new V(1, 1, 1));
      n.set(n.x * sg, n.y * sg, sg).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new V(0, 0, 1), n);
      const p = new V(hx, hy, hz(hx, hy)).addScaledVector(n, 0.06);
      const ring = new THREE.TorusGeometry(0.62, 0.14, 8, 22); ring.scale(1.15, 1, 1); ring.applyQuaternion(q); ring.translate(p.x, p.y, p.z); pnt(ring, 0x2a3140);
      const lip = cyl(0.5, 0.5, 0.3, 18, true); lip.rotateX(Math.PI / 2); lip.scale(1.15, 1, 1); lip.applyQuaternion(q); lip.translate(p.x, p.y, p.z); pnt(lip, 0x121416);
    }
    // pilot doors + side port frames
    for (const [x, y, w, h] of [[30.5, 3.2, 1.0, 1.9], [-40, 2.4, 1.6, 1.6], [48, 3.6, 1.0, 1.9]]) {
      bx(w + 0.16, 0.1, 0.1, x, y + h / 2, zs + sg * 0.03, 0x2c3546); bx(w + 0.16, 0.1, 0.1, x, y - h / 2, zs + sg * 0.03, 0x2c3546);
      bx(0.1, h, 0.1, x - w / 2, y, zs + sg * 0.03, 0x2c3546); bx(0.1, h, 0.1, x + w / 2, y, zs + sg * 0.03, 0x2c3546);
      for (let k = 0; k < 3; k++) bx(0.06, 0.3, 0.14, x + w / 2 + 0.12, y - h / 2 + 0.3 + k * 0.6, zs + sg * 0.06, 0x2c3546);
    }
    // pilot ladder hand-holds below the pilot door
    for (let k = 0; k < 6; k++) bx(0.6, 0.05, 0.12, 30.5, 1.8 - k * 0.5, zs + sg * 0.05, 0xb0b0a8);
    // stern sponson lines (white rub bars at the quarters)
    bx(10, 0.14, 0.14, 58.5, 7.6, ZC + sg * (hbAt(58.5, 7.6) + 0.05), 0x2c3546);
  }
  // ---------- bulwark inner face + cap (paint), decks
  const topRow = (side) => grid[side][ROWS.length - 1];
  for (const side of [0, 1]) {
    const sg = side === 0 ? 1 : -1, tr = topRow(side);
    const mb = new MB();
    let prev = null;
    for (let c = 0; c < tr.length; c++) {
      const q = tr[c];
      const dy = deckYAt(q.x);
      const hbIn = Math.max(0.05, hbAt(q.x, Math.max(dy, q.y - 0.01)) - 0.22);
      const o = mb.v(q.x, q.y, q.z, q.x / 4, 0);
      const it = mb.v(q.x, q.y, ZC + sg * hbIn, q.x / 4, 0.06);
      const ib = mb.v(q.x, dy, ZC + sg * hbIn, q.x / 4, (q.y - dy) / 4);
      const cur = { o, it, ib, x: q.x };
      if (prev && !(side === 0 && prev.x >= 21.99 && q.x <= 25.01)) {
        mb.quad(prev.o, cur.o, cur.it, prev.it, [0, 1, 0]);
        mb.quad(prev.it, cur.it, cur.ib, prev.ib, [0, 0, -sg]);
      }
      prev = cur;
    }
    pnt(mb.geo(), side === 0 ? 0xc9c8c0 : 0xc9c8c0);
  }
  {
    const dm = new MB();
    const strip = (xs, y) => {
      let prev = null;
      for (const x of xs) {
        const hb = Math.max(0.05, hbAt(x, y) - 0.22);
        const a = dm.v(x, y, ZC + hb, x / 8, (ZC + hb) / 8), b = dm.v(x, y, ZC - hb, x / 8, (ZC - hb) / 8);
        if (prev) dm.quad(prev[0], a, b, prev[1], [0, 1, 0]);
        prev = [a, b];
      }
    };
    const xsMain = [FC_X - 0.3]; for (const c of cols) { const x = mapX(c, DECK); if (x > FC_X) xsMain.push(x); }
    strip(xsMain, DECK);
    const xsFc = []; for (let x = stemX(FC_DECK) + 0.3; x < FC_X; x += 0.8) xsFc.push(x); xsFc.push(FC_X);
    strip(xsFc, FC_DECK);
    DK.push(dm.geo());
  }
  // forecastle front bulkhead with doors + ladder
  {
    const hb = hbAt(FC_X, FC_DECK) - 0.22;
    blk(FC_X - 0.25, FC_X, DECK, FC_DECK + 0.05, ZC - hb, ZC + hb, WHITE);
    for (const dz of [-6, 6]) { bx(0.06, 2.0, 0.95, FC_X - 0.28, DECK + 1.0, ZC + dz, DGREY); bx(0.04, 0.3, 0.3, FC_X - 0.32, DECK + 1.5, ZC + dz, GREY); }
    // ladder up to forecastle
    for (let k = 0; k < 9; k++) bx(0.25, 0.04, 0.9, FC_X - 0.4 - k * 0.27, DECK + 0.3 + k * 0.3, ZC + 2.5, GREY);
    tube(new V(FC_X - 0.3, FC_DECK + 1, ZC + 2.05), new V(FC_X - 2.8, DECK + 1, ZC + 2.05), 0.03, LGREY);
    tube(new V(FC_X - 0.3, FC_DECK + 1, ZC + 2.95), new V(FC_X - 2.8, DECK + 1, ZC + 2.95), 0.03, LGREY);
    col(FC_X - 0.3, DECK, ZC - hb, FC_X, FC_DECK, ZC + hb);
    // forecastle rail along the front edge
  }
  // railings (cargo zone) on top of the low sheer strake
  const railing = (xa, za, xb, zb, y, h = 1.05, sp = 1.6, hex = LGREY) => {
    const dx = xb - xa, dz = zb - za, len = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx);
    const n = Math.max(1, Math.round(len / sp));
    for (let i = 0; i <= n; i++) { const t = i / n; bx(0.05, h, 0.05, xa + dx * t, y + h / 2, za + dz * t, hex); }
    for (const [hh, th] of [[h, 0.06], [h * 0.62, 0.04], [h * 0.3, 0.04]]) bx(len, th, th, (xa + xb) / 2, y + hh, (za + zb) / 2, hex, 0, ry, 0);
  };
  {
    const zq = -153.0 - 0.12, zf = -180 + 0.12;
    // forward of x -10 the rail rides the rising bulwark (sheer)
    const railSheer = (xa, xb2, z, h = 0.75, sp = 1.6) => {
      const n = Math.max(1, Math.round((xb2 - xa) / sp)), pts = [];
      for (let i = 0; i <= n; i++) { const x = lerp(xa, xb2, i / n); pts.push([x, topY(x)]); bx(0.05, h, 0.05, x, topY(x) + h / 2, z, WHITE); }
      for (const [hh, th] of [[h, 0.03], [h * 0.62, 0.02], [h * 0.3, 0.02]]) for (let i = 0; i < n; i++) tube(new V(pts[i][0], pts[i][1] + hh, z), new V(pts[i + 1][0], pts[i + 1][1] + hh, z), th, WHITE, 4);
    };
    railSheer(-75.5, -10, zq); railSheer(-75.5, -10, zf);
    railing(-10, zq, 21.95, zq, 9.35, 0.75, 1.6, WHITE);
    railing(25.05, zq, 37.5, zq, 9.35, 0.75, 1.6, WHITE);
    railing(-10, zf, 37.5, zf, 9.35, 0.75, 1.6, WHITE);
  }

  // ---------- hatch covers + containers
  const HATCHES = [[-78, -56], [-50.5, -27], [-24, -6], [-3, 15], [20.5, 36]];
  const HZ0 = -176, HZ1 = -157.6, HTOP = 10.8;
  HATCHES.forEach(([x0, x1], hi) => {
    // coaming
    blk(x0 + 0.25, x1 - 0.25, DECK, 10.05, HZ0 + 0.25, HZ1 - 0.25, HATCH);
    // coaming stays (brackets)
    for (let x = x0 + 1; x < x1 - 0.5; x += 1.6) for (const [z, dz] of [[HZ1 - 0.25, 0.25], [HZ0 + 0.25, -0.25]]) bx(0.06, 0.7, 0.5, x, DECK + 0.35, z + dz * 0.9, HATCH);
    for (let z = HZ0 + 1.5; z < HZ1 - 1; z += 2.2) for (const [x, dx] of [[x0 + 0.25, -0.25], [x1 - 0.25, 0.25]]) bx(0.5, 0.7, 0.06, x + dx * 0.9, DECK + 0.35, z, HATCH);
    // pontoons (2 across) with skirts and top stiffeners, slight crown
    const zm = (HZ0 + HZ1) / 2;
    for (const [za, zb] of [[HZ0, zm - 0.04], [zm + 0.04, HZ1]]) {
      blk(x0, x1, 10.05, 10.6, za, zb, HATCH);
      bx(x1 - x0 - 0.3, 0.2, Math.abs(zb - za) - 0.6, (x0 + x1) / 2, 10.7, (za + zb) / 2, HATCH);
      // container sockets / lashing pads
      for (let x = x0 + 0.6; x < x1; x += 6.1) for (let z = za + 0.4; z < zb; z += 2.52) bx(0.25, 0.04, 0.25, x, 10.82, z, DGREY);
    }
    // cleats / hydraulic jacks on the coaming top edge
    for (let x = x0 + 2; x < x1; x += 4) for (const z of [HZ1 + 0.05, HZ0 - 0.05]) bx(0.3, 0.3, 0.12, x, 10.25, z, DGREY);
    // hatch number on coaming
    col(x0, DECK, HZ0, x1, HTOP, HZ1);
  });
  // fuel hold access trunk (hatch #3)
  {
    const fx = -15, fz = -163;
    blk(fx - 1.6, fx + 1.6, HTOP, HTOP + 1.4, fz - 1.6, fz + 1.6, RED);
    pnt(at(cyl(1.0, 1.0, 0.22, 20), fx, HTOP + 1.52, fz), DGREY);
    pnt(at(new THREE.TorusGeometry(0.42, 0.04, 6, 16), fx, HTOP + 1.85, fz, Math.PI / 2), YEL);
    pnt(at(cyl(0.06, 0.06, 0.35, 6), fx, HTOP + 1.7, fz), YEL);
    // tank vents with goosenecks
    for (const [vx, vz] of [[-20, -160], [-10, -160], [-20, -172], [-10, -172]]) {
      tube(new V(vx, HTOP, vz), new V(vx, HTOP + 1.6, vz), 0.14, WHITE);
      pnt(at(new THREE.TorusGeometry(0.25, 0.14, 6, 10, Math.PI), vx + 0.25, HTOP + 1.6, vz), WHITE);
      tube(new V(vx + 0.5, HTOP + 1.6, vz), new V(vx + 0.5, HTOP + 1.2, vz), 0.17, BLACK);
    }
    SG.push(decal('danger', 2.6, 0.5, fx, HTOP + 0.8, fz + 1.62));
    SG.push(decal('hazard', 3.2, 0.25, fx, HTOP + 0.15, fz + 1.62));
    col(fx - 1.6, HTOP, fz - 1.6, fx + 1.6, HTOP + 1.9, fz + 1.6);
  }
  // containers
  const CL = [12.19, 6.06], CHh = 2.59, CWd = 2.44;
  const palette = [0x2a5d8f, 0x8c2a20, 0x2f6b46, 0xc75a1a, 0x8a8f94, 0xd8d6cf, 0x6b4a2e, 0xc9a227, 0x1f3c66, 0x7a1d3a, 0x3d8fa0, 0xa8432c];
  const inst = [[], []];
  const contStacks = [[0, 4, 0.92], [1, 4, 0.85], [3, 3, 0.85], [4, 5, 0.9]];
  const bayInfo = [];
  for (const [hi, maxH, fill] of contStacks) {
    const [x0, x1] = HATCHES[hi];
    const bays = []; let x = x0 + 0.4;
    while (x1 - x >= CL[0] + 0.3) { bays.push([x, 0]); x += CL[0] + 0.3; }
    while (x1 - x >= CL[1] + 0.3) { bays.push([x, 1]); x += CL[1] + 0.3; }
    const off = (x1 - x) / 2; // centre the bays
    for (const [bx0, kind] of bays) {
      const base = Math.max(1, maxH - Math.floor(rng() * 2));
      for (let rI = 0; rI < 7; rI++) {
        const z = HZ0 + 0.35 + CWd / 2 + rI * (CWd + 0.08);
        // tiered: tall in the middle/far rows, stepping down toward the quay-side walkway
        let h = base - (rI >= 5 ? rI - 4 : 0) - (rng() < 0.3 ? 1 : 0);
        if (rng() > fill) h = 0;
        h = Math.max(0, Math.min(maxH, h));
        if (h) col(bx0 + off, HTOP, z - CWd / 2, bx0 + off + CL[kind], HTOP + h * (CHh + 0.02), z + CWd / 2);
        if (h && rI >= 4) bayInfo.push([bx0 + off, bx0 + off + CL[kind], z, h]);
        for (let l = 0; l < h; l++) {
          const cx = bx0 + off + CL[kind] / 2, cy = HTOP + 0.04 + CHh / 2 + l * (CHh + 0.02);
          inst[kind].push([cx, cy, z, palette[Math.floor(rng() * palette.length)], (rng() - 0.5) * 0.008]);
        }
      }
    }
  }
  const contMeshes = [];
  for (const kind of [0, 1]) {
    if (!inst[kind].length) continue;
    const g = box(CL[kind], CHh, CWd, CHh);
    const im = new THREE.InstancedMesh(g, mCont, inst[kind].length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V(1, 1, 1), c = new THREE.Color();
    inst[kind].forEach(([x, y, z, hex, rot], i) => {
      q.setFromEuler(new THREE.Euler(0, rot, 0));
      im.setMatrixAt(i, m.compose(new V(x, y, z), q, s));
      c.set(hex).multiplyScalar(0.85 + rng() * 0.3); im.setColorAt(i, c);
    });
    im.castShadow = im.receiveShadow = true; im.name = 'containers' + kind;
    root.add(im); contMeshes.push(im);
  }
  // lashing bars on the container ends (silhouette detail between stacks)
  // (a few vertical rods at hatch ends)
  for (const [hi] of contStacks) {
    const [x0, x1] = HATCHES[hi];
    for (let z = HZ0 + 0.6; z < HZ1 - 3; z += 2.52) for (const x of [x0 + 0.2, x1 - 0.2]) { tube(new V(x, HTOP, z), new V(x, HTOP + 5.0, z + 1.1), 0.025, GREY, 4); tube(new V(x, HTOP, z + 2.2), new V(x, HTOP + 5.0, z + 1.1), 0.025, GREY, 4); }
  }

  // lashing rods + turnbuckles crossing the container ends of the rows nearest the walkway
  for (const [x0, x1, z, h] of bayInfo) for (const [xe, sx] of [[x0 - 0.07, -1], [x1 + 0.07, 1]]) {
    const yTop = HTOP + CHh + (h >= 2 ? 0.08 : -0.12);
    for (const s of [-1, 1]) {
      const a = new V(xe, HTOP + 0.05, z - s * 1.0), b = new V(xe + sx * 0.02, yTop, z + s * 1.12);
      const m = new V().lerpVectors(a, b, 0.2);
      tube(a, m, 0.04, YEL, 6);           // turnbuckle
      tube(m, b, 0.022, 0x8d9296, 4);     // rod
      bx(0.1, 0.06, 0.14, xe, HTOP + 0.03, z - s * 1.0, DGREY); // D-ring pad
    }
  }

  // ---------- quay-side walkway detail (x +23 -> -6)
  {
    const zP = -157.42;
    // pipe runs along the inboard edge (fire main red, fuel black w/ yellow bands, grey service line)
    const runs = [[0.16, 9.32, zP, RED], [0.13, 9.62, zP + 0.02, BLACK], [0.08, 9.86, zP + 0.05, GREY]];
    for (const [r, y, z, hex] of runs) {
      tube(new V(-6.5, y, z), new V(36, y, z), r, hex, 10);
      tube(new V(-27, y, z), new V(-6.5, y, z), r, hex, 10);
    }
    for (let x = -26; x < 36; x += 3) { bx(0.1, 0.65, 0.3, x, DECK + 0.32, zP + 0.05, DGREY); for (const [r, y, z] of runs) pnt(at(cyl(r + 0.04, r + 0.04, 0.1, 10), x + 1.5, y, z, 0, 0, Math.PI / 2), DGREY); }
    for (let x = -26; x < 36; x += 6) pnt(at(cyl(0.17, 0.17, 0.3, 10), x + 0.5, 9.62, zP + 0.02, 0, 0, Math.PI / 2), YEL);
    // fuel line jog up into the fuel hold trunk
    line([new V(-6.5, 9.62, zP + 0.02), new V(-10, 9.62, zP + 0.02), new V(-10, 11.2, zP + 0.02), new V(-10, 11.2, -161.2), new V(-13.4, 11.2, -161.2)], 0.13, BLACK, 10);
    line([new V(-6.5, 9.32, zP), new V(-8, 9.32, zP), new V(-8, 11.5, zP), new V(-8, 11.5, -162.6), new V(-13.4, 11.5, -162.6)], 0.1, YEL, 10);
    col(-27, DECK, -157.6, 36, DECK + 1.0, -157.22);
    // mushroom vents (against the bulwark): grey painted trunk, mesh-guarded gap, flat mushroom cap, rust at the joints
    for (const x of [-14.0, -24.0, 30]) {
      const z = -153.9, VG = 0x9da29e, VR = 0x6a3d26;
      pnt(at(cyl(0.25, 0.27, 0.05, 14), x, DECK + 0.025, z), 0x5d6260);              // deck doubler
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pnt(at(cyl(0.022, 0.022, 0.03, 5), x + Math.cos(a) * 0.22, DECK + 0.06, z + Math.sin(a) * 0.22), 0x3a3d3c); }
      pnt(at(cyl(0.15, 0.16, 0.66, 14, true), x, DECK + 0.38, z), VG);                 // trunk
      pnt(at(cyl(0.162, 0.168, 0.1, 14, true), x, DECK + 0.1, z), VR);                 // rust creeping up from the deck
      pnt(at(cyl(0.18, 0.18, 0.04, 14), x, DECK + 0.7, z), VG);                         // top flange
      pnt(at(cyl(0.2, 0.2, 0.13, 14, true), x, DECK + 0.785, z), 0x161718);            // dark gauze screen in the gap
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; bx(0.025, 0.14, 0.025, x + Math.cos(a) * 0.205, DECK + 0.785, z + Math.sin(a) * 0.205, 0x505452); }
      pnt(at(cyl(0.3, 0.3, 0.12, 18, true), x, DECK + 0.905, z), VG);                  // cap skirt
      pnt(at(cyl(0.302, 0.302, 0.03, 18, true), x, DECK + 0.855, z), VR);              // rust along the drip edge
      const dome = new THREE.SphereGeometry(0.3, 18, 4, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.32, 1);
      pnt(at(dome, x, DECK + 0.963, z), VG);
      col(x - 0.4, DECK, -154.3, x + 0.4, DECK + 1.3, -153.4);
    }
    // bitts (double bollards) + chocks
    for (const x of [19.0, 3.5, -20, -45, -66, 32]) {
      bx(1.9, 0.12, 0.65, x, DECK + 0.06, -154.05, BLACK);
      for (const dx of [-0.55, 0.55]) { pnt(at(cyl(0.22, 0.24, 0.75, 12), x + dx, DECK + 0.45, -154.05), BLACK); pnt(at(cyl(0.3, 0.3, 0.06, 12), x + dx, DECK + 0.85, -154.05), BLACK); }
      col(x - 0.95, DECK, -154.4, x + 0.95, DECK + 0.9, -153.7);
    }
    // hose reels + fire stations mounted on the coaming
    for (const x of [8.5, -2.0, 27]) {
      pnt(at(cyl(0.45, 0.45, 0.45, 14), x, 10.4, -157.35, Math.PI / 2), RED);
      pnt(at(cyl(0.3, 0.3, 0.47, 14), x, 10.4, -157.35, Math.PI / 2), BLACK);
      bx(0.08, 1.4, 0.3, x - 0.45, DECK + 0.7, -157.42, DGREY); bx(0.08, 1.4, 0.3, x + 0.45, DECK + 0.7, -157.42, DGREY);
      bx(1.0, 0.08, 0.36, x, DECK + 0.04, -157.42, DGREY);
    }
    for (const x of [4.5, -4.8, 33.5]) {
      bx(0.8, 1.1, 0.35, x, 10.0, -157.55, RED);
      bx(0.7, 0.04, 0.02, x, 10.3, -157.36, WHITE);
      tube(new V(x + 0.7, DECK, -157.3), new V(x + 0.7, DECK + 0.85, -157.3), 0.07, RED);
      pnt(at(cyl(0.12, 0.12, 0.2, 8), x + 0.7, DECK + 0.85, -157.25, Math.PI / 2), RED);
      SG.push(decal('fire', 0.7, 0.35, x, 10.9, -157.37));
    }
    SG.push(decal('nosmoke', 0.7, 0.35, 13.5, 10.6, -157.59));
    SG.push(decal('ppe', 1.6, 0.3, 18.3, 10.55, -157.59));
    SG.push(decal('muster', 0.7, 0.35, 38.7, 10.6, -156.47));
    SG.push(decal('nosmoke', 0.7, 0.35, -9.5, 10.6, -157.59));
    // walkway overlay (unique texture: seams, green non-slip, wear lane, rust, yellow safety edges, hazard zones, stencils)
    {
      const nx = 88, g = new THREE.PlaneGeometry(WALK.X1 - WALK.X0, WALK.ZB - WALK.ZI, nx, 1);
      g.rotateX(-Math.PI / 2); g.translate((WALK.X0 + WALK.X1) / 2, DECK + 0.004, (WALK.ZB + WALK.ZI) / 2);
      const p = g.attributes.position, uvA = g.attributes.uv;
      for (let i = 0; i < p.count; i++) { const [u, w] = walkT.uv(p.getX(i), p.getZ(i)); uvA.setXY(i, u, w); }
      WALKG.push(g);
    }
    // coaming top flat bar + hatch numbers on the pontoon skirts facing the walkway
    for (const [x0, x1] of [[-50.5, -27], [-24, -6], [-3, 15], [20.5, 36]]) bx(x1 - x0 - 0.5, 0.06, 0.14, (x0 + x1) / 2, 10.06, -157.83, 0x7b8682);
    for (const [hi, xm] of [[2, -38.75], [3, -15], [4, 6], [5, 28.25]]) { SG.push(decal('hn' + hi, 0.55, 0.42, xm - 3.5, 10.34, -157.585)); SG.push(decal('hn' + hi, 0.55, 0.42, xm + 3.5, 10.34, -157.585)); }
    // lashing cage + gear bin near crane B
    blk(13.5, 14.8, DECK, DECK + 1.0, -157.4, -156.8, YEL);
    // deck light posts on the railing
    for (const x of [-18, -30, -44, -58, -72, 34]) {
      const z = -153.2;
      tube(new V(x, 9.35, z), new V(x, 12.6, z), 0.06, WHITE, 6);
      tube(new V(x, 12.6, z), new V(x, 12.6, z - 0.6), 0.05, WHITE, 6);
      bx(0.45, 0.3, 0.35, x, 12.5, z - 0.7, DGREY);
      lamp(x, 12.33, z - 0.7, 0.3);
    }
    // far side posts
    for (const x of [-60, -30, 0, 28]) { tube(new V(x, 9.35, -179.8), new V(x, 12.6, -179.8), 0.06, WHITE, 6); bx(0.45, 0.3, 0.35, x, 12.5, -179.2, DGREY); lamp(x, 12.33, -179.2, 0.3); }
  }

  // ---------- fuel bunker manifold (own object)
  const manifoldObj = new THREE.Group(); manifoldObj.name = 'fuelManifold';
  const beaconGlows = [], beaconRef = {};
  manifoldObj.position.set(-6, DECK, -155.5);
  {
    const MP = [], MS = [];
    const mp = (g, hex) => { const c = C(hex); tint(g, c.r, c.g, c.b); MP.push(g); return g; };
    const mbx = (w, h, d, x, y, z, hex, rx = 0, ry = 0, rz = 0) => mp(at(box(w, h, d, 2), x, y, z, rx, ry, rz), hex);
    const mtube = (a, b, r, hex, seg = 12) => mp(tubeG(a, b, r, seg, false), hex);
    const flange = (p, axis, r, hex = RED) => mp(at(cyl(r, r, 0.09, 16), p.x, p.y, p.z, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0), hex);
    // drip tray w/ hazard edge
    mbx(2.9, 0.22, 2.0, 0, 0.11, 0, DGREY);
    mbx(2.7, 0.02, 1.8, 0, 0.23, 0, 0x101010);
    MS.push(decal('hazard', 2.9, 0.2, 0, 0.11, 1.002), decal('hazard', 2.9, 0.2, 0, 0.11, -1.002, Math.PI), decal('hazard', 2.0, 0.2, 1.452, 0.11, 0, Math.PI / 2), decal('hazard', 2.0, 0.2, -1.452, 0.11, 0, -Math.PI / 2));
    // header pipe from the deck fuel line
    mtube(new V(-1.35, 0.55, -0.7), new V(1.35, 0.55, -0.7), 0.17, RED);
    flange(new V(-1.35, 0.55, -0.7), 'x', 0.26); flange(new V(1.35, 0.55, -0.7), 'x', 0.26);
    mtube(new V(-1.35, 0.55, -0.7), new V(-1.35, 0.55, -1.9), 0.15, BLACK);
    mtube(new V(-1.35, 0.25, -1.9), new V(-1.35, 0.55, -1.9), 0.15, BLACK);
    for (const [bxp, hex] of [[-0.75, RED], [0.75, YEL]]) {
      // riser
      mtube(new V(bxp, 0.55, -0.7), new V(bxp, 1.15, -0.7), 0.14, hex);
      flange(new V(bxp, 0.85, -0.7), 'y', 0.24, hex);
      // elbow + outboard spool to presentation flange
      mp(at(new THREE.SphereGeometry(0.16, 10, 8), bxp, 1.15, -0.7), hex);
      mtube(new V(bxp, 1.15, -0.7), new V(bxp, 1.15, 0.85), 0.14, hex);
      flange(new V(bxp, 1.15, 0.85), 'z', 0.3, hex);
      flange(new V(bxp, 1.15, 0.95), 'z', 0.3, DGREY);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; mp(at(cyl(0.025, 0.025, 0.25, 5), bxp + Math.cos(a) * 0.24, 1.15 + Math.sin(a) * 0.24, 0.9, Math.PI / 2), 0xb0b0b0); }
      // gate valve with bonnet + hand-wheel
      mp(at(cyl(0.24, 0.24, 0.42, 12), bxp, 1.15, 0.15, Math.PI / 2), hex);
      flange(new V(bxp, 1.15, -0.08), 'z', 0.28, hex); flange(new V(bxp, 1.15, 0.38), 'z', 0.28, hex);
      mtube(new V(bxp, 1.15, 0.15), new V(bxp, 1.75, 0.15), 0.1, hex);
      mtube(new V(bxp, 1.75, 0.15), new V(bxp, 1.95, 0.15), 0.03, 0xc8c8c8);
      mp(at(new THREE.TorusGeometry(0.3, 0.035, 6, 20), bxp, 1.95, 0.15, Math.PI / 2), YEL);
      for (let k = 0; k < 3; k++) mbx(0.6, 0.03, 0.03, bxp, 1.95, 0.15, YEL, 0, k * Math.PI / 3, 0);
      // pressure gauge
      mtube(new V(bxp + 0.25, 1.15, 0.6), new V(bxp + 0.25, 1.45, 0.6), 0.025, 0xc8c8c8, 6);
      mp(at(cyl(0.1, 0.1, 0.06, 12), bxp + 0.25, 1.5, 0.6, Math.PI / 2), WHITE);
      // support stools
      mbx(0.12, 1.0, 0.12, bxp, 0.6, 0.6, DGREY);
    }
    // sampling cock + drain + small cabinet
    mbx(0.6, 0.8, 0.35, 1.25, 0.65, -0.6, RED);
    mbx(0.5, 0.04, 0.02, 1.25, 0.85, -0.42, WHITE);
    // sign on a post frame (inboard, facing the quay)
    mbx(0.08, 2.2, 0.08, -1.05, 1.1, -0.95, DGREY); mbx(0.08, 2.2, 0.08, 1.05, 1.1, -0.95, DGREY);
    mbx(2.2, 0.62, 0.04, 0, 1.75, -0.98, DGREY);
    MS.push(decal('fuel', 2.1, 0.52, 0, 1.75, -0.955));
    // bunker hose: coupled to the port presentation flange, laid along the tray and coiled (not yet run ashore)
    const hosePts = [new V(-0.75, 1.15, 1.02), new V(-0.8, 0.75, 1.3), new V(-0.6, 0.36, 1.25), new V(0.2, 0.33, 1.05), new V(0.95, 0.33, 0.75), new V(1.05, 0.33, 0.4)];
    mp(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 24, 0.1, 8), BLACK);
    { const p = new THREE.CatmullRomCurve3(hosePts).getPoint(0.04); mp(at(cyl(0.17, 0.17, 0.2, 10), p.x, p.y, p.z, Math.PI / 2), 0x9a9a9a); }
    mp(at(new THREE.TorusGeometry(0.45, 0.1, 6, 18), 0.6, 0.34, 0.4, Math.PI / 2), BLACK);
    mp(at(new THREE.TorusGeometry(0.45, 0.1, 6, 18), 0.6, 0.48, 0.4, Math.PI / 2), BLACK);
    mp(at(cyl(0.15, 0.15, 0.12, 10), 0.6, 0.58, 0.4), 0x9a9a9a); // blanked hose end
    // warning beacons on short posts above the sign frame + extra signage facing the approach (+x) and the quay
    const BEAC = [];
    for (const [px, pz] of [[1.05, -0.95], [-1.05, -0.95]]) {
      mbx(0.07, 0.55, 0.07, px, 2.47, pz, DGREY);
      mp(at(cyl(0.13, 0.13, 0.06, 12), px, 2.77, pz), DGREY);                 // base
      mp(at(cyl(0.12, 0.12, 0.03, 12), px, 3.04, pz), DGREY);                 // cap
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; mbx(0.018, 0.26, 0.018, px + Math.cos(a) * 0.115, 2.92, pz + Math.sin(a) * 0.115, DGREY); }
      mp(at(cyl(0.02, 0.02, 0.06, 6), px, 3.08, pz), DGREY);
      const lens = at(cyl(0.095, 0.095, 0.22, 14), px, 2.91, pz); BEAC.push(lens);
      BEAC.push(at(new THREE.SphereGeometry(0.095, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2), px, 3.02, pz));
    }
    const mbm = new THREE.Mesh(merge(BEAC), mBeacon); mbm.name = 'manifoldBeacon'; manifoldObj.add(mbm);
    const glowMat = new THREE.SpriteMaterial({ map: beaconGlowTexture(), color: 0xff5a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    for (const [px, pz] of [[1.05, -0.95], [-1.05, -0.95]]) { const sp = new THREE.Sprite(glowMat); sp.position.set(px, 2.93, pz); sp.scale.setScalar(1.4); sp.name = 'beaconGlow'; manifoldObj.add(sp); beaconGlows.push(sp); }
    beaconRef.mat = glowMat;
    // signs on the +x face of the frame (seen walking down the deck from the gangway) and the quay face
    mbx(0.04, 1.0, 1.0, 1.11, 1.58, -0.6, DGREY);
    MS.push(decal('fuelword', 0.92, 0.46, 1.135, 1.82, -0.6, Math.PI / 2));
    MS.push(decal('flam', 0.34, 0.34, 1.135, 1.3, -0.6, Math.PI / 2));
    MS.push(decal('danger', 2.1, 0.4, 0, 1.22, -0.955));
    MS.push(decal('fuelword', 0.6, 0.3, 0, 1.75, -1.005, Math.PI));
    mbx(2.2, 0.5, 0.04, 0, 1.22, -0.98, DGREY);
    // hazard bands on the frame posts
    for (const px of [-1.05, 1.05]) for (let k = 0; k < 4; k++) mbx(0.085, 0.1, 0.085, px, 0.15 + k * 0.22, -0.95, k % 2 ? BLACK : YEL);
    // stanchion barrier posts with hazard paint
    for (const [x, z] of [[-1.6, 0.9], [1.6, 0.9]]) { mp(at(cyl(0.05, 0.05, 1.0, 6), x, 0.5, z), YEL); mp(at(cyl(0.055, 0.055, 0.2, 6), x, 0.6, z), BLACK); }
    const mpm = new THREE.Mesh(merge(MP), mPaint); mpm.castShadow = mpm.receiveShadow = true; manifoldObj.add(mpm);
    const msm = new THREE.Mesh(merge(MS), mSign); manifoldObj.add(msm);
  }
  root.add(manifoldObj);
  col(-7.45, DECK, -156.5, -4.55, DECK + 2.0, -154.5);

  // ---------- deck cranes
  const jibPivot = {};
  const cranes = [[-53.25, ZC, Math.PI, 0.22], [17.75, ZC, Math.PI * 0.42, 0.95]];
  for (const [cx, cz, yaw, el] of cranes) {
    pnt(at(cyl(1.55, 1.8, 7.5, 18), cx, DECK + 3.75, cz), CRANE);
    pnt(at(cyl(1.9, 1.9, 0.3, 18), cx, DECK + 7.6, cz), DGREY);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; bx(0.06, 1.2, 0.6, cx + Math.cos(a) * 1.75, DECK + 0.6, cz + Math.sin(a) * 1.75, CRANE, 0, -a, 0); }
    // slewing house (oriented by yaw), cab, A-frame
    const hy = DECK + 7.75, ca = Math.cos(yaw), sa = Math.sin(yaw);
    const R = (lx, lz) => [cx + lx * ca + lz * sa, cz - lx * sa + lz * ca]; // local x forward (jib dir)
    {
      const [hx, hz] = R(-0.6, 0);
      bx(6.0, 3.6, 4.4, hx, hy + 1.8, hz, CRANE, 0, yaw, 0);
      bx(6.1, 0.18, 4.5, hx, hy + 3.65, hz, DGREY, 0, yaw, 0);
      const [kx, kz] = R(1.6, 2.6);
      bx(1.8, 2.0, 1.4, kx, hy + 2.2, kz, CRANE, 0, yaw, 0);
      const [gx, gz] = R(2.52, 2.6);
      GL.push(at(box(0.04, 1.2, 1.2), gx, hy + 2.5, gz, 0, yaw, 0));
      // A-frame
      for (const s of [-1, 1]) {
        const [ax, az] = R(-2.2, s * 1.6), [tx, tz] = R(-1.2, s * 0.4);
        tube(new V(ax, hy + 3.6, az), new V(tx, hy + 7.4, tz), 0.16, CRANE, 8);
      }
      const [ex, ez] = R(-1.2, 0); bx(0.5, 0.5, 1.4, ex, hy + 7.4, ez, CRANE, 0, yaw, 0);
      // floodlights on the house roof
      const [lx1, lz1] = R(2.4, -1.6), [lx2, lz2] = R(2.4, 1.6);
      bx(0.4, 0.35, 0.4, lx1, hy + 4.0, lz1, DGREY); bx(0.4, 0.35, 0.4, lx2, hy + 4.0, lz2, DGREY);
      lamp(lx1, hy + 4.0, lz1, 0.28); lamp(lx2, hy + 4.0, lz2, 0.28);
      SG.push(at(decal('swl', 1.6, 0.6, 0, 0, 0), ...R(0.5, 2.21).flatMap((v, i) => (i === 0 ? [v, hy + 1.3] : [v])), 0, yaw, 0));
      // jib: box section from heel to tip (the raised crane's jib is its own mesh so setBurnt can drop it)
      const [jx, jz] = R(2.2, 0), heel = new V(jx, hy + 1.6, jz);
      if (el > 0.5) { SINK = JIB; jibPivot.heel = heel.clone(); jibPivot.axis = new V(-sa, 0, -ca); }
      const L = 26, dir = new V(Math.cos(el) * ca, Math.sin(el), -Math.cos(el) * sa);
      const tip = heel.clone().addScaledVector(dir, L);
      for (const s of [-1, 1]) {
        const off = new V(-sa, 0, -ca).multiplyScalar(0.55 * s);
        const h2 = heel.clone().add(off), t2 = tip.clone().add(off.clone().multiplyScalar(0.45));
        const d = new V().subVectors(t2, h2), len = d.length();
        const g = at(box(len, 1.0, 0.18, 4), 0, 0, 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(1, 0, 0), d.clone().normalize()));
        g.translate((h2.x + t2.x) / 2, (h2.y + t2.y) / 2, (h2.z + t2.z) / 2);
        pnt(g, CRANE);
      }
      // lacing between the jib sides
      for (let k = 1; k < 10; k++) { const p = heel.clone().addScaledVector(dir, L * k / 10); const off = new V(-sa, 0, -ca).multiplyScalar(0.55 * (1 - 0.55 * k / 10)); tube(p.clone().sub(off), p.clone().add(off), 0.06, CRANE, 4); }
      // jib head + sheaves
      pnt(at(cyl(0.45, 0.45, 0.5, 12), tip.x, tip.y, tip.z, Math.PI / 2, yaw, 0), DGREY);
      // topping wire from A-frame apex to jib head, hoist wire down to the hook
      const apex = new V(ex, hy + 7.4, ez);
      tube(apex, tip, 0.04, 0x222222, 4); tube(apex.clone().add(new V(0, -0.3, 0)), tip.clone().add(new V(0, -0.3, 0)), 0.04, 0x222222, 4);
      const hookY = el > 0.5 ? DECK + 14 : tip.y - 2.5;
      tube(tip, new V(tip.x, hookY + 0.6, tip.z), 0.035, 0x222222, 4);
      bx(0.6, 0.9, 0.35, tip.x, hookY + 0.15, tip.z, YEL);
      pnt(at(new THREE.TorusGeometry(0.22, 0.06, 6, 10, Math.PI * 1.3), tip.x, hookY - 0.45, tip.z), DGREY);
      if (el < 0.5) { // jib rest
        const rp = heel.clone().addScaledVector(dir, 17);
        tube(new V(rp.x, HTOP, rp.z), new V(rp.x, rp.y - 0.5, rp.z), 0.15, CRANE, 8);
      }
      SINK = P;
      lights.push(tip.clone().add(new V(0, -0.6, 0)));
    }
    col(cx - 1.85, DECK, cz - 1.85, cx + 1.85, DECK + 11.4, cz + 1.85);
  }

  // ---------- forecastle gear + foremast + anchors
  {
    const y = FC_DECK;
    for (const s of [-1, 1]) {
      const z = ZC + s * 2.6, x = -86.5;
      bx(2.2, 0.9, 1.8, x, y + 0.45, z, DGREY);
      pnt(at(cyl(0.75, 0.75, 0.35, 16), x, y + 1.3, z + s * 0.3, Math.PI / 2), BLACK);
      pnt(at(cyl(0.5, 0.5, 1.1, 14), x, y + 1.1, z - s * 0.6, Math.PI / 2), RED);
      pnt(at(cyl(0.62, 0.62, 0.08, 14), x, y + 1.1, z - s * 1.15, Math.PI / 2), BLACK);
      bx(0.6, 0.8, 0.6, x + 1.2, y + 0.6, z, GREY);
      // anchor chain from gypsy forward to the hawse pipe
      const hx = -90.6, hz = ZC + s * (hbAt(-90.6, y) - 1.2);
      const a = new V(x - 0.4, y + 1.4, z + s * 0.3), b = new V(hx, y + 0.2, hz);
      const n = 14;
      for (let k = 0; k < n; k++) { const p = new V().lerpVectors(a, b, (k + 0.5) / n); const d = new V().subVectors(b, a); const ry = -Math.atan2(d.z, d.x); bx(0.32, k % 2 ? 0.06 : 0.2, k % 2 ? 0.2 : 0.06, p.x, p.y, p.z, 0x2a2826, 0, ry, 0); }
      pnt(at(cyl(0.5, 0.55, 0.3, 14), hx, y + 0.15, hz), DGREY);
      bx(1.0, 0.5, 0.6, x - 1.8, y + 0.25, z + s * 0.4, DGREY);
      // mooring winch drums
      pnt(at(cyl(0.55, 0.55, 1.4, 14), -83.3, y + 0.85, ZC + s * 5.2, Math.PI / 2), 0x8a7452);
      for (const dz of [-0.75, 0.75]) pnt(at(cyl(0.75, 0.75, 0.08, 14), -83.3, y + 0.85, ZC + s * 5.2 + dz, Math.PI / 2), RED);
      bx(1.2, 0.6, 2.0, -83.3, y + 0.3, ZC + s * 5.2, DGREY);
      // bitts near the bulwark
      for (const bxp of [-92, -88.5, -84]) {
        const zz = ZC + s * (hbAt(bxp, y) - 0.7);
        for (const dx of [-0.45, 0.45]) pnt(at(cyl(0.2, 0.22, 0.7, 10), bxp + dx, y + 0.35, zz), BLACK);
        col(bxp - 0.7, y, zz - 0.3, bxp + 0.7, y + 0.8, zz + 0.3);
      }
      // anchors stowed in the pockets (hull side)
      const ax = -88.6, ay = 8.1, az = ZC + s * (hbAt(ax, ay) + 0.12);
      const ry = s * 0.32;
      bx(0.35, 2.2, 0.3, ax, ay - 0.6, az, 0x141414, 0, ry, 0);
      bx(1.8, 0.45, 0.4, ax, ay - 1.75, az, 0x141414, 0, ry, 0);
      bx(0.5, 0.8, 0.42, ax - 0.75, ay - 1.45, az, 0x141414, 0, ry, 0.5);
      bx(0.5, 0.8, 0.42, ax + 0.75, ay - 1.45, az, 0x141414, 0, ry, -0.5);
    }
    // foremast with lamp
    const mx = -91.2;
    tube(new V(mx, y, ZC), new V(mx, y + 10.5, ZC), 0.22, WHITE, 10);
    bx(0.2, 0.2, 2.8, mx, y + 7.2, ZC, WHITE);
    bx(1.4, 0.1, 1.4, mx + 0.3, y + 6.0, ZC, WHITE);
    railing(mx - 0.4, ZC - 0.7, mx + 1.0, ZC - 0.7, y + 6.05, 0.7, 0.7, WHITE);
    railing(mx - 0.4, ZC + 0.7, mx + 1.0, ZC + 0.7, y + 6.05, 0.7, 0.7, WHITE);
    pnt(at(cyl(0.22, 0.22, 0.4, 10), mx, y + 10.75, ZC), DGREY);
    lamp(mx, y + 10.5, ZC, 0.3);
    lamp(mx + 0.25, y + 6.4, ZC - 0.5, 0.25); lamp(mx + 0.25, y + 6.4, ZC + 0.5, 0.25);
    lights.push(new V(mx, y + 11.1, ZC));
    // bell + small breakwater ahead of hatch 1
    pnt(at(cyl(0.18, 0.28, 0.35, 10), mx + 0.6, y + 6.6, ZC + 0.9), YEL);
    // forecastle bulwark stays
    for (let x = -94; x < FC_X; x += 1.2) for (const s of [-1, 1]) { const hb = hbAt(x, y + 0.5) - 0.3; bx(0.06, 1.0, 0.25, x, y + 0.5, ZC + s * hb, 0xc9c8c0, 0, -s * 0.15 * clamp01((-80 - x) / 14), 0); }
    walk.push({ type: 'box', min: [-92.5, ZC - 9], max: [FC_X, ZC + 9], y: FC_DECK });
  }

  // ---------- stern superstructure
  const SX0 = 40, SX1 = 57, funnelPivot = new V();
  {
    // tier 0 (decks A, B), tier 1 (C, D, E), bridge
    blk(SX0, SX1, DECK, 14.6, -176.5, -156.5, WHITE);
    blk(41.5, 56, 14.6, 23.0, -175.0, -158.0, WHITE);
    blk(42.5, 50, 23.0, 26.2, -176.5, -156.5, WHITE);
    // deck lips / eyebrows at each level
    for (let k = 1; k <= 5; k++) {
      const y = DECK + 2.8 * k;
      if (k <= 2) { blk(SX0 - 0.3, SX1 + 0.3, y - 0.18, y, -176.8, -156.2, 0xd8d4c9); }
      else blk(41.2, 56.3, y - 0.18, y, -176.2, -156.8, 0xd8d4c9);
    }
    // side walkways of tier 1 get railings
    for (const y of [14.6, 17.4, 20.2]) {
      const zq = y === 14.6 ? -156.6 : -156.9, zf = y === 14.6 ? -176.4 : -176.1;
      railing(SX0 + (y === 14.6 ? 0 : 1.3), zq, (y === 14.6 ? SX1 : 56.2), zq, y, 1.0, 1.4, WHITE);
      railing(SX0 + (y === 14.6 ? 0 : 1.3), zf, (y === 14.6 ? SX1 : 56.2), zf, y, 1.0, 1.4, WHITE);
      if (y === 14.6) railing(SX0 - 0.2, zf, SX0 - 0.2, zq, y, 1.0, 1.4, WHITE);
    }
    // eyebrows over windows on the front + sides
    for (let k = 0; k < 5; k++) {
      const y = DECK + 2.8 * k + 2.25, fx = k < 2 ? SX0 : 41.5, zq = k < 2 ? -156.5 : -158, zf = k < 2 ? -176.5 : -175;
      bx(0.35, 0.06, Math.abs(zq - zf), fx - 0.17, y, (zq + zf) / 2, 0xd8d4c9);
    }
    // windows
    const win = (x, y, z, ry, lit) => {
      const g = at(new THREE.PlaneGeometry(1.05, 0.85), x, y, z, 0, ry, 0);
      (lit ? LIT : GL).push(g);
      const nrm = new V(Math.sin(ry), 0, Math.cos(ry));
      pnt(at(new THREE.PlaneGeometry(1.3, 1.1), x - nrm.x * 0.012, y, z - nrm.z * 0.012, 0, ry, 0), 0x9a9c98);
    };
    for (let k = 0; k < 5; k++) {
      const y = DECK + 2.8 * k + 1.55;
      const fx = k < 2 ? SX0 : 41.5, ax = k < 2 ? SX1 : 56, zq = k < 2 ? -156.5 : -158, zf = k < 2 ? -176.5 : -175;
      for (let z = zf + 1.4; z < zq - 1.0; z += 2.2) win(fx - 0.03, y, z, -Math.PI / 2, rng() < 0.62);
      for (let x = fx + 1.4; x < ax - 1.0; x += 2.3) {
        if (!(k === 0 && x > 50.5)) win(x, y, zq + 0.03, 0, rng() < 0.6);
        win(x, y, zf - 0.03, Math.PI, rng() < 0.6);
      }
      for (let z = zf + 2; z < zq - 1.5; z += 3.4) win(ax + 0.03, y, z, Math.PI / 2, rng() < 0.4);
    }
    // doors on deck A
    for (const [x, z, ry] of [[SX0 - 0.03, -160, -Math.PI / 2], [SX0 - 0.03, -173, -Math.PI / 2], [52, -156.47, 0]]) {
      pnt(at(new THREE.PlaneGeometry(0.95, 2.0), x, DECK + 1.0, z, 0, ry, 0), 0x5a5f62);
    }
    SG.push(decal('lifeboat', 1.2, 0.4, 45, 15.5, -157.97));
    SG.push(decal('imo', 3.2, 0.6, 49, 12.5, -156.47));
    SG.push(decal('imo', 3.2, 0.6, 49, 12.5, -176.53, Math.PI));
    // bridge: wrap windows (raked band), roof with visor, wings
    {
      const yb = 23.0;
      for (let z = -175.9; z < -156.9; z += 1.55) { const g = at(new THREE.PlaneGeometry(1.45, 1.35), 42.5 - 0.12, yb + 1.85, z + 0.75, 0.0, -Math.PI / 2, 0); g.rotateZ(0); GL.push(g); }
      for (let x = 43.0; x < 49.6; x += 1.55) { GL.push(at(new THREE.PlaneGeometry(1.45, 1.35), x + 0.75, yb + 1.85, -156.47, 0, 0, 0)); GL.push(at(new THREE.PlaneGeometry(1.45, 1.35), x + 0.75, yb + 1.85, -176.53, 0, Math.PI, 0)); }
      bx(0.12, 0.1, 20, 42.4, yb + 1.1, ZC, 0xd8d4c9); bx(0.12, 0.1, 20, 42.4, yb + 2.6, ZC, 0xd8d4c9);
      blk(41.8, 50.7, 26.2, 26.45, -177.2, -155.8, 0xd8d4c9);
      SG.push(decal('name', 4.2, 0.7, 42.38, 26.0, ZC, -Math.PI / 2));
      // wings
      for (const [z0, z1, s] of [[-156.5, -153.35, 1], [-176.5, -179.65, -1]]) {
        blk(42.5, 46.5, yb - 0.25, yb, z0, z1, 0xd8d4c9);
        blk(42.5, 46.5, yb, yb + 1.15, z1 - s * 0.1, z1, WHITE); // wind dodger at the wing end
        railing(42.6, z0, 42.6, z1, yb, 1.15, 1.0, WHITE);
        railing(46.4, z0, 46.4, z1, yb, 1.15, 1.0, WHITE);
        bx(0.6, 1.1, 0.6, 43.3, yb + 0.55, z1 - s * 0.6, 0x9a9c98); // wing console
        for (const x of [43, 46]) tube(new V(x, yb - 2.6, z0), new V(x, yb - 0.2, z1 - s * 0.4), 0.09, WHITE, 6);
        lamp(42.7, yb + 1.4, z1 - s * 0.25, 0.3);
        pnt(at(cyl(0.18, 0.18, 0.4, 8), 44.5, yb + 1.45, z1 - s * 0.3), DGREY); // searchlight
      }
      railing(41.9, -177.1, 41.9, -155.9, 26.45, 0.9, 1.5, WHITE);
      railing(41.9, -155.9, 50.6, -155.9, 26.45, 0.9, 1.5, WHITE);
      railing(41.9, -177.1, 50.6, -177.1, 26.45, 0.9, 1.5, WHITE);
      // satcom domes + whip antennas + horn
      pnt(at(new THREE.SphereGeometry(0.75, 14, 10), 49.6, 27.6, -160, 0, 0, 0), WHITE); tube(new V(49.6, 26.45, -160), new V(49.6, 27.0, -160), 0.3, WHITE);
      pnt(at(new THREE.SphereGeometry(0.55, 12, 8), 49.6, 27.3, -173), WHITE); tube(new V(49.6, 26.45, -173), new V(49.6, 26.8, -173), 0.25, WHITE);
      for (const [x, z, h] of [[50.2, -157, 5], [50.2, -176, 5.5], [44, -158, 3.5], [44, -175, 3.5], [49, -166.5 + 3.2, 4]]) tube(new V(x, 26.45, z), new V(x, 26.45 + h, z), 0.03, LGREY, 4);
      tube(new V(46, 26.45, -164), new V(46, 27.2, -164), 0.06, GREY); pnt(at(cyl(0.12, 0.3, 0.7, 10), 46.35, 27.2, -164, 0, 0, Math.PI / 2), GREY);
    }
    // radar mast
    {
      const mx = 47.6;
      blk(mx - 0.35, mx + 0.35, 26.45, 32.6, ZC - 0.35, ZC + 0.35, WHITE);
      for (const s of [-1, 1]) tube(new V(mx + 1.6, 26.45, ZC + s * 1.8), new V(mx, 30.6, ZC + s * 0.3), 0.12, WHITE, 6);
      blk(mx - 2.2, mx + 0.6, 29.0, 29.15, ZC - 1.1, ZC + 1.1, WHITE); // scanner platform (fwd)
      railing(mx - 2.2, ZC - 1.1, mx - 2.2, ZC + 1.1, 29.15, 0.7, 0.8, WHITE);
      bx(0.2, 0.2, 7.5, mx + 0.1, 31.2, ZC, WHITE); // yardarm
      for (const s of [-1, 1]) { lamp(mx + 0.1, 31.0, ZC + s * 3.6, 0.22); tube(new V(mx + 0.1, 31.2, ZC + s * 3.6), new V(mx + 7, 26.5, ZC + s * 1.5), 0.012, 0x333333, 3); }
      blk(mx - 0.8, mx + 0.8, 32.6, 32.75, ZC - 0.8, ZC + 0.8, WHITE);
      tube(new V(mx, 32.75, ZC), new V(mx, 35.6, ZC), 0.08, WHITE, 6);
      lamp(mx, 35.7, ZC, 0.24); lamp(mx, 34.3, ZC, 0.2);
      // signal halyards (thin lines, nice backlit)
      for (const s of [-1, 1]) tube(new V(mx + 0.1, 31.2, ZC + s * 3.0), new V(mx - 4.5, 26.5, ZC + s * 2.5), 0.012, 0x333333, 3);
      lights.push(new V(mx, 35.9, ZC));
    }
    // external stairs (zig-zag) — tier 0 quay side and tier 1 quay side
    const flight = (xa, ya, xb, yb, z0, z1) => {
      const L = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa);
      for (const z of [z0 + 0.04, z1 - 0.04]) {
        const g = at(box(L, 0.22, 0.05, 4), (xa + xb) / 2, (ya + yb) / 2, z, 0, 0, ang); pnt(g, DGREY);
        tube(new V(xa, ya + 0.95, z), new V(xb, yb + 0.95, z), 0.03, WHITE, 4);
        for (const t of [0.15, 0.5, 0.85]) tube(new V(lerp(xa, xb, t), lerp(ya, yb, t), z), new V(lerp(xa, xb, t), lerp(ya, yb, t) + 0.95, z), 0.025, WHITE, 4);
      }
      const n = Math.round((yb - ya) / 0.25);
      for (let i = 1; i < n; i++) { const t = i / n; bx(0.24, 0.035, Math.abs(z1 - z0) - 0.1, lerp(xa, xb, t), lerp(ya, yb, t), (z0 + z1) / 2, GREY); }
    };
    flight(52.5, DECK, 55.3, 11.8, -156.45, -155.55); blk(55.3, 56.6, 11.62, 11.8, -156.45, -155.55, DGREY);
    flight(55.3, 11.8, 52.5, 14.6, -156.45, -155.55); railing(55.3, -155.55, 56.6, -155.55, 11.8, 1.0, 0.7, WHITE);
    col(52.4, DECK, -156.5, 56.7, 14.6, -155.5);
    for (let k = 0; k < 3; k++) { const y0 = 14.6 + 2.8 * k, a = k % 2 ? 50.5 : 47.5, b = k % 2 ? 47.5 : 50.5; flight(a, y0, b, y0 + 2.8, -157.95, -157.0); }
    // funnel casing + funnel (raked) with star band
    blk(53.5, 62, 23.0, 24.6, -169.5, -163.5, WHITE);
    blk(56, 63.5, DECK, 23.0, -170.5, -162.5, WHITE);
    const rake = 0.09, fx0 = 58.2;
    const fxAt = (y) => fx0 + (y - 24.6) * Math.tan(rake);
    const seg = (y0, y1, hex, sc = 1) => {
      const h = y1 - y0, g = cyl(1.0 * sc, 1.06 * sc, h, 22);
      g.scale(3.4, 1, 2.6); g.rotateZ(-rake);
      g.translate(fx0 + ((y0 + y1) / 2 - 24.6) * Math.tan(rake), (y0 + y1) / 2, ZC);
      pnt(g, hex);
    };
    seg(24.6, 28.6, NAVY); seg(28.6, 31.6, WHITE, 1.01); seg(31.6, 34.6, NAVY);
    SINK = FTOP; seg(34.6, 36.4, BLACK, 1.0);
    pnt(at(cyl(3.2, 3.2, 0.2, 22).scale(1.08, 1, 0.83), fxAt(36.4), 36.45, ZC), DGREY);
    for (const s of [-1, 1]) { const g = decal('star', 2.6, 2.6, fxAt(30.1), 30.1, ZC + s * 2.64, s > 0 ? 0 : Math.PI); g.rotateZ(0); SG.push(g); }
    for (const [dx, dz, r] of [[-0.8, -0.9, 0.38], [-0.8, 0.9, 0.38], [0.9, 0, 0.5]]) tube(new V(fxAt(36) + dx, 36.0, ZC + dz), new V(fxAt(37.6) + dx, 37.6, ZC + dz), r, BLACK, 10);
    SINK = P; funnelPivot.set(fxAt(34.6), 34.6, ZC);
    // lifeboats on davits (quay + far side)
    for (const s of [1, -1]) {
      const z = s > 0 ? -155.0 : -178.0, yb = 16.3, xb = 48.5;
      // enclosed lifeboat: lofted hull (white bottom, orange topsides), canopy with windows, conning hatch, hook blocks
      for (const [g, hex] of lifeboatParts(xb, yb, z, 7.6, 2.5)) { if (hex === null) SINK.push(g); else pnt(g, hex); }
      SG.push(decal('lifeboat', 1.1, 0.3, xb - 0.6, yb - 0.24, z + s * 1.25, s > 0 ? 0 : Math.PI));
      for (const dx of [-2.6, 2.6]) {
        bx(0.35, 4.5, 0.35, xb + dx, 14.6 + 2.25, z - s * 1.4, WHITE);
        tube(new V(xb + dx, 18.8, z - s * 1.4), new V(xb + dx, 18.8, z + s * 0.1), 0.17, WHITE, 6);
        tube(new V(xb + dx, 18.8, z), new V(xb + dx, yb + 1.2, z), 0.02, 0x222222, 3);
      }
    }
    // liferaft canisters
    for (const [x, z] of [[41.3, -157.2], [41.3, -175.8]]) for (let k = 0; k < 2; k++) { pnt(at(cyl(0.33, 0.33, 1.25, 12), x + k * 0.8, 15.05, z, Math.PI / 2), WHITE); bx(0.7, 0.12, 1.2, x + k * 0.8, 14.7, z, DGREY); }
    // louvres / vents on the casing
    for (const z of [-162.4, -170.6]) for (const x of [57.5, 60, 62.5]) pnt(at(box(1.6, 1.2, 0.08, 1), x, 21, z), 0x9a9c98);
    // floodlights on the superstructure front
    for (const z of [-158, -175]) { bx(0.4, 0.35, 0.4, 41.2, 22.6, z, DGREY); lamp(40.95, 22.55, z, 0.3); }
    for (const z of [-157.5, -175.5]) { bx(0.4, 0.35, 0.4, 39.8, 14.3, z, DGREY); lamp(39.6, 14.2, z, 0.3); }
    col(SX0, DECK, -176.5, SX1, 14.6, -156.5);
    col(41.5, 14.6, -175, 56, 23, -158);
    col(42.5, 23, -176.5, 50, 26.5, -156.5);
    col(56, DECK, -170.5, 63.5, 36.4, -162.5);
  }
  // poop deck: bitts, winches, stern light, flagstaff
  {
    for (const s of [-1, 1]) {
      const z = ZC + s * 9.5;
      pnt(at(cyl(0.55, 0.55, 1.4, 14), 60.5, DECK + 0.85, z, Math.PI / 2), 0x8a7452);
      for (const dz of [-0.75, 0.75]) pnt(at(cyl(0.75, 0.75, 0.08, 14), 60.5, DECK + 0.85, z + dz, Math.PI / 2), RED);
      bx(1.2, 0.6, 2.0, 60.5, DECK + 0.3, z, DGREY);
      for (const dx of [-0.45, 0.45]) pnt(at(cyl(0.2, 0.22, 0.7, 10), 63.3 + dx, DECK + 0.35, ZC + s * 11.8), BLACK);
      col(59.5, DECK, z - 1.1, 61.5, DECK + 1.6, z + 1.1);
    }
    tube(new V(64.2, 10.2, ZC), new V(64.2, 15.5, ZC), 0.05, WHITE, 6);
    SG.push(at(decal('flag', 1.8, 1.2, 0, 0, 0), 63.3, 14.8, ZC, 0, 0, 0));
    SG.push(at(decal('flag', 1.8, 1.2, 0, 0, 0), 63.3, 14.8, ZC - 0.01, 0, Math.PI, 0));
    lamp(64.6, 10.6, ZC, 0.25);
    railing(64.75, -179.5, 64.75, -153.5, 10.2, 0.4, 2.0, WHITE);
  }

  // ---------- gangway (accommodation ladder) per DESIGN.md
  {
    const z0 = -152.9, z1 = -151.1, zc = -152.0, ang = Math.atan2(9, 24), L = Math.hypot(24, 9);
    const ALU = 0xa8adb0;
    const sy = (x) => (x + 2) / 24 * 9;
    pnt(at(box(L, 0.08, 1.8, 2), 10, 4.5 - 0.06, zc, 0, 0, ang), ALU);
    for (const z of [z0 + 0.03, z1 - 0.03]) pnt(at(box(L, 0.32, 0.06, 2), 10, 4.5 - 0.06, z, 0, 0, ang), ALU);
    for (let t = 0.4; t < L; t += 0.4) { const x = -2 + Math.cos(ang) * t, y = Math.sin(ang) * t; pnt(at(box(0.05, 0.05, 1.68), x, y + 0.01, zc, 0, 0, ang), 0x6a6e70); }
    for (const z of [z0 + 0.04, z1 - 0.04]) {
      for (let x = -1.6; x <= 21.9; x += 1.6) bx(0.045, 1.0, 0.045, x, sy(x) + 0.5, z, ALU);
      tube(new V(-2, 1.0, z), new V(22, 10.0, z), 0.03, ALU, 6);
      tube(new V(-2, 0.5, z), new V(22, 9.5, z), 0.022, ALU, 6);
    }
    // top platform x 22..25 at deck level
    blk(22, 25, DECK - 0.1, DECK, -153.6, -151.1, ALU);
    for (let x = 22.3; x < 25.1; x += 0.35) pnt(at(box(0.04, 0.03, 2.4), x, DECK + 0.01, -152.35), 0x6a6e70);
    railing(22, -151.12, 25, -151.12, DECK, 1.0, 1.0, ALU);
    railing(25, -151.12, 25, -153.0, DECK, 1.0, 1.0, ALU);
    // platform brackets + davit with suspension wire
    for (const x of [22.3, 24.7]) tube(new V(x, DECK - 2.4, -153.05), new V(x, DECK - 0.1, -151.3), 0.07, ALU, 6);
    tube(new V(26.3, 9.35, -153.1), new V(26.3, DECK + 3.6, -153.1), 0.1, WHITE, 8);
    tube(new V(26.3, DECK + 3.6, -153.1), new V(26.3, DECK + 3.6, -152.2), 0.08, WHITE, 8);
    // lifebuoy hung on a bracket on the railing next to the gangway platform (faces the quay)
    bx(0.08, 0.5, 0.08, 27.4, 9.35 + 0.55, -153.05, WHITE);
    pnt(at(new THREE.TorusGeometry(0.34, 0.08, 8, 20), 27.4, 9.35 + 0.48, -152.96), 0xe0461c);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; bx(0.1, 0.17, 0.17, 27.4 + Math.cos(a) * 0.34, 9.83 + Math.sin(a) * 0.34, -152.96, WHITE, 0, 0, a); }
    // bottom landing on the quay + roller
    blk(-6, -2, 0.0, 0.08, -152.9, -150.8, ALU);
    for (let x = -5.8; x < -2; x += 0.35) pnt(at(box(0.04, 0.03, 2.0), x, 0.09, -151.85), 0x6a6e70);
    pnt(at(cyl(0.18, 0.18, 1.9, 12), -1.8, 0.18, zc, Math.PI / 2), DGREY);
    railing(-6, -152.88, -2, -152.88, 0.08, 1.0, 1.0, ALU);
    SG.push(decal('gangway', 1.6, 0.18, 23.5, DECK + 0.65, -151.08));
    SG.push(decal('hazard', 2.9, 0.12, 23.5, DECK + 0.06, -151.07));
    LIT.push(at(box(0.22, 0.14, 0.22), 26.3, DECK + 3.45, -152.3)); // gangway lamp lens (no glow anchor: glare)
  }

  // ---------- mooring lines: taut head / spring / breast / stern lines from deck-edge chocks to the quay bollards
  //            (bollards: x -88 + 12k, z -150.1; the gangway span x -6..25 is kept clear)
  {
    const BZ = -150.1, EYE_Y = 0.4, HIVIS = 0xe0661a, DARK = 0x2e3032, GALV = 0xbfc3c3;
    const hullPt = (x, y) => new V(x, y, ZC + hbAt(x, y) + 0.06);
    // [ship end, bollard x, colour, bitt x (cargo-deck chock -> inboard bitts) | null, rat guard]
    const lines = [
      [hullPt(-84, 12.2), -88, DARK, null, false],          // head line (forecastle panama chock)
      [new V(-64.5, topY(-64.5) + 0.27, -153.1), -40, HIVIS, -66, false],  // forward spring
      [new V(-46.5, topY(-46.5) + 0.27, -153.1), -28, HIVIS, -45, true],   // forward spring 2
      [new V(34.0, 9.62, -153.1), 44, HIVIS, 32, true],      // after spring
      [hullPt(52, 9.75), 56, DARK, null, false],             // stern breast
      [hullPt(60, 9.75), 68, DARK, null, false],             // stern line
    ];
    const ropeG = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(4, pts.length * 2), r, 6);
    for (const [a, bxp, hex, bitt, rat] of lines) {
      const hd = new V(a.x - bxp, 0, a.z - BZ).normalize();
      const b = new V(bxp + hd.x * 0.2, EYE_Y + 0.02, BZ + hd.z * 0.2);
      const len = a.distanceTo(b);
      pnt(ropeG(catenary(a, b, len * 0.008, 8), 0.06), hex);
      // eye splice over the bollard neck + the splice where the eye legs meet
      pnt(at(new THREE.TorusGeometry(0.21, 0.05, 6, 14), bxp, EYE_Y, BZ, Math.PI / 2), hex);
      const sp = new V().lerpVectors(b, a, 0.6 / len);
      pnt(ropeG([new V(bxp - hd.z * 0.2, EYE_Y, BZ + hd.x * 0.2), sp], 0.05), hex);
      pnt(ropeG([new V(bxp + hd.z * 0.2, EYE_Y, BZ - hd.x * 0.2), sp], 0.05), hex);
      if (rat) { // rat guard: galvanised cone clamped on the line, a few metres off the ship
        const p = new V().lerpVectors(a, b, 0.3), d = new V().subVectors(b, a).normalize();
        const g = cyl(0.08, 0.46, 0.14, 16, true); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), d)); g.translate(p.x, p.y, p.z); pnt(g, GALV);
        const g2 = cyl(0.46, 0.46, 0.015, 16); g2.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), d)); g2.translate(p.x + d.x * 0.07, p.y + d.y * 0.07, p.z + d.z * 0.07); pnt(g2, 0x9ea3a3);
      }
      if (bitt !== null) {
        // panama chock on the sheer strake + the line made fast on the bitts in figure-of-eight turns
        bx(0.9, 0.12, 0.42, a.x, topY(a.x) + 0.06, -153.12, BLACK);
        pnt(at(new THREE.TorusGeometry(0.2, 0.075, 6, 14).scale(1.5, 1, 1), a.x, topY(a.x) + 0.27, -153.12), BLACK);
        const near = a.x > bitt ? bitt + 0.55 : bitt - 0.55;
        pnt(ropeG([new V(a.x, a.y - 0.05, -153.25), new V((a.x + near) / 2, 9.58, -153.75), new V(near, 9.6, -154.05 + 0.25)], 0.055), hex);
        for (const dx of [-0.55, 0.55]) for (const yy of [9.56, 9.7]) pnt(at(new THREE.TorusGeometry(0.27, 0.05, 5, 12), bitt + dx, yy, -154.05, Math.PI / 2), hex);
        pnt(ropeG([new V(bitt - 0.5, 9.62, -153.8), new V(bitt + 0.5, 9.64, -154.3)], 0.05), hex);
        pnt(ropeG([new V(bitt - 0.5, 9.66, -154.3), new V(bitt + 0.5, 9.68, -153.8)], 0.05), hex);
      } else {
        // fairlead ring at the hull opening
        const n = new V(0, 0, 1);
        const g = new THREE.TorusGeometry(0.26, 0.08, 6, 14); g.scale(1.6, 1, 1); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 0, 1), n)); g.translate(a.x, a.y, a.z - 0.02); pnt(g, BLACK);
      }
    }
  }

  // ---------- hull side colliders (quay side open at the gangway gap) + walk areas
  col(-76, -3, -153.45, 22, 10.2, -153.0);
  col(25, -3, -153.45, 65, 10.5, -153.0);
  col(-76, -3, -180, 65, 10.5, -179.55);
  col(64.6, DECK, -180, 65.2, 10.6, -153);
  for (let x = -95; x < -76; x += 2) {
    const hb = hbAt(x + 1, 11.5);
    const y0 = deckYAt(x + 1);
    col(x, y0, ZC + hb - 0.45, x + 2, topY(x + 1) + 0.2, ZC + hb + 0.1);
    col(x, y0, ZC - hb - 0.1, x + 2, topY(x + 1) + 0.2, ZC - hb + 0.45);
  }
  walk.push({ type: 'box', min: [FC_X, -179.6], max: [65, -153.25], y: DECK });
  walk.push({ type: 'ramp', x0: -2, x1: 22, y0: 0, y1: 9, z0: -152.9, z1: -151.1 });
  walk.push({ type: 'box', min: [22, -153.6], max: [25, -151.1], y: DECK });

  // ---------- assemble merged meshes
  const add = (geos, mat, name, cast = true, recv = true) => {
    if (!geos.length) return null;
    const m = new THREE.Mesh(merge(geos), mat); m.name = name; m.castShadow = cast; m.receiveShadow = recv; root.add(m); return m;
  };
  add(P, mPaint, 'paint');
  // wreckable pieces: geometry re-centred on its pivot so a group transform can drop / tilt it
  const pivotMesh = (geos, pivot, name) => {
    const g = merge(geos); g.translate(-pivot.x, -pivot.y, -pivot.z);
    const grp = new THREE.Group(); grp.name = name; grp.position.copy(pivot);
    const m = new THREE.Mesh(g, mPaint); m.castShadow = true; m.receiveShadow = true; grp.add(m); root.add(grp); return grp;
  };
  const jibObj = pivotMesh(JIB, jibPivot.heel, 'craneJib');
  const funnelTop = pivotMesh(FTOP, funnelPivot, 'funnelTop');
  add(DK, mDeck, 'deck', false, true);
  add(WALKG, mWalk, 'walkway', false, true);
  add(LIT, mLit, 'lit', false, false);
  add(GL, mGlass, 'glass', false, false);
  add(SG, mSign, 'signs', false, true);
  const breach = buildBreaches(); root.add(breach.mesh);

  // ---------- radar scanners (spin in update)
  const radar = new THREE.Object3D(); radar.name = 'radar'; radar.position.set(46.4, 29.15, ZC);
  const radar2 = new THREE.Object3D(); radar2.position.set(47.6, 32.75, ZC);
  {
    const rg = [];
    const rp = (g, hex) => { const c = C(hex); tint(g, c.r, c.g, c.b); rg.push(g); };
    rp(at(cyl(0.3, 0.35, 0.5, 10), 0, 0.25, 0), DGREY);
    rp(at(box(0.32, 0.28, 4.8, 2), 0, 0.62, 0), WHITE);
    rp(at(box(0.08, 0.2, 4.6, 2), 0.18, 0.62, 0), DGREY);
    const g1 = merge(rg.splice(0));
    const m1 = new THREE.Mesh(g1, mPaint); m1.castShadow = true; radar.add(m1);
    rp(at(cyl(0.22, 0.26, 0.4, 10), 0, 0.2, 0), DGREY);
    rp(at(box(0.26, 0.22, 3.2, 2), 0, 0.5, 0), WHITE);
    const m2 = new THREE.Mesh(merge(rg), mPaint); m2.castShadow = true; radar2.add(m2);
  }
  root.add(radar, radar2);

  // viewer-only water plane (?args=[{"water":1}]) so the waterline reads in model-test shots
  if (opts && opts.water) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1200, 800), new THREE.MeshStandardMaterial({ color: 0x1d2a2e, roughness: 0.15, metalness: 0.6 }));
    w.rotation.x = -Math.PI / 2; w.position.set(0, -2.2, -151 - 400); w.receiveShadow = true; root.add(w);
    const q = new THREE.Mesh(new THREE.BoxGeometry(400, 2.2, 160), new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.9 }));
    q.position.set(0, -1.1, -151 + 80); q.receiveShadow = true; root.add(q);
  }
  let burnt = false;
  // global smoke-darkening (the localized char / breaches / embers come from the burn shader)
  const burnSet = [[mHull, 0x3a2618, 0.45], [mDeck, 0x1e140d, 0.5], [mWalk, 0x1e140d, 0.5], [mPaint, 0x241810, 0.5], [mCont, 0x2e1c12, 0.5], [mGlass, 0x0c0907, 1], [mSign, 0x2a1d14, 0.6], [mLit, 0x0a0806, 1]]
    .map(([m, hex, f]) => [m, m.color.clone(), new THREE.Color(hex), f]);
  let T = 0, burnK = 0;
  const syncRoot = () => { root.updateWorldMatrix(true, false); BURN.U.uRootInv.value.copy(root.matrixWorld).invert(); };
  // ---------- info
  let tris = 0, calls = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    tris += n * (o.isInstancedMesh ? o.count : 1); calls++;
  });

  const anchors = {
    manifold: new V(-6, DECK, -155.5), manifoldObj,
    gangwayBottom: new V(-4, 0, -151.5), gangwayTop: new V(23.5, DECK, -152),
    radar, radar2, lights, craneJib: jibObj, funnelTop,
    fuelHold: new V(-15, DECK, -166.8), bridge: new V(46, 24.6, ZC), funnel: new V(59.2, 36.4, ZC),
    bow: new V(-95, 12, ZC), stern: new V(65, 10, ZC),
  };
  const api = {
    root, colliders, walk, anchors,
    update(dt) {
      T += dt;
      if (!burnt) { radar.rotation.y += dt * 2.6; radar2.rotation.y -= dt * 3.4; }
      // manifold warning beacons: double-flash pulse
      const ph = (T * 1.25) % 1, p = Math.max(Math.exp(-(((ph - 0.08) / 0.07) ** 2)), 0.75 * Math.exp(-(((ph - 0.32) / 0.07) ** 2)));
      mBeacon.emissiveIntensity = 0.35 + 2.6 * p;
      beaconRef.mat.opacity = 0.25 + 0.75 * p;
      for (const sp of beaconGlows) sp.scale.setScalar(0.9 + 1.5 * p);
      if (burnt) { BURN.U.uBurnT.value = T; breach.set(burnK, T); }
    },
    // k 0..1: char everything toward scorched black-brown with ember glow, kill windows, wreck a few parts
    setBurnt(k) {
      k = Math.max(0, Math.min(1, k));
      burnt = k > 0;
      burnK = k; syncRoot();
      BURN.U.uBurn.value = k; BURN.U.uBurnT.value = T; breach.set(k, T);
      for (const [m, c0, char, f] of burnSet) m.color.copy(c0).lerp(char, k * f);
      for (const m of [mDeck, mPaint, mCont, mWalk]) m.emissive.setRGB(1.1 * k, 0.33 * k, 0.07 * k);
      mHull.emissive.setRGB(1 - 0.55 * k, 1 - 0.85 * k, 1 - 0.95 * k); mHull.emissiveIntensity = 0.2 * (1 - 0.5 * k);
      mHull.roughness = mPaint.roughness = 0.62 + 0.15 * k; mGlass.roughness = 0.12 + 0.8 * k; mGlass.metalness = 0.75 - 0.6 * k;
      if (k > 0) { mLit.userData.burnt = true; mLit.emissiveIntensity = 0; } else { mLit.userData.burnt = false; }
      radar.visible = radar2.visible = k < 0.05;
      funnelTop.rotation.set(-0.12 * k, 0, 0.42 * k);
      funnelTop.position.copy(funnelPivot).add(new V(-0.8 * k, -0.25 * k, 0));
      jibObj.quaternion.setFromAxisAngle(jibPivot.axis, 0.75 * k);
    },
    info: { tris: Math.round(tris), drawCalls: calls, colliders: colliders.length, lights: lights.length },
  };
  if (opts && opts.burnt) api.setBurnt(opts.burnt); // viewer preview
  return api;
}
