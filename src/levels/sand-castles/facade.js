import * as THREE from 'three';
import { SUN_DIR } from '../../atmosphere.js';

// =====================================================================================
//  FACADES — one shader for every tower surface in Al-Sarab: the merged static city, the
//  falling mid towers (vertex rig), the hero's chunks and the far skyline (instanced).
//  Geometry carries facade coordinates, not textures:
//    aF = (u along the facade in metres, v = height in metres, kind)   (helipads: local x, z)
//    aS = (style 0..7, seed, floor height, tower index)
//  kind: 0 curtain wall, 1 punched / clad wall, 2 roof, 3 mechanical, 4 crown fins (+ LED band),
//        5 helipad, 6 pool water, 7 pool deck, 8 podium, 9 ruin / torn edge (soot)
//  Everything that would shimmer at 300 m (mullions, pane hash, floor lines) fades to its
//  average by the screen-space footprint (fwidth), so the city never moirés in the headset.
//  City-wide sun shadows: a 2.5D march over a tower height map (one byte = 3 m), as in Level 6.
// =====================================================================================

export const FAC = {
  uNight: { value: 0 },       // 0 afternoon .. 1 dusk: lit windows, crown LEDs
  uDust: { value: 0 },        // sandstorm: dust settles on everything (albedo -> sand, rougher)
  uTime: { value: 0 },
  // sun shadows
  tSunH: { value: null },
  uSunHB: { value: new THREE.Vector4(-4000, -4000, 1 / 8000, 1 / 8000) },
  uSunL: { value: new THREE.Vector3(0, 1, 0) },
  uShadow: { value: 1 },
  // ruin swap: per-tower ruin height (metres) in a float texture row (static city only)
  tRuin: { value: null }, uRuinN: { value: 1 },
  // the haboob's shadow on the city ahead of it: (front z, strength)
  uStormF: { value: new THREE.Vector2(1e6, 0) },
};

export const FAC_GLSL = /* glsl */`
uniform float uNight; uniform float uDust; uniform float uTime;
uniform sampler2D tSunH; uniform vec4 uSunHB; uniform vec3 uSunL; uniform float uShadow; uniform vec2 uStormF;
varying vec3 vF; varying vec4 vS; varying vec3 vWP; varying float vRuin;
float fh1(float n){ return fract(sin(n) * 43758.5453); }
float fh2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fh2(i), fh2(i + vec2(1.0, 0.0)), f.x), mix(fh2(i + vec2(0.0, 1.0)), fh2(i + vec2(1.0, 1.0)), f.x), f.y); }
// thin line at the edges of a unit cell, anti-aliased by its footprint w (in cell units)
float edgeLine(float x, float t, float w){ float d = min(x, 1.0 - x); return 1.0 - smoothstep(t - w, t + w, d); }
// under the haboob (and the shadow it throws ahead of itself): darker, desaturated, browner
vec3 stormShade(vec3 c, vec3 wp){
  float s = smoothstep(uStormF.x - 700.0, uStormF.x + 60.0, wp.z) * uStormF.y;
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  return mix(c, vec3(l) * vec3(1.08, 0.94, 0.76), 0.55 * s) * (1.0 - 0.55 * s);
}
float sunVis(vec3 p, vec3 n){
  if (uShadow < 0.5 || dot(n, uSunL) <= 0.0) return 1.0;
  float hl = max(length(uSunL.xz), 1e-3);
  vec2 dxz = uSunL.xz / hl; float tanE = uSunL.y / hl;
  vec3 o = p + n * 3.0 + vec3(0.0, 0.5, 0.0);
  float vis = 1.0, t = 2.0;
  for (int i = 0; i < 18; i++) {
    vec2 q = o.xz + dxz * t;
    float h = texture2D(tSunH, (q - uSunHB.xy) * uSunHB.zw).r * 765.0;
    // the penumbra widens with distance to the occluder (a 3 m height map gave razor edges that read as stains)
    vis = min(vis, clamp((o.y + t * tanE - h) * 0.12 / (1.0 + t * 0.035) + 0.5, 0.0, 1.0));
    t = t * 1.32 + 3.0;
  }
  return vis;
}
`;

// albedo / roughness / metalness / emission for one fragment
const SURFACE = /* glsl */`
struct Fac { vec3 c; float r; float m; vec3 e; float ao; };
vec3 glassTint(float st){
  return st < 0.5 ? vec3(0.07, 0.15, 0.17) : st < 1.5 ? vec3(0.19, 0.21, 0.23) : st < 2.5 ? vec3(0.16, 0.11, 0.055)
       : st < 3.5 ? vec3(0.05, 0.07, 0.08) : st < 4.5 ? vec3(0.06, 0.09, 0.11) : st < 5.5 ? vec3(0.045, 0.05, 0.06)
       : st < 6.5 ? vec3(0.05, 0.14, 0.15) : vec3(0.06, 0.08, 0.08);
}
vec3 cladTint(float st, float seed){
  vec3 a = st < 3.5 ? vec3(0.66, 0.55, 0.41) : st < 4.5 ? vec3(0.74, 0.72, 0.68) : st < 5.5 ? vec3(0.78, 0.77, 0.74) : st < 6.5 ? vec3(0.8, 0.8, 0.78) : vec3(0.7, 0.6, 0.46);
  return a * (0.88 + 0.2 * seed);
}
Fac facade(vec3 F, vec4 S, vec3 wp){
  Fac o; o.e = vec3(0.0); o.ao = 1.0;
  float kind = floor(F.z + 0.5), st = floor(S.x + 0.5), seed = S.y, fhgt = max(2.5, S.z);
  float u = F.x, v = F.y;
  // screen footprint of the pattern (fade fine detail to its average past ~1 px per cell)
  float du = max(fwidth(u), 1e-4), dv = max(fwidth(v), 1e-4);
  if (kind < 1.5) {
    // ---------------------------------------------------------------- walls
    float bw = st < 1.5 ? 1.8 : st < 2.5 ? 1.6 : st == 3.0 ? 2.4 : st == 7.0 ? 3.0 : 2.0;
    float bi = floor(u / bw), bx = fract(u / bw);
    float fl = floor(v / fhgt), fy = fract(v / fhgt);
    float wU = du / bw, wV = dv / fhgt;
    float fine = clamp(1.0 - max(wU, wV) * 2.6, 0.0, 1.0);           // 1 = cells resolved, 0 = sub-pixel
    float pane = 0.1 * fh2(vec2(bi + seed * 91.0, fl * 1.7 + seed * 13.0)) + 0.9 * fvn(vec2(u * 0.035, v * 0.02) + seed * 9.0);
    vec3 gt = glassTint(st) * (0.75 + 0.5 * seed) * mix(vec3(1.0), vec3(1.08, 0.98, 0.9), fh1(seed * 77.0));
    // palette: a quarter less saturated, and a per-tower family (cool / bronze / smoked / neutral) so a row of
    // towers isn't three colours repeated
    { float fam = fh1(seed * 31.0 + 5.0);
      gt = mix(gt, vec3(dot(gt, vec3(0.33))), 0.25);
      gt *= fam < 0.25 ? vec3(0.9, 1.0, 1.12) : fam < 0.5 ? vec3(1.12, 1.0, 0.85) : fam < 0.75 ? vec3(0.78) : vec3(1.0); }
    // spandrel band (floor slab) and mullion lines
    float span = st == 1.0 || st == 6.0 ? 0.1 : st == 4.0 ? 0.42 : st == 2.0 ? 0.16 : 0.24;
    float spand = smoothstep(span + wV, span - wV, fy);
    float mull = edgeLine(bx, st == 2.0 || st == 5.0 ? 0.09 : 0.035, wU);
    float sill = edgeLine(fy, 0.02, wV);
    if (st == 3.0 || st == 7.0 || kind > 0.5) {
      // clad residential: stone wall with punched windows (+ balconies on style 3, arches on 7)
      vec3 clad = cladTint(st, seed);
      // style 3: balcony ribbons (wide glazing behind white slab edges, a fin every third bay);
      // 7: stone with arched windows; clad kinds: punched windows
      bool ribbon = st == 3.0;
      float wx = ribbon ? smoothstep(0.03 - wU, 0.03 + wU, bx) * smoothstep(0.97 + wU, 0.97 - wU, bx) * (1.0 - edgeLine(fract(bi / 3.0), 0.04, wU / 3.0))
                        : smoothstep(0.18 - wU, 0.18 + wU, bx) * smoothstep(0.82 + wU, 0.82 - wU, bx);
      float wy = ribbon ? smoothstep(0.24 - wV, 0.24 + wV, fy) * smoothstep(0.97 + wV, 0.97 - wV, fy)
                        : smoothstep(0.2 - wV, 0.2 + wV, fy) * smoothstep(0.86 + wV, 0.86 - wV, fy);
      if (st == 7.0) { vec2 q = vec2((bx - 0.5) / 0.32, (fy - 0.86) / 0.22); wy *= step(length(max(q, vec2(-9.0, 0.0))), 1.0 + wV * 4.0); }
      float win = wx * wy;
      vec3 glass = gt * (0.7 + 0.6 * pane);
      // balcony slab shadow under each floor on style 3
      // the slab edge is bright; the glazing just under the next slab sits in its shadow
      float bal = ribbon ? smoothstep(0.86 - wV, 0.97, fy) * 0.5 : 0.0;
      vec3 slab = ribbon ? vec3(0.78, 0.77, 0.74) : clad;
      vec3 c = mix(slab, glass * (1.0 - bal) * 0.85, win);
      float avg = ribbon ? 0.62 : 0.38;
      o.c = mix(mix(slab, gt, avg) * 0.92, c, fine);
      o.r = mix(0.75, mix(0.8, 0.12 + 0.12 * pane, win), fine);
      o.m = mix(0.2, mix(0.0, 0.75, win), fine);
      // lit windows at dusk
      float lit = step(0.8, fh2(vec2(floor(bi / 3.0) * 3.1 + seed, fl * 1.3))) * win * uNight;
      o.e = vec3(1.0, 0.62, 0.3) * lit * (0.6 + 0.5 * pane) * 0.55 * fine + vec3(0.9, 0.55, 0.28) * uNight * 0.03 * (1.0 - fine);
    } else {
      // curtain wall
      vec3 frameC = st == 5.0 ? vec3(0.72, 0.72, 0.7) : st == 2.0 ? vec3(0.32, 0.24, 0.12) : vec3(0.2, 0.21, 0.22);
      vec3 spandC = st == 4.0 ? vec3(0.7, 0.68, 0.64) : gt * 0.55 + vec3(0.03);
      // interior: blinds / dark rooms / lit core per pane
      float blind = step(0.82, pane) * 0.6;
      vec3 glass = gt * (0.92 + 0.3 * pane) + vec3(0.05, 0.045, 0.04) * blind;
      glass *= 1.0 - 0.25 * smoothstep(0.55, 0.8, fvn(vec2(u * 0.05, v * 0.03) + seed * 21.0));  // dark rooms, in soft clusters
      vec3 c = glass;
      c = mix(c, spandC, spand);
      c = mix(c, frameC, max(mull, sill * 0.6));
      // style 6: diagrid
      if (st == 6.0) { float dg = edgeLine(fract((u + v) / 9.0), 0.04, (du + dv) / 9.0) + edgeLine(fract((u - v) / 9.0), 0.04, (du + dv) / 9.0); c = mix(c, vec3(0.75), clamp(dg, 0.0, 1.0)); }
      vec3 avgC = mix(glass, spandC, span) * 0.85 + frameC * 0.08;
      o.c = mix(avgC, c, fine);
      float gr = 0.07 + 0.1 * pane + 0.25 * blind;
      o.r = mix(0.2, mix(gr, 0.55, max(spand, mull)), fine);
      o.m = mix(0.45, mix(0.55, 0.35, max(spand, mull)), fine);
      float lit = step(0.84, fh2(vec2(floor(bi / 5.0) * 1.7 + seed * 5.0, fl))) * (1.0 - spand) * uNight;
      o.e = vec3(1.0, 0.7, 0.42) * lit * (0.5 + 0.4 * pane) * 0.45 * fine + vec3(0.9, 0.6, 0.35) * uNight * 0.025 * (1.0 - fine);
    }
    // mechanical floors every ~16 storeys (louvres): the band that tells you a tower is 300 m tall
    float mf = fract(v / (fhgt * 16.0) + seed * 0.37);
    float mband = smoothstep(0.0, 0.004 + wV * 0.06, mf) * smoothstep(0.065 + wV * 0.06, 0.06, mf);
    float louv = 0.75 + 0.25 * edgeLine(fract(v / 0.5), 0.3, dv / 0.5) * fine;
    o.c = mix(o.c, vec3(0.2, 0.2, 0.21) * louv, mband * 0.9);
    o.r = mix(o.r, 0.55, mband); o.m = mix(o.m, 0.5, mband); o.e *= 1.0 - mband;
    // weathering: rain / dust streaks under the ledges, a dirtier, darker lower third, sand at the base
    float streak = fvn(vec2(u * 0.6 + seed * 40.0, v * 0.012)) * fvn(vec2(u * 0.13, v * 0.05 + seed));
    o.c *= 1.0 - (kind > 0.5 || st == 3.0 || st == 7.0 ? 0.32 : 0.12) * streak;
    o.c *= mix(0.68, 1.0, smoothstep(0.0, 90.0, v));
    o.c = mix(o.c, vec3(0.5, 0.41, 0.3), 0.22 * (1.0 - smoothstep(0.0, 25.0, v)));
    o.r = mix(o.r, 0.8, 0.35 * streak);
    // the Spire (S.w = -1): dark vertical mullion fins and heavier grime down its face
    if (S.w < -0.5) {
      // the Spire: a champagne mirror curtain wall between bright mullion fins: it reflects the sunset sky
      // (metal F0 tint + low roughness), so it is the one tower that glows warm against the dusk
      float fin = edgeLine(fract(u / 10.5), 0.06, du / 10.5);
      // (no pane / floor checkerboard: one continuous mirror skin, so it reads as a single supertall surface)
      o.c = mix(vec3(0.62, 0.5, 0.36) * (0.92 + 0.12 * fvn(vec2(u * 0.02, v * 0.004) + seed)), vec3(0.72, 0.7, 0.66), fin);
      o.m = mix(0.92, 0.6, fin); o.r = mix(0.12, 0.35, fin);
      o.c *= 1.0 - 0.12 * fvn(vec2(u * 0.35, v * 0.01 + seed * 9.0));
    }
  } else if (kind < 2.5) {
    // roof: concrete / gravel with expansion joints and stains
    float n = fvn(wp.xz * 0.15) * 0.6 + fvn(wp.xz * 0.9) * 0.4;
    float jt = max(edgeLine(fract(wp.x / 6.0), 0.02, du / 6.0), edgeLine(fract(wp.z / 6.0), 0.02, du / 6.0));
    o.c = vec3(0.25, 0.235, 0.215) * (0.7 + 0.45 * n) * (1.0 - 0.25 * jt) * mix(0.75, 1.0, fvn(wp.xz * 0.04 + 3.0));
    // contact shadow where a roof / podium deck meets a taller wall (the height map a few metres out)
    vec2 hb = (wp.xz - uSunHB.xy) * uSunHB.zw; float hx = 7.0 * uSunHB.z;
    float hm = max(max(texture2D(tSunH, hb + vec2(hx, 0.0)).r, texture2D(tSunH, hb - vec2(hx, 0.0)).r), max(texture2D(tSunH, hb + vec2(0.0, hx)).r, texture2D(tSunH, hb - vec2(0.0, hx)).r)) * 765.0;
    o.c *= 1.0 - 0.45 * smoothstep(4.0, 24.0, hm - wp.y);
    o.ao = 1.0 - 0.5 * smoothstep(4.0, 24.0, hm - wp.y);
    o.r = 0.9; o.m = 0.0;
  } else if (kind < 3.5) {
    // mechanical: louvred metal
    float lv = edgeLine(fract(v / 0.6), 0.25, dv / 0.6);
    o.c = vec3(0.36, 0.37, 0.38) * (1.0 - 0.3 * lv * clamp(1.0 - dv * 3.0, 0.0, 1.0)) * (0.9 + 0.2 * seed);
    o.r = 0.55; o.m = 0.55;
  } else if (kind < 4.5) {
    // crown fins: brushed metal; an LED line near the top that comes on at dusk
    o.c = vec3(0.11, 0.11, 0.115) * (0.8 + 0.3 * seed); o.r = 0.6; o.m = 0.5;
    float led = edgeLine(fract(v / 9.0), 0.03, dv / 9.0) * clamp(1.0 - dv * 0.5, 0.0, 1.0);
    o.e = vec3(1.0, 0.62, 0.3) * led * uNight * 1.2;
  } else if (kind < 5.5) {
    // helipad: dark pad, yellow perimeter, white circle, the H
    float r = length(F.xy);
    vec3 c = vec3(0.12, 0.135, 0.13);
    float aa = max(du, 0.05) * 1.5;
    c = mix(c, vec3(0.85, 0.66, 0.12), smoothstep(12.6 - aa, 12.6 + aa, r));
    c = mix(c, vec3(0.86), smoothstep(aa, 0.0, abs(r - 9.5) - 0.45));
    vec2 q = abs(F.xy);
    float H = max(step(q.x, 4.2) * step(2.9, q.x) * step(q.y, 5.5), step(q.x, 3.0) * step(q.y, 0.65));
    c = mix(c, vec3(0.9), H);
    o.c = c; o.r = 0.8; o.m = 0.0;
  } else if (kind < 6.5) {
    // pool water: turquoise, faint caustic ripples, a little glow at dusk
    float n = fvn(wp.xz * 0.7 + uTime * 0.4) * 0.5 + fvn(wp.xz * 1.3 - uTime * 0.3) * 0.5;
    o.c = vec3(0.02, 0.28, 0.33) * (0.75 + 0.5 * n); o.r = 0.04; o.m = 0.2;
    o.e = vec3(0.05, 0.35, 0.45) * (0.12 + 0.6 * uNight) * (0.7 + 0.6 * n);
  } else if (kind < 7.5) {
    // pool deck: pale stone tiles, loungers as dark stripes
    float tl = max(edgeLine(fract(wp.x / 1.2), 0.04, du / 1.2), edgeLine(fract(wp.z / 1.2), 0.04, du / 1.2));
    o.c = vec3(0.68, 0.6, 0.5) * (1.0 - 0.15 * tl); o.r = 0.75; o.m = 0.0;
  } else if (kind < 8.5) {
    // podium: stone with a dark shopfront band at street level
    float shop = step(v, 6.0);
    float bx = fract(u / 5.0);
    o.c = mix(vec3(0.17, 0.155, 0.135) * (0.85 + 0.25 * seed) * mix(0.7, 1.0, smoothstep(0.0, 14.0, v)) * (0.85 + 0.25 * fvn(wp.xz * 0.2)), vec3(0.05, 0.07, 0.08) + vec3(0.04) * edgeLine(bx, 0.03, du / 5.0), shop);
    // (dull glass: a mirror shopfront band reflected the bright sky as a white line round every tower base)
    o.r = mix(0.8, 0.5, shop); o.m = mix(0.0, 0.25, shop);
    o.e = vec3(1.0, 0.62, 0.32) * shop * uNight * 0.22 * step(0.45, fract(u / 23.0 + seed));
  } else {
    // ruin / torn floors: concrete, rebar, soot
    float n = fvn(wp.xz * 0.3 + wp.y * 0.2);
    o.c = vec3(0.24, 0.22, 0.2) * (0.6 + 0.6 * n); o.r = 0.95; o.m = 0.0; o.ao = 0.7;
  }
  // the storm leaves a coat of sand on everything facing up
  o.c = mix(o.c, vec3(0.6, 0.48, 0.34), uDust * 0.35);
  o.r = mix(o.r, 0.9, uDust * 0.4);
  // every building is dirtier near the street: darker, sand-blown base (no spotless plinths)
  float baseK = 1.0 - smoothstep(0.0, 36.0, wp.y);
  o.c = mix(o.c * (1.0 - 0.3 * baseK), vec3(0.42, 0.34, 0.24) * 0.6, 0.22 * baseK);
  o.c = stormShade(o.c, wp);
  return o;
}
`;

// patch a MeshStandardMaterial. opts.vertex: extra GLSL replacing how `transformed` is built (rig / ruin);
// opts.inst: instanced unit boxes (facade coords from the instance's scale + aOrg)
export function patchFacade(mat, opts = {}) {
  const key = 'fac' + (opts.key || '') + (opts.inst ? 'I' : '');
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, FAC, opts.uniforms || {});
    let vs = sh.vertexShader;
    vs = vs.replace('#include <common>', `#include <common>\n${FAC_GLSL}\n${opts.inst ? 'attribute vec4 aOrg; attribute vec4 aSt;' : 'attribute vec3 aF; attribute vec4 aS;'}\n${opts.vertexHead || ''}`);
    if (opts.vertexBegin) vs = vs.replace('#include <beginnormal_vertex>', opts.vertexBegin);
    if (opts.vertexTransform) vs = vs.replace('#include <begin_vertex>', opts.vertexTransform);
    let fc;
    if (opts.inst) {
      // unit box (-1..1) scaled by the instance: recover the local metres from the instance matrix columns
      fc = `
        vec3 isc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec3 lp = position * isc;
        vec3 an = abs(normal);
        float uu = an.x > 0.5 ? lp.z * sign(normal.x) + isc.x * 2.0 : lp.x * -sign(normal.z);
        bool top = an.y > 0.5;
        vF = vec3(uu + aOrg.w, lp.y + aOrg.y, top ? 2.0 : (aSt.w > 0.5 ? 9.0 : (aOrg.z > 0.5 ? 4.0 : 0.0)));
        vS = vec4(aSt.x, aSt.y, aSt.z, 0.0);
        vRuin = aSt.w;`;
    } else fc = 'vF = aF; vS = aS; vRuin = 0.0;';
    vs = vs.replace('#include <project_vertex>', `#include <project_vertex>\n${fc}\n${opts.vertexTail || ''}
      #ifdef USE_INSTANCING
        vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif`);
    sh.vertexShader = vs;
    let fs = sh.fragmentShader;
    fs = fs.replace('#include <common>', `#include <common>\n${FAC_GLSL}\n${SURFACE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        Fac fac = facade(vF, vS, vWP);
        if (vRuin > 0.5 && vF.z < 1.5) { fac.c = mix(fac.c, vec3(0.16, 0.14, 0.12), 0.75); fac.r = 0.9; fac.m = 0.0; fac.e = vec3(0.0); }
        diffuseColor.rgb *= fac.c;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = fac.r;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = fac.m;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fac.e;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse *= fac.ao; reflectedLight.indirectSpecular *= mix(1.0, fac.ao, 0.5);');
    const begin = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= sunV;');
    fs = fs.replace('#include <lights_fragment_begin>', `float sunV = sunVis(vWP, normalize((vec4(normal, 0.0) * viewMatrix).xyz));\n${begin}`);
    sh.fragmentShader = fs;
    opts.onCompile?.(sh);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

export function facadeMaterial(opts = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.5, envMapIntensity: 1.0 });
  return patchFacade(m, opts);
}

// ------------------------------------------------------------------ the sun height map (1 byte = 3 m)
export class SunMap {
  constructor(x0, z0, size, res = 1024) {
    this.x0 = x0; this.z0 = z0; this.size = size; this.res = res;
    this.base = new Uint8Array(res * res); // static towers
    this.data = new Uint8Array(res * res);
    this.tex = new THREE.DataTexture(this.data, res, res, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter; this.tex.generateMipmaps = false; this.tex.needsUpdate = true;
    FAC.tSunH.value = this.tex;
    FAC.uSunHB.value.set(x0, z0, 1 / size, 1 / size);
    this.dyn = new Map(); // id -> [poly footprint, h]
  }
  // rasterise a rotated rectangle footprint (or a disc) at height h into `arr`
  _put(arr, t, h) {
    const { res, size, x0, z0 } = this, s = res / size;
    const r = Math.hypot(t.w, t.d) * 0.5;
    const i0 = Math.max(0, Math.floor((t.x - r - x0) * s)), i1 = Math.min(res - 1, Math.ceil((t.x + r - x0) * s));
    const k0 = Math.max(0, Math.floor((t.z - r - z0) * s)), k1 = Math.min(res - 1, Math.ceil((t.z + r - z0) * s));
    const c = Math.cos(t.rot || 0), sn = Math.sin(t.rot || 0), v = Math.min(255, Math.round(h / 3));
    const round = t.kind === 'round' || t.kind === 'twist' || t.kind === 'tri';
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const x = x0 + (i + 0.5) / s - t.x, z = z0 + (k + 0.5) / s - t.z;
      const lx = x * c - z * sn, lz = x * sn + z * c;
      const inside = round ? (lx * lx) / (t.w * t.w * 0.25) + (lz * lz) / (t.d * t.d * 0.25) <= 1 : Math.abs(lx) <= t.w / 2 && Math.abs(lz) <= t.d / 2;
      if (inside) { const j = k * res + i; if (arr[j] < v) arr[j] = v; }
    }
  }
  addStatic(t, h = t.h) { this._put(this.base, t, h); }
  setDynamic(id, t, h) { if (h <= 0) this.dyn.delete(id); else this.dyn.set(id, [t, h]); this.dirty = true; }
  commit() {
    this.data.set(this.base);
    for (const [t, h] of this.dyn.values()) this._put(this.data, t, h);
    this.tex.needsUpdate = true; this.dirty = false;
  }
  syncSun() { FAC.uSunL.value.copy(SUN_DIR).normalize(); }
}
