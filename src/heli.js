import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from './rng.js';

// =====================================================================================
//  GUNSHIP "WIDOWMAKER" — the boss helicopter. Fully procedural (lofted hull + canvas atlas).
//
//  buildHeli() -> {
//    root, tilt, body, navLights, cone, rotor, tailRotor, pods:[L,R], gun, smokePt, lightPt, half, center,   (original API)
//    burnables: Mesh[]         extra meshes to char on crash (main + tail rotor; the flung tail piece is added by breakTail)
//    sparkPt: Object3D         where to spawn sparks/fire once the engine panel has blown off (setDamage >= 0.55)
//    setDamage(d 0..1)         progressive damage: scorch/soot creeping over the paint with glowing edges (shader),
//                              at d >= 0.55 the right engine access panel blows off exposing glowing guts at sparkPt.
//                              Returns true on the call where the panel just blew (spawn a small pop + debris there).
//    aimGun(worldPos, dt, firing)  slews the chin turret + nose sensor ball toward worldPos (limits applied), spins the
//                              3 barrels while firing, and keeps `gun` (muzzle point) at the barrel tips. Zero extra draws
//                              (vertex-shader rigging).
//    breakTail()               detaches the tail boom end + fin + tail rotor as one object re-parented to the scene
//                              (keeps world transform); returns { object, velocityHint (world m/s, add heli vel), spinHint (rad/s xyz) }.
//                              Main model stays intact (boom ends in a dark torn cap). Idempotent (returns null the 2nd time).
//    rotorBlur(speed|null)     force the rotor-blur amount from a rotor speed in rad/s (null = auto). By default the blur
//                              auto-detects whether the game is spinning `rotor` (fades in while spinning, out on the wreck).
//  }
//  Forward = -z, up = +y, origin ≈ fuselage centre. ~16 m long incl. tail, rotor Ø 14 m (before the game's 1.2 scale).
// =====================================================================================

const TW = 2048, TH = 1024;
const TAU = Math.PI * 2;
// atlas regions [x, y, w, h] in canvas px
const RG = {
  FUS: [0, 0, 2048, 448],
  NAC: [0, 448, 512, 192],
  SPON: [512, 448, 384, 192],
  EXH: [896, 448, 128, 96],
  GUTS: [896, 544, 128, 96],
  WING_R: [1024, 448, 256, 192],
  WING_L: [1280, 448, 256, 192],
  FIN_R: [1536, 448, 256, 320],
  FIN_L: [1792, 448, 256, 320],
  STAB: [0, 640, 512, 128],
  POD: [512, 640, 384, 128],
  MISS: [896, 640, 256, 96],
  BLADE: [0, 768, 1024, 48],
  TBLADE: [0, 816, 256, 32],
};
const FZ0 = -5.3, FZ1 = 9.1;       // fuselage loft z range
const NZ0 = -0.62, NZ1 = 2.45;     // nacelle loft z range
const SZ0 = -1.95, SZ1 = 1.75;     // sponson z range
const FIN_Z0 = 7.6, FIN_Z1 = 9.8, FIN_Y0 = 0.3, FIN_Y1 = 2.95;
const ZBREAK = 6.3;                // tail separation station
const BLADE_R = 7.0;
const TURRET_P = new THREE.Vector3(0, -0.86, -2.7);
const SENSOR_P = new THREE.Vector3(0, -0.74, -4.98);
const BARREL_AXIS = new THREE.Vector3(0, -0.9, 0); // barrel cluster axis (along z) in rest pose
const MUZZLE_REST = new THREE.Vector3(0, -0.9, -4.25);
const TAIL_ROTOR_P = new THREE.Vector3(0.3, 2.1, 9.15);

// swatches: name -> [sRGB albedo, roughness, metalness, emissive mask]
const SWATCH = {
  gun: [[54, 56, 58], 0.36, 0.8, 0],
  rubber: [[38, 38, 36], 0.9, 0.0, 0],
  soot: [[30, 27, 24], 0.95, 0.0, 0],
  heat: [[255, 110, 30], 0.6, 0.0, 0.18],
  lensR: [[255, 40, 25], 0.15, 0.0, 1],
  lensG: [[40, 255, 110], 0.15, 0.0, 1],
  lensW: [[255, 248, 230], 0.15, 0.0, 1],
  sensor: [[22, 30, 36], 0.04, 0.9, 0],
  olive: [[88, 92, 70], 0.58, 0.18, 0],
  char: [[66, 70, 72], 0.55, 0.22, 0],
  frame: [[50, 53, 52], 0.42, 0.45, 0],
  chrome: [[205, 205, 200], 0.18, 1.0, 0],
  rnose: [[118, 114, 82], 0.5, 0.2, 0],
  tube: [[24, 24, 22], 0.9, 0.0, 0],
  hub: [[72, 74, 74], 0.38, 0.75, 0],
  missile: [[100, 104, 88], 0.5, 0.2, 0],
  seeker: [[40, 48, 56], 0.06, 0.9, 0],
  band: [[168, 146, 64], 0.5, 0.1, 0],
  tan: [[120, 108, 88], 0.8, 0.05, 0],
  guts: [[34, 31, 28], 0.8, 0.4, 0],
};
const SW_ORDER = Object.keys(SWATCH);
const SW_SIZE = 40;
function swatchRect(name) {
  const i = SW_ORDER.indexOf(name);
  return [1024 + (i % 25) * SW_SIZE, 864 + Math.floor(i / 25) * SW_SIZE, SW_SIZE, SW_SIZE];
}

// ------------------------------------------------------------------ math helpers
function pchip(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
// keys: [[z, w, t, b, y, n, pt, x?], ...] -> f(z) => station
function stationFn(keys) {
  const zs = keys.map(k => k[0]);
  const cols = [1, 2, 3, 4, 5, 6, 7].map(c => pchip(zs, keys.map(k => k[c] ?? 0)));
  return (z) => ({ z, w: cols[0](z), t: cols[1](z), b: cols[2](z), y: cols[3](z), n: cols[4](z), pt: cols[5](z), x: cols[6](z) });
}
// a: 0 = bottom, π/2 = +x side, π = top, 3π/2 = -x side
function ringPt(st, a) {
  const th = a - Math.PI / 2, c = Math.cos(th), s = Math.sin(th), e = 2 / st.n;
  let x = st.w * Math.sign(c) * Math.pow(Math.abs(c), e);
  const y = Math.sign(s) * Math.pow(Math.abs(s), e) * (s > 0 ? st.t : st.b);
  if (s > 0) x *= 1 - (st.pt || 0) * s * s;
  return [x + (st.x || 0), y + (st.y || 0)];
}
function ringXAtY(st, y) { // +x half-width of the ring at height y (upper half)
  let lo = Math.PI / 2, hi = Math.PI;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (ringPt(st, m)[1] < y) lo = m; else hi = m; }
  return ringPt(st, lo)[0] - (st.x || 0);
}
function zList(z0, z1, keysZ, step) {
  const out = [z0];
  const ks = keysZ.filter(z => z > z0 + 1e-4 && z < z1 - 1e-4);
  const pts = [z0, ...ks, z1];
  for (let i = 0; i < pts.length - 1; i++) {
    const n = Math.max(1, Math.ceil((pts[i + 1] - pts[i]) / step));
    for (let k = 1; k <= n; k++) out.push(pts[i] + (pts[i + 1] - pts[i]) * k / n);
  }
  return out;
}

// ------------------------------------------------------------------ geometry helpers
const canvasUV = (cx, cy) => [cx / TW, 1 - cy / TH];
function finish(g, part = 0) {
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
  g.morphAttributes = {};
  g.groups = [];
  return g;
}
function sw(g, name) { // whole geometry -> flat swatch
  const [x, y, w, h] = swatchRect(name);
  const [u, v] = canvasUV(x + w / 2, y + h / 2);
  const uv = g.attributes.uv || new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  g.setAttribute('uv', uv);
  return g;
}
function remap(g, rect, flipU = false) { // geometry's own [0,1] uv -> atlas rect
  const [x, y, w, h] = rect, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    let U = uv.getX(i), V = uv.getY(i); if (flipU) U = 1 - U;
    const [u, v] = canvasUV(x + U * w, y + (1 - V) * h);
    uv.setXY(i, u, v);
  }
  return g;
}
function xf(g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  return g;
}
function mirrorX(g) { // mirror a (non-indexed, finished) geometry across x and fix winding
  g = g.index ? g.toNonIndexed() : g.clone();
  const p = g.attributes.position, nn = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); if (nn) nn.setX(i, -nn.getX(i)); }
  for (const key of Object.keys(g.attributes)) {
    const a = g.attributes[key], s = a.itemSize, arr = a.array;
    for (let t = 0; t < a.count; t += 3) for (let k = 0; k < s; k++) { const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k; const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
  }
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
// oriented box between two points (frames, struts)
function strut(a, b, w, t, up = new THREE.Vector3(0, 1, 0)) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = box(w, t, len);
  const zA = d.clone().normalize();
  let yA = up.clone().addScaledVector(zA, -up.dot(zA)); if (yA.lengthSq() < 1e-6) yA.set(1, 0, 0); yA.normalize();
  const xA = new THREE.Vector3().crossVectors(yA, zA);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(xA, yA, zA).setPosition(a.clone().add(b).multiplyScalar(0.5)));
  return g;
}
function tube(a, b, r, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = cyl(r, r, len, seg, true);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())).setPosition(a.clone().add(b).multiplyScalar(0.5)));
  return g;
}

// Loft: rings (superellipse cross-sections) along z. uvf(st, i, a) -> canvas [cx, cy]. hole: {i0,i1,j0,j1,depth}
function loft(S, segs, uvf, hole = null) {
  const nr = S.length, nc = segs + 1;
  const P = new Float32Array(nr * nc * 3), UV = new Float32Array(nr * nc * 2);
  for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) {
    const a = (j / segs) * TAU, [x, y] = ringPt(S[i], a), k = i * nc + j;
    P[k * 3] = x; P[k * 3 + 1] = y; P[k * 3 + 2] = S[i].z;
    const [cx, cy] = uvf(S[i], i, a, j); const [u, v] = canvasUV(cx, cy);
    UV[k * 2] = u; UV[k * 2 + 1] = v;
  }
  const main = [], hid = [];
  const inHole = (i, j) => hole && i >= hole.i0 && i < hole.i1 && j >= hole.j0 && j < hole.j1;
  for (let i = 0; i < nr - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * nc + j, b = a + 1, c = a + nc, d = c + 1;
    (inHole(i, j) ? hid : main).push(a, b, c, b, d, c);
  }
  const all = new THREE.BufferGeometry();
  all.setAttribute('position', new THREE.BufferAttribute(P, 3));
  all.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  all.setIndex([...main, ...hid]);
  all.computeVertexNormals();
  const N = all.attributes.normal;
  for (let i = 0; i < nr; i++) { // weld seam normals
    const a = i * nc, b = i * nc + segs;
    const x = N.getX(a) + N.getX(b), y = N.getY(a) + N.getY(b), z = N.getZ(a) + N.getZ(b), l = Math.hypot(x, y, z) || 1;
    N.setXYZ(a, x / l, y / l, z / l); N.setXYZ(b, x / l, y / l, z / l);
  }
  const mk = (idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', all.attributes.position); g.setAttribute('normal', N); g.setAttribute('uv', all.attributes.uv); g.setIndex(idx); return g.toNonIndexed(); };
  const out = { main: mk(main), S };
  if (hole) {
    out.panel = mk(hid);
    // cavity: floor (ring scaled toward station centre) + 4 walls
    const k = hole.depth;
    const inner = (i, j) => { const a = (j / segs) * TAU, [x, y] = ringPt(S[i], a); const cx = S[i].x || 0, cy = S[i].y || 0; return new THREE.Vector3(cx + (x - cx) * k, cy + (y - cy) * k, S[i].z); };
    const outer = (i, j) => { const a = (j / segs) * TAU, [x, y] = ringPt(S[i], a); return new THREE.Vector3(x, y, S[i].z); };
    const pos = [], uvs = [];
    const G = RG.GUTS;
    const guv = (i, j) => canvasUV(G[0] + 4 + (i - hole.i0) / (hole.i1 - hole.i0) * (G[2] - 8), G[1] + 4 + (j - hole.j0) / (hole.j1 - hole.j0) * (G[3] - 8));
    const tri = (A, B, C, ua, ub, uc) => { pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z); uvs.push(...ua, ...ub, ...uc); };
    for (let i = hole.i0; i < hole.i1; i++) for (let j = hole.j0; j < hole.j1; j++) {
      const A = inner(i, j), B = inner(i, j + 1), C = inner(i + 1, j), D = inner(i + 1, j + 1);
      tri(A, B, C, guv(i, j), guv(i, j + 1), guv(i + 1, j)); tri(B, D, C, guv(i, j + 1), guv(i + 1, j + 1), guv(i + 1, j));
    }
    const ctr = inner(Math.floor((hole.i0 + hole.i1) / 2), Math.floor((hole.j0 + hole.j1) / 2));
    const wuv = canvasUV(...(() => { const r = swatchRect('soot'); return [r[0] + r[2] / 2, r[1] + r[3] / 2]; })());
    const wall = (p0, p1) => { // p0,p1 outer rim points; matching inner points
      const [i0, j0] = p0, [i1, j1] = p1;
      const A = outer(i0, j0), B = outer(i1, j1), C = inner(i0, j0), D = inner(i1, j1);
      const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A));
      const mid = A.clone().add(B).add(C).add(D).multiplyScalar(0.25);
      const flip = n.dot(new THREE.Vector3().subVectors(ctr, mid)) < 0;
      if (!flip) { tri(A, B, C, wuv, wuv, wuv); tri(B, D, C, wuv, wuv, wuv); } else { tri(A, C, B, wuv, wuv, wuv); tri(B, C, D, wuv, wuv, wuv); }
    };
    for (let j = hole.j0; j < hole.j1; j++) { wall([hole.i0, j], [hole.i0, j + 1]); wall([hole.i1, j], [hole.i1, j + 1]); }
    for (let i = hole.i0; i < hole.i1; i++) { wall([i, hole.j0], [i + 1, hole.j0]); wall([i, hole.j1], [i + 1, hole.j1]); }
    const cav = new THREE.BufferGeometry();
    cav.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cav.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    cav.computeVertexNormals();
    out.cavity = cav;
    const mi = Math.floor((hole.i0 + hole.i1) / 2), mj = Math.floor((hole.j0 + hole.j1) / 2);
    out.holeCenter = outer(mi, mj); out.holeNormal = new THREE.Vector3().subVectors(outer(mi, mj), inner(mi, mj)).normalize();
  }
  return out;
}
// flat cap (fan) at station st, facing dir (+1 => +z)
function capFan(st, segs, dir, scale = 1, uvName = 'soot') {
  const pos = [];
  const c = [st.x || 0, st.y || 0];
  for (let j = 0; j < segs; j++) {
    const a0 = (j / segs) * TAU, a1 = ((j + 1) / segs) * TAU;
    let p0 = ringPt(st, a0), p1 = ringPt(st, a1);
    p0 = [c[0] + (p0[0] - c[0]) * scale, c[1] + (p0[1] - c[1]) * scale]; p1 = [c[0] + (p1[0] - c[0]) * scale, c[1] + (p1[1] - c[1]) * scale];
    if (dir > 0) pos.push(c[0], c[1], st.z, p0[0], p0[1], st.z, p1[0], p1[1], st.z);
    else pos.push(c[0], c[1], st.z, p1[0], p1[1], st.z, p0[0], p0[1], st.z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return sw(g, uvName);
}

// ===================================================================== TEXTURE ATLAS
function makeNoise(seed, N) {
  const r = makeRng(seed), lat = new Float32Array(N * N);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % N) + N) % N, y0 = ((yi % N) + N) % N, x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
    const a = lat[y0 * N + x0], b = lat[y0 * N + x1], c = lat[y1 * N + x0], d = lat[y1 * N + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(nz, x, y, oct = 4) { let s = 0, a = 0.5, n = 0, f = 1; for (let o = 0; o < oct; o++) { s += a * nz(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; }
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const g8 = (v) => { const k = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${k},${k},${k})`; };

// draw a scalar field fn(u,v) (0..1 within rect) at low res, upscale into ctx rect
function fieldInto(ctx, rect, lw, lh, fn, alpha = 1, mode = 'source-over') {
  const c = mkCanvas(lw, lh), x = c.getContext('2d'), img = x.createImageData(lw, lh);
  for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
    const v = fn((i + 0.5) / lw, (j + 0.5) / lh), k = (j * lw + i) * 4;
    if (Array.isArray(v)) { img.data[k] = v[0]; img.data[k + 1] = v[1]; img.data[k + 2] = v[2]; img.data[k + 3] = v[3] ?? 255; }
    else { const g = Math.max(0, Math.min(255, v * 255)); img.data[k] = img.data[k + 1] = img.data[k + 2] = g; img.data[k + 3] = 255; }
  }
  x.putImageData(img, 0, 0);
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = mode; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, rect[0], rect[1], rect[2], rect[3]); ctx.restore();
}

// 7-segment style stencil digits (font-independent, reads as military stencil). x,y top-left, w,h size.
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function stencilDigit(ctx, d, x, y, w, h) {
  const t = w * 0.26, g = t * 0.28; // thickness, stencil gap
  const H = (sx, sy, len) => { ctx.beginPath(); ctx.moveTo(sx + g, sy); ctx.lineTo(sx + len - g, sy); ctx.lineTo(sx + len - g - t * 0.4, sy + t); ctx.lineTo(sx + g + t * 0.4, sy + t); ctx.closePath(); ctx.fill(); };
  const Hm = (sx, sy, len) => { ctx.fillRect(sx + g + t * 0.3, sy - t / 2, len - 2 * g - t * 0.6, t); };
  const V = (sx, sy, len) => { ctx.fillRect(sx, sy + g, t, len - 2 * g); };
  const s = SEG[d] || '';
  const hh = h / 2;
  if (s.includes('a')) H(x, y, w);
  if (s.includes('d')) { ctx.save(); ctx.translate(0, 2 * y + h); ctx.scale(1, -1); H(x, y, w); ctx.restore(); }
  if (s.includes('g')) Hm(x, y + hh, w);
  if (s.includes('f')) V(x, y, hh);
  if (s.includes('b')) V(x + w - t, y, hh);
  if (s.includes('e')) V(x, y + hh, hh);
  if (s.includes('c')) V(x + w - t, y + hh, hh);
}
function stencilNumber(ctx, str, cx, cy, h) {
  const w = h * 0.52, sp = h * 0.14, tot = str.length * w + (str.length - 1) * sp;
  let x = cx - tot / 2;
  for (const ch of str) { if (ch === '1') stencilDigit(ctx, 1, x - w * 0.37, cy - h / 2, w, h); else stencilDigit(ctx, +ch, x, cy - h / 2, w, h); x += w + sp; }
}
function text(ctx, str, x, y, size, color, { weight = 800, align = 'center', squash = 0.8, spacing = 0 } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(squash, 1);
  ctx.font = `${weight} ${size}px "Arial Narrow", "Roboto Condensed", Inter, Arial, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, 0, 0); ctx.restore();
}
// Original emblem: black widow on a roundel, red hourglass, banner. Drawn centred at 0,0, radius r.
function drawEmblem(ctx, r) {
  ctx.save();
  ctx.fillStyle = 'rgb(150,138,112)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgb(44,46,44)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, TAU); ctx.fill();
  // web lines
  ctx.strokeStyle = 'rgba(150,138,112,0.55)'; ctx.lineWidth = r * 0.025;
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86); ctx.stroke(); }
  for (const rr of [0.3, 0.5, 0.7]) { ctx.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * TAU; const px = Math.cos(a) * r * rr, py = Math.sin(a) * r * rr; if (k) ctx.quadraticCurveTo(Math.cos(a - Math.PI / 8) * r * rr * 0.86, Math.sin(a - Math.PI / 8) * r * rr * 0.86, px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
  // spider: legs
  ctx.strokeStyle = 'rgb(14,14,14)'; ctx.lineWidth = r * 0.055; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
    const ay = -0.22 + k * 0.1, kx = 0.32 + (k === 0 || k === 3 ? 0.06 : 0), ky = [-0.42, -0.2, 0.12, 0.38][k];
    ctx.beginPath(); ctx.moveTo(sx * 0.06 * r, ay * r); ctx.lineTo(sx * kx * r, (ay + ky * 0.45) * r); ctx.lineTo(sx * (kx + 0.24) * r, (ay + ky * 1.25) * r); ctx.stroke();
  }
  ctx.fillStyle = 'rgb(14,14,14)';
  ctx.beginPath(); ctx.ellipse(0, -0.26 * r, 0.11 * r, 0.13 * r, 0, 0, TAU); ctx.fill(); // cephalothorax
  ctx.beginPath(); ctx.ellipse(0, 0.12 * r, 0.24 * r, 0.3 * r, 0, 0, TAU); ctx.fill(); // abdomen
  // hourglass
  ctx.fillStyle = 'rgb(190,28,20)';
  ctx.beginPath(); ctx.moveTo(-0.1 * r, -0.04 * r); ctx.lineTo(0.1 * r, -0.04 * r); ctx.lineTo(0.015 * r, 0.12 * r); ctx.lineTo(0.1 * r, 0.28 * r); ctx.lineTo(-0.1 * r, 0.28 * r); ctx.lineTo(-0.015 * r, 0.12 * r); ctx.closePath(); ctx.fill();
  // highlight on abdomen
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-0.08 * r, 0.0, 0.05 * r, 0.1 * r, -0.3, 0, TAU); ctx.fill();
  // banner
  ctx.fillStyle = 'rgb(150,138,112)'; ctx.fillRect(-0.95 * r, 0.7 * r, 1.9 * r, 0.32 * r);
  ctx.fillStyle = 'rgb(28,28,26)'; text(ctx, 'WIDOWMAKER', 0, 0.865 * r, r * 0.26, 'rgb(28,28,26)', { weight: 900, squash: 0.78 });
  ctx.restore();
}
function hourglass(ctx, cx, cy, w, h, color = 'rgb(150,26,18)') {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(cx - w / 2, cy - h / 2); ctx.lineTo(cx + w / 2, cy - h / 2); ctx.lineTo(cx + w * 0.07, cy); ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy + h / 2); ctx.lineTo(cx - w * 0.07, cy); ctx.closePath(); ctx.fill();
}

function buildAtlas(fusSt) {
  const rng = makeRng(1313);
  const L = {};
  for (const k of ['alb', 'hgt', 'rgh', 'met', 'dmg', 'emi']) { const c = mkCanvas(TW, TH); L[k] = c.getContext('2d'); L[k].canvas_ = c; }
  const OLIVE = 'rgb(88,92,70)', CHAR = 'rgb(62,66,68)';
  L.alb.fillStyle = OLIVE; L.alb.fillRect(0, 0, TW, TH);
  L.hgt.fillStyle = g8(0.5); L.hgt.fillRect(0, 0, TW, TH);
  L.rgh.fillStyle = g8(0.58); L.rgh.fillRect(0, 0, TW, TH);
  L.met.fillStyle = g8(0.1); L.met.fillRect(0, 0, TW, TH);
  L.dmg.fillStyle = g8(1); L.dmg.fillRect(0, 0, TW, TH);
  L.emi.fillStyle = g8(0); L.emi.fillRect(0, 0, TW, TH);
  const clip = (ctx, r) => { ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2], r[3]); ctx.clip(); };
  const nz = makeNoise(77, 64), nz2 = makeNoise(91, 64);

  // ---------- generic skin: camo + mottling + damage field ----------
  // pxm: [px per metre along u, px per metre along v] (can be a fn of u)
  function camo(r, pxmU, pxmV, count, seed, wrapV = false) {
    const rr = makeRng(seed);
    clip(L.alb, r);
    L.alb.fillStyle = CHAR;
    for (let k = 0; k < count; k++) {
      const cu = r[0] + rr() * r[2], cv = r[1] + rr() * r[3];
      const pv = typeof pxmV === 'function' ? pxmV((cu - r[0]) / r[2]) : pxmV;
      const sz = 0.3 + rr() * 0.45, el = 1.3 + rr() * 1.3, rot = (rr() - 0.5) * 0.7;
      const nv = 11, pts = [];
      for (let q = 0; q < nv; q++) {
        const a = q / nv * TAU, rad = sz * (0.6 + rr() * 0.55);
        const mx = Math.cos(a) * rad * el, my = Math.sin(a) * rad;
        pts.push([cu + (mx * Math.cos(rot) - my * Math.sin(rot)) * pxmU, cv + (mx * Math.sin(rot) + my * Math.cos(rot)) * pv]);
      }
      for (const off of wrapV ? [-r[3], 0, r[3]] : [0]) {
        L.alb.beginPath();
        for (let q = 0; q <= nv; q++) {
          const p = pts[q % nv], pn = pts[(q + 1) % nv];
          const mx = (p[0] + pn[0]) / 2, my = (p[1] + pn[1]) / 2 + off;
          if (q === 0) L.alb.moveTo(mx, my); else L.alb.quadraticCurveTo(p[0], p[1] + off, mx, my);
        }
        L.alb.fill();
      }
    }
    L.alb.restore();
  }
  function mottle(r, scaleU, scaleV, seed) {
    const n = makeNoise(seed, 64);
    fieldInto(L.alb, r, Math.min(512, r[2] / 2 | 0), Math.min(256, r[3] / 2 | 0), (u, v) => {
      const f = fbm(n, u * scaleU, v * scaleV, 4);
      const k = (f - 0.5) * 2;
      return k > 0 ? [255, 250, 225, k * 34] : [10, 10, 6, -k * 50];
    }, 1);
    fieldInto(L.rgh, r, 128, 64, (u, v) => 0.52 + (fbm(n, u * scaleU * 0.7 + 3, v * scaleV * 0.7, 3) - 0.5) * 0.25);
  }
  function damageField(r, fn, seed) {
    const n = makeNoise(seed, 64);
    fieldInto(L.dmg, r, 192, 96, (u, v) => {
      const blot = fbm(n, u * 7, v * 5, 4);
      const t = (blot - 0.5) * 2.4 + 0.5;
      return Math.max(0.1, Math.min(0.97, 0.3 + (1 - t) * 0.75 + fn(u, v)));
    });
  }
  function dust(r, rowsFrom, rowsTo, alpha) { // gradient band (rows absolute)
    const g = L.alb.createLinearGradient(0, rowsFrom, 0, rowsTo);
    g.addColorStop(0, `rgba(132,116,92,${alpha})`); g.addColorStop(1, 'rgba(132,116,92,0)');
    clip(L.alb, r); L.alb.fillStyle = g; L.alb.fillRect(r[0], Math.min(rowsFrom, rowsTo), r[2], Math.abs(rowsTo - rowsFrom)); L.alb.restore();
    const g2 = L.rgh.createLinearGradient(0, rowsFrom, 0, rowsTo);
    g2.addColorStop(0, `rgba(230,230,230,${alpha})`); g2.addColorStop(1, 'rgba(230,230,230,0)');
    clip(L.rgh, r); L.rgh.fillStyle = g2; L.rgh.fillRect(r[0], Math.min(rowsFrom, rowsTo), r[2], Math.abs(rowsTo - rowsFrom)); L.rgh.restore();
  }
  // panel line (groove) + rivets
  function pline(x0, y0, x1, y1, riv = 0) {
    L.alb.strokeStyle = 'rgba(12,12,8,0.6)'; L.alb.lineWidth = 1.6;
    L.alb.beginPath(); L.alb.moveTo(x0, y0); L.alb.lineTo(x1, y1); L.alb.stroke();
    L.alb.strokeStyle = 'rgba(230,225,200,0.10)'; L.alb.lineWidth = 1;
    L.alb.beginPath(); L.alb.moveTo(x0 + 1.2, y0 + 1.2); L.alb.lineTo(x1 + 1.2, y1 + 1.2); L.alb.stroke();
    L.hgt.strokeStyle = g8(0.18); L.hgt.lineWidth = 2.2;
    L.hgt.beginPath(); L.hgt.moveTo(x0, y0); L.hgt.lineTo(x1, y1); L.hgt.stroke();
    if (riv) {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / riv);
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      for (let k = 1; k < n; k++) for (const s of [-3.2, 3.2]) {
        if (rng() < 0.5 && s > 0) continue;
        const px = x0 + (x1 - x0) * k / n + nx * s, py = y0 + (y1 - y0) * k / n + ny * s;
        L.hgt.fillStyle = g8(0.8); L.hgt.beginPath(); L.hgt.arc(px, py, 1.1, 0, TAU); L.hgt.fill();
        L.alb.fillStyle = 'rgba(0,0,0,0.18)'; L.alb.fillRect(px - 0.6, py - 0.6, 1.4, 1.4);
      }
    }
  }
  function prect(x, y, w, h, riv = 7, tone = 0) {
    if (tone) { L.alb.fillStyle = tone > 0 ? `rgba(255,250,230,${tone})` : `rgba(0,0,0,${-tone})`; L.alb.fillRect(x, y, w, h); }
    pline(x, y, x + w, y, riv); pline(x + w, y, x + w, y + h, riv); pline(x + w, y + h, x, y + h, riv); pline(x, y + h, x, y, riv);
    // fasteners at corners
    for (const [px, py] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) { L.hgt.fillStyle = g8(0.3); L.hgt.beginPath(); L.hgt.arc(px, py, 1.6, 0, TAU); L.hgt.fill(); }
  }
  function louvers(x, y, w, h, n) {
    for (let k = 0; k < n; k++) {
      const yy = y + (k + 0.5) * h / n;
      L.alb.fillStyle = 'rgba(8,8,6,0.75)'; L.alb.fillRect(x, yy - 1.5, w, 3);
      L.alb.fillStyle = 'rgba(220,215,190,0.12)'; L.alb.fillRect(x, yy + 1.5, w, 1);
      L.hgt.fillStyle = g8(0.15); L.hgt.fillRect(x, yy - 1.5, w, 3);
      L.hgt.fillStyle = g8(0.75); L.hgt.fillRect(x, yy + 1.5, w, 1.5);
    }
    pline(x - 3, y - 3, x + w + 3, y - 3); pline(x - 3, y + h + 3, x + w + 3, y + h + 3);
  }
  function chips(r, n, seed) {
    const rr = makeRng(seed);
    for (let k = 0; k < n; k++) {
      const x = r[0] + rr() * r[2], y = r[1] + rr() * r[3], s = 0.6 + rr() * 1.6;
      L.alb.fillStyle = `rgba(150,146,130,${0.08 + rr() * 0.16})`; L.alb.beginPath(); L.alb.ellipse(x, y, s * 1.4, s, rr() * 3, 0, TAU); L.alb.fill();
      L.met.fillStyle = g8(0.7); L.met.fillRect(x - s, y - s * 0.6, s * 2, s * 1.2);
    }
  }
  const decal = (ctx, cx, cy, rot180, fn, mirror = false) => { ctx.save(); ctx.translate(cx, cy); if (rot180) ctx.rotate(Math.PI); if (mirror) ctx.scale(-1, 1); fn(ctx); ctx.restore(); };

  // ======================= FUSELAGE / BOOM =======================
  {
    const r = RG.FUS;
    const pxU = r[2] / (FZ1 - FZ0);
    const circ = (z) => { const s = fusSt(z); return Math.PI * (s.w + (s.t + s.b) / 2) * 1.05; };
    const pvAt = (u) => r[3] / circ(FZ0 + u * (FZ1 - FZ0));
    const X = (z) => r[0] + (z - FZ0) * pxU;
    const Y = (a) => r[1] + a / TAU * r[3];
    camo(r, pxU, pvAt, 40, 7, true);
    mottle(r, 22, 6, 5);
    // panel tone patches
    const prng = makeRng(55);
    // dust underneath (bottom = rows 0 and 448)
    dust(r, r[1], r[1] + 95, 0.5); dust(r, r[1] + r[3], r[1] + r[3] - 95, 0.5);
    // belly hourglass (the widow's mark, seen from below) — wraps across the bottom seam
    for (const off of [0, r[3]]) { clip(L.alb, r); hourglass(L.alb, X(-1.2), r[1] + off, 1.9 * pxU, 0.95 * r[3] / circ(-1.2), 'rgb(140,24,16)'); L.alb.restore(); }
    // exhaust soot + oil streaks back along the boom (upper sides)
    for (const side of [1, -1]) {
      const a0 = side > 0 ? Math.PI * 0.72 : Math.PI * 1.28;
      const g = L.alb.createRadialGradient(X(2.7), Y(a0), 4, X(2.7), Y(a0), 90);
      g.addColorStop(0, 'rgba(18,15,12,0.75)'); g.addColorStop(1, 'rgba(18,15,12,0)');
      L.alb.fillStyle = g; L.alb.fillRect(X(2.7) - 90, Y(a0) - 90, 180, 180);
      for (let k = 0; k < 9; k++) {
        const y = Y(a0 + (prng() - 0.5) * 0.55), x0 = X(2.4 + prng() * 0.4), len = (1.2 + prng() * 3.2) * pxU, w = 1.5 + prng() * 3.5;
        const gg = L.alb.createLinearGradient(x0, 0, x0 + len, 0);
        gg.addColorStop(0, `rgba(20,17,12,${0.45 + prng() * 0.3})`); gg.addColorStop(1, 'rgba(20,17,12,0)');
        L.alb.fillStyle = gg; L.alb.fillRect(x0, y - w / 2, len, w);
        const gr = L.rgh.createLinearGradient(x0, 0, x0 + len, 0); gr.addColorStop(0, 'rgba(40,40,40,0.7)'); gr.addColorStop(1, 'rgba(40,40,40,0)');
        L.rgh.fillStyle = gr; L.rgh.fillRect(x0, y - w / 2, len, w);
      }
    }
    // access panels (subtle tone shifts)
    const panels = [
      [-4.75, -4.15, 0.25, 0.42], [-3.9, -3.0, 0.18, 0.36], [-0.9, 0.1, 0.24, 0.4], [0.3, 1.4, 0.22, 0.42], [2.9, 3.6, 0.3, 0.42], [4.6, 5.1, 0.32, 0.44], [7.0, 7.5, 0.3, 0.42],
      [-2.6, -1.4, 0.06, 0.16], [-0.5, 0.9, 0.04, 0.14], [3.2, 4.0, 0.06, 0.16],
    ];
    for (const [z0, z1, f0, f1] of panels) for (const side of [1, -1]) {
      const ya = side > 0 ? Y(f0 * TAU) : Y((1 - f1) * TAU), yb = side > 0 ? Y(f1 * TAU) : Y((1 - f0) * TAU);
      prect(X(z0), ya, X(z1) - X(z0), yb - ya, 7, (prng() - 0.5) * 0.12);
    }
    // top hump: engine/transmission deck panels + louvers
    prect(X(-0.9), Y(TAU * 0.44), X(1.3) - X(-0.9), Y(TAU * 0.56) - Y(TAU * 0.44), 7, 0.03);
    louvers(X(0.4), Y(TAU * 0.465), X(1.1) - X(0.4), Y(TAU * 0.535) - Y(TAU * 0.465), 7);
    // decals: big squadron number on the boom (both sides), small one on the nose
    const hb = 0.5 * r[3] / circ(4.3);
    decal(L.alb, X(4.35), Y(Math.PI / 2), true, (c) => { c.fillStyle = 'rgb(176,170,150)'; c.scale(1, hb / (0.5 * pxU)); stencilNumber(c, '13', 0, 0, 0.5 * pxU); });
    decal(L.alb, X(4.35), Y(Math.PI * 1.5), false, (c) => { c.fillStyle = 'rgb(176,170,150)'; c.scale(1, hb / (0.5 * pxU)); stencilNumber(c, '13', 0, 0, 0.5 * pxU); });
    // nose art: little widow + hourglass on both nose sides
    const hn = r[3] / circ(-4.3);
    for (const side of [1, -1]) decal(L.alb, X(-4.45), Y(side > 0 ? Math.PI * 0.42 : Math.PI * 1.58), side > 0, (c) => { c.scale(1, hn / pxU); drawEmblem(c, 0.19 * pxU); });
    // stencils (low-viz)
    for (const side of [1, -1]) {
      const rot = side > 0;
      decal(L.alb, X(-2.05), Y(side > 0 ? TAU * 0.205 : TAU * 0.795), rot, (c) => {
        c.scale(1, pvAt((-2.05 - FZ0) / (FZ1 - FZ0)) / pxU);
        c.fillStyle = 'rgba(24,24,20,0.8)'; c.strokeStyle = 'rgba(24,24,20,0.8)'; c.lineWidth = 2;
        c.strokeRect(-0.36 * pxU, -0.07 * pxU, 0.72 * pxU, 0.14 * pxU);
        text(c, 'RESCUE', -0.08 * pxU, 0, 0.1 * pxU, 'rgba(24,24,20,0.85)', { weight: 800 });
        c.beginPath(); c.moveTo(0.18 * pxU, -0.04 * pxU); c.lineTo(0.3 * pxU, 0); c.lineTo(0.18 * pxU, 0.04 * pxU); c.fill();
      });
      decal(L.alb, X(0.15), Y(side > 0 ? TAU * 0.4 : TAU * 0.6), rot, (c) => { text(c, 'NO STEP', 0, 0, 0.09 * pxU, 'rgba(22,22,18,0.8)', { weight: 800 }); });
      decal(L.alb, X(7.1), Y(side > 0 ? TAU * 0.27 : TAU * 0.73), rot, (c) => { c.scale(1, 2.2); text(c, 'DANGER  ROTOR', 0, 0, 0.07 * pxU, 'rgba(24,22,18,0.85)', { weight: 800 }); });
      decal(L.alb, X(5.6), Y(side > 0 ? TAU * 0.2 : TAU * 0.8), rot, (c) => { c.scale(1, 2.0); text(c, 'WM-13   87-0413', 0, 0, 0.06 * pxU, 'rgba(24,22,18,0.75)', { weight: 700 }); });
      decal(L.alb, X(-0.6), Y(side > 0 ? TAU * 0.16 : TAU * 0.84), rot, (c) => { text(c, 'JACK POINT', 0, 0, 0.06 * pxU, 'rgba(24,22,18,0.7)', { weight: 700 }); });
    }
    // panel lines: frames (constant z) and longerons (constant angle)
    for (const z of [-4.85, -4.12, -2.68, -1.25, -0.95, 0.15, 1.35, 2.25, 3.0, 3.9, 5.0, 5.9, ZBREAK, 7.2, 8.15]) pline(X(z), r[1], X(z), r[1] + r[3], 0);
    for (const f of [0.06, 0.16, 0.25, 0.36, 0.43]) for (const ff of [f, 1 - f]) pline(X(-4.85), Y(ff * TAU), X(8.6), Y(ff * TAU), 9);
    pline(X(-5.3), Y(0.5 * TAU), X(9.1), Y(0.5 * TAU), 0);
    chips(r, 900, 3);
    damageField(r, (u, v) => {
      const z = FZ0 + u * (FZ1 - FZ0), a = v * TAU;
      const near = Math.exp(-((z - 1.4) ** 2) / 4 - ((a - Math.PI * 0.62) ** 2) / 0.8); // right engine side burns first
      return -near * 0.55 + (z > 6 ? 0.1 : 0);
    }, 101);
  }

  // ======================= NACELLES =======================
  {
    const r = RG.NAC, pxU = r[2] / (NZ1 - NZ0);
    const X = (z) => r[0] + (z - NZ0) * pxU, Y = (a) => r[1] + a / TAU * r[3];
    camo(r, pxU, r[3] / 2.2, 6, 21, true);
    mottle(r, 6, 4, 6);
    dust(r, r[1], r[1] + 40, 0.35); dust(r, r[1] + r[3], r[1] + r[3] - 40, 0.35);
    // intake lip polished + soot at rear
    L.alb.fillStyle = 'rgb(70,72,70)'; L.alb.fillRect(X(NZ0), r[1], X(-0.42) - X(NZ0), r[3]);
    L.met.fillStyle = g8(0.75); L.met.fillRect(X(NZ0), r[1], X(-0.42) - X(NZ0), r[3]);
    L.rgh.fillStyle = g8(0.32); L.rgh.fillRect(X(NZ0), r[1], X(-0.42) - X(NZ0), r[3]);
    const g = L.alb.createLinearGradient(X(1.5), 0, X(NZ1), 0); g.addColorStop(0, 'rgba(20,16,12,0)'); g.addColorStop(1, 'rgba(20,16,12,0.85)');
    L.alb.fillStyle = g; L.alb.fillRect(X(1.5), r[1], X(NZ1) - X(1.5), r[3]);
    for (const z of [-0.3, 0.32, 1.4, 2.05]) pline(X(z), r[1], X(z), r[1] + r[3], 8);
    for (const f of [0.12, 0.38, 0.62, 0.88]) pline(X(-0.3), Y(f * TAU), X(2.05), Y(f * TAU), 9);
    for (const f of [0.5]) louvers(X(0.45), Y(f * TAU) - 18, X(1.2) - X(0.45), 36, 6);
    for (const f of [0.25, 0.75]) prect(X(0.32), Y((f - 0.09) * TAU), X(1.4) - X(0.32), Y(0.18 * TAU) - Y(0), 7, 0.04);
    decal(L.alb, X(-0.1), Y(0.5 * TAU), false, (c) => { c.rotate(Math.PI / 2); text(c, 'NO STEP', 0, 0, 13, 'rgba(22,22,18,0.8)'); });
    chips(r, 160, 4);
    damageField(r, (u, v) => -Math.exp(-((u - 0.55) ** 2) / 0.05) * 0.35, 102);
  }
  // ======================= SPONSONS =======================
  {
    const r = RG.SPON, pxU = r[2] / (SZ1 - SZ0);
    const X = (z) => r[0] + (z - SZ0) * pxU, Y = (a) => r[1] + a / TAU * r[3];
    camo(r, pxU, r[3] / 1.6, 5, 31, true); mottle(r, 6, 4, 7);
    dust(r, r[1], r[1] + 60, 0.55); dust(r, r[1] + r[3], r[1] + r[3] - 60, 0.55);
    for (const z of [-1.5, -0.4, 0.7, 1.4]) pline(X(z), r[1], X(z), r[1] + r[3], 8);
    for (const f of [0.15, 0.35, 0.65, 0.85]) pline(X(-1.5), Y(f * TAU), X(1.4), Y(f * TAU), 9);
    prect(X(-1.35), Y(0.18 * TAU), X(-0.55) - X(-1.35), 0.14 * r[3], 7, 0.05);
    prect(X(-1.35), Y(0.68 * TAU), X(-0.55) - X(-1.35), 0.14 * r[3], 7, 0.05);
    chips(r, 160, 5);
    damageField(r, () => 0, 103);
  }
  // ======================= EXHAUST (u: outer -> inner soot) =======================
  {
    const r = RG.EXH;
    const g = L.alb.createLinearGradient(r[0], 0, r[0] + r[2], 0);
    g.addColorStop(0, 'rgb(64,64,58)'); g.addColorStop(0.45, 'rgb(34,30,26)'); g.addColorStop(0.6, 'rgb(22,18,15)'); g.addColorStop(1, 'rgb(14,11,9)');
    L.alb.fillStyle = g; L.alb.fillRect(...r);
    L.rgh.fillStyle = g8(0.85); L.rgh.fillRect(...r); L.met.fillStyle = g8(0.4); L.met.fillRect(...r);
    // heat glow deep inside
    const ge = L.alb.createLinearGradient(r[0] + r[2] * 0.75, 0, r[0] + r[2], 0); ge.addColorStop(0, 'rgba(255,110,30,0)'); ge.addColorStop(1, 'rgba(255,120,40,1)');
    L.alb.fillStyle = ge; L.alb.fillRect(r[0] + r[2] * 0.75, r[1], r[2] * 0.25, r[3]);
    const gm = L.emi.createLinearGradient(r[0] + r[2] * 0.75, 0, r[0] + r[2], 0); gm.addColorStop(0, 'rgb(0,0,0)'); gm.addColorStop(1, g8(0.2));
    L.emi.fillStyle = gm; L.emi.fillRect(r[0] + r[2] * 0.75, r[1], r[2] * 0.25, r[3]);
  }
  // ======================= ENGINE GUTS (exposed when the panel blows) =======================
  {
    const r = RG.GUTS;
    L.alb.fillStyle = 'rgb(30,28,25)'; L.alb.fillRect(...r);
    for (let k = 0; k < 6; k++) { L.alb.fillStyle = 'rgb(70,66,58)'; L.alb.fillRect(r[0] + 8 + k * 20, r[1], 5, r[3]); }
    for (let k = 0; k < 3; k++) {
      const y = r[1] + 18 + k * 28, g = L.alb.createLinearGradient(0, y - 7, 0, y + 7);
      g.addColorStop(0, 'rgb(40,38,34)'); g.addColorStop(0.5, 'rgb(120,112,96)'); g.addColorStop(1, 'rgb(30,28,24)');
      L.alb.fillStyle = g; L.alb.fillRect(r[0], y - 7, r[2], 14);
    }
    // hot glow spots
    for (const [x, y, s] of [[0.35, 0.5, 26], [0.7, 0.3, 18], [0.6, 0.75, 16]]) {
      const cx = r[0] + x * r[2], cy = r[1] + y * r[3];
      const g = L.alb.createRadialGradient(cx, cy, 1, cx, cy, s); g.addColorStop(0, 'rgba(255,170,60,1)'); g.addColorStop(1, 'rgba(255,90,20,0)');
      L.alb.fillStyle = g; L.alb.fillRect(cx - s, cy - s, 2 * s, 2 * s);
      const ge = L.emi.createRadialGradient(cx, cy, 1, cx, cy, s); ge.addColorStop(0, g8(0.5)); ge.addColorStop(1, 'rgba(0,0,0,0)');
      L.emi.fillStyle = ge; L.emi.fillRect(cx - s, cy - s, 2 * s, 2 * s);
    }
    L.rgh.fillStyle = g8(0.6); L.rgh.fillRect(...r); L.met.fillStyle = g8(0.6); L.met.fillRect(...r);
  }
  // ======================= WINGS (u: span root->tip, v: around section) =======================
  for (const [key, mirror] of [['WING_R', false], ['WING_L', true]]) {
    const r = RG[key];
    camo(r, r[2] / 2.6, r[3] / 2.0, 5, mirror ? 41 : 41, true);
    mottle(r, 5, 4, 8);
    dust(r, r[1], r[1] + 40, 0.5); dust(r, r[1] + r[3], r[1] + r[3] - 40, 0.5);
    clip(L.alb, r); clip(L.hgt, r);
    const tf = (c) => { c.translate(r[0] + r[2] / 2, 0); if (mirror) c.scale(-1, 1); c.translate(-(r[0] + r[2] / 2), 0); };
    L.alb.save(); tf(L.alb); L.hgt.save(); tf(L.hgt);
    // walkway + NO STEP on top (top surface rows around v=0.5)
    const yTop = r[1] + r[3] * 0.5;
    L.alb.fillStyle = 'rgba(40,42,40,0.55)'; L.alb.fillRect(r[0] + 8, yTop - 16, 60, 32);
    text(L.alb, 'NO STEP', r[0] + 150, yTop, 15, 'rgba(22,22,18,0.85)', { weight: 800 });
    for (const x of [0.32, 0.62]) pline(r[0] + x * r[2], r[1], r[0] + x * r[2], r[1] + r[3], 7);
    for (const f of [0.25, 0.4, 0.6, 0.75]) pline(r[0] + 4, r[1] + f * r[3], r[0] + r[2] - 4, r[1] + f * r[3], 8);
    L.alb.restore(); L.hgt.restore(); L.alb.restore(); L.hgt.restore();
    chips(r, 120, mirror ? 8 : 9);
    damageField(r, () => 0.05, mirror ? 104 : 105);
  }
  // ======================= FIN (planar z/y; right side mirrored) =======================
  for (const [key, mirror] of [['FIN_R', true], ['FIN_L', false]]) {
    const r = RG[key];
    const pxm = r[2] / (FIN_Z1 - FIN_Z0);
    camo(r, pxm, pxm, 5, 51, false);
    mottle(r, 5, 6, 9);
    const X = (z) => r[0] + (z - FIN_Z0) * pxm, Y = (y) => r[1] + (FIN_Y1 - y) * pxm;
    clip(L.alb, r); clip(L.hgt, r);
    const tf = (c) => { c.translate(r[0] + r[2] / 2, 0); if (mirror) c.scale(-1, 1); c.translate(-(r[0] + r[2] / 2), 0); };
    L.alb.save(); tf(L.alb); L.hgt.save(); tf(L.hgt);
    // drawn in "left side" orientation: x = z (nose to the left)
    L.alb.save(); L.alb.translate(X(8.95), Y(1.35)); drawEmblem(L.alb, 0.42 * pxm); L.alb.restore();
    L.alb.fillStyle = 'rgb(176,170,150)'; stencilNumber(L.alb, '13', X(9.05), Y(0.78), 0.32 * pxm);
    text(L.alb, 'DANGER', X(8.9), Y(2.55), 0.09 * pxm, 'rgba(22,20,16,0.85)', { weight: 800 });
    for (const y of [0.6, 2.35]) pline(r[0], Y(y), r[0] + r[2], Y(y), 7);
    for (const z of [8.2, 9.45]) pline(X(z), r[1], X(z), r[1] + r[3], 7);
    L.alb.restore(); L.hgt.restore(); L.alb.restore(); L.hgt.restore();
    chips(r, 120, mirror ? 10 : 11);
    damageField(r, () => 0.1, 106);
  }
  // ======================= STABILISER =======================
  { const r = RG.STAB; camo(r, r[2] / 3.2, r[3] / 1.4, 5, 61, true); mottle(r, 6, 3, 10); for (const f of [0.25, 0.75]) pline(r[0], r[1] + f * r[3], r[0] + r[2], r[1] + f * r[3], 8); chips(r, 80, 12); damageField(r, () => 0.1, 107); }
  // ======================= ROCKET POD (cylinder uv: u around, v along) =======================
  {
    const r = RG.POD;
    L.alb.fillStyle = 'rgb(84,88,68)'; L.alb.fillRect(...r); mottle(r, 4, 3, 11);
    dust(r, r[1] + r[3] * 0.25, r[1] + r[3] * 0.25 - 30, 0.3);
    for (const f of [0.08, 0.92]) { L.alb.fillStyle = 'rgb(46,48,46)'; L.alb.fillRect(r[0], r[1] + f * r[3] - 6, r[2], 12); }
    L.alb.fillStyle = 'rgba(160,140,60,0.8)'; L.alb.fillRect(r[0], r[1] + 0.2 * r[3], r[2], 5);
    for (const f of [0.2, 0.5, 0.8]) pline(r[0], r[1] + f * r[3], r[0] + r[2], r[1] + f * r[3], 6);
    text(L.alb, 'RKT  2.75', r[0] + r[2] * 0.25, r[1] + r[3] * 0.4, 12, 'rgba(20,20,16,0.85)', { weight: 800 });
    text(L.alb, 'RKT  2.75', r[0] + r[2] * 0.75, r[1] + r[3] * 0.4, 12, 'rgba(20,20,16,0.85)', { weight: 800 });
    chips(r, 60, 13);
    damageField(r, () => 0.1, 108);
  }
  // ======================= MISSILE =======================
  {
    const r = RG.MISS;
    L.alb.fillStyle = 'rgb(98,102,86)'; L.alb.fillRect(...r);
    L.alb.fillStyle = 'rgb(160,140,58)'; L.alb.fillRect(r[0], r[1] + r[3] * 0.18, r[2], 5);
    L.alb.fillStyle = 'rgb(40,40,38)'; L.alb.fillRect(r[0], r[1] + r[3] * 0.85, r[2], 6);
    text(L.alb, 'AGM', r[0] + r[2] * 0.3, r[1] + r[3] * 0.5, 10, 'rgba(20,20,16,0.8)');
    damageField(r, () => 0.2, 109);
  }
  // ======================= ROTOR BLADES (u: radius 0..R, v around airfoil; LE at v=.25) =======================
  {
    const r = RG.BLADE, X = (rr) => r[0] + rr / 7.1 * r[2];
    L.alb.fillStyle = 'rgb(58,61,60)'; L.alb.fillRect(...r);
    mottle(r, 10, 2, 12);
    L.alb.fillStyle = 'rgb(70,72,72)'; L.alb.fillRect(r[0], r[1], X(1.0) - r[0], r[3]);
    L.met.fillStyle = g8(0.7); L.met.fillRect(r[0], r[1], X(1.0) - r[0], r[3]);
    L.alb.fillStyle = 'rgb(186,180,160)'; L.alb.fillRect(X(6.45), r[1], X(6.75) - X(6.45), r[3]); // tip stripe
    L.alb.fillStyle = 'rgb(120,122,120)'; L.alb.fillRect(X(1.0), r[1] + r[3] * 0.2, r[2], r[3] * 0.1); // LE erosion strip
    L.met.fillStyle = g8(0.9); L.met.fillRect(X(1.0), r[1] + r[3] * 0.2, r[2], r[3] * 0.1);
    L.rgh.fillStyle = g8(0.3); L.rgh.fillRect(X(1.0), r[1] + r[3] * 0.2, r[2], r[3] * 0.1);
    for (const rr of [2.2, 3.6, 5.0]) pline(X(rr), r[1], X(rr), r[1] + r[3], 0);
  }
  {
    const r = RG.TBLADE;
    L.alb.fillStyle = 'rgb(58,61,60)'; L.alb.fillRect(...r);
    L.alb.fillStyle = 'rgb(186,180,160)'; L.alb.fillRect(r[0] + r[2] * 0.82, r[1], r[2] * 0.1, r[3]);
    L.alb.fillStyle = 'rgb(70,72,72)'; L.alb.fillRect(r[0], r[1], r[2] * 0.18, r[3]);
  }
  // ======================= SWATCHES =======================
  for (const name of SW_ORDER) {
    const [c, ro, me, em] = SWATCH[name], [x, y, w, h] = swatchRect(name);
    L.alb.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; L.alb.fillRect(x, y, w, h);
    L.rgh.fillStyle = g8(ro); L.rgh.fillRect(x, y, w, h);
    L.met.fillStyle = g8(me); L.met.fillRect(x, y, w, h);
    L.emi.fillStyle = g8(em); L.emi.fillRect(x, y, w, h);
    L.hgt.fillStyle = g8(0.5); L.hgt.fillRect(x, y, w, h);
    L.dmg.fillStyle = g8(name === 'olive' || name === 'char' ? 0.55 : name === 'gun' || name === 'hub' || name === 'frame' ? 0.75 : 1); L.dmg.fillRect(x, y, w, h);
  }
  // hull swatches get a bit of mottling so plain parts aren't flat
  // ------------------ pack textures ------------------
  const albTex = new THREE.CanvasTexture(L.alb.canvas_);
  albTex.colorSpace = THREE.SRGBColorSpace; albTex.anisotropy = 8;
  // normal map from height
  const hd = L.hgt.getImageData(0, 0, TW, TH).data;
  const ncv = mkCanvas(TW, TH), nctx = ncv.getContext('2d'), nimg = nctx.createImageData(TW, TH), nd = nimg.data;
  const S = 2.2;
  for (let y = 0; y < TH; y++) {
    const y0 = y > 0 ? y - 1 : y, y1 = y < TH - 1 ? y + 1 : y;
    for (let x = 0; x < TW; x++) {
      const x0 = x > 0 ? x - 1 : x, x1 = x < TW - 1 ? x + 1 : x;
      const nx = (hd[(y * TW + x0) * 4] - hd[(y * TW + x1) * 4]) / 255 * S;
      const ny = (hd[(y1 * TW + x) * 4] - hd[(y0 * TW + x) * 4]) / 255 * S;
      const il = 1 / Math.sqrt(nx * nx + ny * ny + 1), k = (y * TW + x) * 4;
      nd[k] = (nx * il * 0.5 + 0.5) * 255; nd[k + 1] = (ny * il * 0.5 + 0.5) * 255; nd[k + 2] = (il * 0.5 + 0.5) * 255; nd[k + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  const nrmTex = new THREE.CanvasTexture(ncv); nrmTex.anisotropy = 8;
  // ORM-ish pack (R = damage threshold, G = roughness, B = metalness, A = emissive mask), rows flipped for DataTexture
  const dd = L.dmg.getImageData(0, 0, TW, TH).data, rd = L.rgh.getImageData(0, 0, TW, TH).data, md = L.met.getImageData(0, 0, TW, TH).data, ed = L.emi.getImageData(0, 0, TW, TH).data;
  const orm = new Uint8Array(TW * TH * 4);
  for (let y = 0; y < TH; y++) {
    const src = y * TW * 4, dst = (TH - 1 - y) * TW * 4;
    for (let x = 0; x < TW * 4; x += 4) { orm[dst + x] = dd[src + x]; orm[dst + x + 1] = rd[src + x]; orm[dst + x + 2] = md[src + x]; orm[dst + x + 3] = ed[src + x]; }
  }
  const ormTex = new THREE.DataTexture(orm, TW, TH, THREE.RGBAFormat);
  ormTex.magFilter = THREE.LinearFilter; ormTex.minFilter = THREE.LinearMipmapLinearFilter; ormTex.generateMipmaps = true; ormTex.anisotropy = 8; ormTex.needsUpdate = true;
  return { albTex, nrmTex, ormTex, debugCanvas: L.alb.canvas_ };
}

// rotor blur strip: u = radius (0..1), v = angle (wraps)
function blurTexture() {
  const W = 256, H = 128, c = mkCanvas(W, H), x = c.getContext('2d');
  const img = x.createImageData(W, H), d = img.data;
  const rng = makeRng(808);
  const streak = new Float32Array(H);
  for (let j = 0; j < H; j++) { // 4 blade smears with a sharp leading edge
    const ph = (j / H * 4) % 1;
    streak[j] = Math.exp(-ph * 5.5) * 0.9 + 0.1 + (rng() - 0.5) * 0.06;
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const r = i / (W - 1);
    let a = r < 0.1 ? 0 : Math.min(1, (r - 0.1) / 0.25) * (0.2 + 0.2 * r);
    a *= 0.6 + 0.55 * streak[j];
    let col = [58, 42, 32];
    if (r > 0.905 && r < 0.95) { a = a * 0.8 + 0.04 * streak[j]; col = [70, 69, 62]; }
    if (r > 0.985) a *= Math.max(0, (1 - r) / 0.015);
    const k = (j * W + i) * 4;
    d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = Math.max(0, Math.min(255, a * 255));
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}

// ===================================================================== MODEL
let CACHE = null;
const U = {
  uDamage: { value: 0 },
  uTurR: { value: new THREE.Matrix3() }, uTurP: { value: TURRET_P.clone() },
  uSenR: { value: new THREE.Matrix3() }, uSenP: { value: SENSOR_P.clone() },
  uBarP: { value: BARREL_AXIS.clone() }, uSpin: { value: 0 },
};

function hullMaterial(tex) {
  const m = new THREE.MeshStandardMaterial({ map: tex.albTex, normalMap: tex.nrmTex, normalScale: new THREE.Vector2(0.9, 0.9), roughnessMap: tex.ormTex, metalnessMap: tex.ormTex, roughness: 1, metalness: 1, envMapIntensity: 1.45 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPart;
uniform mat3 uTurR; uniform vec3 uTurP; uniform mat3 uSenR; uniform vec3 uSenP; uniform vec3 uBarP; uniform float uSpin;
vec3 heliRig(vec3 p, float w) {
  if (aPart > 2.5) return uSenR * (p - uSenP * w) + uSenP * w;
  if (aPart > 0.5) {
    if (aPart > 1.5) { float c = cos(uSpin), s = sin(uSpin); vec3 q = p - uBarP * w; q.xy = mat2(c, s, -s, c) * q.xy; p = q + uBarP * w; }
    return uTurR * (p - uTurP * w) + uTurP * w;
  }
  return p;
}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = heliRig(objectNormal, 0.0);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = heliRig(transformed, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDamage;')
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
vec4 hOrm = texture2D(roughnessMap, vRoughnessMapUv);
float hD = uDamage - hOrm.r;
float hBurn = smoothstep(-0.02, 0.1, hD);
float hEdge = smoothstep(-0.015, 0.0, hD) * (1.0 - smoothstep(0.0, 0.025, hD));
vec3 hScorch = mix(vec3(0.075, 0.045, 0.022), vec3(0.012, 0.010, 0.009), smoothstep(0.02, 0.16, hD));
diffuseColor.rgb = mix(diffuseColor.rgb, hScorch, hBurn * step(hOrm.r, 0.985));
roughnessFactor = mix(roughnessFactor, 0.92, hBurn);
metalnessFactor = mix(metalnessFactor, 0.05, hBurn);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += diffuseColor.rgb * hOrm.a * 3.5 + vec3(1.6, 0.42, 0.06) * hEdge * smoothstep(0.45, 0.7, uDamage) * smoothstep(0.55, 0.3, hOrm.r) * 0.6;`);
  };
  m.customProgramCacheKey = () => 'heliHull1';
  return m;
}

function buildGeometry() {
  const hull = [], glass = [], tail = [], panel = [], rot = [], trot = [];
  const H = (g, part = 0) => hull.push(finish(g, part));

  // -------------------- fuselage loft --------------------
  const FK = [
    [-5.3, 0.04, 0.04, 0.04, -0.34, 2.4, 0],
    [-5.22, 0.17, 0.13, 0.2, -0.34, 2.6, 0.1],
    [-5.02, 0.3, 0.22, 0.36, -0.31, 2.9, 0.2],
    [-4.7, 0.42, 0.32, 0.5, -0.27, 3.1, 0.28],
    [-4.35, 0.5, 0.39, 0.6, -0.22, 3.2, 0.3],
    [-3.6, 0.55, 0.42, 0.68, -0.18, 3.3, 0.32],
    [-2.8, 0.58, 0.45, 0.72, -0.16, 3.3, 0.32],
    [-2.0, 0.6, 0.48, 0.74, -0.14, 3.3, 0.32],
    [-1.45, 0.63, 0.54, 0.75, -0.12, 3.2, 0.34],
    [-1.12, 0.67, 1.03, 0.75, -0.1, 3.1, 0.5],
    [-0.4, 0.72, 1.14, 0.73, -0.08, 3.1, 0.54],
    [0.6, 0.72, 1.1, 0.68, -0.06, 3.1, 0.54],
    [1.6, 0.62, 0.96, 0.58, 0.0, 2.9, 0.48],
    [2.5, 0.45, 0.66, 0.42, 0.12, 2.7, 0.35],
    [3.4, 0.34, 0.47, 0.31, 0.24, 2.6, 0.25],
    [5.5, 0.26, 0.34, 0.24, 0.34, 2.5, 0.18],
    [7.5, 0.2, 0.27, 0.19, 0.41, 2.4, 0.12],
    [8.6, 0.16, 0.22, 0.15, 0.45, 2.3, 0.1],
    [8.95, 0.1, 0.15, 0.1, 0.47, 2.2, 0.05],
    [9.1, 0.03, 0.04, 0.03, 0.48, 2.2, 0],
  ];
  const fusSt = stationFn(FK);
  const fzs = zList(FZ0, FZ1, FK.map(k => k[0]), 0.2);
  const SEG = 28;
  const fusUV = (st, i, a) => [RG.FUS[0] + (st.z - FZ0) / (FZ1 - FZ0) * RG.FUS[2], RG.FUS[1] + a / TAU * RG.FUS[3]];
  const zsA = fzs.filter(z => z <= ZBREAK); if (zsA[zsA.length - 1] < ZBREAK) zsA.push(ZBREAK);
  const zsB = [ZBREAK, ...fzs.filter(z => z > ZBREAK + 1e-4)];
  const fusA = loft(zsA.map(fusSt), SEG, fusUV);
  H(fusA.main);
  H(capFan(fusSt(ZBREAK), SEG, 1, 0.985, 'guts'));
  const fusB = loft(zsB.map(fusSt), SEG, fusUV);
  tail.push(finish(fusB.main), finish(capFan(fusSt(ZBREAK), SEG, -1, 0.985, 'guts')));

  // -------------------- canopy (faceted, stepped tandem) --------------------
  const CK = [ // z, sill y, top y
    [-4.42, 0.15, 0.17], [-3.98, 0.22, 0.66], [-3.05, 0.27, 0.75], [-2.74, 0.28, 0.77],
    [-2.62, 0.29, 1.0], [-2.42, 0.31, 1.12], [-1.55, 0.36, 1.15], [-1.2, 0.43, 1.03],
  ];
  const cProf = (k) => {
    const [z, y0, y1] = k, w = ringXAtY(fusSt(z), y0) + 0.005, h = y1 - y0;
    return [[w, y0], [w * 0.95, y0 + h * 0.6], [w * 0.5, y1], [-w * 0.5, y1], [-w * 0.95, y0 + h * 0.6], [-w, y0]].map(p => new THREE.Vector3(p[0], p[1], z));
  };
  const CP = CK.map(cProf);
  {
    const pos = [], nrm = [];
    for (let i = 0; i < CP.length - 1; i++) for (let j = 0; j < 5; j++) {
      const A = CP[i][j], B = CP[i][j + 1], C = CP[i + 1][j], D = CP[i + 1][j + 1];
      // winding: profile goes right->left over the top (CCW seen from +z), so (A,B,C) faces outward
      const n = new THREE.Vector3().subVectors(B, C).cross(new THREE.Vector3().subVectors(D, A)).normalize();
      if (n.lengthSq() < 0.5) continue;
      for (const P of [A, B, C, B, D, C]) { pos.push(P.x, P.y, P.z); nrm.push(n.x, n.y, n.z); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    glass.push(finish(g));
    // rear bulkhead of canopy (opaque)
    const last = CP[CP.length - 1], bp = [];
    for (let j = 0; j < 5; j++) bp.push(last[j].x, last[j].y, last[j].z, last[j + 1].x, last[j + 1].y, last[j + 1].z, 0, last[0].y, last[0].z);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.computeVertexNormals();
    H(sw(bg, 'char'));
    // frames: every station ring + longitudinal edges
    const fw = 0.055, ft = 0.03;
    for (let i = 0; i < CP.length; i++) {
      if (i === 0) continue;
      for (let j = 0; j < 5; j++) {
        const a = CP[i][j], b = CP[i][j + 1];
        if (a.distanceTo(b) < 0.02) continue;
        const out = new THREE.Vector3(a.x + b.x, a.y + b.y - 2 * (CK[i][1] - 0.1), 0).normalize();
        H(sw(strut(a.clone().addScaledVector(out, 0.012), b.clone().addScaledVector(out, 0.012), i === 4 || i === CP.length - 1 ? 0.09 : fw, ft, out), 'frame'));
      }
    }
    for (let j = 0; j <= 5; j++) for (let i = 0; i < CP.length - 1; i++) {
      const a = CP[i][j], b = CP[i + 1][j];
      if (a.distanceTo(b) < 0.02) continue;
      const out = new THREE.Vector3(a.x, a.y - 0.1, 0).normalize();
      H(sw(strut(a.clone().addScaledVector(out, 0.012), b.clone().addScaledVector(out, 0.012), j === 0 || j === 5 ? 0.075 : fw, ft, out), 'frame'));
    }
    // wire cutter above the pilot windscreen + below the nose
    H(sw(strut(new THREE.Vector3(0, 1.12, -2.45), new THREE.Vector3(0, 1.3, -2.25), 0.025, 0.08), 'gun'));
  }

  // -------------------- sponsons (cheek fairings) --------------------
  for (const sx of [1, -1]) {
    const SK = [
      [SZ0, 0.02, 0.04, 0.04, -0.12, 2.5, 0, sx * 0.55],
      [-1.75, 0.16, 0.22, 0.24, -0.12, 3.0, 0, sx * 0.62],
      [-1.4, 0.24, 0.3, 0.3, -0.1, 3.4, 0, sx * 0.66],
      [0.9, 0.24, 0.3, 0.3, -0.06, 3.4, 0, sx * 0.68],
      [1.45, 0.17, 0.24, 0.24, -0.04, 3.0, 0, sx * 0.64],
      [SZ1, 0.03, 0.06, 0.06, -0.02, 2.5, 0, sx * 0.58],
    ];
    const sf = stationFn(SK);
    const sp = loft(zList(SZ0, SZ1, SK.map(k => k[0]), 0.25).map(sf), 16, (st, i, a) => [RG.SPON[0] + (st.z - SZ0) / (SZ1 - SZ0) * RG.SPON[2], RG.SPON[1] + a / TAU * RG.SPON[3]]);
    H(sp.main);
  }

  // -------------------- engine nacelles (+ blow-off panel on the right) --------------------
  const NK = (sx) => [
    [NZ0, 0.25, 0.26, 0.26, 0.78, 2.2, 0, sx * 0.9],
    [-0.56, 0.31, 0.32, 0.32, 0.78, 2.3, 0, sx * 0.9],
    [-0.4, 0.35, 0.36, 0.36, 0.78, 2.4, 0, sx * 0.9],
    [0.4, 0.37, 0.38, 0.37, 0.79, 2.5, 0, sx * 0.9],
    [1.6, 0.36, 0.37, 0.35, 0.8, 2.5, 0, sx * 0.88],
    [2.2, 0.3, 0.31, 0.29, 0.8, 2.4, 0, sx * 0.86],
    [NZ1, 0.2, 0.21, 0.2, 0.8, 2.2, 0, sx * 0.85],
  ];
  let sparkLocal = null;
  for (const sx of [1, -1]) {
    const nk = NK(sx), nf = stationFn(nk);
    const zs = zList(NZ0, NZ1, nk.map(k => k[0]), 0.16);
    const nuv = (st, i, a) => [RG.NAC[0] + (st.z - NZ0) / (NZ1 - NZ0) * RG.NAC[2], RG.NAC[1] + a / TAU * RG.NAC[3]];
    const SEGN = 20;
    let hole = null;
    if (sx > 0) {
      const i0 = zs.findIndex(z => z >= 0.32), i1 = zs.findIndex(z => z >= 1.4);
      hole = { i0, i1, j0: 5, j1: 9, depth: 0.78 };
    }
    const nl = loft(zs.map(nf), SEGN, nuv, hole);
    H(nl.main);
    if (hole) { panel.push(finish(nl.panel)); H(nl.cavity); sparkLocal = nl.holeCenter.clone().addScaledVector(nl.holeNormal, 0.05); }
    // intake: dark throat + spinner
    const st0 = nf(NZ0);
    H(capFan({ ...st0, z: -0.45 }, 16, -1, 0.95, 'soot'));
    const spin = new THREE.ConeGeometry(0.13, 0.28, 12); spin.rotateX(-Math.PI / 2); H(sw(xf(spin, sx * 0.9, 0.78, -0.55), 'hub'));
    // intake lip ring
    const lip = new THREE.TorusGeometry(0.26, 0.035, 6, 20); H(sw(xf(lip, sx * 0.9, 0.78, NZ0 + 0.01), 'hub'));
    // exhaust shroud: bends outward + down, sooty, with a deep inner sleeve
    const EK = [
      [2.3, 0.22, 0.2, 0.2, 0.8, 3.0, 0, sx * 0.85],
      [2.6, 0.24, 0.2, 0.2, 0.76, 3.2, 0, sx * 0.98],
      [2.9, 0.25, 0.19, 0.19, 0.7, 3.4, 0, sx * 1.16],
    ];
    const ef = stationFn(EK);
    const est = [ef(2.3), ef(2.45), ef(2.6), ef(2.75), ef(2.9)];
    const lipIn = { ...ef(2.9), w: 0.2, t: 0.15, b: 0.15, z: 2.86 }, deep = { ...ef(2.9), w: 0.17, t: 0.12, b: 0.12, z: 2.45 };
    const allE = [...est, lipIn, deep];
    const exl = loft(allE, 14, (st, i, a) => [RG.EXH[0] + 4 + (i / (allE.length - 1)) * (RG.EXH[2] - 8), RG.EXH[1] + a / TAU * RG.EXH[3]]);
    H(exl.main);
    H(capFan(deep, 14, 1, 1, 'heat'));
    // pylon fairing between nacelle and fuselage
    H(sw(xf(box(0.32, 0.12, 1.9), sx * 0.62, 0.62, 0.8), 'olive'));
  }

  // -------------------- stub wings, pylons, rocket pods, missile rails --------------------
  const wingY = 0.12, wingZ = -0.15;
  const pods = [], navPts = [];
  for (const sx of [1, -1]) {
    const WK = [
      [0.55, 0.52, 0.07, 0.06, 0, 2.6, 0],
      [0.8, 0.52, 0.075, 0.065, 0, 2.6, 0],
      [3.0, 0.42, 0.06, 0.05, 0, 2.6, 0],
      [3.18, 0.4, 0.04, 0.035, 0, 2.4, 0],
      [3.22, 0.3, 0.015, 0.015, 0, 2.2, 0],
    ];
    const wf = stationFn(WK);
    const key = sx > 0 ? 'WING_R' : 'WING_L';
    const wl = loft(zList(0.55, 3.22, WK.map(k => k[0]), 0.35).map(wf), 16, (st, i, a) => [RG[key][0] + (st.z - 0.55) / 2.67 * RG[key][2], RG[key][1] + a / TAU * RG[key][3]]);
    let g = wl.main; g.rotateY(Math.PI / 2);
    // anhedral
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.06));
    g.translate(0, wingY, wingZ);
    g = finish(g);
    if (sx < 0) { g = mirrorX(g); }
    hull.push(g);
    const wy = (x) => wingY - Math.sin(0.06) * Math.abs(x);
    // wingtip nav light housing
    const tipX = sx * 3.24;
    const lens = new THREE.SphereGeometry(0.06, 10, 6); H(sw(xf(lens, tipX, wy(3.24), wingZ - 0.08), sx > 0 ? 'lensG' : 'lensR'));
    navPts.push([tipX, wy(3.24), wingZ - 0.08, sx > 0 ? [0.2, 3, 0.45, 0] : [3, 0.2, 0.1, 0]]);
    // pylons
    for (const px of [1.55, 2.6]) {
      const pyl = box(0.1, 0.32, 0.7); H(sw(xf(pyl, sx * px, wy(px) - 0.18, wingZ + 0.02), 'char'));
      H(sw(xf(box(0.14, 0.05, 0.5), sx * px, wy(px) - 0.34, wingZ), 'gun'));
    }
    // rocket pod (inner): 7 tubes, visible rocket noses
    {
      const px = sx * 1.55, py = wy(1.55) - 0.6, pz = wingZ, len = 1.55, rr = 0.25;
      const body = new THREE.CylinderGeometry(rr, rr, len, 18, 1, true); body.rotateX(Math.PI / 2); remap(body, RG.POD); H(xf(body, px, py, pz));
      // front & rear fairings (truncated cones)
      const ff = new THREE.CylinderGeometry(rr * 0.92, rr, 0.08, 18, 1, true); ff.rotateX(-Math.PI / 2); H(sw(xf(ff, px, py, pz - len / 2 - 0.04), 'char'));
      const rf = new THREE.CylinderGeometry(rr, rr * 0.55, 0.32, 18, 1, false); rf.rotateX(-Math.PI / 2); H(sw(xf(rf, px, py, pz + len / 2 + 0.16), 'char'));
      const face = new THREE.CircleGeometry(rr * 0.92, 18); face.rotateY(Math.PI); H(sw(xf(face, px, py, pz - len / 2 - 0.06), 'tube'));
      const tubes = [[0, 0]]; for (let k = 0; k < 6; k++) tubes.push([Math.cos(k / 6 * TAU) * 0.145, Math.sin(k / 6 * TAU) * 0.145]);
      for (const [tx, ty] of tubes) {
        const t = new THREE.CylinderGeometry(0.055, 0.055, 0.1, 10, 1, true); t.rotateX(Math.PI / 2); H(sw(xf(t, px + tx, py + ty, pz - len / 2 - 0.05), 'hub'));
        const nose = new THREE.ConeGeometry(0.042, 0.13, 8); nose.rotateX(-Math.PI / 2); H(sw(xf(nose, px + tx, py + ty, pz - len / 2 - 0.02), 'rnose'));
      }
      const o = new THREE.Object3D(); o.position.set(px, py, pz - len / 2 - 0.15); pods.push(o);
    }
    // missile launcher (outer): rail beam + 4 missiles
    {
      const px = sx * 2.6, py = wy(2.6) - 0.58, pz = wingZ - 0.05;
      H(sw(xf(box(0.08, 0.5, 1.2), px, py, pz + 0.1), 'char'));
      H(sw(xf(box(0.5, 0.06, 1.1), px, py, pz + 0.1), 'char'));
      for (const [mx, my] of [[-0.17, 0.15], [0.17, 0.15], [-0.17, -0.15], [0.17, -0.15]]) {
        const cx = px + mx, cy = py + my;
        const b = new THREE.CylinderGeometry(0.085, 0.085, 1.45, 10, 1, true); b.rotateX(Math.PI / 2); remap(b, RG.MISS); H(xf(b, cx, cy, pz));
        const n = new THREE.SphereGeometry(0.085, 10, 5, 0, TAU, 0, Math.PI / 2); n.rotateX(-Math.PI / 2); H(sw(xf(n, cx, cy, pz - 0.725, 0, 0, 0, 1, 1, 1.4), 'seeker'));
        for (let k = 0; k < 4; k++) {
          const a = k / 4 * TAU + Math.PI / 4, f = box(0.006, 0.09, 0.2); f.translate(0, 0.12, 0); f.rotateZ(a);
          H(sw(xf(f, cx, cy, pz + 0.55), 'missile'));
          const c = box(0.006, 0.05, 0.12); c.translate(0, 0.1, 0); c.rotateZ(a); H(sw(xf(c, cx, cy, pz - 0.45), 'missile'));
        }
      }
    }
  }

  // -------------------- tail: fin, stabiliser, gearbox, skid, tail wheel --------------------
  {
    const s = new THREE.Shape();
    s.moveTo(7.75, 0.4); s.lineTo(8.25, 0.62); s.lineTo(9.05, 2.6); s.quadraticCurveTo(9.18, 2.85, 9.45, 2.86); s.lineTo(9.62, 2.82);
    s.lineTo(9.48, 1.55); s.lineTo(9.36, 0.75); s.lineTo(9.15, 0.42); s.lineTo(7.75, 0.4);
    const fin = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6 });
    fin.translate(0, 0, -0.05);
    fin.rotateY(-Math.PI / 2);
    let g = fin.index ? fin.toNonIndexed() : fin; g.computeVertexNormals();
    // planar uv by side
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let t = 0; t < p.count; t += 3) {
      const nx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
      const rr = nx >= 0 ? RG.FIN_R : RG.FIN_L;
      for (let k = 0; k < 3; k++) {
        const z = p.getZ(t + k), y = p.getY(t + k);
        let cx = rr[0] + (z - FIN_Z0) / (FIN_Z1 - FIN_Z0) * rr[2];
        if (nx >= 0) cx = rr[0] + rr[2] - (cx - rr[0]); // mirrored region
        const [u, v] = canvasUV(cx, rr[1] + (FIN_Y1 - y) / (FIN_Y1 - FIN_Y0) * rr[3]);
        uv[(t + k) * 2] = u; uv[(t + k) * 2 + 1] = v;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    tail.push(finish(g));
    // stabiliser (loft along span)
    const STK = [[-1.5, 0.32, 0.03, 0.03, 0, 2.4, 0], [-1.42, 0.36, 0.045, 0.04, 0, 2.6, 0], [1.42, 0.36, 0.045, 0.04, 0, 2.6, 0], [1.5, 0.32, 0.03, 0.03, 0, 2.4, 0]];
    const stf = stationFn(STK);
    const sl = loft(zList(-1.5, 1.5, STK.map(k => k[0]), 0.5).map(stf), 12, (st, i, a) => [RG.STAB[0] + (st.z + 1.5) / 3 * RG.STAB[2], RG.STAB[1] + a / TAU * RG.STAB[3]]);
    const sg = sl.main; sg.rotateY(Math.PI / 2); sg.translate(0, 0.52, 9.1);
    tail.push(finish(sg));
    for (const sx of [1, -1]) tail.push(finish(sw(xf(box(0.04, 0.32, 0.45), sx * 1.5, 0.55, 9.12), 'char')));
    // tail rotor gearbox + driveshaft fairing on the fin
    const gb = new THREE.SphereGeometry(0.2, 12, 8); tail.push(finish(sw(xf(gb, 0.1, TAIL_ROTOR_P.y, TAIL_ROTOR_P.z, 0, 0, 0, 1, 1, 1.4), 'char')));
    const sh = cyl(0.05, 0.05, 0.22, 8); sh.rotateZ(Math.PI / 2); tail.push(finish(sw(xf(sh, 0.22, TAIL_ROTOR_P.y, TAIL_ROTOR_P.z), 'gun')));
    // tail strobe on fin tip
    const strobe = new THREE.SphereGeometry(0.05, 8, 6); tail.push(finish(sw(xf(strobe, 0, 2.9, 9.5), 'lensW')));
    // tail wheel + guard skid
    const tw = cyl(0.14, 0.14, 0.09, 14); tw.rotateZ(Math.PI / 2); tail.push(finish(sw(xf(tw, 0, -0.18, 8.15), 'rubber')));
    tail.push(finish(sw(strut(new THREE.Vector3(0, 0.3, 7.95), new THREE.Vector3(0, -0.12, 8.12), 0.07, 0.07, new THREE.Vector3(0, 0, -1)), 'gun')));
    for (const sx of [1, -1]) tail.push(finish(sw(strut(new THREE.Vector3(sx * 0.06, -0.18, 8.15), new THREE.Vector3(sx * 0.06, 0.0, 8.0), 0.03, 0.05, new THREE.Vector3(0, 0, -1)), 'gun')));
    const skid = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.3, 8.6), new THREE.Vector3(0, 0.0, 8.9), new THREE.Vector3(0, -0.05, 9.4), new THREE.Vector3(0, 0.4, 9.55)]), 10, 0.03, 6);
    tail.push(finish(sw(skid, 'gun')));
    // whip antenna
    H(sw(strut(new THREE.Vector3(0, 0.6, 4.4), new THREE.Vector3(0, 1.2, 5.0), 0.015, 0.015), 'gun'));
  }

  // -------------------- top: mast fairing, antennas, beacon --------------------
  {
    const mf = cyl(0.26, 0.42, 0.42, 16); H(sw(xf(mf, 0, 1.18, -0.3), 'olive'));
    const mf2 = cyl(0.14, 0.2, 0.3, 12); H(sw(xf(mf2, 0, 1.52, -0.3), 'gun'));
    H(sw(xf(box(0.04, 0.26, 0.3), 0, 1.08, 1.3, 0.35, 0, 0), 'char')); // blade antenna
    H(sw(xf(box(0.04, 0.2, 0.26), 0, -0.82, 0.6, -0.3, 0, 0), 'char')); // belly antenna
    const bc = new THREE.SphereGeometry(0.06, 8, 6); H(sw(xf(bc, 0, 1.0, 1.0), 'lensR'));
    const bc2 = new THREE.SphereGeometry(0.06, 8, 6); H(sw(xf(bc2, 0, -0.7, 1.2), 'lensR'));
    navPts.push([0, 1.04, 1.0, [3, 0.3, 0.1, 1]], [0, -0.76, 1.2, [3, 0.3, 0.1, 1]], [0, 2.95, 9.5, [3, 3, 3, 1]]);
    // engine-to-gearbox air scoop on the hump
    H(sw(xf(box(0.36, 0.14, 0.6), 0, 1.05, -0.95, -0.12, 0, 0), 'char'));
    // RWR sensors on nose sides
    for (const sx of [1, -1]) { const s = cyl(0.04, 0.05, 0.12, 8); s.rotateX(Math.PI / 2); H(sw(xf(s, sx * 0.42, -0.05, -4.85), 'sensor')); }
  }

  // -------------------- landing gear --------------------
  for (const sx of [1, -1]) {
    const top = new THREE.Vector3(sx * 0.82, -0.3, -1.25), axle = new THREE.Vector3(sx * 1.02, -1.2, -0.95);
    H(sw(strut(top, axle, 0.1, 0.1, new THREE.Vector3(0, 0, -1)), 'gun'));
    H(sw(strut(new THREE.Vector3(sx * 0.8, -0.3, -0.5), axle, 0.07, 0.07, new THREE.Vector3(0, 0, -1)), 'gun'));
    H(sw(tube(new THREE.Vector3(sx * 0.86, -0.5, -1.2), new THREE.Vector3(sx * 0.97, -1.0, -1.0), 0.04, 8), 'chrome'));
    const w = cyl(0.3, 0.3, 0.17, 18); w.rotateZ(Math.PI / 2); H(sw(xf(w, sx * 1.1, -1.2, -0.95), 'rubber'));
    const hub = cyl(0.16, 0.16, 0.19, 14); hub.rotateZ(Math.PI / 2); H(sw(xf(hub, sx * 1.1, -1.2, -0.95), 'hub'));
  }

  // -------------------- chin turret (rigged: part 1 turret, part 2 spinning barrels) --------------------
  {
    const T = TURRET_P;
    const ring = cyl(0.3, 0.32, 0.1, 18); H(sw(xf(ring, T.x, T.y + 0.16, T.z), 'char'));
    const ball = new THREE.SphereGeometry(0.25, 16, 10, 0, TAU, Math.PI * 0.3, Math.PI * 0.7); H(sw(xf(ball, T.x, T.y, T.z), 'char'), 1);
    H(sw(xf(box(0.2, 0.2, 0.75), T.x, T.y - 0.04, T.z - 0.42), 'gun'), 1); // receiver
    H(sw(xf(box(0.28, 0.07, 0.3), T.x, T.y + 0.02, T.z - 0.1), 'char'), 1); // cradle
    const sleeve = cyl(0.1, 0.1, 0.3, 12); sleeve.rotateX(Math.PI / 2); H(sw(xf(sleeve, 0, BARREL_AXIS.y, T.z - 0.88), 'gun'), 1);
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * TAU, bx = Math.cos(a) * 0.05, by = Math.sin(a) * 0.05;
      const b = cyl(0.026, 0.026, 1.0, 8, true); b.rotateX(Math.PI / 2); H(sw(xf(b, bx, BARREL_AXIS.y + by, T.z - 1.05), 'gun'), 2);
    }
    for (const zz of [-1.15, -1.5]) { const c = cyl(0.085, 0.085, 0.05, 12); c.rotateX(Math.PI / 2); H(sw(xf(c, 0, BARREL_AXIS.y, T.z + zz), 'hub'), 2); }
    // ammo chute (static)
    H(sw(strut(new THREE.Vector3(0.2, -0.7, -2.2), new THREE.Vector3(0.12, -0.84, -2.6), 0.12, 0.06), 'char'));
  }
  // -------------------- nose sensor ball (part 3) + searchlight --------------------
  {
    const S = SENSOR_P;
    H(sw(xf(cyl(0.14, 0.18, 0.2, 12), S.x, S.y + 0.2, S.z + 0.05), 'char'));
    H(sw(xf(new THREE.SphereGeometry(0.22, 16, 10), S.x, S.y, S.z), 'char'), 3);
    const win = new THREE.CircleGeometry(0.13, 14); win.rotateY(Math.PI); H(sw(xf(win, S.x, S.y, S.z - 0.215), 'sensor'), 3);
    const win2 = new THREE.PlaneGeometry(0.07, 0.07); win2.rotateY(Math.PI); H(sw(xf(win2, S.x + 0.1, S.y + 0.08, S.z - 0.2), 'sensor'), 3);
    for (const sx of [1, -1]) { const e = cyl(0.1, 0.1, 0.12, 12); e.rotateZ(Math.PI / 2); H(sw(xf(e, S.x + sx * 0.24, S.y, S.z), 'char'), 3); }
    // searchlight under the left nose
    const sl = cyl(0.11, 0.13, 0.22, 12); sl.rotateX(Math.PI / 2 - 0.75); H(sw(xf(sl, -0.34, -0.82, -3.95), 'gun'));
    const lens = new THREE.CircleGeometry(0.1, 12); lens.rotateX(Math.PI / 2 + 0.82); H(sw(xf(lens, -0.34, -0.91, -4.02), 'lensW'));
  }

  // ==================== merge body ====================
  const hullMain = mergeGeometries(hull);
  const panelG = mergeGeometries(panel);
  const tailG = mergeGeometries(tail);
  const hullAll = mergeGeometries([hullMain, panelG, tailG]);
  const glassG = mergeGeometries(glass);
  const body = mergeGeometries([hullAll, glassG], true);
  body.groups[0].materialIndex = 0; body.groups[1].materialIndex = 1;
  const nMain = hullMain.attributes.position.count, nPanel = panelG.attributes.position.count, nTail = tailG.attributes.position.count;
  body.computeBoundingSphere();

  // ==================== main rotor ====================
  {
    const BK = [[0.55, 0.12, 0.05, 0.05, 0, 2.2, 0], [0.9, 0.2, 0.05, 0.045, 0, 2.4, 0], [1.2, 0.27, 0.035, 0.025, 0, 2.6, 0], [6.25, 0.27, 0.03, 0.022, 0, 2.6, 0], [6.85, 0.2, 0.024, 0.018, 0, 2.6, 0, -0.08], [BLADE_R, 0.12, 0.012, 0.01, 0, 2.4, 0, -0.14]];
    const bf = stationFn(BK);
    const bl = loft(zList(0.55, BLADE_R, BK.map(k => k[0]), 0.9).map(bf), 8, (st, i, a) => [RG.BLADE[0] + st.z / 7.1 * RG.BLADE[2], RG.BLADE[1] + a / TAU * RG.BLADE[3]]);
    const blade = bl.main;
    // span z -> +x, chord -> -z; twist + droop
    const p = blade.attributes.position, bn = blade.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const cx = p.getX(i), cy = p.getY(i), r = p.getZ(i);
      const tw = 0.1 - 0.012 * r; // washout
      const c = Math.cos(tw), s = Math.sin(tw);
      const xx = cx * c - cy * s, yy = cx * s + cy * c;
      p.setXYZ(i, r, yy - 0.0028 * r * r + 0.02, -xx);
      const nx = bn.getX(i), ny = bn.getY(i), nz = bn.getZ(i);
      bn.setXYZ(i, nz, nx * s + ny * c, -(nx * c - ny * s));
    }
    for (let k = 0; k < 4; k++) { const b = blade.clone(); b.rotateY(k / 4 * TAU); rot.push(finish(b)); }
    // hub
    const plate = box(1.2, 0.08, 0.3); for (const ry of [0, Math.PI / 2]) rot.push(finish(sw(xf(plate.clone(), 0, 0, 0, 0, ry), 'hub')));
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU;
      const grip = box(0.42, 0.13, 0.2); grip.translate(0.62, 0.02, 0); grip.rotateY(a); rot.push(finish(sw(grip, 'gun')));
      const pl = cyl(0.02, 0.02, 0.36, 6); pl.translate(0.38, -0.22, 0.12); pl.rotateY(a); rot.push(finish(sw(pl, 'chrome')));
      const dmp = cyl(0.04, 0.04, 0.4, 8); dmp.rotateZ(Math.PI / 2); dmp.translate(0.4, 0.09, -0.13); dmp.rotateY(a); rot.push(finish(sw(dmp, 'hub')));
    }
    rot.push(finish(sw(xf(cyl(0.34, 0.34, 0.06, 18), 0, -0.36, 0), 'hub'))); // swashplate
    rot.push(finish(sw(xf(cyl(0.12, 0.12, 0.5, 12), 0, -0.1, 0), 'gun'))); // mast
    // mast-mounted sensor dome
    const dome = new THREE.SphereGeometry(0.34, 16, 10); rot.push(finish(sw(xf(dome, 0, 0.36, 0, 0, 0, 0, 1, 0.5, 1), 'char')));
    rot.push(finish(sw(xf(cyl(0.1, 0.12, 0.2, 10), 0, 0.14, 0), 'gun')));
  }
  const rotorG = mergeGeometries(rot);

  // ==================== tail rotor (spins about x) ====================
  {
    const TK = [[0.12, 0.06, 0.025, 0.025, 0, 2.2, 0], [0.22, 0.1, 0.02, 0.016, 0, 2.6, 0], [0.98, 0.09, 0.015, 0.012, 0, 2.6, 0], [1.02, 0.06, 0.008, 0.008, 0, 2.2, 0]];
    const tf = stationFn(TK);
    const tb = loft(zList(0.12, 1.02, TK.map(k => k[0]), 0.4).map(tf), 6, (st, i, a) => [RG.TBLADE[0] + st.z / 1.05 * RG.TBLADE[2], RG.TBLADE[1] + a / TAU * RG.TBLADE[3]]).main;
    // span z -> radial in yz plane (along +y), chord along z
    tb.rotateX(-Math.PI / 2); // z -> +y
    tb.rotateY(Math.PI / 2); // chord -> z, thickness -> x
    for (const a of [0, Math.PI, 0.96, 0.96 + Math.PI]) { const b = tb.clone(); b.rotateX(a); trot.push(finish(b)); }
    const hb = cyl(0.08, 0.08, 0.12, 10); hb.rotateZ(Math.PI / 2); trot.push(finish(sw(hb, 'hub')));
    const nc = new THREE.ConeGeometry(0.07, 0.12, 10); nc.rotateZ(-Math.PI / 2); trot.push(finish(sw(xf(nc, 0.11, 0, 0), 'gun')));
  }
  const tailRotorG = mergeGeometries(trot);
  // tail rotor offset outboard of the fin
  // ==================== blur discs (main + tail in one draw) ====================
  const blurParts = [];
  {
    const ring = (rIn, rOut, segA, segR, droop) => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= segR; i++) for (let j = 0; j <= segA; j++) {
        const r = rIn + (rOut - rIn) * i / segR, a = j / segA * TAU;
        pos.push(Math.cos(a) * r, -droop * r * r, Math.sin(a) * r);
        uv.push(r / rOut, j / segA * 3);
      }
      for (let i = 0; i < segR; i++) for (let j = 0; j < segA; j++) { const a = i * (segA + 1) + j, b = a + 1, c = a + segA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return g.toNonIndexed();
    };
    const main = ring(0.5, BLADE_R + 0.05, 56, 5, 0.0028); main.translate(0, 1.92 + 0.02, -0.3);
    const tl = ring(0.1, 1.04, 28, 1, 0); tl.rotateZ(Math.PI / 2); tl.translate(TAIL_ROTOR_P.x + 0.02, TAIL_ROTOR_P.y, TAIL_ROTOR_P.z);
    blurParts.push(main, tl);
  }
  const nBlurMain = blurParts[0].attributes.position.count, nBlurTail = blurParts[1].attributes.position.count;
  const blurG = mergeGeometries(blurParts);

  return { body, ranges: { panel: [nMain, nPanel], tail: [nMain + nPanel, nTail] }, tailG, rotorG, tailRotorG, blurG, blurTail: [nBlurMain, nBlurTail], pods, navPts, sparkLocal, fusSt };
}

function getCache() {
  if (CACHE) return CACHE;
  const t0 = performance.now();
  const geo = buildGeometry();
  const tex = buildAtlas(geo.fusSt);
  const hull = hullMaterial(tex);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1e2a2e, metalness: 0.7, roughness: 0.05, envMapIntensity: 2.4 });
  const blur = new THREE.MeshBasicMaterial({ map: blurTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, opacity: 1, color: 0xffffff });
  // searchlight cone
  const cc = mkCanvas(8, 128), cx = cc.getContext('2d');
  const cg = cx.createLinearGradient(0, 0, 0, 128); cg.addColorStop(0, 'rgba(255,240,210,0.0)'); cg.addColorStop(0.1, 'rgba(255,240,210,0.55)'); cg.addColorStop(1, 'rgba(255,240,210,0)');
  cx.fillStyle = cg; cx.fillRect(0, 0, 8, 128);
  // volumetric-looking beam: falloff along the length (texture) * fresnel edge fade (faces seen edge-on vanish)
  const coneMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: new THREE.CanvasTexture(cc) }, opacity: { value: 0.22 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform float opacity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); vec4 t = texture2D(map, vUv);
        gl_FragColor = vec4(vec3(1.0, 0.94, 0.82) * t.a * f * opacity, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const coneGeo = new THREE.CylinderGeometry(0.12, 5.5, 34, 20, 1, true); coneGeo.translate(0, -17, 0);
  CACHE = { geo, tex, hull, glass, blur, coneMat, coneGeo, buildMs: 0 };
  CACHE.buildMs = performance.now() - t0;
  return CACHE;
}

function collapse(geo, [start, count]) {
  const p = geo.attributes.position;
  p.array.fill(0, start * 3, (start + count) * 3);
  p.clearUpdateRanges(); p.addUpdateRange(start * 3, count * 3);
  p.needsUpdate = true;
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export function buildHeli() {
  const C = getCache(), G = C.geo;
  U.uDamage.value = 0; U.uSpin.value = 0; U.uTurR.value.identity(); U.uSenR.value.identity();
  const root = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(tilt);
  const bodyGeo = G.body.clone();
  const body = new THREE.Mesh(bodyGeo, [C.hull, C.glass]);
  body.castShadow = true; body.receiveShadow = false;
  tilt.add(body);

  const rotor = new THREE.Group(); rotor.position.set(0, 1.92, -0.3);
  const rotorMesh = new THREE.Mesh(G.rotorG, C.hull); rotorMesh.castShadow = true; rotor.add(rotorMesh);
  tilt.add(rotor);
  const tailRotor = new THREE.Group(); tailRotor.position.copy(TAIL_ROTOR_P);
  const tailRotorMesh = new THREE.Mesh(G.tailRotorG, C.hull); tailRotor.add(tailRotorMesh);
  tilt.add(tailRotor);
  const blurGeo = G.blurG.clone();
  const blurMat = C.blur; // shared (one heli at a time)
  const blur = new THREE.Mesh(blurGeo, blurMat); blur.renderOrder = 2;
  tilt.add(blur);

  const pods = G.pods.map(p => { const o = new THREE.Object3D(); o.position.copy(p.position); tilt.add(o); return o; });
  // pods[0] must be left, pods[1] right
  pods.sort((a, b) => a.position.x - b.position.x);
  const gun = new THREE.Object3D(); gun.position.copy(MUZZLE_REST); tilt.add(gun);
  const smokePt = new THREE.Object3D(); smokePt.position.set(1.2, 0.7, 2.95); tilt.add(smokePt);
  const lightPt = new THREE.Object3D(); lightPt.position.set(-0.34, -0.95, -4.05); tilt.add(lightPt);
  const sparkPt = new THREE.Object3D(); sparkPt.position.copy(G.sparkLocal); tilt.add(sparkPt);
  const navLights = G.navPts.map(([x, y, z, col]) => { const o = new THREE.Object3D(); o.position.set(x, y, z); tilt.add(o); return [o, col]; });
  const tailNav = navLights[navLights.length - 1][0];
  const cone = new THREE.Mesh(C.coneGeo, C.coneMat);
  cone.position.copy(lightPt.position); cone.rotation.x = 0.75;
  tilt.add(cone);

  // ---- rotor blur: auto from the rotor's actual angular change between renders ----
  let blurAmt = 0, manual = null, lastRot = rotor.rotation.y, still = 0, blurPhase = 0;
  blur.onBeforeRender = () => {
    const d = Math.abs(rotor.rotation.y - lastRot);
    if (d > 1e-5) { still = 0; lastRot = rotor.rotation.y; } else still++;
    const target = manual !== null ? manual : (still > 6 ? 0 : 1);
    blurAmt += (target - blurAmt) * 0.08;
    if (d > 1e-5) blurPhase += 0.37 + d * 0.21;
    blurMat.opacity = blurAmt;
    blurMat.map.offset.y = blurPhase;
  };
  const state = { damage: 0, panelGone: false, tailGone: false };
  const burnables = [rotorMesh, tailRotorMesh];

  function setDamage(d) {
    d = Math.max(0, Math.min(1, d));
    state.damage = d; U.uDamage.value = d;
    if (d >= 0.55 && !state.panelGone) { state.panelGone = true; collapse(bodyGeo, G.ranges.panel); return true; }
    return false;
  }
  function rotorBlur(speed, snap = false) { manual = speed === null || speed === undefined ? null : THREE.MathUtils.smoothstep(speed, 6, 28); if (snap) blurAmt = manual ?? 1; }
  // ---- turret / sensor aim ----
  let tYaw = 0, tPitch = 0, spin = 0, spinV = 0;
  const _inv = new THREE.Matrix4();
  function aimGun(worldPos, dt = 1 / 60, firing = false) {
    if (worldPos) {
      tilt.updateWorldMatrix(true, false);
      _inv.copy(tilt.matrixWorld).invert();
      _v.copy(worldPos).applyMatrix4(_inv).sub(TURRET_P);
      const wantYaw = THREE.MathUtils.clamp(Math.atan2(-_v.x, -_v.z), -1.9, 1.9);
      const wantPitch = THREE.MathUtils.clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -1.1, 0.2);
      const k = 1 - Math.exp(-dt * 6);
      tYaw += (wantYaw - tYaw) * k; tPitch += (wantPitch - tPitch) * k;
    }
    spinV += ((firing ? 40 : 0) - spinV) * (1 - Math.exp(-dt * (firing ? 10 : 2)));
    spin = (spin + spinV * dt) % TAU;
    _q.setFromEuler(_e.set(tPitch, tYaw, 0, 'YXZ'));
    _m4.makeRotationFromQuaternion(_q);
    U.uTurR.value.setFromMatrix4(_m4); U.uSpin.value = spin;
    _q.setFromEuler(_e.set(tPitch * 0.8, tYaw * 0.9, 0, 'YXZ')); _m4.makeRotationFromQuaternion(_q); U.uSenR.value.setFromMatrix4(_m4);
    _v2.copy(MUZZLE_REST).sub(TURRET_P).applyQuaternion(_q.setFromEuler(_e.set(tPitch, tYaw, 0, 'YXZ'))).add(TURRET_P);
    gun.position.copy(_v2);
  }
  function breakTail() {
    if (state.tailGone) return null;
    state.tailGone = true;
    collapse(bodyGeo, G.ranges.tail);
    collapse(blurGeo, G.blurTail);
    const piece = new THREE.Group();
    const tailMesh = new THREE.Mesh(G.tailG, C.hull); tailMesh.castShadow = true;
    piece.add(tailMesh);
    // tail rotor (+ its strobe) travel with the piece
    piece.add(tailRotor); piece.add(tailNav);
    tilt.add(piece);
    tilt.updateWorldMatrix(true, true);
    if (root.parent) root.parent.attach(piece);
    burnables.push(tailMesh);
    const vel = new THREE.Vector3(1.5, -2.5, 6).transformDirection(tilt.matrixWorld).multiplyScalar(7);
    return { object: piece, velocityHint: vel, spinHint: new THREE.Vector3(2.5, 7, 1.5) };
  }

  return {
    root, tilt, body, navLights, cone, rotor, tailRotor, pods, gun, smokePt, lightPt, sparkPt,
    half: new THREE.Vector3(2.0, 1.2, 5.9), center: new THREE.Vector3(0, 0.05, 0.6),
    burnables, setDamage, rotorBlur, aimGun, breakTail,
    debug: { cache: C, blurMesh: blur, rotorMesh, tailRotorMesh },
  };
}
