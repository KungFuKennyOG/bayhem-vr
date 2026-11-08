import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { YARD, MID, MID_HALL, TRACK_X, LINE, PYLON, HALL, DOCK, lineY, terrainAt, groundAt, SNIPERS } from './layout.js';
import { Bucket, M4, mats, rbox, snowCap, footAO, driftWedge, trackDecals } from './kit.js';
import { signTexture } from './tex.js';

// =====================================================================================
//  GRAUHORN-BAHN: the Mittelstation (a 60s concrete station with a raking roof, the bull wheel and
//  the haul machinery visible through the glazed north end, sodium lamps over the platform, the
//  control room), its yard (groomer shed, fuel tank, floodlight masts, containers), the ropes across
//  the gorge (two tracks: track rope + haul rope each), and the lattice pylon on the rock rib.
// =====================================================================================
const PI = Math.PI;
const SODIUM = [2.8, 1.5, 0.55], WARM = [2.6, 1.55, 0.7];

export function buildStation(ctx) {
  const root = new THREE.Group();
  const rng = makeRng(777);
  const B = { stone: new Bucket(), concreteIn: new Bucket(), paintIn: new Bucket(), concrete: new Bucket(), paint: new Bucket(), metal: new Bucket(), lamp: new Bucket(), snow: new Bucket(), wood: new Bucket(), dark: new Bucket(), glass: new Bucket() };
  const colliders = [], glows = [], pools = [], named = {}, explosives = [];
  const col = (x0, y0, z0, x1, y1, z1, data = {}) => colliders.push({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], data: { mat: 'concrete', ...data } });
  const Y = MID.y;

  // ---------------------------------------------------------------- the station building
  {
    const { x0, x1, z0, z1 } = MID, wallT = 0.5, H = 7.5;
    const cA = footAO(Y, 1.4, 0.4, [0.86, 0.85, 0.83]);
    // west / east walls (solid), the south front with the big door, the north end open for the cables
    B.concrete.add(rbox(wallT, H, z1 - z0, 0.03), M4(x0 + wallT / 2, Y + H / 2, (z0 + z1) / 2), cA, { uvScale: 3.2 });
    B.concrete.add(rbox(wallT, H, z1 - z0, 0.03), M4(x1 - wallT / 2, Y + H / 2, (z0 + z1) / 2), cA, { uvScale: 3.2 });
    col(x0, Y, z0, x0 + wallT, Y + H, z1); col(x1 - wallT, Y, z0, x1, Y + H, z1);
    // south front: piers either side of the doorway (x 72..98)
    for (const [a, b] of [[x0, 72], [98, x1]]) { B.concrete.add(rbox(b - a, H, wallT, 0.03), M4((a + b) / 2, Y + H / 2, z1 - wallT / 2), cA, { uvScale: 3.2 }); col(a, Y, z1 - wallT, b, Y + H, z1); }
    B.concrete.add(rbox(26, 2.8, wallT, 0.03), M4(85, Y + H - 1.4, z1 - wallT / 2), cA, { uvScale: 3.2 });   // lintel
    // north end: a tall frame with glazing above the cable opening
    for (const xx of [x0 + 1, 76, 94, x1 - 1]) B.concrete.add(rbox(1.2, H + 2, 0.8), M4(xx, Y + (H + 2) / 2, z0 + 0.4), cA, { uvScale: 3.2 });
    for (const [a, b] of [[x0 + 1.6, 75.4], [94.6, x1 - 1.6]]) { B.concrete.add(rbox(b - a, 2.5, 0.4), M4((a + b) / 2, Y + 1.25, z0 + 0.4), cA, { uvScale: 3.2 }); col(a, Y, z0, b, Y + 2.5, z0 + 0.8); }
    B.glass.add(new THREE.PlaneGeometry(x1 - x0 - 2, 4.5), M4((x0 + x1) / 2, Y + H - 0.5, z0 + 0.35, 0, PI, 0));
    // the raking roof: rises toward the north (the cables leave under its high end), deep eaves, snow quilt
    const roofL = (z1 - z0) + 3, pitch = Math.atan2(4.5, z1 - z0);
    B.concrete.add(rbox(x1 - x0 + 2.4, 0.5, roofL, 0.05), M4((x0 + x1) / 2, Y + H + 2.3, (z0 + z1) / 2, -pitch, 0, 0), [0.62, 0.6, 0.58], { uvScale: 4 });
    B.snow.add(snowCap(x1 - x0 + 2.2, roofL - 0.2, 0.55, 3, 12, 8), M4((x0 + x1) / 2, Y + H + 2.75, (z0 + z1) / 2, -pitch, 0, 0), [0.95, 0.97, 1]);
    // icicles off the front eave
    for (let i = 0; i < 40; i++) { const il = 0.2 + rng() * rng() * 1.2; B.snow.add(new THREE.ConeGeometry(0.04 + il * 0.025, il, 5).rotateX(PI), M4(x0 - 0.8 + i * (x1 - x0 + 1.6) / 39, Y + H + 0.1 - il / 2, z1 + 1.4), [0.72, 0.8, 0.95]); }
    // platform floor + the dock edges (yellow-black) along each track
    B.concreteIn.add(new THREE.BoxGeometry(x1 - x0 - 1, 0.3, z1 - z0 - 1), M4((x0 + x1) / 2, Y - 0.13, (z0 + z1) / 2), [0.5, 0.49, 0.48], { uvScale: 3 });
    for (const tx of TRACK_X) {
      for (const s of [-1.6, 1.6]) B.paintIn.add(new THREE.BoxGeometry(0.25, 0.02, 12), M4(tx + s, Y + 0.012, -8), (p) => (Math.floor((p.z) / 0.6) % 2 ? [0.75, 0.6, 0.05] : [0.05, 0.05, 0.05]));
      // overhead guide rails the carriage runs on inside the station
      for (const s of [-0.4, 0.4]) B.metal.add(new THREE.BoxGeometry(0.16, 0.24, z1 - z0), M4(tx + s, Y + 6.3, (z0 + z1) / 2), [0.32, 0.3, 0.28]);
    }
    // the bull wheel (horizontal, under the roof at the north end) + its frame
    {
      const wx = 85, wz = z0 + 4, wy = Y + 5.6;
      const ring = new THREE.TorusGeometry(5.0, 0.22, 6, 40).rotateX(PI / 2);
      B.paint.add(ring, M4(wx, wy, wz), [0.55, 0.08, 0.05]);
      for (let k = 0; k < 8; k++) B.paint.add(new THREE.BoxGeometry(10, 0.16, 0.2), M4(wx, wy, wz, 0, k * PI / 8, 0), [0.45, 0.07, 0.05]);
      B.metal.add(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12), M4(wx, wy, wz), [0.3, 0.3, 0.32]);
      B.metal.add(new THREE.CylinderGeometry(0.3, 0.3, 5.6, 10), M4(wx, Y + 2.8, wz), [0.25, 0.25, 0.27]);
      B.paintIn.add(rbox(3.0, 1.8, 2.2, 0.08), M4(wx - 8, Y + 0.9, wz + 1), [0.2, 0.32, 0.22]);   // drive motor housing
      col(wx - 0.5, Y, wz - 0.5, wx + 0.5, Y + 5, wz + 0.5, { mat: 'metal' });
      named.bullWheel = new THREE.Vector3(wx, wy, wz);
    }
    // sodium lamps over the platform (warm), and the control room (glazed box in the south-east corner, lit)
    for (const lx of [72, 85, 98]) for (const lz of [-12, -2]) {
      B.metal.add(new THREE.BoxGeometry(0.6, 0.18, 0.4), M4(lx, Y + 6.9, lz), [0.2, 0.2, 0.2]);
      B.lamp.add(new THREE.BoxGeometry(0.5, 0.05, 0.3), M4(lx, Y + 6.8, lz), [1.5, 0.95, 0.45]);
      glows.push({ p: [lx, Y + 6.6, lz], color: SODIUM, size: 1.1 });
      pools.push({ p: [lx, Y, lz], c: [0.6, 0.42, 0.2], r: 6, k: 1 });
    }
    {
      const cx0 = 98, cx1 = x1 - 0.6, cz0 = -2, cz1 = z1 - 0.6;
      B.concrete.add(rbox(cx1 - cx0, 1.1, 0.25), M4((cx0 + cx1) / 2, Y + 0.55, cz0), [0.7, 0.69, 0.67], { uvScale: 2 });
      B.concrete.add(rbox(0.25, 1.1, cz1 - cz0), M4(cx0, Y + 0.55, (cz0 + cz1) / 2), [0.7, 0.69, 0.67], { uvScale: 2 });
      B.glass.add(new THREE.PlaneGeometry(cx1 - cx0, 1.6), M4((cx0 + cx1) / 2, Y + 1.9, cz0, 0, PI, 0));
      B.glass.add(new THREE.PlaneGeometry(cz1 - cz0, 1.6), M4(cx0, Y + 1.9, (cz0 + cz1) / 2, 0, -PI / 2, 0));
      B.concreteIn.add(new THREE.BoxGeometry(cx1 - cx0, 0.2, cz1 - cz0), M4((cx0 + cx1) / 2, Y + 2.8, (cz0 + cz1) / 2), [0.6, 0.6, 0.6]);
      B.paintIn.add(rbox(3.2, 0.9, 0.8, 0.03), M4((cx0 + cx1) / 2, Y + 0.45, cz0 + 1.2), [0.3, 0.33, 0.36]);  // the console
      for (let i = 0; i < 10; i++) B.lamp.add(new THREE.BoxGeometry(0.08, 0.02, 0.08), M4(cx0 + 2.6 + i * 0.25, Y + 0.92, cz0 + 1.0), i % 3 ? [0.2, 1.6, 0.3] : [1.8, 0.3, 0.1]);
      B.lamp.add(new THREE.BoxGeometry(1.2, 0.05, 0.6), M4((cx0 + cx1) / 2, Y + 2.65, (cz0 + cz1) / 2), [1.3, 1.25, 1.1]);
      glows.push({ p: [(cx0 + cx1) / 2, Y + 2.3, (cz0 + cz1) / 2], color: [1.6, 1.5, 1.3], size: 2.2 });
      col(cx0 - 0.15, Y, cz0 - 0.15, cx1, Y + 2.9, cz0 + 0.15); col(cx0 - 0.15, Y, cz0, cx0 + 0.15, Y + 2.9, cz1);
      named.control = new THREE.Vector3((cx0 + cx1) / 2, Y, (cz0 + cz1) / 2 + 1.2);
    }
    // side windows (a lit band of tall panes between concrete fins), a stone plinth, the door canopy
    for (const [wx, face] of [[x0, -1], [x1, 1]]) {
      for (let i = 0; i < 7; i++) {
        const wz = z0 + 3 + i * (z1 - z0 - 6) / 6, lit = (i * 37 + (face > 0 ? 11 : 0)) % 5 < 3;
        B.lamp.add(new THREE.PlaneGeometry(2.2, 2.6), M4(wx + face * 0.03, Y + 4.4, wz, 0, face * PI / 2, 0), lit ? [1.3, 0.85, 0.42] : [0.06, 0.07, 0.09]);
        B.concrete.add(rbox(0.5, 3.4, 0.4, 0.03), M4(wx + face * 0.2, Y + 4.4, wz + 1.6), [0.78, 0.77, 0.75], { uvScale: 3 });
        B.snow.add(snowCap(0.3, 2.3, 0.1, i, 1, 3), M4(wx + face * 0.12, Y + 3.08, wz, 0, 0, 0), [0.95, 0.97, 1]);
        if (lit) { glows.push({ p: [wx + face * 0.7, Y + 4.4, wz], color: [1.5, 0.9, 0.45], size: 1.0 }); pools.push({ p: [wx + face * 3, Y, wz], c: [0.5, 0.34, 0.16], r: 4, k: 1 }); }
      }
      B.stone.add(rbox(0.3, 1.3, z1 - z0 + 0.2, 0.03), M4(wx + face * 0.12, Y + 0.65, (z0 + z1) / 2), footAO(Y, 1.3, 0.4, [0.72, 0.7, 0.68]), { uvScale: 2.6 });
    }
    B.stone.add(rbox(x1 - x0 + 0.4, 1.3, 0.3, 0.03), M4((x0 + x1) / 2, Y + 0.65, z1 + 0.1), footAO(Y, 1.3, 0.4, [0.72, 0.7, 0.68]), { uvScale: 2.6 });
    for (const cx of [73, 97]) B.metal.add(new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8), M4(cx, Y + 2.1, z1 + 4.5), [0.3, 0.3, 0.32]);
    B.metal.add(new THREE.BoxGeometry(26, 0.25, 5), M4(85, Y + 4.25, z1 + 2.4), [0.3, 0.3, 0.32]);
    B.snow.add(snowCap(25.8, 4.8, 0.35, 5, 10, 3), M4(85, Y + 4.55, z1 + 2.4), [0.95, 0.97, 1]);
    for (let i = 0; i < 28; i++) { const il = 0.15 + rng() * rng() * 0.8; B.snow.add(new THREE.ConeGeometry(0.03 + il * 0.025, il, 5).rotateX(PI), M4(72 + i * 26 / 27, Y + 4.1 - il / 2, z1 + 4.85), [0.72, 0.8, 0.95]); }
    // drifts banked against the side walls and the front piers
    const dcol = (p) => { const k = 0.86 + 0.14 * Math.min(1, (p.y - Y) / 1.2); return [k * 0.95, k * 0.97, k]; };
    B.snow.add(driftWedge(z1 - z0 - 2, 1.2, 2.2, 3), M4(x0 - 0.02, Y - 0.05, (z0 + z1) / 2, 0, -PI / 2, 0), dcol);
    B.snow.add(driftWedge(z1 - z0 - 2, 1.0, 1.9, 5), M4(x1 + 0.02, Y - 0.05, (z0 + z1) / 2, 0, PI / 2, 0), dcol);
    B.snow.add(driftWedge(9, 0.9, 1.6, 7), M4(67, Y - 0.05, z1 + 0.05), dcol); B.snow.add(driftWedge(11, 1.0, 1.7, 9), M4(104, Y - 0.05, z1 + 0.05), dcol);
    // the name on the front: GRAUHORN-BAHN
    {
      const t = signTexture([['GRAUHORN-BAHN', 120]], { w: 1024, h: 160, bg: '#c8c2b4', fg: '#7a1410', border: null, font: 'Anton', seed: 21, age: 0.6 });
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
      sm.position.set(85, Y + H - 1.3, z1 + 0.02); root.add(sm);
      const t2 = signTexture([['MITTELSTATION', 70], ['1964 m ü. M.', 48]], { w: 512, h: 220, bg: '#6b3a1c', fg: '#f6efe0', border: '#f6efe0', seed: 22, age: 0.7 });
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.1), new THREE.MeshStandardMaterial({ map: t2, roughness: 0.7 }));
      s2.position.set(69, Y + 2.6, z1 + 0.03); root.add(s2);
    }
    // door lamps outside (warm on the snow of the yard)
    for (const lx of [70, 100]) { B.lamp.add(new THREE.SphereGeometry(0.16, 8, 6), M4(lx, Y + 4.2, z1 + 0.3), [1.6, 1.0, 0.5]); glows.push({ p: [lx, Y + 4.2, z1 + 0.6], color: WARM, size: 1.8 }); pools.push({ p: [lx, Y, z1 + 4], c: [0.7, 0.48, 0.22], r: 6, k: 1 }); }
  }

  // ---------------------------------------------------------------- the yard
  {
    // snow-groomer shed (east, outside the walk area: its roof is the sniper perch)
    const sx0 = 114, sx1 = 128, sz0 = 18, sz1 = 42, sh = 6;
    B.concrete.add(rbox(sx1 - sx0, sh, sz1 - sz0, 0.04), M4((sx0 + sx1) / 2, Y + sh / 2, (sz0 + sz1) / 2), footAO(Y, 1.2, 0.4, [0.8, 0.79, 0.77]), { uvScale: 3.2 });
    B.metal.add(new THREE.BoxGeometry(sx1 - sx0 + 1.2, 0.3, sz1 - sz0 + 1.2), M4((sx0 + sx1) / 2, Y + sh + 0.15, (sz0 + sz1) / 2), [0.3, 0.32, 0.34]);
    B.snow.add(snowCap(sx1 - sx0 + 1.0, sz1 - sz0 + 1.0, 0.45, 9, 8, 10), M4((sx0 + sx1) / 2, Y + sh + 0.5, (sz0 + sz1) / 2), [0.95, 0.97, 1]);
    for (const dz of [23, 31, 39]) { B.paint.add(new THREE.BoxGeometry(0.12, 4.2, 5.2), M4(sx0 - 0.04, Y + 2.1, dz - 1.4), (p, n, l) => { const k = 0.38 + 0.04 * Math.sin(l.y * 25); return [k * 0.95, k, k * 1.08]; }); }
    col(sx0, Y, sz0, sx1, Y + sh + 0.3, sz1);
    named.shedRoof = new THREE.Vector3(SNIPERS.shed.x, Y + sh + 0.3, SNIPERS.shed.z);
    // the fuel tank (west side of the yard) — big, horizontal, on saddles: the yard's money shot
    {
      const tx = 58, tz = 20, len = 7.5, r = 1.35;
      B.paint.add(new THREE.CapsuleGeometry(r, len, 6, 18).rotateX(PI / 2), M4(tx, Y + r + 0.55, tz), (p, n, l) => (Math.abs(l.y - 0.3) < 0.14 ? [0.7, 0.55, 0.05] : [0.3, 0.33, 0.27]));
      for (const s of [-2.4, 2.4]) B.concrete.add(rbox(2.6, 0.9, 0.6, 0.04), M4(tx, Y + 0.45, tz + s), [0.62, 0.6, 0.58], { uvScale: 2 });
      B.metal.add(new THREE.CylinderGeometry(0.06, 0.06, 4, 6).rotateX(PI / 2), M4(tx + r * 0.7, Y + 0.6, tz + 4), [0.4, 0.38, 0.3]);
      B.snow.add(snowCap(r * 1.4, len + r, 0.25, 4, 3, 8), M4(tx, Y + r * 2 + 0.6, tz), [0.95, 0.97, 1]);
      col(tx - r, Y, tz - len / 2 - r, tx + r, Y + r * 2 + 0.6, tz + len / 2 + r, { kind: 'tank', mat: 'metal' });
      explosives.push({ p: new THREE.Vector3(tx, Y + r + 0.55, tz), r: r + 0.4, hp: 10, kind: 'fueltank', size: 3.2 });
      named.fuelTank = new THREE.Vector3(tx, Y + r + 0.55, tz);
      // diesel drums beside it
      for (let i = 0; i < 4; i++) { const dx = tx + 2.6 + (i % 2) * 0.68, dz = tz - 3 + Math.floor(i / 2) * 0.7; B.paint.add(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 12), M4(dx, Y + 0.44, dz, 0, i, 0), [0.1, 0.22, 0.42]); B.snow.add(new THREE.CylinderGeometry(0.29, 0.31, 0.07, 10), M4(dx, Y + 0.92, dz), [0.95, 0.97, 1]); explosives.push({ p: new THREE.Vector3(dx, Y + 0.45, dz), r: 0.4, hp: 3, kind: 'drum', size: 0.9 }); }
    }
    // shipping containers + pallets as cover in the middle of the yard
    const cont = (x, z, yaw, c) => { B.paint.add(rbox(6.0, 2.6, 2.44, 0.04), M4(x, Y + 1.3, z, 0, yaw, 0), (p, n, l) => { const r = (0.85 + 0.15 * Math.sin(l.x * 9.5 + l.z * 9.5)) * (l.y < -1.0 ? 0.75 : 1) * (Math.abs(l.y) > 1.2 ? 0.8 : 1); return [c[0] * r, c[1] * r, c[2] * r]; }); for (const ex of [-3.02, 3.02]) for (const bz of [-0.75, -0.3, 0.3, 0.75]) B.metal.add(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), M4(x + Math.cos(yaw) * ex + Math.sin(yaw) * bz, Y + 1.3, z - Math.sin(yaw) * ex + Math.cos(yaw) * bz), [0.25, 0.25, 0.26]); B.snow.add(snowCap(6.0, 2.44, 0.3, x, 6, 3), M4(x, Y + 2.72, z, 0, yaw, 0), [0.95, 0.97, 1]); const C = Math.abs(Math.cos(yaw)), S = Math.abs(Math.sin(yaw)); col(x - C * 3 - S * 1.22, Y, z - S * 3 - C * 1.22, x + C * 3 + S * 1.22, Y + 2.6, z + S * 3 + C * 1.22, { kind: 'container', mat: 'metal' }); };
    cont(76, 28, 0.05, [0.42, 0.12, 0.08]); cont(94, 34, PI / 2 + 0.08, [0.14, 0.24, 0.36]); cont(88, 22, 0.02, [0.2, 0.3, 0.18]);
    // drifts banked against the containers' windward (north) sides, pallets + crates between them
    const drift = (x, z, yaw, L, h, seed) => B.snow.add(driftWedge(L, h, h * 1.9, seed), M4(x, Y - 0.05, z, 0, yaw, 0), (q) => { const k = 0.86 + 0.14 * Math.min(1, (q.y - Y) / h); return [k * 0.95, k * 0.97, k]; });
    drift(76, 26.6, PI, 6, 1.0, 21); drift(88, 20.6, PI, 6, 0.9, 23); drift(92.6, 34, -PI / 2, 6, 0.8, 25);
    for (const [px, pz, n] of [[70, 36, 3], [100, 26, 2], [82, 12, 3]]) {
      for (let i = 0; i < n; i++) { const yw = rng() * 0.4; B.wood.add(rbox(1.2, 0.14, 1.0, 0.01), M4(px + i * 0.1, Y + 0.07 + i * 0.15, pz, 0, yw, 0), [0.4, 0.3, 0.2]); }
      B.paint.add(rbox(1.2, 0.9, 0.9, 0.03), M4(px + 1.6, Y + 0.45, pz + 0.3, 0, 0.3, 0), [0.2, 0.24, 0.15]);
      B.snow.add(snowCap(1.2, 0.9, 0.12, px, 3, 2), M4(px + 1.6, Y + 0.95, pz + 0.3, 0, 0.3, 0), [0.95, 0.97, 1]);
      col(px - 0.7, Y, pz - 0.7, px + 2.4, Y + 0.95, pz + 1.0, { kind: 'crate', mat: 'wood' });
    }
    // plough berms: the yard was cleared, the snow shoved into long dirty banks at its edges; marker poles
    drift(51.5, 22, PI / 2, 22, 1.1, 31); drift(66, 9.5, 0, 16, 1.0, 33); drift(108, 44, PI, 12, 1.0, 35);
    col(50, Y, 11.5, 53.2, Y + 1.3, 32.5, { kind: 'mound', mat: 'snow' }); col(58.5, Y, 8, 73.5, Y + 1.1, 11.2, { kind: 'mound', mat: 'snow' });
    for (let i = 0; i < 9; i++) { const px = 52 + i * 7, pz = 44.5 - (i % 2) * 0.4; B.paint.add(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), M4(px, Y + 1.1, pz), (q) => (Math.floor((q.y - Y) * 2.5) % 2 ? [0.08, 0.08, 0.08] : [0.85, 0.36, 0.06])); }
    // tyre tracks: in from the road, round the containers to the station, the groomer's belts from the shed
    root.add(trackDecals([
      { pts: [[50, 41], [60, 36], [72, 33], [84, 30], [98, 24], [104, 14], [100, 6]], w: 2.4 },
      { pts: [[54, 39], [58, 31], [64, 24], [72, 18], [84, 14], [92, 10]], w: 2.5 },
      { pts: [[113, 38], [104, 40], [86, 41], [70, 40]], w: 3.6 },
      { pts: [[113, 22], [106, 18], [98, 16], [90, 15]], w: 3.6 },
    ], () => Y));
    // floodlight masts (sodium), one each side
    for (const [mx, mz] of [[54, 40], [110, 12]]) {
      B.metal.add(new THREE.CylinderGeometry(0.12, 0.2, 12, 8), M4(mx, Y + 6, mz), [0.5, 0.5, 0.52]);
      for (const k of [-0.5, 0.5]) {
        const lx = mx + k, lz = mz;
        B.metal.add(rbox(0.5, 0.35, 0.3, 0.04), M4(lx, Y + 12, lz, -0.5, Math.atan2(85 - mx, 24 - mz), 0), [0.18, 0.18, 0.18]);
        glows.push({ p: [lx + (85 - mx) * 0.012, Y + 11.8, lz + (24 - mz) * 0.012], color: SODIUM, size: 1.8 });
      }
      glows.push({ p: [mx + (85 - mx) * 0.02, Y + 11.6, mz + (24 - mz) * 0.02], color: [0.8, 0.45, 0.18], size: 4 });
      pools.push({ p: [mx + (85 - mx) * 0.3, Y, mz + (24 - mz) * 0.3], c: [0.62, 0.45, 0.22], r: 12, k: 1 });
      col(mx - 0.25, Y, mz - 0.25, mx + 0.25, Y + 12, mz + 0.25, { mat: 'metal' });
    }
    // a chain-link fence along the yard's south edge (gaps for the road)
    for (let fx = YARD.x0 + 10; fx < YARD.x1; fx += 3) {
      if (fx > 48 && fx < 60) continue;
      const fy = groundAt(fx, YARD.z1 + 0.5);
      B.metal.add(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 5), M4(fx, fy + 1, YARD.z1 + 0.5), [0.45, 0.46, 0.48]);
      B.dark.add(new THREE.PlaneGeometry(3, 1.8), M4(fx + 1.5, fy + 1, YARD.z1 + 0.5), [0.32, 0.33, 0.35]);
    }
  }

  // ---------------------------------------------------------------- ropes across the gorge (2 tracks: track rope + haul rope)
  const ropes = [];
  {
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.5, metalness: 0.6 });
    for (const tx of TRACK_X) for (const [dy, r] of [[0, 0.055], [1.1, 0.03]]) {
      const pts = [];
      for (let z = LINE.z0 + 2; z >= LINE.z1 - 2; z -= 4) pts.push(new THREE.Vector3(tx, lineY(z) + dy, z));
      const curve = new THREE.CatmullRomCurve3(pts);
      const g = new THREE.TubeGeometry(curve, pts.length * 2, r * 1.6, 5, false);   // drawn a little thick: it has to read in the storm
      const m = new THREE.Mesh(g, ropeMat); m.castShadow = false; root.add(m);
      ropes.push({ tx, dy, mesh: m });
    }
    named.ropes = ropes;
  }

  // ---------------------------------------------------------------- the pylon on the rock rib
  {
    const px = PYLON.x, pz = PYLON.z, base = terrainAt(px, pz) - 1, top = LINE.yP - 1.8;
    const H = top - base;
    const leg = (t, sx, sz) => [px + sx * (5.5 - 3.2 * t), base + H * t, pz + sz * (3.6 - 2.0 * t)];
    const beam = (a, b, r, c) => { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length(); const g = new THREE.BoxGeometry(r, L, r); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); B.paint.add(g, new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), c); };
    const steel = (p) => { const k = 0.34 + 0.06 * Math.sin(p.y * 0.7); return [k * 1.02, k, k * 0.96]; };
    const N = 12;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (let i = 0; i < N; i++) beam(leg(i / N, sx, sz), leg((i + 1) / N, sx, sz), 0.42, steel);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => leg(t, sx, sz));
      for (let k = 0; k < 4; k++) beam(c[k], c[(k + 1) % 4], 0.2, steel);
      if (i < N) { const c2 = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => leg((i + 1) / N, sx, sz)); for (let k = 0; k < 4; k++) { beam(c[k], c2[(k + 1) % 4], 0.14, steel); beam(c[(k + 1) % 4], c2[k], 0.14, steel); } }
    }
    // the head: a cross-arm over both tracks with saddles (sheave trains) + a platform with a rail
    B.paint.add(rbox(18, 1.0, 2.2, 0.05), M4(px, top + 0.2, pz), steel);
    for (const tx of TRACK_X) {
      B.paint.add(rbox(1.2, 0.8, 5.5, 0.1), M4(tx, top + 1.1, pz), [0.5, 0.1, 0.06]);
      for (let k = -2; k <= 2; k++) B.metal.add(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12).rotateZ(PI / 2), M4(tx, top + 1.5, pz + k * 1.0), [0.2, 0.2, 0.2]);
    }
    B.metal.add(new THREE.BoxGeometry(9, 0.12, 3.6), M4(px, top - 1.6, pz + 0.3), [0.3, 0.3, 0.3]);   // the platform (the pylon sniper)
    for (const s of [-1, 1]) B.metal.add(new THREE.BoxGeometry(9, 0.06, 0.06), M4(px, top - 0.6, pz + 0.3 + s * 1.75), [0.5, 0.45, 0.2]);
    named.pylonDeck = new THREE.Vector3(px + 2.2, top - 1.55, pz - 1.0);
    // aviation lights (red), blinking
    for (const s of [-1, 1]) glows.push({ p: [px + s * 9, top + 0.9, pz], color: [3.4, 0.25, 0.15], size: 1.4, blink: true, rate: 2.2, far: true });
    named.pylonTop = new THREE.Vector3(px, top, pz);
    named.pylonH = H;
    // the rock rib under it gets rubble at the feet
  }

  for (const [k, b] of Object.entries(B)) {
    if (!b.vn) continue;
    const m = k === 'lamp' ? mats.lamp() : k === 'dark' ? mats.paint() : mats[k]();
    root.add(b.mesh(m, { shadow: k !== 'lamp' && k !== 'snow' && k !== 'glass', name: 'station-' + k }));
  }
  named.explosivesStation = explosives;
  return { root, colliders, roofs: [[MID.x0 - 1, MID.z0 - 1, MID.x1 + 1, MID.z1 + 2, MID.y + 12]], anchors: { glows, pools, named, plumes: [] } };
}
