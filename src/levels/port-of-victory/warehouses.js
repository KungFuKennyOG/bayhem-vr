import * as THREE from 'three';
import * as T from '../../textures.js';
import { box } from '../../geom.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  Port warehouses behind the gate: corrugated siding (tinted per building), roller doors,
//  personnel doors with lamps, window strips that light up at dusk, company signs, roof
//  flashing, downpipes, concrete plinth. Two draw calls for the whole row.
// =====================================================================================

const AW = 1024, AH = 512;
const SIGNS = ['KESTREL LOGISTICS', 'PIER 7 COLD STORE', 'BAYLINE FREIGHT', 'VICTORY STEVEDORING'];

function sidingTexture() {
  const W = 256, H = 256, c = T.makeCanvas(W, H), x = c.getContext('2d'), r = makeRng(808), n = T.makeNoise(809, 4);
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const rib = xx % 16, prof = rib < 3 ? 1.1 : rib < 5 ? 0.82 : rib < 13 ? 0.96 : rib < 15 ? 1.05 : 0.9; // trapezoidal ribs
    let b = prof * (0.86 + 0.14 * T.fbm(n, xx / W, y / H, 4, 4));
    if (y % 128 < 2) b *= 0.7;                          // horizontal panel lap / rail
    if (xx % 128 < 1) b *= 0.8;                         // sheet joint
    const k = (y * W + xx) * 4;
    img.data[k] = b * 222; img.data[k + 1] = b * 218; img.data[k + 2] = b * 212; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // rust / grime streaks running down from the laps
  for (let k = 0; k < 70; k++) { const sx = r() * W, sy = Math.floor(r() * 2) * 128 + 2, L = 10 + r() * 90; const g = x.createLinearGradient(0, sy, 0, sy + L); g.addColorStop(0, `rgba(${90 + r() * 40 | 0},${45 + r() * 20 | 0},20,${0.12 + r() * 0.22})`); g.addColorStop(1, 'rgba(90,50,20,0)'); x.fillStyle = g; x.fillRect(sx, sy, 1 + r() * 2.5, L); }
  // patched sheets (replaced panels, slightly different tone)
  for (let k = 0; k < 3; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + r() * 0.06})`; x.fillRect(Math.floor(r() * 2) * 128, Math.floor(r() * 2) * 128, 128, 128); }
  const t = T.canvasTex(c); t.anisotropy = 4; return t;
}

function detailAtlas() {
  const c = T.makeCanvas(AW, AH), x = c.getContext('2d'), e = T.makeCanvas(AW, AH), ex = e.getContext('2d'), r = makeRng(812);
  x.fillStyle = '#3a3a3c'; x.fillRect(0, 0, AW, AH);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, AW, AH);
  // --- roller door (0,0)-(512,256): frame, slats, hood, dirt, hazard kick strip
  x.fillStyle = '#5c5f62'; x.fillRect(0, 0, 512, 256);
  for (let y = 26; y < 236; y += 6) { x.fillStyle = (y / 6) % 2 ? '#8e9396' : '#7b8084'; x.fillRect(14, y, 484, 5); x.fillStyle = '#4a4d50'; x.fillRect(14, y + 5, 484, 1); }
  x.fillStyle = '#44474a'; x.fillRect(0, 0, 512, 26); x.fillRect(0, 0, 14, 256); x.fillRect(498, 0, 14, 256);
  const dg = x.createLinearGradient(0, 150, 0, 236); dg.addColorStop(0, 'rgba(40,30,20,0)'); dg.addColorStop(1, 'rgba(40,30,20,0.5)'); x.fillStyle = dg; x.fillRect(14, 150, 484, 86);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#d9a514' : '#171512'; x.beginPath(); x.moveTo(i * 32, 256); x.lineTo(i * 32 + 16, 236); x.lineTo(i * 32 + 32, 236); x.lineTo(i * 32 + 16, 256); x.fill(); }
  x.fillStyle = 'rgba(230,226,214,0.85)'; x.font = '400 40px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.fillText('DOOR 4', 256, 70);
  // --- window strip (512,0)-(1024,128): 6 windows, some lit
  for (let i = 0; i < 6; i++) {
    const X = 512 + i * 85 + 6;
    x.fillStyle = '#c8c4ba'; x.fillRect(X, 14, 74, 100);
    x.fillStyle = '#1c2630'; x.fillRect(X + 5, 19, 64, 90);
    x.fillStyle = 'rgba(140,170,200,0.25)'; x.beginPath(); x.moveTo(X + 5, 19); x.lineTo(X + 40, 19); x.lineTo(X + 5, 70); x.fill();
    x.fillStyle = '#c8c4ba'; x.fillRect(X + 35, 19, 4, 90);
    if (i % 3 !== 1) { // lit: warm office light with blinds
      const g = ex.createLinearGradient(0, 19, 0, 109); g.addColorStop(0, '#ffd9a0'); g.addColorStop(1, '#d88a40'); ex.fillStyle = g; ex.fillRect(X + 5, 19, 64, 90);
      ex.fillStyle = '#000'; ex.fillRect(X + 35, 19, 4, 90); for (let y = 22; y < 60; y += 5) ex.fillRect(X + 5, y, 64, 2);
      x.fillStyle = '#6e5a40'; x.fillRect(X + 5, 19, 64, 90);
    }
  }
  // --- personnel door + bulkhead lamp (512,128)-(768,256)
  x.fillStyle = '#5a6268'; x.fillRect(512, 128, 256, 128);
  x.fillStyle = '#2c3e52'; x.fillRect(560, 158, 70, 98); x.fillStyle = '#22303f'; x.fillRect(566, 164, 58, 92);
  x.fillStyle = '#b8b4a8'; x.fillRect(612, 205, 8, 4);
  x.fillStyle = '#e0dccd'; x.fillRect(582, 136, 26, 14); ex.fillStyle = '#ffb060'; ex.fillRect(584, 138, 22, 10);
  x.fillStyle = 'rgba(230,226,214,0.9)'; x.font = '400 18px Anton, Impact, sans-serif'; x.textAlign = 'left'; x.fillText('NO ENTRY', 650, 200);
  // --- vent / louvre (768,128)-(1024,256)
  x.fillStyle = '#6a6e70'; x.fillRect(768, 128, 256, 128); for (let y = 140; y < 248; y += 9) { x.fillStyle = '#2a2c2e'; x.fillRect(780, y, 232, 5); }
  // --- signs, 4 rows of 1024x56 at y 256..480
  SIGNS.forEach((s, i) => {
    const Y = 256 + i * 56, dark = i % 2 === 0;
    x.fillStyle = dark ? '#1d3f6e' : '#e8e2d2'; x.fillRect(0, Y, AW, 56);
    x.fillStyle = dark ? '#d8d2c2' : '#a3241a'; x.fillRect(0, Y, AW, 3); x.fillRect(0, Y + 53, AW, 3);
    x.font = '400 44px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = dark ? '#f2ede0' : '#1d3f6e'; x.fillText(s, AW / 2, Y + 29);
    if (dark) { ex.font = x.font; ex.textAlign = 'center'; ex.textBaseline = 'middle'; ex.fillStyle = '#fff0d0'; ex.fillText(s, AW / 2, Y + 29); }
    for (let k = 0; k < 30; k++) { x.fillStyle = `rgba(60,40,20,${0.05 + r() * 0.12})`; x.fillRect(r() * AW, Y + r() * 50, 2 + r() * 30, 2 + r() * 8); }
  });
  // --- trim (solid light texel band) y 488..512
  x.fillStyle = '#d8d6d0'; x.fillRect(0, 488, AW, 24);
  const map = T.canvasTex(c, { repeat: false }), em = T.canvasTex(e, { repeat: false });
  map.anisotropy = em.anisotropy = 4;
  return { map, em };
}

// uv rect helpers (canvas px -> texture uv, flipY)
const R = (x0, y0, x1, y1) => [x0 / AW, 1 - y1 / AH, x1 / AW, 1 - y0 / AH];
const RECT = {
  door: R(0, 0, 512, 256), windows: R(512, 0, 1024, 128), pdoor: R(512, 128, 768, 256), louvre: R(768, 128, 1024, 256),
  sign: (i) => R(0, 256 + i * 56, 1024, 312 + i * 56), trim: R(4, 492, 1020, 508),
};

class Acc {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  add(g, col, rect, faceCols) { // three geometry (non-indexed or indexed), uv remapped into rect, vertex colour
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, b = this.p.length / 3;
    for (let k = 0; k < pos.count; k++) {
      this.p.push(pos.getX(k), pos.getY(k), pos.getZ(k)); this.n.push(nor.getX(k), nor.getY(k), nor.getZ(k));
      const u = uv.getX(k), v = uv.getY(k);
      this.uv.push(rect ? rect[0] + (rect[2] - rect[0]) * u : u, rect ? rect[1] + (rect[3] - rect[1]) * v : v);
      const fc = faceCols ? faceCols(k, nor.getY(k)) : col; this.c.push(fc[0], fc[1], fc[2]);
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.i.push(b + g.index.getX(k)); else for (let k = 0; k < pos.count; k++) this.i.push(b + k);
  }
  // quad facing direction (nx, nz) centred at (x, y, z), width w (along the facade), height h
  face(x, y, z, w, h, nx, nz, rect, col = [1, 1, 1]) {
    const g = new THREE.PlaneGeometry(w, h); g.rotateY(Math.atan2(nx, nz)); g.translate(x, y, z);
    this.add(g, col, rect);
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere();
    return g;
  }
}

export function buildWarehouses({ seed = 91, z0 = 80, skipX = 20 } = {}) {
  const S = new Acc(), D = new Acc(), r = makeRng(seed);
  const TINTS = [[0.62, 0.64, 0.66], [0.42, 0.5, 0.6], [0.86, 0.82, 0.72], [0.62, 0.36, 0.26], [0.5, 0.56, 0.5], [0.74, 0.74, 0.72]];
  const list = [];
  for (let i = 0; i < 12; i++) {
    const x = -150 + i * 26 + r() * 6, w = 17 + r() * 7, h = 8 + r() * 12, d = 22 + r() * 18, z = z0 + r() * 50 + d / 2;
    if (Math.abs(x) < skipX) continue;
    list.push({ x, z, w, h, d, tint: TINTS[Math.floor(r() * TINTS.length)], sign: Math.floor(r() * SIGNS.length), signP: r(), doors: 1 + Math.floor(r() * 3) });
  }
  for (const b of list) {
    const { x, z, w, h, d, tint } = b, zf = z - d / 2; // front facade faces -z (the yard)
    // siding box (world-scaled uv), roof darker
    const g = box(w, h, d, 6); g.translate(x, h / 2 + 1.0, z);
    S.add(g, tint, null, (k, ny) => ny > 0.5 ? [tint[0] * 0.45, tint[1] * 0.45, tint[2] * 0.47] : tint);
    // concrete plinth 1 m, flashing along the roof edge, corner trims
    const trim = (gg, col) => D.add(gg, col, RECT.trim);
    const pl = box(w + 0.3, 1.0, d + 0.3); pl.translate(x, 0.5, z); trim(pl, [0.5, 0.48, 0.45]);
    const fc = [tint[0] * 0.7, tint[1] * 0.7, tint[2] * 0.7];
    for (const [fw, fd, fx, fz] of [[w + 0.5, 0.35, x, zf - 0.05], [w + 0.5, 0.35, x, z + d / 2 + 0.05], [0.35, d + 0.5, x - w / 2 - 0.05, z], [0.35, d + 0.5, x + w / 2 + 0.05, z]]) { const f = box(fw, 0.5, fd); f.translate(fx, h + 1.0, fz); trim(f, fc); }
    for (const sx of [-1, 1]) { const ct = box(0.3, h, 0.3); ct.translate(x + sx * (w / 2), h / 2 + 1.0, zf); trim(ct, fc); }
    // downpipes at the front corners + a gutter outlet
    for (const sx of [-1, 1]) { const dp = box(0.16, h + 0.6, 0.16); dp.translate(x + sx * (w / 2 - 0.7), (h + 0.6) / 2 + 0.4, zf - 0.18); trim(dp, [0.36, 0.36, 0.38]); const sh = box(0.3, 0.12, 0.4); sh.translate(x + sx * (w / 2 - 0.7), 0.06, zf - 0.3); trim(sh, [0.36, 0.36, 0.38]); }
    // roller doors (with a hood box above) along the front
    const dw = Math.min(5.5, (w - 4) / b.doors - 1.2), dh = Math.min(5.5, h - 1.5);
    for (let k = 0; k < b.doors; k++) {
      const dx = x - w / 2 + 2 + (k + 0.5) * (w - 4) / b.doors;
      D.face(dx, 1.0 + dh / 2, zf - 0.04, dw, dh, 0, -1, RECT.door);
      const hood = box(dw + 0.4, 0.6, 0.5); hood.translate(dx, 1.0 + dh + 0.3, zf - 0.25); trim(hood, [0.32, 0.33, 0.34]);
      const bump = box(dw + 0.8, 0.25, 0.6); bump.translate(dx, 0.12, zf - 0.6); trim(bump, [0.12, 0.11, 0.1]);
    }
    // personnel door with lamp at one end, window strip high on the front, louvre on the side
    D.face(x + w / 2 - 1.6, 1.0 + 1.5, zf - 0.04, 3.0, 3.0 * 0.5 * 2, 0, -1, RECT.pdoor);
    if (h > 9) D.face(x, Math.min(h - 1.2, 1.0 + dh + 2.2), zf - 0.04, Math.min(w - 3, 12), 2.2, 0, -1, RECT.windows);
    for (const sx of [-1, 1]) { D.face(x + sx * (w / 2 + 0.04), 1.0 + h * 0.55, z, 6, 1.5, sx, 0, RECT.windows); D.face(x + sx * (w / 2 + 0.04), 1.0 + h * 0.85, z + d / 4, 3, 1.5, sx, 0, RECT.louvre); }
    // company sign on the front parapet (or on the side)
    const sw = Math.min(w - 2, 14);
    D.face(x, 1.0 + h - 1.2, zf - 0.06, sw, sw * 56 / 1024 * 1.6, 0, -1, RECT.sign(b.sign));
  }
  const { map, em } = detailAtlas();
  const sideMat = new THREE.MeshStandardMaterial({ map: sidingTexture(), vertexColors: true, roughness: 0.62, metalness: 0.35, envMapIntensity: 0.6 });
  const detMat = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffc890, emissiveIntensity: 0, vertexColors: true, roughness: 0.6, metalness: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  detMat.userData.duskEmissive = 1.6;
  const root = new THREE.Group();
  const ms = new THREE.Mesh(S.geo(), sideMat); ms.castShadow = ms.receiveShadow = true;
  const md = new THREE.Mesh(D.geo(), detMat); md.receiveShadow = true;
  root.add(ms, md);
  return { root, list };
}
