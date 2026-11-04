import * as THREE from 'three';
import { damp, clamp } from './rng.js';

// =====================================================================================
//  On-foot locomotion (shared by the on-foot levels): smooth stick / WASD movement relative to
//  the head, collisions against the CollisionWorld (head xz is the body), ground following
//  (ramps, steps, ship deck), no falling off ledges, 45° snap turn around the head.
//  Room-scale VR: if the player physically walks into a wall, the rig is pushed back.
// =====================================================================================
const _c = new THREE.Vector3(), _n = new THREE.Vector3(), _h = new THREE.Vector3(), _h2 = new THREE.Vector3();

export class Locomotion {
  constructor(rig, world, opts = {}) {
    this.rig = rig; this.world = world;
    this.radius = opts.radius ?? 0.3;
    this.walk = opts.walk ?? 3.1;
    this.sprint = opts.sprint ?? 5.0;
    this.accel = opts.accel ?? 9;
    this.vel = new THREE.Vector3();
    this.speed = 0;           // current horizontal speed (m/s)
    this.dist = 0;            // distance walked (footstep cadence)
    this.turnFX = 0;          // >0 right after a snap turn (comfort vignette blink)
    this.groundY = rig.position.y;
    this.onMetal = false;
    this.enabled = true;
  }
  // wish: world-space direction * magnitude (0..1, >1 = sprint), head: world head position
  update(dt, wish, head) {
    this.turnFX = Math.max(0, this.turnFX - dt * 4);
    if (!this.enabled || dt <= 0) { this.vel.set(0, 0, 0); this.speed = 0; return; }
    const mag = Math.min(1.6, Math.hypot(wish.x, wish.z));
    const top = mag > 1.05 ? this.sprint : this.walk;
    const k = mag > 1e-3 ? Math.min(1, mag) * top / mag : 0;
    const tx = wish.x * k, tz = wish.z * k;
    const a = 1 - Math.exp(-this.accel * dt);
    this.vel.x += (tx - this.vel.x) * a; this.vel.z += (tz - this.vel.z) * a;
    const y = this.rig.position.y;
    _c.set(head.x, y, head.z);
    _n.copy(_c).addScaledVector(this.vel, dt);
    this.world.pushCircle(_n, this.radius, y + 0.45, y + 1.85);
    let g = this.world.groundAt(_n.x, _n.z, y, 0.5);
    if (g < y - 1.2) { // ledge / water: don't walk off it
      _n.copy(_c); g = this.world.groundAt(_n.x, _n.z, y, 0.5);
      this.vel.multiplyScalar(0.2);
      if (g < y - 1.2) g = y; // already over the edge (head bob / room-scale lean): hold height
    }
    const dx = _n.x - _c.x, dz = _n.z - _c.z;
    this.rig.position.x += dx; this.rig.position.z += dz;
    const moved = Math.hypot(dx, dz);
    this.speed = dt > 0 ? moved / dt : 0;
    this.dist += moved;
    // ground follow: snap up steps quickly, ease down
    this.groundY = g;
    this.rig.position.y = g > y ? damp(y, g, 18, dt) : Math.max(g, y - Math.max(0.5, (y - g) * 12) * dt);
    this.onMetal = g > 1.5;
  }
  snapTurn(dir, angle, headWorld) {
    // rotate the rig about the head so the player turns in place
    _h.copy(headWorld);
    this.rig.rotation.y += dir * angle;
    this.rig.updateMatrixWorld(true);
    return _h;
  }
}
export function rotateRigAboutHead(rig, camera, angle) {
  camera.getWorldPosition(_h);
  rig.rotation.y += angle;
  rig.updateMatrixWorld(true);
  camera.getWorldPosition(_h2);
  rig.position.x += _h.x - _h2.x; rig.position.z += _h.z - _h2.z;
}
export { clamp };
