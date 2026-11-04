import * as THREE from 'three';
import * as T from '../../textures.js';
import { box, at, cyl, profileStrip, merge, mergeGrouped, mergeGeometries } from '../../geom.js';
function merge2(a, b) {
  // a has its own groups (materials 0..2), b has grouped materials -> merge keeping indices
  const A = a.index ? a.toNonIndexed() : a;
  const groupsA = a.groups.map(g => ({ ...g }));
  const out = mergeGeometries([A, b.index ? b.toNonIndexed() : b], false);
  out.clearGroups();
  for (const g of groupsA) out.addGroup(g.start, g.count, g.materialIndex);
  const offs = A.attributes.position.count;
  for (const g of b.groups) out.addGroup(offs + g.start, g.count, g.materialIndex);
  return out;
}
import { makeRng } from '../../rng.js';
import { BillboardBatch, CELL } from '../../particles.js';
import { SUN_DIR } from '../../atmosphere.js';

// World layout (relative frame: truck at origin, driving toward -z; world scrolls toward +z)
export const LANES = [-5.55, -1.85, 1.85, 5.55];
export const ROAD_L = -9.0, ROAD_R = 10.0;
export const Z_FAR = -640, Z_NEAR = 480;
const SPAN = Z_NEAR - Z_FAR;

// Recycling instanced props
class Scroller {
  constructor(mesh, count, spacing, phase, reroll) {
    this.mesh = mesh; this.count = count; this.spacing = spacing; this.reroll = reroll;
    this.items = [];
    this.span = count * spacing;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const it = { z: Z_NEAR - this.span + i * spacing + phase, n: i * 7919 + 13, data: {}, i };
      reroll(it, true);
      this.items.push(it);
    }
    mesh.count = count;
    this._m = m;
    this.write();
  }
  update(dz) {
    for (const it of this.items) {
      it.z += dz;
      if (it.z > Z_NEAR) { it.z -= this.span; it.n += 104729; this.reroll(it, false); }
    }
    this.write();
  }
  write() {
    const m = this._m, q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    this.items.forEach((it, i) => {
      const d = it.data;
      p.set(d.x || 0, d.y || 0, it.z + (d.dz || 0));
      q.setFromEuler(new THREE.Euler(d.rx || 0, d.ry || 0, d.rz || 0));
      s.set(d.sx || d.s || 1, d.sy || d.s || 1, d.sz || d.s || 1);
      if (d.hidden) s.set(0, 0, 0);
      m.compose(p, q, s);
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class World {
  constructor(scene, renderer, atlas, fog, quality) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.scrollers = [];
    this.scrollTex = []; // [texture, metersPerRepeat]
    this.glows = new BillboardBatch(160, atlas, { boost: 1, renderOrder: 5, fog });
    this.glowList = []; // {getPos:()=>..., size, color}
    this.group.add(this.glows.mesh);
    this.colliders = []; // overpass pillars etc. (unused for now)
    this.overpasses = [];
    this.quality = quality;
    this.dist = 0;
    this._build(renderer);
  }

  _scrollTex(t, metersPerRepeat, sign = 1) { this.scrollTex.push([t, metersPerRepeat, sign]); }

  _build(renderer) {
    const aniso = renderer.capabilities.getMaxAnisotropy();
    // ---------------- ground ----------------
    const groundTex = T.groundTexture();
    groundTex.repeat.set(1600 / 16, SPAN / 16);
    groundTex.anisotropy = aniso;
    const groundMat = new THREE.MeshLambertMaterial({ map: groundTex, color: 0xf4efe8, emissive: 0x5c4a30, emissiveMap: groundTex });
    // macro variation (watered / burnt / bare patches every ~160 m) multiplied over the 16 m detail tile
    const macro = T.groundMacroTexture();
    groundMat.onBeforeCompile = (sh) => {
      sh.uniforms.macroMap = { value: macro };
      sh.fragmentShader = 'uniform sampler2D macroMap;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= texture2D( macroMap, vMapUv * 0.1 ).rgb * 2.0;');
    };
    groundMat.customProgramCacheKey = () => 'bayGroundMacro';
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, SPAN), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.06, (Z_NEAR + Z_FAR) / 2);
    ground.receiveShadow = true;
    this.group.add(ground);
    this._scrollTex(groundTex, 16);

    // ---------------- road ----------------
    const { map, normalMap, roughnessMap } = T.roadTextures();
    map.anisotropy = aniso; normalMap.anisotropy = aniso; roughnessMap.anisotropy = aniso;
    const reps = SPAN / T.ROAD.tileLen;
    map.repeat.set(1, reps); normalMap.repeat.set(1, reps); roughnessMap.repeat.set(1, reps);
    // warm grey aged asphalt; polished wheel tracks / oil / tar seams are smoother (roughness map) so they glint toward the sun
    const roadMat = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1.0, metalness: 0.0, envMapIntensity: 0.28, color: 0xfff3e6, emissive: 0x6e5838, emissiveMap: map, emissiveIntensity: 1.0 });
    // emissive = warm bounce from the sunset haze: the grazing sun + blue hemisphere alone leave flat ground navy
    const road = new THREE.Mesh(new THREE.PlaneGeometry(T.ROAD.width, SPAN), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(ROAD_L + T.ROAD.width / 2, 0, (Z_NEAR + Z_FAR) / 2);
    road.receiveShadow = true;
    this.group.add(road);
    // oncoming side (mirrored)
    const map2 = map.clone(); map2.repeat.set(-1, reps); map2.needsUpdate = true;
    const n2 = normalMap.clone(); n2.repeat.set(-1, reps); n2.needsUpdate = true;
    const rm2 = roughnessMap.clone(); rm2.repeat.set(-1, reps); rm2.needsUpdate = true;
    const road2 = new THREE.Mesh(new THREE.PlaneGeometry(T.ROAD.width, SPAN), roadMat.clone());
    road2.material.map = map2; road2.material.emissiveMap = map2; road2.material.normalMap = n2; road2.material.roughnessMap = rm2;
    road2.rotation.x = -Math.PI / 2; road2.position.set(-9.8 - T.ROAD.width / 2, 0, (Z_NEAR + Z_FAR) / 2);
    road2.receiveShadow = true;
    this.group.add(road2);
    for (const t of [map, normalMap, roughnessMap, map2, n2, rm2]) this._scrollTex(t, T.ROAD.tileLen);
    this.roadMat = roadMat;

    // ---------------- barriers (continuous, scrolling texture) ----------------
    const conc = T.concreteTexture(5, [0.70, 0.66, 0.60]);
    conc.anisotropy = aniso;
    const concMat = new THREE.MeshLambertMaterial({ map: conc });
    this.concMat = concMat;
    const jersey = [[-0.31, 0], [-0.3, 0.08], [-0.2, 0.25], [-0.08, 0.84], [0.08, 0.84], [0.2, 0.25], [0.3, 0.08], [0.31, 0]];
    const mkBarrier = (x) => {
      const g = profileStrip(jersey.map(([a, b]) => [a + x, b]), Z_FAR, Z_NEAR, 1.4, 3.0);
      const mesh = new THREE.Mesh(g, concMat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    mkBarrier(-9.4); mkBarrier(-29.3);
    // scroll via a texture clone? Barrier uv is in z/3 so we scroll its texture
    this._scrollTex(conc, 3.0, -1);

    // guardrail W-beam on right
    const mt = T.metalTexture(9);
    const railMat = new THREE.MeshStandardMaterial({ map: mt, color: 0xb9bcc0, metalness: 0.8, roughness: 0.38, envMapIntensity: 1.0 });
    const wbeam = [[0, 0.5], [0.06, 0.55], [0.0, 0.62], [0.06, 0.69], [0.0, 0.76], [-0.02, 0.76]];
    const rail = new THREE.Mesh(profileStrip(wbeam.map(([a, b]) => [a + 10.55, b]), Z_FAR, Z_NEAR, 1, 6), railMat);
    rail.castShadow = true; rail.receiveShadow = true;
    this.group.add(rail);
    this._scrollTex(mt, 6, -1);
    // embankment strip right (dirt/grass slope) — the ground plane handles it

    // posts
    {
      const g = merge([at(box(0.15, 0.85, 0.15), 10.68, 0.42, 0)]);
      const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x80807c }), 290);
      mesh.castShadow = false;
      this.group.add(mesh); mesh.frustumCulled = false;
      this.scrollers.push(new Scroller(mesh, 280, 4, 0, () => {}));
    }

    // ---------------- lamp posts on the median ----------------
    {
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x8b8e92, metalness: 0.7, roughness: 0.45 });
      const headMat = new THREE.MeshStandardMaterial({ color: 0x444, emissive: 0xffa04a, emissiveIntensity: 1.4, roughness: 0.6 });
      const parts = [
        [at(cyl(0.11, 0.19, 12, 10), -9.4, 6.84, 0), 0],
        [at(box(0.5, 0.25, 0.5), -9.4, 0.96, 0), 0],
        [at(box(5.6, 0.14, 0.14), -9.4 + 2.7, 12.6, 0, 0, 0, 0.1), 0],
        [at(box(5.6, 0.14, 0.14), -9.4 - 2.7, 12.6, 0, 0, 0, -0.1), 0],
        [at(box(0.9, 0.2, 0.42), -9.4 + 5.4, 12.95, 0), 1],
        [at(box(0.9, 0.2, 0.42), -9.4 - 5.4, 12.95, 0), 1],
      ];
      const { geometry } = mergeGrouped(parts, 2);
      const mesh = new THREE.InstancedMesh(geometry, [poleMat, headMat], 30);
      mesh.castShadow = true; mesh.frustumCulled = false;
      this.group.add(mesh);
      const sc = new Scroller(mesh, 27, 42, 10, () => {});
      this.scrollers.push(sc);
      for (const it of sc.items) {
        this.glowList.push({ it, x: -9.4 + 5.4, y: 12.75, size: 1.6, c: [1.6, 0.75, 0.3], a: 0.45 });
        this.glowList.push({ it, x: -9.4 - 5.4, y: 12.75, size: 1.6, c: [1.6, 0.75, 0.3], a: 0.45 });
      }
    }

    // ---------------- palms ----------------
    {
      const frond = T.palmFrondTexture();
      const bark = T.palmBarkTexture();
      const frondMat = new THREE.MeshLambertMaterial({ map: frond, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x98a070, emissive: 0x2c2a0c });
      const barkMat = new THREE.MeshLambertMaterial({ map: bark, color: 0xd8c4a8 });
      const variants = [];
      for (let v = 0; v < 3; v++) {
        const r = makeRng(100 + v);
        const H = 13 + v * 3.5;
        const lean = (r() - 0.5) * 0.25;
        const pts = [];
        for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector3(Math.sin(t * 1.4) * lean * H * 0.5, t * H, Math.sin(t * 1.1) * lean * 2)); }
        const curve = new THREE.CatmullRomCurve3(pts);
        const trunk = new THREE.TubeGeometry(curve, 12, 0.24, 7, false);
        // taper trunk
        const pa = trunk.attributes.position;
        for (let i = 0; i < pa.count; i++) {
          const y = pa.getY(i); const t = y / H;
          const c = curve.getPoint(Math.min(1, Math.max(0, t)));
          const k = 1.25 - t * 0.5;
          pa.setX(i, c.x + (pa.getX(i) - c.x) * k); pa.setZ(i, c.z + (pa.getZ(i) - c.z) * k);
        }
        const uvA = trunk.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setY(i, uvA.getY(i)); // keep
        for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getY(i) * 1, uvA.getX(i) * H / 3);
        const top = curve.getPoint(1);
        const fronds = [];
        const nF = 11;
        for (let f = 0; f < nF; f++) {
          const ang = (f / nF) * Math.PI * 2 + r() * 0.3;
          const len = 4.2 + r() * 1.6, wid = 1.25;
          const seg = 6;
          const geo = new THREE.PlaneGeometry(wid, len, 1, seg);
          // bend: along length, droop
          const p = geo.attributes.position;
          const droop = 0.6 + r() * 0.5;
          for (let i = 0; i < p.count; i++) {
            const yy = Math.max(0, p.getY(i) + len / 2); // 0..len
            const t = Math.min(1, yy / len);
            const out = yy * Math.cos(t * droop * 1.6);
            const down = -Math.pow(t, 1.6) * len * droop * 0.75 + t * 0.9;
            const xx = p.getX(i) * (1 - t * 0.4);
            // fold blade slightly (V shape)
            const fold = Math.abs(p.getX(i)) * 0.35;
            p.setXYZ(i, xx, down + fold, -out);
          }
          geo.rotateY(ang);
          geo.translate(top.x, top.y, top.z);
          fronds.push(geo);
        }
        // coconut cluster
        const nuts = at(new THREE.SphereGeometry(0.42, 7, 5), top.x, top.y - 0.35, top.z);
        const { geometry } = mergeGrouped([[trunk, 0], [nuts, 0], ...fronds.map(g => [g, 1])], 2);
        variants.push(geometry);
      }
      variants.forEach((geo, vi) => {
        const n = 50;
        const mesh = new THREE.InstancedMesh(geo, [barkMat, frondMat], n);
        mesh.castShadow = true; mesh.frustumCulled = false;
        this.group.add(mesh);
        this.scrollers.push(new Scroller(mesh, n, SPAN / n, vi * 7.3, (it) => {
          const r = makeRng(it.n + vi * 31);
          const side = r() < 0.62 ? 1 : -1;
          const near = r() < 0.55;
          it.data.x = side > 0 ? (near ? 15.2 + r() * 1.2 : 19 + r() * 45) : (near ? -33.2 - r() * 1.2 : -37 - r() * 45);
          it.data.ry = r() * Math.PI * 2;
          it.data.rx = (r() - 0.5) * 0.12; it.data.rz = (r() - 0.5) * 0.12;
          it.data.s = 0.75 + r() * 0.55;
          it.data.dz = (r() - 0.5) * 6;
        }));
      });
    }

    // ---------------- buildings (both sides): one atlas material, one draw call per variant ----------------
    {
      const A = T.buildingAtlas();
      const mat = new THREE.MeshLambertMaterial({ map: A.map, emissiveMap: A.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.85 });
      patchAtlasMaterial(mat);
      this.buildingMat = mat;
      const PAL = ['#f2e6d0', '#e8c9a8', '#dca488', '#e9bcb2', '#cfe0cf', '#efe0a6', '#d9d7d1', '#c8d3de', '#f2d6b8', '#bba892', '#e3c2ca', '#f6f1e6'].map(h => new THREE.Color(h));
      const tmpC = new THREE.Color();
      for (let v = 0; v < 10; v++) {
        const V = buildingVariant(v, A.R);
        const n = 9;
        const mesh = new THREE.InstancedMesh(V.geometry, mat, n);
        for (let i = 0; i < n; i++) mesh.setColorAt(i, PAL[0]);
        mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
        this.group.add(mesh);
        // phases spread evenly (a building every SPAN/n/10 m); side + depth row are fixed per slot so
        // neighbours on the same side never share a row (no interpenetrating footprints)
        this.scrollers.push(new Scroller(mesh, n, SPAN / n, v * SPAN / n / 10 + 3, (it) => {
          const r = makeRng(it.n * 3 + v);
          const g = it.i * 10 + v; // z-order slot around the whole loop (90 slots: divisible by 6)
          const side = g % 2 ? 1 : -1;
          const row = Math.floor(g / 2) % 3;
          const turned = r() < 0.25;
          const hx = (turned ? V.w : V.d) / 2;
          it.data.x = side > 0 ? 33 + hx + row * 30 + r() * 4 : -46 - hx - row * 30 - r() * 4;
          it.data.ry = (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (turned ? Math.PI / 2 : 0);
          it.data.dz = (r() - 0.5) * 6;
          tmpC.copy(PAL[Math.floor(r() * PAL.length)]).multiplyScalar(0.86 + r() * 0.2);
          mesh.setColorAt(it.i, tmpC); mesh.instanceColor.needsUpdate = true;
        }));
      }
    }

    // ---------------- sound walls (LA freeway canyon) ----------------
    {
      // three wall variants (different block grime / ivy / tags) so the repetition breaks up
      const wallMats = [21, 33, 47].map((sd) => { const t = T.soundWallTexture(sd); t.anisotropy = aniso; return new THREE.MeshLambertMaterial({ map: t }); });
      const capMat = new THREE.MeshLambertMaterial({ map: this.concMat.map, color: 0xd8cfc2 });
      const segL = 30, H = 4.6;
      const face = box(0.35, H, segL);
      // UVs: 10m per texture repeat horizontally, 5m vertically on the long faces
      const uv = face.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * segL / 10, uv.getY(i) * H / 5);
      face.translate(0, H / 2, 0);
      const parts = [[face, 0], [at(box(0.55, 0.22, segL, 2), 0, H + 0.11, 0), 1]];
      for (let k = 0; k < 6; k++) parts.push([at(box(0.5, H + 0.1, 0.45, 2), 0, H / 2, -segL / 2 + k * 5 + 2.5), 1]);
      const { geometry } = mergeGrouped(parts, 2);
      for (const sideX of [12.9, -31.0]) for (let v = 0; v < wallMats.length; v++) {
        const n = Math.ceil(SPAN / segL);
        const mesh = new THREE.InstancedMesh(geometry, [wallMats[v], capMat], n);
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
        this.group.add(mesh);
        this.scrollers.push(new Scroller(mesh, n, segL, sideX > 0 ? 0 : 7, (it) => {
          const r = makeRng(it.n + (sideX > 0 ? 1 : 2));
          const gap = r() < 0.14;
          const variant = Math.floor(r() * wallMats.length);
          it.data.x = sideX; it.data.hidden = gap || variant !== v;
          it.data.sy = 0.9 + r() * 0.25;
          it.data.ry = r() < 0.5 ? 0 : Math.PI; // flip so tags don't line up
          it.data.s = 1; it.data.sx = 1; it.data.sz = 1.0;
        }));
      }
    }

    // ---------------- shrubs / oleanders along the wall + median ----------------
    {
      const kinds = [T.shrubTexture(3, [0.30, 0.44, 0.18], '#e85a9a'), T.shrubTexture(5, [0.36, 0.42, 0.2]), T.shrubTexture(9, [0.26, 0.36, 0.16], '#f2f0e8')];
      kinds.forEach((tx, k) => {
        const q1 = new THREE.PlaneGeometry(2.4, 2.0); q1.translate(0, 1.0, 0);
        const q2 = q1.clone(); q2.rotateY(Math.PI / 2);
        const q3 = q1.clone(); q3.rotateY(Math.PI / 4);
        const g = merge([q1, q2, q3]);
        const mat = new THREE.MeshLambertMaterial({ map: tx, alphaTest: 0.45, side: THREE.DoubleSide });
        const n = 88;
        const mesh = new THREE.InstancedMesh(g, mat, n);
        mesh.frustumCulled = false; mesh.castShadow = false;
        this.group.add(mesh);
        this.scrollers.push(new Scroller(mesh, n, SPAN / n, k * 3.1, (it) => {
          const r = makeRng(it.n * 7 + k);
          const zone = r();
          it.data.x = zone < 0.5 ? 11.4 + r() * 1.2 : zone < 0.8 ? -30.0 - r() * 0.8 : 14 + r() * 6;
          it.data.s = 0.7 + r() * 0.8; it.data.ry = r() * 3;
          it.data.dz = (r() - 0.5) * 8;
        }));
      });
    }

    // ---------------- billboards ----------------
    {
      const tex = [0, 1, 2, 3, 4].map(k => T.billboardTexture(k));
      tex.forEach((t, k) => {
        const face = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 });
        const frame = new THREE.MeshStandardMaterial({ color: 0x3b3b3e, metalness: 0.6, roughness: 0.5 });
        const parts = [
          [at(new THREE.PlaneGeometry(13, 4.9), 0, 10.5, 0.16), 0],
          [at(box(13.4, 5.3, 0.3), 0, 10.5, 0), 1],
          [at(cyl(0.35, 0.4, 8.2, 8), 0, 4.1, -0.3), 1],
          [at(box(13.4, 0.15, 1.2), 0, 7.7, 0.5), 1],
        ];
        const { geometry } = mergeGrouped(parts, 2);
        const mesh = new THREE.InstancedMesh(geometry, [face, frame], 4);
        mesh.castShadow = true; mesh.frustumCulled = false;
        this.group.add(mesh);
        this.scrollers.push(new Scroller(mesh, 4, SPAN / 4, 70 + k * 47, (it) => {
          const r = makeRng(it.n + k * 3);
          const side = r() < 0.6 ? 1 : -1;
          it.data.x = side > 0 ? 24 + r() * 10 : -40 - r() * 8;
          it.data.ry = side > 0 ? -0.55 : 0.55; // angled toward oncoming view (we see them as we approach)
        }));
      });
    }

    // ---------------- overpasses ----------------
    {
      const conc2 = T.concreteTexture(15, [0.74, 0.69, 0.62]);
      const m0 = new THREE.MeshLambertMaterial({ map: conc2 });
      const m1 = new THREE.MeshLambertMaterial({ map: conc2, color: 0x8e8478 });
      const m2 = new THREE.MeshLambertMaterial({ color: 0x1d4f2f });
      const parts = [];
      const deckY = 7.6, deckD = 13;
      parts.push([at(box(110, 1.3, deckD, 4), 0, deckY + 0.65, 0), 0]);
      parts.push([at(box(110, 1.1, 0.35, 4), 0, deckY + 1.85, deckD / 2 - 0.17), 0]);
      parts.push([at(box(110, 1.1, 0.35, 4), 0, deckY + 1.85, -deckD / 2 + 0.17), 0]);
      for (let gx = -4; gx <= 4; gx++) parts.push([at(box(110, 1.0, 0.5, 4), 0, deckY - 0.45, gx * 1.4), 1]);
      parts.push([at(box(110, 0.04, deckD - 0.4), 0, deckY - 0.97, 0), 3]); // dark sooty soffit (no light gets under the deck)
      for (const px of [-9.4, 12.2, -31.5]) {
        parts.push([at(box(1.2, 0.9, deckD - 1, 4), px, deckY - 1.2, 0), 1]);
        for (const pz of [-4, 0, 4]) parts.push([at(cyl(0.6, 0.7, deckY - 1.4, 12), px, (deckY - 1.4) / 2, pz), 0]);
      }
      // embankments at ends
      for (const ex of [-62, 58]) parts.push([at(box(16, deckY + 1, deckD + 6, 4), ex, (deckY + 1) / 2 - 0.5, 0), 0]);
      // sign on the overpass facing us
      parts.push([at(box(9, 2.4, 0.2), 1.5, deckY + 3.4, deckD / 2 + 0.2), 2]);
      parts.push([at(box(0.2, 1.4, 0.2), -2, deckY + 2.2, deckD / 2 + 0.2), 1]);
      parts.push([at(box(0.2, 1.4, 0.2), 5, deckY + 2.2, deckD / 2 + 0.2), 1]);
      const { geometry } = mergeGrouped(parts, 4);
      const soffit = new THREE.MeshBasicMaterial({ color: 0x1d1a17 });
      const mesh = new THREE.InstancedMesh(geometry, [m0, m1, m2, soffit], 3);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      this.group.add(mesh);
      const sc = new Scroller(mesh, 3, SPAN / 3, 120, () => {});
      this.scrollers.push(sc);
      this.overpassScroller = sc;
      // sign faces as separate textured planes (instanced too)
      const st = T.signTexture(['HAVEN CITY', 'NEXT 4 EXITS'], { arrow: false });
      const sm = new THREE.InstancedMesh(at(new THREE.PlaneGeometry(8.8, 2.2), 1.5, deckY + 3.4, deckD / 2 + 0.32), new THREE.MeshLambertMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.15 }), 3);
      sm.frustumCulled = false; this.group.add(sm);
      this.scrollers.push(new Scroller(sm, 3, SPAN / 3, 120, () => {}));
      // cars parked on the overpass for life
      for (const it of sc.items) {
        this.glowList.push({ it, x: -20, y: deckY + 2.2, size: 1.2, c: [1, 0.9, 0.7], a: 0.6 });
      }
    }

    // ---------------- sign gantries ----------------
    {
      // galvanised (not mirror) steel: the backs face the low sun and used to blow out to white
      const steel = new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 0.5, roughness: 0.52, envMapIntensity: 0.8 });
      const backMat = new THREE.MeshStandardMaterial({ map: T.signBackTexture(), color: 0xa4a7ab, metalness: 0.35, roughness: 0.62, envMapIntensity: 0.6 });
      const parts = [
        [at(box(20.8, 0.05, 0.9), 1.35, 4.6, 1.45), 0], [at(box(20.8, 0.05, 0.05), 1.35, 5.62, 1.88), 0], [at(box(20.8, 0.05, 0.05), 1.35, 5.1, 1.88), 0],
        [at(box(0.35, 7.6, 0.35), 11.6, 3.8, 0), 0], [at(box(0.35, 7.6, 0.35), -8.9, 3.8, 0), 0],
        [at(box(20.8, 0.3, 0.3), 1.35, 7.1, 0.5), 0], [at(box(20.8, 0.3, 0.3), 1.35, 7.1, -0.5), 0],
        [at(box(20.8, 0.3, 0.3), 1.35, 5.4, 0.5), 0], [at(box(20.8, 0.3, 0.3), 1.35, 5.4, -0.5), 0],
      ];
      for (let k = 0; k < 10; k++) parts.push([at(box(0.08, 1.9, 0.08), -8.5 + k * 2.1, 6.25, 0.5, 0, 0, 0.6), 0]);
      for (let k = 0; k < 10; k++) parts.push([at(box(0.08, 1.9, 0.08), -8.5 + k * 2.1, 6.25, -0.5, 0, 0, -0.6), 0]);
      for (let k = 0; k < 11; k++) { parts.push([at(box(0.05, 1.05, 0.05), -9.0 + k * 2.08, 5.12, 1.88), 0]); parts.push([at(box(0.06, 0.06, 0.95), -9.0 + k * 2.08, 4.6, 1.45), 0]); }
      const { geometry } = mergeGrouped(parts, 1);
      const mesh = new THREE.InstancedMesh(geometry, [steel], 4);
      mesh.castShadow = true; mesh.frustumCulled = false;
      this.group.add(mesh);
      const sc = new Scroller(mesh, 4, SPAN / 4, 40, () => {});
      this.scrollers.push(sc);
      const signs = [
        T.signTexture(['DOWNTOWN', 'HAVEN CITY'], { exit: 'EXIT 42A' }),
        T.signTexture(['PORT OF', 'VICTORY'], { exit: 'EXIT 43' }),
        T.signTexture(['AIRPORT', 'NO RETURN'], { arrow: true }),
      ];
      signs.forEach((t, k) => {
        const m = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 });
        // sign panel + back structure: perimeter frame, vertical Z-stiffeners, two mounting rails onto the truss chords
        const sp = [[at(box(6.2, 3.1, 0.12), 0, 0, 0), 0], [at(new THREE.PlaneGeometry(6.2, 3.1), 0, 0, 0.07), 1]];
        for (const y of [-1.53, 1.53]) sp.push([at(box(6.3, 0.09, 0.1), 0, y, -0.1), 0]);
        for (const x of [-3.1, 3.1]) sp.push([at(box(0.09, 3.15, 0.1), x, 0, -0.1), 0]);
        for (let s2 = 0; s2 < 6; s2++) { const x = -2.5 + s2; sp.push([at(box(0.07, 3.0, 0.07), x, 0, -0.1), 0], [at(box(0.16, 3.0, 0.02), x, 0, -0.14), 0]); }
        for (const y of [0.8, -0.9]) sp.push([at(box(6.6, 0.12, 0.12), 0, y, -0.25), 0]);
        const { geometry: gg } = mergeGrouped(sp, 2);
        const im = new THREE.InstancedMesh(gg, [backMat, m], 4);
        im.castShadow = true; im.frustumCulled = false;
        this.group.add(im);
        const off = [-5.4, 1.15, 7.7][k];
        this.scrollers.push(new Scroller(im, 4, SPAN / 4, 40, (it) => {
          it.data.x = off; it.data.y = 6.3; it.data.dz = 0.9;
          const r = makeRng(it.n + k);
          it.data.hidden = r() < 0.15;
        }));
      });
    }

    // ---------------- power lines (silhouettes against the sunset) ----------------
    {
      const period = 55;
      const grp = new THREE.Group();
      const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a2e26 });
      const poles = [];
      const n = Math.ceil(SPAN / period) + 2;
      for (let i = 0; i < n; i++) {
        const z = Z_FAR + i * period;
        for (const px of [-39, 26]) {
          poles.push(at(cyl(0.16, 0.22, 15, 6), px, 7.5, z));
          poles.push(at(box(3.4, 0.18, 0.18), px, 14.2, z));
          poles.push(at(box(2.4, 0.15, 0.15), px, 12.9, z));
        }
      }
      const pm = new THREE.Mesh(merge(poles), poleMat); pm.castShadow = false; grp.add(pm);
      // catenary wires as line segments
      const pts = [];
      for (let i = 0; i < n - 1; i++) {
        const z0 = Z_FAR + i * period, z1 = z0 + period;
        for (const px of [-39, 26]) for (const [wx, wy] of [[-1.5, 14.25], [-0.5, 14.25], [0.5, 14.25], [1.5, 14.25], [-1.0, 12.95], [1.0, 12.95]]) {
          const seg = 12;
          for (let k = 0; k < seg; k++) {
            for (const kk of [k, k + 1]) {
              const t = kk / seg; const sag = 1.4 * 4 * t * (1 - t);
              pts.push(px + wx, wy - sag, z0 + (z1 - z0) * t);
            }
          }
        }
      }
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x15100e, transparent: true, opacity: 0.85 })));
      grp.children.forEach(c => { c.frustumCulled = false; });
      this.group.add(grp);
      this.powerLines = { grp, period };
    }

    // ---------------- far layers (no parallax: follow the rig) ----------------
    this.far = new THREE.Group();
    this.scene.add(this.far);
    const ridge = (radius, height, seed, color, emissive, jag, yOff = 0) => {
      const r = makeRng(seed);
      const seg = 256;
      const pos = [], col = [], idx = [];
      let hgt = 0.5;
      const heights = [];
      for (let i = 0; i <= seg; i++) {
        hgt += (r() - 0.5) * jag; hgt = Math.max(0.05, Math.min(1, hgt));
        heights.push(hgt);
      }
      // smooth
      for (let pass = 0; pass < 2; pass++) for (let i = 1; i < seg; i++) heights[i] = (heights[i - 1] + heights[i] * 2 + heights[i + 1]) / 4;
      heights[seg] = heights[0];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
        const h = heights[i] * height + yOff;
        pos.push(x, yOff - 30, z, x, h, z);
        // aerial perspective: tint toward the horizon haze, warmer toward the sun
        const d = Math.max(0, (Math.cos(a) * SUN_DIR.x + Math.sin(a) * SUN_DIR.z) / Math.hypot(SUN_DIR.x, SUN_DIR.z));
        const sunK = Math.pow(d, 3);
        const hz = [0.86 + (2.3 - 0.86) * sunK, 0.5 + (0.95 - 0.5) * sunK, 0.36 + (0.36 - 0.36) * sunK];
        const k0 = color[0], k1 = color[1];
        col.push(hz[0] * k0, hz[1] * k0, hz[2] * k0 * 1.15, hz[0] * k1, hz[1] * k1, hz[2] * k1 * 1.2);
      }
      for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
      m.renderOrder = -40;
      this.far.add(m);
      return m;
    };
    // [bottom brightness, top brightness] relative to the horizon haze
    ridge(2000, 300, 7, [0.64, 0.74], 0, 0.22);
    ridge(1600, 170, 9, [0.46, 0.56], 0, 0.3);
    // skyline strips (cylindrical, alpha)
    const sky1 = T.skylineTexture(3);
    const mkSky = (radius, height, arcStart, arcLen, tex, y = 0, tint = null) => {
      const g = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true, arcStart, arcLen);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.BackSide, fog: false, color: tint ?? 0xb9a3a8 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.y = height / 2 - 6 + y;
      mesh.renderOrder = -30;
      this.far.add(mesh);
      return mesh;
    };
    // city ahead (toward the sun) across ~130 degrees
    const sunYaw = Math.atan2(SUN_DIR.x, SUN_DIR.z);
    const cs = mkSky(1100, 150, sunYaw + Math.PI / 2 - 1.3, 2.6, sky1, 0, 0xc99a7a);
    const t2 = T.skylineTexture(17); t2.repeat.set(2, 1);
    mkSky(780, 70, sunYaw + Math.PI / 2 + 1.1, 1.6, t2, -2, 0x9a7c80);
    // sprawl behind the truck too (the direction you look while fighting the chasers)
    const t3 = T.skylineTexture(29); t3.repeat.set(3, 1);
    mkSky(950, 95, sunYaw - Math.PI / 2 - 1.5, 3.0, t3, -4, 0x7c6a72);
    const t4 = T.skylineTexture(41); t4.repeat.set(2, 1);
    mkSky(1250, 140, sunYaw - Math.PI / 2 - 0.6, 1.3, t4, -6, 0x94808a);
    this.cityStrip = cs;

    // ground fill haze plane hiding the horizon seam
  }

  update(dz, rigPos) {
    this.dist += dz;
    for (const [t, m, sg] of this.scrollTex) t.offset.y = (t.offset.y + sg * dz / m) % 1000;
    for (const s of this.scrollers) s.update(dz);
    this.far.position.set(rigPos.x, 0, rigPos.z);
    if (this.powerLines) this.powerLines.grp.position.z = ((this.dist % this.powerLines.period) + this.powerLines.period) % this.powerLines.period;
    // glows
    let i = 0;
    for (const gl of this.glowList) {
      const z = gl.it.z;
      if (z < Z_FAR + 20) { this.glows.hide(i++); continue; }
      this.glows.set(i++, gl.x, gl.y, z, gl.size, gl.size, 0, CELL.GLOW, 0, gl.c[0], gl.c[1], gl.c[2], gl.a);
    }
    this.glows.commit(i);
  }
}

// =====================================================================================
// Buildings: atlas-mapped geometry. Each vertex carries `arect` (atlas rect; negative w/h = may be
// shifted per instance by a quarter tile so window patterns differ between copies) and a tiling uv.
// =====================================================================================
function patchAtlasMaterial(mat) {
  mat.onBeforeCompile = (s) => {
    s.vertexShader = 'attribute vec4 arect;\nvarying vec4 vRect;\nvarying vec2 vTUv;\n' + s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
  vRect = arect; vTUv = uv;
  #ifdef USE_INSTANCING
  {
    float h1 = fract(sin(float(gl_InstanceID) * 12.9898 + 78.233) * 43758.5453);
    float h2 = fract(sin(float(gl_InstanceID) * 39.3468 + 11.135) * 24634.6345);
    vTUv += floor(vec2(h1, h2) * 4.0) / 4.0 * vec2(arect.z < 0.0 ? 1.0 : 0.0, arect.w < 0.0 ? 1.0 : 0.0);
  }
  #endif`);
    s.fragmentShader = 'varying vec4 vRect;\nvarying vec2 vTUv;\n' + s.fragmentShader
      .replace('#include <map_fragment>', `
  vec2 tsz = abs(vRect.zw);
  vec2 auv = vRect.xy + fract(vTUv) * tsz;
  vec2 gx = dFdx(vTUv) * tsz, gy = dFdy(vTUv) * tsz;
  float gm = max(length(gx), length(gy)), glim = 10.0 / 2048.0;
  if (gm > glim) { gx *= glim / gm; gy *= glim / gm; }
  auv = clamp(auv, vRect.xy + 0.6 / 2048.0, vRect.xy + tsz - 0.6 / 2048.0);
  vec4 sampledDiffuseColor = textureGrad(map, auv, gx, gy);
  diffuseColor.rgb *= sampledDiffuseColor.rgb;`)
      .replace('#include <color_fragment>', `#if defined( USE_COLOR )
  diffuseColor.rgb *= mix(vec3(1.0), vColor, clamp((1.0 - sampledDiffuseColor.a) * 2.0, 0.0, 1.0));
#endif`)
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance *= textureGrad(emissiveMap, auv, gx, gy).rgb;');
  };
  mat.customProgramCacheKey = () => 'bayBuildingAtlas';
}
class BGeo {
  constructor() { this.p = []; this.n = []; this.u = []; this.a = []; }
  // quad o, o+ex, o+ex+ey, o+ey (CCW seen from the front), uv0 at o, uv1 at the far corner
  quad(o, ex, ey, n, uv0, uv1, rect) {
    const P = [o, [o[0] + ex[0], o[1] + ex[1], o[2] + ex[2]], [o[0] + ex[0] + ey[0], o[1] + ex[1] + ey[1], o[2] + ex[2] + ey[2]], [o[0] + ey[0], o[1] + ey[1], o[2] + ey[2]]];
    const U = [[uv0[0], uv0[1]], [uv1[0], uv0[1]], [uv1[0], uv1[1]], [uv0[0], uv1[1]]];
    for (const k of [0, 1, 2, 0, 2, 3]) { this.p.push(...P[k]); this.n.push(...n); this.u.push(...U[k]); this.a.push(...rect); }
  }
  // axis-aligned box; spec.side/top = { reg, vBase, shift, tile } ; faces: string of faces to emit (default 'xXzZt')
  box(x0, x1, y0, y1, z0, z1, side, top = side, faces = 'xXzZt') {
    const S = (sp, len, ya, yb, offU = 0) => {
      const [tw, th] = sp.tile || sp.reg.t, vb = sp.vBase ?? ya;
      return { uv0: [offU / tw, (ya - vb) / th], uv1: [(offU + len) / tw, (yb - vb) / th], rect: rectOf(sp) };
    };
    const h = y1 - y0, W = x1 - x0, D = z1 - z0;
    const F = (o, ex, n, len) => { const q = S(side, len, y0, y1); this.quad(o, ex, [0, h, 0], n, q.uv0, q.uv1, q.rect); };
    if (faces.includes('Z')) F([x0, y0, z1], [W, 0, 0], [0, 0, 1], W);
    if (faces.includes('z')) F([x1, y0, z0], [-W, 0, 0], [0, 0, -1], W);
    if (faces.includes('X')) F([x1, y0, z1], [0, 0, -D], [1, 0, 0], D);
    if (faces.includes('x')) F([x0, y0, z0], [0, 0, D], [-1, 0, 0], D);
    if (faces.includes('t') && top) { const [tw, th] = top.tile || top.reg.t; this.quad([x0, y1, z1], [W, 0, 0], [0, 0, -D], [0, 1, 0], [x0 / tw, z1 / th], [x1 / tw, z0 / th], rectOf(top)); }
  }
  cyl(cx, cz, y0, y1, rad, seg, side, capReg, capH = 0.4) {
    const [tw, th] = side.tile || side.reg.t, R = rectOf(side), RC = rectOf(capReg);
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const p0 = [cx + Math.sin(a0) * rad, y0, cz + Math.cos(a0) * rad], p1 = [cx + Math.sin(a1) * rad, y0, cz + Math.cos(a1) * rad];
      const len = 2 * rad * Math.sin(Math.PI / seg);
      this.quad(p0, [p1[0] - p0[0], 0, p1[2] - p0[2]], [0, y1 - y0, 0], [Math.sin(am), 0, Math.cos(am)], [k * len / tw, 0], [(k + 1) * len / tw, (y1 - y0) / th], R);
      const t0 = [p0[0], y1, p0[2]], t1 = [p1[0], y1, p1[2]], ap = [cx, y1 + capH, cz];
      const nn = [Math.sin(am) * capH, rad, Math.cos(am) * capH], l = Math.hypot(...nn);
      for (const P of [t0, t1, ap]) { this.p.push(...P); this.n.push(nn[0] / l, nn[1] / l, nn[2] / l); this.u.push(P[0] / 2, P[2] / 2); this.a.push(...RC); }
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('arect', new THREE.Float32BufferAttribute(this.a, 4));
    g.computeBoundingSphere();
    return g;
  }
}
function rectOf(sp) { const r = sp.reg.r; return [r[0], r[1], sp.shiftU ? -r[2] : r[2], sp.shiftV ? -r[3] : r[3]]; }

function buildingVariant(v, R) {
  const r = makeRng(900 + v * 37);
  const G = new BGeo();
  const style = ['F0', 'F1', 'F0', 'F2', 'F0', 'F1', 'F0', 'F2', 'F1', 'F0'][v];
  const bayW = style === 'F0' ? 3.4 : 1.5, floorH = style === 'F0' ? 3.3 : 3.8;
  const tall = v >= 6;
  const floors = tall ? 9 + Math.floor(r() * 9) : 2 + Math.floor(r() * 5);
  const nW = style === 'F0' ? 5 + Math.floor(r() * 6) : 12 + 4 * Math.floor(r() * 3), nD = style === 'F0' ? 4 + Math.floor(r() * 4) : 12 + 4 * Math.floor(r() * 2);
  const w = nW * bayW, d = nD * bayW;
  const PB = 0.15, PH = 5.0, PT = PB + PH;
  const TRIM = { reg: R.TRIM }, ROOF = { reg: R.ROOF }, WALK = { reg: R.WALK }, METAL = { reg: R.METAL }, DARK = { reg: R.DARK };
  const FAC = { reg: R[style], vBase: PT, shiftU: true, shiftV: true };
  const SF = { reg: r() < 0.5 ? R.SF0 : R.SF1, vBase: PB, shiftU: true };
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  // sidewalk slab + curb
  const sw = 3.2;
  G.box(x0 - sw, x1 + sw, -0.06, PB, z0 - sw, z1 + sw, TRIM, WALK);
  // podium: storefronts on all four sides, corner piers, sign cornice
  G.box(x0, x1, PB, PT, z0, z1, SF, null, 'xXzZ');
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) G.box(px - 0.35, px + 0.35, PB, PT + 0.2, pz - 0.35, pz + 0.35, TRIM, TRIM);
  G.box(x0 - 0.25, x1 + 0.25, PT - 0.05, PT + 0.45, z0 - 0.25, z1 + 0.25, TRIM, ROOF);
  // awnings over some shop bays on the road face (+z) and the back
  for (const face of [1, -1]) {
    const segs = 1 + Math.floor(r() * 3);
    for (let k = 0; k < segs; k++) {
      if (r() < 0.25) continue;
      const nb = 1 + Math.floor(r() * 2), b0 = Math.floor(r() * Math.max(1, Math.floor(w / 4.5) - nb));
      const ax0 = x0 + b0 * 4.5 + 0.3, ax1 = Math.min(x1 - 0.4, ax0 + nb * 4.5 - 0.6);
      if (ax1 - ax0 < 1.5) continue;
      const aw = { reg: r() < 0.5 ? R.AWNS : R.AWNG, tile: [2, 1] };
      const zw = face > 0 ? z1 : z0, out = 1.5, yT = 3.75, yB = 3.05;
      const rc = rectOf(aw), nS = [0, out, (yT - yB) * face], l = Math.hypot(...nS);
      if (face > 0) {
        G.quad([ax0, yB, zw + out], [ax1 - ax0, 0, 0], [0, yT - yB, -out], [nS[0] / l, nS[1] / l, nS[2] / l], [ax0 / 2, 0], [ax1 / 2, 1], rc);
        G.quad([ax0, yB - 0.3, zw + out], [ax1 - ax0, 0, 0], [0, 0.3, 0], [0, 0, 1], [ax0 / 2, 0], [ax1 / 2, 0.3], rc);
        G.quad([ax1, yB, zw + out], [ax0 - ax1, 0, 0], [0, yT - yB, -out], [0, -1, 0], [ax0 / 2, 0], [ax1 / 2, 1], rectOf(DARK));
      } else {
        G.quad([ax1, yB, zw - out], [ax0 - ax1, 0, 0], [0, yT - yB, out], [nS[0] / l, nS[1] / l, nS[2] / l], [ax0 / 2, 0], [ax1 / 2, 1], rc);
        G.quad([ax1, yB - 0.3, zw - out], [ax0 - ax1, 0, 0], [0, 0.3, 0], [0, 0, -1], [ax0 / 2, 0], [ax1 / 2, 0.3], rc);
      }
    }
  }
  // tower + setback tiers
  const tiers = [{ x0, x1, z0, z1, f: floors }];
  if (floors >= 5 && r() < 0.65) {
    const cutW = (1 + Math.floor(r() * 2)) * bayW * (style === 'F0' ? 1 : 2), cutD = (1 + Math.floor(r() * 2)) * bayW * (style === 'F0' ? 1 : 2);
    tiers.push({ x0: x0 + cutW, x1: x1 - cutW, z0: z0 + cutD, z1: z1 - (r() < 0.5 ? cutD : 0), f: 2 + Math.floor(r() * (tall ? 5 : 2)) });
    if (tall && r() < 0.5) { const t = tiers[1]; const c2 = bayW * (style === 'F0' ? 1 : 2); tiers.push({ x0: t.x0 + c2, x1: t.x1 - c2, z0: t.z0 + c2, z1: t.z1 - c2, f: 2 + Math.floor(r() * 3) }); }
  }
  let y = PT;
  const roofs = [];
  tiers.forEach((t, i) => {
    if (t.x1 - t.x0 < 4 || t.z1 - t.z0 < 4) return;
    const yTop = y + t.f * floorH;
    G.box(t.x0, t.x1, y, yTop, t.z0, t.z1, FAC, null, 'xXzZ');
    const glass = style === 'F2';
    const ov = glass ? 0.06 : 0.3, ch = glass ? 0.35 : 0.6;
    G.box(t.x0 - ov, t.x1 + ov, yTop, yTop + ch, t.z0 - ov, t.z1 + ov, glass ? DARK : TRIM, ROOF);
    const ry = yTop + ch;
    // parapet ring
    const pt = 0.25, ph = glass ? 0.9 : 0.75;
    const P = glass ? METAL : TRIM;
    G.box(t.x0 - ov, t.x1 + ov, ry, ry + ph, t.z1 + ov - pt, t.z1 + ov, P, P, 'xXzZt');
    G.box(t.x0 - ov, t.x1 + ov, ry, ry + ph, t.z0 - ov, t.z0 - ov + pt, P, P, 'xXzZt');
    G.box(t.x0 - ov, t.x0 - ov + pt, ry, ry + ph, t.z0 - ov + pt, t.z1 + ov - pt, P, P, 'xXt');
    G.box(t.x1 + ov - pt, t.x1 + ov, ry, ry + ph, t.z0 - ov + pt, t.z1 + ov - pt, P, P, 'xXt');
    roofs.push({ x0: t.x0 + 0.8, x1: t.x1 - 0.8, z0: t.z0 + 0.8, z1: t.z1 - 0.8, y: ry, top: i === tiers.length - 1 });
    y = yTop;
  });
  // rooftop clutter
  const top = roofs[roofs.length - 1];
  const at = (rf, sx, sz) => [lerp(rf.x0 + sx / 2, rf.x1 - sx / 2, r()), lerp(rf.z0 + sz / 2, rf.z1 - sz / 2, r())];
  for (const rf of roofs) {
    if (rf.x1 - rf.x0 < 3 || rf.z1 - rf.z0 < 3) continue;
    const nAC = (rf.top ? 2 : 1) + Math.floor(r() * (rf.top ? 4 : 2));
    for (let k = 0; k < nAC; k++) {
      const sx = 1.3 + r() * 1.2, sz = 1.0 + r() * 0.8, sh = 0.9 + r() * 0.5, [cx, cz] = at(rf, sx, sz);
      G.box(cx - sx / 2, cx + sx / 2, rf.y, rf.y + sh, cz - sz / 2, cz + sz / 2, METAL, DARK);
      if (r() < 0.5) G.box(cx - 0.12, cx + 0.12, rf.y + sh, rf.y + sh + 0.5, cz - 0.12, cz + 0.12, METAL, DARK); // vent stack
    }
  }
  if (top && top.x1 - top.x0 > 5 && top.z1 - top.z0 > 5) {
    // stair / elevator bulkhead
    { const sx = 3 + r() * 2.5, sz = 2.8 + r() * 1.5, [cx, cz] = at(top, sx, sz); const tr = style === 'F2' ? METAL : TRIM; G.box(cx - sx / 2, cx + sx / 2, top.y, top.y + 2.8, cz - sz / 2, cz + sz / 2, tr, ROOF); G.box(cx + sx / 2 - 1.2, cx + sx / 2 - 0.2, top.y, top.y + 2.1, cz + sz / 2, cz + sz / 2 + 0.03, DARK, null, 'Z'); }
    if (style !== 'F2' && r() < 0.5) { // water tank on legs
      const rad = 1.1 + r() * 0.6, [cx, cz] = at(top, rad * 2.4, rad * 2.4), lh = 1.6;
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.box(cx + lx * rad * 0.6 - 0.08, cx + lx * rad * 0.6 + 0.08, top.y, top.y + lh, cz + lz * rad * 0.6 - 0.08, cz + lz * rad * 0.6 + 0.08, METAL, METAL, 'xXzZ');
      G.box(cx - rad * 0.8, cx + rad * 0.8, top.y + lh - 0.15, top.y + lh, cz - rad * 0.8, cz + rad * 0.8, DARK, DARK);
      G.cyl(cx, cz, top.y + lh, top.y + lh + 2.4 + r(), rad, 10, METAL, DARK, 0.5);
    }
    if (r() < 0.55) { // antenna mast
      const [cx, cz] = at(top, 1, 1), mh = 5 + r() * (tall ? 9 : 4);
      G.box(cx - 0.09, cx + 0.09, top.y, top.y + mh, cz - 0.09, cz + 0.09, METAL, METAL, 'xXzZ');
      for (const f of [0.6, 0.85]) G.box(cx - 0.9, cx + 0.9, top.y + mh * f, top.y + mh * f + 0.08, cz - 0.04, cz + 0.04, METAL, METAL);
    }
    if (!tall && r() < 0.5) { // small rooftop billboard facing the road (+z)
      const bw = Math.min(top.x1 - top.x0 - 1, 7 + r() * 3), cx = lerp(top.x0 + bw / 2, top.x1 - bw / 2, r()), cz = top.z1 - 1.2, yb = top.y + 2.0, bh = bw * 0.4;
      for (const lx of [-0.35, 0.35]) G.box(cx + lx * bw - 0.1, cx + lx * bw + 0.1, top.y, yb, cz - 0.3, cz - 0.1, METAL, METAL, 'xXzZ');
      G.box(cx - bw / 2, cx + bw / 2, yb, yb + bh, cz - 0.12, cz, METAL, METAL, 'xXzt');
      G.quad([cx - bw / 2, yb, cz + 0.005], [bw, 0, 0], [0, bh, 0], [0, 0, 1], [0, 0], [1, 1], rectOf({ reg: R.AD }));
      G.box(cx - bw / 2, cx + bw / 2, yb - 0.1, yb, cz - 0.1, cz + 0.6, METAL, METAL); // catwalk
    }
  }
  return { geometry: G.geometry(), w: w + 2 * sw, d: d + 2 * sw, h: y };
}
const lerp = (a, b, t) => a + (b - a) * t;
