import * as THREE from 'three';
import * as T from '../../textures.js';
import { box, at, cyl, merge, mergeGrouped } from '../../geom.js';
import { makeRng } from '../../rng.js';
import { BillboardBatch, CELL } from '../../particles.js';
import { SUN_DIR } from '../../atmosphere.js';
import { CollisionWorld, NavGrid } from '../../collision.js';
import { buildPickup } from '../../vehicles.js';
import { CW, CH, C40, C20, QUAY_Z, WATER_Y, DECK_Y, YARD, COLUMNS, MAIN_AISLE, MASTS, DRUMS, GATE_Z, RTG, buildContainerList } from './layout.js';
import { buildWater } from './water.js';
import { buildFar } from './far.js';
import { buildGroundDecals, buildPuddles } from './decals.js';
import { buildWarehouses } from './warehouses.js';

// Asset modules are built by separate builders; fall back to simple stand-ins if one is missing.
const ASSETS = import.meta.glob(['./ship.js', './containers.js', './props.js', './cranes.js']);
async function asset(name) { const l = ASSETS[`./${name}.js`]; try { return l ? await l() : null; } catch (e) { console.warn('asset', name, e); return null; } }

const SODIUM = [1.0, 0.52, 0.16];

// =====================================================================================
//  PORT OF VICTORY world: yard, maze, quay, water, ship, cranes, lights, far shore,
//  plus the collision world and nav grids used by the player, the AI and the FX.
// =====================================================================================
export class PortWorld {
  constructor(E) {
    this.E = E; this.scene = E.scene;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.col = new CollisionWorld({ cell: 8, minX: -140, minZ: -200, maxX: 140, maxZ: 80 });
    this.duskMats = [];       // materials with userData.duskEmissive
    this.lampGlows = [];      // { p: Vector3, size, mast, k }
    this.time = 0;
  }

  async build() {
    const E = this.E, renderer = E.renderer;
    const [shipM, contM, propM, craneM] = await Promise.all([asset('ship'), asset('containers'), asset('props'), asset('cranes')]);
    this.mods = { shipM, contM, propM, craneM };
    this.aniso = renderer.capabilities.getMaxAnisotropy();
    this._ground();
    this._water();
    this._containers(contM);
    this._decals();
    this._quay(propM);
    this._gate(propM);
    this._masts(propM);
    this._drums(propM);
    this._cranes(craneM);
    this._ship(shipM);
    this._far();
    this._sidePort();
    this._walls();
    this._collectDusk(this.group);
    // floor function for the collision world (yard + quay; water below the quay edge)
    const ship = this.ship;
    this.col.floorFn = (x, z) => (z < QUAY_Z ? WATER_Y : 0);
    this.fastGround = (x, z) => {
      if (z < -153.2 && z > -180 && x > -95 && x < 65) return DECK_Y;
      if (z < QUAY_Z) { if (x > -2 && x < 22 && z > -153) return (x + 2) / 24 * DECK_Y; return WATER_Y; }
      return 0;
    };
    return this;
  }
  // nav grids are built once every static/hero obstacle is in the collision world
  buildNav() {
    this.nav = new NavGrid(this.col, { x0: -60, z0: -150.5, x1: 60, z1: 40, y: 0, cell: 1, clearance: 0.42 });
    this.navDeck = new NavGrid(this.col, { x0: -90, z0: -179, x1: 62, z1: -153.2, y: DECK_Y, cell: 0.5, clearance: 0.34, walkable: (x, z) => Math.abs(this.col.groundAt(x, z, DECK_Y + 0.3, 0.3) - DECK_Y) < 0.2 });
  }

  // ---------------------------------------------------------------- ground
  _ground() {
    const aniso = this.aniso;
    // asphalt (yard): tiled detail + a painted-markings overlay
    const asph = asphaltTexture(); asph.map.anisotropy = aniso; asph.map.repeat.set(160 / 4.5, 150 / 4.5); asph.normal.repeat.copy(asph.map.repeat);
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(160, 150), new THREE.MeshStandardMaterial({ map: asph.map, normalMap: asph.normal, normalScale: new THREE.Vector2(0.14, 0.14), roughness: 0.78, metalness: 0, color: 0x9a9894, envMapIntensity: 0.6 }));
    yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0, 40 - 75); yard.receiveShadow = true;
    this.group.add(yard);
    // concrete apron (quay); it runs on past the yard along the whole waterfront
    const AW = 800;
    const conc = T.concreteTexture(31, [0.66, 0.63, 0.58], 512, false); conc.anisotropy = aniso; conc.repeat.set(AW / 7, 41 / 7);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(AW, 41), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.88, color: 0x948f8a, envMapIntensity: 0.5 }));
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.005, QUAY_Z + 20.5); apron.receiveShadow = true;
    this.group.add(apron);
    // road outside the gate + the land all around the port (so no void shows past the yard edges)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(18, 260), new THREE.MeshStandardMaterial({ map: asph.map.clone(), roughness: 0.8, color: 0x9c948c }));
    road.material.map.repeat.set(2, 30); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.004, GATE_Z + 130); road.receiveShadow = true;
    this.group.add(road);
    const verge = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1700), new THREE.MeshStandardMaterial({ map: T.groundTexture(), color: 0xb8a88e, roughness: 0.95, envMapIntensity: 1.3 }));
    verge.material.map.repeat.set(214, 121); verge.rotation.x = -Math.PI / 2; verge.position.set(0, -0.03, QUAY_Z + 850); verge.receiveShadow = true;
    this.group.add(verge);
    // painted markings: one merged mesh of thin quads (yellow lane lines, white bay lines, hatched walkways)
    this._markings();
  }
  _markings() {
    const r = makeRng(77);
    const lines = [];
    const WHITE = [0.66, 0.64, 0.58], YELLOW = [0.72, 0.52, 0.13];
    const quad = (x0, z0, x1, z1, w, col) => { // strip from (x0,z0) to (x1,z1)
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05) return;
      w *= 0.9 + r() * 0.2;
      const nx = -dz / L * w / 2, nz = dx / L * w / 2, k = 0.82 + r() * 0.18;
      lines.push([x0 + nx, z0 + nz, x0 - nx, z0 - nz, x1 + nx, z1 + nz, x1 - nx, z1 - nz, L, r() * 8, [col[0] * k, col[1] * k, col[2] * k]]);
    };
    // worn continuous line: pieces of 4-14 m with scuffed-off gaps
    const worn = (x0, z0, x1, z1, w, col) => {
      const L = Math.hypot(x1 - x0, z1 - z0); let s = 0;
      while (s < L) { const e = Math.min(L, s + 4 + r() * 10), a = s / L, b = e / L; quad(x0 + (x1 - x0) * a, z0 + (z1 - z0) * a, x0 + (x1 - x0) * b, z0 + (z1 - z0) * b, w, col); s = e + (r() < 0.6 ? 0.3 + r() * 0.9 : 1.5 + r() * 2.5); }
    };
    const dashed = (x0, z0, x1, z1, w, col, on, off) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      for (let s = r() * off; s < L; s += on + off) { const e = Math.min(L, s + on * (0.9 + r() * 0.2)), a = s / L, b = e / L; if (r() < 0.08) continue; quad(x0 + (x1 - x0) * a, z0 + (z1 - z0) * a, x0 + (x1 - x0) * b, z0 + (z1 - z0) * b, w, col); }
    };
    // lane edges along the block faces and the main aisle (yellow, worn)
    for (const [x0] of Object.values(COLUMNS)) worn(x0 - 0.5, 12, x0 - 0.5, -110, 0.13, YELLOW);
    worn(MAIN_AISLE.x0 + 0.6, 26, MAIN_AISLE.x0 + 0.6, -112, 0.15, YELLOW); worn(MAIN_AISLE.x1 - 0.6, 26, MAIN_AISLE.x1 - 0.6, -112, 0.15, YELLOW);
    // dashed centre line
    dashed(0.1, 24, 0.1, -110, 0.13, WHITE, 2.6, 3.4);
    // cross aisle stop lines
    for (const z of [-24.0, -31.6, -67.0, -74.6]) worn(-60, z, 60, z, 0.16, YELLOW);
    // quay: yellow safety line 2 m from the edge
    worn(-80, QUAY_Z + 3.4, 80, QUAY_Z + 3.4, 0.2, YELLOW);
    // apron: dashed bay grid under the cranes (white), hatched pedestrian strip by the gangway
    for (let x = -70; x <= 70; x += 14) dashed(x, -112, x, -146, 0.12, WHITE, 3, 1.6);
    for (const z of [-114, -132, -146]) dashed(-72, z, 72, z, 0.13, WHITE, 3.5, 2);
    for (let x = -6; x <= -1; x += 0.9) quad(x, -142, x + 0.5, -149.5, 0.32, YELLOW);
    const pos = [], uv = [], col = [], idx = [];
    lines.forEach((l, i) => {
      const y = 0.012;
      pos.push(l[0], y, l[1], l[2], y, l[3], l[4], y, l[5], l[6], y, l[7]);
      const v = l[9];
      uv.push(v, 0, v, 1, v + (l[8] / 4), 0, v + (l[8] / 4), 1);
      for (let k = 0; k < 4; k++) col.push(...l[10]);
      const a = i * 4; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const pt = wornPaintTexture(); pt.wrapS = THREE.RepeatWrapping;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: pt, vertexColors: true, transparent: true, depthWrite: false, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.receiveShadow = true; m.renderOrder = 1;
    this.group.add(m);
  }

  // ---------------------------------------------------------------- ground dressing (decals, contact shadows, puddles)
  _decals() {
    const list = this.containerList, fps = [];
    // contact shadows: union of touching tier-0 footprints (static boxes only)
    const boxes = list.filter(c => c.tier === 0).map(c => { const L = c.len === 40 ? C40 : C20, hx = (c.rot ? CW : L) / 2, hz = (c.rot ? L : CW) / 2; return { x0: c.x - hx, x1: c.x + hx, z0: c.z - hz, z1: c.z + hz, hero: c.hero }; });
    const stat = boxes, par = stat.map((_, i) => i); // hero boxes too: once one bursts its shadow reads as a scorch
    const find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
    for (let i = 0; i < stat.length; i++) for (let j = i + 1; j < stat.length; j++) {
      const a = stat[i], b = stat[j];
      if (a.x0 < b.x1 + 0.15 && b.x0 < a.x1 + 0.15 && a.z0 < b.z1 + 0.15 && b.z0 < a.z1 + 0.15) par[find(i)] = find(j);
    }
    const groups = new Map();
    stat.forEach((b, i) => { const k = find(i), g = groups.get(k); if (!g) groups.set(k, { ...b }); else { g.x0 = Math.min(g.x0, b.x0); g.x1 = Math.max(g.x1, b.x1); g.z0 = Math.min(g.z0, b.z0); g.z1 = Math.max(g.z1, b.z1); } });
    for (const g of groups.values()) fps.push({ ...g, pad: 1.25, k: 0.95 });
    const occupied = (x, z, m) => boxes.some(b => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) || MASTS.some(([mx, mz]) => Math.abs(x - mx) < m + 1.5 && Math.abs(z - mz) < m + 1.5) || DRUMS.some(([dx, dz]) => Math.abs(x - dx) < m + 1.5 && Math.abs(z - dz) < m + 1.5);
    const ids = [];
    for (const [name, [x0, rows]] of Object.entries(COLUMNS)) for (const z of [9.5, -33.5, -76.5]) ids.push([name + '-' + String(Math.abs(Math.round(z / 3)) + 1).padStart(2, '0'), x0 + rows * CW / 2, z + 3.5]);
    const bays = []; for (let i = 0; i < 10; i++) bays.push([String(i + 1).padStart(2, '0'), -63 + i * 14, -112.9]);
    const d = buildGroundDecals({ footprints: fps, occupied, quayZ: QUAY_Z, columns: COLUMNS, apronX: 80, blockIds: ids, bays });
    this.group.add(d.mesh); this.decals = d;
    const pl = [[5, 18, 3.2, 2.2, 0.3], [-8, 23, 2.4, 1.6, 1.2], [-2, 6, 2.0, 1.4, 0.5], [-30, -28, 3, 1.8, 0.1], [1, -30, 2.4, 1.5, 0.8], [2, -56, 2, 1.3, 0.2],
      [12, -71, 3, 2, 0.4], [-1, -95, 2.6, 1.6, 1.1], [-40, -72, 2, 1.2, 0.6], [-10, -140, 4, 2.4, 0.2], [20, -116, 3, 2, 0.9], [44, -137, 2.6, 1.8, 0.4], [-50, -130, 3.4, 2, 0.3], [6, -128, 2.4, 1.5, 1.4]]
      .filter(([x, z, w]) => !boxes.some(b => x > b.x0 - w / 2 && x < b.x1 + w / 2 && z > b.z0 - w / 2 && z < b.z1 + w / 2));
    const pu = buildPuddles(pl); this.group.add(pu.mesh); this.puddles = pu;
  }

  // ---------------------------------------------------------------- water
  _water() {
    // custom harbour water shader (water.js): wall face at QUAY_Z - 1.2, hull side at -153
    const w = buildWater({ waterY: WATER_Y, quayZ: QUAY_Z - 1.2, hullZ: -153.0, shipX0: -95, shipX1: 65, fog: this.scene.fog });
    this.waterFx = w; this.water = w.mesh; this.group.add(w.mesh);
  }

  // ---------------------------------------------------------------- containers
  _containers(contM) {
    const list = buildContainerList();
    this.containerList = list;
    if (contM) {
      contM.initContainerMaterials?.(this.E.renderer);
      const field = contM.buildContainerField(list.filter(c => !c.hero), { renderer: this.E.renderer });
      this.field = field; this.group.add(field.root);
      this.HeroContainer = contM.HeroContainer;
    } else {
      // stand-in: instanced boxes
      const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.3 });
      const im = new THREE.InstancedMesh(g, mat, list.length);
      const m = new THREE.Matrix4(), cc = new THREE.Color(), pal = [0x8a2a1a, 0x1d3f6e, 0x2f5a3a, 0xb05a14, 0x6b6e70, 0x5a1d24, 0x2a6a6a, 0xc9c0ad];
      list.forEach((c, i) => {
        const L = c.len === 40 ? C40 : C20;
        m.makeScale(c.rot ? CW : L, CH, c.rot ? L : CW).setPosition(c.x, c.tier * CH, c.z);
        im.setMatrixAt(i, m); im.setColorAt(i, cc.setHex(pal[c.livery % pal.length]));
      });
      im.castShadow = im.receiveShadow = true;
      this.group.add(im);
    }
    // colliders: one per stack column (merged vertically where contiguous)
    for (const c of list) {
      if (c.hero) continue;
      const L = c.len === 40 ? C40 : C20, hx = (c.rot ? CW : L) / 2, hz = (c.rot ? L : CW) / 2;
      c.box = this.col.add([c.x - hx, c.tier * CH, c.z - hz], [c.x + hx, (c.tier + 1) * CH, c.z + hz], { kind: 'container', mat: 'metal', ref: c });
    }
  }

  // ---------------------------------------------------------------- quay
  _quay(propM) {
    const g = [];
    // quay wall face down to the water (wet tidal band + weed below the waterline), coping strip, hazard band.
    // The wall / coping run the whole waterfront (the apron continues past the yard).
    const QW = 800;
    const wtex = quayWallTexture(); wtex.anisotropy = this.aniso;
    const wallMat = new THREE.MeshStandardMaterial({ map: wtex, roughness: 0.86, color: 0xb0a89e, envMapIntensity: 0.5 });
    const wg = box(QW, 4, 1.2, 4), wuv = wg.attributes.uv;
    for (let k = 8; k < 12; k++) wuv.setY(k, k < 10 ? 0.985 : 0.93); // top face (the 1.2 m ledge) samples the dry top band
    const wall = new THREE.Mesh(wg, wallMat); wall.position.set(0, -2.0, QUAY_Z - 0.6); wall.receiveShadow = true; this.group.add(wall);
    const coping = new THREE.Mesh(box(QW, 0.35, 0.7, 2), new THREE.MeshStandardMaterial({ map: T.concreteTexture(45, [0.84, 0.8, 0.74], 256, true), color: 0xd0c7b8, roughness: 0.85 }));
    coping.position.set(0, 0.175, QUAY_Z + 0.35); coping.castShadow = coping.receiveShadow = true; this.group.add(coping);
    // yellow/black edge band
    const band = new THREE.Mesh(box(QW, 0.1, 0.72), new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6, color: 0xc8c0b0 }));
    band.material.map.repeat.set(QW / 2.8, 1); band.position.set(0, 0.36, QUAY_Z + 0.35); this.group.add(band);
    const fenders = [];
    for (let x = -88; x <= 78; x += 9) fenders.push(at(box(1.8, 2.4, 0.5), x, -1.0, QUAY_Z - 1.4));
    const fm = new THREE.Mesh(merge(fenders), new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.75 })); fm.castShadow = true; this.group.add(fm);
    // crane rails (steel strips set in the concrete)
    const rails = [];
    for (const z of [-124, -149]) for (const dz of [-0.4, 0.4]) rails.push(at(box(800, 0.05, 0.09), 0, 0.02, z + dz));
    rails.push(at(box(QW, 0.07, 0.1), 0, 0.0, QUAY_Z - 1.17)); // steel edge angle on the ledge lip (catches the light)
    const rm = new THREE.Mesh(merge(rails), new THREE.MeshStandardMaterial({ color: 0x9a948e, metalness: 0.9, roughness: 0.35 })); rm.receiveShadow = true; this.group.add(rm);
    // bollards
    const bol = propM?.buildBollard?.();
    const bpos = []; for (let x = -88; x <= 78; x += 12) if (x < -8 || x > 2) bpos.push([x, QUAY_Z + 0.9]);
    if (bol) {
      const im = new THREE.InstancedMesh(bol.geometry, bol.material, bpos.length); const m = new THREE.Matrix4();
      bpos.forEach(([x, z], i) => im.setMatrixAt(i, m.makeTranslation(x, 0, z))); im.castShadow = true; this.group.add(im);
    }
    for (const [x, z] of bpos) this.col.add([x - 0.35, 0, z - 0.35], [x + 0.35, 0.8, z + 0.35], { kind: 'bollard', mat: 'metal' });
    // keep the player off the water: wall along the quay edge except at the gangway landing
    this.col.add([-130, -1, QUAY_Z - 3], [-6, 1.1, QUAY_Z + 0.05], { kind: 'edge', noStand: true, noBullet: true });
    this.col.add([25, -1, QUAY_Z - 3], [130, 1.1, QUAY_Z + 0.05], { kind: 'edge', noStand: true, noBullet: true });
    this.col.add([-2, -1, QUAY_Z - 3], [25, 1.1, -153.0], { kind: 'edge', noStand: true, noBullet: true });
    this.col.add([-6, -1, QUAY_Z - 3], [-2, 1.1, QUAY_Z - 1.0], { kind: 'edge', noStand: true, noBullet: true });
  }

  // ---------------------------------------------------------------- gate
  _gate(propM) {
    const grp = new THREE.Group(); this.group.add(grp);
    if (propM) {
      const gh = propM.buildGatehouse(); gh.root.position.set(12, 0, 30); gh.root.rotation.y = -Math.PI / 2; grp.add(gh.root);
      this.gatehouse = gh; this._addCol(gh, gh.root);
      // the truck went through the boom barrier: it hangs snapped
      if (gh.anchors?.barrier) { gh.anchors.barrier.rotation.z = -0.62; gh.anchors.barrier.rotation.x = 0.25; }
      const sg = propM.buildSignGantry(); sg.root.position.set(0, 0, 27); grp.add(sg.root); this._addCol(sg, sg.root);
      for (const [x0, x1] of [[-82, -9.5], [9.5, 82]]) {
        const f = propM.buildFence(x1 - x0); f.root.position.set((x0 + x1) / 2, 0, GATE_Z); grp.add(f.root); this._addCol(f, f.root);
      }
      // side fences down the yard edges
      for (const x of [-82, 82]) { const f = propM.buildFence(200); f.root.position.set(x, 0, -70); f.root.rotation.y = Math.PI / 2; grp.add(f.root); }
      this.portaCabin = propM.buildPortaCabin?.(); if (this.portaCabin) { this.portaCabin.root.position.set(-24, 0, 24.5); this.portaCabin.root.rotation.y = Math.PI / 2; grp.add(this.portaCabin.root); this._addCol(this.portaCabin, this.portaCabin.root); }
    } else {
      const f = new THREE.Mesh(box(164, 2.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x777777, transparent: true, opacity: 0.4 })); f.position.set(0, 1.2, GATE_Z); grp.add(f);
    }
    this.col.add([-82, 0, GATE_Z - 0.15], [-9.5, 3, GATE_Z + 0.15], { kind: 'fence', mat: 'fence', thin: true });
    this.col.add([9.5, 0, GATE_Z - 0.15], [82, 3, GATE_Z + 0.15], { kind: 'fence', mat: 'fence', thin: true });
    // the wrecked pickup from level 1, buried in the barrier
    const pk = buildPickup();
    pk.root.position.set(-1.5, 0, 31.5); pk.root.rotation.set(0, 0.32, 0.02);
    pk.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    grp.add(pk.root);
    this.pickup = pk;
    this.col.add([-3.4, 0, 28.6], [0.6, 1.9, 34.6], { kind: 'truck', mat: 'metal' });
  }

  // ---------------------------------------------------------------- light masts
  _masts(propM) {
    const lm = propM?.buildLightMast?.();
    this.mastLamps = [];
    const glowBatch = new BillboardBatch(260, this.E.atlas, { boost: 1, renderOrder: 6, fog: this.scene.fog });
    this.glows = glowBatch; this.group.add(glowBatch.mesh);
    // far lights (skyline blinkers, far cranes, harbour ships, refinery): no fog, they sit past the fog range
    this.farGlowBatch = new BillboardBatch(240, this.E.atlas, { boost: 1, renderOrder: -20, fog: { color: new THREE.Color(0, 0, 0), near: 1e5, far: 2e5 } });
    this.group.add(this.farGlowBatch.mesh);
    this.farGlows = [];
    // recessed flood lenses: dark bezel, faceted reflector, hot centre (replaces the flat white panel)
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x48443e, emissive: 0xff9440, emissiveMap: lensTexture(), emissiveIntensity: 0, roughness: 0.22, metalness: 0.3 });
    lensMat.userData.duskEmissive = 2.4;
    this.lensMat = lensMat;
    MASTS.forEach(([x, z], mi) => {
      let lamps;
      if (lm) {
        const inst = mi === 0 ? lm : propM.buildLightMast();
        inst.root.position.set(x, 0, z); inst.root.rotation.y = (mi * 1.3) % (Math.PI * 2); this.group.add(inst.root);
        inst.root.traverse(o => { if (o.isMesh && Array.isArray(o.material) && o.material[3]?.userData?.duskEmissive !== undefined) { o.material = o.material.slice(); o.material[3] = lensMat; } });
        inst.root.updateMatrixWorld(true);
        lamps = (inst.anchors.lamps || []).map(p => p.clone().applyMatrix4(inst.root.matrixWorld));
        this._addCol(inst, inst.root);
      } else {
        const pole = new THREE.Mesh(cyl(0.18, 0.35, 30, 8), new THREE.MeshStandardMaterial({ color: 0x8a8a88, metalness: 0.7, roughness: 0.5 }));
        pole.position.set(x, 15, z); pole.castShadow = true; this.group.add(pole);
        lamps = []; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; lamps.push(new THREE.Vector3(x + Math.cos(a) * 1.2, 29.2, z + Math.sin(a) * 1.2)); }
        this.col.add([x - 0.6, 0, z - 0.6], [x + 0.6, 3, z + 0.6], { kind: 'mast', mat: 'metal' });
      }
      const mast = { x, z, lamps, k: 0, on: false, flick: 0, base: 1 };
      this.mastLamps.push(mast);
    });
    // light pools on the ground (additive decals, sodium orange) — the cheap PS2 trick
    const poolTex = poolTexture();
    const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffffff, toneMapped: true, fog: true, polygonOffset: true, polygonOffsetFactor: -4 });
    this.pools = new THREE.InstancedMesh(pg, pm, MASTS.length);
    this.pools.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MASTS.length * 3), 3);
    const m = new THREE.Matrix4();
    MASTS.forEach(([x, z], i) => { m.makeScale(44, 1, 44).setPosition(x, 0.03, z); this.pools.setMatrixAt(i, m); });
    this.pools.frustumCulled = false; this.pools.renderOrder = 3;
    this.group.add(this.pools);
    // two real point lights follow the nearest lit masts (fixed pool => no shader recompiles)
    this.sodium = (this.E.isQuest ? [0] : [0, 1]).map(() => { const l = new THREE.PointLight(0xff8a30, 0, 46, 1.4); this.scene.add(l); return l; });
  }

  // ---------------------------------------------------------------- explosive drums (positions only; game owns them)
  _drums(propM) { this.drumAssets = propM?.drumAssets?.() || null; }

  // ---------------------------------------------------------------- cranes
  _cranes(shipM) {
    this.quayCranes = [];
    if (shipM?.buildQuayCrane) {
      for (const [x, boom] of [[-48, 'down'], [46, 'up']]) {
        const c = shipM.buildQuayCrane({ boom }); c.root.position.set(x, 0, -124); this.group.add(c.root);
        c.root.updateMatrixWorld(true); this._addCol(c, c.root); this.quayCranes.push(c);

      }
    }
    if (shipM?.buildRTG) {
      const r = shipM.buildRTG(); r.root.position.set(RTG.x, 0, RTG.z); this.group.add(r.root);
      r.root.updateMatrixWorld(true); this._addCol(r, r.root); this.rtg = r;
    } else {
      // stand-in gantry
      const grp = new THREE.Group(); grp.position.set(RTG.x, 0, RTG.z);
      const mat = new THREE.MeshStandardMaterial({ color: 0xc8a020, metalness: 0.5, roughness: 0.5 });
      for (const x of [-11.5, 11.5]) for (const z of [-3.5, 3.5]) { const l = new THREE.Mesh(box(0.8, 19, 0.8), mat); l.position.set(x, 9.5, z); l.castShadow = true; grp.add(l); this.col.add([RTG.x + x - 0.6, 0, RTG.z + z - 0.6], [RTG.x + x + 0.6, 19, RTG.z + z + 0.6], { kind: 'rtg', mat: 'metal' }); }
      const beam = new THREE.Mesh(box(24, 1.6, 8), mat); beam.position.y = 19.5; beam.castShadow = true; grp.add(beam);
      const trolley = new THREE.Group(); trolley.position.y = 18.5; grp.add(trolley);
      const spreader = new THREE.Group(); grp.add(spreader);
      const cab = new THREE.Mesh(box(2, 2, 2), mat); trolley.add(cab); cab.position.y = -1.5;
      const r = { root: grp, spreader, cab, cabGlass: cab, cabSeat: cab, warnLight: trolley, setTrolley(x) { trolley.position.x = x; spreader.position.x = x; }, setHoist(y) { spreader.position.y = y; } };
      r.setTrolley(0); r.setHoist(14);
      this.group.add(grp); this.rtg = r;
    }
  }

  // ---------------------------------------------------------------- ship
  _ship(shipM) {
    if (shipM?.buildShip) {
      const s = shipM.buildShip(); this.group.add(s.root); this.ship = s;
      s.root.updateMatrixWorld(true);
      this._addCol(s, s.root, { deck: true });
      for (const w of (s.walk || [])) {
        if (w.type === 'box') this.col.walk.push({ type: 'box', x0: w.min[0], z0: w.min[1], x1: w.max[0], z1: w.max[1], y: w.y });
        else this.col.walk.push({ ...w });
      }
      for (const p of (s.anchors?.lights || [])) this.lampGlows.push({ p: p.isVector3 ? p.clone() : p.getWorldPosition(new THREE.Vector3()), size: 1.15, color: [1.9, 1.25, 0.6], dusk: true });
    } else {
      // stand-in hull + deck + gangway so the level is playable
      const hull = new THREE.Mesh(box(160, 13, 27), new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.6, metalness: 0.4 }));
      hull.position.set(-15, DECK_Y - 6.5, -166.5); hull.castShadow = hull.receiveShadow = true; this.group.add(hull);
      const sup = new THREE.Mesh(box(18, 16, 24), new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.6 }));
      sup.position.set(49, DECK_Y + 8, -166.5); sup.castShadow = true; this.group.add(sup);
      this.col.add([40, DECK_Y, -178.5], [58, DECK_Y + 16, -154.5], { kind: 'ship', mat: 'metal' });
      this.col.add([-95, DECK_Y, -176], [36, DECK_Y + 1.8, -157.6], { kind: 'hatch', mat: 'metal' });
      this.col.add([-95, 0, -153.4], [-6, DECK_Y + 1.1, -153.1], { kind: 'bulwark', mat: 'metal' });
      this.col.add([25, 0, -153.4], [65, DECK_Y + 1.1, -153.1], { kind: 'bulwark', mat: 'metal' });
      this.col.walk.push({ type: 'box', x0: -95, z0: -180, x1: 65, z1: -153.2, y: DECK_Y });
      this.col.walk.push({ type: 'ramp', x0: -2, x1: 22, y0: 0, y1: DECK_Y, z0: -152.9, z1: -151.1 });
      this.col.walk.push({ type: 'box', x0: 22, z0: -153.6, x1: 25, z1: -151.1, y: DECK_Y });
      const gw = new THREE.Mesh(box(24.6, 0.12, 1.8), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.6 }));
      gw.position.set(10, DECK_Y / 2, -152); gw.rotation.z = Math.atan2(DECK_Y, 24); this.group.add(gw);
      this.ship = { root: hull, anchors: { manifold: new THREE.Vector3(-6, DECK_Y, -155.5), gangwayBottom: new THREE.Vector3(-4, 0, -150), gangwayTop: new THREE.Vector3(23.5, DECK_Y, -152) } };
    }
    // the gangway foot sits on a landing that bridges the quay edge (no stepping into the gap)
    this.col.walk.push({ type: 'box', x0: -6, z0: -152.9, x1: -1.95, z1: -150.8, y: 0 });
    // gangway handrails as colliders (keep walkers on the ramp)
    this.col.add([-2, 0, -153.1], [22, DECK_Y + 1.2, -152.95], { kind: 'rail', noBullet: true, noStand: true });
    this.col.add([-2, 0, -151.05], [25, DECK_Y + 1.2, -150.9], { kind: 'rail', noBullet: true, noStand: true, rampRail: true });
  }

  // ---------------------------------------------------------------- far shore / backdrop
  _far() {
    const far = new THREE.Group(); this.group.add(far); this.far = far;
    // shore band, skyline layers, ridges, far terminal cranes, refinery, anchored ships: one draw call (far.js)
    const F = buildFar({ waterY: WATER_Y });
    far.add(F.mesh); this.farMesh = F;
    this.farGlows = F.glows;
    this.flarePos = F.flare;
    // behind the gate: warehouses / port buildings (warehouses.js)
    const wh = buildWarehouses({ seed: 91, z0: 80, skipX: 20 });
    this.group.add(wh.root); this.warehouses = wh;
  }
  // more port either side of the yard: container stacks and quay cranes on the extended apron (cheap, one mesh)
  _sidePort() {
    const parts = [], r = makeRng(313);
    const PAL = [[0.55, 0.16, 0.1], [0.12, 0.25, 0.45], [0.18, 0.36, 0.24], [0.68, 0.36, 0.1], [0.42, 0.43, 0.44], [0.36, 0.12, 0.15], [0.16, 0.42, 0.42], [0.78, 0.74, 0.66]];
    const add = (g, col, dark = 0.55) => { // vertex colours: darker toward the ground (fake AO)
      const p = g.attributes.position, cc = new Float32Array(p.count * 3); g.computeBoundingBox(); const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
      for (let i = 0; i < p.count; i++) { const k = y1 - y0 > 3 ? dark + (1 - dark) * Math.min(1, (p.getY(i) - y0) / 3) : 1; cc[i * 3] = col[0] * k; cc[i * 3 + 1] = col[1] * k; cc[i * 3 + 2] = col[2] * k; }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); parts.push(g);
    };
    for (const side of [-1, 1]) {
      // container blocks beyond the perimeter fence
      for (let bx = 0; bx < 5; bx++) for (let bz = 0; bz < 4; bz++) {
        const x0 = side * (96 + bx * 34), z0 = -8 - bz * 32;
        for (let row = 0; row < 6; row++) for (let k = 0; k < 2; k++) {
          const h = 1 + Math.floor(r() * 4), x = x0 + side * row * CW, z = z0 - k * 12.6;
          for (let t = 0; t < h; t++) { const c = PAL[Math.floor(r() * PAL.length)], v = 0.8 + r() * 0.35; add(at(box(CW - 0.05, CH - 0.04, C40, 2.6), x, t * CH + CH / 2, z), [c[0] * v, c[1] * v, c[2] * v], 0.6); }
        }
      }
      // quay cranes on the extended waterfront (portal + boom), red like the hero cranes
      for (const cx of side > 0 ? [128, 212] : [-142, -226]) {
        const red = [0.62, 0.1, 0.07], up = r() < 0.5, steel = [0.4, 0.4, 0.42];
        for (const lx of [-9, 9]) for (const lz of [-124, -149]) add(at(box(1.4, 38, 1.4), cx + lx, 19, lz), red);
        add(at(box(20, 2.2, 2.2), cx, 30, -124), red); add(at(box(20, 2.2, 2.2), cx, 30, -149), red);
        for (const lx of [-9, 9]) add(at(box(2.2, 2.4, 27), cx + lx, 30, -136.5), red);
        add(at(box(1.6, 22, 1.6), cx - 4, 52, -134), red); add(at(box(1.6, 22, 1.6), cx + 4, 52, -134), red); add(at(box(9.6, 1.4, 1.6), cx, 63, -134), red);
        // boom girder (lowered: out over the water; raised: back-reach only + a boom angled up), machinery house on the back-reach
        if (up) { add(at(box(3.2, 2.6, 34), cx, 41, -121), red); add(at(box(2.4, 2.4, 62), cx, 62, -165, 0.78), red); }
        else add(at(box(3.2, 2.6, 96), cx, 41, -158), red);
        for (const lz of [-124, -147]) for (const lx of [-1.4, 1.4]) add(at(box(0.8, 10, 0.8), cx + lx, 35.5, lz), red);
        add(at(box(9, 6, 13), cx, 45.3, -116), steel);
        add(at(box(3.5, 4, 5), cx, 37.7, up ? -128 : -168), [0.8, 0.78, 0.7]);
        this.lampGlows.push({ p: new THREE.Vector3(cx, 64.2, -134), size: 2.2, color: [2.4, 0.16, 0.05], blink: true, dusk: true });
        if (!up) for (let k = 0; k < 3; k++) this.lampGlows.push({ p: new THREE.Vector3(cx, 39.4, -150 - k * 16), size: 1.6, color: [1.6, 0.9, 0.36], dusk: true });
      }
    }
    const g = merge(parts);
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: ribTexture(), vertexColors: true, roughness: 0.7, metalness: 0.35, envMapIntensity: 0.5 }));
    mesh.castShadow = false; mesh.receiveShadow = true; this.group.add(mesh); this.sidePort = mesh;
  }

  // invisible yard bounds
  _walls() {
    this.col.add([-60, 0, -152], [-56.5, 12, 30], { kind: 'bound', noBullet: true });
    this.col.add([56.5, 0, -152], [60, 12, 30], { kind: 'bound', noBullet: true });
    this.col.add([-60, 0, 40], [60, 12, 44], { kind: 'bound', noBullet: true });
    this.col.add([-70, 0, -152], [-60, 12, 40], { kind: 'bound', noBullet: true });
    this.col.add([60, 0, -152], [70, 12, 40], { kind: 'bound', noBullet: true });
    // the road out of the gate is a dead end at the wreck
    this.col.add([-9.5, 0, 36], [9.5, 4, 37], { kind: 'bound', noBullet: true });
  }

  _addCol(obj, root, data = {}) {
    if (!obj?.colliders?.length) return;
    root.updateMatrixWorld(true);
    obj.boxes = this.col.addFromObject(obj.colliders, root.matrixWorld, { mat: 'metal', ...data });
  }
  _collectDusk(root) {
    root.traverse(o => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) if (m.userData && m.userData.duskEmissive !== undefined && !this.duskMats.includes(m)) { this.duskMats.push(m); m.emissiveIntensity = 0; }
    });
  }

  // ---------------------------------------------------------------- per frame
  update(dt, head, dusk, lights) {
    this.time += dt;
    const t = this.time;
    this.waterFx?.update(dt, t);
    for (const c of this.quayCranes) c.update?.(dt, t);
    this.rtg?.update?.(dt, t);
    this.ship?.update?.(dt, t);
    this.far.position.set(head.x * 0.9, 0, head.z * 0.9);
    // emissive windows / signs come up with the dusk
    const em = THREE.MathUtils.smoothstep(dusk, 0.1, 0.7);
    for (const m of this.duskMats) m.emissiveIntensity = m.userData.burnt ? 0 : m.userData.duskEmissive * (0.15 + 0.85 * em);
    // the sun's lens flare fades once the sun is down; the skyline lifts into the blue haze
    if (this.E.flare) { const fk = 1 - THREE.MathUtils.smoothstep(dusk, 0.4, 0.78); this.E.flare.traverse(o => { if (o.material) { o.material.userData.o0 ??= o.material.opacity; o.material.opacity = o.material.userData.o0 * fk; } }); this.E.flare.visible = fk > 0.01; }
    // masts: per-mast on/off state is driven by the level (flicker on in sequence)
    let gi = 0;
    const G = this.glows, poolCol = this.pools.instanceColor;
    const nearest = [];
    this.mastLamps.forEach((ms, i) => {
      if (ms.on && ms.k < 1) ms.k = Math.min(1, ms.k + dt * 0.35); // sodium warm-up
      let k = ms.on ? ms.k : 0;
      if (ms.on && ms.flick > 0) { ms.flick -= dt; k *= (Math.sin(t * 61 + i) > 0.1 ? 1 : 0.15) * (Math.sin(t * 13 + i * 3) > -0.6 ? 1 : 0); }
      ms.cur = k;
      const kk = k * (0.35 + 0.65 * Math.min(1, dusk * 1.6));
      poolCol.setXYZ(i, SODIUM[0] * kk * 0.2, SODIUM[1] * kk * 0.2, SODIUM[2] * kk * 0.2);
      // sodium floods: a small hot core + a soft tinted halo (no hard white discs)
      if (k > 0.01) for (const p of ms.lamps) if (gi < G.max - 2) {
        G.set(gi++, p.x, p.y, p.z, 0.7, 0.7, 0, CELL.SPARK, 0, 1.9 * k, 1.05 * k, 0.42 * k, 1);
        G.set(gi++, p.x, p.y, p.z, 3.2, 3.2, 0, CELL.GLOW, 0, 0.55 * k, 0.22 * k, 0.05 * k, 0.8 * k);
      }
      if (k > 0.05) nearest.push([ms, (ms.x - head.x) ** 2 + (ms.z - head.z) ** 2]);
    });
    poolCol.needsUpdate = true;
    for (const L of this.lampGlows) {
      if (gi >= G.max - 2) break;
      let a = L.dusk ? Math.min(1, dusk * 1.5) : 1;
      if (L.blink && Math.sin(t * 2.6 + (L.phase ?? L.p.x)) < 0.35) a *= 0.06;
      if (a < 0.01) continue;
      const c = L.color, s = L.size;
      G.set(gi++, L.p.x, L.p.y, L.p.z, s * 0.4, s * 0.4, 0, CELL.SPARK, 0, c[0] * a * 0.9, c[1] * a * 0.9, c[2] * a * 0.9, a);
      G.set(gi++, L.p.x, L.p.y, L.p.z, s * 1.6, s * 1.6, 0, CELL.GLOW, 0, c[0] * a * 0.22, c[1] * a * 0.16, c[2] * a * 0.12, 0.8 * a);
    }
    G.commit(gi);
    // far lights ride with the far group (it follows the head for parallax)
    const FG = this.farGlowBatch, fo = this.far.position; let fi = 0;
    for (const L of this.farGlows) {
      if (fi >= FG.max - 2) break;
      let a = L.blink ? 0.35 + 0.65 * Math.min(1, dusk * 1.6) : Math.min(1, 0.15 + dusk * 1.4);
      if (L.blink && Math.sin(t * 2.4 + L.phase) < 0.4) a *= 0.04;
      if (a < 0.01) continue;
      FG.set(fi++, L.p.x + fo.x, L.p.y + fo.y, L.p.z + fo.z, L.size, L.size, 0, CELL.GLOW, 0, L.color[0] * a, L.color[1] * a, L.color[2] * a, 0.9 * a);
    }
    // refinery flare
    if (this.flarePos && fi < FG.max) { const f = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.7); FG.set(fi++, this.flarePos.x + fo.x, this.flarePos.y + 6 + fo.y, this.flarePos.z + fo.z, 16 * f, 26 * f, 0, CELL.GLOW, 0, 3, 1.3 * f, 0.35, 1); }
    FG.commit(fi);
    // real lights on the two nearest lit masts
    nearest.sort((a, b) => a[1] - b[1]);
    this.sodium.forEach((l, i) => {
      const n = nearest[i];
      if (!n) { l.intensity = 0; return; }
      l.position.set(n[0].x, 22, n[0].z);
      l.intensity = 110 * n[0].cur * (0.3 + 0.7 * Math.min(1, dusk * 1.6));
    });
  }
}

// =====================================================================================
//  canvas textures for the yard
// =====================================================================================
function asphaltTexture() {
  const S = 512, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S);
  const n = T.makeNoise(301, 64), n2 = T.makeNoise(302, 16), r = makeRng(303);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const m = T.fbm(n, u, v, 4, 5), g = r();
    let b = 0.36 + (m - 0.5) * 0.18 + (g - 0.5) * 0.16;
    const stain = Math.max(0, T.fbm(n2, u, v, 3, 3) - 0.62) * 1.4; b -= stain * 0.22;   // oil / water stains
    const crack = Math.abs(T.fbm(n, u * 2 + 0.3, v * 2 + 0.7, 3, 4) - 0.5) < 0.006 ? 0.4 : 0;
    b -= crack * 0.25;
    const i = (y * S + xx) * 4;
    img.data[i] = b * 255 * 1.02; img.data[i + 1] = b * 255; img.data[i + 2] = b * 255 * 0.96; img.data[i + 3] = 255;
    h[y * S + xx] = g * 0.6 + m * 0.4 - crack;
  }
  x.putImageData(img, 0, 0);
  return { map: T.canvasTex(c), normal: T.heightToNormal(h, S, S, 2.2) };
}
function wornPaintTexture() {
  // worn road paint: broken edges, tyre-worn bald patches, grime in the rgb (never a clean white ribbon)
  const W = 256, H = 32, c = T.makeCanvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), n = T.makeNoise(55, 16), n2 = T.makeNoise(56, 8);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const u = xx / W, v = y / H;
    const edge = 1 - Math.pow(Math.abs(v - 0.5) * 2, 4 + 3 * T.fbm(n2, u, 0.5, 8, 2));
    const wear = Math.min(1, Math.max(0, (T.fbm(n, u, v, 8, 3) - 0.34) * 3.2));
    const bald = Math.min(1, Math.max(0, (T.fbm(n2, u, v * 0.25, 8, 2) - 0.3) * 4));
    const a = Math.max(0, edge) * wear * (0.35 + 0.65 * bald);
    const g = 0.72 + 0.28 * T.fbm(n, u * 3 + 0.3, v * 3, 16, 3);
    const i = (y * W + xx) * 4; img.data[i] = g * 255; img.data[i + 1] = g * 250; img.data[i + 2] = g * 238; img.data[i + 3] = a * 215;
  }
  x.putImageData(img, 0, 0);
  const t = T.canvasTex(c); return t;
}
function quayWallTexture() {
  // 4 m x 4 m tile of the quay wall face: v = 0 at y -4, water at y -2.2 (v 0.45). Dry concrete with formwork
  // joints and rust tears on top, a dark wet tidal band, green-black weed + barnacles at and below the waterline.
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(4401, 8), n2 = T.makeNoise(4402, 32), r = makeRng(4403);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = 1 - y / S, wy = -4 + v * 4;           // world y of this texel
    const f = T.fbm(n, u, v, 8, 4), f2 = T.fbm(n2, u, v, 32, 3);
    let rr = 0.62 + (f - 0.5) * 0.25 + (f2 - 0.5) * 0.1, gg = rr * 0.97, bb = rr * 0.92;
    if ((Math.round(wy * 2) / 2 - wy) ** 2 < 0.0004 && wy > -2) { rr *= 0.7; gg *= 0.7; bb *= 0.7; } // formwork lift joints every 0.5 m
    // wet band: ragged top edge ~ y -1.1 .. -1.5
    const wetTop = -1.3 + (T.fbm(n, u * 2, 0.3, 8, 3) - 0.5) * 0.6;
    const wet = 1 - Math.min(1, Math.max(0, (wy - wetTop) / 0.25));
    const mix = (a, b, k) => a + (b - a) * k;
    rr = mix(rr, rr * 0.32, wet); gg = mix(gg, gg * 0.34, wet); bb = mix(bb, bb * 0.33, wet);
    // weed / algae from just above the waterline down
    const weedTop = -2.0 + (f2 - 0.5) * 0.35;
    const weed = 1 - Math.min(1, Math.max(0, (wy - weedTop) / 0.2));
    rr = mix(rr, 0.06 + f2 * 0.05, weed); gg = mix(gg, 0.09 + f2 * 0.07, weed); bb = mix(bb, 0.06 + f2 * 0.03, weed);
    if (weed > 0.5 && f2 > 0.62 && wy > -2.6) { rr = 0.42; gg = 0.4; bb = 0.35; } // barnacles
    const i = (y * S + xx) * 4; img.data[i] = rr * 255; img.data[i + 1] = gg * 255; img.data[i + 2] = bb * 255; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // rust tears running down from the coping fixings
  for (let k = 0; k < 18; k++) { const sx = r() * S, L = 20 + r() * 70, g = x.createLinearGradient(0, 2, 0, 2 + L); g.addColorStop(0, `rgba(110,52,20,${0.25 + r() * 0.3})`); g.addColorStop(1, 'rgba(110,52,20,0)'); x.fillStyle = g; x.fillRect(sx, 2, 1.5 + r() * 2.5, L); }
  return T.canvasTex(c);
}
function hazardTexture() {
  const c = T.makeCanvas(64, 16), x = c.getContext('2d');
  x.fillStyle = '#d9a514'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#151311';
  for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 16, 16); x.lineTo(i * 16 + 8, 16); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, 0); x.fill(); }
  return T.canvasTex(c);
}
function ribTexture() {
  // corrugated container side (2.6 m tile): ribs, a darker top/bottom rail, rust speckle; greyscale (tinted by vertex colour)
  const S = 64, c = T.makeCanvas(S, S), x = c.getContext('2d'), r = makeRng(5150);
  for (let i = 0; i < S; i++) { const k = i % 4 < 2 ? 228 : 180; x.fillStyle = `rgb(${k},${k},${k})`; x.fillRect(i, 0, 1, S); }
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, S, 3); x.fillRect(0, S - 3, S, 3);
  for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(90,45,20,${0.1 + r() * 0.2})`; x.fillRect(r() * S, r() * S, 1 + r() * 2, 2 + r() * 8); }
  return T.canvasTex(c);
}
function lensTexture() {
  // flood lens (emissive map): dark bezel, a faceted reflector grid, hot core falling off softly
  const S = 64, c = T.makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S * 0.46);
  g.addColorStop(0, 'rgb(255,250,235)'); g.addColorStop(0.25, 'rgb(240,170,90)'); g.addColorStop(0.7, 'rgb(110,55,20)'); g.addColorStop(1, 'rgb(20,10,4)');
  x.fillStyle = g; x.fillRect(6, 7, S - 12, S - 14);
  x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 1;
  for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(6 + i * (S - 12) / 6, 7); x.lineTo(6 + i * (S - 12) / 6, S - 7); x.stroke(); }
  for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(6, 7 + i * (S - 14) / 4); x.lineTo(S - 6, 7 + i * (S - 14) / 4); x.stroke(); }
  return T.canvasTex(c, { repeat: false });
}
function poolTexture() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(0.7, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return T.canvasTex(c, { repeat: false });
}
