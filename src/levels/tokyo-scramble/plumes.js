import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { DAY } from './tod.js';
import { makeCanvas, canvasTex, makeNoise, fbm } from '../../textures.js';

// =====================================================================================
//  The war is citywide: black smoke columns standing over the skyline from the first frame (the
//  Transformers Chicago look — against a clear blue sky they read from kilometres). Each is one
//  camera-facing card with a small shader: a widening, wind-bent column envelope times two scrolling
//  octaves of tileable noise (it billows upward), dark brown-black at the base, sunlit grey on the
//  sun side higher up, a faint fire glow at the foot. The finale adds two more over Center-gai.
// =====================================================================================
// a baked column (the Level 4 plume recipe, shaded for a sun on one side): soft fbm billows inside a
// widening, wind-bent envelope, black-brown at the base, sunlit grey on the right side higher up, an
// orange glow at the foot. Static: at 400–700 m a real column barely moves in a few seconds.
let _plume = null;
function plumeTex() {
  if (_plume) return _plume;
  const W = 256, H = 1024, cv = makeCanvas(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), n = makeNoise(4411, 8), n2 = makeNoise(977, 16);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = 1 - y / H, uu = x / W;
    const drift = Math.pow(v, 1.6) * 0.16, w = 0.07 + 0.3 * Math.pow(v, 0.7);
    const f1 = fbm(n, uu, v * 2.2, 8, 4), f2 = fbm(n2, uu * 1.5, v * 3, 16, 3);
    const u = uu - 0.5 - drift + (f1 - 0.5) * 0.18 * v;
    const r = Math.abs(u) / (w * (0.8 + 0.4 * f2));
    const body = Math.max(0, 1 - r * r);
    const dens = Math.min(1, body * 1.6) * (0.45 + 0.75 * f1);
    const a = Math.min(1, dens * 1.25) * Math.min(1, v * 14) * (1 - Math.pow(v, 2.4));
    const lit = Math.max(0, Math.min(1, 0.45 + (u / Math.max(w, 1e-3)) * 0.55)) * Math.min(1, v * 2.5);
    const shade = 0.06 + 0.3 * lit * (0.5 + 0.7 * f2);
    let R = shade * 255, G = shade * 245, B = shade * 232;
    const foot = Math.max(0, 1 - v * 16); R += 210 * foot * f1; G += 80 * foot * f1; B += 20 * foot * f1;
    const haze = 0.28 * Math.max(0, v - 0.3);
    R = R * (1 - haze) + 160 * haze; G = G * (1 - haze) + 180 * haze; B = B * (1 - haze) + 210 * haze;
    const i = (y * W + x) * 4; img.data[i] = Math.min(255, R); img.data[i + 1] = Math.min(255, G); img.data[i + 2] = Math.min(255, B); img.data[i + 3] = 255 * Math.max(0, Math.min(1, a));
  }
  g.putImageData(img, 0, 0);
  _plume = canvasTex(cv, { repeat: false, aniso: 4 });
  return _plume;
}
export function buildPlumes(ctx = {}) {
  const root = new THREE.Group(); root.name = 'plumes';
  if (!DAY.on) return { root };
  const tex = plumeTex(), list = [];
  const add = (x, z, w, h, seed, k = 1) => {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: k });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), m);
    p.scale.set(w * (seed > 0.5 ? -1 : 1), h, 1); p.position.set(x, -4, z); p.renderOrder = 3; p.frustumCulled = false;
    root.add(p); list.push(p);
    return p;
  };
  add(430, -150, 300, 760, 0.13); add(300, -480, 240, 640, 0.41); add(-420, -380, 220, 560, 0.77);
  add(380, 330, 260, 700, 0.29); add(-60, 520, 220, 600, 0.61); add(760, 180, 320, 820, 0.9, 0.9);
  const update = (dt, t, head) => {
    for (const p of list) { const dx = head.x - p.position.x, dz = head.z - p.position.z; p.rotation.y = Math.atan2(dx, dz); }
  };
  return { root, update, plumes: list, add };
}
