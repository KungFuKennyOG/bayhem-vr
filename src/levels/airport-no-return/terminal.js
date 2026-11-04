import * as THREE from 'three';
import * as T from '../../textures.js';
import { box, cyl, mergeGrouped } from '../../geom.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  Airport buildings that give the apron a midground: CONCOURSE B (glass gate lounges over a
//  service level, jet bridges reaching out to nose-in airliners) on the east edge, and the
//  HAVEN AIR CARGO shed with its loading docks on the south edge, silhouetted against the sun.
//  Also reused (bigger, further) as the passenger terminal across the runway.
//  Everything merges into one grouped mesh per building (one draw call per material).
// =====================================================================================
const TAU = Math.PI * 2;
export const TM = { glass: 0, clad: 1, roof: 2, bridge: 3, steel: 4, shed: 5, sign: 6, door: 7, office: 8, conc: 9, yellow: 10, bridgeGlass: 11, navy: 12 };
const NTM = 13;
// sign atlas rows (each 1/8 of the texture height): text, background, text colour
const SIGNS = [
  ['CONCOURSE B', '#1a2330', '#f4f1e6'],
  ['B12', '#f2c018', '#111'],
  ['B14', '#f2c018', '#111'],
  ['B16', '#f2c018', '#111'],
  ['HAVEN AIR CARGO', '#0f2c5c', '#f4f1e6'],
  ['DOCK 1  2  3  4  5  6', '#202224', '#f2c018'],
  ['TERMINAL 1  •  GATES 20-28', '#1a2330', '#f4f1e6'],
  ['NO ENTRY  •  AIRSIDE', '#b2140c', '#fff'],
  ['SKYPORT LOGISTICS', '#202326', '#f2c018'],
  ['AERO TECH  •  MRO', '#7a1712', '#f4f1e6'],
];
export const signRow = (k) => [k / SIGNS.length, (k + 1) / SIGNS.length];

let MATS = null;
export function terminalMaterials() {
  if (MATS) return MATS;
  const m = (o) => new THREE.MeshStandardMaterial(o);
  const glass = curtainWall(), sign = signAtlas();
  MATS = [];
  MATS[TM.glass] = m({ map: glass.map, emissiveMap: glass.emissiveMap, emissive: 0xffd6a0, emissiveIntensity: 0.55, roughness: 0.12, metalness: 0.55, envMapIntensity: 1.6 });
  MATS[TM.clad] = m({ map: cladding(), color: 0xd8d6d0, roughness: 0.6, metalness: 0.25 });
  MATS[TM.roof] = m({ map: T.concreteTexture(77, [0.34, 0.33, 0.32], 128, false), roughness: 0.95 });
  MATS[TM.bridge] = m({ map: bridgeTexture(), roughness: 0.45, metalness: 0.4 });
  MATS[TM.steel] = m({ color: 0x3b3f44, roughness: 0.5, metalness: 0.7 });
  MATS[TM.shed] = m({ map: shedWall(), roughness: 0.55, metalness: 0.45 });
  MATS[TM.sign] = m({ map: sign, emissiveMap: sign, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5 });
  MATS[TM.door] = m({ map: rollerDoor(), roughness: 0.55, metalness: 0.5 });
  const off = officeStrip();
  MATS[TM.office] = m({ map: off.map, emissiveMap: off.emissiveMap, emissive: 0xffe0b0, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.4 });
  MATS[TM.conc] = m({ map: T.concreteTexture(78, [0.62, 0.6, 0.56], 128, true), roughness: 0.9 });
  MATS[TM.yellow] = m({ color: 0xd9a514, roughness: 0.55, metalness: 0.2 });
  MATS[TM.navy] = m({ color: 0x1a2c4e, roughness: 0.5, metalness: 0.35 });
  MATS[TM.bridgeGlass] = m({ color: 0x1b2430, emissive: 0xffc890, emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.6 });
  return MATS;
}

// uv-scaled box (metres per texture repeat) placed at (x, y, z) rotated ry
const B = (w, h, d, x, y, z, ry = 0, uv = 0) => { const g = box(w, h, d, uv); if (ry) g.rotateY(ry); g.translate(x, y, z); return g; };
// a plane on a facade: width w along the facade, height h, centre (x, y, z), facing direction ry (0 = +z)
const P = (w, h, x, y, z, ry, u0 = 0, u1 = 1, v0 = 0, v1 = 1) => {
  const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  g.rotateY(ry); g.translate(x, y, z); return g;
};

// ---------------------------------------------------------------- CONCOURSE (facade faces -x)
// x0 = facade plane, runs from z0 to z1, depth d behind the facade (+x). gates: [{ z, door: Vector3 | null, label }]
export function buildConcourse({ x0, z0, z1, d = 22, gates = [], seed = 1, sign = 0 }) {
  const L = [], r = makeRng(seed), len = z1 - z0, zc = (z0 + z1) / 2;
  const H0 = 5.2, H1 = 12.4, xc = x0 + d / 2;
  // service level: cladding, set back 1.5 m under the lounge overhang, roller doors + dark openings
  L.push([B(d - 1.5, H0, len, xc + 0.75, H0 / 2, zc, 0, 6), TM.clad]);
  for (let z = z0 + 6; z < z1 - 6; z += 14 + r() * 8) {
    const w = 4 + r() * 2;
    L.push([P(w, 3.8, x0 + 1.48, 1.9, z, -Math.PI / 2, 0, w / 4, 0, 1), TM.door]);
  }
  // overhang soffit + columns
  L.push([B(1.6, 0.5, len, x0 + 0.8, H0 - 0.25, zc), TM.steel]);
  for (let z = z0 + 2; z <= z1 - 2; z += 12) L.push([B(0.6, H0, 0.6, x0 + 0.4, H0 / 2, z), TM.steel]);
  // gate lounge level: glass curtain wall on the airside face, cladding at the ends and back
  const gl = H1 - H0 - 0.6;
  L.push([P(len, gl, x0, H0 + 0.3 + gl / 2, zc, -Math.PI / 2, 0, len / 24, 0, 1), TM.glass]);
  L.push([B(d, gl + 0.6, len, xc + 0.02, H0 + (gl + 0.6) / 2, zc, 0, 6), TM.clad]); // interior box (back + ends show cladding)
  // spandrel bands + mullion fins (catch the low sun, break the glass into bays)
  L.push([B(0.5, 0.6, len, x0 - 0.2, H0 + 0.3, zc), TM.clad]);
  L.push([B(0.7, 0.8, len + 1.2, x0 - 0.3, H1 + 0.1, zc), TM.clad]);
  for (let z = z0; z <= z1 + 0.01; z += 6) L.push([B(0.35, gl, 0.18, x0 - 0.15, H0 + 0.3 + gl / 2, z), TM.steel]);
  // roof: parapet + slab, HVAC boxes, louvres, antennas
  L.push([B(d + 0.4, 0.4, len + 1.2, xc, H1 + 0.6, zc), TM.roof]);
  for (let k = 0; k < Math.floor(len / 26); k++) {
    const z = z0 + 10 + k * 26 + r() * 6, w = 4 + r() * 4, h = 1.6 + r() * 1.4;
    L.push([B(w, h, 3 + r() * 3, xc + (r() - 0.3) * 6, H1 + 0.8 + h / 2, z, 0, 3), TM.clad]);
    if (r() < 0.6) L.push([cyl(0.9, 0.9, 0.5, 14).translate(xc + 4 + r() * 4, H1 + 1.05, z + 4), TM.steel]);
  }
  for (let k = 0; k < 3; k++) L.push([cyl(0.06, 0.08, 6 + k * 2, 6).translate(xc + 5 - k * 3, H1 + 3.8 + k, z0 + 30 + k * 60), TM.steel]);
  // big sign on the parapet, at the near end
  { const [v0, v1] = signRow(sign); L.push([P(22, 2.3, x0 - 0.55, H1 + 0.1, z0 + 22, -Math.PI / 2, 0, 1, 1 - v1, 1 - v0), TM.sign]); }
  // jet bridges
  for (const G of gates) jetBridge(L, x0, H0, G);
  return mergeGrouped(L, NTM).geometry;
}

// rotunda on a column, a fixed link from the building, a telescoping tunnel to the door, a wheeled leg near the cab
function jetBridge(L, x0, H0, G) {
  const fy = H0 + 0.5;                            // link floor height at the building
  const rx = x0 - 4.5, rz = G.z + (G.rz ?? -16);  // rotunda
  L.push([B(4.5, 3.0, 3.0, x0 - 2.25, fy + 1.5, rz, 0, 3), TM.bridge]);
  L.push([cyl(2.0, 2.0, 3.4, 16).translate(rx, fy + 1.7, rz), TM.bridge]);
  L.push([cyl(0.55, 0.65, fy, 10).translate(rx, fy / 2, rz), TM.steel]);
  // cab end: at the door (or parked short of the stand)
  const door = G.door || new THREE.Vector3(rx - 16, 3.0, rz + 4);
  const cx = door.x + 2.4, cz = door.z - 1.6, cy = door.y - 0.2; // cab sits just off the door
  const dx = cx - rx, dz = cz - rz, dy = cy - fy, len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
  const pitch = Math.atan2(dy, len);
  // two telescoping sections (outer bigger), pitched down to the door
  for (const [a, b, s] of [[0, 0.55, 1.0], [0.5, 1.0, 0.9]]) {
    const l = len * (b - a) + 0.4, mx = rx + dx * (a + b) / 2, mz = rz + dz * (a + b) / 2, my = fy + dy * (a + b) / 2 + 1.4;
    const g = box(2.9 * s, 2.8 * s, l, 3); g.rotateX(-pitch); g.rotateY(ry); g.translate(mx, my, mz); L.push([g, TM.bridge]);
    // window band (both sides)
    for (const sd of [-1, 1]) { const w = new THREE.PlaneGeometry(l * 0.9, 0.55); w.rotateY(sd > 0 ? Math.PI / 2 : -Math.PI / 2); w.translate(sd * (1.46 * s + 0.01), 0.35, 0); w.rotateX(-pitch); w.rotateY(ry); w.translate(mx, my, mz); L.push([w, TM.bridgeGlass]); }
  }
  // cab + canopy
  { const g = box(3.6, 3.0, 3.0); g.rotateY(ry); g.translate(cx, cy + 1.5, cz); L.push([g, TM.bridge]); }
  { const g = box(3.2, 0.5, 1.2); g.rotateY(ry); g.translate(cx - Math.sin(ry) * 1.8, cy + 2.6, cz - Math.cos(ry) * 1.8); L.push([g, TM.steel]); }
  // drive leg: two struts + a wheel bogie (yellow) 4 m behind the cab
  const lx = cx - Math.sin(ry) * 4.5, lz = cz - Math.cos(ry) * 4.5, ly = cy + 0.3 + (fy - cy) * 4.5 / len;
  for (const s of [-1, 1]) L.push([cyl(0.16, 0.16, ly, 8).translate(lx + Math.cos(ry) * s * 1.0, ly / 2, lz - Math.sin(ry) * s * 1.0), TM.steel]);
  { const g = box(2.8, 0.5, 1.3); g.rotateY(ry); g.translate(lx, 0.55, lz); L.push([g, TM.yellow]); }
  for (const s of [-1, 1]) L.push([cyl(0.45, 0.45, 0.4, 14).rotateZ(Math.PI / 2).rotateY(ry).translate(lx + Math.cos(ry) * s * 1.1, 0.45, lz - Math.sin(ry) * s * 1.1), TM.steel]);
  // gate number on the rotunda link
  if (G.label != null) { const [v0, v1] = signRow(G.label); L.push([P(2.4, 1.1, rx, fy + 4.0, rz, -Math.PI / 2, 0, 1, 1 - v1, 1 - v0), TM.sign]); L.push([B(0.2, 1.3, 2.6, rx + 0.12, fy + 4.0, rz), TM.steel]); }
}
// world-space door of a nose-in airliner (nose toward +x, ry = -PI/2, root at X, Z): forward left door
export const noseInDoor = (X, Z) => new THREE.Vector3(X + 14.6, 2.9, Z - 2.0);

// ---------------------------------------------------------------- CARGO SHED (front faces +z)
export function buildCargoShed({ x0, x1, z0, z1, seed = 3, sign = 4 }) {
  const L = [], r = makeRng(seed), w = x1 - x0, d = z1 - z0, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, H = 13;
  // warehouse box + a low-pitched roof
  L.push([B(w, H, d, xc, H / 2, zc, 0, 8), TM.shed]);
  L.push([B(w + 0.12, 1.4, d + 0.12, xc, 0.7, zc, 0, 4), TM.conc]);
  L.push([B(w + 0.14, 1.1, d + 0.14, xc, H - 1.4, zc), TM.navy]);
  { const nd = 6, step = (w - 30) / nd, doors = Array.from({ length: nd }, (_, k) => x0 + 22 + k * step + step / 2); for (let x = x0 + 8; x < x1 - 4; x += 12) if (!doors.some(dx => Math.abs(dx - x) < 3.2) && x > x0 + 20) L.push([B(0.35, H - 1.4, d + 0.2, x, (H - 1.4) / 2, zc), TM.steel]); }
  { const g = new THREE.CylinderGeometry(1, 1, w, 4, 1, false, 0, TAU); g.rotateZ(Math.PI / 2); g.scale(1, 1.6, d / 1.414); g.rotateX(Math.PI / 4); g.scale(1, 1, 1); g.translate(xc, H, zc); L.push([g, TM.roof]); }
  // dock: concrete apron + bumpers, roller doors with dark gaps, canopy, office strip with lit windows
  L.push([B(w - 8, 1.3, 3.5, xc, 0.65, z1 + 1.75, 0, 4), TM.conc]);
  const nd = 6, step = (w - 30) / nd;
  for (let k = 0; k < nd; k++) {
    const x = x0 + 22 + k * step + step / 2;
    L.push([P(4.6, 4.8, x, 1.3 + 2.4, z1 + 0.02, 0, 0, 4.6 / 4, 0, 1), TM.door]);
    for (const s of [-1, 1]) L.push([B(0.4, 0.6, 0.35, x + s * 2.6, 1.6, z1 + 0.18), TM.steel]);
  }
  L.push([B(w - 20, 0.4, 5, xc + 5, 7.2, z1 + 2.5), TM.steel]);
  L.push([P(18, 3.4, x0 + 10, 9.6, z1 + 0.02, 0, 0, 18 / 12, 0, 1), TM.office]);
  L.push([P(18, 3.0, x0 + 10, 3.6, z1 + 0.02, 0, 0, 18 / 12, 0, 1), TM.office]);
  // big roof sign on a lattice (silhouetted against the sunset), dock numbers
  { const [v0, v1] = signRow(sign); L.push([P(44, 4.6, xc, H + 4.6, z1 - 3, 0, 0, 1, 1 - v1, 1 - v0), TM.sign]); L.push([P(44, 4.6, xc, H + 4.6, z1 - 3.02, Math.PI, 0, 1, 1 - v1, 1 - v0), TM.sign]); }
  for (let x = xc - 21; x <= xc + 21; x += 6) L.push([B(0.2, 2.4, 0.2, x, H + 1.2, z1 - 3), TM.steel]);
  { const [v0, v1] = signRow(5); L.push([P(w - 32, 1.1, xc + 5, 6.4, z1 + 0.03, 0, 0, 1, 1 - v1, 1 - v0), TM.sign]); }
  // rooftop clutter
  for (let k = 0; k < 6; k++) { const hh = 1 + r() * 1.5; L.push([B(3 + r() * 4, hh, 3 + r() * 3, x0 + 10 + r() * (w - 20), H + 1.2 + hh / 2, zc + (r() - 0.5) * d * 0.4, 0, 3), TM.clad]); }
  // bollards along the dock
  for (let x = x0 + 4; x < x1 - 4; x += 5) L.push([cyl(0.15, 0.15, 1.1, 8).translate(x, 0.55, z1 + 4.3), TM.yellow]);
  return mergeGrouped(L, NTM).geometry;
}

// ---------------------------------------------------------------- textures
function curtainWall() {
  // 24 m x 6.6 m per tile: 4 bays, transom at 2/3; sky-graded glass, lounge interiors (ceiling strips, seats, people), dark bays
  const W = 512, H = 256, c = T.makeCanvas(W, H), x = c.getContext('2d'), e = T.makeCanvas(W, H), ex = e.getContext('2d'), r = makeRng(4521);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6d7f95'); g.addColorStop(0.45, '#3c4a5c'); g.addColorStop(1, '#222a35');
  x.fillStyle = g; x.fillRect(0, 0, W, H); ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  for (let b = 0; b < 8; b++) {
    const x0 = b * W / 8, lit = r() < 0.75, k = 0.55 + r() * 0.45;
    if (lit) {
      const gg = ex.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, `rgba(255,236,205,${0.9 * k})`); gg.addColorStop(0.12, `rgba(255,220,170,${0.45 * k})`); gg.addColorStop(1, `rgba(255,190,130,${0.12 * k})`);
      ex.fillStyle = gg; ex.fillRect(x0, 8, W / 8, H - 8);
      // ceiling light strip
      ex.fillStyle = `rgba(255,245,225,${k})`; ex.fillRect(x0 + 4, 14, W / 8 - 8, 3);
    }
    // seat rows and people silhouettes (dark against the lit interior)
    for (let s = 0; s < 3; s++) if (r() < 0.7) { ex.fillStyle = 'rgba(0,0,0,0.75)'; x.fillStyle = 'rgba(20,20,24,0.6)'; const yy = H * 0.72 + s * 8, xx = x0 + 6 + r() * 20; ex.fillRect(xx, yy, 24 + r() * 14, 5); x.fillRect(xx, yy, 24, 5); }
    for (let p = 0; p < 4; p++) if (r() < 0.45) { const px = x0 + 4 + r() * (W / 8 - 10), h = 34 + r() * 14; ex.fillStyle = 'rgba(0,0,0,0.85)'; ex.fillRect(px, H - 12 - h, 7, h); ex.beginPath(); ex.arc(px + 3.5, H - 16 - h, 4.5, 0, TAU); ex.fill(); }
    // gate display
    if (r() < 0.3) { ex.fillStyle = 'rgba(120,170,255,0.9)'; ex.fillRect(x0 + 18, H * 0.38, 22, 13); }
  }
  // mullions + transom
  x.fillStyle = '#9aa1a8'; ex.fillStyle = '#000';
  for (let b = 0; b <= 16; b++) { const w = b % 2 ? 2 : 5; x.fillRect(b * W / 16 - w / 2, 0, w, H); ex.fillRect(b * W / 16 - w / 2, 0, w, H); }
  x.fillRect(0, H * 0.33, W, 3); ex.fillRect(0, H * 0.33, W, 3);
  x.fillRect(0, 0, W, 6); ex.fillRect(0, 0, W, 6);
  return { map: T.canvasTex(c), emissiveMap: T.canvasTex(e) };
}
function cladding() {
  // 6 m tile: 1.5 x 3 m panels, seams, grime streaks running down from the panel joints, dirt toward the ground
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(4531, 8), n2 = T.makeNoise(4532, 32);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    let k = 0.9 + (T.fbm(n, u, v, 8, 3) - 0.5) * 0.1 + ((Math.floor(u * 4) + Math.floor(v * 2)) % 2) * 0.03;
    k -= Math.max(0, T.fbm(n2, u * 0.5, v * 0.06, 32, 2) - 0.5) * 0.5 * (0.4 + v);       // streaks
    if ((xx % 64) < 2 || (y % 128) < 2) k *= 0.55;                                       // seams
    const i = (y * S + xx) * 4; img.data[i] = k * 236; img.data[i + 1] = k * 232; img.data[i + 2] = k * 224; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c);
}
function bridgeTexture() {
  // tunnel skin: horizontal corrugation, grime toward the bottom, a stripe
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(4541, 8);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const v = 1 - y / S, rib = 0.86 + 0.14 * Math.sin(v * 22 * TAU);
    const k = rib * (0.9 + (T.fbm(n, xx / S, v, 8, 3) - 0.5) * 0.12) * (1 - 0.35 * Math.pow(Math.max(0, 0.3 - v) / 0.3, 1.5));
    const i = (y * S + xx) * 4; img.data[i] = k * 214; img.data[i + 1] = k * 214; img.data[i + 2] = k * 210; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.fillStyle = 'rgba(15,44,92,0.9)'; x.fillRect(0, S * 0.66, S, 10);
  return T.canvasTex(c);
}
function shedWall() {
  // 8 m tile of vertical ribbed sheeting: warm grey, rust runs, a darker dirt band at the base, panel laps
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(4551, 8), n2 = T.makeNoise(4552, 32);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = 1 - y / S;
    const rib = 0.8 + 0.2 * Math.pow(Math.abs(Math.sin(u * 20 * Math.PI)), 0.5);
    const rust = Math.max(0, T.fbm(n2, u, v * 0.08, 32, 2) - 0.55) * 2.2;
    let k = rib * (0.92 + (T.fbm(n, u, v, 8, 3) - 0.5) * 0.12);
    const i = (y * S + xx) * 4;
    img.data[i] = k * (178 + rust * 40); img.data[i + 1] = k * (176 - rust * 10); img.data[i + 2] = k * (168 - rust * 40); img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, S * 0.5, S, 2);
  return T.canvasTex(c);
}
function rollerDoor() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d'), n = T.makeNoise(4561, 4), img = x.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) { const k = (0.7 + 0.3 * Math.abs(Math.sin(y / S * 24 * Math.PI))) * (0.85 + T.fbm(n, xx / S, y / S, 4, 3) * 0.25) * (1 - 0.4 * Math.pow(y / S, 3)); const i = (y * S + xx) * 4; img.data[i] = k * 120; img.data[i + 1] = k * 128; img.data[i + 2] = k * 138; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  x.fillStyle = '#d9a514'; x.fillRect(0, S - 10, S, 10); x.fillStyle = '#151311'; for (let i = -1; i < 9; i++) { x.beginPath(); x.moveTo(i * 16, S); x.lineTo(i * 16 + 8, S); x.lineTo(i * 16 + 18, S - 10); x.lineTo(i * 16 + 10, S - 10); x.fill(); }
  return T.canvasTex(c);
}
function officeStrip() {
  // 12 m tile: ribbon windows, some lit (fluorescent), blinds, a figure at a desk
  const W = 256, H = 64, c = T.makeCanvas(W, H), x = c.getContext('2d'), e = T.makeCanvas(W, H), ex = e.getContext('2d'), r = makeRng(4571);
  x.fillStyle = '#2a323c'; x.fillRect(0, 0, W, H); ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  for (let b = 0; b < 8; b++) {
    const x0 = b * W / 8;
    if (r() < 0.65) { ex.fillStyle = `rgba(255,240,215,${0.6 + r() * 0.4})`; ex.fillRect(x0 + 3, 8, W / 8 - 6, H - 16); if (r() < 0.5) { ex.fillStyle = 'rgba(0,0,0,0.8)'; ex.fillRect(x0 + 10, 26, 6, 26); } }
    if (r() < 0.4) { ex.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 8; k < H - 8; k += 4) ex.fillRect(x0 + 3, k, W / 8 - 6, 1.5); }
  }
  x.fillStyle = '#8b939b'; ex.fillStyle = '#000'; for (let b = 0; b <= 8; b++) { x.fillRect(b * W / 8 - 2, 0, 4, H); ex.fillRect(b * W / 8 - 2, 0, 4, H); }
  x.fillRect(0, 0, W, 7); x.fillRect(0, H - 7, W, 7); ex.fillRect(0, 0, W, 7); ex.fillRect(0, H - 7, W, 7);
  return { map: T.canvasTex(c), emissiveMap: T.canvasTex(e) };
}
function signAtlas() {
  const W = 1024, rh = 128, H = rh * SIGNS.length, c = T.makeCanvas(W, H), x = c.getContext('2d');
  SIGNS.forEach(([txt, bg, fg], k) => {
    const y = k * rh;
    x.fillStyle = bg; x.fillRect(0, y, W, rh);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, y + rh - 8, W, 8);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    const short = txt.length < 5;
    x.font = `400 ${short ? 100 : 84}px Anton, Impact, sans-serif`;
    if (short) { x.save(); x.scale(0.45, 1); x.fillText(txt, W / 2 / 0.45, y + rh / 2 + 4); x.restore(); }
    else x.fillText(txt, W / 2, y + rh / 2 + 4);
  });
  return T.canvasTex(c, { repeat: false });
}
