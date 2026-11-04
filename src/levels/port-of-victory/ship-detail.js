// VICTORY STAR detail helpers: hull plate detail tile, quay-side walkway texture, burn shader patch
// (scorch gradient, hull breaches with glowing interiors, ember edges), lifeboat loft, beacon glow.
// Everything procedural + deterministic (makeRng). Used by ship.js only.
import * as THREE from 'three';
import { makeNoise, fbm, makeCanvas, canvasTex, heightToNormal } from '../../textures.js';
import { makeRng } from '../../rng.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const hash2 = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; };

// coarse fbm grid, bilinearly sampled (keeps per-pixel cost low on Quest)
function coarse(seed, cw, ch, base, oct = 4) {
  const n = makeNoise(seed, 64), a = new Float32Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) a[y * cw + x] = fbm(n, x / cw, y / ch, base, oct);
  return (u, v) => { // u,v in [0,1)
    const fx = u * cw - 0.5, fy = v * ch - 0.5;
    let x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0;
    const X = (x) => ((x % cw) + cw) % cw, Y = (y) => ((y % ch) + ch) % ch;
    const p = a[Y(y0) * cw + X(x0)], q = a[Y(y0) * cw + X(x0 + 1)], r = a[Y(y0 + 1) * cw + X(x0)], s = a[Y(y0 + 1) * cw + X(x0 + 1)];
    return lerp(lerp(p, q, tx), lerp(r, s, tx), ty);
  };
}

// ------------------------------------------------------------------ hull plate detail (tile 24 m x 12 m on uv1 * (0.5, 1))
// RGB = colour multiplier / 1.6 (linear data). Matches plateNormal(): strakes every 2.4 m, frames 0.75 m,
// butts every 12 m staggered by 6 m on odd strakes.
export function hullDetailTexture() {
  const W = 1024, H = 512, c = makeCanvas(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  const r = makeRng(1201), blot = coarse(1202, 96, 48, 3, 4), blot2 = coarse(1203, 192, 96, 9, 3);
  const SP = H / 5; // px per strake
  const mul = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    const k = Math.floor(y / SP), fy = (y - k * SP) / SP; // 0 at top seam of the strake, 1 at the bottom seam
    for (let x = 0; x < W; x++) {
      const odd = k & 1, xs = x + odd * 256, p = Math.floor(xs / 512), fx = (xs % 512) / 512;
      const h = hash2(k * 31 + 7, p * 17 + 3), h2 = hash2(k * 13 + 1, p * 29 + 11);
      let t = 0.86 + 0.24 * h;                                   // per-plate tone (re-plated / repainted plates)
      t *= 1 - 0.2 * Math.exp(-fy * 5);                         // grime collecting under the seam above
      t *= 1 + 0.04 * fy * fy;                                   // cleaner, rain-washed toward the plate's lower edge
      t *= 1 + 0.05 * Math.cos(Math.PI * 2 * (x / 32));           // 'hungry horse' dishing between frames
      t *= 1 + (blot(x / W, y / H) - 0.5) * 0.22 + (blot2(x / W, y / H) - 0.5) * 0.1;
      t *= 1 + 0.03 * (fx - 0.5) * (h2 - 0.5) * 4;               // slight shading across a plate
      const g = (r() - 0.5) * 0.03;
      const i = (y * W + x) * 3;
      mul[i] = t * (1 + 0.025 * (h2 - 0.5)) + g; mul[i + 1] = t + g; mul[i + 2] = t * (1 - 0.03 * (h2 - 0.5)) + g;
    }
  }
  const put = (x, y, f, rr = f, gg = f, bb = f) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return; const i = (y * W + x) * 3;
    mul[i] *= rr; mul[i + 1] *= gg; mul[i + 2] *= bb;
  };
  // weld seams: dark groove + light bead below / right
  for (let k = 0; k <= 5; k++) {
    const y0 = Math.round(k * SP) % H;
    for (let x = 0; x < W; x++) { put(x, (y0 - 1 + H) % H, 0.7); put(x, y0, 0.4); put(x, (y0 + 1) % H, 0.5); put(x, (y0 + 2) % H, 1.32); put(x, (y0 + 3) % H, 1.15); }
  }
  for (let k = 0; k < 5; k++) {
    const odd = k & 1, y0 = Math.round(k * SP), y1 = Math.round((k + 1) * SP);
    for (const bx0 of odd ? [256, 768] : [0, 512]) for (let y = y0; y < y1; y++) { put(bx0, y, 0.4); put(bx0 + 1, y, 0.55); put(bx0 + 2, y, 1.3); put(bx0 + 3, y, 1.1); put((bx0 - 1 + W) % W, y, 0.75); }
  }
  // rust pin-points + short bleeds along seams (orange-brown multiplier)
  const rustDot = (x0, y0, rad, len, a) => {
    for (let y = -rad; y <= rad + len; y++) for (let x = -rad; x <= rad; x++) {
      const d = y <= 0 ? Math.hypot(x, y) / rad : Math.abs(x) / (rad * (1 - 0.6 * y / len));
      if (d > 1) continue;
      const f = a * (1 - d) * (y > 0 ? 1 - y / len : 1);
      put((x0 + x + W) % W, y0 + y, 1, 1 + 0.55 * f, 1 - 0.1 * f, 1 - 0.45 * f);
    }
  };
  for (let i = 0; i < 160; i++) {
    const k = Math.floor(r() * 5), onButt = r() < 0.35;
    let x, y;
    if (onButt) { x = ((k & 1) ? 256 : 0) + (r() < 0.5 ? 0 : 512) + 2; y = Math.round(k * SP + r() * SP); }
    else { x = Math.floor(r() * W); y = Math.round(k * SP) + 3; }
    rustDot(x, y, 1 + Math.floor(r() * 3), 6 + Math.floor(r() * 40), 0.5 + r() * 0.5);
  }
  for (let i = 0; i < 90; i++) rustDot(Math.floor(r() * W), Math.floor(r() * H), 1 + Math.floor(r() * 2), 4 + Math.floor(r() * 18), 0.35 + r() * 0.4);
  for (let p = 0, n = W * H; p < n; p++) {
    for (let ch = 0; ch < 3; ch++) img.data[p * 4 + ch] = Math.max(0, Math.min(255, Math.round(mul[p * 3 + ch] / 1.6 * 255)));
    img.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTex(c, { srgb: false, aniso: 8 });
}

// ------------------------------------------------------------------ quay-side walkway (unique texture, x X0..X1, z ZB..ZI)
export const WALK = { X0: -48, X1: 40, ZB: -153.22, ZI: -157.85 };
export function walkwayTextures(stencils = []) {
  const { X0, X1, ZB, ZI } = WALK;
  const W = 4096, H = 256, SX = W / (X1 - X0), SZ = H / (ZB - ZI);
  const X = (x) => (x - X0) * SX, Y = (z) => (z - ZI) * SZ; // row 0 = inboard (coaming) edge: reads unmirrored from above
  const c = makeCanvas(W, H), ctx = c.getContext('2d');
  const r = makeRng(1301), hgt = new Float32Array(W * H);
  const blot = coarse(1302, 512, 16, 6, 4), blotF = coarse(1303, 1024, 32, 24, 3), rustN = coarse(1304, 512, 16, 10, 4);
  // ---- base: green non-slip paint, grit, wear lane, rust
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const z = ZI + y / SZ;
    const lane = Math.exp(-(((z + 155.35) / 0.75) ** 2));            // walking lane down the middle
    const edgeB = clamp01((z + 153.75) / 0.5), edgeI = clamp01((-157.35 - z) / 0.5); // bulwark / coaming edges
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const b = blot(u, v), bf = blotF(u, v), rn = rustN(u, v), grit = r();
      let R = 0.355, G = 0.465, B = 0.33;
      const tone = 0.92 + (b - 0.5) * 0.3 + (bf - 0.5) * 0.12 + (grit - 0.5) * 0.12;
      R *= tone; G *= tone; B *= tone;
      // worn lane: paint scuffed to dull grey-green, bare steel specks
      const wear = clamp01(lane * (0.55 + (bf - 0.5) * 1.6));
      R = lerp(R, 0.3, wear * 0.55); G = lerp(G, 0.32, wear * 0.55); B = lerp(B, 0.29, wear * 0.55);
      if (wear > 0.35 && grit > 0.985) { R = G = B = 0.42; }
      // rust: along the edges (water traps) + scattered blooms
      const rm = clamp01((rn - 0.6 + 0.25 * Math.max(edgeB, edgeI)) * 5) * (0.7 + grit * 0.5);
      R = lerp(R, 0.36, rm); G = lerp(G, 0.19, rm); B = lerp(B, 0.09, rm);
      const deep = clamp01((rn - 0.72 + 0.2 * Math.max(edgeB, edgeI)) * 6);
      R = lerp(R, 0.2, deep * 0.7); G = lerp(G, 0.1, deep * 0.7); B = lerp(B, 0.06, deep * 0.7);
      hgt[y * W + x] = (grit - 0.5) * 0.35 - rm * 0.5 - deep * 0.4;
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, R * 255); img.data[i + 1] = Math.min(255, G * 255); img.data[i + 2] = Math.min(255, B * 255); img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const H_ = (x0, y0, w, h, v) => { for (let y = Math.max(0, y0 | 0); y < Math.min(H, (y0 + h) | 0); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(W, (x0 + w) | 0); x++) hgt[y * W + x] += v; };
  // ---- plate seams with weld beads (longitudinal at z -155.6, butts every 9.6 m)
  const seamH = (y) => { ctx.fillStyle = 'rgba(12,16,12,0.55)'; ctx.fillRect(0, y - 1, W, 2); ctx.fillStyle = 'rgba(150,165,140,0.25)'; ctx.fillRect(0, y + 1, W, 1.5); H_(0, y - 1, W, 2, -0.6); H_(0, y + 1, W, 2, 1.2); };
  seamH(Y(-155.6));
  for (let x = X0 + 3.1; x < X1; x += 9.6) { const px = X(x); ctx.fillStyle = 'rgba(12,16,12,0.55)'; ctx.fillRect(px - 1, 0, 2, H); ctx.fillStyle = 'rgba(150,165,140,0.25)'; ctx.fillRect(px + 1, 0, 1.5, H); H_(px - 1, 0, 2, H, -0.6); H_(px + 1, 0, 2, H, 1.2); }
  // ---- worn paint helper: draw shape then knock chips out with dark specks
  const chips = (x0, y0, w, h, n, col) => { for (let i = 0; i < n; i++) { ctx.fillStyle = col; const cw = 1 + r() * 5, chh = 1 + r() * 3; ctx.fillRect(x0 + r() * w, y0 + r() * h, cw, chh); } };
  // yellow safety edge lines (gap at the gangway entrance x 22..25 on the bulwark side)
  for (const [z, gap] of [[-153.55, true], [-157.15, false]]) {
    const py = Y(z) - 0.05 * SZ, ph = 0.1 * SZ;
    const segs = gap ? [[X0, 21.8], [25.2, X1]] : [[X0, X1]];
    for (const [a, b] of segs) {
      ctx.fillStyle = '#d9a417'; ctx.fillRect(X(a), py, X(b) - X(a), ph); H_(X(a), py, X(b) - X(a), ph, 0.15);
      chips(X(a), py, X(b) - X(a), ph, Math.round((b - a) * 6), 'rgba(70,64,40,0.75)');
      chips(X(a), py, X(b) - X(a), ph, Math.round((b - a) * 3), 'rgba(110,60,30,0.7)');
    }
  }
  // hazard-striped zones: gangway landing, manifold footprint, around bitts
  const stripes = (x0, z0, x1, z1, bw = 0.14) => {
    const ax = X(x0), bxp = X(x1), ay = Y(Math.min(z0, z1)), by = Y(Math.max(z0, z1));
    ctx.save(); ctx.beginPath();
    ctx.rect(ax, ay, bxp - ax, by - ay); ctx.rect(ax + bw * SX, ay + bw * SZ, bxp - ax - 2 * bw * SX, by - ay - 2 * bw * SZ);
    ctx.clip('evenodd');
    ctx.fillStyle = '#d9a417'; ctx.fillRect(ax, ay, bxp - ax, by - ay);
    ctx.fillStyle = '#161616';
    for (let s = -40; s < (bxp - ax) / 14 + 40; s++) { ctx.beginPath(); ctx.moveTo(ax + s * 28, ay); ctx.lineTo(ax + s * 28 + 14, ay); ctx.lineTo(ax + s * 28 + 14 - (by - ay), by); ctx.lineTo(ax + s * 28 - (by - ay), by); ctx.closePath(); ctx.fill(); }
    chips(ax, ay, bxp - ax, by - ay, 60, 'rgba(60,58,44,0.7)');
    ctx.restore();
    H_(ax, ay, bxp - ax, by - ay, 0.05);
  };
  stripes(21.9, -153.25, 25.1, -154.7, 0.16);
  stripes(-7.65, -154.35, -4.35, -156.65, 0.14);
  for (const x of [19.0, 3.5, -20, -45, 32]) stripes(x - 1.15, -153.6, x + 1.15, -154.55, 0.1);
  // drain holes along the bulwark edge + rust halos
  for (let x = X0 + 2; x < X1; x += 5.5 + r() * 2) {
    const px = X(x), py = Y(-153.32);
    const g = ctx.createRadialGradient(px, py, 2, px, py, 26); g.addColorStop(0, 'rgba(110,52,22,0.75)'); g.addColorStop(1, 'rgba(110,52,22,0)');
    ctx.fillStyle = g; ctx.fillRect(px - 30, py - 30, 60, 60);
    ctx.fillStyle = '#060707'; ctx.fillRect(px - 0.12 * SX, py - 3, 0.24 * SX, 6); H_(px - 0.12 * SX, py - 3, 0.24 * SX, 6, -1.5);
  }
  // pipe-support feet on the inboard edge: rust bleeding out
  for (let x = -26; x < 36; x += 3) {
    const px = X(x), py = Y(-157.42);
    const g = ctx.createRadialGradient(px, py, 1, px, py, 18 + r() * 14); g.addColorStop(0, 'rgba(120,58,24,0.8)'); g.addColorStop(1, 'rgba(120,58,24,0)');
    ctx.fillStyle = g; ctx.fillRect(px - 34, py - 34, 68, 68);
  }
  // oil stains: around the manifold drip tray, hose reels, random drips
  const stain = (x, z, rad, a) => {
    const px = X(x), py = Y(z);
    for (let k = 0; k < 4; k++) {
      const ox = (r() - 0.5) * rad * SX, oy = (r() - 0.5) * rad * SZ * 0.6, rr = rad * SX * (0.35 + r() * 0.5);
      const g = ctx.createRadialGradient(px + ox, py + oy, rr * 0.2, px + ox, py + oy, rr);
      g.addColorStop(0, `rgba(10,12,8,${a})`); g.addColorStop(0.7, `rgba(14,16,10,${a * 0.6})`); g.addColorStop(1, 'rgba(14,16,10,0)');
      ctx.fillStyle = g; ctx.save(); ctx.translate(px + ox, py + oy); ctx.scale(1, SZ / SX); ctx.translate(-px - ox, -py - oy); ctx.fillRect(px + ox - rr, py + oy - rr, 2 * rr, 2 * rr); ctx.restore();
    }
  };
  stain(-6, -155.5, 2.8, 0.55); stain(-3.3, -154.6, 1.2, 0.45); stain(-8.8, -156.2, 1.0, 0.4);
  for (const x of [8.5, -2.0, 27]) stain(x, -157.1, 0.8, 0.35);
  for (let i = 0; i < 30; i++) stain(X0 + r() * (X1 - X0), -153.6 - r() * 3.8, 0.15 + r() * 0.4, 0.25 + r() * 0.25);
  // boot scuffs along the lane
  for (let i = 0; i < 900; i++) { const px = X(-30 + r() * 68), py = Y(-155.35 + (r() - 0.5) * 1.6); ctx.fillStyle = `rgba(20,22,18,${0.08 + r() * 0.12})`; ctx.beginPath(); ctx.ellipse(px, py, 3 + r() * 6, 1.5 + r() * 2, r() * 0.6 - 0.3, 0, Math.PI * 2); ctx.fill(); }
  // stencils (read when walking toward -x: letters' up points -x)
  ctx.save();
  const sten = (txt, x, z, size, col) => {
    ctx.save(); ctx.translate(X(x), Y(z)); ctx.rotate(-Math.PI / 2); ctx.scale(SZ / SX, 1);
    ctx.font = `bold ${Math.round(size * SX)}px "Arial Black", Arial, Helvetica, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore();
  };
  const arrow = (x, z, len, col) => {
    const px = X(x), py = Y(z); ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(px - len * SX, py); ctx.lineTo(px - len * 0.55 * SX, py - 0.32 * SZ); ctx.lineTo(px - len * 0.55 * SX, py - 0.12 * SZ); ctx.lineTo(px + len * 0.45 * SX, py - 0.12 * SZ);
    ctx.lineTo(px + len * 0.45 * SX, py + 0.12 * SZ); ctx.lineTo(px - len * 0.55 * SX, py + 0.12 * SZ); ctx.lineTo(px - len * 0.55 * SX, py + 0.32 * SZ); ctx.closePath(); ctx.fill();
  };
  for (const s of stencils) { if (s.arrow) arrow(s.x, s.z, s.len || 1.4, s.col); else sten(s.t, s.x, s.z, s.size, s.col); }
  ctx.restore();
  // wear the stencils/lines: grey-green speckle over everything painted
  for (let i = 0; i < 9000; i++) { const px = r() * W, py = r() * H; ctx.fillStyle = r() < 0.5 ? 'rgba(84,108,80,0.55)' : 'rgba(40,46,38,0.35)'; ctx.fillRect(px, py, 1 + r() * 3, 1 + r() * 2); }
  // scratches
  ctx.strokeStyle = 'rgba(170,175,160,0.1)'; ctx.lineWidth = 1;
  for (let i = 0; i < 700; i++) { const x = r() * W, y = r() * H, a = (r() - 0.5) * 0.7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 40, y + Math.sin(a) * 40); ctx.stroke(); }
  const map = canvasTex(c, { repeat: false, aniso: 8 });
  const normal = heightToNormal(hgt, W, H, 1.6);
  normal.wrapS = normal.wrapT = THREE.ClampToEdgeWrapping;
  return { map, normal, uv: (x, z) => [(x - X0) / (X1 - X0), 1 - (z - ZI) / (ZB - ZI)] };
}

// ------------------------------------------------------------------ breaches (quay-side hull, near the fuel hold)
// four different tears: a big ragged blow-out at the fuel hold, a diagonal gash, two punched holes.
// (setpieces.js spawns hull fire jets around x -29, -21, -15, -9 / y 3.5..6.5)
export const BREACHES = [
  { x: -15.0, y: 4.7, rx: 3.5, ry: 2.1, rot: 0.08, kind: 'tear' },
  { x: -24.6, y: 3.7, rx: 1.6, ry: 0.7, rot: 0.6, kind: 'gash' },
  { x: -6.4, y: 6.3, rx: 0.85, ry: 1.05, rot: 0.2, kind: 'punch' },
  { x: -31.0, y: 5.5, rx: 0.65, ry: 0.55, rot: -0.3, kind: 'punch' },
];
const HULL_Z = -153.0, CAV = 1.65, OUT_N = 64;
// irregular torn outline per breach: radius (in rx/ry units) sampled around the local angle, shared by the shader
// (DataTexture, linear + repeat) and the petal geometry, so the flaps sit exactly on the jagged rim
const OUTLINES = (() => {
  const r = makeRng(1601);
  return BREACHES.map((b) => {
    const R = new Float32Array(OUT_N);
    const P = b.kind === 'tear' ? { am: [0.2, 0.13, 0.07], tooth: 0.12, cracks: 4, clen: 0.45 }
      : b.kind === 'gash' ? { am: [0.06, 0.05, 0.04], tooth: 0.1, cracks: 0, clen: 0 } : { am: [0.07, 0.05, 0.05], tooth: 0.2, cracks: 1, clen: 0.25 };
    const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
    const cracks = [];
    for (let k = 0; k < P.cracks; k++) cracks.push([r() * 6.28, P.clen * (0.6 + r() * 0.6), 0.1 + r() * 0.1]);
    if (b.kind === 'gash') cracks.push([0, 0.45, 0.25], [Math.PI, 0.35, 0.22]); // the gash runs on along its long axis
    for (let i = 0; i < OUT_N; i++) {
      const a = ((i + 0.5) / OUT_N - 0.5) * Math.PI * 2;
      let v = 1 + P.am[0] * Math.sin(2 * a + ph[0]) + P.am[1] * Math.sin(3 * a + ph[1]) + P.am[2] * Math.sin(5 * a + ph[2]);
      v += (i % 2 ? 1 : -1) * (0.3 + r() * 0.7) * P.tooth * 0.6 + (r() - 0.5) * 0.06; // saw-tooth tear
      for (const [ca, len, w] of cracks) { let d = Math.abs(a - ca) % (Math.PI * 2); d = Math.min(d, Math.PI * 2 - d); v += len * Math.max(0, 1 - d / w); }
      R[i] = Math.min(1.55, Math.max(0.4, v * 0.86));
    }
    return R;
  });
})();
const outlineR = (bi, ang) => { // same lookup as the shader (linear filter, repeat wrap)
  const f = (ang / (Math.PI * 2) + 0.5) * OUT_N - 0.5, i0 = Math.floor(f), t = f - i0, R = OUTLINES[bi];
  return lerp(R[((i0 % OUT_N) + OUT_N) % OUT_N], R[(((i0 + 1) % OUT_N) + OUT_N) % OUT_N], t);
};
// local ellipse coords (angle, radius in rx/ry units) -> world x,y
const breachPt = (b, ang, s) => {
  const lx = Math.cos(ang) * b.rx * s, ly = Math.sin(ang) * b.ry * s, c = Math.cos(b.rot), sn = Math.sin(b.rot);
  return [b.x + lx * c - ly * sn, b.y + lx * sn + ly * c];
};
let outlineTex = null;
function breachOutlineTexture() {
  if (outlineTex) return outlineTex;
  const H = BREACHES.length, d = new Uint8Array(OUT_N * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < OUT_N; i++) { const k = (j * OUT_N + i) * 4; d[k] = Math.round(OUTLINES[j][i] / 2 * 255); d[k + 3] = 255; }
  const t = new THREE.DataTexture(d, OUT_N, H, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true; outlineTex = t; return t;
}

// ------------------------------------------------------------------ burn shader patch
const GLSL_COMMON = /* glsl */`
uniform float uBurn; uniform float uBurnT; uniform float uBurnGlow; uniform mat4 uRootInv;
varying vec3 vBW;
float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bHash(i), bHash(i + vec2(1.0, 0.0)), f.x), mix(bHash(i + vec2(0.0, 1.0)), bHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float bFbm(vec2 p) { return bNoise(p) * 0.55 + bNoise(p * 2.13 + 7.1) * 0.3 + bNoise(p * 4.7 + 3.3) * 0.15; }
`;
function glslBreaches() {
  let s = '';
  BREACHES.forEach((b, i) => {
    const c = Math.cos(b.rot).toFixed(4), sn = Math.sin(b.rot).toFixed(4), rm = ((b.rx + b.ry) / 2).toFixed(2), f = (n) => n.toFixed(2);
    s += `{ vec2 dp = vBW.xy - vec2(${f(b.x)}, ${f(b.y)});
      vec2 q = vec2(${c} * dp.x + ${sn} * dp.y, -${sn} * dp.x + ${c} * dp.y) / vec2(${f(b.rx)}, ${f(b.ry)});
      float th = atan(q.y, q.x) * 0.15915494 + 0.5;
      float Rr = texture2D(tBreach, vec2(th, ${((i + 0.5) / BREACHES.length).toFixed(4)})).r * 2.0 * bOpen;
      Rr *= 1.0 + (bNoise(vBW.xy * 9.0) - 0.5) * 0.07;
      float dm = (length(q) - Rr) * ${f(Math.min(b.rx, b.ry))}; // ~metres outside the tear
      bHole = max(bHole, step(dm, 0.0));
      bRim = max(bRim, 1.0 - smoothstep(0.0, 0.05, dm));
      bEdge = max(bEdge, 1.0 - smoothstep(0.0, 0.35, dm));
      bGlow = max(bGlow, (1.0 - smoothstep(0.0, 1.2, dm)) * bNoise(vBW.xy * 1.4 + ${(i * 5.3).toFixed(1)}));
      bHalo = max(bHalo, 1.0 - smoothstep(0.0, ${rm} * 2.3, dm + (bN - 0.5) * ${rm}));
      bWarm += exp(-max(dm, 0.0) / (0.6 + ${rm} * 0.9));
      float up = vBW.y - ${f(b.y)};
      float w = ${rm} * (0.5 + max(up, 0.0) * 0.22);
      bSoot = max(bSoot, exp(-pow(dp.x / w, 2.0)) * smoothstep(${f(b.ry * 0.2)}, ${f(b.ry * 1.1)}, up) * (1.0 - smoothstep(${f(9.0 - b.y - 2.5)}, ${f(9.4 - b.y)}, up) * 0.5) * smoothstep(0.2, 0.7, bFbm(vec2(vBW.x * 1.5, vBW.y * 0.25))));
    }\n`;
  });
  return s;
}
// kind: 'hull' (detail tile + breaches + scorch) | 'ember' (scorch; ember emissive limited to the scorched zone)
export function makeBurn() {
  const U = { uBurn: { value: 0 }, uBurnT: { value: 0 }, uBurnGlow: { value: 1 }, uRootInv: { value: new THREE.Matrix4() } };
  const patch = (mat, kind, extra = {}) => {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      if (extra.tDet) { sh.uniforms.tHullDet = { value: extra.tDet }; sh.uniforms.tBreach = { value: breachOutlineTexture() }; }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uRootInv;\nvarying vec3 vBW;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 bwp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          bwp = instanceMatrix * bwp;
          #endif
          vBW = (uRootInv * modelMatrix * bwp).xyz;`);
      let frag = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL_COMMON + (kind === 'hull' ? 'uniform sampler2D tHullDet; uniform sampler2D tBreach;\n' : ''));
      const colorPart = /* glsl */`#include <color_fragment>
        float bScorch = 0.0, bN = 0.5, bHole = 0.0, bRim = 0.0, bEdge = 0.0, bSoot = 0.0, bGlow = 0.0, bHalo = 0.0, bWarm = 0.0;
        ${kind === 'hull' ? `vec3 bDet = texture2D(tHullDet, vNormalMapUv * vec2(0.5, 1.0)).rgb * 1.6; diffuseColor.rgb *= bDet;` : ''}
        if (uBurn > 0.001) {
          bN = bFbm(vBW.xy * 0.31 + vBW.zz * 0.23);
          vec3 bd = (vBW - vec3(-12.0, 6.0, -160.0)) * vec3(1.0, 1.35, 1.0);
          float R = mix(8.0, 27.0, smoothstep(0.0, 0.8, uBurn));
          bScorch = (1.0 - smoothstep(R * 0.35, R, length(bd) + (bN - 0.5) * 16.0)) * smoothstep(0.0, 0.25, uBurn);
          ${kind === 'hull' ? `
          if (vBW.z > -153.7) {
            float bOpen = mix(0.62, 1.0, smoothstep(0.0, 0.35, uBurn));
            ${glslBreaches()}
            if (bHole > 0.5) discard;
            bWarm = min(bWarm, 1.5);
          }
          // hull: smoke-darkened but legible (plates + lettering still read), heavy char in a soft halo around each tear
          diffuseColor.rgb *= mix(1.0, 0.42, bScorch);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.085, 0.05) * (0.6 + 0.6 * bN), bScorch * (1.0 - bScorch) * 1.2);
          diffuseColor.rgb *= mix(1.0, 0.13, pow(bHalo, 1.3) * (0.75 + 0.5 * bN));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.01, 0.009, 0.008), bSoot * 0.9);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.01, 0.009), bEdge);` : `
          float fringe = bScorch * (1.0 - bScorch) * 4.0;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.1, 0.055) * (0.7 + 0.6 * bN), fringe * 0.45);
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.45, vec3(0.06, 0.05, 0.043) * (0.55 + 0.9 * bN), smoothstep(0.25, 0.85, bScorch));`}
        }`;
      frag = frag.replace('#include <color_fragment>', colorPart)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.96, max(bScorch, bHalo));')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          ${kind === 'hull' ? `
          totalEmissiveRadiance *= bDet * (1.0 - 0.45 * bScorch) * (1.0 - 0.85 * bHalo);
          if (uBurn > 0.001) {
            float fl = 0.78 + 0.22 * sin(uBurnT * 9.0 + vBW.x * 1.7) * sin(uBurnT * 5.3 + vBW.y * 2.1);
            float cr = pow(1.0 - abs(bNoise(vBW.xy * vec2(6.3, 7.1)) * 2.0 - 1.0), 14.0) * 0.7 + smoothstep(0.8, 0.95, bNoise(vBW.xy * 11.0 + 3.0)) * smoothstep(0.3, 0.8, bNoise(vBW.xy * 1.7));
            vec3 hot = vec3(3.0, 0.95, 0.2) * bRim * (0.55 + 0.9 * bNoise(vBW.xy * 3.3 + uBurnT * 0.7)) + vec3(1.9, 0.45, 0.07) * cr * smoothstep(0.2, 0.95, bEdge) * fl + vec3(0.16, 0.035, 0.005) * bEdge * bEdge + vec3(0.11, 0.024, 0.003) * bGlow;
            // fire under-glow: the burning holes and the deck fires light the hull plating (no real lights)
            float under = bWarm * 0.55 + bScorch * 0.18 * (1.0 - smoothstep(1.0, 8.0, vBW.y));
            hot += diffuseColor.rgb * vec3(2.6, 1.05, 0.38) * under * (0.8 + 0.2 * fl);
            totalEmissiveRadiance += hot * fl * uBurnGlow;
          }` : `totalEmissiveRadiance *= min(1.0, bScorch * 1.4);`}`);
      sh.fragmentShader = frag;
    };
    mat.customProgramCacheKey = () => 'vstar-burn-' + kind;
  };
  return { U, patch };
}

// fire interior canvas: left half = cavity glow (v: 0 at the opening -> 1 at the back), right half = torn petals
function fireTexture() {
  const W = 256, H = 256, c = makeCanvas(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  const n = makeNoise(1401, 32);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = 1 - y / H; let R, G, B;
    if (x < W / 2) {
      const u = x / (W / 2);
      const fl = fbm(n, u * 2, v * 0.5, 4, 4), fl2 = fbm(n, u * 3 + 5, v * 1.4, 7, 3), tongue = fbm(n, u * 6 + 2, v * 0.35, 6, 3);
      let t = clamp01(v * 0.8 - 0.08 + (fl - 0.5) * 1.0 + (tongue - 0.5) * 0.7);
      t = t * t * (3 - 2 * t);
      R = lerp(0.06, 0.95, Math.min(1, t * 1.4)); G = lerp(0.005, 0.32, t * t) + t ** 4 * 0.25; B = t ** 5 * 0.12;
      const dark = clamp01((fl2 - 0.52) * 4) * (1 - t * 0.35); // smoke / wreckage silhouettes
      R *= 1 - dark * 0.9; G *= 1 - dark * 0.95; B *= 1 - dark;
    } else {
      const u = (x - W / 2) / (W / 2);
      const cr = Math.pow(1 - Math.abs(fbm(n, u * 3, v * 3, 5, 3) * 2 - 1), 8);
      const tip = clamp01((v - 0.86) / 0.14);
      const e = Math.max(tip * tip * (0.5 + 0.5 * fbm(n, u * 8, v * 2, 8, 2)), cr * 0.55 * clamp01(v - 0.25));
      R = e; G = e * e * 0.42; B = e * e * e * 0.1;
      if (y > H - 24) { R = G = B = 0; }
    }
    const i = (y * W + x) * 4;
    img.data[i] = Math.min(255, R * 255); img.data[i + 1] = Math.min(255, G * 255); img.data[i + 2] = Math.min(255, B * 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTex(c, { repeat: false });
}

// cavities (open boxes behind each breach) + buckled interior frames + torn plate petals bent outward.
// one mesh, one material (vertex colour = albedo: black cavity, charred-steel petals; emissive map = fire / ember tips)
export function buildBreaches() {
  const r = makeRng(1501);
  const pos = [], uv = [], col = [], idx = [];
  let C = [0, 0, 0];
  const v = (x, y, z, u, w) => { pos.push(x, y, z); uv.push(u, w); col.push(C[0], C[1], C[2]); return pos.length / 3 - 1; };
  const quad = (a, b, c2, d) => idx.push(a, b, c2, a, c2, d);
  const tri = (a, b, c2) => idx.push(a, b, c2);
  const ZB = HULL_Z - 1.6, ZF = HULL_Z - 0.03;
  const BLK = [0.75, 0.04];
  // prism beam between two points (cross-section w x d), dark
  const beam = (p0, p1, w, d) => {
    const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1), ax = new THREE.Vector3().subVectors(b, a).normalize();
    const s1 = new THREE.Vector3(0, 0, 1).cross(ax).normalize().multiplyScalar(w / 2), s2 = new THREE.Vector3(0, 0, d / 2);
    const P = [];
    for (const e of [a, b]) for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = e.clone().addScaledVector(s1, i).addScaledVector(s2, j); P.push(v(q.x, q.y, q.z, BLK[0], BLK[1])); }
    for (let k = 0; k < 4; k++) quad(P[k], P[(k + 1) % 4], P[4 + (k + 1) % 4], P[4 + k]);
  };
  BREACHES.forEach((b, bi) => {
    const cR = Math.cos(b.rot), sR = Math.sin(b.rot);
    const hx = CAV * Math.hypot(b.rx * cR, b.ry * sR), hy = CAV * Math.hypot(b.rx * sR, b.ry * cR);
    const x0 = b.x - hx, x1 = b.x + hx, y0 = b.y - hy, y1 = Math.min(8.6, b.y + hy);
    C = [0.02, 0.015, 0.012];
    // sooty side walls: black at the opening, dull red deeper in (the floor glows: burning fuel)
    const ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    let acc = 0;
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = ring[k], [bx2, by2] = ring[(k + 1) % 4], L = Math.hypot(bx2 - ax, by2 - ay);
      const u0 = (acc / 6) % 0.5, u1 = u0 + Math.min(0.48, L / 12); acc += L;
      const back = k === 0 ? 0.5 : 0.2;
      const a0 = v(ax, ay, ZF, u0, 0.0), a1 = v(bx2, by2, ZF, u1, 0.0), b1 = v(bx2, by2, ZB, u1, back), b0 = v(ax, ay, ZB, u0, back);
      quad(a0, a1, b1, b0);
    }
    // back wall (1.6 m inside): grid with irregular hot pockets, hotter low down
    const GX = 6, GY = 4, g0 = pos.length / 3;
    const hot = [[lerp(x0, x1, 0.2 + r() * 0.6), lerp(y0, y1, 0.12 + r() * 0.25)], [lerp(x0, x1, r()), lerp(y0, y1, 0.3 + r() * 0.45)]];
    for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) {
      const x = lerp(x0, x1, i / GX), y = lerp(y0, y1, j / GY);
      let w = 0.12 + 0.2 * (1 - j / GY) + r() * 0.1;
      hot.forEach(([hxp, hyp], k) => { w += (k ? 0.4 : 0.65) * Math.exp(-(((x - hxp) / (hx * 0.32)) ** 2 + ((y - hyp) / (hy * 0.38)) ** 2)); });
      v(x, y, ZB, 0.04 + 0.4 * (i / GX) + r() * 0.02, Math.min(0.97, w));
    }
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { const a = g0 + j * (GX + 1) + i; quad(a, a + 1, a + GX + 2, a + GX + 1); }
    // torn tween-deck plate sagging across the hold (parallax shelf), a few broken ribs, debris on the floor
    if (b.rx > 1.2) {
      const ty = lerp(y0, y1, 0.55), n = 8, row0 = [], row1 = [];
      for (let i = 0; i <= n; i++) {
        const x = lerp(x0, x1, i / n), sag = -0.45 * Math.sin(Math.PI * i / n) - r() * 0.15;
        row0.push(v(x, ty + sag, ZB, 0.25, 0.14));
        row1.push(v(x, ty + sag - 0.25 - r() * 0.3, HULL_Z - 0.35 - r() * 0.5, 0.25, 0.08)); // ragged front edge drooping toward the hole
      }
      for (let i = 0; i < n; i++) quad(row0[i], row0[i + 1], row1[i + 1], row1[i]);
    }
    const nr = b.rx > 1.5 ? 3 : 1;
    for (let i = 0; i < nr; i++) {
      const fx = lerp(x0 + hx * 0.35, x1 - hx * 0.35, nr === 1 ? 0.3 + r() * 0.4 : (i + 0.2 + r() * 0.6) / nr), zz = HULL_Z - 0.35 - r() * 0.8;
      const top = lerp(y0, y1, 0.3 + r() * 0.35), lean = (r() - 0.5) * 0.9;
      beam([fx, y0 - 0.1, zz], [fx + lean, top, zz - 0.15], 0.11, 0.35);
      beam([fx + lean, top, zz - 0.15], [fx + lean + (r() - 0.5) * 0.8, top + 0.2 + r() * 0.4, zz - 0.05], 0.08, 0.25); // torn stub
    }
    for (let i = 0; i < 3; i++) { const dx = lerp(x0 + 0.3, x1 - 0.3, r()), dy = y0 + 0.05; beam([dx, dy, ZB + 0.2 + r() * 1.0], [dx + (r() - 0.5) * 1.4, dy + 0.1 + r() * 0.35, ZB + 0.2 + r() * 1.0], 0.18 + r() * 0.2, 0.25); }
    // petals: tapered flaps of torn plate whose roots follow the jagged rim, bent out toward the quay (>= 0.5 m)
    const big = b.kind === 'tear', gash = b.kind === 'gash';
    const np = big ? 10 : gash ? 6 : 7;
    for (let i = 0; i < np; i++) {
      let a;
      if (gash) a = (i < np / 2 ? Math.PI / 2 : -Math.PI / 2) + ((i % (np / 2)) / (np / 2 - 1) - 0.5) * 2.0 + (r() - 0.5) * 0.25; // along the long lips
      else a = (i + 0.15 + r() * 0.7) / np * Math.PI * 2 - Math.PI;
      if (big && r() < 0.12) continue;
      const da = (big ? 0.14 : 0.2) + r() * 0.16;
      const len = big ? 0.16 + r() * 0.24 : 0.3 + r() * 0.35, out = (big ? 0.7 : 0.5) + r() * (big ? 0.9 : 0.5), zf = HULL_Z + 0.015, tw = (r() - 0.5) * 0.6;
      const first = idx.length, rows = [];
      for (let k = 0; k <= 3; k++) {
        const f = k / 3, curl = Math.pow(f, 1.6), wd = da * (1 - 0.7 * f), ac = a + tw * f * da;
        C = [lerp(0.1, 0.3, f), lerp(0.09, 0.26, f), lerp(0.085, 0.24, f)]; // charred root -> heat-blued bare steel at the torn edge
        const pts = [];
        for (const sgn of [-1, 0, 1]) {
          const an = ac + sgn * wd, rr = outlineR(bi, an) * 0.985 + len * f * (1 - 0.45 * curl);
          const [px, py] = breachPt(b, an, rr);
          pts.push(v(px, py, zf + out * curl * (1 - 0.15 * Math.abs(sgn)) + (k ? (r() - 0.5) * 0.06 : 0), 0.75 + sgn * 0.12, 0.1 + 0.8 * f));
        }
        rows.push(pts);
      }
      for (let k = 0; k < 3; k++) for (let m = 0; m < 2; m++) quad(rows[k][m], rows[k][m + 1], rows[k + 1][m + 1], rows[k + 1][m]);
      const [tx, ty] = breachPt(b, a + tw * da, outlineR(bi, a) + len * 1.1);
      tri(rows[3][0], rows[3][2], v(tx, ty, zf + out * 1.05, 0.75, 0.99));
      // front face (lit, the 'top' of the flap) must face away from the hull
      const A = new THREE.Vector3().fromArray(pos, idx[first] * 3), B = new THREE.Vector3().fromArray(pos, idx[first + 1] * 3), Cc = new THREE.Vector3().fromArray(pos, idx[first + 2] * 3);
      const nrm = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(Cc, A));
      if (nrm.z < 0) for (let k = first; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    }
    C = [0.02, 0.015, 0.012];
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const fire = fireTexture();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.75, metalness: 0.35, emissive: 0xffffff, emissiveMap: fire, emissiveIntensity: 0, side: THREE.DoubleSide });
  // undersides of the flaps (back faces) stay dark; the outer faces catch light
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.2;'); };
  mat.customProgramCacheKey = () => 'vstar-breach';
  const mesh = new THREE.Mesh(g, mat); mesh.name = 'hullBreaches'; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.scale.setScalar(1e-4); mesh.position.y = -1e4; // compiled at warm-up (visible), frustum-culled until the blast
  return {
    mesh, mat,
    set(k, t = 0) {
      mesh.scale.setScalar(k > 0.001 ? 1 : 1e-4); mesh.position.y = k > 0.001 ? 0 : -1e4;
      const f = 0.8 + 0.12 * Math.sin(t * 11.0) * Math.sin(t * 6.7 + 1.3) + 0.08 * Math.sin(t * 23.0 + 0.4);
      mat.emissiveIntensity = k > 0.001 ? (0.85 + 0.8 * Math.min(1, k * 2.5)) * f : 0;
      fire.offset.set(Math.sin(t * 0.9) * 0.02 + Math.sin(t * 2.3) * 0.01, Math.sin(t * 3.7) * 0.02); // licking flames
    },
  };
}

// ------------------------------------------------------------------ enclosed lifeboat (lofted), length along x
// returns [[geometry, hex], ...] for the painted batch
export function lifeboatParts(xb, yb, z, L = 7.6, Bm = 2.5) {
  const out = [];
  const NS = 16;
  // profile[0] must be the centreline point; cols (optional) = per-profile-point colour
  const loft = (profile, scaleFn, cols = null) => {
    const pos = [], idx = [], col = [];
    const np = profile.length, row = np * 2 - 1;
    for (let i = 0; i <= NS; i++) {
      const s = -1 + 2 * i / NS, [w, hy, y0] = scaleFn(s);
      for (let j = 0; j < row; j++) {
        const pi = j < np ? np - 1 - j : j - np + 1, pj = profile[pi], sgn = j < np - 1 ? -1 : 1;
        pos.push(xb + s * L / 2, yb + y0 + pj[1] * hy, z + sgn * pj[0] * w);
        if (cols) { const c = new THREE.Color(cols[pi]); col.push(c.r, c.g, c.b); }
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < row - 1; j++) {
      const a = i * row + j, b = a + 1, c2 = a + row + 1, d = a + row;
      idx.push(a, d, c2, a, c2, b);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    if (cols) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    // make sure the faces point outward (check a side vertex against the boat axis)
    const p = g.attributes.position, n = g.attributes.normal, ci = Math.floor(NS / 2) * row + 1;
    const cz = p.getZ(ci) - z;
    if (n.getZ(ci) * cz < 0) { const ix = g.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } g.computeVertexNormals(); }
    return g;
  };
  const half = (s) => { const a = Math.abs(s), p = s < 0 ? 2.2 : 3.4; return Math.max(0.02, Math.pow(Math.max(0, 1 - Math.pow(a, p)), 0.55)); };
  // hull: white below the chine, orange topsides
  const hullP = [[0, -1.0], [0.42, -0.9], [0.74, -0.66], [0.9, -0.42], [0.9005, -0.419], [0.98, -0.18], [1.0, 0.0]];
  const WH = 0xe7e4da, OR = 0xf06414;
  const hs = (s) => { const w = half(s) * Bm / 2, sheer = 0.12 * s * s; return [w, 0.95 * (1 - 0.35 * Math.abs(s) ** 3), sheer]; };
  out.push([loft(hullP, hs, [WH, WH, WH, WH, OR, OR, OR]), null]);
  // canopy
  const can = [[0.0, 1.1], [0.5, 1.02], [0.78, 0.8], [0.93, 0.42], [0.97, 0.0]];
  const cs = (s) => { const a = Math.abs(s); const k = Math.pow(Math.max(0, 1 - Math.pow(a / 0.97, 5)), 0.5); return [half(s) * Bm / 2 * Math.max(0.05, k), 1.05 * Math.max(0.03, k), 0.12 * s * s]; };
  out.push([loft(can, cs), OR]);
  // fender / rubbing rail along the gunwale
  for (const sg of [-1, 1]) for (let i = 0; i < NS; i++) {
    const s0 = -1 + 2 * i / NS, s1 = s0 + 2 / NS, [w0] = hs(s0), [w1] = hs(s1);
    const a = new THREE.Vector3(xb + s0 * L / 2, yb + 0.12 * s0 * s0 - 0.02, z + sg * (w0 + 0.05)), b = new THREE.Vector3(xb + s1 * L / 2, yb + 0.12 * s1 * s1 - 0.02, z + sg * (w1 + 0.05));
    const d = new THREE.Vector3().subVectors(b, a), g = new THREE.CylinderGeometry(0.07, 0.07, d.length(), 6, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    out.push([g, 0x2b2d30]);
  }
  // windows on the canopy sides, conning position aft, hatch, hook blocks
  for (const sg of [-1, 1]) for (let k = 0; k < 5; k++) {
    const s = -0.55 + k * 0.24, [w] = cs(s), y = yb + 0.12 * s * s + 0.5;
    const g = new THREE.BoxGeometry(0.42, 0.24, 0.05); g.rotateX(sg * 0.22); g.translate(xb + s * L / 2, y, z + sg * (w * 0.91 + 0.01));
    out.push([g, 0x1a1f24]);
  }
  { const g = new THREE.BoxGeometry(1.0, 0.45, 0.95); g.translate(xb + 0.52 * L / 2, yb + 1.25, z); out.push([g, 0xf06414]); }
  for (const sg of [-1, 1]) { const g = new THREE.BoxGeometry(0.7, 0.2, 0.04); g.translate(xb + 0.52 * L / 2, yb + 1.3, z + sg * 0.48); out.push([g, 0x1a1f24]); }
  { const g = new THREE.BoxGeometry(0.2, 0.2, 0.7); g.translate(xb + 0.52 * L / 2 + 0.51, yb + 1.3, z); out.push([g, 0x1a1f24]); }
  { const g = new THREE.BoxGeometry(0.7, 0.08, 0.6); g.translate(xb - 0.2 * L / 2, yb + 1.14, z); out.push([g, 0xd8d4c9]); }
  for (const s of [-0.68, 0.68]) { const g = new THREE.BoxGeometry(0.22, 0.35, 0.22); g.translate(xb + s * L / 2, yb + 1.2, z); out.push([g, 0x2b2d30]); }
  return out;
}

// ------------------------------------------------------------------ additive glow sprite texture (beacon)
export function beaconGlowTexture() {
  const S = 128, c = makeCanvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,240,210,1)'); g.addColorStop(0.12, 'rgba(255,170,60,0.85)'); g.addColorStop(0.35, 'rgba(255,90,20,0.28)'); g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  // horizontal flare streak
  const s = ctx.createLinearGradient(0, 0, S, 0); s.addColorStop(0, 'rgba(255,120,30,0)'); s.addColorStop(0.5, 'rgba(255,190,110,0.55)'); s.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = s; ctx.fillRect(0, S / 2 - 2, S, 4);
  return canvasTex(c, { repeat: false });
}
