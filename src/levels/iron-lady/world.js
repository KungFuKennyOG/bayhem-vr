import * as THREE from 'three';
import { BillboardBatch, CELL } from '../../particles.js';
import { CollisionWorld, NavGrid } from '../../collision.js';
import { buildSedan, buildSUV, MAT } from '../../vehicles.js';
import { concreteTexture } from '../../textures.js';
import { buildTower } from './tower.js';
import {
  WATER_Y, LOW_Y, RIVER, LOWQ, RAMP_N, RAMP_S, QUAY_N, QUAY_S, BRIDGE, PARK, TOWER, PONTOON, groundAt,
} from './layout.js';

// The art is built by separate modules; each falls back to a stand-in so the level always runs.
const ASSETS = import.meta.glob(['./paris.js', './quays.js', './river.js', './boats.js', './reflections.js', '../downtown-haven/cars.js']);
async function asset(name) { const l = ASSETS[name]; try { return l ? await l() : null; } catch (e) { console.warn('asset', name, e); return null; } }

// =====================================================================================
//  THE IRON LADY world: assembles Paris, the quays + bridge + park, the Seine, the moored
//  barges and the tower; owns the collision world + nav grid, the night ramp, the world-space
//  glows and the wet-street / river light reflections.
// =====================================================================================
export class IronWorld {
  constructor(E) {
    this.E = E; this.scene = E.scene;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.col = new CollisionWorld({ cell: 8, minX: -280, minZ: -280, maxX: 400, maxZ: 160 });
    this.panes = []; this.duskMats = []; this.glowList = []; this.updaters = []; this.lamps = [];
    this.time = 0;
  }

  async build() {
    const E = this.E, ctx = { renderer: E.renderer, scene: E.scene, camera: E.camera, sun: E.sun, hemi: E.hemi, atlas: E.atlas };
    const [parisM, quaysM, riverM, boatsM, reflM, carMod] = await Promise.all(['./paris.js', './quays.js', './river.js', './boats.js', './reflections.js', '../downtown-haven/cars.js'].map(asset));
    this.mods = { parisM, quaysM, riverM, boatsM, reflM, carMod };
    this.col.floorFn = groundAt;
    this.fastGround = groundAt;
    this.reflectList = [];
    const take = async (fn, fallback, label) => {
      let r = null;
      if (fn) { try { r = await fn(ctx); } catch (e) { console.warn('build ' + label, e); } }
      if (!r && fallback) r = fallback();
      if (!r) return null;
      this.group.add(r.root);
      if (r.colliders) for (const c of r.colliders) this.col.add(c.min, c.max, { mat: 'concrete', ...(c.data || {}) });
      if (r.update) this.updaters.push(r.update);
      if (r.panes) this.panes.push(...r.panes);
      for (const gl of r.anchors?.glows || []) this.glowList.push(gl);
      for (const rf of r.anchors?.reflect || []) this.reflectList.push(rf);
      for (const l of r.anchors?.lamps || []) this.lamps.push(l.isVector3 ? l : new THREE.Vector3(...l));
      return r;
    };
    this.paris = await take(parisM?.buildParis, () => this._standInParis(), 'paris');
    this.quays = await take(quaysM?.buildQuays, () => this._standInQuays(), 'quays');
    this.river = await take(riverM?.buildRiver, () => this._standInRiver(), 'river');
    // the tower: colliders tracked separately (they leave when it falls)
    const T = this.tower = await buildTower(ctx);
    this.group.add(T.root); this.scene.add(T.extra);
    T.boxes = T.colliders.map(c => this.col.add(c.min, c.max, { ...(c.data || {}) }));
    this.updaters.push(T.update);
    // moored barges along the north lower quay (scenery + cover along the water edge)
    this.barges = [];
    if (boatsM?.buildBoat) {
      for (const [x, z, seed] of [[48, 36.6, 3], [262, 36.4, 7], [-120, 36.5, 11], [-170, -36.5, 13], [300, -36.5, 17]]) { // the quay-fight stretch (x 70..200) stays open to the river
        try {
          const b = boatsM.buildBoat('peniche', { seed });
          b.root.position.set(x, WATER_Y, z);
          b.root.rotation.y = z > 0 ? Math.PI / 2 : -Math.PI / 2; // bow -x, port side to the quay
          b.root.updateMatrixWorld(true);
          this.group.add(b.root);
          for (const c of b.colliders || []) this.col.addFromObject([c], b.root.matrixWorld, { mat: 'metal', kind: 'barge', ...(c.data || {}) });
          for (const gl of b.anchors?.glows || []) { const p = new THREE.Vector3(...(gl.p.isVector3 ? gl.p.toArray() : gl.p)).applyMatrix4(b.root.matrixWorld); this.glowList.push({ ...gl, p }); }
          if (b.update) this.updaters.push(b.update);
          this.barges.push(b);
        } catch (e) { console.warn('barge', e); }
      }
    }
    // wet-street / river reflections of every lamp (+ the tower, re-sampled during the collapse)
    if (reflM?.Reflections) {
      try {
        this.refl = new reflM.Reflections(this.scene, { max: 420 });
        for (const r of this.reflectList) { try { this.refl.add(r); } catch (e) { /* bad anchor */ } }
        this.towerRefl = T.anchors.reflect.map(r => {
          const p = r.rest.clone().add(T.root.position);
          return { r, h: this.refl.add({ p: p.toArray(), color: r.color, len: r.len * 2.4, width: r.width, ground: WATER_Y, water: true }) };
        });
      } catch (e) { console.warn('reflections', e); this.refl = null; }
    }
    this._bounds();
    this._collectDusk(this.group);
    this.glows = new BillboardBatch(Math.max(64, this.glowList.length + 16), E.atlas, { boost: 1, renderOrder: 19, fog: this.scene.fog });
    this.scene.add(this.glows.mesh);
    return this;
  }

  buildNav() {
    const inside = (x, z) => {
      const az = Math.abs(z), ax = Math.abs(x);
      if (ax < BRIDGE.rail && az < QUAY_N.face) return true;                                  // bridge + bridge head
      if (az > LOWQ.edge && az < LOWQ.wall) return x > LOWQ.x0 + 0.5 && x < LOWQ.x1;            // lower quays (+ ramps)
      if (z > PONTOON.z0 && z < PONTOON.z1) return x > PONTOON.x0 && x < PONTOON.x1;
      if (az >= LOWQ.wall && az < QUAY_N.face) return x > -110 && x < LOWQ.x1;                // upper quays (parapet colliders block the rest)
      if (z < PARK.z1 && z > PARK.z0) return ax < PARK.half;                                  // the park
      return false;
    };
    this.nav = new NavGrid(this.col, { x0: -112, z0: -252, x1: 342, z1: 79, y: LOW_Y, height: 7.3, cell: 1, clearance: 0.42, walkable: inside });
  }

  _bounds() {
    const b = (min, max, extra = {}) => this.col.add(min, max, { kind: 'bound', noBullet: true, ...extra });
    // quay edges (don't walk into the Seine) — the escape pontoon is the only gap on the south quay
    b([LOWQ.x0, WATER_Y - 1, LOWQ.edge - 0.35], [LOWQ.x1 + 40, LOW_Y + 1.2, LOWQ.edge]);
    b([LOWQ.x0, WATER_Y - 1, -LOWQ.edge], [PONTOON.x0, LOW_Y + 1.2, -LOWQ.edge + 0.35]);
    b([PONTOON.x1, WATER_Y - 1, -LOWQ.edge], [LOWQ.x1 + 40, LOW_Y + 1.2, -LOWQ.edge + 0.35]);
    // the pontoon's own edges: its two ends and its river side (the quay side, z0, stays open: that
    // wall used to sit across the entrance, so you could never step onto it to board the speedboat)
    b([PONTOON.x0 - 0.3, WATER_Y - 1, PONTOON.z0], [PONTOON.x0, LOW_Y + 1.2, PONTOON.z1 + 0.3]);
    b([PONTOON.x1, WATER_Y - 1, PONTOON.z0], [PONTOON.x1 + 0.3, LOW_Y + 1.2, PONTOON.z1 + 0.3]);
    b([PONTOON.x0, WATER_Y - 1, PONTOON.z1], [PONTOON.x1, LOW_Y + 1.2, PONTOON.z1 + 0.3]);
    // far ends of the walkable strips
    b([LOWQ.x1, WATER_Y, -80], [LOWQ.x1 + 2, 8, 80]);
    b([-112, 0, 52], [-110, 8, 80]); b([-112, 0, -80], [-110, 8, -52]);
    b([-BRIDGE.half, 0, QUAY_N.face], [BRIDGE.half, 8, QUAY_N.face + 2]);    // police barricade up the avenue
    b([-PARK.half - 2, 0, PARK.z0 - 2], [PARK.half + 2, 8, PARK.z0]);
    b([-PARK.half - 2, 0, PARK.z0], [-PARK.half, 8, PARK.z1]); b([PARK.half, 0, PARK.z0], [PARK.half + 2, 8, QUAY_S.face]);
    // the lower quay is closed by the bridge abutment
    b([LOWQ.x0 - 2, WATER_Y, -LOWQ.wall], [LOWQ.x0, 4, -LOWQ.edge]); b([LOWQ.x0 - 2, WATER_Y, LOWQ.edge], [LOWQ.x0, 4, LOWQ.wall]);
    // retaining walls (lower quay <-> street), with the ramp openings; and the ramps' river-side walls
    const wall = (x0, x1, z0, z1, y0, y1) => this.col.add([x0, y0, z0], [x1, y1, z1], { kind: 'wall', mat: 'concrete' });
    // north: wall face at z 52 except where the ramp meets the street (x < RAMP_N.xHigh the ramp is at street level)
    wall(LOWQ.x0, RAMP_N.xHigh - 6, LOWQ.wall, LOWQ.wall + 0.6, LOW_Y, 0); wall(RAMP_N.xHigh + 1, LOWQ.x1 + 40, LOWQ.wall, LOWQ.wall + 0.6, LOW_Y, 0);
    wall(RAMP_N.xHigh - 6, RAMP_N.xLow, RAMP_N.z0 - 0.45, RAMP_N.z0, LOW_Y, 1.0);
    wall(LOWQ.x0, RAMP_S.xHigh - 6, -LOWQ.wall - 0.6, -LOWQ.wall, LOW_Y, 0); wall(RAMP_S.xHigh + 1, LOWQ.x1 + 40, -LOWQ.wall - 0.6, -LOWQ.wall, LOW_Y, 0);
    wall(RAMP_S.xHigh - 6, RAMP_S.xLow, RAMP_S.z1, RAMP_S.z1 + 0.45, LOW_Y, 1.0);
    // parapet along the upper quays (except where the ramps arrive and over the bridge head)
    const par = (x0, x1, z0, z1) => this.col.add([x0, 0, z0], [x1, 1.0, z1], { kind: 'parapet', mat: 'concrete' });
    if (!this.quays || this.quays.standIn) {
      par(BRIDGE.half, RAMP_N.xHigh - 6, QUAY_N.parapet[0], QUAY_N.parapet[1]); par(RAMP_N.xHigh + 2, LOWQ.x1, QUAY_N.parapet[0], QUAY_N.parapet[1]);
      par(-110, -BRIDGE.half, QUAY_N.parapet[0], QUAY_N.parapet[1]);
      par(BRIDGE.half, RAMP_S.xHigh - 6, QUAY_S.parapet[0], QUAY_S.parapet[1]); par(RAMP_S.xHigh + 2, LOWQ.x1, QUAY_S.parapet[0], QUAY_S.parapet[1]);
      par(-110, -BRIDGE.half, QUAY_S.parapet[0], QUAY_S.parapet[1]);
      for (const s of [-1, 1]) this.col.add([s > 0 ? BRIDGE.rail : -BRIDGE.half, 0, -BRIDGE.z1], [s > 0 ? BRIDGE.half : -BRIDGE.rail, 1.05, BRIDGE.z1], { kind: 'parapet', mat: 'concrete' });
    }
  }
  _collectDusk(root) {
    root.traverse(o => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) if (m.userData && m.userData.duskEmissive !== undefined && !this.duskMats.includes(m)) this.duskMats.push(m);
    });
  }

  update(dt, head, night) {
    this.time += dt;
    const t = this.time;
    const em = 0.8 + 0.2 * night;
    for (const m of this.duskMats) if (!m.userData.held) m.emissiveIntensity = m.userData.duskEmissive * em;
    for (const u of this.updaters) u(dt, t, 0.85 + night * 0.15, head);
    const G = this.glows;
    let gi = 0;
    for (const L of this.glowList) {
      if (gi >= G.max - 1) break;
      const p = L.p.isVector3 ? L.p : (L._p ||= new THREE.Vector3(...L.p));
      if (L.blink && Math.sin(t * (L.rate || 3.2) + p.x * 0.7) < 0.15) continue;
      if (L.dead) continue;
      const c = L.color || [3, 1.6, 0.6], s = L.size || 1;
      if (L.far !== true && p.distanceToSquared(head) > 320 * 320) continue;
      G.set(gi++, p.x, p.y, p.z, s, s, 0, CELL.GLOW, 0, c[0] * 0.72, c[1] * 0.72, c[2] * 0.72, 0.85);
    }
    G.commit(gi);
    // the tower's reflection follows the tower (and goes out with its lights)
    if (this.refl) {
      const T = this.tower, L = T.state.light;
      for (const { r, h } of this.towerRefl) {
        const p = T.rig.deform(r.rest, _v).add(T.root.position);
        const k = L * (p.y > -2 ? 1 : 0);
        this.refl.set(h, { p: p.toArray(), intensity: k });
      }
      this.refl.update(dt, head);
    }
  }

  // ---------------------------------------------------------------- stand-ins (until/unless the art modules exist)
  fallbackCar(type, paint) {
    const m = type === 'suv' || type === 'van' || type === 'police' ? buildSUV() : buildSedan(new THREE.MeshStandardMaterial({ color: paint ?? 0x777777, metalness: 0.5, roughness: 0.3 }));
    if (type === 'wreck') m.mesh.material = m.mesh.material.map(() => MAT.charred);
    const h = m.half.clone().multiply(m.root.scale);
    return { root: m.root, half: [h.x, h.y, h.z], center: [0, h.y, 0], anchors: { lights: [] }, setBurnt() { m.mesh.material = m.mesh.material.map(() => MAT.charred); } };
  }
  _standInParis() {
    const root = new THREE.Group(), colliders = [];
    const tex = concreteTexture(7, [0.72, 0.68, 0.6], 256); tex.repeat.set(6, 3);
    const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xd8cbb4, roughness: 0.85, emissive: 0x302010, emissiveIntensity: 0.3 });
    const add = (x0, x1, z0, z1, h) => { const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat); g.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); root.add(g); colliders.push({ min: [x0, 0, z0], max: [x1, h, z1] }); };
    for (let x = -500; x < 500; x += 40) if (Math.abs(x + 20) > 34) add(x, x + 38, QUAY_N.face, QUAY_N.face + 26, 24);
    for (let x = -500; x < 500; x += 40) if (Math.abs(x + 20) > PARK.half + 20) add(x, x + 38, QUAY_S.face - 26, QUAY_S.face, 24);
    return { root, colliders };
  }
  _standInQuays() {
    const root = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x6d675e, roughness: 0.4 });
    const add = (x0, y0, z0, x1, y1, z1, m = stone) => { const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.receiveShadow = true; root.add(g); };
    for (const s of [-1, 1]) {
      add(-700, WATER_Y - 2, s > 0 ? LOWQ.edge : -LOWQ.wall, 900, LOW_Y, s > 0 ? LOWQ.wall : -LOWQ.edge);
      add(-700, WATER_Y - 2, s > 0 ? LOWQ.wall : -130, 900, 0, s > 0 ? 130 : -LOWQ.wall);
    }
    add(-PARK.half, -0.2, PARK.z0, PARK.half, 0, PARK.z1, new THREE.MeshStandardMaterial({ color: 0x8a7f6c, roughness: 0.6 }));
    add(-BRIDGE.half, -1.4, -LOWQ.wall, BRIDGE.half, 0, LOWQ.wall, stone);
    for (const z of BRIDGE.piers) add(-BRIDGE.half, WATER_Y - 2, z - 2, BRIDGE.half, -1.4, z + 2, stone);
    // ramps
    const ramp = (xa, xb, z0, z1) => { const L = Math.abs(xb - xa), g = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(L, 5.6), 0.3, z1 - z0), stone); g.position.set((xa + xb) / 2, (LOW_Y) / 2 - 0.15, (z0 + z1) / 2); g.rotation.z = Math.atan2(5.6, L) * (xa > xb ? 1 : -1); root.add(g); };
    ramp(RAMP_N.xLow, RAMP_N.xHigh, RAMP_N.z0, RAMP_N.z1); ramp(RAMP_S.xHigh, RAMP_S.xLow, RAMP_S.z0, RAMP_S.z1);
    add(PONTOON.x0, PONTOON.y - 0.4, PONTOON.z0, PONTOON.x1, PONTOON.y, PONTOON.z1, new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.7 }));
    const glows = [];
    for (let x = -300; x < 500; x += 22) for (const z of [55, -55]) glows.push({ p: [x, 4.6, z], color: [2.6, 1.6, 0.7], size: 1.2 });
    for (let z = -46; z <= 46; z += 15) for (const x of [-13.7, 13.7]) glows.push({ p: [x, 4.2, z], color: [2.6, 1.6, 0.7], size: 1.2 });
    return { root, colliders: [], standIn: true, anchors: { glows, reflect: glows.map(g => ({ p: g.p, color: g.color, len: 9, width: 1.2, ground: Math.abs(g.p[2]) < 47 ? 0 : 0 })) } };
  }
  _standInRiver() {
    const root = new THREE.Group();
    const w = new THREE.Mesh(new THREE.PlaneGeometry(RIVER.x1 - RIVER.x0, RIVER.z1 - RIVER.z0), new THREE.MeshStandardMaterial({ color: 0x0b1416, roughness: 0.08, metalness: 0.6 }));
    w.rotation.x = -Math.PI / 2; w.position.set((RIVER.x0 + RIVER.x1) / 2, WATER_Y, 0); root.add(w);
    return { root };
  }
}
const _v = new THREE.Vector3();
