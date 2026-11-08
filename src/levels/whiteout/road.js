import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { ROAD, ROAD_SEGS, ROAD_W, ROAD_LEN, roadAt, terrainAt, LEG1, LEG2, LEG3, HP1, HP2, VALLEY } from './layout.js';
import { roadSnowTexture, signTexture } from './tex.js';
import { Bucket, M4, mats, rbox, snowCap, hexc, snowPatch } from './kit.js';
import { makeCanvas, canvasTex } from '../../textures.js';

// =====================================================================================
//  The mountain road: snow-packed carriageway (tyre ruts, grit, crown), plough banks along both edges,
//  dressed-stone retaining walls on the uphill side (as tall as the cut), stone parapets with capping
//  slabs on the downhill side (cover for whoever is on the road above you), W-beam guardrails round
//  the hairpins, orange snow poles, signs (hairpin numbers, the chevrons, the cable car, avalanche danger).
// =====================================================================================
const _v = new THREE.Vector3();

// road frame at distance s: point, tangent, left normal, and which side is uphill (+1 = left)
function frame(s) {
  const a = roadAt(Math.max(0, s - 0.6)), b = roadAt(Math.min(ROAD_LEN, s + 0.6)), p = roadAt(s);
  let tx = b[0] - a[0], tz = b[2] - a[2]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
  const nx = -tz, nz = tx;                        // left of travel
  const up = nz < 0 ? 1 : -1;                     // the side whose normal points north is uphill
  return { x: p[0], y: p[1], z: p[2], tx, tz, nx, nz, up };
}
// which legs carry walls / parapets (straight runs); hairpins get rails
const legRanges = () => {
  // along-distances of the legs (computed by walking the polyline)
  const out = [];
  let acc = 0;
  const pts = ROAD;
  const near = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]) < 0.01;
  const idx = (q) => pts.findIndex(p => near(p, q));
  const along = (i) => { let s = 0; for (let k = 0; k < i; k++) s += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][2] - pts[k][2]); return s; };
  for (const L of [LEG1, LEG2, LEG3]) out.push([along(idx(L.a)), along(idx(L.b))]);
  out.valley = [0, along(idx(LEG1.a))];
  void acc;
  return out;
};

export function buildRoad(ctx) {
  const root = new THREE.Group();
  const rng = makeRng(4401);
  const colliders = [], glows = [], pools = [], plumes = [];
  const legs = legRanges();
  const onLeg = (s) => legs.some(([a, b]) => s > a + 2 && s < b - 2) || (s > legs.valley[0] + 6 && s < legs.valley[1]);
  const W = ROAD_W;

  // ---------------------------------------------------------------- carriageway
  {
    const T = roadSnowTexture();
    const mat = new THREE.MeshStandardMaterial({ map: T.map, normalMap: T.normal, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xf2f4f8, roughness: 0.62, vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aGlow; varying vec3 vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlow;')
        // the dark polished ruts are glazed ice: glossier where the texture is darker
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.28, 0.8, smoothstep(0.35, 0.85, dot(diffuseColor.rgb, vec3(0.33))));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;');
    };
    mat.customProgramCacheKey = () => 'wo-road';
    const pos = [], nrm = [], uv = [], col = [], idx = [];
    const LAT = [-1.0, -0.82, -0.5, -0.2, 0, 0.2, 0.5, 0.82, 1.0];
    let n = 0;
    for (let s = 0; s <= ROAD_LEN + 0.01; s += 1) {
      const F = frame(Math.min(s, ROAD_LEN));
      for (const l of LAT) {
        const lat = l * (W + 0.15);
        const crown = 0.05 * (1 - l * l);
        const x = F.x + F.nx * lat, z = F.z + F.nz * lat, y = F.y + 0.02 + crown;
        pos.push(x, y, z); nrm.push(0, 1, 0); uv.push((l + 1) / 2, s / 12);
        const edge = Math.abs(l) > 0.9 ? 0.82 : 1;
        col.push(edge, edge, edge);
      }
      if (s > 0) {
        const a = (n - 1) * LAT.length, b = n * LAT.length;
        for (let k = 0; k < LAT.length - 1; k++) idx.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k);
      }
      n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.name = 'road';
    root.add(m);
    root.userData.roadMesh = m;
  }

  // ---------------------------------------------------------------- banks, walls, parapets
  const snow = new Bucket(), stone = new Bucket(), paint = new Bucket(), metal = new Bucket();
  // plough banks: a lofted lump each side; taller (drifted) against the uphill wall
  {
    const pos = [], col = [], idx = [];
    const PRO = [[0.0, 0.0], [0.25, 0.32], [0.6, 0.75], [1.0, 1.0], [1.35, 0.85], [1.6, 0.5]];
    for (const side of [-1, 1]) {
      let n = 0;
      for (let s = 0; s <= ROAD_LEN; s += 0.8) {
        const F = frame(s);
        const upSide = side === F.up;
        const legHere = onLeg(s);
        const h = (upSide ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(s * 0.21 + 1.3)) : 0.32 + 0.18 * (0.5 + 0.5 * Math.sin(s * 0.33))) * (legHere || !upSide ? 1 : 0.7)
          + 0.08 * Math.sin(s * 1.7) + 0.05 * Math.sin(s * 3.9 + side);
        const reach = upSide ? 1.55 : (legHere ? 0.92 : 1.2);
        for (const [a, hh] of PRO) {
          const lat = side * (W + 0.05 + a / 1.6 * reach);
          const x = F.x + F.nx * lat, z = F.z + F.nz * lat;
          const y = F.y + 0.02 + hh * h - (a > 1.4 && !upSide ? 0.1 : 0);
          pos.push(x, y, z);
          const ao = 0.86 + 0.14 * hh;
          col.push(ao * 0.98, ao, ao * 1.02);
        }
        if (n > 0) { const P = PRO.length, A = (n - 1) * P, B = n * P; for (let k = 0; k < P - 1; k++) { if (side > 0) idx.push(A + k, A + k + 1, B + k, A + k + 1, B + k + 1, B + k); else idx.push(A + k, B + k, A + k + 1, A + k + 1, B + k, B + k + 1); } }
        n++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos.splice(0), 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col.splice(0), 3));
      g.setIndex(idx.splice(0)); g.computeVertexNormals();
      // uv: planar world xz
      const P = g.attributes.position, U = new Float32Array(P.count * 2);
      for (let i = 0; i < P.count; i++) { U[i * 2] = P.getX(i) / 5; U[i * 2 + 1] = P.getZ(i) / 5; }
      g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
      snow.add(g);
    }
  }
  // retaining walls (uphill) and parapets (downhill) on the straight runs, in 3 m panels
  const panel = 3.0;
  for (let s = 1; s < ROAD_LEN - 1; s += panel) {
    if (!onLeg(s + panel / 2)) continue;
    const A = frame(s), B = frame(Math.min(ROAD_LEN, s + panel));
    const C = frame(s + panel / 2);
    // ---- the uphill wall: face at W + 1.6, as tall as the cut behind it
    {
      const off = (W + 1.6) * C.up;
      const lat0 = off, lat1 = off + C.up * 0.65;
      const hAt = (F) => { const bx = F.x + F.nx * (off + F.up * 1.4), bz = F.z + F.nz * (off + F.up * 1.4); return Math.min(3.6, Math.max(0, terrainAt(bx, bz) - F.y + 0.25)); };
      const h0 = hAt(A), h1 = hAt(B);
      if (Math.max(h0, h1) > 0.55) {
        const pA0 = [A.x + A.nx * lat0, A.z + A.nz * lat0], pB0 = [B.x + B.nx * lat0, B.z + B.nz * lat0];
        const pA1 = [A.x + A.nx * lat1, A.z + A.nz * lat1], pB1 = [B.x + B.nx * lat1, B.z + B.nz * lat1];
        const y0A = A.y - 0.4, y0B = B.y - 0.4, yA = A.y + Math.max(0.6, h0), yB = B.y + Math.max(0.6, h1);
        // a slightly battered face (leans back into the hill)
        const g = new THREE.BufferGeometry();
        const bat = C.up * 0.12;
        const vtx = [
          pA0[0], y0A, pA0[1], pB0[0], y0B, pB0[1], pB0[0] + C.nx * bat, yB, pB0[1] + C.nz * bat, pA0[0] + C.nx * bat, yA, pA0[1] + C.nz * bat,   // face
          pA0[0] + C.nx * bat, yA, pA0[1] + C.nz * bat, pB0[0] + C.nx * bat, yB, pB0[1] + C.nz * bat, pB1[0], yB, pB1[1], pA1[0], yA, pA1[1],   // top
        ];
        g.setAttribute('position', new THREE.Float32BufferAttribute(vtx, 3));
        g.setIndex(C.up > 0 ? [0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6] : [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
        g.computeVertexNormals();
        stone.add(g, null, (p) => { const t = Math.min(1, Math.max(0, (p.y - A.y) / 1.2)); const k = 0.72 + 0.28 * t; return [k, k * 0.99, k * 0.98]; }, { uvScale: 2.2 });
        // capping snow: a fat rounded drift along the top
        const len = Math.hypot(pB0[0] - pA0[0], pB0[1] - pA0[1]);
        const cap = snowCap(len + 0.15, 1.15, 0.42, s * 0.37, 6, 2);
        const yaw = Math.atan2(-(pB0[1] - pA0[1]), pB0[0] - pA0[0]);
        snow.add(cap, M4((pA0[0] + pB0[0]) / 2 + C.nx * C.up * 0.32, (yA + yB) / 2 + 0.12, (pA0[1] + pB0[1]) / 2 + C.nz * C.up * 0.32, 0, yaw, Math.atan2(yB - yA, len)), [0.95, 0.97, 1]);
      }
    }
    // ---- the downhill parapet: 0.8 m dressed stone with capping slabs
    {
      const dn = -C.up;
      const latA = (W + 0.95) * dn, latB = (W + 1.5) * dn;
      const mx = C.x + C.nx * (latA + latB) / 2, mz = C.z + C.nz * (latA + latB) / 2;
      const len = panel + 0.02, yaw = Math.atan2(-C.tz, C.tx);
      // broken sections: something went through the wall here (a gap, rubble)
      const broken = (Math.floor(s / panel) * 7919) % 23 === 3;
      const h = broken ? 0.32 : 0.8;
      const pitch = Math.atan2(B.y - A.y, Math.hypot(B.x - A.x, B.z - A.z));
      const body = rbox(len, h + 0.6, 0.5, 0.03);
      stone.add(body, M4(mx, C.y - 0.3 + h / 2 + 0.02, mz, 0, yaw, pitch), (p) => { const t = Math.min(1, Math.max(0, (p.y - C.y + 0.1) / 0.9)); const k = 0.6 + 0.35 * t; return [k, k * 0.99, k * 0.97]; }, { uvScale: 2.6 });
      if (!broken) {
        stone.add(rbox(len - 0.04, 0.12, 0.62, 0.03), M4(mx, C.y + h + 0.08, mz, 0, yaw, pitch), [0.78, 0.77, 0.75], { uvScale: 1.5 });
        snow.add(snowCap(len, 0.62, 0.2, s * 0.71, 6, 1), M4(mx, C.y + h + 0.2, mz, 0, yaw, pitch), [0.95, 0.97, 1]);
      } else {
        for (let k = 0; k < 4; k++) stone.add(rbox(0.5 + rng() * 0.4, 0.3, 0.4, 0.05), M4(mx + (rng() - 0.5) * 2.5, C.y + 0.1, mz + (rng() - 0.5) * 1.2, rng(), rng() * 6, rng()), [0.6, 0.6, 0.58], { uvScale: 1.5 });
      }
      // collider (AABB of the panel)
      const hx = Math.abs(C.tx) * len / 2 + Math.abs(C.nx) * 0.28, hz = Math.abs(C.tz) * len / 2 + Math.abs(C.nz) * 0.28;
      colliders.push({ min: [mx - hx, Math.min(A.y, B.y) - 0.6, mz - hz], max: [mx + hx, Math.max(A.y, B.y) + h + 0.14, mz + hz], data: { kind: 'parapet', mat: 'concrete' } });
    }
  }

  // ---------------------------------------------------------------- guardrails round the hairpins + the valley bend
  {
    const railSpan = (s0, s1, side) => {
      for (let s = s0; s < s1; s += 2) {
        const F = frame(s), G = frame(Math.min(s + 2, s1));
        const lat = side * (W + 1.0);
        const p = [F.x + F.nx * lat, F.y, F.z + F.nz * lat], q = [G.x + G.nx * lat, G.y, G.z + G.nz * lat];
        // post
        metal.add(new THREE.BoxGeometry(0.11, 1.0, 0.11), M4(p[0], p[1] + 0.25, p[2]), (P) => (P.y < p[1] + 0.15 ? [0.3, 0.3, 0.3] : [0.62, 0.64, 0.66]));
        // W-beam: two humps (a stretched box pair), slightly rust-streaked
        const L = Math.hypot(q[0] - p[0], q[2] - p[2]), yaw = Math.atan2(-(q[2] - p[2]), q[0] - p[0]), pitch = Math.atan2(q[1] - p[1], L);
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, mz = (p[2] + q[2]) / 2;
        const off = -side * 0.08;
        for (const dy of [0.62, 0.78]) metal.add(rbox(L + 0.06, 0.13, 0.05, 0.02), M4(mx + F.nx * off, my + dy, mz + F.nz * off, 0, yaw, pitch), (P) => { const r = 0.5 + 0.5 * Math.sin(P.x * 2.1 + P.z * 1.3); return [0.6 + r * 0.06, 0.62, 0.64 - r * 0.05]; });
        // reflector on every other post
        if (((s - s0) / 2) % 2 === 0) glows.push({ p: [p[0] + F.nx * off * 2, p[1] + 0.85, p[2] + F.nz * off * 2], color: side * F.up > 0 ? [1.4, 1.2, 1.0] : [2.2, 0.25, 0.15], size: 0.16, near: true });
        // snow on the beam
        snow.add(snowCap(L, 0.16, 0.08, s, 3, 1), M4(mx + F.nx * off, my + 0.9, mz + F.nz * off, 0, yaw, pitch), [0.95, 0.97, 1]);
        const hx = Math.abs(F.tx) * L / 2 + Math.abs(F.nx) * 0.12, hz = Math.abs(F.tz) * L / 2 + Math.abs(F.nz) * 0.12;
        colliders.push({ min: [mx - hx, my - 0.5, mz - hz], max: [mx + hx, my + 0.95, mz + hz], data: { kind: 'rail', mat: 'metal', noBullet: true } });
      }
    };
    // hairpins: rail on the outside of each curve
    const sHP1a = legs[0][1] - 2, sHP1b = legs[1][0] + 2, sHP2a = legs[1][1] - 2, sHP2b = legs[2][0] + 2;
    const outside = (sa, sb) => { const F = frame((sa + sb) / 2); const cx = (frame(sa).x + frame(sb).x) / 2, cz = (frame(sa).z + frame(sb).z) / 2; return ((F.x - cx) * F.nx + (F.z - cz) * F.nz) > 0 ? 1 : -1; };
    railSpan(sHP1a, sHP1b, outside(sHP1a, sHP1b));
    railSpan(sHP2a, sHP2b, outside(sHP2a, sHP2b));
  }

  // ---------------------------------------------------------------- snow poles (orange / black, downhill edge), every ~11 m
  for (let s = 6; s < ROAD_LEN - 4; s += 11) {
    const F = frame(s), lat = -F.up * (W + 0.75);
    const x = F.x + F.nx * lat, z = F.z + F.nz * lat, y = F.y;
    const lean = (Math.sin(s * 1.37) * 0.04);
    metal.add(new THREE.CylinderGeometry(0.035, 0.04, 2.1, 6), M4(x, y + 0.9, z, lean, 0, lean * 0.6), (P, N, L) => { const band = Math.floor((L.y + 1.05) / 0.35) % 2 === 0; return band ? [0.95, 0.32, 0.05] : [0.06, 0.06, 0.06]; });
    glows.push({ p: [x - F.nx * 0.05 * F.up, y + 1.8, z - F.nz * 0.05 * F.up], color: [1.6, 1.4, 1.1], size: 0.09, near: true });
  }

  // ---------------------------------------------------------------- signs (one atlas, one draw)
  {
    const cells = [
      { lines: [['KEHRE', 52], ['1', 120]], bg: '#f4f2ec', fg: '#173d8c', border: '#173d8c' },
      { lines: [['KEHRE', 52], ['2', 120]], bg: '#f4f2ec', fg: '#173d8c', border: '#173d8c' },
      { lines: [['⚠ LAWINENGEFAHR', 58], ['AVALANCHE DANGER', 44]], bg: '#f2c414', fg: '#151515', border: '#151515' },
      { lines: [['GRAUHORN-BAHN', 64], ['MITTELSTATION  1.6 km', 40]], bg: '#6b3a1c', fg: '#f6efe0', border: '#f6efe0' },
      { lines: [['STRASSE GESPERRT', 56], ['ROAD CLOSED', 44]], bg: '#f4f2ec', fg: '#b01818', border: '#b01818' },
      { lines: [['»»»', 150]], bg: '#c41a1a', fg: '#f4f2ec', border: null },
      { lines: [['KETTEN', 70], ['OBLIGATORISCH', 46]], bg: '#1a4fa8', fg: '#f4f2ec', border: '#f4f2ec' },
      { lines: [['GRAUHORN', 60], ['3 412 m  ↑', 50]], bg: '#6b3a1c', fg: '#f6efe0', border: '#f6efe0' },
    ];
    const CW = 512, CH = 256, cols = 2, rows = 4;
    const c = makeCanvas(CW * cols, CH * rows), x = c.getContext('2d');
    cells.forEach((C, i) => {
      const t = signTexture(C.lines, { w: CW, h: CH, bg: C.bg, fg: C.fg, border: C.border, seed: i + 3, age: 0.7 });
      x.drawImage(t.image, (i % cols) * CW, Math.floor(i / cols) * CH);
    });
    const tex = canvasTex(c, { repeat: false });
    const signM = snowPatch(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 }), { amt: 0.8, rime: 0.6, key: 'sg' });
    const sb = new Bucket();
    const place = (cell, s, side, { w = 1.6, h = 0.8, hy = 2.2, face = 0, flip = false } = {}) => {
      const F = frame(s), lat = side * (W + 1.25);
      const x0 = F.x + F.nx * lat, z0 = F.z + F.nz * lat, y0 = F.y;
      // faces traffic coming up the road (or down) + a slight toe-in
      const yaw = Math.atan2(F.tx, F.tz) + (flip ? 0 : Math.PI) + face;
      const u0 = (cell % cols) / cols, v1 = 1 - Math.floor(cell / cols) / rows, u1 = u0 + 1 / cols, v0 = v1 - 1 / rows;
      const pg = new THREE.PlaneGeometry(w, h); const uv = pg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
      sb.add(pg, M4(x0, y0 + hy, z0, 0, yaw, 0));
      // back plate + posts
      paint.add(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.03), M4(x0 - Math.sin(yaw) * 0.025, y0 + hy, z0 - Math.cos(yaw) * 0.025, 0, yaw, 0), [0.45, 0.46, 0.48]);
      for (const sx of w > 1.2 ? [-w * 0.35, w * 0.35] : [0]) {
        const px = x0 + Math.cos(yaw) * sx - Math.sin(yaw) * 0.06, pz = z0 - Math.sin(yaw) * sx - Math.cos(yaw) * 0.06;
        metal.add(new THREE.CylinderGeometry(0.04, 0.045, hy + h / 2, 6), M4(px, y0 + (hy + h / 2) / 2 - 0.1, pz), [0.55, 0.57, 0.6]);
      }
      snow.add(snowCap(w + 0.06, 0.12, 0.07, s, 3, 1), M4(x0, y0 + hy + h / 2 + 0.04, z0, 0, yaw, 0), [0.95, 0.97, 1]);
    };
    const [l1a, l1b] = legs[0], [l2a, l2b] = legs[1], [l3a, l3b] = legs[2];
    place(3, l1a + 34, -1, { w: 2.2, h: 1.1, hy: 2.0 });                       // the brown cable-car sign (up leg 1: not behind the title)
    place(2, l1a + 14, 1, { w: 1.5, h: 0.75, hy: 2.1 });
    place(0, l1b - 8, -1, { w: 0.9, h: 0.6, hy: 2.0 });                        // KEHRE 1
    place(5, l1b - 1, -1, { w: 1.4, h: 0.55, hy: 1.3, face: -0.35 });           // chevrons into the hairpin
    place(5, l1b + 12, 1, { w: 1.4, h: 0.55, hy: 1.3, face: 0.4 });
    place(6, l2a + 10, 1, { w: 1.2, h: 0.75, hy: 2.1 });
    place(1, l2b - 8, 1, { w: 0.9, h: 0.6, hy: 2.0 });                         // KEHRE 2
    place(5, l2b - 1, 1, { w: 1.4, h: 0.55, hy: 1.3, face: 0.35 });
    place(7, l3a + 18, -1, { w: 1.6, h: 0.8, hy: 2.2 });
    place(4, l3b - 6, -1, { w: 1.8, h: 0.9, hy: 1.9 });
    const sm = sb.mesh(signM, { shadow: true }); sm.name = 'signs';
    root.add(sm);
  }

  // ---------------------------------------------------------------- the valley: where the road disappears into the storm

  root.add(snow.mesh(mats.snow(), { shadow: false, name: 'banks' }));
  root.add(stone.mesh(mats.stone(), { name: 'walls' }));
  root.add(paint.mesh(mats.paint(), { name: 'roadpaint' }));
  root.add(metal.mesh(mats.metal(), { name: 'roadmetal' }));
  // bake warm pools into the road surface once everything has reported its lights
  const finalize = (allPools) => {
    const m = root.userData.roadMesh, P = m.geometry.attributes.position, G = m.geometry.attributes.aGlow;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      let r = 0, g = 0, b = 0;
      for (const L of allPools) { const dx = x - L.p[0], dz = z - L.p[2], dy = (y - L.p[1]) * 0.6, d2 = dx * dx + dz * dz + dy * dy, R = L.r || 9; if (d2 > R * R * 4) continue; const k = Math.exp(-d2 / (R * R)) * (L.k ?? 1); r += L.c[0] * k; g += L.c[1] * k; b += L.c[2] * k; }
      G.setXYZ(i, r, g, b);
    }
    G.needsUpdate = true;
  };
  return { root, colliders, finalize, anchors: { glows, pools, plumes } };
}
