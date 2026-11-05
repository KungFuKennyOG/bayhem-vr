import * as THREE from 'three';
import { SUN_DIR } from '../../atmosphere.js';
import { DAY } from './tod.js';

// =====================================================================================
//  City-wide sun shadows in 2.5D. The realtime shadow map only covers ~40 m round the player, and
//  hard afternoon light lives or dies on the big shapes: sunlit tops over shaded street canyons, the
//  shadow line of the opposite block halfway up a facade. So every static surface marches a ray
//  toward the sun over a building-height map (1024², ~0.66 m texels over the whole city, one byte =
//  one metre) and scales the sun's light by what it finds. The map is rasterised from the collision
//  boxes once at load. A matching invisible box mesh casts into the realtime shadow map, so cars and
//  people near you darken when they walk into a building's shadow too.
// =====================================================================================
export const SH = { x0: -340, z0: -320, x1: 340, z1: 340, res: 1024 };
export const SUN = {
  tex: { value: null },
  bounds: { value: new THREE.Vector4(SH.x0, SH.z0, 1 / (SH.x1 - SH.x0), 1 / (SH.z1 - SH.z0)) },
  dir: { value: new THREE.Vector3(0, 1, 0) },
};
let heights = null;

// rasterise [x0, z0, x1, z1, h] footprints into the height map; returns the caster boxes for the proxy mesh
export function buildSunMap(col, extra = []) {
  const { res } = SH, sx = res / (SH.x1 - SH.x0), sz = res / (SH.z1 - SH.z0);
  heights = new Uint8Array(res * res);
  const boxes = [];
  const put = (x0, z0, x1, z1, h) => {
    const i0 = Math.max(0, Math.floor((x0 - SH.x0) * sx)), i1 = Math.min(res - 1, Math.ceil((x1 - SH.x0) * sx) - 1);
    const k0 = Math.max(0, Math.floor((z0 - SH.z0) * sz)), k1 = Math.min(res - 1, Math.ceil((z1 - SH.z0) * sz) - 1);
    const v = Math.min(255, Math.round(h));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) { const j = k * res + i; if (heights[j] < v) heights[j] = v; }
  };
  for (const b of col.boxes) {
    if (!b.enabled) continue;
    const dx = b.max.x - b.min.x, dz = b.max.z - b.min.z, h = b.max.y;
    if (h < 3 || Math.min(dx, dz) < 1.6 || b.data.kind === 'bound' || b.data.thin) continue;
    // something you could stand under (a deck slab / a bridge) still throws its shadow from above
    put(b.min.x, b.min.z, b.max.x, b.max.z, h);
    boxes.push(b);
  }
  for (const [x0, z0, x1, z1, h] of extra) { put(x0, z0, x1, z1, h); boxes.push({ min: { x: x0, y: 0, z: z0 }, max: { x: x1, y: h, z: z1 } }); }
  const tex = new THREE.DataTexture(heights, res, res, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; tex.flipY = false; tex.needsUpdate = true;
  SUN.tex.value = tex;
  SUN.dir.value.copy(SUN_DIR).normalize();
  return boxes;
}
export function heightAt(x, z) {
  if (!heights) return 0;
  const i = Math.floor((x - SH.x0) * SH.res / (SH.x1 - SH.x0)), k = Math.floor((z - SH.z0) * SH.res / (SH.z1 - SH.z0));
  if (i < 0 || k < 0 || i >= SH.res || k >= SH.res) return 0;
  return heights[k * SH.res + i];
}
// the same march on the CPU (for sprites / anything without the shader patch)
export function sunVisAt(x, y, z) {
  const L = SUN.dir.value, hl = Math.hypot(L.x, L.z) || 1e-3, dx = L.x / hl, dz = L.z / hl, tanE = L.y / hl;
  let t = 0.4;
  for (let i = 0; i < 16; i++) { if (heightAt(x + dx * t, z + dz * t) > y + t * tanE) return 0; t = t * 1.36 + 0.6; }
  return 1;
}

// an invisible mesh of the casters, for the realtime shadow map (cars / people / props near you)
export function casterMesh(boxes) {
  const pos = [], idx = [];
  for (const b of boxes) {
    const v = pos.length / 3, x0 = b.min.x, x1 = b.max.x, z0 = b.min.z, z1 = b.max.z, y0 = Math.max(0, b.min.y), y1 = b.max.y;
    pos.push(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1);
    for (const f of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]]) idx.push(v + f[0], v + f[1], v + f[2], v + f[0], v + f[2], v + f[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = false; m.renderOrder = -100; m.name = 'sunCasters';
  return m;
}

const GLSL = /* glsl */`
uniform sampler2D tSunH; uniform vec4 uSunHB; uniform vec3 uSunL;
varying vec3 vSunW;
float sunVis(vec3 p, vec3 n){
  if (dot(n, uSunL) <= 0.0) return 1.0;               // facing away: the lambert term is 0 anyway
  float hl = max(length(uSunL.xz), 1e-3);
  vec2 dxz = uSunL.xz / hl; float tanE = uSunL.y / hl;
  vec3 o = p + n * 0.9 + vec3(0.0, 0.06, 0.0);
  float vis = 1.0, t = 0.4;
  for (int i = 0; i < 16; i++) {
    vec2 q = o.xz + dxz * t;
    float h = texture2D(tSunH, (q - uSunHB.xy) * uSunHB.zw).r * 255.0;
    vis = min(vis, clamp((o.y + t * tanE - h) * 0.9 + 0.5, 0.0, 1.0));
    t = t * 1.36 + 0.6;
  }
  return vis;
}`;
// patch a MeshStandardMaterial: the directional light (the sun) is scaled by sunVis. Chains any
// existing onBeforeCompile.
export function patchSun(mat) {
  if (!DAY.on || mat.userData.sunPatched) return mat;
  mat.userData.sunPatched = true;
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey?.bind(mat);
  mat.onBeforeCompile = (s, r) => {
    if (prev) prev.call(mat, s, r);
    s.uniforms.tSunH = SUN.tex; s.uniforms.uSunHB = SUN.bounds; s.uniforms.uSunL = SUN.dir;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSunW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSunW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const begin = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= sunV;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL)
      .replace('#include <lights_fragment_begin>', `float sunV = sunVis(vSunW, normalize((vec4(normal, 0.0) * viewMatrix).xyz));\n${begin}`);
  };
  mat.customProgramCacheKey = () => (key ? key() : '') + '|sun';
  mat.needsUpdate = true;
  return mat;
}
// every standard material under a root (the level's own art; never the shared fx / character materials)
export function patchSunTree(root) {
  if (!DAY.on) return;
  root.traverse(o => { if (!o.isMesh || o.name === 'sunCasters') return; for (const m of [].concat(o.material)) if (m && m.isMeshStandardMaterial) patchSun(m); });
}
