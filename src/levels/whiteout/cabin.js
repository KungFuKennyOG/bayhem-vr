import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { CABIN, HANG } from './layout.js';
import { Bucket, M4, mats, rbox, snowCap } from './kit.js';
import { makeCanvas, canvasTex } from '../../textures.js';

// =====================================================================================
//  The aerial-tram cabin (Swiss red, "1" and "2"): rounded body, a band of big windows, roof dome,
//  the hanger arm up to the carriage that rides the track rope (wheels, the haul-rope clamp).
//  Local frame: floor at y 0, front = -z (uphill), door on +x. Returns the root, the hanger (it
//  can shear off), the window panes (they break), anchors (the stand point, gunmen spots, the
//  carriage), local colliders.
// =====================================================================================
const PI = Math.PI;
// riveted interior panels + a ribbed rubber floor mat (canvas textures, shared by both cabins)
let _im = null;
function interiorMats() {
  if (_im) return _im;
  const pc = makeCanvas(256, 256), px = pc.getContext('2d');
  px.fillStyle = '#9a9c9e'; px.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { px.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.04)`; px.fillRect((i * 97) % 256, (i * 57) % 256, 3 + (i % 5), 2); }
  px.strokeStyle = 'rgba(30,32,36,0.8)'; px.lineWidth = 2;
  for (const t of [0, 128]) { px.beginPath(); px.moveTo(t, 0); px.lineTo(t, 256); px.stroke(); px.beginPath(); px.moveTo(0, t); px.lineTo(256, t); px.stroke(); }
  px.fillStyle = 'rgba(40,42,46,0.85)';
  for (const t of [0, 128]) for (let k = 8; k < 256; k += 16) { px.beginPath(); px.arc(t + 6, k, 2.2, 0, 6.3); px.fill(); px.beginPath(); px.arc(k, t + 6, 2.2, 0, 6.3); px.fill(); }
  const grime = px.createLinearGradient(0, 0, 0, 256); grime.addColorStop(0, 'rgba(0,0,0,0)'); grime.addColorStop(1, 'rgba(40,30,20,0.25)'); px.fillStyle = grime; px.fillRect(0, 0, 256, 256);
  const fc = makeCanvas(128, 128), fx = fc.getContext('2d');
  fx.fillStyle = '#26272a'; fx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) { fx.fillStyle = '#3a3c40'; fx.fillRect(0, y, 128, 3); fx.fillStyle = '#18191b'; fx.fillRect(0, y + 3, 128, 1); }
  const lt = canvasTex(pc), ft = canvasTex(fc);
  _im = { lining: new THREE.MeshStandardMaterial({ map: lt, roughness: 0.6, metalness: 0.3, vertexColors: true }), floor: new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9, vertexColors: true }) };
  return _im;
}
export function buildCabin({ num = 1, seed = 1, paint = 0x9c1712 } = {}) {
  const rng = makeRng(seed);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const hanger = new THREE.Group(); root.add(hanger);
  const { w, l, h } = CABIN;
  const c = new THREE.Color(paint), red = [c.r, c.g, c.b], dark = [0.06, 0.06, 0.065], steel = [0.5, 0.52, 0.55];
  const P = new Bucket(), M = new Bucket(), L = new Bucket(), I = new Bucket(), H = new Bucket(), S = new Bucket(), TL = new Bucket(), TF = new Bucket();
  // ---- the body: a lofted rounded-rectangle shell (rounded corners in plan, a tucked-under belly, the glass band
  //      leaning in toward the roof), livery: red lower body, a cream belt line, a silver roof
  const lowH = 1.05, glassTop = 2.2;
  const R0 = 0.62;
  // perimeter of a rounded rectangle inset by `ins` (points CCW from the front-right corner), with the arc-length param
  const perim = (ins) => {
    const A = w / 2 - ins, B = l / 2 - ins, r = Math.max(0.06, R0 - ins), pts = [];
    // a closed loop of four corner arcs (7 points each): front-right, front-left, back-left, back-right
    const C = [[A - r, -(B - r), 0, -PI / 2], [-(A - r), -(B - r), -PI / 2, -PI], [-(A - r), B - r, PI, PI / 2], [A - r, B - r, PI / 2, 0]];
    for (const [cx, cz, t0, t1] of C) for (let k = 0; k <= 6; k++) { const t = t0 + (t1 - t0) * k / 6; pts.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]); }
    return pts;
  };
  // loft rings: [y, inset, colour]
  const loft = (bucket, rings, mat) => {
    const n = perim(0).length, pos = [], col = [], idx = [];
    for (const [y, ins, c] of rings) for (const [x, z] of perim(ins)) { pos.push(x, y, z); col.push(c[0], c[1], c[2]); }
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < n; i++) { const i2 = (i + 1) % n, a0 = j * n + i, a1 = j * n + i2, b0 = a0 + n, b1 = a1 + n; idx.push(a0, b0, a1, a1, b0, b1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    // orientation: make the faces point outward (flip if the first face normal points in)
    const P0 = new THREE.Vector3(pos[0], pos[1], pos[2]), N = g.attributes.normal; if (N.getX(0) * P0.x + N.getZ(0) * P0.z < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
    bucket.add(g, null, (q, nn, lp) => { let best = 0, bd = 1e9; for (let k = 0; k < rings.length; k++) { const d = Math.abs(lp.y - rings[k][0]); if (d < bd) { bd = d; best = k; } } return rings[best][2]; });
  };
  const cream = [0.9, 0.86, 0.76], silver = [0.72, 0.74, 0.76], rubber = [0.05, 0.05, 0.055], redD = [red[0] * 0.75, red[1] * 0.75, red[2] * 0.75];
  // the lower body: a rubber bump strip at the floor, the belly tucked under, red flanks, the cream belt line under the glass
  loft(P, [[-0.32, 0.42, redD], [-0.2, 0.2, redD], [-0.06, 0.07, rubber], [0.06, 0.03, rubber], [0.12, 0.04, red], [0.78, 0.0, red], [0.84, 0.0, cream], [0.96, 0.0, cream], [lowH - 0.02, 0.0, silver], [lowH, 0.03, silver]]);
  // the floor pan under the belly
  { const pts = perim(0.42); const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))); const g = new THREE.ShapeGeometry(sh, 2); g.rotateX(PI / 2); g.translate(0, -0.32, 0); P.add(g, null, redD); }
  // the roof: a silver crown leaning in from the glass, then a low dome, an equipment box, vents
  loft(P, [[glassTop - 0.02, 0.1, silver], [glassTop + 0.12, 0.08, red], [glassTop + 0.3, 0.12, red], [glassTop + 0.36, 0.26, silver], [glassTop + 0.4, 0.5, silver], [glassTop + 0.42, 0.9, silver]]);
  { const pts = perim(0.9); const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))); const g = new THREE.ShapeGeometry(sh, 2); g.rotateX(-PI / 2); g.translate(0, glassTop + 0.42, 0); P.add(g, null, silver); }
  P.add(rbox(1.3, 0.34, 1.7, 0.08), M4(0, glassTop + 0.58, 0.35), [0.62, 0.64, 0.66]);
  for (let k = 0; k < 5; k++) P.add(new THREE.BoxGeometry(1.0, 0.03, 0.06), M4(0, glassTop + 0.76, -0.2 + k * 0.22), [0.2, 0.2, 0.21]);
  S.add(snowCap(w * 0.62, l * 0.62, 0.12, seed, 4, 4), M4(0, glassTop + 0.44, 0), [0.95, 0.97, 1]);
  const h2 = glassTop + 0.42;
  // mullions: the corner posts follow the lean of the glass band; centre posts on the long sides
  const rod = (a, b, r, c, bucket = P) => { const d = b.clone().sub(a), L = d.length(); const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)); bucket.add(new THREE.CylinderGeometry(r, r, L, 8), m, c); };
  const p0 = perim(0.0), p1 = perim(0.1), np = p0.length;
  const postAt = (i) => rod(new THREE.Vector3(p0[i][0] * 0.985, lowH, p0[i][1] * 0.985), new THREE.Vector3(p1[i][0] * 0.985, glassTop, p1[i][1] * 0.985), 0.045, [0.16, 0.16, 0.17]);
  for (let c = 0; c < 4; c++) { postAt(c * 7); postAt(c * 7 + 6); }
  rod(new THREE.Vector3(-w / 2 + 0.02, lowH, 0), new THREE.Vector3(-w / 2 + 0.12, glassTop, 0), 0.045, [0.16, 0.16, 0.17]);
  rod(new THREE.Vector3(w / 2 - 0.02, lowH, 0.35), new THREE.Vector3(w / 2 - 0.12, glassTop, 0.35), 0.045, [0.16, 0.16, 0.17]);
  // lights: headlights + a red light at each end, a beacon on the roof
  for (const sx of [-0.7, 0.7]) { L.add(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10).rotateX(PI / 2), M4(sx, 0.5, -l / 2 - 0.0), [1.8, 1.7, 1.4]); L.add(new THREE.BoxGeometry(0.16, 0.06, 0.04), M4(sx, 0.5, l / 2), [1.6, 0.15, 0.08]); }
  L.add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), M4(0.45, glassTop + 0.8, -0.3), [1.8, 0.7, 0.08]);
  // livery: the line name on both flanks, the number on the flanks and the nose
  const nc = makeCanvas(128, 128), nx = nc.getContext('2d'); nx.fillStyle = 'rgba(0,0,0,0)'; nx.fillRect(0, 0, 128, 128); nx.fillStyle = '#efe8d8'; nx.font = '700 110px Anton, Impact, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillText(String(num), 64, 70);
  const numMat = new THREE.MeshBasicMaterial({ map: canvasTex(nc, { repeat: false }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const sd of [-1, 1]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), numMat); q.position.set(sd * (w / 2 + 0.012), 0.48, -l * 0.3); q.rotation.y = sd * PI / 2; body.add(q); }
  { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), numMat); q.position.set(0, 0.62, -l / 2 - 0.012); q.rotation.y = PI; body.add(q); }
  const lc = makeCanvas(512, 64), lx = lc.getContext('2d'); lx.fillStyle = 'rgba(0,0,0,0)'; lx.fillRect(0, 0, 512, 64); lx.fillStyle = '#f2ece0'; lx.font = '700 46px Anton, Impact, sans-serif'; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText('GRAUHORN-BAHN', 256, 34);
  const logoMat = new THREE.MeshBasicMaterial({ map: canvasTex(lc, { repeat: false }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const sd of [-1, 1]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), logoMat); q.position.set(sd * (w / 2 + 0.012), 0.48, l * 0.12); q.rotation.y = sd * PI / 2; body.add(q); }
  // interior: floor, handrail, the attendant's console at the front
  TF.add(new THREE.BoxGeometry(w - 0.2, 0.06, l - 0.2), M4(0, 0.03, 0), [0.5, 0.5, 0.52], { uvScale: 1.0 });   // ribbed rubber floor
  for (const [x, z, ww, ll] of [[-w / 2 + 0.2, 0, 0.05, l - 0.5], [w / 2 - 0.2, -0.6, 0.05, l * 0.5], [0, l / 2 - 0.2, w - 0.5, 0.05]]) I.add(new THREE.BoxGeometry(ww, 0.05, ll), M4(x, 1.0, z), steel);
  I.add(rbox(1.0, 0.95, 0.4, 0.03), M4(-0.6, 0.48, -l / 2 + 0.35), [0.25, 0.27, 0.3]);
  for (let i = 0; i < 6; i++) L.add(new THREE.BoxGeometry(0.06, 0.02, 0.06), M4(-0.95 + i * 0.12, 0.96, -l / 2 + 0.3), i % 2 ? [0.2, 1.4, 0.3] : [1.6, 0.4, 0.1]);
  // interior lining: grey wall panels below the windows, a pale ceiling with a vent strip (the red stays outside)
  const lin = [0.42, 0.43, 0.44], ceil = [0.62, 0.62, 0.6];
  for (const sx of [-1, 1]) TL.add(new THREE.BoxGeometry(0.03, lowH - 0.12, l - 0.3), M4(sx * (w / 2 - 0.115), (lowH - 0.12) / 2 + 0.06, 0), [0.62, 0.63, 0.64], { uvScale: 1.0 });
  for (const sz of [-1, 1]) TL.add(new THREE.BoxGeometry(w - 0.3, lowH - 0.12, 0.03), M4(0, (lowH - 0.12) / 2 + 0.06, sz * (l / 2 - 0.115)), [0.62, 0.63, 0.64], { uvScale: 1.0 });
  TL.add(new THREE.BoxGeometry(w - 0.12, 0.03, l - 0.12), M4(0, h - 0.3, 0), [0.85, 0.85, 0.83], { uvScale: 1.0 });
  I.add(new THREE.BoxGeometry(0.5, 0.02, l * 0.7), M4(0.75, h - 0.325, 0), [0.3, 0.3, 0.3]);
  // a fold-down bench along the back wall, rubber window seals (dark frames round every pane)
  I.add(rbox(w - 0.5, 0.08, 0.45, 0.02), M4(0, 0.48, l / 2 - 0.4), [0.3, 0.2, 0.14]);
  for (const sx of [-0.8, 0.8]) I.add(new THREE.BoxGeometry(0.05, 0.45, 0.4), M4(sx, 0.23, l / 2 - 0.4), steel);
  const seal = [0.07, 0.07, 0.075], wy0 = lowH, wy1 = h - 0.3;
  for (const sz of [-1, 1]) { I.add(new THREE.BoxGeometry(w - 0.2, 0.06, 0.08), M4(0, wy0 + 0.03, sz * (l / 2 - 0.02)), seal); I.add(new THREE.BoxGeometry(w - 0.2, 0.06, 0.08), M4(0, wy1 - 0.03, sz * (l / 2 - 0.02)), seal); }
  for (const sx of [-1, 1]) { I.add(new THREE.BoxGeometry(0.08, 0.06, l - 0.2), M4(sx * (w / 2 - 0.02), wy0 + 0.03, 0), seal); I.add(new THREE.BoxGeometry(0.08, 0.06, l - 0.2), M4(sx * (w / 2 - 0.02), wy1 - 0.03, 0), seal); }
  // grab poles
  for (const [x, z] of [[-1.05, 1.5], [-1.05, -1.45]]) I.add(new THREE.CylinderGeometry(0.025, 0.025, h - 0.4, 8), M4(x, (h - 0.4) / 2, z), steel);
  // ceiling light
  L.add(new THREE.BoxGeometry(1.2, 0.04, 0.2), M4(0, h - 0.34, 0), [1.4, 1.25, 1.0]);
  // the hanger arm: two curved tubes from the roof to the carriage + the carriage (wheels on the rope)
  const top = HANG;
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, glassTop + 0.75, s * 0.75), new THREE.Vector3(0.95, glassTop + 1.9, s * 0.6), new THREE.Vector3(0.75, top - 1.6, s * 0.45), new THREE.Vector3(0, top - 0.6, s * 0.4)]);
    H.add(new THREE.TubeGeometry(curve, 10, 0.1, 6), null, steel);
  }
  // the carriage: a spine beam, two bogies with paired track wheels between side plates, the haul-rope grip
  H.add(rbox(0.3, 0.32, 3.6, 0.05), M4(0, top - 0.42, 0), [0.32, 0.33, 0.35]);
  for (const bz of [-1.2, 1.2]) {
    for (const sd of [-1, 1]) H.add(rbox(0.05, 0.62, 1.5, 0.03), M4(sd * 0.17, top - 0.02, bz), [0.42, 0.44, 0.47]);
    for (const wz of [-0.42, 0.42]) { H.add(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 16).rotateZ(PI / 2), M4(0, top + 0.06, bz + wz), dark); H.add(new THREE.CylinderGeometry(0.08, 0.08, 0.38, 8).rotateZ(PI / 2), M4(0, top + 0.06, bz + wz), [0.6, 0.6, 0.62]); }
    H.add(rbox(0.36, 0.16, 0.5, 0.03), M4(0, top - 0.32, bz), [0.25, 0.26, 0.28]);
  }
  H.add(rbox(0.32, 0.55, 0.45, 0.04), M4(0, top + 0.42, 0), [0.75, 0.55, 0.08]);   // the haul-rope grip (yellow)
  H.add(new THREE.BoxGeometry(0.06, 0.4, 0.06), M4(0, top + 0.78, 0), [0.2, 0.2, 0.2]);
  const mk = (b, m, parent, sh = true) => { const mesh = b.mesh(m, { shadow: sh }); parent.add(mesh); return mesh; };
  mk(P, mats.cabin(), body); mk(I, mats.paintIn(), body, false); mk(TL, interiorMats().lining, body, false); mk(TF, interiorMats().floor, body, false); mk(L, mats.lamp(), body, false); mk(S, mats.snow(), body, false);
  mk(H, mats.metal(), hanger);
  // windows: the wraparound glass band, leaning in toward the roof, split into six panes (they break): front, back,
  // and two per side; tinted, a little reflective outside, clear enough inside
  const glassM = new THREE.MeshStandardMaterial({ color: 0x46566a, roughness: 0.06, metalness: 0.7, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  const panes = [];
  {
    const g0 = perim(0.0), g1 = perim(0.1), n = g0.length, by = [[], [], [], [], [], []];
    const which = (x, z) => (z < -(l / 2 - 0.45) ? 0 : z > l / 2 - 0.45 ? 1 : (x < 0 ? (z < 0 ? 2 : 3) : (z < 0 ? 4 : 5)));
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n, mx = (g0[i][0] + g0[i2][0]) / 2, mz = (g0[i][1] + g0[i2][1]) / 2;
      by[which(mx, mz)].push([g0[i], g0[i2], g1[i], g1[i2]]);
    }
    by.forEach((quads, k) => {
      const pos = [], idx = [];
      quads.forEach(([a0, a1, b0, b1], q) => { const o = q * 4; pos.push(a0[0], lowH, a0[1], a1[0], lowH, a1[1], b0[0], glassTop, b0[1], b1[0], glassTop, b1[1]); idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, glassM); m.renderOrder = 6; body.add(m);
      const nrm = [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 0)][k];
      panes.push({ mesh: m, broken: false, n: nrm });
    });
  }
  // the door (sliding, +x side, rear half): a red lower panel, a framed glass upper, a grab handle; slides back when open
  const door = new THREE.Group();
  { const D = new Bucket(); D.add(rbox(0.07, lowH - 0.05, 1.2, 0.02), M4(0, lowH / 2 + 0.03, 0), red); D.add(rbox(0.05, 0.84, 0.86, 0.01), M4(0, 1.62, 0), [0.1, 0.13, 0.16]); for (const [yy, hh, zz, ll] of [[lowH, 0.08, 0, 1.2], [glassTop - 0.05, 0.08, 0, 1.2], [1.62, 1.1, -0.56, 0.08], [1.62, 1.1, 0.56, 0.08]]) D.add(new THREE.BoxGeometry(0.09, hh, ll), M4(0, yy, zz), [0.16, 0.16, 0.17]); D.add(new THREE.BoxGeometry(0.06, 0.32, 0.04), M4(0.06, 0.95, -0.45), [0.7, 0.7, 0.72]); door.add(D.mesh(mats.cabin(), { shadow: true })); }
  door.position.set(w / 2 + 0.05, 0, 1.05); body.add(door);
  root.traverse(o => { if (o.isMesh && o.material === glassM) o.castShadow = false; });
  return {
    root, body, hanger, panes, door, glassM,
    anchors: {
      stand: new THREE.Vector3(0.35, 0, 0.55),              // where the player stands (rig position)
      spots: [new THREE.Vector3(-0.7, 0, -1.2), new THREE.Vector3(0.7, 0, -1.0), new THREE.Vector3(-0.6, 0, 1.1), new THREE.Vector3(0.7, 0, 1.3)],
      carriage: new THREE.Vector3(0, top, 0),
      center: new THREE.Vector3(0, h * 0.5, 0),
    },
    // local wall colliders (when docked): back / front / west sides; the east door side stays open
    colliders: [
      { min: [-w / 2, 0, -l / 2], max: [w / 2, h, -l / 2 + 0.12] },
      { min: [-w / 2, 0, l / 2 - 0.12], max: [w / 2, h, l / 2] },
      { min: [-w / 2, 0, -l / 2], max: [-w / 2 + 0.12, h, l / 2] },
      { min: [w / 2 - 0.12, 0, -l / 2], max: [w / 2, h, 0.35] },
    ],
    setDoor(open) { door.position.z = open ? 1.05 + 1.15 : 1.05; },
    breakPane(i) { const p = panes[i]; if (!p || p.broken) return false; p.broken = true; p.mesh.visible = false; return true; },
  };
}
