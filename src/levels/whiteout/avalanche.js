import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { SUN_DIR, fogShared } from '../../atmosphere.js';
import { terrainAt, GAZEX, CONVOY, CORNICE, GALLERY, BLOCK, TOWER } from './layout.js';

// the surface the front rides on: the terrain, or the station roofs (it goes OVER the gallery, not through it)
const _in = (x, z, R, m = 0) => x > R.x0 - m && x < R.x1 + m && z > R.z0 - m && z < R.z1 + m;
export function surfAt(x, z) {
  const t = terrainAt(x, z);
  if (_in(x, z, GALLERY, 1.5) || (x > GALLERY.x1 && x < GALLERY.x1 + 14 && z > GALLERY.z0 - 1.5 && z < GALLERY.z1 + 1.5)) return Math.max(t, GALLERY.roofY + 1.2);
  if (_in(x, z, TOWER, 1)) return Math.max(t, TOWER.roofY + 0.5);
  if (_in(x, z, BLOCK, 1)) return Math.max(t, BLOCK.roofY + 0.5);
  return t;
}
import { Bucket, M4, mats, rbox, snowCap } from './kit.js';

// =====================================================================================
//  THE AVALANCHE. Not haze: a structured front.
//   - BillowFront: a terrain-hugging band across the whole face. Its cross-section is a rolling nose
//     (toe → steep front → crest → back). The vertex shader throws out big cauliflower lumps from 3D
//     noise whose coordinates ROLL along the profile (over the crest and down the face: it tumbles
//     forward); the fragment shader adds fine billows with a surface-gradient bump, lights it with
//     the low gold sun (front lit, crevices blue), AO in the folds, and erodes the crest with noise.
//     The body is opaque (no overdraw); the plume layer behind it is the only blended part.
//   - Slab: the released slab breaking into blocks that slide, tumble and crumble into powder.
//   - Crown crack, Gazex cannons on the ridge, the snowcat convoy, the gallery curtain.
// =====================================================================================
const NX = 150, NV = 34;

const NOISE = /* glsl */`
float ah3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
float an3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ah3(i), ah3(i + vec3(1,0,0)), f.x), mix(ah3(i + vec3(0,1,0)), ah3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ah3(i + vec3(0,0,1)), ah3(i + vec3(1,0,1)), f.x), mix(ah3(i + vec3(0,1,1)), ah3(i + vec3(1,1,1)), f.x), f.y), f.z); }
// billows: rounded lobes (folded noise), a few octaves
float bill(vec3 p){ float s = 0.0, a = 0.55; for (int i = 0; i < 4; i++) { s += a * (1.0 - abs(an3(p) * 2.0 - 1.0)); p = p * 2.07 + vec3(3.1, 7.7, 1.3); a *= 0.5; } return s; }
`;

function frontMaterial({ plume = false } = {}) {
  const u = {
    uTime: { value: 0 }, uRoll: { value: 0 }, uH: { value: 20 }, uSun: { value: new THREE.Vector3() }, uLight: { value: 1 }, uAlpha: { value: 1 },
    uSunCol: { value: new THREE.Color(1.6, 1.15, 0.8) }, uSky: { value: new THREE.Color(0.56, 0.67, 0.9) },
    fogColor: { value: new THREE.Color() }, fogNear: { value: 10 }, fogFar: { value: 1000 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: NOISE + /* glsl */`
      attribute vec3 aN; attribute vec2 aUV;   // base normal of the profile; (x along the front, arc length along the profile)
      uniform float uRoll; uniform float uH; uniform float uTime;
      varying vec3 vW; varying vec3 vN; varying vec2 vQ; varying float vV; varying float vFogDepth; varying float vLump;
      float D(vec2 uv){
        vec3 q = vec3(uv.x / 34.0, (uv.y - uRoll) / 26.0, uTime * 0.05);
        float lump = bill(q);
        float big = an3(vec3(uv.x / 70.0, uTime * 0.03, 0.5));
        return (lump - 0.55) * uH * ${plume ? '0.5' : '0.4'} + (big - 0.5) * uH * 0.26;
      }
      void main(){
        // noise coords: across the front, and ROLLING along the profile (over the crest, down the face)
        vec3 q = vec3(aUV.x / 34.0, (aUV.y - uRoll) / 26.0, uTime * 0.05);
        float lump = bill(q);
        float d = D(aUV);
        // the toe hugs the ground: no lumps under the snow line
        float toe = smoothstep(0.0, 0.08, aUV.y / max(uH * 3.0, 1.0));
        vec3 p = position + aN * d * toe;
        // smooth normal of the displaced surface (finite differences across the front and along the profile)
        float e = 1.6;
        float dX = (D(aUV + vec2(e, 0.0)) - d) / e * toe, dS = (D(aUV + vec2(0.0, e)) - d) / e * toe;
        vec3 T = vec3(0.0, aN.z, -aN.y);
        vLump = lump;
        vQ = vec2(aUV.x / 26.0, (aUV.y - uRoll) / 22.0);
        vV = aUV.y / max(uH * 3.0, 1.0);
        vN = normalize(aN - dX * vec3(1.0, 0.0, 0.0) - dS * T);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vW = p; vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime; uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uSky; uniform float uLight; uniform float uAlpha; uniform float uH;
      uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec3 vW; varying vec3 vN; varying vec2 vQ; varying float vV; varying float vFogDepth; varying float vLump;
      void main(){
        // fine billows on top of the vertex lumps (bump from screen-space derivatives of the noise)
        vec3 q = vec3(vQ * 2.2, uTime * 0.11);
        float h = bill(q) * 0.7 + bill(q * 2.4 + 5.0) * 0.3;
        vec3 N = normalize(vN);
        vec3 dpx = dFdx(vW), dpy = dFdy(vW);
        float dhx = dFdx(h), dhy = dFdy(h);
        vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
        float det = dot(dpx, r1);
        vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
        N = normalize(abs(det) * N - grad * ${plume ? '0.8' : '1.1'});
        // crest erosion: the top and the back tear into wisps
        float er = smoothstep(${plume ? '0.25' : '0.62'}, 1.0, vV) * 0.9;
        float edge = h + vLump * 0.3 - er;
        ${plume ? 'float a = smoothstep(0.25, 0.75, edge) * uAlpha * (1.0 - smoothstep(0.85, 1.0, vV));' : 'if (edge < 0.32) discard; float a = 1.0;'}
        // light: gold from the low sun on the front, blue sky from above, the folds in shadow
        vec3 L = normalize(uSun);
        float dif = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
        float sky = 0.6 + 0.4 * N.y;
        float ao = mix(0.55, 1.0, smoothstep(0.25, 0.9, h)) * mix(0.6, 1.0, smoothstep(0.2, 0.8, vLump));
        vec3 base = vec3(0.86, 0.9, 0.96);
        vec3 c = base * (uSky * sky * 0.72 + uSunCol * dif * dif * 0.55 * uLight) * ao;
        // sun shining through the thin crest
        c += uSunCol * pow(max(dot(normalize(cameraPosition - vW), -L), 0.0), 3.0) * er * 0.6 * uLight;
        float f = smoothstep(fogNear, fogFar, vFogDepth); f = 1.0 - (1.0 - f) * (1.0 - f);
        c = mix(c, fogColor, f);
        gl_FragColor = vec4(c ${plume ? '* a, a' : ', 1.0'});
        #include <tonemapping_fragment>
        ${plume ? '#include <bay_premul_colorspace>' : '#include <colorspace_fragment>'}
      }`,
    transparent: plume, depthWrite: !plume, side: THREE.DoubleSide, fog: false,
    ...(plume ? { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor } : {}),
    extensions: { derivatives: true },
  });
  return { m, u };
}

// ---- one band: NX columns across x, NV rows along the profile
class Band {
  constructor(scene, { x0, x1, plume = false }) {
    this.x0 = x0; this.x1 = x1; this.plume = plume;
    const n = NX * NV;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.nrm = new Float32Array(n * 3); this.uv = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aN', new THREE.BufferAttribute(this.nrm, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aUV', new THREE.BufferAttribute(this.uv, 2).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < NX - 1; i++) for (let j = 0; j < NV - 1; j++) { const a = i * NV + j, b = a + NV; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const { m, u } = frontMaterial({ plume });
    this.u = u;
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = plume ? 21 : 2; this.mesh.visible = false;
    scene.add(this.mesh);
    this.g = g;
  }
  // zf(x): front position per column (z, increasing = downhill/south), H: height, lag: extra offset back
  update(zfAt, H, lag = 0) {
    const P = this.pos, N = this.nrm, U = this.uv;
    // the profile (f forward of the front, y up): toe → nose → crest → back
    for (let i = 0; i < NX; i++) {
      const x = this.x0 + (this.x1 - this.x0) * i / (NX - 1);
      const zf = zfAt(x) - lag;
      const hh = H * (0.62 + 0.25 * Math.sin(x * 0.021 + 1.3) + 0.18 * Math.sin(x * 0.053 + 4.1)) * (this.plume ? 2.5 : 1);
      let arc = 0, px = 0, py = 0;
      for (let j = 0; j < NV; j++) {
        const t = j / (NV - 1);
        // quarter-ellipse nose then a long back
        let f, y;
        if (t < 0.55) { const a = t / 0.55 * Math.PI * 0.5; f = Math.cos(a) * hh * 0.45 + 2; y = Math.sin(a) * hh; }
        else { const b = (t - 0.55) / 0.45; f = 2 - b * hh * 2.6; y = hh * (1 - b * 0.35); }
        const z = zf + f;
        const gy = surfAt(x, z);
        const o = (i * NV + j) * 3;
        P[o] = x; P[o + 1] = gy + y; P[o + 2] = z;
        if (j > 0) arc += Math.hypot(f - px, y - py);
        px = f; py = y;
        U[(i * NV + j) * 2] = x; U[(i * NV + j) * 2 + 1] = arc;
        // outward normal of the profile (in the y-z plane), pointing forward / up
        const t2 = Math.min(1, t + 0.02), t1 = Math.max(0, t - 0.02);
        const fz = (tt) => (tt < 0.55 ? Math.cos(tt / 0.55 * Math.PI * 0.5) * hh * 0.45 + 2 : 2 - (tt - 0.55) / 0.45 * hh * 2.6);
        const fy = (tt) => (tt < 0.55 ? Math.sin(tt / 0.55 * Math.PI * 0.5) * hh : hh * (1 - (tt - 0.55) / 0.45 * 0.35));
        let dz = fz(t2) - fz(t1), dy = fy(t2) - fy(t1);
        const L = Math.hypot(dz, dy) || 1; dz /= L; dy /= L;
        N[o] = 0; N[o + 1] = -dz; N[o + 2] = dy;       // rotate the tangent by -90°: points out of the nose
        if (N[o + 1] < 0 && t < 0.55) { N[o + 1] *= 0.3; }
      }
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.aN.needsUpdate = true; this.g.attributes.aUV.needsUpdate = true;
  }
}

export class Avalanche {
  constructor(game) {
    this.g = game;
    const scene = game.scene;
    this.front = new Band(scene, { x0: -90, x1: 300 });
    this.plume = new Band(scene, { x0: -90, x1: 300, plume: true });
    this.on = false; this.t = 0; this.zf = CORNICE.z + 10; this.v = 0; this.H = 8; this.roll = 0;
    this.lobes = new Float32Array(16);
    const rng = makeRng(4242); for (let i = 0; i < 16; i++) this.lobes[i] = rng();
    this.blocks = new SlabBlocks(game);
    // cap: once you're in the gallery the front stops on its roof (the toe at the roof's edge); the snow that goes on
    // over is the curtain
    this.cap = null;
    this.zfRaw = (x) => this.zf + this._lobe(x);
    this.zfAt = (x) => { const z = this.zf + this._lobe(x); return this.cap == null ? z : Math.min(z, this.cap - this.H * 0.48 - 2); };
  }
  _lobe(x) { const k = (x + 90) / 390 * 15, i = Math.floor(Math.max(0, Math.min(14, k))), f = k - i; const a = this.lobes[i], b = this.lobes[i + 1]; const s = a + (b - a) * (f * f * (3 - 2 * f)); return (s - 0.5) * 60 + Math.sin(x * 0.017 + this.t * 0.2) * 14 - Math.max(0, x - 250) * 0.6 - Math.max(0, -40 - x) * 0.6; }
  start() { this.on = true; this.t = 0; this.zf = CORNICE.z + 6; this.v = 2; this.H = 6; this.front.mesh.visible = true; this.plume.mesh.visible = false; }   // the translucent band read as glacier ice: the powder is sprites now
  update(dt, { zLimit = 1e9, speed = 38 } = {}) {
    if (!this.on) { this.blocks.update(dt); return; }
    const g = this.g;
    this.t += dt;
    // accelerates down the face; grows as it entrains snow
    this.v = Math.min(speed, this.v + dt * 7.5);
    this.zf = Math.min(zLimit, this.zf + this.v * dt);
    this.H = Math.min(58, this.H + dt * (this.v * 0.55));
    this.roll += dt * (this.v * 0.9 + 6);
    const fog = g.scene.fog;
    for (const B of [this.front, this.plume]) {
      B.u.uTime.value = this.t; B.u.uRoll.value = this.roll * (B.plume ? 0.6 : 1); B.u.uH.value = this.H * (B.plume ? 2.5 : 1);
      B.u.uSun.value.copy(SUN_DIR); B.u.uLight.value = Math.max(0.25, 1 - g.storm * 0.8);
      B.u.uSunCol.value.setRGB(1.18, 1.12, 1.04);   // a white front with only a breath of gold (the grade warms it)
      B.u.fogColor.value.copy(fog.color); B.u.fogNear.value = fog.near; B.u.fogFar.value = fog.far;
    }
    this.plume.u.uAlpha.value = Math.min(0.85, this.t * 0.25);
    this.front.update(this.zfAt, this.H, 0);
    this.plume.update(this.zfAt, this.H, this.H * 1.2 + 10);
    this.blocks.update(dt, this);
  }
  // world point on the crest at x (for puffs / debris)
  crest(x, out) { const z = this.zfAt(x); return out.set(x, surfAt(x, z) + this.H * 0.9, z); }
  toe(x, out) { const z = this.zfAt(x) + 2; return out.set(x, surfAt(x, z) + 0.5, z); }
  warmMaterials() { return [this.front.mesh.material, this.plume.mesh.material, this.blocks.mesh.material]; }
}

// ---- the slab: blocks that break off below the crown line, slide and tumble, crumble into powder
class SlabBlocks {
  constructor(game) {
    this.g = game;
    const g = new THREE.BoxGeometry(1, 1, 1, 2, 1, 2);
    // a white top, a blue-grey fracture face: vertex colours by normal
    const P = g.attributes.position, Nn = g.attributes.normal, c = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const up = Nn.getY(i) > 0.5; const k = up ? 0.95 : 0.62; c[i * 3] = k * (up ? 0.97 : 0.85); c[i * 3 + 1] = k * (up ? 0.98 : 0.9); c[i * 3 + 2] = k; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: true });
    this.max = 90;
    this.mesh = new THREE.InstancedMesh(g, m, this.max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    game.scene.add(this.mesh);
    this.list = [];
  }
  release(rng) {
    this.list.length = 0;
    for (let i = 0; i < this.max; i++) {
      const x = CORNICE.x0 + rng() * (CORNICE.x1 - CORNICE.x0), z = CORNICE.z + 4 + rng() * 60;
      const s = 6 + rng() * 14;
      this.list.push({ p: new THREE.Vector3(x, terrainAt(x, z) + 1, z), v: new THREE.Vector3((rng() - 0.5) * 2, 0, 2 + rng() * 4), q: new THREE.Quaternion(), w: new THREE.Vector3((rng() - 0.5) * 0.8, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.8), s: new THREE.Vector3(s, 1.4 + rng() * 2, s * (0.5 + rng() * 0.5)), life: 5 + rng() * 5, delay: rng() * 1.2 });
    }
  }
  update(dt, A = null) {
    const L = this.list; if (!L.length) return;
    const g = this.g, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
    let n = 0;
    for (const b of L) {
      if (b.delay > 0) { b.delay -= dt; } else {
        b.life -= dt;
        // slide down the fall line (gravity along the slope, little friction), tumble when it speeds up
        const e = 2, gz = (terrainAt(b.p.x, b.p.z + e) - terrainAt(b.p.x, b.p.z - e)) / (2 * e);
        b.v.z += Math.max(0, -gz) * 9.0 * dt; b.v.multiplyScalar(Math.exp(-dt * 0.15));
        b.p.addScaledVector(b.v, dt);
        b.p.y = terrainAt(b.p.x, b.p.z) + b.s.y * 0.4;
        const sp = b.v.length();
        _q.setFromAxisAngle(_s.copy(b.w).normalize(), b.w.length() * dt * Math.min(1, sp / 10)); b.q.premultiply(_q);
        // crumbling: powder off the block (white puffs), shrinking
        if (g.clouds && (b.life * 7 % 1) < dt * 7 * 0.35) g.clouds.spawn({ x: b.p.x, y: b.p.y + 2, z: b.p.z, vx: b.v.x * 0.3, vy: 2, vz: b.v.z * 0.4, drag: 0.6, buoy: 0, s0: b.s.x * 0.4, s1: b.s.x * 1.2, life: 2.5, a: 0.7, fadeIn: 0.1, fadeOut: 0.5, r: 0.85, g: 0.88, b: 0.94, r1: 0.8, g1: 0.84, b1: 0.9, glow: 0, glowFade: 1, spray: true });
      }
      const k = Math.max(0, Math.min(1, b.life / 2.5));
      if (k <= 0 || (A && b.p.z < A.zfAt(b.p.x) - 30)) continue;   // swallowed by the front
      _m.compose(b.p, b.q, _s.copy(b.s).multiplyScalar(0.4 + 0.6 * k));
      this.mesh.setMatrixAt(n++, _m);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---- Gazex avalanche cannons on the ridge (big red tubes on legs + a gas shelter, amber beacons), the
// convoy snowcats coming down the face with their headlights, the crown-crack strip
export function buildRidge() {
  const root = new THREE.Group();
  const P = new Bucket(), Mt = new Bucket(), Lp = new Bucket(), S = new Bucket();
  const targets = [], glows = [], cats = [];
  for (const [x, z] of GAZEX) {
    const y = terrainAt(x, z);
    // the tube points down the fall line (south), on an A-frame over a concrete footing: gunmetal, a red band,
    // big enough to read from the terrace 300 m away (and dark against the snow)
    P.add(rbox(10, 3, 9, 0.2), M4(x, y + 0.5, z - 1), [0.3, 0.3, 0.31]);
    P.add(new THREE.CylinderGeometry(3.6, 4.0, 22, 18).rotateX(Math.PI / 2 - 0.5), M4(x, y + 10, z + 3.6), (q, n, l) => (Math.abs(l.y + 2) < 1.6 ? [0.7, 0.1, 0.04] : [0.17, 0.18, 0.2]));
    P.add(new THREE.CylinderGeometry(4.2, 4.2, 1.8, 18).rotateX(Math.PI / 2 - 0.5), M4(x, y + 5.6, z + 12.6), [0.09, 0.09, 0.1]);
    for (const s of [-1, 1]) Mt.add(new THREE.BoxGeometry(1.0, 16, 1.0), M4(x + s * 5, y + 7, z, 0.15, 0, s * 0.2), [0.3, 0.3, 0.32]);
    // the gas shelter beside it (two tanks)
    P.add(rbox(8, 4, 5, 0.1), M4(x + 13, y + 2, z - 2), [0.62, 0.6, 0.56]);
    S.add(snowCap(8, 5, 0.6, x, 4, 3), M4(x + 13, y + 4.3, z - 2), [0.95, 0.97, 1]);
    S.add(snowCap(7.6, 20, 0.7, z, 3, 6), M4(x, y + 14.2, z + 1.5, -0.5), [0.95, 0.97, 1]);
    glows.push({ p: [x, y + 20, z], color: [3.6, 1.6, 0.15], size: 15, blink: true, rate: 3.5, far: true });
    glows.push({ p: [x, y + 20, z], color: [2.2, 1.0, 0.1], size: 34, blink: true, rate: 3.5, far: true });   // the halo
    targets.push({ p: new THREE.Vector3(x, y + 10, z + 3.6), r: 13, hp: 4, alive: true, x, z, y });
  }
  for (const [x, z] of CONVOY) {
    const cat = new THREE.Group();
    const b = new Bucket();
    for (const s of [-1, 1]) b.add(rbox(1.0, 1.0, 5.2, 0.3), M4(s * 1.8, 0.5, 0), [0.06, 0.06, 0.06]);
    b.add(rbox(2.8, 1.0, 4.8, 0.08), M4(0, 1.4, 0.2), [0.18, 0.2, 0.16]);
    b.add(rbox(2.4, 1.4, 2.2, 0.07), M4(0, 2.5, -0.6), [0.18, 0.2, 0.16]);
    b.add(rbox(4.4, 1.2, 0.2, 0.04), M4(0, 0.8, -3.2), [0.5, 0.4, 0.05]);
    cat.add(b.mesh(mats.paint()));
    cat.position.set(x, terrainAt(x, z), z);
    root.add(cat);
    const hl = [{ p: new THREE.Vector3(), color: [3.0, 2.7, 2.1], size: 2.6, far: true }, { p: new THREE.Vector3(), color: [3.0, 2.7, 2.1], size: 2.6, far: true }];
    glows.push(...hl);
    cats.push({ obj: cat, x, z, v: 1.6 + (x % 7) * 0.1, hl, alive: true, tumble: 0 });
  }
  root.add(P.mesh(mats.paint()), Mt.mesh(mats.metal()), S.mesh(mats.snow(), { shadow: false }));
  // the crown crack: a strip along the cornice; it opens (scales in y) when the slab lets go
  const crackG = new THREE.BufferGeometry(); const cp = [], ci = [];
  const n = 80;
  for (let i = 0; i <= n; i++) { const x = CORNICE.x0 - 20 + (CORNICE.x1 - CORNICE.x0 + 40) * i / n; const z = CORNICE.z + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.17) * 2; const y = terrainAt(x, z); cp.push(x, y + 0.2, z, x, y - 7, z); if (i < n) { const a = i * 2; ci.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  crackG.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); crackG.setIndex(ci); crackG.computeVertexNormals();
  const crack = new THREE.Mesh(crackG, new THREE.MeshStandardMaterial({ color: 0x40506a, roughness: 0.4, side: THREE.DoubleSide }));
  crack.visible = false; root.add(crack);
  return { root, targets, glows, cats, crack };
}

// ---- the curtain of snow pouring off the gallery roof past the pillars (scrolling streaks, one draw)
export function buildCurtain() {
  const { x0, x1, z1, roofY, y } = GALLERY;
  const u = { uTime: { value: 0 }, uK: { value: 0 }, fogColor: { value: new THREE.Color() } };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: NOISE + /* glsl */`uniform float uTime; uniform float uK; uniform vec3 fogColor; varying vec2 vU; varying vec3 vW;
      void main(){
        // a waterfall of snow: streaks that run fast down the plane, thick and thin, with gaps
        float y = vW.y;
        float s1 = an3(vec3(vW.x * 1.7, (y + uTime * 16.0) / 7.0, 1.0));
        float s2 = an3(vec3(vW.x * 6.3, (y + uTime * 23.0) / 2.5, 5.0));
        float s3 = an3(vec3(vW.x * 0.35, (y + uTime * 9.0) / 18.0, 9.0));
        float dens = smoothstep(0.42, 0.9, s1 * 0.5 + s2 * 0.25 + s3 * 0.45);
        // bays pour unevenly: some thick, some a thin veil
        float bay = smoothstep(0.25, 0.75, an3(vec3(vW.x * 0.09, uTime * 0.25, 3.0)));
        float top = smoothstep(1.0, 0.9, vU.y), bot = smoothstep(0.0, 0.3, vU.y);
        float a = uK * (0.04 + 0.7 * dens * mix(0.45, 1.0, bay)) * top * mix(0.5, 1.0, bot);
        vec3 c = mix(vec3(0.5, 0.58, 0.72), vec3(0.86, 0.9, 0.98), dens);
        gl_FragColor = vec4(c * a, a);
        #include <tonemapping_fragment>
        #include <bay_premul_colorspace>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, fog: false,
  });
  const g = new THREE.PlaneGeometry(x1 - x0, roofY - y + 14, 1, 1);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set((x0 + x1) / 2, (roofY + y - 14) / 2, z1 + 1.6);
  mesh.renderOrder = 23; mesh.visible = false; mesh.frustumCulled = false;
  return { mesh, u };
}
