import * as THREE from 'three';
import { makeRng, clamp, lerp } from '../../rng.js';

// =====================================================================================
//  LEVEL 8 — "SAND CASTLES". Al-Sarab, a fictional Gulf megacity, seen from the open door
//  of HAMMER ONE. Every number lives here: the URL flags, the coast / marina / boulevard,
//  the rail route, and the tower plan (placed around the route so the flight path always
//  keeps `clear` metres from any tower face it passes at its own height).
//  World frame: +x east, -z north (the Gulf), +y up. The sun sets in the west-north-west,
//  over the sea.
// =====================================================================================

export function readFlags(params, isQuest) {
  const num = (k, d, lo = -Infinity, hi = Infinity) => { const v = parseFloat(params.get(k)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const bool = (k, d) => (params.has(k) ? params.get(k) !== '0' && params.get(k) !== 'false' : d);
  const dust = (params.get('dust') || (isQuest ? 'mid' : 'high')).toLowerCase();
  return {
    alt: num('alt', 150, 70, 400),        // route cruise altitude (m); the whole height profile scales with it
    speed: num('speed', 34, 8, 90),       // cruise speed (m/s); transit legs run a little faster, fights slower
    clear: num('clear', 55, 25, 200),     // minimum horizontal distance from the path to a tower face at path height
    bank: num('bank', 6, 0, 25),          // max cabin roll (deg), 0 = horizon locked
    pitch: num('pitch', 2, 0, 10),        // max cabin pitch (deg)
    yawRate: num('yaw', 8, 2, 30),        // max heading rate (deg/s): the comfort cap on turns and the door-facing crab
    crab: num('crab', 1, 0, 1),           // 0 = the nose always follows the path (no door-facing crab)
    hz: num('hz', 72, 0, 120),            // XR display rate to request (Level 8 targets 72; 0 = browser default)
    perf: bool('perf', false),            // perf panel (cabin bulkhead) + desktop overlay
    panel: (params.get('panel') || 'cabin').toLowerCase(),
    dust: ['off', 'low', 'mid', 'high'].includes(dust) ? dust : 'mid',
    fill: num('fill', isQuest ? 2.5 : 0, 0, 40),  // dust fill budget in screens (0 = no cap)
    occl: bool('occl', true),
    glass: bool('glass', true),
    swap: bool('swap', true),
    swapdebug: bool('swapdebug', false),
    slowmo: bool('slowmo', true),
    shadows: bool('shadows', true),       // city-wide 2.5D sun shadows (height-map march in the facade / ground shaders)
    gpu: bool('gpu', true),
    traffic: Math.round(num('traffic', isQuest ? 180 : 320, 0, 600)),
    isQuest,
  };
}

// ------------------------------------------------------------------ the land
export const SUN_AZ = new THREE.Vector3(-1, 0, -0.5).normalize(); // toward the sun (the Gulf, west-north-west)
export const COAST_Z = (x) => -1520 + 90 * Math.sin(x / 640 + 0.6) + 40 * Math.sin(x / 233);
// the marina: a canal from the sea mouth winding south into the towers
export const CANAL = [[-1480, -1700], [-1440, -1420], [-1530, -1150], [-1470, -880], [-1330, -650], [-1310, -420], [-1380, -260]];
export const CANAL_W = 70;
// the boulevard: fourteen lanes running east-west through the whole city
export const BLVD = { z: 150, w: 92, x0: -3600, x1: 3800 };
// the city grid
export const GRID = { pitch: 150, road: 22, x0: -2900, x1: 3000, z0: -1500, z1: 1700 };
// the palm island off the coast: trunk from the shore, fronds, the crescent breakwater
export const PALM = { x: -900, z: -2520, trunk: [-1560, -3080], frondL: 560, crescentR: 1060 };
export const HERO = {
  x: 0, z: -230,        // the SARAB SPIRE, north of the boulevard
  // a true outlier (like the real-world supertalls it nods to): ~830 m to the tip, ~3x the towers round it
  h: 608, band: 16, w0: 90, w1: 38, spire: 224, breakBand: 18,
  name: 'SARAB SPIRE',
};

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function canalDist(x, z) { let m = 1e9; for (let i = 0; i < CANAL.length - 1; i++) m = Math.min(m, segDist(x, z, ...CANAL[i], ...CANAL[i + 1])); return m; }
// is (x, z) open water? (the Gulf north of the coast, the marina canal, the palm's lagoon)
export function isWater(x, z) {
  if (z < COAST_Z(x)) return !onPalm(x, z);
  return canalDist(x, z) < CANAL_W * 0.5;
}
export function onPalm(x, z) {
  const P = PALM, dx = x - P.x, dz = z - P.z;
  // trunk
  if (Math.abs(x - P.x) < 70 && z > P.trunk[1] && z < P.trunk[0] + 40) return true;
  // fronds: 8 each side, fanning from the trunk head
  const r = Math.hypot(dx, dz);
  if (r < 170) return true;
  if (r < P.frondL) {
    const a = Math.atan2(dz, dx);
    for (let k = 0; k < 15; k++) { const fa = -Math.PI * 0.08 - k * (Math.PI * 0.84 / 14) - Math.PI * 0.04; if (Math.abs(Math.atan2(Math.sin(a - fa), Math.cos(a - fa))) * r < 26) return true; }
  }
  // crescent
  if (Math.abs(r - P.crescentR * 0.62) < 30 && dz < 40) return true;
  return false;
}

// ------------------------------------------------------------------ the route
// control points [x, y (fraction of alt), z, tag]. Tags are the beats' anchors.
const ROUTE = [
  [-760, 1.3, -2950, 'start'],
  [-1020, 1.12, -2380, 'palm'],
  [-1300, 1.0, -1900],
  [-1440, 0.95, -1600, 'coast'],
  [-1460, 0.93, -1330, 'marina'],
  [-1520, 0.93, -1090],
  [-1450, 0.93, -840],
  [-1300, 0.95, -560, 'marina2'],
  [-1180, 0.98, -260],
  [-930, 0.92, -10],
  [-620, 0.82, 120, 'blvd'],
  [-250, 0.8, 165],
  [200, 0.8, 170, 'blvd2'],
  [650, 0.82, 168],
  [1050, 0.9, 180],
  [1330, 1.05, 360, 'turn'],
  [1310, 1.06, 640, 'haboob'],
  [950, 1.05, 780],
  [450, 1.03, 800, 'gunship'],
  [0, 1.0, 790],
  [-450, 1.02, 740, 'gunship2'],
  [-760, 1.06, 520],
  [-760, 1.08, 230],
  [-420, 1.08, 60, 'pass'],
  [0, 1.08, 40],
  [300, 1.1, -40],
  // the strike loop: centre (560, -720), r 480, the door (left) always facing in
  [560, 1.1, -240, 'strike'],
  [900, 1.1, -380],
  [1040, 1.1, -720, 'strike2'],
  [900, 1.1, -1060],
  [560, 1.1, -1200, 'strike3'],
  [300, 1.45, -1250],
  [90, 2.1, -1060],
  // the hover: far enough back and high enough that the whole Spire fits in the door
  [0, 2.6, -900, 'spire'],
  [-210, 2.45, -1030],
  [-460, 2.0, -1250, 'escape'],
  [-720, 1.6, -1500],
  [-960, 1.45, -2050],
  [-1000, 1.6, -2500, 'sea'],
  [-900, 1.75, -3000],
];
export function routePoints(F) {
  return ROUTE.map(([x, y, z, tag]) => ({ p: new THREE.Vector3(x, y * F.alt, z), tag: tag || null }));
}

// ------------------------------------------------------------------ the towers
// A tower: { x, z, w, d, h, rot, kind, style, district, role: 'static'|'mid'|'target'|'crash'|'fight', roof: 'pad'|'pool'|'deck'|'mech'|'crown' }
// kinds: box, chamfer, round, tri, twist, stepped, slab, sail
const KINDS_MARINA = ['round', 'chamfer', 'twist', 'stepped', 'tri', 'chamfer', 'round', 'box'];
const KINDS_BLVD = ['box', 'chamfer', 'stepped', 'twist', 'tri', 'slab', 'box', 'round', 'sail'];
const KINDS_BIZ = ['box', 'slab', 'chamfer', 'stepped', 'box', 'round'];

// sample the route polyline (dense) for clearance tests
function denseRoute(F) {
  const c = new THREE.CatmullRomCurve3(routePoints(F).map(r => r.p), false, 'centripetal');
  const n = 1600, out = [];
  for (let i = 0; i <= n; i++) out.push(c.getPoint(i / n));
  return out;
}
// horizontal distance from (x, z) to the route, the route height there, and the minimum route height nearby
function routeNear(dense, x, z) {
  let best = 1e18, y = 0, ymin = 1e9;
  for (const p of dense) {
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < best) { best = d; y = p.y; }
    if (d < 400 * 400) ymin = Math.min(ymin, p.y);
  }
  return { d: Math.sqrt(best), y, ymin };
}

export function district(x, z) {
  if (z < COAST_Z(x) + 30) return 'sea';
  const dc = canalDist(x, z);
  if (x < -850 && dc < 420 && z < -150) return 'marina';
  if (Math.abs(z - BLVD.z) < 360 && x > -1500 && x < 1900) return 'blvd';
  if (Math.hypot(x - HERO.x, z - HERO.z) < 520) return 'downtown';
  if (x > -400 && x < 1500 && z < -300 && z > -1350) return 'biz';
  if (x > -2600 && x < 2700 && z > -1500 && z < 1500) return 'city';
  return 'outer';
}

// The fallers (mid rig), the strike targets and the gunship crash tower are placed explicitly around the route.
export const SPECIAL = [
  // strike targets: the AA towers inside the strike loop (centre 560, -720)
  { id: 'T1', role: 'target', x: 360, z: -640, w: 46, d: 40, h: 275, kind: 'stepped', rot: 0.1, roof: 'aa', mode: 'tilt' },
  { id: 'T2', role: 'target', x: 640, z: -480, w: 50, d: 50, h: 292, kind: 'chamfer', rot: 0.5, roof: 'aa', mode: 'pancake' },
  { id: 'T3', role: 'target', x: 790, z: -780, w: 44, d: 52, h: 262, kind: 'box', rot: -0.2, roof: 'aa', mode: 'lean' },
  { id: 'T4', role: 'target', x: 520, z: -940, w: 40, d: 40, h: 284, kind: 'round', rot: 0, roof: 'aa', mode: 'tilt' },
  // the tower WIDOWMAKER 4 goes into (south of the boulevard, on the storm leg)
  { id: 'C1', role: 'crash', x: -330, z: 640, w: 48, d: 44, h: 230, kind: 'twist', rot: 0.3, roof: 'crown', mode: 'tilt' },
  // escalation: neighbours that come down while you paint (one at a time, behind the dust)
  { id: 'E1', role: 'mid', x: 1230, z: -1150, w: 42, d: 42, h: 200, kind: 'slab', rot: 0.9, roof: 'mech', mode: 'pancake' },
  { id: 'E2', role: 'mid', x: -300, z: -560, w: 44, d: 40, h: 170, kind: 'chamfer', rot: 0.2, roof: 'pad', mode: 'lean' },
  { id: 'E3', role: 'mid', x: 1300, z: -380, w: 40, d: 46, h: 190, kind: 'box', rot: -0.4, roof: 'mech', mode: 'tilt' },
  // the spire's neighbour to the east: the spire's top comes down across it in the finale
  { id: 'N1', role: 'mid', x: 210, z: -280, w: 44, d: 44, h: 165, kind: 'stepped', rot: 0.25, roof: 'pad', mode: 'tilt' },
];

// rooftop fight stations: towers placed on the door side of the route, roofs below the path
// station: route tag, how far along from it (m), side offset (m, + = left of travel), roof drop below path (m)
export const FIGHTS = [
  { at: 'marina', along: 120, off: 92, drop: 30, roof: 'pool', kind: 'round', men: 4, rpg: 0 },
  { at: 'marina', along: 380, off: 100, drop: 26, roof: 'pad', kind: 'chamfer', men: 3, rpg: 1 },
  { at: 'marina2', along: 60, off: 95, drop: 34, roof: 'deck', kind: 'stepped', men: 4, rpg: 1 },
  { at: 'blvd', along: 160, off: 100, drop: 28, roof: 'pad', kind: 'box', men: 3, rpg: 1 },
  { at: 'blvd2', along: -60, off: 105, drop: 36, roof: 'pool', kind: 'chamfer', men: 4, rpg: 1 },
  { at: 'blvd2', along: 380, off: 95, drop: 26, roof: 'deck', kind: 'tri', men: 3, rpg: 2 },
];

export function buildPlan(F) {
  const rng = makeRng(8080);
  const dense = denseRoute(F);
  const towers = [];
  const occupied = []; // [x, z, r]
  const free = (x, z, r) => occupied.every(([ox, oz, or]) => Math.hypot(ox - x, oz - z) > or + r + 18);
  const take = (t) => { occupied.push([t.x, t.z, Math.hypot(t.w, t.d) * 0.5]); towers.push(t); return t; };
  // the hero's plaza
  occupied.push([HERO.x, HERO.z, 120]);
  // 1. specials
  for (const s of SPECIAL) take({ ...s, style: Math.floor(rng() * 8), district: district(s.x, s.z) });
  // 2. fight towers, positioned off the route
  const pts = routePoints(F), curve = new THREE.CatmullRomCurve3(pts.map(r => r.p), false, 'centripetal');
  const L = curve.getLength(), tagS = {};
  { const N = 3000; let acc = 0, prev = curve.getPoint(0); const tagged = pts.map((r, i) => ({ tag: r.tag, p: r.p })).filter(r => r.tag);
    for (let i = 1; i <= N; i++) { const p = curve.getPoint(i / N); acc += p.distanceTo(prev); prev = p; for (const t of tagged) { const d = p.distanceTo(t.p); if (!(t.tag in tagS) || d < tagS[t.tag].d) tagS[t.tag] = { d, s: acc }; } }
    for (const k in tagS) tagS[k] = tagS[k].s; }
  const atS = (s) => curve.getPointAt(clamp(s / L, 0, 1)), tanS = (s) => curve.getTangentAt(clamp(s / L, 0, 1));
  const fights = [];
  FIGHTS.forEach((f, i) => {
    const s = tagS[f.at] + f.along, p = atS(s), t = tanS(s);
    const left = new THREE.Vector3(t.z, 0, -t.x).normalize(); // left of travel, seen from above
    const x = p.x + left.x * f.off, z = p.z + left.z * f.off;
    const w = 44 + rng() * 10, d = 44 + rng() * 10;
    const h = Math.max(60, p.y - f.drop);
    const T = take({ id: 'F' + i, role: 'fight', x, z, w, d, h, kind: f.kind, rot: 0, roof: f.roof, style: Math.floor(rng() * 8), district: district(x, z) });
    fights.push({ ...f, i, s, tower: T });
  });
  // 3. the grid: towers on the lots
  const G = GRID;
  for (let gx = G.x0; gx < G.x1; gx += G.pitch) for (let gz = G.z0; gz < G.z1; gz += G.pitch) {
    const cx = gx + G.pitch / 2, cz = gz + G.pitch / 2;
    const dist = district(cx, cz);
    if (dist === 'sea' || dist === 'outer') continue;
    const dens = { marina: 0.97, blvd: 0.97, downtown: 0.85, biz: 0.9, city: 0.4 }[dist];
    // up to 2 towers per block in dense districts
    const per = dist === 'city' ? 1 : 2;
    for (let k = 0; k < per; k++) {
      if (rng() > dens) continue;
      const ox = (per === 1 ? 0 : (k === 0 ? -1 : 1) * G.pitch * 0.22) + (rng() - 0.5) * 24, oz = (rng() - 0.5) * (G.pitch * 0.36);
      const x = cx + ox, z = cz + oz;
      if (isWater(x, z) || canalDist(x, z) < CANAL_W * 0.5 + 40) continue;
      if (Math.abs(z - BLVD.z) < BLVD.w * 0.5 + 34) continue;
      const kinds = dist === 'marina' ? KINDS_MARINA : dist === 'biz' ? KINDS_BIZ : KINDS_BLVD;
      const kind = kinds[Math.floor(rng() * kinds.length)];
      let w = 30 + rng() * 24, d = kind === 'slab' ? 18 + rng() * 10 : 30 + rng() * 24;
      if (kind === 'round' || kind === 'twist' || kind === 'tri') d = w;
      const hr = { marina: [140, 330], blvd: [130, 360], downtown: [150, 320], biz: [80, 195], city: [36, 110] }[dist];
      let h = lerp(hr[0], hr[1], Math.pow(rng(), 1.3));
      const r = Math.hypot(w, d) * 0.5;
      if (!free(x, z, r)) continue;
      // keep the path clear: a tower that reaches the path's height stays `clear` m from it; lower ones may sit under it
      const R = routeNear(dense, x, z);
      if (R.d - r < F.clear) {
        if (R.d - r < 12) { h = Math.min(h, R.y - 55); }
        else h = Math.min(h, R.ymin - 38);
        if (h < 30) continue;
      }
      // the money shot's sightline (the hover north of the Spire -> its break): keep it clear
      { const ax = 0, az = -900, bx = HERO.x, bz = HERO.z, dd = segDist(x, z, ax, az, bx, bz);
        if (dd < r + 60) { const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))); h = Math.min(h, (F.alt * 2.6) * (1 - t) + 290 * t - 70); if (h < 30) continue; } }
      // the downtown bowl: everything round the Spire's foot stays low (podiums, a few mid-rises), rising with
      // distance, so the Spire towers ~3x over its neighbourhood instead of standing in a forest of equals
      { const dH = Math.hypot(x - HERO.x, z - HERO.z); if (dH < 800) { h = Math.min(h, 70 + Math.max(0, dH - 180) * 0.32); if (h < 30) continue; } }
      take({ role: 'static', x, z, w, d, h, kind, rot: (rng() < 0.7 ? 0 : (rng() - 0.5) * 0.6) + (dist === 'marina' ? (rng() - 0.5) * 0.8 : 0), roof: pickRoof(rng, h), style: Math.floor(rng() * 8), district: dist });
    }
  }
  // 4. outer skyline (far ring past the city, cheap instanced boxes in the far skyline)
  const far = [];
  const fr = makeRng(4243);
  for (let i = 0; i < 90; i++) {
    const a = fr() * Math.PI * 2, r = 3000 + fr() * 1700;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 300;
    if (isWater(x, z) || z < -2900) continue;
    far.push({ x, z, h: 60 + fr() * 200 * (1 - (r - 3000) / 2400), w: 30 + fr() * 36, d: 30 + fr() * 36, rot: fr() * Math.PI, ruin: 0.2 + fr() * 0.3 });
  }
  // stats for the panel / plan check
  const minClear = (() => {
    let m = 1e9;
    for (const t of towers) {
      const r = Math.hypot(t.w, t.d) * 0.5;
      for (const p of dense) { if (p.y > t.h + 25) continue; m = Math.min(m, Math.hypot(p.x - t.x, p.z - t.z) - r); }
    }
    return m;
  })();
  return { towers, far, fights, tagS, routeLength: L, minClear };
}
function pickRoof(rng, h) {
  const u = rng();
  if (h < 80) return 'mech';
  return u < 0.25 ? 'pad' : u < 0.42 ? 'pool' : u < 0.62 ? 'crown' : u < 0.8 ? 'mech' : 'deck';
}

// dust levels (the overhead DustClouds pool)
export const DUST = {
  off: { max: 1, rate: 0, size: 0 },
  low: { max: 60, rate: 0.45, size: 0.8 },
  mid: { max: 130, rate: 1, size: 1 },
  high: { max: 220, rate: 1.5, size: 1.1 },
};
