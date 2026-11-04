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
import { terminalMaterials, buildConcourse, buildCargoShed, noseInDoor, TM } from './terminal.js';
const TM_OFFICE = TM.office, TM_STEEL = TM.steel, TM_YEL = TM.yellow;

const TAU = Math.PI * 2;
const SODIUM = [1.0, 0.55, 0.2];
// the city strip is near-black in its texture: lift it into the sunset haze (a black cut-out read as cardboard)
const _skyHaze = new THREE.Color(2.1, 1.85, 1.95);

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
    this.gseThin = new StaticBatch(this.gseMats);
    this._materials();
    this.wb = new StaticBatch(this.wm);
    this.tb = new StaticBatch(terminalMaterials()); // every building (concourses, sheds, hangar offices): one mesh, one draw per material
    this._ground();
    this._markings();
    this._hangars();
    this._apron();
    this._buildings();
    this._tower();
    this._fuelFarm();
    this._fieldProps();
    this._far();
    this._bounds();
    this.gse.build(this.group);
    this.gseThin.build(this.group, { cast: false });
    this._buildBlobs();
    this.wb.build(this.group);
    this.tb.build(this.group);
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
      m({ map: floorT, roughness: 0.78, metalness: 0.05, color: 0xb0b2aa }), // matte: the low sun through the door blew a polished floor out to white
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
    (opts.thin ? this.gseThin : this.gse).add(b.geometry, mtx);
    if (opts.collide !== false) this.col.addFromObject(b.colliders || [], mtx, { kind: opts.kind || 'gse', mat: 'metal' });
    if (opts.blob !== false && b.colliders?.length) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const c of b.colliders) { if (c.min[1] > 1.5) continue; x0 = Math.min(x0, c.min[0]); x1 = Math.max(x1, c.max[0]); z0 = Math.min(z0, c.min[2]); z1 = Math.max(z1, c.max[2]); }
      if (x1 > x0) this.addBlob(x, z, (x1 - x0) * 1.25 + 0.4, (z1 - z0) * 1.15 + 0.4, ry, (x0 + x1) / 2, (z0 + z1) / 2, opts.blobA ?? 0.85);
    }
    return b;
  }
  // soft contact shadow under a prop (local centre offset cx/cz rotated by ry)
  addBlob(x, z, w, d, ry = 0, cx = 0, cz = 0, a = 0.85) {
    (this.blobs ||= []).push({ x: x + Math.cos(ry) * cx + Math.sin(ry) * cz, z: z - Math.sin(ry) * cx + Math.cos(ry) * cz, w, d, ry, a });
  }
  _buildBlobs() {
    const B = this.blobs || [];
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: 0x0c0806, opacity: 0.62, polygonOffset: true, polygonOffsetFactor: -2 });
    const im = new THREE.InstancedMesh(g, mat, B.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    B.forEach((b, i) => { m.compose(v.set(b.x, 0.03, b.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.ry), new THREE.Vector3(b.w, 1, b.d)); im.setMatrixAt(i, m); });
    im.renderOrder = 3; im.frustumCulled = false; this.group.add(im);
  }

  // ---------------------------------------------------------------- ground: grass, runway, taxiways, apron
  _ground() {
    const aniso = this.aniso;
    // grass + far fields (vertex-coloured patchwork, gentle hills away from the airfield)
    const n = T.makeNoise(4401, 64), n2 = T.makeNoise(4402, 32);
    const SZ = 16000, SEG = 160; // reaches under the hills ring (r 7.2 km): no sky haze band below the mountains from the climb-out
    const gg = new THREE.PlaneGeometry(SZ, SZ, SEG, SEG); gg.rotateX(-Math.PI / 2); gg.translate(0, 0, -1100);
    const pos = gg.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const inField = Math.abs(x - 80) < 700 && z < 1100 && z > -3150;
      const d = Math.max(0, Math.max(Math.abs(x - 80) - 700, z > 1100 ? z - 1100 : z < -3150 ? -3150 - z : 0));
      const h = inField ? -0.08 : -0.08 + Math.min(1, Math.max(0, d - 400) / 1500) * (T.fbm(n, x / 6000 + 0.5, z / 6000 + 0.5, 3, 4) * 70 - 12); // flat for 400 m past the fence (approach lights, perimeter road)
      pos.setY(i, h);
      const pf = T.fbm(n2, x / 2500 + 0.3, z / 2500 + 0.7, 4, 3), wx = x + (T.fbm(n, x / 3000 + 0.1, z / 3000, 3, 3) - 0.5) * 600, wz = z + (T.fbm(n, x / 3000 + 0.6, z / 3000 + 0.3, 3, 3) - 0.5) * 600, cell = Math.floor(wx / 260) * 7 + Math.floor(wz / 210) * 13;
      const tone = (Math.sin(cell * 12.9898) * 43758.5) % 1;
      let c = inField ? [0.6, 0.55, 0.32] : tone > 0.75 ? [0.32, 0.42, 0.18] : tone > 0.5 ? [0.72, 0.58, 0.28] : tone > 0.25 ? [0.5, 0.36, 0.22] : [0.55, 0.52, 0.32];
      const k = 0.85 + pf * 0.3;
      col.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    }
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    gg.computeVertexNormals();
    const grassT = grassTexture(); grassT.anisotropy = aniso; grassT.repeat.set(SZ / 9, SZ / 9);
    const gm = new THREE.MeshStandardMaterial({ map: grassT, vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.4 });
    const macro = grassMacroTexture(); macro.anisotropy = aniso;
    gm.onBeforeCompile = (sh) => {
      sh.uniforms.macroMap = { value: macro };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;\nuniform sampler2D macroMap;').replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec4 M = texture2D(macroMap, vGW.xz / 1400.0);
          vec4 M2 = texture2D(macroMap, vGW.xz / 260.0 + 0.37);
          float field = (1.0 - smoothstep(560.0, 760.0, abs(vGW.x - 80.0))) * smoothstep(-3260.0, -3120.0, vGW.z);
          vec3 dry = vec3(1.12, 0.98, 0.7), green = vec3(0.78, 0.9, 0.62), bare = vec3(0.92, 0.78, 0.62);
          vec3 tintC = mix(mix(dry, green, M.r), bare, M.g * 0.7);
          tintC *= 0.86 + 0.24 * M2.b;
          // mowed stripes (14 m) across the infield, fading out with distance so they never shimmer
          float mow = smoothstep(0.42, 0.58, abs(fract(vGW.x / 14.0) - 0.5) * 2.0);
          field *= 1.0 - smoothstep(180.0, 320.0, abs(vGW.x)); // stripes only along the runway strip
          float dist = length(vGW - cameraPosition);
          tintC *= mix(1.0, 0.82 + 0.28 * mow, field * (1.0 - smoothstep(250.0, 800.0, dist)));
          diffuseColor.rgb *= mix(vec3(1.0), tintC, 0.85);
        }`);
    };
    const grass = new THREE.Mesh(gg, gm);
    this.grassMat = grass.material;
    grass.receiveShadow = true; this.group.add(grass);

    // asphalt (runway + taxiway + connectors + roads share one material, world-space uvs)
    const asph = asphaltTexture(); asph.map.anisotropy = aniso; asph.map.repeat.set(1 / 24, 1 / 24); asph.normal.repeat.set(1 / 24, 1 / 24);
    this.asphMat = new THREE.MeshStandardMaterial({ map: asph.map, normalMap: asph.normal, normalScale: new THREE.Vector2(0.1, 0.1), roughness: 0.8, metalness: 0, color: 0xb4ada2, envMapIntensity: 0.8 });
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
    // perimeter road around the field (from the climb-out the airfield needs an edge)
    rect(-700, -3172, -690, 1100, 0); rect(850, -3172, 860, 1100, 0);
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

    // apron concrete: every 5 m slab gets its own tint (poured at different times), a few patched / stained ones
    const conc = slabTexture(); conc.anisotropy = aniso; conc.wrapS = conc.wrapT = THREE.RepeatWrapping;
    {
      const r = makeRng(7171), P = [], U = [], C = [], S = 5, nA = T.makeNoise(7272, 8), nB = T.makeNoise(7273, 16);
      const stands = [[298, 236], [329, 150], [329, 292], [200, 300], [300, 312]];
      // per-vertex wash: big soft dirty patches, worn lanes where the tugs run, oil-soaked stands
      const wash = (x, z) => {
        let k = 0.8 + 0.34 * T.fbm(nA, x / 640, z / 640, 8, 4);
        k *= 1 - 0.1 * Math.max(0, T.fbm(nB, x / 320, z / 320, 16, 3) - 0.45) * 4;
        for (const [sx, sz] of stands) { const d = Math.hypot(x - sx, (z - sz) * 1.6); k *= 1 - 0.16 * Math.max(0, 1 - d / 26); }
        k *= 1 - 0.1 * Math.max(0, 1 - Math.abs(x - 262) / 7);      // taxilane wheel tracks
        k *= 1 - 0.14 * Math.max(0, 1 - (z - APRON.z0) / 12);       // gutter grime along the south edge
        k *= 1 - 0.12 * Math.max(0, 1 - (APRON.z1 - z) / 10);       // dirt blown out of the hangars
        return k;
      };
      for (let z = APRON.z0; z < APRON.z1; z += S) for (let x = APRON.x0; x < APRON.x1; x += S) {
        const k = 0.9 + r() * 0.13, patched = r() < 0.06, warm = (r() - 0.5) * 0.04;
        const c = patched ? [0.78, 0.76, 0.72] : [k + warm, k, k - warm * 1.5];
        const x1 = Math.min(x + S, APRON.x1), z1 = Math.min(z + S, APRON.z1);
        for (const [px, pz] of [[x, z], [x, z1], [x1, z], [x1, z], [x, z1], [x1, z1]]) { const w = wash(px, pz); P.push(px, 0.012, pz); U.push(px / 10, -pz / 10); C.push(c[0] * w, c[1] * w, c[2] * w); }
      }
      const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ag.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); ag.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); ag.computeVertexNormals();
      if (ag.attributes.normal.getY(0) < 0) { for (let i = 0; i < P.length; i += 9) { for (let k = 0; k < 3; k++) { const t = P[i + 3 + k]; P[i + 3 + k] = P[i + 6 + k]; P[i + 6 + k] = t; } } ag.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); ag.computeVertexNormals(); }
      const apron = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ map: conc, vertexColors: true, roughness: 0.88, color: 0xd6c6b0, envMapIntensity: 0.35 }));
      apron.receiveShadow = true; this.group.add(apron);
      // oil / fuel stains + tyre scuffs (one instanced decal batch)
      const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
      const sm = new THREE.MeshBasicMaterial({ map: stainTexture(), transparent: true, depthWrite: false, color: 0x120c08, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -1 });
      const N = 240, im = new THREE.InstancedMesh(sg, sm, N), m = new THREE.Matrix4();
      for (let i = 0; i < N; i++) { const sc = 1.2 + r() * 3.5; m.compose(new THREE.Vector3(APRON.x0 + 4 + r() * (APRON.x1 - APRON.x0 - 8), 0.02, APRON.z0 + 4 + r() * (APRON.z1 - APRON.z0 - 8)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(sc * (0.6 + r()), 1, sc)); im.setMatrixAt(i, m); }
      im.renderOrder = 2; im.frustumCulled = false; this.group.add(im);
      // stand numbers painted on the concrete
      for (const [txt, x, z] of [['12', 278, 252], ['14', 196, 304], ['16', 170, 226], ['18', 238, 178], ['B12', 318, 150], ['B14', 318, 212], ['B16', 318, 292]]) {
        const t = T.textTexture(txt, { font: 'Anton', size: 200, color: 'rgba(250,200,40,0.92)', stroke: 0, glow: null, padding: 10 });
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.2 * t.aspect, 3.2), new THREE.MeshStandardMaterial({ map: t.texture, transparent: true, depthWrite: false, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -3 }));
        pl.rotation.set(-Math.PI / 2, 0, Math.PI / 2); pl.position.set(x, 0.025, z); pl.renderOrder = 2; this.group.add(pl);
      }
    }
    // rubber deposits on the touchdown zones (both ends) + tyre streaks
    const rub = new THREE.MeshBasicMaterial({ map: rubberTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
    {
      const tg = new THREE.PlaneGeometry(1, 1); tg.rotateX(-Math.PI / 2);
      const tm = new THREE.MeshBasicMaterial({ map: rubberTexture(), transparent: true, depthWrite: false, color: 0x000000, opacity: 0.42, polygonOffset: true, polygonOffsetFactor: -2 });
      const r = makeRng(6262), N = 260, im = new THREE.InstancedMesh(tg, tm, N), m = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < N; i++) { const z = RWY.z0 - 60 - r() * (RWY.z0 - RWY.z1 - 120), x = (r() < 0.5 ? -1 : 1) * (2 + r() * 9); m.compose(new THREE.Vector3(x, 0.028, z), q.setFromAxisAngle(ax, (r() - 0.5) * 0.02), new THREE.Vector3(1.2 + r() * 2.2, 1, 30 + r() * 90)); im.setMatrixAt(i, m); }
      im.renderOrder = 1; im.frustumCulled = false; this.group.add(im);
    }
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
    for (const Z of [150, 212, 292]) {
      quad(Y, 262, Z, 350, Z, 0.25);                                   // lead-in centreline from the taxilane
      quad(W, 348.5, Z - 3, 348.5, Z + 3, 0.6);                         // stop bar
      for (const [a, b, c, d] of [[302, Z - 22, 302, Z + 22], [302, Z - 22, 338, Z - 22], [302, Z + 22, 338, Z + 22]]) quad(R2, a, b, c, d, 0.3); // equipment restraint area
      for (let k = 0; k < 6; k++) quad(W, 340 - k * 6, Z - 26, 337 - k * 6, Z - 26, 0.3); // service road dashes
    }
    quad(Y, 262, APRON.z0 + 4, 262, APRON.z1 - 6, 0.25);               // taxilane
    // remote stands: curved lead-ins off the apron edge line, stop bars, hatched no-parking boxes, wingtip clearance lines
    for (const [sx, sz] of [[300, 235], [200, 300]]) {
      let px = APRON.x0 + 2, pz = sz - 18;
      for (let k = 1; k <= 12; k++) { const t = k / 12, nx = APRON.x0 + 2 + t * 24, nz = sz - 18 * Math.cos(t * Math.PI / 2); quad(Y, px, pz, nx, nz, 0.2); px = nx; pz = nz; }
      quad(W, sx - 15, sz - 2.5, sx - 15, sz + 2.5, 0.5);
      for (let k = 0; k < 7; k++) quad(Y, sx + 22 + k * 1.6, sz - 6, sx + 22 + k * 1.6 + 3, sz + 6, 0.25);
    }
    // service road along the hangar fronts (white edge lines + dashed centre)
    for (const z of [324, 314]) quad(W, APRON.x0 + 2, z, APRON.x1 - 2, z, 0.2);
    for (let x = APRON.x0 + 4; x < APRON.x1 - 6; x += 9) quad(W, x, 319, x + 4.5, 319, 0.15);
    for (let z = APRON.z0 + 10; z < APRON.z1 - 10; z += 12) quad(Y, 259.5, z, 259.5, z + 6, 0.12), quad(Y, 264.5, z, 264.5, z + 6, 0.12);
    const RAIL = [];
    for (const h of HANGARS) { quad(RAIL, h.x - h.w / 2 + 1, h.z - 1.0, h.x + h.w / 2 - 1, h.z - 1.0, 0.12); for (let x = h.x - h.w / 2 + 2; x < h.x + h.w / 2 - 2; x += 3) quad(Y, x, h.z - 1, x + 2, h.z - 3, 0.3); }
    const pos = [], uv = [], colr = [], idx = [];
    const emit = (list, c, y) => list.forEach((l) => {
      const b = pos.length / 3;
      pos.push(l[0], y, l[1], l[2], y, l[3], l[4], y, l[5], l[6], y, l[7]);
      uv.push(0, 0, 0, 1, l[8] / 6, 0, l[8] / 6, 1);
      for (let k = 0; k < 4; k++) colr.push(...c);
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    });
    emit(W, [0.84, 0.83, 0.8], 0.02); emit(Y, [0.98, 0.72, 0.12], 0.022); emit(R2, [0.75, 0.12, 0.08], 0.022); emit(RAIL, [0.22, 0.22, 0.23], 0.024); // door rails: steel strips at the door line (a red stripe 12 m out read as a smear)
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
    this._sunShafts();
    this._hangarInterior();
    for (const h of HANGARS) { this.addBlob(h.x - h.w / 2 + 1, h.z + h.d / 2, 4, h.d, 0, 0, 0); this.addBlob(h.x + h.w / 2 - 1, h.z + h.d / 2, 4, h.d); this.addBlob(h.x, h.z + h.d - 1.5, h.w, 5); }
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
      this.addBlob(cx, cz, s * 1.6, s * 1.6);
    }
    this._w(box(4, 1.0, 1.2), w.steel, M4(h2.x - 18, 0.5, h2.z + 30)); this.col.add([h2.x - 20, 0, h2.z + 29.4], [h2.x - 16, 1.0, h2.z + 30.6], { kind: 'gse', mat: 'metal' });
    // hangar 1: an airliner in for maintenance, nose out
    const jet = buildAirliner('haven');
    jet.root.position.set(HANGARS[0].x, 0, HANGARS[0].z + 21); jet.root.rotation.y = 0;
    this.group.add(jet.root); this.hangarJet = jet;
    this.addBlob(HANGARS[0].x, HANGARS[0].z + 21, 5.5, 38); this.addBlob(HANGARS[0].x, HANGARS[0].z + 21.5, 36, 8);
    this._jetColliders(jet, HANGARS[0].x, HANGARS[0].z + 21, 0);
  }
  // hangar interiors: warm light pools under the lamps, grimy wall liners that take the lamp spill, oil on the floor,
  // a mezzanine office on the back wall, maintenance clutter in hangar 2 (the start)
  _hangarInterior() {
    const r = makeRng(3131), TMat = terminalMaterials();
    // light pools (additive, instanced)
    const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: new THREE.Color(0.3, 0.22, 0.13), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 });
    const pools = new THREE.InstancedMesh(pg, poolMat, this.hangarLamps.length), m = new THREE.Matrix4();
    this.hangarLamps.forEach((p, i) => { m.compose(new THREE.Vector3(p.x, 0.035, p.z), new THREE.Quaternion(), new THREE.Vector3(9, 1, 9)); pools.setMatrixAt(i, m); });
    pools.renderOrder = 4; pools.frustumCulled = false; this.group.add(pools); this.poolMat = poolMat;
    // wall liners: vertex-coloured (dark grimy base, lamp-warmed top), slightly self-lit so the inside never crushes to flat grey
    const corr = corrugatedTexture(true, false); corr.repeat.set(1 / 4, 1 / 8);
    const liner = new THREE.MeshStandardMaterial({ map: corr, vertexColors: true, roughness: 0.6, metalness: 0.35, emissive: 0x3a2a1a, emissiveIntensity: 0.55, side: THREE.DoubleSide });
    const parts = [];
    const wall = (w, h, x, z, ry) => {
      const g = new THREE.PlaneGeometry(w, h, Math.ceil(w / 6), 6); const uv = g.attributes.uv, P = g.attributes.position, C = new Float32Array(P.count * 3);
      for (let i = 0; i < P.count; i++) { uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); const v = (P.getY(i) + h / 2) / h, k = (0.38 + 0.62 * Math.pow(v, 0.6)) * (0.9 + 0.2 * r()); C[i * 3] = k * 1.05; C[i * 3 + 1] = k; C[i * 3 + 2] = k * 0.9; }
      g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.rotateY(ry); g.translate(x, h / 2, z); parts.push(g);
    };
    for (const h of HANGARS) {
      const x0 = h.x - h.w / 2, x1 = h.x + h.w / 2, z1 = h.z + h.d;
      wall(h.d - 1, 14.2, x0 + 0.45, h.z + h.d / 2, Math.PI / 2);
      wall(h.d - 1, 14.2, x1 - 0.45, h.z + h.d / 2, -Math.PI / 2);
      wall(h.w - 1, 14.2, h.x, z1 - 0.45, Math.PI);
      // inside faces of the door leaves (same layout as _hangars)
      const span = h.w - 5.2, leafW = span / 6 + 0.4, leafH = 14.5 - 2.2;
      for (let k = 0; k < 6; k++) {
        const side = k < 3 ? -1 : 1, j = k < 3 ? k : 5 - k;
        const closedX = h.x - span / 2 + (k + 0.5) * span / 6, parkX = h.x + side * (span / 2 - leafW / 2 - j * 0.15);
        wall(leafW, leafH, closedX + (parkX - closedX) * h.door, h.z - 0.3 - j * 0.35 + 0.15, 0);
      }
    }
    const lm = new THREE.Mesh(mergeGeometries(parts), liner); lm.receiveShadow = true; this.group.add(lm);
    // mezzanine office along each back wall: lit ribbon windows above a dark store
    const off = [];
    for (const h of HANGARS) {
      const z1 = h.z + h.d - 0.5;
      off.push([box(24, 3.4, 0.2).translate(h.x - 8, 7.2, z1 - 0.1), TM_OFFICE]);
      off.push([box(24, 0.3, 3.2).translate(h.x - 8, 5.4, z1 - 1.6), TM_STEEL]);
      off.push([box(24, 0.15, 0.06).translate(h.x - 8, 6.5, z1 - 3.15), TM_YEL]);
      for (let x = -19; x <= 3; x += 5.5) off.push([box(0.2, 5.4, 0.2).translate(h.x + x, 2.7, z1 - 3.1), TM_STEEL]);
    }
    this.tb.add(mergeGrouped(off, TMat.length).geometry);
    // floor: oil + tyre stains, painted walkway lines (into the shared stain / paint batches would need the apron's uvs; own small batch)
    const sm = new THREE.MeshBasicMaterial({ map: stainTexture(), transparent: true, depthWrite: false, color: 0x120c08, opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -2 });
    const N = 36, im = new THREE.InstancedMesh(pg, sm, N);
    for (let i = 0; i < N; i++) { const h = HANGARS[i % 3], sc = 0.8 + r() * 2.6; m.compose(new THREE.Vector3(h.x + (r() - 0.5) * (h.w - 8), 0.03, h.z + 3 + r() * (h.d - 8)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * TAU), new THREE.Vector3(sc * (0.6 + r()), 1, sc)); im.setMatrixAt(i, m); }
    im.renderOrder = 2; im.frustumCulled = false; this.group.add(im);
    // hangar 2 clutter: maintenance platform, tyre stack, drums, a parked tug + carts, a GPU
    const h2 = HANGARS[1], w = this.W;
    const px = h2.x + 10, pz = h2.z + 15.5;
    for (const [dx, dz] of [[-2, -1.4], [2, -1.4], [-2, 1.4], [2, 1.4]]) this._w(box(0.14, 4.2, 0.14), w.yellow, M4(px + dx, 2.1, pz + dz));
    this._w(box(4.4, 0.12, 3.0), w.steel, M4(px, 4.2, pz)); this._w(box(4.4, 0.08, 0.06), w.yellow, M4(px, 5.2, pz - 1.5)); this._w(box(4.4, 0.08, 0.06), w.yellow, M4(px, 5.2, pz + 1.5));
    for (let k = 0; k < 8; k++) this._w(box(0.9, 0.06, 0.3), w.steel, M4(px - 3.2, 0.3 + k * 0.5, pz - 1.0 + k * 0.32));
    this.col.add([px - 2.2, 0, pz - 1.6], [px + 2.2, 4.3, pz + 1.6], { kind: 'gse', mat: 'metal' });
    for (let k = 0; k < 5; k++) this._w(cyl(0.55, 0.55, 0.32, 14), w.dark, M4(h2.x - 22, 0.16 + k * 0.33, h2.z + 20 + (k % 2) * 0.05));
    this.col.add([h2.x - 22.6, 0, h2.z + 19.4], [h2.x - 21.4, 1.7, h2.z + 20.6], { kind: 'gse', mat: 'rubber' });
    this._place(G.buildTug(), h2.x - 14, h2.z + 36, 1.4);
    this._place(G.buildCart(7), h2.x - 9.5, h2.z + 36.4, 1.5);
    this._place(G.buildGPU(), h2.x + 20, h2.z + 30, -0.6);
    this._place(G.buildULD(), h2.x + 22, h2.z + 12, 0.1); this._place(G.buildULD(), h2.x + 22, h2.z + 14.3, 0.05);
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
    this.addBlob(298, 236, 5.5, 38, Math.PI / 2); this.addBlob(298 - 0.5, 236, 36, 8, Math.PI / 2, 0, 0.5);
    this._jetColliders(jet, 298, 236, Math.PI / 2);
    // stair truck at its front door, belt loader at the aft hold
    this._place(G.buildStairTruck(), 283.2, 233.6, Math.PI / 2 + 0.05);
    this._place(G.buildBeltLoader(), 307, 231.2, -Math.PI / 2 + 0.35);
    this._place(G.buildGPU(), 278, 240.5, 0.4);
    // perch: stair truck in the middle of zone A, and one near the taxiway
    // axis-aligned (colliders are AABBs: a rotated truck inflates its platform box past the real deck, and the
    // perched goon walked off into thin air); perches[] = the platform centres the director spawns on
    this.stairs = [[204, 318, 0], [176, 172, Math.PI]];
    this.perches = this.stairs.map(([x, z, ry]) => ({ x: x + Math.sin(ry) * G.STAIR_TOP.z, z: z + Math.cos(ry) * G.STAIR_TOP.z, y: G.STAIR_TOP.y }));
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
        this.addBlob(x + ox, z + oz, 2.8, 2.4, ry);
      }
    }
    // tall midground shapes along the walking line: catering high-loaders (lifted), crew buses, barrier runs
    // (axis-aligned so their AABB colliders match what you see)
    for (const [x, z, ry, lift] of [[246, 280, 0, 0.7], [182, 262, Math.PI / 2, 0.2], [268, 226, Math.PI, 0.9], [160, 196, 0, 0.5], [290, 330, Math.PI / 2, 0.0]]) this._place(G.buildCateringTruck(lift), x, z, ry);
    for (const [x, z, ry] of [[196, 246, Math.PI / 2], [276, 300, 0], [150, 330, Math.PI / 2], [232, 176, Math.PI / 2]]) this._place(G.buildCrewBus(), x, z, ry);
    for (const [x, z, ry, n] of [[132, 300, 0, 5], [132, 222, 0, 4], [300, 160, 0, 3], [200, 345, 0, 2], [264, 345, 0, 2]]) this._place(G.buildBarriers(n), x, z, ry);
    // GPUs, belt loader, blast fence near the taxiway edge
    for (const [x, z, ry] of [[232, 330, 0.3], [182, 288, 2.0], [140, 232, 1.0]]) this._place(G.buildGPU(), x, z, ry);
    this._place(G.buildBeltLoader(), 230, 265, 0.9);
    this._place(G.buildBlastFence(), 136, 260, Math.PI / 2 - 0.1);
    // cones
    const cone = G.buildCone();
    for (let k = 0; k < 40; k++) { const x = 130 + r() * 200, z = 100 + r() * 230; this._place(cone, x, z, r() * TAU, { collide: false, thin: true }); }
    for (let z = 96; z < 330; z += 9) this._place(cone, APRON.x0 + 2.2, z, 0, { collide: false, thin: true });
    // light masts (sodium)
    this.masts = [];
    const mast = G.buildMast();
    for (const [x, z] of [[150, 304], [244, 292], [306, 322], [196, 214], [284, 190], [150, 148], [226, 128], [318, 120]]) {
      this._place(mast, x, z, Math.atan2(-(232 - x), -(220 - z)), { kind: 'mast', thin: true });
      const ry = Math.atan2(-(232 - x), -(220 - z)), m = M4(x, 0, z, ry);
      this.masts.push({ x, z, lamps: mast.lamps.map(p => p.clone().applyMatrix4(m)) });
    }
    // taxiway signs at the apron edge / connectors
    for (const [x, z, row, ry] of [[123, 160, 0, Math.PI / 2], [123, 300, 3, Math.PI / 2], [100, 136, 1, 0], [82, 166, 2, 0], [100, -138, 1, 0]]) this._place(G.buildSign(row), x, z, ry);
  }

  // ---------------------------------------------------------------- concourse B + cargo shed: the apron's midground
  _buildings() {
    const mats = terminalMaterials();
    void mats; const add = (geo, mtx = null) => this.tb.add(geo, mtx);
    // nose-in airliners at gates B12 / B16 (B14 sits empty with its bridge parked)
    const X = 358 - 10 - 18.6, gates = [];
    this.gateJets = [];
    for (const [Z, liv, label] of [[150, 'nordair', 1], [212, null, 2], [292, 'coral', 3]]) {
      if (liv) {
        const jet = buildAirliner(liv);
        jet.root.position.set(X, 0, Z); jet.root.rotation.y = -Math.PI / 2;
        this.group.add(jet.root); this.gateJets.push(jet);
        this.addBlob(X, Z, 5.5, 38, -Math.PI / 2); this.addBlob(X + 0.5, Z, 36, 8, -Math.PI / 2);
        this._jetColliders(jet, X, Z, -Math.PI / 2);
        // a catering truck and a belt loader working the turn
        this._place(G.buildBeltLoader(), X - 6, Z + 4.2, Math.PI / 2 + 0.3);
        this._place(G.buildGPU(), X + 12, Z + 5, 0.2);
        this._place(G.buildTug(), X - 22, Z - 1.5, Math.PI / 2);
        for (let k = 0; k < 3; k++) this._place(G.buildCart(100 + Z + k), X - 4 - k * 3.6, Z + 9 + (k % 2) * 0.4, Math.PI / 2 + 0.05);
      }
      gates.push({ z: Z, door: liv ? noseInDoor(X, Z) : null, label });
    }
    add(buildConcourse({ x0: 358, z0: 96, z1: 336, gates, seed: 11, sign: 0 }));
    // service road + bollards between the gates and the building (stops the apron ending in a blank strip)
    this.lights.push(...[150, 212, 292].map(z => ({ p: new THREE.Vector3(358 - 4.5, 11.3, z - 16), kind: 'obst', size: 0.9 })));
    // HAVEN AIR CARGO shed on the south edge: a dark, backlit block between the apron and the sun
    add(buildCargoShed({ x0: 136, x1: 262, z0: 38, z1: 74, seed: 5 }));
    for (let x = 146; x < 258; x += 18) this.lights.push({ p: new THREE.Vector3(x, 8.2, 74.6), kind: 'sodium', size: 1.6 });
    // cargo / maintenance sheds down the east side of taxiway A: something big streams past on the right during the chase
    {
      const r = makeRng(5151);
      for (const [z, sign, w] of [[-330, 8, 110], [-640, 9, 90], [-980, 4, 120], [-1380, 8, 100]]) {
        const geo = buildCargoShed({ x0: -w / 2, x1: w / 2, z0: -36, z1: 0, seed: 40 + z, sign });
        const px = 210 + r() * 20; add(geo, M4(px, 0, z, -Math.PI / 2));
        // slab in front of the doors
        const pg = new THREE.PlaneGeometry(55, w + 10), uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 55, uv.getY(i) * (w + 10));
        pg.rotateX(-Math.PI / 2); this._w(pg, this.W.conc, M4(px - 27.5, 0.01, z));
      }
    }
    // trailers + containers at the docks
    for (const [x, z, ry] of [[170, 84.5, 0.04], [196, 85, -0.03], [222, 84.6, 0.02]]) this._place(G.buildULD(), x, z, ry);
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
    // passenger terminal across the runway: the same concourse kit, facing the runway, with gates and two parked jets
    // (the old emissive box read as a fullbright orange strip on the horizon)
    {
      const grp = new THREE.Group(), gates = [];
      for (const [Z, liv, label] of [[-200, 'haven', null], [-120, null, null], [-40, 'sunwest', null], [40, null, null], [120, 'pacifica', null], [200, null, null]]) {
        if (liv) { const jet = buildAirliner(liv); jet.root.position.set(-28.6, 0, Z); jet.root.rotation.y = -Math.PI / 2; grp.add(jet.root); }
        gates.push({ z: Z, door: liv ? noseInDoor(-28.6, Z) : null, label });
      }
      this.tb.add(buildConcourse({ x0: 0, z0: -260, z1: 260, d: 30, gates, seed: 23, sign: 6 }), M4(-315, 0, -700, Math.PI));
      grp.rotation.y = Math.PI; grp.position.set(-315, 0, -700); this.group.add(grp);
    }
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
    // taxiway direction signs at every connector, both sides (double-faced)
    for (const C of CONNECTORS) { this._place(G.buildSign(0), RWY.halfW + RWY.shoulder + 9, C.z1 - 26, Math.PI / 2, { collide: false }); this._place(G.buildSign(1), TWY.x - TWY.halfW - 6, C.z0 - 24, Math.PI / 2, { collide: false }); }
    // approach light towers past the far end too (runway 09's approach: you see them from the hold)
    for (let z = RWY.z1 - 30; z >= RWY.z1 - 390; z -= 30) { this._w(box(0.2, 1.2 + (RWY.z1 - z) * 0.004, 0.2), w.steel, M4(0, 0.6, z)); this._w(box(14, 0.15, 0.15), w.steel, M4(0, 1.2 + (RWY.z1 - z) * 0.004, z)); }
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
    const n = T.makeNoise(9301, 24), sunAz = Math.atan2(SUN_DIR.x, SUN_DIR.z);
    const R0 = 7200;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const h = 60 + T.fbm(n, i / segs, 0.5, 24, 5) * 520 + Math.max(0, Math.sin(a * 3 + 1)) * 160; // wraps seamlessly (noise period = fbm base)
      const toSun = Math.max(0, Math.cos(a - sunAz));
      const base = [0.42 + 0.2 * toSun, 0.36 + 0.06 * toSun, 0.5 - 0.15 * toSun], top = [0.62 + 0.25 * toSun, 0.45 + 0.1 * toSun, 0.62 - 0.2 * toSun];
      const cx = 80 + sa * R0, cz = -1100 + ca * R0;
      pos.push(cx, -20, cz, cx, h, cz); colr.push(...base.map(v => v * 0.55), ...top.map(v => v * 0.75));
      if (i < segs) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); hg.setIndex(idx);
    const hills = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    hills.renderOrder = -40; this.group.add(hills);
    this.hillsMat = hills.material;
    // city skyline strip to the north-east (+x)
    const sky = T.skylineTexture(4242); sky.repeat.set(3, 1);
    const cityMat = new THREE.MeshBasicMaterial({ map: sky, transparent: true, fog: false, color: _skyHaze.clone(), depthWrite: false });
    this.skylineMat = cityMat;
    for (const [x, z, ry, w, hgt] of [[3000, -400, -Math.PI / 2, 4200, 260], [2200, 1800, -2.4, 2600, 180]]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), cityMat); pl.position.set(x, hgt / 2 - 10, z); pl.rotation.y = ry; pl.renderOrder = -39; this.group.add(pl);
    }
    this._cityLights();
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
  // ---------------------------------------------------------------- low sun pouring through the hangar doors (additive shaft sheets)
  _sunShafts() {
    const W = 64, H = 256, c = T.makeCanvas(W, H), x = c.getContext('2d'), r = makeRng(6061);
    const img = x.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const u = xx / W, v = 1 - y / H; // u across the sheet (height), v along the beam (0 = door; canvas rows are flipped into uv)
      const a = Math.pow(Math.sin(u * Math.PI), 1.5) * Math.pow(1 - v, 1.6) * Math.min(1, v * 12) * (0.75 + 0.25 * Math.sin(u * 40 + v * 3));
      const i = (y * W + xx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255 * a; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const mat = this.shaftMat = new THREE.MeshBasicMaterial({ map: T.canvasTex(c, { repeat: false }), color: new THREE.Color(1.0, 0.62, 0.32), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const dir = new THREE.Vector3(-SUN_DIR.x, -Math.max(0.08, SUN_DIR.y), -SUN_DIR.z).normalize(); // light travels into the hangar (+z)
    for (const h of HANGARS) {
      const open = (h.w - 5.2) * (1 - h.door) * 0.5 + 2.6, gap = (h.w - 5.2) * h.door; // the opening between the parked leaves
      for (let k = 0; k < 7; k++) {
        const len = 22 + r() * 14, hh = 6 + r() * 6;
        const g = new THREE.PlaneGeometry(hh, len); // x = height, y = along the beam
        const pl = new THREE.Mesh(g, mat);
        const px = h.x - gap / 2 + 1 + r() * (gap - 2), py = 1.5 + hh / 2 + r() * 3;
        // orient: plane y-axis along the beam, plane x-axis vertical-ish, facing sideways
        const along = dir.clone(), up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(along, up).normalize(), vert = new THREE.Vector3().crossVectors(side, along).normalize();
        const tilt = (k / 7) * Math.PI + (r() - 0.5) * 0.3; side.applyAxisAngle(along, tilt); vert.applyAxisAngle(along, tilt); // fan of sheets so some face any viewer
        pl.matrix.makeBasis(vert, along, side); pl.matrix.setPosition(px + along.x * len / 2, py + along.y * len / 2, h.z - 0.5 + along.z * len / 2);
        pl.matrixAutoUpdate = false; pl.renderOrder = 5; this.group.add(pl);
      }
    }
  }
  // ---------------------------------------------------------------- city lights (blue hour: the sprawl around the field)
  // Additive street-light texture on big ground planes around the airport; fades in with dusk (credits view from the ramp).
  _cityLights() {
    const S = 1024, c = T.makeCanvas(S, S), x = c.getContext('2d'), r = makeRng(8181);
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    // neighbourhood density (a few bright cores, dark parks / fields between)
    const cores = []; for (let k = 0; k < 7; k++) cores.push([r() * S, r() * S, 150 + r() * 230, 0.7 + r() * 0.6]);
    const dens = (px, py) => { let d = -0.12; for (const [cx, cy, rr, w] of cores) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const q = Math.hypot(px - cx - ox, py - cy - oy) / rr; if (q < 1) d += w * (1 - q * q); } return Math.max(0, Math.min(1, d)); };
    const dot = (px, py, sz, col) => { x.fillStyle = col; x.fillRect(((px % S) + S) % S, ((py % S) + S) % S, sz, sz); };
    const SOD = ['rgba(255,150,55,', 'rgba(255,175,80,', 'rgba(255,205,140,'], WHT = 'rgba(235,240,255,';
    // street grid in rotated districts
    for (let d = 0; d < 6; d++) {
      const cx = r() * S, cy = r() * S, ang = r() * Math.PI, step = 22 + r() * 18, ext = 260 + r() * 220;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let u = -ext; u <= ext; u += step) for (let v = -ext; v <= ext; v += 6) for (const [a1, b1] of [[u, v], [v, u]]) {
        const px = cx + a1 * ca - b1 * sa, py = cy + a1 * sa + b1 * ca, k = dens(((px % S) + S) % S, ((py % S) + S) % S) * (1 - Math.max(Math.abs(a1), Math.abs(b1)) / ext * 0.6);
        if (k > 0.04 && r() < k * 0.9) dot(px, py, r() < 0.15 ? 3 : 2, (r() < 0.82 ? SOD[Math.floor(r() * 3)] : WHT) + (0.35 + 0.65 * k).toFixed(2) + ')');
      }
    }
    // arterials + a highway with headlight / taillight strings
    for (let k = 0; k < 7; k++) {
      let px = r() * S, py = r() * S, a = r() * Math.PI * 2; const hw = k < 2;
      for (let i = 0; i < 520; i++) {
        a += (r() - 0.5) * 0.04; px += Math.cos(a) * 3; py += Math.sin(a) * 3;
        if (i % (hw ? 2 : 3) === 0) dot(px, py, hw ? 3 : 2, SOD[1] + (hw ? 1 : 0.75) + ')');
        if (hw && r() < 0.5) { dot(px + Math.sin(a) * 4, py - Math.cos(a) * 4, 2, WHT + '0.9)'); dot(px - Math.sin(a) * 4, py + Math.cos(a) * 4, 2, 'rgba(255,40,20,0.85)'); }
      }
    }
    // red obstruction lights on the tall stuff
    for (let k = 0; k < 40; k++) dot(r() * S, r() * S, 3, 'rgba(255,30,20,0.9)');
    const tex = T.canvasTex(c, { aniso: 8 });
    const mat = this.cityMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0, toneMapped: false });
    mat.color.setScalar(2.4);
    mat.polygonOffset = true; mat.polygonOffsetFactor = -8; mat.polygonOffsetUnits = -64; // kilometres out, 2 m over the grass is below depth precision // dots are sub-pixel at range: mip-averaged they need HDR punch
    // west, east and south of the field (the airport itself + its approach stay dark)
    const tile = 1150; // smaller dots (the near field from 120 m read as confetti)
    for (const [x0, x1, z0, z1, rot] of [[-7000, -720, -6800, 3600, 0.3], [820, 7000, -6800, 3600, 1.1], [-720, 820, 1150, 6500, 2.2], [-720, 820, -6800, -3300, 0.7]]) {
      const w = x1 - x0, d = z1 - z0, g = new THREE.PlaneGeometry(w, d, 32, 32);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i) * w / tile, v = uv.getY(i) * d / tile; uv.setXY(i, u * Math.cos(rot) - v * Math.sin(rot) + rot * 3.1, u * Math.sin(rot) + v * Math.cos(rot)); }
      // soft, ragged edge toward the airfield (no ruler-straight boundary); additive => vertex colour is the fade
      const P = g.attributes.position, col = new Float32Array(P.count * 3), n = T.makeNoise(4700 + Math.round(rot * 10), 16);
      for (let i = 0; i < P.count; i++) {
        const wx = (x0 + x1) / 2 + P.getX(i), wz = (z0 + z1) / 2 - P.getY(i);
        const dx = Math.max(-720 - wx, wx - 820, 0), dz = Math.max(wz - 1150, -3300 - wz, 0); // distance outside the dark airfield corridor
        const edge = Math.max(dx, dz) - 160 * T.fbm(n, wx / 1400, wz / 1400, 3, 16);
        const k = Math.min(1, Math.max(0, edge / 520)) * (0.55 + 0.45 * T.fbm(n, wx / 2300 + 7, wz / 2300, 3, 16) * 1.6);
        const far = Math.min(1, Math.max(0, 1 - (Math.hypot(wx - 80, wz + 1100) - 2600) / 2200)); // thin out toward the horizon (no bright seam of mip-averaged dots)
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1, k) * far;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 2, (z0 + z1) / 2);
      const m = new THREE.Mesh(g, mat); m.renderOrder = -30; m.frustumCulled = false; this.group.add(m);
    }
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
    for (let z = R.z1 - 30; z >= R.z1 - 390; z -= 30) for (let x = -6; x <= 6; x += 3) L.push({ p: new THREE.Vector3(x, 1.3 + (R.z1 - z) * 0.004, z), kind: 'appr', size: 1.1 });
    for (let z = TWY.z0; z >= -900; z -= 30) for (const s of [-1, 1]) L.push({ p: new THREE.Vector3(TWY.x + s * (TWY.halfW + 0.6), 0.3, z), kind: 'blue', size: 0.7 });
    for (let z = TWY.z0; z >= -900; z -= 15) L.push({ p: new THREE.Vector3(TWY.x, 0.04, z), kind: 'twycl', size: 0.4 });
    for (const m of this.masts) for (const p of m.lamps) L.push({ p, kind: 'sodium', size: 3.2 });
    for (const p of this.hangarLamps) L.push({ p, kind: 'hangar', size: 1.9 });
    for (const h of HANGARS) for (const s of [-1, 1]) L.push({ p: new THREE.Vector3(h.x + s * (h.w / 2 - 0.5), 14.9, h.z - 0.2), kind: 'obst', size: 1.2 });
    for (const t of this.tanks) L.push({ p: t.clone().setY(12.7), kind: 'obst', size: 1.0 });
    L.push({ p: this.towerBeacon, kind: 'beacon', size: 5 });
    // PAPI (4 boxes left of the touchdown zone)
    for (let k = 0; k < 4; k++) L.push({ p: new THREE.Vector3(-R.halfW - 15 - k * 9, 0.8, R.z0 - 330), kind: 'papi', size: 1.6, phase: k });
    this._fixtures(L);
    this.glow = new BillboardBatch(L.length + 160, this.E.atlas, { boost: 1, renderOrder: 6, fog: this.scene.fog });
    this.scene.add(this.glow.mesh);
    this.extraGlows = []; // per-frame glows from other systems (aircraft nav lights, jeep beacons)
    // fog-free glows for kilometres-away fires (fog would mix them into a pale haze blob)
    this.farGlow = new BillboardBatch(24, this.E.atlas, { boost: 1, renderOrder: 12, fog: { color: new THREE.Color(0, 0, 0), near: 1e7, far: 2e7 } });
    this.scene.add(this.farGlow.mesh);
    this.farGlows = [];
  }
  // physical light fixtures under the glows (the lights hovered over the runway with nothing under them) and
  // distance-remaining boards every 300 m down both sides of the runway: they stream past during the chase
  _fixtures(L) {
    const pick = L.filter(l => l.kind === 'edge' || l.kind === 'blue' || l.kind === 'green' || l.kind === 'red' || l.kind === 'papi');
    const g = mergeGeometries([cyl(0.05, 0.07, 0.3, 6).translate(0, 0.15, 0), cyl(0.11, 0.1, 0.12, 8).translate(0, 0.32, 0), box(0.3, 0.06, 0.3).translate(0, 0.03, 0)]);
    const pg = mergeGeometries([box(1.6, 0.5, 0.7).translate(0, 0.45, 0), box(0.1, 0.2, 0.1).translate(-0.5, 0.1, 0), box(0.1, 0.2, 0.1).translate(0.5, 0.1, 0)]);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.5, metalness: 0.6 });
    const im = new THREE.InstancedMesh(g, mat, pick.length), pm = new THREE.InstancedMesh(pg, mat, 8), m = new THREE.Matrix4(), q = new THREE.Quaternion();
    let pi = 0;
    pick.forEach((l, i) => {
      if (l.kind === 'papi') { m.compose(new THREE.Vector3(l.p.x, 0, l.p.z), q, new THREE.Vector3(1, 1, 1)); pm.setMatrixAt(pi++, m); l.p.y = 0.6; m.makeScale(0, 0, 0); im.setMatrixAt(i, m); return; }
      m.compose(new THREE.Vector3(l.p.x, 0, l.p.z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m); l.p.y = 0.4;
    });
    pm.count = pi; this.group.add(im, pm);
    // distance-remaining signs: black boards, white numerals (thousands of feet left), both faces
    const S = 512, c = T.makeCanvas(S, 64), x = c.getContext('2d');
    x.fillStyle = '#121314'; x.fillRect(0, 0, S, 64); x.fillStyle = '#f4f2ea'; x.font = '400 54px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let k = 0; k < 8; k++) x.fillText(String(k + 1), k * 64 + 32, 34);
    const tex = T.canvasTex(c, { repeat: false });
    const face = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, roughness: 0.6 });
    const faces = [], bodies = [];
    for (let k = 1; k <= 8; k++) for (const sd of [-1, 1]) {
      const z = sd < 0 ? RWY.z1 + k * 305 : RWY.z0 - k * 305; // left side counts down toward the far end, right side toward the threshold
      if (z > RWY.z0 || z < RWY.z1) continue;
      const num = Math.max(1, Math.min(8, sd < 0 ? Math.round((z - RWY.z1) / 305) : Math.round((RWY.z0 - z) / 305)));
      const X = sd * (RWY.halfW + 22);
      bodies.push(box(2.6, 1.9, 0.35).translate(X, 1.25, z), box(0.18, 0.5, 0.18).translate(X - 0.9, 0.25, z), box(0.18, 0.5, 0.18).translate(X + 0.9, 0.25, z));
      for (const f of [1, -1]) {
        const pl = new THREE.PlaneGeometry(2.3, 1.6); const uv = pl.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, (num - 1 + 0.12 + uv.getX(i) * 0.76) / 8);
        if (f < 0) pl.rotateY(Math.PI);
        pl.translate(X, 1.25, z + f * 0.18); faces.push(pl);
      }
    }
    const bm = new THREE.Mesh(mergeGeometries(bodies), mat), fm = new THREE.Mesh(mergeGeometries(faces), face);
    bm.castShadow = true; this.group.add(bm, fm);
  }

  addFarGlow(p, size, r, g, b, a = 1) { this.farGlows.push([p.x, p.y, p.z, size, r, g, b, a]); }
  addGlow(p, size, r, g, b, a = 1) { this.extraGlows.push([p.x, p.y, p.z, size, r, g, b, a]); }

  update(dt, head, dusk) {
    this.time += dt;
    const t = this.time, G = this.glow;
    const on = 0.55 + 0.45 * Math.min(1, dusk * 2.2); // runway lights are on at sunset, brighter at blue hour
    if (this.shaftMat) this.shaftMat.opacity = 0.45 * Math.max(0, 1 - dusk * 3);
    if (this.hillsMat) { const n = Math.min(1, Math.max(0, (dusk - 0.2) / 0.4)); this.hillsMat.color.setScalar(1 - 0.62 * n); this.skylineMat.color.copy(_skyHaze).multiplyScalar(1 - 0.62 * n); }
    if (this.grassMat) { const n = Math.min(1, Math.max(0, (dusk - 0.2) / 0.4)); this.grassMat.color.setRGB(1 - 0.62 * n, 1 - 0.6 * n, 1 - 0.5 * n); } // fields sink into blue hour
    if (this.cityMat) { const k = Math.min(1, Math.max(0, (dusk - 0.25) / 0.3)); this.cityMat.opacity = k * k * (3 - 2 * k); this.cityMat.visible = k > 0.001; }
    let gi = 0;
    for (const L of this.lights) {
      const p = L.p, d = Math.hypot(p.x - head.x, p.y - head.y, p.z - head.z);
      // keep a minimum angular size so lights read as points far down the runway
      const bar = L.kind === 'green' || L.kind === 'red';
      const s = bar ? Math.max(L.size, d * 0.0009) : Math.max(L.size, d * (d > 1500 ? 0.0034 : 0.0022)) * (d > 900 && d <= 1500 ? 0.8 : 1); // from the climb-out the field still reads as light strings
      let r = 2, g = 1.8, b = 1.5, a = 0.9 * on;
      switch (L.kind) {
        case 'edge': r = 2.2; g = 1.9; b = 1.4; break;
        case 'cl': r = 1.8; g = 1.8; b = 1.7; a *= 0.7; break;
        case 'green': r = 0.3; g = 2.4; b = 0.9; a *= Math.min(1, 900 / d); break;
        case 'red': r = 2.6; g = 0.25; b = 0.15; a *= Math.min(1, 900 / d); break;
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
    { const F = this.farGlow; let fi = 0; for (const e of this.farGlows) { if (fi >= F.max) break; F.set(fi++, e[0], e[1], e[2], e[3], e[3], 0, CELL.GLOW, 0, e[4] * e[7], e[5] * e[7], e[6] * e[7], e[7]); } this.farGlows.length = 0; F.commit(fi); }
  }
}

// =====================================================================================
//  textures
// =====================================================================================
function asphaltTexture() {
  const S = 512, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S);
  const n = T.makeNoise(611, 4), n2 = T.makeNoise(612, 2), n3 = T.makeNoise(614, 8), r = makeRng(613);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const m = T.fbm(n, u, v, 4, 5), g = r();
    let b = 0.45 + (m - 0.5) * 0.12 + (g - 0.5) * 0.022;
    b -= Math.max(0, T.fbm(n3, u * 6, v * 0.25, 8, 3) - 0.45) * 0.22;    // wear / rubber streaks along the runway (v = along)
    b += (T.fbm(n3, u * 2 + 0.5, v * 0.5, 8, 2) - 0.5) * 0.06;          // lighter polished lanes
    const patch = T.fbm(n2, u, v, 2, 3) > 0.64 ? -0.06 : 0;  // repair patches
    b += patch;
    const seam = Math.abs(u - 0.5) < 0.002 ? -0.08 : 0;                 // longitudinal paving seam
    b += seam;
    const i = (y * S + xx) * 4;
    img.data[i] = b * 255; img.data[i + 1] = b * 255 * 0.99; img.data[i + 2] = b * 255 * 0.97; img.data[i + 3] = 255;
    h[y * S + xx] = g * 0.08 + m * 0.92; // per-pixel grain in the normal map sparkled like sand in the sun glare
  }
  x.putImageData(img, 0, 0);
  // crack sealant: thin dark tar lines that wander, mostly across the slab
  x.strokeStyle = 'rgba(10,9,8,0.55)'; x.lineCap = 'round';
  for (let k = 0; k < 14; k++) { x.lineWidth = 1 + r() * 1.5; x.beginPath(); let px = r() * S, py = r() * S; x.moveTo(px, py); for (let i = 0; i < 14; i++) { px += (r() - 0.5) * 30 + 10; py += (r() - 0.5) * 16; x.lineTo(px, py); } x.stroke(); }
  // square repair patches
  for (let k = 0; k < 3; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '20,19,18' : '160,155,148'},0.12)`; x.fillRect(r() * S, r() * S, 30 + r() * 60, 20 + r() * 50); }
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
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(821, 16), r = makeRng(822);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    // fine clumps only: a coarse value-noise lattice repeats every tile and reads as a checker grid from the air
    const m = T.fbm(n, xx / S, y / S, 16, 3), g = r();
    const b = 0.8 + (m - 0.5) * 0.14 + (g - 0.5) * 0.3;
    const i = (y * S + xx) * 4; img.data[i] = 235 * b; img.data[i + 1] = 228 * b; img.data[i + 2] = 205 * b; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c);
}
function grassMacroTexture() {
  // r = green vs dry, g = bare earth, b = fine variation (tileable)
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(8801, 8), n2 = T.makeNoise(8802, 16), n3 = T.makeNoise(8803, 32);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const u = xx / S, v = y / S;
    const g = Math.min(1, Math.max(0, (T.fbm(n, u, v, 8, 4) - 0.42) * 3.2));
    const b = Math.min(1, Math.max(0, (T.fbm(n2, u, v, 16, 3) - 0.6) * 4));
    const f = T.fbm(n3, u, v, 32, 3);
    const i = (y * S + xx) * 4; img.data[i] = g * 255; img.data[i + 1] = b * 255; img.data[i + 2] = f * 255; img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c, { srgb: false });
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
function terminalFacade() {
  // glass curtain wall, 3 floors x 10 bays per 40 m tile: sky-tinted glass, mullions, lit interiors (emissive), gate signs
  const W = 512, H = 256, c = T.makeCanvas(W, H), x = c.getContext('2d'), e = T.makeCanvas(W, H), ex = e.getContext('2d'), r = makeRng(7171);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#4a5f78'); g.addColorStop(0.5, '#2c3a4c'); g.addColorStop(1, '#1d2531');
  x.fillStyle = g; x.fillRect(0, 0, W, H); ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  const fh = H / 3;
  for (let f = 0; f < 3; f++) {
    // interior: ceiling light strip + warm pools, a few dark bays
    for (let b = 0; b < 10; b++) {
      const x0 = b * W / 10, lit = r() < 0.8, k = 0.5 + r() * 0.5;
      if (lit) { const gg = ex.createLinearGradient(0, f * fh, 0, f * fh + fh); gg.addColorStop(0, `rgba(255,236,200,${0.85 * k})`); gg.addColorStop(0.2, `rgba(255,214,160,${0.35 * k})`); gg.addColorStop(1, 'rgba(255,190,120,0.08)'); ex.fillStyle = gg; ex.fillRect(x0, f * fh + 6, W / 10, fh - 10); }
      if (r() < 0.25) { ex.fillStyle = 'rgba(40,30,20,0.9)'; ex.fillRect(x0 + 8 + r() * 20, f * fh + fh * 0.45, 6, fh * 0.5); } // people / furniture silhouettes
    }
    x.fillStyle = '#8b939b'; x.fillRect(0, f * fh, W, 6); ex.fillStyle = '#000'; ex.fillRect(0, f * fh, W, 6); // slab edge
  }
  x.fillStyle = 'rgba(150,160,170,0.9)'; ex.fillStyle = '#000';
  for (let b = 0; b <= 20; b++) { x.fillRect(b * W / 20 - 1, 0, b % 2 ? 2 : 4, H); ex.fillRect(b * W / 20 - 1, 0, b % 2 ? 2 : 4, H); } // mullions
  // gate sign on the top floor
  ex.fillStyle = '#ffd040'; ex.font = '700 22px Oswald, sans-serif'; ex.fillText('GATES 20-28', 18, 26); x.fillStyle = '#ffd040'; x.font = '700 22px Oswald, sans-serif'; x.fillText('GATES 20-28', 18, 26);
  return { map: T.canvasTex(c), emissiveMap: T.canvasTex(e) };
}
function wornPaintTexture() {
  // crisp-edged paint, worn by subtraction: fine chips + a few scuffed patches (u = along the stripe, 6 m per repeat)
  const W = 512, H = 64, c = T.makeCanvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), n = T.makeNoise(57, 32), n2 = T.makeNoise(58, 64);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const e = Math.min(y + 0.5, H - 0.5 - y) / 1.5;                                  // ~1.5 px anti-aliased edge
    const chips = T.fbm(n2, xx / W, y / H, 64, 3) > 0.66 ? 0.15 : 1;                  // small chips
    const scuff = Math.min(1, Math.max(0.25, (T.fbm(n, xx / W, y / H, 8, 4) - 0.18) * 3.5)); // larger worn patches
    const a = Math.min(1, e) * chips * scuff;
    const i = (y * W + xx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 235;
  }
  x.putImageData(img, 0, 0);
  return T.canvasTex(c, { aniso: 16 });
}
function corrugatedTexture(dark = false, seams = true) {
  const S = 256, c = T.makeCanvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), n = T.makeNoise(dark ? 961 : 962, 4);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const rib = 0.82 + 0.18 * Math.sin((xx / S) * 32 * TAU);
    const streak = Math.max(0, T.fbm(n, xx / S, y / S, 4, 3) - 0.55) * (y / S) * 1.6; // rust / grime running down
    const v = (dark ? 150 : 205) * rib * (1 - streak * 0.5) + (T.fbm(n, xx / S, y / S, 4, 3) - 0.5) * 20;
    const i = (y * S + xx) * 4; img.data[i] = v * (1 + streak * 0.25); img.data[i + 1] = v * (1 - streak * 0.05); img.data[i + 2] = v * (1 - streak * 0.25); img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  // panel seams every metre
  if (seams) { x.fillStyle = 'rgba(0,0,0,0.2)'; for (let y = 0; y < S; y += 32) x.fillRect(0, y, S, 2); }
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

function blobTexture() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return T.canvasTex(c, { repeat: false });
}
function stainTexture() {
  const S = 128, c = T.makeCanvas(S, S), x = c.getContext('2d'), r = makeRng(1919), img = x.createImageData(S, S), n = T.makeNoise(1920, 4);
  for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
    const dx = xx / S - 0.5, dy = y / S - 0.5, d = Math.hypot(dx, dy * 1.3) * 2;
    const a = Math.max(0, 1 - d - (T.fbm(n, xx / S, y / S, 4, 4) - 0.5) * 1.3) ;
    const i = (y * S + xx) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.min(1, a * 1.6) * 255;
  }
  x.putImageData(img, 0, 0); void r;
  return T.canvasTex(c, { repeat: false });
}
