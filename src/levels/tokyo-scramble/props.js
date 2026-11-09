import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex, signMat, zelkova, leafMaterial } from './kit.js';
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
  const P = new Acc({ rm: true }), S = new Acc(), leaves = new Acc();
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
  // ---- the bronze dog on its plinth (Hachikō square has to have one): a sitting Akita, ears up, tail curled
  {
    const x = -52, z = 9, y = CURB;
    P.set({ col: hex(0x6e6a62), rm: [0.75, 0, 0] }); P.box(x - 0.9, y, z - 0.7, x + 0.9, y + 1.3, z + 0.7);
    P.set({ col: hex(0x5a5850), rm: [0.75, 0, 0] }); P.box(x - 1.15, y, z - 0.95, x + 1.15, y + 0.2, z + 0.95);
    P.set({ col: hex(0x4a3a24), rm: [0.35, 0.85, 0] });
    const yt = y + 1.3;
    P.tube([x - 0.25, yt + 0.3, z], [x + 0.15, yt + 0.85, z], 0.3, 10);                 // chest, sitting up
    P.tube([x - 0.45, yt + 0.25, z], [x - 0.15, yt + 0.25, z], 0.32, 10);                // haunches
    P.tube([x + 0.12, yt + 0.95, z], [x + 0.42, yt + 1.05, z], 0.17, 8);                 // head + muzzle
    P.tube([x + 0.42, yt + 1.03, z], [x + 0.62, yt + 0.98, z], 0.09, 6);
    for (const s of [-1, 1]) { P.tube([x + 0.12, yt + 1.12, z + s * 0.09], [x + 0.1, yt + 1.36, z + s * 0.12], 0.05, 4); P.tube([x + 0.22, yt + 0.6, z + s * 0.14], [x + 0.25, yt, z + s * 0.14], 0.06, 6); }
    P.tube([x - 0.6, yt + 0.35, z], [x - 0.55, yt + 0.6, z + 0.12], 0.07, 5);            // the curled tail
    col([x - 0.9, 0, z - 0.7], [x + 0.9, y + 2.6, z + 0.7], 'statue');
    lights.push({ x, z, r: 3, color: [1.2, 1.1, 0.95], k: 0.4 });
  }
  // ---- the retired green railcar parked on the square (a tourist booth now: cover, and a landmark)
  {
    const x0 = -70, x1 = -58, z = -18, y = CURB + 0.4;
    P.set({ col: hex(0x5a8a4a), rm: [0.45, 0.3, 0] }); P.box(x0, y + 0.6, z - 1.35, x1, y + 2.7, z + 1.35);
    P.set({ col: hex(0xd8d0a8), rm: [0.5, 0.2, 0] }); P.box(x0, y + 2.7, z - 1.35, x1, y + 3.3, z + 1.35); P.box(x0 + 0.2, y + 3.3, z - 1.1, x1 - 0.2, y + 3.55, z + 1.1);
    P.set({ col: hex(0x1a1a1a), rm: [0.7, 0.3, 0] }); P.box(x0 + 1, y, z - 1.1, x1 - 1, y + 0.6, z + 1.1);
    P.set({ col: [1.0, 0.92, 0.75], rm: [0.4, 0, 1.4] }); for (let x = x0 + 0.8; x < x1 - 1; x += 1.6) for (const s of [-1, 1]) P.box(x, y + 1.6, s > 0 ? z + 1.35 : z - 1.36, x + 1.1, y + 2.4, s > 0 ? z + 1.36 : z - 1.35, { faces: s > 0 ? 'Z' : 'z' });
    P.set({ col: hex(0x3a3a3a), rm: [0.6, 0.6, 0] }); P.box(x0 - 0.4, CURB, z - 1.6, x1 + 0.4, CURB + 0.4, z + 1.6);
    col([x0, 0, z - 1.4], [x1, y + 3.3, z + 1.4], 'railcar', 'metal');
    lights.push({ x: (x0 + x1) / 2, z: z + 3, w: 12, d: 4, ang: 0, color: [1.4, 1.25, 1.0], k: 0.6 }); lights.push({ x: (x0 + x1) / 2, z: z - 3, w: 12, d: 4, ang: 0, color: [1.4, 1.25, 1.0], k: 0.6 });
  }
  // ---- zelkova trees in round granite planters on the square
  for (const [x, z] of [[-46, -22], [-64, 14], [-40, 21], [-68, -4]]) {
    P.set({ col: hex(0x7c776e), rm: [0.75, 0, 0] }); P.cyl(x, CURB, z, 1.3, 1.3, CURB + 0.55, 14);
    zelkova(P, x, CURB + 0.5, z, 1.0, x + z * 7, leaves);
    col([x - 1.3, 0, z - 1.3], [x + 1.3, CURB + 0.55, z + 1.3], 'planter');
    colliders.push({ min: [x - 0.25, 0, z - 0.25], max: [x + 0.25, 4.2, z + 0.25], data: { kind: 'tree', mat: 'wood' } });
  }
  // ---- granite planters with clipped shrubs (plaza)
  const planter = (x, z, w = 2.4, d = 1.2) => {
    P.set({ col: hex(0x7c776e), rm: [0.75, 0, 0] }); P.box(x - w / 2, CURB, z - d / 2, x + w / 2, CURB + 0.75, z + d / 2);
    P.set({ col: hex(0x24361c), rm: [0.95, 0, 0] }); P.box(x - w / 2 + 0.1, CURB + 0.75, z - d / 2 + 0.1, x + w / 2 - 0.1, CURB + 1.25, z + d / 2 - 0.1);
    col([x - w / 2, 0, z - d / 2], [x + w / 2, CURB + 1.25, z + d / 2], 'planter');
  };
  for (const [x, z, w, d] of [[-48, -10, 2.6, 1.2], [-46, 16, 2.6, 1.2], [-45, 3, 1.2, 2.6]]) planter(x, z, w, d);
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
  for (const [x, z] of [[-48, -6], [-48, 7]]) { P.set({ col: hex(0x3a2a1a), rm: [0.7, 0, 0] }); P.box(x - 0.6, CURB, z - 1, x + 0.6, CURB + 0.8, z + 1); for (let i = 0; i < 6; i++) { P.set({ col: hex([0xd83a6a, 0xf2c21a, 0xe8e0d8, 0xd85a1a][i % 4]), rm: [0.9, 0, 0.05] }); P.cyl(x + R(-0.4, 0.4), CURB + 0.8, z + R(-0.8, 0.8), 0.14, 0.18, CURB + 1.05, 6); } col([x - 0.6, 0, z - 1], [x + 0.6, CURB + 1.05, z + 1], 'stand', 'wood'); }
  // ---- nobori: the tall cloth shop banners on poles (every shopping street in Japan), bright, vertical text
  {
    const tex = noboriTex(), m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.5 });
    const NB = new Acc();
    const flag = (x, z, ang, k) => {
      const c = Math.cos(ang), s_ = Math.sin(ang), w = 0.5, h = 1.75, y0 = CURB + 0.75;
      const u0 = k / 8, u1 = (k + 1) / 8;
      // the cloth hangs a little bowed in the breeze
      NB.quad([x, y0, z], [x + c * w, y0 + 0.02, z + s_ * w], [x + c * w * 0.98, y0 + h, z + s_ * w * 0.98], [x, y0 + h, z], [u0, 0, u1, 1]);
      P.set({ col: hex(0x8a8e92), rm: [0.45, 0.6, 0] }); P.cyl(x, CURB, z, 0.018, 0.018, y0 + h + 0.12, 5, { cap: false }); P.tube([x, y0 + h + 0.05, z], [x + c * w, y0 + h + 0.05, z + s_ * w], 0.012, 4);
      P.set({ col: hex(0x5a5c60), rm: [0.6, 0.3, 0] }); P.cyl(x, CURB, z, 0.14, 0.14, CURB + 0.08, 8);
    };
    let k = 0;
    // Center-gai, both sides, in front of the shops; the plaza's shop fronts; the avenue's
    for (const side of [-1, 1]) for (let z = CENTER.z0 + 8; z < CENTER.z1 - 2; z += R(3.5, 8)) if (rng() < 0.75) { const x = side * (CENTER.half - 0.9); flag(x, z, side > 0 ? Math.PI / 2 + 0.2 : -Math.PI / 2 - 0.2, (k++) % 8); if (rng() < 0.5) flag(x, z + 0.7, side > 0 ? Math.PI / 2 + 0.2 : -Math.PI / 2 - 0.2, (k++) % 8); }
    for (let x = 32; x < 160; x += R(5, 12)) if (rng() < 0.6) flag(x, (rng() < 0.5 ? -1 : 1) * 16.2, rng() * 0.6 - 0.3, (k++) % 8);
    for (let z = 32; z < 120; z += R(6, 14)) if (rng() < 0.5) flag((rng() < 0.5 ? -1 : 1) * 16.2, z, Math.PI / 2 + rng() * 0.6 - 0.3, (k++) % 8);
    const mn = NB.mesh(m); mn.castShadow = true; root.add(mn);
  }
  // ---- meshes
  root.add(P.mesh(rmMat({}), { shadow: true }));
  if (leaves.vn) root.add(leaves.mesh(leafMaterial(), { shadow: true }));
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
  return new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), signMat(t, { color: 1.3, vc: false }));
}

// eight nobori designs side by side: a bright field, a white band, the words down it (sale, open, ramen...)
function noboriTex() {
  const W = 1024, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
  const D = [['#d8281c', '営業中', '#fff'], ['#f2c21a', '大盛無料', '#c8281c'], ['#1f7a3e', '生ビール', '#fff'], ['#1b4aa0', 'カラオケ', '#fff'],
    ['#e85a9a', 'セール', '#fff'], ['#f2f0e8', 'ラーメン', '#c8281c'], ['#d8281c', '焼き鳥', '#f2c21a'], ['#f28a1a', 'たこ焼', '#1a1a1a']];
  g.clearRect(0, 0, W, H);
  D.forEach(([bg, t, fg], i) => {
    const x = i * 128 + 6, w = 116;
    g.fillStyle = bg; g.fillRect(x, 0, w, H);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x, 0, w, 26); g.fillStyle = bg; g.font = `900 18px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('のぼり', x + w / 2, 13);
    // cloth edge: a darker hem with the pole loops
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 30; y < H; y += 40) g.fillRect(x, y, 8, 18);
    g.fillStyle = fg; const chars = [...t], st = (H - 60) / chars.length;
    chars.forEach((ch, k) => { g.font = `900 ${Math.min(st * 0.86, 96)}px ${JP}`; g.fillText(ch, x + w / 2 + 3, 46 + st * (k + 0.5)); });
  });
  return canvasTex(c, { repeat: false, aniso: 4 });
}
