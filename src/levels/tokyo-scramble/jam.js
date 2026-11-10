import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { XWAY, SPAN, XWAY_BLOCK } from './layout.js';

// =====================================================================================
//  The gridlock past the part you fight through. The real cars (traffic.js: explosive cover, full
//  meshes) only fill the ~80 m you walk; beyond the gore to the east and past the span to the west the
//  Shuto is jammed solid in all four lanes as far as you can see. Those are cheap stand-ins: three
//  instanced shapes (kei/sedan, box van, truck/bus) with per-instance paint, one draw call each,
//  no colliders (you can't get there). A few doors left open, a few cars slewed across the lane.
// =====================================================================================
const LANES = [-156.6, -152.8, -147.2, -143.4];          // north two eastbound, south two westbound
const PAINT = [0xeceae4, 0xe4e2dc, 0xd2d0ca, 0x9a9ea2, 0x6f7378, 0x2a2e34, 0x1a1c20, 0x1c2a44, 0x5a1414, 0xe8e0c8, 0x24304a];
const TAXI = [0x1a2236, 0x1a2236, 0xf0c020, 0x3a5a3a];

// one car shape with vertex colours: paint = white (the instance colour tints it), glass / tyres / trim dark
function shape(L, W, H, cabin) {
  const pos = [], col = [], idx = [];
  const box = (x0, y0, z0, x1, y1, z1, c) => {
    const v = pos.length / 3;
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    for (const p of P) { pos.push(...p); col.push(...c); }
    for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]]) idx.push(v + f[0], v + f[1], v + f[2], v + f[0], v + f[2], v + f[3]);
  };
  const w = [1, 1, 1], dk = [0.05, 0.055, 0.06], tl = [3.5, 0.2, 0.15], gl = [0.12, 0.14, 0.16];
  const h0 = 0.32, hb = h0 + H * (cabin ? 0.48 : 1);
  box(-L / 2, h0, -W / 2, L / 2, hb, W / 2, w);                                     // body
  box(-L / 2 + 0.2, 0, -W / 2 + 0.05, -L / 2 + 0.9, h0 + 0.15, W / 2 - 0.05, dk);  // tyres / sills
  box(L / 2 - 0.9, 0, -W / 2 + 0.05, L / 2 - 0.2, h0 + 0.15, W / 2 - 0.05, dk);
  box(L / 2 - 0.02, hb - 0.28, -W / 2 + 0.1, L / 2 + 0.01, hb - 0.12, W / 2 - 0.1, tl);   // tail lights (+x = back)
  if (cabin) {
    const c0 = -L / 2 + L * cabin[0], c1 = -L / 2 + L * cabin[1];
    box(c0, hb, -W / 2 + 0.12, c1, h0 + H, W / 2 - 0.12, gl);                       // glasshouse
    box(c0 + 0.15, h0 + H - 0.04, -W / 2 + 0.16, c1 - 0.1, h0 + H + 0.03, W / 2 - 0.16, w);   // roof
  } else {
    box(-L / 2 + 0.05, h0 + H * 0.55, -W / 2 - 0.01, -L / 2 + 1.6, h0 + H * 0.92, W / 2 + 0.01, gl);   // cab windows (front = -x)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildJam(scene, { patchSun } = {}) {
  const rng = makeRng(8086), R = (a, b) => a + (b - a) * rng();
  const kinds = [
    { g: shape(4.5, 1.72, 1.45, [0.22, 0.72]), len: 4.5, n: 0, list: [] },   // sedan / taxi
    { g: shape(4.8, 1.75, 1.95, [0.08, 0.78]), len: 4.8, n: 0, list: [] },   // minivan / box van
    { g: shape(9.5, 2.4, 2.9, null), len: 9.5, n: 0, list: [] },             // truck / bus
  ];
  // fill a lane between xa and xb: bumper to bumper with the odd gap, the odd car slewed
  const fill = (xa, xb, z, east) => {
    let x = xa + R(0, 3);
    while (x < xb) {
      const r = rng(), k = r < 0.62 ? 0 : r < 0.86 ? 1 : 2, K = kinds[k];
      const cx = x + K.len / 2; if (cx + K.len / 2 > xb) break;
      const taxi = k === 0 && rng() < 0.22;
      const paint = taxi ? TAXI[Math.floor(rng() * TAXI.length)] : k === 2 ? [0xe8e8e4, 0xd8d8d4, 0x3a5a8a, 0x2a6a4a][Math.floor(rng() * 4)] : PAINT[Math.floor(rng() * PAINT.length)];
      const slew = rng() < 0.12 ? R(-0.35, 0.35) : R(-0.05, 0.05);
      K.list.push({ x: cx, z: z + R(-0.35, 0.35), yaw: (east ? Math.PI : 0) + slew, paint });
      x += K.len + R(0.9, 2.6) + (rng() < 0.06 ? R(5, 10) : 0);
    }
  };
  for (const z of LANES) {
    const east = z < -150;
    fill(104, XWAY.x1 - 4, z, east);                       // past the gore, east, to the horizon
    fill(SPAN.x1 + 0.5, XWAY_BLOCK - 0.5, z, east);        // the stub between the span and where you stop
    fill(XWAY.x0 + 4, SPAN.x0 - 1.5, z, east);             // past the span, west
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.35 });
  if (patchSun) patchSun(mat);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  const meshes = [];
  for (const K of kinds) {
    if (!K.list.length) continue;
    const M = new THREE.InstancedMesh(K.g, mat, K.list.length);
    K.list.forEach((o, i) => {
      e.set(0, o.yaw, 0); q.setFromEuler(e); m4.compose(p.set(o.x, XWAY.y, o.z), q, s); M.setMatrixAt(i, m4);
      M.setColorAt(i, c.setHex(o.paint).convertSRGBToLinear());
    });
    M.instanceMatrix.needsUpdate = true; M.instanceColor.needsUpdate = true;
    M.castShadow = true; M.receiveShadow = true; M.name = 'jamFar';
    scene.add(M); meshes.push(M);
  }
  return { meshes, mat, count: kinds.reduce((a, K) => a + K.list.length, 0) };
}
