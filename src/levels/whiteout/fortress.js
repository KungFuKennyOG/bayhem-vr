import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { dressStation } from './interior.js';
import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { HALL, HALL_WALK, DOCK, COURT, BLOCK, TOWER, STAIR_A, LAND_A, STAIR_B, LAND_B, GALLERY, RAILCAR, TRACK_X, SUMMIT_Y, terrainAt, groundAt, lineY } from './layout.js';
import { Bucket, M4, mats, rbox, snowCap, footAO, driftWedge, floorPools, trackDecals, groundPatches, aoStrips, lightCone, lanePatches } from './kit.js';
import { buildGroomer } from './groomer.js';
import { signTexture } from './tex.js';
import { makeCanvas, canvasTex } from '../../textures.js';

// =====================================================================================
//  GRAUHORN STATION — the summit: a 1930s high-altitude observatory and cable-car top station
//  on the saddle, taken over and fortified. Arrival hall (the dock, the bull wheel) → courtyard
//  (helipad, sandbag nests, a parked snowcat) → the north block with its roof walk (parapet facing
//  the courtyard: they shoot down at you, then you shoot down at them) → stair B up the observatory
//  tower to the terrace and the dome → the rack-railway avalanche gallery cut into the slope east of
//  the block (open pillars to the south, the tunnel portal at the far end).
//  Searchlights sweep the storm (volumetric cones, additive, one draw each).
// =====================================================================================
const PI = Math.PI;
const SODIUM = [2.8, 1.5, 0.55], WARM = [2.6, 1.55, 0.7], RED = [3.4, 0.25, 0.15];
const Y = SUMMIT_Y;

const snowLess = (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
export function buildFortress(ctx) {
  const root = new THREE.Group();
  const rng = makeRng(31337);
  const B = { concrete: new Bucket(), concreteIn: new Bucket(), stone: new Bucket(), paint: new Bucket(), paintIn: new Bucket(), metal: new Bucket(), lamp: new Bucket(), snow: new Bucket(), wood: new Bucket(), glass: new Bucket(), rock: new Bucket() };
  const colliders = [], glows = [], pools = [], named = {}, explosives = [], roofs = [], beams = [];
  const col = (x0, y0, z0, x1, y1, z1, data = {}) => colliders.push({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], data: { mat: 'concrete', ...data } });
  const cA = (y0) => footAO(y0, 1.6, 0.42, [0.84, 0.83, 0.81]);
  const wall = (x0, x1, z0, z1, y0, y1, bucket = B.concrete, uv = 3.2, c = null) => { bucket.add(rbox(x1 - x0, y1 - y0, z1 - z0, 0.03), M4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), c || cA(y0), { uvScale: uv }); col(x0, y0, z0, x1, y1, z1); };
  const icicles = (xa, za, xb, zb, y, n, len = 1) => { for (let i = 0; i < n; i++) { const t = (i + rng() * 0.5) / n, il = (0.2 + rng() * rng() * 1.3) * len; B.snow.add(new THREE.ConeGeometry(0.04 + il * 0.025, il, 5).rotateX(PI), M4(xa + (xb - xa) * t, y - il / 2, za + (zb - za) * t), [0.72, 0.8, 0.95]); } };
  const windowRow = (x0, x1, z, y, n, face, lit = 0.7, w = 1.3, h = 1.6) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * (x1 - x0) / n;
      const on = rng() < lit;
      const c = on ? [1.35, 0.82, 0.38] : [0.05, 0.06, 0.08];
      B.lamp.add(new THREE.PlaneGeometry(w, h), M4(x, y, z + face * 0.03, 0, face > 0 ? 0 : PI, 0), c);
      B.metal.add(new THREE.BoxGeometry(w + 0.16, 0.12, 0.25), M4(x, y - h / 2 - 0.06, z + face * 0.1), [0.3, 0.3, 0.32]);
      B.snow.add(snowCap(w + 0.1, 0.25, 0.1, x, 3, 1), M4(x, y - h / 2 + 0.03, z + face * 0.12), [0.95, 0.97, 1]);
      // meltwater streaks under the sill, a dark lintel + reveal round the opening, icicles off the sill
      B.concrete.add(new THREE.BoxGeometry(w * (0.5 + rng() * 0.4), 1.8 + rng() * 1.2, 0.02), M4(x + (rng() - 0.5) * 0.3, y - h / 2 - 1.2, z + face * 0.015), (q, n, l) => { const k = 0.42 + 0.36 * Math.min(1, Math.max(0, (0.9 - l.y) / 2.4)); return [k, k * 0.98, k * 0.95]; });
      B.concrete.add(new THREE.BoxGeometry(w + 0.5, 0.28, 0.12), M4(x, y + h / 2 + 0.14, z + face * 0.06), [0.55, 0.54, 0.52]);
      for (let k = 0; k < 4; k++) { const il = 0.15 + rng() * 0.45; B.snow.add(new THREE.ConeGeometry(0.03, il, 4).rotateX(PI), M4(x - w / 2 + 0.15 + k * (w - 0.3) / 3, y - h / 2 - 0.12 - il / 2, z + face * 0.2), [0.72, 0.8, 0.95]); }
      if (on) { glows.push({ p: [x, y, z + face * 0.6], color: WARM, size: 1.3 }); pools.push({ p: [x, y - 2.4, z + face * 3], c: [0.6, 0.34, 0.14], r: 3.4, k: 1 }); }
    }
  };

  // ---------------------------------------------------------------- arrival hall (the cable car docks inside)
  {
    const { x0, x1, z0, z1, roofY } = HALL, H = roofY - Y, T = 0.6;
    wall(x0, x0 + T, z0, z1, Y, roofY); wall(x1 - T, x1, z0, z1, Y, roofY);
    // south: the cable opening (x 72..98, up to y +9) with the gable over it
    wall(x0, 72, z1 - T, z1, Y, roofY); wall(98, x1, z1 - T, z1, Y, roofY); wall(72, 98, z1 - T, z1, Y + 9, roofY);
    // north: the doors into the courtyard (x 76..98, 4.5 m), glazing above them
    wall(x0, 76, z0, z0 + T, Y, roofY); wall(98, x1, z0, z0 + T, Y, roofY); wall(76, 98, z0, z0 + T, Y + 4.5, roofY);
    windowRow(x0 + 2, 74, z0, Y + 7, 4, -1, 0.8); windowRow(100, x1 - 2, z0, Y + 7, 3, -1, 0.6);
    windowRow(x0 + 2, x1 - 2, z1, Y + 10.5, 9, 1, 0.5);
    // roof (flat, a parapet, thick snow, a mast with a red light) + interior floor
    B.concrete.add(rbox(x1 - x0 + 1.2, 0.6, z1 - z0 + 1.2, 0.04), M4((x0 + x1) / 2, roofY + 0.3, (z0 + z1) / 2), [0.66, 0.64, 0.62], { uvScale: 4 });
    B.snow.add(snowCap(x1 - x0 + 1, z1 - z0 + 1, 0.6, 7, 10, 8), M4((x0 + x1) / 2, roofY + 0.85, (z0 + z1) / 2), [0.95, 0.97, 1]);
    icicles(x0, z1 + 0.7, x1, z1 + 0.7, roofY, 34); icicles(x0, z0 - 0.7, x1, z0 - 0.7, roofY, 30);
    B.concreteIn.add(new THREE.BoxGeometry(x1 - x0 - 1, 0.3, z1 - z0 - 1), M4((x0 + x1) / 2, Y - 0.13, (z0 + z1) / 2), [0.5, 0.49, 0.48], { uvScale: 3 });
    roofs.push([x0 - 1, z0 - 1, x1 + 1, z1 + 1, roofY]);
    // the dock edges + the overhead guide rails + the bull wheel at the north end
    for (const tx of TRACK_X) {
      for (const s of [-1.6, 1.6]) B.paintIn.add(new THREE.BoxGeometry(0.25, 0.02, 16), M4(tx + s, Y + 0.012, DOCK.z), (p) => (Math.floor((p.z) / 0.6) % 2 ? [0.75, 0.6, 0.05] : [0.05, 0.05, 0.05]));
      for (const s of [-0.4, 0.4]) B.metal.add(new THREE.BoxGeometry(0.16, 0.24, z1 - z0 + 4), M4(tx + s, Y + 6.3, (z0 + z1) / 2 + 2), [0.32, 0.3, 0.28]);
      // buffers at the end of each dock (the cabin slams into these)
      B.paintIn.add(rbox(1.6, 1.0, 0.8, 0.1), M4(tx, Y + 6.0, DOCK.z - 5.2), [0.65, 0.5, 0.05]);
    }
    { const wx = 85, wz = z0 + 4.5, wy = Y + 5.6; B.paint.add(new THREE.TorusGeometry(5.0, 0.22, 6, 40).rotateX(PI / 2), M4(wx, wy, wz), [0.55, 0.08, 0.05]); for (let k = 0; k < 8; k++) B.paint.add(new THREE.BoxGeometry(10, 0.16, 0.2), M4(wx, wy, wz, 0, k * PI / 8, 0), [0.45, 0.07, 0.05]); B.metal.add(new THREE.CylinderGeometry(0.3, 0.3, 5.6, 10), M4(wx, Y + 2.8, wz), [0.25, 0.25, 0.27]); col(wx - 0.5, Y, wz - 0.5, wx + 0.5, Y + 5, wz + 0.5, { mat: 'metal' }); named.summitWheel = new THREE.Vector3(wx, wy, wz); }
    // sodium lamps
    for (const lx of [72, 85, 98]) for (const lz of [-298, -310]) { B.lamp.add(new THREE.BoxGeometry(0.5, 0.05, 0.3), M4(lx, Y + 7.2, lz), [1.5, 0.95, 0.45]); glows.push({ p: [lx, Y + 7.0, lz], color: SODIUM, size: 1.1 }); pools.push({ p: [lx, Y, lz], c: [0.6, 0.42, 0.2], r: 6, k: 1 }); }
    // crates on the platform (cover in the hall)
    for (const [cx, cz, yaw] of [[70, -300, 0.1], [101, -316, -0.2], [86, -318, 0.3], [70, -316, 0]]) { B.paintIn.add(rbox(1.2, 0.8, 0.8, 0.03), M4(cx, Y + 0.4, cz, 0, yaw, 0), [0.18, 0.21, 0.13]); col(cx - 0.7, Y, cz - 0.6, cx + 0.7, Y + 0.8, cz + 0.6, { kind: 'crate', mat: 'wood' }); }
    // the name over the door (courtyard side)
    const t = signTexture([['GRAUHORN', 110], ['3 412 m  •  STATION', 46]], { w: 1024, h: 256, bg: '#c8c2b4', fg: '#7a1410', border: '#7a1410', font: 'Anton', seed: 31, age: 0.7 });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    sm.position.set(87, Y + 6.2, z0 - 0.02); sm.rotation.y = PI; root.add(sm);
    dressStation({ B, col, glows, root, x0, x1, z0, z1, Y, H, wt: T, seed: 51,
      lamps: [72, 85, 98].flatMap((lx) => [[lx, -298], [lx, -310]]), docks: TRACK_X.map((x) => ({ x, z: DOCK.z, len: 16, door: 1 })), doorZ: z0, doorX: [76, 98] });
    // cream lining above the wainscot on all four inner faces (bare dark concrete inside read as a black box), panel joints, a pale soffit
    {
      const cream = (q) => { const k = 0.88 + 0.12 * Math.min(1, (q.y - Y - 1.4) / 6); return [0.66 * k, 0.63 * k, 0.56 * k]; }, y0 = Y + 1.36;
      for (const [wx, f] of [[x0 + T + 0.015, 1], [x1 - T - 0.015, -1]]) {
        B.paintIn.add(new THREE.BoxGeometry(0.02, H - 1.36, z1 - z0 - 1.4), M4(wx, (y0 + Y + H) / 2, (z0 + z1) / 2), cream);
        for (let z = z0 + 3; z < z1 - 1; z += 3) B.paintIn.add(new THREE.BoxGeometry(0.03, H - 1.4, 0.04), M4(wx + f * 0.01, (y0 + Y + H) / 2, z), [0.42, 0.4, 0.36]);
      }
      for (const [zz, segs] of [[z0 + T + 0.015, [[x0 + T, 76, y0], [98, x1 - T, y0], [76, 98, Y + 4.5]]], [z1 - T - 0.015, [[x0 + T, 72, y0], [98, x1 - T, y0], [72, 98, Y + 9]]]])
        for (const [a, b, ya] of segs) B.paintIn.add(new THREE.BoxGeometry(b - a, Y + H - ya, 0.02), M4((a + b) / 2, (ya + Y + H) / 2, zz), cream);
      B.paintIn.add(new THREE.BoxGeometry(x1 - x0 - 2 * T, 0.03, z1 - z0 - 2 * T), M4((x0 + x1) / 2, roofY - 0.02, (z0 + z1) / 2), [0.5, 0.5, 0.48]);
      // the windows seen from inside: cold daylight panes with deep frames and a sill (the exterior windowRow positions)
      const pane = (xa, xb, n, zz, y, f, w = 1.3, h = 1.6) => { for (let i = 0; i < n; i++) { const x = xa + (i + 0.5) * (xb - xa) / n;
        B.lamp.add(new THREE.BoxGeometry(w, h, 0.02), M4(x, y, zz), [0.36, 0.42, 0.52]);
        for (const [dx, dy, ww, hh] of [[0, h / 2 + 0.06, w + 0.24, 0.12], [0, -h / 2 - 0.06, w + 0.24, 0.12], [-w / 2 - 0.06, 0, 0.12, h], [w / 2 + 0.06, 0, 0.12, h], [0, 0, 0.05, h]]) B.paintIn.add(new THREE.BoxGeometry(ww, hh, 0.12), M4(x + dx, y + dy, zz + f * 0.05), [0.2, 0.22, 0.24]);
        B.paintIn.add(new THREE.BoxGeometry(w + 0.3, 0.05, 0.3), M4(x, y - h / 2 - 0.12, zz + f * 0.15), [0.55, 0.53, 0.5]); } };
      pane(x0 + 2, 74, 4, z0 + T + 0.03, Y + 7, 1); pane(100, x1 - 2, 3, z0 + T + 0.03, Y + 7, 1); pane(x0 + 2, x1 - 2, 9, z1 - T - 0.03, Y + 10.5, -1);
      // daylight spilling in through the courtyard doors (cold, on the dark floor)
      root.add(floorPools([[81, -320.5], [87, -320.5], [93, -320.5], [87, -317]].map(([x, z]) => ({ p: [x, Y + 0.02, z], c: [0.16, 0.2, 0.27], r: 4.5 }))));
    }
  }

  // ---------------------------------------------------------------- the courtyard
  {
    // low walls on the east / west edges (cliffs beyond), sandbag nests, the helipad, a parked snowcat
    for (const [x0, x1] of [[COURT.x0 - 0.8, COURT.x0], [COURT.x1, COURT.x1 + 0.8]]) { B.stone.add(rbox(x1 - x0, 1.0, COURT.z1 - COURT.z0, 0.03), M4((x0 + x1) / 2, Y + 0.5, (COURT.z0 + COURT.z1) / 2), [0.7, 0.69, 0.67], { uvScale: 2.6 }); B.snow.add(snowCap(1.0, COURT.z1 - COURT.z0, 0.2, x0, 1, 12), M4((x0 + x1) / 2, Y + 1.08, (COURT.z0 + COURT.z1) / 2), [0.95, 0.97, 1]); col(x0, Y, COURT.z0, x1, Y + 1, COURT.z1, { kind: 'parapet' }); }
    // helipad: a painted ring + H half buried in snow (vertex-coloured planes just above the ground)
    { const hx = 104, hz = -352; const ring = new THREE.RingGeometry(7.4, 8.0, 40).rotateX(-PI / 2); B.paint.add(ring, M4(hx, Y + 0.03, hz), (p) => (Math.sin(p.x * 1.3 + p.z * 0.7) > -0.2 ? [0.85, 0.7, 0.1] : [0.86, 0.9, 0.97])); for (const [w, d, ox] of [[0.9, 6, -2], [0.9, 6, 2], [4, 0.9, 0]]) B.paint.add(new THREE.PlaneGeometry(w, d).rotateX(-PI / 2), M4(hx + ox, Y + 0.03, hz), (p) => (Math.sin(p.x * 2.1 + p.z) > -0.4 ? [0.8, 0.8, 0.78] : [0.86, 0.9, 0.97])); }
    const sand = (x, z, yaw, n = 6, rows = 3, arc = 0) => { for (let r = 0; r < rows; r++) for (let i = 0; i < n - (r % 2); i++) { const a = yaw + (i - (n - 1) / 2) * arc; const lx = (i - (n - 1) / 2 + (r % 2 ? 0.5 : 0)) * 0.62; B.wood.add(rbox(0.6, 0.24, 0.38, 0.09), M4(x + Math.cos(yaw) * lx, Y + 0.13 + r * 0.24, z - Math.sin(yaw) * lx, 0, a + (rng() - 0.5) * 0.15, 0), () => { const k = 0.32 + rng() * 0.08; return [k * 1.05, k, k * 0.82]; }); } const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), hx = n * 0.31; col(x - c * hx - s * 0.25, Y, z - s * hx - c * 0.25, x + c * hx + s * 0.25, Y + rows * 0.24 + 0.05, z + s * hx + c * 0.25, { kind: 'sandbag' }); B.snow.add(snowCap(n * 0.62, 0.45, 0.12, x, 4, 1), M4(x, Y + rows * 0.24 + 0.08, z, 0, yaw, 0), [0.95, 0.97, 1]); };
    sand(76, -336, 0, 6); sand(96, -340, 0.15, 5); sand(126, -334, -0.1, 6); sand(66, -360, PI / 2, 6); sand(140, -360, PI / 2, 5); sand(112, -368, 0, 7); sand(88, -366, 0.05, 5);
    // ammo crates / jerrycans / a fuel bowser (explosive)
    for (const [cx, cz, yaw] of [[118, -344, 0.2], [84, -356, -0.3], [132, -350, 0.5], [60, -340, 0.1]]) { B.paint.add(rbox(1.2, 0.8, 0.8, 0.03), M4(cx, Y + 0.4, cz, 0, yaw, 0), [0.18, 0.21, 0.13]); B.snow.add(snowCap(1.2, 0.8, 0.1, cx, 3, 2), M4(cx, Y + 0.85, cz, 0, yaw, 0), [0.95, 0.97, 1]); col(cx - 0.7, Y, cz - 0.6, cx + 0.7, Y + 0.8, cz + 0.6, { kind: 'crate', mat: 'wood' }); }
    { const bx = 140, bz = -340; B.paint.add(new THREE.CapsuleGeometry(1.0, 3.2, 6, 14).rotateX(PI / 2), M4(bx, Y + 1.5, bz), [0.32, 0.36, 0.24]); B.paint.add(rbox(2.2, 0.5, 5.4, 0.05), M4(bx, Y + 0.45, bz), [0.15, 0.15, 0.15]); for (const s of [-1, 1]) for (const k of [-1.6, 1.6]) B.paint.add(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12).rotateZ(PI / 2), M4(bx + s * 1.1, Y + 0.42, bz + k), [0.05, 0.05, 0.05]); B.snow.add(snowCap(1.6, 4.6, 0.25, 3, 3, 6), M4(bx, Y + 2.55, bz), [0.95, 0.97, 1]); col(bx - 1.2, Y, bz - 2.7, bx + 1.2, Y + 2.5, bz + 2.7, { kind: 'tank', mat: 'metal' }); explosives.push({ p: new THREE.Vector3(bx, Y + 1.5, bz), r: 1.4, hp: 8, kind: 'bowser', size: 2.6 }); }
    // cover clusters: crate stacks, drums, a sandbag lip, the snow banked up against them (the courtyard was a
    // supply dump; you fight between the piles)
    const cluster = (x, z, yaw, k) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const at = (lx, lz) => [x + cy * lx + sy * lz, z - sy * lx + cy * lz];
      const crateC = () => { const v = rng(); return v < 0.5 ? [0.2, 0.24, 0.15] : v < 0.8 ? [0.36, 0.27, 0.17] : [0.28, 0.3, 0.32]; };
      for (const [lx, lz, h, top] of [[-0.75, 0, 0, 0], [0.75, 0.1, 0, 0], [0, 0.05, 1, 1], [2.2, -0.4, 0, 0]].slice(0, 3 + (k % 2))) {
        const [cx, cz] = at(lx, lz), cc = crateC();
        B.paint.add(rbox(1.4, 1.0, 1.0, 0.03), M4(cx, Y + 0.5 + h * 1.0, cz, 0, yaw + (rng() - 0.5) * 0.2, 0), (q, n, l) => (Math.abs(l.y) > 0.38 || Math.abs(l.x) > 0.6 ? [cc[0] * 0.7, cc[1] * 0.7, cc[2] * 0.7] : cc));
        if (top || h === 0 && lx > 2) B.snow.add(snowCap(1.4, 1.0, 0.14, cx + k, 3, 2), M4(cx, Y + 1.05 + h * 1.0, cz, 0, yaw, 0), [0.95, 0.97, 1]);
      }
      const [ax, az] = at(-0.2, 0); col(ax - 1.6, Y, az - 1.1, ax + 1.6, Y + 2.0, az + 1.1, { kind: 'crate', mat: 'wood' });
      // drums beside the stack (one of them goes up)
      for (let i = 0; i < 3; i++) { const [dx, dz] = at(-2.3 + (i % 2) * 0.66, -0.3 + Math.floor(i / 2) * 0.66); B.paint.add(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 12), M4(dx, Y + 0.44, dz, 0, i, 0), i === 0 ? [0.55, 0.12, 0.06] : [0.12, 0.2, 0.3]); B.snow.add(new THREE.CylinderGeometry(0.29, 0.31, 0.06, 10), M4(dx, Y + 0.91, dz), [0.95, 0.97, 1]); if (i === 0) explosives.push({ p: new THREE.Vector3(dx, Y + 0.45, dz), r: 0.4, hp: 3, kind: 'drum', size: 0.9 }); }
      // the drift banked on the windward side
      const [wx, wz] = at(0, -1.2); B.snow.add(driftWedge(3.6, 0.7, 1.4, k * 7 + 3), M4(wx, Y - 0.05, wz, 0, yaw + PI, 0), (q) => { const kk = 0.86 + 0.14 * Math.min(1, (q.y - Y) / 0.7); return [kk * 0.95, kk * 0.97, kk]; });
    };
    [[70, -348, 0.3], [112, -347, -0.2], [128, -364, 0.4], [76, -370, -0.1], [134, -330, 0.1], [62, -334, PI / 2 - 0.2]].forEach(([x, z, yw], k) => cluster(x, z, yw, k));
    // a floodlight tower that came down (the cable whipped across it?): lying in the snow, its lamp still lit
    { const fx0 = 120, fz0 = -338; B.metal.add(new THREE.CylinderGeometry(0.14, 0.2, 10, 8).rotateZ(PI / 2), M4(fx0, Y + 0.25, fz0, 0, 0.5, 0), [0.45, 0.45, 0.47]); const hx = fx0 + Math.cos(0.5) * 5.2, hz = fz0 - Math.sin(0.5) * 5.2; B.metal.add(rbox(0.5, 1.2, 1.2, 0.04), M4(hx, Y + 0.6, hz, 0, 0.5, 0.3), [0.18, 0.18, 0.18]); B.lamp.add(new THREE.BoxGeometry(0.05, 0.9, 0.9), M4(hx + Math.cos(0.5) * 0.27, Y + 0.6, hz - Math.sin(0.5) * 0.27, 0, 0.5, 0.3), [1.6, 1.15, 0.6]); glows.push({ p: [hx + 0.6, Y + 0.7, hz - 0.3], color: SODIUM, size: 1.8 }); pools.push({ p: [hx + 4, Y, hz - 2], c: [0.6, 0.42, 0.18], r: 7, k: 1 }); col(fx0 - 5, Y, fz0 - 3, fx0 + 5, Y + 0.5, fz0 + 3, { kind: 'pipe', mat: 'metal', noBullet: true }); }
    // burning barrels by the sandbag nests (warm points to fight between)
    for (const [bx, bz] of [[82, -338], [118, -370], [64, -356]]) { B.metal.add(new THREE.CylinderGeometry(0.32, 0.3, 0.95, 12, 1, true), M4(bx, Y + 0.47, bz), [0.16, 0.1, 0.07]); named.barrels = named.barrels || []; named.barrels.push(new THREE.Vector3(bx, Y + 1.0, bz)); pools.push({ p: [bx, Y, bz], c: [0.75, 0.4, 0.14], r: 6, k: 1 }); col(bx - 0.35, Y, bz - 0.35, bx + 0.35, Y + 0.95, bz + 0.35, { kind: 'drum', mat: 'metal' }); }
    // packed slush at the hall doors, the block doors, round the stacks and the bowser
    root.add(groundPatches([{ x: 87, y: Y, z: -328, w: 22, d: 8 }, { x: 90, y: Y, z: -378, w: 6, d: 6 }, { x: 110, y: Y, z: -378, w: 6, d: 6 }, { x: 140, y: Y, z: -340, w: 7, d: 10 }, { x: 70, y: Y, z: -348, w: 8, d: 6 }, { x: 112, y: Y, z: -347, w: 8, d: 6 }, { x: 128, y: Y, z: -364, w: 8, d: 6 }, { x: 96, y: Y, z: -366, w: 10, d: 8 }, { x: 115, y: Y, z: -378, w: 10, d: 5 }]));
    root.add(lanePatches([[[72, -327], [80, -338], [90, -352], [95, -364], [96, -368]], [[60, -330], [84, -334], [110, -340], [130, -346], [140, -344]], [[146, -372], [126, -366], [104, -360], [86, -360], [70, -366], [60, -362]], [[90, -326], [92, -334], [100, -346], [112, -354], [118, -366], [116, -376]]], Y, 6));
    // tracks: the snowcat's belts, the bowser's tyres, a vehicle loop round the helipad
    root.add(trackDecals([
      { pts: [[72, -327], [80, -338], [90, -352], [95, -364], [96, -368]], w: 3.8 },
      { pts: [[60, -330], [84, -334], [110, -340], [130, -346], [140, -344]], w: 2.4 },
      { pts: [[146, -372], [126, -366], [104, -360], [86, -360], [70, -366], [60, -362]], w: 2.6 },
      { pts: [[90, -326], [92, -334], [100, -346], [112, -354], [118, -366], [116, -376]], w: 2.3 },
    ], () => Y));
    // floodlight masts in the corners (sodium) + a searchlight on each
    for (const [mx, mz] of [[58, -326], [148, -326], [148, -376]]) {
      B.metal.add(new THREE.CylinderGeometry(0.12, 0.2, 11, 8), M4(mx, Y + 5.5, mz), [0.5, 0.5, 0.52]);
      const tx = 104, tz = -350, dir = Math.atan2(tx - mx, tz - mz);
      B.metal.add(rbox(1.2, 0.4, 0.4, 0.04), M4(mx, Y + 11, mz, -0.4, dir, 0), [0.18, 0.18, 0.18]);
      glows.push({ p: [mx + Math.sin(dir) * 0.5, Y + 10.8, mz + Math.cos(dir) * 0.5], color: SODIUM, size: 2.0 });
      glows.push({ p: [mx + Math.sin(dir) * 1.2, Y + 10.6, mz + Math.cos(dir) * 1.2], color: [0.8, 0.45, 0.18], size: 4.5 });
      pools.push({ p: [mx + Math.sin(dir) * 14, Y, mz + Math.cos(dir) * 14], c: [0.62, 0.45, 0.22], r: 13, k: 1 });
      root.add(lightCone(new THREE.Vector3(mx + Math.sin(dir) * 0.6, Y + 10.8, mz + Math.cos(dir) * 0.6), new THREE.Vector3(mx + Math.sin(dir) * 14, Y, mz + Math.cos(dir) * 14)));
      col(mx - 0.25, Y, mz - 0.25, mx + 0.25, Y + 11, mz + 0.25, { mat: 'metal' });
    }
    // the enemy snowcat parked by the block (cover)
    { const sx = 96, sz = -372, yaw = PI / 2 + 0.1; const GR = buildGroomer({ seed: 11, paint: [0.32, 0.34, 0.33] }); GR.root.position.set(sx, Y, sz); GR.root.rotation.y = yaw; root.add(GR.root); const c = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw)); col(sx - c * 2.2 - sn * 3.6, Y, sz - sn * 2.2 - c * 3.6, sx + c * 2.2 + sn * 3.6, Y + 3.0, sz + sn * 2.2 + c * 3.6, { kind: 'wreck', mat: 'metal' }); }
  }

  // ---------------------------------------------------------------- the north block (two storeys; the roof walk)
  {
    const { x0, x1, z0, z1, roofY } = BLOCK;
    // front: a rusticated stone ground floor, a pale concrete upper storey (all-stone read as one dark slab), a string course between
    wall(x0, x1, z1 - 0.6, z1, Y, Y + 3.3, B.stone, 2.6, footAO(Y, 2, 0.45, [0.78, 0.77, 0.74]));
    B.concrete.add(rbox(x1 - x0, roofY - Y - 3.3, 0.6, 0.03), M4((x0 + x1) / 2, (Y + 3.3 + roofY) / 2, z1 - 0.3), (q) => { const t = (q.y - Y - 3.3) / (roofY - Y - 3.3); const k = 0.9 + 0.1 * t; return [0.97 * k, 0.93 * k, 0.85 * k]; }, { uvScale: 3.2 });
    col(x0, Y + 3.3, z1 - 0.6, x1, roofY, z1);
    B.concrete.add(rbox(x1 - x0 + 0.4, 0.3, 0.5, 0.04), M4((x0 + x1) / 2, Y + 3.3, z1 + 0.05), [0.62, 0.6, 0.57], { uvScale: 3 });
    B.snow.add(snowCap(x1 - x0 + 0.3, 0.32, 0.08, 71, 14, 1), M4((x0 + x1) / 2, Y + 3.47, z1 + 0.12), [0.95, 0.97, 1]);
    wall(x0, x1, z0, z0 + 0.6, Y, roofY, B.stone, 2.6);
    wall(x1 - 0.6, x1, z0, z1, Y, roofY, B.stone, 2.6);
    windowRow(x0 + 4, x1 - 4, z1, Y + 2.0, 12, 1, 0.5, 1.2, 1.4);
    windowRow(x0 + 4, x1 - 4, z1, Y + 5.6, 12, 1, 0.4, 1.2, 1.4);
    // doors at ground level (enemies come out of these)
    for (const dx of [90, 110]) { B.paint.add(new THREE.BoxGeometry(1.6, 2.4, 0.12), M4(dx, Y + 1.2, z1 + 0.04), [0.2, 0.24, 0.2]); B.lamp.add(new THREE.SphereGeometry(0.14, 8, 6), M4(dx, Y + 2.9, z1 + 0.25), [1.6, 1.0, 0.5]); glows.push({ p: [dx, Y + 2.9, z1 + 0.5], color: WARM, size: 1.6 }); }
    // a painted name band and a cornice line; pilasters every 10 m break the long face
    { const t = signTexture([['FORSCHUNGSSTATION GRAUHORN', 64]], { w: 1024, h: 80, bg: '#cfc8ba', fg: '#3a2a20', border: null, font: 'Anton', seed: 61, age: 0.9 });
      // a fascia panel standing proud of the pilasters, between the two window rows (the letters used to run behind the windows)
      B.concrete.add(rbox(21.2, 1.9, 0.26, 0.04), M4(84, Y + 3.8, z1 + 0.48), [0.6, 0.59, 0.57], { uvScale: 3 });
      B.snow.add(snowCap(21.2, 0.3, 0.08, 61, 8, 1), M4(84, Y + 4.78, z1 + 0.5), [0.95, 0.97, 1]);
      for (const dx of [-10.6, 10.6]) B.metal.add(new THREE.BoxGeometry(0.06, 0.6, 0.3), M4(84 + dx, Y + 3.0, z1 + 0.55), [0.3, 0.3, 0.32]);
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.45), snowLess(t)); sm.position.set(84, Y + 3.8, z1 + 0.62); root.add(sm); }
    B.concrete.add(rbox(x1 - x0 + 0.6, 0.35, 0.7, 0.04), M4((x0 + x1) / 2, Y + 7.6, z1 + 0.1), [0.76, 0.75, 0.73], { uvScale: 3 });
    for (let x = x0 + 5; x < x1; x += 10) B.stone.add(rbox(0.8, BLOCK.roofY - Y, 0.4, 0.03), M4(x, (Y + BLOCK.roofY) / 2, z1 + 0.15), footAO(Y, 2, 0.45, [0.82, 0.8, 0.77]), { uvScale: 2.6 });
    named.blockDoors = [new THREE.Vector3(90, Y, z1 + 1.2), new THREE.Vector3(110, Y, z1 + 1.2)];
    root.add(aoStrips([[105, -382, 72, 3], [70, -324, 12, 3], [103, -324, 10, 3], [96, -372, 4.6, 8, PI / 2 + 0.1]].map(([x, z, w, d, yaw = 0]) => ({ x, y: Y, z, w, d, yaw }))));
    // the roof: slab, the walk's parapet on the courtyard side (gap for the stair landing), sandbag nests, vents
    B.concrete.add(rbox(x1 - x0, 0.5, z1 - z0, 0.03), M4((x0 + x1) / 2, roofY - 0.25, (z0 + z1) / 2), [0.62, 0.6, 0.58], { uvScale: 4 });
    col(x0, Y, z0, x1, roofY, z1);   // the block itself (its top is the roof walk)
    for (const [a, b] of [[x0, LAND_A.x0], [LAND_A.x1, x1]]) {
      B.stone.add(rbox(b - a, 1.05, 0.5, 0.03), M4((a + b) / 2, roofY + 0.52, z1 - 0.25), [0.7, 0.69, 0.67], { uvScale: 2.6 });
      B.snow.add(snowCap(b - a, 0.55, 0.16, a, 10, 1), M4((a + b) / 2, roofY + 1.1, z1 - 0.25), [0.95, 0.97, 1]);
      col(a, roofY, z1 - 0.5, b, roofY + 1.05, z1, { kind: 'parapet' });
    }
    // north edge: a steel railing (the slope rises behind it)
    for (let x = x0 + 1; x < x1; x += 2) B.metal.add(new THREE.BoxGeometry(0.06, 1.1, 0.06), M4(x, roofY + 0.55, z0 + 0.3), [0.4, 0.4, 0.42]);
    B.metal.add(new THREE.BoxGeometry(x1 - x0, 0.06, 0.06), M4((x0 + x1) / 2, roofY + 1.1, z0 + 0.3), [0.4, 0.4, 0.42]);
    col(x0, roofY, z0, x1, roofY + 1.1, z0 + 0.4, { kind: 'rail', noBullet: true });
    for (const [vx, vz, w, d, h] of [[82, -391, 2.4, 1.6, 1.3], [98, -393, 1.8, 1.8, 1.0], [114, -390, 2.6, 1.4, 1.4]]) { B.paintIn.add(rbox(w, h, d, 0.04), M4(vx, roofY + h / 2, vz), (p) => (Math.floor((p.y - roofY) * 7) % 2 ? [0.26, 0.27, 0.28] : [0.14, 0.15, 0.16]));   /* louvres */ B.metal.add(rbox(w + 0.3, 0.12, d + 0.3, 0.03), M4(vx, roofY + h + 0.02, vz), [0.36, 0.37, 0.38]); B.concrete.add(new THREE.BoxGeometry(w + 0.4, 0.2, d + 0.4), M4(vx, roofY + 0.1, vz), [0.5, 0.49, 0.47]); B.snow.add(snowCap(w, d, 0.2, vx, 3, 2), M4(vx, roofY + h + 0.1, vz), [0.95, 0.97, 1]); col(vx - w / 2, roofY, vz - d / 2, vx + w / 2, roofY + h, vz + d / 2, { kind: 'vent', mat: 'metal' }); }
    // sandbag nests on the roof edge (they fire down from these)
    for (const sx of [80, 96, 112]) { for (let i = 0; i < 5; i++) B.wood.add(rbox(0.6, 0.24, 0.38, 0.09), M4(sx - 1.2 + i * 0.6, roofY + 1.17, z1 - 0.35, 0, (rng() - 0.5) * 0.2, 0), () => { const k = 0.32 + rng() * 0.08; return [k * 1.05, k, k * 0.82]; }); }
    // the radome at the east end of the roof (north half: the walk passes south of it)
    { const rx = 132, rz = -392.5; B.concrete.add(new THREE.CylinderGeometry(2.6, 2.9, 1.6, 16), M4(rx, roofY + 0.8, rz), [0.6, 0.6, 0.6], { uvScale: 2 }); const dome = new THREE.SphereGeometry(3.6, 36, 16, 0, PI * 2, 0, PI * 0.62); B.paintIn.add(dome, M4(rx, roofY + 2.2, rz), (p) => { const a = Math.atan2(p.z - rz, p.x - rx), row = Math.floor((p.y - roofY - 2.2) / 0.9); const col_ = Math.floor(a / (PI / 9) + row * 0.5); const k = (col_ + row) % 2 ? 0.84 : 0.74; const st = (row + 9) % 3 === 0 ? 0.92 : 1; return [k * st, k * st, k * st * 1.02]; }); col(rx - 3.4, roofY, rz - 3.4, rx + 3.4, roofY + 5, rz + 3.4, { kind: 'radome' }); for (const th of [0.22, 0.38, 0.52]) B.metal.add(new THREE.TorusGeometry(3.6 * Math.sin(th * PI) + 0.02, 0.045, 4, 40).rotateX(PI / 2), M4(rx, roofY + 2.2 + 3.6 * Math.cos(th * PI), rz), [0.3, 0.31, 0.33]); for (let k = 0; k < 10; k++) B.metal.add(new THREE.TorusGeometry(3.62, 0.04, 4, 20, 0.62 * PI).rotateZ(-0.12 * PI), M4(rx, roofY + 2.2, rz, 0, k * PI / 5, 0), [0.3, 0.31, 0.33]);   /* the panel lattice */ B.snow.add(new THREE.SphereGeometry(2.1, 18, 6, 0, PI * 2, 0, PI * 0.42), M4(rx, roofY + 4.05, rz, 0, 0, 0, 1, 0.55, 1), [0.95, 0.97, 1]); B.concrete.add(rbox(2.9, 0.5, 2.9, 0.04).translate(0, 0, 0), M4(rx, roofY + 0.25, rz), [0.38, 0.38, 0.4]); B.paint.add(new THREE.BoxGeometry(0.9, 1.3, 0.08), M4(rx, roofY + 0.75, rz + 2.85), [0.22, 0.25, 0.22]); B.lamp.add(new THREE.BoxGeometry(0.14, 0.14, 0.06), M4(rx + 0.6, roofY + 1.55, rz + 2.9), [1.8, 0.4, 0.1]); glows.push({ p: [rx, roofY + 6.2, rz], color: RED, size: 1.2, blink: true, rate: 2.0, far: true }); B.metal.add(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), M4(rx, roofY + 5.7, rz), [0.3, 0.3, 0.3]); named.radome = new THREE.Vector3(rx, roofY + 2.5, rz); }
    icicles(x0, z1 + 0.6, x1, z1 + 0.6, roofY - 0.4, 50, 1.2);
    roofs.push([x0, z0, x1, z1, roofY - 0.5]);
  }

  // ---------------------------------------------------------------- stair A (courtyard → roof walk), stair B (roof → tower terrace)
  const steelStair = (sx0, sx1, sz0, sz1, y0, y1, alongX, railSides) => {
    const L = alongX ? sx1 - sx0 : sz1 - sz0, W = alongX ? sz1 - sz0 : sx1 - sx0, n = Math.round((y1 - y0) / 0.19);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, h = y0 + (y1 - y0) * (i + 1) / n;
      const cx = alongX ? sx0 + L * t : (sx0 + sx1) / 2, cz = alongX ? (sz0 + sz1) / 2 : sz1 - L * t;
      B.metal.add(new THREE.BoxGeometry(alongX ? L / n + 0.02 : W - 0.1, 0.05, alongX ? W - 0.1 : L / n + 0.02), M4(cx, h - 0.03, cz), [0.32, 0.31, 0.3]);
      B.snow.add(new THREE.BoxGeometry(alongX ? L / n * 0.7 : W - 0.4, 0.04, alongX ? W - 0.4 : L / n * 0.7), M4(cx, h + 0.01, cz), [0.92, 0.95, 1]);
    }
    // stringers + railings
    const pitch = Math.atan2(y1 - y0, L);
    for (const s of [0, 1]) {
      const ex = alongX ? (sx0 + sx1) / 2 : (s ? sx1 : sx0), ez = alongX ? (s ? sz1 : sz0) : (sz0 + sz1) / 2, ey = (y0 + y1) / 2;
      B.paint.add(new THREE.BoxGeometry(alongX ? L / Math.cos(pitch) : 0.08, 0.3, alongX ? 0.08 : L / Math.cos(pitch)), M4(ex, ey - 0.15, ez, alongX ? 0 : pitch, 0, alongX ? pitch : 0), [0.42, 0.18, 0.08]);
      if (railSides.includes(s)) {
        B.paint.add(new THREE.BoxGeometry(alongX ? L / Math.cos(pitch) : 0.06, 0.06, alongX ? 0.06 : L / Math.cos(pitch)), M4(ex, ey + 1.0, ez, alongX ? 0 : pitch, 0, alongX ? pitch : 0), [0.85, 0.65, 0.08]);
        for (let k = 0; k <= 6; k++) { const t = k / 6; const px = alongX ? sx0 + L * t : ex, pz = alongX ? ez : sz1 - L * t, py = y0 + (y1 - y0) * t; B.metal.add(new THREE.BoxGeometry(0.05, 1.0, 0.05), M4(px, py + 0.5, pz), [0.4, 0.4, 0.42]); }
      }
    }
  };
  steelStair(STAIR_A.x0, STAIR_A.x1, STAIR_A.z0, STAIR_A.z1, STAIR_A.y0, STAIR_A.y1, true, [1]);
  col(STAIR_A.x0 + 1.4, Y, STAIR_A.z1 - 0.12, STAIR_A.x1, BLOCK.roofY + 1.1, STAIR_A.z1 + 0.05, { kind: 'rail', noBullet: true });   // its outer rail (enter at the bottom)
  // the landing at the top
  B.metal.add(new THREE.BoxGeometry(LAND_A.x1 - LAND_A.x0, 0.12, LAND_A.z1 - LAND_A.z0), M4((LAND_A.x0 + LAND_A.x1) / 2, BLOCK.roofY - 0.06, (LAND_A.z0 + LAND_A.z1) / 2), [0.32, 0.31, 0.3]);
  col(LAND_A.x0, BLOCK.roofY, LAND_A.z1 - 0.1, LAND_A.x1, BLOCK.roofY + 1.1, LAND_A.z1 + 0.05, { kind: 'rail', noBullet: true });
  col(LAND_A.x1 - 0.1, BLOCK.roofY, LAND_A.z0, LAND_A.x1 + 0.05, BLOCK.roofY + 1.1, LAND_A.z1, { kind: 'rail', noBullet: true });
  steelStair(STAIR_B.x0, STAIR_B.x1, STAIR_B.z0, STAIR_B.z1, STAIR_B.y0, STAIR_B.y1, false, [1]);
  col(STAIR_B.x1 - 0.05, BLOCK.roofY, STAIR_B.z0, STAIR_B.x1 + 0.1, TOWER.roofY + 1.1, STAIR_B.z1 - 2.2, { kind: 'rail', noBullet: true });
  B.metal.add(new THREE.BoxGeometry(LAND_B.x1 - LAND_B.x0, 0.12, LAND_B.z1 - LAND_B.z0), M4((LAND_B.x0 + LAND_B.x1) / 2, TOWER.roofY - 0.06, (LAND_B.z0 + LAND_B.z1) / 2), [0.32, 0.31, 0.3]);
  col(LAND_B.x1 - 0.05, TOWER.roofY, LAND_B.z0, LAND_B.x1 + 0.1, TOWER.roofY + 1.1, LAND_B.z1, { kind: 'rail', noBullet: true });

  // ---------------------------------------------------------------- the observatory tower + dome
  {
    const { x0, x1, z0, z1, roofY } = TOWER;
    wall(x0, x1, z0, z1, Y, roofY, B.stone, 2.4, footAO(Y, 3, 0.45, [0.74, 0.72, 0.7]));
    windowRow(x0 + 3, x1 - 3, z1, Y + 4, 3, 1, 0.6, 1.0, 2.0); windowRow(x0 + 3, x1 - 3, z1, Y + 9.5, 3, 1, 0.7, 1.0, 2.0);
    B.concrete.add(rbox(x1 - x0 + 0.4, 0.4, z1 - z0 + 0.4, 0.03), M4((x0 + x1) / 2, roofY - 0.2, (z0 + z1) / 2), [0.64, 0.62, 0.6], { uvScale: 4 });
    // the terrace railing (gap on the east side at the landing), a parapet on the south
    B.stone.add(rbox(x1 - x0, 1.0, 0.45, 0.03), M4((x0 + x1) / 2, roofY + 0.5, z1 - 0.22), [0.7, 0.69, 0.67], { uvScale: 2.6 }); col(x0, roofY, z1 - 0.45, x1, roofY + 1.0, z1, { kind: 'parapet' });
    B.stone.add(rbox(0.45, 1.0, z1 - z0, 0.03), M4(x0 + 0.22, roofY + 0.5, (z0 + z1) / 2), [0.7, 0.69, 0.67], { uvScale: 2.6 }); col(x0, roofY, z0, x0 + 0.45, roofY + 1.0, z1, { kind: 'parapet' });
    for (let x = x0 + 1; x < x1; x += 1.6) B.metal.add(new THREE.BoxGeometry(0.05, 1.1, 0.05), M4(x, roofY + 0.55, z0 + 0.2), [0.4, 0.4, 0.42]);
    B.metal.add(new THREE.BoxGeometry(x1 - x0, 0.06, 0.06), M4((x0 + x1) / 2, roofY + 1.1, z0 + 0.2), [0.4, 0.4, 0.42]); col(x0, roofY, z0, x1, roofY + 1.1, z0 + 0.3, { kind: 'rail', noBullet: true });
    col(x1 - 0.2, roofY, z1, x1 + 0.1, roofY + 1.1, LAND_B.z1 - 0.2, { kind: 'rail', noBullet: true });
    B.snow.add(snowCap(x1 - x0 - 1, z1 - z0 - 1, 0.25, 77, 8, 8), M4((x0 + x1) / 2, roofY + 0.05, (z0 + z1) / 2), [0.95, 0.97, 1]);
    icicles(x0, z1 + 0.4, x1, z1 + 0.4, roofY - 0.4, 22, 1.4);
    // the dome: a drum + a ribbed silver hemisphere with the slit open toward the face (north)
    const [dx, dz] = TOWER.dome, R = TOWER.domeR;
    B.concrete.add(new THREE.CylinderGeometry(R, R, 2.2, 28), M4(dx, roofY + 1.1, dz), [0.72, 0.7, 0.68], { uvScale: 3 });
    const hemi = new THREE.SphereGeometry(R * 1.02, 32, 12, 0, PI * 2, 0, PI / 2);
    { const P = hemi.attributes.position; const idx = hemi.index; const keep = []; for (let i = 0; i < idx.count; i += 3) { let cxs = 0, czs = 0; for (let k = 0; k < 3; k++) { cxs += P.getX(idx.getX(i + k)); czs += P.getZ(idx.getX(i + k)); } if (!(Math.abs(cxs / 3) < 0.9 && czs / 3 < 0)) keep.push(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)); } hemi.setIndex(keep); }
    B.metal.add(hemi, M4(dx, roofY + 2.2, dz), (p) => { const a = Math.atan2(p.z - dz, p.x - dx); const rib = Math.abs(Math.sin(a * 12)) > 0.95 ? 0.6 : 0.82; return [rib, rib, rib * 1.02]; });
    B.lamp.add(new THREE.PlaneGeometry(1.6, 4.5), M4(dx, roofY + 4.0, dz - R * 0.55, -0.6, 0, 0), [0.9, 0.55, 0.25]);   // warm light inside the slit
    glows.push({ p: [dx, roofY + 4.5, dz - R * 0.6], color: [1.6, 0.9, 0.4], size: 3.0 });
    // the telescope inside the slit
    B.paint.add(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 12), M4(dx, roofY + 3.6, dz - 0.8, -0.85, 0, 0), [0.75, 0.73, 0.68]);
    col(dx - R, roofY, dz - R, dx + R, roofY + 2.5, dz + R, { kind: 'dome' });
    named.dome = new THREE.Vector3(dx, roofY + 4, dz);
    // the antenna mast on the tower's NE corner (rimed lattice, red lights) — a silhouette for the storm
    const ax = x0 + 2, az = z0 + 2;   // NW corner: out of the terrace's view up the face
    B.concrete.add(rbox(1.6, 0.8, 1.6, 0.05), M4(ax, roofY + 0.4, az), [0.6, 0.59, 0.57]);
    for (const [gx, gz] of [[1, 1], [1, 0], [0, 1]]) {   // guy wires down to the parapet
      const a = new THREE.Vector3(ax + gx * 7, roofY + 1.2, az + gz * 7), b = new THREE.Vector3(ax, roofY + 13, az), d = b.clone().sub(a), L = d.length();
      const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
      B.metal.add(new THREE.CylinderGeometry(0.02, 0.02, L, 4), m, [0.3, 0.3, 0.32]);
    }
    for (let i = 0; i < 18; i++) { const h = roofY + i * 1.0; for (const [ox, oz] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) B.metal.add(new THREE.BoxGeometry(0.06, 1.02, 0.06), M4(ax + ox, h + 0.5, az + oz), [0.55, 0.56, 0.58]); B.metal.add(new THREE.BoxGeometry(0.62, 0.04, 0.04), M4(ax, h + 0.95, az - 0.3, 0, 0, i % 2 ? 0.8 : -0.8), [0.55, 0.56, 0.58]); }
    glows.push({ p: [ax, roofY + 18.4, az], color: RED, size: 1.3, blink: true, rate: 1.6, far: true });
    glows.push({ p: [ax, roofY + 9, az], color: RED, size: 0.9, blink: true, rate: 1.6, far: true });
    roofs.push([x0, z0, x1, z1, roofY - 0.4]);
    named.terrace = new THREE.Vector3((x0 + x1) / 2, roofY, z1 - 3);
  }

  // ---------------------------------------------------------------- the avalanche gallery (rack railway) + tunnel portal
  {
    const { x0, x1, z0, z1, roofY } = GALLERY, gy = GALLERY.y;
    // floor slab, the rack railway (two rails + the toothed rack), sleepers
    B.concreteIn.add(new THREE.BoxGeometry(x1 - x0 + 4, 0.4, z1 - z0), M4((x0 + x1) / 2 + 2, gy - 0.2, (z0 + z1) / 2), [0.6, 0.59, 0.57], { uvScale: 3 });
    const rz = -391.5;
    B.concreteIn.add(new THREE.BoxGeometry(x1 - x0 + 12, 0.08, 3.2), M4((x0 + x1) / 2 + 6, gy + 0.02, rz), [0.3, 0.3, 0.31], { uvScale: 1.2 });   // the ballast bed
    for (let x = x0 + 2; x < x1 + 12; x += 0.7) B.paintIn.add(new THREE.BoxGeometry(0.22, 0.12, 2.4), M4(x, gy + 0.08, rz), () => { const k = 0.1 + rng() * 0.025; return [k * 1.2, k, k * 0.85]; });
    for (const s of [-0.5, 0.5]) B.metal.add(new THREE.BoxGeometry(x1 - x0 + 14, 0.14, 0.08), M4((x0 + x1) / 2 + 6, gy + 0.19, rz + s), [0.35, 0.33, 0.32]);
    B.metal.add(new THREE.BoxGeometry(x1 - x0 + 14, 0.18, 0.12), M4((x0 + x1) / 2 + 6, gy + 0.22, rz), (p) => (Math.floor(p.x * 6) % 2 ? [0.3, 0.28, 0.26] : [0.18, 0.17, 0.16]));
    // the back (mountain) wall: dressed stone
    wall(x0, x1, z0 - 1.0, z0, gy, roofY + 0.3, B.stone, 2.4);
    // the roof slab: deep, sloped toward the open south side (the snow slides off it), resting on pillars
    const slabT = 0.9;
    B.concrete.add(rbox(x1 - x0 + 0.4, slabT, z1 - z0 + 3.4, 0.05), M4((x0 + x1) / 2, roofY + slabT / 2, (z0 + z1) / 2 - 0.6, -0.06, 0, 0), [0.6, 0.59, 0.57], { uvScale: 4 });
    B.snow.add(snowCap(x1 - x0 + 0.2, z1 - z0 + 3.2, 0.9, 41, 16, 4), M4((x0 + x1) / 2, roofY + slabT + 0.45, (z0 + z1) / 2 - 0.6, -0.06, 0, 0), [0.95, 0.97, 1]);
    icicles(x0, z1 + 1.0, x1, z1 + 1.0, roofY + 0.5, 60, 1.4);   // the slab tilts up to the south: its lip is ~0.5 m higher
    for (let x = x0 + 6; x < x1; x += 6.5) {
      B.concrete.add(rbox(0.9, roofY - gy, 0.9, 0.04), M4(x, (gy + roofY) / 2, z1 - 0.45), footAO(gy, 1.2, 0.4, [0.74, 0.73, 0.71]), { uvScale: 2.4 });
      col(x - 0.45, gy, z1 - 0.9, x + 0.45, roofY, z1);
      // the low wall between pillars (you don't fall out)
      B.concrete.add(rbox(5.6, 0.9, 0.35, 0.03), M4(x + 3.25, gy + 0.45, z1 - 0.2), [0.7, 0.69, 0.67], { uvScale: 2.4 });
    }
    col(x0 + 6, gy, z1 - 0.4, x1, gy + 0.9, z1, { kind: 'parapet' });
    // lamps under the roof (cold fluorescent strips + one warm one at the portal)
    const gp = [];
    for (let x = x0 + 9; x < x1; x += 13) { B.lamp.add(new THREE.BoxGeometry(1.4, 0.06, 0.18), M4(x, roofY - 0.08, -393), [1.7, 1.15, 0.55]); glows.push({ p: [x, roofY - 0.25, -393], color: [2.2, 1.35, 0.5], size: 1.2 }); gp.push({ p: [x, gy, -390], c: [0.45, 0.29, 0.11], r: 6.5 }); }
    root.add(floorPools(gp));
    // the tunnel portal: an arched concrete face into the rock, black inside
    const px = GALLERY.portal;
    B.concrete.add(rbox(1.5, roofY - gy + 3, z1 - z0 + 4, 0.05), M4(px + 0.75, (gy + roofY + 3) / 2, (z0 + z1) / 2), cA(gy), { uvScale: 3 });
    { const tb = new THREE.Mesh(new THREE.BoxGeometry(40, roofY - gy - 0.6, 7.4), new THREE.MeshBasicMaterial({ color: 0x050607, side: THREE.DoubleSide, fog: false })); tb.position.set(px + 20.5, gy - 0.05 + (roofY - gy - 0.6) / 2, rz); root.add(tb); }   // the dark beyond: double-sided, black from the gallery AND from inside when you ride in
    const portal = signTexture([['GRAUHORN-TUNNEL', 64], ['ZAHNRADBAHN  •  1912', 40]], { w: 512, h: 192, bg: '#bdb6a8', fg: '#2a2622', border: '#2a2622', seed: 51, age: 0.8 });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshStandardMaterial({ map: portal, roughness: 0.8 }));
    pm.position.set(px - 0.02, roofY - 0.9, rz); pm.rotation.y = -PI / 2; root.add(pm);
    glows.push({ p: [px - 0.5, roofY - 0.4, rz + 3], color: WARM, size: 1.4 });
    roofs.push([x0, z0 - 1, x1 + 12, z1 + 1.5, roofY]);
    named.galleryMouth = new THREE.Vector3(x0 + 2, gy, (z0 + z1) / 2);
    named.gallerySafe = new THREE.Vector3(x0 + 46, gy, (z0 + z1) / 2 + 1);
    named.railcar = new THREE.Vector3(RAILCAR.x, gy, RAILCAR.z);
  }

  // ---------------------------------------------------------------- snow drifted against the walls (the wind banks it up on the faces)
  const drift = (x0, x1, z, face, h, seed) => { const L = x1 - x0; B.snow.add(driftWedge(L, h, h * 1.9, seed), M4((x0 + x1) / 2, Y - 0.05, z, 0, face > 0 ? 0 : Math.PI, 0), (p) => { const k = 0.86 + 0.14 * Math.min(1, (p.y - Y) / h); return [k * 0.95, k * 0.97, k]; }); };
  const driftZ = (z0, z1, x, face, h, seed) => { const L = z1 - z0; B.snow.add(driftWedge(L, h, h * 1.9, seed), M4(x, Y - 0.05, (z0 + z1) / 2, 0, face > 0 ? Math.PI / 2 : -Math.PI / 2, 0), (p) => { const k = 0.86 + 0.14 * Math.min(1, (p.y - Y) / h); return [k * 0.95, k * 0.97, k]; }); };
  drift(BLOCK.x0 + 1, 88, BLOCK.z1 + 0.05, 1, 1.1, 3); drift(92, 108, BLOCK.z1 + 0.05, 1, 0.9, 5); drift(127, BLOCK.x1 - 1, BLOCK.z1 + 0.05, 1, 1.3, 7);
  drift(HALL.x0 + 1, 75, HALL.z0 - 0.05, -1, 1.2, 9); drift(99, HALL.x1 - 1, HALL.z0 - 0.05, -1, 1.0, 11);
  drift(TOWER.x0 + 1, TOWER.x1 - 1, TOWER.z1 + 0.05, 1, 1.4, 13);
  driftZ(COURT.z0 + 2, COURT.z1 - 2, COURT.x0 + 0.05, 1, 0.9, 15); driftZ(COURT.z0 + 2, COURT.z1 - 8, COURT.x1 - 0.05, -1, 0.8, 17);

  // ---------------------------------------------------------------- rock: the saddle's boulders round the station (big, snow-capped)
  for (const [x, z, s] of [[44, -300, 6], [40, -330, 8], [158, -312, 7], [166, -350, 5], [246, -392, 7]]) {
    let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const v = new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)); v.multiplyScalar(1 + Math.sin(v.x * 3 + x) * 0.18 + Math.sin(v.z * 4 + z) * 0.12 + Math.sin(v.y * 9 + v.x * 7) * 0.04); v.y *= 0.7; P.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals();
    const r0 = s * 1.1, gy0 = Math.min(terrainAt(x, z), terrainAt(x + r0, z), terrainAt(x - r0, z), terrainAt(x, z + r0), terrainAt(x, z - r0)); B.rock.add(g, M4(x, gy0 - s * 0.3, z, rng(), rng() * 6, 0, s * 1.2, s, s), [0.8, 0.8, 0.8], { uvScale: 5 });
  }

  for (const [k, b] of Object.entries(B)) {
    if (!b.vn) continue;
    const m = k === 'lamp' ? mats.lamp() : mats[k]();
    root.add(b.mesh(m, { shadow: k !== 'lamp' && k !== 'snow' && k !== 'glass', name: 'fort-' + k }));
  }

  // ---------------------------------------------------------------- searchlights (volumetric cones through the snow), sweeping
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uK: { value: 1 } },
    vertexShader: /* glsl */`varying float vT; varying vec3 vN; varying vec3 vV; void main(){ vT = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform float uK; varying float vT; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = pow(vT, 2.2) * edge * 0.1 * uK; gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * a, 0.0); }`,
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide, fog: false,
  });
  const beamGeo = new THREE.ConeGeometry(5, 60, 20, 1, true); beamGeo.translate(0, -35, 0); beamGeo.rotateX(-PI / 2);   // apex at the origin, pointing -z
  for (const [bx, by, bz, a0] of [[TOWER.x1 - 3, TOWER.roofY + 1.6, TOWER.z1 - 2, 0.6], [BLOCK.x0 + 20, BLOCK.roofY + 1.4, BLOCK.z1 - 1, -0.4], [HALL.x1 - 3, HALL.roofY + 1.6, HALL.z1 - 2, 2.6]]) {
    const head = new THREE.Group(); head.position.set(bx, by, bz);
    const m = new THREE.Mesh(beamGeo, beamMat); m.renderOrder = 22; m.frustumCulled = false; head.add(m);
    const lampG = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 12).rotateX(PI / 2), mats.paint()); head.add(lampG);
    root.add(head);
    beams.push({ head, a0, ph: rng() * 6, glow: { p: new THREE.Vector3(), color: [3.0, 2.6, 2.0], size: 2.2 } });
    glows.push(beams[beams.length - 1].glow);
  }
  named.beams = beams;

  return {
    root, colliders, roofs,
    update(dt, t, storm) {
      for (const b of beams) {
        const yaw = b.a0 + Math.sin(t * 0.23 + b.ph) * 0.9, pitch = -0.18 + Math.sin(t * 0.31 + b.ph * 2) * 0.12;
        b.head.rotation.set(pitch, yaw, 0, 'YXZ');
        b.head.updateMatrixWorld(true);
        b.glow.p.set(0, 0, -0.6).applyMatrix4(b.head.matrixWorld);
        b.head.children[0].visible = storm > 0.25;
      }
      beamMat.uniforms.uK.value = Math.min(1, storm * 1.3);
    },
    anchors: { glows, pools, named: { ...named, explosivesFort: explosives }, plumes: [] },
  };
}
