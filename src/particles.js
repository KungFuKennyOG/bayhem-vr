import * as THREE from 'three';
import { fogShared } from './atmosphere.js';

// ---------------- FX atlas (generated on GPU once) ----------------
// 2048x2048, 16x16 cells of 128px.
// Fire flipbook: 64 frames at cells x0..7,y0..7. Smoke flipbook: 64 frames at x8..15,y0..7.
// Misc cells row 8: 0 glow, 1 star(muzzle), 2 ring, 3 dust puff, 4 spark dot, 5 debris chip, 6 flash, 7 star2, 8 soft smoke wisp, 9 blood-free 'dirt' kick
export const CELL = { GLOW: 8 * 16 + 0, STAR: 8 * 16 + 1, RING: 8 * 16 + 2, DUST: 8 * 16 + 3, SPARK: 8 * 16 + 4, CHIP: 8 * 16 + 5, FLASH: 8 * 16 + 6, STAR2: 8 * 16 + 7, WISP: 8 * 16 + 8, DIRT: 8 * 16 + 9 };
export const fireFrame = (k) => { k = Math.max(0, Math.min(63, k | 0)); return Math.floor(k / 8) * 16 + (k % 8); };
export const smokeFrame = (k) => { k = Math.max(0, Math.min(63, k | 0)); return Math.floor(k / 8) * 16 + 8 + (k % 8); };
export const FIRE0 = 0, SMOKE0 = 8;

const atlasFrag = /* glsl */`
precision highp float;
varying vec2 vUv;
float h31(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y), f.z); }
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*n3(p); p=p*2.02+vec3(1.7,9.2,3.1); a*=.5; } return s; }
vec3 ramp(float h){
  // black body-ish ramp
  vec3 c = mix(vec3(0.0), vec3(0.45,0.04,0.0), smoothstep(0.0,0.25,h));
  c = mix(c, vec3(1.0,0.32,0.02), smoothstep(0.2,0.5,h));
  c = mix(c, vec3(1.0,0.72,0.2), smoothstep(0.45,0.75,h));
  c = mix(c, vec3(1.0,0.97,0.85), smoothstep(0.72,1.0,h));
  return c;
}
void main(){
  vec2 g = vUv * 16.0;
  vec2 cell = floor(g);
  vec2 p = (fract(g) - 0.5) * 2.0;   // -1..1
  cell.y = 15.0 - cell.y;             // row 0 at top
  float seedv = cell.x * 7.0 + cell.y * 13.0;
  vec4 outc = vec4(0.0);
  float r = length(p);
  float edgeMask = smoothstep(1.0, 0.86, max(abs(p.x), abs(p.y)));
  if (cell.y < 8.0 && cell.x < 8.0) {
    // FIRE flipbook
    float t = (cell.y * 8.0 + cell.x) / 63.0;
    vec3 q = vec3(p * 1.6, t * 1.8);
    float n = fbm3(q * 1.9 + vec3(0.0, -t * 2.0, 0.0));
    float n2 = fbm3(q * 4.0 + 5.0);
    float radius = 0.42 + 0.36 * smoothstep(0.0, 0.5, t);
    float d = r + (n - 0.5) * 0.85 + (n2 - 0.5) * 0.25;
    float dens = smoothstep(radius, radius - 0.38, d);
    // heat fades from core outward and over time
    float core = smoothstep(radius + 0.1, 0.0, d);
    float heat = clamp(core * (1.25 - t * 1.15) * (0.75 + n2 * 0.5), 0.0, 1.0);
    vec3 emit = ramp(heat) * smoothstep(0.05, 0.3, heat);
    // smoke where cool
    float smokeAmt = dens * smoothstep(0.55, 0.05, heat);
    float shade = 0.045 + 0.08 * fbm3(q * 3.0 + 2.0) + 0.03 * (p.y);
    vec3 smokeCol = vec3(shade * 1.05, shade * 0.88, shade * 0.75);
    float alpha = clamp(smokeAmt * (0.9 + t * 0.1), 0.0, 1.0) * edgeMask;
    vec3 rgb = (emit * dens + smokeCol * alpha) * edgeMask;
    // fade out toward the end
    float endFade = 1.0 - smoothstep(0.75, 1.0, t);
    outc = vec4(rgb * endFade, alpha * endFade);
  } else if (cell.y < 8.0) {
    // SMOKE flipbook
    float t = (cell.y * 8.0 + cell.x - 8.0) / 63.0;
    vec3 q = vec3(p * 1.3, t * 0.9);
    float n = fbm3(q * 2.0 + vec3(0.0, -t, 3.0));
    float d = r + (n - 0.5) * 0.9;
    float dens = smoothstep(0.92, 0.25, d);
    // fake lighting from upper side
    float nl = fbm3((q + vec3(-0.08, 0.1, 0.0)) * 2.0 + vec3(0.0, -t, 3.0));
    float light = clamp(0.5 + (n - nl) * 6.0 + p.y * 0.35, 0.0, 1.0);
    float shade = mix(0.22, 0.75, light);
    float alpha = dens * edgeMask * (0.85 + 0.15 * n);
    outc = vec4(vec3(shade) * alpha, alpha);
  } else {
    int id = int(cell.x);
    if (cell.y == 8.0) {
      if (id == 0) { float a = (exp(-r*r*5.0) * 0.9 + exp(-r*r*40.0) * 0.5) * smoothstep(1.0, 0.55, r); outc = vec4(vec3(a), 0.0); }
      else if (id == 1) { // muzzle star
        float ang = atan(p.y, p.x);
        float rays = pow(abs(cos(ang * 3.0)), 18.0) * 0.8 + pow(abs(cos(ang * 3.0 + 0.5)), 30.0) * 0.4;
        float n = fbm3(vec3(p * 6.0, 1.0));
        float a = (exp(-r * r * 9.0) + rays * exp(-r * 2.6)) * (0.6 + n * 0.7);
        a *= smoothstep(1.0, 0.7, r);
        outc = vec4(vec3(1.0, 0.75, 0.4) * a + vec3(0.6) * exp(-r*r*30.0), 0.0);
      }
      else if (id == 2) { float a = smoothstep(0.62, 0.86, r) * smoothstep(1.0, 0.88, r); outc = vec4(vec3(a), 0.0); }
      else if (id == 3) { float n = fbm3(vec3(p*2.2, 4.0)); float a = smoothstep(0.95, 0.2, r + (n-0.5)*0.8); outc = vec4(vec3(0.62,0.52,0.40)*a, a); }
      else if (id == 4) { float a = exp(-r*r*14.0) * smoothstep(1.0, 0.5, r); outc = vec4(vec3(a), 0.0); }
      else if (id == 5) { float a = step(abs(p.x) + abs(p.y) * 0.6, 0.6) ; outc = vec4(vec3(0.08)*a, a); }
      else if (id == 6) { float a = exp(-r*r*3.0) + exp(-r*r*30.0); float ang = atan(p.y,p.x); a += pow(abs(cos(ang*4.0)),40.0)*exp(-r*1.5)*0.6; outc = vec4(vec3(a)*smoothstep(1.0,0.55,r), 0.0); }
      else if (id == 7) { float ang = atan(p.y, p.x); float rays = pow(abs(cos(ang * 2.0)), 60.0); float a = (exp(-r*r*16.0) + rays*exp(-r*3.0))*smoothstep(1.0,0.8,r); outc = vec4(vec3(1.0,0.85,0.6)*a, 0.0); }
      else if (id == 8) { float n = fbm3(vec3(p * vec2(1.0, 2.5) * 1.8, 7.0)); float a = smoothstep(0.9, 0.1, r + (n-0.5)*1.0) * 0.6; outc = vec4(vec3(0.6) * a, a); }
      else if (id == 9) { float n = fbm3(vec3(p*3.0, 11.0)); float a = smoothstep(0.9, 0.3, r + (n-0.5)*1.2); outc = vec4(vec3(0.36,0.30,0.24)*a, a); }
    }
  }
  gl_FragColor = outc;
}`;

export function buildAtlas(renderer) {
  const rt = new THREE.WebGLRenderTarget(2048, 2048, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }',
    fragmentShader: atlasFrag, depthTest: false, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const prevXR = renderer.xr.enabled;
  renderer.xr.enabled = false;
  const prevRT = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevRT);
  renderer.xr.enabled = prevXR;
  mat.dispose();
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt.texture;
}

// ---------------- Billboard renderer ----------------
const vsCommon = /* glsl */`
attribute vec3 iPos;
attribute vec2 iSize;
attribute float iRot;
attribute vec2 iFrame;   // frame index, next frame blend
attribute vec4 iColor;   // rgb mult, alpha
attribute vec3 iVel;
uniform float stretchMode;
varying vec2 vUv0; varying vec2 vUv1; varying float vBlend;
varying vec4 vColor; varying float vFogDepth; varying vec3 vFogViewPos; varying float vGroundY; varying float vSoft;
vec2 cellUv(float f, vec2 uv){ float cx = mod(f, 16.0); float cy = floor(f / 16.0); return vec2((cx + uv.x) / 16.0, 1.0 - (cy + 1.0 - uv.y) / 16.0); }
void main(){
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec3 offs;
  if (stretchMode > 0.5) {
    vec3 v = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
    float sp = length(v);
    vec3 axis = sp > 1e-4 ? v / sp : vec3(0.0, 1.0, 0.0);
    vec3 side = normalize(cross(axis, normalize(mv.xyz)));
    offs = axis * position.y * iSize.y + side * position.x * iSize.x;
  } else {
    float c = cos(iRot), s = sin(iRot);
    vec2 p = vec2(position.x * iSize.x, position.y * iSize.y);
    offs = vec3(c * p.x - s * p.y, s * p.x + c * p.y, 0.0);
  }
  mv.xyz += offs;
  vec2 uv = position.xy + 0.5;
  vUv0 = cellUv(floor(iFrame.x), uv);
  vUv1 = cellUv(floor(iFrame.x) + iFrame.y, uv);
  vBlend = fract(iFrame.x);
  vColor = iColor;
  // fade when very close to the eye (avoid giant sprites in face)
  vColor.a *= smoothstep(0.15, 1.2, -mv.z);
  // big sprites fade out as they reach the eye (readability + fill rate)
  float bigS = max(iSize.x, iSize.y);
  if (bigS > 1.5) vColor.a *= smoothstep(bigS * 0.35, bigS * 1.3, -mv.z);
  vFogDepth = -mv.z; vFogViewPos = mv.xyz;
  // world height of this vertex (soft intersection with the road plane y=0, no depth buffer needed)
  vGroundY = (inverse(viewMatrix) * vec4(mv.xyz, 1.0)).y;
  vSoft = max(0.05, min(iSize.x, iSize.y) * 0.22);
  gl_Position = projectionMatrix * mv;
  if (iColor.a <= 0.0 || iSize.x <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const fsCommon = /* glsl */`
uniform sampler2D atlas;
uniform vec3 fogColor; uniform vec3 fogColorSun; uniform vec3 fogSunDir; uniform float fogNear; uniform float fogFar;
uniform float emissiveBoost;
varying vec2 vUv0; varying vec2 vUv1; varying float vBlend;
varying vec4 vColor; varying float vFogDepth; varying vec3 vFogViewPos; varying float vGroundY; varying float vSoft;
void main(){
  vec4 a = texture2D(atlas, vUv0);
  vec4 b = texture2D(atlas, vUv1);
  vec4 t = mix(a, b, vBlend);
  // premultiplied: rgb = emission + lit smoke, a = coverage
  vec3 rgb = t.rgb * vColor.rgb * emissiveBoost;
  float al = t.a;
  float f = smoothstep(fogNear, fogFar, vFogDepth); f = 1.0 - (1.0 - f) * (1.0 - f);
  vec3 fdir = normalize(vFogViewPos);
  float fs = max(dot(fdir, fogSunDir), 0.0);
  vec3 fcol = mix(fogColor, fogColorSun, pow(fs, 3.0));
  rgb = mix(rgb, fcol * al, f);
  float soft = smoothstep(0.0, vSoft, vGroundY);
  gl_FragColor = vec4(rgb, al) * vColor.a * soft;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class BillboardBatch {
  constructor(max, atlas, { stretch = false, boost = 1, renderOrder = 10, fog } = {}) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aFrame = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iSize', this.aSize); g.setAttribute('iRot', this.aRot);
    g.setAttribute('iFrame', this.aFrame); g.setAttribute('iColor', this.aColor); g.setAttribute('iVel', this.aVel);
    g.instanceCount = max;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        atlas: { value: atlas }, stretchMode: { value: stretch ? 1 : 0 }, emissiveBoost: { value: boost },
        fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far },
        fogColorSun: { value: fogShared.sunColor }, fogSunDir: { value: fogShared.sunDirView },
      },
      vertexShader: vsCommon, fragmentShader: fsCommon,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.geometry = g;
  }
  set(i, x, y, z, w, h, rot, frame, next, r, gg, b, a, vx = 0, vy = 0, vz = 0) {
    const p = this.aPos.array, s = this.aSize.array, f = this.aFrame.array, c = this.aColor.array, v = this.aVel.array;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    s[i * 2] = w; s[i * 2 + 1] = h;
    this.aRot.array[i] = rot;
    f[i * 2] = frame; f[i * 2 + 1] = next;
    c[i * 4] = r; c[i * 4 + 1] = gg; c[i * 4 + 2] = b; c[i * 4 + 3] = a;
    v[i * 3] = vx; v[i * 3 + 1] = vy; v[i * 3 + 2] = vz;
  }
  hide(i) { this.aColor.array[i * 4 + 3] = 0; }
  commit(count = this.max) {
    for (const a of [this.aPos, this.aSize, this.aRot, this.aFrame, this.aColor, this.aVel]) {
      a.clearUpdateRanges(); a.addUpdateRange(0, count * a.itemSize); a.needsUpdate = true;
    }
    this.geometry.instanceCount = count;
  }
}

// ---------------- Simulated particles ----------------
// kind-agnostic particle with flipbook animation
export class ParticleSystem {
  constructor(max, atlas, opts) {
    this.batch = new BillboardBatch(max, atlas, opts);
    this.mesh = this.batch.mesh;
    this.max = max;
    this.p = [];
    for (let i = 0; i < max; i++) this.p.push({ alive: false });
    this.cursor = 0;
    this.free = []; for (let i = max - 1; i >= 0; i--) this.free.push(i);
    this.bigAlive = 0; this.bigBudget = opts.bigBudget ?? 140;
    this._dummy = {}; // returned when a big sprite is over budget (callers may write to it harmlessly)
    this.stretch = !!opts.stretch;
    this.high = 0;
  }
  spawn(o) {
    // O(1): pop a free slot; when the pool is full, recycle the oldest (ring cursor)
    // Big sprites (fill-rate heavy) have their own budget so a huge blast can't flood the screen.
    const big = (o.s1 ?? o.s0 ?? o.size ?? 1) > 5;
    if (big && this.bigAlive >= this.bigBudget) return this._dummy;
    let i;
    if (this.free.length) i = this.free.pop();
    else { i = this.cursor; this.cursor = (this.cursor + 1) % this.max; if (this.p[i].big) this.bigAlive--; }
    const q = this.p[i];
    q.big = big; if (big) this.bigAlive++;
    q.alive = true;
    q.x = o.x; q.y = o.y; q.z = o.z;
    q.vx = o.vx || 0; q.vy = o.vy || 0; q.vz = o.vz || 0;
    q.age = 0; q.life = o.life || 1;
    q.s0 = o.s0 ?? o.size ?? 1; q.s1 = o.s1 ?? q.s0;
    q.ease = o.ease ?? 1; // size curve exponent (<1 = fast grow)
    q.asp = o.aspect || 1;
    q.rot = o.rot || 0; q.vrot = o.vrot || 0;
    q.f0 = o.frame ?? 0; q.fn = o.frames || 0; q.fk = o.frameKind || 0; // 0 static, 1 fire, 2 smoke
    q.r = o.r ?? 1; q.g = o.g ?? 1; q.b = o.b ?? 1; q.a = o.a ?? 1;
    q.r1 = o.r1 ?? q.r; q.g1 = o.g1 ?? q.g; q.b1 = o.b1 ?? q.b;
    q.fin = o.fadeIn ?? 0.05; q.fout = o.fadeOut ?? 0.6;
    q.drag = o.drag || 0; q.grav = o.grav || 0;
    q.anchored = o.anchored !== false;
    q.len = o.len || 0; q.w = o.w || 0.05;
    q.ground = o.ground || false; // bounce on road
    q.timeScaleImmune = o.immune || false;
    if (i + 1 > this.high) this.high = i + 1;
    return q;
  }
  update(dt, dz) {
    const b = this.batch;
    for (let i = 0; i < this.high; i++) {
      const q = this.p[i];
      if (!q.alive) { b.hide(i); continue; }
      q.age += dt;
      if (q.age >= q.life) { q.alive = false; b.hide(i); this.free.push(i); if (q.big) { this.bigAlive--; q.big = false; } continue; }
      const t = q.age / q.life;
      const dragK = Math.exp(-q.drag * dt);
      q.vx *= dragK; q.vy = q.vy * dragK + q.grav * dt; q.vz *= dragK;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.anchored) q.z += dz;
      if (q.ground && q.y < 0.02) { q.y = 0.02; q.vy = -q.vy * 0.35; q.vx *= 0.6; q.vz = q.vz * 0.6 + (dt > 0 ? (q.anchored ? 0 : 0) : 0); }
      q.rot += q.vrot * dt;
      const st = Math.pow(t, q.ease);
      const size = q.s0 + (q.s1 - q.s0) * st;
      if (q.fk > 0 && q.y < size * 0.4) q.y = size * 0.4; // keep volumetric sprites from slicing into the road
      let a = q.a;
      if (t < q.fin) a *= t / q.fin;
      if (t > q.fout) a *= 1 - (t - q.fout) / (1 - q.fout);
      let frame = q.f0, next = 0;
      if (q.fk === 1) { const k = t * 63; const k0 = Math.floor(k); frame = fireFrame(k0) + (k - k0); next = (k0 % 8 === 7) ? 9 : 1; if (k0 >= 63) next = 0; }
      else if (q.fk === 2) { const k = q.f0 + t * q.fn; const k0 = Math.floor(k) % 64; frame = smokeFrame(k0) + (k - Math.floor(k)); next = (k0 % 8 === 7) ? 9 : 1; if (k0 >= 63) next = 0; }
      const cr = q.r + (q.r1 - q.r) * t, cg = q.g + (q.g1 - q.g) * t, cb = q.b + (q.b1 - q.b) * t;
      if (this.stretch) {
        const sp = Math.hypot(q.vx, q.vy, q.vz);
        const L = q.len > 0 ? q.len : Math.max(size, sp * 0.03);
        b.set(i, q.x, q.y, q.z, q.w * (size / (q.s0 || 1)), L, 0, frame, 0, cr, cg, cb, a, q.vx, q.vy, q.vz);
      } else {
        b.set(i, q.x, q.y, q.z, size, size * q.asp, q.rot, frame, next, cr, cg, cb, a);
      }
    }
    b.commit(this.high);
  }
}
