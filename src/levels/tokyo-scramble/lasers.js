import * as THREE from 'three';
import { BillboardBatch, CELL } from '../../particles.js';
import { DAY } from './tod.js';

// =====================================================================================
//  Laser sights on the regular gunmen (the snipers keep Level 3's big beams): a thin red beam from
//  the muzzle along the aim while a soldier can see you, a dot where it lands. In the neon clutter
//  the beam is how you find the man — the readability rule for this level. One instanced mesh +
//  one billboard batch; beams fade out right in front of the eye (VR-safe), never go sub-pixel.
// =====================================================================================
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);
export class RifleLasers {
  constructor(game, max = 18) {
    this.g = game; this.max = max;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vEyeD;\nvoid main() {')
        .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);\n vec4 axisW = modelMatrix * instanceMatrix * vec4(0.0, 0.0, position.z, 1.0);\n float axD = -(viewMatrix * axisW).z;\n transformed.xy *= max(1.0, axD * ${DAY.on ? '0.16' : '0.45'});`)
        .replace('#include <project_vertex>', '#include <project_vertex>\n vEyeD = -mvPosition.z;');
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vEyeD;\nvoid main() {').replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.rgb *= smoothstep(0.8, 4.5, vEyeD);');
    };
    m.customProgramCacheKey = () => 'rifleLaser';
    this.mesh = new THREE.InstancedMesh(geo, m, max);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 18;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    game.scene.add(this.mesh);
    this.dots = new BillboardBatch(max + 2, game.E.atlas, { boost: 1, renderOrder: 23, fog: game.scene.fog });
    game.scene.add(this.dots.mesh);
  }
  update(dt) {
    const g = this.g, head = g.headPos;
    let n = 0, d = 0;
    for (const s of g.soldiers) {
      if (n >= this.max) break;
      if (!s.alive || s.role === 'sniper' || s.role === 'seated' || s.delay > 0) { s._lz = 0; continue; }
      // on while he can see you and is aiming (fades in / out)
      const want = s.los ? 1 : 0;
      s._lz = (s._lz || 0) + (want - (s._lz || 0)) * Math.min(1, dt * 5);
      if (s._lz < 0.03) continue;
      if (s.pos.distanceToSquared(head) > 75 * 75) continue;
      s.gm.muzzle.getWorldPosition(_a);
      // the aim wanders a little (a man breathing behind a rifle): the beam sweeps instead of pointing dead at you
      const ph = s.pos.x * 1.7 + s.pos.z;
      _b.copy(s.aim.lengthSq() > 0 ? s.aim : head).add(_s.set(Math.sin(g.time * 1.3 + ph) * 0.7, Math.sin(g.time * 0.9 + ph * 2) * 0.35 - 0.2, Math.cos(g.time * 1.1 + ph) * 0.7));
      _d.subVectors(_b, _a);
      let len = _d.length(); _d.divideScalar(len || 1);
      len = Math.min(len + 25, 70);
      const hit = g.col.raycast(_a, _d, len, (b) => b.data.noBullet || b.data.kind === 'glass' || b.data.ref === s);
      if (hit) len = hit.t;
      if (_d.y < -1e-3) { const tg = (g.world.fastGround(_a.x + _d.x * len, _a.z + _d.z * len) - _a.y) / _d.y; if (tg > 0 && tg < len) len = tg; }
      // stops on you (the beam must not run through your face)
      const tp = _b.subVectors(head, _a).dot(_d);
      if (tp > 0 && tp < len && _b.copy(_a).addScaledVector(_d, tp).distanceTo(head) < 0.45) len = Math.max(0.5, tp - 0.7);
      _q.setFromUnitVectors(Z, _d);
      _m.compose(_a, _q, _s.set(0.0045, 0.0045, len)); this.mesh.setMatrixAt(n, _m);
      const k = s._lz * (0.75 + 0.25 * Math.sin(g.time * 13 + s.pos.x));
      const kd = DAY.on ? 0.7 : 1; this.mesh.instanceColor.setXYZ(n, 2.4 * k * kd, 0.08 * k * kd, 0.06 * k * kd);
      n++;
      _b.copy(_a).addScaledVector(_d, len);
      if (d < this.dots.max) this.dots.set(d++, _b.x, _b.y + 0.02, _b.z, 0.18, 0.18, 0, CELL.GLOW, 0, 3 * k, 0.2 * k, 0.12 * k, 1);
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    this.dots.commit(d);
  }
}
