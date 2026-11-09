// =====================================================================================
//  LIGHTS OUT — every number in the level lives here (metres, y up, east = +x, NORTH = -z).
//
//  Longwu (a fictional Chongqing): a city stacked up a cliff over the Yan river. The river runs
//  east-west along the south (z > 160); a tributary ravine cuts north-south through the cliff at
//  x 112..172. The play route runs west → east along the north bank, always DOWN and UP:
//
//   ROOF (y 64)   the ring road comes out on a building's roof; the intro vantage over the gorge
//   STAIRS        the Hundred Steps: a stepped street down to Lantern Street, under the ring-road flyover
//   LSTREET (50)  Lantern Street along the cliff top; Lantern Cliff (the stilt-house wall) drops below it
//   GSTAIR        an open stair inside the stilt complex, down to the gallery
//   G40 (40)      the covered gallery halfway down Lantern Cliff, lanterns overhead, the river below
//   BRIDGE (40)   the Qiansi through-arch bridge over the ravine (38 m drop, gold-lit arch above you)
//   PLAZA (40)    the east bank under the stacked interchange (flyovers at y 48 / 56) and the substation
//   CLIMB         a stair street up to the cliff top on the east bank
//   SKYST (56)    Sky Street; the footbridge into JINLONG TOWER, whose 20th floor is the street
//   LOBBY / TERR  the sky lobby and its river terrace: the jump
//   GLIDE         the canopy ride down over the river, under the Chaotian bridge, onto the gunboat
//
//  Ground is ONE 2D function (struct footprints never overlap in xz); the walk mask says where the
//  player / the soldiers' nav may go (the locomotion stops at its edge like a ledge).
// =====================================================================================

export const WATER_Y = 0;
export const RIVER = { z0: 160, z1: 600, x0: -1400, x1: 1600 };
export const QUAY = { y: 3, z0: 126, z1: 160 };                  // the riverside shelf under the cliff (not walkable)
export const FARBANK = { z: 600 };                               // the south bank cliff starts here

// ---------------------------------------------------------------- west bank
// the start: the ring road comes out onto the roof of the Longwu Department Store
export const ROOF = { x0: -172, x1: -128, z0: 50, z1: 96, y: 64 };
export const RING = { x0: -164, x1: -146, z0: -60, z1: 50, y: 64 };          // the ring road arriving from the north (barricaded at z 34)
export const RING_BLOCK = 34;
// the Hundred Steps: x profile (flights + landings), falls east from the roof to Lantern Street
export const STAIRS = { x0: -128, x1: -64, z0: 70, z1: 82 };
export const STAIR_PROFILE = [[-128, 64], [-119, 64], [-112, 59.5], [-99, 59.5], [-92, 55], [-77, 55], [-69, 50], [-64, 50]];   // 33° flights (7 m for 4.5 m), long landings
// the ring-road flyover crossing over the stairs (perch gunmen on it shoot down the steps)
export const FLYOVER_W = { x0: -94, x1: -80, z0: -40, z1: 200, y: 64.6, t: 1.4 };
// Lantern Street on the cliff top: shops north, the gorge railing south
export const LSTREET = { x0: -64, x1: 108, z0: 66, z1: 96, y: 50, road: [71, 87], rail: 96 };
// Lantern Cliff: the stilt-house complex hanging off the cliff from the street down to the quay
export const CLIFF_W = { x0: -60, x1: 112, zTop: 96, zFoot: 126 };
// the gate in the railing and the open stair inside the complex down to the gallery
export const GATE = { x0: 80, x1: 88, z0: 96, z1: 100, y: 50 };
export const GSTAIR = { x0: 62, x1: 88, z0: 100, z1: 104, xTop: 80, y0: 50, y1: 40 };   // falls toward -x from xTop
export const GLAND = { x0: 54, x1: 62, z0: 100, z1: 104, y: 40 };
export const G40 = { x0: 20, x1: 112, z0: 104, z1: 114, y: 40, roof: 44.6 };            // the covered gallery
export const BALC = { z0: 114, z1: 117.4, y: 45.4 };                                    // the storey above: balconies over the gallery's river side
export const LOWROOF = { z0: 116.6, z1: 121, y: 35.5 };                                 // the roof terrace one storey below the gallery (gunmen down there)
export const TIERS = [                                                                    // stilt-house tiers down the cliff (floor y, z front)
  { y: 47.2, z: 100, h: 2.8 }, { y: 40, z: 114, h: 4.6 }, { y: 31, z: 117, h: 3.4 }, { y: 22, z: 120, h: 3.4 }, { y: 13, z: 123, h: 3.4 }, { y: 3, z: 126, h: 3.6 },
];

// ---------------------------------------------------------------- the ravine and the Qiansi bridge
export const RAVINE = { x0: 112, x1: 172, floor: 2, z0: -400, z1: 160 };
export const BRIDGE = { x0: 112, x1: 172, z0: 103, z1: 115, y: 40, crown: 68, spring: 20, ribZ: [101.4, 116.6] };
// the maintenance platform at the arch crown (gunmen up there shoot down onto the deck)
export const CROWN = { x0: 137, x1: 147, z0: 102.2, z1: 115.8, y: 68.6 };

// ---------------------------------------------------------------- east bank: the interchange
export const PLAZA = { x0: 172, x1: 292, z0: 40, z1: 112, y: 40 };
export const EROAD = { z0: 88, z1: 104 };                                               // the base road (east-west)
// the stacked flyovers: F1 (y 48) directly under F2 (y 56) along z 50..64 — the double-decker
export const F1 = { x0: 150, x1: 306, z0: 51, z1: 63, y: 48, t: 1.6 };
export const F2 = { x0: 150, x1: 306, z0: 50, z1: 64, y: 56, t: 1.8 };   // both run into tunnels in the east terrace wall at x 306
export const FPIERS = [184, 216, 228, 260, 292];                                         // pier x (the span 228..260 is the one that goes)
export const PSPAN = { x0: 228, x1: 260 };
// the north-south ramp from F2 down onto the plaza (scenery: it stops the north side)
export const RAMP_N = { x0: 196, x1: 208, z0: -80, z1: 50 };
export const SUBST = { x0: 236, x1: 272, z0: 66, z1: 84 };                              // the substation (fenced, under the flyovers' south edge)
export const TANKER = { x: 244, z: 57, y: 56 };                                          // on F2, over the substation

// ---------------------------------------------------------------- east bank: the climb, Sky Street, Jinlong Tower
export const CLIMB = { x0: 290, x1: 328, z0: 92, z1: 104 };
export const CLIMB_PROFILE = [[290, 40], [294, 40], [308, 48], [314, 48], [328, 56]];
export const SKYST = { x0: 328, x1: 364, z0: 36, z1: 108, y: 56 };
export const FOOTB = { x0: 336, x1: 346, z0: 108, z1: 120, y: 56 };                      // the footbridge into the tower
// the landslide: east of Jinlong the bank is a hillside district (six terraced streets stepping down from the y-64
// hill to a narrow quay: stacked housing, stairs, towers). It breaks into blocks (cuts × rows) and slides down its slip
// surface (scarY0) into the river. gone = it has happened (debris then lands on the scar / in the water there)
export const SLIDE = { x0: 370, x1: 592, crack: 40, toe: 178, depth: 80, cuts: [370, 426, 481, 537, 592], rows: [40, 76, 112, 161.2], gone: false };
export const HILLE = { x0: 592, x1: 1000 };   // the district carries on east of the slide (static): the slide is a gap torn out of it
export const TERR = { z0: 40, d: 18, n: 6, y0: 64, dy: 10.5, quay: 148 };
export const hillY = (z) => z >= TERR.quay ? QUAY.y : TERR.y0 - TERR.dy * Math.max(0, Math.min(TERR.n - 1, Math.floor((z - TERR.z0) / TERR.d)));
export const scarY0 = (z) => { const w = Math.min(1, Math.max(0, (z - SLIDE.crack) / (SLIDE.toe - SLIDE.crack))); return TERR.y0 - SLIDE.depth * (1 - Math.pow(1 - w, 2.0)); };
export const TOWER = { x0: 320, x1: 360, z0: 120, z1: 160, base: 3, h: 236, lobby: 56, floorH: 4.2 };
export const LOBBY = { x0: 323, x1: 357, z0: 121, z1: 150, y: 56 };
export const TERRACE = { x0: 323, x1: 357, z0: 150, z1: 158.6, y: 56, gap: [334, 346] };  // glass balustrade with a gap: the jump
export const LOCKER = { x: 350, z: 152.2 };                                               // the BASE rig (a dead guard's kit by the gap)

// ---------------------------------------------------------------- the Chaotian bridge (cable-stayed, across the river) and the glide
export const CHAOTIAN = { x: -150, z0: 112, z1: 604, y: 32, w: 26, pylons: [262, 470], pylonH: 156 };   // its north end tunnels into the cliff under the store
export const FARARCH = [{ x: 680, y: 36, code: 13 }, { x: -760, y: 34, code: 11 }];        // two arched bridges up- and downstream (backdrop)
// the glide rail (a Catmull-Rom through these points; the last point is replaced by the boat's deck). It swings out
// south-east into the river first, so looking back you face the east bank (the landslide) square on, then turns downstream
export const GLIDE = [
  [340, 57.4, 158], [344, 56, 180], [356, 54.5, 206], [374, 53, 232], [390, 51.5, 258], [394, 50, 282], [380, 48.5, 302],
  [350, 47, 314], [300, 45, 318], [240, 42, 314], [170, 38, 308], [100, 33, 305], [20, 26, 308], [-50, 20, 307], [-110, 15, 305], [-150, 12.5, 304], [-196, 8.5, 302], [-236, 5, 300], [-262, 2.8, 298],
];
export const GLIDE_SPEED = 8.2;                                                           // m/s along the rail
export const BOAT = { x0: -340, z: 298, speed: 1.6 };                                    // the gunboat steams east toward the landing

// ---------------------------------------------------------------- start / snipers / spawns
export const START = { x: -137, y: 64, z: 92.5, yaw: -2.75 };                              // facing south-east over the parapet: the river, the far bank, the Chaotian bridge
export const SNIPERS = {
  s1: { x: -40, y: 86.5, z: 40, face: [-0.6, 0.8] },       // a roof over Lantern Street's west end, looking up the stairs
  s2: { x: 30, y: 93.5, z: 34, face: [-0.2, 1] },          // the monorail tower's roof
  b1: { x: 196, y: 64.5, z: 78, face: [-1, 0.25] },         // east bank roof, looking down the bridge
  x1: { x: 300, y: 76.5, z: 60, face: [-0.85, 0.5] },       // east bank tower over the interchange
};

// ---------------------------------------------------------------- districts (power): the blackout runs through these
export const DIST = {
  WEST: 0, LST: 1, CLIFF_HI: 2, CLIFF_LO: 3, ARCH: 4, CH_A: 5, CH_B: 6, CH_C: 7, CH_D: 8,
  EAST: 9, TOWER: 10, FAR_W: 11, FAR_C: 12, FAR_E: 13, MONO: 14, ALWAYS: 15,
};

// =====================================================================================
//  Ground and the walk mask
// =====================================================================================
const inR = (x, z, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
export function profileY(P, x) {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (x <= P[i][0]) { const [x0, y0] = P[i - 1], [x1, y1] = P[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return P[P.length - 1][1];
}
export const stairY = (x) => profileY(STAIR_PROFILE, x);
export const climbY = (x) => profileY(CLIMB_PROFILE, x);
export const gstairY = (x) => x >= GSTAIR.xTop ? GSTAIR.y0 : x <= GSTAIR.x0 ? GSTAIR.y1 : GSTAIR.y1 + (GSTAIR.y0 - GSTAIR.y1) * (x - GSTAIR.x0) / (GSTAIR.xTop - GSTAIR.x0);

// the cliff-city terrain (everything that is not a play floor): terraces stepping down to the river,
// the ravine, the far bank. Only used for particles / debris / bodies and the art.
export function terrainAt(x, z) {
  if (z >= RIVER.z0 && z <= FARBANK.z) return WATER_Y - 4;
  if (x > SLIDE.x0 && x < SLIDE.x1 && z > SLIDE.crack) return SLIDE.gone ? Math.max(WATER_Y - 4, scarY0(z)) : hillY(z);
  if (x >= HILLE.x0 && x < HILLE.x1 && z > SLIDE.crack) return hillY(z);
  if (z > FARBANK.z) return Math.min(64, (z - FARBANK.z) * 2.2);
  if (x > RAVINE.x0 && x < RAVINE.x1 && z > RAVINE.z0) return RAVINE.floor;
  if (z > QUAY.z0) return QUAY.y;
  // the cliff faces under the play terraces
  if (x < RAVINE.x0) { if (z > CLIFF_W.zTop) return QUAY.y + (CLIFF_W.zFoot - z) / (CLIFF_W.zFoot - CLIFF_W.zTop) * 30; return z > 0 ? 50 : 64; }
  if (z > PLAZA.z1) return QUAY.y + (QUAY.z0 - z) / (QUAY.z0 - PLAZA.z1) * 26;
  return x > CLIMB.x1 - 4 ? 56 : 40;
}

// floors the player / soldiers / particles stand on (null = terrain)
export function structFloor(x, z) {
  if (inR(x, z, ROOF) || inR(x, z, RING)) return ROOF.y;
  if (inR(x, z, STAIRS)) return stairY(x);
  if (inR(x, z, GATE)) return GATE.y;
  if (inR(x, z, GSTAIR)) return gstairY(x);
  if (inR(x, z, GLAND)) return GLAND.y;
  if (inR(x, z, LSTREET)) return LSTREET.y;
  if (inR(x, z, G40)) return G40.y;
  if (inR(x, z, BRIDGE)) return BRIDGE.y;
  if (inR(x, z, CLIMB)) return climbY(x);
  if (inR(x, z, PLAZA)) return PLAZA.y;
  if (inR(x, z, FOOTB)) return FOOTB.y;
  if (inR(x, z, LOBBY) || inR(x, z, TERRACE)) return LOBBY.y;
  if (x >= FOOTB.x0 && x <= FOOTB.x1 && z >= FOOTB.z1 && z <= LOBBY.z0) return LOBBY.y;   // the doorway
  if (inR(x, z, SKYST)) return SKYST.y;
  return null;
}
export function groundAt(x, z) { const s = structFloor(x, z); return s ?? terrainAt(x, z); }

// where the PLAYER (and the soldiers' nav) may walk
export function walkable(x, z) {
  if (inR(x, z, ROOF, -0.6)) return true;
  if (x > RING.x0 + 0.6 && x < RING.x1 - 0.6 && z > RING_BLOCK && z <= ROOF.z0 + 0.5) return true;
  if (x >= ROOF.x1 - 0.7 && x <= STAIRS.x1 + 1.2 && z > STAIRS.z0 + 0.6 && z < STAIRS.z1 - 0.6) return true;   // the steps (they join the roof and the street)
  if (inR(x, z, LSTREET, -0.6) && x < LSTREET.x1 - 0.6) return true;
  if (x > LSTREET.x0 - 1 && x < LSTREET.x0 + 0.2 && z > STAIRS.z0 + 0.6 && z < STAIRS.z1 - 0.6) return true;   // the foot of the steps
  if (x > GATE.x0 + 0.5 && x < GATE.x1 - 0.5 && z > LSTREET.z1 - 1 && z < GSTAIR.z1 - 0.5) return true;         // the gate onto the stair head
  if (x > GSTAIR.x0 && x < GSTAIR.x1 - 0.5 && z > GSTAIR.z0 + 0.5 && z < GSTAIR.z1 - 0.4) return true;
  if (inR(x, z, GLAND, -0.4) || (x > GLAND.x0 + 0.4 && x < GLAND.x1 + 0.5 && z > GLAND.z0 + 0.4 && z < G40.z0 + 1)) return true;
  if (inR(x, z, G40, -0.55)) return true;
  if (x > G40.x1 - 1 && x < BRIDGE.x0 + 1 && z > BRIDGE.z0 + 1.6 && z < BRIDGE.z1 - 1.6) return true;         // gallery → bridge
  if (x > BRIDGE.x0 && x < BRIDGE.x1 && z > BRIDGE.z0 + 1.6 && z < BRIDGE.z1 - 1.6) return true;
  if (x > BRIDGE.x1 - 1 && x < PLAZA.x0 + 1 && z > BRIDGE.z0 + 1.6 && z < BRIDGE.z1 - 1.6) return true;
  if (inR(x, z, PLAZA, -0.6)) return true;
  if (x > CLIMB.x0 - 1 && x < CLIMB.x1 + 0.6 && z > CLIMB.z0 + 0.6 && z < CLIMB.z1 - 0.6) return true;
  if (inR(x, z, SKYST, -0.6)) return true;
  if (x > FOOTB.x0 + 0.6 && x < FOOTB.x1 - 0.6 && z > FOOTB.z0 - 1 && z < LOBBY.z0 + 1) return true;
  if (inR(x, z, LOBBY, -0.5)) return true;
  if (x > TERRACE.x0 + 0.5 && x < TERRACE.x1 - 0.5 && z >= LOBBY.z1 - 1 && z < TERRACE.z1 - 0.7) return true;
  return false;
}
// the glide may be steered sideways a little (left stick / A-D); the rail itself is in setpieces / glide.js
export const STEER_MAX = 10;

// ---------------------------------------------------------------- abandoned traffic (cover; most of it explodes): [x, z, yawDeg, type, flags]
export const CARS = [
  // the roof car park and the closed ring road (a police car at the barricade, lights going)
  [-150, 91.5, 0, 'sedan'], [-144.4, 91.5, 180, 'suv', 'haz'], [-133, 53.5, 0, 'taxi'], [-158, 39, 72, 'police', 'haz'], [-149, 44, -100, 'van', 'open'],
  // Lantern Street (westbound lanes z 72..79, eastbound z 79..86)
  [-40, 75, 92, 'taxi', 'open'], [-28, 83, -80, 'sedan', 'haz'], [-14, 76, 100, 'suv'], [4, 82, -95, 'taxi', 'alarm'], [18, 75, 84, 'sedan'],
  [34, 84, -70, 'van', 'open'], [48, 76, 95, 'bus'], [66, 83, -100, 'taxi'], [76, 74, 110, 'sedan', 'haz'], [92, 81, -88, 'police'],
  // the Qiansi bridge deck (z 103..115)
  [124, 106.5, 88, 'sedan', 'haz'], [134, 111.8, -96, 'taxi', 'open'], [146, 106, 70, 'van'], [158, 112, -84, 'sedan', 'alarm'], [166, 106.5, 95, 'wreck', 'burn'],
  // east plaza road (z 88..104)
  [211, 90.5, 20, 'wreck', 'burn'], [257, 90, -160, 'wreck', 'burn'],   // off the walking line (z 96–100)
  [184, 92, 90, 'taxi'], [198, 100, -85, 'suv', 'haz'], [214, 93, 100, 'sedan'], [232, 99, -100, 'bus'], [252, 93, 80, 'taxi', 'open'], [270, 100, -94, 'police'], [282, 91, 120, 'sedan'],
  // Sky Street
  [344, 60, 175, 'taxi'], [352, 82, 10, 'sedan', 'haz'], [338, 94, 190, 'van'],
];
