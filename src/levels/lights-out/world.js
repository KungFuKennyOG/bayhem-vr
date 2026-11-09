import * as THREE from 'three';
import { BillboardBatch, CELL } from '../../particles.js';
import { CollisionWorld, NavGrid } from '../../collision.js';
import { buildSedan, buildSUV, MAT } from '../../vehicles.js';
import { POWER, powK, DIST } from './kit.js';
import { groundAt, walkable, structFloor } from './layout.js';
import { LightBaker, LM } from './lightmap.js';

// The art is built by separate modules; each falls back to nothing so the level always runs.
const NAMES = ['./city.js', './terrain.js', './west.js', './lantern.js', './bridge.js', './east.js', './tower.js', './slide.js', './river.js', '../downtown-haven/cars.js'];
const ASSETS = import.meta.glob(['./city.js', './terrain.js', './west.js', './lantern.js', './bridge.js', './east.js', './tower.js', './slide.js', './river.js', '../downtown-haven/cars.js']);
async function asset(name) { const l = ASSETS[name]; try { return l ? await l() : null; } catch (e) { console.warn('asset', name, e); return null; } }

// =====================================================================================
//  LIGHTS OUT world: assembles the city, the cliffs, the streets, Lantern Cliff, the bridges, the
//  east bank, Jinlong Tower and the river; owns the collision world, the nav grid and the glows
//  (lamp / lantern / LED halos, each with a power code so the blackout takes them too).
// =====================================================================================
export class LightsWorld {
  constructor(E) {
    this.E = E; this.scene = E.scene;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.col = new CollisionWorld({ cell: 8, minX: -240, minZ: -120, maxX: 400, maxZ: 200 });
    this.panes = []; this.glowList = []; this.updaters = []; this.named = {};
    this.time = 0; this.tris = {};
    this.baker = new LightBaker();
    this.fastGround = groundAt;
    this.walkable = walkable;
  }
  async build() {
    const E = this.E, ctx = { renderer: E.renderer, scene: E.scene, camera: E.camera, sun: E.sun, hemi: E.hemi, atlas: E.atlas, world: this };
    const mods = await Promise.all(NAMES.map(asset));
    const by = Object.fromEntries(NAMES.map((n, i) => [n, mods[i]]));
    this.mods = by; this.carMod = by['../downtown-haven/cars.js'];
    this.col.floorFn = groundAt;
    const take = async (fn, label) => {
      if (!fn) return null;
      let r = null;
      try { r = await fn(ctx); } catch (e) { console.warn('build ' + label, e); return null; }
      if (!r) return null;
      this.group.add(r.root);
      if (r.colliders) for (const c of r.colliders) c.box = this.col.add(c.min, c.max, { mat: 'concrete', ...(c.data || {}) });
      if (r.update) this.updaters.push(r.update);
      if (r.panes) this.panes.push(...r.panes);
      const A = r.anchors || {};
      for (const gl of A.glows || []) this.glowList.push(gl);
      for (const L of A.lights || []) if (L) this.baker.add(L);
      Object.assign(this.named, A.named || {});
      this.tris[label] = r.tris ?? r.root.userData.tris ?? 0;
      return r;
    };
    this.city = await take(by['./city.js']?.buildCity, 'city');
    this.terrain = await take(by['./terrain.js']?.buildTerrain, 'terrain');
    this.west = await take(by['./west.js']?.buildWest, 'west');
    this.lantern = await take(by['./lantern.js']?.buildLantern, 'lantern');
    this.bridge = await take(by['./bridge.js']?.buildBridges, 'bridge');
    this.east = await take(by['./east.js']?.buildEast, 'east');
    this.tower = await take(by['./tower.js']?.buildTower, 'tower');
    this.slide = await take(by['./slide.js']?.buildSlide, 'slide');
    this.river = await take(by['./river.js']?.buildRiver, 'river');
    this.props = await take(by['./props.js']?.buildProps, 'props');
    // the war in the city: smoke columns standing over fires across Longwu (game.js feeds them), a fire glow at each foot
    this.named.smokeColumns = [[210, 64, 780, 1.4], [-420, 52, 690, 1.1], [520, 96, -180, 1.3], [-360, 88, -220, 1.0], [900, 70, 640, 1.2]];
    for (const [x, y, z, k] of this.named.smokeColumns) this.glowList.push({ p: [x, y + 2, z], color: [2.4, 0.9, 0.25], size: 18 * k, flick: true, code: 16 + 15, far: true });
    // the batch is capped: the set pieces' halos (the landslide, Jinlong's crown) go first so they are never the ones dropped
    this.glowList.sort((a, b) => (b.prio | 0) - (a.prio | 0));
    this._bounds();
    try { this.baker.bake(); } catch (e) { console.warn('light bake', e); }
    this.glows = new BillboardBatch(Math.max(64, Math.min(1400, this.glowList.length + 32)), E.atlas, { boost: 1, renderOrder: 19, fog: this.scene.fog });
    this.scene.add(this.glows.mesh);
    return this;
  }
  // invisible limits the art doesn't already give (bullets pass; bodies don't)
  _bounds() { }

  buildNav() {
    // one grid over the whole route; colliders are tested against the LOCAL floor (y = 1e6 switches
    // NavGrid's fixed-height test off) and the body must fit on the walk mask
    const col = this.col;
    const deck = col.boxes.filter(b => b.enabled && b.data.layer === 'deck'); for (const b of deck) b.enabled = false;
    const free = (x, z) => {
      if (!walkable(x, z) || !walkable(x + 0.45, z) || !walkable(x - 0.45, z) || !walkable(x, z + 0.45) || !walkable(x, z - 0.45)) return false;
      const gy = groundAt(x, z), r = 0.42;
      let ok = true;
      col.query(x - r, z - r, x + r, z + r, (b) => {
        if (!ok || b.data.noBlock || b.max.y <= gy + 0.3 || b.min.y >= gy + 1.9) return;
        if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) ok = false;
      });
      return ok;
    };
    this.nav = new NavGrid(col, { x0: -176, z0: 30, x1: 362, z1: 162, y: 1e6, cell: 1, clearance: 0.42, walkable: free });
    for (const b of deck) b.enabled = true;
    const nav = this.nav, cen = nav.center.bind(nav);
    nav.center = (j, out) => { cen(j, out); out.y = groundAt(out.x, out.z); return out; };
    nav.y = 0;
  }

  update(dt, head) {
    this.time += dt;
    POWER.time.value = this.time;
    const t = this.time;
    for (const u of this.updaters) u(dt, t, head);
    // the light pools go out with their districts (groups: 0 the roof + steps, 1 Lantern Street + the cliff,
    // 2 the bridge + the east bank, 3 Jinlong on its generators)
    { const P = POWER.pow.value, n = POWER.night.value, k = Math.min(1, n / 0.12 + 0.15);
      LM.grp.value.set(P[DIST.WEST] * k, Math.max(P[DIST.LST], P[DIST.CLIFF_HI]) * k, Math.max(P[DIST.ARCH], P[DIST.EAST]) * k, P[DIST.TOWER] * k); }
    const G = this.glows;
    let gi = 0;
    for (const L of this.glowList) {
      if (gi >= G.max - 1) break;
      if (L.dead) continue;
      const p = L.p.isVector3 ? L.p : (L._p ||= new THREE.Vector3(...L.p));
      const k = powK(L.code ?? 16, p.y);
      if (k < 0.02) continue;
      if (L.blink && Math.sin(t * (L.rate || 3.2) + p.x * 0.7) < 0.2) continue;
      const d2 = p.distanceToSquared(head);
      if (L.far !== true && d2 > 220 * 220) continue;
      const c = L.color || [3, 1.6, 0.6], s = (L.size || 1) * (L.flick ? 0.85 + 0.15 * Math.sin(t * 23 + p.z) : 1);
      // far halos grow a little so they don't go sub-pixel in the fog (Chongqing's soft light blooms)
      const grow = L.far ? 1 + Math.min(0.9, Math.sqrt(d2) / 500) : 1;
      G.set(gi++, p.x, p.y, p.z, s * grow, s * grow, 0, CELL.GLOW, 0, c[0] * 0.72 * k, c[1] * 0.72 * k, c[2] * 0.72 * k, 0.85);
    }
    G.commit(gi);
  }

  fallbackCar(type, paint) {
    const m = type === 'suv' || type === 'van' ? buildSUV() : buildSedan(new THREE.MeshStandardMaterial({ color: paint ?? 0x777777, metalness: 0.5, roughness: 0.3 }));
    const h = m.half.clone().multiply(m.root.scale);
    return { root: m.root, half: [h.x, h.y, h.z], center: [0, h.y, 0], anchors: { lights: [] }, setBurnt() { m.mesh.material = m.mesh.material.map(() => MAT.charred); } };
  }
}
export { structFloor };
