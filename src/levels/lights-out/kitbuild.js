import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { em, mul3, hexc, GOLD, LANTERN, SODIUM, DUSK, signQuad, hipRoof } from './kit.js';
import { SIGN, SIGN_LIST } from './signs.js';

// =====================================================================================
//  LIGHTS OUT — the street kit. Builders write into region buckets (kit.js Buckets) in a LOCAL
//  frame given by a Matrix4 (x along the street front, +z out of the facade into the street,
//  y = world height), and report anchors in WORLD space: light-map lamps, glow halos, breakable
//  shop panes, colliders.
//
//  shopRow: the Chongqing street wall — narrow lots, a shop at street level (glass + lit interior or
//  a half-up roller shutter, a lightbox fascia in Chinese, blade signs, awnings, fluorescent tubes),
//  old tiled floors above with projecting burglar-bar cages, AC condensers, laundry poles,
//  balconies with plants, drainpipes and cable runs; rooftop shacks and water tanks.
// =====================================================================================
const _v = new THREE.Vector3(), _n = new THREE.Vector3();
export class Frame {
  constructor(M) { this.M = M; this.N3 = new THREE.Matrix3().getNormalMatrix(M); }
  p(x, y, z) { return _v.set(x, y, z).applyMatrix4(this.M).toArray(); }
  n(x, y, z) { return _n.set(x, y, z).applyMatrix3(this.N3).normalize().toArray(); }
  box(x0, y0, z0, x1, y1, z1) { const a = _v.set(x0, y0, z0).applyMatrix4(this.M).clone(), b = _v.set(x1, y1, z1).applyMatrix4(this.M).clone(); return { min: [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)], max: [Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)] }; }
}
// M for a front running along world x (face = +1: facing +z, -1: facing -z) or along world z (face ±x)
export function frontM(axis, face, origin) {
  const M = new THREE.Matrix4();
  if (axis === 'x') { if (face > 0) M.makeRotationY(0); else M.makeRotationY(Math.PI); }
  else { if (face > 0) M.makeRotationY(Math.PI / 2); else M.makeRotationY(-Math.PI / 2); }
  M.setPosition(origin[0], 0, origin[1]);
  return M;
}

const WALL = [hexc(0xd6c8b0), hexc(0xc9b9a6), hexc(0xb9b2a5), hexc(0xd8d2c4), hexc(0xc4a593), hexc(0xa9a196), hexc(0xcfbf98), hexc(0xb3a48c)];
const AWN = [hexc(0xa8231b), hexc(0x1f5f9c), hexc(0x2d7a3c), hexc(0xd0a020), hexc(0x7a2a6a), hexc(0xb34a1a)];
const CLOTH = [hexc(0xc8341e), hexc(0xe8e2d4), hexc(0x2a4c8a), hexc(0xd9b13b), hexc(0x2f6b3a), hexc(0x8a2a6a), hexc(0x141414), hexc(0xb0b7c4)];

// one shop + the floors over it. u0..u1 along the front (local x), y = street floor, depth into the block
export function shopLot(B, reg, F, A, o) {
  const { u0, u1, y, seed, code } = o;
  const r = makeRng(seed);
  const w = u1 - u0, depth = o.depth ?? 10, gh = 4.4;
  const storeys = o.storeys ?? (2 + Math.floor(r() * 4));
  const fh = 3.0, top = y + gh + storeys * fh;
  const wall = WALL[Math.floor(r() * WALL.length)];
  const save = (k) => B.get(k, reg).push(F.M);
  const done = (k, s) => B.get(k, reg).pop(s);
  // ---- ground floor: piers either side, a lintel, the fascia band
  {
    const C = B.get('concrete', reg), s = save('concrete');
    C.set({ col: mul3(wall, 0.75), rm: [0.85, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    C.box(u0, y, -0.6, u0 + 0.45, y + gh, 0, { faces: 'xXZ', s: 1 }); C.box(u1 - 0.45, y, -0.6, u1, y + gh, 0, { faces: 'xXZ', s: 1 });
    C.box(u0, y + gh - 0.5, -0.6, u1, y + gh, 0.05, { faces: 'yZ', s: 1 });
    done('concrete', s);
  }
  const shut = r() < 0.32;
  const inner = { u0: u0 + 0.45, u1: u1 - 0.45 };
  // the interior: a lit box behind the glass (shelves / tables suggested by the poster + bands)
  {
    const P = B.get('plain', reg), s = save('plain');
    const warm = r() < 0.7 ? [1.0, 0.72, 0.42] : [0.8, 0.9, 1.0];
    P.set({ col: mul3(wall, 0.4), rm: [0.9, 0, 0], em: em(warm, shut ? 0.0 : 0.16, DUSK + code) });
    P.room(inner.u0, y, -4.5, inner.u1, y + gh - 0.5, -0.6, { faces: 'zxXYy' });
    // a bright ceiling tube row
    P.set({ col: [1, 1, 1], em: em(warm, shut ? 0 : 3.5, DUSK + code) });
    P.box(inner.u0 + 0.6, y + gh - 0.62, -2.6, inner.u1 - 0.6, y + gh - 0.56, -2.45, { faces: 'y' });
    P.set({ col: [1, 1, 1], em: em(warm, shut ? 0 : 3.5, DUSK + code) });
    // counters / shelves: dark slabs catching the light
    P.set({ col: [0.25, 0.2, 0.16], em: [0, 0, 0, 0] });
    P.box(inner.u0 + 0.3, y, -4.4, inner.u1 - 0.3, y + 2.0, -3.9, { faces: 'Zy' });
    P.box(inner.u0 + 0.5, y, -2.2, inner.u0 + 0.5 + Math.min(2.4, w * 0.35), y + 1.0, -1.4, { faces: 'xXzZY' });
    done('plain', s);
    const S = B.get('sign', reg), s2 = S.push(F.M);
    S.set({ col: [0.9, 0.9, 0.9], rm: [0.6, 0, 0], em: em([1, 1, 1], shut ? 0 : 0.6, DUSK + code) });
    const pn = SIGN_LIST.posters[Math.floor(r() * 3)];
    signQuad(S, [(inner.u0 + inner.u1) / 2 + (r() - 0.5) * w * 0.3, y + 2.6, -4.42], [0, 0, 1], 1.1, 1.55, SIGN[pn]);
    S.pop(s2);
  }
  if (shut) {
    // a roller shutter, half up, with a strip of light under it
    const M = B.get('metal', reg), s = save('metal');
    const hU = 1.2 + r() * 1.6;
    M.set({ col: [0.55, 0.56, 0.58], rm: [0.55, 0.6, 0], em: [0, 0, 0, 0] });
    M.box(inner.u0, y + hU, -0.62, inner.u1, y + gh - 0.5, -0.5, { faces: 'Z', s: 1 });
    M.box(inner.u0 - 0.05, y + gh - 0.9, -0.62, inner.u1 + 0.05, y + gh - 0.5, -0.2, { faces: 'ZyY', s: 1 });
    done('metal', s);
    o.colliders?.push({ ...F.box(inner.u0, y, -0.7, inner.u1, y + gh - 0.5, -0.5), data: { mat: 'metal', kind: 'wall' } });
  } else {
    // shop glass: two or three breakable panes, an aluminium frame
    const n = w > 6 ? 3 : 2, pw = (inner.u1 - inner.u0) / n;
    for (let i = 0; i < n; i++) {
      const cu = inner.u0 + pw * (i + 0.5);
      o.panes?.push({ c: F.p(cu, y + 0.25 + (gh - 0.9) / 2, -0.55), n: F.n(0, 0, 1), w: pw - 0.12, h: gh - 0.9, kind: 'store' });
    }
    const M = B.get('metal', reg), s = save('metal');
    M.set({ col: [0.6, 0.62, 0.64], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
    for (let i = 0; i <= n; i++) M.box(inner.u0 + pw * i - 0.05, y, -0.6, inner.u0 + pw * i + 0.05, y + gh - 0.5, -0.5, { faces: 'xXZ' });
    M.box(inner.u0, y, -0.6, inner.u1, y + 0.25, -0.48, { faces: 'ZY' });
    done('metal', s);
    o.colliders?.push({ ...F.box(inner.u0, y, -4.6, inner.u1, y + gh - 0.5, -0.65), data: { mat: 'concrete', kind: 'wall', noBullet: false } });
  }
  // lightbox fascia sign across the shop (the light of the street)
  {
    const S = B.get('sign', reg), s = S.push(F.M);
    const sn = o.shopSign || SIGN_LIST.shops[Math.floor(r() * SIGN_LIST.shops.length)];
    S.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 0.75, DUSK + code) });
    signQuad(S, [(u0 + u1) / 2, y + gh + 0.55, 0.32], [0, 0, 1], w - 0.4, Math.min(1.3, (w - 0.4) / 4), SIGN[sn]);
    S.pop(s);
    const M = B.get('metal', reg), s2 = save('metal');
    M.set({ col: [0.3, 0.3, 0.32], rm: [0.5, 0.5, 0], em: [0, 0, 0, 0] });
    M.box(u0 + 0.15, y + gh - 0.12, 0.05, u1 - 0.15, y + gh + 1.25, 0.3, { faces: 'xXyY' });
    done('metal', s2);
    o.glows?.push({ p: F.p((u0 + u1) / 2, y + gh + 0.55, 0.7), color: [0.55, 0.42, 0.3], size: Math.min(3.2, w * 0.38), code: DUSK + code });
  }
  // light spilling out onto the pavement (light map)
  if (!shut) o.lights?.push({ p: F.p((u0 + u1) / 2, y + 3.2, 0.6), color: [1, 0.7, 0.42], r: 5.5, k: 0.9, grp: o.grp ?? 0 });
  o.lights?.push({ p: F.p((u0 + u1) / 2, y + gh + 0.6, 1.4), color: [1, 0.8, 0.6], r: 4, k: 0.5, grp: o.grp ?? 0 });
  // blade sign (vertical, projecting) on some lots
  if (r() < 0.55) {
    const S = B.get('sign', reg), s = S.push(F.M);
    const bn = SIGN_LIST.blades[Math.floor(r() * SIGN_LIST.blades.length)];
    const bu = r() < 0.5 ? u0 + 0.6 : u1 - 0.6, by = y + gh + 2.6 + r() * 2;
    S.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 0.85, DUSK + code) });
    const bw = 0.75, bh = 3.0;
    // two faces (both sides of the blade), the blade sticks out along +z
    const c = [bu, by, 0.9];
    const q = (nx) => { const a = [bu, by - bh / 2, 0.9 - bw / 2 * nx], b2 = [bu, by - bh / 2, 0.9 + bw / 2 * nx], cc = [bu, by + bh / 2, 0.9 + bw / 2 * nx], d = [bu, by + bh / 2, 0.9 - bw / 2 * nx]; const uv = SIGN[bn]; S.quad(nx > 0 ? a : b2, nx > 0 ? b2 : a, nx > 0 ? cc : d, nx > 0 ? d : cc, [uv[0], uv[1], uv[2], uv[3]]); };
    S.push(new THREE.Matrix4().makeTranslation(0, 0, 0));
    // faces pointing ±x (local)
    S.quad([bu + 0.06, by - bh / 2, 0.45], [bu + 0.06, by - bh / 2, 1.35], [bu + 0.06, by + bh / 2, 1.35], [bu + 0.06, by + bh / 2, 0.45], [SIGN[bn][2], SIGN[bn][1], SIGN[bn][0], SIGN[bn][3]]);
    S.quad([bu - 0.06, by - bh / 2, 1.35], [bu - 0.06, by - bh / 2, 0.45], [bu - 0.06, by + bh / 2, 0.45], [bu - 0.06, by + bh / 2, 1.35], [SIGN[bn][2], SIGN[bn][1], SIGN[bn][0], SIGN[bn][3]]);
    S.pop(s); void q; void c;
    o.glows?.push({ p: F.p(bu, by, 1.0), color: [0.6, 0.42, 0.3], size: 1.8, code: DUSK + code });
  }
  // awning (some lots)
  if (r() < 0.35) {
    const D = B.get('dbl', reg), s = save('dbl');
    D.set({ col: AWN[Math.floor(r() * AWN.length)], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    D.quad([u0 + 0.2, y + 3.4, 1.5], [u1 - 0.2, y + 3.4, 1.5], [u1 - 0.2, y + 3.95, 0.1], [u0 + 0.2, y + 3.95, 0.1]);
    done('dbl', s);
  }
  // ---- the floors above: old tiled walls with procedural windows, cages, AC units, laundry, balconies
  {
    const T = B.get('tile', reg), s = save('tile');
    T.set({ col: wall, rm: [0.85, 0, 0], em: [0, 0, 0, code], cell: [2.6 + r() * 0.8, fh, seed % 97, 2] });
    T.box(u0, y + gh, -depth, u1, top, 0, { faces: 'Z', s: 1, wy0: y + gh });
    T.set({ cell: [0, 0, 0, 0] });
    if (o.ends) T.box(u0, y, -depth, u1, top, 0, { faces: o.ends, s: 1 });
    done('tile', s);
    const M = B.get('metal', reg), sm = save('metal');
    const P = B.get('plain', reg), sp = save('plain');
    const D = B.get('dbl', reg), sd = save('dbl');
    const bayW = (T.cellv?.[0]) || 3;
    for (let f = 0; f < storeys; f++) {
      const fy = y + gh + f * fh;
      // a balcony slab across part of the front on some floors
      if (r() < 0.35) { const C = B.get('concrete', reg), sc = save('concrete'); C.set({ col: mul3(wall, 0.85), rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); C.box(u0 + 0.3, fy - 0.15, 0, u1 - 0.3, fy + 0.08, 1.1, { faces: 'xXyYZ', s: 1 }); C.box(u0 + 0.3, fy + 0.08, 1.0, u1 - 0.3, fy + 1.0, 1.1, { faces: 'zZY', s: 1 }); done('concrete', sc); }
      for (let u = u0 + 0.6; u < u1 - 1.2; u += 2.9) {
        const k = r();
        if (k < 0.3) {
          // a burglar-bar cage bolted round the window (the Chongqing facade)
          M.set({ col: [0.32, 0.33, 0.34], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
          const cx0 = u, cx1 = Math.min(u1 - 0.5, u + 2.2), cy0 = fy + 0.6, cy1 = fy + 2.7, cz = 0.55;
          M.box(cx0, cy0, 0, cx1, cy0 + 0.05, cz, { faces: 'yY' }); M.box(cx0, cy1 - 0.05, 0, cx1, cy1, cz, { faces: 'yY' });
          for (let b = cx0; b <= cx1 + 1e-3; b += 0.22) M.box(b - 0.015, cy0, cz - 0.03, b + 0.015, cy1, cz, { faces: 'xXZ' });
          M.box(cx0, cy0, 0, cx0 + 0.04, cy1, cz, { faces: 'x' }); M.box(cx1 - 0.04, cy0, 0, cx1, cy1, cz, { faces: 'X' });
          if (r() < 0.5) { P.set({ col: CLOTH[Math.floor(r() * CLOTH.length)], rm: [0.9, 0, 0], em: [0, 0, 0, 0] }); P.box(cx0 + 0.2, cy1 - 1.0, cz - 0.3, cx0 + 0.2 + 0.5 + r() * 0.8, cy1 - 0.1, cz - 0.25, { faces: 'zZ' }); }
        } else if (k < 0.62) {
          // an AC condenser on a bracket with its drip stain
          P.set({ col: [0.82, 0.82, 0.8], rm: [0.6, 0.1, 0], em: [0, 0, 0, 0] });
          const ax = u + r() * 1.2, ay = fy + 0.3 + r() * 0.4;
          P.box(ax, ay, 0.05, ax + 0.8, ay + 0.55, 0.38, { faces: 'xXzZyY' });
          P.set({ col: [0.2, 0.2, 0.22] }); P.box(ax + 0.12, ay + 0.1, 0.38, ax + 0.5, ay + 0.47, 0.39, { faces: 'Z' });
        } else if (k < 0.78) {
          // a laundry pole sticking out with clothes on it
          M.set({ col: [0.6, 0.6, 0.62], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
          const ly = fy + 2.5; M.box(u, ly - 0.02, 0, u + 0.04, ly + 0.02, 1.6, { faces: 'xXyY' }); M.box(u + 1.6, ly - 0.02, 0, u + 1.64, ly + 0.02, 1.6, { faces: 'xXyY' });
          M.box(u, ly - 0.015, 1.55, u + 1.64, ly + 0.015, 1.59, { faces: 'yYzZ' });
          for (let c = 0; c < 3; c++) { D.set({ col: CLOTH[Math.floor(r() * CLOTH.length)], rm: [0.95, 0, 0], em: [0, 0, 0, 0] }); const cu = u + 0.15 + c * 0.5, cl = 0.5 + r() * 0.5; D.quad([cu, ly - cl, 1.57], [cu + 0.4, ly - cl, 1.57], [cu + 0.4, ly, 1.57], [cu, ly, 1.57]); }
        }
      }
    }
    // a drainpipe and a cable run down one side
    M.set({ col: [0.35, 0.36, 0.34], rm: [0.6, 0.3, 0], em: [0, 0, 0, 0] });
    M.box(u1 - 0.3, y, 0.02, u1 - 0.18, top, 0.14, { faces: 'xXZ' });
    P.set({ col: [0.06, 0.06, 0.06], rm: [0.7, 0, 0] }); P.box(u0 + 0.2, y + gh, 0.02, u0 + 0.26, top - 0.5, 0.08, { faces: 'xXZ' });
    done('metal', sm); done('plain', sp); done('dbl', sd);
  }
  // ---- roof: parapet, a water tank, a tin shack or a garden
  {
    const C = B.get('concrete', reg), s = save('concrete');
    C.set({ col: mul3(wall, 0.7), rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
    C.box(u0, top, -depth, u1, top + 1.0, 0, { faces: 'ZYxXz', s: 1 });
    if (r() < 0.6) { C.set({ col: [0.55, 0.56, 0.6] }); C.cyl(u0 + 1.2 + r() * (w - 2.4), top + 1, -depth * 0.4, 0.8, 0.8, top + 2.8, 8); }
    if (r() < 0.4) { const M = B.get('metal', reg), sm = save('metal'); M.set({ col: [0.45, 0.4, 0.34], rm: [0.7, 0.4, 0], em: [0, 0, 0, 0] }); M.box(u0 + 0.5, top + 1, -depth + 1, u0 + 0.5 + Math.min(4, w - 1), top + 3.4, -depth + 4, { faces: 'xXzZY', s: 1 }); done('metal', sm); }
    done('concrete', s);
  }
  o.colliders?.push({ ...F.box(u0, y, -depth, u1, top, -0.5), data: { mat: 'concrete', kind: 'wall' } });
  return { top };
}

export function shopRow(B, reg, F, o) {
  const r = makeRng(o.seed);
  let u = o.u0, i = 0;
  const tops = [];
  while (u < o.u1 - 3) {
    const w = Math.min(o.u1 - u, (o.lotW ?? 6) + r() * (o.lotV ?? 4));
    const last = o.u1 - (u + w) < 3;
    const { top } = shopLot(B, reg, F, null, { ...o, u0: u, u1: last ? o.u1 : u + w, seed: o.seed * 31 + i * 7, ends: (i === 0 && o.endL ? 'x' : '') + (last && o.endR ? 'X' : ''), shopSign: o.signs?.[i] });
    tops.push(top);
    u = last ? o.u1 : u + w; i++;
  }
  return tops;
}

// a street lamp: a dark steel pole with one or two arms (gold heads) — on at dusk
export function lampPost(B, reg, x, y, z, { dir = [0, 0, 1], h = 7.5, two = false, code = 0, lights, glows, grp = 0, col = [1.0, 0.7, 0.36] } = {}) {
  const M = B.get('metal', reg), L = B.get('plain', reg);
  M.set({ col: [0.16, 0.17, 0.18], rm: [0.5, 0.6, 0], em: [0, 0, 0, 0] });
  M.cyl(x, y, z, 0.14, 0.09, y + h, 8, { cap: true });
  M.cyl(x, y, z, 0.24, 0.22, y + 0.5, 8);
  const heads = two ? [dir, [-dir[0], 0, -dir[2]]] : [dir];
  for (const d of heads) {
    const hx = x + d[0] * 1.5, hz = z + d[2] * 1.5;
    M.beam([x, y + h - 0.2, z], [hx, y + h + 0.1, hz], 0.08, 0.08);
    L.set({ col: [1, 1, 1], rm: [0.4, 0, 0], em: em(col, 4.5, DUSK + code) });
    L.box(hx - 0.32, y + h - 0.05, hz - 0.18, hx + 0.32, y + h + 0.08, hz + 0.18, { faces: 'y' });
    M.box(hx - 0.36, y + h + 0.08, hz - 0.22, hx + 0.36, y + h + 0.28, hz + 0.22, { faces: 'xXzZY' });
    glows?.push({ p: [hx, y + h - 0.25, hz], color: mul3(col, 1.5), size: 1.15, code: DUSK + code });
    lights?.push({ p: [hx, y + h, hz], color: col, r: 12, k: 1.6, grp });
  }
}
// a red lantern (sphere-ish: a fat cylinder with gold caps and a tassel) — glows red
export function lantern(B, reg, x, y, z, s = 1, code = 0, glows, big = false) {
  const L = B.get('sign', reg), G = B.get('metal', reg);
  const r = 0.32 * s, h = 0.55 * s;
  L.set({ col: [1, 1, 1], rm: [0.7, 0, 0], em: em([1, 0.55, 0.4], 0.95, DUSK + code) });
  // the lantern face from the atlas, wrapped round an 8-sided drum
  const uv = SIGN.lantern_face; const seg = 8;
  for (let i = 0; i < seg; i++) {
    const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
    const k = (a) => 1;
    const p = (a, yy, rr) => [x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr];
    const u0 = uv[0] + (uv[2] - uv[0]) * (i % 2 ? 0.5 : 0), u1 = u0 + (uv[2] - uv[0]) * 0.5;
    L.quad(p(a1, y - h / 2, r * 0.82), p(a0, y - h / 2, r * 0.82), p(a0, y, r), p(a1, y, r), [u0, uv[1], u1, (uv[1] + uv[3]) / 2]);
    L.quad(p(a1, y, r), p(a0, y, r), p(a0, y + h / 2, r * 0.82), p(a1, y + h / 2, r * 0.82), [u0, (uv[1] + uv[3]) / 2, u1, uv[3]]);
    void k;
  }
  G.set({ col: [0.75, 0.55, 0.2], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
  G.cyl(x, y + h / 2, z, r * 0.6, r * 0.5, y + h / 2 + 0.06 * s, 8); G.cyl(x, y - h / 2 - 0.06 * s, z, r * 0.5, r * 0.6, y - h / 2, 8);
  G.set({ col: [0.6, 0.06, 0.04] }); G.box(x - 0.025 * s, y - h / 2 - 0.42 * s, z - 0.025 * s, x + 0.025 * s, y - h / 2 - 0.06 * s, z + 0.025 * s, { faces: 'xXzZ' });
  glows?.push({ p: [x, y, z], color: big ? [3.0, 0.5, 0.18] : [2.4, 0.42, 0.14], size: (big ? 2.2 : 1.35) * s, code: DUSK + code });
}
// a string of lanterns hanging along a catenary from a to b
export function lanternString(B, reg, a, b, n, sag, code, glows, s = 0.8) {
  const P = B.get('plain', reg);
  P.set({ col: [0.05, 0.05, 0.05], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
  let prev = null;
  for (let i = 0; i <= n * 2; i++) {
    const t = i / (n * 2), p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    if (prev) P.beam(prev, p, 0.025, 0.025);
    prev = p;
    if (i % 2 === 1) lantern(B, reg, p[0], p[1] - 0.45 * s, p[2], s, code, glows);
  }
}
// overhead cable bundle (sagging) between two points — the city's wire tangle
export function cables(B, reg, a, b, n = 3, sag = 1.2, seed = 1) {
  const P = B.get('plain', reg), r = makeRng(seed);
  P.set({ col: [0.03, 0.03, 0.03], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
  for (let k = 0; k < n; k++) {
    const o = [(r() - 0.5) * 0.6, (r() - 0.5) * 0.8, (r() - 0.5) * 0.6], sg = sag * (0.7 + r() * 0.6);
    let prev = null;
    for (let i = 0; i <= 8; i++) { const t = i / 8; const p = [a[0] + o[0] + (b[0] - a[0]) * t, a[1] + o[1] + (b[1] - a[1]) * t - sg * 4 * t * (1 - t), a[2] + o[2] + (b[2] - a[2]) * t]; if (prev) P.beam(prev, p, 0.035, 0.035); prev = p; }
  }
}
// a banyan / camphor tree in a planter (Chongqing's street trees): a gnarled trunk, aerial roots, a dark dense crown
export function tree(B, reg, x, y, z, s = 1, seed = 1, colliders) {
  const r = makeRng(seed), W = B.get('wood', reg), P = B.get('plain', reg), C = B.get('stone', reg);
  C.set({ col: [0.6, 0.58, 0.55], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
  C.box(x - 1.2, y, z - 1.2, x + 1.2, y + 0.55, z + 1.2, { faces: 'xXzZY', s: 1 });
  colliders?.push({ min: [x - 1.2, y, z - 1.2], max: [x + 1.2, y + 0.55, z + 1.2], data: { mat: 'stone', kind: 'planter' } });
  colliders?.push({ min: [x - 0.35, y, z - 0.35], max: [x + 0.35, y + 4, z + 0.35], data: { mat: 'wood', kind: 'tree' } });
  W.set({ col: [0.42, 0.36, 0.3], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
  const H = 4.2 * s;
  W.cyl(x, y + 0.5, z, 0.42 * s, 0.26 * s, y + H, 7, { cap: false });
  for (let i = 0; i < 4; i++) { const a = r() * 6.28, L = (1.6 + r() * 1.4) * s; W.tube([x, y + H * (0.6 + r() * 0.3), z], [x + Math.cos(a) * L, y + H + r() * 1.6 * s, z + Math.sin(a) * L], 0.14 * s, 5); }
  // aerial roots hanging
  P.set({ col: [0.3, 0.26, 0.22], rm: [0.9, 0, 0] });
  for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = (0.8 + r() * 1.4) * s; P.box(x + Math.cos(a) * d - 0.02, y + 1.6 + r(), z + Math.sin(a) * d - 0.02, x + Math.cos(a) * d + 0.02, y + H, z + Math.sin(a) * d + 0.02, { faces: 'xXzZ' }); }
  // crown: a dense banyan dome of many small clumps — dark and cool inside, the outer ones lighter / warmer
  for (let i = 0; i < 18; i++) {
    const a = r() * 6.28, out = Math.sqrt(r()), d = out * 2.6 * s, cy = y + H + 0.4 + (1 - out * out) * 1.8 * s + r() * 0.8 * s, rr = (0.75 + r() * 0.6) * s;
    const g = 0.55 + out * 0.35 + r() * 0.15, warm = r() * 0.04;
    P.set({ col: [(0.075 + warm) * g, 0.12 * g, 0.065 * g], rm: [0.85, 0, 0] });   // dark, desaturated banyan green
    P.cyl(x + Math.cos(a) * d, cy - rr * 0.5, z + Math.sin(a) * d, rr * 0.55, rr, cy, 8, { cap: false });
    P.cyl(x + Math.cos(a) * d, cy, z + Math.sin(a) * d, rr, rr * 0.35, cy + rr * 0.65, 8, { cap: true });
  }
}
// a hotpot table: a low table with a steaming red pot on a burner, four red plastic stools
export function hotpot(B, reg, x, y, z, seed = 1, code = 0, glows) {
  const r = makeRng(seed), P = B.get('plain', reg);
  P.set({ col: [0.55, 0.42, 0.3], rm: [0.7, 0, 0], em: [0, 0, 0, 0] });
  P.box(x - 0.55, y + 0.62, z - 0.55, x + 0.55, y + 0.68, z + 0.55, { faces: 'xXzZYy' });
  for (const [a, b] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) P.box(x + a - 0.03, y, z + b - 0.03, x + a + 0.03, y + 0.62, z + b + 0.03, { faces: 'xXzZ' });
  P.set({ col: [0.75, 0.75, 0.78], rm: [0.3, 0.9, 0] }); P.cyl(x, y + 0.68, z, 0.27, 0.27, y + 0.84, 10);
  P.set({ col: [0.7, 0.08, 0.02], rm: [0.25, 0, 0], em: em([1.0, 0.25, 0.05], 0.6, DUSK + code) }); P.cyl(x, y + 0.82, z, 0.25, 0.25, y + 0.83, 10, { cap: true });
  P.set({ col: [0.8, 0.12, 0.1], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + (r() - 0.5) * 0.5, d = 0.85 + r() * 0.2; const sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d; P.cyl(sx, y, sz, 0.17, 0.14, y + 0.42, 6, { cap: true }); }
  glows?.push({ p: [x, y + 0.95, z], color: [1.6, 0.35, 0.08], size: 0.9, code: DUSK + code });
}
// a parked scooter (e-bike), dark with a coloured fairing
export function scooter(B, reg, x, y, z, yaw, seed = 1) {
  const r = makeRng(seed), P = B.get('plain', reg);
  const M = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z); const s = P.push(M);
  P.set({ col: [0.08, 0.08, 0.08], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
  P.cyl(0, 0.0, -0.62, 0.26, 0.26, 0.1, 10); P.cyl(0, 0.0, 0.62, 0.26, 0.26, 0.1, 10);
  P.set({ col: CLOTH[Math.floor(r() * CLOTH.length)], rm: [0.35, 0.1, 0] });
  P.box(-0.17, 0.3, -0.75, 0.17, 0.75, 0.55, { faces: 'xXzZY' });
  P.box(-0.2, 0.75, 0.0, 0.2, 0.86, 0.55, { faces: 'xXzZY' });
  P.box(-0.12, 0.5, -0.82, 0.12, 1.15, -0.62, { faces: 'xXzZY' });
  P.set({ col: [0.1, 0.1, 0.1] }); P.box(-0.35, 1.1, -0.74, 0.35, 1.15, -0.7, { faces: 'xXzZY' });
  P.pop(s);
}
export { WALL, AWN, CLOTH };
