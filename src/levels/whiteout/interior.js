import * as THREE from 'three';
import { M4, rbox, floorPools } from './kit.js';
import { signTexture } from './tex.js';

// =====================================================================================
//  Dressing for the two cable-car halls (the Mittelstation and the summit arrival hall), which were
//  big dark concrete boxes: steel roof trusses, a painted wainscot and kick plates, the electrical
//  cabinet bank, steel doors with signs, extinguisher boxes, benches and ski racks along the walls,
//  the route map, a clock, ticket gates at the sides, guide rails along the docks, and light pools
//  under the sodium lamps (bucket floors don't get the terrain's baked pools).
//  ctx: { B (buckets), col(), glows, root, x0, x1, z0, z1, Y, H (eaves height inside),
//         lamps: [[x,z]...], docks: [{ x, z, len, door: +1|-1 }], doorZ (entrance edge), doorX: [a,b],
//         wallSide: 'west' | 'east' (where the cabinets go), seed }
// =====================================================================================
const PI = Math.PI;
export function dressStation(ctx) {
  const { B, col, glows, root, x0, x1, z0, z1, Y, H, lamps = [], docks = [], doorZ, doorX = [72, 98], seed = 1, mapName = 'MITTELSTATION', wt = 0.5, trusses = true, clockY = 5.6, mapY = 3.0 } = ctx;
  const steel = [0.24, 0.27, 0.31], steelD = [0.15, 0.17, 0.19], green = [0.3, 0.36, 0.33], trim = [0.62, 0.48, 0.1];
  const zc = (z0 + z1) / 2, W = x1 - x0;

  // ---- roof trusses: bottom chord, top chord, verticals + diagonals every ~6 m
  if (trusses) for (let z = z0 + 3; z < z1 - 2; z += 6) {
    const yb = Y + H - 1.4, yt = Y + H - 0.2;
    B.paintIn.add(new THREE.BoxGeometry(W - 1.2, 0.24, 0.2), M4((x0 + x1) / 2, yb, z), steel);
    B.paintIn.add(new THREE.BoxGeometry(W - 1.2, 0.2, 0.18), M4((x0 + x1) / 2, yt, z), steel);
    const n = Math.round((W - 1.2) / 2.4);
    for (let k = 0; k <= n; k++) {
      const x = x0 + 0.6 + k * (W - 1.2) / n;
      B.paintIn.add(new THREE.BoxGeometry(0.1, yt - yb, 0.1), M4(x, (yb + yt) / 2, z), steelD);
      if (k < n) { const dx = (W - 1.2) / n, L = Math.hypot(dx, yt - yb); B.paintIn.add(new THREE.BoxGeometry(L, 0.08, 0.08), M4(x + dx / 2, (yb + yt) / 2, z, 0, 0, (k % 2 ? 1 : -1) * Math.atan2(yt - yb, dx)), steelD); }
    }
  }
  // ---- wainscot + kick plate + a yellow trim line on the inner faces of the long walls
  for (const [wx, f] of [[x0 + wt + 0.02, 1], [x1 - wt - 0.02, -1]]) {
    B.paintIn.add(new THREE.BoxGeometry(0.04, 1.3, z1 - z0 - 1.4), M4(wx, Y + 0.65, zc), green);
    B.paintIn.add(new THREE.BoxGeometry(0.05, 0.06, z1 - z0 - 1.4), M4(wx + f * 0.01, Y + 1.32, zc), trim);
    B.paintIn.add(new THREE.BoxGeometry(0.06, 0.18, z1 - z0 - 1.4), M4(wx + f * 0.01, Y + 0.09, zc), [0.08, 0.08, 0.085]);
  }
  // ---- the electrical cabinet bank (west wall), status lights
  for (let k = 0; k < 6; k++) {
    const z = z0 + 3 + k * 1.05, x = x0 + wt + 0.4;
    B.paintIn.add(rbox(0.6, 2.1, 1.0, 0.02), M4(x, Y + 1.05, z), [0.52, 0.54, 0.55]);
    B.paintIn.add(new THREE.BoxGeometry(0.02, 1.8, 0.02), M4(x + 0.31, Y + 1.05, z + 0.48), [0.2, 0.2, 0.21]);
    for (let j = 0; j < 3; j++) B.lamp.add(new THREE.BoxGeometry(0.02, 0.05, 0.05), M4(x + 0.31, Y + 1.7, z - 0.3 + j * 0.12), (k + j) % 3 ? [0.3, 1.6, 0.4] : [1.8, 0.5, 0.1]);
  }
  col(x0 + wt, Y, z0 + 2.4, x0 + wt + 0.75, Y + 2.1, z0 + 3 + 5 * 1.05 + 0.55, { mat: 'metal' });
  // ---- steel doors with frames + signs on the east wall, extinguisher boxes, benches, a ski rack
  const signMat = (lines, bg = '#1f3b2c', fg = '#f2efe6') => new THREE.MeshStandardMaterial({ map: signTexture(lines, { w: 512, h: 160, bg, fg, border: fg, seed: seed + lines.length, age: 0.4 }), roughness: 0.7 });
  for (const [k, z] of [[0, z0 + 3.5], [1, zc + 0.5]]) {
    const x = x1 - wt;
    B.paintIn.add(new THREE.BoxGeometry(0.1, 2.3, 1.2), M4(x - 0.04, Y + 1.15, z), [0.42, 0.45, 0.47]);
    for (const dz of [-0.65, 0.65]) B.paintIn.add(new THREE.BoxGeometry(0.14, 2.45, 0.1), M4(x - 0.05, Y + 1.22, z + dz), steelD);
    B.paintIn.add(new THREE.BoxGeometry(0.14, 0.1, 1.4), M4(x - 0.05, Y + 2.42, z), steelD);
    B.paintIn.add(new THREE.BoxGeometry(0.06, 0.04, 0.22), M4(x - 0.12, Y + 1.05, z + 0.4), [0.7, 0.7, 0.72]);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), signMat([[k ? 'BETRIEB' : 'NUR PERSONAL', 64]])); sm.position.set(x - 0.11, Y + 2.75, z); sm.rotation.y = -PI / 2; root.add(sm);
  }
  for (const [x, z, f] of [[x0 + wt + 0.06, zc + 3, 1], [x1 - wt - 0.06, zc - 3, -1], [x0 + wt + 0.06, z1 - 3, 1]]) {
    B.paint.add(rbox(0.2, 0.7, 0.36, 0.03), M4(x + f * 0.1, Y + 1.3, z), [0.62, 0.06, 0.05]);
    B.lamp.add(new THREE.BoxGeometry(0.02, 0.1, 0.3), M4(x + f * 0.21, Y + 1.75, z), [1.6, 1.6, 1.5]);
  }
  for (const [x, z] of [[x0 + wt + 0.5, zc + 6], [x1 - wt - 0.5, z0 + 8]]) {
    B.wood.add(rbox(0.45, 0.06, 2.6, 0.02), M4(x, Y + 0.46, z, 0, 0, 0), [0.42, 0.3, 0.18]);
    for (const dz of [-1.1, 1.1]) B.paintIn.add(new THREE.BoxGeometry(0.4, 0.44, 0.06), M4(x, Y + 0.22, z + dz), steelD);
    col(x - 0.3, Y, z - 1.35, x + 0.3, Y + 0.5, z + 1.35, { kind: 'bench', mat: 'wood', noBullet: true });
  }
  { const x = x0 + wt + 0.5, z = zc - 3; for (let k = 0; k < 6; k++) B.paintIn.add(new THREE.BoxGeometry(0.06, 1.1, 0.06), M4(x, Y + 0.55, z - 1.2 + k * 0.48), steelD); B.paintIn.add(new THREE.BoxGeometry(0.08, 0.06, 2.6), M4(x, Y + 1.05, z), steel); for (let k = 0; k < 4; k++) B.paint.add(new THREE.BoxGeometry(0.04, 1.6, 0.09), M4(x + 0.12, Y + 0.85, z - 0.9 + k * 0.55, 0.12, 0, -0.05), k % 2 ? [0.1, 0.25, 0.6] : [0.75, 0.75, 0.75]); }
  // ---- the route map (a big lit board on the west wall) + a clock over the entrance
  {
    const t = signTexture([['GRAUHORN-BAHN', 70], ['TALSTATION 1290 · ' + mapName + ' · GRAUHORN 3412', 30], ['── ● ─────── ● ─────────── ●', 34]], { w: 1024, h: 320, bg: '#e8e2d2', fg: '#7a1410', border: '#7a1410', seed: seed + 9, age: 0.35 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 }));
    m.position.set(x0 + wt + 0.06, Y + mapY, zc - 3); m.rotation.y = PI / 2; root.add(m);
    glows.push({ p: [x0 + wt + 0.7, Y + mapY + 0.95, zc - 3], color: [1.2, 1.1, 0.9], size: 1.4 });
  }
  if (doorZ !== undefined) {
    const f = doorZ > zc ? -1 : 1, z = doorZ + f * (wt + 0.06), x = (doorX[0] + doorX[1]) / 2;
    B.paintIn.add(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24).rotateX(PI / 2), M4(x, Y + clockY, z), [0.12, 0.12, 0.13]);
    B.lamp.add(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 24).rotateX(PI / 2), M4(x, Y + clockY, z + f * 0.06), [1.4, 1.38, 1.3]);
    for (const [a, L] of [[0.4, 0.26], [2.2, 0.18]]) B.paintIn.add(new THREE.BoxGeometry(0.03, L, 0.01), M4(x + Math.sin(a) * L / 2, Y + clockY + Math.cos(a) * L / 2, z + f * 0.09, 0, 0, -a), [0.05, 0.05, 0.05]);
    // ticket gates at both sides of the entrance (the middle stays open)
    for (const gx0 of [doorX[0] - 0.2, doorX[1] - 3.8]) for (let k = 0; k < 3; k++) {
      const gx = gx0 + 0.3 + k * 1.3, gz = doorZ + f * 4;
      B.paintIn.add(rbox(0.3, 1.0, 0.9, 0.03), M4(gx, Y + 0.5, gz), [0.26, 0.28, 0.3]); B.paintIn.add(rbox(0.32, 0.06, 0.92, 0.02), M4(gx, Y + 0.98, gz), [0.06, 0.06, 0.065]); B.paint.add(new THREE.BoxGeometry(0.33, 0.06, 0.92), M4(gx, Y + 0.12, gz), [0.75, 0.6, 0.06]);
      B.lamp.add(new THREE.BoxGeometry(0.2, 0.02, 0.14), M4(gx, Y + 1.022, gz - f * 0.2), k % 2 ? [0.3, 1.6, 0.4] : [1.8, 0.3, 0.1]);
      B.metal.add(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 6).rotateZ(PI / 2), M4(gx + 0.42, Y + 0.85, gz), [0.7, 0.7, 0.72]);
      col(gx - 0.17, Y, gz - 0.46, gx + 0.17, Y + 1.0, gz + 0.46, { kind: 'gate', mat: 'metal', noBullet: true });
    }
  }
  // ---- guide rails along each dock on the side away from the cabin door (posts + two bars), rubber fenders
  for (const d of docks) {
    const gx = d.x - d.door * 2.1;
    for (let k = 0; k <= 4; k++) B.paintIn.add(new THREE.BoxGeometry(0.1, 1.05, 0.1), M4(gx, Y + 0.52, d.z - d.len / 2 + k * d.len / 4), steelD);
    for (const yy of [0.55, 1.0]) B.paint.add(new THREE.BoxGeometry(0.08, 0.12, d.len), M4(gx, Y + yy, d.z), [0.75, 0.6, 0.06]);
    for (let k = 0; k < 3; k++) B.paintIn.add(rbox(0.12, 0.4, 0.9, 0.04), M4(gx + d.door * 0.06, Y + 0.78, d.z - d.len / 3 + k * d.len / 3), [0.06, 0.06, 0.065]);
    col(gx - 0.08, Y, d.z - d.len / 2, gx + 0.08, Y + 1.1, d.z + d.len / 2, { kind: 'rail', mat: 'metal', noBullet: true });
  }
  // ---- light pools on the hall floor under the lamps (warm)
  root.add(floorPools(lamps.map(([x, z]) => ({ p: [x, Y + 0.02, z], c: [0.5, 0.33, 0.13], r: 6.5 }))));
}
