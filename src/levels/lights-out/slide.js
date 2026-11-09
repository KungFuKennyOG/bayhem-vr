import * as THREE from 'three';
import { makeRng, rand, range } from '../../rng.js';
import { CELL } from '../../particles.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Buckets, em, mul3, hexc, GOLD, DIST, DUSK, SODIUM, signQuad, hipRoof, POWER } from './kit.js';
import { materials } from './mats.js';
import { SIGN, SIGN_LIST } from './signs.js';
import { lampPost, lantern, shopRow, Frame, frontM, tree } from './kitbuild.js';
import { towerBlock } from './city.js';
import { gridFace, fbm, eastP, rockCol, rockEm } from './terrain.js';
import { SLIDE, scarY0, QUAY, RIVER, PLAZA, WATER_Y } from './layout.js';

// =====================================================================================
//  THE LANDSLIDE — the riverside block east of Jinlong (Binjiang Road's terrace, the cliff face with
//  its hanging houses, the quay below) stands on a wedge of rock that lets go when the tower shears.
//  Four pieces (SLIDE.cuts), each its own group pivoting about its middle; the towers on them are
//  child groups pivoting on their river-side base edge, so they topple off the moving ground.
//  Behind them: the scar (static, hidden inside the rock until the pieces leave) — a raw head scarp
//  of broken earth and strata curving out under the river, side scarps where the bank broke clean.
//  Everything is on Jinlong's generators (district TOWER): lit on the climb (below y 70), full
//  and flickering while it goes, dark when the tower hits.
// =====================================================================================
const CODE = DIST.TOWER;
const C0 = SLIDE.crack, ZF = RIVER.z0 + 1.2;    // the back crack, the river wall's face
// the slip surface: the head scarp + its slope out under the river, gullied and stepped (strata ledges)
export const scarY = (x, z) => {
  const e = Math.min(1, (z - C0) / 6), b = scarY0(z);
  const gully = (fbm(x * 0.045 + 3, z * 0.03) - 0.5) * 9, ledge = Math.sin(b * 0.62 + fbm(x * 0.03, z * 0.05) * 5) * 1.4;
  return b + (gully + ledge + (fbm(x * 0.2, z * 0.2) - 0.5) * 1.6) * e;
};

// the pieces are skinned: every piece / toppling tower is a bone, its geometry (built in world space) is weighted 1 to it,
// and each material is ONE SkinnedMesh across all of them (a dozen draw calls for the whole landslide, not 70)
const mkB = (mats) => { const B = new Buckets(); for (const [k, m] of Object.entries(mats)) B.mat(k, m); return B; };
function collect(B, bone, out) {
  const tmp = new THREE.Group(); const { tris } = B.finish(tmp);
  for (const m of tmp.children) {
    const g = m.geometry, n = g.attributes.position.count;
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, k) => k % 4 ? 0 : bone), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, k) => k % 4 ? 0 : 1), 4));
    (out[m.material.userData.key] ||= { mat: m.material, geos: [] }).geos.push(g);
  }
  return tris;
}
// the top outline of the bank at x, back (the crack) to front (the river wall's foot): [y, z] points
function outline(x) {
  const T = [[56, C0], [56, PLAZA.z1 - 0.2]];
  for (let k = 14; k >= 0; k--) { const p = eastP(x, k / 14); T.push([p[1], p[2]]); }
  T.push([QUAY.y, QUAY.z0], [QUAY.y, RIVER.z0], [QUAY.y + 0.05, ZF], [WATER_Y - 3, ZF]);
  return T;
}
// a side face at x between the outline and the scar under it (dir: +1 faces +x, -1 faces -x)
function sideFace(A, x, dir, jag = 0) {
  const T = outline(x), n = T.length - 1;
  const at = (u) => { const f = Math.min(n - 1e-6, Math.max(0, u * n)), i = Math.floor(f), t = f - i; return [T[i][0] + (T[i + 1][0] - T[i][0]) * t, T[i][1] + (T[i + 1][1] - T[i][1]) * t]; };
  // jag: the static scarps break rough — pushed out into the void (toward -dir) by up to jag metres below the top edge
  gridFace(A, (u, v) => {
    const [ty, tz] = at(dir > 0 ? 1 - u : u);
    const k = jag ? (1 - v) * (0.35 + fbm(tz * 0.08 + x, ty * 0.09) * 1.3) * Math.min(1, (tz - C0) / 8) : 0, xx = x - dir * jag * k;
    const by = Math.min(ty - 0.2, scarY(xx, tz));
    return [xx, by + (ty - by) * v + Math.sin(tz * 0.7 + x) * 0.6 * k, tz];
  }, n * 2, jag ? 6 : 1, jag ? { colFn: earthCol } : {});
}
// broken earth: ochre clay and grey strata bands, darker and wet low down
const earthCol = (p) => {
  const k = 0.8 + fbm(p[0] * 0.07, p[2] * 0.09 + p[1] * 0.05) * 0.4;
  const band = Math.sin(p[1] * 0.75 + fbm(p[0] * 0.02, p[1] * 0.04) * 4) > 0.55;
  const wet = p[1] < 8 ? 0.55 : p[1] < 16 ? 0.75 : 1;
  const c = band ? [0.42, 0.4, 0.37] : [0.46, 0.33, 0.21];
  return [c[0] * k * wet, c[1] * k * wet, c[2] * k * wet];
};

// the pieces: x range, what stands on them, how they go
const PIECES = [
  { delay: 5.4, acc: 4.6, pitch: 0.55, yaw: 0.06, roll: -0.1,
    towers: [{ x0: 378, z0: 60, x1: 398, z1: 80, h: 108, style: 0, crown: 'frame', roofSign: 'roof1', phi: 0.5, d: 0.6, roll: -0.12 }],
    shops: { storeys: 4, seed: 401 }, houses: [[381, 30, 5.5], [386, 14, 6], [420, 38, 4.5]], quay: [{ x0: 396, x1: 414, h: 70, style: 2 }] },
  { delay: 3.6, acc: 4.2, pitch: 0.48, yaw: -0.05, roll: 0.08,
    towers: [{ x0: 434, z0: 56, x1: 458, z1: 78, h: 158, style: 1, crown: 'led', bands: 4, bandCol: GOLD, ledCol: GOLD, roofSign: 'roof5', phi: 0.55, d: 0.2, roll: 0.1 }],
    low: [{ x0: 462, z0: 78, x1: 476, z1: 91, h: 62, style: 4, crown: 'pagoda', flood: GOLD }],
    shops: { storeys: 3, seed: 411 }, houses: [[436, 24, 6], [440, 40, 5], [475, 30, 5]], quay: [{ x0: 448, x1: 470, h: 88, style: 0, roofSign: 'roof9' }] },
  { delay: 1.8, acc: 5.0, pitch: 0.6, yaw: 0.08, roll: -0.06,
    towers: [{ x0: 484, z0: 58, x1: 502, z1: 76, h: 96, style: 0, crown: 'frame', roofSign: 'roof6', phi: 0.5, d: 0.3, roll: 0.2 },
      { x0: 512, z0: 64, x1: 530, z1: 82, h: 100, style: 0, crown: 'frame', phi: 0.38, d: 1.1, roll: -0.24 }],
    shops: { storeys: 5, seed: 421 }, houses: [[488, 20, 5], [492, 36, 6], [526, 28, 6]], quay: [{ x0: 500, x1: 516, h: 64, style: 2 }] },
  { delay: 0.0, acc: 3.9, pitch: 0.46, yaw: -0.07, roll: 0.13,
    towers: [{ x0: 562, z0: 58, x1: 584, z1: 78, h: 122, style: 0, crown: 'diamond', ledCol: [1.0, 0.85, 0.6], phi: 0.45, d: 0.5, roll: -0.16 }],
    low: [{ x0: 540, z0: 62, x1: 556, z1: 88, h: 56, style: 2 }],
    shops: { storeys: 4, seed: 431 }, houses: [[541, 30, 5], [580, 14, 6], [586, 38, 4]], quay: [{ x0: 548, x1: 572, h: 80, style: 0 }] },
];
const WALLC = [hexc(0xd6c8b0), hexc(0xc9b9a6), hexc(0xd8d2c4), hexc(0xb9b2a5)];
const GLASSC = [hexc(0x3c4a58), hexc(0x30404c), hexc(0x4a4436)];

export function buildSlide(ctx = {}) {
  SLIDE.gone = false;
  const M = materials();
  const root = new THREE.Group(); root.name = 'landslide';
  const glows = [];
  const r = makeRng(5150);
  let seed = 900, tris = 0;
  // ---------------------------------------------------------------- the scar (static): head scarp + slip surface, the two side scarps
  {
    const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
    const A = B.get('rock', 'scar'); A.set({ rm: [0.95, 0, 0], em: [0, 0, 0, 0] });
    // lit by the fires burning in the wreckage on it (baked into the emissive, by the slope's facing): the relief reads at night
    const FIRES = [[392, 62, 1.0], [446, 118, 1.3], [468, 70, 0.9], [512, 140, 1.4], [548, 96, 1.0], [574, 64, 0.8], [420, 150, 1.2]].map(([x, z, k]) => [x, Math.max(WATER_Y + 1, scarY(x, z) + 1.5), z, k]);
    const fireEm = (p) => {
      const e = 0.8, nx = -(scarY(p[0] + e, p[2]) - scarY(p[0] - e, p[2])) / (2 * e), nz = -(scarY(p[0], p[2] + e) - scarY(p[0], p[2] - e)) / (2 * e), nl = Math.hypot(nx, 1, nz);
      let L = 0;
      for (const [fx, fy, fz, k] of FIRES) { const dx = fx - p[0], dy = fy + 3 - p[1], dz = fz - p[2], d = Math.hypot(dx, dy, dz) || 1; L += k * Math.max(0, (nx * dx + dy + nz * dz) / (nl * d)) / (1 + d * d / 450); }
      L = Math.min(0.8, L) + 0.03;
      return [0.42 * L, 0.17 * L, 0.05 * L, DUSK + DIST.ALWAYS];
    };
    gridFace(A, (u, v) => { const x = SLIDE.x0 + (SLIDE.x1 - SLIDE.x0) * u, z = SLIDE.toe - (SLIDE.toe - C0) * v; return [x, scarY(x, z), z]; }, 80, 44, { colFn: earthCol, emFn: fireEm });
    sideFace(A, SLIDE.x0, 1, 9); sideFace(A, SLIDE.x1, -1, 9);
    // broken services sticking out of the head scarp (water mains, cable ducts), the torn road edge
    const Mt = B.get('metal', 'scar'), Cc = B.get('concrete', 'scar');
    Mt.set({ col: [0.2, 0.21, 0.22], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] });
    for (let x = SLIDE.x0 + 6; x < SLIDE.x1 - 4; x += 9 + r() * 10) { const y = 54.2 - r() * 2.2, z = C0 + (56 - y) * 0.45; Mt.beam([x, y, z - 1], [x + range(-0.5, 0.5), y + range(-0.3, 0.3), z + 1.5 + r() * 2], 0.35 + r() * 0.3, 0.35 + r() * 0.3); }
    Cc.set({ col: [0.45, 0.45, 0.44], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    Cc.box(SLIDE.x0, 54.8, C0 - 0.6, SLIDE.x1, 56, C0 + 0.1, { faces: 'Z', s: 1 });
    // rubble: boulders and wreckage strewn down the slope and piled at the waterline
    const Rk = B.get('rock', 'scar'); Rk.set({ col: [0.36, 0.3, 0.24], rm: [0.95, 0, 0], em: [0, 0, 0, 0] });
    for (let k = 0; k < 70; k++) {
      const x = range(SLIDE.x0 + 4, SLIDE.x1 - 4), z = C0 + 14 + Math.pow(r(), 0.6) * (SLIDE.toe - C0 - 18), y = scarY(x, z), s = 1.2 + r() * r() * 5;
      const fe = fireEm([x, y, z]); Rk.set({ col: earthCol([x, y + 30 * r(), z]), em: [fe[0] * 0.9, fe[1] * 0.9, fe[2] * 0.9, fe[3]] });
      Rk.obox(x, y + s * 0.3, z, s * (0.8 + r() * 0.6), s * (0.5 + r() * 0.4), s * (0.7 + r() * 0.6), r() * 6.28, { faces: 'xXzZY', s: 1 });
    }
    // slabs of the road torn at the lip, hanging over the scarp; a lamp post bent over the edge
    const As = B.get('asphalt', 'scar'); As.set({ col: [0.42, 0.42, 0.43], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    for (let x = SLIDE.x0 + 5; x < SLIDE.x1 - 6; x += 7 + r() * 9) {
      const w = 4 + r() * 5, d = 3 + r() * 4, tilt = 0.3 + r() * 0.7, M = new THREE.Matrix4().makeRotationX(tilt).premultiply(new THREE.Matrix4().makeTranslation(x, 55.8, C0 + 0.2));
      for (const A of [As, Cc]) { const sv = A.push(M); if (A === As) A.box(0, -0.4, 0, w, 0, d, { faces: 'xXYz Z', s: 1 }); else A.box(0, -0.9, 0, w, -0.4, d, { faces: 'xXyzZ', s: 1 }); A.pop(sv); }
    }
    tris += B.finish(root).tris;
    // fires in the wreckage on the slope and along the torn edge: halos that come on once the pieces have gone
    for (const [x, y, z, k] of FIRES) {
      glows.push({ p: [x, y, z], color: [2.6, 1.0, 0.3], size: 9 * k, flick: true, code: DUSK + DIST.ALWAYS, far: true, dead: true, scarFire: true, prio: 1 });
    }
  }
  // ---------------------------------------------------------------- the wreckage left in the river (shown once the pieces are down):
  // rubble islands at the foot of the scar, three tower tops sticking out of the water at angles
  const wreck = new THREE.Group(); wreck.name = 'slide-wreck'; wreck.visible = false; root.add(wreck);
  {
    const B = mkB(M), Rk = B.get('rock', 'wr'), W = B.get('win', 'wr'), Cc = B.get('concrete', 'wr'), Mt = B.get('metal', 'wr');
    for (let k = 0; k < 26; k++) {
      const x = range(SLIDE.x0 + 8, SLIDE.x1 - 8), z = range(RIVER.z0 + 4, RIVER.z0 + 46), s = 3 + r() * r() * 9;
      Rk.set({ col: earthCol([x, 30 * r(), z]), rm: [0.95, 0, 0], em: [0.03, 0.012, 0.004, DUSK + DIST.ALWAYS] });
      Rk.obox(x, WATER_Y - s * 0.35, z, s * (1 + r()), s * (0.5 + r() * 0.3), s * (0.8 + r() * 0.6), r() * 6.28, { faces: 'xXzZY', s: 1 });
    }
    for (const [x, z, w, d, h, tx, tz, yaw, col] of [[452, 196, 22, 18, 30, 0.55, 0.15, 0.3, GLASSC[0]], [503, 182, 17, 17, 22, -0.4, 0.5, -0.5, WALLC[1]], [566, 205, 20, 18, 26, 0.3, -0.45, 1.1, WALLC[3]]]) {
      const Mx = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tx, yaw, tz)).setPosition(x, WATER_Y - 14, z);
      for (const A of [W, Cc, Mt]) { const sv = A.push(Mx);
        if (A === W) { W.set({ col, rm: [0.6, 0, 0], em: [0, 0, 0, DIST.EAST], cell: [3, 3, 7.3 + x, 0] }); W.box(-w / 2, 0, -d / 2, w / 2, h, d / 2, { faces: 'xXzZ', s: 1, wy0: 0 }); }
        else if (A === Cc) { Cc.set({ col: [0.4, 0.4, 0.41], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); Cc.box(-w / 2 - 0.3, h, -d / 2 - 0.3, w / 2 + 0.3, h + 0.9, d / 2 + 0.3, { faces: 'xXzZY', s: 1 }); Cc.box(-w / 2 + 2, h + 0.9, -d / 2 + 2, -w / 2 + 7, h + 4, -d / 2 + 6, { faces: 'xXzZY', s: 1 }); }
        else { Mt.set({ col: [0.2, 0.2, 0.22], rm: [0.5, 0.6, 0], em: [0, 0, 0, 0] }); for (let k = 0; k < 6; k++) Mt.beam([-w / 2 + r() * w, h - 1, -d / 2], [-w / 2 + r() * w, h + 2 + r() * 3, -d / 2 - 1 - r() * 2], 0.08, 0.08); }
        A.pop(sv); }
    }
    tris += B.finish(wreck).tris;
  }
  // ---------------------------------------------------------------- the pieces
  const pieces = [], bones = [], skin = {};
  const cuts = SLIDE.cuts;
  for (let i = 0; i < PIECES.length; i++) {
    const P = PIECES[i], xa = cuts[i], xb = cuts[i + 1], cx = (xa + xb) / 2;
    const pv = new THREE.Vector3(cx, 30, 112);
    const grp = new THREE.Bone(); grp.name = 'slide' + i; grp.position.copy(pv); root.add(grp); bones.push(grp);
    const B = mkB(M), reg = 's' + i, gl = [], bi = bones.length - 1;
    // rock: the river face (the same face as the static cliff either side), the underside (the slip surface), the side breaks
    const R = B.get('rock', reg); R.set({ rm: [0.92, 0, 0], em: [0, 0, 0, 0] });
    const pieceEm = (p) => { const k = 1 - Math.max(0, (p[1] - QUAY.y) / 56); return [0.16 * (0.35 + k), 0.095 * (0.35 + k), 0.05 * (0.35 + k), DUSK + CODE]; };
    gridFace(R, (u, v) => eastP(xa + (xb - xa) * u, v), Math.round((xb - xa) / 5), 14, { colFn: rockCol, emFn: pieceEm });
    gridFace(R, (u, v) => { const x = xa + (xb - xa) * u, z = C0 + (ZF - C0) * v; return [x, Math.min(scarY(x, z), z > QUAY.z0 ? QUAY.y - 0.4 : 99) - 0.05, z]; }, Math.round((xb - xa) / 6), 24, { colFn: earthCol });
    sideFace(R, xa, -1); sideFace(R, xb, 1);
    // the terrace: Binjiang Road along the cliff top, a promenade with a rail and lamps at the edge
    const As = B.get('asphalt', reg), Cc = B.get('concrete', reg), Mt = B.get('metal', reg);
    As.set({ col: [0.45, 0.45, 0.46], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    As.box(xa, 55.6, C0, xb, 56, PLAZA.z1, { faces: 'Y', s: 1 });
    Cc.set({ col: [0.55, 0.55, 0.53], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    Cc.box(xa, 50, PLAZA.z1 - 0.6, xb, 56, PLAZA.z1, { faces: 'Z', s: 1 });
    Cc.box(xa, 56, 104.6, xb, 56.18, PLAZA.z1, { faces: 'Y', s: 1 });
    Mt.set({ col: [0.22, 0.23, 0.24], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
    Mt.box(xa, 57.05, PLAZA.z1 - 0.45, xb, 57.15, PLAZA.z1 - 0.3); Mt.box(xa, 56.6, PLAZA.z1 - 0.42, xb, 56.66, PLAZA.z1 - 0.33);
    for (let x = xa + 1; x < xb; x += 2.4) Mt.box(x - 0.04, 56.18, PLAZA.z1 - 0.42, x + 0.04, 57.1, PLAZA.z1 - 0.33);
    for (let x = xa + 7; x < xb - 3; x += 15) lampPost(B, reg, x, 56.18, PLAZA.z1 - 1.4, { dir: [0, 0, -1], h: 7, code: CODE, glows: gl, col: [1.0, 0.72, 0.38] });
    for (let x = xa + 14; x < xb - 6; x += 15) tree(B, reg, x, 56.18, 108.4, 0.9 + r() * 0.3, seed++);
    // the shop row along the promenade (facing the river): fascias, lightboxes, balconies above
    shopRow(B, reg, new Frame(frontM('x', 1, [0, 104.6])), { u0: xa + 0.4, u1: xb - 0.4, y: 56.18, seed: P.shops.seed, code: CODE, depth: 10, storeys: P.shops.storeys, glows: gl, lotW: 7, lotV: 4, endL: true, endR: true });
    // a red lantern string over the promenade
    for (let x = xa + 3; x < xb - 3; x += 3.2) lantern(B, reg, x, 61.4 + Math.sin((x - xa) / (xb - xa) * Math.PI) * -0.6, 106.2, 0.75, CODE, (x | 0) % 2 ? null : gl);
    // hanging houses on the cliff face (diaojiaolou): plaster boxes on timber stilts, paper windows, tile roofs
    {
      const Pl = B.get('plaster', reg), Wd = B.get('wood', reg), Rf = B.get('roof', reg), Sg = B.get('sign', reg);
      for (const [hx, hy, hw] of P.houses) {
        const v = Math.min(1, Math.max(0, (hy - QUAY.y + 1) / 53.4)), fz = eastP(hx, v)[2], hh = 3.4 + r() * 1.2, z0 = fz - 2, z1 = fz + 4.2 + r() * 1.5;
        Pl.set({ col: WALLC[(r() * WALLC.length) | 0], rm: [0.85, 0, 0], em: em([1.0, 0.58, 0.26], 0.05, DUSK + CODE) });
        Pl.box(hx - hw / 2, hy, z0, hx + hw / 2, hy + hh, z1, { faces: 'xXZ', s: 1 });
        Wd.set({ col: hexc(0x3a2216), rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
        Wd.box(hx - hw / 2 - 0.2, hy - 0.35, z0, hx + hw / 2 + 0.2, hy, z1 + 0.3, { faces: 'xXyZ' });
        // the stilts down to the rock (and the cross-bracing)
        const sv = Math.max(0, v - 0.16), sz = eastP(hx, sv)[2], sy = QUAY.y - 1 + 53.4 * sv;
        for (const sx of [hx - hw / 2 + 0.3, hx + hw / 2 - 0.3]) { Wd.beam([sx, hy - 0.3, z1 - 0.3], [sx, sy, Math.max(sz, z1 - 2.5)], 0.22, 0.22); Wd.beam([sx, hy - 0.3, z1 - 2.2], [sx, sy + 2, sz], 0.18, 0.18); }
        Wd.beam([hx - hw / 2 + 0.3, hy - 0.4, z1 - 0.3], [hx + hw / 2 - 0.3, (hy + sy) / 2, (z1 + sz) / 2], 0.12, 0.12);
        Sg.set({ col: [0.9, 0.85, 0.75], rm: [0.7, 0, 0], em: em([1, 0.7, 0.4], 1.0, DUSK + CODE) });
        for (const dx of hw > 5 ? [-1.4, 1.4] : [0]) signQuad(Sg, [hx + dx, hy + hh * 0.55, z1 + 0.03], [0, 0, 1], 1.3, 1.2, SIGN.paper);
        Rf.set({ col: [0.3, 0.32, 0.34], rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
        hipRoof(Rf, hx - hw / 2, z0 + 1, hx + hw / 2, z1, hy + hh, 1.5, { over: 0.9, curl: 0.6, ridge: 0.4 });
        lantern(B, reg, hx + hw / 2 + 0.2, hy + hh - 0.5, z1 + 0.4, 0.8, CODE, gl);
      }
    }
    // the quay road below, its river wall and lamps (the static quay stops either side)
    {
      As.box(xa, QUAY.y - 0.5, QUAY.z0, xb, QUAY.y, RIVER.z0, { faces: 'Y', s: 1 });
      Cc.box(xa, WATER_Y - 3, RIVER.z0, xb, QUAY.y + 0.05, ZF, { faces: 'YZ', s: 1 });
      Cc.box(xa, QUAY.y, RIVER.z0 - 0.4, xb, QUAY.y + 1.0, RIVER.z0, { faces: 'yYzZ', s: 1 });
      const L = B.get('plain', reg);
      for (let x = -1380; x < 1580; x += 28) {
        if (x <= xa || x >= xb) continue;
        const z = RIVER.z0 - 0.8;
        Mt.set({ col: [0.25, 0.26, 0.27], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] });
        Mt.cyl(x, QUAY.y, z, 0.1, 0.07, QUAY.y + 6.5, 6, { cap: false }); Mt.beam([x, QUAY.y + 6.4, z], [x, QUAY.y + 6.6, z - 1.4], 0.12, 0.12);
        L.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em(SODIUM, 3, DUSK + CODE) }); L.box(x - 0.25, QUAY.y + 6.25, z - 1.65, x + 0.25, QUAY.y + 6.4, z - 1.1);
        gl.push({ p: [x, QUAY.y + 6.1, z - 1.4], color: [2.4, 1.3, 0.5], size: 2.6, code: DUSK + CODE, far: true });
      }
    }
    // blocks standing on the quay against the cliff, rising past its top (the Chongqing wall: you enter at the river
    // and come out on the 18th floor at the street)
    for (const t of P.quay || []) towerBlock(B, { ...t, z0: PLAZA.z1 + 2, z1: QUAY.z0 + 9, y0: QUAY.y, seed: seed++, podium: true, plinth: 0, dist: CODE, signN: [0, 0, 1] }, reg, gl);
    // the low blocks ride the piece; the tall ones get their own groups (they topple off it)
    for (const t of P.low || []) towerBlock(B, { ...t, y0: 56.18, seed: seed++, podium: true, plinth: 0, dist: DIST.EAST, signN: [0, 0, 1] }, reg, gl);
    const towers = [];
    for (const t of P.towers) {
      const bp = new THREE.Vector3((t.x0 + t.x1) / 2, 56.18, t.z1 + 2);
      const tg = new THREE.Bone(); tg.name = 'slide' + i + 't' + towers.length; tg.position.copy(bp).sub(pv); grp.add(tg); bones.push(tg);
      const Bt = mkB(M), tgl = [];
      const top = towerBlock(Bt, { ...t, y0: 56.18, seed: seed++, podium: true, plinth: 7, dist: DIST.EAST, signN: [0, 0, 1], bands: 0 }, reg + 't', tgl).top;
      tris += collect(Bt, bones.length - 1, skin);
      for (const q of tgl) gl.push({ ...q, _obj: tg, _pv: bp });
      towers.push({ grp: tg, pv: bp, h: top - 56.18, phi: t.phi, d: t.d, roll: t.roll, top: new THREE.Vector3(bp.x, top, (t.z0 + t.z1) / 2).sub(bp), wet: false, groan: false });
    }
    tris += collect(B, bi, skin);
    // riding glows (positions recomputed from the group each frame)
    for (const q of gl) {
      const obj = q._obj || grp, piv = q._pv || pv, p = q.p.isVector3 ? q.p.clone() : new THREE.Vector3(...q.p);
      const G = { ...q, p, local: p.clone().sub(piv), obj, slide: true, far: true, prio: 1 };
      delete G._obj; delete G._pv;
      glows.push(G);
    }
    pieces.push({ ...P, i, xa, xb, grp, pv, towers, glows: glows.filter(g => g.obj === grp || towers.some(t => t.grp === g.obj)),
      lip: new THREE.Vector3(cx, 56, PLAZA.z1 + 1).sub(pv), toe: new THREE.Vector3(cx, QUAY.y, ZF).sub(pv), back: new THREE.Vector3(cx, 56, C0 + 2).sub(pv),
      wet: false, hidden: false, last: new THREE.Vector3(), vel: new THREE.Vector3() });
  }
  // one skinned mesh per material over every piece (bind pose = the bones where they stand now)
  root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(bones);
  for (const { mat, geos } of Object.values(skin)) {
    const m = new THREE.SkinnedMesh(mergeGeometries(geos, false), mat);
    m.name = 'slide-' + mat.userData.key; m.frustumCulled = false; m.receiveShadow = true;
    root.add(m); m.bind(skel, new THREE.Matrix4());
  }
  return { root, anchors: { glows, named: { slide: { root, pieces, wreck, scarFires: glows.filter(g => g.scarFire) } } }, tris };
}

// =====================================================================================
//  The simulation: crack → slump → slide (accelerating down and out along the slip surface, pitching
//  toward the river) → into the water; the towers topple off their pieces; dust, rockfall, sparks,
//  white water; then the pieces sink out of sight and the scar is left.
// =====================================================================================
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Euler(), _q = new THREE.Quaternion();
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SLUMP = 2.2;
export class Landslide {
  constructor(g, S) { this.g = g; this.S = S; this.T = -1; this.audio = g.audio; }
  get active() { return this.T >= 0; }
  start(fast = false) {
    if (this.T >= 0 || !this.S) return;
    this.T = 0;
    const g = this.g;
    POWER.pow.value[CODE] = 1; POWER.cut.value[CODE] = 9999;
    if (fast) { this.T = 60; this._pose(60, 0); for (const P of this.S.pieces) this._hide(P); SLIDE.gone = true; for (const gl of this.S.scarFires) gl.dead = false; this._columns(); this._wreck(); return; }
    const cx = (SLIDE.x0 + SLIDE.x1) / 2;
    this.audio.play('collapse_rumble', { x: cx, y: 50, z: 100, volume: 1 });
    this.audio.play('metal_groan', { x: cx - 60, y: 50, z: 90, volume: 1, pitch: 0.7 });
    // the crack opens along the road: a line of dust bursts, the services in it arcing
    for (let k = 0; k <= 10; k++) {
      const x = SLIDE.x1 - (SLIDE.x1 - SLIDE.x0) * k / 10;   // it runs along the road toward the tower
      g.fx.later(k * 0.07 + rand() * 0.1, () => {
        this._dust(x + range(-6, 6), 57, C0 + range(-1, 2), range(-2, 2), range(7, 12), range(-1, 2), 7, 34, range(10, 14));
        if (k % 3 === 1) this._arc(_v.set(x, 55.5, C0 + 0.5));
      });
    }
    g.lastExplosionT = g.time; g.lastExplosionShake = 0.45;
    g.events.push({ type: 'slide' });
  }
  _arc(p) {
    const g = this.g, d = p.distanceTo(g.headPos), sz = 4 + d * 0.05;
    g.fx.main.spawn({ x: p.x, y: p.y, z: p.z, frame: CELL.FLASH, s0: sz, s1: sz * 2.4, life: 0.18, r: 2.4, g: 3.0, b: 4.2, fadeIn: 0, fadeOut: 0.5 });
    g.fx.main.spawn({ x: p.x, y: p.y, z: p.z, frame: CELL.GLOW, s0: sz * 3, s1: sz * 4, life: 0.35, r: 0.5, g: 0.8, b: 1.4, a: 1, fadeIn: 0, fadeOut: 0.6 });
    for (let k = 0; k < 16; k++) g.fx.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: range(-7, 7), vy: range(0, 9), vz: range(-7, 7), grav: 9.8, drag: 0.15, frame: CELL.SPARK, s0: 1 + d * 0.004, w: 0.05 + d * 0.0003, len: 0.2, life: range(0.5, 1.4), r: 2.2, g: 2.6, b: 3.4, a: 1, fadeOut: 0.4 });
    if (d < 400) this.audio.play('impact_metal', { x: p.x, y: p.y, z: p.z, volume: 0.6, pitch: 1.8 });
  }
  // where piece P is at time T: [s along the slip, pose applied to its group]
  _piece(P, T) {
    const tau = T - P.delay;
    if (tau <= 0) { P.grp.position.copy(P.pv); if (T > 0) P.grp.position.y += Math.sin(T * 41 + P.i * 2) * 0.05; P.grp.quaternion.identity(); return { tau, s: 0 }; }
    const k = ss(0, SLUMP, tau), sg = Math.max(0, tau - SLUMP), s = Math.min(260, 0.5 * P.acc * sg * sg + 1.2 * sg);
    P.grp.position.set(P.pv.x + s * 0.04 * Math.sign(P.yaw), P.pv.y - (2.6 * k + s * 0.8), P.pv.z + 4 * k + s * 0.55);
    if (tau < SLUMP) P.grp.position.y += Math.sin(T * 37 + P.i) * 0.12 * (1 - k);
    _e.set(0.2 * k + (P.pitch - 0.2) * ss(4, 100, s), P.yaw * ss(0, 80, s), P.roll * ss(8, 110, s), 'XYZ');
    P.grp.quaternion.setFromEuler(_e);
    for (const t of P.towers) {
      const u = ss(t.d + 1.0, t.d + 6.5, tau);
      _e.set(t.phi * u * u, 0, t.roll * u, 'XYZ'); t.grp.quaternion.setFromEuler(_e);
    }
    return { tau, s };
  }
  _pose(T) { for (const P of this.S.pieces) if (!P.hidden) this._piece(P, T); this.S.root.updateMatrixWorld(true); }
  _wreck() { if (this.S.wreck) this.S.wreck.visible = true; }
  _columns() { const C = this.g.smokeColumns; if (C && !this._cols) { this._cols = true; C.push([420, 30, 110, 1.3], [520, 20, 130, 1.5], [570, 45, 70, 1.0]); } }
  _hide(P) { P.hidden = true; P.grp.scale.setScalar(1e-4); P.grp.updateMatrixWorld(true); for (const gl of P.glows) this._killGlow(gl); }
  _killGlow(gl) { gl.dead = true; const refl = this.g.world._refl; if (refl && gl._refl >= 0) { refl.set(gl._refl, { intensity: 0 }); gl._refl = -1; } }
  _splash(P, x0, x1, z, k) {
    const g = this.g, n = Math.max(2, Math.round((x1 - x0) / 14));
    for (let j = 0; j <= n; j++) {
      const x = x0 + (x1 - x0) * j / n;
      g.fx.later(j * 0.06 + rand() * 0.08, () => {
        for (let i = 0; i < 2; i++) { const s0 = range(9, 14) * k; g.clouds.spawn({ x: x + range(-5, 5), y: WATER_Y + range(5, 10), z: z + range(-3, 7), vx: range(-3, 3), vy: range(14, 26) * k, vz: range(2, 7), drag: 0.8, buoy: 0.3, s0, s1: s0 * range(3.2, 4.2), life: range(6, 8), a: 0.65, fadeIn: 0.04, fadeOut: 0.6, r: 0.2, g: 0.19, b: 0.18, r1: 0.15, g1: 0.14, b1: 0.13, glow: 0.3, glowFade: 2 }); }
        for (let i = 0; i < 16; i++) g.fx.main.spawn({ x: x + range(-7, 7), y: WATER_Y + 1, z: z + range(-3, 8), vx: range(-5, 5), vy: range(18, 38) * k, vz: range(0, 10), grav: 9.8, drag: 0.35, frame: CELL.WISP, s0: 3 * k, s1: 9 * k, life: range(2, 3.4), rot: rand() * 6, r: 0.42, g: 0.42, b: 0.42, a: 0.4, fadeOut: 0.5 });
      });
    }
  }
  // a big rolling cloud of dust (brown-grey, lit from below by the fires)
  _dust(x, y, z, vx, vy, vz, s0, s1, life = range(14, 18)) {
    this.g.clouds.spawn({ x, y, z, vx, vy, vz, drag: 0.55, buoy: 0.12, s0, s1, life, a: 0.9, fadeIn: 0.06, fadeOut: 0.5, r: 0.12, g: 0.095, b: 0.07, r1: 0.17, g1: 0.145, b1: 0.12, glow: 0.55, glowFade: 4 });
  }
  update(dt) {
    if (this.T < 0 || !this.S) return;
    const g = this.g, T0 = this.T; this.T += dt; const T = this.T;
    if (T > 40) return;
    let anyLive = false;
    for (const P of this.S.pieces) {
      if (P.hidden) continue;
      anyLive = true;
      P.last.copy(P.grp.position);
      const { tau, s } = this._piece(P, T);
      P.grp.updateMatrixWorld(true);
      P.vel.copy(P.grp.position).sub(P.last).divideScalar(Math.max(1e-3, dt));
      const W = P.grp.matrixWorld, sp = P.vel.length();
      // the glows ride along (and go out under the water)
      for (const gl of P.glows) {
        if (gl.dead) continue;
        gl.p.copy(gl.local).applyMatrix4(gl.obj.matrixWorld);
        const refl = g.world._refl; if (refl && gl._refl >= 0) refl.set(gl._refl, { p: gl.p.toArray() });
        if (gl.p.y < WATER_Y + (gl.color && gl.size === 2.6 ? 6.5 : -0.3)) this._killGlow(gl);
      }
      if (tau <= 0) continue;
      const lip = _v.copy(P.lip).applyMatrix4(W), toe = _w.copy(P.toe).applyMatrix4(W);
      // the head scarp opening behind it: dust boiling up out of the crack
      if (tau > 0.3 && tau < 8 && rand() < dt * 1.6) { const y = 56 - Math.min(30, s * 0.4) * rand(); this._dust(range(P.xa, P.xb), y, C0 + (56 - y) * 0.5 + range(0, 4), range(-2, 2), range(5, 9), range(0, 3), 10, range(38, 52)); }
      // rock pouring off the lip and the face; a curtain of dust rolling off the leading edge
      if (tau > 0.6 && lip.y > WATER_Y + 2 && sp > 0.5) {
        if (rand() < dt * 24) g.fx.spawnDebris(new THREE.Vector3(range(P.xa, P.xb), lip.y + range(-2, 0), lip.z + range(-1, 2)), P.vel.x + range(-3, 3), P.vel.y + range(-1, 4), P.vel.z + range(1, 6), range(0.8, 2.2), rand() < 0.12);
        if (tau > SLUMP + 1.2 && rand() < dt * 1.5) { const y = range(Math.max(WATER_Y + 2, toe.y), lip.y); this._dust(range(P.xa, P.xb), y, lip.z + (lip.y - y) * 0.3 + range(0, 5), P.vel.x * 0.3 + range(-2, 2), range(3, 7), P.vel.z * 0.4 + range(1, 4), 12, range(44, 60)); }
      }
      // sparks where the cables tear (shop rows, lamp lines), fires catching in the shops
      if (tau > 0.4 && tau < 6 && rand() < dt * 0.9) this._arc(_v.set(range(P.xa + 4, P.xb - 4), 62, 104).sub(P.pv).applyMatrix4(W));
      if (tau > 1.2 && lip.y > WATER_Y + 3 && rand() < dt * 3.5) g.fx.flame(_v.set(range(P.xa + 4, P.xb - 4), 57.5, range(96, 104)).sub(P.pv).applyMatrix4(W), range(1.2, 2.0));
      // the toe hits the river: a wall of white water across its width; it keeps churning while it goes in
      if (!P.wet && toe.y < WATER_Y + 1.5 && tau > SLUMP) {
        P.wet = true;
        this._splash(P, P.xa, P.xb, Math.max(RIVER.z0 + 4, toe.z), 1.0);
        this.audio.play('collapse_impact', { x: toe.x, y: 2, z: toe.z, volume: 1 });
        if (P.i === 0) this.audio.play('explosion_big', { x: toe.x, y: 2, z: toe.z, volume: 0.9, pitch: 0.7 });
        g.lastExplosionT = g.time; g.lastExplosionShake = 0.5;
        g.events.push({ type: 'slideWater', i: P.i });
        // the surge: a low wall of dust and spray rolling out across the river
        for (let j = 0; j < 6; j++) g.fx.later(0.1 + j * 0.12, () => this._dust(range(P.xa, P.xb), WATER_Y + range(2, 6), Math.max(RIVER.z0 + 6, toe.z) + range(0, 8), range(-3, 3), range(1, 3), range(9, 15), 14, range(55, 70), range(12, 16)));
      }
      if (P.wet && lip.y > WATER_Y - 4 && rand() < dt * 2.5) {
        const x = range(P.xa, P.xb), z = lip.z + Math.max(0, lip.y) * 0.9 + range(0, 6), s0 = range(9, 13);
        g.clouds.spawn({ x, y: WATER_Y + 3, z, vx: range(-3, 3), vy: range(5, 11), vz: range(2, 7), drag: 0.7, buoy: 0.3, s0, s1: s0 * 3.5, life: range(6, 8), a: 0.6, fadeIn: 0.04, fadeOut: 0.6, r: 0.18, g: 0.17, b: 0.16, r1: 0.14, g1: 0.13, b1: 0.12, glow: 0.3, glowFade: 2 });
      }
      // the towers: a groan as each one starts to go, glass bursting off them, a splash when the top goes in
      for (const t of P.towers) {
        const u = tau - t.d - 1.0;
        if (u > 0 && !t.groan) { t.groan = true; this.audio.play('metal_groan', { x: t.pv.x, y: 90, z: t.pv.z, volume: 0.9, pitch: 0.8 + P.i * 0.08 }); }
        const top = _v.copy(t.top).applyMatrix4(t.grp.matrixWorld);
        if (u > 0 && top.y > WATER_Y + 4 && rand() < dt * 7) {
          const p = _w.set(range(-8, 8), range(10, t.h), range(-2, 2)).applyMatrix4(t.grp.matrixWorld);
          g.glass.burst?.(p.clone(), new THREE.Vector3(range(-1, 1), 0.2, 1), 14, { spread: 3, speed: 3, size: 0.35, life: 10 });
          if (rand() < 0.3) this.audio.play('impact_glass', { x: p.x, y: p.y, z: p.z, volume: 0.5, pitch: range(0.7, 1) });
        }
        if (!t.wet && top.y < WATER_Y + 2) {
          t.wet = true; const k = Math.min(1.6, 0.6 + t.h / 120);
          const base = _w.set(0, 0, 0).applyMatrix4(t.grp.matrixWorld);
          for (let j = 0; j < 5; j++) { const q = new THREE.Vector3().lerpVectors(base, top, 0.5 + j * 0.12); q.y = WATER_Y; if (q.z > RIVER.z0) this._splash(P, q.x - 6, q.x + 6, q.z, k * 0.8); }
          this.audio.play('collapse_impact', { x: top.x, y: 2, z: top.z, volume: 1, pitch: 0.85 });
        }
      }
      // gone: once the lip, the back and every tower top are under water
      const back = _v.copy(P.back).applyMatrix4(W);
      if (tau > 18 || tau > SLUMP + 2 && lip.y < WATER_Y - 6 && back.y < WATER_Y - 4 && P.towers.every(t => _w.copy(t.top).applyMatrix4(t.grp.matrixWorld).y < WATER_Y - 3)) this._hide(P);
    }
    if (T0 < 12 && T >= 12) SLIDE.gone = true;
    if (T0 < 15 && T >= 15) { for (const gl of this.S.scarFires) gl.dead = false; this._columns(); }
    if (!this._wr && this.S.pieces.every(P => P.hidden)) { this._wr = true; this._wreck(); }
    if (!anyLive) SLIDE.gone = true;
  }
}
