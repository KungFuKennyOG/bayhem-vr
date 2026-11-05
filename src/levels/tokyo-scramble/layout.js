// =====================================================================================
//  TOKYO SCRAMBLE — layout shared by the art builders, the AI, the set pieces and the director.
//  Metres, y up, east = +x, NORTH = -z. Kurogane (a fictional ward) at midnight, dry neon.
//
//  The route is a loop around one block: station terrace (intro, y 7) -> stairs -> station plaza ->
//  the scramble crossing -> east down the avenue -> the multi-storey car park (ramp to deck A, ramp to
//  deck B) -> link bridge onto the elevated expressway -> fight west along the jam -> the tanker blows
//  and a span drops into the street below -> the off-ramp down into the north end of Center-gai (the
//  shopping street) -> fight south down Center-gai -> the gas main goes and chases you back down the
//  street -> dive out into the crossing.
//
//  Every walkable surface is single-valued in x/z (nothing walkable sits above anything walkable), so
//  one floor function serves the player, the soldiers, the particles and the nav grid.
// =====================================================================================

export const STREET_Y = 0;
export const CURB = 0.15;                      // sidewalks / plaza / Center-gai paving

// The scramble crossing: one asphalt square, the zebras and the diagonals painted on it.
export const CROSS = { half: 22, walk: 6 };    // road |x|,|z| < 22; the sidewalk ring out to 28

// Streets leaving the crossing
export const AVE_E = { x0: 22, x1: 196, road: 11, walk: 17 };   // east avenue: road |z| < 11, sidewalks to 17
export const AVE_S = { z0: 22, z1: 176, road: 11, walk: 17 };   // south avenue: road |x| < 11, sidewalks to 17
export const PLAZA = { x0: -80, x1: -22, z0: -30, z1: 28 };      // station plaza (paved, curb height)
export const TAXI = { x0: -42, x1: -22, z0: -24, z1: 22 };       // the taxi / bus lane across the plaza front (asphalt)
export const CENTER = { half: 8, z0: -140, z1: -28 };            // Center-gai: paved, facades at |x| = 8

// The station: a terrace at y 7 in front of the concourse, a broad stair down (east) to the plaza.
export const TERRACE = { x0: -96, x1: -80, z0: -22, z1: 22, y: 7 };
export const STAIRS = { x0: -80, x1: -69, z0: -18, z1: 18 };     // falls toward +x from TERRACE.y to CURB

// The car park (multi-storey, open decks). Footprint x 44..112, z -128..-17.
export const GARAGE = { x0: 44, x1: 112, z0: -128, z1: -17 };
export const APRON = { x0: 44, x1: 50, z0: -25, z1: -17 };       // entry from the avenue sidewalk
export const R1 = { x0: 50, x1: 90, z0: -25, z1: -19, y0: CURB, y1: 6 };   // rises toward +x
export const DECK_A = { x0: 46, x1: 112, z0: -80, z1: -25, y: 6 };
export const R1TOP = { x0: 90, x1: 112, z0: -25, z1: -19, y: 6 };          // ramp landing (part of deck A)
export const R2 = { x0: 64, x1: 108, z0: -86, z1: -80, y0: 12, y1: 6 };    // rises toward -x (x0 is the top)
export const DECK_B = { x0: 46, x1: 112, z0: -128, z1: -86, y: 12 };

// The elevated expressway (Shuto-style): deck top y 12 over a cross street, east-west.
export const XWAY = { z0: -160, z1: -140, y: 12, x0: -260, x1: 260, barrier: 1.05 };
export const XWAY_IN = { z0: -159.2, z1: -140.8 };                // inside the parapets
// The span the tanker takes down: piers at x -14 and 18 (the east pier fails, the east end drops).
export const SPAN = { x0: -14, x1: 18, piers: [-78, -46, -14, 18, 50, 82, 114, 146, 178, 210, -110, -142, -174, -206, -238] };
export const XWAY_BLOCK = 26;                                    // the jam stops you here (x > XWAY_BLOCK walkable)
// Gore + link: the bridge from deck B onto the expressway, and the start of the off-ramp.
export const GORE = { x0: 86, x1: 104, z0: -140, z1: -128, y: 12 };
export const OFFRAMP = { x0: 14, x1: 86, z0: -139, z1: -131, y0: CURB, y1: 12 };  // rises toward +x
export const LANE = { x0: 8, x1: 14, z0: -139, z1: -131 };       // flat, curb height, into Center-gai's north end
export const CROSS_ST = { z0: -164, z1: -140 };                   // the street under the expressway (not walkable)

// Building blocks: [x0, z0, x1, z1, faces] — faces = which sides front a street the player sees
// ('n' 's' 'e' 'w'). city.js splits each block into narrow lots along its fronts.
export const BLOCKS = [
  { id: 'nw', r: [-80, -140, -28, -30], faces: 'sen', hot: 'sen' },
  { id: 'nw2', r: [-28, -140, -8, -28], faces: 'esn', hot: 'esn' },
  { id: 'n1', r: [8, -60, 28, -28], faces: 'sw', hot: 'sw', tower: true },
  { id: 'n1b', r: [28, -60, 44, -17], faces: 'sw', hot: 's' },
  { id: 'n2', r: [8, -131, 44, -60], faces: 'wne', hot: 'wne' },
  { id: 'ne2', r: [112, -134, 196, -17], faces: 'swn', hot: 'swn' },
  { id: 'se', r: [28, 17, 196, 176], faces: 'nw', hot: 'nw' },
  { id: 'se2', r: [17, 28, 28, 176], faces: 'nw', hot: 'w' },
  { id: 'sw', r: [-80, 30, -28, 176], faces: 'ne', hot: 'n' },
  { id: 'sw2', r: [-28, 28, -17, 176], faces: 'ne', hot: 'e' },
  { id: 'stn_n', r: [-96, -60, -80, -22], faces: 'e', hot: 'e' },
  { id: 'stn_s', r: [-96, 22, -80, 60], faces: 'e', hot: 'e' },
  { id: 'nfar', r: [-260, -276, 260, -164], faces: 's', hot: 's', far: true },
  { id: 'efar', r: [196, -164, 330, 190], faces: 'w', far: true },
  { id: 'sfar', r: [-200, 176, 196, 300], faces: 'n', far: true },
  { id: 'wfar', r: [-330, -164, -150, 190], faces: 'e', far: true },
];
export const STATION = { x0: -150, x1: -96, z0: -60, z1: 60, h: 24 };

// Player start: on the station terrace, looking east over the plaza at the crossing.
export const START = { x: -86, y: TERRACE.y, z: 2, yaw: -Math.PI / 2 + 0.06 };

// Snipers (laser): billboard catwalks / roof parapets. face = outward direction [x, z].
export const SNIPERS = {
  c1: { x: 13.5, y: 23.8, z: -27.1, face: [0, 1] },        // the catwalk over the corner tower's giant screen
  c2: { x: 31, y: 25.2, z: 17.5, face: [-0.6, -0.8] },     // SE corner roof
  g1: { x: 84, y: 30.2, z: 17.5, face: [0, -1] },          // across the avenue from the car park
  x1: { x: 58, y: 28.2, z: -164.5, face: [0, 1] },         // north of the expressway
};

// Traffic: [x, z, yawDeg, type, flags]. yaw 0 = facing -z (north). Types from downtown-haven/cars.js.
export const CARS = [
  // the crossing: abandoned mid-scramble
  [-12, -6, 84, 'taxi', 'x open'], [6, 8, 96, 'sedan', 'x'], [-2, 15, 3, 'van', 'x haz'], [15, -14, 178, 'taxi', 'x'],
  [-17, 12, 40, 'sedan', 'x alarm'], [10, -3, 262, 'police', 'x haz'], [-4, -16, 190, 'suv', 'x'],
  // plaza taxi rank
  [-34, 20, 0, 'taxi', 'x'], [-34, 9, 2, 'taxi', 'x'], [-34, -2, 0, 'taxi', 'x open'],
  // east avenue
  [32, -6, 92, 'sedan', 'x'], [42, 5, 268, 'van', 'x'], [58, -4, 86, 'taxi', 'x'], [72, 6, 270, 'sedan', 'x alarm'], [92, -5, 90, 'suv', 'x'], [118, 4, 274, 'bus', ''],
  // south avenue (scenery, the barricade burns)
  [5, 40, 184, 'sedan', 'x'], [-6, 55, 4, 'taxi', 'x'], [0, 150, 70, 'wreck', ''],
  // deck A
  [56, -34, 0, 'sedan', 'x'], [64, -34, 2, 'van', 'x'], [80, -34, 0, 'sedan', 'x'], [96, -36, 180, 'suv', 'x'], [56, -70, 180, 'taxi', 'x'], [72, -70, 182, 'sedan', 'x'], [92, -66, 120, 'sedan', 'x alarm'], [104, -54, 90, 'van', 'x haz'],
  // deck B
  [54, -96, 0, 'sedan', 'x'], [64, -98, 4, 'suv', 'x'], [86, -96, 178, 'sedan', 'x'], [100, -118, 90, 'van', 'x'], [58, -120, 180, 'taxi', 'x'], [76, -112, 30, 'police', 'x haz'],
  // the expressway jam: westbound (south half, facing -x) and eastbound (north half, facing +x)
  [98, -145, 92, 'van', 'x'], [86, -154, 268, 'sedan', 'x'], [78, -155.5, 274, 'suv', 'x'], [68, -145.5, 86, 'sedan', 'x alarm'], [58, -152.5, 262, 'taxi', 'x'],
  [50, -146, 94, 'sedan', 'x'], [44, -155.5, 270, 'van', 'x haz'], [36, -145.6, 80, 'sedan', 'x'], [31, -153, 258, 'suv', 'x'],
  // the cross street under the expressway (seen from above)
  [70, -152, 92, 'sedan', 'x'], [-40, -150, 268, 'taxi', 'x'],
];
// the tanker in the jam (on the span that comes down)
export const TANKER = { x: 3, z: -145.6, yaw: 90 };

// The gas main under Center-gai: manholes down the middle, the works at the north end.
export const GASWORKS = { x: 0, z: -124 };
export const MANHOLES = [-118, -108, -98, -88, -78, -68, -58, -48, -38, -30].map((z, i) => ({ x: (i % 2 ? 1.6 : -1.4), z }));
export const DIVE_Z = -24;                                       // out of Center-gai and into the crossing

// Ground truth (single-valued): every walkable surface + the slab once the span has dropped.
export const STATE = { spanDown: false };
export function groundAt(x, z) {
  // elevated: expressway deck / gore / off-ramp / car park
  if (z > XWAY.z0 && z < XWAY.z1 && x > XWAY.x0 && x < XWAY.x1) {
    if (STATE.spanDown && x > SPAN.x0 && x < SPAN.x1 + 2) return slabY(x);
    return XWAY.y;
  }
  if (z >= GORE.z0 && z <= GORE.z1 && x >= GORE.x0 && x <= GORE.x1) return GORE.y;
  if (z > OFFRAMP.z0 && z < OFFRAMP.z1 && x >= OFFRAMP.x0 && x < OFFRAMP.x1) return OFFRAMP.y0 + (OFFRAMP.y1 - OFFRAMP.y0) * (x - OFFRAMP.x0) / (OFFRAMP.x1 - OFFRAMP.x0);
  if (x > GARAGE.x0 && x < GARAGE.x1 && z > GARAGE.z0 && z < GARAGE.z1) {
    if (z > R1.z0 && x >= R1.x0 && x < R1.x1) return R1.y0 + (R1.y1 - R1.y0) * (x - R1.x0) / (R1.x1 - R1.x0);
    if (z > R1TOP.z0 && x >= R1TOP.x0) return R1TOP.y;
    if (z >= APRON.z0 && x < APRON.x1) return CURB;
    if (z > R2.z0 && z < R2.z1 && x > R2.x0 && x < R2.x1) return R2.y0 + (R2.y1 - R2.y0) * (x - R2.x0) / (R2.x1 - R2.x0);
    if (z >= R2.z1) return DECK_A.y;
    if (z <= R2.z0) return DECK_B.y;
    return x <= R2.x0 ? DECK_B.y : DECK_A.y;
  }
  // station terrace + stairs
  if (x > TERRACE.x0 && x <= TERRACE.x1 && z > TERRACE.z0 && z < TERRACE.z1) return TERRACE.y;
  if (x > STAIRS.x0 && x < STAIRS.x1 && z > STAIRS.z0 && z < STAIRS.z1) return stairY(x);
  // street level
  const ax = Math.abs(x), az = Math.abs(z);
  if (ax < CROSS.half && az < CROSS.half) return STREET_Y;
  if (x > AVE_E.x0 && az < AVE_E.road) return STREET_Y;
  if (z > AVE_S.z0 && ax < AVE_S.road) return STREET_Y;
  if (z > CROSS_ST.z0 && z < CROSS_ST.z1) return STREET_Y;
  if (x > TAXI.x0 && x < TAXI.x1 && z > TAXI.z0 && z < TAXI.z1) return STREET_Y;
  return CURB;
}
// the stair: 23 treads of 0.48 m, 0.3 m risers (sampled continuously, the locomotion eases it)
export function stairY(x) { const t = (x - STAIRS.x0) / (STAIRS.x1 - STAIRS.x0); return TERRACE.y + (CURB - TERRACE.y) * Math.min(1, Math.max(0, t)); }
// the dropped span: hinged at its west pier (y 12), the east end on the street
export const SLAB = { hingeX: SPAN.x0, len: SPAN.x1 - SPAN.x0, drop: XWAY.y - 0.9 };
export function slabY(x) {
  const ang = Math.asin(SLAB.drop / SLAB.len), run = SLAB.len * Math.cos(ang);
  const t = Math.min(1, Math.max(0, (x - SLAB.hingeX) / run));
  return XWAY.y - SLAB.drop * t;
}

// Is (x, z) somewhere a soldier may walk? (nav grid regions; buildings / props are removed by colliders)
export function walkable(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  // elevated
  if (z > XWAY_IN.z0 && z < XWAY_IN.z1) return x > XWAY_BLOCK && x < 120;
  if (z >= GORE.z0 - 1 && z <= GORE.z1 + 1 && x >= GORE.x0 && x <= GORE.x1) return true;
  if (z > OFFRAMP.z0 + 0.6 && z < OFFRAMP.z1 - 0.6 && x >= OFFRAMP.x0 && x < OFFRAMP.x1) return true;
  if (z > LANE.z0 + 0.6 && z < LANE.z1 && x >= LANE.x0 - 0.5 && x < LANE.x1) return true;
  if (x > GARAGE.x0 && x < GARAGE.x1 && z > GARAGE.z0 && z < GARAGE.z1) return x > 46.5 && x < 111.5 && z > -127.5 && z < -17.5;
  if (x > TERRACE.x0 && x < STAIRS.x1 && az < 22) return x > TERRACE.x0 + 1 && az < (x < STAIRS.x0 ? 21 : STAIRS.z1);
  // street level (the far ends of the avenues are barricaded)
  if (ax < CROSS.half + CROSS.walk && az < CROSS.half + CROSS.walk) return true;
  if (x > 0 && x < 170 && az < AVE_E.walk) return true;
  if (z > 0 && z < 130 && ax < AVE_S.walk) return true;
  if (x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1) return true;
  if (ax < CENTER.half && z > CENTER.z0 && z < CENTER.z1 + 2) return true;
  return false;
}
