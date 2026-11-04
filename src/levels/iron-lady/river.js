import * as THREE from 'three';
import * as T from '../../textures.js';
import { SUN_DIR } from '../../atmosphere.js';
import { WATER_Y, RIVER } from './layout.js';

// =====================================================================================
//  THE SEINE at blue hour → night. One ShaderMaterial on one quad (one draw):
//   - body: dark green-brown river water, a little silt scatter where it's churned;
//   - fresnel (clamped) to an analytic copy of the level's night sky (sky.js): navy overhead,
//     warm city haze on the horizon, the last afterglow band low in the WSW (behind the tower);
//   - low reflections see the dark quay walls / facades, not the bright horizon (grazing angles
//     from 1.5 m above the water would otherwise turn the whole river into a mirror of the haze);
//   - two drifting ripple normal layers + a slow swell, all advected by the current toward -x;
//   - rain pocks: expanding ring ripples in the normal (procedural cells, no texture), with a
//     tiny bright crest that catches the warm lamp light;
//   - a dark, calm band along the quay walls (z = ±40) + a contact line where water meets stone;
//   - distance haze matched to the scene fog colour + the fog's sun lobe (scene fog uniforms).
//  The wet-light streaks (lamps, tower) are drawn on top by reflections.js.
// =====================================================================================

export const SKY_APPROX_GLSL = /* glsl */`
// cheap copy of sky.js nightSky() without clouds / stars (night 0..1)
vec3 nightSkyApprox(vec3 d, vec3 sunDir, float n) {
  float hh = max(d.y, 0.0);
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sunDir.xz + 1e-5);
  float sa = max(dot(dh, sh), 0.0);
  vec3 zen = mix(vec3(0.018, 0.04, 0.12), vec3(0.006, 0.012, 0.04), n);
  vec3 mid = mix(vec3(0.07, 0.10, 0.24), vec3(0.025, 0.035, 0.09), n);
  vec3 hor = mix(vec3(0.42, 0.26, 0.30), vec3(0.20, 0.13, 0.12), n);
  vec3 c = mix(hor, mix(mid, zen, smoothstep(0.12, 0.6, hh)), smoothstep(0.0, 0.22, pow(hh, 0.8)));
  float ag = pow(sa, 2.5) * (1.0 - smoothstep(0.0, 0.16, hh));
  c += vec3(0.95, 0.34, 0.12) * ag * mix(1.0, 0.35, n);
  c += vec3(0.35, 0.10, 0.12) * pow(sa, 1.2) * (1.0 - smoothstep(0.0, 0.3, hh)) * mix(0.8, 0.25, n);
  // the cloud deck's sodium-lit underside, averaged (it covers most of the sky)
  vec3 under = mix(vec3(0.30, 0.17, 0.10), vec3(0.16, 0.085, 0.055), n) * (1.0 - smoothstep(0.0, 0.55, hh) * 0.6);
  c = mix(c, under + vec3(0.8, 0.28, 0.12) * pow(sa, 3.0) * mix(0.5, 0.15, n) * (1.0 - smoothstep(0.0, 0.4, hh)), 0.55 * smoothstep(0.0, 0.05, d.y));
  return c;
}
`;

function rippleNormal(seed) {
  // tileable ripple height -> normal: cell-ish fbm + a little directional chop (river chop, not sea swell)
  const S = 256, h = new Float32Array(S * S), n = T.makeNoise(seed, 8), n2 = T.makeNoise(seed + 1, 32), n3 = T.makeNoise(seed + 2, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const a = T.fbm(n, u, v, 8, 4), b = T.fbm(n2, u, v, 32, 3), c = T.fbm(n3, u, v, 16, 2);
    h[y * S + x] = Math.pow(a, 1.6) * 0.55 + b * 0.3 + Math.abs(c - 0.5) * 0.25 + Math.sin((u * 3 + v * 7 + a * 1.8) * Math.PI * 2) * 0.04;
  }
  const t = T.heightToNormal(h, S, S, 22);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildRiver(ctx = {}) {
  const scene = ctx.scene;
  const fog = scene?.fog || { color: new THREE.Color(0.16, 0.11, 0.11), near: 60, far: 1500 };
  const nrm = rippleNormal(5150);
  const uniforms = {
    uTime: { value: 0 }, uNight: { value: 0.3 }, uSun: { value: SUN_DIR },
    uNormal: { value: nrm },
    uWall: { value: new THREE.Vector2(RIVER.z0, RIVER.z1) },
    uRain: { value: 1 },
    uFlow: { value: 0.8 },
    fogColor: { value: fog.color }, fogNear: { value: fog.near }, fogFar: { value: fog.far },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vW;
      varying vec3 vFogViewPos;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mv = viewMatrix * w;
        vFogViewPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: SKY_APPROX_GLSL + /* glsl */`
      uniform float uTime, uNight, uRain, uFlow;
      uniform vec3 uSun;
      uniform sampler2D uNormal;
      uniform vec2 uWall;
      uniform vec3 fogColor, fogColorSun, fogSunDir;
      uniform float fogNear, fogFar;
      varying vec3 vW;
      varying vec3 vFogViewPos;
      float rh(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
      // rain pocks: one drop per cell per period, rings expand + fade; returns slope (xy) and crest (z)
      // (one cell per layer: the ring stays inside its cell, so no neighbour taps)
      vec3 pocks(vec2 p, float t, float scale) {
        vec2 q = p * scale;
        vec2 id = floor(q);
        float r0 = rh(id), r1 = rh(id + 7.31), r2 = rh(id + 3.17);
        vec2 ctr = id + 0.5 + (vec2(r0, r1) - 0.5) * 0.3;
        float ph = fract(t * (0.8 + 0.5 * r2) + r1);
        vec2 d = q - ctr;
        float L = length(d);
        float x = (L - ph * 0.36) / (0.035 + ph * 0.04);   // ring radius grows to ~0.36 cell, ring widens
        float e = exp(-x * x), a = (1.0 - ph) * (1.0 - ph) * step(0.35, r2 + 0.3);   // ~1/3 of the cells idle
        // derivative of the ring bump: outward on the leading edge, inward on the trailing one
        return vec3((L > 1e-4 ? d / L : vec2(0.0)) * (-2.0 * x * e * a), e * a);
      }
      void main() {
        vec3 toEye = cameraPosition - vW;
        float dist = length(toEye);
        vec3 V = toEye / dist;
        float t = uTime;
        float n = uNight;
        vec2 p = vW.xz;
        // the current flows toward -x; ripples are advected with it (+ a little cross drift)
        vec2 flow = vec2(-uFlow, 0.0);
        vec3 n1 = texture2D(uNormal, (p - flow * t) * 0.06 + vec2(0.0, t * 0.004)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(uNormal, mat2(0.8, -0.6, 0.6, 0.8) * (p - flow * t * 1.15) * 0.17 + vec2(-t * 0.012, t * 0.017)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(uNormal, (p - flow * t * 0.7) * 0.013 + vec2(t * 0.001, -t * 0.002)).xyz * 2.0 - 1.0;
        float fl = 1.0 / (1.0 + dist * 0.018);       // flatten fine ripples with distance (anti-shimmer)
        vec2 slope = (n1.xy * 0.5 + n2.xy * 0.42) * (0.2 + 0.8 * fl) + n3.xy * 0.4;
        // calm, sheltered band along each quay wall
        float dw = min(p.y - uWall.x, uWall.y - p.y);       // metres from the nearest wall face
        float calm = smoothstep(0.0, 6.0, dw);
        slope *= mix(0.45, 1.0, calm);
        // rain pocks (only near: they alias into noise far away)
        float pk = uRain * (1.0 - smoothstep(12.0, 40.0, dist));
        vec3 rp = vec3(0.0);
        if (pk > 0.001) {
          rp = pocks(p, t * 1.1, 1.6) + pocks(mat2(0.8, -0.6, 0.6, 0.8) * p + 13.7, t * 1.1 + 0.37, 2.3) * 0.8 + pocks(p * 1.31 + 41.1, t * 1.2 + 0.71, 3.1) * 0.6;
          slope += rp.xy * 0.4 * pk;
        }
        vec3 N = normalize(vec3(slope.x * 0.22, 1.0, slope.y * 0.22));
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        F = min(F, 0.42);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 sky = nightSkyApprox(R, uSun, n) * 0.3;
        // low reflections hit the far bank first: quay wall + Haussmann facades (~29 m above the water at
        // |z| 78..). Trace the reflected ray to the facade line on the side it points to: its skyline
        // elevation decides shore vs sky, the hit point gives a grid of warm lit windows.
        float sa = max(dot(normalize(R.xz + 1e-5), normalize(uSun.xz + 1e-5)), 0.0);
        float rh2 = length(R.xz) + 1e-4;
        vec2 Rd = R.xz / rh2;
        float tz = (sign(Rd.y + 1e-4) * 78.0 - p.y) / (Rd.y + sign(Rd.y + 1e-4) * 1e-3);   // horizontal metres to the facades
        tz = clamp(tz, 30.0, 4000.0);
        float tanR = R.y / rh2;
        float skyline = max(29.0 / tz, 0.014);                          // tan of the roofline (or the far skyline, ~0.8°)
        float hy = tanR * tz;                                           // height above the water where the ray hits
        float hx = p.x + Rd.x * tz;
        vec3 shore = mix(vec3(0.020, 0.018, 0.020), vec3(0.05, 0.03, 0.022), pow(sa, 4.0)) * mix(1.0, 0.7, n);
        // windows: 3.6 m bays, 3.3 m floors above the 7 m quay wall + 4 m shop level; ~40 % lit, warm
        vec2 wc = vec2(hx / 3.6, (hy - 11.0) / 3.3);
        float wAA = 1.0 - smoothstep(0.25, 0.6, max(fwidth(wc.x), fwidth(wc.y)));
        vec2 wf = fract(wc) - 0.5;
        float lit = step(0.6, rh(floor(wc) + 3.1)) * step(0.0, hy - 11.0) * step(hy, 27.0);
        float win = lit * (1.0 - smoothstep(0.18, 0.3, abs(wf.x))) * (1.0 - smoothstep(0.2, 0.36, abs(wf.y)));
        shore += vec3(0.3, 0.17, 0.07) * win * wAA * (0.5 + rh(floor(wc) + 9.7)) * (1.0 - smoothstep(120.0, 450.0, tz)) * (1.0 - smoothstep(80.0, 300.0, dist));
        // streetlamp line along the far parapet (just above the wall top) as a dim warm band
        shore += vec3(0.16, 0.09, 0.04) * exp(-pow((hy - 11.5) / 1.6, 2.0)) * (1.0 - smoothstep(200.0, 900.0, tz));
        sky = mix(shore, sky, smoothstep(skyline * 0.85, skyline * 1.15 + 0.004, tanR));
        // body: dark green-brown Seine
        vec3 body = mix(vec3(0.010, 0.013, 0.009), vec3(0.006, 0.008, 0.007), n);
        body += vec3(0.012, 0.010, 0.006) * clamp(slope.x * 0.6 + 0.4, 0.0, 1.0) * fl;   // silt scatter in the chop
        vec3 col = mix(body, sky, F);
        // afterglow sheen (a soft warm band on the water toward the WSW)
        float rs = max(dot(R, normalize(vec3(uSun.x, 0.06, uSun.z))), 0.0);
        col += vec3(0.10, 0.03, 0.012) * pow(rs, 10.0) * mix(1.0, 0.35, n) * F * 2.0;
        // pock crests catch the warm city light (tiny specular beads)
        col += vec3(0.05, 0.035, 0.02) * clamp(rp.z, 0.0, 1.0) * pk * F * 2.0;
        // dark band + contact line at the quay walls (the wall's shadow and the stained waterline)
        float ao = mix(0.35, 1.0, smoothstep(0.0, 3.5, dw));
        ao *= mix(0.55, 1.0, smoothstep(0.0, 0.35, dw));
        col *= ao;
        // distance haze: scene fog (same curve + sun lobe as the global fog chunk)
        float fogK = smoothstep(fogNear, fogFar, dist);
        fogK = 1.0 - (1.0 - fogK) * (1.0 - fogK);
        vec3 fdir = normalize(vFogViewPos);
        float fs = max(dot(fdir, fogSunDir), 0.0);
        vec3 fcol = mix(fogColor, fogColorSun, pow(fs, 3.0));
        fcol += fogColorSun * pow(fs, 20.0) * 0.6;
        col = mix(col, fcol * 0.85, fogK);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    fog: false,
  });
  // the fog sun-lobe uniforms are shared objects (atmosphere.js patch put them on every ShaderLib entry)
  const lib = THREE.ShaderLib.standard.uniforms;
  uniforms.fogColorSun = lib.fogColorSun || { value: new THREE.Color(0.4, 0.2, 0.1) };
  uniforms.fogSunDir = lib.fogSunDir || { value: new THREE.Vector3(0, 0, -1) };
  mat.name = 'seine';
  const x0 = -1200, x1 = 1400;
  const geo = new THREE.PlaneGeometry(x1 - x0, RIVER.z1 - RIVER.z0, 1, 1); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x0 + x1) / 2, WATER_Y, 0);
  mesh.renderOrder = -5; mesh.name = 'seine';
  const root = new THREE.Group(); root.name = 'river'; root.add(mesh);
  return {
    root, mesh, material: mat, uniforms,
    // dusk: the level passes 0.85 (blue hour) .. 1.0 (night)
    update(dt, t, dusk = 0.9) {
      uniforms.uTime.value = t;
      uniforms.uNight.value = Math.min(1, Math.max(0, (dusk - 0.85) / 0.15));
      uniforms.fogNear.value = fog.near; uniforms.fogFar.value = fog.far;
    },
    setRain(k) { uniforms.uRain.value = k; },
    info: { draws: 1, tris: 2 },
  };
}
