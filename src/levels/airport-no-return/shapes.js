import * as THREE from 'three';

// =====================================================================================
//  Geometry helpers for the airport: lofted fuselages / nacelles and airfoil wings.
//  Model space: forward = -z, up = +y, right = +x.
// =====================================================================================

// Loft a tube through rings ordered along z. ring = { z, cy, rx, ry, cx=0, sq=2 } where sq > 2 squares the
// section off (superellipse) — cargo fuselages have flat bellies. Angle θ is measured from the top (+y) toward +x.
// opts: segs, theta0/theta1 (open arcs), capStart/capEnd, inside (flip normals), uv: 'len' -> (z-frac, θ-frac)
export function loft(rings, opts = {}) {
  const segs = opts.segs ?? 32, t0 = opts.theta0 ?? 0, t1 = opts.theta1 ?? Math.PI * 2;
  const closed = Math.abs(t1 - t0 - Math.PI * 2) < 1e-6;
  const cols = closed ? segs : segs + 1;
  const zMin = opts.zMin ?? rings[0].z, zMax = opts.zMax ?? rings[rings.length - 1].z, L = zMax - zMin || 1;
  const pos = [], uv = [], idx = [];
  for (const r of rings) {
    const sq = r.sq ?? 2, e = 2 / sq;
    for (let j = 0; j < cols; j++) {
      const th = t0 + (t1 - t0) * (j / segs);
      const s = Math.sin(th), c = Math.cos(th);
      let x = Math.sign(s) * Math.pow(Math.abs(s), e) * r.rx, y = Math.sign(c) * Math.pow(Math.abs(c), e) * r.ry;
      pos.push((r.cx ?? 0) + x, r.cy + y, r.z);
      uv.push((r.z - zMin) / L, th / (Math.PI * 2));
    }
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * cols + j, b = i * cols + ((j + 1) % cols), c = (i + 1) * cols + j, d = (i + 1) * cols + ((j + 1) % cols);
    if (opts.inside) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// half-thickness distribution of a NACA 4-digit section (t = 1), cosine spacing friendly
const naca = (s) => 5 * (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s * s * s - 0.1015 * s * s * s * s);

// Lofted lifting surface. sections: [{ le: [x,y,z], chord, t (abs max thickness) }], chord runs +z.
// span: 'x' (wings / stabilisers: thickness along y) or 'y' (fins: thickness along x). n: points per surface.
export function wing(sections, { span = 'x', n = 9, camber = 0.012, capRoot = false, capTip = true } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = i / n; pts.push((1 - Math.cos(a * Math.PI)) / 2); } // 0..1 cosine
  const loop = []; // upper LE->TE then lower TE->LE
  for (let i = 0; i <= n; i++) loop.push([pts[i], 1]);
  for (let i = n - 1; i >= 1; i--) loop.push([pts[i], -1]);
  const M = loop.length;
  const pos = [], uv = [], idx = [];
  for (const S of sections) {
    const [lx, ly, lz] = S.le;
    for (const [s, side] of loop) {
      const along = s * S.chord, off = side * naca(s) * S.t;
      if (span === 'x') pos.push(lx, ly + off + Math.sin(s * Math.PI) * camber * S.chord, lz + along);
      else pos.push(lx + off, ly, lz + along);
      uv.push(span === 'x' ? lx : ly, lz + along);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M;
    idx.push(a, b, c, b, d, c);
  }
  const capFan = (si, tip) => { // centroid fan
    const base = si * M; let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < M; j++) { cx += pos[(base + j) * 3]; cy += pos[(base + j) * 3 + 1]; cz += pos[(base + j) * 3 + 2]; }
    const ci = pos.length / 3; pos.push(cx / M, cy / M, cz / M); uv.push(0, 0);
    for (let j = 0; j < M; j++) { const a = base + j, b = base + (j + 1) % M; if (tip) idx.push(ci, a, b); else idx.push(ci, b, a); }
  };
  if (capTip) capFan(sections.length - 1, true);
  if (capRoot) capFan(0, false);
  const s0 = sections[0].le, s1 = sections[sections.length - 1].le;
  const dir = span === 'x' ? Math.sign(s1[0] - s0[0]) : Math.sign(s1[1] - s0[1]);
  // canonical winding is right for +x spans; flip for -x spans and for +y spans
  if (span === 'x' ? dir < 0 : dir > 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// mirror a geometry across x = 0 (fixes the winding)
export function mirrorX(g) {
  const m = g.clone();
  m.scale(-1, 1, 1);
  if (m.index) { const ix = m.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } }
  else { const p = m.attributes.position; for (let k = 0; k < p.count; k += 3) for (const a of Object.values(m.attributes)) { const s = a.itemSize; for (let c = 0; c < s; c++) { const t = a.array[(k + 1) * s + c]; a.array[(k + 1) * s + c] = a.array[(k + 2) * s + c]; a.array[(k + 2) * s + c] = t; } } }
  m.computeVertexNormals();
  return m;
}

// simple disc (in the xy plane, facing -z unless flipped)
export function disc(r, seg = 24, back = false) {
  const g = new THREE.CircleGeometry(r, seg);
  if (!back) g.rotateY(Math.PI);
  return g;
}

// tube between two points
export function strut(a, b, r, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, L, seg, 1, false);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}

// aircraft wheel: tire (torus-ish lathe) + hub, axle along x
export function wheelGeo(r = 0.55, w = 0.35) {
  const pts = [];
  const rr = r * 0.62;
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * Math.PI; pts.push(new THREE.Vector2(rr + (r - rr) * (0.55 + 0.45 * Math.cos(a)), (w / 2) * Math.sin(a))); }
  const tire = new THREE.LatheGeometry(pts, 18);
  tire.rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(rr * 0.98, rr * 0.98, w * 0.8, 14); hub.rotateZ(Math.PI / 2);
  return { tire, hub };
}
