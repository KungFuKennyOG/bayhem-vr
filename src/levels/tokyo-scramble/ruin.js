import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex, makeNoise, fbm, scorchTexture } from '../../textures.js';
import { CENTER, CURB, MANHOLES } from './layout.js';
import { patchSun } from './sunshadow.js';

// =====================================================================================
//  What the gas chain leaves behind. The blasts were big but the street looked untouched a second
//  later, so every blown shop now stays blown: the shopfront becomes a gutted, ember-lit black hole,
//  soot climbs the facade over its signs, its fascia and awning lie smashed on the paving with a fan
//  of rubble, and a scorch mark spreads out across the street; every manhole leaves a burnt crater.
//  Fires keep burning in the gutted shops (and low in the open manholes) for the rest of the level.
//  All of it is built at load as instanced meshes with every instance hidden (scale 0); a blast only
//  reveals its own instances, so nothing compiles or allocates at runtime. 5 draw calls total.
// =====================================================================================
let _gut = null, _soot = null;
// the inside of a burnt-out shop: charcoal, a blackened ceiling, the skeletons of shelving, embers
// glowing along the floor and licking up the back (canvas values > emission via the material colour)
function gutTex() {
  if (_gut) return _gut;
  const W = 256, H = 128, cv = makeCanvas(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), n = makeNoise(611, 16), n2 = makeNoise(97, 8);
  const rng = makeRng(612);
  const shelves = []; for (let i = 0; i < 9; i++) shelves.push([rng() * W, 6 + rng() * 22, 30 + rng() * 60]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;                              // v 0 = top
    const f = fbm(n, u, v, 16, 4), f2 = fbm(n2, u, v * 0.5, 8, 3);
    let L = 0.05 + 0.06 * f;
    L *= 0.55 + 0.45 * Math.min(1, v * 2.2);                // the ceiling is blackest
    for (const [sx, sw, sh] of shelves) if (x > sx && x < sx + sw && y > H - sh - 10 && y < H - 10 && ((y + Math.floor(sx)) % 9 < 2 || x < sx + 2 || x > sx + sw - 2)) L *= 0.35;
    const ember = Math.pow(Math.max(0, v - 0.62) / 0.38, 1.6) * (0.5 + 0.9 * f2);   // the floor glows
    const lick = Math.max(0, f2 - 0.6) * 3 * Math.max(0, v - 0.25);                   // flames up the back
    const e = Math.min(1, ember + lick * 0.6);
    const R = L + e * 1.0, G = L * 0.95 + e * 0.42, B = L * 0.9 + e * 0.1;
    const i = (y * W + x) * 4;
    img.data[i] = Math.min(255, R * 255); img.data[i + 1] = Math.min(255, G * 255); img.data[i + 2] = Math.min(255, B * 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (_gut = canvasTex(cv, { repeat: false }));
}
// soot up a facade: a ragged plume, widest and densest at the bottom (over the fascia), feathering out
function sootTex() {
  if (_soot) return _soot;
  const W = 128, H = 256, cv = makeCanvas(W, H), g = cv.getContext('2d'), img = g.createImageData(W, H), n = makeNoise(813, 8), n2 = makeNoise(41, 16);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = 1 - y / H;                          // v 0 = bottom
    const f = fbm(n, u, v, 8, 4), f2 = fbm(n2, u, v * 2, 16, 3);
    const w = 0.5 - 0.3 * v + (f - 0.5) * 0.25;              // half-width narrows as it climbs
    const r = Math.abs(u - 0.5) / Math.max(0.05, w);
    let a = Math.max(0, 1 - Math.pow(r, 2.2)) * (1 - Math.pow(v, 1.3)) * (0.75 + 0.5 * f2);
    a *= Math.min(1, v * 10 + 0.4);
    const i = (y * W + x) * 4;
    img.data[i] = 14; img.data[i + 1] = 11; img.data[i + 2] = 9; img.data[i + 3] = Math.min(255, a * 1.25 * 255);
  }
  g.putImageData(img, 0, 0);
  return (_soot = canvasTex(cv, { repeat: false }));
}

const RUBBLE_COLS = [0x2a2826, 0x3a3734, 0x56524c, 0x7a766e, 0x1a1918, 0x8a8478, 0x6a3a2a, 0xb8a040, 0x9a2a20];
export function buildRuin(scene, shops) {
  const rng = makeRng(4242), R = (a, b) => a + (b - a) * rng();
  const nS = shops.length, nM = MANHOLES.length;
  const PER = 40;                                             // rubble chunks per shop (+ 3 slabs)
  const plane = new THREE.PlaneGeometry(1, 1);
  const gutMat = new THREE.MeshBasicMaterial({ map: gutTex(), color: new THREE.Color(1.5, 1.5, 1.5) });
  const sootMat = new THREE.MeshBasicMaterial({ map: sootTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const scorchMat = new THREE.MeshBasicMaterial({ map: scorchTexture(), transparent: true, depthWrite: false, opacity: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rubMat = patchSun(new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.05 }));
  const gut = new THREE.InstancedMesh(plane, gutMat, nS * 2);   // the shopfront + (big ones) a blown-out floor above
  const soot = new THREE.InstancedMesh(plane, sootMat, nS);
  const scorch = new THREE.InstancedMesh(plane, scorchMat, nS * 2 + nM);
  const rub = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rubMat, nS * (PER + 3));
  soot.renderOrder = 2; scorch.renderOrder = 1;
  rub.castShadow = true; rub.receiveShadow = true;
  const all = [gut, soot, scorch, rub];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const M of all) { M.frustumCulled = false; for (let i = 0; i < M.count; i++) M.setMatrixAt(i, hide); scene.add(M); }
  for (let i = 0; i < rub.count; i++) rub.setColorAt(i, c.setHex(RUBBLE_COLS[i % RUBBLE_COLS.length]).convertSRGBToLinear());
  const up = (M) => { M.instanceMatrix.needsUpdate = true; };

  // the per-shop layouts are decided at load (seeded), revealed on the blast
  const plans = shops.map((S, k) => {
    const sd = S.side, fx = sd * CENTER.half, yaw = sd < 0 ? Math.PI / 2 : -Math.PI / 2;   // plane +z -> into the street
    const L = Math.max(2, S.len - 0.9);
    const pieces = [];
    for (let j = 0; j < PER; j++) {
      // a fan out of the doorway: most close in, a few skidding to the middle of the street
      const out = Math.pow(rng(), 1.7) * 6.5 + 0.3, along = (rng() - 0.5) * (S.len + out * 0.6);
      const sz = (j < 5 ? R(0.7, 1.15) : R(0.12, 0.55)) * (1 - out / 12);   // a few big lumps of the floors above
      pieces.push({ p: [fx - sd * out, CURB + sz * 0.35, S.z + along], s: [sz * R(0.8, 1.8), sz * R(0.4, 0.9), sz * R(0.8, 1.6)], r: [R(-0.5, 0.5), R(0, 6.28), R(-0.5, 0.5)] });
    }
    // the fascia board, a shutter sheet and an awning frame, smashed down onto the paving
    pieces.push({ p: [fx - sd * 1.2, CURB + 0.35, S.z + R(-1, 1)], s: [0.12, 0.9, Math.min(L, 5) * 0.8], r: [R(-0.2, 0.2), 0, sd * R(1.1, 1.3)] });
    pieces.push({ p: [fx - sd * 2.4, CURB + 0.08, S.z + R(-1.5, 1.5)], s: [1.6, 0.05, Math.min(L, 4) * 0.7], r: [R(-0.15, 0.15), R(-0.5, 0.5), R(-0.12, 0.12)] });
    pieces.push({ p: [fx - sd * 0.9, CURB + 0.9, S.z + R(-L / 3, L / 3)], s: [0.1, 0.1, Math.min(L, 4.5)], r: [R(0.2, 0.5), R(-0.3, 0.3), sd * R(0.6, 0.9)] });
    // the heaps that keep burning out in the street
    const heaps = [0, 1].map(() => [fx - sd * R(1.8, 4.8), S.z + R(-S.len / 2, S.len / 2)]);
    return { S, sd, fx, yaw, L, pieces, heaps, k, on: false, big: false };
  });
  const manPlans = MANHOLES.map(() => ({ on: false }));

  function revealShop(i, big = false) {
    const P = plans[i]; if (!P || P.on) return; P.on = true; P.big = big;
    const { S, sd, fx, yaw, L } = P;
    // the gutted opening, just behind where the glass was
    e.set(0, yaw, 0); q.setFromEuler(e);
    m4.compose(p.set(fx - sd * 0.04, CURB + 1.55, S.z), q, s.set(L, 3.0, 1)); gut.setMatrixAt(i, m4);
    // the big ones took a floor above with them: a burning hole torn through the facade
    if (big) { P.hy = R(6.4, 8.4); P.hw = Math.min(L, R(4, 6.5)); P.hz = S.z + R(-1, 1) * Math.max(0, (L - P.hw) / 2); m4.compose(p.set(fx - sd * 0.05, P.hy, P.hz), q, s.set(P.hw * (rng() < 0.5 ? -1 : 1), R(2.4, 3.2), 1)); gut.setMatrixAt(nS + i, m4); }
    // soot up the front, over the fascia sign (it sits 0.335 out)
    m4.compose(p.set(fx - sd * 0.37, 2.0 + 5.0, S.z + R(-0.6, 0.6)), q, s.set(S.len * R(1.0, 1.25) * (rng() < 0.5 ? -1 : 1), 10.5, 1)); soot.setMatrixAt(i, m4);
    // a scorch fanning out over the paving + a second, darker one right at the door
    e.set(-Math.PI / 2, 0, R(0, 6.28)); q.setFromEuler(e);
    m4.compose(p.set(fx - sd * 4.2, CURB + 0.012 + i * 0.0004, S.z), q, s.set(R(7.5, 9), R(7.5, 9) * Math.max(1, S.len / 8), 1)); scorch.setMatrixAt(i * 2, m4);
    e.set(-Math.PI / 2, 0, R(0, 6.28)); q.setFromEuler(e);
    m4.compose(p.set(fx - sd * 1.6, CURB + 0.016 + i * 0.0004, S.z + R(-1, 1)), q, s.set(R(4, 5), R(4, 5), 1)); scorch.setMatrixAt(i * 2 + 1, m4);
    P.pieces.forEach((pc, j) => {
      e.set(pc.r[0], pc.r[1], pc.r[2]); q.setFromEuler(e);
      m4.compose(p.set(...pc.p), q, s.set(...pc.s)); rub.setMatrixAt(i * (PER + 3) + j, m4);
    });
    for (const M of all) up(M);
  }
  function revealManhole(i, M) {
    const P = manPlans[i]; if (!P || P.on) return; P.on = true;
    e.set(-Math.PI / 2, 0, R(0, 6.28)); q.setFromEuler(e);
    m4.compose(p.set(M.x, CURB + 0.02 + i * 0.0004, M.z), q, s.set(R(4.2, 5.2), R(4.2, 5.2), 1)); scorch.setMatrixAt(nS * 2 + i, m4);
    up(scorch);
  }

  // the fires that stay: in the gutted shops (within sight of you), a little smoke off each, and the
  // low flicker out of the open manholes. Cheap: a handful of particles a second per source.
  const _p = new THREE.Vector3(), _w = new THREE.Vector3();
  function update(dt, g) {
    const hp = g.headPos;
    for (const P of plans) {
      if (!P.on) continue;
      const S = P.S, d = Math.abs(hp.z - S.z) + Math.abs(hp.x - P.fx) * 0.5;
      if (d > 75) continue;
      const k = d < 30 ? 1 : 0.5;
      if (rng() < dt * 10 * k) g.fx.flame(_p.set(P.fx + P.sd * R(0.3, 1.0), CURB + R(0.1, 1.4), S.z + R(-P.L / 2, P.L / 2)), R(1.1, 2.0), _w.set(-P.sd * R(0.2, 1), 0, 0));
      for (const [hx, hz] of P.heaps) if (rng() < dt * 3 * k) g.fx.flame(_p.set(hx + R(-0.5, 0.5), CURB + 0.1, hz + R(-0.5, 0.5)), R(0.8, 1.4));
      if (P.big && rng() < dt * 6 * k) g.fx.flame(_p.set(P.fx - P.sd * 0.2, P.hy + R(-1, 0.8), P.hz + R(-P.hw / 2, P.hw / 2)), R(1.2, 2.0), _w.set(-P.sd * R(0.5, 1.5), 0.5, 0));
      if (P.big && rng() < dt * 0.35 * k) { const s0 = R(2, 3); g.clouds.spawn({ x: P.fx - P.sd * 1.2, y: P.hy + 1.5, z: P.hz, vx: -P.sd * R(0.3, 0.8), vy: R(2.5, 3.5), vz: R(-0.4, 0.4), drag: 0.35, buoy: 0.35, s0, s1: s0 * 4.5, life: R(7, 10), a: 0.8, fadeIn: 0.1, fadeOut: 0.5, r: 0.06, g: 0.05, b: 0.045, r1: 0.12, g1: 0.1, b1: 0.09, glow: 1.0, glowFade: 2 }); }
      // flames curling out over the top of the opening, up the soot
      if (rng() < dt * 2.2 * k) g.fx.flame(_p.set(P.fx - P.sd * 0.3, CURB + R(2.6, 3.0), S.z + R(-P.L / 3, P.L / 3)), R(0.8, 1.3), _w.set(-P.sd * 0.6, 0.5, 0));
      if (rng() < dt * 0.45 * k) { const s0 = R(1.6, 2.4); g.clouds.spawn({ x: P.fx - P.sd * 1.0, y: CURB + 3.2, z: S.z + R(-1.5, 1.5), vx: -P.sd * R(0.3, 0.8), vy: R(2.2, 3.4), vz: R(-0.4, 0.4), drag: 0.35, buoy: 0.35, s0, s1: s0 * R(3.5, 4.5), life: R(6, 9), a: 0.75, fadeIn: 0.12, fadeOut: 0.5, r: 0.06, g: 0.05, b: 0.045, r1: 0.12, g1: 0.1, b1: 0.09, glow: 0.9, glowFade: 2 }); }
    }
    for (let i = 0; i < MANHOLES.length; i++) {
      const M = MANHOLES[i]; if (!manPlans[i].on || (M.jetT ?? 0) > 0.3) continue;
      if (Math.abs(hp.z - M.z) > 60) continue;
      if (rng() < dt * 4) g.fx.flame(_p.set(M.x + R(-0.25, 0.25), CURB + 0.05, M.z + R(-0.25, 0.25)), R(0.55, 0.9));
    }
  }
  return { revealShop, revealManhole, update, meshes: all, mats: [gutMat, sootMat, scorchMat, rubMat], plans };
}
