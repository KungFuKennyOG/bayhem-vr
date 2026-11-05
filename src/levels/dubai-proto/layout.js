import { makeRng } from '../../rng.js';

// =====================================================================================
//  DUBAI PROTOTYPE — numbers + URL flags. Grey boxes only: this level exists to measure
//  whether the Level 8 finale (a whole skyline coming down, seen from a door-gunner heli)
//  fits the Quest 3 budget. See DESIGN.md for the flags and the test plan.
// =====================================================================================

export function readFlags(params, isQuest) {
  const num = (k, d, lo = -Infinity, hi = Infinity) => { const v = parseFloat(params.get(k)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const bool = (k, d) => (params.has(k) ? params.get(k) !== '0' && params.get(k) !== 'false' : d);
  const dust = (params.get('dust') || 'mid').toLowerCase();
  return {
    towers: Math.round(num('towers', 6, 0, 12)),     // mid-distance towers with the cheap vertex-shader rig
    hero: bool('hero', true),                          // the supertall with the full chunk + glass treatment
    far: Math.round(num('far', 48, 0, 160)),           // far skyline towers (intact <-> pre-ruined swap)
    dust: ['off', 'low', 'mid', 'high'].includes(dust) ? dust : 'mid',
    fill: num('fill', 0, 0, 40),                       // DustClouds fillBudget in screens (0 = no cap)
    occl: bool('occl', true),                          // DustClouds occlusion cull
    glass: bool('glass', true),                        // hero glass waterfall (glass.js shard pool)
    fx: bool('fx', true),                              // shared fx.js explosions on the hero face
    detail: Math.round(num('detail', 1, 1, 8)),        // vertex density multiplier (emulates final-art meshes)
    swap: bool('swap', true),                          // far skyline swap on/off
    swapdebug: bool('swapdebug', false),               // ruined far towers tinted red (spot swaps in the headset)
    escort: bool('escort', true),                      // the WIDOWMAKER gunship (heli.js) flying alongside
    speed: num('speed', 38, 5, 90),                    // cruise speed m/s
    bank: num('bank', 6, 0, 25),                       // max cabin roll in degrees (0 = horizon-locked cabin)
    pitch: num('pitch', 1.5, 0, 10),                   // max cabin pitch in degrees
    alt: num('alt', 250, 80, 600),                     // rail altitude
    radius: num('radius', 640, 300, 1400),             // rail loop radius
    beat: (params.get('beat') || 'cycle').toLowerCase(),
    slowmo: bool('slowmo', true),                      // world slow-mo on the hero fall (the heli keeps real time)
    hz: num('hz', 72, 0, 120),                         // XR display rate to request: 72 = the Level 8 target (90 / 120 to compare, 0 = browser default)
    panel: (params.get('panel') || 'cabin').toLowerCase(),
    gpu: bool('gpu', true),                            // GPU timer queries if the browser has them
    isQuest,
  };
}

// dust level → cloud pool, spawn-rate and size multipliers
export const DUST = {
  off: { max: 1, rate: 0, size: 0 },
  low: { max: 60, rate: 0.45, size: 0.8 },
  mid: { max: 120, rate: 1, size: 1 },
  high: { max: 240, rate: 1.8, size: 1.2 },
};

// ---- the city (metres; hero tower at the origin, +y up, sun low in the west-south-west)
export const HERO = {
  h: 470,          // roof of the occupied floors
  band: 16,        // one chunk band = 4 floors
  w0: 62, w1: 30,  // footprint at the base / at the top band
  spire: 130,      // spire above the roof
  breakBand: 17,   // the upper section hinges here (≈ 270 m)
  name: 'THE SPINDLE',
};

// mid-distance ring: 12 slots, `towers` of them are used (nearest the rail first)
export function midTowers(n) {
  const rng = makeRng(808);
  const out = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + (rng() - 0.5) * 0.25;
    const r = 250 + rng() * 230;
    const h = 170 + rng() * 210;
    const w = 34 + rng() * 22, d = 34 + rng() * 22;
    const mode = ['tilt', 'pancake', 'lean'][i % 3];
    out.push({ i, x: Math.cos(a) * r, z: Math.sin(a) * r, h, w, d, mode, setback: rng() < 0.6, rot: rng() * Math.PI });
  }
  // interleave so that n = 4..6 still spreads them around the loop
  const order = [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11];
  return order.slice(0, n).map((k, j) => ({ ...out[k], slot: j }));
}

// far skyline: a ring well beyond the rail, behind which the dust sea rolls out
export function farTowers(n) {
  const rng = makeRng(4242);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * (Math.PI * 2 / n) * 0.8;
    const r = 1300 + rng() * 1200;
    const h = 90 + rng() * 260 * (1 - (r - 1300) / 2400);
    out.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h, w: 30 + rng() * 40, d: 30 + rng() * 40, rot: rng() * Math.PI, ruin: 0.18 + rng() * 0.3 });
  }
  return out;
}

// the rail: a closed loop, ordered clockwise seen from above (decreasing angle) so the city
// centre stays on the LEFT of the heli, where the open door is
export function railPoints(F) {
  // a smooth closed curve (low-frequency radius / height waves sampled densely): random knots made 1 g corners
  const pts = [];
  const N = 48;
  for (let i = 0; i < N; i++) {
    const a = -(i / N) * Math.PI * 2;
    const r = F.radius * (1 + 0.1 * Math.sin(2 * a + 0.7) + 0.04 * Math.sin(3 * a + 2.1));
    const y = F.alt * (1 + 0.08 * Math.sin(2 * a + 1.3) + 0.03 * Math.sin(3 * a));
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return pts;
}
export const GROUND_Y = 0;
