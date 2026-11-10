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
      const dens = Math.min(1, Math.max(0, t / 0.45)) * (t > 0 ? 1 : 0);
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
attribute float iSt; // horizontal stretch (sheets of spray / a rolling front); 1 = round
uniform float uNearK;
varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vCS; varying float vWorldY; varying float vFlip; varying vec2 vQ;
varying float vFogDepth; varying vec3 vFogViewPos;
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iP.y), s = sin(iP.y);
  vec2 p = position.xy * iP.x * vec2(iSt, 1.0);
  vec3 offs = vec3(c * p.x - s * p.y, s * p.x + c * p.y, 0.0);
  mv.xyz += offs;
  vQ = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * 2.0;   // view-space position across the puff, -1..1
  vWorldY = iPos.y + (offs * mat3(viewMatrix)).y;   // view → world rotation is the transpose
  // variants 4..7 are the mirrored atlas cells: twice the shapes, no visible repeats in a wall of them
  float vr = mod(iP.w, 4.0); vFlip = iP.w > 3.5 ? -1.0 : 1.0;
  vec2 cell = vec2(mod(vr, 2.0), floor(vr / 2.0));
  vUv = (cell + vec2(position.x * vFlip, position.y) + 0.5) * 0.5;
  vCS = vec2(c, s);
  vC = iC;
  // fade as the puff reaches the eye (fill rate + no cardboard planes in your face)
  float cz = -(modelViewMatrix * vec4(iPos, 1.0)).z;   // per puff, not per corner (no straight-edged gradients across big quads)
  vA = iP.z * smoothstep(0.8, 0.8 + iP.x * uNearK, cz);
  vFogDepth = -mv.z; vFogViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (iP.z <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FS = /* glsl */`
uniform sampler2D tex;
uniform vec3 fogColor; uniform vec3 fogColorSun; uniform vec3 fogSunDir; uniform float fogNear; uniform float fogFar;
uniform float groundY; uniform float uDim; uniform float uSoft;
varying vec2 vUv; varying vec4 vC; varying float vA; varying vec2 vCS; varying float vWorldY; varying float vFlip; varying vec2 vQ;
varying float vFogDepth; varying vec3 vFogViewPos;
void main(){
  vec4 t = texture2D(tex, vUv);
  float al = t.a * (0.72 + 0.28 * smoothstep(0.0, 0.6, t.r));   // thin, see-through fringes
  // soft mode (opt-in per level): a gaussian body with only a breath of the lobes in it, so neighbouring puffs melt into
  // one continuous mass instead of reading as separate cotton balls
  float r2 = dot(vQ, vQ);
  al = mix(al, exp(-r2 * 2.2) * (0.6 + 0.4 * smoothstep(0.0, 0.5, t.a)) * (1.0 - smoothstep(0.8, 1.0, r2)), uSoft);
  al *= vA * smoothstep(groundY - 0.5, groundY + 2.0, vWorldY);
  if (al < 0.003) discard;
  vec2 n2 = t.gb * 2.0 - 1.0; n2.x *= vFlip;
  vec2 nr = vec2(vCS.x * n2.x - vCS.y * n2.y, vCS.y * n2.x + vCS.x * n2.y);
  // mostly a lit sphere (big soft top-lit/bottom-dark shape), a little of the lobes on top of it
  vec3 Ns = vec3(vQ * 0.9, sqrt(max(0.05, 1.0 - dot(vQ, vQ) * 0.81)));
  vec3 N = normalize(Ns * (1.0 - 0.8 * uSoft) + vec3(0.0, 0.0, 0.8 * uSoft) + vec3(nr * 0.85 * (1.0 - 0.75 * uSoft), 0.0));
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float sky = dot(N, upV) * 0.5 + 0.5;
  float sunL = max(dot(N, fogSunDir) * 0.6 + 0.4, 0.0);
  vec3 V = normalize(vFogViewPos);
  float toward = pow(max(dot(V, fogSunDir), 0.0), 5.0);
  vec3 base = vC.rgb;
  float lump = mix(0.8 + 0.2 * t.r, 0.95, uSoft);                                          // thick lobes catch light, cavities stay dark
  vec3 col = base * (0.32 + 0.8 * sky * sky) * lump;                      // sky from above, dark undersides
  col += base * fogColorSun * 0.32 * sunL * sunL * lump;                   // low sun on the lit side
  float edge = sqrt(t.a) * (1.0 - t.a) * 2.6;
  col += fogColorSun * (base + 0.03) * toward * edge * 0.06;               // sun shining through the thin fringe
  col += vec3(1.5, 0.58, 0.2) * vC.a * (1.0 - sky) * (1.0 - sky) * (0.4 + 0.6 * t.r);          // fire glow from below
  col *= 1.0 - 0.4 * uDim;                                                // the wall has eaten the sun
  float f = smoothstep(fogNear, fogFar, vFogDepth); f = 1.0 - (1.0 - f) * (1.0 - f);
  float fs = max(dot(V, fogSunDir), 0.0);
  col = mix(col, mix(fogColor, fogColorSun, pow(fs, 3.0)), f);
  gl_FragColor = vec4(col * al, al);
  #include <tonemapping_fragment>
  #include <bay_premul_colorspace>
}`;

const OCC_AZ = 144, OCC_EL = 72, OCC_BIN = (2 * Math.PI) / OCC_AZ, HALF_PI = Math.PI / 2, OCC_T = 0.04;

export class DustClouds {
  constructor(scene, fog, { max = 320, occlusion = true, fillBudget = 0, soft = 0 } = {}) {
    this.max = max;
    this.occlusion = occlusion; this.fillBudget = fillBudget;
    this._T = new Float32Array(OCC_AZ * OCC_EL); this._keep = [];
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aS = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1).setUsage(THREE.DynamicDrawUsage);   // horizontal stretch (1 = round)
    g.setAttribute('iPos', this.aPos); g.setAttribute('iP', this.aP); g.setAttribute('iC', this.aC); g.setAttribute('iSt', this.aS);
    g.instanceCount = 0;
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: bakePuffAtlas() }, uNearK: { value: 0.22 }, uDim: { value: 0 }, uSoft: { value: soft }, groundY: { value: -50 },
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
    p.variant = o.variant ?? (this.vid++ % 8);
    p.ride = o.ride || null; p.oz = o.oz || 0;
    p.bv = this.fillBudget ? 0 : 1; // with a fill budget, puffs fade in once they're granted a share of it
    p.st = o.st ?? 1;
    return p;
  }
  update(dt, eye, ground = -50, fwd = null) {
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
    for (const p of vis) {
      const t = p.age / p.life;
      p.sz = p.s0 + (p.s1 - p.s0) * (1 - (1 - t) * (1 - t));
      p.al = p.a * Math.min(1, t / Math.max(1e-3, p.fadeIn)) * Math.min(1, (1 - t) / Math.max(1e-3, p.fadeOut));
    }
    vis.sort((a, b) => b.d2 - a.d2);
    if (this.occlusion) this._occlude(vis, eye);
    if (this.fillBudget && fwd) this._budget(vis, eye, fwd, dt);
    const P = this.aPos.array, Q = this.aP.array, C = this.aC.array, S = this.aS.array;
    for (let i = 0; i < vis.length; i++) {
      const p = vis[i], t = p.age / p.life;
      const sz = p.sz, a = p.al * p.bv;
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
      Q[i * 4] = sz; Q[i * 4 + 1] = p.rot; Q[i * 4 + 2] = a; Q[i * 4 + 3] = p.variant;
      C[i * 4] = p.r + (p.r1 - p.r) * t; C[i * 4 + 1] = p.g + (p.g1 - p.g) * t; C[i * 4 + 2] = p.b + (p.b1 - p.b) * t;
      C[i * 4 + 3] = p.glow * Math.max(0, 1 - t * p.glowFade);   // (went negative past 1/glowFade: it subtracted orange = teal/olive smoke)
      S[i] = p.st;
    }
    for (const a of [this.aPos, this.aP, this.aC, this.aS]) { a.clearUpdateRanges(); a.addUpdateRange(0, vis.length * a.itemSize); a.needsUpdate = true; }
    this.geometry.instanceCount = vis.length;
    // fog uniforms follow the (dust-mixed) scene fog
    const u = this.material.uniforms; u.fogNear.value = this.fog.near; u.fogFar.value = this.fog.far;
  }
  // Fill-rate cull (the Quest bottleneck: a dust wall stacks 40+ screen-sized layers). Walks the puffs near → far
  // on a grid of directions around the eye (angles, so it holds for both VR eyes and any head turn) and drops:
  //  - puffs the near fade has already made invisible (they still cost a screen-sized quad),
  //  - puffs whose whole footprint sits behind thick, nearer puffs (transmittance < OCC_T in every cell).
  // Only each puff's dense core occludes, and only cells it covers completely, so the result looks the same.
  _occlude(vis, eye) {
    const T = this._T, nearK = this.material.uniforms.uNearK.value, keep = this._keep, fN = this.fog.near, fF = this.fog.far;
    T.fill(1); keep.length = 0;
    for (let i = vis.length - 1; i >= 0; i--) {
      const p = vis[i], d = Math.sqrt(p.d2);
      const x = (d - 0.8) / Math.max(1e-3, p.sz * nearK), nf = x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
      const ae = p.al * nf;
      if (ae < 0.01) continue;
      // swallowed by the fog: even its nearest edge is fog colour, same as everything behind it (the dust fog is ~30 m deep)
      const fd = (d - p.sz * 0.5 - fN) / Math.max(1e-3, fF - fN);
      if (fd >= 1) continue;
      const el = Math.asin(Math.max(-1, Math.min(1, (p.y - eye.y) / d))), az = Math.atan2(p.x - eye.x, eye.z - p.z);
      const rOut = Math.atan(p.sz * 0.71 / d);
      if (!this._visible(el, az, rOut)) continue;
      keep.push(p);
      const rIn = Math.atan(p.sz * 0.28 / d);
      if (rIn > OCC_BIN) this._attenuate(el, az, rIn, 1 - 0.8 * ae);
    }
    vis.length = 0;
    for (let i = keep.length - 1; i >= 0; i--) vis.push(keep[i]);
  }
  // Hard cap on what's left: the puffs in front of the eye may cover at most `fillBudget` screens' worth. Near ones have
  // priority (they're what you see); the farthest ones over budget fade out (and back in) over ~0.2 s, so turning your head
  // doesn't pop anything (per rendered frame, not game time: the collapse runs in slow-mo). The 70° cone is wider than the Quest's per-eye view.
  _budget(vis, eye, fwd, dt) {
    const k = 0.25, cosC = Math.cos(70 * Math.PI / 180);
    let used = 0;
    for (let i = vis.length - 1; i >= 0; i--) {
      const p = vis[i], d = Math.max(0.5, Math.sqrt(p.d2));
      const dx = (p.x - eye.x) / d, dy = (p.y - eye.y) / d, dz = (p.z - eye.z) / d;
      const ang = Math.atan(p.sz * 0.5 / d);
      const inView = Math.acos(Math.max(-1, Math.min(1, dx * fwd.x + dy * fwd.y + dz * fwd.z))) - ang < Math.acos(cosC);
      let want = 1;
      if (inView) { const c = Math.min(1, p.sz / (2 * d)); used += c * c; if (used > this.fillBudget) want = 0; }
      p.bv = want ? p.bv + (1 - p.bv) * k : p.bv * 0.45; // out faster than in: a fading puff still costs its full area
    }
    let w = 0;
    for (let i = 0; i < vis.length; i++) if (vis[i].bv > 0.02) vis[w++] = vis[i];
    vis.length = w;
  }
  _visible(el, az, r) {
    const T = this._T;
    const e0 = Math.max(0, Math.floor((el - r + HALF_PI) / OCC_BIN)), e1 = Math.min(OCC_EL - 1, Math.floor((el + r + HALF_PI) / OCC_BIN));
    const c = Math.cos(Math.min(HALF_PI, Math.abs(el) + r));
    const h = c < 0.1 ? Math.PI : r / c;
    const a0 = Math.floor((az - h + Math.PI) / OCC_BIN), a1 = h >= Math.PI ? a0 + OCC_AZ - 1 : Math.floor((az + h + Math.PI) / OCC_BIN);
    for (let e = e0; e <= e1; e++) for (let a = a0; a <= a1; a++) if (T[e * OCC_AZ + ((a % OCC_AZ) + OCC_AZ) % OCC_AZ] > OCC_T) return true;
    return false;
  }
  _attenuate(el, az, r, k) {
    // only cells completely inside the core square (|Δel|, |Δaz| ≤ r: the az span is narrower than r/cos(el), so this is conservative)
    const T = this._T;
    const e0 = Math.ceil((el - r + HALF_PI) / OCC_BIN), e1 = Math.floor((el + r + HALF_PI) / OCC_BIN) - 1;
    const a0 = Math.ceil((az - r + Math.PI) / OCC_BIN), a1 = Math.floor((az + r + Math.PI) / OCC_BIN) - 1;
    for (let e = Math.max(0, e0); e <= Math.min(OCC_EL - 1, e1); e++) for (let a = a0; a <= a1; a++) T[e * OCC_AZ + ((a % OCC_AZ) + OCC_AZ) % OCC_AZ] *= k;
  }
  get alive() { return this.order.length; }
}
