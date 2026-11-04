// =====================================================================================
//  THE IRON LADY — layout shared by the art builders, the AI, the set pieces and the
//  director. Metres, y up. The Seine runs along x (east = +x, north = +z). The player starts
//  on the NORTH lower quay east of the bridge, fights west, climbs the ramp, crosses the
//  bridge south to the tower park, fights the gunship under the tower, then runs east and down
//  to the SOUTH lower quay while the tower falls north across the river onto the bridge.
// =====================================================================================

export const WATER_Y = -7.0;                           // river surface
export const STREET_Y = 0;                             // upper quays, bridge deck, tower park
export const LOW_Y = -5.6;                             // lower quays (berges), 1.4 m above the water

// River: water between the two quay walls (z = ±40), along x for kilometres.
export const RIVER = { z0: -40, z1: 40, x0: -900, x1: 1100 };

// Lower quays (cobbled berges at LOW_Y). Walkable only EAST of the bridge (x > LOWQ.x0): the
// bridge abutment closes them at x = 16. West of the bridge they exist as scenery.
// The retaining wall (stone, up to street level) is at |z| = 52.
export const LOWQ = { x0: 16, x1: 340, edge: 40, wall: 52 };

// Ramps between lower quay and street level, built against the retaining wall (inner 6 m of the
// lower quay); the lower quay continues beside them on the river side (|z| 40..46).
//   north: rises toward -x, from (x 66, LOW_Y) to (x 30, STREET_Y), z ∈ [46, 52]
//   south: falls toward +x, from (x 70, STREET_Y) to (x 106, LOW_Y), z ∈ [-52, -46]
export const RAMP_N = { xLow: 66, xHigh: 30, z0: 46, z1: 52 };
export const RAMP_S = { xHigh: 70, xLow: 106, z0: -52, z1: -46 };

// Upper quays (street level). Parapet (stone balustrade, 1.0 m) along the retaining wall top.
//   north: parapet z 52..52.6, tree sidewalk 52.6..58, road 58..72, sidewalk 72..78, facades at z = 78
//   south: mirrored (facades at z = -78 only where |x| > PARK.half; the tower park fills the middle)
export const QUAY_N = { parapet: [52, 52.6], walk: [52.6, 58], road: [58, 72], walk2: [72, 78], face: 78 };
export const QUAY_S = { parapet: [-52.6, -52], walk: [-58, -52.6], road: [-72, -58], walk2: [-78, -72], face: -78 };
export const PARAPET_H = 1.0;

// The bridge (stone, five arches): deck at STREET_Y, x ∈ [-14, 14], spans z ∈ [-52, 52].
// Road |x| < 9.5, sidewalks 9.5..13.4, balustrade 13.4..14 (1.05 m). Piers in the river at z = ±8, ±24,
// abutments at the quay walls. Avenue continues north (x ±14) between the facades.
export const BRIDGE = { half: 14, road: 9.5, rail: 13.4, z0: -52, z1: 52, piers: [-24, -8, 8, 24], deckThick: 1.4 };

// The tower park ("Champ"): gravel + lawns, street level. The tower stands at its north end.
export const PARK = { half: 90, z0: -250, z1: -78 };

// THE IRON LADY: four splayed lattice legs, arches between them, three platforms, a spire.
// Centre (x, z); legs' outer feet at (±base, z ± base). Heights in metres.
export const TOWER = {
  x: 0, z: -140, base: 50,                 // feet at x ±50, z -90 / -190 (centre of each foot)
  foot: 14,                                // foot footprint (lattice + stone plinth), square
  p1: { y: 56, half: 34 },                 // first platform (square half-size)
  p2: { y: 112, half: 19 },
  p3: { y: 262, half: 8 },                 // top platform / lantern
  h: 282, antenna: 300,
  arch: { y: 40 },                         // crown of the decorative arches between the legs
  // the gunship crashes into the north-east leg (river side, east): it fails first
  crashLeg: 1,                             // leg order: 0 NW(-x,+z side), 1 NE, 2 SE, 3 SW
  crashY: 24,
};
export const LEGS = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sz], i) => ({
  i, sx, sz, x: TOWER.x + sx * TOWER.base, z: TOWER.z + sz * TOWER.base,
}));

// The escape: the driver brings a speedboat to a floating pontoon on the south lower quay.
export const PONTOON = { x0: 196, x1: 214, z0: -40, z1: -36.5, y: LOW_Y - 0.25 };
export const BOAT_DOCK = { x: 205, z: -33.5 };

// Player start: north lower quay, looking west along the river at the tower.
export const START = { x: 172, y: LOW_Y, z: 46, yaw: 1.05 };

// Riverboat (bateau-mouche) path: glides west down the middle of the river, under the bridge.
export const RIVERBOAT = { z: 10, x0: 420, x1: -260, speed: 5.2 };

// Snipers (laser): Haussmann balconies / roof parapets and the first platform of the tower.
// face = outward direction they look (toward the river).
export const SNIPERS = {
  n1: { x: 118, y: 19.2, z: 77.6, face: [0, -1] },
  n2: { x: 64, y: 19.2, z: 77.6, face: [0, -1] },
  t1: { x: 22, y: TOWER.p1.y + 0.35, z: -106.6, face: [0, 1] },   // first platform, river side
  t2: { x: -24, y: TOWER.p1.y + 0.35, z: -106.6, face: [0, 1] },
};

// Traffic on the bridge and the quays: [x, z, yawDeg, type, flags] (see downtown-haven/cars.js types:
// sedan|taxi|police|suv|van|bus|wreck). yaw 0 = facing -z (south).
export const CARS = [
  // north upper quay (behind the ramp top)
  [22, 64.5, 92, 'sedan', 'x'], [-22, 67.5, 268, 'van', 'x haz'],
  // the bridge: a jam heading south, a police block at the south end
  [-5.2, 38, 2, 'sedan', 'x'], [4.6, 31, -4, 'taxi', 'x open intact'], [-4.8, 20, 6, 'van', 'x haz'],
  [5.0, 9, -10, 'sedan', 'x alarm'], [-5.4, -3, 4, 'suv', 'x'], [4.4, -15, 22, 'sedan', 'x'],
  [-1.5, -28, 64, 'police', 'x haz'], [6.0, -36, 104, 'police', 'x haz'], [-6.5, -42, 82, 'van', 'x'],
  // south upper quay
  [28, -63.5, 88, 'sedan', 'x'], [44, -67.5, 272, 'suv', 'x'], [-30, -64, 94, 'taxi', 'x'],
  // the park (police / security vehicles parked under the tower)
  [-24, -100, 30, 'police', 'x haz'], [30, -112, -40, 'van', 'x'], [-6, -168, 12, 'suv', 'x'], [18, -150, 70, 'police', 'x haz'],
];

// Ground truth: water, lower quays, ramps, street level. (Bridge deck = street level over the water.)
export function groundAt(x, z) {
  const az = Math.abs(z);
  if (onPontoon(x, z)) return PONTOON.y;
  // bridge deck over the river and over the lower quays
  if (Math.abs(x) < BRIDGE.half && az < BRIDGE.z1) return STREET_Y;
  if (az < RIVER.z1) return WATER_Y;
  if (az < LOWQ.wall) {
    if (z > 0 && z > RAMP_N.z0 && x > RAMP_N.xHigh - 6 && x < RAMP_N.xLow) {
      if (x <= RAMP_N.xHigh) return STREET_Y;           // ramp top landing
      return LOW_Y + (STREET_Y - LOW_Y) * (RAMP_N.xLow - x) / (RAMP_N.xLow - RAMP_N.xHigh);
    }
    if (z < 0 && z < RAMP_S.z1 && x > RAMP_S.xHigh - 6 && x < RAMP_S.xLow) {
      if (x <= RAMP_S.xHigh) return STREET_Y;
      return STREET_Y + (LOW_Y - STREET_Y) * (x - RAMP_S.xHigh) / (RAMP_S.xLow - RAMP_S.xHigh);
    }
    return LOW_Y;
  }
  return STREET_Y;
}
// the pontoon sticks out over the water: its own walkable strip
export function onPontoon(x, z) { return x > PONTOON.x0 && x < PONTOON.x1 && z > PONTOON.z0 && z < PONTOON.z1; }
