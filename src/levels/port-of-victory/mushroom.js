import * as THREE from 'three';

// =====================================================================================
//  Finale mushroom cloud as a few noise-displaced shells (5 draw calls): core fireball, stem,
//  rolling toroidal cap, cap dome, base skirt. The shells give the event one dominant,
//  readable silhouette; particles (setpieces.js) add soft edges, fire licks and smoke.
//  Fire cools into black-brown smoke over time; the underside keeps glowing orange.
// =====================================================================================
const VS = /* glsl */`
uniform float uTime, uDisp, uFreq, uRise, uRoll;
varying vec3 vN, vW; varying float vNoise; varying float vUp;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(3.1, 1.7, 5.3); a *= 0.5; } return s; }
vec3 field(vec3 p){
  // billows rise and roll outward (poloidal roll around the cap's tube)
  vec3 q = p * uFreq;
  float r = length(p.xz);
  q.y -= uTime * uRise;
  q.xz += normalize(p.xz + 1e-4) * uTime * uRoll;
  return q;
}
void main(){
  vec3 p = position;
  vec3 q = field(p);
  float n = fbm(q);
  // finite-difference noise gradient -> lumpy "cauliflower" normals
  float e = 0.18;
  float nx = fbm(q + vec3(e, 0.0, 0.0)), ny = fbm(q + vec3(0.0, e, 0.0)), nz = fbm(q + vec3(0.0, 0.0, e));
  vec3 grad = vec3(nx - n, ny - n, nz - n) / e;
  vec3 nrm = normalize(normal);
  float d = (n - 0.42) * uDisp;
  p += nrm * d;
  vec3 bn = normalize(nrm - grad * 0.55 * uDisp / max(uFreq, 0.1));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * bn);
  vNoise = n;
  vUp = nrm.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FS = /* glsl */`
uniform float uHeat, uGlow, uAlpha, uSoot, uTime;
uniform vec3 uSunDir, uSunCol, uSky, uGround;
varying vec3 vN, vW; varying float vNoise; varying float vUp;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 ramp(float h){
  vec3 c = mix(vec3(0.0), vec3(0.42, 0.04, 0.0), smoothstep(0.0, 0.25, h));
  c = mix(c, vec3(1.0, 0.3, 0.02), smoothstep(0.2, 0.55, h));
  c = mix(c, vec3(1.0, 0.62, 0.16), smoothstep(0.5, 0.85, h));
  c = mix(c, vec3(1.0, 0.86, 0.55), smoothstep(0.88, 1.0, h));
  return c;
}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float ndv = abs(dot(N, V));
  // world-space detail billows (~2-4 m) on top of the per-vertex lumps
  vec3 q = vW * 0.32 + vec3(0.0, -uTime * 0.7, 0.0);
  float dn = vnoise(q) * 0.62 + vnoise(q * 2.1 + 7.3) * 0.38;
  float n = clamp(vNoise * 0.6 + dn * 0.5 - 0.05, 0.0, 1.0);
  // soot: dark brown-black smoke lit by the sky dome, the low sun (rim) and the fire below
  float sky = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 amb = mix(uGround, uSky, sky);
  float sunL = max(dot(N, uSunDir), 0.0);
  float rim = pow(1.0 - ndv, 2.5) * (0.35 + 0.65 * max(dot(V, -uSunDir), 0.0));
  float cav = 0.45 + 0.9 * dn;                         // billow self-shadowing
  vec3 smokeAlb = mix(vec3(0.03, 0.025, 0.022), vec3(0.11, 0.085, 0.068), n);
  vec3 col = smokeAlb * cav * (amb * 1.15 + uSunCol * (sunL * 0.45 + rim * 1.1));
  // fire glow on the underside and deep in the folds
  float under = clamp(-N.y * 0.7 + 0.25, 0.0, 1.0);
  float folds = smoothstep(0.5, 0.2, dn);
  col += vec3(1.0, 0.28, 0.04) * uGlow * uGlow * (under * under * 0.7 + folds * 0.25) * (0.3 + 0.7 * n) * 0.5;
  // hot pockets: emission only where the noise peaks, scaled by the shell's heat
  float h = uHeat * smoothstep(0.42, 0.82, n + under * 0.12);
  col = mix(col, ramp(h) * 1.6, smoothstep(0.05, 0.45, h));
  float a = uAlpha * smoothstep(0.03, 0.4, ndv) * smoothstep(0.08, 0.28, n + 0.12);
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function shellMat(o) {
  return new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uTime: { value: 0 }, uDisp: { value: o.disp ?? 0.35 }, uFreq: { value: o.freq ?? 2.2 }, uRise: { value: o.rise ?? 0.5 }, uRoll: { value: o.roll ?? 0 },
      uHeat: { value: 1 }, uGlow: { value: 1 }, uAlpha: { value: 0 }, uSoot: { value: 0 },
      uSunDir: { value: new THREE.Vector3(-0.42, 0.12, -1).normalize() }, uSunCol: { value: new THREE.Color(1.0, 0.55, 0.42) },
      uSky: { value: new THREE.Color(0.16, 0.2, 0.34) }, uGround: { value: new THREE.Color(0.22, 0.12, 0.07) },
    },
  });
}

export class Mushroom {
  constructor(scene, P) {
    this.P = P.clone();
    this.root = new THREE.Group(); this.root.name = 'mushroom';
    this.root.position.copy(P);
    const mk = (geo, o) => { const m = new THREE.Mesh(geo, shellMat(o)); m.frustumCulled = false; m.renderOrder = 9; this.root.add(m); return m; };
    // unit shapes, scaled per frame
    this.core = mk(new THREE.IcosahedronGeometry(1, 5), { disp: 0.45, freq: 2.8, rise: 0.9 });
    const stemG = new THREE.CylinderGeometry(1, 1, 1, 28, 18, true); stemG.translate(0, 0.5, 0);
    { // taper: narrow waist, flaring into the cap
      const p = stemG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 0.75 + 0.25 * Math.cos(y * Math.PI * 1.6) + Math.max(0, y - 0.7) * 2.2; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } stemG.computeVertexNormals();
    }
    this.stem = mk(stemG, { disp: 0.4, freq: 3.4, rise: 1.4 });
    this.cap = mk(new THREE.TorusGeometry(1, 0.5, 26, 56).rotateX(Math.PI / 2), { disp: 0.42, freq: 3.4, rise: 0.35, roll: 0.5 });
    const domeG = new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.55);
    this.dome = mk(domeG, { disp: 0.4, freq: 3.2, rise: 0.25, roll: 0.3 });
    this.dome.material.side = THREE.DoubleSide; // seen from below through the torus hole: no blue window
    this.skirt = mk(new THREE.TorusGeometry(1, 0.35, 14, 48).rotateX(Math.PI / 2), { disp: 0.5, freq: 2.8, rise: 0.2, roll: 0.8 });
    this.parts = [this.core, this.stem, this.cap, this.dome, this.skirt];
    this.t = 0;
    scene.add(this.root);
    this.update(0);
  }
  // t: game seconds since the blast
  update(dt) {
    this.t += dt;
    const t = this.t;
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const tc = Math.min(t, 6) + Math.max(0, t - 6) * 0.15;
    const capH = 12 + Math.min(t, 4.5) * 5.2 + Math.max(0, t - 4.5) * 0.8, capR = 6 + Math.min(t, 4.5) * 3.3 + Math.max(0, t - 4.5) * 0.6;
    const cool = sm(0.25, 2.6, t), late = sm(6, 30, t);
    for (const m of this.parts) m.material.uniforms.uTime.value = t;
    // core fireball: punches up out of the hold, then becomes the stem's foot
    {
      const u = this.core.material.uniforms, r = 3 + sm(0, 0.5, t) * 9 - sm(1.2, 3.5, t) * 5;
      this.core.position.set(0, 2 + sm(0, 1.2, t) * 7, 0); this.core.scale.set(r, r * 0.9, r);
      u.uHeat.value = 1.1 - cool * 0.75; u.uGlow.value = 1.2 - cool * 0.7; u.uAlpha.value = sm(0, 0.06, t) * (1 - sm(3, 7, t) * 0.85); u.uSoot.value = cool;
    }
    // stem: a narrow column feeding the cap
    {
      const u = this.stem.material.uniforms, top = capH - 2, w = 2.6 + sm(0.2, 2, t) * 1.6 + late * 1.5;
      this.stem.position.set(0, 1, 0); this.stem.scale.set(w, Math.max(0.1, top * sm(0.15, 0.9, t)), w);
      u.uHeat.value = 0.95 - cool * 0.6; u.uGlow.value = 1.1 - cool * 0.55 - late * 0.3; u.uAlpha.value = sm(0.15, 0.4, t) * (1 - late * 0.55); u.uSoot.value = cool;
    }
    // cap torus: rises and rolls outward; the dome closes its top
    {
      const u = this.cap.material.uniforms, s = capR * sm(0.25, 1.0, t);
      this.cap.position.set(0, capH, 0); this.cap.scale.set(s, s * 0.95, s);
      u.uHeat.value = 0.95 - cool * 0.78; u.uGlow.value = 1.15 - cool * 0.75 - late * 0.2; u.uAlpha.value = sm(0.3, 0.7, t) * (1 - late * 0.6); u.uSoot.value = cool;
      const d = this.dome.material.uniforms, ds = capR * 1.08 * sm(0.35, 1.1, t);
      this.dome.position.set(0, capH + capR * 0.12, 0); this.dome.scale.set(ds, ds * 0.62, ds);
      d.uHeat.value = 0.5 - cool * 0.48; d.uGlow.value = 0.35 - cool * 0.25; d.uAlpha.value = sm(0.45, 0.9, t) * (1 - late * 0.35); // keeps the torus hole closed (no donut) d.uSoot.value = cool;
    }
    // base skirt: the ring of fire/smoke rolling across the deck
    {
      const u = this.skirt.material.uniforms, s = 5 + sm(0, 2.5, tc) * 14;
      this.skirt.position.set(0, 0.5, 0); this.skirt.scale.set(s, s * 0.55, s);
      u.uHeat.value = 0.7 - cool * 0.65; u.uGlow.value = 0.9 - cool * 0.6; u.uAlpha.value = sm(0.05, 0.4, t) * (1 - sm(2.5, 9, t)); u.uSoot.value = cool;
    }
    this.root.visible = t < 60;
  }
  setLight(sunDir, sunCol, sky, ground) {
    for (const m of this.parts) { const u = m.material.uniforms; if (sunDir) u.uSunDir.value.copy(sunDir); if (sunCol) u.uSunCol.value.copy(sunCol); if (sky) u.uSky.value.copy(sky); if (ground) u.uGround.value.copy(ground); }
  }
}
// warm-up: compile the shell program before gameplay (no hitch at the finale)
export function mushroomWarm() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), shellMat({})));
  return g;
}
