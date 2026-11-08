import * as THREE from 'three';
import { SUN_DIR } from '../../atmosphere.js';

// =====================================================================================
//  WHITEOUT sky: one shader, two weathers.
//   storm (clear 0): a low, fast overcast — horizon = the fog colour (the slope dissolves into it),
//     wind-torn cloud streaks racing overhead, a pale smudge where the sun is behind the deck.
//   clear (clear 1): the storm tears open from the top down — deep alpine blue, a low gold sun in the
//     south-south-west, cirrus and a lenticular cap, the horizon glowing over the cloud sea.
//  Same uniform names as atmosphere.js's sky (main.js feeds sunDir / time). skyShared drives it.
//  Plus: the environment map for reflections (re-baked when the weather turns) and the cloud sea.
// =====================================================================================
export const skyShared = {
  clear: { value: 0 },               // 0 storm .. 1 clear
  fog: { value: new THREE.Color(0.62, 0.68, 0.76) },   // storm horizon (kept equal to the scene fog colour)
  white: { value: 0 },               // avalanche powder: everything goes white
  whiteCol: { value: new THREE.Color(0.8, 0.83, 0.88) },
};

const NOISE = /* glsl */`
float sh21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float svn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(sh21(i),sh21(i+vec2(1,0)),u.x), mix(sh21(i+vec2(0,1)),sh21(i+vec2(1,1)),u.x), u.y); }
float sfbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*svn(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
`;
const GLSL = /* glsl */`
uniform vec3 sunDir; uniform float time; uniform float clear; uniform vec3 fogC; uniform float white; uniform vec3 whiteCol;
` + NOISE + /* glsl */`
vec3 skyW(vec3 d){
  float h = d.y, hh = max(h, 0.0);
  vec3 L = normalize(sunDir);
  float sa = max(dot(d, L), 0.0);
  float az = max(dot(normalize(vec2(d.x, d.z) + 1e-5), normalize(vec2(L.x, L.z) + 1e-5)), 0.0);
  // ---- clear: alpine blue, gold toward the low sun, a bright band over the cloud sea
  vec3 zen = vec3(0.03, 0.09, 0.33), mid = vec3(0.14, 0.29, 0.62), hor = vec3(0.7, 0.72, 0.82);
  vec3 cs = mix(hor, mid, smoothstep(0.0, 0.22, hh)); cs = mix(cs, zen, smoothstep(0.22, 0.85, hh));
  cs += vec3(1.5, 0.82, 0.38) * pow(az, 6.0) * (1.0 - smoothstep(0.0, 0.32, hh)) * 0.9;
  cs += vec3(1.2, 0.75, 0.42) * pow(sa, 12.0) * 0.8 + vec3(2.6, 1.9, 1.2) * pow(sa, 160.0);
  cs += vec3(40.0, 30.0, 18.0) * smoothstep(0.99955, 0.99978, sa);
  // anti-sun side: a faint pink belt (alpenglow sky) low over the face
  cs += vec3(0.34, 0.16, 0.18) * pow(max(0.0, -dot(normalize(vec2(d.x, d.z) + 1e-5), normalize(vec2(L.x, L.z) + 1e-5))), 3.0) * (1.0 - smoothstep(0.0, 0.2, hh)) * 0.6;
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12);
    float ci = smoothstep(0.55, 0.85, sfbm(vec2(uv.x * 0.6, uv.y * 2.4) + vec2(time * 0.004, 0.0) + 11.0)) * smoothstep(0.12, 0.5, hh);
    vec3 ciC = mix(vec3(0.9, 0.92, 1.0), vec3(1.8, 1.25, 0.8), pow(sa, 3.0));
    cs = mix(cs, ciC, ci * 0.4);
    // a lenticular cap hanging in the east (calm air above the storm)
    vec2 lc = vec2(atan(d.x, -d.z) - 1.15, h - 0.11);
    float len = exp(-pow(lc.x / 0.32, 2.0) - pow(lc.y / 0.025, 2.0)) * (0.7 + 0.3 * sfbm(uv * 3.0));
    cs = mix(cs, vec3(1.25, 1.1, 1.05) + vec3(0.6, 0.3, 0.1) * pow(sa, 2.0), clamp(len, 0.0, 0.85));
  }
  if (h < 0.0) cs = mix(vec3(0.95, 0.9, 0.86) + vec3(0.8, 0.45, 0.2) * pow(az, 4.0), vec3(0.6, 0.62, 0.68), smoothstep(0.0, -0.25, h));
  // ---- storm: the overcast, torn and racing
  vec3 st = mix(fogC, fogC * vec3(0.86, 0.9, 0.98) + vec3(-0.06, -0.04, 0.0), smoothstep(0.0, 0.7, hh));
  float n = 0.5;
  if (h > -0.05) {
    vec2 uv = d.xz / (max(h, 0.0) + 0.06);
    vec2 w = vec2(time * 0.09, time * 0.05);
    n = sfbm(uv * vec2(0.5, 1.4) + w);
    float n2 = sfbm(uv * 1.9 + w * 2.3 + 4.0);
    st *= 0.9 + (n - 0.5) * 0.28 + (n2 - 0.5) * 0.12;
    st += fogC * 0.35 * pow(sa, 8.0) + vec3(0.25, 0.24, 0.22) * pow(sa, 40.0);   // the sun as a pale smudge
  }
  // ---- break-up: the deck tears into holes as clear rises (the top of the sky first)
  float tear = sfbm(d.xz / (hh + 0.25) * 0.7 + vec2(time * 0.02, 0.0) + 3.0) + hh * 0.35;
  float deck = 1.0 - smoothstep(1.25 - clear * 1.55, 1.42 - clear * 1.55, tear);
  deck = mix(deck, 1.0, step(clear, 0.001));
  vec3 c = mix(cs, st, deck);
  // the torn edges of the deck catch the gold
  c += vec3(1.4, 0.8, 0.35) * (deck * (1.0 - deck) * 2.4) * pow(az, 2.0) * clear;
  c = mix(c, whiteCol, white);
  return c;
}
`;
const VS = /* glsl */`varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, clear: skyShared.clear, fogC: skyShared.fog, white: skyShared.white, whiteCol: skyShared.whiteCol },
    vertexShader: VS,
    fragmentShader: GLSL + /* glsl */`varying vec3 vDir; void main(){ gl_FragColor = vec4(skyW(normalize(vDir)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}
// environment for reflections: the same sky over a snowfield
export function createEnvironment(renderer) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 3 }, clear: { value: skyShared.clear.value }, fogC: { value: skyShared.fog.value.clone() }, white: { value: 0 }, whiteCol: skyShared.whiteCol },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: GLSL + `varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec3 c = skyW(d);
      if (d.y < 0.0) c = mix(fogC * 1.05, fogC * vec3(0.85, 0.88, 0.95), smoothstep(0.0, -0.4, d.y));
      gl_FragColor = vec4(min(c, vec3(8.0)), 1.0);} `,
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 500);
  pm.dispose(); mat.dispose();
  return rt.texture;
}

// ---- the sea of clouds below the summit (only visible once it clears): billows lit gold from the low
// sun, blue in the troughs, thinning where the peaks punch through. One big plane, one draw.
export function buildCloudSea(fog) {
  const u = { time: { value: 0 }, clear: skyShared.clear, sunDir: { value: SUN_DIR }, fogColor: { value: fog.color }, fogNear: { value: 300 }, fogFar: { value: 8000 } };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float time; uniform float clear; uniform vec3 sunDir; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      varying vec3 vW; varying float vD;
      void main(){
        vec2 p = vW.xz * 0.0018 + vec2(time * 0.003, time * 0.001);
        float n = sfbm(p) * 0.65 + sfbm(p * 3.1 + 7.0) * 0.35;
        float bill = pow(1.0 - abs(n * 2.0 - 1.0), 1.5);
        // a fake height: lumps lit from the sun side
        float e = 0.02;
        float nx = sfbm(p + vec2(e, 0.0)) - sfbm(p - vec2(e, 0.0)), nz = sfbm(p + vec2(0.0, e)) - sfbm(p - vec2(0.0, e));
        vec3 N = normalize(vec3(-nx * 9.0, 1.0, -nz * 9.0));
        vec3 L = normalize(sunDir);
        float dif = clamp(dot(N, normalize(vec3(L.x, max(L.y, 0.12), L.z))) * 0.8 + 0.35, 0.0, 1.4);
        vec3 c = mix(vec3(0.42, 0.5, 0.68), vec3(1.25, 1.08, 0.92), dif) + vec3(0.9, 0.45, 0.15) * pow(dif, 4.0) * 0.5;
        float dist = length(vW.xz - cameraPosition.xz);
        float a = clear * smoothstep(0.18, 0.5, n + 0.15) * (1.0 - smoothstep(7000.0, 9000.0, dist));
        // haze toward the horizon
        float f = smoothstep(fogNear, fogFar, vD);
        c = mix(c, vec3(0.85, 0.82, 0.8) + vec3(0.5, 0.25, 0.1) * pow(max(dot(normalize(vW - cameraPosition), L), 0.0), 4.0), f * 0.7);
        if (a < 0.01) discard;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, fog: false,
  });
  const g = new THREE.PlaneGeometry(18000, 18000, 1, 1); g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(60, 64, -380); mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh, u };
}
