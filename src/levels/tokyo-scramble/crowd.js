import * as THREE from 'three';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  The last of the crowd: when the level opens, the scramble is still emptying — a few dozen people
//  running out of the crossing down the avenues and into Center-gai, bags flying, while the gunmen
//  move in. Cheap on purpose: three instanced meshes (torso + head, left leg, right leg), a stride
//  from swinging the legs about the hip, a bob and a forward lean. Nobody here is a target and they
//  are gone (past the ends of the streets) in ~25 s.
// =====================================================================================
const CLOTHES = [0x1c1c20, 0x2a3a5a, 0xe8e4dc, 0x8a8e94, 0x5a2a2a, 0x3a4a3a, 0xc8b8a0, 0x24242a, 0xd8d8d4, 0x6a5a7a];
export function buildCrowd(scene, { n = 46 } = {}) {
  const rng = makeRng(1985);
  const R = (a, b) => a + (b - a) * rng();
  const torso = new THREE.BoxGeometry(0.42, 0.62, 0.24).translate(0, 1.18, 0);
  const head = new THREE.SphereGeometry(0.12, 8, 6).translate(0, 1.64, 0);
  const bag = new THREE.BoxGeometry(0.1, 0.32, 0.26).translate(0.26, 1.0, 0);
  const body = mergeGeo([torso, head, bag]);
  const leg = new THREE.BoxGeometry(0.15, 0.86, 0.16).translate(0, -0.43, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  const mB = new THREE.InstancedMesh(body, mat, n), mL = new THREE.InstancedMesh(leg, mat, n), mR = new THREE.InstancedMesh(leg, mat, n);
  for (const m of [mB, mL, mR]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
  const exits = [[175, -6], [175, 6], [6, 140], [-6, 140], [-2, -132], [3, -132], [31, -58]];
  const P = [];
  for (let i = 0; i < n; i++) {
    const x = R(-24, 26), z = R(-24, 24);
    const e = exits[Math.floor(rng() * exits.length)];
    // run for the exit that's away from the station (the west) and roughly the way you're facing already
    const ex = e[0] + R(-3, 3), ez = e[1] + R(-3, 3);
    const c = new THREE.Color(CLOTHES[i % CLOTHES.length]).convertSRGBToLinear(), cl = new THREE.Color(CLOTHES[(i * 3 + 1) % CLOTHES.length]).convertSRGBToLinear();
    mB.setColorAt(i, c); mL.setColorAt(i, cl); mR.setColorAt(i, cl);
    P.push({ p: new THREE.Vector3(x, 0.15, z), to: new THREE.Vector3(ex, 0.15, ez), v: R(3.6, 5.6), ph: R(0, 6), delay: R(0, 3.5), s: R(0.92, 1.08), done: false, wp: Math.abs(ex) > 100 || Math.abs(ez) > 100 ? null : null });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), d = new THREE.Vector3();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  let t = 0;
  const update = (dt, groundAt) => {
    t += dt;
    for (let i = 0; i < n; i++) {
      const a = P[i];
      if (a.done || t < a.delay) { if (a.done) { mB.setMatrixAt(i, hide); mL.setMatrixAt(i, hide); mR.setMatrixAt(i, hide); } else place(i, a, 0, 0); continue; }
      d.subVectors(a.to, a.p); d.y = 0; const L = d.length();
      if (L < 1 || t > 40) { a.done = true; continue; }
      d.divideScalar(L); a.p.addScaledVector(d, a.v * dt); a.p.y = groundAt ? groundAt(a.p.x, a.p.z) : 0.15;
      a.yaw = Math.atan2(d.x, d.z);
      place(i, a, Math.sin(t * a.v * 2.1 + a.ph), 1);
    }
    for (const m of [mB, mL, mR]) m.instanceMatrix.needsUpdate = true;
  };
  function place(i, a, sw, run) {
    const bob = run * Math.abs(sw) * 0.06, lean = run * 0.22;
    e3.set(lean, a.yaw ?? 0, 0, 'YXZ'); q.setFromEuler(e3); sc.setScalar(a.s);
    pos.copy(a.p); pos.y += bob; m4.compose(pos, q, sc); mB.setMatrixAt(i, m4);
    for (const [m, s] of [[mL, 1], [mR, -1]]) {
      e3.set(sw * 0.75 * s * run, a.yaw ?? 0, 0, 'YXZ'); q.setFromEuler(e3);
      const side = 0.11 * s, cy = Math.cos(a.yaw ?? 0), sy = Math.sin(a.yaw ?? 0);
      pos.set(a.p.x + cy * side, a.p.y + 0.88 * a.s + bob, a.p.z - sy * side); m4.compose(pos, q, sc); m.setMatrixAt(i, m4);
    }
  }
  for (let i = 0; i < n; i++) place(i, P[i], 0, 0);
  for (const m of [mB, mL, mR]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
  return { update, meshes: [mB, mL, mR], mat };
}
function mergeGeo(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const g0 of list) {
    const g = g0.index ? g0 : g0; const p = g.attributes.position.array, nn = g.attributes.normal.array, ii = g.index.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(nn[i]); }
    for (let i = 0; i < ii.length; i++) idx.push(ii[i] + off);
    off += p.length / 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
