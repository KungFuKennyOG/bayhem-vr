import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { terrainAt, walkable, roadNearest, ROAD_W, fbm2, YARD, MID, HUT, CHAPEL, LINE, TRACK_X, PYLON, SUMMIT_Y } from './layout.js';
import { Bucket, M4, mats, snowPatch } from './kit.js';
import { rockTextures } from './tex.js';

// =====================================================================================
//  Snow-laden spruce (two LODs swapped by distance every few frames; ~330 / 40 tris), granite
//  boulders and outcrops (instanced, snow settles on them through the kit's snow patch), and rows of
//  steel avalanche snow-bridges up the steep west wall — dark silhouettes in the storm.
// =====================================================================================
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

// ---- one spruce: a trunk + stacked star-shaped tiers; snow on the upper faces, dark needles under
function spruceGeo(seed, { tiers = 8, H = 1, R = 0.36, lod = 0 } = {}) {
  const rng = makeRng(seed);
  const pos = [], col = [], idx = [];
  const v = (x, y, z, c) => { pos.push(x, y, z); col.push(c[0], c[1], c[2]); return pos.length / 3 - 1; };
  const DARK = [0.035, 0.07, 0.05], MID = [0.06, 0.11, 0.075], SNOW = [0.86, 0.9, 0.97], BARK = [0.14, 0.1, 0.08];
  // trunk
  const ts = lod ? 4 : 6;
  for (let i = 0; i < ts; i++) {
    const a0 = i / ts * Math.PI * 2, a1 = (i + 1) / ts * Math.PI * 2;
    const r0 = 0.035 * H / 1, r1 = 0.012;
    const A = v(Math.cos(a0) * r0, -0.05, Math.sin(a0) * r0, BARK), B = v(Math.cos(a1) * r0, -0.05, Math.sin(a1) * r0, BARK), C = v(Math.cos(a1) * r1, H * 0.95, Math.sin(a1) * r1, BARK), D = v(Math.cos(a0) * r1, H * 0.95, Math.sin(a0) * r1, BARK);
    idx.push(A, C, B, A, D, C);
  }
  const T = lod ? 2 : tiers;
  for (let k = 0; k < T; k++) {
    const f = k / T;
    const y0 = H * (0.1 + 0.82 * f);
    const r = R * Math.pow(1 - f, 0.85) * (0.9 + rng() * 0.2) + 0.03;
    const th = H * (lod ? 0.4 : 0.2) * (1 - f * 0.4);
    const n = lod ? 6 : 9;
    const rot = rng() * 6.28;
    const top = v(0, y0 + th, 0, k === T - 1 ? SNOW : SNOW);
    const under = v(0, y0 + th * 0.18, 0, DARK);
    const rim = [], rimU = [], mid = [];
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * Math.PI * 2 + (rng() - 0.5) * 0.25;
      const rr = r * (i % 2 ? 0.72 + rng() * 0.12 : 1 + rng() * 0.12);
      const droop = th * (0.55 + rng() * 0.35);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      // snow lies on the inner two thirds of each tier; the tips poke out dark green
      const snowy = rng() < 0.85;
      mid.push(v(x * 0.62, y0 + th * 0.42 + rng() * 0.01, z * 0.62, snowy ? SNOW : MID));
      rim.push(v(x, y0 - droop * 0.35, z, i % 2 ? MID : DARK));
      rimU.push(v(x * 0.94, y0 - droop * 0.5, z * 0.94, DARK));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(top, mid[j], mid[i]);                       // snow cap
      idx.push(mid[i], mid[j], rim[j], mid[i], rim[j], rim[i]);   // the branch slope
      idx.push(under, rimU[i], rimU[j]);                   // the dark underside
      idx.push(rim[i], rim[j], rimU[j], rim[i], rimU[j], rimU[i]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---- a boulder: a noise-displaced icosphere, flattened a little, sitting on its base
function boulderGeo(seed, detail = 2) {
  const rng = makeRng(seed);
  let g = new THREE.IcosahedronGeometry(1, detail + 1);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);   // shared vertices: smooth normals
  const P = g.attributes.position;
  const o = [rng() * 10, rng() * 10, rng() * 10];
  for (let i = 0; i < P.count; i++) {
    _p.set(P.getX(i), P.getY(i), P.getZ(i));
    const n = Math.sin(_p.x * 2.1 + o[0]) * 0.5 + Math.sin(_p.y * 2.7 + o[1]) * 0.35 + Math.sin(_p.z * 3.3 + o[2]) * 0.3 + Math.sin((_p.x + _p.z) * 6 + o[0]) * 0.08;
    // weathered granite: broad lumps + a few soft planar breaks, squashed
    const d = 1 + (n * 0.6 + Math.round(n * 3) / 3 * 0.4) * 0.22 + Math.sin(_p.x * 9 + _p.y * 7 + o[2]) * 0.025;
    _p.multiplyScalar(d);
    _p.y *= 0.72;
    if (_p.y < -0.35) _p.y = -0.35 - (_p.y + 0.35) * 0.2;
    P.setXYZ(i, _p.x, _p.y, _p.z);
  }
  g.computeVertexNormals();
  const c = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const k = 0.75 + 0.25 * (P.getY(i) + 0.4); c[i * 3] = k; c[i * 3 + 1] = k; c[i * 3 + 2] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

export function buildFlora(ctx) {
  const root = new THREE.Group();
  const rng = makeRng(9001);
  const colliders = [];
  // ---------------------------------------------------------------- pines
  const trees = [];
  const nearRoadOK = (x, z) => { const R = roadNearest(x, z); return R.d > ROAD_W + 4.5; };
  const blocked = (x, z) => walkable(x, z) || !nearRoadOK(x, z) || (x > YARD.x0 - 8 && x < YARD.x1 + 6 && z > MID.z0 - 6 && z < YARD.z1 + 6)
    || (x > HUT.x0 - 4 && x < HUT.x1 + 4 && z > HUT.z0 - 4 && z < HUT.z1 + 4) || Math.hypot(x - CHAPEL.x, z - CHAPEL.z) < 9
    || (Math.abs(x - (TRACK_X[0] + TRACK_X[1]) / 2) < 14 && z < -10 && z > -300);   // the cable line corridor
  for (let i = 0; i < 9000 && trees.length < 900; i++) {
    const x = -170 + rng() * 360, z = -240 + rng() * 440;
    const y = terrainAt(x, z);
    if (y > 46 || y < -60) continue;                            // treeline / nothing in the gorge river
    const e = 1.2, sl = Math.hypot(terrainAt(x + e, z) - terrainAt(x - e, z), terrainAt(x, z + e) - terrainAt(x, z - e)) / (2 * e);
    if (sl > 0.8) continue;
    // clumps: noise decides the density; the banks between the switchback legs stay sparse (sight lines)
    const between = z < 112 && z > 40 && x > -60 && x < 52;
    const dens = fbm2(x * 0.03 + 3, z * 0.03) * 1.6 - 0.45 - (between ? 0.22 : 0) - sl * 0.4;
    if (rng() > dens) continue;
    if (blocked(x, z)) continue;
    if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 9)) continue;
    const s = 5 + rng() * 9 + (z < -20 ? 6 : 0);
    trees.push({ x, y: y - 0.3, z, s, r: rng() * 6.28, v: (rng() * 3) | 0, tint: 0.8 + rng() * 0.35 });
    if (s > 6 && fbm2(x, z) > 0) colliders.push({ min: [x - 0.25, y - 1, z - 0.25], max: [x + 0.25, y + 3, z + 0.25], data: { kind: 'tree', mat: 'wood', noBullet: false } });
  }
  // saplings / dwarf spruce on the banks between the legs (small, dark against the snow: they give the slopes scale)
  for (let i = 0; i < 4000 && trees.length < 1250; i++) {
    const x = -70 + rng() * 140, z = 36 + rng() * 84;
    const y = terrainAt(x, z);
    if (blocked(x, z) || rng() > 0.55) continue;
    const e = 1.2, sl = Math.hypot(terrainAt(x + e, z) - terrainAt(x - e, z), terrainAt(x, z + e) - terrainAt(x, z - e)) / (2 * e);
    if (sl > 1.1) continue;
    if (trees.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 6)) continue;
    trees.push({ x, y: y - 0.15, z, s: 1.4 + rng() * 2.6, r: rng() * 6.28, v: (rng() * 3) | 0, tint: 0.75 + rng() * 0.3 });
  }
  const treeMat = snowPatch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: true }), { amt: 0.25, rime: 0.3, key: 'pine' });
  const nearG = [0, 1, 2].map(k => spruceGeo(31 + k * 7, { tiers: 6 + k, R: 0.24 + k * 0.03 }));
  const farG = [0, 1, 2].map(k => spruceGeo(31 + k * 7, { lod: 1, R: 0.24 + k * 0.03 }));
  const nearM = nearG.map(g => { const m = new THREE.InstancedMesh(g, treeMat, 100); m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; root.add(m); return m; });
  const farM = farG.map(g => { const m = new THREE.InstancedMesh(g, treeMat, trees.length); m.count = 0; m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; root.add(m); return m; });
  for (const m of [...nearM, ...farM]) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.count === 0 ? m.instanceMatrix.count * 3 : 0), 3);
  const setTree = (M, i, t) => {
    _q.setFromEuler(_e.set(0, t.r, 0)); _s.set(t.s * (0.9 + 0.1 * Math.sin(t.r * 3)), t.s, t.s * (0.9 + 0.1 * Math.cos(t.r * 3)));
    _m.compose(_p.set(t.x, t.y, t.z), _q, _s); M.setMatrixAt(i, _m);
    M.instanceColor.setXYZ(i, t.tint, t.tint * (0.95 + 0.1 * Math.sin(t.r)), t.tint);
  };
  let lodT = 0;
  const relod = (head) => {
    const cn = [0, 0, 0], cf = [0, 0, 0];
    for (const t of trees) {
      const d2 = (t.x - head.x) ** 2 + (t.z - head.z) ** 2 + (t.y - head.y) ** 2 * 0.3;
      if (d2 < 46 * 46 && cn[t.v] < 100) setTree(nearM[t.v], cn[t.v]++, t);
      else if (d2 < 240 * 240) setTree(farM[t.v], cf[t.v]++, t);
    }
    nearM.forEach((m, k) => { m.count = cn[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
    farM.forEach((m, k) => { m.count = cf[k]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });
  };

  // ---------------------------------------------------------------- boulders + outcrops
  const R = rockTextures();
  const rockMat = mats.rock();
  const bG = [boulderGeo(5), boulderGeo(17), boulderGeo(29, 1)];
  for (const g of bG) { const P = g.attributes.position, U = new Float32Array(P.count * 2); for (let i = 0; i < P.count; i++) { U[i * 2] = P.getX(i) * 0.6 + P.getZ(i) * 0.3; U[i * 2 + 1] = P.getY(i) * 0.6; } g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); }
  const rocks = [[], [], []];
  // boulders sit on the lowest ground under them (no hovering on the downhill side)
  const addRock = (x, z, s, v, sink = 0.35) => { const rr = s * 0.85, y = Math.min(terrainAt(x, z), terrainAt(x + rr, z), terrainAt(x - rr, z), terrainAt(x, z + rr), terrainAt(x, z - rr)) - s * sink; rocks[v].push({ x, y, z, s, r: rng() * 6.28, t: rng() * 0.4 - 0.2 }); };
  for (let i = 0; i < 6000; i++) {
    const x = -200 + rng() * 520, z = -800 + rng() * 1000;
    const y = terrainAt(x, z);
    const e = 2, sl = Math.hypot(terrainAt(x + e, z) - terrainAt(x - e, z), terrainAt(x, z + e) - terrainAt(x, z - e)) / (2 * e);
    if (walkable(x, z) || roadNearest(x, z).d < ROAD_W + 2.2) continue;
    if (Math.abs(x - 85) < 10 && z < -14 && z > -300) continue;
    // cliffs and steep banks get outcrops, gentle slopes the odd boulder
    const want = sl > 0.9 ? 0.5 : sl > 0.5 ? 0.18 : 0.03;
    if (rng() > want) continue;
    const big = sl > 0.9 && rng() < 0.5;
    const near = Math.abs(z - 60) < 70 && x > -120 && x < 120;
    if (z < -405) continue;   // the face stays clean (the avalanche runs over it)
    if (Math.hypot(x + 93, z - 110.6) < (big ? 50 : 40)) continue;   // the opening view stays open (small dark rocks on the bank read as floating)
    if (!near && !big && rng() < 0.7) continue;
    if (near && !big && sl > 0.3 && rng() < 0.5) { addRock(x, z, 0.8 + rng() * 2.5, (rng() * 3) | 0, 0.4); continue; }
    const rs = big ? 3 + rng() * 6 : 0.6 + rng() * 2.2, rv = big ? 0 : (rng() * 3) | 0;
    // big ones whose flanks would bulge into a walkable area have no collider (too big for a box): leave them out
    if (rs >= 6 && [0, 1, 2, 3, 4, 5, 6, 7].some(k => walkable(x + Math.cos(k * 0.785) * rs * 1.25, z + Math.sin(k * 0.785) * rs * 1.25))) continue;
    addRock(x, z, rs, rv, big ? 0.5 : 0.35);
    if (rocks.reduce((a, r) => a + r.length, 0) > 520) break;
  }
  // hand-placed: boulders along the road edges as cover-ish dressing, a rock rib above leg 3 (the sniper ledge)
  for (const [x, z, s] of [[-24, 34, 3.2], [-30, 31, 2.2], [-18, 30.5, 1.8], [-52, 93, 1.4], [8, 117, 1.6], [62, 66, 2.0], [-90, 98, 2.5]]) addRock(x, z, s, 0, 0.3);
  rocks.forEach((list, v) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(bG[v], rockMat, list.length);
    list.forEach((r, i) => { _q.setFromEuler(_e.set(r.t, r.r, r.t * 0.5)); _m.compose(_p.set(r.x, r.y, r.z), _q, _s.set(r.s * 1.2, r.s, r.s)); m.setMatrixAt(i, _m); });
    m.castShadow = true; m.receiveShadow = true;
    m.computeBoundingSphere();
    root.add(m);
    for (const r of list) if (r.s > 0.7 && r.s < 6) { const h = r.s * 0.72; colliders.push({ min: [r.x - r.s * 0.8, r.y, r.z - r.s * 0.8], max: [r.x + r.s * 0.8, r.y + r.s * 0.35 + h * 0.6, r.z + r.s * 0.8], data: { kind: 'rock', mat: 'concrete' } }); }
  });

  // ---------------------------------------------------------------- avalanche snow-bridges (steel), rows on the steep walls
  const steel = new Bucket();
  const fenceRow = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 4.2);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = terrainAt(x, z);
      const yaw = Math.atan2(-(z1 - z0), x1 - x0);
      const dx = Math.cos(yaw), dz = -Math.sin(yaw);
      // downhill direction (approx): steepest descent
      const gx = terrainAt(x + 1, z) - terrainAt(x - 1, z), gz = terrainAt(x, z + 1) - terrainAt(x, z - 1), gl = Math.hypot(gx, gz) || 1;
      const ux = -gx / gl, uz = -gz / gl;   // downhill
      const H = 3.4, lean = 0.55;
      // the grate: 5 horizontal beams on two raking posts, leaning downhill-out
      for (const sx of [-1.95, 1.95]) {
        const bx = x + dx * sx, bz = z + dz * sx, by = terrainAt(bx, bz);
        steel.add(new THREE.BoxGeometry(0.12, H, 0.14), M4(bx + ux * lean * 0.5, by + H / 2 - 0.2, bz + uz * lean * 0.5, Math.atan2(lean, H) * uz, yaw, -Math.atan2(lean, H) * ux), [0.26, 0.24, 0.22]);
        // the strut back up the slope
        steel.add(new THREE.BoxGeometry(0.09, H * 0.8, 0.09), M4(bx - ux * 0.9, by + H * 0.3, bz - uz * 0.9, -Math.atan2(1.6, H) * uz, yaw, Math.atan2(1.6, H) * ux), [0.22, 0.2, 0.19]);
      }
      for (let k = 0; k < 6; k++) {
        const h = 0.25 + k * 0.58;
        steel.add(new THREE.BoxGeometry(4.2, 0.13, 0.08), M4(x + ux * lean * h / H, y + h, z + uz * lean * h / H, 0, yaw, 0), [0.3, 0.27, 0.24]);
      }
    }
  };
  for (let r = 0; r < 4; r++) fenceRow(-112 - r * 9, 50 + r * 3, -126 - r * 9, 112 - r * 2);
  for (let r = 0; r < 3; r++) fenceRow(154 + r * 10, 20 - r * 4, 170 + r * 10, 86 - r * 4);
  root.add(steel.mesh(mats.paint(), { name: 'fences' }));

  let frame = 0;
  return {
    root, colliders,
    update(dt, t, storm, head) { if (head && (frame++ % 20 === 0 || lodT === 0)) { lodT = 1; relod(head); } },
    anchors: { plumes: [] },
    info: { trees: trees.length, rocks: rocks.map(r => r.length) },
  };
}
