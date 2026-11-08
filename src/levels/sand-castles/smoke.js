// =====================================================================================
//  SMOKE — a new look for every dust / smoke puff in the level (the OverDust pool keeps its
//  instancing, sorting, budget and lighting rig; only the puff itself changes).
//  Before: each puff sampled a baked cauliflower atlas → round lobed balls ("cotton wool").
//  Now: each puff is a little noise VOLUME seen through a billboard:
//    - density = a soft sphere eroded by 2D fbm (sprite-local, seeded per puff, slowly
//      boiling), so silhouettes are ragged and wispy and neighbours melt together;
//    - self-shadowing: the density is sampled again a step toward the sun (screen space)
//      → lit shoulders on the sun side, dark sooty cores and undersides away from it;
//    - thin edges let the sun through (warm forward scatter), dense cores stay dark.
//  Cost: two 3-octave value-noise fbms per pixel (24 hashes). `&smoke=atlas` keeps the old
//  atlas shader for Quest A/B if the fill rate can't take it.
// =====================================================================================

export function installSmoke(material) {
  // a stable per-puff seed from its variant + where it was born (iPos drifts slowly: the noise boils with it)
  material.vertexShader = material.vertexShader
    .replace('varying vec2 vUv;', 'varying vec2 vUv; varying vec2 vSeed;')
    .replace('vCS = vec2(c, s);', 'vCS = vec2(c, s); vSeed = vec2(iP.w * 7.31, iP.w * 3.17) + iPos.xz * 0.004 + vec2(iPos.y * 0.002, 0.0);');
  material.uniforms.uT = { value: 0 };
  material.fragmentShader = FS_SMOKE;
  material.needsUpdate = true;
  return material.uniforms.uT;
}

const FS_SMOKE = /* glsl */`
uniform vec3 fogColor; uniform vec3 fogColorSun; uniform vec3 fogSunDir; uniform float fogNear; uniform float fogFar;
uniform float groundY; uniform float uDim; uniform float uDeckH; uniform float uT;
varying vec2 vUv; varying vec2 vSeed; varying vec4 vC; varying float vA; varying vec2 vCS; varying float vWorldY; varying float vFlip; varying vec2 vQ;
varying float vFogDepth; varying vec3 vFogViewPos;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ return vn(p) * 0.55 + vn(p * 2.13 + 7.1) * 0.3 + vn(p * 4.71 + 3.3) * 0.15; }
// density of the puff at sprite-local L (-1..1)
float dens(vec2 L){
  float n = fbm(L * 1.25 + vSeed + vec2(0.0, uT * 0.035));
  float r2 = dot(L, L);
  // big noise lobes eat into a soft sphere: ragged silhouettes, never a clean ball
  return clamp((1.0 - r2) * 1.15 + (n - 0.5) * 2.7 - 0.22, 0.0, 1.0);
}
void main(){
  // sprite-local coordinates (the quad rotates with the puff: undo it so the volume turns with it)
  vec2 L = vec2(vCS.x * vQ.x + vCS.y * vQ.y, -vCS.y * vQ.x + vCS.x * vQ.y);
  L.x *= vFlip;
  float d = dens(L);
  float al = pow(d, 1.35) * vA * smoothstep(groundY - 0.5, groundY + 2.0, vWorldY);
  if (al < 0.004) discard;
  // the sun in sprite space (screen-aligned billboard: the view-space xy of the sun direction)
  vec2 sS = fogSunDir.xy; float sl = length(sS); sS = sl > 1e-3 ? sS / sl : vec2(0.0, 1.0);
  vec2 sL = vec2(vCS.x * sS.x + vCS.y * sS.y, -vCS.y * sS.x + vCS.x * sS.y); sL.x *= vFlip;
  float dSun = dens(L + sL * 0.45);
  float light = exp(-dSun * 2.8);                       // how much sun reaches this point through the puff
  vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float up = clamp(dot(L, upV.xy) * 0.5 + 0.5, 0.0, 1.0); // skylit tops, darker undersides
  vec3 V = normalize(vFogViewPos);
  float toward = pow(max(dot(V, fogSunDir), 0.0), 4.0);
  vec3 base = vC.rgb;
  // deck: brightness follows world height between the ground and the top of the dust layer
  float deck = clamp((vWorldY - groundY) / uDeckH, 0.0, 1.0);
  float deckK = mix(0.5, 1.05, deck * deck * (3.0 - 2.0 * deck));
  vec3 shadowC = base * vec3(0.3, 0.3, 0.35) * (0.5 + 0.5 * up);          // cool, sooty core
  vec3 litC = base * (0.75 + 0.25 * up) + base * fogColorSun * 0.5 * light;  // warm sunlit shoulder
  vec3 col = mix(shadowC, litC, light) * deckK;
  // thin edges let the sun through (forward scatter when you look toward it)
  col += fogColorSun * (base + 0.05) * (1.0 - d) * toward * 0.35;
  // fire glow from below (burning columns): stronger in the dense, unlit core
  col += vec3(1.5, 0.58, 0.2) * vC.a * (1.0 - up) * (1.0 - up) * (0.4 + 0.6 * d);
  col *= 1.0 - 0.4 * uDim;
  float f = smoothstep(fogNear, fogFar, vFogDepth); f = 1.0 - (1.0 - f) * (1.0 - f);
  float fs = max(dot(V, fogSunDir), 0.0);
  col = mix(col, mix(fogColor, fogColorSun, pow(fs, 3.0)), f);
  gl_FragColor = vec4(col * al, al);
  #include <tonemapping_fragment>
  #include <bay_premul_colorspace>
}`;
