// PORT OF VICTORY — procedural cranes: STS ship-to-shore quay crane + rubber-tyred gantry (RTG).
// All geometry is merged per material with baked vertex colours (paint, grime, AO) over one shared
// grime texture projected in world units. See DESIGN.md for the return contract.
import * as THREE from 'three';
import { box, at, cyl, merge, tint } from '../../geom.js';
import { makeNoise, fbm, makeCanvas, canvasTex, heightToNormal, glowTexture } from '../../textures.js';
import { makeRng } from '../../rng.js';

// ---------------------------------------------------------------- colours (sRGB hex -> linear)
const C = (hex) => new THREE.Color(hex);
const COL = {
  red: C(0xb0231b), redDark: C(0x7a1712), white: C(0xe4e1d8), offwhite: C(0xcfcbbf),
  blue: C(0x1d4f8c), blueDark: C(0x14365f),
  grey: C(0x8a8c8c), steel: C(0x55595c), dark: C(0x2b2d2f), black: C(0x111213), tyre: C(0x0c0c0c),
  yellow: C(0xf0b20a), yellowDark: C(0xb98706), orange: C(0xe0791a), rail: C(0xc9a227),
  hub: C(0x9a9890), louvre: C(0x3a3e40), cable: C(0x1c1c1c), hazardBlack: C(0x0c0c0c),
};

// ---------------------------------------------------------------- shared textures / materials
let _grime = null;
function grimeTextures() {
  if (_grime) return _grime;
  const S = 256;
  const c = makeCanvas(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const n1 = makeNoise(11, 16), n2 = makeNoise(29, 64), n3 = makeNoise(47, 16);
  const rng = makeRng(77);
  // drip streaks: start somewhere, fade out downward (canvas y grows downward = world down)
  const drip = new Float32Array(S * S);
  for (let k = 0; k < 90; k++) {
    const x0 = Math.floor(rng() * S), y0 = Math.floor(rng() * S), w = 1 + Math.floor(rng() * 3);
    const len = 20 + rng() * 140, a = 0.04 + rng() * 0.12;
    for (let dy = 0; dy < len; dy++) for (let d = -w; d <= w; d++) {
      const xx = (x0 + d + S) % S, yy = (y0 + dy) % S;
      const v = a * (1 - dy / len) * (1 - Math.abs(d) / (w + 1));
      drip[yy * S + xx] = Math.max(drip[yy * S + xx], v);
    }
  }
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const blot = fbm(n1, u, v, 3, 5);
    const fine = fbm(n2, u, v, 32, 2);
    const rust = fbm(n3, u, v, 5, 5);
    let b = 0.9 - (blot - 0.5) * 0.34 - (fine - 0.5) * 0.06 - drip[y * S + x];
    const sy = y % 128;                                   // horizontal panel seam every 4 m
    if (sy === 0) b *= 0.78; else if (sy === 1) b *= 1.05;
    let r = b, g = b, bb = b;
    const rr = Math.min(1, Math.max(0, rust - 0.64) * 4.0); // rust blooms
    r = r * (1 - rr) + 0.42 * rr; g = g * (1 - rr) + 0.22 * rr; bb = bb * (1 - rr) + 0.12 * rr;
    const i = (y * S + x) * 4;
    img.data[i] = Math.min(255, r * 255); img.data[i + 1] = Math.min(255, g * 255); img.data[i + 2] = Math.min(255, bb * 255); img.data[i + 3] = 255;
    h[y * S + x] = (sy < 2 ? -0.5 : 0) + blot * 0.3 - rr * 0.4;
  }
  ctx.putImageData(img, 0, 0);
  const map = canvasTex(c);
  const normalMap = heightToNormal(h, S, S, 1.2);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  _grime = { map, normalMap };
  return _grime;
}
function paintMat() {
  const { map, normalMap } = grimeTextures();
  return new THREE.MeshStandardMaterial({ vertexColors: true, map, normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.66, metalness: 0.18 });
}
function windowMat(peak = 1.4) {
  const m = new THREE.MeshStandardMaterial({ color: 0x1a2a33, roughness: 0.12, metalness: 0.7, emissive: 0xffbb70, emissiveIntensity: 0 });
  m.userData.duskEmissive = peak;
  return m;
}
let _glowTex = null;
const glowTex = () => (_glowTex ||= glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.28)'));

// ---------------------------------------------------------------- geometry helpers
class Parts {
  constructor() { this.list = []; }
  add(g, col) { tint(g, col.r, col.g, col.b); this.list.push(g); return g; }
  box(w, h, d, x, y, z, col, rx = 0, ry = 0, rz = 0) { return this.add(at(box(w, h, d), x, y, z, rx, ry, rz), col); }
  // axis-aligned box from min/max corners
  aabb(x0, y0, z0, x1, y1, z1, col) { return this.box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, col); }
  beam(a, b, w, h, col) { return this.add(beamGeo(a, b, w, h), col); }
  cylX(r, len, x, y, z, col, seg = 12) { return this.add(at(cyl(r, r, len, seg), x, y, z, 0, 0, Math.PI / 2), col); }
  cylZ(r, len, x, y, z, col, seg = 12) { return this.add(at(cyl(r, r, len, seg), x, y, z, Math.PI / 2, 0, 0), col); }
  cylY(r, len, x, y, z, col, seg = 12) { return this.add(at(cyl(r, r, len, seg), x, y, z), col); }
  // apply a matrix to every part added since index i0
  transformFrom(i0, m) { for (let i = i0; i < this.list.length; i++) this.list[i].applyMatrix4(m); }
}
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _M = new THREE.Matrix4();
function beamGeo(a, b, w, h) {
  _A.set(a[0], a[1], a[2]); _B.set(b[0], b[1], b[2]);
  const len = _A.distanceTo(_B);
  const g = box(w, h, len);
  const dy = Math.abs(_B.y - _A.y) / Math.max(len, 1e-6);
  const up = dy > 0.97 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  _M.lookAt(_A, _B, up);
  _M.setPosition((_A.x + _B.x) / 2, (_A.y + _B.y) / 2, (_A.z + _B.z) / 2);
  g.applyMatrix4(_M);
  return g;
}
// railing along a straight walkway edge from a to b (points at deck level)
function railing(P, a, b, col, h = 1.1, spacing = 2.0, r = 0.055) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const L = Math.hypot(dx, dy, dz);
  const n = Math.max(1, Math.round(L / spacing));
  P.beam([a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], r, r, col);
  P.beam([a[0], a[1] + h * 0.5, a[2]], [b[0], b[1] + h * 0.5, b[2]], r * 0.8, r * 0.8, col);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + dx * t, y = a[1] + dy * t, z = a[2] + dz * t;
    P.box(r, h, r, x, y + h / 2, z, col);
  }
}
// zig-zag stair tower. Flights run along `axis` ('x' or 'z') between s0 and s1 at fixed cross coord c (centre).
function stairTower(P, { axis, c, s0, s1, y0, y1, rise = 2.6, width = 0.9, col, railCol }) {
  const run = Math.abs(s1 - s0), dir = Math.sign(s1 - s0);
  const flights = Math.ceil((y1 - y0) / rise);
  const r = (y1 - y0) / flights;
  const pt = (s, y, off = 0) => (axis === 'x' ? [s, y, c + off] : [c + off, y, s]);
  for (let f = 0; f < flights; f++) {
    const ya = y0 + f * r, yb = ya + r;
    const sa = f % 2 === 0 ? s0 : s1, sb = f % 2 === 0 ? s1 : s0;
    // stringers both sides + tread plate
    P.beam(pt(sa, ya + 0.05), pt(sb, yb + 0.05), axis === 'x' ? 0.06 : width, axis === 'x' ? width : 0.06, col);
    for (const off of [-width / 2, width / 2]) P.beam(pt(sa, ya - 0.05, off), pt(sb, yb - 0.05, off), 0.05, 0.28, col);
    // handrail on the outer side
    P.beam(pt(sa, ya + 1.0, width / 2), pt(sb, yb + 1.0, width / 2), 0.05, 0.05, railCol);
    P.beam(pt(sa, ya + 1.0, -width / 2), pt(sb, yb + 1.0, -width / 2), 0.05, 0.05, railCol);
    // landing at the top end
    const ls = sb + dir * (f % 2 === 0 ? 1 : -1) * 0.55;
    const p = pt(ls, yb - 0.04);
    if (axis === 'x') P.box(1.1, 0.08, width + 0.1, p[0], p[1], p[2], col); else P.box(width + 0.1, 0.08, 1.1, p[0], p[1], p[2], col);
    const e = sb + dir * (f % 2 === 0 ? 1 : -1) * 1.1;
    railing(P, pt(e, yb, -width / 2), pt(e, yb, width / 2), railCol, 1.1, 1.0);
    P.box(0.06, yb - y0 + 0.1, 0.06, ...pt(e, (yb + y0) / 2, -width / 2), col); // landing posts to ground
  }
}
// diagonal black hazard stripes wrapped around an axis-aligned vertical box (for yellow legs)
function clipHalf(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function hazardBand(P, cx, cz, hx, hz, y0, y1, w = 0.3, col = COL.hazardBlack) {
  const faces = [ // [half-width, map(t,y)->xyz, normal]
    [hz, (t, y) => [cx + hx + 0.012, y, cz - t], [1, 0, 0]],
    [hx, (t, y) => [cx - t, y, cz - hz - 0.012], [0, 0, -1]],
    [hz, (t, y) => [cx - hx - 0.012, y, cz + t], [-1, 0, 0]],
    [hx, (t, y) => [cx + t, y, cz + hz + 0.012], [0, 0, 1]],
  ];
  let off = 0;
  const pos = [], nor = [];
  for (const [a, map, n] of faces) {
    for (let c = y0 - 2 * a - 4 * w - off; c < y1 + 2 * a; c += 2 * w) {
      let poly = [[-a, y0], [a, y0], [a, y1], [-a, y1]];
      poly = clipHalf(poly, (p) => (p[1] - (p[0] + a + off)) - c);
      poly = clipHalf(poly, (p) => c + w - (p[1] - (p[0] + a + off)));
      if (poly.length < 3) continue;
      for (let i = 1; i < poly.length - 1; i++) for (const q of [poly[0], poly[i], poly[i + 1]]) { pos.push(...map(q[0], q[1])); nor.push(...n); }
    }
    off += 2 * a;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  // fix winding so faces point outward
  const p = g.attributes.position, nn = g.attributes.normal;
  for (let i = 0; i < p.count; i += 3) {
    const ax = p.getX(i), ay = p.getY(i), az = p.getZ(i);
    const ux = p.getX(i + 1) - ax, uy = p.getY(i + 1) - ay, uz = p.getZ(i + 1) - az;
    const vx = p.getX(i + 2) - ax, vy = p.getY(i + 2) - ay, vz = p.getZ(i + 2) - az;
    const cxp = uy * vz - uz * vy, cyp = uz * vx - ux * vz, czp = ux * vy - uy * vx;
    if (cxp * nn.getX(i) + cyp * nn.getY(i) + czp * nn.getZ(i) < 0) {
      const bx = p.getX(i + 1), by = p.getY(i + 1), bz = p.getZ(i + 1);
      p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, bx, by, bz);
    }
  }
  if (pos.length) P.add(g, col);
}

// Finalise a Parts list into one geometry: merge, project world-unit UVs, bake ground grime + underside AO.
function bake(P, { uvScale = 1 / 8, groundGrime = 5, aoUnder = 0.72, base = 0 } = {}) {
  const g = merge(P.list);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, x * uvScale, z * uvScale);
    else if (ax >= az) uv.setXY(i, z * uvScale, y * uvScale);
    else uv.setXY(i, x * uvScale, y * uvScale);
    let k = 1;
    const yy = y + base;
    if (groundGrime > 0) { const t = Math.min(1, Math.max(0, yy / groundGrime)); k *= 0.6 + 0.4 * t * t * (3 - 2 * t); }
    if (n.getY(i) < -0.6) k *= aoUnder;
    c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
  }
  g.computeBoundingSphere();
  return g;
}
function triCount(obj) {
  let t = 0, calls = 0;
  obj.traverse((o) => {
    if (o.isMesh) { const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; calls += Array.isArray(o.material) ? g.groups.length : 1; }
    else if (o.isPoints) calls += 1;
  });
  return { tris: Math.round(t), drawCalls: calls };
}
function glowPoints(list, color, size) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(list.flatMap((v) => [v.x, v.y, v.z]), 3));
  const m = new THREE.PointsMaterial({ color, size, map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

// =====================================================================================================
// STS QUAY CRANE
// =====================================================================================================
export function buildQuayCrane({ boom = 'down', paint = 'red' } = {}) {
  const P = new Parts(), G = new Parts(), L = new Parts(); // paint / glass / lamp lenses
  const main = paint === 'blue' ? COL.blue : COL.red, mainDk = paint === 'blue' ? COL.blueDark : COL.redDark;
  const W = COL.white, RAIL = COL.rail;
  const LX = 9, Z0 = 0, Z1 = -25;
  const legTop = 43.5, GY0 = 44.0, GY1 = 47.0, GX = 3.4, GW = 1.8; // girders
  const apex = { y: 66.0, z: -18.0 };
  const raised = boom === 'up';
  const colliders = [], warn = [], flood = [];

  // ---- gantry bogies on the rails (rail head y = 0.15)
  for (const sx of [-LX, LX]) for (const z of [Z0, Z1]) {
    P.box(9.2, 1.1, 1.5, sx, 2.45, z, COL.steel);                       // equaliser beam
    P.box(2.6, 1.0, 1.9, sx, 3.4, z, mainDk);                            // leg foot / pin housing
    for (const bx of [-2.3, 2.3]) {
      P.box(4.1, 0.85, 1.05, sx + bx, 1.45, z, COL.dark);               // bogie frame
      P.box(0.5, 0.5, 1.2, sx + bx, 1.95, z, COL.steel);                 // pivot
      for (const wx of [-1.5, -0.5, 0.5, 1.5]) {
        P.add(at(cyl(0.42, 0.42, 0.3, 10), sx + bx + wx, 0.57, z, Math.PI / 2, 0, 0), COL.black);
        P.add(at(cyl(0.16, 0.16, 0.34, 6), sx + bx + wx, 0.57, z, Math.PI / 2, 0, 0), COL.hub);
      }
      P.box(0.12, 0.6, 1.2, sx + bx - 2.1, 1.25, z, COL.dark);          // rail sweep
    }
    for (const e of [-4.8, 4.8]) P.box(0.45, 0.8, 1.1, sx + e, 2.45, z, COL.yellow); // buffers
    P.box(0.5, 0.35, 0.5, sx + 0.0, 0.18, z + 1.1, COL.yellow);                     // storm pin box
    colliders.push({ min: [sx - 4.9, 0, z - 0.95], max: [sx + 4.9, 3.0, z + 0.95] });
  }
  // ---- legs (slightly tapered by stacking two boxes)
  for (const sx of [-LX, LX]) for (const z of [Z0, Z1]) {
    P.box(1.9, 20, 2.1, sx, 3.9 + 10, z, main);
    P.box(1.75, legTop - 23.9, 1.95, sx, 23.9 + (legTop - 23.9) / 2, z, main);
    P.box(2.1, 0.25, 2.3, sx, 23.9, z, mainDk);                        // flange ring
    colliders.push({ min: [sx - 0.95, 0, z - 1.05], max: [sx + 0.95, legTop, z + 1.05] });
  }
  // ---- sill beams (13 m) + side bracing (x = ±9 planes)
  for (const sx of [-LX, LX]) {
    P.aabb(sx - 0.8, 12.0, Z1 + 1.0, sx + 0.8, 14.0, Z0 - 1.0, main);
    P.aabb(sx - 0.85, legTop - 2.4, Z1 - 1.0, sx + 0.85, legTop, Z0 + 1.0, main);   // upper portal girder
    P.beam([sx, legTop - 2.2, Z0 - 1.1], [sx, 14.1, Z1 + 1.1], 1.0, 1.1, main);       // big diagonal
    P.beam([sx, 20.0, Z0], [sx, 14.0, Z0 - 5.5], 0.8, 0.8, main);                    // knee braces leg -> sill
    P.beam([sx, 20.0, Z1], [sx, 14.0, Z1 + 5.5], 0.8, 0.8, main);
    // catwalk on top of the sill beam with railings
    P.aabb(sx - 0.8, 14.0, Z1 + 1.0, sx + 0.8, 14.06, Z0 - 1.0, COL.grey);
    railing(P, [sx + 0.78, 14.06, Z1 + 1.1], [sx + 0.78, 14.06, Z0 - 1.1], RAIL);
    railing(P, [sx - 0.78, 14.06, Z1 + 1.1], [sx - 0.78, 14.06, Z0 - 1.1], RAIL);
  }
  // ---- portal cross beams along x at landside / waterside + knee braces (x-y planes)
  for (const z of [Z0, Z1]) {
    P.aabb(-LX - 1.0, legTop - 3.0, z - 1.0, LX + 1.0, GY0, z + 1.0, main);
    for (const s of [-1, 1]) {
      P.beam([s * LX, legTop - 11, z], [s * (LX - 5.5), legTop - 2.9, z], 0.9, 0.9, main);
      P.beam([s * LX, legTop - 6, z], [s * (LX - 2.5), legTop - 2.9, z], 0.6, 0.6, main);
    }
    // walkway on top of the cross beam
    railing(P, [-LX - 1.0, GY0, z + 0.98], [LX + 1.0, GY0, z + 0.98], RAIL, 1.1, 2.5);
  }
  // landside lower tie + diagonals between the two landside legs (above lane clearance)
  P.aabb(-LX + 0.9, 30.0, Z0 - 0.4, LX - 0.9, 30.9, Z0 + 0.4, main);
  for (const s of [-1, 1]) P.beam([s * (LX - 0.9), 30.9, Z0], [0, legTop - 3.0, Z0], 0.55, 0.55, main);

  // ---- back-reach girders (fixed) z: -25 .. +20
  for (const s of [-1, 1]) {
    P.aabb(s * GX - GW / 2, GY0, Z1 - 0.5, s * GX + GW / 2, GY1, 20.0, W);
    P.aabb(s * GX - 0.12, GY1, Z1, s * GX + 0.12, GY1 + 0.18, 20.0, COL.dark);   // trolley rail
    // outer walkway
    const wx = s * (GX + GW / 2 + 0.5);
    P.aabb(wx - 0.5, GY0 + 0.4, Z1, wx + 0.5, GY0 + 0.46, 20.0, COL.grey);
    railing(P, [s * (GX + GW / 2 + 1.0), GY0 + 0.46, Z1], [s * (GX + GW / 2 + 1.0), GY0 + 0.46, 20.0], RAIL, 1.1, 2.5);
    for (let z = Z1 + 2; z < 20; z += 5) P.beam([s * (GX + GW / 2), GY0 + 0.1, z], [wx + s * 0.45, GY0 + 0.42, z], 0.12, 0.12, COL.steel);
  }
  P.aabb(-GX, GY0 + 0.4, 18.8, GX, GY1 - 0.3, 20.0, W);                            // back end tie
  const ribs = (z0, z1) => { for (const s of [-1, 1]) for (const f of [-1, 1]) for (let z = z0; z < z1; z += 3.0) P.aabb(s * GX + f * GW / 2 - 0.06, GY0 + 0.05, z, s * GX + f * GW / 2 + 0.06, GY1 - 0.05, z + 0.18, COL.offwhite); };
  ribs(Z1 + 1, 19);
  for (const s of [-1, 1]) for (const y of [GY0, GY1 - 0.12]) P.aabb(s * GX - GW / 2 - 0.12, y, Z1, s * GX + GW / 2 + 0.12, y + 0.12, 20.0, COL.offwhite); // flanges
  for (let z = -20; z <= 14; z += 8.5) P.aabb(-GX + 0.9, GY1 - 0.5, z - 0.3, GX - 0.9, GY1 - 0.05, z + 0.3, W); // top ties
  // backstay (fixed) — apex to back-reach end
  for (const s of [-1, 1]) P.beam([s * GX, apex.y - 0.6, apex.z + 0.6], [s * GX, GY1 + 0.1, 18.5], 0.45, 0.45, main);

  // ---- A-frame (apex)
  for (const s of [-1, 1]) {
    P.beam([s * GX, GY1, Z1], [s * GX, apex.y, apex.z], 1.4, 1.5, main);   // front post
    P.beam([s * GX, GY1, Z0 - 1.5], [s * GX, apex.y, apex.z + 0.5], 1.2, 1.2, main); // rear post
    P.beam([s * GX, 53, -23.0], [s * GX, 53, -6.0], 0.6, 0.6, main);       // horizontal tie between posts
  }
  const onFront = (y) => [Z1 + (apex.z - Z1) * (y - GY1) / (apex.y - GY1)];
  const onRear = (y) => [(Z0 - 1.5) + (apex.z + 0.5 - (Z0 - 1.5)) * (y - GY1) / (apex.y - GY1)];
  for (const f of [onFront, onRear]) {
    for (const [ya, yb] of [[48.5, 56.0], [56.0, 63.5]]) {
      P.beam([-GX, ya, f(ya)[0]], [GX, yb, f(yb)[0]], 0.45, 0.45, main);
      P.beam([GX, ya, f(ya)[0]], [-GX, yb, f(yb)[0]], 0.45, 0.45, main);
    }
    P.beam([-GX, 56, f(56)[0]], [GX, 56, f(56)[0]], 0.5, 0.5, main);
  }
  P.box(2 * GX + 2.2, 1.6, 2.4, 0, apex.y + 0.4, apex.z, main);          // apex head
  P.box(3.0, 1.2, 1.8, 0, apex.y + 1.8, apex.z, W);                      // sheave house
  for (const s of [-1, 1]) P.cylX(0.9, 0.35, s * 1.0, apex.y + 1.6, apex.z + 0.9, COL.steel, 12);
  railing(P, [-GX - 1.1, apex.y + 1.2, apex.z - 1.2], [GX + 1.1, apex.y + 1.2, apex.z - 1.2], RAIL);
  railing(P, [-GX - 1.1, apex.y + 1.2, apex.z + 1.2], [GX + 1.1, apex.y + 1.2, apex.z + 1.2], RAIL);
  for (const s of [-1, 1]) { warn.push(new THREE.Vector3(s * (GX + 1.0), apex.y + 1.5, apex.z)); }
  // ladder up the rear post (visual)
  P.beam([GX + 0.75, GY1 + 0.5, Z0 - 2.0], [GX + 0.75, apex.y - 0.4, apex.z + 1.0], 0.9, 0.06, RAIL);

  // ---- machinery house on the back-reach
  const MH = { x0: -5.4, x1: 5.4, y0: GY1 + 0.15, y1: GY1 + 4.8, z0: 4.0, z1: 17.5 };
  P.aabb(MH.x0, MH.y0, MH.z0, MH.x1, MH.y1, MH.z1, W);
  P.aabb(MH.x0 - 0.15, MH.y1, MH.z0 - 0.15, MH.x1 + 0.15, MH.y1 + 0.25, MH.z1 + 0.15, COL.offwhite); // roof lip
  P.aabb(MH.x0 - 0.6, MH.y0 - 0.15, MH.z0 - 0.6, MH.x1 + 0.6, MH.y0 + 0.05, MH.z1 + 0.6, COL.grey); // deck
  for (const s of [-1, 1]) {
    for (let z = MH.z0 + 1.2; z < MH.z1 - 1; z += 2.4) P.aabb(s * MH.x1 - 0.02 * s - 0.03, MH.y0 + 3.6, z, s * MH.x1 + 0.03 * s + 0.03, MH.y0 + 4.6, z + 1.4, COL.louvre); // louvres
    railing(P, [s * (MH.x1 + 0.55), MH.y0, MH.z0 - 0.55], [s * (MH.x1 + 0.55), MH.y0, MH.z1 + 0.55], RAIL, 1.1, 2.5);
  }
  for (let x = MH.x0 + 1.5; x < MH.x1 - 1; x += 2.6) G.aabb(x, MH.y0 + 3.2, MH.z1 + 0.0, x + 1.4, MH.y0 + 4.2, MH.z1 + 0.05, W); // rear windows
  G.aabb(MH.x1, MH.y0 + 3.2, MH.z0 + 0.6, MH.x1 + 0.04, MH.y0 + 4.2, MH.z0 + 2.0, W);
  P.aabb(MH.x0 + 0.8, MH.y0, MH.z0 - 0.05, MH.x0 + 1.9, MH.y0 + 2.2, MH.z0, COL.grey); // door
  for (const [x, z] of [[-3, 6], [0, 9], [3, 6], [-2, 13], [2.5, 13.5]]) P.box(1.6, 0.8, 1.6, x, MH.y1 + 0.65, z, COL.offwhite); // roof units
  P.box(0.3, 3.0, 0.3, 3.8, MH.y1 + 1.7, 15.5, COL.steel);                                       // antenna mast
  P.box(1.2, 0.08, 0.08, 3.8, MH.y1 + 3.0, 15.5, COL.steel);
  warn.push(new THREE.Vector3(MH.x0 + 0.3, MH.y1 + 0.5, MH.z1 - 0.3), new THREE.Vector3(MH.x1 - 0.3, MH.y1 + 0.5, MH.z1 - 0.3), new THREE.Vector3(3.8, MH.y1 + 3.3, 15.5));
  warn.push(new THREE.Vector3(-GX, GY1 + 0.6, 20.2), new THREE.Vector3(GX, GY1 + 0.6, 20.2));

  // ---- stair tower on the landside +x leg (landside face) up to the portal
  stairTower(P, { axis: 'x', c: Z0 + 1.75, s0: LX - 2.2, s1: LX + 1.4, y0: 0.0, y1: legTop - 2.5, rise: 2.65, col: COL.steel, railCol: RAIL });
  // ---- cable reel on the landside -x leg
  P.cylX(2.2, 0.9, -LX - 1.6, 8.0, Z0 + 0.0, COL.grey, 18);
  P.cylX(0.9, 1.3, -LX - 1.6, 8.0, Z0, COL.dark, 10);
  P.box(0.4, 7.0, 0.5, -LX - 1.2, 4.5, Z0 + 1.6, COL.steel);
  P.box(0.4, 7.0, 0.5, -LX - 1.2, 4.5, Z0 - 1.6, COL.steel);
  P.box(0.18, 5.8, 0.18, -LX - 1.6, 2.9, Z0 + 1.9, COL.cable);
  // electrical house low on the landside legs
  P.aabb(LX - 1.3, 14.06, -17.5, LX + 1.3, 16.8, -9.5, W);                         // e-house sits on the +x sill
  P.aabb(LX - 1.4, 16.8, -17.6, LX + 1.4, 17.0, -9.4, COL.offwhite);
  for (let z = -16.8; z < -10; z += 1.6) P.aabb(LX + 1.3, 15.0, z, LX + 1.34, 16.2, z + 1.0, COL.louvre);

  // ---- boom (outreach) z: -25 .. -75. Built in "down" pose then optionally raised about hinge.
  const iBoom = P.list.length, gBoom = G.list.length;
  const boomWarn = [], boomFlood = [];
  const TIPZ = -75;
  for (const s of [-1, 1]) {
    P.aabb(s * GX - GW / 2, GY0, -62, s * GX + GW / 2, GY1, Z1 - 0.5, W);
    // tapered tip
    const tip = at(box(GW, GY1 - GY0, 13), s * GX, (GY0 + GY1) / 2, -68.5);
    const tp = tip.attributes.position;
    for (let i = 0; i < tp.count; i++) if (tp.getZ(i) < -70 && tp.getY(i) < (GY0 + GY1) / 2) tp.setY(i, GY0 + 1.4);
    tip.computeVertexNormals();
    P.add(tip, W);
    P.aabb(s * GX - GW / 2 - 0.02, GY0 + 0.4, -70.0, s * GX + GW / 2 + 0.02, GY1 + 0.02, -66.0, main); // red tip band
    P.aabb(s * GX - 0.12, GY1, TIPZ + 0.5, s * GX + 0.12, GY1 + 0.18, Z1, COL.dark);   // trolley rail
    const wx = s * (GX + GW / 2 + 0.5);
    P.aabb(wx - 0.5, GY0 + 0.4, TIPZ + 1, wx + 0.5, GY0 + 0.46, Z1, COL.grey);
    railing(P, [s * (GX + GW / 2 + 1.0), GY0 + 0.46, TIPZ + 1], [s * (GX + GW / 2 + 1.0), GY0 + 0.46, Z1], RAIL, 1.1, 2.5);
    for (let z = Z1 - 3; z > TIPZ + 1; z -= 5) P.beam([s * (GX + GW / 2), GY0 + 0.1, z], [wx + s * 0.45, GY0 + 0.42, z], 0.12, 0.12, COL.steel);
    // forestays (tie bars) apex -> boom
    if (!raised) for (const bz of [-48, -69]) P.beam([s * GX, apex.y - 0.6, apex.z - 0.5], [s * GX, GY1 + 0.2, bz], 0.42, 0.5, main);
    // hinge pin
    P.cylX(0.75, GW + 0.5, s * GX, GY0 + 1.2, Z1, COL.steel, 10);
    boomWarn.push(new THREE.Vector3(s * GX, GY1 + 0.45, TIPZ + 0.6));
    for (const z of [-33, -45, -57, -68]) boomFlood.push(new THREE.Vector3(s * (GX + GW / 2 + 0.3), GY0 - 0.45, z));
  }
  // overhead frames at the stay connections + tip tie
  for (const bz of [-48, -69]) {
    for (const s of [-1, 1]) P.box(0.5, 5.2, 0.6, s * GX, GY1 + 2.6, bz, main);
    P.box(2 * GX + 0.5, 0.7, 0.7, 0, GY1 + 5.0, bz, main);
    P.beam([-GX, GY1 + 0.3, bz + 2], [GX, GY1 + 4.8, bz], 0.3, 0.3, main);
  }
  P.aabb(-GX, GY0 + 1.4, TIPZ, GX, GY1, TIPZ + 1.0, W);
  ribs(-62, Z1 - 1);
  for (const s of [-1, 1]) for (const y of [GY0, GY1 - 0.12]) P.aabb(s * GX - GW / 2 - 0.12, y, -62, s * GX + GW / 2 + 0.12, y + 0.12, Z1 - 0.5, COL.offwhite);
  P.box(1.6, 1.0, 1.0, 0, GY1 + 0.5, TIPZ + 0.5, COL.steel); // tip sheave box
  for (const s of [-1, 1]) for (let z = -32; z > -70; z -= 9) P.aabb(-GX + 0.9, GY1 - 0.5, z - 0.3, GX - 0.9, GY1 - 0.05, z + 0.3, W);

  // ---- floodlight housings + lens (everywhere under girders / portal)
  const fixedFlood = [];
  for (const s of [-1, 1]) {
    fixedFlood.push(new THREE.Vector3(s * (GX + GW / 2 + 0.3), GY0 - 0.45, 10));
    for (const z of [Z0, Z1]) fixedFlood.push(new THREE.Vector3(s * 6.0, legTop - 3.45, z + 1.1));
    fixedFlood.push(new THREE.Vector3(s * (LX + 0.95), 13.6, -12.5));
  }
  const addLamp = (v, isBoom) => {
    const iP = P.list.length, iL = L.list.length;
    P.box(0.75, 0.35, 0.55, v.x, v.y + 0.25, v.z, COL.dark);
    L.box(0.62, 0.05, 0.42, v.x, v.y + 0.05, v.z, COL.white);
    return isBoom;
  };
  // boom lamps must be added before the boom transform -> do them now
  for (const v of boomFlood) addLamp(v, true);
  for (const v of boomWarn) L.box(0.35, 0.35, 0.35, v.x, v.y, v.z, COL.white);
  const iLampsBoomEnd = L.list.length;

  // raise the boom: rotate everything added since iBoom about the hinge (x axis at y=GY0+1.2, z=Z1)
  if (raised) {
    const ang = THREE.MathUtils.degToRad(80);
    const hinge = new THREE.Vector3(0, GY0 + 1.2, Z1);
    const m = new THREE.Matrix4().makeTranslation(hinge.x, hinge.y, hinge.z)
      .multiply(new THREE.Matrix4().makeRotationX(ang))
      .multiply(new THREE.Matrix4().makeTranslation(-hinge.x, -hinge.y, -hinge.z));
    P.transformFrom(iBoom, m);
    for (let i = 0; i < iLampsBoomEnd; i++) L.list[i].applyMatrix4(m);
    for (const v of boomWarn) v.applyMatrix4(m);
    for (const v of boomFlood) v.applyMatrix4(m);
    // boom hoist ropes apex -> boom tip, and latch hooks
    const tipTop = new THREE.Vector3(0, GY1 + 0.5, TIPZ + 1).applyMatrix4(m);
    const mid = new THREE.Vector3(0, GY1 + 0.3, -50).applyMatrix4(m);
    for (const s of [-1, 1]) {
      P.beam([s * 1.0, apex.y + 1.6, apex.z - 0.3], [s * GX, tipTop.y, tipTop.z], 0.1, 0.1, COL.cable);
      P.beam([s * 1.3, apex.y + 1.6, apex.z - 0.3], [s * GX, tipTop.y - 1.5, tipTop.z], 0.1, 0.1, COL.cable);
      // folded forestay links hanging from apex
      P.beam([s * GX, apex.y - 0.6, apex.z - 0.5], [s * GX, mid.y, mid.z + 0.8], 0.4, 0.45, main);
    }
  }
  for (const v of fixedFlood) addLamp(v, false);
  warn.push(...boomWarn);
  flood.push(...boomFlood, ...fixedFlood);
  for (const v of warn.slice(0, warn.length - boomWarn.length)) L.box(0.35, 0.35, 0.35, v.x, v.y, v.z, COL.white);

  // ---- trolley + cab + spreader (static pose)
  const Tz = raised ? -9.0 : -50.0;
  const Sy = raised ? 39.0 : 22.0;
  const TY = GY1 + 0.18;
  P.aabb(-GX - 0.9, TY + 0.4, Tz - 3.6, GX + 0.9, TY + 2.6, Tz + 3.6, COL.offwhite);     // trolley body
  P.aabb(-GX - 1.0, TY + 2.6, Tz - 3.7, GX + 1.0, TY + 2.8, Tz + 3.7, COL.grey);
  for (const s of [-1, 1]) for (const dz of [-2.8, 2.8]) P.cylX(0.4, 0.5, s * GX, TY + 0.4, Tz + dz, COL.dark, 10);
  for (const s of [-1, 1]) P.cylZ(0.6, 3.6, s * 1.6, TY + 3.2, Tz + 0.5, COL.steel, 12);   // sheaves on top
  railing(P, [-GX - 0.9, TY + 2.8, Tz - 3.6], [GX + 0.9, TY + 2.8, Tz - 3.6], RAIL, 1.0, 2.0);
  // operator cab hanging under the trolley (waterside end), between the girders
  const cab = { x0: -2.35, x1: -0.05, y0: GY0 - 3.6, y1: GY0 - 0.9, z0: Tz - 3.8, z1: Tz - 1.3 };
  for (const x of [cab.x0 + 0.2, cab.x1 - 0.2]) P.box(0.25, TY + 0.4 - cab.y1, 0.25, x, (cab.y1 + TY + 0.4) / 2, (cab.z0 + cab.z1) / 2 + 0.6, COL.steel);
  P.aabb(cab.x0, cab.y0 + 1.1, cab.z0 + 0.3, cab.x1, cab.y1, cab.z1, W);      // rear/upper body
  P.aabb(cab.x0, cab.y0, cab.z0, cab.x1, cab.y0 + 0.25, cab.z1, COL.grey);    // floor
  P.aabb(cab.x0 - 0.05, cab.y1, cab.z0 - 0.05, cab.x1 + 0.05, cab.y1 + 0.2, cab.z1 + 0.05, COL.grey); // roof
  G.aabb(cab.x0 + 0.08, cab.y0 + 0.25, cab.z0 - 0.02, cab.x1 - 0.08, cab.y1 - 0.15, cab.z0 + 0.05, W);  // front glass
  for (const x of [cab.x0 - 0.02, cab.x1 - 0.03]) G.aabb(x, cab.y0 + 0.3, cab.z0 + 0.2, x + 0.05, cab.y0 + 1.6, cab.z1 - 0.3, W); // side glass
  // hoist ropes + headblock + spreader (container long axis along x)
  for (const sx of [-1.4, 1.4]) for (const dz of [-0.1, 1.1]) P.beam([sx, TY + 0.3, Tz + dz], [sx * 0.7, Sy + 1.5, Tz + 0.5 + (dz - 0.5) * 0.5], 0.09, 0.09, COL.cable);
  P.box(3.2, 0.7, 1.6, 0, Sy + 1.15, Tz + 0.5, COL.yellow);                 // headblock
  P.box(12.2, 0.5, 1.0, 0, Sy + 0.25, Tz + 0.5, COL.yellow);                // spreader main beam
  for (const s of [-1, 1]) {
    P.box(0.6, 0.55, 2.44, s * 5.8, Sy + 0.28, Tz + 0.5, COL.yellow);
    for (const dz of [-1.05, 1.05]) P.box(0.35, 0.35, 0.35, s * 5.95, Sy - 0.12, Tz + 0.5 + dz, COL.dark); // twistlocks
    P.box(0.08, 0.9, 0.9, s * 6.15, Sy - 0.2, Tz + 0.5 + 0.9, COL.orange);        // flipper
    P.box(1.2, 0.35, 0.5, s * 1.6, Sy + 0.65, Tz + 0.5, COL.dark);                // motor
  }

  // ---- build meshes
  const root = new THREE.Group(); root.name = 'quayCrane';
  const mPaint = paintMat();
  const mesh = new THREE.Mesh(bake(P, { groundGrime: 6 }), mPaint);
  mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  const mWin = windowMat(1.5);
  const glass = new THREE.Mesh(merge(G.list), mWin); root.add(glass);
  const mLens = new THREE.MeshStandardMaterial({ vertexColors: false, color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.3 });
  mLens.userData.duskEmissive = 3.0;
  // red warn lenses share the lamp mesh: tint via vertex colour is not possible on emissive, so keep separate list by colour
  const lensFlood = new THREE.Mesh(merge(L.list.filter((_, i) => i < boomFlood.length || (i >= iLampsBoomEnd && i < iLampsBoomEnd + fixedFlood.length))), mLens);
  const mWarn = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a0a, emissiveIntensity: 4.0, roughness: 0.4 });
  const lensWarn = new THREE.Mesh(merge(L.list.filter((_, i) => !(i < boomFlood.length || (i >= iLampsBoomEnd && i < iLampsBoomEnd + fixedFlood.length)))), mWarn);
  root.add(lensFlood, lensWarn);
  const warnGlow = glowPoints(warn, 0xff2a14, 4.5);
  const floodGlow = glowPoints(flood, 0xffb060, 7.0);
  floodGlow.material.opacity = 0;
  root.add(warnGlow, floodGlow);

  const update = (dt, t) => {
    // aviation lights: slow pulse; floods follow the level's dusk ramp of the lens material
    const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.6));
    warnGlow.material.opacity = k; mWarn.emissiveIntensity = 1.5 + 3.0 * k;
    floodGlow.material.opacity = Math.min(1, mLens.emissiveIntensity / mLens.userData.duskEmissive);
  };
  update(0, 0);
  const counts = triCount(root);
  return {
    root, colliders, update,
    anchors: {
      warn, flood,
      apex: new THREE.Vector3(0, apex.y + 2.4, apex.z),
      boomTip: raised ? boomWarn[0].clone().setX(0) : new THREE.Vector3(0, GY1, TIPZ),
      trolley: new THREE.Vector3(0, TY + 1.5, Tz),
      spreader: new THREE.Vector3(0, Sy, Tz + 0.5),
      cab: new THREE.Vector3((cab.x0 + cab.x1) / 2, cab.y0 + 0.6, (cab.z0 + cab.z1) / 2),
    },
    info: { ...counts, boom, paint, materials: { paint: mPaint, window: mWin, floodLens: mLens, warnLens: mWarn } },
  };
}

// =====================================================================================================
// RTG — rubber-tyred gantry crane
// =====================================================================================================
export function buildRTG({ seed = 1 } = {}) {
  const P = new Parts(), T = new Parts(), S = new Parts(), G = new Parts();
  const Y = COL.yellow, YD = COL.yellowDark, RAIL = COL.yellow;
  const LX = 11.5, LZ = 3.5;
  const sillY0 = 1.85, sillY1 = 2.8, legTop = 17.9, GY1 = 19.1;
  const colliders = [];

  // ---- per side: tyres, bogies, sill, legs, bracing
  for (const s of [-1, 1]) {
    const x = s * LX;
    P.aabb(x - 0.55, sillY0, -5.7, x + 0.55, sillY1, 5.7, Y);                  // sill beam
    for (const bz of [-4.5, 4.5]) {
      P.aabb(x - 0.8, 1.2, bz - 1.5, x + 0.8, sillY0, bz + 1.5, YD);            // bogie housing
      for (const tz of [-0.85, 0.85]) for (const tx of [-0.3, 0.3]) {
        P.cylX(0.72, 0.46, x + tx, 0.72, bz + tz, COL.tyre, 20);
        P.cylX(0.6, 0.5, x + tx, 0.72, bz + tz, COL.tyre, 20);
        P.cylX(0.34, 0.52, x + tx, 0.72, bz + tz, COL.steel, 10);
        P.cylX(0.12, 0.56, x + tx, 0.72, bz + tz, COL.dark, 6);
      }
      P.box(1.7, 0.15, 3.2, x, 1.18, bz, COL.dark);                               // mudguard
      hazardBand(P, x, bz, 0.8, 1.5, 1.2, sillY0, 0.22);
    }
    for (const z of [-LZ, LZ]) {
      P.aabb(x - 0.45, sillY1, z - 0.55, x + 0.45, legTop, z + 0.55, Y);         // leg
      P.aabb(x - 0.6, sillY1, z - 0.7, x + 0.6, sillY1 + 0.5, z + 0.7, YD);      // foot gusset
      hazardBand(P, x, z, 0.45, 0.55, sillY1 + 0.5, sillY1 + 3.4, 0.28);
      colliders.push({ min: [x - 0.6, 0, z - 0.7], max: [x + 0.6, GY1, z + 0.7] });
      // knee braces up to the main girders
      P.beam([x, legTop - 3.2, z], [x - s * 3.2, legTop + 0.05, z], 0.45, 0.5, Y);
    }
    for (const bz of [-4.5, 4.5]) colliders.push({ min: [x - 0.9, 0, bz - 1.6], max: [x + 0.9, sillY1, bz + 1.6] });
    P.aabb(x - 0.5, legTop - 1.3, -LZ - 0.6, x + 0.5, legTop, LZ + 0.6, Y);       // top end beam
    P.aabb(x - 0.3, 10.0, -LZ + 0.5, x + 0.3, 10.6, LZ - 0.5, Y);                   // mid tie
    P.beam([x, sillY1 + 0.3, -LZ + 0.5], [x, 10.0, LZ - 0.5], 0.3, 0.38, Y);         // diagonals
    P.beam([x, 10.6, -LZ + 0.5], [x, legTop - 1.3, LZ - 0.5], 0.3, 0.38, Y);
  }
  // ---- main girders (trolley runway) along x
  for (const z of [-LZ, LZ]) {
    P.aabb(-LX - 0.8, legTop, z - 0.42, LX + 0.8, GY1, z + 0.42, Y);
    P.aabb(-LX + 0.3, GY1, z - 0.07, LX - 0.3, GY1 + 0.14, z + 0.07, COL.dark);       // rail
  }
  // walkway + railing along the +z girder (outer side) and over end beams
  P.aabb(-LX - 0.8, GY1 - 0.06, LZ + 0.42, LX + 0.8, GY1, LZ + 1.2, COL.grey);
  railing(P, [-LX - 0.8, GY1, LZ + 1.15], [LX + 0.8, GY1, LZ + 1.15], RAIL, 1.05, 2.3, 0.05);
  for (const s of [-1, 1]) railing(P, [s * (LX + 0.75), GY1, -LZ - 0.4], [s * (LX + 0.75), GY1, LZ + 1.15], RAIL, 1.05, 1.7, 0.05);
  P.box(0.7, 0.7, 0.7, LX - 0.3, GY1 + 0.35, -LZ, YD);                      // limit-switch / junction boxes
  P.box(0.7, 0.7, 0.7, -LX + 0.3, GY1 + 0.35, -LZ, YD);
  // festoon cable rail for the trolley power (on -z girder)
  P.aabb(-LX, GY1 - 0.5, -LZ - 0.65, LX, GY1 - 0.42, -LZ - 0.55, COL.steel);
  for (let x = -LX + 0.5; x < -5; x += 1.4) P.box(0.08, 0.9, 0.08, x, GY1 - 0.95, -LZ - 0.6, COL.cable);

  // ---- diesel generator house (+x side, outboard, on a cantilevered platform)
  const gx0 = LX + 0.55, gx1 = LX + 2.9;
  P.aabb(gx0, sillY1 - 0.2, -3.1, gx1 + 0.2, sillY1, 3.1, COL.grey);               // platform
  P.aabb(gx0 + 0.1, sillY1, -2.7, gx1, sillY1 + 2.6, 2.6, Y);                       // house
  P.aabb(gx0, sillY1 + 2.6, -2.8, gx1 + 0.1, sillY1 + 2.75, 2.7, YD);
  P.aabb(gx1 - 0.02, sillY1 + 0.5, -2.2, gx1 + 0.03, sillY1 + 2.1, -0.4, COL.louvre); // radiator grilles
  P.aabb(gx1 - 0.02, sillY1 + 0.5, 0.3, gx1 + 0.03, sillY1 + 2.1, 2.1, COL.louvre);
  for (let y = sillY1 + 0.6; y < sillY1 + 2.1; y += 0.22) P.aabb(gx1, y, -2.2, gx1 + 0.08, y + 0.05, 2.1, COL.dark);
  P.aabb(gx0 + 0.3, sillY1 + 0.3, 2.6, gx0 + 1.4, sillY1 + 2.2, 2.63, YD);           // door
  P.cylY(0.16, 2.2, gx0 + 1.6, sillY1 + 3.6, -1.6, COL.steel, 8);                     // exhaust stack
  P.cylY(0.24, 0.12, gx0 + 1.6, sillY1 + 4.75, -1.6, COL.dark, 8);
  P.aabb(gx0 + 0.15, 1.75, -2.4, gx1 - 0.3, sillY1 - 0.2, 2.4, COL.dark);              // fuel tank
  railing(P, [gx1 + 0.15, sillY1, -3.05], [gx1 + 0.15, sillY1, 3.05], RAIL, 1.0, 1.5, 0.05);
  // ---- e-house / cable reel (-x side)
  const rx = -LX - 1.05;
  P.cylX(1.35, 0.7, rx, 4.35, -2.0, COL.steel, 18);
  P.cylX(0.55, 1.1, rx, 4.35, -2.0, COL.dark, 10);
  P.beam([rx + 0.3, sillY1, -3.3], [rx + 0.3, 4.4, -2.0], 0.2, 0.25, Y);
  P.beam([rx + 0.3, sillY1, -0.7], [rx + 0.3, 4.4, -2.0], 0.2, 0.25, Y);
  P.aabb(rx - 0.15, 0.0, -2.1, rx + 0.0, 3.0, -1.9, COL.cable);
  // ---- stairs (-x side outboard) from ground to the girder walkway
  stairTower(P, { axis: 'z', c: -LX - 1.25, s0: 0.3, s1: 3.3, y0: 0.0, y1: legTop - 0.2, rise: 2.05, width: 0.75, col: COL.steel, railCol: RAIL });
  P.aabb(-LX - 1.7, legTop - 0.25, 3.0, -LX - 0.45, legTop - 0.17, 4.6, COL.steel);

  // ---- amber warning beacon (on top of the +x end beam)
  const warnLight = new THREE.Group(); warnLight.name = 'rtgWarnLight';
  warnLight.position.set(LX + 0.3, GY1 + 0.9, LZ + 0.9);
  P.box(0.25, 0.7, 0.25, LX + 0.3, GY1 + 0.35, LZ + 0.9, COL.steel);
  const mBeacon = new THREE.MeshStandardMaterial({ color: 0x553300, emissive: 0xffa010, emissiveIntensity: 3.0, roughness: 0.3, transparent: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.36, 10), mBeacon);
  warnLight.add(beacon);

  // ---- trolley (moves along x). Trolley-local origin = (x, GY1 + 0.14, 0)
  const trolley = new THREE.Group(); trolley.name = 'rtgTrolley';
  const TY = GY1 + 0.14;
  trolley.position.set(0, TY, 0);
  T.aabb(-2.1, 0.25, -LZ - 0.7, 2.1, 0.75, LZ + 0.7, Y);                         // frame
  T.aabb(-1.9, 0.75, -2.6, 1.6, 2.2, 2.6, Y);                                     // machinery cover
  T.aabb(-2.0, 2.2, -2.7, 1.7, 2.35, 2.7, YD);
  T.aabb(1.6, 0.75, -2.6, 2.05, 1.8, 0.6, COL.grey);                              // e-panel
  for (const z of [-LZ, LZ]) for (const dx of [-1.6, 1.6]) T.cylZ(0.3, 0.3, dx, 0.25, z, COL.dark, 10); // wheels
  T.cylZ(0.55, 3.0, -0.4, 1.3, -0.1, COL.steel, 14);                             // hoist drum (visible through openings)
  for (let x = -1.6; x < 1.5; x += 0.5) T.aabb(x, 0.95, 2.6, x + 0.22, 1.9, 2.64, COL.louvre);
  railing(T, [-2.1, 0.75, -LZ - 0.65], [2.1, 0.75, -LZ - 0.65], RAIL, 1.0, 1.4, 0.05);
  // cab hanger (cab at +x of trolley, between the girders)
  const CX = 2.95, CY0 = -2.8, CY1 = -0.55, CZ = 1.05;                             // cab box in trolley space
  T.aabb(1.9, -0.3, -0.25, CX + 0.85, 0.25, 0.25, COL.steel);                      // cantilever arm
  T.box(0.22, 0.6, 0.22, CX - 0.6, -0.42, 0, COL.steel);
  T.box(0.22, 0.6, 0.22, CX + 0.6, -0.42, 0, COL.steel);
  // cab frame (in the trolley mesh; `cab` object below positions glass/seat)
  const cabFrame = (x0, y0, z0, x1, y1, z1) => T.aabb(x0, y0, z0, x1, y1, z1, COL.white);
  const cx0 = CX - 0.85, cx1 = CX + 0.85, cz0 = -CZ, cz1 = CZ;
  cabFrame(cx0, CY0, cz0, cx1, CY0 + 0.18, cz1);                                  // floor
  cabFrame(cx0, CY1 - 0.18, cz0, cx1, CY1, cz1);                                  // roof
  cabFrame(cx0, CY0, cz1 - 0.12, cx1, CY1, cz1);                                  // rear wall (+z)
  for (const x of [cx0, cx1 - 0.08]) for (const z of [cz0, cz1 - 0.2]) T.aabb(x, CY0, z, x + 0.08, CY1, z + 0.08, COL.white); // pillars
  for (const x of [cx0, cx1 - 0.05]) T.aabb(x, CY0, cz0 + 0.1, x + 0.05, CY0 + 0.75, cz1 - 0.1, COL.white);   // side lower panels
  T.aabb(cx0, CY0 + 0.18, cz0, cx1, CY0 + 0.3, cz0 + 0.06, COL.white);              // front sill
  T.aabb(cx0 + 0.1, CY1 - 0.28, cz0 - 0.4, cx1 - 0.1, CY1 - 0.2, cz0, COL.grey);    // sun visor
  T.aabb(cx0 + 0.3, CY0 + 0.18, cz0 + 0.25, cx1 - 0.3, CY0 + 0.75, cz0 + 0.55, COL.dark); // console
  T.aabb(cx0 + 0.45, CY0 + 0.18, 0.15, cx1 - 0.45, CY0 + 0.55, 0.65, COL.dark);       // seat base
  T.aabb(cx0 + 0.45, CY0 + 0.55, 0.55, cx1 - 0.45, CY0 + 1.35, 0.68, COL.dark);       // seat back
  T.box(0.08, 0.35, 0.08, cx0 + 0.3, CY0 + 0.95, cz0 + 0.45, COL.black);              // joysticks
  T.box(0.08, 0.35, 0.08, cx1 - 0.3, CY0 + 0.95, cz0 + 0.45, COL.black);

  const cab = new THREE.Group(); cab.name = 'rtgCab';
  cab.position.set(CX, CY0, 0);                                                     // cab origin = floor centre
  trolley.add(cab);
  // glass panes (cab-local): front (-z), sides, floor window
  const gl = [];
  const pane = (w, h, d, x, y, z) => gl.push(at(box(w, h, d), x, y, z));
  pane(1.62, CY1 - CY0 - 0.5, 0.03, 0, 0.3 + (CY1 - CY0 - 0.5) / 2, -CZ + 0.03);
  for (const x of [-0.82, 0.82]) pane(0.03, CY1 - CY0 - 1.05, 2 * CZ - 0.32, x, 0.75 + (CY1 - CY0 - 1.05) / 2, -0.05);
  pane(1.2, 0.03, 0.7, 0, 0.1, -CZ + 0.5);
  const mGlass = new THREE.MeshStandardMaterial({ color: 0x9fc3cf, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false, emissive: 0xffc890, emissiveIntensity: 0, side: THREE.DoubleSide });
  mGlass.userData.duskEmissive = 0.25;
  const cabGlass = new THREE.Mesh(merge(gl), mGlass); cabGlass.name = 'rtgCabGlass'; cabGlass.renderOrder = 2;
  cab.add(cabGlass);
  const cabSeat = new THREE.Object3D(); cabSeat.name = 'rtgCabSeat';
  cabSeat.position.set(0, 0.62, 0.38);                                             // hip on the seat, facing -z (window)
  cab.add(cabSeat);

  // ---- spreader (child of trolley). Origin = top centre of a carried container.
  const spreader = new THREE.Group(); spreader.name = 'rtgSpreader';
  trolley.add(spreader);
  S.aabb(-0.55, 0.0, -6.0, 0.55, 0.42, 6.0, Y);                                     // telescopic main beam
  S.aabb(-0.42, 0.42, -6.0, 0.42, 0.5, 6.0, YD);
  for (const sz of [-1, 1]) {
    S.aabb(-1.22, 0.0, sz * 6.05 - 0.28, 1.22, 0.45, sz * 6.05 + 0.28, Y);          // end beam
    for (const sx of [-1, 1]) {
      S.box(0.3, 0.25, 0.3, sx * 1.07, -0.1, sz * 5.95, COL.dark);                   // twistlock
      S.box(0.06, 0.7, 0.6, sx * 1.27, -0.1, sz * 5.95, COL.orange);                  // flipper
    }
    S.box(0.6, 0.3, 0.9, 0, 0.6, sz * 3.0, COL.dark);                                // telescoping motors
  }
  S.aabb(-1.0, 0.45, -0.75, 1.0, 1.05, 0.75, YD);                                    // headblock
  for (const sx of [-0.55, 0.55]) S.cylX(0.32, 0.12, sx, 1.05, 0, COL.steel, 10);
  // hoist ropes: unit-length boxes whose top vertices are re-written by setHoist
  const ropeTop = [], ropeBot = [];
  for (const [bx, bz, tx, tz] of [[-0.55, -0.5, -0.7, -1.4], [0.55, -0.5, 0.7, -1.4], [-0.55, 0.5, -0.7, 1.4], [0.55, 0.5, 0.7, 1.4]]) {
    const g = at(box(0.07, 1, 0.07), bx, 1.05 + 0.5, bz);
    S.add(g, COL.cable);
    ropeBot.push([bx, bz]); ropeTop.push([tx - bx, tz - bz]);
  }
  const sGeo = bake(S, { groundGrime: 0, aoUnder: 0.8 });
  const sMesh = new THREE.Mesh(sGeo, null); sMesh.frustumCulled = false; sMesh.castShadow = true;
  // indices of rope top vertices (y > 1.5 in the unit rope boxes; spreader parts never exceed 1.06)
  const sp = sGeo.attributes.position;
  const topIdx = [];
  for (let i = 0; i < sp.count; i++) if (sp.getY(i) > 1.5) topIdx.push(i);
  const topBase = topIdx.map((i) => [sp.getX(i), sp.getZ(i)]);
  const ropeOff = topIdx.map((i) => {
    // which rope? nearest bottom anchor
    let best = 0, bd = 1e9;
    ropeBot.forEach(([bx, bz], k) => { const d = (sp.getX(i) - bx) ** 2 + (sp.getZ(i) - bz) ** 2; if (d < bd) { bd = d; best = k; } });
    return ropeTop[best];
  });

  // ---- assemble
  const root = new THREE.Group(); root.name = 'rtg';
  const mPaint = paintMat();
  const sMain = new THREE.Mesh(bake(P, { groundGrime: 3.5, uvScale: 1 / 6 }), mPaint);
  sMain.castShadow = true; sMain.receiveShadow = true;
  const tMesh = new THREE.Mesh(bake(T, { groundGrime: 0, uvScale: 1 / 6 }), mPaint);
  tMesh.castShadow = true;
  sMesh.material = mPaint;
  trolley.add(tMesh); spreader.add(sMesh);
  root.add(sMain, trolley, warnLight);

  const state = { x: 0, y: 8 };
  function setTrolley(x) {
    state.x = Math.min(info.trolleyRange[1], Math.max(info.trolleyRange[0], x));
    trolley.position.x = state.x;
  }
  function setHoist(y) {
    state.y = Math.min(info.hoistRange[1], Math.max(info.hoistRange[0], y));
    spreader.position.y = state.y - TY;
    const ropeLen = -spreader.position.y - 1.05 + 0.25;   // from headblock (spreader-local 1.05) to trolley frame underside (+0.25)
    for (let k = 0; k < topIdx.length; k++) {
      const i = topIdx[k];
      sp.setXYZ(i, topBase[k][0] + ropeOff[k][0], 1.05 + ropeLen, topBase[k][1] + ropeOff[k][1]);
    }
    sp.needsUpdate = true;
  }
  const update = (dt, t) => {
    // rotating-beacon look: pulse
    const k = 0.5 + 0.5 * Math.sin(t * 7.0);
    mBeacon.emissiveIntensity = 1.0 + 4.0 * k * k;
  };
  const info = { trolleyRange: [-9.4, 6.9], hoistRange: [0.0, 15.6], ...{} };
  setTrolley(0); setHoist(8);
  Object.assign(info, triCount(root));
  return {
    root, colliders, update, info,
    trolley, spreader, cab, cabGlass, cabSeat, warnLight,
    setTrolley, setHoist,
    anchors: { warn: [warnLight.position.clone()], cab, cabSeat, spreader, warnLight },
  };
}

// =====================================================================================================
// demo layout for screenshots (level coordinates)
// =====================================================================================================
export function _demo(ctx) {
  const root = new THREE.Group();
  const A = buildQuayCrane({ boom: 'down', paint: 'red' });
  A.root.position.set(-48, 0, -124); root.add(A.root);
  const B = buildQuayCrane({ boom: 'up', paint: 'blue' });
  B.root.position.set(46, 0, -124); root.add(B.root);
  const R = buildRTG();
  R.root.position.set(-6, 0, -82); root.add(R.root);
  R.setTrolley(-3.0); R.setHoist(7.5);
  const cont = new THREE.Mesh(box(2.44, 2.6, 12.19), new THREE.MeshStandardMaterial({ color: 0x2f6aa0, roughness: 0.7, metalness: 0.2 }));
  cont.position.y = -1.3; cont.castShadow = true; R.spreader.add(cont);
  // rails, quay edge, water and a ship-ish block for context
  const ctxMat = new THREE.MeshStandardMaterial({ color: 0x777370, roughness: 0.9 });
  for (const z of [-124, -149]) for (const dz of [-0.4, 0.4]) { const r = new THREE.Mesh(box(260, 0.15, 0.15), ctxMat); r.position.set(0, 0.075, z + dz); root.add(r); }
  const water = new THREE.Mesh(box(600, 0.1, 400), new THREE.MeshStandardMaterial({ color: 0x1b2a33, roughness: 0.15, metalness: 0.6 }));
  water.position.set(0, -2.2, -151 - 200 - 0.01); root.add(water);
  const hull = new THREE.Mesh(box(160, 11.2, 27), new THREE.MeshStandardMaterial({ color: 0x3b2622, roughness: 0.8 }));
  hull.position.set(-15, 3.4, -166.5); root.add(hull);
  // simulate the level's dusk ramp on emissive materials
  const dusk = Number(new URLSearchParams(location.search).get('dusk') || 0);
  const em = Math.min(1, Math.max(0, (dusk - 0.15) / 0.6));
  root.traverse((o) => { if (o.material && o.material.userData && o.material.userData.duskEmissive !== undefined) o.material.emissiveIntensity = o.material.userData.duskEmissive * (0.15 + 0.85 * em); });
  const update = (dt, t) => { A.update(dt, t); B.update(dt, t); R.update(dt, t); };
  update(0, 0.3);
  return { root, update, info: { quayDown: A.info.tris + '/' + A.info.drawCalls, quayUp: B.info.tris + '/' + B.info.drawCalls, rtg: R.info.tris + '/' + R.info.drawCalls } };
}
