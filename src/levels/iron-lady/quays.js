import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { WATER_Y, LOW_Y, LOWQ, RAMP_N, RAMP_S, BRIDGE, PARK, LEGS, PONTOON, CARS } from './layout.js';
import {
  Bk, LightField, finalize, materials, addGeo, surf, prof, quadRU, quad4, decal, wallDecal, seg, beam,
  M4, BOX, CYL, SPH, RBOX, LATHE, TOR, CONE, A, D, RM, COL, TS, TC, TA, TG, TL, Z3,
  sstep, lerp, mul, mix3, steps, brk, wn, wfbm,
} from './quays-kit.js';

// =====================================================================================
//  THE IRON LADY — quays, bridge, tower park, far bridges (buildQuays). World space; every
//  walkable surface follows layout.groundAt exactly (lower quays LOW_Y, ramps, street 0).
//  Static geometry is merged per material (stone, cobbles, asphalt, gravel, greens, props
//  atlas, autumn leaves, ground decals, puddles + the carousel's turning platform). Lamp light
//  is baked into a per-vertex emission channel (light pools on the wet ground, warm walls and
//  canopies) and the lamps are handed back as glow / reflection / lamp anchors.
// =====================================================================================

const X0 = -900, X1 = 1100;                 // quays run the length of the river
const FINE0 = -150, FINE1 = 430;           // detailed stretch (2 m vertex spacing)
const WET = 0.62;                          // wet albedo darkening
const LAMP_C = [2.7, 1.75, 0.85];          // glow colour of the gas-style lanterns
const LAMP_L = [1.0, 0.74, 0.46];          // baked light colour
const REFL_C = [1.6, 1.0, 0.48];
const RAMPN_LAND = RAMP_N.xHigh - 6, RAMPS_LAND = RAMP_S.xHigh - 6;   // 24, 64
const STAIRS = [[400, 1], [-200, 1], [404, -1], [-196, -1]];          // scenery stairs [xTop, bank]
const PED = { x0: 14.3, x1: 17.7, z0: 52.3, z1: 55.7 };              // bridge-end pedestals (|x|, |z|)

// x breakpoints: fine through the play area, coarser outward
function xsRange(a, b, extra = [], st = 2) {
  const pts = [a, b, ...extra];
  for (let x = Math.ceil(a / st) * st; x <= b; x += st) if (x >= FINE0 && x <= FINE1) pts.push(x);
  for (let x = Math.ceil(a / 10) * 10; x <= b; x += 10) if ((x >= FINE0 - 120 && x < FINE0) || (x > FINE1 && x <= FINE1 + 160)) pts.push(x);
  for (let x = Math.ceil(a / 40) * 40; x <= b; x += 40) pts.push(x);
  return brk(pts).filter((x) => x >= a - 1e-6 && x <= b + 1e-6);
}
const rampNY = (x) => (x <= RAMP_N.xHigh ? 0 : LOW_Y * (x - RAMP_N.xHigh) / (RAMP_N.xLow - RAMP_N.xHigh));
const rampSY = (x) => (x <= RAMP_S.xHigh ? 0 : LOW_Y * (x - RAMP_S.xHigh) / (RAMP_S.xLow - RAMP_S.xHigh));

// ---------------------------------------------------------------------- colour functions
function stoneCol(p, { base = [0.7, 0.67, 0.62], y0 = LOW_Y, top = 0, water = false, k = 1 } = {}) {
  const [x, y, z] = p;
  let m = 0.9 + 0.2 * wfbm(x * 0.03 + z * 0.03, y * 0.05 + 11);
  const st = wfbm(x * 0.07 + z * 0.05, y * 0.02 + 5);                       // broad vertical weathering bands
  m *= 1 - 0.22 * sstep(0.5, 0.75, st);
  m *= 1 - 0.25 * Math.exp(-Math.max(0, top - y) * 1.6);                   // damp band under the cornice
  m *= 0.45 + 0.55 * sstep(y0, y0 + 1.8, y);                                // splash grime at the foot
  let c = mul(base, m * WET * k);
  if (water) {
    const alg = 1 - sstep(LOW_Y - 1.6, LOW_Y - 0.3, y);
    c = mix3(c, [0.11, 0.13, 0.08], alg * 0.75);
    c = mix3(c, [0.04, 0.05, 0.035], 1 - sstep(WATER_Y + 0.1, WATER_Y + 0.7, y));
  }
  return c;
}
function cobbleCol(p) {
  const [x, , z] = p, az = Math.abs(z);
  let m = 0.82 + 0.36 * wfbm(x * 0.06, z * 0.11 + 4) + 0.12 * (wn(x * 0.5, z * 0.5) - 0.5);
  if (az > 40 && az < 53) m *= 1 - 0.32 * Math.exp(-(52 - az) * 1.5) - 0.18 * Math.exp(-(az - 40.7) * 2);
  return mul([0.74, 0.74, 0.74], m * WET);
}
function asphCol(p, light = false) {
  const [x, , z] = p;
  const m = 0.85 + 0.3 * wfbm(x * 0.04, z * 0.08 + 9) + 0.08 * (wn(x * 0.4, z * 0.4) - 0.5);
  return mul(light ? [1.05, 1.02, 0.98] : [0.86, 0.85, 0.84], m);
}
function gravelCol(p) {
  const [x, , z] = p;
  let m = 0.8 + 0.4 * wfbm(x * 0.05, z * 0.05 + 2) + 0.12 * (wn(x * 0.7, z * 0.7) - 0.5);
  m *= 1 - 0.38 * sstep(0.52, 0.7, wfbm(x * 0.09 + 3, z * 0.09));          // rain-soaked low patches
  if (z < -78) { const ax = Math.abs(x); m *= 1 + 0.16 * (1 - sstep(4, 7, ax)) + 0.1 * (1 - sstep(1.5, 3, Math.abs(ax - 51.5))); }   // compacted allées
  return mul([1.35, 1.24, 1.04], m * 0.82);
}

// ---------------------------------------------------------------------- shared builder state
function mkState(ctx) {
  const B = { stone: new Bk(), cobble: new Bk(), asph: new Bk(), gravel: new Bk(), green: new Bk(), props: new Bk(), leaves: new Bk(), decal: new Bk(), puddle: new Bk(), spin: new Bk() };
  return { ctx, B, field: new LightField(), glows: [], reflect: [], lamps: [], colliders: [], rng: makeRng(5150) };
}
function pud(S, x, y, z, w, l, rot, rect) { decal(S.B.puddle, x, y, z, w, l, rot, rect, [0.025, 0.027, 0.032], [0.03, 0.0, 0.5]); }
const RT = (n) => [n[2], 0, -n[0]];   // quad right axis for a vertical quad facing n
const col = (S, min, max, mat = 'concrete', extra = {}) => S.colliders.push({ min, max, data: { mat, kind: 'prop', ...extra } });
function light(S, p, r, k, c = LAMP_L) { S.field.add({ p, c, r: r * 1.1, k: k * 2.2 }); }
function glow(S, p, size, color = LAMP_C, extra = {}) { S.glows.push({ p, color, size, dusk: true, ...extra }); }
function refl(S, p, ground, len, width = 1.0, extra = {}) { S.reflect.push({ p, color: REFL_C, len, width, ground, ...extra }); }

// ---------------------------------------------------------------------- lamps
// a cast-iron lantern: glass centre at (x, y, z), s = scale
function lantern(S, x, y, z, s = 1, bk = S.B.props, lod = 0) {
  const I = { col: COL.iron, rm: RM.iron };
  if (!lod) addGeo(bk, CONE(0.06 * s, 0.2 * s, 4), M4(x, y - 0.3 * s, z, Math.PI), I);
  addGeo(bk, CYL(0.215 * s, 0.13 * s, 0.4 * s, 6, true), M4(x, y, z), { rect: A.lantern, col: [1, 0.86, 0.62], rm: RM.glow, e: [2.3, 2.0, 1.6] });
  addGeo(bk, CONE(0.13 * s, 0.001, 6), M4(x, y - 0.2 * s, z, Math.PI), { col: [1, 0.86, 0.62], rm: RM.glow, e: [3.0, 2.4, 1.7] });
  addGeo(bk, CONE(0.29 * s, 0.3 * s, 6), M4(x, y + 0.35 * s, z), I);
}
// double-lantern quay candelabra on the tree sidewalk (crossbar along x)
function quayLamp(S, x, z, detail = true) {
  const P = S.B.props, I = { col: COL.iron, rm: RM.iron };
  addGeo(P, LATHE([[0.32, 0], [0.3, 0.45], [0.22, 0.55], [0.26, 0.75], [0.135, 0.82], [0.12, 1.0]], 7), M4(x, 0, z), I);
  addGeo(P, CYL(0.1, 0.12, 2.3, 7, true), M4(x, 2.15, z), I);
  for (const y of [2.0, 3.2]) addGeo(P, CYL(0.15, 0.15, 0.07, 7, true), M4(x, y, z), I);
  addGeo(P, CYL(0.17, 0.1, 0.2, 7, true), M4(x, 3.33, z), I);
  beam(P, [x - 0.68, 3.42, z], [x + 0.68, 3.42, z], 0.07, 0.07, I);
  if (detail) for (const sx of [-1, 1]) addGeo(P, TOR(0.2, 0.028, 3, 5, Math.PI * 0.9), M4(x + sx * 0.36, 3.2, z, 0, 0, sx > 0 ? -0.3 : Math.PI + 0.3), I);
  addGeo(P, CONE(0.06, 0.4, 5), M4(x, 3.75, z), I);
  for (const sx of [-1, 1]) {
    const lx = x + sx * 0.68;
    lantern(S, lx, 3.78, z, 1.05);
    if (!detail) continue;
  }
  glow(S, [x - 0.68, 3.8, z], 0.95); glow(S, [x + 0.68, 3.8, z], 0.95);
  light(S, [x, 3.9, z], 14, 2.0);
  refl(S, [x, 3.8, z], 0, 9, 1.3);
  S.lamps.push([x, 3.8, z]);
  col(S, [x - 0.3, 0, z - 0.3], [x + 0.3, 4.2, z + 0.3], 'metal', { thin: true });
}
// park / quay single lantern on a fluted post
function postLamp(S, x, y0, z, { h = 3.4, glowSize = 1.15, k = 1.5, r = 12 } = {}) {
  const P = S.B.props, I = { col: COL.iron, rm: RM.iron };
  addGeo(P, CYL(0.18, 0.24, 0.55, 8), M4(x, y0 + 0.27, z), I);
  addGeo(P, CYL(0.075, 0.1, h - 0.6, 8), M4(x, y0 + 0.55 + (h - 0.6) / 2, z), I);
  for (const y of [1.0, h - 0.4]) addGeo(P, CYL(0.12, 0.12, 0.06, 8), M4(x, y0 + y, z), I);
  addGeo(P, CYL(0.13, 0.08, 0.16, 8), M4(x, y0 + h - 0.05, z), I);
  lantern(S, x, y0 + h + 0.36, z, 1.0);
  glow(S, [x, y0 + h + 0.38, z], glowSize);
  light(S, [x, y0 + h + 0.4, z], r, k);
  refl(S, [x, y0 + h + 0.38, z], y0, (h + 0.4) * 2.2, 1.1);
  S.lamps.push([x, y0 + h + 0.38, z]);
  col(S, [x - 0.24, y0, z - 0.24], [x + 0.24, y0 + h, z + 0.24], 'metal', { thin: true });
}
// wall lantern on a swan-neck bracket (retaining wall face at |z| = 52, facing the river)
function wallLantern(S, x, y, s, lod = 0) {
  const P = S.B.props, I = { col: COL.iron, rm: RM.iron }, zw = s * 52;
  addGeo(P, BOX(0.32, 0.5, 0.06), M4(x, y + 0.1, zw - s * 0.03), I);
  const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6, a = t * Math.PI * 0.55; pts.push([x, y + 0.25 - Math.cos(a) * 0.05 + Math.sin(t * Math.PI) * 0.18, zw - s * (0.05 + t * 0.78)]); }
  for (let k = 0; k < pts.length - 1; k += lod ? 2 : 1) seg(P, pts[k], pts[Math.min(pts.length - 1, k + (lod ? 2 : 1))], 0.035, 0.03, 4, I);
  if (!lod) seg(P, [x, y - 0.12, zw - s * 0.05], [x, y + 0.18, zw - s * 0.45], 0.022, 0.022, 3, I);
  const lz = zw - s * 0.86;
  seg(P, [x, y + 0.3, lz], [x, y + 0.52, lz], 0.02, 0.02, 3, I);
  lantern(S, x, y - 0.12, lz, 0.95, P, lod);
  glow(S, [x, y - 0.1, lz], 1.05);
  light(S, [x, y, lz - s * 0.2], 11.5, 1.75);
  const g = groundY(x, lz);
  if (g === LOW_Y) refl(S, [x, y - 0.1, lz], g, (y - g) * 2.4, 1.0);
  S.lamps.push([x, y - 0.1, lz]);
}
const groundY = (x, z) => {
  const az = Math.abs(z);
  if (az > 40 && az < 52) { if (z > 0 && z > 46 && x > RAMPN_LAND && x < RAMP_N.xLow) return rampNY(x); if (z < 0 && z < -46 && x > RAMPS_LAND && x < RAMP_S.xLow) return rampSY(x); return LOW_Y; }
  return 0;
};
// bridge candelabra: three lanterns on a column standing on a balustrade dado
function bridgeLamp(S, x, z) {
  const P = S.B.props, I = { col: COL.bronze, rm: RM.bronze }, y0 = 1.25, sx = Math.sign(x);
  addGeo(P, CYL(0.3, 0.36, 0.4, 8), M4(x, y0 + 0.2, z), I);
  addGeo(P, LATHE([[0.26, 0], [0.18, 0.2], [0.11, 0.35], [0.13, 0.55], [0.085, 0.75]], 8), M4(x, y0 + 0.4, z), I);
  addGeo(P, CYL(0.075, 0.095, 2.4, 8), M4(x, y0 + 2.35, z), I);
  for (const y of [1.9, 2.9, 3.55]) addGeo(P, CYL(0.13, 0.13, 0.07, 8), M4(x, y0 + y, z), I);
  beam(P, [x, y0 + 3.0, z - 0.78], [x, y0 + 3.0, z + 0.78], 0.07, 0.07, I);
  for (const sz of [-1, 1]) addGeo(P, TOR(0.24, 0.03, 3, 7, Math.PI * 0.9), M4(x, y0 + 2.78, z + sz * 0.42, 0, sz > 0 ? Math.PI / 2 : -Math.PI / 2, 0.3), I);
  for (const sz of [-1, 1]) lantern(S, x, y0 + 3.35, z + sz * 0.78, 0.95);
  glow(S, [x, y0 + 3.38, z], 2.0, LAMP_C);
  addGeo(P, CYL(0.06, 0.1, 0.4, 8), M4(x, y0 + 3.75, z), I);
  lantern(S, x, y0 + 4.25, z, 1.15); glow(S, [x, y0 + 4.28, z], 1.4);
  light(S, [x - sx * 0.6, y0 + 3.9, z], 15, 2.3);
  refl(S, [x, y0 + 4.0, z], 0, 11, 1.4);
  refl(S, [x + sx * 0.6, y0 + 4.0, z], WATER_Y, 26, 1.6, { water: true });
  S.lamps.push([x, y0 + 4.0, z]);
  col(S, [x - 0.36, 0, z - 0.36], [x + 0.36, 5.8, z + 0.36], 'metal', { thin: true });
}

// ---------------------------------------------------------------------- lower quays (both banks)
function lowerQuays(S) {
  const { stone, cobble } = S.B;
  for (const s of [1, -1]) {
    const runs = s > 0
      ? [[X0, -16, 40.7, 52], [-16, 16, 40.7, 46], [16, RAMPN_LAND, 40.7, 52], [RAMPN_LAND, RAMP_N.xLow, 40.7, 45.55], [RAMP_N.xLow, X1, 40.7, 52]]
      : [[X0, -16, 40.7, 52], [-16, 16, 40.7, 46], [16, RAMPS_LAND, 40.7, 52], [RAMPS_LAND, RAMP_S.xLow, 40.7, 45.55], [RAMP_S.xLow, X1, 40.7, 52]];
    // cobbled berge (pavés) + a smoother flagstone gutter strip along the wall foot
    for (const [a, b, z0, z1] of runs) {
      const zs = brk(steps(z0, Math.min(z1, 51.1), 1.6), [z0, Math.min(z1, 51.1)]);
      surf(cobble, xsRange(a, b), zs.map((z) => s * z), (x, z) => [x, LOW_Y, z], { n: () => [0, 1, 0], ws: TC, col: cobbleCol, rm: RM.cobble });
      if (z1 > 51.5) surf(stone, xsRange(a, b), [s * 51.1, s * 52], (x, z) => [x, LOW_Y + 0.004, z], { n: () => [0, 1, 0], ws: TS, col: (p) => mul(stoneCol(p, { base: [0.6, 0.58, 0.55] }), 0.7), rm: RM.wet });
    }
    // coping along the quay edge: flat top, bullnose, then the river wall down into the water
    const xsE = xsRange(X0, X1, [-16, 16], 4), xsEW = xsRange(X0, X1, [-16, 16], 3);
    const eCol = (p) => stoneCol(p, { base: [0.84, 0.8, 0.72], y0: LOW_Y - 0.6, top: LOW_Y, water: true, k: 1.05 });
    prof(stone, xsE, [[0.7, 0], [0.04, 0], [0, -0.06], [-0.035, -0.17], [0, -0.3], [0.03, -0.36]], (u, a, b) => [u, LOW_Y + b, s * (40 + a)], (na, nb) => [0, nb, s * na], { col: eCol, rm: RM.wet, uv: (p, n, u, av) => [u / TS, av / TS] });
    const ys = [LOW_Y - 0.36, LOW_Y - 1.2, -6.55, WATER_Y + 0.15, WATER_Y - 3];
    surf(stone, xsEW, ys, (x, y) => [x, y, s * 40.03], { n: () => [0, 0, -s], ws: TS, col: (p) => stoneCol(p, { y0: WATER_Y, top: LOW_Y, water: true }), rm: RM.wet });
    // retaining wall at |z| = 52 up to the street, string course, parapet (with gaps)
    const xsW = [...xsRange(X0, -16), ...xsRange(16, X1)];
    const wys = [LOW_Y, LOW_Y + 0.45, LOW_Y + 1.5, -2.6, -0.32];
    const wCol = (p) => stoneCol(p, { y0: groundY(p[0], s * 51.5), top: -0.32 });
    for (const [a, b] of [[X0, -13.6], [13.6, X1]]) surf(stone, xsRange(a, b, [], 3), wys, (x, y) => [x, y, s * 52], { n: () => [0, 0, -s], ws: TS, col: wCol, rm: RM.stone });
    // string course (moulded band)
    for (const [a, b] of [[X0, -16], [16, X1]]) prof(stone, xsRange(a, b, [], 4), [[0, -0.34], [-0.1, -0.34], [-0.14, -0.27], [-0.24, -0.16], [-0.25, -0.04], [-0.06, 0]], (u, aa, bb) => [u, bb, s * (52 + aa)], (na, nb) => [0, nb, s * na], { col: (p) => stoneCol(p, { k: 1.08, top: 0.2 }), rm: RM.stone });
    // wall-foot shadow / grime decal + moss + rain streak decals on the wall
    const rr = S.rng;
    for (let x = 18; x < 380; x += 6) decal(S.B.decal, x + 3, LOW_Y + 0.012, s * 51.25, 6.2, 1.6, 0, D.aoRect, [0.7, 0.7, 0.7]);
    for (let x = -14; x > -500; x -= 8) decal(S.B.decal, x - 4, LOW_Y + 0.012, s * 51.25, 8.2, 1.6, 0, D.aoRect, [0.7, 0.7, 0.7]);
    for (let x = -300; x < 520; x += 4 + rr() * 9) {
      if (x > -18 && x < 18) continue;
      const g = groundY(x, s * 51.9), h = 1.5 + rr() * 3.2, w = 0.6 + rr() * 1.6;
      wallDecal(S.B.decal, [x, -0.34 - h / 2, s * 51.985], [0, 0, -s], [0, 1, 0], w, h, rr() < 0.5 ? D.streak : D.streak2, [1, 1, 1]);
      if (rr() < 0.3 && g < -4) wallDecal(S.B.decal, [x + 2, g + 0.55, s * 51.985], [0, 0, -s], [0, -1, 0], 2.5 + rr() * 2, 1.1, D.moss, [1, 1, 1]);
    }
    // quay-wall waterline streaks (river face)
    for (let x = -400; x < 600; x += 5 + rr() * 7) wallDecal(S.B.decal, [x, LOW_Y - 0.4 - 0.7, s * 40.0], [0, 0, -s], [0, 1, 0], 0.8 + rr() * 1.5, 1.4, D.streak2, [1, 1, 1]);
  }
  // graffiti on the walls near the bridge and the ramps (VR-readable size)
  // (x 28 on the north side used to sit past the top of the north ramp, where there is no wall: the clamp below
  // lifted it to ~1.4 m over the street, a floating scribble in the bridge fight. It's at the ramp's foot now.)
  for (const [x, y, s, w] of [[70, -3.8, 1, 5.5], [80, -3.6, 1, 4.6], [150, -3.9, 1, 3.8], [36, -4.0, -1, 5], [120, -3.7, -1, 4.2], [-40, -3.8, 1, 5], [-60, -3.7, -1, 4.5]]) {
    const y0 = Math.max(groundY(x - w / 2, s * 51.5), groundY(x + w / 2, s * 51.5)), h = w * 0.37;
    if (Math.max(y, y0 + 1.1) + h / 2 > -0.6) continue; // no wall left above the ground here: never float it
    wallDecal(S.B.decal, [x, Math.max(y, y0 + 1.1), s * 51.98], [0, 0, -s], [0, 1, 0], w, w * 0.37, D.graffiti, [1, 1, 1]);
  }
  // the outer bridge arch spans the lower quay; it is walled in under the bridge (fill wall at |x| 13.6 with a
  // service door) and fronted by a stone plinth at |x| 14..16 that closes the walkable quay at x = ±16
  for (const s of [1, -1]) for (const sx of [1, -1]) {
    const xf = sx * 13.6, outer = s > 0 ? ARCHES[4] : ARCHES[0];
    const zs = steps(s * 40.4, s * 52, 0.8);
    surf(S.B.stone, zs, [0, 0.2, 0.5, 1], (z, v) => [xf, lerp(LOW_Y, archY(z, outer) + 0.02, v), z], { n: () => [sx, 0, 0], ws: TS, col: (p) => mul(stoneCol(p, { k: 0.85, top: -1 }), 0.6), rm: [0.9, -0.6, 1] });
    // plinth (1.1 m) with coping, and its river end
    const pc = (p) => stoneCol(p, { k: 1.0, top: LOW_Y + 1.1 });
    addGeo(S.B.stone, BOX(2.4, 1.0, 11.4), M4(sx * 14.8, LOW_Y + 0.5, s * 46.3), { ws: TS, col: pc, rm: RM.stone });
    addGeo(S.B.stone, BOX(2.6, 0.14, 11.6), M4(sx * 14.8, LOW_Y + 1.07, s * 46.3), { ws: TS, col: (p) => stoneCol(p, { k: 1.18, top: 3 }), rm: RM.wet });
    const zc = s * 44.6;
    addGeo(S.B.props, BOX(0.12, 2.3, 1.3), M4(xf + sx * 0.04, LOW_Y + 1.15 + 0.0, zc), { col: [0.05, 0.06, 0.055], rm: RM.iron });
    for (let k = 0; k < 4; k++) addGeo(S.B.props, BOX(0.03, 0.06, 1.3), M4(xf + sx * 0.11, LOW_Y + 0.35 + k * 0.6, zc), { col: [0.03, 0.035, 0.03], rm: RM.iron });
    addGeo(S.B.stone, BOX(0.2, 0.3, 1.8), M4(xf + sx * 0.08, LOW_Y + 2.45, zc), { ws: TS, col: (p) => stoneCol(p, { k: 1.1 }), rm: RM.stone });
    quadRU(S.B.props, [xf + sx * 0.02, LOW_Y + 2.2, zc + s * 2.4], RT([sx, 0, 0]), [0, 1, 0], 1.6, 0.4, A.quaiSign, COL.white, RM.paint);
    quadRU(S.B.props, [sx * 16.01, LOW_Y + 0.6, s * 47.5], RT([sx, 0, 0]), [0, 1, 0], 1.3, 0.32, A.plaque, COL.white, RM.paint);
    wallDecal(S.B.decal, [xf + sx * 0.02, LOW_Y + 1.6, s * 49.0], [sx, 0, 0], [0, 1, 0], 3.2, 3.0, D.streak, [1, 1, 1]);
    wallDecal(S.B.decal, [sx * 16.01, LOW_Y + 0.45, s * 43.0], [sx, 0, 0], [0, -1, 0], 4.0, 0.9, D.moss, [1, 1, 1]);
    decal(S.B.decal, sx * 16.9, LOW_Y + 0.012, s * 46, 2.0, 11.4, 0, D.aoRect, [0.7, 0.7, 0.7]);
    wallLanternX(S, xf, LOW_Y + 3.0, s * 42.8, sx);
  }
}
function farWallLamp(S, x, s) {
  const y = LOW_Y + 3.2, lz = s * 51.2;
  addGeo(S.B.props, CYL(0.2, 0.13, 0.4, 4, true), M4(x, y, lz), { col: [1, 0.86, 0.62], rm: RM.glow, e: [2.3, 2.0, 1.6] });
  addGeo(S.B.props, CONE(0.27, 0.28, 4), M4(x, y + 0.33, lz), { col: COL.iron, rm: RM.iron });
  addGeo(S.B.props, BOX(0.06, 0.06, 0.8), M4(x, y + 0.3, s * 51.6), { col: COL.iron, rm: RM.iron });
  glow(S, [x, y, lz], 1.05, LAMP_C, { far: true });
  light(S, [x, y, lz - s * 0.2], 11.5, 1.75);
  if (x > -200 && x < 520) refl(S, [x, y, lz], LOW_Y, 7, 1.0);
}
// wall lantern on a face normal to x
function wallLanternX(S, xw, y, z, sx) {
  const P = S.B.props, I = { col: COL.iron, rm: RM.iron };
  addGeo(P, BOX(0.06, 0.5, 0.32), M4(xw + sx * 0.03, y + 0.1, z), I);
  seg(P, [xw + sx * 0.05, y + 0.3, z], [xw + sx * 0.8, y + 0.42, z], 0.035, 0.03, 5, I);
  seg(P, [xw + sx * 0.05, y - 0.1, z], [xw + sx * 0.5, y + 0.38, z], 0.022, 0.022, 4, I);
  lantern(S, xw + sx * 0.82, y - 0.05, z, 0.95);
  glow(S, [xw + sx * 0.82, y - 0.03, z], 1.05);
  light(S, [xw + sx * 1.1, y, z], 11, 1.7);
  refl(S, [xw + sx * 0.82, y - 0.03, z], LOW_Y, 6, 1.0);
  S.lamps.push([xw + sx * 0.82, y - 0.03, z]);
}

// ---------------------------------------------------------------------- ramps + scenery stairs
function ramps(S) {
  const { stone, cobble } = S.B;
  for (const s of [1, -1]) {
    const land = s > 0 ? RAMPN_LAND : RAMPS_LAND, xLow = s > 0 ? RAMP_N.xLow : RAMP_S.xLow, xHigh = s > 0 ? RAMP_N.xHigh : RAMP_S.xHigh;
    const ry = s > 0 ? rampNY : rampSY;
    const xs = brk(steps(land, xHigh, 1.5), steps(xHigh, xLow, 1.5));
    // pavés on the ramp (rows run up the slope), a flagstone gutter at the wall foot
    surf(cobble, xs, brk(steps(46.0, 51.1, 1.2)).map((z) => s * z), (x, z) => [x, ry(x), z], { hint: [0, 1, 0], ws: TC, col: cobbleCol, rm: RM.cobble, uv: (p) => [p[2] / TC, p[0] / TC] });
    surf(stone, xs, [s * 51.1, s * 52], (x, z) => [x, ry(x) + 0.004, z], { hint: [0, 1, 0], ws: TS, col: (p) => mul(stoneCol(p, { base: [0.6, 0.58, 0.55] }), 0.7), rm: RM.wet });
    // river-side wall: lower-quay face, coping (1.0 m above the ramp), ramp-side face
    const zO = s * 45.55, zI = s * 46.0, top = (x) => ry(x) + 1.0;
    surf(stone, xs, [0, 0.12, 0.4, 0.7, 1], (x, v) => [x, lerp(LOW_Y, top(x) - 0.12, v), zO], { n: () => [0, 0, -s], ws: TS, col: (p) => mul(stoneCol(p, { top: top(p[0]) - 0.12 }), 0.85), rm: [0.8, -0.55, 1] });
    surf(stone, xs, [0, 1], (x, v) => [x, lerp(ry(x), top(x) - 0.12, v), zI], { n: () => [0, 0, s], ws: TS, col: (p) => stoneCol(p, { y0: ry(p[0]), top: top(p[0]) }), rm: RM.stone });
    prof(stone, xs, [[-0.06, -0.12], [-0.06, -0.02], [0.0, 0.0], [0.45, 0.0], [0.51, -0.02], [0.51, -0.12]], (u, a, b) => [u, top(u) + b, s * (45.55 + a)], (na, nb) => [0, nb, s * na], { col: (p) => stoneCol(p, { k: 1.12, top: 2 }), rm: RM.wet });
    // low end post + high end wall closing the landing toward the bridge
    addGeo(stone, BOX(0.6, 1.25, 0.6), M4(xLow + 0.1, LOW_Y + 0.62, s * 45.78), { ws: TS, col: (p) => stoneCol(p, { k: 1.05 }), rm: RM.stone });
    addGeo(stone, BOX(0.7, 0.25, 0.7), M4(xLow + 0.1, LOW_Y + 1.35, s * 45.78), { ws: TS, col: (p) => stoneCol(p, { k: 1.15 }), rm: RM.wet });
    surf(stone, [45.55, 52].map((z) => s * z), [LOW_Y, LOW_Y + 0.5, -3, -1, 0.88], (z, y) => [land, y, z], { n: () => [-1, 0, 0], ws: TS, col: (p) => stoneCol(p, { top: 0.88 }), rm: RM.stone });
    surf(stone, [46, 52].map((z) => s * z), [0, 0.88], (z, y) => [land + 0.45, y, z], { n: () => [1, 0, 0], ws: TS, col: (p) => stoneCol(p, { y0: 0, top: 0.88 }), rm: RM.stone });
    prof(stone, [45.5, 52].map((z) => s * z), [[-0.06, -0.12], [-0.06, -0.02], [0, 0], [0.45, 0], [0.51, -0.02], [0.51, -0.12]], (u, a, b) => [land + a, 0.88 + 0.12 + b, u], (na, nb) => [na, nb, 0], { col: (p) => stoneCol(p, { k: 1.12, top: 2 }), rm: RM.wet });
    col(S, [land, LOW_Y, s > 0 ? 45.55 : -52], [land + 0.45, 1.0, s > 0 ? 52 : -45.55], 'concrete', { kind: 'wall' });
    postLamp(S, land + 0.22, 1.0, s * 45.78, { h: 2.6, glowSize: 1.1, k: 1.6, r: 13 });
    // ramp-top slot drain + puddles collecting at the low end
    decal(S.B.decal, xHigh - 1, 0.012, s * 49, 0.5, 5.4, 0, D.drain);
    pud(S, xLow - 3, LOW_Y + 0.014, s * 49.5, 4.5, 2.6, 0.2, D.puddle);
    pud(S, (xHigh + xLow) / 2, ry((xHigh + xLow) / 2) + 0.02, s * 51.3, 5.5, 1.2, 0, D.puddle2);
  }
  // scenery stairs further out (descend along +x against the retaining wall)
  for (const [xt, s] of STAIRS) {
    const n = 32, rise = -LOW_Y / n, run = 0.34;
    for (let k = 0; k < n; k++) {
      const y = -rise * (k + 1), x0 = xt + k * run;
      addGeo(stone, BOX(run, 0.18, 2.6), M4(x0 + run / 2, y + 0.09 - 0.09, s * 50.7), { ws: TS, col: (p) => stoneCol(p, { base: [0.72, 0.68, 0.6], k: 0.95, top: 2 }), rm: RM.wet });
      addGeo(stone, BOX(run, rise * (k + 1) - 0.18 + 0.01, 0.02), M4(x0 + run / 2, LOW_Y + (rise * (n - k - 1)) / 2, s * 49.4), { ws: TS, col: (p) => stoneCol(p), rm: RM.stone });
    }
    const xb = xt + n * run;
    const top = (x) => Math.max(LOW_Y, -rise * (x - xt) / run) + 1.0;
    const xs = steps(xt, xb, 1.0);
    surf(stone, xs, [0, 1], (x, v) => [x, lerp(LOW_Y, top(x), v), s * 49.0], { n: () => [0, 0, -s], ws: TS, col: (p) => stoneCol(p, { top: top(p[0]) }), rm: RM.stone });
    prof(stone, xs, [[0, 0], [0.42, 0]], (u, a, b) => [u, top(u) + b, s * (49 + a)], () => [0, 1, 0], { col: (p) => stoneCol(p, { k: 1.1, top: 2 }), rm: RM.wet });
  }
}

// ---------------------------------------------------------------------- parapet runs
function parapetGaps(s) {
  const g = [[-PED.x1, PED.x1]];
  if (s > 0) g.push([RAMPN_LAND, RAMP_N.xHigh + 2]); else g.push([RAMPS_LAND, RAMP_S.xHigh + 2]);
  for (const [xt, b] of STAIRS) if (b === s) g.push([xt - 2.2, xt]);
  return g.sort((a, b) => a[0] - b[0]);
}
function parapets(S) {
  const { stone } = S.B;
  for (const s of [1, -1]) {
    const gaps = parapetGaps(s), runs = [];
    let x = X0;
    for (const [a, b] of gaps) { runs.push([x, a]); x = b; }
    runs.push([x, X1]);
    for (const [a, b] of runs) {
      const xs = xsRange(a, b, [], 3);
      const pc = (p) => stoneCol(p, { y0: 0, top: 0.86, k: 1.02 });
      surf(stone, xs, [0, 0.86], (x, y) => [x, y, s * 52], { n: () => [0, 0, -s], ws: TS, col: pc, rm: RM.stone });
      surf(stone, xs, [0, 0.86], (x, y) => [x, y, s * 52.6], { n: () => [0, 0, s], ws: TS, col: pc, rm: RM.stone });
      prof(stone, xsRange(a, b, [], 4), [[-0.07, 0.86], [-0.07, 0.94], [-0.03, 1.0], [0.63, 1.0], [0.67, 0.94], [0.67, 0.86]], (u, aa, bb) => [u, bb, s * (52 + aa)], (na, nb) => [0, nb, s * na], { col: (p) => stoneCol(p, { k: 1.18, top: 3 }), rm: RM.wet });
      for (const xe of [a, b]) if (xe > X0 + 1 && xe < X1 - 1) addGeo(stone, BOX(0.5, 1.12, 0.78), M4(xe + (xe === a ? 0.25 : -0.25), 0.56, s * 52.3), { ws: TS, col: (p) => stoneCol(p, { k: 1.1 }), rm: RM.stone });
      if (b - a > 0.5) col(S, [Math.max(a, -400), 0, s > 0 ? 52 : -52.6], [Math.min(b, 600), 1.0, s > 0 ? 52.6 : -52], 'concrete', { kind: 'parapet' });
    }
  }
}

// ---------------------------------------------------------------------- upper quays: roads, sidewalks, curbs, markings
function curbX(S, xs, z, side) {
  // granite curb band along x at |z| (side: +1 = sidewalk toward +z)
  prof(S.B.stone, xs, [[-0.22, 0.0], [-0.18, 0.065], [0.14, 0.065], [0.18, 0]], (u, a, b) => [u, b, z + side * a], (na, nb) => [0, nb, side * na], { col: (p) => mul([0.5, 0.49, 0.48], (0.8 + 0.3 * wn(p[0] * 0.6, 7)) * WET * 1.1), rm: RM.wet });
}
function curbZ(S, zs, x, side) {
  prof(S.B.stone, zs, [[-0.22, 0.0], [-0.18, 0.065], [0.14, 0.065], [0.18, 0]], (u, a, b) => [x + side * a, b, u], (na, nb) => [side * na, nb, 0], { col: (p) => mul([0.5, 0.49, 0.48], (0.8 + 0.3 * wn(p[2] * 0.6, 3)) * WET * 1.1), rm: RM.wet, uv: (p, n, u, av) => [u / TS, av / TS] });
}
function paintLine(S, x0, z0, x1, z1, w, dash = 0, gap = 0, colr = [0.9, 0.9, 0.86]) {
  const L = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / L, dz = (z1 - z0) / L, rot = Math.atan2(-dx, -dz) + Math.PI;
  const step = dash ? dash + gap : 3, n = Math.floor(L / step);
  for (let k = 0; k < n; k++) {
    const l = dash || step, t = k * step + l / 2;
    decal(S.B.decal, x0 + dx * t, 0.012, z0 + dz * t, w, l, rot, S.rng() < 0.5 ? D.line : D.line2, colr, [0.55, 0, 1]);
  }
}
function upperQuays(S) {
  const { asph, gravel, stone } = S.B, r = S.rng;
  for (const s of [1, -1]) {
    // tree sidewalk (stabilised sand / gravel), road, far sidewalk
    for (const [a, b] of [[X0, -9.5], [9.5, X1]]) {
      const xs = xsRange(a, b);
      if (!(a === 9.5 || b === -9.5) || true) {
        const ws = xs.filter((x) => Math.abs(x) >= 9.5);
        const wsT = brk(ws.filter((x) => Math.abs(x) >= 14), [a < 0 ? -14 : 14]).filter((x) => x >= a && x <= b);
        surf(gravel, wsT, [52.6, 54.5, 56.4, 57.8].map((z) => s * z), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TG, col: (p) => mul(gravelCol(p), 0.5), rm: [0.9, 0, 0.45] });
      }
      surf(asph, xs, [57.8, 58.4, 61, 65, 69, 71.8].map((z) => s * z), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p), rm: RM.asph });
      surf(asph, xs.filter((x) => Math.abs(x) >= 9.5 && (Math.abs(x) < 300 || Math.round(x) % 4 === 0)), [72.2, 75, 78.3].map((z) => s * z), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p, true), rm: RM.asph });
    }
    // through the bridge head (|x| < 9.5): road continues from the bridge into the quay road
    surf(asph, steps(-9.5, 9.5, 1.9), [52, 54, 56, 57.8].map((z) => s * z), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p), rm: RM.asph });
    surf(asph, steps(-9.5, 9.5, 1.9), [57.8, 60, 64, 68, 71.8].map((z) => s * z), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p), rm: RM.asph });
    // bridge-head sidewalk corners (9.5..14 between parapet line and the quay curb)
    for (const sx of [-1, 1]) surf(stone, [14, PED.x1 + 0.2].map((x) => sx * x), [52, 52.6].map((z) => s * z), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TS, col: (p) => mul([0.62, 0.6, 0.57], 0.9 * WET), rm: RM.wet });
    for (const sx of [-1, 1]) surf(stone, [9.5, 14].map((x) => sx * x), [52, 55, 57.8].map((z) => s * z), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TS, col: (p) => mul([0.62, 0.6, 0.57], (0.85 + 0.25 * wfbm(p[0] * 0.1, p[2] * 0.1)) * WET), rm: RM.wet });
    // curbs
    curbX(S, xsRange(X0, X1, [], 4), s * 58, -s);
    curbX(S, xsRange(X0, -9.5, [], 4), s * 72, s); curbX(S, xsRange(9.5, X1, [], 4), s * 72, s);
    // markings: lane dashes (worn), edge lines, crossings at the bridge head
    for (const zl of [61.5, 65, 68.5]) { paintLine(S, -300, s * zl, -24, s * zl, 0.13, 3, 6); paintLine(S, 24, s * zl, 520, s * zl, 0.13, 3, 6); }
    for (const zl of [58.55, 71.45]) { paintLine(S, -300, s * zl, -24, s * zl, 0.14); paintLine(S, 24, s * zl, 520, s * zl, 0.14); }
    for (const sx of [-1, 1]) for (let k = 0; k < 9; k++) {
      const z = s * (59 + k * 1.45 + 0.35);
      decal(S.B.decal, sx * 20, 0.013, z, 4.0, 0.55, Math.PI / 2, D.line, [0.92, 0.92, 0.88], [0.55, 0, 1]);
    }
    for (const sx of [-1, 1]) paintLine(S, sx * 17.2, s * 58.3, sx * 17.2, s * 71.7, 0.4, 0, 0, [0.9, 0.9, 0.86]);
    // manholes, drains, puddles along the gutters, wet patches, leaf litter
    for (let x = -260; x < 480; x += 30 + r() * 25) decal(S.B.decal, x, 0.012, s * (60 + r() * 10), 0.9, 0.9, r() * 6, D.manhole);
    for (let x = -280; x < 480; x += 18 + r() * 8) { decal(S.B.decal, x, 0.012, s * 58.45, 0.45, 0.95, Math.PI / 2, D.drain); }
    for (let x = -280; x < 500; x += 9 + r() * 14) pud(S, x, 0.014, s * (58.6 + r() * 0.6), 2.5 + r() * 4, 0.9 + r() * 0.8, Math.PI / 2 + (r() - 0.5) * 0.1, r() < 0.5 ? D.puddle : D.puddle2);
    for (let x = -260; x < 480; x += 14 + r() * 20) pud(S, x, 0.014, s * (60 + r() * 11), 1.4 + r() * 2.5, 1.0 + r() * 1.6, r() * 6, r() < 0.5 ? D.puddle : D.puddle2);
    for (let x = -260; x < 480; x += 10 + r() * 15) pud(S, x, 0.014, s * (53.5 + r() * 4), 1.5 + r() * 2.4, 1 + r() * 1.5, r() * 6, r() < 0.5 ? D.puddle : D.puddle2);
    for (let x = -300; x < 500; x += 4 + r() * 6) decal(S.B.decal, x, 0.013, s * (53 + r() * 5.5), 2 + r() * 2.5, 2 + r() * 2.5, r() * 6, r() < 0.5 ? D.leaves : D.leaves2, [0.85, 0.85, 0.85], [0.7, 0, 1]);
    for (let x = -300; x < 500; x += 9 + r() * 10) decal(S.B.decal, x, 0.013, s * (58.4 + r() * 0.5), 1.5 + r() * 2, 0.6, Math.PI / 2, D.leaves, [0.8, 0.8, 0.8], [0.6, 0, 1]);
    for (let x = -260; x < 480; x += 20 + r() * 30) decal(S.B.decal, x, 0.012, s * (60.5 + r() * 9), 1 + r() * 1.5, 2 + r() * 3, Math.PI / 2 + r() * 0.3, D.oil);
  }
  // avenue north of the bridge between the facades (to z 160) and the park forecourt south
  surf(asph, steps(-9.5, 9.5, 1.9), [71.8, 76, 80, 90, 100, 115, 130, 160], (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p), rm: RM.asph });
  for (const sx of [-1, 1]) {
    surf(asph, [9.5, 14.5].map((x) => sx * x), [72.2, 78.3, 90, 110, 130, 160], (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p, true), rm: RM.asph });
    curbZ(S, [72, 100, 130, 160], sx * 9.5, sx);
    paintLine(S, 0, 74, 0, 158, 0.13, 3, 5);
    for (let k = 0; k < 7; k++) decal(S.B.decal, -7.6 + k * 2.6, 0.013, 74.6, 1.3, 2.6, 0, D.line, [0.92, 0.92, 0.88]);
  }
  // south forecourt at the park entrance (|x| < 9.5, z -72..-78)
  surf(asph, steps(-9.5, 9.5, 1.9), [-72.2, -75, -78.3], (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p, true), rm: RM.asph });
  // beyond the facades (side streets peeking through gaps): a plain low slab, coarse
  for (const s of [1, -1]) surf(asph, steps(X0, X1, 100), [s * 78.3, s * 130], (x, z) => [x, -0.02, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p), rm: RM.asph });
}

// ---------------------------------------------------------------------- plane trees (late autumn)
function planeTree(S, x, z, rng, lod = 0) {
  const P = S.B.props, L = S.B.leaves;
  const H = 4.2 + rng() * 1.2, lean = [(rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5];
  const barkCol = (p) => { const k = (0.5 + 0.3 * wn(p[0] * 3 + p[1] * 2, p[2] * 3)) * (0.55 + 0.45 * sstep(0, 2.5, p[1])); return [0.6 * k, 0.58 * k, 0.5 * k]; };
  const B = { rect: A.bark, col: barkCol, rm: RM.wood };
  const top = [x + lean[0], H, z + lean[1]];
  if (!lod) addGeo(P, CYL(0.33, 0.45, 0.5, 6, true), M4(x, 0.25, z), B);
  seg(P, [x, 0.0, z], top, 0.36, 0.25, lod ? 5 : 6, B);
  const nL = lod ? 3 : 3 + (rng() < 0.6 ? 1 : 0), a0 = rng() * 6.28;
  const tips = [];
  const cc = [x + lean[0] * 1.6, H + 5.8, z + lean[1] * 1.6];
  for (let i = 0; i < nL; i++) {
    const a = a0 + i / nL * 6.28 + (rng() - 0.5) * 0.7, el = 0.95 + rng() * 0.35, len = 4.6 + rng() * 2.2;
    const d = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
    const e = [top[0] + d[0] * len, top[1] + d[1] * len, top[2] + d[2] * len];
    seg(P, top, e, 0.2, 0.1, lod ? 4 : 5, B);
    tips.push([e, 1.0]);
    if (!lod) for (let j = 0; j < 1 + (rng() < 0.4 ? 1 : 0); j++) {
      const t = 0.45 + j * 0.25, b0 = [top[0] + d[0] * len * t, top[1] + d[1] * len * t, top[2] + d[2] * len * t];
      const aa = a + (j ? 1 : -1) * (0.6 + rng() * 0.5), ee = 0.55 + rng() * 0.6, l2 = 2.4 + rng() * 1.6;
      const e2 = [b0[0] + Math.cos(aa) * Math.cos(ee) * l2, b0[1] + Math.sin(ee) * l2, b0[2] + Math.sin(aa) * Math.cos(ee) * l2];
      seg(P, b0, e2, 0.1, 0.045, 4, B);
      tips.push([e2, 0.8]);
      tips.push([[(b0[0] + e2[0]) / 2, (b0[1] + e2[1]) / 2 + 0.3, (b0[2] + e2[2]) / 2], 0.6]);
    }
  }
  tips.push([[top[0], H + 3.2, top[2]], 0.7]);
  // leaf clusters: crossed alpha cards (thinning: some skipped), normals bent away from the crown centre
  const hue = rng();
  for (const [c, w] of tips) {
    if (rng() < 0.12) continue;
    const n = lod ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const sz = (2.6 + rng() * 1.8) * w + 1.0, rot = rng() * Math.PI, tilt = (rng() - 0.5) * 1.1;
      const p = [c[0] + (rng() - 0.5) * 1.6, c[1] + (rng() - 0.3) * 1.2, c[2] + (rng() - 0.5) * 1.6];
      const right = [Math.cos(rot), 0, Math.sin(rot)], up = [-Math.sin(rot) * Math.sin(tilt), Math.cos(tilt), Math.cos(rot) * Math.sin(tilt)];
      const shade = 0.55 + 0.45 * sstep(H, H + 8, p[1]);
      const tint = mix3([0.9, 0.78, 0.55], [0.75, 0.52, 0.34], (hue + rng() * 0.6) % 1);
      const cl = mul(tint, shade * 0.6);
      const hw = sz / 2, Pq = (a, b) => [p[0] + right[0] * a + up[0] * b, p[1] + right[1] * a + up[1] * b, p[2] + right[2] * a + up[2] * b];
      const corners = [Pq(-hw, -hw), Pq(hw, -hw), Pq(hw, hw), Pq(-hw, hw)], uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
      const base = L.n;
      corners.forEach((q, i) => { const dn = [q[0] - cc[0], (q[1] - cc[1]) * 0.6 + 1.2, q[2] - cc[2]], l = Math.hypot(...dn); L.v(q, [dn[0] / l, dn[1] / l, dn[2] / l], uvs[i], cl, RM.leaf); });
      L.q(base, base + 1, base + 2, base + 3);
    }
  }
  col(S, [x - 0.36, 0, z - 0.36], [x + 0.36, 4.5, z + 0.36], 'wood', { thin: true, kind: 'tree' });
}
function trees(S) {
  const rng = makeRng(777);
  const lampXs = quayLampXs();
  for (const s of [1, -1]) {
    for (let x = -380; x < 600; x += (x < -150 || x > 440 ? 14 : 9) + rng() * 1.5) {
      const ax = Math.abs(x);
      if (ax < PED.x1 + 3.5) continue;
      if (s > 0 && x > RAMPN_LAND - 3 && x < RAMP_N.xHigh + 4) continue;
      if (s < 0 && x > RAMPS_LAND - 3 && x < RAMP_S.xHigh + 4) continue;
      if (STAIRS.some(([xt, b]) => b === s && x > xt - 4 && x < xt + 1.5)) continue;
      if (lampXs.some((lx) => Math.abs(lx - x) < 2.2)) continue;
      if (rng() < 0.06) continue;   // a missing tree here and there
      // the south quay between the bridge and x 150 stays open: the view of the tower falling from the lower quay
      if (s < 0 && x > 16 && x < 150) continue;
      const lod = x < -130 || x > 330 ? 1 : 0;
      planeTree(S, x + (rng() - 0.5) * 0.8, s * (55.6 + (rng() - 0.5) * 0.5), rng, lod);
    }
  }
  // park allées along the long sides
  for (const sx of [-1, 1]) for (let z = -86; z > -248; z -= 11.5) planeTree(S, sx * 86.5 + (rng() - 0.5) * 0.5, z + (rng() - 0.5) * 1.2, rng, 1);
  for (let x = -76; x <= 76; x += 11) if (Math.abs(x) > 12) planeTree(S, x, -246.5, rng, 1);
}
const quayLampXs = () => { const o = []; for (let x = -128; x <= 440; x += 26) if (Math.abs(x) > 22) o.push(x); return o; };

// ---------------------------------------------------------------------- upper-quay furniture
function bouquinistes(S) {
  const P = S.B.props, rng = makeRng(31337);
  for (const s of [1, -1]) {
    const gaps = parapetGaps(s);
    for (let x = -150; x < 380;) {
      const n = 2 + Math.floor(rng() * 4), x0 = x;
      let xx = x;
      const boxes = [];
      for (let k = 0; k < n; k++) { const L = 1.8 + rng() * 0.5; boxes.push([xx, L]); xx += L + 0.06; }
      const x1 = xx;
      x = x1 + 3 + rng() * 14;
      if (gaps.some(([a, b]) => x1 > a - 1.5 && x0 < b + 1.5)) continue;
      if (quayLampXs().some((lx) => lx > x0 - 1 && lx < x1 + 1)) continue;
      const zc = s * 52.42;
      for (const [bx, L] of boxes) {
        const cx = bx + L / 2, h = 0.6 + rng() * 0.05, d = 0.82, tint = mul([1, 1, 1], 0.8 + rng() * 0.35), rect = rng() < 0.3 ? A.bouq2 : A.bouq;
        const C = mul([0.42, 0.62, 0.48], 0.55 * tint[0]);
        addGeo(P, BOX(L, h, d), M4(cx, 1.0 + h / 2, zc), { rect, col: C, rm: RM.paint });
        // the lid: sloped toward the street, with a lip
        const lid = BOX(L + 0.06, 0.06, d + 0.08);
        addGeo(P, lid, M4(cx, 1.0 + h + 0.12, zc + s * 0.0, s * 0.24), { rect, col: mul(C, 0.9), rm: RM.paint });
        // padlock + hasp on the street face
        for (const off of [L * (rng() - 0.5) * 0.5]) {
          addGeo(P, BOX(0.07, 0.09, 0.035), M4(cx + off, 1.0 + h - 0.12, zc + s * (d / 2 + 0.07)), { col: COL.brass, rm: RM.bronze });
          addGeo(P, BOX(0.045, 0.05, 0.012), M4(cx + off, 1.0 + h - 0.06, zc + s * (d / 2 + 0.07)), { col: [0.4, 0.4, 0.42], rm: RM.galv });
        }
      }
      col(S, [x0, 0, s > 0 ? 52 : -53.0], [x1, 1.85, s > 0 ? 53.0 : -52], 'metal', { kind: 'bouquiniste' });
    }
  }
}
function morris(S, x, z, rot) {
  const P = S.B.props;
  addGeo(P, CYL(0.68, 0.72, 0.35, 12), M4(x, 0.17, z), { col: COL.ironG, rm: RM.iron });
  addGeo(P, CYL(0.62, 0.62, 2.5, 12, true), M4(x, 1.6, z, 0, rot), { rect: A.posters, col: [0.8, 0.8, 0.78], rm: RM.paint });
  addGeo(P, CYL(0.7, 0.64, 0.18, 12), M4(x, 2.95, z), { col: COL.ironG, rm: RM.iron });
  addGeo(P, LATHE([[0.72, 0], [0.66, 0.2], [0.5, 0.45], [0.3, 0.62], [0.12, 0.75], [0.0, 0.8]], 12), M4(x, 3.04, z), { col: COL.ironG, rm: RM.iron });
  addGeo(P, SPH(0.08, 6, 4), M4(x, 3.9, z), { col: COL.ironG, rm: RM.iron });
  addGeo(P, CYL(0.04, 0.04, 0.2, 5), M4(x, 3.78, z), { col: COL.ironG, rm: RM.iron });
  col(S, [x - 0.68, 0, z - 0.68], [x + 0.68, 3.1, z + 0.68], 'metal', { kind: 'column' });
}
function bench(S, bk, x, y, z, rot, colliders = true) {
  const c = Math.cos(rot), s = Math.sin(rot), I = { col: COL.iron, rm: RM.iron }, W = { rect: A.wood, col: [0.6, 0.5, 0.4], rm: RM.wood };
  const at = (lx, ly, lz, rx = 0) => M4(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, rx, rot);
  for (const lx of [-0.85, 0.85]) { addGeo(bk, BOX(0.07, 0.45, 0.5), at(lx, 0.22, 0), I); addGeo(bk, BOX(0.06, 0.5, 0.06), at(lx, 0.68, 0.24, -0.25), I); }
  addGeo(bk, BOX(1.9, 0.05, 0.42), at(0, 0.46, -0.02), W);
  addGeo(bk, BOX(1.9, 0.3, 0.04), at(0, 0.75, 0.3, -0.25), W);
  if (colliders) { const ax = Math.abs(c) > 0.5; S.colliders.push({ min: [x - (ax ? 1 : 0.35), y, z - (ax ? 0.35 : 1)], max: [x + (ax ? 1 : 0.35), y + 0.9, z + (ax ? 0.35 : 1)], data: { mat: 'wood', kind: 'bench' } }); }
}
function scooter(S, x, z, rot, rng) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot);
  const at = (lx, ly, lz, rx = 0, rz = 0) => M4(x + lx * c + lz * s, ly, z - lx * s + lz * c, rx, rot, rz);
  const paint = [[0.35, 0.36, 0.38], [0.22, 0.25, 0.3], [0.5, 0.48, 0.44], [0.08, 0.08, 0.09], [0.38, 0.12, 0.1]][(rng() * 5) | 0];
  for (const lz of [-0.62, 0.62]) addGeo(P, CYL(0.21, 0.21, 0.1, 10), at(0, 0.21, lz, 0, Math.PI / 2), { col: COL.rubber, rm: RM.rubber });
  addGeo(P, RBOX(0.36, 0.42, 0.9, 0.12), at(0, 0.5, 0.25), { col: paint, rm: RM.paint });
  addGeo(P, RBOX(0.3, 0.12, 0.62, 0.05), at(0, 0.78, 0.25), { col: [0.05, 0.05, 0.05], rm: RM.rubber });
  addGeo(P, BOX(0.3, 0.06, 0.6), at(0, 0.32, -0.15), { col: [0.06, 0.06, 0.06], rm: RM.rubber });
  addGeo(P, RBOX(0.32, 0.6, 0.12, 0.05), at(0, 0.6, -0.52, 0.25), { col: paint, rm: RM.paint });
  seg(P, [x - 0.55 * s, 0.9, z - 0.55 * c], [x - 0.6 * s, 1.12, z - 0.6 * c], 0.03, 0.03, 4, { col: COL.iron, rm: RM.iron });
  addGeo(P, BOX(0.62, 0.04, 0.04), at(0, 1.13, -0.6), { col: COL.iron, rm: RM.iron });
  addGeo(P, BOX(0.06, 0.06, 0.03), at(0, 0.9, -0.66), { col: [0.9, 0.85, 0.7], rm: RM.glass });
  const ax = Math.abs(s) > 0.5;
  S.colliders.push({ min: [x - (ax ? 0.9 : 0.3), 0, z - (ax ? 0.3 : 0.9)], max: [x + (ax ? 0.9 : 0.3), 1.1, z + (ax ? 0.3 : 0.9)], data: { mat: 'metal', kind: 'scooter', thin: true } });
}
function metroEntrance(S, x0, z0, s) {
  // Art Nouveau-ish stair opening on the far sidewalk: cast-iron balustrade, two lamp stems with amber globes
  const P = S.B.props, W = 2.6, L = 5.2, I = { col: COL.ironG, rm: RM.iron };
  const zA = s * z0, zB = s * (z0 + W);
  // dark stairwell going down (scenery)
  const zi0 = Math.min(zA, zB), zi1 = Math.max(zA, zB);
  for (let k = 0; k < 10; k++) addGeo(P, BOX(0.32, 0.17, W - 0.2), M4(x0 + 0.3 + k * 0.33, -0.17 * (k + 1) + 0.085, (zi0 + zi1) / 2), { col: [0.12, 0.11, 0.1], rm: RM.stone });
  addGeo(P, BOX(L, 0.02, W - 0.1), M4(x0 + L / 2 + 0.6, -1.9, (zi0 + zi1) / 2), { col: [0.02, 0.02, 0.02], rm: RM.stone });
  for (const zz of [zi0, zi1]) addGeo(S.B.stone, BOX(L, 2.0, 0.2), M4(x0 + L / 2, -1.0, zz), { ws: TS, col: [0.3, 0.29, 0.27], rm: RM.stone });
  addGeo(S.B.stone, BOX(0.2, 2.0, W), M4(x0 + L, -1.0, (zi0 + zi1) / 2), { ws: TS, col: [0.3, 0.29, 0.27], rm: RM.stone });
  // balustrade: posts, rails, shield panels (no railing on the entry end at x0)
  const rail = (a, b) => { beam(P, [a[0], 0.95, a[1]], [b[0], 0.95, b[1]], 0.06, 0.06, I); beam(P, [a[0], 0.12, a[1]], [b[0], 0.12, b[1]], 0.05, 0.05, I); };
  rail([x0, zi0], [x0 + L, zi0]); rail([x0, zi1], [x0 + L, zi1]); rail([x0 + L, zi0], [x0 + L, zi1]);
  for (let k = 0; k <= 6; k++) for (const zz of [zi0, zi1]) { const xx = x0 + k * L / 6; seg(P, [xx, 0, zz], [xx, 0.95, zz], 0.025, 0.025, 4, I); if (k < 6) addGeo(P, TOR(0.2, 0.02, 3, 6), M4(xx + L / 12, 0.54, zz, 0, 0, 0, 1, 1.3, 1), I); }
  // the two lamp stems (curling) with amber globes + cartouche between them
  for (const zz of [zi0, zi1]) {
    const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([x0 + 0.1 + Math.sin(t * 2.2) * 0.25, t * 3.1, zz + (zz === zi0 ? 1 : -1) * Math.pow(t, 3) * 0.5]); }
    for (let k = 0; k < 8; k++) seg(P, pts[k], pts[k + 1], 0.07 - k * 0.005, 0.065 - k * 0.005, 6, I);
    const g = pts[8];
    addGeo(P, SPH(0.2, 8, 6), M4(g[0], g[1] + 0.1, g[2], 0, 0, 0, 1, 1.5, 1), { col: [1, 0.55, 0.25], rm: RM.glow, e: [2.8, 1.8, 1.0] });
    glow(S, [g[0], g[1] + 0.1, g[2]], 1.0, [3.0, 1.5, 0.5]);
    light(S, [g[0], g[1], g[2]], 7, 1.0, [1.0, 0.55, 0.25]);
  }
  beam(P, [x0 + 0.1, 2.85, zi0 + 0.4], [x0 + 0.1, 2.85, zi1 - 0.4], 0.05, 0.05, I);
  quadRU(P, [x0 + 0.06, 2.55, (zi0 + zi1) / 2], RT([-1, 0, 0]), [0, 1, 0], W - 0.8, 0.45, A.metro, COL.white, RM.paint, [0.25, 0.22, 0.16]);
  col(S, [x0, -2, zi0 - 0.1], [x0 + L, 1.0, zi1 + 0.1], 'metal', { kind: 'metro' });
}
function upperFurniture(S) {
  const rng = makeRng(4242);
  for (const s of [1, -1]) for (const x of quayLampXs()) {
    if (s > 0 && x > RAMPN_LAND - 2 && x < RAMP_N.xHigh + 3) continue;
    if (s < 0 && x > RAMPS_LAND - 2 && x < RAMP_S.xHigh + 3) continue;
    quayLamp(S, x, s * 53.15);
  }
  // simplified far lamp rows (glow + post) both ways along both quays so the river view never dead-ends
  for (const s of [1, -1]) for (let x = -900; x < 1100; x += 52) {
    if (x > -150 && x < 460) continue;
    const P = S.B.props;
    addGeo(P, CYL(0.09, 0.15, 3.6, 4, true), M4(x, 1.8, s * 53.15), { col: COL.iron, rm: RM.iron });
    addGeo(P, CYL(0.26, 0.14, 0.45, 4, true), M4(x, 3.85, s * 53.15), { col: [1, 0.86, 0.62], rm: RM.glow, e: [2.3, 2.0, 1.6] });
    addGeo(P, CONE(0.3, 0.3, 4), M4(x, 4.25, s * 53.15), { col: COL.iron, rm: RM.iron });
    glow(S, [x, 3.9, s * 53.15], 1.5, LAMP_C, { far: true });
    if (Math.abs(x) < 700) light(S, [x, 3.9, s * 53.15], 12, 1.6);
  }
  // Morris columns, metro entrance, parked scooters, benches, bins on the far sidewalks
  morris(S, 46, 75.4, 0.4); morris(S, -58, 75.4, 2.1); morris(S, 132, -75.4, 1.2); morris(S, 210, 75.4, 3.3);
  metroEntrance(S, 82, 73.0, 1);
  for (const [x, z, n] of [[36.5, 72.8, 3], [104, 72.8, 2], [-30, 72.8, 4], [118, -72.8, 3], [-104, -72.8, 2], [170, 57.2, 2]]) for (let k = 0; k < n; k++) scooter(S, x + k * 0.95, z, Math.PI / 2 * (z > 0 ? 1 : -1) + (rng() - 0.5) * 0.25 + Math.PI / 2, rng);
  for (const [x, z, r] of [[40, 57.4, Math.PI], [96, 57.4, Math.PI], [150, 57.4, Math.PI], [-44, 57.4, Math.PI], [52, -57.4, 0], [144, -57.4, 0], [-50, -57.4, 0]]) bench(S, S.B.props, x, 0, z, r);
  // bridge-end pedestals with an allegorical lantern-bearer (weathered bronze, abstract)
  for (const s of [1, -1]) for (const sx of [1, -1]) pedestal(S, sx * (PED.x0 + PED.x1) / 2, s * (PED.z0 + PED.z1) / 2, sx, s);
}
function pedestal(S, x, z, sx, s) {
  const st = S.B.stone, P = S.B.props, W = PED.x1 - PED.x0;
  const sc = (p) => stoneCol(p, { y0: 0, top: 4, k: 1.05 });
  addGeo(st, BOX(W, 0.5, W), M4(x, 0.25, z), { ws: TS, col: sc, rm: RM.wet });
  addGeo(st, BOX(W - 0.3, 0.25, W - 0.3), M4(x, 0.62, z), { ws: TS, col: sc, rm: RM.stone });
  addGeo(st, BOX(W - 0.6, 2.9, W - 0.6), M4(x, 2.2, z), { ws: TS, col: sc, rm: RM.stone });
  addGeo(st, BOX(W - 0.25, 0.3, W - 0.25), M4(x, 3.8, z), { ws: TS, col: sc, rm: RM.wet });
  addGeo(st, BOX(W - 0.5, 0.35, W - 0.5), M4(x, 4.12, z), { ws: TS, col: sc, rm: RM.stone });
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) quadRU(P, [x + nx * ((W - 0.6) / 2 + 0.012), 2.3, z + nz * ((W - 0.6) / 2 + 0.012)], [nz, 0, -nx], [0, 1, 0], 1.7, 0.42, A.plaque, COL.white, RM.bronze);
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) wallDecal(S.B.decal, [x + nx * ((W - 0.6) / 2 + 0.014), 2.6, z + nz * ((W - 0.6) / 2 + 0.014)], [nx, 0, nz], [0, 1, 0], 2.2, 2.4, D.streak2, [1, 1, 1]);
  // statue: robed figure raising a lantern (bronze, green-black patina)
  const y0 = 4.3, BZ = { col: (p) => mix3([0.035, 0.037, 0.034], [0.06, 0.085, 0.07], sstep(0.4, 0.7, wn(p[0] * 4, p[1] * 3))), rm: RM.bronze };
  addGeo(P, CYL(0.7, 0.75, 0.25, 10), M4(x, y0 + 0.12, z), BZ);
  addGeo(P, LATHE([[0.68, 0], [0.62, 0.5], [0.5, 1.1], [0.38, 1.6], [0.34, 1.95], [0.42, 2.15], [0.36, 2.35], [0.14, 2.5], [0.0, 2.52]], 9), M4(x, y0 + 0.25, z, 0.04 * s, 0, 0.05 * sx), BZ);
  addGeo(P, SPH(0.17, 8, 6), M4(x + 0.03, y0 + 2.95, z, 0, 0, 0, 1, 1.15, 1), BZ);
  addGeo(P, SPH(0.24, 7, 5), M4(x - 0.05 * sx, y0 + 2.75, z + 0.08 * s, 0, 0, 0, 1.2, 0.6, 1.0), BZ);
  const sh = [x + sx * 0.32, y0 + 2.5, z], hand = [x + sx * 0.55, y0 + 3.85, z - s * 0.2];
  seg(P, sh, [x + sx * 0.48, y0 + 3.2, z - s * 0.1], 0.11, 0.09, 6, BZ); seg(P, [x + sx * 0.48, y0 + 3.2, z - s * 0.1], hand, 0.09, 0.07, 6, BZ);
  seg(P, [x - sx * 0.32, y0 + 2.45, z], [x - sx * 0.45, y0 + 1.7, z + s * 0.2], 0.1, 0.08, 6, BZ);
  addGeo(P, BOX(0.5, 0.9, 0.12), M4(x - sx * 0.45, y0 + 1.45, z + s * 0.25, 0.1, 0, 0.2 * sx), BZ);
  lantern(S, hand[0], hand[1] + 0.35, hand[2], 0.9);
  glow(S, [hand[0], hand[1] + 0.37, hand[2]], 1.3);
  light(S, [hand[0], hand[1], hand[2]], 9, 1.2);
  col(S, [x - W / 2, 0, z - W / 2], [x + W / 2, 4.3, z + W / 2], 'concrete', { kind: 'pedestal' });
}

// ---------------------------------------------------------------------- the bridge
const ARCHES = [[-52, -26], [-22, -10], [-6, 6], [10, 22], [26, 52]];
const SPRING = -5.8, CROWN = -1.6;
const archY = (z, [z0, z1]) => { const a = (z1 - z0) / 2, t = (z - (z0 + z1) / 2) / a; return SPRING + (CROWN - SPRING) * Math.sqrt(Math.max(0, 1 - t * t)); };
function bridge(S) {
  const { stone, asph } = S.B, P = S.B.props, HB = BRIDGE.half;
  const sc = (k = 1, extra = {}) => (p) => stoneCol(p, { y0: WATER_Y, top: -0.6, water: p[1] < LOW_Y, k, ...extra });
  for (const sx of [-1, 1]) {
    const xf = sx * HB;
    // spandrel faces over each arch, piers below the springing
    for (const ar of ARCHES) {
      const zs = steps(ar[0], ar[1], (ar[1] - ar[0]) / 14), R = 0.85;
      surf(stone, zs, [0, 0.5, 1], (z, v) => { const yb = archY(z, [ar[0] - R, ar[1] + R]) + 0; return [xf, lerp(Math.max(yb, archY(z, ar) + 0.2), -0.6, v), z]; }, { n: () => [sx, 0, 0], ws: TS, col: sc(), rm: RM.stone });
      // voussoir ring (slightly proud), keystone
      const N = Math.round((ar[1] - ar[0]) * 1.3) | 1;
      for (let k = 0; k < N; k++) {
        const t0 = Math.PI - k / N * Math.PI, t1 = Math.PI - (k + 1) / N * Math.PI, zc = (ar[0] + ar[1]) / 2, a = (ar[1] - ar[0]) / 2, b = CROWN - SPRING;
        const pt = (t, d) => [xf + sx * 0.07, SPRING + (b + d) * Math.sin(t), zc + (a + d) * Math.cos(t)];
        const tone = 0.92 + ((k * 7) % 5) * 0.04;
        const cA = mul(stoneCol(pt(t0, 0), { k: 1.12 * tone }), 1), key = k === (N - 1) / 2;
        const d = key ? 1.35 : 0.85;
        quad4(stone, pt(t0, 0.02), pt(t1, 0.02), pt(t1, d), pt(t0, d), [sx, 0, 0], [[pt(t0, 0)[2] / TS, pt(t0, 0)[1] / TS], [pt(t1, 0)[2] / TS, pt(t1, 0)[1] / TS], [pt(t1, d)[2] / TS, pt(t1, d)[1] / TS], [pt(t0, d)[2] / TS, pt(t0, d)[1] / TS]], cA, RM.stone);
        if (key) {
          const kz = zc, ky = CROWN;
          addGeo(stone, BOX(0.36, 1.5, 0.95), M4(xf + sx * 0.2, ky + 0.65, kz), { ws: TS, col: sc(1.15), rm: RM.stone });
          addGeo(stone, SPH(0.32, 8, 6), M4(xf + sx * 0.36, ky + 0.6, kz, 0, 0, 0, 0.55, 1.05, 0.9), { ws: TS, col: sc(1.0), rm: RM.stone });
          addGeo(stone, BOX(0.18, 0.25, 0.75), M4(xf + sx * 0.42, ky + 0.12, kz, 0, 0, 0), { ws: TS, col: sc(1.05), rm: RM.stone });
        }
      }
      // intrados (barrel vault)
      const ts = steps(0, Math.PI, Math.PI / 14);
      if (sx > 0) surf(stone, [-HB - 0.07, -HB / 3, HB / 3, HB + 0.07], ts, (x, t) => { const zc = (ar[0] + ar[1]) / 2, a = (ar[1] - ar[0]) / 2; return [x, SPRING + (CROWN - SPRING) * Math.sin(t), zc + a * Math.cos(t)]; }, { hint: (p) => [0, SPRING - 1 - p[1], (ar[0] + ar[1]) / 2 - p[2]], ws: TS, col: (p) => mul(stoneCol(p, { k: 0.7, top: -1 }), (HB - Math.abs(p[0])) < 2 ? 0.55 : 0.32), rm: [0.95, -0.85, 1] });
    }
    // piers: faces below the springing + the cutwater noses
    for (const zc of BRIDGE.piers) {
      surf(stone, [zc - 2, zc + 2], [WATER_Y - 3, WATER_Y + 0.2, LOW_Y, SPRING + 0.2, -0.6], (z, y) => [xf, y, z], { n: () => [sx, 0, 0], ws: TS, col: sc(), rm: RM.stone });
      const yT = -4.3, xn = xf + sx * 3.4, tip = [xn, yT, zc];
      for (const sz of [-1, 1]) {
        const a = [xf, WATER_Y - 3, zc + sz * 2], b = [xf, yT, zc + sz * 2], c = [xn, yT, zc], d = [xn, WATER_Y - 3, zc];
        const n = [sz * 0.0 + sx * 2 / Math.hypot(2, 3.4), 0, sz * 3.4 / Math.hypot(2, 3.4)];
        surf(stone, [0, 1], [WATER_Y - 3, WATER_Y + 0.2, LOW_Y, yT], (u, y) => [lerp(xf, xn, u), y, lerp(zc + sz * 2, zc, u)], { n: () => n, ws: TS, col: sc(), rm: RM.wet, uv: (p, nn, u, y) => [u * 3.9 / TS, y / TS] });
        void a; void b; void c; void d;
        // cap: sloped triangle from the nose rim up to the face
        const top = [xf, -2.9, zc];
        quad4(stone, [xf, yT, zc + sz * 2.15], [xn + sx * 0.15, yT, zc], tip.map((v, i) => (i === 1 ? yT + 0.001 : v)), top, [sx * 0.45, 0.85, sz * 0.3], [[0, 0], [1.6, 0], [1.6, 0.05], [0, 0.6]], mul(stoneCol(top, { k: 1.1 }), 1), RM.wet);
        quad4(stone, [xf, yT, zc + sz * 2.15], [xn + sx * 0.15, yT, zc], [xn + sx * 0.15, yT - 0.25, zc], [xf, yT - 0.25, zc + sz * 2.15], [sx * 0.5, 0, sz * 0.86], [[0, 0], [1.6, 0], [1.6, 0.1], [0, 0.1]], mul(stoneCol(top, { k: 1.15 }), 1), RM.stone);
      }
      // carved medallion above each pier
      addGeo(stone, CYL(0.95, 0.95, 0.2, 12), M4(xf + sx * 0.08, -2.25, zc, 0, 0, Math.PI / 2), { ws: TS, col: sc(1.1), rm: RM.stone });
      quadRU(P, [xf + sx * 0.19, -2.25, zc], [0, 0, -sx], [0, 1, 0], 1.45, 1.45, A.medal, [0.85, 0.82, 0.75], RM.stone);
      // the pier side faces under the arches (toward the openings)
      if (sx > 0) for (const sz of [-1, 1]) surf(stone, [-HB, HB], [WATER_Y - 3, WATER_Y + 0.2, SPRING], (x, y) => [x, y, zc + sz * 2], { n: () => [0, 0, sz], ws: TS, col: (p) => mul(sc(0.85)(p), 0.5), rm: [0.6, -0.7, 1] });
    }
    // deck cornice (moulded, dentils)
    prof(stone, steps(-52, 52, 2), [[0, -0.75], [0.12, -0.75], [0.14, -0.62], [0.3, -0.5], [0.36, -0.36], [0.36, -0.22], [0.42, -0.16], [0.42, 0], [0, 0]], (u, a, b) => [sx * (HB + a), b, u], (na, nb) => [sx * na, nb, 0], { col: sc(1.12), rm: RM.wet, uv: (p, n, u, av) => [u / TS, av / TS] });
    // balustrade: plinth rail, balusters, dados, handrail
    const xb = sx * (BRIDGE.rail + 0.3);
    const BS = { ws: TS, col: (p) => stoneCol(p, { y0: 0, top: 1.05, k: 1.15 }), rm: RM.wet };
    addGeo(stone, BOX(0.6, 0.2, 104), M4(xb, 0.1, 0), BS);
    const dados = [];
    for (let z = -52; z <= 52.01; z += 52 / 14) dados.push(z);
    const lampZ = [-40, -24, -8, 8, 24, 40];
    for (const z of dados) if (!lampZ.some((lz) => Math.abs(lz - z) < 1.6)) { addGeo(stone, BOX(0.66, 1.0, 0.62), M4(xb, 0.5, z), BS); addGeo(stone, BOX(0.74, 0.08, 0.7), M4(xb, 1.07, z), BS); }
    for (const z of lampZ) { addGeo(stone, BOX(0.8, 1.2, 1.3), M4(xb, 0.6, z), BS); addGeo(stone, BOX(0.9, 0.1, 1.4), M4(xb, 1.25, z), BS); }
    const bal = LATHE([[0.08, 0], [0.11, 0.26], [0.05, 0.55], [0.085, 0.66]], 4);
    const allPosts = [...dados.map((z) => [z, 0.34]), ...lampZ.map((z) => [z, 0.68])].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < allPosts.length - 1; i++) {
      const za = allPosts[i][0] + allPosts[i][1], zb = allPosts[i + 1][0] - allPosts[i + 1][1];
      if (zb - za < 0.4) continue;
      const n = Math.round((zb - za) / 0.48);
      for (let k = 0; k < n; k++) addGeo(stone, bal.clone(), M4(xb, 0.2, za + (k + 0.5) * (zb - za) / n, 0, Math.PI / 4), { ws: 0.8, col: (p) => stoneCol(p, { y0: 0, top: 1.0, k: 1.1 }), rm: RM.stone });
    }
    bal.dispose();
    prof(stone, steps(-52, 52, 4), [[-0.33, 0.86], [-0.33, 0.95], [-0.28, 1.04], [0.28, 1.04], [0.33, 0.95], [0.33, 0.86], [-0.33, 0.86]], (u, a, b) => [xb + a, b, u], (na, nb) => [na, nb, 0], { col: (p) => stoneCol(p, { k: 1.25, top: 3 }), rm: RM.wet, uv: (p, n, u, av) => [u / TS, av / TS] });
    S.colliders.push({ min: [sx > 0 ? BRIDGE.rail : -HB, 0, -52], max: [sx > 0 ? HB : -BRIDGE.rail, 1.05, 52], data: { mat: 'concrete', kind: 'parapet' } });
    for (const z of lampZ) bridgeLamp(S, xb, z);
  }
  // deck surfaces: road, granite curbs, stone-slab sidewalks
  const zs = steps(-52, 52, 2);
  surf(asph, steps(-9.5, 9.5, 1.9), zs, (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p), rm: RM.asph });
  for (const sx of [-1, 1]) {
    surf(stone, [9.5, 11.5, 13.4].map((x) => sx * x), zs, (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TS, col: (p) => mul([0.66, 0.63, 0.58], (0.82 + 0.3 * wfbm(p[0] * 0.2, p[2] * 0.1)) * WET), rm: RM.wet, uv: (p) => [p[2] / TS, p[0] / TS] });
    curbZ(S, steps(-58, 58, 4), sx * 9.5, sx);
    paintLine(S, sx * 9.1, -50, sx * 9.1, 50, 0.13);
    for (let z = -50; z < 50; z += 6 + S.rng() * 6) { pud(S, sx * (8.7 + S.rng() * 0.4), 0.014, z, 0.9 + S.rng() * 0.5, 2.5 + S.rng() * 3, 0, S.rng() < 0.5 ? D.puddle : D.puddle2); decal(S.B.decal, sx * 9.25, 0.012, z + 3, 0.4, 0.9, 0, D.drain); }
    for (let z = -48; z < 48; z += 5 + S.rng() * 7) decal(S.B.decal, sx * (10.5 + S.rng() * 2), 0.013, z, 1.6 + S.rng(), 1.6 + S.rng(), S.rng() * 6, S.rng() < 0.5 ? D.leaves : D.leaves2, [0.8, 0.8, 0.8], [0.7, 0, 1]);
  }
  paintLine(S, 0, -50, 0, 50, 0.14, 3, 4);
  for (let z = -48; z < 48; z += 7 + S.rng() * 9) pud(S, (S.rng() - 0.5) * 12, 0.014, z, 1.5 + S.rng() * 2, 1 + S.rng() * 2, S.rng() * 6, S.rng() < 0.5 ? D.puddle : D.puddle2);
  for (let z = -45; z < 45; z += 10 + S.rng() * 10) decal(S.B.decal, (S.rng() - 0.5) * 10, 0.012, z, 1.2, 3, S.rng() * 0.3, D.oil);
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) decal(S.B.decal, -8.3 + k * 2.07, 0.013, s * 50.3, 1.1, 2.7, 0, D.line, [0.9, 0.9, 0.86]);
}

// ---------------------------------------------------------------------- far bridges (lit silhouettes)
function farBridge(S, xc, seed) {
  const { stone } = S.B, P = S.B.props, rng = makeRng(seed), HW = 11;
  const arches = [[-52, -30], [-27, -11], [-8, 8], [11, 27], [30, 52]], sp = -6.2, cr = -1.3;
  const ay = (z, [z0, z1]) => { const a = (z1 - z0) / 2, t = (z - (z0 + z1) / 2) / a; return sp + (cr - sp) * Math.sqrt(Math.max(0, 1 - t * t)); };
  const sc = (p) => stoneCol(p, { y0: WATER_Y, top: -0.5, water: p[1] < LOW_Y, k: 0.95 });
  for (const sx of [-1, 1]) {
    const xf = xc + sx * HW;
    for (const ar of arches) {
      surf(stone, steps(ar[0], ar[1], (ar[1] - ar[0]) / 10), [0, 1], (z, v) => [xf, lerp(ay(z, ar), -0.4, v), z], { n: () => [sx, 0, 0], ws: TS * 2, col: sc, rm: RM.stone });
      surf(stone, [xc - HW, xc + HW], steps(0, Math.PI, Math.PI / 8), (x, t) => { const zc = (ar[0] + ar[1]) / 2, a = (ar[1] - ar[0]) / 2; return [x, sp + (cr - sp) * Math.sin(t), zc + a * Math.cos(t)]; }, { hint: (p) => [0, sp - 1 - p[1], (ar[0] + ar[1]) / 2 - p[2]], ws: TS * 2, col: (p) => mul(sc(p), 0.6), rm: RM.wet });
    }
    for (let i = 0; i < arches.length - 1; i++) {
      const z0 = arches[i][1], z1 = arches[i + 1][0];
      surf(stone, [z0, z1], [WATER_Y - 2, sp, -0.4], (z, y) => [xf, y, z], { n: () => [sx, 0, 0], ws: TS * 2, col: sc, rm: RM.stone });
      for (const sz of [-1, 1]) surf(stone, [xc - HW, xc + HW], [WATER_Y - 2, sp], (x, y) => [x, y, sz > 0 ? z1 : z0], { n: () => [0, 0, sz > 0 ? -1 : 1], ws: TS * 2, col: (p) => mul(sc(p), 0.7), rm: RM.wet });
      const zm = (z0 + z1) / 2;
      addGeo(stone, CONE(1.6, 3.5, 4), M4(xf + sx * 1.0, -4.8, zm, 0, Math.PI / 4, 0, 1, 1, 1), { ws: TS, col: sc, rm: RM.wet });
    }
    // cornice + solid parapet + lamp row
    prof(stone, steps(-58, 58, 4), [[0, -0.6], [0.35, -0.4], [0.35, 0], [0.1, 0], [0.1, 1.0], [-0.4, 1.0], [-0.4, 0]], (u, a, b) => [xf + sx * a, b, u], (na, nb) => [sx * na, nb, 0], { col: (p) => stoneCol(p, { k: 1.1, top: 2 }), rm: RM.wet, uv: (p, n, u, av) => [u / TS, av / TS] });
    for (let z = -48; z <= 48; z += 16) {
      const x = xf - sx * 0.15;
      addGeo(P, CYL(0.1, 0.16, 4.2, 5), M4(x, 3.1, z), { col: COL.iron, rm: RM.iron });
      addGeo(P, CYL(0.28, 0.16, 0.5, 5), M4(x, 5.4, z), { col: [1, 0.86, 0.62], rm: RM.glow, e: [2.3, 2.0, 1.6] });
      glow(S, [x, 5.45, z], 2.4, LAMP_C, { far: true });
      if (Math.abs(z) < 40) refl(S, [x + sx * 0.6, 5.4, z], WATER_Y, 30, 2.0, { water: true });
    }
  }
  // deck top (dark road)
  surf(S.B.asph, [xc - HW, xc + HW], steps(-56, 56, 14), (x, z) => [x, 0.01, z], { n: () => [0, 1, 0], ws: TA, col: (p) => asphCol(p), rm: RM.asph });
  void rng;
}

// ---------------------------------------------------------------------- props for cover
function crate(S, x, y, z, w, h, d, rot = 0, mat = 'wood') {
  addGeo(S.B.props, BOX(w, h, d), M4(x, y + h / 2, z, 0, rot), { rect: A.crate, col: [0.72, 0.62, 0.5], rm: RM.wood });
  return [x, z, w, d, h];
}
function pallets(S, x, y, z, n, rot = 0) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot);
  for (let k = 0; k < n; k++) {
    const yy = y + k * 0.15, j = (S.rng() - 0.5) * 0.12;
    for (const lz of [-0.5, 0.5]) addGeo(P, BOX(1.2, 0.09, 0.1), M4(x + lz * s + j, yy + 0.045, z + lz * c, 0, rot), { rect: A.wood, col: [0.62, 0.52, 0.4], rm: RM.wood });
    addGeo(P, BOX(1.2, 0.03, 1.1), M4(x + j, yy + 0.11, z, 0, rot), { rect: A.wood, col: [0.7, 0.6, 0.48], rm: RM.wood });
  }
}
function sandbags(S, x, y, z, len, rows, rot = 0) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot);
  for (let r = 0; r < rows; r++) {
    const n = Math.max(1, Math.round((len - r * 0.3) / 0.62));
    for (let k = 0; k < n; k++) {
      const lx = -((n - 1) * 0.62) / 2 + k * 0.62 + (r % 2) * 0.1, j = S.rng();
      addGeo(P, RBOX(0.6, 0.22, 0.4, 0.09), M4(x + lx * c, y + 0.11 + r * 0.2, z - lx * s, (j - 0.5) * 0.1, rot + (j - 0.5) * 0.2), { rect: A.sandbag, col: mul([0.5, 0.49, 0.44], 0.75 + j * 0.3), rm: RM.fabric });
    }
  }
}
function planter(S, x, y, z, w, d, rng, concrete = true) {
  const P = S.B.props;
  if (concrete) addGeo(S.B.stone, BOX(w, 0.85, d), M4(x, y + 0.425, z), { ws: TS, col: (p) => stoneCol(p, { base: [0.62, 0.6, 0.57], y0: y, top: y + 0.85 }), rm: RM.stone });
  else { addGeo(P, BOX(w, 0.8, d), M4(x, y + 0.4, z), { rect: A.wood, col: [0.42, 0.34, 0.26], rm: RM.wood }); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) addGeo(P, BOX(0.1, 0.86, 0.1), M4(x + a * w / 2, y + 0.43, z + b * d / 2), { col: COL.iron, rm: RM.iron }); }
  addGeo(P, BOX(w - 0.1, 0.04, d - 0.1), M4(x, y + 0.82, z), { col: [0.08, 0.06, 0.05], rm: RM.wet });
  // box-clipped shrubs: a cluster of small lumpy leaf clumps over the soil (not one dark ball), a few spilling over
  const nC = Math.max(6, Math.round(w * d * 5));
  for (let k = 0; k < nC; k++) { const r0 = 0.2 + rng() * 0.16; addGeo(S.B.green, SPH(r0, 6, 4), M4(x + (rng() - 0.5) * (w - 0.3), y + 0.86 + r0 * (0.5 + rng() * 0.9), z + (rng() - 0.5) * (d - 0.3), rng() * 3, rng() * 3, 0, 1, 0.7 + rng() * 0.3, 1), { ws: TL, col: mul([[0.46, 0.56, 0.3], [0.38, 0.5, 0.28], [0.55, 0.55, 0.32]][k % 3], 0.8 + rng() * 0.35), rm: RM.lawn }); }
  S.colliders.push({ min: [x - w / 2, y, z - d / 2], max: [x + w / 2, y + 1.1, z + d / 2], data: { mat: concrete ? 'concrete' : 'wood', kind: 'planter' } });
}
function cafeChairStack(S, x, y, z, n, rot) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot), I = { col: [0.08, 0.08, 0.085], rm: RM.iron };
  for (let k = 0; k < n; k++) {
    const yy = y + 0.45 + k * 0.1, off = k * 0.03;
    addGeo(P, BOX(0.42, 0.03, 0.42), M4(x + off * s, yy, z + off * c, 0, rot), { rect: A.wood, col: [0.62, 0.38, 0.22], rm: RM.wood });
    addGeo(P, BOX(0.42, 0.32, 0.03), M4(x + (off + 0.2) * s, yy + 0.25, z + (off + 0.2) * c, -0.12, rot), { rect: A.wood, col: [0.62, 0.38, 0.22], rm: RM.wood });
  }
  for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [0.19, 0.19], [-0.19, 0.19]]) seg(P, [x + a * c + b * s, y, z - a * s + b * c], [x + a * c + b * s, y + 0.45, z - a * s + b * c], 0.016, 0.016, 4, I);
  S.colliders.push({ min: [x - 0.3, y, z - 0.3], max: [x + 0.3, y + 0.8 + n * 0.1, z + 0.3], data: { mat: 'metal', kind: 'chairs', thin: true } });
}
function cafeTable(S, x, y, z, upturned = false) {
  const P = S.B.props, I = { col: [0.08, 0.08, 0.085], rm: RM.iron };
  addGeo(P, CYL(0.32, 0.32, 0.03, 10), M4(x, y + (upturned ? 0.015 : 0.73), z), { col: [0.32, 0.3, 0.28], rm: RM.stone });
  addGeo(P, CYL(0.025, 0.025, 0.7, 5), M4(x, y + (upturned ? 0.38 : 0.37), z), I);
  addGeo(P, CYL(0.2, 0.22, 0.03, 8), M4(x, y + (upturned ? 0.74 : 0.015), z), I);
}
function festoon(S, a, b, n, sag = 0.5) {
  const P = S.B.props;
  let prev = a;
  for (let k = 1; k <= 12; k++) {
    const t = k / 12, p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t)];
    seg(P, prev, p, 0.012, 0.012, 3, { col: COL.dark, rm: RM.rubber }); prev = p;
  }
  for (let k = 1; k < n; k++) {
    const t = k / n, p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag - 0.08, lerp(a[2], b[2], t)];
    addGeo(P, SPH(0.055, 5, 4), M4(...p), { col: [1, 0.75, 0.42], rm: RM.glow, e: [2.6, 2.0, 1.3] });
    if (k % 4 === 1) glow(S, p, 0.6, [2.4, 1.4, 0.55]);
  }
  light(S, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.4, (a[2] + b[2]) / 2], 7, 0.7, [1.0, 0.62, 0.3]);
}
// closed guinguette bar kiosk; front faces -s (toward the river) if `face` = -1 along z
function buvette(S, x, y, z, s, { w = 4.4, d = 2.5, small = false } = {}) {
  const P = S.B.props, h = 2.7, fz = z + s * d / 2;
  addGeo(P, BOX(w, h, d), M4(x, y + h / 2, z), { rect: A.wood, col: [0.34, 0.4, 0.33], rm: RM.wood });
  addGeo(P, BOX(w + 0.7, 0.16, d + 0.8), M4(x, y + h + 0.08, z + s * 0.2), { col: [0.1, 0.12, 0.1], rm: RM.paint });
  quadRU(P, [x, y + 1.3, fz + s * 0.012], [s, 0, 0], [0, 1, 0], w - 0.5, 1.9, A.shutter, [0.7, 0.72, 0.74], RM.galv);
  quadRU(P, [x, y + h - 0.25, fz + s * 0.42], [s, 0, 0], [0, 1, 0], w - 0.2, 0.42, A.buvette, COL.white, RM.paint, [0.35, 0.3, 0.2]);
  addGeo(P, BOX(w - 0.2, 0.46, 0.04), M4(x, y + h - 0.25, fz + s * 0.39), { col: [0.1, 0.12, 0.1], rm: RM.paint });
  // rolled striped awning, counter ledge, menu board, crates of empties
  addGeo(P, CYL(0.14, 0.14, w - 0.4, 8), M4(x, y + 2.25, fz + s * 0.14, 0, 0, Math.PI / 2), { rect: A.stripes, col: [0.8, 0.8, 0.78], rm: RM.fabric });
  addGeo(P, BOX(w - 0.3, 0.06, 0.4), M4(x, y + 1.05, fz + s * 0.2), { rect: A.wood, col: [0.5, 0.36, 0.24], rm: RM.wood });
  quadRU(P, [x + w / 2 + 0.012, y + 1.5, z], RT([1, 0, 0]), [0, 1, 0], 0.9, 0.9, A.menu, COL.white, RM.paint);
  // a lit side window (staff inside)
  quadRU(P, [x - w / 2 - 0.012, y + 1.6, z], RT([-1, 0, 0]), [0, 1, 0], 0.7, 0.6, A.window, COL.white, RM.glass, [1.6, 1.2, 0.8]);
  light(S, [x - w / 2 - 1.2, y + 1.6, z], 6, 0.8);
  col(S, [x - w / 2 - 0.35, y, z - d / 2 - 0.4], [x + w / 2 + 0.35, y + h + 0.2, z + d / 2 + 0.4], 'wood', { kind: 'kiosk' });
  if (!small) {
    // festoon of bulbs from the roof edge to a pole
    const pole = [x + w / 2 + 4.5, y, z + s * 2.6];
    seg(P, pole, [pole[0], y + 3.4, pole[2]], 0.05, 0.05, 5, { col: COL.iron, rm: RM.iron });
    festoon(S, [x - w / 2, y + h + 0.05, fz + s * 0.6], [pole[0], y + 3.3, pole[2]], 14, 0.55);
    S.colliders.push({ min: [pole[0] - 0.1, y, pole[2] - 0.1], max: [pole[0] + 0.1, y + 3.4, pole[2] + 0.1], data: { mat: 'metal', thin: true } });
  }
}
function utilityTruck(S, x, y, z, rot) {
  // small municipal flatbed (Goupil-like), parked against the wall
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot);
  const at = (lx, ly, lz, rx = 0, rz = 0) => M4(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, rx, rot, rz);
  const W = 1.5, body = [0.82, 0.82, 0.8];
  for (const lz of [-1.05, 1.0]) for (const lx of [-0.62, 0.62]) { addGeo(P, CYL(0.3, 0.3, 0.2, 10), at(lx, 0.3, lz, 0, Math.PI / 2), { col: COL.rubber, rm: RM.rubber }); addGeo(P, CYL(0.17, 0.17, 0.21, 8), at(lx, 0.3, lz, 0, Math.PI / 2), { col: [0.4, 0.4, 0.42], rm: RM.galv }); }
  addGeo(P, BOX(W, 0.3, 3.3), at(0, 0.55, 0), { col: [0.08, 0.08, 0.08], rm: RM.iron });
  addGeo(P, RBOX(W, 1.25, 1.25, 0.08), at(0, 1.28, -1.0), { col: body, rm: RM.paint });
  addGeo(P, BOX(W - 0.12, 0.6, 0.04), at(0, 1.45, -1.64, -0.12), { col: [0.03, 0.04, 0.05], rm: RM.glass });
  for (const sx of [-1, 1]) { const n = [sx * c, 0, -sx * s]; quadRU(P, [x + sx * (W / 2 + 0.045) * c + (-1.0) * s, y + 1.2, z - sx * (W / 2 + 0.045) * s + (-1.0) * c], RT(n), [0, 1, 0], 1.1, 0.55, A.truck, COL.white, RM.paint); }
  // flatbed with drop sides, a load under a tarp
  addGeo(P, BOX(W, 0.06, 1.9), at(0, 0.73, 0.65), { col: [0.3, 0.3, 0.31], rm: RM.galv });
  for (const sx of [-1, 1]) addGeo(P, BOX(0.04, 0.38, 1.9), at(sx * (W / 2 - 0.02), 0.95, 0.65), { col: [0.42, 0.43, 0.44], rm: RM.galv });
  addGeo(P, BOX(W, 0.38, 0.04), at(0, 0.95, 1.6), { col: [0.42, 0.43, 0.44], rm: RM.galv });
  addGeo(P, RBOX(1.3, 0.55, 1.6, 0.18), at(0, 1.05, 0.6), { col: [0.12, 0.16, 0.14], rm: RM.fabric });
  // amber beacon (small, dirty), mirrors
  addGeo(P, CYL(0.09, 0.1, 0.14, 8), at(0, 2.0, -1.0), { col: [1, 0.5, 0.15], rm: RM.glow, e: [0.6, 0.3, 0.08] });
  const bp = [x + (-1.0) * s, y + 2.02, z + (-1.0) * c];
  glow(S, bp, 0.7, [3.0, 1.3, 0.2], { blink: true, rate: 4.2 });
  const ax = Math.abs(s) > 0.5;
  S.colliders.push({ min: [x - (ax ? 1.7 : 0.8), y, z - (ax ? 0.8 : 1.7)], max: [x + (ax ? 1.7 : 0.8), y + 1.95, z + (ax ? 0.8 : 1.7)], data: { mat: 'metal', kind: 'truck_cover' } });
}
function bike(S, x, y, z, rot, lean = 0.25) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot), I = { col: [0.06, 0.065, 0.07], rm: RM.iron };
  const at = (lx, ly) => [x + lx * c + Math.sin(lean) * ly * s * 0, y + ly, z - lx * s];
  for (const lx of [-0.52, 0.52]) addGeo(P, TOR(0.33, 0.022, 4, 12), M4(x + lx * c, y + 0.34, z - lx * s, 0, rot, 0), I);
  const pts = { r: at(-0.52, 0.34), f: at(0.52, 0.34), b: at(-0.05, 0.34), s: at(-0.18, 0.88), h: at(0.42, 0.95) };
  for (const [a, b] of [['r', 'b'], ['b', 's'], ['s', 'r'], ['s', 'h'], ['b', 'h'], ['h', 'f']]) seg(P, pts[a], pts[b], 0.018, 0.018, 4, I);
  addGeo(P, BOX(0.06, 0.03, 0.5), M4(pts.h[0], pts.h[1] + 0.06, pts.h[2], 0, rot), I);
  addGeo(P, BOX(0.25, 0.05, 0.1), M4(pts.s[0], pts.s[1] + 0.04, pts.s[2], 0, rot), { col: COL.rubber, rm: RM.rubber });
}
function gangway(S, x, s) {
  // landing on the quay edge + gangplank down to the moored barge
  const P = S.B.props, G = { col: [0.18, 0.19, 0.2], rm: RM.galv }, ze = s * 40;
  addGeo(P, BOX(4.2, 0.12, 2.4), M4(x, LOW_Y + 0.06, ze + s * 1.3), { col: [0.15, 0.15, 0.15], rm: RM.iron });
  for (let k = 0; k < 14; k++) addGeo(P, BOX(4.1, 0.02, 0.05), M4(x, LOW_Y + 0.125, ze + s * (0.2 + k * 0.16)), { col: [0.22, 0.22, 0.22], rm: RM.iron });
  const gl = 3.8, ga = 0.12;
  const gz0 = ze, gz1 = ze - s * gl * Math.cos(ga);
  addGeo(P, BOX(1.2, 0.08, gl), M4(x, LOW_Y - Math.sin(ga) * gl / 2, (gz0 + gz1) / 2, -s * ga), { rect: A.wood, col: [0.5, 0.42, 0.34], rm: RM.wood });
  for (const sx of [-0.62, 0.62]) {
    seg(P, [x + sx, LOW_Y + 1.0, gz0], [x + sx, LOW_Y - Math.sin(ga) * gl + 1.0, gz1], 0.03, 0.03, 4, G);
    seg(P, [x + sx, LOW_Y + 0.5, gz0], [x + sx, LOW_Y - Math.sin(ga) * gl + 0.5, gz1], 0.02, 0.02, 4, G);
    for (let k = 0; k <= 3; k++) { const t = k / 3; seg(P, [x + sx, LOW_Y - Math.sin(ga) * gl * t, lerp(gz0, gz1, t)], [x + sx, LOW_Y - Math.sin(ga) * gl * t + 1.0, lerp(gz0, gz1, t)], 0.025, 0.025, 4, G); }
  }
  // landing railings (sides) + chain
  for (const sx of [-2.05, 2.05]) { seg(P, [x + sx, LOW_Y, ze + s * 0.2], [x + sx, LOW_Y + 1.05, ze + s * 0.2], 0.03, 0.03, 4, G); seg(P, [x + sx, LOW_Y + 1.05, ze + s * 0.2], [x + sx, LOW_Y + 1.05, ze + s * 2.4], 0.03, 0.03, 4, G); seg(P, [x + sx, LOW_Y, ze + s * 2.4], [x + sx, LOW_Y + 1.05, ze + s * 2.4], 0.03, 0.03, 4, G); }
  for (const sx of [-1.4, 1.4]) seg(P, [x + sx, LOW_Y + 1.0, ze + s * 0.2], [x + sx * 1.46, LOW_Y + 1.0, ze + s * 0.2], 0.03, 0.03, 4, G);
  postLamp(S, x + 2.05, LOW_Y + 0.12, ze + s * 2.4, { h: 2.6, glowSize: 0.95, k: 1.3, r: 9 });
  for (const sx of [-2.05, 2.05]) S.colliders.push({ min: [x + sx - 0.06, LOW_Y, Math.min(ze + s * 0.2, ze + s * 2.4)], max: [x + sx + 0.06, LOW_Y + 1.05, Math.max(ze + s * 0.2, ze + s * 2.4)], data: { mat: 'metal', kind: 'rail', thin: true } });
}
function bollard(S, x, z) {
  const P = S.B.props;
  addGeo(P, LATHE([[0.2, 0], [0.17, 0.38], [0.24, 0.5], [0.22, 0.6], [0.0, 0.64]], 7), M4(x, LOW_Y, z), { col: (p) => mix3([0.04, 0.042, 0.045], [0.16, 0.08, 0.04], sstep(0.55, 0.8, wn(p[0] * 6, p[1] * 6))), rm: RM.iron });
  S.colliders.push({ min: [x - 0.22, LOW_Y, z - 0.22], max: [x + 0.22, LOW_Y + 0.62, z + 0.22], data: { mat: 'metal', kind: 'bollard', thin: true } });
}
function mooringRing(S, x, s) {
  addGeo(S.B.props, TOR(0.17, 0.035, 3, 8), M4(x, LOW_Y - 0.28, s * 39.96, 0, 0, 0), { col: [0.1, 0.06, 0.04], rm: RM.iron });
  addGeo(S.B.props, BOX(0.12, 0.12, 0.06), M4(x, LOW_Y - 0.1, s * 39.98), { col: [0.08, 0.05, 0.04], rm: RM.iron });
  wallDecal(S.B.decal, [x, LOW_Y - 0.9, s * 39.99], [0, 0, -s], [0, 1, 0], 0.4, 1.4, D.streak, [0.8, 0.45, 0.25]);
}
function ladder(S, x, s) {
  const P = S.B.props, I = { col: [0.05, 0.05, 0.05], rm: RM.iron }, zl = s * 39.82;
  for (const sx of [-0.24, 0.24]) {
    seg(P, [x + sx, WATER_Y - 1, zl], [x + sx, LOW_Y - 0.1, zl], 0.028, 0.028, 5, I);
    const hp = []; for (let k = 0; k <= 5; k++) { const t = k / 5; hp.push([x + sx, LOW_Y - 0.1 + Math.sin(t * Math.PI) * 0.95, zl + s * (Math.cos(t * Math.PI) * -0.0 + t * 0.9 + 0.0)]); }
    for (let k = 0; k < 5; k++) seg(P, hp[k], hp[k + 1], 0.028, 0.028, 5, I);
  }
  for (let y = WATER_Y - 0.6; y < LOW_Y - 0.2; y += 0.3) seg(P, [x - 0.24, y, zl], [x + 0.24, y, zl], 0.018, 0.018, 4, I);
  wallDecal(S.B.decal, [x, LOW_Y - 0.9, s * 39.99], [0, 0, -s], [0, 1, 0], 0.9, 1.6, D.streak, [0.8, 0.5, 0.3]);
}
function lowerFurniture(S) {
  const rng = makeRng(9911), P = S.B.props;
  // wall lanterns along the retaining walls (walkable stretch dense, scenery stretch sparser)
  for (const s of [1, -1]) {
    for (let x = 22; x <= 340; x += 24) {
      // 3.2 m above the ground at the wall foot; skip the ones where a ramp lifts that above the
      // retaining wall's top (street level): they hung in the sky over the parapet
      const y = Math.max(LOW_Y, groundY(x, s * 51.5)) + 3.2;
      if (y + 0.6 > 0) continue;
      wallLantern(S, x, y, s);
    }
    for (let x = -30; x >= -330; x -= 40) farWallLamp(S, x, s);
    for (let x = 380; x <= 580; x += 50) farWallLamp(S, x, s);
  }
  // free-standing lamp posts on the quays
  for (const [x, z] of [[128, 51.0], [226, 51.0], [300, 51.0], [150, -51.0], [272, -51.0]]) postLamp(S, x, LOW_Y, z, { h: 3.2 });
  // bollards + mooring rings + ladders
  const gangX = [146, 96];
  for (const s of [1, -1]) {
    for (let x = -480; x < 620; x += 17) {
      if (Math.abs(x) < 18) continue;
      if (s < 0 && x > PONTOON.x0 - 3 && x < PONTOON.x1 + 3) continue;
      if (s > 0 && gangX.some((g) => Math.abs(g - x) < 3)) continue;
      if (x > -60 && x < 360) bollard(S, x + 0.5, s * 40.95);
      if (x > -60 && x < 380 && ((x / 17) | 0) % 2 === 0) mooringRing(S, x + 8, s);
    }
    for (const x of s > 0 ? [58, 132, 212, 300, -60, -180] : [128, 180, 240, 320, -70, -190]) ladder(S, x, s);
  }
  // NORTH lower quay: opening fight cover (x 40..180), leapfrog spacing ~12-14 m
  const N = 1, y = LOW_Y;
  planter(S, 164, y, 43.4, 2.2, 1.1, rng);                                         // near start
  bench(S, P, 178, y, 51.3, Math.PI); bench(S, P, 160, y, 51.3, Math.PI);
  planter(S, 168.5, y, 50.6, 1.2, 1.2, rng, false);
  gangway(S, 146, N);                                                              // barge gangway landing
  planter(S, 142.4, y, 42.8, 1.0, 1.0, rng, false); planter(S, 149.6, y, 42.8, 1.0, 1.0, rng, false);
  for (let k = 0; k < 3; k++) bike(S, 152.8 + k * 0.7, y, 41.9, Math.PI / 2 + 0.1, 0.0);
  S.colliders.push({ min: [152.4, y, 41.2], max: [154.6, y + 1.0, 42.6], data: { mat: 'metal', kind: 'bikes', thin: true } });
  // pallets + crates against the wall
  pallets(S, 136, y, 50.6, 6, 0.1); pallets(S, 137.4, y, 50.7, 4, -0.05);
  crate(S, 134.4, y, 50.8, 1.2, 1.0, 1.1, 0.15); crate(S, 134.5, y + 1.0, 50.8, 0.9, 0.7, 0.9, -0.1);
  col(S, [133.6, y, 49.9], [138.2, y + 1.7, 51.6], 'wood', { kind: 'crates' });
  // maintenance utility truck parked along the quay
  utilityTruck(S, 124, y, 44.2, Math.PI / 2 + 0.04);
  // the guinguette buvette: closed kiosk, stacked café chairs, tables, festoon
  buvette(S, 110, y, 49.9, -1);
  for (const [x, z, n] of [[104.3, 46.6, 6], [105.0, 46.0, 5], [115.8, 46.4, 7], [116.5, 47.1, 4]]) cafeChairStack(S, x, y, z, n, rng() * 3);
  for (const [x, z] of [[102.4, 44.6], [118.4, 44.5]]) { cafeTable(S, x, y, z); col(S, [x - 0.35, y, z - 0.35], [x + 0.35, y + 0.76, z + 0.35], 'metal', { thin: true }); }
  cafeTable(S, 103.2, y + 0.76, 44.6, true);
  // sandbag heap + concrete blocks (road works) further west
  sandbags(S, 97.5, y, 43.6, 3.0, 3, 0.15); sandbags(S, 99.5, y, 44.6, 1.6, 2, 1.2);
  col(S, [95.9, y, 42.9], [100.4, y + 0.66, 45.2], 'concrete', { kind: 'sandbags' });
  gangway(S, 90, N);
  // concrete planters row by the wall
  planter(S, 84, y, 50.4, 1.4, 1.4, rng); planter(S, 80.5, y, 50.4, 1.4, 1.4, rng);
  // crates under a tarp + a stack of police barriers' concrete feet
  crate(S, 72.2, y, 43.2, 1.3, 1.2, 1.2, 0.3); crate(S, 73.6, y, 42.9, 1.1, 0.9, 1.0, -0.2); crate(S, 72.8, y + 1.2, 43.1, 1.0, 0.7, 0.9, 0.5);
  addGeo(P, RBOX(2.8, 0.15, 1.9, 0.07), M4(73, y + 1.85, 43.1, 0.05, 0.2, 0.03), { col: [0.12, 0.17, 0.2], rm: RM.fabric });
  col(S, [71.3, y, 42.2], [74.4, y + 1.9, 44.1], 'wood', { kind: 'crates' });
  bench(S, P, 60, y, 44.9, 0);
  addGeo(P, CYL(0.3, 0.27, 0.9, 10), M4(57.6, y + 0.45, 45.0), { col: [0.15, 0.25, 0.18], rm: RM.paint });
  sandbags(S, 46.5, y, 43.0, 3.4, 3, -0.1);
  col(S, [44.6, y, 42.4], [48.4, y + 0.66, 43.7], 'concrete', { kind: 'sandbags' });
  for (const [x, z] of [[41, 44.6], [42.6, 44.5]]) { addGeo(S.B.stone, BOX(1.2, 0.85, 0.85), M4(x, y + 0.42, z), { ws: TS, col: (p) => stoneCol(p, { base: [0.66, 0.64, 0.6], top: y + 0.85 }), rm: RM.stone }); }
  col(S, [40.4, y, 44.05], [43.2, y + 0.85, 45.0], 'concrete', { kind: 'blocks' });
  // under the bridge end: old fishermen's crates, a chained bike
  crate(S, 19.2, y, 50.6, 1.1, 0.8, 1.0, 0.2); bike(S, 21.5, y, 51.4, 0.0, 0.0);
  // SOUTH lower quay (escape run): lighter, kept clear down the middle (|z| 43..49)
  const sy = -1;
  planter(S, 118, y, -50.6, 1.3, 1.3, rng); planter(S, 121.5, y, -50.6, 1.3, 1.3, rng);
  bench(S, P, 140, y, -41.7, Math.PI);
  pallets(S, 160, y, -50.7, 5, 0.2); crate(S, 162, y, -50.8, 1.2, 1.0, 1.0, -0.2);
  col(S, [159.2, y, -51.6], [162.8, y + 1.0, -49.8], 'wood', { kind: 'crates' });
  for (let k = 0; k < 4; k++) bike(S, 178.5 + k * 0.7, y, -41.6, Math.PI / 2, 0.0);
  S.colliders.push({ min: [178, y, -42.3], max: [181.2, y + 1.0, -40.9], data: { mat: 'metal', kind: 'bikes', thin: true } });
  buvette(S, 236, y, -50.8, 1, { w: 3.4, d: 1.8, small: true });
  for (const [x, z, n] of [[231.5, -50.9, 5], [240.6, -50.7, 6]]) cafeChairStack(S, x, y, z, n, rng() * 3);
  planter(S, 252, y, -41.8, 1.2, 1.2, rng, false);
  bench(S, P, 268, y, -51.3, 0);
  void sy;
  // the escape pontoon (floating steel deck, rails on the open sides, a boarding gap)
  const py = PONTOON.y, pz0 = PONTOON.z0, pz1 = PONTOON.z1, G = { col: [0.2, 0.21, 0.22], rm: RM.galv };
  addGeo(P, BOX(PONTOON.x1 - PONTOON.x0, 0.6, pz1 - pz0), M4((PONTOON.x0 + PONTOON.x1) / 2, py - 0.3, (pz0 + pz1) / 2), { col: [0.12, 0.12, 0.12], rm: RM.iron });
  for (let x = PONTOON.x0 + 0.2; x < PONTOON.x1; x += 0.3) addGeo(P, BOX(0.22, 0.03, pz1 - pz0 - 0.2), M4(x, py + 0.015, (pz0 + pz1) / 2), { rect: A.wood, col: [0.42, 0.36, 0.3], rm: RM.wood });
  for (const x of [PONTOON.x0 + 1.5, PONTOON.x1 - 1.5]) addGeo(P, CYL(0.25, 0.25, 6, 8), M4(x, WATER_Y - 0.5, pz1 + 0.3), { col: [0.1, 0.1, 0.1], rm: RM.iron });
  const railRun = (a, b) => { seg(P, [a[0], py + 1.0, a[1]], [b[0], py + 1.0, b[1]], 0.03, 0.03, 4, G); seg(P, [a[0], py + 0.5, a[1]], [b[0], py + 0.5, b[1]], 0.02, 0.02, 4, G); const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 1.5); for (let k = 0; k <= n; k++) { const t = k / n; seg(P, [lerp(a[0], b[0], t), py, lerp(a[1], b[1], t)], [lerp(a[0], b[0], t), py + 1.0, lerp(a[1], b[1], t)], 0.025, 0.025, 4, G); } };
  railRun([PONTOON.x0 + 0.1, pz0 + 0.1], [PONTOON.x0 + 0.1, pz1 - 0.1]); railRun([PONTOON.x1 - 0.1, pz0 + 0.1], [PONTOON.x1 - 0.1, pz1 - 0.1]);
  railRun([PONTOON.x0 + 0.1, pz1 - 0.1], [BOATGAP0, pz1 - 0.1]); railRun([BOATGAP1, pz1 - 0.1], [PONTOON.x1 - 0.1, pz1 - 0.1]);
  for (const x of [PONTOON.x0 + 0.1, BOATGAP0, BOATGAP1, PONTOON.x1 - 0.1]) S.colliders.push({ min: [x - 0.05, py, x === PONTOON.x0 + 0.1 || x === PONTOON.x1 - 0.1 ? pz0 : pz1 - 0.15], max: [x + 0.05, py + 1.0, pz1], data: { mat: 'metal', thin: true, kind: 'rail', noBullet: true } });
  S.colliders.push({ min: [PONTOON.x0, py, pz1 - 0.15], max: [BOATGAP0, py + 1.0, pz1], data: { mat: 'metal', kind: 'rail', noBullet: true } });
  S.colliders.push({ min: [BOATGAP1, py, pz1 - 0.15], max: [PONTOON.x1, py + 1.0, pz1], data: { mat: 'metal', kind: 'rail', noBullet: true } });
  // rubber fenders on the boarding gap + a pontoon lamp
  for (let x = BOATGAP0 + 0.3; x < BOATGAP1; x += 1.2) addGeo(P, CYL(0.16, 0.16, 0.7, 8), M4(x, py - 0.25, pz1 + 0.12, Math.PI / 2), { col: COL.rubber, rm: RM.rubber });
  postLamp(S, PONTOON.x0 + 0.5, py, pz1 - 0.5, { h: 2.8, glowSize: 1.1, k: 1.6, r: 10 });
}
const BOATGAP0 = 201, BOATGAP1 = 209;

// ---------------------------------------------------------------------- tower park
function hedgeBox(S, x0, z0, x1, z1, h = 0.7) {
  const G = S.B.green, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  addGeo(G, RBOX(x1 - x0, h, z1 - z0, 0.12), M4(cx, h / 2, cz), { ws: TL, col: (p) => mul([0.42, 0.48, 0.3], (0.62 + 0.4 * wn(p[0] * 0.8, p[2] * 0.8)) * (0.55 + 0.45 * sstep(0, h, p[1]))), rm: RM.lawn });
  S.colliders.push({ min: [x0, 0, z0], max: [x1, h, z1], data: { mat: 'wood', kind: 'hedge', noBullet: true } });
}
function hoops(S, x0, z0, x1, z1) {
  const P = S.B.props, L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.55), rot = Math.atan2(z1 - z0, x1 - x0);
  for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; addGeo(P, TOR(0.3, 0.014, 3, 6, Math.PI), M4(lerp(x0, x1, t), 0.0, lerp(z0, z1, t), 0, -rot, 0), { col: [0.03, 0.06, 0.04], rm: RM.iron }); }
}
function lawn(S, x0, z0, x1, z1) {
  surf(S.B.green, steps(x0, x1, 4), steps(z0, z1, 4), (x, z) => [x, 0.025, z], { n: () => [0, 1, 0], ws: TL, col: (p) => mul([0.36, 0.42, 0.24], (0.6 + 0.45 * wfbm(p[0] * 0.08, p[2] * 0.08) - 0.12 * sstep(0.6, 0.8, wn(p[0] * 0.3, p[2] * 0.3))) * 0.78), rm: RM.lawn });
  // edging hedges (gaps at the corners)
  hedgeBox(S, x0 + 1.2, z0 - 0.5, x1 - 1.2, z0); hedgeBox(S, x0 + 1.2, z1, x1 - 1.2, z1 + 0.5);
  hedgeBox(S, x0 - 0.5, z0 + 1.2, x0, z1 - 1.2); hedgeBox(S, x1, z0 + 1.2, x1 + 0.5, z1 - 1.2);
  for (let k = 0; k < 5; k++) decal(S.B.decal, lerp(x0, x1, S.rng()), 0.04, lerp(z0, z1, S.rng()), 3 + S.rng() * 3, 3 + S.rng() * 3, S.rng() * 6, D.leaves, [0.9, 0.9, 0.9], [0.8, 0, 1]);
}
function barrierLine(S, x0, z0, x1, z1) {
  // Vauban crowd-control barriers (galvanised, dull): 2.0 m panels on feet
  const P = S.B.props, G = { col: [0.24, 0.25, 0.26], rm: RM.galv }, L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.05)), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
  for (let k = 0; k < n; k++) {
    const a = [x0 + dx * k * 2.05, z0 + dz * k * 2.05], b = [a[0] + dx * 2.0, a[1] + dz * 2.0], jog = (S.rng() - 0.5) * 0.15;
    const A2 = [a[0] - dz * jog, a[1] + dx * jog], B2 = [b[0] - dz * jog, b[1] + dx * jog];
    for (const yy of [0.2, 1.1]) seg(P, [A2[0], yy, A2[1]], [B2[0], yy, B2[1]], 0.024, 0.024, 4, G);
    for (const p of [A2, B2]) { seg(P, [p[0], 0.06, p[1]], [p[0], 1.1, p[1]], 0.024, 0.024, 4, G); addGeo(P, BOX(0.06, 0.04, 0.6), M4(p[0], 0.03, p[1], 0, Math.atan2(dx, dz) + Math.PI / 2), G); }
    for (let t = 1; t < 6; t++) { const u = t / 6; seg(P, [lerp(A2[0], B2[0], u), 0.2, lerp(A2[1], B2[1], u)], [lerp(A2[0], B2[0], u), 1.1, lerp(A2[1], B2[1], u)], 0.008, 0.008, 3, G); }
  }
  const mnx = Math.min(x0, x1) - 0.3, mxx = Math.max(x0, x1) + 0.3, mnz = Math.min(z0, z1) - 0.3, mxz = Math.max(z0, z1) + 0.3;
  S.colliders.push({ min: [mnx, 0, mnz], max: [mxx, 1.1, mxz], data: { mat: 'metal', kind: 'barrier' } });
}
function booth(S, x, z, rot, { w = 2.6, d = 2.2, h = 2.7, sign = A.billets, window = [1.7, 1.25, 0.8], body = [0.2, 0.24, 0.22] } = {}) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot);
  const at = (lx, ly, lz) => M4(x + lx * c + lz * s, ly, z - lx * s + lz * c, 0, rot);
  const wp = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
  addGeo(P, BOX(w, h, d), at(0, h / 2, 0), { col: body, rm: RM.paint });
  addGeo(P, BOX(w + 0.4, 0.18, d + 0.4), at(0, h + 0.09, 0), { col: mul(body, 0.6), rm: RM.paint });
  addGeo(P, BOX(w + 0.06, 0.12, d + 0.06), at(0, 0.06, 0), { col: [0.06, 0.06, 0.06], rm: RM.iron });
  // front (-z local): lit window + counter + sign
  quadRU(P, wp(0, 1.55, -d / 2 - 0.012), [-c, 0, s], [0, 1, 0], w - 0.6, 1.0, A.window, COL.white, RM.glass, window);
  addGeo(P, BOX(w - 0.4, 0.06, 0.35), at(0, 1.02, -d / 2 - 0.15), { col: [0.1, 0.1, 0.1], rm: RM.iron });
  quadRU(P, wp(0, h - 0.28, -d / 2 - 0.022), [-c, 0, s], [0, 1, 0], w - 0.2, 0.42, sign, COL.white, RM.paint, [0.3, 0.26, 0.2]);
  quadRU(P, wp(0, 1.3, d / 2 + 0.012), [c, 0, -s], [0, 1, 0], 1.4, 1.5, A.poster2, COL.white, RM.paint);
  const lp = wp(0, 1.6, -d / 2 - 1.2);
  light(S, lp, 7, 1.0, [window[0] / 2, window[1] / 2, window[2] / 2]);
  const hw = Math.abs(c) * w / 2 + Math.abs(s) * d / 2, hd = Math.abs(s) * w / 2 + Math.abs(c) * d / 2;
  S.colliders.push({ min: [x - hw, 0, z - hd], max: [x + hw, h, z + hd], data: { mat: 'metal', kind: 'booth' } });
}
function crepeCart(S, x, z, rot) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot);
  const at = (lx, ly, lz, rx = 0, rz = 0) => M4(x + lx * c + lz * s, ly, z - lx * s + lz * c, rx, rot, rz);
  const wp = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
  for (const lx of [-0.9, 0.9]) addGeo(P, CYL(0.32, 0.32, 0.14, 10), at(lx, 0.32, 0.0, 0, Math.PI / 2), { col: COL.rubber, rm: RM.rubber });
  addGeo(P, RBOX(2.9, 1.6, 1.7, 0.1), at(0, 1.25, 0), { col: [0.55, 0.16, 0.12], rm: RM.paint });
  addGeo(P, BOX(2.9, 0.1, 1.7), at(0, 0.48, 0), { col: [0.08, 0.08, 0.08], rm: RM.iron });
  addGeo(P, RBOX(3.1, 0.16, 1.9, 0.06), at(0, 2.12, 0), { col: [0.85, 0.8, 0.7], rm: RM.paint });
  quadRU(P, wp(0, 1.45, -0.862), [-c, 0, s], [0, 1, 0], 1.8, 0.8, A.window, COL.white, RM.glass, [1.5, 1.05, 0.62]);
  quadRU(P, wp(0, 1.95, -0.872), [-c, 0, s], [0, 1, 0], 2.6, 0.32, A.crepes, COL.white, RM.paint, [0.4, 0.32, 0.22]);
  addGeo(P, BOX(2.6, 0.05, 0.5), at(0, 2.2, -1.1, -0.35), { rect: A.stripes, col: [0.85, 0.85, 0.85], rm: RM.fabric });
  beam(P, wp(1.3, 0.55, 0.85), wp(2.2, 0.4, 0.0), 0.06, 0.06, { col: COL.iron, rm: RM.iron });
  light(S, wp(0, 1.5, -1.6), 6.5, 0.9, [0.9, 0.62, 0.36]);
  const hw = Math.abs(c) * 1.6 + Math.abs(s) * 0.95, hd = Math.abs(s) * 1.6 + Math.abs(c) * 0.95;
  S.colliders.push({ min: [x - hw, 0, z - hd], max: [x + hw, 2.2, z + hd], data: { mat: 'metal', kind: 'cart' } });
}
function souvenirCart(S, x, z, rot) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot);
  const at = (lx, ly, lz) => M4(x + lx * c + lz * s, ly, z - lx * s + lz * c, 0, rot);
  addGeo(P, BOX(2.2, 1.0, 1.3), at(0, 0.6, 0), { rect: A.souvenir, col: [0.8, 0.78, 0.74], rm: RM.paint });
  for (const lx of [-0.8, 0.8]) addGeo(P, CYL(0.22, 0.22, 0.1, 8), at(lx, 0.22, 0.68), { col: COL.rubber, rm: RM.rubber });
  // trays of little gold towers
  for (let k = 0; k < 14; k++) addGeo(P, CONE(0.05, 0.26, 4), at(-0.9 + (k % 7) * 0.3, 1.24, -0.3 + Math.floor(k / 7) * 0.5), { col: COL.brass, rm: RM.gold });
  for (const [lx, lz] of [[-1.0, -0.55], [1.0, -0.55], [-1.0, 0.55], [1.0, 0.55]]) addGeo(P, CYL(0.025, 0.025, 1.2, 4), at(lx, 1.7, lz), { col: COL.iron, rm: RM.iron });
  addGeo(P, CONE(1.7, 0.5, 8), at(0, 2.5, 0), { rect: A.stripes, col: [0.78, 0.76, 0.72], rm: RM.fabric });
  const hw = Math.abs(c) * 1.15 + Math.abs(s) * 0.7, hd = Math.abs(s) * 1.15 + Math.abs(c) * 0.7;
  S.colliders.push({ min: [x - hw, 0, z - hd], max: [x + hw, 1.25, z + hd], data: { mat: 'wood', kind: 'cart' } });
}
function greenChairs(S, x, z, n, rot) {
  // stacked green metal park chairs, chained
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot), Gc = { col: [0.05, 0.12, 0.07], rm: RM.paint };
  for (let st = 0; st < n; st++) {
    const ox = x + (st - (n - 1) / 2) * 0.6 * c, oz = z - (st - (n - 1) / 2) * 0.6 * s, m = 5 + ((st * 3) % 4);
    for (let k = 0; k < m; k++) {
      const yy = 0.45 + k * 0.085;
      addGeo(P, BOX(0.44, 0.03, 0.44), M4(ox, yy, oz, 0, rot), Gc);
      for (let sl = 0; sl < 2; sl++) addGeo(P, BOX(0.44, 0.08, 0.02), M4(ox + 0.21 * s, yy + 0.2 + sl * 0.16, oz + 0.21 * c, -0.15, rot), Gc);
    }
    for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]) seg(P, [ox + a * c + b * s, 0, oz - a * s + b * c], [ox + a * c + b * s, 0.46, oz - a * s + b * c], 0.012, 0.012, 3, Gc);
  }
  const hw = Math.abs(c) * n * 0.3 + 0.3, hd = Math.abs(s) * n * 0.3 + 0.3;
  S.colliders.push({ min: [x - hw, 0, z - hd], max: [x + hw, 1.3, z + hd], data: { mat: 'metal', kind: 'chairs' } });
}
function newsKiosk(S, x, z, rot) {
  const P = S.B.props, c = Math.cos(rot), s = Math.sin(rot), G = { col: [0.05, 0.12, 0.08], rm: RM.paint };
  const at = (lx, ly, lz) => M4(x + lx * c + lz * s, ly, z - lx * s + lz * c, 0, rot);
  const wp = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
  addGeo(P, BOX(2.6, 2.3, 2.0), at(0, 1.15, 0), G);
  for (const [lz, sgn] of [[-1.012, 1], [1.012, -1]]) quadRU(P, wp(0, 1.15, lz), [-c * sgn, 0, s * sgn], [0, 1, 0], 2.3, 1.4, A.presse, COL.white, RM.paint);
  quadRU(P, wp(0, 2.15, -1.03), [-c, 0, s], [0, 1, 0], 2.4, 0.5, A.kiosk, COL.white, RM.paint, [0.45, 0.4, 0.28]);
  addGeo(P, BOX(3.0, 0.14, 2.4), at(0, 2.37, 0), G);
  addGeo(P, LATHE([[1.5, 0], [1.3, 0.25], [0.9, 0.5], [0.4, 0.72], [0.0, 0.8]], 8), at(0, 2.44, 0), G);
  addGeo(P, SPH(0.12, 6, 4), at(0, 3.3, 0), { col: COL.brass, rm: RM.gold });
  light(S, wp(0, 2.2, -2.0), 6, 0.8, [0.8, 0.7, 0.5]);
  const hw = Math.abs(c) * 1.3 + Math.abs(s) * 1.0, hd = Math.abs(s) * 1.3 + Math.abs(c) * 1.0;
  S.colliders.push({ min: [x - hw, 0, z - hd], max: [x + hw, 2.4, z + hd], data: { mat: 'metal', kind: 'kiosk' } });
}
function carousel(S, x, z) {
  // vintage manège: the platform + horses turn (spin bucket, local coords), the canopy is static
  const P = S.B.props, Sp = S.B.spin, R = 6.0, gold = { col: [0.6, 0.42, 0.16], rm: RM.gold };
  // static base step + central column + canopy
  addGeo(P, CYL(R + 0.35, R + 0.45, 0.3, 24), M4(x, 0.15, z), { col: [0.2, 0.12, 0.08], rm: RM.wood });
  addGeo(P, CYL(0.55, 0.6, 3.6, 12), M4(x, 1.8, z), { rect: A.mirror, col: [0.95, 0.85, 0.7], rm: RM.glow, e: [1.2, 0.95, 0.6] });
  addGeo(P, CYL(R + 0.3, R + 0.3, 0.7, 24, true), M4(x, 3.75, z), { rect: A.carousel, col: COL.white, rm: RM.paint, e: [0.5, 0.42, 0.32] });
  addGeo(P, CYL(R + 0.32, R + 0.32, 0.16, 24, true), M4(x, 3.33, z), { rect: A.bulbs, col: COL.white, rm: RM.glow, e: [2.4, 1.9, 1.3] });
  addGeo(P, CYL(R + 0.32, R + 0.32, 0.14, 24, true), M4(x, 4.17, z), { rect: A.bulbs, col: COL.white, rm: RM.glow, e: [2.4, 1.9, 1.3] });
  addGeo(P, CONE(R + 0.6, 2.3, 24), M4(x, 5.25, z), { rect: A.stripes, col: [0.9, 0.62, 0.52], rm: RM.fabric, e: [0.12, 0.08, 0.05] });
  addGeo(P, CYL(R + 0.3, 0.4, 0.15, 24), M4(x, 4.06, z, Math.PI), { col: [0.55, 0.36, 0.2], rm: RM.wood, e: [0.5, 0.35, 0.18] });
  // scalloped valance under the rim
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; addGeo(P, SPH(0.32, 6, 3, 0), M4(x + Math.cos(a) * (R + 0.31), 3.3, z + Math.sin(a) * (R + 0.31), 0, -a, 0, 0.7, 0.55, 0.12), { col: [0.6, 0.18, 0.14], rm: RM.paint, e: [0.4, 0.15, 0.1] }); }
  addGeo(P, CYL(0.06, 0.08, 1.4, 6), M4(x, 6.9, z), gold);
  addGeo(P, SPH(0.2, 8, 6), M4(x, 7.7, z), gold);
  addGeo(P, BOX(0.02, 0.5, 0.8), M4(x, 7.4, z + 0.4), { col: [0.6, 0.2, 0.16], rm: RM.fabric });
  // rotating platform (local around 0,0): deck, horses on brass poles, a carriage
  const deck = (p) => [0.42, 0.28, 0.18];
  addGeo(Sp, CYL(R, R, 0.2, 24), M4(0, 0.4, 0), { rect: A.wood, col: deck, rm: RM.wood });
  addGeo(Sp, CYL(R + 0.02, R + 0.02, 0.22, 24, true), M4(0, 0.39, 0), { rect: A.carousel, col: COL.white, rm: RM.paint });
  const rng = makeRng(818);
  for (let ring = 0; ring < 2; ring++) {
    const rr = ring ? 3.2 : 5.0, n = ring ? 6 : 10;
    for (let k = 0; k < n; k++) {
      const a = (k + ring * 0.5) / n * Math.PI * 2, hx = Math.cos(a) * rr, hz = Math.sin(a) * rr, yaw = -a, bob = 1.05 + 0.25 * Math.sin(k * 1.7 + ring);
      seg(Sp, [hx, 0.5, hz], [hx, 3.3, hz], 0.035, 0.035, 6, gold);
      const tint = [[0.85, 0.82, 0.76], [0.45, 0.3, 0.22], [0.82, 0.8, 0.78], [0.2, 0.18, 0.18], [0.78, 0.62, 0.42]][(rng() * 5) | 0];
      const H = { col: tint, rm: RM.paint }, m = (lx, ly, lz, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => M4(hx + Math.cos(yaw) * lx + Math.sin(yaw) * lz, bob + ly, hz - Math.sin(yaw) * lx + Math.cos(yaw) * lz, rx, yaw, rz, sx, sy, sz);
      // horse facing the direction of travel (tangent): body along local z
      addGeo(Sp, SPH(0.32, 7, 5), m(0, 0, 0, 0, 0, 0.72, 0.75, 1.45), H);
      addGeo(Sp, CYL(0.11, 0.16, 0.6, 6), m(0, 0.3, -0.46, -0.6), H);
      addGeo(Sp, RBOX(0.16, 0.2, 0.42, 0.06), m(0, 0.55, -0.68, 0.5), H);
      for (const [lx, lz, sw] of [[-0.13, -0.32, -0.6], [0.13, -0.3, 0.2], [-0.13, 0.32, 0.5], [0.13, 0.32, -0.3]]) addGeo(Sp, CYL(0.04, 0.05, 0.62, 4), m(lx, -0.38, lz + sw * 0.15, sw), H);
      addGeo(Sp, BOX(0.36, 0.05, 0.4), m(0, 0.24, 0.02), { col: [0.6, 0.12, 0.1], rm: RM.paint });
      addGeo(Sp, CYL(0.02, 0.05, 0.5, 5), m(0, 0.05, 0.62, 0.8), { col: [0.8, 0.75, 0.6], rm: RM.paint });
    }
  }
  for (const a of [0.3, 3.4]) { const cx = Math.cos(a) * 4.2, cz = Math.sin(a) * 4.2; addGeo(Sp, RBOX(1.0, 0.9, 1.6, 0.15), M4(cx, 0.95, cz, 0, -a), { col: [0.7, 0.55, 0.25], rm: RM.gold }); addGeo(Sp, BOX(0.9, 0.5, 0.1), M4(cx + Math.cos(a) * 0.45, 1.55, cz + Math.sin(a) * 0.45, 0, -a + Math.PI / 2), { col: [0.6, 0.15, 0.12], rm: RM.paint }); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.2; glow(S, [x + Math.cos(a) * (R + 0.4), 3.75, z + Math.sin(a) * (R + 0.4)], 1.5, [2.6, 1.7, 0.75]); }
  light(S, [x, 3.0, z], 15, 2.4, [1.0, 0.7, 0.42]);
  light(S, [x, 1.4, z], 7.5, 1.4, [1.0, 0.72, 0.45]);
  S.lamps.push([x, 3.75, z]);
  refl(S, [x, 3.7, z], 0, 8, 6.0);
  for (const [a, b, c2, d] of [[-R, -2.4, R, 2.4], [-2.4, -R, 2.4, R], [-4.4, -4.4, 4.4, 4.4]]) S.colliders.push({ min: [x + a, 0, z + b], max: [x + c2, 2.6, z + d], data: { mat: 'wood', kind: 'carousel' } });
  decal(S.B.decal, x, 0.014, z, 2 * R + 4.5, 2 * R + 4.5, 0, D.ao, [0.8, 0.8, 0.8]);
}
function park(S) {
  const { gravel } = S.B, r = S.rng;
  // gravel everywhere, slightly finer grid where the fights happen
  surf(gravel, steps(-90, 90, 3.6), steps(-78.3, -250, -3.6), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TG, col: gravelCol, rm: RM.gravel });
  surf(gravel, steps(-90, 90, 15), steps(-250, -300, -10), (x, z) => [x, 0, z], { n: () => [0, 1, 0], ws: TG, col: gravelCol, rm: RM.gravel });
  // granite edging between quay sidewalk and park
  curbX(S, steps(-90, 90, 3), -78.15, -1);
  // lawns framed by clipped hedges and hoops (clear of the leg plinths by 10 m)
  for (const sx of [-1, 1]) {
    lawn(S, sx > 0 ? 68 : -82, -126, sx > 0 ? 82 : -68, -112); lawn(S, sx > 0 ? 68 : -82, -168, sx > 0 ? 82 : -68, -132);
    lawn(S, sx > 0 ? 68 : -82, -244, sx > 0 ? 82 : -68, -214);
    lawn(S, sx > 0 ? 10 : -44, -244, sx > 0 ? 44 : -10, -216);
    lawn(S, sx > 0 ? 50 : -64, -234, sx > 0 ? 64 : -50, -212);
    hoops(S, sx * 67.2, -126, sx * 67.2, -112); hoops(S, sx * 67.2, -168, sx * 67.2, -132); hoops(S, sx > 0 ? 10 : -44, -215.2, sx > 0 ? 44 : -10, -215.2);
  }
  // vehicle ruts from the entrance to under the tower (police / service vans), with puddles in them
  for (const [x0, z0, x1, z1] of [[-3, -79, -6, -168], [3.5, -79, 22, -150], [-14, -79, -24, -100], [8, -200, -6, -168]]) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 6), rot = Math.atan2(x1 - x0, z1 - z0);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; decal(S.B.decal, lerp(x0, x1, t), 0.013, lerp(z0, z1, t), 2.4, L / n + 0.4, -rot, D.rut, [1, 1, 1], [0.5, 0, 1]); if (r() < 0.35) for (const o of [-0.85, 0.85]) pud(S, lerp(x0, x1, t) + o * Math.cos(rot), 0.015, lerp(z0, z1, t) - o * Math.sin(rot), 0.6, 1.6 + r() * 2, -rot, D.puddle); }
  }
  // granite edging along the allées (reads the path layout at eye height)
  for (const sx of [-1, 1]) for (const xe of [36.5, 66.5]) curbZ(S, steps(-80, -248, -8), sx * xe, sx);
  for (const sx of [-1, 1]) curbX(S, steps(sx > 0 ? 8 : -46, sx > 0 ? 46 : -8, 4), -206, -1);
  // puddles on the gravel (big, glossy), wheel ruts darkened, leaf litter
  for (let k = 0; k < 70; k++) { const x = (r() - 0.5) * 170, z = -82 - r() * 162; if (Math.abs(x) > 64 && z < -110) continue; pud(S, x, 0.014, z, 1.2 + r() * 3, 1.0 + r() * 2.2, r() * 6, r() < 0.5 ? D.puddle : D.puddle2); }
  for (let k = 0; k < 90; k++) { const x = (r() - 0.5) * 176, z = -80 - r() * 166; decal(S.B.decal, x, 0.013, z, 2 + r() * 3, 2 + r() * 3, r() * 6, r() < 0.5 ? D.leaves : D.leaves2, [0.85, 0.85, 0.85], [0.75, 0, 1]); }
  // park lamps along the paths
  for (const sx of [-1, 1]) {
    for (const z of [-118, -140, -162, -222, -240]) postLamp(S, sx * 63.5, 0, z);
    for (const z of [-222, -240]) postLamp(S, sx * 7.5, 0, z);
    postLamp(S, sx * 26, 0, -82.5); postLamp(S, sx * 78, 0, -82.5);
    for (const z of [-100, -140, -180]) postLamp(S, sx * 31, 0, z, { r: 14, k: 1.7 });
  }
  postLamp(S, 0, 0, -96, { r: 14, k: 1.7 }); postLamp(S, 0, 0, -186, { r: 14, k: 1.7 });
  // the tower's sodium floods at the feet spill gold across the gravel (baked)
  for (const L of LEGS) S.field.add({ p: [L.x * 0.82, 7, L.z * 0.82 + -140 * 0.18], c: [1.0, 0.5, 0.18], r: 42, k: 1.5, wrap: 0.6, min: 6 });
  S.field.add({ p: [0, 40, -140], c: [1.0, 0.55, 0.22], r: 80, k: 0.9, wrap: 0.8, min: 30 });
  // COVER for the gunship fight
  carousel(S, -42, -125);
  booth(S, 21.5, -93, Math.PI, { sign: A.billets });                                  // ticket kiosks (north entrance)
  booth(S, 16.5, -93, Math.PI, { w: 1.8, d: 1.8, h: 2.5, sign: A.secu, window: [1.4, 1.5, 1.7], body: [0.32, 0.33, 0.34] });
  booth(S, -2.5, -212, 0, { sign: A.billets });                                     // south ticket kiosk
  booth(S, 42, -131, -Math.PI / 2, { w: 1.8, d: 1.8, h: 2.5, sign: A.secu, window: [1.4, 1.5, 1.7], body: [0.32, 0.33, 0.34] });
  barrierLine(S, -18, -82.2, 10, -82.2);                                               // security line at the entrance
  barrierLine(S, -30, -100, -30, -88);
  barrierLine(S, -24, -184, -14, -184);
  barrierLine(S, 27, -122, 27, -112);
  crepeCart(S, 10, -128, 0.25);
  souvenirCart(S, -14, -150, -0.4);
  greenChairs(S, 26.5, -167.5, 4, 0.3);
  greenChairs(S, -22, -116, 3, -0.6);
  newsKiosk(S, -74, -84.5, Math.PI);
  planter(S, 60, 0, -140, 2.4, 2.4, r, false); planter(S, -60, 0, -150, 2.4, 2.4, r, false); planter(S, 56, 0, -152, 1.6, 1.6, r, false);
  planter(S, 8, 0, -190, 2.0, 1.2, r); planter(S, -7, 0, -232, 3.2, 1.4, r);
  sandbags(S, 4.5, 0, -110, 3.2, 3, 0.1); S.colliders.push({ min: [2.7, 0, -110.8], max: [6.4, 0.66, -109.2], data: { mat: 'concrete', kind: 'sandbags' } });
  for (const [x, z, rt] of [[-72, -104, Math.PI / 2], [72, -104, -Math.PI / 2], [-72, -176, Math.PI / 2], [72, -178, -Math.PI / 2], [-20, -210, 0], [24, -210, 0]]) bench(S, S.B.props, x, 0, z, rt);
  // flight cases / stage gear for tonight's show (under the south-west of the arena)
  crate(S, -30, 0, -162, 1.6, 1.1, 1.0, 0.2); crate(S, -28.3, 0, -162.4, 1.2, 1.4, 1.0, -0.1); crate(S, -29.2, 1.1, -162.1, 1.0, 0.6, 0.8, 0.3);
  S.colliders.push({ min: [-31, 0, -163.2], max: [-27.4, 1.7, -161.2], data: { mat: 'wood', kind: 'crates' } });
}

// ---------------------------------------------------------------------- build
export async function buildQuays(ctx = {}) {
  const M = materials(ctx.renderer);
  const S = mkState(ctx);
  lowerQuays(S); ramps(S); parapets(S); upperQuays(S); bridge(S);
  farBridge(S, -420, 61); farBridge(S, 520, 67);
  upperFurniture(S); bouquinistes(S); trees(S); lowerFurniture(S); park(S);
  const root = new THREE.Group(); root.name = 'quays';
  let tris = 0, draws = 0;
  const per = {};
  const add = (bk, mat, { order = 0, receive = true, split = null, parent = root } = {}) => {
    for (const part of finalize(bk, S.field, split)) {
      const nm = Object.keys(S.B).find((k) => S.B[k] === bk); per[nm] = (per[nm] || 0) + part.tris;
      const m = new THREE.Mesh(part.geometry, mat); m.receiveShadow = receive; m.castShadow = false; m.renderOrder = order; m.matrixAutoUpdate = false;
      parent.add(m); tris += part.tris; draws++;
    }
  };
  // regional splits so the GPU can cull: west / play area / east
  const region = (x) => (x < -150 ? 0 : x > 430 ? 2 : 1);
  const region5 = (x) => (x < -150 ? 0 : x < 40 ? 1 : x < 160 ? 2 : x < 430 ? 3 : 4);
  add(S.B.stone, M.stone, { split: (x) => region5(x) });
  add(S.B.cobble, M.cobble, { split: (x) => region(x) });
  add(S.B.asph, M.asph, { split: (x) => region(x) });
  add(S.B.gravel, M.gravel);
  add(S.B.green, M.green);
  add(S.B.props, M.props, { split: (x, y, z) => (z < -76 ? 10 : region5(x)) });
  add(S.B.leaves, M.leaves, { split: (x) => region(x) });
  add(S.B.decal, M.decal, { order: 1 });
  add(S.B.puddle, M.puddle, { order: 2 });
  // the carousel's turning platform
  const spin = new THREE.Group(); spin.position.set(-42, 0, -125); root.add(spin);
  const spinParts = finalize(S.B.spin, null);
  // bake the carousel light into the spinning part relative to its world position
  for (const p of spinParts) { const m = new THREE.Mesh(p.geometry, M.props); m.receiveShadow = true; spin.add(m); tris += p.tris; draws++; }
  // light the platform from the canopy bulbs (simple uniform warm emission in the glow channel)
  for (const p of spinParts) { const g = p.geometry.attributes.glow, pos = p.geometry.attributes.position; for (let i = 0; i < g.count; i++) { const y = pos.getY(i), k = 0.55 + 0.5 * sstep(0.4, 3.0, y); g.setXYZ(i, Math.max(g.getX(i), 1.0 * k), Math.max(g.getY(i), 0.68 * k), Math.max(g.getZ(i), 0.4 * k)); } g.needsUpdate = true; }
  root.updateMatrixWorld(true);
  const info = { per, draws, tris: Math.round(tris), glows: S.glows.length, reflect: S.reflect.length, lamps: S.lamps.length, colliders: S.colliders.length };
  return {
    root, colliders: S.colliders, info,
    anchors: { glows: S.glows, reflect: S.reflect, lamps: S.lamps },
    update(dt, t) { spin.rotation.y = -t * 0.32; spin.updateMatrixWorld(true); },
  };
}
