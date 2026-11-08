import * as THREE from 'three';
import { makeRng, lerp } from '../../rng.js';

// =====================================================================================
//  TOWER KIT — procedural towers as raw attribute arrays (merged by the caller):
//    position, normal, aF (u, v, kind), aS (style, seed, floor height, tower index) [+ extra]
//  Shapes: box, chamfer, round, tri (three lobes), twist, stepped (setbacks), slab, sail (D plan).
//  Every tower gets a podium (in dense districts), a roof (pad / pool / deck / mech / crown / aa)
//  and masts. Vertical rows every `seg` m: coarse for the static city, fine (8 m) for towers
//  that bend in the mid rig. Winding is fixed per triangle against the intended normal.
// =====================================================================================

export const K = { WALL: 0, CLAD: 1, ROOF: 2, MECH: 3, FIN: 4, PAD: 5, POOL: 6, DECK: 7, PODIUM: 8, RUIN: 9 };

export class GeoBuilder {
  constructor(extraName = null) { this.p = []; this.n = []; this.f = []; this.s = []; this.extra = extraName ? [] : null; this.extraName = extraName; this.S = [0, 0, 4, 0]; this.X = 0; }
  // one triangle with a given flat or per-vertex normal; F = [u, v] per vertex, kind
  tri(a, b, c, na, nb, nc, fa, fb, fc, kind) {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2], e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
    const nx = na[0] + nb[0] + nc[0], ny = na[1] + nb[1] + nc[1], nz = na[2] + nb[2] + nc[2];
    if (cx * nx + cy * ny + cz * nz < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [fb, fc] = [fc, fb]; }
    for (const [P, N, Fv] of [[a, na, fa], [b, nb, fb], [c, nc, fc]]) {
      this.p.push(P[0], P[1], P[2]); this.n.push(N[0], N[1], N[2]); this.f.push(Fv[0], Fv[1], kind); this.s.push(...this.S);
      if (this.extra) this.extra.push(this.X);
    }
  }
  quad(a, b, c, d, n, fa, fb, fc, fd, kind, nb, nc, nd) {
    nb = nb || n; nc = nc || n; nd = nd || n;
    this.tri(a, b, c, n, nb, nc, fa, fb, fc, kind); this.tri(a, c, d, n, nc, nd, fa, fc, fd, kind);
  }
  // axis box in a local frame: transform fn maps local [x,y,z] -> world [x,y,z] (rotation about y + offset)
  box(x0, y0, z0, x1, y1, z1, kind, T, uOff = 0, noBottom = true) {
    const P = (x, y, z) => T([x, y, z]);
    const N = (x, y, z) => T.n([x, y, z]);
    const w = x1 - x0, d = z1 - z0;
    // sides (u runs around the box)
    const sides = [
      [[x0, z1], [x1, z1], [0, 1], 0], [[x1, z1], [x1, z0], [1, 0], w], [[x1, z0], [x0, z0], [0, -1], w + d], [[x0, z0], [x0, z1], [-1, 0], 2 * w + d],
    ];
    for (const [[ax, az], [bx, bz], [nx, nz], u0] of sides) {
      const L = Math.hypot(bx - ax, bz - az), u = uOff + u0, n = N(nx, 0, nz);
      this.quad(P(ax, y0, az), P(bx, y0, bz), P(bx, y1, bz), P(ax, y1, az), n, [u, y0], [u + L, y0], [u + L, y1], [u, y1], kind);
    }
    const up = N(0, 1, 0);
    this.quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), up, [x0, z0], [x1, z0], [x1, z1], [x0, z1], kind === K.MECH || kind === K.FIN ? K.MECH : kind === K.PODIUM ? K.ROOF : kind);
    if (!noBottom) { const dn = N(0, -1, 0); this.quad(P(x0, y0, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), dn, [0, 0], [0, 0], [0, 0], [0, 0], kind); }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aF', new THREE.Float32BufferAttribute(this.f, 3));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(this.s, 4));
    if (this.extra) g.setAttribute(this.extraName, new THREE.Float32BufferAttribute(this.extra, 1));
    g.computeBoundingSphere();
    return g;
  }
  get tris() { return this.p.length / 9; }
}

// footprint polygon (local x, z), counter-clockwise seen from above (+y), plus smooth-shading flag
function footprint(kind, w, d, rng) {
  const P = [];
  if (kind === 'round') { const n = 14; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; P.push([Math.cos(a) * w / 2, Math.sin(a) * d / 2]); } return { P, smooth: true }; }
  if (kind === 'tri') {
    // three rounded lobes (a Y plan)
    const n = 18;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const r = (0.36 + 0.14 * Math.cos(3 * a)) * w; P.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return { P, smooth: true };
  }
  if (kind === 'sail') {
    // D plan: a flat back and a curved front
    const n = 10;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; P.push([Math.cos(a) * w * 0.55 - w * 0.2, Math.sin(a) * d / 2]); }
    P.push([-w / 2, d / 2], [-w / 2, -d / 2]);
    return { P, smooth: false, smoothFront: true };
  }
  if (kind === 'chamfer' || kind === 'twist') {
    const c = Math.min(w, d) * (kind === 'twist' ? 0.12 : 0.2);
    P.push([w / 2 - c, -d / 2], [w / 2, -d / 2 + c], [w / 2, d / 2 - c], [w / 2 - c, d / 2], [-w / 2 + c, d / 2], [-w / 2, d / 2 - c], [-w / 2, -d / 2 + c], [-w / 2 + c, -d / 2]);
    return { P, smooth: false };
  }
  P.push([w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]);
  return { P, smooth: false };
}

const WALL_KIND = (style) => (style === 3 || style === 7 ? K.CLAD : K.WALL);

// Build one tower into gb. t: { x, z, w, d, h, rot, kind, style, roof, idx }, opts: { seg, podium, local }
// local: build at the origin without rotation (the mid rig places + rotates in its own frame)
export function buildTower(gb, t, opts = {}) {
  const rng = makeRng(Math.floor((t.x * 7.13 + t.z * 3.71) * 10) >>> 0 ^ 0x51ab);
  const seg = opts.seg || Math.max(14, Math.min(26, t.h / 6));
  const floorH = t.style === 3 || t.style === 7 ? 3.4 : 4.0;
  const seed = rng();
  gb.S = [t.style, seed, floorH, t.idx ?? 0];
  const rot = opts.local ? 0 : t.rot || 0, ox = opts.local ? 0 : t.x, oz = opts.local ? 0 : t.z;
  const c = Math.cos(rot), s = Math.sin(rot);
  const T = (p) => [p[0] * c + p[2] * s + ox, p[1], -p[0] * s + p[2] * c + oz];
  T.n = (n) => [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c];
  const wallK = WALL_KIND(t.style);
  const { P: P0, smooth } = footprint(t.kind, t.w, t.d, rng);
  // section scale and twist as a function of height
  const taper = t.kind === 'round' || t.kind === 'tri' ? 0.12 : t.kind === 'sail' ? 0.3 : 0.04;
  const twistTot = t.kind === 'twist' ? 0.9 + rng() * 0.5 : 0;
  const steps = t.kind === 'stepped' ? [[0.5 + rng() * 0.1, 0.82], [0.76 + rng() * 0.06, 0.64], [0.92, 0.46]] : [];
  const scaleAt = (v) => { let k = 1 - taper * (v / t.h); for (const [f, sc] of steps) if (v >= f * t.h - 1e-3) k = sc; return k; };
  const angAt = (v) => twistTot * (v / t.h);
  // podium
  const podH = opts.podium === false ? 0 : (t.district === 'city' || t.h < 90 ? 0 : 9 + rng() * 9);
  if (podH > 0) {
    const pw = t.w + 14 + rng() * 14, pd = t.d + 14 + rng() * 14;
    gb.box(-pw / 2, 0, -pd / 2, pw / 2, podH, pd / 2, K.PODIUM, T);
  }
  // rows: break at the setbacks so ledges are flat
  const rows = [0];
  const marks = steps.map(([f]) => f * t.h);
  for (let v = seg; v < t.h - 0.5; v += seg) rows.push(v);
  for (const m of marks) if (!rows.some(r => Math.abs(r - m) < 0.5)) rows.push(m);
  rows.push(t.h); rows.sort((a, b) => a - b);
  const ring = (v, below) => {
    const k = below ? scaleAt(v - 1e-3) : scaleAt(v), a = angAt(v), ca = Math.cos(a), sa = Math.sin(a);
    return P0.map(([x, z]) => [(x * ca + z * sa) * k, v, (-x * sa + z * ca) * k]);
  };
  const n = P0.length;
  // perimeter u (constant per column at the base, so floors line up)
  const uAt = []; { let acc = 0; for (let i = 0; i <= n; i++) { uAt.push(acc); const a = P0[i % n], b = P0[(i + 1) % n]; acc += Math.hypot(b[0] - a[0], b[1] - a[1]); } }
  const vertNormal = (i, k) => {
    // smooth radial normal at polygon vertex i (scaled section)
    const a = P0[(i - 1 + n) % n], b = P0[(i + 1) % n];
    const ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1;
    return [ez / l, 0, -ex / l];
  };
  const outward = (nx, nz, mx, mz) => (nx * mx + nz * mz < 0 ? [-nx, 0, -nz] : [nx, 0, nz]);
  for (let r = 0; r < rows.length - 1; r++) {
    const v0 = rows[r], v1 = rows[r + 1];
    const R0 = ring(v0, false), R1 = ring(v1, true);
    const a0 = angAt(v0), ca = Math.cos(a0), sa = Math.sin(a0);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const A = R0[i], B = R0[j], C = R1[j], D = R1[i];
      const mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2;
      let fn = outward(B[2] - A[2], -(B[0] - A[0]), mx, mz); { const l = Math.hypot(fn[0], fn[2]) || 1; fn = [fn[0] / l, 0, fn[2] / l]; }
      let na = fn, nb = fn, nc = fn, nd = fn;
      if (smooth) {
        const rot2 = (q) => { const l = Math.hypot(q[0], q[2]) || 1; const x = q[0] / l, z = q[2] / l; return outward(x * ca + z * sa, -x * sa + z * ca, mx, mz); };
        na = rot2(vertNormal(i)); nb = rot2(vertNormal(j)); nc = nb; nd = na;
      }
      gb.quad(T(A), T(B), T(C), T(D), T.n(na), [uAt[i], v0], [uAt[i + 1], v0], [uAt[i + 1], v1], [uAt[i], v1], wallK, T.n(nb), T.n(nc), T.n(nd));
    }
    // a setback ledge on top of this row
    if (marks.some(m => Math.abs(m - v1) < 0.5) && r < rows.length - 2) {
      const lo = ring(v1, true), hi = ring(v1, false);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; gb.quad(T(lo[i]), T(lo[j]), T(hi[j]), T(hi[i]), T.n([0, 1, 0]), [lo[i][0], lo[i][2]], [lo[j][0], lo[j][2]], [hi[j][0], hi[j][2]], [hi[i][0], hi[i][2]], K.ROOF); }
    }
  }
  // roof cap
  const top = ring(t.h, true);
  const cx = top.reduce((s2, p) => s2 + p[0], 0) / n, cz = top.reduce((s2, p) => s2 + p[2], 0) / n;
  const up = T.n([0, 1, 0]);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; gb.tri(T([cx, t.h, cz]), T(top[i]), T(top[j]), up, up, up, [cx, cz], [top[i][0], top[i][2]], [top[j][0], top[j][2]], K.ROOF); }
  // parapet: a low wall ring round the roof edge (reads the roofline from above)
  const par = 1.4;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, A = top[i], B = top[j];
    const mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2;
    let fn = outward(B[2] - A[2], -(B[0] - A[0]), mx, mz); { const l = Math.hypot(fn[0], fn[2]) || 1; fn = [fn[0] / l, 0, fn[2] / l]; }
    gb.quad(T(A), T(B), T([B[0], t.h + par, B[2]]), T([A[0], t.h + par, A[2]]), T.n(fn), [uAt[i], t.h], [uAt[i + 1], t.h], [uAt[i + 1], t.h + par], [uAt[i], t.h + par], K.MECH);
  }
  // roof features (in the top section's own rotation)
  const kTop = scaleAt(t.h - 0.01), aTop = angAt(t.h);
  const rw = t.w * kTop, rd = (t.kind === 'round' || t.kind === 'tri' ? t.w : t.d) * kTop;
  const cr = Math.cos(aTop), sr = Math.sin(aTop);
  const TT = (p) => T([p[0] * cr + p[2] * sr, p[1], -p[0] * sr + p[2] * cr]);
  TT.n = (q) => T.n([q[0] * cr + q[2] * sr, q[1], -q[0] * sr + q[2] * cr]);
  const inner = Math.min(rw, rd) * (t.kind === 'round' || t.kind === 'tri' ? 0.66 : 0.86);
  const h = t.h;
  const roof = t.roof || 'mech';
  if (roof === 'pad' && inner > 20) {
    const R = Math.min(14, inner * 0.5);
    // the pad: an octagon slab raised 0.4 m, coordinates in metres from its centre (the shader draws the H)
    const m = 16, y = h + 0.4;
    for (let i = 0; i < m; i++) {
      const a0 = (i / m) * Math.PI * 2, a1 = ((i + 1) / m) * Math.PI * 2;
      const p0 = [Math.cos(a0) * R, y, Math.sin(a0) * R], p1 = [Math.cos(a1) * R, y, Math.sin(a1) * R];
      const sc = 13.5 / R;
      gb.tri(TT([0, y, 0]), TT(p0), TT(p1), TT.n([0, 1, 0]), TT.n([0, 1, 0]), TT.n([0, 1, 0]), [0, 0], [p0[0] * sc, p0[2] * sc], [p1[0] * sc, p1[2] * sc], K.PAD);
      gb.quad(TT([p0[0], h, p0[2]]), TT([p1[0], h, p1[2]]), TT(p1), TT(p0), TT.n([Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]), [0, h], [1, h], [1, y], [0, y], K.MECH);
    }
  } else if ((roof === 'pool' || roof === 'deck') && inner > 18) {
    const W = inner * 0.9, D = inner * 0.9;
    gb.box(-W / 2, h, -D / 2, W / 2, h + 0.25, D / 2, K.DECK, TT);
    if (roof === 'pool') gb.box(-W * 0.32, h + 0.25, -D * 0.22, W * 0.32, h + 0.3, D * 0.22, K.POOL, TT);
    // cabanas / a bar
    gb.box(-W / 2 + 1, h + 0.25, D / 2 - 6, -W / 2 + 9, h + 3.4, D / 2 - 1, K.MECH, TT);
  } else if (roof === 'crown' && rng() < 0.62) {
    // crown variants, so the skyline isn't one picket fence repeated: a stepped lantern (dark metal tiers with
    // LED lines) or a mast cluster on a ring deck
    if (rng() < 0.55) {
      let tw = rw * 0.78, td = rd * 0.78, y = h; const tiers = 3 + Math.floor(rng() * 2);
      for (let k = 0; k < tiers; k++) { const th = 7 + rng() * 9; gb.box(-tw / 2, y, -td / 2, tw / 2, y + th, td / 2, k % 2 ? K.MECH : K.FIN, TT, k * 3); y += th; tw *= 0.68; td *= 0.68; }
      gb.box(-0.9, y, -0.9, 0.9, y + 18 + rng() * 34, 0.9, K.FIN, TT);
    } else {
      gb.box(-inner * 0.32, h, -inner * 0.32, inner * 0.32, h + 3, inner * 0.32, K.MECH, TT);
      const nm = 3 + Math.floor(rng() * 3);
      for (let k = 0; k < nm; k++) { const a = k / nm * Math.PI * 2 + rng(), r = inner * 0.2, mh = 14 + rng() * 40, mw = 0.5 + rng() * 0.6; gb.box(Math.cos(a) * r - mw, h + 3, Math.sin(a) * r - mw, Math.cos(a) * r + mw, h + 3 + mh, Math.sin(a) * r + mw, K.FIN, TT); }
    }
  } else if (roof === 'crown') {
    // fins rising round the perimeter: the crown reads the skyline from kilometres away
    const fh = 16 + rng() * 22, nf = Math.max(8, Math.round((rw + rd) * 2 / 9));
    for (let i = 0; i < nf; i++) {
      const a = (i / nf) * Math.PI * 2;
      const px = Math.cos(a) * rw * 0.47, pz = Math.sin(a) * rd * 0.47;
      const rr = Math.atan2(pz, px);
      const cc = Math.cos(rr), ss = Math.sin(rr);
      const F3 = (p) => TT([p[0] * cc - p[2] * ss + px, p[1], p[0] * ss + p[2] * cc + pz]);
      F3.n = (q) => TT.n([q[0] * cc - q[2] * ss, q[1], q[0] * ss + q[2] * cc]);
      gb.box(-3.2, h, -0.7, 3.2, h + fh * (0.7 + 0.3 * Math.cos(a * 3)), 0.7, K.FIN, F3, i * 4);
    }
    // a slim spire on the tallest
    if (h > 260) gb.box(-1.2, h, -1.2, 1.2, h + fh + 30 + rng() * 40, 1.2, K.FIN, TT);
  }
  if (roof === 'mech' || roof === 'deck' || roof === 'crown' || roof === 'aa' || (roof === 'pad' && inner <= 20)) {
    // plant: a few boxes, never on the pad / pool
    const nb = roof === 'mech' ? 2 + Math.floor(rng() * 3) : 1;
    for (let i = 0; i < nb; i++) {
      const bw = 5 + rng() * Math.min(12, inner * 0.3), bd = 5 + rng() * Math.min(10, inner * 0.3), bh = 2.5 + rng() * 6;
      const px = (rng() - 0.5) * (inner - bw) * 0.9, pz = (rng() - 0.5) * (inner - bd) * 0.9;
      if (roof === 'aa' && Math.hypot(px, pz) < 9) continue;
      gb.box(px - bw / 2, h, pz - bd / 2, px + bw / 2, h + bh, pz + bd / 2, K.MECH, TT);
    }
  }
  // AC units / water tanks: small clutter on every roof (reads 'lived-in' from above)
  if (roof !== 'pad' && roof !== 'pool') for (let i = 0; i < 4; i++) {
    const px = (rng() - 0.5) * inner * 0.75, pz = (rng() - 0.5) * inner * 0.75;
    if (roof === 'aa' && Math.hypot(px, pz) < 10) continue;
    const a = 1.2 + rng() * 1.6;
    gb.box(px - a, h, pz - a * 0.7, px + a, h + 1.2 + rng() * 1.2, pz + a * 0.7, K.MECH, TT);
  }
  // masts on some
  if (rng() < 0.3 && roof !== 'pad' && roof !== 'aa') { const px = (rng() - 0.5) * inner * 0.5, pz = (rng() - 0.5) * inner * 0.5, mh = 12 + rng() * 26; gb.box(px - 0.5, h, pz - 0.5, px + 0.5, h + mh, pz + 0.5, K.MECH, TT); }
  return { roofY: h, inner, rot: rot + aTop };
}
