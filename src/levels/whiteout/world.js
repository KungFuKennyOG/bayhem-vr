import * as THREE from 'three';
import { BillboardBatch, CELL } from '../../particles.js';
import { CollisionWorld, NavGrid } from '../../collision.js';
import { buildSedan, buildSUV, MAT } from '../../vehicles.js';
import { buildTerrain, alpenU } from './terrain.js';
import { buildCloudSea } from './sky.js';
import { TERR, groundAt, terrainAt, walkable, structFloor, bakeTerrain } from './layout.js';

// The art is built by separate modules; each falls back to nothing so the level always runs.
const ASSETS = import.meta.glob(['./road.js', './props.js', './flora.js', './station.js', './fortress.js', './cliffs.js', '../downtown-haven/cars.js']);
async function asset(name) { const l = ASSETS[name]; try { return l ? await l() : null; } catch (e) { console.warn('asset', name, e); return null; } }

const _v = new THREE.Vector3(), _d = new THREE.Vector3();

// =====================================================================================
//  WHITEOUT world: assembles the mountain (terrain + far peaks + cloud sea), the road, the
//  pines / rocks / fences, the Mittelstation + cable line, Grauhorn station; owns the collision
//  world (boxes + the terrain heightfield for rays), the nav grid, the glows and the warm pools.
// =====================================================================================
export class WhiteWorld {
  constructor(E) {
    this.E = E; this.scene = E.scene;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.col = new CollisionWorld({ cell: 8, minX: TERR.x0 - 20, minZ: TERR.z0 - 20, maxX: TERR.x1 + 20, maxZ: TERR.z1 + 20 });
    this.panes = []; this.duskMats = []; this.glowList = []; this.updaters = []; this.lamps = []; this.pools = []; this.plumes = []; this.roofs = [];
    this.time = 0;
    this.fastGround = groundAt;
    this.terrainAt = terrainAt;
    this.walkable = walkable;
    this.anchors = {};
  }

  async build() {
    bakeTerrain();
    const E = this.E, ctx = { renderer: E.renderer, scene: E.scene, camera: E.camera, sun: E.sun, hemi: E.hemi, atlas: E.atlas, world: this };
    const names = ['./road.js', './props.js', './flora.js', './station.js', './fortress.js', './cliffs.js', '../downtown-haven/cars.js'];
    const [roadM, propsM, floraM, stationM, fortM, cliffM, carMod] = await Promise.all(names.map(asset));
    this.mods = { roadM, propsM, floraM, stationM, fortM, cliffM, carMod };
    this.col.floorFn = groundAt;
    this._patchRays();
    const take = async (fn, label) => {
      if (!fn) return null;
      let r = null;
      try { r = await fn(ctx); } catch (e) { console.warn('build ' + label, e); }
      if (!r) return null;
      this.group.add(r.root);
      if (r.colliders) for (const c of r.colliders) this.col.add(c.min, c.max, { mat: 'concrete', ...(c.data || {}) });
      if (r.update) this.updaters.push(r.update);
      if (r.panes) this.panes.push(...r.panes);
      const A = r.anchors || {};
      for (const gl of A.glows || []) this.glowList.push(gl);
      for (const p of A.pools || []) this.pools.push(p);
      for (const p of A.plumes || []) this.plumes.push(p);
      for (const rf of r.roofs || []) this.roofs.push(rf);
      for (const l of A.lamps || []) this.lamps.push(l.isVector3 ? l : new THREE.Vector3(...l));
      Object.assign(this.anchors, A.named || {});
      return r;
    };
    this.road = await take(roadM?.buildRoad, 'road');
    this.props = await take(propsM?.buildProps, 'props');
    this.station = await take(stationM?.buildStation, 'station');
    this.fort = await take(fortM?.buildFortress, 'fortress');
    this.flora = await take(floraM?.buildFlora, 'flora');
    this.cliffs = await take(cliffM?.buildCliffs, 'cliffs');
    for (const r of [this.road, this.station, this.fort, this.flora]) if (r?.finalize) { try { r.finalize(this.pools); } catch (e) { console.warn('finalize', e); } }
    // the terrain last: it bakes the warm pools of everything above into its vertices
    this.terrain = buildTerrain(ctx, { pools: this.pools });
    this.group.add(this.terrain.root);
    this.sea = buildCloudSea(this.scene.fog);
    this.scene.add(this.sea.mesh);
    this._collectDusk(this.group);
    this.glows = new BillboardBatch(Math.max(64, this.glowList.length + 16), E.atlas, { boost: 1, renderOrder: 19, fog: this.scene.fog });
    this.scene.add(this.glows.mesh);
    return this;
  }

  // bullets and eyes stop at the mountain too: the AABB grid knows nothing about the heightfield,
  // so raycast / visible also march the terrain (coarse 1.5 m steps, refined by bisection)
  _patchRays() {
    const col = this.col, rc = col.raycast.bind(col);
    const terr = { data: { kind: 'terrain', mat: 'snow' }, enabled: true, min: new THREE.Vector3(), max: new THREE.Vector3() };
    this.terrainBox = terr;
    // moving things the AABB grid can't hold (the cable car's shell while it rides): fn(o, d, maxT, skip) -> hit | null
    this.dynRays = [];
    col.raycast = (o, d, maxT = 300, skip = null) => {
      let hit = rc(o, d, maxT, skip);
      let lim = hit ? hit.t : maxT;
      for (const fn of this.dynRays) { const h = fn(o, d, lim, skip); if (h) { hit = h; lim = h.t; } }
      if (skip && skip(terr)) return hit;
      const t = terrainRay(o, d, lim);
      if (t < 0) return hit;
      const P = _v.copy(o).addScaledVector(d, t), e = 0.8;
      const n = new THREE.Vector3(terrainAt(P.x - e, P.z) - terrainAt(P.x + e, P.z), 2 * e, terrainAt(P.x, P.z - e) - terrainAt(P.x, P.z + e)).normalize();
      return { t, box: terr, normal: n };
    };
    col.visible = (a, b, skip) => { _d.subVectors(b, a); const L = _d.length(); if (L < 1e-4) return true; _d.divideScalar(L); return !col.raycast(a, _d, L - 0.05, skip); };
  }

  buildNav() {
    // one grid over both play areas (they never overlap in xz); colliders are tested against the LOCAL
    // floor (NavGrid's fixed-y test is switched off with y = 1e6)
    const col = this.col;
    const free = (x, z) => {
      // the whole body must fit on the walk mask (the locomotion stops at its edge like a ledge)
      if (!walkable(x, z) || !walkable(x + 0.45, z) || !walkable(x - 0.45, z) || !walkable(x, z + 0.45) || !walkable(x, z - 0.45)) return false;
      const gy = groundAt(x, z), r = 0.42;
      let ok = true;
      col.query(x - r, z - r, x + r, z + r, (b) => {
        if (!ok || b.data.noBlock || b.max.y <= gy + 0.3 || b.min.y >= gy + 1.9) return;
        if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) ok = false;
      });
      return ok;
    };
    this.nav = new NavGrid(col, { x0: -110, z0: -404, x1: 240, z1: 124, y: 1e6, cell: 1, clearance: 0.42, walkable: free });
    const nav = this.nav, cen = nav.center.bind(nav);
    nav.center = (j, out) => { cen(j, out); out.y = groundAt(out.x, out.z); return out; };
    nav.y = 0;
  }

  _collectDusk(root) {
    root.traverse(o => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) if (m.userData && m.userData.duskEmissive !== undefined && !this.duskMats.includes(m)) this.duskMats.push(m);
    });
  }

  update(dt, head, storm) {
    this.time += dt;
    const t = this.time;
    for (const m of this.duskMats) if (!m.userData.held) m.emissiveIntensity = m.userData.duskEmissive * (0.75 + 0.25 * storm);
    for (const u of this.updaters) u(dt, t, storm, head);
    if (this.sea) this.sea.u.time.value = t;
    if (this.terrain) this.terrain.far.visible = storm < 0.75;
    alpenU.value = Math.min(1, Math.max(0, 1 - storm * 1.6));
    const G = this.glows;
    let gi = 0;
    for (const L of this.glowList) {
      if (gi >= G.max - 1) break;
      if (L.dead) continue;
      const p = L.p.isVector3 ? L.p : (L._p ||= new THREE.Vector3(...L.p));
      if (L.blink && Math.sin(t * (L.rate || 3.2) + p.x * 0.7) < 0.15) continue;
      const d2 = p.distanceToSquared(head);
      if ((L.near && d2 > 70 * 70) || (L.far !== true && d2 > 260 * 260)) continue;
      const c = L.color || [3, 1.6, 0.6], s = (L.size || 1) * (L.flick ? 0.85 + 0.15 * Math.sin(t * 23 + p.z) : 1);
      G.set(gi++, p.x, p.y, p.z, s, s, 0, CELL.GLOW, 0, c[0] * 0.72, c[1] * 0.72, c[2] * 0.72, 0.85);
    }
    G.commit(gi);
  }

  fallbackCar(type, paint) {
    const m = type === 'suv' || type === 'van' ? buildSUV() : buildSedan(new THREE.MeshStandardMaterial({ color: paint ?? 0x777777, metalness: 0.5, roughness: 0.3 }));
    const h = m.half.clone().multiply(m.root.scale);
    return { root: m.root, half: [h.x, h.y, h.z], center: [0, h.y, 0], anchors: { lights: [] }, setBurnt() { m.mesh.material = m.mesh.material.map(() => MAT.charred); } };
  }
}

// ray vs the heightfield: march, then bisect. Returns t or -1.
export function terrainRay(o, d, maxT) {
  let t = 0, prev = o.y - terrainAt(o.x, o.z);
  if (prev < -0.05) return -1;   // starting under the snow (shouldn't happen): ignore
  const step = 1.5;
  while (t < maxT) {
    const tn = Math.min(maxT, t + step);
    const x = o.x + d.x * tn, y = o.y + d.y * tn, z = o.z + d.z * tn;
    const h = y - terrainAt(x, z);
    if (h < 0) {
      let a = t, b = tn;
      for (let i = 0; i < 6; i++) { const m = (a + b) * 0.5; const hm = o.y + d.y * m - terrainAt(o.x + d.x * m, o.z + d.z * m); if (hm < 0) b = m; else a = m; }
      return a;
    }
    // far above the ground and climbing: skip ahead
    t = tn + (h > 12 ? Math.min(h / 3.5, 24) : 0);
    prev = h;
  }
  return -1;
}
