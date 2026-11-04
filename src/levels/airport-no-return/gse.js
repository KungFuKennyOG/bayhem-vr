import * as THREE from 'three';
import * as T from '../../textures.js';
import { box, at, cyl, mergeGrouped } from '../../geom.js';
import { makeRng } from '../../rng.js';
import { MAT } from '../../vehicles.js';
import { loft, strut, wheelGeo } from './shapes.js';

// =====================================================================================
//  Ground support equipment + airport props: the FOLLOW-ME jeep (you ride it), JET A-1
//  refuelers (they explode), tugs, baggage carts, ULD dollies, stair trucks, belt loaders,
//  GPUs, cones, light masts, signs. Model space: forward = -z, origin on the ground.
//  Builders return { geometry (grouped by GM slot), colliders: [{min,max}], anchors }.
// =====================================================================================
const TAU = Math.PI * 2;
export const GM = { yellow: 0, white: 1, dark: 2, metal: 3, tire: 4, rim: 5, glass: 6, hazard: 7, head: 8, tail: 9, belt: 10, bag: 11, orange: 12, check: 13, tank: 14, red: 15, curtain: 16, alu: 17, amber: 18, olive: 19, text: 20, seat: 21, diamond: 22, plastic: 23, follow: 24 };
const NGM = 25;
let MATS = null;
export function gseMaterials() {
  if (MATS) return MATS;
  const m = (o) => new THREE.MeshStandardMaterial(o);
  MATS = [];
  MATS[GM.yellow] = m({ color: 0xe0a812, roughness: 0.45, metalness: 0.2 });
  MATS[GM.white] = m({ color: 0xe9e6de, roughness: 0.42, metalness: 0.15 });
  MATS[GM.dark] = m({ color: 0x18191b, roughness: 0.7, metalness: 0.2 });
  MATS[GM.metal] = m({ color: 0x8d9298, roughness: 0.35, metalness: 0.85 });
  MATS[GM.tire] = m({ color: 0x151413, roughness: 0.92 });
  MATS[GM.rim] = m({ color: 0xa9adb2, roughness: 0.3, metalness: 0.9 });
  MATS[GM.glass] = m({ color: 0x232a33, roughness: 0.05, metalness: 0.6, envMapIntensity: 2 });
  MATS[GM.hazard] = m({ map: hazardTexture(), roughness: 0.55, metalness: 0.1 });
  MATS[GM.head] = m({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 2.2, roughness: 0.2 });
  MATS[GM.tail] = m({ color: 0x400000, emissive: 0xff1a0a, emissiveIntensity: 2.0, roughness: 0.3 });
  MATS[GM.belt] = m({ color: 0x1d1c1b, roughness: 0.9 });
  MATS[GM.bag] = m({ vertexColors: true, roughness: 0.6, metalness: 0.05 });
  MATS[GM.orange] = m({ color: 0xff5a10, roughness: 0.5 });
  MATS[GM.check] = m({ map: checkTexture(), roughness: 0.4, metalness: 0.15 });
  MATS[GM.tank] = m({ map: tankTexture(), roughness: 0.32, metalness: 0.25, envMapIntensity: 1.2 });
  MATS[GM.red] = m({ color: 0x9c1a12, roughness: 0.45, metalness: 0.2 });
  MATS[GM.curtain] = m({ color: 0x1f3c78, roughness: 0.85 });
  MATS[GM.alu] = m({ map: uldTexture(), color: 0xc8ccd0, roughness: 0.38, metalness: 0.75 });
  MATS[GM.amber] = m({ color: 0x402000, emissive: 0xff9a10, emissiveIntensity: 2.5, roughness: 0.3 });
  MATS[GM.olive] = m({ color: 0x5b5a3e, roughness: 0.6, metalness: 0.2 });
  MATS[GM.text] = m({ map: signTexture(), roughness: 0.5, emissive: 0xffffff, emissiveMap: signTexture(), emissiveIntensity: 0.25 });
  MATS[GM.seat] = m({ color: 0x2a2523, roughness: 0.8 });
  MATS[GM.diamond] = MAT.diamond || m({ color: 0xa0a4a8, metalness: 0.85, roughness: 0.35 });
  MATS[GM.plastic] = m({ color: 0x1c1d1f, roughness: 0.62, metalness: 0.05 });
  MATS[GM.follow] = m({ map: followTexture(), roughness: 0.45, emissive: 0xffffff, emissiveMap: followTexture(), emissiveIntensity: 0.35 });
  return MATS;
}
// every geometry gets a colour attribute so luggage tints survive the merge
const tinted = (g, c = [1, 1, 1]) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
function finish(list) {
  for (const [g] of list) if (!g.attributes.color) tinted(g);
  return mergeGrouped(list, NGM).geometry;
}
function wheels(list, pos, r, w) {
  const { tire, hub } = wheelGeo(r, w);
  for (const [x, z] of pos) { list.push([tire.clone().translate(x, r, z), GM.tire]); list.push([hub.clone().translate(x, r, z), GM.rim]); }
}

// ---------------------------------------------------------------- textures
function hazardTexture() {
  const c = T.makeCanvas(128, 32), x = c.getContext('2d');
  x.fillStyle = '#e0a812'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#151311';
  for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 16, 32); x.lineTo(i * 16 + 8, 32); x.lineTo(i * 16 + 24, 0); x.lineTo(i * 16 + 16, 0); x.fill(); }
  return T.canvasTex(c);
}
function checkTexture() {
  const c = T.makeCanvas(256, 256), x = c.getContext('2d');
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.fillStyle = (i + j) % 2 ? '#141414' : '#f2b512'; x.fillRect(i * 32, j * 32, 32, 32); }
  return T.canvasTex(c);
}
function tankTexture() {
  // u along the tank (0..1 = front..rear), v around (0 = bottom). White with a red band, JET A-1 and hazmat placards.
  const W = 1024, H = 256, c = T.makeCanvas(W, H), x = c.getContext('2d'), n = T.makeNoise(612, 32);
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { const v = 236 - T.fbm(n, xx / W * 6, y / H * 2, 4, 3) * 18 - (y > H * 0.78 ? 30 : 0); const i = (y * W + xx) * 4; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 0.98; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  x.fillStyle = '#b4170f'; x.fillRect(0, H * 0.58, W, H * 0.06);
  x.font = '700 64px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  // side +x is v ≈ 0.25 .. side -x ≈ 0.75 (θ from top through +x); text upright on both sides
  for (const [v, flip] of [[0.71, false], [0.29, true]]) {
    x.save(); x.translate(W * 0.5, H * (1 - v)); if (flip) x.rotate(Math.PI);
    x.fillStyle = '#b4170f'; x.fillText('JET A-1', -60, 0);
    x.fillStyle = '#16171a'; x.font = '600 26px Oswald, sans-serif'; x.fillText('FLAMMABLE   NO SMOKING', -60, 38); x.font = '700 64px Oswald, sans-serif';
    // hazmat diamond 1863
    x.translate(220, 0); x.rotate(Math.PI / 4); x.fillStyle = '#c41a10'; x.fillRect(-30, -30, 60, 60); x.rotate(-Math.PI / 4);
    x.fillStyle = '#fff'; x.font = '700 20px Oswald, sans-serif'; x.fillText('1863', 0, 2);
    x.restore();
  }
  return T.canvasTex(c, { repeat: false });
}
function uldTexture() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d'), n = T.makeNoise(733, 16);
  const img = x.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) { const v = 200 + (T.fbm(n, xx / S, y / S, 3, 3) - 0.5) * 40 + ((xx % 16) < 1 ? -60 : 0); const i = (y * S + xx) * 4; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v * 1.02; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c);
}
let _follow = null;
function followTexture() {
  if (_follow) return _follow;
  const W = 512, H = 128, c = T.makeCanvas(W, H), x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#141414' : '#f2b512'; x.fillRect(i * 32, j * 32, 32, 32); }
  x.fillStyle = '#f2b512'; x.fillRect(40, 18, W - 80, H - 36); x.strokeStyle = '#141414'; x.lineWidth = 6; x.strokeRect(40, 18, W - 80, H - 36);
  x.fillStyle = '#141414'; x.font = '700 70px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('FOLLOW ME', W / 2, H / 2 + 2);
  return (_follow = T.canvasTex(c, { repeat: false }));
}
// sign atlas: 4 rows of taxiway signs (yellow on black / black on yellow)
export const SIGN_ROWS = 4;
let _signTex = null;
function signTexture() {
  if (_signTex) return _signTex;
  const W = 512, H = 256, c = T.makeCanvas(W, H), x = c.getContext('2d');
  const rows = [[['A', 0], ['27 ←', 1], ['B', 1]], [['27-9', 2], ['A3', 0]], [['↑ CARGO', 1], ['A', 0]], [['HANGARS →', 1], ['B2', 0]]];
  rows.forEach((row, r) => {
    let px = 0; const y = r * 64, cw = W / row.length;
    for (const [t, kind] of row) {
      x.fillStyle = kind === 0 ? '#111' : kind === 2 ? '#b2140c' : '#f2c018'; x.fillRect(px, y, cw, 64);
      x.fillStyle = kind === 0 ? '#f2c018' : kind === 2 ? '#fff' : '#111';
      x.font = '700 44px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, px + cw / 2, y + 34);
      if (kind === 0) { x.strokeStyle = '#f2c018'; x.lineWidth = 3; x.strokeRect(px + 5, y + 5, cw - 10, 54); }
      px += cw;
    }
  });
  return (_signTex = T.canvasTex(c, { repeat: false }));
}

// =====================================================================================
//  FOLLOW-ME JEEP (the ride). Bed floor at y = 1.02, bed z ∈ [0.35, 2.35]. Driver sits front-left.
// =====================================================================================
export const JEEP = { bedY: 1.02, bedZ0: 0.3, bedZ1: 2.3, halfW: 0.95, wheelR: 0.44, len: 5.2 };
// side profile (z, y) extruded across the body width; arches cut around the wheels
function jeepBody(W) {
  const pts = [];
  const arch = (cz, r, k0 = 0, k1 = 12) => { for (let k = k0; k <= k1; k++) { const a = Math.PI - (k / 12) * Math.PI; pts.push([cz + Math.cos(a) * r, 0.42 + Math.sin(a) * r]); } };
  pts.push([2.5, 0.5], [2.52, 0.98], [2.4, 1.02], [0.32, 1.02], [0.32, 0.86], [-0.92, 0.86], [-0.92, 1.3], [-1.0, 1.31], [-2.38, 1.27], [-2.6, 1.16], [-2.64, 0.62], [-2.5, 0.46]);
  arch(-1.75, 0.56);
  pts.push([-1.0, 0.4], [0.8, 0.4]);
  arch(1.45, 0.56);
  pts.push([2.2, 0.44]);
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 4 });
  // shape x -> world z, extrude z -> world x
  g.rotateY(Math.PI / 2); g.translate(-W / 2, 0, 0);
  // checker uvs: world units / 1.6 m (≈ 20 cm squares)
  const p = g.attributes.position, uv = g.attributes.uv, n = new THREE.Vector3();
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) { n.fromBufferAttribute(nr, i); const ax = Math.abs(n.x) > 0.6, ay = Math.abs(n.y) > 0.6; uv.setXY(i, (ax ? p.getZ(i) : p.getX(i)) / 1.6, (ay ? p.getZ(i) : p.getY(i)) / 1.6); }
  return g;
}
export function buildJeep() {
  const L = [];
  const W = 2.0;
  L.push([jeepBody(W), GM.check]);
  // hood top panel (white), grille, bumpers, flared fenders
  L.push([at(box(W - 0.2, 0.03, 1.32), 0, 1.3, -1.68, -0.02), GM.white]);
  L.push([at(box(1.3, 0.42, 0.05), 0, 0.92, -2.66), GM.plastic]);
  for (let k = 0; k < 6; k++) L.push([at(box(0.05, 0.38, 0.04), -0.5 + k * 0.2, 0.92, -2.69), GM.metal]);
  L.push([at(box(W + 0.16, 0.2, 0.26), 0, 0.56, -2.7), GM.plastic]); L.push([at(box(W + 0.16, 0.2, 0.24), 0, 0.56, 2.55), GM.plastic]);
  for (const s of [-1, 1]) for (const z of [-1.75, 1.45]) { const fl = new THREE.TorusGeometry(0.6, 0.09, 6, 14, Math.PI); fl.scale(1, 1, 1.4); fl.rotateY(Math.PI / 2); L.push([at(fl, s * (W / 2 + 0.02), 0.42, z), GM.plastic]); }
  for (const s of [-1, 1]) L.push([at(box(0.1, 0.08, 1.6), s * (W / 2 + 0.06), 0.46, -0.1), GM.plastic]);
  // bed: diamond-plate floor, low side walls, tailgate, wheel tubs
  L.push([at(box(W - 0.16, 0.04, 2.06), 0, JEEP.bedY + 0.025, 1.36), GM.diamond]);
  for (const s of [-1, 1]) L.push([at(box(0.08, 0.36, 1.24, 2), s * (W / 2 - 0.04), 1.03, -0.3), GM.check]);
  L.push([at(box(W - 0.12, 0.03, 1.22), 0, 0.875, -0.3), GM.plastic]);
  for (const s of [-1, 1]) { L.push([at(box(0.08, 0.36, 2.1), s * (W / 2 - 0.04), JEEP.bedY + 0.16, 1.36), GM.check]); L.push([at(box(0.12, 0.04, 2.12), s * (W / 2 - 0.04), JEEP.bedY + 0.35, 1.36), GM.plastic]); L.push([at(box(0.34, 0.3, 0.9), s * 0.72, JEEP.bedY + 0.14, 1.45), GM.plastic]); }
  L.push([at(box(W - 0.06, 0.38, 0.08), 0, JEEP.bedY + 0.16, 2.43), GM.check]); L.push([at(box(W, 0.04, 0.12), 0, JEEP.bedY + 0.36, 2.43), GM.plastic]);
  L.push([at(box(W - 0.06, 0.36, 0.08), 0, JEEP.bedY + 0.16, 0.3), GM.plastic]);
  // cab: dash, windscreen frame + glass, seats, steering wheel, gear lever
  L.push([at(box(W - 0.2, 0.3, 0.36), 0, 1.18, -0.84), GM.plastic]);
  L.push([at(box(0.5, 0.08, 0.2), -0.45, 1.36, -0.82), GM.glass]);
  L.push([at(box(W - 0.06, 0.07, 0.07), 0, 1.86, -0.97, 0.25), GM.plastic]);
  for (const s of [-1, 1]) L.push([at(box(0.07, 0.62, 0.07), s * (W / 2 - 0.05), 1.56, -1.04, 0.25), GM.plastic]);
  L.push([at(box(W - 0.16, 0.54, 0.02), 0, 1.57, -1.02, 0.25), GM.glass]);
  for (const s of [-1, 1]) { L.push([at(box(0.52, 0.12, 0.52), s * 0.45, 0.98, -0.18), GM.seat]); L.push([at(box(0.52, 0.62, 0.12), s * 0.45, 1.3, 0.12, -0.12), GM.seat]); L.push([at(box(0.3, 0.2, 0.1), s * 0.45, 1.72, 0.16), GM.seat]); }
  const sw = new THREE.TorusGeometry(0.19, 0.025, 6, 18); sw.rotateX(-1.15); L.push([at(sw, -0.45, 1.36, -0.6), GM.plastic]);
  L.push([strut([-0.45, 1.2, -0.75], [-0.45, 1.36, -0.6], 0.025), GM.plastic]);
  L.push([strut([0, 0.95, -0.4], [0.02, 1.2, -0.32], 0.02), GM.metal]);
  // roll cage (you hold on to it) + FOLLOW ME sign + amber beacons
  for (const s of [-1, 1]) {
    L.push([strut([s * 0.9, 1.0, 0.3], [s * 0.9, 2.12, 0.3], 0.045), GM.plastic]);
    L.push([strut([s * 0.9, 2.12, 0.3], [s * 0.88, 1.35, 2.3], 0.04), GM.plastic]);
    L.push([strut([s * 0.9, 1.75, 0.3], [s * 0.94, 1.86, -0.95], 0.035), GM.plastic]);
  }
  L.push([strut([-0.9, 2.12, 0.3], [0.9, 2.12, 0.3], 0.045), GM.plastic]);
  // sign on a short mast above the cage: above your eye line, so it never blocks the view of the plane
  for (const s of [-1, 1]) L.push([strut([s * 0.5, 2.12, 0.3], [s * 0.5, 2.98, 0.3], 0.03), GM.plastic]);
  L.push([at(box(1.5, 0.36, 0.1), 0, 3.14, 0.3), GM.plastic]);
  const sg = new THREE.PlaneGeometry(1.44, 0.34);
  L.push([at(sg.clone(), 0, 3.14, 0.25, 0, Math.PI), GM.follow]); L.push([at(sg, 0, 3.14, 0.356), GM.follow]);
  for (const s of [-1, 1]) L.push([at(cyl(0.09, 0.1, 0.16, 12), s * 0.6, 3.4, 0.3), GM.amber]);
  // lights, mirrors, spare wheel, jerry cans
  for (const s of [-1, 1]) { L.push([at(cyl(0.12, 0.12, 0.06, 14), s * 0.72, 1.06, -2.66, Math.PI / 2), GM.head]); L.push([at(box(0.14, 0.22, 0.05), s * 0.86, 0.98, 2.49), GM.tail]); L.push([at(box(0.18, 0.12, 0.06), s * 1.1, 1.62, -0.98), GM.glass]); }
  const { tire, hub } = wheelGeo(0.4, 0.26); L.push([tire.clone().rotateY(Math.PI / 2).translate(0, 0.92, 2.62), GM.tire]); L.push([hub.clone().rotateY(Math.PI / 2).translate(0, 0.92, 2.62), GM.rim]);
  for (const s of [-1, 1]) L.push([at(box(0.18, 0.4, 0.3), s * 0.62, JEEP.bedY + 0.2, 2.18), GM.red]);
  wheels(L, [[-0.98, -1.75], [0.98, -1.75], [-0.98, 1.45], [0.98, 1.45]], JEEP.wheelR, 0.34);
  const geometry = finish(L);
  // driver (seen from behind / above): shoulders, neck, cap, headset, arms on the wheel
  const D = [];
  D.push([at(cyl(0.2, 0.17, 0.56, 12), 0, 0.3, 0), GM.olive]);
  D.push([at(new THREE.SphereGeometry(0.22, 12, 8, 0, TAU, 0, Math.PI / 2), 0, 0.56, 0), GM.olive]);
  D.push([at(cyl(0.06, 0.07, 0.12, 8), 0, 0.68, -0.01), GM.seat]);
  D.push([at(new THREE.SphereGeometry(0.12, 14, 10), 0, 0.82, -0.02), GM.seat]);
  D.push([at(new THREE.SphereGeometry(0.128, 14, 7, 0, TAU, 0, Math.PI / 2), 0, 0.85, -0.02), GM.red]);
  D.push([at(box(0.2, 0.025, 0.13), 0, 0.86, -0.16), GM.red]);
  for (const s of [-1, 1]) D.push([at(cyl(0.05, 0.05, 0.04, 10).rotateZ(Math.PI / 2), s * 0.13, 0.82, -0.02), GM.plastic]);
  D.push([at(box(0.2, 0.035, 0.02), 0, 0.83, -0.125), GM.glass]);
  for (const s of [-1, 1]) { D.push([strut([s * 0.22, 0.52, 0], [s * 0.2, 0.3, -0.25], 0.055), GM.olive]); D.push([strut([s * 0.2, 0.3, -0.25], [s * 0.14, 0.34, -0.5], 0.045), GM.olive]); }
  const driver = finish(D);
  return { geometry, driver, driverPos: new THREE.Vector3(-0.45, 0.98, -0.18), colliders: [{ min: [-1.1, 0, -2.75], max: [1.1, 1.3, 2.7] }],
    anchors: { beaconL: new THREE.Vector3(-0.6, 3.46, 0.3), beaconR: new THREE.Vector3(0.6, 3.46, 0.3), headL: new THREE.Vector3(-0.72, 1.06, -2.72), headR: new THREE.Vector3(0.72, 1.06, -2.72), exhaust: new THREE.Vector3(0.7, 0.45, 2.6) } };
}

// =====================================================================================
//  JET A-1 REFUELER (hero: explodes)
// =====================================================================================
export function buildRefueler() {
  const L = [];
  // cab-over cab
  L.push([at(box(2.45, 2.1, 2.0, 1), 0, 1.65, -3.6), GM.white]);
  L.push([at(box(2.3, 0.85, 0.05), 0, 2.05, -4.61), GM.glass]);
  for (const s of [-1, 1]) L.push([at(box(0.05, 0.7, 1.2), s * 1.23, 2.1, -3.7), GM.glass]);
  L.push([at(box(2.47, 0.45, 2.02), 0, 0.72, -3.6), GM.red]);
  L.push([at(box(1.4, 0.08, 0.3), 0, 2.75, -3.2), GM.amber]);
  for (const s of [-1, 1]) L.push([at(box(0.3, 0.16, 0.05), s * 0.9, 0.95, -4.62), GM.head]);
  // chassis
  L.push([at(box(1.2, 0.3, 9.6), 0, 0.72, 0.3), GM.dark]);
  // tank (elliptical) — u along, θ around via loft
  const rings = [];
  for (const [z, k] of [[-2.45, 0.8], [-2.3, 0.97], [-2.0, 1], [4.6, 1], [4.9, 0.96], [5.0, 0.82]]) rings.push({ z, cy: 2.1, rx: 1.25 * k, ry: 1.12 * k, sq: 2.3 });
  const tg = loft(rings, { segs: 30 });
  L.push([tg, GM.tank]);
  for (const z of [-2.45, 5.0]) { const cap = new THREE.CircleGeometry(1, 24); cap.scale(1.0, 0.9, 1); if (z < 0) cap.rotateY(Math.PI); L.push([at(cap, 0, 2.1, z), GM.white]); }
  // top walkway + rails + manhole domes
  L.push([at(box(0.8, 0.06, 6.6), 0, 3.25, 1.3), GM.metal]);
  for (const s of [-1, 1]) L.push([at(box(0.04, 0.5, 6.6), s * 0.42, 3.5, 1.3), GM.yellow]);
  for (const z of [-0.5, 1.4, 3.3]) L.push([at(cyl(0.32, 0.36, 0.2, 14), 0, 3.3, z), GM.metal]);
  // hose reel cabinet at the rear, ladder, bumper
  L.push([at(box(2.3, 1.6, 1.2), 0, 1.5, 5.6), GM.white]);
  L.push([at(cyl(0.55, 0.55, 1.9, 18), 0, 1.6, 5.6, 0, 0, Math.PI / 2), GM.dark]);
  for (let k = 0; k < 6; k++) L.push([at(box(0.5, 0.04, 0.04), 0.9, 0.5 + k * 0.45, 6.25), GM.metal]);
  L.push([at(box(2.5, 0.25, 0.2), 0, 0.6, 6.3), GM.hazard]);
  for (const s of [-1, 1]) L.push([at(box(0.15, 0.15, 0.05), s * 1.05, 0.9, 6.42), GM.tail]);
  // side lockers
  for (const s of [-1, 1]) L.push([at(box(0.3, 0.7, 5.6), s * 1.0, 0.95, 1.3), GM.white]);
  wheels(L, [[-1.05, -3.2], [1.05, -3.2], [-1.05, 2.9], [1.05, 2.9], [-1.05, 4.2], [1.05, 4.2]], 0.5, 0.38);
  return { geometry: finish(L), colliders: [{ min: [-1.3, 0, -4.65], max: [1.3, 3.3, 6.45] }], anchors: { tank: new THREE.Vector3(0, 2.1, 1.3), cab: new THREE.Vector3(0, 1.8, -3.6), beacon: new THREE.Vector3(0, 2.85, -3.2) }, half: new THREE.Vector3(1.3, 1.65, 5.5), com: new THREE.Vector3(0, 1.65, 0.9) };
}

// ---------------------------------------------------------------- baggage tug
export function buildTug() {
  const L = [];
  L.push([at(box(1.5, 0.7, 2.7, 1), 0, 0.65, 0), GM.yellow]);
  L.push([at(box(1.3, 0.4, 0.9), 0, 1.15, -0.8), GM.yellow]);
  L.push([at(box(0.6, 0.12, 0.5), 0, 1.05, 0.35), GM.seat]); L.push([at(box(0.6, 0.5, 0.1), 0, 1.3, 0.62), GM.seat]);
  for (const s of [-1, 1]) { L.push([strut([s * 0.65, 1.0, 0.75], [s * 0.65, 2.1, 0.75], 0.04), GM.dark]); L.push([strut([s * 0.65, 2.1, 0.75], [s * 0.65, 2.1, -0.4], 0.04), GM.dark]); }
  L.push([at(box(1.4, 0.06, 1.25), 0, 2.13, 0.17), GM.dark]);
  L.push([at(box(0.35, 0.1, 0.12), 0, 2.22, 0.17), GM.amber]);
  L.push([at(box(1.5, 0.2, 0.2), 0, 0.4, -1.4), GM.hazard]);
  const sw = new THREE.TorusGeometry(0.16, 0.02, 6, 14); sw.rotateX(-0.9); L.push([at(sw, 0, 1.45, -0.15), GM.dark]);
  wheels(L, [[-0.68, -0.9], [0.68, -0.9], [-0.68, 0.9], [0.68, 0.9]], 0.33, 0.25);
  return { geometry: finish(L), colliders: [{ min: [-0.8, 0, -1.5], max: [0.8, 1.4, 1.4] }] };
}
// ---------------------------------------------------------------- baggage cart (open, luggage piled)
export function buildCart(seed = 1) {
  const L = [], r = makeRng(seed);
  L.push([at(box(1.5, 0.12, 2.8), 0, 0.55, 0), GM.dark]);
  for (const s of [-1, 1]) L.push([at(box(0.05, 1.4, 2.8), s * 0.75, 1.3, 0), GM.curtain]);
  L.push([at(box(1.55, 0.05, 2.85), 0, 2.02, 0), GM.white]);
  for (const s of [-1, 1]) for (const z of [-1.38, 1.38]) L.push([at(box(0.06, 1.5, 0.06), s * 0.75, 1.3, z), GM.metal]);
  L.push([strut([0, 0.5, -1.4], [0, 0.35, -2.2], 0.04), GM.metal]);
  // luggage
  const cols = [[0.08, 0.08, 0.1], [0.55, 0.06, 0.05], [0.1, 0.2, 0.45], [0.3, 0.3, 0.32], [0.55, 0.42, 0.18], [0.08, 0.3, 0.12], [0.6, 0.6, 0.62]];
  for (let k = 0; k < 9; k++) {
    const w = 0.4 + r() * 0.3, h = 0.25 + r() * 0.3, d = 0.55 + r() * 0.25;
    const g = tinted(box(w, h, d), cols[Math.floor(r() * cols.length)]);
    L.push([at(g, (r() - 0.5) * 0.7, 0.62 + h / 2 + (k > 5 ? 0.4 : 0), -1.0 + (k % 6) * 0.4 + (r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.5, 0), GM.bag]);
  }
  wheels(L, [[-0.6, -1.1], [0.6, -1.1], [-0.6, 1.1], [0.6, 1.1]], 0.22, 0.14);
  return { geometry: finish(L), colliders: [{ min: [-0.8, 0, -1.45], max: [0.8, 2.05, 1.45] }] };
}
// ---------------------------------------------------------------- ULD dolly with an LD3 container
export function buildULD() {
  const L = [];
  L.push([at(box(1.75, 0.1, 1.8), 0, 0.45, 0), GM.metal]);
  for (const s of [-1, 1]) L.push([at(box(0.06, 0.15, 1.8), s * 0.88, 0.55, 0), GM.yellow]);
  // LD3: contoured profile (one sloped side)
  const sh = new THREE.Shape([new THREE.Vector2(-0.78, 0), new THREE.Vector2(0.78, 0), new THREE.Vector2(0.78, 0.9), new THREE.Vector2(1.0, 1.15), new THREE.Vector2(1.0, 1.62), new THREE.Vector2(-0.78, 1.62)]);
  const ex = new THREE.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: false }); ex.translate(0, 0.52, -0.75);
  const uv = ex.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.6);
  L.push([ex, GM.alu]);
  L.push([at(box(1.5, 1.2, 0.02), 0.05, 1.25, -0.76), GM.curtain]);
  L.push([strut([0, 0.4, -0.9], [0, 0.3, -1.6], 0.04), GM.metal]);
  wheels(L, [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]], 0.2, 0.12);
  return { geometry: finish(L), colliders: [{ min: [-0.9, 0, -0.95], max: [1.05, 2.15, 0.95] }] };
}
// ---------------------------------------------------------------- stair truck (top platform at y ≈ 4.4: a perch)
export const STAIR_TOP = { y: 4.42, z: -3.0 };
export function buildStairTruck() {
  const L = [];
  L.push([at(box(2.2, 1.9, 1.8, 1), 0, 1.45, -4.3), GM.white]);
  L.push([at(box(2.1, 0.8, 0.05), 0, 1.95, -5.21), GM.glass]);
  L.push([at(box(1.2, 0.3, 8.2), 0, 0.6, -0.6), GM.dark]);
  L.push([at(box(2.25, 0.45, 1.82), 0, 0.6, -4.3), GM.yellow]);
  // stair flight rising toward -z
  const steps = 16;
  for (let k = 0; k < steps; k++) { const t = k / (steps - 1); L.push([at(box(1.3, 0.06, 0.36), 0, 1.2 + t * 3.1, 3.2 - t * 5.3), GM.metal]); }
  for (const s of [-1, 1]) {
    L.push([strut([s * 0.68, 1.2, 3.35], [s * 0.68, 4.35, -2.2], 0.07), GM.white]);
    L.push([strut([s * 0.72, 2.2, 3.35], [s * 0.72, 5.35, -2.2], 0.035), GM.yellow]);
    L.push([strut([s * 0.72, 4.35, -2.2], [s * 0.72, 5.35, -2.2], 0.035), GM.yellow]);
    L.push([strut([s * 0.72, 5.4, -2.2], [s * 0.72, 5.4, -3.8], 0.035), GM.yellow]);
    L.push([strut([s * 0.72, 4.4, -3.8], [s * 0.72, 5.4, -3.8], 0.035), GM.yellow]);
  }
  L.push([at(box(1.6, 0.1, 1.7), 0, STAIR_TOP.y - 0.05, STAIR_TOP.z), GM.metal]);
  L.push([at(box(1.6, 0.9, 0.06), 0, 4.9, -3.85), GM.white]);
  L.push([strut([0, 1.4, 1.8], [0, 4.3, -2.2], 0.1), GM.metal]);
  wheels(L, [[-1.0, -3.9], [1.0, -3.9], [-1.0, 2.0], [1.0, 2.0]], 0.42, 0.3);
  return { geometry: finish(L), colliders: [{ min: [-1.15, 0, -5.25], max: [1.15, 2.45, -3.4] }, { min: [-0.75, 0, -3.4], max: [0.75, 1.2, 3.5] }, { min: [-0.8, STAIR_TOP.y - 0.12, -3.85], max: [0.8, STAIR_TOP.y, -2.15], data: { stand: true } }] };
}
// ---------------------------------------------------------------- belt loader
export function buildBeltLoader() {
  const L = [];
  L.push([at(box(1.6, 0.6, 7.2), 0, 0.6, 0), GM.yellow]);
  L.push([at(box(1.2, 0.06, 7.6), 0, 1.0, 0, -0.32), GM.belt]);
  for (const s of [-1, 1]) L.push([at(box(0.06, 0.2, 7.6), s * 0.62, 1.1, 0, -0.32), GM.metal]);
  L.push([at(box(0.9, 1.3, 1.0), 0.0, 1.35, 2.6), GM.yellow]); L.push([at(box(0.85, 0.5, 0.04), 0, 1.75, 2.08), GM.glass]);
  wheels(L, [[-0.75, -2.5], [0.75, -2.5], [-0.75, 2.5], [0.75, 2.5]], 0.3, 0.22);
  return { geometry: finish(L), colliders: [{ min: [-0.85, 0, -3.6], max: [0.85, 1.4, 3.6] }] };
}
// ---------------------------------------------------------------- ground power unit
export function buildGPU() {
  const L = [];
  L.push([at(box(1.3, 1.1, 2.0, 1), 0, 0.85, 0), GM.white]);
  L.push([at(box(1.32, 0.12, 2.02), 0, 1.4, 0), GM.red]);
  for (let k = 0; k < 6; k++) L.push([at(box(0.02, 0.6, 0.05), 0.66, 0.9, -0.6 + k * 0.24), GM.dark]);
  L.push([strut([0, 0.4, -1.0], [0, 0.3, -1.8], 0.04), GM.metal]);
  wheels(L, [[-0.55, -0.6], [0.55, -0.6], [-0.55, 0.6], [0.55, 0.6]], 0.25, 0.16);
  return { geometry: finish(L), colliders: [{ min: [-0.7, 0, -1.05], max: [0.7, 1.45, 1.05] }] };
}
// ---------------------------------------------------------------- cone, chock, light mast, sign, blast fence
export function buildCone() {
  const L = [];
  L.push([at(cyl(0.03, 0.17, 0.7, 12), 0, 0.37, 0), GM.orange]);
  L.push([at(cyl(0.08, 0.11, 0.1, 12, true), 0, 0.45, 0), GM.white]);
  L.push([at(box(0.42, 0.04, 0.42), 0, 0.02, 0), GM.orange]);
  return { geometry: finish(L), colliders: [] };
}
export function buildMast() {
  const L = [];
  L.push([at(cyl(0.18, 0.32, 24, 10), 0, 12, 0), GM.metal]);
  L.push([at(box(3.6, 0.3, 0.3), 0, 24, 0), GM.metal]);
  for (let k = 0; k < 4; k++) L.push([at(box(0.7, 0.35, 0.5), -1.35 + k * 0.9, 23.65, -0.1, 0.35), GM.dark]);
  L.push([at(box(0.8, 0.4, 0.8), 0, 0.2, 0), GM.hazard]);
  return { geometry: finish(L), colliders: [{ min: [-0.4, 0, -0.4], max: [0.4, 24, 0.4] }], lamps: [-1.35, -0.45, 0.45, 1.35].map(x => new THREE.Vector3(x, 23.45, -0.25)) };
}
export function buildSign(row = 0) {
  const L = [];
  const face = new THREE.PlaneGeometry(3.6, 0.9); const uv = face.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (row + (1 - uv.getY(i))) / SIGN_ROWS);
  L.push([at(face.clone(), 0, 0.85, -0.16, 0, Math.PI), GM.text]);
  L.push([at(face, 0, 0.85, 0.16), GM.text]);
  L.push([at(box(3.7, 1.0, 0.3), 0, 0.85, 0), GM.dark]);
  for (const x of [-1.5, 1.5]) L.push([at(box(0.12, 0.45, 0.12), x, 0.2, 0), GM.metal]);
  return { geometry: finish(L), colliders: [{ min: [-1.85, 0, -0.2], max: [1.85, 1.35, 0.2] }] };
}
export function buildBlastFence() {
  const L = [];
  for (let k = 0; k < 8; k++) L.push([at(box(2.4, 4.2, 0.06, 1), -8.4 + k * 2.4, 2.1, 0, -0.42), k % 2 ? GM.white : GM.red]);
  for (let k = 0; k <= 8; k++) L.push([strut([-9.6 + k * 2.4, 0, 0.9], [-9.6 + k * 2.4, 3.9, -0.8], 0.06), GM.metal]);
  return { geometry: finish(L), colliders: [{ min: [-9.6, 0, -0.9], max: [9.6, 4, 0.9] }] };
}
