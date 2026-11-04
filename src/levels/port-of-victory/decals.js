import * as THREE from 'three';
import * as T from '../../textures.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  Ground dressing for the yard and apron, in two draw calls:
//   1. one merged decal mesh (atlas): oil stains, tyre scuffs, asphalt patches, cracks,
//      manhole / drain covers, concrete slab seams, crane rail grooves, contact shadows
//      around container stacks (9-slice soft rects), painted glyphs (bay numbers, block IDs)
//   2. shallow puddles: dark, glossy, env-reflective standard material
// =====================================================================================

const G = 8, CS = 128, AS = G * CS; // 8x8 cells of 128 px
export const CELL = {
  OIL0: 0, OIL1: 1, OIL2: 2, TYRE: 3, MANHOLE: 4, DRAIN: 5, AO: 6, SEAM: 7,
  PATCH: 8, CRACK: 9, DUST: 10, GROOVE: 11, SKID: 12, GRATE: 13, HATCH: 14, ARROW: 15,
  GLYPH0: 16, // 'A'..'F' '0'..'9' '-' ...
};
const GLYPHS = 'ABCDEF0123456789-PX';

function atlas() {
  const c = T.makeCanvas(AS, AS), x = c.getContext('2d'), r = makeRng(4242), n = T.makeNoise(4243, 32);
  x.clearRect(0, 0, AS, AS);
  const cell = (i) => [(i % G) * CS, Math.floor(i / G) * CS];
  const blob = (i, rgb, alpha, scale, thr, seedOff) => {
    const [X, Y] = cell(i), img = x.createImageData(CS, CS);
    for (let y = 0; y < CS; y++) for (let xx = 0; xx < CS; xx++) {
      const u = xx / CS, v = y / CS, dx = u - 0.5, dy = v - 0.5, d = Math.sqrt(dx * dx + dy * dy) * 2;
      const f = T.fbm(n, u * scale + seedOff, v * scale + seedOff * 0.7, 4, 4);
      let a = Math.max(0, Math.min(1, (f - d * 0.55 - thr) * 4)) * (1 - Math.pow(Math.min(1, d), 6));
      a *= 0.65 + 0.35 * T.fbm(n, u * 6 + seedOff, v * 6, 3, 4);
      const k = (y * CS + xx) * 4;
      img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = a * alpha * 255;
    }
    x.putImageData(img, X, Y);
  };
  blob(CELL.OIL0, [14, 12, 10], 0.85, 1.6, 0.05, 0.0);
  blob(CELL.OIL1, [20, 16, 12], 0.75, 2.2, 0.0, 3.1);
  blob(CELL.OIL2, [10, 9, 8], 0.9, 3.0, 0.08, 7.7);
  blob(CELL.PATCH, [26, 25, 24], 0.8, 1.2, -0.25, 11.0);
  blob(CELL.DUST, [150, 130, 105], 0.35, 1.8, -0.05, 5.5);
  // tyre scuffs: several long soft streaks along u
  { const [X, Y] = cell(CELL.TYRE), img = x.createImageData(CS, CS);
    const lanes = [0.22, 0.31, 0.69, 0.78];
    for (let y = 0; y < CS; y++) for (let xx = 0; xx < CS; xx++) {
      const u = xx / CS, v = y / CS; let a = 0;
      for (const l of lanes) a = Math.max(a, Math.exp(-Math.pow((v - l - Math.sin(u * 3) * 0.02) / 0.03, 2)));
      a *= Math.sin(u * Math.PI) ** 0.6 * (0.45 + 0.55 * T.fbm(n, u * 4, v * 9, 3, 4));
      const k = (y * CS + xx) * 4; img.data[k] = 16; img.data[k + 1] = 15; img.data[k + 2] = 14; img.data[k + 3] = a * 170;
    }
    x.putImageData(img, X, Y); }
  // skid: one dark sharp streak pair (forklift turns)
  { const [X, Y] = cell(CELL.SKID), img = x.createImageData(CS, CS);
    for (let y = 0; y < CS; y++) for (let xx = 0; xx < CS; xx++) {
      const u = xx / CS, v = y / CS;
      let a = Math.max(Math.exp(-Math.pow((v - 0.35) / 0.05, 2)), Math.exp(-Math.pow((v - 0.65) / 0.05, 2)));
      a *= Math.pow(Math.sin(u * Math.PI), 0.4) * (0.5 + 0.5 * T.fbm(n, u * 8 + 2, v * 4, 3, 4));
      const k = (y * CS + xx) * 4; img.data[k] = 12; img.data[k + 1] = 11; img.data[k + 2] = 10; img.data[k + 3] = a * 200;
    }
    x.putImageData(img, X, Y); }
  // contact shadow 9-slice: alpha = a(s) * a(t), strongest at the inner square (container face)
  { const [X, Y] = cell(CELL.AO), img = x.createImageData(CS, CS);
    const a1 = (s) => Math.pow(Math.min(1, Math.max(0, s / 0.5)), 1.8);
    for (let y = 0; y < CS; y++) for (let xx = 0; xx < CS; xx++) {
      const s = Math.min(xx + 0.5, CS - xx - 0.5) / CS, t = Math.min(y + 0.5, CS - y - 0.5) / CS;
      const k = (y * CS + xx) * 4; img.data[k] = 6; img.data[k + 1] = 5; img.data[k + 2] = 5; img.data[k + 3] = a1(s) * a1(t) * 215;
    }
    x.putImageData(img, X, Y); }
  // seam: thin dark joint line along u with chipped edges (v centre)
  { const [X, Y] = cell(CELL.SEAM), img = x.createImageData(CS, CS);
    for (let y = 0; y < CS; y++) for (let xx = 0; xx < CS; xx++) {
      const v = y / CS, u = xx / CS, w = 0.07 + 0.05 * T.fbm(n, u * 8, 3.3, 3, 4);
      const a = Math.exp(-Math.pow((v - 0.5) / w, 2)) * 0.9 + Math.exp(-Math.pow((v - 0.5) / (w * 3), 2)) * 0.25;
      const k = (y * CS + xx) * 4; img.data[k] = 14; img.data[k + 1] = 13; img.data[k + 2] = 12; img.data[k + 3] = Math.min(1, a) * 220;
    }
    x.putImageData(img, X, Y); }
  // rail groove: dark slot + worn bright steel lip
  { const [X, Y] = cell(CELL.GROOVE), img = x.createImageData(CS, CS);
    for (let y = 0; y < CS; y++) for (let xx = 0; xx < CS; xx++) {
      const v = y / CS; const slot = Math.abs(v - 0.5) < 0.16, lip = Math.abs(v - 0.5) < 0.24 && !slot, dirt = Math.exp(-Math.pow((v - 0.5) / 0.4, 2));
      const k = (y * CS + xx) * 4;
      if (slot) { img.data[k] = 10; img.data[k + 1] = 9; img.data[k + 2] = 8; img.data[k + 3] = 235; }
      else if (lip) { img.data[k] = 150; img.data[k + 1] = 146; img.data[k + 2] = 140; img.data[k + 3] = 220; }
      else { img.data[k] = 30; img.data[k + 1] = 26; img.data[k + 2] = 22; img.data[k + 3] = dirt * 120; }
    }
    x.putImageData(img, X, Y); }
  // crack: a few branching polylines
  { const [X, Y] = cell(CELL.CRACK); x.save(); x.translate(X, Y); x.strokeStyle = 'rgba(8,7,6,0.85)'; x.lineCap = 'round';
    const walk = (px, py, ang, len, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < len; k++) { ang += (r() - 0.5) * 0.9; px += Math.cos(ang) * 4; py += Math.sin(ang) * 4; x.lineTo(px, py); if (r() < 0.08 && w > 0.8) { x.stroke(); walk(px, py, ang + (r() < 0.5 ? 1 : -1) * 0.9, len / 2, w * 0.6); x.beginPath(); x.moveTo(px, py); x.lineWidth = w; } } x.stroke(); };
    walk(10, 64, 0, 28, 2.2); x.restore(); }
  // manhole: round cast-iron lid with ring + grip pattern
  { const [X, Y] = cell(CELL.MANHOLE); x.save(); x.translate(X + 64, Y + 64);
    x.fillStyle = 'rgba(28,26,24,0.9)'; x.beginPath(); x.arc(0, 0, 60, 0, 7); x.fill();
    x.fillStyle = '#4a4642'; x.beginPath(); x.arc(0, 0, 54, 0, 7); x.fill();
    x.strokeStyle = '#2a2724'; x.lineWidth = 3; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(0, 0, 14 + k * 10, 0, 7); x.stroke(); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; x.beginPath(); x.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); x.lineTo(Math.cos(a) * 50, Math.sin(a) * 50); x.stroke(); }
    x.fillStyle = 'rgba(120,70,40,0.35)'; for (let k = 0; k < 30; k++) { x.beginPath(); x.arc((r() - 0.5) * 80, (r() - 0.5) * 80, 2 + r() * 6, 0, 7); x.fill(); }
    x.restore(); }
  // drain: rectangular grate in a frame
  for (const [ci, slots] of [[CELL.DRAIN, 9], [CELL.GRATE, 14]]) {
    const [X, Y] = cell(ci); x.save(); x.translate(X, Y);
    x.fillStyle = 'rgba(30,28,26,0.85)'; x.fillRect(6, 22, 116, 84);
    x.fillStyle = '#56524c'; x.fillRect(12, 28, 104, 72);
    x.fillStyle = '#0c0b0a'; for (let k = 0; k < slots; k++) x.fillRect(18 + k * (92 / slots), 34, 92 / slots * 0.55, 60);
    x.fillStyle = 'rgba(90,60,35,0.3)'; x.fillRect(12, 80, 104, 20);
    x.restore(); }
  // hatched pedestrian chevron (paint) and an arrow (paint): worn white
  { const [X, Y] = cell(CELL.ARROW); x.save(); x.translate(X, Y); x.fillStyle = 'rgba(206,200,186,0.9)';
    x.beginPath(); x.moveTo(20, 54); x.lineTo(80, 54); x.lineTo(80, 30); x.lineTo(118, 64); x.lineTo(80, 98); x.lineTo(80, 74); x.lineTo(20, 74); x.closePath(); x.fill(); x.restore(); }
  // glyphs (paint, stencil font)
  GLYPHS.split('').forEach((ch, i) => {
    const [X, Y] = cell(CELL.GLYPH0 + i);
    x.save(); x.fillStyle = 'rgba(214,208,192,1)'; x.font = '400 120px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, X + 64, Y + 68); x.restore();
  });
  // wear everything painted (glyphs + arrow): erase specks
  { const img = x.getImageData(0, CS * 1, AS, AS - CS); const d = img.data;
    for (let y = 0; y < AS - CS; y++) for (let xx = 0; xx < AS; xx++) {
      const ci = Math.floor((y + CS) / CS) * G + Math.floor(xx / CS);
      if (ci !== CELL.ARROW && ci < CELL.GLYPH0) continue;
      const k = (y * AS + xx) * 4, f = T.fbm(n, xx / AS * 3, y / AS * 3, 16, 4);
      d[k + 3] *= Math.max(0, Math.min(1, (f - 0.3) * 3.2)) * 0.85;
      const g = 0.78 + 0.22 * f; d[k] *= g; d[k + 1] *= g; d[k + 2] *= g * 0.96;
    }
    x.putImageData(img, 0, CS); }
  const t = T.canvasTex(c, { repeat: false });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4;
  return t;
}
function puddleAlpha() {
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(919, 32);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const cx = (xx % 128) / 128, cy = (y % 128) / 128, q = Math.floor(xx / 128) + Math.floor(y / 128) * 2;
    const dx = (cx - 0.5) * (1.3 + q * 0.15), dy = (cy - 0.5) * (1.9 - q * 0.2), d = Math.sqrt(dx * dx + dy * dy) * 2;
    const f = T.fbm(n, cx * 2.5 + q * 3.3, cy * 2.5 + q, 4, 4);
    const a = Math.max(0, Math.min(1, (0.75 - d + (f - 0.5) * 0.9) * 7)) * (1 - Math.pow(Math.min(1, d), 8));
    const k = (y * S + xx) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = a * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c, { repeat: false, srgb: false });
}

class Quads {
  constructor() { this.p = []; this.uv = []; this.c = []; this.i = []; }
  // 4 corners (x,z) in order (p00, p10, p11, p01) + uv rect in cell space
  raw(pts, y, cell, uv, col) {
    const cx = cell % G, cy = Math.floor(cell / G), inset = 1.5 / AS;
    const U = (u) => (cx + u) / G * (1 - 0) + (u <= 0 ? inset : u >= 1 ? -inset : 0);
    const V = (v) => 1 - (cy + 1 - v) / G + (v <= 0 ? inset : v >= 1 ? -inset : 0);
    const b = this.p.length / 3;
    pts.forEach(([x, z], k) => { this.p.push(x, y, z); this.uv.push(U(uv[k][0]), V(uv[k][1])); this.c.push(...col); });
    this.i.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  // rect centred at (x,z), size w (along local u) x h, rotated by a (radians, about y)
  quad(x, z, w, h, a, cell, col = [1, 1, 1, 1], y = 0.01, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    const ca = Math.cos(a), sa = Math.sin(a), hw = w / 2, hh = h / 2;
    const P = (u, v) => [x + u * ca - v * sa, z - (u * sa + v * ca)];
    this.raw([P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)], y, cell, uv, col);
  }
  // strip between two points (constant-u cell such as SEAM / GROOVE)
  strip(x0, z0, x1, z1, w, cell, col, y = 0.01) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), nx = -dz / L * w / 2, nz = dx / L * w / 2;
    this.raw([[x0 - nx, z0 - nz], [x1 - nx, z1 - nz], [x1 + nx, z1 + nz], [x0 + nx, z0 + nz]], y, cell, [[0.1, 0], [0.9, 0], [0.9, 1], [0.1, 1]], col);
  }
  // 9-slice soft contact shadow around rect [x0,x1]x[z0,z1] (centre left out: it's under the boxes)
  ao(x0, z0, x1, z1, pad, col, y = 0.009) {
    const X = [x0 - pad, x0, x1, x1 + pad], Z = [z0 - pad, z0, z1, z1 + pad], S = [0, 0.5, 0.5, 1];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      if (i === 1 && j === 1) continue;
      this.raw([[X[i], Z[j]], [X[i + 1], Z[j]], [X[i + 1], Z[j + 1]], [X[i], Z[j + 1]]], y, CELL.AO, [[S[i], S[j]], [S[i + 1], S[j]], [S[i + 1], S[j + 1]], [S[i], S[j + 1]]], col);
    }
  }
  text(str, x, z, h, a, col, y = 0.013) { // painted glyphs, reading upright when looking along -z (a=0)
    const w = h * 0.62, n = str.length, ca = Math.cos(a), sa = Math.sin(a);
    for (let k = 0; k < n; k++) {
      const gi = GLYPHS.indexOf(str[k]); if (gi < 0) continue;
      const off = (k - (n - 1) / 2) * w * 0.92;
      this.quad(x + off * ca, z - off * sa, w * 1.25, h, a, CELL.GLYPH0 + gi, col, y, [[0.1, 0], [0.9, 0], [0.9, 1], [0.1, 1]]);
    }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 4));
    g.setIndex(this.i); g.computeVertexNormals(); g.computeBoundingSphere();
    return new THREE.Mesh(g, mat);
  }
}

// footprints: [{x0,z0,x1,z1}] of the container groups (contact shadows); occupied(x,z) tests a point
export function buildGroundDecals({ footprints, occupied, quayZ, columns, apronX = 80, blockIds = [], bays = [] }) {
  const Q = new Quads(), r = makeRng(6061);
  const free = (x, z, m = 1.2) => !occupied(x, z, m);
  const yardX = [-56, 56], yardZ = [-110, 26];
  // contact shadows around every container group
  for (const f of footprints) Q.ao(f.x0, f.z0, f.x1, f.z1, f.pad ?? 0.85, [1, 1, 1, f.k ?? 0.85]);
  // oil stains, patches, cracks, dust on the yard asphalt (only where nothing stands)
  const scatter = (n, fn, X = yardX, Z = yardZ) => { let k = 0, guard = 0; while (k < n && guard++ < n * 40) { const x = X[0] + r() * (X[1] - X[0]), z = Z[0] + r() * (Z[1] - Z[0]); if (!free(x, z)) continue; fn(x, z); k++; } };
  scatter(46, (x, z) => { const s = 0.8 + r() * 2.2; Q.quad(x, z, s * (1 + r() * 0.6), s, r() * 6.28, CELL.OIL0 + Math.floor(r() * 3), [1, 1, 1, 0.55 + r() * 0.4]); });
  scatter(14, (x, z) => { const s = 2 + r() * 4; Q.quad(x, z, s * (1 + r()), s, Math.floor(r() * 4) * Math.PI / 2 + (r() - 0.5) * 0.1, CELL.PATCH, [1, 1, 1, 0.7]); });
  scatter(30, (x, z) => { const s = 1.5 + r() * 3; Q.quad(x, z, s, s * 0.6, r() * 6.28, CELL.CRACK, [1, 1, 1, 0.75]); });
  scatter(18, (x, z) => { const s = 3 + r() * 5; Q.quad(x, z, s, s * 0.7, r() * 6.28, CELL.DUST, [1, 1, 1, 0.6]); });
  // tyre scuffs running down the aisles (straddler/truck lanes) and the cross aisles
  for (let z = 22; z > -108; z -= 5 + r() * 7) { const x = (r() - 0.5) * 6; if (free(x, z, 0.5)) Q.quad(x, z, 1.8, 6 + r() * 8, (r() - 0.5) * 0.08, CELL.TYRE, [1, 1, 1, 0.5 + r() * 0.4], 0.01, [[0, 0], [0, 1], [1, 1], [1, 0]]); }
  for (const [x0, rows] of Object.values(columns)) { const ax = x0 - 2.3; for (let z = 10; z > -108; z -= 9 + r() * 12) if (free(ax, z, 0.8)) Q.quad(ax, z, 1.6, 5 + r() * 7, (r() - 0.5) * 0.05, CELL.TYRE, [1, 1, 1, 0.35 + r() * 0.3], 0.01, [[0, 0], [0, 1], [1, 1], [1, 0]]); }
  for (const z of [-27.8, -70.8]) for (let x = -52; x < 52; x += 6 + r() * 9) if (free(x, z, 0.5)) Q.quad(x, z + (r() - 0.5) * 2, 6 + r() * 8, 1.8, (r() - 0.5) * 0.1, CELL.TYRE, [1, 1, 1, 0.4 + r() * 0.3]);
  // manholes and drains along the main aisle edges
  for (let z = 18; z > -106; z -= 22) { if (free(-3.2, z, 0.6)) Q.quad(-3.2, z, 0.9, 0.9, 0, CELL.DRAIN, [1, 1, 1, 1], 0.011); if (free(3.4, z - 11, 0.6)) Q.quad(3.4, z - 11, 0.9, 0.9, 0, CELL.DRAIN, [1, 1, 1, 1], 0.011); }
  for (const [x, z] of [[1.5, 4], [-1.8, -40], [2.2, -88], [-28, -27.5], [30, -71], [-45, -28], [12, 20]]) if (free(x, z, 0.8)) Q.quad(x, z, 1.1, 1.1, r() * 6, CELL.MANHOLE, [1, 1, 1, 1], 0.011);
  // block IDs at the aisle ends (painted glyphs)
  for (const [txt, x, z] of blockIds) Q.text(txt, x, z, 1.5, 0, [0.95, 0.93, 0.88, 0.8]);
  // ---- apron (concrete): slab seams, stains, skid marks, drains at the quay edge, rail grooves, bay numbers
  const AZ0 = -110.2, AZ1 = quayZ + 0.1;
  for (let z = AZ0 - 5; z > AZ1 + 1; z -= 6.8) Q.strip(-apronX, z, apronX, z, 0.12, CELL.SEAM, [1, 1, 1, 0.75]);
  for (let x = -apronX + 4; x < apronX; x += 8) Q.strip(x, AZ0, x, AZ1 + 0.8, 0.1, CELL.SEAM, [1, 1, 1, 0.65]);
  for (const z of [-124, -149]) for (const dz of [-0.4, 0.4]) Q.strip(-400, z + dz, 400, z + dz, 0.32, CELL.GROOVE, [1, 1, 1, 1], 0.009);
  scatter(40, (x, z) => { const s = 0.8 + r() * 2.6; Q.quad(x, z, s * (1 + r() * 0.7), s, r() * 6.28, CELL.OIL0 + Math.floor(r() * 3), [1, 1, 1, 0.5 + r() * 0.45]); }, [-apronX + 2, apronX - 2], [AZ1 + 2, AZ0 - 1]);
  scatter(14, (x, z) => { const s = 3 + r() * 6; Q.quad(x, z, s, s * 0.7, r() * 6.28, CELL.DUST, [1, 1, 1, 0.5]); }, [-apronX + 2, apronX - 2], [AZ1 + 2, AZ0 - 1]);
  scatter(22, (x, z) => Q.quad(x, z, 1.4, 8 + r() * 10, (r() - 0.5) * 1.2, CELL.SKID, [1, 1, 1, 0.35 + r() * 0.35], 0.01, [[0, 0], [0, 1], [1, 1], [1, 0]]), [-apronX + 4, apronX - 4], [AZ1 + 4, AZ0 - 3]);
  scatter(10, (x, z) => Q.quad(x, z, 1.5, 1.2 + r(), r() * 6, CELL.CRACK, [1, 1, 1, 0.6]), [-apronX + 2, apronX - 2], [AZ1 + 2, AZ0 - 1]);
  for (let x = -82; x <= 78; x += 12) if (x < -9 || x > 3) Q.quad(x + 6, quayZ + 3.2, 1.6, 0.6, 0, CELL.GRATE, [1, 1, 1, 1], 0.011);
  for (const [x, z] of [[-40, -112.5], [-4, -136], [36, -140], [60, -113], [-66, -137]]) if (free(x, z, 0.8)) Q.quad(x, z, 1.1, 1.1, r() * 6, CELL.MANHOLE, [1, 1, 1, 1], 0.011);
  // bay numbers painted in each apron lane
  for (const [txt, x, z] of bays) Q.text(txt, x, z, 1.3, 0, [0.9, 0.88, 0.82, 0.7]);
  for (const [x, z] of [[-4, -116], [4, -116]]) Q.quad(x, z, 2.6, 1.4, x < 0 ? Math.PI / 2 : -Math.PI / 2, CELL.ARROW, [0.92, 0.9, 0.84, 0.55], 0.013);

  const mat = new THREE.MeshStandardMaterial({ map: atlas(), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.82, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, envMapIntensity: 0.4 });
  const mesh = Q.mesh(mat); mesh.receiveShadow = true; mesh.renderOrder = 1;
  return { mesh };
}

// puddles: [[x, z, w, h, rot]]
export function buildPuddles(list) {
  // puddles use their own 2x2 alpha atlas
  const pos = [], uv = [], idx = [];
  list.forEach(([x, z, w, h, a], i) => {
    const q = i % 4, u0 = (q % 2) * 0.5, v0 = Math.floor(q / 2) * 0.5, ca = Math.cos(a), sa = Math.sin(a), b = pos.length / 3;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(x + u * w / 2 * ca - v * h / 2 * sa, 0.014, z - (u * w / 2 * sa + v * h / 2 * ca));
      uv.push(u0 + (u + 1) / 4, v0 + (v + 1) / 4);
    }
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.06, metalness: 0.1, alphaMap: puddleAlpha(), transparent: true, depthWrite: false, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.renderOrder = 2;
  return { mesh };
}
