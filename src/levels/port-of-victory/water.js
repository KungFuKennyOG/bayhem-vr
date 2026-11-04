import * as THREE from 'three';
import * as T from '../../textures.js';
import { makeRng } from '../../rng.js';
import { SUN_DIR, duskShared } from '../../atmosphere.js';

// =====================================================================================
//  Harbour water: one custom shader (dark teal body, clamped fresnel to an analytic dusk sky,
//  two drifting ripple layers, a glint column toward the low sun, foam streaks at the hull/quay,
//  a shadowed gap between the quay wall and the hull, and distance haze that matches the far shore).
// =====================================================================================

// Shared GLSL: sky horizon colour (cheap copy of atmosphere.js skyCol's horizon/zenith terms)
// and the haze colour the far shore / far water fade into. Keep in sync with far.js.
export const HAZE_GLSL = /* glsl */`
vec3 horizonCol(vec3 d, vec3 sunDir, float dusk) {
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sunDir.xz + 1e-5);
  float sa = max(dot(dh, sh), 0.0);
  vec3 horAway = mix(vec3(0.86, 0.50, 0.36), vec3(0.30, 0.20, 0.33), dusk);
  vec3 horSun  = mix(vec3(2.3, 0.95, 0.36), vec3(1.25, 0.36, 0.12), dusk);
  vec3 c = mix(horAway, horSun, pow(sa, 3.0));
  c += vec3(0.55, 0.16, 0.06) * dusk * sa * sa;
  return c;
}
vec3 skyApprox(vec3 d, vec3 sunDir, float dusk) {
  float h = max(d.y, 0.0);
  vec3 zenith = mix(vec3(0.035, 0.11, 0.27), vec3(0.010, 0.025, 0.085), dusk);
  vec3 midAway = mix(vec3(0.20, 0.30, 0.48), vec3(0.055, 0.075, 0.19), dusk);
  vec3 hor = horizonCol(d, sunDir, dusk);
  return mix(hor, mix(midAway, zenith, smoothstep(0.15, 0.7, h)), smoothstep(0.0, 0.28, pow(h, 0.75)));
}
// the far-shore haze: a darkened, slightly desaturated horizon colour
vec3 hazeCol(vec3 d, vec3 sunDir, float dusk) {
  vec3 c = horizonCol(d, sunDir, dusk);
  c = c / (1.0 + 0.45 * c);                 // compress the sun lobe: haze glows, it doesn't blaze
  float l = dot(c, vec3(0.3, 0.5, 0.2));
  return mix(vec3(l), c, 0.75) * mix(0.3, 0.38, dusk);
}
`;

function rippleNormal(seed) {
  // tileable ripple height -> normal map (two octaves of cell-ish noise + directional swell)
  const S = 256, h = new Float32Array(S * S), n = T.makeNoise(seed, 8), n2 = T.makeNoise(seed + 1, 32);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const a = T.fbm(n, u, v, 8, 4), b = T.fbm(n2, u, v, 32, 3);
    h[y * S + x] = Math.pow(a, 1.5) * 0.65 + b * 0.35 + Math.sin((u * 5 + v * 2 + a * 1.6) * Math.PI * 2) * 0.06;
  }
  const t = T.heightToNormal(h, S, S, 26);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function foamNoise() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(733, 8);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const v = T.fbm(n, xx / S, y / S, 8, 4);
    const i = (y * S + xx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, (v - 0.25) * 2 * 255)); img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = T.canvasTex(c, { srgb: false }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildWater({ waterY, quayZ, hullZ, shipX0, shipX1, fog }) {
  const nrm = rippleNormal(410), foam = foamNoise();
  const uniforms = {
    uTime: { value: 0 }, uDusk: duskShared, uSun: { value: SUN_DIR },
    uNormal: { value: nrm }, uFoam: { value: foam },
    uQuay: { value: new THREE.Vector4(quayZ, hullZ, shipX0, shipX1) },
    uFog: { value: new THREE.Vector2(fog?.near ?? 30, fog?.far ?? 640) },
    uGlow: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: HAZE_GLSL + /* glsl */`
      uniform float uTime, uDusk, uGlow;
      uniform vec3 uSun;
      uniform sampler2D uNormal, uFoam;
      uniform vec4 uQuay;
      uniform vec2 uFog;
      varying vec3 vW;
      void main() {
        vec3 toEye = cameraPosition - vW;
        float dist = length(toEye);
        vec3 V = toEye / dist;
        float t = uTime;
        // two ripple layers drifting in different directions + a slow large swell layer
        vec2 p = vW.xz;
        vec3 n1 = texture2D(uNormal, p * 0.055 + vec2(t * 0.011, t * 0.019)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormal, mat2(0.8, -0.6, 0.6, 0.8) * p * 0.13 + vec2(-t * 0.024, t * 0.009)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(uNormal, p * 0.012 + vec2(t * 0.003, -t * 0.004)).xyz * 2.0 - 1.0;
        // flatten with distance (anti-shimmer) but keep some texture all the way out
        float fl = 1.0 / (1.0 + dist * 0.012);
        vec2 slope = (n1.xy * 0.55 + n2.xy * 0.4) * (0.25 + 0.75 * fl) + n3.xy * 0.35;
        // the 2 m gap between quay and hull is calm and in shadow
        float inGap = step(uQuay.y - 0.3, p.y) * step(p.y, uQuay.x) * step(uQuay.z, p.x) * step(p.x, uQuay.w);
        slope *= mix(1.0, 0.55, inGap);
        vec3 N = normalize(vec3(slope.x * 0.2, 1.0, slope.y * 0.2));
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        F = min(F, mix(0.32, 0.22, uDusk));
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 sky = skyApprox(R, uSun, uDusk) * mix(0.26, 0.13, uDusk);
        // low reflections see the far shore / skyline, not the bright horizon
        vec3 shore = hazeCol(R, uSun, uDusk) * 0.35;
        sky = mix(shore, sky, smoothstep(0.015, 0.09, R.y));
        // body: deep teal at golden hour, navy at blue hour; a little sun scatter in the swell
        vec3 body = mix(vec3(0.012, 0.034, 0.042), vec3(0.005, 0.012, 0.03), uDusk);
        float sa = max(dot(normalize(-V.xz), normalize(uSun.xz)), 0.0);
        body += vec3(0.07, 0.03, 0.01) * pow(sa, 6.0) * (1.0 - uDusk) * (0.5 + 0.5 * slope.x);
        vec3 col = mix(body, sky, F);
        // sun glint column (fades as the sun sets)
        float sunUp = smoothstep(-0.03, 0.03, uSun.y);
        float rs = max(dot(R, uSun), 0.0);
        vec3 sunC = mix(vec3(3.2, 1.55, 0.6), vec3(1.4, 0.45, 0.15), uDusk);
        col += sunC * (pow(rs, 1400.0) * 10.0 + pow(rs, 160.0) * 0.35 + pow(rs, 24.0) * 0.03) * sunUp * uGlow;
        // blue hour: the afterglow still lays a soft orange band on the water toward the west
        col += vec3(0.12, 0.035, 0.012) * uDusk * pow(rs, 8.0) * (1.0 - sunUp * 0.5);
        // shadowed gap and contact darkening along the quay wall / hull
        float dq = uQuay.x - p.y;                 // metres from the quay wall face (>0 over water)
        float ao = mix(0.35, 1.0, smoothstep(0.0, 1.6, dq));
        float inShip = step(uQuay.z, p.x) * step(p.x, uQuay.w);
        float dh = abs(p.y - uQuay.y);
        ao *= mix(1.0, mix(0.4, 1.0, smoothstep(0.0, 2.2, dh)), inShip);
        col *= mix(1.0, 0.45, inGap) * ao;
        // foam streaks: churned lines along the hull and the quay wall, broken by drifting noise
        float fz = texture2D(uFoam, vec2(p.x * 0.05 + t * 0.01, p.y * 0.6)).r;
        float fz2 = texture2D(uFoam, vec2(p.x * 0.11 - t * 0.017, p.y * 0.9 + 0.3)).r;
        float foamQ = (1.0 - smoothstep(0.1, 0.7, dq)) * smoothstep(0.45, 0.85, fz);
        float foamH = inShip * (1.0 - smoothstep(0.0, 0.5, dh)) * smoothstep(0.4, 0.8, fz2);
        vec3 foamC = mix(vec3(0.42, 0.40, 0.36), vec3(0.12, 0.13, 0.17), uDusk);
        col = mix(col, foamC, clamp((foamQ * 0.55 + foamH * 0.7) * (1.0 - 0.5 * inGap), 0.0, 0.8));
        // distance haze toward the far shore colour (never the bright sky)
        float fogK = smoothstep(uFog.x, uFog.y * 1.6, dist);
        fogK = 1.0 - (1.0 - fogK) * (1.0 - fogK);
        col = mix(col, hazeCol(-V, uSun, uDusk) * mix(0.32, 0.22, uDusk), fogK * mix(0.8, 0.65, uDusk));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    fog: false,
  });
  const geo = new THREE.PlaneGeometry(2600, 1500, 1, 1); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, waterY, quayZ - 750);
  mesh.renderOrder = -5;
  return {
    mesh, material: mat,
    update(dt, t) { uniforms.uTime.value = t; },
  };
}
