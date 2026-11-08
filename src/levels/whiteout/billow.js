import * as THREE from 'three';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  BillowCloud: the avalanche's powder cloud. Lit billow impostors, not flat smoke sprites.
//  Each puff is a camera-facing quad shaded as a noisy sphere: a cauliflower edge eroded by
//  billow noise, a normal from the sphere + the noise's screen-space gradient, lit by the sun
//  (warm white tops) against a blue-grey self-shadowed underside, a thin bright rim where the
//  sun is behind it. One draw, sorted back to front on the CPU (a few hundred puffs at most),
//  premultiplied like the engine's smoke so it sits right in the grade.
// =====================================================================================
const NOISE = /* glsl */`
float h3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float bil(vec3 p){ float s = 0.0, a = 0.55; for (int i = 0; i < 3; i++) { s += a * (1.0 - abs(n3(p) * 2.0 - 1.0)); p = p * 2.13 + vec3(3.1, 7.7, 1.3); a *= 0.5; } return s; }
`;

export class BillowCloud {
  constructor(scene, { max = 220 } = {}) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSz = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);   // size, rot, seed, alpha
    this.aTone = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSz', this.aSz); g.setAttribute('iTone', this.aTone);
    g.instanceCount = 0;
    this.u = {
      uTime: { value: 0 }, uSunV: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1.15, 1.06, 0.95) },
      uShade: { value: new THREE.Color(0.38, 0.47, 0.64) }, uLight: { value: 1 },
      fogColor: { value: new THREE.Color() }, fogNear: { value: 10 }, fogFar: { value: 1000 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: /* glsl */`
        attribute vec3 iPos; attribute vec4 iSz; attribute float iTone;
        varying vec2 vUv; varying float vSeed; varying float vA; varying float vTone; varying float vD;
        void main(){
          vec4 mv = viewMatrix * vec4(iPos, 1.0);
          float c = cos(iSz.y), s = sin(iSz.y);
          vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
          mv.xy += q * iSz.x;
          vUv = position.xy; vSeed = iSz.z; vA = iSz.w; vTone = iTone; vD = -mv.z;
          // fade the near ones out before the eye passes through them
          vA *= smoothstep(iSz.x * 0.4, iSz.x * 1.4, -mv.z);
          gl_Position = projectionMatrix * mv;
          if (vA <= 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`,
      fragmentShader: NOISE + /* glsl */`
        uniform float uTime; uniform vec3 uSunV; uniform vec3 uSunCol; uniform vec3 uShade; uniform float uLight;
        uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
        varying vec2 vUv; varying float vSeed; varying float vA; varying float vTone; varying float vD;
        void main(){
          float r2 = dot(vUv, vUv);
          if (r2 > 1.0) discard;
          vec3 q = vec3(vUv * 1.55 + vSeed * 17.3, vSeed * 3.1 + uTime * 0.06);
          float h = bil(q);
          // cauliflower edge: the sphere's rim eroded by the billows
          float edge = (1.0 - r2) * 1.25 + (h - 0.62) * 0.9;
          float a = smoothstep(0.0, 0.6, edge) * vA;
          if (a < 0.004) discard;
          // normal: the sphere, bent by the billow relief (screen-space gradient of the noise)
          vec3 N = normalize(vec3(vUv * 0.92, sqrt(max(0.04, 1.0 - r2))));
          N.xy -= vec2(dFdx(h), dFdy(h)) * 42.0;
          N = normalize(N);
          float dif = clamp(dot(N, uSunV), 0.0, 1.0);
          float wrap = clamp(dot(N, uSunV) * 0.5 + 0.5, 0.0, 1.0);
          // self shadow: the underside of each puff and the low puffs of the cloud are in their own shade
          float up = smoothstep(-0.9, 0.7, vUv.y + N.y * 0.45);
          float lit = mix(wrap * 0.35, dif, 0.7) * mix(0.35, 1.0, up) * mix(0.55, 1.0, vTone) * uLight;
          // cavities between the billows sit in shade; the thin rim of a puff is dimmer, not a bright outline
          float ao = mix(0.62, 1.05, smoothstep(0.35, 0.95, h)) * mix(0.78, 1.0, smoothstep(0.0, 0.7, edge));
          vec3 col = mix(uShade * mix(0.8, 1.05, vTone), uSunCol * 0.92, clamp(lit * 0.9, 0.0, 1.0)) * ao;
          // sun behind it: light through the thin edge
          col += uSunCol * pow(1.0 - N.z, 3.0) * clamp(-uSunV.z, 0.0, 1.0) * 0.25 * uLight * (1.0 - smoothstep(0.0, 0.5, edge));
          float f = smoothstep(fogNear, fogFar, vD); f = 1.0 - (1.0 - f) * (1.0 - f);
          col = mix(col, fogColor, f * 0.9);
          // grade the straight colour, THEN premultiply (tonemapping a premultiplied colour brightens thin edges into halos)
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor = vec4(gl_FragColor.rgb * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      fog: false, extensions: { derivatives: true },
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 22;
    scene.add(this.mesh);
    this.g = g;
    this.list = [];
    this._order = [];
    this.rng = makeRng(5150);
  }
  // p: Vector3-like, v: velocity, s0 → s1 size over life (radius, m), tone 0 (low, shaded) .. 1 (top, lit)
  spawn({ x, y, z, vx = 0, vy = 0, vz = 0, s0, s1, life, tone = 1, a = 1, drag = 0.3, rise = 0 }) {
    if (this.list.length >= this.max) { let oldest = 0; for (let i = 1; i < this.list.length; i++) if (this.list[i].t / this.list[i].life > this.list[oldest].t / this.list[oldest].life) oldest = i; this.list.splice(oldest, 1); }
    this.list.push({ x, y, z, vx, vy, vz, s0, s1, life, t: 0, tone, a, drag, rise, seed: this.rng(), rot: this.rng() * 6.28, vr: 0 });
  }
  update(dt, camera, sunDir, { fog, light = 1, time = 0 } = {}) {
    this.u.uTime.value = time; this.u.uLight.value = light;
    if (fog) { this.u.fogColor.value.copy(fog.color); this.u.fogNear.value = fog.near; this.u.fogFar.value = fog.far; }
    // sun direction in view space
    this.u.uSunV.value.copy(sunDir).transformDirection(camera.matrixWorldInverse);
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const P = L[i]; P.t += dt;
      if (P.t >= P.life) { L.splice(i, 1); continue; }
      const d = Math.exp(-P.drag * dt);
      P.vx *= d; P.vz *= d; P.vy = P.vy * d + P.rise * dt;
      P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
    }
    // back to front
    const cp = camera.getWorldPosition(_c);
    const O = this._order; O.length = L.length;
    for (let i = 0; i < L.length; i++) { const P = L[i]; P._d = (P.x - cp.x) ** 2 + (P.y - cp.y) ** 2 + (P.z - cp.z) ** 2; O[i] = P; }
    O.sort((a, b) => b._d - a._d);
    const ps = this.aPos.array, sz = this.aSz.array, tn = this.aTone.array;
    for (let i = 0; i < O.length; i++) {
      const P = O[i], k = P.t / P.life;
      const s = P.s0 + (P.s1 - P.s0) * (1 - (1 - k) * (1 - k));
      const al = P.a * Math.min(1, P.t / 0.35) * (1 - Math.max(0, (k - 0.6) / 0.4));
      ps[i * 3] = P.x; ps[i * 3 + 1] = P.y; ps[i * 3 + 2] = P.z;
      sz[i * 4] = s; sz[i * 4 + 1] = P.rot + P.t * 0.05; sz[i * 4 + 2] = P.seed; sz[i * 4 + 3] = al;
      tn[i] = P.tone;
    }
    for (const a of [this.aPos, this.aSz, this.aTone]) { a.clearUpdateRanges(); a.addUpdateRange(0, O.length * a.itemSize); a.needsUpdate = true; }
    this.g.instanceCount = O.length;
  }
}
const _c = new THREE.Vector3();
