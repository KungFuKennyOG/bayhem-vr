import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, em, mul3, hexc, GOLD, COOLW, DIST, DUSK, signQuad, hipRoof } from './kit.js';
import { materials } from './mats.js';
import { SIGN } from './signs.js';
import { lantern } from './kitbuild.js';
import { TOWER, LOBBY, TERRACE, FOOTB, LOCKER, QUAY } from './layout.js';

// =====================================================================================
//  JINLONG TOWER — 236 m of gold-tinted glass and lit fins on the river shelf, its 13th floor level
//  with the cliff top: the footbridge from Sky Street enters a double-height sky lobby (marble,
//  a gold dragon screen, the lift core), and the lobby opens south onto a sky-garden terrace cut
//  into the river face — the jump.
//  Built in three parts so it can fall: the STUMP (shelf to y 50, stays), the BODY (50..160) and the
//  CROWN section (160..top, a child of the body hinged at its base, so it can lag and fold).
//  The tower's lights are district TOWER: the blackout takes them floor by floor (POWER.cut).
// =====================================================================================
export const HINGE = new THREE.Vector3(TOWER.x1, 50, (TOWER.z0 + TOWER.z1) / 2);   // the body pivots on its east edge (falls east, downstream)
export const CROWN_Y = 160;
const GLASS = hexc(0x5a4420), FIN = hexc(0x9a6a1c);
const GOLDF = [1.0, 0.42, 0.06];   // the fins' LED: a deep, saturated gold (bright gold tonemaps to cream)

function shaft(B, reg, x0, z0, x1, z1, ya, yb, wy0, code, seed, { notch = null, door = null } = {}) {
  const A = B.get('win', reg), L = B.get('plain', reg);
  A.set({ col: GLASS, rm: [0.22, 0.6, 0], em: em(GOLDF, 0.07, code), cell: [1.5, TOWER.floorH, seed, 1] });   // gold-tinted glass with a warm spandrel glow
  if (notch && ya < notch.y1 && yb > notch.y0) {
    // the river face has the sky-garden notch cut into it between notch.y0..y1
    if (ya < notch.y0) A.box(x0, ya, z0, x1, notch.y0, z1, { faces: 'Z', s: 1, wy0 });
    if (yb > notch.y1) A.box(x0, notch.y1, z0, x1, yb, z1, { faces: 'Z', s: 1, wy0 });
    A.box(x0, ya, z0, x1, yb, z1, { faces: 'xX', s: 1, wy0 });
  } else A.box(x0, ya, z0, x1, yb, z1, { faces: 'xXZ', s: 1, wy0 });
  // the north face, with the footbridge doorway cut out of it
  if (door && ya < door.y1 && yb > door.y0) {
    A.box(x0, ya, z0, x1, door.y0, z1, { faces: 'z', s: 1, wy0 });
    A.box(x0, door.y0, z0, door.x0, door.y1, z1, { faces: 'z', s: 1, wy0 }); A.box(door.x1, door.y0, z0, x1, door.y1, z1, { faces: 'z', s: 1, wy0 });
    A.box(x0, door.y1, z0, x1, yb, z1, { faces: 'z', s: 1, wy0 });
  } else A.box(x0, ya, z0, x1, yb, z1, { faces: 'z', s: 1, wy0 });
  // gold fins up every face (LED-lit edges): the dragon's scales
  L.set({ col: FIN, rm: [0.35, 0.8, 0], em: em(GOLDF, 0.42, code) });
  const fin = (x, z, nx, nz, y0 = ya, y1 = yb) => L.box(x - (nz ? 0.18 : 0), y0, z - (nx ? 0.18 : 0), x + (nz ? 0.18 : 0) + nx * 0.9, y1, z + (nx ? 0.18 : 0) + nz * 0.9, { faces: 'xXzZ' });
  const cutN = notch && ya < notch.y1 && yb > notch.y0;
  for (let x = x0 + 4; x < x1 - 1; x += 6) {
    // the river face's fins stop at the sky-garden notch (it is open there)
    if (cutN) { if (ya < notch.y0) fin(x, z1, 0, 1, ya, notch.y0); if (yb > notch.y1) fin(x, z1, 0, 1, notch.y1, yb); } else fin(x, z1, 0, 1);
    if (door && x > door.x0 - 0.5 && x < door.x1 + 0.5 && ya < door.y1 && yb > door.y0) { fin(x, z0, 0, -1, ya, door.y0); fin(x, z0, 0, -1, door.y1, yb); } else fin(x, z0, 0, -1);
  }
  for (let z = z0 + 4; z < z1 - 1; z += 6) { fin(x1, z, 1, 0); fin(x0, z, -1, 0); }
  // corner LED strips (brighter)
  L.set({ col: [0.2, 0.2, 0.2], em: em(GOLDF, 0.9, code) });
  for (const [x, z] of [[x0 - 0.3, z0 - 0.3], [x1, z0 - 0.3], [x0 - 0.3, z1], [x1, z1]]) L.box(x, ya, z, x + 0.3, yb, z + 0.3, { faces: 'xXzZ' });
}

export function buildTower(ctx = {}) {
  const M = materials();
  const root = new THREE.Group(); root.name = 'jinlong';
  const glows = [], lights = [], colliders = [], panes = [];
  const r = makeRng(8808);
  const T = TOWER, code = DIST.TOWER;
  const notch = { y0: LOBBY.y, y1: LOBBY.y + 8.4 };
  const mk = () => { const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m); return B; };
  // ---------------------------------------------------------------- the stump (stays)
  const Bs = mk();
  {
    const C = Bs.get('concrete', 'ts'); C.set({ col: [0.5, 0.5, 0.48], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
    C.box(T.x0 - 6, QUAY.y - 3, T.z0 - 4, T.x1 + 6, QUAY.y + 0.6, T.z1 + 2, { faces: 'xXzZY', s: 1 });
    shaft(Bs, 'ts', T.x0, T.z0, T.x1, T.z1, QUAY.y + 0.6, 50, T.base, code, 3);
    // the base podium on the shelf: a lit entrance hall onto the quay road
    const P = Bs.get('plain', 'ts'); P.set({ col: [0.9, 0.85, 0.7], rm: [0.5, 0, 0], em: em([1.0, 0.8, 0.55], 1.0, code) });
    P.box(T.x0 + 4, QUAY.y + 0.6, T.z1 + 0.1, T.x1 - 4, QUAY.y + 7, T.z1 + 0.2, { faces: 'Z' });
    glows.push({ p: [(T.x0 + T.x1) / 2, QUAY.y + 4, T.z1 + 2], color: [1.4, 1.0, 0.6], size: 14, code, far: true });
  }
  Bs.finish(root);
  // ---------------------------------------------------------------- the body (50..160) — pivots on HINGE
  const body = new THREE.Group(); body.name = 'jinlong-body'; body.position.copy(HINGE); root.add(body);
  const Bb = mk();
  {
    // geometry is written in world coords then shifted into the hinge frame
    const Sh = new THREE.Matrix4().makeTranslation(-HINGE.x, -HINGE.y, -HINGE.z);
    for (const k of ['win', 'plain', 'stone', 'plaster', 'metal', 'concrete', 'sign', 'wood', 'dbl']) Bb.get(k, 'tb').M = Sh.clone();
    shaft(Bb, 'tb', T.x0, T.z0, T.x1, T.z1, 50, CROWN_Y, T.base, code, 3, { notch, door: { x0: FOOTB.x0, x1: FOOTB.x1, y0: LOBBY.y, y1: LOBBY.y + 3.7 } });
    // ---- the sky lobby (y 56 .. 64.4): marble, columns, the dragon screen, the lift core, reception
    const St = Bb.get('stone', 'tb'), P = Bb.get('plain', 'tb'), Mt = Bb.get('metal', 'tb'), Sg = Bb.get('sign', 'tb');
    const L = LOBBY, yT = notch.y1;
    // polished cream marble (the tile texture's joints at 1.6 m) with a gold inlay border round the lobby
    St.set({ col: [0.34, 0.31, 0.27], rm: [0.1, 0.15, 0], em: [0, 0, 0, 0] });   // dark polished marble: the gold and the lights reflect in it
    St.box(T.x0, L.y - 0.6, T.z0, T.x1, L.y, TERRACE.z0, { faces: 'Y', s: 1 });
    St.set({ col: [0.55, 0.52, 0.48], rm: [0.5, 0, 0] }); St.box(T.x0, L.y - 0.6, TERRACE.z0, T.x1, L.y, TERRACE.z1, { faces: 'Y', s: 1 });
    Mt.set({ col: hexc(0x8a6a30), rm: [0.25, 0.95, 0], em: em(GOLDF, 0.03, code) });
    for (const [a1, b1, c1, d1] of [[L.x0 + 2, 129, L.x1 - 2, 129.25], [L.x0 + 2, 148.5, L.x1 - 2, 148.75], [L.x0 + 2, 129, L.x0 + 2.25, 148.75], [L.x1 - 2.25, 129, L.x1 - 2, 148.75]]) Mt.box(a1, L.y, b1, c1, L.y + 0.01, d1, { faces: 'Y' });
    P.set({ col: [0.42, 0.36, 0.3], rm: [0.6, 0, 0] });
    P.room(T.x0 + 0.5, L.y, T.z0 + 0.5, T.x1 - 0.5, yT, TERRACE.z0, { faces: 'xXY' });
    // the north wall inside, around the footbridge doorway
    P.room(331, L.y, T.z0 + 0.5, FOOTB.x0, yT, TERRACE.z0, { faces: 'z' }); P.room(FOOTB.x1, L.y, T.z0 + 0.5, 349, yT, TERRACE.z0, { faces: 'z' });
    P.room(FOOTB.x0, L.y + 3.7, T.z0 + 0.5, FOOTB.x1, yT, TERRACE.z0, { faces: 'z' });
    // a coffered ceiling: dark lacquer, gold-framed coffers, a warm downlight in each
    P.set({ col: [0.06, 0.05, 0.045], rm: [0.4, 0.2, 0], em: [0, 0, 0, 0] }); P.box(T.x0 + 0.5, yT - 0.02, T.z0 + 0.5, T.x1 - 0.5, yT, TERRACE.z0, { faces: 'y' });
    for (let x = L.x0 + 3; x < L.x1 - 2; x += 6) for (let z = L.z0 + 3; z < L.z1 - 2; z += 6) {
      Mt.set({ col: hexc(0x9a7838), rm: [0.3, 0.9, 0], em: em(GOLDF, 0.18, code) });
      Mt.box(x - 0.2, yT - 0.5, z - 0.2, x + 2.6, yT - 0.02, z, { faces: 'yzZ' }); Mt.box(x - 0.2, yT - 0.5, z + 2.4, x + 2.6, yT - 0.02, z + 2.6, { faces: 'yzZ' });
      Mt.box(x - 0.2, yT - 0.5, z, x, yT - 0.02, z + 2.4, { faces: 'yxX' }); Mt.box(x + 2.4, yT - 0.5, z, x + 2.6, yT - 0.02, z + 2.4, { faces: 'yxX' });
      P.set({ col: [1, 1, 1], em: em([1.0, 0.86, 0.66], 1.8, code) }); P.cyl(x + 1.2, yT - 0.06, z + 1.2, 0.35, 0.35, yT - 0.03, 10);
    }
    // two lift cores either side of the footbridge door (brass doors on their inner faces), the 金龙 bulkhead
    // hanging over the reception desk, facing you as you come in off the bridge
    P.set({ col: [0.16, 0.12, 0.08], rm: [0.3, 0.3, 0] });
    for (const [xa, xb] of [[T.x0 + 0.5, 331], [349, T.x1 - 0.5]]) { P.box(xa, L.y, T.z0 + 0.5, xb, yT, 128, { faces: 'xXZ' }); colliders.push({ min: [xa, L.y, T.z0], max: [xb, yT, 128], data: { mat: 'concrete', kind: 'wall' } }); }
    Mt.set({ col: hexc(0xb08d4a), rm: [0.3, 0.9, 0] });
    for (const z of [121.5, 125]) { Mt.box(330.9, L.y, z, 331.05, L.y + 3, z + 2.4, { faces: 'X' }); Mt.box(348.95, L.y, z, 349.1, L.y + 3, z + 2.4, { faces: 'x' }); }
    P.set({ col: [0.14, 0.12, 0.1], rm: [0.5, 0.2, 0] }); P.box(333, L.y + 3.6, 133.6, 347, yT, 134.2, { faces: 'zZy' });
    // a gold cove light along the top of both cores, and a pool of light under every ceiling panel (baked)
    P.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em(GOLDF, 1.1, code) });
    P.box(330.95, yT - 0.5, T.z0 + 0.6, 331.1, yT - 0.35, 128, { faces: 'X' }); P.box(348.9, yT - 0.5, T.z0 + 0.6, 349.05, yT - 0.35, 128, { faces: 'x' });
    P.box(T.x0 + 0.6, yT - 0.5, 127.95, 331, yT - 0.35, 128.1, { faces: 'Z' }); P.box(349, yT - 0.5, 127.95, T.x1 - 0.6, yT - 0.35, 128.1, { faces: 'Z' });
    for (let x = L.x0 + 3; x < L.x1 - 2; x += 6) for (let z = L.z0 + 3; z < L.z1 - 2; z += 6) lights.push({ p: [x + 1.2, yT - 0.3, z + 1.2], color: [1.0, 0.82, 0.58], r: 4.5, k: 0.55, grp: 3 });
    Sg.set({ col: [1, 1, 1], rm: [0.4, 0.3, 0], em: em([1, 1, 1], 1.6, code) }); signQuad(Sg, [340, L.y + 5.5, 133.55], [0, 0, -1], 12, 3.4, SIGN.jinlong);
    // reception desk, sofas, planters, columns (cover for the lobby fight)
    P.set({ col: [0.2, 0.11, 0.06], rm: [0.35, 0.1, 0] }); P.box(330, L.y, 133, 350, L.y + 1.05, 135, { faces: 'xXzZ' });
    P.set({ col: [0.95, 0.9, 0.82], rm: [0.15, 0.1, 0] }); P.box(329.8, L.y + 1.05, 132.8, 350.2, L.y + 1.15, 135.2, { faces: 'xXzZY' });
    Mt.set({ col: hexc(0xc89a40), rm: [0.25, 0.95, 0], em: em(GOLDF, 0.25, code) }); Mt.box(330, L.y + 0.75, 132.97, 350, L.y + 0.85, 133, { faces: 'z' });
    colliders.push({ min: [330, L.y, 133], max: [350, L.y + 1.15, 135], data: { mat: 'wood', kind: 'desk' } });
    P.set({ col: [0.2, 0.18, 0.16], rm: [0.8, 0, 0] });
    for (const [x, z] of [[327, 141], [353, 141], [327, 146], [353, 146]]) { P.box(x - 1.6, L.y, z - 0.6, x + 1.6, L.y + 0.8, z + 0.6, { faces: 'xXzZY' }); colliders.push({ min: [x - 1.6, L.y, z - 0.6], max: [x + 1.6, L.y + 0.8, z + 0.6], data: { mat: 'wood', kind: 'sofa' } }); }
    // black lacquer columns with gold bands at the foot, the capital and a third of the way up
    for (const x of [329, 340, 351]) for (const z of [139, 148]) {
      P.set({ col: [0.035, 0.03, 0.028], rm: [0.22, 0.2, 0], em: [0, 0, 0, 0] }); P.cyl(x, L.y, z, 0.7, 0.7, yT, 16, { cap: false });
      Mt.set({ col: hexc(0xa8823a), rm: [0.28, 0.95, 0], em: em(GOLDF, 0.06, code) }); for (const [ya, yb] of [[L.y, L.y + 0.35], [L.y + 2.6, L.y + 2.75], [yT - 0.6, yT]]) Mt.cyl(x, ya, z, 0.74, 0.74, yb, 16, { cap: false }); colliders.push({ min: [x - 0.7, L.y, z - 0.7], max: [x + 0.7, yT, z + 0.7], data: { mat: 'stone', kind: 'pillar' } }); }
    for (const x of [324.5, 355.5]) { P.set({ col: [0.13, 0.22, 0.1], rm: [0.9, 0, 0] }); P.cyl(x, L.y, 130, 0.8, 0.6, L.y + 1.8, 8); }
    // the glass wall between the lobby and the terrace (sliding doors in the middle, open)
    for (let x = T.x0 + 1; x < T.x1 - 1; x += 3.4) { if (x > 336 && x < 344) continue; panes.push({ c: [x + 1.6, L.y + 1.8, TERRACE.z0], n: [0, 0, 1], w: 3.2, h: 3.5, kind: 'lobby', hinged: 'tower' }); }
    // ---- the terrace (the sky garden): planters, a glass balustrade with the gap, the BASE locker, lanterns
    St.set({ col: [0.55, 0.52, 0.48], rm: [0.5, 0, 0] });
    St.box(TERRACE.x0, L.y - 0.6, TERRACE.z0, TERRACE.x1, L.y + 0.02, TERRACE.z1, { faces: 'Y', s: 1 });
    Mt.set({ col: [0.6, 0.62, 0.65], rm: [0.3, 0.9, 0] });
    for (const [x0, x1] of [[TERRACE.x0, TERRACE.gap[0]], [TERRACE.gap[1], TERRACE.x1]]) {
      Mt.box(x0, L.y + 1.05, TERRACE.z1 - 0.12, x1, L.y + 1.15, TERRACE.z1, { faces: 'zZYy' });
      panes.push({ c: [(x0 + x1) / 2, L.y + 0.55, TERRACE.z1 - 0.06], n: [0, 0, 1], w: x1 - x0, h: 1.0, kind: 'lobby', hinged: 'tower' });
      colliders.push({ min: [x0, L.y, TERRACE.z1 - 0.2], max: [x1, L.y + 1.15, TERRACE.z1], data: { mat: 'metal', kind: 'rail' } });
    }
    // the gap: a maintenance gate hanging open, hazard stripes on the deck edge
    Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 0.12, code) });
    Sg.quad([TERRACE.gap[0], L.y + 0.03, TERRACE.z1 - 0.9], [TERRACE.gap[1], L.y + 0.03, TERRACE.z1 - 0.9], [TERRACE.gap[1], L.y + 0.03, TERRACE.z1 - 1.8], [TERRACE.gap[0], L.y + 0.03, TERRACE.z1 - 1.8], SIGN.stripe);
    Mt.set({ col: [0.75, 0.6, 0.15], rm: [0.4, 0.6, 0] }); Mt.box(TERRACE.gap[0] - 0.05, L.y, TERRACE.z1 - 1.4, TERRACE.gap[0] + 0.05, L.y + 1.1, TERRACE.z1, { faces: 'xXzZ' });
    const Pl = Bb.get('plain', 'tb');
    for (const x of [326, 331, 349, 354]) { Pl.set({ col: [0.35, 0.33, 0.3], rm: [0.7, 0, 0] }); Pl.box(x - 1.4, L.y, 152, x + 1.4, L.y + 0.9, 154.6, { faces: 'xXzZY' }); Pl.set({ col: [0.12, 0.2, 0.09] }); Pl.cyl(x, L.y + 0.9, 153.3, 1.0, 0.7, L.y + 2.2, 7); colliders.push({ min: [x - 1.4, L.y, 152], max: [x + 1.4, L.y + 0.9, 154.6], data: { mat: 'stone', kind: 'planter' } }); }
    // the dead guard's kit: a steel locker standing open, the rig hanging in it (setpieces moves the rig to you)
    Mt.set({ col: [0.3, 0.34, 0.3], rm: [0.5, 0.5, 0] });
    Mt.box(LOCKER.x - 0.6, L.y, LOCKER.z - 0.35, LOCKER.x + 0.6, L.y + 2.0, LOCKER.z + 0.35, { faces: 'xXzZY' });
    colliders.push({ min: [LOCKER.x - 0.6, L.y, LOCKER.z - 0.35], max: [LOCKER.x + 0.6, L.y + 2.0, LOCKER.z + 0.35], data: { mat: 'metal', kind: 'locker' } });
    for (const x of [330, 340, 350]) lantern(Bb, 'tb', x, notch.y1 - 1.0, TERRACE.z1 - 2.6, 1.1, code, glows);
    lights.push({ p: [340, L.y + 5, 140], color: [1.0, 0.86, 0.66], r: 16, k: 1.8, grp: 3 }, { p: [340, L.y + 6, 154], color: [1.0, 0.5, 0.25], r: 12, k: 1.2, grp: 3 });
    // the soffit over the notch and the notch's side walls
    P.set({ col: [0.3, 0.28, 0.26], rm: [0.6, 0, 0] }); P.box(T.x0, yT - 0.4, TERRACE.z0, T.x1, yT, T.z1, { faces: 'y' });
    P.set({ col: [1, 1, 1], em: em([1.0, 0.8, 0.55], 2.0, code) }); for (let x = T.x0 + 3; x < T.x1 - 2; x += 5) P.box(x, yT - 0.45, 155, x + 3, yT - 0.4, 155.5, { faces: 'y' });
    // the footbridge's doorway
    // the doorway: a brass frame, the sliding doors parked open either side
    Mt.set({ col: hexc(0xb08d4a), rm: [0.3, 0.9, 0], em: [0, 0, 0, 0] });
    Mt.box(FOOTB.x0 - 0.3, L.y, T.z0 - 0.15, FOOTB.x0, L.y + 3.7, T.z0 + 0.6); Mt.box(FOOTB.x1, L.y, T.z0 - 0.15, FOOTB.x1 + 0.3, L.y + 3.7, T.z0 + 0.6);
    Mt.box(FOOTB.x0 - 0.3, L.y + 3.4, T.z0 - 0.15, FOOTB.x1 + 0.3, L.y + 3.7, T.z0 + 0.6);
    P.set({ col: [0.9, 0.95, 1.0], em: em(COOLW, 0.35, code) }); P.box(FOOTB.x0 + 0.4, L.y + 3.38, T.z0 + 0.05, FOOTB.x1 - 0.4, L.y + 3.4, T.z0 + 0.45, { faces: 'y' });
    // lobby walls as colliders (the room's sides / the back except the footbridge door)
    colliders.push({ min: [T.x0, L.y, T.z0], max: [T.x0 + 0.6, yT, TERRACE.z1] , data: { mat: 'glass', kind: 'wall' } });
    colliders.push({ min: [T.x1 - 0.6, L.y, T.z0], max: [T.x1, yT, TERRACE.z1], data: { mat: 'glass', kind: 'wall' } });
    colliders.push({ min: [T.x0, L.y, T.z0], max: [FOOTB.x0, yT, T.z0 + 0.6], data: { mat: 'glass', kind: 'wall' } });
    colliders.push({ min: [FOOTB.x1, L.y, T.z0], max: [T.x1, yT, T.z0 + 0.6], data: { mat: 'glass', kind: 'wall' } });
  }
  Bb.finish(body, { shadowKeys: ['plain'] });
  // ---------------------------------------------------------------- the crown section (160..top): child of the body, hinged at its own base (east edge)
  const crownHinge = new THREE.Vector3(T.x1, CROWN_Y, (T.z0 + T.z1) / 2);
  const crown = new THREE.Group(); crown.name = 'jinlong-crown'; crown.position.copy(crownHinge).sub(HINGE); body.add(crown);
  const Bc = mk();
  {
    const Sh = new THREE.Matrix4().makeTranslation(-crownHinge.x, -crownHinge.y, -crownHinge.z);
    for (const k of ['win', 'plain', 'metal', 'concrete', 'sign', 'roof']) Bc.get(k, 'tc').M = Sh.clone();
    shaft(Bc, 'tc', T.x0, T.z0, T.x1, T.z1, CROWN_Y, 200, T.base, code, 3);
    shaft(Bc, 'tc', T.x0 + 4, T.z0 + 4, T.x1 - 4, T.z1 - 4, 200, T.base + T.h, T.base, code, 4);
    // the crown: a gold lantern cage with the tower's name and a spire with the red light
    const L = Bc.get('plain', 'tc'), top = T.base + T.h, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
    L.set({ col: FIN, rm: [0.35, 0.8, 0], em: em(GOLDF, 0.75, code) });
    for (let i = 0; i < 4; i++) { const y = top + 2 + i * 4; L.box(T.x0 + 4, y, T.z0 + 4, T.x1 - 4, y + 0.5, T.z0 + 4.5); L.box(T.x0 + 4, y, T.z1 - 4.5, T.x1 - 4, y + 0.5, T.z1 - 4); L.box(T.x0 + 4, y, T.z0 + 4, T.x0 + 4.5, y + 0.5, T.z1 - 4); L.box(T.x1 - 4.5, y, T.z0 + 4, T.x1 - 4, y + 0.5, T.z1 - 4); }
    for (const [x, z] of [[T.x0 + 4, T.z0 + 4], [T.x1 - 4.5, T.z0 + 4], [T.x0 + 4, T.z1 - 4.5], [T.x1 - 4.5, T.z1 - 4.5]]) L.box(x, top, z, x + 0.5, top + 16, z + 0.5);
    const Mt = Bc.get('metal', 'tc'); Mt.set({ col: [0.3, 0.3, 0.32], rm: [0.4, 0.8, 0] }); Mt.cyl(cx, top + 16, cz, 1.2, 0.12, top + 46, 8, { cap: false });
    const Sg = Bc.get('sign', 'tc'); Sg.set({ col: [1, 1, 1], rm: [0.4, 0.3, 0], em: em([1, 1, 1], 2.4, code) });
    signQuad(Sg, [cx, top + 9, T.z1 - 3.9], [0, 0, 1], 22, 11, SIGN.jinlong); signQuad(Sg, [cx, top + 9, T.z0 + 3.9], [0, 0, -1], 22, 11, SIGN.jinlong);
  }
  Bc.finish(crown);
  // the crown's halo + the red light: these ride the rig (setpieces updates their positions)
  const top = T.base + T.h, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
  const riding = [
    { local: new THREE.Vector3(cx, top + 9, cz), p: new THREE.Vector3(cx, top + 9, cz), color: [1.0, 0.6, 0.2], size: 11, code, far: true, crown: true },
    { local: new THREE.Vector3(cx, top + 47, cz), p: new THREE.Vector3(cx, top + 47, cz), color: [3, 0.2, 0.1], size: 5, blink: true, rate: 1.4, code: DUSK + code, far: true, crown: true },
    
  ];
  for (const g of riding) { g.prio = 1; glows.push(g); }
  return { root, anchors: { glows, lights, named: { tower: { root, body, crown, crownHinge, riding } } }, colliders, panes, tris: 0 };
}
