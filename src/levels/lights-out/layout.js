// =====================================================================================
//  LIGHTS OUT (rebuild) — every number of the level.
//
//  World frame: +x = east (upstream), +z = south, y up. The river runs east–west between z 160 and
//  z 420, sixty metres below the route. The whole on-foot route is ONE LEVEL (y 64): the start plaza
//  and the cliff road on the south bank, the bridge north across the gorge, the tower's forecourt on
//  the north bank. Across the river from the road, square on: the terraced hillside district (it
//  slides into the river). East of it, at the bridge's north end: Jinlong Tower. The glide leaves the
//  tower's roof and runs west, down the river, past everything you walked.
//
//  Rule of the rebuild: nothing may cross the player's eye line on the route ahead. The LANE boxes
//  below are kept clear of anything taller than ~1.2 m; props and cover dress the edges.
// =====================================================================================
export const Y = 64;                                                // the route's level
export const WATER_Y = 0;
export const RIVER = { z0: 160, z1: 420, x0: -1400, x1: 1600 };
export const QUAY = { y: 3, z0: 126, z1: 160 };                    // the north bank's riverside shelf
export const FARBANK = { z: 420 };                                  // the south bank's cliff line (the name is river.js's)

// ---------------------------------------------------------------- the north bank hillside (slide.js's contract: unchanged numbers)
export const SLIDE = { x0: 370, x1: 592, crack: 40, toe: 178, depth: 80, cuts: [370, 426, 481, 537, 592], rows: [40, 76, 112, 161.2], gone: false };
export const HILLE = { x0: 592, x1: 648 };                          // the static district east of the slide, up to the tower's podium
export const TERR = { z0: 40, d: 18, n: 6, y0: 64, dy: 10.5, quay: 148 };
export const hillY = (z) => z >= TERR.quay ? QUAY.y : TERR.y0 - TERR.dy * Math.max(0, Math.min(TERR.n - 1, Math.floor((z - TERR.z0) / TERR.d)));
export const scarY0 = (z) => { const w = Math.min(1, Math.max(0, (z - SLIDE.crack) / (SLIDE.toe - SLIDE.crack))); return TERR.y0 - SLIDE.depth * (1 - Math.pow(1 - w, 1.7)) * 0.86 - w * 6; };
export const PLAZA = { x0: 172, x1: 292, z0: 40, z1: 112, y: 40 };  // only z1 is used (slide.js: the west flank's bank profile)

// ---------------------------------------------------------------- the south bank: the start plaza and the cliff road
export const PLZ = { x0: 372, x1: 420, z0: 421, z1: 462 };          // Kuixing Plaza: a rooftop that is street level
export const ROAD = { x0: 372, x1: 716, z0: 421, z1: 446, lane: [426, 442], rail: 420.6, front: 446 };   // promenade 421–426, carriageway 426–442, pavement 442–446
export const BLOCK_X = 712;                                          // the road is barricaded east of the bridge mouth
// ---------------------------------------------------------------- the bridge (north–south, 260 m, deck at the route's level)
export const BRIDGE = { x0: 684, x1: 700, z0: 160, z1: 421, y: Y, masts: [232, 348], mastH: 96 };
// ---------------------------------------------------------------- the north bank: the tower's podium (its forecourt), the tower, the lift, the roof
export const PODIUM = { x0: 650, x1: 734, z0: 96, z1: 160 };
export const TOWER = { x0: 676, x1: 708, z0: 104, z1: 136, base: Y, h: 175 };
export const LIFT = { x0: 687, x1: 697, z0: 136, z1: 141, y0: Y, y1: 239, speed: 6.5 };   // an open platform up the south face
export const ROOFTOP = { x0: 676, x1: 708, z0: 104, z1: 136, y: 239, gap: [114, 126], locker: { x: 681.5, z: 130.5 } };   // gap: the jump (west parapet, a z range)
export const HINGE = { x: TOWER.x0, y: Y, z: (TOWER.z0 + TOWER.z1) / 2 };   // the tower goes over its west edge
export const FALL_DIR = [-1, 0, 0.06];                                // ...due west along the bank, into the hole the hill left

// ---------------------------------------------------------------- the glide: off the roof's west edge and down the river
// ~630 m at 1 : 2.64 (3.1 m/s down at 8.2 m/s). The first 250 m run straight, 30° south of west, out over the river;
// the tower goes almost due west 3 s after the canopy opens, so its crown sweeps past ~50 m off your right side at
// your own height and lands ahead of you on the bank. Then one slow turn (≤ 2°/s) to the west, down the river.
export const GLIDE = [
  [674.6, 240.6, 120], [644.3, 227.3, 137.5], [614, 214.1, 155], [583.7, 200.8, 172.5], [553.4, 187.6, 190], [523, 174.3, 207.5], [492.7, 161.1, 225], [458.1, 145.9, 245],
  [424, 131.9, 260], [388, 117.5, 271.5], [351, 103.1, 280], [313, 88.7, 286], [275, 73.9, 289.5], [237, 59.5, 291], [199, 45.1, 292], [162, 31.1, 292], [128, 18.2, 292], [100, 7.6, 292], [84, 2.2, 292],
];
export const GLIDE_SPEED = 8.2;
export const STEER_MAX = 10;
export const BOAT = { x0: 60, z: 292, speed: 0.8 };                  // the gunboat steams upstream to meet the end of the line
// where gunship one dies: the gold LED tower on the hill's crest (slide.js's c1 block)
export const CRASH = [447, 150, 57.5];

export const START = { x: 392, y: Y, z: 434, yaw: -Math.PI / 2 + 0.42 };   // facing east-north-east: the road ahead, the bridge and the gold tower to its left (yaw 0 looks along -z)

// ---------------------------------------------------------------- power districts
// R0..R3: the cliff road and its frontage, west → east (the wave runs down them); BR0..BR2: the bridge, south → north;
// HILL: the hillside district; TOWER must stay 10 (kit.js's dying-tower shader); FAR_*: the skylines.
export const DIST = {
  R0: 0, R1: 1, R2: 2, R3: 3, BR0: 4, BR1: 5, BR2: 6, HILL: 7, EAST: 8, FAR_N: 9, TOWER: 10, FAR_S: 11, FAR_E: 12, FAR_W: 13, FORE: 14, ALWAYS: 15,
  // aliases the kit modules still name
  WEST: 13, LST: 0, FAR_C: 11,
};
export const roadDist = (x) => x < 458 ? DIST.R0 : x < 544 ? DIST.R1 : x < 630 ? DIST.R2 : DIST.R3;
export const bridgeDist = (z) => z > 334 ? DIST.BR0 : z > 247 ? DIST.BR1 : DIST.BR2;

// ---------------------------------------------------------------- runtime state the ground depends on
export const STATE = { liftY: Y };

// =====================================================================================
//  Ground and the walk mask
// =====================================================================================
const inR = (x, z, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
export function terrainAt(x, z) {
  if (z >= RIVER.z0 && z <= RIVER.z1) return WATER_Y - 4;
  if (z > RIVER.z1) return Y;                                        // the south bank's cliff top
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
  { x0: 396, x1: 706, z0: 431, z1: 437 },        // down the middle of the cliff road
  { x0: 689, x1: 695, z0: 150, z1: 437 },        // the bridge's centre line, from the road onto the forecourt
  { x0: 688, x1: 696, z0: 141, z1: 160 },        // the forecourt, bridge mouth → lift
];

// ---------------------------------------------------------------- abandoned traffic (cover; most of it explodes): [x, z, yawDeg, type, flags]
// yaw 90 = nose toward -x (west), -90 = east; 0 = north, 180 = south. Everything sits in the kerb lanes, never the middle.
export const CARS = [
  // the plaza's edge
  [380, 455, 4, 'sedan'], [386.5, 456.5, 178, 'suv', 'haz'],
  // the cliff road, north lanes (z ~428.3: by the promenade)
  [440, 428.4, 92, 'taxi', 'open'], [468, 428.0, 85, 'sedan', 'haz'], [497, 428.6, 96, 'suv'], [529, 428.2, 88, 'sedan', 'open'], [563, 428.5, 97, 'taxi', 'alarm'],
  [596, 428.1, 90, 'van'], [632, 428.4, 84, 'sedan'], [660, 428.3, 100, 'police', 'haz'],
  // south lanes (z ~439.6: by the shops)
  [432, 439.8, -88, 'sedan'], [455, 440.0, -90, 'bus'], [484, 439.5, -96, 'taxi', 'open'], [512, 439.9, -84, 'sedan', 'haz'], [546, 439.6, -92, 'suv'],
  [578, 439.8, -86, 'taxi'], [611, 440.0, -90, 'bus'], [644, 439.5, -95, 'sedan', 'alarm'], [670, 439.9, -80, 'wreck', 'burn'],
  // the barricade east of the bridge mouth
  [714.5, 430, 20, 'police', 'haz'], [714.8, 438, 160, 'police', 'haz'],
  // the bridge: west lane (x ~686.8), east lane (x ~697.2)
  [686.9, 402, 4, 'sedan'], [686.7, 372, -6, 'taxi', 'open'], [686.9, 339, 3, 'van'], [686.8, 303, 8, 'sedan', 'haz'], [686.9, 262, -4, 'taxi'], [686.7, 222, 5, 'suv'], [686.9, 186, 2, 'sedan', 'alarm'],
  [697.2, 388, 178, 'taxi'], [697.3, 354, 186, 'sedan', 'open'], [697.1, 318, 180, 'wreck', 'burn'], [697.3, 282, 176, 'bus'], [697.2, 242, 184, 'sedan'], [697.1, 204, 172, 'taxi', 'haz'], [697.3, 174, 180, 'police', 'haz'],
  // the forecourt: their trucks, off to the sides
  [664, 150.5, 90, 'suv'], [671, 143, 60, 'van', 'open'], [719, 150.5, -90, 'suv', 'haz'], [713, 143, -60, 'suv'],
];

// low cover along the lane edges: [x0, z0, x1, z1, h] (jersey barriers, planters: all under eye height)
export const COVER = [
  // road: barriers stepping down both sides of the middle lane
  [424, 430.2, 428, 430.8, 0.85], [452, 437.2, 456, 437.8, 0.85], [480, 430.2, 484, 430.8, 0.85], [508, 437.2, 512, 437.8, 0.85], [540, 430.2, 544, 430.8, 0.85],
  [570, 437.2, 574, 437.8, 0.85], [604, 430.2, 608, 430.8, 0.85], [636, 437.2, 640, 437.8, 0.85], [666, 430.2, 670, 430.8, 0.85],
  // promenade planters (by the railing)
  [470, 422.2, 476, 423.6, 0.9], [520, 422.2, 526, 423.6, 0.9], [586, 422.2, 592, 423.6, 0.9], [640, 422.2, 646, 423.6, 0.9],
  // bridge: barriers at the lane edges
  [688.2, 384, 688.8, 388, 0.85], [695.2, 362, 695.8, 366, 0.85], [688.2, 328, 688.8, 332, 0.85], [695.2, 300, 695.8, 304, 0.85], [688.2, 270, 688.8, 274, 0.85],
  [695.2, 232, 695.8, 236, 0.85], [688.2, 206, 688.8, 210, 0.85], [695.2, 178, 695.8, 182, 0.85],
  // forecourt: planters and crates either side of the lane
  [656, 146, 660, 149, 1.0], [676, 152, 682, 154.4, 1.0], [702, 152, 708, 154.4, 1.0], [724, 146, 728, 149, 1.0], [660, 138, 668, 140, 1.0], [716, 138, 724, 140, 1.0], [678, 144, 684, 145.4, 1.0], [700, 144, 706, 145.4, 1.0],
  // the roof: plant housings by the corners (the middle and the west edge stay open)
  [700, 106, 706, 110, 1.3], [700, 126, 706, 130, 1.3], [680, 106, 686, 109, 1.2],
];
