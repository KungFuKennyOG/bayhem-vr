import * as THREE from 'three';
import * as T from '../../textures.js';
import { box, at, cyl, mergeGrouped } from '../../geom.js';
import { makeRng } from '../../rng.js';
import { loft, wing, mirrorX, strut, wheelGeo } from './shapes.js';

// =====================================================================================
//  Aircraft: a twin-jet narrowbody airliner (liveries, breaks into four burning pieces)
//  and the hero cargo plane (4 engines, T-tail, open rear ramp with a lit cargo hold).
//  Model space: forward = -z, up = +y, origin on the ground under the main gear.
// =====================================================================================
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------- shared materials / textures
let SH = null;
function shared() {
  if (SH) return SH;
  SH = {};
  SH.panel = panelTexture(); SH.panel.repeat.set(1 / 4, 1 / 4);
  SH.wing = new THREE.MeshStandardMaterial({ color: 0xc7cbcf, map: SH.panel, metalness: 0.55, roughness: 0.42, envMapIntensity: 1.0 });
  SH.wingDark = new THREE.MeshStandardMaterial({ color: 0x8e959b, map: SH.panel, metalness: 0.5, roughness: 0.48 });
  SH.dark = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.6, metalness: 0.3 });
  SH.metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.32, metalness: 0.9, envMapIntensity: 1.2 });
  SH.lip = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.18, metalness: 1.0, envMapIntensity: 1.5 });
  SH.tire = new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.92, metalness: 0 });
  SH.hub = new THREE.MeshStandardMaterial({ color: 0x8c8f92, roughness: 0.4, metalness: 0.8 });
  SH.burnt = new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 1, metalness: 0, emissive: 0x3a0e02, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  SH.fan = new THREE.MeshStandardMaterial({ map: fanTexture(), transparent: false, roughness: 0.35, metalness: 0.85, color: 0xaab0b6 });
  SH.exhaust = new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.55, metalness: 0.7 });
  return SH;
}

// light grey panel lines + rivets (wings, stabilisers), 4 m tile
function panelTexture() {
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), n = T.makeNoise(911, 32);
  const img = x.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const v = 232 + (T.fbm(n, xx / S, y / S, 3, 3) - 0.5) * 26;
    const i = (y * S + xx) * 4; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 1.01; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(40,44,48,0.38)'; x.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(0, k * 64 + 0.5); x.lineTo(S, k * 64 + 0.5); x.stroke(); }
  for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(k * 43 + 0.5, 0); x.lineTo(k * 43 + 0.5, S); x.stroke(); }
  x.fillStyle = 'rgba(50,54,58,0.25)';
  for (let k = 0; k < 4; k++) for (let j = 0; j < 64; j++) x.fillRect(j * 4 + 1, k * 64 + 3, 1, 1);
  return T.canvasTex(c);
}
function fanTexture() {
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#1a1b1d'; x.fillRect(0, 0, S, S);
  x.translate(S / 2, S / 2);
  const N = 24;
  for (let i = 0; i < N; i++) {
    x.save(); x.rotate((i / N) * TAU);
    const g = x.createLinearGradient(0, 0, S / 2, 0); g.addColorStop(0, '#7d8288'); g.addColorStop(1, '#c9ced3');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(S * 0.1, -3); x.quadraticCurveTo(S * 0.3, -12, S * 0.49, -9); x.lineTo(S * 0.49, 2); x.quadraticCurveTo(S * 0.3, 0, S * 0.1, 4); x.fill();
    x.restore();
  }
  x.fillStyle = '#2a2c2f'; x.beginPath(); x.arc(0, 0, S * 0.1, 0, TAU); x.fill();
  return T.canvasTex(c, { repeat: false });
}
function textImage(text, { font = '700 120px Oswald, sans-serif', color = '#123', italic = false, spacing = 0 } = {}) {
  const c = T.makeCanvas(16, 16), x = c.getContext('2d');
  x.font = font; const w = Math.ceil(x.measureText(text).width + text.length * spacing) + 20, h = 170;
  c.width = w; c.height = h;
  const y = c.getContext('2d'); y.font = font; y.fillStyle = color; y.textBaseline = 'middle';
  if (italic) y.setTransform(1, 0, -0.18, 1, 22, 0);
  if (spacing) { let px = 10; for (const ch of text) { y.fillText(ch, px, h / 2); px += y.measureText(ch).width + spacing; } }
  else y.fillText(text, 10, h / 2);
  return { img: c, aspect: w / h };
}
// normalise a geometry's uvs to [0,1] over its uv bounds (fin / tail art)
// mirrorSides: flip the chord direction on the -x surface of a fin so art / text reads correctly from both sides
function normUV(g, mirrorSides = false) {
  const uv = g.attributes.uv, pos = g.attributes.position; let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (u === 0 && v === 0) continue; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  for (let i = 0; i < uv.count; i++) { let v = (uv.getY(i) - v0) / (v1 - v0); if (mirrorSides && pos.getX(i) < -1e-4) v = 1 - v; uv.setXY(i, (uv.getX(i) - u0) / (u1 - u0), v); }
  return g;
}

// =====================================================================================
//  AIRLINER
// =====================================================================================
export const LIVERIES = {
  haven: { name: 'HAVEN AIR', reg: 'N405BJ', base: '#f3f2ee', belly: '#c9ccd0', main: '#0f2c5c', accent: '#f08a1c', fin: '#0f2c5c', sun: '#f39a26', engine: '#0f2c5c' },
  sunwest: { name: 'SUNWEST', reg: 'N27BAY', base: '#f4f1ea', belly: '#f4f1ea', main: '#c4271b', accent: '#f5b521', fin: '#c4271b', sun: '#f5b521', engine: '#e9e6df' },
  pacifica: { name: 'PACIFICA', reg: 'N88PCF', base: '#e5e8ea', belly: '#9aa3aa', main: '#0e6f74', accent: '#7fd3c8', fin: '#0e6f74', sun: '#e8f3f1', engine: '#0e6f74' },
};

// fuselage stations: [z, cy, rx, ry]
const FUS = [
  [-18.62, 3.06, 0.04, 0.04], [-18.5, 3.05, 0.42, 0.38], [-18.25, 3.06, 0.78, 0.72], [-17.85, 3.1, 1.1, 1.04], [-17.25, 3.15, 1.42, 1.36],
  [-16.45, 3.2, 1.68, 1.66], [-15.4, 3.23, 1.86, 1.86], [-14.0, 3.25, 1.95, 1.97], [-10, 3.25, 1.96, 1.98], [-5, 3.25, 1.96, 1.98], [-1.5, 3.25, 1.96, 1.98],
  [2, 3.25, 1.96, 1.98], [6, 3.25, 1.96, 1.98], [10, 3.27, 1.95, 1.97], [12, 3.38, 1.89, 1.86], [14, 3.58, 1.7, 1.6], [16, 3.84, 1.38, 1.24],
  [17.6, 4.04, 0.98, 0.82], [18.7, 4.18, 0.56, 0.44], [19.2, 4.24, 0.22, 0.2], [19.36, 4.25, 0.05, 0.05],
].map(([z, cy, rx, ry]) => ({ z, cy, rx, ry }));
const FZ0 = FUS[0].z, FZ1 = FUS[FUS.length - 1].z;
const BREAK_Z = -1.5;

function airlinerLivery(L) {
  const W = 2048, H = 512, c = T.makeCanvas(W, H), x = c.getContext('2d');
  const len = FZ1 - FZ0;
  const X = (z) => (z - FZ0) / len * W;
  const Y = (th) => (1 - th / TAU) * H;
  const pxPerM = W / len, pyPerRad = H / TAU;
  const R = 1.96;
  x.fillStyle = L.base; x.fillRect(0, 0, W, H);
  // subtle gloss variation / grime
  const n = T.makeNoise(5150, 64), img = x.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y += 1) for (let xx = 0; xx < W; xx += 1) {
    const th = (1 - y / H) * TAU, low = Math.max(0, -Math.cos(th));
    const k = 1 - (T.fbm(n, xx / W * 4, y / H, 4, 3) - 0.5) * 0.05 - low * low * 0.08 * T.fbm(n, xx / W * 8 + 3, y / H * 2, 4, 2);
    const i = (y * W + xx) * 4; img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  x.putImageData(img, 0, 0);
  // belly
  x.fillStyle = L.belly; x.fillRect(0, Y(Math.PI + 0.62), W, Y(Math.PI - 0.62) - Y(Math.PI + 0.62));
  // swoosh cheatline (rises toward the tail), both sides
  const band = (side, th0, th1, col) => {
    x.fillStyle = col; x.beginPath();
    const P = [];
    for (let z = FZ0 + 2.2; z <= FZ1 - 1.4; z += 0.25) { const k = clamp01((z - 3) / 13); const s = k * k * (3 - 2 * k); P.push([z, th0 - s * 0.62, th1 - s * 0.62]); }
    const th = (t) => (side > 0 ? t : TAU - t);
    x.moveTo(X(P[0][0]), Y(th(P[0][1])));
    for (const p of P) x.lineTo(X(p[0]), Y(th(p[1])));
    for (let i = P.length - 1; i >= 0; i--) x.lineTo(X(P[i][0]), Y(th(P[i][2])));
    x.closePath(); x.fill();
  };
  for (const s of [1, -1]) { band(s, 1.86, 2.02, L.main); band(s, 2.05, 2.1, L.accent); }
  // panel lines
  x.strokeStyle = 'rgba(30,34,40,0.13)'; x.lineWidth = 1;
  for (let z = -16; z < 18; z += 1.62) { x.beginPath(); x.moveTo(X(z), 0); x.lineTo(X(z), H); x.stroke(); }
  for (const th of [0.75, 2.4, TAU - 0.75, TAU - 2.4]) { x.beginPath(); x.moveTo(0, Y(th)); x.lineTo(W, Y(th)); x.stroke(); }
  // windows (both sides), doors
  const winTh = 1.32;
  for (const side of [1, -1]) {
    const th = side > 0 ? winTh : TAU - winTh;
    for (let z = -12.9; z < 12.0; z += 0.51) {
      if (Math.abs(z + 0.0) < 0.6 || (z > -0.9 && z < 1.4 && Math.abs(z - 0.25) < 0.45)) continue;
      const wx = X(z), wy = Y(th), ww = 0.23 * pxPerM, wh = (0.33 / R) * pyPerRad;
      x.fillStyle = '#16202c'; x.beginPath(); x.roundRect(wx - ww / 2, wy - wh / 2, ww, wh, 4); x.fill();
      x.fillStyle = 'rgba(160,190,220,0.35)'; x.fillRect(wx - ww / 2 + 2, wy - wh / 2 + 2, ww * 0.4, wh * 0.35);
    }
    // doors: front L1, aft, overwing exits
    for (const [z, w, h, t] of [[-14.55, 0.86, 1.86, 1.2], [12.75, 0.8, 1.8, 1.2], [-0.05, 0.5, 0.95, 1.3], [0.6, 0.5, 0.95, 1.3]]) {
      const tc = side > 0 ? t : TAU - t;
      x.strokeStyle = 'rgba(40,46,54,0.55)'; x.lineWidth = 2;
      x.beginPath(); x.roundRect(X(z) - w / 2 * pxPerM, Y(tc) - h / R / 2 * pyPerRad, w * pxPerM, h / R * pyPerRad, 6); x.stroke();
    }
    // cockpit windows
    x.fillStyle = '#0d141d';
    const cw = (pts) => { x.beginPath(); pts.forEach(([z, t], i) => { const tt = side > 0 ? t : TAU - t; i ? x.lineTo(X(z), Y(tt)) : x.moveTo(X(z), Y(tt)); }); x.closePath(); x.fill(); };
    cw([[-17.78, 0.3], [-17.24, 0.54], [-17.24, 1.12], [-17.78, 1.06]]);
    cw([[-17.16, 0.56], [-16.62, 0.74], [-16.62, 1.18], [-17.16, 1.13]]);
    cw([[-16.55, 0.76], [-16.08, 0.86], [-16.18, 1.2], [-16.55, 1.19]]);
  }
  // titles + registration
  const stamp = (im, zc, thc, hM, side) => {
    const h = hM / R * pyPerRad, w = hM * im.aspect * pxPerM;
    const th = side > 0 ? thc : TAU - thc;
    x.save(); x.translate(X(zc), Y(th)); if (side > 0) x.rotate(Math.PI); x.drawImage(im.img, -w / 2, -h / 2, w, h); x.restore();
  };
  const title = textImage(L.name, { font: '700 130px Oswald, sans-serif', color: L.main, italic: true, spacing: 4 });
  const reg = textImage(L.reg, { font: '600 110px Oswald, sans-serif', color: '#2a2d31' });
  for (const s of [1, -1]) { stamp(title, -5.2, 0.86, 1.15, s); stamp(reg, 15.2, 1.45, 0.3, s); }
  const tex = T.canvasTex(c, { repeat: false });
  tex.anisotropy = 8;
  return tex;
}
function finTexture(L) {
  const S = 512, c = T.makeCanvas(S, S), x = c.getContext('2d');
  // canvas x = height up the fin, canvas y = chord (top = trailing edge)
  x.fillStyle = L.fin; x.fillRect(0, 0, S, S);
  const g = x.createLinearGradient(0, 0, S, 0); g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.4, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  // sunset bands toward the base
  x.fillStyle = L.accent; for (let k = 0; k < 3; k++) x.fillRect(40 + k * 34, 0, 10 + k * 2, S);
  // sun disk + rays
  x.save(); x.translate(S * 0.58, S * 0.52);
  x.fillStyle = L.sun; x.beginPath(); x.arc(0, 0, S * 0.17, 0, TAU); x.fill();
  x.fillStyle = L.fin; for (let k = 0; k < 5; k++) x.fillRect(-S * 0.2, -S * 0.2 + k * S * 0.085, S * 0.4, S * 0.02);
  x.restore();
  return T.canvasTex(c, { repeat: false });
}

const _airCache = {};
function airlinerMats(L) {
  if (_airCache[L.name]) return _airCache[L.name];
  const S = shared();
  const body = new THREE.MeshStandardMaterial({ map: airlinerLivery(L), roughness: 0.3, metalness: 0.05, envMapIntensity: 1.0 });
  const fin = new THREE.MeshStandardMaterial({ map: finTexture(L), roughness: 0.32, metalness: 0.05 });
  const nacelle = new THREE.MeshStandardMaterial({ color: L.engine, roughness: 0.3, metalness: 0.15 });
  // material slots: 0 body 1 wing 2 nacelle 3 dark 4 metal 5 tire 6 fin 7 burnt 8 lip 9 exhaust 10 hub 11 wingDark
  return (_airCache[L.name] = [body, S.wing, nacelle, S.dark, S.metal, S.tire, fin, S.burnt, S.lip, S.exhaust, S.hub, S.wingDark]);
}

function splitRings(rings, z) {
  const a = [], b = [];
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i];
    if (r.z < z) a.push(r); else b.push(r);
    const n = rings[i + 1];
    if (n && r.z < z && n.z >= z) { const t = (z - r.z) / (n.z - r.z), m = { z, cy: r.cy + (n.cy - r.cy) * t, rx: r.rx + (n.rx - r.rx) * t, ry: r.ry + (n.ry - r.ry) * t }; a.push(m); b.unshift(m); }
  }
  return [a, b.sort((p, q) => p.z - q.z)];
}
function ellipseCap(r, back) {
  const g = new THREE.CircleGeometry(1, 28); g.scale(r.rx * 0.97, r.ry * 0.97, 1); if (!back) g.rotateY(Math.PI); g.translate(0, r.cy, r.z); return g;
}

// one engine (nacelle, pylon, fan, plug). Returns parts list + fan mesh geometry (spins separately)
function engine(xc, yc, zIn, { len = 4.6, R = 1.02, pylonTo = null } = {}) {
  const P = [];
  const z0 = zIn, zf = zIn + len;
  const rings = [
    [z0, R * 0.86], [z0 + 0.08, R * 0.97], [z0 + 0.35, R * 1.0], [z0 + len * 0.45, R * 0.99], [z0 + len * 0.78, R * 0.88], [zf, R * 0.7],
  ].map(([z, r]) => ({ z, cy: yc, cx: xc, rx: r, ry: r }));
  P.push([loft(rings, { segs: 28 }), 2]);
  // polished intake lip
  P.push([loft([{ z: z0 - 0.02, cy: yc, cx: xc, rx: R * 0.8, ry: R * 0.8 }, { z: z0 + 0.05, cy: yc, cx: xc, rx: R * 0.9, ry: R * 0.9 }, { z: z0 + 0.14, cy: yc, cx: xc, rx: R * 0.975, ry: R * 0.975 }], { segs: 28 }), 8]);
  // intake tunnel (inside)
  P.push([loft([{ z: z0 - 0.02, cy: yc, cx: xc, rx: R * 0.8, ry: R * 0.8 }, { z: z0 + 0.5, cy: yc, cx: xc, rx: R * 0.82, ry: R * 0.82 }], { segs: 28, inside: true }), 3]);
  // core cowl + exhaust plug
  P.push([loft([{ z: zf - 0.1, cy: yc, cx: xc, rx: R * 0.66, ry: R * 0.66 }, { z: zf + 0.6, cy: yc, cx: xc, rx: R * 0.5, ry: R * 0.5 }, { z: zf + 1.0, cy: yc, cx: xc, rx: R * 0.4, ry: R * 0.4 }], { segs: 22 }), 9]);
  P.push([loft([{ z: zf + 0.95, cy: yc, cx: xc, rx: R * 0.3, ry: R * 0.3 }, { z: zf + 1.6, cy: yc, cx: xc, rx: R * 0.04, ry: R * 0.04 }], { segs: 16 }), 3]);
  // spinner
  P.push([loft([{ z: z0 + 0.12, cy: yc, cx: xc, rx: 0.02, ry: 0.02 }, { z: z0 + 0.3, cy: yc, cx: xc, rx: R * 0.16, ry: R * 0.16 }, { z: z0 + 0.5, cy: yc, cx: xc, rx: R * 0.22, ry: R * 0.22 }], { segs: 16 }), 4]);
  // pylon to the wing
  if (pylonTo !== null) P.push([at(box(0.32, Math.max(0.3, pylonTo - yc - R * 0.7), len * 0.85), xc, (yc + R * 0.7 + pylonTo) / 2, z0 + len * 0.55), 2]);
  const fan = new THREE.CircleGeometry(R * 0.81, 28); fan.rotateY(Math.PI);
  return { parts: P, fan, fanPos: new THREE.Vector3(xc, yc, z0 + 0.48) };
}

// landing gear leg + bogie (two wheels side by side)
function gear(x, z, top, r, spread, parts) {
  parts.push([strut([x, top, z], [x, r, z], 0.11, 10), 4]);
  parts.push([strut([x, r + 0.55, z - 0.05], [x, top - 0.2, z + 0.65], 0.05, 6), 4]);
  const { tire, hub } = wheelGeo(r, 0.34);
  for (const s of [-1, 1]) { parts.push([tire.clone().translate(x + s * spread, r, z), 5]); parts.push([hub.clone().translate(x + s * spread, r, z), 10]); }
  parts.push([at(cyl(0.06, 0.06, spread * 2 + 0.2, 8), x, r, z, 0, 0, Math.PI / 2), 4]);
}

export function buildAirliner(liveryKey = 'haven') {
  const L = LIVERIES[liveryKey] || LIVERIES.haven;
  const mats = airlinerMats(L);
  const NM = mats.length;
  const [ringsF, ringsA] = splitRings(FUS, BREAK_Z);
  const nose = [], aft = [], wl = [], wr = [];
  const segs = 40;
  nose.push([loft(ringsF, { segs, zMin: FZ0, zMax: FZ1 }), 0]);
  aft.push([loft(ringsA, { segs, zMin: FZ0, zMax: FZ1 }), 0]);
  nose.push([ellipseCap(ringsF[ringsF.length - 1], true), 7]);
  aft.push([ellipseCap(ringsA[0], false), 7]);
  // wing-body fairing (belly)
  nose.push([loft([{ z: -6.5, cy: 2.05, rx: 0.6, ry: 0.3 }, { z: -5.5, cy: 1.75, rx: 1.75, ry: 0.55 }, { z: -2, cy: 1.62, rx: 2.15, ry: 0.62 }, { z: BREAK_Z, cy: 1.62, rx: 2.15, ry: 0.62 }], { segs: 24 }), 11]);
  aft.push([loft([{ z: BREAK_Z, cy: 1.62, rx: 2.15, ry: 0.62 }, { z: 3, cy: 1.62, rx: 2.1, ry: 0.6 }, { z: 6.5, cy: 1.9, rx: 1.35, ry: 0.42 }, { z: 8.5, cy: 2.25, rx: 0.4, ry: 0.2 }], { segs: 24 }), 11]);
  // wings (right, mirrored left)
  const wSec = [
    { le: [0.9, 1.78, -3.6], chord: 7.2, t: 0.86 },
    { le: [6.3, 2.26, -0.62], chord: 4.4, t: 0.5 },
    { le: [12, 2.76, 2.0], chord: 2.8, t: 0.3 },
    { le: [17.05, 3.2, 4.4], chord: 1.45, t: 0.15 },
  ];
  const wingR = [];
  wingR.push([wing(wSec, { span: 'x', n: 10, capTip: true }), 1]);
  // winglet
  wingR.push([wing([{ le: [17.07, 3.18, 4.45], chord: 1.4, t: 0.12 }, { le: [17.42, 5.05, 5.6], chord: 0.62, t: 0.06 }], { span: 'y', n: 6 }), 6]);
  // engine
  const eng = engine(5.05, 1.42, -5.55, { len: 4.6, R: 1.02, pylonTo: 2.16 });
  wingR.push(...eng.parts);
  // main gear
  gear(2.95, 1.55, 2.0, 0.56, 0.34, wingR);
  for (const [g, m] of wingR) { wr.push([g, m]); wl.push([mirrorX(g), m]); }
  // nose gear
  gear(0, -14.3, 1.6, 0.38, 0.22, nose);
  // horizontal stabilisers
  const hs = [{ le: [0.5, 3.95, 13.6], chord: 3.9, t: 0.36 }, { le: [3.4, 4.25, 15.4], chord: 2.4, t: 0.22 }, { le: [7.0, 4.6, 17.4], chord: 1.25, t: 0.11 }];
  const hsG = wing(hs, { span: 'x', n: 8 });
  aft.push([hsG, 1], [mirrorX(hsG), 1]);
  // vertical fin (+ dorsal fillet)
  const fin = normUV(wing([{ le: [0, 4.6, 10.4], chord: 7.6, t: 0.42 }, { le: [0, 6.0, 12.9], chord: 5.0, t: 0.38 }, { le: [0, 11.95, 17.45], chord: 1.95, t: 0.15 }], { span: 'y', n: 9 }));
  aft.push([fin, 6]);
  // APU exhaust
  aft.push([at(cyl(0.12, 0.12, 0.3, 10), 0, 4.25, 19.42, Math.PI / 2, 0, 0), 9]);
  // antennas
  aft.push([at(box(0.03, 0.35, 0.25), 0, 5.35, 2.6, -0.3), 4]); nose.push([at(box(0.03, 0.3, 0.22), 0, 5.3, -8, -0.3), 4]);

  const root = new THREE.Group();
  const mk = (list, name) => {
    const g = new THREE.Group(); g.name = name;
    const { geometry } = mergeGrouped(list, NM);
    const m = new THREE.Mesh(geometry, mats); m.castShadow = true; m.receiveShadow = true;
    g.add(m); root.add(g); g.userData.mesh = m;
    return g;
  };
  const parts = { nose: mk(nose, 'nose'), aft: mk(aft, 'aft'), wingL: mk(wl, 'wingL'), wingR: mk(wr, 'wingR') };
  // spinning fans
  const fans = [];
  for (const [side, part] of [[1, parts.wingR], [-1, parts.wingL]]) {
    const f = new THREE.Mesh(eng.fan, shared().fan); f.position.copy(eng.fanPos); f.position.x *= side; part.add(f); fans.push(f);
  }
  // pivot points for breakup physics (centre of mass of each piece, model space)
  parts.nose.userData.com = new THREE.Vector3(0, 3, -9.5); parts.nose.userData.half = new THREE.Vector3(2.1, 2.0, 8.6);
  parts.aft.userData.com = new THREE.Vector3(0, 4, 8.5); parts.aft.userData.half = new THREE.Vector3(2.0, 2.4, 10.2);
  parts.wingR.userData.com = new THREE.Vector3(7, 2.2, 0.5); parts.wingR.userData.half = new THREE.Vector3(7.5, 0.9, 2.6);
  parts.wingL.userData.com = new THREE.Vector3(-7, 2.2, 0.5); parts.wingL.userData.half = new THREE.Vector3(7.5, 0.9, 2.6);
  const anchors = {
    navL: new THREE.Vector3(-17.15, 3.25, 5.0), navR: new THREE.Vector3(17.15, 3.25, 5.0), tail: new THREE.Vector3(0, 4.25, 19.5),
    beaconTop: new THREE.Vector3(0, 5.25, 1.2), beaconBot: new THREE.Vector3(0, 1.0, 0.2),
    landL: new THREE.Vector3(-2.6, 1.9, -3.2), landR: new THREE.Vector3(2.6, 1.9, -3.2), taxi: new THREE.Vector3(0, 1.25, -14.5),
    engL: new THREE.Vector3(-5.05, 1.42, -3.2), engR: new THREE.Vector3(5.05, 1.42, -3.2),
    exhaustL: new THREE.Vector3(-5.05, 1.42, 0.7), exhaustR: new THREE.Vector3(5.05, 1.42, 0.7),
    tankL: new THREE.Vector3(-6, 2.3, 0.5), tankR: new THREE.Vector3(6, 2.3, 0.5), cockpit: new THREE.Vector3(0, 3.6, -16.4),
  };
  // hit volumes (model space AABBs) for bullets / grenades: fuselage + engines
  const hit = [
    { name: 'fus', min: [-1.96, 1.3, -18.6], max: [1.96, 5.2, 19.3] },
    { name: 'engL', min: [-6.1, 0.4, -5.6], max: [-4.0, 2.45, -0.4] },
    { name: 'engR', min: [4.0, 0.4, -5.6], max: [6.1, 2.45, -0.4] },
    { name: 'wingL', min: [-17.2, 1.7, -3.6], max: [-1.9, 3.3, 5.8] },
    { name: 'wingR', min: [1.9, 1.7, -3.6], max: [17.2, 3.3, 5.8] },
  ];
  return { root, parts, fans, anchors, hit, info: { len: 38, span: 34.8 } };
}

// =====================================================================================
//  CARGO PLANE  (four turbofans, high wing, T-tail, rear ramp + upper door, lit hold)
// =====================================================================================
export const CARGO = {
  floorY: 1.95, holdZ0: -15.5, holdZ1: 10.2, holdHalfW: 2.75, holdH: 4.0,
  hinge: new THREE.Vector3(0, 1.95, 10.2), rampLen: 6.4, gearZ: 1.2, noseGearZ: -20.5,
};
const CF = [ // [z, cy, rx, ry, sq]
  [-27.2, 4.3, 0.06, 0.06, 2], [-27.0, 4.25, 0.9, 0.75, 2], [-26.5, 4.25, 1.75, 1.55, 2.1], [-25.6, 4.3, 2.55, 2.4, 2.2], [-24.2, 4.4, 3.1, 3.05, 2.35],
  [-22.4, 4.5, 3.4, 3.35, 2.5], [-20, 4.55, 3.48, 3.45, 2.6], [-12, 4.55, 3.5, 3.48, 2.6], [-4, 4.55, 3.5, 3.48, 2.6], [4, 4.55, 3.5, 3.48, 2.6],
  [8.5, 4.6, 3.48, 3.46, 2.6], [12, 4.95, 3.3, 3.12, 2.45], [16, 5.6, 2.85, 2.55, 2.3], [20, 6.35, 2.2, 1.85, 2.15], [23.5, 7.05, 1.4, 1.1, 2.05],
  [25.6, 7.45, 0.75, 0.55, 2], [26.5, 7.6, 0.2, 0.18, 2],
].map(([z, cy, rx, ry, sq]) => ({ z, cy, rx, ry, sq }));
const CZ0 = CF[0].z, CZ1 = CF[CF.length - 1].z;

function cargoLivery() {
  const W = 2048, H = 512, c = T.makeCanvas(W, H), x = c.getContext('2d');
  const len = CZ1 - CZ0, X = (z) => (z - CZ0) / len * W, Y = (th) => (1 - th / TAU) * H;
  const pxPerM = W / len, pyPerRad = H / TAU, R = 3.48;
  const n = T.makeNoise(7310, 64), img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const th = (1 - y / H) * TAU, low = Math.max(0, -Math.cos(th));
    let v = 138 + (T.fbm(n, xx / W * 6, y / H * 1.5, 4, 3) - 0.5) * 22 - low * 14;
    // exhaust soot streaks behind the engines along the upper sides
    const i = (y * W + xx) * 4; img.data[i] = v * 0.98; img.data[i + 1] = v * 1.02; img.data[i + 2] = v * 1.07; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(20,22,26,0.32)'; x.lineWidth = 1;
  for (let z = -24; z < 26; z += 1.4) { x.beginPath(); x.moveTo(X(z), 0); x.lineTo(X(z), H); x.stroke(); }
  for (const th of [0.5, 1.1, 1.9, 2.6, TAU - 0.5, TAU - 1.1, TAU - 1.9, TAU - 2.6]) { x.beginPath(); x.moveTo(0, Y(th)); x.lineTo(W, Y(th)); x.stroke(); }
  // rivets
  x.fillStyle = 'rgba(30,32,36,0.25)';
  for (let z = -24; z < 26; z += 1.4) for (let y = 0; y < H; y += 6) x.fillRect(X(z) + 2, y, 1, 1);
  // anti-glare panel + cockpit glazing
  for (const side of [1, -1]) {
    x.fillStyle = '#16181b';
    const th = (t) => (side > 0 ? t : TAU - t);
    x.beginPath(); x.moveTo(X(-26.9), Y(th(0.02))); x.lineTo(X(-24.4), Y(th(0.02))); x.lineTo(X(-24.9), Y(th(0.55))); x.lineTo(X(-26.4), Y(th(0.75))); x.fill();
    x.fillStyle = '#0b1219';
    const cw = (pts) => { x.beginPath(); pts.forEach(([z, t], i) => (i ? x.lineTo(X(z), Y(th(t))) : x.moveTo(X(z), Y(th(t))))); x.closePath(); x.fill(); };
    cw([[-26.3, 0.42], [-25.55, 0.5], [-25.55, 0.98], [-26.3, 0.95]]);
    cw([[-25.45, 0.52], [-24.65, 0.62], [-24.65, 1.05], [-25.45, 1.0]]);
    cw([[-24.55, 0.64], [-23.9, 0.72], [-24.0, 1.08], [-24.55, 1.07]]);
    x.fillStyle = '#16181b';
    // crew door + a couple of portholes
    x.strokeStyle = 'rgba(20,22,25,0.6)'; x.lineWidth = 2;
    x.beginPath(); x.roundRect(X(-20.5), Y(th(1.42)) - (2.0 / R * pyPerRad) / 2, 1.0 * pxPerM, 2.0 / R * pyPerRad, 5); x.stroke();
    x.fillStyle = '#0b1219';
    for (const z of [-17, -9, -1, 6]) { x.beginPath(); x.arc(X(z), Y(th(1.3)), 7, 0, TAU); x.fill(); }
    // red stripe + markings
    x.fillStyle = '#7a1b12';
    x.fillRect(X(-22), Y(th(side > 0 ? 1.62 : 1.58)) - 3, 46 * pxPerM, 6);
  }
  const stamp = (im, zc, thc, hM, side) => { const h = hM / R * pyPerRad, w = hM * im.aspect * pxPerM, th = side > 0 ? thc : TAU - thc; x.save(); x.translate(X(zc), Y(th)); if (side > 0) x.rotate(Math.PI); x.drawImage(im.img, -w / 2, -h / 2, w, h); x.restore(); };
  const t1 = textImage('STRATOFREIGHTER', { font: '600 120px Oswald, sans-serif', color: 'rgba(28,30,34,0.85)', spacing: 18 });
  const t2 = textImage('NO STEP', { font: '600 90px Oswald, sans-serif', color: 'rgba(28,30,34,0.7)' });
  for (const s of [1, -1]) { stamp(t1, -6, 1.05, 0.95, s); stamp(t2, -20.5, 0.35, 0.22, s); }
  const tex = T.canvasTex(c, { repeat: false }); tex.anisotropy = 8;
  return tex;
}
function cargoFinTexture() {
  const S = 512, c = T.makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#5b6168'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#7a1b12'; x.fillRect(S * 0.62, 0, S * 0.07, S);
  // canvas x = height, canvas y = chord (down = toward the nose on the +x side): rotate text 90° clockwise
  const t = textImage('VX 27', { font: '700 140px Oswald, sans-serif', color: '#e8e2d6' });
  x.save(); x.translate(S * 0.4, S * 0.42); x.rotate(Math.PI / 2); x.drawImage(t.img, -t.aspect * 40, -40, t.aspect * 80, 80); x.restore();
  return T.canvasTex(c, { repeat: false });
}
function holdTexture() {
  // ribs, quilted insulation blankets, a stencil here and there (u = along the hull, v = around)
  const W = 1024, H = 256, c = T.makeCanvas(W, H), x = c.getContext('2d'), n = T.makeNoise(3121, 32);
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const q = 0.75 + 0.25 * Math.cos((xx % 32) / 32 * TAU) * Math.cos((y % 24) / 24 * TAU);
    const v = (60 + T.fbm(n, xx / W * 8, y / H * 2, 4, 3) * 30) * q;
    const i = (y * W + xx) * 4; img.data[i] = v * 1.02; img.data[i + 1] = v * 1.04; img.data[i + 2] = v * 0.88; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.fillStyle = '#2a2c2e'; for (let k = 0; k < W; k += 64) x.fillRect(k, 0, 9, H);
  x.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < W; k += 64) x.fillRect(k + 9, 0, 3, H);
  return T.canvasTex(c);
}
function floorTexture() {
  const W = 256, H = 512, c = T.makeCanvas(W, H), x = c.getContext('2d'), n = T.makeNoise(3170, 32);
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const plate = ((xx >> 3) + (y >> 3)) % 2 ? 1 : 0.94;
    const v = (78 + T.fbm(n, xx / W * 3, y / H * 6, 4, 3) * 40) * plate;
    const i = (y * W + xx) * 4; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 1.04; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // roller tracks
  for (const u of [0.18, 0.36, 0.64, 0.82]) { x.fillStyle = '#222326'; x.fillRect(u * W - 10, 0, 20, H); x.fillStyle = '#7c7f84'; for (let y = 4; y < H; y += 18) { x.fillRect(u * W - 7, y, 14, 9); } }
  // tie-down rings
  x.fillStyle = '#c3a03a'; for (let y = 20; y < H; y += 64) for (const u of [0.07, 0.5, 0.93]) { x.beginPath(); x.arc(u * W, y, 5, 0, TAU); x.fill(); }
  // yellow edge chevrons at the end (ramp edge)
  return T.canvasTex(c);
}

let _cargoMats = null;
function cargoMats() {
  if (_cargoMats) return _cargoMats;
  const S = shared();
  const body = new THREE.MeshStandardMaterial({ map: cargoLivery(), roughness: 0.62, metalness: 0.35, envMapIntensity: 0.8 });
  const fin = new THREE.MeshStandardMaterial({ map: cargoFinTexture(), roughness: 0.6, metalness: 0.35 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x6a7077, map: S.panel, roughness: 0.62, metalness: 0.22 });
  const hold = new THREE.MeshStandardMaterial({ map: holdTexture(), roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide, emissive: 0x3a0806, emissiveIntensity: 0.0 });
  const floorT = floorTexture(); floorT.repeat.set(1, 3);
  const floor = new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.55, metalness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd8a51c, roughness: 0.6, metalness: 0.2 });
  const redLamp = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a08, emissiveIntensity: 1.7 });
  const crate = new THREE.MeshStandardMaterial({ color: 0x4d5a36, roughness: 0.85 });
  const net = new THREE.MeshStandardMaterial({ color: 0x2b2a24, roughness: 0.9 });
  // 0 body 1 grey(wing) 2 nacelle 3 dark 4 metal 5 tire 6 fin 7 hold 8 lip 9 exhaust 10 hub 11 floor 12 yellow 13 redLamp 14 crate 15 net
  return (_cargoMats = [body, grey, grey, S.dark, S.metal, S.tire, fin, hold, S.lip, S.exhaust, S.hub, floor, yellow, redLamp, crate, net]);
}

export function buildCargoPlane() {
  const mats = cargoMats(), NM = mats.length;
  const C = CARGO;
  const P = [];
  // fuselage: full rings forward of the hold end, aft section opens at the bottom over the ramp / door
  const [fwd, aftR] = splitRings(CF, C.holdZ1);
  P.push([loft(fwd.map(r => ({ ...r })), { segs: 44, zMin: CZ0, zMax: CZ1 }), 0]);
  // aft: open at the bottom over the ramp (lined inside), then a closed tail cone
  const open = 1.45, OPEN_END = 20.5;
  const [aftOpen, tailCone] = splitRings(aftR, OPEN_END);
  P.push([loft(aftOpen, { segs: 40, theta0: -Math.PI + open, theta1: Math.PI - open, zMin: CZ0, zMax: CZ1 }), 0]);
  P.push([loft(aftOpen.map(r => ({ ...r, rx: r.rx - 0.12, ry: r.ry - 0.12 })), { segs: 32, theta0: -Math.PI + open, theta1: Math.PI - open, inside: true }), 7]);
  P.push([loft(tailCone, { segs: 40, zMin: CZ0, zMax: CZ1 }), 0]);
  P.push([ellipseCap(tailCone[0], true), 3]);
  // skin edges of the opening (thin frame so the cut never looks paper-thin)
  for (const s of [-1, 1]) for (let i = 0; i < aftOpen.length - 1; i++) {
    const a = aftOpen[i], b = aftOpen[i + 1], th = Math.PI - open;
    const e = (r) => [s * Math.pow(Math.sin(th), 2 / (r.sq ?? 2)) * r.rx * 0.985, r.cy - Math.pow(Math.abs(Math.cos(th)), 2 / (r.sq ?? 2)) * r.ry * 0.985, r.z];
    P.push([strut(e(a), e(b), 0.06, 6), 4]);
  }
  // hold interior: an inner hull + floor + bulkhead rings
  const IR = (z, top) => ({ z, cy: C.floorY + 2.05, rx: 2.95, ry: 2.15, sq: 2.6 });
  P.push([loft([IR(C.holdZ0), IR(-4), IR(4), IR(C.holdZ1 + 0.6)], { segs: 30, theta0: -Math.PI + 0.62, theta1: Math.PI - 0.62, inside: true }), 7]);
  P.push([at(box(2 * C.holdHalfW, 0.12, C.holdZ1 - C.holdZ0 + 0.6), 0, C.floorY - 0.06, (C.holdZ0 + C.holdZ1 + 0.6) / 2), 11]);
  // forward bulkhead
  P.push([at(box(5.9, 4.3, 0.2), 0, C.floorY + 2.1, C.holdZ0), 7]);
  // aft opening frame (yellow / black) around the ramp mouth
  for (const sx of [-1, 1]) { P.push([at(box(0.16, 3.9, 0.22), sx * 2.86, C.floorY + 1.95, C.holdZ1 + 0.5), 4]); P.push([at(box(0.17, 0.5, 0.23), sx * 2.86, C.floorY + 0.25, C.holdZ1 + 0.5), 12]); }
  // cargo: pallets of crates with nets + a lashed armoured car silhouette further in
  const r = makeRng(2701);
  for (const [z, w, h] of [[-12.5, 2.0, 1.6], [-9.6, 1.6, 2.0], [-6.7, 1.6, 1.3], [-3.8, 1.5, 1.7], [-0.9, 1.5, 1.2], [2.0, 1.5, 1.9], [4.9, 1.4, 1.1]]) {
    for (const s of [-1, 1]) {
      if (z > 3 && s > 0) continue;
      const px = s * (2.62 - w / 2 - 0.12);
      P.push([at(box(w, 0.12, 2.6), px, C.floorY + 0.06, z), 4]);
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) P.push([at(box(w * (0.45 + r() * 0.1), h * (0.4 + r() * 0.3), 1.1 + r() * 0.3), px + (k % 2 - 0.5) * w * 0.48, C.floorY + 0.12 + h * 0.25 + (k > 1 ? h * 0.42 : 0), z + (r() - 0.5) * 0.8), 14]);
      P.push([at(box(w * 1.02, 0.04, 2.5), px, C.floorY + 0.14 + h, z), 15]);
    }
  }
  // side seats folded up along the walls + red night lamps
  for (const s of [-1, 1]) {
    P.push([at(box(0.08, 0.5, 20), s * 2.72, C.floorY + 1.35, -3), 15]);
    for (let z = -13; z <= 8; z += 4.2) P.push([at(box(0.06, 0.16, 0.5), s * 2.62, C.floorY + 3.3, z), 13]);
  }
  for (let z = -13; z <= 8; z += 4.2) P.push([at(box(0.5, 0.06, 0.16), 0, C.floorY + 4.08, z), 13]);
  // sponsons (main gear pods)
  for (const s of [-1, 1]) P.push([loft([{ z: -6, cy: 1.85, cx: s * 3.2, rx: 0.3, ry: 0.6 }, { z: -4.5, cy: 1.75, cx: s * 3.4, rx: 1.0, ry: 1.0 }, { z: 6.5, cy: 1.75, cx: s * 3.4, rx: 1.05, ry: 1.05 }, { z: 9.5, cy: 2.3, cx: s * 3.25, rx: 0.4, ry: 0.5 }], { segs: 16 }), 1]);
  // wings (high, slight anhedral) + engines on pylons
  const wS = [{ le: [1.4, 7.95, -6.4], chord: 10.2, t: 1.2 }, { le: [9, 7.62, -2.0], chord: 6.8, t: 0.82 }, { le: [17.5, 7.25, 2.3], chord: 4.4, t: 0.5 }, { le: [25.6, 6.95, 6.6], chord: 2.4, t: 0.24 }];
  const wR = [[wing(wS, { span: 'x', n: 10 }), 1]];
  // winglet
  wR.push([wing([{ le: [25.62, 6.95, 6.65], chord: 2.2, t: 0.18 }, { le: [26.4, 9.3, 8.0], chord: 1.0, t: 0.08 }], { span: 'y', n: 6 }), 1]);
  // engine pods
  const engs = [];
  for (const [ex, ey] of [[7.4, 5.95], [14.7, 5.55]]) {
    const zIn = -9.2 + ex * 0.5;
    const e = engine(ex, ey, zIn, { len: 5.4, R: 1.12, pylonTo: 7.8 - ex * 0.04 });
    wR.push(...e.parts); engs.push(e);
  }
  for (const [g, m] of wR) { P.push([g, m], [mirrorX(g), m]); }
  // wing-body fairing on top
  P.push([loft([{ z: -9, cy: 7.75, rx: 0.4, ry: 0.2 }, { z: -6.5, cy: 7.85, rx: 1.6, ry: 0.42 }, { z: 4, cy: 7.85, rx: 1.7, ry: 0.42 }, { z: 7.5, cy: 7.55, rx: 0.6, ry: 0.2 }], { segs: 18 }), 0]);
  // T-tail
  const fin = normUV(wing([{ le: [0, 7.5, 13.0], chord: 9.8, t: 0.6 }, { le: [0, 10.0, 17.8], chord: 6.8, t: 0.5 }, { le: [0, 16.2, 23.4], chord: 4.4, t: 0.32 }], { span: 'y', n: 9 }), true);
  P.push([fin, 6]);
  const hs = wing([{ le: [0.3, 16.25, 22.9], chord: 4.8, t: 0.38 }, { le: [5, 16.1, 24.6], chord: 3.0, t: 0.25 }, { le: [10.2, 15.9, 26.2], chord: 1.7, t: 0.14 }], { span: 'x', n: 8 });
  P.push([hs, 1], [mirrorX(hs), 1]);
  // landing gear: nose + two triple-bogey mains
  gear(0, C.noseGearZ, 2.0, 0.55, 0.32, P);
  for (const s of [-1, 1]) for (const z of [C.gearZ - 1.4, C.gearZ + 1.4]) gear(s * 3.3, z, 1.6, 0.62, 0.38, P);
  const root = new THREE.Group();
  const { geometry } = mergeGrouped(P, NM);
  const mesh = new THREE.Mesh(geometry, mats); mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  // ---- ramp (pivots at the hinge; angle 0 = level with the floor, + lowers it)
  const ramp = new THREE.Group(); ramp.position.copy(C.hinge); root.add(ramp);
  const RP = [];
  RP.push([at(box(5.2, 0.16, C.rampLen), 0, -0.08, C.rampLen / 2), 11]);
  RP.push([at(box(5.2, 0.4, C.rampLen), 0, -0.36, C.rampLen / 2), 0]);
  for (const s of [-1, 1]) RP.push([at(box(0.18, 0.55, C.rampLen), s * 2.6, 0.18, C.rampLen / 2), 12]);
  RP.push([at(box(5.0, 0.06, 0.5), 0, 0.02, C.rampLen - 0.25), 12]);
  // hydraulic rams
  for (const s of [-1, 1]) RP.push([strut([s * 2.45, 0.2, 1.0], [s * 2.45, 1.6, -1.2], 0.07, 8), 4]);
  const rg = mergeGrouped(RP, NM).geometry;
  const rampMesh = new THREE.Mesh(rg, mats); rampMesh.castShadow = true; rampMesh.receiveShadow = true; ramp.add(rampMesh);
  // fans
  const fans = [];
  for (const e of engs) for (const s of [1, -1]) { const f = new THREE.Mesh(e.fan, shared().fan); f.position.copy(e.fanPos); f.position.x *= s; root.add(f); fans.push(f); }
  const anchors = {
    navL: new THREE.Vector3(-26.4, 9.35, 8.0), navR: new THREE.Vector3(26.4, 9.35, 8.0), tail: new THREE.Vector3(0, 16.4, 27.6),
    beaconTop: new THREE.Vector3(0, 8.4, 2), beaconBot: new THREE.Vector3(0, 0.9, -6),
    landL: new THREE.Vector3(-3.3, 2.2, -7.5), landR: new THREE.Vector3(3.3, 2.2, -7.5),
    exhausts: engs.flatMap(e => [new THREE.Vector3(e.fanPos.x, e.fanPos.y, e.fanPos.z + 6.4), new THREE.Vector3(-e.fanPos.x, e.fanPos.y, e.fanPos.z + 6.4)]),
    holdLamps: [], cockpit: new THREE.Vector3(0, 6.1, -24.2),
  };
  for (let z = -13; z <= 8; z += 4.2) { anchors.holdLamps.push(new THREE.Vector3(-2.55, C.floorY + 3.3, z), new THREE.Vector3(2.55, C.floorY + 3.3, z), new THREE.Vector3(0, C.floorY + 4.0, z)); }
  return { root, mesh, ramp, fans, anchors, info: { len: 53.8 },
    setRamp(a) { ramp.rotation.x = a; }, setDoor() {} };
}
