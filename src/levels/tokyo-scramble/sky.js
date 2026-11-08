import * as THREE from 'three';
import { SUN_DIR } from '../../atmosphere.js';
import { DAY } from './tod.js';

// =====================================================================================
//  Tokyo at midnight: no afterglow, a low overcast lit from below by the city — sodium orange near
//  the horizon going magenta / violet where the neon districts are, a few navy holes higher up.
//  Same uniform names as atmosphere.js's sky (main.js feeds sunDir / time), so it drops in as
//  E.sky's material. `glow` (0..1) lets the fire / collapse warm the clouds.
// =====================================================================================
export const skyShared = { glow: { value: 0 } };
const GLSL = /* glsl */`
uniform vec3 sunDir; uniform float time; uniform float glow;
float th21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float tvn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(th21(i),th21(i+vec2(1,0)),u.x), mix(th21(i+vec2(0,1)),th21(i+vec2(1,1)),u.x), u.y); }
float tfbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*tvn(p); p*=2.07; a*=.5; } return s; }
vec3 tokyoSky(vec3 d){
  float h = d.y, hh = max(h, 0.0);
  // city glow on the horizon: warm, with a magenta cast toward the neon (east / north-east)
  float az = atan(d.x, -d.z);
  float neon = 0.5 + 0.5 * cos(az - 0.9);
  vec3 hor = mix(vec3(0.24, 0.15, 0.1), vec3(0.24, 0.13, 0.12), neon * 0.5);
  vec3 mid = vec3(0.06, 0.05, 0.06), zen = vec3(0.016, 0.018, 0.03);
  vec3 c = mix(hor, mix(mid, zen, smoothstep(0.15, 0.7, hh)), smoothstep(0.0, 0.3, pow(hh, 0.75)));
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.08);
    vec2 cuv = uv * vec2(0.5, 0.8) + vec2(time * 0.003, time * 0.001);
    float c1 = tfbm(cuv * 1.2 + 1.7), c2 = tfbm(uv * 2.8 + vec2(time * 0.008, 0.0) + 5.0);
    float cov = smoothstep(0.3, 0.68, c1 * 0.85 + c2 * 0.3) * smoothstep(0.0, 0.06, h);
    float lit = 1.0 - smoothstep(0.0, 0.7, hh);
    vec3 under = mix(vec3(0.17, 0.11, 0.075), vec3(0.17, 0.1, 0.09), neon * 0.5);
    vec3 cc = mix(vec3(0.05, 0.045, 0.07), under, 0.25 + 0.75 * lit) * (0.7 + 0.55 * c2);
    cc += vec3(0.42, 0.15, 0.05) * glow * lit * (0.5 + 0.5 * c2);
    vec2 sp = d.xz / (h + 0.35) * 380.0;
    float st = step(0.9988, th21(floor(sp))) * smoothstep(0.35, 0.8, h);
    c = mix(c + vec3(0.8, 0.85, 1.0) * st * 0.25, cc, cov * 0.94);
  }
  if (h < 0.0) c = mix(hor, hor * 0.5, smoothstep(0.0, -0.2, h));
  return c;
}

// ---- the afternoon: a clear, deep blue sky, hazy at the horizon, scattered fair-weather cumulus
// (lit white toward the sun, grey bases), a few cirrus streaks, the sun's glare. glow (the finale)
// browns the low sky with smoke.
vec3 tokyoDay(vec3 d){
  float h = d.y, hh = max(h, 0.0);
  vec3 L = normalize(sunDir); float sa = max(dot(d, L), 0.0);
  vec3 zen = vec3(0.04, 0.14, 0.48), mid = vec3(0.16, 0.36, 0.78), hor = vec3(0.56, 0.7, 0.88);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, hh)); c = mix(c, zen, smoothstep(0.25, 0.95, hh));
  c += vec3(1.0, 0.9, 0.72) * pow(sa, 28.0) * 0.7 + vec3(0.45, 0.4, 0.32) * pow(sa, 4.0) * 0.3 + vec3(40.0) * smoothstep(0.99955, 0.9998, sa);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.1);
    vec2 cuv = uv * 0.32 + vec2(time * 0.004, time * 0.002);
    float n = tfbm(cuv * 1.3 + 2.0) * 0.75 + tfbm(uv * 1.7 + 7.0) * 0.38;
    float cov = smoothstep(0.6, 0.8, n) * smoothstep(0.015, 0.16, h);
    float lit = 0.5 + 0.5 * sa;
    vec3 cc = mix(vec3(0.6, 0.65, 0.74), vec3(1.08, 1.06, 1.02), smoothstep(0.62, 0.95, n) * lit);
    c = mix(c, cc, cov * 0.95);
    float ci = smoothstep(0.55, 0.8, tfbm(vec2(uv.x * 0.5, uv.y * 3.0) + 11.0)) * smoothstep(0.2, 0.6, hh) * 0.22;
    c = mix(c, vec3(0.95, 0.97, 1.0), ci * (1.0 - cov));
  }
  c = mix(c, vec3(0.7, 0.78, 0.88), (1.0 - smoothstep(0.0, 0.05, hh)) * 0.5);
  float low = 1.0 - smoothstep(0.0, 0.5, hh);
  c = mix(c, vec3(0.3, 0.26, 0.22), glow * low * 0.55);
  if (h < 0.0) c = mix(vec3(0.72, 0.8, 0.9), vec3(0.4, 0.42, 0.45), smoothstep(0.0, -0.2, h));
  return c;
}
vec3 skyAt(vec3 d){ return ${DAY.on ? 'tokyoDay(d)' : 'tokyoSky(d)'}; }
`;
export function createTokyoSky() {
  return new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, glow: skyShared.glow },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: GLSL + /* glsl */`varying vec3 vDir; void main(){ gl_FragColor = vec4(skyAt(normalize(vDir)), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}
// The reflection environment: the sky above, and below the horizon a band of the lit city — warm
// windows, magenta / cyan / amber neon blocks — so car paint, glass and chrome pick up a neon street.
export function createTokyoEnvironment(renderer) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, glow: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: GLSL + `varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec3 c = skyAt(d);
      float az = atan(d.x, d.z);
      if (d.y < 0.22) {
        // the street wall: blocks of colour at different heights, darker gaps between buildings
        float col = floor(az * 9.0);
        float h = th21(vec2(col, 3.0));
        float top = 0.04 + 0.18 * h;
        if (d.y < top) {
          if (${DAY.on ? 1 : 0} == 1) {
            float r = th21(vec2(col, 7.0));
            vec3 wall = r < 0.3 ? vec3(0.62, 0.58, 0.5) : r < 0.55 ? vec3(0.55, 0.56, 0.57) : r < 0.8 ? vec3(0.3, 0.34, 0.38) : vec3(0.72, 0.7, 0.66);
            float win = step(0.55, fract(d.y * 90.0)) * step(0.3, fract(az * 70.0));
            c = wall * (0.55 + 0.3 * th21(vec2(col, 11.0))) * (1.0 - 0.45 * win);
          } else {
          vec3 n = th21(vec2(col, 7.0)) < 0.33 ? vec3(1.0, 0.25, 0.7) : th21(vec2(col, 7.0)) < 0.55 ? vec3(0.2, 0.9, 1.0) : th21(vec2(col, 7.0)) < 0.8 ? vec3(1.0, 0.6, 0.2) : vec3(0.9, 0.9, 1.0);
          float win = step(0.5, th21(floor(vec2(az * 60.0, d.y * 80.0))));
          c = vec3(0.03, 0.028, 0.035) + n * (0.25 + 0.6 * win) * (0.4 + 0.6 * th21(vec2(col, 11.0)));
          }
        }
      }
      if (d.y < -0.05) c = mix(c, ${DAY.on ? 'vec3(0.24, 0.24, 0.25)' : 'vec3(0.05, 0.045, 0.05)'}, smoothstep(-0.05, -0.4, d.y));
      gl_FragColor = vec4(c, 1.0);} `,
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 500);
  pm.dispose();
  return rt.texture;
}
