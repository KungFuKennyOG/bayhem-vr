import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeRng } from '../../rng.js';
import { blobShadowTexture } from '../../textures.js';

// =====================================================================================
//  DOWNTOWN HAVEN — hero traffic. buildCar(type, opts) for sedan | taxi | police | suv | van | bus | wreck.
//  Bodies are lofted cross-sections (wheel tubs cut by the arch curve, rounded ends, tumblehome cabin),
//  all opaque parts in ONE mesh (shared material: atlas map × vertex colour, per-vertex roughness /
//  metalness / emission in a `rm` attribute), glass in a second, contact shadow in a third → 3 draws.
//  Model space: forward = -z, wheels on y = 0, left (driver) = -x.
//  opts.city = 'paris' (Level 5): French liveries + long EU plates, its own atlas / body material.
//  opts.city = 'tokyo' (Level 6): only the taxi paint and the police light colours change (same atlas).
//  The default (no city) path is untouched.
// =====================================================================================

const AW = 2048;                                  // atlas size (px)
const SIDE_ROW = { sedan: 0, taxi: 1, police: 2, suv: 3, van: 4, bus: 5 }; // 256 px rows of side livery
const R = {};                                     // named atlas rects [x, y, w, h] in px
let ATLAS = null, MAT = null, THIN = null;           // THIN: antenna / mirrors (kept out of the cover bounds)
let PARIS = false, MAT_P = null;                     // PARIS: the car being built uses the Paris liveries
let TOKYO = false;                                   // TOKYO (Level 6): dark taxis, all-red police light bars (default atlas)

// ---------------------------------------------------------------------- small math
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const sstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
// Catmull-Rom through z-sorted keys [[z, y], ...] (clamped at the ends)
function interp(keys, z) {
  if (z <= keys[0][0]) return keys[0][1];
  const n = keys.length;
  if (z >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0; while (z > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
  const t = (z - p1[0]) / (p2[0] - p1[0]);
  const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0] || 1) * (p2[0] - p1[0]);
  const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0] || 1) * (p2[0] - p1[0]);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}
const rectUV = (r) => [r[0] / AW, 1 - (r[1] + r[3]) / AW, (r[0] + r[2]) / AW, 1 - r[1] / AW]; // u0 v0 u1 v1

// ---------------------------------------------------------------------- geometry buckets
class Bucket {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.rm = []; }
  get tris() { return this.p.length / 9; }
  // one triangle; winding is fixed up against the supplied normals
  tri(a, b, c, na, nb, nc, ua, ub, uc, col, rm) {
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
    const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
    const ar = cx * cx + cy * cy + cz * cz;
    if (ar < 1e-12) return;
    const sx = na[0] + nb[0] + nc[0], sy = na[1] + nb[1] + nc[1], sz = na[2] + nb[2] + nc[2];
    if (cx * sx + cy * sy + cz * sz < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [ub, uc] = [uc, ub]; }
    this.p.push(...a, ...b, ...c); this.n.push(...na, ...nb, ...nc); this.uv.push(...ua, ...ub, ...uc);
    const ca = col.length === 9 ? col : [...col, ...col, ...col];
    this.c.push(...ca); this.rm.push(...rm, ...rm, ...rm);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('rm', new THREE.Float32BufferAttribute(this.rm, 3));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  append(o, m4) {
    const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m4);
    const P = [], N = [];
    for (let i = 0; i < o.p.length; i += 3) {
      v.set(o.p[i], o.p[i + 1], o.p[i + 2]).applyMatrix4(m4); P.push(v.x, v.y, v.z);
      v.set(o.n[i], o.n[i + 1], o.n[i + 2]).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z);
    }
    this.p.push(...P); this.n.push(...N); this.uv.push(...o.uv); this.c.push(...o.c); this.rm.push(...o.rm);
  }
}
const _v = new THREE.Vector3(), _n3 = new THREE.Matrix3();
// push a three.js geometry with a transform, constant colour / rm, uv either remapped into an atlas rect or the white cell
function pushGeo(bk, geo, m4, col, rm, rect = null) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  _n3.getNormalMatrix(m4);
  const uvr = rect ? rectUV(rect) : WHITE_UV;
  const pts = [], nrm = [], uvs = [];
  for (let i = 0; i < P.count; i++) {
    _v.fromBufferAttribute(P, i).applyMatrix4(m4); pts.push([_v.x, _v.y, _v.z]);
    _v.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); nrm.push([_v.x, _v.y, _v.z]);
    if (rect && U) uvs.push([lerp(uvr[0], uvr[2], U.getX(i)), lerp(uvr[1], uvr[3], U.getY(i))]);
    else uvs.push(rect ? [uvr[0], uvr[1]] : uvr);
  }
  for (let i = 0; i < pts.length; i += 3) bk.tri(pts[i], pts[i + 1], pts[i + 2], nrm[i], nrm[i + 1], nrm[i + 2], uvs[i], uvs[i + 1], uvs[i + 2], col, rm);
}
let WHITE_UV = [0.03, 0.2];
const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const RBOX = (w, h, d, r, s = 1) => (s = 1, new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
const CYL = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
// a textured quad: centre, right (u+) axis, up (v+) axis, normal
function quad(bk, c, right, up, w, h, rect, col, rm) {
  const r = rectUV(rect), hw = w / 2, hh = h / 2;
  const n = new THREE.Vector3(...right).cross(new THREE.Vector3(...up)).normalize().toArray();
  const P = (a, b) => [c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b];
  const A = P(-hw, -hh), B = P(hw, -hh), C = P(hw, hh), D = P(-hw, hh);
  bk.tri(A, B, C, n, n, n, [r[0], r[1]], [r[2], r[1]], [r[2], r[3]], col, rm);
  bk.tri(A, C, D, n, n, n, [r[0], r[1]], [r[2], r[3]], [r[0], r[3]], col, rm);
}

// ---------------------------------------------------------------------- surface finishes [roughness, metalness, emission]
const RM = {
  paint: [0.26, 0.3, 0], under: [0.9, 0.15, 0], rubber: [0.86, 0, 0], plastic: [0.62, 0.05, 0], satin: [0.38, 0.1, 0],
  chrome: [0.14, 1, 0], alu: [0.28, 1, 0], metal: [0.5, 0.8, 0], cloth: [0.95, 0, 0], lens: [0.08, 0.2, 0], sign: [0.4, 0, 0.9],
};
const C = { black: [0.035, 0.035, 0.038], under: [0.07, 0.065, 0.06], well: [0.03, 0.03, 0.03], trim: [0.05, 0.05, 0.055], chrome: [0.85, 0.86, 0.88], white: [1, 1, 1], interior: [0.11, 0.105, 0.1], headliner: [0.42, 0.4, 0.37], seat: [0.16, 0.15, 0.14], rubber: [0.06, 0.06, 0.06] };
const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };   // linear

// ---------------------------------------------------------------------- materials (shared by every car)
function materials(paris = false) {
  if (paris) {
    if (MAT_P) return MAT_P;
    const base = materials();
    const body = rmMaterial(buildAtlas(true), { envMapIntensity: 1.25, coat: true });
    body.userData.duskEmissive = 1.4;
    MAT_P = { ...base, body };
    return MAT_P;
  }
  if (MAT) return MAT;
  ATLAS = buildAtlas();
  const body = rmMaterial(ATLAS, { envMapIntensity: 1.25, coat: true });
  body.userData.duskEmissive = 1.4;               // signs / lenses ramp up at dusk
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0d11, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.5, envMapIntensity: 2.2, depthWrite: false });
  glass.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
      'float gfr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.5);\ndiffuseColor.a = mix(opacity, 0.97, gfr);\n#include <opaque_fragment>');
  };
  glass.customProgramCacheKey = () => 'carGlass';
  // burnt: procedural soot / rust / ash from model-space position, faint embers in the creases
  const charred = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.25, emissive: 0xff4a10, emissiveIntensity: 1 });
  charred.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vOP;
float chH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float chN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(chH(i), chH(i+vec3(1,0,0)), f.x), mix(chH(i+vec3(0,1,0)), chH(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(chH(i+vec3(0,0,1)), chH(i+vec3(1,0,1)), f.x), mix(chH(i+vec3(0,1,1)), chH(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  float cn = chN(vOP * 3.1) * 0.6 + chN(vOP * 11.0) * 0.3 + chN(vOP * 37.0) * 0.1;
  vec3 soot = vec3(0.016, 0.014, 0.013), rust = vec3(0.075, 0.032, 0.014), ash = vec3(0.16, 0.15, 0.14);
  vec3 cc = mix(soot, rust, smoothstep(0.5, 0.78, cn));
  cc = mix(cc, ash, smoothstep(0.7, 0.9, chN(vOP * 5.3 + 4.0)) * 0.6);
  diffuseColor.rgb = cc;`)
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = emissive * 0.12 * pow(smoothstep(0.7, 0.86, chN(vOP * 6.0 + 9.0)), 3.0) * (1.0 - smoothstep(0.3, 1.0, vOP.y));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.6, smoothstep(0.42, 0.7, cn));');
  };
  charred.customProgramCacheKey = () => 'carCharred';
  const blob = new THREE.MeshBasicMaterial({ map: blobShadowTexture(), color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  MAT = { body, glass, charred, blob };
  return MAT;
}

// MeshStandardMaterial driven per vertex: map × vertex colour, roughness / metalness / emission from the `rm` attribute
export function rmMaterial(map, params = {}) {
  const { coat, ...rest } = params;
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1, metalness: 1, emissive: 0xffffff, emissiveIntensity: 1, ...rest });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rm;\nvarying vec3 vRM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = rm;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRM;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = emissive * diffuseColor.rgb * vRM.z;');
    if (params.coat) s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>', `
      {   // fake clearcoat: sky gradient + horizon band + sun hotspot, fresnel-weighted (paint only)
        float coatM = 1.0 - smoothstep(0.004, 0.02, abs(vRM.x - 0.26));
        vec3 vd = normalize(vViewPosition);
        vec3 rv = reflect(-vd, normal);
        vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float ry = dot(rv, upV);
        vec3 hor = rimColor * 0.55 + vec3(0.06, 0.05, 0.05);
        vec3 sky = mix(hor, vec3(0.16, 0.24, 0.42), smoothstep(0.02, 0.55, ry));
        vec3 gnd = mix(hor * 0.35, vec3(0.025, 0.022, 0.02), smoothstep(-0.02, -0.25, ry));
        vec3 env = ry > 0.0 ? sky : gnd;
        env += rimColor * (pow(max(dot(rv, rimSunDir), 0.0), 220.0) * 6.0 + pow(max(dot(rv, rimSunDir), 0.0), 12.0) * 0.35);
        float fr = 0.05 + 0.95 * pow(1.0 - clamp(dot(normal, vd), 0.0, 1.0), 5.0);
        outgoingLight += env * fr * coatM * 0.85;
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => (params.coat ? 'rmMatCoat' : 'rmMat');
  return m;
}
export { Bucket, pushGeo, M4, quad as atlasQuad };

// ---------------------------------------------------------------------- vehicle specs
// zF/zR: bumper faces, hw: half width, axles, R tyre radius, tw tyre width, rimR, ar arch radius,
// sbKeys: side-skin bottom (rocker / bumper) along z, topKeys: hood/belt/deck height, cab: greenhouse.
const SPECS = {
  sedan: {
    zF: -2.42, zR: 2.43, hw: 0.915, axles: [-1.42, 1.43], R: 0.335, tw: 0.225, rimR: 0.215, ar: 0.405, wellIn: 0.27,
    floorY: 0.2, rr: [0.13, 0.11], taper: [0.07, 0.05], H: 1.55,
    sbKeys: [[-2.42, 0.25], [-2.0, 0.26], [-1.6, 0.27], [1.7, 0.28], [2.15, 0.29], [2.43, 0.31]],
    topKeys: [[-2.42, 0.6], [-2.36, 0.73], [-2.2, 0.8], [-1.5, 0.865], [-0.8, 0.93], [0.4, 0.95], [1.3, 0.975], [2.0, 0.995], [2.33, 0.985], [2.43, 0.88]],
    cab: { zA: -0.8, zW1: 0.02, zB0: 0.86, zC: 1.32, yRoof: 1.44, xr: 0.655, crown: 0.045, B: [0.22, 0.33], Cp: 0.94 },
    doors: [[-0.96, 0.275], [0.275, 1.05]], doorY: 0.31, inFloor: 0.3,
  },
  suv: {
    zF: -2.56, zR: 2.56, hw: 0.99, axles: [-1.5, 1.52], R: 0.4, tw: 0.27, rimR: 0.255, ar: 0.475, wellIn: 0.3,
    floorY: 0.33, rr: [0.13, 0.1], taper: [0.05, 0.03], H: 1.98, clad: 0.6,
    sbKeys: [[-2.56, 0.4], [-2.1, 0.41], [-1.8, 0.42], [1.9, 0.43], [2.3, 0.44], [2.56, 0.45]],
    topKeys: [[-2.56, 0.84], [-2.52, 1.0], [-2.38, 1.07], [-1.6, 1.1], [-0.72, 1.14], [1.5, 1.16], [2.42, 1.165], [2.52, 1.14], [2.56, 1.02]],
    cab: { zA: -0.72, zW1: -0.06, zB0: 2.36, zC: 2.5, yRoof: 1.87, xr: 0.83, crown: 0.03, B: [0.4, 0.52], C2: [1.38, 1.52], Cp: 2.26 },
    doors: [[-0.86, 0.46], [0.46, 1.06]], doorY: 0.44, inFloor: 0.45,
  },
  van: {   // cab only (the box is lofted separately)
    zF: -3.32, zR: -1.0, hw: 1.0, axles: [-2.5], R: 0.4, tw: 0.25, rimR: 0.25, ar: 0.47, wellIn: 0.3,
    floorY: 0.36, rr: [0.14, 0.02], taper: [0.06, 0], H: 3.2, zMin: -3.32, zMax: 3.42,
    sbKeys: [[-3.32, 0.4], [-2.9, 0.42], [-1.0, 0.44]],
    topKeys: [[-3.32, 0.86], [-3.27, 1.02], [-3.1, 1.1], [-2.7, 1.17], [-2.45, 1.2], [-1.0, 1.22]],
    cab: { zA: -2.45, zW1: -1.66, zB0: -1.06, zC: -1.0, yRoof: 2.42, xr: 0.86, crown: 0.03, B: [-2.06, -1.97], Cp: -1.25 },
    doors: [[-2.0, -1.12]], doorY: 0.46, inFloor: 0.5,
  },
  bus: {
    zF: -6.0, zR: 6.0, hw: 1.275, axles: [-3.35, 2.55], R: 0.5, tw: 0.3, rimR: 0.29, ar: 0.58, wellIn: 0.34,
    floorY: 0.32, rr: [0.2, 0.18], taper: [0.015, 0.012], H: 3.25,
  },
};

// ---------------------------------------------------------------------- loft
// stations: z list; sec(z) → [[x, y, tag], ...] half profile (x ≥ 0) from bottom centre to top centre.
// tag belongs to the segment from that point to the next; 'X' = zero-length sharp-corner marker.
function loft(stations, sec, { round = null, classify, color, uvf, inner = null, caps = false }, out) {
  const P = stations.map((z) => {
    const pts = sec(z).map(([x, y, t]) => [x, y, z, t]);
    if (round) {
      const { zF, zR, rr, ymid } = round;
      const dF = z - zF, dR = zR - z, d = dF < dR ? dF : dR, r = dF < dR ? rr[0] : rr[1];
      if (d < r) {
        const s = r - Math.sqrt(Math.max(0, r * r - (r - d) * (r - d)));
        const ym = ymid(z);
        for (const p of pts) { const dx = p[0], dy = p[1] - ym, l = Math.hypot(dx, dy) || 1; const k = Math.min(s, l * 0.9) / l; p[0] -= dx * k; p[1] -= dy * k; }
      }
    }
    return pts;
  });
  const ns = P.length, m = P[0].length, tags = P[0].map((p) => p[3]);
  const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-5;
  const N = P.map((row, i) => row.map((p, j) => {
    let pa = p, pb = p;
    if (j > 0 && tags[j - 1] !== 'X' && !same(row[j - 1], p)) pa = row[j - 1];
    if (j < m - 1 && tags[j] !== 'X' && !same(row[j + 1], p)) pb = row[j + 1];
    const tp = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const qa = P[Math.max(0, i - 1)][j], qb = P[Math.min(ns - 1, i + 1)][j];
    let tz = [qb[0] - qa[0], qb[1] - qa[1], qb[2] - qa[2]];
    if (Math.hypot(...tz) < 1e-6) tz = [0, 0, 1];
    let n = [tp[1] * tz[2] - tp[2] * tz[1], tp[2] * tz[0] - tp[0] * tz[2], tp[0] * tz[1] - tp[1] * tz[0]];
    const l = Math.hypot(...n);
    return l < 1e-9 ? [0, -1, 0] : n.map((v) => v / l);
  }));
  const mir = (p, s) => [p[0] * s, p[1], p[2]];
  let curTag = '';
  const emit = (bkName, s, a, b, c, na, nb, nc, col, rm) => {
    const bk = out[bkName]; if (!bk) return;
    bk.tri(mir(a, s), mir(b, s), mir(c, s), mir(na, s), mir(nb, s), mir(nc, s), uvf(a, curTag), uvf(b, curTag), uvf(c, curTag), col, rm);
  };
  for (let i = 0; i < ns - 1; i++) {
    const zm = (stations[i] + stations[i + 1]) / 2;
    for (let j = 0; j < m - 1; j++) {
      const tag = tags[j]; if (tag === 'X') continue; curTag = tag;
      const a = P[i][j], b = P[i + 1][j], c = P[i + 1][j + 1], d = P[i][j + 1];
      const ym = (a[1] + c[1]) / 2;
      for (const s of [1, -1]) {
        const bk = classify(tag, zm, s, ym); if (!bk) continue;
        const [col, rm] = color(tag, zm, ym, s);
        emit(bk, s, a, b, c, N[i][j], N[i + 1][j], N[i + 1][j + 1], col, rm);
        emit(bk, s, a, c, d, N[i][j], N[i + 1][j + 1], N[i][j + 1], col, rm);
        const inn = inner && bk.toLowerCase().indexOf('glass') < 0 && inner(tag, zm, ym);
        if (inn) {
          const off = (p, n) => [p[0] - n[0] * inn.off, p[1] - n[1] * inn.off, p[2] - n[2] * inn.off];
          const ng = (n) => [-n[0], -n[1], -n[2]];
          const nI = [N[i][j], N[i + 1][j], N[i + 1][j + 1], N[i][j + 1]];
          const ib = bk.startsWith('door') ? 'door' : 'body';
          emit(ib, s, off(a, nI[0]), off(b, nI[1]), off(c, nI[2]), ng(nI[0]), ng(nI[1]), ng(nI[2]), inn.col, inn.rm);
          emit(ib, s, off(a, nI[0]), off(c, nI[2]), off(d, nI[3]), ng(nI[0]), ng(nI[2]), ng(nI[3]), inn.col, inn.rm);
        }
      }
    }
  }
  if (caps) for (const [i, dz] of [[0, -1], [ns - 1, 1]]) {
    const row = P[i], cont = [];
    const push = (x, y) => { const l = cont[cont.length - 1]; if (!l || Math.abs(l.x - x) + Math.abs(l.y - y) > 1e-4) cont.push(new THREE.Vector2(x, y)); };
    for (let j = 0; j < m; j++) push(row[j][0], row[j][1]);
    for (let j = m - 2; j >= 1; j--) push(-row[j][0], row[j][1]);
    if (cont.length > 2 && cont[0].distanceTo(cont[cont.length - 1]) < 1e-4) cont.pop();
    if (cont.length < 3) continue;
    const tri = THREE.ShapeUtils.triangulateShape(cont, []), z = row[0][2], n = [0, 0, dz];
    curTag = 'cap';
    for (const [a, b, c2] of tri) {
      const A = cont[a], B = cont[b], Cc = cont[c2];
      const [col, rm] = color('cap', z, (A.y + B.y + Cc.y) / 3, 1, true);
      emit('body', 1, [A.x, A.y, z], [B.x, B.y, z], [Cc.x, Cc.y, z], n, n, n, col, rm);
    }
  }
  return P;
}
// sorted unique stations from ranges + extra keys
function stationList(z0, z1, step, extras) {
  const zs = [];
  const n = Math.ceil((z1 - z0) / step);
  for (let i = 0; i <= n; i++) zs.push(z0 + (z1 - z0) * i / n);
  for (const z of extras) if (z > z0 && z < z1) zs.push(z);
  zs.sort((a, b) => a - b);
  const out = [];
  for (const z of zs) if (!out.length || z - out[out.length - 1] > 0.012) out.push(z); else if (z === z1) out[out.length - 1] = z1;
  return out;
}
function archStations(S, segs = 7) { const e = []; for (const az of S.axles) for (let k = 0; k <= segs; k++) e.push(az - S.ar * Math.cos(k / segs * Math.PI)); return e; }
function endStations(z0, z1, rr) { const e = []; for (const f of [0.02, 0.1, 0.3, 0.6]) { e.push(z0 + rr[0] * f); e.push(z1 - rr[1] * f); } return e; }

// ---------------------------------------------------------------------- generic car body (sedan / suv / van cab)
function hwAt(S, z) {
  const L = 0.75;
  let k = 1 - S.taper[0] * Math.pow(1 - clamp01((z - S.zF) / L), 2) - S.taper[1] * Math.pow(1 - clamp01((S.zR - z) / L), 2);
  for (const az of S.axles) { const d = Math.abs(z - az); if (d < S.ar + 0.25) k += 0.012 * sstep(1 - d / (S.ar + 0.25)); }  // fender swell
  return S.hw * k;
}
function archY(S, z) {
  let y = -1;
  for (const az of S.axles) { const d = z - az; if (Math.abs(d) < S.ar) y = Math.max(y, S.R + 0.02 + Math.sqrt(S.ar * S.ar - d * d)); }
  return y;
}
const SIDE_T = [[-0.045, 0], [-0.006, 0.12], [0.004, 0.45], [-0.004, 0.76], [-0.03, 0.95]];
function carSection(S, z) {
  const yb = interp(S.sbKeys, z), yT = interp(S.topKeys, z), ySB = Math.max(yb, archY(S, z));
  const yF = Math.min(S.floorY, yb), hw = hwAt(S, z), wi = hw - S.wellIn, cr = S.cab.crown * 0.35;
  const pts = [[0, yF, 'u'], [wi, yF, 'X'], [wi, yF, 'w'], [wi, ySB, 'X'], [wi, ySB, 'w'], [hw - 0.06, ySB, 'X']];
  let yPrev = ySB;
  SIDE_T.forEach(([dx, t], k) => {
    let y = Math.max(yb + (yT - yb) * t, ySB); if (y < yPrev) y = yPrev; yPrev = y;
    pts.push([hw + dx, y, k === SIDE_T.length - 1 ? 's' : (k === 0 ? 's0' : 's')]);
  });
  pts.push([hw - 0.09, Math.max(yPrev, yT - 0.006), 't'], [hw * 0.45, yT + cr * 0.75, 't'], [0, yT + cr, 'end']);
  return pts;
}
function roofY(S, z) {
  const c = S.cab, ybA = interp(S.topKeys, c.zA), ybC = interp(S.topKeys, c.zC);
  if (z <= c.zW1) { const t = clamp01((z - c.zA) / (c.zW1 - c.zA)); return ybA + (c.yRoof - ybA) * (1 - Math.pow(1 - t, 1.35)); }
  if (z >= c.zB0) { const t = clamp01((z - c.zB0) / (c.zC - c.zB0)); return c.yRoof - (c.yRoof - ybC) * Math.pow(t, 1.25); }
  return c.yRoof + 0.012 * Math.sin(Math.PI * (z - c.zW1) / (c.zB0 - c.zW1));
}
function cabSection(S, z) {
  const c = S.cab, yb = interp(S.topKeys, z), xb = hwAt(S, z) - 0.075;
  const yr = Math.max(yb, roofY(S, z)), q = clamp01((yr - yb) / Math.max(0.01, c.yRoof - yb));
  const xt = lerp(xb - 0.05, c.xr, Math.pow(q, 0.7));
  const y1 = Math.min(yr, yb + 0.035), y2 = Math.max(y1, yr - 0.055);
  const x2 = lerp(xb - 0.012, xt + 0.022, clamp01((y2 - yb) / Math.max(0.01, yr - yb)));
  const cr = c.crown * q;
  return [[xb, yb, 'frame'], [xb - 0.012, y1, 'win'], [x2, y2, 'drip'], [xt, yr, 'roofE'], [xt - 0.09, yr + cr * 0.15, 'roof'], [xt * 0.55, yr + cr * 0.8, 'roof'], [0, yr + cr, 'end']];
}

// ---------------------------------------------------------------------- wheel
function lathe(bk, m4, prof, segs, col, rm, uvMode) {
  const nm = new THREE.Matrix3().getNormalMatrix(m4), v = new THREE.Vector3();
  const rows = [];
  for (let k = 0; k <= segs; k++) {
    const th = k / segs * Math.PI * 2, ct = Math.cos(th), st = Math.sin(th), row = [];
    for (let j = 0; j < prof.length; j++) {
      const [a, r] = prof[j];
      const pa = prof[Math.max(0, j - 1)], pb = prof[Math.min(prof.length - 1, j + 1)];
      let ta = pb[0] - pa[0], tr = pb[1] - pa[1]; const l = Math.hypot(ta, tr) || 1; ta /= l; tr /= l;
      const na = -tr, nr = ta;
      v.set(a, r * ct, r * st).applyMatrix4(m4); const p = [v.x, v.y, v.z];
      v.set(na, nr * ct, nr * st).applyMatrix3(nm).normalize(); const n = [v.x, v.y, v.z];
      row.push({ p, n, uv: uvMode(a, r, th, k / segs) });
    }
    rows.push(row);
  }
  for (let k = 0; k < segs; k++) for (let j = 0; j < prof.length - 1; j++) {
    const A = rows[k][j], B = rows[k + 1][j], Cc = rows[k + 1][j + 1], D = rows[k][j + 1];
    bk.tri(A.p, B.p, Cc.p, A.n, B.n, Cc.n, A.uv, B.uv, Cc.uv, col, rm);
    bk.tri(A.p, Cc.p, D.p, A.n, Cc.n, D.n, A.uv, Cc.uv, D.uv, col, rm);
  }
}
// wheel centred at (x, y, z), outer face toward sign(x); style: spokes count / dish
function wheel(bk, x, y, z, R0, tw, rimR, { spokes = 5, tyre = true, rimCol = C.chrome, rimRm = RM.alu, steer = 0, hub = 'alloy', brakes = true } = {}) {
  const s = x < 0 ? -1 : 1;
  const m4 = M4(x, y, z, 0, steer, 0).multiply(new THREE.Matrix4().makeScale(s, 1, 1));
  const w = tw / 2;
  if (tyre) {
    const rs = rimR + 0.012, mid = (rs + R0) / 2;
    const prof = [[-w + 0.02, rs], [-w - 0.01, mid], [-w + 0.004, R0 - 0.035], [-w + 0.05, R0],
      [w - 0.05, R0], [w - 0.004, R0 - 0.035], [w + 0.01, mid], [w - 0.02, rs]];
    const sw = rectUV(R.sidewall), tr = rectUV(R.tread);
    const scx = (sw[0] + sw[2]) / 2, scy = (sw[1] + sw[3]) / 2, shw = (sw[2] - sw[0]) / 2;
    lathe(bk, m4, prof, 12, C.white, RM.rubber, (a, r, th, u) => {
      if (Math.abs(a) < w - 0.03) return [lerp(tr[0], tr[2], u), lerp(tr[1], tr[3], (a + w) / tw)];
      const rr = r / R0 * shw * (a > 0 ? 1 : 0.999); return [scx + Math.cos(th) * rr, scy + Math.sin(th) * rr];
    });
  }
  // rim: flange, lip, dish
  const L = (a, r) => [a, r];
  lathe(bk, m4, [L(w - 0.03, rimR + 0.014), L(w - 0.004, rimR + 0.012), L(w + 0.004, rimR - 0.006), L(w - 0.012, rimR - 0.028), L(w - 0.07, rimR - 0.036), L(-w + 0.03, rimR - 0.036)], 12, rimCol, rimRm, () => WHITE_UV);
  // back plate (hides the void) + brake disc + caliper
  pushGeo(bk, CYL(rimR - 0.03, rimR - 0.03, 0.01, 10), m4.clone().multiply(M4(-w + 0.04, 0, 0, 0, 0, Math.PI / 2)), C.well, RM.under);
  if (brakes) pushGeo(bk, CYL(rimR - 0.05, rimR - 0.05, 0.022, 10), m4.clone().multiply(M4(-0.02, 0, 0, 0, 0, Math.PI / 2)), [0.1, 0.095, 0.09], RM.metal);
  if (brakes) pushGeo(bk, BOX(0.05, 0.11, 0.16), m4.clone().multiply(M4(0.0, rimR * 0.52, rimR * 0.3, -0.5, 0, 0)), [0.5, 0.06, 0.04], RM.satin);
  // spokes + centre cap
  const face = w - 0.035;
  if (hub === 'steel') {
    pushGeo(bk, CYL(rimR - 0.03, rimR - 0.03, 0.012, 14), m4.clone().multiply(M4(face - 0.01, 0, 0, 0, 0, Math.PI / 2)), rimCol, rimRm);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; pushGeo(bk, CYL(0.022, 0.022, 0.016, 5), m4.clone().multiply(M4(face - 0.003, Math.cos(a) * rimR * 0.62, Math.sin(a) * rimR * 0.62, 0, 0, Math.PI / 2)), C.black, RM.under); }
  } else {
    for (let k = 0; k < spokes; k++) {
      const a = k / spokes * Math.PI * 2, rm = rimR * 0.52;
      pushGeo(bk, BOX(0.03, rimR - 0.05, 0.06), m4.clone().multiply(M4(face - 0.006, Math.cos(a) * rm, Math.sin(a) * rm, a - Math.PI / 2, 0, 0)), rimCol, rimRm);
    }
  }
  pushGeo(bk, CYL(0.062, 0.07, 0.035, 8), m4.clone().multiply(M4(face, 0, 0, 0, 0, -Math.PI / 2)), rimCol, RM.chrome);
}

// ---------------------------------------------------------------------- atlas
function buildAtlas(paris = false) {
  const c = document.createElement('canvas'); c.width = c.height = AW;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, AW, AW);
  const FONT = '"Anton", Impact, "Arial Black", "DejaVu Sans", sans-serif', FONT2 = '"Oswald", "Arial Narrow", "DejaVu Sans Condensed", sans-serif';
  const cell = (cx, cy, w = 256, h = 256) => [cx * 256, 1536 + cy * 256, w, h];
  R.white = cell(0, 0, 128, 128); WHITE_UV = [64 / AW, 1 - (1536 + 64) / AW];
  // licence plates 8 × (128×64)
  if (!paris) R.plates = [];
  R.platesFR = [0, 1, 2, 3].map((k) => [256, 1536 + k * 64, 256, 56]);
  const pr = makeRng(8128);
  if (paris) parisPlates(g, FONT, FONT2);
  else for (let k = 0; k < 8; k++) {
    const x = 256 + (k % 2) * 128, y = 1536 + Math.floor(k / 2) * 64;
    g.fillStyle = '#e9ecef'; g.fillRect(x, y, 128, 64);
    g.fillStyle = '#1e3a7a'; g.fillRect(x, y, 128, 12);
    g.fillStyle = '#fff'; g.font = `600 10px ${FONT2}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HAVEN STATE', x + 64, y + 6.5);
    const L = 'ABCDEFGHJKLMNPRSTVWXYZ';
    const txt = `${L[pr() * 22 | 0]}${L[pr() * 22 | 0]}${L[pr() * 22 | 0]}·${1000 + (pr() * 8999 | 0)}`;
    g.fillStyle = '#16244d'; g.font = `400 34px ${FONT}`; g.fillText(txt, x + 64, y + 38);
    g.fillStyle = '#9a2a20'; g.font = `600 8px ${FONT2}`; g.fillText('CITY OF LIGHTS', x + 64, y + 58);
    g.strokeStyle = '#333'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 126, 62);
    R.plates.push([x + 2, y + 2, 124, 60]);
  }
  // tyre sidewall ring (polar)
  R.sidewall = cell(2, 0);
  {
    const [x, y] = R.sidewall, cx = x + 128, cy = y + 128;
    g.fillStyle = '#121212'; g.fillRect(x, y, 256, 256);
    const rg = g.createRadialGradient(cx, cy, 60, cx, cy, 128);
    rg.addColorStop(0, '#1a1a1a'); rg.addColorStop(0.55, '#161616'); rg.addColorStop(0.85, '#202020'); rg.addColorStop(1, '#0e0e0e');
    g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, 128, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 104, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(200,200,200,0.55)'; g.font = `400 15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const word = (s, a0) => { for (let i = 0; i < s.length; i++) { const a = a0 + i * 0.075; g.save(); g.translate(cx + Math.cos(a) * 113, cy + Math.sin(a) * 113); g.rotate(a + Math.PI / 2); g.fillText(s[i], 0, 0); g.restore(); } };
    word('IRONHIDE  ALL-SEASON', -1.2); word('225/55 R17  94V', 1.9);
  }
  // tread (u around, v across) + grille mesh
  R.tread = cell(3, 0, 256, 128); R.grille = [768, 1664, 256, 128];
  {
    const [x, y] = R.tread;
    g.fillStyle = '#151515'; g.fillRect(x, y, 256, 128);
    g.fillStyle = '#070707';
    for (const v of [30, 58, 70, 98]) g.fillRect(x, y + v, 256, 5);
    for (let k = 0; k < 64; k++) { const u = x + k * 4; g.fillRect(u, y + 8, 1.5, 20); g.fillRect(u + 2, y + 100, 1.5, 20); g.fillRect(u + 1, y + 36, 1, 20); g.fillRect(u + 3, y + 76, 1, 20); }
    const [gx, gy] = R.grille;
    g.fillStyle = '#0b0b0c'; g.fillRect(gx, gy, 256, 128);
    for (let j = 0; j < 12; j++) for (let i = 0; i < 26; i++) {
      const px = gx + i * 10 + (j % 2) * 5, py = gy + j * 11 + 4;
      g.fillStyle = '#3a3b3e'; g.beginPath(); g.moveTo(px, py); g.lineTo(px + 4, py - 3); g.lineTo(px + 8, py); g.lineTo(px + 8, py + 5); g.lineTo(px + 4, py + 8); g.lineTo(px, py + 5); g.closePath(); g.fill();
      g.fillStyle = '#000'; g.fillRect(px + 2, py + 1, 4, 4);
    }
  }
  // dash cluster + seat fabric
  R.dash = [1024, 1536, 256, 128]; R.seat = [1024, 1664, 256, 128];
  {
    const [x, y] = R.dash; g.fillStyle = '#0c0c0d'; g.fillRect(x, y, 256, 128);
    for (const [cx, rr] of [[70, 46], [186, 46]]) {
      g.fillStyle = '#16181b'; g.beginPath(); g.arc(x + cx, y + 64, rr, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d8a050'; g.lineWidth = 2; g.beginPath(); g.arc(x + cx, y + 64, rr - 5, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
      for (let k = 0; k <= 10; k++) { const a = Math.PI * 0.75 + k / 10 * Math.PI * 1.5; g.beginPath(); g.moveTo(x + cx + Math.cos(a) * (rr - 6), y + 64 + Math.sin(a) * (rr - 6)); g.lineTo(x + cx + Math.cos(a) * (rr - 14), y + 64 + Math.sin(a) * (rr - 14)); g.stroke(); }
      g.strokeStyle = '#ff5a20'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + cx, y + 64); g.lineTo(x + cx + Math.cos(2.4) * (rr - 10), y + 64 + Math.sin(2.4) * (rr - 10)); g.stroke();
    }
    const [sx, sy] = R.seat; g.fillStyle = '#5a5650'; g.fillRect(sx, sy, 256, 128);
    for (let k = 0; k < 256; k += 16) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(sx + k, sy, 3, 128); }
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${pr() < 0.5 ? 0 : 255},${pr() < 0.5 ? 0 : 255},${pr() < 0.5 ? 0 : 255},0.06)`; g.fillRect(sx + pr() * 256, sy + pr() * 128, 2, 2); }
  }
  // taxi roof sign + door text
  R.taxiSign = [1280, 1536, 256, 96]; R.taxiDoor = [1280, 1648, 256, 80]; R.taxiNum = [1280, 1736, 128, 48];
  R.taxiSignFR = [1280, 1536, 256, 64];
  if (paris) parisTaxi(g, FONT, FONT2);
  else {
    let [x, y, w, h] = R.taxiSign; g.fillStyle = '#ffe9a8'; g.fillRect(x, y, w, h);
    g.fillStyle = '#141414'; g.fillRect(x, y, w, 6); g.fillRect(x, y + h - 6, w, 6);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#121212'; g.font = `400 46px ${FONT}`; g.fillText('HAVEN CAB', x + w / 2, y + 40);
    g.font = `600 17px ${FONT2}`; g.fillStyle = '#b01d12'; g.fillText('DIAL 555-0199', x + w / 2, y + 76);
    [x, y, w, h] = R.taxiDoor; g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
    g.fillStyle = '#111'; g.font = `400 40px ${FONT}`; g.fillText('HAVEN CAB', x + w / 2, y + 30);
    g.font = `600 15px ${FONT2}`; g.fillText('LICENSED  •  METERED  •  24 HR', x + w / 2, y + 64);
    [x, y, w, h] = R.taxiNum; g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillStyle = '#111'; g.font = `400 34px ${FONT}`; g.fillText('4H27', x + w / 2, y + h / 2 + 2);
  }
  // police door + rear quarter + roof number
  R.pdDoor = [1536, 1536, 256, 128]; R.pdQuarter = [1536, 1664, 128, 64]; R.pdRoof = [1664, 1664, 128, 64];
  if (paris) parisPolice(g, FONT, FONT2);
  else {
    let [x, y, w, h] = R.pdDoor; g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
    // badge star
    g.save(); g.translate(x + 40, y + 62); g.fillStyle = '#c99a2e'; g.beginPath();
    for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 17 : 36; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = '#1b2c55'; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill(); g.restore();
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#0d0d0f'; g.font = `400 58px ${FONT}`; g.fillText('HCPD', x + 84, y + 50);
    g.font = `600 14px ${FONT2}`; g.fillStyle = '#1b2c55'; g.fillText('HAVEN CITY POLICE', x + 86, y + 92);
    g.font = `italic 600 12px ${FONT2}`; g.fillStyle = '#555'; g.fillText('to protect and to serve', x + 86, y + 110);
    [x, y, w, h] = R.pdQuarter; g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.textAlign = 'center'; g.fillStyle = '#111'; g.font = `400 40px ${FONT}`; g.fillText('911', x + w / 2, y + h / 2 + 2);
    [x, y, w, h] = R.pdRoof; g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillStyle = '#111'; g.font = `400 44px ${FONT}`; g.fillText('2H17', x + w / 2, y + h / 2 + 2);
  }
  // van logo (fictional courier)
  R.vanLogo = [0, 1792, 512, 256];
  if (paris) parisVanLogo(g, FONT, FONT2);
  else {
    const [x, y, w, h] = R.vanLogo; g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
    g.fillStyle = '#d2461c'; g.beginPath(); g.moveTo(x + 20, y + 150); g.quadraticCurveTo(x + 250, y + 40, x + 500, y + 70); g.lineTo(x + 500, y + 95); g.quadraticCurveTo(x + 250, y + 70, x + 20, y + 175); g.fill();
    g.fillStyle = '#1d2f4f'; g.beginPath(); g.moveTo(x + 20, y + 185); g.quadraticCurveTo(x + 260, y + 85, x + 500, y + 110); g.lineTo(x + 500, y + 122); g.quadraticCurveTo(x + 260, y + 100, x + 20, y + 197); g.fill();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#1d2f4f'; fit(g, 'KRANE & SONS', 70, FONT, 460); g.fillText('KRANE & SONS', x + 28, y + 88);
    g.font = `600 22px ${FONT2}`; g.fillStyle = '#d2461c'; g.fillText('COURIER  •  FREIGHT  •  SAME DAY', x + 30, y + 225);
    g.fillStyle = '#1d2f4f'; g.font = `600 20px ${FONT2}`; g.fillText('HAVEN CITY  555-0142', x + 300, y + 168);
  }
  // bus destination LED + side lettering
  R.busDest = [512, 1792, 512, 64]; R.busSide = [512, 1856, 1024, 128]; R.busRoute = [1024, 1792, 128, 64];
  if (paris) parisBus(g, FONT, FONT2);
  else {
    let [x, y, w, h] = R.busDest; g.fillStyle = '#050505'; g.fillRect(x, y, w, h);
    g.fillStyle = '#ffb21e'; g.font = `400 40px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('42', x + 16, y + 33);
    g.font = `400 34px ${FONT}`; g.fillText('MERIDIAN SQ  via 5th AVE', x + 80, y + 33);
    g.fillStyle = 'rgba(0,0,0,0.55)'; for (let k = 0; k < w; k += 3) g.fillRect(x + k, y, 1, h); for (let k = 0; k < h; k += 3) g.fillRect(x, y + k, w, 1);
    [x, y, w, h] = R.busSide; g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
    g.fillStyle = '#0f5a6e'; fit(g, 'HAVEN TRANSIT', 84, FONT, 540); g.textAlign = 'left'; g.fillText('HAVEN TRANSIT', x + 24, y + 62);
    g.fillStyle = '#e0a21a'; g.fillRect(x + 590, y + 34, 380, 10); g.fillStyle = '#0f5a6e'; g.font = `600 26px ${FONT2}`; g.fillText('RIDE THE CITY OF LIGHTS', x + 594, y + 72);
    [x, y, w, h] = R.busRoute; g.fillStyle = '#050505'; g.fillRect(x, y, w, h); g.fillStyle = '#ffb21e'; g.font = `400 46px ${FONT}`; g.textAlign = 'center'; g.fillText('42', x + w / 2, y + h / 2 + 2);
  }
  R.vanRear = [1792, 1536, 256, 256]; R.chevron = [1536, 1856, 512, 32];
  if (paris) parisVanRear(g, FONT, FONT2, pr);
  else {
    const [x, y, w, h] = R.vanRear;
    g.fillStyle = '#eceae4'; g.fillRect(x, y, w, h);
    const gr = g.createLinearGradient(0, y + h * 0.55, 0, y + h); gr.addColorStop(0, 'rgba(110,92,74,0)'); gr.addColorStop(1, 'rgba(96,80,64,0.65)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
    for (let k = 0; k < 70; k++) {   // soft rain streaks from the header and the stiffeners
      const sx = x + pr() * w, sy = y + [8, h * 0.33, h * 0.66][(pr() * 3) | 0], len = 20 + Math.pow(pr(), 1.5) * 110, a = 0.05 + pr() * 0.1;
      const lg = g.createLinearGradient(0, sy, 0, sy + len); lg.addColorStop(0, `rgba(70,62,54,${a})`); lg.addColorStop(1, 'rgba(70,62,54,0)');
      g.fillStyle = lg; g.fillRect(sx, sy, 2 + pr() * 4, len);
    }
    // door seams: centre split, panel insets, horizontal stiffeners
    g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(x + w / 2 - 1.5, y, 3, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (const x0 of [x + 8, x + w / 2 + 8]) { g.strokeRect(x0, y + 10, w / 2 - 16, h - 20); for (const t of [0.33, 0.66]) { g.beginPath(); g.moveTo(x0, y + h * t); g.lineTo(x0 + w / 2 - 16, y + h * t); g.stroke(); } }
    g.fillStyle = 'rgba(255,255,255,0.35)'; for (const t of [0.33, 0.66]) g.fillRect(x + 8, y + h * t + 2, w - 16, 1);
    // rivet rows along the edges
    g.fillStyle = 'rgba(0,0,0,0.4)'; for (let k = 0; k < 20; k++) { g.fillRect(x + 4, y + 8 + k * 12.4, 2, 2); g.fillRect(x + w - 6, y + 8 + k * 12.4, 2, 2); }
    // decal: logo mark + how's my driving
    g.fillStyle = '#d2461c'; g.beginPath(); g.moveTo(x + 22, y + 74); g.quadraticCurveTo(x + 64, y + 52, x + 110, y + 58); g.lineTo(x + 110, y + 63); g.quadraticCurveTo(x + 64, y + 60, x + 22, y + 80); g.fill();
    g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#1d2f4f'; g.font = `400 20px ${FONT}`; g.fillText('KRANE & SONS', x + 20, y + 50);
    g.fillStyle = '#fff'; g.fillRect(x + w / 2 + 14, y + 36, 96, 40); g.strokeStyle = '#1d2f4f'; g.lineWidth = 2; g.strokeRect(x + w / 2 + 14, y + 36, 96, 40);
    g.fillStyle = '#1d2f4f'; g.font = `600 11px ${FONT2}`; g.fillText("HOW'S MY DRIVING?", x + w / 2 + 20, y + 52); g.font = `400 15px ${FONT}`; g.fillText('555-0142', x + w / 2 + 30, y + 70);
    g.fillStyle = '#c9a02a'; g.fillRect(x + 22, y + h - 92, 72, 22); g.fillStyle = '#111'; g.font = `600 10px ${FONT2}`; g.fillText('CAUTION: WIDE TURNS', x + 24, y + h - 77);
    g.fillStyle = '#e8e6e0'; g.fillRect(x + w / 2 + 40, y + h - 96, 46, 26); g.fillStyle = '#333'; g.font = `600 9px ${FONT2}`; g.fillText('US DOT 3141592', x + w / 2 + 42, y + h - 80);
    // conspicuity tape along the bottom + upper corners
    const tape = (tx, ty, tw, th) => { for (let k = 0; k * 12 < tw; k++) { g.fillStyle = k % 2 ? '#c41a12' : '#f4f2ee'; g.fillRect(tx + k * 12, ty, Math.min(12, tw - k * 12), th); } };
    tape(x + 6, y + h - 26, w - 12, 10); tape(x + 6, y + 6, 36, 6); tape(x + w - 42, y + 6, 36, 6);
  }
  { const [x, y, w, h] = R.chevron; for (let k = -2; k * 32 < w + 32; k++) { g.fillStyle = k % 2 ? '#d01c12' : '#f6f4ee'; g.beginPath(); g.moveTo(x + k * 32, y + h); g.lineTo(x + k * 32 + 32, y + h); g.lineTo(x + k * 32 + 64, y); g.lineTo(x + k * 32 + 32, y); g.fill(); } }
  R.reflector = [1152, 1792, 128, 64];
  { const [x, y, w, h] = R.reflector; const lg = g.createLinearGradient(x, y, x, y + h); lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.5, '#9aa0a8'); lg.addColorStop(1, '#f0f0f0'); g.fillStyle = lg; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < w; k += 8) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + h); g.stroke(); } }
  // side livery rows
  for (const [kind, row] of Object.entries(SIDE_ROW)) drawSide(g, kind, row, paris);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// ---------------------------------------------------------------------- Paris atlas content (Level 5)
// long EU plates: white, blue band on the left (F + stars ring), AA-123-AA, regional blue band on the right
function parisPlates(g, FONT, FONT2) {
  const pr = makeRng(7505);
  const L = 'ABCDEFGHJKLMNPQRSTVWXYZ';
  R.platesFR.forEach(([x, y, w, h], k) => {
    g.fillStyle = '#eef0f0'; g.fillRect(x, y, w, h);
    g.fillStyle = '#1d3f9a'; g.fillRect(x, y, 22, h); g.fillRect(x + w - 22, y, 22, h);
    g.fillStyle = '#e8c21a'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(x + 11 + Math.cos(a) * 6 - 1, y + 17 + Math.sin(a) * 6 - 1, 2, 2); }
    g.fillStyle = '#fff'; g.font = `600 14px ${FONT2}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('F', x + 11, y + 40);
    g.fillText(['75', '92', '93', '94'][k], x + w - 11, y + 40);
    g.fillStyle = '#e8c21a'; g.beginPath(); g.arc(x + w - 11, y + 18, 6, 0, 7); g.fill();
    const txt = `${L[pr() * 23 | 0]}${L[pr() * 23 | 0]}-${100 + (pr() * 899 | 0)}-${L[pr() * 23 | 0]}${L[pr() * 23 | 0]}`;
    g.fillStyle = '#121212'; g.font = `400 40px ${FONT}`; g.fillText(txt, x + w / 2, y + h / 2 + 2);
    g.strokeStyle = '#333'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  });
}
// "TAXI PARISIEN" roof sign (white, black lettering; lit from inside)
function parisTaxi(g, FONT, FONT2) {
  const [x, y, w, h] = R.taxiSignFR;
  g.fillStyle = '#f4f2ea'; g.fillRect(x, y, w, h);
  g.fillStyle = '#141414'; g.fillRect(x, y, w, 4); g.fillRect(x, y + h - 4, w, 4);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#121212';
  fit(g, 'TAXI PARISIEN', 44, FONT, 236); g.fillText('TAXI PARISIEN', x + w / 2, y + h / 2 + 1);
  // the three little tariff lamps (A / B / C) on the lower edge of the sign
  ['A', 'B', 'C'].forEach((t, i) => { g.fillStyle = '#c9c2a8'; g.fillRect(x + 8 + i * 14, y + h - 16, 11, 10); g.fillStyle = '#333'; g.font = `600 8px ${FONT2}`; g.fillText(t, x + 13.5 + i * 14, y + h - 11); });
}
// police: "POLICE" door panel (drawn at half width: the decal stretches 2:1), "17" quarter, roof number
function parisPolice(g, FONT, FONT2) {
  let [x, y, w, h] = R.pdDoor;
  g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
  g.save(); g.translate(x + w / 2, y + h / 2); g.scale(0.5, 1);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1b2f7a';
  fit(g, 'POLICE', 112, FONT, 440); g.fillText('POLICE', 0, 4);
  g.restore();
  [x, y, w, h] = R.pdQuarter; g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1b2f7a'; g.font = `400 40px ${FONT}`; g.fillText('17', x + w / 2, y + h / 2 + 2);
  [x, y, w, h] = R.pdRoof; g.fillStyle = '#fff'; g.fillRect(x, y, w, h); g.fillStyle = '#111'; g.font = `400 40px ${FONT}`; g.fillText('75-12', x + w / 2, y + h / 2 + 2);
}
// van: a plain municipal-service livery (fictional)
function parisVanLogo(g, FONT, FONT2) {
  const [x, y, w, h] = R.vanLogo;
  g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
  g.fillStyle = '#1d3f7a'; g.fillRect(x + 20, y + 150, 470, 8);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#1d3f7a';
  fit(g, 'SEINE  SERVICES', 64, FONT, 460); g.fillText('SEINE  SERVICES', x + 24, y + 130);
  g.font = `500 22px ${FONT2}`; g.fillStyle = '#444'; g.fillText('MAINTENANCE  ·  ÉCLAIRAGE  ·  VOIRIE', x + 26, y + 196);
  g.font = `500 18px ${FONT2}`; g.fillText('INTERVENTION 24H/24', x + 26, y + 228);
}
function parisVanRear(g, FONT, FONT2, pr) {
  const [x, y, w, h] = R.vanRear;
  g.fillStyle = '#eceae4'; g.fillRect(x, y, w, h);
  const gr = g.createLinearGradient(0, y + h * 0.55, 0, y + h); gr.addColorStop(0, 'rgba(110,92,74,0)'); gr.addColorStop(1, 'rgba(96,80,64,0.65)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  for (let k = 0; k < 70; k++) {
    const sx = x + pr() * w, sy = y + [8, h * 0.33, h * 0.66][(pr() * 3) | 0], len = 20 + Math.pow(pr(), 1.5) * 110, a = 0.05 + pr() * 0.1;
    const lg = g.createLinearGradient(0, sy, 0, sy + len); lg.addColorStop(0, `rgba(70,62,54,${a})`); lg.addColorStop(1, 'rgba(70,62,54,0)');
    g.fillStyle = lg; g.fillRect(sx, sy, 2 + pr() * 4, len);
  }
  g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(x + w / 2 - 1.5, y, 3, h);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
  for (const x0 of [x + 8, x + w / 2 + 8]) { g.strokeRect(x0, y + 10, w / 2 - 16, h - 20); for (const t of [0.33, 0.66]) { g.beginPath(); g.moveTo(x0, y + h * t); g.lineTo(x0 + w / 2 - 16, y + h * t); g.stroke(); } }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#1d3f7a'; g.font = `400 20px ${FONT}`; g.fillText('SEINE SERVICES', x + 18, y + 50);
  // the French blind-spot sticker
  g.fillStyle = '#f2f0ea'; g.fillRect(x + w / 2 + 12, y + 30, 104, 46); g.strokeStyle = '#111'; g.lineWidth = 2; g.strokeRect(x + w / 2 + 12, y + 30, 104, 46);
  g.fillStyle = '#111'; g.font = `600 11px ${FONT2}`; g.fillText('ATTENTION', x + w / 2 + 20, y + 48); g.fillText('ANGLES MORTS', x + w / 2 + 20, y + 66);
  g.fillStyle = '#c41a12'; g.beginPath(); g.moveTo(x + w / 2 + 96, y + 36); g.lineTo(x + w / 2 + 110, y + 62); g.lineTo(x + w / 2 + 82, y + 62); g.fill();
  const tape = (tx, ty, tw, th) => { for (let k = 0; k * 12 < tw; k++) { g.fillStyle = k % 2 ? '#c41a12' : '#f4f2ee'; g.fillRect(tx + k * 12, ty, Math.min(12, tw - k * 12), th); } };
  tape(x + 6, y + h - 26, w - 12, 10);
}
function parisBus(g, FONT, FONT2) {
  let [x, y, w, h] = R.busDest; g.fillStyle = '#050505'; g.fillRect(x, y, w, h);
  g.fillStyle = '#ffb21e'; g.font = `400 40px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('72', x + 16, y + 33);
  g.font = `400 34px ${FONT}`; g.fillText('HÔTEL DE VILLE', x + 80, y + 33);
  g.fillStyle = 'rgba(0,0,0,0.55)'; for (let k = 0; k < w; k += 3) g.fillRect(x + k, y, 1, h); for (let k = 0; k < h; k += 3) g.fillRect(x, y + k, w, 1);
  [x, y, w, h] = R.busSide; g.fillStyle = '#fff'; g.fillRect(x, y, w, h);
  g.fillStyle = '#0f5a6e'; fit(g, 'LIGNES DE SEINE', 84, FONT, 540); g.textAlign = 'left'; g.fillText('LIGNES DE SEINE', x + 24, y + 62);
  [x, y, w, h] = R.busRoute; g.fillStyle = '#050505'; g.fillRect(x, y, w, h); g.fillStyle = '#ffb21e'; g.font = `400 46px ${FONT}`; g.textAlign = 'center'; g.fillText('72', x + w / 2, y + h / 2 + 2);
}
function fit(g, txt, px, font, maxW) { g.font = `400 ${px}px ${font}`; const w = g.measureText(txt).width; if (w > maxW) g.font = `400 ${Math.floor(px * maxW / w)}px ${font}`; }
function sideMap(kind) {
  const S = kind === 'taxi' || kind === 'police' ? SPECS.sedan : SPECS[kind];
  const z0 = S.zMin ?? S.zF, z1 = S.zMax ?? S.zR, row = SIDE_ROW[kind];
  return { S, X: (z) => (z - z0) / (z1 - z0) * AW, Y: (y) => row * 256 + 4 + (1 - Math.min(1, Math.max(0, y / S.H))) * 248, z0, z1, row };
}
function drawSide(g, kind, row, paris = false) {
  const sm2 = sideMap(kind), { S, X, Y } = sm2;
  const top = row * 256, r = makeRng(row * 77 + 5);
  g.save(); g.beginPath(); g.rect(0, top, AW, 256); g.clip();
  g.fillStyle = '#fff'; g.fillRect(0, top, AW, 256);
  const line = (pts, w = 2.5, a = 0.9) => {
    g.strokeStyle = `rgba(0,0,0,${a})`; g.lineWidth = w; g.beginPath(); pts.forEach(([z, y], i) => (i ? g.lineTo(X(z), Y(y)) : g.moveTo(X(z), Y(y)))); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.0)';
  };
  const rock = interp(S.sbKeys || [[0, 0.36]], 0);
  if (paris && kind === 'police') {   // French: all white, blue band + red pinstripe along the flanks
    g.fillStyle = '#1b2f7a'; g.fillRect(0, Y(0.5), AW, Y(0.4) - Y(0.5));
    g.fillStyle = '#b3161a'; g.fillRect(0, Y(0.525), AW, Y(0.505) - Y(0.525));
    g.fillStyle = '#1b2f7a'; g.fillRect(0, Y(0.8), AW, Y(0.785) - Y(0.8));
  } else if (paris && kind === 'van') {
    g.fillStyle = '#1d3f7a'; g.fillRect(X(-1.2), Y(0.9), X(3.4) - X(-1.2), 8);
    for (let z = -0.62; z < 3.4; z += 0.58) { line([[z, 0.72], [z, 3.0]], 1.2, 0.18); g.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = 0.8; y < 3.0; y += 0.09) g.fillRect(X(z) - 4, Y(y), 2, 2); }
    for (let z = -1.15; z < 3.4; z += 0.05) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X(z), Y(3.0), 2, 2); g.fillRect(X(z), Y(0.72), 2, 2); }
  }
  if (paris && (kind === 'police' || kind === 'taxi' || kind === 'van')) { /* French liveries above */ }
  else if (kind === 'police') {   // black fenders/trunk, white doors and roof
    g.fillStyle = '#0b0b0c';
    g.fillRect(0, Y(1.02), X(S.doors[0][0] - 0.01), Y(0) - Y(1.02));
    g.fillRect(X(S.doors[1][1] + 0.01), Y(1.02), AW, Y(0) - Y(1.02));
    g.fillRect(0, Y(0.42), AW, Y(0) - Y(0.42));    // black rockers
    g.fillStyle = '#1b2c55'; g.fillRect(X(S.doors[0][0]), Y(0.47), X(S.doors[1][1]) - X(S.doors[0][0]), 4);
  }
  if (kind === 'taxi' && !paris) {     // checker band along the doors
    const y0 = 0.6, y1 = 0.68, n = 2, cw = (Y(y0) - Y(y1)) / n;
    for (let zz = X(S.doors[0][0] + 0.06), k = 0; zz < X(S.doors[1][1] - 0.06); zz += cw, k++) for (let j = 0; j < n; j++) if ((k + j) % 2 === 0) { g.fillStyle = '#0c0c0c'; g.fillRect(zz, Y(y1) + j * cw, cw, cw); }
  }
  if (kind === 'suv') { g.fillStyle = '#d0d0d0'; g.fillRect(0, Y(1.0), AW, Y(0.6) - Y(1.0)); g.fillStyle = '#fff'; }
  if (kind === 'bus') {
    g.fillStyle = '#0f5a6e'; g.fillRect(0, Y(0.52), AW, Y(0) - Y(0.52));
    g.fillStyle = '#e0a21a'; g.fillRect(0, Y(0.58), AW, Y(0.535) - Y(0.58));
    g.fillStyle = '#0f5a6e'; g.fillRect(0, Y(3.3), AW, Y(2.72) - Y(3.3));
    // body side panel seams
    for (let z = -5.3; z < 5.8; z += 1.32) line([[z, 0.4], [z, 1.12]], 2, 0.5);
    for (let z = -5.3; z < 5.8; z += 1.32) line([[z, 2.5], [z, 2.92]], 2, 0.4);
    line([[-6, 1.13], [6, 1.13]], 2, 0.6);
    // engine louvres at the rear
    for (let k = 0; k < 9; k++) line([[4.6, 0.55 + k * 0.05], [5.6, 0.55 + k * 0.05]], 3, 0.7);
  }
  if (kind === 'van' && !paris) {
    g.fillStyle = '#d2461c'; g.fillRect(X(-1.2), Y(0.95), X(3.4) - X(-1.2), 6);
    g.fillStyle = '#1d2f4f'; g.fillRect(X(-1.2), Y(0.86), X(3.4) - X(-1.2), 10);
    for (let z = -0.62; z < 3.4; z += 0.58) { line([[z, 0.72], [z, 3.0]], 1.2, 0.18); g.fillStyle = 'rgba(0,0,0,0.28)'; for (let y = 0.8; y < 3.0; y += 0.09) g.fillRect(X(z) - 4, Y(y), 2, 2); }
    for (let z = -1.15; z < 3.4; z += 0.05) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X(z), Y(3.0), 2, 2); g.fillRect(X(z), Y(0.72), 2, 2); }
  }
  // grime rising from the sills + speckle
  const gTop = (kind === 'bus' ? 0.9 : kind === 'van' ? 1.0 : rock + 0.42);
  const gr = g.createLinearGradient(0, Y(gTop), 0, Y(0));
  gr.addColorStop(0, 'rgba(120,98,76,0)'); gr.addColorStop(0.55, 'rgba(112,92,72,0.22)'); gr.addColorStop(1, 'rgba(84,70,58,0.6)');
  g.fillStyle = gr; g.fillRect(0, Y(gTop), AW, Y(0) - Y(gTop));
  // soft weathering: arch dirt, road-spray fans behind each wheel, rain streaks running down from the feature lines
  const pxX = AW / ((sm2.z1 - sm2.z0) || 1), pxY = 248 / S.H;
  const blob = (zc, yc, rz, ry, col, a0) => {
    g.save(); g.translate(X(zc), Y(yc)); g.scale(rz * pxX, ry * pxY);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1); rg.addColorStop(0, `rgba(${col},${a0})`); rg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore();
  };
  const axles = kind === 'van' ? [-2.5, 1.95] : (S.axles || []);
  const AR = S.ar || 0.45, WR = S.R || 0.35;
  for (const az of axles) {
    blob(az, WR, AR + 0.32, AR + 0.3, '86,66,48', 0.55);                 // dirt ring around the arch
    blob(az + AR + 0.35, 0.3, 0.75, 0.32, '96,80,62', 0.42);            // spray fan behind the wheel
    blob(az - AR - 0.15, 0.25, 0.35, 0.22, '96,80,62', 0.3);
    blob(az + 0.1, WR + AR + 0.05, 0.4, 0.12, '110,58,30', 0.18);       // faint rust bloom on the arch lip
  }
  const sTop = kind === 'bus' ? [1.12, 2.5] : kind === 'van' ? [3.0] : [interp(S.topKeys || [[0, 0.9]], 0) - 0.04];
  for (let k = 0; k < (kind === 'bus' ? 140 : kind === 'van' ? 90 : 50); k++) {
    const x = r() * AW, y0 = sTop[(r() * sTop.length) | 0] - r() * 0.03, len = (0.15 + Math.pow(r(), 1.6) * (kind === 'van' ? 1.6 : 0.6)), w = 2 + r() * 5;
    const lg = g.createLinearGradient(0, Y(y0), 0, Y(y0 - len)); const a = 0.05 + r() * 0.1;
    lg.addColorStop(0, `rgba(72,64,56,${a})`); lg.addColorStop(0.3, `rgba(72,64,56,${a * 0.8})`); lg.addColorStop(1, 'rgba(72,64,56,0)');
    g.fillStyle = lg; g.fillRect(x, Y(y0), w, Y(y0 - len) - Y(y0));
  }
  if (S.cab && kind !== 'bus') {
    const c = S.cab, d = S.doors;
    // shoulder crease shading + highlight
    for (let z = S.zF + 0.2; z < S.zR - 0.2; z += 0.04) {
      const yT = interp(S.topKeys, z), yb = interp(S.sbKeys, z), ys = yb + (yT - yb) * 0.9;
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(X(z), Y(ys) + 2, X(z + 0.04) - X(z) + 1, 4);
      g.fillStyle = 'rgba(255,255,255,0.0)';
    }
    // door shut lines: front edge follows the A-pillar root, rear edge vertical, bottom edge
    const yb0 = S.doorY, ybelt = (z) => interp(S.topKeys, z);
    for (const [z0, z1] of d) {
      line([[z0 + 0.02, yb0], [z0, ybelt(z0) - 0.02]]);
      line([[z1, yb0], [z1 + 0.02, ybelt(z1) - 0.02]]);
      line([[z0 + 0.02, yb0], [z1, yb0]]);
      // handle recess
      const hz = z1 - 0.2, hy = ybelt(z1) - 0.09;
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(X(hz), Y(hy), X(0.11) - X(0), 5, 0, 0, Math.PI * 2); g.fill();
    }
    // hood line along the fender top, bumper seams, trunk line, fuel door
    const hood = []; for (let z = S.zF + 0.12; z <= c.zA - 0.04; z += 0.05) hood.push([z, interp(S.topKeys, z) - 0.02]);
    line(hood, 2.2, 0.8);
    const fa = S.axles[0], ra = S.axles[S.axles.length - 1];
    line([[fa - S.ar - 0.06, interp(S.sbKeys, fa - S.ar)], [fa - S.ar - 0.1, interp(S.topKeys, fa - S.ar - 0.1) - 0.1]], 2, 0.7);
    if (kind !== 'van') {
      line([[ra + S.ar + 0.08, interp(S.sbKeys, ra + S.ar)], [ra + S.ar + 0.12, interp(S.topKeys, ra + S.ar + 0.12) - 0.12]], 2, 0.7);
      const tr = []; for (let z = c.zC + 0.06; z <= S.zR - 0.06; z += 0.05) tr.push([z, interp(S.topKeys, z) - 0.02]);
      line(tr, 2.2, 0.8);
      const fz = ra - 0.12, fy = interp(S.topKeys, fz) - 0.13;
      g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 2; g.strokeRect(X(fz), Y(fy), X(0.17) - X(0), Y(0) - Y(0.15));
    }
    // side marker + badge
    g.fillStyle = 'rgba(255,120,30,0.95)'; g.fillRect(X(S.zF + 0.25), Y(rock + 0.3), 14, 6);
    g.fillStyle = 'rgba(255,40,30,0.95)'; if (kind !== 'van') g.fillRect(X(S.zR - 0.3), Y(rock + 0.32), 14, 6);
  }
  g.restore();
}

// ---------------------------------------------------------------------- body side surface sampler (for decals)
function sideSurface(S, z, y) {
  const pts = carSection(S, z).filter((p) => p[2] === 's' || p[2] === 's0');
  for (let i = 0; i < pts.length - 1; i++) if (y >= pts[i][1] && y <= pts[i + 1][1]) { const t = (y - pts[i][1]) / ((pts[i + 1][1] - pts[i][1]) || 1); return lerp(pts[i][0], pts[i + 1][0], t); }
  return pts[pts.length - 1][0];
}
// a decal patch conforming to the side of the lower body (s = ±1), readable from outside
function sideDecal(bk, S, s, z0, z1, y0, y1, rect, col, rm = RM.paint, xf = null) {
  const uv = rectUV(rect), nu = 6, nv = 3, P = [], Nn = [];
  const sx = xf || ((z, y) => sideSurface(S, z, y));
  for (let i = 0; i <= nu; i++) {
    P.push([]); Nn.push([]);
    for (let j = 0; j <= nv; j++) {
      const z = lerp(z0, z1, i / nu), y = lerp(y0, y1, j / nv);
      const x = sx(z, y), dxz = (sx(z + 0.02, y) - sx(z - 0.02, y)) / 0.04, dxy = (sx(z, y + 0.02) - sx(z, y - 0.02)) / 0.04;
      const n = new THREE.Vector3(1, -dxy, -dxz).normalize();
      P[i].push([s * (x + 0.006), y, z]); Nn[i].push([s * n.x, n.y, n.z]);
    }
  }
  const U = (i) => (s > 0 ? lerp(uv[2], uv[0], i / nu) : lerp(uv[0], uv[2], i / nu)), V = (j) => lerp(uv[1], uv[3], j / nv);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    bk.tri(P[i][j], P[i + 1][j], P[i + 1][j + 1], Nn[i][j], Nn[i + 1][j], Nn[i + 1][j + 1], [U(i), V(j)], [U(i + 1), V(j)], [U(i + 1), V(j + 1)], col, rm);
    bk.tri(P[i][j], P[i + 1][j + 1], P[i][j + 1], Nn[i][j], Nn[i + 1][j + 1], Nn[i][j + 1], [U(i), V(j)], [U(i + 1), V(j + 1)], [U(i), V(j + 1)], col, rm);
  }
}

// ---------------------------------------------------------------------- car (sedan family, suv, van cab)
function buildCarBody(kind, S, paint, opts, out, rng) {
  const sm = sideMap(kind);
  const uvf = (p, tag) => (tag === 's' || tag === 's0' || tag === 'win' || tag === 'frame' ? [sm.X(p[2]) / AW, 1 - sm.Y(p[1]) / AW] : WHITE_UV);
  const c = S.cab;
  const isSUV = kind === 'suv', isVan = kind === 'van';
  const inDoor = (z, s) => opts.doorOpen && s < 0 && z > S.doors[0][0] && z < S.doors[0][1];
  // lower body
  const st = stationList(S.zF, S.zR, 0.32, [...archStations(S, 7), ...endStations(S.zF, S.zR, S.rr), c.zA, c.zC, ...S.doors.flat(), c.zA + 0.05, c.zC - 0.05, S.zF + 0.16, c.zA - 0.02, c.zC + 0.03, S.zR - 0.14]);
  const ymid = (z) => (Math.min(S.floorY, interp(S.sbKeys, z)) + interp(S.topKeys, z)) / 2;
  loft(st, (z) => carSection(S, z), {
    round: { zF: S.zF, zR: S.zR, rr: S.rr, ymid },
    caps: true, uvf,
    classify: (tag, z, s, y) => {
      if (tag === 't' && z > c.zA && z < c.zC) return null;              // open cabin
      if (tag === 't' && opts.hoodUp && z > S.zF + 0.16 && z < c.zA - 0.02) return 'hood';
      if (tag === 't' && opts.trunkOpen && z > c.zC + 0.03 && z < S.zR - 0.14) return 'trunk';
      if ((tag === 's') && inDoor(z, s) && y > S.doorY) return 'door';
      return 'body';
    },
    color: (tag, z, y, s, cap) => {
      if (tag === 'u') return [C.under, RM.under];
      if (tag === 'w') return [C.well, RM.under];
      if (cap && y < interp(S.sbKeys, z) + 0.12) return [C.trim, RM.plastic];
      if (isSUV && y < S.clad) return [C.trim, RM.plastic];
      if (isVan && y < 0.62) return [C.trim, RM.plastic];
      if (kind === 'police' && !PARIS && (z < S.doors[0][0] || z > S.doors[1][1] || y < 0.42)) return [[0.012, 0.012, 0.014], RM.paint];
      return [paint, RM.paint];
    },
    inner: (tag, z, y) => (z > c.zA + 0.02 && z < c.zC - 0.02 && y > S.inFloor && (tag === 's' || tag === 's0') ? { col: C.interior, rm: RM.plastic, off: 0.045 } : null),
  }, out);
  // greenhouse
  const cst = stationList(c.zA, c.zC, 0.24, [c.zW1, c.zB0, ...(c.B || []), ...(c.C2 || []), c.Cp, ...S.doors.flat(), c.zA + 0.03, c.zA + 0.1, c.zC - 0.03, c.zC - 0.1, c.zB0 + (c.zC - c.zB0) * 0.5]);
  const winGlass = (z) => {
    if (z > c.B[0] && z < c.B[1]) return 'B';
    if (c.C2 && z > c.C2[0] && z < c.C2[1]) return 'B';
    if (z > c.Cp) return 'paint';
    return 'glass';
  };
  loft(cst, (z) => cabSection(S, z), {
    uvf,
    classify: (tag, z, s) => {
      const door = inDoor(z, s) && (tag === 'frame' || tag === 'win' || tag === 'drip');
      let g = 'body';
      if (tag === 'win' && winGlass(z) === 'glass') g = 'glass';
      if (g === 'glass' && tag === 'win' && opts.shatter && s === opts.shatter.s && z > opts.shatter.z0 && z < opts.shatter.z1) return null;   // shattered pane
      if (tag === 'roof' && z < c.zW1) g = 'glassW';
      else if ((tag === 'roofE' || tag === 'roof') && (z < c.zW1 || z > c.zB0)) g = (tag === 'roofE' && z < c.zW1) ? 'body' : 'glass';
      if (door) return g === 'glass' ? 'doorGlass' : 'door';
      return g;
    },
    color: (tag, z) => {
      if (tag === 'frame') return [C.trim, RM.satin];
      if (tag === 'win') return winGlass(z) === 'B' ? [C.black, RM.satin] : [paint, RM.paint];
      if (kind === 'police' && tag !== 'frame') return [C.white, RM.paint];
      return [paint, RM.paint];
    },
    inner: (tag) => (tag === 'frame' ? null : { col: C.headliner, rm: RM.cloth, off: 0.02 }),
  }, out);
}

// ---- abandoned details: hood up (engine bay), trunk open (tub + junk), shattered side window (+ glass on the ground)
function flipCopy(src, dst, col, off) {
  const n0 = src.p.length;
  for (let i = 0; i < n0; i += 9) {
    const P = [0, 1, 2].map((k) => [0, 1, 2].map((j) => src.p[i + k * 3 + j] - src.n[i + k * 3 + j] * off));
    const N = [0, 1, 2].map((k) => [0, 1, 2].map((j) => -src.n[i + k * 3 + j]));
    dst.tri(P[0], P[2], P[1], N[0], N[2], N[1], WHITE_UV, WHITE_UV, WHITE_UV, col, RM.under);
  }
}
const _rot = (y, z, a) => new THREE.Matrix4().makeTranslation(0, y, z).multiply(new THREE.Matrix4().makeRotationX(a)).multiply(new THREE.Matrix4().makeTranslation(0, -y, -z));
function rod(bk, a, b, r, col, rm) {
  const L = a.distanceTo(b), m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0.01));
  m.setPosition(a.clone().add(b).multiplyScalar(0.5));
  pushGeo(bk, CYL(r, r, L, 5).rotateX(Math.PI / 2), m, col, rm);
}
function openHood(out, S) {
  const c = S.cab, zh = c.zA - 0.02, yh = interp(S.topKeys, zh), z0 = S.zF + 0.16, iw = S.hw - 0.11;
  flipCopy(out.hood, out.hood, [0.035, 0.035, 0.035], 0.012);                 // underside (insulation pad)
  const M = _rot(yh, zh, 1.05);
  THIN.append(out.hood, M);
  // engine bay: floor, inner fenders, firewall, engine, radiator, battery, airbox
  const yt = interp(S.topKeys, (z0 + zh) / 2), yf = yt - 0.42, zc = (z0 + zh) / 2, L = zh - z0;
  pushGeo(out.body, BOX(iw * 2, 0.03, L), M4(0, yf, zc), [0.05, 0.05, 0.05], RM.under);
  for (const s of [-1, 1]) pushGeo(out.body, BOX(0.03, yt - yf, L), M4(s * iw, (yt + yf) / 2, zc), [0.08, 0.08, 0.08], RM.under);
  pushGeo(out.body, BOX(iw * 2, yt - yf, 0.03), M4(0, (yt + yf) / 2, zh), [0.06, 0.06, 0.06], RM.under);
  pushGeo(out.body, BOX(iw * 2, yt - yf - 0.05, 0.05), M4(0, (yt + yf) / 2, z0 + 0.04), [0.04, 0.04, 0.045], RM.metal);   // radiator
  pushGeo(out.body, RBOX(0.62, 0.3, 0.55, 0.04), M4(0.02, yf + 0.18, zc + 0.08), [0.2, 0.2, 0.21], RM.metal);             // block
  pushGeo(out.body, RBOX(0.56, 0.08, 0.5, 0.03), M4(0.02, yf + 0.37, zc + 0.08), [0.45, 0.06, 0.04], RM.satin);           // valve cover
  pushGeo(out.body, BOX(0.24, 0.18, 0.16), M4(-iw + 0.18, yf + 0.12, zh - 0.18), [0.03, 0.03, 0.03], RM.plastic);          // battery
  pushGeo(out.body, CYL(0.11, 0.11, 0.2, 8), M4(iw - 0.2, yf + 0.25, z0 + 0.3, 0, 0, Math.PI / 2), [0.05, 0.05, 0.05], RM.plastic);  // airbox
  pushGeo(out.body, CYL(0.07, 0.07, 0.08, 8), M4(-iw + 0.22, yf + 0.3, zh - 0.45), [0.7, 0.62, 0.15], RM.plastic);         // reservoir
  rod(THIN, new THREE.Vector3(-iw + 0.04, yt - 0.02, z0 + 0.5), new THREE.Vector3(-iw + 0.06, yt, z0 + 0.5).applyMatrix4(M), 0.008, [0.6, 0.6, 0.6], RM.chrome);
}
function openTrunk(out, S, rng) {
  const c = S.cab, zh = c.zC + 0.03, yh = interp(S.topKeys, zh), z1 = S.zR - 0.14, iw = S.hw - 0.12;
  flipCopy(out.trunk, out.trunk, [0.07, 0.07, 0.07], 0.01);
  THIN.append(out.trunk, _rot(yh, zh, -1.15));
  const yt = interp(S.topKeys, (zh + z1) / 2), yf = yt - 0.45, zc = (zh + z1) / 2, L = z1 - zh;
  pushGeo(out.body, BOX(iw * 2, 0.03, L), M4(0, yf, zc), [0.06, 0.06, 0.06], RM.cloth);
  for (const s of [-1, 1]) pushGeo(out.body, BOX(0.03, yt - yf, L), M4(s * iw, (yt + yf) / 2, zc), [0.07, 0.07, 0.07], RM.cloth);
  for (const z of [zh, z1]) pushGeo(out.body, BOX(iw * 2, yt - yf, 0.03), M4(0, (yt + yf) / 2, z), [0.07, 0.07, 0.07], RM.cloth);
  // dumped junk: a duffel, a box, a spare
  pushGeo(out.body, RBOX(0.6, 0.25, 0.3, 0.1, 2), M4(-0.3, yf + 0.14, zc - 0.05, 0, 0.3, 0), [0.12, 0.16, 0.1], RM.cloth);
  pushGeo(out.body, BOX(0.4, 0.28, 0.32), M4(0.45, yf + 0.15, zc + 0.08, 0, -0.2, 0), [0.45, 0.33, 0.2], RM.cloth);
  if (rng() < 0.5) pushGeo(out.body, new THREE.TorusGeometry(0.22, 0.08, 5, 12), M4(0.1, yf + 0.06, zc, Math.PI / 2, 0, 0), C.rubber, RM.rubber);
}
function shatterWindow(out, S, sh, rng) {
  const { s, z0, z1 } = sh;
  for (let z = z0 + 0.03; z < z1 - 0.06; z += 0.05 + rng() * 0.05) {   // jagged remnants along the sill and the top
    const za = z, zb = Math.min(z1 - 0.02, z + 0.04 + rng() * 0.06), zm = (za + zb) / 2 + (rng() - 0.5) * 0.03;
    const A = cabSection(S, za), B = cabSection(S, zb), T = cabSection(S, zm);
    const h = Math.pow(rng(), 2) * 0.35 + 0.02;
    const P = (q, z) => [s * q[0], q[1], z];
    const bot = (sec, z) => P(sec[1], z), top = (sec, z) => P(sec[2], z);
    const ap = (sec, z, t) => { const a = bot(sec, z), b = top(sec, z); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z]; };
    const n = [s * 0.95, 0.3, 0];
    out.glass.tri(bot(A, za), bot(B, zb), ap(T, zm, h), n, n, n, WHITE_UV, WHITE_UV, WHITE_UV, C.white, RM.lens);
    if (rng() < 0.4) { const h2 = 0.05 + rng() * 0.15; out.glass.tri(top(A, za), top(B, zb), ap(T, zm, 1 - h2), n, n, n, WHITE_UV, WHITE_UV, WHITE_UV, C.white, RM.lens); }
  }
  // safety-glass crumbs on the ground (glitter) and on the seat
  const up = [0, 1, 0];
  for (let k = 0; k < 70; k++) {
    const x = s * (S.hw + 0.02 + Math.pow(rng(), 1.5) * 0.9), z = z0 - 0.2 + rng() * (z1 - z0 + 0.4), r = 0.012 + rng() * 0.025, a = rng() * 6;
    const nn = [(rng() - 0.5) * 0.5, 1, (rng() - 0.5) * 0.5];
    out.body.tri([x + Math.cos(a) * r, 0.006, z + Math.sin(a) * r], [x + Math.cos(a + 2.2) * r, 0.006, z + Math.sin(a + 2.2) * r], [x + Math.cos(a + 4.1) * r, 0.006, z + Math.sin(a + 4.1) * r], nn, nn, nn, WHITE_UV, WHITE_UV, WHITE_UV, [0.55, 0.62, 0.62], [0.05, 1, 0]);
  }
  void up;
}
// windshield: glass pushed 18 mm into the opening + a black rubber gasket around it (A-pillars, cowl, header)
function windshieldTrim(out, S) {
  const g = out.glassW, c = S.cab;
  for (let i = 0; i < g.p.length; i += 3) for (let k = 0; k < 3; k++) g.p[i + k] -= g.n[i + k] * 0.018;
  out.glass.append(g, new THREE.Matrix4());
  const edge = (z, s) => { const p = cabSection(S, z)[4]; return new THREE.Vector3(s * p[0], p[1], z); };
  const loop = [];
  const zs = []; for (let k = 0; k <= 6; k++) zs.push(lerp(c.zA + 0.005, c.zW1, k / 6));
  for (const z of zs) loop.push(edge(z, -1));
  for (const z of zs.slice().reverse()) loop.push(edge(z, 1));
  loop.push(loop[0].clone());
  const up = new THREE.Vector3(0, 1, -0.9).normalize();
  for (let i = 0; i < loop.length - 1; i++) {
    const a = loop[i], b = loop[i + 1], L = a.distanceTo(b); if (L < 1e-3) continue;
    const m = new THREE.Matrix4().lookAt(a, b, up); m.setPosition(a.clone().add(b).multiplyScalar(0.5).addScaledVector(up, 0.004));
    pushGeo(out.body, BOX(S.H > 3 ? 0.075 : 0.045, S.H > 3 ? 0.02 : 0.014, L + 0.02), m, C.rubber, RM.rubber);
  }
}
// interior: floor, dash, seats, wheel, console, parcel shelf
function interior(bk, S, kind, rng, { rows = 2, wide = false } = {}) {
  const c = S.cab, iw = S.hw - 0.1, fy = S.inFloor, belt = interp(S.topKeys, c.zA);
  const zA = c.zA, zC = c.zC;
  pushGeo(bk, BOX(iw * 2, 0.04, zC - zA), M4(0, fy - 0.02, (zA + zC) / 2), [0.06, 0.058, 0.055], RM.cloth);
  // dash: rounded block + cluster hood + gauges
  const dz0 = zA - 0.02, dz1 = zA + (isTall(kind) ? 0.55 : 0.48), dTop = belt - 0.035;
  pushGeo(bk, BOX(iw * 2, dTop - fy - 0.1, dz1 - dz0), M4(0, (dTop + fy + 0.1) / 2, (dz0 + dz1) / 2), [0.07, 0.068, 0.066], RM.plastic);
  pushGeo(bk, BOX(0.42, 0.08, 0.2), M4(-0.38, dTop + 0.02, dz1 - 0.12), [0.05, 0.05, 0.05], RM.plastic);
  quad(bk, [-0.38, dTop - 0.03, dz1 + 0.002], [1, 0, 0], [0, 1, 0], 0.34, 0.11, R.dash, C.white, [0.4, 0, 0.6]);
  pushGeo(bk, BOX(0.22, 0.32, 0.5), M4(0, fy + 0.16, dz1 + 0.15), [0.06, 0.06, 0.06], RM.plastic);   // console
  // steering wheel (driver = -x)
  const sw = M4(-0.38, dTop - 0.03, dz1 + 0.1, -1.05 + (isTall(kind) ? 0.35 : 0), 0, 0);
  pushGeo(bk, new THREE.TorusGeometry(0.185, 0.018, 3, 10), sw, [0.04, 0.04, 0.04], RM.satin);
  for (const a of [0, 2.1]) pushGeo(bk, BOX(0.03, 0.17, 0.02), sw.clone().multiply(M4(Math.sin(a) * 0.08, Math.cos(a) * -0.08, 0, 0, 0, a)), [0.05, 0.05, 0.05], RM.satin);
  pushGeo(bk, CYL(0.05, 0.06, 0.06, 6), sw.clone().multiply(M4(0, 0, 0.0, Math.PI / 2, 0, 0)), [0.05, 0.05, 0.05], RM.satin);
  pushGeo(bk, CYL(0.03, 0.03, 0.3, 4), sw.clone().multiply(M4(0, 0, -0.15, Math.PI / 2, 0, 0)), [0.05, 0.05, 0.05], RM.satin);
  // seats
  const sc = kind === 'police' ? [0.06, 0.06, 0.065] : (kind === 'taxi' ? [0.08, 0.07, 0.06] : C.seat);
  const seat = (x, z, w, recline = 0.22) => {
    pushGeo(bk, BOX(w, 0.14, 0.5), M4(x, fy + 0.2, z), sc, RM.cloth, R.seat);
    pushGeo(bk, BOX(w, 0.62, 0.13), M4(x, fy + 0.52, z + 0.28, -recline, 0, 0), sc, RM.cloth, R.seat);
    if (w < 0.7) pushGeo(bk, BOX(w * 0.5, 0.17, 0.09), M4(x, fy + 0.93, z + 0.37, -recline, 0, 0), sc, RM.cloth, R.seat);
  };
  const fz = dz1 + 0.55 + rng() * 0.08;
  if (kind !== 'van' || true) { seat(-0.38, fz, 0.5, 0.2 + rng() * 0.12); seat(0.38, fz, 0.5, 0.2 + rng() * 0.12); }
  if (rows > 1) { const rz = Math.min(zC - 0.42, fz + 0.95); seat(0, rz, iw * 2 - 0.12, 0.3); if (kind === 'suv') seat(0, rz + 0.85, iw * 2 - 0.12, 0.15); }
  if (kind === 'taxi') {   // partition + meter
    if (!PARIS) pushGeo(bk, BOX(iw * 2 - 0.1, 0.4, 0.02), M4(0, belt + 0.18, fz + 0.4), [0.3, 0.32, 0.33], [0.1, 0.6, 0]);
    pushGeo(bk, BOX(0.16, 0.06, 0.08), M4(0.05, dTop + 0.03, dz1 - 0.04), [0.6, 0.06, 0.04], [0.3, 0, 0.8]);
  }
  if (kind === 'police') {
    pushGeo(bk, BOX(0.3, 0.22, 0.25), M4(0.12, belt - 0.05, dz1 + 0.2, -0.3, 0, 0), [0.03, 0.03, 0.03], RM.satin);       // laptop dock
    pushGeo(bk, BOX(iw * 2 - 0.1, 0.5, 0.03), M4(0, belt + 0.14, fz + 0.42), [0.05, 0.05, 0.05], [0.4, 0.5, 0]);        // cage
  }
  // parcel shelf / rear bulkhead
  if (kind === 'sedan' || kind === 'taxi' || kind === 'police') pushGeo(bk, BOX(iw * 2, 0.04, 0.42), M4(0, interp(S.topKeys, zC) - 0.05, zC - 0.2), [0.05, 0.05, 0.05], RM.cloth);
  // a little junk on the dash
  if (rng() < 0.6) pushGeo(bk, BOX(0.2, 0.005, 0.28), M4(0.3, dTop + 0.005, dz0 + 0.18, 0, rng(), 0), [0.8, 0.78, 0.7], RM.cloth);
}
const isTall = (k) => k === 'suv' || k === 'van';

// front + rear dressing for the car family
function dressCar(bk, S, kind, paint, opts, rng, lights) {
  const c = S.cab, zF = S.zF, zR = S.zR, hw = S.hw;
  const yF0 = interp(S.topKeys, zF + 0.02), yb = interp(S.sbKeys, zF);
  const tall = isTall(kind);
  // ---------- front: headlights, grille, valance, plate
  const hy = (kind === 'van' ? yF0 - 0.06 : tall ? yF0 - 0.02 : yF0 + 0.035), hx = hw - (tall ? 0.24 : 0.27);
  for (const s of [-1, 1]) {
    const m = M4(s * hx, hy, zF + 0.055, 0, s * 0.22, 0);
    pushGeo(bk, RBOX(0.36, kind === 'van' ? 0.22 : tall ? 0.15 : 0.12, 0.12, 0.03, 1), m, kind === 'van' ? C.chrome : C.trim, kind === 'van' ? RM.chrome : RM.satin);   // housing
    pushGeo(bk, RBOX(0.3, kind === 'van' ? 0.17 : tall ? 0.1 : 0.08, 0.03, 0.012, 1), m.clone().multiply(M4(0, 0, -0.06)), C.white, RM.chrome, R.reflector);   // reflector
    pushGeo(bk, CYL(0.035, 0.035, 0.02, 12), m.clone().multiply(M4(-s * 0.06, 0, -0.07, Math.PI / 2, 0, 0)), [1.2, 1.15, 1.05], [0.05, 0, 0.5]);   // projector
    pushGeo(bk, BOX(0.28, 0.014, 0.012), m.clone().multiply(M4(s * 0.01, -0.045, -0.066)), [1.2, 1.18, 1.1], [0.1, 0, 1.4]);                       // DRL strip
    lights.push({ p: [s * hx, hy, zF - 0.02], kind: 'head' });
    // fog light + amber corner
    pushGeo(bk, CYL(0.045, 0.045, 0.03, 10), M4(s * (hw - 0.3), yb + 0.1, zF + 0.04, Math.PI / 2, 0, 0), [0.9, 0.9, 0.85], [0.1, 0.4, 0.15]);
    pushGeo(bk, BOX(0.05, 0.04, 0.2), M4(s * (hw - 0.03), hy - 0.07, zF + 0.32, 0, 0, 0), [1, 0.4, 0.05], [0.15, 0, 0.3]);
  }
  const gw = hx * 2 - 0.42;
  if (kind === 'van') {
    const gy0 = yb + 0.2, gy1 = yF0 + 0.02, gm = (gy0 + gy1) / 2, gh = gy1 - gy0;
    pushGeo(bk, RBOX(gw + 0.12, gh + 0.06, 0.07, 0.03), M4(0, gm, zF + 0.03), C.chrome, RM.chrome);        // surround
    pushGeo(bk, BOX(gw, gh - 0.04, 0.01), M4(0, gm, zF - 0.008), C.white, RM.satin, R.grille);
    for (let k = 1; k < 3; k++) pushGeo(bk, BOX(gw, 0.02, 0.03), M4(0, gy0 + gh * k / 3, zF - 0.012), C.chrome, RM.chrome);
    pushGeo(bk, CYL(0.06, 0.06, 0.02, 12), M4(0, gm, zF - 0.03, Math.PI / 2, 0, 0), C.chrome, RM.chrome);  // badge
    pushGeo(bk, RBOX(hw * 2 + 0.06, 0.22, 0.18, 0.03), M4(0, yb + 0.06, zF - 0.02), [0.16, 0.16, 0.17], RM.metal);   // steel bumper
    pushGeo(bk, BOX(hw * 2 - 0.2, 0.03, 0.02), M4(0, yb + 0.13, zF - 0.115), [0.05, 0.05, 0.05], RM.rubber);
  } else if (kind === 'suv' || kind === 'police') {
    pushGeo(bk, RBOX(gw + 0.08, 0.25, 0.06, 0.02), M4(0, hy - 0.05, zF + 0.02), kind === 'suv' ? C.black : [0.06, 0.06, 0.06], RM.satin);
    pushGeo(bk, BOX(gw, 0.2, 0.01), M4(0, hy - 0.05, zF - 0.012), C.white, RM.satin, R.grille);
  } else {
    pushGeo(bk, RBOX(gw + 0.04, 0.12, 0.05, 0.02), M4(0, hy - 0.01, zF + 0.025), C.chrome, RM.chrome);
    pushGeo(bk, BOX(gw, 0.09, 0.01), M4(0, hy - 0.01, zF - 0.003), C.white, RM.satin, R.grille);
  }
  // lower intake + valance lip
  if (kind !== 'van') {
    pushGeo(bk, BOX(hw * 1.3, 0.1, 0.01), M4(0, yb + 0.14, zF - 0.004), C.white, RM.satin, R.grille);
    pushGeo(bk, RBOX(hw * 1.75, 0.05, 0.12, 0.02), M4(0, yb + 0.02, zF + 0.06), C.trim, RM.plastic);
  }
  const plate = PARIS ? R.platesFR[((rng() * 8) | 0) & 3] : R.plates[(rng() * 8) | 0];
  if (PARIS) quad(bk, [0, yb + (kind === 'van' ? 0.06 : 0.155), zF - (kind === 'van' ? 0.115 : 0.012)], [-1, 0, 0], [0, 1, 0], 0.52, 0.11, plate, C.white, RM.satin);
  else quad(bk, [0, yb + (kind === 'van' ? 0.06 : 0.155), zF - (kind === 'van' ? 0.115 : 0.012)], [-1, 0, 0], [0, 1, 0], 0.32, 0.155, plate, C.white, RM.satin);
  // ---------- rear: tail lamps, plate, bumper, exhaust
  const yR0 = interp(S.topKeys, zR - 0.05), rb = interp(S.sbKeys, zR);
  const ty = tall ? yR0 + 0.25 : yR0 - 0.09, tx = hw - 0.2;
  for (const s of [-1, 1]) {
    if (tall) {
      pushGeo(bk, RBOX(0.1, 0.5, 0.08, 0.02, 1), M4(s * (hw - 0.07), ty, zR - 0.02), [0.55, 0.02, 0.015], [0.08, 0.2, 0.45]);
      lights.push({ p: [s * (hw - 0.07), ty, zR + 0.03], kind: 'tail' });
    } else {
      pushGeo(bk, RBOX(0.42, 0.13, 0.08, 0.025, 1), M4(s * tx, ty, zR - 0.03, 0, -s * 0.12, 0), [0.55, 0.02, 0.015], [0.08, 0.2, 0.45]);
      pushGeo(bk, BOX(0.12, 0.05, 0.02), M4(s * (tx - 0.12), ty - 0.02, zR + 0.012), [0.9, 0.9, 0.9], [0.08, 0.2, 0.1]);   // reverse lamp
      lights.push({ p: [s * tx, ty, zR + 0.03], kind: 'tail' });
    }
  }
  if (PARIS) quad(bk, [0, tall ? yR0 - 0.05 : yR0 - 0.25, zR + 0.012], [1, 0, 0], [0, 1, 0], 0.52, 0.11, plate, C.white, RM.satin);
  else quad(bk, [0, tall ? yR0 - 0.05 : yR0 - 0.25, zR + 0.012], [1, 0, 0], [0, 1, 0], 0.32, 0.155, plate, C.white, RM.satin);
  pushGeo(bk, RBOX(hw * 1.8, 0.06, 0.12, 0.02), M4(0, rb + 0.03, zR - 0.04), C.trim, RM.plastic);
  pushGeo(bk, CYL(0.035, 0.04, 0.2, 10), M4(hw * 0.55, rb + 0.02, zR - 0.02, Math.PI / 2, 0, 0), [0.6, 0.6, 0.6], RM.chrome);
  // ---------- sides: mirrors, handles, rub strip, wipers, antenna
  const belt = interp(S.topKeys, c.zA + 0.15);
  for (const s of [-1, 1]) {
    const mz = c.zA + 0.16, mx = s * (hwAt(S, mz) + 0.06);
    if (kind === 'van') {
      const ax = s * (hwAt(S, mz) + 0.28);
      for (const yy of [belt + 0.08, belt + 0.5]) pushGeo(THIN, CYL(0.014, 0.014, 0.3, 6), M4(s * (hwAt(S, mz) + 0.14), yy, mz + 0.04, 0, 0, Math.PI / 2), C.black, RM.satin);
      pushGeo(THIN, RBOX(0.1, 0.4, 0.06, 0.02), M4(ax, belt + 0.3, mz + 0.04), C.black, RM.satin);
      pushGeo(THIN, BOX(0.085, 0.36, 0.01), M4(ax, belt + 0.3, mz + 0.075), [0.5, 0.52, 0.55], [0.05, 1, 0]);
    } else {
    pushGeo(THIN, BOX(0.12, 0.05, 0.08), M4(mx - s * 0.05, belt + 0.04, mz), C.trim, RM.plastic);
    pushGeo(THIN, RBOX(0.2, 0.13, 0.1, 0.04, 2), M4(mx + s * 0.05, belt + 0.1, mz + 0.01, 0, -s * 0.15, 0), kind === 'taxi' || kind === 'sedan' ? paint : C.black, RM.paint);
    pushGeo(THIN, BOX(0.17, 0.1, 0.01), M4(mx + s * 0.05, belt + 0.1, mz + 0.065, 0, -s * 0.15, 0), [0.5, 0.52, 0.55], [0.05, 1, 0]);   // mirror glass
    }
    for (const [z0, z1] of S.doors) {
      const hz = z1 - 0.2, hyy = interp(S.topKeys, hz) - 0.09;
      if (opts.doorOpen && s < 0 && z0 === S.doors[0][0]) continue;   // handle travels with the open door (added below)
      pushGeo(bk, RBOX(0.03, 0.035, 0.2, 0.012, 1), M4(s * (sideSurface(S, hz, hyy) + 0.012), hyy, hz), kind === 'suv' ? C.black : C.chrome, kind === 'suv' ? RM.satin : RM.chrome);
    }
    // belt chrome / black strip
    const zz0 = c.zA + 0.05, zz1 = c.Cp;
    for (let z = zz0; z < zz1 - 0.01; z += 0.25) {
      const z2 = Math.min(zz1, z + 0.25), zm = (z + z2) / 2;
      if (opts.doorOpen && s < 0 && zm > S.doors[0][0] && zm < S.doors[0][1]) continue;
      pushGeo(bk, BOX(0.02, 0.022, z2 - z + 0.002), M4(s * (hwAt(S, zm) - 0.07), interp(S.topKeys, zm) + 0.005, zm), kind === 'police' || kind === 'suv' ? C.black : C.chrome, RM.chrome);
    }
  }
  // wipers (parked at the windshield base)
  const yA = interp(S.topKeys, c.zA), slope = Math.atan2(roofY(S, c.zA + 0.12) - yA, 0.12);
  const wy = yA + 0.04 + Math.sin(slope) * 0.06, wz = c.zA + 0.03 + Math.cos(slope) * 0.06, wl = kind === 'van' ? 0.72 : 0.62;
  for (const x of [-0.44, 0.2]) {
    pushGeo(bk, BOX(wl, kind === 'van' ? 0.025 : 0.014, kind === 'van' ? 0.045 : 0.03), M4(x, wy, wz, -slope, 0, 0.04), C.black, RM.satin);
    pushGeo(bk, BOX(0.022, 0.012, 0.012), M4(x + wl * 0.42, wy - 0.012, wz - 0.012, 0, 0, 0.9), C.black, RM.satin);         // arm
    pushGeo(bk, CYL(0.018, 0.018, 0.03, 6), M4(x + wl * 0.5, yA + 0.02, c.zA - 0.01), C.black, RM.satin);                     // pivot
  }
  pushGeo(bk, BOX(hw * 1.6, 0.02, 0.1), M4(0, wy - 0.02, c.zA - 0.03, -0.4, 0, 0), C.trim, RM.plastic);   // cowl
  pushGeo(THIN, CYL(0.003, 0.004, 0.7, 4), M4(0.4, roofY(S, (c.zW1 + c.zB0) / 2) + 0.35, c.zB0 - 0.05, -0.15, 0, 0), C.black, RM.satin);
}

// the open front-left door: card, handle (the skin is routed by the loft); hinge rotation
function finishDoor(out, S, kind, paint) {
  const [z0, z1] = S.doors[0];
  const hz = z1 - 0.2, hyy = interp(S.topKeys, hz) - 0.09;
  pushGeo(out.door, RBOX(0.03, 0.035, 0.2, 0.012, 1), M4(-(sideSurface(S, hz, hyy) + 0.012), hyy, hz), kind === 'suv' ? C.black : C.chrome, RM.chrome);
  // door card: armrest + pocket, seen when swung open
  const xi = -(S.hw - 0.12), yb = S.doorY, yt = interp(S.topKeys, (z0 + z1) / 2) - 0.02;
  pushGeo(out.door, BOX(0.03, yt - yb, z1 - z0 - 0.06), M4(xi, (yb + yt) / 2, (z0 + z1) / 2), C.interior, RM.plastic);
  pushGeo(out.door, RBOX(0.07, 0.05, 0.4, 0.02, 1), M4(xi + 0.04, yt - 0.25, (z0 + z1) / 2 + 0.05), [0.13, 0.12, 0.11], RM.cloth);
  pushGeo(out.door, BOX(0.02, 0.08, 0.06), M4(xi + 0.02, yt - 0.1, z0 + 0.2), C.chrome, RM.chrome);
  const hinge = new THREE.Vector3(-hwAt(S, z0) + 0.02, 0, z0);
  const m = new THREE.Matrix4().makeTranslation(hinge.x, 0, hinge.z).multiply(new THREE.Matrix4().makeRotationY(-0.96)).multiply(new THREE.Matrix4().makeTranslation(-hinge.x, 0, -hinge.z));
  out.body.append(out.door, m); out.glass.append(out.doorGlass, m);
  // dark jamb behind the opening
  pushGeo(out.body, BOX(0.02, yt - yb, 0.06), M4(-(S.hw - 0.1), (yb + yt) / 2, z1 - 0.02), C.trim, RM.plastic);
}

// ---------------------------------------------------------------------- box van rear body
function vanBox(out, paint, rng) {
  const zb0 = -1.22, zb1 = 3.42, hw = 1.15, y0 = 0.66, y1 = 3.05, ax = 1.95, R0 = 0.4, ar = 0.47;
  const S = { zF: zb0, zR: zb1, axles: [ax], R: R0, ar };
  const sm = sideMap('van');
  const uvf = (p) => [sm.X(p[2]) / AW, 1 - sm.Y(p[1]) / AW];
  const sec = (z) => {
    const ySB = Math.max(y0, archY(S, z)), wi = hw - 0.3;
    return [[0, y0 - 0.02, 'u'], [wi, y0 - 0.02, 'X'], [wi, y0 - 0.02, 'w'], [wi, ySB, 'X'], [wi, ySB, 'w'], [hw - 0.04, ySB, 'X'], [hw - 0.04, ySB, 's'], [hw, Math.max(ySB, y0 + 0.04), 's'], [hw, Math.max(ySB, 0.95), 's'], [hw, y1 - 0.06, 's'], [hw - 0.03, y1 - 0.015, 't'], [hw - 0.08, y1, 't'], [0, y1 + 0.01, 'end']];
  };
  const st = stationList(zb0, zb1, 0.5, [...archStations(S, 10), zb0 + 0.02, zb0 + 0.06, zb1 - 0.02, zb1 - 0.06]);
  loft(st, sec, { round: { zF: zb0, zR: zb1, rr: [0.05, 0.05], ymid: () => (y0 + y1) / 2 }, caps: true, uvf,
    classify: () => 'body', color: (tag) => (tag === 'u' ? [C.under, RM.under] : tag === 'w' ? [C.well, RM.under] : [paint, [0.45, 0.15, 0]]) }, out);
  // logo both sides
  for (const s of [-1, 1]) sideDecal(out.body, null, s, -0.85, 3.0, 1.15, 2.85, R.vanLogo, paint, [0.4, 0.2, 0], () => hw);
  // ---- box sides: alu rub rails top / bottom, corner posts, side marker lamps
  const alu = [0.72, 0.73, 0.74], aluRm = [0.32, 0.9, 0];
  for (const s of [-1, 1]) {
    for (const [yy, hh] of [[y1 - 0.05, 0.1], [y0 + 0.13, 0.16]]) pushGeo(out.body, BOX(0.03, hh, zb1 - zb0 + 0.02), M4(s * (hw + 0.012), yy, (zb0 + zb1) / 2), alu, aluRm);
    for (const zz of [zb0 + 0.03, zb1 - 0.03]) pushGeo(out.body, BOX(0.05, y1 - y0, 0.07), M4(s * (hw + 0.008), (y0 + y1) / 2, zz), alu, aluRm);
    for (const zz of [zb0 + 0.6, (zb0 + zb1) / 2, zb1 - 0.4]) pushGeo(out.body, BOX(0.03, 0.05, 0.1), M4(s * (hw + 0.02), y0 + 0.13, zz), [1, 0.4, 0.05], [0.1, 0, 0.5]);
  }
  // ---- rear: door frame, twin swing doors (textured), hinges, lock bars, handles, light bar, bumper step
  const zr = zb1 + 0.012, dw = hw - 0.09, dy0 = y0 + 0.08, dy1 = y1 - 0.14;
  pushGeo(out.body, BOX(hw * 2 + 0.04, 0.16, 0.08), M4(0, y1 - 0.06, zb1 + 0.02), alu, aluRm);                 // header
  pushGeo(out.body, BOX(hw * 2 + 0.04, 0.12, 0.1), M4(0, y0 + 0.02, zb1 + 0.03), alu, aluRm);                  // sill
  for (const s of [-1, 1]) pushGeo(out.body, BOX(0.09, y1 - y0, 0.08), M4(s * (hw - 0.025), (y0 + y1) / 2, zb1 + 0.02), alu, aluRm);   // posts
  quad(out.body, [0, (dy0 + dy1) / 2, zr + 0.03], [1, 0, 0], [0, 1, 0], dw * 2, dy1 - dy0, R.vanRear, C.white, [0.45, 0.15, 0]);
  for (const s of [-1, 1]) {
    const xo = s * (hw - 0.07);
    for (const yy of [dy0 + 0.25, (dy0 + dy1) / 2, dy1 - 0.25]) {                                                         // 3 hinges per door
      pushGeo(out.body, BOX(0.16, 0.09, 0.03), M4(xo - s * 0.06, yy, zr + 0.05), [0.5, 0.5, 0.5], RM.metal);
      pushGeo(out.body, CYL(0.018, 0.018, 0.11, 6), M4(xo + s * 0.02, yy, zr + 0.06), [0.5, 0.5, 0.5], RM.metal);
    }
    for (const xb of [s * 0.3, s * 0.82]) {                                                                              // cam lock bars
      pushGeo(out.body, CYL(0.016, 0.016, dy1 - dy0 + 0.12, 6), M4(xb, (dy0 + dy1) / 2, zr + 0.07), [0.62, 0.63, 0.64], RM.chrome);
      for (const yy of [dy0 - 0.02, dy1 + 0.02]) pushGeo(out.body, BOX(0.07, 0.07, 0.05), M4(xb, yy, zr + 0.06), [0.4, 0.4, 0.4], RM.metal);
      for (const yy of [dy0 + 0.6, dy0 + 0.75]) pushGeo(out.body, BOX(0.05, 0.03, 0.04), M4(xb, yy, zr + 0.07), [0.4, 0.4, 0.4], RM.metal);
      pushGeo(out.body, BOX(0.04, 0.26, 0.035), M4(xb + s * 0.06, dy0 + 0.68, zr + 0.1, 0, 0, s * 0.12), [0.25, 0.25, 0.26], RM.metal);   // handle
    }
    // tail light bar (stop / turn / reverse) on the lower post + reflectors
    pushGeo(out.body, RBOX(0.1, 0.42, 0.06, 0.02), M4(s * (hw - 0.03), 0.98, zb1 + 0.07), [0.55, 0.02, 0.015], [0.08, 0.2, 0.45]);
    pushGeo(out.body, BOX(0.08, 0.1, 0.02), M4(s * (hw - 0.03), 1.25, zb1 + 0.09), [1, 0.4, 0.05], [0.1, 0, 0.4]);
    pushGeo(out.body, BOX(0.08, 0.08, 0.02), M4(s * (hw - 0.03), 0.72, zb1 + 0.09), [0.9, 0.9, 0.9], [0.1, 0, 0.1]);
  }
  for (let k = -1; k <= 1; k++) pushGeo(out.body, BOX(0.09, 0.05, 0.03), M4(k * 0.16, y1 - 0.06, zb1 + 0.07), [0.6, 0.03, 0.02], [0.1, 0.1, 0.5]);   // ID lamps
  // bumper with a diamond-plate step + under-ride guard
  pushGeo(out.body, BOX(hw * 2, 0.12, 0.3), M4(0, 0.48, zb1 + 0.12), C.trim, RM.metal);
  pushGeo(out.body, BOX(1.0, 0.02, 0.28), M4(0, 0.55, zb1 + 0.12), C.white, [0.4, 0.8, 0], R.grille);
  for (const s of [-1, 1]) pushGeo(out.body, BOX(0.08, 0.3, 0.08), M4(s * 0.6, 0.62, zb1 + 0.06), C.trim, RM.metal);
  quad(out.body, [0, 0.48, zb1 + 0.272], [1, 0, 0], [0, 1, 0], hw * 1.9, 0.08, R.chevron, C.white, [0.3, 0, 0.15]);
  for (const s of [-1, 1]) {
    pushGeo(out.body, BOX(0.12, 0.5, 0.12), M4(s * 0.55, 0.5, (zb0 + ax - 0.6) / 2 + 0.4), C.under, RM.under);
    pushGeo(out.body, BOX(0.12, 0.18, zb1 - zb0 + 1.6), M4(s * 0.5, 0.52, (zb0 + zb1) / 2 - 0.8), C.under, RM.under);
    pushGeo(out.body, RBOX(0.3, 0.36, 0.02, 0.02), M4(s * 0.75, 0.62, ax + 0.48), C.black, RM.rubber);   // mud flaps
  }
  if (PARIS) quad(out.body, [0, 0.48, zb1 + 0.273], [1, 0, 0], [0, 1, 0], 0.52, 0.11, R.platesFR[((rng() * 8) | 0) & 3], C.white, RM.satin);
  else quad(out.body, [0, 0.48, zb1 + 0.273], [1, 0, 0], [0, 1, 0], 0.32, 0.155, R.plates[(rng() * 8) | 0], C.white, RM.satin);
  return [{ p: [-(hw - 0.03), 0.98, zb1 + 0.11], kind: 'tail' }, { p: [hw - 0.03, 0.98, zb1 + 0.11], kind: 'tail' }];
}

// ---------------------------------------------------------------------- bus
function buildBus(out, rng, lights) {
  const S = SPECS.bus, hw = S.hw, zF = S.zF, zR = S.zR;
  const sm = sideMap('bus');
  const uvf = (p) => [sm.X(p[2]) / AW, 1 - sm.Y(p[1]) / AW];
  const sbKeys = [[zF, 0.34], [zF + 1.2, 0.36], [zR - 2, 0.38], [zR, 0.42]];
  const door = [-5.55, -4.4], door2 = [0.25, 1.4];
  const sec = (z) => {
    const yb = interp(sbKeys, z), ySB = Math.max(yb, archY(S, z)), wi = hw - S.wellIn, yF = Math.min(S.floorY, yb);
    const pts = [[0, yF, 'u'], [wi, yF, 'X'], [wi, yF, 'w'], [wi, ySB, 'X'], [wi, ySB, 'w'], [hw - 0.05, ySB, 'X']];
    const sides = [[-0.04, yb, 's'], [0, yb + 0.12, 's'], [0, 0.62, 's'], [0, 1.1, 'sd'], [-0.012, 1.15, 'f'], [-0.02, 1.2, 'win'], [-0.07, 2.44, 'f'], [-0.08, 2.52, 'r'], [-0.09, 2.86, 'r'], [-0.18, 3.0, 'r'], [-0.42, 3.06, 'r']];
    let yp = ySB;
    for (const [dx, y, t] of sides) { const yy = Math.max(y, ySB, yp); yp = yy; pts.push([hw + dx, yy, t]); }
    pts.push([0, 3.085, 'end']);
    return pts;
  };
  const bays = [];
  for (let z = -4.25; z < 4.6; z += 1.42) bays.push(z);
  const extras = [...archStations(S, 8), ...endStations(zF, zR, S.rr), ...door, ...door2];
  for (const z of bays) extras.push(z - 0.06, z + 0.06);
  const st = stationList(zF, zR, 0.8, extras);
  const isPillar = (z) => bays.some((b) => Math.abs(z - b) < 0.06) || z < -4.3 && z > door[1] || z > 4.55;
  const inDoor = (z, s) => s > 0 && ((z > door[0] && z < door[1]) || (z > door2[0] && z < door2[1]));
  loft(st, sec, {
    round: { zF, zR, rr: S.rr, ymid: () => 1.7 }, caps: true, uvf,
    classify: (tag, z, s, y) => {
      if (inDoor(z, s) && y > 0.42 && y < 2.44 && (tag === 'win' || tag === 'sd' || tag === 's' || tag === 'f')) {
        const zz = z > door2[0] ? door2 : door, mid = (zz[0] + zz[1]) / 2;
        return Math.abs(z - mid) < 0.035 || z - zz[0] < 0.04 || zz[1] - z < 0.04 || (y > 1.12 && y < 1.2) ? 'body' : 'glass';
      }
      if (tag === 'win') return isPillar(z) ? 'body' : 'glass';
      return 'body';
    },
    color: (tag, z, y, s) => {
      if (tag === 'u') return [C.under, RM.under];
      if (tag === 'w') return [C.well, RM.under];
      if (tag === 'f' || tag === 'win' || inDoor(z, s)) return [C.black, RM.satin];
      return [[0.95, 0.95, 0.93], RM.paint];
    },
    inner: (tag, z, y) => (y > 0.7 && y < 2.9 && tag !== 'u' && tag !== 'w' ? { col: [0.36, 0.37, 0.38], rm: RM.plastic, off: 0.05 } : null),
  }, out);
  // windshield, destination sign, front face
  const gz = zF - 0.008;
  const ws = new THREE.PlaneGeometry(2.3, 1.42); ws.rotateY(Math.PI);
  pushGeo(out.glass, ws, M4(0, 1.82, gz + 0.02, 0.06, 0, 0), C.white, RM.lens);
  pushGeo(out.body, BOX(2.42, 0.1, 0.02), M4(0, 1.06, gz + 0.01), C.black, RM.satin);
  pushGeo(out.body, BOX(2.3, 0.36, 0.04), M4(0, 2.74, gz + 0.02), C.black, RM.satin);
  const ds = new THREE.PlaneGeometry(2.0, 0.25); ds.rotateY(Math.PI);
  pushGeo(out.body, ds, M4(0, 2.74, gz - 0.002), [1, 1, 1], RM.sign, R.busDest);
  // side destination + route number
  pushGeo(out.body, BOX(0.012, 0.22, 0.62), M4(hw - 0.06, 2.3, -3.9), C.black, RM.satin);
  const sr = new THREE.PlaneGeometry(0.62, 0.2); sr.rotateY(Math.PI / 2);
  pushGeo(out.body, sr, M4(hw - 0.053, 2.3, -3.9), C.white, RM.sign, R.busRoute);
  // bumper, headlights, plate, mirrors on stalks, wipers
  pushGeo(out.body, RBOX(2.52, 0.34, 0.2, 0.06), M4(0, 0.5, zF + 0.02), C.trim, RM.plastic);
  for (const s of [-1, 1]) {
    pushGeo(out.body, RBOX(0.36, 0.16, 0.06, 0.03), M4(s * 0.9, 0.85, zF - 0.005), C.trim, RM.satin);
    for (const dx of [-0.08, 0.08]) pushGeo(out.body, CYL(0.055, 0.055, 0.03, 12), M4(s * 0.9 + dx, 0.85, zF - 0.03, Math.PI / 2, 0, 0), [1.2, 1.15, 1.05], [0.05, 0, 0.6]);
    lights.push({ p: [s * 0.9, 0.85, zF - 0.06], kind: 'head' });
    pushGeo(THIN, CYL(0.02, 0.02, 0.7, 6), M4(s * (hw + 0.2), 2.45, zF + 0.25, 0, 0, s * 1.2), C.black, RM.satin);
    pushGeo(THIN, RBOX(0.1, 0.42, 0.2, 0.04), M4(s * (hw + 0.5), 2.2, zF + 0.2), C.black, RM.satin);
    pushGeo(out.body, BOX(0.9, 0.012, 0.03), M4(s * 0.5, 1.15, gz - 0.02, 0, 0, s * 0.6), C.black, RM.satin);
    // rear lights
    pushGeo(out.body, RBOX(0.14, 0.42, 0.06, 0.03), M4(s * (hw - 0.14), 1.05, zR + 0.0), [0.55, 0.02, 0.015], [0.08, 0.2, 0.45]);
    lights.push({ p: [s * (hw - 0.14), 1.05, zR + 0.04], kind: 'tail' });
  }
  if (PARIS) quad(out.body, [0, 0.52, zF - 0.1], [-1, 0, 0], [0, 1, 0], 0.52, 0.11, R.platesFR[((rng() * 8) | 0) & 3], C.white, RM.satin);
  else quad(out.body, [0, 0.52, zF - 0.1], [-1, 0, 0], [0, 1, 0], 0.32, 0.155, R.plates[(rng() * 8) | 0], C.white, RM.satin);
  // rear window + engine grille + bike rack-ish bumper
  const rw = new THREE.PlaneGeometry(1.9, 0.6);
  pushGeo(out.glass, rw, M4(0, 2.3, zR + 0.008), C.white, RM.lens);
  pushGeo(out.body, BOX(2.0, 0.66, 0.02), M4(0, 2.3, zR - 0.002), C.black, RM.satin);
  pushGeo(out.body, BOX(1.7, 0.5, 0.01), M4(0, 1.0, zR + 0.006), C.white, RM.satin, R.grille);
  pushGeo(out.body, RBOX(2.5, 0.3, 0.2, 0.05), M4(0, 0.52, zR - 0.02), C.trim, RM.plastic);
  // roof: AC pod + hatches
  pushGeo(out.body, RBOX(1.8, 0.28, 2.6, 0.1, 2), M4(0, 3.2, 1.2), [0.9, 0.9, 0.88], [0.45, 0.2, 0]);
  for (const z of [-3.2, 3.6]) pushGeo(out.body, RBOX(0.8, 0.08, 0.8, 0.03), M4(0, 3.1, z), [0.75, 0.75, 0.74], [0.5, 0.2, 0]);
  // side lettering (both sides readable)
  for (const s of [-1, 1]) sideDecal(out.body, null, s, s > 0 ? -2.65 : -1.75, s > 0 ? 0.1 : 1.85, s > 0 ? 0.66 : 0.6, s > 0 ? 1.0 : 1.05, R.busSide, [0.95, 0.95, 0.93], RM.paint, () => hw);
  // interior: floor, seats, poles, driver
  pushGeo(out.body, BOX(hw * 2 - 0.12, 0.04, 11.4), M4(0, 0.62, 0), [0.18, 0.18, 0.19], RM.plastic);
  for (let z = -3.4; z < 5.4; z += 1.0) for (const s of [-1, 1]) {
    if (s > 0 && z > door2[0] - 0.4 && z < door2[1] + 0.2) continue;
    pushGeo(out.body, BOX(0.9, 0.12, 0.45), M4(s * 0.68, 1.06, z), [0.12, 0.26, 0.4], RM.cloth, R.seat);
    pushGeo(out.body, RBOX(0.9, 0.62, 0.1, 0.04, 1), M4(s * 0.68, 1.4, z + 0.24, -0.12, 0, 0), [0.12, 0.26, 0.4], RM.cloth, R.seat);
    pushGeo(out.body, BOX(0.08, 0.4, 0.3), M4(s * 0.68, 0.82, z), C.black, RM.satin);
  }
  for (let z = -4.8; z < 5.4; z += 1.7) for (const s of [-1, 1]) pushGeo(out.body, CYL(0.02, 0.02, 2.2, 6), M4(s * 0.24, 1.75, z), [0.9, 0.7, 0.1], RM.satin);
  for (const s of [-1, 1]) pushGeo(out.body, CYL(0.018, 0.018, 10.4, 6), M4(s * 0.4, 2.62, 0, Math.PI / 2, 0, 0), [0.75, 0.75, 0.75], RM.chrome);
  pushGeo(out.body, RBOX(0.5, 0.5, 0.5, 0.06, 1), M4(-0.75, 1.0, zF + 1.2), [0.1, 0.1, 0.1], RM.cloth);
  pushGeo(out.body, RBOX(2.3, 0.4, 0.5, 0.08, 1), M4(0, 1.0, zF + 0.4), [0.08, 0.08, 0.08], RM.plastic);   // dash
  pushGeo(out.body, new THREE.TorusGeometry(0.24, 0.02, 6, 16), M4(-0.75, 1.35, zF + 0.85, -0.8, 0, 0), C.black, RM.satin);
  // wheels
  for (const az of S.axles) for (const s of [-1, 1]) wheel(out.body, s * (hw - 0.03 - S.tw / 2), S.R, az, S.R, S.tw, S.rimR, { hub: 'steel', brakes: false, rimCol: [0.75, 0.76, 0.78], rimRm: [0.3, 0.9, 0] });
  return S;
}

// ---------------------------------------------------------------------- per-type extras
function taxiSignFR(bk, S) {   // small white "TAXI PARISIEN" box on a black base
  const z = (S.cab.zW1 + S.cab.zB0) / 2 - 0.05, y = roofY(S, z) + S.cab.crown + 0.02;
  pushGeo(bk, BOX(0.42, 0.03, 0.1), M4(0, y, z), C.black, RM.satin);
  pushGeo(bk, RBOX(0.64, 0.16, 0.13, 0.03, 2), M4(0, y + 0.1, z), [1.0, 0.98, 0.92], RM.sign);
  for (const s of [-1, 1]) quad(bk, [0, y + 0.1, z + s * 0.067], [s, 0, 0], [0, 1, 0], 0.6, 0.15, R.taxiSignFR, C.white, RM.sign);
}
function taxiSign(bk, S) {
  const z = (S.cab.zW1 + S.cab.zB0) / 2 + 0.05, y = roofY(S, z) + S.cab.crown + 0.03;
  pushGeo(bk, BOX(0.5, 0.03, 0.12), M4(0, y, z), C.black, RM.satin);
  pushGeo(bk, RBOX(0.92, 0.26, 0.2, 0.06, 2), M4(0, y + 0.15, z), [1.0, 0.75, 0.08], RM.sign);
  for (const s of [-1, 1]) quad(bk, [0, y + 0.15, z + s * 0.102], [s, 0, 0], [0, 1, 0], 0.82, 0.2, R.taxiSign, C.white, RM.sign);
}
function policeKit(bk, S, lights) {
  const c = S.cab, z = c.zW1 + 0.5, y = roofY(S, z) + c.crown + 0.01;
  pushGeo(bk, RBOX(1.36, 0.06, 0.3, 0.02, 1), M4(0, y + 0.02, z), C.black, RM.satin);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const x = s * (0.13 + k * 0.19);
    const red = TOKYO || (s < 0 && !PARIS);
    const col = red ? [0.8, 0.03, 0.02] : [0.03, 0.12, 0.9];
    pushGeo(bk, RBOX(0.17, 0.085, 0.24, 0.03, 1), M4(x, y + 0.095, z), col, [0.06, 0.1, 0.5]);
    if (k !== 1) lights.push({ p: [x, y + 0.1, z], kind: red ? 'red' : 'blue' });
  }
  pushGeo(bk, RBOX(0.1, 0.08, 0.24, 0.03, 1), M4(0, y + 0.09, z), [1, 1, 1], [0.06, 0.1, 0.4]);
  if (PARIS) {   // no push bar / A-pillar spot: two blue strobes in the grille instead
    const zF = S.zF, yb = interp(S.sbKeys, zF);
    for (const s of [-1, 1]) { pushGeo(bk, BOX(0.1, 0.04, 0.02), M4(s * 0.22, yb + 0.36, zF - 0.01), [0.03, 0.12, 0.9], [0.06, 0.1, 0.6]); lights.push({ p: [s * 0.22, yb + 0.36, zF - 0.04], kind: 'blue' }); }
    const rz = c.zB0 - 0.25, ry = roofY(S, rz) + c.crown + 0.003;
    quad(bk, [0, ry, rz], [1, 0, 0], [0, 0, -1], 0.7, 0.35, R.pdRoof, C.white, RM.paint);
    return;
  }
  // push bar
  const zF = S.zF, yb = interp(S.sbKeys, zF);
  for (const s of [-1, 1]) {
    pushGeo(bk, BOX(0.06, 0.55, 0.06), M4(s * 0.38, yb + 0.3, zF - 0.14), C.black, RM.satin);
    pushGeo(bk, BOX(0.05, 0.05, 0.16), M4(s * 0.38, yb + 0.12, zF - 0.06), C.black, RM.satin);
  }
  pushGeo(bk, RBOX(0.9, 0.08, 0.07, 0.02), M4(0, yb + 0.5, zF - 0.14), C.black, RM.satin);
  pushGeo(bk, RBOX(0.9, 0.08, 0.07, 0.02), M4(0, yb + 0.22, zF - 0.14), C.black, RM.satin);
  for (const s of [-1, 1]) { pushGeo(bk, BOX(0.12, 0.05, 0.02), M4(s * 0.25, yb + 0.5, zF - 0.18), s < 0 ? [0.8, 0.03, 0.02] : [0.03, 0.12, 0.9], [0.06, 0.1, 0.6]); lights.push({ p: [s * 0.25, yb + 0.5, zF - 0.2], kind: s < 0 ? 'red' : 'blue' }); }
  // A-pillar spotlight
  pushGeo(bk, CYL(0.06, 0.05, 0.1, 10), M4(-(S.hw - 0.02), interp(S.topKeys, c.zA) + 0.1, c.zA + 0.22, Math.PI / 2, 0, 0), C.chrome, RM.chrome);
  // roof unit number (read from the air)
  const rz = c.zB0 - 0.25, ry = roofY(S, rz) + c.crown + 0.003;
  quad(bk, [0, ry, rz], [1, 0, 0], [0, 0, -1], 0.7, 0.35, R.pdRoof, C.white, RM.paint);
}
function suvKit(bk, S) {
  const c = S.cab;
  for (const s of [-1, 1]) {
    // roof rails
    const y0 = c.yRoof + c.crown - 0.01;
    pushGeo(bk, RBOX(0.04, 0.04, 2.3, 0.015), M4(s * (c.xr - 0.06), y0 + 0.05, (c.zW1 + c.zB0) / 2 + 0.15), C.black, RM.satin);
    for (const z of [c.zW1 + 0.2, c.zB0 - 0.15]) pushGeo(bk, BOX(0.04, 0.05, 0.06), M4(s * (c.xr - 0.06), y0 + 0.02, z), C.black, RM.satin);
    // arch flares
    for (const az of S.axles) {
      const fl = new THREE.TorusGeometry(S.ar + 0.035, 0.05, 5, 14, Math.PI); fl.scale(1, 1, 0.55); fl.rotateY(Math.PI / 2);
      pushGeo(bk, fl, M4(s * (hwAt(S, az + S.ar) + 0.0), S.R + 0.02, az), C.trim, RM.plastic);
    }
    // side step
    pushGeo(bk, RBOX(0.16, 0.05, 2.0, 0.02), M4(s * (S.hw + 0.02), 0.42, (S.axles[0] + S.axles[1]) / 2), C.trim, RM.plastic);
  }
  // spare-less rear: hatch handle + spoiler
  pushGeo(bk, RBOX(1.5, 0.05, 0.22, 0.02), M4(0, c.yRoof + 0.02, c.zB0 + 0.06), C.black, RM.satin);
}

// ---------------------------------------------------------------------- public API
export function buildCar(type, opts = {}) {
  PARIS = opts.city === 'paris'; TOKYO = opts.city === 'tokyo';
  const M = materials(PARIS);
  const seed = opts.seed ?? 7;
  const rng = makeRng(seed * 9973 + type.length * 131);
  const out = { body: new Bucket(), glass: new Bucket(), glassW: new Bucket(), door: new Bucket(), doorGlass: new Bucket() };
  THIN = new Bucket();
  const lights = [], bd = {};
  let abandon = '';
  const mark = (k) => { bd[k] = out.body.tris - (bd._t || 0); bd._t = out.body.tris; };
  const wreck = type === 'wreck';
  const kind = wreck ? 'sedan' : type;
  let S;
  let paint = hex(opts.paint ?? (type === 'taxi' ? 0xf2b705 : type === 'police' ? 0xf4f4f2 : type === 'suv' ? 0x0d0e10 : type === 'van' ? 0xe8e6e0 : 0x6f7378));
  if (type === 'taxi') paint = PARIS ? hex([0x17181b, 0x24262a, 0x101113, 0x2e3034][seed & 3]) : TOKYO ? hex([0x161c34, 0x101113, 0x173a2a, 0x161c34, 0x5a1a1e, 0xd8a818][seed % 6]) : hex(0xf2b705);
  if (type === 'police') paint = hex(0xf4f4f2);
  if (type === 'bus') S = buildBus(out, rng, lights);
  else {
    S = SPECS[kind === 'taxi' || kind === 'police' ? 'sedan' : kind];
    const doorOpen = !!opts.doorOpen && !wreck;
    // abandoned-traffic variety (deterministic per seed; opts can force it)
    const ab = makeRng(seed * 7919 + type.length * 17);
    const pickH = ab(), pickT = ab(), pickS = ab(), pickSide = ab(), pickWin = ab();
    const hoodUp = !wreck && (opts.hoodUp ?? (['sedan', 'taxi', 'police', 'suv'].includes(kind) && pickH < 0.3));
    const trunkOpen = !wreck && !hoodUp && (opts.trunkOpen ?? (['sedan', 'taxi', 'police'].includes(kind) && pickT < 0.3));
    let shatter = null;
    if (!wreck && (opts.shattered ?? pickS < 0.5)) {
      const sd = pickSide < 0.5 ? -1 : 1, di = S.doors.length > 1 && pickWin < 0.5 ? 1 : 0;
      if (!(doorOpen && sd < 0 && di === 0)) shatter = { s: sd, z0: S.doors[di][0], z1: S.doors[di][1] };
    }
    out.hood = new Bucket(); out.trunk = new Bucket();
    buildCarBody(kind, S, wreck ? [0.2, 0.2, 0.2] : paint, { doorOpen, hoodUp, trunkOpen, shatter }, out, rng); mark('shell');
    if (hoodUp) openHood(out, S);
    if (trunkOpen) openTrunk(out, S, rng);
    if (shatter) shatterWindow(out, S, shatter, rng);
    abandon = [hoodUp && 'hood', trunkOpen && 'trunk', shatter && 'glass'].filter(Boolean).join(' ');
    if (!wreck) windshieldTrim(out, S);
    interior(out.body, S, kind, rng, { rows: kind === 'van' ? 1 : 2 }); mark('interior');
    if (!wreck) dressCar(out.body, S, kind, paint, { doorOpen }, rng, lights);
    else {   // wreck: bare frames where the lamps were, sagging bumper
      for (const s of [-1, 1]) pushGeo(out.body, BOX(0.34, 0.11, 0.1), M4(s * (S.hw - 0.27), interp(S.topKeys, S.zF) + 0.03, S.zF + 0.06), C.black, RM.under);
      pushGeo(out.body, RBOX(S.hw * 1.7, 0.06, 0.12, 0.02), M4(0.1, 0.16, S.zF + 0.1, 0, 0.1, 0.12), C.black, RM.under);
    }
    if (type === 'taxi' && PARIS) taxiSignFR(out.body, S);
    else if (type === 'taxi') {
      taxiSign(out.body, S);
      for (const s of [-1, 1]) { sideDecal(out.body, S, s, -0.82, 0.12, 0.44, 0.56, R.taxiDoor, paint); sideDecal(out.body, S, s, 1.72, 2.12, 0.62, 0.71, R.taxiNum, paint); }
    }
    if (type === 'police') {
      policeKit(out.body, S, lights);
      if (PARIS) for (const s of [-1, 1]) { sideDecal(out.body, S, s, -0.9, 0.2, 0.56, 0.77, R.pdDoor, C.white); sideDecal(out.body, S, s, 1.6, 2.1, 0.57, 0.71, R.pdQuarter, C.white); }
      else for (const s of [-1, 1]) { sideDecal(out.body, S, s, -0.84, 0.16, 0.5, 0.75, R.pdDoor, C.white); sideDecal(out.body, S, s, 1.62, 2.06, 0.6, 0.71, R.pdQuarter, C.white); }
    }
    if (type === 'suv') suvKit(out.body, S);
    if (type === 'van') {
      for (const s of [-1, 1]) for (const z of S.doors[0]) {
        const y0 = S.doorY, y1 = interp(S.topKeys, z) - 0.01;
        pushGeo(out.body, BOX(0.008, y1 - y0, 0.01), M4(s * (sideSurface(S, z, (y0 + y1) / 2) + 0.002), (y0 + y1) / 2, z), C.rubber, RM.rubber);
      }
      lights.push(...vanBox(out, paint, rng));
      // drop the cab's own tail lamps (hidden in the box) from the light anchors
      for (let i = lights.length - 1; i >= 0; i--) if (lights[i].kind === 'tail' && lights[i].p[2] < 0) lights.splice(i, 1);
    }
    if (doorOpen) finishDoor(out, S, kind, paint);
    mark('extras');
    // wheels
    const steer = (rng() - 0.5) * 0.5;
    S.axles.forEach((az, i) => {
      for (const s of [-1, 1]) {
        const x = s * (hwAt(S, az) - 0.03 - S.tw / 2);
        if (wreck) wheel(out.body, x, S.rimR + 0.012, az, S.R, S.tw, S.rimR, { tyre: false, spokes: 5, steer: i === 0 ? steer : 0 });
        else wheel(out.body, x, S.R, az, S.R, S.tw, S.rimR, { spokes: kind === 'suv' ? 6 : kind === 'van' ? 8 : 5, steer: i === 0 ? steer : 0, hub: kind === 'police' || kind === 'van' ? 'steel' : 'alloy', rimCol: kind === 'police' ? [0.12, 0.12, 0.13] : kind === 'suv' ? [0.25, 0.26, 0.28] : C.chrome, rimRm: kind === 'police' ? RM.satin : RM.alu });
      }
    });
    if (type === 'van') for (const s of [-1, 1]) wheel(out.body, s * (1.15 - 0.03 - S.tw / 2 - 0.05), S.R, 1.95, S.R, S.tw, S.rimR, { hub: 'steel', rimCol: [0.8, 0.8, 0.8], rimRm: RM.alu });
  }
  // wreck: crush the nose, dent the roof, buckle panels, sit on the rims (faceted normals sell the damage)
  if (wreck) {
    const p = out.body.p, nr = makeRng(seed * 31 + 7);
    const hz = Array.from({ length: 24 }, () => [nr() * 5 - 2.5, nr() * 1.5, (nr() - 0.5) * 2, 0.15 + nr() * 0.35, (nr() - 0.5) * 0.12]);
    const drop = SPECS.sedan.R - SPECS.sedan.rimR - 0.012;
    for (let i = 0; i < p.length; i += 3) {
      let x = p[i], y = p[i + 1], z = p[i + 2];
      const isWheelish = y < 0.62 && Math.abs(Math.abs(x) - 0.75) < 0.2 && SPECS.sedan.axles.some((a) => Math.abs(z - a) < 0.36);
      if (!isWheelish) {
        if (z < -1.5) { const k = (-1.5 - z); z += k * 0.28; y -= k * k * 0.12 * (y > 0.5 ? 1 : 0.3); x *= 1 + k * 0.04 * Math.sin(y * 9); }
        if (y > 1.2) y -= 0.09 * Math.exp(-((z - 0.5) ** 2) / 0.4) * (1 - Math.abs(x));
        for (const [cz, cy, cx, r, a] of hz) { const d2 = (z - cz) ** 2 + (y - cy) ** 2 + (x - cx) ** 2; if (d2 < r * r) { const f = (1 - d2 / (r * r)); x -= Math.sign(x) * a * f * f; y += a * 0.4 * f * f; } }
        y -= drop; y -= x * 0.025;
      }
      p[i] = x; p[i + 1] = Math.max(-0.01, y); p[i + 2] = z;
    }
    // faceted normals
    for (let i = 0; i < p.length; i += 9) {
      const a = new THREE.Vector3(p[i], p[i + 1], p[i + 2]), b = new THREE.Vector3(p[i + 3], p[i + 4], p[i + 5]), cc = new THREE.Vector3(p[i + 6], p[i + 7], p[i + 8]);
      const n = b.sub(a).cross(cc.sub(a)).normalize();
      for (let k = 0; k < 3; k++) { out.body.n[i + k * 3] = n.x; out.body.n[i + k * 3 + 1] = n.y; out.body.n[i + k * 3 + 2] = n.z; }
    }
  }
  // ---------- assemble
  const root = new THREE.Group(); root.name = 'car:' + type;
  const bb = out.body.geometry().boundingBox;      // cover bounds: without mirrors / antenna
  if (!wreck) out.body.append(THIN, new THREE.Matrix4());
  const bodyGeo = out.body.geometry();
  const body = new THREE.Mesh(bodyGeo, wreck ? M.charred : M.body);
  body.castShadow = true; body.receiveShadow = true;
  root.add(body);
  let glass = null;
  if (!wreck && out.glass.tris) { glass = new THREE.Mesh(out.glass.geometry(), M.glass); glass.renderOrder = 3; glass.castShadow = false; root.add(glass); }
  // bounds (without the swung door)
  if (opts.doorOpen && !wreck && S.hw) bb.min.x = Math.max(bb.min.x, -(S.hw + 0.16));
  const half = [(bb.max.x - bb.min.x) / 2, (bb.max.y - Math.max(0, bb.min.y)) / 2, (bb.max.z - bb.min.z) / 2];
  const center = [(bb.max.x + bb.min.x) / 2, (bb.max.y + Math.max(0, bb.min.y)) / 2, (bb.max.z + bb.min.z) / 2];
  // contact shadow
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(half[0] * 2 + 0.7, half[2] * 2 + 0.9), M.blob);
  blob.rotation.x = -Math.PI / 2; blob.position.set(center[0], 0.012, center[2]); blob.renderOrder = 1; blob.castShadow = false; blob.receiveShadow = false;
  root.add(blob);
  // anchors
  const cab = S.cab;
  const hoodZ = cab ? (S.zF + cab.zA) / 2 : S.zF + 0.6;
  const hoodY = S.topKeys ? interp(S.topKeys, hoodZ) : 1.2;
  const anchors = {
    hood: new THREE.Vector3(0, hoodY + 0.02, hoodZ),
    engine: type === 'bus' ? new THREE.Vector3(0, 1.0, S.zR - 0.8) : new THREE.Vector3(0, hoodY - 0.25, hoodZ - 0.1),
    roof: new THREE.Vector3(0, bb.max.y, cab ? (cab.zW1 + cab.zB0) / 2 : center[2]),
    lights: wreck ? [] : lights,
  };
  let tris = out.body.tris + (glass ? out.glass.tris : 0) + 2;
  mark('wheels'); delete bd._t;
  const info = { type, tris, draws: 2 + (glass ? 1 : 0), breakdown: bd, abandon };
  if (PARIS) info.city = 'paris';
  const res = {
    root, half, center, anchors, info, mesh: body, glass, blob, burntMaterials: [M.charred], burnt: wreck,
    setBurnt() {
      if (res.burnt) return; res.burnt = true;
      body.material = M.charred; if (glass) glass.visible = false;
      res.anchors.lights = [];
    },
  };
  return res;
}
export function carMaterials(city) { return materials(city === 'paris'); }
