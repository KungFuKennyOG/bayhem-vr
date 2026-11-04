import * as THREE from 'three';
import * as T from '../../textures.js';
import { box, at, cyl, mergeGrouped, mergeGeometries, profileStrip } from '../../geom.js';
import { makeRng } from '../../rng.js';
import { BillboardBatch, CELL } from '../../particles.js';
import { SUN_DIR } from '../../atmosphere.js';
import { CollisionWorld, NavGrid } from '../../collision.js';
import { RWY, TWY, CONNECTORS, APRON, HANGARS, TOWER, FUEL_FARM } from './layout.js';
import * as G from './gse.js';
import { buildAirliner } from './aircraft.js';
import { loft } from './shapes.js';

const TAU = Math.PI * 2;
const SODIUM = [1.0, 0.55, 0.2];

// split a grouped (non-indexed) geometry into per-material pieces, transform them, and file them by material
class StaticBatch {
  constructor(mats) { this.mats = mats; this.lists = mats.map(() => []); }
  add(geo, matrix) {
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: geo.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const sub = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(geo.attributes)) sub.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
      if (matrix) sub.applyMatrix4(matrix);
      this.lists[gr.materialIndex].push(sub);
    }
  }
  build(parent, { cast = true, receive = true } = {}) {
    const parts = [], mi = [];
    this.lists.forEach((arr, i) => { if (arr.length) { parts.push(mergeGeometries(arr)); mi.push(i); } });
    if (!parts.length) return null;
    const g = mergeGeometries(parts, true); g.groups.forEach((gr, i) => { gr.materialIndex = mi[i]; });
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.mats); m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  }
}
const M4 = (x, y, z, ry = 0, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));

// =====================================================================================
//  AIRPORT world: runway, taxiways, apron, hangars, GSE, tower, fuel farm, horizon,
//  runway / taxiway / approach lights, plus the collision world + nav grid for the fight.
// =====================================================================================
export class AirportWorld {
  constructor(E) {
    this.E = E; this.scene = E.scene;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.col = new CollisionWorld({ cell: 8, minX: -80, minZ: -160, maxX: 400, maxZ: 480 });
    this.col.floor = 0;
    this.lights = [];      // { p, kind, size, color:[r,g,b], phase }
    this.time = 0;
    this.fastGround = () => 0;
  }

  async build() {
    const E = this.E;
    this.aniso = E.renderer.capabilities.getMaxAnisotropy();
    this.gseMats = G.gseMaterials();
    this.gse = new StaticBatch(this.gseMats);
    this._materials();
    this.wb = new StaticBatch(this.wm);
    this._ground();
    this._markings();
    this._hangars();
    this._apron();
    this._tower();
    this._fuelFarm();
    this._fieldProps();
    this._far();
    this._bounds();
    this.gse.build(this.group);
    this.wb.build(this.group);
    this._lightBatch();
    return this;
  }
  buildNav() {
    this.nav = new NavGrid(this.col, { x0: 120, z0: 82, x1: 338, z1: 392, y: 0, cell: 1, clearance: 0.42 });
  }

  // ---------------------------------------------------------------- materials for world geometry
  _materials() {
    const m = (o) => new THREE.MeshStandardMaterial(o);
    const corr = corrugatedTexture(); corr.repeat.set(1 / 8, 1 / 8);
    const corrD = corrugatedTexture(true); corrD.repeat.set(1 / 8, 1 / 8);
    const conc = T.concreteTexture(41, [0.7, 0.68, 0.64], 256, true); conc.repeat.set(1 / 6, 1 / 6);
    const floorT = hangarFloorTexture(); floorT.repeat.set(1 / 12, 1 / 12);
    // 0 corrugated wall 1 roof 2 concrete 3 steel 4 dark 5 glass 6 lamp 7 hangar floor 8 red 9 white 10 tank 11 sign 12 orange 13 window-lit 14 yellow
    this.wm = [
      m({ map: corr, color: 0xc4c9cc, roughness: 0.5, metalness: 0.45, side: THREE.DoubleSide }),
      m({ map: corrD, color: 0x8d9398, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide }),
      m({ map: conc, roughness: 0.9, color: 0xc8c2b8 }),
      m({ color: 0x5a6068, roughness: 0.45, metalness: 0.8 }),
      m({ color: 0x141517, roughness: 0.75, metalness: 0.2 }),
      m({ color: 0x1b2a38, roughness: 0.05, metalness: 0.7, envMapIntensity: 2.2 }),
      m({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 2.2 }),
      m({ map: floorT, roughness: 0.35, metalness: 0.1, color: 0xb9bdb6 }),
      m({ color: 0xa3170f, roughness: 0.45, metalness: 0.3 }),
      m({ color: 0xe8e6df, roughness: 0.5, metalness: 0.1 }),
      m({ color: 0xdcdcd6, roughness: 0.35, metalness: 0.5, envMapIntensity: 1.2 }),
      m({ map: hangarSignTexture(), roughness: 0.6, transparent: true }),
      m({ color: 0xff5a10, roughness: 0.6 }),
      m({ color: 0x302820, emissive: 0xffb060, emissiveIntensity: 1.4, roughness: 0.3 }),
      m({ color: 0xd9a514, roughness: 0.55 }),
      m({ map: crateTexture(), roughness: 0.85 }),
      m({ color: 0x9fb0b8, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.92, map: wrapTexture() }),
    ];
    this.W = { corr: 0, roof: 1, conc: 2, steel: 3, dark: 4, glass: 5, lamp: 6, floor: 7, red: 8, white: 9, tank: 10, sign: 11, orange: 12, lit: 13, yellow: 14, crate: 15, wrap: 16 };
  }
  _w(geo, mat, matrix = null) { const g = geo; if (!g.attributes.color) { const n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3)); } const { geometry } = mergeGrouped([[g, mat]], this.wm.length); this.wb.add(geometry, matrix); }
  _place(builder, x, z, ry = 0, opts = {}) {
    const b = typeof builder === 'function' ? builder() : builder;
    const mtx = M4(x, opts.y || 0, z, ry);
    this.gse.add(b.geometry, mtx);
    if (opts.collide !== false) this.col.addFromObject(b.colliders || [], mtx, { kind: opts.kind || 'gse', mat: 'metal' });
    return b;
  }

  // ---------------------------------------------------------------- ground: grass, runway, taxiways, apron
  _ground() {
    const aniso = this.aniso;
    // grass + far fields (vertex-coloured patchwork, gentle hills away from the airfield)
    const n = T.makeNoise(4401, 64), n2 = T.makeNoise(4402, 32);
    const SZ = 12000, SEG = 128;
    const gg = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG); gg.rotateX(-Math.PI / 2); gg.translate(0, 0, -1100);
    const pos = gg.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const inField = Math.abs(x - 80) < 700 && z < 1100 && z > -3500;
      const d = Math.max(0, Math.max(Math.abs(x - 80) - 700, z > 1100 ? z - 1100 : z < -3500 ? -3500 - z : 0));
      const h = inField ? -0.08 : -0.08 + Math.min(1, d / 1500) * (T.fbm(n, x / 6000 + 0.5, z / 6000 + 0.5, 3, 4) * 70 - 12);
      pos.setY(i, h);
      const pf = T.fbm(n2, x / 2500 + 0.3, z / 2500 + 0.7, 4, 3), wx = x + (T.fbm(n, x / 3000 + 0.1, z / 3000, 3, 3) - 0.5) * 600, wz = z + (T.fbm(n, x / 3000 + 0.6, z / 3000 + 0.3, 3, 3) - 0.5) * 600, cell = Math.floor(wx / 260) * 7 + Math.floor(wz / 210) * 13;
      const tone = (Math.sin(cell * 12.9898) * 43758.5) % 1;
      let c = inField ? [0.62, 0.55, 0.3] : tone > 0.75 ? [0.32, 0.42, 0.18] : tone > 0.5 ? [0.72, 0.58, 0.28] : tone > 0.25 ? [0.5, 0.36, 0.22] : [0.55, 0.52, 0.32];
      const k = 0.85 + pf * 0.3;
      col.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    }
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gg.computeVertexNormals();
    const grassT = grassTexture(); grassT.anisotropy = aniso; grassT.repeat.set(SZ / 9, SZ / 9);
    const grass = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: grassT, vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.4 }));
    grass.receiveShadow = true; this.group.add(grass);

    // asphalt (runway + taxiway + connectors + roads share one material, world-space uvs)
    const asph = asphaltTexture(); asph.map.anisotropy = aniso; asph.map.repeat.set(1 / 24, 1 / 24); asph.normal.repeat.set(1 / 24, 1 / 24);
    this.asphMat = new THREE.MeshStandardMaterial({ map: asph.map, normalMap: asph.normal, normalScale: new THREE.Vector2(0.1, 0.1), roughness: 0.78, metalness: 0, color: 0xc4bdb2, envMapIntensity: 0.9 });
    const quads = [];
    const rect = (x0, z0, x1, z1, y = 0) => quads.push([[x0, z0], [x1, z0], [x1, z1], [x0, z1], y]);
    const RW = RWY.halfW + RWY.shoulder;
    rect(-RW, RWY.z1 - 60, RW, RWY.z0 + 60, 0.0);
    rect(TWY.x - TWY.halfW, TWY.z1, TWY.x + TWY.halfW, TWY.z0, 0.0);
    for (const C of CONNECTORS) {
      const w = C.w / 2, xa = TWY.x - TWY.halfW + 1, xb = RW - 1;
      quads.push([[xb, C.z1 - w], [xa, C.z0 - w], [xa, C.z0 + w], [xb, C.z1 + w], 0.0]);
    }
    // service roads: behind the hangars, to the tower / fuel farm
    rect(130, 392, 340, 404, 0); rect(336, 30, 348, 404, 0); rect(240, 18, 348, 30, 0);
    const ap = [], au = [], ai = [];
    for (const [a, b, c, d, y] of quads) {
      const base = ap.length / 3;
      for (const p of [a, b, c, d]) { ap.push(p[0], y, p[1]); au.push(p[0], -p[1]); }
      ai.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    const asg = new THREE.BufferGeometry();
    asg.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3)); asg.setAttribute('uv', new THREE.Float32BufferAttribute(au, 2)); asg.setIndex(ai);
    asg.computeVertexNormals();
    // fix winding (normals up)
    if (asg.attributes.normal.getY(0) < 0) { asg.index.array.reverse(); asg.computeVertexNormals(); }
    const asm = new THREE.Mesh(asg, this.asphMat); asm.receiveShadow = true; asm.position.y = 0.006; this.group.add(asm);
    this.asphalt = asm;

    // apron concrete (slabs) + hangar aprons
    const conc = slabTexture(); conc.anisotropy = aniso; conc.repeat.set((APRON.x1 - APRON.x0) / 10, (APRON.z1 - APRON.z0) / 10);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(APRON.x1 - APRON.x0, APRON.z1 - APRON.z0), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.88, color: 0xe8d6bf, envMapIntensity: 0.35 }));
    apron.rotation.x = -Math.PI / 2; apron.position.set((APRON.x0 + APRON.x1) / 2, 0.012, (APRON.z0 + APRON.z1) / 2); apron.receiveShadow = true;
    this.group.add(apron);
    // rubber deposits on the touchdown zones (both ends) + tyre streaks
    const rub = new THREE.MeshBasicMaterial({ map: rubberTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const [zc, len] of [[180, 520], [-2620, 480]]) {
      const rm = new THREE.Mesh(new THREE.PlaneGeometry(26, len), rub); rm.rotation.x = -Math.PI / 2; rm.position.set(0, 0.03, zc); rm.renderOrder = 1; this.group.add(rm);
    }
  }

  // ---------------------------------------------------------------- paint: runway / taxiway / apron markings
  _markings() {
    const W = [], Y = [];
    const quad = (list, x0, z0, x1, z1, w, dash = 0) => { // a strip of width w from (x0,z0) to (x1,z1)
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), nx = -dz / L * w / 2, nz = dx / L * w / 2;
      list.push([x0 + nx, z0 + nz, x0 - nx, z0 - nz, x1 + nx, z1 + nz, x1 - nx, z1 - nz, L]);
    };
    const R = RWY;
    // runway edge lines + centreline dashes (30 m on, 20 m off)
    for (const s of [-1, 1]) quad(W, s * (R.halfW - 0.9), R.z0 - 2, s * (R.halfW - 0.9), R.z1 + 2, 0.9);
    for (let z = R.z0 - 90; z > R.z1 + 90; z -= 50) quad(W, 0, z, 0, z - 30, 0.9);
    // threshold piano keys at both ends
    for (const [zt, dir] of [[R.z0 - 6, -1], [R.z1 + 6, 1]]) for (let k = 0; k < 8; k++) for (const s of [-1, 1]) { const x = s * (3 + k * 3.3); quad(W, x, zt, x, zt + dir * 30, 1.8); }
    // touchdown zone + aiming point
    for (const [z0, dir] of [[R.z0, -1], [R.z1, 1]]) {
      const zz = (d) => z0 + dir * d;
      for (const s of [-1, 1]) {
        quad(W, s * 13, zz(300), s * 13, zz(360), 10);                                  // aiming point
        for (const d of [150, 450]) for (const k of [0, 1, 2]) quad(W, s * (6 + k * 3), zz(d), s * (6 + k * 3), zz(d + 22.5), 1.8);
        for (const d of [600, 750]) for (const k of [0, 1]) quad(W, s * (6 + k * 3), zz(d), s * (6 + k * 3), zz(d + 22.5), 1.8);
        for (const d of [900]) quad(W, s * 6, zz(d), s * 6, zz(d + 22.5), 1.8);
      }
    }
    // taxiway centreline + edges, connector lead-ins, hold short lines
    quad(Y, TWY.x, TWY.z0, TWY.x, TWY.z1, 0.18);
    for (const s of [-1, 1]) for (const x of [TWY.x + s * (TWY.halfW - 0.35), TWY.x + s * (TWY.halfW - 0.75)]) quad(Y, x, TWY.z0, x, TWY.z1, 0.15);
    for (const C of CONNECTORS) {
      quad(Y, TWY.x, C.z0, 0.8, C.z1 + (C.z1 === C.z0 ? 0 : 0), 0.18);
      // hold short (4 lines) across the connector 75 m from the runway centre
      const t = (75 - 0) / (TWY.x - 0), zh = C.z1 + (C.z0 - C.z1) * t;
      for (let k = 0; k < 4; k++) { const off = k * 0.45; quad(Y, 75 + off, zh - C.w / 2, 75 + off, zh + C.w / 2, 0.15); }
    }
    // apron: stand lead-in lines and red safety lines around the stands
    const stands = [[300, 235], [200, 300]];
    for (const [sx, sz] of stands) { quad(Y, APRON.x0 + 1, sz, sx + 18, sz, 0.18); quad(Y, sx - 14, sz - 4, sx - 14, sz + 4, 0.5); }
    for (const z of [APRON.z0 + 1.5]) quad(Y, APRON.x0, z, APRON.x1, z, 0.3);
    quad(Y, APRON.x0 + 0.6, APRON.z0, APRON.x0 + 0.6, APRON.z1, 0.3); quad(Y, APRON.x0 + 1.2, APRON.z0, APRON.x0 + 1.2, APRON.z1, 0.3);
    // hangar door tracks + no-parking hatches in front of each door
    const R2 = [];
    for (const h of HANGARS) { quad(R2, h.x - h.w / 2 + 1, h.z - 12, h.x + h.w / 2 - 1, h.z - 12, 0.25); for (let x = h.x - h.w / 2 + 2; x < h.x + h.w / 2 - 2; x += 3) quad(Y, x, h.z - 1, x + 2, h.z - 3, 0.3); }
    const pos = [], uv = [], colr = [], idx = [];
    const emit = (list, c, y) => list.forEach((l) => {
      const b = pos.length / 3;
      pos.push(l[0], y, l[1], l[2], y, l[3], l[4], y, l[5], l[6], y, l[7]);
      uv.push(0, 0, 0, 1, l[8] / 6, 0, l[8] / 6, 1);
      for (let k = 0; k < 4; k++) colr.push(...c);
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    });
    emit(W, [0.95, 0.94, 0.9], 0.02); emit(Y, [0.98, 0.72, 0.12], 0.022); emit(R2, [0.75, 0.12, 0.08], 0.022);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { g.index.array.reverse(); g.computeVertexNormals(); }
    const paint = new THREE.MeshStandardMaterial({ map: wornPaintTexture(), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3 });
    const mm = new THREE.Mesh(g, paint); mm.receiveShadow = true; mm.renderOrder = 2; this.group.add(mm);
    // runway designators
    for (const [txt, z, rot] of [['27', R.z0 - 62, 0], ['09', R.z1 + 62, Math.PI]]) {
      const t = T.textTexture(txt, { font: 'Anton', size: 220, color: 'rgba(245,243,236,0.92)', stroke: 0, glow: null, padding: 12 });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(18 * t.aspect * 0.55, 18), new THREE.MeshStandardMaterial({ map: t.texture, transparent: true, depthWrite: false, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3 }));
      pl.rotation.set(-Math.PI / 2, 0, rot + Math.PI); pl.position.set(0, 0.025, z); pl.renderOrder = 2; this.group.add(pl);
    }
  }

  // ---------------------------------------------------------------- hangars
  _hangars() {
    const w = this.W;
    this.hangarLamps = [];
    for (const h of HANGARS) {
      const x0 = h.x - h.w / 2, x1 = h.x + h.w / 2, z0 = h.z, z1 = h.z + h.d, eave = 14.5;
      // walls (side, back) + gable front above the door
      this._w(box(0.4, eave, h.d, 8), w.corr, M4(x0 + 0.2, eave / 2, (z0 + z1) / 2));
      this._w(box(0.4, eave, h.d, 8), w.corr, M4(x1 - 0.2, eave / 2, (z0 + z1) / 2));
      this._w(box(h.w, eave, 0.4, 8), w.corr, M4(h.x, eave / 2, z1 - 0.2));
      this.col.add([x0, 0, z0], [x0 + 0.4, eave, z1], { kind: 'wall', mat: 'metal' });
      this.col.add([x1 - 0.4, 0, z0], [x1, eave, z1], { kind: 'wall', mat: 'metal' });
      this.col.add([x0, 0, z1 - 0.4], [x1, eave, z1], { kind: 'wall', mat: 'metal' });
      // arched roof (barrel vault along z)
      const arch = []; for (let k = 0; k <= 16; k++) { const a = k / 16; arch.push([x0 + a * h.w, eave + Math.sin(a * Math.PI) * (h.h - eave)]); }
      const roof = profileStrip(arch.map(([x, y]) => [x - h.x, y]), z0 - 0.6, z1 + 0.2, 8, 8); roof.translate(h.x, 0, 0);
      this._w(roof, w.roof);
      // gable (back + front above the door)
      const sh = new THREE.Shape(); sh.moveTo(-h.w / 2, 0); for (const [x, y] of arch) sh.lineTo(x - h.x, y - eave); sh.lineTo(h.w / 2, 0); sh.closePath();
      for (const zz of [z1 - 0.2, z0]) { const gg = new THREE.ShapeGeometry(sh, 12); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8); this._w(gg, w.corr, M4(h.x, eave, zz)); }
      // door header beam + pillars
      this._w(box(h.w, 2.2, 1.2), w.steel, M4(h.x, eave - 1.1, z0 + 0.3));
      for (const s of [-1, 1]) { this._w(box(2.6, eave, 1.4), w.corr, M4(h.x + s * (h.w / 2 - 1.3), eave / 2, z0 + 0.4)); this.col.add([h.x + s * (h.w / 2 - 1.3) - 1.3, 0, z0 - 0.3], [h.x + s * (h.w / 2 - 1.3) + 1.3, eave, z0 + 1.1], { kind: 'wall', mat: 'metal' }); }
      // sign "HANGAR n"
      const sg = new THREE.PlaneGeometry(14, 3.5); const uv = sg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) + (h.id - 1)) / 3);
      sg.rotateY(Math.PI); this._w(sg, w.sign, M4(h.x, eave + 2.6, z0 - 0.05));
      // sliding door leaves: 6 leaves, stacked at the sides according to how open the door is
      const open = h.door, span = h.w - 5.2, leafW = span / 6 + 0.4, leafH = eave - 2.2;
      for (let k = 0; k < 6; k++) {
        const side = k < 3 ? -1 : 1, j = k < 3 ? k : 5 - k;
        const closedX = h.x - span / 2 + (k + 0.5) * span / 6;
        const parkX = h.x + side * (span / 2 - leafW / 2 - j * 0.15);
        const lx = closedX + (parkX - closedX) * open, lz = z0 - 0.3 - j * 0.35;
        this._w(box(leafW, leafH, 0.18, 8), w.corr, M4(lx, leafH / 2, lz));
        this._w(box(leafW, 0.3, 0.3), w.steel, M4(lx, leafH, lz));
        this.col.add([lx - leafW / 2, 0, lz - 0.12], [lx + leafW / 2, leafH, lz + 0.12], { kind: 'wall', mat: 'metal', thin: true });
      }
      // interior: polished floor, roof ribs, hanging lamps
      const fl = new THREE.PlaneGeometry(h.w - 0.8, h.d - 0.6); fl.rotateX(-Math.PI / 2); const fuv = fl.attributes.uv; for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * (h.w - 0.8), fuv.getY(i) * (h.d - 0.6));
      this._w(fl, w.floor, M4(h.x, 0.02, (z0 + z1) / 2));
      for (let z = z0 + 3; z < z1 - 1; z += 6) for (let k = 0; k < 16; k++) {
        const [ax, ay] = arch[k], [bx, by] = arch[k + 1];
        const L = Math.hypot(bx - ax, by - ay), mid = M4((ax + bx) / 2, (ay + by) / 2 - 0.4, z); mid.multiply(new THREE.Matrix4().makeRotationZ(Math.atan2(by - ay, bx - ax)));
        this._w(box(L, 0.5, 0.25), w.steel, mid);
      }
      for (let z = z0 + 9; z < z1 - 3; z += 12) for (const xx of [-14, 0, 14]) {
        this._w(box(1.6, 0.25, 0.6), w.dark, M4(h.x + xx, 15.4, z));
        this._w(box(1.4, 0.05, 0.45), w.lamp, M4(h.x + xx, 15.26, z));
        this.hangarLamps.push(new THREE.Vector3(h.x + xx, 15.1, z));
      }
      // interior clutter along the back wall: tool chests, shelving, workbench (cover inside hangar 2)
      for (let x = x0 + 4; x < x1 - 4; x += 7) {
        this._w(box(1.6, 1.1, 0.7), w.red, M4(x, 0.55, z1 - 1.2)); this._w(box(1.65, 0.06, 0.75), w.steel, M4(x, 1.13, z1 - 1.2));
        this._w(box(2.4, 3.2, 0.9), w.steel, M4(x + 3.2, 1.6, z1 - 1.0)); for (const yy of [0.9, 1.9, 2.9]) this._w(box(2.3, 0.6, 0.7), (Math.round(x + yy) % 3) ? w.white : w.orange, M4(x + 3.2, yy - 0.2, z1 - 1.0));
        this.col.add([x - 0.8, 0, z1 - 1.6], [x + 4.4, 3.2, z1 - 0.4], { kind: 'gse', mat: 'metal' });
      }
    }
    // hangar 2 hero dressing: a jet engine on a transport stand + a workbench + crates (low cover near the start)
    const h2 = HANGARS[1];
    const ex = h2.x + 10, ez = h2.z + 22;
    this._w(box(3.6, 0.3, 5.2), w.yellow, M4(ex, 0.5, ez)); for (const s of [-1, 1]) for (const zz of [-2.2, 2.2]) this._w(cyl(0.18, 0.18, 0.2, 10).rotateZ(Math.PI / 2), w.dark, M4(ex + s * 1.6, 0.2, ez + zz));
    this._w(loft([{ z: -2.3, cy: 2.1, rx: 1.05, ry: 1.05 }, { z: -2.1, cy: 2.1, rx: 1.15, ry: 1.15 }, { z: 1.2, cy: 2.1, rx: 1.12, ry: 1.12 }, { z: 2.4, cy: 2.1, rx: 0.75, ry: 0.75 }], { segs: 24 }), w.tank, M4(ex, 0, ez));
    this._w(box(0.3, 1.0, 0.3), w.steel, M4(ex, 1.1, ez - 1.2)); this._w(box(0.3, 1.0, 0.3), w.steel, M4(ex, 1.1, ez + 1.2));
    this.col.add([ex - 1.8, 0, ez - 2.6], [ex + 1.8, 3.3, ez + 2.6], { kind: 'gse', mat: 'metal' });
    for (const [cx, cz, s] of [[h2.x - 9, h2.z + 12, 1.2], [h2.x - 7.6, h2.z + 12.3, 0.9], [h2.x - 8.4, h2.z + 13.6, 1.0], [h2.x + 16, h2.z + 8, 1.1], [h2.x + 17.3, h2.z + 8.4, 1.1]]) {
      this._w(box(s, s, s, 1), w.crate, M4(cx, s / 2, cz));
      this.col.add([cx - s / 2, 0, cz - s / 2], [cx + s / 2, s, cz + s / 2], { kind: 'crate', mat: 'wood' });
    }
    this._w(box(4, 1.0, 1.2), w.steel, M4(h2.x - 18, 0.5, h2.z + 30)); this.col.add([h2.x - 20, 0, h2.z + 29.4], [h2.x - 16, 1.0, h2.z + 30.6], { kind: 'gse', mat: 'metal' });
    // hangar 1: an airliner in for maintenance, nose out
    const jet = buildAirliner('haven');
    jet.root.position.set(HANGARS[0].x, 0, HANGARS[0].z + 21); jet.root.rotation.y = 0;
    this.group.add(jet.root); this.hangarJet = jet;
    this._jetColliders(jet, HANGARS[0].x, HANGARS[0].z + 21, 0);
  }
  _jetColliders(jet, x, z, ry) {
    const mtx = M4(x, 0, z, ry);
    for (const h of jet.hit) {
      const lo = h.min.slice(), hi = h.max.slice();
      if (h.name.startsWith('wing')) lo[1] = Math.max(lo[1], 2.05); // walk under the wings
      if (h.name === 'fus') lo[1] = 1.3;
      this.col.addFromObject([{ min: lo, max: hi }], mtx, { kind: 'jet', mat: 'metal' });
    }
  }

  // ---------------------------------------------------------------- apron dressing (the cover for the fight)
  _apron() {
    const r = makeRng(9090);
    this.refuelerSpots = [[252, 300, 0.25], [236, 236, -1.45], [158, 214, 1.7], [300, 312, 1.45]];  // game spawns these (they blow up)
    this.drumSpots = [[264, 314, 6, 'pallet'], [206, 262, 5, 'row'], [152, 240, 7, 'stack'], [190, 330, 4, 'pallet'], [287, 270, 4, 'row'], [244, 248, 4, 'pallet'], [180, 206, 5, 'row'], [226, 290, 4, 'pallet']];
    // parked airliner at the stand (static; big cover piece in the middle of the apron)
    const jet = buildAirliner('pacifica');
    jet.root.position.set(298, 0, 236); jet.root.rotation.y = Math.PI / 2; // nose toward -x (taxiway)
    this.group.add(jet.root); this.parkedJet = jet;
    this._jetColliders(jet, 298, 236, Math.PI / 2);
    // stair truck at its front door, belt loader at the aft hold
    this._place(G.buildStairTruck(), 283.2, 233.6, Math.PI / 2 + 0.05);
    this._place(G.buildBeltLoader(), 307, 231.2, -Math.PI / 2 + 0.35);
    this._place(G.buildGPU(), 278, 240.5, 0.4);
    // perch: stair truck in the middle of zone A, and one near the taxiway
    this.stairs = [[204, 318, -0.4], [176, 172, 2.6]];
    for (const [x, z, ry] of this.stairs) this._place(G.buildStairTruck(), x, z, ry);
    // tugs with baggage cart trains
    const train = (x, z, ry, n, seed) => {
      const dx = Math.sin(ry), dz = Math.cos(ry);
      this._place(G.buildTug(), x, z, ry);
      for (let k = 0; k < n; k++) this._place(G.buildCart(seed + k), x + dx * (3.2 + k * 3.6), z + dz * (3.2 + k * 3.6), ry + (r() - 0.5) * 0.12);
    };
    train(176, 324, 0.05, 3, 11); train(214, 280, 1.62, 3, 21); train(170, 246, -0.3, 4, 31); train(262, 196, 1.4, 2, 41); train(146, 120, 0.2, 3, 51);
    // ULD dollies
    for (const [x, z, ry, n] of [[282, 330, 1.57, 4], [152, 286, 0.1, 3], [232, 196, -0.2, 3], [196, 160, 1.2, 2]]) for (let k = 0; k < n; k++) this._place(G.buildULD(), x + Math.sin(ry + Math.PI / 2) * k * 2.2, z + Math.cos(ry + Math.PI / 2) * k * 2.2, ry + (r() - 0.5) * 0.15);
    // more traffic along the walking line: trains of carts, ULD rows, a second belt loader, tugs
    train(244, 322, 1.35, 4, 61); train(196, 238, 2.9, 3, 71); train(272, 256, 0.1, 2, 81); train(160, 168, 1.55, 3, 91);
    for (const [x, z, ry, n] of [[216, 214, 1.57, 4], [252, 336, 0, 3], [174, 270, 0.3, 3]]) for (let k = 0; k < n; k++) this._place(G.buildULD(), x + Math.sin(ry + Math.PI / 2) * k * 2.2, z + Math.cos(ry + Math.PI / 2) * k * 2.2, ry);
    this._place(G.buildBeltLoader(), 186, 228, 2.2); this._place(G.buildTug(), 238, 206, 0.8); this._place(G.buildTug(), 206, 320, -1.2); this._place(G.buildGPU(), 252, 270, 1.9);
    // cargo pallets: wooden crates on pallets, shrink-wrapped stacks (waist / chest-high cover)
    const W = this.W;
    for (const [x, z, ry, n] of [[232, 312, 0.2, 3], [198, 296, 1.3, 2], [262, 280, -0.4, 3], [186, 252, 0.7, 2], [226, 226, 1.1, 3], [204, 196, 0.3, 2], [168, 182, -0.9, 2], [252, 214, 0.5, 2]]) {
      for (let k = 0; k < n; k++) {
        const ox = Math.cos(ry) * k * 2.4, oz = -Math.sin(ry) * k * 2.4, h = 1.0 + r() * 0.9, w = 1.9, d = 1.6;
        const m = M4(x + ox, 0, z + oz, ry + (r() - 0.5) * 0.2);
        this._w(box(2.0, 0.14, 1.7), W.steel, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.07, 0)));
        this._w(box(w, h, d, 1), k % 2 ? W.crate : W.wrap, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.14 + h / 2, 0)));
        if (r() < 0.5) this._w(box(0.9, 0.6, 0.8, 1), W.crate, m.clone().multiply(new THREE.Matrix4().makeTranslation(0.3, 0.14 + h + 0.3, 0.1)));
        this.col.addFromObject([{ min: [-1.0, 0, -0.85], max: [1.0, 0.14 + h, 0.85] }], M4(x + ox, 0, z + oz, Math.round(ry / (Math.PI / 2)) * Math.PI / 2), { kind: 'crate', mat: 'wood' });
      }
    }
    // GPUs, belt loader, blast fence near the taxiway edge
    for (const [x, z, ry] of [[232, 330, 0.3], [182, 288, 2.0], [140, 232, 1.0]]) this._place(G.buildGPU(), x, z, ry);
    this._place(G.buildBeltLoader(), 230, 265, 0.9);
    this._place(G.buildBlastFence(), 136, 260, Math.PI / 2 - 0.1);
    // cones
    const cone = G.buildCone();
    for (let k = 0; k < 40; k++) { const x = 130 + r() * 200, z = 100 + r() * 230; this._place(cone, x, z, r() * TAU, { collide: false }); }
    for (let z = 96; z < 330; z += 9) this._place(cone, APRON.x0 + 2.2, z, 0, { collide: false });
    // light masts (sodium)
    this.masts = [];
    const mast = G.buildMast();
    for (const [x, z] of [[150, 304], [244, 292], [318, 300], [196, 214], [284, 190], [150, 148], [226, 128], [318, 120]]) {
      this._place(mast, x, z, Math.atan2(-(232 - x), -(220 - z)), { kind: 'mast' });
      const ry = Math.atan2(-(232 - x), -(220 - z)), m = M4(x, 0, z, ry);
      this.masts.push({ x, z, lamps: mast.lamps.map(p => p.clone().applyMatrix4(m)) });
    }
    // taxiway signs at the apron edge / connectors
    for (const [x, z, row, ry] of [[123, 160, 0, Math.PI / 2], [123, 300, 3, Math.PI / 2], [100, 136, 1, 0], [82, 166, 2, 0], [100, -138, 1, 0]]) this._place(G.buildSign(row), x, z, ry);
  }

  // ---------------------------------------------------------------- control tower + terminal
  _tower() {
    const w = this.W, { x, z } = TOWER;
    this._w(box(24, 7, 14, 6), w.conc, M4(x + 4, 3.5, z + 6));
    this._w(cyl(3.2, 3.6, 40, 16), w.conc, M4(x, 20, z));
    // cab: tilted glass ring + roof
    const cab = loft([{ z: 0, cy: 0, rx: 5.2, ry: 5.2 }], { segs: 12 });
    void cab;
    const ring = (r0, r1, y0, y1, mat) => { const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, 12, 1, true); this._w(g, mat, M4(x, (y0 + y1) / 2, z)); };
    ring(4.6, 5.2, 40, 41.2, w.white);
    ring(5.0, 6.0, 41.2, 45, w.glass);
    ring(6.0, 6.2, 45, 45.8, w.white);
    this._w(cyl(6.3, 6.3, 0.5, 12), w.dark, M4(x, 46, z));
    this._w(cyl(0.12, 0.12, 6, 6), w.steel, M4(x + 2, 49, z)); this._w(cyl(0.08, 0.08, 4, 6), w.steel, M4(x - 2, 48, z + 1));
    this.towerBeacon = new THREE.Vector3(x, 46.6, z);
    this.lights.push({ p: new THREE.Vector3(x + 2, 52.1, z), kind: 'obst', size: 1.4 });
    this.col.add([x - 3.6, 0, z - 3.6], [x + 3.6, 40, z + 3.6], { kind: 'wall', mat: 'concrete' });
    this.col.add([x - 8, 0, z - 1], [x + 16, 7, z + 13], { kind: 'wall', mat: 'concrete' });
    // passenger terminal across the runway (scenery): long glass box + jet bridges
    const ft = T.facadeTextures2(77, 3, 24);
    const term = new THREE.Mesh(new THREE.BoxGeometry(30, 16, 520), [
      new THREE.MeshStandardMaterial({ map: ft.map, emissiveMap: ft.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0x6a6e72, roughness: 0.7 }),
    ]);
    term.material[0].map.repeat.set(4, 1); term.material[0].emissiveMap.repeat.set(4, 1);
    term.position.set(-330, 8, -700); this.group.add(term);
    for (let k = 0; k < 7; k++) this._w(box(22, 3.2, 3.6), w.white, M4(-304, 4.6, -900 + k * 64));
  }
  // ---------------------------------------------------------------- fuel farm
  _fuelFarm() {
    const w = this.W, { x, z } = FUEL_FARM;
    this.tanks = [];
    for (const [dx, dz] of [[-16, -10], [8, -10], [-16, 14], [8, 14]]) {
      this._w(cyl(9, 9, 12, 24), w.tank, M4(x + dx, 6, z + dz));
      this._w(cyl(9.2, 9.2, 0.6, 24), w.white, M4(x + dx, 12.2, z + dz));
      for (let k = 0; k < 10; k++) this._w(box(0.6, 0.1, 0.1), w.steel, M4(x + dx + 9.1, 1 + k * 1.1, z + dz));
      this.tanks.push(new THREE.Vector3(x + dx, 6, z + dz));
    }
    // berm walls
    this._w(box(56, 1.4, 1), w.conc, M4(x - 4, 0.7, z - 23)); this._w(box(56, 1.4, 1), w.conc, M4(x - 4, 0.7, z + 27));
    this._w(box(1, 1.4, 50), w.conc, M4(x - 32, 0.7, z + 2)); this._w(box(1, 1.4, 50), w.conc, M4(x + 24, 0.7, z + 2));
  }
  // ---------------------------------------------------------------- field props: windsock, ILS, approach light towers, blast fence
  _fieldProps() {
    const w = this.W;
    // windsock (orange/white cone) on the field side of the runway
    this._w(cyl(0.08, 0.1, 6, 8), w.steel, M4(-62, 3, 290));
    for (let k = 0; k < 5; k++) { const g = new THREE.CylinderGeometry(0.42 - k * 0.06, 0.48 - k * 0.06, 0.75, 12, 1, true); g.rotateZ(Math.PI / 2); this._w(g, k % 2 ? w.white : w.orange, M4(-62 - 0.5 - k * 0.74, 5.85 - k * 0.12, 290, 0.3)); }
    // approach light towers east of the threshold
    for (let z = RWY.z0 + 30; z <= RWY.z0 + 450; z += 30) { this._w(box(0.2, 1.2 + (z - RWY.z0) * 0.004, 0.2), w.steel, M4(0, 0.6, z)); this._w(box(14, 0.15, 0.15), w.steel, M4(0, 1.2 + (z - RWY.z0) * 0.004, z)); }
    // localizer array at the far end
    for (let k = 0; k < 14; k++) this._w(box(0.15, 2.2, 0.15), w.white, M4(-26 + k * 4, 1.1, RWY.z1 - 300));
    this._w(box(56, 0.2, 0.3), w.steel, M4(0, 2.2, RWY.z1 - 300));
    // glide slope antenna
    this._w(box(0.4, 12, 0.4), w.red, M4(-58, 6, RWY.z0 - 330));
  }

  // ---------------------------------------------------------------- horizon: hills, city, tree lines
  _far() {
    // hills ring (fog off, hand-graded haze: dark warm silhouettes into the sun, bluish away from it)
    const segs = 160, pos = [], colr = [], idx = [];
    const n = T.makeNoise(9301, 64), sunAz = Math.atan2(SUN_DIR.x, SUN_DIR.z);
    const R0 = 7200;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const h = 60 + T.fbm(n, i / segs * 6, 0.5, 4, 5) * 520 + Math.max(0, Math.sin(a * 3 + 1)) * 160;
      const toSun = Math.max(0, Math.cos(a - sunAz));
      const base = [0.42 + 0.2 * toSun, 0.36 + 0.06 * toSun, 0.5 - 0.15 * toSun], top = [0.62 + 0.25 * toSun, 0.45 + 0.1 * toSun, 0.62 - 0.2 * toSun];
      const cx = 80 + sa * R0, cz = -1100 + ca * R0;
      pos.push(cx, -20, cz, cx, h, cz); colr.push(...base.map(v => v * 0.55), ...top.map(v => v * 0.75));
      if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); hg.setIndex(idx);
    const hills = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    hills.renderOrder = -40; this.group.add(hills);
    // city skyline strip to the north-east (+x)
    const sky = T.skylineTexture(4242); sky.repeat.set(3, 1);
    const cityMat = new THREE.MeshBasicMaterial({ map: sky, transparent: true, fog: false, color: 0x9a8a92, depthWrite: false });
    for (const [x, z, ry, w, hgt] of [[3000, -400, -Math.PI / 2, 4200, 260], [2200, 1800, -2.4, 2600, 180]]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), cityMat); pl.position.set(x, hgt / 2 - 10, z); pl.rotation.y = ry; pl.renderOrder = -39; this.group.add(pl);
    }
    // tree lines along the airfield boundary (crossed billboards, instanced)
    const tt = treeTexture();
    const tg = mergeGeometries([new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2)]);
    const tm = new THREE.MeshStandardMaterial({ map: tt, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95, color: 0x8a8a6a });
    const r = makeRng(55), N = 420, im = new THREE.InstancedMesh(tg, tm, N); const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const side = i % 3, t = r();
      let x, z;
      if (side === 0) { x = -640 + r() * 40; z = 900 - t * 4300; } else if (side === 1) { x = 760 + r() * 60; z = 900 - t * 4300; } else { x = -640 + t * 1440; z = 960 + r() * 50; }
      const s = 9 + r() * 9;
      m.compose(new THREE.Vector3(x, -0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * TAU, 0)), new THREE.Vector3(s * (0.8 + r() * 0.4), s, s));
      im.setMatrixAt(i, m);
    }
    im.castShadow = false; im.receiveShadow = false; this.group.add(im);
  }
  // ---------------------------------------------------------------- invisible bounds for the on-foot fight
  _bounds() {
    const B = { kind: 'bound', mat: 'metal', noBullet: true };
    this.col.add([118, 0, 80], [121.5, 4, 420], B);     // taxiway edge (opened up for the jeep later)
    this.col.add([118, 0, 76], [345, 4, 80], B);
    this.col.add([338, 0, 76], [345, 4, 420], B);
    this.col.add([118, 0, 392], [345, 4, 400], B);
    this.boundTaxi = this.col.boxes[this.col.boxes.length - 4];
  }

  // ---------------------------------------------------------------- lights (one billboard batch)
  _lightBatch() {
    const R = RWY, L = this.lights;
    for (let z = R.z0; z >= R.z1; z -= 60) for (const s of [-1, 1]) L.push({ p: new THREE.Vector3(s * (R.halfW + 1), 0.35, z), kind: 'edge', size: 0.9 });
    for (let z = R.z0 - 15; z >= R.z1; z -= 30) L.push({ p: new THREE.Vector3(0.9, 0.05, z), kind: 'cl', size: 0.6 });
    for (let x = -R.halfW; x <= R.halfW; x += 4) { L.push({ p: new THREE.Vector3(x, 0.3, R.z0 + 1), kind: 'green', size: 0.9 }); L.push({ p: new THREE.Vector3(x, 0.3, R.z1 - 1), kind: 'red', size: 0.9 }); }
    for (let z = R.z0 + 30, k = 0; z <= R.z0 + 450; z += 30, k++) {
      for (let x = -6; x <= 6; x += 3) L.push({ p: new THREE.Vector3(x, 1.3 + (z - R.z0) * 0.004, z), kind: 'appr', size: 1.1 });
      L.push({ p: new THREE.Vector3(0, 1.6 + (z - R.z0) * 0.004, z), kind: 'rabbit', size: 3.4, phase: k });
    }
    for (let z = TWY.z0; z >= -900; z -= 30) for (const s of [-1, 1]) L.push({ p: new THREE.Vector3(TWY.x + s * (TWY.halfW + 0.6), 0.3, z), kind: 'blue', size: 0.7 });
    for (let z = TWY.z0; z >= -900; z -= 15) L.push({ p: new THREE.Vector3(TWY.x, 0.04, z), kind: 'twycl', size: 0.4 });
    for (const m of this.masts) for (const p of m.lamps) L.push({ p, kind: 'sodium', size: 3.2 });
    for (const p of this.hangarLamps) L.push({ p, kind: 'hangar', size: 1.9 });
    for (const h of HANGARS) for (const s of [-1, 1]) L.push({ p: new THREE.Vector3(h.x + s * (h.w / 2 - 0.5), 14.9, h.z - 0.2), kind: 'obst', size: 1.2 });
    for (const t of this.tanks) L.push({ p: t.clone().setY(12.7), kind: 'obst', size: 1.0 });
    L.push({ p: this.towerBeacon, kind: 'beacon', size: 5 });
    // PAPI (4 boxes left of the touchdown zone)
    for (let k = 0; k < 4; k++) L.push({ p: new THREE.Vector3(-R.halfW - 15 - k * 9, 0.8, R.z0 - 330), kind: 'papi', size: 1.6, phase: k });
    this.glow = new BillboardBatch(L.length + 64, this.E.atlas, { boost: 1, renderOrder: 6, fog: this.scene.fog });
    this.scene.add(this.glow.mesh);
    this.extraGlows = []; // per-frame glows from other systems (aircraft nav lights, jeep beacons)
  }
  addGlow(p, size, r, g, b, a = 1) { this.extraGlows.push([p.x, p.y, p.z, size, r, g, b, a]); }

  update(dt, head, dusk) {
    this.time += dt;
    const t = this.time, G = this.glow;
    const on = 0.55 + 0.45 * Math.min(1, dusk * 2.2); // runway lights are on at sunset, brighter at blue hour
    let gi = 0;
    for (const L of this.lights) {
      const p = L.p, d = Math.hypot(p.x - head.x, p.y - head.y, p.z - head.z);
      // keep a minimum angular size so lights read as points far down the runway
      const s = Math.max(L.size, d * 0.0022) * (d > 900 ? 0.8 : 1);
      let r = 2, g = 1.8, b = 1.5, a = 0.9 * on;
      switch (L.kind) {
        case 'edge': r = 2.2; g = 1.9; b = 1.4; break;
        case 'cl': r = 1.8; g = 1.8; b = 1.7; a *= 0.7; break;
        case 'green': r = 0.3; g = 2.4; b = 0.9; break;
        case 'red': r = 2.6; g = 0.25; b = 0.15; break;
        case 'appr': r = 2.3; g = 2.1; b = 1.7; break;
        case 'rabbit': { const k = ((t * 2) % 1) * 15; const hit = Math.abs(k - (15 - L.phase)) < 0.7; a = hit ? 1 : 0; r = g = b = 4; break; }
        case 'blue': r = 0.35; g = 0.6; b = 2.6; a *= 0.85; break;
        case 'twycl': r = 0.4; g = 2.0; b = 0.9; a *= 0.6; break;
        case 'sodium': r = SODIUM[0] * 2.4; g = SODIUM[1] * 2.4; b = SODIUM[2] * 2.4; a = 0.12 + 0.88 * Math.min(1, dusk * 2.2); break;
        case 'hangar': r = 1.6; g = 1.45; b = 1.1; a = 0.55; break;
        case 'obst': r = 2.8; g = 0.2; b = 0.1; a = Math.sin(t * 3 + p.x) > -0.2 ? 0.95 : 0.15; break;
        case 'beacon': { const ph = (t * 0.75) % 1; const white = ph > 0.5; const fl = Math.max(0, 1 - Math.abs((ph % 0.5) - 0.12) * 9); r = white ? 3 : 0.4; g = 3; b = white ? 3 : 0.8; a = 0.15 + fl; break; }
        case 'papi': { const red = L.phase >= 2; r = red ? 2.8 : 2.6; g = red ? 0.3 : 2.4; b = red ? 0.2 : 2.0; break; }
      }
      G.set(gi++, p.x, p.y, p.z, s, s, 0, CELL.GLOW, 0, r * a, g * a, b * a, a);
    }
    for (const e of this.extraGlows) { if (gi >= G.max) break; G.set(gi++, e[0], e[1], e[2], e[3], e[3], 0, CELL.GLOW, 0, e[4] * e[7], e[5] * e[7], e[6] * e[7], e[7]); }
    this.extraGlows.length = 0;
    G.commit(gi);
  }
}

// =====================================================================================
//  textures
// =====================================================================================
function asphaltTexture() {
  const S = 512, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S);
  const n = T.makeNoise(611, 4), n2 = T.makeNoise(612, 2), r = makeRng(613);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const m = T.fbm(n, u, v, 4, 5), g = r();
    let b = 0.42 + (m - 0.5) * 0.16 + (g - 0.5) * 0.07;
    const patch = T.fbm(n2, u, v, 2, 3) > 0.64 ? -0.06 : 0;  // repair patches
    b += patch;
    const seam = Math.abs(u - 0.5) < 0.002 ? -0.08 : 0;                 // longitudinal paving seam
    b += seam;
    const i = (y * S + xx) * 4;
    img.data[i] = b * 255; img.data[i + 1] = b * 255 * 0.99; img.data[i + 2] = b * 255 * 0.97; img.data[i + 3] = 255;
    h[y * S + xx] = g * 0.4 + m * 0.6;
  }
  x.putImageData(img, 0, 0);
  return { map: T.canvasTex(c), normal: T.heightToNormal(h, S, S, 1.2) };
}
function slabTexture() {
  // one 10 m tile = 2x2 slabs of 5 m: joints, stains, tyre marks
  const S = 512, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S);
  const n = T.makeNoise(731, 4), n2 = T.makeNoise(732, 6), r = makeRng(733);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const slab = (u > 0.5 ? 1 : 0) + (v > 0.5 ? 2 : 0);
    let b = 0.74 + (T.fbm(n, u, v, 4, 5) - 0.5) * 0.12 + (r() - 0.5) * 0.06 + (slab % 2 ? 0.02 : -0.01) + (slab > 1 ? -0.015 : 0.01);
    b -= Math.max(0, T.fbm(n2, u, v, 6, 3) - 0.6) * 0.5;      // oil stains
    const j = Math.min(Math.abs(u - 0.5), Math.abs(v - 0.5), u, 1 - u, v, 1 - v);
    if (j < 0.004) b -= 0.28; else if (j < 0.008) b -= 0.08;
    const i = (y * S + xx) * 4;
    img.data[i] = b * 255 * 1.02; img.data[i + 1] = b * 255; img.data[i + 2] = b * 255 * 0.95; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // tyre scuffs
  x.strokeStyle = 'rgba(20,18,16,0.12)'; x.lineWidth = 9;
  for (let k = 0; k < 5; k++) { x.beginPath(); const y0 = r() * S; x.moveTo(0, y0); x.bezierCurveTo(S * 0.3, y0 + (r() - 0.5) * 120, S * 0.7, y0 + (r() - 0.5) * 120, S, y0 + (r() - 0.5) * 60); x.stroke(); }
  return T.canvasTex(c);
}
function grassTexture() {
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(821, 4), r = makeRng(822);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const m = T.fbm(n, xx / S, y / S, 4, 4), g = r();
    const b = 0.8 + (m - 0.5) * 0.25 + (g - 0.5) * 0.3;
    const i = (y * S + xx) * 4; img.data[i] = 235 * b; img.data[i + 1] = 228 * b; img.data[i + 2] = 205 * b; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c);
}
function rubberTexture() {
  const W = 128, H = 1024, c = T.makeCanvas(W, H), x = c.getContext('2d'), r = makeRng(851), n = T.makeNoise(852, 32);
  x.clearRect(0, 0, W, H);
  for (const cx of [0.28, 0.72]) for (let k = 0; k < 90; k++) {
    const px = (cx + (r() - 0.5) * 0.16) * W, y0 = r() * H, len = 30 + r() * 220;
    x.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.2})`; x.lineWidth = 2 + r() * 5;
    x.beginPath(); x.moveTo(px, y0); x.lineTo(px + (r() - 0.5) * 6, y0 + len); x.stroke();
  }
  const img = x.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) { const i = (y * W + xx) * 4; const f = Math.min(1, Math.min(y, H - y) / 120); img.data[i + 3] *= f * (0.6 + T.fbm(n, xx / W, y / H * 6, 3, 3) * 0.6); }
  x.putImageData(img, 0, 0);
  const t = T.canvasTex(c, { repeat: false });
  return t;
}
function wornPaintTexture() {
  const W = 256, H = 32, c = T.makeCanvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), n = T.makeNoise(57, 32);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const a = Math.min(1, Math.max(0, (T.fbm(n, xx / W, y / H, 8, 4) - 0.12) * 4.5)) * (1 - Math.pow(Math.abs(y / H - 0.5) * 2, 8));
    const i = (y * W + xx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 240;
  }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c);
}
function corrugatedTexture(dark = false) {
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(dark ? 961 : 962, 4);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const rib = 0.82 + 0.18 * Math.sin((xx / S) * 32 * TAU);
    const streak = Math.max(0, T.fbm(n, xx / S, y / S, 4, 3) - 0.55) * (y / S) * 1.6; // rust / grime running down
    const v = (dark ? 150 : 205) * rib * (1 - streak * 0.5) + (T.fbm(n, xx / S, y / S, 4, 3) - 0.5) * 20;
    const i = (y * S + xx) * 4; img.data[i] = v * (1 + streak * 0.25); img.data[i + 1] = v * (1 - streak * 0.05); img.data[i + 2] = v * (1 - streak * 0.25); img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // panel seams every metre
  x.fillStyle = 'rgba(0,0,0,0.2)'; for (let y = 0; y < S; y += 32) x.fillRect(0, y, S, 2);
  return T.canvasTex(c);
}
function hangarFloorTexture() {
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(971, 3);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) { const v = 150 + (T.fbm(n, xx / S, y / S, 3, 4) - 0.5) * 50; const i = (y * S + xx) * 4; img.data[i] = v * 0.86; img.data[i + 1] = v * 0.95; img.data[i + 2] = v * 0.88; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  x.fillStyle = '#e0b020'; x.fillRect(0, 0, S, 5); x.fillRect(0, 0, 5, S);
  return T.canvasTex(c);
}
function hangarSignTexture() {
  const W = 1024, H = 768, c = T.makeCanvas(W, H), x = c.getContext('2d');
  for (let k = 0; k < 3; k++) {
    const y = k * 256;
    x.fillStyle = 'rgba(16,22,40,0.92)'; x.fillRect(0, y + 8, W, 240);
    x.fillStyle = '#f0ece2'; x.font = '400 150px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('HANGAR ' + (k + 1), W / 2, y + 128);
    x.fillStyle = '#e8a010'; x.fillRect(40, y + 30, 14, 196); x.fillRect(W - 54, y + 30, 14, 196);
  }
  return T.canvasTex(c, { repeat: false });
}
function treeTexture() {
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), r = makeRng(991);
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#3a2d22'; x.fillRect(S / 2 - 5, S * 0.6, 10, S * 0.4);
  for (let k = 0; k < 260; k++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * S * 0.36, cx = S / 2 + Math.cos(a) * rr * 1.1, cy = S * 0.42 + Math.sin(a) * rr * 0.9;
    const g = 70 + r() * 60; x.fillStyle = `rgb(${g * 0.75 | 0},${g | 0},${g * 0.45 | 0})`;
    x.beginPath(); x.arc(cx, cy, 6 + r() * 12, 0, TAU); x.fill();
  }
  const t = T.canvasTex(c, { repeat: false });
  return t;
}

function crateTexture() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d'), n = T.makeNoise(1301, 4), img = x.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) { const g = T.fbm(n, xx / S, y / S, 4, 3), plank = (y % 32) < 2 ? 0.55 : 1; const v = (150 + g * 70) * plank; const i = (y * S + xx) * 4; img.data[i] = v * 0.86; img.data[i + 1] = v * 0.66; img.data[i + 2] = v * 0.42; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  x.fillStyle = 'rgba(30,20,10,0.8)'; x.font = '700 18px Oswald, sans-serif'; x.fillText('THIS SIDE UP', 14, 70);
  return T.canvasTex(c);
}
function wrapTexture() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d'), n = T.makeNoise(1311, 4), img = x.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) { const g = T.fbm(n, xx / S, y / S, 4, 4); const v = 120 + g * 120 + Math.sin(y * 0.4 + g * 6) * 12; const i = (y * S + xx) * 4; img.data[i] = v * 0.95; img.data[i + 1] = v; img.data[i + 2] = v * 1.05; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c);
}
