import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Acc, rmMat, hex } from './kit.js';
import { signAtlas2 } from './signs2.js';
import { signAtlas } from './signs.js';
import { signQuad, signMaterial, haloMaterial } from './city.js';
import { T108, GINZA, AVE_E, CURB } from './layout.js';

// =====================================================================================
//  The Shibuya landmarks the crossing is recognised by (fictional stand-ins):
//   - KUROGANE 108: the silver cylinder tower in the fork between the two avenues (Shibuya 109),
//     horizontal aluminium ribs, a tall vertical name down its face, a glowing crown ring, fashion
//     posters wrapped round its base, a lit entrance;
//   - the yellow subway train on its steel bridge over the avenue, coming out of one building and
//     into the next on the third floor (the Ginza line at Shibuya).
// =====================================================================================
export function buildLandmarks(ctx = {}) {
  const rng = makeRng(108);
  const root = new THREE.Group(); root.name = 'landmarks';
  const colliders = [], glows = [], lights = [];
  const A = new Acc({ rm: true }), S = new Acc(), S2 = new Acc(), H = new Acc();
  const { E: E2 } = signAtlas2(), { E: E1 } = signAtlas();
  // ---------------------------------------------------------------- the cylinder
  {
    const { x, z, r, h } = T108, seg = 40;
    // shell: aluminium ribs every 0.9 m with dark glazed bands between; the crossing side has a glass slot
    for (let y = 0.0; y < h; y += 0.9) {
      const rib = Math.round(y / 0.9) % 2 === 0;
      A.set({ col: rib ? hex(0xb8bcc2) : hex(0x6a7078), rm: rib ? [0.3, 0.85, 0] : [0.25, 0.7, 0.0] });
      A.cyl(x, y, z, rib ? r + 0.06 : r, rib ? r + 0.06 : r, Math.min(h, y + (rib ? 0.35 : 0.9)), seg, { cap: false });
    }
    A.set({ col: hex(0x8a8e94), rm: [0.5, 0.7, 0] }); A.cyl(x, h, z, r + 0.3, r + 0.3, h + 0.3, seg, { cap: true });
    // the crown: a lit ring and a mast
    A.set({ col: [1, 1, 1], rm: [0.3, 0, 2.6] }); A.cyl(x, h + 0.3, z, r + 0.32, r + 0.32, h + 1.3, seg, { cap: false });
    A.set({ col: hex(0x6a6e74), rm: [0.5, 0.7, 0] }); A.tube([x, h + 1.3, z], [x, h + 9, z], 0.15, 6);
    glows.push({ p: [x, h + 9.2, z], color: [3.2, 0.3, 0.15], size: 1.3, blink: true, rate: 1.8, far: true });
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; glows.push({ p: [x + Math.cos(a) * (r + 0.6), h + 0.8, z + Math.sin(a) * (r + 0.6)], color: [1.2, 1.2, 1.25], size: 3.2, far: true }); }
    // the vertical name, facing the crossing (north-west), on a dark band down the face
    const dir = new THREE.Vector3(-0.72, 0, -0.69).normalize();
    const C = (y, out = 0.12) => [x + dir.x * (r + out), y, z + dir.z * (r + out)];
    A.set({ col: hex(0x0c0c0e), rm: [0.4, 0.4, 0] });
    const bx = C(0, 0.06);
    A.obox(bx[0], h * 0.55, bx[2], 1.3, h * 0.36, 0.1, Math.atan2(dir.x, dir.z));
    signQuad(S2, C(h * 0.55, 0.2), [dir.x, 0, dir.z], h * 0.66, 1.9, E2.tower108.uv, 1.7, [dir.z, 0, -dir.x]);
    H.set({}); signQuad(H, C(h * 0.55, 0.05), [dir.x, 0, dir.z], 5, h * 0.8, [0, 0, 1, 1], [0.16, 0.16, 0.17]);
    glows.push({ p: C(h * 0.55, 0.8), color: [0.5, 0.5, 0.5], size: 10, far: true });
    // posters wrapped round the base (three flat panels on the curve), and the entrance
    for (const [da, k] of [[-0.55, 0], [0, 2], [0.55, 3]]) {
      const a = Math.atan2(dir.z, dir.x) + da, n = [Math.cos(a), 0, Math.sin(a)];
      const p = [x + n[0] * (r + 0.25), 9.5, z + n[2] * (r + 0.25)];
      A.set({ col: hex(0x161618), rm: [0.5, 0.4, 0] }); A.obox(p[0] - n[0] * 0.1, 9.5, p[2] - n[2] * 0.1, 2.75, 3.75, 0.1, Math.atan2(n[0], n[2]));
      signQuad(S2, p, n, 5.2, 7.2, E2.poster[k].uv, 1.25);
      lights.push({ x: p[0] + n[0] * 5, z: p[2] + n[2] * 5, r: 6, color: E2.poster[k].glow, k: 0.35 });
    }
    { const n = [dir.x, 0, dir.z], p = [x + n[0] * (r + 0.1), 2.0, z + n[2] * (r + 0.1)];
      A.set({ col: hex(0xf2ead8), rm: [0.4, 0, 1.6] }); A.obox(p[0], 2.0, p[2], 2.6, 1.85, 0.05, Math.atan2(n[0], n[2]));
      lights.push({ x: p[0] + n[0] * 3, z: p[2] + n[2] * 3, r: 6, color: [1.6, 1.4, 1.2], k: 0.8 }); }
    colliders.push({ min: [x - r * 0.92, 0, z - r * 0.92], max: [x + r * 0.92, h, z + r * 0.92], data: { mat: 'metal', kind: 'building' } });
  }
  // ---------------------------------------------------------------- the yellow train on its bridge over the avenue
  {
    const gx = GINZA.x, y = GINZA.y, z0 = -AVE_E.walk - 0.5, z1 = AVE_E.walk + 0.5, hw = 2.6;
    // the bridge: a steel through-truss, deck underneath, the openings into the buildings either side
    A.set({ col: hex(0x3e4a54), rm: [0.45, 0.7, 0] });
    A.box(gx - hw, y - 1.0, z0, gx + hw, y - 0.2, z1);
    for (const s of [-1, 1]) {
      A.box(gx + s * hw - 0.15, y - 0.2, z0, gx + s * hw + 0.15, y + 0.15, z1);
      A.box(gx + s * hw - 0.15, y + 4.2, z0, gx + s * hw + 0.15, y + 4.5, z1);
      for (let zz = z0; zz <= z1; zz += 3.5) { A.tube([gx + s * hw, y, zz], [gx + s * hw, y + 4.3, zz], 0.1, 5); if (zz + 3.5 <= z1) A.tube([gx + s * hw, y, zz], [gx + s * hw, y + 4.3, zz + 3.5], 0.08, 5); }
    }
    for (let zz = z0; zz <= z1; zz += 3.5) A.box(gx - hw, y + 4.3, zz - 0.08, gx + hw, y + 4.45, zz + 0.08);
    // the portals in the facades either side (dark mouths with a lit lip)
    A.set({ col: hex(0x0a0b0c), rm: [0.9, 0, 0] }); for (const zz of [z0 - 0.02, z1 + 0.02]) A.box(gx - hw + 0.2, y - 0.2, Math.min(zz, zz + (zz < 0 ? 0.6 : -0.6)), gx + hw - 0.2, y + 4.2, Math.max(zz, zz + (zz < 0 ? 0.6 : -0.6)));
    // two cars of the train, half on the bridge: yellow, a black band, lit windows
    for (const [zc, len] of [[-2, 16]]) {
      A.set({ col: hex(0xe8a818), rm: [0.35, 0.3, 0] }); A.box(gx - 1.35, y + 0.4, zc - len / 2, gx + 1.35, y + 3.6, zc + len / 2, { faces: 'xXY' });
      A.set({ col: hex(0x1a1a1a), rm: [0.5, 0.3, 0] }); for (const s of [-1, 1]) A.box(s > 0 ? gx + 1.35 : gx - 1.36, y + 1.5, zc - len / 2, s > 0 ? gx + 1.36 : gx - 1.35, y + 1.7, zc + len / 2, { faces: s > 0 ? 'X' : 'x' });
      for (let k = 0; k < 4; k++) for (const s of [-1, 1]) { const zw = zc - len / 2 + 2 + k * 3.8; S.set({}); signQuad(S, [gx + s * 1.37, y + 2.5, zw], [s, 0, 0], 2.2, 0.9, E1.shop[0].uv, 1.4); }
    }
    glows.push({ p: [gx, y + 4.8, 0], color: [1.0, 0.95, 0.85], size: 5 });
    lights.push({ x: gx, z: 0, w: 6, d: 30, ang: 0, color: [1.0, 0.9, 0.7], k: 0.35 });
  }
  // ---------------------------------------------------------------- meshes
  root.add(A.mesh(rmMat({ envMapIntensity: 1.4 })));
  root.add(S.mesh(signMaterial()));
  root.add(S2.mesh(new THREE.MeshBasicMaterial({ map: signAtlas2().tex, vertexColors: true })));
  const mh = H.mesh(haloMaterial()); mh.renderOrder = 6; root.add(mh);
  return { root, colliders, anchors: { glows, lights } };
}
