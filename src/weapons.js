import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// =====================================================================================
// BAYHEM hero weapons. Everything procedural & deterministic.
// Conventions: origin at the pistol grip / trigger hand, barrel along -z, +y up.
// Each gun = ONE skinned mesh (all opaque parts, hands included; moving parts are bones)
// + small extras (holo glass, emissive reticle/ammo counter) → ≤3 draw calls per gun.
// Per-vertex albedo (baked wear/grime/dust) in vertex colors; per-vertex metal/rough via a
// tiny palette texture addressed by uv (u = material class, v = dusty ← base → worn).
// =====================================================================================

const V3 = THREE.Vector3;
const PI = Math.PI, D = PI / 180;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => { t = clamp01(t); return 1 - (1 - t) * (1 - t); };
const easeIn = (t) => { t = clamp01(t); return t * t; };
const win = (p, a, b) => clamp01((p - a) / (b - a));

// ------------------------------------------------------------------ material palette
// Two-tone language: matte black POLYmer (no coat) vs dark blued/anodized METAL under a glossy
// clearcoat that catches the sunset. Worn edges = bright bare metal (coat gone, low roughness).
const C = { ANO: 0, POLY: 1, STEEL: 2, PARK: 3, BRASS: 4, COPPER: 5, FABRIC: 6, RUBBER: 7, SYNTH: 8, GLOSS: 9, PAINT: 10 };
//            [metalness, roughness, clearcoat] at "base" (v = 0.5)
const PAL = [[0.7, 0.34, 1.0], [0.0, 0.82, 0.0], [0.95, 0.22, 0.4], [0.9, 0.3, 1.0], [1.0, 0.24, 0.5], [1.0, 0.3, 0.4], [0.0, 0.9, 0.0], [0.0, 0.62, 0.12], [0.0, 0.8, 0.0], [0.3, 0.06, 1.0], [0.1, 0.5, 0.45]];
const METALLIC = new Set([C.ANO, C.STEEL, C.PARK, C.BRASS, C.COPPER]);
const PW = 16, PH = 16;
// linear albedo (for metals = F0 tint)
const COL = {
  ano: [0.052, 0.054, 0.062], poly: [0.019, 0.019, 0.019], fde: [0.105, 0.09, 0.068], steel: [0.42, 0.42, 0.44],
  park: [0.07, 0.08, 0.105], pin: [0.13, 0.135, 0.15], brass: [0.78, 0.52, 0.2], copper: [0.72, 0.34, 0.18],
  od: [0.06, 0.066, 0.034], yellow: [0.5, 0.36, 0.05], glove: [0.062, 0.054, 0.042], gloveSeam: [0.045, 0.04, 0.032], gloveDk: [0.022, 0.021, 0.02],
  palm: [0.1, 0.085, 0.064], sleeve: [0.036, 0.04, 0.044], rubber: [0.02, 0.02, 0.019], screen: [0.008, 0.009, 0.01], white: [0.55, 0.53, 0.48],
};
const DUST = [0.2, 0.18, 0.15];
// detail-normal tiling (metres per repeat) per class; 0 = smooth (flat normal)
const DETAIL = { [C.POLY]: 0.014, [C.FABRIC]: 0.011, [C.SYNTH]: 0.016, [C.RUBBER]: 0.022, [C.PAINT]: 0.06 };

function detailNormalTex() {
  const N = 128, h = new Float32Array(N * N);
  const hh = (x, y, s) => hash3(((x % s) + s) % s, ((y % s) + s) % s, s * 7);
  const vn = (x, y, s) => { // tileable value noise, period s cells over the texture
    const fx = x / N * s, fy = y / N * s, xi = Math.floor(fx), yi = Math.floor(fy); let tx = fx - xi, ty = fy - yi;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    return mix(mix(hh(xi, yi, s), hh(xi + 1, yi, s), tx), mix(hh(xi, yi + 1, s), hh(xi + 1, yi + 1, s), tx), ty);
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const st = vn(x, y, 32), st2 = vn(x, y, 64), lo = vn(x, y, 8);
    h[y * N + x] = 0.55 * Math.pow(st, 1.6) + 0.3 * st2 + 0.15 * lo; // stipple / grain
  }
  const d = new Uint8Array(N * N * 4), k = 5.0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)]) * k, dy = (h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]) * k;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    d[i] = Math.round((-dx / l * 0.5 + 0.5) * 255); d[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); d[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.channel = 1; t.needsUpdate = true;
  return t;
}

const EDGE = { value: 1 };
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const data = new Uint8Array(PW * PH * 4);
  for (let j = 0; j < PH; j++) {
    const s = (j + 0.5) / PH;
    for (let i = 0; i < PW; i++) {
      const [m0, r0, c0] = PAL[i] || [0, 0.6, 0];
      let m = m0, r = r0, cc = c0;
      if (s < 0.5) { const t = (0.5 - s) * 2; m = m0 * (1 - 0.8 * t); r = r0 + (0.95 - r0) * 0.8 * t; cc = c0 * (1 - 0.85 * t); } // dusty
      else {
        const t = (s - 0.5) * 2; // worn
        if (METALLIC.has(i)) { m = m0 + (1 - m0) * Math.min(1, t * 1.6); r = mix(r0, 0.24, t); cc = c0 * (1 - t); }
        else { r = Math.max(0.3, r0 - 0.3 * t); cc = c0 * (1 - t); }
      }
      const k = (j * PW + i) * 4;
      data[k] = Math.round(cc * 255); data[k + 1] = Math.round(r * 255); data[k + 2] = Math.round(m * 255); data[k + 3] = 255;
    }
  }
  const pal = new THREE.DataTexture(data, PW, PH, THREE.RGBAFormat);
  pal.magFilter = pal.minFilter = THREE.NearestFilter; pal.generateMipmaps = false; pal.needsUpdate = true;
  MATS = {
    // R = clearcoat, G = roughness, B = metalness (palette), detail normal on uv1
    body: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, vertexColors: true, metalness: 1, roughness: 1, metalnessMap: pal, roughnessMap: pal,
      clearcoat: 1, clearcoatMap: pal, clearcoatRoughness: 0.08, envMapIntensity: 1.7,
      normalMap: detailNormalTex(), normalScale: new THREE.Vector2(0.22, 0.22),
    }),
    // coated optic glass: tinted env reflection (catches the sunset), mostly see-through
    glass: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.5, 0.75, 0.9), metalness: 1, roughness: 0.03, transparent: true, opacity: 0.3, envMapIntensity: 3.2, depthWrite: false }),
  };
  MATS.body.name = 'weaponBody'; MATS.glass.name = 'weaponGlass';
  // Screen-space curvature edge wear: bevels (normal changing fast across a pixel) read as bare,
  // polished metal / scuffed polymer at any viewing distance; the vertex-baked wear covers close-ups.
  MATS.body.onBeforeCompile = (sh) => {
    sh.uniforms.edgeWear = EDGE;
    sh.fragmentShader = 'uniform float edgeWear;\n' + sh.fragmentShader.replace('#include <lights_physical_fragment>', `
      vec3 nC = normalize(vNormal);
      float wEdge = smoothstep(0.22, 0.75, length(fwidth(nC))) * edgeWear;
      float isMetal = step(0.45, metalnessFactor);
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb * 2.6 + 0.025, vec3(0.58, 0.58, 0.6), isMetal), wEdge * mix(0.55, 0.9, isMetal));
      metalnessFactor = mix(metalnessFactor, 1.0, wEdge * isMetal);
      roughnessFactor = mix(roughnessFactor, mix(roughnessFactor * 0.75, 0.24, isMetal), wEdge);
      #include <lights_physical_fragment>
      material.clearcoat *= 1.0 - wEdge * isMetal;`);
  };
  return MATS;
}

// ------------------------------------------------------------------ deterministic noise
function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
  return mix(mix(mix(c(0, 0, 0), c(1, 0, 0), fx), mix(c(0, 1, 0), c(1, 1, 0), fx), fy),
    mix(mix(c(0, 0, 1), c(1, 0, 1), fx), mix(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
}
const fbm = (x, y, z) => 0.62 * vnoise(x, y, z) + 0.38 * vnoise(x * 2.7 + 5.1, y * 2.7 + 1.3, z * 2.7 + 7.7);

// ------------------------------------------------------------------ 2D profile helpers
// polygon with per-corner rounding: pts [[x,y,r?]]; r = corner cut distance (quadratic fillet)
function rp(pts, defR = 0, seg = 2) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const P = pts[i], A = pts[(i + n - 1) % n], B = pts[(i + 1) % n];
    const r = P[2] ?? defR;
    if (!r) { out.push([P[0], P[1]]); continue; }
    const la = Math.hypot(A[0] - P[0], A[1] - P[1]), lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
    const d = Math.min(r, la * 0.48, lb * 0.48);
    const a = [P[0] + (A[0] - P[0]) / la * d, P[1] + (A[1] - P[1]) / la * d];
    const b = [P[0] + (B[0] - P[0]) / lb * d, P[1] + (B[1] - P[1]) / lb * d];
    for (let k = 0; k <= seg; k++) { const t = k / seg, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * P[0] + t * t * b[0], u * u * a[1] + 2 * u * t * P[1] + t * t * b[1]]); }
  }
  return out;
}
function arcPts(cx, cy, r, a0, a1, n) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
function circle(cx, cy, r, n) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
function stadium(cx, cy, len, w, n = 4) { // long axis along x
  const r = w / 2, h = len / 2 - r;
  return [...arcPts(cx + h, cy, r, -PI / 2, PI / 2, n), ...arcPts(cx - h, cy, r, PI / 2, PI * 1.5, n)];
}
const toV2 = (p) => p.map((q) => new THREE.Vector2(q[0], q[1]));

// Extrude a 2D outline (shape XY) along Z, centered on z = 0. Side walls sit exactly on the outline.
// Adds attributes: sg (1 = cap faces, separate smoothing group), bv (1 = bevel faces → edge wear).
function ext(outline, depth, { bev = 0.0012, seg = 1, holes = [] } = {}) {
  const shape = new THREE.Shape(toV2(outline));
  for (const h of holes) shape.holes.push(new THREE.Path(toV2(h)));
  const bt = bev > 0 ? Math.min(bev, depth * 0.42) : 0;
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-5, depth - 2 * bt), bevelEnabled: bev > 0, bevelThickness: bt, bevelSize: bev, bevelOffset: -bev, bevelSegments: seg, curveSegments: 1, steps: 1 });
  g.translate(0, 0, -(depth - 2 * bt) / 2);
  const n = g.attributes.position.count, p = g.attributes.position.array;
  const sg = new Float32Array(n), bv = new Float32Array(n);
  const lid = g.groups[0];
  if (lid) for (let i = lid.start; i < lid.start + lid.count; i++) sg[i] = 1;
  const a = new V3(), b = new V3(), c = new V3();
  for (let t = 0; t < n; t += 3) {
    if (sg[t]) continue;
    a.fromArray(p, t * 3); b.fromArray(p, t * 3 + 3); c.fromArray(p, t * 3 + 6);
    b.sub(a); c.sub(a); b.cross(c).normalize();
    if (Math.abs(b.z) > 0.2) bv[t] = bv[t + 1] = bv[t + 2] = 1;
  }
  g.setAttribute('sg', new THREE.BufferAttribute(sg, 1));
  g.setAttribute('bv', new THREE.BufferAttribute(bv, 1));
  g.deleteAttribute('uv'); g.clearGroups();
  return g;
}

const _M = new THREE.Matrix4();
function flipWinding(g) {
  for (const key of Object.keys(g.attributes)) {
    const at = g.attributes[key], s = at.itemSize, arr = at.array;
    for (let t = 0; t < at.count; t += 3) for (let k = 0; k < s; k++) { const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k; const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
  }
}
function apply(g, m) {
  if (g.index) { const ng = g.toNonIndexed(); g.dispose(); g = ng; }
  g.applyMatrix4(m);
  if (m.determinant() < 0) flipWinding(g);
  return g;
}
// side profile: shape (u = forward, v = up), extruded across x, centered on x0
const side = (g, x0 = 0) => apply(g, _M.set(0, 0, 1, x0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1));
// rear view: shape (x, y) as seen from behind, extruded along z, centered on gun z = z0
const rear = (g, z0 = 0) => g.translate(0, 0, z0);
// plan view: shape (x, u = forward), extruded along y, centered on y0
const plan = (g, y0 = 0) => apply(g, _M.set(1, 0, 0, 0, 0, 0, 1, y0, 0, -1, 0, 0, 0, 0, 0, 1));
// lathe around the bore axis: profile [[r, u]] (u forward)
function lathe(profile, segs, y = BY, x = 0, phi0 = 0) {
  const g = new THREE.LatheGeometry(profile.map(([r, u]) => new THREE.Vector2(r, u)), segs, phi0);
  g.rotateX(-PI / 2); g.translate(x, y, 0);
  return g;
}
function orient(g, a, b) {
  const d = new V3().subVectors(b, a); const L = d.length(); d.divideScalar(L || 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
const cylAB = (a, b, r1, r2 = r1, rs = 12, open = false) => orient(new THREE.CylinderGeometry(r2, r1, a.distanceTo(b), rs, 1, open), a, b);
const v3 = (x, y, z) => new V3(x, y, z);
const rbox = (w, h, d, r, seg = 1) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.05, h / 2.05, d / 2.05));
function at(g, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(1, 1, 1));
  return apply(g, m);
}
function basisBox(w, h, d, r, center, X, Y, frame) { // box with axes X (w), Y (h), Z = X×Y (d)
  const x = X.clone().normalize(), z = new V3().crossVectors(x, Y).normalize(), y = new V3().crossVectors(z, x);
  const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(center);
  if (frame) m.premultiply(frame);
  return apply(rbox(w, h, d, r), m);
}
function ellipsoid(c, rx, ry, rz, frame, ws = 10, hs = 7) {
  const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.translate(c.x, c.y, c.z);
  return frame ? apply(g, frame) : g;
}

// chamfered box (cheap): octagon-cornered profile along z + small bevel
function cbox(w, h, d, c = Math.min(w, h) * 0.22) {
  return ext(rp([[-w / 2, -h / 2, c], [w / 2, -h / 2, c], [w / 2, h / 2, c], [-w / 2, h / 2, c]], 0, 1), d, { bev: Math.min(c, d * 0.3), seg: 1 });
}
// swept tube through points (gun space) with per-point radii, domed tip (and base)
function tube(pts, radii, radial = 8, baseDome = true, sec = null) {
  const n = pts.length, tang = [];
  for (let i = 0; i < n; i++) tang.push(pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize());
  let nrm = sec?.up ? sec.up.clone() : Math.abs(tang[0].y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0);
  const su = sec?.su ?? 1, sv = sec?.sv ?? 1; // elliptical section: su along `up`, sv across
  nrm.addScaledVector(tang[0], -nrm.dot(tang[0])).normalize();
  const rings = [];
  const ringAt = (c, t, nr, r) => { const bn = new V3().crossVectors(t, nr), out = []; for (let k = 0; k < radial; k++) { const a = k / radial * PI * 2; out.push(c.clone().addScaledVector(nr, Math.cos(a) * r * su).addScaledVector(bn, Math.sin(a) * r * sv)); } return out; };
  const frames = [];
  for (let i = 0; i < n; i++) { if (i > 0) nrm.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(tang[i - 1], tang[i])).normalize(); frames.push(nrm.clone()); }
  const t0 = tang[0], tn = tang[n - 1], r0 = radii[0], rn = radii[n - 1];
  if (baseDome) { rings.push([pts[0].clone().addScaledVector(t0, -r0)]); rings.push(ringAt(pts[0].clone().addScaledVector(t0, -r0 * 0.7), t0, frames[0], r0 * 0.72)); }
  for (let i = 0; i < n; i++) rings.push(ringAt(pts[i], tang[i], frames[i], radii[i]));
  rings.push(ringAt(pts[n - 1].clone().addScaledVector(tn, rn * 0.6), tn, frames[n - 1], rn * 0.8));
  rings.push([pts[n - 1].clone().addScaledVector(tn, rn)]);
  const P = [];
  const tri = (a, b, c) => P.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let k = 0; k < radial; k++) {
      const k1 = (k + 1) % radial;
      if (A.length === 1) tri(A[0], B[k1], B[k]);
      else if (B.length === 1) tri(A[k], A[k1], B[0]);
      else { tri(A[k], A[k1], B[k1]); tri(A[k], B[k1], B[k]); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  return g;
}
// insert joint midpoints (slightly slimmer) so knuckles read
function jointed(pts, radii) {
  const P = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    P.push(pts[i]); R.push(radii[i]);
    if (i < pts.length - 1) { P.push(pts[i].clone().lerp(pts[i + 1], 0.5)); R.push((radii[i] + radii[i + 1]) * 0.5 * 0.93); }
  }
  return [P, R];
}

// ------------------------------------------------------------------ part kit & bake
class Kit {
  constructor() { this.parts = []; this.occ = []; }
  add(g, o = {}) { this.parts.push({ g, cls: C.ANO, col: COL.ano, bone: 0, wear: 0.8, dust: 1, crease: 38, tag: 'gun', ...o }); return g; }
  cap(a, b, r, k, fall, tag, only) { this.occ.push({ t: 0, a, b, r, k, fall, tag, only }); }
  box(c, h, k, fall, tag, only) { this.occ.push({ t: 1, c, h, k, fall, tag, only }); }
}
function autoWear(P) {
  const c = P.col;
  if (P.cls === C.ANO) return [0.6, 0.6, 0.61];
  if (P.cls === C.PARK || P.cls === C.STEEL) return [0.52, 0.53, 0.55];
  if (P.cls === C.POLY || P.cls === C.RUBBER) return [c[0] * 2.3 + 0.02, c[1] * 2.3 + 0.02, c[2] * 2.3 + 0.02];
  if (P.cls === C.FABRIC || P.cls === C.SYNTH) return [c[0] * 1.8, c[1] * 1.8, c[2] * 1.8];
  if (P.cls === C.PAINT) return [0.3, 0.3, 0.3];
  return [c[0] * 1.15, c[1] * 1.15, c[2] * 1.15];
}
const _p = new V3(), _q = new V3(), _ab = new V3();
function occlusion(occ, px, py, pz, nx, ny, nz) {
  let d, dx, dy, dz;
  _p.set(px, py, pz);
  if (occ.t === 0) {
    _ab.subVectors(occ.b, occ.a);
    const t = clamp01(_q.subVectors(_p, occ.a).dot(_ab) / Math.max(1e-9, _ab.lengthSq()));
    _q.copy(occ.a).addScaledVector(_ab, t);
    dx = _q.x - px; dy = _q.y - py; dz = _q.z - pz;
    const l = Math.hypot(dx, dy, dz) || 1e-6; d = l - occ.r; dx /= l; dy /= l; dz /= l;
  } else {
    const qx = Math.abs(px - occ.c.x) - occ.h.x, qy = Math.abs(py - occ.c.y) - occ.h.y, qz = Math.abs(pz - occ.c.z) - occ.h.z;
    d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
    dx = occ.c.x - px; dy = occ.c.y - py; dz = occ.c.z - pz; const l = Math.hypot(dx, dy, dz) || 1e-6; dx /= l; dy /= l; dz /= l;
  }
  if (d > occ.fall) return 0;
  const facing = Math.max(0, nx * dx + ny * dy + nz * dz);
  return occ.k * (1 - sstep(0, occ.fall, d)) * (0.45 + 0.55 * facing);
}

function bakePart(P, occ) {
  let g = P.g.index ? P.g.toNonIndexed() : P.g;
  const pos = g.attributes.position.array, nv = pos.length / 3, nt = nv / 3;
  const sg = g.attributes.sg ? g.attributes.sg.array : null;
  const bv = g.attributes.bv ? g.attributes.bv.array : null;
  const occList = occ.filter((o) => o.tag !== P.tag && (!o.only || o.only.some((t) => P.tag === t || P.tag.startsWith(t + 'f'))));
  const fn = new Float32Array(nt * 3), fa = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    const i = t * 9;
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    let cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const l = Math.hypot(cx, cy, cz);
    if (l < 1e-14) { fn[t * 3 + 1] = 1; fa[t] = 0; continue; }
    fn[t * 3] = cx / l; fn[t * 3 + 1] = cy / l; fn[t * 3 + 2] = cz / l; fa[t] = l * 0.5;
  }
  // area-weighted creased normals ("weighted normals" for hard-surface)
  const map = new Map(), keys = new Array(nv);
  for (let v = 0; v < nv; v++) {
    const key = Math.round(pos[v * 3] * 2e4) + ',' + Math.round(pos[v * 3 + 1] * 2e4) + ',' + Math.round(pos[v * 3 + 2] * 2e4) + (sg ? '|' + sg[v] : '');
    keys[v] = key; let a = map.get(key); if (!a) { a = []; map.set(key, a); } a.push((v / 3) | 0);
  }
  const cosC = Math.cos(P.crease * D);
  const nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), uv1 = new Float32Array(nv * 2);
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const wc = P.wearCol || autoWear(P);
  const cu = (P.cls + 0.5) / PW;
  for (let v = 0; v < nv; v++) {
    const t = (v / 3) | 0, fx = fn[t * 3], fy = fn[t * 3 + 1], fz = fn[t * 3 + 2];
    let x = 0, y = 0, z = 0;
    for (const u of map.get(keys[v])) {
      const ux = fn[u * 3], uy = fn[u * 3 + 1], uz = fn[u * 3 + 2];
      if (ux * fx + uy * fy + uz * fz >= cosC) { const w = fa[u] + 1e-12; x += ux * w; y += uy * w; z += uz * w; }
    }
    let l = Math.hypot(x, y, z); if (l < 1e-12) { x = fx; y = fy; z = fz; l = 1; }
    const nx = x / l, ny = y / l, nz = z / l;
    nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
    const px = pos[v * 3], py = pos[v * 3 + 1], pz = pos[v * 3 + 2];
    // local convexity: do smoothed normals splay away from the face centre?
    const i = t * 9;
    let dx = px - (pos[i] + pos[i + 3] + pos[i + 6]) / 3, dy = py - (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3, dz = pz - (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3;
    const dl = Math.hypot(dx, dy, dz) || 1;
    const conv = ((nx - fx) * dx + (ny - fy) * dy + (nz - fz) * dz) / dl;
    // ---- albedo bake
    let wear = 0;
    if (P.wear > 0) {
      let e = bv ? Math.max(bv[v] * 0.9, sstep(0.1, 0.28, conv)) : P.convWear ? sstep(0.1, 0.28, conv) : 0;
      if (P.chamfer && Math.max(Math.abs(fx), Math.abs(fy), Math.abs(fz)) < 0.97) e = Math.max(e, 0.75);
      if (P.lw && Math.abs(fz) > 0.25 && Math.abs(fz) < 0.95) e = Math.max(e, 0.7);
      e = Math.max(e, P.wearBase || 0);
      if (P.wearFn) e = Math.max(e, P.wearFn(px, py, pz, nx, ny, nz));
      wear = clamp01(e * P.wear * (0.2 + 1.5 * fbm(px * 75 + 1, py * 75, pz * 75)));
    }
    const cav = sstep(0.03, 0.2, -conv);
    let ao = (0.56 + 0.44 * (0.5 + 0.5 * ny)) * (1 - 0.6 * cav);
    for (const o of occList) ao *= 1 - occlusion(o, px, py, pz, nx, ny, nz);
    if (P.tint) ao *= P.tint(px, py, pz, nx, ny, nz);
    const mott = 0.82 + 0.34 * fbm(px * 40 + 3, py * 40, pz * 40);
    let base = P.col, ucls = cu;
    if (P.matFn) { const r = P.matFn((pos[i] + pos[i + 3] + pos[i + 6]) / 3, (pos[i + 1] + pos[i + 4] + pos[i + 7]) / 3, (pos[i + 2] + pos[i + 5] + pos[i + 8]) / 3); base = r[0]; ucls = (r[1] + 0.5) / PW; }
    const dust = P.dust * sstep(0.12, 0.9, ny) * sstep(0.3, 0.72, fbm(px * 24 + 11, py * 24, pz * 24 + 4));
    for (let c = 0; c < 3; c++) {
      let a = mix(base[c] * mott, wc[c], wear) * ao;
      a = mix(a, DUST[c] * (0.55 + 0.45 * ao), dust * 0.2);
      col[v * 3 + c] = a;
    }
    uv[v * 2] = ucls; uv[v * 2 + 1] = Math.min(0.98, Math.max(0.02, 0.5 + 0.48 * wear - 0.45 * dust));
    si[v * 4] = P.bone; sw[v * 4] = 1;
    // detail-normal uv: box projection on the dominant face axis (constant = smooth for metals)
    const ds = DETAIL[P.cls];
    if (ds) { const ax = Math.abs(fx), ay = Math.abs(fy), az = Math.abs(fz); const [u1, v1] = ax > ay && ax > az ? [pz, py] : ay > az ? [px, pz] : [px, py]; uv1[v * 2] = u1 / ds; uv1[v * 2 + 1] = v1 / ds; }
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  ng.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  ng.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  ng.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  ng.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  ng.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return ng;
}

// Build the skinned mesh. boneDefs: [{ name, pos:[x,y,z] (gun space pivot), parent? }]
function rig(kit, boneDefs) {
  const geo = mergeVertices(mergeGeometries(kit.parts.map((P) => bakePart(P, kit.occ)), false), 1e-5);
  geo.computeBoundingSphere();
  const mesh = new THREE.SkinnedMesh(geo, mats().body);
  const bones = boneDefs.map((b) => { const o = new THREE.Bone(); o.name = b.name; return o; });
  boneDefs.forEach((b, i) => {
    const p = new V3(...b.pos);
    if (b.parent == null) { mesh.add(bones[i]); bones[i].position.copy(p); }
    else { bones[b.parent].add(bones[i]); bones[i].position.copy(p).sub(new V3(...boneDefs[b.parent].pos)); }
    bones[i].userData.rest = bones[i].position.clone();
  });
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true; mesh.frustumCulled = false;
  const B = {}; boneDefs.forEach((b, i) => { B[b.name] = bones[i]; });
  return { mesh, B, tris: geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3 };
}

// =====================================================================================
// Shared lower group: pistol grip, trigger guard, trigger, gloved trigger hand
// =====================================================================================
const BY = 0.075;                      // rifle bore height above the hand
const GRIP_RAKE = -20 * D;            // pistol grip cants down/back ~20° from the bore normal
const gripFrame = (mirror) => {
  const m = new THREE.Matrix4().makeTranslation(0, 0, 0.012).multiply(new THREE.Matrix4().makeRotationX(GRIP_RAKE));
  if (mirror) m.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  return m;
};
// trigger-finger pose (gun space, right hand) — converted to hand-local so the left hand can mirror it
const IDX_GUN = [v3(0.035, 0.0294, 0.0077), v3(0.028, 0.028, -0.036), v3(0.012, 0.028, -0.06), v3(-0.005, 0.027, -0.053)];
const IDX_LOCAL = IDX_GUN.map((p) => p.clone().applyMatrix4(gripFrame(false).invert()));

function addGrip(k, furniture) {
  // finger-grooved pistol grip in grip-local side profile (a = forward, b = up)
  const front = [];
  for (let y = 0.044; y >= -0.046; y -= 0.0052) front.push([0.0232 + 0.0021 * Math.cos(2 * PI * (y + 0.003) / 0.021) * sstep(0.03, 0.012, y) * sstep(-0.05, -0.04, y), y]);
  const out = rp([[0.022, 0.06, 0], ...front.map((p) => [p[0], p[1], 0]), [0.0275, -0.056, 0.004], [0.026, -0.062, 0.004], [-0.027, -0.062, 0.004], [-0.0285, -0.055, 0.004],
    [-0.025, -0.03, 0.01], [-0.0245, 0.012, 0.01], [-0.027, 0.034, 0.006], [-0.032, 0.046, 0.004], [-0.028, 0.058, 0.004]], 0, 2);
  const g = side(ext(out, 0.029, { bev: 0.0058, seg: 1 }));
  k.add(apply(g, gripFrame(false)), { cls: C.POLY, col: furniture ? COL.fde : COL.poly, tag: 'grip', wear: 0.6 });
  // grip base cap (texture break)
  const cap = side(ext(rp([[0.0285, -0.054, 0.003], [0.0265, -0.064, 0.003], [-0.028, -0.064, 0.003], [-0.0295, -0.054, 0.003]]), 0.031, { bev: 0.003, seg: 2 }));
  k.add(apply(cap, gripFrame(false)), { cls: C.POLY, col: COL.poly, tag: 'grip' });
  k.cap(new V3(0, -0.06, 0).applyMatrix4(gripFrame(false)), new V3(0, 0.045, 0).applyMatrix4(gripFrame(false)), 0.018, 0.4, 0.014, 'grip', ['hand']);
}
function addTriggerGuard(k, triggerBone) {
  const tg = rp([[0.02, 0.037, 0], [0.021, 0.016, 0.006], [0.031, 0.009, 0.006], [0.088, 0.009, 0.005], [0.097, 0.016, 0.004], [0.097, 0.037, 0],
    [0.089, 0.037, 0], [0.089, 0.0195, 0.003], [0.084, 0.015, 0.003], [0.033, 0.015, 0.004], [0.0275, 0.0195, 0.003], [0.0275, 0.037, 0]]);
  k.add(side(ext(tg, 0.0078, { bev: 0.0012 })), { wear: 1.1 });
  const trg = rp([[0.049, 0.052, 0], [0.056, 0.052, 0], [0.0555, 0.036, 0.004], [0.051, 0.026, 0.004], [0.0458, 0.0205, 0.002], [0.0436, 0.0228, 0.002], [0.0474, 0.0292, 0.003], [0.0494, 0.038, 0.003]]);
  k.add(side(ext(trg, 0.0056, { bev: 0.0009 })), { cls: C.PARK, col: COL.pin, bone: triggerBone, wear: 1.2 });
}

// ------------------------------------------------------------------ gloved hand
// Hand-local frame (right hand): held object axis = +Y (index side up), palm on +X side,
// fingers wrap via -Z (front) round to -X, wrist toward +Z. `frame` maps local → gun (may mirror).
function addHand(k, frame, o) {
  const tag = o.tag, bone = o.bone;
  const T = (p) => new V3(p[0], p[1], p[2]).applyMatrix4(frame);
  const inv = frame.clone().invert();
  const add = (g, opt = {}) => k.add(g, { tag, bone, cls: C.FABRIC, col: COL.glove, crease: 80, wear: 0, dust: 0.45, ...opt });
  const wf = o.wrap ?? 1;
  const ell = (phi, off, y) => [(o.ax + off) * Math.cos(phi * wf * D), y, (o.az + off) * Math.sin(phi * wf * D)];
  const dorsalOf = (p) => new V3(p[0] / (o.ax + 0.01), 0, p[2] / (o.az + 0.01)).normalize();
  // one finger = 3 capsule phalanges (MCP→PIP→DIP→tip) with knuckle bevels; distal pair rides the
  // finger bone when `split` (trigger finger). Each phalanx gets its own AO tag so joints & neighbours crease.
  let fid = 0;
  const AX = new V3(0, 1, 0).transformDirection(frame);
  const finger = (pts, radii, split) => {
    const f = fid++;
    const G = pts.map(T);
    const tip = G[3].clone().addScaledVector(G[3].clone().sub(G[2]).normalize(), -radii[2] * 0.9);
    const seg = [[G[0], G[1], radii[0], radii[1] * 1.02], [G[1], G[2], radii[1], radii[2] * 1.02], [G[2], tip, radii[2], radii[2] * 0.82]];
    seg.forEach(([a, b, ra, rb], s) => {
      const st = `${tag}f${f}s${s}`, sb = split && s > 0 ? o.fingerBone : bone;
      add(tube([a, b], [ra, rb], 10, true, { up: AX, su: s ? 1.3 : 1.15, sv: 0.8 }), { tag: st, bone: sb });
      k.cap(a, b, (ra + rb) / 2, 0.55, 0.0048, st, [tag]);       // creases between fingers / at joints
      k.cap(a, b, (ra + rb) / 2, 0.5, 0.01, st, ['grip', 'gun', 'mag']); // contact shadow on the gun
    });
    // knuckle bevels: a soft fabric ridge over the PIP and DIP joints (dorsal side)
    for (let j = 1; j <= 2; j++) {
      const P = new V3(...pts[j]), d0 = new V3(...pts[j]).sub(new V3(...pts[j - 1])).normalize(), d1 = new V3(...pts[j + 1]).sub(P).normalize();
      const along = d0.clone().add(d1).normalize();
      const dors = dorsalOf([P.x, P.y, P.z]); dors.addScaledVector(along, -dors.dot(along)).normalize();
      const r = radii[j];
      const m = new THREE.Matrix4().makeBasis(along, dors, new V3().crossVectors(along, dors)).setPosition(P.clone().addScaledVector(dors, r * 0.52)).premultiply(frame);
      const g = new THREE.SphereGeometry(1, 7, 5); g.scale(r * 0.62, r * 0.55, r * 0.78);
      add(apply(g, m), { tag: `${tag}f${f}k${j}`, bone: split ? o.fingerBone : bone, col: COL.gloveSeam });
    }
    // moulded rubber pad on the proximal phalanx
    {
      const a = new V3(...pts[0]), b = new V3(...pts[1]);
      const mid = a.clone().lerp(b, 0.55), dir = b.clone().sub(a).normalize();
      const dors = dorsalOf([mid.x, mid.y, mid.z]); dors.addScaledVector(dir, -dors.dot(dir)).normalize();
      const len = a.distanceTo(b);
      const m = new THREE.Matrix4().makeBasis(dir, dors, new V3().crossVectors(dir, dors)).setPosition(mid.addScaledVector(dors, radii[0] * 0.9)).premultiply(frame);
      add(apply(rbox(len * 0.62, 0.0042, radii[0] * 1.45, 0.0018, 1), m), { tag: `${tag}f${f}p`, cls: C.RUBBER, col: COL.gloveDk, crease: 55, wearBase: 0.1 });
    }
  };
  const FR = [0.0104, 0.01, 0.0092, 0.01]; // middle, ring, pinky, (support) index
  const mcps = [];
  if (o.index) { finger(o.index, [0.0099, 0.0094, 0.0088], true); mcps.push(o.index[0]); }
  else {
    const y = o.fingers[0] + 0.0208, r = FR[3];
    const pts = [ell(8, 0.02, y), ell(-62, r, y + 0.001), ell(-126, r * 0.96, y + 0.001), ell(-180, r * 0.85, y)];
    finger(pts, [r, r * 0.96, r * 0.9]); mcps.push(pts[0]);
  }
  o.fingers.forEach((y, i) => {
    const r = FR[i], pk = i === 2;
    const pts = [ell(8, 0.02, y), ell(pk ? -60 : -64, r * 0.92, y - 0.001), ell(pk ? -122 : -128, r * 0.86, y - 0.002), ell(pk ? -196 : -210, r * 0.74, y - 0.003)];
    finger(pts, [r, r * 0.98, r * 0.95]); mcps.push(pts[0]);
  });
  // palm, heel, thenar
  const pf = new THREE.Matrix4().makeRotationY(-11.5 * D).setPosition(0.0265, -0.004, 0.041).premultiply(frame);
  { const g = new THREE.SphereGeometry(1, 12, 9); g.scale(0.0138, 0.043, 0.046); add(apply(g, pf), { col: COL.glove }); }
  add(ellipsoid(v3(0.016, -0.028, 0.048), 0.013, 0.022, 0.016, frame, 7, 5), { col: COL.palm, cls: C.SYNTH });
  add(ellipsoid(v3(0.015, 0.018, 0.049), 0.013, 0.02, 0.017, frame, 7, 5), { col: COL.palm, cls: C.SYNTH });
  k.cap(T([0.014, -0.03, 0.05]), T([0.028, 0.02, 0.01]), 0.016, 0.4, 0.012, tag);
  // back-of-hand knuckle armour: moulded plate + one bump per knuckle
  const top = new V3(...mcps[0]), bot = new V3(...mcps[mcps.length - 1]);
  const kc = top.clone().lerp(bot, 0.5); const dors = dorsalOf([kc.x, 0, kc.z]);
  add(basisBox(0.0045, top.distanceTo(bot) + 0.02, 0.02, 0.002, kc.clone().addScaledVector(dors, 0.0095), dors, top.clone().sub(bot), frame), { cls: C.RUBBER, col: COL.gloveDk, crease: 50, wearBase: 0.08 });
  for (const m of mcps) { const c = new V3(...m); add(ellipsoid(c.addScaledVector(dorsalOf(m), 0.0118), 0.0042, 0.0078, 0.0082, frame, 6, 4), { cls: C.RUBBER, col: COL.gloveDk, crease: 70, wearBase: 0.15 }); }
  // moulded TPR back-of-hand plate with two flex grooves + stitched seam ridge
  {
    const bx = v3(Math.cos(-11.5 * D), 0, -Math.sin(-11.5 * D)), bz = v3(Math.sin(-11.5 * D), 0, Math.cos(-11.5 * D));
    const c = v3(0.0265, -0.004, 0.041).addScaledVector(bx, 0.0128).addScaledVector(bz, -0.004);
    add(basisBox(0.0045, 0.052, 0.04, 0.002, c, bx, v3(0, 1, 0), frame), { tag: tag + 'bp', cls: C.RUBBER, col: COL.gloveDk, crease: 50, wearBase: 0.06 });
    for (const dz of [-0.008, 0.007]) add(basisBox(0.0042, 0.054, 0.0022, 0.0009, c.clone().addScaledVector(bx, 0.0012).addScaledVector(bz, dz), bx, v3(0, 1, 0), frame), { tag: tag + 'bg', cls: C.FABRIC, col: COL.gloveSeam });
    k.box(c, v3(0.004, 0.026, 0.02), 0.0, 0.001, tag + 'bp');
  }
  // thumb (single tube)
  const th = o.thumb === 'forward'
    ? [[0.017, 0.008, 0.05], [0.004, 0.03, 0.046], [-0.004, 0.055, 0.04], [-0.006, 0.076, 0.036]]
    : [[0.017, 0.012, 0.05], [0.004, 0.03, 0.05], [-0.016, 0.032, 0.034], [-0.027, 0.031, 0.012]];
  {
    const G = th.map(T), R = [0.0132, 0.0121, 0.0108, 0.0098];
    add(tube([G[0], G[1]], [R[0], R[1]], 10, true), { tag: tag + 'f9s0' });
    const tip = G[3].clone().addScaledVector(G[3].clone().sub(G[2]).normalize(), -R[3] * 0.8);
    add(tube([G[1], G[2]], [R[1], R[2]], 10, true), { tag: tag + 'f9s1' });
    add(tube([G[2], tip], [R[2], R[3]], 10, true), { tag: tag + 'f9s2' });
    for (let i = 0; i < 3; i++) { k.cap(G[i], G[i + 1], R[i + 1], 0.55, 0.005, tag + 'f9s' + i, [tag]); k.cap(G[i], G[i + 1], R[i + 1], 0.5, 0.01, tag + 'f9s' + i, ['grip', 'gun']); }
    // knuckle pad on the thumb's proximal joint
    const P = new V3(...th[1]), dd = new V3(...th[2]).sub(new V3(...th[0])).normalize(), up = new V3(0.35, 0, 1).normalize(); up.addScaledVector(dd, -up.dot(dd)).normalize();
    const m = new THREE.Matrix4().makeBasis(dd, up, new V3().crossVectors(dd, up)).setPosition(P.clone().addScaledVector(up, R[1] * 0.85)).premultiply(frame);
    add(apply(rbox(0.012, 0.004, 0.013, 0.0018, 1), m), { tag: tag + 'f9p', cls: C.RUBBER, col: COL.gloveDk, crease: 55, wearBase: 0.1 });
  }
  // wrist, cuff, velcro strap, sleeve
  const W = new V3(0.018, -0.01, 0.08);
  add(ellipsoid(W, 0.019, 0.027, 0.02, frame, 8, 6), { col: COL.glove });
  const F = o.wristDir.clone().transformDirection(inv);
  const P0 = W.clone().addScaledVector(F, 0.004);
  const Lp = (d) => T(P0.clone().addScaledVector(F, d).toArray());
  add(cylAB(Lp(0), Lp(0.036), 0.025, 0.0275, 12), { col: COL.glove });
  add(cylAB(Lp(0.01), Lp(0.03), 0.0288, 0.0292, 12), { cls: C.RUBBER, col: COL.gloveDk, crease: 50 });
  add(cylAB(Lp(0.034), Lp(0.046), 0.0335, 0.035, 12), { col: COL.sleeve, crease: 50 });
  add(cylAB(Lp(0.042), Lp(0.12), 0.033, 0.036, 12), { col: COL.sleeve, crease: 50, wear: 0 });
  // long forearm sleeve (desktop) on its own bone so VR can collapse it
  const sb = o.sleeveBone ?? bone;
  add(cylAB(Lp(0.118), Lp(0.42), 0.036, 0.058, 12), { col: COL.sleeve, crease: 50, bone: sb, dust: 0.2 });
  return { sleevePivot: Lp(0.118) };
}

// ------------------------------------------------------------------ picatinny rail
const RAIL_BASE = [[-0.0085, 0], [0.0085, 0], [0.0085, 0.0037], [-0.0085, 0.0037]];
const RAIL_TOOTH = [[-0.0085, 0.0034], [0.0085, 0.0034], [0.0106, 0.0058], [0.0094, 0.008], [-0.0094, 0.008], [-0.0106, 0.0058]];
const RAIL_H = 0.008;
let toothGeo = null;
function addRail(k, y0, u0, u1, skip = () => false) {
  const base = ext(RAIL_BASE.map(([x, y]) => [x, y + y0]), u1 - u0, { bev: 0.0006, seg: 1 });
  k.add(rear(base, -(u0 + u1) / 2), { wear: 0.9 });
  if (!toothGeo) toothGeo = ext(RAIL_TOOTH, 0.0053, { bev: 0 });
  for (let u = u0 + 0.004; u < u1 - 0.004; u += 0.01) {
    if (skip(u)) continue;
    k.add(rear(toothGeo.clone().translate(0, y0, 0), -u), { chamfer: true, wear: 0.9, crease: 20 });
  }
}

// ------------------------------------------------------------------ emissive canvas (reticle + ammo counter)
function makeHud() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const ctx = cv.getContext('2d');
  // reticle (EOTech-style ring + dot) in the left half
  ctx.save();
  ctx.translate(64, 64);
  ctx.shadowColor = 'rgba(255,40,20,1)'; ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ff3a22'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, 40, 0, PI * 2); ctx.stroke();
  ctx.fillStyle = '#ff5a3a'; ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.beginPath();
  for (const a of [0, PI / 2, PI, PI * 1.5]) { ctx.moveTo(Math.cos(a) * 31, Math.sin(a) * 31); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); }
  ctx.stroke();
  ctx.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  mat.name = 'weaponHud';
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
  const seg7 = (x, y, w, h, s, ch, on, off) => {
    const t = 6.5, segs = SEG[ch] || '';
    const R = { a: [x + t, y, w - 2 * t, t], b: [x + w - t, y + t, t, h / 2 - t * 1.5], c: [x + w - t, y + h / 2 + t * 0.5, t, h / 2 - t * 1.5], d: [x + t, y + h - t, w - 2 * t, t], e: [x, y + h / 2 + t * 0.5, t, h / 2 - t * 1.5], f: [x, y + t, t, h / 2 - t * 1.5], g: [x + t, y + h / 2 - t / 2, w - 2 * t, t] };
    for (const key of 'abcdefg') { const r = R[key]; s.fillStyle = segs.includes(key) ? on : off; s.save(); s.translate(r[0] + r[2] / 2, r[1] + r[3] / 2); s.transform(1, 0, -0.12, 1, 0, 0); s.fillRect(-r[2] / 2, -r[3] / 2, r[2], r[3]); s.restore(); }
  };
  let shown = null;
  const draw = (n, max, reloading) => {
    const key = reloading ? 'R' : n;
    if (key === shown) return; shown = key;
    ctx.clearRect(128, 0, 128, 64);
    const low = !reloading && n <= Math.ceil(max * 0.2);
    const on = low ? '#ff3218' : '#ffa424', off = 'rgba(255,140,40,0.08)';
    ctx.shadowColor = on; ctx.shadowBlur = 6;
    const s = reloading ? '--' : String(Math.max(0, Math.min(99, n))).padStart(2, '0');
    seg7(150, 3, 34, 46, ctx, s[0] === '-' ? '-' : +s[0], on, off);
    seg7(192, 3, 34, 46, ctx, s[1] === '-' ? '-' : +s[1], on, off);
    ctx.shadowBlur = 0;
    // round-count bar
    const f = reloading ? 0 : n / max;
    for (let i = 0; i < 15; i++) { ctx.fillStyle = i / 15 < f ? on : off; ctx.fillRect(136 + i * 7.6, 53, 5.5, 8); }
    ctx.fillStyle = on; ctx.fillRect(134, 8, 9, 3); ctx.fillRect(134, 16, 6, 3); ctx.fillRect(134, 24, 9, 3); // status ticks
    tex.needsUpdate = true;
  };
  return { tex, mat, draw };
}
function quad(w, h, u0, v0, u1, v1) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, mix(u0, u1, uv.getX(i)), mix(v0, v1, uv.getY(i)));
  return g;
}

// =====================================================================================
// RIFLE — modern M4-pattern carbine
// =====================================================================================
export function buildRifle(opts = {}) {
  const supportHand = opts.supportHand !== false;
  const k = new Kit();
  const RB = { root: 0, mag: 1, bolt: 2, charge: 3, trigger: 4, dust: 5, finger: 6, support: 7 };
  const idxPivot = IDX_LOCAL[1].clone().applyMatrix4(gripFrame(false));
  const SUP = new V3(0, 0.072, -0.3);
  const boneDefs = [
    { name: 'root', pos: [0, 0, 0] },
    { name: 'mag', pos: [0, 0.05, -0.135], parent: 0 },
    { name: 'bolt', pos: [0.008, BY, -0.07], parent: 0 },
    { name: 'charge', pos: [0, 0.092, 0.08], parent: 0 },
    { name: 'trigger', pos: [0, 0.05, -0.0525], parent: 0 },
    { name: 'dust', pos: [0.0139, 0.0632, -0.0675], parent: 0 },
    { name: 'finger', pos: idxPivot.toArray(), parent: 0 },
    { name: 'support', pos: SUP.toArray(), parent: 0 },
  ];
  const ANO = { cls: C.ANO, col: COL.ano };

  // ---------------- upper receiver (two halves so the ejection port is a real recess)
  const upperOut = rp([[-0.075, 0.056, 0.0015], [-0.075, 0.094, 0.003], [-0.068, 0.0972, 0.002], [0.19, 0.0972, 0.002], [0.192, 0.093, 0.002], [0.192, 0.056, 0.0015]]);
  const portHole = rp([[0.035, 0.0645], [0.1, 0.0645], [0.1, 0.0862], [0.035, 0.0862]], 0.003);
  k.add(side(ext(upperOut, 0.0175, { bev: 0.0022 }), -0.00475), { ...ANO, tint: (x, y, z, nx) => (nx > 0.7 && x > 0.003 ? 0.22 : 1) });
  k.add(side(ext(upperOut, 0.013, { bev: 0.0022, holes: [portHole] }), 0.0065), { ...ANO, tint: (x, y, z, nx, ny, nz) => (x < 0.012 && x > 0.004 && y > 0.063 && y < 0.088 && -z > 0.033 && -z < 0.102 ? 0.55 : 1) });
  // brass deflector + forward assist
  k.add(at(rbox(0.007, 0.014, 0.014, 0.0028), 0.0145, 0.0885, -0.026, 0, 0.35, 0), ANO);
  k.add(cylAB(v3(0.011, 0.0835, -0.004), v3(0.0185, 0.0835, 0.036), 0.0066, 0.0062, 14), ANO);
  k.add(cylAB(v3(0.0185, 0.0835, 0.036), v3(0.0198, 0.0835, 0.0445), 0.0056, 0.0056, 14), { cls: C.PARK, col: COL.pin, wear: 1.3 });
  for (let i = 0; i < 3; i++) k.add(cylAB(v3(0.0186 + i * 0.0004, 0.0835, 0.0375 + i * 0.0025), v3(0.0187 + i * 0.0004, 0.0835, 0.0385 + i * 0.0025), 0.0059, 0.0059, 14), { cls: C.PARK, col: COL.ano });
  // ---------------- dust cover (bone) + bolt carrier (bone)
  k.add(at(rbox(0.0016, 0.0232, 0.068, 0.0007), 0.0141, 0.0752, -0.0675), { ...ANO, bone: RB.dust, wear: 1.1 });
  k.add(at(rbox(0.0014, 0.0035, 0.05, 0.0006), 0.0153, 0.0795, -0.0675), { ...ANO, bone: RB.dust });
  k.add(cylAB(v3(0.0139, 0.0632, -0.03), v3(0.0139, 0.0632, -0.105), 0.0012, 0.0012, 6), { cls: C.PARK, col: COL.pin, bone: RB.dust });
  k.add(at(rbox(0.0075, 0.019, 0.078, 0.0016), 0.0079, BY, -0.071), { cls: C.STEEL, col: COL.steel, bone: RB.bolt, wear: 0.6, dust: 0 });
  for (let i = 0; i < 5; i++) k.add(at(new THREE.BoxGeometry(0.0008, 0.011, 0.0014), 0.0117, BY - 0.002, -0.042 - i * 0.0035), { cls: C.PARK, col: COL.park, bone: RB.bolt, dust: 0 });
  k.add(cylAB(v3(0.006, BY, -0.1), v3(0.006, BY, -0.116), 0.0062, 0.0062, 10), { cls: C.STEEL, col: [0.3, 0.3, 0.31], bone: RB.bolt, dust: 0 });
  k.add(at(new THREE.BoxGeometry(0.003, 0.004, 0.01), 0.0105, BY + 0.005, -0.108), { cls: C.PARK, col: COL.park, bone: RB.bolt, dust: 0 });
  // ---------------- charging handle (bone)
  const chp = rp([[-0.0195, -0.0775, 0.003], [-0.0195, -0.087, 0.003], [0.0195, -0.087, 0.003], [0.0195, -0.0775, 0.003], [0.0048, -0.0755, 0.002], [0.0048, -0.05, 0], [-0.0048, -0.05, 0], [-0.0048, -0.0755, 0.002]]);
  k.add(plan(ext(chp, 0.0068, { bev: 0.0012 }), 0.0915), { ...ANO, bone: RB.charge, wear: 1.2 });
  k.add(at(rbox(0.006, 0.004, 0.006, 0.0012), -0.0145, 0.096, 0.083), { ...ANO, bone: RB.charge });

  // ---------------- lower receiver
  const lowerOut = rp([[-0.075, 0.0575, 0], [0.186, 0.0575, 0], [0.186, 0.046, 0.004], [0.174, 0.038, 0.003], [0.177, 0.003, 0.002], [0.094, 0.003, 0.002], [0.094, 0.034, 0.004],
    [0.026, 0.035, 0.004], [-0.034, 0.035, 0.006], [-0.06, 0.04, 0.008], [-0.075, 0.05, 0.004]]);
  k.add(side(ext(lowerOut, 0.024, { bev: 0.0021 })), { ...ANO, tint: (x, y, z, nx, ny) => (ny < -0.8 && y < 0.006 && -z > 0.096 && -z < 0.175 ? 0.12 : 1) });
  k.add(plan(ext(rp([[-0.0148, 0.089, 0.005], [0.0148, 0.089, 0.005], [0.0148, 0.182, 0.004], [-0.0148, 0.182, 0.004]]), 0.007, { bev: 0.0014, holes: [rp([[-0.0123, 0.097], [0.0123, 0.097], [0.0123, 0.174], [-0.0123, 0.174]], 0.002)] }), 0.0055), { ...ANO, wear: 1.1 });
  k.add(at(new THREE.BoxGeometry(0.005, 0.0012, 0.05), 0, 0.0346, -0.058), { cls: C.POLY, col: [0.006, 0.006, 0.006], wear: 0, dust: 0 });
  // pins, bolt catch, selector, mag release
  for (const [u, v] of [[-0.062, 0.051], [0.181, 0.051], [0.052, 0.05], [0.02, 0.049]]) k.add(cylAB(v3(-0.0128, v, -u), v3(0.0128, v, -u), 0.0029, 0.0029, 10), { cls: C.PARK, col: COL.pin, wear: 1.4 });
  k.add(side(ext(rp([[0.081, 0.039, 0.002], [0.094, 0.041, 0.002], [0.096, 0.056, 0.003], [0.085, 0.057, 0.002]]), 0.0028, { bev: 0.0007 }), -0.0134), { ...ANO, wear: 1.3 });
  for (let i = 0; i < 3; i++) k.add(at(new THREE.BoxGeometry(0.0012, 0.0012, 0.011), -0.0152, 0.046 + i * 0.0035, -0.0885, 0.05), { ...ANO });
  k.add(cylAB(v3(-0.0118, 0.048, 0.022), v3(-0.0136, 0.048, 0.022), 0.0052, 0.0052, 14), { cls: C.PARK, col: COL.pin });
  k.add(side(ext(rp([[-0.024, 0.0452, 0.002], [0.001, 0.0462, 0.002], [0.003, 0.0512, 0.002], [-0.024, 0.0508, 0.002]]), 0.0024, { bev: 0.0006 }), -0.0146), { cls: C.PARK, col: COL.pin, wear: 1.5 });
  k.add(cylAB(v3(0.0115, 0.0425, -0.087), v3(0.0158, 0.0425, -0.087), 0.0042, 0.0042, 12), { cls: C.PARK, col: COL.pin, wear: 1.2 });
  k.add(side(ext(rp([[0.075, 0.034, 0.003], [0.099, 0.034, 0.003], [0.099, 0.052, 0.003], [0.075, 0.052, 0.003]]), 0.002, { bev: 0.0006, holes: [circle(0.087, 0.0425, 0.0052, 12)] }), 0.0126), { ...ANO });

  addGrip(k, false);
  addTriggerGuard(k, RB.trigger);

  // ---------------- buffer tube, castle nut, stock
  k.add(lathe([[0.0, -0.272], [0.0128, -0.272], [0.0148, -0.27], [0.0148, -0.083]], 14, 0.0725), { ...ANO, crease: 50, lw: true, tag: 'tube' });
  k.add(lathe([[0.0149, -0.0841], [0.0178, -0.0838], [0.0184, -0.0815], [0.0184, -0.0785], [0.0178, -0.076], [0.0149, -0.0757]], 12, 0.0725), { ...ANO, wear: 1.3, crease: 50, lw: true, tag: 'tube' });
  k.add(side(ext(rp([[-0.083, 0.0605, 0.0012], [-0.27, 0.0605, 0.0012], [-0.27, 0.0545, 0.0012], [-0.083, 0.0545, 0.0012]]), 0.0072, { bev: 0, holes: [0, 1, 2, 3, 4].map((i) => circle(-0.2 - i * 0.0135, 0.0577, 0.0016, 6)) })), { ...ANO, chamfer: false });
  const FDE = { cls: C.POLY, col: COL.poly, wear: 0.7 };
  k.add(side(ext(rp([[-0.153, 0.0505, 0.003], [-0.153, 0.0915, 0.004], [-0.191, 0.0945, 0.01], [-0.211, 0.1055, 0.008], [-0.283, 0.1075, 0.006], [-0.298, 0.1025, 0.004], [-0.298, 0.0505, 0]]), 0.036, { bev: 0.0042, seg: 2 })), FDE);
  k.add(side(ext(rp([[-0.165, 0.056, 0], [-0.298, 0.056, 0], [-0.299, -0.036, 0.004], [-0.283, -0.0405, 0.006], [-0.17, 0.044, 0.01]]), 0.0175, { bev: 0.003, seg: 2,
    holes: [rp([[-0.269, 0.04], [-0.269, -0.016], [-0.283, -0.022], [-0.283, 0.04]], 0.0045), rp([[-0.206, 0.045], [-0.255, 0.045], [-0.255, 0.009]], 0.006)] })), FDE);
  k.add(side(ext(rp([[-0.297, 0.109, 0.006], [-0.311, 0.107, 0.005], [-0.312, -0.039, 0.005], [-0.298, -0.043, 0.006]]), 0.04, { bev: 0.004, seg: 2 })), { cls: C.RUBBER, col: COL.rubber, wear: 0.5 });
  for (let i = 0; i < 6; i++) k.add(at(new THREE.BoxGeometry(0.041, 0.0016, 0.0016), 0, 0.09 - i * 0.022, 0.3118), { cls: C.RUBBER, col: [0.02, 0.02, 0.02], wear: 0 });
  k.add(at(cbox(0.012, 0.007, 0.03), 0, 0.0505, 0.175), { cls: C.POLY, col: COL.poly });

  // ---------------- free-float M-LOK handguard (8 panels, real slots)
  const OCT = [[-0.0112, 0.0975], [0.0112, 0.0975], [0.0232, 0.0855], [0.0232, 0.0585], [0.0122, 0.0465], [-0.0122, 0.0465], [-0.0232, 0.0585], [-0.0232, 0.0855]];
  const HG0 = 0.193, HG1 = 0.462, HT = 0.0026;
  const hgTint = (x, y, z, nx, ny) => ((nx * x + ny * (y - 0.072)) < -0.004 ? 0.28 : 1);
  for (let i = 0; i < 8; i++) {
    const A = OCT[i], Bp = OCT[(i + 1) % 8];
    const dx = Bp[0] - A[0], dy = Bp[1] - A[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const holes = [];
    if (i === 2 || i === 6) for (let s = 0; s < 5; s++) holes.push(stadium(0.236 + s * 0.045, L / 2, 0.032, 0.0074, 3));
    if (i === 4) for (let s = 0; s < 4; s++) holes.push(stadium(0.258 + s * 0.05, L / 2, 0.032, 0.0074, 3));
    const g = ext([[HG0, 0], [HG1, 0], [HG1, L], [HG0, L]], HT, { bev: holes.length ? 0 : 0.0006, seg: 1, holes });
    g.translate(0, 0, HT / 2);
    const m = new THREE.Matrix4().set(0, ux, uy, A[0], 0, uy, -ux, A[1], -1, 0, 0, 0, 0, 0, 0, 1);
    k.add(apply(g, m), { ...ANO, tint: hgTint, wearFn: (x, y) => { let d = 1; for (const c of OCT) d = Math.min(d, Math.hypot(x - c[0], y - c[1])); return sstep(0.0042, 0.0012, d); } });
  }
  const octIn = OCT.map(([x, y]) => [x * 0.985, 0.072 + (y - 0.072) * 0.985]);
  k.add(rear(ext(octIn, 0.004, { bev: 0.0009, holes: [circle(0, 0.072, 0.0108, 14)] }), -HG1 - 0.001), { ...ANO, wear: 1.2 });
  k.add(rear(ext(octIn, 0.004, { bev: 0.0009, holes: [circle(0, 0.072, 0.0135, 14)] }), -HG0 - 0.0015), { ...ANO, wear: 1.2 });
  // QD socket + sling swivel (left, front)
  k.add(cylAB(v3(-0.022, 0.071, -0.44), v3(-0.0285, 0.071, -0.44), 0.0062, 0.0058, 14), ANO);
  k.add(cylAB(v3(-0.0285, 0.071, -0.44), v3(-0.0295, 0.066, -0.44), 0.0018, 0.0018, 6), { cls: C.STEEL, col: [0.25, 0.25, 0.26] });
  k.add(at(new THREE.TorusGeometry(0.0095, 0.0017, 6, 14), -0.0298, 0.0555, -0.44, 0, PI / 2, 0), { cls: C.STEEL, col: [0.22, 0.22, 0.23], wear: 1.2, crease: 70 });
  // barrel, gas block, flash hider
  k.add(lathe([[0.0092, 0.19], [0.0092, 0.53], [0.0085, 0.5345], [0.0085, 0.548], [0.0072, 0.549], [0.0072, 0.556]], 16), { cls: C.PARK, col: COL.park, crease: 50, lw: true });
  k.add(at(rbox(0.024, 0.026, 0.02, 0.003), 0, BY - 0.002, -0.405), { cls: C.PARK, col: COL.park });
  k.add(cylAB(v3(0, BY + 0.0155, -0.2), v3(0, BY + 0.0155, -0.4), 0.0026, 0.0026, 8), { cls: C.STEEL, col: [0.2, 0.2, 0.2] });
  k.add(lathe([[0.0072, 0.5475], [0.0104, 0.548], [0.0117, 0.5505], [0.0117, 0.5655], [0.0099, 0.567]], 12), { cls: C.PARK, col: COL.park, wear: 1.3, crease: 50, lw: true });
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + i * PI / 2, h = 27 * D;
    const sect = [...arcPts(0, BY, 0.0116, a - h, a + h, 4), ...arcPts(0, BY, 0.0064, a + h, a - h, 4)];
    k.add(rear(ext(sect, 0.048, { bev: 0.0007, seg: 1 }), -0.5895), { cls: C.PARK, col: COL.park, wear: 1.2, tint: (x, y, z, nx, ny) => (nx * x + ny * (y - BY) < 0 ? 0.3 : 1) });
  }
  k.add(lathe([[0.0064, 0.56], [0.0064, 0.612]], 8), { cls: C.PARK, col: [0.012, 0.012, 0.012], wear: 0, dust: 0 });

  // ---------------- top rail, sights
  const RAIL_Y = 0.0972;
  const holoU0 = -0.026, holoU1 = 0.07;
  addRail(k, RAIL_Y, -0.072, 0.19, (u) => u > -0.073 && u < holoU1 + 0.002);
  addRail(k, RAIL_Y, 0.192, 0.461, (u) => u > 0.43 && u < 0.459);
  const RT = RAIL_Y + RAIL_H; // rail top
  const clampP = rp([[-0.0126, RAIL_Y + 0.0012, 0.001], [0.0126, RAIL_Y + 0.0012, 0.001], [0.0126, RT + 0.003, 0.002], [0.009, RT + 0.0055, 0.002], [-0.009, RT + 0.0055, 0.002], [-0.0126, RT + 0.003, 0.002]]);
  // front flip sight (deployed)
  k.add(rear(ext(clampP, 0.027, { bev: 0.001 }), -0.4445), ANO);
  k.add(rear(ext(rp([[-0.009, RT + 0.004, 0], [0.009, RT + 0.004, 0], [0.0092, RT + 0.031, 0.003], [0.0056, RT + 0.032, 0.0015], [0.0046, RT + 0.022, 0.002], [-0.0046, RT + 0.022, 0.002], [-0.0056, RT + 0.032, 0.0015], [-0.0092, RT + 0.031, 0.003]]), 0.0072, { bev: 0.0009 }), -0.447), { ...ANO, wear: 1.2 });
  k.add(at(new THREE.BoxGeometry(0.0022, 0.012, 0.0022), 0, RT + 0.024, -0.447), { cls: C.PARK, col: COL.pin });
  k.add(cylAB(v3(-0.0105, RT + 0.006, -0.4405), v3(0.0105, RT + 0.006, -0.4405), 0.0022, 0.0022, 8), { cls: C.PARK, col: COL.pin, wear: 1.4 });
  // rear flip sight (folded flat behind the ammo-counter module)
  k.add(rear(ext(clampP, 0.022, { bev: 0.001 }), 0.0625), ANO);
  k.add(side(ext(rp([[-0.054, RT + 0.0045, 0.0015], [-0.072, RT + 0.0045, 0.002], [-0.072, RT + 0.009, 0.002], [-0.058, RT + 0.0095, 0.002]]), 0.0186, { bev: 0.0009 })), { ...ANO, wear: 1.3 });
  k.add(cylAB(v3(0.0094, RT + 0.0058, 0.055), v3(0.0128, RT + 0.0058, 0.055), 0.0028, 0.0028, 10), { cls: C.PARK, col: COL.pin, wear: 1.5 });

  // ---------------- holographic sight
  const HB = RT; // body sits on rail top
  k.add(side(ext(rp([[holoU0, HB - 0.0035, 0], [holoU1, HB - 0.0035, 0], [holoU1, HB + 0.0125, 0.004], [holoU1 - 0.008, HB + 0.0165, 0.004], [holoU0 + 0.008, HB + 0.0165, 0.004], [holoU0, HB + 0.011, 0.004]]), 0.033, { bev: 0.002 })), { ...ANO, tag: 'holo' });
  k.add(rear(ext(rp([[-0.0128, RAIL_Y + 0.001], [0.0128, RAIL_Y + 0.001], [0.0128, HB + 0.001], [-0.0128, HB + 0.001]], 0.001), holoU1 - holoU0 - 0.01, { bev: 0.001 }), -(holoU0 + holoU1) / 2), { ...ANO, tag: 'holo' });
  k.add(side(ext(rp([[holoU0 + 0.012, RAIL_Y + 0.0015, 0.002], [holoU0 + 0.056, RAIL_Y + 0.003, 0.002], [holoU0 + 0.06, RAIL_Y + 0.0085, 0.003], [holoU0 + 0.012, RAIL_Y + 0.0095, 0.002]]), 0.0032, { bev: 0.0008 }), -0.0148), { ...ANO, wear: 1.4 });
  k.add(cylAB(v3(-0.0175, RAIL_Y + 0.005, -(holoU0 + 0.016)), v3(-0.0145, RAIL_Y + 0.005, -(holoU0 + 0.016)), 0.0035, 0.0035, 10), { cls: C.PARK, col: COL.pin, wear: 1.5 });
  const HW0 = HB + 0.009, HW1 = HB + 0.049; // hood outer v range
  const hoodOut = rp([[-0.0215, HW0, 0.004], [0.0215, HW0, 0.004], [0.0215, HW1 - 0.008, 0.008], [0.012, HW1, 0.006], [-0.012, HW1, 0.006], [-0.0215, HW1 - 0.008, 0.008]]);
  const hoodIn = rp([[-0.0168, HW0 + 0.0045, 0.003], [0.0168, HW0 + 0.0045, 0.003], [0.0168, HW1 - 0.0095, 0.006], [0.0098, HW1 - 0.0045, 0.004], [-0.0098, HW1 - 0.0045, 0.004], [-0.0168, HW1 - 0.0095, 0.006]]);
  const winC = new V3(0, (HW0 + 0.0045 + HW1 - 0.0045) / 2, 0);
  k.add(rear(ext(hoodOut, 0.052, { bev: 0.0016, holes: [hoodIn] }), -0.042), { ...ANO, wear: 1.0, tag: 'holo', tint: (x, y, z, nx, ny) => (nx * x + ny * (y - winC.y) < -0.003 ? 0.35 : 1) });
  k.add(at(rbox(0.0055, 0.0045, 0.003, 0.0012), -0.0065, HB + 0.0085, -holoU0 + 0.0012), { cls: C.RUBBER, col: COL.rubber });
  k.add(at(rbox(0.0055, 0.0045, 0.003, 0.0012), 0.0065, HB + 0.0085, -holoU0 + 0.0012), { cls: C.RUBBER, col: COL.rubber });
  k.add(cylAB(v3(0.0165, HB + 0.006, -0.005), v3(0.0205, HB + 0.006, -0.005), 0.0042, 0.0042, 12), { cls: C.ANO, col: COL.ano, wear: 1.4 });
  k.add(cylAB(v3(-0.002, HB + 0.0165, 0.006), v3(-0.002, HB + 0.0195, 0.006), 0.0048, 0.0048, 12), { cls: C.ANO, col: COL.ano, wear: 1.4 });

  // ---------------- ammo counter module: rail-mounted behind the optic, screen raked back/up at the eye
  const SA = [-0.0515, RT + 0.004], SB = [-0.036, RT + 0.018];
  const sd = [SB[0] - SA[0], SB[1] - SA[1]], sl = Math.hypot(sd[0], sd[1]);
  // (u,v) slope → outward normal faces back (+z) and up toward the eye
  const scrN = new V3(0, sd[0] / sl, sd[1] / sl), scrC = new V3(0, (SA[1] + SB[1]) / 2, -(SA[0] + SB[0]) / 2);
  const scrTilt = Math.atan2(scrN.y, scrN.z);
  k.add(rear(ext(clampP, 0.025, { bev: 0.001 }), 0.04), ANO);
  k.add(side(ext(rp([[-0.0278, RAIL_Y + 0.004, 0.001], [-0.0278, SB[1] + 0.0012, 0.0018], [SB[0] + 0.001, SB[1] + 0.0022, 0.002], [SA[0] - 0.0006, SA[1] + 0.0006, 0.002], [SA[0] - 0.0006, RAIL_Y + 0.004, 0.001]]), 0.0355, { bev: 0.0016 })), { ...ANO, tag: 'ctr', wear: 1.2 });
  k.add(apply(rbox(0.031, sl * 0.86, 0.0012, 0.0005), new THREE.Matrix4().makeRotationX(-scrTilt).setPosition(scrC.clone().addScaledVector(scrN, 0.0003))), { cls: C.GLOSS, col: COL.screen, wear: 0, dust: 0.15, tag: 'ctr' });
  for (const sx of [-1, 1]) k.add(cylAB(v3(sx * 0.0178, RT + 0.009, 0.034), v3(sx * 0.0186, RT + 0.009, 0.034), 0.0022, 0.0022, 8), { cls: C.PARK, col: COL.pin, wear: 1.5 });

  // ---------------- magazine (bone): curved polymer mag with ribs, floorplate, top round
  const MAGT = 0.047, MAGB = -0.192, Rb = 0.55, Rf = 0.483, uc = 0.101 + Rb;
  const ab = Math.asin((MAGT - MAGB) / Rb), af = Math.asin((MAGT - MAGB) / Rf), NM = 10;
  const pb = (a) => [uc - Rb * Math.cos(a), MAGT - Rb * Math.sin(a)], pf = (a) => [uc - Rf * Math.cos(a), MAGT - Rf * Math.sin(a)];
  const back = [], frontE = [];
  for (let i = 0; i <= NM; i++) { back.push([...pb(ab * i / NM), i === NM ? 0.004 : 0]); frontE.push([...pf(af * i / NM), i === NM ? 0.004 : 0]); }
  const magOut = rp([...back, ...frontE.reverse()], 0, 2);
  const MAG = { cls: C.POLY, col: COL.poly, bone: RB.mag, tag: 'mag', wear: 0.9 };
  k.add(side(ext(magOut, 0.0245, { bev: 0.0018, seg: 1 })), { ...MAG, crease: 50 });
  // ribs (horizontal, lower third) and a long arc rib
  for (const s of [-1, 1]) {
    for (let r = 0; r < 4; r++) {
      const t = 0.63 + r * 0.075, A = pb(ab * t), Bf = pf(af * t);
      const dx = Bf[0] - A[0], dy = Bf[1] - A[1], L = Math.hypot(dx, dy), nx = -dy / L * 0.0012, ny = dx / L * 0.0012;
      const a0 = [A[0] + dx / L * 0.006, A[1] + dy / L * 0.006], b0 = [Bf[0] - dx / L * 0.006, Bf[1] - dy / L * 0.006];
      k.add(side(ext([[a0[0] - nx, a0[1] - ny], [b0[0] - nx, b0[1] - ny], [b0[0] + nx, b0[1] + ny], [a0[0] + nx, a0[1] + ny]], 0.0016, { bev: 0.0005, seg: 1 }), s * 0.0127), MAG);
    }
    const Rm = (Rb + Rf) / 2, a0 = 0.03, a1 = ab * 0.52;
    const arcR = [...arcPts(uc, MAGT, Rm + 0.0016, PI + a0, PI + a1, 6), ...arcPts(uc, MAGT, Rm - 0.0016, PI + a1, PI + a0, 6)];
    k.add(side(ext(arcR, 0.0014, { bev: 0.0005, seg: 1 }), s * 0.0126), MAG);
  }
  {
    const a = ab, Bb = pb(a), Fb = pf(af), td = [Math.sin(a), -Math.cos(a)], out = [-Math.cos(a), -Math.sin(a)];
    const P = (p, d, o) => [p[0] + td[0] * d + out[0] * o, p[1] + td[1] * d + out[1] * o];
    k.add(side(ext(rp([[...P(Bb, -0.012, 0.0028), 0.002], [...P(Bb, 0.0055, 0.0028), 0.003], [...P(Fb, 0.0055, -0.0045), 0.003], [...P(Fb, -0.004, -0.0045), 0.002], [...P(Fb, -0.012, -0.0005), 0.001]]), 0.029, { bev: 0.0022, seg: 2 })), { ...MAG, col: COL.fde });
  }
  k.add(cylAB(v3(0, MAGT + 0.0045, -0.11), v3(0, MAGT + 0.0045, -0.148), 0.0048, 0.0048, 10), { cls: C.BRASS, col: COL.brass, bone: RB.mag, tag: 'mag', dust: 0 });
  k.add(lathe([[0.0046, 0.148], [0.0044, 0.156], [0.0032, 0.166], [0.0012, 0.171], [0, 0.1715]], 10, MAGT + 0.0045), { cls: C.COPPER, col: COL.copper, bone: RB.mag, tag: 'mag', dust: 0 });

  // ---------------- hands
  const hr = addHand(k, gripFrame(false), { sleeveBone: 8, tag: 'hand', bone: RB.root, fingerBone: RB.finger, ax: 0.0155, az: 0.024, fingers: [0.008, -0.0135, -0.034], index: IDX_LOCAL.map((p) => p.toArray()), thumb: 'grip', wristDir: v3(0.16, -0.42, 1).normalize() });
  if (supportHand) {
    const XL = v3(0.602, 0.799, 0).normalize(), YL = v3(0, 0, -1), ZL = new V3().crossVectors(XL, YL);
    const sf = new THREE.Matrix4().makeBasis(XL, YL, ZL).setPosition(SUP).multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
    addHand(k, sf, { tag: 'shand', bone: RB.support, ax: 0.0262, az: 0.0262, wrap: 0.8, fingers: [0.007, -0.0145, -0.035], index: null, thumb: 'forward', wristDir: v3(-0.25, -0.5, 0.83).normalize() });
    k.cap(v3(0, 0.072, -0.2), v3(0, 0.072, -0.46), 0.024, 0.45, 0.012, 'gun', ['shand']);
  }

  // ---------------- baked occluders (crevices / joins)
  k.box(v3(0, 0.077, -0.058), v3(0.0125, 0.02, 0.134), 0.5, 0.018, 'gun', ['grip', 'mag', 'hand']);
  k.box(v3(0, 0.02, -0.135), v3(0.012, 0.017, 0.04), 0.55, 0.03, 'gun', ['mag']);
  k.box(v3(0, HB + 0.007, -0.022), v3(0.016, 0.008, 0.048), 0.45, 0.01, 'holo', ['gun']);
  k.cap(v3(0, 0.0725, 0.083), v3(0, 0.0725, 0.27), 0.0148, 0.45, 0.012, 'tube', ['gun']);

  boneDefs.push({ name: 'sleeve', pos: hr.sleevePivot.toArray(), parent: 0 });
  const { mesh, B, tris } = rig(k, boneDefs);
  const group = new THREE.Group(); group.name = 'rifle'; group.add(mesh);
  // optic glass + emissive (reticle & ammo counter) — static children
  const m = mats();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.0342, 0.0318), m.glass);
  glass.position.set(0, winC.y, -0.062); glass.renderOrder = 2; group.add(glass);
  const hud = makeHud();
  let hudMesh = null;
  if (hud) {
    const ret = quad(0.026, 0.026, 0, 0, 0.5, 1); ret.translate(0, winC.y, -0.0605);
    const cnt = quad(0.03, 0.015, 0.5, 0.5, 1, 1); cnt.rotateX(-scrTilt); cnt.translate(scrC.x + scrN.x * 0.0011, scrC.y + scrN.y * 0.0011, scrC.z + scrN.z * 0.0011);
    hudMesh = new THREE.Mesh(mergeGeometries([ret, cnt]), hud.mat); hudMesh.renderOrder = 3; group.add(hudMesh);
    hud.draw(45, 45, false);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, BY, -0.615); group.add(muzzle);
  const port = new THREE.Object3D(); port.position.set(0.018, BY + 0.002, -0.066); group.add(port);

  const st = { trig: 0, dust: 0, emptyAtReload: false, wasReloading: false, supportOn: supportHand };
  const model = {
    group, mesh, muzzle, port, kind: 'rifle', bones: B, hud: hudMesh, glass, triangles: tris, drawCalls: 1 + 1 + (hudMesh ? 1 : 0),
    supportHand,
    setSupportHand(on) { st.supportOn = on && supportHand; B.support.scale.setScalar(st.supportOn ? 1 : 1e-4); },
    // 'vr': hide the support hand and the long forearm sleeve; 'desktop': show both
    setMode(mode) { const vr = mode === 'vr'; this.setSupportHand(!vr); B.sleeve.scale.setScalar(vr ? 1e-4 : 1); },
    animate(s) {
      const dt = s.dt || 0.016;
      // reload bookkeeping
      if (s.reloading && !st.wasReloading) st.emptyAtReload = s.ammo === 0;
      st.wasReloading = s.reloading;
      const ph = s.reloading ? s.reloadPhase : 0;
      // trigger + finger
      const want = s.trigger || s.sinceShot < 0.05 ? 1 : 0;
      st.trig += (want - st.trig) * Math.min(1, dt * 30);
      B.trigger.rotation.x = -0.3 * st.trig;
      B.finger.rotation.y = 0.22 * st.trig;
      // bolt carrier: per-shot cycle, hold-open on empty, rides the charging handle
      const ct = s.sinceShot / 0.075;
      let bolt = ct < 1 ? (ct < 0.4 ? ct / 0.4 : 1 - (ct - 0.4) / 0.6) : 0;
      const locked = (!s.reloading && s.ammo === 0) || (s.reloading && st.emptyAtReload && ph < 0.86);
      if (locked) bolt = Math.max(bolt, 1);
      const rack = s.reloading ? (ph < 0.82 ? 0 : ph < 0.9 ? easeOut(win(ph, 0.82, 0.9)) : 1 - easeIn(win(ph, 0.9, 0.95))) : 0;
      B.charge.position.z = B.charge.userData.rest.z + rack * 0.055;
      B.bolt.position.z = B.bolt.userData.rest.z + Math.max(bolt * 0.024, rack * 0.05);
      // dust cover pops open on the first shot and stays open
      const dWant = s.shotsFired > 0 ? 1 : 0;
      st.dust += (dWant - st.dust) * Math.min(1, dt * 25);
      B.dust.rotation.z = -1.95 * st.dust;
      // magazine: drop, swap, seat
      const mg = B.mag, mr = mg.userData.rest;
      let my = 0, mz = 0, mx = 0, rx = 0, sc = 1;
      if (s.reloading) {
        if (ph < 0.08) { /* seated */ }
        else if (ph < 0.32) { const t = win(ph, 0.08, 0.32); my = -0.42 * t * t; mz = 0.03 * t; mx = 0.02 * t; rx = 0.9 * t * t; }
        else if (ph < 0.42) sc = 1e-4;
        else if (ph < 0.7) { const t = easeOut(win(ph, 0.42, 0.7)); my = mix(-0.26, -0.05, t); mz = mix(0.05, 0.012, t); rx = mix(0.35, 0.06, t); }
        else if (ph < 0.78) { const t = easeIn(win(ph, 0.7, 0.78)); my = mix(-0.05, 0, t); mz = mix(0.012, 0, t); rx = mix(0.06, 0, t); }
        else { const t = win(ph, 0.78, 0.84); my = 0.004 * Math.sin(t * PI); }
      }
      mg.position.set(mr.x + mx, mr.y + my, mr.z + mz); mg.rotation.x = rx; mg.scale.setScalar(sc);
      // support hand: leaves the handguard, fetches the fresh mag, slaps it home, returns
      const sp = B.support, sr = sp.userData.rest;
      if (st.supportOn) {
        let h = 0; // 0 = on handguard, 1 = at mag base
        if (s.reloading) {
          if (ph < 0.1) h = 0; else if (ph < 0.3) h = ease(win(ph, 0.1, 0.3)); else if (ph < 0.8) h = 1; else h = 1 - ease(win(ph, 0.82, 1));
        }
        const follow = ph >= 0.42 && ph < 0.8;
        const ty = follow ? my - 0.22 : -0.3, tz = follow ? 0.13 + mz : 0.16;
        sp.position.set(sr.x - 0.01 * h, sr.y + ty * h, sr.z + tz * h);
        sp.rotation.set(0.5 * h, 0, -0.25 * h);
        sp.scale.setScalar(1);
      }
      // ammo counter
      if (hud) hud.draw(s.ammo, s.mag, s.reloading && ph > 0.3 && ph < 0.78);
    },
  };
  return model;
}

// =====================================================================================
// LAUNCHER — 6-shot revolver-drum 40 mm (M32-style)
// =====================================================================================
export function buildLauncher(opts = {}) {
  const k = new Kit();
  const DY = 0.072, RC = 0.046, BBY = DY + RC; // drum axis, chamber circle, bore
  const DU0 = 0.116, DU1 = 0.242;            // drum span (forward)
  const LB = { root: 0, drum: 1, trigger: 2, finger: 3 };
  const idxPivot = IDX_LOCAL[1].clone().applyMatrix4(gripFrame(true));
  const boneDefs = [
    { name: 'root', pos: [0, 0, 0] },
    { name: 'drum', pos: [0, DY, -(DU0 + DU1) / 2], parent: 0 },
    { name: 'trigger', pos: [0, 0.05, -0.0525], parent: 0 },
    { name: 'finger', pos: idxPivot.toArray(), parent: 0 },
  ];
  const chAng = (j) => PI / 2 + j * PI / 3;
  for (let j = 0; j < 6; j++) boneDefs.push({ name: 'nose' + j, pos: [Math.cos(chAng(j)) * RC, DY + Math.sin(chAng(j)) * RC, -(DU1 - 0.002)], parent: 1 });
  const ANO = { cls: C.ANO, col: COL.ano };
  const FDE = { cls: C.POLY, col: COL.poly, wear: 0.7 };

  // ---------------- rear frame (grip housing + recoil shield)
  k.add(side(ext(rp([[-0.07, 0.062, 0.006], [-0.07, 0.15, 0.006], [-0.058, 0.163, 0.008], [DU0 - 0.002, 0.163, 0.004], [DU0 - 0.002, 0.002, 0.006], [0.1, -0.008, 0.006], [0.09, 0.0, 0.004], [0.09, 0.035, 0.004],
    [-0.034, 0.035, 0.006], [-0.058, 0.044, 0.008]]), 0.036, { bev: 0.0024, holes: [rp([[-0.05, 0.088], [-0.006, 0.088], [-0.006, 0.132], [-0.05, 0.132]], 0.007), rp([[0.012, 0.1], [0.07, 0.1], [0.07, 0.14], [0.012, 0.14]], 0.008)] })), { ...ANO, tint: (x, y, z, nx) => (Math.abs(x) < 0.016 && Math.abs(nx) < 0.5 && y > 0.085 && y < 0.145 ? 0.4 : 1) });
  k.add(rear(ext(circle(0, DY, 0.0745, 28), 0.006, { bev: 0.0012, seg: 1 }), -(DU0 - 0.004)), { ...ANO, wear: 1.1 });
  for (const s of [-1, 1]) for (const [u, v] of [[-0.03, 0.05], [0.06, 0.055], [0.04, 0.15], [-0.045, 0.15]]) k.add(cylAB(v3(s * 0.0175, v, -u), v3(s * 0.0192, v, -u), 0.0034, 0.0034, 10), { cls: C.PARK, col: COL.pin, wear: 1.4 });
  addGrip(k, false);
  addTriggerGuard(k, LB.trigger);
  // ---------------- drum (bone) — 6 chambers, banded, front plate with grenade noses
  const DB = { cls: C.PARK, col: COL.park, bone: LB.drum, tag: 'drum' };
  k.add(rear(ext(circle(0, DY, 0.0725, 30), 0.008, { bev: 0.0014, seg: 1 }), -(DU0 + 0.004)), { ...DB, wear: 1.1 });
  const holes6 = []; for (let j = 0; j < 6; j++) holes6.push(circle(Math.cos(chAng(j)) * RC, DY + Math.sin(chAng(j)) * RC, 0.0208, 12));
  k.add(rear(ext(circle(0, DY, 0.0725, 28), 0.009, { bev: 0, holes: holes6 }), -(DU1 - 0.0045)), { ...DB, wear: 0.5, wearBase: 0.0, lw: true });
  for (let j = 0; j < 6; j++) {
    const cx = Math.cos(chAng(j)) * RC, cy = DY + Math.sin(chAng(j)) * RC;
    k.add(cylAB(v3(cx, cy, -(DU0 + 0.007)), v3(cx, cy, -(DU1 - 0.008)), 0.0238, 0.0238, 18, true), { ...DB, crease: 50 });
    // brass case mouth + dark case interior (seen when the round is spent)
    k.add(lathe([[0.0184, DU1 - 0.012], [0.0184, DU1 - 0.0005], [0.0205, DU1 - 0.0005]], 14, cy, cx), { cls: C.BRASS, col: COL.brass, bone: LB.drum, tag: 'drum', dust: 0.3, crease: 50 });
    k.add(rear(ext(circle(cx, cy, 0.0186, 12), 0.002, { bev: 0 }), -(DU1 - 0.012)), { cls: C.POLY, col: [0.01, 0.009, 0.008], bone: LB.drum, tag: 'drum', wear: 0, dust: 0 });
  }
  k.add(cylAB(v3(0, DY, -(DU0 + 0.004)), v3(0, DY, -(DU1 + 0.004)), 0.017, 0.017, 14), DB);
  k.add(lathe([[0.0705, 0.172], [0.0718, 0.1735], [0.0718, 0.1825], [0.0705, 0.184]], 28, DY), { ...DB, wear: 1.3, crease: 50, lw: true });
  for (let j = 0; j < 6; j++) { // flute rails between chambers
    const a = chAng(j) + PI / 6;
    k.add(at(cbox(0.006, 0.006, DU1 - DU0 - 0.02, 0.0015), Math.cos(a) * 0.058, DY + Math.sin(a) * 0.058, -(DU0 + DU1) / 2, 0, 0, a), { ...DB, wear: 1.2 });
  }
  // grenade noses (one bone each, children of the drum)
  for (let j = 0; j < 6; j++) {
    const cx = Math.cos(chAng(j)) * RC, cy = DY + Math.sin(chAng(j)) * RC, u0 = DU1 - 0.002;
    const P = (pts) => pts.map(([r, du]) => [r, u0 + du]);
    const NB = { bone: 4 + j, tag: 'nose', dust: 0.6, crease: 55 };
    k.add(lathe(P([[0.0192, 0], [0.0192, 0.007], [0.0187, 0.012], [0.0181, 0.0152], [0.016, 0.0215], [0.0124, 0.0275], [0.0086, 0.0312], [0.0062, 0.0368], [0, 0.0388]]), 10, cy, cx),
      { cls: C.PAINT, col: COL.od, ...NB, matFn: (x, y, z) => { const du = -z - u0; return du > 0.0312 ? [COL.copper, C.COPPER] : du > 0.012 && du < 0.0152 ? [COL.yellow, C.PAINT] : [COL.od, C.PAINT]; } });
  }
  // ---------------- top strap + rail, front frame, hinge arm
  k.add(side(ext(rp([[-0.06, 0.155, 0], [0.302, 0.155, 0.002], [0.302, 0.1702, 0.002], [-0.06, 0.1702, 0.002]]), 0.03, { bev: 0.0016 })), ANO);
  addRail(k, 0.1702, -0.055, 0.3, (u) => u < 0.11 || (u > 0.196 && u < 0.236));
  k.add(rear(ext(rp([[-0.034, 0.168, 0.008], [0.034, 0.168, 0.008], [0.034, 0.1, 0.012], [0.019, 0.058, 0.01], [-0.019, 0.058, 0.01], [-0.034, 0.1, 0.012]]), 0.016, { bev: 0.0016, holes: [circle(-0.019, 0.083, 0.005, 10), circle(0.019, 0.083, 0.005, 10)] }), -0.294), { ...ANO, wear: 1.1 });
  k.add(side(ext(rp([[0.11, -0.018, 0.004], [0.302, -0.018, 0.006], [0.302, 0.068, 0.004], [0.287, 0.068, 0.003], [0.287, -0.003, 0.004], [0.11, -0.003, 0.003]]), 0.011, { bev: 0.0015 }), -0.026), { ...ANO, wear: 1.1 });
  k.add(cylAB(v3(-0.034, -0.0105, -0.115), v3(0.0, -0.0105, -0.115), 0.0075, 0.0075, 12), { ...ANO, wear: 1.3 });
  // ---------------- fat rifled barrel
  k.add(lathe([[0, 0.31], [0.019, 0.31], [0.0195, 0.283], [0.0318, 0.283], [0.0318, 0.297], [0.028, 0.301], [0.028, 0.37], [0.0302, 0.372], [0.0302, 0.392], [0.028, 0.394],
    [0.028, 0.47], [0.0296, 0.472], [0.0296, 0.49], [0.028, 0.492], [0.028, 0.503], [0.0258, 0.506], [0.0207, 0.506], [0.0207, 0.47], [0, 0.47]], 18, BBY),
  { ...ANO, crease: 45, tag: 'barrel', lw: true, tint: (x, y, z, nx, ny, nz) => { const r = Math.hypot(x, y - BBY); return r < 0.0212 ? (-z > 0.4 ? 0.2 : 0.35) : 1; } });
  for (let i = 0; i < 6; i++) { const a = i * PI / 3 + PI / 6; k.add(at(new THREE.BoxGeometry(0.003, 0.0015, 0.03), Math.cos(a) * 0.0203, BBY + Math.sin(a) * 0.0203, -0.49, 0, 0, a + PI / 2), { cls: C.PARK, col: [0.02, 0.02, 0.02], wear: 0, dust: 0 }); }
  // ---------------- foregrip
  k.add(side(ext(rp([[0.318, 0.093, 0.002], [0.43, 0.093, 0.002], [0.43, 0.084, 0.002], [0.318, 0.084, 0.002]]), 0.022, { bev: 0.0014 })), ANO);
  {
    const fr = [];
    for (let y = 0.08; y >= 0.0; y -= 0.004) fr.push([0.398 + (0.08 - y) * 0.12 + 0.0018 * Math.cos(2 * PI * (y - 0.06) / 0.022) * sstep(0.075, 0.065, y) * sstep(0.0, 0.012, y), y, 0]);
    const out = rp([[0.364, 0.086, 0], ...fr, [0.41, -0.012, 0.006], [0.375, -0.014, 0.006], [0.362, 0.0, 0.006], [0.358, 0.05, 0.01]], 0, 2);
    k.add(side(ext(out, 0.03, { bev: 0.0065, seg: 2 })), { cls: C.POLY, col: COL.poly, wear: 0.7, tag: 'fgrip' });
    k.add(side(ext(rp([[0.373, -0.009, 0.004], [0.413, -0.007, 0.004], [0.412, -0.019, 0.004], [0.373, -0.02, 0.004]]), 0.032, { bev: 0.0035, seg: 2 })), { cls: C.POLY, col: COL.fde, tag: 'fgrip' });
  }
  // ---------------- folding skeleton stock
  k.add(cylAB(v3(0, 0.088, 0.075), v3(0, 0.145, 0.075), 0.0095, 0.0095, 14), { ...ANO, wear: 1.3 });
  k.add(side(ext(rp([[-0.072, 0.145, 0.006], [-0.256, 0.152, 0.008], [-0.262, 0.03, 0.006], [-0.248, 0.022, 0.008], [-0.072, 0.072, 0.01]]), 0.017, { bev: 0.003, seg: 2,
    holes: [rp([[-0.096, 0.128], [-0.236, 0.134], [-0.241, 0.05], [-0.102, 0.088]], 0.009)] })), { ...FDE, col: COL.poly });
  k.add(side(ext(rp([[-0.254, 0.157, 0.005], [-0.271, 0.156, 0.005], [-0.273, 0.018, 0.005], [-0.256, 0.016, 0.005]]), 0.036, { bev: 0.004, seg: 2 })), { cls: C.RUBBER, col: COL.rubber, wear: 0.5 });
  // ---------------- ladder sight (flipped up)
  {
    const hu = 0.206, hv = 0.1702 + RAIL_H + 0.006;
    const clampP = rp([[-0.0126, 0.1702 + 0.0012, 0.001], [0.0126, 0.1702 + 0.0012, 0.001], [0.0126, hv, 0.002], [-0.0126, hv, 0.002]]);
    k.add(rear(ext(clampP, 0.028, { bev: 0.001 }), -(hu + 0.012)), ANO);
    k.add(cylAB(v3(-0.013, hv, -hu), v3(0.013, hv, -hu), 0.003, 0.003, 10), { cls: C.PARK, col: COL.pin, wear: 1.4 });
    const lf = new THREE.Matrix4().makeTranslation(0, hv, -hu).multiply(new THREE.Matrix4().makeRotationX(22 * D));
    const L = (g) => apply(g, lf);
    for (const s of [-1, 1]) k.add(L(at(rbox(0.0026, 0.058, 0.0045, 0.0009), s * 0.0108, 0.029, 0)), { ...ANO, wear: 1.3 });
    for (let i = 0; i < 5; i++) {
      k.add(L(at(new THREE.BoxGeometry(0.0195, 0.0016, 0.0028), 0, 0.012 + i * 0.0105, 0)), { ...ANO, wear: 1.0 });
      for (const s of [-1, 1]) k.add(L(at(new THREE.BoxGeometry(0.0004, 0.0012, 0.0036), s * 0.0123, 0.0125 + i * 0.0105, 0)), { cls: C.PAINT, col: COL.white, wear: 0, dust: 0.2 });
    }
    k.add(L(rear(ext(rp([[-0.0105, -0.005], [0.0105, -0.005], [0.0105, 0.005], [-0.0105, 0.005]], 0.0015), 0.004, { bev: 0.0006, holes: [circle(0, 0, 0.0021, 10)] }), 0).translate(0, 0.036, 0)), { ...ANO, wear: 1.2 });
  }
  // ---------------- left hand on the grip (VR left controller / desktop left viewmodel)
  const hr = addHand(k, gripFrame(true), { sleeveBone: 10, tag: 'hand', bone: LB.root, fingerBone: LB.finger, ax: 0.0155, az: 0.024, fingers: [0.008, -0.0135, -0.034], index: IDX_LOCAL.map((p) => p.toArray()), thumb: 'grip', wristDir: v3(-0.16, -0.42, 1).normalize() });
  // occluders
  k.cap(v3(0, DY, -DU0), v3(0, DY, -DU1), 0.072, 0.45, 0.012, 'drumocc', ['gun']);
  k.box(v3(0, 0.1, -0.02), v3(0.018, 0.065, 0.05), 0.5, 0.016, 'gun', ['grip', 'hand']);
  k.cap(v3(0, BBY, -0.29), v3(0, BBY, -0.5), 0.028, 0.4, 0.012, 'barrel', ['gun', 'fgrip']);
  k.box(v3(0, DY, -(DU1 + 0.03)), v3(0.034, 0.05, 0.008), 0.45, 0.02, 'gun', ['nose']);

  boneDefs.push({ name: 'sleeve', pos: hr.sleevePivot.toArray(), parent: 0 });
  const { mesh, B, tris } = rig(k, boneDefs);
  const group = new THREE.Group(); group.name = 'launcher'; group.add(mesh);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, BBY, -0.507); group.add(muzzle);
  const noses = [0, 1, 2, 3, 4, 5].map((j) => B['nose' + j]);
  const st = { trig: 0, wasReloading: false, refill: [] };
  return {
    group, mesh, muzzle, kind: 'launcher', drum: B.drum, bones: B, triangles: tris, drawCalls: 1,
    setMode(mode) { B.sleeve.scale.setScalar(mode === 'vr' ? 1e-4 : 1); },
    animate(s) {
      const dt = s.dt || 0.016;
      const want = s.trigger || s.sinceShot < 0.06 ? 1 : 0;
      st.trig += (want - st.trig) * Math.min(1, dt * 30);
      B.trigger.rotation.x = -0.3 * st.trig;
      B.finger.rotation.y = -0.22 * st.trig;
      const ph = s.reloading ? s.reloadPhase : 0;
      // index the drum one chamber per shot (quick snap with a little overshoot)
      const e = clamp01(s.sinceShot / 0.16), snap = e >= 1 ? 1 : 1 - Math.pow(1 - e, 3) * Math.cos(e * 4);
      const spin = s.reloading ? 2 * PI * ease(win(ph, 0.08, 0.86)) : 0;
      B.drum.rotation.z = -(s.shotsFired - 1 + snap) * PI / 3 - spin;
      // spent chambers lose their noses; reload pops them back one by one
      const spent = s.mag - s.ammo, sf = s.shotsFired;
      for (let j = 0; j < 6; j++) {
        let q = 0; // how many shots ago this chamber fired (1 = most recent), 0 = loaded
        for (let i = 1; i <= spent; i++) if ((((sf - i) % 6) + 6) % 6 === j) { q = i; break; }
        let sc = 1;
        if (q) {
          sc = 0;
          if (s.reloading) { const order = spent - q; const t0 = 0.2 + 0.6 * (order / Math.max(1, spent)); const t = win(ph, t0, t0 + 0.06); sc = t <= 0 ? 0 : t >= 1 ? 1 : easeOut(t) * (1 + 0.25 * Math.sin(t * PI)); }
        }
        noses[j].scale.setScalar(Math.max(1e-4, sc));
      }
    },
  };
}

// =====================================================================================
// MINIGUN — hand-held six-barrel 7.62 (the Bay version of an M134): pistol grip under the
// back of the receiver, carry handle on top, motor on the right, feeder on the left, barrel
// cluster on its own bone (the level spins it). Same kit, bake and materials as the others.
// =====================================================================================
// =====================================================================================
// Rocket pod (Level 8's left hand): six short rocket tubes in a hex cluster on the
// launcher's pistol grip. Each tube shows its rocket's nose; the nose goes when that tube
// fires (in a cross-pattern order, so the pod stays balanced) and the reload pops them back.
// Seen mostly from behind, so the rear gets the detail: venturi nozzles, a vented blast plate.
// =====================================================================================
export function buildRocketPod(opts = {}) {
  const k = new Kit();
  const PY = 0.122, RC = 0.05, RT = 0.0235, RB = 0.0196; // pod axis height, tube ring radius, tube outer / bore radius
  const U0 = 0.045, U1 = 0.5;                             // tube span (forward)
  const ORDER = [0, 3, 1, 4, 2, 5];                       // firing order: across the cluster each time
  const chAng = (j) => PI / 2 + j * PI / 3;
  const TX = (j) => Math.cos(chAng(j)) * RC, TY = (j) => PY + Math.sin(chAng(j)) * RC;
  const LB = { root: 0, trigger: 1, finger: 2 };
  const idxPivot = IDX_LOCAL[1].clone().applyMatrix4(gripFrame(true));
  const boneDefs = [
    { name: 'root', pos: [0, 0, 0] },
    { name: 'trigger', pos: [0, 0.05, -0.0525], parent: 0 },
    { name: 'finger', pos: idxPivot.toArray(), parent: 0 },
  ];
  for (let j = 0; j < 6; j++) boneDefs.push({ name: 'nose' + j, pos: [TX(j), TY(j), -(U1 - 0.004)], parent: 0 });
  const ANO = { cls: C.ANO, col: COL.ano };
  const ODC = [0.085, 0.094, 0.05], OD = { cls: C.PAINT, col: ODC, wear: 1.0 }; // a touch lighter than the grenades' OD: dark tubes read as black in the haze
  const PARK = { cls: C.PARK, col: COL.park };

  // ---------------- lower receiver: grip housing, the saddle the pod sits in, the front lug down to the guard
  k.add(side(ext(rp([[-0.062, 0.036, 0.006], [0.128, 0.036, 0.004], [0.128, 0.068, 0.004], [0.104, 0.082, 0.006], [-0.04, 0.082, 0.008], [-0.062, 0.066, 0.008]]), 0.038, { bev: 0.0026 })),
    { ...ANO, tint: (x, y, z, nx) => (Math.abs(nx) > 0.6 && y > 0.046 && y < 0.07 && -z > 0.0 && -z < 0.1 ? 0.55 : 1) });
  k.add(side(ext(rp([[0.088, -0.008, 0.004], [0.106, -0.008, 0.004], [0.112, 0.04, 0.003], [0.092, 0.04, 0.003]]), 0.03, { bev: 0.002 })), { ...ANO, wear: 1.1 });
  for (const s of [-1, 1]) for (const [u, v] of [[-0.03, 0.058], [0.04, 0.06], [0.1, 0.058], [0.098, 0.012]]) k.add(cylAB(v3(s * 0.0185, v, -u), v3(s * 0.0205, v, -u), 0.0034, 0.0034, 10), { cls: C.PARK, col: COL.pin, wear: 1.4 });
  // safety lever (left side, by the thumb) + its arc
  k.add(at(rbox(0.004, 0.009, 0.026, 0.0018), 0.021, 0.064, 0.012, -0.35, 0, 0), { ...PARK, wear: 1.5 });
  k.add(at(new THREE.BoxGeometry(0.0006, 0.002, 0.012), 0.0202, 0.072, 0.002), { cls: C.PAINT, col: COL.white, wear: 0, dust: 0.2 });
  addGrip(k, false);
  addTriggerGuard(k, LB.trigger);

  // ---------------- the six tubes: OD paint over a thin wall, bore dark, a yellow band + stencil strip near the front
  for (let j = 0; j < 6; j++) {
    const x = TX(j), y = TY(j);
    k.add(lathe([[RB, U0 + 0.012], [RT - 0.0012, U0 + 0.012], [RT, U0 + 0.015], [RT, U1 - 0.016], [RT - 0.0012, U1 - 0.013], [RB + 0.0008, U1 - 0.013], [RB, U1 - 0.016], [RB, U0 + 0.05], [0, U0 + 0.05]], 18, y, x),
      { ...OD, crease: 45, lw: true, tint: (px, py, pz) => (Math.hypot(px - x, py - y) < RB + 0.0004 ? 0.12 : 1) });
    k.add(lathe([[RT + 0.0003, 0.4], [RT + 0.0003, 0.414]], 18, y, x), { cls: C.PAINT, col: COL.yellow, wear: 0.9, dust: 0.5 });
    // muzzle ring (anodized, chamfered) and the rear coupling ring
    k.add(lathe([[RB, U1 - 0.016], [RB + 0.0004, U1 - 0.002], [RT - 0.0006, U1], [RT + 0.0014, U1 - 0.003], [RT + 0.0014, U1 - 0.02], [RT, U1 - 0.022]], 18, y, x), { ...ANO, wear: 1.4, crease: 50 });
    k.add(lathe([[RT, U0 + 0.034], [RT + 0.0016, U0 + 0.032], [RT + 0.0016, U0 + 0.014], [RT, U0 + 0.012]], 18, y, x), { ...PARK, wear: 1.2, crease: 50 });
    // venturi nozzle out of the back: throat narrows then flares, dark soot inside
    k.add(lathe([[RT - 0.002, U0 + 0.012], [0.0165, U0 - 0.004], [0.0158, U0 - 0.016], [0.0205, U0 - 0.036], [0.0218, U0 - 0.037], [0.0196, U0 - 0.039], [0.0142, U0 - 0.018], [0.0148, U0 - 0.004], [RB - 0.002, U0 + 0.012]], 18, y, x),
      { ...PARK, wear: 0.7, dust: 0.3, crease: 55, tint: (px, py, pz) => (Math.hypot(px - x, py - y) < 0.0153 || -pz < U0 - 0.03 ? 0.25 : 1) });
    k.add(rear(ext(circle(x, y, 0.0146, 14), 0.002, { bev: 0 }), -(U0 - 0.004)), { cls: C.POLY, col: [0.008, 0.007, 0.007], wear: 0, dust: 0 });
    // the stencil strip on the outward face (white text block, as a few dashes)
    const a = chAng(j), ox = Math.cos(a) * (RC + RT + 0.0002), oy = PY + Math.sin(a) * (RC + RT + 0.0002);
    if (j !== 0) for (let i = 0; i < 4; i++) k.add(at(new THREE.BoxGeometry(0.0004, 0.003, i === 0 ? 0.03 : 0.012 + (i % 2) * 0.006), ox, oy, -(0.3 + i * 0.016), 0, 0, a), { cls: C.PAINT, col: COL.white, wear: 0.6, dust: 0.3 });
  }
  // ---------------- clamp bands: rear blast plate (vented), mid band, front band (all anodized)
  const holes6 = (r) => [0, 1, 2, 3, 4, 5].map((j) => circle(TX(j), TY(j), r, 14));
  const rim = RC + RT + 0.006;
  k.add(rear(ext(circle(0, PY, rim, 30), 0.012, { bev: 0.0016, holes: holes6(RT + 0.0004) }), -(U0 + 0.022)), { ...ANO, wear: 1.2 });
  for (let i = 0; i < 6; i++) { const a = chAng(i) + PI / 6; k.add(at(new THREE.BoxGeometry(0.009, 0.004, 0.0125), Math.cos(a) * (rim - 0.004), PY + Math.sin(a) * (rim - 0.004), -(U0 + 0.022), 0, 0, a + PI / 2), { cls: C.POLY, col: [0.01, 0.01, 0.01], wear: 0, dust: 0 }); }
  for (const [u, w] of [[0.235, 0.018], [U1 - 0.03, 0.016]]) {
    k.add(rear(ext(circle(0, PY, rim - 0.002, 30), w, { bev: 0.0018, holes: holes6(RT + 0.0004) }), -u), { ...ANO, wear: 1.15 });
    for (const s of [-1, 1]) k.add(cylAB(v3(s * 0.006, PY - rim - 0.006, -u), v3(s * 0.006, PY - rim + 0.004, -u), 0.0032, 0.0032, 8), { ...PARK, wear: 1.5 }); // clamp bolts under the band
    k.add(at(rbox(0.02, 0.01, w * 0.8, 0.002), 0, PY - rim - 0.003, -u), { ...ANO, wear: 1.2 });
  }
  // the spine rod through the middle (seen between the tubes)
  k.add(cylAB(v3(0, PY, -(U0 + 0.01)), v3(0, PY, -(U1 - 0.02)), 0.0095, 0.0095, 12), { ...PARK, wear: 1.0 });
  k.add(lathe([[0, U1 - 0.02], [0.012, U1 - 0.02], [0.013, U1 - 0.016], [0.009, U1 - 0.008], [0, U1 - 0.008]], 14, PY), { ...ANO, wear: 1.3 });

  // ---------------- top strap + rail across the bands, and the flip-up ladder sight
  const TOPY = PY + RC + RT + 0.004;
  k.add(side(ext(rp([[0.02, TOPY - 0.004, 0.002], [U1 - 0.02, TOPY - 0.004, 0.002], [U1 - 0.02, TOPY + 0.008, 0.002], [0.02, TOPY + 0.008, 0.002]]), 0.024, { bev: 0.0016 })), ANO);
  addRail(k, TOPY + 0.008, 0.04, U1 - 0.04, (u) => u < 0.07 || (u > 0.205 && u < 0.26));
  {
    const hu = 0.15, hv = TOPY + 0.008 + RAIL_H + 0.006;
    k.add(rear(ext(rp([[-0.0126, TOPY + 0.009, 0.001], [0.0126, TOPY + 0.009, 0.001], [0.0126, hv, 0.002], [-0.0126, hv, 0.002]]), 0.028, { bev: 0.001 }), -(hu + 0.012)), ANO);
    k.add(cylAB(v3(-0.013, hv, -hu), v3(0.013, hv, -hu), 0.003, 0.003, 10), { cls: C.PARK, col: COL.pin, wear: 1.4 });
    const lf = new THREE.Matrix4().makeTranslation(0, hv, -hu).multiply(new THREE.Matrix4().makeRotationX(22 * D));
    const L = (g) => apply(g, lf);
    for (const s of [-1, 1]) k.add(L(at(rbox(0.0026, 0.058, 0.0045, 0.0009), s * 0.0108, 0.029, 0)), { ...ANO, wear: 1.3 });
    for (let i = 0; i < 5; i++) {
      k.add(L(at(new THREE.BoxGeometry(0.0195, 0.0016, 0.0028), 0, 0.012 + i * 0.0105, 0)), { ...ANO, wear: 1.0 });
      for (const s of [-1, 1]) k.add(L(at(new THREE.BoxGeometry(0.0004, 0.0012, 0.0036), s * 0.0123, 0.0125 + i * 0.0105, 0)), { cls: C.PAINT, col: COL.white, wear: 0, dust: 0.2 });
    }
    k.add(L(rear(ext(rp([[-0.0105, -0.005], [0.0105, -0.005], [0.0105, 0.005], [-0.0105, 0.005]], 0.0015), 0.004, { bev: 0.0006, holes: [circle(0, 0, 0.0021, 10)] }), 0).translate(0, 0.036, 0)), { ...ANO, wear: 1.2 });
    // front post on the front band
    k.add(at(rbox(0.004, 0.022, 0.004, 0.001), 0, TOPY + 0.021, -(U1 - 0.035)), { ...ANO, wear: 1.3 });
    k.add(at(new THREE.BoxGeometry(0.0016, 0.004, 0.0044), 0, TOPY + 0.03, -(U1 - 0.035)), { cls: C.PAINT, col: COL.white, wear: 0, dust: 0.2 });
  }
  // ---------------- sling loop on the rear plate, and a firing cable from the receiver up into the rear plate
  k.add(at(new THREE.TorusGeometry(0.008, 0.0018, 6, 12), -rim + 0.002, PY - 0.02, -(U0 + 0.022), 0, PI / 2, 0), { ...PARK, wear: 1.4 });
  k.add(tube([v3(0.012, 0.074, -0.06), v3(0.02, 0.085, -0.052), v3(0.027, 0.09, -(U0 + 0.012))], [0.0032, 0.0032, 0.0032], 8, false), { cls: C.RUBBER, col: COL.rubber, wear: 0.3 });

  // ---------------- rocket noses (one bone each): OD body, yellow HE band, steel fuze ring, copper tip
  for (let j = 0; j < 6; j++) {
    const cx = TX(j), cy = TY(j), u0 = U1 - 0.004;
    const P = (pts) => pts.map(([r, du]) => [r, u0 + du]);
    k.add(lathe(P([[0.0188, 0], [0.0188, 0.012], [0.0184, 0.022], [0.0172, 0.031], [0.0148, 0.041], [0.0114, 0.05], [0.0078, 0.0565], [0.0058, 0.0605], [0.0058, 0.066], [0.004, 0.069], [0, 0.0705]]), 12, cy, cx),
      { cls: C.PAINT, col: ODC, bone: 3 + j, tag: 'nose', dust: 0.25, wear: 0.5, crease: 55,
        matFn: (x, y, z) => { const du = -z - u0; return du > 0.0605 ? [COL.copper, C.COPPER] : du > 0.056 ? [COL.steel, C.STEEL] : du > 0.022 && du < 0.031 ? [COL.yellow, C.PAINT] : [ODC, C.PAINT]; } });
  }

  // ---------------- left hand on the grip
  const hr = addHand(k, gripFrame(true), { sleeveBone: 9, tag: 'hand', bone: LB.root, fingerBone: LB.finger, ax: 0.0155, az: 0.024, fingers: [0.008, -0.0135, -0.034], index: IDX_LOCAL.map((p) => p.toArray()), thumb: 'grip', wristDir: v3(-0.16, -0.42, 1).normalize() });
  // occluders: the cluster darkens itself between the tubes, the receiver round the grip
  k.cap(v3(0, PY, -U0), v3(0, PY, -U1), RC, 0.5, 0.02, 'pod', ['gun']);
  k.box(v3(0, 0.1, -0.02), v3(0.018, 0.065, 0.05), 0.5, 0.016, 'gun', ['grip', 'hand']);
  k.box(v3(0, 0.06, -0.03), v3(0.019, 0.022, 0.09), 0.4, 0.016, 'gun', ['gun']);

  boneDefs.push({ name: 'sleeve', pos: hr.sleevePivot.toArray(), parent: 0 });
  const { mesh, B, tris } = rig(k, boneDefs);
  const group = new THREE.Group(); group.name = 'rocketpod'; group.add(mesh);
  const muzzle = new THREE.Object3D(); group.add(muzzle);
  const back = new THREE.Object3D(); group.add(back); // the rear of the tube that just fired (back-blast)
  const setTube = (o, j, u) => o.position.set(TX(j), TY(j), -u);
  setTube(muzzle, ORDER[0], U1 + 0.004); setTube(back, ORDER[0], U0 - 0.04);
  const noses = [0, 1, 2, 3, 4, 5].map((j) => B['nose' + j]);
  const st = { trig: 0 };
  return {
    group, mesh, muzzle, back, kind: 'launcher', bones: B, triangles: tris, drawCalls: 1,
    setMode(mode) { B.sleeve.scale.setScalar(mode === 'vr' ? 1e-4 : 1); },
    animate(s) {
      const dt = s.dt || 0.016;
      const want = s.trigger || s.sinceShot < 0.06 ? 1 : 0;
      st.trig += (want - st.trig) * Math.min(1, dt * 30);
      B.trigger.rotation.x = -0.3 * st.trig;
      B.finger.rotation.y = -0.22 * st.trig;
      const sf = s.shotsFired, spent = s.mag - s.ammo, ph = s.reloading ? s.reloadPhase : 0;
      // the next shot leaves from the next loaded tube; the back-blast comes out of the one that just fired
      setTube(muzzle, ORDER[((sf % 6) + 6) % 6], U1 + 0.004);
      setTube(back, ORDER[(((sf - 1) % 6) + 6) % 6], U0 - 0.04);
      for (let j = 0; j < 6; j++) {
        let q = 0; // how many shots ago this tube fired (1 = the last one), 0 = loaded
        for (let i = 1; i <= spent; i++) if (ORDER[(((sf - i) % 6) + 6) % 6] === j) { q = i; break; }
        let sc = 1;
        if (q) {
          sc = 0;
          // reload: the rockets slide back in one after another, a little overshoot as each seats
          if (s.reloading) { const order = spent - q; const t0 = 0.22 + 0.6 * (order / Math.max(1, spent)); const t = win(ph, t0, t0 + 0.07); sc = t <= 0 ? 0 : t >= 1 ? 1 : easeOut(t) * (1 + 0.2 * Math.sin(t * PI)); }
        }
        noses[j].scale.setScalar(Math.max(1e-4, sc));
        // a seated nose sits flush; one that's mid-reload slides in from 4 cm out
        noses[j].position.z = noses[j].userData.rest.z - (sc > 0 && sc < 1 ? (1 - Math.min(1, sc)) * 0.04 : 0);
      }
    },
  };
}

export function buildMinigun(opts = {}) {
  const k = new Kit();
  const BM = 0.118;                         // bore axis above the hand
  const MB = { root: 0, spin: 1, trigger: 2, finger: 3, sleeve: 4 };
  const idxPivot = IDX_LOCAL[1].clone().applyMatrix4(gripFrame(false));
  const boneDefs = [
    { name: 'root', pos: [0, 0, 0] },
    { name: 'spin', pos: [0, BM, -0.4], parent: 0 },
    { name: 'trigger', pos: [0, 0.05, -0.0525], parent: 0 },
    { name: 'finger', pos: idxPivot.toArray(), parent: 0 },
  ];
  const ANO = { cls: C.ANO, col: COL.ano };
  const PK = { cls: C.PARK, col: COL.park };
  // ---------------- receiver housing (lathe) with raised bands, rear cap, screws
  k.add(lathe([[0, -0.078], [0.046, -0.078], [0.055, -0.072], [0.058, -0.06], [0.058, 0.168], [0.054, 0.176], [0.044, 0.178], [0.044, 0.19], [0, 0.19]], 30, BM), { ...ANO, crease: 50, lw: true });
  for (const u of [-0.052, 0.035, 0.125]) k.add(lathe([[0.0585, u - 0.007], [0.0612, u - 0.005], [0.0612, u + 0.005], [0.0585, u + 0.007]], 30, BM), { ...PK, wear: 1.4, crease: 50 });
  k.add(rear(ext(circle(0, BM, 0.036, 22), 0.008, { bev: 0.002, seg: 1 }), 0.08), { ...PK, wear: 1.2 });
  for (let i = 0; i < 6; i++) { const a = i * PI / 3; k.add(cylAB(v3(Math.cos(a) * 0.046, BM + Math.sin(a) * 0.046, 0.077), v3(Math.cos(a) * 0.046, BM + Math.sin(a) * 0.046, 0.081), 0.0045, 0.0045, 8), { cls: C.PARK, col: COL.pin, wear: 1.5 }); }
  // ---------------- motor (right) + cable, feeder/delinker (left) + belt chute stub
  k.add(cylAB(v3(0.068, BM + 0.02, 0.01), v3(0.068, BM + 0.02, -0.15), 0.026, 0.026, 18), { ...PK, crease: 50, lw: true });
  k.add(lathe([[0.0275, 0.0], [0.0275, 0.012], [0.02, 0.016], [0, 0.016]], 18, BM + 0.02, 0.068).translate(0, 0, 0.012), { ...ANO, wear: 1.2 });
  for (let i = 0; i < 5; i++) k.add(at(cbox(0.004, 0.056, 0.006, 0.001), 0.068 + 0.0255, BM + 0.02, -0.03 - i * 0.022), { ...ANO, wear: 1.3 });
  k.add(tube([v3(0.07, BM - 0.006, -0.14), v3(0.06, BM - 0.05, -0.15), v3(0.035, BM - 0.075, -0.17)], [0.0055, 0.0055, 0.0055], 8, false), { cls: C.RUBBER, col: COL.rubber, wear: 0.3 });
  k.add(at(cbox(0.062, 0.078, 0.115, 0.01), -0.074, BM - 0.004, -0.055), { ...ANO, wear: 1.1 });
  k.add(at(cbox(0.048, 0.03, 0.07, 0.006), -0.112, BM - 0.03, -0.055, 0, 0, 0.55), { cls: C.POLY, col: COL.poly, wear: 0.6 });
  for (const u of [-0.02, -0.09]) k.add(cylAB(v3(-0.106, BM + 0.02, -u), v3(-0.103, BM + 0.02, -u), 0.006, 0.006, 10), { cls: C.PARK, col: COL.pin, wear: 1.5 });
  // ---------------- frame plate from the receiver down to the grip
  k.add(side(ext(rp([[-0.05, 0.03, 0.004], [0.112, 0.03, 0.006], [0.112, 0.072, 0.004], [-0.05, 0.072, 0.004]]), 0.036, { bev: 0.0025 })), { ...ANO, wear: 1.1 });
  addGrip(k, false);
  addTriggerGuard(k, MB.trigger);
  // ---------------- carry handle (posts + rubbered bar), ring sight on its nose
  for (const u of [0.0, 0.15]) k.add(side(ext(rp([[u - 0.012, BM + 0.052, 0.002], [u + 0.012, BM + 0.052, 0.002], [u + 0.008, BM + 0.118, 0.004], [u - 0.008, BM + 0.118, 0.004]]), 0.016, { bev: 0.002 })), { ...ANO, wear: 1.2 });
  k.add(cylAB(v3(0, BM + 0.118, 0.012), v3(0, BM + 0.118, -0.162), 0.0145, 0.0145, 16), { cls: C.RUBBER, col: COL.rubber, wear: 0.4, crease: 50 });
  for (let i = 0; i < 7; i++) k.add(lathe([[0.0148, 0.0], [0.0152, 0.002], [0.0148, 0.004]], 16, BM + 0.118).translate(0, 0, 0.0 - (0.0 + i * 0.022) - 0.004), { cls: C.RUBBER, col: COL.rubber, wear: 0.5 });
  k.add(rear(ext(circle(0, BM + 0.168, 0.022, 22), 0.003, { bev: 0, holes: [circle(0, BM + 0.168, 0.0185, 22)] }), -0.15), { ...ANO, wear: 1.3 });
  k.add(cylAB(v3(0, BM + 0.132, -0.15), v3(0, BM + 0.146, -0.15), 0.0025, 0.0025, 8), ANO);
  // ---------------- battery pack under the front of the receiver (OD), strap buckle
  k.add(at(cbox(0.066, 0.05, 0.14, 0.008), 0, BM - 0.088, -0.19), { cls: C.PAINT, col: COL.od, wear: 0.9 });
  k.add(at(cbox(0.07, 0.008, 0.02, 0.002), 0, BM - 0.088, -0.15), { cls: C.SYNTH, col: COL.gloveDk, wear: 0.4 });
  // ---------------- barrel cluster (spin bone): rotor hub, 6 barrels, mid + muzzle clamps
  const SB = { ...PK, bone: MB.spin, tag: 'barrels' };
  k.add(lathe([[0, 0.188], [0.047, 0.188], [0.049, 0.196], [0.049, 0.212], [0.04, 0.22], [0, 0.22]], 26, BM), { ...SB, wear: 1.2, crease: 50 });
  const R6 = 0.031;
  const holes = []; for (let j = 0; j < 6; j++) holes.push(circle(Math.cos(j * PI / 3) * R6, BM + Math.sin(j * PI / 3) * R6, 0.0096, 12));
  for (let j = 0; j < 6; j++) {
    const a = j * PI / 3, x = Math.cos(a) * R6, y = BM + Math.sin(a) * R6;
    k.add(cylAB(v3(x, y, -0.215), v3(x, y, -0.632), 0.0092, 0.0092, 12), { ...SB, crease: 50, wear: 0.9, lw: true });
    k.add(rear(ext(circle(x, y, 0.0058, 10), 0.002, { bev: 0 }), -0.633), { cls: C.POLY, col: [0.008, 0.007, 0.007], bone: MB.spin, tag: 'barrels', wear: 0, dust: 0 });
  }
  for (const u of [0.42, 0.598]) k.add(rear(ext(circle(0, BM, 0.046, 26), 0.016, { bev: 0.0025, holes }), -u), { ...SB, wear: 1.3 });
  k.add(cylAB(v3(0, BM, -0.22), v3(0, BM, -0.6), 0.008, 0.008, 10), SB);
  // ---------------- the gloved right hand on the grip
  const hr = addHand(k, gripFrame(false), { sleeveBone: MB.sleeve, tag: 'hand', bone: MB.root, fingerBone: MB.finger, ax: 0.0155, az: 0.024, fingers: [0.008, -0.0135, -0.034], index: IDX_LOCAL.map((p) => p.toArray()), thumb: 'grip', wristDir: v3(0.16, -0.42, 1).normalize() });
  // occluders: the housing shades the frame / hand, the handle shades the housing top, the clamps the barrels
  k.cap(v3(0, BM, 0.078), v3(0, BM, -0.19), 0.058, 0.5, 0.016, 'gun', ['hand', 'grip', 'gun']);
  k.cap(v3(0, BM + 0.118, 0.012), v3(0, BM + 0.118, -0.162), 0.015, 0.45, 0.02, 'handle', ['gun']);
  k.cap(v3(0, BM, -0.21), v3(0, BM, -0.63), 0.02, 0.4, 0.014, 'core', ['barrels']);
  boneDefs.push({ name: 'sleeve', pos: hr.sleevePivot.toArray(), parent: 0 });
  const { mesh, B, tris } = rig(k, boneDefs);
  const group = new THREE.Group(); group.name = 'minigun'; group.add(mesh);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, BM, -0.64); group.add(muzzle);
  const port = new THREE.Object3D(); port.position.set(0.06, BM - 0.035, -0.06); group.add(port);
  const feed = new THREE.Object3D(); feed.position.set(0.05, BM - 0.07, -0.1); group.add(feed); // belt entry under the right side (the chute hangs at your right hip, out of the sight line)
  const st = { trig: 0 };
  return {
    group, mesh, muzzle, port, feed, spin: B.spin, kind: 'rifle', bones: B, triangles: tris, drawCalls: 1, BM,
    setMode(mode) { B.sleeve.scale.setScalar(mode === 'vr' ? 1e-4 : 1); },
    animate(s) {
      const dt = s.dt || 0.016;
      const want = s.trigger || s.sinceShot < 0.06 ? 1 : 0;
      st.trig += (want - st.trig) * Math.min(1, dt * 30);
      B.trigger.rotation.x = -0.3 * st.trig;
      B.finger.rotation.y = 0.22 * st.trig;
      // Gun's generic recoil is a rifle's (6 cm, 10°) and a minigun re-kicks 25x a second: replace it with a
      // steady shove and buzz; the cool-down (its 'reload') tilts the muzzle down and away
      const rl = s.reloading ? Math.sin(s.reloadPhase * PI) : 0;
      const buzz = s.sinceShot < 0.08 ? Math.sin(s.sinceShot * 900) * 0.0015 : 0;
      group.position.set(buzz, -rl * 0.04 + buzz * 0.5, (s.kick || 0) * 0.012);
      group.rotation.set((s.kickRot || 0) * 0.025 - rl * 0.3, 0, rl * 0.25);
    },
  };
}

// Recommended attach offsets for the WebXR targetRaySpace (Quest Touch / Touch Plus).
// The gun origin is the centre of the gloved fist; the ray origin sits ~4 cm above and ~5–6 cm
// ahead of the fist, so the gun drops/backs off by that much. Bore stays parallel to the ray
// (-z) so the sight line == aim line; the pistol grip's 20° rake is modelled in the geometry.
// x nudges the fist centre (offset toward the palm) onto the controller handle.
export const VR_HOLD = {
  rifle: { position: [-0.006, -0.042, 0.058], rotation: [0, 0, 0] },
  launcher: { position: [0.006, -0.042, 0.058], rotation: [0, 0, 0] },
};

// Weapon state machine (fire rate, mag, reload anim, recoil)
export class Gun {
  constructor(model, cfg) {
    this.model = model;
    this.cfg = cfg; // {rpm, mag, reload, kick, auto}
    this.ammo = cfg.mag;
    this.cool = 0;
    this.reloading = 0;
    this.kick = 0;
    this.kickRot = 0;
    this.triggerHeld = false;
    this.lastTrigger = false;
    this.shotsFired = 0;
    this.sinceShot = 10;
    this.holder = new THREE.Group();
    this.holder.add(model.group);
  }
  canFire() { return this.cool <= 0 && this.reloading <= 0 && this.ammo > 0; }
  update(dt) {
    this.cool -= dt;
    this.sinceShot += dt;
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.ammo = this.cfg.mag; this.reloading = 0; this.justReloaded = true; }
    }
    this.kick *= Math.exp(-dt * 18);
    this.kickRot *= Math.exp(-dt * 14);
    const g = this.model.group;
    // reload: tilt gun down & roll
    const rl = this.reloading > 0 ? Math.sin(Math.min(1, 1 - this.reloading / this.cfg.reload) * Math.PI) : 0;
    g.position.set(0, -rl * 0.05, this.kick * 0.06);
    g.rotation.set(this.kickRot * 0.18 - rl * 0.35, 0, rl * 0.7);
    if (this.model.animate) {
      this.model.animate({
        dt, kick: this.kick, kickRot: this.kickRot,
        reloading: this.reloading > 0, reloadPhase: this.reloading > 0 ? clamp01(1 - this.reloading / this.cfg.reload) : 0,
        ammo: this.ammo, mag: this.cfg.mag, shotsFired: this.shotsFired, sinceShot: this.sinceShot, trigger: this.lastTrigger,
      });
    } else if (this.model.drum) this.model.drum.rotation.z = this.shotsFired * Math.PI / 3;
  }
  // returns true if a shot fires this frame
  tryFire(trigger) {
    const pressed = trigger && !this.lastTrigger;
    this.lastTrigger = trigger;
    if (!trigger) return false;
    if (!this.cfg.auto && !pressed) return false;
    if (this.ammo <= 0 && this.reloading <= 0) { this.startReload(); return false; }
    if (!this.canFire()) return false;
    this.ammo--;
    this.shotsFired++;
    this.sinceShot = 0;
    this.cool = 60 / this.cfg.rpm;
    this.kick = 1; this.kickRot = 1;
    if (this.ammo <= 0) this.startReload(0.12);
    return true;
  }
  startReload(delay = 0) {
    if (this.reloading > 0 || this.ammo === this.cfg.mag) return false;
    this.reloading = this.cfg.reload + delay;
    this.reloadStarted = true;
    return true;
  }
}
