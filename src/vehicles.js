import * as THREE from 'three';
import { box, at, cyl, merge, mergeGrouped, mergeGeometries } from './geom.js';
import { crackedGlassTexture, bulletHoleTexture, concreteTexture, metalTexture, blobShadowTexture } from './textures.js';
import { makeRng, rand } from './rng.js';

// ---------- shared materials ----------
export const MAT = {};
export function initMaterials() {
  MAT.paintBlack = new THREE.MeshStandardMaterial({ color: 0x121317, metalness: 0.4, roughness: 0.17, envMapIntensity: 1.8 });
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.65, roughness: 0.04, envMapIntensity: 2.2 });
  MAT.glassCracked = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.6, roughness: 0.3, envMapIntensity: 1.2, emissiveMap: crackedGlassTexture(), emissive: 0x8892a0, emissiveIntensity: 0.3 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, metalness: 1.0, roughness: 0.12, envMapIntensity: 1.8 });
  MAT.plastic = new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.1, roughness: 0.7 });
  MAT.headlight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 3.0, roughness: 0.2 });
  MAT.taillight = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a0a, emissiveIntensity: 2.4, roughness: 0.3 });
  MAT.tire = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.0, roughness: 0.92 });
  MAT.rim = new THREE.MeshStandardMaterial({ color: 0xc4c8cf, metalness: 1.0, roughness: 0.18, envMapIntensity: 2.0 });
  MAT.charred = new THREE.MeshStandardMaterial({ color: 0x0e0b09, metalness: 0.3, roughness: 0.85, emissive: 0x2a0a00, emissiveIntensity: 0.6 });
  MAT.underbody = new THREE.MeshStandardMaterial({ color: 0x1b1a19, metalness: 0.4, roughness: 0.8 });
  // player truck
  MAT.paintRed = new THREE.MeshStandardMaterial({ color: 0x6e0f0b, metalness: 0.5, roughness: 0.3, envMapIntensity: 1.5 });
  const dp = diamondPlateTexture();
  MAT.diamond = new THREE.MeshStandardMaterial({ map: dp.map, normalMap: dp.normal, color: 0xb4b6ba, metalness: 0.85, roughness: 0.32, envMapIntensity: 1.3 });
  MAT.bedLiner = new THREE.MeshStandardMaterial({ color: 0x1d1c1b, metalness: 0.1, roughness: 0.85 });
  // people
  MAT.cloth = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.85 });
  MAT.vest = new THREE.MeshStandardMaterial({ color: 0x2d3126, roughness: 0.75 });
  MAT.skin = new THREE.MeshStandardMaterial({ color: 0x9a6a4e, roughness: 0.6 });
  MAT.mask = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.8 });
  MAT.gunMetal = new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: 0.75, roughness: 0.38 });
  MAT.lens = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 1, roughness: 0.05, envMapIntensity: 2.5 });
  // civilian paints
  MAT.civ = [0x7a7d80, 0xc9c5bb, 0x23396b, 0x8a6a2c, 0x2f5a3a, 0x9b1c1c, 0xe0dcd2, 0x3a3a3c].map(c => new THREE.MeshStandardMaterial({ color: c, metalness: 0.45, roughness: 0.32, envMapIntensity: 1.3 }));
  MAT.tank = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1.0, roughness: 0.18, envMapIntensity: 1.7 });
  MAT.blob = new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.75, polygonOffset: true, polygonOffsetFactor: -1 });
  MAT.hole = new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
}

function diamondPlateTexture() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a8c90'; ctx.fillRect(0, 0, S, S);
  const r = makeRng(77);
  for (let k = 0; k < 2500; k++) { ctx.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0.03)`; ctx.fillRect(r() * S, r() * S, 3, 3); }
  // height for normals
  const h = document.createElement('canvas'); h.width = h.height = S;
  const hc = h.getContext('2d'); hc.fillStyle = '#000'; hc.fillRect(0, 0, S, S);
  const step = 32;
  for (let y = 0; y < S + step; y += step) for (let x = 0; x < S + step; x += step) {
    for (const [ox, oy, ang] of [[0, 0, 0.785], [step / 2, step / 2, -0.785]]) {
      hc.save(); hc.translate(x + ox, y + oy); hc.rotate(ang);
      const g = hc.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#888'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, '#888');
      hc.fillStyle = g; hc.beginPath(); hc.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2); hc.fill(); hc.restore();
      ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(ang); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(0, -1, 9, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  const hd = hc.getImageData(0, 0, S, S).data;
  const nc = document.createElement('canvas'); nc.width = nc.height = S;
  const nctx = nc.getContext('2d'); const img = nctx.createImageData(S, S);
  const H = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let nx = (H(x - 1, y) - H(x + 1, y)) * 3, ny = (H(x, y - 1) - H(x, y + 1)) * 3, nz = 1; const l = Math.hypot(nx, ny, nz);
    const i = (y * S + x) * 4; img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(3, 3); map.anisotropy = 8;
  const normal = new THREE.CanvasTexture(nc); normal.wrapS = normal.wrapT = THREE.RepeatWrapping; normal.repeat.set(3, 3); normal.anisotropy = 8;
  return { map, normal };
}

// ---------- helpers ----------
function shapeFrom(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) s.quadraticCurveTo(p[2], p[3], p[0], p[1]); else s.lineTo(p[0], p[1]);
  }
  s.closePath();
  return s;
}
// extrude side profile (u = forward meters, v = up) across width; result: forward = -z
function sideExtrude(pts, width, bevel = 0.06, arches = null) {
  const s = shapeFrom(pts);
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.6, bevelSegments: 4, curveSegments: 10 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(Math.PI / 2);
  // ExtrudeGeometry has groups (caps/sides); drop them for merging
  g.clearGroups();
  return g;
}
function wheelGeometry(r = 0.42, w = 0.3, rimR = 0.27) {
  const tire = cyl(r, r, w, 20); tire.rotateZ(Math.PI / 2);
  const side1 = cyl(r * 0.96, r * 0.96, w + 0.02, 20); side1.rotateZ(Math.PI / 2); // slight sidewall
  const rim = cyl(rimR, rimR, w + 0.04, 16); rim.rotateZ(Math.PI / 2);
  const spokes = [];
  for (let k = 0; k < 5; k++) {
    const sp = box(0.05, rimR * 1.7, 0.07);
    sp.rotateX((k / 5) * Math.PI);
    sp.translate(0, 0, 0);
    spokes.push(at(sp, 0, 0, 0));
  }
  const hub = cyl(0.07, 0.07, w + 0.07, 10); hub.rotateZ(Math.PI / 2);
  const { geometry } = mergeGrouped([[tire, 0], [rim, 1], [hub, 1], ...spokes.map(s => { s.scale(w + 0.06, 1, 1); return [s, 1]; })], 2);
  return geometry;
}

function lightGlowSpots(list) { return list.map(([x, y, z, kind]) => ({ p: new THREE.Vector3(x, y, z), kind })); }

// ---------- side detail decals (panel gaps, trim highlight, road dust) ----------
function sideDetailTexture(kind, U0, U1, V0, V1, doors) {
  const W = 1024, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const X = (u) => (u - U0) / (U1 - U0) * W, Y = (v) => (V1 - v) / (V1 - V0) * H;
  ctx.clearRect(0, 0, W, H);
  // road dust / grime rising from the rocker
  const g = ctx.createLinearGradient(0, Y(V0), 0, Y(V0 + 0.42));
  g.addColorStop(0, 'rgba(118,94,68,0.75)'); g.addColorStop(1, 'rgba(118,94,68,0)');
  ctx.fillStyle = g; ctx.fillRect(0, Y(V0 + 0.42), W, Y(V0) - Y(V0 + 0.42));
  // speckle
  const r = makeRng(kind.length * 31);
  for (let k = 0; k < 900; k++) { const v = V0 + Math.pow(r(), 2.2) * 0.5; ctx.fillStyle = `rgba(${90 + r() * 50 | 0},${70 + r() * 40 | 0},${50 + r() * 30 | 0},${0.25 + r() * 0.4})`; ctx.fillRect(X(U0 + r() * (U1 - U0)), Y(v), 1 + r() * 2, 1 + r() * 2); }
  // shoulder highlight (fake clearcoat streak) + crease shadow just below it
  const sh = doors.shoulder;
  let lg = ctx.createLinearGradient(0, Y(sh + 0.05), 0, Y(sh - 0.03));
  lg.addColorStop(0, 'rgba(255,226,190,0)'); lg.addColorStop(0.5, 'rgba(255,226,190,0.35)'); lg.addColorStop(1, 'rgba(255,226,190,0)');
  ctx.fillStyle = lg; ctx.fillRect(X(doors.front + 0.9), Y(sh + 0.05), X(doors.rear - 0.9) - X(doors.front + 0.9), Y(sh - 0.03) - Y(sh + 0.05));
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X(doors.front + 0.9), Y(sh - 0.035), X(doors.rear - 0.9) - X(doors.front + 0.9), 3);
  // panel gaps: door shut lines with a lit lip
  const line = (u0, v0, u1, v1) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.95)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(u0), Y(v0)); ctx.lineTo(X(u1), Y(v1)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,235,210,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(u0) + 2, Y(v0) + 1); ctx.lineTo(X(u1) + 2, Y(v1) + 1); ctx.stroke();
  };
  for (const u of doors.cuts) line(u, doors.bottom, u + 0.03, doors.top);
  line(doors.cuts[0], doors.bottom, doors.cuts[doors.cuts.length - 1], doors.bottom);
  // fuel door + side marker + badge
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(X(doors.fuel), Y(doors.top - 0.12), 26, 22);
  ctx.fillStyle = 'rgba(255,140,40,0.9)'; ctx.fillRect(X(doors.front + 0.75), Y(doors.bottom + 0.35), 18, 7);
  ctx.fillStyle = 'rgba(220,220,225,0.85)'; ctx.font = '600 15px Oswald, sans-serif'; ctx.fillText(kind === 'suv' ? 'ESCALATOR V8' : 'CRUISER', X(doors.front - 0.35), Y(doors.bottom + 0.2));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.repeat.set(1 / (U1 - U0), 1 / (V1 - V0)); t.offset.set(-U0 / (U1 - U0), -V0 / (V1 - V0));
  return t;
}
function sideDecal(profile, W, tex) {
  const shape = shapeFrom(profile);
  const parts = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.ShapeGeometry(shape, 8);
    g.rotateY(Math.PI / 2);
    if (sx < 0) g.scale(-1, 1, 1);
    g.translate(sx * (W / 2 + 0.004), 0, 0);
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return { geo, mat };
}

// ---------- SUV (Bay black SUV) ----------
let suvCache = null;
export function buildSUV() {
  if (!suvCache) {
    const L = 5.3, W = 2.0;
    const fa = 1.6, ra = -1.62, ar = 0.53, base = 0.42;
    const arch = (cx) => {
      const out = [];
      for (let k = 0; k <= 10; k++) { const a = Math.PI - (k / 10) * Math.PI; out.push([cx + Math.cos(a) * ar, base + Math.sin(a) * ar * 0.95]); }
      return out;
    };
    const lower = [
      [-2.65, 0.5], [-2.65, 1.14], [-1.0, 1.17], [1.25, 1.17], [2.45, 1.08], [2.66, 0.98], [2.68, 0.55], [2.62, base],
      ...arch(fa).reverse(), [ra + ar, base], ...arch(ra).reverse(), [-2.6, base],
    ];
    // fix ordering: we built in CCW from rear-bottom; arches go right-to-left along the bottom
    const lowerPts = [[-2.65, 0.5], [-2.66, 1.14], [-1.0, 1.18], [1.25, 1.18], [2.45, 1.09], [2.66, 0.98], [2.69, 0.55], [2.6, base]];
    // bottom edge from front to rear with arches
    const fArch = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; fArch.push([fa + Math.cos(a) * ar, base + Math.sin(a) * ar]); }
    const rArch = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; rArch.push([ra + Math.cos(a) * ar, base + Math.sin(a) * ar]); }
    const lowerFull = [...lowerPts, ...fArch, ...rArch, [-2.6, base]];
    void lower;
    const body = sideExtrude(lowerFull, W, 0.13);
    const glass = sideExtrude([[1.3, 1.16], [0.45, 1.84], [-2.42, 1.87], [-2.58, 1.16]], W - 0.16, 0.04);
    const roof = sideExtrude([[0.48, 1.83], [0.42, 1.9], [-2.44, 1.94], [-2.47, 1.86]], W - 0.1, 0.03);
    const parts = [[body, 0], [glass, 1], [roof, 0]];
    // pillars (body color) on both sides
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.085);
      parts.push([at(box(0.05, 0.7, 0.16), x, 1.52, 0.75), 0]);   // B pillar
      parts.push([at(box(0.05, 0.7, 0.18), x, 1.52, 1.75), 0]);   // C pillar
      parts.push([at(box(0.05, 0.72, 0.2), x, 1.52, 2.45), 0]);   // D pillar
      // chrome belt trim
      parts.push([at(box(0.03, 0.035, 3.85), sx * (W / 2 + 0.005), 1.17, 0.55), 2]);
      // door handles
      parts.push([at(box(0.03, 0.04, 0.18), sx * (W / 2 + 0.01), 1.0, -0.2), 2]);
      parts.push([at(box(0.03, 0.04, 0.18), sx * (W / 2 + 0.01), 1.0, 0.95), 2]);
      // mirrors
      parts.push([at(box(0.22, 0.16, 0.12), sx * (W / 2 + 0.12), 1.28, -1.05), 0]);
      // side step
      parts.push([at(box(0.2, 0.06, 2.6), sx * (W / 2 + 0.04), 0.48, 0.0), 3]);
      // wheel arch flares (dark)
    }
    // front: chrome grille, bumper, lights
    parts.push([at(box(1.25, 0.42, 0.06), 0, 0.84, -2.7), 2]);
    for (let k = 0; k < 4; k++) parts.push([at(box(1.2, 0.035, 0.05), 0, 0.68 + k * 0.1, -2.73), 3]);
    parts.push([at(box(2.0, 0.26, 0.2), 0, 0.5, -2.68), 3]);
    // push bar (menacing)
    parts.push([at(box(1.5, 0.08, 0.08), 0, 0.85, -2.92), 3]);
    parts.push([at(box(1.5, 0.08, 0.08), 0, 0.55, -2.92), 3]);
    parts.push([at(box(0.08, 0.5, 0.08), -0.6, 0.7, -2.9), 3]);
    parts.push([at(box(0.08, 0.5, 0.08), 0.6, 0.7, -2.9), 3]);
    for (const sx of [-1, 1]) {
      parts.push([at(box(0.4, 0.2, 0.05), sx * 0.8, 0.98, -2.665), 2]);          // chrome bezel
      parts.push([at(box(0.15, 0.11, 0.06), sx * 0.72, 0.99, -2.69), 4]);       // projector
      parts.push([at(box(0.13, 0.08, 0.06), sx * 0.89, 0.99, -2.69), 4]);
      parts.push([at(box(0.36, 0.025, 0.06), sx * 0.8, 0.885, -2.69), 4]);      // DRL strip
      parts.push([at(box(0.2, 0.08, 0.05), sx * 0.72, 0.56, -2.79), 4]);        // fog lights
    }
    // grille mesh backing
    parts.push([at(box(1.15, 0.36, 0.04), 0, 0.84, -2.66), 6]);
    // rear: taillights, bumper
    for (const sx of [-1, 1]) parts.push([at(box(0.12, 0.42, 0.06), sx * 0.88, 1.0, 2.66), 5]);
    parts.push([at(box(2.0, 0.25, 0.18), 0, 0.5, 2.66), 3]);
    // roof rails
    for (const sx of [-1, 1]) parts.push([at(box(0.05, 0.05, 2.4), sx * 0.75, 1.98, 0.9), 3]);
    // underbody
    parts.push([at(box(1.8, 0.2, 4.6), 0, 0.42, 0), 6]);
    // two-tone lower cladding + fender flares (break up the black slab)
    for (const sx of [-1, 1]) {
      parts.push([at(box(0.05, 0.2, 1.7), sx * (W / 2 + 0.01), 0.62, 0.0), 3]);
      for (const az of [-fa, -ra]) {
        const fl = new THREE.TorusGeometry(ar + 0.04, 0.07, 6, 12, Math.PI); fl.scale(1, 1, 0.9);
        fl.rotateY(Math.PI / 2);
        parts.push([at(fl, sx * (W / 2 + 0.0), base, az), 3]);
      }
    }
    // rear spoiler + hatch glass trim
    parts.push([at(box(1.7, 0.05, 0.25), 0, 1.95, 2.42), 3]);
    // tinted strip at the top of the windshield
    const { geometry } = mergeGrouped(parts, 7);
    const dt = sideDetailTexture('suv', -2.8, 2.8, 0.3, 1.3, { cuts: [1.24, -0.16, -1.52], bottom: 0.5, top: 1.17, shoulder: 1.1, front: 1.24, rear: -1.52, fuel: -2.15 });
    const decal = sideDecal(lowerFull, W, dt);
    suvCache = { decal, geometry, wheel: wheelGeometry(0.43, 0.3), wheelPos: [[-0.86, 0.43, -fa], [0.86, 0.43, -fa], [-0.86, 0.43, -ra], [0.86, 0.43, -ra]], half: [1.0, 0.95, 2.68], lights: lightGlowSpots([[-0.8, 0.98, -2.75, 'head'], [0.8, 0.98, -2.75, 'head'], [-0.88, 1.0, 2.72, 'tail'], [0.88, 1.0, 2.72, 'tail']]) };
  }
  return instantiate(suvCache, [MAT.paintBlack, MAT.glass, MAT.chrome, MAT.plastic, MAT.headlight, MAT.taillight, MAT.underbody]);
}

let sedanCache = null;
export function buildSedan(paint) {
  if (!sedanCache) {
    const W = 1.82, base = 0.34, ar = 0.42, fa = 1.42, ra = -1.38;
    const fArch = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; fArch.push([fa + Math.cos(a) * ar, base + Math.sin(a) * ar]); }
    const rArch = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; rArch.push([ra + Math.cos(a) * ar, base + Math.sin(a) * ar]); }
    const lower = [[-2.35, 0.45], [-2.4, 0.86], [-2.0, 0.98], [0.9, 0.98], [2.2, 0.82], [2.38, 0.68], [2.4, 0.45], [2.3, base], ...fArch, ...rArch, [-2.3, base]];
    const body = sideExtrude(lower, W, 0.14);
    const glass = sideExtrude([[0.95, 0.97], [0.05, 1.42], [-1.15, 1.44], [-1.95, 0.98]], W - 0.22, 0.05);
    const parts = [[body, 0], [glass, 1]];
    for (const sx of [-1, 1]) {
      parts.push([at(box(0.05, 0.42, 0.1), sx * (W / 2 - 0.12), 1.2, 0.5), 0]);
      parts.push([at(box(0.2, 0.12, 0.1), sx * (W / 2 + 0.08), 1.05, -0.85), 0]);
    }
    parts.push([at(box(1.82, 0.22, 0.14), 0, 0.45, -2.38), 3]);
    parts.push([at(box(1.82, 0.22, 0.14), 0, 0.45, 2.38), 3]);
    parts.push([at(box(0.9, 0.18, 0.04), 0, 0.66, -2.41), 2]);
    for (const sx of [-1, 1]) parts.push([at(box(0.36, 0.12, 0.05), sx * 0.66, 0.74, -2.39), 4]);
    for (const sx of [-1, 1]) parts.push([at(box(0.4, 0.14, 0.05), sx * 0.62, 0.8, 2.39), 5]);
    parts.push([at(box(1.6, 0.18, 4.0), 0, 0.36, 0), 6]);
    const { geometry } = mergeGrouped(parts, 7);
    const dts = sideDetailTexture('sedan', -2.5, 2.5, 0.25, 1.05, { cuts: [0.88, -0.25, -1.3], bottom: 0.42, top: 0.97, shoulder: 0.92, front: 0.88, rear: -1.3, fuel: -1.9 });
    const decal = sideDecal(lower, W, dts);
    sedanCache = { decal, geometry, wheel: wheelGeometry(0.34, 0.24, 0.22), wheelPos: [[-0.8, 0.34, -fa], [0.8, 0.34, -fa], [-0.8, 0.34, -ra], [0.8, 0.34, -ra]], half: [0.91, 0.72, 2.4], lights: lightGlowSpots([[-0.66, 0.74, -2.45, 'head'], [0.66, 0.74, -2.45, 'head'], [-0.62, 0.8, 2.45, 'tail'], [0.62, 0.8, 2.45, 'tail']]) };
  }
  return instantiate(sedanCache, [paint, MAT.glass, MAT.chrome, MAT.plastic, MAT.headlight, MAT.taillight, MAT.underbody]);
}

let tankerCache = null;
export function buildTanker() {
  if (!tankerCache) {
    const parts = [];
    // cab (front) — classic long-nose
    const cabW = 2.4;
    const hood = sideExtrude([[4.2, 1.05], [4.2, 2.1], [6.3, 1.95], [6.45, 1.4], [6.45, 1.05]], cabW - 0.2, 0.1);
    const cab = sideExtrude([[2.3, 1.05], [2.3, 3.3], [3.0, 3.55], [4.25, 3.4], [4.3, 2.15], [4.3, 1.05]], cabW, 0.08);
    const glass = sideExtrude([[4.05, 2.35], [3.95, 3.25], [3.0, 3.38], [2.5, 3.2], [2.5, 2.35]], cabW + 0.04, 0.02);
    parts.push([hood, 0], [cab, 0], [glass, 1]);
    parts.push([at(box(1.9, 1.0, 0.1), 0, 1.6, -6.5), 2]); // big chrome grille
    parts.push([at(box(2.5, 0.4, 0.3), 0, 0.95, -6.55), 2]); // bumper
    for (const sx of [-1, 1]) {
      parts.push([at(cyl(0.12, 0.12, 2.8, 10), sx * 1.3, 3.0, -2.7), 2]); // exhaust stacks
      parts.push([at(box(0.3, 0.22, 0.08), sx * 0.9, 1.75, -6.5), 4]);
    }
    // frame
    parts.push([at(box(1.4, 0.35, 15.5), 0, 0.9, 0.9), 3]);
    // tank
    const tank = new THREE.CapsuleGeometry(1.25, 9.2, 6, 20); tank.rotateX(Math.PI / 2); tank.scale(1, 0.92, 1);
    parts.push([at(tank, 0, 2.45, 3.8), 7]);
    for (let k = 0; k < 5; k++) parts.push([at(cyl(1.27, 1.27, 0.12, 20), 0, 2.45, -0.6 + k * 2.2, Math.PI / 2, 0, 0, 1), 3]);
    parts.push([at(box(0.6, 0.3, 9.0), 0, 3.62, 3.8), 3]); // catwalk
    // placard
    parts.push([at(box(0.02, 0.9, 1.6), 1.24, 2.4, 8.2), 8]);
    parts.push([at(box(0.02, 0.9, 1.6), -1.24, 2.4, 8.2), 8]);
    for (const sx of [-1, 1]) parts.push([at(box(0.2, 0.3, 0.06), sx * 1.0, 1.0, 9.85), 5]);
    const { geometry } = mergeGrouped(parts, 9);
    const wp = [];
    for (const z of [-5.4, -1.4, -0.2, 7.2, 8.4]) for (const sx of [-1, 1]) wp.push([sx * 1.05, 0.52, z]);
    tankerCache = { geometry, wheel: wheelGeometry(0.52, 0.5, 0.3), wheelPos: wp, half: [1.3, 1.9, 8.2], centerOffsetZ: 1.5, lights: lightGlowSpots([[-0.9, 1.75, -6.6, 'head'], [0.9, 1.75, -6.6, 'head'], [-1.0, 1.0, 9.9, 'tail'], [1.0, 1.0, 9.9, 'tail']]) };
    const c = document.createElement('canvas'); c.width = 256; c.height = 160;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#d9241a'; ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = '#fff'; ctx.font = '400 54px Anton, Impact'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FLAMMABLE', 128, 64);
    ctx.font = '600 34px Oswald'; ctx.fillText('1203', 128, 124);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    MAT.placard = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.15 });
    MAT.truckCab = new THREE.MeshStandardMaterial({ color: 0x1f2f58, metalness: 0.5, roughness: 0.28, envMapIntensity: 1.5 });
  }
  return instantiate(tankerCache, [MAT.truckCab, MAT.glass, MAT.chrome, MAT.plastic, MAT.headlight, MAT.taillight, MAT.underbody, MAT.tank, MAT.placard]);
}

// Player pickup: viewed from inside the bed — must look good up close.
export function buildPickup() {
  const W = 2.05, base = 0.45, ar = 0.5, fa = -2.15, ra = 1.35; // u forward is negative z later; here u>0 forward
  const parts = [];
  const fArch = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; fArch.push([2.15 + Math.cos(a) * ar, base + Math.sin(a) * ar]); }
  const rArch = []; for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; rArch.push([-1.35 + Math.cos(a) * ar, base + Math.sin(a) * ar]); }
  // cab + hood lower body from u=-0.15 (back of cab) to 3.0 (front)
  const cabLower = sideExtrude([[-0.2, 0.55], [-0.2, 1.2], [1.4, 1.22], [2.75, 1.15], [3.0, 1.0], [3.02, 0.55], [2.9, base], ...fArch, [-0.2, base]], W, 0.07);
  const cabGlass = sideExtrude([[1.45, 1.2], [0.75, 1.9], [-0.1, 1.92], [-0.15, 1.2]], W - 0.16, 0.04);
  const cabRoof = sideExtrude([[0.78, 1.88], [0.72, 1.95], [-0.15, 1.97], [-0.18, 1.88]], W - 0.1, 0.03);
  parts.push([cabLower, 0], [cabGlass, 1], [cabRoof, 0]);
  // bed: floor + walls, from u=-0.25 back to u=-2.6
  const bedLen = 2.35, bz0 = 0.25, bz1 = bz0 + bedLen; // z positive = rear
  parts.push([at(box(W - 0.2, 0.06, bedLen, 0), 0, 0.88, (bz0 + bz1) / 2), 7]); // bed floor diamond plate
  for (const sx of [-1, 1]) {
    // side walls with rounded top rail
    parts.push([at(box(0.1, 0.42, bedLen), sx * (W / 2 - 0.05), 1.06, (bz0 + bz1) / 2), 0]);
    parts.push([at(box(0.16, 0.05, bedLen), sx * (W / 2 - 0.05), 1.29, (bz0 + bz1) / 2), 0]);
    // outer body below wall
    parts.push([at(box(0.08, 0.5, bedLen + 0.05), sx * (W / 2 - 0.02), 0.66, (bz0 + bz1) / 2), 0]);
    // inner wall liner
    parts.push([at(box(0.02, 0.4, bedLen - 0.05), sx * (W / 2 - 0.115), 1.08, (bz0 + bz1) / 2), 8]);
    // stake pockets
    for (const zz of [bz0 + 0.2, bz1 - 0.2]) parts.push([at(box(0.1, 0.02, 0.1), sx * (W / 2 - 0.05), 1.32, zz), 3]);
  }
  // front bed wall (behind cab)
  parts.push([at(box(W - 0.1, 0.42, 0.08), 0, 1.06, bz0 + 0.02), 0]);
  // tailgate
  parts.push([at(box(W - 0.05, 0.5, 0.08), 0, 1.03, bz1), 0]);
  parts.push([at(box(W - 0.05, 0.06, 0.12), 0, 1.3, bz1), 3]);
  parts.push([at(box(0.3, 0.06, 0.03), 0, 1.15, bz1 - 0.05), 2]);
  // rear lights + bumper
  for (const sx of [-1, 1]) parts.push([at(box(0.1, 0.36, 0.05), sx * 0.95, 1.05, bz1 + 0.05), 5]);
  parts.push([at(box(W, 0.2, 0.22), 0, 0.5, bz1 + 0.1), 2]);
  // roll bar (chrome) with light pods
  for (const sx of [-1, 1]) parts.push([at(cyl(0.04, 0.04, 0.72, 10), sx * 0.86, 1.62, bz0 + 0.12), 2]);
  parts.push([at(cyl(0.04, 0.04, 1.76, 10), 0, 1.98, bz0 + 0.12, 0, 0, Math.PI / 2), 2]);
  for (const sx of [-1, 1]) parts.push([at(cyl(0.035, 0.035, 0.62, 8), sx * 0.86, 1.56, bz0 + 0.38, 0.95, 0, 0), 2]);
  parts.push([at(box(1.3, 0.07, 0.08), 0, 2.04, bz0 + 0.12), 3]);
  parts.push([at(box(1.24, 0.045, 0.01), 0, 2.04, bz0 + 0.075), 4]);
  // cab rear window frame + mirrors
  for (const sx of [-1, 1]) parts.push([at(box(0.22, 0.16, 0.12), sx * (W / 2 + 0.12), 1.32, -1.2), 0]);
  // front grille + bumper
  parts.push([at(box(1.4, 0.36, 0.05), 0, 0.84, -3.04), 2]);
  parts.push([at(box(W, 0.24, 0.2), 0, 0.5, -3.0), 2]);
  for (const sx of [-1, 1]) parts.push([at(box(0.32, 0.14, 0.05), sx * 0.78, 0.98, -3.03), 4]);
  // spare tire & ammo crate & jerry can in the bed (props sell the space)
  parts.push([at(box(0.55, 0.3, 0.38), -0.62, 1.06, bz1 - 0.38), 9]);
  parts.push([at(box(0.48, 0.04, 0.34), -0.62, 1.22, bz1 - 0.38), 3]);
  parts.push([at(box(0.18, 0.4, 0.32), 0.78, 1.11, bz0 + 0.32), 10]);
  parts.push([at(box(1.85, 0.25, 4.6), 0, 0.45, -0.6), 6]);
  const { geometry } = mergeGrouped(parts, 11);
  const crate = new THREE.MeshStandardMaterial({ color: 0x3f4a2a, roughness: 0.8 });
  const jerry = new THREE.MeshStandardMaterial({ color: 0x8a1a12, roughness: 0.5, metalness: 0.3 });
  const mesh = new THREE.Mesh(geometry, [MAT.paintRed, MAT.glass, MAT.chrome, MAT.plastic, MAT.headlight, MAT.taillight, MAT.underbody, MAT.diamond, MAT.bedLiner, crate, jerry]);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const root = new THREE.Group(); root.add(mesh);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 6.6), MAT.blob); blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.03, -0.3); root.add(blob);
  const wheelGeo = wheelGeometry(0.44, 0.32);
  const wheels = [];
  for (const [x, z] of [[-0.88, -2.15], [0.88, -2.15], [-0.88, 1.35], [0.88, 1.35]]) {
    const w = new THREE.Mesh(wheelGeo, [MAT.tire, MAT.rim]); w.position.set(x, 0.44, z); w.castShadow = true; root.add(w); wheels.push(w);
  }
  // driver silhouette behind the rear glass
  const driver = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), MAT.skin); head.position.set(-0.45, 1.62, -0.55);
  const torso = new THREE.Mesh(box(0.42, 0.5, 0.28), MAT.cloth); torso.position.set(-0.45, 1.28, -0.5);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.plastic); cap.position.set(-0.45, 1.66, -0.55);
  driver.add(head, torso, cap);
  root.add(driver);
  return { root, mesh, wheels, bed: { z0: bz0, z1: bz1, floorY: 0.91, halfW: W / 2 - 0.12 }, driver };
}

function instantiate(cache, mats) {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(cache.geometry, mats.slice());
  mesh.castShadow = true; mesh.receiveShadow = false;
  root.add(mesh);
  const wheels = cache.wheelPos.map(([x, y, z]) => {
    const w = new THREE.Mesh(cache.wheel, [MAT.tire, MAT.rim]);
    w.position.set(x, y, z); w.castShadow = true;
    if (x < 0) w.rotation.y = Math.PI;
    root.add(w);
    return w;
  });
  let decal = null;
  if (cache.decal) { decal = new THREE.Mesh(cache.decal.geo, cache.decal.mat); decal.renderOrder = 2; root.add(decal); }
  // contact shadow (grounds the car even outside the shadow-map range)
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(cache.half[0] * 2.6, cache.half[2] * 2.3), MAT.blob);
  blob.rotation.x = -Math.PI / 2; blob.position.set(0, 0.03, cache.centerOffsetZ || 0);
  blob.renderOrder = 1;
  root.add(blob);
  // bullet holes
  const holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.14), MAT.hole, 24);
  holes.count = 0; holes.frustumCulled = false;
  root.add(holes);
  return { root, mesh, wheels, blob, decal, half: new THREE.Vector3(...cache.half), lights: cache.lights, holes, holeN: 0, wheelPos: cache.wheelPos, centerOffsetZ: cache.centerOffsetZ || 0 };
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _s = new THREE.Vector3(1, 1, 1);
export function addBulletHole(v, localPoint, localNormal) {
  _q.setFromUnitVectors(_z, localNormal);
  _m.compose(localPoint.clone().addScaledVector(localNormal, 0.01), _q, _s.setScalar(0.6 + rand() * 0.6));
  const i = v.holeN % 24;
  v.holes.setMatrixAt(i, _m);
  v.holeN++;
  v.holes.count = Math.min(24, v.holeN);
  v.holes.instanceMatrix.needsUpdate = true;
}
