import * as THREE from 'three';
import { DIST } from './layout.js';
import { LM, LM_GLSL } from './lightmap.js';

// =====================================================================================
//  LIGHTS OUT — the art kit: the POWER uniforms (dusk → night → blackout), the one patched
//  material every static surface uses (vertex colour albedo, per-vertex roughness / metalness,
//  per-vertex emissive with a district code, optional procedural windows), a geometry
//  accumulator, and region buckets so the whole city is a handful of draw calls per region.
//
//  Emissive code (aInfo.w): district id 0..15 (+16 = already on at dusk: lanterns, street lamps).
//  A light's brightness = uPow[id] (flicker / blackout) × the night ramp, and it is OFF above the
//  district's cut height uCut[id] (world y) — that is how towers go dark floor by floor and the
//  lantern wall tier by tier.
// =====================================================================================
export const POWER = {
  pow: { value: new Float32Array(16).fill(1) },
  cut: { value: new Float32Array(16).fill(9999) },
  night: { value: 0.2 },
  time: { value: 0 },
  // Jinlong dying as it falls: die 0..1 = how far the failure has run; dieRow = the row of its inverse transform that
  // gives a fragment's height on the standing tower (so sections go dark by floor, whatever angle it is at)
  die: { value: 0 }, dieRow: { value: new THREE.Vector4(0, 1, 0, 0) },
  // how much light the window-walled facades take (1 = lit city; ~0.2 in the blackout: towers go to silhouettes while
  // the floors you walk on keep the moon)
  dim: { value: 1 },
};
// CPU mirror of the shader's light gain (glow sprites, reflections)
export function powK(code, y = 0) {
  const id = code & 15, dusk = code >= 16;
  const n = POWER.night.value, nk = dusk ? 1 : sstep(0.04, 0.32, n);   // the city lights come on early (18:40 is already lit)
  return POWER.pow.value[id] * nk * (y > POWER.cut.value[id] ? 0 : 1);
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const DUSK = 16;

const POW_GLSL = /* glsl */`
uniform float uPow[16];
uniform float uCut[16];
uniform float uNight;
uniform float uTime;
uniform float uDie;
uniform vec4 uDieRow;
float powK(float code, float wy){
  float id = mod(code + 0.5, 16.0) - 0.5;
  int i = int(id + 0.5);
  float dusk = step(15.5, code);
  float nk = mix(smoothstep(0.04, 0.32, uNight), 1.0, dusk);
  return uPow[i] * nk * step(wy, uCut[i]);
}
// the falling tower loses its lights section by section (five floors at a time), roughly from the break at its base
// upward but out of order, each section stuttering before it goes dark
float dieK(float code, vec3 wp){
  if (uDie <= 0.0) return 1.0;
  float id = mod(code + 0.5, 16.0) - 0.5;
  if (abs(id - 10.0) > 0.5) return 1.0;
  float ry = dot(uDieRow.xyz, wp) + uDieRow.w;
  float b = floor(ry / 21.0), h = fract(sin(b * 12.9898) * 43758.5453);
  float thr = mix(clamp(((b + 0.5) * 21.0 - 50.0) / 190.0, 0.0, 1.0), h, 0.5) * 0.9 + 0.04;
  float e = thr - uDie;
  if (e > 0.08) return 1.0;
  if (e < 0.0) return 0.0;
  return step(0.45, fract(uTime * (8.0 + h * 9.0) + h * 5.0)) * 0.85;
}
float lh21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
`;

// Window lights are baked into two small mip-mapped textures, one texel per window (A: flats in 3-bay clusters,
// B: office floors in ~10-bay runs). RGB = the window lit at full power, A = the same window on emergency power
// (a much sparser, candle-warm pattern). Sampling one texel per window with the window grid's own gradients lets
// the GPU's mip chain average whole windows at distance: no stipple / static / moiré on the towers.
const WN = 256;
function bakeWindows(seed, cluster, frac) {
  let x = seed >>> 0; const r = () => { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const d = new Uint8Array(WN * WN * 4);
  const floorOn = new Float32Array(WN).map(() => r() < 0.72 ? 1 : 0);
  const cl = {};
  const col = (h) => h < 0.58 ? [1.0, 0.60, 0.28] : h < 0.84 ? [1.0, 0.78, 0.52] : h < 0.97 ? [0.78, 0.88, 1.0] : [0.55, 0.62, 1.0];
  for (let j = 0; j < WN; j++) for (let i = 0; i < WN; i++) {
    const ck = j * 1000 + Math.floor(i / cluster);
    const c = cl[ck] ||= { h: r(), hc: r(), b: r(), e: r() };
    const own = r();
    const on = floorOn[j] && (c.h * 0.88 + own * 0.12) < frac;
    const C = col(c.hc), br = (0.62 + 0.38 * (c.b * 0.6 + own * 0.4)) * (on ? 1 : 0);
    // emergency: ~1 flat in 22 has a lamp, a candle, a phone (warm, dim, flat by flat): the blackout city reads dark
    const em = c.e < 0.045 ? 0.55 + 0.45 * own : 0;
    const o = (j * WN + i) * 4;
    d[o] = Math.round(C[0] * br * 255); d[o + 1] = Math.round(C[1] * br * 255); d[o + 2] = Math.round(C[2] * br * 255); d[o + 3] = Math.round(em * 255);
  }
  const t = new THREE.DataTexture(d, WN, WN, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
export const WINTEX = { a: { value: bakeWindows(9157, 3, 0.5) }, b: { value: bakeWindows(4421, 10, 0.42) } };

// procedural windows: uv in metres (u along the face, v up from the building's base), aCell = (bay, floor, seed, style)
//  style 0 residential slab (punched windows, balcony rails, AC boxes), 1 office ribbon glazing, 2 old block,
//  3 shop / podium (big glazing), 4 hotel / gold fins
const WIN_GLSL = /* glsl */`
uniform sampler2D uWinA, uWinB;
// returns emissive; writes the glass mask (albedo / roughness) and a detail mask (balcony slabs light, AC units dark)
vec3 windows(vec2 uv, vec4 cell, float k, float wy, float code, out float glassM, out float frameM, out float detM){
  vec2 cu = uv / cell.xy;
  vec2 id = floor(cu), f = fract(cu);
  // the seed / style arrive as interpolated varyings (not bit-exact across a face): round them before hashing,
  // or the hash turns float noise into per-pixel static
  float sd = floor(cell.z + 0.5), st = floor(cell.w + 0.5);
  vec2 lo = st < 0.5 ? vec2(0.12, 0.26) : st < 1.5 ? vec2(0.03, 0.14) : st < 2.5 ? vec2(0.26, 0.34) : st < 3.5 ? vec2(0.05, 0.08) : vec2(0.10, 0.16);
  vec2 hi = st < 0.5 ? vec2(0.72, 0.88) : st < 1.5 ? vec2(0.97, 0.93) : st < 2.5 ? vec2(0.74, 0.82) : st < 3.5 ? vec2(0.95, 0.88) : vec2(0.90, 0.94);
  vec2 dx = dFdx(cu), dy = dFdy(cu);
  vec2 aa = max(fwidth(cu), vec2(1e-4)) * 1.2;
  vec2 m2 = smoothstep(lo - aa, lo + aa, f) * (1.0 - smoothstep(hi - aa, hi + aa, f));
  float wm = m2.x * m2.y;
  float h3 = lh21(id * 0.31 + 2.0 + sd);
  float far = clamp(max(aa.x, aa.y) * 7.0 - 0.7, 0.0, 1.0);       // windows under ~12 px fade to their average (frames, bars, AC boxes), fully by ~4 px
  detM = 0.0;
  if (st > 0.5 && st < 1.5) wm *= 1.0 - (1.0 - smoothstep(0.0, aa.x * 2.0, abs(fract(f.x * 2.0) - 0.5) - 0.012)) * 0.9 * (1.0 - smoothstep(0.04, 0.12, aa.x));   // the mullion: only up close
  if (st < 0.5 || (st > 1.5 && st < 2.5)) {
    // Chinese residential: a balcony slab edge every floor, an AC condenser hung beside most windows,
    // burglar bars over the lower floors' windows (all fade out with distance)
    float slab = 1.0 - smoothstep(0.10, 0.10 + aa.y * 2.0, f.y);
    detM = slab * 0.55;
    vec2 ac = vec2(0.77, 0.12); vec2 acs = vec2(0.17, 0.2);
    float am = step(0.35, h3) * smoothstep(ac.x - aa.x, ac.x + aa.x, f.x) * (1.0 - smoothstep(ac.x + acs.x - aa.x, ac.x + acs.x + aa.x, f.x)) * smoothstep(ac.y - aa.y, ac.y + aa.y, f.y) * (1.0 - smoothstep(ac.y + acs.y - aa.y, ac.y + acs.y + aa.y, f.y));
    detM -= am * 0.75;
    float bars = (id.y < 6.0) ? (1.0 - smoothstep(0.0, aa.x * 3.0, abs(fract(f.x * 9.0) - 0.5) - 0.38)) : 0.0;
    bars *= 1.0 - smoothstep(0.012, 0.04, aa.x);
    wm *= 1.0 - bars * 0.75;
  }
  float area = (hi.x - lo.x) * (hi.y - lo.y);
  glassM = mix(wm, area, far);
  detM *= 1.0 - far;
  frameM = (1.0 - wm) * (1.0 - far);
  // the lights: one texel per window, mip-filtered by the window grid's own footprint
  vec2 tu = (mix(id + 0.5, cu, far) + vec2(mod(sd * 37.0, 256.0), mod(sd * 91.0, 256.0))) / 256.0;   // near: the window's own texel; far: filtered smoothly
  // far off, blur over more windows than the pixel covers: clusters of lit flats otherwise read as blotches / static
  float lb = 1.0 + 5.0 * far;
  vec4 W = (st > 0.5 && st < 1.5) || st > 3.5 ? textureGrad(uWinB, tu, dx * lb / 256.0, dy * lb / 256.0) : textureGrad(uWinA, tu, dx * lb / 256.0, dy * lb / 256.0);
  float full = smoothstep(0.3, 0.85, k);
  vec3 c = W.rgb * full + W.a * vec3(0.55, 0.36, 0.18) * (1.0 - full) * clamp(k / 0.22, 0.0, 1.0);
  c *= mix(0.75 + 0.35 * smoothstep(0.2, 0.9, f.y) * step(0.5, h3), 1.0, far);   // a lamp's glow on the ceiling, near only
  return c * glassM;
}
`;

// height fog: the gorge's mist (thick on the water, thinning out by the cliff tops). One exponential layer,
// integrated along the eye ray (exact for an exponential), tinted by the city's light. Lit materials + the water.
export const HFOG = { p: { value: new THREE.Vector4(0.0028, 1 / 24, 0.0, 1.0) }, c: { value: new THREE.Color(0.2, 0.18, 0.2) } };
export const HFOG_GLSL = /* glsl */`
uniform vec4 uHF; uniform vec3 uHFC;
float hfogK(vec3 wp){
  vec3 d = wp - cameraPosition; float L = length(d); float dy = d.y;
  float a = uHF.x * exp(-uHF.y * (cameraPosition.y - uHF.z));
  float t = abs(dy) > 0.01 ? (1.0 - exp(-uHF.y * dy)) / (uHF.y * dy) : 1.0;
  return clamp(1.0 - exp(-a * L * t), 0.0, 0.92) * uHF.w;
}`;
const _cache = {};
// opts: map, normalMap, uvScale (map tiles per metre is done in geometry), emMap (0..1: emissive *= map luminance),
//       win (procedural windows from aCell), rough/metal fallbacks, side, transparent
export function litMat(key, o = {}) {
  if (_cache[key]) return _cache[key];
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, emissive: 0xffffff, emissiveIntensity: 1, map: o.map || null, normalMap: o.normalMap || null, side: o.side ?? THREE.FrontSide, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? true });
  if (o.normalMap) m.normalScale.set(o.nScale ?? 0.8, o.nScale ?? 0.8);
  const emMap = o.emMap ?? 0, win = !!o.win;
  m.onBeforeCompile = (s) => {
    s.uniforms.uPow = POWER.pow; s.uniforms.uCut = POWER.cut; s.uniforms.uNight = POWER.night; s.uniforms.uTime = POWER.time; s.uniforms.uDie = POWER.die; s.uniforms.uDieRow = POWER.dieRow;
    s.uniforms.uHF = HFOG.p; s.uniforms.uHFC = HFOG.c;
    if (win) { s.uniforms.uWinA = WINTEX.a; s.uniforms.uWinB = WINTEX.b; s.uniforms.uFDim = POWER.dim; }
    s.uniforms.uLM = LM.tex; s.uniforms.uLMC = LM.col; s.uniforms.uLMH = LM.hgt; s.uniforms.uLMR = LM.rect; s.uniforms.uLMG = LM.grp; s.uniforms.uLMK = LM.k;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aInfo;\nattribute vec3 rm;\nvarying vec4 vInfo;\nvarying vec3 vRM;\nvarying vec3 vWP;' + (win ? '\nattribute vec4 aCell;\nvarying vec4 vCell;\nvarying vec2 vWin;' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInfo = aInfo; vRM = rm;' + (win ? ' vCell = aCell; vWin = uv;' : ''))
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 wp4 = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n wp4 = instanceMatrix * wp4;\n#endif\n vWP = (modelMatrix * wp4).xyz; }');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vInfo;\nvarying vec3 vRM;\nvarying vec3 vWP;\n' + HFOG_GLSL + POW_GLSL + (o.noLM ? '' : LM_GLSL) + (win ? 'varying vec4 vCell;\nvarying vec2 vWin;\nuniform float uFDim;\n' + WIN_GLSL : ''))
      .replace('#include <fog_fragment>', '#include <fog_fragment>\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHFC, hfogK(vWP));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vRM.x;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;')
      .replace('#include <emissivemap_fragment>', `
  float pk = powK(vInfo.w, vWP.y) * dieK(vInfo.w, vWP);
  // codes >= 32: an LED facade show — light sweeping up the tower in waves (Chongqing's riverfront at night)
  if (vInfo.w > 31.5) pk *= 0.25 + 0.75 * smoothstep(-0.3, 0.7, sin(uTime * 1.7 - vWP.y * 0.08 + vWP.x * 0.006 + vWP.z * 0.004));
  vec3 em = vInfo.rgb * pk;
  ${emMap > 0 ? `#ifdef USE_MAP\n  em *= mix(vec3(1.0), sampledDiffuseColor.rgb * 2.0, ${emMap.toFixed(2)});\n#endif` : ''}
  ${win ? `if (vCell.x > 0.0) {
    float gm, fm, dm;
    vec3 we = windows(vWin, vCell, pk, vWP.y, vInfo.w, gm, fm, dm);
    diffuseColor.rgb *= 1.0 + dm;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.04, 0.05), gm * 0.9) * uFDim;
    roughnessFactor = mix(roughnessFactor, mix(0.6, 0.12, uFDim), gm);
    metalnessFactor = mix(metalnessFactor, 0.0, gm);
    em = we * 0.9 + vInfo.rgb * pk * (1.0 - gm * 0.75);
  }` : ''}
  ${o.noLM ? '' : '{ vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz); diffuseColor.rgb *= baseAO(vWP, wn); em += diffuseColor.rgb * groundLight(vWP, wn); }'}
  totalEmissiveRadiance = em;`);
    if (o.patch) o.patch(s);
  };
  m.customProgramCacheKey = () => 'lo:' + key;
  m.userData.key = key;
  _cache[key] = m;
  return m;
}
// floodlit structures: the uplight glow on the face is baked into the vertex emissive (see Acc.flood)

// =====================================================================================
//  Geometry accumulator (from Tokyo's kit): quads / boxes / cylinders / tubes with per-vertex
//  colour, rm (rough, metal, -), aInfo (emissive rgb, code), aCell (window params).
//  uvMode 'world': box faces get world-metre UVs scaled by `uvScale` (tiling textures).
// =====================================================================================
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
export class Acc {
  constructor() {
    this.p = []; this.n = []; this.uv = []; this.c = []; this.rm = []; this.info = []; this.cell = [];
    this.idx = []; this.vn = 0;
    this.M = null;
    this.col = [1, 1, 1]; this.rmv = [0.85, 0, 0]; this.em = [0, 0, 0, 0]; this.cellv = [0, 0, 0, 0];
    this.ao = null; // optional fn(x, y, z) → multiplier on vertex colour (contact darkening)
  }
  get tris() { return this.idx.length / 3; }
  // NB: setting a colour without an emissive resets the emissive (a lamp's glow must not leak into the next prop)
  set({ col, rm, em, cell, ao } = {}) { if (col) { this.col = col; if (!em) this.em = [0, 0, 0, 0]; } if (rm) this.rmv = rm; if (em) this.em = em; if (cell) this.cellv = cell; if (ao !== undefined) this.ao = ao; return this; }
  // an inside-out box (a room seen from within): faces point inward
  room(x0, y0, z0, x1, y1, z1, { faces = 'xXyYzZ', col = this.col } = {}) {
    if (faces.includes('z')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, x1, y1], col);
    if (faces.includes('Z')) this.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x0, y0, x1, y1], col);
    if (faces.includes('x')) this.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [z0, y0, z1, y1], col);
    if (faces.includes('X')) this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [z0, y0, z1, y1], col);
    if (faces.includes('y')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [x0, z0, x1, z1], col);
    if (faces.includes('Y')) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [x0, z0, x1, z1], col);
  }
  vert(x, y, z, nx, ny, nz, u, v, col = this.col, em = this.em) {
    if (this.M) { _v.set(x, y, z).applyMatrix4(this.M); x = _v.x; y = _v.y; z = _v.z; _m3.getNormalMatrix(this.M); _n.set(nx, ny, nz).applyMatrix3(_m3).normalize(); nx = _n.x; ny = _n.y; nz = _n.z; }
    let k = 1; if (this.ao) k = this.ao(x, y, z, nx, ny, nz);
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(col[0] * k, col[1] * k, col[2] * k);
    this.rm.push(this.rmv[0], this.rmv[1], this.rmv[2]);
    this.info.push(em[0], em[1], em[2], em[3]);
    this.cell.push(this.cellv[0], this.cellv[1], this.cellv[2], this.cellv[3]);
    return this.vn++;
  }
  tri(a, b, c, uvs = [[0, 0], [1, 0], [0.5, 1]], col = this.col) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, uvs[0][0], uvs[0][1], col);
    this.vert(b[0], b[1], b[2], nx, ny, nz, uvs[1][0], uvs[1][1], col);
    this.vert(c[0], c[1], c[2], nx, ny, nz, uvs[2][0], uvs[2][1], col);
    this.idx.push(i0, i0 + 1, i0 + 2);
  }
  // quad a b c d (counter-clockwise seen from the normal side); uv rect [u0, v0, u1, v1]
  quad(a, b, c, d, uv = [0, 0, 1, 1], col = this.col, cols = null, ems = null) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    const i0 = this.vert(a[0], a[1], a[2], nx, ny, nz, uv[0], uv[1], cols ? cols[0] : col, ems ? ems[0] : this.em);
    this.vert(b[0], b[1], b[2], nx, ny, nz, uv[2], uv[1], cols ? cols[1] : col, ems ? ems[1] : this.em);
    this.vert(c[0], c[1], c[2], nx, ny, nz, uv[2], uv[3], cols ? cols[2] : col, ems ? ems[2] : this.em);
    this.vert(d[0], d[1], d[2], nx, ny, nz, uv[0], uv[3], cols ? cols[3] : col, ems ? ems[3] : this.em);
    this.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  // axis-aligned box; faces 'xXyYzZ'; uv: s = metres per uv unit (0 → 0..1 per face). World-aligned uv
  // (u along the face, v = world y) so tiling textures line up across boxes. win: windows (v from y0 - wy0)
  box(x0, y0, z0, x1, y1, z1, { faces = 'xXyYzZ', s = 0, col = this.col, foot = 0, top = null, wy0 = null } = {}) {
    const U = (a) => s ? a / s : a;
    const vb = wy0 ?? 0;
    const lo = foot ? col.map(v => v * (1 - foot)) : col, hi = top || col;
    const cs = (lo2, hi2) => [lo2, lo2, hi2, hi2];
    const S = s || 1;
    const wv = (y) => s ? (y - vb) / S : (y - y0) / (y1 - y0);
    if (faces.includes('Z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], s ? [U(x0), wv(y0), U(x1), wv(y1)] : [0, 0, 1, 1], col, cs(lo, hi));
    if (faces.includes('z')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], s ? [U(-x1), wv(y0), U(-x0), wv(y1)] : [0, 0, 1, 1], col, cs(lo, hi));
    if (faces.includes('X')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], s ? [U(-z1), wv(y0), U(-z0), wv(y1)] : [0, 0, 1, 1], col, cs(lo, hi));
    if (faces.includes('x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], s ? [U(z0), wv(y0), U(z1), wv(y1)] : [0, 0, 1, 1], col, cs(lo, hi));
    if (faces.includes('Y')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], s ? [U(x0), U(-z1), U(x1), U(-z0)] : [0, 0, 1, 1], hi);
    if (faces.includes('y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], s ? [U(x0), U(z0), U(x1), U(z1)] : [0, 0, 1, 1], lo);
  }
  // box centred, rotated by yaw
  obox(cx, cy, cz, hx, hy, hz, yaw = 0, opts = {}) {
    const save = this.M;
    const M = new THREE.Matrix4().makeRotationY(yaw).setPosition(cx, cy, cz);
    this.M = save ? save.clone().multiply(M) : M;
    this.box(-hx, -hy, -hz, hx, hy, hz, opts);
    this.M = save;
  }
  // with an arbitrary matrix
  push(M) { const save = this.M; this.M = save ? save.clone().multiply(M) : M.clone(); return save; }
  pop(save) { this.M = save; }
  cyl(cx, y0, cz, r0, r1, y1, seg = 8, { cap = true, col = this.col, uS = 0 } = {}) {
    const base = this.vn;
    const sl = (r0 - r1) / Math.max(1e-3, y1 - y0), L = Math.hypot(1, sl);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const u = uS ? (i / seg) * Math.PI * 2 * r0 / uS : i / seg;
      this.vert(cx + c * r0, y0, cz + s * r0, c / L, sl / L, s / L, u, uS ? y0 / uS : 0, col);
      this.vert(cx + c * r1, y1, cz + s * r1, c / L, sl / L, s / L, u, uS ? y1 / uS : 1, col);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    if (cap) { const c0 = this.vert(cx, y1, cz, 0, 1, 0, 0.5, 0.5, col); const b2 = this.vn; for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; this.vert(cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1, 0, 1, 0, 0, 0, col); } for (let i = 0; i < seg; i++) this.idx.push(c0, b2 + i + 1, b2 + i); }
  }
  tube(a, b, r, seg = 6, col = this.col, r2 = r) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    if (L < 1e-4) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const save = this.push(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
    this.cyl(0, 0, 0, r, r2, L, seg, { cap: false, col });
    this.pop(save);
  }
  // a flat strip (beam with a rectangular section) between two points; up = the section's up vector
  beam(a, b, w, h, col = this.col, up = [0, 1, 0]) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), f = B.clone().sub(A), L = f.length();
    if (L < 1e-4) return;
    f.divideScalar(L);
    let u = new THREE.Vector3(...up); if (Math.abs(u.dot(f)) > 0.98) u.set(1, 0, 0);
    const r = new THREE.Vector3().crossVectors(f, u).normalize(); u.crossVectors(r, f).normalize();
    const M = new THREE.Matrix4().makeBasis(r, u, f).setPosition(A.clone().addScaledVector(f, L / 2));
    const save = this.push(M); this.box(-w / 2, -h / 2, -L / 2, w / 2, h / 2, L / 2, { col }); this.pop(save);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('rm', new THREE.Float32BufferAttribute(this.rm, 3));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.info, 4));
    g.setAttribute('aCell', new THREE.Float32BufferAttribute(this.cell, 4));
    g.setIndex(this.vn > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

// =====================================================================================
//  Buckets: one Acc per (material key, region). Regions split the city so frustum culling still
//  works (west / lantern / ravine / east / tower / far). finish() turns them into meshes.
// =====================================================================================
export class Buckets {
  constructor() { this.map = new Map(); this.mats = {}; }
  mat(key, m) { this.mats[key] = m; }
  get(key, region = 'w') {
    const k = key + '|' + region;
    let a = this.map.get(k);
    if (!a) { a = new Acc(); this.map.set(k, a); }
    return a;
  }
  finish(root, { shadowKeys = [] } = {}) {
    let tris = 0;
    const meshes = [];
    for (const [k, a] of this.map) {
      if (!a.vn) continue;
      const key = k.split('|')[0];
      const mat = this.mats[key]; if (!mat) { console.warn('no material', key); continue; }
      const m = new THREE.Mesh(a.geometry(), mat);
      m.castShadow = shadowKeys.includes(key); m.receiveShadow = true; m.name = k;
      m.matrixAutoUpdate = false; m.updateMatrix();
      root.add(m); meshes.push(m); tris += a.tris;
    }
    this.map.clear();
    return { meshes, tris };
  }
}

// a hipped roof (Chinese-style when `curl` > 0: the eaves sweep up at the corners) over a rect at y
export function hipRoof(A, x0, z0, x1, z1, y, h, { over = 0.8, curl = 0.6, ridge = 0.35 } = {}) {
  const X0 = x0 - over, X1 = x1 + over, Z0 = z0 - over, Z1 = z1 + over;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, lx = (x1 - x0) * ridge / 2, lz = (z1 - z0) * ridge / 2;
  const long = x1 - x0 >= z1 - z0;
  const r0 = long ? [cx - lx, y + h, cz] : [cx, y + h, cz - lz], r1 = long ? [cx + lx, y + h, cz] : [cx, y + h, cz + lz];
  const c = (x, z, up) => [x, y + up, z];
  const a = c(X0, Z0, curl), b = c(X1, Z0, curl), cc = c(X1, Z1, curl), d = c(X0, Z1, curl);
  const m0 = c((X0 + X1) / 2, Z0, 0), m1 = c(X1, (Z0 + Z1) / 2, 0), m2 = c((X0 + X1) / 2, Z1, 0), m3 = c(X0, (Z0 + Z1) / 2, 0);
  const uv = (p) => [p[0], p[2]];
  const T = (p, q, r) => A.tri(p, r, q, [uv(p), uv(r), uv(q)]);
  if (long) {
    T(a, m0, r0); T(m0, r1, r0); T(m0, b, r1);          // north face (two sweeps meeting mid-eave)
    T(cc, m2, r1); T(m2, r0, r1); T(m2, d, r0);         // south
    T(b, m1, r1); T(m1, cc, r1);                         // east hip
    T(d, m3, r0); T(m3, a, r0);                          // west hip
  } else {
    T(b, m1, r0); T(m1, r1, r0); T(m1, cc, r1);
    T(d, m3, r1); T(m3, r0, r1); T(m3, a, r0);
    T(cc, m2, r1); T(m2, d, r1); T(a, m0, r0); T(m0, b, r0);
  }
  return { X0, X1, Z0, Z1 };
}
// a sign face from the atlas rect (uv = [u0, v0, u1, v1]); centre C, facing normal N (horizontal), w × h
export function signQuad(A, C, N, w, h, uv) {
  const rx = N[2], rz = -N[0];   // right = up × N
  const hw = w / 2, hh = h / 2;
  const a = [C[0] - rx * hw, C[1] - hh, C[2] - rz * hw], b = [C[0] + rx * hw, C[1] - hh, C[2] + rz * hw];
  const c = [C[0] + rx * hw, C[1] + hh, C[2] + rz * hw], d = [C[0] - rx * hw, C[1] + hh, C[2] - rz * hw];
  A.quad(a, b, c, d, uv);
}
// small helpers
export const hexc = (h, k = 1) => { const c = new THREE.Color(h); return [c.r * k, c.g * k, c.b * k]; };   // linear
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const em = (rgb, k, code) => [rgb[0] * k, rgb[1] * k, rgb[2] * k, code];
export const NOEM = [0, 0, 0, 0];
export const GOLD = [1.0, 0.62, 0.26];          // floodlight gold
export const LANTERN = [1.0, 0.18, 0.06];       // red lantern
export const SODIUM = [1.0, 0.55, 0.22];
export const COOLW = [0.75, 0.86, 1.0];
export { DIST };
