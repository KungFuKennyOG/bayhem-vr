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
  // lower body (solid, red with a cream stripe), window posts, roof
  const lowH = 1.05;
  // the lower body is a shell (four panels + a sill), not a solid box: you stand inside it
  const band = (p) => (p.y > lowH - 0.18 && p.y < lowH - 0.08 ? [0.9, 0.86, 0.76] : red);
  for (const s of [-1, 1]) {
    P.add(rbox(0.1, lowH, l, 0.04), M4(s * (w / 2 - 0.05), lowH / 2, 0), band);
    P.add(rbox(w, lowH, 0.1, 0.04), M4(0, lowH / 2, s * (l / 2 - 0.05)), band);
    P.add(rbox(0.22, 0.06, l, 0.02), M4(s * (w / 2 - 0.1), lowH, 0), [0.75, 0.72, 0.66]);
    P.add(rbox(w, 0.06, 0.22, 0.02), M4(0, lowH, s * (l / 2 - 0.1)), [0.75, 0.72, 0.66]);
  }
  P.add(rbox(w, 0.12, l, 0.06), M4(0, -0.06, 0), red);   // underside
  P.add(rbox(w + 0.02, 0.32, l + 0.02, 0.18, 2), M4(0, h - 0.16, 0), red);
  P.add(new THREE.SphereGeometry(1, 20, 8, 0, PI * 2, 0, PI / 2), M4(0, h - 0.02, 0, 0, 0, 0, w * 0.5, 0.35, l * 0.5), red);
  S.add(snowCap(w * 0.8, l * 0.8, 0.14, seed, 4, 4), M4(0, h + 0.32, 0), [0.95, 0.97, 1]);
  // corner posts + mid posts
  const posts = [[-w / 2 + 0.1, -l / 2 + 0.1], [w / 2 - 0.1, -l / 2 + 0.1], [w / 2 - 0.1, l / 2 - 0.1], [-w / 2 + 0.1, l / 2 - 0.1], [-w / 2 + 0.05, 0], [w / 2 - 0.05, 0.75], [0, -l / 2 + 0.05], [0, l / 2 - 0.05]];
  for (const [x, z] of posts) P.add(rbox(0.12, h - lowH - 0.3, 0.12, 0.03), M4(x, lowH + (h - lowH - 0.3) / 2, z), red);
  // the number, painted on the sides (a canvas texture on two quads)
  const nc = makeCanvas(128, 128), nx = nc.getContext('2d'); nx.fillStyle = 'rgba(0,0,0,0)'; nx.fillRect(0, 0, 128, 128); nx.fillStyle = '#efe8d8'; nx.font = '700 110px Anton, Impact, sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillText(String(num), 64, 70);
  const numMat = new THREE.MeshBasicMaterial({ map: canvasTex(nc, { repeat: false }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const s of [-1, 1]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), numMat); q.position.set(s * (w / 2 + 0.012), 0.55, -l * 0.28); q.rotation.y = s * PI / 2; body.add(q); }
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
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, h + 0.2, s * 0.9), new THREE.Vector3(0.9, h + 1.4, s * 0.7), new THREE.Vector3(0.75, top - 1.6, s * 0.45), new THREE.Vector3(0, top - 0.6, s * 0.4)]);
    H.add(new THREE.TubeGeometry(curve, 10, 0.1, 6), null, steel);
  }
  H.add(rbox(0.36, 0.4, 3.4, 0.05), M4(0, top - 0.3, 0), [0.3, 0.31, 0.33]);    // carriage frame
  for (let k = 0; k < 4; k++) H.add(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12).rotateZ(PI / 2), M4(0, top + 0.02, -1.2 + k * 0.8), dark);
  H.add(rbox(0.3, 0.5, 0.5, 0.04), M4(0, top + 0.45, 0.6), [0.55, 0.45, 0.1]);   // the haul-rope clamp
  const mk = (b, m, parent, sh = true) => { const mesh = b.mesh(m, { shadow: sh }); parent.add(mesh); return mesh; };
  mk(P, mats.cabin(), body); mk(I, mats.paintIn(), body, false); mk(TL, interiorMats().lining, body, false); mk(TF, interiorMats().floor, body, false); mk(L, mats.lamp(), body, false); mk(S, mats.snow(), body, false);
  mk(H, mats.metal(), hanger);
  // windows: one pane per bay (they break)
  const glassM = new THREE.MeshStandardMaterial({ color: 0x7c8c9c, roughness: 0.12, metalness: 0.5, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 0.12 });
  const panes = [];
  const wy = lowH + (h - lowH - 0.3) / 2, wh = h - lowH - 0.32;
  const pane = (x, z, ww, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), glassM); m.position.set(x, wy, z); m.rotation.y = ry; m.renderOrder = 6; body.add(m); panes.push({ mesh: m, broken: false, n: new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)) }); };
  pane(0, -l / 2, w - 0.3, 0); pane(0, l / 2, w - 0.3, PI);
  for (const s of [-1, 1]) { pane(s * w / 2, -l / 4, l / 2 - 0.2, s * PI / 2); pane(s * w / 2, l / 4, l / 2 - 0.2, s * PI / 2); }
  // the door (sliding, +x side, rear half): it slides back when open
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, h - 0.35, 1.2), mats.cabin());
  door.position.set(w / 2 + 0.04, (h - 0.35) / 2 + 0.05, 1.05); body.add(door);
  { const g = door.geometry, cc = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = red[0]; cc[i + 1] = red[1]; cc[i + 2] = red[2]; } g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); }
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
