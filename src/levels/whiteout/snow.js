import * as THREE from 'three';
import { makeRng, rand, range } from '../../rng.js';
import { CELL } from '../../particles.js';

// =====================================================================================
//  The storm. One Weather object owns the wind (direction + gusts), the whiteout surges, and:
//   - GPU snowfall: flakes in a box that wraps around the head, driven sideways by the wind,
//     tumbling, stretched into streaks when it blows hard (one draw, no CPU per flake). VR-safe:
//     nothing within ~0.7 m of the eye, faded in by 1.6 m (Level 5's rain rule, closer: flakes are soft);
//   - spindrift: fine snow skating along the ground in sheets (shared particle batch, budgeted);
//   - ridge plumes: snow streaming off the crests in the gusts (dust-cloud puffs, white).
//  storm 1 = full blizzard, 0 = clear (the summit break).
// =====================================================================================
const BOX = new THREE.Vector3(34, 20, 34);

export class Weather {
  constructor(game, { quest = false } = {}) {
    this.g = game;
    const scene = game.scene;
    this.storm = 1; this.gust = 0; this.surge = 0; this.t = 0;
    this.windDir = new THREE.Vector3(0.84, 0, 0.54).normalize();   // from the north-west, across the road
    this.wind = new THREE.Vector3();
    this.speed = 9;
    this.quest = quest;
    const N = quest ? 1800 : 4200;
    const rng = makeRng(707);
    const base = new THREE.InstancedBufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    base.setIndex([0, 1, 2, 0, 2, 3]);
    const off = new Float32Array(N * 4), ph = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { off[i * 4] = rng() * BOX.x; off[i * 4 + 1] = rng() * BOX.y; off[i * 4 + 2] = rng() * BOX.z; off[i * 4 + 3] = rng(); ph[i * 2] = rng() * 6.283; ph[i * 2 + 1] = rng(); }
    base.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    base.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 2));
    base.instanceCount = N;
    const fog = scene.fog;
    this.u = {
      uTime: { value: 0 }, uEye: { value: new THREE.Vector3() }, uBox: { value: BOX }, uDrift: { value: new THREE.Vector3() },
      uVel: { value: new THREE.Vector3() }, uK: { value: 1 }, uLight: { value: new THREE.Color(0.95, 0.97, 1.0) },
      fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far }, uWarm: { value: new THREE.Vector4(0, 0, 0, 0) },
      uRoof: { value: Array.from({ length: 10 }, () => new THREE.Vector4(1e6, 1e6, -1e6, -1e6)) }, uRoofY: { value: new Array(10).fill(-1e6) },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: /* glsl */`
        attribute vec4 aOff; attribute vec2 aPh;
        uniform float uTime; uniform vec3 uEye; uniform vec3 uBox; uniform vec3 uDrift; uniform vec3 uVel;
        uniform vec4 uRoof[10]; uniform float uRoofY[10];
        varying vec2 vQ; varying float vA; varying float vD; varying vec3 vW;
        void main() {
          float sp = 0.7 + 0.6 * aOff.w;                       // light flakes ride the wind faster
          vec3 p = aOff.xyz + uDrift * sp + vec3(0.0, -uTime * (0.9 + 0.8 * aPh.y), 0.0);
          // tumbling: each flake loops on its own little vortex
          p += vec3(sin(uTime * (1.3 + aPh.y) + aPh.x), sin(uTime * (2.1 + aPh.y * 0.7) + aPh.x * 1.7) * 0.6, cos(uTime * (1.1 + aPh.y) + aPh.x)) * (0.18 + 0.25 * aPh.y);
          p = mod(p - uEye + uBox * 0.5, uBox) - uBox * 0.5 + uEye;
          vec3 vel = uVel * sp + vec3(0.0, -1.2, 0.0);
          vec4 mv = viewMatrix * vec4(p, 1.0);
          vD = -mv.z;
          // streak along the screen-space velocity (a 1/45 s shutter); round when it's calm
          vec3 vv = mat3(viewMatrix) * vel;
          vec2 dir = vv.xy; float L = length(dir);
          dir = L > 1e-3 ? dir / L : vec2(0.0, 1.0);
          float rr = fract(aPh.x * 7.13), d0 = length(p - uEye);
          // three layers by distance: big soft flakes close, mid streaks, fine far noise; streak length varies per flake
          float size = (0.006 + 0.013 * aPh.y * aPh.y) * mix(1.7, 1.0, smoothstep(2.0, 6.0, d0));
          float stretch = 1.0 + L * 0.04 / size * 0.5 * (0.4 + 1.1 * rr) * mix(0.45, 1.0, smoothstep(2.0, 6.0, d0));
          vec2 side = vec2(dir.y, -dir.x);   // (side, dir) right-handed: the quad stays front-facing
          mv.xy += side * position.x * size + dir * position.y * size * stretch;
          vQ = position.xy;
          float d = length(p - uEye);
          vA = smoothstep(1.0, 2.6, d) * (1.0 - smoothstep(12.0, 17.0, d)) * (0.55 + 0.45 / sqrt(stretch)) * (0.5 + 0.5 * fract(aPh.x * 3.71)) * mix(0.6, 1.0, smoothstep(2.6, 5.0, d));
          // no snow under a roof
          for (int i = 0; i < 10; i++) if (p.x > uRoof[i].x && p.x < uRoof[i].z && p.z > uRoof[i].y && p.z < uRoof[i].w && p.y < uRoofY[i]) vA = 0.0;
          vW = p;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uK; uniform vec3 uLight; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform vec4 uWarm;
        varying vec2 vQ; varying float vA; varying float vD; varying vec3 vW;
        void main() {
          float r = dot(vQ, vQ);
          float a = (1.0 - smoothstep(0.0, 1.0, r)) * vA * uK * 0.8;
          if (a < 0.01) discard;
          // flakes catch warm light near fires / floodlights (uWarm = position, radius)
          vec3 c = uLight;
          if (uWarm.w > 0.0) c += vec3(1.6, 0.8, 0.35) * smoothstep(uWarm.w, 0.0, distance(vW, uWarm.xyz));
          float f = smoothstep(fogNear, fogFar, vD);
          c = mix(c, fogColor * 1.08, f * 0.6);
          gl_FragColor = vec4(c * a, a * 0.92);
          #include <tonemapping_fragment>
          #include <bay_premul_colorspace>
        }`,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, fog: false,
    });
    this.mesh = new THREE.Mesh(base, this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 30;
    scene.add(this.mesh);
    this.drift = new THREE.Vector3();
    this.plumes = [];      // [x, y, z, size] ridge crests that smoke in the gusts
    this.driftT = 0; this.plumeT = 0;
  }
  // roofs: [x0, z0, x1, z1, yTop] (max 10)
  setRoofs(list) { list.slice(0, 10).forEach((r, i) => { this.u.uRoof.value[i].set(r[0], r[1], r[2], r[3]); this.u.uRoofY.value[i] = r[4]; }); }
  // warm light the flakes should catch (the nearest fire / floodlight): pass null to clear
  warm(P, r = 9) { if (!P) { this.u.uWarm.value.w = 0; return; } this.u.uWarm.value.set(P.x, P.y, P.z, r); }

  update(dt, eye) {
    this.t += dt;
    const g = this.g, t = this.t, S = this.storm;
    // gusts: two incommensurate swells + an occasional hard surge (the whiteout)
    const sw = Math.sin(t * 0.31) * 0.5 + Math.sin(t * 0.83 + 1.3) * 0.3 + Math.sin(t * 2.1 + 0.4) * 0.12;
    this.gust = Math.max(0, sw);
    const surge = Math.max(0, Math.sin(t * 0.115 + 2.2)) ** 6;
    this.surge = surge * S;
    const spd = (this.speed + this.gust * 9 + surge * 8) * (0.15 + 0.85 * S);
    // the wind veers a little in the gusts
    const ang = Math.sin(t * 0.07) * 0.25 + this.gust * 0.15;
    const c = Math.cos(ang), s = Math.sin(ang);
    this.wind.set(this.windDir.x * c - this.windDir.z * s, 0, this.windDir.x * s + this.windDir.z * c).multiplyScalar(spd);
    this.drift.addScaledVector(this.wind, dt);
    this.u.uTime.value = t; this.u.uEye.value.copy(eye); this.u.uDrift.value.copy(this.drift); this.u.uVel.value.copy(this.wind);
    this.u.uK.value = Math.min(1, 0.08 + S * 1.0);
    this.mesh.visible = this.u.uK.value > 0.02;
    // spindrift: fine snow skating along the ground downwind of you (sheets, not pearls)
    this.driftT -= dt;
    if (this.driftT <= 0 && S > 0.15) {
      this.driftT = this.quest ? 0.07 : 0.035;
      const w = this.wind, ws = w.length();
      if (ws > 4) {
        const a = rand() * Math.PI * 2, r = 3 + rand() * 14;
        const x = eye.x + Math.cos(a) * r - w.x / ws * 6, z = eye.z + Math.sin(a) * r - w.z / ws * 6;
        const y = g.world.fastGround(x, z);
        if (Math.abs(y - (eye.y - 1.6)) < 6) {
          const k = (0.5 + 0.5 * this.gust) * S;
          g.fx.main.spawn({ x, y: y + range(0.05, 0.35), z, vx: w.x * range(0.7, 1.1), vy: range(0.1, 0.6), vz: w.z * range(0.7, 1.1), drag: 0.4, frame: CELL.WISP, s0: range(0.6, 1.2), s1: range(2.5, 4.5), life: range(0.9, 1.6), rot: Math.atan2(w.z, w.x), vrot: 0, r: 0.95 * k, g: 0.97 * k, b: 1.0 * k, a: 0.26 * k, fadeIn: 0.25, fadeOut: 0.5 });
        }
      }
    }
    // plumes off the ridges
    this.plumeT -= dt;
    if (this.plumeT <= 0 && this.plumes.length && g.clouds) {
      this.plumeT = 0.5;
      const ws = this.wind.length();
      if (this.gust > 0.25 && S > 0.2) for (let i = 0; i < 2; i++) {
        const P = this.plumes[(rand() * this.plumes.length) | 0];
        if (Math.hypot(P[0] - eye.x, P[2] - eye.z) > 260) continue;
        const s0 = P[3] * range(0.6, 1);
        g.clouds.spawn({ x: P[0] + range(-6, 6), y: P[1] + range(0, 3), z: P[2] + range(-6, 6), vx: this.wind.x * 0.9, vy: range(0.5, 2), vz: this.wind.z * 0.9, drag: 0.1, buoy: 0, s0, s1: s0 * 3.5, st: 2.8, life: range(3, 5), a: 0.18 * S, fadeIn: 0.15, fadeOut: 0.55, vrot: 0, r: 0.82, g: 0.85, b: 0.9, r1: 0.8, g1: 0.83, b1: 0.88, glow: 0, glowFade: 1, spray: true });
      }
    }
    return ws_ret(this);
  }
}
const ws_ret = (W) => W.wind.length();
