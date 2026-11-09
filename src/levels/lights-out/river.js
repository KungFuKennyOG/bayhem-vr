import * as THREE from 'three';
import { makeNoise, fbm as tfbm, heightToNormal } from '../../textures.js';
import { fogShared } from '../../atmosphere.js';
import { makeRng } from '../../rng.js';
import { Reflections } from '../iron-lady/reflections.js';
import { Buckets, em, mul3, GOLD, DIST, DUSK, POWER, powK, HFOG, HFOG_GLSL } from './kit.js';
import { materials } from './mats.js';
import { SKY } from './sky.js';
import { RIVER, WATER_Y, FARBANK, QUAY, groundAt } from './layout.js';
import { LMR } from './lightmap.js';

// =====================================================================================
//  The Yan river: wide, slow and muddy, dark at night, every light on both banks laying a gold
//  column across it (Level 5's analytic reflections, one draw). Mist sheets lie on the water and
//  in the gorge (two big noise-eroded layers, drifting). Lit river cruisers and dark barges move
//  along it. The reflections dim with the power: their gain follows the city's glow.
// =====================================================================================
function rippleNormal(seed) {
  const S = 256, h = new Float32Array(S * S), n = makeNoise(seed, 8), n2 = makeNoise(seed + 1, 32), n3 = makeNoise(seed + 2, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const a = tfbm(n, u, v, 8, 4), b = tfbm(n2, u, v, 32, 3), c = tfbm(n3, u, v, 16, 2);
    h[y * S + x] = Math.pow(a, 1.6) * 0.55 + b * 0.3 + Math.abs(c - 0.5) * 0.25;
  }
  const t = heightToNormal(h, S, S, 18);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export const RIVER_U = { uTime: { value: 0 } };

function waterMaterial(fog) {
  const uniforms = {
    uTime: RIVER_U.uTime, uNormal: { value: rippleNormal(777) },
    uNight: SKY.night, uGlow: SKY.glow, uFire: SKY.fire,
    fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far },
    uHF: HFOG.p, uHFC: HFOG.c,
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vFogViewPos;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vFogViewPos = mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uNight, uGlow, uFire;
      uniform sampler2D uNormal;
      uniform vec3 fogColor; uniform float fogNear, fogFar;
      varying vec3 vW; varying vec3 vFogViewPos;
      ${HFOG_GLSL}
      void main(){
        vec3 toEye = cameraPosition - vW; float dist = length(toEye); vec3 V = toEye / dist;
        vec2 p = vW.xz; float t = uTime;
        vec2 flow = vec2(1.1, 0.0);     // the Yan flows east
        vec3 n1 = texture2D(uNormal, (p - flow * t) * 0.045).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormal, mat2(0.8, -0.6, 0.6, 0.8) * (p - flow * t * 1.3) * 0.12 + vec2(t * 0.01, -t * 0.013)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(uNormal, (p - flow * t * 0.6) * 0.008).xyz * 2.0 - 1.0;
        float fl = 1.0 / (1.0 + dist * 0.012);
        vec2 slope = (n1.xy * 0.55 + n2.xy * 0.4) * (0.25 + 0.75 * fl) + n3.xy * 0.5;
        vec3 N = normalize(vec3(slope.x * 0.12, 1.0, slope.y * 0.12));   // calmer: big soft reflections, not sandpaper
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float F = min(0.02 + 0.98 * pow(1.0 - ndv, 5.0), 0.5);
        vec3 R = reflect(-V, N);
        // the reflected sky / far bank: low = the lit shore haze, high = the dark deck
        float el = clamp(R.y, 0.0, 1.0);
        vec3 shore = mix(vec3(0.24, 0.23, 0.23), vec3(0.05, 0.05, 0.06) + vec3(0.2, 0.12, 0.045) * uGlow + vec3(0.1, 0.03, 0.006) * uFire, uNight);
        vec3 deck = mix(vec3(0.22, 0.21, 0.27), vec3(0.02, 0.022, 0.035) + vec3(0.06, 0.035, 0.015) * uGlow, uNight);
        vec3 refl = mix(shore, deck, smoothstep(0.02, 0.35, el));
        // muddy water body (the Yan is brown), darker with night
        vec3 body = mix(vec3(0.09, 0.085, 0.06), vec3(0.016, 0.02, 0.017), uNight);   // brown-green, like the Jialing
        vec3 c = mix(body, refl, F * 1.6);
        // foam streaks / debris lines drifting with the current
        float fm = smoothstep(0.82, 0.98, texture2D(uNormal, (p - flow * t * 1.05) * vec2(0.01, 0.05)).x);
        c += vec3(0.08, 0.07, 0.06) * fm * (1.0 - uNight * 0.7) * fl;
        float fogK = smoothstep(fogNear, fogFar, length(vFogViewPos));
        c = mix(c, fogColor, fogK);
        c = mix(c, uHFC * 0.8, hfogK(vW));   // the mist lying on the water
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// a mist sheet: a big horizontal plane, noise-eroded alpha, fades near the eye and with distance
function mistMaterial(fog, { y, k = 0.55, scale = 0.006, speed = 0.6 }) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: RIVER_U.uTime, fogColor: { value: fog.color }, uK: { value: k }, uNight: SKY.night, uGlow: SKY.glow, uFire: SKY.fire },
    vertexShader: /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uK, uNight, uGlow, uFire; uniform vec3 fogColor; varying vec3 vW;
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vn(p); p*=2.07; a*=.5; } return s; }
      void main(){
        vec2 p = vW.xz * ${scale.toFixed(4)} + vec2(uTime * ${(speed * 0.004).toFixed(5)}, 0.0);
        float n = fbm(p + fbm(p * 1.7 + 3.0) * 0.8);
        float a = smoothstep(0.38, 0.78, n) * uK;
        float d = distance(cameraPosition, vW);
        a *= smoothstep(6.0, 60.0, d) * (1.0 - smoothstep(900.0, 2200.0, d));
        // the eye sees a sheet edge-on as a hard line: fade it out when we're level with it
        a *= smoothstep(0.0, 6.0, abs(cameraPosition.y - vW.y));
        vec3 c = fogColor * 1.15 + vec3(0.05, 0.03, 0.012) * uGlow * uNight + vec3(0.06, 0.018, 0.0) * uFire * uNight;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
}

// a river cruiser: a long white hull, two lit saloon decks, gold LED outlines (the Yan's night cruises)
function cruiser(B, x, z, len, seed, code) {
  const A = B.get('plain', 'boats'), W = B.get('win', 'boats'), r = makeRng(seed);
  const w = 9 + r() * 3, h0 = 1.2;
  A.set({ col: [0.85, 0.84, 0.8], rm: [0.5, 0.1, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
  A.box(-len / 2, -1.2, -w / 2, len / 2, h0, w / 2, { faces: 'xXzZY' });
  A.box(len / 2, -1.2, -w / 2 + 1, len / 2 + 4, h0, w / 2 - 1, { faces: 'XzZY' });
  W.set({ col: [0.75, 0.74, 0.7], rm: [0.4, 0, 0], em: [0, 0, 0, DUSK + code], cell: [2.2, 2.8, seed % 50, 3] });
  W.box(-len / 2 + 3, h0, -w / 2 + 0.6, len / 2 - 4, h0 + 2.8, w / 2 - 0.6, { faces: 'xXzZ', s: 1, wy0: h0 - 0.5 });
  W.box(-len / 2 + 7, h0 + 3.1, -w / 2 + 1.2, len / 2 - 10, h0 + 5.7, w / 2 - 1.2, { faces: 'xXzZ', s: 1, wy0: h0 + 2.6 });
  A.box(-len / 2 + 2.5, h0 + 2.8, -w / 2 + 0.4, len / 2 - 3.5, h0 + 3.1, w / 2 - 0.4, { faces: 'xXzZYy' });
  A.box(-len / 2 + 6.5, h0 + 5.7, -w / 2 + 1, len / 2 - 9.5, h0 + 6.0, w / 2 - 1, { faces: 'xXzZYy' });
  const L = B.get('plain', 'boats'); L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em(GOLD, 2.6, DUSK + code) });
  for (const yy of [h0 + 3.1, h0 + 6.0]) { L.box(-len / 2 + 2, yy, -w / 2 + 0.2, len / 2 - 3, yy + 0.18, -w / 2 + 0.4); L.box(-len / 2 + 2, yy, w / 2 - 0.4, len / 2 - 3, yy + 0.18, w / 2 - 0.2); }
  L.box(-len / 2, h0, -w / 2 - 0.05, len / 2 + 4, h0 + 0.16, -w / 2 + 0.12); L.box(-len / 2, h0, w / 2 - 0.12, len / 2 + 4, h0 + 0.16, w / 2 + 0.05);
}

export function buildRiver(ctx = {}) {
  const scene = ctx.scene, fog = scene.fog;
  const root = new THREE.Group(); root.name = 'river';
  const water = new THREE.Mesh(new THREE.PlaneGeometry(RIVER.x1 - RIVER.x0, FARBANK.z + 20 - RIVER.z0, 1, 1).rotateX(-Math.PI / 2), waterMaterial(fog));
  water.position.set((RIVER.x0 + RIVER.x1) / 2, WATER_Y, (RIVER.z0 + FARBANK.z + 20) / 2);
  water.renderOrder = -5;
  root.add(water);
  // the ravine's stream (a strip of the same water)
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(56, 560, 1, 1).rotateX(-Math.PI / 2), water.material);
  stream.position.set(142, 1.6, -120); root.add(stream);
  // mist: one sheet low on the water, one up at the bridge decks' height, one in the ravine
  const mist = [];
  for (const [y, k, sc, sp] of [[7, 0.6, 0.005, 0.8], [26, 0.32, 0.003, 0.5]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4000, 900, 1, 1).rotateX(-Math.PI / 2), mistMaterial(fog, { y, k, scale: sc, speed: sp }));
    m.position.set(200, y, 380); m.renderOrder = 18; root.add(m); mist.push(m);
  }
  // (the ravine mist sheet read as a flat quad edge-on from the river; the height fog does that job now)
  // river traffic: two lit cruisers and two dark barges (they move; anchors for the glide)
  const M = materials(), boats = [];
  const mk = (len, seed, code, lit) => {
    const B = new Buckets(); for (const [k, mm] of Object.entries(M)) B.mat(k, mm);
    const g = new THREE.Group();
    if (lit) cruiser(B, 0, 0, len, seed, code);
    else { const A = B.get('plain', 'boats'); A.set({ col: [0.16, 0.15, 0.14], rm: [0.7, 0.3, 0], em: [0, 0, 0, 0] }); A.box(-len / 2, -1.4, -6, len / 2, 1.2, 6, { faces: 'xXzZY' }); A.box(len / 2 - 8, 1.2, -4, len / 2 - 2, 6, 4, { faces: 'xXzZY' }); A.set({ col: [0.3, 0.22, 0.12] }); A.box(-len / 2 + 4, 1.2, -5, len / 2 - 12, 3.2, 5, { faces: 'xXzZY' }); }
    B.finish(g);
    root.add(g); return g;
  };
  const defs = [[70, 3, DIST.FAR_C, true, -300, 420, 3.2], [60, 5, DIST.FAR_W, true, 500, 470, -2.6], [80, 7, 0, false, -700, 260, 1.8], [90, 9, 0, false, 900, 520, -1.4]];
  for (const [len, seed, code, lit, x, z, v] of defs) { const g = mk(len, seed, code, lit); g.position.set(x, WATER_Y + 0.2, z); boats.push({ g, v, lit, code, len }); }
  // reflections: the brightest lights on both banks get a column on the water (filled in by the world after every module reported its glows)
  const refl = new Reflections(scene, { max: 320, fog });
  const glows = [];
  for (const b of boats) if (b.lit) for (let i = -2; i <= 2; i++) glows.push({ boat: b, off: i * b.len * 0.22, p: new THREE.Vector3(), color: [2.2, 1.4, 0.6], size: 4, code: DUSK + b.code, far: true });
  let reflDone = false;
  const update = (dt, t, head) => {
    RIVER_U.uTime.value = t;
    for (const m of mist) { m.material.uniforms.fogColor.value = fog.color; }
    water.material.uniforms.fogNear.value = fog.near; water.material.uniforms.fogFar.value = fog.far;
    for (const b of boats) { b.g.position.x += b.v * dt; if (b.g.position.x > 1500) b.g.position.x = -1300; if (b.g.position.x < -1300) b.g.position.x = 1500; }
    for (const gl of glows) { gl.p.set(gl.boat.g.position.x + gl.off, 6, gl.boat.g.position.z); }
    if (!reflDone && ctx.world?.glowList?.length) {
      reflDone = true;
      // pick lights near the water / high and bright: quay lamps, the far bank's waterfront, bridges, the lantern wall
      const cand = ctx.world.glowList.filter(g => !g.blink && !g.boat).map(g => ({ g, p: g.p.isVector3 ? g.p : new THREE.Vector3(...g.p) }))
        .filter(o => (o.p.z > QUAY.z0 - 40 || o.p.z > FARBANK.z - 6) && o.p.y < 120).sort((a, b) => (b.g.size || 1) - (a.g.size || 1));
      let n = 0;
      for (const o of cand) {
        if (n >= 200) break;
        if (o.p.z > FARBANK.z + 30 || o.p.z < 90) continue;
        const c = o.g.color || [2, 1.2, 0.5];
        o.g._refl = refl.add({ p: o.p.toArray(), color: [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], len: 95, width: 0.6 + (o.g.size || 1) * 0.15, ground: WATER_Y, water: true, mask: false });
        o.g._reflC = c; n++;
      }
      // wet streets: the lamps over the play floors lay streaks on the damp paving (Longwu is always wet)
      let m = 0;
      for (const g of ctx.world.glowList) {
        if (m >= 80 || g.blink || g.far || g.boat || g._refl !== undefined) continue;
        const p = g.p.isVector3 ? g.p : new THREE.Vector3(...g.p);
        if (p.x < LMR.x0 || p.x > LMR.x1 || p.z < LMR.z0 || p.z > LMR.z1) continue;
        const fy = groundAt(p.x, p.z), hl = p.y - fy;
        if (hl < 2.5 || hl > 12 || (g.size || 1) < 1.2) continue;
        const c = g.color || [2, 1.2, 0.5];
        g._refl = refl.add({ p: p.toArray(), color: [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55], len: 12, width: 0.5 + (g.size || 1) * 0.12, ground: fy, water: false, mask: false });
        m++;
      }
      ctx.world._refl = refl;
    }
    // the columns go out with their lights
    if (reflDone) for (const g of ctx.world.glowList) if (g._refl !== undefined && g._refl >= 0) { const p = g._p || g.p; const k = powK(g.code ?? 16, p.y ?? p[1]); refl.set(g._refl, { intensity: k }); }
    refl.update(dt, head);
  };
  return { root, update, anchors: { glows, named: { boats, refl } }, tris: 0 };
}
