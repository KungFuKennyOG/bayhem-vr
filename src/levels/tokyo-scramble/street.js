import { vendAtlas } from './vending.js';
import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex, signMat } from './kit.js';
import { signAtlas, JP } from './signs.js';
import { signQuad, signMaterial, haloMaterial } from './city.js';
import { CROSS, AVE_E, AVE_S, PLAZA, TAXI, CENTER, CROSS_ST, CURB, MANHOLES, XWAY, KOEN } from './layout.js';
import { signAtlas2 } from './signs2.js';

// =====================================================================================
//  Street level: asphalt / sidewalk / plaza / Center-gai paving (world-space textures, all on the
//  ground light map), curbs, the painted scramble (four zebras + the X), stop lines, 止まれ, lane
//  lines, manholes; and the furniture: LED street lamps, signals (car + pedestrian), white guard
//  rails, utility poles + sagging wires, vending machines, bikes, bins, barricades, the bus shelter,
//  the Center-gai arch.
// =====================================================================================
function noiseFill(g, S, rng, n, a, sz = 2) { for (let i = 0; i < n; i++) { const v = rng(); g.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${a * rng()})`; g.fillRect(rng() * S, rng() * S, sz * (0.5 + rng()), sz * (0.5 + rng())); } }
export function asphaltTex() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), rng = makeRng(31);
  g.fillStyle = '#4c4c4e'; g.fillRect(0, 0, S, S);
  noiseFill(g, S, rng, 26000, 0.22, 1.6);
  // repair patches, oil, tyre polish bands
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '20,20,22' : '70,70,72'},${0.15 + rng() * 0.15})`; const w = 40 + rng() * 140, h = 30 + rng() * 120; g.fillRect(rng() * S, rng() * S, w, h); }
  for (let i = 0; i < 9; i++) { const x = rng() * S, y = rng() * S, r = 6 + rng() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(8,8,10,0.45)'); gr.addColorStop(1, 'rgba(8,8,10,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.strokeStyle = 'rgba(12,12,14,0.6)'; g.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) { let x = rng() * S, y = rng() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  return canvasTex(c, { aniso: 8 });
}
export function sidewalkTex() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), rng = makeRng(32);
  g.fillStyle = '#7d7b76'; g.fillRect(0, 0, S, S);
  const n = 10, t = S / n; // 30 cm tiles over 3 m
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = 0.85 + rng() * 0.25; g.fillStyle = `rgb(${Math.round(122 * v)},${Math.round(119 * v)},${Math.round(113 * v)})`;
    g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
  }
  noiseFill(g, S, rng, 12000, 0.14, 1.6);
  for (let i = 0; i < 18; i++) { const x = rng() * S, y = rng() * S, r = 3 + rng() * 10; g.fillStyle = 'rgba(20,18,16,0.28)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } // gum, stains
  return canvasTex(c, { aniso: 8 });
}
export function plazaTex() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), rng = makeRng(33);
  g.fillStyle = '#4e4b46'; g.fillRect(0, 0, S, S);
  const n = 8, t = S / n; // 60 cm granite over 4.8 m, a darker border course
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const edge = x === 0 || y === 0;
    const v = (edge ? 0.62 : 0.9) + rng() * 0.18; g.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(144 * v)},${Math.round(134 * v)})`;
    g.fillRect(x * t + 2, y * t + 2, t - 3, t - 3);
  }
  noiseFill(g, S, rng, 20000, 0.16, 1.4);
  return canvasTex(c, { aniso: 8 });
}
export function centerTex() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), rng = makeRng(34);
  g.fillStyle = '#3a3230'; g.fillRect(0, 0, S, S);
  // herringbone-ish brick pavers in rust / grey with a diamond motif every 4 m
  const bw = 32, bh = 16;
  for (let y = 0; y < S; y += bh) for (let x = -bw; x < S; x += bw) {
    const ox = ((y / bh) % 2) * bw / 2;
    const k = rng(); const base = k < 0.4 ? [132, 104, 92] : k < 0.85 ? [124, 118, 112] : [150, 128, 108];
    const v = 0.75 + rng() * 0.3;
    g.fillStyle = `rgb(${Math.round(base[0] * v)},${Math.round(base[1] * v)},${Math.round(base[2] * v)})`;
    g.fillRect(x + ox + 1, y + 1, bw - 2, bh - 2);
  }
  g.fillStyle = 'rgba(200,190,170,0.5)'; g.save(); g.translate(S / 2, S / 2); g.rotate(Math.PI / 4); g.fillRect(-60, -60, 120, 120); g.fillStyle = 'rgba(80,60,50,0.6)'; g.fillRect(-46, -46, 92, 92); g.restore();
  noiseFill(g, S, rng, 14000, 0.14, 1.6);
  return canvasTex(c, { aniso: 8 });
}
// road paint: white, worn (alpha), on a transparent atlas. cells: 0 solid / 1 dashes / 2 止まれ / 3 arrow / 4 manhole / 5 diamond / 6 yellow
function markTex() {
  const W = 1024, H = 256, c = makeCanvas(W, H), g = c.getContext('2d'), rng = makeRng(35);
  g.clearRect(0, 0, W, H);
  const cell = (i) => [i * 128, 0];
  // 0: solid white with wear
  g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, 128, 256);
  // 6: solid yellow
  g.fillStyle = '#e8b81e'; g.fillRect(6 * 128, 0, 128, 256);
  // 2: 止まれ (stop) — vertical in the lane, read from the approaching driver
  g.save(); g.translate(2 * 128 + 64, 128); g.fillStyle = '#f2f0ea'; g.font = `900 66px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['止', 'ま', 'れ'].forEach((ch, i) => { g.save(); g.translate(0, (1 - i) * 76); g.scale(1, 1.15); g.fillText(ch, 0, 0); g.restore(); }); g.restore();
  // 3: straight arrow
  g.fillStyle = '#f2f0ea'; g.beginPath(); g.moveTo(3 * 128 + 64, 16); g.lineTo(3 * 128 + 108, 96); g.lineTo(3 * 128 + 78, 96); g.lineTo(3 * 128 + 78, 240); g.lineTo(3 * 128 + 50, 240); g.lineTo(3 * 128 + 50, 96); g.lineTo(3 * 128 + 20, 96); g.closePath(); g.fill();
  // 5: diamond (crosswalk ahead)
  g.strokeStyle = '#f2f0ea'; g.lineWidth = 10; g.beginPath(); g.moveTo(5 * 128 + 64, 20); g.lineTo(5 * 128 + 110, 128); g.lineTo(5 * 128 + 64, 236); g.lineTo(5 * 128 + 18, 128); g.closePath(); g.stroke();
  // 4: manhole (cast iron, Japanese pattern) — drawn opaque
  { const cx = 4 * 128 + 64, cy = 64, r = 60; g.fillStyle = '#2c2a28'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.strokeStyle = '#54504a'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, r - 4, 0, 7); g.stroke();
    for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(cx, cy, 10 + k * 8, k * 0.6, k * 0.6 + 4); g.stroke(); }
    g.fillStyle = '#6a645c'; g.font = `900 16px ${JP}`; g.textAlign = 'center'; g.fillText('ガス', cx, cy + 40);
    // second variant below (sewer, flowers)
    const cy2 = 192; g.fillStyle = '#2a2826'; g.beginPath(); g.arc(cx, cy2, r, 0, 7); g.fill(); g.strokeStyle = '#4e4a44';
    for (let k = 0; k < 8; k++) { g.beginPath(); g.ellipse(cx + Math.cos(k * 0.785) * 28, cy2 + Math.sin(k * 0.785) * 28, 14, 7, k * 0.785, 0, 7); g.stroke(); }
    g.beginPath(); g.arc(cx, cy2, r - 4, 0, 7); g.stroke(); }
  // 1: dashes along v
  g.fillStyle = '#f2f0ea'; g.fillRect(128 + 40, 0, 48, 150);
  // wear: punch holes in the paint
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const x = (i / 4) % W;
    if (x >= 512 && x < 640) continue; // manholes stay solid
    const n = rng();
    if (d[i + 3] > 0) d[i + 3] = Math.round(d[i + 3] * (n < 0.12 ? 0.15 : n < 0.3 ? 0.65 : 0.92));
  }
  g.putImageData(img, 0, 0);
  const t = canvasTex(c, { repeat: false, aniso: 8 });
  return t;
}
const MC = (i, v0 = 0, v1 = 1) => [i / 8 + 0.004, v0, (i + 1) / 8 - 0.004, v1];

export function buildStreet(ctx = {}) {
  const rng = makeRng(707);
  const R = (a, b) => a + (b - a) * rng();
  const root = new THREE.Group(); root.name = 'street';
  const colliders = [], glows = [], lights = [], panes = [];
  // ---------------------------------------------------------------- ground surfaces
  const surf = { asphalt: new Acc(), walk: new Acc(), plaza: new Acc(), center: new Acc() };
  const rect = (A, x0, z0, x1, z1, y, uvS) => A.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / uvS, -z1 / uvS, x1 / uvS, -z0 / uvS]);
  const slab = (A, x0, z0, x1, z1, uvS) => { rect(A, x0, z0, x1, z1, CURB, uvS); A.set({ col: [0.55, 0.53, 0.5] }); A.box(x0, 0, z0, x1, CURB, z1, { faces: 'xXzZ', uvScale: uvS }); A.set({ col: [1, 1, 1] }); };
  // asphalt
  const AS = 8;
  rect(surf.asphalt, -CROSS.half, -CROSS.half, CROSS.half, CROSS.half, 0, AS);
  rect(surf.asphalt, AVE_E.x0, -AVE_E.road, AVE_E.x1 + 20, AVE_E.road, 0, AS);
  rect(surf.asphalt, -AVE_S.road, AVE_S.z0, AVE_S.road, AVE_S.z1 + 20, 0, AS);
  rect(surf.asphalt, TAXI.x0, TAXI.z0, TAXI.x1, TAXI.z1, 0, AS);
  rect(surf.asphalt, KOEN.x0 + 1.5, KOEN.z0, KOEN.x1 - 1.5, KOEN.z1, 0, AS);
  rect(surf.asphalt, -280, CROSS_ST.z0, 280, CROSS_ST.z1, 0, AS);
  // under everything (gaps, far ends): a dark base so nothing shows sky
  rect(surf.asphalt, -340, -300, 340, 320, -0.05, AS);
  // sidewalks: the crossing ring, the avenues
  const W = 3;
  slab(surf.walk, -28, -28, -8, -22, W); slab(surf.walk, 8, -28, 28, -22, W);
  slab(surf.walk, 22, -22, 28, -11, W); slab(surf.walk, 22, 11, 28, 28, W);
  slab(surf.walk, -28, 22, -11, 28, W); slab(surf.walk, 11, 22, 22, 28, W);
  slab(surf.walk, 28, -17, AVE_E.x1 + 20, -11, W); slab(surf.walk, 28, 11, AVE_E.x1 + 20, 17, W);
  slab(surf.walk, -17, 28, -11, AVE_S.z1 + 20, W); slab(surf.walk, 11, 28, 17, AVE_S.z1 + 20, W);
  slab(surf.walk, -28, -22, -22, -11, W);
  slab(surf.walk, KOEN.x0, KOEN.z0, KOEN.x0 + 1.5, -28, W); slab(surf.walk, KOEN.x1 - 1.5, KOEN.z0, KOEN.x1, -17, W);
  // plaza (granite), with the strips either side of the taxi lane
  slab(surf.plaza, PLAZA.x0, PLAZA.z0, TAXI.x0, PLAZA.z1, 4.8);
  slab(surf.plaza, TAXI.x0, PLAZA.z0, -28, TAXI.z0, 4.8); slab(surf.plaza, TAXI.x0, TAXI.z1, -28, PLAZA.z1, 4.8);
  slab(surf.plaza, -28, TAXI.z1, -22, 28, 4.8);
  // Center-gai
  slab(surf.center, -CENTER.half, CENTER.z0 - 1, CENTER.half, CENTER.z1, 4);
  // ---------------------------------------------------------------- curbs (granite caps on every road edge)
  const prop = new Acc({ rm: true });
  const curb = (x0, z0, x1, z1) => { prop.set({ col: hex(0x9a968e), rm: [0.75, 0, 0] }); prop.box(x0, 0, z0, x1, CURB + 0.01, z1, { faces: 'xXzZY' }); };
  curb(28, -11.25, AVE_E.x1 + 20, -11); curb(28, 11, AVE_E.x1 + 20, 11.25);
  curb(-11.25, 28, -11, AVE_S.z1 + 20); curb(11, 28, 11.25, AVE_S.z1 + 20);
  curb(-22, -22.25, -8, -22); curb(8, -22.25, 22, -22); curb(22, -22, 22.25, -11); curb(22, 11, 22.25, 22); curb(-22, 22, -11, 22.25); curb(11, 22, 22, 22.25);
  curb(TAXI.x0 - 0.25, TAXI.z0, TAXI.x0, TAXI.z1); curb(TAXI.x0, TAXI.z0 - 0.25, -22, TAXI.z0); curb(TAXI.x0, TAXI.z1, -22, TAXI.z1 + 0.25);
  // tactile paving (yellow): along the curb at every crossing edge
  const tac = (x0, z0, x1, z1) => { prop.set({ col: hex(0x9a8436), rm: [0.75, 0, 0] }); prop.box(x0, CURB, z0, x1, CURB + 0.012, z1, { faces: 'Y' }); };
  tac(-21, -23, -9, -22.6); tac(9, -23, 21, -22.6); tac(22.6, -21, 23, -12); tac(22.6, 12, 23, 21); tac(-21, 22.6, -12, 23); tac(12, 22.6, 21, 23);
  // the tactile guide line down Center-gai: a row of studded yellow blocks off to one side (not a road line)
  for (let z = -136; z < -30; z += 0.3) { prop.set({ col: hex(Math.round((z + 136) / 0.3) % 2 ? 0x9a8436 : 0x8e7a30), rm: [0.75, 0, 0] }); prop.box(-3.15, CURB, z + 0.01, -2.85, CURB + 0.014, z + 0.29, { faces: 'Y' }); }

  // ---------------------------------------------------------------- road paint
  const mk = new Acc();
  const paint = (cx, cz, w, l, ang, uv, y = 0.012) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = (a, b) => [cx + c * a - s * b, y, cz + s * a + c * b];
    // along l (local z), across w (local x)
    mk.quad(P(-w / 2, l / 2), P(w / 2, l / 2), P(w / 2, -l / 2), P(-w / 2, -l / 2), uv);
  };
  const H = CROSS.half;
  // the four zebras: stripes 0.45 m every 0.9 m, 4 m long, just inside the square's edges
  for (const side of [0, 1, 2, 3]) {
    const ang = side * Math.PI / 2;
    for (let a = -H + 2.2; a < H - 2.2; a += 0.9) {
      const off = H - 2.6;
      const cx = side === 0 ? a : side === 2 ? a : side === 1 ? off : -off;
      const cz = side === 0 ? -off : side === 2 ? off : a;
      paint(cx, cz, 0.45, 4.0, side % 2 ? Math.PI / 2 : 0, MC(0, 0.02, 0.98));
    }
  }
  // the X: two diagonal zebras through the middle
  for (const d of [1, -1]) {
    const ang = d * Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let a = -23; a < 23; a += 0.9) if (Math.abs(a) > 2.2) paint(a * ca, a * sa, 0.45, 4.0, ang, MC(0, 0.02, 0.98));
  }
  // stop lines + 止まれ + diamonds on the approaches
  paint(AVE_E.x0 + 1.2, 5.5, 0.45, 11, 0, MC(0)); paint(AVE_E.x0 + 7, 5.5, 3.2, 5.5, Math.PI / 2, MC(2));
  paint(-5.5, AVE_S.z0 + 1.2, 11, 0.45, 0, MC(0)); paint(-5.5, AVE_S.z0 + 7, 3.2, 5.5, 0, MC(2));
  paint(AVE_E.x0 + 26, -5.5, 2.6, 4.6, Math.PI / 2, MC(5)); paint(AVE_E.x0 + 26, 5.5, 2.6, 4.6, -Math.PI / 2, MC(5));
  for (let x = AVE_E.x0 + 14; x < AVE_E.x1; x += 10) { paint(x, 0, 0.16, 5, Math.PI / 2, MC(0)); paint(x, -5.5, 0.12, 4, Math.PI / 2, MC(0)); paint(x, 5.5, 0.12, 4, Math.PI / 2, MC(0)); }
  for (let z = AVE_S.z0 + 14; z < AVE_S.z1; z += 10) { paint(0, z, 0.16, 5, 0, MC(0)); paint(-5.5, z, 0.12, 4, 0, MC(0)); paint(5.5, z, 0.12, 4, 0, MC(0)); }
  for (let x = -250; x < 250; x += 9) paint(x, (CROSS_ST.z0 + CROSS_ST.z1) / 2, 0.15, 4.5, Math.PI / 2, MC(0));
  paint(AVE_E.x0 + 14, 5.5, 1.4, 5, -Math.PI / 2, MC(3)); paint(-5.5, AVE_S.z0 + 18, 1.4, 5, Math.PI, MC(3));
  // taxi lane: bay lines
  for (let z = TAXI.z0 + 4; z < TAXI.z1; z += 6) paint(-30, z, 0.15, 3.5, Math.PI / 2, MC(0));
  paint(-26, 0, 0.2, TAXI.z1 - TAXI.z0 - 4, 0, MC(6));
  // manholes: Center-gai (the gas main) + a few on the roads
  for (const m of MANHOLES) paint(m.x, m.z, 0.9, 0.9, 0, [4 / 8, 0.5, 5 / 8, 1], CURB + 0.014);
  for (const [x, z] of [[6, -8], [-9, 12], [48, 3], [80, -7], [3, 60], [-3, 95], [130, 6]]) paint(x, z, 0.9, 0.9, 0, [4 / 8, 0, 5 / 8, 0.5]);

  // ---------------------------------------------------------------- furniture
  const sign = new Acc(), halo = new Acc(), arch2 = new Acc();
  const { E: SE } = signAtlas();
  const { E: VE } = vendAtlas(), vacc = new Acc();   // vending fronts: their own hi-res atlas
  // LED street lamps: grey pole, a slim head over the road, cool-white pool
  const lamp = (x, z, dir) => {
    const hx = x + dir[0] * 2.2, hz = z + dir[1] * 2.2;
    prop.set({ col: hex(0x7a7c80), rm: [0.5, 0.6, 0] });
    prop.cyl(x, CURB, z, 0.11, 0.08, 9.0, 8, { cap: false });
    prop.tube([x, 8.9, z], [hx, 9.15, hz], 0.06, 6);
    prop.set({ col: hex(0x4a4c50), rm: [0.5, 0.6, 0] }); prop.box(hx - 0.35, 9.0, hz - 0.22, hx + 0.35, 9.22, hz + 0.22);
    prop.set({ col: [1, 1, 1], rm: [0.3, 0, 3.0] }); prop.box(hx - 0.3, 8.98, hz - 0.17, hx + 0.3, 9.0, hz + 0.17, { faces: 'y' });
    glows.push({ p: [hx, 8.9, hz], color: [2.2, 2.3, 2.5], size: 1.2 });
    lights.push({ x: hx, z: hz, r: 9, color: [0.95, 1.0, 1.08], k: 0.55 });
    colliders.push({ min: [x - 0.15, 0, z - 0.15], max: [x + 0.15, 9, z + 0.15], data: { mat: 'metal', kind: 'pole', thin: true } });
  };
  for (let x = 36; x < AVE_E.x1; x += 24) { lamp(x, -16.2, [0, 1]); lamp(x + 12, 16.2, [0, -1]); }
  for (let z = 40; z < AVE_S.z1; z += 24) { lamp(-16.2, z, [1, 0]); lamp(16.2, z + 12, [-1, 0]); }
  for (const [x, z, d] of [[-27, -27, [1, 1]], [27, -27, [-1, 1]], [27, 27, [-1, -1]], [-27, 27, [1, -1]]]) {
    lamp(x, z, [d[0] * 0.7, d[1] * 0.7]);
    // a tall twin-head mast over the scramble itself (the crossing is lit like a stage)
    const mx = x - d[0] * 1.2, mz = z - d[1] * 1.2;
    prop.set({ col: hex(0x7a7c80), rm: [0.5, 0.6, 0] }); prop.cyl(mx, CURB, mz, 0.16, 0.12, 13, 8, { cap: false });
    for (const k of [-1, 1]) { const hx = mx + d[0] * 2.4 + (k * d[1]) * 0.9, hz = mz + d[1] * 2.4 - (k * d[0]) * 0.9; prop.tube([mx, 12.8, mz], [hx, 13.1, hz], 0.06, 5); prop.set({ col: [1, 1, 1], rm: [0.3, 0, 3] }); prop.box(hx - 0.35, 12.95, hz - 0.35, hx + 0.35, 13.0, hz + 0.35, { faces: 'y' }); prop.set({ col: hex(0x7a7c80), rm: [0.5, 0.6, 0] }); glows.push({ p: [hx, 12.9, hz], color: [2.3, 2.3, 2.4], size: 1.4 }); lights.push({ x: x + d[0] * 9, z: z + d[1] * 9, r: 15, color: [1.0, 1.0, 1.05], k: 0.6 }); }
  }
  for (let z = TAXI.z0 + 6; z < TAXI.z1; z += 14) lamp(TAXI.x0 - 1.2, z, [1, 0]);
  for (const [x, z, c] of [[20, -20, [1.3, 1.1, 1.2]], [20, 20, [1.2, 1.15, 1.25]], [-20, 20, [1.3, 1.1, 0.95]], [-20, -20, [1.25, 1.0, 1.25]], [0, 0, [1.0, 0.9, 1.1]]]) lights.push({ x, z, r: 16, color: c, k: 0.35 });
  // signals at the four corners: car heads (horizontal, 3 lamps) on arms + pedestrian heads
  const signal = (x, z, armDir, pedDir) => {
    prop.set({ col: hex(0x8a8c90), rm: [0.5, 0.5, 0] });
    prop.cyl(x, CURB, z, 0.13, 0.11, 6.6, 8, { cap: true });
    const ax = x + armDir[0] * 5.5, az = z + armDir[1] * 5.5;
    prop.tube([x, 6.2, z], [ax, 6.3, az], 0.07, 6);
    // car head: a long box with three hooded lamps, facing back along the arm's normal
    const nx = -armDir[1], nz = armDir[0];
    const hcx = x + armDir[0] * 4.2, hcz = z + armDir[1] * 4.2;
    prop.set({ col: hex(0x2a2c2e), rm: [0.5, 0.4, 0] });
    prop.box(hcx - Math.abs(armDir[0]) * 0.75 - Math.abs(nx) * 0.18, 5.75, hcz - Math.abs(armDir[1]) * 0.75 - Math.abs(nz) * 0.18, hcx + Math.abs(armDir[0]) * 0.75 + Math.abs(nx) * 0.18, 6.15, hcz + Math.abs(armDir[1]) * 0.75 + Math.abs(nz) * 0.18);
    const lit = Math.floor(rng() * 3);
    [[0.15, 1.6, 0.6], [2.4, 1.6, 0.2], [2.6, 0.3, 0.15]].forEach((c, i) => {
      const px = hcx + armDir[0] * (i - 1) * 0.48 + nx * 0.2, pz = hcz + armDir[1] * (i - 1) * 0.48 + nz * 0.2;
      const on = i === lit;
      prop.set({ col: on ? c.map(v => Math.min(1, v / 2.6)) : [0.05, 0.05, 0.05], rm: [0.3, 0, on ? 4.0 : 0] });
      prop.box(px - 0.15, 5.8, pz - 0.15, px + 0.15, 6.1, pz + 0.15, { faces: nz > 0.5 ? 'Z' : nz < -0.5 ? 'z' : nx > 0.5 ? 'X' : 'x' });
      if (on) glows.push({ p: [px + nx * 0.05, 5.95, pz + nz * 0.05], color: c, size: 0.7 });
    });
    // pedestrian head (blue-green walking figure / red standing)
    const pxh = x + pedDir[0] * 0.25, pzh = z + pedDir[1] * 0.25;
    prop.set({ col: hex(0x2a2c2e), rm: [0.5, 0.4, 0] }); prop.box(pxh - 0.25, 2.6, pzh - 0.25, pxh + 0.25, 3.5, pzh + 0.25);
    const walk = rng() < 0.5;
    { const fx = pxh + pedDir[0] * 0.26, fz = pzh + pedDir[1] * 0.26, yy = walk ? 2.85 : 3.25; prop.set({ col: walk ? [0.1, 0.9, 0.75] : [1, 0.12, 0.08], rm: [0.3, 0, 4.0] }); prop.box(fx - 0.17 * Math.abs(pedDir[1]) - 0.005, yy - 0.17, fz - 0.17 * Math.abs(pedDir[0]) - 0.005, fx + 0.17 * Math.abs(pedDir[1]) + 0.005, yy + 0.17, fz + 0.17 * Math.abs(pedDir[0]) + 0.005); }
    glows.push({ p: [pxh + pedDir[0] * 0.27, walk ? 2.85 : 3.25, pzh + pedDir[1] * 0.27], color: walk ? [0.2, 2.2, 1.8] : [2.6, 0.25, 0.15], size: 0.55 });
    colliders.push({ min: [x - 0.18, 0, z - 0.18], max: [x + 0.18, 6.6, z + 0.18], data: { mat: 'metal', kind: 'pole', thin: true } });
  };
  signal(23.5, -23.5, [0, 1], [-1, 0]); signal(23.5, 23.5, [-1, 0], [0, -1]); signal(-23.5, 23.5, [0, -1], [1, 0]); signal(-23.5, -23.5, [1, 0], [0, 1]);
  signal(23.5, -12, [0, 1], [-1, 0]); signal(-12, 23.5, [1, 0], [0, -1]);
  // white pedestrian guard rails along the avenue curbs (gaps at the crossings), posts every 2 m
  const rail = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2));
    prop.set({ col: hex(0xd8d8d4), rm: [0.45, 0.3, 0] });
    for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; prop.tube([x, CURB, z], [x, CURB + 1.0, z], 0.035, 5); }
    prop.tube([x0, CURB + 0.95, z0], [x1, CURB + 0.95, z1], 0.03, 5); prop.tube([x0, CURB + 0.55, z0], [x1, CURB + 0.55, z1], 0.025, 5);
    colliders.push({ min: [Math.min(x0, x1) - 0.06, 0, Math.min(z0, z1) - 0.06], max: [Math.max(x0, x1) + 0.06, CURB + 1.0, Math.max(z0, z1) + 0.06], data: { mat: 'metal', kind: 'rail', noBullet: true } });
  };
  for (let x = 34; x < 170; x += 20) { rail(x, -11.6, x + 14, -11.6); rail(x + 4, 11.6, x + 18, 11.6); }
  for (let z = 36; z < 130; z += 20) { rail(-11.6, z, -11.6, z + 14); rail(11.6, z + 4, 11.6, z + 18); }
  // bollards along the plaza / taxi lane
  prop.set({ col: hex(0x3a3c40), rm: [0.5, 0.5, 0] });
  for (let z = TAXI.z0 + 2; z < TAXI.z1; z += 3) prop.cyl(TAXI.x0 - 0.6, CURB, z, 0.1, 0.1, 0.95, 8);
  // utility poles + wires: down both sides of Center-gai and along the cross street
  const poles = [];
  const pole = (x, z, h = 11) => {
    prop.set({ col: hex(0x8e8c86), rm: [0.85, 0, 0] });
    prop.cyl(x, CURB, z, 0.17, 0.13, h, 8);
    prop.set({ col: hex(0x5a5a58), rm: [0.6, 0.4, 0] });
    prop.box(x - 0.9, h - 1.2, z - 0.06, x + 0.9, h - 1.08, z + 0.06); prop.box(x - 0.6, h - 2.2, z - 0.06, x + 0.6, h - 2.1, z + 0.06);
    prop.set({ col: hex(0x6a6e6a), rm: [0.6, 0.3, 0] }); prop.cyl(x + 0.3, h - 3.6, z + 0.3, 0.32, 0.32, h - 2.6, 8); // transformer
    colliders.push({ min: [x - 0.2, 0, z - 0.2], max: [x + 0.2, h, z + 0.2], data: { mat: 'concrete', kind: 'pole', thin: true } });
    poles.push([x, z, h]);
  };
  const wires = (a, b) => {
    prop.set({ col: hex(0x101012), rm: [0.6, 0.2, 0] });
    for (const [dx, dy] of [[-0.8, -1.12], [0, -1.12], [0.8, -1.12], [-0.5, -2.15], [0.5, -2.15], [0.3, -3.0]]) {
      const n = 8, sag = 0.4 + Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.02;
      let prev = null;
      for (let i = 0; i <= n; i++) { const t = i / n; const p = [a[0] + (b[0] - a[0]) * t + dx, a[2] + dy + (b[2] - a[2]) * t - sag * 4 * t * (1 - t), a[1] + (b[1] - a[1]) * t]; if (prev) prop.tube(prev, p, 0.016, 3); prev = p; }
    }
  };
  for (let z = -134; z < -36; z += 16) { pole(-7.3, z); pole(7.3, z + 8); }
  for (let i = 0; i < poles.length - 2; i++) { const a = poles[i], b = poles[i + 2]; wires(a, b); }
  for (let i = 0; i < poles.length - 1; i += 3) { const a = poles[i], b = poles[i + 1]; wires(a, b); } // across the street
  const p0 = poles.length;
  for (let x = -120; x < 200; x += 22) pole(x, CROSS_ST.z1 - 1.0, 10);
  for (let i = p0; i < poles.length - 1; i++) wires(poles[i], poles[i + 1]);
  // vending machines: in pairs / threes against walls, each a lit front from the atlas + a pool of white light
  const vend = (x, z, ang, n = 2) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    for (let i = 0; i < n; i++) {
      const ox = x + c * (i - (n - 1) / 2) * 1.05, oz = z - s * (i - (n - 1) / 2) * 1.05;
      const e = VE.vend[Math.floor(rng() * VE.vend.length)];
      const N = [s, 0, c];
      prop.set({ col: hex(0xd8d6d0), rm: [0.4, 0.3, 0] });
      prop.obox(ox - N[0] * 0.38, 0.95 + CURB, oz - N[2] * 0.38, 0.5, 0.95, 0.38, ang);
      signQuad(vacc, [ox + N[0] * 0.005, CURB + 0.95, oz + N[2] * 0.005], N, 0.98, 1.84, e.uv, 1.25);
      colliders.push({ min: [ox - 0.55, 0, oz - 0.55], max: [ox + 0.55, 2.0, oz + 0.55], data: { mat: 'metal', kind: 'vending' } });
    }
    lights.push({ x: x + s * 1.6, z: z + c * 1.6, w: n * 1.2 + 1.5, d: 3.4, ang: -ang, color: [1.3, 1.35, 1.45], k: 0.9 });
  };
  vend(-7.4, -60, Math.PI / 2, 3); vend(7.4, -92, -Math.PI / 2, 2); vend(-7.4, -112, Math.PI / 2, 2); vend(7.4, -45, -Math.PI / 2, 2);
  vend(60, -16.4, 0, 3); vend(110, 16.4, Math.PI, 2); vend(-16.4, 64, Math.PI / 2, 2); vend(-60, -29.4, 0, 3); vend(-46, 27.4, Math.PI, 2);
  // bicycles parked in rows (frame + two wheels from thin tubes)
  const bike = (x, z, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const P = (a, y) => [x + c * a, CURB + y, z - s * a];
    prop.set({ col: hex([0x2a2a2a, 0x8a1a1a, 0x1a3a7a, 0xc8c8c0, 0x2a5a2a][Math.floor(rng() * 5)]), rm: [0.5, 0.5, 0] });
    for (const a of [-0.52, 0.52]) { const seg = 10; for (let i = 0; i < seg; i++) { const t0 = i / seg * Math.PI * 2, t1 = (i + 1) / seg * Math.PI * 2; prop.tube(P(a + Math.cos(t0) * 0.33, 0.33 + Math.sin(t0) * 0.33), P(a + Math.cos(t1) * 0.33, 0.33 + Math.sin(t1) * 0.33), 0.018, 3); } }
    prop.tube(P(-0.52, 0.33), P(0, 0.35), 0.022, 4); prop.tube(P(0, 0.35), P(0.45, 0.85), 0.022, 4); prop.tube(P(-0.52, 0.33), P(-0.18, 0.85), 0.022, 4); prop.tube(P(-0.18, 0.85), P(0.45, 0.85), 0.022, 4);
    prop.tube(P(0.45, 0.85), P(0.52, 0.33), 0.022, 4); prop.tube(P(0, 0.35), P(-0.22, 0.95), 0.022, 4); prop.tube(P(0.42, 0.85), P(0.4, 1.02), 0.02, 4);
    prop.set({ col: hex(0x151515), rm: [0.7, 0, 0] }); prop.obox(x + c * -0.22, CURB + 0.98, z - s * -0.22, 0.12, 0.03, 0.06, ang);
  };
  for (let i = 0; i < 9; i++) bike(-5.8 + 0, -40 - i * 0.62, Math.PI / 2 + 0.2);
  for (let i = 0; i < 7; i++) bike(5.9, -70 - i * 0.62, -Math.PI / 2 - 0.15);
  for (let i = 0; i < 10; i++) bike(70 + i * 0.62, 15.6, 0.05);
  colliders.push({ min: [-6.4, 0, -46], max: [-5.2, 1.1, -39.5], data: { mat: 'metal', kind: 'bikes', noBullet: true } });
  colliders.push({ min: [5.3, 0, -74.5], max: [6.5, 1.1, -69.5], data: { mat: 'metal', kind: 'bikes', noBullet: true } });
  // police barricades at the far ends (yellow / black, with blinking lamps) and cones
  const barricade = (x, z, ang, n = 4) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    for (let i = 0; i < n; i++) {
      const ox = x + c * (i - (n - 1) / 2) * 2.1, oz = z - s * (i - (n - 1) / 2) * 2.1;
      prop.set({ col: hex(0xe8c21a), rm: [0.5, 0, 0.1] }); prop.obox(ox, CURB + 0.85, oz, 0.95, 0.12, 0.05, ang);
      prop.set({ col: hex(0x161616), rm: [0.5, 0, 0] }); prop.obox(ox, CURB + 0.45, oz, 0.95, 0.06, 0.05, ang);
      prop.set({ col: hex(0x8a8a8a), rm: [0.5, 0.5, 0] }); for (const d of [-0.85, 0.85]) prop.obox(ox + c * d, CURB + 0.5, oz - s * d, 0.04, 0.5, 0.25, ang);
      glows.push({ p: [ox, CURB + 1.1, oz], color: [2.8, 0.9, 0.1], size: 0.45, blink: true, rate: 5 });
    }
  };
  barricade(166, 0, Math.PI / 2, 7); barricade((KOEN.x0 + KOEN.x1) / 2, KOEN.z0 + 0.5, 0, 4); barricade(0, 128, 0, 7); barricade(-40, (CROSS_ST.z0 + CROSS_ST.z1) / 2, Math.PI / 2, 4);
  // bins, cones, the bus shelter, the taxi sign
  prop.set({ col: hex(0x2a5a3a), rm: [0.6, 0.3, 0] });
  for (const [x, z] of [[-24, -25], [25, 25], [-25, 25], [40, -15.6], [-15.6, 40], [-6.6, -52], [6.6, -100]]) { prop.cyl(x, CURB, z, 0.3, 0.3, CURB + 0.9, 10); colliders.push({ min: [x - 0.32, 0, z - 0.32], max: [x + 0.32, 1.05, z + 0.32], data: { mat: 'metal', kind: 'bin' } }); }
  prop.set({ col: hex(0xe85a14), rm: [0.6, 0, 0.1] });
  for (const [x, z] of [[18, -3], [19.5, -1], [12, 18], [60, 1], [62, 2.2], [-38, -20], [-38, -16]]) prop.cyl(x, 0, z, 0.18, 0.03, 0.72, 8);
  // bus shelter on the plaza
  prop.set({ col: hex(0x6a6c70), rm: [0.4, 0.6, 0] });
  for (const z of [-14, -4]) for (const x of [-44.2, -46.4]) prop.box(x - 0.06, CURB, z - 0.06, x + 0.06, 2.7, z + 0.06);
  prop.set({ col: hex(0x2a2c30), rm: [0.4, 0.5, 0.0] }); prop.box(-46.8, 2.7, -14.6, -43.8, 2.85, -3.4);
  prop.set({ col: [1, 1, 1], rm: [0.4, 0, 1.8] }); prop.box(-46.6, 2.68, -14.4, -44.0, 2.7, -3.6, { faces: 'y' });
  { const e = SE.panel[0]; signQuad(sign, [-46.48, 1.55, -9], [1, 0, 0], 3.6, 1.2, e.uv, 1.3); }
  lights.push({ x: -45, z: -9, w: 4, d: 12, ang: 0, color: [1.3, 1.3, 1.4], k: 0.8 });
  colliders.push({ min: [-46.7, 0, -11], max: [-46.3, 2.7, -7], data: { mat: 'metal', kind: 'shelter' } });
  prop.set({ col: hex(0x2a2c30), rm: [0.4, 0.5, 0] }); prop.box(-46.7, CURB, -11, -46.3, 2.4, -7);
  // the Center-gai gate (Kabukichō-style): a red steel portal, a lit sign box across it, lamps on the legs
  {
    const { E: G2 } = signAtlas2();
    const zG = -30;
    prop.set({ col: hex(0xa8140e), rm: [0.45, 0.4, 0.15] });
    for (const x of [-7.4, 7.4]) prop.box(x - 0.28, CURB, zG - 0.28, x + 0.28, 8.6, zG + 0.28);
    prop.box(-8.2, 8.6, zG - 0.5, 8.2, 9.2, zG + 0.5);
    prop.box(-7.6, 5.9, zG - 0.42, 7.6, 6.15, zG + 0.42);
    prop.set({ col: hex(0x1a1a1c), rm: [0.5, 0.4, 0] }); prop.box(-7.1, 6.15, zG - 0.36, 7.1, 8.6, zG + 0.36);
    for (const [z, n] of [[zG + 0.37, [0, 0, 1]], [zG - 0.37, [0, 0, -1]]]) signQuad(arch2, [0, 7.38, z], n, 14.0, 2.3, G2.arch.uv, 1.45);
    for (const x of [-7.4, 7.4]) for (const z of [zG + 0.32, zG - 0.32]) { prop.set({ col: [1, 0.85, 0.6], rm: [0.3, 0, 2.6] }); prop.box(x - 0.18, 4.6, z - 0.05, x + 0.18, 5.4, z + 0.05); glows.push({ p: [x, 5.0, z + (z > zG ? 0.2 : -0.2)], color: [2.4, 1.9, 1.3], size: 0.9 }); }
    glows.push({ p: [0, 7.4, zG + 0.6], color: [1.2, 0.5, 0.45], size: 10, far: true });
    lights.push({ x: 0, z: zG + 4, w: 14, d: 8, ang: 0, color: [1.5, 1.1, 1.0], k: 0.55 });
    colliders.push({ min: [-7.7, 0, zG - 0.3], max: [-7.1, 8.6, zG + 0.3], data: { mat: 'metal', kind: 'pole' } }); colliders.push({ min: [7.1, 0, zG - 0.3], max: [7.7, 8.6, zG + 0.3], data: { mat: 'metal', kind: 'pole' } });
  }

  const lateGround = [];
  // ---------------------------------------------------------------- yellow tactile guide strips (tenji blocks) down every sidewalk
  {
    const T = new Acc(), st = (x0, z0, x1, z1) => T.quad([x0, CURB + 0.012, z1], [x1, CURB + 0.012, z1], [x1, CURB + 0.012, z0], [x0, CURB + 0.012, z0], [x0 / 0.3, -z1 / 0.3, x1 / 0.3, -z0 / 0.3]);
    st(30, -14.6, 168, -14.3); st(30, 14.3, 168, 14.6); st(-14.6, 30, -14.3, 128); st(14.3, 30, 14.6, 128);
    st(-25.2, -25.2, 25.2, -24.9); st(-25.2, 24.9, 25.2, 25.2); st(24.9, -25.2, 25.2, 25.2); st(-25.2, -25.2, -24.9, 25.2);
    // the warning pads at every crossing edge
    for (const [x, z, w, d] of [[-8, -22.4, 16, 0.6], [-8, 21.8, 16, 0.6], [21.8, -8, 0.6, 16], [-22.4, -8, 0.6, 16]]) st(x, z, x + w, z + d);
    const tc = makeCanvas(64, 64), tg = tc.getContext('2d'); tg.fillStyle = '#d8b21a'; tg.fillRect(0, 0, 64, 64); tg.fillStyle = '#b8920e'; for (let i = 0; i < 4; i++) tg.fillRect(4 + i * 16, 4, 6, 56);
    const tm = new THREE.MeshStandardMaterial({ map: canvasTex(tc, { aniso: 4 }), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const tmesh = T.mesh(tm); tmesh.receiveShadow = true; root.add(tmesh); lateGround.push(tm);
  }
  // ---------------------------------------------------------------- blue direction gantries over the avenues
  {
    const tex = gantryTex(), m = signMat(tex, { color: 1.1, vc: false });
    const gantry = (cx, cz, alongX, w, flip) => {
      // posts at the road edges, a box truss beam, the blue sign facing the traffic
      prop.set({ col: hex(0x9aa0a4), rm: [0.45, 0.6, 0] });
      const half = w / 2;
      for (const s of [-1, 1]) { const px = alongX ? cx : cx + s * half, pz = alongX ? cz + s * half : cz; prop.cyl(px, CURB, pz, 0.22, 0.2, 7.6, 10); colliders.push({ min: [px - 0.25, 0, pz - 0.25], max: [px + 0.25, 7.6, pz + 0.25], data: { mat: 'metal', kind: 'pole' } }); }
      if (alongX) { prop.box(cx - 0.25, 6.9, cz - half, cx + 0.25, 7.5, cz + half); } else { prop.box(cx - half, 6.9, cz - 0.25, cx + half, 7.5, cz + 0.25); }
      const g = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), m);
      if (alongX) { g.position.set(cx + (flip ? -0.3 : 0.3), 6.1, cz + half * 0.35); g.rotation.y = flip ? -Math.PI / 2 : Math.PI / 2; }
      else { g.position.set(cx - half * 0.3, 6.1, cz + (flip ? -0.3 : 0.3)); g.rotation.y = flip ? Math.PI : 0; }
      prop.set({ col: hex(0x2a2c30), rm: [0.5, 0.5, 0] });
      if (alongX) prop.box(cx - 0.28, 4.75, g.position.z - 4.6, cx + 0.28, 7.45, g.position.z + 4.6, { faces: 'xX' });
      else prop.box(g.position.x - 4.6, 4.75, cz - 0.28, g.position.x + 4.6, 7.45, cz + 0.28, { faces: 'zZ' });
      root.add(g);
    };
    gantry(70, 0, true, 2 * AVE_E.road + 1, true);           // over the east avenue, facing you as you head east
    gantry(0, 70, false, 2 * AVE_S.road + 1, true);           // over the south avenue, facing the crossing
  }
  // ---------------------------------------------------------------- meshes
  const tA = asphaltTex(), tW = sidewalkTex(), tP = plazaTex(), tC = centerTex();
  const mats = {
    asphalt: new THREE.MeshStandardMaterial({ map: tA, color: 0xe4dfd8, roughness: 0.7, metalness: 0.0, emissive: 0x000000 }),
    walk: new THREE.MeshStandardMaterial({ map: tW, vertexColors: true, color: 0xcfcbc4, roughness: 0.82 }),
    plaza: new THREE.MeshStandardMaterial({ map: tP, vertexColors: true, color: 0xdcd4c8, roughness: 0.6 }),
    center: new THREE.MeshStandardMaterial({ map: tC, vertexColors: true, color: 0xe2d2bc, roughness: 0.72 }),
  };
  const ground = [...lateGround];
  for (const k of Object.keys(surf)) { const m = surf[k].mesh(mats[k]); m.receiveShadow = true; root.add(m); ground.push(mats[k]); }
  const markMat = new THREE.MeshStandardMaterial({ map: markTex(), transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mMark = mk.mesh(markMat); mMark.renderOrder = 1; root.add(mMark); ground.push(markMat);
  const propMat = rmMat({});
  root.add(prop.mesh(propMat, { shadow: true }));
  root.add(sign.mesh(signMaterial()));
  if (vacc.vn) root.add(vacc.mesh(signMat(vendAtlas().tex)));
  root.add(arch2.mesh(signMat(signAtlas2().tex)));
  if (halo.vn) root.add(halo.mesh(haloMaterial()));
  return { root, colliders, panes, groundMats: ground, anchors: { glows, lights }, info: { tris: prop.tris + mk.tris } };
}

// the Center-gai arch sign: its own small canvas (neon pink / white on black)
function archSign() {
  const W = 1024, H = 128, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#0d0a10'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#3a2a40'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  const neon = (t, x, y, s, col, f) => { g.save(); g.font = `900 ${s}px ${f}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = s * 0.4; g.strokeStyle = col; g.lineWidth = s * 0.1; g.strokeText(t, x, y); g.shadowBlur = 0; g.strokeStyle = '#fff6fa'; g.lineWidth = s * 0.03; g.strokeText(t, x, y); g.restore(); };
  neon('黒金センター街', 380, 66, 82, '#ff4fc0', JP);
  neon('KUROGANE CENTER-GAI', 820, 66, 40, '#4ff0ff', 'Anton, sans-serif');
  const t = canvasTex(c, { repeat: false, aniso: 4 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14.6, 1.6), signMat(t, { color: 1.6, vc: false }));
  return m;
}

// the blue road direction sign (expressway-style lettering, white on blue, route shields)
function gantryTex() {
  const W = 1024, H = 296, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#1b56a8'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f2f4f6'; g.lineWidth = 8; g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = '#fff'; g.textBaseline = 'middle';
  const col = (x, arrow, jp, en) => { g.textAlign = 'center'; g.font = '700 70px Anton, sans-serif'; g.fillText(arrow, x, 70); g.font = `900 64px ${JP}`; g.fillText(jp, x, 160); g.font = '400 34px Anton, sans-serif'; g.fillText(en, x, 228); };
  col(170, '←', '霞台', 'KASUMIDAI'); col(512, '↑', '黒金駅', 'KUROGANE STA.'); col(854, '→', '銀鶏', 'GINKEI');
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(340, 40, 4, 216); g.fillRect(682, 40, 4, 216);
  g.fillStyle = '#2e8a3e'; g.fillRect(560, 22, 110, 40); g.fillStyle = '#fff'; g.font = '700 30px Anton, sans-serif'; g.fillText('246', 615, 43);
  return canvasTex(c, { repeat: false, aniso: 8 });
}
