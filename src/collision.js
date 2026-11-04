import * as THREE from 'three';

// =====================================================================================
//  Static collision world for on-foot levels: axis-aligned boxes in a uniform XZ grid,
//  plus walkable surfaces (flat boxes and ramps) for ground height.
//  - pushCircle: player / soldier body vs walls (XZ circle, vertical band)
//  - raycast:    bullets / line of sight (slab test, grid walk)
//  - groundAt:   standing height under a point (box tops + walk surfaces + base floor)
//  - collidePoint: ragdoll particles / debris (push out of boxes, report floor contacts)
// =====================================================================================
export class CollisionWorld {
  constructor({ cell = 8, minX = -200, minZ = -260, maxX = 200, maxZ = 120, floor = 0 } = {}) {
    this.cell = cell; this.minX = minX; this.minZ = minZ;
    this.nx = Math.ceil((maxX - minX) / cell); this.nz = Math.ceil((maxZ - minZ) / cell);
    this.grid = new Array(this.nx * this.nz);
    this.boxes = [];
    this.walk = []; // { type:'box', x0,z0,x1,z1,y } | { type:'ramp', x0,x1,y0,y1,z0,z1 } (ramp rises along x)
    this.floor = floor; // base ground height (yard); a function (x,z)=>y|null can override
    this.floorFn = null;
    this.stamp = 0;
  }
  _cells(x0, z0, x1, z1, fn) {
    const c = this.cell;
    const i0 = Math.max(0, Math.floor((x0 - this.minX) / c)), i1 = Math.min(this.nx - 1, Math.floor((x1 - this.minX) / c));
    const k0 = Math.max(0, Math.floor((z0 - this.minZ) / c)), k1 = Math.min(this.nz - 1, Math.floor((z1 - this.minZ) / c));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) fn(k * this.nx + i);
  }
  // add an AABB; data (optional) is any tag object: { kind, ref, material:'metal'|'concrete'|... }
  add(min, max, data = {}) {
    const b = { min: new THREE.Vector3(...min), max: new THREE.Vector3(...max), data, enabled: true, _s: 0 };
    this.boxes.push(b);
    this._cells(b.min.x, b.min.z, b.max.x, b.max.z, (i) => { (this.grid[i] ||= []).push(b); });
    return b;
  }
  remove(b) {
    b.enabled = false;
    this._cells(b.min.x, b.min.z, b.max.x, b.max.z, (i) => { const a = this.grid[i]; if (a) { const j = a.indexOf(b); if (j >= 0) a.splice(j, 1); } });
  }
  // move a box (e.g. a dropped container): remove + re-add keeping identity
  update(b, min, max) {
    this.remove(b); b.min.set(...min); b.max.set(...max); b.enabled = true;
    this._cells(b.min.x, b.min.z, b.max.x, b.max.z, (i) => { (this.grid[i] ||= []).push(b); });
  }
  addFromObject(colliders, matrix, data) {
    // colliders: [{min:[..],max:[..]}] in object space; matrix: object->world (rotation must be a multiple of 90° about y)
    const out = [], a = new THREE.Vector3(), bb = new THREE.Box3();
    for (const c of colliders) {
      bb.makeEmpty();
      for (let k = 0; k < 8; k++) { a.set(k & 1 ? c.max[0] : c.min[0], k & 2 ? c.max[1] : c.min[1], k & 4 ? c.max[2] : c.min[2]); if (matrix) a.applyMatrix4(matrix); bb.expandByPoint(a); }
      out.push(this.add(bb.min.toArray(), bb.max.toArray(), { ...(c.data || {}), ...data }));
    }
    return out;
  }
  query(x0, z0, x1, z1, fn) {
    const s = ++this.stamp;
    this._cells(x0, z0, x1, z1, (i) => {
      const a = this.grid[i]; if (!a) return;
      for (const b of a) { if (b._s === s || !b.enabled) continue; b._s = s; fn(b); }
    });
  }

  // ---------------- ground ----------------
  groundAt(x, z, yRef = 1e9, step = 0.6) {
    // highest walkable height at (x,z) not above yRef+step
    let g = this.floorFn ? this.floorFn(x, z) : this.floor;
    if (g === null || g === undefined) g = -1e9;
    const lim = yRef + step;
    for (const w of this.walk) {
      let y;
      if (w.type === 'box') { if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue; y = w.y; }
      else { if (x < w.x0 - 0.05 || x > w.x1 + 0.05 || z < w.z0 || z > w.z1) continue; const t = Math.min(1, Math.max(0, (x - w.x0) / (w.x1 - w.x0))); y = w.y0 + (w.y1 - w.y0) * t; }
      if (y <= lim && y > g) g = y;
    }
    this.query(x, z, x, z, (b) => { if (b.data.noStand) return; if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y <= lim && b.max.y > g) g = b.max.y; });
    return g;
  }

  // ---------------- body vs walls ----------------
  // resolve a vertical capsule (circle r in XZ, spanning y0..y1) out of boxes; mutates pos (Vector3); returns true if pushed
  pushCircle(pos, r, y0, y1, iters = 3) {
    let hit = false;
    for (let it = 0; it < iters; it++) {
      let any = false;
      this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (b) => {
        if (b.data.noBlock || b.max.y <= y0 || b.min.y >= y1) return;
        const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x)), cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return;
        if (d2 < 1e-10) { // centre inside the box: push out along the shallowest side
          const l = pos.x - b.min.x, rr = b.max.x - pos.x, n = pos.z - b.min.z, f = b.max.z - pos.z, m = Math.min(l, rr, n, f);
          if (m === l) pos.x = b.min.x - r; else if (m === rr) pos.x = b.max.x + r; else if (m === n) pos.z = b.min.z - r; else pos.z = b.max.z + r;
        } else { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
        any = true;
      });
      if (!any) break;
      hit = true;
    }
    return hit;
  }

  // ---------------- rays ----------------
  // returns { t, box, normal } or null; skip(b) can filter boxes
  raycast(o, d, maxT = 300, skip = null) {
    const c = this.cell;
    let best = maxT, bestB = null, axis = 0, sign = 1;
    const s = ++this.stamp;
    // 2D DDA over the grid
    let x = o.x, z = o.z;
    let i = Math.floor((x - this.minX) / c), k = Math.floor((z - this.minZ) / c);
    const stepI = d.x > 0 ? 1 : -1, stepK = d.z > 0 ? 1 : -1;
    const tdx = Math.abs(d.x) > 1e-9 ? c / Math.abs(d.x) : Infinity, tdz = Math.abs(d.z) > 1e-9 ? c / Math.abs(d.z) : Infinity;
    let tmx = Math.abs(d.x) > 1e-9 ? ((this.minX + (i + (d.x > 0 ? 1 : 0)) * c) - x) / d.x : Infinity;
    let tmz = Math.abs(d.z) > 1e-9 ? ((this.minZ + (k + (d.z > 0 ? 1 : 0)) * c) - z) / d.z : Infinity;
    let tCell = 0;
    for (let n = 0; n < 400; n++) {
      if (i >= 0 && i < this.nx && k >= 0 && k < this.nz) {
        const a = this.grid[k * this.nx + i];
        if (a) for (const b of a) {
          if (b._s === s || !b.enabled) continue; b._s = s;
          if (skip && skip(b)) continue;
          const r = slab(o, d, b.min, b.max, best);
          if (r) { best = r.t; bestB = b; axis = r.axis; sign = r.sign; }
        }
      }
      const tNext = Math.min(tmx, tmz);
      if (tNext > best || tNext > maxT) break;
      if (tmx < tmz) { tmx += tdx; i += stepI; } else { tmz += tdz; k += stepK; }
      tCell = tNext;
      if ((i < -1 || i > this.nx || k < -1 || k > this.nz)) break;
    }
    if (!bestB) return null;
    const normal = new THREE.Vector3(); normal.setComponent(axis, sign);
    return { t: best, box: bestB, normal };
  }
  visible(a, b, skip) {
    _d.subVectors(b, a); const L = _d.length(); if (L < 1e-4) return true; _d.divideScalar(L);
    return !this.raycast(a, _d, L - 0.05, skip);
  }

  // ---------------- particles ----------------
  // push a sphere (x,y,z,r) out of boxes; returns contact info in out {nx,ny,nz,hit}
  collidePoint(p, r, out) {
    out.hit = false;
    this.query(p.x - r, p.z - r, p.x + r, p.z + r, (b) => {
      if (b.data.noBlock && !b.data.solid) return;
      if (p.x < b.min.x - r || p.x > b.max.x + r || p.y < b.min.y - r || p.y > b.max.y + r || p.z < b.min.z - r || p.z > b.max.z + r) return;
      // penetration along each axis
      const px0 = p.x - (b.min.x - r), px1 = (b.max.x + r) - p.x, py0 = p.y - (b.min.y - r), py1 = (b.max.y + r) - p.y, pz0 = p.z - (b.min.z - r), pz1 = (b.max.z + r) - p.z;
      const m = Math.min(px0, px1, py0, py1, pz0, pz1);
      out.hit = true;
      if (m === py1) { p.y = b.max.y + r; out.nx = 0; out.ny = 1; out.nz = 0; }
      else if (m === px0) { p.x = b.min.x - r; out.nx = -1; out.ny = 0; out.nz = 0; }
      else if (m === px1) { p.x = b.max.x + r; out.nx = 1; out.ny = 0; out.nz = 0; }
      else if (m === pz0) { p.z = b.min.z - r; out.nx = 0; out.ny = 0; out.nz = -1; }
      else if (m === pz1) { p.z = b.max.z + r; out.nx = 0; out.ny = 0; out.nz = 1; }
      else { p.y = b.min.y - r; out.nx = 0; out.ny = -1; out.nz = 0; }
    });
    return out;
  }
}
const _d = new THREE.Vector3();

function slab(o, d, mn, mx, tMax) {
  let t0 = 0, t1 = tMax, axis = -1, sign = 1;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    const lo = a === 0 ? mn.x : a === 1 ? mn.y : mn.z, hi = a === 0 ? mx.x : a === 1 ? mx.y : mx.z;
    if (Math.abs(da) < 1e-12) { if (oa < lo || oa > hi) return null; continue; }
    let ta = (lo - oa) / da, tb = (hi - oa) / da, s = -1;
    if (ta > tb) { const tt = ta; ta = tb; tb = tt; s = 1; }
    if (ta > t0) { t0 = ta; axis = a; sign = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  if (axis < 0) return null; // origin inside the box: ignore (shooting out of cover)
  return { t: t0, axis, sign };
}

// =====================================================================================
//  Navigation grid (one walkable floor at a given height) with A* + string pulling
// =====================================================================================
export class NavGrid {
  constructor(world, { x0, z0, x1, z1, y = 0, cell = 1, clearance = 0.45, height = 1.7, walkable = null }) {
    this.w = world; this.x0 = x0; this.z0 = z0; this.cell = cell; this.y = y;
    this.nx = Math.ceil((x1 - x0) / cell); this.nz = Math.ceil((z1 - z0) / cell);
    this.block = new Uint8Array(this.nx * this.nz);
    const r = clearance;
    for (let k = 0; k < this.nz; k++) for (let i = 0; i < this.nx; i++) {
      const cx = x0 + (i + 0.5) * cell, cz = z0 + (k + 0.5) * cell;
      let b = walkable && !walkable(cx, cz) ? 1 : 0;
      if (!b) world.query(cx - r, cz - r, cx + r, cz + r, (bx) => {
        if (bx.data.noBlock || bx.max.y <= y + 0.25 || bx.min.y >= y + height) return;
        if (cx + r > bx.min.x && cx - r < bx.max.x && cz + r > bx.min.z && cz - r < bx.max.z) b = 1;
      });
      this.block[k * this.nx + i] = b;
    }
    this.g = new Float32Array(this.nx * this.nz); this.from = new Int32Array(this.nx * this.nz); this.seen = new Uint32Array(this.nx * this.nz); this.closed = new Uint32Array(this.nx * this.nz); this.gen = 0;
    this.heap = new Int32Array(this.nx * this.nz * 2); this.f = new Float32Array(this.nx * this.nz);
    this.dyn = new Uint8Array(this.nx * this.nz); // dynamic blockers (dropped containers)
  }
  idx(x, z) { const i = Math.floor((x - this.x0) / this.cell), k = Math.floor((z - this.z0) / this.cell); if (i < 0 || k < 0 || i >= this.nx || k >= this.nz) return -1; return k * this.nx + i; }
  free(x, z) { const j = this.idx(x, z); return j >= 0 && !this.block[j] && !this.dyn[j]; }
  center(j, out) { return out.set(this.x0 + ((j % this.nx) + 0.5) * this.cell, this.y, this.z0 + (Math.floor(j / this.nx) + 0.5) * this.cell); }
  blockBox(min, max, v = 1) { // mark a dynamic obstacle
    for (let z = min.z - 0.4; z <= max.z + 0.4; z += this.cell * 0.5) for (let x = min.x - 0.4; x <= max.x + 0.4; x += this.cell * 0.5) { const j = this.idx(x, z); if (j >= 0) this.dyn[j] = v; }
  }
  nearestFree(x, z, maxR = 6) {
    const j = this.idx(x, z); if (j >= 0 && !this.block[j] && !this.dyn[j]) return j;
    for (let r = 1; r <= maxR; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
      const jj = this.idx(x + dx * this.cell, z + dz * this.cell); if (jj >= 0 && !this.block[jj] && !this.dyn[jj]) return jj;
    }
    return -1;
  }
  lineFree(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / (this.cell * 0.4));
    for (let s = 1; s < n; s++) { const t = s / n; if (!this.free(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  // A*; returns array of Vector3 waypoints (string-pulled) or null
  path(from, to, maxNodes = 20000) {
    const s = this.nearestFree(from.x, from.z), e = this.nearestFree(to.x, to.z);
    if (s < 0 || e < 0) return null;
    const nx = this.nx, gen = ++this.gen, G = this.g, F = this.f, H = this.heap, from_ = this.from, seen = this.seen, closed = this.closed;
    const ex = e % nx, ez = (e / nx) | 0;
    const h = (j) => { const dx = Math.abs((j % nx) - ex), dz = Math.abs(((j / nx) | 0) - ez); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    let n = 0;
    const push = (j) => { let c = n++; H[c] = j; while (c > 0) { const p = (c - 1) >> 1; if (F[H[p]] <= F[H[c]]) break; const t = H[p]; H[p] = H[c]; H[c] = t; c = p; } };
    const pop = () => { const top = H[0]; H[0] = H[--n]; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < n && F[H[l]] < F[H[m]]) m = l; if (r < n && F[H[r]] < F[H[m]]) m = r; if (m === c) break; const t = H[m]; H[m] = H[c]; H[c] = t; c = m; } return top; };
    G[s] = 0; F[s] = h(s); seen[s] = gen; from_[s] = -1; push(s);
    let found = false, it = 0;
    const blk = this.block, dyn = this.dyn, nz = this.nz;
    while (n > 0 && it++ < maxNodes) {
      const j = pop();
      if (closed[j] === gen) continue;
      closed[j] = gen;
      if (j === e) { found = true; break; }
      const ji = j % nx, jk = (j / nx) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const ii = ji + dx, kk = jk + dz;
        if (ii < 0 || kk < 0 || ii >= nx || kk >= nz) continue;
        const q = kk * nx + ii;
        if (blk[q] || dyn[q] || closed[q] === gen) continue;
        if (dx && dz && (blk[jk * nx + ii] || blk[kk * nx + ji])) continue; // no corner cutting
        const ng = G[j] + (dx && dz ? Math.SQRT2 : 1);
        if (seen[q] !== gen || ng < G[q]) { seen[q] = gen; G[q] = ng; F[q] = ng + h(q); from_[q] = j; push(q); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let j = e; j >= 0; j = from_[j]) cells.push(j);
    cells.reverse();
    // string pulling
    const pts = cells.map(j => this.center(j, new THREE.Vector3()));
    pts[pts.length - 1].set(to.x, this.y, to.z);
    const out = [new THREE.Vector3(from.x, this.y, from.z)];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.lineFree(out[out.length - 1].x, out[out.length - 1].z, pts[b].x, pts[b].z)) b--;
      out.push(pts[b]); a = b;
    }
    return out;
  }
}
