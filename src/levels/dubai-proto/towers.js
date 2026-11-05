import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../../rng.js';
import { range, rand, clamp } from '../../rng.js';

// =====================================================================================
//  MID-DISTANCE TOWERS — every mid tower is one merged geometry in ONE draw call, deformed
//  by a cheap vertex-shader rig (no debris sim, no CPU per-vertex work):
//   - an upper section that hinges about the edge of a break line and rotates (tilt / lean),
//   - an extra drop for that upper section once it has gone over,
//   - a whole-tower drop (pancake into its own dust),
//   - anything pushed under the ground is crushed into a low lumpy mound.
//  Per tower that is 3 vec4 uniforms; the CPU only integrates ~6 numbers per tower.
//  FarSkyline: intact + pre-ruined instanced boxes, swapped only when HorizonWall proves the
//  tower is hidden (see overdust.js).
// =====================================================================================

const MAXT = 12;
const RIG_GLSL = /* glsl */`
attribute float aT;
uniform vec3 uBase[${MAXT}];
uniform vec4 uFall[${MAXT}];  // fall dir x, z, theta, whole-tower drop
uniform vec4 uBrk[${MAXT}];   // break height, hinge offset along fall dir, upper drop, unused
varying float vLY; varying float vCrush;
vec3 rotAx(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
`;

export class MidTowers {
  constructor(scene, list, F) {
    this.list = list;
    this.F = F;
    const geos = [];
    list.forEach((t, i) => {
      const seg = (n) => Math.max(1, Math.round(n * F.detail));
      const parts = [];
      const hMain = t.setback ? t.h * 0.78 : t.h;
      const b = new THREE.BoxGeometry(t.w, hMain, t.d, seg(2), seg(Math.ceil(hMain / 16)), seg(2)); b.translate(0, hMain / 2, 0); parts.push(b);
      if (t.setback) { const h2 = t.h - hMain; const c = new THREE.BoxGeometry(t.w * 0.62, h2, t.d * 0.62, seg(1), seg(Math.ceil(h2 / 16)), seg(1)); c.translate(0, hMain + h2 / 2, 0); parts.push(c); }
      // a mast on the roof (reads the tilt from far away)
      const m = new THREE.BoxGeometry(2, 30, 2, 1, seg(2), 1); m.translate(0, t.h + 15, 0); parts.push(m);
      let g = mergeGeometries(parts.map(p => p.toNonIndexed()));
      g.rotateY(t.rot);
      const n = g.attributes.position.count;
      g.setAttribute('aT', new THREE.Float32BufferAttribute(new Float32Array(n).fill(i), 1));
      const shade = 0.7 + 0.25 * ((i * 0.37) % 1);
      const col = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { col[k * 3] = shade; col[k * 3 + 1] = shade * 0.98; col[k * 3 + 2] = shade * 0.95; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g);
    });
    this.u = {
      uBase: { value: list.map(t => new THREE.Vector3(t.x, 0, t.z)).concat(Array.from({ length: MAXT - list.length }, () => new THREE.Vector3())) },
      uFall: { value: Array.from({ length: MAXT }, () => new THREE.Vector4(1, 0, 0, 0)) },
      uBrk: { value: Array.from({ length: MAXT }, () => new THREE.Vector4(1e5, 0, 0, 0)) },
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xb8b2a8, roughness: 0.82, metalness: 0.05, vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + RIG_GLSL)
        .replace('#include <beginnormal_vertex>', `
          int ti = int(aT + 0.5);
          vec4 F = uFall[ti]; vec4 B = uBrk[ti];
          vec3 rp = position; vec3 objectNormal = normal;
          vec3 fd = vec3(F.x, 0.0, F.y);
          vec3 ax = normalize(cross(vec3(0.0, 1.0, 0.0), fd));
          if (rp.y > B.x) {
            vec3 hg = fd * B.y + vec3(0.0, B.x, 0.0);
            rp = hg + rotAx(rp - hg, ax, F.z);
            rp.y -= B.z;
            objectNormal = rotAx(objectNormal, ax, F.z);
          }
          rp.y -= F.w;
          vCrush = 0.0;
          if (rp.y < 0.0) {
            float c = -rp.y;
            float j = fract(sin(dot(position.xz + position.y * 0.37, vec2(12.9898, 78.233))) * 43758.5453);
            rp.y = 18.0 * (1.0 - exp(-c / 50.0)) * (0.35 + 0.65 * j) - 1.0;
            rp.xz *= 1.0 + min(c, 120.0) * 0.004;
            objectNormal = normalize(objectNormal + vec3(j - 0.5, 1.0, fract(j * 7.3) - 0.5));
            vCrush = 1.0;
          }
          vLY = position.y;
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3(tangent.xyz);
          #endif`)
        .replace('#include <begin_vertex>', 'vec3 transformed = rp + uBase[ti];');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLY; varying float vCrush;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          // floor lines every 4 m + darker spandrels: scale and tilt read from 1 km
          diffuseColor.rgb *= mix(0.86 + 0.14 * step(0.18, fract(vLY / 4.0)), 0.55, vCrush);`);
    };
    mat.customProgramCacheKey = () => 'dubai-midrig';
    this.material = mat;
    this.mesh = new THREE.Mesh(geos.length ? mergeGeometries(geos) : new THREE.BufferGeometry(), mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = geos.length > 0;
    scene.add(this.mesh);
    this.tris = geos.reduce((s, g) => s + g.attributes.position.count / 3, 0);
    this.state = list.map(() => null);
  }

  // start tower i falling. dir: unit xz; returns false if it already fell
  fall(i) {
    if (this.state[i]) return false;
    const t = this.list[i];
    // fall sideways along the ring (seen side-on from the rail), alternating sides
    const rx = t.x / Math.hypot(t.x, t.z), rz = t.z / Math.hypot(t.x, t.z);
    const s = i % 2 ? 1 : -1;
    const fx = -rz * s, fz = rx * s;
    const half = 0.5 * (Math.abs(fx) * t.w + Math.abs(fz) * t.d);
    const brk = t.mode === 'tilt' ? t.h * range(0.38, 0.52) : t.mode === 'lean' ? 4 : t.h + 100;
    this.state[i] = { t: 0, th: 0, om: 0, drop: 0, dropV: 0, up: 0, upV: 0, fx, fz, half, brk, landed: false, mode: t.mode, done: false };
    return true;
  }
  falling() { return this.state.filter(s => s && !s.done).length; }
  reset() {
    this.state = this.list.map(() => null);
    for (let i = 0; i < MAXT; i++) { this.u.uFall.value[i].set(1, 0, 0, 0); this.u.uBrk.value[i].set(1e5, 0, 0, 0); }
  }
  // returns events for the dust: [{kind, x, y, z, i}]
  update(dt, dust) {
    for (let i = 0; i < this.list.length; i++) {
      const S = this.state[i]; if (!S || S.done) continue;
      const T = this.list[i];
      S.t += dt;
      if (S.mode === 'pancake') {
        if (S.t > 0.8) { S.dropV = Math.min(28, S.dropV + 9.8 * 0.7 * dt); S.drop += S.dropV * dt; }
        if (S.drop > T.h + 40) S.done = true;
        // the skirt boils out of the base the whole way down; a plume pours off the crush line
        for (let k = dust.emitN(5, dt); k > 0; k--) dust.skirt(T.x, T.z, Math.max(T.w, T.d) * 0.9);
        if (S.drop > 5) for (let k = dust.emitN(1.5, dt); k > 0; k--) dust.plume(T.x + range(-T.w, T.w) * 0.5, range(10, 40), T.z + range(-T.d, T.d) * 0.5, 0, 0, 1.2);
      } else {
        // tilt / lean: the upper section goes over about the hinge (Level 3's lean: om += k sin(th) dt)
        if (S.t > 0.6) { S.om += 0.42 * Math.sin(S.th + 0.12) * dt; S.th = Math.min(Math.PI * 0.55, S.th + S.om * dt); }
        if (S.th > 1.15) { S.upV = Math.min(40, S.upV + 9.8 * 0.85 * dt); S.up += S.upV * dt; }
        // the stump under the break pancakes once the top has left
        if (S.mode === 'tilt' && S.th > 0.5) { S.dropV = Math.min(14, S.dropV + 5 * dt); S.drop = Math.min(S.brk + 10, S.drop + S.dropV * dt); }
        if (S.mode === 'lean' && S.th > 0.9) { S.dropV = Math.min(10, S.dropV + 4 * dt); S.drop += S.dropV * dt; }
        // the top hits the ground: where the roof lands (hinge + length along fall dir)
        const L = T.h - S.brk;
        const topY = S.brk - S.drop + Math.cos(S.th) * L - S.up;
        if (!S.landed && topY < 8) {
          S.landed = true;
          const d = S.half + Math.sin(S.th) * L * 0.75;
          dust.impact(T.x + S.fx * d, T.z + S.fz * d, L * 0.3, 1.4);
        }
        if (S.landed && S.up > L + 60) S.done = true;
        const by = Math.max(5, S.brk - S.drop);
        if (S.th > 0.05) for (let k = dust.emitN(2.2, dt); k > 0; k--) dust.plume(T.x + S.fx * S.half + range(-10, 10), by + range(-5, 10), T.z + S.fz * S.half + range(-10, 10), S.fx * 4, S.fz * 4, 1, rand() < 0.3);
        if (S.drop > 3) for (let k = dust.emitN(2.5, dt); k > 0; k--) dust.skirt(T.x, T.z, Math.max(T.w, T.d) * 0.8, 0.8);
      }
      const f = this.u.uFall.value[i], b = this.u.uBrk.value[i];
      f.set(S.fx, S.fz, S.th, S.drop);
      b.set(S.brk, S.half, S.up, 0);
    }
  }
}

// ---------------------------------------------------------------------------- far skyline
export class FarSkyline {
  constructor(scene, list, F) {
    this.list = list; this.F = F;
    const N = Math.max(1, list.length);
    const box = new THREE.BoxGeometry(1, 1, 1, 1, 2, 1); box.translate(0, 0.5, 0);
    // ruin: a stump with a torn, jagged top (one geometry for all of them, scaled per instance)
    const ruin = new THREE.BoxGeometry(1, 1, 1, 4, 3, 4); ruin.translate(0, 0.5, 0);
    const p = ruin.attributes.position, rr = makeRng(31);
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y > 0.99) p.setY(i, 0.45 + rr() * 0.55);
      else if (y > 0.6) p.setY(i, y - rr() * 0.2);
      if (y > 0.6) { p.setX(i, p.getX(i) * (0.8 + rr() * 0.25)); p.setZ(i, p.getZ(i) * (0.8 + rr() * 0.25)); }
    }
    ruin.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x9e978d, roughness: 0.85, metalness: 0.05 });
    const rmat = new THREE.MeshStandardMaterial({ color: F.swapdebug ? 0xd02010 : 0x6b625a, roughness: 0.95, metalness: 0.0 });
    this.intact = new THREE.InstancedMesh(box, mat, N);
    this.ruined = new THREE.InstancedMesh(ruin, rmat, N);
    for (const m of [this.intact, this.ruined]) { m.frustumCulled = false; scene.add(m); }
    this.swapped = list.map(() => false);
    this.samples = list.map(t => {
      // points that must all be hidden: base, mid, top, and the mid edges (in the tower's own frame)
      const c = Math.cos(t.rot), s = Math.sin(t.rot), hw = t.w / 2;
      return [[0, 3, 0], [0, t.h * 0.5, 0], [0, t.h, 0], [hw * c, t.h * 0.5, -hw * s], [-hw * c, t.h * 0.5, hw * s], [0, t.h + 25, 0]].map(([x, y, z]) => new THREE.Vector3(t.x + x, y, t.z + z));
    });
    this.count = 0; this.checked = 0; this.cursor = 0;
    this._write();
  }
  _write() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    let a = 0, b = 0;
    this.list.forEach((t, i) => {
      q.setFromAxisAngle(Y, t.rot); p.set(t.x, 0, t.z);
      if (this.swapped[i]) { m.compose(p, q, s.set(t.w, t.h * t.ruin, t.d)); this.ruined.setMatrixAt(b++, m); }
      else { m.compose(p, q, s.set(t.w, t.h, t.d)); this.intact.setMatrixAt(a++, m); }
    });
    this.intact.count = a; this.ruined.count = b;
    this.intact.instanceMatrix.needsUpdate = true; this.ruined.instanceMatrix.needsUpdate = true;
    this.count = b;
  }
  reset() { this.swapped.fill(false); this._write(); }
  // time-sliced: a quarter of the towers per frame. A tower swaps only when EVERY sample point is behind the
  // opaque part of the horizon wall from the current eye (both eyes are within 4 cm of it: the margin covers that).
  update(eye, wall) {
    if (!this.F.swap || !wall.state || !this.list.length) return;
    const n = Math.ceil(this.list.length / 4);
    let changed = false;
    for (let k = 0; k < n; k++) {
      const i = this.cursor++ % this.list.length;
      if (this.swapped[i]) continue;
      this.checked++;
      if (this.samples[i].every(P => wall.hides(eye, P))) { this.swapped[i] = true; changed = true; }
    }
    if (changed) this._write();
  }
}

// ---------------------------------------------------------------------------- ground + city fabric
export function buildGround(scene) {
  const g = new THREE.Group();
  const sand = new THREE.Mesh(new THREE.CircleGeometry(9000, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb59a76, roughness: 1 }));
  g.add(sand);
  // the Gulf to the north, a coast at ~2.8 km
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(18000, 7000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x24404e, roughness: 0.25, metalness: 0.3 }));
  sea.position.set(0, 0.4, -2800 - 3500);
  g.add(sea);
  // city fabric: low blocks to ~1.2 km (motion parallax under the heli = a stable comfort reference)
  const rng = makeRng(99), N = 900;
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const im = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0xa79a88, roughness: 0.9 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  let k = 0;
  for (let i = 0; i < N; i++) {
    const a = rng() * Math.PI * 2, r = 120 + Math.sqrt(rng()) * 1150;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z < -2700) continue;
    const s = 14 + rng() * 30, h = 8 + rng() * rng() * 60;
    q.setFromAxisAngle(Y, Math.round(rng() * 4) * Math.PI / 2 + 0.1);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, h, s * (0.6 + rng() * 0.8)));
    im.setMatrixAt(k++, m);
  }
  im.count = k;
  g.add(im);
  scene.add(g);
  return g;
}
