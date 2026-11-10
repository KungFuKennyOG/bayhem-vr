// =====================================================================================
//  WHITEOUT — every number in the level lives here (metres, y up, east = +x, NORTH = -z = uphill).
//
//  The picture (see DESIGN.md):
//   - the lower slope: a mountain road climbs three switchback legs (hairpins east, west) through pines
//     and avalanche fences to the MITTELSTATION yard (y 30);
//   - the cable car crosses the gorge north (one pylon on a rock rib) up to GRAUHORN STATION (y 140),
//     a fortified observatory on the summit saddle: arrival hall, courtyard, the north block (roof walk
//     y 148), the observatory tower (terrace y 156) and the railway gallery cut into the slope (y 148);
//   - the Grauhorn face rises north of the saddle to the cornice (the avalanche).
//  Terrain = an analytic mountain (noise + carved road shelves + flattened plateaus) baked to a 1 m
//  heightfield. Everything the player can stand on that is NOT terrain (roofs, stairs, decks, the
//  cabins) is a "struct" floor; struct footprints never overlap, so ground is one 2D function.
// =====================================================================================

// ---------------------------------------------------------------- sun / weather
// toward the sun: low in the south-south-west (behind you on the face: the Grauhorn face is lit gold)
export const SUN_AZ = [-0.8, 0, 0.6];   // west-south-west: the face (south-facing) is side-lit, its ribs throw shadow
export const SUN_EL_STORM = 14, SUN_EL_CLEAR = 7;   // degrees (it sinks a little through the level)

// ---------------------------------------------------------------- the road (centre line, y = road surface)
export const ROAD_W = 3.6;           // half width of the carriageway (snow-packed asphalt)
export const LEG1 = { a: [-58, 0.0, 110], b: [40, 9.0, 102] };
export const HP1 = { c: [40, 92], r: 10, y0: 9.0, y1: 10.0 };   // hairpin 1 (east): south → east → north
export const LEG2 = { a: [40, 10.0, 82], b: [-46, 19.0, 74] };
export const HP2 = { c: [-46, 64], r: 10, y0: 19.0, y1: 20.0 }; // hairpin 2 (west)
export const LEG3 = { a: [-46, 20.0, 54], b: [34, 28.4, 46] };
// the pull-out by the start (the driver's snowcat burns here)
export const PULLOUT = { x0: -96, x1: -60, z0: 104, z1: 119 };
// the Berghaus (alpine inn) on a terrace outside hairpin 2, and the wayside chapel inside hairpin 1
export const HUT = { x0: -86, x1: -63, z0: 54, z1: 74, y: 19.4 };
export const CHAPEL = { x: 28, z: 92, yaw: Math.PI / 2 };
// the valley road below the start (fades into the storm) and the climb into the station yard
export const VALLEY = [[-150, -6.5, 126], [-110, -3.2, 118], [-80, -1.0, 112], [-58, 0.0, 110]];
export const YARD_IN = [[34, 28.4, 46], [44, 29.3, 42], [54, 30, 38]];

// ---------------------------------------------------------------- Mittelstation (y 30)
export const YARD = { x0: 50, x1: 114, z0: 8, z1: 44, y: 30 };
export const MID = { x0: 62, x1: 110, z0: -20, z1: 8, y: 30, roofY: 41 };      // station building
export const MID_HALL = { x0: 66, x1: 106, z0: -16, z1: 7 };                    // walkable inside
export const TRACK_X = [80, 90];       // our line (west), their line (east)
// cable geometry: track rope heights at the stations / pylon (carriage wheels ride on it)
export const HANG = 6.6;               // rope height above the cabin floor
export const LINE = { z0: -9, y0: 30 + HANG, zP: -150, yP: 93.5, z1: -307, y1: 140 + HANG, sag0: 5.5, sag1: 6.5 };
export const PYLON = { x: 85, z: -150, base: 22 };   // lattice pylon on the rock rib; saddle at LINE.yP
export const CABIN = { w: 2.9, l: 4.3, h: 2.55 };    // outer box (x, z, y)

// ---------------------------------------------------------------- Grauhorn station (summit saddle, y 140)
export const SUMMIT_Y = 140;
export const HALL = { x0: 64, x1: 108, z0: -324, z1: -292, y: 140, roofY: 152 };  // arrival hall (cabin dock inside)
export const HALL_WALK = { x0: 67, x1: 105, z0: -321, z1: -296 };
export const DOCK = { x: 80, z: -307 };                 // our cabin stops here (centre)
export const COURT = { x0: 54, x1: 152, z0: -378, z1: -324, y: 140 };
export const BLOCK = { x0: 70, x1: 140, z0: -398, z1: -382, y: 140, roofY: 148 };  // north block: roof walk
export const TOWER = { x0: 50, x1: 70, z0: -400, z1: -380, roofY: 156, dome: [54.8, -384.8], domeR: 4.6 };
// stair A: courtyard → block roof, against the block's south face, rising east
export const STAIR_A = { x0: 108, x1: 122, z0: -381.6, z1: -378.2, y0: 140, y1: 148 };
export const LAND_A = { x0: 122, x1: 127.5, z0: -383.2, z1: -378.2 };   // its top landing, onto the roof walk
// stair B: block roof → tower terrace, against the tower's east face, rising north
export const STAIR_B = { x0: 70.2, x1: 73.8, z0: -396, z1: -383, y0: 148, y1: 156 };
export const LAND_B = { x0: 69.8, x1: 73.8, z0: -399.5, z1: -396 };    // top landing (joins the terrace)
// the rack-railway avalanche gallery: cut into the slope east of the block, floor at the roof walk height;
// open (pillars) to the south, rock to the north, tunnel portal at the east end
export const GALLERY = { x0: 140, x1: 232, z0: -398, z1: -383, y: 148, roofY: 154.5, portal: 232 };
export const RAILCAR = { x: 222, z: -390.5 };          // the driver waits here with the rack railcar

// ---------------------------------------------------------------- the face + the avalanche
export const FACE = { z0: -414, zTop: -740, yTop: 440, x0: -260, x1: 420 };
export const CORNICE = { z: -705, x0: -40, x1: 260 };   // crown line of the slab (Gazex line just below it)
export const GAZEX = [[34, -628], [92, -616], [150, -624], [206, -632]];   // (lower on the face than the cornice: they have to read from the terrace)   // avalanche-cannon tubes (x, z)
export const CONVOY = [[60, -600], [118, -585], [176, -596]];             // snowcats coming down the face

// ---------------------------------------------------------------- start / snipers / props
export const START = { x: -93, y: 0, z: 110.6, yaw: -Math.PI / 2 + 0.08 };   // facing east, up the road, the snowcat burning ahead
export const SNIPERS = {
  rib: { x: -24, y: 0, z: 30, face: [0.15, 1] },        // rock ledge above leg 3 (laser down onto leg 2)
  shed: { x: 118, y: 0, z: 30, face: [-1, 0.4] },       // the yard: on the snow-groomer shed roof
  pylon: { x: PYLON.x + 2.2, y: 0, z: PYLON.z - 1.5, face: [0, 1] },
  cliff: { x: 44, y: 0, z: -284, face: [0.4, 1] },      // summit cliff ledge west of the hall
  radar: { x: 132, y: 0, z: -392, face: [-0.3, 1] },
};

// =====================================================================================
//  Terrain function + bake
// =====================================================================================
const TX0 = -200, TZ0 = -800, TX1 = 320, TZ1 = 200, TC = 1;     // baked region (1 m)
export const TERR = { x0: TX0, z0: TZ0, x1: TX1, z1: TZ1, cell: TC };

// deterministic value noise (lattice hash)
function h2(i, j) { let n = (i * 374761393 + j * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
function vn(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h2(i, j), b = h2(i + 1, j), c = h2(i, j + 1), d = h2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { s += a * vn(x * f + o * 31.7, z * f - o * 17.3); a *= 0.5; f *= 2.03; } return s; }
export function ridged(x, z, oct = 4) { let s = 0, a = 0.5, f = 1; for (let o = 0; o < oct; o++) { const n = 1 - Math.abs(vn(x * f + o * 13.1, z * f + o * 7.7) * 2 - 1); s += a * n * n; a *= 0.5; f *= 2.1; } return s; }
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// the mountain before any road is cut: profile along z (uphill north), shaped across x
function baseHeight(x, z) {
  let y;
  // ---- lower slope (switchbacks) and the valley below it
  const slope = 4.5 + (106 - z) * 0.36;
  if (z > -14) {
    y = slope;
    // the station shelf: a shoulder at ~31 between z 40 and -14
    y = lerp(y, 31 + fbm2(x * 0.05, z * 0.05) * 2, sst(44, 26, z));
    // the valley flattens out below the road
    y = Math.min(y, lerp(y, -4 - (z - 128) * 0.12, sst(118, 140, z)));
    // the bowl's side walls
    y += Math.max(0, -95 - x) * 0.55 + Math.max(0, x - 140) * 0.5;
    y += (fbm2(x * 0.03, z * 0.03) - 0.5) * 6 + (fbm2(x * 0.11, z * 0.11) - 0.5) * 1.6;
    // into the gorge: the shelf breaks off north of the station
    const g = sst(-14, -52, z);
    y = lerp(y, -42 + (fbm2(x * 0.02, z * 0.02) - 0.5) * 10, g);
  } else if (z > -250) {
    // gorge floor, with the pylon's rock rib across it
    y = -42 + (fbm2(x * 0.02, z * 0.02) - 0.5) * 10 + ridged(x * 0.04, z * 0.04) * 8;
    const rib = Math.exp(-(((z - PYLON.z) / 16) ** 2)) * (1 - sst(40, 150, Math.abs(x - PYLON.x)) * 0.8);
    y = lerp(y, PYLON.base - 2 + ridged(x * 0.08, z * 0.08) * 5, rib);
    y = lerp(y, 30, 1 - sst(-14, -52, z));
  } else y = 0;
  // ---- summit cliff + saddle + face
  if (z <= -200) {
    const cliff = sst(-236, -296, z);
    const saddle = 140 + (fbm2(x * 0.04, z * 0.04) - 0.5) * 4;
    let s = lerp(-42 + ridged(x * 0.03, z * 0.03) * 10, saddle, cliff);
    // the face north of the saddle
    const f = Math.max(0, -412 - z);
    // the face: ribs and couloirs running down the fall line (ridged noise stretched along z), a rock band
    // two thirds of the way up, the cornice lip at the top
    const ribs = (ridged(x * 0.024, z * 0.006) - 0.42) * 26 + (ridged(x * 0.06, z * 0.015) - 0.4) * 6;
    const band = Math.exp(-(((f - 190) / 26) ** 2)) * 14;
    const face = 141 + f * 0.86 - f * f * 0.00028 + ribs * sst(0, 110, f) + band + (ridged(x * 0.012, z * 0.012) - 0.3) * 18 * sst(0, 80, f);
    if (z < -412) s = Math.max(s, face);
    // shoulders: rock rises west of the station and far east (frames the saddle)
    s += Math.max(0, 36 - x) * 0.9 * sst(-280, -330, z) + Math.max(0, x - 270) * 0.75;
    s += (ridged(x * 0.05, z * 0.05) - 0.35) * 6 * sst(-230, -300, z);
    y = z > -250 ? lerp(y, s, sst(-200, -250, z)) : s;
  }
  return y;
}

// ---------------------------------------------------------------- road polyline (dense, with heights)
function hairpin(H, toward) {   // semicircle points from (c.x, c.z + r) round the outside to (c.x, c.z - r)
  const pts = [], n = 16;
  for (let i = 1; i < n; i++) {
    const a = i / n * Math.PI;               // 0 = south point, PI = north point
    const x = H.c[0] + Math.sin(a) * H.r * toward, z = H.c[1] + Math.cos(a) * H.r;
    pts.push([x, lerp(H.y0, H.y1, i / n), z]);
  }
  return pts;
}
export const ROAD = [
  ...VALLEY,
  LEG1.b, ...hairpin(HP1, 1), LEG2.a, LEG2.b, ...hairpin(HP2, -1), LEG3.a, LEG3.b,
  ...YARD_IN.slice(1),
];
// segments: [ax, ay, az, bx, by, bz, len, legId]
export const ROAD_SEGS = [];
for (let i = 0; i < ROAD.length - 1; i++) {
  const a = ROAD[i], b = ROAD[i + 1];
  ROAD_SEGS.push([a[0], a[1], a[2], b[0], b[1], b[2], Math.hypot(b[0] - a[0], b[2] - a[2])]);
}
// nearest point on the road: { d (horizontal), y (road height there), t (segment param), i (segment), along }
const _rn = { d: 1e9, y: 0, i: -1, t: 0, along: 0, sx: 0, sz: 0 };
export function roadNearest(x, z, out = _rn) {
  out.d = 1e9;
  let acc = 0;
  for (let i = 0; i < ROAD_SEGS.length; i++) {
    const s = ROAD_SEGS[i];
    const dx = s[3] - s[0], dz = s[5] - s[2], L2 = dx * dx + dz * dz;
    let t = L2 > 0 ? ((x - s[0]) * dx + (z - s[2]) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = s[0] + dx * t, pz = s[2] + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < out.d) { out.d = d; out.y = s[1] + (s[4] - s[1]) * t; out.i = i; out.t = t; out.along = acc + s[6] * t; out.sx = dx / (s[6] || 1); out.sz = dz / (s[6] || 1); }
    acc += s[6];
  }
  return out;
}
export const ROAD_LEN = ROAD_SEGS.reduce((a, s) => a + s[6], 0);
// the point at distance `along` (for props, auto routes)
export function roadAt(along, out = [0, 0, 0, 0, 0]) {
  let acc = 0;
  for (const s of ROAD_SEGS) {
    if (along <= acc + s[6] || s === ROAD_SEGS[ROAD_SEGS.length - 1]) {
      const t = Math.min(1, Math.max(0, (along - acc) / (s[6] || 1)));
      out[0] = s[0] + (s[3] - s[0]) * t; out[1] = s[1] + (s[4] - s[1]) * t; out[2] = s[2] + (s[5] - s[2]) * t;
      out[3] = (s[3] - s[0]) / (s[6] || 1); out[4] = (s[5] - s[2]) / (s[6] || 1);
      return out;
    }
    acc += s[6];
  }
  return out;
}

// flattened plateaus (rect, height, blend width)
const FLATS = [
  { x0: YARD.x0 - 2, x1: YARD.x1, z0: MID.z0 - 2, z1: YARD.z1, y: 30, b: 7 },
  { x0: HUT.x0, x1: HUT.x1 + 2, z0: HUT.z0, z1: HUT.z1, y: HUT.y - 0.1, b: 3 },
  { x0: CHAPEL.x - 4, x1: CHAPEL.x + 4, z0: CHAPEL.z - 4, z1: CHAPEL.z + 4, y: 9.7, b: 2 },
  { x0: HALL.x0 - 4, x1: COURT.x1, z0: COURT.z0, z1: HALL.z1 + 3, y: SUMMIT_Y, b: 5 },
  { x0: TOWER.x0 - 3, x1: BLOCK.x1, z0: BLOCK.z0 - 3, z1: COURT.z0, y: SUMMIT_Y, b: 4 },
  // the gallery shelf: cut into the slope at the roof-walk height
  { x0: GALLERY.x0, x1: GALLERY.x1 + 12, z0: GALLERY.z0 - 1, z1: GALLERY.z1 + 0.5, y: GALLERY.y - 0.05, b: 2.5, cutOnly: false },
];
function rectDist(x, z, r) { const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1); return Math.hypot(dx, dz); }

function terrainRaw(x, z) {
  let y = baseHeight(x, z);
  // road shelf: cut uphill (north) with a retaining wall step, fill downhill as an embankment
  const R = x > -215 && x < 110 && z > 20 && z < 190 ? roadNearest(x, z, _rq) : _rFar;
  if (R.d < 60) {
    const e = Math.max(0, R.d - (ROAD_W + 1.6));
    // which side of the road is this point on? (uphill = north = -z in road-local terms)
    const nx = -R.sz, nz = R.sx;                       // left normal of travel direction
    const sx0 = ROAD_SEGS[R.i][0] + (ROAD_SEGS[R.i][3] - ROAD_SEGS[R.i][0]) * R.t, sz0 = ROAD_SEGS[R.i][2] + (ROAD_SEGS[R.i][5] - ROAD_SEGS[R.i][2]) * R.t;
    const lat = (x - sx0) * nx + (z - sz0) * nz;
    const uphill = (nz * Math.sign(lat || 1)) < 0;      // the side whose normal points north
    const r = R.y - 0.12;                               // terrain just under the packed surface
    // the pull-out is road too: measure the bank from its edge
    const ep = Math.hypot(Math.max(PULLOUT.x0 - x, 0, x - PULLOUT.x1), Math.max(PULLOUT.z0 - z, 0, z - PULLOUT.z1));
    const ee = Math.min(e, Math.max(0, ep - 1.2));
    const up = (uphill ? 1.6 : 0.0) + ee * (uphill ? 0.95 : 0.85);
    const dn = ee * 0.85;
    y = r + Math.max(-dn, Math.min(up, y - r));
    if (R.d < ROAD_W + 1.6 || inR(x, z, PULLOUT)) y = r - (R.d > ROAD_W ? Math.min(R.d - ROAD_W, 1.6) * 0.04 : 0);
  }
  for (const F of FLATS) {
    const d = rectDist(x, z, F);
    if (d < F.b * 4) { const k = 1 - sst(0, F.b, d); const lim = d * 1.1; y = lerp(F.y + Math.max(-lim, Math.min(lim, y - F.y)), F.y, k); }
  }
  return y;
}
const _rq = { d: 0, y: 0, i: 0, t: 0, along: 0, sx: 0, sz: 0 }, _rFar = { d: 1e9 };

export let HF = null, HFN = [0, 0];
export function bakeTerrain() {
  if (HF) return HF;
  const nx = Math.round((TX1 - TX0) / TC) + 1, nz = Math.round((TZ1 - TZ0) / TC) + 1;
  HF = new Float32Array(nx * nz); HFN = [nx, nz];
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) HF[k * nx + i] = terrainRaw(TX0 + i * TC, TZ0 + k * TC);
  return HF;
}
export function terrainAt(x, z) {
  if (!HF) bakeTerrain();
  const fx = (x - TX0) / TC, fz = (z - TZ0) / TC;
  const nx = HFN[0], nz = HFN[1];
  if (fx < 0 || fz < 0 || fx >= nx - 1 || fz >= nz - 1) return baseHeight(x, z);
  const i = Math.floor(fx), k = Math.floor(fz), u = fx - i, v = fz - k, o = k * nx + i;
  const a = HF[o], b = HF[o + 1], c = HF[o + nx], d = HF[o + nx + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// far terrain beyond the baked block (coarse, analytic)
export function farHeight(x, z) { return baseHeight(x, z); }

// =====================================================================================
//  Struct floors (roofs, stairs, decks) and the walk mask
// =====================================================================================
const inR = (x, z, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
// floors that are not the terrain (null = terrain)
export function structFloor(x, z) {
  // stairs and landings first (they sit over / against the blocks)
  if (inR(x, z, LAND_B)) return TOWER.roofY;
  if (inR(x, z, STAIR_B)) return STAIR_B.y0 + (STAIR_B.y1 - STAIR_B.y0) * Math.min(1, Math.max(0, (STAIR_B.z1 - z) / (STAIR_B.z1 - STAIR_B.z0)));
  if (inR(x, z, LAND_A)) return BLOCK.roofY;
  if (inR(x, z, STAIR_A)) return STAIR_A.y0 + (STAIR_A.y1 - STAIR_A.y0) * Math.min(1, Math.max(0, (x - STAIR_A.x0) / (STAIR_A.x1 - STAIR_A.x0)));
  if (inR(x, z, BLOCK)) return BLOCK.roofY;
  if (inR(x, z, TOWER)) return TOWER.roofY;
  if (inR(x, z, GALLERY)) return GALLERY.y;
  if (inR(x, z, HALL_WALK)) return HALL.y;
  if (inR(x, z, MID_HALL)) return MID.y + 0.02;
  return null;
}
// the ground everything stands on (particles, debris, bodies, rain, casings)
export function groundAt(x, z) { const s = structFloor(x, z); return s ?? terrainAt(x, z); }

// where the PLAYER (and the soldiers' nav) may walk
export function walkable(x, z) {
  if (roadNearest(x, z, _rw).d < ROAD_W + 1.15 && z < 124) return true;
  if (inR(x, z, YARD) || inR(x, z, MID_HALL)) return true;
  if (x > 72.4 && x < 97.6 && z > 6.5 && z < 8.5) return true;   // the station's big doorway (the hall stops at z 7, the yard starts at 8)
  // the start pull-out by the wrecked snowcat
  if (inR(x, z, PULLOUT, -0.8)) return true;
  if (inR(x, z, HUT, -0.8) && !(x < -66 && x > -84 && z > 57 && z < 71)) return true;   // the terrace round the hut
  // summit
  if (inR(x, z, HALL_WALK) || inR(x, z, COURT) || inR(x, z, STAIR_A) || inR(x, z, STAIR_B) || inR(x, z, LAND_B) || inR(x, z, LAND_A)) return true;
  if (inR(x, z, BLOCK, -0.6) || inR(x, z, TOWER, -0.6)) return true;
  if (inR(x, z, GALLERY, -0.4)) return true;
  // joins the edge margins above would otherwise cut: the landing onto the terrace, the roof walk into the gallery
  if (x > 69 && x < 71 && z > -399.4 && z < -396.1) return true;
  if (x > 139 && x < 141 && z > -397 && z < -383.8) return true;
  if (x > 108 && x < 122 && z > -378.5 && z < -377.8) return true;   // the foot of stair A (it starts 0.2 m north of the courtyard)
  // the hall → courtyard doors
  if (x > 76 && x < 98 && z > -325 && z < -320) return true;
  return false;
}
const _rw = { d: 0, y: 0, i: 0, t: 0, along: 0, sx: 0, sz: 0 };

// ---------------------------------------------------------------- the cable line
export function lineY(z) {
  // two catenary-ish spans meeting on the pylon saddle
  if (z >= LINE.zP) { const s = (LINE.z0 - z) / (LINE.z0 - LINE.zP); return lerp(LINE.y0, LINE.yP, s) - LINE.sag0 * 4 * s * (1 - s); }
  const s = (LINE.zP - z) / (LINE.zP - LINE.z1); return lerp(LINE.yP, LINE.y1, s) - LINE.sag1 * 4 * s * (1 - s);
}
export function lineSlope(z) { return (lineY(z - 0.5) - lineY(z + 0.5)); }   // dy per metre travelled north

// ---------------------------------------------------------------- abandoned vehicles (explosive cover)
// [x, z, yawDeg, type, flags]; y comes from the road
export const CARS = [
  // leg 1: a stalled convoy truck and civilians who gave up
  [-30, 108.4, 84, 'suv', 'haz'], [-6, 104.0, 96, 'sedan', 'open'], [-17, 108.6, 80, 'van', ''],   // (the van used to box a pocket in against the roadblock at x 18)
  // leg 2
  [16, 79.0, -94, 'sedan', 'alarm'], [-14, 77.2, -100, 'suv', ''], [-34, 72.8, -76, 'sedan', 'open'],
  // leg 3
  [-20, 50.4, 92, 'van', 'haz'], [12, 46.4, 100, 'suv', ''],
  // yard
  [60, 30, 20, 'suv', ''], [100, 36, -70, 'van', ''],
];
