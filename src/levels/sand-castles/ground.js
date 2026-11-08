import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng, clamp } from '../../rng.js';
import { FAC, FAC_GLSL } from './facade.js';
import { GRID, BLVD, isWater, onPalm, district, CANAL, PALM, COAST_Z } from './layout.js';

// =====================================================================================
//  THE GROUND — one plane, one draw: the Gulf (deep blue -> turquoise shallows, waves, sun
//  glitter, a foam line), the marina canal, the palm island, the desert past the city (dunes),
//  and the street grid + the fourteen-lane boulevard drawn analytically (crisp at any distance,
//  anti-aliased by footprint). A 1024² data map (8 m texels) carries land / urban / green /
//  shallow-water; everything finer is maths. Plus: traffic (instanced, moving), palms, boats.
// =====================================================================================

export const GMAP = { x0: -4200, z0: -4600, size: 8400, res: 1024 };

function buildMap() {
  const { x0, z0, size, res } = GMAP, px = size / res;
  const d = new Uint8Array(res * res * 4);
  const land = new Float32Array(res * res);
  const rng = makeRng(5150);
  // parks: a few green blocks + the golf course by the marina
  const parks = [];
  for (let i = 0; i < 26; i++) parks.push([GRID.x0 + rng() * (GRID.x1 - GRID.x0), GRID.z0 + 200 + rng() * (GRID.z1 - GRID.z0 - 200), 50 + rng() * 120]);
  parks.push([-2150, -700, 420]);
  for (let k = 0; k < res; k++) for (let i = 0; i < res; i++) {
    const x = x0 + (i + 0.5) * px, z = z0 + (k + 0.5) * px, j = k * res + i;
    const w = isWater(x, z);
    land[j] = w ? 0 : 1;
    const dist = w ? 'sea' : district(x, z);
    const urban = (w && z > COAST_Z(x)) ? 1 : dist === 'sea' || dist === 'outer' ? 0 : 1;
    let green = 0;
    if (!w) {
      for (const [px2, pz, r] of parks) if (Math.hypot(x - px2, z - pz) < r) green = 1;
      if (onPalm(x, z)) green = 0.55;
    }
    d[j * 4 + 1] = urban * 255; d[j * 4 + 2] = green * 255;
  }
  // shallow water: blur the land mask (two box passes ~ 120 m), stored in A; land in R
  const blur = (src, r) => {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let k = 0; k < res; k++) { let acc = 0; for (let i = -r; i <= r; i++) acc += src[k * res + clamp(i, 0, res - 1)]; for (let i = 0; i < res; i++) { tmp[k * res + i] = acc / (2 * r + 1); acc += src[k * res + clamp(i + r + 1, 0, res - 1)] - src[k * res + clamp(i - r, 0, res - 1)]; } }
    for (let i = 0; i < res; i++) { let acc = 0; for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, res - 1) * res + i]; for (let k = 0; k < res; k++) { out[k * res + i] = acc / (2 * r + 1); acc += tmp[clamp(k + r + 1, 0, res - 1) * res + i] - tmp[clamp(k - r, 0, res - 1) * res + i]; } }
    return out;
  };
  const sh = blur(blur(land, 7), 7);
  for (let j = 0; j < res * res; j++) { d[j * 4] = land[j] * 255; d[j * 4 + 3] = Math.min(255, sh[j] * 2.2 * 255); }
  const tex = new THREE.DataTexture(d, res, res, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  return tex;
}

const GROUND_GLSL = /* glsl */`
uniform sampler2D tMap; uniform vec4 uMapB; uniform vec4 uGrid; uniform vec3 uBlvd;
float gaa(float x, float w, float fw){ return 1.0 - smoothstep(w - fw, w + fw, abs(x)); }
// returns albedo, roughness, metal, and a world-space normal tilt (water / dunes)
struct Gr { vec3 c; float r; float m; vec2 tilt; float water; };
Gr ground(vec3 wp){
  Gr g; g.tilt = vec2(0.0); g.m = 0.0;
  vec2 muv = (wp.xz - uMapB.xy) * uMapB.zw;
  vec4 M = texture2D(tMap, muv);
  bool inMap = all(greaterThan(muv, vec2(0.0))) && all(lessThan(muv, vec2(1.0)));
  float land = inMap ? M.r : (wp.z < -1500.0 ? 0.0 : 1.0);
  float urban = inMap ? M.g : 0.0, green = M.b, shallow = inMap ? M.a : 0.0;
  // noise edge on the coast (8 m texels would show)
  float cn = fvn(wp.xz * 0.05) * 0.35 + fvn(wp.xz * 0.21) * 0.15;
  land = smoothstep(0.4, 0.6, land + (cn - 0.25) * 0.5);
  float fwx = max(fwidth(wp.x), 0.05);
  g.water = 1.0 - land;
  // ---------------------------------------------------------------- water
  float t = uTime;
  vec2 q = wp.xz * 0.02;
  float w1 = fvn(q + vec2(t * 0.05, t * 0.03)), w2 = fvn(q * 3.1 - vec2(t * 0.07, -t * 0.04)), w3 = fvn(q * 9.0 + vec2(t * 0.2, 0.0));
  vec2 wt = vec2(w1 - fvn(q + vec2(0.07, 0.0) + vec2(t * 0.05, t * 0.03)), w1 - fvn(q + vec2(0.0, 0.07) + vec2(t * 0.05, t * 0.03))) * 4.0
          + vec2(w2 - fvn(q * 3.1 + vec2(0.05, 0.0) - vec2(t * 0.07, -t * 0.04)), w2 - fvn(q * 3.1 + vec2(0.0, 0.05) - vec2(t * 0.07, -t * 0.04))) * 2.5
          + vec2(w3 - 0.5) * 0.08;
  float deep = 1.0 - shallow;
  vec3 wc = mix(vec3(0.03, 0.17, 0.18), vec3(0.006, 0.03, 0.05), smoothstep(0.05, 0.75, deep));
  wc = mix(wc, vec3(0.3, 0.36, 0.3), smoothstep(0.93, 1.0, shallow) * 0.35); // sandy bottom right at the beach
  // the marina canal: a deep green-blue cut, no beach
  float canal = step(0.5, urban);
  wc = mix(wc, vec3(0.012, 0.05, 0.055), canal);
  float foam = (1.0 - canal) * smoothstep(0.9, 0.98, shallow) * (1.0 - smoothstep(0.97, 1.0, shallow)) * (0.6 + 0.4 * w3);
  wc = mix(wc, vec3(0.75, 0.78, 0.78), foam * 0.7);
  // ---------------------------------------------------------------- land
  // desert past the city: dunes (ridged noise -> a tilt for the sun to catch)
  float dn = fvn(wp.xz * 0.004 + vec2(3.0, 7.0)), dn2 = fvn(wp.xz * 0.013);
  vec2 dtilt = vec2(dn - fvn(wp.xz * 0.004 + vec2(3.004, 7.0)), dn - fvn(wp.xz * 0.004 + vec2(3.0, 7.004))) * 60.0;
  vec3 sand = mix(vec3(0.46, 0.34, 0.22), vec3(0.6, 0.46, 0.31), dn * 0.7 + dn2 * 0.3);
  vec3 lc = sand;
  float rough = 0.95;
  // urban ground: block-by-block lots (paved, parking, sand lot, green), roads between
  vec2 gp = (wp.xz - uGrid.xy) / uGrid.z;
  vec2 cell = floor(gp), f = fract(gp);
  float roadHalf = uGrid.w / uGrid.z * 0.5;
  vec2 fe = min(f, 1.0 - f);
  float fw = fwx / uGrid.z;
  float road = max(gaa(fe.x, roadHalf, fw), gaa(fe.y, roadHalf, fw)) * step(0.5, urban);
  float lotH = fh2(cell + 0.37);
  vec3 lot = lotH < 0.35 ? vec3(0.38, 0.36, 0.33) : lotH < 0.6 ? vec3(0.16, 0.16, 0.17) : lotH < 0.85 ? vec3(0.5, 0.39, 0.27) : vec3(0.3, 0.29, 0.27);
  // parking lot stalls
  if (lotH > 0.35 && lotH < 0.6) { float stall = gaa(fract((wp.x) / 2.7) - 0.5, 0.04, fwx / 2.7) * step(0.15, fract(gp.y * 4.0)); lot = mix(lot, vec3(0.7), stall * clamp(1.0 - fwx * 0.8, 0.0, 1.0) * 0.6); }
  lot *= 0.85 + 0.3 * fvn(wp.xz * 0.06);
  lc = mix(lc, lot, urban);
  // blown sand: drifts across lots and kerbs, thicker toward the desert edge of each block
  float drift = smoothstep(0.5, 0.82, fvn(wp.xz * 0.018 + 5.0) * 0.7 + fvn(wp.xz * 0.11) * 0.3);
  lc = mix(lc, sand * 0.92, drift * 0.55 * urban);
  rough = mix(rough, 0.85, urban);
  // roads: asphalt, kerbs, a dashed centre line
  vec3 asph = vec3(0.13, 0.13, 0.135) * (0.8 + 0.25 * fvn(wp.xz * 0.15) + 0.2 * fvn(wp.xz * 0.012));
  float centre = max(gaa(fe.x, 0.004, fw) * step(0.5, fract(wp.z / 9.0)) * step(fe.y, 0.5 - roadHalf), gaa(fe.y, 0.004, fw) * step(0.5, fract(wp.x / 9.0)) * step(fe.x, 0.5 - roadHalf));
  vec3 rc = mix(asph, vec3(0.75, 0.72, 0.6), centre * clamp(1.0 - fwx * 0.5, 0.0, 1.0));
  float kerb = max(gaa(fe.x - roadHalf, 0.12 / uGrid.z, fw), gaa(fe.y - roadHalf, 0.12 / uGrid.z, fw)) * step(0.5, urban);
  rc = mix(rc, sand * 0.8, drift * 0.3 * (1.0 - centre));
  lc = mix(lc, rc, road);
  lc = mix(lc, vec3(0.62, 0.6, 0.55), kerb * 0.7);
  // green: parks, golf, gardens (irrigated: deep green, mown stripes)
  vec3 gc = mix(vec3(0.12, 0.15, 0.07), vec3(0.17, 0.2, 0.1), step(0.5, fract(wp.x / 14.0)) * 0.6 + fvn(wp.xz * 0.05) * 0.4);
  lc = mix(lc, gc, green * (1.0 - road));
  // the boulevard: 7 + 7 lanes, a planted median with the metro viaduct footprint, hard shoulders
  float bz = wp.z - uBlvd.x, bh = uBlvd.y * 0.5;
  float onB = gaa(bz, bh, fwx) * step(uBlvd.z, wp.x) ;
  if (onB > 0.0) {
    float az = abs(bz);
    vec3 bc = vec3(0.115, 0.115, 0.12) * (0.85 + 0.3 * fvn(wp.xz * vec2(0.02, 0.4)));
    // median
    bc = mix(bc, vec3(0.1, 0.2, 0.06), gaa(bz, 4.5, fwx));
    // lane dashes every 3.6 m from the median out, solid edge lines
    float lane = (az - 5.0) / 3.6;
    float dash = gaa(fract(lane + 0.5) - 0.5, 0.03, fwx / 3.6) * step(0.75, fract(wp.x / 12.0)) * step(0.0, lane) * step(lane, 7.0);
    float edge = gaa(az - 5.2, 0.14, fwx) + gaa(az - (5.0 + 7.0 * 3.6), 0.14, fwx);
    float k = clamp(1.0 - fwx * 0.9, 0.0, 1.0) * 0.8;
    bc = mix(bc, vec3(0.78, 0.76, 0.7), clamp(dash * k + edge * k, 0.0, 1.0));
    // tyre-darkened lanes
    bc *= 1.0 - 0.18 * gaa(fract(lane) - 0.5, 0.18, fwx / 3.6) * step(0.0, lane) * step(lane, 7.0);
    lc = mix(lc, bc, onB);
    rough = mix(rough, 0.8, onB);
  }
  // contact darkening round the towers: the height map a few metres out in four directions
  vec2 hb = (wp.xz - uSunHB.xy) * uSunHB.zw;
  float hx = 9.0 * uSunHB.z;
  float occ = max(max(texture2D(tSunH, hb + vec2(hx, 0.0)).r, texture2D(tSunH, hb - vec2(hx, 0.0)).r), max(texture2D(tSunH, hb + vec2(0.0, hx)).r, texture2D(tSunH, hb - vec2(0.0, hx)).r));
  float occ2 = max(max(texture2D(tSunH, hb + vec2(hx, hx) * 2.2).r, texture2D(tSunH, hb - vec2(hx, hx) * 2.2).r), max(texture2D(tSunH, hb + vec2(hx, -hx) * 2.2).r, texture2D(tSunH, hb - vec2(hx, -hx) * 2.2).r));
  lc *= 1.0 - 0.38 * smoothstep(0.01, 0.06, occ) - 0.16 * smoothstep(0.01, 0.06, occ2);
  g.tilt = mix(dtilt * (1.0 - urban), wt, g.water);
  g.c = stormShade(mix(lc, wc, g.water), wp);
  g.r = mix(rough, 0.035 + 0.05 * w3, g.water);
  g.m = 0.0;
  return g;
}`;

export class Ground {
  constructor(scene, F) {
    this.tex = buildMap();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, envMapIntensity: 0.55 });
    const U = { tMap: { value: this.tex }, uMapB: { value: new THREE.Vector4(GMAP.x0, GMAP.z0, 1 / GMAP.size, 1 / GMAP.size) }, uGrid: { value: new THREE.Vector4(GRID.x0, GRID.z0, GRID.pitch, GRID.road) }, uBlvd: { value: new THREE.Vector3(BLVD.z, BLVD.w, BLVD.x0) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, FAC, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPg;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPg = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      const begin = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= sunV;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FAC_GLSL.replace('varying vec3 vF; varying vec4 vS; varying vec3 vWP; varying float vRuin;', '') + '\nvarying vec3 vWPg;\n' + GROUND_GLSL)
        .replace('#include <map_fragment>', '#include <map_fragment>\nGr gr = ground(vWPg);\ndiffuseColor.rgb *= gr.c;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gr.r;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = gr.m;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + (viewMatrix * vec4(-gr.tilt.x, 0.0, -gr.tilt.y, 0.0)).xyz);')
        .replace('#include <lights_fragment_begin>', `float sunV = sunVis(vWPg + vec3(0.0, 0.3, 0.0), vec3(0.0, 1.0, 0.0));\n${begin}`);
    };
    mat.customProgramCacheKey = () => 'sc-ground';
    const geo = new THREE.PlaneGeometry(26000, 26000, 8, 8).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(0, 0, -1500);
    this.mesh.frustumCulled = false; this.mesh.name = 'ground';
    scene.add(this.mesh);
    this.traffic = new Traffic(scene, F);
    this.palms = buildPalms(scene);
    this.boats = buildBoats(scene);
    this.viaduct = buildViaduct(scene);
  }
  update(dt) { this.traffic.update(dt); }
}

// ---------------------------------------------------------------------------- traffic
// cars on the boulevard (both directions) and a few grid avenues; one instanced draw, colours per car
class Traffic {
  constructor(scene, F) {
    const N = F.traffic;
    this.N = N;
    const body = new THREE.BoxGeometry(1.9, 0.8, 4.5); body.translate(0, 0.6, 0);
    const cab = new THREE.BoxGeometry(1.7, 0.6, 2.4); cab.translate(0, 1.25, 0.2);
    const geo = mergeGeometries([body, cab]);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.6 });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, N));
    this.mesh.frustumCulled = false;
    const rng = makeRng(808);
    const cols = [[0.85, 0.85, 0.84], [0.06, 0.06, 0.07], [0.5, 0.52, 0.55], [0.75, 0.73, 0.68], [0.3, 0.05, 0.04], [0.08, 0.12, 0.25], [0.9, 0.9, 0.9], [0.62, 0.5, 0.32]];
    this.cars = [];
    for (let i = 0; i < N; i++) {
      const onBlvd = rng() < 0.8;
      const dir = rng() < 0.5 ? 1 : -1;
      if (onBlvd) {
        const lane = Math.floor(rng() * 7);
        this.cars.push({ kind: 'b', x: BLVD.x0 + 200 + rng() * (BLVD.x1 - BLVD.x0 - 400), z: BLVD.z + dir * (6.8 + lane * 3.6), dir, v: (14 + lane * 2.2 + rng() * 4) * (rng() < 0.12 ? 0 : 1) });
      } else {
        const col = Math.floor(rng() * 30), gx = GRID.x0 + col * GRID.pitch * 2;
        this.cars.push({ kind: 'g', x: gx + dir * 3.2, z: GRID.z0 + rng() * (GRID.z1 - GRID.z0), dir, v: 8 + rng() * 8 });
      }
      const c = cols[Math.floor(rng() * cols.length)];
      this.mesh.setColorAt(i, new THREE.Color(c[0], c[1], c[2]));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
    this.panic = 0; this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this.update(0);
  }
  update(dt) {
    const m = this._m, q = this._q, p = this._p, Y = new THREE.Vector3(0, 1, 0);
    let i = 0;
    for (const c of this.cars) {
      if (c.kind === 'b') {
        c.x += c.dir * c.v * (1 + this.panic * 0.5) * dt;
        if (c.x > BLVD.x1 - 100) c.x = BLVD.x0 + 150; if (c.x < BLVD.x0 + 100) c.x = BLVD.x1 - 150;
        q.setFromAxisAngle(Y, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2); p.set(c.x, 0, c.z);
      } else {
        c.z += c.dir * c.v * dt;
        if (c.z > GRID.z1) c.z = GRID.z0; if (c.z < GRID.z0) c.z = GRID.z1;
        q.setFromAxisAngle(Y, c.dir > 0 ? Math.PI : 0); p.set(c.x, 0, c.z);
      }
      m.compose(p, q, this._s); this.mesh.setMatrixAt(i++, m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------- palms (along the canal, the boulevard median, the palm island)
function buildPalms(scene) {
  const rng = makeRng(4040);
  const pts = [];
  // canal promenades
  for (let i = 0; i < CANAL.length - 1; i++) {
    const [ax, az] = CANAL[i], [bx, bz] = CANAL[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let s = 0; s < L; s += 14) for (const side of [-1, 1]) pts.push([ax + (bx - ax) * s / L + nx * side * 44, az + (bz - az) * s / L + nz * side * 44]);
  }
  // boulevard median + verges
  for (let x = BLVD.x0 + 300; x < BLVD.x1 - 300; x += 16) { pts.push([x, BLVD.z]); if (rng() < 0.6) pts.push([x + 8, BLVD.z + (rng() < 0.5 ? -1 : 1) * (BLVD.w / 2 + 6)]); }
  // the palm island's fronds
  for (let i = 0; i < 3000 && pts.length < 3600; i++) { const x = PALM.x + (rng() - 0.5) * 2200, z = PALM.z + (rng() - 0.5) * 2200; if (onPalm(x, z) && rng() < 0.7) pts.push([x, z]); }
  // a crown: a flattened low-poly sphere on a thin trunk (1-2 px from the heli, the shape doesn't matter, the dark dot does)
  // a crown of drooping fronds (a star of ridged blades: a palm silhouette from above, not a lollipop)
  const fp = [];
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + (k % 2) * 0.2, r = 3.6 + (k % 3) * 0.5, ca = Math.cos(a), sa = Math.sin(a), px = -sa, pz = ca;
    const tip = [ca * r, 7.4 - (k % 2) * 0.6, sa * r], mid = [ca * r * 0.5, 9.3, sa * r * 0.5], base = [0, 9.1, 0];
    const L = [mid[0] + px * 0.75, mid[1] - 0.2, mid[2] + pz * 0.75], R = [mid[0] - px * 0.75, mid[1] - 0.2, mid[2] - pz * 0.75];
    fp.push(...base, ...L, ...mid, ...base, ...mid, ...R, ...L, ...tip, ...mid, ...mid, ...tip, ...R);
  }
  const crown = new THREE.BufferGeometry(); crown.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); crown.computeVertexNormals();
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 9, 4); trunk.translate(0, 4.5, 0);
  const cg = crown, tg = trunk.toNonIndexed();
  cg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(fp.length / 3 * 2), 2));
  const col = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) a.set(c, k * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); };
  col(cg, [0.1, 0.12, 0.05]); col(tg, [0.3, 0.24, 0.17]);
  const geo = mergeGeometries([cg, tg]);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.4 }), pts.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3();
  pts.forEach(([x, z], i) => { if (isWater(x, z) && !onPalm(x, z)) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); return; } q.setFromAxisAngle(Y, rng() * 6.28); const k = 1.05 + rng() * 0.45; m.compose(new THREE.Vector3(x, 0, z), q, s.set(k, k, k)); im.setMatrixAt(i, m); });
  im.frustumCulled = false; scene.add(im);
  return im;
}

// ---------------------------------------------------------------------------- boats: yachts in the marina, a few in the Gulf
function buildBoats(scene) {
  const rng = makeRng(919);
  const hull = new THREE.BoxGeometry(5, 2, 18, 1, 1, 2);
  { const p = hull.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getZ(i) < -8) p.setX(i, p.getX(i) * 0.15); if (p.getY(i) < 0) p.setX(i, p.getX(i) * 0.7); } hull.computeVertexNormals(); }
  hull.translate(0, 0.6, 0);
  const deck = new THREE.BoxGeometry(3.6, 1.6, 7); deck.translate(0, 2.2, 2);
  const geo = mergeGeometries([hull.toNonIndexed(), deck.toNonIndexed()]);
  const list = [];
  for (let i = 0; i < CANAL.length - 1; i++) { const [ax, az] = CANAL[i], [bx, bz] = CANAL[i + 1]; for (let s = 0.1; s < 1; s += 0.22) list.push([ax + (bx - ax) * s + (rng() - 0.5) * 30, az + (bz - az) * s, Math.atan2(bx - ax, bz - az) + (rng() < 0.5 ? 0 : Math.PI), 1]); }
  for (let i = 0; i < 26; i++) { const x = -2600 + rng() * 4000, z = COAST_Z(x) - 200 - rng() * 1800; if (!onPalm(x, z)) list.push([x, z, rng() * 6.28, 1 + rng() * 1.6]); }
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.35, metalness: 0.1 }), list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  list.forEach(([x, z, a, k], i) => { q.setFromAxisAngle(Y, a); m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(k, k, k)); im.setMatrixAt(i, m); });
  im.frustumCulled = false; scene.add(im);
  return im;
}

// ---------------------------------------------------------------------------- the metro viaduct down the boulevard median
function buildViaduct(scene) {
  const parts = [];
  const L = BLVD.x1 - BLVD.x0 - 800, x0 = BLVD.x0 + 400;
  const deck = new THREE.BoxGeometry(L, 1.6, 9); deck.translate(x0 + L / 2, 12, BLVD.z); parts.push(deck);
  const lip = new THREE.BoxGeometry(L, 1.0, 0.4); for (const s of [-1, 1]) { const g = lip.clone(); g.translate(x0 + L / 2, 13.2, BLVD.z + s * 4.3); parts.push(g); }
  for (let x = x0; x < x0 + L; x += 36) { const p = new THREE.BoxGeometry(2.2, 12, 2.2); p.translate(x, 6, BLVD.z); parts.push(p); }
  const geo = mergeGeometries(parts.map(p => p.toNonIndexed()));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8f877a, roughness: 0.9 }));
  mesh.frustumCulled = false; scene.add(mesh);
  return mesh;
}
