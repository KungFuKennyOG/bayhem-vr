import * as THREE from 'three';
import { SUN_DIR } from '../../atmosphere.js';

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
  vec3 hor = mix(vec3(0.22, 0.12, 0.09), vec3(0.22, 0.08, 0.16), neon * 0.6);
  vec3 mid = vec3(0.05, 0.045, 0.09), zen = vec3(0.012, 0.016, 0.04);
  vec3 c = mix(hor, mix(mid, zen, smoothstep(0.15, 0.7, hh)), smoothstep(0.0, 0.3, pow(hh, 0.75)));
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.08);
    vec2 cuv = uv * vec2(0.5, 0.8) + vec2(time * 0.003, time * 0.001);
    float c1 = tfbm(cuv * 1.2 + 1.7), c2 = tfbm(uv * 2.8 + vec2(time * 0.008, 0.0) + 5.0);
    float cov = smoothstep(0.3, 0.68, c1 * 0.85 + c2 * 0.3) * smoothstep(0.0, 0.06, h);
    float lit = 1.0 - smoothstep(0.0, 0.7, hh);
    vec3 under = mix(vec3(0.15, 0.08, 0.065), vec3(0.16, 0.06, 0.13), neon * 0.5);
    vec3 cc = mix(vec3(0.05, 0.045, 0.07), under, 0.25 + 0.75 * lit) * (0.7 + 0.55 * c2);
    cc += vec3(0.42, 0.15, 0.05) * glow * lit * (0.5 + 0.5 * c2);
    vec2 sp = d.xz / (h + 0.35) * 380.0;
    float st = step(0.9988, th21(floor(sp))) * smoothstep(0.35, 0.8, h);
    c = mix(c + vec3(0.8, 0.85, 1.0) * st * 0.25, cc, cov * 0.94);
  }
  if (h < 0.0) c = mix(hor, hor * 0.5, smoothstep(0.0, -0.2, h));
  return c;
}
`;
export function createTokyoSky() {
  return new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, glow: skyShared.glow },
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: GLSL + /* glsl */`varying vec3 vDir; void main(){ gl_FragColor = vec4(tokyoSky(normalize(vDir)), 1.0);
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
    fragmentShader: GLSL + `varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec3 c = tokyoSky(d);
      float az = atan(d.x, d.z);
      if (d.y < 0.22) {
        // the street wall: blocks of colour at different heights, darker gaps between buildings
        float col = floor(az * 9.0);
        float h = th21(vec2(col, 3.0));
        float top = 0.04 + 0.18 * h;
        if (d.y < top) {
          vec3 n = th21(vec2(col, 7.0)) < 0.33 ? vec3(1.0, 0.25, 0.7) : th21(vec2(col, 7.0)) < 0.55 ? vec3(0.2, 0.9, 1.0) : th21(vec2(col, 7.0)) < 0.8 ? vec3(1.0, 0.6, 0.2) : vec3(0.9, 0.9, 1.0);
          float win = step(0.5, th21(floor(vec2(az * 60.0, d.y * 80.0))));
          c = vec3(0.03, 0.028, 0.035) + n * (0.25 + 0.6 * win) * (0.4 + 0.6 * th21(vec2(col, 11.0)));
        }
      }
      if (d.y < -0.05) c = mix(c, vec3(0.05, 0.045, 0.05), smoothstep(-0.05, -0.4, d.y));
      gl_FragColor = vec4(c, 1.0);} `,
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 500);
  pm.dispose();
  return rt.texture;
}
