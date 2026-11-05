import * as THREE from 'three';
import { makeCanvas } from '../../textures.js';

// =====================================================================================
//  The light on the ground. Every lit shop, sign, vending machine, street lamp and screen paints a
//  soft coloured pool into one top-down map (1024², ~0.33 m per texel over the play area); every
//  ground material adds albedo × map × k on top of its lighting. No runtime lights, one texture —
//  the street reads lit by its neon without a single point light (Quest budget).
//  The decks / expressway / off-ramp share the map (nothing walkable stacks above anything else).
// =====================================================================================
export const LM = { x0: -112, z0: -182, x1: 212, z1: 192, res: 1024 };

export class GroundLight {
  constructor() {
    this.list = []; this.occ = [];
    this.uniform = { value: null }; this.aoU = { value: null };
    this.k = { value: 1.0 };
    // live light from the giant screens: (x, z, radius, k) + colour, animated by the world
    this.scr = { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 0)) };
    this.scrC = { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) };
  }
  // a building footprint: the pavement darkens toward its walls (contact shadow / corner occlusion)
  occlude(x0, z0, x1, z1) { this.occ.push([x0, z0, x1, z1]); }
  // disc: { x, z, r, color, k }   rect: { x, z, w, d, ang, color, k }
  add(L) { this.list.push(L); }
  bake() {
    const { res } = LM, sx = res / (LM.x1 - LM.x0), sz = res / (LM.z1 - LM.z0);
    const c = makeCanvas(res, res), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, res, res);
    g.globalCompositeOperation = 'lighter';
    const col = (rgb, a) => `rgba(${Math.min(255, Math.round(rgb[0] * 150))},${Math.min(255, Math.round(rgb[1] * 150))},${Math.min(255, Math.round(rgb[2] * 150))},${Math.min(1, a)})`;
    for (const L of this.list) {
      const px = (L.x - LM.x0) * sx, pz = (L.z - LM.z0) * sz, k = L.k ?? 1;
      if (L.w) {
        // a soft rectangle (shop light spilling out of a window): radial gradient squashed into the rect
        g.save(); g.translate(px, pz); g.rotate(L.ang || 0); g.scale(L.w * sx / 2, L.d * sz / 2);
        const gr = g.createRadialGradient(0, 0, 0.1, 0, 0, 1);
        gr.addColorStop(0, col(L.color, 0.9 * k)); gr.addColorStop(0.55, col(L.color, 0.45 * k)); gr.addColorStop(1, col(L.color, 0));
        g.fillStyle = gr; g.fillRect(-1, -1, 2, 2);
        g.restore();
      } else {
        const r = L.r * sx;
        const gr = g.createRadialGradient(px, pz, 0, px, pz, r);
        gr.addColorStop(0, col(L.color, 0.85 * k)); gr.addColorStop(0.4, col(L.color, 0.4 * k)); gr.addColorStop(1, col(L.color, 0));
        g.fillStyle = gr; g.fillRect(px - r, pz - r, r * 2, r * 2);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.needsUpdate = true;
    this.uniform.value = tex;
    this.canvas = c;
    // occlusion: footprints drawn black on white, blurred ~1.6 m, then the footprints themselves re-filled
    const R2 = 512, ax = R2 / (LM.x1 - LM.x0), az = R2 / (LM.z1 - LM.z0);
    const a = makeCanvas(R2, R2), ag = a.getContext('2d');
    ag.fillStyle = '#fff'; ag.fillRect(0, 0, R2, R2);
    ag.filter = 'blur(3px)'; ag.fillStyle = '#000';
    for (const [x0, z0, x1, z1] of this.occ) ag.fillRect((x0 - LM.x0) * ax, (z0 - LM.z0) * az, (x1 - x0) * ax, (z1 - z0) * az);
    ag.filter = 'none';
    const at = new THREE.CanvasTexture(a); at.colorSpace = THREE.NoColorSpace; at.flipY = false; at.needsUpdate = true;
    this.aoU.value = at;
    return tex;
  }
  // add the map to a standard material: emissive += albedo × light × k (world xz → map uv)
  patch(mat, k = 1, { ao = true } = {}) {
    const U = this.uniform, K = this.k, AO = this.aoU, SC = this.scr, SCC = this.scrC;
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (s, r) => {
      prev?.call(mat, s, r);
      s.uniforms.tGL = U; s.uniforms.uGLk = K; s.uniforms.uGLm = { value: k }; s.uniforms.tAO = AO; s.uniforms.uScr = SC; s.uniforms.uScrC = SCC;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGLw;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGLw = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D tGL; uniform sampler2D tAO; uniform float uGLk; uniform float uGLm; uniform vec4 uScr[4]; uniform vec3 uScrC[4]; varying vec3 vGLw;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { vec2 glUV = vec2((vGLw.x - (${LM.x0.toFixed(1)})) / ${(LM.x1 - LM.x0).toFixed(1)}, (vGLw.z - (${LM.z0.toFixed(1)})) / ${(LM.z1 - LM.z0).toFixed(1)});
    vec3 gl = texture2D(tGL, glUV).rgb;
    ${ao ? 'float glAO = mix(0.35, 1.0, texture2D(tAO, glUV).r); diffuseColor.rgb *= glAO;' : ''}
    totalEmissiveRadiance += diffuseColor.rgb * (gl * 2.2 + gl * gl * 5.0) * uGLk * uGLm;
    for (int i = 0; i < 4; i++) { vec2 d = (vGLw.xz - uScr[i].xy) / uScr[i].z; float f = max(0.0, 1.0 - dot(d, d)); totalEmissiveRadiance += diffuseColor.rgb * uScrC[i] * f * f * uScr[i].w; }
  }`);
    };
    const key = mat.customProgramCacheKey?.bind(mat);
    mat.customProgramCacheKey = () => (key ? key() : '') + 'GL' + (ao ? 'a' : '');
    return mat;
  }
}
