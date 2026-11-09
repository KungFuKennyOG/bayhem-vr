import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Bucket, M4, mats, rbox, snowCap } from './kit.js';

// =====================================================================================
//  The snow groomer (a PistenBully-class piste machine), built properly instead of boxes:
//   - two wide rubber belts (stadium profile) with aluminium cleats across them, big road wheels
//     with hubs showing on the inboard side, track guards;
//   - a chassis, the glasshouse cab (tinted glass leaning in, frames, the roof light bar, a beacon,
//     mirrors, a ladder), the engine deck behind it (grilles, an exhaust stack);
//   - the 12-way blade in front: a curved mouldboard with a steel cutting edge, side wings, on push
//     arms with lift rams;
//   - the tiller behind: a drum housing on its arm, the rubber finisher comb.
//  Local frame: ground at y 0, front = -z. `burnt` (0..1) chars the paint, blows out the glass and
//  soots everything (the wreck at the foot of the road); `paint` is the body colour.
// =====================================================================================
const PI = Math.PI;
export function buildGroomer({ paint = [0.66, 0.07, 0.05], burnt = 0, seed = 1, snow = 1 } = {}) {
  const rng = makeRng(seed);
  const root = new THREE.Group();
  const P = new Bucket(), D = new Bucket(), M = new Bucket(), G = new Bucket(), L = new Bucket(), S = new Bucket();
  const char = (c, k = 1) => { const b = burnt * k; const n = 0.6 + rng() * 0.4; return [c[0] * (1 - b) + 0.05 * b * n, c[1] * (1 - b) + 0.045 * b * n, c[2] * (1 - b) + 0.04 * b * n]; };
  const body = (q, n, l) => char(paint, 0.85 + 0.15 * Math.sin(l.x * 3 + l.z * 2));
  const rubber = [0.05, 0.05, 0.055], alu = char([0.62, 0.63, 0.65], 0.7), steel = char([0.3, 0.31, 0.33], 0.5), black = [0.04, 0.04, 0.045];

  // ---- tracks: stadium belts (side profile extruded across the width)
  const TL = 5.1, TH = 1.0, TW = 1.25, TX = 1.55;
  const stadium = new THREE.Shape();
  { const r = TH / 2, a = TL / 2 - r; stadium.moveTo(-a, -r); stadium.lineTo(a, -r); stadium.absarc(a, 0, r, -PI / 2, PI / 2, false); stadium.lineTo(-a, r); stadium.absarc(-a, 0, r, PI / 2, 1.5 * PI, false); }
  for (const sd of [-1, 1]) {
    const belt = new THREE.ExtrudeGeometry(stadium, { depth: TW, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
    belt.translate(0, 0, -TW / 2); belt.rotateY(PI / 2);   // profile now in (z, y), width along x
    D.add(belt, M4(sd * TX, TH / 2, 0), rubber);
    // cleats over the top run and down the ends (aluminium bars across the belt)
    for (let k = 0; k < 15; k++) M.add(new THREE.BoxGeometry(TW + 0.06, 0.05, 0.08), M4(sd * TX, TH + 0.045, -2.1 + k * 0.3), alu);
    for (const ez of [-1, 1]) for (let k = 1; k < 5; k++) { const t = (k / 5) * PI, r = TH / 2 + 0.045; M.add(new THREE.BoxGeometry(TW + 0.06, 0.05, 0.08), M4(sd * TX, TH / 2 + Math.cos(t) * r, ez * (TL / 2 - TH / 2 + Math.sin(t) * r), -ez * (PI / 2 - t), 0, 0), alu); }
    // road wheels: tyres + hubs showing inboard
    for (let k = 0; k < 4; k++) { const wz = -1.65 + k * 1.1; D.add(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16).rotateZ(PI / 2), M4(sd * (TX - TW / 2 - 0.05), 0.45, wz), black); M.add(new THREE.CylinderGeometry(0.18, 0.18, 0.34, 10).rotateZ(PI / 2), M4(sd * (TX - TW / 2 - 0.06), 0.45, wz), alu); }
    // track guard over the top run
    P.add(rbox(TW + 0.2, 0.08, 3.0, 0.03), M4(sd * TX, TH + 0.2, -0.6), body);
  }
  // ---- chassis + belly
  P.add(rbox(1.9, 0.75, 4.8, 0.12), M4(0, 0.95, 0), body);
  D.add(rbox(1.7, 0.3, 4.4, 0.06), M4(0, 0.5, 0), steel);
  // ---- the cab: a red lower panel, the glasshouse leaning in, the roof with its light bar
  const CY = 1.32, CZ = -0.85, cw = 2.05, cl = 1.95;
  P.add(rbox(cw, 0.55, cl, 0.08), M4(0, CY + 0.27, CZ), body);
  const gy0 = CY + 0.55, gy1 = CY + 1.75;
  // glass: four leaning panes (front leans most), as one tinted shell
  const glassQuad = (a, b, c, d) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3)); g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals(); return g; };
  const hw0 = cw / 2 - 0.02, hl0 = cl / 2 - 0.02, hw1 = hw0 - 0.12, lf1 = hl0 - 0.32, lb1 = hl0 - 0.06;
  const corners0 = [[-hw0, gy0, -hl0], [hw0, gy0, -hl0], [hw0, gy0, hl0], [-hw0, gy0, hl0]], corners1 = [[-hw1, gy1, -lf1], [hw1, gy1, -lf1], [hw1, gy1, lb1], [-hw1, gy1, lb1]];
  const off = (p) => [p[0], p[1], p[2] + CZ];
  if (burnt < 0.5) for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; G.add(glassQuad(off(corners0[i]), off(corners0[j]), off(corners1[i]), off(corners1[j]))); }
  // frames: the pillars and the rails
  const rod = (a, b, r, c, bk = D) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dd = B.clone().sub(A), L = dd.length(); bk.add(new THREE.CylinderGeometry(r, r, L, 6), new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dd.normalize()), new THREE.Vector3(1, 1, 1)), c); };
  for (let i = 0; i < 4; i++) { rod(off(corners0[i]), off(corners1[i]), 0.05, black); const j = (i + 1) % 4; rod(off(corners1[i]), off(corners1[j]), 0.04, black); rod(off(corners0[i]), off(corners0[j]), 0.04, black); }
  rod(off([hw0, gy0, 0.1]), off([hw1, gy1, 0.1]), 0.04, black); rod(off([-hw0, gy0, 0.1]), off([-hw1, gy1, 0.1]), 0.04, black);   // door frames
  // roof: a shell, the light bar, a beacon, the antenna
  P.add(rbox(cw - 0.12, 0.14, (lf1 + lb1) + 0.25, 0.06), M4(0, gy1 + 0.07, CZ + (lb1 - lf1) / 2), body);
  M.add(rbox(1.6, 0.12, 0.22, 0.04), M4(0, gy1 + 0.22, CZ - lf1 + 0.12), black);
  for (let k = 0; k < 5; k++) L.add(new THREE.BoxGeometry(0.22, 0.08, 0.04), M4(-0.6 + k * 0.3, gy1 + 0.22, CZ - lf1 + 0.0), burnt > 0.5 ? [0.05, 0.05, 0.05] : [1.8, 1.7, 1.4]);
  L.add(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 10), M4(0.6, gy1 + 0.25, CZ + 0.35), burnt > 0.5 ? [0.1, 0.05, 0.02] : [1.9, 0.8, 0.08]);
  rod([-0.7, gy1 + 0.15, CZ + 0.5], [-0.75, gy1 + 1.1, CZ + 0.55], 0.012, black);
  // mirrors, the ladder up the side
  for (const sd of [-1, 1]) { rod([sd * hw0, gy0 + 0.6, CZ - hl0], [sd * (hw0 + 0.4), gy0 + 0.7, CZ - hl0 - 0.1], 0.02, black); D.add(rbox(0.06, 0.28, 0.18, 0.02), M4(sd * (hw0 + 0.42), gy0 + 0.62, CZ - hl0 - 0.12), black); }
  for (let k = 0; k < 4; k++) M.add(new THREE.BoxGeometry(0.06, 0.04, 0.4), M4(hw0 + 0.12, 0.6 + k * 0.28, CZ + 0.4), alu);
  // ---- the engine deck behind the cab: sloped cover, grilles, the exhaust stack
  P.add(rbox(1.95, 0.75, 2.0, 0.12), M4(0, CY + 0.37, 1.25), body);
  P.add(rbox(1.7, 0.2, 1.4, 0.06), M4(0, CY + 0.82, 1.3, -0.08, 0, 0), body);
  for (let k = 0; k < 7; k++) D.add(new THREE.BoxGeometry(1.2, 0.025, 0.06), M4(0, CY + 0.94, 0.85 + k * 0.13), black);
  rod([0.75, CY + 0.7, 0.55], [0.75, CY + 1.9, 0.55], 0.07, steel); D.add(new THREE.CylinderGeometry(0.085, 0.07, 0.12, 10), M4(0.75, CY + 1.95, 0.55), black);
  // ---- the blade: a curved mouldboard (an arc swept across), a steel cutting edge, wings, push arms + rams
  {
    const bw = 4.3, arc = new THREE.Shape(); const R = 0.95, a0 = -0.15, a1 = 1.25;
    for (let k = 0; k <= 10; k++) { const t = a0 + (a1 - a0) * k / 10; const p = [Math.cos(t) * R, Math.sin(t) * R]; if (!k) arc.moveTo(p[0], p[1]); else arc.lineTo(p[0], p[1]); }
    for (let k = 10; k >= 0; k--) { const t = a0 + (a1 - a0) * k / 10; arc.lineTo(Math.cos(t) * (R + 0.08), Math.sin(t) * (R + 0.08)); }
    const g = new THREE.ExtrudeGeometry(arc, { depth: bw, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -bw / 2); g.rotateY(-PI / 2); g.rotateY(PI);   // curve faces forward (-z), extruded across x
    const blade = (q, n, l) => (q.y < 0.12 ? steel : char([0.78, 0.6, 0.06], 0.9));
    P.add(g, M4(0, 0.06, -3.05), blade);
    for (const sd of [-1, 1]) P.add(rbox(0.08, 1.05, 0.7, 0.02), M4(sd * (bw / 2 + 0.02), 0.62, -3.35, 0, sd * 0.35, 0), (q, n, l) => char([0.78, 0.6, 0.06], 0.9));
    D.add(new THREE.BoxGeometry(bw + 0.1, 0.1, 0.16), M4(0, 0.05, -3.55), steel);
    for (const sd of [-1, 1]) { M.add(rbox(0.16, 0.18, 1.3, 0.03), M4(sd * 0.75, 0.7, -2.55, 0.15, 0, 0), steel); rod([sd * 0.4, 1.35, -2.35], [sd * 0.45, 0.95, -3.0], 0.065, alu, M); }
  }
  // ---- the tiller: its arm, the drum housing, the rubber finisher comb
  M.add(rbox(0.4, 0.25, 1.2, 0.04), M4(0, 1.0, 2.75, -0.2, 0, 0), steel);
  P.add(new THREE.CylinderGeometry(0.42, 0.42, 4.2, 14, 1, false, 0, PI * 1.2).rotateZ(PI / 2), M4(0, 0.48, 3.45, 0, 0, 0), body);
  D.add(new THREE.BoxGeometry(4.3, 0.06, 0.7), M4(0, 0.12, 3.95, 0.35, 0, 0), rubber);
  // ---- snow on the flat tops
  if (snow) { S.add(snowCap(cw - 0.3, (lf1 + lb1), 0.1, seed, 3, 3), M4(0, gy1 + 0.15, CZ + (lb1 - lf1) / 2), [0.95, 0.97, 1]); S.add(snowCap(1.6, 1.2, 0.1, seed + 2, 3, 3), M4(0, CY + 0.95, 1.4), [0.95, 0.97, 1]); }
  // build
  const add = (b, m, sh = true) => { if (b.vn) { const mesh = b.mesh(m, { shadow: sh }); root.add(mesh); } };
  add(P, mats.paint()); add(D, mats.paintIn()); add(M, mats.metal()); add(G, mats.glass(), false); add(L, mats.lamp(), false); add(S, mats.snow(), false);
  return { root, cab: new THREE.Vector3(0, gy0 + 0.4, CZ), size: [4.4, 3.4, 7.8] };
}
