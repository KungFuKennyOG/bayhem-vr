import * as THREE from 'three';
import { fogShared } from '../../atmosphere.js';
import { WATER_Y, LOW_Y, RIVER, LOWQ, BRIDGE } from './layout.js';

// =====================================================================================
//  Wet-street / river light smears: every lamp (and the tower's gold body) lays a soft additive
//  streak on the plane under it. ONE instanced draw for all of them, no per-pixel light loops.
//
//  Geometry is view-dependent and solved per vertex from cameraPosition (so it is right per eye in
//  VR): a light at height hl over its plane, seen from hc over the same plane, mirrors at ground
//  distance  dm = D·hc/(hc+hl)  from the eye, on the line eye→light foot. A wet / rippled surface
//  smears that mirror point into a glossy lobe in *angle* (depression below the horizon): the
//  streak spans the depression angles θm ± δ (δ larger toward the horizon, much larger on water),
//  clamped to the light's foot. On screen that is the classic vertical column dropping from under
//  the lamp toward the viewer. Brightness = colour × intensity × Fresnel(θm) × lobe profile; the
//  Fresnel term makes high lights (steep reflection) dimmer, the lobe makes near lights compact.
//  Fragment break-up lives in angle space (stable on screen, no aliasing with distance):
//  water → a shimmering column of horizontal dashes with a wobbling centre line; wet stone →
//  a subtle rain-pocked grain. Fog-faded (scene fog curve), depthWrite off, additive, graded
//  like everything else (minus the grade's black lift so big quads don't grey the frame).
//  A level mask (layout.js numbers) discards streak pixels that would hang over a surface that
//  doesn't exist at that height (e.g. a street-level streak over the river).
// =====================================================================================

const FLAG_WATER = 1, FLAG_NOMASK = 2;

const VERT = /* glsl */`
attribute vec4 iP;   // light xyz, intensity
attribute vec4 iC;   // rgb, width (m)
attribute vec4 iD;   // len (m), plane y, flags, seed
uniform float uTime;
varying vec3 vW;
varying vec3 vCol;
varying vec4 vAx;    // camera ground xz, axis dir xz
varying vec4 vK;     // hc, θm, δnear, δfar
varying vec4 vS;     // half width, water, seed, fresnel·intensity
varying vec2 vEnds;  // near / far ground distance
varying float vMask;
varying vec3 vFogViewPos;
void main() {
  float flags = iD.z;
  float water = mod(flags, 2.0);
  float g = iD.y + 0.01;
  float hc = cameraPosition.y - g;
  float hl = iP.y - g;
  vec2 toL = iP.xz - cameraPosition.xz;
  float D = length(toL);
  if (iP.w <= 0.001 || hc < 0.08 || hl < 0.05 || D < 0.6) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 dir = toL / D, perp = vec2(-dir.y, dir.x);
  float thm = atan(hc + hl, D);                       // depression of the mirrored light
  // glossy lobe in angle: ripples on water spread it a lot, wet stone less; the lobe stretches toward
  // the horizon (that's what makes the streak a column instead of a blob)
  float sg = (water > 0.5 ? 0.15 : 0.065) * mix(1.0, 1.5, smoothstep(0.5, 0.05, thm));
  // water: ripple facets smear tall lights all the way toward the horizon (lobe ∝ mirror angle)
  float dn = sg, df = water > 0.5 ? sg * 0.6 + thm * 0.75 : sg * 1.15;
  float dNear = hc / tan(min(thm + dn * 2.2, 1.52));
  float dFar = hc / tan(max(thm - df * 2.2, 0.0025));
  float dm = D * hc / (hc + hl);
  dFar = min(dFar, D + (water > 0.5 ? 0.6 : 0.25));    // never past the light's foot
  float L = iD.x * (water > 0.5 ? 2.0 : 1.4);         // anchor len caps the smear (metres)
  dNear = max(dNear, max(0.25, water > 0.5 ? dm * 0.12 : dm - L * 0.8));
  dFar = min(dFar, dm + L);
  if (dFar <= dNear + 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float hw = iC.w * 0.5 * (water > 0.5 ? 0.8 : 0.75);
  // quad: position.x = -1..1 across, position.y = 0..1 near → far
  float d = mix(dNear, dFar, position.y);
  // constant *angular* half-width (a straight column on screen, not a wedge): the source's size seen
  // between its mirror point and itself, plus the sideways ripple spread
  float ang = hw / mix(max(dm, 0.3), D, 0.5) + (water > 0.5 ? 0.008 : 0.004);
  vec2 xz = cameraPosition.xz + dir * d + perp * position.x * ang * d * 1.6;
  vW = vec3(xz.x, g, xz.y);
  // Fresnel at the mirror angle (water ~ dielectric; wet stone a bit duller)
  float c = sin(thm);
  float F = 0.02 + 0.98 * pow(1.0 - c, 5.0);
  F = water > 0.5 ? min(1.0, F * 1.2 + 0.03) : min(1.0, F + 0.03);
  // broad floodlit sources (the tower: width > 3 m) light whole ripple fields, not single facets
  F = max(F, smoothstep(3.0, 10.0, iC.w) * 0.32);
  vCol = iC.rgb;
  vAx = vec4(cameraPosition.xz, dir);
  vK = vec4(hc, thm, dn, df);
  vS = vec4(ang, water, iD.w, F * iP.w / (1.0 + D / 600.0));
  vEnds = vec2(dNear, dFar);
  vMask = mod(floor(flags / 2.0), 2.0) > 0.5 ? 0.0 : 1.0;
  vec4 mv = viewMatrix * vec4(vW, 1.0);
  vFogViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform float uTime;
uniform float uGain;
uniform vec3 fogColor;
uniform float fogNear, fogFar;
varying vec3 vW;
varying vec3 vCol;
varying vec4 vAx;
varying vec4 vK;
varying vec4 vS;
varying vec2 vEnds;
varying float vMask;
varying vec3 vFogViewPos;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
// the surface that really exists at this height (layout.js: river, lower quays, street + bridge deck)
float surfaceY(vec2 p) {
  float az = abs(p.y);
  if (abs(p.x) < ${BRIDGE.half.toFixed(1)} && az < ${BRIDGE.z1.toFixed(1)}) return 0.0;
  if (az < ${RIVER.z1.toFixed(1)}) return ${WATER_Y.toFixed(2)};
  if (az < ${LOWQ.wall.toFixed(1)}) return ${LOW_Y.toFixed(2)};
  return 0.0;
}
void main() {
  if (vMask > 0.5) {
    float sy = surfaceY(vW.xz);
    if (vS.y > 0.5) { if (abs(vW.z) > ${RIVER.z1.toFixed(1)} - 0.15) discard; }   // water: only between the quay walls
    else if (abs(sy - vW.y) > 0.6) discard;
  }
  vec2 rel = vW.xz - vAx.xy;
  float d = dot(rel, vAx.zw);
  float lat = dot(rel, vec2(-vAx.w, vAx.z));
  float hc = vK.x, thm = vK.y;
  float th = atan(hc, max(d, 0.01));
  float u = th - thm;                                  // > 0: nearer the eye than the mirror point
  float s = u > 0.0 ? u / vK.z : u / vK.w;
  float along = exp(-s * s * 0.5) * (0.35 + 0.65 * exp(-abs(s) * 1.5));   // peaked core + soft skirt
  along *= smoothstep(vEnds.x, vEnds.x + (vEnds.y - vEnds.x) * 0.12 + 0.05, d) * (1.0 - smoothstep(vEnds.y - (vEnds.y - vEnds.x) * 0.2 - 0.05, vEnds.y, d));
  float t = uTime, seed = vS.z;
  float water = vS.y;
  float hw = vS.x * max(d, 0.05);
  float shimmer;
  float a;
  if (water > 0.5) {
    // angle-space dashes: horizontal bands of ripple facets catching the light, drifting toward the eye
    float k = th * 160.0;
    float wob = (vn(vec2(k * 0.22 + t * 0.9, seed * 7.0)) - 0.5) * 0.9 + (vn(vec2(k * 0.9 - t * 2.1, seed * 3.0 + 5.0)) - 0.5) * 0.45;
    a = lat / hw + wob * mix(0.35, 0.9, smoothstep(0.0, 0.3, abs(s)));
    float n1 = vn(vec2(k + t * 2.6, seed * 11.0 + lat * 0.35));
    float n2 = vn(vec2(k * 2.3 - t * 3.7, seed * 5.0 + lat * 0.9));
    shimmer = pow(smoothstep(0.42, 0.85, n1 * 0.62 + n2 * 0.48), 1.5) * 2.2;
    // the core of the column stays more continuous; the flanks break up into flecks
    shimmer = mix(shimmer, 0.8, 0.2 * exp(-a * a * 8.0) * exp(-s * s));
  } else {
    // wet stone: soft column with a fine pocked grain (rain), barely moving
    a = lat / hw + (vn(vec2(th * 90.0, seed * 9.0)) - 0.5) * 0.25;
    float g1 = vn(vW.xz * 5.5 + seed * 17.0), g2 = vn(vW.xz * 13.0 - seed * 3.0 + t * 0.15);
    shimmer = 0.72 + 0.4 * g1 + 0.25 * smoothstep(0.65, 0.95, g2);
  }
  float across = exp(-a * a * (water > 0.5 ? 2.6 : 2.2)) * (1.0 - smoothstep(0.9, 1.55, abs(a)));
  vec3 hdr = vCol * vS.w * uGain * along * across * shimmer * (water > 0.5 ? 0.2 : 0.3);
  // fog: same curve as the global fog chunk; additive light just fades into the haze
  float fogK = smoothstep(fogNear, fogFar, length(vFogViewPos));
  fogK = 1.0 - (1.0 - fogK) * (1.0 - fogK);
  hdr *= 1.0 - fogK * 0.92;
  hdr = min(hdr, vec3(3.0));
  vec3 c = hdr;
  #ifdef TONE_MAPPING
    c = toneMapping(c);
  #endif
  c = linearToOutputTexel(vec4(c, 1.0)).rgb;
  #ifdef TONE_MAPPING
    c = max(bayGrade(c) - bayGrade(vec3(0.0)), 0.0);   // graded, minus the black lift (it's additive)
  #endif
  gl_FragColor = vec4(c, 1.0);
}`;

export class Reflections {
  constructor(scene, { max = 256, fog = scene?.fog } = {}) {
    this.max = max;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    g.setIndex([0, 2, 1, 0, 3, 2]);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aD = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', this.aP); g.setAttribute('iC', this.aC); g.setAttribute('iD', this.aD);
    g.instanceCount = 0;
    this.geometry = g;
    this.fog = fog || { color: new THREE.Color(0.15, 0.1, 0.1), near: 60, far: 1500 };
    this.uniforms = {
      uTime: { value: 0 }, uGain: { value: 1 },
      fogColor: { value: this.fog.color }, fogNear: { value: this.fog.near }, fogFar: { value: this.fog.far },
      fogColorSun: { value: fogShared.sunColor }, fogSunDir: { value: fogShared.sunDirView },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, side: THREE.DoubleSide,
    });
    this.material.name = 'wetReflections';
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;          // after the water (-5) and opaque ground, before glows (19) / particles
    this.mesh.name = 'reflections';
    if (scene) scene.add(this.mesh);
    this.free = [];
    this.high = 0;
    this.dirty = true;
    this.time = 0;
    this.count = 0;
  }
  // { p:[x,y,z] light, color:[r,g,b], len, width, ground: plane y, water?: bool, intensity?, mask?: false }
  add(o) {
    let i;
    if (this.free.length) i = this.free.pop();
    else { if (this.high >= this.max) return -1; i = this.high++; }
    const p = o.p.isVector3 ? o.p.toArray() : o.p, c = o.color || [2.4, 1.4, 0.6];
    const ground = o.ground ?? 0;
    const water = o.water ?? Math.abs(ground - WATER_Y) < 0.3;
    const flags = (water ? FLAG_WATER : 0) + (o.mask === false ? FLAG_NOMASK : 0);
    this.aP.array.set([p[0], p[1], p[2], o.intensity ?? 1], i * 4);
    this.aC.array.set([c[0], c[1], c[2], o.width ?? 1.2], i * 4);
    this.aD.array.set([o.len ?? 9, ground, flags, (i * 0.618034) % 1 * 97.0], i * 4);
    this.dirty = true; this.count++;
    return i;
  }
  set(h, { p, color, intensity } = {}) {
    if (h == null || h < 0 || h >= this.high) return;
    const P = this.aP.array, C = this.aC.array, k = h * 4;
    if (p) { const q = p.isVector3 ? p.toArray() : p; P[k] = q[0]; P[k + 1] = q[1]; P[k + 2] = q[2]; }
    if (color) { C[k] = color[0]; C[k + 1] = color[1]; C[k + 2] = color[2]; }
    if (intensity !== undefined) P[k + 3] = intensity;
    this.dirty = true;
  }
  remove(h) {
    if (h == null || h < 0 || h >= this.high) return;
    this.aP.array[h * 4 + 3] = 0;
    this.free.push(h); this.count--;
    this.dirty = true;
  }
  // camPos is unused by the GPU path (each eye uses its own cameraPosition); kept for API symmetry
  update(dt = 0, camPos) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    this.uniforms.fogNear.value = this.fog.near; this.uniforms.fogFar.value = this.fog.far;
    if (this.dirty) {
      for (const a of [this.aP, this.aC, this.aD]) { a.clearUpdateRanges(); a.addUpdateRange(0, this.high * 4); a.needsUpdate = true; }
      this.geometry.instanceCount = this.high;
      this.dirty = false;
    }
    void camPos;
  }
  get info() { return { draws: 1, instances: this.high, live: this.count, tris: this.high * 2 }; }
}
