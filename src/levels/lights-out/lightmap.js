import * as THREE from 'three';
import { groundAt } from './layout.js';

// =====================================================================================
//  The light on the ground: every street lamp, shop front, lantern string and floodlight along
//  the route lays a warm pool on the floors and the feet of the walls around it (no runtime
//  lights). Baked once into a 2D map over the play space: RGBA = irradiance of the four power
//  groups (west / Lantern Cliff / the bridge / east), plus a colour map and the floor height, so a
//  pool only lights surfaces near the floor it was cast on (a lamp on Lantern Street doesn't
//  light the gallery 10 m below). The blackout dims each group with its district.
//  Patched into every lit material (kit.js) through LM.
// =====================================================================================
export const LMR = { x0: 360, z0: 92, x1: 744, z1: 452, w: 768, h: 720 };   // the whole route: plaza, cliff road, bridge, forecourt (0.5 m per texel)
export const LM = {
  tex: { value: null }, col: { value: null }, hgt: { value: null },
  rect: { value: new THREE.Vector4(LMR.x0, LMR.z0, 1 / (LMR.x1 - LMR.x0), 1 / (LMR.z1 - LMR.z0)) },
  grp: { value: new THREE.Vector4(1, 1, 1, 1) },
  k: { value: 1 },
};
export const LM_GLSL = /* glsl */`
uniform sampler2D uLM; uniform sampler2D uLMC; uniform sampler2D uLMH;
uniform vec4 uLMR; uniform vec4 uLMG; uniform float uLMK;
vec3 groundLight(vec3 wp, vec3 n){
  vec2 uv = (wp.xz - uLMR.xy) * uLMR.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
  vec4 g = texture2D(uLM, uv);
  float I = dot(g * g, uLMG) * 6.0;
  if (I < 0.002) return vec3(0.0);
  vec2 hh = texture2D(uLMH, uv).rg; float fy = (hh.r * 255.0 * 256.0 + hh.g * 255.0) / 65535.0 * 100.0 - 10.0;
  float dh = wp.y - fy;
  float hf = exp(-max(0.0, dh) / 4.5) * smoothstep(-1.2, -0.3, dh);
  // floors take it all, walls a little less, ceilings / undersides catch a bounce
  float facing = 0.55 + 0.45 * max(n.y, 0.0) + 0.25 * max(-n.y, 0.0);
  vec3 L = texture2D(uLMC, uv).rgb * 2.0 * I * hf * facing * uLMK;
  return L * (3.2 / (3.2 + max(max(L.r, L.g), L.b)));   // soft knee: right under a lamp, small props don't turn into lamps themselves
}
// grime + contact darkening where a wall meets the floor in front of it (the floor height comes from the
// light map's height texture, sampled a little out along the wall's normal)
vec3 baseAO(vec3 wp, vec3 n){
  float side = 1.0 - abs(n.y);
  if (side < 0.3) return vec3(1.0);
  vec2 uv = (wp.xz + n.xz * 0.7 - uLMR.xy) * uLMR.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(1.0);
  vec2 hh = texture2D(uLMH, uv).rg; float fy = (hh.r * 255.0 * 256.0 + hh.g * 255.0) / 65535.0 * 100.0 - 10.0;
  float dh = wp.y - fy;
  if (dh < -0.25 || dh > 3.0) return vec3(1.0);
  float k = exp(-max(dh, 0.0) / 0.55) * 0.42 + exp(-max(dh, 0.0) / 1.6) * 0.18;
  return mix(vec3(1.0), vec3(0.62, 0.58, 0.52), k * side);
}
`;

export class LightBaker {
  constructor() { this.lights = []; }
  // { p:[x,y,z], color:[r,g,b] (linear, ~0..2), r: reach (m), k: strength, grp: 0..3 }
  add(L) { this.lights.push(L); }
  bake() {
    const { w, h, x0, z0, x1, z1 } = LMR, sx = (x1 - x0) / w, sz = (z1 - z0) / h;
    const I = new Float32Array(w * h * 4), Cc = new Float32Array(w * h * 3), H = new Uint8Array(w * h * 4);
    const floor = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const y = groundAt(x0 + (i + 0.5) * sx, z0 + (j + 0.5) * sz); floor[j * w + i] = y;
      // 16-bit height (R high byte, G low byte; sampled nearest): 1.5 mm steps, so the wall-base grime sits right
      const v = Math.max(0, Math.min(65535, Math.round((y + 10) / 100 * 65535))); const q = (j * w + i) * 4; H[q] = v >> 8; H[q + 1] = v & 255; H[q + 2] = 0; H[q + 3] = 255;
    }
    for (const L of this.lights) {
      const [lx, ly, lz] = L.p, R = L.r ?? 9, k = L.k ?? 1, c = L.color ?? [1, 0.6, 0.3], g = L.grp ?? 0;
      const lf = groundAt(lx, lz), hl = Math.max(1, ly - lf);
      const i0 = Math.max(0, Math.floor((lx - R * 2.2 - x0) / sx)), i1 = Math.min(w - 1, Math.ceil((lx + R * 2.2 - x0) / sx));
      const j0 = Math.max(0, Math.floor((lz - R * 2.2 - z0) / sz)), j1 = Math.min(h - 1, Math.ceil((lz + R * 2.2 - z0) / sz));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = x0 + (i + 0.5) * sx, pz = z0 + (j + 0.5) * sz, f = floor[j * w + i];
        const dy = ly - f; if (dy < 0.2) continue;
        const lvl = Math.abs(f - lf); const wl = Math.exp(-Math.max(0, lvl - 0.6) / 1.6); if (wl < 0.03) continue;
        const d2 = (px - lx) ** 2 + (pz - lz) ** 2;
        // a lamp pool: cosine-weighted inverse square softened by the reach, with a soft cut-off
        const e = hl * k * 6 / Math.pow(d2 + hl * hl, 1.5) * (hl * hl) * 0.12 * Math.max(0, 1 - d2 / (R * R * 4.8));
        const v = e * wl; if (v < 1e-4) continue;
        const q = j * w + i; I[q * 4 + g] += v; Cc[q * 3] += c[0] * v; Cc[q * 3 + 1] += c[1] * v; Cc[q * 3 + 2] += c[2] * v;
      }
    }
    const D = new Uint8Array(w * h * 4), DC = new Uint8Array(w * h * 4);
    for (let q = 0; q < w * h; q++) {
      let s = 0; for (let g = 0; g < 4; g++) { D[q * 4 + g] = Math.min(255, Math.round(Math.sqrt(Math.min(1, I[q * 4 + g] / 6)) * 255)); s += I[q * 4 + g]; }
      // stored as sqrt for precision in the dim tails; the shader squares it back
      if (s > 1e-5) { const m = Math.max(Cc[q * 3], Cc[q * 3 + 1], Cc[q * 3 + 2]) || 1; DC[q * 4] = Math.round(Cc[q * 3] / m * 255); DC[q * 4 + 1] = Math.round(Cc[q * 3 + 1] / m * 255); DC[q * 4 + 2] = Math.round(Cc[q * 3 + 2] / m * 255); }
      DC[q * 4 + 3] = 255;
    }
    const mk = (data, lin = true) => { const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.colorSpace = lin ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
    LM.tex.value = mk(D); LM.col.value = mk(DC); LM.hgt.value = mk(H); LM.hgt.value.magFilter = LM.hgt.value.minFilter = THREE.NearestFilter;
    return { n: this.lights.length };
  }
}
