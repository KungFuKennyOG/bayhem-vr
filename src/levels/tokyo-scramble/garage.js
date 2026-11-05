import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex } from './kit.js';
import { facadeMaterial, cellRect, FCELL } from './facade.js';
import { signAtlas, JP } from './signs.js';
import { signQuad, signMaterial, haloMaterial } from './city.js';
import { GARAGE, APRON, R1, R1TOP, DECK_A, R2, DECK_B, GORE, CURB } from './layout.js';

// =====================================================================================
//  The multi-storey car park: a ramp up from the avenue to the open roof deck A (y 6), a ramp up
//  the back to deck B (y 12), the link onto the expressway. Bare concrete, painted bays and
//  numbers, wheel stops, LED masts throwing cold pools, a big lit "P" on the roof. The street sides
//  are a screen of vertical fins with the ramp slabs showing through.
// =====================================================================================
function deckTex() {
  const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), rng = makeRng(41);
  g.fillStyle = '#6a6863'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 18000; i++) { const v = rng(); g.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${0.12 * rng()})`; g.fillRect(rng() * S, rng() * S, 1.5, 1.5); }
  // tyre marks and oil
  for (let i = 0; i < 8; i++) { g.strokeStyle = `rgba(20,18,16,${0.12 + rng() * 0.12})`; g.lineWidth = 6 + rng() * 6; g.beginPath(); const x = rng() * S; g.moveTo(x, 0); g.bezierCurveTo(x + (rng() - 0.5) * 200, S * 0.3, x + (rng() - 0.5) * 200, S * 0.6, x + (rng() - 0.5) * 120, S); g.stroke(); }
  for (let i = 0; i < 10; i++) { const x = rng() * S, y = rng() * S, r = 8 + rng() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(15,14,12,0.4)'); gr.addColorStop(1, 'rgba(15,14,12,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // saw-cut joints every 4 m (the tile is 8 m)
  g.strokeStyle = 'rgba(30,28,26,0.5)'; g.lineWidth = 2; for (const k of [0, 256]) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); }
  return canvasTex(c, { aniso: 8 });
}

export function buildGarage(ctx = {}) {
  const rng = makeRng(909);
  const root = new THREE.Group(); root.name = 'garage';
  const colliders = [], glows = [], lights = [];
  const fac = new Acc({ cell: true, info: true }), prop = new Acc({ rm: true }), sign = new Acc(), halo = new Acc(), deck = new Acc(), paint = new Acc();
  const { E: SE } = signAtlas();
  const { x0, x1, z0, z1 } = GARAGE;
  const A = DECK_A.y, B = DECK_B.y;
  const DS = 8;
  const top = (x0_, z0_, x1_, z1_, y, col = [1, 1, 1]) => { deck.set({ col }); deck.quad([x0_, y, z1_], [x1_, y, z1_], [x1_, y, z0_], [x0_, y, z0_], [x0_ / DS, -z1_ / DS, x1_ / DS, -z0_ / DS]); };
  // a ramp surface rising along x between (xa, ya) and (xb, yb)
  const rampTop = (xa, ya, xb, yb, z0_, z1_) => { const xl = Math.min(xa, xb), xh = Math.max(xa, xb), yl = xa < xb ? ya : yb, yh = xa < xb ? yb : ya; deck.set({ col: [0.95, 0.95, 0.95] }); deck.quad([xl, yl, z1_], [xh, yh, z1_], [xh, yh, z0_], [xl, yl, z0_], [xl / DS, -z1_ / DS, xh / DS, -z0_ / DS]); };
  // ---- the outer walls: concrete on the ground floor, a fin screen above it, both street faces
  const wall = (O, T, L, y0, y1, cell, info, bay = 3, floorH = 3, col = [1, 1, 1]) => { fac.set({ cell: cellRect(cell), info, col }); const a = [O[0], y0, O[2]], b = [O[0] + T[0] * L, y0, O[2] + T[2] * L]; fac.quad(a, b, [b[0], y1, b[2]], [a[0], y1, a[2]], [0, 0, Math.max(1, Math.round(L / bay)), (y1 - y0) / floorH]); };
  // south face (avenue): ground floor shopfront-ish wall left of the apron; the north section rises behind
  wall([x0, 0, z1], [1, 0, 0], APRON.x0 - x0, 0, A, FCELL.garageWall, [71, 0, 0, 3], 3, 3);
  wall([APRON.x1, 0, z1], [1, 0, 0], x1 - APRON.x1, 0, 1.1, FCELL.concrete, [72, 0, 0, 3], 3, 1.1);   // low wall under the open ramp
  wall([x1, 0, z1], [0, 0, -1], z1 - z0, 0, A, FCELL.garageWall, [73, 0, 0, 3], 3, 3, [0.9, 0.9, 0.9]);
  wall([x0, 0, z0], [0, 0, 1], (-80) - z0, 0, B, FCELL.garageWall, [74, 0, 0, 3], 3, 3, [0.9, 0.9, 0.9]);
  wall([x0, 0, -80], [0, 0, 1], z1 - (-80), 0, A, FCELL.garageWall, [75, 0, 0, 3], 3, 3, [0.9, 0.9, 0.9]);
  wall([x1, 0, z0], [-1, 0, 0], x1 - x0, 0, B, FCELL.garageWall, [76, 0, 0, 3], 3, 3, [0.85, 0.85, 0.85]);
  wall([x1, 0, -80], [0, 0, -1], 6, 0, B, FCELL.garageWall, [77, 0, 0, 3], 3, 3, [0.9, 0.9, 0.9]);
  // the north section's face toward deck A (under R2 and its landing): bare concrete, a door, a lamp
  wall([x0, A, R2.z1], [1, 0, 0], x1 - x0, A, B, FCELL.garageWall, [78, 0, 0, 3], 3, 3);
  // ---- decks + ramps (one concrete material; parking paint on its own decal mesh)
  top(APRON.x0, APRON.z0, APRON.x1, APRON.z1, CURB);
  rampTop(R1.x0, R1.y0, R1.x1, R1.y1, R1.z0, R1.z1);
  top(R1TOP.x0, R1TOP.z0, R1TOP.x1, R1TOP.z1, A);
  top(DECK_A.x0, DECK_A.z0, DECK_A.x1, DECK_A.z1, A);
  rampTop(R2.x0, R2.y0, R2.x1, R2.y1, R2.z0, R2.z1);
  top(DECK_A.x0, R2.z0, R2.x0, R2.z1, B); top(R2.x1, R2.z0, DECK_A.x1, R2.z1, A);
  top(DECK_B.x0, DECK_B.z0, DECK_B.x1, DECK_B.z1, B);
  // slab edges (visible from the street): thick concrete bands
  prop.set({ col: hex(0x8c8a84), rm: [0.85, 0, 0] });
  prop.box(x0, A - 0.5, z1 - 0.3, x1, A + 0.05, z1, { faces: 'Zy' });
  prop.box(R1.x0, 0, R1.z0 - 0.3, R1.x1, 0.2, R1.z0, { faces: '' });
  // ---- parapets (1.1 m) with a steel rail: deck A south edge over R1, deck A east / west, the R2 sides, deck B all round
  const par = (xa, za, xb, zb, y, h = 1.1, kind = 'parapet') => {
    prop.set({ col: hex(0x9a978f), rm: [0.85, 0, 0] });
    prop.box(Math.min(xa, xb), y, Math.min(za, zb), Math.max(xa, xb), y + h, Math.max(za, zb));
    colliders.push({ min: [Math.min(xa, xb), y - 0.3, Math.min(za, zb)], max: [Math.max(xa, xb), y + h, Math.max(za, zb)], data: { mat: 'concrete', kind } });
  };
  // R1: its avenue side, and the wall between it and deck A (deck A is higher than the ramp until the top)
  for (let x = R1.x0; x < R1.x1; x += 5) { const ya = R1.y0 + (R1.y1 - R1.y0) * (x - R1.x0) / (R1.x1 - R1.x0); par(x, R1.z1, x + 5, R1.z1 + 0.35, ya - 0.2, 1.3); }
  par(R1.x1, R1TOP.z1, x1, R1TOP.z1 + 0.35, A);
  for (let x = R1.x0; x < R1.x1; x += 5) { const ya = R1.y0 + (R1.y1 - R1.y0) * (x - R1.x0) / (R1.x1 - R1.x0); par(x, R1.z0 - 0.35, x + 5, R1.z0, ya - 0.2, A - ya + 1.1); }
  par(APRON.x0, APRON.z0 - 0.35, R1.x0, APRON.z0, 0, A + 1.1);
  par(DECK_A.x0 - 0.35, DECK_A.z0, DECK_A.x0, DECK_A.z1, A); par(DECK_A.x1, DECK_A.z0, DECK_A.x1 + 0.35, R1TOP.z1, A);
  // R2: the deck-A side (the ramp rises above deck A) and its far side
  for (let x = R2.x0 - 18; x < R2.x1 - 8; x += 4) { const ya = Math.min(B, Math.max(A, R2.y0 + (R2.y1 - R2.y0) * (x + 2 - R2.x0) / (R2.x1 - R2.x0))); par(x, R2.z1, x + 4, R2.z1 + 0.35, A, ya - A + 1.1); }
  // deck B: all round except the R2 top landing (x < R2.x0 on its south side) and the link opening
  par(DECK_B.x0 - 0.35, DECK_B.z0, DECK_B.x0, R2.z1, B); par(DECK_B.x1, DECK_B.z0, DECK_B.x1 + 0.35, R2.z1, B);
  par(R2.x0, R2.z0 - 0.35, DECK_B.x1, R2.z0, B);
  // ...and below that parapet, a full wall between the climbing ramp and deck B
  colliders.push({ min: [R2.x0, A, R2.z0 - 0.35], max: [x1, B + 1.1, R2.z0], data: { mat: 'concrete', kind: 'wall' } });
  wall([R2.x0, A, R2.z0], [1, 0, 0], x1 - R2.x0, A, B, FCELL.garageWall, [79, 0, 0, 3], 3, 3, [0.8, 0.8, 0.8]);
  par(DECK_B.x0, DECK_B.z0 - 0.35, GORE.x0 + 6, DECK_B.z0, B); par(GORE.x1, DECK_B.z0 - 0.35, DECK_B.x1, DECK_B.z0, B);
  // the solid body (bullets only: the floors themselves come from the layout's ground function)
  colliders.push({ min: [x0, 0, DECK_A.z0], max: [x1, A, z1], data: { mat: 'concrete', kind: 'deckbody', noBlock: true } });
  colliders.push({ min: [x0, 0, z0], max: [x1, B, R2.z1], data: { mat: 'concrete', kind: 'deckbody', noBlock: true } });
  // walls at street level so nobody walks into the body (the apron is the only way in)
  const sw = (a, b) => colliders.push({ min: a, max: b, data: { mat: 'concrete', kind: 'wall' } });
  sw([x0 - 0.3, 0, z0], [x0, B, z1]); sw([x1, 0, z0], [x1 + 0.3, B, z1]); sw([x0, 0, z0 - 0.3], [x1, B, z0]);
  sw([R1.x0, 0, z1 - 0.3], [x1, 1.1, z1]);
  // ---- painted bays, numbers, arrows; wheel stops; the fin screen on the street faces
  const pq = (cx, y, cz, w, l, ang = 0) => { const c = Math.cos(ang), s = Math.sin(ang); const P = (a, b) => [cx + c * a - s * b, y + 0.012, cz + s * a + c * b]; paint.quad(P(-w / 2, l / 2), P(w / 2, l / 2), P(w / 2, -l / 2), P(-w / 2, -l / 2)); };
  for (const [zA, zB, y] of [[-34, -28, A], [-73, -79, A], [-97, -88, B], [-127, -119, B]]) {
    for (let x = 48; x < 112; x += 2.6) { pq(x, y, (zA + zB) / 2, 0.12, Math.abs(zB - zA)); }
    prop.set({ col: hex(0x8a7a3a), rm: [0.85, 0, 0] });
    const zs = zA < zB ? zA + 0.5 : zA - 0.5;
    for (let x = 49.3; x < 110; x += 2.6) prop.box(x - 0.8, y, zs - 0.08, x + 0.8, y + 0.12, zs + 0.08);
  }
  for (let x = 54; x < 108; x += 14) { pq(x, A, -52, 0.5, 3); pq(x, B, -107, 0.5, 3); }
  // fins on the avenue face above the ramp (vertical concrete blades)
  prop.set({ col: hex(0x7e7c76), rm: [0.85, 0, 0] });
  for (let x = R1.x0 + 1; x < x1; x += 1.4) { const ya = Math.min(A, R1.y0 + (R1.y1 - R1.y0) * (x - R1.x0) / (R1.x1 - R1.x0)); prop.box(x - 0.08, ya + 1.3, z1 - 0.3, x + 0.08, A + 1.1, z1); }
  // ---- LED masts on the decks (cold white pools), the roof P sign, the corner billboard
  const mast = (x, z, y) => {
    prop.set({ col: hex(0x6a6c70), rm: [0.5, 0.6, 0] }); prop.cyl(x, y, z, 0.1, 0.08, y + 7.5, 8, { cap: false });
    prop.set({ col: hex(0x3a3c40), rm: [0.5, 0.6, 0] }); prop.box(x - 0.6, y + 7.4, z - 0.25, x + 0.6, y + 7.65, z + 0.25);
    prop.set({ col: [1, 1, 1], rm: [0.3, 0, 3] }); prop.box(x - 0.55, y + 7.38, z - 0.2, x + 0.55, y + 7.4, z + 0.2, { faces: 'y' });
    glows.push({ p: [x, y + 7.3, z], color: [2.2, 2.3, 2.5], size: 1.3 });
    lights.push({ x, z, r: 11, color: [0.95, 1.0, 1.1], k: 0.75 });
    colliders.push({ min: [x - 0.14, y, z - 0.14], max: [x + 0.14, y + 7.5, z + 0.14], data: { mat: 'metal', kind: 'pole', thin: true } });
  };
  for (const x of [58, 82, 104]) { mast(x, -50, A); mast(x, -107, B); }
  // P sign on the roof (blue, both sides)
  const P = pSign();
  prop.set({ col: hex(0x3a3c40), rm: [0.5, 0.6, 0] });
  for (const x of [x1 - 9, x1 - 3]) prop.box(x - 0.12, B, -96.12, x + 0.12, B + 9, -95.88);
  P.position.set(x1 - 6, B + 7, -95.8); root.add(P); const P2 = P.clone(); P2.rotation.y = Math.PI; P2.position.z = -96.2; root.add(P2);
  glows.push({ p: [x1 - 6, B + 7, -95], color: [0.4, 0.8, 2.4], size: 6, far: true });
  // ---- deck B: a big billboard on its north edge facing the expressway, a vending corner by the stair core
  {
    const e = SE.panel.find(p => p.kind === 'race') || SE.panel[0];
    const w = 12, hh = 4, cx = 64, y0 = B + 2.2, z = DECK_B.z0 + 0.6;
    prop.set({ col: hex(0x34363a), rm: [0.6, 0.6, 0] });
    for (const dx of [-5, 0, 5]) { prop.box(cx + dx - 0.12, B, z - 0.12, cx + dx + 0.12, y0 + hh, z + 0.12); prop.tube([cx + dx, B, z + 1.6], [cx + dx, y0 + hh * 0.6, z + 0.1], 0.06, 5); }
    prop.set({ col: hex(0x1c1d20), rm: [0.6, 0.4, 0] }); prop.box(cx - w / 2, y0 - 0.1, z - 0.12, cx + w / 2, y0 + hh + 0.1, z + 0.12);
    signQuad(sign, [cx, y0 + hh / 2, z - 0.13], [0, 0, -1], w, hh, e.uv, 1.0);
    signQuad(sign, [cx, y0 + hh / 2, z + 0.13], [0, 0, 1], w, hh, (SE.panel.find(p => p.kind === 'air') || e).uv, 1.0);
    halo.set({}); signQuad(halo, [cx, y0 + hh / 2, z + 0.2], [0, 0, 1], w * 1.2, hh * 1.6, [0, 0, 1, 1], [0.12, 0.12, 0.11]);
    for (const dx of [-4, 4]) glows.push({ p: [cx + dx, y0 - 0.3, z + 1.2], color: [2.2, 2.0, 1.7], size: 0.6, far: true });
    colliders.push({ min: [cx - w / 2, B, z - 0.15], max: [cx + w / 2, y0 + hh, z + 0.15], data: { mat: 'metal', kind: 'billboard', noBlock: true } });
    for (const dx of [-5, 0, 5]) colliders.push({ min: [cx + dx - 0.15, B, z - 0.15], max: [cx + dx + 0.15, y0 + hh, z + 0.15], data: { mat: 'metal', kind: 'pole', thin: true } });
    // vending corner (two machines against the stair core) + a pool of white light
    prop.set({ col: hex(0x8a8882), rm: [0.85, 0, 0] }); prop.box(104, B, -100, 111.6, B + 3.2, -94);
    colliders.push({ min: [104, B, -100], max: [111.6, B + 3.2, -94], data: { mat: 'concrete', kind: 'core' } });
    for (const [i, zz] of [[0, -98.6], [1, -97.5]]) { const v = SE.vend[(i * 3 + 2) % SE.vend.length]; prop.set({ col: hex(0xd8d6d0), rm: [0.4, 0.3, 0] }); prop.box(102.9, B, zz - 0.5, 104, B + 1.9, zz + 0.5); signQuad(sign, [102.89, B + 0.95, zz], [-1, 0, 0], 0.98, 1.84, v.uv, 1.25); colliders.push({ min: [102.9, B, zz - 0.5], max: [104, B + 1.9, zz + 0.5], data: { mat: 'metal', kind: 'vending' } }); }
    lights.push({ x: 101, z: -98, r: 4, color: [1.3, 1.35, 1.45], k: 0.9 });
  }
  // ---- the inner wall facing deck A: sodium wall packs, painted level signs, hazard stripes at the ramp foot, pipes
  for (let x = 52; x < 110; x += 11) {
    const y = A + 4.2;
    prop.set({ col: hex(0x2a2a2c), rm: [0.5, 0.5, 0] }); prop.box(x - 0.25, y - 0.15, R2.z1, x + 0.25, y + 0.15, R2.z1 + 0.3);
    prop.set({ col: [1, 0.65, 0.3], rm: [0.3, 0, 3.2] }); prop.box(x - 0.2, y - 0.16, R2.z1 + 0.05, x + 0.2, y - 0.15, R2.z1 + 0.28, { faces: 'y' });
    glows.push({ p: [x, y - 0.2, R2.z1 + 0.4], color: [2.6, 1.5, 0.5], size: 1.1 });
    lights.push({ x, z: R2.z1 + 5, r: 8, color: [1.4, 0.85, 0.4], k: 0.7 });
    prop.set({ col: hex(0x5a5c60), rm: [0.5, 0.6, 0] }); prop.tube([x + 3, A, R2.z1 + 0.12], [x + 3, B, R2.z1 + 0.12], 0.07, 6);
  }
  for (let x = R2.x1 - 6; x < x1; x += 0.8) { prop.set({ col: hex(Math.round((x - R2.x1) / 0.8) % 2 ? 0x161616 : 0xd8b21a), rm: [0.6, 0, 0.05] }); prop.box(x, A, R2.z1 + 0.36, x + 0.8, A + 1.0, R2.z1 + 0.38, { faces: 'Z' }); }
  { const lvl = levelSigns(); lvl.position.set(78, A + 2.6, R2.z1 + 0.37); root.add(lvl); }
  // ---- meshes
  root.add(fac.mesh(facadeMaterial()));
  const dm = new THREE.MeshStandardMaterial({ map: deckTex(), vertexColors: true, color: 0xe8e4dc, roughness: 0.82 });
  const md = deck.mesh(dm); md.receiveShadow = true; root.add(md);
  const pm = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  root.add(paint.mesh(pm));
  root.add(prop.mesh(rmMat({}), { shadow: true }));
  if (sign.vn) root.add(sign.mesh(signMaterial()));
  if (halo.vn) root.add(halo.mesh(haloMaterial()));
  dm.userData.noAO = pm.userData.noAO = true;
  return { root, colliders, groundMats: [dm, pm], anchors: { glows, lights } };
}
// painted on the inner wall: the level, the way up, the exit
function levelSigns() {
  const W = 1024, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(230,226,214,0.92)'; g.font = '400 190px Anton, sans-serif'; g.textBaseline = 'middle'; g.fillText('2F', 30, 130);
  g.fillStyle = '#d8b21a'; g.beginPath(); g.moveTo(330, 60); g.lineTo(560, 60); g.lineTo(560, 20); g.lineTo(660, 110); g.lineTo(560, 200); g.lineTo(560, 160); g.lineTo(330, 160); g.closePath(); g.fill();
  g.fillStyle = 'rgba(230,226,214,0.92)'; g.font = `900 70px ${JP}`; g.fillText('3F 屋上', 700, 80);
  g.font = '400 54px Anton, sans-serif'; g.fillText('ROOF / EXIT', 700, 170);
  const t = canvasTex(c, { repeat: false, aniso: 4 });
  return new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}
function pSign() {
  const W = 256, H = 320, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#123f8c'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f2f2f2'; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = '#ffffff'; g.font = '400 210px Anton, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', W / 2, 130);
  g.font = `900 34px ${JP}`; g.fillText('黒金パーキング', W / 2, 260);
  g.fillStyle = '#e83a2a'; g.font = `900 30px ${JP}`; g.fillText('満', W - 36, 40);
  const t = canvasTex(c, { repeat: false, aniso: 4 });
  return new THREE.Mesh(new THREE.PlaneGeometry(4.6, 5.75), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.5, 1.5) }));
}
