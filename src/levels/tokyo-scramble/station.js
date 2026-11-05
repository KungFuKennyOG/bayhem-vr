import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex } from './kit.js';
import { facadeMaterial, cellRect, FCELL } from './facade.js';
import { signAtlas, JP } from './signs.js';
import { signQuad, signMaterial, haloMaterial } from './city.js';
import { plazaTex } from './street.js';
import { STATION, TERRACE, STAIRS, CURB, PLAZA } from './layout.js';

// =====================================================================================
//  Kurogane Station: a long glass concourse facing the plaza, its name in lights, a granite
//  terrace at y 7 under a steel-and-glass canopy (the intro vantage), and a broad stair down to the
//  plaza. Ticket machines and an amber departure board glow behind the glass.
// =====================================================================================
export function buildStation(ctx = {}) {
  const rng = makeRng(808);
  const root = new THREE.Group(); root.name = 'station';
  const colliders = [], glows = [], lights = [], panes = [];
  const fac = new Acc({ cell: true, info: true }), prop = new Acc({ rm: true }), sign = new Acc(), halo = new Acc(), pave = new Acc();
  const { E: SE } = signAtlas();
  const { x0, x1, z0, z1, h } = STATION;
  const TY = TERRACE.y;
  // ---- the building: concourse glass on the east front from the terrace up, panels above, a deep roof edge
  const wall = (O, T, L, y0, y1, cell, info, bay = 3, floorH = 3.4, col = [1, 1, 1]) => {
    fac.set({ cell: cellRect(cell), info, col });
    const a = [O[0], y0, O[2]], b = [O[0] + T[0] * L, y0, O[2] + T[2] * L];
    fac.quad(a, b, [b[0], y1, b[2]], [a[0], y1, a[2]], [0, 0, Math.max(1, Math.round(L / bay)), (y1 - y0) / floorH]);
  };
  // east front: below the terrace (podium), the concourse glass (two storeys), office floors above
  wall([x1, 0, z1], [0, 0, -1], z1 - z0, 0, TY, FCELL.base, [91, 0, 0, 3], 2, TY);
  wall([x1, 0, z1], [0, 0, -1], z1 - z0, TY, TY + 9, FCELL.stationGlass, [91, 0.9, 0.85, 0], 4, 9);
  wall([x1, 0, z1], [0, 0, -1], z1 - z0, TY + 9, h, FCELL.office, [92, 0.35, 0.3, 0], 3, 3.6);
  for (const [O, T, L] of [[[x0, 0, z1], [1, 0, 0], x1 - x0], [[x1, 0, z0], [-1, 0, 0], x1 - x0], [[x0, 0, z0], [0, 0, 1], z1 - z0]]) wall(O, T, L, 0, h, FCELL.side, [93, 0.2, 0.4, 1], 3.6, 3.3, [0.85, 0.85, 0.85]);
  fac.set({ cell: cellRect(FCELL.roof), info: [94, 0, 0, 3], col: [0.7, 0.7, 0.7] });
  fac.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 0, (x1 - x0) / 4, (z1 - z0) / 4]);
  // roof edge fascia + the station name, big, in lights (both halves of the front)
  prop.set({ col: hex(0x1c1e22), rm: [0.5, 0.5, 0] });
  prop.box(x1, h - 3.6, z0, x1 + 1.2, h + 0.6, z1);
  const st = SE.panel.find(p => p.kind === 'station');
  for (const z of [-26, 26]) { signQuad(sign, [x1 + 1.22, h - 1.6, z], [1, 0, 0], 13.5, 4.5, st.uv, 1.45); halo.set({}); signQuad(halo, [x1 + 1.1, h - 1.6, z], [1, 0, 0], 22, 9, [0, 0, 1, 1], [0.35, 0.36, 0.34]); }
  glows.push({ p: [x1 + 2, h - 1.6, -26], color: [1.1, 1.1, 1.0], size: 12, far: true }, { p: [x1 + 2, h - 1.6, 26], color: [1.1, 1.1, 1.0], size: 12, far: true });
  // the departure board (amber LED) and ticket machines behind the concourse glass
  const board = boardCard();
  board.position.set(x1 - 3.5, TY + 6.2, 0); board.rotation.y = Math.PI / 2; root.add(board);
  glows.push({ p: [x1 - 3, TY + 6.2, 0], color: [1.6, 0.9, 0.2], size: 7 });
  prop.set({ col: hex(0xcfd2d4), rm: [0.4, 0.4, 0] });
  for (let z = -14; z <= 14; z += 1.6) { if (Math.abs(z) < 3) continue; prop.box(x1 - 2.6, TY, z - 0.65, x1 - 1.9, TY + 1.8, z + 0.65); prop.set({ col: [1, 1, 1], rm: [0.3, 0, 1.6] }); prop.box(x1 - 1.92, TY + 0.9, z - 0.5, x1 - 1.9, TY + 1.5, z + 0.5, { faces: 'X' }); prop.set({ col: hex(0xcfd2d4), rm: [0.4, 0.4, 0] }); }
  // concourse interior: a lit back wall and a floor (seen through the glass)
  prop.set({ col: hex(0xe8e4dc), rm: [0.6, 0, 0.9] }); prop.box(x1 - 9, TY, z0 + 2, x1 - 8.8, TY + 8.8, z1 - 2, { faces: 'X' });
  prop.set({ col: hex(0x6a6660), rm: [0.35, 0, 0.1] }); prop.box(x1 - 9, TY - 0.05, z0 + 2, x1, TY, z1 - 2, { faces: 'Y' });
  prop.set({ col: [1, 1, 1], rm: [0.3, 0, 2.4] }); for (let z = z0 + 6; z < z1 - 4; z += 6) prop.box(x1 - 7, TY + 8.6, z - 1.5, x1 - 1, TY + 8.65, z + 1.5, { faces: 'y' });
  // ---- the terrace: granite deck on a podium, granite edge, the canopy over it
  const tx0 = TERRACE.x0, tx1 = TERRACE.x1, tz0 = TERRACE.z0, tz1 = TERRACE.z1;
  const P = 4.8;
  const prect = (x0_, z0_, x1_, z1_, y) => pave.quad([x0_, y, z1_], [x1_, y, z1_], [x1_, y, z0_], [x0_, y, z0_], [x0_ / P, -z1_ / P, x1_ / P, -z0_ / P]);
  prect(tx0, tz0, tx1, tz1, TY);
  prop.set({ col: hex(0x8a857c), rm: [0.75, 0, 0] });
  prop.box(tx1 - 0.6, 0, tz0, tx1, TY, STAIRS.z0, { faces: 'XzZ' }); prop.box(tx1 - 0.6, 0, STAIRS.z1, tx1, TY, tz1, { faces: 'XzZ' });
  prop.box(tx0, 0, tz0 - 0.6, tx1, TY, tz0); prop.box(tx0, 0, tz1, tx1, TY, tz1 + 0.6);
  // balustrade: granite posts + a steel top rail, glass panels between (where the stair isn't)
  const bal = (xa, za, xb, zb) => {
    const L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(L / 2.4));
    prop.set({ col: hex(0x9a958c), rm: [0.7, 0, 0] });
    for (let i = 0; i <= n; i++) { const t = i / n, x = xa + (xb - xa) * t, z = za + (zb - za) * t; prop.box(x - 0.14, TY, z - 0.14, x + 0.14, TY + 1.05, z + 0.14); }
    prop.set({ col: hex(0x2a2c30), rm: [0.35, 0.8, 0] }); prop.tube([xa, TY + 1.05, za], [xb, TY + 1.05, zb], 0.05, 6);
  };
  bal(tx1 - 0.3, tz0, tx1 - 0.3, STAIRS.z0); bal(tx1 - 0.3, STAIRS.z1, tx1 - 0.3, tz1); bal(tx0, tz0 - 0.3, tx1, tz0 - 0.3); bal(tx0, tz1 + 0.3, tx1, tz1 + 0.3);
  // canopy: steel columns along the terrace edge, a thin roof with glass bays, downlights
  const cy = TY + 5.2;
  prop.set({ col: hex(0x5a5e64), rm: [0.4, 0.75, 0] });
  for (const z of [-20, -10, 10, 20]) { prop.cyl(tx1 - 1.2, TY, z, 0.2, 0.2, cy, 10, { cap: false }); colliders.push({ min: [tx1 - 1.45, TY, z - 0.25], max: [tx1 - 0.95, cy, z + 0.25], data: { mat: 'metal', kind: 'pole' } }); }
  prop.box(tx0, cy, tz0 - 1, tx1 + 1.5, cy + 0.45, tz1 + 1);
  prop.set({ col: hex(0x1a1c20), rm: [0.3, 0.6, 0] }); for (let z = tz0; z < tz1; z += 4) prop.box(tx0, cy + 0.45, z + 0.4, tx1 + 1.2, cy + 0.5, z + 3.6, { faces: 'Y' });
  prop.set({ col: [1, 0.95, 0.85], rm: [0.3, 0, 2.6] });
  for (let z = tz0 + 2; z < tz1; z += 4) for (const x of [tx0 + 4, tx1 - 3]) { prop.box(x - 0.3, cy - 0.02, z - 0.3, x + 0.3, cy, z + 0.3, { faces: 'y' }); }
  lights.push({ x: (tx0 + tx1) / 2, z: 0, w: 16, d: 46, ang: 0, color: [1.3, 1.2, 1.05], k: 0.8 });
  // ---- the stair: treads + risers, granite, a centre handrail
  const n = 23, rise = (TY - CURB) / n, run = (STAIRS.x1 - STAIRS.x0) / n;
  prop.set({ col: hex(0x8f8a80), rm: [0.7, 0, 0] });
  for (let i = 0; i < n; i++) {
    const xa = STAIRS.x0 + i * run, y = TY - (i + 1) * rise;
    prop.box(xa, 0, STAIRS.z0, xa + run, y + rise, STAIRS.z1, { faces: 'XY' });
  }
  prop.set({ col: hex(0x6e6a62), rm: [0.75, 0, 0] });
  for (const z of [STAIRS.z0, STAIRS.z1]) {
    // side walls (granite cheeks) with a steel rail on top
    for (let i = 0; i < n; i++) { const xa = STAIRS.x0 + i * run, y = TY - i * rise; prop.box(xa, 0, z - 0.3, xa + run, y + 1.0, z + 0.3); }
  }
  prop.set({ col: hex(0x2a2c30), rm: [0.35, 0.8, 0] }); prop.tube([STAIRS.x0, TY + 0.95, 0], [STAIRS.x1, CURB + 0.95, 0], 0.04, 6);
  for (let i = 0; i <= 4; i++) { const x = STAIRS.x0 + (STAIRS.x1 - STAIRS.x0) * i / 4, y = TY + (CURB - TY) * i / 4; prop.tube([x, y, 0], [x, y + 0.95, 0], 0.03, 5); }
  colliders.push({ min: [STAIRS.x0, 0, -0.08], max: [STAIRS.x1, 2, 0.08], data: { mat: 'metal', kind: 'rail', noBullet: true } });
  // terrace furniture: benches, planters, an info pillar (lit)
  prop.set({ col: hex(0x6a4a30), rm: [0.7, 0, 0] });
  for (const z of [-16, 16]) { prop.box(tx0 + 3, TY + 0.42, z - 1.2, tx0 + 3.5, TY + 0.48, z + 1.2); prop.set({ col: hex(0x3a3c40), rm: [0.5, 0.6, 0] }); prop.box(tx0 + 3.05, TY, z - 1.0, tx0 + 3.45, TY + 0.42, z - 0.9); prop.box(tx0 + 3.05, TY, z + 0.9, tx0 + 3.45, TY + 0.42, z + 1.0); prop.set({ col: hex(0x6a4a30), rm: [0.7, 0, 0] }); }
  prop.set({ col: hex(0x5a5650), rm: [0.8, 0, 0] });
  for (const z of [-7, 7]) { prop.box(tx1 - 3.4, TY, z - 0.8, tx1 - 1.8, TY + 0.7, z + 0.8); prop.set({ col: hex(0x2a4a20), rm: [0.9, 0, 0] }); prop.box(tx1 - 3.3, TY + 0.7, z - 0.7, tx1 - 1.9, TY + 1.3, z + 0.7); prop.set({ col: hex(0x5a5650), rm: [0.8, 0, 0] }); colliders.push({ min: [tx1 - 3.4, TY, z - 0.8], max: [tx1 - 1.8, TY + 1.3, z + 0.8], data: { mat: 'concrete', kind: 'planter' } }); }
  prop.set({ col: hex(0x2a2c30), rm: [0.4, 0.5, 0] }); prop.box(tx0 + 6, TY, -0.4, tx0 + 6.8, TY + 2.4, 0.4);
  { const e = SE.plate.find((p, i) => i === 11) || SE.plate[0]; signQuad(sign, [tx0 + 6.81, TY + 1.8, 0], [1, 0, 0], 0.7, 0.4, e.uv, 1.4); }
  colliders.push({ min: [tx0 + 6, TY, -0.4], max: [tx0 + 6.8, TY + 2.4, 0.4], data: { mat: 'metal', kind: 'pillar' } });
  // the concourse glass is breakable (a strip in front of the terrace)
  for (let z = -20; z < 20; z += 4) panes.push({ c: [x1 + 0.05, TY + 2.2, z + 2], n: [1, 0, 0], w: 3.8, h: 4.2, kind: 'lobby' });
  colliders.push({ min: [x0, 0, z0], max: [x1, h, z1], data: { mat: 'concrete', kind: 'building' } });
  // ---- meshes
  const facMat = facadeMaterial();
  root.add(fac.mesh(facMat));
  root.add(prop.mesh(rmMat({}), { shadow: true }));
  root.add(sign.mesh(signMaterial()));
  const mh = halo.mesh(haloMaterial()); mh.renderOrder = 6; root.add(mh);
  const pm = new THREE.MeshStandardMaterial({ map: plazaTex(), color: 0xdcd4c8, roughness: 0.55 });
  const mp = pave.mesh(pm); mp.receiveShadow = true; root.add(mp);
  pm.userData.noAO = true;
  return { root, colliders, panes, groundMats: [pm], anchors: { glows, lights } };
}

// the departure board: black LED panel, amber destinations, green times
function boardCard() {
  const W = 1024, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#060504'; g.fillRect(0, 0, W, H);
  const rows = [['快速', '新宿', 'SHINJUKU', '0:12'], ['各停', '黒金港', 'KUROGANE PORT', '0:15'], ['特急', '成田空港', 'NARITA AIRPORT', '0:21'], ['各停', '海浜', 'KAIHIN', '0:24']];
  rows.forEach(([k, d, e, t], i) => {
    const y = 34 + i * 60;
    g.font = `900 34px ${JP}`; g.textBaseline = 'middle';
    g.fillStyle = k === '特急' ? '#ff4a2a' : k === '快速' ? '#ff9a2a' : '#4ae07a'; g.fillText(k, 20, y);
    g.fillStyle = '#ffb21e'; g.fillText(d, 130, y);
    g.font = '400 26px Anton, sans-serif'; g.fillStyle = '#e8a01a'; g.fillText(e, 420, y);
    g.font = '400 34px Anton, sans-serif'; g.fillStyle = '#ffd04a'; g.fillText(t, 880, y);
  });
  // LED dot mask
  g.fillStyle = 'rgba(0,0,0,0.45)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1); for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
  const t = canvasTex(c, { repeat: false, aniso: 4 });
  return new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.5, 1.5) }));
}
