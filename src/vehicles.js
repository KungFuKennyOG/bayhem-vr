import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { crackedGlassTexture, bulletHoleTexture, blobShadowTexture } from './textures.js';
import { makeRng, rand, hash } from './rng.js';

// =====================================================================================
// BAYHEM vehicles — everything procedural.
// Bodies are LOFTED from cross-sections along the length (lower body), a ring-loft
// greenhouse (windows recessed into real pillars/frames), swept trim (bumpers, tubes,
// moldings), lathed wheels (sidewall/tread texture, multi-spoke rims, discs) and a
// cheap merged interior with a seated driver. One merged mesh per vehicle type with
// material groups; wheels separate; decal (dust, badges, plates) + blob + holes as before.
//
// Material slots (cars):  0 paint · 1 glass · 2 chrome · 3 black plastic · 4 headlight
//   5 taillight · 6 underbody · 7 interior (vertex colours: seats, dash, clothes, hair)
//   8 driver skin (per-instance tone from MAT.skins)
// Tanker: 0 cab paint · 1 glass · 2 chrome · 3 plastic · 4 head · 5 tail · 6 underbody · 7 tank · 8 placard
// Pickup: 0 red · 1 light glass · 2 chrome · 3 plastic · 4 head · 5 tail · 6 diamond · 7 bed liner · 8 interior
// =====================================================================================

const PI = Math.PI;
const V3 = THREE.Vector3;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rIn = (d, r) => (r > 0 && d < r ? r - Math.sqrt(Math.max(0, r * r - (r - d) * (r - d))) : 0);

// ---------- shared materials ----------
export const MAT = {};
export function initMaterials() {
  // deep black clearcoat: dielectric with a high IOR so the sunset env carries the shape
  MAT.paintBlack = new THREE.MeshPhysicalMaterial({ color: 0x0d0e11, metalness: 0.0, roughness: 0.13, ior: 1.9, envMapIntensity: 2.0 });
  MAT.glass = glassMaterial({ color: 0x0c1116, opacity: 0.6, roughness: 0.04, env: 1.6 });
  MAT.glassLight = glassMaterial({ color: 0x1a2229, opacity: 0.3, roughness: 0.03, env: 1.3 });
  MAT.glassCracked = glassMaterial({ color: 0x1a1d22, opacity: 0.88, roughness: 0.3, env: 1.0, emissiveMap: crackedGlassTexture(), emissive: 0x8892a0, emissiveIntensity: 0.35 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xe8e6e2, metalness: 1.0, roughness: 0.1, envMapIntensity: 1.8 });
  MAT.plastic = new THREE.MeshStandardMaterial({ color: 0x18191b, metalness: 0.0, roughness: 0.5, envMapIntensity: 0.9 });
  MAT.headlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 3.0, roughness: 0.2 });
  MAT.taillight = new THREE.MeshStandardMaterial({ color: 0x4a0201, emissive: 0xff0201, emissiveIntensity: 1.05, roughness: 0.2, envMapIntensity: 1.2 });
  MAT.tire = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.0, roughness: 0.92 });
  MAT.tireTread = new THREE.MeshStandardMaterial({ map: tireTexture(), color: 0xffffff, metalness: 0.0, roughness: 0.88, envMapIntensity: 0.6 });
  MAT.rim = new THREE.MeshStandardMaterial({ color: 0xc4c8cf, metalness: 1.0, roughness: 0.18, envMapIntensity: 2.0 });
  MAT.wheelMetal = new THREE.MeshStandardMaterial({ color: 0xd0d2d6, vertexColors: true, metalness: 1.0, roughness: 0.2, envMapIntensity: 2.0 });
  MAT.charred = new THREE.MeshStandardMaterial({ color: 0x0e0b09, metalness: 0.3, roughness: 0.85, emissive: 0x2a0a00, emissiveIntensity: 0.6 });
  // vertex-coloured so the chassis kit (rails, exhaust, tank, spare) reads on flipped wrecks
  MAT.underbody = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.35, roughness: 0.72, envMapIntensity: 0.8 });
  MAT.interior = new THREE.MeshStandardMaterial({ color: 0x8a8580, vertexColors: true, metalness: 0.0, roughness: 0.8, envMapIntensity: 0.35 });
  MAT.skins = [0xd8a283, 0xb57c58, 0x8d5a3b, 0x5e3b27].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, envMapIntensity: 0.6 }));
  // player truck
  MAT.paintRed = new THREE.MeshPhysicalMaterial({ color: 0x7c0d09, metalness: 0.25, roughness: 0.2, ior: 1.7, envMapIntensity: 1.5 });
  const dp = diamondPlateTexture();
  MAT.diamond = new THREE.MeshStandardMaterial({ map: dp.map, normalMap: dp.normal, color: 0xb4b6ba, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.3 });
  const bl = bedLinerTextures();
  MAT.bedLiner = new THREE.MeshStandardMaterial({ map: bl.map, normalMap: bl.normal, normalScale: new THREE.Vector2(0.8, 0.8), color: 0xffffff, metalness: 0.05, roughness: 0.82, envMapIntensity: 0.7 });
  // people (used by other modules)
  MAT.cloth = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.85 });
  MAT.vest = new THREE.MeshStandardMaterial({ color: 0x2d3126, roughness: 0.75 });
  MAT.skin = new THREE.MeshStandardMaterial({ color: 0x9a6a4e, roughness: 0.6 });
  MAT.mask = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.8 });
  MAT.gunMetal = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.75, roughness: 0.38 });
  MAT.lens = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 1, roughness: 0.05, envMapIntensity: 2.5 });
  // civilian paints (index % 3 picks the body style: sedan / hatch / minivan)
  MAT.civ = [0x7a7d80, 0xc9c5bb, 0x23396b, 0x8a6a2c, 0x2f5a3a, 0x9b1c1c, 0xe0dcd2, 0x3a3a3c].map(c => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.35, roughness: 0.26, ior: 1.6, envMapIntensity: 1.3 }));
  MAT.tank = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.7 });
  MAT.truckCab = new THREE.MeshPhysicalMaterial({ color: 0x1d2d57, metalness: 0.3, roughness: 0.2, ior: 1.7, envMapIntensity: 1.5 });
  const pt = placardTexture();
  MAT.placard = new THREE.MeshStandardMaterial({ map: pt, roughness: 0.5, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: 0.15 });
  MAT.blob = new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -1 });
  MAT.hole = new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
}

// Tinted glass with full-strength reflections: premultiplied output (diffuse*alpha + specular),
// so the sunset still streaks across the windows while the interior shows through.
function glassMaterial({ color, opacity, roughness, env, emissiveMap = null, emissive = 0x000000, emissiveIntensity = 1 }) {
  const m = new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness, ior: 1.6, envMapIntensity: env, transparent: true, opacity, emissiveMap, emissive, emissiveIntensity });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.onBeforeCompile = (s) => {
    const fog = THREE.ShaderChunk.fog_fragment
      .replace(/mix\(\s*gl_FragColor\.rgb\s*,\s*fcol\s*,/, 'mix( gl_FragColor.rgb, fcol * gl_FragColor.a,')
      .replace(/mix\(\s*gl_FragColor\.rgb\s*,\s*fogColor\s*,/, 'mix( gl_FragColor.rgb, fogColor * gl_FragColor.a,');
    s.fragmentShader = s.fragmentShader.replace('#include <colorspace_fragment>', '#include <bay_premul_colorspace>')
      .replace('#include <opaque_fragment>', 'gl_FragColor = vec4( totalDiffuse * diffuseColor.a + totalSpecular + totalEmissiveRadiance, diffuseColor.a );')
      .replace('#include <fog_fragment>', fog);
  };
  m.customProgramCacheKey = () => 'bayPremulGlass';
  return m;
}

// ---------- textures ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, { srgb = true, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function heightToNormal(hd, S, k) {
  const nc = canvas(S, S); const nctx = nc.getContext('2d'); const img = nctx.createImageData(S, S);
  const H = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (H(x - 1, y) - H(x + 1, y)) * k, ny = (H(x, y - 1) - H(x, y + 1)) * k, l = Math.hypot(nx, ny, 1);
    const i = (y * S + x) * 4; img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  return nc;
}
function diamondPlateTexture() {
  const S = 256;
  const c = canvas(S, S); const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a8c90'; ctx.fillRect(0, 0, S, S);
  const r = makeRng(77);
  for (let k = 0; k < 2500; k++) { ctx.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0.03)`; ctx.fillRect(r() * S, r() * S, 3, 3); }
  const h = canvas(S, S); const hc = h.getContext('2d'); hc.fillStyle = '#000'; hc.fillRect(0, 0, S, S);
  const step = 32;
  for (let y = 0; y < S + step; y += step) for (let x = 0; x < S + step; x += step) {
    for (const [ox, oy, ang] of [[0, 0, 0.785], [step / 2, step / 2, -0.785]]) {
      hc.save(); hc.translate(x + ox, y + oy); hc.rotate(ang);
      const g = hc.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#888'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, '#888');
      hc.fillStyle = g; hc.beginPath(); hc.ellipse(0, 0, 10, 3, 0, 0, PI * 2); hc.fill(); hc.restore();
      ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(ang); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(0, -1, 9, 2, 0, 0, PI * 2); ctx.fill(); ctx.restore();
    }
  }
  const nc = heightToNormal(hc.getImageData(0, 0, S, S).data, S, 3);
  const map = canvasTex(c, { repeat: true }); map.repeat.set(3, 3);
  const normal = canvasTex(nc, { srgb: false, repeat: true }); normal.repeat.set(3, 3);
  return { map, normal };
}
// spray-in bed liner: speckled black with a pebbly normal map (UVs are in metres)
function bedLinerTextures() {
  const S = 256, r = makeRng(404);
  const c = canvas(S, S); const x = c.getContext('2d');
  x.fillStyle = '#55524e'; x.fillRect(0, 0, S, S);
  for (let k = 0; k < 9000; k++) { const v = 52 + r() * 60 | 0; x.fillStyle = `rgba(${v},${v - 1},${v - 2},${0.35 + r() * 0.5})`; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  // scuffs (boots, crates) — lighter streaks
  for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(120,114,104,${0.06 + r() * 0.12})`; x.lineWidth = 1 + r() * 3; x.beginPath(); const px = r() * S, py = r() * S; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 60, py + (r() - 0.5) * 20); x.stroke(); }
  const h = canvas(S, S); const hc = h.getContext('2d'); hc.fillStyle = '#808080'; hc.fillRect(0, 0, S, S);
  for (let k = 0; k < 5000; k++) { const v = r() * 255 | 0; hc.fillStyle = `rgba(${v},${v},${v},0.6)`; const s = 1 + r() * 3; hc.beginPath(); hc.arc(r() * S, r() * S, s, 0, PI * 2); hc.fill(); }
  const nc = heightToNormal(hc.getImageData(0, 0, S, S).data, S, 1.5);
  const map = canvasTex(c, { repeat: true }); map.repeat.set(1.6, 1.6);
  const normal = canvasTex(nc, { srgb: false, repeat: true }); normal.repeat.set(1.6, 1.6);
  return { map, normal };
}
// tyre: u = around (0..1), v = across the profile (0 inner bead .. 0.3 shoulder .. 0.7 shoulder .. 1 outer bead)
function tireTexture() {
  const W = 1024, H = 256; const c = canvas(W, H); const x = c.getContext('2d');
  const Y = (v) => (1 - v) * H;
  x.fillStyle = '#1d1d1e'; x.fillRect(0, 0, W, H);
  // tread band (slightly lighter, dusty)
  const g = x.createLinearGradient(0, Y(0.72), 0, Y(0.28)); g.addColorStop(0, '#262524'); g.addColorStop(0.5, '#2c2a28'); g.addColorStop(1, '#262524');
  x.fillStyle = g; x.fillRect(0, Y(0.72), W, Y(0.28) - Y(0.72));
  x.fillStyle = '#0b0b0b';
  for (const v of [0.41, 0.5, 0.59]) x.fillRect(0, Y(v) - 2.5, W, 5);
  const n = 64;
  for (let k = 0; k < n; k++) {
    const u = k * W / n;
    x.fillRect(u, Y(0.71), 4, Y(0.61) - Y(0.71));
    x.fillRect(u + W / n / 2, Y(0.585), 3, Y(0.515) - Y(0.585));
    x.fillRect(u, Y(0.485), 3, Y(0.415) - Y(0.485));
    x.fillRect(u + W / n / 2, Y(0.39), 4, Y(0.29) - Y(0.39));
  }
  // shoulder lugs
  x.fillStyle = '#131313';
  for (let k = 0; k < n; k++) { const u = k * W / n; x.fillRect(u + 3, Y(0.78), 6, Y(0.72) - Y(0.78)); x.fillRect(u + 3, Y(0.28), 6, Y(0.22) - Y(0.28)); }
  // sidewall lettering (raised rubber catches light)
  x.textBaseline = 'middle'; x.textAlign = 'left';
  for (const u0 of [0.02, 0.52]) {
    x.fillStyle = '#4a4a4a'; x.font = '700 34px Oswald, Impact, sans-serif'; x.fillText('BAYSTONE', u0 * W, Y(0.87));
    x.fillStyle = '#3a3a3a'; x.font = '500 20px Oswald, sans-serif'; x.fillText('DUELER H/T   275/55 R20', u0 * W + 190, Y(0.87));
  }
  // rim protector line
  x.fillStyle = '#2a2a2a'; x.fillRect(0, Y(0.95) - 2, W, 3); x.fillRect(0, Y(0.05) - 2, W, 3);
  return canvasTex(c);
}
function placardTexture() {
  const S = 256; const c = canvas(S, S); const x = c.getContext('2d');
  x.fillStyle = '#f2efe8'; x.fillRect(0, 0, S, S);
  x.save(); x.translate(S / 2, S / 2); x.rotate(PI / 4);
  const s = S / Math.SQRT2;
  x.fillStyle = '#d42619'; x.fillRect(-s / 2 + 8, -s / 2 + 8, s - 16, s - 16);
  x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeRect(-s / 2 + 14, -s / 2 + 14, s - 28, s - 28);
  x.restore();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  // flame glyph
  x.beginPath(); x.moveTo(128, 34); x.bezierCurveTo(150, 60, 150, 78, 138, 92); x.bezierCurveTo(146, 76, 134, 66, 128, 60); x.bezierCurveTo(124, 72, 110, 78, 116, 92); x.bezierCurveTo(100, 78, 106, 56, 128, 34); x.fill();
  x.font = '400 30px Anton, Impact, sans-serif'; x.fillText('FLAMMABLE', 128, 124);
  x.font = '700 30px Oswald, sans-serif'; x.fillText('1203', 128, 160);
  x.font = '700 22px Oswald, sans-serif'; x.fillText('3', 128, 214);
  return canvasTex(c);
}

// =====================================================================================
// geometry kit
// =====================================================================================
const _col = new THREE.Color();
const KEEP = ['position', 'normal', 'uv', 'color'];
function prep(g, col) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.color) {
    _col.set(col);
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = _col.r; a[i * 3 + 1] = _col.g; a[i * 3 + 2] = _col.b; }
    g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}
class Kit {
  constructor(defaults = {}) { this.parts = []; this.def = { 6: 0x3d3730, ...defaults }; }
  add(g, m, col) { this.parts.push([prep(g, col ?? this.def[m] ?? 0xffffff), m]); return this; }
  build() {
    const by = new Map();
    for (const [g, m] of this.parts) { if (!by.has(m)) by.set(m, []); by.get(m).push(g); }
    const mats = [...by.keys()].sort((a, b) => a - b);
    const merged = mergeGeometries(mats.map(m => mergeGeometries(by.get(m), false)), true);
    merged.groups.forEach((gr, i) => { gr.materialIndex = mats[i]; });
    // re-index: shared vertices across smooth lofts cut the vertex count ~3x (Quest vertex/binning cost)
    const out = mergeVertices(merged, 1e-5);
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }
}
class TriBuf {
  constructor(col = 0xffffff) { this.p = []; this.n = []; this.u = []; _col.set(col); this.c = [_col.r, _col.g, _col.b]; }
  v([p, n, u]) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.u.push(u[0], u[1]); }
  tri(a, b, c) { this.v(a); this.v(b); this.v(c); }
  flat(p0, p1, p2, uv = [0, 0]) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2], bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const n = [nx, ny, nz]; this.tri([p0, n, uv], [p1, n, uv], [p2, n, uv]);
  }
  get empty() { return this.p.length === 0; }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    const n = this.p.length / 3, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = this.c[0]; c[i * 3 + 1] = this.c[1]; c[i * 3 + 2] = this.c[2]; }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    return g;
  }
}

// grid of rings (i along the loft, j around each ring). Smooth normals, auto outward orientation.
function grid(rings, closed = false, sign = 0) {
  const nI = rings.length, nJ = rings[0].length;
  const P = new Float32Array(nI * nJ * 3), N = new Float32Array(nI * nJ * 3);
  for (let i = 0; i < nI; i++) {
    const r = rings[i];
    if (r.length !== nJ) throw new Error(`ring ${i} has ${r.length} points, expected ${nJ}`);
    for (let j = 0; j < nJ; j++) { const k = (i * nJ + j) * 3; P[k] = r[j][0]; P[k + 1] = r[j][1]; P[k + 2] = r[j][2]; }
  }
  const jN = closed ? nJ : nJ - 1;
  const id = (i, j) => i * nJ + (((j % nJ) + nJ) % nJ);
  const acc = (a, b, c) => {
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    N[a * 3] += nx; N[a * 3 + 1] += ny; N[a * 3 + 2] += nz;
    N[b * 3] += nx; N[b * 3 + 1] += ny; N[b * 3 + 2] += nz;
    N[c * 3] += nx; N[c * 3 + 1] += ny; N[c * 3 + 2] += nz;
  };
  for (let i = 0; i < nI - 1; i++) for (let j = 0; j < jN; j++) {
    const a = id(i, j), b = id(i, j + 1), c = id(i + 1, j), d = id(i + 1, j + 1);
    acc(a, c, b); acc(b, c, d);
  }
  for (let k = 0; k < nI * nJ; k++) {
    const l = Math.hypot(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]);
    if (l < 1e-12) { N[k * 3 + 1] = 1; continue; }
    N[k * 3] /= l; N[k * 3 + 1] /= l; N[k * 3 + 2] /= l;
  }
  if (!sign) {
    let s = 0;
    for (let i = 0; i < nI; i++) {
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < nJ; j++) { const k = id(i, j) * 3; cx += P[k]; cy += P[k + 1]; cz += P[k + 2]; }
      cx /= nJ; cy /= nJ; cz /= nJ;
      for (let j = 0; j < nJ; j++) { const k = id(i, j) * 3; s += N[k] * (P[k] - cx) + N[k + 1] * (P[k + 1] - cy) + N[k + 2] * (P[k + 2] - cz); }
    }
    sign = s >= 0 ? 1 : -1;
  }
  if (sign < 0) for (let k = 0; k < N.length; k++) N[k] = -N[k];
  const U = new Float32Array(nI * nJ), Vv = new Float32Array(nI * nJ), Uend = new Float32Array(nI);
  const dist = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  for (let i = 0; i < nI; i++) {
    let a = 0;
    for (let j = 0; j < nJ; j++) { if (j) a += dist(id(i, j - 1), id(i, j)); U[id(i, j)] = a; }
    Uend[i] = closed ? a + dist(id(i, nJ - 1), id(i, 0)) : a;
  }
  for (let j = 0; j < nJ; j++) { let a = 0; for (let i = 0; i < nI; i++) { if (i) a += dist(id(i - 1, j), id(i, j)); Vv[id(i, j)] = a; } }
  return { P, N, U, V: Vv, Uend, nI, nJ, jN, closed, sign, id };
}

// Emit a grid into the kit. o.mat(i,j) -> material index | -1 (skip) | {m, d (inset), skip, col}
// Recessed quads get walls (o.wallMat), o.inner adds an inward-facing shell for interiors.
function emitGrid(kit, G, o = {}) {
  const { P, N, U, V, Uend, nI, nJ, jN, closed, sign, id } = G;
  const us = o.uvScale || 1;
  const Q = (i, j) => {
    if (i < 0 || i >= nI - 1) return null;
    if (closed) j = ((j % jN) + jN) % jN; else if (j < 0 || j >= jN) return null;
    let r = o.mat ? o.mat(i, j) : (o.m ?? 0);
    if (typeof r === 'number') r = r < 0 ? { skip: true, d: 0 } : { m: r, d: 0 };
    if (r.d === undefined) r = { ...r, d: 0 };
    return r;
  };
  const bufs = new Map();
  const buf = (m, col) => { const key = m + ':' + col; let b = bufs.get(key); if (!b) { b = { m, t: new TriBuf(col) }; bufs.set(key, b); } return b.t; };
  const pd = (k, d) => [P[k * 3] - N[k * 3] * d, P[k * 3 + 1] - N[k * 3 + 1] * d, P[k * 3 + 2] - N[k * 3 + 2] * d];
  const nn = (k, s) => [N[k * 3] * s, N[k * 3 + 1] * s, N[k * 3 + 2] * s];
  const uvOf = (i, j) => {
    const k = id(i, j);
    if (o.uv) return o.uv(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], i, j);
    const u = (closed && j === nJ) ? Uend[i] : U[k];
    return [u / us, V[k] / us];
  };
  const defCol = (m) => (o.col ? o.col(m) : 0xffffff);
  for (let i = 0; i < nI - 1; i++) for (let j = 0; j < jN; j++) {
    const q = Q(i, j); if (!q) continue;
    const cs = [[i, j], [i, j + 1], [i + 1, j], [i + 1, j + 1]];
    if (!q.skip) {
      const T = buf(q.m, q.col ?? defCol(q.m));
      const [a, b, c, d] = cs.map(([ii, jj]) => { const k = id(ii, jj); return [pd(k, q.d), nn(k, 1), uvOf(ii, jj)]; });
      if (sign > 0) { T.tri(a, c, b); T.tri(b, c, d); } else { T.tri(a, b, c); T.tri(b, d, c); }
      if (o.inner && o.inner.test(q)) {
        const T2 = buf(o.inner.m, o.inner.col ?? 0xffffff);
        const [a2, b2, c2, d2] = cs.map(([ii, jj]) => { const k = id(ii, jj); return [pd(k, o.inner.d), nn(k, -1), uvOf(ii, jj)]; });
        if (sign > 0) { T2.tri(a2, b2, c2); T2.tri(b2, d2, c2); } else { T2.tri(a2, c2, b2); T2.tri(b2, c2, d2); }
      }
    }
    if (o.wallMat && q.d > 0) {
      const ctr = [0, 0, 0];
      for (const [ii, jj] of cs) { const p = pd(id(ii, jj), q.d); ctr[0] += p[0] / 4; ctr[1] += p[1] / 4; ctr[2] += p[2] / 4; }
      const edges = [[[i, j], [i, j + 1], Q(i - 1, j)], [[i + 1, j], [i + 1, j + 1], Q(i + 1, j)], [[i, j], [i + 1, j], Q(i, j - 1)], [[i, j + 1], [i + 1, j + 1], Q(i, j + 1)]];
      for (const [e0, e1, nb] of edges) {
        if (!nb) continue;
        const dn = nb.d || 0; if (dn >= q.d - 1e-6) continue;
        const wm = o.wallMat(q, nb); if (wm < 0) continue;
        const k0 = id(...e0), k1 = id(...e1);
        const o0 = pd(k0, dn), o1 = pd(k1, dn), i0 = pd(k0, q.d), i1 = pd(k1, q.d);
        const ux = o1[0] - o0[0], uy = o1[1] - o0[1], uz = o1[2] - o0[2], vx = i0[0] - o0[0], vy = i0[1] - o0[1], vz = i0[2] - o0[2];
        const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
        const mx = ctr[0] - (o0[0] + o1[0]) / 2, my = ctr[1] - (o0[1] + o1[1]) / 2, mz = ctr[2] - (o0[2] + o1[2]) / 2;
        const T = buf(wm, defCol(wm));
        if (fx * mx + fy * my + fz * mz >= 0) { T.flat(o0, o1, i0); T.flat(o1, i1, i0); } else { T.flat(o0, i0, o1); T.flat(o1, i0, i1); }
      }
    }
  }
  for (const { m, t } of bufs.values()) if (!t.empty) kit.add(t.geo(), m);
}
// polygon cap (ear-clipped) facing `normal`
function cap(kit, ring, m, normal, col = 0xffffff, holeRings = []) {
  const n = new V3(...normal).normalize();
  const a = Math.abs(n.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0);
  const e1 = new V3().crossVectors(a, n).normalize(), e2 = new V3().crossVectors(n, e1);
  const pts = [], c2 = [];
  for (const p of ring) {
    const q = new THREE.Vector2(p[0] * e1.x + p[1] * e1.y + p[2] * e1.z, p[0] * e2.x + p[1] * e2.y + p[2] * e2.z);
    if (c2.length && q.distanceTo(c2[c2.length - 1]) < 1e-5) continue;
    c2.push(q); pts.push(p);
  }
  if (c2.length > 2 && c2[0].distanceTo(c2[c2.length - 1]) < 1e-5) { c2.pop(); pts.pop(); }
  const holes2 = holeRings.map(h => h.map(p => { const q = new THREE.Vector2(p[0] * e1.x + p[1] * e1.y + p[2] * e1.z, p[0] * e2.x + p[1] * e2.y + p[2] * e2.z); pts.push(p); c2.push(q); return q; }));
  const contour = c2.slice(0, c2.length - holes2.reduce((a, h) => a + h.length, 0));
  const tris = THREE.ShapeUtils.triangulateShape(contour, holes2);
  const T = new TriBuf(col); const nv = [n.x, n.y, n.z];
  for (const [i0, i1, i2] of tris) {
    const p0 = pts[i0], p1 = pts[i1], p2 = pts[i2];
    const cr = new V3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).cross(new V3(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]));
    const A = [p0, nv, [c2[i0].x, c2[i0].y]], B = [p1, nv, [c2[i1].x, c2[i1].y]], C = [p2, nv, [c2[i2].x, c2[i2].y]];
    if (cr.dot(n) >= 0) T.tri(A, B, C); else T.tri(A, C, B);
  }
  if (!T.empty) kit.add(T.geo(), m);
}
// sweep a 2D profile [a = outward, b = up] along a path. ref = 'up' hint (null = parallel transport)
function sweepRings(path, profile, ref = [0, 1, 0], scale = null) {
  const rings = []; let prevU = null;
  const P = path.map(p => new V3(...p));
  for (let k = 0; k < P.length; k++) {
    const T = new V3().subVectors(P[Math.min(P.length - 1, k + 1)], P[Math.max(0, k - 1)]).normalize();
    let U;
    if (ref) { const R = new V3(...ref); U = R.addScaledVector(T, -T.dot(R)); if (U.lengthSq() < 1e-8) U = prevU ? prevU.clone() : new V3(1, 0, 0); U.normalize(); }
    else if (!prevU) { const A = Math.abs(T.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0); U = A.addScaledVector(T, -T.dot(A)).normalize(); }
    else { U = prevU.clone().addScaledVector(T, -T.dot(prevU)).normalize(); }
    prevU = U;
    const O = new V3().crossVectors(U, T);
    const s = scale ? scale(k / (P.length - 1)) : 1;
    rings.push(profile.map(([a, b]) => [P[k].x + (O.x * a + U.x * b) * s, P[k].y + (O.y * a + U.y * b) * s, P[k].z + (O.z * a + U.z * b) * s]));
  }
  return rings;
}
function sweep(kit, path, profile, m, { ref = [0, 1, 0], closed = true, caps = true, col = 0xffffff, scale = null, sign = 0 } = {}) {
  const rings = sweepRings(path, profile, ref, scale);
  const G = grid(rings, closed, sign);
  emitGrid(kit, G, { m, col: () => col });
  if (caps && closed) {
    const t0 = new V3(...path[0]).sub(new V3(...path[1])).normalize();
    const t1 = new V3(...path[path.length - 1]).sub(new V3(...path[path.length - 2])).normalize();
    cap(kit, rings[0], m, t0.toArray(), col); cap(kit, rings[rings.length - 1], m, t1.toArray(), col);
  }
}
const circle = (r, n, ox = 0, oy = 0) => { const a = []; for (let k = 0; k < n; k++) { const t = (k / n) * PI * 2; a.push([ox + Math.cos(t) * r, oy + Math.sin(t) * r]); } return a; };
function tube(kit, path, r, m, seg = 8, opts = {}) { sweep(kit, path, circle(r, seg), m, { ref: null, ...opts }); }
// rounded corner path helpers
function arcPts(cx, cy, r, a0, a1, n) { const o = []; for (let k = 0; k <= n; k++) { const a = lerp(a0, a1, k / n); o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; }
// lathe around the X axis: profile [[x(axial), r]] -> rings (i = profile, j = around, open seam for UVs)
function latheRings(profile, seg) {
  return profile.map(([x, r]) => { const ring = []; for (let j = 0; j <= seg; j++) { const a = (j / seg) * PI * 2; ring.push([x, Math.cos(a) * r, Math.sin(a) * r]); } return ring; });
}
// chamfered box (44 tris): bevels catch the env highlight like a rounded edge at a fraction of the cost
const _cbCache = new Map();
function RBox(w, h, d, r = 0.02) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const key = [w, h, d, r].map(v => v.toFixed(4)).join(',');
  let g = _cbCache.get(key);
  if (!g) {
    const a = w / 2, b = h / 2, c = d / 2, pts = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push(new V3(sx * a, sy * (b - r), sz * (c - r)), new V3(sx * (a - r), sy * b, sz * (c - r)), new V3(sx * (a - r), sy * (b - r), sz * c));
    g = new ConvexGeometry(pts); _cbCache.set(key, g);
  }
  return g.clone();
}
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function place(g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), typeof s === 'number' ? new V3(s, s, s) : new V3(...s));
  g.applyMatrix4(m); return g;
}
function warpBox(fn) {
  const g = new THREE.BoxGeometry(1, 1, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, q[0], q[1], q[2]); }
  g.deleteAttribute('normal'); g.computeVertexNormals(); return g;
}
function limb(a, b, r0, r1 = r0, seg = 6, open = true) {
  const A = new V3(...a), B = new V3(...b); const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, open);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), B.clone().sub(A).normalize()));
  const m = A.add(B).multiplyScalar(0.5); g.translate(m.x, m.y, m.z); return g;
}
// cylinder along X / Z
const cylX = (r, len, seg = 12, open = false) => new THREE.CylinderGeometry(r, r, len, seg, 1, open).rotateZ(PI / 2);
const cylZ = (r, len, seg = 12, open = false) => new THREE.CylinderGeometry(r, r, len, seg, 1, open).rotateX(PI / 2);
const sphere = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
// mirror both sides helper
function both(fn) { fn(1); fn(-1); }

// =====================================================================================
// LOWER BODY LOFT
// =====================================================================================
// half-section point roles (19 points, bottom-centre -> top-centre); band j = j -> j+1
const LB_BANDS = ['skip', 'liner', 'liner', 'liner', 'lip', 'rocker', 'side', 'side', 'side', 'side', 'crease', 'side', 'side', 'top', 'reg', 'reg', 'reg', 'reg'];
function bodyModel(B) {
  const flareAt = (z, y) => {
    let f = 0;
    for (const ax of B.axles) {
      if (y < B.archY - 0.06) continue;
      const d = Math.hypot(z - ax, y - B.archY);
      const k = clamp01(1 - (d - B.archR) / (B.flareW || 0.24));
      f = Math.max(f, k * k * (3 - 2 * k));
    }
    return f * B.flare;
  };
  const archTop = (z) => { let ya = B.sill; for (const ax of B.axles) { const dz = z - ax; if (Math.abs(dz) < B.archR) ya = Math.max(ya, B.archY + Math.sqrt(B.archR * B.archR - dz * dz)); } return ya; };
  const regionAt = (z) => (z < B.cowlZ - 1e-6 ? 'hood' : z > B.deckZ + 1e-6 ? 'deck' : 'cabin');
  const frame = (z, region) => {
    const dF = z - B.L0, dR = B.L1 - z;
    const pin = rIn(dF, B.cornerF) + rIn(dR, B.cornerR);
    const W = B.W - pin;
    let top;
    if (region === 'hood') { const s = clamp01((z - B.L0) / (B.cowlZ - B.L0)); top = lerp(B.hoodFront, B.cowl, 1 - (1 - s) * (1 - s)); }
    else if (region === 'cabin') top = B.belt + (B.beltRise || 0) * clamp01((z - B.cowlZ) / (B.deckZ - B.cowlZ));
    else top = B.deckY + (B.deckDrop || 0) * clamp01((z - B.deckZ) / (B.L1 - B.deckZ));
    top -= rIn(dF, B.noseR) + rIn(dR, B.tailR);
    const yb = B.yb + rIn(dF, B.chinF) + rIn(dR, B.chinR);
    const ya = Math.max(archTop(z), yb + 0.08) + (rIn(dF, B.chinF) + rIn(dR, B.chinR)) * 0.6;
    const sh = Math.min(B.shoulder + (B.shoulderRise || 0) * clamp01((z - B.L0) / (B.L1 - B.L0)), top - 0.05);
    return { W, top, yb, ya, sh, dF, dR };
  };
  const xs = (z, y, F) => {
    let x = F.W + flareAt(z, y);
    if (y <= F.sh) x -= (B.rockerTuck ?? 0.05) * sstep(B.sill + 0.24, B.sill - 0.02, y) + 0.012 * clamp01((F.sh - y) / Math.max(0.05, F.sh - B.sill));
    else x -= B.tumble * Math.pow(clamp01((y - F.sh) / Math.max(0.02, F.top - F.sh)), 1.25);
    return x;
  };
  const section = (z, region) => {
    const F = frame(z, region);
    const { ya, sh, top, yb } = F;
    const X = (y) => xs(z, y, F);
    const xin = Math.min(B.xin, F.W - 0.14);
    const p = [[0, yb], [xin, yb], [xin, ya - 0.03], [X(ya) - 0.07, ya], [X(ya) - 0.008, ya], [X(ya + 0.014), ya + 0.014]];
    const yr = Math.min(ya + 0.06, lerp(ya, sh, 0.4));
    const y7 = lerp(yr, sh, 0.45), y8 = lerp(yr, sh, 0.82);
    p.push([X(yr), yr], [X(y7), y7], [X(y8), y8], [X(sh - 0.014), sh - 0.014], [X(sh) + 0.005, sh], [X(sh) + 0.005, sh]);
    const y11 = lerp(sh, top, 0.5);
    p.push([X(y11), y11], [X(top), top]);
    const xt = X(top);
    if (region === 'cabin') {
      const fl = B.floorY;
      const tub = ya > B.sill + 0.02 ? Math.min(top - 0.12, ya + 0.04) : fl + 0.06;
      p.push([xt - 0.045, top], [xt - 0.06, top - 0.05], [xt - 0.07, Math.max(fl + 0.06, tub)], [0.35, fl], [0, fl]);
    } else {
      const cr = region === 'hood' ? B.hoodCrown : (B.deckCrown || 0);
      const bu = region === 'hood' ? (B.hoodBulge || 0) : 0;
      p.push([xt - 0.03, top + 0.013], [xt - 0.12, top + 0.022 + cr * 0.15], [F.W * 0.6, top + 0.022 + cr * 0.55], [F.W * 0.28, top + 0.022 + cr * 0.9 + bu], [0, top + 0.022 + cr + bu * 0.6]);
    }
    return p;
  };
  const skinX = (z, y) => { const F = frame(z, regionAt(z)); return xs(z, Math.min(y, F.top), F); };
  return { B, frame, xs, section, skinX, regionAt, archTop, flareAt };
}
function stationsFor(B) {
  const zs = [];
  const add = (z, seam = null) => { if (z >= B.L0 - 1e-6 && z <= B.L1 + 1e-6) zs.push({ z, seam }); };
  const endD = [0, 0.012, 0.045, 0.1, 0.18, 0.28];
  const rf = Math.max(B.cornerF, B.noseR, B.chinF), rr = Math.max(B.cornerR, B.tailR, B.chinR);
  for (const d of endD) { if (d <= rf + 0.02) add(B.L0 + d); if (d <= rr + 0.02) add(B.L1 - d); }
  for (const ax of B.axles) {
    for (let k = 0; k <= 6; k++) add(ax - B.archR * Math.cos((k / 6) * PI));
    for (const e of [0.12]) { add(ax - B.archR - e); add(ax + B.archR + e); }
  }
  add(B.cowlZ); add(B.deckZ);
  zs.sort((a, b) => a.z - b.z);
  const out = [];
  for (const s of zs) { const last = out[out.length - 1]; if (last && s.z - last.z < 0.0025) { if (s.seam) last.seam = s.seam; continue; } out.push(s); }
  const filled = [];
  for (let k = 0; k < out.length; k++) {
    filled.push(out[k]);
    if (k < out.length - 1) { const gap = out[k + 1].z - out[k].z; const n = Math.floor(gap / 0.5); for (let q = 1; q <= n; q++) filled.push({ z: out[k].z + (gap * q) / (n + 1), seam: null }); }
  }
  const st = [];
  for (const s of filled) {
    if (Math.abs(s.z - B.cowlZ) < 1e-6) { st.push({ ...s, region: 'hood' }, { ...s, region: 'cabin', seam: null }); continue; }
    if (Math.abs(s.z - B.deckZ) < 1e-6) { st.push({ ...s, region: 'cabin' }, { ...s, region: 'deck', seam: null }); continue; }
    st.push({ ...s, region: s.z < B.cowlZ ? 'hood' : s.z > B.deckZ ? 'deck' : 'cabin' });
  }
  return st;
}
const mirrorRing = (half) => { const R = half.length; const out = half.slice(); for (let j = R - 2; j >= 1; j--) out.push([-half[j][0], half[j][1], half[j][2]]); return out; };
const mirrorBand = (R, k) => (k < R - 1 ? k : 2 * R - 3 - k);

// lower body -> kit; returns model + grid for decals
function lowerBody(kit, BM, o = {}) {
  const { B } = BM;
  const st = stationsFor(B);
  const R = 19;
  const rings = st.map(s => {
    const half = BM.section(s.z, s.region).map(([x, y]) => [x, y, s.z]);
    if (s.seam && s.region === 'cabin') {
      for (let j = 5; j <= 13; j++) if (half[j][1] > (s.seam.y0 ?? 0) && half[j][1] < BM.frame(s.z, s.region).top - 0.004) half[j][0] -= 0.007;
    }
    return mirrorRing(half);
  });
  const G = grid(rings, true);
  const PAINT = 0, LINER = o.linerMat ?? 3, INT = o.intM ?? 7;
  const mat = (i, j) => {
    const band = LB_BANDS[mirrorBand(R, j)];
    const r0 = st[i].region, r1 = st[i + 1].region;
    if (band === 'skip') return -1;
    if (band === 'liner') return (BM.archTop(st[i].z) > B.sill + 0.005 || BM.archTop(st[i + 1].z) > B.sill + 0.005) ? LINER : -1;
    if (band === 'rocker') return o.rockerMat ?? PAINT;
    if (band === 'reg') { if (r0 !== r1) return INT; return r0 === 'cabin' ? { m: INT, col: o.intCol ?? 0x202022 } : PAINT; }
    if (band === 'top' && r0 !== r1) return INT;
    return PAINT;
  };
  emitGrid(kit, G, { mat, col: (m) => (m === INT ? (o.intCol ?? 0x202022) : 0xffffff) });
  cap(kit, rings[0], o.capMat ?? PAINT, [0, 0, -1]);
  cap(kit, rings[rings.length - 1], o.capMat ?? PAINT, [0, 0, 1]);
  // flat underbody (the loft's bottom band is skipped — never seen, saves tris)
  const ub = Box(B.xin * 2 + 0.02, 0.06, B.L1 - B.L0 - 0.6); place(ub, 0, B.yb + 0.03, (B.L0 + B.L1) / 2); kit.add(ub, o.underMat ?? 6);
  return { G, st, R };
}
// side decal quads from the lower-body grid (lip..upper side bands), offset off the paint
function sideDecal(T, LB, z0, z1, uvFn) {
  const { G, st, R } = LB; const { P, N, nI, nJ, sign, id } = G;
  const off = 0.0035;
  const pd = (k) => [P[k * 3] + N[k * 3] * off, P[k * 3 + 1] + N[k * 3 + 1] * off, P[k * 3 + 2] + N[k * 3 + 2] * off];
  const nrm = (k) => [N[k * 3], N[k * 3 + 1], N[k * 3 + 2]];
  for (let i = 0; i < nI - 1; i++) {
    if (st[i].z < z0 || st[i + 1].z > z1) continue;
    for (let j = 0; j < nJ; j++) {
      const band = mirrorBand(R, j); if (band < 4 || band > 12) continue;
      const cs = [[i, j], [i, j + 1], [i + 1, j], [i + 1, j + 1]].map(([a, b]) => { const k = id(a, b); const p = pd(k); return [p, nrm(k), uvFn(p)]; });
      const [a, b, c, d] = cs;
      if (sign > 0) { T.tri(a, c, b); T.tri(b, c, d); } else { T.tri(a, b, c); T.tri(b, d, c); }
    }
  }
}

// =====================================================================================
// GREENHOUSE (horizontal ring loft: windscreen rake, pillars, recessed glass, roof, hatch)
// =====================================================================================
function greenhouse(kit, Gp) {
  const nC = Gp.cuts.length;
  const ringAt = (t, inset = 0, dy = 0) => {
    const hw = Gp.hw(t) - inset, zf = Gp.zf(t) + inset, zr = Gp.zr(t) - inset;
    const rf = Math.max(0.03, Gp.rf(t) - inset * 0.7), rr = Math.max(0.03, Gp.rr(t) - inset * 0.7);
    const y = lerp(Gp.y0, Gp.y1, t) + dy;
    const pts = [], kinds = [];
    const xf = hw - rf, xr = hw - rr;
    for (const s of [0, 0.36, 0.7]) { pts.push([xf * s, y, zf - Gp.bowF * (1 - s * s)]); kinds.push({ k: 'front' }); }
    for (let k = 0; k <= 3; k++) { const a = -PI / 2 + (k / 3) * (PI / 2); pts.push([xf + rf * Math.cos(a), y, zf + rf + rf * Math.sin(a)]); kinds.push(k < 3 ? { k: 'cornerF' } : { k: 'side', s: 0 }); }
    const zA = zf + rf, zB = zr - rr;
    Gp.cuts.forEach((c, i) => { pts.push([hw, y, Math.min(zB - 0.01, Math.max(zA + 0.01, c))]); kinds.push({ k: 'side', s: i + 1 }); });
    for (let k = 0; k <= 3; k++) { const a = (k / 3) * (PI / 2); pts.push([xr + rr * Math.cos(a), y, zB + rr * Math.sin(a)]); kinds.push(k < 3 ? { k: 'cornerR' } : { k: 'rear' }); }
    for (const s of [0.7, 0.36]) { pts.push([xr * s, y, zr + Gp.bowR * (1 - s * s)]); kinds.push({ k: 'rear' }); }
    pts.push([0, y, zr + Gp.bowR]); kinds.push({ k: 'end' });
    return { pts, kinds };
  };
  const hw1 = Gp.hw(1);
  const roofY = (x, z) => Gp.y1 + 0.036 + Gp.crown * (1 - Math.min(1, (x / hw1) ** 2)) + (Gp.roofSlope ? Gp.roofSlope(z) : 0);
  const base = ringAt(0);
  const Rn = base.pts.length;
  const rings = Gp.ts.map(t => mirrorRing(ringAt(t).pts));
  const nT = rings.length;
  const e1 = ringAt(1, 0.028, 0.022).pts, e2 = ringAt(1, 0.075, 0.034).pts;
  for (const e of [e1, e2]) for (const p of e) p[1] = Math.min(p[1], roofY(p[0], p[2]) - 0.002) * 0 + roofY(p[0], p[2]) - (e === e1 ? 0.014 : 0.002);
  rings.push(mirrorRing(e1), mirrorRing(e2));
  const H = Gp.hatch;
  const cz = H ? H.cz : (Gp.zf(1) + Gp.zr(1)) / 2, hx = H ? H.hx : 0.03, hz = H ? H.hz : 0.06;
  const proj = (p) => { const dx = p[0], dz = p[2] - cz; const s = Math.min(hx / Math.max(1e-4, Math.abs(dx)), hz / Math.max(1e-4, Math.abs(dz))); return [dx * s, dz * s + cz]; };
  const hole = e2.map(p => { const [x, z] = proj(p); return [x, roofY(x, z), z]; });
  const mid = e2.map((p, k) => { const x = lerp(p[0], hole[k][0], 0.5), z = lerp(p[2], hole[k][2], 0.5); return [x, roofY(x, z), z]; });
  rings.push(mirrorRing(mid), mirrorRing(hole));
  if (H) rings.push(mirrorRing(hole.map(p => [p[0], p[1] - 0.07, p[2]])));
  else cap(kit, mirrorRing(hole), Gp.body ?? 0, [0, 1, 0]);
  const G = grid(rings, true);
  const kinds = base.kinds;
  const BODY = { m: Gp.body ?? 0, d: 0 }, GL = { m: 1, d: Gp.glassDepth ?? 0.014, glass: true }, OPEN = { skip: true, d: Gp.openDepth ?? 0.07 }, TRIM = { m: 3, d: 0.006 };
  const PILLAR = Gp.pillar !== undefined ? { m: Gp.pillar, d: 0 } : BODY;
  const ROOF = { m: Gp.body ?? 0, d: 0, roof: true };
  const roofBands = rings.length - 1 - (nT - 1);
  const mat = (i, j) => {
    const kd = kinds[mirrorBand(Rn, j)];
    if (i >= nT - 1) { if (H && i === rings.length - 2) return { m: 3, d: 0, roof: true }; return ROOF; }
    const inG = i >= Gp.gi0 && i < Gp.gi1;
    switch (kd.k) {
      case 'front': return inG && Gp.windscreen !== false ? GL : BODY;
      case 'cornerF': return PILLAR;
      case 'side': { const s = Gp.sides[kd.s]; if (!inG) return BODY; if (s === 'glass') return GL; if (s === 'open') return OPEN; if (s === 'trim') return TRIM; return s === 'pillar' ? PILLAR : BODY; }
      case 'cornerR': return PILLAR;
      case 'rear': return inG && Gp.rearGlass !== false ? GL : BODY;
      default: return BODY;
    }
  };
  void roofBands;
  const IM = Gp.intM ?? 7;
  emitGrid(kit, G, {
    mat, wallMat: () => 3, col: (m) => (m === IM ? Gp.liner ?? 0x2a2a2c : 0xffffff),
    inner: { test: (q) => !q.skip && !q.glass && !q.roof, m: IM, d: 0.016, col: Gp.liner ?? 0x2a2a2c },
  });
  // headliner: one downward cap under the roof (with the hatch opening)
  const hl = mirrorRing(ringAt(1, 0.03, -0.02).pts);
  cap(kit, hl, IM, [0, -1, 0], Gp.liner ?? 0x2a2a2c, H ? [mirrorRing(hole.map(p => [p[0], Gp.y1 - 0.02, p[2]])).reverse()] : []);
  return { ringAt, roofY, hw1 };
}

// =====================================================================================
// WHEELS
// =====================================================================================
function wheelGeometry(o) {
  const { R, w, rimR, style = 'split6', seg = 16, dual = false } = o;
  const kit = new Kit();
  const h = w / 2, sw = R - rimR;
  // --- tyre (group 0) ---
  let prof, vs;
  if (!dual) {
    prof = [[-h + 0.02, rimR + 0.012], [-h - 0.006, rimR + sw * 0.4], [-h + 0.006, R - sw * 0.16], [-h + 0.03, R - 0.012], [-h + 0.065, R],
      [h - 0.065, R], [h - 0.03, R - 0.012], [h - 0.006, R - sw * 0.16], [h + 0.006, rimR + sw * 0.4], [h - 0.02, rimR + 0.012]];
    vs = [0, 0.12, 0.24, 0.285, 0.33, 0.67, 0.715, 0.76, 0.88, 1.0];
  } else {
    const g = 0.02;
    prof = [[-h + 0.02, rimR + 0.012], [-h - 0.004, rimR + sw * 0.45], [-h + 0.02, R - 0.015], [-h + 0.05, R], [-g - 0.04, R], [-g, R - 0.03], [-g, rimR + 0.05], [g, rimR + 0.05], [g, R - 0.03], [g + 0.04, R], [h - 0.05, R], [h - 0.02, R - 0.015], [h + 0.004, rimR + sw * 0.45], [h - 0.02, rimR + 0.012]];
    vs = [0, 0.15, 0.28, 0.33, 0.45, 0.48, 0.5, 0.5, 0.52, 0.55, 0.67, 0.72, 0.85, 1.0];
  }
  {
    const G = grid(latheRings(prof, seg), false, -1);
    emitGrid(kit, G, { m: 0, uv: (x, y, z, i, j) => [(j / seg) * (R > 0.5 ? 2 : 1), vs[i]] });
  }
  // --- rim (group 1, vertex coloured metal) ---
  const CH = 0xffffff, DARK = o.rimDark ?? 0x2a2b2e, DISC = 0x6a6866, CAP = o.capCol ?? 0x18191b;
  const face = o.faceCol ?? CH;
  {
    const rp = [[h - 0.01, rimR + 0.016], [h + 0.006, rimR + 0.006], [h + 0.004, rimR - 0.014], [h - 0.04, rimR - 0.028], [-h + 0.03, rimR - 0.03]];
    const G = grid(latheRings(rp, seg), false, -1);
    emitGrid(kit, G, { m: 1, col: () => (o.lipCol ?? CH) });
  }
  const spokeAt = (phi, w0, w1, th, x0, x1, r0, r1, col, bend = 1.4) => {
    const g = warpBox((sx, sy, sz) => {
      const t = sy + 0.5; const r = lerp(r0, r1, t);
      const ax = lerp(x0, x1, Math.pow(t, bend)) + sx * th;
      const tw = sz * lerp(w0, w1, t);
      return [ax, r * Math.cos(phi) - tw * Math.sin(phi), r * Math.sin(phi) + tw * Math.cos(phi)];
    });
    kit.add(g, 1, col);
  };
  const hubR = o.hubR ?? 0.075;
  if (style === 'split6') {
    for (let k = 0; k < 6; k++) { const p = (k / 6) * PI * 2; for (const d of [-0.11, 0.11]) spokeAt(p + d, 0.03, 0.026, 0.024, h + 0.006, h - 0.04, hubR - 0.01, rimR - 0.02, face); }
  } else if (style === 'five') {
    for (let k = 0; k < 5; k++) spokeAt((k / 5) * PI * 2 + 0.3, 0.07, 0.05, 0.026, h + 0.004, h - 0.036, hubR - 0.01, rimR - 0.02, face);
  } else if (style === 'offroad') {
    for (let k = 0; k < 6; k++) spokeAt((k / 6) * PI * 2, 0.06, 0.075, 0.03, h + 0.002, h - 0.03, hubR - 0.01, rimR - 0.02, face, 1.0);
  } else if (style === 'steel') {
    // hub cap: domed disc with dark turbine slots
    const cp = [[h + 0.03, 0.001], [h + 0.028, rimR * 0.35], [h + 0.016, rimR * 0.78], [h - 0.002, rimR - 0.01]];
    emitGrid(kit, grid(latheRings(cp, seg), false, -1), { m: 1, col: () => 0xb8b8b4 });
    for (let k = 0; k < 10; k++) spokeAt((k / 10) * PI * 2, 0.022, 0.03, 0.004, h + 0.026, h + 0.012, rimR * 0.42, rimR * 0.8, DARK, 1);
  } else if (style === 'truck') {
    const cp = [[h - 0.02, 0.001], [h - 0.02, rimR - 0.035]];
    emitGrid(kit, grid(latheRings(cp, seg), false, -1), { m: 1, col: () => CH });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2, g = new THREE.CircleGeometry(0.045, 6).rotateY(PI / 2); place(g, h - 0.017, Math.cos(a) * rimR * 0.62, Math.sin(a) * rimR * 0.62); kit.add(g, 1, DARK); }
    const hub = new THREE.CylinderGeometry(0.06, 0.13, 0.11, 10).rotateZ(-PI / 2); place(hub, h + 0.035, 0, 0); kit.add(hub, 1, CH);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2, g = cylX(0.016, 0.04, 5, true); place(g, h - 0.0, Math.cos(a) * 0.16, Math.sin(a) * 0.16); kit.add(g, 1, CH); }
  }
  if (style !== 'steel' && style !== 'truck') {
    // centre cap
    const cp = [[h + 0.016, 0.001], [h + 0.016, hubR * 0.55], [h + 0.008, hubR * 0.92], [h - 0.004, hubR + 0.004]];
    emitGrid(kit, grid(latheRings(cp, 12), false, -1), { m: 1, col: () => CAP });
    // brake disc + hat behind the spokes
    const disc = cylX(rimR - 0.05, 0.026, seg, false); place(disc, h - 0.11, 0, 0); kit.add(disc, 1, DISC);
    const hat = cylX(0.1, 0.06, 10, true); place(hat, h - 0.075, 0, 0); kit.add(hat, 1, 0x4a4846);
  } else if (style === 'steel') {
    const disc = cylX(rimR - 0.04, 0.02, seg, false); place(disc, h - 0.09, 0, 0); kit.add(disc, 1, 0x3a3836);
  }
  return kit.build();
}

// =====================================================================================
// INTERIOR / PEOPLE (merged, vertex coloured; skin in slot 8)
// =====================================================================================
const INT = 7, SKIN = 8;
function seat(kit, x, z, fl, w, col, back = true, hr = true, hipH = 0.3) {
  const cu = RBox(w, 0.13, 0.48, 0.045); place(cu, x, fl + hipH - 0.08, z - 0.08, -0.08); kit.add(cu, INT, col);
  if (back) { const bk = RBox(w, 0.62, 0.13, 0.05); place(bk, x, fl + hipH + 0.24, z + 0.2, 0.2); kit.add(bk, INT, col); }
  if (hr) { const h = RBox(Math.min(0.27, w), 0.18, 0.09, 0.04); place(h, x, fl + hipH + 0.66, z + 0.3, 0.2); kit.add(h, INT, col); }
}
// seated person: hip at (x,y,z) facing -z; hands to `wheel` (centre) or lap
function person(kit, x, y, z, o) {
  const T = (g, px, py, pz, rx = 0, ry = 0, rz = 0) => place(g, x + px, y + py, z + pz, rx, ry, rz);
  const bk = o.bulk ?? 1;
  kit.add(T(RBox(0.4 * bk, 0.56, 0.24, 0.08), 0, 0.31, 0.03, 0.14), INT, o.top);
  if (o.shirt) kit.add(T(Box(0.1, 0.16, 0.02), 0, 0.5, -0.06, 0.14), INT, o.shirt);
  if (o.tie) kit.add(T(Box(0.035, 0.16, 0.02), 0, 0.46, -0.072, 0.14), INT, o.tie);
  kit.add(T(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 7, 1, true), 0, 0.62, 0.06), SKIN);
  const hd = sphere(0.1, 9, 7); hd.scale(0.9, 1.12, 1.0); kit.add(T(hd, 0, 0.765, 0.05), SKIN);
  const hairCol = o.hair ?? 0x1a1410;
  if (o.hairStyle === 'cap') {
    const c = new THREE.SphereGeometry(0.108, 9, 4, 0, PI * 2, 0, PI * 0.5); c.scale(0.92, 0.9, 1.02); kit.add(T(c, 0, 0.8, 0.05), INT, o.capCol ?? 0x2a2d33);
    kit.add(T(Box(0.16, 0.012, 0.09), 0, 0.805, -0.06, -0.15), INT, o.capCol ?? 0x2a2d33);
  } else if (o.hairStyle !== 'bald') {
    const c = new THREE.SphereGeometry(0.106, 9, 4, 0, PI * 2, 0, PI * 0.42); c.scale(0.93, 1.05, 1.03); kit.add(T(c, 0, 0.775, 0.055), INT, hairCol);
    if (o.hairStyle === 'long') kit.add(T(RBox(0.2, 0.26, 0.08, 0.035), 0, 0.68, 0.12), INT, hairCol);
  }
  if (o.glasses) kit.add(T(RBox(0.175, 0.038, 0.03, 0.012), 0, 0.775, -0.04), INT, o.glasses);
  // arms
  const sh = [0.2 * bk, 0.53, 0.07];
  const hands = o.wheel
    ? [[o.wheel[0] - x - 0.155, o.wheel[1] - y + 0.07, o.wheel[2] - z + 0.02], [o.wheel[0] - x + 0.155, o.wheel[1] - y + 0.07, o.wheel[2] - z + 0.02]]
    : [[-0.12, 0.12, -0.3], [0.12, 0.12, -0.3]];
  for (const s of [-1, 1]) {
    const hd2 = hands[s < 0 ? 0 : 1];
    const S = [s * sh[0], sh[1], sh[2]];
    const E = [s * 0.23 * bk, 0.27, lerp(S[2], hd2[2], 0.45) + 0.04];
    kit.add(T(limb(S, E, 0.055, 0.05, 6), 0, 0, 0), INT, o.top);
    kit.add(T(limb(E, hd2, 0.045, 0.038, 6), 0, 0, 0), INT, o.sleeve ?? o.top);
    kit.add(T(sphere(0.042, 6, 4), hd2[0], hd2[1], hd2[2]), SKIN);
  }
  // thighs
  for (const s of [-1, 1]) kit.add(T(RBox(0.15, 0.14, 0.44, 0.05), s * 0.1, 0.02, -0.2), INT, o.legs ?? 0x22252b);
}
function steering(kit, c, tilt = 0.42, r = 0.185) {
  const t = new THREE.TorusGeometry(r, 0.02, 4, 12); place(t, c[0], c[1], c[2], tilt); kit.add(t, INT, 0x0e0e10);
  const hub = RBox(0.12, 0.1, 0.05, 0.02); place(hub, c[0], c[1], c[2] + 0.01, tilt); kit.add(hub, INT, 0x151517);
  kit.add(limb([c[0], c[1] - 0.02, c[2] - 0.02], [c[0], c[1] - 0.1, c[2] - 0.24], 0.035, 0.035, 6), INT, 0x0e0e10);
}

// =====================================================================================
// DECAL ATLAS  (1024²: left side rows 0..384, right side 384..768, misc strip 768..1024)
// =====================================================================================
const ATL = 1024;
const SIDE_L = { x: 0, y: 0, w: 1024, h: 384 }, SIDE_R = { x: 0, y: 384, w: 1024, h: 384 };
const PLATE_F = { x: 0, y: 768, w: 256, h: 128 }, PLATE_R = { x: 256, y: 768, w: 256, h: 128 }, BADGE = { x: 512, y: 768, w: 512, h: 128 }, MESH = { x: 0, y: 896, w: 512, h: 128 }, MISC = { x: 512, y: 896, w: 512, h: 128 };
const rectUV = (r, s, t) => [(r.x + s * r.w) / ATL, 1 - (r.y + (1 - t) * r.h) / ATL];
function sideUV(S, side, p) {
  const R = side < 0 ? SIDE_L : SIDE_R;
  const s = side < 0 ? (p[2] - S.z0) / (S.z1 - S.z0) : (S.z1 - p[2]) / (S.z1 - S.z0);
  const t = (p[1] - S.y0) / (S.y1 - S.y0);
  return rectUV(R, s, t);
}
function drawPlate(x, r, text, top = 'PACIFICA', dark = false) {
  x.save(); x.translate(r.x, r.y);
  const g = x.createLinearGradient(0, 0, 0, r.h); g.addColorStop(0, dark ? '#1c1f26' : '#f4f2ec'); g.addColorStop(1, dark ? '#101216' : '#d9d6cc');
  x.fillStyle = '#111'; x.fillRect(0, 0, r.w, r.h);
  x.fillStyle = g; x.beginPath(); x.roundRect(4, 4, r.w - 8, r.h - 8, 10); x.fill();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = dark ? '#c9a24a' : '#b3261e'; x.font = 'italic 600 22px Oswald, serif'; x.fillText(top, r.w / 2, 24);
  x.fillStyle = dark ? '#e8e2d0' : '#1d2a6b'; x.font = '700 58px Oswald, Impact, sans-serif'; x.fillText(text, r.w / 2, 80);
  x.fillStyle = dark ? '#8a8a8a' : '#444'; x.font = '500 13px Oswald, sans-serif'; x.fillText(dark ? 'OFFICIAL USE' : 'GOLDEN COAST', r.w / 2, r.h - 15);
  x.restore();
}
function makeAtlas(spec) {
  const c = canvas(ATL, ATL); const x = c.getContext('2d');
  x.clearRect(0, 0, ATL, ATL);
  const S = spec.S, r = makeRng(spec.seed || 9);
  for (const side of [-1, 1]) {
    const RR = side < 0 ? SIDE_L : SIDE_R;
    const X = (z) => RR.x + (side < 0 ? (z - S.z0) : (S.z1 - z)) / (S.z1 - S.z0) * RR.w;
    const Y = (y) => RR.y + (S.y1 - y) / (S.y1 - S.y0) * RR.h;
    x.save(); x.beginPath(); x.rect(RR.x, RR.y, RR.w, RR.h); x.clip();
    // road dust rising from the rocker, heavier behind the wheels
    const d = spec.dust ?? [128, 104, 78];
    const gd = x.createLinearGradient(0, Y(S.y0), 0, Y(S.y0 + 0.42));
    gd.addColorStop(0, `rgba(${d},${spec.dustA ?? 0.62})`); gd.addColorStop(0.45, `rgba(${d},${(spec.dustA ?? 0.62) * 0.35})`); gd.addColorStop(1, `rgba(${d},0)`);
    x.fillStyle = gd; x.fillRect(RR.x, Y(S.y0 + 0.42), RR.w, Y(S.y0) - Y(S.y0 + 0.42));
    for (const ax of spec.axles) {
      const cxp = X(ax + 0.62), cyp = Y(spec.archY + 0.1);
      const g2 = x.createRadialGradient(cxp, cyp, 4, cxp, cyp, 150); g2.addColorStop(0, `rgba(${d},0.45)`); g2.addColorStop(1, `rgba(${d},0)`);
      x.fillStyle = g2; x.fillRect(cxp - 160, cyp - 160, 320, 320);
    }
    for (let k = 0; k < 900; k++) {
      const v = S.y0 + Math.pow(r(), 3.2) * 0.34;
      x.fillStyle = `rgba(${95 + r() * 60 | 0},${75 + r() * 45 | 0},${55 + r() * 35 | 0},${0.12 + r() * 0.3})`;
      x.fillRect(X(lerp(S.z0, S.z1, r())), Y(v), 1 + r() * 2.2, 1 + r() * 2.2);
    }
    // stone-chip speckle on the lower front fender
    for (let k = 0; k < 220; k++) { x.fillStyle = `rgba(200,195,185,${0.15 + r() * 0.3})`; x.fillRect(X(spec.axles[0] + 0.55 + r() * 0.5), Y(S.y0 + 0.1 + r() * 0.35), 1.2, 1.2); }
    // panel lines that the geometry seams don't cover (fender/hood, around the rear arch)
    x.lineCap = 'round';
    const pl = (pts) => {
      x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = 2.2; x.beginPath(); pts.forEach(([z, y], i) => (i ? x.lineTo(X(z), Y(y)) : x.moveTo(X(z), Y(y)))); x.stroke();
      x.strokeStyle = 'rgba(255,236,214,0.18)'; x.lineWidth = 1; x.beginPath(); pts.forEach(([z, y], i) => (i ? x.lineTo(X(z), Y(y) + 2) : x.moveTo(X(z), Y(y) + 2))); x.stroke();
    };
    for (const l of spec.lines || []) pl(l);
    for (const [z, y0, y1] of spec.seams || []) pl([[z, y0], [z + 0.012, y1]]);
    if (spec.doorBottom) pl([[spec.doorBottom[0], spec.doorBottom[2]], [spec.doorBottom[1], spec.doorBottom[2]]]);
    // side marker reflectors
    for (const [z, y, col] of spec.markers || []) { x.fillStyle = col; x.beginPath(); x.roundRect(X(z) - 12, Y(y) - 5, 24, 10, 4); x.fill(); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(X(z) - 9, Y(y) - 4, 18, 2); }
    // fuel door
    if (spec.fuel) { const [z, y] = spec.fuel; x.strokeStyle = 'rgba(0,0,0,0.75)'; x.lineWidth = 2; x.beginPath(); x.roundRect(X(z) - 16, Y(y) - 15, 32, 30, 6); x.stroke(); }
    // badge
    if (spec.badge) {
      const [z, y, txt, sz] = spec.badge;
      x.font = `600 ${sz || 17}px Oswald, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillText(txt, X(z) + 1, Y(y) + 1.5);
      x.fillStyle = 'rgba(232,232,236,0.95)'; x.fillText(txt, X(z), Y(y));
    }
    if (spec.stripe) { const [y0, y1, col] = spec.stripe; x.fillStyle = col; x.fillRect(RR.x, Y(y1), RR.w, Y(y0) - Y(y1)); }
    x.restore();
  }
  drawPlate(x, PLATE_F, spec.plate || '7BAY401', spec.plateTop, spec.darkPlate);
  drawPlate(x, PLATE_R, spec.plate || '7BAY401', spec.plateTop, spec.darkPlate);
  // rear badge / letters
  x.save(); x.translate(BADGE.x, BADGE.y);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `400 ${spec.rearBadgeSize || 64}px Anton, Impact, sans-serif`;
  const gb = x.createLinearGradient(0, 30, 0, 100); gb.addColorStop(0, '#ffffff'); gb.addColorStop(0.45, '#c9ccd2'); gb.addColorStop(0.55, '#6c7078'); gb.addColorStop(1, '#e8eaee');
  x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillText(spec.rearBadge || 'ESCALATOR', BADGE.w / 2 + 2, BADGE.h / 2 + 3);
  x.fillStyle = gb; x.fillText(spec.rearBadge || 'ESCALATOR', BADGE.w / 2, BADGE.h / 2);
  x.restore();
  // honeycomb grille mesh
  x.save(); x.translate(MESH.x, MESH.y); x.fillStyle = '#060606'; x.fillRect(0, 0, MESH.w, MESH.h);
  x.strokeStyle = '#3a3b3e'; x.lineWidth = 2;
  for (let yy = 0; yy < MESH.h + 12; yy += 11) for (let xx = 0; xx < MESH.w + 12; xx += 13) { const ox = (yy / 11) % 2 ? 6.5 : 0; x.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2 + PI / 6; const px = xx + ox + Math.cos(a) * 6.5, py = yy + Math.sin(a) * 6.5; k ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.stroke(); }
  x.restore();
  if (spec.misc) spec.misc(x, MISC);
  return canvasTex(c);
}
function decalMaterial(map) {
  return new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0.1, envMapIntensity: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}
// flat textured quad for the decal mesh: centre c, axes ex (u) / ey (v) as [x,y,z] half-extents
function decalQuad(T, c, ex, ey, rect) {
  const n = new V3(...ex).cross(new V3(...ey)).normalize().toArray();
  const P = (s, t) => [c[0] + ex[0] * s + ey[0] * t, c[1] + ex[1] * s + ey[1] * t, c[2] + ex[2] * s + ey[2] * t];
  const a = [P(-1, -1), n, rectUV(rect, 0, 0)], b = [P(1, -1), n, rectUV(rect, 1, 0)], cc = [P(1, 1), n, rectUV(rect, 1, 1)], d = [P(-1, 1), n, rectUV(rect, 0, 1)];
  T.tri(a, b, cc); T.tri(a, cc, d);
}

// =====================================================================================
// SHARED CAR DETAILS
// =====================================================================================
// bumper / trim sweep around the plan outline at one end
function planPath(BM, end, off, sideExt, y, n = 5) {
  const B = BM.B;
  const W = B.W - 0.035 + off, r = (end === 'F' ? B.cornerF : B.cornerR) + off * 0.5;
  const zE = end === 'F' ? B.L0 - off : B.L1 + off, dir = end === 'F' ? 1 : -1;
  const pts = [];
  pts.push([-W, y, zE + dir * (r + sideExt)]);
  for (const [px, pz] of arcPts(-(W - r), zE + dir * r, r, PI, end === 'F' ? 1.5 * PI : 0.5 * PI, n)) pts.push([px, y, pz]);
  for (const [px, pz] of arcPts(W - r, zE + dir * r, r, end === 'F' ? 1.5 * PI : 0.5 * PI, 2 * PI, n)) pts.push([px, y, pz]);
  pts.push([W, y, zE + dir * (r + sideExt)]);
  return end === 'F' ? pts : pts.reverse();
}
function mirrors(kit, BM, z, y, paintM = 0, armM = 3, k = 1) {
  const x0 = BM.skinX(z, y) - 0.02;
  both(s => {
    kit.add(limb([s * x0, y + 0.02, z], [s * (x0 + 0.13 * k), y + 0.06 * k, z + 0.02], 0.022 * k, 0.018 * k, 6, false), armM);
    const hs = RBox(0.25 * k, 0.17 * k, 0.11 * k, 0.045 * k); place(hs, s * (x0 + 0.21 * k), y + 0.1 * k, z + 0.03, 0, s * 0.12); kit.add(hs, paintM);
    const gl = Box(0.21 * k, 0.13 * k, 0.01); place(gl, s * (x0 + 0.21 * k), y + 0.1 * k, z + 0.03 + 0.057 * k, 0, s * 0.12); kit.add(gl, 2);
  });
}
function handle(kit, BM, z, y, m = 2) {
  both(s => { const x = BM.skinX(z, y); const g = RBox(0.2, 0.035, 0.045, 0.015); place(g, s * (x + 0.006), y, z); kit.add(g, m); const sh = Box(0.17, 0.03, 0.01); place(sh, s * (x - 0.004), y - 0.002, z); kit.add(sh, 3); });
}
function beltTrim(kit, BM, z0, z1, m, h = 0.022) {
  const B = BM.B;
  both(s => {
    const path = [];
    for (let k = 0; k <= 10; k++) { const z = lerp(z0, z1, k / 10); const F = BM.frame(z, 'cabin'); path.push([s * (BM.xs(z, F.top, F) + 0.002), F.top + 0.004, z]); }
    if (s < 0) path.reverse();
    sweep(kit, path, [[-0.004, -h / 2], [0.012, -h / 2], [0.014, h / 2], [-0.004, h / 2]], m);
  });
  void B;
}
// lamp lens swept around a plan corner: y0..y1, from the side (a0 = 0) toward the end face (a1 up to PI/2)
function cornerLamp(kit, BM, end, s, y0, y1, a0, a1, m, out = 0.0) {
  const B = BM.B, r = (end === 'R' ? B.cornerR : B.cornerF);
  const yc = (y0 + y1) / 2, F = BM.frame(end === 'R' ? B.L1 - 0.3 : B.L0 + 0.3, BM.regionAt(end === 'R' ? B.L1 - 0.3 : B.L0 + 0.3));
  const W = BM.xs(end === 'R' ? B.L1 - 0.3 : B.L0 + 0.3, Math.min(yc, F.top), F);
  const cx = W - r, cz = end === 'R' ? B.L1 - r : B.L0 + r, dz = end === 'R' ? 1 : -1;
  const path = [];
  for (let k = 0; k <= 5; k++) { const a = lerp(a0, a1, k / 5); path.push([s * (cx + Math.cos(a) * (r + out)), y0, cz + dz * Math.sin(a) * (r + out)]); }
  const goesRight = (s > 0) === (end === 'R'); // CCW plan order keeps the profile's +a outward
  sweep(kit, goesRight ? path : path.reverse(), [[-0.012, 0], [0.008, 0], [0.012, 0.012], [0.012, y1 - y0 - 0.012], [0.008, y1 - y0], [-0.012, y1 - y0]], m);
}
// calipers: fixed to the body, inside the rim, behind the spokes
function calipers(kit, wheelPos, rimR, hw, m = 6, col = 0x5c5a58) {
  for (const [x, y, z] of wheelPos) {
    const s = Math.sign(x);
    const g = RBox(0.05, 0.16, 0.09, 0.02); place(g, x + s * (hw - 0.085), y + rimR * 0.52, z + rimR * 0.35, -0.6); kit.add(g, m, col);
  }
}
// Underside kit (slot 6, vertex coloured): what you see when a wreck lands on its roof.
// o: { L0, L1, yb (floor bottom), af/ar (front/rear axle z), wx/wy (wheel hub x/y), railX, rwd, spare, exSide, tip:[x,y] }
function chassis(kit, o) {
  const M = 6, { L0, L1, yb, af, ar, wx, wy } = o, rx = o.railX ?? 0.42, sx = o.exSide ?? 1;
  const C = { rail: 0x2c2d30, metal: 0x605c56, alu: 0xa39d93, rust: 0x7d573b, tank: 0x262729, rub: 0x18181a, spring: o.springCol ?? 0x8c7426, oil: 0x47423a, pan: 0x4d463c };
  const B = (w, h, d, x, y, z, c, ry = 0) => { const g = Box(w, h, d); place(g, x, y, z, 0, ry); kit.add(g, M, c); };
  const L = (a, b, r, c, seg = 6) => kit.add(limb(a, b, r, r, seg, true), M, c);
  const y0 = yb;
  // floor pan: stamped ribs + transmission tunnel
  for (const x of [-0.5, -0.28, 0.28, 0.5]) B(0.05, 0.018, (ar - af) * 0.62, x * (rx / 0.42), y0 - 0.009, (af + ar) / 2, C.pan);
  B(0.3, 0.04, ar - af - 0.9, 0, y0 - 0.02, (af + ar) / 2 - 0.1, C.pan);
  // ladder frame
  both(s => B(0.09, 0.12, L1 - L0 - 0.75, s * rx, y0 - 0.06, (L0 + L1) / 2, C.rail));
  for (const z of [af + 0.38, (af + ar) / 2, ar - 0.5, L1 - 0.38]) B(rx * 2, 0.07, 0.09, 0, y0 - 0.05, z, C.rail);
  // brake + fuel lines along the right rail
  for (const dx of [0.07, 0.1]) L([rx - dx, y0 - 0.015, af + 0.2], [rx - dx, y0 - 0.015, ar - 0.2], 0.008, C.alu, 4);
  // engine sump, oil pan, transmission
  B(0.5, 0.14, 0.62, 0, y0 - 0.07, af + 0.02, C.oil);
  B(0.36, 0.06, 0.42, 0, y0 - 0.16, af + 0.06, C.alu);
  { const g = new THREE.CylinderGeometry(0.1, 0.16, 0.72, 8, 1, true).rotateX(PI / 2); place(g, 0, y0 - 0.09, af + 0.68); kit.add(g, M, C.metal); }
  if (o.skid) B(0.95, 0.02, 0.55, 0, y0 - 0.2, af - 0.28, 0x58554f);
  // front suspension: wishbones, knuckles, springs, steering rack, half-shafts
  both(s => {
    for (const dz of [-0.2, 0.2]) L([s * rx, y0 - 0.06, af + dz], [s * (wx - 0.16), wy - 0.1, af], 0.024, C.metal);
    B(0.08, 0.18, 0.1, s * (wx - 0.15), wy - 0.02, af, C.metal);
    L([s * (wx - 0.24), wy - 0.06, af + 0.03], [s * (wx - 0.3), y0 + 0.12, af + 0.06], 0.062, C.spring, 7);
    L([s * 0.12, y0 - 0.04, af + 0.2], [s * (wx - 0.15), wy - 0.05, af + 0.12], 0.014, C.alu, 4);
    L([s * 0.2, y0 - 0.09, af + 0.04], [s * (wx - 0.17), wy, af], 0.032, C.rub, 6);
  });
  L([-rx + 0.04, y0 - 0.045, af + 0.2], [rx - 0.04, y0 - 0.045, af + 0.2], 0.03, C.alu, 6);
  // rear: live axle + diff + driveshaft (SUV) or twist beam (FWD civilians)
  if (o.rwd) {
    L([0, y0 - 0.09, af + 1.05], [0, wy - 0.06, ar - 0.13], 0.036, 0x4f4c47, 6);
    { const g = sphere(0.13, 8, 6); g.scale(1, 0.85, 1.15); place(g, 0.06, wy - 0.07, ar); kit.add(g, M, C.metal); }
    both(s => {
      L([s * 0.1, wy - 0.07, ar], [s * (wx - 0.13), wy, ar], 0.048, C.metal, 6);
      L([s * rx, y0 - 0.07, ar - 0.72], [s * (rx + 0.08), wy - 0.09, ar], 0.03, C.rail, 5);
      L([s * (wx - 0.3), wy - 0.04, ar + 0.05], [s * (wx - 0.32), y0 + 0.12, ar + 0.08], 0.06, C.spring, 7);
    });
  } else {
    B((wx - 0.16) * 2, 0.08, 0.11, 0, wy - 0.03, ar, C.metal);
    both(s => { L([s * (wx - 0.16), wy - 0.02, ar], [s * rx, y0 - 0.05, ar - 0.5], 0.03, C.metal, 5); L([s * (wx - 0.26), wy - 0.03, ar + 0.06], [s * (wx - 0.3), y0 + 0.1, ar + 0.06], 0.055, C.spring, 7); });
  }
  // fuel tank (black plastic, alloy straps) ahead of the rear axle
  { const tz = ar - 0.62, tx = -sx * 0.17; B(0.66, 0.2, 0.52, tx, y0 - 0.1, tz, C.tank); for (const dz of [-0.14, 0.14]) B(0.7, 0.012, 0.035, tx, y0 - 0.205, tz + dz, C.alu); L([tx - sx * 0.3, y0 - 0.06, tz], [tx - sx * 0.3 + sx * 0.0, y0 - 0.02, tz + 0.5], 0.022, C.rub, 5); }
  // exhaust: down-pipe, cat, mid pipe, muffler, tail pipe to the tip (rusty steel + alloy heat shields)
  {
    const ex = sx * Math.min(0.3, rx - 0.12), y = y0 - 0.075;
    const muz = o.rwd ? ar - 0.8 : ar + 0.52, tip = o.tip;
    L([sx * 0.16, y0 - 0.02, af + 0.28], [ex, y, af + 0.95], 0.033, C.rust);
    B(0.17, 0.11, 0.4, ex, y, af + 1.2, C.alu);
    L([ex, y, af + 1.4], [ex, y, o.rwd ? muz - 0.32 : ar - 0.35], 0.033, C.rust);
    if (o.rwd) {
      B(0.27, 0.17, 0.62, ex + sx * 0.02, y - 0.01, muz, 0x7c6e60);
      L([ex + sx * 0.04, y, muz + 0.31], [ex + sx * 0.1, y0 - 0.02, ar + 0.16], 0.03, C.rust);
      L([ex + sx * 0.1, y0 - 0.02, ar + 0.16], [sx * tip[0], tip[1], L1 - 0.28], 0.03, C.rust);
    } else {
      L([ex, y, ar - 0.35], [ex, y0 - 0.03, ar + 0.32], 0.03, C.rust);
      B(0.56, 0.15, 0.28, ex + sx * 0.05, y, muz, 0x7c6e60);
      L([ex + sx * 0.05, y, muz + 0.14], [sx * tip[0], tip[1], L1 - 0.26], 0.03, C.rust);
    }
    L([sx * tip[0], tip[1], L1 - 0.3], [sx * tip[0], tip[1], L1 - 0.04], 0.032, C.rust);
    for (const z of [af + 1.6, ar - 0.1]) B(0.02, 0.06, 0.02, ex, y0 - 0.03, z, C.rub); // rubber hangers
  }
  // spare tyre slung under the rear (SUV)
  if (o.spare) {
    const sz = L1 - 0.6, sy = y0 - 0.14;
    { const g = new THREE.CylinderGeometry(0.36, 0.36, 0.23, 14, 1, true); place(g, 0, sy, sz); kit.add(g, M, C.rub); }
    { const g = new THREE.CircleGeometry(0.36, 14).rotateX(PI / 2); place(g, 0, sy - 0.115, sz); kit.add(g, M, 0x222224); }
    { const g = new THREE.CircleGeometry(0.22, 12).rotateX(PI / 2); place(g, 0, sy - 0.118, sz); kit.add(g, M, 0x6b6964); }
    { const g = cylX(0.05, 0.02, 8).rotateZ(PI / 2); place(g, 0, sy - 0.125, sz); kit.add(g, M, C.alu); }
    B(0.85, 0.035, 0.06, 0, sy - 0.13, sz, C.rail); B(0.05, 0.12, 0.05, 0, sy - 0.07, sz + 0.3, C.rail);
  }
}

let skinCounter = 0;
function instantiate(cache, mats) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(cache.geometry, mats.slice());
  mesh.castShadow = true; mesh.receiveShadow = false;
  root.add(mesh);
  const wheels = cache.wheelPos.map(([x, y, z]) => {
    const w = new THREE.Mesh(cache.wheel, [MAT.tireTread, MAT.wheelMetal]);
    w.position.set(x, y, z); w.castShadow = true;
    if (x < 0) w.rotation.y = PI;
    root.add(w);
    return w;
  });
  let decal = null;
  if (cache.decal) { decal = new THREE.Mesh(cache.decal.geo, cache.decal.mat); decal.renderOrder = 2; root.add(decal); }
  cache.blobGeo ??= new THREE.PlaneGeometry(cache.half[0] * 2.6, cache.half[2] * 2.3);
  const blob = new THREE.Mesh(cache.blobGeo, MAT.blob);
  blob.rotation.x = -PI / 2; blob.position.set(0, 0.03, cache.centerOffsetZ || 0);
  blob.renderOrder = 1;
  root.add(blob);
  holeGeo ??= new THREE.PlaneGeometry(0.14, 0.14);
  const holes = new THREE.InstancedMesh(holeGeo, MAT.hole, 24);
  holes.count = 0; holes.frustumCulled = false;
  root.add(holes);
  return { root, mesh, wheels, blob, decal, half: new THREE.Vector3(...cache.half), lights: cache.lights, holes, holeN: 0, wheelPos: cache.wheelPos, centerOffsetZ: cache.centerOffsetZ || 0 };
}
let holeGeo = null;
const pickSkin = () => MAT.skins[Math.floor(hash((++skinCounter) * 2654435761) * MAT.skins.length) % MAT.skins.length];
const lightSpots = (list) => list.map(([x, y, z, kind]) => ({ p: new THREE.Vector3(x, y, z), kind }));

// =====================================================================================
// SUV  (Bay black SUV: 2007-era full-size, push bar, roof hatch, open rear windows)
// =====================================================================================
let suvCache = null;
function suvGeometry() {
  const B = {
    L0: -2.68, L1: 2.68, W: 0.99, tumble: 0.04, yb: 0.36, sill: 0.47, xin: 0.66,
    axles: [-1.6, 1.62], archR: 0.555, archY: 0.42, flare: 0.032,
    shoulder: 1.0, belt: 1.18, beltRise: 0.015, hoodFront: 1.1, cowl: 1.2, hoodCrown: 0.035, hoodBulge: 0.018, deckCrown: 0.01,
    cowlZ: -1.05, deckZ: 2.56, deckY: 1.2, cornerF: 0.2, cornerR: 0.15, noseR: 0.06, tailR: 0.05, chinF: 0.12, chinR: 0.1,
    floorY: 0.6, seams: [{ z: -0.96, y0: 0.5 }, { z: 0.42, y0: 0.5 }, { z: 1.43, y0: 0.9 }],
  };
  const BM = bodyModel(B);
  const kit = new Kit();
  const LB = lowerBody(kit, BM, { rockerMat: 0, intCol: 0x161618 });
  const GP = {
    y0: 1.18, y1: 1.885, ts: [0, 0.08, 0.5, 0.88, 1], gi0: 1, gi1: 3,
    hw: (t) => lerp(0.935, 0.80, t) + 0.012 * Math.sin(PI * t), zf: (t) => lerp(-1.03, -0.36, Math.pow(t, 0.92)), zr: (t) => lerp(2.62, 2.53, t),
    rf: (t) => lerp(0.24, 0.12, t), rr: () => 0.1, bowF: 0.07, bowR: 0.03, crown: 0.035,
    cuts: [0.37, 0.47, 1.40, 1.53, 2.32], sides: ['glass', 'trim', 'open', 'pillar', 'glass', 'pillar'],
    hatch: { cz: 0.2, hx: 0.36, hz: 0.38 }, liner: 0x29292b, pillar: 0,
  };
  const gh = greenhouse(kit, GP);
  const L0 = B.L0, L1 = B.L1;
  // ---- cowl, wipers
  { const c = Box(1.86, 0.03, 0.2); place(c, 0, 1.205, -1.03); kit.add(c, 3); }
  for (const x of [-0.42, 0.18]) { const w = Box(0.62, 0.012, 0.02); place(w, x, 1.23, -1.02, 0, 0.12, 0.04); kit.add(w, 3); }
  // ---- belt chrome + window channels
  beltTrim(kit, BM, -0.82, 2.5, 2, 0.016);
  // ---- front fascia: grille (chrome surround, two thick bars, mesh behind), headlights, bumper, fogs
  const zF = L0;
  {
    const gw = 1.06, gy0 = 0.67, gy1 = 1.0, gz = zF - 0.01;
    const back = Box(gw - 0.04, gy1 - gy0 - 0.03, 0.02); place(back, 0, (gy0 + gy1) / 2, gz + 0.012); kit.add(back, 3);
    // surround
    const sur = [[0, gy1, gw + 0.08, 0.07], [0, gy0, gw + 0.04, 0.05]];
    for (const [x, y, w, h] of sur) { const g = RBox(w, h, 0.07, 0.025); place(g, x, y, gz - 0.025); kit.add(g, 2); }
    both(s => { const g = RBox(0.06, gy1 - gy0 + 0.04, 0.07, 0.025); place(g, s * (gw / 2 + 0.01), (gy0 + gy1) / 2, gz - 0.025); kit.add(g, 2); });
    for (const y of [0.77, 0.89]) { const g = RBox(gw, 0.062, 0.05, 0.02); place(g, 0, y, gz - 0.035); kit.add(g, 2); }
    // badge
    const b = RBox(0.16, 0.1, 0.03, 0.02); place(b, 0, 0.83, gz - 0.07); kit.add(b, 2);
    const b2 = Box(0.12, 0.065, 0.01); place(b2, 0, 0.83, gz - 0.086); kit.add(b2, 3);
  }
  both(s => {
    // headlight cluster: dark housing, chrome reflector bowls, projector lenses, LED DRL L-strip
    const cx = s * 0.71, cy = 0.9, cz = zF - 0.005, ry = -s * 0.22;
    const hs = RBox(0.4, 0.2, 0.1, 0.03); place(hs, cx, cy, cz + 0.02, 0, ry); kit.add(hs, 3);
    for (const [ox, rr] of [[-0.09, 0.055], [0.06, 0.05]]) {
      const bowl = new THREE.CylinderGeometry(rr + 0.012, rr + 0.012, 0.02, 10, 1, true).rotateX(PI / 2); place(bowl, cx + s * ox * Math.cos(ry), cy + 0.012, cz - 0.035 + s * ox * 0.22, 0, ry); kit.add(bowl, 2);
      const lens = new THREE.SphereGeometry(rr * 0.75, 8, 3, 0, PI * 2, 0, PI / 2).rotateX(-PI / 2); place(lens, cx + s * ox * Math.cos(ry), cy + 0.012, cz - 0.045 + s * ox * 0.22, 0, ry); kit.add(lens, 4);
    }
    const drl = RBox(0.36, 0.022, 0.03, 0.01); place(drl, cx, cy - 0.072, cz - 0.04, 0, ry); kit.add(drl, 4);
    const drl2 = RBox(0.022, 0.13, 0.03, 0.01); place(drl2, cx + s * 0.17, cy - 0.01, cz - 0.0, 0, ry); kit.add(drl2, 4);
    const amb = Box(0.08, 0.04, 0.02); place(amb, cx + s * 0.15, cy + 0.06, cz - 0.0, 0, ry); kit.add(amb, 5);
  });
  // bumper (paint upper, plastic lower valance with intake)
  sweep(kit, planPath(BM, 'F', 0.03, 0.22, 0.47), [[-0.06, 0], [0.03, 0.0], [0.07, 0.04], [0.085, 0.12], [0.07, 0.2], [0.02, 0.235], [-0.06, 0.235]], 0);
  sweep(kit, planPath(BM, 'F', 0.04, 0.06, 0.39), [[-0.06, 0], [0.02, -0.01], [0.06, 0.03], [0.065, 0.09], [-0.06, 0.09]], 3);
  { const g = RBox(0.95, 0.09, 0.04, 0.02); place(g, 0, 0.56, zF - 0.105); kit.add(g, 3); }
  both(s => {
    const ring = new THREE.TorusGeometry(0.052, 0.012, 4, 10); place(ring, s * 0.66, 0.565, zF - 0.105); kit.add(ring, 2);
    const fog = cylZ(0.045, 0.02, 10); place(fog, s * 0.66, 0.565, zF - 0.1); kit.add(fog, 4);
  });
  // push bar (menacing Bay SUV): main hoop, crossbar, headlight guard wings, skid plate
  {
    const z = zF - 0.19, r = 0.032;
    const hoop = [[-0.42, 0.42, z + 0.04], [-0.42, 0.62, z], ...arcPts(-0.3, 0.86, 0.12, PI, PI / 2, 4).map(([x, y]) => [x, y, z]), [0, 0.98, z], ...arcPts(0.3, 0.86, 0.12, PI / 2, 0, 4).map(([x, y]) => [x, y, z]), [0.42, 0.62, z], [0.42, 0.42, z + 0.04]];
    tube(kit, hoop.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-4), r, 3, 7);
    tube(kit, [[-0.42, 0.72, z], [0.42, 0.72, z]], r * 0.9, 3, 7);
    both(s => tube(kit, [[s * 0.42, 0.52, z], [s * 0.62, 0.52, z + 0.03], [s * 0.86, 0.6, z + 0.11], [s * 0.9, 0.78, z + 0.15], [s * 0.86, 0.98, z + 0.15], [s * 0.6, 1.0, z + 0.08]], r * 0.85, 3, 6));
    const sk = RBox(0.84, 0.16, 0.03, 0.01); place(sk, 0, 0.5, z + 0.01); kit.add(sk, 3);
    both(s => { const m = RBox(0.08, 0.2, 0.16, 0.01); place(m, s * 0.42, 0.45, z + 0.11); kit.add(m, 3); });
  }
  // ---- sides: mirrors, handles, running boards
  mirrors(kit, BM, -0.82, 1.2);
  handle(kit, BM, -0.12, 1.06); handle(kit, BM, 1.06, 1.06);
  both(s => {
    const rb = RBox(0.22, 0.05, 2.2, 0.02); place(rb, s * (B.W + 0.03), 0.43, 0.02); kit.add(rb, 3);
    const st = Box(0.02, 0.012, 2.1); place(st, s * (B.W + 0.142), 0.452, 0.02); kit.add(st, 2);
    for (const z of [-0.8, 0.8]) { const br = Box(0.18, 0.04, 0.05); place(br, s * (B.W - 0.06), 0.42, z); kit.add(br, 6); }
  });
  // ---- roof: rails, hatch lid, shark fin, spoiler + third brake light
  both(s => {
    const x = s * 0.66, y = gh.roofY(0.66, 1) + 0.045;
    const rail = RBox(0.04, 0.03, 2.3, 0.012); place(rail, x, y, 1.05); kit.add(rail, 3);
    for (const z of [-0.08, 2.18]) { const ft = RBox(0.06, 0.06, 0.12, 0.02); place(ft, x, y - 0.025, z); kit.add(ft, 3); }
  });
  {
    const hz0 = 0.2 - 0.38, ang = -1.15, ry = gh.roofY(0, hz0);
    void ang;
    const lz = 0.2 + 0.38 + 0.42, lid = RBox(0.74, 0.035, 0.78, 0.015); place(lid, 0, gh.roofY(0, lz) + 0.045, lz, -0.07); kit.add(lid, 0);
    const lidIn = Box(0.66, 0.01, 0.7); place(lidIn, 0, gh.roofY(0, lz) + 0.068, lz, -0.07); kit.add(lidIn, 3);
    const hinge = cylX(0.018, 0.68, 6); place(hinge, 0, ry + 0.035, 0.2 + 0.39); kit.add(hinge, 3);
    for (const x of [-0.3, 0.3]) { const st = Box(0.03, 0.05, 0.06); place(st, x, gh.roofY(x, 0.6) + 0.02, 0.6); kit.add(st, 3); }
    const fin = warpBox((sx, sy, sz) => [sx * lerp(0.06, 0.02, sy + 0.5), (gh.roofY(0, 2.2) - 0.005) + (sy + 0.5) * 0.06, 2.22 + sz * lerp(0.2, 0.08, sy + 0.5) + (sy + 0.5) * 0.04]); kit.add(fin, 0);
    const sp = RBox(1.5, 0.04, 0.13, 0.015); place(sp, 0, gh.roofY(0, 2.5) - 0.006, 2.5, 0.06); kit.add(sp, 0);
    const tb = Box(0.4, 0.025, 0.02); place(tb, 0, gh.roofY(0, 2.5) - 0.04, 2.6); kit.add(tb, 5);
  }
  // ---- rear: tall taillights, tailgate handle + plate recess, bumper, exhausts, wiper, hitch
  both(s => {
    // curved lens hugging the rear corner (sweep along the plan arc), chrome reverse insert
    cornerLamp(kit, BM, 'R', s, 0.86, 1.17, 0.12, 0.5 * PI, 5);
    cornerLamp(kit, BM, 'R', s, 1.02, 1.07, 0.03, 0.42 * PI, 2, 0.006);
    cornerLamp(kit, BM, 'R', s, 0.84, 0.865, 0.03, 0.5 * PI, 3, 0.004);
  });
  { const h = RBox(0.32, 0.06, 0.03, 0.015); place(h, 0, 1.06, L1 + 0.005); kit.add(h, 2); }
  { const pr = RBox(0.36, 0.2, 0.02, 0.02); place(pr, 0, 0.84, L1 - 0.002); kit.add(pr, 3); }
  { const pl = Box(0.24, 0.012, 0.02); place(pl, 0, 0.955, L1 + 0.01); kit.add(pl, 2); }
  sweep(kit, planPath(BM, 'R', 0.03, 0.2, 0.47), [[-0.06, 0], [0.03, 0.0], [0.075, 0.05], [0.08, 0.15], [0.06, 0.2], [-0.06, 0.2]], 0);
  sweep(kit, planPath(BM, 'R', 0.05, 0.05, 0.38), [[-0.06, 0], [0.02, -0.01], [0.05, 0.03], [0.05, 0.09], [-0.06, 0.09]], 3);
  { const sp = RBox(0.9, 0.02, 0.1, 0.008); place(sp, 0, 0.678, L1 + 0.06); kit.add(sp, 3); }
  for (const x of [0.48, 0.6]) { const t = cylZ(0.042, 0.14, 12, true); place(t, x, 0.36, L1 + 0.02); kit.add(t, 2); const bk = cylZ(0.036, 0.01, 10); place(bk, x, 0.36, L1 - 0.02); kit.add(bk, 3); }
  { const hr = RBox(0.08, 0.08, 0.2, 0.01); place(hr, 0, 0.36, L1 + 0.04); kit.add(hr, 3); }
  { const wp = RBox(0.5, 0.018, 0.02, 0.008); place(wp, 0.08, 1.42, gh.ringAt(0.3).pts[gh.ringAt(0.3).pts.length - 1][2] + 0.04, 0, 0, 0.55); kit.add(wp, 3); }
  // ---- wheels/brakes
  const wheelPos = [[-0.86, 0.43, B.axles[0]], [0.86, 0.43, B.axles[0]], [-0.86, 0.43, B.axles[1]], [0.86, 0.43, B.axles[1]]];
  calipers(kit, wheelPos, 0.3, 0.15, 6, 0x9a1d14);
  chassis(kit, { L0, L1, yb: B.yb, af: B.axles[0], ar: B.axles[1], wx: 0.86, wy: 0.43, railX: 0.44, rwd: true, spare: true, skid: true, exSide: 1, tip: [0.54, 0.36] });
  // ---- interior: dash, wheel, console, seats, driver + passenger in suits & shades
  const fl = B.floorY;
  { const d = RBox(1.78, 0.2, 0.44, 0.06); place(d, 0, 1.12, -0.86); kit.add(d, INT, 0x0f0f11); const h = RBox(0.42, 0.08, 0.2, 0.03); place(h, -0.42, 1.24, -0.74); kit.add(h, INT, 0x0b0b0c); const sc = Box(0.24, 0.12, 0.02); place(sc, 0, 1.2, -0.66, -0.4); kit.add(sc, 3); }
  { const c = RBox(0.26, 0.24, 0.8, 0.04); place(c, 0, fl + 0.2, -0.22); kit.add(c, INT, 0x121214); }
  const hipH = 0.32;
  seat(kit, -0.42, 0.1, fl, 0.5, 0x161618, true, true, hipH); seat(kit, 0.42, 0.1, fl, 0.5, 0x161618, true, true, hipH);
  seat(kit, 0, 1.05, fl, 1.5, 0x161618, true, false, hipH);
  const wheelC = [-0.42, 1.2, -0.52];
  steering(kit, wheelC);
  const suit = { top: 0x16171b, shirt: 0xdedcd6, tie: 0x0c0c0e, legs: 0x15161a, glasses: 0x030303, hair: 0x15110e };
  person(kit, -0.42, fl + hipH, 0.06, { ...suit, wheel: wheelC });
  person(kit, 0.42, fl + hipH, 0.06, { ...suit, hair: 0x0e0c0b, bulk: 1.08 });
  // ---- decal: dust, badge, markers, plates, rear letters, grille mesh
  const S = { z0: L0, z1: L1, y0: 0.4, y1: 1.25 };
  const atlas = makeAtlas({
    S, seed: 11, axles: B.axles, archY: B.archY, dustA: 0.55,
    seams: B.seams.map(q => [q.z, Math.max(q.y0, BM.archTop(q.z) + 0.02), B.belt - 0.005]), doorBottom: [B.seams[0].z, B.seams[2].z, B.sill + 0.07],
    lines: [[[-2.2, 1.12], [-1.2, 1.17]], [[1.43, 0.94], [1.62 + 0.0, 1.02], [2.15, 0.95]]],
    markers: [[-2.45, 0.78, 'rgba(255,150,40,0.9)'], [2.5, 0.8, 'rgba(200,20,10,0.9)']], fuel: [2.15, 1.05], badge: [-2.05, 0.92, 'ESCALATOR V8', 17],
    plate: 'EXEMPT 7', plateTop: 'U.S. GOVERNMENT', darkPlate: true, rearBadge: 'ESCALATOR',
  });
  const T = new TriBuf();
  sideDecal(T, LB, L0 + 0.12, L1 - 0.1, (p) => sideUV(S, Math.sign(p[0]), p));
  decalQuad(T, [0, 0.5, zF - 0.208], [-0.15, 0, 0], [0, 0.075, 0], PLATE_F);
  decalQuad(T, [0, 0.84, L1 + 0.0105], [0.15, 0, 0], [0, 0.075, 0], PLATE_R);
  decalQuad(T, [0, 1.15, L1 + 0.006], [0.26, 0, 0], [0, 0.065, 0], BADGE);
  decalQuad(T, [0, 0.83, zF - 0.008], [-0.5, 0, 0], [0, 0.14, 0], MESH);
  return {
    geometry: kit.build(), decal: { geo: T.geo(), mat: decalMaterial(atlas) },
    wheel: wheelGeometry({ R: 0.43, w: 0.3, rimR: 0.29, style: 'split6' }), wheelPos, half: [1.0, 0.95, 2.68],
    lights: lightSpots([[-0.71, 0.9, -2.75, 'head'], [0.71, 0.9, -2.75, 'head'], [-0.87, 1.17, 2.72, 'tail'], [0.87, 1.17, 2.72, 'tail']]),
  };
}
export function buildSUV() {
  if (!suvCache) suvCache = suvGeometry();
  return instantiate(suvCache, [MAT.paintBlack, MAT.glass, MAT.chrome, MAT.plastic, MAT.headlight, MAT.taillight, MAT.underbody, MAT.interior, pickSkin()]);
}

// =====================================================================================
// CIVILIANS: 0 = 90s sedan, 1 = hatchback, 2 = minivan
// =====================================================================================
const civCache = [];
const CIV = [
  { // 90s three-box sedan
    B: { L0: -2.42, L1: 2.4, W: 0.9, tumble: 0.035, yb: 0.27, sill: 0.36, xin: 0.58, axles: [-1.42, 1.36], archR: 0.42, archY: 0.31, flare: 0.012, flareW: 0.15,
      shoulder: 0.8, belt: 0.92, beltRise: 0.02, hoodFront: 0.78, cowl: 0.92, hoodCrown: 0.03, hoodBulge: 0.0, deckCrown: 0.02, cowlZ: -0.96, deckZ: 1.32, deckY: 0.95, deckDrop: -0.02,
      cornerF: 0.26, cornerR: 0.22, noseR: 0.05, tailR: 0.06, chinF: 0.1, chinR: 0.1, floorY: 0.38, rockerTuck: 0.03, seams: [{ z: -0.9, y0: 0.4 }, { z: 0.12, y0: 0.4 }, { z: 0.9, y0: 0.6 }] },
    G: { y0: 0.92, y1: 1.36, ts: [0, 0.1, 0.55, 0.9, 1], gi0: 1, gi1: 3, hw: (t) => lerp(0.85, 0.71, t) + 0.01 * Math.sin(PI * t), zf: (t) => lerp(-0.97, -0.12, Math.pow(t, 0.9)), zr: (t) => lerp(1.36, 0.82, Math.pow(t, 0.95)),
      rf: (t) => lerp(0.26, 0.12, t), rr: (t) => lerp(0.24, 0.1, t), bowF: 0.06, bowR: 0.05, crown: 0.03, cuts: [0.02, 0.1, 0.66], sides: ['glass', 'trim', 'glass', 'pillar'], liner: 0x8d877c },
    wheel: { R: 0.33, w: 0.21, rimR: 0.2, style: 'steel', seg: 16 }, wheelX: 0.76, hipH: 0.16, interior: 0x56514a,
    driver: { top: 0x6b5a45, legs: 0x3d3a35, hair: 0x9a9894, hairStyle: 'short', glasses: null, sleeve: 0x6b5a45 },
    badge: 'CRUISER LX', rearBadge: 'CRUISER', plate: '3KTR829', molding: true, chromeBumper: false,
  },
  { // hatchback
    B: { L0: -2.06, L1: 2.06, W: 0.86, tumble: 0.04, yb: 0.27, sill: 0.35, xin: 0.55, axles: [-1.28, 1.24], archR: 0.4, archY: 0.31, flare: 0.022, flareW: 0.18,
      shoulder: 0.8, belt: 0.92, beltRise: 0.04, hoodFront: 0.76, cowl: 0.9, hoodCrown: 0.03, hoodBulge: 0.0, deckCrown: 0.0, cowlZ: -1.0, deckZ: 1.96, deckY: 0.97,
      cornerF: 0.3, cornerR: 0.18, noseR: 0.08, tailR: 0.06, chinF: 0.1, chinR: 0.08, floorY: 0.38, rockerTuck: 0.035, seams: [{ z: -0.95, y0: 0.4 }, { z: 0.25, y0: 0.4 }, { z: 1.05, y0: 0.65 }] },
    G: { y0: 0.93, y1: 1.37, ts: [0, 0.1, 0.55, 0.88, 1], gi0: 1, gi1: 3, hw: (t) => lerp(0.81, 0.68, t) + 0.01 * Math.sin(PI * t), zf: (t) => lerp(-1.0, -0.2, Math.pow(t, 0.85)), zr: (t) => lerp(2.0, 1.6, Math.pow(t, 0.85)),
      rf: (t) => lerp(0.26, 0.12, t), rr: (t) => lerp(0.17, 0.1, t), bowF: 0.06, bowR: 0.04, crown: 0.025, cuts: [0.14, 0.22, 1.0, 1.08, 1.62], sides: ['glass', 'trim', 'glass', 'trim', 'glass', 'pillar'], liner: 0x6f6d6a },
    wheel: { R: 0.31, w: 0.2, rimR: 0.2, style: 'five', seg: 16 }, wheelX: 0.73, hipH: 0.17, interior: 0x2f3036,
    driver: { top: 0x8c2a2a, legs: 0x2a3550, hair: 0x2a1a12, hairStyle: 'long', glasses: null },
    badge: 'ZIPPA GTI', rearBadge: 'ZIPPA', plate: '6ZPX114', molding: false,
  },
  { // minivan
    B: { L0: -2.45, L1: 2.45, W: 0.93, tumble: 0.04, yb: 0.29, sill: 0.39, xin: 0.6, axles: [-1.52, 1.44], archR: 0.43, archY: 0.33, flare: 0.015, flareW: 0.16,
      shoulder: 0.86, belt: 1.0, beltRise: 0.03, hoodFront: 0.84, cowl: 1.02, hoodCrown: 0.04, hoodBulge: 0.0, deckCrown: 0.0, cowlZ: -1.5, deckZ: 2.36, deckY: 1.03,
      cornerF: 0.3, cornerR: 0.18, noseR: 0.08, tailR: 0.05, chinF: 0.1, chinR: 0.08, floorY: 0.42, rockerTuck: 0.03, seams: [{ z: -1.44, y0: 0.4 }, { z: -0.36, y0: 0.4 }, { z: 0.84, y0: 0.4 }] },
    G: { y0: 1.01, y1: 1.74, ts: [0, 0.08, 0.5, 0.9, 1], gi0: 1, gi1: 3, hw: (t) => lerp(0.885, 0.76, t) + 0.012 * Math.sin(PI * t), zf: (t) => lerp(-1.5, -0.58, Math.pow(t, 0.8)), zr: (t) => lerp(2.42, 2.3, t),
      rf: (t) => lerp(0.3, 0.14, t), rr: () => 0.12, bowF: 0.08, bowR: 0.03, crown: 0.035, cuts: [-0.44, -0.34, 0.76, 0.86, 1.8], sides: ['glass', 'trim', 'glass', 'trim', 'glass', 'pillar'], liner: 0x9a958c },
    wheel: { R: 0.34, w: 0.22, rimR: 0.22, style: 'five', seg: 16 }, wheelX: 0.79, hipH: 0.3, interior: 0x6a6258,
    driver: { top: 0x3c5a8a, legs: 0x5a5448, hair: 0x9c7c4a, hairStyle: 'cap', capCol: 0x8a1f1f, glasses: 0x101010 },
    badge: 'VOYAJER SE', rearBadge: 'VOYAJER', plate: '4FAM261', molding: true,
  },
];
function civGeometry(style) {
  const C = CIV[style], B = C.B;
  const BM = bodyModel(B);
  const kit = new Kit();
  const LB = lowerBody(kit, BM, { rockerMat: 0, intCol: C.interior });
  const gh = greenhouse(kit, { ...C.G, liner: C.G.liner });
  const L0 = B.L0, L1 = B.L1, zF = L0;
  { const c = Box(B.W * 1.9, 0.025, 0.16); place(c, 0, C.G.y0 + 0.005, C.G.zf(0) + 0.02); kit.add(c, 3); }
  for (const x of [-0.36, 0.16]) { const w = Box(0.55, 0.012, 0.018); place(w, x, C.G.y0 + 0.03, C.G.zf(0) + 0.03, 0, 0.1, 0.04); kit.add(w, 3); }
  // front: grille + lights per style
  const hlY = B.hoodFront - 0.1;
  if (style === 0) {
    const g = RBox(0.62, 0.13, 0.05, 0.02); place(g, 0, hlY, zF - 0.005); kit.add(g, 2);
    for (let k = 0; k < 5; k++) { const b = Box(0.56, 0.008, 0.02); place(b, 0, hlY - 0.045 + k * 0.022, zF - 0.032); kit.add(b, 3); }
    both(s => { const hs = RBox(0.34, 0.13, 0.05, 0.02); place(hs, s * 0.56, hlY, zF + 0.01, 0, -s * 0.2); kit.add(hs, 2); const l = Box(0.29, 0.09, 0.02); place(l, s * 0.56, hlY, zF - 0.012, 0, -s * 0.2); kit.add(l, 4); const am = Box(0.08, 0.1, 0.02); place(am, s * 0.78, hlY, zF + 0.09, 0, -s * 0.9); kit.add(am, 5); });
  } else if (style === 1) {
    const g = RBox(0.66, 0.09, 0.05, 0.02); place(g, 0, hlY + 0.01, zF + 0.0); kit.add(g, 3);
    const gs = Box(0.6, 0.012, 0.02); place(gs, 0, hlY - 0.005, zF - 0.026); kit.add(gs, 2);
    both(s => { const hs = RBox(0.26, 0.13, 0.06, 0.04); place(hs, s * 0.52, hlY + 0.01, zF + 0.03, 0, -s * 0.35); kit.add(hs, 2); for (const ox of [-0.05, 0.06]) { const l = cylZ(0.045, 0.02, 12); place(l, s * (0.52 + ox), hlY + 0.012, zF - 0.005 + s * ox * 0.35 * s, 0, -s * 0.35); kit.add(l, 4); } });
  } else {
    const g = RBox(0.8, 0.12, 0.05, 0.03); place(g, 0, hlY + 0.02, zF - 0.0); kit.add(g, 3);
    for (let k = 0; k < 3; k++) { const b = Box(0.74, 0.01, 0.02); place(b, 0, hlY - 0.015 + k * 0.035, zF - 0.026); kit.add(b, 2); }
    both(s => { const hs = RBox(0.3, 0.15, 0.06, 0.04); place(hs, s * 0.6, hlY + 0.03, zF + 0.05, 0, -s * 0.4); kit.add(hs, 2); const l = Box(0.24, 0.1, 0.02); place(l, s * 0.6, hlY + 0.03, zF + 0.015, 0, -s * 0.4); kit.add(l, 4); });
  }
  // bumpers (90s: dark plastic with a rub strip)
  const bm = style === 0 ? 3 : 0;
  sweep(kit, planPath(BM, 'F', 0.025, 0.18, B.yb + 0.06), [[-0.06, 0], [0.03, 0], [0.065, 0.04], [0.07, 0.14], [0.05, 0.19], [-0.06, 0.19]], bm);
  sweep(kit, planPath(BM, 'R', 0.025, 0.16, B.yb + 0.06), [[-0.06, 0], [0.03, 0], [0.06, 0.04], [0.065, 0.14], [0.05, 0.19], [-0.06, 0.19]], bm);
  { const g = RBox(0.6, 0.06, 0.03, 0.015); place(g, 0, B.yb + 0.11, zF - 0.085); kit.add(g, 3); }
  // side molding (90s rub strips) + mirrors + handles
  if (C.molding) both(s => {
    const path = []; const y = B.sill + 0.24;
    for (let k = 0; k <= 12; k++) { const z = lerp(L0 + 0.4, L1 - 0.35, k / 12); path.push([s * (BM.skinX(z, y) + 0.004), y, z]); }
    if (s < 0) path.reverse();
    sweep(kit, path, [[-0.01, -0.025], [0.012, -0.022], [0.016, 0.022], [-0.01, 0.025]], 3);
  });
  mirrors(kit, BM, C.G.zf(0) + 0.3, C.G.y0 - 0.01, style === 0 ? 3 : 0, 3, 0.75);
  handle(kit, BM, C.B.seams[0].z + 0.4 + 0.15, B.belt - 0.09, style === 0 ? 3 : 2);
  handle(kit, BM, C.B.seams[1].z + 0.45, B.belt - 0.09, style === 0 ? 3 : 2);
  // rear lights
  const tlY = style === 0 ? B.deckY - 0.12 : B.deckY - 0.1;
  if (style === 0) {
    both(s => { const t = RBox(0.62, 0.13, 0.05, 0.02); place(t, s * 0.48, tlY, L1 - 0.0, 0, s * 0.12); kit.add(t, 5); const r = Box(0.1, 0.1, 0.02); place(r, s * 0.25, tlY, L1 + 0.02); kit.add(r, 2); });
    const mid = RBox(0.34, 0.1, 0.03, 0.01); place(mid, 0, tlY, L1 + 0.012); kit.add(mid, 3);
  } else if (style === 1) {
    both(s => { cornerLamp(kit, BM, 'R', s, B.deckY - 0.26, B.deckY - 0.06, 0.15, 0.5 * PI, 5); cornerLamp(kit, BM, 'R', s, B.deckY - 0.2, B.deckY - 0.12, 0.5 * PI * 0.92, 0.5 * PI, 2, 0.006); });
    const tb = Box(0.36, 0.02, 0.02); place(tb, 0, C.G.y1 + 0.02, C.G.zr(1) + 0.02); kit.add(tb, 5);
    const sp = RBox(1.0, 0.035, 0.14, 0.015); place(sp, 0, C.G.y1 + 0.035, C.G.zr(1) - 0.02, 0.1); kit.add(sp, 0);
  } else {
    both(s => { cornerLamp(kit, BM, 'R', s, B.deckY - 0.4, B.deckY - 0.03, 0.1, 0.5 * PI * 0.95, 5); cornerLamp(kit, BM, 'R', s, B.deckY - 0.26, B.deckY - 0.18, 0.5 * PI * 0.6, 0.5 * PI * 0.95, 2, 0.006); });
    const tb = Box(0.4, 0.025, 0.02); place(tb, 0, C.G.y1 + 0.0, C.G.zr(1) + 0.03); kit.add(tb, 5);
  }
  { const pr = RBox(0.34, 0.18, 0.02, 0.02); place(pr, 0, B.yb + 0.37, L1 - 0.0); kit.add(pr, 3); }
  { const t = cylZ(0.03, 0.12, 10, true); place(t, -0.5, B.yb + 0.02, L1 + 0.02); kit.add(t, 2); }
  // wheels, calipers
  const wy = C.wheel.R, wx = C.wheelX;
  const wheelPos = [[-wx, wy, B.axles[0]], [wx, wy, B.axles[0]], [-wx, wy, B.axles[1]], [wx, wy, B.axles[1]]];
  if (style !== 0) calipers(kit, wheelPos, C.wheel.rimR, C.wheel.w / 2);
  chassis(kit, { L0, L1, yb: B.yb, af: B.axles[0], ar: B.axles[1], wx, wy, railX: Math.min(0.42, B.xin - 0.12), rwd: style === 0, exSide: -1, tip: [0.5, B.yb + 0.02], springCol: 0x6a6660 });
  // interior
  const fl = B.floorY, hipH = C.hipH;
  const dashZ = C.G.zf(0) + 0.32;
  { const d = RBox(B.W * 1.85, 0.18, 0.4, 0.05); place(d, 0, C.G.y0 + 0.02, dashZ); kit.add(d, INT, C.interior); }
  seat(kit, -0.38, -0.02 + (style === 2 ? -0.1 : 0), fl, 0.46, C.interior, true, true, hipH);
  seat(kit, 0.38, -0.02 + (style === 2 ? -0.1 : 0), fl, 0.46, C.interior, true, true, hipH);
  seat(kit, 0, style === 2 ? 0.9 : 0.85, fl, 1.3, C.interior, true, false, hipH);
  const hz = style === 2 ? -0.08 : 0.0;
  const wheelC = [-0.38, fl + hipH + 0.3, hz - 0.43];
  steering(kit, wheelC, style === 2 ? 0.55 : 0.4);
  person(kit, -0.38, fl + hipH, hz, { ...C.driver, wheel: wheelC });
  // decal
  const S = { z0: L0, z1: L1, y0: B.yb + 0.05, y1: B.belt + 0.06 };
  const atlas = makeAtlas({
    S, seed: 20 + style, axles: B.axles, archY: B.archY, dustA: 0.45,
    seams: B.seams.map(q => [q.z, Math.max(q.y0, BM.archTop(q.z) + 0.02), B.belt - 0.005]), doorBottom: [B.seams[0].z, B.seams[2].z, B.sill + 0.05],
    lines: [[[B.axles[0] - 0.6, B.shoulder + 0.06], [B.cowlZ - 0.05, B.belt - 0.01]]],
    markers: [[L0 + 0.22, B.sill + 0.33, 'rgba(255,150,40,0.9)'], [L1 - 0.2, B.sill + 0.33, 'rgba(200,20,10,0.9)']], fuel: [B.axles[1] + 0.45, B.belt - 0.12],
    badge: [B.axles[0] + 0.65, B.sill + 0.2, C.badge, 15], plate: C.plate, rearBadge: C.rearBadge, rearBadgeSize: 56,
  });
  const T = new TriBuf();
  sideDecal(T, LB, L0 + 0.12, L1 - 0.12, (p) => sideUV(S, Math.sign(p[0]), p));
  decalQuad(T, [0, B.yb + 0.115, zF - 0.102], [-0.15, 0, 0], [0, 0.075, 0], PLATE_F);
  decalQuad(T, [0, B.yb + 0.37, L1 + 0.0115], [0.15, 0, 0], [0, 0.075, 0], PLATE_R);
  decalQuad(T, [0.42, tlY - 0.12, L1 + 0.008], [0.14, 0, 0], [0, 0.035, 0], BADGE);
  const half = [B.W + 0.01, (C.G.y1 + 0.06) / 2, Math.max(-L0, L1) + 0.03];
  return {
    geometry: kit.build(), decal: { geo: T.geo(), mat: decalMaterial(atlas) },
    wheel: wheelGeometry(C.wheel), wheelPos, half,
    lights: lightSpots([[-0.55, hlY, L0 - 0.06, 'head'], [0.55, hlY, L0 - 0.06, 'head'], [-0.68, style === 0 ? tlY : B.deckY - 0.18, L1 + 0.02, 'tail'], [0.68, style === 0 ? tlY : B.deckY - 0.18, L1 + 0.02, 'tail']]),
  };
}
export function buildCivilian(paint, style = 0) {
  style = ((style % 3) + 3) % 3;
  if (!civCache[style]) civCache[style] = civGeometry(style);
  return instantiate(civCache[style], [paint, MAT.glass, MAT.chrome, MAT.plastic, MAT.headlight, MAT.taillight, MAT.underbody, MAT.interior, pickSkin()]);
}
// civilians: body style follows the paint index so traffic isn't clones
export function buildSedan(paint) {
  const i = MAT.civ ? MAT.civ.indexOf(paint) : 0;
  return buildCivilian(paint, i < 0 ? 0 : i % 3);
}

// =====================================================================================
// TANKER  (long-nose chrome tractor with sleeper + polished tank trailer)
// =====================================================================================
let tankerCache = null;
function rrRing(hw, y0, y1, rT, rB, z, n = 3) {
  // rounded-rect section (closed, CCW from bottom centre)
  const p = [[0, y0, z]];
  for (const [x, y] of arcPts(hw - rB, y0 + rB, rB, -PI / 2, 0, n)) p.push([x, y, z]);
  for (const [x, y] of arcPts(hw - rT, y1 - rT, rT, 0, PI / 2, n)) p.push([x, y, z]);
  p.push([0, y1, z]);
  return mirrorRing(p);
}
function tankerGeometry() {
  const kit = new Kit({ 6: 0x2a2826 });
  const CAB = 0, GL = 1, CH = 2, PL = 3, HL = 4, TL = 5, UB = 6, TK = 7, PC = 8;
  // ---- hood (long nose) lofted from rounded sections
  {
    const zs = [-6.45, -6.42, -6.3, -5.8, -5.0, -4.24];
    const rings = zs.map((z, i) => { const t = (z + 6.45) / 2.21; const top = lerp(1.98, 2.1, t) - (i < 2 ? 0.03 * (1 - i) : 0); return rrRing(lerp(0.6, 0.66, t) - (i === 0 ? 0.02 : 0), 1.12, top, 0.17, 0.02, z); });
    emitGrid(kit, grid(rings, true), { m: CAB });
    cap(kit, rings[0], PL, [0, 0, -1]);
  }
  // grille: chrome surround + vertical bars over black
  { const bk = Box(1.12, 0.84, 0.02); place(bk, 0, 1.55, -6.47); kit.add(bk, PL); }
  for (const [x, y, w, h] of [[0, 1.99, 1.3, 0.08], [0, 1.12, 1.3, 0.08]]) { const g = RBox(w, h, 0.1, 0.03); place(g, x, y, -6.5); kit.add(g, CH); }
  both(s => { const g = RBox(0.08, 0.92, 0.1, 0.03); place(g, s * 0.62, 1.555, -6.5); kit.add(g, CH); });
  for (let k = 0; k < 13; k++) { const b = Box(0.025, 0.8, 0.03); place(b, -0.54 + k * 0.09, 1.555, -6.5); kit.add(b, CH); }
  { const em = RBox(0.3, 0.1, 0.04, 0.02); place(em, 0, 2.06, -6.44, -0.3); kit.add(em, CH); }
  // fenders over steer tyres (swept sheet) + headlights on the fenders
  both(s => {
    const path = []; for (const [z, y] of arcPts(-5.4, 0.55, 0.7, PI * 1.08, -PI * 0.12, 10)) path.push([s * 0.98, y, z]);
    const lead = [[s * 0.98, 0.95, -6.45]];
    sweep(kit, [...lead, ...path.slice(2)], [[0, -0.32], [0.032, -0.32], [0.032, 0.32], [0, 0.32]], CAB, { ref: [s, 0, 0] });
    const hs = RBox(0.34, 0.2, 0.14, 0.04); place(hs, s * 0.98, 1.4, -6.05); kit.add(hs, CH);
    const hl = Box(0.28, 0.14, 0.02); place(hl, s * 0.98, 1.4, -6.125); kit.add(hl, HL);
    const mk = RBox(0.06, 0.04, 0.04, 0.01); place(mk, s * 1.27, 1.32, -5.6); kit.add(mk, HL);
    // air cleaners (chrome drums on the cowl)
    const ac = new THREE.CylinderGeometry(0.22, 0.22, 0.78, 14); place(ac, s * 1.22, 1.85, -4.05); kit.add(ac, CH);
    const acl = new THREE.CylinderGeometry(0.235, 0.235, 0.05, 14); place(acl, s * 1.22, 2.25, -4.05); kit.add(acl, CH);
  });
  // bumper
  { const b = RBox(2.5, 0.36, 0.26, 0.06); place(b, 0, 0.94, -6.6); kit.add(b, CH); }
  // ---- cab: lower body box + greenhouse loft with split windscreen; sleeper box
  { const lc = RBox(2.3, 1.12, 1.92, 0.08); place(lc, 0, 1.78, -3.29); kit.add(lc, CAB); }
  const gh = greenhouse(kit, {
    y0: 2.33, y1: 3.12, ts: [0, 0.08, 0.5, 0.88, 1], gi0: 1, gi1: 3,
    hw: (t) => lerp(1.13, 1.08, t), zf: (t) => lerp(-4.22, -4.05, t), zr: () => -2.36, rf: () => 0.1, rr: () => 0.06, bowF: 0.03, bowR: 0, crown: 0.03,
    cuts: [-3.25, -3.15], sides: ['glass', 'pillar', 'pillar'], liner: 0x3a3a3c, rearGlass: false, intM: 3,
  });
  { const pst = Box(0.08, 0.8, 0.04); place(pst, 0, 2.72, -4.2, -0.2); kit.add(pst, CAB); }
  { const sl = RBox(2.3, 2.2, 1.46, 0.14); place(sl, 0, 2.32, -1.66); kit.add(sl, CAB); const sw = Box(0.02, 0.28, 0.5); both(s => { const w = sw.clone(); place(w, s * 1.15, 2.7, -1.7); kit.add(w, GL); }); }
  { const vis = RBox(2.24, 0.05, 0.32, 0.02); place(vis, 0, 3.2, -4.12, -0.25); kit.add(vis, CAB); }
  for (let k = 0; k < 5; k++) { const ml = RBox(0.07, 0.05, 0.05, 0.015); place(ml, -0.6 + k * 0.3, 3.25, -4.0); kit.add(ml, HL); }
  both(s => { const h = cylZ(0.05, 0.5, 8); place(h, s * 0.35, 3.24, -3.6); kit.add(h, CH); const hb = new THREE.CylinderGeometry(0.11, 0.05, 0.12, 10).rotateX(PI / 2); place(hb, s * 0.35, 3.24, -3.9); kit.add(hb, CH); });
  // doors: handles, steps, grab bars, west-coast mirrors
  both(s => {
    const hdl = RBox(0.04, 0.04, 0.2, 0.01); place(hdl, s * 1.16, 2.1, -3.0); kit.add(hdl, CH);
    tube(kit, [[s * 1.18, 1.5, -2.5], [s * 1.18, 2.4, -2.5]], 0.018, CH, 6);
    for (const y of [0.62, 0.95]) { const st = RBox(0.3, 0.04, 0.5, 0.01); place(st, s * 1.1, y, -3.9); kit.add(st, UB); }
    kit.add(limb([s * 1.15, 2.4, -3.95], [s * 1.45, 2.5, -4.0], 0.02, 0.02, 6, false), CH);
    kit.add(limb([s * 1.15, 3.0, -3.95], [s * 1.45, 2.95, -4.0], 0.02, 0.02, 6, false), CH);
    const mh = RBox(0.12, 0.6, 0.06, 0.02); place(mh, s * 1.48, 2.72, -4.0); kit.add(mh, PL);
    const mg = Box(0.1, 0.55, 0.01); place(mg, s * 1.48, 2.72, -3.965); kit.add(mg, CH);
    // fuel tanks + exhaust stacks with heat shields
    const ft = cylZ(0.33, 1.3, 16); place(ft, s * 0.98, 0.78, -3.0); kit.add(ft, CH);
    for (const z of [-3.6, -2.4]) { const st = cylZ(0.34, 0.04, 16); place(st, s * 0.98, 0.78, z); kit.add(st, PL); }
    const ex = new THREE.CylinderGeometry(0.1, 0.1, 3.0, 12, 1, true); place(ex, s * 1.25, 2.6, -0.82); kit.add(ex, CH);
    const sh = new THREE.CylinderGeometry(0.118, 0.118, 1.0, 12, 1, true); place(sh, s * 1.25, 2.9, -0.82); kit.add(sh, PL);
    const tip = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12); place(tip, s * 1.25, 4.1, -0.82); kit.add(tip, UB);
  });
  // tractor interior silhouette (seat + driver read through the side glass)
  { const se = RBox(0.5, 0.75, 0.15, 0.04); place(se, -0.55, 2.55, -3.0); kit.add(se, PL); const dr = RBox(0.42, 0.5, 0.26, 0.08); place(dr, -0.55, 2.6, -3.18); kit.add(dr, PL); const hd = sphere(0.11, 8, 6); place(hd, -0.55, 3.0, -3.2); kit.add(hd, PL); const da = RBox(2.0, 0.3, 0.3, 0.05); place(da, 0, 2.3, -3.95); kit.add(da, PL); }
  // ---- chassis
  both(s => { const fr = Box(0.16, 0.28, 16.0); place(fr, s * 0.48, 0.86, 1.6); kit.add(fr, UB); });
  { const fw = Box(1.4, 0.12, 1.2); place(fw, 0, 1.08, -0.8); kit.add(fw, UB); }
  // running gear seen on a flipped rig: axles, drive diffs, leaf springs, air tanks, driveshafts, trailer landing legs
  for (const z of [-5.4, -1.4, -0.2, 7.2, 8.4]) {
    kit.add(limb([-0.95, 0.52, z], [0.95, 0.52, z], 0.07, 0.07, 7, true), UB, 0x5a5650);
    both(s => { const lf = Box(0.1, 0.07, 1.1); place(lf, s * 0.48, 0.66, z); kit.add(lf, UB, 0x3a3733); });
    if (z === -1.4 || z === -0.2) { const d = sphere(0.2, 8, 6); place(d, 0.1, 0.5, z); kit.add(d, UB, 0x67625b); }
  }
  kit.add(limb([0, 0.62, -4.4], [0, 0.52, -1.6], 0.06, 0.06, 6, true), UB, 0x55514b);
  kit.add(limb([0, 0.52, -1.2], [0, 0.52, -0.4], 0.06, 0.06, 6, true), UB, 0x55514b);
  both(s => { const at = cylZ(0.15, 0.9, 10, false); place(at, s * 0.25, 0.62, -2.4); kit.add(at, UB, 0x8e8a83); });
  both(s => { kit.add(limb([s * 0.85, 1.25, 0.9], [s * 0.85, 0.32, 0.9], 0.06, 0.06, 6, true), UB, 0x6a655d); const ft = Box(0.24, 0.05, 0.3); place(ft, s * 0.85, 0.3, 0.9); kit.add(ft, UB, 0x3a3733); });
  { const cb = Box(1.7, 0.06, 0.08); place(cb, 0, 0.8, 0.9); kit.add(cb, UB, 0x3a3733); }
  { const ex = limb([1.25, 1.1, -0.82], [1.25, 0.62, -3.6], 0.07, 0.07, 6, true); kit.add(ex, UB, 0x7d573b); }
  // ---- tank: elliptical loft with domed heads
  const TZ0 = -0.95, TZ1 = 9.05, TY = 2.45, RX = 1.25, RY = 1.13, NS = 24;
  const tankRing = (z, k) => { const r = []; for (let j = 0; j < NS; j++) { const a = (j / NS) * PI * 2; r.push([Math.cos(a) * RX * k, TY + Math.sin(a) * RY * k, z]); } return r; };
  {
    const zs = [], ks = [];
    const head = [[0, 0.32], [0.04, 0.62], [0.12, 0.82], [0.22, 0.93], [0.34, 0.985], [0.45, 1.0]];
    for (const [d, k] of head) { zs.push(TZ0 + d); ks.push(k); }
    for (let k = 1; k < 8; k++) { zs.push(lerp(TZ0 + 0.45, TZ1 - 0.45, k / 8)); ks.push(1); }
    for (const [d, k] of head.slice().reverse()) { zs.push(TZ1 - d); ks.push(k); }
    const rings = zs.map((z, i) => tankRing(z, ks[i]));
    emitGrid(kit, grid(rings, true), { m: TK });
    cap(kit, rings[0], TK, [0, 0, -1]); cap(kit, rings[rings.length - 1], TK, [0, 0, 1]);
    // chrome rib rings
    for (let k = 0; k <= 3; k++) {
      const z = lerp(TZ0 + 0.5, TZ1 - 0.5, k / 3);
      const path = []; for (let j = 0; j <= NS; j++) { const a = (j / NS) * PI * 2; path.push([Math.cos(a) * RX * 1.004, TY + Math.sin(a) * RY * 1.004, z]); }
      const rr = sweepRings(path, [[0, -0.05], [0.025, -0.04], [0.025, 0.04], [0, 0.05]], [0, 0, 1]);
      emitGrid(kit, grid(rr, true), { m: CH });
    }
  }
  // catwalk, dome lids, handrails, ladder, hose troughs, valves, reels, underride, mud flaps, lights
  { const cw = Box(0.62, 0.035, 8.2); place(cw, 0, TY + RY + 0.04, 4.05); kit.add(cw, UB); for (let k = 0; k < 18; k++) { const sl = Box(0.6, 0.01, 0.02); place(sl, 0, TY + RY + 0.06, 0.1 + k * 0.46); kit.add(sl, PL); } }
  for (const z of [1.0, 4.0, 7.0]) { const d = new THREE.CylinderGeometry(0.28, 0.3, 0.14, 14); place(d, 0, TY + RY + 0.1, z); kit.add(d, CH); const l = new THREE.CylinderGeometry(0.22, 0.24, 0.05, 14); place(l, 0, TY + RY + 0.2, z); kit.add(l, PL); }
  both(s => tube(kit, [[s * 0.42, TY + RY + 0.2, 0.0], [s * 0.42, TY + RY + 0.2, 8.0]], 0.018, CH, 6));
  {
    const lz = TZ1 + 0.06;
    both(s => tube(kit, [[s * 0.22 - 0.6, 0.95, lz + 0.18], [s * 0.22 - 0.6, 2.4, lz + 0.12], [s * 0.22 - 0.6, 3.6, lz - 0.3]], 0.02, CH, 6));
    for (let k = 0; k < 8; k++) { const y = 1.05 + k * 0.33; const z = lz + (y < 2.4 ? lerp(0.18, 0.12, (y - 0.95) / 1.45) : lerp(0.12, -0.3, (y - 2.4) / 1.2)); kit.add(limb([-0.82, y, z], [-0.38, y, z], 0.014, 0.014, 5), CH); }
  }
  both(s => {
    const tr = RBox(0.22, 0.16, 5.6, 0.02); place(tr, s * 1.12, 1.3, 3.9); kit.add(tr, PL);
    tube(kit, [[s * 1.12, 1.36, 1.2], [s * 1.12, 1.36, 6.6]], 0.05, PL, 8);
    for (const z of [2.0, 3.4, 4.8]) { const v = cylX(0.07, 0.24, 10); place(v, s * 0.6, 1.25, z); kit.add(v, CH); const vh = Box(0.04, 0.16, 0.04); place(vh, s * 0.74, 1.36, z); kit.add(vh, TL === 5 ? 3 : 3); }
    const reel = cylX(0.24, 0.3, 14); place(reel, s * 0.7, 1.05, 6.4); kit.add(reel, PL);
    for (const o of [-0.16, 0.16]) { const fl = cylX(0.3, 0.02, 14); place(fl, s * 0.7 + o, 1.05, 6.4); kit.add(fl, CH); }
    for (const z of [0.25, 9.0]) { const mf = Box(0.55, 0.6, 0.02); place(mf, s * 1.05, 0.5, z); kit.add(mf, PL); }
    for (const z of [8.0]) { const mf = Box(0.55, 0.6, 0.02); place(mf, s * 1.05, 0.5, z + 1.0); kit.add(mf, PL); }
  });
  { const ug = RBox(2.3, 0.2, 0.14, 0.03); place(ug, 0, 0.62, 9.82); kit.add(ug, UB); both(s => { const p = Box(0.08, 0.6, 0.08); place(p, s * 0.7, 0.95, 9.7); kit.add(p, UB); }); }
  { const rb = Box(2.4, 0.3, 0.05); place(rb, 0, 1.08, 9.55); kit.add(rb, UB); }
  both(s => { for (const x of [0.85, 1.05]) { const t = cylZ(0.065, 0.03, 12); place(t, s * x, 1.08, 9.585); kit.add(t, TL); } const am = cylZ(0.05, 0.03, 10); place(am, s * 0.62, 1.08, 9.585); kit.add(am, HL); });
  // side marker lights along the tank
  both(s => { for (let k = 0; k < 4; k++) { const m = RBox(0.03, 0.05, 0.08, 0.01); place(m, s * 1.24, 1.55, 1 + k * 2.6); kit.add(m, k === 3 ? TL : HL); } });
  // placards: diamonds on both sides + rear head
  const PT = new TriBuf();
  const diamond = (c, ex, ey) => { // quad with corners at edge midpoints of the texture square
    const n = new V3(...ex).cross(new V3(...ey)).normalize().toArray();
    const P = (s, t) => [c[0] + ex[0] * s + ey[0] * t, c[1] + ex[1] * s + ey[1] * t, c[2] + ex[2] * s + ey[2] * t];
    const top = [P(0, 1), n, [0.5, 1]], rt = [P(1, 0), n, [1, 0.5]], bt = [P(0, -1), n, [0.5, 0]], lt = [P(-1, 0), n, [0, 0.5]];
    PT.tri(top, lt, bt); PT.tri(top, bt, rt);
  };
  diamond([RX + 0.008, TY, 7.6], [0, 0, -0.42], [0, 0.42, 0]);
  diamond([-RX - 0.008, TY, 7.6], [0, 0, 0.42], [0, 0.42, 0]);
  diamond([0, TY - 0.2, TZ1 + 0.004], [0.36, 0, 0], [0, 0.36, 0]);
  diamond([0, 1.55, -6.53], [-0.22, 0, 0], [0, 0.22, 0]);
  kit.add(PT.geo(), PC);
  // decal on the tank sides: company stripe + name
  const atlas = makeAtlas({
    S: { z0: -1, z1: 9.1, y0: 1.4, y1: 3.5 }, seed: 31, axles: [7.2, 8.4], archY: 0.5, dustA: 0.0,
    plate: '9TNK552', rearBadge: 'BAYCO', plateTop: 'PACIFICA',
    misc: (x, r) => { x.save(); x.translate(r.x, r.y); x.clearRect(0, 0, r.w, r.h); x.restore(); },
  });
  // draw tank livery directly into the atlas canvas side regions
  {
    const c = atlas.image; const x = c.getContext('2d');
    for (const R of [SIDE_L, SIDE_R]) {
      x.save(); x.beginPath(); x.rect(R.x, R.y, R.w, R.h); x.clip(); x.clearRect(R.x, R.y, R.w, R.h);
      const yS = R.y + R.h * 0.62;
      x.fillStyle = 'rgba(196,30,22,0.95)'; x.fillRect(R.x, yS, R.w, 26); x.fillStyle = 'rgba(255,200,40,0.95)'; x.fillRect(R.x, yS + 30, R.w, 8);
      x.font = '400 74px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = 'rgba(20,24,40,0.92)'; x.fillText('BAYCO PETROLEUM', R.x + R.w * 0.5, R.y + R.h * 0.36);
      x.font = '600 24px Oswald, sans-serif'; x.fillText('GASOLINE · DIESEL · JET A', R.x + R.w * 0.5, R.y + R.h * 0.52);
      // grime streaks
      const r = makeRng(5);
      for (let k = 0; k < 120; k++) { x.fillStyle = `rgba(90,70,50,${0.04 + r() * 0.08})`; x.fillRect(R.x + r() * R.w, R.y + R.h * (0.7 + r() * 0.3), 2 + r() * 6, 20 + r() * 60); }
      x.restore();
    }
    atlas.needsUpdate = true;
  }
  const T = new TriBuf();
  {
    const S = { z0: -1, z1: 9.1, y0: 1.4, y1: 3.5 };
    const off = 0.006, zs = []; for (let k = 0; k <= 16; k++) zs.push(lerp(0.0, 8.0, k / 16));
    for (const side of [-1, 1]) for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < 8; j++) {
      const a0 = -0.62 + (j / 8) * 1.24, a1 = -0.62 + ((j + 1) / 8) * 1.24;
      const pt = (z, a) => { const x = side * Math.cos(a) * (RX + off), y = TY + Math.sin(a) * (RY + off); return [[x, y, z], [side * Math.cos(a), Math.sin(a) * RX / RY, 0], sideUV(S, side, [x, y, z])]; };
      const p00 = pt(zs[i], a0), p01 = pt(zs[i], a1), p10 = pt(zs[i + 1], a0), p11 = pt(zs[i + 1], a1);
      if (side < 0) { T.tri(p00, p10, p01); T.tri(p01, p10, p11); } else { T.tri(p00, p01, p10); T.tri(p01, p11, p10); }
    }
  }
  decalQuad(T, [0.0, 0.92, 9.895], [0.15, 0, 0], [0, 0.075, 0], PLATE_R);
  const wp = [];
  for (const z of [-5.4, -1.4, -0.2, 7.2, 8.4]) for (const sx of [-1, 1]) wp.push([sx * 1.05, 0.52, z]);
  void gh;
  return {
    geometry: kit.build(), decal: { geo: T.geo(), mat: decalMaterial(atlas) },
    wheel: wheelGeometry({ R: 0.52, w: 0.5, rimR: 0.29, style: 'truck', seg: 14, dual: true }), wheelPos: wp, half: [1.3, 1.9, 8.2], centerOffsetZ: 1.5,
    lights: lightSpots([[-0.98, 1.4, -6.2, 'head'], [0.98, 1.4, -6.2, 'head'], [-0.95, 1.08, 9.65, 'tail'], [0.95, 1.08, 9.65, 'tail']]),
  };
}
export function buildTanker() {
  if (!tankerCache) tankerCache = tankerGeometry();
  return instantiate(tankerCache, [MAT.truckCab, MAT.glass, MAT.chrome, MAT.plastic, MAT.headlight, MAT.taillight, MAT.underbody, MAT.tank, MAT.placard]);
}

// =====================================================================================
// PLAYER PICKUP — seen from the bed all game: hero cab back, roll bar + light bar, bed
// =====================================================================================
let pickupCache = null;
function pickupGeometry() {
  const PA = 0, GL = 1, CH = 2, PL = 3, HL = 4, TL = 5, DP = 6, LN = 7, IN = 8;
  // the shared builders put interior in slot 7 / skin 8; remap later via a slot table
  const B = {
    L0: -3.04, L1: 0.17, W: 1.01, tumble: 0.035, yb: 0.42, sill: 0.52, xin: 0.68,
    axles: [-2.15], archR: 0.58, archY: 0.44, flare: 0.045, flareW: 0.26,
    shoulder: 1.1, belt: 1.27, beltRise: 0.0, hoodFront: 1.17, cowl: 1.27, hoodCrown: 0.04, hoodBulge: 0.03, deckCrown: 0.0,
    cowlZ: -1.25, deckZ: 0.12, deckY: 1.27, cornerF: 0.18, cornerR: 0.03, noseR: 0.06, tailR: 0.025, chinF: 0.12, chinR: 0.02,
    floorY: 0.62, seams: [{ z: -1.2, y0: 0.55 }, { z: 0.05, y0: 0.55 }], rockerTuck: 0.04,
  };
  const BM = bodyModel(B);
  const kit = new Kit();
  lowerBody(kit, BM, { rockerMat: PA, intCol: 0x2a2724, underMat: PL, intM: IN });
  const gh = greenhouse(kit, {
    y0: 1.27, y1: 1.93, ts: [0, 0.1, 0.5, 0.86, 1], gi0: 1, gi1: 3,
    hw: (t) => lerp(0.955, 0.85, t) + 0.01 * Math.sin(PI * t), zf: (t) => lerp(-1.25, -0.6, Math.pow(t, 0.9)), zr: (t) => lerp(0.15, 0.12, t),
    rf: (t) => lerp(0.2, 0.1, t), rr: () => 0.06, bowF: 0.06, bowR: 0.0, crown: 0.03,
    cuts: [-0.1, 0.0], sides: ['glass', 'pillar', 'pillar'], liner: 0x6a6560, intM: IN,
  });
  // cab back details: sliding rear window frame, third brake light (dark lens), drip rail
  {
    const zb = gh.ringAt(0.5).pts[gh.ringAt(0.5).pts.length - 1][2] + 0.006;
    for (const x of [-0.24, 0.24]) { const f = RBox(0.035, 0.46, 0.02, 0.008); place(f, x, 1.6, zb); kit.add(f, PL); }
    const top = RBox(0.52, 0.03, 0.02, 0.008); place(top, 0, 1.83, zb); kit.add(top, PL);
    const bot = RBox(0.52, 0.03, 0.02, 0.008); place(bot, 0, 1.37, zb); kit.add(bot, PL);
    const lat = RBox(0.05, 0.08, 0.02, 0.01); place(lat, 0.0, 1.6, zb + 0.008); kit.add(lat, CH);
    const cb = RBox(0.34, 0.045, 0.05, 0.015); place(cb, 0, gh.roofY(0, 0.1) - 0.004, 0.115); kit.add(cb, PL);
    const cbl = Box(0.3, 0.022, 0.01); place(cbl, 0, gh.roofY(0, 0.1) - 0.004, 0.142); kit.add(cbl, CH);
  }
  // ---- BED: U-section loft (outer skin, rail cap, liner walls, floor) with the rear arch
  const bz0 = 0.22, bz1 = 2.64, floorY = 0.91, xi = 0.9, railY = 1.36, ar = 1.35;
  {
    const BB = { ...B, L0: bz0, L1: bz1, axles: [ar], cornerF: 0.02, cornerR: 0.06, noseR: 0, tailR: 0.02, chinF: 0, chinR: 0.06, cowlZ: -9, deckZ: 99, belt: railY - 0.01, shoulder: 1.1 };
    const BMb = bodyModel(BB);
    const zs = [bz0, bz0 + 0.01, bz0 + 0.05];
    for (let k = 0; k <= 8; k++) zs.push(ar - BB.archR * Math.cos((k / 8) * PI));
    for (const e of [0.09, 0.22]) { zs.push(ar - BB.archR - e, ar + BB.archR + e); }
    zs.push(bz1 - 0.06, bz1 - 0.035, bz1 - 0.015, bz1 - 0.004, bz1);
    zs.sort((a, b) => a - b);
    const rings = zs.map(z => {
      const F = BMb.frame(z, 'cabin'); const top = railY;
      const Fx = { ...F, top, sh: Math.min(BB.shoulder, top - 0.06) };
      const X = (y) => BMb.xs(z, y, Fx);
      const ya = F.ya, sh = Fx.sh, yb = 0.64;
      const p = [[0, yb], [BB.xin, yb], [BB.xin, ya - 0.03], [X(ya) - 0.07, ya], [X(ya) - 0.008, ya], [X(ya + 0.014), ya + 0.014]];
      const yr = Math.min(ya + 0.06, lerp(ya, sh, 0.4)); const y7 = lerp(yr, sh, 0.45), y8 = lerp(yr, sh, 0.82);
      p.push([X(yr), yr], [X(y7), y7], [X(y8), y8], [X(sh - 0.014), sh - 0.014], [X(sh) + 0.005, sh], [X(sh) + 0.005, sh]);
      const y11 = lerp(sh, top, 0.5); p.push([X(y11), y11], [X(top), top]);
      const xt = X(top);
      p.push([xt - 0.012, top + 0.02], [xi + 0.02, top + 0.022], [xi, top - 0.005], [xi, floorY + 0.03], [xi - 0.03, floorY], [0, floorY]);
      return mirrorRing(p.map(([x, y]) => [x, y, z]));
    });
    const R = 20;
    const BAND = ['skip', 'liner', 'liner', 'liner', 'lip', 'side', 'side', 'side', 'side', 'side', 'crease', 'side', 'side', 'rail', 'rail', 'rail', 'wall', 'wall', 'floor'];
    const G = grid(rings, true);
    emitGrid(kit, G, { mat: (i, j) => { const b = BAND[mirrorBand(R, j)]; return b === 'skip' ? -1 : b === 'liner' ? PL : b === 'rail' ? PL : b === 'wall' || b === 'floor' ? LN : PA; } });
    cap(kit, rings[rings.length - 1], PA, [0, 0, 1]);
    cap(kit, rings[0], PL, [0, 0, -1]);
  }
  // floor ribs, wheel tubs, front wall, tailgate
  for (let k = 0; k < 9; k++) { const x = -0.72 + k * 0.18; const rb = RBox(0.07, 0.022, bz1 - bz0 - 0.12, 0.01); place(rb, x, floorY + 0.006, (bz0 + bz1) / 2); kit.add(rb, LN); }
  both(s => { const tb = RBox(0.3, 0.3, 1.02, 0.1); place(tb, s * (xi - 0.12), floorY + 0.08, ar); kit.add(tb, LN); });
  { const fw = Box(xi * 2, railY - floorY, 0.06); place(fw, 0, (railY + floorY) / 2, bz0 + 0.03); kit.add(fw, LN); const fc = RBox(xi * 2 + 0.06, 0.03, 0.12, 0.012); place(fc, 0, railY + 0.012, bz0 + 0.04); kit.add(fc, PL); }
  {
    const tz = bz1 - 0.03, th = 0.07;
    const tg = Box(xi * 2 - 0.01, railY - 0.66, th); place(tg, 0, (railY + 0.66) / 2, tz); kit.add(tg, PA);
    const inner = Box(xi * 2 - 0.06, railY - floorY - 0.06, 0.012); place(inner, 0, (railY + floorY) / 2, tz - th / 2 - 0.006); kit.add(inner, LN);
    for (const x of [-0.6, -0.2, 0.2, 0.6]) { const rib = RBox(0.22, railY - floorY - 0.14, 0.03, 0.012); place(rib, x, (railY + floorY) / 2, tz - th / 2 - 0.015); kit.add(rib, LN); }
    const capT = RBox(xi * 2 + 0.02, 0.045, th + 0.04, 0.015); place(capT, 0, railY + 0.012, tz); kit.add(capT, PL);
    const hd = RBox(0.3, 0.07, 0.03, 0.015); place(hd, 0, 1.2, bz1 + 0.004); kit.add(hd, PL); const hl = Box(0.22, 0.035, 0.01); place(hl, 0, 1.2, bz1 + 0.02); kit.add(hl, CH);
    both(s => { const hg = cylX(0.02, 0.06, 8); place(hg, s * (xi - 0.03), 0.7, tz); kit.add(hg, PL); const la = RBox(0.04, 0.06, 0.05, 0.01); place(la, s * (xi - 0.01), railY - 0.08, tz - 0.05); kit.add(la, CH); });
  }
  // diamond-plate rail caps, stake pockets, chrome bed rails on posts, tie-down D-rings
  both(s => {
    const dp = Box(0.13, 0.008, bz1 - bz0 - 0.08); place(dp, s * (xi + 0.065), railY + 0.026, (bz0 + bz1) / 2); kit.add(dp, DP);
    for (const z of [bz0 + 0.2, 1.4, bz1 - 0.2]) { const sp = Box(0.07, 0.006, 0.05); place(sp, s * (xi + 0.065), railY + 0.031, z); kit.add(sp, PL); }
    const rx = s * (xi + 0.07), ry = railY + 0.16;
    tube(kit, [[rx, ry - 0.05, 0.45], [rx, ry, 0.55], [rx, ry, 2.35], [rx, ry - 0.05, 2.45]], 0.022, CH, 8);
    for (const z of [0.5, 1.4, 2.4]) { kit.add(limb([rx, railY + 0.03, z], [rx, ry, z], 0.016, 0.016, 8, false), CH); const ft = RBox(0.06, 0.02, 0.08, 0.008); place(ft, rx, railY + 0.035, z); kit.add(ft, CH); }
    for (const z of [bz0 + 0.18, bz1 - 0.2]) {
      const base = RBox(0.02, 0.08, 0.1, 0.008); place(base, s * (xi - 0.012), floorY + 0.28, z); kit.add(base, CH);
      const ring = new THREE.TorusGeometry(0.035, 0.008, 5, 10, PI); place(ring, s * (xi - 0.03), floorY + 0.25, z, 0, PI / 2, PI); kit.add(ring, CH);
    }
  });
  // ---- ROLL BAR (chrome hoop + braces + slim LED light bar)
  {
    const z = 0.42, xs0 = 0.84, yb = railY + 0.03, yt = 2.2, r = 0.038;
    const hoop = [[-xs0, yb, z], [-xs0, yt - 0.18, z], ...arcPts(-(xs0 - 0.16), yt - 0.18, 0.16, PI, PI / 2, 5).slice(1).map(([x, y]) => [x, y, z]), ...arcPts(xs0 - 0.16, yt - 0.18, 0.16, PI / 2, 0, 5).map(([x, y]) => [x, y, z]), [xs0, yb, z]];
    tube(kit, hoop, r, CH, 12);
    both(s => {
      tube(kit, [[s * xs0, yt - 0.3, z + 0.02], [s * xs0, yb + 0.02, z + 0.55]], r * 0.8, CH, 10);
      for (const [pz, w] of [[z, 0.14], [z + 0.57, 0.12]]) { const pl = RBox(0.12, 0.02, w, 0.008); place(pl, s * xs0, yb - 0.01, pz); kit.add(pl, CH); }
    });
    // light bar on the hoop top, facing forward; finned black housing toward the player
    const ly = yt + 0.075;
    const hs = RBox(1.12, 0.07, 0.085, 0.02); place(hs, 0, ly, z - 0.01); kit.add(hs, PL);
    const lens = RBox(1.08, 0.04, 0.012, 0.006); place(lens, 0, ly, z - 0.056); kit.add(lens, HL);
    for (let k = 0; k < 22; k++) { const f = Box(0.006, 0.06, 0.03); place(f, -0.5 + k * (1.0 / 21), ly, z + 0.04); kit.add(f, PL); }
    both(s => { const br = RBox(0.04, 0.09, 0.05, 0.01); place(br, s * 0.5, yt + 0.02, z); kit.add(br, PL); const ep = RBox(0.03, 0.08, 0.1, 0.01); place(ep, s * 0.575, ly, z - 0.01); kit.add(ep, CH); });
  }
  // ---- rear: taillights on the bed corners, chrome step bumper, hitch, plate
  both(s => {
    const tl = RBox(0.11, 0.42, 0.06, 0.02); place(tl, s * 0.96, 1.08, bz1 + 0.012); kit.add(tl, TL);
    const rv = Box(0.08, 0.1, 0.01); place(rv, s * 0.96, 0.98, bz1 + 0.044); kit.add(rv, CH);
  });
  sweep(kit, [[1.02, 0.47, bz1 + 0.04], [0.98, 0.47, bz1 + 0.16], [-0.98, 0.47, bz1 + 0.16], [-1.02, 0.47, bz1 + 0.04]], [[-0.04, 0], [0.04, 0.0], [0.05, 0.08], [0.04, 0.2], [-0.04, 0.2]], CH);
  { const sp = Box(0.5, 0.012, 0.1); place(sp, 0, 0.675, bz1 + 0.14); kit.add(sp, PL); const hr = RBox(0.08, 0.08, 0.24, 0.01); place(hr, 0, 0.42, bz1 + 0.16); kit.add(hr, PL); }
  // ---- front: big chrome grille, headlights, bumper, tow hooks
  const zF = B.L0;
  {
    const g = RBox(1.3, 0.42, 0.06, 0.04); place(g, 0, 0.89, zF - 0.01); kit.add(g, CH);
    const bk = Box(1.16, 0.32, 0.02); place(bk, 0, 0.89, zF - 0.045); kit.add(bk, PL);
    for (let k = 0; k < 3; k++) { const b = RBox(1.2, 0.05, 0.04, 0.015); place(b, 0, 0.8 + k * 0.09, zF - 0.06); kit.add(b, CH); }
    const bar = RBox(0.08, 0.36, 0.04, 0.015); place(bar, 0, 0.89, zF - 0.065); kit.add(bar, CH);
    both(s => { const hs = RBox(0.3, 0.2, 0.08, 0.03); place(hs, s * 0.81, 0.95, zF + 0.03, 0, -s * 0.25); kit.add(hs, CH); const l = cylZ(0.06, 0.02, 12); place(l, s * 0.8, 0.96, zF - 0.015, 0, -s * 0.25); kit.add(l, HL); const dr = Box(0.24, 0.02, 0.02); place(dr, s * 0.8, 0.875, zF - 0.008, 0, -s * 0.25); kit.add(dr, HL); });
    sweep(kit, planPath(BM, 'F', 0.04, 0.2, 0.46), [[-0.06, 0], [0.04, 0], [0.08, 0.05], [0.085, 0.17], [0.06, 0.22], [-0.06, 0.22]], CH);
    both(s => { const th = new THREE.TorusGeometry(0.04, 0.012, 5, 8, PI); place(th, s * 0.55, 0.43, zF - 0.1, 0, PI / 2, 0); kit.add(th, TL); });
  }
  mirrors(kit, BM, -1.0, 1.29, PA, PL);
  handle(kit, BM, -0.35, 1.17, CH);
  // ---- interior: bench, dash, wheel, mirror (+ air freshener)
  const fl = B.floorY;
  { const bench = RBox(1.7, 0.14, 0.5, 0.04); place(bench, 0, fl + 0.27, -0.25); kit.add(bench, IN, 0x4a4036); const bb = RBox(1.72, 0.5, 0.14, 0.05); place(bb, 0, fl + 0.56, -0.02, 0.2); kit.add(bb, IN, 0x4a4036);
    const ws = Box(1.8, 0.02, 0.5); place(ws, 0, 1.28, -0.07); kit.add(ws, IN, 0x2a2622); }
  { const d = RBox(1.8, 0.2, 0.42, 0.06); place(d, 0, 1.18, -1.05); kit.add(d, IN, 0x1a1918); }
  steering({ add: (g, m, c) => kit.add(g, IN, c) }, [-0.45, 1.27, -0.75]);
  { const rm = RBox(0.22, 0.06, 0.03, 0.01); place(rm, 0, 1.8, -0.72); kit.add(rm, PL); const af = Box(0.05, 0.08, 0.004); place(af, 0, 1.69, -0.72, 0, 0.4); kit.add(af, IN, 0x2a7a3a); }
  // props in the bed: ammo crate + jerry can (vertex-coloured interior slot)
  {
    const cx = -0.6, cz = bz1 - 0.42;
    const cr = RBox(0.56, 0.3, 0.38, 0.015); place(cr, cx, floorY + 0.165, cz); kit.add(cr, IN, 0x3f4a2a);
    const lid = RBox(0.58, 0.04, 0.4, 0.012); place(lid, cx, floorY + 0.33, cz); kit.add(lid, IN, 0x34401f);
    for (const s2 of [-1, 1]) { const h = Box(0.02, 0.03, 0.12); place(h, cx + s2 * 0.29, floorY + 0.22, cz); kit.add(h, PL); }
    for (const ox of [-0.2, 0.2]) { const l = Box(0.04, 0.012, 0.402); place(l, cx + ox, floorY + 0.352, cz); kit.add(l, IN, 0x2a2f1a); }
    const st = Box(0.3, 0.06, 0.004); place(st, cx, floorY + 0.18, cz - 0.192); kit.add(st, IN, 0xc9b98a);
    const jc = RBox(0.17, 0.42, 0.33, 0.03); place(jc, 0.76, floorY + 0.22, bz0 + 0.34); kit.add(jc, IN, 0x8a1a12);
    const sp = cylX(0.025, 0.04, 8); place(sp, 0.76, floorY + 0.45, bz0 + 0.25, 0, 0, 0.6); kit.add(sp, IN, 0x202020);
    for (const oz of [-0.06, 0.06]) { const hh = Box(0.03, 0.03, 0.04); place(hh, 0.76, floorY + 0.45, bz0 + 0.38 + oz); kit.add(hh, IN, 0x8a1a12); }
  }
  // driver (separate mesh so it can be animated): interior slot 0, skin slot 1
  const dk = new Kit();
  const dpk = { add: (g, m, c) => dk.add(g, m === SKIN ? 1 : 0, c), parts: dk.parts };
  person(dpk, -0.45, fl + 0.36, -0.28, { top: 0x4a5a3a, sleeve: 0x4a5a3a, legs: 0x2a2f38, hairStyle: 'cap', capCol: 0x1c1c1e, glasses: 0x050505, wheel: [-0.45, 1.27, -0.75] });
  const wheelPos = [[-0.88, 0.44, -2.15], [0.88, 0.44, -2.15], [-0.88, 0.44, 1.35], [0.88, 0.44, 1.35]];
  calipers(kit, wheelPos, 0.29, 0.16, PL);
  // decal: side dust + tailgate letters + plate
  const S = { z0: -3.1, z1: 2.7, y0: 0.45, y1: 1.4 };
  const atlas = makeAtlas({ S, seed: 51, axles: [-2.15, 1.35], archY: 0.44, dustA: 0.5, plate: '8BAY666', rearBadge: 'HAMMERHEAD', rearBadgeSize: 70, markers: [[-2.85, 0.85, 'rgba(255,150,40,0.9)'], [2.5, 0.95, 'rgba(200,20,10,0.9)']] });
  const T = new TriBuf();
  decalQuad(T, [0, 1.06, bz1 + 0.007], [0.5, 0, 0], [0, 0.11, 0], BADGE);
  decalQuad(T, [0, 0.58, bz1 + 0.205], [0.15, 0, 0], [0, 0.075, 0], PLATE_R);
  return { geometry: kit.build(), driverGeo: dk.build(), decal: { geo: T.geo(), mat: decalMaterial(atlas) }, wheel: wheelGeometry({ R: 0.44, w: 0.32, rimR: 0.27, style: 'offroad', faceCol: 0x3a3b3e, lipCol: 0xffffff, capCol: 0xffffff }), wheelPos, bed: { z0: 0.25, z1: 2.6, floorY: 0.91, halfW: 0.78 } };
}
export function buildPickup() {
  if (!pickupCache) pickupCache = pickupGeometry();
  const c = pickupCache;
  const mesh = new THREE.Mesh(c.geometry, [MAT.paintRed, MAT.glassLight, MAT.chrome, MAT.plastic, MAT.headlight, MAT.taillight, MAT.diamond, MAT.bedLiner, MAT.interior]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const root = new THREE.Group(); root.add(mesh);
  const decal = new THREE.Mesh(c.decal.geo, c.decal.mat); decal.renderOrder = 2; root.add(decal);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 6.6), MAT.blob); blob.rotation.x = -PI / 2; blob.position.set(0, 0.03, -0.3); root.add(blob);
  const wheels = [];
  for (const [x, y, z] of c.wheelPos) {
    const w = new THREE.Mesh(c.wheel, [MAT.tireTread, MAT.wheelMetal]); w.position.set(x, y, z); w.castShadow = true;
    if (x < 0) w.rotation.y = PI;
    root.add(w); wheels.push(w);
  }
  const driver = new THREE.Group();
  const dm = new THREE.Mesh(c.driverGeo, [MAT.interior, MAT.skins[1]]); dm.castShadow = true; driver.add(dm);
  root.add(driver);
  return { root, mesh, wheels, bed: { ...c.bed }, driver, decal };
}

// =====================================================================================
// BULLET HOLES — snapped onto the real curved surface (the hitbox is a box)
// =====================================================================================
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _s = new THREE.Vector3(1, 1, 1);
const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _hits = [];
export function addBulletHole(v, localPoint, localNormal) {
  const p = localPoint.clone(), n = localNormal.clone();
  if (v.mesh && v.root) {
    v.root.updateMatrixWorld();
    _o.copy(localPoint).addScaledVector(localNormal, 0.35).applyMatrix4(v.root.matrixWorld);
    _d.copy(localNormal).negate().transformDirection(v.root.matrixWorld);
    _ray.set(_o, _d); _ray.far = 0.9; _hits.length = 0;
    v.mesh.raycast(_ray, _hits);
    _hits.sort((a, b) => a.distance - b.distance);
    const h = _hits.find(h => h.face && v.mesh.material[h.face.materialIndex] !== MAT.glass && h.face.materialIndex !== 1);
    if (h) { p.copy(h.point); v.root.worldToLocal(p); n.copy(h.face.normal); }
  }
  _q.setFromUnitVectors(_z, n);
  _m.compose(p.addScaledVector(n, 0.006), _q, _s.setScalar(0.6 + rand() * 0.6));
  const i = v.holeN % 24;
  v.holes.setMatrixAt(i, _m);
  v.holeN++;
  v.holes.count = Math.min(24, v.holeN);
  v.holes.instanceMatrix.needsUpdate = true;
}
