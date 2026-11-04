import * as THREE from 'three';
import { SUN_DIR } from '../../atmosphere.js';

// =====================================================================================
//  Paris after rain: a low, broken cloud deck lit orange-brown from below by the city's sodium
//  glow, deep navy holes with a few stars, a last smear of afterglow low in the west-south-west
//  (right behind the tower from the start) and warm light-pollution haze on every horizon.
//  `night` 0 = late blue hour, 1 = night. Same uniform names as atmosphere.js's sky (main.js
//  feeds sunDir/time every frame), so it drops in as E.sky's material.
// =====================================================================================
export const nightShared = { value: 0.3 };

export const NIGHT_SKY_GLSL = /* glsl */`
uniform vec3 sunDir;
uniform float time;
uniform float night;
float nh21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float nvn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(nh21(i),nh21(i+vec2(1,0)),u.x), mix(nh21(i+vec2(0,1)),nh21(i+vec2(1,1)),u.x), u.y); }
float nfbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*nvn(p); p*=2.07; a*=.5; } return s; }
vec3 nightSky(vec3 d){
  float h = d.y, hh = max(h, 0.0);
  vec2 dh = normalize(d.xz + 1e-5), sh = normalize(sunDir.xz + 1e-5);
  float sa = max(dot(dh, sh), 0.0);
  float n = night;
  // clear-sky gradient (seen through the holes)
  vec3 zen = mix(vec3(0.018, 0.04, 0.12), vec3(0.006, 0.012, 0.04), n);
  vec3 mid = mix(vec3(0.07, 0.10, 0.24), vec3(0.025, 0.035, 0.09), n);
  vec3 hor = mix(vec3(0.42, 0.26, 0.30), vec3(0.20, 0.13, 0.12), n);       // warm city haze
  vec3 c = mix(hor, mix(mid, zen, smoothstep(0.12, 0.6, hh)), smoothstep(0.0, 0.22, pow(hh, 0.8)));
  // afterglow: a band low in the WSW, dying with the night
  float ag = pow(sa, 2.5) * (1.0 - smoothstep(0.0, 0.16, hh));
  c += vec3(0.95, 0.34, 0.12) * ag * mix(1.0, 0.35, n);
  c += vec3(0.35, 0.10, 0.12) * pow(sa, 1.2) * (1.0 - smoothstep(0.0, 0.3, hh)) * mix(0.8, 0.25, n);
  // stars in the holes
  vec2 sp = d.xz / (h + 0.35) * 380.0;
  float st = step(0.9986, nh21(floor(sp))) * smoothstep(0.25, 0.7, h);
  // the cloud deck: stratocumulus at ~1.5 km, drifting east
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.06);
    vec2 cuv = uv * vec2(0.55, 0.9) + vec2(time * 0.004, time * 0.0015);
    float c1 = nfbm(cuv * 1.1 + 3.7);
    float c2 = nfbm(uv * 2.6 + vec2(time * 0.01, 0.0) + 11.0);
    float cov = smoothstep(0.38, 0.72, c1 * 0.8 + c2 * 0.35);
    cov *= smoothstep(0.0, 0.05, h);
    // underside lit by the city (sodium orange, brighter near the horizon where you see more of the glow)
    vec3 under = mix(vec3(0.30, 0.17, 0.10), vec3(0.16, 0.085, 0.055), n);
    vec3 top = mix(vec3(0.10, 0.09, 0.15), vec3(0.035, 0.035, 0.06), n);
    float lit = 1.0 - smoothstep(0.0, 0.55, hh);
    vec3 cc = mix(top, under, 0.35 + 0.65 * lit) * (0.75 + 0.5 * c2);
    // the afterglow catches the cloud bottoms in the west
    cc += vec3(0.8, 0.28, 0.12) * pow(sa, 3.0) * lit * mix(0.9, 0.25, n) * (0.6 + 0.6 * c2);
    c = mix(c + vec3(0.85, 0.9, 1.0) * st * (1.0 - cov) * 0.3, cc, cov * 0.92);
  }
  if (h < 0.0) c = mix(hor, hor * 0.6, smoothstep(0.0, -0.2, h));
  return c;
}
`;

export function createNightSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, night: nightShared },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize((modelMatrix * vec4(position,1.0)).xyz - cameraPosition);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: NIGHT_SKY_GLSL + /* glsl */`
      varying vec3 vDir;
      void main(){
        gl_FragColor = vec4(nightSky(normalize(vDir)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
}

// PMREM of the night sky (reflections on wet stone, cars, glass)
export function createNightEnvironment(renderer) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 }, night: nightShared },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: NIGHT_SKY_GLSL + `varying vec3 vDir; void main(){ vec3 d = normalize(vDir); vec3 c = nightSky(d);
      // below the horizon: the lit city (warm, a little brighter than the haze) fading into dark ground
      if (d.y < 0.0) c = mix(vec3(0.22, 0.14, 0.10), vec3(0.03, 0.03, 0.035), smoothstep(0.0, -0.3, d.y));
      gl_FragColor = vec4(c, 1.0);} `,
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 500);
  pm.dispose();
  return rt.texture;
}

// viewer helper: swap the viewer's sky for this one (?fn=skyPreview&args=[night])
export async function skyPreview(night = 0.4, ctx) {
  if (typeof night === 'object') { ctx = night; night = 0.4; }
  nightShared.value = night;
  ctx.scene.traverse(o => { if (o.material?.uniforms?.dusk && o.material.uniforms.sunDir) o.material = createNightSkyMaterial(); });
  ctx.scene.traverse(o => { if (o.isSprite) o.visible = false; });
  ctx.scene.environment = createNightEnvironment(ctx.renderer);
  ctx.scene.fog.color.setRGB(0.16, 0.11, 0.11);
  ctx.renderer.toneMappingExposure = 1.15;
  ctx.hemi.color.setRGB(0.35, 0.42, 0.7); ctx.hemi.groundColor.setRGB(0.25, 0.16, 0.12); ctx.hemi.intensity = 0.55;
  ctx.sun.intensity = 0.15;
  const { buildPreview } = await import('./tower.js');
  return buildPreview(ctx);
}
