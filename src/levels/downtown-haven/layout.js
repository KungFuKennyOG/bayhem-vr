// =====================================================================================
//  DOWNTOWN HAVEN CITY — layout shared by the world builders, the AI, the set pieces and
//  the director. Metres, y up, the player walks the avenue from z ≈ +34 toward -z
//  (into the sunset, which sits straight down the avenue just right of Meridian Tower).
// =====================================================================================

// Avenue: building faces at x = ±16, sidewalks x ∈ [±11, ±16] (0.15 m curb), road |x| < 11.
export const AVE = { half: 16, curb: 11, sidewalkY: 0.15, zStart: 46, zEnd: -150, back: 150 };
// Cross street (the gunship arena): road z ∈ [-58, -48], sidewalks 4 m each side, runs along x.
export const CROSS = { z0: -62, z1: -44, road0: -58, road1: -48, reach: 220 };
// Plaza in front of Meridian Tower (the avenue ends here).
export const PLAZA = { z0: -170, z1: -150, half: 46 };
// Meridian Tower: the villain's HQ, straddles the end of the avenue. The gunship hits its +z face at
// `impact`; the floors above `breakY` topple toward +z (down the avenue) in the finale.
export const MERIDIAN = { x0: -19, x1: 19, z0: -208, z1: -170, h: 132, breakY: 40, impact: [4, 40, -170] };
// Haven Trust lobby (right side, block 2): double-height glass lobby behind the avenue facade x = 16.
export const LOBBY = {
  x0: 16, x1: 42, z0: -126, z1: -82, floorY: 0.15, ceilY: 9.5, roofY: 14,
  sky: { x0: 22, x1: 36, z0: -116, z1: -92 },          // atrium skylight (glass roof panes at ceilY)
  doors: [[-90.5, -86.5], [-121.5, -117.5]],            // open doorways in the facade (z ranges)
};
// Subway entrance on the right sidewalk at the end of block 1 (just before the intersection): stairs go
// DOWN toward +z (you dive in running away from Meridian). Top step at zTop (sidewalk level), bottom at
// zBot (yBot), landing/tunnel to zEnd.
export const SUBWAY = { x0: 12.0, x1: 15.4, zTop: -41, zBot: -31, yBot: -4.0, zEnd: -26 };

// Building lots along the avenue. side -1 = left (x < -16), +1 = right (x > 16).
// z: [north/+z edge, south/-z edge]. depth: how far the lot runs away from the avenue.
// podium: podium (street-wall) roof height. tower: total height (0 = podium only), setback: tower inset from
// the avenue face. style: facade family (see DESIGN.md). snipers stand on podium roofs (see SNIPERS).
export const LOTS = [
  // block 1 (z +46 .. -44)
  { id: 'L1', side: -1, z: [46, 12], depth: 34, podium: 18, tower: 118, setback: 6, style: 'glassGold' },
  { id: 'L2', side: -1, z: [12, -18], depth: 30, podium: 12, tower: 84, setback: 5, style: 'stone' },
  { id: 'L3', side: -1, z: [-18, -44], depth: 34, podium: 22, tower: 162, setback: 6, style: 'glassBlue' },
  { id: 'R1', side: 1, z: [46, 20], depth: 30, podium: 14, tower: 96, setback: 5, style: 'darkFins' },
  { id: 'R2', side: 1, z: [20, -10], depth: 30, podium: 26, tower: 0, setback: 0, style: 'stoneGlass' },
  { id: 'R3', side: 1, z: [-10, -44], depth: 36, podium: 16, tower: 204, setback: 7, style: 'glassBlue', crown: true },
  // block 2 (z -62 .. -150)
  { id: 'L4', side: -1, z: [-62, -100], depth: 36, podium: 16, tower: 142, setback: 6, style: 'darkFins' },
  { id: 'L5', side: -1, z: [-100, -150], depth: 36, podium: 20, tower: 110, setback: 6, style: 'glassGold' },
  { id: 'R4', side: 1, z: [-62, -80], depth: 28, podium: 30, tower: 0, setback: 0, style: 'stone' },
  { id: 'R5', side: 1, z: [-80, -128], depth: 34, podium: 14, tower: 176, setback: 6, style: 'glassGold', lobby: true },
  { id: 'R6', side: 1, z: [-128, -150], depth: 30, podium: 60, tower: 0, setback: 0, style: 'stoneGlass' },
];

// Rooftop sniper perches (podium roofs, behind the parapet). face: direction toward the avenue (+x for left side).
export const SNIPERS = {
  s1: { x: -16.75, y: 12, z: -2, face: 1 },
  s2: { x: 16.75, y: 26, z: 6, face: -1 },
  s3: { x: -16.75, y: 22, z: -31, face: 1 },
  s4: { x: 16.75, y: 16, z: -24, face: -1 },
  s5: { x: -16.75, y: 16, z: -70, face: 1 },
  s6: { x: -16.75, y: 20, z: -112, face: 1 },
  s7: { x: 16.75, y: 30, z: -70, face: -1 },
};
export const PARAPET = { h: 1.05, t: 0.35 };   // podium roof parapet height / thickness (at the avenue edge)

// Abandoned traffic. [x, z, yawDeg, type, flags]  type: sedan|taxi|police|suv|van|bus|wreck
// yaw 0 = facing -z (driving toward Meridian). flags: 'x' explosive (default for sedan/taxi/police/suv/van),
// 'open' a door left open, 'haz' hazard lights blinking, 'alarm' alarm already going.
export const CARS = [
  // the barricade behind the start (burning, police)
  [-7.5, 44.5, 78, 'police', 'haz'], [-1.5, 45.5, 102, 'police', 'haz'], [5.5, 44.0, 70, 'wreck', ''],
  // block 1 traffic jam (cover for the street war)
  [-8.2, 27.0, 8, 'taxi', 'x open haz'], [-2.7, 22.5, -6, 'sedan', 'x'], [3.0, 29.5, 4, 'suv', 'x'],
  [8.1, 18.0, 12, 'van', 'x haz'], [-8.0, 13.5, -14, 'sedan', 'x alarm'], [2.6, 9.0, 32, 'taxi', 'x'],
  [-3.4, 1.0, 0, 'bus', ''], [8.4, -3.0, -4, 'sedan', 'x open'], [-8.6, -10.5, 6, 'suv', 'x haz'],
  [3.2, -15.0, -22, 'sedan', 'x'], [-1.2, -24.0, 74, 'police', 'x haz'], [8.6, -27.5, 2, 'taxi', 'x'],
  [-7.6, -33.0, -10, 'van', 'x'],
  // intersection (gunship arena)
  [-12.0, -51.5, 92, 'sedan', 'x'], [6.0, -53.5, 118, 'taxi', 'x haz'], [21.0, -50.0, 86, 'suv', 'x'],
  [-24.0, -55.5, 96, 'van', 'x'], [-2.0, -47.0, 40, 'wreck', ''], [13.0, -57.0, 80, 'sedan', 'x'],
  // block 2
  [-7.8, -70.0, 4, 'sedan', 'x'], [2.4, -76.0, -8, 'taxi', 'x open'], [-3.0, -86.0, 18, 'suv', 'x'],
  [7.6, -92.0, 0, 'van', 'x haz'], [-8.4, -100.0, -6, 'sedan', 'x'], [3.0, -108.0, 6, 'police', 'x haz'],
  [-6.0, -118.0, -30, 'taxi', 'x'], [8.2, -126.0, 2, 'sedan', 'x'], [-2.0, -136.0, 0, 'bus', ''],
  // plaza
  [-14.0, -156.0, 60, 'sedan', 'x'], [12.0, -160.0, -50, 'suv', 'x'],
];

// distant smoke columns from the earlier chaos (x, z, scale)
export const SMOKE_COLUMNS = [[-140, 120, 1.2], [180, 60, 1.0], [-90, -320, 1.4], [260, -220, 0.9], [60, 320, 1.1]];

// Ground height for the street: road 0, sidewalks/plaza/lobby 0.15, the subway stairwell below grade.
export function streetGround(x, z) {
  // subway stairwell
  if (x > SUBWAY.x0 && x < SUBWAY.x1 && z > SUBWAY.zTop && z < SUBWAY.zEnd) {
    if (z < SUBWAY.zBot) { const t = (z - SUBWAY.zTop) / (SUBWAY.zBot - SUBWAY.zTop); return 0.15 + (SUBWAY.yBot - 0.15) * t; }
    return SUBWAY.yBot;
  }
  const ax = Math.abs(x);
  // cross street: road runs along x between its sidewalks
  if (z < CROSS.z1 && z > CROSS.z0) return (z < CROSS.road1 && z > CROSS.road0) || ax < AVE.curb ? 0 : 0.15;
  if (z < PLAZA.z1 && z > PLAZA.z0 - 40) return ax < AVE.curb && z > PLAZA.z1 - 6 ? 0 : 0.15;
  return ax < AVE.curb ? 0 : 0.15;
}
