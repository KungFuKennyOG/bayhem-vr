import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex } from './kit.js';
import { signAtlas, JP } from './signs.js';
import { signQuad, signMaterial } from './city.js';
import { CURB, PLAZA, TAXI, CENTER, GASWORKS } from './layout.js';

// =====================================================================================
//  Street clutter that doubles as cover: the kōban (police box) with its red lamp, the plaza's
//  bronze cat on its plinth, granite planters, a newsstand, grey utility cabinets, beer-crate
//  stacks and A-frame boards outside the bars, piles of garbage bags put out for the morning
//  collection (Tokyo, every night), cardboard, flower stands.
// =====================================================================================
export function buildProps(ctx = {}) {
  const rng = makeRng(1111);
  const R = (a, b) => a + (b - a) * rng();
  const root = new THREE.Group(); root.name = 'props';
  const colliders = [], glows = [], lights = [];
  const P = new Acc({ rm: true }), S = new Acc();
  const { E: SE } = signAtlas();
  const col = (min, max, kind = 'prop', mat = 'concrete', extra = {}) => colliders.push({ min, max, data: { kind, mat, ...extra } });
  // ---- the kōban: white box, a glass front, the red lamp, 交番 KOBAN
  {
    const x0 = -40, x1 = -35.5, z0 = -29.6, z1 = -26, y = CURB, h = 3.3;
    P.set({ col: hex(0xd8d6ce), rm: [0.7, 0, 0] }); P.box(x0, y, z0, x1, y + h, z1);
    P.set({ col: hex(0x2a2c30), rm: [0.4, 0.5, 0] }); P.box(x0 - 0.3, y + h, z0 - 0.3, x1 + 0.3, y + h + 0.25, z1 + 0.3);
    P.set({ col: hex(0x14181c), rm: [0.15, 0.4, 0] }); P.box(x0 + 0.5, y + 0.2, z1, x1 - 0.5, y + 2.4, z1 + 0.02, { faces: 'Z' });
    P.set({ col: [1, 0.96, 0.9], rm: [0.4, 0, 1.6] }); P.box(x0 + 0.7, y + 0.4, z1 - 0.05, x1 - 0.7, y + 2.2, z1 - 0.04, { faces: 'Z' });
    P.set({ col: [1, 0.15, 0.08], rm: [0.3, 0, 3] }); P.cyl((x0 + x1) / 2, y + h + 0.25, z1 - 0.4, 0.22, 0.22, y + h + 0.65, 10);
    glows.push({ p: [(x0 + x1) / 2, y + h + 0.45, z1 - 0.4], color: [3.2, 0.3, 0.15], size: 1.4, far: true });
    const kc = kobanSign(); kc.position.set((x0 + x1) / 2, y + 2.85, z1 + 0.03); root.add(kc);
    lights.push({ x: (x0 + x1) / 2, z: z1 + 2, w: 5, d: 3, ang: 0, color: [1.3, 1.25, 1.15], k: 0.7 });
    col([x0, 0, z0], [x1, y + h, z1], 'koban');
  }
  // ---- the bronze cat on its plinth (Kurogane's own loyal-pet statue)
  {
    const x = -58, z = 4, y = CURB;
    P.set({ col: hex(0x6e6a62), rm: [0.75, 0, 0] }); P.box(x - 1.1, y, z - 0.8, x + 1.1, y + 1.25, z + 0.8);
    P.set({ col: hex(0x5a5850), rm: [0.75, 0, 0] }); P.box(x - 1.3, y, z - 1.0, x + 1.3, y + 0.2, z + 1.0);
    P.set({ col: hex(0x5a4228), rm: [0.35, 0.85, 0] });
    const yt = y + 1.25;
    P.cyl(x, yt, z, 0.42, 0.34, yt + 0.85, 12);                         // sitting body
    P.cyl(x, yt + 0.85, z + 0.05, 0.3, 0.26, yt + 1.25, 12);            // head
    for (const s of [-1, 1]) { P.tube([x + s * 0.16, yt + 1.2, z + 0.05], [x + s * 0.22, yt + 1.48, z + 0.02], 0.07, 4); } // ears
    P.tube([x - 0.3, yt + 0.1, z - 0.3], [x - 0.55, yt + 0.5, z - 0.1], 0.06, 5); P.tube([x - 0.55, yt + 0.5, z - 0.1], [x - 0.45, yt + 0.95, z + 0.1], 0.055, 5); // tail
    for (const s of [-1, 1]) P.cyl(x + s * 0.18, yt, z + 0.3, 0.08, 0.08, yt + 0.55, 6);
    col([x - 1.1, 0, z - 0.8], [x + 1.1, y + 2.6, z + 0.8], 'statue');
    const pl = SE.plate[0]; void pl;
  }
  // ---- granite planters with clipped shrubs (plaza)
  const planter = (x, z, w = 2.4, d = 1.2) => {
    P.set({ col: hex(0x7c776e), rm: [0.75, 0, 0] }); P.box(x - w / 2, CURB, z - d / 2, x + w / 2, CURB + 0.75, z + d / 2);
    P.set({ col: hex(0x24361c), rm: [0.95, 0, 0] }); P.box(x - w / 2 + 0.1, CURB + 0.75, z - d / 2 + 0.1, x + w / 2 - 0.1, CURB + 1.25, z + d / 2 - 0.1);
    col([x - w / 2, 0, z - d / 2], [x + w / 2, CURB + 1.25, z + d / 2], 'planter');
  };
  for (const [x, z, w, d] of [[-66, -18, 1.2, 3], [-66, 18, 1.2, 3], [-52, -12, 2.6, 1.2], [-50, 18, 2.6, 1.2], [-70, 0, 1.2, 2.4], [-45, 3, 1.2, 2.6]]) planter(x, z, w, d);
  // ---- newsstand (plaza) + utility cabinets (sidewalks)
  { const x = -60, z = -24; P.set({ col: hex(0x1d5a3a), rm: [0.5, 0.3, 0] }); P.box(x - 1.4, CURB, z - 0.9, x + 1.4, CURB + 2.3, z + 0.9); P.set({ col: hex(0x123a24), rm: [0.5, 0.3, 0] }); P.box(x - 1.6, CURB + 2.3, z - 1.1, x + 1.6, CURB + 2.45, z + 1.3);
    const f = SE.fascia[1]; signQuad(S, [x, CURB + 2.0, z + 0.91], [0, 0, 1], 2.6, 0.55, f.uv, 1.2); col([x - 1.4, 0, z - 0.9], [x + 1.4, CURB + 2.4, z + 0.9], 'kiosk'); lights.push({ x, z: z + 2, r: 3, color: [1.3, 1.2, 1.0], k: 0.6 }); }
  const cabinet = (x, z) => { P.set({ col: hex(0x8a8c88), rm: [0.6, 0.3, 0] }); P.box(x - 0.55, CURB, z - 0.35, x + 0.55, CURB + 1.35, z + 0.35); P.set({ col: hex(0xd8b21a), rm: [0.6, 0, 0] }); P.box(x - 0.2, CURB + 1.0, z + 0.35, x + 0.2, CURB + 1.15, z + 0.36, { faces: 'Z' }); col([x - 0.55, 0, z - 0.35], [x + 0.55, CURB + 1.35, z + 0.35], 'cabinet', 'metal'); };
  for (const [x, z] of [[30, -15.8], [64, -15.8], [100, 15.8], [-15.6, 46], [15.6, 70], [-26, -26]]) cabinet(x, z);
  // ---- Center-gai: beer-crate stacks, A-frame boards, flower stands, garbage piles, a takoyaki stall
  const crates = (x, z, n = 3) => {
    for (let i = 0; i < n; i++) { const c = rng() < 0.5 ? 0xd8a81a : 0xb8281c; P.set({ col: hex(c), rm: [0.6, 0, 0.04] }); const yy = CURB + i * 0.3; P.box(x - 0.24, yy, z - 0.18, x + 0.24, yy + 0.29, z + 0.18); P.set({ col: hex(0x6a4a1a), rm: [0.7, 0, 0] }); for (let k = 0; k < 2; k++) P.cyl(x - 0.1 + k * 0.2, yy + 0.29, z, 0.05, 0.05, yy + 0.33, 6); }
  };
  const aframe = (x, z, ang) => { P.set({ col: hex(0x2a1a10), rm: [0.7, 0, 0] }); P.obox(x, CURB + 0.5, z, 0.3, 0.5, 0.12, ang); const f = SE.plate[Math.floor(rng() * 6)]; const c = Math.cos(ang), s = Math.sin(ang); signQuad(S, [x + s * 0.125, CURB + 0.6, z + c * 0.125], [s, 0, c], 0.55, 0.4, [f.uv[0], f.uv[1], f.uv[2] * 0.6, f.uv[3]], 1.0); };
  const bags = (x, z, n = 6) => {
    for (let i = 0; i < n; i++) { const bx = x + R(-0.7, 0.7), bz = z + R(-0.5, 0.5), r = R(0.25, 0.38); P.set({ col: rng() < 0.6 ? hex(0xd8dce0).map(v => v * 0.9) : hex(0x6a8ab8), rm: [0.35, 0, 0.06] }); P.cyl(bx, CURB, bz, r, r * 0.55, CURB + r * 1.6, 8); }
    P.set({ col: hex(0x2a6a3a), rm: [0.8, 0, 0] }); P.box(x - 0.9, CURB + 0.55, z - 0.7, x + 0.9, CURB + 0.58, z + 0.7, { faces: 'Y' }); // the crow net
    col([x - 0.9, 0, z - 0.7], [x + 0.9, CURB + 0.6, z + 0.7], 'trash', 'concrete', { noBullet: true });
  };
  for (const z of [-126, -114, -102, -90, -78, -66, -54, -42]) {
    const s = rng() < 0.5 ? -1 : 1, x = s * (CENTER.half - 0.9);
    const k = rng();
    if (k < 0.35) { crates(x, z, 3); crates(x, z + 0.5, 2); crates(x + s * -0.5, z + 0.25, 3); col([Math.min(x, x - s * 0.5) - 0.25, 0, z - 0.2], [Math.max(x, x - s * 0.5) + 0.25, CURB + 0.95, z + 0.7], 'crates', 'wood'); }
    else if (k < 0.65) bags(x - s * 0.2, z, 7);
    else { aframe(x - s * 0.3, z, s > 0 ? -Math.PI / 2 : Math.PI / 2); aframe(x - s * 0.3, z + 1.4, s > 0 ? -Math.PI / 2 : Math.PI / 2); }
  }
  for (const [x, z] of [[-14, 30], [40, 16.4], [86, -16.2], [14.5, 60]]) bags(x, z, 8);
  // takoyaki stall half-way down Center-gai (cover, a lit red lantern)
  { const x = 4.6, z = -84; P.set({ col: hex(0x6a3a1c), rm: [0.7, 0, 0] }); P.box(x - 0.8, CURB, z - 1.4, x + 0.8, CURB + 1.05, z + 1.4); P.set({ col: hex(0xc82a1c), rm: [0.6, 0, 0.1] }); P.box(x - 1.0, CURB + 2.2, z - 1.6, x + 1.0, CURB + 2.35, z + 1.6);
    P.set({ col: hex(0x3a3a3a), rm: [0.5, 0.6, 0] }); for (const [dx, dz] of [[-0.75, -1.35], [0.75, -1.35], [-0.75, 1.35], [0.75, 1.35]]) P.box(x + dx - 0.04, CURB + 1.05, z + dz - 0.04, x + dx + 0.04, CURB + 2.2, z + dz + 0.04);
    P.set({ col: hex(0xd8281c), rm: [0.6, 0, 1.4] }); P.cyl(x - 0.85, CURB + 1.4, z, 0.22, 0.22, CURB + 1.95, 8); glows.push({ p: [x - 0.85, CURB + 1.68, z], color: [2.6, 0.5, 0.25], size: 1.0 });
    col([x - 0.8, 0, z - 1.4], [x + 0.8, CURB + 1.05, z + 1.4], 'stall', 'wood'); lights.push({ x, z, r: 3.5, color: [1.6, 0.6, 0.3], k: 0.7 }); }
  // flower stand + bikes near the station stairs
  for (const [x, z] of [[-66, -14], [-66, 14]]) { P.set({ col: hex(0x3a2a1a), rm: [0.7, 0, 0] }); P.box(x - 0.6, CURB, z - 1, x + 0.6, CURB + 0.8, z + 1); for (let i = 0; i < 6; i++) { P.set({ col: hex([0xd83a6a, 0xf2c21a, 0xe8e0d8, 0xd85a1a][i % 4]), rm: [0.9, 0, 0.05] }); P.cyl(x + R(-0.4, 0.4), CURB + 0.8, z + R(-0.8, 0.8), 0.14, 0.18, CURB + 1.05, 6); } col([x - 0.6, 0, z - 1], [x + 0.6, CURB + 1.05, z + 1], 'stand', 'wood'); }
  // ---- meshes
  root.add(P.mesh(rmMat({}), { shadow: true }));
  root.add(S.mesh(signMaterial()));
  return { root, colliders, anchors: { glows, lights } };
}
function kobanSign() {
  const W = 512, H = 128, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1a1a1a'; g.font = `900 78px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('交番', 150, 66);
  g.font = '400 52px Anton, sans-serif'; g.fillText('KOBAN', 370, 68);
  g.fillStyle = '#c81a1a'; g.fillRect(0, H - 10, W, 10);
  const t = canvasTex(c, { repeat: false, aniso: 4 });
  return new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.3, 1.3, 1.3) }));
}
