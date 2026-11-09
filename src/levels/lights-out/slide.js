import * as THREE from 'three';
import { makeRng, rand, range } from '../../rng.js';
import { CELL } from '../../particles.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Buckets, em, hexc, GOLD, DIST, DUSK, SODIUM, POWER, signQuad } from './kit.js';
import { materials } from './mats.js';
import { SIGN, SIGN_LIST } from './signs.js';
import { lampPost, lantern, tree } from './kitbuild.js';
import { towerBlock } from './city.js';
import { gridFace, fbm, eastP, rockCol } from './terrain.js';
import { SLIDE, TERR, HILLE, hillY, scarY0, QUAY, RIVER, PLAZA, WATER_Y } from './layout.js';

// =====================================================================================
//  THE LANDSLIDE. East of Jinlong the bank is a hillside district: six terraced streets step down
//  from the y-64 hill to a narrow quay (TERR), each lined with stacked housing whose roofs reach the
//  street above, stairways between them, lamps and lanterns, three towers on the top terrace and
//  three buildings straddling the hill's crest. During the glide the whole slope lets go.
//
//  The slope is cut into 30 uneven pieces (COLS × ROWSC; it was a 4 × 3 grid, which looked scripted). Each block is a bone: its terraces,
//  retaining walls, buildings, lamps and the earth under it down to the slip surface. Blocks go
//  toe-first and east-first: the bottom row drops into the river, the rows above slide down after
//  it, the gaps between them open on raw earth. The towers are child bones in two segments; they
//  topple off the moving ground and fold. Everything of every block is merged into one
//  SkinnedMesh per material (~12 draw calls).
//
//  Behind them is the scar (static, hidden inside the hill until the blocks leave): the gullied
//  slip surface lit by the fires burning on it, rough valley walls where the bank broke, rubble,
//  the cut-open back halves of the crest buildings. Then come wreckage in the river, swell rings,
//  silt and smoke columns.
//
//  Power: the streets and most of the housing are on Jinlong's generators (district TOWER: lit
//  below y 70 after the blackout, full and flickering while it goes, dark when the tower hits);
//  the rest are on the dead grid (EAST: emergency windows only).
// =====================================================================================
const CODE = DIST.TOWER;
const C0 = SLIDE.crack, ZF = RIVER.z0 + 1.2, Y0 = TERR.y0;
// the slip surface: gullied and stepped (strata ledges); no noise at the crest so it meets the hill top
export const scarY = (x, z) => {
  const e = Math.min(1, (z - C0) / 6), b = scarY0(z);
  const gully = (fbm(x * 0.045 + 3, z * 0.03) - 0.5) * 9, ledge = Math.sin(b * 0.62 + fbm(x * 0.03, z * 0.05) * 5) * 1.4;
  return b + (gully + ledge + (fbm(x * 0.2, z * 0.2) - 0.5) * 1.6) * e;
};
const tz0 = (k) => TERR.z0 + TERR.d * k, ty = (k) => Y0 - TERR.dy * k;

// skinning: each bucket's geometry is weighted 1 to one bone; merged per material at the end
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
// broken earth: ochre clay and grey strata bands, darker and wet low down
const earthCol = (p) => {
  const k = 0.8 + fbm(p[0] * 0.07, p[2] * 0.09 + p[1] * 0.05) * 0.4;
  const band = Math.sin(p[1] * 0.75 + fbm(p[0] * 0.02, p[1] * 0.04) * 4) > 0.55;
  const wet = p[1] < 8 ? 0.55 : p[1] < 16 ? 0.75 : 1;
  const c = band ? [0.42, 0.4, 0.37] : [0.46, 0.33, 0.21];
  return [c[0] * k * wet, c[1] * k * wet, c[2] * k * wet];
};
// polylines [y, z] (back → front), subdivided so a strip down to the slip surface follows its curve
function subdiv(T, step = 3) {
  const out = [T[0]];
  for (let i = 1; i < T.length; i++) {
    const [y0, z0] = T[i - 1], [y1, z1] = T[i], n = Math.max(1, Math.ceil(Math.abs(z1 - z0) / step));
    for (let k = 1; k <= n; k++) out.push([y0 + (y1 - y0) * k / n, z0 + (z1 - z0) * k / n]);
  }
  return out;
}
// the hill's top profile between za and zb: terrace tops and the retaining walls between them (vertical steps)
function hillProfile(za, zb) {
  const T = [[hillY(za + 1e-3), za]];
  for (let k = 1; k <= TERR.n; k++) { const z = tz0(k); if (z > za + 1e-3 && z < zb - 1e-3) T.push([hillY(z - 1e-3), z], [hillY(z + 1e-3), z]); }
  if (zb >= ZF - 0.01) T.push([QUAY.y, RIVER.z0], [QUAY.y + 0.05, ZF], [WATER_Y - 3, ZF]); else T.push([hillY(zb - 1e-3), zb]);
  return subdiv(T);
}
// the neighbours' outline (the old bank either side): the y-56 terrace, the cliff face, the quay
function bankProfile(x) {
  const T = [[56, C0], [56, PLAZA.z1 - 0.2]];
  for (let k = 14; k >= 0; k--) { const p = eastP(x, k / 14); T.push([p[1], p[2]]); }
  T.push([QUAY.y, QUAY.z0], [QUAY.y, RIVER.z0], [QUAY.y + 0.05, ZF], [WATER_Y - 3, ZF]);
  return subdiv(T);
}
// a face at x between a top profile and the slip surface. dir +1 faces +x. jag: rough, bulging out into the void
// (only below `under(z)`, the hill top, so nothing shows before the slide)
function sideFace(A, x, dir, T, { jag = 0, under = null, colFn = earthCol, bot = null } = {}) {
  const n = T.length - 1;
  gridFace(A, (u, v) => {
    const i = Math.min(n - 1, Math.floor(u * n)), f = u * n - i, a = T[dir > 0 ? n - i : i], b = T[dir > 0 ? n - i - 1 : i + 1];
    const tyy = a[0] + (b[0] - a[0]) * f, tzz = a[1] + (b[1] - a[1]) * f;
    let xx = x;
    if (jag) { const lim = under ? under(tzz) : tyy; const yy0 = Math.min(tyy - 0.2, scarY(x, tzz)), yy = yy0 + (tyy - yy0) * v; if (yy < lim - 1) xx = x - dir * jag * (0.35 + fbm(tzz * 0.08 + x, yy * 0.09) * 1.3) * Math.min(1, (lim - 1 - yy) / 6) * Math.min(1, (tzz - C0) / 8); }
    const by = bot ? bot(xx, tzz) : Math.min(tyy - 0.2, scarY(xx, tzz));
    return [xx, by + (tyy - by) * v, tzz];
  }, n, jag ? 8 : 1, { colFn });
}
// a face across the hill at z (facing +z if dir > 0) from the slip surface up to y1
function crossFace(A, z, xa, xb, dir, y1, colFn = earthCol, bot = null) {
  gridFace(A, (u, v) => { const x = dir > 0 ? xa + (xb - xa) * u : xb - (xb - xa) * u, b = bot ? bot(x, z) : Math.min(y1 - 0.2, scarY(x, z)); return [x, b + (y1 - b) * v, z]; }, Math.round((xb - xa) / 4), 2, { colFn });
}

const WALLC = [hexc(0xd6c8b0), hexc(0xc9b9a6), hexc(0xd8d2c4), hexc(0xb9b2a5), hexc(0xc4a593), hexc(0xa9a196)];
const GLASSC = [hexc(0x3c4a58), hexc(0x30404c), hexc(0x4a4436)];
// the towers on the top terrace (child bones in two segments) and the buildings astride the crest
const TOWERS = [
  { c: 1, x0: 436, z0: 42, x1: 458, z1: 56, h: 124, style: 1, crown: 'led', ledCol: GOLD, roofSign: 'roof5', phi: 0.3, d: 0.6, roll: 0.34, fold: 0.42 },
  { c: 2, x0: 494, z0: 42, x1: 512, z1: 56, h: 98, style: 0, crown: 'frame', roofSign: 'roof6', phi: 0.34, d: 0.3, roll: -0.28, fold: -0.32 },
  { c: 3, x0: 560, z0: 42, x1: 582, z1: 56, h: 136, style: 0, crown: 'diamond', ledCol: [1.0, 0.85, 0.6], phi: 0.32, d: 0.8, roll: -0.34, fold: 0.38 },
];
const SHELLS = [{ x0: 392, x1: 418, h: 33, style: 0, c: 0 }, { x0: 464, x1: 478, h: 27, style: 2, c: 1 }, { x0: 539, x1: 551, h: 36, style: 0, c: 3 }];
const SHZ0 = 30, SHZ1 = 48;
// the hill breaks into 30 uneven pieces, not a 4 x 3 grid: ten columns of different widths (cut so no tower or crest
// building straddles a cut), and each column breaks across at different terraces. Every piece goes at its own moment
// (outward from where the gunship hit, with jitter), at its own rate, with its own twist, roll and drop
const COLS = [370, 389, 421, 434, 461, 480, 492, 515, 536, 555, 592], IMPACT_X = 447;
const ROWSC = [[40, 76, 112], [40, 58, 94], [40, 76, 130], [40, 58, 112], [40, 76, 94], [40, 58, 130], [40, 76, 112], [40, 58, 94], [40, 76, 130], [40, 58, 112]];
const colOf = (x) => Math.max(0, Math.min(COLS.length - 2, COLS.findIndex((c, i) => x >= c && x < COLS[i + 1])));
// the east rim: the district beside the slide doesn't end on a ruler line. Three more pieces (one per row, different
// widths) lose their support, drop and tilt into the scar and hang there, houses leaning: a broken, stepped edge
const RIMW = [16, 30, 21], rimBot = (x, z) => hillY(z) - 15;

// the torn floor where a tower breaks: a ragged slab, rebar bristling out of it, a dark gash (upper: hanging down)
function breakCap(B, reg, t, yb, upper) {
  const r = makeRng(Math.round(t.x0 * 7 + yb)), Cc = B.get('concrete', reg), Mt = B.get('metal', reg), D = B.get('plain', reg), s = upper ? -1 : 1;
  Cc.set({ col: [0.38, 0.37, 0.36], rm: [0.95, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
  D.set({ col: [0.03, 0.03, 0.03], rm: [1, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
  D.box(t.x0 + 0.2, yb - 0.02, t.z0 + 0.2, t.x1 - 0.2, yb + 0.02, t.z1 - 0.2, { faces: upper ? 'y' : 'Y' });
  for (let k = 0; k < 9; k++) {
    const x = t.x0 + r() * (t.x1 - t.x0 - 4), z = t.z0 + r() * (t.z1 - t.z0 - 4), w = 2 + r() * 5, d = 2 + r() * 5, h = 0.4 + r() * 2.2;
    Cc.box(x, s > 0 ? yb : yb - h, z, Math.min(t.x1, x + w), s > 0 ? yb + h : yb, Math.min(t.z1, z + d), { faces: 'xXzZ' + (s > 0 ? 'Y' : 'y'), s: 1 });
  }
  Mt.set({ col: [0.25, 0.18, 0.13], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
  for (let k = 0; k < 26; k++) { const x = t.x0 + r() * (t.x1 - t.x0), z = r() < 0.5 ? (r() < 0.5 ? t.z0 : t.z1) : t.z0 + r() * (t.z1 - t.z0); Mt.beam([x, yb, z], [x + range(-0.8, 0.8), yb + s * (1 + r() * 3), z + range(-0.8, 0.8)], 0.06, 0.06); }
}
// a building astride the crest: the back half stays (its cut face shows the floors), the front half goes
function shellHalf(B, reg, S, back, seed) {
  const fl = 3.0, top = Y0 + S.h, z0 = back ? SHZ0 : C0, z1 = back ? C0 : SHZ1, col = WALLC[seed % WALLC.length];
  const W = B.get('tile', reg), Cc = B.get('concrete', reg);
  W.set({ col, rm: [0.85, 0, 0], em: [0, 0, 0, CODE], cell: [3.0, fl, seed * 0.37 % 1 * 40, S.style] });
  W.box(S.x0, Y0, z0, S.x1, top, z1, { faces: back ? 'xXz' : 'xXZ', s: 1, wy0: Y0 });
  Cc.set({ col: [0.42, 0.42, 0.43], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
  Cc.box(S.x0 - 0.3, top, z0 - (back ? 0.3 : 0), S.x1 + 0.3, top + 0.8, z1 + (back ? 0 : 0.3), { faces: 'xXY' + (back ? 'z' : 'Z'), s: 1 });
  if (!back) return;
  const r = makeRng(seed), D = B.get('plain', reg), Mt = B.get('metal', reg);
  D.set({ col: [0.035, 0.03, 0.03], rm: [1, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
  D.box(S.x0 + 0.3, Y0, C0 - 3, S.x1 - 0.3, top, C0 - 3, { faces: 'Z' });
  for (let y = Y0 + fl; y < top - 0.5; y += fl) for (let x = S.x0; x < S.x1 - 0.1; x += 2.2) Cc.box(x, y - 0.3, C0 - 3, Math.min(S.x1, x + 2.2), y, C0 - 0.6 + Math.max(0, Math.sin(x * 1.7 + y) * 1.4 + r() * 0.6), { faces: 'yYZ', s: 1 });
  for (let x = S.x0 + 2; x < S.x1 - 1; x += 5 + r() * 2) Cc.box(x, Y0, C0 - 3.4, x + 0.6, top, C0 - 2.6, { faces: 'xXZ', s: 1 });
  Mt.set({ col: [0.25, 0.18, 0.13], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
  for (let k = 0; k < 30; k++) { const x = S.x0 + r() * (S.x1 - S.x0), y = Y0 + fl * (1 + Math.floor(r() * (S.h / fl - 1))); Mt.beam([x, y - 0.15, C0 - 0.5], [x + range(-0.5, 0.5), y + range(-1.2, 0.3), C0 + 0.8 + r() * 2], 0.05, 0.05); }
  const hy = Y0 + fl * (2 + Math.floor(r() * 3)), hx = S.x0 + 3 + r() * (S.x1 - S.x0 - 9), Mh = new THREE.Matrix4().makeRotationX(1.1).setPosition(hx, hy, C0 - 0.4);
  const sv = Cc.push(Mh); Cc.box(0, -0.3, 0, 6, 0, 4.5, { faces: 'xXyYZ', s: 1 }); Cc.pop(sv);
}

export function buildSlide(ctx = {}) {
  SLIDE.gone = false;
  const M = materials();
  const root = new THREE.Group(); root.name = 'landslide';
  const glows = [];
  const r = makeRng(5150);
  let seed = 900, tris = 0;
  // ---------------------------------------------------------------- the scar (static)
  const FIRES = [[392, 58, 1.0], [446, 118, 1.3], [468, 72, 0.9], [512, 140, 1.4], [548, 96, 1.0], [574, 60, 0.8], [420, 150, 1.2], [500, 88, 1.0]].map(([x, z, k]) => [x, Math.max(WATER_Y + 1, scarY(x, z) + 1.5), z, k]);
  const fireEm = (p) => {
    const e = 0.8, nx = -(scarY(p[0] + e, p[2]) - scarY(p[0] - e, p[2])) / (2 * e), nz = -(scarY(p[0], p[2] + e) - scarY(p[0], p[2] - e)) / (2 * e), nl = Math.hypot(nx, 1, nz);
    let L = 0;
    for (const [fx, fy, fz, k] of FIRES) { const dx = fx - p[0], dy = fy + 3 - p[1], dz = fz - p[2], d = Math.hypot(dx, dy, dz) || 1; L += k * Math.max(0, (nx * dx + dy + nz * dz) / (nl * d)) / (1 + d * d / 450); }
    L = Math.min(0.8, L) + 0.03;
    return [0.42 * L, 0.17 * L, 0.05 * L, DUSK + DIST.ALWAYS];
  };
  {
    const B = mkB(M);
    const A = B.get('rock', 'scar'); A.set({ rm: [0.95, 0, 0], em: [0, 0, 0, 0] });
    gridFace(A, (u, v) => { const x = SLIDE.x0 + (SLIDE.x1 - SLIDE.x0) * u, z = SLIDE.toe - (SLIDE.toe - C0) * v; return [x, scarY(x, z), z]; }, 80, 48, { colFn: earthCol, emFn: fireEm });
    // the valley walls where the bank broke: rock face above the hill line (seen before), rough earth below it
    const rc = (p) => p[1] > hillY(p[2]) + 0.5 ? rockCol(p) : earthCol(p);
    // west side: where Sky Street's ground stands above the hill, the backs of its buildings come down to the hill (lit
    // windows, not a black rock wall); below the hill line it's the broken earth the slide uncovers
    { const Bp = bankProfile(SLIDE.x0), bankAt = (z) => { for (let i = 1; i < Bp.length; i++) if (Bp[i][1] >= z) { const [y0, z0] = Bp[i - 1], [y1, z1] = Bp[i]; return y0 + (y1 - y0) * Math.min(1, Math.max(0, (z - z0) / Math.max(1e-3, z1 - z0))); } return QUAY.y; };
      sideFace(A, SLIDE.x0, 1, Bp.map(([y, z]) => [Math.min(y, hillY(z) - 0.05), z]), { jag: 9, under: hillY, colFn: earthCol });
      const W = B.get('tile', 'scar');
      W.set({ col: WALLC[2], rm: [0.85, 0, 0], em: [0, 0, 0, CODE], cell: [3.0, 3.0, 17.3, 0] });
      gridFace(W, (u, v) => { const z = Math.min(PLAZA.z1 + 0.5, C0 + (PLAZA.z1 + 0.5 - C0) * (1 - u)), lo = Math.min(hillY(z), bankAt(z)), hi = Math.max(lo, bankAt(z) + 1.2); return [SLIDE.x0 - 0.05, lo + (hi - lo) * v, z]; }, 40, 6);
      const Ce = B.get('concrete', 'scar'); Ce.set({ col: [0.42, 0.42, 0.43], rm: [0.9, 0, 0], em: em([1.0, 0.55, 0.2], 0.9, DUSK + CODE) });
      Ce.box(SLIDE.x0 - 0.3, 57.0, C0, SLIDE.x0, 57.25, PLAZA.z1, { faces: 'X' }); }
    sideFace(A, SLIDE.x1, -1, hillProfile(C0, ZF).map(([y, z]) => [y - 12, z]), { jag: 9, under: (z) => hillY(z) - 12, colFn: earthCol });
    for (let rw = 0; rw < 3; rw++) {
      const za = SLIDE.rows[rw], zb = rw === 2 ? ZF : SLIDE.rows[rw + 1];
      sideFace(A, SLIDE.x1 + RIMW[rw], -1, hillProfile(za, zb), { colFn: rc, bot: (x, z) => hillY(z) - 17 });
      if (rw < 2) { const wa = RIMW[rw], wb = RIMW[rw + 1], z = SLIDE.rows[rw + 1];
        if (wa < wb) crossFace(A, z, SLIDE.x1 + wa, SLIDE.x1 + wb, 1, hillY(z - 1e-3), earthCol, (x, zz) => hillY(zz + 1e-3) - 17);
        else crossFace(A, z, SLIDE.x1 + wb, SLIDE.x1 + wa, -1, hillY(z + 1e-3), earthCol, (x, zz) => hillY(zz + 1e-3) - 17); }
    }
    // broken services sticking out of the head scarp, rubble down the slope and piled at the waterline
    const Mt = B.get('metal', 'scar');
    Mt.set({ col: [0.2, 0.21, 0.22], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] });
    for (let x = SLIDE.x0 + 6; x < SLIDE.x1 - 4; x += 9 + r() * 10) { const y = Y0 - 1.5 - r() * 3, z = C0 + (Y0 - y) * 0.45; Mt.beam([x, y, z - 1], [x + range(-0.5, 0.5), y + range(-0.3, 0.3), z + 1.5 + r() * 2], 0.35 + r() * 0.3, 0.35 + r() * 0.3); }
    const Rk = B.get('rock', 'scar');
    for (let k = 0; k < 90; k++) {
      const x = range(SLIDE.x0 + 4, SLIDE.x1 - 4), z = C0 + 10 + Math.pow(r(), 0.6) * (SLIDE.toe - C0 - 14), y = scarY(x, z), s = 1.2 + r() * r() * 6;
      const fe = fireEm([x, y, z]); Rk.set({ col: earthCol([x, y + 30 * r(), z]), rm: [0.95, 0, 0], em: [fe[0] * 0.9, fe[1] * 0.9, fe[2] * 0.9, fe[3]] });
      Rk.obox(x, y + s * 0.3, z, s * (0.8 + r() * 0.6), s * (0.5 + r() * 0.4), s * (0.7 + r() * 0.6), r() * 6.28, { faces: 'xXzZY', s: 1 });
    }
    // slabs of the crest road torn and hanging over the head scarp
    const As = B.get('asphalt', 'scar'), Cc = B.get('concrete', 'scar');
    As.set({ col: [0.42, 0.42, 0.43], rm: [0.6, 0, 0], em: [0, 0, 0, 0] }); Cc.set({ col: [0.45, 0.45, 0.44], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    for (let x = SLIDE.x0 + 5; x < SLIDE.x1 - 6; x += 7 + r() * 9) {
      if (SHELLS.some(S => x + 9 > S.x0 && x < S.x1)) continue;
      const w = 4 + r() * 5, d = 3 + r() * 4, Mx = new THREE.Matrix4().makeRotationX(0.3 + r() * 0.7).premultiply(new THREE.Matrix4().makeTranslation(x, Y0 - 0.2, C0 + 0.2));
      for (const A2 of [As, Cc]) { const sv = A2.push(Mx); if (A2 === As) A2.box(0, -0.4, 0, w, 0, d, { faces: 'xXYzZ', s: 1 }); else A2.box(0, -0.9, 0, w, -0.4, d, { faces: 'xXyzZ', s: 1 }); A2.pop(sv); }
    }
    SHELLS.forEach((S, k) => shellHalf(B, 'scar', S, true, 77 + k * 13));
    tris += B.finish(root).tris;
    for (const [x, y, z, k] of FIRES) glows.push({ p: [x, y, z], color: [2.6, 1.0, 0.3], size: 9 * k, flick: true, code: DUSK + DIST.ALWAYS, far: true, dead: true, scarFire: true, prio: 1 });
  }
  // ---------------------------------------------------------------- wreckage left in the river (shown once the blocks are down)
  const wreck = new THREE.Group(); wreck.name = 'slide-wreck'; wreck.visible = false; root.add(wreck);
  {
    const B = mkB(M), Rk = B.get('rock', 'wr'), W = B.get('win', 'wr'), Cc = B.get('concrete', 'wr'), Mt = B.get('metal', 'wr');
    for (let k = 0; k < 30; k++) {
      const x = range(SLIDE.x0 + 8, SLIDE.x1 - 8), z = range(RIVER.z0 + 4, RIVER.z0 + 50), s = 3 + r() * r() * 9;
      Rk.set({ col: earthCol([x, 30 * r(), z]), rm: [0.95, 0, 0], em: [0.03, 0.012, 0.004, DUSK + DIST.ALWAYS] });
      Rk.obox(x, WATER_Y - s * 0.35, z, s * (1 + r()), s * (0.5 + r() * 0.3), s * (0.8 + r() * 0.6), r() * 6.28, { faces: 'xXzZY', s: 1 });
    }
    for (const [x, z, w, d, h, tx, tz, yaw, col] of [[452, 196, 22, 14, 30, 0.55, 0.15, 0.3, GLASSC[0]], [503, 182, 17, 14, 22, -0.4, 0.5, -0.5, WALLC[1]], [566, 205, 20, 14, 26, 0.3, -0.45, 1.1, WALLC[3]], [410, 178, 16, 12, 14, -0.2, 0.6, 0.6, WALLC[0]]]) {
      const Mx = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(tx, yaw, tz)).setPosition(x, WATER_Y - 14, z);
      for (const A of [W, Cc, Mt]) {
        const sv = A.push(Mx);
        if (A === W) { W.set({ col, rm: [0.6, 0, 0], em: [0, 0, 0, DIST.EAST], cell: [3, 3, 7.3 + x, 0] }); W.box(-w / 2, 0, -d / 2, w / 2, h, d / 2, { faces: 'xXzZ', s: 1, wy0: 0 }); }
        else if (A === Cc) { Cc.set({ col: [0.4, 0.4, 0.41], rm: [0.9, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] }); Cc.box(-w / 2 - 0.3, h, -d / 2 - 0.3, w / 2 + 0.3, h + 0.9, d / 2 + 0.3, { faces: 'xXzZY', s: 1 }); Cc.box(-w / 2 + 2, h + 0.9, -d / 2 + 2, -w / 2 + 7, h + 4, -d / 2 + 6, { faces: 'xXzZY', s: 1 }); }
        else { Mt.set({ col: [0.2, 0.2, 0.22], rm: [0.5, 0.6, 0], em: [0, 0, 0, 0] }); for (let k = 0; k < 6; k++) Mt.beam([-w / 2 + r() * w, h - 1, -d / 2], [-w / 2 + r() * w, h + 2 + r() * 3, -d / 2 - 1 - r() * 2], 0.08, 0.08); }
        A.pop(sv);
      }
    }
    tris += B.finish(wreck).tris;
  }
  // ---- a strip of the hillside district between xa..xb, za..zb: terrace paving, retaining walls (shops, lit lines), railings,
  // lamps, lanterns, stairways, housing; the quay and river wall if it reaches the river. code = the streets' power district
  const streets = (B, reg, xa, xb, za, zb, gl, c, code) => {
  const As = B.get('asphalt', reg), Cc = B.get('concrete', reg), St = B.get('stone', reg), Mt = B.get('metal', reg);
  As.set({ col: [0.42, 0.42, 0.44], rm: [0.5, 0, 0], em: [0, 0, 0, 0] });
  Cc.set({ col: [0.56, 0.54, 0.5], rm: [0.9, 0, 0], em: em([1.0, 0.6, 0.3], 0.05, DUSK + code) });
  St.set({ col: [0.5, 0.48, 0.45], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
  Mt.set({ col: [0.22, 0.23, 0.24], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
  const occ = [];   // footprints already taken on each terrace (stairways)
  for (let k = 0; k < TERR.n; k++) {
    const z0 = tz0(k), z1 = tz0(k + 1), y = ty(k);
    if (z0 < za - 1e-3 || z0 >= zb - 1e-3) continue;
    As.box(xa, y - 0.4, z0, xb, y, z1, { faces: 'Y', s: 1 });
    // the retaining wall at the terrace's front edge, down to the next terrace (board-marked concrete, a stone base)
    const yn = k < TERR.n - 1 ? ty(k + 1) : QUAY.y;
    Cc.box(xa, yn, z1 - 0.8, xb, y, z1, { faces: 'Z', s: 1 });
    St.box(xa, yn, z1 - 0.2, xb, yn + 1.4, z1 + 0.4, { faces: 'YZ', s: 1 });
    // shops and doorways built into the wall (Chongqing's retaining walls are lived in): lit openings, a lightbox over each
    { const Sh = B.get('plain', reg), Sg = B.get('sign', reg);
      for (let x = xa + 3 + r() * 6; x < xb - 5; x += 8 + r() * 9) {
        const w = 2.6 + r() * 2.4, h = 2.8, on = r() < 0.75, col = r() < 0.6 ? [1.0, 0.62, 0.3] : [0.8, 0.9, 1.0];
        Sh.set({ col: [0.06, 0.05, 0.045], rm: [0.9, 0, 0], em: on ? em(col, 0.9, DUSK + code) : [0, 0, 0, 0], cell: [0, 0, 0, 0] });
        Sh.box(x, yn + 0.1, z1 + 0.02, x + w, yn + h, z1 + 0.03, { faces: 'Z' });
        if (on && r() < 0.7) { Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.4, DUSK + code), cell: [0, 0, 0, 0] }); signQuad(Sg, [x + w / 2, yn + h + 0.55, z1 + 0.06], [0, 0, 1], w + 0.4, 0.8, SIGN[SIGN_LIST.shops[(r() * SIGN_LIST.shops.length) | 0]]); }
        if (on) gl.push({ p: [x + w / 2, yn + 1.6, z1 + 1.2], color: [col[0] * 0.9, col[1] * 0.7, col[2] * 0.5], size: 2.2, code: DUSK + code });
      } }
    { const Le = B.get('plain', reg); Le.set({ col: [0.2, 0.18, 0.15], rm: [0.5, 0.3, 0], em: em([1.0, 0.5, 0.16], 1.1, DUSK + code), cell: [0, 0, 0, 0] });
      Le.box(xa, y - 0.75, z1 + 0.02, xb, y - 0.2, z1 + 0.14, { faces: 'yZ' });
      Le.set({ col: [0.2, 0.18, 0.15], rm: [0.5, 0.3, 0], em: em([0.9, 0.5, 0.2], 0.9, DUSK + code) });
      Le.box(xa, yn + 0.05, z1 + 0.42, xb, yn + 0.25, z1 + 0.5, { faces: 'YZ' }); }
    // its railing, its lamps, a lantern string over the street
    Mt.box(xa, y + 1.05, z1 - 0.45, xb, y + 1.13, z1 - 0.37); Mt.box(xa, y + 0.55, z1 - 0.44, xb, y + 0.6, z1 - 0.38);
    for (let x = xa + 1.2; x < xb; x += 2.4) Mt.box(x - 0.04, y, z1 - 0.44, x + 0.04, y + 1.1, z1 - 0.37);
    for (let x = xa + 6 + (k % 2) * 6; x < xb - 3; x += 14) lampPost(B, reg, x, y, z1 - 1.3, { dir: [0, 0, -1], h: 6.5, code: code, glows: gl, col: [1.0, 0.72, 0.38] });
    if ((k + c) % 2 === 0) for (let x = xa + 2.5; x < xb - 2; x += 3.4) lantern(B, reg, x, y + 5.6 + Math.sin((x - xa) / (xb - xa) * Math.PI) * -0.5, z1 - 4.2, 0.7, code, (x | 0) % 3 ? null : gl);
    occ[k] ||= [];
    // a stairway in front of the wall up to this terrace from the one below (the hill's alleys)
    if (k < TERR.n - 1) {
      const sx = xa + 8 + r() * (xb - xa - 18), n = 16;
      for (let j = 0; j < n; j++) { const yy = yn + (y - yn) * (j + 1) / n; St.box(sx, yn, z1 + 5.6 - 5.6 * (j + 1) / n, sx + 2.6, yy, z1 + 5.6 - 5.6 * j / n, { faces: 'xXYZ', s: 1 }); }
      Mt.beam([sx - 0.05, yn + 1, z1 + 5.6], [sx - 0.05, y + 1, z1], 0.05, 0.05);
      (occ[k + 1] ||= []).push([sx - 1.5, sx + 4.2]);
      if (r() < 0.6) tree(B, reg, sx + 5, yn, z1 + 3.5, 0.75 + r() * 0.3, seed++);
    }
  }
  // ---- the housing: stacked blocks against the wall behind each terrace, roofs at (or past) the street above,
  // shops in the podiums, names on a few roofs. Windows split between the generators and the dead grid.
  for (let k = 0; k < TERR.n; k++) {
    const z0 = tz0(k), y = ty(k);
    if (z0 < za - 1e-3 || z0 >= zb - 1e-3) continue;
    const taken = (occ[k] || []).concat(TOWERS.filter(t => t.c === c && k === 0).map(t => [t.x0 - 2, t.x1 + 2]), SHELLS.filter(S => S.c === c && k === 0).map(S => [S.x0 - 1, S.x1 + 1]));
    let x = xa + 1 + r() * 2;
    while (x < xb - 9) {
      const w = Math.min(xb - 1 - x, 12 + r() * 10), xe = x + w;
      if (taken.some(([a, b]) => xe > a && x < b)) { x += 3; continue; }
      // low on the slope (2-4 storeys: the terraces, their walls and street lights stay readable from the river), a few taller
      const d = k === 0 ? 7 + r() * 2 : 8 + r() * 3, n = k === 0 ? 4 + Math.floor(r() * 6) : (r() < 0.15 ? 5 + Math.floor(r() * 3) : 2 + Math.floor(r() * 3)), h = n * 3;
      const t = { x0: x, z0: z0 + 0.6, x1: xe, z1: z0 + 0.6 + d, y0: y, h, style: r() < 0.65 ? 0 : 2, podium: k > 0 && n > 4 && r() < 0.6, plinth: 0, seed: seed++,
        crown: h > 26 && r() < 0.35 ? 'frame' : null, ledCol: [1.0, 0.82, 0.55], roofSign: h > 24 && r() < 0.22 ? SIGN_LIST.roofs[(r() * SIGN_LIST.roofs.length) | 0] : null, signN: [0, 0, 1], dist: r() < 0.38 ? code : DIST.EAST };
      towerBlock(B, t, reg, gl);
      x = xe + 2.5 + r() * 3;
    }
  }
  // the quay and its river wall (bottom row)
  if (zb >= ZF - 0.01) {
    As.box(xa, QUAY.y - 0.5, TERR.quay, xb, QUAY.y, RIVER.z0, { faces: 'Y', s: 1 });
    Cc.box(xa, WATER_Y - 3, RIVER.z0, xb, QUAY.y + 0.05, ZF, { faces: 'YZ', s: 1 });
    Cc.box(xa, QUAY.y, RIVER.z0 - 0.4, xb, QUAY.y + 1.0, RIVER.z0, { faces: 'yYzZ', s: 1 });
    const L = B.get('plain', reg);
    for (let x = -1380; x < 1580; x += 28) {
      if (x <= xa || x >= xb) continue;
      const z = RIVER.z0 - 0.8;
      Mt.set({ col: [0.25, 0.26, 0.27], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] });
      Mt.cyl(x, QUAY.y, z, 0.1, 0.07, QUAY.y + 6.5, 6, { cap: false }); Mt.beam([x, QUAY.y + 6.4, z], [x, QUAY.y + 6.6, z - 1.4], 0.12, 0.12);
      L.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em(SODIUM, 3, DUSK + code) }); L.box(x - 0.25, QUAY.y + 6.25, z - 1.65, x + 0.25, QUAY.y + 6.4, z - 1.1);
      gl.push({ p: [x, QUAY.y + 6.1, z - 1.4], color: [2.4, 1.3, 0.5], size: 2.6, code: DUSK + code, far: true, quay: true });
    }
  }
  };
  // ---------------------------------------------------------------- the district carries on east of the slide (static, on
  // its own generators: it stays lit, so the gap the slide tears in it reads)
  {
    const B = mkB(M), gl = [];
    for (let rw = 0; rw < 3; rw++) streets(B, 'nb', HILLE.x0 + RIMW[rw], HILLE.x0 + 56, SLIDE.rows[rw], rw === 2 ? ZF : SLIDE.rows[rw + 1], gl, -1, DIST.ALWAYS);
    for (let x = HILLE.x0 + 56; x < HILLE.x1 - 1; x += 56) streets(B, 'nb', x, Math.min(HILLE.x1, x + 56), C0, ZF, gl, -1, DIST.ALWAYS);
    // the hill's east end: a rock face where it meets the old bank (both ways, wherever one stands above the other)
    const A = B.get('rock', 'nb'); A.set({ rm: [0.92, 0, 0], em: [0, 0, 0, 0] });
    const Hp = hillProfile(C0, ZF), Bp = bankProfile(HILLE.x1), bankAt = (z) => { for (let i = 1; i < Bp.length; i++) if (Bp[i][1] >= z) return Bp[i][0]; return QUAY.y; };
    for (const dir of [1, -1]) { const n = Hp.length - 1; gridFace(A, (u, v) => { const i = Math.min(n - 1, Math.floor(u * n)), f = u * n - i, a2 = Hp[dir > 0 ? n - i : i], b2 = Hp[dir > 0 ? n - i - 1 : i + 1], zz = a2[1] + (b2[1] - a2[1]) * f, hy = a2[0] + (b2[0] - a2[0]) * f, by = bankAt(zz), lo = Math.min(hy, by), hi = Math.max(hy, by); return [HILLE.x1, lo + (hi - lo) * v, zz]; }, n, 1, { colFn: rockCol }); }
    tris += B.finish(root).tris;
    for (const q of gl) glows.push({ ...q, far: true, prio: 1 });
  }
  // ---------------------------------------------------------------- the quay shelf west of Jinlong (under the plaza's cliff):
  // it was 34 m of bare road. A riverside street on a low terrace: houses against the cliff, shops in the wall, lamps,
  // lanterns (on Jinlong's generators, so it stays lit after the blackout)
  {
    const B = mkB(M), gl = [];
    for (let x = 176; x < 315; x += 70) streets(B, 'wq', x, Math.min(316, x + 70), TERR.z0 + TERR.d * (TERR.n - 1), TERR.quay, gl, -1, DIST.TOWER);
    tris += B.finish(root).tris;
    for (const q of gl) glows.push({ ...q, far: true });
  }
  // ---------------------------------------------------------------- the blocks
  const blocks = [], bones = [], skin = {};
  const rows = SLIDE.rows;
  for (const t of TOWERS) t.c = colOf((t.x0 + t.x1) / 2);
  for (const S of SHELLS) S.c = colOf((S.x0 + S.x1) / 2);
  for (let c = 0; c < COLS.length - 1; c++) for (let rw = 0; rw < 3; rw++) {
    const xa = COLS[c], xb = COLS[c + 1], za = ROWSC[c][rw], zb = rw === 2 ? rows[3] : ROWSC[c][rw + 1], cx = (xa + xb) / 2, cz = (za + zb) / 2;
    const pv = new THREE.Vector3(cx, (hillY(cz) + scarY0(cz)) / 2, cz);
    const grp = new THREE.Bone(); grp.name = `slide${c}_${rw}`; grp.position.copy(pv); root.add(grp); bones.push(grp);
    const bi = bones.length - 1, B = mkB(M), reg = 'b' + c + rw, gl = [];
    // ---- the ground: underside (slip surface), sides, back + front breaks, terrace paving, retaining walls
    const R = B.get('rock', reg); R.set({ rm: [0.92, 0, 0], em: [0, 0, 0, 0] });
    gridFace(R, (u, v) => { const x = xa + (xb - xa) * u, z = za + (zb - za) * v; return [x, Math.min(scarY(x, z), hillY(z) - 0.6) - 0.05, z]; }, Math.round((xb - xa) / 6), Math.round((zb - za) / 4), { colFn: earthCol });
    const P = hillProfile(za, zb);
    sideFace(R, xa, -1, P); sideFace(R, xb, 1, P);
    if (rw > 0) crossFace(R, za, xa, xb, -1, hillY(za + 1e-3));                         // back break (faces up-slope)
    if (rw < 2) crossFace(R, zb, xa, xb, 1, hillY(zb + 1e-3));                          // front break below the next terrace
    streets(B, reg, xa, xb, za, zb, gl, c, CODE);
    // the crest buildings' front halves (top row)
    if (rw === 0) SHELLS.forEach((S, k) => { if (S.c === c) shellHalf(B, reg, S, false, 77 + k * 13); });
    // ---- the towers (top row): child bones in two segments, broken at a floor line
    const towers = [];
    if (rw === 0) for (const t of TOWERS.filter(t => t.c === c)) {
      const bp = new THREE.Vector3((t.x0 + t.x1) / 2, Y0, t.z1 + 2);
      const tg = new THREE.Bone(); tg.name = grp.name + 't'; tg.position.copy(bp).sub(pv); grp.add(tg); bones.push(tg);
      const fl = t.style === 1 || t.style === 4 ? 3.9 : 3.0, hb = Math.round(t.h * (0.42 + r() * 0.16) / fl) * fl, yb = Y0 + hb, ts = seed++;
      const Bt = mkB(M), tgl = [];
      towerBlock(Bt, { ...t, h: hb, crown: null, roofSign: null, corners: false, y0: Y0, seed: ts, podium: true, plinth: 7, dist: DIST.EAST, signN: [0, 0, 1], bands: 0 }, reg + 't', tgl);
      breakCap(Bt, reg + 't', t, yb, false);
      tris += collect(Bt, bones.length - 1, skin);
      const ubp = new THREE.Vector3((t.x0 + t.x1) / 2, yb, t.z1);
      const ug = new THREE.Bone(); ug.name = tg.name + 'u'; ug.position.copy(ubp).sub(bp); tg.add(ug); bones.push(ug);
      const Bu = mkB(M), ugl = [];
      const top = towerBlock(Bu, { ...t, h: t.h - hb, y0: yb, seed: ts, podium: false, plinth: 0, dist: DIST.EAST, signN: [0, 0, 1], bands: 0 }, reg + 'u', ugl).top;
      breakCap(Bu, reg + 'u', t, yb, true);
      tris += collect(Bu, bones.length - 1, skin);
      for (const q of tgl) gl.push({ ...q, _obj: tg, _pv: bp });
      for (const q of ugl) gl.push({ ...q, _obj: ug, _pv: ubp });
      towers.push({ grp: tg, ug, pv: bp, upv: ubp.clone(), h: top - Y0, phi: t.phi, d: t.d, roll: t.roll, fold: t.fold, top: new THREE.Vector3(bp.x, top, (t.z0 + t.z1) / 2).sub(ubp), wet: false, groan: false, snap: false });
    }
    tris += collect(B, bi, skin);
    const bg = [];
    for (const q of gl) {
      const obj = q._obj || grp, piv = q._pv || pv, p = q.p.isVector3 ? q.p.clone() : new THREE.Vector3(...q.p);
      const G = { ...q, p, local: p.clone().sub(piv), obj, slide: true, far: true, prio: 1 };
      delete G._obj; delete G._pv;
      glows.push(G); bg.push(G);
    }
    blocks.push({ c, rw, xa, xb, za, zb, grp, pv, towers, glows: bg,
      front: new THREE.Vector3(cx, hillY(zb - 1e-3), zb).sub(pv), back: new THREE.Vector3(cx, hillY(za + 1e-3), za).sub(pv),
      delay: Math.abs(cx - IMPACT_X) / 55 + [1.7, 0.8, 0][rw] + 0.5 + r() * 1.1, acc: 3.0 + r() * 2.2, pitch: [0.2, 0.28, 0.26][rw] + r() * 0.16, yaw: range(-0.22, 0.22), roll: (r() < 0.5 ? -1 : 1) * range(0.08, 0.28), drop: range(2, 8),
      wet: false, hidden: false, last: new THREE.Vector3(), vel: new THREE.Vector3(), arced: false });
  }
  for (let rw = 0; rw < 3; rw++) {
    const xa = SLIDE.x1, xb = xa + RIMW[rw], za = rows[rw], zb = rw === 2 ? ZF : rows[rw + 1], cx = (xa + xb) / 2, cz = (za + zb) / 2;
    const pv = new THREE.Vector3(cx, hillY(cz) - 7, cz);
    const grp = new THREE.Bone(); grp.name = 'rim' + rw; grp.position.copy(pv); root.add(grp); bones.push(grp);
    const bi = bones.length - 1, B = mkB(M), reg = 'r' + rw, gl = [];
    const R = B.get('rock', reg); R.set({ rm: [0.92, 0, 0], em: [0, 0, 0, 0] });
    gridFace(R, (u, v) => { const x = xa + (xb - xa) * u, z = za + (zb - za) * v; return [x, rimBot(x, z), z]; }, 4, 10, { colFn: earthCol });
    const P = hillProfile(za, zb);
    sideFace(R, xa, -1, P, { bot: rimBot }); sideFace(R, xb, 1, P, { bot: rimBot });
    crossFace(R, za, xa, xb, -1, hillY(za + 1e-3), earthCol, rimBot);
    if (rw < 2) crossFace(R, zb, xa, xb, 1, hillY(zb + 1e-3), earthCol, rimBot);
    streets(B, reg, xa, xb, za, zb, gl, -1, DIST.ALWAYS);
    tris += collect(B, bi, skin);
    const bg = [];
    for (const q of gl) { const p = q.p.isVector3 ? q.p.clone() : new THREE.Vector3(...q.p); const G = { ...q, p, local: p.clone().sub(pv), obj: grp, slide: true, far: true, prio: 1 }; glows.push(G); bg.push(G); }
    blocks.push({ rim: true, c: 4, rw, xa, xb, za, zb, grp, pv, towers: [], glows: bg, delay: [7.5, 5.8, 6.6][rw], drop: [8, 11, 7][rw], roll: [0.3, 0.42, 0.34][rw], dx: [5, 10, 7][rw], pitch: [0.06, 0.12, 0.2][rw], yaw: [0.15, -0.21, 0.18][rw],
      front: new THREE.Vector3(), back: new THREE.Vector3(), wet: false, hidden: false, last: new THREE.Vector3(), vel: new THREE.Vector3(), arced: false });
  }
  root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(bones);
  for (const { mat, geos } of Object.values(skin)) {
    const m = new THREE.SkinnedMesh(mergeGeometries(geos, false), mat);
    m.name = 'slide-' + mat.userData.key; m.frustumCulled = false; m.receiveShadow = true;
    root.add(m); m.bind(skel, new THREE.Matrix4());
  }
  // the river's answer: swell rings rolling out from where each block goes in, a silt stain per column
  const rings = [], silts = [];
  const rg = new THREE.RingGeometry(0.955, 1, 96); rg.rotateX(-Math.PI / 2);
  const sg = new THREE.CircleGeometry(1, 48); sg.rotateX(-Math.PI / 2);
  { const P = sg.attributes.position, C = new Float32Array(P.count * 4); for (let i = 0; i < P.count; i++) { const d = Math.hypot(P.getX(i), P.getZ(i)); C.set([1, 1, 1, d < 0.01 ? 1 : 0], i * 4); } sg.setAttribute('color', new THREE.Float32BufferAttribute(C, 4)); }
  for (let k = 0; k < 12; k++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xc9c6bd, transparent: true, opacity: 0, depthWrite: false, fog: true })); m.position.y = WATER_Y + 0.12; m.scale.setScalar(1e-3); m.renderOrder = 3; root.add(m); rings.push({ m, t: -1 }); }
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x33261a, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: true })); m.position.y = WATER_Y + 0.08; m.scale.setScalar(1e-3); m.renderOrder = 2; root.add(m); silts.push({ m, t: -1 }); }
  return { root, anchors: { glows, named: { slide: { root, blocks, wreck, rings, silts, scarFires: glows.filter(g => g.scarFire) } } }, tris };
}

// =====================================================================================
//  The simulation. All blocks shudder, then go one by one (toe-first, east-first): a slump, then an
//  accelerating slide down the slope, steepening into the river, pitching forward as they go. The
//  towers topple off their block, fold at the break and snap. Dust boils out of every opening gap
//  and rolls off the leading edges; each block that hits the water throws spray and a swell ring.
// =====================================================================================
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Euler(), _m4 = new THREE.Matrix4();
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SLUMP = 2.0, DIRS = [new THREE.Vector3(0, -0.75, 0.66), new THREE.Vector3(0, -0.6, 0.8), new THREE.Vector3(0, -0.5, 0.866)];
export class Landslide {
  constructor(g, S) { this.g = g; this.S = S; this.T = -1; this.audio = g.audio; }
  get active() { return this.T >= 0; }
  // c0: the column it starts from (the gunship's impact): the hill lets go there first, then outward from it
  start(fast = false, c0 = null) {
    if (this.T >= 0 || !this.S) return;
    this.T = 0;
    // from the impact column outward, tighter than the default east-first run (the whole hill is moving within ~5 s)
    void c0;   // (the pieces' delays already run outward from IMPACT_X, the crest tower the gunship hits)
    const g = this.g;
    POWER.pow.value[CODE] = 1; POWER.cut.value[CODE] = 9999;
    if (fast) {
      this.T = 60; for (const B of this.S.blocks) { if (B.rim) { this._rim(B, 60); B.grp.updateMatrixWorld(true); for (const gl of B.glows) gl.p.copy(gl.local).applyMatrix4(gl.obj.matrixWorld); } else this._hide(B); }
      SLIDE.gone = true; for (const gl of this.S.scarFires) gl.dead = false; this._columns(); this._wreck();
      this.S.silts.forEach((Sl, i) => { const x0 = SLIDE.cuts[i], x1 = SLIDE.cuts[i + 1]; Sl.t = 30; Sl.m.position.set((x0 + x1) / 2, WATER_Y + 0.08, RIVER.z0 + 26); Sl.m.scale.set(104, 1, 80); Sl.m.material.opacity = 0.35; });
      return;
    }
    const cx = (SLIDE.x0 + SLIDE.x1) / 2;
    this.audio.play('collapse_rumble', { x: cx, y: 40, z: 100, volume: 1 });
    this.audio.play('metal_groan', { x: cx + 60, y: 40, z: 90, volume: 1, pitch: 0.7 });
    // the crest cracks open (it runs from the east end toward the tower), dust jets, the mains arcing
    for (let k = 0; k <= 10; k++) {
      const x = SLIDE.x1 - (SLIDE.x1 - SLIDE.x0) * k / 10;
      g.fx.later(k * 0.12 + rand() * 0.1, () => {
        this._dust(x + range(-6, 6), Y0 + 1, C0 + range(-1, 2), range(-2, 2), range(7, 12), range(-1, 2), 7, 34, range(10, 14));
        if (k % 3 === 1) this._arc(_v.set(x, Y0 - 0.5, C0 + 0.5));
      });
    }
    g.lastExplosionT = g.time; g.lastExplosionShake = 0.45;
    g.events.push({ type: 'slide' });
  }
  // something stuck in a tower (the gunship's wreck): it rides that tower's upper segment down the slope
  attach(obj, P) {
    let best = null, bd = 1e9;
    for (const B of this.S?.blocks || []) for (const t of B.towers) { const d = Math.hypot(t.upv.x - P.x, t.upv.z - P.z); if (d < bd) { bd = d; best = { B, t }; } }
    if (!best) return null;
    const { B, t } = best, local = P.clone().sub(t.upv);
    t.ug.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(t.ug.matrixWorld).invert();
    obj.updateMatrixWorld(true);
    const M = new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld);
    t.ug.add(obj); M.decompose(obj.position, obj.quaternion, obj.scale);
    return { world: (out) => B.hidden ? null : out.copy(local).applyMatrix4(t.ug.matrixWorld), B, t };
  }
  _arc(p) {
    const g = this.g, d = p.distanceTo(g.headPos), sz = 2 + d * 0.03;
    g.fx.main.spawn({ x: p.x, y: p.y, z: p.z, frame: CELL.FLASH, s0: sz, s1: sz * 1.8, life: 0.12, r: 2.6, g: 2.4, b: 2.6, fadeIn: 0, fadeOut: 0.5 });
    for (let k = 0; k < 16; k++) g.fx.sparks.spawn({ x: p.x, y: p.y, z: p.z, vx: range(-7, 7), vy: range(0, 9), vz: range(-7, 7), grav: 9.8, drag: 0.15, frame: CELL.SPARK, s0: 1 + d * 0.004, w: 0.05 + d * 0.0003, len: 0.2, life: range(0.5, 1.4), r: 2.2, g: 2.6, b: 3.4, a: 1, fadeOut: 0.4 });
    if (d < 400) this.audio.play('impact_metal', { x: p.x, y: p.y, z: p.z, volume: 0.6, pitch: 1.8 });
  }
  // a rim piece: it loses the hill beside it, drops, tilts into the scar and stays hanging there
  _rim(B, T) {
    const tau = T - B.delay;
    if (tau <= 0) { const k = ss(0, 1.5, T); B.grp.position.copy(B.pv); B.grp.position.y += Math.sin(T * 39 + B.rw * 2) * 0.06 * k; B.grp.quaternion.identity(); return tau; }
    const k = 1 - Math.pow(1 - Math.min(1, tau / 3.2), 2), j = tau < 3.2 ? Math.sin(T * 31 + B.rw) * 0.12 * (1 - k) : 0;
    B.grp.position.set(B.pv.x - B.dx * k, B.pv.y - B.drop * k + j, B.pv.z + 1.5 * k);
    _e.set(B.pitch * k, B.yaw * k, B.roll * k, 'XYZ'); B.grp.quaternion.setFromEuler(_e);
    return tau;
  }
  _pose(B, T) {
    const tau = T - B.delay;
    if (tau <= 0) {   // the whole hill shudders and settles a little before it goes
      const k = ss(0, 1.5, T);
      B.grp.position.copy(B.pv); B.grp.position.y += -0.5 * k + Math.sin(T * 41 + B.c * 2 + B.rw) * 0.07 * k;
      B.grp.quaternion.identity(); return { tau, s: 0 };
    }
    const k = ss(0, SLUMP, tau), sg = Math.max(0, tau - SLUMP), s = Math.min(260, 0.5 * B.acc * sg * sg + 1.5 * sg);
    B.grp.position.copy(B.pv).addScaledVector(DIRS[B.rw], s);
    B.grp.position.y -= 0.5 + B.drop * k + 0.4 * Math.max(0, s - 30);
    B.grp.position.z += 0.8 * k;
    if (tau < SLUMP) B.grp.position.y += Math.sin(T * 37 + B.c) * 0.1 * (1 - k);
    _e.set(0.12 * k + B.pitch * ss(6, 90, s), B.yaw * (0.3 * k + 0.7 * ss(0, 70, s)), B.roll * (0.55 * k + 0.45 * ss(8, 100, s)), 'XYZ');
    B.grp.quaternion.setFromEuler(_e);
    for (const t of B.towers) {
      const u = ss(t.d + 0.6, t.d + 5.5, tau);
      _e.set(t.phi * u * u, 0, t.roll * u, 'XYZ'); t.grp.quaternion.setFromEuler(_e);
      const f = ss(t.d + 2.2, t.d + 5.6, tau); _e.set(t.fold * f * f, 0, -t.roll * 0.6 * f, 'XYZ'); t.ug.quaternion.setFromEuler(_e);
    }
    return { tau, s };
  }
  _hide(B) { B.hidden = true; B.grp.scale.setScalar(1e-4); B.grp.updateMatrixWorld(true); for (const gl of B.glows) this._killGlow(gl); }
  _killGlow(gl) { gl.dead = true; const refl = this.g.world._refl; if (refl && gl._refl >= 0) { refl.set(gl._refl, { intensity: 0 }); gl._refl = -1; } }
  _wreck() { if (this.S.wreck) this.S.wreck.visible = true; }
  _columns() { const C = this.g.smokeColumns; if (C && !this._cols) { this._cols = true; C.push([420, 30, 100, 1.3], [520, 20, 125, 1.5], [570, 45, 64, 1.0]); } }
  _splash(x0, x1, z, k) {
    const g = this.g, n = Math.max(2, Math.round((x1 - x0) / 14));
    for (let j = 0; j <= n; j++) {
      const x = x0 + (x1 - x0) * j / n;
      g.fx.later(j * 0.06 + rand() * 0.08, () => {
        for (let i = 0; i < 2; i++) { const s0 = range(9, 14) * k; g.clouds.spawn({ x: x + range(-5, 5), y: WATER_Y + range(5, 10), z: z + range(-3, 7), vx: range(-3, 3), vy: range(14, 26) * k, vz: range(2, 7), drag: 0.8, buoy: 0.3, s0, s1: s0 * range(3.2, 4.2), life: range(6, 8), a: 0.65, fadeIn: 0.04, fadeOut: 0.6, r: 0.25, g: 0.2, b: 0.14, r1: 0.19, g1: 0.16, b1: 0.12, glow: 0.3, glowFade: 2 }); }
        for (let i = 0; i < 16; i++) g.fx.main.spawn({ x: x + range(-7, 7), y: WATER_Y + 1, z: z + range(-3, 8), vx: range(-4, 4), vy: range(10, 22) * k, vz: range(0, 6), grav: 9.8, drag: 0.6, frame: CELL.WISP, s0: 5 * k, s1: 16 * k, life: range(1.8, 2.8), rot: rand() * 6, r: 0.4, g: 0.34, b: 0.26, a: 0.4, fadeOut: 0.6 });
      });
    }
  }
  // a big rolling cloud of dust (brown-grey, lit from below by the fires)
  _dust(x, y, z, vx, vy, vz, s0, s1, life = range(14, 18)) {
    this.g.clouds.spawn({ x, y, z, vx, vy, vz, drag: 0.55, buoy: 0.12, s0, s1, life, a: 0.88, fadeIn: 0.06, fadeOut: 0.5, r: 0.22, g: 0.15, b: 0.08, r1: 0.2, g1: 0.15, b1: 0.1, glow: 1.0, glowFade: 5 });
  }
  _ring(x, z, k, delay) { const R = this.S.rings.find(q => !q.go); if (R) { R.go = true; R.t = -delay - 1e-3; R.k = k; R.m.position.set(x, WATER_Y + 0.12, z); } }
  update(dt) {
    if (this.T < 0 || !this.S) return;
    const g = this.g, T0 = this.T; this.T += dt; const T = this.T;
    for (const R of this.S.rings) {
      if (!R.go) continue; R.t += dt; if (R.t < 0) continue;
      const u = R.t / 7; if (u >= 1) { R.go = false; R.m.material.opacity = 0; R.m.scale.setScalar(1e-3); continue; }
      const rad = 6 + 150 * (1 - Math.pow(1 - u, 2)); R.m.scale.set(rad, 1, rad * 0.8);
      R.m.material.opacity = 0.2 * R.k * (1 - u) * Math.min(1, R.t * 4);
    }
    for (const Sl of this.S.silts) if (Sl.t >= 0) { Sl.t += dt; const u = Math.min(1, Sl.t / 14), rad = 10 + 70 * Math.sqrt(u); Sl.m.scale.set(rad * 1.3, 1, rad); Sl.m.material.opacity = 0.5 * Math.min(1, Sl.t / 2) * (1 - 0.3 * u); }
    if (T > 45) return;
    let live = 0;
    for (const B of this.S.blocks) {
      if (B.rim) {
        if (T > B.delay + 5) continue;
        const tau = this._rim(B, T); B.grp.updateMatrixWorld(true);
        for (const gl of B.glows) if (!gl.dead) { gl.p.copy(gl.local).applyMatrix4(gl.obj.matrixWorld); const refl = g.world._refl; if (refl && gl._refl >= 0) refl.set(gl._refl, { p: gl.p.toArray() }); }
        if (tau > 0 && !B.arced) { B.arced = true; this.audio.play('collapse_impact', { x: B.xa, y: hillY(B.za) , z: (B.za + B.zb) / 2, volume: 0.9, pitch: 0.9 + B.rw * 0.1 }); this._arc(_v.set(B.xa + 2, hillY((B.za + B.zb) / 2) + 5, (B.za + B.zb) / 2).clone()); }
        if (tau > 0 && tau < 3.5 && rand() < dt * 3) this._dust(B.xa + range(-4, 6), hillY(range(B.za, B.zb)) - range(2, 10), range(B.za, B.zb), range(-5, -1), range(2, 6), range(-1, 2), 8, range(26, 36), range(8, 11));
        if (tau > 0 && tau < 4 && rand() < dt * 10) g.fx.spawnDebris(new THREE.Vector3(B.xa + range(-2, 3), hillY(range(B.za, B.zb)) - range(0, 8), range(B.za, B.zb)), range(-8, -2), range(-1, 5), range(-2, 4), range(0.8, 2.2), rand() < 0.1);
        continue;
      }
      if (B.hidden) continue;
      live++;
      B.last.copy(B.grp.position);
      const { tau } = this._pose(B, T);
      B.grp.updateMatrixWorld(true);
      B.vel.copy(B.grp.position).sub(B.last).divideScalar(Math.max(1e-3, dt));
      const W = B.grp.matrixWorld;
      for (const gl of B.glows) {
        if (gl.dead) continue;
        gl.p.copy(gl.local).applyMatrix4(gl.obj.matrixWorld);
        const refl = g.world._refl; if (refl && gl._refl >= 0) refl.set(gl._refl, { p: gl.p.toArray() });
        if (gl.p.y < WATER_Y + (gl.quay ? 6.5 : -0.3)) this._killGlow(gl);
      }
      if (tau <= 0) continue;
      const wk = (B.xb - B.xa) / 55;
      const front = _v.copy(B.front).applyMatrix4(W), fx = front.x, fy = front.y, fz = front.z;
      const back = _w.copy(B.back).applyMatrix4(W), by = back.y, bz = back.z;
      const local = (x, y, z) => _v.set(x - B.pv.x, y - B.pv.y, z - B.pv.z).applyMatrix4(W);
      // the power lines between the terraces snap
      if (!B.arced && tau > 0.4) { B.arced = true; this._arc(local(range(B.xa + 6, B.xb - 6), hillY(B.zb - 1) + 6, B.zb - 2).clone()); }
      // dust boiling out of the gap opening behind it (the head scarp for the top row), and off its leading edge
      if (tau > SLUMP + 0.6 && tau < 10 && rand() < dt * wk * (B.rw === 0 ? 0.8 : 0.3)) this._dust(range(B.xa, B.xb), by - range(0, 8), bz + range(-2, 4), range(-2, 2), range(7, 12), range(-2, 1), 10, range(40, 56));
      if (tau > SLUMP + 1.2 && fy > WATER_Y + 4 && rand() < dt * 0.3 * wk) this._dust(range(B.xa, B.xb), fy - range(0, 6), fz - range(0, 4), B.vel.x * 0.3 + range(-2, 2), range(3, 6), range(0, 2), 10, range(34, 46));
      // the rolling front: low, wide dust pushed ahead of the moving toe (it is what says 'the ground is moving')
      if (tau > SLUMP * 0.6 && fy > WATER_Y - 2 && rand() < dt * 1.3 * wk) { const p = g.clouds.spawn({ x: range(B.xa, B.xb), y: fy + range(0, 4), z: fz + range(3, 9), vx: range(-1, 1), vy: range(0.5, 2.5), vz: B.vel.z * 0.9 + range(2, 5), drag: 0.6, buoy: 0.05, s0: range(8, 11), s1: range(22, 30), life: range(6, 8), a: 0.6, fadeIn: 0.05, fadeOut: 0.55, r: 0.24, g: 0.17, b: 0.1, r1: 0.2, g1: 0.16, b1: 0.12, glow: 0.7, glowFade: 4, st: 2.0 }); void p; }
      // rock and wreckage pouring off its front; fires catching in the housing
      if (tau > 0.6 && fy > WATER_Y + 2 && rand() < dt * 14 * wk) g.fx.spawnDebris(new THREE.Vector3(range(B.xa, B.xb), fy + range(-2, 1), fz + range(0, 2)), B.vel.x + range(-3, 3), B.vel.y + range(-1, 4), B.vel.z + range(1, 6), range(0.8, 2.2), rand() < 0.12);
      if (tau > 1 && fy > WATER_Y + 4 && rand() < dt * 1.5 * wk) { const zz = range(B.za + 2, B.zb - 2); g.fx.flame(local(range(B.xa + 4, B.xb - 4), hillY(zz) + 2, zz).clone(), range(1.4, 2.4)); }
      // into the river: spray across its width, a swell ring, the silt stain for its column
      if (!B.wet && fy < WATER_Y + 1 && tau > SLUMP * 0.5) {
        B.wet = true;
        const z = Math.max(RIVER.z0 + 6, fz);
        this._splash(B.xa, B.xb, z, B.rw === 2 ? 1.5 : 1.7);
        const Sl = this.S.silts[Math.min(3, Math.floor(((B.xa + B.xb) / 2 - SLIDE.x0) / 55.5))]; if (Sl && Sl.t < 0) { Sl.t = 0; Sl.m.position.set((B.xa + B.xb) / 2, WATER_Y + 0.08, z + 12); }
        for (let j = 0, nj = Math.max(1, Math.round(3 * wk)); j < nj; j++) g.fx.later(0.2 + j * 0.15, () => this._dust(B.xa + (B.xb - B.xa) * (j + 0.5) / nj + range(-4, 4), WATER_Y + range(4, 9), z + range(0, 6), range(-3, 3), range(2, 4), range(3, 6), 14, range(45, 60), range(10, 14)));
        if (rand() < 0.5) this.audio.play('collapse_impact', { x: fx, y: 2, z, volume: 1, pitch: 0.8 + rand() * 0.3 });
        if (B.rw === 2 && B.c === COLS.length - 2) this.audio.play('explosion_big', { x: fx, y: 2, z, volume: 0.9, pitch: 0.7 });
        g.lastExplosionT = g.time; g.lastExplosionShake = 0.4;
        g.events.push({ type: 'slideWater', c: B.c, rw: B.rw });
      }
      if (B.wet && fy > WATER_Y - 6 && rand() < dt * 0.8 * wk) {
        const s0 = range(9, 13);
        g.clouds.spawn({ x: range(B.xa, B.xb), y: WATER_Y + 3, z: Math.max(RIVER.z0 + 4, fz) + range(0, 6), vx: range(-3, 3), vy: range(5, 11), vz: range(2, 7), drag: 0.7, buoy: 0.3, s0, s1: s0 * 3.5, life: range(6, 8), a: 0.6, fadeIn: 0.04, fadeOut: 0.6, r: 0.23, g: 0.19, b: 0.14, r1: 0.18, g1: 0.15, b1: 0.12, glow: 0.3, glowFade: 2 });
      }
      // the towers: a groan, the snap at the break, glass, and the splash when the top goes in
      for (const t of B.towers) {
        const u = tau - t.d - 0.6;
        if (u > 0 && !t.groan) { t.groan = true; this.audio.play('metal_groan', { x: t.pv.x, y: 100, z: t.pv.z, volume: 0.9, pitch: 0.8 + B.c * 0.08 }); }
        if (tau > t.d + 2.2 && !t.snap) {
          t.snap = true; const b = _w.set(0, 0, -7).applyMatrix4(t.ug.matrixWorld).clone();
          for (let j = 0; j < 4; j++) this._dust(b.x + range(-8, 8), b.y + range(-2, 2), b.z + range(-6, 6), range(-3, 3), range(1, 4), range(0, 4), 6, range(24, 34), range(9, 12));
          for (let j = 0; j < 14; j++) g.fx.spawnDebris(b.clone().add(_v.set(range(-9, 9), 0, range(-7, 7))), range(-6, 6), range(2, 9), range(-2, 8), range(0.6, 1.8), false);
          g.glass.burst?.(b.clone(), new THREE.Vector3(0, 0.3, 1), 14, { spread: 8, speed: 5, size: 0.4, life: 10 });
          this.audio.play('metal_groan', { x: b.x, y: b.y, z: b.z, volume: 1, pitch: 1.1 }); this.audio.play('collapse_impact', { x: b.x, y: b.y, z: b.z, volume: 0.6, pitch: 1.3 });
        }
        const top = _v.copy(t.top).applyMatrix4(t.ug.matrixWorld);
        if (u > 0 && top.y > WATER_Y + 4 && rand() < dt * 1.5) {
          const p = _w.set(range(-8, 8), range(10, t.h * 0.5), range(-2, 2)).applyMatrix4(t.grp.matrixWorld);
          g.glass.burst?.(p.clone(), new THREE.Vector3(range(-1, 1), 0.2, 1), 14, { spread: 3, speed: 3, size: 0.35, life: 10 });
          if (rand() < 0.3) this.audio.play('impact_glass', { x: p.x, y: p.y, z: p.z, volume: 0.5, pitch: range(0.7, 1) });
        }
        if (!t.wet && top.y < WATER_Y + 2) {
          t.wet = true;
          this._splash(top.x - 12, top.x + 12, Math.max(RIVER.z0 + 4, top.z), Math.min(1.5, 0.6 + t.h / 120));
          this.audio.play('collapse_impact', { x: top.x, y: 2, z: top.z, volume: 1, pitch: 0.85 });
        }
      }
      // gone: under the water (or long enough after it went that it must be)
      if (tau > 22 || (tau > SLUMP + 2 && fy < WATER_Y - 6 && by < WATER_Y - 4 && B.towers.every(t => _w.copy(t.top).applyMatrix4(t.ug.matrixWorld).y < WATER_Y - 3))) this._hide(B);
    }
    if (T0 < 12 && T >= 12) SLIDE.gone = true;
    if (T0 < 15 && T >= 15) { for (const gl of this.S.scarFires) gl.dead = false; this._columns(); }
    if (!this._wr && !live) { this._wr = true; this._wreck(); SLIDE.gone = true; }
  }
}
