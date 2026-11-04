import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { fogShared } from '../../atmosphere.js';

// =====================================================================================
//  DUST CLOUDS — big, soft, sun-lit puffs for the set pieces (dust wall, collapse shrouds,
//  smoke columns). Level-local: one instanced draw call, its own pool (it never eats the
//  shared particle big-sprite budget), sorted back to front every frame.
//  Each puff samples a baked cauliflower "height" atlas (2x2 variants: thickness, normal.xy,
//  density) and is lit like a lumpy sphere: sky from above, sun wrap, translucent sun glow
//  through thin edges when you look toward the sun, optional fire glow from below.
// =====================================================================================

const N = 128; // per-variant resolution (4 variants → 256² RGBA8)
function bakePuffAtlas() {
  const W = N * 2, data = new Uint8Array(W * W * 4);
  const rng = makeRng(9127);
  for (let v = 0; v < 4; v++) {
    // value-noise lattice for this variant
    const L = 64, lat = new Float32Array(L * L);
    for (let i = 0; i < lat.length; i++) lat[i] = rng();
    const vn = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const g = (i, j) => lat[((j & (L - 1)) * L) + (i & (L - 1))];
      const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * sx, b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * sx;
      return a + (b - a) * sy;
    };
    // billow fbm: rounded lobes (|2n-1| folds the noise into cauliflower bumps)
    const billow = (x, y) => { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < 4; o++) { s += a * (1 - Math.abs(vn(x * f + o * 17.3, y * f - o * 9.1) * 2 - 1)); n += a; a *= 0.42; f *= 2.03; } return s / n; };
    const ox0 = rng() * 40, oy0 = rng() * 40;
    // cauliflower: a union of round lobes (big ones low and central, small ones crowning the top and rim)
    const lobes = [];
    for (let i = 0; i < 60; i++) {
      const big = i < 5;
      const a = rng() * Math.PI * 2, rr = big ? 0.04 + rng() * 0.12 : Math.sqrt(rng()) * 0.3;
      const cx = Math.cos(a) * rr, cy = Math.sin(a) * rr * 0.85 + (big ? -0.03 : 0.02);
      const r = big ? 0.13 + rng() * 0.05 : 0.055 + rng() * 0.075;
      lobes.push([cx, cy, r]);
    }
    const h = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N - 0.5, w = (y + 0.5) / N - 0.5;
      let m = 0, acc = 0;
      for (const [cx, cy, r] of lobes) {
        const d2 = ((u - cx) ** 2 + (w - cy) ** 2) / (r * r);
        if (d2 < 1) { const q = Math.sqrt(1 - d2) * r + (0.34 - Math.hypot(cx, cy)) * 0.3; acc += Math.exp(q * 70); m = 1; }
      }
      if (m) m = Math.max(0, Math.log(acc) / 70); // smooth union: soft creases between the lobes
      // fine billowing on the lobes, and nothing touches the cell border
      const b = billow(u * 6 + ox0, w * 6 + oy0);
      const rad = Math.hypot(u, w);
      h[y * N + x] = m > 0 ? Math.max(0, m * (0.86 + 0.14 * b)) * Math.min(1, Math.max(0, (0.49 - rad) / 0.06)) : 0;
    }
    let hmax = 0; for (const q of h) hmax = Math.max(hmax, q);
    const ox = (v & 1) * N, oy = (v >> 1) * N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const at = (xx, yy) => h[Math.min(N - 1, Math.max(0, yy)) * N + Math.min(N - 1, Math.max(0, xx))] / hmax;
      const t = at(x, y);
      const gx = (at(x + 1, y) - at(x - 1, y)) * 10, gy = (at(x, y + 1) - at(x, y - 1)) * 10;
      const nl = Math.hypot(gx, gy, 1);
      const dens = Math.min(1, Math.max(0, t / 0.3)) * (t > 0 ? 1 : 0);
      const o = ((oy + y) * W + ox + x) * 4;
      data[o] = Math.round(t * 255);
      data[o + 1] = Math.round((-gx / nl * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round((-gy / nl * 0.5 + 0.5) * 255);
      data[o + 3] = Math.round(Math.pow(dens * dens * (3 - 2 * dens), 0.8) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const VS = /* glsl */`
attribute vec3 iPos;
attribute vec4 iP;   // size, rot, alpha, variant
attribute vec4 iC;   // rgb tint, fire glow from below
uniform float uNearK;
varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vCS; varying float vWorldY;
varying float vFogDepth; varying vec3 vFogViewPos;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iP.y), s = sin(iP.y);
  vec2 p = position.xy * iP.x;
  vec3 offs = vec3(c * p.x - s * p.y, s * p.x + c * p.y, 0.0);
  mv.xyz += offs;
  vWorldY = iPos.y + (offs * mat3(viewMatrix)).y;   // view → world rotation is the transpose
  vec2 cell = vec2(mod(iP.w, 2.0), floor(iP.w / 2.0));
  vUv = (cell + position.xy + 0.5) * 0.5;
  vCS = vec2(c, s);
  vC = iC;
  // fade as the puff reaches the eye (fill rate + no cardboard planes in your face)
  vA = iP.z * smoothstep(0.8, 0.8 + iP.x * uNearK, -mv.z);
  vFogDepth = -mv.z; vFogViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (iP.z <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FS = /* glsl */`
uniform sampler2D tex;
uniform vec3 fogColor; uniform vec3 fogColorSun; uniform vec3 fogSunDir; uniform float fogNear; uniform float fogFar;
uniform float groundY;
varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vCS; varying float vWorldY;
varying float vFogDepth; varying vec3 vFogViewPos;
void main(){
  vec4 t = texture2D(tex, vUv);
  float al = t.a * vA * smoothstep(groundY - 0.5, groundY + 2.0, vWorldY);
  if (al < 0.003) discard;
  vec2 n2 = t.gb * 2.0 - 1.0;
  vec2 nr = vec2(vCS.x * n2.x - vCS.y * n2.y, vCS.y * n2.x + vCS.x * n2.y);
  vec3 N = normalize(vec3(nr, 0.55));
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float sky = dot(N, upV) * 0.5 + 0.5;
  float sunL = max(dot(N, fogSunDir) * 0.6 + 0.4, 0.0);
  vec3 V = normalize(vFogViewPos);
  float toward = pow(max(dot(V, fogSunDir), 0.0), 5.0);
  vec3 base = vC.rgb;
  float lump = 0.7 + 0.3 * t.r;                                          // thick lobes catch light, cavities stay dark
  vec3 col = base * (0.32 + 0.8 * sky * sky) * lump;                      // sky from above, dark undersides
  col += base * fogColorSun * 0.32 * sunL * sunL * lump;                   // low sun on the lit side
  float edge = sqrt(t.a) * (1.0 - t.a) * 2.6;
  col += fogColorSun * (base + 0.03) * toward * edge * 0.06;               // sun shining through the thin fringe
  col += vec3(1.6, 0.62, 0.2) * vC.a * (1.0 - sky) * (1.0 - sky);          // fire glow from below
  float f = smoothstep(fogNear, fogFar, vFogDepth); f = 1.0 - (1.0 - f) * (1.0 - f);
  float fs = max(dot(V, fogSunDir), 0.0);
  col = mix(col, mix(fogColor, fogColorSun, pow(fs, 3.0)), f);
  gl_FragColor = vec4(col * al, al);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class DustClouds {
  constructor(scene, fog, { max = 320 } = {}) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iP', this.aP); g.setAttribute('iC', this.aC);
    g.instanceCount = 0;
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: bakePuffAtlas() }, uNearK: { value: 0.22 }, groundY: { value: -50 },
        fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far },
        fogColorSun: { value: fogShared.sunColor }, fogSunDir: { value: fogShared.sunDirView },
      },
      vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.fog = fog;
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 9; // under the shared fx batches (fire reads on top of its own smoke)
    scene.add(this.mesh);
    this.p = [];
    this.order = [];
    this.vid = 0;
  }
  // o: x y z, vx vy vz, drag, buoy (up accel), s0 s1, life, a, fadeIn, fadeOut, rot vrot, r g b, glow, ride {z} + oz
  spawn(o) {
    let p;
    if (this.p.length < this.max) { p = {}; this.p.push(p); }
    else { // recycle the oldest
      let best = 0, bt = -1;
      for (let i = 0; i < this.p.length; i++) { const q = this.p[i]; const k = q.alive ? q.age / q.life : 9; if (k > bt) { bt = k; best = i; } }
      p = this.p[best];
    }
    p.alive = true; p.age = 0;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.drag = o.drag ?? 0.3; p.buoy = o.buoy || 0;
    p.s0 = o.s0; p.s1 = o.s1 ?? o.s0; p.life = o.life || 5;
    p.a = o.a ?? 1; p.fadeIn = o.fadeIn ?? 0.1; p.fadeOut = o.fadeOut ?? 0.4;
    p.rot = o.rot ?? this.vid * 2.39996; p.vrot = o.vrot || 0;
    p.r = o.r ?? 0.5; p.g = o.g ?? 0.44; p.b = o.b ?? 0.36; p.glow = o.glow || 0; p.glowFade = o.glowFade ?? 1;
    p.r1 = o.r1 ?? p.r; p.g1 = o.g1 ?? p.g; p.b1 = o.b1 ?? p.b;
    p.variant = o.variant ?? (this.vid++ & 3);
    p.ride = o.ride || null; p.oz = o.oz || 0;
    return p;
  }
  update(dt, eye, ground = -50) {
    this.material.uniforms.groundY.value = ground;
    const vis = this.order; vis.length = 0;
    for (const p of this.p) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr; p.vy = p.vy * dr + p.buoy * dt; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.ride) { p.oz += p.vz * dt; p.z = p.ride.z + p.oz; } else p.z += p.vz * dt;
      p.rot += p.vrot * dt;
      p.d2 = (p.x - eye.x) ** 2 + (p.y - eye.y) ** 2 + (p.z - eye.z) ** 2;
      vis.push(p);
    }
    vis.sort((a, b) => b.d2 - a.d2);
    const P = this.aPos.array, Q = this.aP.array, C = this.aC.array;
    for (let i = 0; i < vis.length; i++) {
      const p = vis[i], t = p.age / p.life;
      const sz = p.s0 + (p.s1 - p.s0) * (1 - (1 - t) * (1 - t));
      const a = p.a * Math.min(1, t / Math.max(1e-3, p.fadeIn)) * Math.min(1, (1 - t) / Math.max(1e-3, p.fadeOut));
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
      Q[i * 4] = sz; Q[i * 4 + 1] = p.rot; Q[i * 4 + 2] = a; Q[i * 4 + 3] = p.variant;
      C[i * 4] = p.r + (p.r1 - p.r) * t; C[i * 4 + 1] = p.g + (p.g1 - p.g) * t; C[i * 4 + 2] = p.b + (p.b1 - p.b) * t;
      C[i * 4 + 3] = p.glow * (1 - t * p.glowFade);
    }
    for (const a of [this.aPos, this.aP, this.aC]) { a.clearUpdateRanges(); a.addUpdateRange(0, vis.length * a.itemSize); a.needsUpdate = true; }
    this.geometry.instanceCount = vis.length;
    // fog uniforms follow the (dust-mixed) scene fog
    const u = this.material.uniforms; u.fogNear.value = this.fog.near; u.fogFar.value = this.fog.far;
  }
  get alive() { return this.order.length; }
}
