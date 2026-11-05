import * as THREE from 'three';
import { makeCanvas, canvasTex } from '../../textures.js';
import { signAtlas, JP } from './signs.js';

// =====================================================================================
//  The giant LED screens over the crossing. One shader, one mesh (+ frame) per screen:
//  programmes cycle (cola ad, idol single, the news, an abstract ident) with wipes; `alert` flips
//  every screen to the emergency broadcast (red, flashing, 緊急警報 / EVACUATE); `hp` lets the
//  player shoot one out (it tears, glitches, goes to a dead blue-black with a few live columns).
//  Up close you see the LED pitch (faded out with distance so it never moirés).
// =====================================================================================
let stripCache = null;
function stripAtlas() {
  if (stripCache) return stripCache;
  const W = 1024, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const row = (y, h, bgc, fn) => { g.fillStyle = bgc; g.fillRect(0, y, W, h); fn(y, h); };
  const txt = (s, x, y, size, col, font = JP, align = 'left', w = 900) => { g.font = `${w} ${size}px ${font}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = col; g.fillText(s, x, y); };
  // 0..128: news ticker (scrolls)
  row(0, 128, '#0b1b4a', (y, h) => { txt('速報  黒金区で爆発相次ぐ  ・  首都高 一部通行止め  ・  BREAKING: EXPLOSIONS IN KUROGANE  ・  ', 10, y + h / 2, 56, '#ffffff'); });
  // 128..256: news header
  row(128, 128, '#c8101a', (y, h) => { txt('速報', 30, y + h / 2, 92, '#ffffff'); txt('BREAKING NEWS', 260, y + h / 2, 64, '#ffe9c0', 'Anton, sans-serif', 'left', 400); });
  // 256..384: emergency
  row(256, 128, '#000000', (y, h) => { txt('緊急警報', 512, y + h / 2, 104, '#ff2a1a', JP, 'center'); });
  // 384..512: evacuate
  row(384, 128, '#ff2a1a', (y, h) => { txt('避難してください  EVACUATE NOW', 512, y + h / 2, 62, '#000000', JP, 'center'); });
  stripCache = canvasTex(c, { repeat: false, aniso: 4 });
  stripCache.wrapS = THREE.RepeatWrapping;
  return stripCache;
}

const VS = /* glsl */`
  varying vec2 vUv; varying float vD;
  #include <fog_pars_vertex>
  void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vD = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
  }`;
const FS = /* glsl */`
  uniform sampler2D tSigns; uniform sampler2D tStrip; uniform float uT; uniform float uAlert; uniform float uDead; uniform float uSeed; uniform vec2 uRes; uniform float uGain;
  uniform vec4 uPanel[4];
  varying vec2 vUv; varying float vD;
  #include <fog_pars_fragment>
  float h1(float x){ return fract(sin(x * 91.7) * 43758.55); }
  float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec3 panel(int i, vec2 uv){ vec4 r = uPanel[i]; return texture2D(tSigns, r.xy + uv * r.zw).rgb; }
  vec3 prog(float k, vec2 uv, float t){
    if (k < 0.5) { // cola: the panel art, slow push-in, a wave of light across it
      vec2 q = (uv - 0.5) * (0.92 - 0.05 * sin(t * 0.3)) + 0.5;
      vec3 c = panel(0, clamp(q, 0.0, 1.0));
      c += vec3(1.0, 0.6, 0.5) * smoothstep(0.08, 0.0, abs(uv.x - fract(t * 0.18) * 1.6 + 0.3)) * 0.6;
      return c;
    } else if (k < 1.5) { // idol: pink / violet, sparkles, the panel
      vec3 c = panel(1, uv);
      float s = step(0.995, h2(floor(uv * vec2(120.0, 40.0)) + floor(t * 6.0)));
      return c + s * 1.5;
    } else if (k < 2.5) { // the news: header, a picture (fire glow on a skyline), the ticker
      if (uv.y > 0.78) return texture2D(tStrip, vec2(uv.x, 0.5 + (uv.y - 0.78) / 0.22 * 0.25)).rgb;
      if (uv.y < 0.2) return texture2D(tStrip, vec2(uv.x * 0.55 + t * 0.06, 0.75 + uv.y / 0.2 * 0.25)).rgb;
      float sky = smoothstep(0.2, 0.78, uv.y);
      vec3 c = mix(vec3(0.9, 0.35, 0.1), vec3(0.08, 0.06, 0.12), sky);
      float bx = floor(uv.x * 18.0); float bh = 0.25 + 0.35 * h1(bx + 3.0);
      if (uv.y < 0.2 + bh * 0.58) c = vec3(0.04, 0.035, 0.04) + vec3(0.5, 0.3, 0.1) * step(0.7, h2(floor(uv * vec2(90.0, 60.0))));
      c += vec3(1.2, 0.5, 0.1) * exp(-pow((uv.x - 0.62) * 6.0, 2.0)) * smoothstep(0.6, 0.25, uv.y) * (0.7 + 0.3 * sin(t * 9.0));
      return c;
    } else { // ident: flowing bands + the bank panel
      vec3 c = 0.5 + 0.5 * cos(vec3(0.0, 2.1, 4.2) + uv.x * 3.0 + t * 0.7 + sin(uv.y * 5.0 + t));
      c *= vec3(0.5, 0.6, 1.0);
      vec2 q = (uv - vec2(0.5, 0.5)) * vec2(1.6, 1.6) + 0.5;
      if (q.x > 0.0 && q.x < 1.0 && q.y > 0.15 && q.y < 0.85) c = mix(c, panel(2, vec2(q.x, (q.y - 0.15) / 0.7)), 0.85);
      return c;
    }
  }
  void main(){
    vec2 uv = vUv;
    float t = uT + uSeed * 37.0;
    // programme schedule: 9 s each, a 0.6 s horizontal wipe between
    float slot = floor(t / 9.0), ph = fract(t / 9.0) * 9.0;
    float k0 = mod(slot + uSeed * 3.0, 4.0), k1 = mod(slot + 1.0 + uSeed * 3.0, 4.0);
    vec3 c = prog(k0, uv, t);
    if (ph > 8.4) { float w = (ph - 8.4) / 0.6; if (uv.x < w) c = prog(k1, uv, t); c += vec3(1.0) * smoothstep(0.02, 0.0, abs(uv.x - w)); }
    // the emergency broadcast
    if (uAlert > 0.0) {
      float fl = step(0.5, fract(uT * 1.1));
      vec3 a = uv.y > 0.55 ? texture2D(tStrip, vec2(uv.x, 0.25 + 0.25 * ((uv.y - 0.55) / 0.45))).rgb : texture2D(tStrip, vec2(uv.x, 0.25 * (uv.y / 0.55))).rgb;
      a = mix(a, a.bgr * vec3(0.2, 0.2, 0.2) + vec3(0.6, 0.0, 0.0), fl * 0.5);
      // tear-in: rows switch over at random
      float row = floor(uv.y * 24.0);
      c = mix(c, a, step(h1(row + 1.0), uAlert));
    }
    // shot out: tearing, then mostly dead with a few stuck columns
    if (uDead > 0.0) {
      float row = floor(uv.y * 40.0);
      float tear = step(0.6, h1(row + floor(uT * 20.0))) * (1.0 - smoothstep(0.6, 1.0, uDead));
      c = mix(c, c.gbr * 1.6, tear);
      float colLive = step(0.92, h1(floor(uv.x * 60.0) + 7.0));
      vec3 dead = vec3(0.01, 0.015, 0.04) + vec3(0.1, 0.9, 0.3) * colLive * (0.5 + 0.5 * sin(uT * 3.0 + uv.y * 20.0));
      c = mix(c, dead, smoothstep(0.3, 0.9, uDead));
    }
    // LED pitch (only up close)
    vec2 px = fract(uv * uRes);
    float grid = smoothstep(0.0, 0.18, px.x) * smoothstep(1.0, 0.82, px.x) * smoothstep(0.0, 0.18, px.y) * smoothstep(1.0, 0.82, px.y);
    float fw = clamp(length(fwidth(uv * uRes)) * 1.2, 0.0, 1.0);
    c *= mix(0.35 + 0.65 * grid, 1.0, fw);
    // edge falloff (the panel border)
    c *= smoothstep(0.0, 0.01, uv.x) * smoothstep(1.0, 0.99, uv.x) * smoothstep(0.0, 0.015, uv.y) * smoothstep(1.0, 0.985, uv.y);
    gl_FragColor = vec4(c * uGain, 1.0);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// build one screen: w × h metres, its plane at the origin facing +z (place / rotate the returned group)
export function buildScreen(w, h, { seed = 0, panels = [0, 6, 4, 2], gain = 1.6, fog } = {}) {
  const { tex, E } = signAtlas();
  const pan = panels.map(i => { const r = E.panel[i].uv; return new THREE.Vector4(r[0], r[1], r[2], r[3]); });
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      tSigns: { value: tex }, tStrip: { value: stripAtlas() }, uT: { value: 0 }, uAlert: { value: 0 }, uDead: { value: 0 }, uSeed: { value: seed },
      uRes: { value: new THREE.Vector2(Math.round(w * 9), Math.round(h * 9)) }, uGain: { value: gain }, uPanel: { value: pan },
    }]),
    vertexShader: VS, fragmentShader: FS, fog: true,
  });
  mat.uniforms.tSigns.value = tex; mat.uniforms.tStrip.value = stripAtlas(); mat.uniforms.uPanel.value = pan;
  const g = new THREE.Group();
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  scr.position.z = 0.02;
  g.add(scr);
  const S = { root: g, mesh: scr, mat, w, h, hp: 14, alert: 0, dead: 0, glow: [1.2, 0.7, 0.9] };
  S.update = (t) => { mat.uniforms.uT.value = t; mat.uniforms.uAlert.value = S.alert; mat.uniforms.uDead.value = S.dead; };
  return S;
}
