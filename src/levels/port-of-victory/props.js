// PORT OF VICTORY — procedural yard props (forklift, fuel drums, gatehouse, sign gantry, fence,
// high-mast light, bollard, jersey barrier, crate, porta-cabin). All local space, origin on the ground at
// the footprint centre, forward = -z, colliders as local AABBs. No asset files, deterministic RNG.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, at } from '../../geom.js';
import { makeRng } from '../../rng.js';
import { concreteTexture, makeCanvas, canvasTex, heightToNormal } from '../../textures.js';

const PI = Math.PI, HP = Math.PI / 2;
const FONT = '"Arial Black","Liberation Sans","Helvetica Neue",Arial,sans-serif';
const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------- tileable noise ----
function hash3(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(seed) {
  return (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const a = hash3(x0, y0, seed), b = hash3(x1, y0, seed), c = hash3(x0, y1, seed), d = hash3(x1, y1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function tfbm(n, u, v, fx, fy, oct = 4) {
  let s = 0, a = 0.5, t = 0;
  for (let o = 0; o < oct; o++) { const px = fx << o, py = fy << o; s += a * n(u * px, v * py, px, py); t += a; a *= 0.5; }
  return s / t;
}

// ---------------------------------------------------------------- canvas painting ----
// Worn industrial paint into a canvas region: chips to primer/rust, worn edges, vertical grime streaks.
function paint(ctx, X, Y, W, H, o = {}) {
  const base = o.base || [0.86, 0.6, 0.06];
  const seed = o.seed ?? 1, chip = o.chip ?? 0.5, rust = o.rust ?? 0.5, grime = o.grime ?? 0.4, streak = o.streak ?? 0.4;
  const fx = o.fx ?? 4, fy = o.fy ?? 4;
  const n1 = vnoise(seed), n2 = vnoise(seed + 101), n3 = vnoise(seed + 202), n4 = vnoise(seed + 303);
  const rng = makeRng(seed * 31 + 7);
  const img = ctx.createImageData(W, H), hgt = new Float32Array(W * H);
  const under = o.under || [0.2, 0.19, 0.18], rustC = o.rustC || [0.38, 0.19, 0.08];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const lo = tfbm(n1, u, v, fx, fy, 4);
    // chips: high-frequency noise, clustered by a low-frequency wear mask
    const wear = sstep(0.5, 0.72, tfbm(n4, u + 0.31, v + 0.17, fx, fy, 3));
    const c = tfbm(n2, u, v, fx * 12, fy * 12, 3) + wear * 0.16 * chip;
    const thr = 0.79 - chip * 0.04;
    const st = tfbm(n3, u, v, fx * 8, Math.max(1, fy >> 1), 3);
    const rr = tfbm(n4, u, v, fx * 2, fy * 2, 3);
    let k = 0.93 + (lo - 0.5) * 0.45 + (rng() - 0.5) * 0.06;
    k *= 1 - Math.max(0, st - 0.52) * streak * 2.2;
    k *= 1 - Math.max(0, 0.52 - lo) * grime * 1.5;
    let col, h = 1;
    if (c > thr) { col = mix3(under, rustC, clamp01(rust * (rr * 2.2 - 0.6))); k = 0.85 + (rng() - 0.5) * 0.25; h = 0; }
    else if (c > thr - 0.022) { col = base.map((q) => Math.min(1, q * 1.1 + 0.07)); h = 0.75; }
    else { col = base; if (rust > 0.3 && rr > 0.68) col = mix3(base, rustC, (rr - 0.68) * 3 * rust); }
    const i = (y * W + x) * 4;
    img.data[i] = Math.min(255, col[0] * k * 255); img.data[i + 1] = Math.min(255, col[1] * k * 255);
    img.data[i + 2] = Math.min(255, col[2] * k * 255); img.data[i + 3] = 255;
    hgt[y * W + x] = h + lo * 0.3;
  }
  ctx.putImageData(img, X, Y);
  if (o.scratches) scratches(ctx, X, Y, W, H, o.scratches, rng, o.scratchCol || 'rgba(230,220,200,0.35)');
  return hgt;
}
function scratches(ctx, X, Y, W, H, n, rng, col) {
  ctx.save(); ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip();
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = X + rng() * W, y = Y + rng() * H, a = (rng() - 0.5) * 1.2 + (rng() < 0.5 ? 0 : HP), l = 4 + rng() * 26;
    ctx.lineWidth = 0.6 + rng() * 1.2; ctx.globalAlpha = 0.3 + rng() * 0.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
}
// Diagonal yellow/black hazard stripes with chips (tileable when W is a multiple of period)
function hazard(ctx, X, Y, W, H, period = 64, seed = 9) {
  const n = vnoise(seed), n2 = vnoise(seed + 5), rng = makeRng(seed);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = (((x + y) % period) + period) % period < period / 2;
    const c = tfbm(n, x / W, y / H, Math.max(1, (W / 32) | 0), Math.max(1, (H / 32) | 0), 4);
    const g = tfbm(n2, x / W, y / H, Math.max(1, (W / 128) | 0), 1, 3);
    let col = s ? [0.9, 0.66, 0.05] : [0.07, 0.065, 0.06];
    let k = 0.9 + (g - 0.5) * 0.5 + (rng() - 0.5) * 0.07;
    if (c > 0.66) { col = c > 0.7 ? [0.36, 0.2, 0.1] : [0.32, 0.31, 0.3]; }
    const i = (y * W + x) * 4;
    img.data[i] = col[0] * k * 255; img.data[i + 1] = col[1] * k * 255; img.data[i + 2] = col[2] * k * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, X, Y);
}
function fitFont(ctx, text, size, maxW, weight = '900', font = FONT) {
  let s = size;
  for (;;) { ctx.font = `${weight} ${s}px ${font}`; if (!maxW || ctx.measureText(text).width <= maxW || s < 6) return s; s *= 0.94; }
}
// Text with stencil-style wear (specks knocked out)
function stencil(ctx, text, cx, cy, size, color, rng, { maxW = 0, wear = 0.3, align = 'center', weight = '900', font = FONT, bridges = false } = {}) {
  const m = makeCanvas(8, 8).getContext('2d');
  const s = fitFont(m, text, size, maxW, weight, font);
  const tw = Math.ceil(m.measureText(text).width) + 8, th = Math.ceil(s * 1.3);
  const t = makeCanvas(tw, th), c = t.getContext('2d');
  c.font = `${weight} ${s}px ${font}`; c.textBaseline = 'middle'; c.fillStyle = color;
  c.fillText(text, 4, th / 2);
  c.globalCompositeOperation = 'destination-out';
  if (bridges) { c.fillStyle = '#000'; for (let x = 0; x < tw; x += s * 0.62) c.fillRect(x + s * 0.28, 0, s * 0.06, th); c.fillRect(0, th * 0.49, tw, s * 0.05); }
  for (let i = 0; i < tw * th * wear * 0.02; i++) { c.globalAlpha = 0.4 + rng() * 0.6; c.beginPath(); c.arc(rng() * tw, rng() * th, 0.5 + rng() * s * 0.05, 0, 7); c.fill(); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  const x = align === 'center' ? cx - tw / 2 : align === 'right' ? cx - tw : cx;
  ctx.drawImage(t, x, cy - th / 2);
}
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); };
function grimeOverlay(ctx, X, Y, W, H, rng, n = 60, col = '40,30,20') {
  ctx.save(); ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip();
  for (let i = 0; i < n; i++) {
    const x = X + rng() * W, y = Y + rng() * H, r = 2 + rng() * W * 0.06;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${0.12 + rng() * 0.25})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}
function bolts(ctx, pts, r, rng) {
  for (const [x, y] of pts) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x + 1, y + 1, r, 0, 7); ctx.fill();
    ctx.fillStyle = `rgb(${120 + rng() * 40 | 0},${110 + rng() * 30 | 0},${95 + rng() * 20 | 0})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, 7); ctx.fill();
  }
}
// pixel rect on a W×H canvas → uv rect [u0,v0,u1,v1] (CanvasTexture flipY)
const PR = (W, H, x0, y0, x1, y1) => [x0 / W, 1 - y1 / H, x1 / W, 1 - y0 / H];

// ---------------------------------------------------------------- geometry helpers ----
const KEEP = ['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'];
const WHITE = [1, 1, 1];
function uvRect(g, r) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1]));
  return g;
}
function uvPoint(g, u, v) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v); return g; }
function uvScale(g, s) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); return g; }
const B = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, uvs = 0) => at(box(w, h, d, uvs), x, y, z, rx, ry, rz);
const C = (rt, rb, h, seg, x, y, z, rx = 0, ry = 0, rz = 0, open = false) => at(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), x, y, z, rx, ry, rz);
// cylinder between two points
function rod(a, b, r, seg = 6, open = true) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg, 1, open);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(A.add(Bv).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
// box strut between two points (square section)
function strut(a, b, t) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length();
  const g = box(t, L, t);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(A.add(Bv).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
const decal = (w, h, rect, x, y, z, ry = 0, rx = 0) => at(uvRect(new THREE.PlaneGeometry(w, h), rect), x, y, z, rx, ry, 0);
// Lathe around +y with explicit v per profile point, u across [u0,u1]
function lathe(pts, segs, vs, u0 = 0, u1 = 1) {
  const g = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segs);
  const uv = g.attributes.uv, np = pts.length;
  for (let i = 0; i <= segs; i++) for (let j = 0; j < np; j++) uv.setXY(i * np + j, u0 + (u1 - u0) * (i / segs), vs[j]);
  g.computeVertexNormals();
  return g;
}
// Extrude a (z,y) profile along x (x0→x1); uv in world metres / uvs
function extrudeX(pts, x0, x1, uvs = 1) {
  const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(-p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(HP); g.translate(x0, 0, 0);
  uvScale(g, 1 / uvs);
  return g;
}
class Parts {
  constructor(n, skinned = false) { this.lists = Array.from({ length: n }, () => []); this.skinned = skinned; }
  add(g, mi, col = WHITE, bone = 0) {
    if (g.index) g = g.toNonIndexed();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    if (this.skinned) {
      const si = new Float32Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bone; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    }
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    g.morphAttributes = {};
    this.lists[mi].push(g);
    return g;
  }
  geometry(grime = {}) {
    const parts = [], mis = [];
    this.lists.forEach((arr, mi) => {
      if (!arr.length) return;
      const g = mergeGeometries(arr, false);
      if (grime[mi]) {
        const p = g.attributes.position, c = g.attributes.color;
        for (let i = 0; i < p.count; i++) { const k = grime[mi](p.getX(i), p.getY(i), p.getZ(i)); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
      }
      parts.push(g); mis.push(mi);
    });
    const g = mergeGeometries(parts, true);
    g.groups.forEach((gr, i) => { gr.materialIndex = mis[i]; });
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
function meshOf(g, mats, cast = true, recv = true) { const m = new THREE.Mesh(g, mats); m.castShadow = cast; m.receiveShadow = recv; return m; }
const groundGrime = (lo, hi, min) => (x, y) => min + (1 - min) * sstep(lo, hi, y);

// ---------------------------------------------------------------- shared materials ----
function std(o) { return new THREE.MeshStandardMaterial(o); }
function duskMat(o, peak) { const m = std({ emissiveIntensity: 0, ...o }); m.userData.duskEmissive = peak; return m; }

const yellowPaintMat = () => once('yellowPaint', () => {
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
  const h = paint(x, 0, 0, S, S, { base: [0.88, 0.6, 0.05], under: [0.36, 0.33, 0.28], seed: 11, chip: 0.45, rust: 0.7, grime: 0.5, streak: 0.22, scratches: 260, fx: 4, fy: 4 });
  grimeOverlay(x, 0, 0, S, S, makeRng(3), 50);
  return std({ map: canvasTex(c), normalMap: heightToNormal(h, S, S, 2.5), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.62, metalness: 0.25, vertexColors: true });
});
const steelTex = () => once('steelTex', () => {
  const S = 256, c = makeCanvas(S, S), x = c.getContext('2d');
  paint(x, 0, 0, S, S, { base: [0.62, 0.62, 0.6], under: [0.42, 0.4, 0.38], seed: 21, chip: 0.4, rust: 0.8, grime: 0.6, streak: 0.6, scratches: 160, fx: 4, fy: 4 });
  return canvasTex(c);
});
const darkMat = () => once('darkMat', () => std({ map: steelTex(), roughness: 0.7, metalness: 0.55, vertexColors: true }));
const galvMat = () => once('galvMat', () => std({ map: steelTex(), color: 0xd0d2d4, roughness: 0.55, metalness: 0.65, vertexColors: true }));
const hazardMat = () => once('hazardMat', () => {
  const c = makeCanvas(256, 256); hazard(c.getContext('2d'), 0, 0, 256, 256, 64, 31);
  return std({ map: canvasTex(c), roughness: 0.7, metalness: 0.2, vertexColors: true });
});
const concreteMat = (tint = [0.66, 0.64, 0.6], seed = 5) => once('concrete' + seed + tint.join(), () => {
  const t = concreteTexture(seed, tint, 256);
  return std({ map: t, roughness: 0.92, metalness: 0, vertexColors: true });
});
const lampMat = () => once('lampMat', () => duskMat({ color: 0xfff2d8, emissive: 0xffc890, roughness: 0.2, metalness: 0.1 }, 2.5));

// Interior seen through windows (fluorescent office), used as map + emissiveMap
function interiorTex(seed) {
  const W = 512, H = 256, c = makeCanvas(W, H), x = c.getContext('2d'), r = makeRng(seed);
  let g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#d8d4b8'); g.addColorStop(0.6, '#b8b49a'); g.addColorStop(1, '#4a463c');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // ceiling fluorescent strips
  for (let i = 0; i < 4; i++) { const cx = 40 + i * 130 + r() * 20; x.fillStyle = '#fffbea'; x.fillRect(cx, 8, 70, 7); x.fillStyle = 'rgba(255,250,220,0.25)'; x.fillRect(cx - 20, 0, 110, 30); }
  // shelves / binders
  for (let s = 0; s < 3; s++) {
    const sx = 20 + s * 170 + r() * 30, sy = 60 + r() * 20;
    x.fillStyle = '#5a5246'; x.fillRect(sx, sy, 110, 90);
    for (let row = 0; row < 3; row++) for (let b = 0; b < 12; b++) {
      if (r() < 0.2) continue;
      x.fillStyle = ['#2c4a8a', '#a8282a', '#d8c040', '#3a6a3a', '#e8e8e0', '#202020'][(r() * 6) | 0];
      x.fillRect(sx + 4 + b * 8.8, sy + 4 + row * 29, 7, 24);
    }
  }
  // notice board / calendar
  x.fillStyle = '#8a6a3a'; x.fillRect(360 + r() * 40, 50, 80, 60);
  for (let i = 0; i < 6; i++) { x.fillStyle = ['#fff', '#ffe680', '#f0f0d0'][i % 3]; x.fillRect(365 + r() * 70 + r() * 30, 55 + r() * 45, 14, 18); }
  // desk + monitors (blue glow)
  x.fillStyle = '#3a3026'; x.fillRect(0, 168, W, 30);
  for (let i = 0; i < 3; i++) {
    const mx = 60 + i * 150 + r() * 40;
    x.fillStyle = '#111'; x.fillRect(mx, 120, 66, 48);
    const mg = x.createLinearGradient(mx, 124, mx, 162); mg.addColorStop(0, '#6ab0ff'); mg.addColorStop(1, '#2a5aa8');
    x.fillStyle = mg; x.fillRect(mx + 4, 124, 58, 38);
    x.fillStyle = 'rgba(255,255,255,0.5)'; for (let l = 0; l < 4; l++) x.fillRect(mx + 8, 130 + l * 8, 20 + r() * 30, 2);
  }
  // chair silhouette, mug, papers
  x.fillStyle = '#1a1a1a'; x.fillRect(250 + r() * 60, 140, 40, 70);
  x.fillStyle = '#f0ede0'; for (let i = 0; i < 5; i++) x.fillRect(r() * W, 164 + r() * 4, 20, 4);
  // blinds partly down
  for (let p = 0; p < 4; p++) {
    const bx = p * 128, bh = 20 + r() * 70;
    for (let y = 0; y < bh; y += 5) { x.fillStyle = 'rgba(200,196,170,0.95)'; x.fillRect(bx, y, 128, 3.2); x.fillStyle = 'rgba(60,55,45,0.6)'; x.fillRect(bx, y + 3.2, 128, 1); }
  }
  // grime / reflection streaks on glass
  grimeOverlay(x, 0, 0, W, H, r, 40, '30,26,20');
  x.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 6; i++) { x.save(); x.translate(r() * W, 0); x.rotate(0.4); x.fillRect(0, -50, 20 + r() * 40, 400); x.restore(); }
  return canvasTex(c, { repeat: false });
}
const windowMat = () => once('windowMat', () => {
  const t = interiorTex(17);
  return duskMat({ map: t, emissiveMap: t, emissive: 0xffe6c0, color: 0x7a7a74, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.4 }, 1.4);
});

// ================================================================ 1. FORKLIFT ====
function forkliftAtlas() {
  const W = 1024, H = 1024, c = makeCanvas(W, H), x = c.getContext('2d'), r = makeRng(77);
  // --- tyre tread strip (0..128)
  x.fillStyle = '#121110'; x.fillRect(0, 0, W, 128);
  const lugs = 26, p = W / lugs;
  for (let i = -1; i <= lugs; i++) {
    const x0 = i * p;
    x.fillStyle = '#262422';
    poly(x, [[x0, 0], [x0 + p * 0.5, 0], [x0 + p * 0.95, 60], [x0 + p * 0.45, 60]]);
    poly(x, [[x0 + p * 0.5, 128], [x0 + p, 128], [x0 + p * 1.45, 68], [x0 + p * 0.95, 68]]);
    x.fillStyle = 'rgba(120,105,85,0.25)';
    poly(x, [[x0, 0], [x0 + p * 0.5, 0], [x0 + p * 0.56, 8], [x0 + p * 0.06, 8]]);
  }
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${130 + r() * 40 | 0},${110 + r() * 30 | 0},${80 + r() * 20 | 0},${r() * 0.18})`; x.fillRect(r() * W, r() * 128, 1 + r() * 3, 1 + r() * 2); }
  // --- sidewall (128..192)
  x.fillStyle = '#141312'; x.fillRect(0, 128, W, 64);
  x.fillStyle = '#1d1c1a'; x.fillRect(0, 150, W, 3); x.fillRect(0, 176, W, 2);
  x.font = `700 22px ${FONT}`; x.fillStyle = '#2c2a27'; x.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) x.fillText('16.00-25  ·  32 PR  ·  IND-4  ·  TUBELESS', 20 + i * 345, 164);
  // dust on lower sidewall
  for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(140,120,90,${r() * 0.15})`; x.fillRect(r() * W, 128 + r() * 30, 2, 2); }
  // --- hazard strip (192..320)
  hazard(x, 0, 192, W, 128, 96, 5);
  // --- plates
  paint(x, 0, 320, 512, 128, { base: [0.88, 0.6, 0.05], seed: 40, chip: 0.4, fx: 4, fy: 1 });
  stencil(x, 'FL-07', 256, 384, 110, '#141210', r, { maxW: 480, wear: 0.4, bridges: true });
  paint(x, 512, 320, 512, 128, { base: [0.88, 0.6, 0.05], seed: 41, chip: 0.4, fx: 4, fy: 1 });
  stencil(x, '16 000 kg', 768, 370, 74, '#141210', r, { maxW: 470, wear: 0.35 });
  stencil(x, 'SWL @ 1200 mm LOAD CENTRE', 768, 425, 26, '#141210', r, { maxW: 470, wear: 0.2, weight: '700' });
  // red DANGER plate
  paint(x, 0, 448, 512, 128, { base: [0.72, 0.08, 0.05], seed: 42, chip: 0.25, fx: 4, fy: 1, rust: 0.2 });
  x.fillStyle = '#eee8dc'; x.fillRect(8, 456, 496, 6); x.fillRect(8, 562, 496, 6);
  stencil(x, 'DANGER', 256, 494, 60, '#f4efe4', r, { maxW: 470, wear: 0.2 });
  stencil(x, 'KEEP CLEAR OF FORKS', 256, 540, 32, '#f4efe4', r, { maxW: 470, wear: 0.2, weight: '700' });
  // fleet livery
  paint(x, 512, 448, 512, 128, { base: [0.88, 0.6, 0.05], seed: 43, chip: 0.45, fx: 4, fy: 1 });
  x.fillStyle = '#141210'; x.fillRect(530, 462, 92, 100);
  stencil(x, 'V', 576, 512, 84, '#e0a010', r, { wear: 0.2 });
  stencil(x, 'PORT OF VICTORY', 810, 496, 46, '#141210', r, { maxW: 370, wear: 0.3 });
  stencil(x, 'TERMINAL 4  ·  HEAVY PLANT', 810, 540, 22, '#141210', r, { maxW: 370, wear: 0.2, weight: '700' });
  // --- hub face (0..128, 576..704)
  x.fillStyle = '#2a2826'; x.fillRect(0, 576, 128, 128);
  let gg = x.createRadialGradient(64, 640, 6, 64, 640, 64); gg.addColorStop(0, '#6a5a2a'); gg.addColorStop(0.35, '#c08a10'); gg.addColorStop(0.85, '#a87808'); gg.addColorStop(1, '#3a2c10');
  x.fillStyle = gg; x.beginPath(); x.arc(64, 640, 63, 0, 7); x.fill();
  x.fillStyle = '#2a2420'; x.beginPath(); x.arc(64, 640, 22, 0, 7); x.fill();
  const bp = []; for (let i = 0; i < 10; i++) bp.push([64 + Math.cos(i * PI / 5) * 32, 640 + Math.sin(i * PI / 5) * 32]);
  bolts(x, bp, 4.2, r);
  grimeOverlay(x, 0, 576, 128, 128, r, 30, '60,40,20');
  // --- louvre grille (128..384, 576..704)
  x.fillStyle = '#121110'; x.fillRect(128, 576, 256, 128);
  for (let y = 584; y < 700; y += 12) { x.fillStyle = '#c08a0c'; x.fillRect(132, y, 248, 5); x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(132, y + 5, 248, 2); }
  grimeOverlay(x, 128, 576, 256, 128, r, 30);
  // --- rubber / misc patch (384..512, 576..704)
  x.fillStyle = '#131211'; x.fillRect(384, 576, 128, 128);
  // --- cab seat vinyl (512..640, 576..704)
  x.fillStyle = '#1e1d1b'; x.fillRect(512, 576, 128, 128);
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(512, 590 + i * 20, 128, 3); }
  return canvasTex(c, { repeat: false, aniso: 8 });
}
const FA = (x0, y0, x1, y1) => PR(1024, 1024, x0, y0, x1, y1);
const lightAtlas = () => once('lightAtlas', () => {
  const c = makeCanvas(64, 16), x = c.getContext('2d');
  ['#fffbf0', '#ffa018', '#ff2010', '#ffc070'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 16, 0, 16, 16); });
  const t = canvasTex(c, { repeat: false, mips: false }); t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
});
const L_WHITE = 0.125, L_AMBER = 0.375, L_RED = 0.625, L_SODIUM = 0.875;

export function buildForklift() {
  const YEL = 0, DRK = 1, DEC = 2, LIT = 3;
  const P = new Parts(4, true);
  // bone indices
  const BASE = 0, INNER = 1, CARR = 2, WFL = 3, WFR = 4, SRL = 5, SRR = 6, WRL = 7, WRR = 8;
  const FZ = -1.35, RZ = 1.75, FR = 0.6, RR = 0.55, WX = 1.0;
  const ys = 1.6; // paint uv scale (m per tile)
  const blk = [0.09, 0.085, 0.08], grey = [0.32, 0.31, 0.3], steel = [0.55, 0.52, 0.48], rod_ = [1.25, 1.25, 1.3], forkC = [0.36, 0.3, 0.26];
  const yAdd = (g, col = WHITE, bone = BASE) => P.add(g, YEL, col, bone);
  const dAdd = (g, col = grey, bone = BASE) => P.add(g, DRK, col, bone);
  const eAdd = (g, bone = BASE, col = WHITE) => P.add(g, DEC, col, bone);

  // ---- chassis
  dAdd(B(1.44, 0.85, 4.5, 0, 0.8, 0.1, 0, 0, 0, ys), [0.22, 0.2, 0.18]);                  // frame rails
  yAdd(B(2.66, 0.14, 4.3, 0, 1.33, 0.0, 0, 0, 0, ys));                                  // upper deck
  yAdd(B(2.66, 0.08, 0.12, 0, 1.22, -2.09, 0, 0, 0, ys), [0.8, 0.8, 0.8]);              // deck front lip
  for (const s of [-1, 1]) {
    // front fenders (sloped front) + side pods (fuel / hydraulic tanks)
    yAdd(B(0.62, 0.06, 1.5, s * 1.02, 1.42, FZ, 0, 0, 0, ys));
    yAdd(B(0.62, 0.32, 0.06, s * 1.02, 1.28, FZ - 0.74, 0.5, 0, 0, ys));
    yAdd(B(0.58, 0.74, 1.8, s * 1.02, 0.93, 0.22, 0, 0, 0, ys));
    dAdd(B(0.6, 0.06, 1.78, s * 1.03, 0.55, 0.22), [0.15, 0.14, 0.13]);
    // tank caps / filler, straps
    dAdd(C(0.07, 0.07, 0.05, 8, s * 1.0, 1.43, 0.75), blk);
    for (const z of [-0.35, 0.8]) dAdd(B(0.6, 0.76, 0.04, s * 1.03, 0.93, z), [0.18, 0.17, 0.16]);
    // access steps on the left pod
    if (s < 0) for (let k = 0; k < 2; k++) dAdd(B(0.34, 0.04, 0.4, -1.42, 0.62 + k * 0.42, -0.25), steel);
  }
  // ---- counterweight (rear, rounded) — upper wide block over the rear wheels
  yAdd(extrudeX([[1.2, 1.2], [2.6, 1.2], [2.64, 1.55], [2.58, 1.8], [2.44, 1.97], [1.2, 1.99]], -1.32, 1.32, ys));
  yAdd(B(1.44, 0.85, 1.6, 0, 0.8, 1.82, 0, 0, 0, ys), [0.85, 0.85, 0.85]);              // centre lower block
  yAdd(extrudeX([[2.32, 0.42], [2.5, 0.42], [2.62, 0.6], [2.64, 1.22], [2.32, 1.22]], -1.32, 1.32, ys)); // rear skirt
  dAdd(B(0.34, 0.24, 0.3, 0, 0.62, 2.72), [0.2, 0.19, 0.18]);                           // tow jaw
  dAdd(C(0.05, 0.05, 0.36, 8, 0, 0.72, 2.72), steel);                                    // tow pin
  // engine hood (slanted) + grilles
  yAdd(extrudeX([[0.62, 1.4], [1.3, 1.4], [1.3, 2.0], [1.16, 2.24], [0.62, 2.28]], -1.0, 1.0, ys));
  for (const s of [-1, 1]) eAdd(decal(0.5, 0.42, FA(140, 580, 380, 700), s * 1.005, 1.75, 0.96, s * HP));
  eAdd(decal(1.6, 0.34, FA(140, 580, 380, 700), 0, 1.98, 2.5, 0, -0.5));                 // rear radiator grille (sloped)
  // air pre-cleaner and exhaust stack
  dAdd(C(0.09, 0.09, 0.55, 10, 0.75, 2.5, 0.8), [0.12, 0.11, 0.1]);
  dAdd(C(0.13, 0.11, 0.12, 10, 0.75, 2.82, 0.8), [0.1, 0.1, 0.1]);
  dAdd(C(0.07, 0.07, 1.25, 8, -0.78, 2.9, 1.05), [0.2, 0.17, 0.15]);
  dAdd(C(0.09, 0.09, 0.3, 8, -0.78, 2.45, 1.05), [0.14, 0.13, 0.12]);                    // heat shield
  dAdd(B(0.16, 0.02, 0.18, -0.78, 3.56, 1.1, 0.35, 0, 0), [0.15, 0.13, 0.12]);           // rain flap

  // ---- cab + overhead guard
  const cz0 = -1.3, cz1 = 0.6, cx = 0.93, roofY = 3.52;
  for (const sx of [-1, 1]) for (const z of [cz0, cz1]) yAdd(B(0.1, roofY - 1.4, 0.1, sx * cx, (roofY + 1.4) / 2, z, 0, 0, 0, ys));
  yAdd(B(2.0, 0.1, 0.12, 0, roofY, cz0, 0, 0, 0, ys)); yAdd(B(2.0, 0.1, 0.12, 0, roofY, cz1, 0, 0, 0, ys));
  for (const sx of [-1, 1]) yAdd(B(0.12, 0.1, 2.02, sx * cx, roofY, (cz0 + cz1) / 2, 0, 0, 0, ys));
  for (let i = 0; i < 7; i++) dAdd(B(0.07, 0.07, 1.86, -0.75 + i * 0.25, roofY + 0.05, (cz0 + cz1) / 2), [0.16, 0.15, 0.14]); // guard slats
  yAdd(B(2.0, 0.025, 1.9, 0, roofY - 0.06, (cz0 + cz1) / 2, 0, 0, 0, ys), [0.9, 0.9, 0.9]);   // roof panel underside
  // cab lower panels (dash front, right side, rear) + door frame
  yAdd(B(1.86, 0.75, 0.05, 0, 1.78, cz0, 0, 0, 0, ys));
  yAdd(B(0.05, 0.6, 1.86, cx, 1.7, (cz0 + cz1) / 2, 0, 0, 0, ys));
  yAdd(B(1.86, 0.95, 0.05, 0, 1.88, cz1, 0, 0, 0, ys));
  dAdd(B(1.86, 0.06, 0.06, 0, 2.95, cz0), blk);                                          // windscreen header
  dAdd(B(1.86, 0.035, 0.035, 0, 2.15, cz0 - 0.01), blk);
  for (const sx of [-1, 1]) dAdd(rod([sx * 0.88, 1.6, cz1 - 0.05], [sx * 0.88, 2.9, cz0 + 0.1], 0.02), blk); // grab rails
  dAdd(B(0.05, 0.05, 0.6, -1.0, 2.3, -0.6), [0.7, 0.66, 0.2]);                          // door grab handle
  // floor plate, dash, steering, seat, levers
  dAdd(B(1.8, 0.04, 1.86, 0, 1.42, (cz0 + cz1) / 2), [0.2, 0.19, 0.18]);
  dAdd(B(1.2, 0.3, 0.42, 0, 2.06, cz0 + 0.24, -0.25, 0, 0), [0.1, 0.1, 0.1]);           // dash pod
  dAdd(C(0.05, 0.06, 0.6, 8, 0, 2.08, -0.88, -0.5, 0, 0), blk);                          // steering column
  dAdd(at(new THREE.TorusGeometry(0.19, 0.022, 5, 14), 0, 2.36, -0.74, -0.6 - HP + HP * 0.0, 0, 0), blk);
  dAdd(B(0.04, 0.3, 0.02, 0, 2.36, -0.74, -0.6 - HP + HP, 0, 0), blk);
  // seat (vinyl from atlas) — cushion top at y≈1.97, backrest at z≈+0.45
  eAdd(uvRect(B(0.56, 0.16, 0.52, 0, 1.92, 0.15), FA(514, 578, 638, 702)));
  eAdd(uvRect(B(0.56, 0.68, 0.14, 0, 2.32, 0.46, -0.12), FA(514, 578, 638, 702)));
  dAdd(B(0.42, 0.42, 0.42, 0, 1.63, 0.18), [0.12, 0.12, 0.12]);                          // suspension base
  dAdd(B(0.12, 0.1, 0.34, 0.42, 2.1, 0.1), blk);                                        // armrest
  for (let i = 0; i < 4; i++) {
    dAdd(rod([0.5 + i * 0.06, 1.95, -0.3], [0.52 + i * 0.06, 2.32, -0.42 + i * 0.01], 0.012, 4), blk);
    dAdd(B(0.035, 0.05, 0.035, 0.52 + i * 0.06, 2.34, -0.43), [[0.6, 0.05, 0.03], [0.1, 0.1, 0.1], [0.75, 0.6, 0.1], [0.1, 0.1, 0.1]][i]);
  }
  for (const sx of [-0.25, 0.22, 0.4]) dAdd(B(0.1, 0.03, 0.18, sx, 1.58, -1.05, 0.6), blk); // pedals
  // mirrors
  for (const sx of [-1, 1]) {
    dAdd(rod([sx * cx, 3.1, cz0], [sx * 1.25, 3.1, cz0 - 0.15], 0.015, 4), blk);
    dAdd(B(0.04, 0.3, 0.2, sx * 1.27, 3.1, cz0 - 0.15, 0, sx * 0.4, 0), blk);
  }
  // decals: fleet livery on counterweight sides, FL-07 on cab rear and fenders, danger on mast, hazard on rear
  for (const s of [-1, 1]) {
    eAdd(decal(1.18, 0.3, FA(512, 448, 1024, 576), s * 1.325, 1.6, 1.9, s * HP));
    eAdd(decal(0.5, 0.125, FA(0, 320, 512, 448), s * 1.315, 1.0, 0.5, s * HP));
    eAdd(decal(0.42, 0.1, FA(512, 320, 1024, 448), s * 1.335, 1.32, -1.35, s * HP));
  }
  eAdd(decal(2.2, 0.3, FA(0, 192, 1024, 320), 0, 0.98, 2.645, 0));
  eAdd(decal(0.8, 0.2, FA(0, 320, 512, 448), 0, 1.5, 2.655, 0, -0.08));
  eAdd(decal(0.9, 0.22, FA(0, 448, 512, 576), 0, 1.58, -1.33, PI));                     // dash front: DANGER keep clear
  eAdd(decal(2.0, 0.1, FA(0, 192, 1024, 320), 0, roofY, cz0 - 0.065, PI));              // hazard on guard front edge
  // lights: taillights, cab headlights, beacon
  for (const s of [-1, 1]) {
    dAdd(B(0.24, 0.14, 0.06, s * 1.08, 1.55, 2.6), blk);
    P.add(uvPoint(B(0.2, 0.1, 0.02, s * 1.08, 1.55, 2.635), L_RED, 0.5), LIT);
  }
  const headPos = [];
  for (const s of [-1, 1]) {
    dAdd(B(0.26, 0.18, 0.16, s * 0.72, roofY - 0.18, cz0 - 0.1), blk);
    P.add(uvPoint(C(0.07, 0.07, 0.02, 10, s * 0.72, roofY - 0.18, cz0 - 0.185, HP), L_WHITE, 0.5), LIT);
    headPos.push([s * 0.72, roofY - 0.18, cz0 - 0.2]);
  }
  dAdd(C(0.09, 0.1, 0.06, 10, 0.55, roofY + 0.11, 0.35), blk);
  P.add(uvPoint(lathe([[0, 0], [0.075, 0], [0.075, 0.12], [0.05, 0.17], [0, 0.18]], 10, [0, 0, 0, 0, 0]).translate(0.55, roofY + 0.14, 0.35), L_AMBER, 0.5), LIT);

  // ---- wheels (front drive, rear steer)
  const wheel = (wx, wz, R, Wd, bone) => {
    const hw = Wd / 2, rim = R * 0.58, s = Math.sign(wx);
    const side = FA(0, 130, 1024, 190), tread = FA(0, 0, 1024, 128);
    const prof = [[rim, -hw * 0.82], [R * 0.86, -hw], [R * 0.97, -hw * 0.92]];
    const sideA = lathe(prof, 22, [side[1], (side[1] + side[3]) / 2, side[3]], 0, 1);
    const tr = lathe([[R * 0.97, -hw * 0.92], [R, -hw * 0.7], [R, hw * 0.7], [R * 0.97, hw * 0.92]], 22, [tread[1], tread[1] + 0.012, tread[3] - 0.012, tread[3]], 0, 1);
    const sideB = lathe(prof.slice().reverse().map((p) => [p[0], -p[1]]), 22, [side[3], (side[1] + side[3]) / 2, side[1]], 0, 1);
    for (const g of [sideA, tr, sideB]) { g.rotateZ(HP); g.translate(wx, R, wz); eAdd(g, bone); }
    // rim barrel + hub disc (outer face) + inner disc
    yAdd(C(rim, rim, Wd * 0.8, 14, wx, R, wz, 0, 0, HP, true), [0.75, 0.75, 0.75], bone);
    const hub = uvRect(new THREE.CircleGeometry(rim, 14), FA(1, 577, 127, 703));
    hub.rotateY(s * HP); hub.translate(wx + s * hw * 0.55, R, wz); eAdd(hub, bone);
    const hub2 = new THREE.CircleGeometry(rim, 10); hub2.rotateY(-s * HP); hub2.translate(wx - s * hw * 0.4, R, wz);
    dAdd(hub2, [0.1, 0.1, 0.1], bone);
  };
  wheel(-WX - 0.08, FZ, FR, 0.56, WFL); wheel(WX + 0.08, FZ, FR, 0.56, WFR);
  wheel(-WX, RZ, RR, 0.46, WRL); wheel(WX, RZ, RR, 0.46, WRR);
  // axle / steering knuckles
  dAdd(B(1.9, 0.26, 0.3, 0, FR, FZ), [0.16, 0.15, 0.14]);
  dAdd(B(1.7, 0.2, 0.24, 0, RR + 0.05, RZ), [0.16, 0.15, 0.14]);
  for (const s of [-1, 1]) dAdd(C(0.16, 0.16, 0.2, 10, s * 0.92, FR, FZ, 0, 0, HP), [0.2, 0.18, 0.16]);

  // ---- mast (outer stage fixed, inner stage + carriage move)
  const MZ = -2.42;
  for (const s of [-1, 1]) {
    dAdd(B(0.13, 3.82, 0.3, s * 0.62, 2.16, MZ), [0.2, 0.19, 0.18]);                     // outer channels
    dAdd(B(0.05, 3.82, 0.3, s * 0.54, 2.16, MZ), [0.14, 0.13, 0.12]);
    dAdd(rod([s * 0.62, 1.15, -1.95], [s * 0.62, 1.95, MZ + 0.12], 0.07, 8), [0.24, 0.22, 0.2]);   // tilt cylinders
    dAdd(rod([s * 0.62, 1.95, MZ + 0.12], [s * 0.62, 2.12, MZ + 0.18], 0.04, 6), rod_);
  }
  dAdd(B(1.38, 0.2, 0.3, 0, 3.96, MZ), [0.2, 0.19, 0.18]);
  dAdd(B(1.38, 0.18, 0.3, 0, 0.36, MZ), [0.2, 0.19, 0.18]);
  dAdd(B(1.38, 0.14, 0.24, 0, 2.2, MZ + 0.04), [0.2, 0.19, 0.18]);
  dAdd(B(1.2, 0.5, 0.25, 0, 0.75, -2.2), [0.18, 0.17, 0.16]);                           // mast mount
  for (const s of [-1, 1]) dAdd(C(0.1, 0.1, 3.2, 10, s * 0.3, 1.95, MZ + 0.2), [0.24, 0.22, 0.2]); // lift cylinders
  eAdd(decal(0.12, 2.6, FA(0, 192, 1024, 320), -0.62, 2.3, MZ - 0.152, PI, 0).rotateZ(0), BASE);
  // mast-top work lights
  for (const s of [-1, 1]) {
    dAdd(B(0.24, 0.18, 0.16, s * 0.5, 4.16, MZ - 0.06), blk);
    P.add(uvPoint(C(0.065, 0.065, 0.02, 10, s * 0.5, 4.16, MZ - 0.145, HP), L_WHITE, 0.5), LIT);
    headPos.push([s * 0.5, 4.16, MZ - 0.16]);
  }
  // inner stage
  for (const s of [-1, 1]) {
    dAdd(B(0.11, 3.8, 0.24, s * 0.44, 2.2, MZ - 0.08), [0.24, 0.23, 0.21], INNER);
    dAdd(C(0.065, 0.065, 0.5, 8, s * 0.3, 3.75, MZ + 0.2), rod_, INNER);                // cylinder rods
    dAdd(C(0.1, 0.1, 0.08, 10, s * 0.3, 4.03, MZ + 0.05, 0, 0, HP), steel, INNER);      // chain sheaves
    dAdd(B(0.05, 2.6, 0.03, s * 0.3, 2.75, MZ + 0.02), [0.12, 0.11, 0.1], INNER);        // chains (hint)
  }
  dAdd(B(1.0, 0.18, 0.3, 0, 4.02, MZ - 0.02), [0.24, 0.23, 0.21], INNER);
  dAdd(B(1.0, 0.12, 0.24, 0, 0.42, MZ - 0.08), [0.24, 0.23, 0.21], INNER);
  // carriage: two bars, backrest, side plates, forks
  const CZ = MZ - 0.24;
  dAdd(B(2.3, 0.16, 0.1, 0, 1.06, CZ), [0.2, 0.19, 0.18], CARR);
  dAdd(B(2.3, 0.14, 0.1, 0, 0.36, CZ), [0.2, 0.19, 0.18], CARR);
  for (const s of [-1, 1]) dAdd(B(0.1, 0.86, 0.12, s * 1.1, 0.71, CZ), [0.2, 0.19, 0.18], CARR);
  for (let i = 0; i < 7; i++) dAdd(B(0.05, 0.85, 0.05, -0.9 + i * 0.3, 1.56, CZ + 0.02), [0.18, 0.17, 0.16], CARR);
  dAdd(B(2.0, 0.07, 0.07, 0, 1.97, CZ + 0.02), [0.18, 0.17, 0.16], CARR);
  for (const s of [-1, 1]) dAdd(B(0.07, 0.95, 0.07, s * 1.0, 1.5, CZ + 0.02), [0.18, 0.17, 0.16], CARR);
  eAdd(decal(2.2, 0.12, FA(0, 192, 1024, 320), 0, 1.06, CZ - 0.052, PI), CARR);
  for (const s of [-1, 1]) {
    const fx = s * 0.5;
    dAdd(B(0.18, 1.05, 0.08, fx, 0.6, CZ - 0.09), forkC, CARR);                         // shank
    dAdd(B(0.2, 0.1, 0.12, fx, 1.06, CZ - 0.02), forkC, CARR);                           // hook
    dAdd(B(0.18, 0.09, 2.2, fx, 0.075, CZ - 1.23), forkC, CARR);                         // blade
    dAdd(B(0.18, 0.05, 0.24, fx, 0.055, CZ - 2.44, -0.12), forkC, CARR);                 // tapered tip
    dAdd(B(0.19, 0.12, 0.12, fx, 0.11, CZ - 0.13, 0.7), forkC, CARR);                    // heel
  }

  const geo = P.geometry({ [YEL]: groundGrime(0.2, 1.9, 0.5), [DRK]: groundGrime(0.0, 1.0, 0.7) });
  const decalMat = once('forkDecal', () => std({ map: forkliftAtlas(), roughness: 0.82, metalness: 0.1, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 }));
  const litMat = once('forkLit', () => { const t = lightAtlas(); return duskMat({ map: t, emissiveMap: t, emissive: 0xffffff, roughness: 0.15, metalness: 0.0 }, 2.5); });
  const mats = [yellowPaintMat(), darkMat(), decalMat, litMat];

  const mesh = new THREE.SkinnedMesh(geo, mats);
  mesh.castShadow = mesh.receiveShadow = true;
  const mkB = (name, parent, pos) => { const b = new THREE.Bone(); b.name = name; b.position.set(...pos); if (parent) parent.add(b); return b; };
  const base = mkB('base', null, [0, 0, 0]);
  const inner = mkB('inner', base, [0, 0, 0]);
  const carr = mkB('carriage', base, [0, 0, 0]);
  const wFL = mkB('wFL', base, [-WX - 0.08, FR, FZ]), wFR = mkB('wFR', base, [WX + 0.08, FR, FZ]);
  const sRL = mkB('sRL', base, [-WX, RR, RZ]), sRR = mkB('sRR', base, [WX, RR, RZ]);
  const wRL = mkB('wRL', sRL, [0, 0, 0]), wRR = mkB('wRR', sRR, [0, 0, 0]);
  mesh.add(base); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([base, inner, carr, wFL, wFR, sRL, sRR, wRL, wRR]));
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.2, -0.8), 5.2);
  mesh.frustumCulled = true;

  const root = new THREE.Group(); root.name = 'forklift'; root.add(mesh);
  const seat = new THREE.Object3D(); seat.name = 'seat'; seat.position.set(0, 2.02, 0.2); root.add(seat);
  const forks = new THREE.Object3D(); forks.name = 'forks'; forks.position.set(0, 0.12, CZ - 0.14); carr.add(forks);
  const exhaust = new THREE.Object3D(); exhaust.name = 'exhaust'; exhaust.position.set(-0.78, 3.55, 1.05); root.add(exhaust);
  const beacon = new THREE.Object3D(); beacon.name = 'beacon'; beacon.position.set(0.55, roofY + 0.24, 0.35); root.add(beacon);
  const headlights = headPos.map((p, i) => { const o = new THREE.Object3D(); o.name = 'headlight' + i; o.position.set(...p); root.add(o); return o; });

  let lift = 0, wheelA = 0;
  const api = {
    root,
    colliders: [{ min: [-1.42, 0, -2.62], max: [1.42, 3.62, 2.75] }, { min: [-1.2, 0, -5.2], max: [1.2, 1.2, -2.62] }],
    anchors: { seat, forks, exhaust, beacon, headlights },
    setLift(h) { lift = Math.max(0, Math.min(3, h)); carr.position.y = lift; inner.position.y = lift * 0.5; },
    steer(a) { a = Math.max(-0.9, Math.min(0.9, a)); sRL.rotation.y = sRR.rotation.y = a; },
    spin(dist) { wheelA += dist; wFL.rotation.x = wFR.rotation.x = -wheelA / FR; wRL.rotation.x = wRR.rotation.x = -wheelA / RR; },
    get lift() { return lift; },
    mesh,
    info: { tris: tris(geo), drawCalls: geo.groups.length },
  };
  root.userData.forklift = api;
  return api;
}

// ================================================================ 2. FUEL DRUM ====
// Texture layout (1024×512): v 0..0.08 bottom lid (by radius), 0.1..0.9 side wall (by height), 0.92..1 top lid.
const DR = 0.29, DH = 0.88;
function drumCanvas(burnt) {
  const W = 1024, H = 512, c = makeCanvas(W, H), x = c.getContext('2d'), r = makeRng(burnt ? 91 : 90);
  const row = (y) => 461 - 465.45 * y;           // side-wall height (m) → canvas row
  const pxU = W / (2 * PI * DR), pxV = 465.45;   // px per metre
  if (!burnt) paint(x, 0, 0, W, H, { base: [0.62, 0.07, 0.04], under: [0.28, 0.26, 0.24], rustC: [0.4, 0.18, 0.07], seed: 61, chip: 0.38, rust: 0.8, grime: 0.45, streak: 0.55, scratches: 420, fx: 8, fy: 4 });
  else paint(x, 0, 0, W, H, { base: [0.07, 0.06, 0.055], under: [0.3, 0.15, 0.07], rustC: [0.42, 0.2, 0.08], seed: 62, chip: 0.6, rust: 1, grime: 0.7, streak: 0.3, scratches: 120, scratchCol: 'rgba(90,80,70,0.3)', fx: 8, fy: 4 });
  // rolling hoops worn to bare steel (rows around y=0.29 and 0.58) + chime rims
  for (const hy of [0.29, 0.58]) {
    const g = x.createLinearGradient(0, row(hy + 0.025), 0, row(hy - 0.025));
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.45, burnt ? 'rgba(80,60,50,0.5)' : 'rgba(170,150,130,0.45)'); g.addColorStop(0.55, 'rgba(255,240,220,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = g; x.fillRect(0, row(hy + 0.025), W, 0.05 * pxV);
    for (let i = 0; i < 160; i++) { x.fillStyle = burnt ? 'rgba(120,70,40,0.4)' : 'rgba(190,180,170,0.55)'; x.fillRect(r() * W, row(hy) - 6 + r() * 12, 3 + r() * 14, 1 + r() * 2); }
  }
  // decals on two faces (u≈0.25 and u≈0.75)
  if (!burnt) {
    for (const uc of [0.25, 0.75]) {
      const cxp = uc * W;
      // hazard diamond (class 3), 0.25 m square on point
      const d = makeCanvas(256, 256), dc = d.getContext('2d');
      dc.translate(128, 128); dc.rotate(PI / 4);
      dc.fillStyle = '#f2ece0'; dc.fillRect(-88, -88, 176, 176);
      dc.fillStyle = '#c4150e'; dc.fillRect(-82, -82, 164, 164);
      dc.strokeStyle = '#f2ece0'; dc.lineWidth = 3; dc.strokeRect(-74, -74, 148, 148);
      dc.setTransform(1, 0, 0, 1, 0, 0);
      // flame
      dc.fillStyle = '#f6f0e4';
      dc.beginPath(); dc.moveTo(128, 40); dc.bezierCurveTo(150, 70, 170, 80, 160, 110); dc.bezierCurveTo(156, 120, 150, 122, 146, 120);
      dc.bezierCurveTo(152, 104, 140, 92, 136, 84); dc.bezierCurveTo(134, 100, 124, 106, 122, 118); dc.bezierCurveTo(112, 110, 116, 96, 112, 88);
      dc.bezierCurveTo(100, 104, 94, 114, 100, 124); dc.lineTo(100, 124); dc.bezierCurveTo(86, 110, 98, 76, 128, 40); dc.fill();
      dc.fillRect(96, 128, 64, 6);
      dc.font = `900 22px ${FONT}`; dc.textAlign = 'center'; dc.textBaseline = 'middle'; dc.fillText('FLAMMABLE', 128, 152);
      dc.font = `900 40px ${FONT}`; dc.fillText('3', 128, 200);
      dc.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 260; i++) { dc.globalAlpha = r(); dc.beginPath(); dc.arc(r() * 256, r() * 256, 0.5 + r() * 3, 0, 7); dc.fill(); }
      dc.globalCompositeOperation = 'source-over'; dc.globalAlpha = 1;
      const dw = 0.26 * pxU, dh = 0.26 * pxV;
      x.drawImage(d, cxp - dw / 2, row(0.74) - dh / 2, dw, dh);
      // DIESEL stencil + UN number
      const t = makeCanvas(512, 200), tc = t.getContext('2d');
      stencil(tc, 'DIESEL', 256, 70, 120, '#f0ebe0', r, { maxW: 500, wear: 0.5, bridges: true });
      stencil(tc, 'UN 1202  ·  200 L', 256, 160, 44, '#f0ebe0', r, { maxW: 480, wear: 0.4, weight: '700' });
      const tw = 0.42 * pxU, th = 0.164 * pxV;
      x.drawImage(t, cxp - tw / 2, row(0.44) - th / 2, tw, th);
      // batch label (small white sticker, half torn)
      x.fillStyle = 'rgba(235,230,215,0.85)'; x.fillRect(cxp + 0.17 * pxU, row(0.2), 0.08 * pxU, 0.05 * pxV);
      x.fillStyle = 'rgba(30,30,30,0.7)'; for (let l = 0; l < 4; l++) x.fillRect(cxp + 0.175 * pxU, row(0.2) + 4 + l * 5, 20 + r() * 20, 2);
    }
    // fuel drips / stains from the top chime and bungs
    for (let i = 0; i < 26; i++) {
      const u = r() * W, len = (0.08 + r() * 0.45) * pxV, w = 2 + r() * 6;
      const g = x.createLinearGradient(0, row(0.86), 0, row(0.86) + len);
      g.addColorStop(0, 'rgba(25,14,6,0.75)'); g.addColorStop(0.8, 'rgba(40,22,8,0.35)'); g.addColorStop(1, 'rgba(40,22,8,0)');
      x.fillStyle = g; x.fillRect(u, row(0.86), w, len);
      x.fillStyle = 'rgba(25,14,6,0.6)'; x.beginPath(); x.arc(u + w / 2, row(0.86) + len - 2, w * 0.7, 0, 7); x.fill();
    }
  } else {
    // ash bloom, blistered paint remnants, heat tint (noise-driven, no blobs)
    const na = vnoise(17), img2 = x.getImageData(0, 0, W, H);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const a = tfbm(na, xx / W, y / H, 16, 8, 4), i = (y * W + xx) * 4;
      const ash = sstep(0.5, 0.75, a) * 0.55;
      for (let k = 0; k < 3; k++) img2.data[i + k] = img2.data[i + k] * (1 - ash) + [118, 112, 106][k] * ash;
      const blister = a < 0.3 && y < 300 ? 0.5 : 0;
      if (blister) { img2.data[i] = 52; img2.data[i + 1] = 30; img2.data[i + 2] = 18; }
    }
    x.putImageData(img2, 0, 0);
    const g = x.createLinearGradient(0, row(0.88), 0, row(0.6)); g.addColorStop(0, 'rgba(90,70,110,0.25)'); g.addColorStop(1, 'rgba(90,70,110,0)');
    x.fillStyle = g; x.fillRect(0, row(0.88), W, 0.28 * pxV);
  }
  // rust creeping up from the bottom chime
  const n = vnoise(burnt ? 7 : 8);
  const img = x.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    let hm = (461 - y) / 465.45; // height on side
    let t = 0;
    if (y > 461) t = 0.85; // bottom lid
    else if (hm >= 0 && hm < 0.22) t = clamp01((0.14 - hm) * 9 + (tfbm(n, xx / W, y / H, 16, 8, 4) - 0.5) * 2.2);
    if (t <= 0) continue;
    const q = tfbm(n, xx / W + 0.37, y / H, 32, 16, 3);
    const rc = burnt ? [0.16 + q * 0.12, 0.08 + q * 0.04, 0.04] : [0.34 + q * 0.2, 0.15 + q * 0.08, 0.06];
    const i = (y * W + xx) * 4;
    for (let k = 0; k < 3; k++) img.data[i + k] = img.data[i + k] * (1 - t) + rc[k] * 255 * t;
  }
  x.putImageData(img, 0, 0);
  // top lid (canvas rows 0..41, v by radius → row 0 = centre): smooth paint with pressed rings, no streaks
  {
    const lid = x.createLinearGradient(0, 0, 0, 41);
    lid.addColorStop(0, burnt ? '#1a1714' : '#8a120a'); lid.addColorStop(1, burnt ? '#141210' : '#6e0e08');
    x.fillStyle = lid; x.fillRect(0, 0, W, 41);
    for (const rr of [0.12, 0.2, 0.25]) { const yy = (rr / DR) * 41; x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, yy, W, 2); x.fillStyle = 'rgba(255,220,200,0.15)'; x.fillRect(0, yy + 2, W, 1); }
    for (let i = 0; i < 300; i++) { x.fillStyle = burnt ? `rgba(120,110,100,${r() * 0.2})` : `rgba(30,12,6,${r() * 0.35})`; x.fillRect(r() * W, r() * 41, 2 + r() * 10, 1 + r() * 2); }
    // puddled diesel/grime ring near the chime and rust at the chime
    x.fillStyle = 'rgba(30,18,8,0.45)'; x.fillRect(0, 34, W, 7);
  }
  // bung patch (grey steel) at bottom-right
  x.fillStyle = burnt ? '#2a2420' : '#5e5a54'; x.fillRect(980, 488, 40, 22);
  return c;
}
export function drumAssets() {
  return once('drumAssets', () => {
    // profile (r, y) with per-point v
    const pts = [], vs = [];
    const sideV = (y) => 0.1 + 0.8 * (y / DH), botV = (r) => 0.08 * (r / DR), topV = (r) => 1 - 0.08 * (r / DR);
    const P = (r, y, v) => { pts.push([r, y]); vs.push(v); };
    P(0.0, 0.012, botV(0)); P(0.27, 0.012, botV(0.27)); P(0.278, 0.0, botV(0.278));
    P(0.29, 0.004, sideV(0.0)); P(0.292, 0.018, sideV(0.018)); P(0.284, 0.03, sideV(0.03));
    for (const hy of [0.29, 0.58]) { P(0.284, hy - 0.03, sideV(hy - 0.03)); P(0.293, hy - 0.012, sideV(hy - 0.012)); P(0.293, hy + 0.012, sideV(hy + 0.012)); P(0.284, hy + 0.03, sideV(hy + 0.03)); }
    P(0.284, 0.85, sideV(0.85)); P(0.292, 0.862, sideV(0.862)); P(0.29, 0.876, sideV(0.876)); P(0.282, 0.88, topV(0.282));
    P(0.272, 0.872, topV(0.272)); P(0.268, 0.862, topV(0.268)); P(0.0, 0.862, topV(0));
    const g = lathe(pts, 28, vs, 0, 1);
    // dents (deterministic): push the wall in with gaussian falloff
    const dents = [[0.9, 0.42, 0.016, 0.07], [2.6, 0.7, 0.012, 0.05], [4.4, 0.18, 0.02, 0.08], [5.6, 0.8, 0.01, 0.06]];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i), rr = Math.hypot(X, Z);
      if (rr < 0.27) continue;
      const a = Math.atan2(Z, X) + PI; let k = 1;
      for (const [da, dy, dd, ds] of dents) {
        let dA = Math.abs(a - da); dA = Math.min(dA, 2 * PI - dA);
        const dist2 = (dA * DR) ** 2 + (Y - dy) ** 2;
        k -= (dd / DR) * Math.exp(-dist2 / (ds * ds));
      }
      p.setXYZ(i, X * k, Y, Z * k);
    }
    g.computeVertexNormals();
    const parts = [g];
    const bung = (bx, bz, br) => { const b = new THREE.CylinderGeometry(br, br * 1.05, 0.022, 8); b.translate(bx, 0.872, bz); uvPoint(b, 1000 / 1024, 1 - 499 / 512); return b; };
    parts.push(bung(0.19, 0.0, 0.034), bung(-0.2, 0.05, 0.02));
    const geometry = mergeGeometries(parts.map((q) => { q = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; }));
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    const t = canvasTex(drumCanvas(false), { repeat: false }), tb = canvasTex(drumCanvas(true), { repeat: false });
    const material = std({ map: t, roughness: 0.5, metalness: 0.35 });
    const burntMaterial = std({ map: tb, roughness: 0.92, metalness: 0.2 });
    return { geometry, material, burntMaterial, radius: DR, height: DH, info: { tris: tris(geometry) } };
  });
}

// ================================================================ 3. GATEHOUSE ====
function signCanvas(W, H, draw) { const c = makeCanvas(W, H); draw(c.getContext('2d'), W, H); return c; }
export function buildGatehouse() {
  const CON = 0, DRK = 1, WIN = 2, SGN = 3, LMP = 4;
  const P = new Parts(5);
  const cream = [1.08, 1.06, 1.0], plinth = [0.72, 0.7, 0.68], alu = [0.42, 0.42, 0.42], blk = [0.1, 0.1, 0.1];
  const S = 2.0; // concrete uv scale
  const cA = (g, col = cream) => P.add(g, CON, col), dA = (g, col = alu) => P.add(g, DRK, col);
  // plinth & kerb
  cA(B(4.4, 0.3, 3.4, 0, 0.15, 0, 0, 0, 0, S), plinth);
  dA(B(4.42, 0.06, 3.42, 0, 0.03, 0), [0.15, 0.14, 0.13]);
  // lower walls (y 0.3..1.3)
  cA(B(4.0, 1.0, 0.2, 0, 0.8, -1.4, 0, 0, 0, S)); cA(B(4.0, 1.0, 0.2, 0, 0.8, 1.4, 0, 0, 0, S));
  cA(B(0.2, 1.0, 2.6, -1.9, 0.8, 0, 0, 0, 0, S));
  cA(B(0.2, 1.0, 0.85, 1.9, 0.8, -0.875, 0, 0, 0, S)); cA(B(0.2, 1.0, 0.85, 1.9, 0.8, 0.875, 0, 0, 0, S));
  // fascia (y 2.45..2.75)
  cA(B(4.0, 0.3, 0.2, 0, 2.6, -1.4, 0, 0, 0, S)); cA(B(4.0, 0.3, 0.2, 0, 2.6, 1.4, 0, 0, 0, S));
  cA(B(0.2, 0.3, 2.6, -1.9, 2.6, 0, 0, 0, 0, S)); cA(B(0.2, 0.3, 2.6, 1.9, 2.6, 0, 0, 0, 0, S));
  // roof slab with overhang + dark edge trim + roof membrane
  cA(B(5.0, 0.24, 4.0, 0, 2.87, 0, 0, 0, 0, S), [0.95, 0.94, 0.9]);
  dA(B(5.04, 0.08, 4.04, 0, 3.0, 0), [0.3, 0.3, 0.3]);
  dA(B(4.9, 0.02, 3.9, 0, 2.995, 0), [0.12, 0.12, 0.12]);
  // window band: corner posts, mullions, sills, glass
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) dA(B(0.2, 1.15, 0.2, sx * 1.9, 1.875, sz * 1.4));
  for (const z of [-1.4, 1.4]) {
    for (const x of [-0.9, 0, 0.9]) dA(B(0.07, 1.15, 0.12, x, 1.875, z));
    dA(B(4.0, 0.06, 0.32, 0, 1.31, z + Math.sign(z) * 0.04), [0.5, 0.5, 0.5]);
    dA(B(4.0, 0.05, 0.14, 0, 2.43, z));
  }
  dA(B(0.12, 1.15, 0.07, -1.9, 1.875, 0)); dA(B(0.32, 0.06, 2.6, -1.94, 1.31, 0), [0.5, 0.5, 0.5]); dA(B(0.14, 0.05, 2.6, -1.9, 2.43, 0));
  const r = makeRng(5);
  const pane = (w, x, z, ry) => { const u0 = r() * 0.6, v0 = r() * 0.1; P.add(uvRect(new THREE.PlaneGeometry(w, 1.1), [u0, v0, u0 + Math.min(0.4, w / 3.2), v0 + 0.9]).rotateY(ry).translate(x, 1.875, z), WIN); };
  for (const x of [-1.4, -0.45, 0.45, 1.4]) { pane(0.86, x, -1.41, PI); pane(0.86, x, 1.41, 0); }
  pane(1.2, -1.91, -0.65, -HP); pane(1.2, -1.91, 0.65, -HP);
  for (const z of [-0.95, 0.95]) { pane(0.62, 1.91, z, HP); dA(B(0.12, 0.05, 0.85, 1.9, 2.43, z)); dA(B(0.3, 0.06, 0.85, 1.95, 1.31, z), [0.5, 0.5, 0.5]); }
  // sliding serving hatch + counter on the road side (-x)
  dA(B(0.4, 0.05, 1.0, -2.12, 1.33, -0.65), [0.55, 0.55, 0.55]);
  for (const z of [-1.0, -0.3]) dA(B(0.3, 0.05, 0.04, -2.05, 1.25, z, 0, 0, 0.7), [0.4, 0.4, 0.4]);
  // door (+x side) with frame, wired glass vision panel, kick plate, handle
  dA(B(0.1, 2.12, 0.95, 1.95, 1.36, 0), [0.25, 0.3, 0.36]);
  dA(B(0.14, 0.1, 1.05, 1.95, 2.45, 0), alu);
  for (const z of [-0.5, 0.5]) dA(B(0.14, 2.15, 0.06, 1.95, 1.37, z), alu);
  P.add(uvRect(new THREE.PlaneGeometry(0.4, 0.5), [0.3, 0.3, 0.42, 0.7]).rotateY(HP).translate(2.005, 1.85, 0), WIN);
  dA(B(0.02, 0.25, 0.85, 2.005, 0.45, 0), [0.6, 0.58, 0.55]);
  dA(B(0.08, 0.04, 0.16, 2.04, 1.3, -0.33), [0.75, 0.72, 0.65]);
  // step in front of door
  cA(B(0.6, 0.15, 1.2, 2.5, 0.075, 0, 0, 0, 0, S), plinth);
  // wall lamp over door
  dA(B(0.14, 0.12, 0.3, 2.07, 2.6, 0), blk);
  P.add(uvRect(B(0.02, 0.06, 0.24, 2.145, 2.58, 0), [0, 0, 1, 1]), LMP);
  // AC unit on the back wall (+z) with fan grille, pipes
  dA(B(0.85, 0.6, 0.32, 1.0, 0.95, 1.68), [0.72, 0.72, 0.7]);
  dA(C(0.22, 0.22, 0.02, 12, 1.0, 0.95, 1.845, HP), [0.12, 0.12, 0.12]);
  dA(rod([0.6, 1.1, 1.58], [0.6, 2.4, 1.58], 0.025), [0.6, 0.6, 0.6]);
  // conduit + junction box, downpipe
  dA(B(0.06, 2.6, 0.06, -1.98, 1.6, 1.48), [0.3, 0.3, 0.3]);
  dA(B(0.25, 0.3, 0.12, -1.6, 1.05, 1.56), [0.55, 0.55, 0.52]);
  // roof sign board (two faces) on legs at the -z edge
  dA(B(3.95, 0.68, 0.1, 0, 3.4, -1.75), [0.15, 0.15, 0.15]);
  for (const x of [-1.6, 0, 1.6]) dA(B(0.06, 0.4, 0.06, x, 3.15, -1.68), [0.25, 0.25, 0.25]);
  P.add(new THREE.PlaneGeometry(3.85, 0.58).rotateY(PI).translate(0, 3.4, -1.806), SGN);
  P.add(new THREE.PlaneGeometry(3.85, 0.58).translate(0, 3.4, -1.694), SGN);
  // CCTV on the (-x,-z) roof corner, aimed out to the road
  const cam = new THREE.Group();
  const cx0 = -2.45, cy0 = 2.62, cz0 = -1.95;
  dA(B(0.06, 0.25, 0.06, cx0, cy0 + 0.12, cz0), [0.75, 0.74, 0.72]);
  dA(B(0.06, 0.06, 0.3, cx0, cy0, cz0 - 0.12), [0.75, 0.74, 0.72]);
  const camG = [B(0.13, 0.13, 0.38, 0, 0, 0), B(0.17, 0.02, 0.44, 0, 0.08, -0.02)];
  const camLens = C(0.04, 0.04, 0.02, 10, 0, 0, -0.195, HP);
  const camM = new THREE.Matrix4().compose(new THREE.Vector3(cx0, cy0 - 0.09, cz0 - 0.26), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, -0.6, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  camG.forEach((g) => dA(g.applyMatrix4(camM), [0.85, 0.84, 0.82]));
  dA(camLens.applyMatrix4(camM), [0.05, 0.05, 0.06]);

  const geo = P.geometry({ [CON]: groundGrime(0.0, 1.2, 0.62), [DRK]: groundGrime(0.0, 0.8, 0.75) });
  const signMat = once('gateSign', () => {
    const c = signCanvas(1024, 154, (x, W, H) => {
      const rr = makeRng(12);
      x.fillStyle = '#10264a'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#c4150e'; x.fillRect(0, 0, 330, H);
      x.fillStyle = '#f2efe6'; x.fillRect(0, 0, W, 5); x.fillRect(0, H - 5, W, 5);
      stencil(x, 'SECURITY', 165, H / 2 + 2, 74, '#f6f2ea', rr, { maxW: 300, wear: 0.08 });
      stencil(x, '— ALL VISITORS REPORT', 675, H / 2 + 2, 56, '#f6f2ea', rr, { maxW: 660, wear: 0.08 });
      grimeOverlay(x, 0, 0, W, H, rr, 60, '20,16,10');
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0.6, 'rgba(40,30,20,0)'); g.addColorStop(1, 'rgba(40,30,20,0.45)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    });
    const t = canvasTex(c, { repeat: false });
    return duskMat({ map: t, emissiveMap: t, emissive: 0xffffff, roughness: 0.5, metalness: 0.1 }, 0.6);
  });
  const mats = [concreteMat([0.7, 0.68, 0.64], 7), darkMat(), windowMat(), signMat, lampMat()];
  const root = new THREE.Group(); root.name = 'gatehouse';
  root.add(meshOf(geo, mats));

  // boom barrier (pivot at its post on the -x/-z corner, boom reaching out along -x)
  const bp = new Parts(2);
  bp.add(B(0.4, 1.0, 0.4, -2.75, 0.5, -1.1, 0, 0, 0, 1.2), 0);
  bp.add(B(0.46, 0.06, 0.46, -2.75, 1.03, -1.1), 1, [0.2, 0.2, 0.2]);
  bp.add(B(0.6, 0.1, 0.6, -2.75, 0.05, -1.1), 1, [0.6, 0.6, 0.6]);
  bp.add(B(0.02, 0.5, 0.3, -2.54, 0.5, -1.1), 1, [0.45, 0.45, 0.45]);
  const housing = meshOf(bp.geometry({ 0: groundGrime(0, 0.7, 0.6) }), [yellowPaintMat(), darkMat()]);
  root.add(housing);
  const boomMat = once('boomMat', () => {
    const c = signCanvas(256, 32, (x, W, H) => {
      x.fillStyle = '#efeae0'; x.fillRect(0, 0, W, H); x.fillStyle = '#c8140c'; x.fillRect(0, 0, W / 2, H);
      const rr = makeRng(4); grimeOverlay(x, 0, 0, W, H, rr, 30, '30,24,18');
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, H - 4, W, 4);
    });
    return std({ map: canvasTex(c), roughness: 0.45, metalness: 0.1, vertexColors: true });
  });
  const barrier = new THREE.Group(); barrier.name = 'barrier'; barrier.position.set(-2.75, 0.92, -1.1);
  const boomP = new Parts(2);
  boomP.add(B(8.4, 0.12, 0.08, -4.35, 0, 0, 0, 0, 0, 1.0), 0);
  boomP.add(B(0.5, 0.2, 0.2, 0.25, 0, 0), 1, [0.25, 0.25, 0.25]);                       // counterweight stub
  boomP.add(C(0.07, 0.07, 0.5, 10, 0, 0, 0, HP), 1, [0.4, 0.4, 0.4]);                   // hinge drum
  boomP.add(B(0.1, 0.03, 0.03, -8.5, 0, 0), 1, [0.9, 0.1, 0.05]);                       // end cap
  const boom = meshOf(boomP.geometry(), [boomMat, darkMat()]);
  barrier.add(boom); root.add(barrier);
  const cctv = new THREE.Object3D(); cctv.name = 'cctv'; cctv.position.set(cx0, cy0 - 0.09, cz0 - 0.26); cctv.quaternion.setFromEuler(new THREE.Euler(-0.35, -0.6, 0, 'YXZ')); root.add(cctv);
  return {
    root,
    colliders: [{ min: [-2.2, 0, -1.7], max: [2.2, 3.1, 1.7] }, { min: [-2.97, 0, -1.32], max: [-2.53, 1.1, -0.88] }],
    anchors: { barrier, cctv, door: new THREE.Vector3(2.5, 0, 0), sign: new THREE.Vector3(0, 3.4, -1.81) },
    setBarrier(t) { barrier.rotation.z = -clamp01(t) * HP * 0.97; },
    info: { tris: tris(geo) + tris(housing.geometry) + tris(boom.geometry), drawCalls: geo.groups.length + 2 + 2 },
  };
}

// ================================================================ 4. SIGN GANTRY ====
function gantrySignCanvas(front, emissive) {
  return signCanvas(2048, 448, (x, W, H) => {
    const r = makeRng(front ? 21 : 22);
    x.fillStyle = emissive ? '#0a1c40' : '#0c2c66'; x.fillRect(0, 0, W, H);
    x.strokeStyle = emissive ? '#d8d8d8' : '#eeeeea'; x.lineWidth = 14; x.strokeRect(22, 22, W - 44, H - 44);
    const ink = emissive ? '#ffffff' : '#f4f2ec', yel = emissive ? '#ffd860' : '#f2c21a';
    if (front) {
      stencil(x, 'PORT OF VICTORY', W / 2, 160, 190, ink, r, { maxW: W - 200, wear: 0 });
      x.fillStyle = yel; x.fillRect(120, 268, W - 240, 10);
      stencil(x, 'TERMINAL 4 — CONTAINER YARD', W / 2 - 80, 350, 92, ink, r, { maxW: W - 520, wear: 0, weight: '800' });
      x.fillStyle = ink; x.save(); x.translate(W - 190, 350); poly(x, [[-34, -50], [34, -50], [34, 10], [62, 10], [0, 62], [-62, 10], [-34, 10]]); x.restore();
    } else {
      stencil(x, 'EXIT', W / 2, 150, 180, ink, r, { maxW: W - 200, wear: 0 });
      x.fillStyle = yel; x.fillRect(120, 268, W - 240, 10);
      stencil(x, 'ALL TRUCKS STOP AT GATE — ID READY', W / 2, 350, 84, ink, r, { maxW: W - 260, wear: 0, weight: '800' });
    }
    if (!emissive) {
      // road grime: dark streaks from the bottom edge, bird mess, rivets
      for (let i = 0; i < 40; i++) { const g = x.createLinearGradient(0, H, 0, H - 60 - r() * 160); g.addColorStop(0, 'rgba(30,24,16,0.55)'); g.addColorStop(1, 'rgba(30,24,16,0)'); x.fillStyle = g; x.fillRect(r() * W, 0, 6 + r() * 40, H); }
      grimeOverlay(x, 0, 0, W, H, r, 90, '20,18,14');
      const bp = []; for (let i = 0; i < 9; i++) { bp.push([60 + i * (W - 120) / 8, 40], [60 + i * (W - 120) / 8, H - 40]); }
      bolts(x, bp, 6, r);
      for (let p = 1; p < 4; p++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(p * W / 4 - 2, 30, 4, H - 60); }
    } else {
      // dim background, bright letters, uneven backlight (tube banding, one dead tube)
      x.globalCompositeOperation = 'multiply';
      for (let i = 0; i < 6; i++) { const g = x.createLinearGradient(i * W / 6, 0, (i + 1) * W / 6, 0); const k = i === 4 ? 120 : 220 + r() * 35; g.addColorStop(0, `rgb(${k},${k},${k})`); g.addColorStop(0.5, '#fff'); g.addColorStop(1, `rgb(${k},${k},${k})`); x.fillStyle = g; x.fillRect(i * W / 6, 0, W / 6, H); }
      x.globalCompositeOperation = 'source-over';
    }
  });
}
export function buildSignGantry() {
  const STL = 0, CON = 1, SGF = 2, SGB = 3, LMP = 4;
  const P = new Parts(5);
  const g1 = [0.95, 0.95, 0.95], dk = [0.32, 0.32, 0.33];
  const sA = (g, c = g1) => P.add(g, STL, c);
  const X = 10, Y0 = 6.3, Y1 = 7.6, D = 0.5;
  for (const s of [-1, 1]) {
    P.add(B(1.5, 0.5, 1.9, s * X, 0.25, 0, 0, 0, 0, 1.5), CON);
    sA(B(0.9, 0.04, 1.7, s * X, 0.52, 0), dk);
    for (const z of [-D, D]) {
      sA(B(0.3, Y1 - 0.4, 0.3, s * X, 0.54 + (Y1 - 0.4) / 2, z));
      for (const bx of [-0.25, 0.25]) for (const bz of [-0.2, 0.2]) sA(C(0.03, 0.03, 0.1, 6, s * X + bx, 0.58, z + bz), dk);
    }
    for (let y = 1.2; y < Y1; y += 1.25) {
      sA(B(0.1, 0.1, 2 * D, s * X, y, 0));
      sA(strut([s * X, y, -D], [s * X, Math.min(Y1 - 0.3, y + 1.25), D], 0.07));
    }
    sA(B(0.5, 0.25, 1.4, s * X, Y1 - 0.12, 0));
    // access ladder hint up the outside of the post
    for (const z of [-0.2, 0.2]) sA(B(0.05, 5.6, 0.05, s * (X + 0.32), 3.5, z), dk);
    for (let y = 1.0; y < 6.2; y += 0.6) sA(B(0.03, 0.03, 0.4, s * (X + 0.32), y, 0), dk);
  }
  // truss: 4 chords + panel verticals + diagonals (front, back, top, bottom faces)
  const L = X + 0.25, N = 16, dx = (2 * X) / N;
  for (const y of [Y0, Y1]) for (const z of [-D, D]) sA(B(2 * L, 0.16, 0.16, 0, y, z));
  for (let i = 0; i <= N; i++) {
    const x = -X + i * dx;
    for (const z of [-D, D]) sA(B(0.09, Y1 - Y0, 0.09, x, (Y0 + Y1) / 2, z));
    sA(B(0.08, 0.08, 2 * D, x, Y0, 0)); sA(B(0.08, 0.08, 2 * D, x, Y1, 0));
    if (i < N) {
      const f = i % 2 ? 1 : -1;
      for (const z of [-D, D]) sA(strut([x, f > 0 ? Y0 : Y1, z], [x + dx, f > 0 ? Y1 : Y0, z], 0.07));
      sA(strut([x, Y1, -D * f], [x + dx, Y1, D * f], 0.06));
    }
  }
  // sign cabinets front (+z) and back (-z) faces
  const SW = 11, SH = 2.4, SY = 7.35;
  for (const s of [-1, 1]) {
    sA(B(SW + 0.3, SH + 0.3, 0.3, 0, SY, s * 0.74), [0.25, 0.26, 0.28]);
    sA(B(SW + 0.4, 0.08, 0.38, 0, SY + SH / 2 + 0.18, s * 0.74), [0.3, 0.3, 0.32]);       // rain hood
    for (const x of [-4.5, -1.5, 1.5, 4.5]) sA(B(0.1, 0.4, 0.3, x, Y1 + 0.0, s * 0.6), dk);
  }
  P.add(new THREE.PlaneGeometry(SW, SH).translate(0, SY, 0.895), SGF);
  P.add(new THREE.PlaneGeometry(SW, SH).rotateY(PI).translate(0, SY, -0.895), SGB);
  // maintenance catwalk under the front sign + handrail + flood lamps aimed up at the face
  sA(B(SW, 0.05, 0.7, 0, 6.1, 1.2), [0.5, 0.5, 0.5]);
  for (let x = -SW / 2; x <= SW / 2 + 0.01; x += SW / 6) { sA(B(0.05, 1.0, 0.05, x, 6.6, 1.55), dk); sA(B(0.06, 0.06, 0.75, x, 6.1, 1.2), dk); }
  sA(B(SW, 0.05, 0.05, 0, 7.1, 1.55), dk); sA(B(SW, 0.04, 0.04, 0, 6.6, 1.55), dk);
  for (const x of [-4, -1.3, 1.3, 4]) {
    sA(B(0.3, 0.16, 0.2, x, 6.25, 1.35, -0.7), [0.2, 0.2, 0.2]);
    P.add(B(0.26, 0.02, 0.16, x, 6.29, 1.28, -0.7), LMP);
  }
  const geo = P.geometry({ [STL]: groundGrime(0, 2.0, 0.7), [CON]: groundGrime(0, 0.5, 0.8) });
  const mk = (front) => once('gantrySign' + front, () => {
    const t = canvasTex(gantrySignCanvas(front, false), { repeat: false }), te = canvasTex(gantrySignCanvas(front, true), { repeat: false });
    return duskMat({ map: t, emissiveMap: te, emissive: 0xffffff, roughness: 0.45, metalness: 0.05 }, 1.6);
  });
  const mats = [galvMat(), concreteMat([0.64, 0.62, 0.58], 9), mk(true), mk(false), lampMat()];
  const root = new THREE.Group(); root.name = 'signGantry'; root.add(meshOf(geo, mats));
  return {
    root,
    colliders: [{ min: [-X - 0.8, 0, -1.0], max: [-X + 0.8, 8, 1.0] }, { min: [X - 0.8, 0, -1.0], max: [X + 0.8, 8, 1.0] }],
    anchors: { signFront: new THREE.Vector3(0, SY, 0.9), signBack: new THREE.Vector3(0, SY, -0.9), lamps: [-4, -1.3, 1.3, 4].map((x) => new THREE.Vector3(x, 6.3, 1.28)) },
    info: { tris: tris(geo), drawCalls: geo.groups.length },
  };
}

// ================================================================ 5. FENCE ====
const chainMat = () => once('chainMat', () => {
  const S = 128, c = makeCanvas(S, S), x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  const n = 6, p = S / n;
  const wire = (w, col) => {
    x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round';
    for (let i = -n; i <= 2 * n; i++) {
      x.beginPath(); x.moveTo(i * p, 0); x.lineTo(i * p + S, S); x.stroke();
      x.beginPath(); x.moveTo(i * p, 0); x.lineTo(i * p - S, S); x.stroke();
    }
  };
  wire(3.4, 'rgba(46,48,48,1)'); wire(2.6, 'rgba(120,124,126,1)'); wire(0.9, 'rgba(190,194,196,1)');
  const t = canvasTex(c, { aniso: 8 });
  const m = std({ map: t, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.6, alphaToCoverage: true });
  return m;
});
export function buildFence(len = 30) {
  const P = new Parts(2);
  const H = 2.4, step = 3, n = Math.max(1, Math.round(len / step)), sp = len / n, x0 = -len / 2;
  const r = makeRng(Math.round(len * 13) + 1);
  const galv = [0.85, 0.86, 0.86], rust = [0.7, 0.58, 0.5];
  for (let i = 0; i <= n; i++) {
    const x = x0 + i * sp, end = i === 0 || i === n, pr = end ? 0.045 : 0.032, lean = (r() - 0.5) * 0.03;
    const col = r() < 0.25 ? rust : galv;
    P.add(C(pr, pr, H + 0.05, 6, x, (H + 0.05) / 2, 0, lean, 0, 0, true), 0, col);
    P.add(C(pr * 1.4, pr * 1.4, 0.08, 6, x, 0.04, 0), 0, [0.5, 0.48, 0.45]);
    // outrigger arm toward +z (outside), 45°
    P.add(rod([x, H, 0], [x, H + 0.42, 0.42], 0.016, 4, true), 0, col);
    if (end && i === n) { /* terminal brace */ }
    if (end) P.add(rod([x, 0.1, 0], [x + (i === 0 ? 1 : -1) * 1.4, 1.7, 0], 0.025, 5), 0, galv);
  }
  // top rail, bottom tension wire, barbed strands
  P.add(at(new THREE.CylinderGeometry(0.021, 0.021, len, 6, 1, true), 0, H - 0.02, 0, 0, 0, HP), 0, galv);
  P.add(at(new THREE.CylinderGeometry(0.005, 0.005, len, 4, 1, true), 0, 0.1, 0, 0, 0, HP), 0, galv);
  for (let k = 1; k <= 3; k++) {
    const t = k / 3;
    P.add(at(new THREE.CylinderGeometry(0.006, 0.006, len, 4, 1, true), 0, H + 0.42 * t * 0.97, 0.42 * t * 0.97, 0, 0, HP), 0, [0.6, 0.6, 0.6]);
  }
  // chain-link fabric: one quad per bay with small sag / lean, uv in metres (tile = 0.4 m)
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * sp, xb = xa + sp, zb = (r() - 0.5) * 0.04, yb = 0.04 + r() * 0.06;
    const g = new THREE.PlaneGeometry(sp, H - yb - 0.03, 2, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) if (Math.abs(p.getX(k)) < 0.01) p.setZ(k, zb + (p.getY(k) < 0 ? 0.03 : 0));
    g.translate((xa + xb) / 2, yb + (H - yb - 0.03) / 2, 0.02);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, (p.getX(k) + len) / 0.36, p.getY(k) / 0.36);
    g.computeVertexNormals();
    P.add(g, 1);
  }
  const geo = P.geometry({ 0: groundGrime(0, 0.6, 0.7) });
  const mesh = meshOf(geo, [galvMat(), chainMat()]);
  const root = new THREE.Group(); root.name = 'fence'; root.add(mesh);
  return { root, colliders: [{ min: [-len / 2, 0, -0.12], max: [len / 2, 2.9, 0.15] }], anchors: { start: new THREE.Vector3(-len / 2, 0, 0), end: new THREE.Vector3(len / 2, 0, 0) }, info: { tris: tris(geo), drawCalls: geo.groups.length } };
}

// ================================================================ 6. HIGH-MAST LIGHT ====
export function buildLightMast() {
  const STL = 0, CON = 1, HAZ = 2, LNS = 3;
  const P = new Parts(4);
  const HT = 30, galv = [0.95, 0.95, 0.96], dk = [0.3, 0.3, 0.31];
  // plinth (octagonal), flange, bolts
  P.add(C(0.85, 0.95, 0.75, 8, 0, 0.375, 0, 0, PI / 8), CON);
  P.add(C(0.55, 0.55, 0.05, 8, 0, 0.775, 0), STL, dk);
  for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8; P.add(C(0.035, 0.035, 0.12, 5, Math.cos(a) * 0.45, 0.83, Math.sin(a) * 0.45), STL, [0.5, 0.45, 0.4]); }
  // tapered pole with slip joints + access door
  P.add(C(0.16, 0.34, HT - 0.8, 12, 0, 0.8 + (HT - 0.8) / 2, 0, 0, 0, 0, true), STL, galv);
  for (const y of [10, 20]) { const rr = 0.34 - (0.18 * (y - 0.8)) / (HT - 0.8); P.add(C(rr + 0.02, rr + 0.03, 0.25, 12, 0, y, 0, 0, 0, 0, true), STL, [0.85, 0.85, 0.86]); }
  P.add(B(0.26, 0.6, 0.06, 0, 1.6, -0.32), STL, [0.7, 0.7, 0.72]);
  // ladder hint (+z side): rails all the way, rungs every 0.6 m
  for (const x of [-0.18, 0.18]) P.add(B(0.04, HT - 2.2, 0.04, x, 1.2 + (HT - 2.2) / 2, 0.42), STL, dk);
  for (let y = 1.4; y < HT - 1.2; y += 0.6) P.add(B(0.36, 0.025, 0.025, 0, y, 0.42), STL, dk);
  for (let y = 4; y < HT - 1.5; y += 4) P.add(B(0.06, 0.06, 0.2, 0, y, 0.3), STL, dk);
  // head frame: ring platform, railing, hub
  const RY = HT - 0.5;
  P.add(C(0.3, 0.3, 0.8, 10, 0, RY + 0.3, 0), STL, [0.8, 0.8, 0.82]);
  P.add(C(1.5, 1.5, 0.06, 16, 0, RY, 0), STL, [0.55, 0.55, 0.56]);
  P.add(C(1.52, 1.52, 0.04, 16, 0, RY + 1.0, 0, 0, 0, 0, true), STL, dk);
  P.add(C(1.52, 1.52, 0.03, 16, 0, RY + 0.5, 0, 0, 0, 0, true), STL, dk);
  for (let i = 0; i < 6; i++) { const a = i * PI / 3 + PI / 6; P.add(B(0.04, 1.0, 0.04, Math.cos(a) * 1.5, RY + 0.5, Math.sin(a) * 1.5), STL, dk); }
  for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3; P.add(strut([Math.cos(a) * 0.3, RY - 1.2, Math.sin(a) * 0.3], [Math.cos(a) * 1.4, RY - 0.02, Math.sin(a) * 1.4], 0.06), STL, dk); }
  // 6 floodlight heads around the ring, aimed out + down
  const lamps = [];
  for (let i = 0; i < 6; i++) {
    const a = i * PI / 3, ca = Math.cos(a), sa = Math.sin(a), R = 1.15;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.85, -a - HP, 0, 'YXZ'));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(ca * R, RY + 0.55, sa * R), q, new THREE.Vector3(1, 1, 1));
    // local: lens faces -z (out), housing behind
    P.add(B(0.62, 0.48, 0.3, 0, 0, 0.1).applyMatrix4(m), STL, [0.35, 0.35, 0.36]);
    P.add(B(0.68, 0.04, 0.22, 0, 0.26, -0.1).applyMatrix4(m), STL, [0.3, 0.3, 0.3]);
    P.add(B(0.06, 0.4, 0.2, 0.34, -0.05, 0.05).applyMatrix4(m), STL, dk);
    P.add(B(0.06, 0.4, 0.2, -0.34, -0.05, 0.05).applyMatrix4(m), STL, dk);
    P.add(new THREE.PlaneGeometry(0.54, 0.4).rotateY(PI).translate(0, 0, -0.055).applyMatrix4(m), LNS);
    lamps.push(new THREE.Vector3(0, 0, -0.06).applyMatrix4(m));
  }
  // crash guard: 4 striped posts + rails around the plinth
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add(C(0.085, 0.085, 1.1, 8, sx * 1.15, 0.55, sz * 1.15), HAZ);
  for (const s of [-1, 1]) { P.add(B(2.3, 0.14, 0.06, 0, 0.7, s * 1.17, 0, 0, 0, 0.7), HAZ); P.add(B(0.06, 0.14, 2.3, s * 1.17, 0.7, 0, 0, 0, 0, 0.7), HAZ); }
  const geo = P.geometry({ [STL]: groundGrime(0, 3, 0.75), [CON]: groundGrime(0, 0.5, 0.75), [HAZ]: groundGrime(0, 0.5, 0.7) });
  const lens = once('mastLens', () => duskMat({ color: 0xf2e6cc, emissive: 0xffa555, roughness: 0.15, metalness: 0.0 }, 3));
  const mats = [galvMat(), concreteMat([0.62, 0.6, 0.56], 11), hazardMat(), lens];
  const root = new THREE.Group(); root.name = 'lightMast';
  const mesh = meshOf(geo, mats); root.add(mesh);
  return {
    root,
    colliders: [{ min: [-1.25, 0, -1.25], max: [1.25, 1.3, 1.25] }, { min: [-0.36, 0, -0.36], max: [0.36, HT, 0.48] }],
    anchors: { lamps, top: new THREE.Vector3(0, HT, 0) },
    info: { tris: tris(geo), drawCalls: geo.groups.length },
  };
}

// ================================================================ 7. SMALL PROPS ====
export function buildBollard() {
  return once('bollard', () => {
    // atlas: top half yellow cap paint, bottom half black paint
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    paint(x, 0, 0, 256, 128, { base: [0.92, 0.66, 0.05], seed: 70, chip: 0.6, rust: 0.9, fx: 4, fy: 2, scratches: 80 });
    paint(x, 0, 128, 256, 128, { base: [0.06, 0.06, 0.06], under: [0.3, 0.16, 0.07], seed: 71, chip: 0.5, rust: 1, fx: 4, fy: 2, scratches: 120, scratchCol: 'rgba(160,150,140,0.35)' });
    // rope wear polish band on the neck
    x.fillStyle = 'rgba(140,130,120,0.25)'; x.fillRect(0, 150, 256, 18);
    const pts = [[0, 0.06], [0.24, 0.06], [0.22, 0.12], [0.17, 0.18], [0.15, 0.32], [0.16, 0.42], [0.22, 0.48], [0.27, 0.52], [0.27, 0.58], [0.22, 0.62], [0, 0.64]];
    const vs = pts.map((p) => (p[1] < 0.5 ? 0.02 + (p[1] / 0.5) * 0.46 : 0.52 + ((p[1] - 0.5) / 0.14) * 0.46));
    const body = lathe(pts, 14, vs);
    const plate = uvRect(B(0.62, 0.06, 0.62, 0, 0.03, 0), [0, 0.02, 1, 0.3]);
    const parts = [body, plate];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(uvPoint(C(0.035, 0.04, 0.05, 6, sx * 0.24, 0.085, sz * 0.24), 0.5, 0.2));
    // tee horns
    parts.push(uvRect(C(0.06, 0.06, 0.62, 8, 0, 0.4, 0, 0, 0, HP), [0, 0.1, 1, 0.45]));
    const geometry = mergeGeometries(parts.map((q) => { q = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; }));
    geometry.computeBoundingSphere();
    return { geometry, material: std({ map: canvasTex(c), roughness: 0.6, metalness: 0.4 }), info: { tris: tris(geometry) } };
  });
}
function jerseyCanvas() {
  const W = 512, H = 256, c = makeCanvas(W, H), x = c.getContext('2d'), r = makeRng(33);
  const h = paint(x, 0, 0, W, H, { base: [0.7, 0.68, 0.63], under: [0.6, 0.58, 0.54], rustC: [0.5, 0.4, 0.3], seed: 34, chip: 0.3, rust: 0.25, grime: 0.4, streak: 0.25, fx: 6, fy: 3, scratches: 60, scratchCol: 'rgba(210,205,195,0.4)' });
  // dirt/tyre marks near both bottoms (v≈0 front bottom → canvas bottom; v≈1 back bottom → canvas top)
  for (const [y0, dir] of [[H, -1], [0, 1]]) {
    const g = x.createLinearGradient(0, y0, 0, y0 + dir * 70); g.addColorStop(0, 'rgba(45,36,26,0.7)'); g.addColorStop(1, 'rgba(45,36,26,0)');
    x.fillStyle = g; x.fillRect(0, Math.min(y0, y0 + dir * 70), W, 70);
    for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(10,10,10,${0.15 + r() * 0.25})`; x.fillRect(r() * W, y0 + dir * (4 + r() * 10) - 2, 30 + r() * 120, 3 + r() * 3); }
    // drainage/lifting slots
    for (const u of [0.12, 0.88]) { x.fillStyle = '#141210'; x.fillRect(u * W - 26, dir < 0 ? H - 16 : 2, 52, 14); }
  }
  // stencil asset number on the front face, a strip of reflective tape on top
  stencil(x, 'PV-112', 120, 180, 30, 'rgba(30,26,22,0.75)', r, { wear: 0.4, weight: '800' });
  x.fillStyle = 'rgba(230,230,220,0.8)'; x.fillRect(220, 122, 70, 10); x.fillStyle = '#d0141a'; x.fillRect(290, 122, 70, 10);
  return { c, h };
}
export function buildJersey() {
  return once('jersey', () => {
    // NJ profile (z, y), front then over the top and down the back
    const prof = [[-0.305, 0], [-0.3, 0.075], [-0.2, 0.33], [-0.075, 0.81], [0.075, 0.81], [0.2, 0.33], [0.3, 0.075], [0.305, 0]];
    let tot = 0; const acc = [0]; for (let i = 1; i < prof.length; i++) { tot += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]); acc.push(tot); }
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < prof.length; i++) for (const x of [-1.5, 1.5]) { pos.push(x, prof[i][1], prof[i][0]); uv.push((x + 1.5) / 3, acc[i] / tot); }
    for (let i = 0; i < prof.length - 1; i++) { const a = i * 2, b = a + 1, c2 = a + 2, d = a + 3; idx.push(a, b, c2, b, d, c2); }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g = g.toNonIndexed(); g.computeVertexNormals();
    // ensure outward winding
    const p = g.attributes.position;
    const fix = [];
    for (let t = 0; t < p.count; t += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, t), b = new THREE.Vector3().fromBufferAttribute(p, t + 1), c3 = new THREE.Vector3().fromBufferAttribute(p, t + 2);
      const n = b.clone().sub(a).cross(c3.clone().sub(a)); const cen = a.add(b).add(c3).multiplyScalar(1 / 3); cen.x = 0; cen.y -= 0.3;
      if (n.dot(cen) < 0) fix.push(t);
    }
    for (const t of fix) for (const attr of [g.attributes.position, g.attributes.uv]) { const s = attr.itemSize; for (let k = 0; k < s; k++) { const tmp = attr.array[(t + 1) * s + k]; attr.array[(t + 1) * s + k] = attr.array[(t + 2) * s + k]; attr.array[(t + 2) * s + k] = tmp; } }
    g.computeVertexNormals();
    const shape = new THREE.Shape(prof.map((q) => new THREE.Vector2(q[0], q[1])));
    const capA = new THREE.ShapeGeometry(shape); capA.rotateY(-HP); capA.translate(-1.5, 0, 0); uvRect(uvScale(capA, 0), [0.5, 0.5, 0.5, 0.5]);
    const capB = new THREE.ShapeGeometry(shape); capB.rotateY(HP); capB.translate(1.5, 0, 0); uvScale(capB, 0);
    for (const cp of [capA, capB]) { const u = cp.attributes.uv; for (let k = 0; k < u.count; k++) u.setXY(k, 0.02 + (cp.attributes.position.getZ(k) + 0.3) * 0.1, 0.5 + cp.attributes.position.getY(k) * 0.3); }
    const geometry = mergeGeometries([g, capA.toNonIndexed(), capB.toNonIndexed()].map((q) => { for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; }));
    geometry.computeBoundingSphere();
    const { c, h } = jerseyCanvas();
    const material = std({ map: canvasTex(c, { repeat: false }), normalMap: heightToNormal(h, 512, 256, 2), normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.93, metalness: 0 });
    return { geometry, material, info: { tris: tris(geometry) } };
  });
}
function crateCanvas() {
  const W = 512, H = 512, c = makeCanvas(W, H), x = c.getContext('2d'), r = makeRng(55);
  const n = vnoise(56);
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const plank = y < 448 ? Math.floor(y / 74.6) : 9;
    const grain = tfbm(n, xx / W, (y + plank * 37) / H, 2, 64, 4);
    const ring = Math.sin((grain * 18 + plank * 3.1) * PI) * 0.5 + 0.5;
    const t = 0.82 + plank * 0.025 % 0.1;
    let k = (0.72 + grain * 0.35 + ring * 0.08) * t;
    const edge = y < 448 && (y % 74.6 < 2.2 || y % 74.6 > 72.6);
    if (edge) k *= 0.35;
    const i = (y * W + xx) * 4;
    img.data[i] = 168 * k; img.data[i + 1] = 128 * k; img.data[i + 2] = 82 * k; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // nails
  for (let p = 0; p < 6; p++) for (const xx of [20, 492]) { x.fillStyle = 'rgba(40,36,32,0.9)'; x.beginPath(); x.arc(xx, p * 74.6 + 37, 3, 0, 7); x.fill(); }
  // stencils
  stencil(x, 'PORT OF VICTORY', 256, 140, 50, 'rgba(25,20,15,0.85)', r, { maxW: 420, wear: 0.5, bridges: true });
  stencil(x, 'FRAGILE', 256, 230, 70, 'rgba(150,20,14,0.85)', r, { maxW: 360, wear: 0.5, bridges: true });
  stencil(x, 'No. 4471 · 380 kg', 256, 320, 34, 'rgba(25,20,15,0.8)', r, { maxW: 400, wear: 0.4, weight: '700' });
  x.fillStyle = 'rgba(25,20,15,0.8)';
  for (const ax of [120, 392]) { x.save(); x.translate(ax, 395); poly(x, [[-12, 30], [12, 30], [12, 0], [26, 0], [0, -30], [-26, 0], [-12, 0]]); x.restore(); }
  grimeOverlay(x, 0, 0, W, 448, r, 40, '40,30,20');
  const g = x.createLinearGradient(0, 330, 0, 448); g.addColorStop(0, 'rgba(40,30,18,0)'); g.addColorStop(1, 'rgba(40,30,18,0.5)'); x.fillStyle = g; x.fillRect(0, 330, W, 118);
  return c;
}
export function buildCrate() {
  return once('crate', () => {
    const S = 1.2, t = 0.09, parts = [];
    const face = uvRect(B(S - 0.04, S - 0.04, S - 0.04, 0, S / 2, 0), PR(512, 512, 0, 0, 512, 448));
    parts.push(face);
    const strip = PR(512, 512, 0, 452, 512, 508);
    const edge = (L) => uvRect(box(L, t, t), strip);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      parts.push(at(edge(S), 0, S / 2 + a * (S / 2 - t / 2), b * (S / 2 - t / 2)));
      parts.push(at(edge(S), a * (S / 2 - t / 2), S / 2 + b * (S / 2 - t / 2), 0, 0, HP, 0));
      parts.push(at(edge(S - 2 * t), a * (S / 2 - t / 2), S / 2, b * (S / 2 - t / 2), 0, 0, HP));
    }
    // diagonal braces on the two x faces
    for (const s of [-1, 1]) parts.push(at(uvRect(box(S * 1.25, t * 0.9, 0.03), strip), 0, S / 2, s * (S / 2 - 0.0), 0, 0, PI / 4));
    const geometry = mergeGeometries(parts.map((q) => { q = q.index ? q.toNonIndexed() : q; return q; }));
    geometry.computeBoundingSphere();
    return { geometry, material: std({ map: canvasTex(crateCanvas(), { repeat: false }), roughness: 0.88, metalness: 0 }), info: { tris: tris(geometry) } };
  });
}
const cabinWallMat = () => once('cabinWall', () => {
  const S = 256, c = makeCanvas(S, S), x = c.getContext('2d');
  const h = paint(x, 0, 0, S, S, { base: [0.74, 0.76, 0.72], under: [0.4, 0.38, 0.35], seed: 81, chip: 0.4, rust: 0.9, grime: 0.6, streak: 0.8, fx: 4, fy: 2, scratches: 50 });
  // corrugation: vertical ribs period 32 px (tile 0.8 m → 0.1 m pitch)
  const img = x.getImageData(0, 0, S, S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const ph = Math.sin((xx / 32) * 2 * PI), k = 0.9 + ph * 0.12;
    const i = (y * S + xx) * 4; for (let q = 0; q < 3; q++) img.data[i + q] = Math.min(255, img.data[i + q] * k);
    h[y * S + xx] += ph * 1.5;
  }
  x.putImageData(img, 0, 0);
  return std({ map: canvasTex(c), normalMap: heightToNormal(h, S, S, 1.6), roughness: 0.6, metalness: 0.3, vertexColors: true });
});
export function buildPortaCabin() {
  const WAL = 0, DRK = 1, WIN = 2, SGN = 3;
  const P = new Parts(4);
  const Wd = 6, Dp = 2.5, Y0 = 0.3, Ht = 2.6, us = 0.8, dk = [0.18, 0.18, 0.18];
  const wA = (g, c = WHITE) => P.add(g, WAL, c), dA = (g, c = dk) => P.add(g, DRK, c);
  // support blocks
  for (const x of [-2.6, 0, 2.6]) for (const z of [-0.95, 0.95]) dA(B(0.4, Y0, 0.4, x, Y0 / 2, z), [0.55, 0.53, 0.5]);
  // floor chassis + walls (front -z with door gap) + roof
  dA(B(Wd, 0.14, Dp, 0, Y0 + 0.07, 0), [0.15, 0.15, 0.15]);
  const y0 = Y0 + 0.14, wy = y0 + Ht / 2;
  wA(B(Wd, Ht, 0.08, 0, wy, Dp / 2 - 0.04, 0, 0, 0, us));
  wA(B(0.08, Ht, Dp - 0.16, -Wd / 2 + 0.04, wy, 0, 0, 0, 0, us)); wA(B(0.08, Ht, Dp - 0.16, Wd / 2 - 0.04, wy, 0, 0, 0, 0, us));
  // front wall pieces around door (x 1.6..2.5) and windows
  const fz = -Dp / 2 + 0.04, doorX = 2.05;
  wA(B(Wd / 2 + 1.6, Ht, 0.08, (-Wd / 2 + 1.6) / 2, wy, fz, 0, 0, 0, us));
  wA(B(0.5, Ht, 0.08, 2.75, wy, fz, 0, 0, 0, us));
  wA(B(0.9, Ht - 2.1, 0.08, doorX, y0 + 2.1 + (Ht - 2.1) / 2, fz, 0, 0, 0, us));
  dA(B(0.86, 2.06, 0.05, doorX, y0 + 1.03, fz - 0.02), [0.3, 0.36, 0.42]);
  dA(B(0.06, 0.04, 0.16, doorX - 0.3, y0 + 1.0, fz - 0.07), [0.7, 0.7, 0.68]);
  // corner posts + roof + gutter
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) dA(B(0.14, Ht + 0.1, 0.14, sx * (Wd / 2 - 0.05), wy, sz * (Dp / 2 - 0.05)), [0.35, 0.35, 0.36]);
  wA(B(Wd + 0.1, 0.14, Dp + 0.1, 0, y0 + Ht + 0.07, 0, 0, 0, 0, us), [0.8, 0.8, 0.8]);
  dA(B(Wd + 0.12, 0.06, 0.08, 0, y0 + Ht + 0.12, -Dp / 2 - 0.06), [0.3, 0.3, 0.3]);
  // windows (front x3, back x2) with frames + security grilles
  const win = (x, z, ry, s) => {
    const u0 = (x + 3) / 8;
    P.add(uvRect(new THREE.PlaneGeometry(1.1, 0.9), [u0, 0.15, u0 + 0.3, 0.75]).rotateY(ry).translate(x, y0 + 1.55, z + s * 0.045), WIN);
    dA(B(1.24, 0.07, 0.1, x, y0 + 1.05, z + s * 0.03)); dA(B(1.24, 0.07, 0.1, x, y0 + 2.05, z + s * 0.03));
    dA(B(0.07, 1.0, 0.1, x - 0.6, y0 + 1.55, z + s * 0.03)); dA(B(0.07, 1.0, 0.1, x + 0.6, y0 + 1.55, z + s * 0.03));
    for (let k = -2; k <= 2; k++) dA(B(0.02, 0.92, 0.02, x + k * 0.22, y0 + 1.55, z + s * 0.08), [0.25, 0.25, 0.25]);
  };
  for (const x of [-2.2, -0.9, 0.4]) win(x, fz, PI, -1);
  for (const x of [-1.5, 1.5]) win(x, Dp / 2 - 0.04, 0, 1);
  // steps (3 treads) + handrail in front of the door
  for (let i = 0; i < 3; i++) dA(B(1.0, 0.04, 0.3, doorX, 0.13 + i * 0.12 + 0.02, fz - 0.25 - (2 - i) * 0.26), [0.45, 0.44, 0.42]);
  dA(B(1.1, 0.04, 0.5, doorX, Y0 + 0.12, fz - 0.28), [0.45, 0.44, 0.42]);
  for (const s of [-1, 1]) { dA(strut([doorX + s * 0.52, 0, fz - 0.95], [doorX + s * 0.52, Y0 + 0.14, fz - 0.05], 0.05), [0.4, 0.4, 0.38]); dA(rod([doorX + s * 0.55, 0.9, fz - 0.95], [doorX + s * 0.55, 1.3, fz - 0.1], 0.02, 5), [0.75, 0.6, 0.1]); dA(strut([doorX + s * 0.55, 0.05, fz - 0.95], [doorX + s * 0.55, 0.92, fz - 0.95], 0.03), [0.75, 0.6, 0.1]); }
  // AC unit + vent on the side, sign over the door
  dA(B(0.3, 0.55, 0.75, Wd / 2 + 0.15, y0 + 1.9, 0.3), [0.7, 0.7, 0.68]);
  dA(C(0.2, 0.2, 0.02, 12, Wd / 2 + 0.31, y0 + 1.9, 0.3, 0, 0, HP), [0.12, 0.12, 0.12]);
  P.add(new THREE.PlaneGeometry(1.6, 0.36).rotateY(PI).translate(-0.9, y0 + 2.36, fz - 0.05), SGN);
  const geo = P.geometry({ [WAL]: groundGrime(0.2, 1.4, 0.65), [DRK]: groundGrime(0, 0.6, 0.75) });
  const sgn = once('cabinSign', () => {
    const c = signCanvas(512, 116, (x, W, H) => { const r = makeRng(8); x.fillStyle = '#f0ece0'; x.fillRect(0, 0, W, H); x.fillStyle = '#0d3b7a'; x.fillRect(6, 6, W - 12, H - 12); stencil(x, 'SITE OFFICE', W / 2, 46, 52, '#ffffff', r, { maxW: 470, wear: 0.05 }); stencil(x, 'PPE BEYOND THIS POINT', W / 2, 92, 22, '#ffd040', r, { maxW: 470, wear: 0.05, weight: '700' }); grimeOverlay(x, 0, 0, W, H, r, 25, '20,16,10'); });
    return std({ map: canvasTex(c, { repeat: false }), roughness: 0.5, metalness: 0.1 });
  });
  const root = new THREE.Group(); root.name = 'portaCabin';
  root.add(meshOf(geo, [cabinWallMat(), darkMat(), windowMat(), sgn]));
  return {
    root,
    colliders: [{ min: [-Wd / 2, 0, -Dp / 2], max: [Wd / 2 + 0.3, y0 + Ht + 0.2, Dp / 2] }, { min: [doorX - 0.6, 0, fz - 1.0], max: [doorX + 0.6, Y0 + 0.2, fz] }],
    anchors: { door: new THREE.Vector3(doorX, Y0 + 0.14, fz - 0.1), stepsBottom: new THREE.Vector3(doorX, 0, fz - 1.05) },
    info: { tris: tris(geo), drawCalls: geo.groups.length },
  };
}

// ================================================================ 8. DEMO YARD ====
function pallet() {
  const parts = [];
  for (let i = 0; i < 7; i++) parts.push(B(1.2, 0.022, 0.14, 0, 0.133, -0.53 + i * 0.177));
  for (const z of [-0.53, 0, 0.53]) for (const x of [-0.5, 0, 0.5]) parts.push(B(0.14, 0.08, 0.14, x, 0.082, z));
  for (const z of [-0.53, 0, 0.53]) parts.push(B(1.2, 0.022, 0.14, 0, 0.031, z));
  for (const x of [-0.5, 0, 0.5]) parts.push(B(0.12, 0.02, 1.2, x, 0.011, 0));
  const g = mergeGeometries(parts.map((q) => q.toNonIndexed()));
  return meshOf(g, once('palletMat', () => std({ color: 0x8a6a48, map: steelTex(), roughness: 0.9 })));
}
export function _demo(ctx = {}) {
  const root = new THREE.Group();
  let total = 0, calls = 0;
  const addInfo = (i) => { if (i) { total += i.tris || 0; calls += i.drawCalls || 1; } };
  const fk = buildForklift(); fk.root.position.set(0, 0, 0); fk.root.rotation.y = 0.35; root.add(fk.root); addInfo(fk.info);
  let Q = null; try { Q = new URLSearchParams(location.search); } catch (e) { /* none */ }
  fk.setLift(Q && Q.has('lift') ? +Q.get('lift') : 0.6); fk.steer(0.3); fk.spin(0.7);
  const D = drumAssets();
  // pallet of 4 drums on the forks
  const pl = pallet(); pl.position.set(0, 0, -0.65); fk.anchors.forks.add(pl);
  const dm = new THREE.InstancedMesh(D.geometry, D.material, 4);
  [[-0.31, -0.35], [0.31, -0.35], [-0.31, -0.97], [0.31, -0.97]].forEach(([x, z], i) => { dm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0.144, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 1.7, 0)), new THREE.Vector3(1, 1, 1))); });
  dm.castShadow = true; fk.anchors.forks.add(dm);
  // loose drums: standing, toppled, burnt
  const r = makeRng(3);
  const loose = new THREE.InstancedMesh(D.geometry, D.material, 9), burnt = new THREE.InstancedMesh(D.geometry, D.burntMaterial, 3);
  for (let i = 0; i < 9; i++) {
    const tip = i === 7 || i === 8;
    const pos = new THREE.Vector3(-4.6 + (i % 3) * 0.62 + (r() - 0.5) * 0.05, tip ? D.radius : 0, -2.8 + Math.floor(i / 3) * 0.62);
    if (tip) pos.set(-3.0 + (i - 7) * 0.4, D.radius, -0.4 + (i - 7) * 0.9);
    loose.setMatrixAt(i, new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(tip ? HP : 0, r() * 6, 0, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  }
  for (let i = 0; i < 3; i++) burnt.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(4 + i * 0.65, 0, -2.4 + (i % 2) * 0.3), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(1, 1, 1)));
  loose.castShadow = burnt.castShadow = true; root.add(loose, burnt); calls += 2; total += D.info.tris * 12;
  const gh = buildGatehouse(); gh.root.position.set(-9, 0, 4); gh.root.rotation.y = PI; gh.setBarrier(0.15); root.add(gh.root); addInfo(gh.info);
  const sg = buildSignGantry(); sg.root.position.set(0, 0, 13); root.add(sg.root); addInfo(sg.info);
  const fe = buildFence(36); fe.root.position.set(0, 0, -8); root.add(fe.root); addInfo(fe.info);
  const lm = buildLightMast(); lm.root.position.set(9, 0, -4.5); root.add(lm.root); addInfo(lm.info);
  const pc = buildPortaCabin(); pc.root.position.set(8, 0, 4); pc.root.rotation.y = PI; root.add(pc.root); addInfo(pc.info);
  const bo = buildBollard(), je = buildJersey(), cr = buildCrate();
  const bom = new THREE.InstancedMesh(bo.geometry, bo.material, 3), jem = new THREE.InstancedMesh(je.geometry, je.material, 3), crm = new THREE.InstancedMesh(cr.geometry, cr.material, 4);
  for (let i = 0; i < 3; i++) bom.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-6 + i * 2.2, 0, -6.2));
  [[1.5, 0, -6.4, 0], [4.6, 0, -6.4, 0.04], [7.4, 0, -5.8, 0.5]].forEach((p, i) => jem.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p[3], 0)), new THREE.Vector3(1, 1, 1))));
  [[3.4, 0, 1.4, 0.1], [4.65, 0, 1.3, -0.08], [4.0, 1.2, 1.35, 0.4], [-2.6, 0, 3.0, 0.7]].forEach((p, i) => crm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p[3], 0)), new THREE.Vector3(1, 1, 1))));
  for (const m of [bom, jem, crm]) { m.castShadow = m.receiveShadow = true; root.add(m); }
  total += bo.info.tris * 3 + je.info.tris * 3 + cr.info.tris * 4; calls += 3;
  // dusk emissive ramp from the viewer's ?dusk= param
  let dusk = 0;
  try { dusk = +(new URLSearchParams(location.search).get('dusk') || 0); } catch (e) { /* no location */ }
  const k = sstep(0.3, 0.8, dusk);
  root.traverse((o) => { if (!o.material) return; for (const m of [].concat(o.material)) if (m.userData.duskEmissive) m.emissiveIntensity = m.userData.duskEmissive * k; });
  let t0 = 0;
  return {
    root,
    update(dt, t) { t0 = t; },
    info: { forklift: fk.info, gatehouse: gh.info, gantry: sg.info, fence: fe.info, mast: lm.info, cabin: pc.info, drum: D.info.tris, bollard: bo.info.tris, jersey: je.info.tris, crate: cr.info.tris, approxTotalTris: total, approxCalls: calls },
  };
}
