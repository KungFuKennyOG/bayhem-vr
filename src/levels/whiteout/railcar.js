import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Bucket, M4, mats, rbox } from './kit.js';
import { makeCanvas, canvasTex } from '../../textures.js';

// =====================================================================================
//  The rack railcar (a 1960s Swiss "BDhe 4/4" type, Grauhornbahn red and cream) that takes you out
//  through the tunnel. Built like the cabin: a lofted body (rounded noses in plan, the windscreens raked
//  back, tumblehome on the window band, a crowned roof), real window openings with glass, a lit interior
//  you ride in (wood-lined walls, green benches in two bays, luggage racks, ceiling lights, a centre
//  vestibule with the doors), a cab at each end (control desk, the round controller handwheel the driver
//  holds, gauges), two bogies with rack pinions on the centre rack, the underframe gear, couplers, the
//  Swiss triangle of headlights, a single-arm pantograph on the roof.
//  Local frame: railhead at y ~0.06, floor at FY, length along z (±4.6), the driver's cab at -z.
// =====================================================================================
const PI = Math.PI;
export const RC = { FY: 0.95, L: 9.2, W: 2.6, driverSeat: new THREE.Vector3(-0.55, 0.95 + 0.47, -3.65), stand: new THREE.Vector3(0.25, 0.95, 0.2), wire: 4.92 };
// side windows (z ranges) and the doorway; everything between them is a pillar
const WIN = [[-3.05, -2.05], [-1.85, -0.85], [-0.55, 0.55], [0.85, 1.85], [2.05, 3.05]];
const DOOR = [-0.6, 0.6];

let _mats = null;
function railMats() {
  if (_mats) return _mats;
  const glass = new THREE.MeshStandardMaterial({ color: 0x3c4a5c, roughness: 0.05, metalness: 0.75, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.1 });
  // the interior lights itself a little (the ceiling lights): emissive = vertex colour * k
  const inside = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.05, vertexColors: true, emissive: 0xffd9a8, emissiveIntensity: 0.2 });
  inside.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb;'); };
  inside.customProgramCacheKey = () => 'wo-rc-in';
  // lettering on the letterboard
  const lc = makeCanvas(1024, 96), lx = lc.getContext('2d');
  lx.clearRect(0, 0, 1024, 96); lx.fillStyle = '#efe6d2'; lx.font = '700 64px Anton, Impact, sans-serif'; lx.textAlign = 'center'; lx.textBaseline = 'middle';
  lx.fillText('G R A U H O R N B A H N', 512, 52);
  const nc = makeCanvas(256, 96), nx = nc.getContext('2d');
  nx.clearRect(0, 0, 256, 96); nx.fillStyle = '#efe6d2'; nx.font = '700 40px Anton, Impact, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillText('BDhe 4/4  12', 128, 50);
  const letter = new THREE.MeshBasicMaterial({ map: canvasTex(lc, { repeat: false }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const number = new THREE.MeshBasicMaterial({ map: canvasTex(nc, { repeat: false }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  _mats = { glass, inside, letter, number };
  return _mats;
}

export function buildRailcar({ seed = 12 } = {}) {
  const rng = makeRng(seed);
  const M = railMats();
  const root = new THREE.Group();
  const P = new Bucket(), I = new Bucket(), D = new Bucket(), T = new Bucket(), L = new Bucket(), G = new Bucket();
  const { FY } = RC, HL = RC.L / 2, HW = RC.W / 2;
  const cR = new THREE.Color(0x9c1712), RED = [cR.r, cR.g, cR.b], REDD = [cR.r * 0.72, cR.g * 0.72, cR.b * 0.72];
  const CREAM = [0.86, 0.81, 0.69], GREY = [0.4, 0.41, 0.43], SKIRT = [0.09, 0.09, 0.1], RUB = [0.04, 0.04, 0.045], CHROME = [0.62, 0.64, 0.67], STEEL = [0.22, 0.23, 0.25];
  const WOOD = [0.46, 0.3, 0.17], CEIL = [0.6, 0.58, 0.53], GREEN = [0.08, 0.2, 0.14];
  // road grime: darker toward the skirt, streaks under the windows
  const grime = (c) => (q, n, l) => { const t = Math.min(1, Math.max(0, (l.y - 0.6) / 1.0)); const k = (0.72 + 0.28 * t) * (1 - 0.06 * (0.5 + 0.5 * Math.sin(l.z * 23.0 + l.x)) * (1 - t)); return [c[0] * k, c[1] * k, c[2] * k]; };

  // ---- the plan: a rounded rectangle (half width A, half length B, corner r) with fixed stations along the
  //      sides (window edges) so every ring has the same points; tags say what each segment is
  const sideZ = [...new Set(WIN.flat().concat(DOOR))].sort((a, b) => a - b);
  const plan = (A, B, r) => {
    const pts = [], arc = (cx, cz, t0, t1, tag) => { for (let k = 0; k < 6; k++) { const t = t0 + (t1 - t0) * k / 6; pts.push({ x: cx + Math.cos(t) * r, z: cz + Math.sin(t) * r, tag: tag + k }); } };
    const zs = [-(B - r), ...sideZ.filter(z => Math.abs(z) < B - r - 0.02), B - r];
    // right side (+x), back to front... going +z
    for (let i = 0; i < zs.length - 1; i++) pts.push({ x: A, z: zs[i], tag: 'R' + i });
    arc(A - r, B - r, 0, PI / 2, 'nB');                 // back-right (+z end)
    for (let k = 0; k < 2; k++) pts.push({ x: (A - r) - k * (A - r), z: B, tag: 'eB' + k });
    arc(-(A - r), B - r, PI / 2, PI, 'mB');
    for (let i = zs.length - 1; i > 0; i--) pts.push({ x: -A, z: zs[i], tag: 'L' + (i - 1) });
    arc(-(A - r), -(B - r), PI, 1.5 * PI, 'nF');
    for (let k = 0; k < 2; k++) pts.push({ x: -(A - r) + k * (A - r), z: -B, tag: 'eF' + k });
    arc(A - r, -(B - r), 1.5 * PI, 2 * PI, 'mF');
    return pts;
  };
  const ring = (y, ins, sb) => { const A = HW - ins, B = HL - sb, r = Math.min(0.95, A - 0.06); return plan(A, B, r).map(p => ({ ...p, y })); };
  // what a segment of the window band is: glass (side windows, the cab side windows, the windscreens) or pillar
  const segKind = (p, q) => {
    const t = p.tag;
    if (t[0] === 'R' || t[0] === 'L') { const zm = (p.z + q.z) / 2; return WIN.some(([a, b]) => zm > a && zm < b) ? 'glass' : 'pillar'; }
    const k = +t.slice(2);
    if (t[0] === 'e') return 'glass';                                      // windscreen centre
    // the corner arcs: n* run side → end, m* run end → side
    const kk = t[0] === 'n' ? k : 5 - k;
    return kk <= 1 ? 'glass' : kk === 2 ? 'pillar' : 'glass';
  };
  // loft rings into a bucket; flip = facing inward (the interior lining)
  const loft = (bucket, rings, colorOf, flip = false) => {
    const n = rings[0].length, pos = [], col = [], idx = [];
    for (const R of rings) for (const p of R) { pos.push(p.x, p.y, p.z); const c = colorOf(p); col.push(c[0], c[1], c[2]); }
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) { const i2 = (i + 1) % n, a0 = j * n + i, a1 = j * n + i2, b0 = a0 + n, b1 = a1 + n; idx.push(a0, b0, a1, a1, b0, b1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    // outward test on the first quad; flip to taste
    const N = g.attributes.normal, out = N.getX(0) * pos[0] > 0 ? 1 : -1;
    if ((out < 0) !== flip) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    bucket.add(g, null, [1, 1, 1]);
  };
  // band geometry (sill at Y0, head at Y1)
  const Y0 = 1.93, Y1 = 2.82;
  const bandIns = (y) => 0.005 + (y - Y0) * 0.05, bandSb = (y) => 0.01 + (y - Y0) * 0.42;
  // ---- lower body: skirt, red flanks, the cream belt line, a black rubber sill strip under the glass
  const LOW = [[0.6, 0.13, 0.13, SKIRT], [0.66, 0.05, 0.05, SKIRT], [0.7, 0.0, 0.0, RED], [1.7, 0.0, 0.0, RED], [1.72, -0.008, 0.0, CREAM], [1.84, -0.008, 0.0, CREAM], [1.86, 0.0, 0.0, RED], [1.9, 0.0, 0.004, RUB], [Y0, bandIns(Y0), bandSb(Y0), RUB]];
  loft(P, LOW.map(([y, i, s]) => ring(y, i, s)), (p) => { const r = LOW.find(r => Math.abs(r[0] - p.y) < 1e-6); return r[3] === RED ? grime(RED)(null, null, p) : r[3]; });
  // ---- upper body: rubber head strip, the red letterboard, a grey roof crowned in toward the centre
  const UP = [[Y1, bandIns(Y1), bandSb(Y1), RUB], [Y1 + 0.03, bandIns(Y1), bandSb(Y1) + 0.01, RED], [3.04, 0.07, 0.48, RED], [3.07, 0.075, 0.5, GREY], [3.2, 0.17, 0.57, GREY], [3.32, 0.42, 0.66, GREY], [3.4, 0.8, 0.8, GREY]];
  loft(P, UP.map(([y, i, s]) => ring(y, i, s)), (p) => UP.find(r => Math.abs(r[0] - p.y) < 1e-6)[3]);
  { const r = ring(3.4, 0.8, 0.8); const sh = new THREE.Shape(r.map(p => new THREE.Vector2(p.x, p.z))); const g = new THREE.ShapeGeometry(sh, 1); g.rotateX(-PI / 2); g.translate(0, 3.4, 0); P.add(g, null, GREY); }
  // floor pan under the skirt
  { const r = ring(0.6, 0.13, 0.13); const sh = new THREE.Shape(r.map(p => new THREE.Vector2(p.x, p.z))); const g = new THREE.ShapeGeometry(sh, 1); g.rotateX(PI / 2); g.translate(0, 0.6, 0); P.add(g, null, SKIRT); }
  // ---- the window band: glass where it's open, pillars (outside red, inside wood) elsewhere
  {
    const r0 = ring(Y0, bandIns(Y0), bandSb(Y0)), r1 = ring(Y1, bandIns(Y1), bandSb(Y1)), n = r0.length;
    const q0 = ring(Y0, bandIns(Y0) + 0.07, bandSb(Y0) + 0.07), q1 = ring(Y1, bandIns(Y1) + 0.07, bandSb(Y1) + 0.07);
    const gp = [], gi = [];
    for (let i = 0; i < n; i++) {
      const a0 = r0[i], a1 = r0[(i + 1) % n], b0 = r1[i], b1 = r1[(i + 1) % n];
      const kind = segKind(a0, a1);
      if (kind === 'glass') { const o = gp.length / 3; gp.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z); gi.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); continue; }
      for (const [inset, bucket, c] of [[0, P, RED], [1, I, WOOD]]) {
        const pp = inset ? [q0[i], q0[(i + 1) % n], q1[i], q1[(i + 1) % n]] : [a0, a1, b0, b1];
        const q = pp.flatMap(p => [p.x, p.y, p.z]);
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(q, 3));
        g.setIndex(inset ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2]); g.computeVertexNormals();
        // outward / inward check
        const N = g.attributes.normal, mx = (a0.x + a1.x) / 2, mz = (a0.z + a1.z) / 2, d = N.getX(0) * mx + N.getZ(0) * mz;
        if ((d < 0) !== !!inset) { g.setIndex(inset ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3]); g.computeVertexNormals(); }
        bucket.add(g, null, c);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); g.setIndex(gi); g.computeVertexNormals();
    const glass = new THREE.Mesh(g, M.glass); glass.renderOrder = 6; glass.castShadow = false; root.add(glass);
    // a chrome window divider in each windscreen and black wipers
    for (const e of [-1, 1]) {
      const zc = e * (HL - bandSb((Y0 + Y1) / 2)) + e * 0.01;
      T.add(new THREE.BoxGeometry(0.05, (Y1 - Y0) / Math.cos(0.39), 0.05), M4(0, (Y0 + Y1) / 2, zc, -e * 0.39, 0, 0), RUB);   // follows the rake
    }
  }
  // ---- interior lining: lower walls (wood), ceiling (cream), ends
  const LOWI = [[FY, 0.07, 0.07], [Y0, bandIns(Y0) + 0.07, bandSb(Y0) + 0.07]];
  loft(I, LOWI.map(([y, i, s]) => ring(y, i, s)), (p) => p.y < FY + 0.12 ? [WOOD[0] * 0.6, WOOD[1] * 0.6, WOOD[2] * 0.6] : WOOD, true);
  const UPI = [[Y1, bandIns(Y1) + 0.07, bandSb(Y1) + 0.07], [3.0, 0.15, 0.56], [3.25, 0.45, 0.72], [3.32, 0.85, 0.86]];
  loft(I, UPI.map(([y, i, s]) => ring(y, i, s)), () => CEIL, true);
  { const r = ring(3.32, 0.85, 0.86); const sh = new THREE.Shape(r.map(p => new THREE.Vector2(p.x, p.z))); const g = new THREE.ShapeGeometry(sh, 1); g.rotateX(PI / 2); g.translate(0, 3.32, 0); I.add(g, null, CEIL); }
  // ceiling detail: panel joints across it, a louvred air duct down the middle, the light fittings' housings
  for (let z = -3.2; z <= 3.2; z += 0.8) T.add(new THREE.BoxGeometry(1.7, 0.012, 0.025), M4(0, 3.27, z), [0.42, 0.4, 0.36]);
  T.add(new THREE.BoxGeometry(0.34, 0.05, 6.4), M4(0, 3.25, 0), [0.6, 0.58, 0.54]);
  for (let z = -3.1; z < 3.2; z += 0.2) T.add(new THREE.BoxGeometry(0.3, 0.01, 0.04), M4(0, 3.223, z), [0.25, 0.24, 0.22]);
  for (const sx of [-0.42, 0.42]) T.add(new THREE.BoxGeometry(0.26, 0.04, 6.4), M4(sx, 3.27, 0), [0.5, 0.48, 0.45]);
  // wood panelling joints on the lower walls, a dado rail under the sills, heater grilles at the floor
  for (const sx of [-1, 1]) {
    T.add(new THREE.BoxGeometry(0.03, 0.04, 6.5), M4(sx * (HW - 0.09), Y0 - 0.22, 0), [0.3, 0.2, 0.11]);
    for (let z = -3.2; z <= 3.2; z += 0.8) if (Math.abs(z) > 0.7) T.add(new THREE.BoxGeometry(0.012, Y0 - FY - 0.3, 0.02), M4(sx * (HW - 0.075), (FY + Y0 - 0.25) / 2, z), [0.28, 0.18, 0.1]);
    for (const [a, b] of [[-3.1, -0.8], [0.8, 3.1]]) { T.add(new THREE.BoxGeometry(0.04, 0.16, b - a), M4(sx * (HW - 0.1), FY + 0.12, (a + b) / 2), [0.16, 0.16, 0.17]); for (let z = a + 0.05; z < b; z += 0.08) T.add(new THREE.BoxGeometry(0.045, 0.12, 0.015), M4(sx * (HW - 0.1), FY + 0.12, z), [0.06, 0.06, 0.06]); }
  }
  // floor: dark linoleum, a lighter aisle runner, the vestibule's ribbed plates
  I.add(new THREE.BoxGeometry(RC.W - 0.18, 0.05, RC.L - 0.5), M4(0, FY - 0.025, 0), [0.14, 0.13, 0.13]);
  I.add(new THREE.BoxGeometry(0.62, 0.006, 6.6), M4(0, FY + 0.003, 0), [0.3, 0.2, 0.12]);
  for (let k = 0; k < 9; k++) I.add(new THREE.BoxGeometry(RC.W - 0.3, 0.008, 0.03), M4(0, FY + 0.006, -0.5 + k * 0.125), [0.38, 0.38, 0.4]);
  // the windows' inner sills and the rubber window frames inside
  for (const sx of [-1, 1]) for (const [a, b] of WIN) {
    I.add(new THREE.BoxGeometry(0.12, 0.04, b - a + 0.06), M4(sx * (HW - 0.12), Y0 - 0.02, (a + b) / 2), [WOOD[0] * 0.8, WOOD[1] * 0.8, WOOD[2] * 0.8]);
    for (const zz of [a, b]) D.add(new THREE.BoxGeometry(0.1, Y1 - Y0, 0.04), M4(sx * (HW - 0.02), (Y0 + Y1) / 2, zz), RUB);
  }
  // ---- bulkheads between the saloon and the cabs: a doorway each (you see the driver through it), a window either side
  for (const e of [-1, 1]) {
    const z = e * 3.3, c = WOOD;
    for (const [x0, x1] of [[-HW + 0.08, -0.38], [0.38, HW - 0.08]]) {
      I.add(new THREE.BoxGeometry(x1 - x0, Y0 - FY, 0.06), M4((x0 + x1) / 2, (FY + Y0) / 2, z), c);
      I.add(new THREE.BoxGeometry(x1 - x0, 3.2 - (Y0 + 0.75), 0.06), M4((x0 + x1) / 2, (Y0 + 0.75 + 3.2) / 2, z), c);
      for (const xx of [x0 + 0.03, x1 - 0.03]) I.add(new THREE.BoxGeometry(0.06, 0.75, 0.07), M4(xx, Y0 + 0.375, z), c);
      const gq = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.06, 0.72), M.glass); gq.position.set((x0 + x1) / 2, Y0 + 0.375, z); gq.renderOrder = 6; root.add(gq);
    }
    I.add(new THREE.BoxGeometry(0.76, 3.2 - (FY + 2.05), 0.06), M4(0, (FY + 2.05 + 3.2) / 2, z), c);
    for (const xx of [-0.38, 0.38]) I.add(new THREE.BoxGeometry(0.05, 2.05, 0.08), M4(xx, FY + 1.025, z), [0.3, 0.2, 0.11]);
  }
  // ---- the saloon: green benches in two bays facing each other, chrome frames, luggage racks, grab poles, lights
  const bench = (x, z, face) => {
    I.add(rbox(0.92, 0.13, 0.5, 0.04), M4(x, FY + 0.44, z), GREEN);
    I.add(rbox(0.92, 0.66, 0.11, 0.04), M4(x, FY + 0.84, z - face * 0.24, -face * 0.12, 0, 0), GREEN);
    I.add(new THREE.BoxGeometry(0.92, 0.06, 0.06), M4(x, FY + 1.19, z - face * 0.29), CHROME);   // the top grab rail
    for (const sx of [-0.4, 0.4]) { T.add(new THREE.BoxGeometry(0.04, 0.4, 0.04), M4(x + sx, FY + 0.19, z), CHROME); T.add(new THREE.BoxGeometry(0.04, 0.04, 0.46), M4(x + sx, FY + 0.38, z), CHROME); }
    I.add(new THREE.BoxGeometry(0.06, 0.06, 0.42), M4(x + (x > 0 ? -0.46 : 0.46), FY + 0.66, z), CHROME);   // aisle armrest
  };
  for (const sx of [-0.79, 0.79]) { bench(sx, -2.92, 1); bench(sx, -1.02, -1); bench(sx, 1.02, 1); bench(sx, 2.92, -1); }
  for (const sx of [-1, 1]) for (const [a, b] of [[-3.2, -0.8], [0.8, 3.2]]) {
    for (const dx of [0, 0.32]) T.add(new THREE.BoxGeometry(0.025, 0.025, b - a), M4(sx * (HW - 0.2 - dx), Y1 + 0.1, (a + b) / 2), CHROME);
    for (let z = a + 0.1; z < b; z += 0.62) T.add(new THREE.BoxGeometry(0.02, 0.14, 0.02), M4(sx * (HW - 0.2), Y1 + 0.03, z), CHROME);
  }
  for (const [x, z] of [[-0.42, -0.66], [0.42, -0.66], [-0.42, 0.66], [0.42, 0.66]]) T.add(new THREE.CylinderGeometry(0.02, 0.02, 3.25 - FY, 8), M4(x, (FY + 3.25) / 2, z), CHROME);
  for (const sx of [-0.42, 0.42]) for (let k = 0; k < 4; k++) L.add(new THREE.BoxGeometry(0.2, 0.025, 1.25), M4(sx, 3.255, -2.55 + k * 1.7), [1.5, 1.32, 1.0]);
  // ---- the cabs: control desk, the controller handwheel, gauges, a brake valve; the driver's seat at -z
  for (const e of [-1, 1]) {
    const zD = e * 4.2;
    I.add(rbox(1.3, 0.74, 0.26, 0.03), M4(0, FY + 0.37, e * 4.34), [0.2, 0.21, 0.23]);
    I.add(rbox(1.3, 0.12, 0.34, 0.03), M4(0, FY + 0.8, e * 4.32, e * 0.5, 0, 0), [0.24, 0.25, 0.27]);
    for (let k = 0; k < 5; k++) { D.add(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 14).rotateX(PI / 2), M4(-0.05 + k * 0.15, FY + 0.88, e * 4.36, -e * 0.5, 0, 0), [0.08, 0.08, 0.09]); L.add(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 12).rotateX(PI / 2), M4(-0.05 + k * 0.15, FY + 0.885, e * 4.34, -e * 0.5, 0, 0), k % 2 ? [1.3, 0.75, 0.22] : [0.8, 1.1, 0.95]); }
    // the handwheel the driver holds: where his seat says the wheel is (seat + (0, 0.4, -0.5), tilt 0.42)
    const S = RC.driverSeat, wx = S.x, wy = S.y + 0.4;   // mirrored for the +z cab
    const wc = new THREE.Vector3(wx, wy, e < 0 ? S.z - 0.5 : -(S.z - 0.5));
    T.add(new THREE.TorusGeometry(0.185, 0.018, 6, 24).rotateX(e < 0 ? 0.42 : -0.42), M4(wc.x, wc.y, wc.z), [0.06, 0.06, 0.065]);
    for (let k = 0; k < 3; k++) T.add(new THREE.BoxGeometry(0.34, 0.014, 0.014).rotateZ(k * PI / 3).rotateX(e < 0 ? 0.42 : -0.42), M4(wc.x, wc.y, wc.z), CHROME);
    T.add(new THREE.CylinderGeometry(0.05, 0.07, wy - FY - 0.72, 8), M4(wc.x, (FY + 0.72 + wy) / 2 - 0.04, wc.z + e * 0.05), [0.18, 0.18, 0.2]);
    T.add(new THREE.BoxGeometry(0.03, 0.22, 0.03), M4(0.5, FY + 1.0, e * 4.12, e * 0.3, 0, 0), CHROME);   // brake handle
    L.add(new THREE.SphereGeometry(0.035, 8, 6), M4(0.5, FY + 1.12, e * 4.15), [1.6, 0.2, 0.1]);
    // the seat: cushion top at the driver's seat point, a back against the bulkhead
    const sz = e < 0 ? S.z : -S.z;
    I.add(rbox(0.5, 0.1, 0.46, 0.04), M4(S.x, S.y - 0.06, sz), [0.1, 0.1, 0.11]);
    I.add(rbox(0.48, 0.62, 0.09, 0.04), M4(S.x, S.y + 0.33, sz - e * 0.27, e * 0.12, 0, 0), [0.1, 0.1, 0.11]);
    T.add(new THREE.CylinderGeometry(0.04, 0.05, S.y - 0.1 - FY, 8), M4(S.x, (S.y - 0.1 + FY) / 2, sz), STEEL);
  }
  // ---- the doors (centre, both sides): two leaves with tall windows, a step under, grab handles
  for (const sx of [-1, 1]) {
    const x = sx * (HW + 0.012);
    for (const [a, b] of [[DOOR[0], -0.01], [0.01, DOOR[1]]]) {
      P.add(new THREE.BoxGeometry(0.025, Y0 - 0.72, b - a - 0.02), M4(x, (0.72 + Y0) / 2, (a + b) / 2), REDD);
      P.add(new THREE.BoxGeometry(0.03, 0.06, b - a - 0.02), M4(x + sx * 0.003, 1.78, (a + b) / 2), CREAM);
    }
    P.add(new THREE.BoxGeometry(0.03, Y1 - 0.72, 0.03), M4(x + sx * 0.004, (0.72 + Y1) / 2, 0), RUB);
    for (const zz of [DOOR[0] - 0.08, DOOR[1] + 0.08]) T.add(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), M4(x + sx * 0.06, 1.35, zz), CHROME);
    D.add(new THREE.BoxGeometry(0.3, 0.05, 1.1), M4(sx * (HW - 0.05), 0.46, 0), STEEL);
    for (const zz of [-0.5, 0.5]) D.add(new THREE.BoxGeometry(0.05, 0.22, 0.05), M4(sx * (HW - 0.12), 0.56, zz), STEEL);
  }
  // ---- livery: lettering on both letterboards, the type + number by the cabs
  for (const sx of [-1, 1]) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.32), M.letter); q.position.set(sx * (HW - 0.06), 2.93, 0); q.rotation.y = sx * PI / 2; root.add(q);
    const nq = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), M.number); nq.position.set(sx * (HW + 0.014), 1.3, -sx * 2.6); nq.rotation.y = sx * PI / 2; root.add(nq);
  }
  // ---- the ends: the Swiss headlight triangle, red markers, a coupler with its buffer, grab rails, a horn
  const lights = [];
  const noseZ = (x) => { const A = HW, r = 0.95; return (HL - r) + Math.sqrt(Math.max(0, r * r - Math.max(0, Math.abs(x) - (A - r)) ** 2)); };
  for (const e of [-1, 1]) {
    for (const sx of [-0.72, 0.72]) {
      const zn = e * noseZ(sx), ry = (a) => (e > 0 ? Math.sign(sx) * a : PI - Math.sign(sx) * a);
      D.add(new THREE.CylinderGeometry(0.13, 0.15, 0.1, 14).rotateX(PI / 2), M4(sx, 1.3, zn, 0, Math.sign(sx) * e * 0.4, 0), [0.08, 0.08, 0.09]);
      L.add(new THREE.CircleGeometry(0.1, 14), M4(sx, 1.3, zn + e * 0.05, 0, ry(0.4), 0), [3.0, 2.7, 2.2]);
      const mx = Math.sign(sx) * 1.0; L.add(new THREE.CircleGeometry(0.045, 10), M4(mx, 1.05, e * (noseZ(mx) + 0.012), 0, ry(0.8), 0), [2.2, 0.18, 0.08]);
      if (e > 0) lights.push(new THREE.Vector3(sx, 1.3, zn + 0.2));
    }
    const zt = e * (HL - 0.43);
    D.add(new THREE.CylinderGeometry(0.11, 0.12, 0.1, 14).rotateX(PI / 2), M4(0, 2.95, zt), [0.08, 0.08, 0.09]);
    L.add(new THREE.CircleGeometry(0.085, 14), M4(0, 2.95, zt + e * 0.055, 0, e > 0 ? 0 : PI, 0), [3.0, 2.7, 2.2]);
    if (e > 0) lights.push(new THREE.Vector3(0, 2.95, zt + 0.15));
    // coupler: a draw-bar with a round head and the yellow-black striped buffer beam under the nose
    T.add(new THREE.BoxGeometry(0.2, 0.2, 0.5), M4(0, 0.78, e * (HL + 0.02)), [0.09, 0.09, 0.1]);
    T.add(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12).rotateX(PI / 2), M4(0, 0.78, e * (HL + 0.3)), [0.07, 0.07, 0.075]);
    P.add(new THREE.BoxGeometry(1.9, 0.16, 0.12), M4(0, 0.6, e * (HL - 0.16)), (q) => (Math.floor((q.x + 3) * 3.2) % 2 ? [0.7, 0.55, 0.05] : [0.04, 0.04, 0.04]));
    for (const sx of [-0.95, 0.95]) T.add(new THREE.CylinderGeometry(0.018, 0.018, 0.8, 8), M4(sx, 1.3, e * (noseZ(sx) + 0.07)), CHROME);
    T.add(new THREE.CylinderGeometry(0.05, 0.03, 0.3, 8).rotateX(PI / 2), M4(0.3, 3.45, e * (HL - 1.0)), CHROME);
  }
  // ---- the roof: a single-arm pantograph up to the contact wire, its insulators, a resistor box, cable runs
  {
    const rod = (a, b, r, c, bucket = T) => { const d = b.clone().sub(a), Ln = d.length(); bucket.add(new THREE.CylinderGeometry(r, r, Ln, 8), new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)), c); };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const pz = 1.7, base = 3.42, head = RC.wire - 0.04;
    D.add(new THREE.BoxGeometry(1.1, 0.08, 1.5), M4(0, base + 0.2, pz), [0.25, 0.26, 0.28]);
    for (const [x, z] of [[-0.45, pz - 0.6], [0.45, pz - 0.6], [-0.45, pz + 0.6], [0.45, pz + 0.6]]) { for (let k = 0; k < 4; k++) D.add(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 10), M4(x, base + 0.04 + k * 0.045, z), [0.62, 0.5, 0.36]); }
    const knee = V(0, head - 0.55, pz + 0.95);
    for (const sx of [-0.12, 0.12]) rod(V(sx, base + 0.26, pz - 0.5), V(sx * 0.6, knee.y, knee.z), 0.035, [0.6, 0.6, 0.62]);
    rod(V(0, base + 0.26, pz - 0.35), V(0, knee.y - 0.2, knee.z - 0.15), 0.015, [0.6, 0.6, 0.62]);
    rod(knee, V(0, head - 0.06, pz - 0.15), 0.028, [0.6, 0.6, 0.62]);
    T.add(new THREE.BoxGeometry(1.5, 0.05, 0.08), M4(0, head, pz - 0.15), [0.3, 0.3, 0.32]);
    for (const sx of [-1, 1]) rod(V(sx * 0.75, head, pz - 0.15), V(sx * 0.92, head - 0.16, pz - 0.15), 0.02, [0.3, 0.3, 0.32]);
    for (const sx of [-0.4, 0.4]) rod(V(sx, head - 0.03, pz - 0.15), V(0, head - 0.12, pz - 0.15), 0.012, [0.6, 0.6, 0.62]);
    // resistor box (grille), cable runs, a roof walk
    D.add(rbox(1.0, 0.32, 2.0, 0.04), M4(0, base + 0.16, -1.7), [0.22, 0.23, 0.25]);
    for (let k = 0; k < 9; k++) D.add(new THREE.BoxGeometry(1.02, 0.02, 0.04), M4(0, base + 0.33, -2.55 + k * 0.21), [0.1, 0.1, 0.11]);
    for (const sx of [-0.62, 0.62]) T.add(new THREE.CylinderGeometry(0.025, 0.025, 6.0, 6).rotateX(PI / 2), M4(sx, base + 0.03, 0), [0.15, 0.15, 0.16]);
  }
  // ---- bogies: frames, wheelsets on the rails (gauge 1 m), the rack pinion on the centre rack, springs, brakes
  for (const bz of [-2.9, 2.9]) {
    for (const sx of [-1, 1]) {
      D.add(rbox(0.08, 0.32, 2.7, 0.03), M4(sx * 0.78, 0.5, bz), [0.12, 0.12, 0.13]);
      for (const az of [-1, 1]) {
        D.add(new THREE.CylinderGeometry(0.38, 0.38, 0.09, 20).rotateZ(PI / 2), M4(sx * 0.5, 0.44, bz + az), [0.2, 0.2, 0.21]);
        D.add(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 20).rotateZ(PI / 2), M4(sx * 0.44, 0.44, bz + az), [0.14, 0.14, 0.15]);
        D.add(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 10).rotateZ(PI / 2), M4(sx * 0.58, 0.44, bz + az), [0.28, 0.28, 0.3]);
        D.add(rbox(0.22, 0.22, 0.26, 0.03), M4(sx * 0.8, 0.44, bz + az), [0.16, 0.16, 0.17]);   // axle box
        D.add(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 8), M4(sx * 0.8, 0.66, bz + az), [0.55, 0.45, 0.08]);   // coil spring
        D.add(rbox(0.1, 0.2, 0.12, 0.02), M4(sx * 0.5, 0.48, bz + az - Math.sign(az) * 0.44), [0.1, 0.1, 0.11]);   // brake block
      }
    }
    for (const az of [-1, 1]) D.add(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 8).rotateZ(PI / 2), M4(0, 0.44, bz + az), [0.26, 0.26, 0.28]);
    // the rack pinion (toothed) on its own axle, the motor + gearbox over it, the bolster
    D.add(new THREE.CylinderGeometry(0.29, 0.29, 0.12, 20).rotateZ(PI / 2), M4(0, 0.37, bz), [0.24, 0.24, 0.26]);
    for (let k = 0; k < 18; k++) { const a = k / 18 * PI * 2; D.add(new THREE.BoxGeometry(0.1, 0.06, 0.05), M4(0, 0.37 + Math.cos(a) * 0.3, bz + Math.sin(a) * 0.3, a, 0, 0), [0.3, 0.3, 0.32]); }
    D.add(rbox(0.7, 0.4, 0.8, 0.05), M4(0, 0.62, bz), [0.16, 0.17, 0.18]);
    D.add(new THREE.BoxGeometry(1.6, 0.12, 0.4), M4(0, 0.66, bz), [0.13, 0.13, 0.14]);
  }
  // ---- underframe: equipment cases, two air reservoirs, cable conduits between the bogies
  for (const [x, z, w, l] of [[-0.5, -0.9, 0.7, 1.1], [0.45, -0.6, 0.6, 0.9], [0.4, 0.7, 0.8, 1.2], [-0.55, 0.85, 0.5, 0.8]]) D.add(rbox(w, 0.34, l, 0.03), M4(x, 0.42, z), [0.15, 0.16, 0.17]);
  for (const sx of [-0.9, 0.9]) D.add(new THREE.CylinderGeometry(0.15, 0.15, 1.6, 12).rotateX(PI / 2), M4(sx, 0.42, 0.05), [0.25, 0.26, 0.28]);
  for (const sx of [-0.2, 0.2]) D.add(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 6).rotateX(PI / 2), M4(sx, 0.55, 0), [0.06, 0.06, 0.06]);

  const add = (b, m, sh = true) => { const mesh = b.mesh(m, { shadow: sh }); root.add(mesh); return mesh; };
  add(P, mats.cabin()); add(I, M.inside, false); add(D, mats.metal()); add(T, mats.paintIn(), false); add(L, mats.lamp(), false);
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return { root, lights, materials: [M.glass, M.inside, M.letter, M.number] };
}
