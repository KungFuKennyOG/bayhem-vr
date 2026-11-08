import * as THREE from 'three';
import { clamp, range, rand, makeRng } from '../../rng.js';

// =====================================================================================
//  WEATHER SET PIECES
//   HorizonWallC — the prototype's far dust sea ring (opaque below an eroded crest, so the
//                  ruin swap can be proven hidden analytically), centred on the downtown.
//   Haboob       — the sandstorm front: a 900 m wall of dust rolling north across the city at
//                  ~22 m/s, billows climbing its face, a lit crest, a dark foot; huge cloud puffs
//                  ride the crest near you (OverDust). When it reaches you the look goes to storm.
//   SandStreaks  — wind-driven sand around the cabin while you're inside the storm (one draw,
//                  thin, faded near the eye — VR-safe, cheap on fill).
// =====================================================================================

const NOISE = /* glsl */`
float h1(float n){ return fract(sin(n) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = h1(dot(i, vec2(1.0, 57.0))), b = h1(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0))), c = h1(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0))), d = h1(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float fb(vec2 p){ return n2(p) * 0.5 + n2(p * 2.1 + 3.0) * 0.3 + n2(p * 4.3 + 7.0) * 0.2; }`;

// ---------------------------------------------------------------------------- the far ring
const WALL_VS = /* glsl */`varying vec3 vW; varying float vD;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`;
const WALL_FS = /* glsl */`
uniform float uH; uniform float uOp; uniform float uT; uniform float uEro; uniform vec2 uC;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
varying vec3 vW; varying float vD;
${NOISE}
float crest(float az){ float x = az * 6.0; return 1.0 - uEro * (0.5 * n1(x + uT * 0.05) + 0.3 * n1(x * 2.3 - uT * 0.06) + 0.2 * n1(x * 7.0 + uT * 0.1)); }
void main(){
  vec2 r = vW.xz - uC;
  float az = atan(r.y, r.x), R = length(r);
  float top = uH * crest(az);
  // rolling lobes, embossed (lit where the density thins upward), not streaks
  vec2 q0 = vec2(az * R / 230.0, vW.y / 170.0 - uT * 0.03);
  float L0 = fb(q0), L1 = fb(q0 + vec2(0.0, 0.07));
  float emb = clamp((L0 - L1) * 7.0 + 0.5, 0.0, 1.0);
  // a ragged crest: the soft band is wide and lumpy (hides() allows for it)
  float a = uOp * (1.0 - smoothstep(top - 130.0 - 60.0 * L0, top + 5.0, vW.y));
  if (a < 0.004) discard;
  vec3 n = normalize(vec3(r.x, 0.0, r.y));
  float sunSide = 0.5 + 0.5 * dot(-n, normalize(vec3(uSun.x, 0.0, uSun.z)));
  float hk = clamp(vW.y / max(1.0, uH), 0.0, 1.0);
  vec3 base = vec3(0.55, 0.43, 0.31);
  vec3 col = base * mix(0.28, 0.95, smoothstep(0.0, 0.85, hk)) * mix(0.65, 1.2, emb) * (0.8 + 0.3 * L0) + uSunCol * base * 0.22 * sunSide * hk * hk * emb;
  col = mix(col, fogColor, smoothstep(fogNear, fogFar, vD) * 0.6);
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <bay_premul_colorspace>
}`;
export class HorizonWallC {
  constructor(scene, fog, cx, cz) {
    this.cx = cx; this.cz = cz;
    const g = new THREE.CylinderGeometry(1, 1, 1, 160, 1, true); g.translate(0, 0.5, 0);
    this.u = { uH: { value: 0 }, uOp: { value: 0 }, uT: { value: 0 }, uEro: { value: 0.16 }, uC: { value: new THREE.Vector2(cx, cz) }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color(1.4, 0.75, 0.4) }, fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: WALL_VS, fragmentShader: WALL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
    this.mesh.position.set(cx, 0, cz);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; this.mesh.visible = false;
    scene.add(this.mesh);
    this.fog = fog; this.state = null;
  }
  start(r0, r1, hMax) { this.state = { t: 0, r0, r1, hMax, R: r0, H: 0, op: 0 }; this.mesh.visible = true; }
  stop() { this.state = null; this.mesh.visible = false; }
  update(dt, sunDir) {
    const S = this.state; if (!S) return;
    S.t += dt;
    const k = clamp(S.t / 14, 0, 1), e = 1 - (1 - k) * (1 - k);
    S.R = S.r0 + (S.r1 - S.r0) * e;
    S.H = S.hMax * clamp(S.t / 10, 0, 1) ** 0.7;
    S.op = S.t < 45 ? clamp(S.t / 2.5, 0, 1) : clamp(1 - (S.t - 45) / 25, 0.5, 1);
    this.mesh.scale.set(S.R, S.hMax * 1.05, S.R);
    this.u.uH.value = S.H; this.u.uOp.value = S.op; this.u.uT.value += dt;
    this.u.uSun.value.copy(sunDir);
    this.u.fogNear.value = this.fog.near; this.u.fogFar.value = this.fog.far;
  }
  hides(eye, P) {
    const S = this.state; if (!S || S.op < 0.97) return false;
    const R = S.R, ex = eye.x - this.cx, ez = eye.z - this.cz, px = P.x - this.cx, pz = P.z - this.cz;
    if (Math.hypot(ex, ez) >= R - 5 || Math.hypot(px, pz) <= R + 10) return false;
    const dx = px - ex, dz = pz - ez;
    const a = dx * dx + dz * dz, b = 2 * (ex * dx + ez * dz), c = ex * ex + ez * ez - R * R;
    const s = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a);
    const y = eye.y + (P.y - eye.y) * s;
    const top = S.H * (1 - this.u.uEro.value) - 200; // the shader's soft band (130 + 60) + margin
    return y > 0 && y < top;
  }
}

// ---------------------------------------------------------------------------- the haboob
const HAB_VS = /* glsl */`varying vec3 vW; varying float vD; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`;
const HAB_FS = /* glsl */`
uniform float uH; uniform float uT; uniform float uOp; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 fogColor; uniform float uFront;
varying vec3 vW; varying float vD; varying vec2 vUv;
${NOISE}
void main(){
  float x = vW.x;
  // a cauliflower crest: big lobes, smaller lobes on them, rolling forward (up the face) over time
  float lob = n1(x / 420.0 + 3.1) * 0.5 + n1(x / 170.0 + uT * 0.01) * 0.3 + n1(x / 60.0 - uT * 0.03) * 0.2;
  float top = uH * (0.62 + 0.38 * lob);
  vec2 q = vec2(x / 85.0, vW.y / 70.0 - uT * 0.06);
  float b = fb(q), b2 = fb(q * 2.6 + vec2(uT * 0.02, 0.0));
  float a = uOp * (1.0 - smoothstep(top - 160.0 - 80.0 * b, top + 20.0 * b2, vW.y));
  if (a < 0.004) discard;
  float hk = clamp(vW.y / max(1.0, uH), 0.0, 1.0);
  vec3 base = mix(vec3(0.3, 0.17, 0.08), vec3(0.66, 0.46, 0.26), smoothstep(0.0, 0.75, hk));
  // billow shading: each lobe lit on top (sun from above-behind the wall), shadowed in its folds
  float fold = smoothstep(0.25, 0.75, b) * 0.6 + smoothstep(0.3, 0.8, b2) * 0.4;
  // big rolling lobes (embossed: lit where the density thins upward, dark in the folds beneath)
  vec2 q0 = vec2(x / 260.0, vW.y / 200.0 - uT * 0.035);
  float L0 = fb(q0), L1 = fb(q0 + vec2(0.0, 0.07));
  float emb = clamp((L0 - L1) * 8.0 + 0.5, 0.0, 1.0);
  vec3 col = base * (0.45 + 0.55 * hk) * (0.65 + 0.4 * fold) * mix(0.55, 1.3, emb) * (0.7 + 0.45 * L0);
  col += uSunCol * base * 0.45 * pow(hk, 2.0) * fold;
  // the foot: dark, churning, where it swallows the streets
  col *= mix(0.45, 1.0, smoothstep(0.0, 220.0, vW.y));
  col = mix(col, fogColor, clamp(vD / 9000.0, 0.0, 0.5));
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <bay_premul_colorspace>
}`;
export class Haboob {
  constructor(scene, dust) {
    this.dust = dust;
    const g = new THREE.PlaneGeometry(14000, 1, 200, 1); g.translate(0, 0.5, 0);
    this.u = { uH: { value: 950 }, uT: { value: 0 }, uOp: { value: 0 }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color(1.5, 0.9, 0.5) }, fogColor: { value: new THREE.Color() }, uFront: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: HAB_VS, fragmentShader: HAB_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
    this.mesh.scale.y = 1100; this.mesh.frustumCulled = false; this.mesh.renderOrder = 7; this.mesh.visible = false;
    scene.add(this.mesh);
    this.state = null;
  }
  // front starts at z0 moving north (toward -z) at v m/s
  start(z0, v = 22) { this.state = { z: z0, v, t: 0, puffT: 0 }; this.mesh.visible = true; }
  stop() { this.state = null; this.mesh.visible = false; }
  // how far the front is past you (> 0 = you're inside)
  inside(eye) { return this.state ? eye.z - this.state.z : -1e9; }
  update(dt, eye, sun, fog) {
    const S = this.state; if (!S) return;
    S.t += dt; S.z -= S.v * dt;
    this.mesh.position.set(eye.x, 0, S.z);
    this.u.uT.value += dt; this.u.uOp.value = clamp(S.t / 3, 0, 1) * (1 - 0.9 * clamp((eye.z - S.z) / 500, 0, 1) * (this.stormK ?? 0));
    this.u.uSun.value.copy(sun); this.u.fogColor.value.copy(fog.color);
    // puffs ride the crest near you (the volume the sheet can't give), a few a second
    const ahead = S.z - eye.z;
    if (ahead > -200 && ahead < 2600) {
      S.puffT -= dt;
      if (S.puffT <= 0) {
        S.puffT = 0.45;
        const x = eye.x + range(-1400, 1400), y = range(520, 820);
        this.dust.spawn({ x, y, z: S.z + range(-40, 80), vx: range(-3, 3), vy: range(4, 9), vz: -S.v * range(0.95, 1.08), drag: 0.02, buoy: 0.1, s0: range(160, 240), s1: range(280, 380), life: range(14, 20), a: 0.95, fadeIn: 0.15, fadeOut: 0.35, vrot: range(-0.03, 0.03), r: 0.52, g: 0.35, b: 0.2, r1: 0.6, g1: 0.43, b1: 0.27 });
      }
      // billows rolling out ahead of the face, low over the roofs: the depth the sheet can't give up close
      S.lowT = (S.lowT ?? 0) - dt;
      if (ahead < 1500 && S.lowT <= 0) {
        S.lowT = 0.35;
        const x = eye.x + range(-700, 700), y = range(60, 420);
        this.dust.spawn({ x, y, z: S.z - range(10, 140), vx: range(-4, 4), vy: range(2, 6), vz: -S.v * range(1.0, 1.15), drag: 0.02, buoy: 0.08, s0: range(120, 190), s1: range(240, 330), life: range(12, 16), a: 0.96, fadeIn: 0.2, fadeOut: 0.3, vrot: range(-0.04, 0.04), r: 0.42, g: 0.27, b: 0.15, r1: 0.56, g1: 0.39, b1: 0.24 });
      }
    }
  }
}

// ---------------------------------------------------------------------------- sand streaks
export class SandStreaks {
  constructor(scene, n) {
    this.n = n;
    const g = new THREE.PlaneGeometry(1, 1);
    const off = new Float32Array(n * 4), rr = makeRng(77);
    for (let i = 0; i < n; i++) off.set([rr() * 80 - 40, rr() * 50 - 25, rr() * 80 - 40, rr()], i * 4);
    const ig = new THREE.InstancedBufferGeometry(); ig.index = g.index; ig.setAttribute('position', g.attributes.position); ig.setAttribute('uv', g.attributes.uv);
    ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4)); ig.instanceCount = n;
    this.u = { uEye: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector3(6, -1, -38) }, uT: { value: 0 }, uAmt: { value: 0 }, uCol: { value: new THREE.Color(0.62, 0.46, 0.3) } };
    this.mesh = new THREE.Mesh(ig, new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: /* glsl */`attribute vec4 aOff; uniform vec3 uEye; uniform vec3 uWind; uniform float uT; uniform float uAmt; varying vec2 vUv; varying float vA;
        void main(){
          vec3 box = vec3(80.0, 50.0, 80.0);
          vec3 p = aOff.xyz + uWind * (uT * (0.8 + 0.4 * aOff.w));
          p = mod(p - uEye + box * 0.5, box) - box * 0.5 + uEye;
          vec3 d = normalize(uWind);
          vec3 toC = normalize(cameraPosition - p);
          vec3 side = normalize(cross(d, toC));
          float len = 3.5 + 3.0 * aOff.w, w = 0.04 + 0.03 * aOff.w;
          vec3 wp = p + d * position.y * len + side * position.x * w;
          float dist = length(cameraPosition - p);
          vA = uAmt * smoothstep(1.2, 4.0, dist) * (1.0 - smoothstep(25.0, 40.0, dist));
          vUv = uv;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */`uniform vec3 uCol; varying vec2 vUv; varying float vA;
        void main(){ float a = vA * (1.0 - abs(vUv.x - 0.5) * 2.0) * sin(vUv.y * 3.14159) * 0.55; if (a < 0.003) discard; gl_FragColor = vec4(uCol * a, a);
          #include <tonemapping_fragment>
          #include <bay_premul_colorspace>
        }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 10; this.mesh.visible = false;
    scene.add(this.mesh);
  }
  update(dt, eye, amt) {
    this.u.uT.value += dt; this.u.uEye.value.copy(eye); this.u.uAmt.value = amt;
    this.mesh.visible = amt > 0.01;
  }
}
