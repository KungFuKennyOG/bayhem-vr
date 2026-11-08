import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { TERR, terrainAt, bakeTerrain, farHeight, fbm2, ridged, walkable, ROAD, LINE, TRACK_X, GAZEX } from './layout.js';
import { rockTextures, snowTextures } from './tex.js';

// =====================================================================================
//  The mountain: chunked heightfield (2 / 4 / 8 m LOD by distance to where you can walk, skirts
//  hide the cracks, ONE merged draw), a far mesh out to 9 km (ridged peaks, only really seen when
//  the storm breaks at the summit), and the snow / rock shader: wind-rippled snow with blue
//  shadows and glints, triplanar granite where it's too steep for snow to stick, vertex AO in the
//  creases, warm lamp / fire pools baked as emissive.
// =====================================================================================
const CH = 32;   // chunk size (m)
// trodden paths / vehicle tracks across the yards (darker, compacted, a little bluer)
const PATHS = [
  [54, 38, 85, 9, 3.5], [66, 30, 104, 16, 2.6], [85, 9, 112, 30, 3.2],
  [87, -324, 90, -381, 2.6], [87, -324, 108, -379, 2.4], [60, -332, 142, -372, 3.4], [142, -372, 96, -372, 3.4], [96, -372, 62, -352, 3.0],
];
function pathK(x, z) {
  let k = 0;
  for (const [ax, az, bx, bz, w] of PATHS) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; let t = ((x - ax) * dx + (z - az) * dz) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    k = Math.max(k, 1 - Math.min(1, Math.max(0, d - w * 0.4) / (w * 0.6)));
  }
  return k * (0.7 + 0.3 * fbm2(x * 0.3, z * 0.3));
}

// shared snow / rock material (also used by the far mesh and the rocks)
export const alpenU = { value: 0 };
export const scourU = { value: -1e9 };   // the avalanche's wake: snow behind its front (z < this) is scoured grey-blue   // 0 in the storm → 1 when it has broken: alpenglow on the high faces
export function snowRockMaterial({ far = false } = {}) {
  const S = snowTextures(), R = rockTextures();
  const m = new THREE.MeshStandardMaterial({ map: S.map, normalMap: S.normal, normalScale: new THREE.Vector2(0.3, 0.3), color: 0xffffff, roughness: 0.8, metalness: 0, vertexColors: true });
  m.userData.u = { rockMap: { value: R.map }, rockNrm: { value: R.normal }, uSpark: { value: 1 }, uFar: { value: far ? 1 : 0 }, uAlpen: alpenU, uScour: scourU };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRock; attribute vec3 aGlow;\nvarying vec3 vWP; varying vec3 vWN; varying float vRock; varying vec3 vGlow;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal); vRock = aRock; vGlow = aGlow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D rockMap; uniform sampler2D rockNrm; uniform float uSpark; uniform float uFar; uniform float uAlpen; uniform float uScour;
varying vec3 vWP; varying vec3 vWN; varying float vRock; varying vec3 vGlow;
float rkW; float snowAmt;
float wh3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
vec3 triRock(vec3 p, vec3 n, float s){
  vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
  return texture2D(rockMap, p.zy * s).rgb * b.x + texture2D(rockMap, p.xz * s).rgb * b.y + texture2D(rockMap, p.xy * s).rgb * b.z;
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  // the snow map is planar (xz): on steep banks it smears into streaks, so fade it to its mean there
  diffuseColor.rgb = mix(vec3(0.9, 0.92, 0.95), diffuseColor.rgb, smoothstep(0.5, 0.82, vWN.y));
  {
    vec3 rock = triRock(vWP, vWN, uFar > 0.5 ? 0.012 : 0.22);
    vec3 rock2 = triRock(vWP + 13.0, vWN, uFar > 0.5 ? 0.0035 : 0.045);
    rock = mix(rock, rock2, 0.45) * vec3(0.9, 0.86, 0.82);
    float lum = dot(rock, vec3(0.33));
    // snow sticks in the hollows of the rock, slides off the steep proud bits
    rkW = smoothstep(0.42, 0.7, vRock + (0.3 - lum) * 1.3 + (vWN.y - 0.7) * -0.3);
    snowAmt = 1.0 - rkW;
    // wind-scoured patches (crust, a little greyer and bluer) vs fresh drifts (bright)
    vec2 wq = vWP.xz * 0.045;
    float scour = smoothstep(0.45, 1.05, texture2D(rockMap, wq * 0.37 + 0.13).r * 1.6 - 0.1) * (1.0 - rkW) * 0.7;
    vec3 snowC = diffuseColor.rgb * vec3(0.84, 0.88, 0.95) * mix(1.0, 0.86, scour) + vec3(-0.02, -0.005, 0.02) * scour;
    // a value ramp on the snow: slopes turned to the sun warm off-white, slopes turned away and steep banks blue
    float lit = dot(vWN.xz, normalize(vec2(-0.8, 0.6))) + (vWN.y - 0.85) * 0.9;
    snowC *= mix(vec3(0.8, 0.84, 0.93), vec3(1.0, 0.98, 0.95), smoothstep(-0.35, 0.3, lit)) * 0.88;   // headroom: lit snow is not paper white, shade a steel blue
    // alpenglow: once the storm breaks the high sunlit faces go pink-orange against the blue shade
    snowC *= mix(vec3(1.0), vec3(1.16, 0.9, 0.8), uAlpen * smoothstep(170.0, 420.0, vWP.y) * smoothstep(-0.1, 0.5, lit));
    snowC *= mix(vec3(1.0), vec3(0.74, 0.79, 0.88), smoothstep(uScour + 12.0, uScour - 18.0, vWP.z) * step(-720.0, vWP.z) * step(vWP.y, 400.0));
    diffuseColor.rgb = mix(snowC, rock * 0.95, rkW);
  }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.72, 0.62, rkW);')
      .replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * (0.25 + 0.75 * snowAmt);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  // snow glints: a sparse lattice of tiny facets that flash as the view moves (fade with distance)
  {
    float dist = length(vWP - cameraPosition);
    if (uSpark > 0.0 && dist < 22.0 && snowAmt > 0.5) {
      vec3 cell = floor(vWP * 26.0);
      float h = wh3(cell);
      vec3 vdir = normalize(cameraPosition - vWP);
      float tw = wh3(cell + floor(vdir * 9.0) * 7.3);
      float g = step(0.992, h) * step(0.55, tw) * (1.0 - smoothstep(6.0, 22.0, dist)) * snowAmt;
      reflectedLight.directSpecular += g * uSpark * (0.6 + directLight.color * 0.0) * vec3(1.6, 1.65, 1.8);
    }
  }`);
  };
  m.customProgramCacheKey = () => 'whiteout-snowrock-v1' + (far ? 'f' : '');
  return m;
}

// interest points: where the player can be (walk mask) + the cable line
function interestGrid() {
  const pts = [];
  for (let z = TERR.z0; z <= TERR.z1; z += 6) for (let x = TERR.x0; x <= TERR.x1; x += 6) if (walkable(x, z)) pts.push([x, z]);
  for (let z = LINE.z0; z >= LINE.z1; z -= 10) pts.push([TRACK_X[0], z]);
  // a coarse lookup: distance to nearest interest point per 16 m cell
  const nx = Math.ceil((TERR.x1 - TERR.x0) / 16) + 1, nz = Math.ceil((TERR.z1 - TERR.z0) / 16) + 1;
  const D = new Float32Array(nx * nz).fill(1e9);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const cx = TERR.x0 + i * 16, cz = TERR.z0 + k * 16;
    let best = 1e9;
    for (const [x, z] of pts) { const d = (x - cx) * (x - cx) + (z - cz) * (z - cz); if (d < best) best = d; }
    D[k * nx + i] = Math.sqrt(best);
  }
  return (x, z) => { const i = Math.round((x - TERR.x0) / 16), k = Math.round((z - TERR.z0) / 16); if (i < 0 || k < 0 || i >= nx || k >= nz) return 1e9; return D[k * nx + i]; };
}

export function buildTerrain(ctx, { pools = [] } = {}) {
  bakeTerrain();
  const root = new THREE.Group();
  const dist = interestGrid();
  const pos = [], nrm = [], uv = [], col = [], rock = [], glow = [], idx = [];
  let vbase = 0;
  const H = terrainAt;
  const nrmAt = (x, z, e, out) => { const hx = H(x + e, z) - H(x - e, z), hz = H(x, z + e) - H(x, z - e); const l = Math.hypot(hx, 2 * e, hz); out[0] = -hx / l; out[1] = 2 * e / l; out[2] = -hz / l; return out; };
  const n = [0, 0, 0];
  // vertex attributes for one terrain point
  const vert = (x, y, z, e, skirt = 0) => {
    nrmAt(x, z, Math.max(1, e * 0.75), n);
    pos.push(x, y - skirt, z); nrm.push(n[0], n[1], n[2]); uv.push(x / 7, z / 7);
    // AO: how far below the local mean we sit (creases, foot of the cut banks)
    const m = (H(x + 3, z) + H(x - 3, z) + H(x, z + 3) + H(x, z - 3)) * 0.25;
    const m2 = (H(x + 9, z + 9) + H(x - 9, z - 9) + H(x - 9, z + 9) + H(x + 9, z - 9)) * 0.25;
    let ao = 1 - Math.min(0.42, Math.max(0, m - y) * 0.16) - Math.min(0.2, Math.max(0, m2 - y) * 0.025);
    // wind-scoured patches a touch greyer; drifts brighter
    const vv = fbm2(x * 0.045, z * 0.045);
    ao *= 0.94 + vv * 0.1;
    const pk = pathK(x, z);
    col.push(ao * (1 - pk * 0.2), ao * (1 - pk * 0.17), ao * (1 - pk * 0.1));
    const slope = 1 - n[1];
    let rk = Math.min(1, Math.max(0, (slope - 0.3) * 2.3 + (fbm2(x * 0.08 + 7, z * 0.08) - 0.5) * 0.7));
    // the face: rock only on the rib crests, long streaks down the fall line (not blotches)
    const face = Math.min(1, Math.max(0, (-408 - z) / 18));
    if (face > 0) { const rib = ridged(x * 0.024, z * 0.006); rk = rk * (1 - face * 0.75) + face * Math.min(1, Math.max(0, (rib - 0.6) * 5)) * 0.62 * (0.7 + 0.3 * fbm2(x * 0.05, z * 0.02)); }
    // the Gazex cannons stand on dark rock outcrops (they silhouette)
    for (const [gx, gz] of GAZEX) { const dd = Math.hypot(x - gx, z - gz); if (dd < 26) rk = Math.max(rk, Math.min(1, (26 - dd) / 8) * 0.95); }
    // the saddle north of the tower stays clean snow (its slope rock read as dirt smears from the terrace)
    if (z > -445 && z < -395 && x > 20 && x < 240) rk *= 0.15;
    rock.push(Math.min(1, rk));
    // warm pools from lamps / fires (emissive multiplier on the lit albedo)
    let r = 0, g = 0, b = 0;
    for (const P of pools) {
      const dx = x - P.p[0], dz = z - P.p[2], dy = (y - P.p[1]) * 0.6;
      const d2 = dx * dx + dz * dz + dy * dy, R = P.r || 9;
      if (d2 > R * R * 4) continue;
      const k = Math.exp(-d2 / (R * R)) * (P.k ?? 1);
      r += P.c[0] * k; g += P.c[1] * k; b += P.c[2] * k;
    }
    glow.push(r, g, b);
    return vbase++;
  };
  let tris = 0;
  for (let cz = TERR.z0; cz < TERR.z1; cz += CH) for (let cx = TERR.x0; cx < TERR.x1; cx += CH) {
    const d = Math.min(dist(cx, cz), dist(cx + CH, cz), dist(cx, cz + CH), dist(cx + CH, cz + CH), dist(cx + CH / 2, cz + CH / 2));
    const step = d < 70 ? 2 : d < 190 ? 4 : 8;
    const N = CH / step;
    const grid = [];
    for (let k = 0; k <= N; k++) for (let i = 0; i <= N; i++) { const x = cx + i * step, z = cz + k * step; grid.push(vert(x, H(x, z), z, step)); }
    for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) {
      const a = grid[k * (N + 1) + i], b = a + 1, c = a + N + 1, dd = c + 1;
      // split along the diagonal that follows the terrain (no saw-tooth ridges)
      const ha = pos[a * 3 + 1], hb = pos[b * 3 + 1], hc = pos[c * 3 + 1], hd = pos[dd * 3 + 1];
      if (Math.abs(ha - hd) < Math.abs(hb - hc)) idx.push(a, c, dd, a, dd, b); else idx.push(a, c, b, b, c, dd);
      tris += 2;
    }
    // skirts (deep on the outer boundary: the far mesh sinks under the baked block)
    const outer = (cx === TERR.x0 || cz === TERR.z0 || cx + CH >= TERR.x1 || cz + CH >= TERR.z1);
    const sk = outer ? 46 : 5;
    const edge = (list) => {
      for (let j = 0; j < list.length - 1; j++) {
        const [x0, z0] = list[j], [x1, z1] = list[j + 1];
        const t0 = vert(x0, H(x0, z0), z0, step), t1 = vert(x1, H(x1, z1), z1, step), s0 = vert(x0, H(x0, z0), z0, step, sk), s1 = vert(x1, H(x1, z1), z1, step, sk);
        idx.push(t0, s0, t1, t1, s0, s1, t0, t1, s0, t1, s1, s0); tris += 4;
      }
    };
    const L = (f) => Array.from({ length: N + 1 }, (_, i) => f(i * step));
    edge(L(s => [cx + s, cz])); edge(L(s => [cx + s, cz + CH])); edge(L(s => [cx, cz + s])); edge(L(s => [cx + CH, cz + s]));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aRock', new THREE.Float32BufferAttribute(rock, 1));
  geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 3));
  geo.setIndex(vbase > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const mat = snowRockMaterial();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = 'terrain';
  root.add(mesh);

  // ---------------------------------------------------------------- far mesh (beyond the baked block)
  const far = buildFar();
  root.add(far);
  return { root, mesh, far, material: mat, info: { tris: tris + far.userData.tris, verts: vbase } };
}

// peaks for the horizon: a valley floor under the cloud sea, a ring of ridged summits, a few named giants
export function farTerrain(x, z) {
  const cx = 60, cz = -380;
  const r = Math.hypot(x - cx, z - cz);
  const base = farHeight(x, z);
  if (r < 700) return base;
  const a = Math.atan2(z - cz, x - cx);
  // ridged ranges: higher to the north / east / west, lower toward the sun (south-south-west: the view out)
  const toSun = Math.max(0, Math.cos(a - Math.atan2(0.87, -0.5)));
  let rn = 0, amp = 1, f = 1 / 900;
  for (let o = 0; o < 5; o++) { const v = 1 - Math.abs(fbm2(x * f + o * 7, z * f - o * 3, 1) * 2 - 1); rn += v * v * amp; amp *= 0.5; f *= 2.1; }
  let h = -260 + rn * 1500 * (1 - toSun * 0.55) + Math.min(1, (r - 700) / 3000) * 300;
  // a big pyramid peak east-north-east, a broad snow dome west
  const pk = (px, pz, hh, w) => Math.max(0, hh * (1 - Math.hypot(x - px, z - pz) / w));
  h = Math.max(h, pk(2400, -2600, 2300, 2100) + rn * 120, pk(-2600, -1400, 1700, 2400) * 0.9 + rn * 200);
  const k = Math.min(1, (r - 700) / 900);
  return base + (h - base) * (k * k * (3 - 2 * k));
}

function buildFar() {
  const pos = [], nrm = [], uv = [], col = [], rock = [], glow = [], idx = [];
  const cx = 60, cz = -380, RINGS = 64, SEG = 256;
  const radii = [];
  for (let i = 0; i <= RINGS; i++) radii.push(i === 0 ? 0 : 120 * Math.pow(9200 / 120, (i - 1) / (RINGS - 1)));
  const inBlock = (x, z) => x > TERR.x0 + 2 && x < TERR.x1 - 2 && z > TERR.z0 + 2 && z < TERR.z1 - 2;
  const hAt = (x, z) => farTerrain(x, z) - (inBlock(x, z) ? 60 : 0);
  let tris = 0;
  for (let i = 0; i <= RINGS; i++) for (let s = 0; s < SEG; s++) {
    const a = s / SEG * Math.PI * 2, r = radii[i];
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = hAt(x, z);
    const e = Math.max(8, r * 0.02);
    const hx = hAt(x + e, z) - hAt(x - e, z), hz = hAt(x, z + e) - hAt(x, z - e), l = Math.hypot(hx, 2 * e, hz);
    const ny = 2 * e / l;
    pos.push(x, y, z); nrm.push(-hx / l, ny, -hz / l); uv.push(x / 60, z / 60);
    const shade = 0.85 + fbm2(x * 0.002, z * 0.002) * 0.25;
    col.push(shade, shade, shade);
    rock.push(Math.min(1, Math.max(0, (1 - ny - 0.25) * 2.2 + (fbm2(x * 0.004, z * 0.004) - 0.5) * 0.9)));
    glow.push(0, 0, 0);
  }
  for (let i = 0; i < RINGS; i++) for (let s = 0; s < SEG; s++) {
    const a = i * SEG + s, b = i * SEG + (s + 1) % SEG, c = (i + 1) * SEG + s, d = (i + 1) * SEG + (s + 1) % SEG;
    idx.push(a, c, b, b, c, d); tris += 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aRock', new THREE.Float32BufferAttribute(rock, 1));
  geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, snowRockMaterial({ far: true }));
  m.userData.tris = tris; m.name = 'farTerrain'; m.frustumCulled = false;
  m.material.userData.u.uSpark.value = 0;
  return m;
}
