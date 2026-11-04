import * as THREE from 'three';
import { makeCanvas, canvasTex, concreteTexture } from '../../textures.js';
import { makeRng } from '../../rng.js';
import { duskShared } from '../../atmosphere.js';
import { AVE, CROSS, PLAZA, MERIDIAN, LOBBY, LOTS, SNIPERS, PARAPET } from './layout.js';

// =====================================================================================
//  DOWNTOWN HAVEN CITY — the glass canyon. buildCity(): every avenue lot (podium street wall +
//  setback tower), storefronts, roofs, the cross street / plaza / back-of-start frontage, the
//  mid ring and the far skyline. buildMeridian(): the villain's chunked hero tower.
//
//  Draw-call strategy: ONE facade material (atlas of 7 facade tiles + a swatch tile, sampled
//  with fract() + textureGrad so each tile repeats) carries every tower, podium wall, fin,
//  coping, LED strip and the far skyline. Three cheap helpers (trim stone, metal, store/sign
//  atlas) carry the street-level detail. Everything is merged per material across all lots.
// =====================================================================================

const SF = 4.8;            // storefront band top
const PANE_Y0 = 0.45, PANE_Y1 = 3.3;
const RECESS = 0.6;

// facade atlas tiles: [tile metres wide, tall] (one texture repeat), grid (bays, floors)
const TILE = {
  glassBlue: 0, glassGold: 1, darkFins: 2, stone: 3, stoneGlass: 4, meridian: 5, precast: 6, swatch: 7,
};
const TM = [[6, 15.6], [6, 15.6], [6, 15.6], [7.2, 14.4], [6, 15.6], [7.6, 16.8], [6, 14.4]];
// swatches (tile 7, 4 x 8 cells of flat material)
const SW = {
  silver: 0, darkAlu: 1, gold: 2, bronze: 3, blackGlass: 4, lime: 5, concrete: 6, roof: 7, tar: 8, led: 9, red: 10, white: 11,
  blueGlass: 12, goldGlass: 13, granite: 14, copper: 15, interior: 16, paint: 17, redPaint: 18, amber: 19, cyanLed: 20, char: 21,
};
const WHITE = [1, 1, 1];

// ------------------------------------------------------------------ geometry batch
class Batch {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.T = []; this.I = []; }
  get count() { return this.P.length / 3; }
  _v(p, n, u, v, c, t) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.U.push(u, v); this.C.push(c[0], c[1], c[2]); this.T.push(t); }
  // quad: corner o, edges a (u dir) and b (v dir); normal = a x b
  quad(o, a, b, uv, t = 7, c = WHITE, cTop = c) {
    let nx = a[1] * b[2] - a[2] * b[1], ny = a[2] * b[0] - a[0] * b[2], nz = a[0] * b[1] - a[1] * b[0];
    const l = Math.hypot(nx, ny, nz) || 1; const n = [nx / l, ny / l, nz / l];
    const i = this.count;
    this._v(o, n, uv[0], uv[1], c, t);
    this._v([o[0] + a[0], o[1] + a[1], o[2] + a[2]], n, uv[2], uv[1], c, t);
    this._v([o[0] + a[0] + b[0], o[1] + a[1] + b[1], o[2] + a[2] + b[2]], n, uv[2], uv[3], cTop, t);
    this._v([o[0] + b[0], o[1] + b[1], o[2] + b[2]], n, uv[0], uv[3], cTop, t);
    this.I.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  tri(a, b, c3, uvs, t, c, want) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c3[0] - a[0], c3[1] - a[1], c3[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c3] = [c3, b]; uvs = [uvs[0], uvs[2], uvs[1]]; n = n.map(v => -v); }
    const l = Math.hypot(...n) || 1; n = n.map(v => v / l);
    const i = this.count;
    this._v(a, n, uvs[0][0], uvs[0][1], c, t); this._v(b, n, uvs[1][0], uvs[1][1], c, t); this._v(c3, n, uvs[2][0], uvs[2][1], c, t);
    this.I.push(i, i + 1, i + 2);
  }
  // append a THREE geometry transformed by matrix m (swatch uv if sw given, else uv * uvS)
  geo(g, m, { sw, t, c = WHITE, uvS = 1 } = {}) {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), base = this.count;
    const su = sw !== undefined ? swUV(sw) : null;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m); const p = [v.x, v.y, v.z];
      v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); const n = [v.x, v.y, v.z];
      if (su) this._v(p, n, su[0], su[1], c, 7);
      else this._v(p, n, uv.getX(i) * uvS, uv.getY(i) * uvS, c, t ?? 7);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.I.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) this.I.push(base + i);
  }
  translate(dx, dy, dz) { for (let i = 0; i < this.P.length; i += 3) { this.P[i] += dx; this.P[i + 1] += dy; this.P[i + 2] += dz; } }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setAttribute('aTile', new THREE.Float32BufferAttribute(this.T, 1));
    g.setIndex(this.I);
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  mesh(mat, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(this.geometry(), mat);
    m.castShadow = cast; m.receiveShadow = receive;
    return m;
  }
  get tris() { return this.I.length / 3; }
}
function swUV(k) { const col = k % 4, row = Math.floor(k / 4); return [(col + 0.5) / 4, (row + 0.5) / 8]; }
const SWQ = (k) => { const s = swUV(k); return [s[0], s[1], s[0], s[1]]; };

// uv for a face given its origin and edge vectors
function faceUV(o, a, b, opt) {
  if (opt.sw !== undefined) return SWQ(opt.sw);
  const la = Math.hypot(...a) || 1, lb = Math.hypot(...b) || 1;
  if (opt.tile !== undefined) {
    const [tw, th] = TM[opt.tile];
    const ah = a.map(v => v / la);
    const u0 = opt.u0 !== undefined ? opt.u0 : (o[0] * ah[0] + o[2] * ah[2]) / tw + (opt.uo || 0);
    const v0 = b[1] !== 0 ? (o[1] - (opt.yb || 0)) / th + (opt.vo || 0) : (o[0] * b[0] + o[2] * b[2]) / lb / th;
    return [u0, v0, u0 + la / tw, v0 + lb / th];
  }
  const s = opt.s || 2.5, ah = a.map(v => v / la), bh = b.map(v => v / lb);
  const u0 = (o[0] * ah[0] + o[1] * ah[1] + o[2] * ah[2]) / s, v0 = (o[0] * bh[0] + o[1] * bh[1] + o[2] * bh[2]) / s;
  return [u0, v0, u0 + la / s, v0 + lb / s];
}
function q(B, o, a, b, opt = {}) { B.quad(o, a, b, opt.uv || faceUV(o, a, b, opt), opt.tile ?? (opt.sw !== undefined ? 7 : 0), opt.c || WHITE, opt.cTop || opt.c || WHITE); }
// vertical quad split into AO bands: opt.ao = metres darkened under the top (cornice), opt.aoB = metres darkened above the base
function qAO(B, o, a, h, opt) {
  const c = opt.c || WHITE, aoT = opt.ao || 0, aoB = opt.aoB || 0;
  if ((!aoT && !aoB) || h < aoT + aoB + 0.5) { q(B, o, a, [0, h, 0], opt); return; }
  const dk = (k) => c.map(v => v * k);
  let y = o[1];
  const seg = (hh, c0, c1) => { if (hh <= 0.001) return; const u = { ...opt, c: c0, cTop: c1 }; delete u.ao; delete u.aoB; q(B, [o[0], y, o[2]], a, [0, hh, 0], u); y += hh; };
  seg(aoB, dk(opt.aoBk ?? 0.5), c); seg(h - aoT - aoB, c, c); seg(aoT, c, dk(opt.aoK ?? 0.42));
}
// axis aligned box; skip: string of faces to omit (x X y Y z Z = -x +x -y +y -z +z)
function box(B, x0, y0, z0, x1, y1, z1, opt = {}) {
  if (x0 > x1) [x0, x1] = [x1, x0]; if (y0 > y1) [y0, y1] = [y1, y0]; if (z0 > z1) [z0, z1] = [z1, z0];
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, sk = opt.skip || '';
  if (!sk.includes('X')) q(B, [x1, y0, z1], [0, 0, -dz], [0, dy, 0], opt);
  if (!sk.includes('x')) q(B, [x0, y0, z0], [0, 0, dz], [0, dy, 0], opt);
  if (!sk.includes('Z')) q(B, [x0, y0, z1], [dx, 0, 0], [0, dy, 0], opt);
  if (!sk.includes('z')) q(B, [x1, y0, z0], [-dx, 0, 0], [0, dy, 0], opt);
  if (!sk.includes('Y')) q(B, [x0, y1, z1], [dx, 0, 0], [0, 0, -dz], opt.top || opt);
  if (!sk.includes('y')) q(B, [x0, y0, z0], [dx, 0, 0], [0, 0, dz], opt);
}
// oriented beam between two points (w across, d deep), via a box geometry
const _bm = new THREE.Matrix4(), _bq = new THREE.Quaternion(), _bv = new THREE.Vector3(), _bu = new THREE.Vector3();
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
function beam(B, p0, p1, w, d, opt = {}, roll = 0) {
  const a = new THREE.Vector3(...p0), b = new THREE.Vector3(...p1);
  const len = a.distanceTo(b);
  _bv.subVectors(b, a).normalize();
  _bq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _bv);
  if (roll) _bq.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll));
  _bm.compose(_bu.addVectors(a, b).multiplyScalar(0.5), _bq, new THREE.Vector3(w, len, d));
  B.geo(UNIT_BOX, _bm, opt);
}
// a face along an axis: n = '+x' | '-x' | '+z' | '-z'; fixed = plane coordinate, t0 < t1 along the face
function mkFace(n, fixed, t0, t1) {
  const len = t1 - t0;
  if (n === '-x') return { ox: fixed, oz: t0, dx: 0, dz: 1, nx: -1, nz: 0, len };
  if (n === '+x') return { ox: fixed, oz: t1, dx: 0, dz: -1, nx: 1, nz: 0, len };
  if (n === '+z') return { ox: t0, oz: fixed, dx: 1, dz: 0, nx: 0, nz: 1, len };
  return { ox: t1, oz: fixed, dx: -1, dz: 0, nx: 0, nz: -1, len };
}
// local (s along, d inward, y) -> world
const LP = (f, s, d, y) => [f.ox + f.dx * s - f.nx * d, y, f.oz + f.dz * s - f.nz * d];
function lbox(B, f, s0, s1, d0, d1, y0, y1, opt) {
  const a = LP(f, s0, d0, y0), b = LP(f, s1, d1, y1);
  box(B, a[0], a[1], a[2], b[0], b[1], b[2], opt);
}
function lAABB(f, s0, s1, d0, d1, y0, y1) {
  const a = LP(f, s0, d0, y0), b = LP(f, s1, d1, y1);
  return { min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])] };
}
// wall quad on a face from s0..s1, y0..y1 at depth d (outward normal)
function lwall(B, f, s0, s1, y0, y1, d, opt) {
  const o = LP(f, s0, d, y0);
  qAO(B, o, [f.dx * (s1 - s0), 0, f.dz * (s1 - s0)], y1 - y0, opt);
}
// vertical prism from a polygon [[x,z]...] (any winding), facade uv along the perimeter
function prism(B, poly, y0, y1, opt, cap = null) {
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area > 0) poly = poly.slice().reverse();
  let acc = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const o = [a[0], y0, a[1]];
    const o2 = { ...opt };
    if (opt.tile !== undefined) o2.u0 = (opt.uo || 0) + acc / TM[opt.tile][0];
    qAO(B, o, [dx, 0, dz], y1 - y0, o2);
    acc += L;
  }
  if (cap) {
    let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[1]; } cx /= poly.length; cz /= poly.length;
    const u = swUV(cap.sw ?? SW.roof);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      B.tri([cx, y1, cz], [a[0], y1, a[1]], [b[0], y1, b[1]], [u, u, u], 7, cap.c || WHITE, [0, 1, 0]);
    }
  }
}
const rectPoly = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const octPoly = (x0, z0, x1, z1, c) => [[x0 + c, z0], [x1 - c, z0], [x1, z0 + c], [x1, z1 - c], [x1 - c, z1], [x0 + c, z1], [x0, z1 - c], [x0, z0 + c]];

// ------------------------------------------------------------------ facade atlas (1024^2: color, ORM, emissive)
function facadeAtlas() {
  const S = 1024;
  const CC = makeCanvas(S, S), OC = makeCanvas(S, S), EC = makeCanvas(S, S);
  const c = CC.getContext('2d'), o = OC.getContext('2d'), e = EC.getContext('2d');
  c.fillStyle = '#888'; c.fillRect(0, 0, S, S); o.fillStyle = 'rgb(0,200,0)'; o.fillRect(0, 0, S, S); e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  const r = makeRng(4242);
  const rgb = (a) => `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`;
  const jit = (a, k) => { const f = 1 + (r() - 0.5) * 2 * k; return a.map(v => Math.max(0, Math.min(255, v * f))); };
  // tile-local rect (x right, y up from the tile bottom), wraps horizontally
  let TX = 0, TY = 0;
  const tile = (t) => { TX = (t % 4) * 256; TY = S - Math.floor(t / 4) * 512; };
  const R = (x, y, w, h, col, orm, em) => {
    const parts = [[x, w]];
    if (x < 0) parts.splice(0, 1, [0, w + x], [256 + x, -x]);
    else if (x + w > 256) parts.splice(0, 1, [x, 256 - x], [0, x + w - 256]);
    for (const [px, pw] of parts) {
      if (pw <= 0) continue;
      const X = TX + px, Y = TY - y - h;
      if (col) { c.fillStyle = typeof col === 'string' ? col : rgb(col); c.fillRect(X, Y, pw, h); }
      if (orm) { o.fillStyle = `rgb(${orm[0] * 255 | 0},${orm[1] * 255 | 0},${orm[2] * 255 | 0})`; o.fillRect(X, Y, pw, h); }
      if (em) { e.fillStyle = typeof em === 'string' ? em : rgb(em); e.fillRect(X, Y, pw, h); }
    }
  };
  // an office interior (emissive) seen through a pane: every window its own mix of ceiling strip, blinds,
  // curtain, desk lamp or nothing at all (no furniture bars: those read as an equalizer from below)
  const lamp = (cx, cy, rad, col, a) => {
    const X = TX + ((cx % 256) + 256) % 256, Y = TY - cy;
    const g = e.createRadialGradient(X, Y, 0, X, Y, rad);
    g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    e.fillStyle = g; e.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
  };
  const interior = (x, y, w, h, warm, opt = {}) => {
    if (r() < (opt.dark ?? 0.32)) return 'dark';
    const base = warm ? [255, 186 + r() * 44, 104 + r() * 56] : (r() < 0.5 ? [196, 216, 255] : [232, 238, 226]);
    const k = 0.45 + r() * 0.55;
    const E = (xx, yy, ww, hh, f) => R(xx, yy, ww, hh, null, null, base.map(v => Math.min(255, v * k * f)));
    const st = 7;
    const amb = 0.12 + r() * 0.2;
    for (let i = 0; i < st; i++) { const t = (i + 0.5) / st; E(x, y + h * i / st, w, h / st + 1, amb + (0.5 + r() * 0.15) * Math.pow(t, 2.4)); }
    if (r() < 0.7) { const ly = y + h - 3 - Math.floor(r() * 4); E(x, ly, w, 2, 1.35 + r() * 0.4); }
    if (r() < 0.22) lamp(x + w * (0.2 + r() * 0.6), y + h * (0.22 + r() * 0.2), 6 + r() * 8, [255, 190, 110], 0.8);
    const v = r();
    if (v < 0.3 || opt.blinds) { const by0 = y + h * (0.12 + r() * 0.75); for (let by = by0; by < y + h; by += 3) R(x, by, w, 1.3, null, null, base.map(q => q * k * 0.22)); }
    else if (v < 0.48) { const cw = w * (0.2 + r() * 0.5), left = r() < 0.5; E(left ? x : x + w - cw, y, cw, h, 0.3 + r() * 0.15); }
    else if (v < 0.56) { R(x, y, w, h * (0.1 + r() * 0.12), null, null, base.map(q => q * k * 0.06)); }
    return 'lit';
  };
  // generic curtain wall
  const curtain = (t, P) => {
    tile(t);
    const bays = P.bays || 4, bw = 256 / bays, fh = 128;
    for (let j = 0; j < 4; j++) for (let i = 0; i < bays; i++) {
      const x = i * bw, y = j * fh, sp = P.spandrel;
      R(x, y, bw, sp, jit(P.span, 0.05), [0, P.spRough, P.spMetal]);
      if (P.spLine) R(x, y + sp - 3, bw, 2, P.spLine, [0, 0.3, 1]);
      const v = r();
      let gc = jit(P.glass, P.var || 0.1), orm = [1, P.rough + r() * 0.04, P.metal];
      const vy = y + sp, vh = fh - sp;
      R(x, vy, bw, vh, gc, orm);
      if (v < 0.13) { // blinds
        const bl = P.blinds || [190, 180, 160];
        const by0 = vy + vh * (0.25 + r() * 0.5);
        R(x, by0, bw, vy + vh - by0, gc.map((g, k) => g * 0.5 + bl[k] * 0.45), [1, 0.32, 0.55]);
        for (let by = by0; by < vy + vh; by += 3) R(x, by, bw, 1, gc.map((g, k) => g * 0.3 + bl[k] * 0.3), null);
      } else if (v < 0.27) R(x, vy, bw, vh, gc.map(g => g * 0.62), [1, P.rough, P.metal * 0.95]);
      else if (v < 0.33) R(x, vy, bw, vh, gc.map(g => Math.min(255, g * 1.18)), null);
      interior(x + 1, vy + 1, bw - 2, vh - 2, r() < (P.warm ?? 0.75), { blinds: v < 0.13, dark: P.dark });
      if (P.transom) R(x, vy + vh * P.transom, bw, 2, P.mullion, [0, 0.35, 1], [0, 0, 0]);
      // mullions + slab line
      R(x - P.mw / 2, y, P.mw, fh, P.mullion, [0, 0.35, 1], [0, 0, 0]);
      R(x, vy - 1, bw, 2, P.mullion, [0, 0.35, 1], [0, 0, 0]);
      if (P.midMullion) R(x + bw / 2 - 1, vy, 2, vh, P.mullion, [0, 0.35, 1], [0, 0, 0]);
    }
  };
  curtain(TILE.glassBlue, { spandrel: 32, span: [64, 92, 106], spRough: 0.2, spMetal: 1, glass: [118, 162, 176], rough: 0.035, metal: 1, mullion: [196, 200, 206], mw: 3, var: 0.09, warm: 0.6 });
  curtain(TILE.glassGold, { spandrel: 30, span: [118, 80, 38], spRough: 0.22, spMetal: 1, glass: [222, 168, 98], rough: 0.045, metal: 1, mullion: [74, 52, 32], mw: 4, var: 0.1, transom: 0.72, warm: 0.85, spLine: [210, 160, 80] });
  curtain(TILE.darkFins, { spandrel: 22, span: [20, 22, 26], spRough: 0.15, spMetal: 1, glass: [64, 74, 84], rough: 0.03, metal: 1, mullion: [36, 38, 42], mw: 2, var: 0.08, warm: 0.7 });
  curtain(TILE.meridian, { spandrel: 28, span: [16, 17, 20], spRough: 0.1, spMetal: 1, glass: [56, 64, 76], rough: 0.03, metal: 1, mullion: [30, 30, 34], mw: 2, var: 0.07, warm: 0.45, dark: 0.7, spLine: [226, 172, 86] });
  // stone (1920s limestone, punched windows)
  {
    tile(TILE.stone);
    R(0, 0, 256, 512, [206, 192, 166], [0, 0.86, 0]);
    for (let k = 0; k < 2600; k++) R(r() * 256, r() * 512, 1 + r() * 3, 1 + r() * 3, `rgba(${r() < 0.5 ? '0,0,0' : '255,250,240'},${r() * 0.08})`);
    for (let y = 0; y < 512; y += 21) { R(0, y, 256, 1, 'rgba(70,56,40,0.22)'); const off = (y / 21) % 2 ? 21 : 0; for (let x = off; x < 256; x += 42) R(x, y, 1, 21, 'rgba(70,56,40,0.16)'); }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const x = i * 64, y = j * 128;
      // grime streaks under the sill
      for (let g = 0; g < 8; g++) R(x + 14 + g * 4 + r() * 3, y + 4, 2, 18, `rgba(60,48,36,${0.03 + r() * 0.06})`);
      R(x + 17, y + 6, 30, 14, [192, 178, 152]); R(x + 17, y + 19, 30, 1, 'rgba(255,255,255,0.25)'); R(x + 17, y + 6, 30, 1, 'rgba(0,0,0,0.2)');
      R(x + 12, y + 22, 40, 5, [226, 214, 190], [0, 0.7, 0]);
      R(x + 14, y + 27, 36, 74, [44, 38, 32], [0, 0.9, 0]);              // reveal
      for (let g = 0; g < 6; g++) { R(x + 8 - g, y + 24 - g, 48 + g * 2, 2, `rgba(40,30,22,${0.05 * (6 - g) / 6})`); R(x + 10 - g, y + 27, 2, 76, `rgba(40,30,22,${0.06 * (6 - g) / 6})`); }
      const gl = jit([74, 92, 104], 0.18);
      R(x + 17, y + 27, 31, 70, gl, [1, 0.06, 0.92]);
      if (r() < 0.3) R(x + 17, y + 27 + 70 * (0.4 + r() * 0.4), 31, 70 * 0.25, [196, 178, 140], [1, 0.5, 0.2]);
      interior(x + 18, y + 28, 29, 68, r() < 0.85, { dark: 0.38 });
      const sash = [226, 222, 212];
      R(x + 17, y + 61, 31, 3, sash, [0, 0.6, 0], [0, 0, 0]); R(x + 17, y + 27, 2, 70, sash, [0, 0.6, 0], [0, 0, 0]); R(x + 46, y + 27, 2, 70, sash, [0, 0.6, 0], [0, 0, 0]);
      R(x + 17, y + 95, 31, 2, sash, [0, 0.6, 0], [0, 0, 0]); R(x + 17, y + 27, 31, 2, sash, [0, 0.6, 0], [0, 0, 0]);
      R(x + 14, y + 97, 36, 4, [40, 34, 28], [0, 0.9, 0], [0, 0, 0]);    // lintel shadow
      for (let g = 0; g < 7; g++) R(x + 17, y + 96 - g * 2, 31, 2, `rgba(0,0,0,${0.32 * (1 - g / 7)})`);
      R(x + 14, y + 101, 36, 6, [214, 200, 174], [0, 0.85, 0]);           // lintel
    }
  }
  // stone frame + big glass bays
  {
    tile(TILE.stoneGlass);
    R(0, 0, 256, 512, [200, 188, 164], [0, 0.82, 0]);
    for (let k = 0; k < 1500; k++) R(r() * 256, r() * 512, 1 + r() * 2, 1 + r() * 2, `rgba(0,0,0,${r() * 0.07})`);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) {
      const x = i * 128, y = j * 128;
      R(x + 14, y + 4, 100, 26, [186, 172, 148]); R(x + 14, y + 29, 100, 1, 'rgba(255,255,255,0.3)');
      R(x + 13, y + 34, 102, 90, [34, 30, 26], [0, 0.9, 0]);
      for (let g = 0; g < 8; g++) R(x + 6 - g, y + 30 - g, 116 + g * 2, 2, `rgba(40,30,22,${0.07 * (8 - g) / 8})`);
      for (let l = 0; l < 3; l++) {
        const lx = x + 15 + l * 33.3, gl = jit([66, 104, 110], 0.15);
        R(lx, y + 36, 31, 86, gl, [1, 0.05, 0.9]);
        if (r() < 0.2) R(lx, y + 80, 31, 42, gl.map(g => g * 0.5 + 90), [1, 0.4, 0.4]);
        interior(lx + 1, y + 37, 29, 84, r() < 0.8, { dark: 0.35 });
      }
      R(x + 13, y + 104, 102, 2, [60, 46, 30], [0, 0.35, 1], [0, 0, 0]);
      for (let l = 1; l < 3; l++) R(x + 14 + l * 33.3, y + 34, 2, 90, [60, 46, 30], [0, 0.35, 1], [0, 0, 0]);
      // pilaster with fluting
      R(x - 13, y, 26, 128, [208, 196, 172], [0, 0.8, 0], [0, 0, 0]);
      for (let g = 0; g < 5; g++) { R(x + 13 + g * 2, y + 34, 2, 90, `rgba(0,0,0,${0.3 * (1 - g / 5)})`); R(x - 15 - g * 2, y + 34, 2, 90, `rgba(0,0,0,${0.18 * (1 - g / 5)})`); }
      for (let fl = -9; fl <= 9; fl += 6) R(x + fl, y + 4, 1, 120, 'rgba(60,50,36,0.25)');
    }
  }
  // precast concrete office (ribbon windows)
  {
    tile(TILE.precast);
    for (let j = 0; j < 4; j++) {
      const y = j * 128;
      R(0, y, 256, 54, [180, 172, 158], [0, 0.86, 0]);
      for (let k = 0; k < 300; k++) R(r() * 256, y + r() * 54, 1 + r() * 3, 1 + r() * 3, `rgba(0,0,0,${r() * 0.08})`);
      R(0, y + 52, 256, 2, 'rgba(0,0,0,0.3)');
      for (let x = 0; x < 256; x += 64) R(x, y, 1, 54, 'rgba(40,30,20,0.25)');
      for (let i = 0; i < 4; i++) {
        const x = i * 64, gl = jit([96, 118, 128], 0.12);
        R(x, y + 54, 64, 68, gl, [1, 0.07, 0.85]);
        if (r() < 0.25) R(x, y + 54 + 30, 64, 38, gl.map(g => g * 0.4 + 110), [1, 0.45, 0.3]);
        interior(x + 1, y + 55, 62, 66, r() < 0.7, { dark: 0.35 });
        R(x - 1, y + 54, 3, 68, [58, 60, 64], [0, 0.4, 1], [0, 0, 0]);
      }
      R(0, y + 122, 256, 6, [190, 182, 168], [0, 0.85, 0], [0, 0, 0]);
    }
  }
  // swatches
  tile(TILE.swatch);
  const sw = (k, col, orm, em) => { const x = (k % 4) * 64, y = Math.floor(k / 4) * 64; R(x, y, 64, 64, col, orm, em || [0, 0, 0]); };
  sw(SW.silver, [186, 190, 196], [0, 0.32, 1]); sw(SW.darkAlu, [58, 60, 66], [0, 0.38, 1]); sw(SW.gold, [224, 168, 84], [0, 0.26, 1]);
  sw(SW.bronze, [112, 80, 50], [0, 0.34, 1]); sw(SW.blackGlass, [26, 28, 34], [0, 0.06, 1]); sw(SW.lime, [208, 194, 168], [0, 0.85, 0]);
  sw(SW.concrete, [150, 146, 140], [0, 0.9, 0]); sw(SW.roof, [120, 118, 112], [0, 0.95, 0]); sw(SW.tar, [44, 43, 42], [0, 0.95, 0]);
  sw(SW.led, [255, 236, 210], [0, 0.5, 0], [255, 196, 120]); sw(SW.red, [200, 30, 20], [0, 0.4, 0], [255, 40, 20]); sw(SW.white, [240, 240, 236], [0, 0.4, 0], [255, 248, 236]);
  sw(SW.blueGlass, [112, 152, 168], [0, 0.05, 1]); sw(SW.goldGlass, [206, 156, 92], [0, 0.06, 1]); sw(SW.granite, [44, 42, 44], [0, 0.45, 0.1]);
  sw(SW.copper, [92, 150, 128], [0, 0.7, 0.25]); sw(SW.interior, [22, 20, 18], [0, 0.9, 0]); sw(SW.paint, [222, 220, 214], [0, 0.7, 0]);
  sw(SW.redPaint, [168, 40, 30], [0, 0.6, 0]); sw(SW.amber, [230, 170, 90], [0, 0.1, 0.9], [255, 170, 80]); sw(SW.cyanLed, [210, 240, 255], [0, 0.4, 0], [150, 220, 255]);
  sw(SW.char, [16, 13, 11], [0, 0.95, 0]);
  return { map: canvasTex(CC, { aniso: 8 }), orm: canvasTex(OC, { srgb: false, aniso: 8 }), em: canvasTex(EC, { aniso: 8 }) };
}

// ------------------------------------------------------------------ store / sign atlas (1024^2 color + emissive)
const STORE_TYPES = ['diner', 'boutique', 'electronics', 'pharmacy', 'jewelry', 'coffee', 'bank', 'grocery'];
const SIGNS = [
  ['GOLDEN HOUR DINER', 0, '#1b120c', '#ffcf6a'], ["ROCCO'S PIZZA", 0, '#7a1410', '#fff1d0'], ['LUCKY STAR NOODLES', 0, '#141414', '#ff4a3a'],
  ['ATELIER NOIR', 1, '#0d0d0d', '#e9e2d4'], ['SKYLINE SHOES', 1, '#24384a', '#ffffff'], ['TITAN TAILORS', 1, '#2a1e14', '#e6c27a'],
  ['KAPOW ELECTRONICS', 2, '#0c1e3c', '#ffd23a'], ['BLAST RECORDS', 2, '#111', '#ff5ac8'], ['NOVA OPTICS', 2, '#e8e8e8', '#14365a'],
  ['HAVEN DRUGS', 3, '#b3161a', '#ffffff'], ['24/7 MART', 3, '#0f5a2e', '#fff6d8'], ['LUXE & CO', 4, '#0a0a0a', '#e3b866'],
  ['GILT WATCHES', 4, '#1a1410', '#f0d18a'], ['DOUBLE SHOT', 5, '#2c1a10', '#f4e3c3'], ['HALO BAKERY', 5, '#f2e6cf', '#7a3a1a'],
  ['BEAN THERE', 5, '#16302a', '#e8d9b0'], ['FIRST HAVEN SAVINGS', 6, '#0d2340', '#e9edf5'], ['BAYSIDE REALTY', 6, '#123', '#9fd3ff'],
  ['MERIDIAN CREDIT', 6, '#0a0a0c', '#d6a94e'], ['FRESH ST DELI', 7, '#1d4a1a', '#fff4c8'], ['CHROME BARBERS', 1, '#1a1a1a', '#d8e4f0'],
  ['PHOENIX FITNESS', 2, '#2a0d06', '#ff8a2a'], ['DUSK & CO FLOWERS', 7, '#3a1530', '#ffd0e8'], ["MAX'S HARDWARE", 7, '#c8a018', '#1a1208'],
];
const SR = { // store atlas regions, canvas px [x, y, w, h] (y down)
  back: (i) => [(i % 4) * 256, Math.floor(i / 4) * 192, 256, 192],
  sign: (i) => [(i % 4) * 256, 384 + Math.floor(i / 4) * 48, 256, 48],
  row: (i) => [i * 512, 672, 512, 128],
  shutter: [0, 800, 256, 128], lobby: [256, 800, 256, 192],
  bill: (i) => [512 + i * 256, 800, 256, 112], logo: [512, 912, 512, 96],
  soot: [0, 928, 128, 96], ember: [128, 928, 128, 96],
};
const srUV = ([x, y, w, h], inset = 1) => [(x + inset) / 1024, 1 - (y + h - inset) / 1024, (x + w - inset) / 1024, 1 - (y + inset) / 1024];
function storeAtlas() {
  const S = 1024;
  const CC = makeCanvas(S, S), c = CC.getContext('2d');
  const r = makeRng(777);
  c.fillStyle = '#222'; c.fillRect(0, 0, S, 900);
  const FONT = (px, w = 400) => `${w} ${px}px Anton, Oswald, Impact, "Arial Narrow", "DejaVu Sans Condensed", sans-serif`;
  const fitText = (txt, x, y, maxW, px, col, w = 400) => {
    c.font = FONT(px, w); const tw = c.measureText(txt).width;
    c.save(); c.translate(x, y); if (tw > maxW) c.scale(maxW / tw, 1); c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 0, 0); c.restore();
  };
  const grad = (x, y, w, h, stops, vert = true) => { const g = vert ? c.createLinearGradient(0, y, 0, y + h) : c.createLinearGradient(x, 0, x + w, 0); stops.forEach(([t, col]) => g.addColorStop(t, col)); c.fillStyle = g; c.fillRect(x, y, w, h); };
  const lamps = (x, y, w, n, col) => { for (let i = 0; i < n; i++) { const lx = x + (i + 0.5) * w / n; c.fillStyle = '#111'; c.fillRect(lx - 1, y, 2, 18); const g = c.createRadialGradient(lx, y + 22, 1, lx, y + 22, 26); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(lx - 26, y, 52, 50); c.fillStyle = '#fff4d8'; c.fillRect(lx - 5, y + 17, 10, 6); } };
  // --- interiors (256x192 each: ~6 m x 3.2 m behind the glass)
  for (let i = 0; i < 8; i++) {
    const [x, y, w, h] = SR.back(i), T = STORE_TYPES[i];
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    if (T === 'diner') {
      grad(x, y, w, h, [[0, '#f6d9a4'], [0.55, '#d79a5a'], [1, '#6a3a20']]);
      c.fillStyle = '#3a2a22'; c.fillRect(x, y + 34, w, 30);                      // menu board band
      for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#ffe8b8' : '#ffd070'; c.fillRect(x + 8 + k * 41, y + 40, 34, 4); c.fillRect(x + 8 + k * 41, y + 48, 24, 3); }
      c.fillStyle = '#c03424'; c.fillRect(x, y + 118, w, 26); c.fillStyle = '#e8e2d8'; c.fillRect(x, y + 114, w, 5);   // counter
      c.fillStyle = '#b8bcc2'; c.fillRect(x, y + 144, w, 4);
      for (let k = 0; k < 9; k++) { c.fillStyle = '#d02a20'; c.fillRect(x + 10 + k * 28, y + 150, 16, 7); c.fillStyle = '#9aa0a6'; c.fillRect(x + 16 + k * 28, y + 157, 3, 24); }
      for (let k = 0; k < 16; k++) for (let l = 0; l < 2; l++) { c.fillStyle = (k + l) % 2 ? '#222' : '#eee'; c.fillRect(x + k * 16, y + 180 + l * 6, 16, 6); }
      lamps(x, y, w, 4, 'rgba(255,220,150,0.9)');
    } else if (T === 'boutique') {
      grad(x, y, w, h, [[0, '#f4ece0'], [1, '#b8a890']]);
      c.fillStyle = '#9a8a74'; c.fillRect(x, y + 168, w, 24);
      for (let k = 0; k < 3; k++) { const mx = x + 40 + k * 80; c.fillStyle = '#e8e0d4'; c.beginPath(); c.arc(mx, y + 70, 9, 0, 7); c.fill(); const col = ['#1a1a1a', '#a01e2a', '#c8b48a'][k]; c.fillStyle = col; c.beginPath(); c.moveTo(mx - 16, y + 82); c.lineTo(mx + 16, y + 82); c.lineTo(mx + 24, y + 160); c.lineTo(mx - 24, y + 160); c.fill(); c.fillStyle = '#333'; c.fillRect(mx - 1, y + 160, 3, 10); }
      c.fillStyle = '#bbb'; c.fillRect(x, y + 40, w, 2);
      for (let k = 0; k < 22; k++) { c.fillStyle = `hsl(${r() * 360},${30 + r() * 40}%,${30 + r() * 40}%)`; c.fillRect(x + 4 + k * 11.5, y + 42, 8, 30 + r() * 14); }
      lamps(x, y, w, 3, 'rgba(255,255,240,0.6)');
    } else if (T === 'electronics') {
      grad(x, y, w, h, [[0, '#20242c'], [1, '#0c0e12']]);
      for (let k = 0; k < 4; k++) for (let l = 0; l < 3; l++) { const tx = x + 8 + k * 62, ty = y + 18 + l * 44; c.fillStyle = '#000'; c.fillRect(tx, ty, 56, 38); grad(tx + 2, ty + 2, 52, 34, [[0, `hsl(${(k * 70 + l * 40) % 360},80%,62%)`], [1, `hsl(${(k * 70 + l * 40 + 60) % 360},70%,35%)`]]); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(tx + 6 + r() * 30, ty + 8 + r() * 14, 12, 8); }
      c.fillStyle = '#d8dce2'; c.fillRect(x, y + 154, w, 8); c.fillStyle = '#2a2e36'; c.fillRect(x, y + 162, w, 30);
      for (let k = 0; k < 10; k++) { c.fillStyle = '#111'; c.fillRect(x + 6 + k * 25, y + 140, 18, 14); c.fillStyle = '#4af'; c.fillRect(x + 8 + k * 25, y + 142, 14, 8); }
    } else if (T === 'pharmacy') {
      grad(x, y, w, h, [[0, '#ffffff'], [1, '#d8dde2']]);
      for (let l = 0; l < 5; l++) { c.fillStyle = '#c8ccd0'; c.fillRect(x, y + 30 + l * 28, w, 3); for (let k = 0; k < 40; k++) { c.fillStyle = `hsl(${r() * 360},${50 + r() * 40}%,${45 + r() * 30}%)`; c.fillRect(x + k * 6.4, y + 14 + l * 28, 5, 14 + r() * 2); } }
      c.fillStyle = '#e0e4e8'; c.fillRect(x, y + 168, w, 24); c.fillStyle = '#1b9a4a'; c.fillRect(x + 110, y + 4, 36, 8); c.fillRect(x + 124, y - 6, 8, 28);
    } else if (T === 'jewelry') {
      grad(x, y, w, h, [[0, '#2a1a10'], [1, '#100a06']]);
      for (let k = 0; k < 3; k++) { const cx = x + 18 + k * 80; grad(cx, y + 104, 62, 50, [[0, '#fff2d0'], [1, '#a07840']]); c.fillStyle = '#3a2414'; c.fillRect(cx, y + 154, 62, 38); for (let g = 0; g < 8; g++) { c.fillStyle = r() < 0.5 ? '#ffe9a8' : '#e8f4ff'; c.fillRect(cx + 4 + r() * 54, y + 116 + r() * 30, 3, 3); } }
      lamps(x, y, w, 5, 'rgba(255,210,140,0.7)');
      c.fillStyle = '#c9a050'; c.fillRect(x + 40, y + 50, 176, 2);
    } else if (T === 'coffee') {
      grad(x, y, w, h, [[0, '#e8b878'], [0.6, '#8a5428'], [1, '#3a2010']]);
      c.fillStyle = '#1e1e1c'; c.fillRect(x + 20, y + 30, 96, 52); c.fillRect(x + 140, y + 30, 96, 52);
      c.fillStyle = '#efe8d8'; for (let k = 0; k < 7; k++) { c.fillRect(x + 28, y + 38 + k * 6, 40 + r() * 40, 2); c.fillRect(x + 148, y + 38 + k * 6, 40 + r() * 40, 2); }
      c.fillStyle = '#5a3418'; c.fillRect(x, y + 128, w, 64); c.fillStyle = '#c0c4c8'; c.fillRect(x + 150, y + 96, 60, 32); c.fillStyle = '#222'; c.fillRect(x + 158, y + 104, 44, 12);
      lamps(x, y, w, 5, 'rgba(255,200,120,0.9)');
    } else if (T === 'bank') {
      grad(x, y, w, h, [[0, '#e8e4dc'], [1, '#9a948a']]);
      c.fillStyle = '#c9c2b4'; for (let k = 0; k < 4; k++) c.fillRect(x + 20 + k * 66, y, 18, h);
      c.fillStyle = '#3a2a1e'; c.fillRect(x + 40, y + 132, 176, 40); c.fillStyle = '#d8b878'; c.fillRect(x + 40, y + 130, 176, 4);
      c.fillStyle = '#2a4a2a'; for (let k = 0; k < 2; k++) { c.beginPath(); c.arc(x + 20 + k * 216, y + 150, 16, 0, 7); c.fill(); }
      fitText('$', x + 128, y + 70, 60, 50, '#b89850');
    } else {
      grad(x, y, w, h, [[0, '#f8f4e8'], [1, '#c8c0a8']]);
      for (let k = 0; k < 3; k++) { grad(x + 6 + k * 84, y + 20, 76, 90, [[0, '#e8fff8'], [1, '#88b0a8']]); for (let l = 0; l < 4; l++) for (let m = 0; m < 6; m++) { c.fillStyle = `hsl(${r() * 60 + (r() < 0.3 ? 180 : 0)},70%,55%)`; c.fillRect(x + 10 + k * 84 + m * 12, y + 26 + l * 22, 9, 16); } }
      for (let k = 0; k < 6; k++) { c.fillStyle = '#7a5a34'; c.fillRect(x + 4 + k * 42, y + 140, 38, 36); for (let f = 0; f < 10; f++) { c.fillStyle = ['#e23a2a', '#f2b81a', '#3aa83a', '#f27a1a'][(k + f) % 4]; c.beginPath(); c.arc(x + 10 + k * 42 + r() * 26, y + 138 + r() * 6, 5, 0, 7); c.fill(); } }
    }
    c.restore();
  }
  // --- signs
  SIGNS.forEach(([name, , bg, fg], i) => {
    const [x, y, w, h] = SR.sign(i);
    c.fillStyle = bg; c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.15)'; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
    c.shadowColor = fg; c.shadowBlur = 8; fitText(name, x + w / 2, y + h / 2 + 2, w - 24, 34, fg); c.shadowBlur = 0;
  });
  // --- cheap shopfront rows (512x128 ~ 16 m x 4 m)
  for (let i = 0; i < 2; i++) {
    const [x, y, w, h] = SR.row(i);
    c.fillStyle = '#2a2622'; c.fillRect(x, y, w, h);
    let sx = x;
    while (sx < x + w - 20) {
      const sw = 110 + r() * 80, e = Math.min(x + w, sx + sw);
      const s = SIGNS[Math.floor(r() * SIGNS.length)];
      c.fillStyle = s[2]; c.fillRect(sx + 6, y + 4, e - sx - 12, 22); fitText(s[0], (sx + e) / 2, y + 16, e - sx - 24, 18, s[3]);
      const bi = s[1]; const [bx, by] = SR.back(bi);
      c.drawImage(CC, bx, by + 20, 256, 150, sx + 6, y + 32, e - sx - 12, 92);
      grad(sx + 6, y + 32, e - sx - 12, 92, [[0, 'rgba(120,150,170,0.35)'], [0.5, 'rgba(255,255,255,0.05)'], [1, 'rgba(20,24,30,0.4)']]);
      c.fillStyle = '#16181a'; for (let m = sx + 6; m < e - 6; m += 40) c.fillRect(m, y + 32, 3, 92);
      c.fillStyle = '#5a5248'; c.fillRect(e - 6, y, 12, h);
      sx = e + 6;
    }
  }
  // --- roll-down shutter with a tag
  {
    const [x, y, w, h] = SR.shutter;
    for (let k = 0; k < h; k += 4) { c.fillStyle = k % 8 ? '#8e9296' : '#6e7276'; c.fillRect(x, y + k, w, 4); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y + k, w, 1); }
    c.save(); c.translate(x + 128, y + 70); c.rotate(-0.08); c.font = FONT(54); c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = '#111'; c.strokeText('BAYHEM', 0, 0); c.fillStyle = '#e8401a'; c.fillText('BAYHEM', 0, 0); c.restore();
    c.fillStyle = 'rgba(40,30,20,0.35)'; c.fillRect(x, y + h - 20, w, 20);
  }
  // --- Meridian lobby (lit reception wall)
  {
    const [x, y, w, h] = SR.lobby;
    grad(x, y, w, h, [[0, '#2a2420'], [0.7, '#14100e'], [1, '#0a0806']]);
    for (let k = 0; k < 8; k++) { c.fillStyle = 'rgba(255,220,160,0.12)'; c.fillRect(x + k * 32, y, 2, h); }
    const g = c.createRadialGradient(x + 128, y + 70, 4, x + 128, y + 70, 90); g.addColorStop(0, 'rgba(255,214,140,0.9)'); g.addColorStop(1, 'rgba(255,180,90,0)'); c.fillStyle = g; c.fillRect(x, y, w, h);
    fitText('M', x + 128, y + 72, 80, 84, '#2a1a08'); c.shadowColor = '#ffd890'; c.shadowBlur = 14; fitText('M', x + 128, y + 70, 80, 80, '#f0c060'); c.shadowBlur = 0;
    c.fillStyle = '#0c0a08'; c.fillRect(x + 60, y + 140, 136, 30); c.fillStyle = '#ffd890'; c.fillRect(x + 60, y + 138, 136, 3);
    c.fillStyle = '#fff2d8'; for (let k = 0; k < 6; k++) c.fillRect(x + 12 + k * 44, y + 4, 24, 4);
    c.fillStyle = '#3a3430'; c.fillRect(x, y + 170, w, 22);
  }
  // --- rooftop billboards
  {
    let [x, y, w, h] = SR.bill(0);
    grad(x, y, w, h, [[0, '#e0281c'], [1, '#7a0c08']], false);
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x + 210, y + 56, 26, 44, 0.3, 0, 7); c.fill(); c.fillStyle = '#c01810'; c.beginPath(); c.ellipse(x + 210, y + 56, 20, 38, 0.3, 0, 7); c.fill();
    fitText('KABOOM', x + 96, y + 46, 170, 60, '#fff3d0'); fitText('COLA  —  TASTE THE BLAST', x + 96, y + 90, 170, 18, '#ffd88a', 700);
    [x, y, w, h] = SR.bill(1);
    grad(x, y, w, h, [[0, '#050506'], [1, '#1e1a14']], false);
    c.strokeStyle = '#d6a94e'; c.lineWidth = 3; c.strokeRect(x + 6, y + 6, w - 12, h - 12);
    fitText('MERIDIAN', x + w / 2, y + 44, 220, 52, '#e8be62'); fitText('TOMORROW BELONGS TO US', x + w / 2, y + 86, 210, 18, '#f4ead8', 700);
  }
  // --- MERIDIAN logo (transparent bg)
  {
    const [x, y, w, h] = SR.logo;
    c.clearRect(x, y, w, h);
    c.font = FONT(84); c.textAlign = 'center'; c.textBaseline = 'middle';
    const letters = 'MERIDIAN'.split(''), cw = w / letters.length;
    letters.forEach((L, i) => { c.save(); c.translate(x + (i + 0.5) * cw, y + h / 2 + 3); const tw = c.measureText(L).width; if (tw > cw * 0.86) c.scale(cw * 0.86 / tw, 1); c.fillStyle = '#ffe2a0'; c.fillText(L, 0, 0); c.restore(); });
  }
  // --- soot + embers (blast hole)
  {
    let [x, y, w, h] = SR.soot;
    c.fillStyle = '#0b0908'; c.fillRect(x, y, w, h);
    for (let k = 0; k < 300; k++) { c.fillStyle = `rgba(${40 + r() * 30},${30 + r() * 20},${20 + r() * 10},${r() * 0.5})`; c.fillRect(x + r() * w, y + r() * h, 1 + r() * 5, 1 + r() * 3); }
    [x, y, w, h] = SR.ember;
    c.fillStyle = '#120804'; c.fillRect(x, y, w, h);
    for (let k = 0; k < 140; k++) { const ex = x + r() * w, ey = y + h * (0.3 + r() * 0.7), rr = 3 + r() * 14; const g = c.createRadialGradient(ex, ey, 0, ex, ey, rr); g.addColorStop(0, r() < 0.4 ? '#fff0a0' : '#ff8a1a'); g.addColorStop(0.5, 'rgba(255,90,10,0.6)'); g.addColorStop(1, 'rgba(60,10,0,0)'); c.fillStyle = g; c.fillRect(ex - rr, ey - rr, rr * 2, rr * 2); }
  }
  // emissive: copy, then black out what does not glow
  const EC = makeCanvas(S, S), e = EC.getContext('2d');
  e.drawImage(CC, 0, 0);
  e.fillStyle = '#000';
  e.fillRect(...SR.shutter); e.fillRect(...SR.soot);
  e.fillStyle = 'rgba(0,0,0,0.45)'; for (let i = 0; i < 2; i++) e.fillRect(...SR.row(i));
  e.fillStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 2; i++) e.fillRect(...SR.bill(i));
  return { map: canvasTex(CC, { repeat: false, aniso: 8 }), em: canvasTex(EC, { repeat: false, aniso: 8 }) };
}

// ------------------------------------------------------------------ materials
const HASH = /* glsl */`
float fhash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;
function facadeMaterial(T) {
  const m = new THREE.MeshStandardMaterial({
    map: T.map, roughnessMap: T.orm, metalnessMap: T.orm, emissiveMap: T.em, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 1, metalness: 1, vertexColors: true, envMapIntensity: 1.15,
  });
  m.userData.duskEmissive = 1.7;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDusk = duskShared;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTile;\nvarying float vTile;\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvTile = aTile;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTile;\nvarying vec3 vWPos;\nuniform float uDusk;\n' + HASH)
      .replace('#include <map_fragment>', /* glsl */`
        float tl = floor(vTile + 0.5);
        vec2 fUv = vMapUv;
        vec2 tileO = vec2(mod(tl, 4.0), floor(tl / 4.0));
        vec2 lf = clamp(fract(fUv), vec2(0.6 / 256.0, 0.6 / 512.0), vec2(1.0 - 0.6 / 256.0, 1.0 - 0.6 / 512.0));
        vec2 aUv = (tileO + lf) * vec2(0.25, 0.5);
        vec2 gdx = dFdx(fUv) * vec2(0.25, 0.5), gdy = dFdy(fUv) * vec2(0.25, 0.5);
        vec4 texelColor = textureGrad(map, aUv, gdx, gdy);
        vec4 ormT = textureGrad(roughnessMap, aUv, gdx, gdy);
        vec3 emT = textureGrad(emissiveMap, aUv, gdx, gdy).rgb;
        float isSw = step(6.5, tl);
        vec2 grid = (tl > 3.5 && tl < 4.5) ? vec2(2.0, 4.0) : vec2(4.0, 4.0);
        vec2 cell = floor(fUv * grid) + tl * 37.0;
        float glassM = ormT.r * (1.0 - isSw);
        float ph = fhash(cell);
        texelColor.rgb *= mix(1.0, 0.8 + 0.38 * ph, glassM);
        diffuseColor *= texelColor;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * ormT.g;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * ormT.b;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 jj = vec2(fhash(cell + 7.1), fhash(cell + 19.3)) - 0.5; normal = normalize(normal + vec3(jj * 0.09 * glassM, 0.0)); }`)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        {
          float zone = fhash(vec2(floor(cell.x / 3.0), cell.y) + 0.37);
          float lk = (tl > 4.5 && tl < 5.5) ? 0.45 : 1.0;   // Meridian: sparse lights, it reads as a dark monolith
          float lit = max(step(zone, 0.3 * lk), step(fhash(cell + 3.3), 0.13 * lk));
          lit = mix(lit, 1.0, isSw);
          float bright = mix(0.45 + 0.95 * fhash(cell + 9.9), 1.0, isSw);
          totalEmissiveRadiance *= emT * lit * bright;
        }`)
      .replace('#include <lights_fragment_maps>', /* glsl */`#include <lights_fragment_maps>
        #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
        {
          // reflected city: the far side of the canyon / the skyline cut into the sky reflection
          vec3 rv = reflect(-geometryViewDir, geometryNormal);
          vec3 rw = normalize((vec4(rv, 0.0) * viewMatrix).xyz);
          float hxz = max(length(rw.xz), 1e-3);
          float across = abs(rw.x) / hxz;
          float az = atan(rw.z, rw.x);
          float n1 = fhash(vec2(floor(az * 34.0), 1.7));
          float hh = clamp(vWPos.y / 190.0, 0.0, 1.0);
          float nearSil = mix(0.9, 0.18, hh) - 0.22 * n1;
          float farSil = 0.02 + 0.2 * n1 * n1;
          float sil = mix(farSil, nearSil, smoothstep(0.5, 0.95, across));
          float m = smoothstep(sil + 0.02, sil - 0.02, rw.y) * glassM;
          float win = step(0.86, fhash(floor(vec2(az * 160.0, rw.y * 110.0))));
          vec3 bc = radiance * 0.16 + vec3(0.022, 0.02, 0.026) + vec3(1.0, 0.6, 0.3) * win * (0.05 + 0.4 * uDusk);
          radiance = mix(radiance, bc, m * 0.85);
          // glass Fresnel: face-on the pane is dark and you see the office, at grazing angles it mirrors the sky
          float ndv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
          float frs = pow(1.0 - ndv, 3.0);
          radiance *= mix(1.0, mix(0.32, 2.3, frs), glassM);
        }
        #endif`);
  };
  m.customProgramCacheKey = () => 'bayhem-facade-v2';
  return m;
}

// ------------------------------------------------------------------ city
const STYLE = {
  glassBlue: { tile: TILE.glassBlue, pier: [0.2, 0.2, 0.22], pierLook: 'granite', parapet: 'metal', tint: [1, 1, 1] },
  glassGold: { tile: TILE.glassGold, pier: [0.24, 0.2, 0.17], pierLook: 'granite', parapet: 'metal', tint: [1, 1, 1] },
  darkFins: { tile: TILE.darkFins, pier: [0.12, 0.12, 0.13], pierLook: 'granite', parapet: 'metal', tint: [1, 1, 1] },
  stone: { tile: TILE.stone, pier: [0.86, 0.8, 0.68], pierLook: 'lime', parapet: 'stone', tint: [1, 1, 1] },
  stoneGlass: { tile: TILE.stoneGlass, pier: [0.8, 0.75, 0.64], pierLook: 'lime', parapet: 'stone', tint: [1, 1, 1] },
};
const COL = {
  lime: [0.86, 0.8, 0.68], granite: [0.16, 0.15, 0.16], conc: [0.62, 0.6, 0.57], dark: [0.1, 0.09, 0.09], roof: [0.4, 0.39, 0.38],
  floor: [0.45, 0.4, 0.36], ceil: [0.95, 0.85, 0.7],
  silver: [0.72, 0.74, 0.77], dalu: [0.16, 0.17, 0.18], black: [0.05, 0.05, 0.055], gold: [0.85, 0.62, 0.3], bronze: [0.35, 0.25, 0.16], galv: [0.55, 0.56, 0.56],
};
const AWNING = [[[0.42, 0.05, 0.04]], [[0.05, 0.22, 0.12]], [[0.04, 0.07, 0.2]], [[0.06, 0.06, 0.06]], [[0.6, 0.05, 0.04], [0.85, 0.82, 0.76]], [[0.04, 0.2, 0.1], [0.85, 0.82, 0.76]], [[0.32, 0.04, 0.12]]];

// atlases + the facade material are shared by buildCity and buildMeridian (5 canvas textures + 1 stone)
let _shared = null;
function shared() {
  if (!_shared) { const fT = facadeAtlas(), sT = storeAtlas(); _shared = { fT, sT, facade: facadeMaterial(fT) }; }
  return _shared;
}
export async function buildCity(ctx) {
  const t0 = performance.now();
  const rng = makeRng(31337);
  const R = (a, b) => a + (b - a) * rng();
  const { fT, sT, facade: facadeMat } = shared();
  const stoneTex = concreteTexture(71, [0.94, 0.92, 0.9], 256, true);
  const mats = {
    facade: facadeMat,
    trim: new THREE.MeshStandardMaterial({ map: stoneTex, vertexColors: true, roughness: 0.86, metalness: 0, envMapIntensity: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.85, envMapIntensity: 1.0 }),
    store: new THREE.MeshStandardMaterial({ map: sT.map, emissiveMap: sT.em, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.55, metalness: 0, alphaTest: 0.5, vertexColors: true }),
  };
  mats.store.userData.duskEmissive = 1.5;
  const B = { facade: new Batch(), trim: new Batch(), metal: new Batch(), store: new Batch(), far: new Batch() };
  const colliders = [], panes = [], roofs = [], signs = [], glows = [];
  const col = (min, max, kind = 'building', mat = 'concrete') => colliders.push({ min, max, data: { kind, mat } });
  const colA = (bb, kind, mat) => col(bb.min, bb.max, kind, mat);
  const avoid = [];   // keep-out rects for clutter [x0,z0,x1,z1]

  // ---------------- storefront (recessed shops, piers, signs, awnings, shutters) ----------------
  function storefront(f, o) {
    const r = makeRng(o.seed);
    const len = f.len, cs = o.cornerStart ? 1.3 : 0.8, ce = o.cornerEnd ? 1.3 : 0.8;
    const avail = len - cs - ce;
    if (avail < 2.2) { pier(0, len, true, true); return; }
    const n = Math.max(1, Math.round(avail / (o.shopW || 7.2)));
    const pw = 0.7;
    const shopTotal = avail - (n - 1) * pw;
    const ws = []; let sum = 0;
    for (let i = 0; i < n; i++) { const w = 0.75 + r() * 0.5; ws.push(w); sum += w; }
    let s = 0;
    pier(0, cs, o.cornerStart, false);
    s = cs;
    for (let i = 0; i < n; i++) {
      const w = ws[i] / sum * shopTotal;
      shop(s, s + w, r);
      s += w;
      if (i < n - 1) { pier(s, s + pw, false, false); s += pw; }
    }
    pier(s, len, false, o.cornerEnd);
    // frieze over the shops, belt course
    lbox(B.trim, f, 0, len, -0.06, RECESS, PANE_Y1 + 0.15, SF - 0.3, { c: o.frieze || o.pierC, skip: 'y' });
    lbox(B.trim, f, -0.02, len + 0.02, -0.28, RECESS, SF - 0.3, SF + 0.12, { c: o.belt || COL.lime });
    colA(lAABB(f, 0, len, 0, RECESS, PANE_Y1, o.top), 'building', 'concrete');

    function pier(a, b, cA, cB) {
      const d1 = (cA || cB) ? 1.3 : RECESS;
      lbox(B.trim, f, a, b, -0.12, d1, PANE_Y0, PANE_Y1 + 0.15, { c: o.pierC, skip: 'y' });
      lbox(B.trim, f, a - 0.03, b + 0.03, -0.17, d1, 0, PANE_Y0, { c: COL.granite, skip: 'y' });
      colA(lAABB(f, a, b, 0, d1, 0, PANE_Y1 + 0.15), 'building', 'concrete');
    }
    function shop(s0, s1, r) {
      const si = Math.floor(r() * SIGNS.length), type = SIGNS[si][1];
      const shutter = r() < (o.shutterP ?? 0.12);
      lbox(B.trim, f, s0, s1, 0, 0.32, 0, PANE_Y0, { c: COL.granite, skip: 'y' });
      if (shutter) {
        lwall(B.store, f, s0, s1, PANE_Y0, PANE_Y1, 0.02, { uv: srUV(SR.shutter) });
        lbox(B.metal, f, s0, s1, -0.1, 0.3, PANE_Y1, PANE_Y1 + 0.32, { c: COL.galv });
        colA(lAABB(f, s0, s1, 0, RECESS, 0, PANE_Y1), 'building', 'metal');
      } else {
        const np = Math.max(1, Math.round((s1 - s0) / 2.45)), w = (s1 - s0) / np;
        for (let k = 1; k < np; k++) lbox(B.metal, f, s0 + k * w - 0.05, s0 + k * w + 0.05, -0.05, 0.1, PANE_Y0, PANE_Y1, { c: o.mull || COL.dalu, skip: 'yY' });
        lbox(B.metal, f, s0, s1, -0.05, 0.14, PANE_Y1, PANE_Y1 + 0.15, { c: o.mull || COL.dalu, skip: 'Y' });
        lbox(B.metal, f, s0, s1, -0.05, 0.14, PANE_Y0 - 0.06, PANE_Y0, { c: o.mull || COL.dalu, skip: 'y' });
        if (o.panes !== false) for (let k = 0; k < np; k++) {
          const c = LP(f, s0 + (k + 0.5) * w, 0, (PANE_Y0 + PANE_Y1) / 2);
          panes.push({ c, n: [f.nx, 0, f.nz], w: +(w - 0.1).toFixed(3), h: PANE_Y1 - PANE_Y0, kind: 'store' });
        }
        // interior: lit backdrop, floor, ceiling, a display riser
        lwall(B.store, f, s0, s1, 0.15, PANE_Y1, RECESS, { uv: srUV(SR.back(type), 3) });
        lbox(B.trim, f, s0, s1, 0.32, RECESS, 0, 0.17, { c: COL.floor, skip: 'yzZxX' });
        q(B.trim, LP(f, s0, RECESS, PANE_Y1), [f.dx * (s1 - s0), 0, f.dz * (s1 - s0)], [f.nx * RECESS, 0, f.nz * RECESS], { c: COL.ceil, sw: undefined });
        if (r() < 0.55) lbox(B.trim, f, s0 + 0.3, s1 - 0.3, 0.34, RECESS - 0.04, 0.15, 0.75 + r() * 0.3, { c: [0.3 + r() * 0.5, 0.25 + r() * 0.3, 0.2 + r() * 0.2], skip: 'y' });
      }
      // sign board
      const sa = s0 + 0.25, sb = s1 - 0.25;
      lbox(B.metal, f, sa - 0.04, sb + 0.04, -0.16, -0.02, PANE_Y1 + 0.3, SF - 0.42, { c: COL.black });
      lwall(B.store, f, sa, sb, PANE_Y1 + 0.34, SF - 0.46, -0.165, { uv: srUV(SR.sign(si), 2) });
      const sp = LP(f, (sa + sb) / 2, -0.2, (PANE_Y1 + SF) / 2 - 0.06);
      signs.push({ p: sp, n: [f.nx, 0, f.nz], w: sb - sa, name: SIGNS[si][0] });
      // awning
      if (!shutter && r() < (o.awningP ?? 0.4)) {
        const pal = AWNING[Math.floor(r() * AWNING.length)];
        const out = 1.35, drop = 0.5, yA = PANE_Y1 + 0.12, ns = pal.length > 1 ? Math.max(2, Math.round((s1 - s0) / 0.5)) : 1;
        for (let k = 0; k < ns; k++) {
          const a0 = s0 + 0.1 + (s1 - s0 - 0.2) * k / ns, a1 = s0 + 0.1 + (s1 - s0 - 0.2) * (k + 1) / ns, c = pal[k % pal.length];
          const o0 = LP(f, a0, 0, yA), av = [f.dx * (a1 - a0), 0, f.dz * (a1 - a0)], bv = [f.nx * out, -drop, f.nz * out];
          B.trim.quad(o0, bv, av, [0, 0, 1, 1], 7, c); B.trim.quad(o0, av, bv, [0, 0, 1, 1], 7, c.map(v => v * 0.6));
          const o1 = LP(f, a0, -out, yA - drop - 0.28), vv = [0, 0.28, 0];
          B.trim.quad(o1, av, vv, [0, 0, 1, 1], 7, c); B.trim.quad(o1, vv, av, [0, 0, 1, 1], 7, c.map(v => v * 0.5));
        }
        for (const s of [s0 + 0.12, s1 - 0.12]) beam(B.metal, LP(f, s, 0, yA - 0.05), LP(f, s, -out, yA - drop), 0.04, 0.04, { c: COL.black });
      }
    }
  }
  // cheap frontage: painted shop row + piers (for blocks out of reach)
  function cheapFront(f, seed, pierC) {
    const r = makeRng(seed);
    let s = 0;
    while (s < f.len - 0.5) {
      const w = Math.min(f.len - s, 10 + r() * 6);
      const ri = Math.floor(r() * 2), u0 = r() * 0.3;
      const [x, y, ww, hh] = SR.row(ri);
      const uvw = Math.min(1, w / 16);
      lwall(B.store, f, s, s + w, 0, 4.2, 0.35, { uv: [(x + u0 * ww) / 1024, 1 - (y + hh) / 1024, (x + (u0 + uvw * 0.7) * ww) / 1024, 1 - y / 1024] });
      lbox(B.trim, f, s, s + 0.6, -0.1, 0.35, 0, 4.2, { c: pierC, skip: 'yY' });
      s += w;
    }
    lbox(B.trim, f, 0, f.len, -0.1, 0.35, 4.2, SF, { c: pierC, skip: 'y' });
  }
  // generic facade wall on a face
  const isStoneT = (t) => t === TILE.stone || t === TILE.stoneGlass || t === TILE.precast;
  const fwall = (f, y0, y1, tile, uo = 0, yb = 0, c = WHITE) => {
    if (y1 <= y0 + 0.01) return;
    const ao = isStoneT(tile) ? { ao: 4.2, aoK: 0.42, aoB: y0 > 1 ? 1.8 : 0, aoBk: 0.55 } : { ao: 1.2, aoK: 0.7 };
    lwall(B.facade, f, 0, f.len, y0, y1, 0, { tile, u0: uo, yb, c, ...ao });
  };
  // roof clutter on a rect
  function clutter(x0, z0, x1, z1, y, seed, opts = {}) {
    const r = makeRng(seed);
    const xs = [Math.min(x0, x1), Math.max(x0, x1)], zs = [Math.min(z0, z1), Math.max(z0, z1)];
    const placed = [];
    const free = (a, b, c, d, pad = 0.6) => {
      if (a < xs[0] + 0.6 || c > xs[1] - 0.6 || b < zs[0] + 0.6 || d > zs[1] - 0.6) return false;
      if (Math.min(Math.abs(a), Math.abs(c)) < AVE.half + 2.2) return false;      // keep the avenue edge clean for snipers
      for (const k of [...avoid, ...placed]) if (a < k[2] + pad && c > k[0] - pad && b < k[3] + pad && d > k[1] - pad) return false;
      return true;
    };
    const tryPlace = (w, d, fn, tall = false) => {
      for (let t = 0; t < 14; t++) {
        const cx = R(xs[0], xs[1]), cz = R(zs[0], zs[1]);
        const a = cx - w / 2, c = cx + w / 2, b = cz - d / 2, e = cz + d / 2;
        if (tall && Math.min(Math.abs(a), Math.abs(c)) < AVE.half + 6) continue;
        if (!free(a, b, c, e)) continue;
        placed.push([a, b, c, e]); fn(cx, cz); return true;
      }
      return false;
    };
    const area = (xs[1] - xs[0]) * (zs[1] - zs[0]);
    const nAC = Math.min(7, Math.round(area / 110));
    for (let i = 0; i < nAC; i++) {
      const rot = r() < 0.5, w = rot ? 2.4 : 1.6, d = rot ? 1.6 : 2.4;
      tryPlace(w, d, (cx, cz) => {
        const h = 1.3 + r() * 0.3;
        box(B.metal, cx - w / 2, y, cz - d / 2, cx + w / 2, y + h, cz + d / 2, { c: COL.galv, skip: 'y' });
        box(B.metal, cx - w / 2 - 0.05, y, cz - d / 2 - 0.05, cx + w / 2 + 0.05, y + 0.15, cz + d / 2 + 0.05, { c: COL.dalu, skip: 'yY' });
        for (const k of [-0.25, 0.25]) B.metal.geo(FAN, new THREE.Matrix4().makeTranslation(cx + (rot ? k * w : 0), y + h + 0.06, cz + (rot ? 0 : k * d)), { sw: SW.darkAlu, c: COL.dalu });
        col([cx - w / 2, y, cz - d / 2], [cx + w / 2, y + h, cz + d / 2], 'building', 'metal');
      });
    }
    for (let i = 0; i < Math.round(area / 90); i++) tryPlace(0.8, 0.8, (cx, cz) => {
      const h = 0.6 + r() * 1.2;
      B.metal.geo(VENT, new THREE.Matrix4().compose(new THREE.Vector3(cx, y + h / 2, cz), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)), { sw: SW.silver, c: COL.galv });
      B.metal.geo(VCAP, new THREE.Matrix4().makeTranslation(cx, y + h + 0.12, cz), { sw: SW.silver, c: COL.galv });
    });
    if (opts.stair !== false) tryPlace(3.2, 3.2, (cx, cz) => {
      box(B.trim, cx - 1.6, y, cz - 1.6, cx + 1.6, y + 2.8, cz + 1.6, { c: opts.stairC || COL.conc, skip: 'y' });
      box(B.metal, cx - 1.75, y + 2.8, cz - 1.75, cx + 1.75, y + 2.95, cz + 1.75, { c: COL.dalu, skip: 'y' });
      col([cx - 1.6, y, cz - 1.6], [cx + 1.6, y + 2.95, cz + 1.6]);
    }, true);
    if (opts.duct) tryPlace(7, 0.9, (cx, cz) => {
      box(B.metal, cx - 3.5, y + 0.5, cz - 0.4, cx + 3.5, y + 1.2, cz + 0.4, { c: COL.galv });
      for (const k of [-3, 0, 3]) box(B.metal, cx + k - 0.05, y, cz - 0.3, cx + k + 0.05, y + 0.5, cz + 0.3, { c: COL.dalu, skip: 'y' });
      col([cx - 3.5, y, cz - 0.4], [cx + 3.5, y + 1.2, cz + 0.4], 'building', 'metal');
    });
    if (opts.tank) tryPlace(5.2, 5.2, (cx, cz) => waterTank(cx, y, cz, r), true);
    if (opts.antenna) tryPlace(1.2, 1.2, (cx, cz) => {
      const h = 6 + r() * 8;
      B.metal.geo(MAST, new THREE.Matrix4().compose(new THREE.Vector3(cx, y + h / 2, cz), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)), { sw: SW.silver, c: COL.silver });
      box(B.metal, cx - 0.5, y + h * 0.7, cz - 0.04, cx + 0.5, y + h * 0.7 + 0.08, cz + 0.04, { c: COL.silver });
      glows.push({ p: [cx, y + h + 0.2, cz], color: [3, 0.25, 0.12], size: 1.2, blink: true, far: true });
    }, true);
  }
  function waterTank(cx, y, cz, r) {
    const legH = 3.2, h = 4.4, rad = 2.3;
    for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]]) box(B.metal, cx + dx - 0.12, y, cz + dz - 0.12, cx + dx + 0.12, y + legH, cz + dz + 0.12, { c: COL.dalu, skip: 'y' });
    beam(B.metal, [cx - 1.5, y + 0.3, cz - 1.5], [cx + 1.5, y + legH - 0.2, cz + 1.5], 0.06, 0.06, { c: COL.dalu });
    beam(B.metal, [cx + 1.5, y + 0.3, cz - 1.5], [cx - 1.5, y + legH - 0.2, cz + 1.5], 0.06, 0.06, { c: COL.dalu });
    box(B.trim, cx - 2, y + legH, cz - 2, cx + 2, y + legH + 0.2, cz + 2, { c: [0.3, 0.22, 0.16] });
    B.trim.geo(TANK, new THREE.Matrix4().makeTranslation(cx, y + legH + 0.2 + h / 2, cz), { c: [0.52, 0.38, 0.26], uvS: 2.5 });
    B.trim.geo(TANKROOF, new THREE.Matrix4().makeTranslation(cx, y + legH + 0.2 + h + 0.7, cz), { c: [0.25, 0.2, 0.16], uvS: 2 });
    for (const k of [0.25, 0.6, 0.9]) B.metal.geo(TANKBAND, new THREE.Matrix4().makeTranslation(cx, y + legH + 0.2 + h * k, cz), { sw: SW.darkAlu, c: COL.dalu });
    col([cx - 2.3, y, cz - 2.3], [cx + 2.3, y + legH + h + 1.4, cz + 2.3], 'building', 'metal');
  }
  function billboard(cx, y, cz, w, h, nz, nx, region, lit = true) {
    // panel faces (nx, nz); frame behind it
    const f = nz !== 0 ? mkFace(nz > 0 ? '+z' : '-z', cz, cx - w / 2, cx + w / 2) : mkFace(nx > 0 ? '+x' : '-x', cx, cz - w / 2, cz + w / 2);
    const yb = y + 3.2;
    lwall(B.store, f, 0, f.len, yb, yb + h, 0, { uv: srUV(region, 2) });
    lbox(B.metal, f, -0.15, f.len + 0.15, 0.01, 0.25, yb - 0.15, yb + h + 0.15, { c: COL.dalu });
    for (let s = 0.6; s < f.len; s += (f.len - 1.2) / 3) {
      lbox(B.metal, f, s - 0.12, s + 0.12, 1.2, 1.45, y, yb + h - 0.3, { c: COL.dalu, skip: 'y' });
      beam(B.metal, LP(f, s, 1.3, y), LP(f, s, 0.3, yb + h * 0.6), 0.1, 0.1, { c: COL.dalu });
    }
    lbox(B.metal, f, -0.2, f.len + 0.2, -0.9, 0.3, yb - 0.4, yb - 0.32, { c: COL.galv });   // catwalk
    for (let s = 1.5; s < f.len; s += (f.len - 3) / 2) {
      beam(B.metal, LP(f, s, 0.1, yb + h + 0.1), LP(f, s, -1.1, yb + h + 0.5), 0.06, 0.06, { c: COL.black });
      lbox(B.metal, f, s - 0.25, s + 0.25, -1.3, -0.9, yb + h + 0.3, yb + h + 0.55, { c: COL.black });
      if (lit) glows.push({ p: LP(f, s, -1.1, yb + h + 0.28), color: [2.4, 1.8, 1.2], size: 0.9, dusk: true });
    }
    const bb = lAABB(f, -0.2, f.len + 0.2, -1.3, 1.45, y, yb + h + 0.6);
    colA(bb, 'building', 'metal');
    signs.push({ p: LP(f, f.len / 2, -0.1, yb + h / 2), n: [f.nx, 0, f.nz], w, billboard: true });
  }
  const FAN = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 12);
  const VENT = new THREE.CylinderGeometry(0.22, 0.22, 1, 8, 1, true);
  const VCAP = new THREE.ConeGeometry(0.4, 0.25, 8);
  const MAST = new THREE.CylinderGeometry(0.06, 0.1, 1, 6, 1, true);
  const TANK = new THREE.CylinderGeometry(2.3, 2.3, 4.4, 14, 1, true);
  const TANKROOF = new THREE.ConeGeometry(2.45, 1.4, 14);
  const TANKBAND = new THREE.CylinderGeometry(2.34, 2.34, 0.08, 14, 1, true);
  const SPIRE = new THREE.CylinderGeometry(0.08, 0.6, 1, 8, 1, true);

  // sniper keep-out
  for (const s of Object.values(SNIPERS)) avoid.push([s.x - 1.5, s.z - 2.5, s.x + 1.5, s.z + 2.5]);

  // ---------------- towers ----------------
  function aviation(x, y, z) { glows.push({ p: [x, y, z], color: [3.2, 0.22, 0.1], size: 2.6, blink: true, far: true, rate: 2.6 }); }
  function tower(L, x0, x1, z0, z1, y0, H, seed) {
    const r = makeRng(seed);
    const st = L.style, tile = STYLE[st].tile, uo = Math.floor(r() * 16) / 4, vo = Math.floor(r() * 4);
    const O = { tile, uo, yb: y0, vo, ...(st === 'stone' ? { ao: 4.2, aoK: 0.45 } : {}) };
    // keep-out for podium clutter
    avoid.push([x0 - 1, z0 - 1, x1 + 1, z1 + 1]);
    col([x0, y0, z0], [x1, H, z1], 'building', st.startsWith('stone') ? 'concrete' : 'glass');
    const top = [];
    if (st === 'glassBlue') {
      const H1 = L.crown ? H * 0.8 : H * 0.84;
      prism(B.facade, rectPoly(x0, z0, x1, z1), y0, H1, O, { sw: SW.roof });
      // setback tier: inset 2.5 m toward the avenue + ends
      const ix = L.side > 0 ? [x0 + 3, x1 - 1.5] : [x0 + 1.5, x1 - 3];
      const t = [ix[0], z0 + 2.5, ix[1], z1 - 2.5];
      box(B.facade, x0 - 0.15, H1 - 0.6, z0 - 0.15, x1 + 0.15, H1 + 0.25, z1 + 0.15, { sw: SW.silver, skip: 'y' });
      if (L.crown) {
        const H2 = H - 22;
        prism(B.facade, rectPoly(...t), H1, H2, { ...O, uo: uo + 0.5 }, null);
        // glass crown: a slanted wedge rising toward the back, LED edges, spire
        const [a0, b0, a1, b1] = t, yb = H2, hh = 22;
        const front = L.side > 0 ? a0 : a1, back = L.side > 0 ? a1 : a0;
        const P = (x, y, z) => [x, y, z];
        const yF = yb + 6;
        // front low face, back high face, slanted roof
        const sideQuad = (zz, nzs) => {
          const pts = [P(front, yb, zz), P(back, yb, zz), P(back, yb + hh, zz), P(front, yF, zz)];
          const uv = SWQ(SW.blueGlass); const u = [uv[0], uv[1]];
          B.facade.tri(pts[0], pts[1], pts[2], [u, u, u], 7, WHITE, [0, 0, nzs]); B.facade.tri(pts[0], pts[2], pts[3], [u, u, u], 7, WHITE, [0, 0, nzs]);
        };
        sideQuad(b0, -1); sideQuad(b1, 1);
        const fw = (xx, y1, nxs) => { const ff = mkFace(nxs > 0 ? '+x' : '-x', xx, b0, b1); lwall(B.facade, ff, 0, ff.len, yb, y1, 0, { tile: TILE.glassBlue, u0: 0, yb }); };
        fw(front, yF, front > back ? 1 : -1); fw(back, yb + hh, back > front ? 1 : -1);
        // slanted glass roof
        { const uv = SWQ(SW.blueGlass); const u = [uv[0], uv[1]]; const p0 = P(front, yF, b0), p1 = P(front, yF, b1), p2 = P(back, yb + hh, b1), p3 = P(back, yb + hh, b0);
          B.facade.tri(p0, p1, p2, [u, u, u], 7, WHITE, [0, 1, 0]); B.facade.tri(p0, p2, p3, [u, u, u], 7, WHITE, [0, 1, 0]); }
        for (const zz of [b0, b1]) beam(B.facade, [front, yF + 0.2, zz], [back, yb + hh + 0.2, zz], 0.35, 0.35, { sw: SW.led });
        for (let zz = b0 + 3; zz < b1 - 1; zz += 3) beam(B.facade, [front, yF + 0.15, zz], [back, yb + hh + 0.15, zz], 0.18, 0.25, { sw: SW.silver });
        box(B.facade, front - 0.2, yF - 0.2, b0, front + 0.2, yF + 0.3, b1, { sw: SW.led });
        // spire
        B.metal.geo(SPIRE, new THREE.Matrix4().compose(new THREE.Vector3(back, yb + hh + 15, (b0 + b1) / 2), new THREE.Quaternion(), new THREE.Vector3(1, 30, 1)), { sw: SW.silver, c: COL.silver });
        aviation(back, yb + hh + 30.5, (b0 + b1) / 2);
        top.push([back, yb + hh, b0], [back, yb + hh, b1]);
      } else {
        prism(B.facade, rectPoly(...t), H1, H - 5, { ...O, uo: uo + 0.5 }, { sw: SW.roof });
        // mechanical screen of fins
        const [a0, b0, a1, b1] = [t[0] + 1.5, t[1] + 1.5, t[2] - 1.5, t[3] - 1.5];
        prism(B.facade, rectPoly(a0, b0, a1, b1), H - 5, H, { sw: SW.darkAlu }, { sw: SW.tar });
        for (let x = a0; x <= a1 + 0.01; x += 1.2) for (const z of [b0, b1]) box(B.facade, x - 0.08, H - 5, z - 0.35, x + 0.08, H + 0.6, z + 0.35, { sw: SW.silver, skip: 'y' });
        for (let z = b0 + 1.2; z < b1; z += 1.2) for (const x of [a0, a1]) box(B.facade, x - 0.35, H - 5, z - 0.08, x + 0.35, H + 0.6, z + 0.08, { sw: SW.silver, skip: 'y' });
        top.push([a0, H + 0.6, b0], [a1, H + 0.6, b1]);
      }
    } else if (st === 'glassGold') {
      const c = 3.5, H1 = H * 0.86;
      prism(B.facade, octPoly(x0, z0, x1, z1, c), y0, H1, O, { sw: SW.roof });
      box(B.facade, x0 + 0.5, H1 - 0.3, z0 + 0.5, x1 - 0.5, H1 + 0.6, z1 - 0.5, { sw: SW.gold, skip: 'y' });
      const t = [x0 + 2.5, z0 + 2.5, x1 - 2.5, z1 - 2.5];
      prism(B.facade, octPoly(...t, c), H1 + 0.6, H - 6, { ...O, uo: uo + 0.25 }, { sw: SW.roof });
      // crown: gold band with an LED reveal + a taller lantern
      prism(B.facade, octPoly(t[0] - 0.4, t[1] - 0.4, t[2] + 0.4, t[3] + 0.4, c), H - 6, H - 1.2, { sw: SW.gold }, { sw: SW.tar });
      prism(B.facade, octPoly(t[0] - 0.2, t[1] - 0.2, t[2] + 0.2, t[3] + 0.2, c), H - 1.2, H - 0.6, { sw: SW.led }, null);
      prism(B.facade, octPoly(t[0] - 0.4, t[1] - 0.4, t[2] + 0.4, t[3] + 0.4, c), H - 0.6, H, { sw: SW.gold }, { sw: SW.tar });
      const cx = (t[0] + t[2]) / 2, cz = (t[1] + t[3]) / 2;
      prism(B.facade, octPoly(cx - 4, cz - 4, cx + 4, cz + 4, 1.5), H, H + 7, { sw: SW.goldGlass }, { sw: SW.gold });
      B.metal.geo(SPIRE, new THREE.Matrix4().compose(new THREE.Vector3(cx, H + 7 + 6, cz), new THREE.Quaternion(), new THREE.Vector3(0.6, 12, 0.6)), { sw: SW.silver, c: COL.silver });
      aviation(cx, H + 19.4, cz);
      top.push([t[0], H, t[1]], [t[2], H, t[3]]);
    } else if (st === 'darkFins') {
      prism(B.facade, rectPoly(x0, z0, x1, z1), y0, H, O, { sw: SW.tar });
      // vertical aluminium fins, running past the roof into a crown screen
      for (let x = x0 + 0.75; x < x1; x += 1.5) for (const [z, s] of [[z0, -1], [z1, 1]]) box(B.facade, x - 0.07, y0, z, x + 0.07, H + 5, z + s * 0.55, { sw: SW.silver, skip: 'y' });
      for (let z = z0 + 0.75; z < z1; z += 1.5) for (const [x, s] of [[x0, -1], [x1, 1]]) box(B.facade, x, y0, z - 0.07, x + s * 0.55, H + 5, z + 0.07, { sw: SW.silver, skip: 'y' });
      box(B.facade, x0 - 0.6, H + 4.4, z0 - 0.6, x1 + 0.6, H + 5.2, z1 + 0.6, { sw: SW.darkAlu, skip: 'y' });
      box(B.facade, x0 + 3, H, z0 + 3, x1 - 3, H + 3.5, z1 - 3, { sw: SW.darkAlu, skip: 'y', top: { sw: SW.tar } });
      top.push([x0, H + 5.2, z0], [x1, H + 5.2, z1]);
    } else if (st === 'stone') {
      // wedding cake setbacks with cornices, copper pyramid and flagpole
      const tiers = [[0, H * 0.62], [2.4, H * 0.82], [4.8, H * 0.93]];
      let yy = y0;
      for (const [ins, ht] of tiers) {
        const a = [x0 + ins, z0 + ins, x1 - ins, z1 - ins];
        prism(B.facade, rectPoly(...a), yy, ht, { ...O, uo: uo + ins / 7.2 }, { sw: SW.roof });
        box(B.facade, a[0] - 0.45, ht - 0.9, a[1] - 0.45, a[2] + 0.45, ht, a[3] + 0.45, { sw: SW.lime, skip: 'y' });
        box(B.facade, a[0] - 0.2, ht - 1.4, a[1] - 0.2, a[2] + 0.2, ht - 0.9, a[3] + 0.2, { sw: SW.lime, skip: 'yY' });
        box(B.facade, a[0] - 0.05, ht, a[1] - 0.05, a[2] + 0.05, ht + 0.9, a[3] + 0.05, { sw: SW.lime, skip: 'y' });
        yy = ht;
      }
      const a = [x0 + 6.4, z0 + 6.4, x1 - 6.4, z1 - 6.4], cx = (a[0] + a[2]) / 2, cz = (a[1] + a[3]) / 2;
      const ap = [cx, H - 1, cz], u = swUV(SW.copper);
      const cs = [[a[0], yy, a[1]], [a[2], yy, a[1]], [a[2], yy, a[3]], [a[0], yy, a[3]]];
      for (let i = 0; i < 4; i++) { const p = cs[i], n = cs[(i + 1) % 4]; const out = [(p[0] + n[0]) / 2 - cx, 0.6, (p[2] + n[2]) / 2 - cz]; B.facade.tri(p, n, ap, [u, u, u], 7, WHITE, out); }
      B.metal.geo(SPIRE, new THREE.Matrix4().compose(new THREE.Vector3(cx, H + 5, cz), new THREE.Quaternion(), new THREE.Vector3(0.4, 12, 0.4)), { sw: SW.gold, c: COL.gold });
      aviation(cx, H + 11.3, cz);
      // water tanks on the setbacks
      waterTank(x0 + 3.5, tiers[0][1], z1 - 3.5, r);
      top.push([a[0], H, a[1]], [a[2], H, a[3]]);
    }
    for (const p of top) aviation(p[0], p[1] + 0.4, p[2]);
  }

  // ---------------- avenue lots ----------------
  const lotById = Object.fromEntries(LOTS.map(L => [L.id, L]));
  const neighbour = (L, zEdge) => LOTS.find(K => K !== L && K.side === L.side && (K.z[0] === zEdge || K.z[1] === zEdge));
  let seed = 100;
  for (const L of LOTS) {
    seed += 17;
    const side = L.side, [zN, zS] = L.z, P = L.podium, sty = STYLE[L.style];
    const xa = side * AVE.half, xb = side * (AVE.half + L.depth), xmin = Math.min(xa, xb), xmax = Math.max(xa, xb);
    const uoP = Math.floor(makeRng(seed)() * 8) / 4;
    if (!L.lobby) {
      const ave = mkFace(side > 0 ? '-x' : '+x', xa, zS, zN);
      const crossN = zN === CROSS.z0, crossS = zS === CROSS.z1, plazaS = zS === PLAZA.z1;
      const sfo = (sd, ce, cs) => ({ seed: sd, pierC: sty.pier, top: P, cornerStart: cs, cornerEnd: ce, belt: L.style.startsWith('stone') ? COL.lime : COL.dalu, frieze: L.style.startsWith('stone') ? COL.lime : [0.14, 0.14, 0.15], mull: L.style === 'glassGold' ? COL.bronze : COL.dalu });
      // avenue storefront: corners at the cross street / plaza ends
      const cornerAtStart = side > 0 ? (crossS || plazaS) : crossN;   // face origin: right side starts at zS, left side starts at zN
      const cornerAtEnd = side > 0 ? crossN : (crossS || plazaS);
      storefront(ave, sfo(seed, cornerAtEnd, cornerAtStart));
      fwall(ave, SF + 0.12, P, sty.tile, uoP, SF);
      const sideFaces = [];
      // z-end faces
      const nf = mkFace('+z', zN, xmin, xmax), sf = mkFace('-z', zS, xmin, xmax);
      for (const [f, street, edge] of [[nf, crossN, zN], [sf, crossS || plazaS, zS]]) {
        if (street) {
          const cornerHere = f === nf ? (side > 0 ? 'start' : 'end') : (side > 0 ? 'end' : 'start');
          // on cross street faces the avenue corner is at x = +-16
          storefront(f, { ...sfo(seed + 3 + (f === nf ? 1 : 2), cornerHere === 'end', cornerHere === 'start'), shopW: 7.8 });
          fwall(f, SF + 0.12, P, sty.tile, uoP + 0.5, SF);
        } else {
          const nb = neighbour(L, edge);
          const y0 = nb ? Math.min(P, nb.lobby ? LOBBY.roofY : nb.podium) : 0;
          fwall(f, y0, P, sty.tile, uoP, SF);
        }
      }
      // back face
      fwall(mkFace(side > 0 ? '+x' : '-x', xb, zS, zN), 0, P, sty.tile, uoP, SF);
      // podium pilasters on stone styles (relief)
      if (L.style.startsWith('stone')) {
        const step = L.style === 'stone' ? 7.2 : 6;
        for (let s = step; s < ave.len - 1; s += step) lbox(B.trim, ave, s - 0.3, s + 0.3, -0.22, 0, SF + 0.12, P - 0.9, { c: COL.lime, skip: 'yY' });
        lbox(B.trim, ave, -0.1, ave.len + 0.1, -0.6, 0.3, P - 0.9, P, { c: COL.lime });
        lbox(B.trim, ave, -0.05, ave.len + 0.05, -0.32, 0.3, P - 1.4, P - 0.9, { c: [0.78, 0.72, 0.6], skip: 'Y' });
      } else {
        lbox(B.metal, ave, -0.05, ave.len + 0.05, -0.18, 0.2, P - 0.45, P, { c: L.style === 'glassGold' ? COL.bronze : COL.silver, skip: 'y' });
      }
      // roof deck + parapets
      const zlo = Math.min(zN, zS), zhi = Math.max(zN, zS);
      q(B.trim, [xmin, P, zhi], [xmax - xmin, 0, 0], [0, 0, -(zhi - zlo)], { c: COL.roof, s: 3 });
      const pc = sty.parapet === 'stone' ? COL.lime : [0.5, 0.5, 0.52];
      const px0 = side * AVE.half, px1 = side * (AVE.half + PARAPET.t);
      box(B.trim, px0, P, zlo, px1, P + PARAPET.h, zhi, { c: pc, skip: 'y' });
      box(B.metal, px0 - side * 0.04, P + PARAPET.h, zlo, px1 + side * 0.04, P + PARAPET.h + 0.07, zhi, { c: COL.galv, skip: 'y' });
      col([Math.min(px0, px1), P, zlo], [Math.max(px0, px1), P + PARAPET.h + 0.07, zhi], 'parapet', 'concrete');
      const lowPar = (x0, z0, x1, z1) => { box(B.trim, x0, P, z0, x1, P + 0.9, z1, { c: pc, skip: 'y' }); col([Math.min(x0, x1), P, Math.min(z0, z1)], [Math.max(x0, x1), P + 0.9, Math.max(z0, z1)], 'parapet', 'concrete'); };
      const nbN = neighbour(L, zN), nbS = neighbour(L, zS);
      if (!nbN || (nbN.lobby ? LOBBY.roofY : nbN.podium) < P) lowPar(px1, zhi - 0.3, xb, zhi);
      if (!nbS || (nbS.lobby ? LOBBY.roofY : nbS.podium) < P) lowPar(px1, zlo, xb, zlo + 0.3);
      lowPar(xb - side * 0.3, zlo, xb, zhi);
      // podium collider (storefront faces add their own slabs/piers)
      const inN = crossN ? RECESS : 0, inS = (crossS || plazaS) ? RECESS : 0;
      col([Math.min(side * (AVE.half + RECESS), xb), 0, zlo + inS], [Math.max(side * (AVE.half + RECESS), xb), P, zhi - inN]);
      roofs.push({ lot: L.id, y: P, x0: xmin, x1: xmax, z0: zlo, z1: zhi });
      sideFaces.length = 0;
    }
    // tower
    if (L.tower > 0) {
      const ins = L.lobby ? 4 : 2.5;
      const bay = L.style === 'stone' ? 1.8 : 1.5;
      let ta = AVE.half + L.setback, tb = AVE.half + L.depth - 1.5;
      tb = ta + Math.floor((tb - ta) / bay) * bay;
      const tzN = zN - ins, tzS = zS + ins;
      const zl = Math.round((tzN - tzS) / bay) * bay, zc = (tzN + tzS) / 2;
      const x0 = side > 0 ? ta : -tb, x1 = side > 0 ? tb : -ta;
      tower(L, x0, x1, zc - zl / 2, zc + zl / 2, L.lobby ? LOBBY.roofY : L.podium, L.tower, seed + 5);
    }
  }
  // podium roof clutter (after towers registered their keep-outs)
  seed = 900;
  for (const L of LOTS) {
    if (L.lobby) continue;
    seed += 13;
    const side = L.side, xa = side * AVE.half, xb = side * (AVE.half + L.depth);
    const st = L.style;
    clutter(xa, L.z[1], xb, L.z[0], L.podium, seed, { tank: st === 'stone' || (st === 'stoneGlass' && L.podium < 40), antenna: L.tower === 0, duct: true, stairC: st.startsWith('stone') ? COL.lime : COL.conc });
  }
  // rooftop billboards (facing the player walking toward -z)
  billboard(29, 26, 14, 14, 5.2, 1, 0, SR.bill(0));
  billboard(31, 60, -132, 22, 8.2, 1, 0, SR.bill(1));
  billboard(-31, 12, 8, 12, 4.5, 1, 0, SR.bill(1));

  // ---------------- surrounding blocks ----------------
  // a cheap building: podium (+ optional tower) with facade walls, street-front treatment on chosen faces
  const TILES_ANY = [TILE.glassBlue, TILE.glassGold, TILE.darkFins, TILE.stone, TILE.stoneGlass, TILE.precast, TILE.precast];
  function block(x0, z0, x1, z1, o) {
    const r = makeRng(o.seed);
    const P = o.podium, tile = o.tile ?? TILES_ANY[Math.floor(r() * TILES_ANY.length)];
    const uo = Math.floor(r() * 8) / 4, tint = o.tint || WHITE;
    const isStone = tile === TILE.stone || tile === TILE.stoneGlass;
    const pierC = isStone ? COL.lime : tile === TILE.precast ? COL.conc : [0.18, 0.17, 0.18];
    const faces = { '-x': mkFace('-x', x0, z0, z1), '+x': mkFace('+x', x1, z0, z1), '-z': mkFace('-z', z0, x0, x1), '+z': mkFace('+z', z1, x0, x1) };
    for (const [k, f] of Object.entries(faces)) {
      if (o.skip && o.skip.includes(k)) continue;
      const st = o.street && o.street.includes(k);
      if (st) {
        if (o.full) { storefront(f, { seed: o.seed + k.length * 7 + (k[0] === '+' ? 3 : 0), pierC, top: P, cornerStart: true, cornerEnd: true, belt: isStone ? COL.lime : COL.dalu, frieze: pierC, panes: o.panes, shopW: 8 }); }
        else cheapFront(f, o.seed + 11, pierC);
        fwall(f, SF + (o.full ? 0.12 : 0), P, tile, uo, SF, tint);
      } else fwall(f, 0, P, tile, uo, SF, tint);
    }
    q(B.facade, [x0, P, z1], [x1 - x0, 0, 0], [0, 0, -(z1 - z0)], { sw: SW.roof });
    box(B.facade, x0 - 0.1, P - 0.4, z0 - 0.1, x1 + 0.1, P + 0.9, z1 + 0.1, { sw: isStone ? SW.lime : SW.darkAlu, skip: 'yY' });
    box(B.facade, x0 + 0.25, P - 0.4, z0 + 0.25, x1 - 0.25, P + 0.9, z1 - 0.25, { sw: SW.concrete, skip: 'yY' });
    q(B.facade, [x0 - 0.1, P + 0.9, z1 + 0.1], [x1 - x0 + 0.2, 0, 0], [0, 0, -0.35], { sw: SW.darkAlu });
    q(B.facade, [x0 - 0.1, P + 0.9, z0 + 0.25], [x1 - x0 + 0.2, 0, 0], [0, 0, -0.35], { sw: SW.darkAlu });
    if (o.full) col([x0 + (o.street?.includes('-x') ? RECESS : 0), 0, z0 + (o.street?.includes('-z') ? RECESS : 0)], [x1 - (o.street?.includes('+x') ? RECESS : 0), P, z1 - (o.street?.includes('+z') ? RECESS : 0)]);
    else col([x0, 0, z0], [x1, P, z1]);
    // tower
    if (o.tower > P) {
      const ins = Math.min(4, (x1 - x0) * 0.15), t = [x0 + ins, z0 + ins, x1 - ins, z1 - ins];
      const tt = o.towerTile ?? tile, ox = { tile: tt, uo: uo + 0.25, yb: P, ...(isStoneT(tt) ? { ao: 2, aoK: 0.55, aoB: 1.5, aoBk: 0.6 } : {}) };
      if (r() < 0.35 && tt !== TILE.stone) prism(B.facade, octPoly(...t, 2.5), P, o.tower, ox, { sw: SW.tar });
      else prism(B.facade, rectPoly(...t), P, o.tower, ox, { sw: SW.tar });
      box(B.facade, t[0] + 2, o.tower, t[1] + 2, t[2] - 2, o.tower + 3, t[3] - 2, { sw: SW.darkAlu, skip: 'y', top: { sw: SW.tar } });
      col([t[0], P, t[1]], [t[2], o.tower, t[3]]);
      if (o.tower > 80) aviation((t[0] + t[2]) / 2, o.tower + 3.5, (t[1] + t[3]) / 2);
    } else if (o.clutter !== false) {
      clutter(x0, z0, x1, z1, P, o.seed + 1, { stair: true, tank: isStone && r() < 0.6, antenna: r() < 0.4 });
    }
  }
  // cross street (both faces), out to +-220
  for (const side of [-1, 1]) {
    for (const [face, zA, zB, start] of [['n', CROSS.z1, CROSS.z1 + 30, side < 0 ? 50 : 52], ['s', CROSS.z0 - 30, CROSS.z0, side < 0 ? 52 : 44]]) {
      let a = start, k = 0;
      while (a < CROSS.reach) {
        const w = Math.min(CROSS.reach - a, 14 + rng() * 14), b = a + w;
        const near = a < 66;
        const pod = near ? 12 + rng() * 16 : 8 + rng() * 26;
        const tw = rng() < 0.45 ? pod + 30 + rng() * 110 : 0;
        const x0 = side > 0 ? a : -b, x1 = side > 0 ? b : -a;
        const sk = [face === 'n' ? '+z' : '-z'];
        block(x0, zA, x1, zB, { seed: 2000 + side * 300 + k * 7 + (face === 'n' ? 0 : 50), podium: pod, tower: tw, street: [face === 'n' ? '-z' : '+z'], full: near, panes: near, skip: sk });
        a = b; k++;
      }
    }
  }
  // the avenue behind the start (z 46..150) + the far end wall
  for (const side of [-1, 1]) {
    let z = AVE.zStart, k = 0;
    while (z < AVE.back) {
      const w = Math.min(AVE.back - z, 16 + rng() * 14), za = z, zb = z + w;
      const pod = 10 + rng() * 22, tw = rng() < 0.55 ? pod + 40 + rng() * 100 : 0;
      const x0 = side > 0 ? AVE.half : -AVE.half - 28, x1 = side > 0 ? AVE.half + 28 : -AVE.half;
      block(x0, za, x1, zb, { seed: 3000 + side * 100 + k * 9, podium: pod, tower: tw, street: [side > 0 ? '-x' : '+x'], full: false });
      z = zb; k++;
    }
  }
  block(-AVE.half - 28, AVE.back, AVE.half + 28, AVE.back + 24, { seed: 3500, podium: 34, tower: 120, street: ['-z'], full: false, tile: TILE.stoneGlass });
  // plaza sides (faces at x = +-46) and Meridian's neighbours
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? PLAZA.half : -PLAZA.half - 44, x1 = side > 0 ? PLAZA.half + 44 : -PLAZA.half;
    block(x0, PLAZA.z0 - 50, x1, PLAZA.z1, { seed: 4000 + side * 10, podium: 24, tower: 96 + (side > 0 ? 8 : -6), street: [side > 0 ? '-x' : '+x'], full: true, panes: false, skip: side > 0 ? '' : '', tile: side > 0 ? TILE.precast : TILE.stoneGlass, towerTile: side > 0 ? TILE.glassBlue : TILE.glassGold });
    // low glass pavilions flanking Meridian's base
    const px0 = side > 0 ? 24 : -44, px1 = side > 0 ? 44 : -24;
    block(px0, -205, px1, -176, { seed: 4100 + side, podium: 9, tower: 0, tile: TILE.meridian, clutter: false });
    // the blocks behind Meridian, backlit silhouettes
    for (let k = 0; k < 3; k++) {
      const bx0 = side * (24 + k * 26), bx1 = bx0 + side * 22;
      block(Math.min(bx0, bx1), -262 - k * 14, Math.max(bx0, bx1), -228 - k * 10, { seed: 4200 + side * 20 + k, podium: 20 + k * 6, tower: 70 + k * 18 + rng() * 20, clutter: false });
    }
  }
  // mid ring: towers peeking over the canyon walls (no colliders needed, out of reach)
  {
    const nCol = colliders.length;
    const occupied = [[-90, -215, 90, -140], [-230, -96, 230, -10], [-46, 46, 46, 175], [-90, -340, 90, -215]];
    const free = (x0, z0, x1, z1) => !occupied.some(o => x0 < o[2] && x1 > o[0] && z0 < o[3] && z1 > o[1]);
    for (const side of [-1, 1]) for (let xi = 0; xi < 4; xi++) for (let zi = 0; zi < 14; zi++) {
      const cx = side * (70 + xi * 42 + rng() * 10), cz = -330 + zi * 40 + rng() * 10;
      const w = 18 + rng() * 14, d = 18 + rng() * 14;
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      if (!free(x0, z0, x1, z1)) continue;
      const near = Math.abs(cx) < 120;
      const h = (near ? 40 : 30) + Math.pow(rng(), 1.6) * (near ? 150 : 190);
      block(x0, z0, x1, z1, { seed: 5000 + xi * 31 + zi * 7 + (side > 0 ? 500 : 0), podium: Math.min(h, 18 + rng() * 14), tower: h, clutter: false, tint: [0.92, 0.92, 0.95] });
    }
    colliders.length = nCol;
  }

  // ---------------- far skyline (400-900 m): one draw call, same facade material ----------------
  {
    const fr = makeRng(8080), FB = B.far;
    const tilesFar = [TILE.glassBlue, TILE.glassGold, TILE.darkFins, TILE.precast, TILE.meridian, TILE.stoneGlass];
    for (let i = 0; i < 230; i++) {
      // denser along the avenue (+-z) and cross street (+-x) sight lines
      let a = fr() * Math.PI * 2;
      if (fr() < 0.55) a = Math.round(a / (Math.PI / 2)) * (Math.PI / 2) + (fr() - 0.5) * 0.5;
      const d = 380 + Math.pow(fr(), 0.8) * 560;
      const cx = Math.sin(a) * d, cz = Math.cos(a) * d;
      const w = 22 + fr() * 34, dd = 22 + fr() * 34, h = 50 + Math.pow(fr(), 1.7) * 230;
      const tile = tilesFar[Math.floor(fr() * tilesFar.length)];
      const ox = { tile, uo: Math.floor(fr() * 8) / 4, yb: 0, c: [0.85, 0.85, 0.9] };
      if (fr() < 0.3) prism(FB, octPoly(cx - w / 2, cz - dd / 2, cx + w / 2, cz + dd / 2, w * 0.18), 0, h, ox, { sw: SW.tar });
      else prism(FB, rectPoly(cx - w / 2, cz - dd / 2, cx + w / 2, cz + dd / 2), 0, h, ox, { sw: SW.tar });
      if (fr() < 0.4) { const t = 0.2 * w; prism(FB, rectPoly(cx - w / 2 + t, cz - dd / 2 + t, cx + w / 2 - t, cz + dd / 2 - t), h, h + 10 + fr() * 30, { ...ox, uo: 0.5 }, { sw: SW.tar }); }
      if (h > 180) glows.push({ p: [cx, h + 1, cz], color: [3.2, 0.22, 0.1], size: 5, blink: true, far: true, rate: 2.2 });
    }
    // hero spires
    const spire = (cx, cz, h, w, tile) => {
      let y = 0, ww = w;
      for (let k = 0; k < 4; k++) {
        const ht = h * [0.5, 0.25, 0.13, 0.07][k];
        prism(FB, octPoly(cx - ww / 2, cz - ww / 2, cx + ww / 2, cz + ww / 2, ww * 0.22), y, y + ht, { tile, uo: 0, yb: y }, { sw: SW.gold });
        y += ht; ww *= 0.78;
        box(FB, cx - ww / 2 - 1.5, y - 1.2, cz - ww / 2 - 1.5, cx + ww / 2 + 1.5, y, cz + ww / 2 + 1.5, { sw: SW.led, skip: 'y' });
      }
      FB.geo(SPIRE, new THREE.Matrix4().compose(new THREE.Vector3(cx, y + 30, cz), new THREE.Quaternion(), new THREE.Vector3(4, 60, 4)), { sw: SW.silver });
      glows.push({ p: [cx, y + 61, cz], color: [3.4, 3.0, 2.6], size: 8, blink: true, far: true, rate: 1.4 });
    };
    spire(-420, -760, 380, 46, TILE.glassBlue);
    spire(560, 520, 330, 40, TILE.glassGold);
    spire(260, -880, 300, 38, TILE.darkFins);
  }

  // ---------------- meshes ----------------
  const root = new THREE.Group(); root.name = 'city';
  const meshes = {
    facade: B.facade.mesh(mats.facade), trim: B.trim.mesh(mats.trim), metal: B.metal.mesh(mats.metal),
    store: B.store.mesh(mats.store, { cast: false }), far: B.far.mesh(mats.facade, { cast: false, receive: false }),
  };
  for (const [k, m] of Object.entries(meshes)) { m.name = 'city-' + k; root.add(m); }
  preview(Object.values(mats));
  let tris = 0; for (const b of Object.values(B)) tris += b.tris;
  const snipers = {}; for (const [k, s] of Object.entries(SNIPERS)) snipers[k] = new THREE.Vector3(s.x, s.y, s.z);
  const info = { tris, meshes: Object.keys(meshes).length, panes: panes.length, colliders: colliders.length, glows: glows.length, textures: 6, buildMs: Math.round(performance.now() - t0) };
  return {
    root, colliders, panes, info,
    anchors: { snipers, roofs, signs, glows },
    update() {},
  };
}

// in the asset viewer, light the dusk materials like the level would (the game ramps them itself)
function preview(mats) {
  if (typeof location === 'undefined' || !location.pathname.includes('model-test')) return;
  const P = new URLSearchParams(location.search), dusk = +(P.get('dusk') || 0);
  const em = THREE.MathUtils.smoothstep(dusk, 0, 0.6);
  for (const m of mats) if (m.userData.duskEmissive !== undefined) m.emissiveIntensity = m.userData.duskEmissive * (0.25 + 0.75 * em);
}

// =====================================================================================
//  MERIDIAN TOWER
// =====================================================================================
export async function buildMeridian(a, b) {
  const ctx = b || a, opts = b ? (a || {}) : {};
  const t0 = performance.now();
  const M = MERIDIAN, X = M.x1, ZF = M.z1, ZB = M.z0, NT = 1.5;   // notch
  const { sT, facade } = shared();
  const store = new THREE.MeshStandardMaterial({ map: sT.map, emissiveMap: sT.em, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5, metalness: 0, alphaTest: 0.5, vertexColors: true });
  store.userData.duskEmissive = 2.2;
  const trim = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x8a7a6a, side: THREE.DoubleSide });   // unlit: a smoky cavity, no rim sheen
  const ember = new THREE.MeshStandardMaterial({ map: sT.map, emissiveMap: sT.em, emissive: 0xffffff, emissiveIntensity: 2.6, roughness: 0.9, vertexColors: true });
  const root = new THREE.Group(); root.name = 'meridian';
  const pivot = new THREE.Vector3(0, M.breakY, ZF);
  const TW = TM[TILE.meridian][0];
  const HOLE = { x0: M.impact[0] - 7, x1: M.impact[0] + 7, y0: M.impact[1] - 7, y1: M.impact[1] + 7 };
  const glows = [];
  let tris = 0;
  const O = { tile: TILE.meridian };
  const finSpacing = 3.8;

  // one band (y0..y1) of half s (x from 0 to s*X); front-face pieces inside the hole rect go to `patch`
  function band(Bm, patch, s, y0, y1, o = {}) {
    const xs = (a) => s * a;
    const w = (n, fixed, t0, t1, ya, yb, opt) => { const f = mkFace(n, fixed, Math.min(t0, t1), Math.max(t0, t1)); const or = { ...opt }; if (opt.tile !== undefined) or.u0 = (f.ox * f.dx + f.oz * f.dz) / TW; lwall(Bm, f, 0, f.len, ya, yb, 0, or); };
    const side = s > 0 ? '+x' : '-x', cut = s > 0 ? '-x' : '+x';
    const yFront0 = o.lobbyTop ?? y0;
    // front (+z) with an optional hole cut-out
    const fx0 = Math.min(0, xs(X - NT)), fx1 = Math.max(0, xs(X - NT));
    const front = (B2, xa, xb, ya, yb) => { if (xb - xa > 0.01 && yb - ya > 0.01) w('+z', ZF, xa, xb, ya, yb, { ...O, yb: 0 }); };
    if (patch && HOLE.x1 > fx0 && HOLE.x0 < fx1 && HOLE.y1 > yFront0 && HOLE.y0 < y1) {
      const hx0 = Math.max(fx0, HOLE.x0), hx1 = Math.min(fx1, HOLE.x1), hy0 = Math.max(yFront0, HOLE.y0), hy1 = Math.min(y1, HOLE.y1);
      const ww = (B2, xa, xb, ya, yb) => { if (xb - xa > 0.01 && yb - ya > 0.01) { const f = mkFace('+z', ZF, xa, xb); lwall(B2, f, 0, f.len, ya, yb, 0, { ...O, yb: 0, u0: xa / TW }); } };
      ww(Bm, fx0, hx0, yFront0, y1); ww(Bm, hx1, fx1, yFront0, y1); ww(Bm, hx0, hx1, yFront0, hy0); ww(Bm, hx0, hx1, hy1, y1);
      ww(patch, hx0, hx1, hy0, hy1);
    } else front(Bm, fx0, fx1, yFront0, y1);
    // notch faces + side + back
    w('+z', ZF - NT, xs(X - NT), xs(X), y0, y1, { ...O, yb: 0 });
    w(side, xs(X - NT), ZF - NT, ZF, y0, y1, { sw: SW.gold });
    w(side, xs(X), ZB + NT, ZF - NT, y0, y1, { ...O, yb: 0 });
    w(side, xs(X - NT), ZB, ZB + NT, y0, y1, { sw: SW.gold });
    w('-z', ZB + NT, xs(X - NT), xs(X), y0, y1, { ...O, yb: 0 });
    w('-z', ZB, Math.min(0, xs(X - NT)), Math.max(0, xs(X - NT)), y0, y1, { ...O, yb: 0 });
    // cut face (exposed when the halves part): floor slabs
    // (the parts inside the blast cavity go to `patch`, hidden while the hole shows)
    const DH = 9.5, inHoleY = patch && HOLE.y1 > y0 && HOLE.y0 < y1, hy0c = Math.max(y0, HOLE.y0), hy1c = Math.min(y1, HOLE.y1);
    if (inHoleY) {
      w(cut, 0, ZB, ZF - DH, y0, y1, { sw: SW.char });
      if (hy0c > y0) w(cut, 0, ZF - DH, ZF, y0, hy0c, { sw: SW.char });
      if (y1 > hy1c) w(cut, 0, ZF - DH, ZF, hy1c, y1, { sw: SW.char });
      const f2 = mkFace(cut, 0, ZF - DH, ZF); lwall(patch, f2, 0, f2.len, hy0c, hy1c, 0, { sw: SW.char });
    } else w(cut, 0, ZB, ZF, y0, y1, { sw: SW.char });
    for (let fy = Math.ceil(y0 / 4.2) * 4.2; fy < y1; fy += 4.2) lwall(inHoleY && fy > HOLE.y0 - 0.5 && fy < HOLE.y1 ? patch : Bm, mkFace(cut, s * -0.02, ZB, ZF), 0, ZF - ZB, fy, Math.min(y1, fy + 0.5), 0, { sw: SW.interior });
    // caps (seen when chunks tumble)
    const xa = Math.min(0, xs(X)), xb = Math.max(0, xs(X));
    if (o.bottom !== false) {
      if (patch && y0 > HOLE.y0 && y0 < HOLE.y1) {
        const ha = Math.max(xa, HOLE.x0), hb = Math.min(xb, HOLE.x1);
        q(Bm, [xa, y0, ZB], [xb - xa, 0, 0], [0, 0, ZF - DH - ZB], { sw: SW.char });
        if (ha > xa) q(Bm, [xa, y0, ZF - DH], [ha - xa, 0, 0], [0, 0, DH], { sw: SW.char });
        if (xb > hb) q(Bm, [hb, y0, ZF - DH], [xb - hb, 0, 0], [0, 0, DH], { sw: SW.char });
        if (hb > ha) q(patch, [ha, y0, ZF - DH], [hb - ha, 0, 0], [0, 0, DH], { sw: SW.char });
      } else q(Bm, [xa, y0, ZB], [xb - xa, 0, 0], [0, 0, ZF - ZB], { sw: SW.char });
    }
    if (o.top !== false) q(Bm, [xa, y1, ZF], [xb - xa, 0, 0], [0, 0, -(ZF - ZB)], { sw: o.topSw ?? SW.roof });
    // LED strip in the front notch
    box(Bm, xs(X - NT) - s * 0.05, y0, ZF - NT + 0.02, xs(X - NT) + s * 0.25, y1, ZF - NT + 0.3, { sw: SW.led, skip: 'yY' });
    // gold fins: front, back and the side
    const finY0 = o.finY0 ?? y0;
    for (let k = 0; k < 5; k++) {
      const fx = s * (1.9 + k * finSpacing);
      const addFin = (B2, ya, yb) => { if (yb - ya > 0.01) box(B2, fx - 0.16, ya, ZF, fx + 0.16, yb, ZF + 0.8, { sw: SW.gold, skip: 'z' }); };
      if (patch && fx > HOLE.x0 && fx < HOLE.x1 && HOLE.y1 > finY0 && HOLE.y0 < y1) {
        const hy0 = Math.max(finY0, HOLE.y0), hy1 = Math.min(y1, HOLE.y1);
        addFin(Bm, finY0, hy0); addFin(patch, hy0, hy1); addFin(Bm, hy1, y1);
      } else addFin(Bm, finY0, y1);
      box(Bm, fx - 0.16, y0, ZB - 0.8, fx + 0.16, y1, ZB, { sw: SW.gold, skip: 'Z' });
    }
    for (let z = ZF - NT - 1.9; z > ZB + NT; z -= finSpacing) box(Bm, xs(X), y0, z - 0.16, xs(X) + s * 0.8, y1, z + 0.16, { sw: SW.gold, skip: s > 0 ? 'x' : 'X' });
  }
  // ---------- lower (0..breakY)
  // break damage: jagged slab noses + rebar on the cut face, hanging concrete under the chunk,
  // missing glass along the break line (warm-dark concrete, so tumbling chunks never read as clean blocks)
  const brk = makeRng(4040);
  const CONC = [0.62, 0.52, 0.44], CONC_D = [0.34, 0.27, 0.22], REBAR = [0.32, 0.16, 0.08];
  function broken(Bm, s, y0, y1, { under = true, cut = true, top = false } = {}) {
    const r = brk, xs = (v) => s * v;
    if (cut) for (let fy = Math.ceil((y0 + 0.6) / 4.2) * 4.2; fy < y1 - 0.4; fy += 4.2) {
      for (let z = ZB + 0.5; z < ZF - 0.5;) {
        const len = 0.8 + r() * 3, reach = r() * 1.6, sag = r() < 0.25 ? r() * 0.5 : 0;
        if (r() < 0.8) box(Bm, xs(0.02), fy - 0.45 - sag, z, xs(-reach - 0.1), fy + 0.05 - sag * 0.3, Math.min(ZF - 0.3, z + len), { sw: SW.concrete, c: r() < 0.5 ? CONC : CONC_D });
        if (r() < 0.45) beam(Bm, [xs(-reach), fy - 0.2, z + len * 0.5], [xs(-reach - 0.5 - r() * 1.2), fy - 0.2 - r() * 0.9, z + len * 0.5 + (r() - 0.5)], 0.05, 0.05, { sw: SW.char, c: REBAR });
        z += len + r() * 0.8;
      }
    }
    const jag = (y, dir) => {
      for (let k = 0; k < 9; k++) {
        const x0 = r() * (X - 2), w = 1.2 + r() * 4, z0 = ZB + r() * (ZF - ZB - 4), d = 2 + r() * 8, h = 0.3 + r() * 1.4;
        const xa = xs(x0), xb = xs(Math.min(X - 0.3, x0 + w));
        box(Bm, xa, y, z0, xb, y + dir * h, Math.min(ZF - 0.2, z0 + d), { sw: SW.concrete, c: r() < 0.5 ? CONC : CONC_D });
        if (r() < 0.6) beam(Bm, [(xa + xb) / 2, y + dir * h, z0 + d * 0.5], [(xa + xb) / 2 + (r() - 0.5) * 1.2, y + dir * (h + 0.6 + r()), z0 + d * 0.5 + (r() - 0.5)], 0.05, 0.05, { sw: SW.char, c: REBAR });
      }
    };
    if (under) jag(y0, -1);
    if (top) jag(y1, 1);
    // missing / smashed panes near the break: dark recessed squares with a torn edge on the front, back and side faces
    const holes = (yB, dir) => {
      for (let k = 0; k < 6; k++) {
        const y = yB + dir * (0.2 + r() * 2.5), hgt = 1.2 + r() * 2.2, ya = dir > 0 ? y : y - hgt;
        const fx = 0.6 + r() * (X - NT - 3), fw = 1.3 + r() * 2.4, face = r();
        if (face < 0.75) q(Bm, [xs(fx) + (s < 0 ? 0 : fw), ya, ZB - 0.03], [-fw, 0, 0], [0, hgt, 0], { sw: SW.char, c: [0.6, 0.5, 0.4] });
        else if (false) { const z = ZB + NT + 1 + r() * (ZF - ZB - 2 * NT - 4); q(Bm, s > 0 ? [X + 0.03, ya, z + fw] : [-X - 0.03, ya, z], [0, 0, s > 0 ? -fw : fw], [0, hgt, 0], { sw: SW.char, c: [0.6, 0.5, 0.4] }); }
      }
    };
    if (under) holes(y0, 1);
    if (top) holes(y1, -1);
  }
  const lowerB = new Batch(), lowerPatch = new Batch(), lowerStore = new Batch();
  const LOBBY_H = 12;
  for (const s of [-1, 1]) band(lowerB, lowerPatch, s, 0, M.breakY, { lobbyTop: LOBBY_H, finY0: LOBBY_H, bottom: false, top: false });
  {
    // recessed lobby with lit backdrop, gold columns, canopy, steps
    const ZL = ZF - 4;
    const fx = X - NT;
    lwall(lowerB, mkFace('+z', ZL, -fx, fx), 0, 2 * fx, 0, LOBBY_H, 0, { sw: SW.interior });
    const bf = mkFace('+z', ZL + 0.05, -14, 14);
    for (let k = 0; k < 4; k++) lwall(lowerStore, bf, k * 7, (k + 1) * 7, 0.15, 11, 0, { uv: srUV(SR.lobby, 2) });
    q(lowerB, [-fx, LOBBY_H, ZL], [2 * fx, 0, 0], [0, 0, 4], { sw: SW.blackGlass });              // soffit (faces down)
    for (let x = -fx + 2; x < fx; x += 3.5) box(lowerB, x - 0.6, LOBBY_H - 0.05, ZL + 0.3, x + 0.6, LOBBY_H, ZF - 0.3, { sw: SW.led, skip: 'Y' });
    for (const sx of [-1, 1]) lwall(lowerB, mkFace(sx > 0 ? '-x' : '+x', sx * fx, ZL, ZF), 0, 4, 0, LOBBY_H, 0, { sw: SW.blackGlass });
    for (let x = -14; x <= 14; x += 7) box(lowerB, x - 0.5, 0, ZF - 0.5, x + 0.5, LOBBY_H, ZF + 0.5, { sw: SW.gold });
    for (let x = -14; x < 14; x += 1.75) if (Math.abs(x % 7) > 0.1) box(lowerB, x - 0.04, 0.15, ZF - 0.12, x + 0.04, LOBBY_H, ZF - 0.04, { sw: SW.darkAlu });
    for (const y of [3.4, 7.0, 10.4]) box(lowerB, -14, y - 0.06, ZF - 0.12, 14, y + 0.06, ZF - 0.04, { sw: SW.darkAlu });
    box(lowerB, -fx, LOBBY_H, ZF - 0.2, fx, LOBBY_H + 1.4, ZF + 0.9, { sw: SW.gold });                // lobby head band
    box(lowerB, -fx, LOBBY_H + 1.4, ZF + 0.6, fx, LOBBY_H + 1.6, ZF + 0.95, { sw: SW.led });
    // canopy
    box(lowerB, -11, 8.4, ZF, 11, 9.1, ZF + 9, { sw: SW.darkAlu });
    box(lowerB, -11.1, 8.3, ZF + 8.9, 11.1, 9.2, ZF + 9.15, { sw: SW.gold });
    for (let x = -9; x <= 9; x += 3) box(lowerB, x - 0.7, 8.36, ZF + 1, x + 0.7, 8.4, ZF + 8, { sw: SW.led, skip: 'Y' });
    for (const x of [-9, 9]) beam(lowerB, [x, 9.1, ZF + 8.5], [x, 17, ZF + 0.1], 0.12, 0.12, { sw: SW.silver });
    for (let k = 0; k < 3; k++) box(lowerB, -12 - k * 0.5, 0, ZF + k * 0.5, 12 + k * 0.5, 0.15 - k * 0.05, ZF + 2 + k * 0.6, { sw: SW.granite });
    // granite base band on the side/back faces
    for (const s of [-1, 1]) box(lowerB, s * X - 0.1, 0, ZB - 0.1, s * (X - 0.4), 1.2, ZF - NT, { sw: SW.granite, skip: 'y' });
  }
  for (const s of [-1, 1]) broken(lowerB, s, 0, M.breakY, { under: false, cut: false, top: true });
  const lowerG = new THREE.Group(); lowerG.name = 'meridian-lower';
  const lm = lowerB.mesh(facade); lowerG.add(lm);
  lowerG.add(lowerStore.mesh(store, { cast: false }));
  const lp = lowerPatch.mesh(facade); lowerG.add(lp);
  tris += lowerB.tris + lowerStore.tris + lowerPatch.tris;
  root.add(lowerG);

  // ---------- upper (chunks)
  const upper = new THREE.Group(); upper.name = 'meridian-upper'; upper.position.copy(pivot);
  root.add(upper);
  const chunks = [], patches = [lp];
  const CROWN0 = 116, NB = 5, bh = (CROWN0 - M.breakY) / NB;
  const bands = [];
  for (let i = 0; i < NB; i++) bands.push([M.breakY + i * bh, M.breakY + (i + 1) * bh]);
  const logoY0 = 103.8, logoY1 = 110.2;
  const colliders = [{ min: [M.x0, 0, M.z0], max: [M.x1, M.breakY, M.z1], data: { kind: 'meridian', mat: 'glass', part: 'lower' } }];
  const mkChunk = (Bm, s, y0, y1, extra = []) => {
    const cx = s * X / 2, cy = (y0 + y1) / 2, cz = (ZF + ZB) / 2;
    Bm.translate(-cx, -cy, -cz);
    const m = Bm.mesh(facade); m.name = `meridian-chunk-${chunks.length}`;
    m.position.set(cx - pivot.x, cy - pivot.y, cz - pivot.z);
    m.userData.half = [X / 2, (y1 - y0) / 2, (ZF - ZB) / 2];
    for (const e of extra) { e.position.set(-cx, -cy, -cz); m.add(e); }
    upper.add(m); chunks.push(m);
    colliders.push({ min: [Math.min(0, s * X), y0, ZB], max: [Math.max(0, s * X), y1, ZF], data: { kind: 'meridian', mat: 'glass', part: 'upper', chunk: chunks.length - 1 } });
    tris += Bm.tris;
    return m;
  };
  for (let i = 0; i < NB; i++) {
    const [y0, y1] = bands[i];
    for (const s of [-1, 1]) {
      const Bm = new Batch(), patch = i === 0 ? new Batch() : null;
      band(Bm, patch, s, y0, y1, {});
      broken(Bm, s, y0, y1, { under: true, cut: true, top: i < NB - 1 && brk() < 0.6 });
      // gold belt at the crown base / mid tower
      if (i === NB - 1) box(Bm, Math.min(0, s * (X + 0.4)), y1 - 1.6, ZB - 0.4, Math.max(0, s * (X + 0.4)), y1, ZF + 1.0, { sw: SW.gold, skip: s > 0 ? 'x' : 'X' });
      if (i === 1) box(Bm, Math.min(0, s * (X + 0.2)), y1 - 0.8, ZB - 0.2, Math.max(0, s * (X + 0.2)), y1, ZF + 0.95, { sw: SW.gold, skip: s > 0 ? 'x' : 'X' });
      const extra = [];
      if (patch) { const pm = patch.mesh(facade); extra.push(pm); patches.push(pm); tris += patch.tris; }
      if (logoY0 >= y0 && logoY1 <= y1) {
        // MERIDIAN lettering, split between the halves ("MERI" | "DIAN")
        const LB = new Batch(), [lx, ly, lw, lh] = SR.logo;
        const half = 15.5, u0 = s > 0 ? lx + lw / 2 : lx, u1 = s > 0 ? lx + lw : lx + lw / 2;
        const xa = s > 0 ? 0.2 : -half, xb = s > 0 ? half : -0.2;
        LB.quad([xa, logoY0, ZF + 0.95], [xb - xa, 0, 0], [0, logoY1 - logoY0, 0], [u0 / 1024, 1 - (ly + lh) / 1024, u1 / 1024, 1 - ly / 1024], 0);
        const lm2 = LB.mesh(store, { cast: false }); lm2.name = 'meridian-logo'; extra.push(lm2); tris += LB.tris;
        box(Bm, xa - (s < 0 ? 0.4 : 0), logoY0 - 0.6, ZF + 0.8, xb + (s > 0 ? 0.4 : 0), logoY0 - 0.35, ZF + 1.1, { sw: SW.darkAlu });
      }
      mkChunk(Bm, s, y0, y1, extra);
    }
  }
  // crown: faceted, tapering glass lantern with gold ribs and LED edges, spire
  const CR1 = 131, TOPX = 13.5, TOPZ0 = ZB + 5.5, TOPZ1 = ZF - 5.5, BX = X - NT, BZ0 = ZB + NT, BZ1 = ZF - NT;
  for (const s of [-1, 1]) {
    const Bm = new Batch();
    const sx = (v) => s * v;
    const g = SWQ(SW.goldGlass), gu = [g[0], g[1]];
    const quad4 = (p0, p1, p2, p3, n, sw = SW.goldGlass) => { const u = swUV(sw); Bm.tri(p0, p1, p2, [u, u, u], 7, WHITE, n); Bm.tri(p0, p2, p3, [u, u, u], 7, WHITE, n); };
    // podium of the crown: the notched shaft top cap
    q(Bm, [Math.min(0, sx(X)), CROWN0, ZF], [X, 0, 0], [0, 0, -(ZF - ZB)], { sw: SW.roof });
    // front, back (half trapezoids), side
    quad4([0, CROWN0, BZ1], [sx(BX), CROWN0, BZ1], [sx(TOPX), CR1, TOPZ1], [0, CR1, TOPZ1], [0, 0.3, 1]);
    quad4([0, CROWN0, BZ0], [sx(BX), CROWN0, BZ0], [sx(TOPX), CR1, TOPZ0], [0, CR1, TOPZ0], [0, 0.3, -1]);
    quad4([sx(BX), CROWN0, BZ1], [sx(BX), CROWN0, BZ0], [sx(TOPX), CR1, TOPZ0], [sx(TOPX), CR1, TOPZ1], [s, 0.3, 0]);
    quad4([0, CROWN0, BZ1], [0, CROWN0, BZ0], [0, CR1, TOPZ0], [0, CR1, TOPZ1], [-s, 0, 0], SW.concrete);
    q(Bm, [Math.min(0, sx(TOPX)), CR1, TOPZ1], [TOPX, 0, 0], [0, 0, -(TOPZ1 - TOPZ0)], { sw: SW.tar });
    // ribs on the sloped faces (continuing the fins), LED edges
    for (let k = 0; k < 5; k++) {
      const fx = 1.9 + k * finSpacing; if (fx > BX) break;
      const tx = fx * TOPX / BX;
      beam(Bm, [sx(fx), CROWN0, BZ1 + 0.35], [sx(tx), CR1, TOPZ1 + 0.35], 0.3, 0.55, { sw: SW.gold });
      beam(Bm, [sx(fx), CROWN0, BZ0 - 0.35], [sx(tx), CR1, TOPZ0 - 0.35], 0.3, 0.55, { sw: SW.gold });
    }
    for (let z = BZ1 - 1.9; z > BZ0; z -= finSpacing) { const tz = TOPZ0 + (z - BZ0) / (BZ1 - BZ0) * (TOPZ1 - TOPZ0); beam(Bm, [sx(BX + 0.35), CROWN0, z], [sx(TOPX + 0.35), CR1, tz], 0.55, 0.3, { sw: SW.gold }); }
    beam(Bm, [sx(BX), CROWN0 + 0.2, BZ1], [sx(TOPX), CR1, TOPZ1], 0.4, 0.4, { sw: SW.led });
    beam(Bm, [sx(BX), CROWN0 + 0.2, BZ0], [sx(TOPX), CR1, TOPZ0], 0.4, 0.4, { sw: SW.led });
    box(Bm, Math.min(0, sx(TOPX + 0.3)), CR1 - 0.2, TOPZ0 - 0.3, Math.max(0, sx(TOPX + 0.3)), CR1 + 0.6, TOPZ1 + 0.3, { sw: SW.led, skip: s > 0 ? 'xy' : 'Xy' });
    // notched corner columns topped by gold caps
    box(Bm, sx(X - NT), CROWN0, ZF - NT, sx(X), CROWN0 + 3, ZF, { sw: SW.gold });
    box(Bm, sx(X - NT), CROWN0, ZB, sx(X), CROWN0 + 3, ZB + NT, { sw: SW.gold });
    // mechanical + spire (spire on the right half)
    box(Bm, Math.min(0, sx(7)), CR1, ZB + 12, Math.max(0, sx(7)), CR1 + 3, ZF - 12, { sw: SW.darkAlu, skip: s > 0 ? 'xy' : 'Xy', top: { sw: SW.tar } });
    if (s > 0) {
      const sp = new THREE.CylinderGeometry(0.18, 1.4, 1, 10, 1, true);
      Bm.geo(sp, new THREE.Matrix4().compose(new THREE.Vector3(0.01, CR1 + 3 + 21, (ZF + ZB) / 2), new THREE.Quaternion(), new THREE.Vector3(1, 42, 1)), { sw: SW.silver });
      for (const y of [CR1 + 8, CR1 + 16, CR1 + 24]) Bm.geo(new THREE.CylinderGeometry(1.5 - (y - CR1) * 0.04, 1.5 - (y - CR1) * 0.04, 0.5, 10), new THREE.Matrix4().makeTranslation(0.01, y, (ZF + ZB) / 2), { sw: SW.gold });
      Bm.geo(new THREE.SphereGeometry(0.35, 8, 6), new THREE.Matrix4().makeTranslation(0.01, CR1 + 45.3, (ZF + ZB) / 2), { sw: SW.red });
    }
    broken(Bm, s, CROWN0, CR1, { under: true, cut: false });
    mkChunk(Bm, s, CROWN0, CR1 + 3, []);
  }
  const top = chunks[chunks.length - 1];
  top.userData.half = [X / 2, (CR1 + 3 - CROWN0) / 2, (ZF - ZB) / 2];
  const spireLight = new THREE.Vector3(0, CR1 + 45.6, (ZF + ZB) / 2);
  glows.push({ p: spireLight, color: [3.4, 0.25, 0.1], size: 3.2, blink: true, far: true, rate: 2.0 });
  for (const s of [-1, 1]) for (const z of [ZF, ZB]) glows.push({ p: new THREE.Vector3(s * X, CROWN0 + 3.4, z), color: [3.2, 0.22, 0.1], size: 2.2, blink: true, far: true, rate: 2.6 });

  // ---------- the blast hole (hidden until the gunship hits)
  const hole = new THREE.Group(); hole.name = 'meridian-hole';
  hole.position.set(...M.impact);
  {
    const r = makeRng(666);
    const HB = new Batch(), HM = new Batch(), HE = new Batch(), HF = new Batch();
    const hw = 7, D = 9;
    const charC = (k = 1) => [0.06 * k, 0.05 * k, 0.045 * k];
    // cavity (inward facing)
    q(HB, [-hw, -hw, -D], [2 * hw, 0, 0], [0, 2 * hw, 0], { c: charC(1), s: 3 });
    q(HB, [-hw, -hw, 0], [0, 0, -D], [0, 2 * hw, 0], { c: charC(0.8), s: 3 });
    q(HB, [hw, -hw, -D], [0, 0, D], [0, 2 * hw, 0], { c: charC(0.8), s: 3 });
    q(HB, [-hw, hw, 0], [2 * hw, 0, 0], [0, 0, -D], { c: charC(0.5), s: 3 });
    q(HB, [-hw, -hw, -D], [2 * hw, 0, 0], [0, 0, D], { c: charC(1.2), s: 3 });
    // broken slabs with jagged noses, rebar, sagging
    for (const fy of [-6.4, -2.2, 2.0, 6.2]) {
      if (fy < -hw || fy > hw) continue;
      box(HB, -hw, fy - 0.35, -D, hw, fy, -2.5 - r() * 1.5, { c: [0.1, 0.09, 0.085] });
      for (let x = -hw + 0.4; x < hw - 0.6; x += 1 + r() * 1.4) {
        const reach = r() * 2.6, sag = r() * 0.9;
        box(HB, x, fy - 0.35 - sag, -2.8, x + 0.6 + r() * 1.2, fy - sag * 0.6, -2.8 + reach, { c: [0.13, 0.11, 0.1] });
        if (r() < 0.6) beam(HM, [x + 0.3, fy - 0.2, -2.5], [x + 0.3 + (r() - 0.5), fy - 0.2 - r() * 1.6, -0.6 + r() * 1.5], 0.04, 0.04, { c: [0.25, 0.14, 0.08] });
      }
      // embers along the slab edge + burning interior
      lwall(HE, mkFace('+z', -2.4, -hw + 0.5, hw - 0.5), 0, 2 * hw - 1, fy, fy + 1.0 + r() * 1.2, 0, { uv: srUV(SR.ember, 2), c: [1, 0.8, 0.6] });
    }
    lwall(HE, mkFace('+z', -D + 0.05, -hw, hw), 0, 2 * hw, -hw, -hw + 3.5, 0, { uv: srUV(SR.ember, 2) });
    // broken columns
    for (const x of [-3.8, 3.8]) { box(HB, x - 0.45, -hw, -5, x + 0.45, -1 + r() * 3, -4.1, { c: [0.12, 0.11, 0.1] }); beam(HM, [x, 1.5, -4.5], [x + 0.6, 3.5, -3.6], 0.05, 0.05, { c: [0.25, 0.14, 0.08] }); }
    // torn mullions / bent fins at the rim
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, rr = hw * (0.75 + r() * 0.3);
      const p0 = [Math.cos(a) * rr, Math.sin(a) * rr * 0.95, 0.3];
      const len = 1.2 + r() * 3.2, dir = [-Math.cos(a) * 0.6 + (r() - 0.5), -Math.sin(a) * 0.6 - r() * 0.8, 0.5 + r() * 1.2];
      const p1 = [p0[0] + dir[0] * len, p0[1] + dir[1] * len, p0[2] + dir[2] * len * 0.6];
      beam(HF, p0, p1, k % 3 ? 0.08 : 0.28, k % 3 ? 0.12 : 0.6, { sw: k % 3 ? SW.darkAlu : SW.gold }, r() * 3);
    }
    // hanging spandrel / glass panels
    for (let k = 0; k < 7; k++) {
      const x = -hw + 1 + r() * (2 * hw - 2), y = hw - 0.5 - r() * 3, w = 1.2 + r() * 0.8, h = 1.6 + r() * 2.2;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y - h / 2, 0.7 + r() * 0.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3 + r() * 0.6, (r() - 0.5) * 0.8, (r() - 0.5) * 0.9)), new THREE.Vector3(w, h, 0.06));
      HF.geo(UNIT_BOX, m, { sw: k % 3 ? SW.blackGlass : SW.darkAlu });
    }
    // scorch ring: irregular charred shards over the face around the rim
    for (let k = 0; k < 40; k++) {
      const a = r() * Math.PI * 2, rr = hw * (0.95 + r() * 0.55), w = 1 + r() * 2.4, h = 0.6 + r() * 2;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr + (r() < 0.5 ? 1.5 : 0), 0.82 + r() * 0.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a + (r() - 0.5))), new THREE.Vector3(w, h, 0.05));
      HB.geo(UNIT_BOX, m, { c: charC(0.6 + r() * 0.6), uvS: 1 });
    }
    hole.add(HB.mesh(trim, { cast: false }), HM.mesh(trim, { cast: false }), HE.mesh(ember, { cast: false }), HF.mesh(facade, { cast: false }));
    tris += HB.tris + HM.tris + HE.tris + HF.tris;
  }
  root.add(hole);
  // showing the hole hides the intact glass in front of it
  let holeVis = true;
  Object.defineProperty(hole, 'visible', { configurable: true, get() { return holeVis; }, set(v) { holeVis = v; for (const p of patches) p.visible = !v; } });
  hole.visible = !!opts.hole;
  if (opts.explode) chunks.forEach((c, i) => { c.position.y += (i >> 1) * opts.explode; c.position.x += (i % 2 ? 1 : -1) * opts.explode * 0.6; c.rotation.x = (i % 3 - 1) * 0.15; });   // viewer only

  root.traverse(o => { if (o.isMesh && o.castShadow === false && !o.material.alphaTest && o.name !== 'meridian-logo') { o.castShadow = o.parent !== hole; } });
  preview([facade, store]);
  const info = { tris, chunks: chunks.length, buildMs: Math.round(performance.now() - t0) };
  return {
    root, lower: lowerG, upper, chunks, pivot, colliders, hole, info,
    anchors: {
      impact: new THREE.Vector3(...M.impact), crown: new THREE.Vector3(0, CR1, (ZF + ZB) / 2), spireLight,
      logo: new THREE.Vector3(0, (logoY0 + logoY1) / 2, ZF + 1), glows,
    },
  };
}

// viewer helper: city + Meridian together
export async function buildPreview(a, b) {
  const ctx = b || a, opts = b ? (a || {}) : {};
  const c = await buildCity(ctx), m = await buildMeridian(opts, ctx);
  const root = new THREE.Group(); root.add(c.root, m.root);
  return { root, info: { city: c.info, meridian: m.info } };
}
