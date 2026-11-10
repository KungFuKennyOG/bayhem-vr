import * as THREE from 'three';
import { snowTextures, stoneTextures, concreteTextures, rockTextures } from './tex.js';

// =====================================================================================
//  Kit for the static art: a merge bucket (any geometry + matrix + vertex colour, flattened into
//  one BufferGeometry per material), and the materials — every one of them patched with SNOW:
//  snow settles on whatever faces up (a noisy, soft-edged cap) and rime frost feathers the windward
//  side. Snow on top of everything is what makes it read "blizzard" instead of "grey props".
// =====================================================================================
const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
export const WIND = new THREE.Vector3(0.84, 0, 0.54).normalize();   // where the wind blows TO

export class Bucket {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.idx = []; this.vn = 0; }
  get tris() { return this.idx.length / 3; }
  // add a geometry transformed by m (Matrix4); col = [r,g,b] or fn(worldPos, worldNormal, localPos) -> [r,g,b]
  add(geo, m = null, col = [1, 1, 1], { uvScale = 0 } = {}) {
    const g = geo.index ? geo : geo;
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color;
    if (m) _m3.getNormalMatrix(m);
    const base = this.vn;
    const fn = typeof col === 'function' ? col : null;
    const lp = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      lp.set(P.getX(i), P.getY(i), P.getZ(i));
      _p.copy(lp); if (m) _p.applyMatrix4(m);
      if (N) { _n.set(N.getX(i), N.getY(i), N.getZ(i)); if (m) _n.applyMatrix3(_m3).normalize(); } else _n.set(0, 1, 0);
      this.p.push(_p.x, _p.y, _p.z); this.n.push(_n.x, _n.y, _n.z);
      if (uvScale) { // world-space box mapping
        const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
        if (ay >= ax && ay >= az) this.uv.push(_p.x / uvScale, _p.z / uvScale); else if (ax >= az) this.uv.push(_p.z / uvScale, _p.y / uvScale); else this.uv.push(_p.x / uvScale, _p.y / uvScale);
      } else if (U) this.uv.push(U.getX(i), U.getY(i)); else this.uv.push(0, 0);
      let c = fn ? fn(_p, _n, lp) : col;
      if (C) c = [c[0] * C.getX(i), c[1] * C.getY(i), c[2] * C.getZ(i)];
      this.c.push(c[0], c[1], c[2]);
      this.vn++;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < P.count; i++) this.idx.push(base + i);
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.vn > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  mesh(mat, { shadow = true, receive = true, name = '' } = {}) {
    const m = new THREE.Mesh(this.build(), mat);
    m.castShadow = shadow; m.receiveShadow = receive; m.name = name;
    return m;
  }
}
export const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

// rounded box (bevelled) geometry
export function rbox(w, h, d, r = 0.02, seg = 1) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  if (r > 0) {
    const P = g.attributes.position, hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const cx = Math.max(-hw, Math.min(hw, x)), cy = Math.max(-hh, Math.min(hh, y)), cz = Math.max(-hd, Math.min(hd, z));
      const dx = x - cx, dy = y - cy, dz = z - cz, L = Math.hypot(dx, dy, dz) || 1;
      P.setXYZ(i, cx + dx / L * r, cy + dy / L * r, cz + dz / L * r);
    }
    g.computeVertexNormals();
  }
  return g;
}
// a soft lump of snow (caps on walls / roofs / cars): a flattened, noise-displaced box top
export function snowCap(w, d, h = 0.18, seed = 1, segW = 6, segD = 3) {
  const g = new THREE.BoxGeometry(w, h, d, segW, 1, segD);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const top = y > 0;
    const ex = Math.abs(x) / (w / 2), ez = Math.abs(z) / (d / 2), edge = Math.max(ex, ez);
    const n = Math.sin(x * 3.1 + seed) * 0.5 + Math.sin(z * 4.7 + seed * 1.7) * 0.3 + Math.sin((x + z) * 7.3 + seed * 2.3) * 0.2;
    if (top) y = h / 2 + n * h * 0.35 - edge * edge * h * 0.8;
    // overhang a little and droop at the edges
    x *= 1.04; z *= 1.04;
    if (!top) y = -h / 2 - (edge > 0.95 ? h * 0.25 : 0);
    P.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// a snow drift banked against a wall: a lumpy wedge (local: along x, out of the wall along +z, up +y)
export function driftWedge(len, h = 1.0, d = 1.8, seed = 1) {
  const nx = Math.max(4, Math.round(len / 0.9)), nz = 5;
  const pos = [], idx = [];
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) {
    const x = -len / 2 + len * i / nx, t = k / nz;
    const wob = 1 + 0.25 * Math.sin(x * 1.3 + seed) + 0.15 * Math.sin(x * 3.7 + seed * 2.1);
    const end = Math.min(1, Math.min(i, nx - i) / 2.5);
    const hh = h * wob * end;
    pos.push(x, hh * Math.pow(1 - t, 1.6), t * d * wob * (0.6 + 0.4 * end));
  }
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const a = i * (nz + 1) + k, b = a + nz + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// the solid core of a drift (where it is knee-high or more) as a world AABB [x0, y0, z0, x1, y1, z1], for a collider:
// you walk up to a drift, not through it. m = the drift's placement matrix (as passed to Bucket.add)
export function driftBox(len, h, m) {
  const e = Math.min(len * 0.25, 1.2), a = new THREE.Vector3(), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let k = 0; k < 8; k++) {
    a.set(k & 1 ? len / 2 - e : -len / 2 + e, k & 2 ? h * 0.8 : 0.05, k & 4 ? h * 0.85 : 0).applyMatrix4(m);
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a.getComponent(i)); hi[i] = Math.max(hi[i], a.getComponent(i)); }
  }
  return [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]];
}

// ---------------------------------------------------------------- the snow patch (any MeshStandardMaterial)
// amt: how much settles on the top faces; rime: frost on the windward faces; the cap colour is the snow's own
const SNOWU = { uWind: { value: WIND }, uSnowAmt: { value: 1 } };
export function snowPatch(mat, { amt = 1, rime = 0.35, key = 'x' } = {}) {
  const prev = mat.onBeforeCompile;
  mat.userData.snow = { amt, rime };
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uWind = SNOWU.uWind; sh.uniforms.uSnowAmt = SNOWU.uSnowAmt;
    sh.uniforms.uSnowK = { value: amt }; sh.uniforms.uRimeK = { value: rime };
    if (!sh.vertexShader.includes('vSWN')) sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSWN; varying vec3 vSWP;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vSWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uWind; uniform float uSnowAmt; uniform float uSnowK; uniform float uRimeK;
varying vec3 vSWN; varying vec3 vSWP; float snowCov;
float snh(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float snv(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(snh(i), snh(i + vec3(1,0,0)), f.x), mix(snh(i + vec3(0,1,0)), snh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(snh(i + vec3(0,0,1)), snh(i + vec3(1,0,1)), f.x), mix(snh(i + vec3(0,1,1)), snh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float n = snv(vSWP * 2.3) * 0.6 + snv(vSWP * 7.1) * 0.4;
    float up = smoothstep(0.42, 0.78, vSWN.y + (n - 0.5) * 0.5);
    float nf = snv(vSWP * 19.0);
    float rime = smoothstep(0.1, 0.9, dot(vSWN, -uWind)) * (1.0 - abs(vSWN.y)) * (0.55 + 0.45 * nf) * (0.6 + 0.4 * n);
    snowCov = clamp(max(up * uSnowK, rime * uRimeK) * uSnowAmt, 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.85, 0.93) * (0.92 + 0.08 * n), snowCov);
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.78, snowCov);');
    // metalness has to be overridden after its own chunk
    sh.fragmentShader = sh.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= (1.0 - snowCov);');
  };
  const pk = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => (pk ? pk() : '') + '|snow' + key + amt + '_' + rime;
  return mat;
}

// ---------------------------------------------------------------- materials (shared)
const MATS = {};
const once = (k, fn) => MATS[k] || (MATS[k] = fn());
export const mats = {
  stone: () => once('stone', () => { const t = stoneTextures(); return snowPatch(new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(0.9, 0.9), color: 0xe4ddd2, roughness: 0.88, vertexColors: true }), { amt: 1, rime: 0.4, key: 'st' }); }),
  concrete: () => once('concrete', () => { const t = concreteTextures(); return snowPatch(new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xdcd8d0, roughness: 0.9, vertexColors: true }), { amt: 1, rime: 0.3, key: 'cc' }); }),   // lighter: the shaded faces read black in the storm
  // indoors: no snow on the floors
  concreteIn: () => once('concreteIn', () => { const t = concreteTextures(); const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xbab6b0, roughness: 0.75, vertexColors: true }); return m; }),
  paintIn: () => once('paintIn', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35, vertexColors: true })),
  // painted steel (colour from the vertex colours), a little rust and frost
  paint: () => once('paint', () => snowPatch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35, vertexColors: true }), { amt: 0.9, rime: 0.45, key: 'pt' })),
  cabin: () => once('cabin', () => snowPatch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.2, vertexColors: true }), { amt: 0.7, rime: 0.0, key: 'cb' })),
  metal: () => once('metal', () => snowPatch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.75, vertexColors: true }), { amt: 0.7, rime: 0.5, key: 'mt' })),
  wood: () => once('wood', () => snowPatch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, vertexColors: true }), { amt: 1, rime: 0.35, key: 'wd' })),
  snow: () => once('snow', () => { const t = snowTextures(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(0.35, 0.35), color: 0xdbe1ec, roughness: 0.8, vertexColors: true }); }),
  // wet dark gorge rock: snow only on the ledges, no rime (vertical walls must stay dark in the fog)
  rockBare: () => once('rockBare', () => { const t = rockTextures(); return snowPatch(new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(1, 1), color: 0x6e7076, roughness: 0.6, vertexColors: true }), { amt: 0.8, rime: 0.0, key: 'rkb' }); }),
  rock: () => once('rock', () => { const t = rockTextures(); return snowPatch(new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(1, 1), color: 0xa2a6ae, roughness: 0.8, vertexColors: true }), { amt: 1, rime: 0.5, key: 'rk' }); }),
  // things that glow: lamp lenses, lit windows, beacons (emissive from the vertex colour)
  lamp: () => once('lamp', () => { const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.4, vertexColors: true }); m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;'); }; m.customProgramCacheKey = () => 'wo-lamp'; return m; }),
  glass: () => once('glass', () => new THREE.MeshStandardMaterial({ color: 0x9aa8b6, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 1.4 })),
};
// a vertex colour fn: dark at the foot (grime / AO near the ground), lighter up top
export const footAO = (y0, h = 1.2, k = 0.45, base = [1, 1, 1]) => (p) => { const t = Math.min(1, Math.max(0, (p.y - y0) / h)); const f = 1 - k * (1 - t) * (1 - t); return [base[0] * f, base[1] * f, base[2] * f]; };
export const hexc = (h, k = 1) => { const c = new THREE.Color(h); return [c.r * k, c.g * k, c.b * k]; };

// ---- light pools on floors that aren't terrain (the terrain bakes its own): additive radial decals, one draw
let _poolTex = null;
export function floorPools(list) {
  if (!_poolTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); _poolTex = new THREE.CanvasTexture(c); _poolTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.MeshBasicMaterial({ map: _poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(g, m, list.length);
  const M = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach((P, i) => { M.makeScale(P.r * 2, 1, P.r * 2).setPosition(P.p[0], P.p[1] + 0.02, P.p[2]); mesh.setMatrixAt(i, M); mesh.setColorAt(i, col.setRGB(P.c[0], P.c[1], P.c[2])); });
  mesh.renderOrder = 3; mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}
// blue-grey contact shadow bands where walls, tanks and vehicles meet the snow: a soft strip (half under the wall)
export const aoStrips = (list) => groundPatches(list, { color: 0x3c4658, opacity: 0.5 });

// ---- tyre / track marks on flat snow: strips that follow a polyline on the ground (two ruts with tread), one draw
let _treadTex = null;
export function trackDecals(paths, groundFn) {
  if (!_treadTex) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
    x.clearRect(0, 0, 128, 256);
    for (const cx of [22, 106]) {
      const gr = x.createLinearGradient(cx - 14, 0, cx + 14, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.25, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(cx - 14, 0, 28, 256);
      x.fillStyle = 'rgba(0,0,0,0.4)'; for (let y = 0; y < 256; y += 16) { x.beginPath(); x.moveTo(cx - 11, y); x.lineTo(cx, y + 6); x.lineTo(cx + 11, y); x.lineTo(cx + 11, y + 4); x.lineTo(cx, y + 10); x.lineTo(cx - 11, y + 4); x.fill(); }
    }
    _treadTex = new THREE.CanvasTexture(c); _treadTex.wrapT = THREE.RepeatWrapping; _treadTex.colorSpace = THREE.SRGBColorSpace;
  }
  const pos = [], uv = [], idx = [];
  for (const { pts, w = 2.6 } of paths) {
    // resample the polyline every 1.5 m
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 1.5)); for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
    P.push(pts[pts.length - 1]);
    let v = 0; const base = pos.length / 3;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (i > 0) v += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]) / (w * 2);
      for (const s of [-1, 1]) { const x = P[i][0] - tz * s * w / 2, z = P[i][1] + tx * s * w / 2; pos.push(x, groundFn(x, z) + 0.035, z); uv.push(s < 0 ? 0 : 1, v); }
      if (i > 0) { const q = base + (i - 1) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: 0xa7adb8, alphaMap: _treadTex, transparent: true, opacity: 0.4, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide });
  // the alpha map is black = opaque here: invert it in the shader
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', 'diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;'); };
  m.customProgramCacheKey = () => 'wo-tread';
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 2; mesh.receiveShadow = true;
  return mesh;
}

// ---- trodden / packed patches on flat snow (grey-brown slush at doors, loading bays, round the stacks): one draw
export function groundPatches(list, { color = 0x7a7468, opacity = 0.55, key = 'wo-patch' } = {}) {
  if (!_poolTex) floorPools([]);
  const m = new THREE.MeshStandardMaterial({ color, alphaMap: _poolTex, transparent: true, opacity, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', 'diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;'); };
  m.customProgramCacheKey = () => 'wo-patch';
  const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(g, m, list.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((P, i) => { M.compose(new THREE.Vector3(P.x, P.y + 0.03, P.z), q.setFromEuler(e.set(0, P.yaw || 0, 0)), new THREE.Vector3(P.w, 1, P.d)); mesh.setMatrixAt(i, M); });
  mesh.renderOrder = 2; mesh.receiveShadow = true;
  return mesh;
}

// ---- a light cone through the falling snow (sodium floodlights, the light tower): additive, view-angle faded
const _coneMats = {};
export function lightCone(from, to, { color = [1.0, 0.68, 0.32], k = 0.07, spread = 0.36 } = {}) {
  const key = color.join(',') + k;
  const m = _coneMats[key] ||= new THREE.ShaderMaterial({
    uniforms: { uK: { value: 1 }, uCol: { value: new THREE.Color(...color) } },
    vertexShader: /* glsl */`varying float vT; varying vec3 vN; varying vec3 vV; void main(){ vT = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform float uK; uniform vec3 uCol; varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.4); float a = pow(vT, 1.6) * (1.0 - smoothstep(0.0, 0.25, 1.0 - vT) * 0.0) * edge * ${k.toFixed(3)} * uK; gl_FragColor = vec4(uCol * a, 0.0); }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide, fog: false,
  });
  const L = from.distanceTo(to) * 1.05;
  const g = new THREE.ConeGeometry(L * spread, L, 18, 1, true); g.translate(0, -L / 2, 0); g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(from); mesh.lookAt(to); mesh.rotateY(Math.PI);
  mesh.renderOrder = 22; mesh.frustumCulled = true;
  return mesh;
}
export const coneMaterials = () => Object.values(_coneMats);

// trodden lanes along a set of polylines: overlapping stretched patches (the grey-brown churn under the tyre tracks)
export function lanePatches(paths, y, w = 6) {
  const out = [];
  for (const pts of paths) for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 5));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; out.push({ x: ax + (bx - ax) * t, y, z: az + (bz - az) * t, w: w * (0.85 + 0.3 * ((k * 7919) % 13) / 13), d: (L / n) * 1.9, yaw: Math.atan2(bx - ax, bz - az) }); }
  }
  return groundPatches(out);
}
