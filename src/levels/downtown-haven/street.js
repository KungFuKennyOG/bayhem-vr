import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeNoise, fbm, makeCanvas, canvasTex, heightToNormal } from '../../textures.js';
import { AVE, CROSS, PLAZA, SUBWAY, streetGround } from './layout.js';
import { Bucket, M4, rmMaterial } from './cars.js';
import { buildSubwayInterior } from './subway.js';

// =====================================================================================
//  DOWNTOWN HAVEN — street surfaces, markings, street furniture (buildStreet) and the
//  HAVEN METRO entrance (buildSubway). World space; ground heights follow streetGround().
//  Static geometry is merged per material: road, markings, sidewalk, plaza, props (atlas ×
//  vertex colour, per-vertex roughness/metal/emission), lamp lenses, glass, foliage, light pools.
// =====================================================================================

const SW = AVE.sidewalkY;                         // 0.15
const XR = 120;                                   // how far the cross street is detailed
const FONT = '"Anton", Impact, "Arial Black", "DejaVu Sans", sans-serif', FONT2 = '"Oswald", "Arial Narrow", "DejaVu Sans Condensed", sans-serif';
const RM = { stone: [0.78, 0, 0], concrete: [0.9, 0, 0], paint: [0.42, 0.35, 0], metal: [0.45, 0.85, 0], alu: [0.32, 0.95, 0], chrome: [0.14, 1, 0], plastic: [0.6, 0.05, 0], rubber: [0.9, 0, 0], iron: [0.7, 0.6, 0], wood: [0.75, 0, 0], sign: [0.45, 0, 0.6], glow: [0.3, 0, 1], water: [0.04, 0.1, 0] };
const COL = { pole: [0.09, 0.095, 0.1], dark: [0.035, 0.035, 0.038], granite: [0.42, 0.41, 0.4], white: [1, 1, 1], alu: [0.6, 0.61, 0.62], green: [0.03, 0.12, 0.06], iron: [0.05, 0.048, 0.045] };
const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

let TEX = null;
// ---------------------------------------------------------------------- atlas rects (props atlas, 1024²)
const PA = 1024;
const A = {
  white: [0, 0, 32, 32], granite: [32, 0, 224, 64], news: [[0, 64, 128, 128], [128, 64, 128, 128], [256, 64, 128, 128]],
  aveSign: [384, 64, 256, 64], crossSign: [384, 128, 256, 64], metro: [0, 192, 512, 128], totem: [640, 64, 128, 384],
  poster: [768, 0, 256, 384], map: [0, 320, 384, 256], meter: [512, 192, 64, 64], bin: [576, 192, 64, 128],
  grate: [384, 320, 256, 256], police: [0, 576, 512, 64], station: [0, 640, 512, 64], plaque: [512, 576, 256, 128], ad2: [768, 384, 256, 384],
  tactile: [640, 192, 128, 128],
  papers: [[0, 704, 128, 128], [128, 704, 128, 128], [256, 704, 128, 128], [384, 704, 128, 128]], roadClosed: [0, 832, 256, 96], detour: [256, 832, 256, 96],
};
const WHITE = [16 / PA, 1 - 16 / PA];
const rUV = (r, S = PA) => [r[0] / S, 1 - (r[1] + r[3]) / S, (r[0] + r[2]) / S, 1 - r[1] / S];

// ---------------------------------------------------------------------- geometry helpers
const _v = new THREE.Vector3(), _n3 = new THREE.Matrix3();
function addGeo(bk, geo, m4, col, rm, rect = null) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  _n3.getNormalMatrix(m4);
  const uv = rect ? rUV(rect) : null;
  const pts = [], nrm = [], uvs = [];
  for (let i = 0; i < P.count; i++) {
    _v.fromBufferAttribute(P, i).applyMatrix4(m4); pts.push([_v.x, _v.y, _v.z]);
    _v.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); nrm.push([_v.x, _v.y, _v.z]);
    uvs.push(uv && U ? [uv[0] + (uv[2] - uv[0]) * U.getX(i), uv[1] + (uv[3] - uv[1]) * U.getY(i)] : WHITE);
  }
  for (let i = 0; i < pts.length; i += 3) bk.tri(pts[i], pts[i + 1], pts[i + 2], nrm[i], nrm[i + 1], nrm[i + 2], uvs[i], uvs[i + 1], uvs[i + 2], col, rm);
}
// world-space (box-projected) uv, `sc` metres per texture repeat — for big stone / concrete pieces on the tiling materials
function addStone(bk, geo, m4, col, sc = 6, rm = RM.stone) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const Pp = g.attributes.position, N = g.attributes.normal;
  _n3.getNormalMatrix(m4);
  const pts = [], nrm = [];
  for (let i = 0; i < Pp.count; i++) {
    _v.fromBufferAttribute(Pp, i).applyMatrix4(m4); pts.push([_v.x, _v.y, _v.z]);
    _v.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); nrm.push([_v.x, _v.y, _v.z]);
  }
  for (let i = 0; i < pts.length; i += 3) {
    const n = nrm[i], ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    const uv = (p) => (ay >= ax && ay >= az ? [p[0] / sc, -p[2] / sc] : ax >= az ? [p[2] / sc, p[1] / sc] : [p[0] / sc, p[1] / sc]);
    bk.tri(pts[i], pts[i + 1], pts[i + 2], nrm[i], nrm[i + 1], nrm[i + 2], uv(pts[i]), uv(pts[i + 1]), uv(pts[i + 2]), col, rm);
  }
}
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CYL = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s, 1);
// textured quad: centre c, unit right / up axes, size, uv rect [u0 v0 u1 v1] (already normalised)
function quadUV(bk, c, right, up, w, h, uv, col, rm) {
  const n = new THREE.Vector3(...right).cross(new THREE.Vector3(...up)).normalize().toArray();
  const P = (a, b) => [c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b];
  const hw = w / 2, hh = h / 2;
  const a = P(-hw, -hh), b = P(hw, -hh), cc = P(hw, hh), d = P(-hw, hh);
  bk.tri(a, b, cc, n, n, n, [uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], col, rm);
  bk.tri(a, cc, d, n, n, n, [uv[0], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]], col, rm);
}
const quad = (bk, c, right, up, w, h, rect, col = COL.white, rm = RM.sign) => quadUV(bk, c, right, up, w, h, rUV(rect), col, rm);
// horizontal grid (normal +y) with uv(x,z) / colour(x,z)
function ground(bk, x0, z0, x1, z1, y, cell, uvf, colf, rm = RM.concrete) {
  const nx = Math.max(1, Math.round((x1 - x0) / cell[0])), nz = Math.max(1, Math.round((z1 - z0) / cell[1]));
  const up = [0, 1, 0];
  const V = [];
  for (let i = 0; i <= nx; i++) { V.push([]); for (let j = 0; j <= nz; j++) { const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz; V[i].push({ p: [x, y, z], uv: uvf(x, z), c: colf(x, z) }); } }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const a = V[i][j], b = V[i + 1][j], c = V[i + 1][j + 1], d = V[i][j + 1];
    bk.tri(a.p, b.p, c.p, up, up, up, a.uv, b.uv, c.uv, [...a.c, ...b.c, ...c.c], rm);
    bk.tri(a.p, c.p, d.p, up, up, up, a.uv, c.uv, d.uv, [...a.c, ...c.c, ...d.c], rm);
  }
}
// grid with arbitrary xs / zs breakpoints (road: lanes need columns at the wheel paths)
function groundXZ(bk, xs, zs, y, uvf, colf, rm) {
  const up = [0, 1, 0];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const P = [[xs[i], zs[j]], [xs[i + 1], zs[j]], [xs[i + 1], zs[j + 1]], [xs[i], zs[j + 1]]].map(([x, z]) => ({ p: [x, y, z], uv: uvf(x, z), c: colf(x, z) }));
    bk.tri(P[0].p, P[1].p, P[2].p, up, up, up, P[0].uv, P[1].uv, P[2].uv, [...P[0].c, ...P[1].c, ...P[2].c], rm);
    bk.tri(P[0].p, P[2].p, P[3].p, up, up, up, P[0].uv, P[2].uv, P[3].uv, [...P[0].c, ...P[2].c, ...P[3].c], rm);
  }
}
function range(a, b, step) { const n = Math.max(1, Math.round((b - a) / step)), o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; }
function merged(...lists) { const s = [...new Set(lists.flat().map((v) => Math.round(v * 1000) / 1000))]; return s.sort((a, b) => a - b); }
function meshFrom(bk, mat, { shadow = false, receive = true, order = 0 } = {}) {
  const m = new THREE.Mesh(bk.geometry(), mat);
  m.castShadow = shadow; m.receiveShadow = receive; m.renderOrder = order;
  return m;
}

// ---------------------------------------------------------------------- textures
function genSurface(S, seed, fn) {
  const c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const [r, gg, b, hh] = fn(x, y);
    const i = (y * S + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255; h[y * S + x] = hh;
  }
  g.putImageData(img, 0, 0);
  return { c, g, h };
}
// crack polylines: gentle meander, rare short branches
function crackPaths(r, x, y, len, out = [], depth = 0) {
  let a = r() * Math.PI * 2; const pts = [[x, y]];
  for (let s = 0; s < len; s++) {
    a += (r() - 0.5) * 0.55; x += Math.cos(a) * 5; y += Math.sin(a) * 5; pts.push([x, y]);
    if (depth < 1 && s > 3 && r() < 0.035) crackPaths(r, x, y, (len - s) * 0.4 | 0, out, depth + 1);
  }
  out.push({ pts, depth });
  return out;
}
function strokePaths(g, paths, w, col) {
  g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const { pts, depth } of paths) { g.lineWidth = w * (depth ? 0.6 : 1); g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); }
}
// sealed crack: soft wide tar band (glossy in the roughness map) + faint hairline core
function sealedCrack(g, rg, r, x, y, len, scale = 1) {
  const P = crackPaths(r, x, y, len);
  strokePaths(g, P, 11 * scale, 'rgba(16,16,18,0.12)'); strokePaths(g, P, 6 * scale, 'rgba(14,14,16,0.2)'); strokePaths(g, P, 1.2 * scale, 'rgba(8,8,10,0.3)');
  if (rg) { strokePaths(rg, P, 9 * scale, 'rgb(90,90,90)'); }
}
function hairline(g, r, x, y, len, a = 0.22) { strokePaths(g, crackPaths(r, x, y, len), 1, `rgba(12,12,14,${a})`); }
function crack(g, r, x, y, len, w, col) { void w; void col; hairline(g, r, x, y, len, 0.25); }
function asphaltTex() {
  const S = 1024, n1 = makeNoise(501, 16), n2 = makeNoise(502, 256), n3 = makeNoise(504, 64), r = makeRng(503);
  const { c, g, h } = genSurface(S, 1, (x, y) => {
    const u = x / S, v = y / S;
    const m = fbm(n1, u, v, 4, 4), f = n2(u * 256, v * 256), f2 = n3(u * 64, v * 64), q = r();
    let b = 0.31 + (m - 0.5) * 0.17 + (f - 0.5) * 0.05 + (f2 - 0.5) * 0.04 + (q - 0.5) * 0.045;
    let hh = f * 0.55 + q * 0.3 + f2 * 0.15;
    if (q > 0.988) { b += 0.08; hh += 0.25; } else if (q < 0.02) { b -= 0.05; hh -= 0.2; }
    const bit = Math.max(0, fbm(n3, u + 0.31, v + 0.77, 3, 3) - 0.6) * 2.2; b -= bit * 0.12; hh -= bit * 0.3;   // bitumen-rich, smooth
    return [b * 255 * 1.05, b * 255 * 0.99, b * 255 * 0.9, hh];
  });
  // roughness map (G channel): asphalt 0.85, sealed tar bands glossier
  const rc = makeCanvas(S, S), rg = rc.getContext('2d'); rg.fillStyle = 'rgb(217,217,217)'; rg.fillRect(0, 0, S, S);
  for (let k = 0; k < 4; k++) hairline(g, r, r() * S, r() * S, 14 + r() * 24 | 0, 0.2);
  for (let k = 0; k < 3; k++) sealedCrack(g, rg, r, r() * S, r() * S, 30 + r() * 40 | 0);
  const map = canvasTex(c, { aniso: 16 }), normal = heightToNormal(h, S, S, 2.4), rough = canvasTex(rc, { srgb: false, aniso: 16 });
  normal.anisotropy = 16;
  return { map, normal, rough };
}
function sidewalkTex() {
  const S = 1024, P = S / 4, n1 = makeNoise(611, 32), n2 = makeNoise(612, 256), r = makeRng(613);
  const slab = []; for (let k = 0; k < 16; k++) slab.push((r() - 0.5) * 0.09);
  const { c, g, h } = genSurface(S, 2, (x, y) => {
    const u = x / S, v = y / S, i = (x / P) | 0, j = (y / P) | 0, lx = x % P, ly = y % P;
    let b = 0.66 + slab[j * 4 + i] + (fbm(n1, u, v, 4, 4) - 0.5) * 0.12 + (n2(u * 256, v * 256) - 0.5) * 0.05 + (r() - 0.5) * 0.05;
    b += Math.sin(y * 1.9 + n1(u * 8, v * 8) * 3) * 0.008;               // broom finish
    let hh = 0.5 + n2(u * 256, v * 256) * 0.2;
    const e = Math.min(lx, ly, P - 1 - lx, P - 1 - ly);
    if (e < 2) { b = 0.24; hh = 0; } else if (e < 5) { b -= 0.06 * (5 - e) / 3; hh = 0.3 + e * 0.04; } else if (e < 9) b += 0.03;   // tooled edge
    const st = Math.max(0, fbm(n1, u + 0.5, v + 0.2, 3, 4) - 0.6); b -= st * 0.5;
    return [b * 255, b * 252, b * 244, hh];
  });
  // gum, stains, cracks, chips
  for (let k = 0; k < 260; k++) { const x = r() * S, y = r() * S, rr = 2 + r() * 4; g.fillStyle = `rgba(${40 + r() * 30 | 0},${40 + r() * 28 | 0},${42 + r() * 30 | 0},${0.55 + r() * 0.35})`; g.beginPath(); g.ellipse(x, y, rr, rr * (0.7 + r() * 0.3), r() * 3, 0, 7); g.fill(); }
  for (let k = 0; k < 10; k++) { const x = r() * S, y = r() * S, rr = 20 + r() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(50,42,34,0.35)'); gr.addColorStop(1, 'rgba(50,42,34,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  for (let k = 0; k < 4; k++) hairline(g, r, r() * S, r() * S, 8 + r() * 16 | 0, 0.3);
  const map = canvasTex(c, { aniso: 16 }), normal = heightToNormal(h, S, S, 3);
  normal.anisotropy = 16;
  return { map, normal };
}
function paverTex() {
  const S = 1024, n1 = makeNoise(711, 32), r = makeRng(712);
  const pw = S / 6, ph = S / 12;   // 0.6 x 0.3 m pavers on a 3.6 m tile
  const tone = []; for (let k = 0; k < 6 * 12 * 2; k++) tone.push((r() - 0.5) * 0.1);
  const { c, g, h } = genSurface(S, 3, (x, y) => {
    const row = (y / ph) | 0, off = row % 2 ? pw / 2 : 0, col = (((x + off) / pw) | 0), lx = (x + off) % pw, ly = y % ph;
    const band = row % 6 === 0 || row % 6 === 5;
    let base = band ? [0.24, 0.23, 0.22] : [0.62, 0.58, 0.53];
    const t = tone[(row * 7 + col) % tone.length] + (fbm(n1, x / S, y / S, 4, 4) - 0.5) * 0.1 + (r() - 0.5) * 0.08;
    const e = Math.min(lx, ly, pw - 1 - lx, ph - 1 - ly);
    let k = 1 + t, hh = 0.6;
    if (e < 2) { k = 0.35; hh = 0; } else if (e < 4) { k *= 0.88; hh = 0.4; }
    return [base[0] * k * 255, base[1] * k * 255, base[2] * k * 255, hh + r() * 0.1];
  });
  for (let k = 0; k < 120; k++) { g.fillStyle = `rgba(40,38,36,${0.4 + r() * 0.4})`; g.beginPath(); g.arc(r() * S, r() * S, 1.5 + r() * 3, 0, 7); g.fill(); }
  const map = canvasTex(c, { aniso: 16 }), normal = heightToNormal(h, S, S, 2.5);
  normal.anisotropy = 16;
  return { map, normal };
}
function tileTex() {
  const S = 512, tw = S / 8, th = S / 16, r = makeRng(811), n1 = makeNoise(812, 16);
  const tone = []; for (let k = 0; k < 128; k++) tone.push((r() - 0.5) * 0.06);
  const { c, g, h } = genSurface(S, 4, (x, y) => {
    const row = (y / th) | 0, off = row % 2 ? tw / 2 : 0, col = ((x + off) / tw) | 0, lx = (x + off) % tw, ly = y % th;
    const e = Math.min(lx, ly, tw - 1 - lx, th - 1 - ly);
    let b = 0.86 + tone[(row * 8 + col) % 128] + (fbm(n1, x / S, y / S, 3, 3) - 0.5) * 0.05, hh = 1;
    if (e < 2) { b = 0.38; hh = 0; } else if (e < 4) { b -= 0.05; hh = 0.6; }
    return [b * 255, b * 252, b * 240, hh];
  });
  for (let k = 0; k < 5; k++) crack(g, r, r() * S, r() * S, 6 + r() * 10 | 0, 1, 'rgba(60,55,50,0.6)');
  const map = canvasTex(c, { aniso: 8 }), normal = heightToNormal(h, S, S, 2);
  return { map, normal };
}
function leafTex() {
  // a loose spray of 6-8 leaf sub-clusters with gaps between them (no round blob), olive / desaturated,
  // dark background bleed + hard alpha test → no pale fringe
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = makeRng(911);
  g.fillStyle = 'rgb(24,27,15)'; g.fillRect(0, 0, S, S);
  const a = makeCanvas(S, S), ag = a.getContext('2d');
  ag.fillStyle = '#000'; ag.fillRect(0, 0, S, S);
  const subs = []; for (let k = 0; k < 8; k++) { const an = r() * 7, d = (0.12 + r() * 0.24) * S; subs.push([S / 2 + Math.cos(an) * d, S / 2 + Math.sin(an) * d, (0.1 + r() * 0.07) * S]); }
  subs.push([S / 2, S / 2, 0.14 * S]);
  for (const [sx, sy, sr] of subs) {
    // twig
    g.strokeStyle = 'rgb(40,32,24)'; ag.strokeStyle = '#fff'; g.lineWidth = ag.lineWidth = 3;
    for (const cx of [g, ag]) { cx.beginPath(); cx.moveTo(S / 2, S / 2); cx.lineTo(sx, sy); cx.stroke(); }
    for (let k = 0; k < 150; k++) {
      const an = r() * 7, d = Math.pow(r(), 0.6) * sr, x = sx + Math.cos(an) * d, y = sy + Math.sin(an) * d * 0.85;
      const l = 6 + r() * 8, rot = r() * 7, lit = (1 - d / sr * 0.45) * (0.65 + r() * 0.45) * (y < sy ? 1.08 : 0.82);
      g.fillStyle = `rgb(${(58 + r() * 22) * lit | 0},${(66 + r() * 22) * lit | 0},${(32 + r() * 12) * lit | 0})`;
      g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, l, l * 0.45, 0, 0, 7); g.fill(); g.restore();
      ag.fillStyle = '#fff'; ag.save(); ag.translate(x, y); ag.rotate(rot); ag.beginPath(); ag.ellipse(0, 0, l, l * 0.45, 0, 0, 7); ag.fill(); ag.restore();
    }
  }
  const id = g.getImageData(0, 0, S, S), ad = ag.getImageData(0, 0, S, S).data;
  for (let i = 0; i < id.data.length; i += 4) id.data[i + 3] = ad[i];
  g.putImageData(id, 0, 0);
  return canvasTex(c, { repeat: false, aniso: 4 });
}
// road markings / decals atlas (RGBA)
const MK = {
  line: [0, 0, 512, 64], line2: [0, 64, 512, 64], skid: [512, 0, 512, 128], patch: [0, 128, 256, 256], cracks: [256, 128, 256, 256],
  manhole: [512, 128, 256, 256], oil: [[768, 128, 128, 128], [896, 128, 128, 128], [768, 256, 128, 128], [896, 256, 128, 128]],
  drain: [0, 384, 256, 128], pothole: [256, 384, 256, 256], puddle: [512, 704, 512, 320], tar: [512, 384, 512, 64], pool: [512, 448, 256, 256], scorch: [768, 448, 256, 256],
  arrow: [0, 512, 128, 256], xing: [128, 640, 384, 128], patchL: [0, 768, 256, 256], tyre: [256, 768, 256, 256],
};
function markingsTex() {
  const S = 1024, c = makeCanvas(S, S), g = c.getContext('2d'), r = makeRng(1001), n = makeNoise(1002, 32);
  g.clearRect(0, 0, S, S);
  // worn paint strips (white; tinted per vertex)
  for (const [rx, ry, w, hh] of [MK.line, MK.line2]) {
    const img = g.createImageData(w, hh), seed = ry * 0.01;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const wear = fbm(n, x / w * 4 + seed, y / hh * 0.5 + seed, 8, 4), edge = 1 - Math.pow(Math.abs(y / hh - 0.5) * 2, 8);
      const a = Math.min(1, Math.max(0, (wear - 0.3) * 4)) * edge * (0.75 + r() * 0.25);
      const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 236 + r() * 19; img.data[i + 3] = a * 240;
    }
    g.putImageData(img, rx, ry);
  }
  // skid marks: two rubber streaks fading at both ends
  { const [x, y, w, hh] = MK.skid; for (const yy of [y + 30, y + 92]) for (let k = 0; k < 40; k++) { const t = k / 40; g.strokeStyle = `rgba(8,8,8,${0.05 + 0.07 * Math.sin(t * Math.PI)})`; g.lineWidth = 14 + r() * 8; g.beginPath(); g.moveTo(x + 10 + r() * 20, yy + (r() - 0.5) * 6); g.lineTo(x + w - 10 - r() * 40, yy + (r() - 0.5) * 6); g.stroke(); } }
  // patch: fresher darker asphalt with sealed seams
  { const [x, y, w, hh] = MK.patch; g.fillStyle = 'rgba(14,14,16,0.3)'; g.fillRect(x + 10, y + 10, w - 20, hh - 20); for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 90},${r() < 0.5 ? 0 : 90},${r() < 0.5 ? 0 : 90},0.25)`; g.fillRect(x + 10 + r() * (w - 20), y + 10 + r() * (hh - 20), 2, 2); } g.strokeStyle = 'rgba(4,4,6,0.45)'; g.lineWidth = 3; g.strokeRect(x + 10, y + 10, w - 20, hh - 20); }
  // crack network
  { const [x, y, w, hh] = MK.cracks; g.save(); g.beginPath(); g.rect(x, y, w, hh); g.clip(); for (let k = 0; k < 2; k++) sealedCrack(g, null, r, x + w / 2 + (r() - 0.5) * 50, y + hh / 2 + (r() - 0.5) * 50, 18 + r() * 12 | 0, 0.8); hairline(g, r, x + w / 2, y + hh / 2, 14, 0.2); g.restore(); }
  // manhole cover
  { const [x, y, w] = MK.manhole, cx = x + w / 2, cy = y + w / 2, R = w / 2 - 4;
    g.fillStyle = '#2a2826'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.strokeStyle = '#151413'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R - 3, 0, 7); g.stroke();
    g.fillStyle = '#3e3b37'; for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const px = cx + i * 17, py = cy + j * 17; if (Math.hypot(px - cx, py - cy) < R - 26) g.fillRect(px - 5, py - 5, 10, 10); }
    g.fillStyle = '#1d1c1a'; g.beginPath(); g.arc(cx, cy, 44, 0, 7); g.fill();
    g.fillStyle = '#4c4843'; g.font = `400 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HAVEN', cx, cy - 10); g.font = `600 13px ${FONT2}`; g.fillText('CITY SEWER', cx, cy + 14);
    g.strokeStyle = 'rgba(10,10,10,0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); }
  // oil stains
  for (const [x, y, w] of MK.oil) for (let k = 0; k < 6; k++) { const px = x + w / 2 + (r() - 0.5) * 50, py = y + w / 2 + (r() - 0.5) * 50, rr = 14 + r() * 30; const gr = g.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, 'rgba(6,5,8,0.55)'); gr.addColorStop(0.7, 'rgba(10,8,12,0.3)'); gr.addColorStop(1, 'rgba(10,8,12,0)'); g.fillStyle = gr; g.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  // storm drain grate
  { const [x, y, w, hh] = MK.drain; g.fillStyle = '#24221f'; g.fillRect(x + 4, y + 8, w - 8, hh - 16); g.fillStyle = '#050505'; for (let k = 0; k < 13; k++) g.fillRect(x + 16 + k * 17.5, y + 18, 9, hh - 36); g.strokeStyle = '#3a3733'; g.lineWidth = 4; g.strokeRect(x + 6, y + 10, w - 12, hh - 20); }
  // pothole
  { const [x, y, w] = MK.pothole, cx = x + w / 2, cy = y + w / 2; g.save(); g.beginPath(); g.rect(x, y, w, w); g.clip();
    const pts = []; for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2, rr = 70 + r() * 40; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.75]); }
    g.fillStyle = 'rgba(70,64,58,0.55)'; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px * 1.08 - cx * 0.08, py * 1.08 - cy * 0.08) : g.moveTo(px * 1.08 - cx * 0.08, py * 1.08 - cy * 0.08))); g.fill();
    const gr = g.createRadialGradient(cx, cy, 10, cx, cy, 110); gr.addColorStop(0, 'rgba(10,9,8,0.98)'); gr.addColorStop(0.6, 'rgba(22,20,18,0.95)'); gr.addColorStop(1, 'rgba(40,36,32,0.9)');
    g.fillStyle = gr; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.fill();
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${90 + r() * 60 | 0},${86 + r() * 50 | 0},${80 + r() * 40 | 0},0.9)`; g.beginPath(); g.arc(cx + (r() - 0.5) * 120, cy + (r() - 0.5) * 80, 1.5 + r() * 4, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(30,40,50,0.5)'; g.beginPath(); g.ellipse(cx + 8, cy + 6, 40, 22, 0.3, 0, 7); g.fill();      // puddle
    g.restore(); }
  // tar snakes
  { const [x, y, w, hh] = MK.tar; const pts = []; const p1 = r() * 6, p2 = r() * 6;
    for (let k = 0; k <= 48; k++) { const t = k / 48; pts.push([x + 8 + t * (w - 16), y + hh / 2 + Math.sin(t * 9 + p1) * 6 + Math.sin(t * 23 + p2) * 2.5]); }
    const P = [{ pts, depth: 0 }];
    strokePaths(g, P, 16, 'rgba(18,18,20,0.16)'); strokePaths(g, P, 9, 'rgba(14,14,16,0.26)'); strokePaths(g, P, 1.4, 'rgba(8,8,10,0.3)'); }
  // light pool (white radial)
  { const [x, y, w] = MK.pool, cx = x + w / 2, cy = y + w / 2; const gr = g.createRadialGradient(cx, cy, 0, cx, cy, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, w, w); }
  // scorch (earlier chaos)
  { const [x, y, w] = MK.scorch, cx = x + w / 2, cy = y + w / 2; for (let k = 0; k < 40; k++) { const a = r() * 7, d = r() * 70, rr = 20 + r() * 50; const gr = g.createRadialGradient(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0, cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr); gr.addColorStop(0, 'rgba(4,3,2,0.35)'); gr.addColorStop(1, 'rgba(4,3,2,0)'); g.fillStyle = gr; g.fillRect(x, y, w, w); } for (let k = 0; k < 30; k++) { const a = r() * 7; g.strokeStyle = 'rgba(5,4,3,0.4)'; g.lineWidth = 2 + r() * 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40); g.lineTo(cx + Math.cos(a) * 125, cy + Math.sin(a) * 125); g.stroke(); } }
  // light patch repair: older, sun-bleached grey asphalt with a darker sealed edge
  { const [x, y, w, hh] = MK.patchL, nn = makeNoise(1004, 16), img = g.createImageData(w, hh);
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      const e = Math.min(i, j, w - 1 - i, hh - 1 - j), n = fbm(nn, i / w, j / hh, 4, 4), q = r();
      const k = (j * w + i) * 4, edge = e < 6;
      const v = edge ? 30 : 150 + (n - 0.5) * 60 + (q - 0.5) * 50;
      img.data[k] = v * 1.04; img.data[k + 1] = v; img.data[k + 2] = v * 0.9; img.data[k + 3] = (edge ? 0.6 : 0.32 + (n - 0.5) * 0.2) * 255 * (e < 3 ? e / 3 : 1);
    }
    g.putImageData(img, x, y); }
  // tyre tracks: two soft rubber bands with tread print (braking / burnout traces)
  { const [x, y, w, hh] = MK.tyre;
    for (const cx of [x + 64, x + 192]) for (let j = 0; j < hh; j += 3) { const a = 0.18 * Math.sin(Math.PI * j / hh); g.fillStyle = `rgba(6,6,6,${a})`; g.fillRect(cx - 26, y + j, 52, 3); if ((j / 3) % 3 === 0) { g.fillStyle = `rgba(6,6,6,${a * 0.8})`; g.fillRect(cx - 22, y + j, 44, 1); } } }
  // puddle mask (white, soft irregular edge; alpha = wetness)
  { const [x, y, w, hh] = MK.puddle;
    const img = g.createImageData(w, hh), nn = makeNoise(1003, 16);
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      const u = (i - w / 2) / (w / 2), v = (j - hh / 2) / (hh / 2), d = Math.sqrt(u * u + v * v);
      const e = d + (fbm(nn, i / w, j / hh, 3, 4) - 0.5) * 0.9;
      const a = Math.min(1, Math.max(0, (0.78 - e) * 5)) * 0.95 + Math.min(1, Math.max(0, (1.0 - e) * 2.5)) * 0.05;
      const k = (j * w + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = a * 255;
    }
    g.putImageData(img, x, y); }
  // lane arrow (straight + left)
  { const [x, y, w, hh] = MK.arrow; g.fillStyle = 'rgba(240,238,230,0.92)'; g.fillRect(x + 54, y + 90, 20, 160); g.beginPath(); g.moveTo(x + 24, y + 96); g.lineTo(x + 64, y + 8); g.lineTo(x + 104, y + 96); g.fill(); }
  // XING text-ish "SLOW"
  { const [x, y, w, hh] = MK.xing; g.fillStyle = 'rgba(240,238,230,0.9)'; g.font = `400 110px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SLOW', x + w / 2, y + hh / 2 + 6); }
  const t = canvasTex(c, { repeat: false, aniso: 16 });
  return t;
}
function propsAtlas() {
  const c = makeCanvas(PA, PA), g = c.getContext('2d'), r = makeRng(1201);
  g.fillStyle = '#fff'; g.fillRect(0, 0, PA, PA);
  const txt = (s, x, y, size, col, font = FONT, align = 'center', maxW = 0) => { g.font = `400 ${size}px ${font}`; if (maxW) { const w = g.measureText(s).width; if (w > maxW) g.font = `400 ${Math.floor(size * maxW / w)}px ${font}`; } g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  // granite speckle
  { const [x, y, w, h] = A.granite; g.fillStyle = '#b8b4ae'; g.fillRect(x, y, w, h); for (let k = 0; k < 2600; k++) { const t = r(); g.fillStyle = t < 0.45 ? 'rgba(40,38,38,0.6)' : t < 0.8 ? 'rgba(235,232,226,0.6)' : 'rgba(150,120,110,0.5)'; g.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1 + r() * 2); } }
  // newspaper box faces
  const papers = [['HAVEN HERALD', '#1d3e7a', '#e8e2d2'], ['THE DAILY BAY', '#a3161a', '#f0eee8'], ['CITY WEEKLY', '#18603a', '#f2ede0']];
  A.news.forEach(([x, y, w, h], i) => {
    const [name, col, paper] = papers[i]; g.fillStyle = col; g.fillRect(x, y, w, h);
    g.fillStyle = paper; g.fillRect(x + 10, y + 34, w - 20, h - 56);
    txt(name, x + w / 2, y + 18, 22, '#fff', FONT, 'center', w - 12);
    g.fillStyle = '#222'; g.fillRect(x + 16, y + 40, w - 32, 14); txt('CHAOS DOWNTOWN', x + w / 2, y + 47, 13, '#fff', FONT, 'center', w - 36);
    for (let k = 0; k < 7; k++) g.fillRect(x + 16, y + 60 + k * 6, (w - 32) * (0.6 + r() * 0.4), 2);
    g.fillStyle = '#777'; g.fillRect(x + 66, y + 60, 46, 36);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x + 10, y + 34); g.lineTo(x + 60, y + 34); g.lineTo(x + 10, y + 100); g.fill();
    g.fillStyle = '#ccc'; g.fillRect(x + w / 2 - 14, y + h - 18, 28, 10);
  });
  // street name signs
  for (const [rect, name, sub] of [[A.aveSign, 'HAVEN AVE', '100'], [A.crossSign, 'GRAND ST', 'W  E']]) { const [x, y, w, h] = rect; g.fillStyle = '#0f5a32'; g.fillRect(x, y, w, h); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x + 4, y + 4, w - 8, h - 8); txt(name, x + w / 2 - 14, y + h / 2 + 2, 40, '#fff', FONT, 'center', w - 70); txt(sub, x + w - 26, y + h / 2, 14, '#fff', FONT2); }
  // HAVEN METRO fascia
  { const [x, y, w, h] = A.metro; g.fillStyle = '#0d1f17'; g.fillRect(x, y, w, h); g.fillStyle = '#1f8a4c'; g.beginPath(); g.arc(x + 64, y + h / 2, 44, 0, 7); g.fill(); txt('M', x + 64, y + h / 2 + 3, 62, '#fff'); txt('HAVEN METRO', x + 300, y + 52, 64, '#f4f1e6', FONT, 'center', 360); txt('GRAND ST  ·  LINES 2  4  7', x + 300, y + 100, 22, '#7fd3a0', FONT2, 'center', 360); g.fillStyle = '#c9a646'; g.fillRect(x, y + h - 6, w, 6); }
  // totem (vertical)
  { const [x, y, w, h] = A.totem; g.fillStyle = '#0d1f17'; g.fillRect(x, y, w, h); g.fillStyle = '#1f8a4c'; g.beginPath(); g.arc(x + w / 2, y + 70, 48, 0, 7); g.fill(); txt('M', x + w / 2, y + 74, 66, '#fff');
    g.save(); g.translate(x + w / 2, y + 250); g.rotate(-Math.PI / 2); txt('METRO', 0, 0, 62, '#f4f1e6'); g.restore();
    for (const [k, col] of [['2', '#d8382a'], ['4', '#2a6ad8'], ['7', '#e0a21a']].entries()) { g.fillStyle = col[1]; g.beginPath(); g.arc(x + 28 + k * 36, y + 352, 15, 0, 7); g.fill(); txt(col[0], x + 28 + k * 36, y + 354, 20, '#fff'); } }
  // shelter poster (lit): fictional blockbuster
  { const [x, y, w, h] = A.poster; const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#0a0a14'); gr.addColorStop(0.45, '#7a1e08'); gr.addColorStop(0.7, '#ff8a1a'); gr.addColorStop(1, '#1a0a04'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    const rg = g.createRadialGradient(x + w / 2, y + 250, 0, x + w / 2, y + 250, 120); rg.addColorStop(0, 'rgba(255,240,200,1)'); rg.addColorStop(0.4, 'rgba(255,140,30,0.8)'); rg.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = rg; g.fillRect(x, y + 120, w, 260);
    g.fillStyle = '#050505'; g.fillRect(x + 80, y + 150, 26, 120); g.fillRect(x + 150, y + 170, 22, 100); g.beginPath(); g.arc(x + 93, y + 140, 13, 0, 7); g.arc(x + 161, y + 160, 11, 0, 7); g.fill();
    txt('BLAST', x + w / 2, y + 50, 74, '#fff2d0'); txt('RADIUS', x + w / 2, y + 112, 58, '#ffb21a'); txt('THIS SUMMER  •  ONLY IN THEATERS', x + w / 2, y + h - 22, 16, '#ffe0b0', FONT2, 'center', w - 20); }
  { const [x, y, w, h] = A.ad2; const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#d9e6ee'); gr.addColorStop(1, '#6f8fa6'); g.fillStyle = gr; g.fillRect(x, y, w, h); g.fillStyle = '#111'; g.beginPath(); g.ellipse(x + w / 2, y + 190, 70, 110, 0, 0, 7); g.fill(); g.fillStyle = '#c9a646'; g.beginPath(); g.ellipse(x + w / 2, y + 190, 54, 92, 0, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.ellipse(x + w / 2, y + 190, 40, 76, 0, 0, 7); g.fill(); txt('MERIDIAN', x + w / 2, y + 44, 48, '#111'); txt('THE FUTURE IS OURS', x + w / 2, y + 330, 22, '#111', FONT2); txt('MERIDIAN DYNAMICS', x + w / 2, y + 360, 14, '#333', FONT2); }
  // metro map
  { const [x, y, w, h] = A.map; g.fillStyle = '#f2efe6'; g.fillRect(x, y, w, h); g.fillStyle = '#0d1f17'; g.fillRect(x, y, w, 30); txt('HAVEN METRO  —  SYSTEM MAP', x + w / 2, y + 16, 18, '#fff', FONT2);
    g.lineWidth = 7; g.lineCap = 'round'; for (const [col, pts] of [['#d8382a', [[30, 220], [120, 160], [200, 160], [360, 60]]], ['#2a6ad8', [[40, 60], [160, 120], [260, 200], [350, 230]]], ['#e0a21a', [[20, 140], [190, 140], [370, 150]]]]) { g.strokeStyle = col; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py))); g.stroke(); for (const [px, py] of pts) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x + px, y + py, 6, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.lineWidth = 7; g.strokeStyle = col; } }
    g.fillStyle = '#d8382a'; g.beginPath(); g.arc(x + 190, y + 145, 11, 0, 7); g.fill(); txt('YOU ARE HERE', x + 190, y + 176, 13, '#111', FONT2); }
  // parking meter face, bin label, tactile pad, grate, police tape, station tiles, plaque
  { const [x, y, w, h] = A.meter; g.fillStyle = '#222'; g.fillRect(x, y, w, h); g.fillStyle = '#7fb27f'; g.fillRect(x + 10, y + 10, w - 20, 18); txt('EXPIRED', x + w / 2, y + 19, 9, '#300', FONT2); g.fillStyle = '#999'; g.fillRect(x + 26, y + 40, 12, 3); }
  { const [x, y, w, h] = A.bin; g.fillStyle = '#1d4a2a'; g.fillRect(x, y, w, h); for (let k = 0; k < 7; k++) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x + 6 + k * 8, y + 8, 4, h - 16); } g.fillStyle = '#e9e3cf'; g.fillRect(x + 4, y + 52, w - 8, 22); txt('LITTER', x + w / 2, y + 63, 14, '#1d4a2a'); }
  { const [x, y, w, h] = A.tactile; g.fillStyle = '#d4a41c'; g.fillRect(x, y, w, h); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const px = x + 8 + i * 16, py = y + 8 + j * 16; const gr = g.createRadialGradient(px - 2, py - 2, 0, px, py, 6); gr.addColorStop(0, '#ffe07a'); gr.addColorStop(1, '#9a7410'); g.fillStyle = gr; g.beginPath(); g.arc(px, py, 5.5, 0, 7); g.fill(); } }
  { const [x, y, w, h] = A.grate; const cx = x + w / 2, cy = y + h / 2; g.fillStyle = '#3a2a1c'; g.fillRect(x, y, w, h); for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${r() < 0.5 ? 20 : 90},${r() < 0.5 ? 14 : 60},${r() < 0.5 ? 8 : 30},0.5)`; g.fillRect(x + r() * w, y + r() * h, 3, 3); }
    g.strokeStyle = '#1c1b1a'; g.lineWidth = 7; for (let k = 1; k <= 6; k++) { g.beginPath(); g.arc(cx, cy, k * 19, 0, 7); g.stroke(); } for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); g.lineTo(cx + Math.cos(a) * 128, cy + Math.sin(a) * 128); g.stroke(); }
    g.lineWidth = 14; g.strokeRect(x + 6, y + 6, w - 12, h - 12); g.fillStyle = '#4a2f1a'; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill(); }
  { const [x, y, w, h] = A.police; g.fillStyle = '#f2f2f2'; g.fillRect(x, y, w, h); g.fillStyle = '#163a8a'; for (let k = -2; k < 18; k++) { g.beginPath(); g.moveTo(x + k * 32, y + h); g.lineTo(x + k * 32 + 16, y + h); g.lineTo(x + k * 32 + 48, y); g.lineTo(x + k * 32 + 32, y); g.fill(); } g.fillStyle = 'rgba(242,242,242,0.92)'; g.fillRect(x + 110, y + 10, 292, 44); txt('POLICE LINE  ·  HCPD', x + 256, y + 33, 30, '#111', FONT, 'center', 280); }
  { const [x, y, w, h] = A.station; g.fillStyle = '#1b5e3a'; g.fillRect(x, y, w, h); for (let i = 0; i < w; i += 8) for (let j = 0; j < h; j += 8) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0.06)`; g.fillRect(x + i, y + j, 7, 7); } g.fillStyle = '#c9a646'; g.fillRect(x, y + 4, w, 4); g.fillRect(x, y + h - 8, w, 4); txt('GRAND  STREET', x + w / 2, y + h / 2 + 2, 36, '#f4f1e6', FONT, 'center', w - 30); }
  // litter: newspaper page, crumpled flyer, cardboard, fast-food bag; fallen signs
  { const P4 = A.papers;
    let [x, y, w, h] = P4[0]; g.fillStyle = '#d8d2c2'; g.fillRect(x, y, w, h); g.fillStyle = '#222'; g.fillRect(x + 8, y + 8, w - 16, 12); g.fillStyle = 'rgba(40,40,40,0.55)'; for (let k = 0; k < 14; k++) { g.fillRect(x + 8, y + 26 + k * 7, 52, 2); g.fillRect(x + 68, y + 26 + k * 7, 52, 2); } g.fillStyle = '#888'; g.fillRect(x + 70, y + 30, 48, 34);
    [x, y, w, h] = P4[1]; g.fillStyle = '#f0ece2'; g.fillRect(x, y, w, h); for (let k = 0; k < 12; k++) { g.strokeStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x + r() * w, y + r() * h); g.lineTo(x + r() * w, y + r() * h); g.stroke(); } txt('SALE', x + w / 2, y + 40, 34, '#c4241c'); g.fillStyle = 'rgba(30,30,30,0.5)'; for (let k = 0; k < 5; k++) g.fillRect(x + 16, y + 70 + k * 9, w - 32, 3);
    [x, y, w, h] = P4[2]; g.fillStyle = '#9a7650'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h / 2 - 2, w, 4); g.fillStyle = 'rgba(60,40,20,0.6)'; g.fillRect(x + 20, y + 20, 40, 14); txt('FRAGILE', x + 80, y + 96, 18, '#5a1a10');
    [x, y, w, h] = P4[3]; g.fillStyle = '#e6dcc8'; g.fillRect(x, y, w, h); g.fillStyle = '#b32a1c'; g.fillRect(x, y + 40, w, 34); txt('BURGER', x + w / 2, y + 58, 26, '#ffd23a'); g.fillStyle = 'rgba(120,90,40,0.35)'; g.beginPath(); g.arc(x + 90, y + 100, 18, 0, 7); g.fill();
    [x, y, w, h] = A.roadClosed; g.fillStyle = '#f2f0ea'; g.fillRect(x, y, w, h); for (let k = -2; k < 12; k++) { g.fillStyle = '#e2661a'; g.beginPath(); g.moveTo(x + k * 28, y + 22); g.lineTo(x + k * 28 + 14, y + 22); g.lineTo(x + k * 28 + 28, y); g.lineTo(x + k * 28 + 14, y); g.fill(); g.beginPath(); g.moveTo(x + k * 28, y + h); g.lineTo(x + k * 28 + 14, y + h); g.lineTo(x + k * 28 + 28, y + h - 22); g.lineTo(x + k * 28 + 14, y + h - 22); g.fill(); } txt('ROAD CLOSED', x + w / 2, y + h / 2 + 2, 40, '#111', FONT, 'center', w - 20);
    [x, y, w, h] = A.detour; g.fillStyle = '#e8781c'; g.fillRect(x, y, w, h); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(x + 5, y + 5, w - 10, h - 10); txt('DETOUR', x + w / 2 - 20, y + h / 2 + 2, 52, '#111'); g.fillStyle = '#111'; g.beginPath(); g.moveTo(x + w - 46, y + 28); g.lineTo(x + w - 18, y + h / 2); g.lineTo(x + w - 46, y + h - 28); g.fill(); }
  { const [x, y, w, h] = A.plaque; g.fillStyle = '#2b2a28'; g.fillRect(x, y, w, h); g.strokeStyle = '#c9a646'; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, w - 12, h - 12); txt('MERIDIAN PLAZA', x + w / 2, y + 44, 30, '#c9a646'); txt('"ASCENT" · 2019', x + w / 2, y + 84, 18, '#bdb7a6', FONT2); }
  const t = canvasTex(c, { repeat: false, aniso: 8 });
  return t;
}

function textures(renderer) {
  if (TEX) return TEX;
  const aniso = renderer?.capabilities?.getMaxAnisotropy?.() || 8;
  const asph = asphaltTex(), side = sidewalkTex(), pav = paverTex(), tile = tileTex();
  for (const t of [asph.map, asph.normal, side.map, side.normal, pav.map, pav.normal]) t.anisotropy = aniso;
  TEX = { asph, side, pav, tile, leaf: leafTex(), marks: markingsTex(), atlas: propsAtlas(), aniso };
  TEX.marks.anisotropy = aniso;
  return TEX;
}
let MAT = null;
function materials(renderer) {
  if (MAT) return MAT;
  const T = textures(renderer);
  // emissive = faint warm bounce from the sunlit facades (keeps shadowed asphalt from going blue-black)
  const road = new THREE.MeshStandardMaterial({ emissiveMap: T.asph.map, emissive: new THREE.Color(0.13, 0.08, 0.035), map: T.asph.map, normalMap: T.asph.normal, roughnessMap: T.asph.rough, normalScale: new THREE.Vector2(0.35, 0.35), vertexColors: true, roughness: 1.0, metalness: 0, envMapIntensity: 0.55 });
  const marks = new THREE.MeshStandardMaterial({ map: T.marks, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.62, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMapIntensity: 0.5 });
  const side = new THREE.MeshStandardMaterial({ map: T.side.map, normalMap: T.side.normal, normalScale: new THREE.Vector2(0.6, 0.6), vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const plaza = new THREE.MeshStandardMaterial({ map: T.pav.map, normalMap: T.pav.normal, normalScale: new THREE.Vector2(0.6, 0.6), vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.8 });
  const props = rmMaterial(T.atlas, { envMapIntensity: 1.0 });
  const lens = rmMaterial(T.atlas, { envMapIntensity: 0.6 });
  lens.userData.duskEmissive = 2.6;
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4bf, metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.22, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide });
  const leaves = new THREE.MeshStandardMaterial({ map: T.leaf, vertexColors: true, alphaTest: 0.55, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMapIntensity: 0.25 });
  // canopy: global fresnel rim disabled; only a sun-side backlit translucency term
  leaves.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', THREE.ShaderChunk.lights_fragment_end.replace('reflectedLight.directSpecular += rimColor * fr', 'reflectedLight.directSpecular += 0.0 * rimColor * fr'));
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      { vec3 vd = normalize(vViewPosition); float back = pow(clamp(dot(-vd, rimSunDir), 0.0, 1.0), 6.0);
        outgoingLight += rimColor * vec3(0.35, 0.6, 0.12) * diffuseColor.rgb * back * 0.5; }
      #include <opaque_fragment>`);
  };
  leaves.customProgramCacheKey = () => 'streetLeaves';
  const pools = new THREE.MeshBasicMaterial({ map: T.marks, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, toneMapped: false });
  const tiles = new THREE.MeshStandardMaterial({ map: T.tile.map, normalMap: T.tile.normal, normalScale: new THREE.Vector2(0.5, 0.5), vertexColors: true, roughness: 0.3, metalness: 0, envMapIntensity: 0.9 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, depthWrite: false, fog: false });
  // wet asphalt: dark, glossy, cheap planar-ish reflection of the sky (gradient by reflected elevation + sun streak)
  const wet = new THREE.MeshStandardMaterial({ map: T.marks, color: 0x0b0b0c, roughness: 0.08, metalness: 0.0, transparent: true, depthWrite: false, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -5 });
  wet.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      {
        vec3 vd = normalize(vViewPosition);
        vec3 rv = reflect(-vd, normal);
        vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float ry = max(dot(rv, upV), 0.0);
        vec3 hor = rimColor * 0.7 + vec3(0.1, 0.08, 0.08);
        vec3 sky = mix(hor, vec3(0.12, 0.2, 0.4), smoothstep(0.03, 0.5, ry));
        float sd = max(dot(rv, rimSunDir), 0.0);
        sky += rimColor * (pow(sd, 400.0) * 8.0 + pow(sd, 30.0) * 0.6);
        float fr = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 5.0);
        outgoingLight = outgoingLight * 0.6 + sky * mix(0.25, 1.0, fr);
      }
      #include <opaque_fragment>`);
  };
  wet.customProgramCacheKey = () => 'streetWet';
  MAT = { road, marks, side, plaza, props, lens, glass, leaves, pools, tiles, dark, wet };
  return MAT;
}

// ---------------------------------------------------------------------- road + sidewalks + plaza
const inSubway = (x, z, pad = 0) => x > SUBWAY.x0 - 0.2 - pad && x < SUBWAY.x1 + 0.2 + pad && z > SUBWAY.zTop - 1 - pad && z < SUBWAY.zEnd + 1 + pad;
function surfaces(B, rng) {
  const n1 = makeNoise(2101, 64), n2 = makeNoise(2102, 16);
  const macro = (x, z, k = 0.16) => 1 + (fbm(n1, x / 300 + 10, z / 300 + 10, 4, 4) - 0.5) * k * 2 + (n2(x / 9, z / 9) - 0.5) * k * 0.6;
  // ---- road: avenue + intersection (one grid), cross street arms
  const T6 = 6;
  const uvRoad = (x, z) => [x / T6, -z / T6];
  const laneWear = (x) => { // darker tyre paths, lighter oil-drip lane centres, dusty gutters
    const ax = Math.abs(x); let k = 0;
    for (const c of [1.85, 5.55]) { const d1 = Math.abs(ax - c + 0.85), d2 = Math.abs(ax - c - 0.85); k += 0.13 * (Math.exp(-d1 * d1 / 0.18) + Math.exp(-d2 * d2 / 0.18)); k -= 0.09 * Math.exp(-((ax - c) ** 2) / 0.06); }   // polished lighter wheel paths, oily lane centres
    k += 0.12 * Math.max(0, (ax - 9.6) / 1.4);
    return k;
  };
  const warm = (x, z) => (fbm(n1, x / 120 + 3, z / 120 + 7, 3, 3) - 0.5) * 0.5;
  const colRoad = (x, z) => { const m = macro(x, z, 0.24) + laneWear(x), w = warm(x, z); return [(1.12 + w * 0.5) * m, (0.98 + w * 0.2) * m, (0.8 - w * 0.2) * m]; };   // golden-hour warm albedo
  const xs = merged(range(-11, 11, 1.0), [-10.6, -9.9, 9.9, 10.6, -6.4, -4.7, -2.7, -1.0, 1.0, 2.7, 4.7, 6.4, -6.9, -5.9, -4.2, -3.2, -2.2, -1.5, 1.5, 2.2, 3.2, 4.2, 5.9, 6.9]);
  groundXZ(B.road, xs, range(-156, 150, 3), 0, uvRoad, colRoad, RM.concrete);
  const colX = (x, z) => { const az = Math.abs(z + 53); const m = macro(x, z, 0.24) + 0.1 * Math.exp(-((az - 2.6) ** 2) / 0.3) + 0.12 * Math.max(0, (az - 3.6) / 1.4), w = warm(x, z); return [(1.12 + w * 0.5) * m, (0.98 + w * 0.2) * m, (0.8 - w * 0.2) * m]; };
  for (const s of [-1, 1]) {
    const xx = s > 0 ? merged(range(11, 40, 2), range(40, 220, 12)) : merged(range(-220, -40, 12), range(-40, -11, 2));
    groundXZ(B.road, xx, merged(range(CROSS.road0, CROSS.road1, 1.25), [-57.6, -48.4]), 0, uvRoad, colX, RM.concrete);
  }
  // ---- sidewalks (inset 0.15 from the curb line: the curb stones cover the edge)
  const uvSide = (o) => (x, z) => [(x - o[0]) / 6, -(z - o[1]) / 6];
  const facadeGrime = (d) => 1 - 0.18 * Math.exp(-d * 2.2);   // d = distance to the building line
  const colSide = (x, z) => {
    const m = macro(x, z, 0.1);
    let d = 99;
    if (z > CROSS.z1 || z < CROSS.z0) d = Math.min(d, AVE.half - Math.abs(x));
    if (z <= CROSS.z1 && z >= CROSS.z0 && Math.abs(x) > AVE.curb) d = Math.min(Math.abs(z - CROSS.z1), Math.abs(z - CROSS.z0));
    const g = facadeGrime(Math.max(0, d)) * m;
    return [0.98 * g, 0.96 * g, 0.93 * g];
  };
  const rect = (x0, z0, x1, z1, o) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) ground(B.side, x0, z0, x1, z1, SW, [2.2, 2.2], uvSide(o), colSide); };
  const c = AVE.curb + 0.15, hf = AVE.half + 0.3;
  for (const s of [-1, 1]) {
    const X0 = s > 0 ? c : -hf, X1 = s > 0 ? hf : -c, o = [s * AVE.curb, 0];
    // block 1 (with the subway hole on the right)
    if (s > 0) {
      rect(X0, SUBWAY.zEnd, X1, AVE.back, o);
      rect(X0, CROSS.z1, X1, SUBWAY.zTop, o);
      rect(X0, SUBWAY.zTop, SUBWAY.x0, SUBWAY.zEnd, o);
      rect(SUBWAY.x1, SUBWAY.zTop, X1, SUBWAY.zEnd, o);
    } else rect(X0, CROSS.z1, X1, AVE.back, o);
    rect(X0, PLAZA.z1, X1, CROSS.z0, o);                   // block 2
    // cross street sidewalks (north z∈[-48,-44], south z∈[-62,-58])
    const cx0 = s > 0 ? c : -XR, cx1 = s > 0 ? XR : -c;
    rect(cx0, CROSS.road1 + 0.15, cx1, CROSS.z1, [s * AVE.curb, CROSS.road1]);
    rect(cx0, CROSS.z0, cx1, CROSS.road0 - 0.15, [s * AVE.curb, CROSS.road0]);
    // gutter pans
    const gut = (x0, z0, x1, z1) => ground(B.side, x0, z0, x1, z1, 0.004, [1, 3], uvSide([0, 0]), (x, z) => { const m = macro(x, z, 0.1) * 0.78; return [m, m * 0.97, m * 0.93]; });
    const gx0 = s > 0 ? AVE.curb - 0.42 : -AVE.curb, gx1 = s > 0 ? AVE.curb : -AVE.curb + 0.42;
    gut(gx0, CROSS.road1, gx1, AVE.back); gut(gx0, PLAZA.z1 - 6, gx1, CROSS.road0);
    gut(cx0, CROSS.road1 - 0.42, cx1, CROSS.road1); gut(cx0, CROSS.road0, cx1, CROSS.road0 + 0.42);
  }
  // ---- plaza (pavers): z ∈ [-172, -150], x ∈ ±(46+) except the road end (|x| < 11, z > -156)
  const uvP = (x, z) => [x / 3.6, -z / 3.6];
  const colP = (x, z) => { const m = macro(x, z, 0.08); return [m, m, m]; };
  ground(B.plaza, -PLAZA.half - 2, PLAZA.z0 - 4, PLAZA.half + 2, PLAZA.z1 - 6.15, SW, [3, 3], uvP, colP);
  for (const s of [-1, 1]) ground(B.plaza, s > 0 ? c : -PLAZA.half - 2, PLAZA.z1 - 6.15, s > 0 ? PLAZA.half + 2 : -c, PLAZA.z1, SW, [3, 3], uvP, colP);
}

// curb stones along a line (road on the -n side). Profile: battered face, rounded arris, flat top.
const CURB_PROF = [[-0.012, 0], [-0.004, 0.112], [0.002, 0.135], [0.016, 0.149], [0.04, 0.153], [0.16, 0.153]];
function curbRun(bk, ax, az, bx, bz, nx, nz, rng, stone = 1.8) {
  const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, n = Math.max(1, Math.round(L / stone)), sl = L / n;
  const uv = rUV(A.granite);
  for (let k = 0; k < n; k++) {
    const t0 = k * sl + 0.004, t1 = (k + 1) * sl - 0.004, tone = 0.86 + rng() * 0.24, col = [COL.granite[0] * tone, COL.granite[1] * tone, COL.granite[2] * tone * 0.98];
    const dirt = [col[0] * 0.55, col[1] * 0.52, col[2] * 0.5];
    const P = (t, d, y) => [ax + dx * t + nx * d, y, az + dz * t + nz * d];
    for (let j = 0; j < CURB_PROF.length - 1; j++) {
      const [d0, y0] = CURB_PROF[j], [d1, y1] = CURB_PROF[j + 1];
      const ex = d1 - d0, ey = y1 - y0, l = Math.hypot(ex, ey);
      const N = [nx * (-ey / l) * -1, ex / l, nz * (-ey / l) * -1];   // outward normal in the profile plane
      const nn = [-nx * ey / l, ex / l, -nz * ey / l];
      const ca = j < 2 ? dirt : col, cb = j < 1 ? dirt : col;
      const u0 = uv[0] + (uv[2] - uv[0]) * (k % 2 ? 0 : 0.5), u1 = u0 + (uv[2] - uv[0]) * 0.5;
      const v0 = uv[1] + (uv[3] - uv[1]) * j / 5, v1 = uv[1] + (uv[3] - uv[1]) * (j + 1) / 5;
      const A0 = P(t0, d0, y0), B0 = P(t1, d0, y0), C0 = P(t1, d1, y1), D0 = P(t0, d1, y1);
      void N;
      bk.tri(A0, B0, C0, nn, nn, nn, [u0, v0], [u1, v0], [u1, v1], [...ca, ...ca, ...cb], RM.stone);
      bk.tri(A0, C0, D0, nn, nn, nn, [u0, v0], [u1, v1], [u0, v1], [...ca, ...cb, ...cb], RM.stone);
    }
  }
}
function curbs(B, rng) {
  const c = AVE.curb;
  for (const s of [-1, 1]) {
    // avenue (road at |x| < 11): normal toward the sidewalk = +s x
    curbRun(B.props, s * c, CROSS.road1, s * c, AVE.back, s, 0, rng);
    curbRun(B.props, s * c, PLAZA.z1 - 6, s * c, CROSS.road0, s, 0, rng);
    // cross street: north curb at z = -48 (sidewalk toward +z), south at z = -58 (toward -z)
    curbRun(B.props, s * c, CROSS.road1, s * XR, CROSS.road1, 0, 1, rng, 2.4);
    curbRun(B.props, s * c, CROSS.road0, s * XR, CROSS.road0, 0, -1, rng, 2.4);
  }
  curbRun(B.props, -c, PLAZA.z1 - 6, c, PLAZA.z1 - 6, 0, -1, rng);
}

// ---------------------------------------------------------------------- markings + road decals
function decal(bk, x, z, w, l, rot, rect, col, y = 0.006, uvrot = false) {
  // quad on the ground: w across (local x), l along (local z, toward -z when rot = 0)
  const c = Math.cos(rot), s = Math.sin(rot), r = rUV(rect, 1024);
  const P = (a, b) => [x + a * c + b * s, y, z - a * s + b * c];
  const up = [0, 1, 0];
  const p0 = P(-w / 2, l / 2), p1 = P(w / 2, l / 2), p2 = P(w / 2, -l / 2), p3 = P(-w / 2, -l / 2);
  const uv = uvrot ? [[r[0], r[1]], [r[0], r[3]], [r[2], r[3]], [r[2], r[1]]] : [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
  bk.tri(p0, p1, p2, up, up, up, uv[0], uv[1], uv[2], col, [0.7, 0, 0]);
  bk.tri(p0, p2, p3, up, up, up, uv[0], uv[2], uv[3], col, [0.7, 0, 0]);
}
// painted line from (x0,z0) to (x1,z1), width w, split into ≤3 m strips of the worn-paint texture
function paintLine(bk, x0, z0, x1, z1, w, col, rng) {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 3)), rot = Math.atan2(x1 - x0, -(z1 - z0));
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    decal(bk, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, w, L / n, rot, rng() < 0.5 ? MK.line : MK.line2, col, 0.006, true);
  }
}
const WHITE_P = [0.95, 0.94, 0.9], YELLOW_P = lin(0xe8b420).map((v) => Math.min(1, v * 1.25));
function markings(B, rng, anchors) {
  const bk = B.marks;
  const zN = CROSS.z1, zS = CROSS.z0;
  // centre double yellow + lane dashes + parking-lane edge lines, both blocks
  for (const [za, zb] of [[zN + 0.6, AVE.back], [PLAZA.z1 - 5.5, zS - 0.6]]) {
    for (const x of [-0.13, 0.13]) paintLine(bk, x, zb, x, za, 0.11, YELLOW_P, rng);
    for (const s of [-1, 1]) {
      paintLine(bk, s * 7.4, zb, s * 7.4, za, 0.13, WHITE_P, rng);
      for (let z = zb - 2; z > za + 3; z -= 12) decal(bk, s * 3.7, z - 1.5, 0.13, 3, 0, rng() < 0.5 ? MK.line : MK.line2, WHITE_P, 0.006, true);
    }
  }
  // sealed construction joints: along each lane line + transverse every ~15 m
  for (const [za, zb] of [[CROSS.z1 + 0.5, AVE.back], [PLAZA.z1 - 5.5, CROSS.z0 - 0.5]]) {
    for (const x of [-9.9, -3.75, 3.75, 9.9]) for (let z = zb; z > za + 6; z -= 6) decal(bk, x + 0.18 + (rng() - 0.5) * 0.06, z - 3, 0.22, 6, (rng() - 0.5) * 0.01, MK.tar, [1, 1, 1], 0.0053, true);
    for (let z = zb - 7; z > za + 4; z -= 13 + rng() * 6) for (const s of [-1, 1]) decal(bk, s * 5.4, z, 0.26, 10.6, Math.PI / 2 + (rng() - 0.5) * 0.04, MK.tar, [1, 1, 1], 0.0053, true);
  }
  // stop bars + crosswalks (continental) at the intersection and the plaza
  const xwalkAcross = (zc, depth) => { for (let x = -10.2; x <= 10.2; x += 1.2) decal(bk, x, zc, 0.6, depth, 0, rng() < 0.5 ? MK.line : MK.line2, WHITE_P, 0.006, true); };
  xwalkAcross((zN + CROSS.road1) / 2, 3.0); xwalkAcross((zS + CROSS.road0) / 2, 3.0);
  xwalkAcross(PLAZA.z1 - 3.0, 3.0);
  paintLine(bk, 0.4, zN + 0.9, 10.6, zN + 0.9, 0.45, WHITE_P, rng);           // stop bar, -z traffic (x > 0)
  paintLine(bk, -10.6, zS - 0.9, -0.4, zS - 0.9, 0.45, WHITE_P, rng);         // stop bar, +z traffic (x < 0)
  paintLine(bk, 0.4, PLAZA.z1 + 0.6, 10.6, PLAZA.z1 + 0.6, 0.45, WHITE_P, rng);
  for (const s of [-1, 1]) {   // cross street: crosswalks along the avenue sidewalks, centre line, stop bars
    for (let z = CROSS.road0 + 0.4; z < CROSS.road1 - 0.3; z += 1.2) decal(bk, s * 13.5, z + 0.3, 3.0, 0.6, Math.PI / 2, rng() < 0.5 ? MK.line : MK.line2, WHITE_P, 0.006, true);
    for (const dz of [-0.13, 0.13]) paintLine(bk, s * 16.5, -53 + dz, s * XR, -53 + dz, 0.11, YELLOW_P, rng);
    paintLine(bk, s * 16.0, s > 0 ? -52.6 : -53.4, s * 16.0, s > 0 ? CROSS.road1 - 0.3 : CROSS.road0 + 0.3, 0.45, WHITE_P, rng);
  }
  // lane arrows before the intersection + SLOW at the plaza
  for (const [x, z, rot] of [[1.85, -30, 0], [5.55, -32, 0], [-1.85, -72, Math.PI], [-5.55, -74, Math.PI]]) decal(bk, x, z, 1.0, 4.2, rot, MK.arrow, WHITE_P);
  decal(bk, 4.6, PLAZA.z1 + 8, 4.0, 1.4, 0, MK.xing, WHITE_P);
  decal(bk, -4.6, PLAZA.z1 + 8, 4.0, 1.4, 0, MK.xing, WHITE_P);
  // manholes (anchors for steam), drains, patches, cracks, potholes, oil, skid marks, tar snakes, scorch
  const holes = [[-5.5, 31], [5.6, 6.5], [-1.9, -9], [-5.5, -22], [3.8, -38], [0.2, -53], [-3.6, -90], [5.5, -104], [-5.6, -128], [1.8, -142], [-30, -52], [34, -54]];
  for (const [x, z] of holes) { decal(bk, x, z, 0.78, 0.78, rng() * 6, MK.manhole, [1, 1, 1], 0.007); anchors.manholes.push(new THREE.Vector3(x, 0, z)); }
  const drains = [];
  for (const s of [-1, 1]) for (let z = 38 + s * 6; z > -150; z -= 30) { if (z < CROSS.z1 + 2 && z > CROSS.z0 - 2) continue; drains.push([s * (AVE.curb - 0.25), z, 0]); }
  for (const s of [-1, 1]) for (const x of [s * 24, s * 52]) { drains.push([x, CROSS.road1 - 0.25, Math.PI / 2]); drains.push([x + s * 8, CROSS.road0 + 0.25, Math.PI / 2]); }
  for (const [x, z, rot] of drains) {
    decal(bk, x, z, 0.46, 0.92, rot, MK.drain, [1, 1, 1], 0.007, true);
    anchors.drains.push(new THREE.Vector3(x, 0, z));
    // curb inlet slot (dark opening in the curb face)
    const side = rot ? (z > -53 ? 1 : -1) : Math.sign(x);
    if (!rot) addGeo(B.props, BOX(0.02, 0.07, 0.95), M4(Math.sign(x) * (AVE.curb - 0.006), 0.05, z), COL.dark, RM.rubber);
    else addGeo(B.props, BOX(0.95, 0.07, 0.02), M4(x, 0.05, z > -53 ? CROSS.road1 - 0.006 : CROSS.road0 + 0.006), COL.dark, RM.rubber);
    void side;
  }
  const scatter = (count, fn) => { for (let k = 0; k < count; k++) { const z = 140 - rng() * 296, x = (rng() - 0.5) * 20; fn(x, z); } };
  scatter(22, (x, z) => decal(bk, x, z, 2 + rng() * 3, 2 + rng() * 5, (rng() - 0.5) * 0.1, MK.patch, [1, 1, 1], 0.005));
  scatter(20, (x, z) => decal(bk, x, z, 1.6 + rng() * 3, 1.8 + rng() * 4, (rng() - 0.5) * 0.08, MK.patchL, [1, 1, 1], 0.0049));
  scatter(22, (x, z) => { const lane = [-5.55, -1.85, 1.85, 5.55][(rng() * 4) | 0]; decal(bk, lane + (rng() - 0.5) * 0.6, z, 1.8, 4 + rng() * 8, (rng() - 0.5) * 0.12, MK.tyre, [1, 1, 1], 0.0064, true); });
  scatter(16, (x, z) => decal(bk, x, z, 2 + rng() * 2.5, 2 + rng() * 2.5, rng() * 6, MK.cracks, [1, 1, 1], 0.0055));
  scatter(70, (x, z) => { const lane = [-5.55, -1.85, 1.85, 5.55][(rng() * 4) | 0]; decal(bk, lane + (rng() - 0.5) * 0.4, z, 1 + rng() * 1.4, 1 + rng() * 2.4, rng() * 0.4, MK.oil[(rng() * 4) | 0], [1, 1, 1], 0.0058); });
  scatter(7, (x, z) => decal(bk, x, z, 0.7 + rng() * 0.6, 0.6 + rng() * 0.5, rng() * 6, MK.pothole, [1, 1, 1], 0.0062));
  scatter(10, (x, z) => decal(bk, x, z, 0.35, 4 + rng() * 5, (rng() - 0.5) * 0.6, MK.tar, [1, 1, 1], 0.0052, true));
  // skid marks: arcs of 4 segments, two pairs
  for (let k = 0; k < 9; k++) {
    let x = (rng() - 0.5) * 16, z = 120 - rng() * 260, a = (rng() - 0.5) * 0.6; const da = (rng() - 0.5) * 0.35;
    for (let s = 0; s < 5; s++) { const l = 2.2; decal(bk, x, z, 1.8, l, a, MK.skid, [1, 1, 1], 0.0065, true); x += Math.sin(a) * l * -1 * -1; z -= Math.cos(a) * l; a += da; }
  }
  // wet patches / puddles: along the gutters (hydrant runoff, broken mains) + a few low spots
  const wets = [[10.1, 37], [-10.2, 18], [10.0, 2], [-9.9, -16], [9.6, -36], [-10.1, -64], [10.2, -82], [-9.8, -108], [10.0, -131], [-2.2, -45.5], [-24, -48.8], [30, -57.4], [6.4, 24], [-5.2, -98], [3.4, -128]];
  for (const [x, z] of wets) decal(anchors._wet, x, z, 1.4 + rng() * 1.6, 2.5 + rng() * 4, Math.abs(x) > 9 ? 0 : rng() * 3, MK.puddle, [1, 1, 1], 0.0075, true);
  // scorch marks from earlier chaos
  for (const [x, z] of [[4.5, 41], [-6, -12], [2, -47], [-15, -55], [6.5, -118]]) decal(bk, x, z, 5 + rng() * 2, 5 + rng() * 2, rng() * 6, MK.scorch, [1, 1, 1], 0.0068);
}

// ---------------------------------------------------------------------- street furniture
function streetlight(B, x, z, s, glows, colliders) {
  // s: +1 right curb (arm toward -x), -1 left curb (arm toward +x)
  const P = B.props, ax = -s;
  addGeo(P, CYL(0.2, 0.22, 0.5, 8), M4(x, SW + 0.25, z), COL.pole, RM.metal);
  addGeo(P, CYL(0.23, 0.23, 0.06, 8), M4(x, SW + 0.5, z), COL.pole, RM.metal);
  addGeo(P, CYL(0.075, 0.13, 8.4, 8), M4(x, SW + 4.7, z), COL.pole, RM.metal);
  // arm: two straight pieces rising slightly, lamp head at the tip
  const y0 = 8.75, L = 2.8;
  addGeo(P, CYL(0.05, 0.06, L, 6), M4(x + ax * L / 2, y0 + 0.12, z, 0, 0, ax * (Math.PI / 2 - 0.08)), COL.pole, RM.metal);
  addGeo(P, CYL(0.022, 0.022, 1.3, 5), M4(x + ax * 0.55, y0 - 0.15, z, 0, 0, ax * 1.0), COL.pole, RM.metal);   // brace
  addGeo(P, CYL(0.09, 0.07, 0.25, 8), M4(x, y0 + 0.05, z), COL.pole, RM.metal);
  const hx = x + ax * (L + 0.25), hy = y0 + 0.2;
  const head = new THREE.BoxGeometry(0.95, 0.12, 0.38); head.translate(0, 0, 0);
  addGeo(P, head, M4(hx, hy, z, 0, 0, ax * 0.05), COL.pole, RM.metal);
  addGeo(P, BOX(0.85, 0.05, 0.3), M4(hx, hy + 0.08, z, 0, 0, ax * 0.05), [0.12, 0.125, 0.13], RM.metal);
  addGeo(B.lens, BOX(0.78, 0.02, 0.28), M4(hx, hy - 0.065, z, 0, 0, ax * 0.05), [1.0, 0.86, 0.68], RM.glow);
  // banner bracket + small sign
  addGeo(P, BOX(0.02, 1.2, 0.5), M4(x + ax * 0.32, 5.4, z), [0.55, 0.12, 0.08], RM.paint);
  addGeo(P, CYL(0.012, 0.012, 0.45, 4), M4(x + ax * 0.17, 6.02, z, 0, 0, Math.PI / 2), COL.pole, RM.metal);
  glows.push({ p: [hx, hy - 0.1, z], color: [2.6, 1.9, 1.2], size: 1.7, dusk: true });
  B.poolList.push([hx, z, 7.5]);
  colliders.push({ min: [x - 0.2, 0, z - 0.2], max: [x + 0.2, 9, z + 0.2], data: { kind: 'prop', mat: 'metal', thin: true } });
}
function signalMast(B, x, z, dir, faceRot, glows, colliders, signName, rng) {
  // pole at (x,z); arm along dir [dx,dz] over the road; heads face faceRot (yaw, 0 = facing +z)
  const P = B.props, y = SW;
  addGeo(P, CYL(0.17, 0.2, 0.6, 8), M4(x, y + 0.3, z), [0.25, 0.25, 0.24], RM.metal);
  addGeo(P, CYL(0.11, 0.15, 7.0, 10), M4(x, y + 3.5, z), [0.42, 0.43, 0.42], RM.alu);
  const L = 7.4, ang = Math.atan2(dir[0], dir[1]);
  const mid = [x + dir[0] * L / 2, 6.55, z + dir[1] * L / 2];
  const arm = CYL(0.06, 0.1, L, 8); arm.rotateX(Math.PI / 2);
  addGeo(P, arm, M4(mid[0], mid[1], mid[2], 0.035, ang, 0), [0.42, 0.43, 0.42], RM.alu);
  addGeo(P, CYL(0.03, 0.03, 2.6, 5).rotateX(Math.PI / 2 - 0.5), M4(x + dir[0] * 1.15, 6.05, z + dir[1] * 1.15, 0, ang, 0), [0.42, 0.43, 0.42], RM.alu);
  // street sign on the arm
  const sn = [x + dir[0] * 1.9, 6.95, z + dir[1] * 1.9];
  const right = [Math.cos(ang) * 1, 0, -Math.sin(ang)];   // horizontal axis perpendicular to... use arm direction
  const along = [dir[0], 0, dir[1]];
  const nrm = [dir[1], 0, -dir[0]];
  addGeo(P, BOX(1.42, 0.38, 0.03), new THREE.Matrix4().makeBasis(new THREE.Vector3(...along), new THREE.Vector3(0, 1, 0), new THREE.Vector3(...nrm)).setPosition(...sn), [0.06, 0.25, 0.12], RM.paint);
  for (const sg of [1, -1]) quad(P, [sn[0] + nrm[0] * 0.017 * sg, sn[1], sn[2] + nrm[2] * 0.017 * sg], sg > 0 ? along : along.map((v) => -v), [0, 1, 0], 1.4, 0.35, signName);
  void right;
  // two signal heads hanging from the arm + one on the pole
  const fr = faceRot, fx = Math.sin(fr), fz = Math.cos(fr);
  const heads = [[x + dir[0] * 4.0, 6.05, z + dir[1] * 4.0], [x + dir[0] * 6.8, 6.05, z + dir[1] * 6.8], [x + fx * 0.25, 3.6, z + fz * 0.25]];
  for (const [hx, hy, hz] of heads) {
    const m = M4(hx, hy, hz, 0, fr, 0);
    addGeo(P, BOX(0.36, 1.04, 0.26), m, [0.12, 0.11, 0.035], RM.paint);
    addGeo(P, BOX(0.56, 1.24, 0.03), m.clone().multiply(M4(0, 0, -0.14)), COL.dark, RM.plastic);      // backplate
    [[0.33, [0.25, 0.02, 0.01]], [0, [1.0, 0.55, 0.05]], [-0.33, [0.02, 0.2, 0.1]]].forEach(([dy, col], k) => {
      const lensM = m.clone().multiply(M4(0, dy, 0.135, Math.PI / 2, 0, 0));
      addGeo(k === 1 ? B.lens : P, CYL(0.11, 0.11, 0.02, 12), lensM, col, k === 1 ? [0.2, 0, 1.2] : [0.15, 0.1, 0.15]);
      const vis = new THREE.CylinderGeometry(0.135, 0.135, 0.22, 10, 1, true, -Math.PI / 2, Math.PI); vis.rotateX(Math.PI / 2);
      addGeo(P, vis, m.clone().multiply(M4(0, dy, 0.24)), [0.1, 0.095, 0.03], RM.paint);
      if (k === 1) glows.push({ p: [hx + fx * 0.17, hy + dy, hz + fz * 0.17], color: [3.2, 1.6, 0.25], size: 0.8, blink: true, rate: 3.6 });
    });
  }
  // pedestrian head + push button
  const pm = M4(x - fx * 0.2 + dir[0] * -0.2, 2.6, z - fz * 0.2 + dir[1] * -0.2, 0, fr + Math.PI / 2, 0);
  addGeo(P, BOX(0.32, 0.32, 0.2), pm, [0.12, 0.11, 0.035], RM.paint);
  addGeo(B.lens, BOX(0.24, 0.24, 0.01), pm.clone().multiply(M4(0, 0, 0.101)), [1.0, 0.35, 0.05], [0.3, 0, 0.6]);
  addGeo(P, BOX(0.1, 0.16, 0.06), M4(x + fx * 0.15, 1.15, z + fz * 0.15, 0, fr, 0), [0.75, 0.6, 0.12], RM.paint);
  { // traffic controller cabinet on a concrete plinth (door faces the sidewalk)
    const cx = x - fx * 0.55, cz = z - fz * 0.55, cm = M4(cx, SW, cz, 0, fr + Math.PI, 0), green = [0.16, 0.2, 0.15];
    addGeo(P, BOX(0.78, 0.14, 0.56), cm.clone().multiply(M4(0, 0.07, 0)), [0.42, 0.41, 0.39], RM.concrete);
    addGeo(P, BOX(0.66, 1.18, 0.44), cm.clone().multiply(M4(0, 0.14 + 0.59, 0)), green, RM.paint);
    addGeo(P, BOX(0.72, 0.05, 0.5), cm.clone().multiply(M4(0, 1.345, 0)), green.map((v) => v * 0.8), RM.paint);
    const door = cm.clone().multiply(M4(0, 0.73, 0.222));
    addGeo(P, BOX(0.58, 1.08, 0.012), door, green.map((v) => v * 1.1), RM.paint);
    addGeo(P, BOX(0.004, 1.08, 0.016), door.clone().multiply(M4(0.29, 0, 0)), COL.dark, RM.rubber);
    for (let k = 0; k < 6; k++) addGeo(P, BOX(0.36, 0.018, 0.02), door.clone().multiply(M4(0, -0.42 + k * 0.035, 0.008, -0.5, 0, 0)), COL.dark, RM.metal);
    addGeo(P, BOX(0.03, 0.14, 0.03), door.clone().multiply(M4(0.24, 0.05, 0.01)), [0.55, 0.55, 0.55], RM.chrome);
    addGeo(P, new THREE.PlaneGeometry(0.2, 0.26), door.clone().multiply(M4(-0.12, 0.25, 0.008)), COL.white, [0.5, 0, 0.05], A.news[1]);
    addGeo(P, new THREE.PlaneGeometry(0.42, 0.06), door.clone().multiply(M4(0, 0.47, 0.008)), [0.9, 0.75, 0.15], RM.paint);
    colliders.push({ min: [cx - 0.42, 0, cz - 0.42], max: [cx + 0.42, SW + 1.37, cz + 0.42], data: { kind: 'prop', mat: 'metal' } });
  }
  colliders.push({ min: [x - 0.2, 0, z - 0.2], max: [x + 0.2, 7, z + 0.2], data: { kind: 'prop', mat: 'metal', thin: true } });
}
function hydrant(B, x, z, rot, colliders) {
  const P = B.props, red = [0.42, 0.04, 0.03], chrome = [0.62, 0.62, 0.6];
  const m = M4(x, SW, z, 0, rot, 0);
  const lath = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.16, 0.06], [0.12, 0.08], [0.12, 0.5], [0.14, 0.52], [0.14, 0.56], [0.11, 0.6], [0.09, 0.68], [0.04, 0.72], [0.02, 0.76], [0, 0.77]].map(([a, b]) => new THREE.Vector2(a, b)), 12);
  addGeo(P, lath, m, red, RM.paint);
  for (const s of [-1, 1]) addGeo(P, CYL(0.05, 0.05, 0.14, 8).rotateZ(Math.PI / 2), m.clone().multiply(M4(s * 0.16, 0.42, 0)), chrome, RM.metal);
  addGeo(P, CYL(0.075, 0.075, 0.12, 8).rotateX(Math.PI / 2), m.clone().multiply(M4(0, 0.4, 0.16)), chrome, RM.metal);
  addGeo(P, CYL(0.03, 0.03, 0.05, 5), m.clone().multiply(M4(0, 0.78, 0)), chrome, RM.metal);
  colliders.push({ min: [x - 0.2, 0, z - 0.2], max: [x + 0.2, 0.95, z + 0.2], data: { kind: 'prop', mat: 'metal' } });
}
function newsBoxes(B, x, z, rot, rng, colliders) {
  const P = B.props, cols = [lin(0x1d3e7a), lin(0xa3161a), lin(0x18603a)];
  const order = [0, 1, 2].sort(() => rng() - 0.5);
  order.forEach((k, i) => {
    const m = M4(x, SW, z, 0, rot, 0).multiply(M4((i - 1) * 0.5, 0, 0, 0, (rng() - 0.5) * 0.12, 0));
    addGeo(P, BOX(0.44, 0.62, 0.4), m.clone().multiply(M4(0, 0.6 + 0.31, 0)), cols[k], RM.paint);
    addGeo(P, BOX(0.46, 0.04, 0.42), m.clone().multiply(M4(0, 1.24, 0)), cols[k].map((v) => v * 0.7), RM.paint);
    for (const s of [-1, 1]) for (const t of [-1, 1]) addGeo(P, BOX(0.03, 0.6, 0.03), m.clone().multiply(M4(s * 0.19, 0.3, t * 0.17)), COL.dark, RM.metal);
    const fm = m.clone().multiply(M4(0, 0.95, 0.202));
    const g = new THREE.PlaneGeometry(0.4, 0.44);
    addGeo(P, g, fm, COL.white, [0.35, 0, 0.05], A.news[k]);
  });
  const c = Math.cos(rot), s = Math.sin(rot), hx = Math.abs(c) * 0.8 + Math.abs(s) * 0.25, hz = Math.abs(s) * 0.8 + Math.abs(c) * 0.25;
  colliders.push({ min: [x - hx, 0, z - hz], max: [x + hx, 1.3, z + hz], data: { kind: 'prop', mat: 'metal' } });
}
function trashCan(B, x, z, rng, colliders) {
  const P = B.props, m = M4(x, SW, z, 0, rng() * 6, 0);
  const body = new THREE.CylinderGeometry(0.3, 0.27, 0.9, 12, 1, true);
  addGeo(P, body, m.clone().multiply(M4(0, 0.47, 0)), [0.12, 0.3, 0.16], RM.paint, A.bin);
  addGeo(P, CYL(0.27, 0.27, 0.02, 12), m.clone().multiply(M4(0, 0.05, 0)), COL.dark, RM.metal);
  addGeo(P, CYL(0.33, 0.31, 0.12, 12), m.clone().multiply(M4(0, 0.97, 0)), [0.08, 0.2, 0.1], RM.paint);
  addGeo(P, CYL(0.16, 0.2, 0.08, 10), m.clone().multiply(M4(0, 1.07, 0)), [0.08, 0.2, 0.1], RM.paint);
  if (rng() < 0.6) addGeo(P, new THREE.IcosahedronGeometry(0.16, 0), m.clone().multiply(M4(0.05, 1.12, 0.05)), [0.75, 0.73, 0.68], RM.plastic);   // overflowing trash
  colliders.push({ min: [x - 0.33, 0, z - 0.33], max: [x + 0.33, 1.15, z + 0.33], data: { kind: 'prop', mat: 'metal' } });
}
function bench(B, x, z, rot, colliders, hx = 0.95, hz = 0.35) {
  const P = B.props, m = M4(x, SW, z, 0, rot, 0), wood = [0.32, 0.18, 0.09];
  for (let k = 0; k < 3; k++) addGeo(P, BOX(1.8, 0.04, 0.11), m.clone().multiply(M4(0, 0.45, -0.15 + k * 0.13)), wood, RM.wood);
  for (let k = 0; k < 2; k++) addGeo(P, BOX(1.8, 0.1, 0.035), m.clone().multiply(M4(0, 0.62 + k * 0.14, 0.27, -0.2, 0, 0)), wood, RM.wood);
  for (const s of [-1, 1]) { addGeo(P, BOX(0.06, 0.45, 0.5), m.clone().multiply(M4(s * 0.8, 0.225, 0)), COL.pole, RM.metal); addGeo(P, BOX(0.05, 0.45, 0.05), m.clone().multiply(M4(s * 0.8, 0.7, 0.26, -0.2, 0, 0)), COL.pole, RM.metal); }
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  colliders.push({ min: [x - (hx * c + hz * s), 0, z - (hx * s + hz * c)], max: [x + (hx * c + hz * s), 0.9, z + (hx * s + hz * c)], data: { kind: 'prop', mat: 'wood' } });
}
function meter(B, x, z, colliders) {
  const P = B.props;
  addGeo(P, CYL(0.035, 0.04, 1.1, 6), M4(x, SW + 0.55, z), [0.25, 0.26, 0.27], RM.metal);
  addGeo(P, BOX(0.2, 0.3, 0.14), M4(x, SW + 1.25, z), [0.3, 0.31, 0.32], RM.metal);
  addGeo(P, CYL(0.1, 0.1, 0.14, 8, 1).rotateX(Math.PI / 2), M4(x, SW + 1.42, z), [0.3, 0.31, 0.32], RM.metal);
  for (const sz of [-1, 1]) quad(P, [x, SW + 1.27, z + sz * 0.072], [sz, 0, 0], [0, 1, 0], 0.14, 0.14, A.meter, COL.white, [0.3, 0, 0.1]);
  colliders.push({ min: [x - 0.12, 0, z - 0.1], max: [x + 0.12, 1.6, z + 0.1], data: { kind: 'prop', mat: 'metal', thin: true } });
}
function tree(B, x, z, rng, colliders, pit = true) {
  const P = B.props;
  if (pit) {
    addGeo(P, BOX(1.3, 0.02, 1.3), M4(x, SW + 0.002, z), COL.white, [0.6, 0.6, 0], A.grate);
    for (const [dx, dz, w, d] of [[0, -0.66, 1.34, 0.04], [0, 0.66, 1.34, 0.04], [-0.66, 0, 0.04, 1.34], [0.66, 0, 0.04, 1.34]]) addGeo(P, BOX(w, 0.03, d), M4(x + dx, SW + 0.012, z + dz), COL.iron, RM.iron);
    // low guard fence on three sides
    for (const [dx, dz, w, d] of [[0, -0.7, 1.4, 0.03], [0, 0.7, 1.4, 0.03], [0.7, 0, 0.03, 1.4]]) addGeo(P, BOX(w, 0.03, d), M4(x + dx * Math.sign(x || 1), SW + 0.45, z + dz), COL.green, RM.paint);
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) addGeo(P, BOX(0.03, 0.45, 0.03), M4(x + dx, SW + 0.225, z + dz), COL.green, RM.paint);
  }
  // trunk → 4-5 primaries → 2 secondaries each; a loose leaf cluster (4-5 small cards) at every branch tip, so the
  // canopy has gaps that show the branches. Olive, desaturated greens; per-tree hue; sunlit top, dark underside.
  const H = 2.4 + rng() * 0.6, bark = [0.13, 0.11, 0.09];
  const lean = [(rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12];
  const fork = [x + lean[0] * H, SW + H, z + lean[1] * H];
  const limb = (a, b, r0, r1) => {
    const A0 = new THREE.Vector3(...a), B0 = new THREE.Vector3(...b), L = A0.distanceTo(B0);
    const m = new THREE.Matrix4().lookAt(A0, B0, new THREE.Vector3(0, 1, 0.01)).setPosition(A0.clone().add(B0).multiplyScalar(0.5));
    addGeo(P, CYL(r1, r0, L, 6).rotateX(-Math.PI / 2), m, bark, RM.wood);
  };
  limb([x, SW, z], fork, 0.12, 0.085);
  const tips = [];
  const nP = 4 + (rng() < 0.5 ? 1 : 0), a0 = rng() * 6;
  for (let i = 0; i < nP; i++) {
    const a = a0 + i / nP * Math.PI * 2 + (rng() - 0.5) * 0.5, tilt = 0.45 + rng() * 0.35, l = 1.0 + rng() * 0.6;
    const p1 = [fork[0] + Math.sin(a) * Math.sin(tilt) * l, fork[1] + Math.cos(tilt) * l, fork[2] + Math.cos(a) * Math.sin(tilt) * l];
    limb(fork, p1, 0.06, 0.04); tips.push([p1, 0.85]);
    for (let j = 0; j < 2; j++) {
      const a2 = a + (j ? 0.6 : -0.6) + (rng() - 0.5) * 0.4, t2 = tilt + 0.25 + rng() * 0.3, l2 = 0.6 + rng() * 0.5;
      const p2 = [p1[0] + Math.sin(a2) * Math.sin(t2) * l2, p1[1] + Math.cos(t2) * l2, p1[2] + Math.cos(a2) * Math.sin(t2) * l2];
      limb(p1, p2, 0.035, 0.018); tips.push([p2, 1.0]);
    }
  }
  let yLo = 1e9, yHi = -1e9; for (const [t] of tips) { yLo = Math.min(yLo, t[1]); yHi = Math.max(yHi, t[1]); }
  yLo -= 0.6; yHi += 0.6;
  const cc = [fork[0], (yLo + yHi) / 2, fork[2]];
  const hueR = 0.85 + rng() * 0.25, hueG = 0.9 + rng() * 0.15, sunH = new THREE.Vector3(-0.42, 0, -1).normalize();
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const [t, k0] of tips) for (let k = 0; k < 6 + (rng() < 0.5 ? 1 : 0); k++) {
    const p = [t[0] + (rng() - 0.5) * 0.95 * k0, t[1] + (rng() - 0.35) * 0.7, t[2] + (rng() - 0.5) * 0.95 * k0];
    const out = new THREE.Vector3(p[0] - cc[0], (p[1] - cc[1]) * 0.6, p[2] - cc[2]).normalize();
    const ya = Math.atan2(out.x, out.z) + Math.PI / 2 + (rng() - 0.5) * 1.4, pa = (rng() - 0.5) * 1.1, sz = 0.85 + rng() * 0.5;
    const right = [Math.cos(ya), 0, -Math.sin(ya)], upv = [Math.sin(ya) * Math.sin(pa), Math.cos(pa), Math.cos(ya) * Math.sin(pa)];
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [p[0] + (right[0] * a + upv[0] * b) * sz / 2, p[1] + (right[1] * a + upv[1] * b) * sz / 2, p[2] + (right[2] * a + upv[2] * b) * sz / 2]);
    const nn = corners.map((q) => { const v = new THREE.Vector3(q[0] - cc[0], (q[1] - cc[1]) * 1.3 + 0.5, q[2] - cc[2]).normalize(); return [v.x, v.y, v.z]; });
    const sunSide = Math.max(0, out.dot(sunH)) * 0.18, v0 = 0.85 + rng() * 0.3;
    const cl = (i) => { const h = Math.min(1, Math.max(0, (corners[i][1] - yLo) / (yHi - yLo))), f = (0.42 + 0.78 * h * h + sunSide) * v0; return [hueR * f, hueG * f, 0.72 * f]; };
    B.leaves.tri(corners[0], corners[1], corners[2], nn[0], nn[1], nn[2], uvs[0], uvs[1], uvs[2], [...cl(0), ...cl(1), ...cl(2)], RM.wood);
    B.leaves.tri(corners[0], corners[2], corners[3], nn[0], nn[2], nn[3], uvs[0], uvs[2], uvs[3], [...cl(0), ...cl(2), ...cl(3)], RM.wood);
  }
  colliders.push({ min: [x - 0.15, 0, z - 0.15], max: [x + 0.15, 3, z + 0.15], data: { kind: 'prop', mat: 'wood', thin: true } });
}
function busShelter(B, x0, z0, z1, s, colliders) {
  // shelter on the s-side sidewalk, open toward the curb; back wall at x0 + s*1.5
  const P = B.props, xb = x0 + s * 1.5, zc = (z0 + z1) / 2, L = z1 - z0, alu = COL.alu;
  for (const z of [z0, zc, z1]) for (const x of [x0 + s * 0.1, xb]) addGeo(P, BOX(0.08, 2.5, 0.08), M4(x, SW + 1.25, z), alu, RM.alu);
  addGeo(P, BOX(1.75, 0.08, L + 0.3), M4(x0 + s * 0.78, SW + 2.55, zc, 0, 0, s * 0.04), [0.2, 0.21, 0.22], RM.metal);
  addGeo(P, BOX(1.7, 0.18, 0.06), M4(x0 + s * 0.78, SW + 2.42, z0 - 0.12), [0.06, 0.32, 0.38], RM.paint);
  quad(P, [x0 + s * 0.78, SW + 2.42, z0 - 0.152], [-1 * s, 0, 0].map((v) => v), [0, 1, 0], 1.0, 0.16, A.station, COL.white, RM.sign);
  for (const x of [x0 + s * 0.1, xb]) addGeo(P, BOX(0.06, 0.08, L), M4(x, SW + 2.46, zc), alu, RM.alu);
  addGeo(P, BOX(0.06, 0.06, L), M4(xb, SW + 0.12, zc), alu, RM.alu);
  // glass: back panel + end panel (z1 side)
  addGeo(B.glass, new THREE.PlaneGeometry(L - 0.1, 2.2).rotateY(Math.PI / 2), M4(xb, SW + 1.27, zc), COL.white, RM.water);
  addGeo(B.glass, new THREE.PlaneGeometry(1.35, 2.2), M4(x0 + s * 0.8, SW + 1.27, z1), COL.white, RM.water);
  // lit ad box at the z0 end (double-sided)
  addGeo(P, BOX(1.45, 2.0, 0.16), M4(x0 + s * 0.8, SW + 1.2, z0), [0.15, 0.16, 0.17], RM.metal);
  for (const sz of [-1, 1]) addGeo(B.lens, new THREE.PlaneGeometry(1.25, 1.85).rotateY(sz > 0 ? 0 : Math.PI), M4(x0 + s * 0.8, SW + 1.22, z0 + sz * 0.082), COL.white, [0.5, 0, 0.55], sz > 0 ? A.poster : A.ad2);
  // bench + map
  addGeo(P, BOX(0.4, 0.05, L * 0.6), M4(xb - s * 0.3, SW + 0.48, zc + 0.3), [0.55, 0.56, 0.57], RM.alu);
  for (const z of [zc - 0.5, zc + 1.1]) addGeo(P, BOX(0.3, 0.46, 0.05), M4(xb - s * 0.25, SW + 0.24, z), [0.4, 0.4, 0.4], RM.alu);
  colliders.push({ min: [Math.min(xb, xb) - 0.06, 0, z0 - 0.1], max: [Math.max(xb, xb) + 0.06, 2.6, z1 + 0.1], data: { kind: 'prop', mat: 'glass', thin: true } });
  colliders.push({ min: [Math.min(x0, xb) - 0.05, 0, z0 - 0.12], max: [Math.max(x0, xb) + 0.05, 2.3, z0 + 0.12], data: { kind: 'prop', mat: 'metal' } });
  colliders.push({ min: [Math.min(x0, xb) - 0.05, 0, z1 - 0.06], max: [Math.max(x0, xb) + 0.05, 2.3, z1 + 0.06], data: { kind: 'prop', mat: 'glass', thin: true } });
}
function sawhorse(B, x, z, rot, colliders) {
  const P = B.props, m = M4(x, streetGround(x, z), z, 0, rot, 0);
  for (const s of [-1, 1]) for (const t of [-1, 1]) addGeo(P, BOX(0.05, 1.05, 0.05), m.clone().multiply(M4(s * 0.9, 0.5, t * 0.16, t * 0.16, 0, 0)), [0.75, 0.6, 0.15], RM.paint);
  for (const sz of [-1, 1]) { const bm = m.clone().multiply(M4(0, 0.9, sz * 0.03)); addGeo(P, BOX(2.2, 0.26, 0.04), bm, COL.white, RM.paint, A.police); }
  addGeo(P, BOX(2.0, 0.1, 0.035), m.clone().multiply(M4(0, 0.45, 0)), [0.9, 0.9, 0.88], RM.paint);
  const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
  colliders.push({ min: [x - (1.1 * c + 0.25 * s), 0, z - (1.1 * s + 0.25 * c)], max: [x + (1.1 * c + 0.25 * s), 1.05, z + (1.1 * s + 0.25 * c)], data: { kind: 'prop', mat: 'wood' } });
}
function bollard(B, x, z, colliders) {
  addGeo(B.props, CYL(0.11, 0.12, 0.95, 10), M4(x, SW + 0.475, z), [0.22, 0.22, 0.23], RM.metal);
  addGeo(B.props, new THREE.SphereGeometry(0.11, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), M4(x, SW + 0.95, z), [0.6, 0.6, 0.6], RM.alu);
  addGeo(B.props, CYL(0.122, 0.122, 0.05, 10), M4(x, SW + 0.8, z), [0.9, 0.9, 0.85], [0.3, 0, 0.1]);
  colliders.push({ min: [x - 0.14, 0, z - 0.14], max: [x + 0.14, 1.1, z + 0.14], data: { kind: 'prop', mat: 'metal', thin: true } });
}
function planter(B, x, z, w, d, rng, colliders, withTree) {
  const P = B.props, h = 0.6;
  for (const [dx, dz, ww, dd] of [[0, -d / 2, w, 0.16], [0, d / 2, w, 0.16], [-w / 2, 0, 0.16, d], [w / 2, 0, 0.16, d]]) addStone(B.stone, BOX(ww, h, dd), M4(x + dx, SW + h / 2, z + dz), [0.55, 0.53, 0.5], 3);
  addGeo(P, BOX(w - 0.2, 0.04, d - 0.2), M4(x, SW + h - 0.12, z), [0.17, 0.12, 0.08], RM.concrete);
  for (let k = 0; k < 6; k++) addGeo(P, new THREE.IcosahedronGeometry(0.28 + rng() * 0.15, 0), M4(x + (rng() - 0.5) * (w - 0.6), SW + h - 0.02, z + (rng() - 0.5) * (d - 0.6), 0, rng() * 3, 0, 1, 0.6, 1), [0.12, 0.2, 0.07], RM.wood);
  if (withTree) tree(B, x, z, rng, [], false);
  colliders.push({ min: [x - w / 2, 0, z - d / 2], max: [x + w / 2, SW + h, z + d / 2], data: { kind: 'prop', mat: 'concrete' } });
}
function tactile(B, x, z, w, d) { quad(B.props, [x, SW + 0.004, z], [1, 0, 0], [0, 0, -1], w, d, A.tactile, COL.white, [0.5, 0, 0]); }

// street litter (visual only, merged into the props batch: 0 extra draws). Paper, safety/plate glass glitter,
// brick + concrete chunks, a few cones and fallen sign panels; concentrated in the gutters, along the curbs and
// at the foot of the facades (blown-out storefronts).
function litter(B, rng) {
  const P = B.props, up = [0, 1, 0];
  const blocked = (x, z) => (x > SUBWAY.x0 - 0.3 && x < SUBWAY.x1 + 0.3 && z > SUBWAY.zTop - 1.2 && z < SUBWAY.zEnd + 0.5) || Math.hypot(x, z + 162.5) < 4.8;
  const bandX = () => { const t = rng(), s = rng() < 0.5 ? -1 : 1; return s * (t < 0.45 ? 9.5 + rng() * 1.45 : t < 0.7 ? 11.2 + rng() * 0.8 : t < 0.9 ? 15.0 + rng() * 0.9 : rng() * 9.5); };
  const spot = (n, fn) => { for (let k = 0, tries = 0; k < n && tries < n * 4; tries++) { const x = bandX(), z = 46 - rng() * 214; if (blocked(x, z)) continue; fn(x, z, streetGround(x, z)); k++; } };
  // paper sheets: slightly bent quads
  spot(380, (x, z, y) => {
    const cell = A.papers[(rng() * 4) | 0], uv = rUV(cell), w = 0.18 + rng() * 0.3, l = 0.22 + rng() * 0.35, a = rng() * 6, c = Math.cos(a), sn = Math.sin(a), lift = rng() * 0.06;
    const Q = (u, v, h) => [x + u * c + v * sn, y + 0.008 + h, z - u * sn + v * c];
    const p0 = Q(-w / 2, -l / 2, 0), p1 = Q(w / 2, -l / 2, rng() * 0.02), p2 = Q(w / 2, l / 2, lift), p3 = Q(-w / 2, l / 2, 0);
    const t = 0.42 + rng() * 0.35, col = [t, t * 0.96, t * 0.88];
    P.tri(p0, p1, p2, up, up, up, [uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], col, [0.85, 0, 0]);
    P.tri(p0, p2, p3, up, up, up, [uv[0], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]], col, [0.85, 0, 0]);
  });
  // glass glitter: clusters of tiny shards (bright, metallic-ish so they catch the sky and the sun)
  spot(55, (x0, z0, y0) => {
    const nShard = 18 + (rng() * 20) | 0, R0 = 0.4 + rng() * 0.9;
    for (let k = 0; k < nShard; k++) {
      const x = x0 + (rng() - 0.5) * R0 * 2, z = z0 + (rng() - 0.5) * R0 * 2, y = streetGround(x, z) + 0.006, r = 0.015 + Math.pow(rng(), 2) * 0.06, a = rng() * 6;
      const nn = [(rng() - 0.5) * 0.6, 1, (rng() - 0.5) * 0.6], g = 0.5 + rng() * 0.35;
      P.tri([x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(a + 2.0) * r * 0.7, y, z + Math.sin(a + 2.0) * r * 0.7], [x + Math.cos(a + 4.0) * r, y + 0.003, z + Math.sin(a + 4.0) * r], nn, nn, nn, WHITE, WHITE, WHITE, [g * 0.9, g, g], [0.04, 1, 0]);
    }
    void y0;
  });
  // brick / concrete chunks (clusters near the facades and the scorch sites, strays in the gutters)
  const chunk = (x, z, s0) => {
    const y = streetGround(x, z), brick = rng() < 0.45, t = 0.7 + rng() * 0.4;
    const col = brick ? [0.3 * t, 0.1 * t, 0.06 * t] : [0.42 * t, 0.4 * t, 0.37 * t];
    const sx = s0 * (0.6 + rng() * 0.8), sy = s0 * (0.35 + rng() * 0.4), sz = s0 * (0.6 + rng() * 0.9);
    const g = brick ? BOX(2, 1.1, 1) : new THREE.IcosahedronGeometry(1, 0);
    addGeo(P, g, M4(x, y + sy * (brick ? 0.55 : 0.7), z, (rng() - 0.5) * 0.5, rng() * 6, (rng() - 0.5) * 0.5, sx * (brick ? 0.5 : 1), sy * (brick ? 0.5 : 1), sz * (brick ? 0.5 : 1)), col, RM.stone);
  };
  spot(120, (x, z) => chunk(x, z, 0.05 + rng() * 0.08));
  for (const [cx, cz] of [[15.4, 30], [-15.3, 8], [15.2, -14], [-15.4, -36], [-15.2, -78], [15.3, -66], [-15.4, -104], [15.4, -140], [4.5, 41], [-6, -12], [2, -47], [6.5, -118]]) {
    for (let k = 0; k < 14; k++) { const x = cx + (rng() - 0.5) * 2.4, z = cz + (rng() - 0.5) * 3.2; if (!blocked(x, z) && Math.abs(x) < 16) chunk(x, z, 0.04 + Math.pow(rng(), 2) * 0.16); }
  }
  // traffic cones (some knocked over)
  const coneG = new THREE.LatheGeometry([[0.0, 0.7], [0.03, 0.7], [0.13, 0.05], [0.0, 0.05]].map(([a, b]) => new THREE.Vector2(a, b)), 9);
  const cone = (x, z, down, rot) => {
    const y = streetGround(x, z), m = down ? M4(x, y + 0.13, z, 0, rot, Math.PI / 2 - 0.2).multiply(M4(0, -0.35, 0)) : M4(x, y, z, 0, rot, 0);
    addGeo(P, coneG, m, [0.85, 0.18, 0.02], RM.paint);
    addGeo(P, CYL(0.075, 0.095, 0.11, 9), m.clone().multiply(M4(0, 0.4, 0)), [0.9, 0.9, 0.88], [0.3, 0, 0.15]);
    addGeo(P, BOX(0.36, 0.04, 0.36), m.clone().multiply(M4(0, 0.02, 0)), [0.05, 0.05, 0.05], RM.rubber);
  };
  for (const [x, z, d] of [[-4.6, 43.2, 0], [0.8, 43.6, 1], [6.8, 42.8, 0], [10.2, 40, 1], [-10.4, -20.8, 0], [-0.4, -21.5, 1], [9.6, -42.6, 0], [-9.8, -61.8, 1], [5.1, -105.5, 0], [0.5, -110.5, 1], [-10.3, -150.5, 0], [10.4, -151, 1]]) cone(x, z, d, rng() * 6);
  // fallen sign panels (flat or propped on a chunk)
  const panel = (x, z, rect, w, h, rot, tilt) => {
    const y = streetGround(x, z) + 0.02 + Math.sin(tilt) * h / 2, m = M4(x, y, z, -Math.PI / 2 + tilt, rot, 0);
    addGeo(P, BOX(w, h, 0.02), m, [0.55, 0.56, 0.57], RM.alu);
    quadUV(P, new THREE.Vector3(0, 0, 0.011).applyMatrix4(m).toArray(), new THREE.Vector3(1, 0, 0).transformDirection(m).toArray(), new THREE.Vector3(0, 1, 0).transformDirection(m).toArray(), w - 0.02, h - 0.02, rUV(rect), COL.white, [0.5, 0, 0.12]);
  };
  panel(-2.8, 40.5, A.roadClosed, 1.2, 0.45, 0.3, 0.0);
  panel(9.2, 36.5, A.detour, 1.0, 0.38, -0.6, 0.35);
  panel(-9.9, -42.4, A.aveSign, 1.4, 0.35, 1.2, 0.0);
  panel(3.5, -64, A.roadClosed, 1.2, 0.45, 2.4, 0.25);
  panel(-9.6, -124, A.detour, 1.0, 0.38, 0.9, 0.0);
  panel(13.1, -154.5, A.crossSign, 1.4, 0.35, -0.4, 0.3);
}
// plaza centrepiece: round fountain basin with still water + "ASCENT" steel ribbon sculpture
function fountain(B, cx, cz, colliders) {
  const P = B.props, R = 4.2, segs = 28;
  const rim = new THREE.LatheGeometry([[R - 0.35, 0], [R - 0.35, 0.5], [R - 0.3, 0.56], [R + 0.05, 0.56], [R + 0.1, 0.5], [R + 0.1, 0]].map(([a, b]) => new THREE.Vector2(a, b)), segs);
  addStone(B.stone, rim, M4(cx, SW, cz), [0.6, 0.58, 0.55], 2);
  addGeo(P, new THREE.CircleGeometry(R - 0.35, segs).rotateX(-Math.PI / 2), M4(cx, SW + 0.38, cz), [0.02, 0.035, 0.04], RM.water);
  // sculpture: a twisted steel ribbon rising out of the water (lofted), on a granite drum
  addStone(B.stone, CYL(0.9, 1.0, 0.7, 16), M4(cx, SW + 0.35, cz), [0.32, 0.31, 0.3], 2);
  const pos = [], uv = [], idx = [];
  const N = 40, Wd = 0.55;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = t * Math.PI * 1.6, r = 0.55 + Math.sin(t * Math.PI) * 0.6, y = 0.7 + t * 7.5, tw = t * Math.PI * 2.2;
    const px = Math.cos(a) * r, pz = Math.sin(a) * r;
    const bx = Math.cos(tw) * Wd, by = Math.sin(tw) * Wd * 0.25;
    pos.push(cx + px - bx * Math.sin(a), SW + y - by, cz + pz + bx * Math.cos(a), cx + px + bx * Math.sin(a), SW + y + by, cz + pz - bx * Math.cos(a));
    uv.push(0, t, 1, t);
    if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const rib = new THREE.BufferGeometry(); rib.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rib.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rib.setIndex(idx); rib.computeVertexNormals();
  addGeo(P, rib, new THREE.Matrix4(), [0.82, 0.8, 0.76], RM.chrome);
  const rib2 = rib.clone(); const ri = rib2.index.array; for (let i = 0; i < ri.length; i += 3) { const t = ri[i + 1]; ri[i + 1] = ri[i + 2]; ri[i + 2] = t; } rib2.computeVertexNormals();
  addGeo(P, rib2, new THREE.Matrix4(), [0.82, 0.8, 0.76], RM.chrome);
  // plaque
  quad(P, [cx, SW + 0.33, cz + R + 0.106], [1, 0, 0], [0, 1, 0], 1.0, 0.5, A.plaque, COL.white, RM.paint);
  colliders.push({ min: [cx - R - 0.1, 0, cz - R - 0.1], max: [cx + R + 0.1, SW + 0.56, cz + R + 0.1], data: { kind: 'prop', mat: 'concrete' } });
  colliders.push({ min: [cx - 1.2, 0, cz - 1.2], max: [cx + 1.2, 8.5, cz + 1.2], data: { kind: 'prop', mat: 'metal' } });
}

function furniture(B, rng, glows, colliders) {
  const free = (x, z, r = 0.6) => !inSubway(x, z, r) && !(z < CROSS.z1 + 1 && z > CROSS.z0 - 1) && !(Math.abs(x) > 15 && ((z > -91.5 && z < -85.5) || (z > -122.5 && z < -116.5)));
  // streetlights every 24 m, staggered
  for (const s of [-1, 1]) for (let z = (s > 0 ? 140 : 128); z > PLAZA.z1 + 2; z -= 24) {
    let zz = z; if (!free(s * 11.55, zz, 1)) { if (free(s * 11.55, zz + 6, 1)) zz += 6; else continue; }
    streetlight(B, s * 11.55, zz, s, glows, colliders);
  }
  for (const s of [-1, 1]) for (const x of [s * 30, s * 58]) { streetlight(B, x, CROSS.z1 - 0.45, 0, glows, colliders); B.props.p.length; }
  // signal masts at the 4 corners
  signalMast(B, 11.6, CROSS.z1 - 0.6, [-1, 0], 0, glows, colliders, A.aveSign, rng);         // NE: over x>0 lanes, faces +z
  signalMast(B, -11.6, CROSS.z0 + 0.6, [1, 0], Math.PI, glows, colliders, A.aveSign, rng);   // SW: over x<0 lanes, faces -z
  signalMast(B, -11.6, CROSS.z1 - 0.6, [0, -1], -Math.PI / 2, glows, colliders, A.crossSign, rng); // NW: over the cross street, faces -x
  signalMast(B, 11.6, CROSS.z0 + 0.6, [0, 1], Math.PI / 2, glows, colliders, A.crossSign, rng);    // SE: faces +x
  // tactile pads at the crosswalk landings
  for (const s of [-1, 1]) { tactile(B, s * 11.75, CROSS.z1 + 0.05 - 1.6, 0.6, 1.2); tactile(B, s * 11.75, CROSS.z0 - 0.05 + 1.6, 0.6, 1.2); tactile(B, s * 13.5, CROSS.road1 + 0.55, 1.2, 0.6); tactile(B, s * 13.5, CROSS.road0 - 0.55, 1.2, 0.6); }
  // trees in pits (curb zone), offset from the lamps
  for (const [x, z] of [[12.3, 116], [-12.3, 104], [12.3, 68], [-12.3, 56], [12.3, 21], [-12.3, -4], [12.3, -12], [-12.3, -28], [12.3, -96], [-12.3, -84], [-12.3, -132], [12.3, -138]]) if (free(x, z, 0.8)) tree(B, x, z, rng, colliders);
  // hydrants, news boxes, trash cans, meters, benches
  for (const [x, z] of [[11.55, 33], [-11.55, 14.5], [11.55, -19], [-11.55, -67], [11.55, -75], [-11.55, -112], [14, -46.2], [-26, -59.2]]) if (free(x, z)) hydrant(B, x, z, rng() * 6, colliders);
  for (const [x, z, rot] of [[11.95, 27, -Math.PI / 2], [-11.95, 30, Math.PI / 2], [12.0, -66.5, -Math.PI / 2], [-11.95, -96, Math.PI / 2]]) if (free(x, z, 1)) newsBoxes(B, x, z, rot, rng, colliders);
  for (const [x, z] of [[11.8, 44], [-11.8, 36], [12.0, -2], [-11.8, -40], [11.85, -64], [-11.8, -70], [11.8, -110], [-11.8, -146], [11.8, -146], [20, -45.5]]) if (free(x, z)) trashCan(B, x, z, rng, colliders);
  for (let z = 98; z > 72; z -= 6.5) meter(B, 11.42, z, colliders);
  for (let z = 92; z > 66; z -= 6.5) meter(B, -11.42, z, colliders);
  for (let z = -76; z > -100; z -= 6.5) if (free(11.42, z)) meter(B, 11.42, z, colliders);
  for (const [x, z, rot] of [[12.25, 52, Math.PI / 2], [-12.25, -18, -Math.PI / 2], [-12.25, -120, -Math.PI / 2]]) bench(B, x, z, rot, colliders);
  // bus shelter on the left sidewalk next to the stalled bus
  busShelter(B, -11.85, -4.0, 2.4, -1, colliders);
  // barricade line at the start (between the burning police cars) + sidewalks
  for (const [x, z, r] of [[-10.6, 45.8, 0.1], [2.6, 46.0, -0.08], [8.8, 45.6, 0.12], [-13.6, 45.8, 0], [13.6, 45.6, 0.05]]) sawhorse(B, x, z, r, colliders);
  // plaza: fountain + sculpture, bollards at the road end, planters with trees, benches
  fountain(B, 0, -162.5, colliders);
  for (let x = -10.2; x <= 10.21; x += 1.7) bollard(B, x, PLAZA.z1 - 6.6, colliders);
  for (const s of [-1, 1]) {
    for (let x = 12; x <= 44; x += 2.4) bollard(B, s * x, PLAZA.z1 - 0.7, colliders);
    planter(B, s * 26, -160.5, 3.2, 3.2, rng, colliders, true);
    planter(B, s * 38, -160.5, 3.2, 3.2, rng, colliders, true);
    bench(B, s * 32, -158, 0, colliders);
    bench(B, s * 32, -163, Math.PI, colliders);
    tactile(B, s * 11.75, PLAZA.z1 - 3, 0.6, 1.2);
  }
}

// ---------------------------------------------------------------------- buildStreet
export async function buildStreet(ctx = {}) {
  const M = materials(ctx.renderer);
  const rng = makeRng(4401);
  const B = { road: new Bucket(), side: new Bucket(), stone: new Bucket(), plaza: new Bucket(), marks: new Bucket(), props: new Bucket(), lens: new Bucket(), glass: new Bucket(), leaves: new Bucket(), pools: new Bucket(), poolList: [] };
  const anchors = { glows: [], manholes: [], drains: [] };
  const colliders = [];
  const wetB = new Bucket(); anchors._wet = wetB;
  surfaces(B, rng);
  curbs(B, rng);
  markings(B, rng, anchors);
  furniture(B, rng, anchors.glows, colliders);
  litter(B, makeRng(4477));
  // light pools under the lamps (additive, faded in at dusk)
  for (const [x, z, r] of B.poolList) decal(B.pools, x, z, r, r, 0, MK.pool, [1.0, 0.72, 0.42], (Math.abs(x) > AVE.curb ? SW : 0) + 0.012);
  const root = new THREE.Group(); root.name = 'street';
  const add = (bk, mat, o) => { if (bk.tris) { const m = meshFrom(bk, mat, o); root.add(m); return m; } return null; };
  add(B.road, M.road);
  add(B.side, M.side);
  add(B.stone, M.side, { shadow: true });
  add(B.plaza, M.plaza);
  add(B.marks, M.marks, { order: 1 });
  delete anchors._wet;
  add(wetB, M.wet, { order: 1 });
  const pm = add(B.pools, M.pools, { order: 2 });
  add(B.props, M.props, { shadow: true });
  add(B.lens, M.lens);
  add(B.leaves, M.leaves, { shadow: true });
  add(B.glass, M.glass, { order: 3, receive: false });
  let tris = 0, draws = 0;
  root.traverse((o) => { if (o.isMesh) { draws++; tris += o.geometry.attributes.position.count / 3; } });
  return {
    root, colliders, anchors, info: { draws, tris },
    update(dt, t, dusk) { if (pm) pm.material.opacity = Math.min(1, Math.max(0, (dusk - 0.12) * 2.2)) * 0.55; },
  };
}

// ---------------------------------------------------------------------- buildSubway
export async function buildSubway(ctx = {}) {
  const M = materials(ctx.renderer);
  const rng = makeRng(5501);
  const S = SUBWAY, x0 = S.x0, x1 = S.x1, zT = S.zTop, zB = S.zBot, yB = S.yBot, zE = S.zEnd;
  const B = { tiles: new Bucket(), stone: new Bucket(), props: new Bucket(), lens: new Bucket(), glass: new Bucket(), dark: new Bucket() };
  const colliders = [], glows = [];
  const ramp = (z) => streetGround((x0 + x1) / 2, z);
  const W = x1 - x0, xc = (x0 + x1) / 2;
  const P = B.props;
  // ---- underground (stairs, tiled walls, landing, tunnel, turnstiles): baked-light interior, see subway.js
  const zT2 = zE + 7;
  const inner = buildSubwayInterior({ atlas: textures(ctx.renderer).atlas, A, PA });
  // fill above the soffit at sidewalk level (seen from the street inside the headhouse): sidewalk slab
  addStone(B.stone, BOX(W, 0.06, zE - (zB - 3.4) + 0.2), M4(xc, SW - 0.03, (zE + zB - 3.4) / 2 + 0.1), [0.7, 0.67, 0.62]);
  addGeo(P, BOX(W, 0.012, 0.3), M4(xc, SW + 0.006, zB - 3.4 + 0.15), [0.6, 0.45, 0.08], RM.paint); // yellow edge at the drop
  // the turn fades into the dark
  const fade = (x, z, w, h, rotY, a0) => {
    const c = Math.cos(rotY), s = Math.sin(rotY), nn = [s, 0, c];
    const p = (dx, y) => [x + dx * c, y, z - dx * s];
    const A0 = p(-w / 2, yB), B0 = p(w / 2, yB), C0 = p(w / 2, yB + h), D0 = p(-w / 2, yB + h);
    B.dark.tri(A0, B0, C0, nn, nn, nn, WHITE, WHITE, WHITE, [0, 0, 0, 0, 0, 0, 0, 0, 0], [a0, 0, 0]);
    B.dark.tri(A0, C0, D0, nn, nn, nn, WHITE, WHITE, WHITE, [0, 0, 0, 0, 0, 0, 0, 0, 0], [a0, 0, 0]);
  };
  fade(x1 + 4.2, zT2 - W / 2, W, 2.8, Math.PI / 2, 0.55); fade(x1 + 6.2, zT2 - W / 2, W, 2.8, Math.PI / 2, 0.92);
  // ---- above ground: side walls (granite) at x0-0.2..x0 and x1..x1+0.2, balustrade on top, rear headhouse
  const zH = zB - 3.4;                    // rear (enclosed) part starts here
  const gran = [0.5, 0.48, 0.46], coping = [0.62, 0.6, 0.57];
  for (const xw of [x0 - 0.1, x1 + 0.1]) {
    const so = xw < xc ? -1 : 1;
    // wall body below grade (outer face hidden; the tile wall is the inner face)
    addGeo(P, BOX(0.2, SW - yB + 0.1, zE - zT), M4(xw + so * 0.012, (SW + yB - 0.1) / 2, (zT + zE) / 2), [0.2, 0.2, 0.2], RM.concrete);
    // front part: granite parapet 0.5 + glass/steel railing
    addStone(B.stone, BOX(0.26, 0.5, zH - zT), M4(xw, SW + 0.25, (zT + zH) / 2), gran);
    addStone(B.stone, BOX(0.32, 0.06, zH - zT + 0.06), M4(xw, SW + 0.53, (zT + zH) / 2), coping);
    for (let z = zT + 0.05; z <= zH + 0.01; z += (zH - zT) / 4) addGeo(P, BOX(0.06, 0.6, 0.06), M4(xw, SW + 0.86, z), COL.green, RM.paint);
    addGeo(P, CYL(0.035, 0.035, zH - zT, 8).rotateX(Math.PI / 2), M4(xw, SW + 1.17, (zT + zH) / 2), COL.green, RM.paint);
    addGeo(B.glass, new THREE.PlaneGeometry(zH - zT, 0.5).rotateY(Math.PI / 2), M4(xw, SW + 0.84, (zT + zH) / 2), COL.white, RM.water);
    // rear part: full-height granite wall with the system map facing the street
    addStone(B.stone, BOX(0.26, 2.9, zE - zH + 0.2), M4(xw, SW + 1.45, (zH + zE) / 2 + 0.1), gran);
    quad(P, [xw + so * 0.132, SW + 1.55, (zH + zE) / 2], [0, 0, so], [0, 1, 0], 2.4, 1.6, A.map, COL.white, [0.4, 0, 0.12]);
    colliders.push({ min: [xw - 0.13, yB - 0.2, zT], max: [xw + 0.13, SW + 1.2, zH], data: { kind: 'wall', mat: 'concrete' } });
    colliders.push({ min: [xw - 0.13, yB - 0.2, zH], max: [xw + 0.13, SW + 2.9, zE + 0.3], data: { kind: 'wall', mat: 'concrete' } });
  }
  // back wall (+z end): granite, HAVEN METRO on its inner face, an ad toward the avenue
  addStone(B.stone, BOX(W + 0.4, 2.9, 0.3), M4(xc, SW + 1.45, zE + 0.15), gran);
  quad(P, [xc, SW + 1.9, zE - 0.004], [-1, 0, 0], [0, 1, 0], 3.0, 0.75, A.metro);
  quad(P, [xc, SW + 1.4, zE + 0.304], [1, 0, 0], [0, 1, 0], 1.6, 2.4, A.ad2, COL.white, [0.4, 0, 0.3]);
  colliders.push({ min: [x0 - 0.25, SW, zE], max: [x1 + 0.25, SW + 2.9, zE + 0.3], data: { kind: 'wall', mat: 'concrete' } });
  colliders.push({ min: [x0 - 0.25, yB - 0.5, zE - 0.1], max: [x1 + 0.25, SW, zE + 0.3], data: { kind: 'bound', noBullet: true } });
  // glass canopy on a green steel frame, the open front under a HAVEN METRO fascia
  const yC0 = SW + 3.25, yC1 = SW + 3.0, zc0 = zT - 0.6, zc1 = zE + 0.3, green = [0.05, 0.16, 0.09];
  const yC = (z) => yC0 + (yC1 - yC0) * (z - zc0) / (zc1 - zc0);
  for (const xw of [x0 - 0.1, x1 + 0.1]) {
    addGeo(P, BOX(0.14, 0.14, zc1 - zc0), M4(xw, (yC0 + yC1) / 2, (zc0 + zc1) / 2, Math.atan2(yC0 - yC1, zc1 - zc0), 0, 0), green, RM.paint);
    for (const z of [zT + 0.1, (zT + zH) / 2]) addGeo(P, BOX(0.12, yC(z) - SW - 0.55, 0.12), M4(xw, (SW + 0.55 + yC(z)) / 2, z), green, RM.paint);
  }
  for (let z = zc0; z <= zc1 + 0.01; z += (zc1 - zc0) / 8) addGeo(P, BOX(W + 0.5, 0.08, 0.07), M4(xc, yC(z) + 0.05, z), green, RM.paint);
  addGeo(B.glass, new THREE.PlaneGeometry(W + 0.4, Math.hypot(zc1 - zc0, yC0 - yC1)).rotateX(-Math.PI / 2), M4(xc, (yC0 + yC1) / 2 + 0.1, (zc0 + zc1) / 2, Math.atan2(yC0 - yC1, zc1 - zc0), 0, 0), COL.white, RM.water);
  // fascia sign over the entrance (faces -z, toward the intersection) + back side
  addGeo(P, BOX(W + 0.6, 0.7, 0.16), M4(xc, yC0 - 0.3, zc0), [0.05, 0.1, 0.07], RM.paint);
  quad(P, [xc, yC0 - 0.3, zc0 - 0.082], [-1, 0, 0], [0, 1, 0], W + 0.4, 0.62, A.metro);
  quad(P, [xc, yC0 - 0.3, zc0 + 0.082], [1, 0, 0], [0, 1, 0], W + 0.4, 0.62, A.metro, [0.6, 0.6, 0.6]);
  // two green globe lamps on posts at the entrance corners
  const globes = [];
  for (const xw of [x0 - 0.1, x1 + 0.1]) {
    const gz = zT + 0.1;
    addGeo(P, CYL(0.05, 0.07, 1.4, 8), M4(xw, SW + 1.3, gz), COL.green, RM.paint);
    addGeo(P, CYL(0.09, 0.06, 0.14, 8), M4(xw, SW + 2.05, gz), COL.green, RM.paint);
    addGeo(B.lens, new THREE.SphereGeometry(0.2, 14, 10), M4(xw, SW + 2.3, gz), [0.25, 1.0, 0.45], [0.2, 0, 1.2]);
    addGeo(P, CYL(0.06, 0.09, 0.08, 8), M4(xw, SW + 2.52, gz), COL.green, RM.paint);
    globes.push({ p: [xw, SW + 2.3, gz], color: [0.5, 2.6, 1.0], size: 1.3, dusk: true });
  }
  // HAVEN METRO totem on the curb side of the entrance
  const tx = 11.45, tz = zT - 1.1;
  addGeo(P, BOX(0.36, 2.9, 0.16), M4(tx, SW + 1.45, tz), [0.05, 0.1, 0.07], RM.paint);
  for (const sz of [-1, 1]) quad(P, [tx, SW + 1.7, tz + sz * 0.082], [-sz, 0, 0], [0, 1, 0], 0.32, 0.96 * 2.4 / 2.4 * 2, A.totem, COL.white, [0.4, 0, 0.45]);
  colliders.push({ min: [tx - 0.2, 0, tz - 0.1], max: [tx + 0.2, 3, tz + 0.1], data: { kind: 'prop', mat: 'metal', thin: true } });
  // ---- assemble
  const root = new THREE.Group(); root.name = 'subway';
  const add = (bk, mat, o) => { if (bk.tris) { const m = meshFrom(bk, mat, o); root.add(m); return m; } return null; };
  add(B.tiles, M.tiles);
  add(B.stone, M.side);
  add(B.props, M.props, { shadow: true });
  add(B.lens, M.lens);
  const dm = add(B.dark, darkMaterial(), { order: 4, receive: false });
  if (dm) dm.frustumCulled = false;
  add(B.glass, M.glass, { order: 3, receive: false });
  let tris = 0, draws = 0;
  root.add(inner.root); glows.push(...inner.glows);
  root.traverse((o) => { if (o.isMesh) { draws++; tris += o.geometry.attributes.position.count / 3; } });
  glows.push(...globes);
  return {
    root, colliders,
    anchors: { dive: new THREE.Vector3(xc, SW, zT), bottom: new THREE.Vector3(xc, yB, zB + 1.5), glows },
    info: { draws, tris },
  };
}
// black with per-vertex alpha (rm.x) for the tunnel fade cards
let DARK = null;
function darkMaterial() {
  if (DARK) return DARK;
  DARK = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, fog: false });
  DARK.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rm;\nvarying float vA;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvA = rm.x;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vA;').replace('#include <opaque_fragment>', 'diffuseColor.a = vA;\n#include <opaque_fragment>');
  };
  DARK.customProgramCacheKey = () => 'tunnelDark';
  return DARK;
}
