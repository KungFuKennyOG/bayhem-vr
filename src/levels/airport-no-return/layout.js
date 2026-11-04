// =====================================================================================
//  AIRPORT NO RETURN — world frame (metres). y up, ground at y = 0.
//  Runway 27 runs along z: aircraft roll toward -z, straight into the setting sun.
//  The apron + hangars sit on the +x side of the runway, behind the parallel taxiway.
// =====================================================================================

// runway: centreline x = 0, 60 m wide (+7.5 m shoulders), threshold "27" at the east end (z = +420)
export const RWY = { x: 0, halfW: 30, shoulder: 7.5, z0: 420, z1: -2900 };
// parallel taxiway A (and the high-speed connector the jeep uses to reach the runway)
export const TWY = { x: 112, halfW: 11.5, z0: 470, z1: -2600 };
export const CONNECTORS = [
  // [z on taxiway, z on runway] straight 90° stubs at both ends, angled high-speed exits in between
  { z0: 440, z1: 440, w: 23 },
  { z0: 150, z1: 150, w: 23 },
  { z0: -150, z1: -330, w: 23 },
  { z0: -900, z1: -1080, w: 23 },
  { z0: -1700, z1: -1880, w: 23 },
  { z0: -2560, z1: -2560, w: 23 },
];
// apron (concrete) between the taxiway and the hangar line
export const APRON = { x0: 124, x1: 336, z0: 84, z1: 340 };
// hangars: door plane at z, the building runs from z to z + d; doors face -z (toward the sun). Level starts in hangar 2.
export const HANGARS = [
  { x: 168, z: 340, w: 58, d: 46, h: 21, door: 0.66, id: 1 },
  { x: 232, z: 340, w: 58, d: 46, h: 21, door: 0.8, id: 2 },
  { x: 296, z: 340, w: 58, d: 46, h: 21, door: 0.3, id: 3 },
];
export const START = { x: 224, z: 371, yaw: 0.1 };     // inside hangar 2, looking out of the door
export const JEEP_STOP = { x: 127, z: 146 };            // where the driver pulls up for you
export const TOWER = { x: 360, z: 70 };
export const FUEL_FARM = { x: 300, z: 30 };
// the jets taxi along taxiway A toward the threshold (+z) and blow up in front of the apron
export const TAXI = { x: TWY.x, zStart: 60, zBlow: 196 }; // they start in view of the apron edge (from -30 they were specks for 10 s)
// the cargo plane holds on the runway at the hold line, then rolls toward -z
export const CARGO_HOLD = { x: 0, z: 168 };
export const LIFTOFF_Z = -1560;
