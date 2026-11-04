import * as THREE from 'three';

// Tiny rigid-body box vs treadmill ground. The ground moves at +groundV (z) in the truck frame.
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _r = new THREE.Vector3(), _w = new THREE.Vector3();
const _n = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3(), _imp = new THREE.Vector3(), _tmp = new THREE.Vector3();
const _m3 = new THREE.Matrix3(), _rot = new THREE.Matrix4();

export class RigidBox {
  constructor(hx, hy, hz, mass = 1) {
    this.h = new THREE.Vector3(hx, hy, hz);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.ang = new THREE.Vector3();
    this.mass = mass;
    this.invMass = 1 / mass;
    // box inertia (local, diagonal)
    const m = mass / 3;
    this.invI = new THREE.Vector3(1 / (m * (hy * hy + hz * hz)), 1 / (m * (hx * hx + hz * hz)), 1 / (m * (hx * hx + hy * hy)));
    this.restitution = 0.22;
    this.friction = 0.55;
    this.linDamp = 0.02;
    this.angDamp = 0.25;
    this.onGround = false;
    this.contactSpeed = 0;
    this.contactPoint = new THREE.Vector3();
    this.sleeping = false;
    this.floorY = 0; // ground plane height (on-foot levels set it from the collision world each step)
  }
  // apply world inverse inertia to vector (in place)
  _invIWorld(vec) {
    _q.copy(this.quat).invert();
    vec.applyQuaternion(_q);
    vec.set(vec.x * this.invI.x, vec.y * this.invI.y, vec.z * this.invI.z);
    vec.applyQuaternion(this.quat);
    return vec;
  }
  applyImpulse(imp, point) {
    this.vel.addScaledVector(imp, this.invMass);
    _r.subVectors(point, this.pos);
    _tmp.crossVectors(_r, imp);
    this.ang.add(this._invIWorld(_tmp));
  }
  step(dt, groundV) {
    this.vel.y -= 9.81 * dt;
    this.vel.multiplyScalar(Math.exp(-this.linDamp * dt));
    this.ang.multiplyScalar(Math.exp(-this.angDamp * dt));
    this.pos.addScaledVector(this.vel, dt);
    // integrate rotation
    const a = this.ang.length();
    if (a > 1e-6) {
      _q.setFromAxisAngle(_v.copy(this.ang).divideScalar(a), a * dt);
      this.quat.premultiply(_q).normalize();
    }
    // ground contacts at the 8 corners
    this.onGround = false;
    this.contactSpeed = 0;
    let deepest = 0;
    const h = this.h;
    for (let i = 0; i < 8; i++) {
      _v.set(i & 1 ? h.x : -h.x, i & 2 ? h.y : -h.y, i & 4 ? h.z : -h.z).applyQuaternion(this.quat).add(this.pos);
      if (_v.y >= this.floorY) continue;
      this.onGround = true;
      deepest = Math.min(deepest, _v.y - this.floorY);
      _r.subVectors(_v, this.pos);
      // point velocity
      _w.crossVectors(this.ang, _r).add(this.vel);
      // relative to moving ground
      _w.z -= groundV;
      const vn = _w.y;
      if (vn < 0) {
        // normal impulse
        _tmp.crossVectors(_r, _n); this._invIWorld(_tmp); _t.crossVectors(_tmp, _r);
        const k = this.invMass + _t.dot(_n);
        const jn = -(1 + this.restitution) * vn / k / 2.0;
        _imp.copy(_n).multiplyScalar(jn);
        this.applyImpulse(_imp, _v);
        // friction
        _w.crossVectors(this.ang, _r).add(this.vel); _w.z -= groundV;
        _t.set(_w.x, 0, _w.z);
        const vt = _t.length();
        if (vt > 1e-4) {
          _t.divideScalar(vt);
          _tmp.crossVectors(_r, _t); this._invIWorld(_tmp); _imp.crossVectors(_tmp, _r);
          const kt = this.invMass + _imp.dot(_t);
          let jt = vt / kt / 2.0;
          jt = Math.min(jt, this.friction * jn);
          _imp.copy(_t).multiplyScalar(-jt);
          this.applyImpulse(_imp, _v);
        }
        if (-vn > this.contactSpeed) { this.contactSpeed = Math.max(-vn, vt * 0.15); this.contactPoint.copy(_v); }
        if (vt > 6) this.contactPoint.copy(_v), this.scrape = vt; else this.scrape = 0;
      }
    }
    if (deepest < 0) this.pos.y -= deepest * 0.8;
  }
  writeTo(obj) {
    obj.position.copy(this.pos);
    obj.quaternion.copy(this.quat);
  }
}
