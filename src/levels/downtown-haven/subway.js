import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeNoise, fbm, makeCanvas, canvasTex } from '../../textures.js';
import { AVE, SUBWAY, streetGround } from './layout.js';
import { Bucket, M4 } from './cars.js';

// =====================================================================================
//  HAVEN METRO interior: stairs, tiled walls, landing, tunnel, turnstiles.
//  Underground nothing is lit by the sun/sky: every surface uses an unlit material whose vertex colours
//  carry baked light (fluorescent fixtures + daylight spilling down the open stairwell + contact AO + grime).
//  Cheap on Quest (no lights, no PBR), and it reads dark-but-readable instead of "sunlit bathroom".
// =====================================================================================
const SW = AVE.sidewalkY;
const RM0 = [0, 0, 0];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sst = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------- textures
let TX = null;
function textures() {
  if (TX) return TX;
  // glossy 3x6" subway tile, stacked running bond, bevelled edges + dark grout. 512 px = 0.6 m (4 x 8 tiles)
  const tile = (() => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), r = makeRng(9101), n = makeNoise(9102, 16);
    const tw = 128, th = 64, tone = []; for (let k = 0; k < 64; k++) tone.push((r() - 0.5) * 0.07);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const row = (y / th) | 0, off = row % 2 ? tw / 2 : 0, col = (((x + off) % S) / tw) | 0, lx = (x + off) % tw, ly = y % th;
      const e = Math.min(lx, ly, tw - 1 - lx, th - 1 - ly);
      let b = 0.9 + tone[(row * 4 + col) % 64] + (fbm(n, x / S, y / S, 4, 3) - 0.5) * 0.04;
      if (e < 3) b = 0.3 + e * 0.04;                              // grout (dirty)
      else if (e < 9) b *= ly < 9 || lx < 9 ? 1.06 : 0.86;        // bevel: lit top/left edge, shaded bottom/right
      const i = (y * S + x) * 4; img.data[i] = b * 255; img.data[i + 1] = b * 250; img.data[i + 2] = b * 238; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 7; k++) { // a few cracked tiles
      g.strokeStyle = 'rgba(70,62,52,0.55)'; g.lineWidth = 1; g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += (r() - 0.5) * 22; y += (r() - 0.3) * 14; g.lineTo(x, y); } g.stroke();
    }
    return canvasTex(c, { aniso: 8 });
  })();
  // terrazzo floor: warm grey base with chips, brass divider strip at the edge (512 px = 1.5 m)
  const terr = (() => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = makeRng(9201), n = makeNoise(9202, 8);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const b = 0.62 + (fbm(n, x / S, y / S, 3, 4) - 0.5) * 0.12, i = (y * S + x) * 4;
      img.data[i] = b * 255; img.data[i + 1] = b * 246; img.data[i + 2] = b * 232; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const chips = ['#e8e2d6', '#3a3836', '#8a5a3c', '#6f7466', '#b8ab94', '#2a2826'];
    for (let k = 0; k < 2600; k++) {
      g.fillStyle = chips[(r() * chips.length) | 0]; const x = r() * S, y = r() * S, s = 1 + r() * 4.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + r() * s); g.lineTo(x + r() * s, y + s); g.closePath(); g.fill();
    }
    g.fillStyle = '#8c7442'; g.fillRect(0, 0, S, 3); g.fillRect(0, 0, 3, S);   // divider strips
    g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(0, 1, S, 1); g.fillRect(1, 0, 1, S);
    return canvasTex(c, { aniso: 8 });
  })();
  // speckled granite (stair treads, skirting) — 256 px = 0.8 m
  const gran = (() => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), r = makeRng(9301), n = makeNoise(9302, 8);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = fbm(n, x / S, y / S, 4, 4), s = r(), b = 0.62 + (v - 0.5) * 0.18 + (s < 0.06 ? -0.28 : s > 0.96 ? 0.18 : 0), i = (y * S + x) * 4;
      img.data[i] = b * 255; img.data[i + 1] = b * 250; img.data[i + 2] = b * 244; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvasTex(c, { aniso: 8 });
  })();
  // stained concrete (ceiling, soffit) — 256 px = 2 m, with board-form lines
  const conc = (() => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), n = makeNoise(9402, 8), n2 = makeNoise(9403, 4);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let b = 0.6 + (fbm(n, x / S, y / S, 4, 5) - 0.5) * 0.22 - Math.max(0, fbm(n2, x / S, y / S, 2, 3) - 0.55) * 0.9;
      if (y % 64 < 2) b *= 0.8;
      const i = (y * S + x) * 4; img.data[i] = b * 255; img.data[i + 1] = b * 250; img.data[i + 2] = b * 242; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvasTex(c, { aniso: 4 });
  })();
  // signs: [0] "← TO TRAINS  ② ④ ⑦" lightbox, [1] HAVEN METRO line bullets strip (512 x 256 canvas, 2 rows)
  const sign = (() => {
    const W = 1024, H = 256, c = makeCanvas(W, H), g = c.getContext('2d');
    const FONT = '"Anton", Impact, "Arial Black", sans-serif';
    for (const [row, txt] of [[0, 'TO TRAINS'], [1, 'UPTOWN · DOWNTOWN']]) {
      const y0 = row * 128;
      g.fillStyle = '#0d2417'; g.fillRect(0, y0, W, 128);
      g.fillStyle = '#f2efe6'; g.fillRect(0, y0 + 6, W, 3); g.fillRect(0, y0 + 119, W, 3);
      // arrow
      g.beginPath(); const ax = 70, ay = y0 + 64; g.moveTo(ax - 42, ay); g.lineTo(ax, ay - 34); g.lineTo(ax, ay - 14); g.lineTo(ax + 46, ay - 14); g.lineTo(ax + 46, ay + 14); g.lineTo(ax, ay + 14); g.lineTo(ax, ay + 34); g.closePath(); g.fill();
      g.font = `400 ${row ? 58 : 72}px ${FONT}`; g.textBaseline = 'middle'; g.fillText(txt, 150, y0 + 66);
      const bullets = [['2', '#d23a2a'], ['4', '#1f9a4a'], ['7', '#8a3ab0']];
      bullets.forEach(([t, col], k) => {
        const x = W - 70 - (2 - k) * 92; g.fillStyle = col; g.beginPath(); g.arc(x, y0 + 64, 38, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = `400 52px ${FONT}`; g.textAlign = 'center'; g.fillText(t, x, y0 + 67); g.textAlign = 'left';
      });
      g.fillStyle = '#f2efe6';
    }
    return canvasTex(c, { repeat: false, aniso: 8 });
  })();
  TX = { tile, terr, gran, conc, sign };
  return TX;
}
let MATS = null;
function materials(propsAtlas) {
  if (MATS && MATS.props.map === propsAtlas) return MATS;
  const T = textures();
  const mk = (map, key) => { const m = new THREE.MeshBasicMaterial({ map, vertexColors: true }); m.name = 'subway-' + key; return m; };
  MATS = { tile: mk(T.tile, 'tile'), terr: mk(T.terr, 'terr'), gran: mk(T.gran, 'gran'), conc: mk(T.conc, 'conc'), sign: mk(T.sign, 'sign'), props: mk(propsAtlas, 'props') };
  return MATS;
}

// ---------------------------------------------------------------------- builder
// opts: { atlas (props atlas texture), A (atlas rects), PA (atlas size) }
export function buildSubwayInterior({ atlas, A, PA = 1024 }) {
  const S = SUBWAY, x0 = S.x0, x1 = S.x1, zT = S.zTop, zB = S.zBot, yB = S.yBot, zE = S.zEnd;
  const W = x1 - x0, xc = (x0 + x1) / 2, zH = zB - 3.4, zT2 = zE + 7, xT = x1 + 8;
  const ramp = (z) => streetGround(xc, z);
  const floorAt = (z) => (z <= zT ? SW : z < zB ? ramp(z) : yB);
  const YC = yB + 2.75;                              // landing / tunnel ceiling
  const ceil = (z) => (z < zH ? SW : Math.min(SW - 0.42, ramp(Math.min(z, zB)) + 2.75)); // flush with the lintel, then parallel to the stairs
  const rng = makeRng(5601), nz = makeNoise(5602, 16), nz2 = makeNoise(5603, 8);
  const M = materials(atlas);
  const BK = { tile: new Bucket(), terr: new Bucket(), gran: new Bucket(), conc: new Bucket(), sign: new Bucket(), props: new Bucket() };
  const glows = [];
  const rUV = (r) => [r[0] / PA, 1 - (r[1] + r[3]) / PA, (r[0] + r[2]) / PA, 1 - r[1] / PA];
  const WHITE = [16 / PA, 1 - 16 / PA];

  // ---- light rig (baked into vertex colours)
  const fix = [];
  for (let z = zH + 1.0, k = 0; z < zT2 - 0.6; z += 3.1, k++) fix.push([xc, ceil(z) - 0.1, z, k === 3 ? 0 : 1]); // one tube is dead
  for (let x = x1 + 1.4; x < xT - 1; x += 2.6) fix.push([x, YC - 0.1, zT2 - W / 2, 0.5]);
  const light = (p, n) => {
    let r = 0.022, g = 0.025, b = 0.03;                        // cold ambient
    for (const [fx, fy, fz, k] of fix) {
      const dx = fx - p[0], dy = fy - p[1], dz = fz - p[2], d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) || 1;
      const lam = Math.max(0, (n[0] * dx + n[1] * dy + n[2] * dz) / d) * 0.85 + 0.15;
      const I = k * 0.95 * lam / (1 + d2 * 0.62);
      r += I; g += I * 0.98; b += I * 0.9;
    }
    // dusk daylight falling down the open front of the stairwell (warm, from above)
    const t = sst(zH + 2.5, zT + 0.5, p[2]), up = 0.55 + 0.45 * clamp((p[1] - floorAt(p[2])) / 3.5, 0, 1);
    const day = t * up * (0.55 + 0.45 * Math.max(0, n[1]) + 0.25 * Math.max(0, -n[2]));
    r += day * 0.95; g += day * 0.78; b += day * 0.64;
    return [r, g, b];
  };
  const grime = (p, k = 1) => 1 - k * 0.3 * clamp((fbm(nz, p[0] * 0.35 + p[1] * 0.5, p[2] * 0.35 + p[1] * 0.2, 2, 4) - 0.35) * 2, 0, 1);
  const shade = (p, n, alb, extra = 1) => { const L = light(p, n), k = extra; return [alb[0] * L[0] * k, alb[1] * L[1] * k, alb[2] * L[2] * k]; };

  // generic tessellated sheet: pos(s,t) -> [x,y,z]; n: normal; uvf(p); colf(p,s,t) -> [r,g,b] (already lit)
  function sheet(bk, nu, nv, pos, n, uvf, colf) {
    const V = [];
    for (let i = 0; i <= nu; i++) { const row = []; for (let j = 0; j <= nv; j++) { const s = i / nu, t = j / nv, p = pos(s, t); row.push({ p, uv: uvf(p), c: colf(p, s, t) }); } V.push(row); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = V[i][j], b = V[i + 1][j], c = V[i + 1][j + 1], d = V[i][j + 1];
      bk.tri(a.p, b.p, c.p, n, n, n, a.uv, b.uv, c.uv, [...a.c, ...b.c, ...c.c], RM0);
      bk.tri(a.p, c.p, d.p, n, n, n, a.uv, c.uv, d.uv, [...a.c, ...c.c, ...d.c], RM0);
    }
  }
  // a transformed geometry with per-vertex baked colour; uv: 'world' (box-projected, sc m/repeat) or an atlas rect / 'white'
  const _v = new THREE.Vector3(), _n3 = new THREE.Matrix3();
  function baked(bk, geo, m4, alb, { uv = 'world', sc = 0.8, rect = null, emit = 0, ao = null } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    _n3.getNormalMatrix(m4);
    const ru = rect ? rUV(rect) : null;
    for (let i = 0; i < P.count; i += 3) {
      const pts = [], nrm = [], uvs = [], cols = [];
      for (let k = 0; k < 3; k++) {
        _v.fromBufferAttribute(P, i + k).applyMatrix4(m4); const p = [_v.x, _v.y, _v.z];
        _v.fromBufferAttribute(N, i + k).applyMatrix3(_n3).normalize(); const n = [_v.x, _v.y, _v.z];
        pts.push(p); nrm.push(n);
        if (ru && U) uvs.push([ru[0] + (ru[2] - ru[0]) * U.getX(i + k), ru[1] + (ru[3] - ru[1]) * U.getY(i + k)]);
        else if (uv === 'white') uvs.push(WHITE);
        else { const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]); uvs.push(ay >= ax && ay >= az ? [p[0] / sc, p[2] / sc] : ax >= az ? [p[2] / sc, p[1] / sc] : [p[0] / sc, p[1] / sc]); }
        const c = emit ? [alb[0] * emit, alb[1] * emit, alb[2] * emit] : shade(p, n, alb, ao ? ao(p, n) : 1);
        cols.push(...c);
      }
      bk.tri(pts[0], pts[1], pts[2], nrm[0], nrm[1], nrm[2], uvs[0], uvs[1], uvs[2], cols, RM0);
    }
  }
  const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const CYL = (r0, r1, h, s = 7) => new THREE.CylinderGeometry(r0, r1, h, s, 1, true);
  const segment = (bk, a, b, r, alb, opt) => { // cylinder from a to b
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B), mid = A.clone().add(B).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    baked(bk, CYL(r, r, L, 7), new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), alb, opt);
  };

  // ---- tiled walls: green wainscot / maroon cap band / cream field, bands follow the local floor line
  const CREAM = [0.88, 0.84, 0.72], GREEN = [0.32, 0.5, 0.39], MAROON = [0.56, 0.22, 0.15];
  const wallColour = (alb, p, f) => {
    const h = p[1] - f;
    const dirt = 1 - 0.42 * Math.exp(-Math.max(0, h) / 0.22);                   // kick-up dirt at the floor
    const streak = 1 - 0.34 * clamp((fbm(nz2, p[2] * 1.9 + p[0], p[1] * 0.1, 3, 3) - 0.45) * 3, 0, 1) * sst(0.6, 2.2, h); // water streaks from the ceiling
    const g = grime(p, 1.1) * streak * dirt, rust = 1 - 0.25 * clamp((fbm(nz, p[2] * 0.8, p[1] * 0.3 + 5, 2, 3) - 0.6) * 4, 0, 1);
    return [alb[0] * g, alb[1] * g * rust, alb[2] * g * rust * rust];
  };
  // wall along z at x = xw (normal nx), z in [za, zb]; top(z)
  function zWall(xw, nx, za, zb, top) {
    const n = [nx, 0, 0], nu = Math.max(2, Math.round((zb - za) / 0.45));
    const f = (z) => (z < zB ? ramp(Math.max(z, zT)) : yB);
    const band = (y0f, y1f, nv, alb) => sheet(BK.tile, nu, nv, (s, t) => { const z = za + (zb - za) * s, y0 = y0f(z), y1 = Math.max(y0, y1f(z)); return [xw, y0 + (y1 - y0) * t, z]; }, n,
      (p) => [p[2] / 0.6, p[1] / 0.6], (p) => { const c = wallColour(alb, p, f(p[2])); return shade(p, n, c); });
    band((z) => f(z) - 0.35, (z) => f(z) + 1.05, 4, GREEN);
    band((z) => f(z) + 1.05, (z) => f(z) + 1.16, 1, MAROON);
    band((z) => f(z) + 1.16, (z) => Math.max(f(z) + 1.16, top(z)), 6, CREAM);
  }
  // wall along x at z = zw (normal nz), x in [xa, xb], floor yB, top yB+2.6
  function xWall(zw, nzv, xa, xb) {
    const n = [0, 0, nzv], nu = Math.max(2, Math.round((xb - xa) / 0.45));
    const band = (y0, y1, nv, alb) => sheet(BK.tile, nu, nv, (s, t) => [xa + (xb - xa) * s, y0 + (y1 - y0) * t, zw], n, (p) => [p[0] / 0.6, p[1] / 0.6], (p) => shade(p, n, wallColour(alb, p, yB)));
    band(yB - 0.05, yB + 1.05, 3, GREEN); band(yB + 1.05, yB + 1.16, 1, MAROON); band(yB + 1.16, YC + 0.02, 4, CREAM);
  }
  const topZ = (z) => (z < zH ? SW : ceil(z) + 0.02);
  zWall(x0 + 0.004, 1, zT, zT2, topZ);
  zWall(x1 - 0.004, -1, zT, zT2 - W, topZ);
  xWall(zT2 - 0.004, -1, x0, xT);            // end wall of the tunnel + the turn
  xWall(zT2 - W + 0.004, 1, x1 - 0.004, xT); // far wall of the turn

  // ---- stairs: granite treads (worn centre, dirty edges), dark risers, aluminium nosing + yellow safety strip
  const n = 28, tl = (zB - zT) / n;
  const TREAD = [0.66, 0.64, 0.6], RISER = [0.42, 0.41, 0.39];
  for (let i = 0; i < n; i++) {
    const za = zT + i * tl, zb2 = za + tl, y = ramp((za + zb2) / 2), yPrev = i ? ramp(za - tl / 2) : SW;
    const tone = 0.94 + rng() * 0.1;
    sheet(BK.gran, 6, 1, (s, t) => [x0 + W * s, y, za + (zb2 - za) * t], [0, 1, 0], (p) => [p[0] / 0.8, p[2] / 0.8], (p, s, t) => {
      const wear = 1 + 0.12 * Math.exp(-((s - 0.5) * (s - 0.5)) / 0.04) - 0.34 * Math.exp(-Math.min(s, 1 - s) / 0.06);
      return shade(p, [0, 1, 0], TREAD.map((v) => v * tone * wear * (0.82 + 0.18 * t) * grime(p, 0.5))); // darker in the riser's corner
    });
    // riser: faces +z (you see it walking UP the stairs)
    sheet(BK.gran, 4, 1, (s, t) => [x0 + W * s, y + (yPrev - y) * t, za], [0, 0, 1], (p) => [p[0] / 0.8, p[1] / 0.8], (p, s, t) => shade(p, [0, 0, 1], RISER.map((v) => v * (0.75 + 0.25 * t) * (1 - 0.25 * Math.exp(-Math.min(s, 1 - s) / 0.08)))));
    // nosing on the front edge of the tread above: aluminium lip + yellow safety strip just behind it
    baked(BK.props, BOX(W - 0.07, 0.024, 0.04), M4(xc, yPrev - 0.008, za - 0.02), [0.48, 0.48, 0.46], { uv: 'white' });
    baked(BK.props, BOX(W - 0.5, 0.004, 0.022), M4(xc, yPrev + 0.003, za - 0.055), [0.5, 0.36, 0.05].map((v) => v * (0.75 + rng() * 0.3)), { uv: 'white' });
  }
  // sloped granite skirting along both walls (stringer) — hides the tread/wall joint; then a baseboard along the tunnel
  for (const [xw, s] of [[x0 + 0.035, 1], [x1 - 0.035, -1]]) {
    const zEndBase = xw < xc ? zT2 : zT2 - W;
    sheet(BK.gran, 20, 1, (u, t) => { const z = zT + (zB - zT) * u; return [xw, ramp(z) - 0.22 + 0.5 * t, z]; }, [s, 0, 0], (p) => [p[2] / 0.8, p[1] / 0.8], (p) => shade(p, [s, 0, 0], [0.3, 0.29, 0.28]));
    sheet(BK.gran, 20, 1, (u, t) => { const z = zT + (zB - zT) * u, yy = ramp(z) + 0.28; return [xw - s * 0.035 * (1 - t), yy, z]; }, [0, 1, 0], (p) => [p[2] / 0.8, p[0] / 0.8], (p) => shade(p, [0, 1, 0], [0.36, 0.35, 0.33]));
    sheet(BK.gran, 12, 1, (u, t) => [xw, yB - 0.02 + 0.18 * t, zB + (zEndBase - zB) * u], [s, 0, 0], (p) => [p[2] / 0.8, p[1] / 0.8], (p) => shade(p, [s, 0, 0], [0.3, 0.29, 0.28]));
  }

  // ---- floors: terrazzo landing + tunnel + turn, darker towards the walls, worn path down the middle
  const floorCol = (p) => {
    const dw = p[0] > x1 ? Math.min(p[2] - (zT2 - W), zT2 - p[2]) : Math.min(p[0] - x0, x1 - p[0]);
    const k = (0.62 + 0.38 * sst(0, 0.55, dw)) * grime(p, 0.9) * (1 - 0.18 * clamp((fbm(nz2, p[0] * 0.6, p[2] * 0.6, 2, 3) - 0.55) * 4, 0, 1));
    return shade(p, [0, 1, 0], [0.8 * k, 0.78 * k, 0.74 * k]);
  };
  sheet(BK.terr, 8, Math.round((zT2 - zB) / 0.5), (s, t) => [x0 + W * s, yB, zB + (zT2 - zB) * t], [0, 1, 0], (p) => [p[0] / 1.5, p[2] / 1.5], floorCol);
  sheet(BK.terr, 16, 8, (s, t) => [x1 + (xT - x1) * s, yB, zT2 - W + W * t], [0, 1, 0], (p) => [p[0] / 1.5, p[2] / 1.5], floorCol);

  // ---- ceiling: stained concrete soffit following the stairs, then flat; lintel where the covered part starts
  const CEIL = [0.5, 0.49, 0.47];
  sheet(BK.conc, 4, Math.round((zT2 - zH) / 0.45), (s, t) => { const z = zH + (zT2 - zH) * t; return [x0 + W * s, ceil(z), z]; }, [0, -1, 0], (p) => [p[0] / 2, p[2] / 2], (p) => shade(p, [0, -1, 0], CEIL.map((v) => v * grime(p, 1))));
  sheet(BK.conc, 16, 4, (s, t) => [x1 + (xT - x1) * s, YC, zT2 - W + W * t], [0, -1, 0], (p) => [p[0] / 2, p[2] / 2], (p) => shade(p, [0, -1, 0], CEIL.map((v) => v * grime(p, 1))));
  {
    const yL0 = SW - 0.42, zl = zH - 0.02;
    sheet(BK.tile, 8, 2, (s, t) => [x0 + W * s, yL0 + (SW + 0.02 - yL0) * t, zl], [0, 0, -1], (p) => [p[0] / 0.6, p[1] / 0.6], (p) => shade(p, [0, 0, -1], CREAM.map((v) => v * grime(p, 0.5))));
    sheet(BK.tile, 8, 1, (s, t) => [x0 + W * s, yL0 + 0.06 * t, zl - 0.001], [0, 0, -1], (p) => [p[0] / 0.6, p[1] / 0.6], (p) => shade(p, [0, 0, -1], MAROON));
    // "TO TRAINS" lightbox on the lintel (faces up the stairs)
    const sx = 2.1, sy = 0.27;
    baked(BK.props, BOX(sx + 0.08, sy + 0.08, 0.08), M4(xc, yL0 + 0.24, zl - 0.045), [0.05, 0.08, 0.06], { uv: 'white' });
    signQuad([xc, yL0 + 0.24, zl - 0.09], [-1, 0, 0], sx, sy, 0, 1.35);
  }
  function signQuad(c, right, w, h, row, emit) {
    const up = [0, 1, 0], nrm = new THREE.Vector3(...right).cross(new THREE.Vector3(...up)).normalize().toArray();
    const P = (a, b) => [c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b];
    const v0 = row ? 0 : 0.5, v1 = row ? 0.5 : 1, col = [emit, emit, emit];
    const a = P(-w / 2, -h / 2), b = P(w / 2, -h / 2), cc = P(w / 2, h / 2), d = P(-w / 2, h / 2);
    BK.sign.tri(a, b, cc, nrm, nrm, nrm, [0, v0], [1, v0], [1, v1], col, RM0);
    BK.sign.tri(a, cc, d, nrm, nrm, nrm, [0, v0], [1, v1], [0, v1], col, RM0);
  }

  // ---- fluorescent fixtures (housing + diffuser), conduit runs along the ceiling corners
  for (const [fx, fy, fz, k] of fix) {
    const alongX = fx > x1;
    baked(BK.props, alongX ? BOX(1.25, 0.07, 0.24) : BOX(0.24, 0.07, 1.25), M4(fx, fy + 0.06, fz), [0.35, 0.36, 0.36], { uv: 'white' });
    baked(BK.props, alongX ? BOX(1.15, 0.014, 0.17) : BOX(0.17, 0.014, 1.15), M4(fx, fy + 0.02, fz), k ? [0.95, 1.0, 0.92] : [0.18, 0.18, 0.17], { uv: 'white', emit: k ? 1.6 * (0.6 + 0.4 * k) : 1 });
    if (k) glows.push({ p: [fx, fy - 0.02, fz], color: [0.55 * k, 0.6 * k, 0.52 * k], size: 1.5 });
  }
  for (const xw of [x0 + 0.22, x1 - 0.22]) {
    let prev = null;
    for (let z = zH + 0.3; z <= zT2 - 0.1; z += 0.8) {
      const p = [xw, ceil(z) - 0.07, z];
      if (prev) segment(BK.props, prev, p, 0.028, [0.3, 0.34, 0.3], { uv: 'white' });
      if (Math.round(z / 0.8) % 3 === 0) baked(BK.props, BOX(0.08, 0.03, 0.03), M4(xw, ceil(z) - 0.025, z), [0.25, 0.25, 0.25], { uv: 'white' });
      prev = p;
    }
    baked(BK.props, BOX(0.18, 0.18, 0.08), M4(xw, ceil(zB + 2) - 0.14, zB + 2), [0.32, 0.34, 0.33], { uv: 'white' }); // junction box
  }

  // ---- handrails (wall-mounted, brushed steel) with brackets
  const STEEL = [0.66, 0.66, 0.64];
  for (const [x, s] of [[x0 + 0.1, 1], [x1 - 0.1, -1]]) {
    const pts = [[zT + 0.15, SW + 0.92], [zB, yB + 0.92], [zE + 1.2, yB + 0.92]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [za, ya] = pts[i], [zb2, yb] = pts[i + 1];
      segment(BK.props, [x, ya, za], [x, yb, zb2], 0.024, STEEL, { uv: 'white' });
      const L = Math.hypot(zb2 - za, yb - ya), nb = Math.max(1, Math.round(L / 1.4));
      for (let k = 0; k <= nb; k++) { const t = k / nb, z = za + (zb2 - za) * t, y = ya + (yb - ya) * t; segment(BK.props, [x - s * 0.07, y - 0.05, z], [x, y - 0.01, z], 0.012, STEEL, { uv: 'white' }); }
    }
  }

  // ---- station name mosaics, posters, system map
  const framed = (xw, s, z, y, w, h, rect, rot = 1) => {
    baked(BK.props, BOX(0.03, h + 0.1, w + 0.1), M4(xw + s * 0.012, y, z), MAROON, { uv: 'white' });
    const nrm = [s, 0, 0], right = [0, 0, -s * rot], p = [xw + s * 0.03, y, z], col = shade(p, nrm, [0.95, 0.95, 0.95]);
    const r = rUV(rect), P = (a, b) => [p[0], p[1] + b, p[2] + right[2] * a];
    BK.props.tri(P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), nrm, nrm, nrm, [r[0], r[1]], [r[2], r[1]], [r[2], r[3]], col, RM0);
    BK.props.tri(P(-w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2), nrm, nrm, nrm, [r[0], r[1]], [r[2], r[3]], [r[0], r[3]], col, RM0);
  };
  for (const [xw, s] of [[x0 + 0.004, 1], [x1 - 0.004, -1]]) {
    for (let z = zH + 1.2; z < zT2 - 1.2; z += 3.6) {
      if (s < 0 && z > zT2 - W - 1.6) continue;
      const f = z < zB ? ramp(z) : yB, y = f + 1.72;
      if (y + 0.25 > ceil(z) - 0.1) continue;
      framed(xw, s, z, y, 2.6, 0.33, A.station);
    }
  }
  framed(x0 + 0.004, 1, zB + 3.1, yB + 1.35, 0.72, 1.08, A.poster);
  framed(x0 + 0.004, 1, zE + 2.6, yB + 1.35, 0.72, 1.08, A.ad2);
  framed(x1 - 0.004, -1, zB + 4.3, yB + 1.45, 1.35, 0.9, A.map);
  // hanging "TO TRAINS" sign over the landing (both faces) + one on the end wall
  baked(BK.props, BOX(0.02, 0.52, 0.02), M4(xc - 0.8, yB + 2.5, zB + 2.6), [0.2, 0.2, 0.2], { uv: 'white' });
  baked(BK.props, BOX(0.02, 0.52, 0.02), M4(xc + 0.8, yB + 2.5, zB + 2.6), [0.2, 0.2, 0.2], { uv: 'white' });
  baked(BK.props, BOX(2.0, 0.34, 0.07), M4(xc, yB + 2.1, zB + 2.6), [0.05, 0.08, 0.06], { uv: 'white' });
  signQuad([xc, yB + 2.1, zB + 2.6 - 0.037], [-1, 0, 0], 1.9, 0.26, 0, 1.25);
  signQuad([xc, yB + 2.1, zB + 2.6 + 0.037], [1, 0, 0], 1.9, 0.26, 1, 1.0);
  baked(BK.props, BOX(2.3, 0.42, 0.06), M4(xc, yB + 1.95, zT2 - 0.035), [0.05, 0.08, 0.06], { uv: 'white' });
  signQuad([xc, yB + 1.95, zT2 - 0.07], [-1, 0, 0], 2.2, 0.32, 0, 1.15);

  // ---- turnstile line before the tunnel turns (steel cabinets, tripod arms, status lamps)
  const zTS = zT2 - W - 0.9;
  for (let k = 0; k < 4; k++) {
    const x = x0 + 0.16 + k * (W - 0.32) / 3;
    baked(BK.props, BOX(0.2, 0.92, 0.86), M4(x, yB + 0.46, zTS), [0.6, 0.6, 0.58], { uv: 'white' });
    baked(BK.props, BOX(0.24, 0.05, 0.9), M4(x, yB + 0.945, zTS), [0.16, 0.16, 0.16], { uv: 'white' });
    baked(BK.props, BOX(0.06, 0.04, 0.06), M4(x, yB + 0.99, zTS - 0.3), k % 2 ? [0.2, 1.0, 0.35] : [1.0, 0.2, 0.12], { uv: 'white', emit: 1.6 });
    if (k < 3) for (let a = 0; a < 3; a++) { // tripod: three arms 120° apart around an axis tilted 45°
      const hub = [x + 0.11, yB + 0.82, zTS - 0.1], ang = a * Math.PI * 2 / 3;
      const d = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 4);
      segment(BK.props, hub, [hub[0] + Math.abs(d.x) * 0.42 + 0.02, hub[1] + d.y * 0.42, hub[2] + d.z * 0.42], 0.018, STEEL, { uv: 'white' });
    }
    glows.push({ p: [x, yB + 1.0, zTS - 0.3], color: k % 2 ? [0.1, 0.6, 0.2] : [0.6, 0.1, 0.06], size: 0.22 });
  }

  // ---- litter + puddle stains on the landing
  for (let k = 0; k < 9; k++) {
    const r = A.papers[k % A.papers.length], x = x0 + 0.3 + rng() * (W - 0.6), z = zB + 0.5 + rng() * (zT2 - zB - 3), a = rng() * 6.28, s = 0.18 + rng() * 0.14;
    const c = Math.cos(a), sn = Math.sin(a), u = rUV(r), y = yB + 0.004, nrm = [0, 1, 0], col = shade([x, y, z], nrm, [0.8, 0.78, 0.72]);
    const P = (dx, dz) => [x + dx * c - dz * sn, y, z + dx * sn + dz * c];
    BK.props.tri(P(-s, -s), P(s, -s), P(s, s), nrm, nrm, nrm, [u[0], u[1]], [u[2], u[1]], [u[2], u[3]], col, RM0);
    BK.props.tri(P(-s, -s), P(s, s), P(-s, s), nrm, nrm, nrm, [u[0], u[1]], [u[2], u[3]], [u[0], u[3]], col, RM0);
  }

  // ---- assemble
  const root = new THREE.Group(); root.name = 'subway-interior';
  for (const [k, bk] of Object.entries(BK)) {
    if (!bk.tris) continue;
    const m = new THREE.Mesh(bk.geometry(), M[k]);
    m.receiveShadow = false; m.castShadow = false;
    root.add(m);
  }
  return { root, glows, materials: Object.values(M) };
}
