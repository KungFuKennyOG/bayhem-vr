import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { terrainAt, groundAt, roadAt, roadNearest, ROAD_W, PULLOUT, CHAPEL, HUT, LEG1, LEG2, LEG3 } from './layout.js';
import { Bucket, M4, mats, rbox, snowCap, hexc, footAO, lightCone } from './kit.js';
import { buildGroomer } from './groomer.js';
import { signTexture } from './tex.js';

// =====================================================================================
//  Roadside set dressing: the driver's snowcat (burning, at the start), the enemy roadblock on leg 1
//  (jersey barriers, sandbags, a light-tower trailer throwing sodium light on the road), the wayside
//  chapel in hairpin 1 (candle in the window), the Berghaus Edelweiss on its terrace by hairpin 2
//  (log upper floor, painted shutters, warm windows, a propane tank that WILL go up), crates, drums,
//  flares. Everything that is cover has a collider. Warm light = emissive + glows + baked pools.
// =====================================================================================
const PI = Math.PI;
const WARM = [2.6, 1.55, 0.7], SODIUM = [2.8, 1.5, 0.55], CANDLE = [2.4, 1.2, 0.45], RED = [3.2, 0.35, 0.18];

export function buildProps(ctx) {
  const root = new THREE.Group();
  const rng = makeRng(5150);
  const B = { paint: new Bucket(), metal: new Bucket(), wood: new Bucket(), stone: new Bucket(), concrete: new Bucket(), lamp: new Bucket(), snow: new Bucket(), dark: new Bucket() };
  const colliders = [], glows = [], pools = [], named = {}, explosives = [], flares = [], chimneys = [];
  const col = (x0, y0, z0, x1, y1, z1, data = {}) => colliders.push({ min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], data: { mat: 'concrete', ...data } });
  // oriented box collider (AABB of a yawed box)
  const ocol = (x, y0, z, hx, hz, h, yaw, data) => { const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)); const ex = c * hx + s * hz, ez = s * hx + c * hz; col(x - ex, y0, z - ez, x + ex, y0 + h, z + ez, data); };
  const R = (at) => roadAt(at);

  // ---------------------------------------------------------------- the snowcat (burnt-out: the driver's ride)
  {
    const x = -82, z = 113.4, y = groundAt(x, z), yaw = 0.55;
    const M = (lx, ly, lz, rx = 0, ry = 0, rz = 0) => M4(0, 0, 0).multiplyMatrices(M4(x, y, z, 0, yaw, 0.04), M4(lx, ly, lz, rx, ry, rz));
    // the burnt-out groomer (the full model, charred, its glass blown out)
    { const G = buildGroomer({ burnt: 0.72, seed: 7, paint: [0.6, 0.08, 0.05] }); G.root.position.set(x, y - 0.15, z); G.root.rotation.set(-0.1, yaw, 0.05, "YXZ"); root.add(G.root); }
    ocol(x, y, z, 2.2, 3.4, 2.9, yaw, { kind: 'wreck', mat: 'metal' });
    // it burns from inside the cab: out of the windscreen hole and the side windows
    { const Mw = M4(x, y - 0.15, z, -0.1, yaw, 0.05), at = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(Mw);
      named.snowcatFire = [at(0, 2.5, -0.85), at(1.0, 2.6, -0.6), at(-0.3, 2.1, 1.3)]; }
    pools.push({ p: [x, y + 1, z], c: [0.75, 0.42, 0.16], r: 9, k: 1 });
    // its crash trail: a gouged bank, scattered bits
    for (let k = 0; k < 6; k++) B.metal.add(rbox(0.3 + rng() * 0.5, 0.06, 0.2 + rng() * 0.4, 0.02), M4(x + 3 + rng() * 9, groundAt(x + 3, z) + 0.05, z - 2 + rng() * 4, rng(), rng() * 6, rng()), [0.12, 0.1, 0.09]);
  }

  // ---------------------------------------------------------------- the roadblock on leg 1 (jersey barriers, sandbags, light tower)
  const along = (pt, lat, yawOff = 0) => { const R0 = roadNearest(pt[0], pt[2]); const nx = -R0.sz, nz = R0.sx; return { x: pt[0] + nx * lat, z: pt[2] + nz * lat, yaw: Math.atan2(-R0.sz, R0.sx) + yawOff, nx, nz }; };
  const jersey = (x, z, yaw) => {
    const y = groundAt(x, z);
    const g = new THREE.BoxGeometry(3.0, 0.82, 0.6, 1, 2, 1);
    const P = g.attributes.position; for (let i = 0; i < P.count; i++) { if (P.getY(i) > 0) P.setZ(i, P.getZ(i) * 0.35); }
    g.computeVertexNormals();
    B.concrete.add(g, M4(x, y + 0.41, z, 0, yaw, 0), footAO(y, 0.8, 0.4, [0.92, 0.91, 0.9]), { uvScale: 2.2 });
    // red/white chevron band
    B.paint.add(new THREE.BoxGeometry(2.9, 0.16, 0.62), M4(x, y + 0.28, z, 0, yaw, 0), (p, n, l) => (Math.floor((l.x + 1.5) / 0.4) % 2 ? [0.62, 0.06, 0.05] : [0.85, 0.84, 0.82]));
    B.snow.add(snowCap(3.0, 0.3, 0.1, x + z, 4, 1), M4(x, y + 0.85, z, 0, yaw, 0), [0.95, 0.97, 1]);
    ocol(x, y, z, 1.5, 0.32, 0.82, yaw, { kind: 'barrier' });
  };
  const sandbags = (x, z, yaw, n = 5, rows = 3) => {
    const y = groundAt(x, z);
    for (let r = 0; r < rows; r++) for (let i = 0; i < n - (r % 2 ? 1 : 0); i++) {
      const lx = (i - (n - 1) / 2 + (r % 2 ? 0.5 : 0)) * 0.62, ly = 0.13 + r * 0.24;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      B.wood.add(rbox(0.6, 0.24, 0.38, 0.09), M4(x + c * lx, y + ly, z - s * lx, 0, yaw + (rng() - 0.5) * 0.15, (rng() - 0.5) * 0.08), () => { const k = 0.32 + rng() * 0.08; return [k * 1.05, k, k * 0.82]; });
    }
    B.snow.add(snowCap(n * 0.62, 0.45, 0.12, x * 3, 4, 1), M4(x, y + rows * 0.24 + 0.08, z, 0, yaw, 0), [0.95, 0.97, 1]);
    ocol(x, y, z, n * 0.31, 0.22, rows * 0.24 + 0.05, yaw, { kind: 'sandbag', mat: 'concrete' });
  };
  {
    const p1 = R(roadNearest(6, 104).along);
    const a = along(p1, 1.2, 0.25); jersey(a.x, a.z, a.yaw);
    const b = along(R(roadNearest(12, 103).along), -1.6, -0.2); jersey(b.x, b.z, b.yaw);
    const c = along(R(roadNearest(-14, 106).along), -0.4, 0.1); jersey(c.x, c.z, c.yaw);
    sandbags(...(() => { const s = along(R(roadNearest(24, 103).along), 2.2, 0); return [s.x, s.z, s.yaw]; })(), 6, 3);
    sandbags(...(() => { const s = along(R(roadNearest(-2, 105).along), -2.6, 0.4); return [s.x, s.z, s.yaw]; })(), 4, 3);
    // the light tower trailer on the downhill shoulder (lights the roadblock: warm pool + glows)
    const t = along(R(roadNearest(10, 103).along), -(ROAD_W + 0.5), 0); const y = groundAt(t.x, t.z);
    B.paint.add(rbox(2.2, 1.0, 1.3, 0.06), M4(t.x, y + 0.75, t.z, 0, t.yaw, 0), [0.62, 0.48, 0.08]);
    for (const s of [-1, 1]) B.dark.add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10).rotateX(PI / 2), M4(t.x + Math.sin(t.yaw) * 0.7 * s, y + 0.3, t.z + Math.cos(t.yaw) * 0.7 * s, 0, t.yaw, 0), [0.05, 0.05, 0.05]);
    B.metal.add(new THREE.CylinderGeometry(0.07, 0.1, 7, 6), M4(t.x, y + 4.6, t.z, 0.06 * t.nz, 0, -0.06 * t.nx), [0.55, 0.56, 0.58]);
    const top = [t.x + t.nx * 0.42, y + 8.0, t.z + t.nz * 0.42];
    B.metal.add(new THREE.BoxGeometry(1.8, 0.1, 0.1), M4(top[0], top[1] - 0.25, top[2], 0, t.yaw, 0), [0.4, 0.4, 0.42]);
    for (const k of [-0.65, -0.22, 0.22, 0.65]) {
      const lx = top[0] + Math.cos(t.yaw) * k, lz = top[2] - Math.sin(t.yaw) * k;
      B.metal.add(rbox(0.36, 0.3, 0.2, 0.03), M4(lx, top[1], lz, -0.35, t.yaw + PI, 0), [0.2, 0.2, 0.21]);
      B.lamp.add(new THREE.PlaneGeometry(0.3, 0.24), M4(lx - t.nx * 0.11, top[1] - 0.02, lz - t.nz * 0.11, -0.35, t.yaw + PI, 0), [1.6, 1.2, 0.7]);
      glows.push({ p: [lx - t.nx * 0.3, top[1], lz - t.nz * 0.3], color: SODIUM, size: 1.6 });
    }
    glows.push({ p: [top[0] - t.nx * 0.8, top[1] - 0.2, top[2] - t.nz * 0.8], color: [0.9, 0.55, 0.25], size: 3.2 });
    pools.push({ p: [t.x - t.nx * 7, y, t.z - t.nz * 7], c: [0.85, 0.6, 0.28], r: 9, k: 1 });
    named.lightTower = new THREE.Vector3(top[0], top[1], top[2]);
    root.add(lightCone(new THREE.Vector3(top[0] - t.nx * 0.3, top[1], top[2] - t.nz * 0.3), new THREE.Vector3(t.x - t.nx * 8, y, t.z - t.nz * 8), { spread: 0.45, k: 0.08 }));
    ocol(t.x, y, t.z, 1.1, 0.7, 1.3, t.yaw, { kind: 'trailer', mat: 'metal' });
    // fuel drums by the trailer (explosive)
    for (let i = 0; i < 3; i++) {
      const dx = t.x + Math.cos(t.yaw) * (1.6 + i * 0.65), dz = t.z - Math.sin(t.yaw) * (1.6 + i * 0.65), dy = groundAt(dx, dz);
      B.paint.add(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 12), M4(dx, dy + 0.44, dz, 0, i, 0), (p, n, l) => (Math.abs(l.y - 0.25) < 0.04 || Math.abs(l.y + 0.25) < 0.04 ? [0.1, 0.1, 0.1] : [0.55, 0.12, 0.06]));
      B.snow.add(new THREE.CylinderGeometry(0.29, 0.31, 0.07, 10), M4(dx, dy + 0.92, dz), [0.95, 0.97, 1]);
      col(dx - 0.3, dy, dz - 0.3, dx + 0.3, dy + 0.92, dz + 0.3, { kind: 'drum', mat: 'metal' });
      explosives.push({ p: new THREE.Vector3(dx, dy + 0.45, dz), r: 0.4, hp: 3, kind: 'drum', size: 0.9 });
    }
  }

  // ---------------------------------------------------------------- wayside chapel (inside hairpin 1)
  {
    const { x, z } = CHAPEL, y = groundAt(x, z) - 0.05, yaw = CHAPEL.yaw;
    const M = (lx, ly, lz, rx = 0, ry = 0, rz = 0) => M4(0, 0, 0).multiplyMatrices(M4(x, y, z, 0, yaw, 0), M4(lx, ly, lz, rx, ry, rz));
    const W = 4.2, L = 5.6, H = 3.4;
    // whitewashed walls over a stone plinth
    B.stone.add(rbox(W + 0.3, 0.7, L + 0.3, 0.04), M(0, 0.35, 0), footAO(y, 0.7, 0.3, [0.8, 0.79, 0.77]), { uvScale: 2.2 });
    B.concrete.add(rbox(W, H, L, 0.05), M(0, 0.7 + H / 2, 0), (p) => { const t = Math.min(1, (p.y - y - 0.7) / 2); const k = 0.9 - (1 - t) * 0.12; return [k * 1.02, k, k * 0.96]; }, { uvScale: 4 });
    // steep shingle roof (two slabs) + ridge, heavy snow on it
    const pitch = 0.82, rl = (W / 2 + 0.5) / Math.cos(pitch);
    for (const s of [-1, 1]) {
      B.wood.add(new THREE.BoxGeometry(rl, 0.14, L + 1.1), M(s * (W / 4 + 0.12), 0.7 + H + Math.tan(pitch) * (W / 4) - 0.05, 0, 0, 0, -s * pitch), [0.12, 0.09, 0.075]);
      B.snow.add(snowCap(rl * 0.92, L + 1.0, 0.32, s * 7, 4, 6), M(s * (W / 4 + 0.08), 0.7 + H + Math.tan(pitch) * (W / 4) + 0.18, 0, 0, 0, -s * pitch), [0.95, 0.97, 1]);
    }
    // gable triangles
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(0, Math.tan(pitch) * W / 2); sh.lineTo(-W / 2, 0);
      const g = new THREE.ShapeGeometry(sh); if (s < 0) g.rotateY(PI);
      B.concrete.add(g, M(0, 0.7 + H, s * (L / 2 + 0.001)), [0.86, 0.84, 0.8], { uvScale: 4 });
    }
    // little bell turret on the front gable with a pyramid cap and a cross
    B.wood.add(rbox(0.9, 1.0, 0.9, 0.03), M(0, 0.7 + H + Math.tan(pitch) * W / 2 - 0.2, -L / 2 + 0.5), [0.2, 0.15, 0.11]);
    B.metal.add(new THREE.ConeGeometry(0.75, 1.1, 4).rotateY(PI / 4), M(0, 0.7 + H + Math.tan(pitch) * W / 2 + 0.85, -L / 2 + 0.5), [0.42, 0.32, 0.18]);
    B.metal.add(new THREE.BoxGeometry(0.06, 0.7, 0.06), M(0, 0.7 + H + Math.tan(pitch) * W / 2 + 1.65, -L / 2 + 0.5), [0.5, 0.42, 0.2]);
    B.metal.add(new THREE.BoxGeometry(0.36, 0.06, 0.06), M(0, 0.7 + H + Math.tan(pitch) * W / 2 + 1.75, -L / 2 + 0.5), [0.5, 0.42, 0.2]);
    // door (dark timber, arched lintel) and the candle-lit window
    B.wood.add(rbox(1.1, 2.0, 0.12, 0.03), M(0, 0.7 + 1.0, -L / 2 - 0.02), [0.22, 0.13, 0.07]);
    B.stone.add(rbox(1.5, 0.3, 0.25, 0.05), M(0, 0.7 + 2.15, -L / 2 - 0.05), [0.7, 0.68, 0.64], { uvScale: 1 });
    for (const sx of [-1, 1]) {
      B.lamp.add(new THREE.CircleGeometry(0.32, 14), M(sx * (W / 2 + 0.01), 0.7 + 2.0, 0.6, 0, sx * PI / 2, 0), [1.7, 0.95, 0.42]);
      B.wood.add(new THREE.TorusGeometry(0.34, 0.05, 4, 14), M(sx * (W / 2 + 0.02), 0.7 + 2.0, 0.6, 0, sx * PI / 2, 0), [0.25, 0.16, 0.09]);
    }
    const wp = new THREE.Vector3(-(W / 2 + 0.4), 0.7 + 2.0, 0.6).applyMatrix4(M4(x, y, z, 0, yaw, 0));
    glows.push({ p: wp.toArray(), color: CANDLE, size: 1.2, flick: true });
    const wp2 = new THREE.Vector3((W / 2 + 0.4), 0.7 + 2.0, 0.6).applyMatrix4(M4(x, y, z, 0, yaw, 0));
    glows.push({ p: wp2.toArray(), color: CANDLE, size: 1.2, flick: true });
    pools.push({ p: wp.toArray(), c: [1.0, 0.55, 0.2], r: 4.5, k: 0.9 });
    pools.push({ p: wp2.toArray(), c: [1.0, 0.55, 0.2], r: 4.5, k: 0.9 });
    ocol(x, y, z, L / 2 + 0.2, W / 2 + 0.2, 4.5, yaw, { kind: 'chapel', mat: 'concrete' });
    // a lantern on a post by the road, and a bench buried to the seat
    B.wood.add(rbox(1.6, 0.08, 0.4, 0.02), M(1.1, 0.48, -L / 2 - 1.5), [0.25, 0.17, 0.1]);
  }

  // ---------------------------------------------------------------- the Berghaus Edelweiss (terrace outside hairpin 2)
  {
    const cx = -75, cz = 64, y = HUT.y, yaw = 0;   // front (east gable) faces the road
    const W = 10, L = 14, H1 = 3.0, H2 = 2.9;      // W along z, L along x
    const M = (lx, ly, lz, rx = 0, ry = 0, rz = 0) => M4(0, 0, 0).multiplyMatrices(M4(cx, y, cz, 0, yaw, 0), M4(lx, ly, lz, rx, ry, rz));
    // stone ground floor, whitewashed
    B.stone.add(rbox(L, H1, W, 0.04), M(0, H1 / 2, 0), (p) => { const t = Math.min(1, (p.y - y) / 1.5); const k = 0.7 + 0.3 * t; return [k, k * 0.98, k * 0.95]; }, { uvScale: 2.6 });
    // log-built upper floor: courses of square logs, crossed at the corners (Strickbau)
    const logC = () => { const k = 0.2 + rng() * 0.05; return [k * 1.25, k * 0.85, k * 0.55]; };
    for (let c = 0; c < 11; c++) {
      const ly = H1 + 0.13 + c * 0.26;
      for (const s of [-1, 1]) {
        B.wood.add(rbox(L + 0.6, 0.25, 0.26, 0.04), M(0, ly + (c % 2 ? 0 : 0.0), s * (W / 2 - 0.13)), logC());
        B.wood.add(rbox(0.26, 0.25, W + 0.6, 0.04), M(s * (L / 2 - 0.13), ly + 0.13 * 0, 0), logC());
      }
    }
    const top = H1 + 0.13 + 11 * 0.26;
    // gable roof (ridge along x), deep eaves, a thick quilt of snow, icicles along the eaves
    const pitch = 0.42, rw = (W / 2 + 1.6) / Math.cos(pitch), ry = top + Math.tan(pitch) * (W / 2 + 1.6) / 2 - 0.2;
    for (const s of [-1, 1]) {
      B.wood.add(new THREE.BoxGeometry(L + 3.2, 0.2, rw), M(0, ry, s * (W / 4 + 0.8), s * pitch), [0.13, 0.1, 0.085]);
      B.snow.add(snowCap(L + 3.0, rw * 0.98, 0.55, s * 5 + 2, 10, 4), M(0, ry + 0.34, s * (W / 4 + 0.8), s * pitch), [0.95, 0.97, 1]);
      // icicles
      for (let i = 0; i < 26; i++) {
        const ix = -L / 2 - 1.4 + i * (L + 2.8) / 25 + (rng() - 0.5) * 0.2, il = 0.15 + rng() * rng() * 0.9;
        B.snow.add(new THREE.ConeGeometry(0.035 + il * 0.03, il, 5).rotateX(PI), M(ix, ry - Math.tan(pitch) * (rw / 2) * Math.cos(pitch) - il / 2 - 0.05, s * (W / 2 + 1.5)), [0.75, 0.82, 0.95]);
      }
    }
    // gable ends (log triangles)
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(0, Math.tan(pitch) * W / 2); sh.lineTo(-W / 2, 0);
      const g = new THREE.ShapeGeometry(sh); g.rotateY(s * PI / 2);
      B.wood.add(g, M(s * (L / 2 + 0.01), top, 0), [0.24, 0.16, 0.1]);
    }
    // windows: warm-lit panes, red shutters, flower boxes (snow in them)
    const win = (lx, ly, lz, face) => {
      const nx = face === 'x' ? Math.sign(lx) : 0, nz = face === 'z' ? Math.sign(lz) : 0, ryw = face === 'x' ? Math.sign(lx) * PI / 2 : (lz > 0 ? 0 : PI);
      B.lamp.add(new THREE.PlaneGeometry(0.9, 1.1), M(lx + nx * 0.02, ly, lz + nz * 0.02, 0, ryw, 0), [1.5, 0.85, 0.38]);
      B.wood.add(new THREE.BoxGeometry(1.06, 0.07, 0.1), M(lx + nx * 0.04, ly, lz + nz * 0.04, 0, ryw, 0), [0.2, 0.13, 0.08]);
      B.wood.add(new THREE.BoxGeometry(0.06, 1.1, 0.1), M(lx + nx * 0.04, ly, lz + nz * 0.04, 0, ryw, 0), [0.2, 0.13, 0.08]);
      for (const s2 of [-1, 1]) {
        const off = new THREE.Vector3(s2 * 0.82, 0, 0.12).applyAxisAngle(new THREE.Vector3(0, 1, 0), ryw);
        B.paint.add(new THREE.BoxGeometry(0.5, 1.2, 0.05), M(lx + off.x + nx * 0.05, ly, lz + off.z + nz * 0.05, 0, ryw, 0), (p, n, l) => (Math.floor((l.y + 0.6) / 0.15) % 2 ? [0.42, 0.06, 0.05] : [0.85, 0.82, 0.76]));
      }
      B.wood.add(rbox(1.0, 0.18, 0.22, 0.02), M(lx + nx * 0.14, ly - 0.68, lz + nz * 0.14, 0, ryw, 0), [0.24, 0.15, 0.08]);
      const wp = new THREE.Vector3(lx + nx * 1.0, ly, lz + nz * 1.0).applyMatrix4(M4(cx, y, cz, 0, yaw, 0));
      glows.push({ p: wp.toArray(), color: [1.6, 0.95, 0.45], size: 0.9 });
      pools.push({ p: [wp.x, y, wp.z], c: [1.0, 0.56, 0.22], r: 4, k: 0.8 });
    };
    for (const lz of [-2.6, 2.6]) { win(L / 2, 1.6, lz, 'x'); win(L / 2, H1 + 1.5, lz, 'x'); }
    for (const lx of [-4, 0, 4]) { win(lx, 1.6, W / 2, 'z'); win(lx, H1 + 1.5, W / 2, 'z'); win(lx, 1.6, -W / 2, 'z'); }
    // balcony round the east gable
    B.wood.add(new THREE.BoxGeometry(1.5, 0.14, W + 1.6), M(L / 2 + 0.75, H1 + 0.05, 0), [0.22, 0.15, 0.09]);
    for (let i = 0; i < 22; i++) B.wood.add(new THREE.BoxGeometry(0.06, 0.95, 0.12), M(L / 2 + 1.45, H1 + 0.55, -W / 2 - 0.7 + i * (W + 1.4) / 21), [0.26, 0.17, 0.1]);
    B.wood.add(new THREE.BoxGeometry(0.1, 0.1, W + 1.6), M(L / 2 + 1.45, H1 + 1.05, 0), [0.26, 0.17, 0.1]);
    B.snow.add(snowCap(0.18, W + 1.6, 0.1, 3, 1, 8), M(L / 2 + 1.45, H1 + 1.13, 0), [0.95, 0.97, 1]);
    // the sign over the door
    {
      const t = signTexture([['BERGHAUS', 80], ['EDELWEISS', 60]], { w: 512, h: 192, bg: '#3a2414', fg: '#f0dfb0', border: '#f0dfb0', font: 'Anton', seed: 9, age: 0.8 });
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }));
      sm.position.copy(new THREE.Vector3(L / 2 + 0.05, H1 - 0.35, 0).applyMatrix4(M4(cx, y, cz, 0, yaw, 0))); sm.rotation.y = yaw + PI / 2;
      root.add(sm);
    }
    B.wood.add(rbox(0.1, 2.2, 1.3, 0.02), M(L / 2 + 0.02, 1.1, 0), [0.25, 0.14, 0.07]);    // door
    B.lamp.add(new THREE.SphereGeometry(0.12, 8, 6), M(L / 2 + 0.25, 2.5, 0.95), [1.6, 1.0, 0.5]);
    glows.push({ p: new THREE.Vector3(L / 2 + 0.4, 2.5, 0.95).applyMatrix4(M4(cx, y, cz, 0, yaw, 0)).toArray(), color: WARM, size: 1.8 });
    // chimney
    B.stone.add(rbox(0.9, 2.4, 0.9, 0.04), M(-3, ry + 1.5, -1.2), [0.62, 0.6, 0.58], { uvScale: 1.6 });
    chimneys.push(new THREE.Vector3(-3, ry + 2.8, -1.2).applyMatrix4(M4(cx, y, cz, 0, yaw, 0)));
    // woodpile under the north eave
    for (let r = 0; r < 5; r++) for (let i = 0; i < 16; i++) B.wood.add(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 6).rotateX(PI / 2), M(-L / 2 + 1 + i * 0.23 + (r % 2) * 0.1, 0.12 + r * 0.21, -W / 2 - 0.45), () => { const k = 0.32 + rng() * 0.12; return [k * 1.2, k * 0.9, k * 0.6]; });
    ocol(cx, y, cz, L / 2, W / 2, 9, yaw, { kind: 'hut', mat: 'concrete' });
    // the propane tank on the terrace (south-east corner) — it will go up
    {
      const tx = cx + L / 2 + 3.6, tz = cz - W / 2 - 1.2, ty = y;
      B.paint.add(new THREE.CapsuleGeometry(0.62, 2.0, 6, 14).rotateZ(PI / 2), M4(tx, ty + 0.95, tz, 0, 0.2, 0), [0.82, 0.82, 0.8]);
      for (const s of [-1, 1]) B.metal.add(new THREE.BoxGeometry(0.1, 0.5, 0.9), M4(tx + s * 0.8, ty + 0.3, tz, 0, 0.2, 0), [0.3, 0.3, 0.3]);
      B.metal.add(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8), M4(tx, ty + 1.65, tz), [0.5, 0.45, 0.3]);
      B.snow.add(snowCap(2.6, 0.7, 0.18, 4, 6, 2), M4(tx, ty + 1.58, tz, 0, 0.2, 0), [0.95, 0.97, 1]);
      explosives.push({ p: new THREE.Vector3(tx, ty + 0.95, tz), r: 1.1, hp: 6, kind: 'propane', size: 2.3 });
      col(tx - 1.4, ty, tz - 0.8, tx + 1.4, ty + 1.6, tz + 0.8, { kind: 'tank', mat: 'metal' });
      named.propane = new THREE.Vector3(tx, ty + 1, tz);
    }
    // two snowmobiles by the door (enemy), skis + windscreen
    for (const [sx, sz, sy] of [[cx + L / 2 + 2.5, cz + 3.2, 0.3], [cx + L / 2 + 3.4, cz + 5.0, -0.2]]) {
      const ty = groundAt(sx, sz);
      B.paint.add(rbox(0.9, 0.55, 2.2, 0.15), M4(sx, ty + 0.55, sz, 0, sy, 0), [0.08, 0.08, 0.09]);
      B.paint.add(rbox(0.85, 0.2, 1.0, 0.08), M4(sx, ty + 0.9, sz + 0.35, 0, sy, 0), [0.03, 0.03, 0.03]);
      B.paint.add(rbox(0.9, 0.3, 0.7, 0.1), M4(sx, ty + 0.8, sz - 0.8, 0, sy, 0), [0.5, 0.06, 0.04]);
      for (const k of [-0.42, 0.42]) B.metal.add(new THREE.BoxGeometry(0.08, 0.05, 1.4), M4(sx + k, ty + 0.05, sz - 0.6, 0, sy, 0), [0.15, 0.15, 0.15]);
      ocol(sx, ty, sz - 0.2, 0.5, 1.3, 1.1, sy, { kind: 'sled', mat: 'metal' });
    }
  }

  // ---------------------------------------------------------------- crates, drums, flares along the road
  const crate = (x, z, yaw, s = 1, ammo = true) => {
    const y = groundAt(x, z);
    const g = rbox(1.1 * s, 0.7 * s, 0.75 * s, 0.03);
    (ammo ? B.paint : B.wood).add(g, M4(x, y + 0.35 * s, z, 0, yaw, 0), ammo ? [0.18, 0.21, 0.13] : [0.42, 0.3, 0.17]);
    B.snow.add(snowCap(1.1 * s, 0.75 * s, 0.1, x + z, 3, 2), M4(x, y + 0.72 * s, z, 0, yaw, 0), [0.95, 0.97, 1]);
    ocol(x, y, z, 0.55 * s, 0.38 * s, 0.75 * s, yaw, { kind: 'crate', mat: 'wood' });
  };
  // leg 2: crates in the middle, a scatter of flares (red fire + smoke), drums
  const onLeg = (L, t, lat) => { const x = L.a[0] + (L.b[0] - L.a[0]) * t, z = L.a[2] + (L.b[2] - L.a[2]) * t; const R0 = roadNearest(x, z); return { x: x + -R0.sz * lat, z: z + R0.sx * lat }; };
  for (const [t, lat, s] of [[0.2, 1.4, 1], [0.24, -2.2, 0.9], [0.55, 0.4, 1.1], [0.72, -2.0, 1], [0.86, 2.1, 0.9]]) { const p = onLeg(LEG2, t, lat); crate(p.x, p.z, rng() * 0.6 - 0.3 + Math.PI, s, rng() < 0.6); }
  for (const [t, lat, s] of [[0.3, -1.8, 1], [0.45, 1.6, 1.1], [0.66, -0.6, 1], [0.82, 1.8, 0.9]]) { const p = onLeg(LEG3, t, lat); crate(p.x, p.z, rng() * 0.6 - 0.3, s, rng() < 0.5); }
  for (const [t, lat] of [[0.62, 2.6], [0.12, -2.8]]) { const p = onLeg(LEG3, t, lat); sandbags(p.x, p.z, Math.atan2(-(LEG3.b[2] - LEG3.a[2]), LEG3.b[0] - LEG3.a[0]), 5, 3); }
  for (const [L, t, lat] of [[LEG1, 0.12, 0.8], [LEG1, 0.42, -1.5], [LEG2, 0.08, 1.1], [LEG2, 0.4, -0.6], [LEG2, 0.78, 1.8], [LEG3, 0.2, 0.3], [LEG3, 0.55, -1.8], [LEG1, 0.78, 1.6]]) {
    const p = onLeg(L, t, lat), y = groundAt(p.x, p.z);
    B.paint.add(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6).rotateZ(PI / 2 - 0.2), M4(p.x, y + 0.04, p.z, 0, rng() * 6, 0), [0.6, 0.06, 0.04]);
    flares.push(new THREE.Vector3(p.x, y + 0.1, p.z));
    glows.push({ p: [p.x, y + 0.2, p.z], color: RED, size: 0.9, flick: true });
    pools.push({ p: [p.x, y, p.z], c: [1.6, 0.18, 0.08], r: 3.2, k: 1 });
  }

  // ---------------------------------------------------------------- an earlier slide came down across leg 2: a debris mound (cover)
  {
    const p = onLeg(LEG2, 0.58, 1.4), y = groundAt(p.x, p.z);
    for (let i = 0; i < 9; i++) {
      let g = new THREE.IcosahedronGeometry(1, 3); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g); const P = g.attributes.position;
      for (let k = 0; k < P.count; k++) { const v = new THREE.Vector3(P.getX(k), P.getY(k), P.getZ(k)); v.multiplyScalar(1 + Math.sin(v.x * 4 + i) * 0.1 + Math.sin(v.z * 5 + i * 2) * 0.08); P.setXYZ(k, v.x, Math.max(-0.2, v.y), v.z); }
      g.computeVertexNormals();
      const sx = 1.4 + rng() * 1.6, sy = 0.7 + rng() * 0.8;
      const bx = p.x + (rng() - 0.5) * 6, bz = p.z + (rng() - 0.5) * 3.2, br = sx * 1.05 * Math.sqrt(Math.max(0, 1 - ((0.45 - sy * 0.3) / sy) ** 2));
      col(bx - br * 0.85, y - 0.5, bz - br * 0.85, bx + br * 0.85, y + sy * 1.3, bz + br * 0.85, { kind: 'mound', mat: 'snow' });   // each blob, where it stands knee-high
      B.snow.add(g, M4(bx, y + sy * 0.3, bz, 0, rng() * 6, 0, sx, sy, sx * 0.8), (q) => { const k = 0.82 + 0.18 * Math.min(1, (q.y - y) / 1.5); return [k * 0.95, k * 0.97, k]; }, { uvScale: 2 });
    }
    for (let i = 0; i < 5; i++) B.wood.add(new THREE.CylinderGeometry(0.12, 0.16, 3 + rng() * 3, 6).rotateZ(Math.PI / 2), M4(p.x + (rng() - 0.5) * 5, y + 0.9, p.z + (rng() - 0.5) * 2.6, 0, rng() * 6, rng() * 0.3), [0.2, 0.14, 0.1]);
  }
  // ---------------------------------------------------------------- a power line down the east side of the bowl (silhouettes in the storm)
  {
    const poles = [[56, 132], [72, 108], [90, 84], [104, 58], [118, 34], [128, 10]];
    const tops = [];
    for (const [x, z] of poles) {
      const y = terrainAt(x, z);
      B.wood.add(new THREE.CylinderGeometry(0.14, 0.2, 10, 7), M4(x, y + 5, z, 0.03, 0, -0.02), [0.22, 0.16, 0.11]);
      B.wood.add(new THREE.BoxGeometry(2.6, 0.16, 0.16), M4(x, y + 9.3, z, 0, 0.6, 0), [0.22, 0.16, 0.11]);
      for (const k of [-1.1, 0, 1.1]) B.paint.add(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 6), M4(x + Math.cos(0.6) * k, y + 9.55, z - Math.sin(0.6) * k), [0.5, 0.28, 0.2]);
      tops.push([x, y + 9.6, z]);
    }
    const wireM = new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.6, metalness: 0.3 });
    for (const k of [-1.1, 0, 1.1]) for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i], b = tops[i + 1], pts = [];
      for (let j = 0; j <= 10; j++) { const t = j / 10; pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t + Math.cos(0.6) * k, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 1.6, a[2] + (b[2] - a[2]) * t - Math.sin(0.6) * k)); }
      root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.03, 4, false), wireM));
    }
  }

  for (const [k, b] of Object.entries(B)) {
    if (!b.vn) continue;
    const m = k === 'lamp' ? mats.lamp() : k === 'dark' ? mats.paint() : mats[k]();
    root.add(b.mesh(m, { shadow: k !== 'lamp' && k !== 'snow', name: 'props-' + k }));
  }
  named.explosives = explosives; named.flares = flares; named.chimneys = chimneys;
  return { root, colliders, anchors: { glows, pools, named } };
}
