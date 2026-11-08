import * as THREE from 'three';
import { DAY } from './tod.js';
import { buildSunMap, casterMesh, patchSunTree } from './sunshadow.js';
import { BillboardBatch, CELL } from '../../particles.js';
import { CollisionWorld, NavGrid } from '../../collision.js';
import { buildSedan, buildSUV, MAT } from '../../vehicles.js';
import { GroundLight } from './lightmap.js';
import { groundAt, walkable, STATE, CROSS, AVE_E, AVE_S, TAXI, PLAZA, CENTER, STAIRS, SKY, VIADUCT, KOEN, GARAGE, XWAY, XWAY_IN, XWAY_BLOCK, GORE, OFFRAMP, LANE, CROSS_ST, CURB, ESTAIR } from './layout.js';

// The art is built by separate modules; each falls back to nothing so the level always runs.
const PROG = [[1.5, 0.35, 0.3], [1.3, 0.65, 1.15], [0.55, 0.6, 1.4], [0.5, 0.95, 1.35]];
const ASSETS = import.meta.glob(['./city.js', './street.js', './station.js', './eastexit.js', './xway.js', './props.js', './landmarks.js', './plumes.js', '../downtown-haven/cars.js']);
async function asset(name) { const l = ASSETS[name]; try { return l ? await l() : null; } catch (e) { console.warn('asset', name, e); return null; } }

// =====================================================================================
//  TOKYO SCRAMBLE world: assembles the city, the streets, the station, the car park and the
//  expressway; owns the collision world + nav grid, the ground light map, the glows.
// =====================================================================================
export class TokyoWorld {
  constructor(E) {
    this.E = E; this.scene = E.scene;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.col = new CollisionWorld({ cell: 8, minX: -280, minZ: -300, maxX: 340, maxZ: 320 });
    this.panes = []; this.glowList = []; this.updaters = []; this.groundMats = [];
    this.light = new GroundLight();
    this.time = 0;
  }
  async build() {
    const E = this.E, ctx = { renderer: E.renderer, scene: E.scene, camera: E.camera, sun: E.sun, hemi: E.hemi, atlas: E.atlas, light: this.light };
    const names = ['./city.js', './street.js', './station.js', './eastexit.js', './xway.js', './props.js', './landmarks.js', './plumes.js', '../downtown-haven/cars.js'];
    const [cityM, streetM, stationM, eastM, xwayM, propsM, landM, plumeM, carMod] = await Promise.all(names.map(asset));
    this.mods = { cityM, streetM, stationM, eastM, xwayM, propsM, landM, carMod };
    this.col.floorFn = groundAt;
    this.fastGround = groundAt;
    const take = async (fn, label) => {
      if (!fn) return null;
      let r = null;
      try { r = await fn(ctx); } catch (e) { console.warn('build ' + label, e); return null; }
      if (!r) return null;
      this.group.add(r.root);
      if (r.colliders) for (const c of r.colliders) c.box = this.col.add(c.min, c.max, { mat: 'concrete', ...(c.data || {}) });
      if (r.update) this.updaters.push(r.update);
      if (r.panes) this.panes.push(...r.panes);
      for (const gl of r.anchors?.glows || []) this.glowList.push(gl);
      for (const L of r.anchors?.lights || []) this.light.add(L);
      if (r.groundMats) this.groundMats.push(...r.groundMats);
      if (r.walks) for (const w of r.walks) this.col.walk.push(w);
      for (const sh of r.shade || []) this.light.shade(...sh);
      return r;
    };
    this.city = await take(cityM?.buildCity, 'city');
    this.street = await take(streetM?.buildStreet, 'street');
    this.station = await take(stationM?.buildStation, 'station');
    this.props = await take(propsM?.buildProps, 'props');
    this.landmarks = await take(landM?.buildLandmarks, 'landmarks');
    this.east = await take(eastM?.buildEastExit, 'eastexit');
    this.xway = await take(xwayM?.buildXway, 'xway');
    this.plumes = await take(plumeM?.buildPlumes, 'plumes');
    this.screens = this.city?.screens || [];
    // contact darkening at every building base near the play areas (the blurred footprint map)
    for (const L of this.city?.lots || []) if (!L.far) this.light.occlude(L.x0, L.z0, L.x1, L.z1);
    for (const r of [[-170, -70, -100, 70], [-88, -330, -76, 330], [29, 18, 45, 34], [44, -128, 112, -80], [-40, -29.6, -35.5, -26], [-60 - 1.4, -24.9, -60 + 1.4, -23.1]]) this.light.occlude(...r);
    // the light on the ground: bake once everything has reported its lamps, patch every ground surface
    // sky occlusion under the expressway and the station's skybridge
    this.light.shade(XWAY.x0, XWAY.z0, XWAY.x1, XWAY.z1, 0.55); this.light.shade(SKY.x0, SKY.z0, SKY.x1, SKY.z1, 0.4);
    this.light.bake();
    this.light.k.value = DAY.groundK;
    for (const m of this.groundMats) this.light.patch(m, m.userData.glK ?? 1, { ao: !m.userData.noAO });
    this._bounds();
    // the afternoon sun: a building-height map every static surface marches toward the sun, and the
    // same boxes (invisible) casting into the realtime shadow map for cars / people / props
    if (DAY.on) {
      const extra = [[VIADUCT.x0, VIADUCT.z0, VIADUCT.x1, VIADUCT.z1, VIADUCT.y + 1.2], [SKY.x0, SKY.z0, SKY.x1, SKY.z1, SKY.y]];
      const casters = buildSunMap(this.col, extra);
      this.group.add(casterMesh(casters.filter(b => Math.abs((b.min.x + b.max.x) / 2) < 260 && Math.abs((b.min.z + b.max.z) / 2) < 260)));
      patchSunTree(this.group);
    }
    this.glows = new BillboardBatch(Math.max(64, this.glowList.length + 16), E.atlas, { boost: 1, renderOrder: 19, fog: this.scene.fog });
    this.scene.add(this.glows.mesh);
    return this;
  }
  buildNav() {
    // the East Exit's deck balustrades hang over the plaza: the street nav must not see them
    const deck = this.col.boxes.filter(b => b.enabled && b.data.layer === 'deck'); for (const b of deck) b.enabled = false;
    this.nav = new NavGrid(this.col, { x0: -100, z0: -162, x1: 172, z1: 132, y: 0, height: 15, cell: 1, clearance: 0.42, walkable });
    for (const b of deck) b.enabled = true;
  }
  _bounds() {
    const b = (min, max, extra = {}) => this.col.add(min, max, { kind: 'bound', noBullet: true, ...extra });
    // the far ends of the avenues (barricades) and the plaza / Center-gai ends
    b([168, 0, -17], [170, 6, 17]); b([-17, 0, 130], [17, 6, 132]);
    b([KOEN.x0, 0, KOEN.z0], [KOEN.x1, 6, KOEN.z0 + 1]);   // Kōen-dōri is barricaded
    // the cross street under the expressway is closed (rubble / fire): Center-gai stops at its north end
    b([-CENTER.half, 0, CENTER.z0 - 1.6], [CENTER.half, 4, CENTER.z0 - 0.6]);
    // the expressway: parapets both sides, the jam stops you at XWAY_BLOCK, the east end closed
    const par = (x0, x1, z0, z1, kind = 'parapet') => this.col.add([x0, XWAY.y - 0.4, z0], [x1, XWAY.y + XWAY.barrier, z1], { kind, mat: 'concrete' });
    par(XWAY.x0, XWAY.x1, XWAY.z0, XWAY_IN.z0);                     // north parapet, whole length
    par(XWAY.x0, ESTAIR.top.x0, XWAY_IN.z1, XWAY.z1);              // south parapet west of the emergency stair
    par(ESTAIR.top.x1, OFFRAMP.x1 - 2, XWAY_IN.z1, XWAY.z1);        // ...between it and the off-ramp gore
    par(GORE.x1, XWAY.x1, XWAY_IN.z1, XWAY.z1);                      // ...and east of the link
    b([XWAY_BLOCK - 1, XWAY.y - 0.5, XWAY.z0], [XWAY_BLOCK, XWAY.y + 4, XWAY.z1]);
    b([120, XWAY.y - 0.5, XWAY.z0], [122, XWAY.y + 4, XWAY.z1]);
    // the gore: the link bridge's side rails, the off-ramp's outer parapets
    par(GORE.x0, GORE.x0 + 0.4, GORE.z0 + 9, GORE.z1, 'rail'); par(GORE.x1 - 0.4, GORE.x1, GORE.z0, GORE.z1, 'rail');
    const rampPar = (z0, z1) => { for (let x = OFFRAMP.x0; x < OFFRAMP.x1; x += 6) { const y = groundAt(x + 3, (OFFRAMP.z0 + OFFRAMP.z1) / 2); this.col.add([x, Math.max(0, y - 1), z0], [x + 6, y + 1.05, z1], { kind: 'parapet', mat: 'concrete' }); } };
    rampPar(OFFRAMP.z0 - 0.4, OFFRAMP.z0 + 0.4); rampPar(OFFRAMP.z1 - 0.4, OFFRAMP.z1 + 0.4);
    // the lane at the bottom of the off-ramp: walls either side
    this.col.add([LANE.x0, 0, LANE.z0 - 0.5], [LANE.x1, 3, LANE.z0], { kind: 'wall', mat: 'concrete' });
    // the skybridge: glass sides (bullets break the glass first; these keep you in), the station end
    const wallB = (min, max, extra = {}) => this.col.add(min, max, { kind: 'wall', mat: 'glass', noBullet: true, ...extra });
    wallB([SKY.x0, SKY.y, SKY.z0 - 0.3], [SKY.x1, SKY.y + 1.1, SKY.z0]); wallB([SKY.x0, SKY.y, SKY.z1], [SKY.x1, SKY.y + 1.1, SKY.z1 + 0.3]);
    this.col.add([SKY.x0 - 1, SKY.y - 1, SKY.z0], [SKY.x0 + 1.5, SKY.y + 4, SKY.z1], { kind: 'wall', mat: 'glass' });
    // the stair's granite cheeks (they follow the stair down), and the space under the bridge is closed
    for (const z of [STAIRS.z0, STAIRS.z1]) for (let x = STAIRS.x0; x < STAIRS.x1; x += 1.5) { const y = groundAt(x + 0.75, 0); this.col.add([x, 0, z - (z < 0 ? 0.4 : 0)], [x + 1.5, y + 1.0, z + (z > 0 ? 0.4 : 0)], { kind: 'parapet', mat: 'concrete' }); }
    this.col.add([VIADUCT.x1, 0, SKY.z0 - 0.4], [STAIRS.x0, SKY.y - 1, SKY.z1 + 0.4], { kind: 'wall', mat: 'concrete' });
    // the viaduct's plaza side (the bars in the arches are scenery)
    this.col.add([VIADUCT.x1 - 0.2, 0, -330], [VIADUCT.x1 + 0.3, VIADUCT.y, 330], { kind: 'wall', mat: 'concrete' });
  }

  update(dt, head) {
    this.time += dt;
    const t = this.time;
    for (const u of this.updaters) u(dt, t, head);
    const G = this.glows;
    let gi = 0;
    for (const L of this.glowList) {
      if (gi >= G.max - 1) break;
      if (L.dead) continue;
      if (DAY.on && !L.blink && !L.day) continue;
      const p = L.p.isVector3 ? L.p : (L._p ||= new THREE.Vector3(...L.p));
      if (L.blink && Math.sin(t * (L.rate || 3.2) + p.x * 0.7) < 0.15) continue;
      if (L.far !== true && p.distanceToSquared(head) > 160 * 160) continue;
      const c = L.color || [3, 1.6, 0.6], s = L.size || 1;
      const k = L.flick ? (Math.sin(t * 31 + p.z) > -0.6 ? 1 : 0.15) : 1;
      G.set(gi++, p.x, p.y, p.z, s, s, 0, CELL.GLOW, 0, c[0] * 0.72 * k, c[1] * 0.72 * k, c[2] * 0.72 * k, 0.85);
    }
    G.commit(gi);
    // the screens throw their current picture's colour onto the crossing (red, flashing, in an emergency)
    const SC = this.light.scr.value, SCC = this.light.scrC.value;
    for (let i = 0; i < 4; i++) {
      const S = this.screens[i]; if (!S || DAY.on) { SC[i].w = 0; continue; }
      const seed = S.mat.uniforms.uSeed.value, tt = S.mat.uniforms.uT.value + seed * 37;
      const k = ((Math.floor(tt / 9) + seed * 3) % 4 + 4) % 4;
      const c = k < 0.5 ? PROG[0] : k < 1.5 ? PROG[1] : k < 2.5 ? PROG[2] : PROG[3];
      const fl = (S.mat.uniforms.uT.value * 1.1) % 1 > 0.5 ? 1 : 0.25;
      const a = S.alert || 0, d = 1 - Math.min(1, (S.dead || 0) * 1.2);
      SCC[i].set((c[0] * (1 - a) + 0.95 * fl * a) * d, (c[1] * (1 - a) + 0.07 * fl * a) * d, (c[2] * (1 - a) + 0.06 * fl * a) * d);
      const N = S._n ||= new THREE.Vector3(0, 0, 1).applyQuaternion(S.root.quaternion);
      SC[i].set(S.root.position.x + N.x * S.w * 0.9, S.root.position.z + N.z * S.w * 0.9, S.w * (2.2 - 0.6 * a), 0.85);
    }
  }

  fallbackCar(type, paint) {
    const m = type === 'suv' || type === 'van' || type === 'police' ? buildSUV() : buildSedan(new THREE.MeshStandardMaterial({ color: paint ?? 0x777777, metalness: 0.5, roughness: 0.3 }));
    const h = m.half.clone().multiply(m.root.scale);
    return { root: m.root, half: [h.x, h.y, h.z], center: [0, h.y, 0], anchors: { lights: [] }, setBurnt() { m.mesh.material = m.mesh.material.map(() => MAT.charred); } };
  }
}
