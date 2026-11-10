import * as THREE from 'three';
import { SUN_DIR } from '../../atmosphere.js';

// =====================================================================================
//  The Longwu sky: a low, wet overcast over a fogged gorge. At dusk a smear of afterglow in the
//  south-south-west under the cloud deck; as night falls the deck's underside picks up the city's
//  sodium-gold glow. When the power goes, the glow dies with it — what is left is fire: an
//  orange-red underlight in the north-east where the interchange burns, and a deep blue-black.
//  Uniforms: night 0..1, glow 0..1 (the city lights), fire 0..1. Same names as atmosphere.js's sky
//  (sunDir / time), so it drops in as E.sky's material.
// =====================================================================================
export const SKY = { night: { value: 0.15 }, glow: { value: 1 }, fire: { value: 0 } };

export const SKY_GLSL = /* glsl */`
uniform vec3 sunDir;
uniform float time;
uniform float night;
uniform float glow;
uniform float fire;
float sh21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float svn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(sh21(i),sh21(i+vec2(1,0)),u.x), mix(sh21(i+vec2(0,1)),sh21(i+vec2(1,1)),u.x), u.y); }
float sfbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*svn(p); p*=2.03; a*=.5; } return s; }
vec3 cqSky(vec3 d){
  float h = d.y, hh = max(h, 0.0);
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sunDir.xz + 1e-5);
  float sa = max(dot(dh, sh), 0.0);
  // the fire direction: north-east (the interchange / the east bank)
  float fa = max(dot(dh, normalize(vec2(0.75, -0.66))), 0.0);
  float n = night;
  vec3 zen = mix(vec3(0.07, 0.085, 0.14), vec3(0.012, 0.016, 0.035), n);
  vec3 hor = mix(vec3(0.36, 0.28, 0.32), vec3(0.09, 0.08, 0.085), smoothstep(0.0, 0.8, n));
  hor += vec3(0.02, 0.025, 0.04) * (1.0 - glow) * n;   // a cold moonlit haze on the horizon when the city's out
  // the city's glow thickens the horizon haze (sodium + gold), blackout takes it away
  hor += vec3(0.20, 0.12, 0.05) * glow * n;
  vec3 c = mix(hor, zen, smoothstep(0.0, 0.5, pow(hh, 0.7)));
  // afterglow under the deck (SSW), dying with the night
  float ag = pow(sa, 3.0) * (1.0 - smoothstep(0.0, 0.2, hh));
  c += vec3(1.0, 0.42, 0.16) * ag * (1.0 - n) * 0.9;
  c += vec3(0.42, 0.17, 0.16) * pow(sa, 1.3) * (1.0 - smoothstep(0.0, 0.35, hh)) * (1.0 - n) * 0.6;
  // the cloud deck (low, heavy, moving slowly west)
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.08);
    vec2 cuv = uv * vec2(0.7, 1.0) + vec2(-time * 0.003, time * 0.001);
    float c1 = sfbm(cuv * 0.9 + 3.1);
    float c2 = sfbm(uv * 2.4 + vec2(-time * 0.008, 0.0) + 9.0);
    float cov = smoothstep(0.30, 0.68, c1 * 0.85 + c2 * 0.3);
    cov = mix(cov, 1.0, 0.45) * smoothstep(0.0, 0.04, h);
    float low = 1.0 - smoothstep(0.0, 0.6, hh);
    vec3 under = mix(vec3(0.22, 0.18, 0.22), vec3(0.035, 0.032, 0.042), smoothstep(0.0, 0.75, n));
    under += vec3(0.20, 0.11, 0.045) * glow * n * (0.4 + 0.6 * low);       // sodium city glow on the deck
    under += vec3(0.42, 0.12, 0.03) * fire * pow(fa, 4.0) * low;           // the fires underlighting it
    under += vec3(0.95, 0.45, 0.2) * pow(sa, 3.5) * low * (1.0 - n) * 0.9; // the afterglow catching it
    vec3 top = mix(vec3(0.13, 0.13, 0.18), vec3(0.02, 0.022, 0.036), smoothstep(0.0, 0.75, n));
    vec3 cc = mix(top, under, 0.4 + 0.6 * low) * (0.8 + 0.4 * c2);
    // with the city dark, the moon finds the breaks in the deck: cold silver edges (silhouettes read against them)
    cc += vec3(0.05, 0.06, 0.085) * (1.0 - glow) * n * smoothstep(0.45, 0.85, c2) * (0.4 + 0.6 * smoothstep(0.05, 0.4, hh));
    c = mix(c, cc, cov * 0.95);
  }
  // fire glow on the horizon haze too
  c += vec3(0.4, 0.11, 0.03) * fire * pow(fa, 5.0) * (1.0 - smoothstep(0.0, 0.18, hh)) * 0.7;
  if (h < 0.0) c = mix(hor, hor * 0.7, smoothstep(0.0, -0.2, h));
  return c;
}
`;

export function createSky() {
  return new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, ...SKY },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: SKY_GLSL + /* glsl */`
      varying vec3 vDir;
      void main(){
        gl_FragColor = vec4(cqSky(normalize(vDir)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}

// PMREM of the sky with the lit city below the horizon (wet streets, glass and cars reflect it)
export function createEnvironment(renderer) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, ...SKY },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: SKY_GLSL + `varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec3 c = cqSky(d);
      if (d.y < 0.0) { vec3 city = mix(vec3(0.12, 0.1, 0.1), vec3(0.24, 0.15, 0.07) * (0.3 + 0.7 * glow) + vec3(0.25, 0.07, 0.02) * fire, night);
        c = mix(c, city, smoothstep(0.0, -0.08, d.y)); c = mix(c, vec3(0.03, 0.03, 0.035), smoothstep(-0.1, -0.5, d.y)); }
      gl_FragColor = vec4(c, 1.0);} `,
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 500);
  pm.dispose();
  return rt.texture;
}
