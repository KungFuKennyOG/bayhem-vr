import * as THREE from 'three';
import { DustClouds } from '../downtown-haven/dustfx.js';
import { range, rand, clamp } from '../../rng.js';
import { DUST } from './layout.js';

// =====================================================================================
//  OVERHEAD DUST — Level 3/5's DustClouds (one instanced draw, own pool) re-shaded for a
//  camera that looks DOWN on the dust: dustfx.js lights every puff as a ground-level sphere
//  impostor (sky from above, dark underside), which from 250 m up turns a dust sea into a
//  field of evenly lit balls. Here:
//   - a deck term: puffs low in the stack sit in the shadow of the ones above them
//     (brightness follows world height between groundY and the deck top),
//   - a low-sun "silver lining" on the sun side of the tops, long dark shoulders away from it,
//   - the near fade is wider (the heli flies through the tallest plumes).
//  dustfx.js itself is untouched (three levels import it).
//  Also measures the fill: how many full screens of blended dust quads the eye is drawing.
//
//  HorizonWall: the far "dust sea rolling out to the coast" as ONE ring mesh with an eroded,
//  billowing top. It is opaque below its eroded crest, so the far-skyline swap can be proven
//  hidden analytically (no ray tests against hundreds of puffs).
// =====================================================================================

const FS_OVER = /* glsl */`
uniform sampler2D tex;
uniform vec3 fogColor; uniform vec3 fogColorSun; uniform vec3 fogSunDir; uniform float fogNear; uniform float fogFar;
uniform float groundY; uniform float uDim; uniform float uDeckH;
varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vCS; varying float vWorldY; varying float vFlip; varying vec2 vQ;
varying float vFogDepth; varying vec3 vFogViewPos;
void main(){
  vec4 t = texture2D(tex, vUv);
  float al = t.a * (0.72 + 0.28 * smoothstep(0.0, 0.6, t.r)) * vA * smoothstep(groundY - 0.5, groundY + 2.0, vWorldY);
  if (al < 0.003) discard;
  vec2 n2 = t.gb * 2.0 - 1.0; n2.x *= vFlip;
  vec2 nr = vec2(vCS.x * n2.x - vCS.y * n2.y, vCS.y * n2.x + vCS.x * n2.y);
  vec3 Ns = vec3(vQ * 0.9, sqrt(max(0.05, 1.0 - dot(vQ, vQ) * 0.81)));
  vec3 N = normalize(Ns + vec3(nr * 0.85, 0.0));
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float sky = dot(N, upV) * 0.5 + 0.5;
  float sunN = dot(N, fogSunDir);
  vec3 V = normalize(vFogViewPos);
  float toward = pow(max(dot(V, fogSunDir), 0.0), 5.0);
  vec3 base = vC.rgb;
  float lump = 0.78 + 0.22 * t.r;
  // deck: 0 at the ground, 1 at the top of the dust layer (the tops are what you see from the heli)
  float deck = clamp((vWorldY - groundY) / uDeckH, 0.0, 1.0);
  float deckK = mix(0.42, 1.06, deck * deck * (3.0 - 2.0 * deck));
  vec3 col = base * (0.30 + 0.72 * sky * sky) * lump * deckK;
  // low sun: a warm lit shoulder on the sun side of every top, a long cool shadow side away from it
  float lit = smoothstep(-0.25, 0.7, sunN);
  col += base * fogColorSun * (0.28 * lit * lit) * lump * (0.4 + 0.6 * deck);
  col *= mix(vec3(0.78, 0.82, 0.9), vec3(1.0), lit);
  // silver lining: thin bright rim on the sun side of the crest
  float rim = pow(1.0 - clamp(t.a, 0.0, 1.0), 2.0) * smoothstep(0.2, 0.9, sunN) * deck;
  col += fogColorSun * (base + 0.05) * rim * 0.22;
  float edge = sqrt(t.a) * (1.0 - t.a) * 2.6;
  col += fogColorSun * (base + 0.03) * toward * edge * 0.06;
  col += vec3(1.5, 0.58, 0.2) * vC.a * (1.0 - sky) * (1.0 - sky) * (0.4 + 0.6 * t.r);
  col *= 1.0 - 0.4 * uDim;
  float f = smoothstep(fogNear, fogFar, vFogDepth); f = 1.0 - (1.0 - f) * (1.0 - f);
  float fs = max(dot(V, fogSunDir), 0.0);
  col = mix(col, mix(fogColor, fogColorSun, pow(fs, 3.0)), f);
  gl_FragColor = vec4(col * al, al);
  #include <tonemapping_fragment>
  #include <bay_premul_colorspace>
}`;

const QUEST_FOV_TAN = { x: Math.tan(52 * Math.PI / 180), y: Math.tan(48 * Math.PI / 180) }; // ~per-eye half-angles
const _f = new THREE.Vector3();

export class OverDust {
  constructor(scene, fog, F) {
    this.F = F;
    this.level = F.dust;
    this.clouds = new DustClouds(scene, fog, { max: DUST.high.max, occlusion: F.occl, fillBudget: F.fill });
    const m = this.clouds.material;
    m.fragmentShader = FS_OVER;
    m.uniforms.uDeckH = { value: 180 };
    m.uniforms.uNearK.value = 0.12; // a puff fades as you reach ~0.12 of its size (we fly through 150 m plumes)
    m.needsUpdate = true;
    this.clouds.mesh.renderOrder = 9;
    this.setLevel(this.level);
    this.fill = 0; this.fillPeak = 0; this.drawn = 0;
  }
  setLevel(l) {
    this.level = l; this.L = DUST[l];
    this.clouds.max = Math.max(1, this.L.max);
    if (l === 'off') for (const p of this.clouds.p) p.alive = false;
  }
  get rate() { return this.L.rate; }
  // probabilistic emission scaled by the dust level: call with the per-second rate you'd want at 'mid'
  emitN(perSec, dt) { const x = perSec * this.L.rate * dt; let n = Math.floor(x); if (rand() < x - n) n++; return n; }
  spawn(o) {
    if (this.L.rate <= 0) return null;
    const k = this.L.size;
    o.s0 *= k; if (o.s1 !== undefined) o.s1 *= k;
    return this.clouds.spawn(o);
  }
  // ---- presets (sizes are for 'mid'; the level scales them)
  skirt(x, z, r, k = 1) { // boiling ring at a tower base, rolling outward
    const a = rand() * Math.PI * 2, rr = r * range(0.7, 1.1), up = rand() < 0.35;
    return this.spawn({ x: x + Math.cos(a) * rr, y: up ? range(30, 70) : range(10, 30), z: z + Math.sin(a) * rr, vx: Math.cos(a) * range(8, 18) * k, vy: up ? range(4, 9) : range(1, 4), vz: Math.sin(a) * range(8, 18) * k, drag: 0.22, buoy: up ? 0.6 : 0.25, s0: range(60, 90), s1: range(190, 260), life: range(22, 30), a: 0.97, fadeIn: 0.05, fadeOut: 0.35, vrot: range(-0.05, 0.05), r: 0.5, g: 0.42, b: 0.32, r1: 0.62, g1: 0.53, b1: 0.41 });
  }
  plume(x, y, z, vx = 0, vz = 0, s = 1, dark = false) { // dust/smoke pouring off a break line or a falling chunk
    return this.spawn({ x, y, z, vx: vx + range(-3, 3), vy: range(1, 5), vz: vz + range(-3, 3), drag: 0.35, buoy: 0.4, s0: range(24, 36) * s, s1: range(80, 120) * s, life: range(12, 16), a: 0.95, fadeIn: 0.05, fadeOut: 0.4, vrot: range(-0.06, 0.06), r: dark ? 0.12 : 0.5, g: dark ? 0.1 : 0.43, b: dark ? 0.09 : 0.33, r1: 0.55, g1: 0.47, b1: 0.36, glow: dark ? 0.8 : 0, glowFade: 3 });
  }
  impact(x, z, r, k = 1) { // a slab hitting the ground: a ring of dust bursting out
    for (let i = 0; i < Math.max(1, Math.round(6 * k)); i++) {
      const a = rand() * Math.PI * 2, sp = range(14, 30), up = rand() < 0.3;
      this.spawn({ x: x + Math.cos(a) * r * 0.4, y: up ? range(20, 45) : range(6, 20), z: z + Math.sin(a) * r * 0.4, vx: Math.cos(a) * sp, vy: up ? range(5, 10) : range(1, 4), vz: Math.sin(a) * sp, drag: 0.5, buoy: 0.35, s0: range(45, 65), s1: range(150, 220), life: range(20, 28), a: 0.97, fadeIn: 0.03, fadeOut: 0.35, vrot: range(-0.08, 0.08), r: 0.46, g: 0.39, b: 0.3, r1: 0.6, g1: 0.51, b1: 0.4 });
    }
  }
  sea(x, z) { // the dust sea: a few HUGE flat-ish puffs that spread across the city and stay
    return this.spawn({ x, y: range(40, 90), z, vx: x * 0.012, vy: range(0.2, 1), vz: z * 0.012, drag: 0.05, buoy: 0.05, s0: range(160, 220), s1: range(320, 420), life: range(50, 65), a: 0.92, fadeIn: 0.12, fadeOut: 0.3, vrot: range(-0.01, 0.01), r: 0.55, g: 0.47, b: 0.36, r1: 0.64, g1: 0.55, b1: 0.43 });
  }
  clear() { for (const p of this.clouds.p) p.alive = false; this.clouds.update(0, new THREE.Vector3()); }

  update(dt, eye, camera) {
    camera.getWorldDirection(_f);
    this.clouds.update(dt, eye, 0, _f);
    // fill estimate: sum over drawn quads of (projected quad area / per-eye screen area), each capped at 1 screen
    let fill = 0, n = 0;
    const scr = 4 * QUEST_FOV_TAN.x * QUEST_FOV_TAN.y;
    for (const p of this.clouds.order) {
      const a = p.al * (p.bv ?? 1); if (a < 0.02) continue;
      const dx = p.x - eye.x, dy = p.y - eye.y, dz = p.z - eye.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const fw = (dx * _f.x + dy * _f.y + dz * _f.z) / Math.max(1e-3, d); // cos of angle from the view axis
      const half = Math.atan(p.sz * 0.71 / Math.max(1, d));
      if (Math.acos(clamp(fw, -1, 1)) - half > 1.05) continue; // outside a ~60° half cone
      n++;
      const z = Math.max(1, d * Math.max(0.2, fw));
      fill += Math.min(1, (p.sz * p.sz * (p.st || 1)) / (z * z) / scr);
    }
    this.fill = this.fill * 0.8 + fill * 0.2; this.drawn = n;
    this.fillPeak = Math.max(this.fillPeak, this.fill);
  }
  get alive() { return this.clouds.order.length; }
}

// ---------------------------------------------------------------------------- horizon wall
const WALL_VS = /* glsl */`
varying vec2 vUv; varying vec3 vW; varying float vD;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mv = viewMatrix * w; vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const WALL_FS = /* glsl */`
uniform float uH; uniform float uOp; uniform float uT; uniform float uR; uniform float uEro;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying vec2 vUv; varying vec3 vW; varying float vD;
float h1(float n){ return fract(sin(n) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = h1(dot(i, vec2(1.0, 57.0))), b = h1(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0))), c = h1(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0))), d = h1(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
// the eroded crest, in [1 - uEro, 1] of the wall height (HorizonWall.hides() assumes the low end)
float crest(float az){ float x = az * 9.0; return 1.0 - uEro * (0.55 * n1(x + uT * 0.05) + 0.3 * n1(x * 2.7 - uT * 0.08) + 0.15 * n1(x * 7.1)); }
void main(){
  float az = atan(vW.z, vW.x);
  float top = uH * crest(az);
  float y = vW.y;
  // billows: lumpy bands rising up the face
  vec2 q = vec2(az * 60.0, y / 38.0 - uT * 0.08);
  float b = n2(q) * 0.6 + n2(q * 2.3 + 7.0) * 0.4;
  float a = uOp * (1.0 - smoothstep(top - 45.0 - 25.0 * b, top, y));
  if (a < 0.004) discard;
  // lit like a curtain of dust: brighter toward the crest and on the sun side, dark at its foot
  vec3 n = normalize(vec3(vW.x, 0.0, vW.z));
  float sunSide = 0.5 + 0.5 * dot(-n, normalize(vec3(uSun.x, 0.0, uSun.z)));
  float hk = clamp(y / max(1.0, uH), 0.0, 1.0);
  vec3 base = vec3(0.55, 0.46, 0.35);
  vec3 col = base * (0.35 + 0.55 * hk) * (0.75 + 0.35 * b) + uSunCol * base * 0.35 * sunSide * hk;
  float f = smoothstep(fogNear, fogFar, vD) * 0.6;
  col = mix(col, fogColor, f);
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <bay_premul_colorspace>
}`;

export class HorizonWall {
  constructor(scene, fog) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 160, 1, true); g.translate(0, 0.5, 0);
    this.u = { uH: { value: 0 }, uOp: { value: 0 }, uT: { value: 0 }, uR: { value: 1 }, uEro: { value: 0.16 }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color(1.4, 0.75, 0.4) }, fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: WALL_VS, fragmentShader: WALL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; this.mesh.visible = false;
    scene.add(this.mesh);
    this.fog = fog;
    this.state = null;
  }
  start(r0, r1, hMax) { this.state = { t: 0, r0, r1, hMax, R: r0, H: 0, op: 0, thin: 0 }; this.mesh.visible = true; }
  stop() { this.state = null; this.mesh.visible = false; this.u.uOp.value = 0; this.u.uH.value = 0; }
  update(dt, sunDir) {
    const S = this.state; if (!S) return;
    S.t += dt;
    // rises out of the city edge, rolls out to its stop radius, then (much later) thins to a haze
    const k = clamp(S.t / 14, 0, 1), e = 1 - (1 - k) * (1 - k);
    S.R = S.r0 + (S.r1 - S.r0) * e;
    S.H = S.hMax * clamp(S.t / 10, 0, 1) ** 0.7;
    S.op = S.t < 40 ? clamp(S.t / 2.5, 0, 1) : clamp(1 - (S.t - 40) / 25, 0.55, 1);
    this.mesh.scale.set(S.R, S.hMax * 1.05, S.R); // the geometry is a unit-height ring
    this.u.uH.value = S.H; this.u.uOp.value = S.op; this.u.uT.value += dt; this.u.uR.value = S.R;
    this.u.uSun.value.copy(sunDir);
    this.u.fogNear.value = this.fog.near; this.u.fogFar.value = this.fog.far;
  }
  // is the straight line eye -> P hidden behind the wall (opaque part)? eye must be inside the ring, P outside.
  hides(eye, P) {
    const S = this.state; if (!S || S.op < 0.97) return false;
    const R = S.R;
    const re = Math.hypot(eye.x, eye.z), rp = Math.hypot(P.x, P.z);
    if (re >= R - 5 || rp <= R + 10) return false;
    // ray / circle intersection in xz (the eye is inside, so exactly one crossing going out)
    const dx = P.x - eye.x, dz = P.z - eye.z;
    const a = dx * dx + dz * dz, b = 2 * (eye.x * dx + eye.z * dz), c = eye.x * eye.x + eye.z * eye.z - R * R;
    const s = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
    const y = eye.y + (P.y - eye.y) * s;
    // conservative: the LOWEST the eroded crest can ever be (1 - uEro), minus the shader's soft band (45 m)
    // and its billow jitter (25 m), so GPU/CPU noise differences can never let a swap show
    const top = S.H * (1 - this.u.uEro.value) - 75;
    return y > 0 && y < top;
  }
}
