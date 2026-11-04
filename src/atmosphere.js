import * as THREE from 'three';
import { glowTexture, streakTexture } from './textures.js';

// Sun sits low ahead of the truck (we drive toward -z, into the sunset).
export const SUN_DIR = new THREE.Vector3(-0.42, 0.105, -1).normalize();

// Shared fog uniforms (plain objects => shared by reference across every material clone)
export const fogShared = {
  sunColor: { r: 2.3, g: 0.95, b: 0.36 },
  sunDirView: { x: 0, y: 0, z: -1 },
};
export const FOG_AWAY = new THREE.Color(0.86, 0.50, 0.36); // warm haze away from sun

export const rimShared = { color: { r: 1.6, g: 0.85, b: 0.45 } };
export function patchFog() {
  const C = THREE.ShaderChunk;
  // ---- sun rim / fresnel sheen so backlit hero objects never crush to black ----
  C.lights_pars_begin = `uniform vec3 rimSunDir;\nuniform vec3 rimColor;\n` + C.lights_pars_begin;
  C.lights_fragment_end += `
  {
    float ndv = clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0);
    float fr = pow(1.0 - ndv, 5.0);
    float back = clamp(dot(-geometryViewDir, rimSunDir), 0.0, 1.0);
    // world-up facing surfaces (road, roofs) get no rim: viewMatrix maps world up into view space
    float nUp = dot(geometryNormal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
    float sideMask = 1.0 - smoothstep(0.45, 0.85, nUp);
    reflectedLight.directSpecular += rimColor * fr * (0.04 + 0.4 * pow(back, 3.0)) * sideMask;
  }`;
  // ---- Bay grade: applied in display space after tone mapping (per-material, so it's free in VR) ----
  C.colorspace_pars_fragment += `
vec3 bayGrade(vec3 c){
  c = clamp(c, 0.0, 1.0);
  c = c * 0.965 + vec3(0.022, 0.018, 0.02); // filmic black lift
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // filmic S-curve for punch
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.42);
  // split-tone: teal shadows, amber highlights
  c += vec3(-0.02, 0.018, 0.04) * (1.0 - smoothstep(0.0, 0.5, l)) * smoothstep(0.0, 0.12, l);
  c += vec3(0.06, 0.02, -0.05) * smoothstep(0.45, 1.0, l);
  float l2 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l2), c, 1.16);
  return clamp(c, 0.0, 1.0);
}`;
  C.colorspace_fragment = `gl_FragColor = linearToOutputTexel( gl_FragColor );
#ifdef TONE_MAPPING
  gl_FragColor.rgb = bayGrade(gl_FragColor.rgb);
#endif`;
  C.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogViewPos;
#endif`;
  C.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogViewPos = mvPosition.xyz;
#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec3 fogColorSun;
  uniform vec3 fogSunDir;
  varying float vFogDepth;
  varying vec3 vFogViewPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    fogFactor = 1.0 - (1.0 - fogFactor) * (1.0 - fogFactor);
  #endif
  vec3 fdir = normalize(vFogViewPos);
  float fs = max(dot(fdir, fogSunDir), 0.0);
  vec3 fcol = mix(fogColor, fogColorSun, pow(fs, 3.0));
  fcol += fogColorSun * pow(fs, 20.0) * 0.6;
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fcol, fogFactor );
#endif`;
  for (const key of Object.keys(THREE.ShaderLib)) {
    const u = THREE.ShaderLib[key].uniforms;
    if (u && u.fogColor) {
      u.fogColorSun = { value: fogShared.sunColor };
      u.fogSunDir = { value: fogShared.sunDirView };
    }
    if (u && (u.directionalLights || u.ambientLightColor)) {
      u.rimSunDir = { value: fogShared.sunDirView };
      u.rimColor = { value: rimShared.color };
    }
  }
}

// Golden hour -> blue hour. One shared uniform drives the sky; applyDusk() moves the lights, fog and grade with it.
export const duskShared = { value: 0 };
const GOLD = {
  sun: new THREE.Color(1.0, 0.62, 0.34), sunI: 4.8, hemiSky: new THREE.Color(0.5, 0.62, 0.95), hemiGround: new THREE.Color(0.6, 0.4, 0.26), hemiI: 0.95,
  fog: new THREE.Color(0.86, 0.50, 0.36), fogSun: [2.3, 0.95, 0.36], rim: [1.6, 0.85, 0.45],
};
const BLUE = {
  sun: new THREE.Color(1.0, 0.36, 0.16), sunI: 0.5, hemiSky: new THREE.Color(0.30, 0.42, 0.95), hemiGround: new THREE.Color(0.22, 0.16, 0.16), hemiI: 0.62,
  fog: new THREE.Color(0.20, 0.17, 0.30), fogSun: [1.1, 0.34, 0.14], rim: [0.75, 0.32, 0.2],
};
const _ca = new THREE.Color();
export function applyDusk(k, { sun, hemi, fog, renderer } = {}) {
  k = Math.min(1, Math.max(0, k));
  duskShared.value = k;
  const L = (a, b) => a + (b - a) * k;
  if (sun) { sun.color.copy(GOLD.sun).lerp(BLUE.sun, k); sun.intensity = L(GOLD.sunI, BLUE.sunI); }
  if (hemi) { hemi.color.copy(GOLD.hemiSky).lerp(BLUE.hemiSky, k); hemi.groundColor.copy(GOLD.hemiGround).lerp(BLUE.hemiGround, k); hemi.intensity = L(GOLD.hemiI, BLUE.hemiI); }
  if (fog) fog.color.copy(_ca.copy(GOLD.fog).lerp(BLUE.fog, k));
  fogShared.sunColor.r = L(GOLD.fogSun[0], BLUE.fogSun[0]); fogShared.sunColor.g = L(GOLD.fogSun[1], BLUE.fogSun[1]); fogShared.sunColor.b = L(GOLD.fogSun[2], BLUE.fogSun[2]);
  rimShared.color.r = L(GOLD.rim[0], BLUE.rim[0]); rimShared.color.g = L(GOLD.rim[1], BLUE.rim[1]); rimShared.color.b = L(GOLD.rim[2], BLUE.rim[2]);
  if (renderer) renderer.toneMappingExposure = L(1.0, 1.32);
}
// put the sun at a given elevation (degrees) keeping its azimuth
export function setSunElevation(deg, azimuthFrom = SUN_DIR) {
  const h = Math.hypot(azimuthFrom.x, azimuthFrom.z) || 1, a = deg * Math.PI / 180;
  SUN_DIR.set(azimuthFrom.x / h * Math.cos(a), Math.sin(a), azimuthFrom.z / h * Math.cos(a)).normalize();
}

const _v = new THREE.Vector3();
export function updateFogView(camera) {
  // camera.matrixWorldInverse rotates world dir into view space
  _v.copy(SUN_DIR).transformDirection(camera.matrixWorldInverse);
  fogShared.sunDirView.x = _v.x; fogShared.sunDirView.y = _v.y; fogShared.sunDirView.z = _v.z;
}

const skyGLSL = /* glsl */`
uniform vec3 sunDir;
uniform float time;
uniform float dusk; // 0 = golden hour, 1 = blue hour (sun under the horizon)
varying vec3 vDir;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
vec3 skyCol(vec3 d){
  float h = d.y;
  float sa = max(dot(d, sunDir), 0.0);
  vec3 zenith = mix(vec3(0.035, 0.11, 0.27), vec3(0.010, 0.025, 0.085), dusk);
  vec3 midAway = mix(vec3(0.20, 0.30, 0.48), vec3(0.055, 0.075, 0.19), dusk);
  vec3 horAway = mix(vec3(0.86, 0.50, 0.36), vec3(0.30, 0.20, 0.33), dusk);
  vec3 horSun  = mix(vec3(2.3, 0.95, 0.36), vec3(1.25, 0.36, 0.12), dusk);
  vec3 hor = mix(horAway, horSun, pow(sa, 3.0));
  float hh = max(h, 0.0);
  vec3 c = mix(hor, mix(midAway, zenith, smoothstep(0.15, 0.7, hh)), smoothstep(0.0, 0.28, pow(hh, 0.75)));
  // warm wash toward the sun across the sky
  float dk = 1.0 - 0.6 * dusk;
  c += vec3(1.3, 0.55, 0.16) * pow(sa, 3.0) * (1.0 - smoothstep(0.0, 0.55, hh)) * dk;
  c += vec3(0.5, 0.18, 0.05) * pow(sa, 1.5) * (1.0 - smoothstep(0.0, 0.3, hh)) * dk;
  c += vec3(1.6, 0.8, 0.35) * pow(sa, 48.0) * dk;
  c += vec3(4.0, 2.6, 1.4) * pow(sa, 600.0) * (1.0 - dusk);
  // blue hour: a band of afterglow along the whole western horizon, stars overhead
  c += vec3(0.55, 0.16, 0.06) * dusk * pow(max(0.0, dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z)))), 2.0) * (1.0 - smoothstep(0.0, 0.18, hh));
  if (dusk > 0.01) { vec2 sp = d.xz / (h + 0.35) * 220.0; float st = step(0.9975, h21(floor(sp))) * smoothstep(0.25, 0.6, h); c += vec3(0.9, 0.95, 1.1) * st * dusk * 0.6 * (0.6 + 0.4 * sin(time * 3.0 + h21(floor(sp) + 7.0) * 40.0)); }
  // sun disk
  float disk = smoothstep(0.99955, 0.99975, sa);
  c = mix(c, mix(vec3(28.0, 18.0, 9.0), vec3(18.0, 6.0, 1.5), dusk), disk);
  // below horizon -> haze
  if (h < 0.0) c = mix(hor, hor * 0.55, smoothstep(0.0, -0.2, h));
  // clouds
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.08);
    vec2 cuv = uv * vec2(0.35, 1.6) + vec2(time * 0.002, 0.0);
    float n = fbm(cuv * 1.2 + vec2(3.1, 1.7));
    float n2 = fbm(uv * vec2(0.9, 0.3) + 9.0);
    float cov = smoothstep(0.48, 0.78, n * 0.75 + n2 * 0.45);
    cov *= smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.35, 0.8, h));
    vec3 lit = mix(vec3(1.25, 0.52, 0.34), vec3(2.8, 1.3, 0.5), pow(sa, 2.0)) * mix(1.0, 0.42, dusk) + vec3(0.12, 0.0, 0.14) * dusk;
    vec3 shade = mix(vec3(0.20, 0.15, 0.28), vec3(0.62, 0.26, 0.16), pow(sa, 2.0)) * mix(1.0, 0.35, dusk);
    float rim = smoothstep(0.3, 1.0, n2);
    vec3 cc = mix(shade, lit, 0.35 + 0.65 * rim);
    cc += vec3(3.0, 1.5, 0.6) * pow(sa, 14.0) * 1.2;
    c = mix(c, cc, cov * 0.85);
  }
  return c;
}
`;

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, dusk: duskShared },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: skyGLSL + /* glsl */`
      void main(){
        vec3 c = skyCol(normalize(vDir));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

// Sky-only environment for reflections (PMREM)
export function createEnvironment(renderer) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, dusk: duskShared },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: skyGLSL + `void main(){ vec3 d = normalize(vDir); vec3 c = skyCol(d);
      // darker ground hemisphere so cars get a horizon line
      if (d.y < 0.0) c = mix(vec3(0.5,0.32,0.22), vec3(0.06,0.05,0.05), smoothstep(0.0,-0.25,d.y));
      gl_FragColor = vec4(min(c, vec3(12.0)),1.0);} `,
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 500);
  pm.dispose();
  return rt.texture;
}

// Sun glare that lives in the world (works per-eye in VR)
export function createSunFlare() {
  const g = new THREE.Group();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,235,1)', 'rgba(255,170,80,0.45)'), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, toneMapped: false }));
  glow.scale.setScalar(700);
  const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,180,90,0.5)', 'rgba(255,120,40,0.12)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, toneMapped: false, opacity: 0.8 }));
  glow2.scale.setScalar(2200);
  const streak = new THREE.Sprite(new THREE.SpriteMaterial({ map: streakTexture(), color: 0xffc890, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, toneMapped: false, opacity: 0.75 }));
  streak.scale.set(3000, 90, 1);
  g.add(glow2, glow, streak);
  g.position.copy(SUN_DIR).multiplyScalar(2000);
  g.renderOrder = -50;
  return g;
}

export function createLights(scene, shadowSize) {
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.62, 0.34), 4.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const sc = sun.shadow.camera;
  sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
  sc.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(new THREE.Color(0.5, 0.62, 0.95), new THREE.Color(0.6, 0.4, 0.26), 0.95);
  scene.add(hemi);
  return { sun, hemi };
}
const _sd = new THREE.Vector3();
export function updateSun(sun, center) {
  sun.target.position.set(center.x, center.y > 2 ? center.y - 1.7 : 0, center.z - 10);
  // the light never goes under the horizon (shadows from below would be nonsense); the sky sun can
  _sd.copy(SUN_DIR); if (_sd.y < 0.045) { _sd.y = 0.045; _sd.normalize(); }
  sun.position.copy(sun.target.position).addScaledVector(_sd, 140);
}
