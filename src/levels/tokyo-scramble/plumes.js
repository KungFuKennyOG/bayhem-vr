import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { DAY } from './tod.js';

// =====================================================================================
//  The war is citywide: black smoke columns standing over the skyline from the first frame (the
//  Transformers Chicago look — against a clear blue sky they read from kilometres). Each is one
//  camera-facing card with a small shader: a widening, wind-bent column envelope times two scrolling
//  octaves of tileable noise (it billows upward), dark brown-black at the base, sunlit grey on the
//  sun side higher up, a faint fire glow at the foot. The finale adds two more over Center-gai.
// =====================================================================================
function noiseTex() {
  const S = 128, rng = makeRng(77), g = new Float32Array(16 * 16);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const vn = (x, y, p) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const at = (a, b) => g[((b % p + p) % p) * 16 + ((a % p + p) % p)];
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v; };
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0, a = 0.5, f = 4;
    for (let o = 0; o < 4; o++) { s += a * vn(x / S * f, y / S * f, f); a *= 0.5; f *= 2; }
    const i = (y * S + x) * 4; d[i] = d[i + 1] = d[i + 2] = Math.round(255 * Math.min(1, s * 1.1)); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = /* glsl */`
uniform sampler2D tN; uniform float uT, uSeed, uSide, uK; uniform vec3 uHaze;
varying vec2 vUv;
void main(){
  float v = vUv.y;
  float drift = pow(v, 1.5) * 0.22;
  float w = 0.1 + 0.38 * pow(v, 0.7);
  float n1 = texture2D(tN, vec2(vUv.x * 1.3 + uSeed, v * 1.6 - uT * 0.018)).r;
  float n2 = texture2D(tN, vec2(vUv.x * 2.7 - uSeed, v * 3.4 - uT * 0.041)).r;
  float n = n1 * 0.65 + n2 * 0.45;
  float u = vUv.x - 0.5 - drift + (n1 - 0.5) * 0.16 * v;
  float body = 1.0 - pow(abs(u) / w, 2.0);
  float a = clamp(body * (0.9 + 1.1 * n) - 0.05, 0.0, 1.0) * smoothstep(0.0, 0.05, v) * (1.0 - pow(v, 2.6)) * uK;
  // lit side (the sun is to one side of the column as you see it), billows catch light
  float lit = clamp(0.5 + uSide * u / w * 0.6, 0.0, 1.0) * smoothstep(0.08, 0.5, v);
  vec3 c = mix(vec3(0.035, 0.03, 0.028), vec3(0.27, 0.26, 0.24), lit * (0.3 + 0.6 * n));
  c += vec3(1.6, 0.55, 0.15) * (1.0 - smoothstep(0.0, 0.07, v)) * n;   // the fire at its foot
  c = mix(c, uHaze, 0.22 * smoothstep(0.3, 1.0, v));
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function buildPlumes(ctx = {}) {
  const root = new THREE.Group(); root.name = 'plumes';
  if (!DAY.on) return { root };
  const tex = noiseTex(), list = [];
  const add = (x, z, w, h, seed, k = 1) => {
    const m = new THREE.ShaderMaterial({ uniforms: { tN: { value: tex }, uT: { value: 0 }, uSeed: { value: seed }, uSide: { value: 1 }, uK: { value: k }, uHaze: { value: new THREE.Color(0.64, 0.73, 0.86) } }, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), m);
    p.scale.set(w, h, 1); p.position.set(x, -4, z); p.renderOrder = 3; p.frustumCulled = false;
    root.add(p); list.push(p);
    return p;
  };
  // over the skyline in every direction you look from the bridge, the crossing and the expressway
  add(430, -150, 300, 760, 0.13); add(300, -480, 240, 640, 0.41); add(-420, -380, 220, 560, 0.77);
  add(380, 330, 260, 700, 0.29); add(-60, 520, 220, 600, 0.61); add(760, 180, 320, 820, 0.9, 0.9);
  const update = (dt, t, head) => {
    for (const p of list) {
      p.material.uniforms.uT.value = t;
      const dx = head.x - p.position.x, dz = head.z - p.position.z;
      p.rotation.y = Math.atan2(dx, dz);
      // which side the sun lights, as you see the column (the sun is in the west)
      p.material.uniforms.uSide.value = dz > 0 ? 1 : -1;
    }
  };
  return { root, update, plumes: list, add };
}
