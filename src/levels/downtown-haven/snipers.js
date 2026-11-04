import * as THREE from 'three';
import { BillboardBatch, CELL } from '../../particles.js';
import { clamp } from '../../rng.js';

// =====================================================================================
//  Sniper dressing: a scope + suppressor on the gunman's rifle, and the laser sights:
//  every beam in one InstancedMesh (bright core + soft haze around it), the dots where they
//  land and the scope glints in one billboard batch.
// =====================================================================================
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

let scopeGeo = null, scopeMat = null;
export function buildScope(gm) {
  if (!scopeGeo) {
    const parts = [];
    const tube = new THREE.CylinderGeometry(0.024, 0.024, 0.3, 10); tube.rotateX(Math.PI / 2); tube.translate(0, 0.105, -0.3); parts.push(tube);
    const bell = new THREE.CylinderGeometry(0.034, 0.025, 0.07, 10); bell.rotateX(Math.PI / 2); bell.translate(0, 0.105, -0.48); parts.push(bell);
    const eye = new THREE.CylinderGeometry(0.03, 0.024, 0.05, 10); eye.rotateX(Math.PI / 2); eye.translate(0, 0.105, -0.14); parts.push(eye);
    for (const z of [-0.24, -0.36]) { const r = new THREE.BoxGeometry(0.02, 0.07, 0.025); r.translate(0, 0.07, z); parts.push(r); }
    const sup = new THREE.CylinderGeometry(0.026, 0.026, 0.26, 10); sup.rotateX(Math.PI / 2); sup.translate(0, 0.036, -0.93); parts.push(sup);
    scopeGeo = mergeSimple(parts);
    scopeMat = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.7, roughness: 0.35 });
  }
  const bone = gm.muzzle.parent;
  const m = new THREE.Mesh(scopeGeo, scopeMat); m.castShadow = true;
  bone.add(m);
  // the round leaves the end of the suppressor; the glint comes off the objective lens
  gm.muzzle.position.z -= 0.26;
  const lens = new THREE.Object3D(); lens.position.set(0, 0.105, -0.52); bone.add(lens);
  return { mesh: m, lens };
}
function mergeSimple(geos) {
  let n = 0; for (const g of geos) n += g.index ? g.index.count : g.attributes.position.count;
  const pos = [], nor = [];
  for (const g0 of geos) { const g = g0.index ? g0.toNonIndexed() : g0; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export class LaserFX {
  constructor(game, max = 12) {
    this.g = game; this.max = max;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
    // additive beams that fade out right in front of the eye (a beam aimed at your face must not become a red wall)
    const mk = (opacity) => {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vEyeD;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\n vEyeD = -mvPosition.z;');
        sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vEyeD;\nvoid main() {').replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.rgb *= smoothstep(0.6, 4.0, vEyeD);');
      };
      return m;
    };
    this.core = new THREE.InstancedMesh(geo, mk(1), max);
    this.haze = new THREE.InstancedMesh(geo, mk(1), max);
    for (const m of [this.core, this.haze]) { m.frustumCulled = false; m.count = 0; m.renderOrder = 18; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); game.scene.add(m); }
    this.dots = new BillboardBatch(max * 3 + 4, game.E.atlas, { boost: 1, renderOrder: 23, fog: game.scene.fog });
    game.scene.add(this.dots.mesh);
  }
  // per frame: beams from every live sniper's muzzle to wherever its laser lands
  update(dt) {
    const g = this.g, head = g.headPos;
    let n = 0, d = 0;
    for (const s of g.soldiers) {
      if (!s.alive || s.role !== 'sniper' || s.delay > 0 || n >= this.max) continue;
      const L = s.laser;
      const on = L.on * (L.state === 'track' ? 1 : 0.75);
      if (on < 0.02) continue;
      s.gm.muzzle.getWorldPosition(_a);
      _d.subVectors(L.aim, _a); const toAim = _d.length(); _d.divideScalar(toAim || 1);
      // the beam runs past the aim point until it hits something (the dot lands on cars, glass, asphalt...)
      const hit = g.col.raycast(_a, _d, toAim + 60, (b) => b.data.noBullet || b.data.kind === 'glass' || b.data.ref === s);
      let len = hit ? hit.t : toAim + 60;
      if (_d.y < -1e-3) { const tg = (g.world.fastGround(L.aim.x, L.aim.z) - _a.y) / _d.y; if (tg > 0 && tg < len) len = tg; }
      // does it pass through the player? (VR: the beam stops on you)
      const tp = _b.subVectors(head, _a).dot(_d), cp = _b.copy(_a).addScaledVector(_d, tp);
      const onYou = tp > 0 && tp < len && cp.distanceTo(head) < 0.45 && s.los;
      if (onYou) len = tp - 0.6;
      L.end.copy(_a).addScaledVector(_d, len);
      const lockK = clamp(L.lock / L.lockTime, 0, 1);
      const flick = L.state === 'track' && lockK > 0.85 ? (Math.sin(g.time * 60) > 0 ? 1.3 : 0.6) : 1;
      _q.setFromUnitVectors(Z, _d);
      const bright = on * (0.55 + lockK * 0.9) * flick;
      _m.compose(_a, _q, _s.set(0.006, 0.006, len)); this.core.setMatrixAt(n, _m);
      this.core.instanceColor.setXYZ(n, 3.2 * bright, 0.12 * bright, 0.08 * bright);
      _m.compose(_a, _q, _s.set(0.028, 0.028, len)); this.haze.setMatrixAt(n, _m);
      this.haze.instanceColor.setXYZ(n, 0.32 * bright, 0.01 * bright, 0.01 * bright);
      n++;
      // dot where it lands
      if (!onYou) {
        const e = L.end;
        this.dots.set(d++, e.x, e.y + 0.02, e.z, 0.32, 0.32, 0, CELL.GLOW, 0, 3.4 * bright, 0.15 * bright, 0.1 * bright, 1);
        this.dots.set(d++, e.x, e.y + 0.02, e.z, 0.09, 0.09, 0, CELL.GLOW, 0, 4, 1.2, 1.0, 1);
      }
      // scope glint: a hard star when the lens points at you, strongest right before the shot
      s.scope.lens.getWorldPosition(_b);
      _a.subVectors(head, _b).normalize();
      s.scope.lens.getWorldDirection(_d).negate(); // lens looks along the barrel (-z)
      const facing = Math.pow(clamp(_a.dot(_d), 0, 1), 24);
      const gl = facing * (0.5 + lockK * 1.8) * (L.state === 'cycle' ? 0.2 : 1) * (0.85 + 0.15 * Math.sin(g.time * 23 + s.pos.x));
      L.glint = gl;
      if (gl > 0.02) {
        const dist = _b.distanceTo(head), sz = clamp(dist * 0.06, 0.6, 3.2) * (0.6 + gl * 0.6);
        this.dots.set(d++, _b.x, _b.y, _b.z, sz * 2.6, sz * 2.6, g.time * 0.3, CELL.STAR2, 0, 3.0 * gl, 2.9 * gl, 2.6 * gl, 1);
        this.dots.set(d++, _b.x, _b.y, _b.z, sz, sz, 0, CELL.GLOW, 0, 3 * gl, 2.8 * gl, 2.4 * gl, 1);
      }
      if (d > this.dots.max - 4) break;
    }
    for (const m of [this.core, this.haze]) { m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    this.dots.commit(d);
  }
}
