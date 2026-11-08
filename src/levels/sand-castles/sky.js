import * as THREE from 'three';
import { SUN_DIR, fogShared, rimShared, setSunElevation } from '../../atmosphere.js';
import { FAC } from './facade.js';
import { SUN_AZ } from './layout.js';

// =====================================================================================
//  AL-SARAB SKY + TIME OF DAY. Three looks blended by two numbers:
//    sunset 0..1  — hot, hazy 15:40 afternoon (milky blue, white-gold glare) -> sunset over the Gulf
//    storm  0..1  — the haboob: everything goes to an orange-brown murk, the sun a dim red coin
//  `look(k)` drives the sun, hemisphere, fog, fog-sun colour, rim light, exposure, the facade
//  night (lit windows) and dust coat, and the sky uniforms. Three reflection environments are
//  baked at load (day, storm, sunset) and swapped when the screen is busy (dust / fire).
// =====================================================================================

export const SKY = { storm: { value: 0 }, sunset: { value: 0 }, glow: { value: 0 } };

const GLSL = /* glsl */`
uniform vec3 sunDir; uniform float time; uniform float storm; uniform float sunset; uniform float glow;
float sh21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float svn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(sh21(i),sh21(i+vec2(1,0)),u.x), mix(sh21(i+vec2(0,1)),sh21(i+vec2(1,1)),u.x), u.y); }
float sfbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*svn(p); p*=2.03; a*=.5; } return s; }
vec3 skyAt(vec3 d){
  float h = d.y, hh = max(h, 0.0);
  vec3 L = normalize(sunDir); float sa = max(dot(d, L), 0.0);
  float az = max(0.0, dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(L.x, 0.0, L.z))));
  // ---- afternoon: milky, dusty blue; a wide white-gold glare round the sun; a beige haze band at the horizon
  vec3 zen = vec3(0.09, 0.22, 0.48), mid = vec3(0.32, 0.47, 0.68), hor = vec3(0.78, 0.74, 0.66);
  vec3 cD = mix(hor, mid, smoothstep(0.0, 0.22, pow(hh, 0.8))); cD = mix(cD, zen, smoothstep(0.22, 0.9, hh));
  cD += vec3(1.0, 0.9, 0.7) * pow(sa, 6.0) * 0.45 + vec3(1.0, 0.95, 0.85) * pow(sa, 60.0) * 1.2;
  // ---- sunset over the Gulf: orange at the sun, rose and violet away from it, deep blue overhead
  vec3 zS = vec3(0.04, 0.09, 0.22), mS = vec3(0.24, 0.24, 0.42), hA = vec3(0.86, 0.48, 0.38), hS = vec3(2.3, 0.95, 0.36);
  vec3 horS = mix(hA, hS, pow(az, 3.0) * smoothstep(0.0, 0.0, 1.0));
  vec3 cS = mix(mix(hA, hS, pow(sa, 2.5)), mix(mS, zS, smoothstep(0.15, 0.7, hh)), smoothstep(0.0, 0.3, pow(hh, 0.7)));
  cS += vec3(1.3, 0.55, 0.16) * pow(sa, 3.0) * (1.0 - smoothstep(0.0, 0.5, hh)) + vec3(1.6, 0.8, 0.35) * pow(sa, 40.0);
  vec3 c = mix(cD, cS, sunset);
  // high cirrus (lit gold at sunset)
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12);
    float ci = smoothstep(0.52, 0.78, sfbm(vec2(uv.x * 0.6, uv.y * 2.2) + time * 0.002 + 11.0)) * smoothstep(0.03, 0.3, hh);
    vec3 cc = mix(vec3(1.0, 0.98, 0.95), vec3(1.8, 0.85, 0.45), sunset) * mix(0.9, 1.3, pow(sa, 4.0));
    c = mix(c, cc, ci * 0.35);
  }
  // the sun disc
  c += mix(vec3(30.0, 26.0, 20.0), vec3(18.0, 8.0, 2.5), sunset) * smoothstep(0.99955, 0.9998, sa) * (1.0 - storm * 0.85);
  // ---- the haboob: a brown murk, darker overhead, the sun a dim red coin through it
  float sn = sfbm(d.xz / (h + 0.25) * 2.0 + vec2(time * 0.05, time * 0.02));
  vec3 cB = mix(vec3(0.62, 0.42, 0.24), vec3(0.32, 0.2, 0.11), smoothstep(-0.05, 0.6, h)) * (0.85 + 0.3 * sn);
  cB += vec3(1.2, 0.5, 0.15) * pow(sa, 12.0) * 0.6 + vec3(1.6, 0.6, 0.2) * smoothstep(0.9993, 0.9997, sa) * 0.8;
  c = mix(c, cB, storm);
  // below the horizon (seen only past the ground's edge): haze
  if (h < 0.0) c = mix(c, mix(vec3(0.7, 0.66, 0.6), vec3(0.62, 0.42, 0.24), storm), smoothstep(0.0, -0.1, h));
  c = mix(c, vec3(0.45, 0.2, 0.08), glow * (1.0 - smoothstep(0.0, 0.4, hh)) * 0.5);
  return c;
}`;

export function createSky() {
  return new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, storm: SKY.storm, sunset: SKY.sunset, glow: SKY.glow },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: GLSL + /* glsl */`varying vec3 vDir; void main(){ gl_FragColor = vec4(skyAt(normalize(vDir)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}

// reflection environment for a look: the sky above, a band of hazy towers below the horizon so glass reflects a city
export function bakeEnv(renderer, storm, sunset) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, storm: { value: storm }, sunset: { value: sunset }, glow: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: GLSL + `varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec3 c = skyAt(d);
      float az = atan(d.x, d.z);
      float col = floor(az * 14.0);
      float top = 0.03 + 0.2 * sh21(vec2(col, 3.0)) * sh21(vec2(col, 5.0));
      if (d.y < top && d.y > -0.02) {
        vec3 haze = skyAt(vec3(d.x, 0.02, d.z));
        float r = sh21(vec2(col, 7.0));
        vec3 wall = r < 0.4 ? vec3(0.16, 0.22, 0.26) : r < 0.7 ? vec3(0.55, 0.5, 0.42) : vec3(0.3, 0.32, 0.34);
        float win = step(0.5, fract(d.y * 120.0)) * step(0.25, fract(az * 90.0));
        c = mix(wall * (0.6 + 0.4 * win), haze, 0.45 + 0.3 * sh21(vec2(col, 9.0)));
        c += vec3(1.0, 0.6, 0.3) * win * sunset * 0.25 * step(0.7, sh21(floor(vec2(az * 90.0, d.y * 120.0))));
      }
      if (d.y < -0.02) c = mix(vec3(0.42, 0.38, 0.33), vec3(0.5, 0.36, 0.22), storm) * mix(1.0, 0.6, sunset);
      gl_FragColor = vec4(c, 1.0);} `,
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 500);
  pm.dispose(); mat.dispose();
  return rt.texture;
}

const C = (r, g, b) => new THREE.Color(r, g, b);
const LOOKS = {
  day: { sun: C(1.0, 0.9, 0.76), sunI: 4.8, hs: C(0.6, 0.7, 0.86), hg: C(0.62, 0.5, 0.38), hI: 0.62, fog: C(0.7, 0.7, 0.69), near: 700, far: 9500, fogSun: [0.75, 0.62, 0.42], rim: [0.55, 0.5, 0.42], exp: 0.86, env: 0.7 },
  sunset: { sun: C(1.0, 0.56, 0.26), sunI: 3.6, hs: C(0.45, 0.48, 0.72), hg: C(0.52, 0.32, 0.22), hI: 0.72, fog: C(0.78, 0.5, 0.38), near: 600, far: 8000, fogSun: [2.1, 0.88, 0.34], rim: [1.5, 0.78, 0.4], exp: 1.02, env: 0.85 },
  storm: { sun: C(1.0, 0.62, 0.32), sunI: 1.3, hs: C(0.78, 0.55, 0.34), hg: C(0.55, 0.36, 0.2), hI: 1.0, fog: C(0.6, 0.4, 0.22), near: 30, far: 820, fogSun: [0.95, 0.5, 0.2], rim: [0.6, 0.38, 0.2], exp: 1.0, env: 0.55 },
};
const _c = new THREE.Color();
export const TOD = { sunset: 0, storm: 0, elev: 30 };
// apply the look: sunset 0..1, storm 0..1 (storm blends over whatever the sunset look is)
export function applyLook(E, sunset, storm, elev) {
  TOD.sunset = sunset; TOD.storm = storm; TOD.elev = elev;
  setSunElevation(elev, SUN_AZ);
  const A = LOOKS.day, B = LOOKS.sunset, S = LOOKS.storm;
  const L = (a, b, k) => a + (b - a) * k;
  const mix3 = (k1, k2) => (a, b, c) => L(L(a, b, k1), c, k2);
  const m = mix3(sunset, storm);
  const { sun, hemi, renderer, scene } = E;
  sun.color.copy(A.sun).lerp(B.sun, sunset).lerp(S.sun, storm); sun.intensity = m(A.sunI, B.sunI, S.sunI);
  hemi.color.copy(A.hs).lerp(B.hs, sunset).lerp(S.hs, storm); hemi.groundColor.copy(A.hg).lerp(B.hg, sunset).lerp(S.hg, storm); hemi.intensity = m(A.hI, B.hI, S.hI);
  scene.fog.color.copy(_c.copy(A.fog).lerp(B.fog, sunset).lerp(S.fog, storm));
  // storm fog closes in hard (exponential-ish in k so the city doesn't vanish at the first wisp)
  const sk = storm * storm * (3 - 2 * storm);
  scene.fog.near = L(L(A.near, B.near, sunset), S.near, sk);
  scene.fog.far = L(L(A.far, B.far, sunset), S.far, Math.pow(sk, 0.6));
  fogShared.sunColor.r = m(A.fogSun[0], B.fogSun[0], S.fogSun[0]); fogShared.sunColor.g = m(A.fogSun[1], B.fogSun[1], S.fogSun[1]); fogShared.sunColor.b = m(A.fogSun[2], B.fogSun[2], S.fogSun[2]);
  rimShared.color.r = m(A.rim[0], B.rim[0], S.rim[0]); rimShared.color.g = m(A.rim[1], B.rim[1], S.rim[1]); rimShared.color.b = m(A.rim[2], B.rim[2], S.rim[2]);
  renderer.toneMappingExposure = m(A.exp, B.exp, S.exp);
  scene.environmentIntensity = m(A.env, B.env, S.env);
  SKY.storm.value = storm; SKY.sunset.value = sunset;
  FAC.uNight.value = Math.max(0, (sunset - 0.55) / 0.45) * 0.9 + storm * 0.25;
  FAC.uDust.value = Math.max(FAC.uDust.value * 0.999, storm * 0.8);
  FAC.uSunL.value.copy(SUN_DIR);
  E.flare.visible = storm < 0.3;
}
