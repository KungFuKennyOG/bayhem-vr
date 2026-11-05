import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex } from './kit.js';
import { facadeMaterial, cellRect, FCELL } from './facade.js';
import { signAtlas, JP } from './signs.js';
import { signAtlas2 } from './signs2.js';
import { signQuad, signMaterial, haloMaterial } from './city.js';
import { plazaTex } from './street.js';
import { STATION, SKY, STAIRS, VIADUCT, CURB, PLAZA } from './layout.js';

// =====================================================================================
//  Kurogane Station, Shibuya-style:
//   - the ELEVATED RAILWAY along the plaza's west side: a concrete viaduct on arches, ballast, two
//     tracks, catenary masts and wires; silver commuter trains with a green band roll through (one
//     passes under the skybridge during the title);
//   - izakaya and standing bars built into the arches under the tracks (red lanterns, noren, smoke);
//   - the station behind: a long glass concourse with its green name sign, and the glass tower
//     rising over it (Shibuya's Scramble Square stand-in) with a lit crown;
//   - the SKYBRIDGE from the upper concourse over the tracks (the intro vantage) and its broad stair
//     down into Hachikō square.
// =====================================================================================
const RAIL_Y = VIADUCT.y + 0.32;
export function buildStation(ctx = {}) {
  const rng = makeRng(808);
  const R = (a, b) => a + (b - a) * rng();
  const root = new THREE.Group(); root.name = 'station';
  const colliders = [], glows = [], lights = [], panes = [];
  const fac = new Acc({ cell: true, info: true }), prop = new Acc({ rm: true }), sign = new Acc(), sign2 = new Acc(), halo = new Acc(), pave = new Acc();
  const { E: SE } = signAtlas(), { E: S2 } = signAtlas2();
  const wall = (O, T, L, y0, y1, cell, info, bay = 3, floorH = 3.4, col = [1, 1, 1]) => {
    fac.set({ cell: cellRect(cell), info, col });
    const a = [O[0], y0, O[2]], b = [O[0] + T[0] * L, y0, O[2] + T[2] * L];
    fac.quad(a, b, [b[0], y1, b[2]], [a[0], y1, a[2]], [0, 0, Math.max(1, Math.round(L / bay)), (y1 - y0) / floorH]);
  };
  // ---------------------------------------------------------------- the station building
  const { x0, x1, z0, z1, h } = STATION;
  wall([x1, 0, z1], [0, 0, -1], z1 - z0, 0, 6.5, FCELL.base, [91, 0, 0, 3], 2, 6.5);
  wall([x1, 0, z1], [0, 0, -1], z1 - z0, 6.5, 16, FCELL.stationGlass, [91, 0.9, 0.8, 0], 4, 9.5);
  wall([x1, 0, z1], [0, 0, -1], z1 - z0, 16, h, FCELL.ribbonDark, [92, 0.4, 0.25, 0], 3, 3.4);
  for (const [O, T, L] of [[[x0, 0, z1], [1, 0, 0], x1 - x0], [[x1, 0, z0], [-1, 0, 0], x1 - x0], [[x0, 0, z0], [0, 0, 1], z1 - z0]]) wall(O, T, L, 0, h, FCELL.side, [93, 0.2, 0.4, 1], 3.6, 3.3, [0.8, 0.8, 0.8]);
  fac.set({ cell: cellRect(FCELL.roof), info: [94, 0, 0, 3], col: [0.7, 0.7, 0.7] });
  fac.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 0, (x1 - x0) / 4, (z1 - z0) / 4]);
  // the concourse behind the glass: a lit ceiling grid, a floor, gates, the departure board
  prop.set({ col: hex(0xe8e4dc), rm: [0.6, 0, 0.7] }); prop.box(x1 - 10, 6.5, z0 + 2, x1 - 9.8, 16, z1 - 2, { faces: 'X' });
  prop.set({ col: hex(0x5a5650), rm: [0.35, 0, 0.1] }); prop.box(x1 - 10, 6.45, z0 + 2, x1, 6.5, z1 - 2, { faces: 'Y' });
  prop.set({ col: [1, 1, 1], rm: [0.3, 0, 2.4] }); for (let z = z0 + 6; z < z1 - 4; z += 5) for (const dx of [-7, -3.5]) prop.box(x1 + dx - 0.6, 15.6, z - 1.6, x1 + dx + 0.6, 15.65, z + 1.6, { faces: 'y' });
  prop.set({ col: hex(0xbfc4c8), rm: [0.4, 0.5, 0] }); for (let z = -14; z <= 14; z += 2) { if (Math.abs(z) < 4) continue; prop.box(x1 - 6, 6.5, z - 0.12, x1 - 4.6, 7.6, z + 0.12); }
  const board = boardCard(); board.position.set(x1 - 9.6, 12.6, 0); board.rotation.y = Math.PI / 2; root.add(board);
  glows.push({ p: [x1 - 9, 12.6, 0], color: [1.6, 0.9, 0.2], size: 7 });
  for (let z = -60; z < 60; z += 5) panes.push({ c: [x1 + 0.05, 11.2, z + 2.5], n: [1, 0, 0], w: 4.8, h: 9, kind: 'lobby' });
  // the name: a long green band along the fascia (JR-style), and the big lit name over the concourse
  prop.set({ col: hex(0x1d2024), rm: [0.5, 0.5, 0] }); prop.box(x1, 16, z0, x1 + 1.0, 19.5, z1);
  for (const z of [-34, 0, 34]) signQuad(sign2, [x1 + 1.02, 17.75, z], [1, 0, 0], 16, 1.6, S2.jr.uv, 1.5);
  const st = SE.panel.find(p => p.kind === 'station');
  signQuad(sign, [x1 + 1.02, h - 3.2, -18], [1, 0, 0], 15, 5, st.uv, 1.45); signQuad(sign, [x1 + 1.02, h - 3.2, 18], [1, 0, 0], 15, 5, st.uv, 1.45);
  prop.set({ col: hex(0x1d2024), rm: [0.5, 0.5, 0] }); prop.box(x1, h - 6, -26, x1 + 1, h - 0.4, 26);
  glows.push({ p: [x1 + 2, h - 3.2, -18], color: [1.0, 1.0, 0.95], size: 12, far: true }, { p: [x1 + 2, h - 3.2, 18], color: [1.0, 1.0, 0.95], size: 12, far: true });
  colliders.push({ min: [x0, 0, z0], max: [x1, h, z1], data: { mat: 'concrete', kind: 'building' } });
  // ---------------------------------------------------------------- the tower over the station (Scramble Square stand-in)
  {
    const tx0 = -150, tx1 = -112, tz0 = -24, tz1 = 14, th = 170;
    for (const [O, T, L] of [[[tx1, 0, tz1], [0, 0, -1], tz1 - tz0], [[tx0, 0, tz1], [1, 0, 0], tx1 - tx0], [[tx1, 0, tz0], [-1, 0, 0], tx1 - tx0], [[tx0, 0, tz0], [0, 0, 1], tz1 - tz0]]) wall(O, T, L, h, th, FCELL.curtainBlue, [95, 0.55, 0.15, 0], 3, 4.2);
    fac.set({ cell: cellRect(FCELL.roof), info: [96, 0, 0, 3], col: [0.5, 0.5, 0.5] }); fac.quad([tx0, th, tz1], [tx1, th, tz1], [tx1, th, tz0], [tx0, th, tz0], [0, 0, 8, 8]);
    // the crown: an open rooftop deck with a lit rim, vertical fins down the corners
    prop.set({ col: [1, 1, 1], rm: [0.3, 0, 2.2] }); prop.box(tx0 - 0.4, th - 0.6, tz0 - 0.4, tx1 + 0.4, th, tz1 + 0.4, { faces: 'xXzZ' });
    prop.set({ col: hex(0x8a9096), rm: [0.4, 0.7, 0] });
    for (const [x, z] of [[tx0, tz0], [tx1, tz0], [tx0, tz1], [tx1, tz1]]) prop.box(x - 0.6, h, z - 0.6, x + 0.6, th + 4, z + 0.6);
    for (const [x, z] of [[tx0, tz0], [tx1, tz1], [tx1, tz0]]) glows.push({ p: [x, th + 4.5, z], color: [3.2, 0.25, 0.15], size: 2.2, blink: true, rate: 1.6, far: true });
    glows.push({ p: [(tx0 + tx1) / 2, th, tz1 + 2], color: [0.9, 0.95, 1.1], size: 30, far: true });
  }
  // ---------------------------------------------------------------- the viaduct: arches, deck, ballast, rails, catenary
  const vx0 = VIADUCT.x0, vx1 = VIADUCT.x1, vy = VIADUCT.y;
  const BAY = 10;
  prop.set({ col: hex(0x7a766e), rm: [0.9, 0, 0] });
  prop.box(vx0, vy - 1.4, VIADUCT.z0, vx1, vy, VIADUCT.z1, { faces: 'xXy' });      // the deck slab
  prop.set({ col: hex(0x6a665e), rm: [0.9, 0, 0] });
  prop.box(vx0 - 0.3, vy, VIADUCT.z0, vx0, vy + 1.2, VIADUCT.z1, { faces: 'xXY' }); prop.box(vx1, vy, VIADUCT.z0, vx1 + 0.3, vy + 1.2, VIADUCT.z1, { faces: 'xXY' }); // parapets
  prop.set({ col: hex(0x4a453e), rm: [0.95, 0, 0] }); prop.box(vx0, vy, VIADUCT.z0, vx1, vy + 0.18, VIADUCT.z1, { faces: 'Y' }); // ballast
  // sleepers + rails, two tracks
  for (const tc of [vx0 + 3.6, vx1 - 3.6]) {
    prop.set({ col: hex(0x5a5650), rm: [0.9, 0, 0] });
    for (let z = -160; z < 160; z += 0.9) prop.box(tc - 1.2, vy + 0.18, z, tc + 1.2, vy + 0.3, z + 0.24, { faces: 'Y' });
    prop.set({ col: hex(0xa8acb0), rm: [0.3, 0.9, 0] });
    for (const s of [-0.53, 0.53]) prop.box(tc + s - 0.04, vy + 0.3, VIADUCT.z0, tc + s + 0.04, RAIL_Y + 0.02, VIADUCT.z1, { faces: 'xXY' });
  }
  // catenary masts every 30 m + the wires (thin, dark)
  for (let z = -300; z < 300; z += 30) {
    prop.set({ col: hex(0x5a5e62), rm: [0.5, 0.6, 0] });
    for (const x of [vx0 + 0.3, vx1 - 0.3]) prop.box(x - 0.15, vy, z - 0.15, x + 0.15, vy + 7.2, z + 0.15);
    prop.box(vx0 + 0.3, vy + 6.6, z - 0.1, vx1 - 0.3, vy + 6.9, z + 0.1);
  }
  prop.set({ col: hex(0x101012), rm: [0.6, 0.3, 0] });
  for (const tc of [vx0 + 3.6, vx1 - 3.6]) for (const dy of [5.3, 6.4]) prop.tube([tc, vy + dy, VIADUCT.z0], [tc, vy + dy, VIADUCT.z1], 0.018, 3);
  // arches: piers every BAY m; between them, brick infill on the plaza side with tiny bars (red lanterns, noren)
  for (let z = VIADUCT.z0 + 5; z < VIADUCT.z1; z += BAY) {
    prop.set({ col: hex(0x6e6a62), rm: [0.9, 0, 0] });
    prop.box(vx0, 0, z - 0.8, vx1, vy - 1.4, z + 0.8);
    colliders.push({ min: [vx0, 0, z - 0.8], max: [vx1, vy, z + 0.8], data: { mat: 'concrete', kind: 'pier' } });
    // the arch soffit: a curved band of segments
    for (let k = 0; k < 6; k++) { const a0 = k / 6 * Math.PI, a1 = (k + 1) / 6 * Math.PI; const za = z + 0.8 + (1 - Math.cos(a0)) * (BAY - 1.6) / 2, zb = z + 0.8 + (1 - Math.cos(a1)) * (BAY - 1.6) / 2, ya = vy - 1.4 - Math.sin(a0) * 1.4, yb = vy - 1.4 - Math.sin(a1) * 1.4; prop.box(vx0, Math.min(ya, yb) - 0.3, Math.min(za, zb), vx1, vy - 1.4, Math.max(za, zb), { faces: 'yxX' }); }
  }
  // the bars under the arches facing the plaza (z within the plaza's reach, both sides of the bridge)
  const gado = (zc) => {
    const zA = zc - 3.8, zB = zc + 3.8, x = vx1 + 0.02;
    prop.set({ col: hex(0x3a2418), rm: [0.8, 0, 0] }); prop.box(vx1 - 0.3, 0, zA, vx1, 4.6, zB, { faces: 'X' });
    // a lit doorway / counter window with noren, a red lantern each side, a hand-painted menu, a stool or two
    prop.set({ col: hex(0xe8a85a), rm: [0.5, 0, 1.3] }); prop.box(vx1 - 0.25, 0.2, zc - 1.6, vx1 + 0.01, 2.3, zc + 1.6, { faces: 'X' });
    const nc = [0x1a2a5a, 0x5a1a1a, 0x2a2a2a, 0x1a4a2a][Math.floor(rng() * 4)];
    for (let k = 0; k < 4; k++) { prop.set({ col: hex(nc), rm: [0.9, 0, 0.02] }); prop.box(x, 1.55, zc - 1.6 + k * 0.8 + 0.04, x + 0.03, 2.3, zc - 1.6 + (k + 1) * 0.8 - 0.04, { faces: 'X' }); }
    for (const dz of [-2.4, 2.4]) { prop.set({ col: hex(0xd8281c), rm: [0.6, 0, 1.6] }); prop.cyl(x + 0.35, 2.0, zc + dz, 0.22, 0.22, 2.65, 8); glows.push({ p: [x + 0.4, 2.32, zc + dz], color: [2.6, 0.55, 0.25], size: 0.9 }); }
    const m = SE.plate[Math.floor(rng() * 6)]; signQuad(sign, [x + 0.01, 3.4, zc], [1, 0, 0], 3.2, 0.5, m.uv, 1.2);
    const b = SE.blade[[2, 10, 26, 36][Math.floor(rng() * 4)]]; signQuad(sign, [x + 0.25, 3.3, zc - 3.2], [0, 0, 1], 0.5, 2.4, b.uv, 1.4); signQuad(sign, [x + 0.25, 3.3, zc - 3.25], [0, 0, -1], 0.5, 2.4, b.uv, 1.4);
    prop.set({ col: hex(0x6a4a2a), rm: [0.8, 0, 0] }); for (const dz of [-1, 0, 1]) prop.cyl(x + 0.6, 0, zc + dz, 0.18, 0.18, 0.62, 6);
    lights.push({ x: x + 2.5, z: zc, w: 7, d: 4, ang: Math.PI / 2, color: [1.7, 0.9, 0.45], k: 0.9 });
    // cooking smoke drifting out
    glows.push({ p: [x + 0.6, 3.6, zc], color: [0.35, 0.22, 0.14], size: 2.5 });
  };
  for (const zc of [-25, -15, 15, 25, -45, -35, 35, 45]) gado(zc);
  // the plaza side of the viaduct where there are no bars: brick
  // ---------------------------------------------------------------- the skybridge (glass, steel frame) + its stair
  const sx0 = SKY.x0, sx1 = SKY.x1, sz0 = SKY.z0, sz1 = SKY.z1, sy = SKY.y;
  prop.set({ col: hex(0x3a3c40), rm: [0.4, 0.7, 0] });
  prop.box(sx0, sy - 1.0, sz0 - 0.2, sx1, sy, sz1 + 0.2, { faces: 'yzZxX' });                       // floor beam
  prop.box(sx0, sy + 3.4, sz0 - 0.3, sx0 + 14, sy + 3.7, sz1 + 0.3);                               // roof (the outer half is open)
  for (let x = sx0; x <= sx0 + 14; x += 4) for (const z of [sz0 - 0.1, sz1 + 0.1]) prop.box(x - 0.08, sy, z - 0.08, x + 0.08, sy + 3.4, z + 0.08);
  prop.set({ col: [1, 0.97, 0.9], rm: [0.3, 0, 2.2] }); for (let x = sx0 + 2; x < sx0 + 14; x += 4) prop.box(x - 0.8, sy + 3.38, -0.25, x + 0.8, sy + 3.4, 0.25, { faces: 'y' });
  // lamp posts along the open half
  prop.set({ col: hex(0x5a5e62), rm: [0.45, 0.6, 0] }); for (const x of [sx0 + 18, sx1 - 2]) for (const z of [sz0 + 0.2, sz1 - 0.2]) { prop.cyl(x, sy, z, 0.06, 0.06, sy + 3.2, 6, { cap: false }); glows.push({ p: [x, sy + 3.25, z], color: [2.2, 2.0, 1.7], size: 0.6 }); }
  prop.set({ col: hex(0x8a8c90), rm: [0.35, 0.6, 0] }); prop.tube([sx0, sy + 1.0, sz0 + 0.15], [sx1, sy + 1.0, sz0 + 0.15], 0.03, 5); prop.tube([sx0, sy + 1.0, sz1 - 0.15], [sx1, sy + 1.0, sz1 - 0.15], 0.03, 5);
  // open sides: a waist-high glass-and-steel parapet only (VR: the view over the tracks and the crossing is the point)
  prop.set({ col: hex(0x2a2c30), rm: [0.4, 0.6, 0] }); for (const z of [sz0, sz1]) prop.box(sx0, sy, z - 0.12, sx1, sy + 0.25, z + 0.12);
  prop.set({ col: hex(0x5a6066), rm: [0.35, 0.7, 0] }); for (const z of [sz0, sz1]) prop.tube([sx0, sy + 1.1, z], [sx1, sy + 1.1, z], 0.04, 6);
  const P = 4.8;
  pave.quad([sx0, sy, sz1], [sx1, sy, sz1], [sx1, sy, sz0], [sx0, sy, sz0], [sx0 / P, -sz1 / P, sx1 / P, -sz0 / P]);
  // the bridge's support columns down to the plaza at its east end
  prop.set({ col: hex(0x5a5c60), rm: [0.45, 0.6, 0] });
  for (const z of [sz0 + 0.4, sz1 - 0.4]) { prop.box(sx1 - 0.4, 0, z - 0.25, sx1 + 0.1, sy - 1, z + 0.25); colliders.push({ min: [sx1 - 0.4, 0, z - 0.25], max: [sx1 + 0.1, sy - 1, z + 0.25], data: { mat: 'metal', kind: 'pole' } }); }
  lights.push({ x: -60, z: 0, w: 22, d: 9, ang: 0, color: [1.2, 1.15, 1.05], k: 0.5 });
  // the stair: treads, granite cheeks with steel rails, a centre rail
  const n = 40, rise = (sy - CURB) / n, run = (STAIRS.x1 - STAIRS.x0) / n;
  prop.set({ col: hex(0x8f8a80), rm: [0.7, 0, 0] });
  for (let i = 0; i < n; i++) { const xa = STAIRS.x0 + i * run, y = sy - (i + 1) * rise; prop.box(xa, Math.max(0, y - 0.6), STAIRS.z0, xa + run, y + rise, STAIRS.z1, { faces: 'XY' }); }
  prop.set({ col: hex(0x6e6a62), rm: [0.75, 0, 0] });
  for (const z of [STAIRS.z0, STAIRS.z1]) for (let i = 0; i < n; i += 2) { const xa = STAIRS.x0 + i * run, y = sy - i * rise; prop.box(xa, Math.max(0, y - 3), z - 0.3, xa + run * 2, y + 1.0, z + 0.3); }
  prop.set({ col: hex(0x5a5c60), rm: [0.45, 0.6, 0] }); for (let x = STAIRS.x0 + 4; x < STAIRS.x1 - 2; x += 6) { const y = sy + (CURB - sy) * (x - STAIRS.x0) / (STAIRS.x1 - STAIRS.x0); for (const z of [STAIRS.z0 + 0.5, STAIRS.z1 - 0.5]) prop.box(x - 0.2, 0, z - 0.2, x + 0.2, y - 0.6, z + 0.2); }
  prop.set({ col: hex(0x2a2c30), rm: [0.35, 0.8, 0] }); prop.tube([STAIRS.x0, sy + 0.95, 0], [STAIRS.x1, CURB + 0.95, 0], 0.04, 6);
  colliders.push({ min: [STAIRS.x0, 0, -0.08], max: [STAIRS.x1, sy + 1, 0.08], data: { mat: 'metal', kind: 'rail', noBullet: true } });
  // ---------------------------------------------------------------- the trains (silver, green band, lit windows): their own meshes
  const trains = [buildTrain(S2, 10, 0), buildTrain(S2, 10, 1)];
  trains[0].dir = 1; trains[0].x = vx1 - 3.6; trains[0].z = -260; trains[0].speed = 13;
  trains[1].dir = -1; trains[1].x = vx0 + 3.6; trains[1].z = 330; trains[1].speed = 11; trains[1].wait = 22;
  for (const T of trains) { T.root.position.set(T.x, RAIL_Y, T.z); T.root.rotation.y = T.dir > 0 ? Math.PI : 0; root.add(T.root); }
  // ---------------------------------------------------------------- meshes
  const facMat = facadeMaterial();
  root.add(fac.mesh(facMat));
  root.add(prop.mesh(rmMat({}), { shadow: false }));
  root.add(sign.mesh(signMaterial()));
  root.add(sign2.mesh(new THREE.MeshBasicMaterial({ map: signAtlas2().tex, vertexColors: true })));
  if (halo.vn) { const mh = halo.mesh(haloMaterial()); mh.renderOrder = 6; root.add(mh); }
  const pm = new THREE.MeshStandardMaterial({ map: plazaTex(), color: 0xdcd4c8, roughness: 0.55 });
  pm.userData.noAO = true;
  const mp = pave.mesh(pm); root.add(mp);
  const update = (dt, t) => {
    for (const T of trains) {
      if (T.wait > 0) { T.wait -= dt; continue; }
      T.z += T.dir * T.speed * dt;
      if (T.dir > 0 && T.z > 340) { T.z = -330; T.wait = R(16, 26); }
      if (T.dir < 0 && T.z < -340) { T.z = 330; T.wait = R(16, 26); }
      T.root.position.z = T.z;
    }
  };
  return { root, colliders, panes, groundMats: [pm], anchors: { glows, lights }, update, trains };
}

// a commuter train: n cars of 20 m, stainless with a green band, lit windows, a lit cab; one draw for the body
function buildTrain(S2, n = 10, seed = 0) {
  const A = new Acc({ rm: true }), W = new Acc();
  const L = 19.5, hw = 1.45, hh = 3.9;
  for (let i = 0; i < n; i++) {
    const z0 = i * 20, z1 = z0 + L;
    A.set({ col: hex(0xb8bcc0), rm: [0.3, 0.85, 0] }); A.box(-hw, 0.95, z0, hw, hh, z1, { faces: 'xXYzZ' });
    A.set({ col: hex(0x2a2c30), rm: [0.6, 0.4, 0] }); A.box(-hw + 0.1, 0.25, z0 + 1, hw - 0.1, 0.95, z1 - 1, { faces: 'xXzZ' });
    A.set({ col: hex(0x1f9a4a), rm: [0.4, 0.3, 0.05] }); for (const s of [-1, 1]) A.box(s > 0 ? hw : -hw - 0.01, 1.55, z0, s > 0 ? hw + 0.01 : -hw, 1.9, z1, { faces: s > 0 ? 'X' : 'x' });
    // windows (lit) + doors
    for (let k = 0; k < 4; k++) {
      const zc = z0 + 2.4 + k * 4.9;
      for (const s of [-1, 1]) {
        W.set({ col: [1.6, 1.55, 1.4] }); const x = s * (hw + 0.012);
        W.quad([x, 2.05, zc - 1.1 * s], [x, 2.05, zc + 1.1 * s], [x, 3.05, zc + 1.1 * s], [x, 3.05, zc - 1.1 * s]);
        A.set({ col: hex(0x8a9096), rm: [0.35, 0.8, 0] }); A.box(s > 0 ? hw : -hw - 0.02, 1.0, zc + 1.4, s > 0 ? hw + 0.02 : -hw, 3.3, zc + 2.4, { faces: s > 0 ? 'X' : 'x' });
      }
    }
    // the roof: AC units
    A.set({ col: hex(0x8a8e92), rm: [0.5, 0.6, 0] }); A.box(-0.9, hh, z0 + 3, 0.9, hh + 0.35, z0 + 7); A.box(-0.9, hh, z1 - 7, 0.9, hh + 0.35, z1 - 3);
  }
  // the cab ends: a dark windscreen, headlights / tail lights
  A.set({ col: hex(0x101418), rm: [0.15, 0.3, 0] }); A.box(-hw + 0.2, 2.2, -0.02, hw - 0.2, 3.4, 0.0, { faces: 'z' });
  const m = new THREE.Group();
  const body = A.mesh(rmMat({})); m.add(body);
  const win = W.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })); m.add(win);
  const head = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.0) })); head.position.set(0, 1.4, -0.03); head.rotation.y = Math.PI; m.add(head);
  return { root: m, len: n * 20 };
}

// the departure board: black LED panel, amber destinations, green times
function boardCard() {
  const W = 1024, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#060504'; g.fillRect(0, 0, W, H);
  const rows = [['快速', '新宿', 'SHINJUKU', '0:12'], ['各停', '品川', 'SHINAGAWA', '0:15'], ['特急', '成田空港', 'NARITA AIRPORT', '0:21'], ['各停', '池袋', 'IKEBUKURO', '0:24']];
  rows.forEach(([k, d, e, t], i) => {
    const y = 34 + i * 60;
    g.font = `900 34px ${JP}`; g.textBaseline = 'middle';
    g.fillStyle = k === '特急' ? '#ff4a2a' : k === '快速' ? '#ff9a2a' : '#4ae07a'; g.fillText(k, 20, y);
    g.fillStyle = '#ffb21e'; g.fillText(d, 130, y);
    g.font = '400 26px Anton, sans-serif'; g.fillStyle = '#e8a01a'; g.fillText(e, 420, y);
    g.font = '400 34px Anton, sans-serif'; g.fillStyle = '#ffd04a'; g.fillText(t, 880, y);
  });
  g.fillStyle = 'rgba(0,0,0,0.45)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1); for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
  const t = canvasTex(c, { repeat: false, aniso: 4 });
  return new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.5, 1.5) }));
}
