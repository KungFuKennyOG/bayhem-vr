import * as THREE from 'three';
import * as T from '../../textures.js';
import { box, at, cyl, merge, mergeGrouped } from '../../geom.js';
import { makeRng } from '../../rng.js';
import { BillboardBatch, CELL } from '../../particles.js';
import { SUN_DIR } from '../../atmosphere.js';
import { CollisionWorld, NavGrid } from '../../collision.js';
import { buildPickup } from '../../vehicles.js';
import { CW, CH, C40, C20, QUAY_Z, WATER_Y, DECK_Y, YARD, COLUMNS, MAIN_AISLE, MASTS, DRUMS, GATE_Z, RTG, buildContainerList } from './layout.js';

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
    this._quay(propM);
    this._gate(propM);
    this._masts(propM);
    this._drums(propM);
    this._cranes(craneM);
    this._ship(shipM);
    this._far();
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
    this.navDeck = new NavGrid(this.col, { x0: -90, z0: -179, x1: 62, z1: -153.2, y: DECK_Y, cell: 1, clearance: 0.4, walkable: (x, z) => Math.abs(this.col.groundAt(x, z, DECK_Y + 0.3, 0.3) - DECK_Y) < 0.2 });
  }

  // ---------------------------------------------------------------- ground
  _ground() {
    const aniso = this.aniso;
    // asphalt (yard): tiled detail + a painted-markings overlay
    const asph = asphaltTexture(); asph.map.anisotropy = aniso; asph.map.repeat.set(160 / 9, 150 / 9); asph.normal.repeat.copy(asph.map.repeat);
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(160, 150), new THREE.MeshStandardMaterial({ map: asph.map, normalMap: asph.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.82, metalness: 0, color: 0xb8aea4, envMapIntensity: 0.6 }));
    yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0, 40 - 75); yard.receiveShadow = true;
    this.group.add(yard);
    // concrete apron (quay)
    const conc = T.concreteTexture(31, [0.66, 0.63, 0.58], 512, false); conc.anisotropy = aniso; conc.repeat.set(160 / 7, 41 / 7);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(160, 41), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.88, color: 0xc9bfb2, envMapIntensity: 0.5 }));
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, 0.005, QUAY_Z + 20.5); apron.receiveShadow = true;
    this.group.add(apron);
    // road outside the gate + verge
    const road = new THREE.Mesh(new THREE.PlaneGeometry(18, 260), new THREE.MeshStandardMaterial({ map: asph.map.clone(), roughness: 0.8, color: 0x9c948c }));
    road.material.map.repeat.set(2, 30); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.004, GATE_Z + 130); road.receiveShadow = true;
    this.group.add(road);
    const verge = new THREE.Mesh(new THREE.PlaneGeometry(700, 400), new THREE.MeshLambertMaterial({ map: T.groundTexture(), color: 0x8a7a66 }));
    verge.material.map.repeat.set(50, 30); verge.rotation.x = -Math.PI / 2; verge.position.set(0, -0.03, GATE_Z + 200); verge.receiveShadow = true;
    this.group.add(verge);
    // painted markings: one merged mesh of thin quads (yellow lane lines, white block numbers, hatched walkways)
    this._markings();
  }
  _markings() {
    const r = makeRng(77);
    const lines = [];
    const quad = (x0, z0, x1, z1, w, u0 = 0, u1 = 1) => { // strip from (x0,z0) to (x1,z1)
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), nx = -dz / L * w / 2, nz = dx / L * w / 2;
      lines.push([x0 + nx, z0 + nz, x0 - nx, z0 - nz, x1 + nx, z1 + nz, x1 - nx, z1 - nz, L, u0, u1]);
    };
    // lane edges along the main aisle and the block faces
    for (const [x0] of Object.values(COLUMNS)) for (const xs of [x0 - 0.5]) quad(xs, 12, xs, -110, 0.14, 0, 0);
    quad(MAIN_AISLE.x0 + 0.6, 26, MAIN_AISLE.x0 + 0.6, -112, 0.16, 0, 0); quad(MAIN_AISLE.x1 - 0.6, 26, MAIN_AISLE.x1 - 0.6, -112, 0.16, 0, 0);
    // dashed centre line
    for (let z = 24; z > -110; z -= 6) quad(0.1, z, 0.1, z - 3, 0.14, 0.25, 0.25);
    // cross aisle stop lines
    for (const z of [-24.0, -31.6, -67.0, -74.6]) quad(-60, z, 60, z, 0.18, 0, 0);
    // quay: yellow safety line 2 m from the edge, crane rail markings
    quad(-80, QUAY_Z + 2, 80, QUAY_Z + 2, 0.22, 0, 0);
    const pos = [], uv = [], col = [], idx = [];
    lines.forEach((l, i) => {
      const y = 0.012;
      pos.push(l[0], y, l[1], l[2], y, l[3], l[4], y, l[5], l[6], y, l[7]);
      const v = l[9];
      uv.push(v, 0, v, 1, v + (l[8] / 4), 0, v + (l[8] / 4), 1);
      const c = l[9] === 0.25 ? [0.95, 0.92, 0.85] : [0.95, 0.68, 0.12];
      for (let k = 0; k < 4; k++) col.push(...c);
      const a = i * 4; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: wornPaintTexture(), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true; m.renderOrder = 1;
    this.group.add(m);
    // block IDs painted at the aisle ends ("C-07" style)
    const ids = [];
    for (const [name, [x0, rows]] of Object.entries(COLUMNS)) for (const z of [9.5, -33.5, -76.5]) ids.push([name + '-' + String(Math.abs(Math.round(z / 3)) + 1).padStart(2, '0'), x0 + rows * CW / 2, z + 3.5]);
    for (const [txt, x, z] of ids) {
      const t = T.textTexture(txt, { font: 'Anton', size: 120, color: 'rgba(240,236,226,0.85)', stroke: 0, glow: null, padding: 10 });
      const mm = new THREE.Mesh(new THREE.PlaneGeometry(3.2 * t.aspect / 2, 1.6), new THREE.MeshStandardMaterial({ map: t.texture, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, opacity: 0.8 }));
      mm.rotation.x = -Math.PI / 2; mm.position.set(x, 0.015, z); mm.renderOrder = 2;
      this.group.add(mm);
    }
  }

  // ---------------------------------------------------------------- water
  _water() {
    const nrm = waterNormal(); nrm.repeat.set(60, 40);
    this.waterNormal = nrm;
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c1a20, roughness: 0.06, metalness: 0.15, normalMap: nrm, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.5 });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1400), mat);
    w.rotation.x = -Math.PI / 2; w.position.set(0, WATER_Y, QUAY_Z - 700);
    w.receiveShadow = true;
    this.water = w; this.group.add(w);
    // second normal layer drifting the other way
    this.waterNormal2 = nrm;
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
    // quay wall face down to the water, coping strip, fender panels
    const conc = T.concreteTexture(44, [0.6, 0.58, 0.54], 256, true); conc.repeat.set(40, 1);
    const wallMat = new THREE.MeshStandardMaterial({ map: conc, roughness: 0.9, color: 0xa39a90 });
    const wall = new THREE.Mesh(box(170, 4, 1.2), wallMat); wall.position.set(-5, -2.0, QUAY_Z - 0.6); wall.receiveShadow = true; this.group.add(wall);
    const coping = new THREE.Mesh(box(170, 0.35, 0.7), new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.85 }));
    coping.position.set(-5, 0.175, QUAY_Z + 0.35); coping.castShadow = coping.receiveShadow = true; this.group.add(coping);
    // yellow/black edge band
    const band = new THREE.Mesh(box(170, 0.1, 0.72), new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6 }));
    band.material.map.repeat.set(60, 1); band.position.set(-5, 0.36, QUAY_Z + 0.35); this.group.add(band);
    const fenders = [];
    for (let x = -88; x <= 78; x += 9) fenders.push(at(box(1.8, 2.4, 0.5), x, -1.0, QUAY_Z - 1.4));
    const fm = new THREE.Mesh(merge(fenders), new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.75 })); fm.castShadow = true; this.group.add(fm);
    // crane rails (steel strips set in the concrete)
    const rails = [];
    for (const z of [-124, -149]) for (const dz of [-0.4, 0.4]) rails.push(at(box(175, 0.05, 0.09), -5, 0.02, z + dz));
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
    const glowBatch = new BillboardBatch(200, this.E.atlas, { boost: 1, renderOrder: 6, fog: this.scene.fog });
    this.glows = glowBatch; this.group.add(glowBatch.mesh);
    MASTS.forEach(([x, z], mi) => {
      let lamps;
      if (lm) {
        const inst = mi === 0 ? lm : propM.buildLightMast();
        inst.root.position.set(x, 0, z); inst.root.rotation.y = (mi * 1.3) % (Math.PI * 2); this.group.add(inst.root);
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
        const wp = (p) => (p.isVector3 ? p.clone().applyMatrix4(c.root.matrixWorld) : p.getWorldPosition(new THREE.Vector3()));
        for (const p of (c.anchors?.warn || [])) this.lampGlows.push({ p: wp(p), size: 1.8, color: [2.6, 0.25, 0.1], blink: true });
        for (const p of (c.anchors?.flood || [])) this.lampGlows.push({ p: wp(p), size: 2.6, color: [2.2, 1.9, 1.5], dusk: true });
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
      for (const p of (s.anchors?.lights || [])) this.lampGlows.push({ p: p.isVector3 ? p.clone() : p.getWorldPosition(new THREE.Vector3()), size: 2.2, color: [2.0, 1.6, 1.1], dusk: true });
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
    const sunYaw = Math.atan2(SUN_DIR.x, SUN_DIR.z);
    // hills ridge around (vertex-colored, unfogged so it keeps its sunset tint)
    const ridge = (radius, height, seed, k0, k1, jag, arc0 = 0, arc = Math.PI * 2) => {
      const r = makeRng(seed), seg = 220, pos = [], colr = [], idx = [], hs = [];
      let h = 0.5;
      for (let i = 0; i <= seg; i++) { h += (r() - 0.5) * jag; h = Math.max(0.05, Math.min(1, h)); hs.push(h); }
      for (let p = 0; p < 2; p++) for (let i = 1; i < seg; i++) hs[i] = (hs[i - 1] + hs[i] * 2 + hs[i + 1]) / 4;
      for (let i = 0; i <= seg; i++) {
        const a = arc0 + (i / seg) * arc, x = Math.cos(a) * radius, z = Math.sin(a) * radius;
        pos.push(x, -20, z, x, hs[i] * height, z);
        const d = Math.max(0, (Math.cos(a) * SUN_DIR.x + Math.sin(a) * SUN_DIR.z) / Math.hypot(SUN_DIR.x, SUN_DIR.z)), s = Math.pow(d, 3);
        const hz = [0.86 + 1.44 * s, 0.5 + 0.45 * s, 0.36];
        colr.push(hz[0] * k0, hz[1] * k0, hz[2] * k0 * 1.15, hz[0] * k1, hz[1] * k1, hz[2] * k1 * 1.2);
      }
      for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
      m.renderOrder = -40; m.userData.farTint = true; far.add(m); return m;
    };
    this.ridges = [ridge(2100, 260, 7, 0.62, 0.72, 0.2), ridge(1700, 140, 13, 0.44, 0.52, 0.28)];
    // skyline across the harbour (toward the sun) and behind the port
    const mkSky = (radius, height, arcStart, arcLen, tex, y, tint) => {
      const g = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true, arcStart, arcLen);
      const mt = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.BackSide, fog: false, color: tint });
      const mesh = new THREE.Mesh(g, mt); mesh.position.y = height / 2 - 8 + y; mesh.renderOrder = -30; far.add(mesh); return mesh;
    };
    const t1 = T.skylineTexture(5); t1.repeat.set(2, 1);
    this.skyline = [mkSky(1150, 170, sunYaw + Math.PI / 2 - 0.9, 1.8, t1, 0, 0xb38a78)];
    const t2 = T.skylineTexture(23); t2.repeat.set(3, 1);
    this.skyline.push(mkSky(900, 80, sunYaw - Math.PI / 2 - 1.2, 2.4, t2, -2, 0x7c6a72));
    // refinery flare stacks + distant cranes on the far shore (simple silhouettes, unfogged dark)
    const sil = [];
    const rr = makeRng(5);
    for (let i = 0; i < 14; i++) { // distant STS cranes
      const x = -520 + i * 70 + rr() * 30, z = -760 - rr() * 60, s = 0.9 + rr() * 0.3;
      sil.push(at(box(1.2 * s, 46 * s, 1.2 * s), x - 9 * s, 23 * s, z), at(box(1.2 * s, 46 * s, 1.2 * s), x + 9 * s, 23 * s, z));
      const up = rr() < 0.4;
      sil.push(up ? at(box(2 * s, 70 * s, 2.4 * s), x, 75 * s, z + 12 * s, 0.25) : at(box(2.2 * s, 2.4 * s, 110 * s), x, 44 * s, z + 10 * s));
      sil.push(at(box(20 * s, 3 * s, 4 * s), x, 30 * s, z), at(box(1.4 * s, 26 * s, 1.4 * s), x, 60 * s, z - 6 * s));
    }
    for (let i = 0; i < 6; i++) { const x = 300 + i * 26, z = -820 - i * 10; sil.push(at(cyl(2.5, 3, 60 + i * 8, 8), x, 30 + i * 4, z)); }
    for (let i = 0; i < 9; i++) { const x = 180 + i * 22, z = -800; sil.push(at(cyl(9, 9, 18, 14), x, 9, z)); } // tank farm
    const silMat = new THREE.MeshBasicMaterial({ color: 0x2a2026, fog: true });
    this.silMat = silMat;
    const sm = new THREE.Mesh(merge(sil), silMat); far.add(sm);
    this.flarePos = new THREE.Vector3(326, 118, -870);
    // a few anchored ships out in the harbour (dark hulls with deck lights)
    const ships = [];
    for (const [x, z, L] of [[-320, -520, 140], [140, -460, 110], [520, -640, 180], [-640, -700, 200]]) {
      ships.push(at(box(L, 10, L * 0.16), x, WATER_Y + 3, z), at(box(L * 0.14, 14, L * 0.15), x + L * 0.38, WATER_Y + 14, z));
      for (let k = 0; k < 5; k++) this.lampGlows.push({ p: new THREE.Vector3(x - L * 0.4 + k * L * 0.2, WATER_Y + 9 + (k === 4 ? 12 : 0), z), size: 6, color: [2.0, 1.7, 1.2], dusk: true, far: true });
    }
    far.add(new THREE.Mesh(merge(ships), silMat));
    // behind the gate: warehouses / port buildings (fogged, simple)
    const bl = [], br = makeRng(91);
    for (let i = 0; i < 12; i++) { const x = -150 + i * 26 + br() * 8, z = 80 + br() * 60, w = 18 + br() * 16, h = 8 + br() * 14; if (Math.abs(x) < 20) continue; bl.push(at(box(w, h, 20 + br() * 20), x, h / 2, z)); }
    const bm = new THREE.Mesh(merge(bl), new THREE.MeshStandardMaterial({ color: 0x8c8580, roughness: 0.9 }));
    bm.castShadow = true; this.group.add(bm);
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
    if (this.waterNormal) { this.waterNormal.offset.set(t * 0.004, t * 0.009); }
    this.far.position.set(head.x * 0.9, 0, head.z * 0.9);
    // emissive windows / signs come up with the dusk
    const em = THREE.MathUtils.smoothstep(dusk, 0.1, 0.7);
    for (const m of this.duskMats) m.emissiveIntensity = m.userData.duskEmissive * (0.15 + 0.85 * em);
    this.silMat.color.setRGB(0.16 - 0.1 * dusk, 0.125 - 0.08 * dusk, 0.15 - 0.07 * dusk);
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
      poolCol.setXYZ(i, SODIUM[0] * kk * 0.32, SODIUM[1] * kk * 0.32, SODIUM[2] * kk * 0.32);
      for (const p of ms.lamps) if (gi < G.max - 1) G.set(gi++, p.x, p.y, p.z, 3.2, 3.2, 0, CELL.GLOW, 0, 2.6 * k, 1.5 * k, 0.5 * k, 0.9 * k);
      if (k > 0.05) nearest.push([ms, (ms.x - head.x) ** 2 + (ms.z - head.z) ** 2]);
    });
    poolCol.needsUpdate = true;
    for (const L of this.lampGlows) {
      if (gi >= G.max - 1) break;
      let a = L.dusk ? Math.min(1, dusk * 1.5) : 1;
      if (L.blink && Math.sin(t * 4 + L.p.x) < 0.2) a *= 0.1;
      G.set(gi++, L.p.x, L.p.y, L.p.z, L.size, L.size, 0, CELL.GLOW, 0, L.color[0] * a, L.color[1] * a, L.color[2] * a, 0.85 * a);
    }
    // refinery flare
    if (gi < G.max) { const f = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.7); G.set(gi++, this.flarePos.x, this.flarePos.y + 5, this.flarePos.z, 22 * f, 34 * f, 0, CELL.GLOW, 0, 3, 1.3 * f, 0.35, 1); }
    G.commit(gi);
    // real lights on the two nearest lit masts
    nearest.sort((a, b) => a[1] - b[1]);
    this.sodium.forEach((l, i) => {
      const n = nearest[i];
      if (!n) { l.intensity = 0; return; }
      l.position.set(n[0].x, 16, n[0].z);
      l.intensity = 260 * n[0].cur * (0.3 + 0.7 * Math.min(1, dusk * 1.6));
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
  const W = 256, H = 32, c = T.makeCanvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), n = T.makeNoise(55, 32);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const a = Math.min(1, Math.max(0, (T.fbm(n, xx / W, y / H, 8, 4) - 0.32) * 3.5)) * (1 - Math.pow(Math.abs(y / H - 0.5) * 2, 6));
    const i = (y * W + xx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 235;
  }
  x.putImageData(img, 0, 0);
  const t = T.canvasTex(c); return t;
}
function hazardTexture() {
  const c = T.makeCanvas(64, 16), x = c.getContext('2d');
  x.fillStyle = '#d9a514'; x.fillRect(0, 0, 64, 16); x.fillStyle = '#151311';
  for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 16, 16); x.lineTo(i * 16 + 8, 16); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, 0); x.fill(); }
  return T.canvasTex(c);
}
function poolTexture() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(0.7, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return T.canvasTex(c, { repeat: false });
}
function waterNormal() {
  const S = 256, h = new Float32Array(S * S), n = T.makeNoise(410, 32), n2 = T.makeNoise(411, 64);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    h[y * S + x] = T.fbm(n, u, v, 4, 4) * 0.7 + T.fbm(n2, u * 1, v * 1, 12, 3) * 0.3 + Math.sin((u * 6 + T.fbm(n, u, v, 2, 2) * 2) * Math.PI * 2) * 0.08;
  }
  return T.heightToNormal(h, S, S, 4.5);
}
