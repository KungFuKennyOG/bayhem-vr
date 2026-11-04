import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeRng } from '../../rng.js';
import { fogShared } from '../../atmosphere.js';

// =====================================================================================
//  THE IRON LADY — boats on the Seine. buildBoat(kind, opts):
//   'bateau'    bateau-mouche tour boat (42 m): low dark hull, cream rubbing strake, long glass-roofed
//               dinner cabin (tables, lamps, velvet benches lit warm through the glass), wheelhouse forward
//               on the roof, floodlights along the roof edges, an open teak stern deck with railings
//               (gunmen), an exposed stern day tank (shoot it), tricolore, nav lights, a searchlight beam.
//   'peniche'   Freycinet barge converted to a houseboat (38.5 m): black riveted hull, long deckhouse with
//               lit windows and portholes, varnished wheelhouse aft, roof garden (pots, bikes, deck chair,
//               fairy lights), mooring lines + bollards + fenders + gangway to the quay.
//   'speedboat' classic varnished-mahogany runabout (8.5 m): planked topsides, caulked deck, chrome,
//               white leather, wrap-around windscreen, open aft well where the player stands.
//  Draws per boat: body (one rm-material mesh: map × vertex colour, per-vertex roughness / metalness /
//  emission + a procedural surface pattern id, all in a 4-component `rm` attribute), glass, halos
//  (camera-facing glows baked into the boat so they travel with it), beam (bateau searchlight) → ≤ 4.
//  Model space: forward (bow) = -z, up = +y, waterline y = 0, starboard = +x, port = -x.
// =====================================================================================

const V3 = THREE.Vector3;
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const col = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };   // linear
const mulc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz));
const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const RBOX = (w, h, d, r, s = 1) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const CYL = (rt, rb, h, seg = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

// surface finishes: [roughness, metalness, emission, pattern]
// patterns (fragment shader, model space): 1 varnished planking along z, 2 caulked deck planks (pale seams),
// 3 painted steel plating (seams + rust weeps), 4 weathered teak deck (dark seams + butt joints)
const RM = {
  paint: [0.45, 0.12, 0, 0], gloss: [0.28, 0.1, 0, 0], steel: [0.5, 0.3, 0, 3], dark: [0.72, 0.25, 0, 0], rubber: [0.88, 0, 0, 0],
  metal: [0.42, 0.85, 0, 0], iron: [0.6, 0.7, 0, 0], chrome: [0.1, 1, 0, 0], varnish: [0.16, 0, 0, 1], rivaDeck: [0.18, 0, 0, 2], teak: [0.6, 0, 0, 4],
  leather: [0.42, 0, 0, 0], cloth: [0.9, 0, 0, 0], rope: [0.95, 0, 0, 0], wood: [0.7, 0, 0, 0], plant: [0.8, 0, 0, 0], text: [0.5, 0.1, 0, 0],
};
const E = (k, r = 0.4) => [r, 0, k, 0];          // emissive finish (k = emission × albedo)

// ---------------------------------------------------------------------- atlas (text only; everything else samples the white cell)
const AW = 1024, AH = 512;
const R = {};
let WHITE_UV = [16 / AW, 1 - 16 / AH];
const rectUV = (r) => [r[0] / AW, 1 - (r[1] + r[3]) / AH, (r[0] + r[2]) / AW, 1 - r[1] / AH];
const HULL_BATEAU = 0x1b2027, HULL_PENICHE = 0x111214, MAHOGANY = 0x7a2e12, TANK_RED = 0x7a1a12;
const PEN_NAMES = ['LA VAGABONDE', 'MARIE-JEANNE', "L'INSOUMISE", 'ESCALE', 'BELLE DE NUIT'];
function buildAtlas() {
  const c = document.createElement('canvas'); c.width = AW; c.height = AH;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32);
  const FONT = '"Anton", Impact, "Arial Black", "DejaVu Sans", sans-serif', FONT2 = '"Oswald", "Arial Narrow", "DejaVu Sans Condensed", sans-serif';
  const hex = (h) => '#' + h.toString(16).padStart(6, '0');
  const fit = (txt, px, font, maxW, weight = 400) => { g.font = `${weight} ${px}px ${font}`; const w = g.measureText(txt).width; if (w > maxW) g.font = `${weight} ${Math.floor(px * maxW / w)}px ${font}`; };
  // grimy lettering: paint, then knock it back with speckle + a few drips
  const grime = (x, y, w, h, bg, n = 600, seed = 1) => {
    const r = makeRng(seed);
    for (let k = 0; k < n; k++) { g.fillStyle = bg; g.globalAlpha = 0.25 + r() * 0.5; g.fillRect(x + r() * w, y + r() * h, 1 + r() * 3, 1 + r() * 2); }
    g.globalAlpha = 1;
  };
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // bateau topside lettering
  R.lutece = [0, 40, 1024, 80];
  { const [x, y, w, h] = R.lutece; g.fillStyle = hex(HULL_BATEAU); g.fillRect(x, y, w, h);
    g.fillStyle = '#d9cfb4'; fit('LUTÈCE  CROISIÈRES  ·  PARIS', 60, FONT, 980); g.fillText('LUTÈCE  CROISIÈRES  ·  PARIS', x + w / 2, y + h / 2 + 3);
    grime(x, y, w, h, hex(HULL_BATEAU), 900, 3); }
  // bateau bow / stern name
  R.etoile = [0, 128, 512, 96];
  { const [x, y, w, h] = R.etoile; g.fillStyle = hex(HULL_BATEAU); g.fillRect(x, y, w, h);
    g.fillStyle = '#e4dcc6'; fit('ÉTOILE DE SEINE', 54, FONT, 470); g.fillText('ÉTOILE DE SEINE', x + w / 2, y + 38);
    g.fillStyle = '#b9ae92'; g.font = `500 22px ${FONT2}`; g.fillText('PARIS', x + w / 2, y + 78);
    grime(x, y, w, h, hex(HULL_BATEAU), 400, 5); }
  // day tank stencil
  R.gazole = [512, 128, 256, 96];
  { const [x, y, w, h] = R.gazole; g.fillStyle = hex(TANK_RED); g.fillRect(x, y, w, h);
    g.save(); g.translate(x + 48, y + 48); g.rotate(Math.PI / 4); g.fillStyle = '#d8a21c'; g.fillRect(-26, -26, 52, 52); g.fillStyle = '#111'; g.fillRect(-20, -20, 40, 40); g.fillStyle = '#d8a21c'; g.fillRect(-16, -16, 32, 32); g.restore();
    g.fillStyle = '#111'; g.font = `700 22px ${FONT2}`; g.fillText('!', x + 48, y + 50);
    g.fillStyle = '#e6dfcf'; fit('GAZOLE', 46, FONT, 150); g.fillText('GAZOLE', x + 168, y + 36);
    g.font = `500 16px ${FONT2}`; g.fillText('INFLAMMABLE', x + 168, y + 74);
    grime(x, y, w, h, hex(TANK_RED), 500, 7); }
  // speedboat transom name (gilt on varnish)
  R.charlotte = [768, 128, 256, 96];
  { const [x, y, w, h] = R.charlotte; g.fillStyle = hex(MAHOGANY); g.fillRect(x, y, w, h);
    g.fillStyle = '#d9b25a'; g.font = `italic 700 40px ${FONT2}`; g.fillText('Charlotte', x + w / 2, y + 40);
    g.font = `500 15px ${FONT2}`; g.fillText('PARIS', x + w / 2, y + 76); }
  // péniche names (white on black, home port under)
  R.pen = [];
  PEN_NAMES.forEach((nm, k) => {
    const r = [k * 204, 232, 204, 80]; R.pen.push(r);
    const [x, y, w, h] = r; g.fillStyle = hex(HULL_PENICHE); g.fillRect(x, y, w, h);
    g.fillStyle = '#ddd8cc'; fit(nm, 40, FONT, 186); g.fillText(nm, x + w / 2, y + 32);
    g.fillStyle = '#bdb6a6'; g.font = `500 15px ${FONT2}`; g.fillText('PARIS  ·  ' + (5402 + k * 337), x + w / 2, y + 64);
    grime(x, y, w, h, hex(HULL_PENICHE), 300, 11 + k);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------------- mesh bucket
class Bk {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.rm = []; }
  get tris() { return this.p.length / 9; }
  // one triangle; winding fixed against the supplied normals
  tri(a, b, c, na, nb, nc, ua, ub, uc, ca, cb, cc, rm) {
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2];
    const cx = ey * fz - ez * fy, cy = ez * fx - ex * fz, cz = ex * fy - ey * fx;
    if (cx * cx + cy * cy + cz * cz < 1e-14) return;
    if (cx * (na[0] + nb[0] + nc[0]) + cy * (na[1] + nb[1] + nc[1]) + cz * (na[2] + nb[2] + nc[2]) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [ub, uc] = [uc, ub]; [cb, cc] = [cc, cb]; }
    this.p.push(...a, ...b, ...c); this.n.push(...na, ...nb, ...nc); this.uv.push(...ua, ...ub, ...uc); this.c.push(...ca, ...cb, ...cc);
    this.rm.push(...rm, ...rm, ...rm);
  }
  // a three.js geometry with a transform; colour = [r,g,b] or fn(x,y,z) → [r,g,b]; rect = atlas rect for its uvs
  add(geo, m4, c, rm, rect = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m4), v = new V3();
    const uvr = rect ? rectUV(rect) : null;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m4); this.p.push(v.x, v.y, v.z);
      const cc = typeof c === 'function' ? c(v.x, v.y, v.z) : c; this.c.push(cc[0], cc[1], cc[2]);
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
      if (uvr && U) this.uv.push(lerp(uvr[0], uvr[2], U.getX(i)), lerp(uvr[1], uvr[3], U.getY(i))); else this.uv.push(WHITE_UV[0], WHITE_UV[1]);
      this.rm.push(rm[0], rm[1], rm[2], rm[3] || 0);
    }
    return this;
  }
  // bake: multiply vertex colours by fn(x, y, z, nx, ny, nz) on non-emissive vertices (AO, grime, waterline)
  shade(fn) {
    for (let i = 0, k = 0; i < this.p.length; i += 3, k += 4) {
      if (this.rm[k + 2] > 0) continue;
      const s = fn(this.p[i], this.p[i + 1], this.p[i + 2], this.n[i], this.n[i + 1], this.n[i + 2]);
      if (Array.isArray(s)) { this.c[i] *= s[0]; this.c[i + 1] *= s[1]; this.c[i + 2] *= s[2]; } else { this.c[i] *= s; this.c[i + 1] *= s; this.c[i + 2] *= s; }
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('rm', new THREE.Float32BufferAttribute(this.rm, 4));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
// textured quad: centre, right (u+), up (v+)
function quad(bk, c, right, up, w, h, rect, cc, rm) {
  const r = rectUV(rect), hw = w / 2, hh = h / 2;
  const n = crs(right, up); const l = len(n); n[0] /= l; n[1] /= l; n[2] /= l;
  const P = (a, b) => [c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b];
  const A = P(-hw, -hh), B = P(hw, -hh), Cc = P(hw, hh), D = P(-hw, hh);
  bk.tri(A, B, Cc, n, n, n, [r[0], r[1]], [r[2], r[1]], [r[2], r[3]], cc, cc, cc, rm);
  bk.tri(A, Cc, D, n, n, n, [r[0], r[1]], [r[2], r[3]], [r[0], r[3]], cc, cc, cc, rm);
}
// a text decal following the hull side x = xAt(z) on side s (readable from outside)
function sideDecal(bk, s, z0, z1, y0, y1, xAt, rect, rm = RM.text, nu = 10) {
  const r = rectUV(rect), cc = [1, 1, 1];
  const P = (i, y) => { const z = lerp(z0, z1, i / nu); return [s * (xAt(z) + 0.012), y, z]; };
  const Nn = (i) => { const z = lerp(z0, z1, i / nu), d = (xAt(z + 0.05) - xAt(z - 0.05)) / 0.1, l = Math.hypot(1, d); return [s / l, 0, -s * d / l]; };
  const U = (i) => (s > 0 ? lerp(r[2], r[0], i / nu) : lerp(r[0], r[2], i / nu));
  for (let i = 0; i < nu; i++) {
    const a = P(i, y0), b = P(i + 1, y0), c = P(i + 1, y1), d = P(i, y1), na = Nn(i), nb = Nn(i + 1);
    bk.tri(a, b, c, na, nb, nb, [U(i), r[1]], [U(i + 1), r[1]], [U(i + 1), r[3]], cc, cc, cc, rm);
    bk.tri(a, c, d, na, nb, na, [U(i), r[1]], [U(i + 1), r[3]], [U(i), r[3]], cc, cc, cc, rm);
  }
}
function tube(bk, a, b, r, c, rm, seg = 6, rb = r) {
  const A = a.isVector3 ? a : new V3(...a), B = b.isVector3 ? b : new V3(...b);
  const d = new V3().subVectors(B, A), L = d.length(); if (L < 1e-4) return;
  const m = new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()), new V3(1, 1, 1));
  bk.add(CYL(rb, r, L, seg, true), m, c, rm);
}
const polyTube = (bk, pts, r, c, rm, seg = 6) => { for (let i = 0; i < pts.length - 1; i++) tube(bk, pts[i], pts[i + 1], r, c, rm, seg); };
function catenary(a, b, sag, n = 10) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; out.push(new V3().lerpVectors(a, b, t).add(new V3(0, -sag * 4 * t * (1 - t), 0))); } return out; }
// railing along a polyline: stanchions every `step`, top rail + mid rail (dark metal, thick enough not to glow)
function railing(bk, pts, y0, h, step, c = col(0x23262a), rm = RM.metal) {
  const top = pts.map(([x, z]) => new V3(x, y0 + h, z)), mid = pts.map(([x, z]) => new V3(x, y0 + h * 0.5, z));
  polyTube(bk, top, 0.03, c, rm, 6); polyTube(bk, mid, 0.016, c, rm, 5);
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0);
    for (; acc <= L; acc += step) { const t = acc / L, x = lerp(x0, x1, t), z = lerp(z0, z1, t); tube(bk, [x, y0, z], [x, y0 + h, z], 0.022, c, rm, 5); bk.add(CYL(0.05, 0.06, 0.05, 6), M(x, y0 + 0.025, z), c, rm); }
    acc -= L;
  }
  const [xe, ze] = pts[pts.length - 1]; tube(bk, [xe, y0, ze], [xe, y0 + h, ze], 0.022, c, rm, 5);
}

// ---------------------------------------------------------------------- hull loft
// zs: stations (bow → stern); sec(z) → [[x, y], ...] half profile keel centre → sheer (same count per station);
// paint(x, y, z) → [rgb, rm]. Mirrored to both sides, smooth normals from the grid; capped at both ends.
function loftHull(bk, zs, sec, paint, { capBow = true, capStern = true } = {}) {
  const P = zs.map((z) => sec(z).map(([x, y]) => [x, y, z]));
  const ns = P.length, m = P[0].length;
  const N = P.map((row, i) => row.map((p, j) => {
    let tp = sub(row[Math.min(m - 1, j + 1)], row[Math.max(0, j - 1)]); if (len(tp) < 1e-6) tp = [0, 1, 0];
    let tz = sub(P[Math.min(ns - 1, i + 1)][j], P[Math.max(0, i - 1)][j]); if (len(tz) < 1e-6) tz = [0, 0, 1];
    const n = crs(tp, tz), l = len(n);
    return l < 1e-9 ? [1, 0, 0] : [n[0] / l, n[1] / l, n[2] / l];
  }));
  const pc = P.map((row) => row.map((p) => paint(p[0], p[1], p[2])));
  for (const s of [1, -1]) {
    const mp = (p) => [p[0] * s, p[1], p[2]];
    for (let i = 0; i < ns - 1; i++) for (let j = 0; j < m - 1; j++) {
      const a = P[i][j], b = P[i + 1][j], c = P[i + 1][j + 1], d = P[i][j + 1];
      const na = N[i][j], nb = N[i + 1][j], nc = N[i + 1][j + 1], nd = N[i][j + 1];
      const rm = pc[i][j][1];
      bk.tri(mp(a), mp(b), mp(c), mp(na), mp(nb), mp(nc), WHITE_UV, WHITE_UV, WHITE_UV, pc[i][j][0], pc[i + 1][j][0], pc[i + 1][j + 1][0], rm);
      bk.tri(mp(a), mp(c), mp(d), mp(na), mp(nc), mp(nd), WHITE_UV, WHITE_UV, WHITE_UV, pc[i][j][0], pc[i + 1][j + 1][0], pc[i][j + 1][0], rm);
    }
  }
  const cap = (row, dz) => {
    const cont = [];
    const push = (x, y) => { const l = cont[cont.length - 1]; if (!l || Math.abs(l.x - x) + Math.abs(l.y - y) > 1e-4) cont.push(new THREE.Vector2(x, y)); };
    for (const p of row) push(p[0], p[1]);
    for (let j = row.length - 1; j >= 1; j--) push(-row[j][0], row[j][1]);
    if (cont.length > 2 && cont[0].distanceTo(cont[cont.length - 1]) < 1e-4) cont.pop();
    if (cont.length < 3) return;
    const z = row[0][2], n = [0, 0, dz];
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(cont, [])) {
      const A = cont[a], B = cont[b], Cc = cont[c];
      const [ca, rm] = paint(A.x, A.y, z), [cb] = paint(B.x, B.y, z), [cc] = paint(Cc.x, Cc.y, z);
      bk.tri([A.x, A.y, z], [B.x, B.y, z], [Cc.x, Cc.y, z], n, n, n, WHITE_UV, WHITE_UV, WHITE_UV, ca, cb, cc, rm);
    }
  };
  if (capBow) cap(P[0], -1);
  if (capStern) cap(P[ns - 1], 1);
  return P;
}
// flat-ish deck between ±hw(z) at y(z) (+ camber)
function deck(bk, zs, hw, y, c, rm, camber = 0) {
  const nx = 4;
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1];
    for (let k = 0; k < nx; k++) {
      const u0 = -1 + 2 * k / nx, u1 = -1 + 2 * (k + 1) / nx;
      const P = (z, u) => [u * hw(z), y(z) + camber * (1 - u * u), z];
      const n = [0, 1, 0];
      const cc = typeof c === 'function' ? (p) => c(...p) : () => c;
      const a = P(z0, u0), b = P(z1, u0), d = P(z1, u1), e = P(z0, u1);
      bk.tri(a, b, d, n, n, n, WHITE_UV, WHITE_UV, WHITE_UV, cc(a), cc(b), cc(d), rm);
      bk.tri(a, d, e, n, n, n, WHITE_UV, WHITE_UV, WHITE_UV, cc(a), cc(d), cc(e), rm);
    }
  }
}
// a band (rubbing strake / fender bead / gunwale cap) following the plan outline at height y(z), offset outward
function strake(bk, zs, hw, y, r, c, rm, { out = 0, seg = 6, sy = 1 } = {}) {
  for (const s of [1, -1]) {
    const pts = zs.map((z) => new V3(s * (hw(z) + out), y(z), z));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], d = new V3().subVectors(b, a), L = d.length(); if (L < 1e-4) continue;
      const g = CYL(r, r, L + 0.01, seg, true); g.scale(1, 1, sy);
      // orient: cylinder y → segment, cylinder z → up (so sy flattens vertically)
      const yA = d.clone().normalize(), xA = new V3().crossVectors(yA, new V3(0, 1, 0)).normalize(), zA = new V3().crossVectors(xA, yA);
      const m = new THREE.Matrix4().makeBasis(xA, yA, zA).setPosition(a.clone().add(b).multiplyScalar(0.5));
      bk.add(g, m, c, rm);
    }
  }
}

// baked lamp pools: colour fn for a deck that is faintly self-lit (rm.z > 0) under its lamps
const pools = (base, lamps, warm = [1.0, 0.62, 0.3]) => (x, y, z) => {
  let k = 0;
  for (const [lx, lz, r, a] of lamps) { const d2 = ((x - lx) ** 2 + (z - lz) ** 2) / (r * r); k += a * Math.exp(-d2 * 2.2); }
  return [base[0] * 0.25 + warm[0] * k, base[1] * 0.25 + warm[1] * k, base[2] * 0.25 + warm[2] * k];
};
// ---------------------------------------------------------------------- materials (shared by every boat)
let MATS = null;
const NOISE_GLSL = /* glsl */`
float bH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float bN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(bH(i), bH(i+vec3(1,0,0)), f.x), mix(bH(i+vec3(0,1,0)), bH(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(bH(i+vec3(0,0,1)), bH(i+vec3(1,0,1)), f.x), mix(bH(i+vec3(0,1,1)), bH(i+vec3(1,1,1)), f.x), f.y), f.z); }`;
function materials() {
  if (MATS) return MATS;
  const atlas = buildAtlas();
  const body = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 1, metalness: 1, emissive: 0xffffff, emissiveIntensity: 1, envMapIntensity: 1.1 });
  body.userData.duskEmissive = 1.0;
  body.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 rm;\nvarying vec4 vRM;\nvarying vec3 vOP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRM = rm; vOP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec4 vRM;\nvarying vec3 vOP;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        float pat = floor(vRM.w + 0.5);
        float g1 = bN(vOP * vec3(0.9, 2.2, 0.9)), g2 = bN(vOP * 7.3 + 3.1);
        float wear = 0.86 + 0.2 * g1 + 0.08 * g2;
        float bRough = vRM.x;
        if (pat == 1.0) {          // varnished planking (seams along the length)
          float py = (vOP.y + 2.0) / 0.105;
          float seam = smoothstep(0.43, 0.5, abs(fract(py) - 0.5)) * (1.0 - smoothstep(0.2, 0.5, fwidth(py)));
          float grain = bN(vec3(vOP.z * 0.8, vOP.y * 42.0, vOP.x * 6.0)) * 0.6 + bN(vec3(vOP.z * 2.6, floor(py) * 7.0, 0.0)) * 0.4;
          diffuseColor.rgb *= mix(0.7, 1.2, grain);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.012, 0.008), seam * 0.8);
          wear = 0.94 + 0.1 * g1;
        } else if (pat == 2.0) {   // caulked mahogany deck (pale seams, Riva style)
          float px = (vOP.x + 4.0) / 0.072;
          float fw = fwidth(px);
          float seam = smoothstep(0.5 - 0.06 - fw, 0.5 - 0.06 + fw, abs(fract(px) - 0.5)) * (1.0 - smoothstep(0.25, 0.6, fw));
          float grain = bN(vec3(vOP.z * 1.1, floor(px) * 5.0, vOP.x * 34.0));
          diffuseColor.rgb *= mix(0.72, 1.18, grain) * mix(0.9, 1.1, bH(vec3(floor(px), 1.0, 2.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.29, 0.24), seam * 0.6);
          wear = 0.95 + 0.08 * g1;
        } else if (pat == 3.0) {   // painted steel plating: plate seams, rivet lines, rust weeping down from them
          float sz = abs(fract(vOP.z / 2.35) - 0.5), sy = abs(fract((vOP.y + 0.35) / 1.05) - 0.5);
          float seam = max(smoothstep(0.486, 0.5, sz), smoothstep(0.478, 0.5, sy));
          float rv = smoothstep(0.35, 0.5, abs(fract(vOP.z / 0.12) - 0.5)) * smoothstep(0.455, 0.47, sz) * (1.0 - smoothstep(0.47, 0.49, sz));
          float weep = smoothstep(0.62, 0.92, bN(vec3(vOP.z * 2.8, vOP.y * 0.32, vOP.x * 0.4)) * (0.7 + 0.5 * g2));
          float scuff = smoothstep(0.7, 0.95, bN(vOP * vec3(0.5, 6.0, 0.5) + 9.0));
          diffuseColor.rgb *= 1.0 - seam * 0.4 - rv * 0.25;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.055, 0.025), weep * 0.6);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.085, 0.08), scuff * 0.5);
          bRough = mix(bRough, 0.85, max(weep, scuff * 0.5));
        } else if (pat == 4.0) {   // weathered teak (dark caulk, butt joints)
          float px = (vOP.x + 4.0) / 0.12;
          float seam = smoothstep(0.42, 0.5, abs(fract(px) - 0.5)) * (1.0 - smoothstep(0.2, 0.5, fwidth(px)));
          float butt = step(0.988, fract(vOP.z / 3.1 + bH(vec3(floor(px), 3.0, 1.0))));
          float grain = bN(vec3(vOP.z * 0.6, floor(px) * 3.7, vOP.x * 22.0));
          diffuseColor.rgb *= mix(0.75, 1.12, grain) * mix(0.88, 1.08, bH(vec3(floor(px), 5.0, 2.0)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.022, 0.02), max(seam, butt) * 0.85);
        }
        diffuseColor.rgb *= wear;`)
      .replace('#include <roughnessmap_fragment>', /* glsl */`#include <roughnessmap_fragment>
        // rain: up-facing surfaces are wet (glossier), the rest a little
        float bUp = dot(normalize(vNormal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
        roughnessFactor = bRough * mix(0.92, 0.55, smoothstep(0.45, 0.9, bUp));`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vRM.y;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = emissive * diffuseColor.rgb * vRM.z;');
  };
  body.customProgramCacheKey = () => 'boatBody';
  body.emissiveIntensity = body.userData.duskEmissive;
  // glass: dark, glossy, fresnel-opaque; a faint warm emission so lit interiors read through it
  const glass = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.3, envMapIntensity: 2.0, depthWrite: false, emissive: 0xffa860, emissiveIntensity: 0.05 });
  glass.userData.duskEmissive = 0.05;
  glass.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <opaque_fragment>',
      'float gfr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.5);\ndiffuseColor.a = mix(opacity, 0.95, gfr);\n#include <opaque_fragment>');
  };
  glass.customProgramCacheKey = () => 'boatGlass';
  // burnt: soot / rust / ash from model space; a few dull embers low in the creases (no lamp emission)
  const charred = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.25, emissive: 0xff4a10, emissiveIntensity: 1 });
  charred.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float cn = bN(vOP * 1.7) * 0.55 + bN(vOP * 6.0) * 0.3 + bN(vOP * 23.0) * 0.15;
        vec3 soot = vec3(0.014, 0.012, 0.011), rust = vec3(0.07, 0.03, 0.013), ash = vec3(0.15, 0.14, 0.13);
        vec3 cc = mix(soot, rust, smoothstep(0.52, 0.8, cn));
        cc = mix(cc, ash, smoothstep(0.72, 0.92, bN(vOP * 3.1 + 4.0)) * 0.5);
        cc = mix(cc, vec3(0.03, 0.035, 0.03), (1.0 - smoothstep(-0.2, 0.25, vOP.y)) * 0.6);   // wet line
        diffuseColor.rgb = cc;`)
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = emissive * 0.1 * pow(smoothstep(0.72, 0.88, bN(vOP * 4.0 + 9.0)), 3.0) * smoothstep(0.4, 1.2, vOP.y) * (1.0 - smoothstep(2.5, 4.0, vOP.y));')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.55, smoothstep(0.45, 0.75, cn));');
  };
  charred.customProgramCacheKey = () => 'boatCharred';
  charred.userData.burnt = true;
  const fogU = () => ({ fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 2000 }, fogDensity: { value: 0 } });
  const post = /* glsl */`
    #ifdef USE_FOG
      float fk = smoothstep(fogNear, fogFar, vFD); fk = 1.0 - (1.0 - fk) * (1.0 - fk);
      c *= 1.0 - fk * 0.9;
    #endif
    c = min(c, vec3(4.0));
    #ifdef TONE_MAPPING
      c = toneMapping(c);
    #endif
    c = linearToOutputTexel(vec4(c, 1.0)).rgb;
    #ifdef TONE_MAPPING
      c = max(bayGrade(c) - bayGrade(vec3(0.0)), 0.0);
    #endif
    gl_FragColor = vec4(c, 1.0);`;
  // halos: camera-facing glows baked into the boat (position = centre, aCorner = -1..1, aCol = rgb + size)
  const halo = new THREE.ShaderMaterial({
    uniforms: { ...fogU(), uK: { value: 1 } }, fog: true,
    vertexShader: /* glsl */`
      attribute vec2 aCorner; attribute vec4 aCol;
      varying vec2 vC; varying vec3 vCol; varying float vFD;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float s = aCol.w;
        mv.xyz += normalize(-mv.xyz) * min(s * 0.3, 0.4);     // pull toward the eye so it doesn't sink into its lamp
        mv.xy += aCorner * s * 0.5;
        vC = aCorner; vCol = aCol.rgb * smoothstep(0.4, 2.0, -mv.z);
        vFD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uK; uniform float fogNear, fogFar;
      varying vec2 vC; varying vec3 vCol; varying float vFD;
      void main() {
        float r = length(vC);
        float a = (exp(-r * r * 5.0) * 0.9 + exp(-r * r * 40.0) * 0.5) * smoothstep(1.0, 0.55, r);
        vec3 c = vCol * a * uK * 0.9;
        ${post}
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  halo.customProgramCacheKey = () => 'boatHalo';
  // searchlight beam: crossed planes, soft edges, fades along its length
  const beam = new THREE.ShaderMaterial({
    uniforms: { ...fogU(), uK: { value: 1 }, uCol: { value: new THREE.Color(1.0, 0.9, 0.72) } }, fog: true,
    vertexShader: /* glsl */`
      attribute vec2 aB; varying vec2 vB; varying float vFD; varying float vEdge;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * wp;
        vB = aB; vFD = -mv.z;
        vec3 n = normalize(mat3(modelMatrix) * normal);
        vEdge = abs(dot(n, normalize(cameraPosition - wp.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uK; uniform vec3 uCol; uniform float fogNear, fogFar;
      varying vec2 vB; varying float vFD; varying float vEdge;
      void main() {
        float u = vB.x, v = vB.y;
        float a = pow(1.0 - u, 1.8) * smoothstep(0.0, 0.015, u) * pow(max(0.0, 1.0 - v * v), 2.0) * (0.35 + 0.65 * vEdge);
        vec3 c = uCol * a * 0.16 * uK;
        ${post}
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  beam.customProgramCacheKey = () => 'boatBeam';
  MATS = { body, glass, charred, halo, beam, atlas };
  return MATS;
}

// ---------------------------------------------------------------------- shared assembly
function haloMesh(glows) {
  const n = glows.length; if (!n) return null;
  const pos = new Float32Array(n * 12), cor = new Float32Array(n * 8), cl = new Float32Array(n * 16), idx = [];
  const C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  glows.forEach((g, i) => {
    for (let k = 0; k < 4; k++) {
      pos.set(g.p, (i * 4 + k) * 3); cor.set(C4[k], (i * 4 + k) * 2);
      cl.set([g.color[0], g.color[1], g.color[2], g.size || 1], (i * 4 + k) * 4);
    }
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCorner', new THREE.BufferAttribute(cor, 2)); geo.setAttribute('aCol', new THREE.BufferAttribute(cl, 4));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, materials().halo);
  m.frustumCulled = false; m.renderOrder = 19; m.castShadow = m.receiveShadow = false; m.name = 'boatHalos';
  return m;
}
function beamMesh(L = 70, r0 = 0.22, r1 = 8) {
  const pos = [], nrm = [], ab = [], idx = [];
  const S = 8;
  for (let p = 0; p < 3; p++) {
    const a = p * Math.PI / 3, ax = Math.cos(a), ay = Math.sin(a), base = pos.length / 3;
    for (let i = 0; i <= S; i++) {
      const u = i / S, z = -L * u * u, r = lerp(r0, r1, u * u);
      for (const v of [-1, 1]) { pos.push(ax * r * v, ay * r * v, z); nrm.push(-ay, ax, 0); ab.push(u * u, v); }
    }
    for (let i = 0; i < S; i++) { const a0 = base + i * 2; idx.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); geo.setAttribute('aB', new THREE.Float32BufferAttribute(ab, 2));
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, materials().beam);
  m.frustumCulled = false; m.renderOrder = 18; m.castShadow = m.receiveShadow = false; m.name = 'searchBeam';
  return m;
}
function assemble(kind, body, glass, glows, { halos, beam: beamSpec, colliders, anchors, extraInfo = {} }) {
  const Mt = materials();
  const root = new THREE.Group(); root.name = 'boat:' + kind;
  const bodyMesh = new THREE.Mesh(body.geometry(), Mt.body); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; bodyMesh.name = kind + ':body';
  root.add(bodyMesh);
  let glassMesh = null;
  if (glass.tris) { glassMesh = new THREE.Mesh(glass.geometry(), Mt.glass); glassMesh.renderOrder = 3; glassMesh.castShadow = false; glassMesh.name = kind + ':glass'; root.add(glassMesh); }
  const haloM = halos ? haloMesh(glows) : null; if (haloM) root.add(haloM);
  let beamM = null;
  if (beamSpec) {
    beamM = beamMesh(beamSpec.len, beamSpec.r0, beamSpec.r1);
    beamM.position.fromArray(beamSpec.p);
    beamM.quaternion.setFromUnitVectors(new V3(0, 0, -1), new V3(...beamSpec.dir).normalize());
    root.add(beamM);
  }
  const bb = bodyMesh.geometry.boundingBox;
  const half = [Math.max(-bb.min.x, bb.max.x), (bb.max.y - Math.max(bb.min.y, -2)) / 2, Math.max(-bb.min.z, bb.max.z)];
  const tris = body.tris + glass.tris + (haloM ? glows.length * 2 : 0) + (beamM ? 48 : 0);
  anchors.glows = glows.map((g) => ({ ...g }));
  const res = {
    root, half, colliders, anchors, mesh: bodyMesh, glass: glassMesh, halos: haloM, beam: beamM, burnt: false, burntMaterials: [Mt.charred],
    info: { kind, tris, draws: 1 + (glassMesh ? 1 : 0) + (haloM ? 1 : 0) + (beamM ? 1 : 0), glows: glows.length, ...extraInfo },
    setBurnt() {
      if (res.burnt) return; res.burnt = true;
      bodyMesh.material = Mt.charred;
      if (glassMesh) glassMesh.visible = false;
      if (haloM) haloM.visible = false;
      if (beamM) beamM.visible = false;
      res.anchors.glows = [];
    },
  };
  return res;
}

// =====================================================================================
//  BATEAU-MOUCHE (42 × 8 m)
// =====================================================================================
function buildBateau(opts) {
  const rng = makeRng((opts.seed ?? 5) * 7919 + 17);
  const body = new Bk(), glass = new Bk(), glows = [];
  const HULL = col(HULL_BATEAU), CREAM = col(0xd8cfb6), WHITE = col(0xd9d6ce), RED = col(0x5a140f), BLACK = col(0x0c0d0e), DMET = col(0x26292d), GREYM = col(0x4a4e52);
  const ZB = -21, ZS = 21, BW = 4.0, DECK = 1.08;
  const hwS = (z) => {
    if (z < -11) { const t = clamp01((-11 - z) / 10); return BW * Math.sqrt(Math.max(0, 1 - t * t * 0.985)) * (1 - 0.06 * t); }
    if (z > 15.5) { const t = clamp01((z - 15.5) / 6.2); return BW * Math.sqrt(Math.max(0, 1 - t * t)); }
    return BW;
  };
  const sheer = (z) => 1.18 + 0.55 * sstep((-11 - z) / 10) + 0.06 * sstep((z - 15) / 6);
  const keel = (z) => -1.1 + 1.55 * Math.pow(clamp01((-14 - z) / 7), 1.6) + 0.55 * Math.pow(clamp01((z - 15) / 6), 1.5);
  const ROWS = [-0.25, -0.06, 0.0, 0.12, 0.3, 0.62, 0.72, 0.92, 1.0];      // waterline band, boot-top, strake
  const sec = (z) => {
    const B = hwS(z), yb = keel(z), ys = sheer(z), bow = sstep((-11 - z) / 10);
    const W = (y) => B * (1 - bow * 0.32 * clamp01((ys - y) / (ys - yb + 1e-3)));     // flare at the bow
    const pts = [[0, yb], [Math.max(0, W(yb) - 0.7), yb], [Math.max(0, W(yb) - 0.28), yb + 0.06], [Math.max(0, W(yb) - 0.08), yb + 0.3]];
    let yp = yb + 0.3;
    for (const y0 of ROWS) { const y = Math.max(y0, yp); yp = y; pts.push([W(Math.min(y, ys)), Math.min(y, ys)]); }
    pts.push([W(ys), ys]);
    return pts;
  };
  const zs = [];
  for (let z = ZB; z < -11; z += 0.7) zs.push(z);
  for (let z = -11; z < 15.5; z += 2.2) zs.push(z);
  for (let z = 15.5; z <= 20.99; z += 0.6) zs.push(z);
  zs.push(ZS);
  const hullPaint = (x, y, z) => {
    if (y < -0.05) return [col(0x3a1410), RM.paint];                                   // antifouling (just under the surface)
    if (y < 0.13) return [col(0x0d0f10), RM.paint];                                    // boot-top
    return [HULL, RM.steel];
  };
  loftHull(body, zs, sec, hullPaint);
  // deck, bulwark cap, rubbing strake (cream, chunky) + black fender bead lower down
  const dzs = zs.filter((z) => z > ZB + 0.3);
  const DPOOL = [[-2.6, 11.2, 2.6, 0.5], [2.6, 13.8, 2.6, 0.5], [-2.6, 16.6, 2.6, 0.45], [2.6, 19.2, 2.4, 0.4], [0, 10.0, 2.2, 0.35], [0, -16.5, 3.0, 0.25]];
  deck(body, dzs, (z) => Math.max(0.01, hwS(z) - 0.12), (z) => Math.min(DECK + 0.02 + 0.5 * sstep((-13 - z) / 8), sheer(z) - 0.08), pools(col(0x6a5a46), DPOOL), [0.6, 0, 0.32, 4], 0.04);
  strake(body, zs, hwS, (z) => sheer(z) - 0.02, 0.075, CREAM, RM.gloss, { out: 0.03, sy: 1.2 });
  strake(body, zs.filter((z) => z > -19.5 && z < 20.6), (z) => hwS(z), (z) => 0.66 + 0.25 * sstep((-11 - z) / 10), 0.07, col(0x111213), RM.rubber, { out: 0.04 });
  strake(body, zs.filter((z) => z > -19.8), (z) => hwS(z), () => 0.13, 0.03, col(0x8a8170), RM.paint, { out: 0.005 });   // boot-top pinstripe
  // topside lettering (both sides) + bow / stern names
  for (const s of [-1, 1]) {
    quad(body, [s * (BW + 0.012), 0.38, -1], [0, 0, -s], [0, 1, 0], 5.6, 0.44, R.lutece, [1, 1, 1], RM.text);
    sideDecal(body, s, s > 0 ? -14.2 : -17.4, s > 0 ? -17.4 : -14.2, 0.86, 1.36, hwS, R.etoile);
  }
  {
    const zt = ZS + 0.012, yt = 0.62;
    quad(body, [0, yt, zt], [1, 0, 0], [0, 1, 0], 3.2, 0.6, R.etoile, [1, 1, 1], RM.text);
  }

  // ---------- cabin (z -15 .. 9): cream lower band, glass sides with mullions, glass barrel roof with ribs + spine
  const C0 = -15, C1 = 9, XW = 3.62, YB0 = DECK, YW0 = 1.62, YW1 = 2.88, XR = 3.42, YRF = 3.38, SPINE = 0.55;
  const bayW = 1.2;
  const nb = Math.round((C1 - C0) / bayW);
  // lower band (outer + inner face) and sill
  for (const s of [-1, 1]) {
    body.add(BOX(0.08, YW0 - YB0, C1 - C0), M(s * XW, (YB0 + YW0) / 2, (C0 + C1) / 2), WHITE, RM.paint);
    body.add(BOX(0.05, YW0 - YB0, C1 - C0 - 0.2), M(s * (XW - 0.07), (YB0 + YW0) / 2, (C0 + C1) / 2), col(0x5a3a22), E(0.06, 0.6));   // inner panelling, warm-lit
    body.add(BOX(0.2, 0.06, C1 - C0 + 0.05), M(s * (XW - 0.02), YW0, (C0 + C1) / 2), DMET, RM.metal);
    body.add(BOX(0.12, 0.06, C1 - C0 + 0.05), M(s * (XR + 0.02), YW1, (C0 + C1) / 2), DMET, RM.metal);
    // glass side panes + mullions
    for (let k = 0; k <= nb; k++) {
      const z = C0 + k * bayW;
      const a = new V3(s * XW, YW0, z), b = new V3(s * XR, YW1, z);
      tube(body, a, b, 0.045, DMET, RM.metal, 4);
      if (k < nb) {
        const z1 = z + bayW, xm = (XW + XR) / 2 * s, ym = (YW0 + YW1) / 2, tilt = Math.atan2(XW - XR, YW1 - YW0);
        glass.add(new THREE.PlaneGeometry(bayW - 0.06, Math.hypot(YW1 - YW0, XW - XR)), M(xm, ym, z + bayW / 2, 0, s * Math.PI / 2, 0).multiply(M(0, 0, 0, s > 0 ? -tilt : -tilt)), col(0x8a9aa4), RM.paint);
      }
    }
  }
  // roof: curved glass between XR and the spine, ribs every bay, a solid white spine with the light strip under it
  const roofPt = (u) => { const a = u * Math.PI / 2; return [lerp(XR, SPINE, Math.sin(a)), YW1 + (YRF - YW1) * Math.sin(a) * 0.7 + (YRF - YW1) * 0.3 * u]; };
  const RS = 5;
  const roofYAt = (x) => { x = Math.abs(x); if (x <= SPINE) return YRF; let a = 0, b = 1; for (let k = 0; k < 14; k++) { const m = (a + b) / 2; if (roofPt(m)[0] > x) a = m; else b = m; } return roofPt((a + b) / 2)[1]; };
  const solidRoof0 = C0, solidRoof1 = -9.4;   // solid roof under the wheelhouse
  for (const s of [-1, 1]) {
    for (let k = 0; k < nb; k++) {
      const z0 = C0 + k * bayW, z1 = z0 + bayW;
      const target = z1 <= solidRoof1 + 1e-3 ? body : glass;
      for (let i = 0; i < RS; i++) {
        const [xa, ya] = roofPt(i / RS), [xb, yb] = roofPt((i + 1) / RS);
        const dx = xb - xa, dy = yb - ya, l = Math.hypot(dx, dy), nA = [s * -dy / l * -1, -dx / l * -1, 0];
        if (nA[1] < 0) { nA[0] *= -1; nA[1] *= -1; }
        const cc = target === body ? WHITE : col(0x8a9aa4), rm = RM.paint;
        const A = [s * xa, ya, z0], B = [s * xb, yb, z0], Cc = [s * xb, yb, z1], D = [s * xa, ya, z1];
        target.tri(A, B, Cc, nA, nA, nA, WHITE_UV, WHITE_UV, WHITE_UV, cc, cc, cc, rm);
        target.tri(A, Cc, D, nA, nA, nA, WHITE_UV, WHITE_UV, WHITE_UV, cc, cc, cc, rm);
      }
    }
    for (let k = 0; k <= nb; k++) {
      const z = C0 + k * bayW;
      const pts = []; for (let i = 0; i <= RS; i++) { const [x, y] = roofPt(i / RS); pts.push(new V3(s * x, y + 0.02, z)); }
      polyTube(body, pts, 0.04, DMET, RM.metal, 4);
    }
    // floodlights along the roof edge (the bateau's signature: they light up the quays)
    for (let z = C0 + 2.0; z < C1 - 0.5; z += 3.6) {
      body.add(RBOX(0.34, 0.26, 0.42, 0.05), M(s * (XR + 0.12), YW1 + 0.2, z, 0, 0, s * 0.5), col(0x1a1c1e), RM.metal);
      body.add(CYL(0.12, 0.12, 0.04, 10), M(s * (XR + 0.27), YW1 + 0.12, z, 0, 0, Math.PI / 2 + s * 0.5), [1.0, 0.9, 0.75], E(3.0, 0.1));
      glows.push({ p: [s * (XR + 0.4), YW1 + 0.06, z], color: [2.4, 1.75, 1.1], size: 0.75 });
    }
  }
  body.add(BOX(SPINE * 2 + 0.1, 0.12, C1 - C0), M(0, YRF + 0.04, (C0 + C1) / 2), WHITE, RM.paint);
  body.add(BOX(0.36, 0.03, C1 - C0 - 1.5), M(0, YRF - 0.04, (C0 + C1) / 2 + 0.5), [1.0, 0.86, 0.62], E(2.4, 0.4));   // light strip
  // front / rear bulkheads (glass in a frame) + doors aft
  for (const [z, dz] of [[C0, -1], [C1, 1]]) {
    const shp = new THREE.Shape();
    shp.moveTo(XW, YW0);
    for (let i = 0; i <= RS; i++) { const [x, y] = roofPt(i / RS); shp.lineTo(x, y); }
    for (let i = RS; i >= 0; i--) { const [x, y] = roofPt(i / RS); shp.lineTo(-x, y); }
    shp.lineTo(-XW, YW0); shp.closePath();
    const sg = new THREE.ShapeGeometry(shp, 2);
    body.add(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-XW, YB0), new THREE.Vector2(XW, YB0), new THREE.Vector2(XW, YW0), new THREE.Vector2(-XW, YW0)]), 1), M(0, 0, z + dz * 0.01, 0, dz > 0 ? 0 : Math.PI, 0), WHITE, RM.paint);
    glass.add(sg, M(0, 0, z, 0, dz > 0 ? 0 : Math.PI, 0), col(0x8a9aa4), RM.paint);
    for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) tube(body, [x, YW0, z + dz * 0.02], [x, roofYAt(x), z + dz * 0.02], 0.035, DMET, RM.metal, 4);
    body.add(BOX(XW * 2, 0.06, 0.08), M(0, YW0, z + dz * 0.03), DMET, RM.metal);
  }
  // aft doors: two dark frames + kick plates
  for (const x of [-0.75, 0.75]) { body.add(BOX(0.05, 1.9, 0.06), M(x - 0.7, DECK + 0.95, C1 + 0.05), DMET, RM.metal); body.add(BOX(0.05, 1.9, 0.06), M(x + 0.7, DECK + 0.95, C1 + 0.05), DMET, RM.metal); }
  body.add(BOX(3.0, 0.08, 0.06), M(0, DECK + 1.9, C1 + 0.05), DMET, RM.metal);
  // ---------- dining saloon: carpet, tables with cloths + lamps, velvet benches facing, warm-lit
  body.add(BOX(XW * 2 - 0.2, 0.04, C1 - C0 - 0.1), M(0, DECK + 0.02, (C0 + C1) / 2), col(0x5a1612), E(0.12, 0.95));
  body.add(BOX(0.9, 0.012, C1 - C0 - 0.3), M(0, DECK + 0.045, (C0 + C1) / 2), col(0x3a2a1a), E(0.08, 0.95));   // aisle runner
  const VEL = col(0x6e1a1a), CLOTH = col(0xe8e0cc), WOODI = col(0x4a2c18);
  let lamps = 0;
  for (let z = C0 + 2.0; z < C1 - 0.9; z += 2.2) for (const s of [-1, 1]) {
    const x = s * 2.45;
    body.add(BOX(1.3, 0.05, 0.78), M(x, DECK + 0.74, z), CLOTH, E(0.35, 0.8));                      // cloth
    body.add(BOX(1.32, 0.22, 0.8), M(x, DECK + 0.62, z), mulc(CLOTH, 0.8), E(0.2, 0.8));          // drape
    body.add(CYL(0.05, 0.08, 0.7, 6), M(x, DECK + 0.36, z), DMET, RM.metal);
    for (const dz of [-0.72, 0.72]) {
      body.add(BOX(1.3, 0.14, 0.48), M(x, DECK + 0.46, z + dz), VEL, E(0.14, 0.85));                // seat
      body.add(BOX(1.3, 0.62, 0.12), M(x, DECK + 0.84, z + dz * 1.36), VEL, E(0.12, 0.85));         // back
      body.add(BOX(1.32, 0.06, 0.16), M(x, DECK + 1.17, z + dz * 1.36), WOODI, E(0.08, 0.6));       // capping
    }
    if (rng() < 0.85) {
      body.add(CYL(0.06, 0.09, 0.16, 6), M(x + s * 0.35, DECK + 0.86, z), [1.0, 0.7, 0.4], E(2.0, 0.5));   // table lamp shade
      if ((lamps++ & 1) === 0) glows.push({ p: [x + s * 0.35, DECK + 0.9, z], color: [1.6, 0.9, 0.42], size: 0.7 });
    }
    // glasses / bottle silhouettes
    body.add(CYL(0.03, 0.03, 0.28, 5), M(x - s * 0.25, DECK + 0.91, z + 0.1), col(0x1c2a1a), RM.gloss);
  }
  // a bar counter at the front of the saloon
  body.add(BOX(5.2, 1.05, 0.6), M(0, DECK + 0.52, C0 + 0.6), WOODI, E(0.15, 0.4));
  body.add(BOX(5.3, 0.06, 0.7), M(0, DECK + 1.06, C0 + 0.6), col(0x1a1410), RM.gloss);
  for (let k = 0; k < 9; k++) body.add(CYL(0.035, 0.035, 0.3, 5), M(-2.2 + k * 0.55, DECK + 1.24, C0 + 0.4), [0.9, 0.55, 0.25], E(0.8, 0.2));
  // ---------- wheelhouse on the roof, forward
  const W0 = -14.2, W1 = -10.0, WY0 = YRF + 0.05, WY1 = WY0 + 1.65, WX = 1.35;
  body.add(BOX(WX * 2 + 0.6, 0.18, W1 - W0 + 0.7), M(0, WY0 - 0.04, (W0 + W1) / 2), WHITE, RM.paint);                        // base
  body.add(BOX(WX * 2, 0.75, W1 - W0), M(0, WY0 + 0.38, (W0 + W1) / 2), WHITE, RM.paint);                                   // lower walls
  for (const s of [-1, 1]) glass.add(new THREE.PlaneGeometry(W1 - W0 - 0.2, 0.78), M(s * (WX + 0.005), WY0 + 1.16, (W0 + W1) / 2, 0, s * Math.PI / 2, 0), col(0x6a7a84), RM.paint);
  glass.add(new THREE.PlaneGeometry(WX * 2 - 0.15, 0.82), M(0, WY0 + 1.16, W0 - 0.12, -0.22, Math.PI, 0), col(0x6a7a84), RM.paint);
  glass.add(new THREE.PlaneGeometry(WX * 2 - 0.15, 0.78), M(0, WY0 + 1.16, W1 + 0.005), col(0x6a7a84), RM.paint);
  for (const x of [-WX, WX]) for (const z of [W0, W1]) tube(body, [x, WY0 + 0.75, z], [x, WY1, z], 0.05, DMET, RM.metal, 4);
  body.add(BOX(WX * 2 + 0.5, 0.12, W1 - W0 + 0.6), M(0, WY1 + 0.06, (W0 + W1) / 2 - 0.1), WHITE, RM.paint);                 // roof (overhang)
  body.add(BOX(WX * 2 + 0.52, 0.04, 0.05), M(0, WY1, W0 - 0.38), BLACK, RM.rubber);
  body.add(BOX(1.4, 0.5, 0.4), M(0, WY0 + 0.95, W0 + 0.35), col(0x1a1c1e), RM.dark);                                         // console
  body.add(BOX(0.9, 0.02, 0.24), M(0, WY0 + 1.21, W0 + 0.32, -0.5, 0, 0), [0.3, 0.7, 0.6], E(1.4, 0.2));                    // radar / chart glow
  body.add(new THREE.TorusGeometry(0.22, 0.025, 4, 12), M(-0.3, WY0 + 1.2, W0 + 0.65, -0.4, 0, 0), WOODI, RM.wood);
  // mast: radar, masthead light, pennant; searchlight on the roof front
  const MX = 0, MZ = W1 - 0.6;
  tube(body, [MX, WY1 + 0.1, MZ], [MX, WY1 + 2.0, MZ], 0.05, DMET, RM.metal, 6);
  body.add(BOX(1.2, 0.08, 0.16), M(MX, WY1 + 1.55, MZ), DMET, RM.metal);
  body.add(RBOX(1.6, 0.1, 0.22, 0.04), M(MX, WY1 + 1.95, MZ, 0, 0.4, 0), col(0x2a2c2e), RM.paint);                           // radar bar
  body.add(CYL(0.06, 0.06, 0.12, 8), M(MX, WY1 + 2.1, MZ), [1, 1, 0.95], E(3.0, 0.1));
  glows.push({ p: [MX, WY1 + 2.12, MZ], color: [3.2, 3.0, 2.6], size: 0.9 });
  for (let k = 0; k < 4; k++) { const t = k / 4; body.add(BOX(0.02, 0.24 * (1 - t * 0.5), 0.16), M(MX + 0.07, WY1 + 1.78 - t * 0.02, MZ + 0.12 + k * 0.16, 0, 0, 0), k % 2 ? col(0xc8bfa8) : col(0x2a4a8a), RM.cloth); }
  const SPOT = [0.9, WY1 + 0.42, W0 - 0.1], SPOTD = new V3(-0.78, -0.12, -0.6).normalize();
  body.add(CYL(0.05, 0.08, 0.3, 6), M(SPOT[0], WY1 + 0.2, SPOT[2]), DMET, RM.metal);
  body.add(CYL(0.24, 0.2, 0.42, 12), new THREE.Matrix4().compose(new V3(...SPOT), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), SPOTD.clone()), new V3(1, 1, 1)), col(0x1c1e20), RM.metal);
  body.add(CYL(0.2, 0.2, 0.02, 12), new THREE.Matrix4().compose(new V3(...SPOT).addScaledVector(SPOTD, 0.22), new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), SPOTD.clone()), new V3(1, 1, 1)), [1, 0.95, 0.85], E(4, 0.05));
  glows.push({ p: new V3(...SPOT).addScaledVector(SPOTD, 0.35).toArray(), color: [3.5, 3.2, 2.7], size: 2.0 });
  // nav lights (port red / starboard green on the wheelhouse wings), stern light
  for (const s of [-1, 1]) {
    body.add(BOX(0.16, 0.2, 0.3), M(s * (WX + 0.32), WY0 + 1.0, W0 + 0.6), DMET, RM.metal);
    body.add(BOX(0.04, 0.12, 0.2), M(s * (WX + 0.42), WY0 + 1.0, W0 + 0.6), s < 0 ? [1, 0.08, 0.05] : [0.1, 1, 0.35], E(3, 0.1));
    glows.push({ p: [s * (WX + 0.5), WY0 + 1.0, W0 + 0.6], color: s < 0 ? [3.4, 0.2, 0.12] : [0.25, 3.2, 1.0], size: 0.9 });
  }
  { // foredeck railing from the cabin front round the bow
    const fp = [];
    for (let z = C0 - 0.3; z >= ZB + 1.2; z -= 0.9) fp.push([-(hwS(z) - 0.14), z]);
    const tip = fp[fp.length - 1];
    const fr = [...fp, [0, ZB + 0.6], ...fp.slice().reverse().map(([x, z]) => [-x, z])];
    void tip;
    // the rail follows the rising sheer: build it in two halves at the local deck height
    for (const half of [fr.slice(0, fp.length + 1), fr.slice(fp.length)]) {
      for (let i = 0; i < half.length - 1; i++) {
        const [x0, z0] = half[i], [x1, z1] = half[i + 1], y0 = sheer(z0) - 0.06, y1 = sheer(z1) - 0.06;
        tube(body, [x0, y0 + 0.95, z0], [x1, y1 + 0.95, z1], 0.03, DMET, RM.metal, 6);
        tube(body, [x0, y0 + 0.48, z0], [x1, y1 + 0.48, z1], 0.016, DMET, RM.metal, 5);
        tube(body, [x0, y0, z0], [x0, y0 + 0.95, z0], 0.022, DMET, RM.metal, 5);
      }
    }
  }
  // ---------- foredeck: bitts, windlass, fairleads, bow staff + pennant, life rings on the cabin front
  for (const s of [-1, 1]) for (const z of [-17.5, -12.8]) { for (const dz of [-0.2, 0.2]) body.add(CYL(0.11, 0.12, 0.45, 8), M(s * (hwS(z) - 0.6), DECK + 0.5 * sstep((-13 - z) / 8) + 0.24, z + dz), DMET, RM.iron); }
  body.add(RBOX(1.0, 0.45, 0.7, 0.08), M(0, sheer(-18.5) - 0.2, -18.4), col(0x1f2326), RM.iron);
  body.add(CYL(0.16, 0.16, 1.2, 10), M(0, sheer(-18.5) + 0.05, -18.4, 0, 0, Math.PI / 2), DMET, RM.iron);
  tube(body, [0, sheer(-20.6), -20.6], [0, sheer(-20.6) + 2.0, -20.9], 0.035, DMET, RM.metal, 6);
  for (let k = 0; k < 3; k++) body.add(BOX(0.02, 0.42, 0.24), M(0, sheer(-20.6) + 1.75, -20.75 + 0.24 * k + 0.12), [col(0x1f3c8c), col(0xe8e4da), col(0xb01c22)][k], RM.cloth);
  for (const x of [-2.2, 2.2]) body.add(new THREE.TorusGeometry(0.32, 0.07, 5, 12), M(x, DECK + 0.95, C0 - 0.06), (px, py) => (Math.floor((Math.atan2(py - DECK - 0.95, px - x) / Math.PI + 1) * 4) % 2 ? col(0xc8301e) : col(0xe8e2d4)), RM.paint);
  // ---------- stern deck (z 9..21): teak, railing, benches (cover), lockers, the day tank, stern staff + tricolore
  const railPts = [];
  for (let z = C1 + 0.3; z <= ZS - 0.1; z += 1.2) railPts.push([-(hwS(z) - 0.12), z]);
  const sternArc = []; for (let k = 0; k <= 8; k++) { const a = -Math.PI / 2 + k / 8 * Math.PI; sternArc.push([Math.sin(a) * (hwS(ZS - 0.2) - 0.12), ZS - 0.15 + Math.cos(a) * 0.05]); }
  const rp = [...railPts, ...sternArc.slice(1), ...railPts.slice().reverse().map(([x, z]) => [-x, z])];
  railing(body, rp.filter((p, i) => i === 0 || Math.hypot(p[0] - rp[i - 1][0], p[1] - rp[i - 1][1]) > 0.05), DECK + 0.04, 1.0, 1.4);
  for (const s of [-1, 1]) {
    body.add(BOX(0.5, 0.42, 3.4), M(s * 3.1, DECK + 0.21, 12.2), col(0x3a3430), RM.teak);         // bench lockers along the rail
    body.add(BOX(0.12, 0.5, 3.4), M(s * 3.38, DECK + 0.62, 12.2), col(0x3a3430), RM.teak);
    body.add(RBOX(1.1, 0.75, 0.8, 0.05), M(s * 1.9, DECK + 0.38, 15.2), col(0x50585c), RM.dark);   // deck boxes
    body.add(new THREE.TorusGeometry(0.32, 0.07, 5, 12), M(s * (hwS(14) - 0.1), DECK + 0.62, 14, 0, Math.PI / 2, 0), (px, py, pz) => (Math.floor((Math.atan2(py - DECK - 0.62, pz - 14) / Math.PI + 1) * 4) % 2 ? col(0xc8301e) : col(0xe8e2d4)), RM.paint);
  }
  for (const [x, z] of [[-3.45, 11.2], [3.45, 13.8], [-3.45, 16.6], [3.45, 19.2]]) {
    body.add(BOX(0.1, 0.16, 0.18), M(x, DECK + 1.15, z), DMET, RM.metal);
    body.add(new THREE.SphereGeometry(0.075, 8, 6), M(x - Math.sign(x) * 0.08, DECK + 1.12, z), [1.0, 0.8, 0.5], E(3, 0.2));
    glows.push({ p: [x - Math.sign(x) * 0.14, DECK + 1.12, z], color: [2.2, 1.4, 0.65], size: 0.6 });
  }
  body.add(CYL(0.08, 0.08, 0.1, 8), M(0, DECK + 2.05, C1 + 0.1), [1.0, 0.8, 0.5], E(3, 0.2));   // over the saloon doors
  glows.push({ p: [0, DECK + 2.02, C1 + 0.2], color: [2.2, 1.4, 0.65], size: 0.7 });
  // the day tank (shoot it): red cylinder on a cradle across the stern, fuel lines + vent + stencil
  const FUEL = [0, DECK + 0.72, 19.0];
  body.add(CYL(0.6, 0.6, 2.6, 14), M(FUEL[0], FUEL[1], FUEL[2], 0, 0, Math.PI / 2), col(TANK_RED), RM.steel);
  for (const x of [-1.32, 1.32]) body.add(CYL(0.62, 0.62, 0.06, 14), M(x, FUEL[1], FUEL[2], 0, 0, Math.PI / 2), col(0x3a0c08), RM.iron);
  for (const x of [-0.8, 0.8]) { body.add(BOX(0.12, 0.3, 1.1), M(x, DECK + 0.15, FUEL[2]), DMET, RM.iron); body.add(BOX(0.06, 0.06, 1.25), M(x, FUEL[1] + 0.61, FUEL[2], 0, 0, 0), DMET, RM.iron); }
  for (const s of [-1, 1]) quad(body, [s * 1.36, FUEL[1], FUEL[2]], [0, 0, -s], [0, 1, 0], 1.0, 0.375, R.gazole, [1, 1, 1], RM.text);
  quad(body, [0, FUEL[1] + 0.05, FUEL[2] + 0.607], [1, 0, 0], [0, 1, 0], 1.2, 0.45, R.gazole, [1, 1, 1], RM.text);
  tube(body, [0.9, FUEL[1] + 0.55, FUEL[2]], [0.9, FUEL[1] + 1.3, FUEL[2] + 0.1], 0.03, DMET, RM.metal, 5);
  polyTube(body, [new V3(-1.0, FUEL[1] - 0.4, FUEL[2] - 0.3), new V3(-1.2, DECK + 0.08, FUEL[2] - 0.8), new V3(-1.4, DECK + 0.08, C1 + 1)], 0.025, BLACK, RM.rubber, 5);
  // stern staff + tricolore, stern light
  tube(body, [0, DECK + 0.1, ZS - 0.6], [0, DECK + 2.7, ZS + 0.1], 0.04, DMET, RM.metal, 6);
  for (let k = 0; k < 3; k++) body.add(BOX(0.025, 0.85, 0.42), M(0, DECK + 2.25, ZS + 0.23 + k * 0.42, 0, 0, 0.0), [col(0x1f3c8c), col(0xe8e4da), col(0xb01c22)][k], RM.cloth);
  body.add(CYL(0.06, 0.06, 0.12, 8), M(0, DECK + 1.3, ZS - 0.15), [1, 1, 0.95], E(3, 0.1));
  glows.push({ p: [0, DECK + 1.32, ZS - 0.05], color: [3.0, 2.9, 2.6], size: 0.8 });
  // bollards aft, a coil of rope, fenders hung over the side
  for (const s of [-1, 1]) {
    for (const dz of [-0.2, 0.2]) body.add(CYL(0.1, 0.11, 0.4, 8), M(s * 2.9, DECK + 0.2, 17.6 + dz), DMET, RM.iron);
    body.add(new THREE.TorusGeometry(0.22, 0.05, 4, 10), M(s * 2.3, DECK + 0.05, 17.9, Math.PI / 2, 0, 0), col(0x6a5a40), RM.rope);
    for (const z of [-6, 2, 10]) { body.add(RBOX(0.3, 0.7, 0.3, 0.12, 2), M(s * (BW + 0.15), 0.4, z), BLACK, RM.rubber); tube(body, [s * (BW + 0.15), 0.75, z], [s * (BW - 0.1), sheer(z), z], 0.015, col(0x5a5040), RM.rope, 4); }
  }
  // cabin floodlight + window glow onto the water (cheap: glows at the window line, both sides)
  for (const s of [-1, 1]) for (let z = C0 + 2.6; z < C1; z += 4.8) glows.push({ p: [s * (XW + 0.1), 2.2, z], color: [0.9, 0.5, 0.22], size: 2.6 });
  // ---------- bake: AO in the deck / cabin corners, waterline grime, soot under the floods
  body.shade((x, y, z, nx, ny) => {
    let k = 1;
    if (Math.abs(ny) < 0.6 && y > DECK - 0.05 && y < DECK + 0.45 && Math.abs(x) < 3.9) k *= 0.55 + 0.45 * sstep((y - DECK) / 0.45);
    if (y < 0.6 && Math.abs(x) > 1) k *= 0.78 + 0.22 * sstep((y - 0.05) / 0.55);
    if (y < 0.45 && y > -0.05) return [k * 0.85, k * 0.95, k * 0.7];
    return k;
  });
  // ---------- anchors + colliders
  const deckPts = [[-2.55, 11.0], [2.6, 11.6], [-1.1, 12.9], [1.3, 13.8], [-2.7, 15.6], [2.55, 16.6], [-1.6, 17.3], [0.3, 15.7]].map(([x, z]) => ({ x, y: DECK + 0.02, z }));
  const colliders = [
    { min: [-BW, -1.1, ZB + 1.5], max: [BW, DECK, ZS], data: { mat: 'metal' } },
    { min: [-XW, DECK, C0], max: [XW, YRF, C1], data: { mat: 'glass' } },
    { min: [-WX, WY0, W0], max: [WX, WY1, W1], data: { mat: 'glass' } },
    { min: [-1.32, DECK, FUEL[2] - 0.62], max: [1.32, FUEL[1] + 0.62, FUEL[2] + 0.62], data: { mat: 'metal', fuel: true } },
  ];
  const anchors = {
    deck: deckPts, fuel: FUEL, spot: { p: SPOT, dir: SPOTD.toArray() },
    bow: [0, sheer(ZB + 0.5), ZB + 0.3], stern: [0, DECK, ZS],
    reflect: [{ p: [0, 2.2, -3], color: [1.2, 0.7, 0.32], len: 14, width: 7 }],   // the lit cabin's smear (model space, ground = waterline)
  };
  const res = assemble('bateau', body, glass, glows, { halos: opts.halos ?? true, beam: opts.beam === false ? null : { p: new V3(...SPOT).addScaledVector(SPOTD, 0.3).toArray(), dir: SPOTD.toArray(), len: 75, r0: 0.2, r1: 9 }, colliders, anchors });
  // searchlight sweep (call update(dt, t) from the set piece to animate it; static otherwise)
  const b0 = res.beam ? res.beam.quaternion.clone() : null, _q = new THREE.Quaternion(), _d = new V3();
  res.update = (dt, t = 0) => {
    if (!res.beam || res.burnt) return;
    _q.setFromAxisAngle(new V3(0, 1, 0), Math.sin(t * 0.37) * 0.45 + Math.sin(t * 0.11) * 0.2);
    res.beam.quaternion.copy(_q).multiply(b0);
    _d.copy(SPOTD).applyQuaternion(_q); res.anchors.spot.dir = _d.toArray();
  };
  return res;
}

// =====================================================================================
//  PÉNICHE (38.5 × 5.05 m) — moored houseboat. quay side = opts.quaySide (-1 = port / -x, default)
// =====================================================================================
function buildPeniche(opts) {
  const seed = opts.seed ?? 3, rng = makeRng(seed * 104729 + 3);
  const body = new Bk(), glass = new Bk(), glows = [];
  const QS = opts.quaySide ?? -1, GAP = opts.quayGap ?? 0.85, QH = opts.quayHeight ?? 1.4;   // quay top above the water
  const HULL = col(0x22252a), DMET = col(0x33373b), WHITE = col(0xcfcac0);
  const house = [col(0x3a5444), col(0x3e4658), col(0x5a4232), col(0x3e5656), col(0x4e3c46)][seed % 5];
  const ZB = -19.25, ZS = 19.25, BW = 2.52, SH = 1.25, H1Lamp = 11.56;
  const hwS = (z) => {
    if (z < -16.4) { const t = clamp01((-16.4 - z) / 2.85); return BW * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.2))); }
    if (z > 16.0) { const t = clamp01((z - 16.0) / 3.6); return BW * Math.sqrt(Math.max(0, 1 - t * t)); }
    return BW;
  };
  const sheer = (z) => SH + 0.32 * sstep((-15 - z) / 4.25) + 0.08 * sstep((z - 16) / 3.25);
  const keel = (z) => -0.95 + 1.8 * Math.pow(clamp01((-16.2 - z) / 3.05), 1.4) + 0.5 * Math.pow(clamp01((z - 16.5) / 2.75), 1.6);
  const ROWS = [-0.2, -0.04, 0.0, 0.35, 0.95, 1.0, 1.06];
  const sec = (z) => {
    const B = hwS(z), yb = keel(z), ys = sheer(z), bow = sstep((-16.4 - z) / 2.85);
    const W = (y) => B * (1 - bow * 0.25 * clamp01((ys - y) / (ys - yb + 1e-3)));
    const pts = [[0, yb], [Math.max(0, W(yb) - 0.2), yb], [Math.max(0, W(yb) - 0.04), yb + 0.1]];
    let yp = yb + 0.1;
    for (const y0 of ROWS) { const y = Math.max(y0, yp); yp = y; pts.push([W(Math.min(y, ys)), Math.min(y, ys)]); }
    pts.push([W(ys), ys]);
    return pts;
  };
  const zs = [];
  for (let z = ZB; z < -16.4; z += 0.4) zs.push(z);
  for (let z = -16.4; z < 16; z += 2.35) zs.push(z);
  for (let z = 16; z < ZS - 0.01; z += 0.55) zs.push(z);
  zs.push(ZS);
  loftHull(body, zs, sec, (x, y) => {
    if (y < -0.03) return [col(0x2a1a14), RM.paint];
    if (y > 0.95 && y < 1.06) return [WHITE, RM.paint];      // white gunwale line
    return [HULL, RM.steel];
  });
  // gunwale cap + rubbing bars (péniches have heavy steel rubbing bars)
  strake(body, zs, hwS, (z) => sheer(z), 0.06, col(0x3a1e16), RM.paint, { out: 0.0, sy: 0.8 });
  for (const yy of [0.32, 0.7]) strake(body, zs.filter((z) => z > -18.6 && z < 18.8), hwS, () => yy, 0.05, DMET, RM.iron, { out: 0.03 });
  // side decks + fore / aft decks
  const PP = [[0, 12.3, 1.6, 0.55], [0, -14.0, 1.4, 0.3]];
  for (let z = -12.1; z < 11; z += 4.6) for (const s of [-1, 1]) PP.push([s * 2.2, z, 0.9, 0.18]);
  deck(body, zs.filter((z) => z > ZB + 0.25), (z) => Math.max(0.01, hwS(z) - 0.06), (z) => sheer(z) - 0.06, pools(col(0x3a3631), PP), [0.55, 0, 0.3, 0], 0.03);
  for (const [x, z] of [[0.5, H1Lamp], [-1.2, -13.6]]) {
    body.add(BOX(0.14, 0.2, 0.08), M(x, SH + 1.6, z), DMET, RM.metal);
    body.add(new THREE.SphereGeometry(0.07, 8, 6), M(x, SH + 1.55, z + Math.sign(z) * 0.07), [1.0, 0.8, 0.5], E(3, 0.2));
    glows.push({ p: [x, SH + 1.55, z + Math.sign(z) * 0.14], color: [2.0, 1.3, 0.6], size: 0.6 });
  }
  // names on the bow (both sides) and the stern
  const nmR = R.pen[seed % R.pen.length];
  for (const s of [-1, 1]) sideDecal(body, s, s > 0 ? -14.3 : -16.9, s > 0 ? -16.9 : -14.3, 0.42, 0.42 + 2.6 / 2.55, (z) => hwS(z) + 0.02, nmR);
  quad(body, [0, 0.62, ZS + 0.012], [1, 0, 0], [0, 1, 0], 2.0, 0.78, nmR, [1, 1, 1], RM.text);
  // ---------- deckhouse (the converted hold): z -13.5 .. 11.5, windows lit warm, roof garden
  const H0 = -13.5, H1 = 11.5, HX = 1.95, HY0 = SH - 0.06, HY1 = 2.75;
  body.add(BOX(HX * 2, HY1 - HY0, H1 - H0), M(0, (HY0 + HY1) / 2, (H0 + H1) / 2), house, RM.steel);
  body.add(BOX(HX * 2 + 0.12, 0.08, H1 - H0 + 0.12), M(0, HY1 + 0.04, (H0 + H1) / 2), col(0x1c1c1c), RM.dark);   // roof edge
  const winCols = [[1.0, 0.62, 0.3], [1.0, 0.7, 0.42], [0.95, 0.5, 0.22], [0.55, 0.65, 1.0], [1.0, 0.82, 0.6]];
  for (const s of [-1, 1]) for (let z = H0 + 1.4, k = 0; z < H1 - 0.8; z += 2.3, k++) {
    const lit = rng() < 0.72, wc = winCols[(rng() * (rng() < 0.12 ? 5 : 3)) | 0];
    body.add(BOX(0.06, 0.66, 1.06), M(s * (HX + 0.02), HY0 + 0.85, z), DMET, RM.metal);                            // frame
    if (lit) {
      body.add(BOX(0.02, 0.56, 0.96), M(s * (HX + 0.045), HY0 + 0.85, z), mulc(wc, 0.9), E(1.6, 0.3));
      // curtain halves (dark silhouettes against the glow)
      if (rng() < 0.6) for (const dz of [-0.36, 0.36]) body.add(BOX(0.025, 0.56, 0.22), M(s * (HX + 0.05), HY0 + 0.85, z + dz), mulc(wc, 0.35), E(0.6, 0.6));
      if (k % 2 === 0) glows.push({ p: [s * (HX + 0.25), HY0 + 0.85, z], color: mulc(wc, 1.1), size: 1.5 });
    } else body.add(BOX(0.02, 0.56, 0.96), M(s * (HX + 0.045), HY0 + 0.85, z), col(0x0a0c0e), RM.gloss);
  }
  // front / back of the deckhouse: a glazed door aft, a window forward
  body.add(BOX(0.9, 1.3, 0.06), M(0.5, HY0 + 0.68, H1 + 0.02), DMET, RM.metal);
  body.add(BOX(0.7, 0.75, 0.03), M(0.5, HY0 + 0.95, H1 + 0.05), [1.0, 0.68, 0.36], E(1.2, 0.3));
  body.add(BOX(1.3, 0.55, 0.03), M(0, HY0 + 0.9, H0 - 0.02), [1.0, 0.62, 0.3], E(1.0, 0.3));
  // hull portholes (forepeak cabin + aft cabin), lit
  for (const s of [-1, 1]) for (const z of [-17.8, -16.6, -15.4, 16.6, 17.6]) {
    const x = s * (hwS(z) + 0.005);
    body.add(new THREE.TorusGeometry(0.15, 0.03, 4, 12), M(x, 0.62, z, 0, Math.PI / 2, 0), col(0x8a7a5a), RM.metal);
    const on = rng() < 0.7;
    body.add(CYL(0.13, 0.13, 0.03, 12), M(x, 0.62, z, 0, 0, Math.PI / 2), on ? [1.0, 0.66, 0.34] : col(0x0a0c0e), on ? E(1.4, 0.2) : RM.gloss);
  }
  // roof garden: planked roof deck, pots + plants, bikes, deck chair, table, fairy lights, stovepipe, solar panel, gas bottles
  body.add(BOX(HX * 2 - 0.2, 0.05, H1 - H0 - 0.4), M(0, HY1 + 0.1, (H0 + H1) / 2), col(0x5a4c3c), RM.teak);
  const plant = (x, z, s = 1) => {
    const r = makeRng((x * 100 + z * 7 + seed * 31) | 0);
    body.add(CYL(0.22 * s, 0.16 * s, 0.34 * s, 8), M(x, HY1 + 0.12 + 0.17 * s, z), col(0x7a3a22), RM.wood);
    const n = 2 + ((r() * 3) | 0);
    for (let k = 0; k < n; k++) body.add(new THREE.IcosahedronGeometry(0.26 * s * (0.7 + r() * 0.6), 0), M(x + (r() - 0.5) * 0.25 * s, HY1 + 0.42 * s + r() * 0.3 * s, z + (r() - 0.5) * 0.25 * s, r() * 3, r() * 3, 0, 1, 0.8 + r() * 0.6, 1), mulc(col(0x2c4a22), 0.7 + r() * 0.5), RM.plant);
  };
  for (const [x, z, s] of [[-1.55, -12.8, 1.1], [1.5, -12.6, 0.9], [-1.6, -9.5, 0.8], [1.6, -5.2, 1.2], [-1.6, -0.5, 1.0], [1.55, 4.6, 0.85], [-1.55, 8.8, 1.15], [1.5, 10.8, 1.0], [-0.6, 10.9, 0.7]]) if (rng() < 0.9) plant(x, z, s);
  // a lemon-tree-ish tall plant in a big tub
  body.add(BOX(0.6, 0.5, 0.6), M(0.9, HY1 + 0.37, -8.0), col(0x4a3424), RM.wood);
  tube(body, [0.9, HY1 + 0.6, -8], [0.9, HY1 + 1.5, -8], 0.04, col(0x3a2a1a), RM.wood, 5);
  body.add(new THREE.IcosahedronGeometry(0.6, 1), M(0.9, HY1 + 1.75, -8, 0, 0, 0, 1, 0.85, 1), col(0x22401c), RM.plant);
  // bikes (two, leaning on each other)
  const bike = (x, z, ry, c) => {
    const m0 = M(x, HY1 + 0.12, z, 0, ry, 0.12);
    const P = (a, b, cc) => new V3(a, b, cc).applyMatrix4(m0);
    for (const dz of [-0.52, 0.52]) body.add(new THREE.TorusGeometry(0.33, 0.022, 4, 14), m0.clone().multiply(M(0, 0.34, dz, 0, Math.PI / 2, 0)), col(0x111111), RM.rubber);
    const bb = P(0, 0.34, 0.05), seat = P(0, 0.9, 0.2), head = P(0, 0.88, -0.38), rw = P(0, 0.34, 0.52), fw = P(0, 0.34, -0.52);
    polyTube(body, [rw, bb, head, fw], 0.022, c, RM.paint, 5); polyTube(body, [rw, seat, bb], 0.02, c, RM.paint, 5); tube(body, seat, head, 0.02, c, RM.paint, 5);
    body.add(BOX(0.1, 0.05, 0.24), m0.clone().multiply(M(0, 0.95, 0.2)), col(0x111111), RM.leather);
    tube(body, P(-0.25, 1.0, -0.42), P(0.25, 1.0, -0.42), 0.018, DMET, RM.metal, 5);
    tube(body, head, P(0, 1.0, -0.42), 0.02, DMET, RM.metal, 5);
    if (c[0] > 0.2) body.add(BOX(0.3, 0.2, 0.25), m0.clone().multiply(M(0, 0.92, -0.62)), col(0x6a4a2a), RM.wood);   // basket
  };
  bike(1.25, -2.6, 0.05, col(0x6a1a14)); bike(1.05, -1.3, -0.1, col(0x2a4a5a));
  // deck chair (striped canvas) + café table + two chairs
  { const cz = 2.2, cx = -0.7;
    tube(body, [cx - 0.3, HY1 + 0.12, cz + 0.5], [cx - 0.3, HY1 + 0.85, cz - 0.15], 0.02, col(0x8a6a4a), RM.wood, 4);
    tube(body, [cx + 0.3, HY1 + 0.12, cz + 0.5], [cx + 0.3, HY1 + 0.85, cz - 0.15], 0.02, col(0x8a6a4a), RM.wood, 4);
    tube(body, [cx - 0.3, HY1 + 0.12, cz - 0.4], [cx - 0.3, HY1 + 0.5, cz + 0.3], 0.02, col(0x8a6a4a), RM.wood, 4);
    tube(body, [cx + 0.3, HY1 + 0.12, cz - 0.4], [cx + 0.3, HY1 + 0.5, cz + 0.3], 0.02, col(0x8a6a4a), RM.wood, 4);
    const cv = new THREE.PlaneGeometry(0.56, 1.1, 1, 6); cv.translate(0, 0, 0);
    body.add(cv, M(cx, HY1 + 0.5, cz + 0.12, -1.0, 0, 0), (px) => (Math.floor((px - cx + 0.28) / 0.08) % 2 ? col(0x1f3c6c) : col(0xd8d2c4)), RM.cloth);
    body.add(cv, M(cx, HY1 + 0.5, cz + 0.12, -1.0, Math.PI, 0), (px) => (Math.floor((px - cx + 0.28) / 0.08) % 2 ? col(0x1f3c6c) : col(0xd8d2c4)), RM.cloth);
    body.add(CYL(0.36, 0.36, 0.03, 12), M(-0.6, HY1 + 0.85, 5.6), col(0x2a2c2e), RM.metal);
    tube(body, [-0.6, HY1 + 0.12, 5.6], [-0.6, HY1 + 0.84, 5.6], 0.025, col(0x2a2c2e), RM.metal, 5);
    for (const dz of [-0.6, 0.6]) { body.add(BOX(0.42, 0.04, 0.42), M(-0.6, HY1 + 0.55, 5.6 + dz), col(0x2a2c2e), RM.metal); body.add(BOX(0.42, 0.42, 0.04), M(-0.6, HY1 + 0.78, 5.6 + dz * 1.33), col(0x2a2c2e), RM.metal); for (const dx of [-0.18, 0.18]) tube(body, [-0.6 + dx, HY1 + 0.12, 5.6 + dz], [-0.6 + dx, HY1 + 0.55, 5.6 + dz], 0.015, col(0x2a2c2e), RM.metal, 4); }
    body.add(CYL(0.035, 0.035, 0.3, 6), M(-0.5, HY1 + 1.0, 5.6), col(0x1c3a1a), RM.gloss); }
  // fairy lights on four poles over the roof garden (catenaries) — warm bulbs
  { const posts = [[-1.75, -11.5], [1.75, -6], [-1.75, 0.5], [1.75, 6.5], [-1.75, 10.8]];
    for (const [x, z] of posts) tube(body, [x, HY1 + 0.12, z], [x, HY1 + 1.9, z], 0.025, DMET, RM.metal, 5);
    for (let i = 0; i < posts.length - 1; i++) {
      const a = new V3(posts[i][0], HY1 + 1.9, posts[i][1]), b = new V3(posts[i + 1][0], HY1 + 1.9, posts[i + 1][1]);
      const cat = catenary(a, b, 0.45, 8); polyTube(body, cat, 0.008, col(0x111111), RM.rope, 3);
      for (let k = 1; k < 8; k += 2) { const p = cat[k]; body.add(new THREE.IcosahedronGeometry(0.04, 0), M(p.x, p.y - 0.04, p.z), [1.0, 0.75, 0.4], E(3, 0.2)); glows.push({ p: [p.x, p.y - 0.05, p.z], color: [1.6, 1.0, 0.45], size: 0.45 }); }
    } }
  // stovepipe, solar panel, gas bottles, satellite dish
  tube(body, [1.3, HY1 + 0.1, 9.6], [1.3, HY1 + 1.4, 9.6], 0.09, col(0x1a1a1a), RM.iron, 8);
  body.add(CYL(0.18, 0.12, 0.12, 8), M(1.3, HY1 + 1.48, 9.6), col(0x1a1a1a), RM.iron);
  body.add(BOX(1.6, 0.04, 1.0), M(-0.9, HY1 + 0.5, -4.2, 0.35, 0, 0), col(0x101624), [0.2, 0.6, 0, 0]);
  for (const dx of [-0.6, 0.6]) tube(body, [-0.9 + dx, HY1 + 0.12, -3.85], [-0.9 + dx, HY1 + 0.35, -3.85], 0.02, DMET, RM.metal, 4);
  for (const dz of [0, 0.38]) body.add(CYL(0.15, 0.15, 0.55, 10), M(-1.6, HY1 + 0.42, 11.0 + dz), col(0x9a8a3a), RM.paint);
  body.add(CYL(0.28, 0.05, 0.12, 10), M(1.3, HY1 + 0.65, -10.5, 0.6, 0.4, 0), col(0xb8b4aa), RM.paint);
  // ---------- foredeck: anchor winch, bitts, hatch, mast in tabernacle
  body.add(RBOX(0.9, 0.5, 0.6, 0.06), M(0, sheer(-17.8) + 0.12, -17.8), col(0x2a2c2a), RM.iron);
  body.add(CYL(0.15, 0.15, 1.1, 10), M(0, sheer(-17.8) + 0.38, -17.8, 0, 0, Math.PI / 2), DMET, RM.iron);
  body.add(BOX(1.8, 0.45, 1.6), M(0, SH + 0.15, -15.2), house, RM.steel);
  body.add(BOX(1.9, 0.05, 1.7), M(0, SH + 0.39, -15.2), col(0x1c1c1c), RM.dark);
  tube(body, [0, SH + 0.4, -14.2], [0, SH + 4.2, -14.4], 0.06, col(0x1c1c1c), RM.metal, 6);
  body.add(CYL(0.06, 0.06, 0.12, 8), M(0, SH + 4.25, -14.4), [1, 1, 0.95], E(2.5, 0.1));
  glows.push({ p: [0, SH + 4.28, -14.4], color: [2.6, 2.5, 2.2], size: 0.8 });
  const bitts = [];
  for (const s of [-1, 1]) for (const z of [-17.0, -12.0, 12.6, 18.0]) {
    const x = s * (hwS(z) - 0.32), y = sheer(z) - 0.06;
    for (const dz of [-0.17, 0.17]) body.add(CYL(0.09, 0.1, 0.36, 8), M(x, y + 0.18, z + dz), DMET, RM.iron);
    body.add(BOX(0.12, 0.06, 0.48), M(x, y + 0.3, z), DMET, RM.iron);
    if (s === QS) bitts.push(new V3(x, y + 0.25, z));
  }
  // ---------- wheelhouse aft (varnished wood, glass all round), stern deck, tiller gear, tricolore
  const W0 = 12.9, W1 = 16.3, WX = 1.55, WY0 = SH - 0.06, WY1 = 3.45;
  body.add(BOX(WX * 2, 1.0, W1 - W0), M(0, WY0 + 0.5, (W0 + W1) / 2), col(0x4a2410), RM.varnish);
  for (const s of [-1, 1]) glass.add(new THREE.PlaneGeometry(W1 - W0 - 0.3, 1.0), M(s * (WX + 0.005), WY0 + 1.55, (W0 + W1) / 2, 0, s * Math.PI / 2, 0), col(0x5a6a74), RM.paint);
  glass.add(new THREE.PlaneGeometry(WX * 2 - 0.3, 1.0), M(0, WY0 + 1.55, W0 - 0.005, 0, Math.PI, 0), col(0x5a6a74), RM.paint);
  glass.add(new THREE.PlaneGeometry(WX * 2 - 0.3, 1.0), M(0, WY0 + 1.55, W1 + 0.005), col(0x5a6a74), RM.paint);
  for (const x of [-WX, 0, WX]) for (const z of [W0, W1]) body.add(BOX(0.1, 1.1, 0.1), M(x, WY0 + 1.55, z), col(0x4a2410), RM.varnish);
  for (const s of [-1, 1]) body.add(BOX(0.1, 1.1, 0.1), M(s * WX, WY0 + 1.55, (W0 + W1) / 2), col(0x4a2410), RM.varnish);
  body.add(BOX(WX * 2 + 0.4, 0.12, W1 - W0 + 0.5), M(0, WY1 - 0.06, (W0 + W1) / 2), WHITE, RM.paint);
  body.add(BOX(WX * 2 - 0.1, 0.02, W1 - W0 - 0.1), M(0, WY1 - 0.13, (W0 + W1) / 2), [1.0, 0.75, 0.45], E(0.5, 0.6));   // warm ceiling
  body.add(new THREE.TorusGeometry(0.35, 0.03, 4, 14), M(0, WY0 + 1.25, W0 + 0.55, -0.3, 0, 0), col(0x5a3018), RM.varnish);   // ship's wheel
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; tube(body, new V3(0, WY0 + 1.25, W0 + 0.55), new V3(Math.cos(a) * 0.45, WY0 + 1.25 + Math.sin(a) * 0.45 * Math.cos(0.3), W0 + 0.55 + Math.sin(a) * 0.45 * Math.sin(0.3)), 0.015, col(0x5a3018), RM.varnish, 4); }
  for (const s of [-1, 1]) {
    body.add(BOX(0.04, 0.12, 0.2), M(s * (WX + 0.25), WY0 + 1.3, W0 + 0.2), s < 0 ? [1, 0.08, 0.05] : [0.1, 1, 0.35], E(2.5, 0.1));
    body.add(BOX(0.14, 0.24, 0.3), M(s * (WX + 0.17), WY0 + 1.3, W0 + 0.2), DMET, RM.metal);
    glows.push({ p: [s * (WX + 0.35), WY0 + 1.3, W0 + 0.2], color: s < 0 ? [2.8, 0.2, 0.1] : [0.2, 2.6, 0.8], size: 0.7 });
  }
  glows.push({ p: [0, WY0 + 1.5, (W0 + W1) / 2], color: [0.8, 0.5, 0.24], size: 2.2 });
  tube(body, [0, SH, ZS - 0.4], [0, SH + 2.2, ZS + 0.05], 0.035, DMET, RM.metal, 6);
  for (let k = 0; k < 3; k++) body.add(BOX(0.02, 0.6, 0.3), M(0, SH + 1.85, ZS + 0.15 + k * 0.3), [col(0x1f3c8c), col(0xe8e4da), col(0xb01c22)][k], RM.cloth);
  // ---------- mooring: lines to bollards on the quay, tyre fenders on the quay side, a gangway
  const qx = QS * (BW + GAP + 0.55);
  const bollards = [new V3(qx, QH, -21.5), new V3(qx, QH, -9), new V3(qx, QH, 8.5), new V3(qx, QH, 21.0)];
  for (const b of bollards) {
    body.add(CYL(0.16, 0.2, 0.55, 10), M(b.x, b.y + 0.27, b.z), col(0x1a1c1e), RM.iron);
    body.add(CYL(0.24, 0.24, 0.08, 10), M(b.x, b.y + 0.58, b.z), col(0x1a1c1e), RM.iron);
  }
  const ROPE = col(0x6a5a44);
  const lines = [[bitts[0], bollards[0]], [bitts[1], bollards[1]], [bitts[2], bollards[2]], [bitts[3], bollards[3]]];
  for (const [a, b] of lines) { if (!a) continue; const top = b.clone().setY(b.y + 0.45); polyTube(body, catenary(a, top, 0.35 + rng() * 0.15, 12), 0.045, ROPE, RM.rope, 6); body.add(new THREE.TorusGeometry(0.2, 0.04, 4, 10), M(top.x, top.y - 0.05, top.z, Math.PI / 2, 0, 0), ROPE, RM.rope); }
  for (const z of [-14, -6, 3, 10, 15.5]) {
    const x = QS * (BW + 0.16);
    body.add(new THREE.TorusGeometry(0.3, 0.12, 6, 12), M(x, 0.55, z, 0, Math.PI / 2, 0), col(0x121212), RM.rubber);
    tube(body, [x, 0.85, z], [QS * (BW - 0.2), sheer(z) + 0.05, z], 0.018, ROPE, RM.rope, 4);
  }
  { // gangway plank with a rope handrail, from the side deck to the quay
    const a = new V3(QS * (BW - 0.25), SH + 0.02, -3.5), b = new V3(QS * (BW + GAP + 0.6), QH + 0.04, -3.5);
    const d = new V3().subVectors(b, a), L = d.length(), ang = Math.atan2(d.y, Math.abs(d.x));
    body.add(BOX(L, 0.06, 0.6), M((a.x + b.x) / 2, (a.y + b.y) / 2, a.z, 0, 0, QS < 0 ? -ang : ang), col(0x4a4034), RM.teak);
    for (const dz of [-0.3, 0.3]) { tube(body, a.clone().add(new V3(0, 0, dz)), a.clone().add(new V3(0, 0.9, dz)), 0.02, DMET, RM.metal, 4); tube(body, b.clone().add(new V3(0, 0, dz)), b.clone().add(new V3(0, 0.9, dz)), 0.02, DMET, RM.metal, 4); polyTube(body, catenary(a.clone().add(new V3(0, 0.9, dz)), b.clone().add(new V3(0, 0.9, dz)), 0.12, 5), 0.014, ROPE, RM.rope, 4); }
  }
  // ---------- bake
  body.shade((x, y, z, nx, ny) => {
    let k = 1;
    if (Math.abs(ny) < 0.6 && y > SH - 0.1 && y < SH + 0.5 && Math.abs(x) < 2.3) k *= 0.5 + 0.5 * sstep((y - SH + 0.1) / 0.6);
    if (Math.abs(ny) < 0.6 && y > HY1 && y < HY1 + 0.45) k *= 0.6 + 0.4 * sstep((y - HY1) / 0.45);
    if (y < 0.5 && y > -0.05 && Math.abs(x) > 1.5) return [k * 0.7, k * 0.78, k * 0.5];   // algae / silt at the waterline
    return k;
  });
  const colliders = [
    { min: [-BW, -0.95, ZB + 0.6], max: [BW, SH, ZS - 0.2], data: { mat: 'metal' } },
    { min: [-HX, SH, H0], max: [HX, HY1 + 0.1, H1], data: { mat: 'metal' } },
    { min: [-WX, SH, W0], max: [WX, WY1, W1], data: { mat: 'wood' } },
  ];
  const anchors = { bollards: bollards.map((b) => b.toArray()), gangway: [QS * (BW + GAP + 0.6), QH, -3.5] };
  return assemble('peniche', body, glass, glows, { halos: opts.halos ?? false, colliders, anchors, extraInfo: { name: PEN_NAMES[seed % PEN_NAMES.length] } });
}

// =====================================================================================
//  SPEEDBOAT (8.5 × 2.4 m) — classic varnished-mahogany runabout
// =====================================================================================
function buildSpeedboat(opts) {
  const body = new Bk(), glass = new Bk(), glows = [];
  const MAH = col(MAHOGANY), CHROME = col(0xd8dade), LEATHER = col(0xe6e0d0), DKMAH = col(0x2a0d06), BLACK = col(0x0d0d0e);
  const ZB = -4.25, ZS = 4.25, BW = 1.2;
  const hwS = (z) => {
    if (z < -0.8) { const t = clamp01((-0.8 - z) / 3.45); return BW * Math.pow(Math.max(0, 1 - t * t), 0.75); }
    if (z > 3.0) return BW - 0.07 * (z - 3.0) / 1.25;
    return BW;
  };
  const sheer = (z) => 0.86 + 0.2 * sstep((-0.5 - z) / 3.75) - 0.04 * sstep((z - 2.5) / 1.75);
  const keel = (z) => -0.48 + 1.0 * Math.pow(clamp01((-2.0 - z) / 2.25), 1.5) + 0.12 * sstep((z - 2.5) / 1.75);
  const chineY = (z) => -0.14 + 0.5 * Math.pow(clamp01((-1.5 - z) / 2.75), 1.4);
  const sec = (z) => {
    const B = hwS(z), yb = keel(z), yc = Math.max(chineY(z), yb + 0.02), ys = sheer(z);
    const pts = [[0, yb], [B * 0.45, lerp(yb, yc, 0.62)], [B * 0.88, yc], [B * 0.95, yc + 0.03]];
    let yp = yc + 0.03;
    for (const y0 of [0.0, 0.07, 0.11, 0.4, 0.75]) { const y = Math.min(Math.max(y0, yp), ys); yp = y; pts.push([B * (0.97 + 0.03 * clamp01((y - yc) / (ys - yc + 1e-3))), y]); }
    pts.push([B, ys]);
    return pts;
  };
  const zs = [];
  for (let z = ZB; z < -0.8; z += 0.22) zs.push(z);
  for (let z = -0.8; z < ZS - 0.01; z += 0.5) zs.push(z);
  zs.push(ZS);
  loftHull(body, zs, sec, (x, y) => {
    if (y < 0.0) return [col(0xc8c2b4), RM.gloss];                 // white bottom
    if (y < 0.1) return [col(0x7a1410), RM.gloss];                 // red boot-top
    return [MAH, RM.varnish];
  });
  // transom: varnished, name in gilt
  quad(body, [0, 0.45, ZS + 0.012], [1, 0, 0], [0, 1, 0], 1.2, 0.45, R.charlotte, [1, 1, 1], RM.text);
  // chrome cutwater on the stem, rub rail (chrome half-round), boot-top pinstripe
  const stem = []; for (let k = 0; k <= 8; k++) { const t = k / 8, z = lerp(ZB + 0.02, ZB + 1.4, t * t); stem.push(new V3(0, lerp(sheer(ZB + 0.02), keel(z) + 0.05, t), z - 0.02)); }
  polyTube(body, stem, 0.025, CHROME, RM.chrome, 6);
  strake(body, zs.filter((z) => z > ZB + 0.08), hwS, (z) => sheer(z) - 0.025, 0.028, CHROME, RM.chrome, { out: 0.01 });
  // decks: foredeck (bow → windscreen), side decks around the cockpits, engine deck aft — caulked mahogany
  const WS = -1.55, CK0 = -1.45, CK1 = 0.2, RK0 = 0.32, RK1 = 2.9;
  const fd = zs.filter((z) => z < WS + 0.01).concat([WS]);
  deck(body, fd.filter((z) => z > ZB + 0.05), (z) => Math.max(0.01, hwS(z) - 0.02), (z) => sheer(z) - 0.005, MAH, RM.rivaDeck, 0.07);
  const sideDeck = (z0, z1) => { for (const s of [-1, 1]) body.add(BOX(0.24, 0.04, z1 - z0), M(s * (BW - 0.13), sheer((z0 + z1) / 2) - 0.0, (z0 + z1) / 2), MAH, RM.rivaDeck); };
  sideDeck(WS, RK1);
  body.add(BOX(BW * 2 - 0.02, 0.04, 0.12), M(0, sheer(0.26), 0.26), MAH, RM.rivaDeck);            // bridge between the cockpits
  const ed = [RK1, 3.4, 3.9, ZS]; deck(body, ed, (z) => hwS(z) - 0.01, (z) => sheer(z), MAH, RM.rivaDeck, 0.03);
  // cockpit tubs: mahogany walls inside, dark floor; front (driver) is deep, rear well is flat and open
  const tub = (z0, z1, floorY, wallC) => {
    const iw = BW - 0.25;
    for (const s of [-1, 1]) body.add(BOX(0.04, sheer((z0 + z1) / 2) - floorY, z1 - z0), M(s * iw, (sheer((z0 + z1) / 2) + floorY) / 2, (z0 + z1) / 2), wallC, RM.varnish);
    for (const z of [z0, z1]) body.add(BOX(iw * 2, sheer(z) - floorY, 0.04), M(0, (sheer(z) + floorY) / 2, z), wallC, RM.varnish);
    body.add(BOX(iw * 2, 0.04, z1 - z0), M(0, floorY, (z0 + z1) / 2), col(0x3a2a1e), RM.teak);
    // coaming: chrome-capped varnished lip
    for (const s of [-1, 1]) body.add(BOX(0.06, 0.05, z1 - z0 + 0.06), M(s * (iw + 0.02), sheer((z0 + z1) / 2) + 0.02, (z0 + z1) / 2), CHROME, RM.chrome);
    for (const z of [z0, z1]) body.add(BOX(iw * 2 + 0.1, 0.05, 0.06), M(0, sheer(z) + 0.02, z), CHROME, RM.chrome);
  };
  const FLOOR_F = 0.16, FLOOR_R = 0.32;
  tub(CK0, CK1, FLOOR_F, DKMAH); tub(RK0, RK1, FLOOR_R, DKMAH);
  // front bench (white leather, rolled piping), driver on the port side
  const CUSH = 0.62, SZ0 = -0.78, SZ1 = -0.22;
  body.add(RBOX(1.82, 0.16, SZ1 - SZ0, 0.06, 2), M(0, CUSH - 0.08, (SZ0 + SZ1) / 2), LEATHER, RM.leather);
  body.add(BOX(1.84, CUSH - 0.16 - FLOOR_F, 0.5), M(0, (CUSH - 0.16 + FLOOR_F) / 2, (SZ0 + SZ1) / 2 + 0.03), DKMAH, RM.varnish);
  body.add(RBOX(1.82, 0.5, 0.16, 0.06, 2), M(0, CUSH + 0.22, SZ1 + 0.02, -0.18, 0, 0), LEATHER, RM.leather);
  for (const x of [-0.6, -0.2, 0.2, 0.6]) body.add(BOX(0.012, 0.44, 0.17), M(x, CUSH + 0.22, SZ1 + 0.02, -0.18, 0, 0), col(0xb8b0a0), RM.leather);   // tufting lines
  // a second (rear) bench against the engine bulkhead is left out: the aft well is the player's standing area
  body.add(RBOX(1.9, 0.12, 0.95, 0.05, 2), M(0, sheer(3.45) + 0.07, 3.45), LEATHER, RM.leather);   // sun pad on the engine deck
  // engine hatch details: chrome vents + hinges
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) body.add(BOX(0.24, 0.02, 0.03), M(s * 0.7, sheer(ZS - 0.5) + 0.03, ZS - 0.7 + k * 0.08), CHROME, RM.chrome);
  // dashboard: varnished panel + chrome bezels with faintly lit dials; steering wheel (ivory rim, chrome spokes)
  const DASHZ = WS + 0.08, DY = sheer(WS) - 0.06;
  body.add(BOX(BW * 2 - 0.5, 0.36, 0.08), M(0, DY - 0.15, DASHZ + 0.02), DKMAH, RM.varnish);
  for (const [x, r] of [[-0.62, 0.07], [-0.42, 0.055], [-0.26, 0.055], [0.1, 0.045], [0.3, 0.045]]) {
    body.add(CYL(r + 0.012, r + 0.012, 0.03, 12), M(x, DY - 0.12, DASHZ + 0.07, Math.PI / 2, 0, 0), CHROME, RM.chrome);
    body.add(CYL(r, r, 0.032, 12), M(x, DY - 0.12, DASHZ + 0.072, Math.PI / 2, 0, 0), [0.85, 0.8, 0.6], E(0.6, 0.3));
  }
  const SEAT = { x: -0.42, z: -0.5 };
  const WC = new V3(SEAT.x, CUSH + 0.4, SEAT.z - 0.5), WT = 0.42;          // wheel matches the Driver rig (root + (0, 0.40, -0.50), tilt 0.42)
  const wm = M(WC.x, WC.y, WC.z, -(Math.PI / 2 - WT), 0, 0);
  body.add(new THREE.TorusGeometry(0.185, 0.016, 5, 18), wm.clone().multiply(M(0, 0, 0, Math.PI / 2, 0, 0)), col(0xe8e0c8), RM.gloss);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + Math.PI / 2; const p0 = new V3(0, 0, 0).applyMatrix4(wm), p1 = new V3(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17).applyMatrix4(wm); tube(body, p0, p1, 0.008, CHROME, RM.chrome, 4); }
  body.add(CYL(0.035, 0.035, 0.04, 10), wm, CHROME, RM.chrome);
  tube(body, new V3(0, -0.02, 0).applyMatrix4(wm), new V3(WC.x, DY - 0.15, DASHZ + 0.06), 0.02, CHROME, RM.chrome, 6);
  // throttle levers on the starboard side of the dash
  for (const dx of [0, 0.06]) { tube(body, [0.05 + dx, DY - 0.05, DASHZ + 0.12], [0.05 + dx, DY + 0.12, DASHZ + 0.22], 0.01, CHROME, RM.chrome, 4); body.add(new THREE.SphereGeometry(0.025, 6, 4), M(0.05 + dx, DY + 0.13, DASHZ + 0.23), BLACK, RM.gloss); }
  // wrap-around windscreen: raked curved glass in a chrome frame
  const ws = [];
  const WSH = 0.38, RAKE = 0.6;
  for (let k = 0; k <= 10; k++) {
    const t = k / 10, a = (t - 0.5) * 2;                      // -1..1 across
    const x = a * (BW - 0.12), zc = WS + 0.32 * Math.pow(Math.abs(a), 2.2);
    ws.push([x, zc]);
  }
  for (let k = 0; k < ws.length - 1; k++) {
    const [x0, z0] = ws[k], [x1, z1] = ws[k + 1], y0 = sheer(z0) + 0.03, y1 = sheer(z1) + 0.03;
    const A = [x0, y0, z0], B = [x1, y1, z1], Cc = [x1, y1 + WSH, z1 + WSH * RAKE], D = [x0, y0 + WSH, z0 + WSH * RAKE];
    const n = crs(sub(B, A), sub(D, A)); const l = len(n); const nn = [n[0] / l, n[1] / l, n[2] / l]; if (nn[2] > 0) { nn[0] *= -1; nn[1] *= -1; nn[2] *= -1; }
    const gc = col(0x9aa6ac);
    glass.tri(A, B, Cc, nn, nn, nn, WHITE_UV, WHITE_UV, WHITE_UV, gc, gc, gc, RM.paint);
    glass.tri(A, Cc, D, nn, nn, nn, WHITE_UV, WHITE_UV, WHITE_UV, gc, gc, gc, RM.paint);
    tube(body, D, Cc, 0.014, CHROME, RM.chrome, 5); tube(body, A, B, 0.016, CHROME, RM.chrome, 5);
  }
  for (const k of [0, 5, 10]) { const [x, z] = ws[k], y = sheer(z) + 0.03; tube(body, [x, y, z], [x, y + WSH, z + WSH * RAKE], 0.016, CHROME, RM.chrome, 5); }
  // grab rails along the rear cockpit, deck cleats, fairleads, bow light, nav pods, flagstaff + tricolore
  for (const s of [-1, 1]) {
    const x = s * (BW - 0.1), z0 = RK0 + 0.3, z1 = RK1 - 0.3, y = sheer(1.6);
    polyTube(body, [new V3(x, y, z0), new V3(x, y + 0.1, z0 + 0.05), new V3(x, y + 0.1, z1 - 0.05), new V3(x, y, z1)], 0.016, CHROME, RM.chrome, 5);
    for (const z of [-3.2, 3.85]) { body.add(BOX(0.04, 0.035, 0.2), M(s * (hwS(z) - 0.16), sheer(z) + 0.035, z), CHROME, RM.chrome); for (const dz of [-0.06, 0.06]) body.add(CYL(0.012, 0.016, 0.03, 5), M(s * (hwS(z) - 0.16), sheer(z) + 0.015, z + dz), CHROME, RM.chrome); }
    // nav pods on the foredeck sides
    const zn = -2.2;
    body.add(RBOX(0.1, 0.07, 0.22, 0.03), M(s * (hwS(zn) - 0.1), sheer(zn) + 0.03, zn), CHROME, RM.chrome);
    body.add(BOX(0.03, 0.04, 0.14), M(s * (hwS(zn) - 0.05), sheer(zn) + 0.035, zn), s < 0 ? [1, 0.08, 0.05] : [0.1, 1, 0.35], E(3, 0.1));
    glows.push({ p: [s * (hwS(zn) - 0.02), sheer(zn) + 0.04, zn], color: s < 0 ? [2.4, 0.15, 0.1] : [0.2, 2.2, 0.7], size: 0.28 });
  }
  const BL = [0, sheer(-3.95) + 0.07, -3.95];
  body.add(CYL(0.04, 0.05, 0.08, 10), M(BL[0], BL[1] - 0.03, BL[2]), CHROME, RM.chrome);
  body.add(new THREE.SphereGeometry(0.04, 8, 6), M(BL[0], BL[1] + 0.02, BL[2]), [1, 1, 0.95], E(3, 0.1));
  glows.push({ p: [BL[0], BL[1] + 0.03, BL[2]], color: [2.0, 1.9, 1.7], size: 0.22 });
  tube(body, [0, sheer(ZS - 0.15), ZS - 0.15], [0, sheer(ZS) + 0.95, ZS + 0.15], 0.018, CHROME, RM.chrome, 6);
  for (let k = 0; k < 3; k++) body.add(BOX(0.012, 0.3, 0.16), M(0, sheer(ZS) + 0.76, ZS + 0.22 + k * 0.16), [col(0x1f3c8c), col(0xe8e4da), col(0xb01c22)][k], RM.cloth);
  body.add(new THREE.SphereGeometry(0.03, 8, 6), M(0, sheer(ZS) + 0.97, ZS + 0.16), [1, 1, 0.95], E(3, 0.1));
  glows.push({ p: [0, sheer(ZS) + 0.98, ZS + 0.16], color: [2.2, 2.1, 1.9], size: 0.3 });
  // a chrome exhaust pair + the rudder / prop just under the transom
  for (const s of [-1, 1]) body.add(CYL(0.05, 0.05, 0.12, 10), M(s * 0.55, 0.2, ZS + 0.02, Math.PI / 2, 0, 0), CHROME, RM.chrome);
  body.add(BOX(0.03, 0.45, 0.3), M(0, -0.35, ZS - 0.15), col(0x8a7a5a), RM.metal);
  // ---------- bake: deck seams catch dirt near the tubs; slight waterline scum
  body.shade((x, y, z, nx, ny) => {
    let k = 1;
    if (Math.abs(ny) < 0.6 && y < 0.45 && y > 0.1 && Math.abs(x) < 1.0) k *= 0.6 + 0.4 * sstep((y - 0.12) / 0.3);
    if (y > 0.02 && y < 0.18 && Math.abs(x) > 0.8) return [k * 0.85, k * 0.9, k * 0.8];
    return k;
  });
  const colliders = [{ min: [-BW, -0.48, ZB + 0.3], max: [BW, sheer(0) , ZS], data: { mat: 'wood' } }];
  const anchors = {
    // seat.y = cushion top + 0.42: setpieces lowers the Driver root by 0.42 onto the cushion; wheel at root + (0, 0.40, -0.50)
    seat: { x: SEAT.x, y: CUSH + 0.42, z: SEAT.z, yaw: 0, cushion: CUSH },
    stand: { x: 0, y: FLOOR_R + 0.02, z: (RK0 + RK1) / 2, w: (BW - 0.25) * 2, l: RK1 - RK0 },
    wake: { x: 0, y: 0.05, z: ZS + 0.15 },
    bowLight: { x: BL[0], y: BL[1], z: BL[2] },
    wheel: WC.toArray(),
  };
  return assemble('speedboat', body, glass, glows, { halos: opts.halos ?? true, colliders, anchors });
}

// ---------------------------------------------------------------------- public API
export function buildBoat(kind, opts = {}) {
  materials();
  if (kind === 'bateau') return buildBateau(opts);
  if (kind === 'peniche') return buildPeniche(opts);
  if (kind === 'speedboat') return buildSpeedboat(opts);
  throw new Error('buildBoat: unknown kind ' + kind);
}
export function boatMaterials() { return materials(); }

// viewer helper: ?mod=/src/levels/iron-lady/boats.js&fn=boatPreview&args=["bateau",{"burnt":false}]
export function boatPreview(kind = 'bateau', o = {}, ctx) {
  if (typeof kind === 'object') { ctx = kind; kind = 'bateau'; }
  if (o && o.renderer) { ctx = o; o = {}; }
  const b = buildBoat(kind, o);
  if (o.burnt) b.setBurnt();
  if (b.update) b.update(0, 0);
  return b;
}
