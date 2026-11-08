import * as THREE from 'three';
import { range, rand } from '../../rng.js';
import { GeoBuilder, buildTower } from './towerkit.js';
import { facadeMaterial } from './facade.js';

// =====================================================================================
//  TOWERS THAT FALL — every tower that comes down (strike targets, the gunship's crash tower,
//  the escalation fallers, the spire's neighbour) is a full kit tower with the city's facades,
//  merged into ONE draw and deformed by the prototype's vertex-shader rig (3 vec4 uniforms per
//  tower): an upper section hinged on a break line (tilt / lean), a drop for that section, a
//  whole-tower drop (pancake), and anything pushed under the ground crushed into a sooty mound.
//  Rows every 8 m so the hinge bends cleanly. The CPU integrates ~6 numbers per tower.
// =====================================================================================

const MAXT = 12;
const RIG_HEAD = /* glsl */`
attribute float aT;
uniform vec3 uBase[${MAXT}];
uniform vec4 uFall[${MAXT}];  // fall dir x, z, theta, whole-tower drop
uniform vec4 uBrk[${MAXT}];   // break height, hinge offset along fall dir, upper drop, sink-shrink
varying float vCrush;
vec3 rotAx(vec3 v, vec3 k, float a) { float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
`;
const RIG_BEGIN = /* glsl */`
  int ti = int(aT + 0.5);
  vec4 Fl = uFall[ti]; vec4 Bk = uBrk[ti];
  vec3 rp = position; vec3 objectNormal = normal;
  vec3 fd = vec3(Fl.x, 0.0, Fl.y);
  vec3 ax = normalize(cross(vec3(0.0, 1.0, 0.0), fd) + vec3(1e-5));
  if (rp.y > Bk.x) {
    vec3 hg = fd * Bk.y + vec3(0.0, Bk.x, 0.0);
    rp = hg + rotAx(rp - hg, ax, Fl.z);
    rp.y -= Bk.z;
    objectNormal = rotAx(objectNormal, ax, Fl.z);
  }
  rp.y -= Fl.w;
  vCrush = 0.0;
  if (rp.y < 0.0) {
    float c = -rp.y;
    float j = fract(sin(dot(position.xz + position.y * 0.37, vec2(12.9898, 78.233))) * 43758.5453);
    rp.y = 22.0 * (1.0 - exp(-c / 50.0)) * (0.35 + 0.65 * j) - 1.0;
    rp.xz *= 1.0 + min(c, 120.0) * 0.005;
    objectNormal = normalize(objectNormal + vec3(j - 0.5, 1.0, fract(j * 7.3) - 0.5));
    vCrush = 1.0;
  }
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3(tangent.xyz);
  #endif`;

export class MidRig {
  constructor(scene, list, sun) {
    this.list = list; this.sun = sun;
    const gb = new GeoBuilder('aT');
    list.forEach((t, i) => {
      t.rigIdx = i;
      gb.X = i;
      const n0 = gb.p.length;
      buildTower(gb, t, { local: true, seg: 8, podium: false });
      // rotate the new vertices to the tower's heading (the rig works in world axes, base at uBase)
      const c = Math.cos(t.rot || 0), s = Math.sin(t.rot || 0);
      for (let k = n0; k < gb.p.length; k += 3) {
        const x = gb.p[k], z = gb.p[k + 2]; gb.p[k] = x * c + z * s; gb.p[k + 2] = -x * s + z * c;
        const nx = gb.n[k], nz = gb.n[k + 2]; gb.n[k] = nx * c + nz * s; gb.n[k + 2] = -nx * s + nz * c;
      }
      sun?.setDynamic('m' + i, t, t.h);
    });
    this.u = {
      uBase: { value: list.map(t => new THREE.Vector3(t.x, 0, t.z)).concat(Array.from({ length: MAXT - list.length }, () => new THREE.Vector3())) },
      uFall: { value: Array.from({ length: MAXT }, () => new THREE.Vector4(1, 0, 0, 0)) },
      uBrk: { value: Array.from({ length: MAXT }, () => new THREE.Vector4(1e5, 0, 0, 0)) },
    };
    const mat = facadeMaterial({
      key: 'rig', uniforms: this.u,
      vertexHead: RIG_HEAD,
      vertexBegin: RIG_BEGIN,
      vertexTransform: 'vec3 transformed = rp + uBase[ti];',
      vertexTail: 'vRuin = vCrush;',
    });
    this.material = mat;
    this.mesh = new THREE.Mesh(gb.geometry(), mat);
    this.mesh.frustumCulled = false; this.mesh.name = 'midrig';
    scene.add(this.mesh);
    this.tris = gb.tris;
    this.state = list.map(() => null);
  }
  // start tower i falling toward unit {x, z} (null = sideways to the ring)
  fall(i, dir) {
    if (this.state[i]) return false;
    const t = this.list[i];
    const fx = dir.x, fz = dir.z, l = Math.hypot(fx, fz) || 1;
    const half = 0.5 * (Math.abs(fx / l) * t.w + Math.abs(fz / l) * t.d);
    const brk = t.mode === 'tilt' ? t.h * range(0.42, 0.55) : t.mode === 'lean' ? 6 : t.h + 100;
    this.state[i] = { t: 0, th: 0, om: 0, drop: 0, dropV: 0, up: 0, upV: 0, fx: fx / l, fz: fz / l, half, brk, landed: false, mode: t.mode, done: false };
    t.gone = true;
    this.sun?.setDynamic('m' + i, t, t.mode === 'pancake' ? 30 : brk * 0.7); this.sun?.commit();
    return true;
  }
  falling() { return this.state.filter(s => s && !s.done).length; }
  isDown(i) { return !!this.state[i]; }
  update(dt, dust, onLand) {
    for (let i = 0; i < this.list.length; i++) {
      const S = this.state[i]; if (!S || S.done) continue;
      const T = this.list[i];
      S.t += dt;
      if (S.mode === 'pancake') {
        if (S.t > 0.8) { S.dropV = Math.min(30, S.dropV + 9.8 * 0.7 * dt); S.drop += S.dropV * dt; }
        if (S.drop > T.h + 40) { S.done = true; onLand?.(T, T.x, T.z); }
        for (let k = dust.emitN(5, dt); k > 0; k--) dust.skirt(T.x, T.z, Math.max(T.w, T.d) * 0.9);
        if (S.drop > 5) for (let k = dust.emitN(1.8, dt); k > 0; k--) dust.plume(T.x + range(-T.w, T.w) * 0.5, range(10, 40), T.z + range(-T.d, T.d) * 0.5, 0, 0, 1.2);
      } else {
        if (S.t > 0.6) { S.om += 0.42 * Math.sin(S.th + 0.12) * dt; S.th = Math.min(Math.PI * 0.55, S.th + S.om * dt); }
        if (S.th > 1.15) { S.upV = Math.min(40, S.upV + 9.8 * 0.85 * dt); S.up += S.upV * dt; }
        if (S.mode === 'tilt' && S.th > 0.5) { S.dropV = Math.min(14, S.dropV + 5 * dt); S.drop = Math.min(S.brk + 10, S.drop + S.dropV * dt); }
        if (S.mode === 'lean' && S.th > 0.9) { S.dropV = Math.min(10, S.dropV + 4 * dt); S.drop += S.dropV * dt; }
        const L = T.h - S.brk;
        const topY = S.brk - S.drop + Math.cos(S.th) * L - S.up;
        if (!S.landed && topY < 8) {
          S.landed = true;
          const d = S.half + Math.sin(S.th) * L * 0.75;
          dust.impact(T.x + S.fx * d, T.z + S.fz * d, L * 0.3, 1.4);
          onLand?.(T, T.x + S.fx * d, T.z + S.fz * d);
        }
        if (S.landed && S.up > L + 60) S.done = true;
        const by = Math.max(5, S.brk - S.drop);
        if (S.th > 0.05) for (let k = dust.emitN(2.4, dt); k > 0; k--) dust.plume(T.x + S.fx * S.half + range(-10, 10), by + range(-5, 10), T.z + S.fz * S.half + range(-10, 10), S.fx * 4, S.fz * 4, 1, rand() < 0.35);
        if (S.drop > 3) for (let k = dust.emitN(2.5, dt); k > 0; k--) dust.skirt(T.x, T.z, Math.max(T.w, T.d) * 0.8, 0.8);
      }
      this.u.uFall.value[i].set(S.fx, S.fz, S.th, S.drop);
      this.u.uBrk.value[i].set(S.brk, S.half, S.up, 0);
    }
  }
  // beat jumps: put a tower straight into its fallen state
  setFallen(i, dir) {
    if (!this.state[i]) this.fall(i, dir);
    const S = this.state[i], T = this.list[i];
    S.done = true; S.landed = true;
    if (S.mode === 'pancake') S.drop = T.h + 40; else { S.th = Math.PI * 0.55; S.up = T.h; S.drop = S.brk + 10; }
    this.u.uFall.value[i].set(S.fx, S.fz, S.th, S.drop);
    this.u.uBrk.value[i].set(S.brk, S.half, S.up, 0);
  }
}
