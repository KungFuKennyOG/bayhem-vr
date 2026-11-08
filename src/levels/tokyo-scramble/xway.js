import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { Acc, rmMat, hex } from './kit.js';
import { JP } from './signs.js';
import { asphaltTex } from './street.js';
import { XWAY, XWAY_IN, SPAN, GORE, OFFRAMP, LANE, CROSS_ST, CURB, groundAt, XWAY_BLOCK, ESTAIR, offrampY } from './layout.js';

// =====================================================================================
//  The elevated expressway (Shuto-style): a concrete box-girder deck at y 12 on T piers every 32 m,
//  1.05 m parapets with a rail, orange sodium masts, a green gantry sign, the off-ramp peeling off
//  the south side down into Center-gai, the gore + link from the car park. The span between the
//  piers at x -14 and 18 is its own group (pivot on its west pier) so the tanker can drop it; the
//  east pier of that span is its own mesh so it can be blown away.
// =====================================================================================
const Y = XWAY.y, TH = 1.7; // deck top, girder depth
export function buildXway(ctx = {}) {
  const rng = makeRng(1010);
  const root = new THREE.Group(); root.name = 'xway';
  const colliders = [], glows = [], lights = [];
  const mkSet = () => ({ con: new Acc({ rm: true }), road: new Acc(), paint: new Acc() });
  const main = mkSet(), span = mkSet(), pierS = new Acc({ rm: true });
  const RS = 8;
  // ---- one stretch of deck between xa and xb (into set S, in local coords relative to `ox`)
  const deckStretch = (S, xa, xb, ox = 0, oy = 0, gaps = null) => {
    const z0 = XWAY.z0, z1 = XWAY.z1, a = xa - ox, b = xb - ox;
    S.road.quad([a, Y - oy, z1], [b, Y - oy, z1], [b, Y - oy, z0], [a, Y - oy, z0], [xa / RS, -z1 / RS, xb / RS, -z0 / RS]);
    S.con.set({ col: hex(0x8a8780), rm: [0.85, 0, 0] });
    // girder: the slab and a narrower box under it, dark underside
    S.con.box(a, Y - 0.45 - oy, z0, b, Y - oy, z1, { faces: 'zZy', uvScale: 2.1 });
    S.con.set({ col: hex(0x6e6b65), rm: [0.9, 0, 0] });
    S.con.box(a, Y - TH - oy, z0 + 3.5, b, Y - 0.45 - oy, z1 - 3.5, { faces: 'zZy', uvScale: 2.1 });
    // parapets + rail
    S.con.set({ col: hex(0x7c7972), rm: [0.85, 0, 0] });
    S.con.box(a, Y - oy, z0, b, Y + XWAY.barrier - oy, XWAY_IN.z0, { faces: 'zZYxX', bottomDark: 0.35, uvScale: 2.1 });
    { let c = a; for (const [g0, g1] of [...(gaps || [])].sort((p, q) => p[0] - q[0])) { S.con.box(c, Y - oy, XWAY_IN.z1, g0 - ox, Y + XWAY.barrier - oy, z1, { faces: 'zZYxX', bottomDark: 0.35, uvScale: 2.1 }); c = g1 - ox; } S.con.box(c, Y - oy, XWAY_IN.z1, b, Y + XWAY.barrier - oy, z1, { faces: 'zZYxX', bottomDark: 0.35, uvScale: 2.1 }); }
    S.con.set({ col: hex(0x58595c), rm: [0.4, 0.7, 0] });
    S.con.tube([a, Y + XWAY.barrier + 0.25 - oy, XWAY_IN.z0 - 0.3], [b, Y + XWAY.barrier + 0.25 - oy, XWAY_IN.z0 - 0.3], 0.05, 5);
    // median: a low concrete divider with orange reflectors
    S.con.set({ col: hex(0x6e6b65), rm: [0.8, 0, 0] });
    S.con.box(a, Y - oy, -150.35, b, Y + 0.8 - oy, -149.65, { faces: 'zZYxX', bottomDark: 0.5 });
    // lane paint (white dashes, edge lines)
    const pq = (x0, z0, x1, z1) => S.paint.quad([x0 - ox, Y + 0.012 - oy, z1], [x1 - ox, Y + 0.012 - oy, z1], [x1 - ox, Y + 0.012 - oy, z0], [x0 - ox, Y + 0.012 - oy, z0]);
    for (let x = Math.ceil(xa / 12) * 12; x < xb - 6; x += 12) for (const z of [-154.7, -145.3]) pq(x, z - 0.075, x + 6, z + 0.075);
    for (const z of [-158.6, -150.9, -149.1, -141.4]) pq(xa, z - 0.08, xb, z + 0.08);
  };
  // the main deck, split around the collapse span
  deckStretch(main, XWAY.x0, SPAN.x0);
  deckStretch(main, SPAN.x1, XWAY.x1, 0, 0, [[OFFRAMP.x1 - 2, GORE.x1], [ESTAIR.top.x0, ESTAIR.top.x1]]);
  // the span (local: x relative to its hinge at SPAN.x0, y relative to the deck top)
  deckStretch(span, SPAN.x0, SPAN.x1, SPAN.x0, Y);
  // ---- piers: T columns every 32 m (the span's east pier is separate)
  const pier = (A, x) => {
    A.set({ col: hex(0x8a877f), rm: [0.9, 0, 0] });
    A.box(x - 1.2, 0, -151.2, x + 1.2, Y - TH, -148.8);
    A.set({ col: hex(0x7e7b74), rm: [0.9, 0, 0] });
    A.box(x - 1.3, Y - TH - 1.6, XWAY.z0 + 1, x + 1.3, Y - TH, XWAY.z1 - 1);
    // grime: a dark band at the foot, a drain pipe
    A.set({ col: hex(0x4a4842), rm: [0.95, 0, 0] }); A.box(x - 1.22, 0, -151.22, x + 1.22, 1.2, -148.78, { faces: 'xXzZ' });
    A.set({ col: hex(0x3a3c40), rm: [0.5, 0.6, 0] }); A.tube([x + 1.25, 0.2, -148.7], [x + 1.25, Y - TH, -148.7], 0.09, 6);
  };
  for (const x of SPAN.piers) if (x !== SPAN.x1) pier(main.con, x);
  pier(pierS, SPAN.x1);
  for (const x of SPAN.piers) colliders.push({ min: [x - 1.2, 0, -151.2], max: [x + 1.2, Y - TH, -148.8], data: { mat: 'concrete', kind: 'pier', ref: x === SPAN.x1 ? 'spanPier' : null } });
  // the deck as a bullet blocker (walking on it is the layout's ground function)
  for (const [a, b] of [[XWAY.x0, SPAN.x0], [SPAN.x1, XWAY.x1]]) colliders.push({ min: [a, Y - TH, XWAY.z0], max: [b, Y - 0.02, XWAY.z1], data: { mat: 'concrete', kind: 'xdeck', noBlock: true } });
  const spanBox = { min: [SPAN.x0, Y - TH, XWAY.z0], max: [SPAN.x1, Y - 0.02, XWAY.z1], data: { mat: 'concrete', kind: 'xdeck', noBlock: true } };
  colliders.push(spanBox);
  // ---- the gore + link bridge to the car park, and the off-ramp
  const C = main.con;
  main.road.quad([GORE.x0, Y, GORE.z1], [GORE.x1, Y, GORE.z1], [GORE.x1, Y, GORE.z0], [GORE.x0, Y, GORE.z0], [GORE.x0 / RS, -GORE.z1 / RS, GORE.x1 / RS, -GORE.z0 / RS]);
  C.set({ col: hex(0x8a8780), rm: [0.85, 0, 0] }); C.box(GORE.x0, Y - 1.2, GORE.z0, GORE.x1, Y, GORE.z1, { faces: 'xXzZy' });
  C.set({ col: hex(0x9c9990), rm: [0.85, 0, 0] });
  C.box(GORE.x1 - 0.4, Y, GORE.z0, GORE.x1, Y + 1.1, GORE.z1);
  C.box(GORE.x0, Y, GORE.z0 + 9, GORE.x0 + 0.4, Y + 1.1, GORE.z1);
  // the off-ramp: a sloping deck on round columns, parapets both sides
  const ox0 = OFFRAMP.x0, ox1 = OFFRAMP.x1, oz0 = OFFRAMP.z0, oz1 = OFFRAMP.z1;
  const oy = (x) => groundAt(x, (oz0 + oz1) / 2);
  main.road.quad([ox0, oy(ox0 + 0.01), oz1], [ox1, Y, oz1], [ox1, Y, oz0], [ox0, oy(ox0 + 0.01), oz0], [ox0 / RS, -oz1 / RS, ox1 / RS, -oz0 / RS]);
  main.road.quad([LANE.x0, CURB, LANE.z1], [LANE.x1, CURB, LANE.z1], [LANE.x1, CURB, LANE.z0], [LANE.x0, CURB, LANE.z0], [LANE.x0 / RS, -LANE.z1 / RS, LANE.x1 / RS, -LANE.z0 / RS]);
  for (let x = ox0; x < ox1; x += 4) {
    const ya = oy(x + 0.01), yb = oy(Math.min(ox1 - 0.01, x + 4));
    C.set({ col: hex(0x5e5c57), rm: [0.9, 0, 0] });
    // slab underside (a sloped box approximated per 4 m)
    C.box(x, Math.max(0, Math.min(ya, yb) - 1.1), oz0, x + 4, Math.max(0.05, Math.min(ya, yb) - 0.02), oz1, { faces: 'yzZ' });
    C.set({ col: hex(0x6a6862), rm: [0.85, 0, 0] });
    for (const [z0, z1] of [[oz0 - 0.4, oz0], [oz1, oz1 + 0.4]]) C.box(x, Math.max(0, Math.min(ya, yb) - 1.1), z0, x + 4, Math.max(ya, yb) + 1.05, z1, { faces: 'zZYxX', bottomDark: 0.6 });
    C.set({ col: hex(0x3e4044), rm: [0.45, 0.7, 0] });
    for (const z of [oz0 - 0.2, oz1 + 0.2]) C.tube([x, ya + 1.3, z], [x + 4, yb + 1.3, z], 0.04, 5);
    if (ya > 3 && Math.round(x) % 16 === 2) { C.set({ col: hex(0x8a877f), rm: [0.9, 0, 0] }); C.cyl(x + 2, 0, (oz0 + oz1) / 2, 0.75, 0.75, ya - 1.1, 12, { cap: false }); colliders.push({ min: [x + 1.3, 0, -135.7], max: [x + 2.7, ya - 1.1, -134.3], data: { mat: 'concrete', kind: 'pier' } }); }
    // bullet blocker under the ramp slab
    if (ya > 1.5) colliders.push({ min: [x, Math.max(0, ya - 1.1), oz0], max: [x + 4, ya - 0.05, oz1], data: { mat: 'concrete', kind: 'xdeck', noBlock: true } });
  }
  // ramp edge lines
  const ramp = (x0, z0, x1, z1) => { main.paint.quad([x0, oy(x0 + 0.01) + 0.015, z1], [x1, oy(x1 - 0.01) + 0.015, z1], [x1, oy(x1 - 0.01) + 0.015, z0], [x0, oy(x0 + 0.01) + 0.015, z0]); };
  for (let x = ox0; x < ox1; x += 4) { ramp(x, oz0 + 0.5, x + 4, oz0 + 0.65); ramp(x, oz1 - 0.65, x + 4, oz1 - 0.5); }
  // ---- the emergency stair: grey-green painted steel, a landing through the parapet, open grating treads,
  // channel stringers, handrails, posts down onto the off-ramp, the green running-man sign
  const walks = [];
  {
    const E = ESTAIR, T = E.top, yb = offrampY(E.x0), A = new Acc({ rm: true });
    const yAt = (x) => yb + (Y - yb) * (x - E.x0) / (E.x1 - E.x0);
    walks.push({ type: 'box', x0: T.x0, x1: T.x1, z0: T.z0, z1: T.z1, y: Y });
    walks.push({ type: 'ramp', x0: E.x0, x1: E.x1, y0: yb, y1: Y, z0: E.z0, z1: E.z1 });
    const steel = hex(0x55665e), dark = hex(0x34403a);
    // landing: a grating deck on a steel frame, a toe board and rail round its open sides
    A.set({ col: steel, rm: [0.5, 0.6, 0] }); A.box(T.x0, Y - 0.25, T.z0, T.x1, Y - 0.01, T.z1, { faces: 'xXzZy' });
    A.set({ col: hex(0x6a756e), rm: [0.6, 0.5, 0] }); A.box(T.x0, Y - 0.01, T.z0, T.x1, Y, T.z1, { faces: 'Y' });
    A.set({ col: steel, rm: [0.5, 0.6, 0] });
    for (const [x0, z0, x1, z1] of [[T.x1 - 0.06, T.z0, T.x1, T.z1], [T.x0, T.z1 - 0.06, T.x1, T.z1]]) { A.box(x0, Y, z0, x1, Y + 0.12, z1); A.box(x0, Y + 1.04, z0, x1, Y + 1.1, z1); A.box(x0, Y + 0.55, z0, x1, Y + 0.6, z1); }
    for (const [px, pz] of [[T.x0, T.z1], [T.x1, T.z1], [T.x1, T.z0 + 0.5], [T.x1, (T.z0 + T.z1) / 2]]) A.box(px - 0.05, Math.max(0, offrampY(px) - 0.1), pz - 0.05, px + 0.05, Y + 1.1, pz + 0.05);
    // treads: solid checker-plate steps (no see-through), each down to the stringer line
    const n = Math.ceil((Y - yb) / 0.18), run = (E.x1 - E.x0) / n;
    for (let i = 0; i < n; i++) {
      const xa = E.x0 + i * run, xb = xa + run, yt = yAt(xb) - 0.01;
      A.set({ col: hex(i % 2 ? 0x6a756e : 0x66716a), rm: [0.55, 0.5, 0] }); A.box(xa, yt - 0.06, E.z0 + 0.1, xb, yt, E.z1 - 0.1, { faces: 'Y' });
      A.set({ col: dark, rm: [0.6, 0.5, 0] }); A.box(xa, yAt(xa) - 0.2, E.z0 + 0.1, xb, yt - 0.06, E.z1 - 0.1, { faces: 'xy' });
      A.set({ col: hex(0xd8b21a), rm: [0.6, 0.2, 0] }); A.box(xb - 0.05, yt, E.z0 + 0.3, xb, yt + 0.004, E.z1 - 0.3, { faces: 'Y' });
    }
    // stringers (deep steel channels), handrails, posts every 3 m down onto the off-ramp
    for (const z of [E.z0, E.z1]) {
      const zi = z === E.z0 ? z + 0.1 : z - 0.1, so = z === E.z0 ? -1 : 1;
      A.set({ col: steel, rm: [0.5, 0.6, 0] });
      A.quad([E.x0, yb - 0.35, z], [E.x1, Y - 0.35, z], [E.x1, Y + 0.15, z], [E.x0, yb + 0.15, z]);
      A.quad([E.x1, Y - 0.35, z], [E.x0, yb - 0.35, z], [E.x0, yb + 0.15, z], [E.x1, Y + 0.15, z]);
      A.tube([E.x0, yb + 1.0, zi], [E.x1, Y + 1.0, zi], 0.035, 6);
      A.tube([E.x0, yb + 0.55, zi], [E.x1, Y + 0.55, zi], 0.025, 5);
      for (let x = E.x0 + 0.2; x < E.x1; x += 1.5) A.box(x - 0.03, yAt(x), zi - 0.03, x + 0.03, yAt(x) + 1.0, zi + 0.03, { faces: 'xXzZ' });
      for (let x = E.x0 + 3; x < E.x1; x += 4) { A.set({ col: dark, rm: [0.6, 0.5, 0] }); A.box(x - 0.1, offrampY(x), z + so * 0.05 - 0.1, x + 0.1, yAt(x) - 0.3, z + so * 0.05 + 0.1); }
      for (let x = E.x0; x < E.x1 - 0.01; x += 2) { const y0 = yAt(x), y1 = yAt(x + 2); colliders.push({ min: [x, y0 - 0.5, z - 0.12], max: [x + 2, y1 + 1.05, z + 0.12], data: { mat: 'metal', kind: 'rail', layer: 'deck' } }); }
    }
    colliders.push({ min: [T.x1 - 0.1, Y - 0.3, T.z0], max: [T.x1 + 0.1, Y + 1.1, T.z1], data: { mat: 'metal', kind: 'rail', layer: 'deck' } });
    colliders.push({ min: [T.x0 - 0.1, Y - 0.3, T.z0], max: [T.x0 + 0.1, Y + 1.1, E.z0], data: { mat: 'metal', kind: 'rail', layer: 'deck' } });
    A.set({ col: steel, rm: [0.5, 0.6, 0] }); A.box(T.x0 - 0.03, Y, T.z0, T.x0 + 0.03, Y + 0.12, E.z0); A.box(T.x0 - 0.03, Y + 1.04, T.z0, T.x0 + 0.03, Y + 1.1, E.z0); A.box(T.x0 - 0.03, Y + 0.55, T.z0, T.x0 + 0.03, Y + 0.6, E.z0);
    colliders.push({ min: [T.x0, Y - 0.3, T.z1 - 0.1], max: [T.x1, Y + 1.1, T.z1 + 0.1], data: { mat: 'metal', kind: 'rail', layer: 'deck' } });
    // the green emergency-exit sign (running man) on the parapet beside the opening, both faces
    const sc = makeCanvas(256, 128), sg = sc.getContext('2d');
    sg.fillStyle = '#1f8a4a'; sg.fillRect(0, 0, 256, 128); sg.fillStyle = '#fff'; sg.fillRect(10, 10, 108, 108);
    sg.fillStyle = '#1f8a4a'; sg.beginPath(); sg.arc(66, 30, 11, 0, 7); sg.fill();
    sg.lineWidth = 12; sg.strokeStyle = '#1f8a4a'; sg.lineCap = 'round';
    sg.beginPath(); sg.moveTo(60, 46); sg.lineTo(50, 78); sg.lineTo(30, 100); sg.moveTo(50, 78); sg.lineTo(72, 92); sg.lineTo(80, 112); sg.moveTo(58, 52); sg.lineTo(86, 64); sg.moveTo(58, 52); sg.lineTo(36, 62); sg.stroke();
    sg.fillStyle = '#fff'; sg.font = '900 40px "Noto Sans CJK JP","Noto Sans JP",sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('非常口', 188, 52); sg.font = '400 18px Anton, sans-serif'; sg.fillText('EMERGENCY EXIT', 188, 96);
    const sm = new THREE.MeshStandardMaterial({ map: canvasTex(sc, { repeat: false }), emissive: 0xffffff, emissiveMap: canvasTex(sc, { repeat: false }), emissiveIntensity: 0.6, roughness: 0.5 });
    for (const [x, ry] of [[T.x0 - 0.6, 0], [T.x0 - 0.6, Math.PI]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), sm); m.position.set(x, Y + 1.75, -140.4 + (ry ? -0.03 : 0.03)); m.rotation.y = ry; root.add(m); }
    A.set({ col: dark, rm: [0.5, 0.6, 0] }); A.box(T.x0 - 0.65, Y + XWAY.barrier, -140.45, T.x0 - 0.55, Y + 2.1, -140.35);
    root.add(A.mesh(rmMat({}), { shadow: true }));
  }
  // ---- sound walls on the north side: translucent grey-green acrylic panels on H-posts above the parapet
  {
    const SW = new Acc({ rm: true });
    for (let x = XWAY_BLOCK - 4; x < 124; x += 2) {
      const z = XWAY.z0 + 0.12;
      SW.set({ col: hex(0x5e6266), rm: [0.45, 0.65, 0] }); if (Math.round(x) % 4 === 0) SW.box(x - 0.08, Y + XWAY.barrier, z - 0.08, x + 0.08, Y + XWAY.barrier + 3.2, z + 0.08, { faces: 'xXzZ' });
      SW.set({ col: hex(0x8a9a96), rm: [0.15, 0.3, 0] }); SW.box(x + 0.04, Y + XWAY.barrier + 0.1, z - 0.02, x + 1.96, Y + XWAY.barrier + 3.1, z + 0.02, { faces: 'zZ' });
    }
    const swm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.72, depthWrite: false });
    const sm = SW.mesh(swm); sm.renderOrder = 2; root.add(sm);
  }
  // ---- sodium masts along both parapets (orange pools), one over the span
  const mast = (A, x, side, ox = 0, oyy = 0) => {
    const z = side > 0 ? XWAY_IN.z1 - 0.2 : XWAY_IN.z0 + 0.2;
    A.set({ col: hex(0x5a5c60), rm: [0.5, 0.6, 0] });
    A.cyl(x - ox, Y + 1.05 - oyy, z, 0.1, 0.08, Y + 10 - oyy, 8, { cap: false });
    A.tube([x - ox, Y + 9.9 - oyy, z], [x - ox, Y + 10.2 - oyy, z - side * 2.6], 0.06, 5);
    A.set({ col: hex(0x2a2a2c), rm: [0.5, 0.5, 0] }); A.box(x - ox - 0.35, Y + 10.0 - oyy, z - side * 2.6 - 0.2, x - ox + 0.35, Y + 10.3 - oyy, z - side * 2.6 + 0.2);
    A.set({ col: [1, 0.6, 0.2], rm: [0.3, 0, 3] }); A.box(x - ox - 0.3, Y + 9.98 - oyy, z - side * 2.6 - 0.15, x - ox + 0.3, Y + 10.0 - oyy, z - side * 2.6 + 0.15, { faces: 'y' });
  };
  for (let x = -230; x < 240; x += 26) for (const side of [1, -1]) {
    const xx = x + (side > 0 ? 0 : 13);
    const onSpan = xx > SPAN.x0 + 1 && xx < SPAN.x1 - 1;
    mast(onSpan ? span.con : main.con, xx, side, onSpan ? SPAN.x0 : 0, onSpan ? Y : 0);
    const gz = (side > 0 ? XWAY_IN.z1 - 0.2 : XWAY_IN.z0 + 0.2) - side * 2.6;
    const gl = { p: [xx, Y + 9.85, gz], color: [2.8, 1.5, 0.45], size: 1.4, far: true, onSpan };
    glows.push(gl);
    lights.push({ x: xx, z: gz, r: 10, color: [1.3, 0.75, 0.3], k: 0.7 });
  }
  // ---- the green gantry sign
  const gx = 66;
  C.set({ col: hex(0x6a6c70), rm: [0.5, 0.6, 0] });
  for (const z of [XWAY_IN.z0 + 0.3, XWAY_IN.z1 - 0.3]) C.box(gx - 0.2, Y + 1.05, z - 0.2, gx + 0.2, Y + 7.6, z + 0.2);
  C.box(gx - 0.25, Y + 6.9, XWAY_IN.z0, gx + 0.25, Y + 7.3, XWAY_IN.z1);
  const gs = gantrySign();
  gs.position.set(gx + 0.3, Y + 5.6, -145.3); gs.rotation.y = Math.PI / 2; root.add(gs);
  const gs2 = gantrySign(true); gs2.position.set(gx - 0.3, Y + 5.6, -154.7); gs2.rotation.y = -Math.PI / 2; root.add(gs2);
  colliders.push({ min: [gx - 0.3, Y + 1, XWAY_IN.z0], max: [gx + 0.3, Y + 7.6, XWAY_IN.z0 + 0.5], data: { mat: 'metal', kind: 'pole' } });
  colliders.push({ min: [gx - 0.3, Y + 1, XWAY_IN.z1 - 0.5], max: [gx + 0.3, Y + 7.6, XWAY_IN.z1], data: { mat: 'metal', kind: 'pole' } });
  // ---- meshes
  const tex = asphaltTex();
  const roadMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xa8a8ac, roughness: 0.78 });
  const paintMat = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const conMat = rmMat({ map: concreteTex() });
  for (const [S, parent] of [[main, root]]) { parent.add(S.road.mesh(roadMat)); parent.add(S.paint.mesh(paintMat)); parent.add(S.con.mesh(conMat, { shadow: true })); }
  const spanG = new THREE.Group(); spanG.name = 'span';
  spanG.position.set(SPAN.x0, Y, 0);
  spanG.add(span.road.mesh(roadMat)); spanG.add(span.paint.mesh(paintMat)); spanG.add(span.con.mesh(conMat, { shadow: true }));
  root.add(spanG);
  // the span's east pier in a group pivoting at its foot, so it can topple over when it's blown
  const pierGeoMesh = pierS.mesh(conMat, { shadow: true }); pierGeoMesh.geometry.translate(-SPAN.x1, 0, 150);
  const pierMesh = new THREE.Group(); pierMesh.position.set(SPAN.x1, 0, -150); pierMesh.add(pierGeoMesh); root.add(pierMesh);
  roadMat.userData.noAO = paintMat.userData.noAO = true;
  // ---- the torn ends (hidden until the span goes): broken concrete teeth + bent rebar on the fixed deck's
  // west face at x = SPAN.x1, and on the span's free end (rides with the span group)
  const tear = (ox, dir, seed) => {
    const A = new Acc({ rm: true }), r = makeRng(seed);
    for (let z = XWAY.z0 + 0.3; z < XWAY.z1 - 0.3; z += 0.5 + r() * 0.7) {
      const d = 0.15 + r() * 0.7, hgt = 0.2 + r() * 0.5, y0 = -0.45 - r() * 0.8;
      A.set({ col: hex(r() < 0.5 ? 0x8a8780 : 0x6e6b65), rm: [0.9, 0, 0] });
      A.obox(ox + dir * d / 2, y0 + hgt / 2, z, d / 2, hgt / 2, 0.2 + r() * 0.25, r() * 0.6);
    }
    A.set({ col: hex(0x3a2a22), rm: [0.6, 0.6, 0] });
    for (let i = 0; i < 46; i++) { const z = XWAY.z0 + 0.4 + r() * (XWAY.z1 - XWAY.z0 - 0.8), y = -0.1 - r() * 1.4, L = 0.4 + r() * 1.4; A.tube([ox, y, z], [ox + dir * L, y - r() * 0.5 + 0.2, z + (r() - 0.5) * 0.6], 0.025, 4); }
    const m = A.mesh(conMat, { shadow: true }); m.visible = false; return m;
  };
  const breakFixed = tear(SPAN.x1, -1, 71); breakFixed.position.y = Y; root.add(breakFixed);
  const breakSpan = tear(SPAN.x1 - SPAN.x0, 1, 72); spanG.add(breakSpan);
  return { root, colliders, walks, groundMats: [roadMat, paintMat], anchors: { glows, lights }, span: spanG, spanPier: pierMesh, spanBox, spanGlows: glows.filter(g => g.onSpan), breakFixed, breakSpan };
}
function gantrySign(back = false) {
  const W = 1024, H = 384, c = makeCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#0e6a3a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#f2f2f2'; g.lineWidth = 8; g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = '#f2f2f2'; g.textBaseline = 'middle';
  g.font = `900 92px ${JP}`; g.fillText(back ? '黒金港' : '新宿', 60, 120);
  g.font = '400 50px Anton, sans-serif'; g.fillText(back ? 'Kurogane Port' : 'Shinjuku', 60, 205);
  g.font = `900 92px ${JP}`; g.textAlign = 'right'; g.fillText(back ? '3km' : '4km', W - 60, 120);
  g.fillStyle = '#f2c21a'; g.fillRect(60, 270, 300, 80); g.fillStyle = '#0e6a3a'; g.font = `900 54px ${JP}`; g.textAlign = 'left'; g.fillText('首都高', 90, 312);
  g.fillStyle = '#f2f2f2'; g.font = `900 64px ${JP}`; g.fillText(back ? '← 出口 EXIT' : '黒金線 ←', 420, 312);
  const t = canvasTex(c, { repeat: false, aniso: 4 });
  return new THREE.Mesh(new THREE.PlaneGeometry(9.2, 3.45), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 }));
}

// weathered expressway concrete (one 2.1 m tile): board-form lines, form-tie holes, rain streaks running
// down from the top lip, tyre scuffs and road grime along the foot, a reflector stud
function concreteTex() {
  const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), rng = makeRng(311);
  g.fillStyle = '#b8b4ac'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { const v = rng(); g.fillStyle = `rgba(${v < 0.5 ? '40,38,34' : '255,252,246'},${0.08 * rng()})`; g.fillRect(rng() * S, rng() * S, 1.5 + rng() * 2, 1.5 + rng() * 2); }
  g.fillStyle = 'rgba(60,56,50,0.18)'; for (let y = 0; y < S; y += 32) g.fillRect(0, y, S, 1.5);
  g.fillStyle = 'rgba(40,38,34,0.5)'; g.fillRect(0, 0, 2, S);
  for (const [x, y] of [[40, 70], [168, 70], [40, 198], [168, 198]]) { g.fillStyle = 'rgba(30,28,26,0.55)'; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); }
  // streaks from the lip (v ≈ 0.5 is the barrier top: the tile's lower half shows on the 1.05 m barrier)
  for (let i = 0; i < 26; i++) { const x = rng() * S, y0 = S * 0.5 + rng() * 6, len = 30 + rng() * 90, a = 0.08 + rng() * 0.16;
    const lg = g.createLinearGradient(0, y0, 0, y0 + len); lg.addColorStop(0, `rgba(54,48,40,${a})`); lg.addColorStop(1, 'rgba(54,48,40,0)'); g.fillStyle = lg; g.fillRect(x, y0, 2 + rng() * 5, len); }
  for (let i = 0; i < 18; i++) { const x = rng() * S, y0 = rng() * 20, len = 30 + rng() * 70, a = 0.06 + rng() * 0.12;
    const lg = g.createLinearGradient(0, y0, 0, y0 + len); lg.addColorStop(0, `rgba(54,48,40,${a})`); lg.addColorStop(1, 'rgba(54,48,40,0)'); g.fillStyle = lg; g.fillRect(x, y0, 2 + rng() * 5, len); }
  // road grime + tyre scuffs along the foot
  const gr = g.createLinearGradient(0, S, 0, S - 60); gr.addColorStop(0, 'rgba(40,36,32,0.55)'); gr.addColorStop(1, 'rgba(40,36,32,0)'); g.fillStyle = gr; g.fillRect(0, S - 60, S, 60);
  for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(20,20,20,${0.2 + rng() * 0.25})`; g.lineWidth = 3 + rng() * 5; g.beginPath(); const x = rng() * S; g.moveTo(x, S - 8 - rng() * 14); g.lineTo(x + 40 + rng() * 80, S - 6 - rng() * 12); g.stroke(); }
  g.fillStyle = '#e8a21a'; g.fillRect(124, S - 96, 10, 6);
  return canvasTex(c, { aniso: 8 });
}
