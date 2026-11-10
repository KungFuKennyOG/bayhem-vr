// =====================================================================================
//  LIGHTS OUT (rebuild) — every number of the level.
//
//  World frame: +x = east (upstream), +z = south, y up. The river runs east–west between z 160 and
//  z 300, in a gorge. The whole on-foot route is ONE LEVEL (y 20, a road on a retaining wall twenty
//  metres over the water): the start plaza and the cliff road on the south bank, the bridge north
//  across the gorge, the tower's forecourt on the north bank. Across the river from the road, square
//  on and RISING ABOVE YOU (its quay at y 3, its crest at y 64, 120–260 m away): the terraced
//  hillside district (it slides into the river). The route is low so that hill is a wall of lit
//  terraces over the railing from anywhere on the road, not a strip hidden under your own cliff edge. East of it, at the bridge's north end: Jinlong Tower. The glide leaves the
//  tower's roof and runs west, down the river, past everything you walked.
//
//  Rule of the rebuild: nothing may cross the player's eye line on the route ahead. The LANE boxes
//  below are kept clear of anything taller than ~1.2 m; props and cover dress the edges.
// =====================================================================================
export const Y = 20;                                                // the route's level
export const WATER_Y = 0;
export const RIVER = { z0: 160, z1: 300, x0: -1400, x1: 1600 };
export const QUAY = { y: 3, z0: 126, z1: 160 };                    // the north bank's riverside shelf
export const FARBANK = { z: 300 };                                  // the south bank's cliff line (the name is river.js's)

// ---------------------------------------------------------------- the north bank hillside (slide.js's contract: unchanged numbers)
export const SLIDE = { x0: 370, x1: 592, crack: 40, toe: 178, depth: 80, cuts: [370, 426, 481, 537, 592], rows: [40, 76, 112, 161.2], gone: false };
export const HILLE = { x0: 592, x1: 648 };                          // the static district east of the slide, up to the tower's podium
export const TERR = { z0: 40, d: 18, n: 6, y0: 64, dy: 10.5, quay: 148 };
export const hillY = (z) => z >= TERR.quay ? QUAY.y : TERR.y0 - TERR.dy * Math.max(0, Math.min(TERR.n - 1, Math.floor((z - TERR.z0) / TERR.d)));
export const scarY0 = (z) => { const w = Math.min(1, Math.max(0, (z - SLIDE.crack) / (SLIDE.toe - SLIDE.crack))); return TERR.y0 - SLIDE.depth * (1 - Math.pow(1 - w, 1.7)) * 0.86 - w * 6; };
export const PLAZA = { x0: 172, x1: 292, z0: 40, z1: 112, y: 40 };  // only z1 is used (slide.js: the west flank's bank profile)

// ---------------------------------------------------------------- the south bank: the start plaza and the cliff road
export const PLZ = { x0: 372, x1: 420, z0: 301, z1: 342 };          // Kuixing Plaza: a rooftop that is street level
export const ROAD = { x0: 372, x1: 716, z0: 301, z1: 326, lane: [306, 322], rail: 300.6, front: 326 };   // promenade 301–306, carriageway 306–322, pavement 322–326
export const LZ = 314;                                               // the road's centre line
export const BLOCK_X = 712;                                          // the road is barricaded east of the bridge mouth
// ---------------------------------------------------------------- the bridge (north–south, 141 m, deck at the route's level, one pair of masts)
export const BRIDGE = { x0: 684, x1: 700, z0: 160, z1: 301, y: Y, masts: [230], mastH: 104 };
// ---------------------------------------------------------------- the north bank: the tower's podium (its forecourt), the tower, the lift, the roof
export const PODIUM = { x0: 650, x1: 734, z0: 96, z1: 160 };
export const TOWER = { x0: 676, x1: 708, z0: 104, z1: 136, base: Y, h: 195 };
export const LIFT = { x0: 687, x1: 697, z0: 136, z1: 141, y0: Y, y1: 215, speed: 6.5 };   // an open platform up the south face
export const ROOFTOP = { x0: 676, x1: 708, z0: 104, z1: 136, y: 215, gap: [114, 126], locker: { x: 681.5, z: 130.5 } };   // gap: the jump (west parapet, a z range)
export const HINGE = { x: TOWER.x0, y: Y, z: (TOWER.z0 + TOWER.z1) / 2 };   // the tower goes over its west edge
export const FALL_DIR = [-1, 0, 0.06];                                // ...due west along the bank, into the hole the hill left

// ---------------------------------------------------------------- the glide: off the roof's west edge and down the river
// ~566 m at 1 : 2.64 (3.1 m/s down at 8.2 m/s). The first 150 m run straight, 30° south of west, out over the river;
// the tower goes due west 3 s after the canopy opens, so its crown sweeps past ~50 m off your right side at your own
// height and lands ahead of you on the bank. Then one slow turn (≤ 3°/s) to the west, down the middle of the river.
export const GLIDE = [
  [674.6, 216.6, 120], [631.3, 197.7, 145], [588, 178.7, 170], [544.7, 159.8, 195], [503, 142.2, 215.5], [462, 126.1, 227], [421, 110.4, 232.5], [380, 94.8, 234],
  [340, 79.7, 234], [300, 64.5, 234], [260, 49.4, 234], [220, 34.2, 234], [180, 19.1, 234], [150, 7.7, 234], [136, 2.4, 234],
];
export const GLIDE_SPEED = 8.2;
export const STEER_MAX = 10;
export const BOAT = { x0: 60, z: 234, speed: 0.8 };                  // the gunboat steams upstream to meet the end of the line
// where gunship one dies: the gold LED tower on the hill's crest (slide.js's c1 block)
export const CRASH = [447, 150, 57.5];

export const START = { x: 392, y: Y, z: 314, yaw: -Math.PI / 2 + 0.42 };   // facing east-north-east: the road ahead, the bridge and the gold tower to its left (yaw 0 looks along -z)

// ---------------------------------------------------------------- power districts
// R0..R3: the cliff road and its frontage, west → east (the wave runs down them); BR0..BR2: the bridge, south → north;
// HILL: the hillside district; TOWER must stay 10 (kit.js's dying-tower shader); FAR_*: the skylines.
export const DIST = {
  R0: 0, R1: 1, R2: 2, R3: 3, BR0: 4, BR1: 5, BR2: 6, HILL: 7, EAST: 8, FAR_N: 9, TOWER: 10, FAR_S: 11, FAR_E: 12, FAR_W: 13, FORE: 14, ALWAYS: 15,
  // aliases the kit modules still name
  WEST: 13, LST: 0, FAR_C: 11,
};
export const roadDist = (x) => x < 458 ? DIST.R0 : x < 544 ? DIST.R1 : x < 630 ? DIST.R2 : DIST.R3;
export const bridgeDist = (z) => z > 254 ? DIST.BR0 : z > 207 ? DIST.BR1 : DIST.BR2;

// ---------------------------------------------------------------- runtime state the ground depends on
export const STATE = { liftY: Y };

// =====================================================================================
//  Ground and the walk mask
// =====================================================================================
const inR = (x, z, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
export function terrainAt(x, z) {
  if (z >= RIVER.z0 && z <= RIVER.z1) return WATER_Y - 4;
  if (z > RIVER.z1) return Y;                                        // the south bank's road level
  if (x > SLIDE.x0 && x < SLIDE.x1 && z > SLIDE.crack) return SLIDE.gone ? Math.max(WATER_Y - 4, scarY0(z)) : hillY(z);
  if (z > TERR.z0) return hillY(z);
  return TERR.y0;
}
// floors the player / soldiers / particles stand on (null = terrain)
export function structFloor(x, z) {
  if (inR(x, z, LIFT)) return STATE.liftY;
  if (inR(x, z, TOWER)) return ROOFTOP.y;                            // nobody stands inside the tower: its footprint is its roof
  if (inR(x, z, PODIUM)) return Y;
  if (inR(x, z, BRIDGE)) return Y;
  return null;
}
export function groundAt(x, z) { const s = structFloor(x, z); return s ?? terrainAt(x, z); }

// where the PLAYER (and the soldiers' nav) may walk at street level
export function walkable(x, z) {
  if (z > ROAD.z0 + 0.6 && z < ROAD.z1 - 0.5 && x > ROAD.x0 + 0.6 && x < BLOCK_X - 0.6) return true;
  if (inR(x, z, PLZ, -0.6)) return true;
  if (x > BRIDGE.x0 + 0.7 && x < BRIDGE.x1 - 0.7 && z > BRIDGE.z0 - 1 && z < BRIDGE.z1 + 1) return true;
  if (inR(x, z, PODIUM, -0.7) && !inR(x, z, TOWER, 0.5)) return true;
  if (inR(x, z, LIFT, -0.3) || (x > LIFT.x0 + 0.3 && x < LIFT.x1 - 0.3 && z > LIFT.z1 - 0.5 && z < LIFT.z1 + 0.5)) return true;
  return false;
}
export const roofWalk = (x, z) => inR(x, z, ROOFTOP, -0.6) || (x > LIFT.x0 + 0.3 && x < LIFT.x1 - 0.3 && z >= ROOFTOP.z1 - 0.7 && z < LIFT.z1 - 0.3);

// ---------------------------------------------------------------- the lanes that must stay clear (checked by tools: nothing > 1.2 m inside them)
export const LANES = [
  { x0: 396, x1: 706, z0: 311, z1: 317 },        // down the middle of the cliff road
  { x0: 689, x1: 695, z0: 150, z1: 317 },        // the bridge's centre line, from the road onto the forecourt
  { x0: 688, x1: 696, z0: 141, z1: 160 },        // the forecourt, bridge mouth → lift
];

// ---------------------------------------------------------------- abandoned traffic (cover; most of it explodes): [x, z, yawDeg, type, flags]
// yaw 90 = nose toward -x (west), -90 = east; 0 = north, 180 = south. Everything sits in the kerb lanes, never the middle.
export const CARS = [
  // the plaza's edge
  [380, 335, 4, 'sedan'], [386.5, 336.5, 178, 'suv', 'haz'],
  // the cliff road, north lanes (z ~308.3: by the promenade)
  [440, 308.4, 92, 'taxi', 'open'], [468, 308, 85, 'sedan', 'haz'], [497, 308.6, 96, 'suv'], [529, 308.2, 88, 'sedan', 'open'], [563, 308.5, 97, 'taxi', 'alarm'],
  [596, 308.1, 90, 'van'], [632, 308.4, 84, 'sedan'], [660, 308.3, 100, 'police', 'haz'],
  // south lanes (z ~319.6: by the shops)
  [432, 319.8, -88, 'sedan'], [455, 320, -90, 'bus'], [484, 319.5, -96, 'taxi', 'open'], [512, 319.9, -84, 'sedan', 'haz'], [546, 319.6, -92, 'suv'],
  [578, 319.8, -86, 'taxi'], [611, 320, -90, 'bus'], [644, 319.5, -95, 'sedan', 'alarm'], [670, 319.9, -80, 'wreck', 'burn'],
  // the barricade east of the bridge mouth
  [714.5, 310, 20, 'police', 'haz'], [714.8, 318, 160, 'police', 'haz'],
  // the bridge: west lane (x ~686.8), east lane (x ~697.2)
  [686.9, 290.7, 4, 'sedan'], [686.7, 274.5, -6, 'taxi', 'open'], [686.9, 256.7, 3, 'van'], [686.8, 237.3, 8, 'sedan', 'haz'], [686.9, 215.1, -4, 'taxi'], [686.7, 193.5, 5, 'suv'], [686.9, 174, 2, 'sedan', 'alarm'],
  [697.2, 283.2, 178, 'taxi'], [697.3, 264.8, 186, 'sedan', 'open'], [697.1, 245.4, 180, 'wreck', 'burn'], [697.3, 225.9, 176, 'bus'], [697.2, 204.3, 184, 'sedan'], [697.1, 183.8, 172, 'taxi', 'haz'], [697.3, 167.6, 180, 'police', 'haz'],
  // the forecourt: their trucks, off to the sides
  [664, 150.5, 90, 'suv'], [671, 143, 60, 'van', 'open'], [719, 150.5, -90, 'suv', 'haz'], [713, 143, -60, 'suv'],
];

// low cover along the lane edges: [x0, z0, x1, z1, h] (jersey barriers, planters: all under eye height)
export const COVER = [
  // road: barriers stepping down both sides of the middle lane
  [424, 310.2, 428, 310.8, 0.85], [452, 317.2, 456, 317.8, 0.85], [480, 310.2, 484, 310.8, 0.85], [508, 317.2, 512, 317.8, 0.85], [540, 310.2, 544, 310.8, 0.85],
  [570, 317.2, 574, 317.8, 0.85], [604, 310.2, 608, 310.8, 0.85], [636, 317.2, 640, 317.8, 0.85], [666, 310.2, 670, 310.8, 0.85],
  // promenade planters (by the railing)
  [470, 302.2, 476, 303.6, 0.9], [520, 302.2, 526, 303.6, 0.9], [586, 302.2, 592, 303.6, 0.9], [640, 302.2, 646, 303.6, 0.9],
  // bridge: barriers at the lane edges
  [688.2, 281, 688.8, 284, 0.85], [695.2, 269.1, 695.8, 272.1, 0.85], [688.2, 250.8, 688.8, 253.8, 0.85], [695.2, 235.6, 695.8, 238.6, 0.85], [688.2, 219.4, 688.8, 222.4, 0.85],
  [695.2, 198.9, 695.8, 201.9, 0.85], [688.2, 184.9, 688.8, 187.9, 0.85], [695.2, 169.7, 695.8, 172.7, 0.85],
  // forecourt: planters and crates either side of the lane
  [656, 146, 660, 149, 1], [676, 152, 682, 154.4, 1], [702, 152, 708, 154.4, 1], [724, 146, 728, 149, 1], [660, 138, 668, 140, 1], [716, 138, 724, 140, 1], [678, 144, 684, 145.4, 1], [700, 144, 706, 145.4, 1],
  // the roof: plant housings by the corners (the middle and the west edge stay open)
  [700, 106, 706, 110, 1.3], [700, 126, 706, 130, 1.3], [680, 106, 686, 109, 1.2],
];
