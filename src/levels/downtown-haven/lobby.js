// =====================================================================================
//  HAVEN TRUST podium (lot R5): double-height glass-and-marble corporate lobby.
//  x ∈ [16, 50], z ∈ [-128, -80], y 0 … 14 (the tower builder stacks on top from y = 14).
//  Avenue facade on the x = 16 plane; glass is exported as `panes` (the game renders/shatters it).
//  Everything procedural: 5 canvases (marble, travertine, walnut, brushed metal, sign atlas).
// =====================================================================================
import * as THREE from 'three';
import { box, at, merge, tint, profileStrip } from '../../geom.js';
import { makeCanvas, canvasTex, metalTexture } from '../../textures.js';
import { makeRng } from '../../rng.js';
import { SUN_DIR, duskShared } from '../../atmosphere.js';
import { LOBBY } from './layout.js';

const X0 = 16, X1 = 42, XB = 50, Z0 = -126, Z1 = -82, ZL0 = -128, ZL1 = -80;
const FY = LOBBY.floorY, CY = LOBBY.ceilY, RY = LOBBY.roofY;
const SKY = LOBBY.sky;
const MEZ = { x0: 36, y: 5.0, top: 5.15 };
const TIER = { base: 0.45, mid: 4.6, head: 9.3 };
const DOORS = LOBBY.doors.map(([a, b]) => [Math.min(a, b), Math.max(a, b)]);  // [z0, z1]

// ---------------------------------------------------------------- tileable noise
function makeTileNoise(seed) {
  const r = makeRng(seed), N = 256, lat = new Float32Array(N * N);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  return (x, y, P) => {            // lattice wraps every P cells -> tileable over [0,P)
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
    const a = lat[y0 * N + x0], b = lat[y0 * N + x1], c = lat[y1 * N + x0], d = lat[y1 * N + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbmT(n, u, v, fx, fy, oct = 4) {
  let s = 0, a = 0.5, nm = 0;
  for (let o = 0; o < oct; o++) { s += a * n(u * fx, v * fy, Math.max(1, Math.round(fx))); nm += a; a *= 0.5; fx *= 2; fy *= 2; }
  return s / nm;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- textures
// Polished cream marble, 1024 px = 4.8 m: 4x4 slabs of 1.2 m (each slab its own vein run), thin joints,
// a dark emperador border band with a brass fillet on the texture edges (=> band grid every 4.8 m).
function marbleTexture() {
  const S = 1024, c = makeCanvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const n = makeTileNoise(41), n2 = makeTileNoise(42), r = makeRng(43);
  const slabs = []; for (let i = 0; i < 16; i++) slabs.push({ ph: r() * 6.28, b: 0.95 + r() * 0.07, dir: r() < 0.5, f: 1.2 + r() * 0.8 });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, p = slabs[(y >> 8) * 4 + (x >> 8)];
    const w = fbmT(n, u, v, 4, 4, 4), w2 = fbmT(n2, u, v, 8, 8, 3);
    const a = p.dir ? (u * 2 + v) : (u - v * 2);
    const ph = a * Math.PI * 2 * p.f + w * 10 + p.ph;
    const sv = Math.abs(Math.sin(ph));
    const vein = (1 - sstep(0.0, 0.05, sv)) * 0.32 + (1 - sstep(0.0, 0.45, sv)) * 0.16;
    const vein2 = (1 - sstep(0.0, 0.04, Math.abs(Math.sin(ph * 2.3 + w2 * 16)))) * 0.12 * w;
    const cloud = (w2 - 0.5) * 0.22 + (w - 0.5) * 0.14;
    const k = (vein + vein2) * (0.6 + w2 * 0.8);
    let R = (236 * (1 + cloud)) * p.b, G = (224 * (1 + cloud)) * p.b, B = (202 * (1 + cloud * 1.2)) * p.b;
    R = R * (1 - k) + 168 * k; G = G * (1 - k) + 146 * k; B = B * (1 - k) + 116 * k;
    const lx = x & 255, ly = y & 255;
    if (lx < 2 || ly < 2) { R *= 0.78; G *= 0.76; B *= 0.74; }
    const e = Math.min(x, y, S - 1 - x, S - 1 - y);
    if (e < 18) {               // emperador band
      const dv = 1 - sstep(0, 0.07, Math.abs(Math.sin(ph * 1.7 + w2 * 9)));
      R = 64 + dv * 70 + cloud * 60; G = 44 + dv * 52 + cloud * 40; B = 32 + dv * 38 + cloud * 30;
    } else if (e < 21) { R = 214; G = 168; B = 92; }   // brass fillet
    const i = (y * S + x) * 4;
    d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTex(c, { aniso: 8 });
}
// Travertine ashlar, 512 px = 2.4 m: horizontal streaks, pores, 0.6 m courses with staggered 1.2 m joints.
function stoneTexture() {
  const S = 512, c = makeCanvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const n = makeTileNoise(51), n2 = makeTileNoise(52);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const st = fbmT(n, u, v, 4, 16, 4), bl = fbmT(n2, u, v, 4, 4, 3);
    const b = 0.9 + (st - 0.5) * 0.12 + (bl - 0.5) * 0.16;
    const i = (y * S + x) * 4;
    d[i] = 226 * b; d[i + 1] = 210 * b; d[i + 2] = 186 * b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const r = makeRng(53);
  for (let k = 0; k < 1400; k++) { ctx.fillStyle = `rgba(150,120,88,${0.15 + r() * 0.25})`; ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 1 + r() * 4, 0.6 + r() * 1.2, 0, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = 'rgba(96,80,64,0.5)';
  for (let row = 0; row < 4; row++) {
    const y = row * 128; ctx.fillRect(0, y, S, 2);
    const off = row % 2 ? 128 : 0;
    for (let x = off; x < S + 1; x += 256) ctx.fillRect(x % S, y, 2, 128);
  }
  ctx.fillStyle = 'rgba(255,248,236,0.18)'; for (let row = 0; row < 4; row++) ctx.fillRect(0, row * 128 + 2, S, 1);
  return canvasTex(c, { aniso: 8 });
}
// Walnut, 256 px = 1.2 m, grain along v.
function woodTexture() {
  const S = 256, c = makeCanvas(S, S), ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const n = makeTileNoise(61);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const w = fbmT(n, u, v, 4, 1, 4);
    const g = 0.5 + 0.5 * Math.sin((u * 26 + w * 3.2) * Math.PI * 2);
    const f = fbmT(n, u, v, 64, 4, 2);
    const b = 0.78 + g * 0.22 + (f - 0.5) * 0.18;
    const i = (y * S + x) * 4;
    d[i] = 122 * b; d[i + 1] = 74 * b; d[i + 2] = 44 * b; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTex(c, { aniso: 8 });
}
// Sign atlas (1024²): lettering, halo, emblem, lift indicator, monitor UI, glow, soft band, LED wall art.
const A = { LET: [0, 0, 1024, 160], HALO: [0, 160, 1024, 160], EMB: [0, 320, 256, 256], IND: [256, 320, 256, 128],
  MON: [256, 448, 256, 128], GLOW: [512, 320, 256, 256], BAND: [768, 320, 256, 64], LED: [0, 768, 1024, 256] };
const uvr = ([x, y, w, h], inset = 0) => [(x + inset) / 1024, 1 - (y + h - inset) / 1024, (x + w - inset) / 1024, 1 - (y + inset) / 1024];
function atlasTexture() {
  const c = makeCanvas(1024, 1024), x = c.getContext('2d');
  const FONT = (s) => `700 ${s}px Georgia, "Times New Roman", "DejaVu Serif", serif`;
  const fitText = (txt, maxW, size, track) => {
    x.font = FONT(size); x.letterSpacing = `${track}px`;
    const w = x.measureText(txt).width; return size * Math.min(1, maxW / w);
  };
  const drawLet = (oy, fill) => {
    const s = fitText('HAVEN TRUST', 960, 120, 22);
    x.font = FONT(s); x.letterSpacing = `${Math.round(s * 0.18)}px`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = fill;
    x.fillText('HAVEN TRUST', 512 + s * 0.09, oy + 82);
  };
  // lettering: white on transparent
  drawLet(0, '#ffffff');
  // halo: blurred copies
  x.save(); x.filter = 'blur(16px)'; drawLet(160, 'rgba(255,255,255,0.9)'); x.filter = 'blur(5px)'; drawLet(160, 'rgba(255,255,255,0.7)'); x.restore();
  x.letterSpacing = '0px';
  // emblem / compass rose (floor inlay + logo wall)
  {
    const [ex, ey] = A.EMB, cx = ex + 128, cy = ey + 128;
    const ring = (r, col) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill(); };
    ring(126, '#d2a65a'); ring(121, '#2a1d16'); ring(104, '#d2a65a'); ring(101, '#efe6d6');
    const star = (n, R, r0, rot, cA, cB) => {
      for (let i = 0; i < n; i++) {
        const a = rot + i * Math.PI * 2 / n, a1 = a - Math.PI / n, a2 = a + Math.PI / n;
        x.fillStyle = i % 2 ? cA : cB; x.beginPath(); x.moveTo(cx, cy);
        x.lineTo(cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.closePath(); x.fill();
        x.fillStyle = i % 2 ? cB : cA; x.beginPath(); x.moveTo(cx, cy);
        x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.lineTo(cx + Math.cos(a2) * r0, cy + Math.sin(a2) * r0); x.closePath(); x.fill();
      }
    };
    star(8, 78, 26, Math.PI / 8, '#8a6a4a', '#d9c7a8');
    star(4, 100, 30, -Math.PI / 2, '#1f1712', '#c9a060');
    ring(30, '#d2a65a'); ring(26, '#1f1712');
    x.fillStyle = '#e8c27a'; x.font = FONT(36); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', cx, cy + 2);
    x.fillStyle = '#2a1d16'; x.font = FONT(12);
    for (const [t, a] of [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]]) x.fillText(t, cx + Math.cos(a) * 112, cy + Math.sin(a) * 112);
  }
  // lift indicator
  {
    const [ix, iy, iw, ih] = A.IND;
    x.fillStyle = '#0c0a09'; x.fillRect(ix, iy, iw, ih);
    x.strokeStyle = '#b08850'; x.lineWidth = 6; x.strokeRect(ix + 3, iy + 3, iw - 6, ih - 6);
    x.fillStyle = '#ffb347'; x.shadowColor = '#ff9a30'; x.shadowBlur = 14;
    x.beginPath(); x.moveTo(ix + 50, iy + 92); x.lineTo(ix + 80, iy + 36); x.lineTo(ix + 110, iy + 92); x.closePath(); x.fill();
    x.font = '700 76px "DejaVu Sans Mono", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('24', ix + 175, iy + 68);
    x.shadowBlur = 0;
  }
  // monitor UI
  {
    const [mx, my, mw, mh] = A.MON;
    const g = x.createLinearGradient(mx, my, mx, my + mh); g.addColorStop(0, '#1b3d6e'); g.addColorStop(1, '#0a1730');
    x.fillStyle = g; x.fillRect(mx, my, mw, mh);
    x.fillStyle = '#2f6fbf'; x.fillRect(mx, my, mw, 16);
    x.fillStyle = '#cfe4ff'; for (let k = 0; k < 7; k++) x.fillRect(mx + 12, my + 26 + k * 13, 70 + (k * 37 % 60), 5);
    x.fillStyle = '#ffd36b'; for (let k = 0; k < 8; k++) { const h = 14 + (k * 29 % 50); x.fillRect(mx + 140 + k * 13, my + 112 - h, 9, h); }
    x.strokeStyle = '#7fd1ff'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k <= 10; k++) x.lineTo(mx + 140 + k * 10, my + 40 + Math.sin(k * 1.3) * 12); x.stroke();
  }
  // radial glow (alpha)
  {
    const [gx, gy] = A.GLOW, g = x.createRadialGradient(gx + 128, gy + 128, 0, gx + 128, gy + 128, 126);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(0.65, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(gx, gy, 256, 256);
  }
  // soft band across v (sun shafts)
  {
    const [bx, by, bw, bh] = A.BAND, g = x.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.25, 'rgba(255,255,255,0.7)'); g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(bx, by, bw, bh);
  }
  // LED wall art (tiles horizontally): navy-to-ember gradient, flowing gold ribbons, skyline, brand line
  {
    const [lx, ly, lw, lh] = A.LED;
    const g = x.createLinearGradient(0, ly, 0, ly + lh);
    g.addColorStop(0, '#0b1d44'); g.addColorStop(0.55, '#24407a'); g.addColorStop(0.8, '#c0582a'); g.addColorStop(1, '#ffb15a');
    x.fillStyle = g; x.fillRect(lx, ly, lw, lh);
    x.save(); x.beginPath(); x.rect(lx, ly, lw, lh); x.clip();
    x.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) {
      const m = 1 + (k % 3), ph = k * 1.7, amp = 26 + k * 7, y0 = ly + 70 + k * 18;
      x.strokeStyle = k % 2 ? 'rgba(255,190,90,0.55)' : 'rgba(120,200,255,0.4)'; x.lineWidth = 3 + (k % 3) * 4;
      x.beginPath();
      for (let s = 0; s <= 128; s++) { const px = lx + s * 8; x.lineTo(px, y0 + Math.sin(s / 128 * Math.PI * 2 * m + ph) * amp); }
      x.stroke();
    }
    x.globalCompositeOperation = 'source-over';
    const r = makeRng(71); x.fillStyle = 'rgba(8,10,24,0.85)';
    for (let px = 0; px < 1024;) { const w = 20 + r() * 46, h = 30 + r() * 90; x.fillRect(lx + px, ly + lh - h, w, h); px += w + 2; }
    x.fillStyle = 'rgba(255,214,140,0.9)';
    for (let k = 0; k < 260; k++) x.fillRect(lx + r() * 1024, ly + lh - r() * 80, 2, 3);
    x.font = FONT(64); x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '14px';
    x.shadowColor = 'rgba(255,170,60,0.9)'; x.shadowBlur = 18; x.fillStyle = '#fff3dc'; x.fillText('HAVEN TRUST', lx + 512, ly + 92);
    x.shadowBlur = 0; x.font = '600 24px "DejaVu Sans", sans-serif'; x.letterSpacing = '10px'; x.fillStyle = '#ffd59a';
    x.fillText('YOUR FUTURE  ·  SECURED', lx + 512, ly + 146); x.letterSpacing = '0px';
    x.fillStyle = 'rgba(0,0,0,0.28)'; for (let k = 0; k < lh; k += 4) x.fillRect(lx, ly + k, lw, 1); for (let k = 0; k < lw; k += 4) x.fillRect(lx + k, ly, 1, lh);
    x.restore();
  }
  const t = canvasTex(c, { repeat: false, aniso: 8 });
  return { tex: t, canvas: c };
}

// ---------------------------------------------------------------- geometry helpers
function quad(c, r, u, w, h, rect, col = null) {
  const [u0, v0, u1, v1] = rect;
  const hw = w / 2, hh = h / 2, P = [];
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.push(c[0] + r[0] * a * hw + u[0] * b * hh, c[1] + r[1] * a * hw + u[1] * b * hh, c[2] + r[2] * a * hw + u[2] * b * hh);
  const n = new THREE.Vector3(...r).cross(new THREE.Vector3(...u)).normalize();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  if (col) tint(g, ...col);
  return g;
}
function cylUV(r, h, seg, uvScale, open = true) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, open);
  const uv = g.attributes.uv, k = (2 * Math.PI * r) / uvScale, kv = h / uvScale;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * kv);
  return g;
}

// =====================================================================================
export async function buildLobby(ctx = {}) {
  const root = new THREE.Group(); root.name = 'havenTrustLobby';
  const colliders = [], panes = [];
  const rng = makeRng(0x4a7e);
  const L = { ceil: [], stone: [], bronze: [], steel: [], wood: [], misc: [], light: [], signs: [], letters: [], halo: [], led: [], glass: [], pools: [], shafts: [], inlay: [] };
  const W = [1, 1, 1], DARK = [0.3, 0.27, 0.25], CREAM = [1.0, 0.97, 0.92], PLASTER = [1.0, 0.99, 0.96], EXT = [0.9, 0.85, 0.78], GRAN = [0.2, 0.19, 0.2];
  const B = (list, x0, y0, z0, x1, y1, z1, col = W, uv = 2.4) => {
    const g = box(x1 - x0, y1 - y0, z1 - z0, uv); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    tint(g, ...col); list.push(g); return g;
  };
  const C = (x0, y0, z0, x1, y1, z1, kind, mat) => colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1], data: { kind, mat } });
  const BC = (list, x0, y0, z0, x1, y1, z1, col, kind, mat, uv) => { B(list, x0, y0, z0, x1, y1, z1, col, uv); C(x0, y0, z0, x1, y1, z1, kind, mat); };

  // ------------------------------------------------------------ textures & materials
  const marble = marbleTexture(), stoneT = stoneTexture(), woodT = woodTexture(), metalT = metalTexture(9);
  const { tex: atlas } = atlasTexture();
  atlas.wrapS = THREE.RepeatWrapping;   // only the LED row (full atlas width) ever samples outside [0,1] in u
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: marble, roughness: 0.13, metalness: 0, envMapIntensity: 1.5 }),
    inlay: new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.5, roughness: 0.12, envMapIntensity: 1.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneT, vertexColors: true, roughness: 0.42, metalness: 0, envMapIntensity: 0.7 }),
    bronze: new THREE.MeshStandardMaterial({ map: metalT, color: 0x8c7660, metalness: 0.8, roughness: 0.3, envMapIntensity: 1.3 }),
    steel: new THREE.MeshStandardMaterial({ map: metalT, color: 0xd8dce0, metalness: 0.7, roughness: 0.28, envMapIntensity: 1.3 }),
    wood: new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.42, metalness: 0, envMapIntensity: 0.6 }),
    ceil: new THREE.MeshStandardMaterial({ map: stoneT, color: 0xf4ece0, emissive: 0xb8a690, emissiveMap: stoneT, emissiveIntensity: 0.8, roughness: 0.6, envMapIntensity: 0.3 }),
    misc: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, envMapIntensity: 0.6 }),
    light: new THREE.MeshStandardMaterial({ color: 0xfff4e6, emissive: 0xffdcb0, emissiveIntensity: 2.6, roughness: 0.5 }),
    signs: new THREE.MeshStandardMaterial({ map: atlas, emissiveMap: atlas, emissive: 0xffffff, emissiveIntensity: 1.4, alphaTest: 0.5, roughness: 0.35 }),
    letters: new THREE.MeshStandardMaterial({ map: atlas, alphaTest: 0.5, color: 0xd9a565, metalness: 0.85, roughness: 0.28, emissive: 0xffb466, emissiveMap: atlas, emissiveIntensity: 0.45, envMapIntensity: 1.3, side: THREE.DoubleSide }),
    halo: new THREE.MeshBasicMaterial({ map: atlas, color: new THREE.Color(1.0, 0.62, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    led: new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 1.7, roughness: 0.22, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa8bcc0, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.6, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
    pools: new THREE.MeshBasicMaterial({ map: atlas, color: new THREE.Color(1.0, 0.78, 0.52).multiplyScalar(0.22), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    shafts: new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  };
  M.letters.userData.duskEmissive = 0.45;
  const canopyLight = M.light.clone(); canopyLight.color.set(0x2a2622); canopyLight.emissive.set(0xffc890); canopyLight.emissiveIntensity = 1.6; canopyLight.userData.duskEmissive = 1.6;
  L.canopy = [];
  M.canopy = canopyLight;

  // ------------------------------------------------------------ shell
  // side walls (with the end piers proud of the facade), service core at the back, podium roof
  for (const [za, zb] of [[ZL0, Z0], [Z1, ZL1]]) {
    B(L.stone, X0, 0, za, X1, RY, zb, CREAM);
    B(L.stone, X0 - 0.3, 0, za, X0, RY + 1.2, zb, EXT);                 // pier, proud of the glass line
    B(L.bronze, X0 - 0.36, RY + 1.2, za - 0.03, X0 + 0.4, RY + 1.3, zb + 0.03);
    C(X0 - 0.3, 0, za, X1, RY, zb, 'wall', 'concrete');
  }
  BC(L.stone, X1, 0, ZL0, XB, RY, ZL1, CREAM, 'wall', 'concrete');
  // spandrel above the glass (lettering zone) + cornice at the glass head
  BC(L.stone, X0 - 0.15, TIER.head, Z0, X0 + 0.6, RY - 0.25, Z1, GRAN, 'wall', 'concrete');
  B(L.bronze, X0 - 0.28, TIER.head - 0.08, Z0, X0 + 0.62, TIER.head + 0.1, Z1);
  B(L.stone, X0 - 0.3, RY - 0.25, Z0, X0, RY, Z1, EXT);                          // roof-line band
  // podium roof slab around the atrium lightwell
  const holes = [[X0, ZL0, SKY.x0, ZL1], [SKY.x1, ZL0, XB, ZL1], [SKY.x0, ZL0, SKY.x1, SKY.z0], [SKY.x0, SKY.z1, SKY.x1, ZL1]];
  for (const [xa, za, xb, zb] of holes) {
    BC(L.stone, xa, RY - 0.4, za, xb, RY, zb, [0.55, 0.53, 0.5], 'roof', 'concrete');
    B(L.ceil, Math.max(xa, X0 + 0.01), CY, Math.max(za, Z0), Math.min(xb, X1), CY + 0.2, Math.min(zb, Z1), W, 3.6);   // ceiling
  }
  // parapets: avenue edge (PARAPET 1.05 x 0.35, flush with the facade) + the other edges, coping
  BC(L.stone, X0, RY, ZL0, X0 + 0.35, RY + 1.05, ZL1, EXT, 'parapet', 'concrete');
  B(L.stone, X0 - 0.06, RY + 1.05, ZL0, X0 + 0.42, RY + 1.13, ZL1, CREAM);
  BC(L.stone, X0 + 0.35, RY, ZL0, XB, RY + 1.05, ZL0 + 0.3, EXT, 'parapet', 'concrete');
  BC(L.stone, X0 + 0.35, RY, ZL1 - 0.3, XB, RY + 1.05, ZL1, EXT, 'parapet', 'concrete');
  BC(L.stone, XB - 0.3, RY, ZL0 + 0.3, XB, RY + 1.05, ZL1 - 0.3, EXT, 'parapet', 'concrete');
  // lightwell: walls from the cove (8.8) up through the roof, curb above the roof
  const lw = 0.25;
  for (const [xa, za, xb, zb] of [[SKY.x0 - lw, SKY.z0 - lw, SKY.x0, SKY.z1 + lw], [SKY.x1, SKY.z0 - lw, SKY.x1 + lw, SKY.z1 + lw],
    [SKY.x0, SKY.z0 - lw, SKY.x1, SKY.z0], [SKY.x0, SKY.z1, SKY.x1, SKY.z1 + lw]]) {
    BC(L.stone, xa, 8.8, za, xb, RY + 0.45, zb, PLASTER, 'wall', 'concrete');
  }
  // cove light strips under the atrium fascia
  B(L.light, SKY.x0 - lw + 0.04, 8.78, SKY.z0 - lw + 0.04, SKY.x0 - 0.04, 8.8, SKY.z1 + lw - 0.04);
  B(L.light, SKY.x1 + 0.04, 8.78, SKY.z0 - lw + 0.04, SKY.x1 + lw - 0.04, 8.8, SKY.z1 + lw - 0.04);
  B(L.light, SKY.x0, 8.78, SKY.z0 - lw + 0.04, SKY.x1, 8.8, SKY.z0 - 0.04);
  B(L.light, SKY.x0, 8.78, SKY.z1 + 0.04, SKY.x1, 8.8, SKY.z1 + lw - 0.04);
  // a few rooftop units
  for (const [x, z, w, d, h] of [[44, -122, 3, 4, 1.8], [45, -96, 4, 3, 2.2], [19, -84, 2, 2.5, 1.2]]) BC(L.steel, x - w / 2, RY, z - d / 2, x + w / 2, RY + h, z + d / 2, W, 'roof', 'metal');

  // ------------------------------------------------------------ skylight: coffered steel frame + panes
  {
    const nx = 5, nz = 8, pw = (SKY.x1 - SKY.x0) / nx, ph = (SKY.z1 - SKY.z0) / nz;
    for (let i = 0; i <= nx; i++) { const x = SKY.x0 + i * pw; B(L.steel, x - 0.09, CY - 0.5, SKY.z0, x + 0.09, CY - 0.03, SKY.z1); }
    for (let j = 0; j <= nz; j++) { const z = SKY.z0 + j * ph; B(L.steel, SKY.x0, CY - 0.36, z - 0.07, SKY.x1, CY - 0.03, z + 0.07); }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) panes.push({ c: [SKY.x0 + (i + 0.5) * pw, CY, SKY.z0 + (j + 0.5) * ph], n: [0, 1, 0], w: pw, h: ph, kind: 'sky' });
  }

  // ------------------------------------------------------------ avenue facade (x = 16)
  {
    // glass sections between doors: [z0, z1, bays], tiers: lower (base..mid) skipped in doorways
    const secs = [[Z0, DOORS[1][0], 2, false], [DOORS[1][0], DOORS[1][1], 2, true], [DOORS[1][1], DOORS[0][0], 9, false], [DOORS[0][0], DOORS[0][1], 2, true], [DOORS[0][1], Z1, 2, false]];
    const mull = (z, y0, y1, w = 0.12, deep = 0.3) => { B(L.bronze, X0 - 0.1, y0, z - w / 2, X0 + deep, y1, z + w / 2); };
    for (const [za, zb, n, door] of secs) {
      const bw = (zb - za) / n;
      for (let k = 0; k < n; k++) {
        const z0 = za + k * bw, zc = z0 + bw / 2;
        if (!door) panes.push({ c: [X0, (TIER.base + TIER.mid - 0.1) / 2, zc], n: [-1, 0, 0], w: bw - 0.1, h: TIER.mid - 0.1 - TIER.base, kind: 'lobby' });
        panes.push({ c: [X0, (TIER.mid + 0.1 + TIER.head - 0.05) / 2, zc], n: [-1, 0, 0], w: bw - 0.1, h: TIER.head - 0.05 - TIER.mid - 0.1, kind: 'lobby' });
        if (k > 0) mull(z0, door ? TIER.mid : FY, TIER.head);
      }
      if (door) {
        // portal: heavy jambs, deep transom beam, threshold, canopy with downlights + tie rods
        for (const z of [za, zb]) { B(L.bronze, X0 - 0.22, 0, z - 0.2, X0 + 0.45, TIER.head, z + 0.2); C(X0 - 0.22, 0, z - 0.2, X0 + 0.45, TIER.mid, z + 0.2, 'doorframe', 'metal'); }
        B(L.bronze, X0 - 0.22, TIER.mid - 0.28, za, X0 + 0.45, TIER.mid + 0.12, zb);
        B(L.stone, X0 - 1.0, 0, za, X0 + 0.3, FY + 0.02, zb, DARK);
        const cz0 = za - 0.9, cz1 = zb + 0.9, cx = X0 - 3.0, cy = 5.05;
        B(L.bronze, cx, cy, cz0, X0 - 0.1, cy + 0.28, cz1);
        B(L.stone, cx + 0.15, cy + 0.28, cz0 + 0.15, X0 - 0.1, cy + 0.36, cz1 - 0.15, DARK);
        B(L.misc, cx + 0.3, cy - 0.01, cz0 + 0.3, X0 - 0.4, cy, cz1 - 0.3, [0.12, 0.11, 0.1]);
        for (let zz = cz0 + 0.9; zz < cz1 - 0.5; zz += 1.2) for (const xx of [cx + 0.9, X0 - 1.0]) B(L.canopy, xx - 0.14, cy - 0.025, zz - 0.14, xx + 0.14, cy - 0.01, zz + 0.14);
        for (const z of [cz0 + 0.3, cz1 - 0.3]) {
          const dx = X0 - 0.1 - (cx + 0.3), dy = 8.0 - (cy + 0.28), len = Math.hypot(dx, dy);
          const g = new THREE.CylinderGeometry(0.035, 0.035, len, 6); tint(g, 1, 1, 1);
          at(g, cx + 0.3 + dx / 2, cy + 0.28 + dy / 2, z, 0, 0, Math.atan2(dx, dy) * -1); L.steel.push(g);
        }
        L.letters.push(quad([cx - 0.005, cy + 0.14, (za + zb) / 2], [0, 0, 1], [0, 1, 0], 3.4, 0.53, uvr(A.LET, 1)));
      } else {
        // stone base strip under the lower glass
        BC(L.stone, X0 - 0.12, 0, za, X0 + 0.3, TIER.base, zb, DARK, 'wall', 'concrete');
      }
    }
    // mullions at every section edge, transom bar, sill
    for (const z of [Z0, Z1]) mull(z + (z === Z0 ? 0.06 : -0.06), 0, TIER.head);
    for (const [za, zb, , door] of secs) {
      B(L.bronze, X0 - 0.12, TIER.mid - 0.1, za, X0 + 0.32, TIER.mid + 0.1, zb);
      if (!door) B(L.bronze, X0 - 0.14, TIER.base - 0.04, za, X0 + 0.32, TIER.base + 0.02, zb);
    }
    // bronze "HAVEN TRUST" with backlit halo on the spandrel
    const zc = (Z0 + Z1) / 2, lwid = 28, lh = lwid * 160 / 1024;
    L.letters.push(quad([X0 - 0.24, 11.7, zc], [0, 0, 1], [0, 1, 0], lwid, lh, uvr(A.LET, 1)));
    L.halo.push(quad([X0 - 0.165, 11.7, zc], [0, 0, 1], [0, 1, 0], lwid * 1.02, lh * 1.25, uvr(A.HALO, 1)));
    // standoff pins are implied; a thin bronze shadow-line under the letters reads as relief
    B(L.bronze, X0 - 0.2, 10.05, zc - 14.5, X0 - 0.15, 10.12, zc + 14.5);
    B(L.bronze, X0 - 0.2, 13.28, zc - 14.5, X0 - 0.15, 13.35, zc + 14.5);
  }

  // ------------------------------------------------------------ interior floor + walls trim
  {
    const g = new THREE.PlaneGeometry(X1 - (X0 + 0.3), Z1 - Z0); g.rotateX(-Math.PI / 2); g.translate((X0 + 0.3 + X1) / 2, FY, (Z0 + Z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - 25 + 2.4) / 4.8, -(p.getZ(i) + 104 - 2.4) / 4.8);
    const m = new THREE.Mesh(g, M.floor); m.receiveShadow = true; m.name = 'lobbyFloor'; root.add(m);
    // compass inlay (centred on the sculpture)
    L.inlay.push(quad([25, FY + 0.002, -104], [1, 0, 0], [0, 0, -1], 5.6, 5.6, uvr(A.EMB, 1)));
  }
  // baseboards + side-wall pilasters + walnut feature panels on the side walls
  B(L.stone, X0 + 0.3, FY, Z0, X1, FY + 0.14, Z0 + 0.03, DARK);
  B(L.stone, X0 + 0.3, FY, Z1 - 0.03, X1, FY + 0.14, Z1, DARK);
  B(L.stone, X1 - 0.03, FY, Z0, X1, FY + 0.14, Z1, DARK);
  for (const [z, s] of [[Z0, 1], [Z1, -1]]) {
    for (let x = 19; x <= 40; x += 4.2) B(L.stone, x - 0.35, FY, z, x + 0.35, CY, z + s * 0.28, W);
    const za = s > 0 ? z : z - 0.12, zb = s > 0 ? z + 0.12 : z;
    B(L.wood, 23.4, 1.0, za, 31.8, 8.0, zb, W, 1.2);
    for (let x = 23.6; x < 31.7; x += 0.35) B(L.wood, x - 0.04, 1.0, s > 0 ? z + 0.12 : z - 0.18, x + 0.04, 8.0, s > 0 ? z + 0.18 : z - 0.12, W, 1.2);
    B(L.bronze, 23.3, 0.9, s > 0 ? z : z - 0.2, 31.9, 1.0, s > 0 ? z + 0.2 : z);
    B(L.bronze, 23.3, 8.0, s > 0 ? z : z - 0.2, 31.9, 8.1, s > 0 ? z + 0.2 : z);
  }

  // ------------------------------------------------------------ columns (stone, bronze base + capital)
  const COLS = [[21, -114], [21, -104], [21, -94], [36.6, -114], [36.6, -104], [36.6, -94], [29, -122.2], [29, -85.8]];
  for (const [x, z] of COLS) {
    const r = 0.6;
    L.stone.push(tint(at(cylUV(r, CY - FY, 28, 2.4), x, (FY + CY) / 2, z), ...W));
    L.bronze.push(tint(at(new THREE.CylinderGeometry(r + 0.06, r + 0.08, 0.32, 28), x, FY + 0.16, z), 1, 1, 1));
    L.stone.push(tint(at(new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.08, 28), x, FY + 0.04, z), ...DARK));
    L.bronze.push(tint(at(new THREE.CylinderGeometry(r + 0.1, r + 0.04, 0.3, 28), x, CY - 0.15, z), 1, 1, 1));
    L.bronze.push(tint(at(new THREE.CylinderGeometry(r + 0.025, r + 0.025, 0.06, 28), x, 2.4, z), 1, 1, 1));
    C(x - r, 0, z - r, x + r, CY, z + r, 'column', 'concrete');
  }

  // ------------------------------------------------------------ mezzanine (decor, not walkable) + LED wall
  {
    const slab = [MEZ.x0, MEZ.y - 0.15, Z0, X1, MEZ.top, Z1];
    BC(L.stone, ...slab, PLASTER, 'mezzanine', 'concrete');
    B(L.bronze, MEZ.x0 - 0.08, MEZ.y - 0.25, Z0, MEZ.x0 + 0.02, MEZ.top + 0.05, Z1);
    // balustrade with gaps at the escalator landings
    const gaps = [[-111.1, -109.3], [-98.7, -96.9]];
    let za = Z0 + 0.3;
    for (const [g0, g1] of [...gaps, [Z1 - 0.3, Z1]]) {
      B(L.glass, MEZ.x0 + 0.04, MEZ.top, za, MEZ.x0 + 0.06, MEZ.top + 1.05, g0);
      B(L.bronze, MEZ.x0 + 0.0, MEZ.top + 1.05, za, MEZ.x0 + 0.1, MEZ.top + 1.11, g0);
      for (let z = za; z <= g0 + 0.01; z += (g0 - za) / Math.max(1, Math.round((g0 - za) / 1.6))) B(L.bronze, MEZ.x0 + 0.02, MEZ.top, z - 0.03, MEZ.x0 + 0.08, MEZ.top + 1.05, z + 0.03);
      C(MEZ.x0, MEZ.top, za, MEZ.x0 + 0.1, MEZ.top + 1.11, g0, 'balustrade', 'glass');
      za = g1;
    }
    // soffit downlights
    for (let z = Z0 + 1.6; z < Z1 - 1; z += 3) for (const x of [37.6, 40.4]) B(L.light, x - 0.28, MEZ.y - 0.17, z - 0.28, x + 0.28, MEZ.y - 0.15, z + 0.28);
    // LED wall above the mezzanine
    const lz0 = -115, lz1 = -93, ly0 = 5.75, ly1 = 9.15;
    B(L.bronze, X1 - 0.18, ly0 - 0.15, lz0 - 0.15, X1, ly1 + 0.12, lz1 + 0.15);
    const g = quad([X1 - 0.19, (ly0 + ly1) / 2, (lz0 + lz1) / 2], [0, 0, 1], [0, 1, 0], lz1 - lz0, ly1 - ly0, [0, 0.006, (lz1 - lz0) / (ly1 - ly0) / 4, 0.244]);
    L.led.push(g);
    // mezzanine doors (dark glazed openings) flanking the LED wall
    for (const z of [-121, -88]) { B(L.misc, X1 - 0.14, MEZ.top, z - 1.45, X1 - 0.125, MEZ.top + 2.65, z + 1.45, [0.05, 0.05, 0.06]); B(L.bronze, X1 - 0.12, MEZ.top, z - 1.6, X1 - 0.04, MEZ.top + 2.8, z + 1.6); }
  }

  // ------------------------------------------------------------ elevator bank (back wall, under the mezzanine)
  {
    const zs = [-111.5, -108.7, -105.9, -103.1, -100.3, -97.5];
    B(L.stone, X1 - 0.08, FY, zs[0] - 1.6, X1, MEZ.y - 0.15, zs[5] + 1.6, [0.42, 0.38, 0.35]);
    for (const z of zs) {
      B(L.bronze, X1 - 0.26, FY, z - 0.82, X1 - 0.08, 3.1, z - 0.66);
      B(L.bronze, X1 - 0.26, FY, z + 0.66, X1 - 0.08, 3.1, z + 0.82);
      B(L.bronze, X1 - 0.26, 2.9, z - 0.82, X1 - 0.08, 3.1, z + 0.82);
      B(L.steel, X1 - 0.16, FY, z - 0.66, X1 - 0.1, 2.9, z + 0.66);
      B(L.misc, X1 - 0.165, FY, z - 0.008, X1 - 0.155, 2.9, z + 0.008, [0.05, 0.05, 0.05]);
      L.signs.push(quad([X1 - 0.09, 3.38, z], [0, 0, 1], [0, 1, 0], 0.6, 0.3, uvr(A.IND, 2)));
      B(L.bronze, X1 - 0.12, 1.0, z + 1.0, X1 - 0.08, 1.35, z + 1.18);
      B(L.light, X1 - 0.13, 1.12, z + 1.06, X1 - 0.12, 1.2, z + 1.12);
    }
    C(X1 - 0.26, 0, zs[0] - 1.6, X1, MEZ.y, zs[5] + 1.6, 'elevators', 'metal');
  }

  // ------------------------------------------------------------ security turnstiles
  {
    const tx = 39.0;
    for (let k = 0; k < 9; k++) {
      const z = -109.5 + k * 1.5;
      B(L.steel, tx - 0.6, FY, z - 0.1, tx + 0.6, 1.0, z + 0.1);
      B(L.misc, tx - 0.62, 1.0, z - 0.12, tx + 0.62, 1.05, z + 0.12, [0.06, 0.06, 0.07]);
      B(L.light, tx - 0.4, 1.05, z - 0.03, tx + 0.4, 1.06, z + 0.03);
      if (k < 8) for (const s of [-1, 1]) B(L.glass, tx - 0.05, 0.45, z + 0.75 + s * 0.35 - 0.3, tx + 0.05, 1.25, z + 0.75 + s * 0.35 + 0.3);
      C(tx - 0.6, 0, z - 0.1, tx + 0.6, 1.05, z + 0.1, 'turnstile', 'metal');
    }
  }

  // ------------------------------------------------------------ escalators (to the mezzanine, rising toward +x)
  function escalator(za, zb) {
    const xL = 25.4, xb = 26.6, xt = 35.0, y0 = FY + 0.06, y1 = MEZ.top, n = 20;
    const dx = (xt - xb) / n, dy = (y1 - y0) / n, ang = Math.atan2(y1 - y0, xt - xb), len = Math.hypot(xt - xb, y1 - y0);
    const pts = [[xL, y0], [xb, y0]];
    for (let i = 0; i < n; i++) { const x = xb + i * dx, y = y0 + i * dy; pts.push([x, y + dy], [x + dx, y + dy]); }
    pts.push([MEZ.x0, y1]);
    const si = 0.32;     // inner skirt inset
    let g = profileStrip(pts, zb - si, za + si, 0.4, 0.4).toNonIndexed(); g.computeVertexNormals(); tint(g, 0.32, 0.32, 0.34); L.misc.push(g);
    // step nosing lines (yellow) every tread
    for (let i = 0; i < n; i++) { const x = xb + i * dx, y = y0 + (i + 1) * dy; B(L.misc, x, y, za + si, x + 0.04, y + 0.006, zb - si, [0.9, 0.7, 0.15]); }
    // truss (clad in steel) under the steps
    const sn = Math.sin(ang), cs = Math.cos(ang), mx = (xb + xt) / 2, my = (y0 + y1) / 2;
    const T = box(len + 1.6, 1.1, zb - za, 1.2); tint(T, 1, 1, 1);
    at(T, mx + sn * 0.62, my - cs * 0.62, (za + zb) / 2, 0, 0, ang); L.steel.push(T);
    for (const [z, s] of [[za, 1], [zb, -1]]) {
      // skirt, glass balustrade, black handrail, newel at the bottom
      const sk = box(len + 1.2, 0.5, 0.06); tint(sk, 1, 1, 1); at(sk, mx - sn * 0.1, my + cs * 0.1, z + s * si, 0, 0, ang); L.steel.push(sk);
      const gl = box(len + 1.0, 0.9, 0.025); tint(gl, 1, 1, 1); at(gl, mx - sn * 0.75, my + cs * 0.75, z + s * (si - 0.06), 0, 0, ang); L.glass.push(gl);
      const hr = box(len + 1.1, 0.09, 0.1); tint(hr, 0.04, 0.04, 0.04); at(hr, mx - sn * 1.24, my + cs * 1.24, z + s * (si - 0.06), 0, 0, ang); L.misc.push(hr);
      B(L.steel, xL, FY, z + (s > 0 ? 0 : -si), xb - 0.2, FY + 1.0, z + (s > 0 ? si : 0));
      B(L.misc, xL - 0.05, FY + 1.0, z + (s > 0 ? 0.05 : -si + 0.05), xb - 0.15, FY + 1.09, z + (s > 0 ? si - 0.05 : -0.05), [0.04, 0.04, 0.04]);
    }
    B(L.steel, xL, FY, za + si, xb, y0 + 0.005, zb - si);
    // colliders: stepped boxes approximating the slope (cover), plus the low entry
    const segs = 4;
    for (let k = 0; k < segs; k++) {
      const x0 = xb + (xt - xb) * k / segs, x1 = xb + (xt - xb) * (k + 1) / segs;
      const yt = y0 + (y1 - y0) * (k + 1) / segs + 1.0;
      C(k === 0 ? xL : x0, 0, za, k === segs - 1 ? MEZ.x0 : x1, yt, zb, 'escalator', 'metal');
    }
  }
  escalator(-98.6, -97.0);
  escalator(-111.0, -109.4);

  // ------------------------------------------------------------ reception desk + logo wall
  {
    const x0 = 29.6, x1 = 30.8, z0 = -107.5, z1 = -100.5;
    B(L.stone, x0 + 0.12, FY, z0 + 0.1, x1, FY + 0.12, z1 - 0.1, DARK);
    B(L.wood, x0, FY + 0.12, z0, x0 + 0.12, 1.05, z1, W, 1.2);
    for (const y of [0.42, 0.72]) B(L.bronze, x0 - 0.02, y, z0, x0 + 0.02, y + 0.03, z1);
    for (const z of [z0, z1]) B(L.wood, x0, FY + 0.12, z - (z === z0 ? 0 : 0.12), x1, 1.05, z + (z === z0 ? 0.12 : 0), W, 1.2);
    B(L.wood, x0 + 0.12, FY + 0.12, z0, x1, 0.74, z1, W, 1.2);
    B(L.stone, x0 - 0.12, 1.05, z0 - 0.08, x0 + 0.45, 1.12, z1 + 0.08, CREAM);       // transaction ledge
    B(L.stone, x0 + 0.4, 0.74, z0 + 0.12, x1 + 0.02, 0.78, z1 - 0.12, CREAM);        // work surface
    L.letters.push(quad([x0 - 0.026, 0.6, (z0 + z1) / 2], [0, 0, 1], [0, 1, 0], 3.2, 0.5, uvr(A.LET, 1)));
    for (const z of [-106.2, -104.0, -101.8]) {
      B(L.misc, 30.5, 0.78, z - 0.08, 30.6, 0.98, z + 0.08, [0.06, 0.06, 0.07]);
      B(L.misc, 30.42, 0.98, z - 0.3, 30.47, 1.32, z + 0.3, [0.05, 0.05, 0.06]);
      L.signs.push(quad([30.475, 1.15, z], [0, 0, -1], [0, 1, 0], 0.56, 0.31, uvr(A.MON, 2)));
      B(L.misc, 30.65, 0.78, z - 0.22, 30.8, 0.8, z + 0.22, [0.1, 0.1, 0.11]);
    }
    C(x0 - 0.12, 0, z0 - 0.08, x1, 1.12, z1 + 0.08, 'desk', 'wood');
    // logo wall: walnut slats, bronze frame, glowing emblem + name
    const wx = 34.0, wz0 = -107.8, wz1 = -100.2, wy = 6.0;
    B(L.wood, wx, FY, wz0, wx + 0.5, wy, wz1, W, 1.2);
    for (let z = wz0 + 0.15; z < wz1 - 0.1; z += 0.3) B(L.wood, wx - 0.07, FY + 0.15, z - 0.05, wx, wy - 0.15, z + 0.05, W, 1.2);
    B(L.bronze, wx - 0.1, wy, wz0 - 0.05, wx + 0.55, wy + 0.12, wz1 + 0.05);
    B(L.bronze, wx - 0.1, FY, wz0 - 0.05, wx + 0.55, FY + 0.15, wz1 + 0.05);
    B(L.stone, wx - 0.12, 2.35, -106.2, wx - 0.07, 5.05, -101.8, [0.16, 0.14, 0.13]);
    L.signs.push(quad([wx - 0.13, 4.05, -104], [0, 0, 1], [0, 1, 0], 1.8, 1.8, uvr(A.EMB, 1)));
    L.letters.push(quad([wx - 0.13, 2.78, -104], [0, 0, 1], [0, 1, 0], 3.8, 0.594, uvr(A.LET, 1)));
    C(wx - 0.1, 0, wz0, wx + 0.55, wy + 0.12, wz1, 'wall', 'wood');
  }

  // ------------------------------------------------------------ sculpture (polished steel knot on a granite plinth)
  {
    const sx = 25, sz = -104;
    BC(L.stone, sx - 0.8, FY, sz - 0.8, sx + 0.8, 1.15, sz + 0.8, DARK, 'sculpture', 'concrete');
    B(L.bronze, sx - 0.82, 1.15, sz - 0.82, sx + 0.82, 1.2, sz + 0.82);
    const k = new THREE.TorusKnotGeometry(0.95, 0.2, 140, 12, 2, 3); tint(k, 1, 1, 1);
    at(k, sx, 2.75, sz, 0.35, 0.6, 0.2); L.bronze.push(k);
    C(sx - 1.15, 1.2, sz - 1.15, sx + 1.15, 4.0, sz + 1.15, 'sculpture', 'metal');
  }

  // ------------------------------------------------------------ seating groups (leather sofas, tables, rugs)
  function seating(cx, cz) {
    const LEATHER = [0.2, 0.085, 0.045], RUG = [0.16, 0.07, 0.06];
    B(L.misc, cx - 2.2, FY, cz - 2.6, cx + 2.2, FY + 0.018, cz + 2.6, RUG);
    B(L.misc, cx - 2.0, FY + 0.018, cz - 2.4, cx + 2.0, FY + 0.02, cz + 2.4, [0.42, 0.3, 0.2]);
    for (const s of [-1, 1]) {
      const zf = cz + s * 1.05, zb = cz + s * 1.95;
      const za = Math.min(zf, zb), zz = Math.max(zf, zb);
      B(L.misc, cx - 1.25, FY + 0.08, za, cx + 1.25, FY + 0.45, zz, LEATHER);                         // seat
      B(L.misc, cx - 1.25, FY + 0.08, s < 0 ? za : zz - 0.25, cx + 1.25, FY + 0.85, s < 0 ? za + 0.25 : zz, LEATHER);   // back
      for (const e of [-1, 1]) B(L.misc, cx + e * 1.25 - (e > 0 ? 0.2 : 0), FY + 0.08, za, cx + e * 1.25 + (e < 0 ? 0.2 : 0), FY + 0.66, zz, LEATHER);
      for (let k = 0; k < 3; k++) B(L.misc, cx - 1.05 + k * 0.72, FY + 0.45, za + (s < 0 ? 0.25 : 0.05), cx - 0.4 + k * 0.72, FY + 0.53, zz - (s < 0 ? 0.05 : 0.25), [0.25, 0.11, 0.055]);
      B(L.steel, cx - 1.3, FY, za + 0.05, cx + 1.3, FY + 0.08, zz - 0.05);
      C(cx - 1.25, 0, za, cx + 1.25, FY + 0.85, zz, 'seating', 'wood');
    }
    B(L.stone, cx - 0.7, FY + 0.38, cz - 0.45, cx + 0.7, FY + 0.43, cz + 0.45, DARK);
    for (const [ex, ez] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) B(L.bronze, cx + ex - 0.03, FY, cz + ez - 0.03, cx + ex + 0.03, FY + 0.38, cz + ez + 0.03);
    C(cx - 0.7, 0, cz - 0.45, cx + 0.7, FY + 0.43, cz + 0.45, 'seating', 'wood');
    // armchairs at the ends
    for (const e of [-1, 1]) {
      const ax = cx + e * 1.9;
      B(L.misc, ax - 0.4, FY + 0.08, cz - 0.45, ax + 0.4, FY + 0.45, cz + 0.45, LEATHER);
      B(L.misc, e > 0 ? ax + 0.18 : ax - 0.4, FY + 0.08, cz - 0.45, e > 0 ? ax + 0.4 : ax - 0.18, FY + 0.85, cz + 0.45, LEATHER);
      C(ax - 0.4, 0, cz - 0.45, ax + 0.4, FY + 0.85, cz + 0.45, 'seating', 'wood');
    }
  }
  seating(24.6, -87.6);
  seating(24.6, -120.4);

  // ------------------------------------------------------------ planters with ficus trees
  function planter(px, pz, s = 1.5, h = 0.9, tree = 1) {
    BC(L.stone, px - s / 2, FY, pz - s / 2, px + s / 2, h, pz + s / 2, [0.38, 0.35, 0.33], 'planter', 'concrete');
    B(L.bronze, px - s / 2 - 0.02, h, pz - s / 2 - 0.02, px + s / 2 + 0.02, h + 0.05, pz + s / 2 + 0.02);
    B(L.misc, px - s / 2 + 0.06, h, pz - s / 2 + 0.06, px + s / 2 - 0.06, h + 0.03, pz + s / 2 - 0.06, [0.16, 0.11, 0.07]);
    const th = 2.6 * tree;
    L.misc.push(tint(at(new THREE.CylinderGeometry(0.06, 0.1, th, 7), px, h + th / 2, pz), 0.34, 0.26, 0.18));
    for (let k = 0; k < 5; k++) {
      const a = k * 2.4 + rng() * 0.6, rr = k === 0 ? 0 : 0.55 + rng() * 0.3;
      let g = new THREE.IcosahedronGeometry((0.65 + rng() * 0.35) * tree, 2);
      const p = g.attributes.position, col = [];
      for (let i = 0; i < p.count; i++) {
        p.setXYZ(i, p.getX(i) * (1 + (rng() - 0.5) * 0.2), p.getY(i) * 0.8, p.getZ(i) * (1 + (rng() - 0.5) * 0.2));
        const v = 0.75 + rng() * 0.45, up = p.getY(i) > 0 ? 1.15 : 0.8;
        col.push(0.13 * v * up, 0.27 * v * up, 0.09 * v * up);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const nr = []; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i) * 1.4, p.getZ(i)).normalize(); nr.push(v.x, v.y, v.z); }
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nr, 3));
      at(g, px + Math.cos(a) * rr, h + th - 0.1 + (k === 0 ? 0.5 : rng() * 0.4) * tree, pz + Math.sin(a) * rr); L.misc.push(g);
    }
  }
  planter(18.9, -99);
  planter(18.9, -109);
  planter(39.6, -86.6);
  planter(39.6, -121.4);

  // ------------------------------------------------------------ ceiling fixtures + light pools on the marble
  {
    const inAtrium = (x, z) => x > SKY.x0 - 0.6 && x < SKY.x1 + 0.6 && z > SKY.z0 - 0.6 && z < SKY.z1 + 0.6;
    for (const x of [18.6, 23.4, 28.4, 33.4, 39.2]) for (let z = Z0 + 1.6; z < Z1 - 1; z += 3) {
      if (inAtrium(x, z)) continue;
      B(L.light, x - 0.3, CY - 0.02, z - 0.3, x + 0.3, CY, z + 0.3);
      B(L.bronze, x - 0.36, CY - 0.015, z - 0.36, x + 0.36, CY - 0.005, z + 0.36);
      if (x < MEZ.x0) L.pools.push(quad([x, FY + 0.004, z], [1, 0, 0], [0, 0, -1], 3.2, 3.2, uvr(A.GLOW, 2)));
    }
    for (let z = Z0 + 1.6; z < Z1 - 1; z += 3) for (const x of [37.6, 40.4]) L.pools.push(quad([x, FY + 0.004, z], [1, 0, 0], [0, 0, -1], 2.2, 2.2, uvr(A.GLOW, 2)));
    // warm wash under the cove + reflection of the LED wall on the marble
    L.pools.push(quad([29, FY + 0.004, -104], [1, 0, 0], [0, 0, -1], 15, 26, uvr(A.GLOW, 2)));
  }

  // ------------------------------------------------------------ sun shafts through the facade (subtle, fade at dusk)
  {
    const Ld = SUN_DIR.clone().multiplyScalar(-1).normalize(), band = uvr(A.BAND, 2);
    const shaft = (c, axis, w, len, k) => {
      const e = [c[0] + Ld.x * len, c[1] + Ld.y * len, c[2] + Ld.z * len], h = w / 2;
      const P = [c[0] - axis[0] * h, c[1] - axis[1] * h, c[2] - axis[2] * h, c[0] + axis[0] * h, c[1] + axis[1] * h, c[2] + axis[2] * h,
        e[0] + axis[0] * h * 1.15, e[1] + axis[1] * h * 1.15, e[2] + axis[2] * h * 1.15, e[0] - axis[0] * h * 1.15, e[1] - axis[1] * h * 1.15, e[2] - axis[2] * h * 1.15];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([band[0], band[1], band[0], band[3], band[2], band[3], band[2], band[1]], 2));
      const a = [1.0 * k, 0.66 * k, 0.36 * k], b = [0, 0, 0];
      g.setAttribute('color', new THREE.Float32BufferAttribute([...a, ...a, ...b, ...b], 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
      g.setIndex([0, 1, 2, 0, 2, 3]); L.shafts.push(g);
    };
    for (const p of panes) {
      if (p.kind !== 'lobby' || rng() > 0.45) continue;
      const len = Math.min(16, (Z1 - 0.5 - p.c[2]) / Math.max(0.05, Ld.z));
      if (len < 3) continue;
      const k = 0.05 + rng() * 0.05;
      shaft([X0 + 0.02, p.c[1], p.c[2]], [0, 0, 1], p.w * 0.9, len, k);
      shaft([X0 + 0.02, p.c[1], p.c[2]], [0, 1, 0], p.h * 0.85, len, k * 0.8);
    }
  }

  // ------------------------------------------------------------ meshes
  const order = [['ceil', false], ['stone', true], ['bronze', true], ['steel', true], ['wood', true], ['misc', true], ['light', false], ['canopy', false],
    ['signs', false], ['letters', false], ['inlay', false], ['halo', false], ['led', false], ['glass', false], ['pools', false], ['shafts', false]];
  const meshes = {};
  for (const [k, cast] of order) {
    if (!L[k].length) continue;
    const m = new THREE.Mesh(merge(L[k]), M[k]);
    m.name = 'lobby_' + k; m.castShadow = cast; m.receiveShadow = !['halo', 'pools', 'shafts', 'led', 'glass'].includes(k);
    if (['halo', 'pools', 'shafts', 'glass'].includes(k)) m.renderOrder = 2;
    root.add(m); meshes[k] = m;
  }
  // debug: show the exported panes as glass (?panes)
  let debugPanes = false;
  try { debugPanes = typeof location !== 'undefined' && new URLSearchParams(location.search).has('panes'); } catch (e) { /* no location */ }
  if (debugPanes) {
    const gs = panes.map(p => {
      const n = p.n, up = Math.abs(n[1]) > 0.5 ? [0, 0, -1] : [0, 1, 0];
      const r = new THREE.Vector3(...up).cross(new THREE.Vector3(...n)).normalize();
      return quad(p.c, [r.x, r.y, r.z], up, p.w - 0.02, p.h - 0.02, [0, 0, 1, 1]);
    });
    const pm = new THREE.Mesh(merge(gs), new THREE.MeshStandardMaterial({ color: 0x8fa3ad, transparent: true, opacity: 0.32, roughness: 0.04, metalness: 0.9, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }));
    pm.renderOrder = 3; root.add(pm);
  }

  // ------------------------------------------------------------ anchors
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const anchors = {
    doors: DOORS.map(([a, b]) => V(X0 - 1.5, FY, (a + b) / 2)),
    inside: V(27, FY, -104),
    cover: [V(31.4, FY, -104), V(31.4, FY, -101.5), V(31.4, FY, -106.5), V(26.2, FY, -104), V(22, FY, -104), V(22, FY, -94), V(22, FY, -114),
      V(37.6, FY, -94), V(37.6, FY, -114), V(19.9, FY, -99), V(19.9, FY, -109), V(24.6, FY, -90.5), V(24.6, FY, -117.5), V(27.0, FY, -95.6), V(27.0, FY, -112.4), V(33.2, FY, -104)],
    glows: [
      ...DOORS.map(([a, b]) => ({ p: [X0 - 1.6, 4.9, (a + b) / 2], color: [1.0, 0.78, 0.5], size: 3.0, dusk: true })),
      { p: [X1 - 0.6, 7.45, -104], color: [0.45, 0.6, 1.0], size: 14, dusk: true },
      { p: [X0 - 0.5, 11.7, -104], color: [1.0, 0.6, 0.28], size: 9, dusk: true },
    ],
  };

  // ------------------------------------------------------------ update: LED scroll, halo/shafts follow the dusk
  let t0 = 0;
  const ledUV = meshes.led && meshes.led.geometry.attributes.uv, ledU0 = ledUV ? [0, 1, 2, 3].map(i => ledUV.getX(i)) : null;
  const update = (dt, t, dusk, head) => {
    const k = dusk ?? duskShared.value ?? 0;
    t0 += dt || 0;
    if (ledUV) { const o = (t0 * 0.018) % 1; for (let i = 0; i < 4; i++) ledUV.setX(i, ledU0[i] + o); ledUV.needsUpdate = true; }
    M.halo.opacity = 0.35 + 0.65 * sstep(0.0, 0.4, k);
    M.shafts.opacity = 1 - sstep(0.15, 0.45, k);
  };
  update(0, 0);

  let tris = 0, draws = 0;
  root.traverse(o => { if (o.isMesh) { draws++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  const info = { draws, tris: Math.round(tris), textures: 5, panes: panes.length, colliders: colliders.length };
  return { root, colliders, panes, anchors, update, info };
}
