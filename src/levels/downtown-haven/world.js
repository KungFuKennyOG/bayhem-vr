import * as THREE from 'three';
import { BillboardBatch, CELL } from '../../particles.js';
import { CollisionWorld, NavGrid } from '../../collision.js';
import { buildSedan, buildSUV, MAT } from '../../vehicles.js';
import { concreteTexture } from '../../textures.js';
import { splitByCells } from './chunks.js';
import { AVE, CROSS, PLAZA, MERIDIAN, LOBBY, SUBWAY, LOTS, PARAPET, streetGround } from './layout.js';

// The art is built by separate modules; each falls back to a stand-in so the level always runs.
const ASSETS = import.meta.glob(['./city.js', './street.js', './cars.js', './lobby.js']);
async function asset(name) { const l = ASSETS[`./${name}.js`]; try { return l ? await l() : null; } catch (e) { console.warn('asset', name, e); return null; } }

// =====================================================================================
//  DOWNTOWN HAVEN CITY world: assembles the city, Meridian, the street, the lobby and the
//  subway; owns the collision world + nav grid, the dusk ramp and the world-space glows.
// =====================================================================================
export class DowntownWorld {
  constructor(E) {
    this.E = E; this.scene = E.scene;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.col = new CollisionWorld({ cell: 8, minX: -240, minZ: -260, maxX: 240, maxZ: 170 });
    this.panes = []; this.duskMats = []; this.glowList = []; this.manholes = []; this.updaters = [];
    this.time = 0;
  }

  async build() {
    const E = this.E, ctx = { renderer: E.renderer, scene: E.scene, camera: E.camera, sun: E.sun, hemi: E.hemi };
    const [cityM, streetM, carMod, lobbyM] = await Promise.all([asset('city'), asset('street'), asset('cars'), asset('lobby')]);
    this.mods = { cityM, streetM, carMod, lobbyM };
    this.col.floorFn = streetGround;
    this.fastGround = streetGround;
    const take = async (fn, fallback, label) => {
      let r = null;
      if (fn) { try { r = await fn(ctx); } catch (e) { console.warn('build ' + label, e); } }
      if (!r) r = fallback();
      this.group.add(r.root);
      if (r.colliders) for (const c of r.colliders) this.col.add(c.min, c.max, { mat: 'concrete', ...(c.data || {}) });
      if (r.panes) this.panes.push(...r.panes);
      if (r.update) this.updaters.push(r.update);
      for (const gl of r.anchors?.glows || []) this.glowList.push(gl);
      return r;
    };
    this.city = await take(cityM?.buildCity, () => this._standInCity(), 'city');
    this.street = await take(streetM?.buildStreet, () => this._standInStreet(), 'street');
    this.subway = await take(streetM?.buildSubway, () => this._standInSubway(), 'subway');
    this.lobby = await take(lobbyM?.buildLobby, () => this._standInLobby(), 'lobby');
    // Meridian: colliders tracked separately (the upper section leaves when it falls)
    let mer = null;
    if (cityM?.buildMeridian) { try { mer = await cityM.buildMeridian(ctx); } catch (e) { console.warn('meridian', e); } }
    if (!mer) mer = this._standInMeridian();
    this.group.add(mer.root);
    if (mer.hole) mer.hole.visible = false;
    this.meridian = mer;
    mer.boxes = (mer.colliders || []).map(c => this.col.add(c.min, c.max, { kind: 'meridian', mat: 'glass', ...(c.data || {}) }));
    for (const gl of mer.anchors?.glows || []) this.glowList.push(gl);
    this.manholes = (this.street.anchors?.manholes || []).map(p => (p.isVector3 ? p : new THREE.Vector3(...p)));
    if (!this.manholes.length) this.manholes = [[-5.5, 31], [5.5, 6], [-5.5, -22], [5.5, -38], [-5.5, -95], [5.5, -128]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    this._bounds();
    this._collectDusk(this.group);
    this.glows = new BillboardBatch(Math.max(64, this.glowList.length + 16), E.atlas, { boost: 1, renderOrder: 19, fog: this.scene.fog });
    this.scene.add(this.glows.mesh);
    // escape beacon: the subway's green globes + fascia, fog-free so they cut through the dust wall during
    // the run (the dust fog swallows everything past ~25 m; this is the one thing you must find)
    this.beacon = new BillboardBatch(8, E.atlas, { boost: 1, renderOrder: 23, fog: { color: this.scene.fog.color, near: 1e5, far: 1e5 + 1 } });
    this.beacon.material.userData.noFogSync = true;
    this.scene.add(this.beacon.mesh);
    this.beaconK = 0;
    this.group.traverse(o => { if (o.isMesh && o.castShadow === undefined) o.castShadow = false; });
    // per-area chunks so the eye and shadow passes can cull the merged city / street / lobby meshes
    // (the lobby LED strip scrolls its own uvs, the subway toggles meshes: both stay whole)
    if (!this.E.params?.has('nochunks')) {
      this.chunkInfo = { meshes: 0, chunks: 0 };
      for (const r of [this.city, this.street, this.lobby]) if (r?.root) {
        const s = splitByCells(r.root, { skip: o => o.name === 'lobby_led' });
        this.chunkInfo.meshes += s.meshes; this.chunkInfo.chunks += s.chunks;
      }
    }
    return this;
  }

  buildNav() {
    this.nav = new NavGrid(this.col, {
      x0: -62, z0: -168, x1: 62, z1: 46, y: 0, cell: 1, clearance: 0.42,
      walkable: (x, z) => {
        if (streetGround(x, z) < -0.3) return false; // the subway stairwell
        const ax = Math.abs(x);
        if (ax < AVE.half) return true;
        if (z < CROSS.z1 && z > CROSS.z0) return true;
        if (z < PLAZA.z1 && z > PLAZA.z0) return ax < PLAZA.half;
        if (x > LOBBY.x0 && x < LOBBY.x1 && z > LOBBY.z0 && z < LOBBY.z1) return true;
        return false;
      },
    });
  }

  _bounds() {
    const b = (min, max) => this.col.add(min, max, { kind: 'bound', noBullet: true });
    b([-AVE.half, 0, 46.5], [AVE.half, 6, 48]);                // behind the start: the burning barricade
    b([-62, 0, CROSS.z0], [-60, 8, CROSS.z1]); b([60, 0, CROSS.z0], [62, 8, CROSS.z1]); // cross street ends (smoke / wrecks)
    b([-PLAZA.half - 2, 0, PLAZA.z0 - 2], [-PLAZA.half, 8, PLAZA.z1]); b([PLAZA.half, 0, PLAZA.z0 - 2], [PLAZA.half + 2, 8, PLAZA.z1]);
    b([-PLAZA.half, 0, PLAZA.z0 - 4], [PLAZA.half, 8, PLAZA.z0 - 2]);
  }
  _collectDusk(root) {
    root.traverse(o => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) if (m.userData && m.userData.duskEmissive !== undefined && !this.duskMats.includes(m)) this.duskMats.push(m);
    });
  }

  update(dt, head, dusk) {
    this.time += dt;
    const t = this.time;
    const em = THREE.MathUtils.smoothstep(dusk, 0.0, 0.6);
    for (const m of this.duskMats) m.emissiveIntensity = m.userData.duskEmissive * (0.25 + 0.75 * em);
    for (const u of this.updaters) u(dt, t, dusk, head);
    // world-space glows: street lamps, signals, aviation lights, metro globes
    const G = this.glows;
    let gi = 0;
    for (const L of this.glowList) {
      if (gi >= G.max - 1) break;
      const p = L.p.isVector3 ? L.p : (L._p ||= new THREE.Vector3(...L.p));
      let a = L.dusk ? 0.2 + 0.8 * Math.min(1, dusk * 2.2) : 1;
      if (L.blink && Math.sin(t * (L.rate || 3.2) + p.x * 0.7) < 0.15) continue;
      const c = L.color || [3, 1.6, 0.6], s = L.size || 1;
      if (L.far !== true && p.distanceToSquared(head) > 260 * 260) continue;
      G.set(gi++, p.x, p.y, p.z, s, s, 0, CELL.GLOW, 0, c[0] * a, c[1] * a, c[2] * a, 0.9 * a);
    }
    G.commit(gi);
    // escape beacon (see build): pulses while the director asks for it
    const Bc = this.beacon, k = this.beaconK, dv = this.subway?.anchors?.dive;
    if (k > 0.01 && dv) {
      const pulse = 0.75 + 0.25 * Math.sin(t * 5.5), x0 = SUBWAY.x0 - 0.1, x1 = SUBWAY.x1 + 0.1, gz = SUBWAY.zTop + 0.1, gy = dv.y + 2.3;
      // grow with distance so they keep a readable size on screen from down the avenue
      const d = Math.hypot(head.x - dv.x, head.z - SUBWAY.zTop), gs = Math.max(2.6, d * 0.085) * pulse, fs = Math.max(7, d * 0.16) * pulse;
      let bi = 0;
      for (const x of [x0, x1]) Bc.set(bi++, x, gy, gz, gs, gs, 0, CELL.GLOW, 0, 0.5 * k, 3.0 * k, 1.1 * k, 0.9 * k);
      Bc.set(bi++, dv.x, dv.y + 3.0, SUBWAY.zTop - 0.7, fs, fs * 0.65, 0, CELL.GLOW, 0, 0.25 * k, 1.1 * k, 0.5 * k, 0.6 * k);
      Bc.commit(bi);
    } else Bc.commit(0);
  }

  // ---------------------------------------------------------------- stand-ins (used until/unless the art modules exist)
  fallbackCar(type, paint) {
    const m = type === 'suv' || type === 'van' || type === 'bus' || type === 'police' ? buildSUV() : buildSedan(new THREE.MeshStandardMaterial({ color: type === 'taxi' ? 0xe0b020 : paint ?? 0x777777, metalness: 0.5, roughness: 0.3 }));
    if (type === 'bus') m.root.scale.set(1.3, 1.6, 2.2);
    if (type === 'wreck') m.mesh.material = m.mesh.material.map(() => MAT.charred);
    const h = m.half.clone().multiply(m.root.scale);
    return { root: m.root, half: [h.x, h.y, h.z], center: [0, h.y, 0], anchors: { lights: [] }, setBurnt() { m.mesh.material = m.mesh.material.map(() => MAT.charred); } };
  }
  _standInCity() {
    const root = new THREE.Group(), colliders = [], panes = [];
    const tex = concreteTexture(7, [0.6, 0.6, 0.62], 256); tex.repeat.set(4, 12);
    const mats = { glassBlue: new THREE.MeshStandardMaterial({ color: 0x5a7f96, metalness: 0.85, roughness: 0.08 }), glassGold: new THREE.MeshStandardMaterial({ color: 0xa48650, metalness: 0.85, roughness: 0.1 }), darkFins: new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.8, roughness: 0.15 }), stone: new THREE.MeshStandardMaterial({ map: tex, color: 0xd8cbb4, roughness: 0.85 }), stoneGlass: new THREE.MeshStandardMaterial({ map: tex, color: 0xb4ad9e, roughness: 0.6, metalness: 0.2 }) };
    for (const L of LOTS) {
      const [z0, z1] = L.z, x0 = L.side < 0 ? -AVE.half - L.depth : AVE.half, x1 = L.side < 0 ? -AVE.half : AVE.half + L.depth;
      const add = (ax0, ay0, az0, ax1, ay1, az1, m) => { const g = new THREE.Mesh(new THREE.BoxGeometry(ax1 - ax0, ay1 - ay0, az1 - az0), m); g.position.set((ax0 + ax1) / 2, (ay0 + ay1) / 2, (az0 + az1) / 2); g.castShadow = g.receiveShadow = true; root.add(g); colliders.push({ min: [ax0, ay0, az0], max: [ax1, ay1, az1] }); };
      if (!L.lobby) add(x0, 0, z1, x1, L.podium, z0, mats[L.style]);
      const px = L.side < 0 ? -AVE.half - PARAPET.t : AVE.half;
      if (!L.lobby) add(px, L.podium, z1, px + PARAPET.t, L.podium + PARAPET.h, z0, mats.stone);
      if (L.tower) { const sx0 = L.side < 0 ? x0 + 2 : x0 + L.setback, sx1 = L.side < 0 ? x1 - L.setback : x1 - 2; add(sx0, L.podium, z1 + 2, sx1, L.tower, z0 - 2, mats[L.style]); }
      if (!L.lobby) for (let z = z0 - 3; z > z1 + 2; z -= 3.2) panes.push({ c: [L.side * AVE.half, 1.9, z], n: [-L.side, 0, 0], w: 2.6, h: 2.8, kind: 'store' });
    }
    return { root, colliders, panes };
  }
  _standInStreet() {
    const root = new THREE.Group();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(22, 330), new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.85 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -10); road.receiveShadow = true; root.add(road);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(440, 10), road.material); cross.rotation.x = -Math.PI / 2; cross.position.set(0, 0.002, -53); cross.receiveShadow = true; root.add(cross);
    const sw = new THREE.MeshStandardMaterial({ color: 0x8c877f, roughness: 0.9 });
    for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 330), sw); m.position.set(s * 13.5, 0.075, -10); m.receiveShadow = true; root.add(m); }
    const pl = new THREE.Mesh(new THREE.BoxGeometry(92, 0.15, 40), sw); pl.position.set(0, 0.075, -176); pl.receiveShadow = true; root.add(pl);
    return { root, colliders: [] };
  }
  _standInSubway() {
    const root = new THREE.Group(), colliders = [];
    const m = new THREE.MeshStandardMaterial({ color: 0x2e5a3c, roughness: 0.6 });
    for (const x of [SUBWAY.x0 - 0.2, SUBWAY.x1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.2, 5.2, SUBWAY.zEnd - SUBWAY.zTop), m); w.position.set(x + 0.1, -1.5, (SUBWAY.zTop + SUBWAY.zEnd) / 2); root.add(w); colliders.push({ min: [x, -4.2, SUBWAY.zTop], max: [x + 0.2, 1.1, SUBWAY.zEnd] }); }
    colliders.push({ min: [SUBWAY.x0, -4.2, SUBWAY.zEnd], max: [SUBWAY.x1, 1.1, SUBWAY.zEnd + 0.3] });
    return { root, colliders, anchors: { dive: new THREE.Vector3((SUBWAY.x0 + SUBWAY.x1) / 2, 0.15, SUBWAY.zTop) } };
  }
  _standInLobby() {
    const root = new THREE.Group(), colliders = [], panes = [];
    const m = new THREE.MeshStandardMaterial({ color: 0xc8bba8, roughness: 0.5 });
    const add = (x0, y0, z0, x1, y1, z1) => { const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.castShadow = g.receiveShadow = true; root.add(g); colliders.push({ min: [x0, y0, z0], max: [x1, y1, z1] }); };
    add(LOBBY.x1, 0, LOBBY.z0, LOBBY.x1 + 8, 14, LOBBY.z1); add(16, 9.5, LOBBY.z0, LOBBY.x1, 14, LOBBY.z1);
    add(16, 0, -128, 42, 14, LOBBY.z0); add(16, 0, LOBBY.z1, 42, 14, -80);
    for (const [x, z] of [[24, -100], [24, -110], [32, -96], [32, -114]]) add(x - 0.6, 0, z - 0.6, x + 0.6, 9.5, z + 0.6);
    add(29, 0, -108, 30.2, 1.1, -99);
    for (let z = -124.5; z < -82; z += 3) { if (LOBBY.doors.some(([a, b]) => z > b - 1.5 && z < a + 1.5)) continue; panes.push({ c: [16, 2.4, z], n: [-1, 0, 0], w: 2.9, h: 4.4, kind: 'lobby' }); }
    for (let x = 23.5; x < 36; x += 3) for (let z = -114.5; z < -92; z += 3) panes.push({ c: [x, 9.5, z], n: [0, 1, 0], w: 3, h: 3, kind: 'sky' });
    return { root, colliders, panes, anchors: { doors: LOBBY.doors.map(([a, b]) => new THREE.Vector3(15, 0.15, (a + b) / 2)), inside: new THREE.Vector3(29, 0.15, -104) } };
  }
  _standInMeridian() {
    const root = new THREE.Group(), M = MERIDIAN;
    const mat = new THREE.MeshStandardMaterial({ color: 0x1b2026, metalness: 0.85, roughness: 0.12 });
    const lower = new THREE.Mesh(new THREE.BoxGeometry(M.x1 - M.x0, M.breakY, M.z1 - M.z0), mat);
    lower.position.set(0, M.breakY / 2, (M.z0 + M.z1) / 2); lower.castShadow = true;
    const lowerG = new THREE.Group(); lowerG.add(lower); root.add(lowerG);
    const pivot = new THREE.Vector3(0, M.breakY, M.z1);
    const upper = new THREE.Group(); upper.position.copy(pivot); root.add(upper);
    const chunks = [];
    const H = M.h - M.breakY, n = 8, ch = H / n, D = M.z1 - M.z0;
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const hx = (M.x1 - M.x0) / 4, c = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 - 0.05, ch - 0.05, D), mat);
      c.position.set(s * hx, ch * (i + 0.5), -D / 2); c.castShadow = true; c.userData.half = [hx, ch / 2, D / 2];
      upper.add(c); chunks.push(c);
    }
    const hole = new THREE.Group(); hole.position.set(...M.impact); root.add(hole);
    return { root, lower: lowerG, upper, chunks, pivot, hole, colliders: [{ min: [M.x0, 0, M.z0], max: [M.x1, M.h, M.z1] }], anchors: { impact: new THREE.Vector3(...M.impact), crown: new THREE.Vector3(0, M.h, (M.z0 + M.z1) / 2) } };
  }
}
