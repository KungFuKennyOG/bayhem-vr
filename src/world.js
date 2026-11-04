import * as THREE from 'three';
import * as T from './textures.js';
import { box, at, cyl, profileStrip, merge, mergeGrouped, mergeGeometries } from './geom.js';
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
import { makeRng } from './rng.js';
import { BillboardBatch, CELL } from './particles.js';
import { SUN_DIR } from './atmosphere.js';

// World layout (relative frame: truck at origin, driving toward -z; world scrolls toward +z)
export const LANES = [-5.55, -1.85, 1.85, 5.55];
export const ROAD_L = -9.0, ROAD_R = 10.0;
export const Z_FAR = -620, Z_NEAR = 140;
const SPAN = Z_NEAR - Z_FAR;

// Recycling instanced props
class Scroller {
  constructor(mesh, count, spacing, phase, reroll) {
    this.mesh = mesh; this.count = count; this.spacing = spacing; this.reroll = reroll;
    this.items = [];
    this.span = count * spacing;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const it = { z: Z_NEAR - this.span + i * spacing + phase, n: i * 7919 + 13, data: {} };
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
    groundTex.repeat.set(1600 / 14, SPAN / 14);
    groundTex.anisotropy = aniso;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, SPAN), new THREE.MeshLambertMaterial({ map: groundTex, color: 0xc9b7a0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.06, (Z_NEAR + Z_FAR) / 2);
    ground.receiveShadow = true;
    this.group.add(ground);
    this._scrollTex(groundTex, 14);

    // ---------------- road ----------------
    const { map, normalMap } = T.roadTextures();
    map.anisotropy = aniso; normalMap.anisotropy = aniso;
    const reps = SPAN / T.ROAD.tileLen;
    map.repeat.set(1, reps); normalMap.repeat.set(1, reps);
    const roadMat = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.22, 0.22), roughness: 0.56, metalness: 0.0, envMapIntensity: 1.1 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(T.ROAD.width, SPAN), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(ROAD_L + T.ROAD.width / 2, 0, (Z_NEAR + Z_FAR) / 2);
    road.receiveShadow = true;
    this.group.add(road);
    // oncoming side (mirrored)
    const map2 = map.clone(); map2.repeat.set(-1, reps); map2.needsUpdate = true;
    const n2 = normalMap.clone(); n2.repeat.set(-1, reps); n2.needsUpdate = true;
    const road2 = new THREE.Mesh(new THREE.PlaneGeometry(T.ROAD.width, SPAN), roadMat.clone());
    road2.material.map = map2; road2.material.normalMap = n2;
    road2.rotation.x = -Math.PI / 2; road2.position.set(-9.8 - T.ROAD.width / 2, 0, (Z_NEAR + Z_FAR) / 2);
    road2.receiveShadow = true;
    this.group.add(road2);
    for (const t of [map, normalMap, map2, n2]) this._scrollTex(t, T.ROAD.tileLen);
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
      const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x80807c }), 200);
      mesh.castShadow = false;
      this.group.add(mesh); mesh.frustumCulled = false;
      this.scrollers.push(new Scroller(mesh, 190, 4, 0, () => {}));
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
      const mesh = new THREE.InstancedMesh(geometry, [poleMat, headMat], 20);
      mesh.castShadow = true; mesh.frustumCulled = false;
      this.group.add(mesh);
      const sc = new Scroller(mesh, 18, 42, 10, () => {});
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
      const frondMat = new THREE.MeshLambertMaterial({ map: frond, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x98a070 });
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
        const n = 34;
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

    // ---------------- buildings (both sides) ----------------
    {
      const variants = [];
      for (let v = 0; v < 8; v++) {
        const r = makeRng(500 + v * 17);
        const floors = 3 + Math.floor(r() * (v < 4 ? 5 : 12));
        const fh = 3.4;
        const w = 16 + r() * 26, d = 14 + r() * 18, h = floors * fh;
        const bays = Math.max(3, Math.round(w / 3.6));
        const { map, emissiveMap } = T.facadeTextures2(700 + v * 13, floors, bays);
        map.anisotropy = 4;
        const mat = new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.0 });
        const side = T.facadeTextures2(900 + v * 13, floors, Math.max(3, Math.round(d / 3.6)));
        const matSide = new THREE.MeshLambertMaterial({ map: side.map, emissiveMap: side.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.0 });
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a524c });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x3c3632 });
        // box with per-face materials: +x,-x side; +z,-z front; y roof
        const g = box(w, h, d); g.translate(0, h / 2, 0);
        g.clearGroups();
        // BoxGeometry index order: px, nx, py, ny, pz, nz (6 indices*... each face 6 indices)
        g.addGroup(0, 12, 2); g.addGroup(12, 12, 0); g.addGroup(24, 12, 1);
        const parts = [];
        const extra = [];
        extra.push([at(box(w + 0.5, 0.7, d + 0.5), 0, h + 0.35, 0), 3]);
        extra.push([at(box(w * 0.28, 2.2, d * 0.3), (r() - 0.5) * w * 0.4, h + 1.1, (r() - 0.5) * d * 0.4), 2]);
        if (r() < 0.7) { extra.push([at(cyl(1.2, 1.2, 2.4, 10), w * 0.3, h + 2.6, -d * 0.2), 3]); extra.push([at(box(0.14, 1.4, 0.14), w * 0.3 + 0.8, h + 0.7, -d * 0.2 + 0.8), 3]); extra.push([at(box(0.14, 1.4, 0.14), w * 0.3 - 0.8, h + 0.7, -d * 0.2 - 0.8), 3]); }
        if (r() < 0.5) for (let k = 0; k < 4; k++) extra.push([at(box(1.6, 1.0, 1.2), (r() - 0.5) * w * 0.7, h + 0.5, (r() - 0.5) * d * 0.7), 3]);
        if (h > 30 && r() < 0.6) extra.push([at(box(0.2, 8, 0.2), 0, h + 4, 0), 3]);
        // ledges every few floors
        for (let f = 1; f < floors; f += 3) extra.push([at(box(w + 0.3, 0.25, d + 0.3), 0, f * fh, 0), 3]);
        const { geometry: eg } = mergeGrouped(extra, 4);
        const geom = merge2(g, eg);
        variants.push({ geometry: geom, mats: [roofMat, mat, matSide, trimMat], w, d, h });
      }
      variants.forEach((v, vi) => {
        const n = 8;
        const mesh = new THREE.InstancedMesh(v.geometry, v.mats, n);
        mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
        this.group.add(mesh);
        this.scrollers.push(new Scroller(mesh, n, SPAN / n, vi * 9, (it) => {
          const r = makeRng(it.n * 3 + vi);
          const side = r() < 0.55 ? 1 : -1;
          it.data.x = side > 0 ? 30 + v.w / 2 + r() * 80 : -44 - v.w / 2 - r() * 90;
          it.data.ry = (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() < 0.3 ? Math.PI / 2 : 0);
          it.data.dz = (r() - 0.5) * 20;
        }));
      });
    }

    // ---------------- sound walls (LA freeway canyon) ----------------
    {
      const wt = T.soundWallTexture(21);
      wt.anisotropy = aniso;
      const wallMat = new THREE.MeshLambertMaterial({ map: wt });
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
      for (const sideX of [12.9, -31.0]) {
        const n = Math.ceil(SPAN / segL);
        const mesh = new THREE.InstancedMesh(geometry, [wallMat, capMat], n);
        mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
        this.group.add(mesh);
        this.scrollers.push(new Scroller(mesh, n, segL, sideX > 0 ? 0 : 7, (it) => {
          const r = makeRng(it.n + (sideX > 0 ? 1 : 2));
          it.data.x = sideX; it.data.hidden = r() < 0.14;
          it.data.sy = 0.9 + r() * 0.25;
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
        const n = 60;
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
        const mesh = new THREE.InstancedMesh(geometry, [face, frame], 3);
        mesh.castShadow = true; mesh.frustumCulled = false;
        this.group.add(mesh);
        this.scrollers.push(new Scroller(mesh, 3, SPAN / 3, 70 + k * 47, (it) => {
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
      const { geometry } = mergeGrouped(parts, 3);
      const mesh = new THREE.InstancedMesh(geometry, [m0, m1, m2], 2);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      this.group.add(mesh);
      const sc = new Scroller(mesh, 2, SPAN / 2, 120, () => {});
      this.scrollers.push(sc);
      this.overpassScroller = sc;
      // sign faces as separate textured planes (instanced too)
      const st = T.signTexture(['HAVEN CITY', 'NEXT 4 EXITS'], { arrow: false });
      const sm = new THREE.InstancedMesh(at(new THREE.PlaneGeometry(8.8, 2.2), 1.5, deckY + 3.4, deckD / 2 + 0.32), new THREE.MeshLambertMaterial({ map: st, emissive: 0xffffff, emissiveMap: st, emissiveIntensity: 0.15 }), 2);
      sm.frustumCulled = false; this.group.add(sm);
      this.scrollers.push(new Scroller(sm, 2, SPAN / 2, 120, () => {}));
      // cars parked on the overpass for life
      for (const it of sc.items) {
        this.glowList.push({ it, x: -20, y: deckY + 2.2, size: 1.2, c: [1, 0.9, 0.7], a: 0.6 });
      }
    }

    // ---------------- sign gantries ----------------
    {
      const steel = new THREE.MeshStandardMaterial({ color: 0x9a9da2, metalness: 0.75, roughness: 0.45 });
      const parts = [
        [at(box(0.35, 7.6, 0.35), 11.6, 3.8, 0), 0], [at(box(0.35, 7.6, 0.35), -8.9, 3.8, 0), 0],
        [at(box(20.8, 0.3, 0.3), 1.35, 7.1, 0.5), 0], [at(box(20.8, 0.3, 0.3), 1.35, 7.1, -0.5), 0],
        [at(box(20.8, 0.3, 0.3), 1.35, 5.4, 0.5), 0], [at(box(20.8, 0.3, 0.3), 1.35, 5.4, -0.5), 0],
      ];
      for (let k = 0; k < 10; k++) parts.push([at(box(0.08, 1.9, 0.08), -8.5 + k * 2.1, 6.25, 0.5, 0, 0, 0.6), 0]);
      const { geometry } = mergeGrouped(parts, 1);
      const mesh = new THREE.InstancedMesh(geometry, [steel], 3);
      mesh.castShadow = true; mesh.frustumCulled = false;
      this.group.add(mesh);
      const sc = new Scroller(mesh, 3, SPAN / 3, 40, () => {});
      this.scrollers.push(sc);
      const signs = [
        T.signTexture(['DOWNTOWN', 'HAVEN CITY'], { exit: 'EXIT 42A' }),
        T.signTexture(['PORT OF', 'VICTORY'], { exit: 'EXIT 43' }),
        T.signTexture(['AIRPORT', 'NO RETURN'], { arrow: true }),
      ];
      signs.forEach((t, k) => {
        const m = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12 });
        const g = merge([at(box(6.2, 3.1, 0.12), 0, 0, 0)]);
        const face = at(new THREE.PlaneGeometry(6.2, 3.1), 0, 0, 0.07);
        const { geometry: gg } = mergeGrouped([[g, 0], [face, 1]], 2);
        const im = new THREE.InstancedMesh(gg, [steel, m], 3);
        im.castShadow = true; im.frustumCulled = false;
        this.group.add(im);
        const off = [-4.2, 2.6, 8.0][k];
        this.scrollers.push(new Scroller(im, 3, SPAN / 3, 40, (it) => {
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
        col.push(color[0], color[1], color[2], color[0] * 1.15, color[1] * 1.1, color[2] * 1.1);
      }
      for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, side: THREE.DoubleSide }));
      m.renderOrder = -40;
      this.far.add(m);
      return m;
    };
    ridge(1900, 260, 7, [0.32, 0.22, 0.30], 0, 0.22);
    ridge(1500, 150, 9, [0.22, 0.15, 0.20], 0, 0.3);
    // skyline strips (cylindrical, alpha)
    const sky1 = T.skylineTexture(3);
    const mkSky = (radius, height, arcStart, arcLen, tex, y = 0) => {
      const g = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true, arcStart, arcLen);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.BackSide, fog: true, color: 0xb9a3a8 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.y = height / 2 - 6 + y;
      mesh.renderOrder = -30;
      this.far.add(mesh);
      return mesh;
    };
    // city ahead (toward the sun) across ~130 degrees
    const sunYaw = Math.atan2(SUN_DIR.x, SUN_DIR.z);
    const cs = mkSky(1100, 150, sunYaw + Math.PI / 2 - 1.3, 2.6, sky1);
    const t2 = T.skylineTexture(17); t2.repeat.set(2, 1);
    mkSky(780, 70, sunYaw + Math.PI / 2 + 1.1, 1.6, t2, -2);
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
