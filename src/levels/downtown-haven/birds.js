import * as THREE from 'three';
import { rand, range } from '../../rng.js';

// =====================================================================================
//  Pigeons (one instanced draw): pecking on the sidewalks until the first shot, then the
//  whole flock bursts up through the canyon and wheels away over the roofs, backlit.
// =====================================================================================
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _p = new THREE.Vector3();

export class Birds {
  constructor(game, spots) {
    this.g = game;
    // body + two wings (a shallow V); flapping = mirroring the wings through the body plane
    const g = new THREE.BufferGeometry();
    const P = [
      0, 0, -0.17, 0.045, 0, 0.02, -0.045, 0, 0.02,       // body (top)
      0, 0, -0.17, -0.045, 0, 0.02, 0.045, 0, 0.02,       // body (bottom)
      0.03, 0, -0.06, 0.34, 0.15, 0.0, 0.03, 0, 0.06,     // right wing
      -0.03, 0, -0.06, -0.03, 0, 0.06, -0.34, 0.15, 0.0,  // left wing
      0, 0, 0.02, 0.07, 0, 0.16, -0.07, 0, 0.16,          // tail
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4d55, roughness: 0.8, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(g, mat, spots.length);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    game.scene.add(this.mesh);
    this.b = spots.map((s) => ({ p: s.clone(), v: new THREE.Vector3(), yaw: rand() * 6.28, ph: rand() * 6.28, state: 'ground', t: rand() * 5, delay: 0, peck: rand() }));
    this.spooked = false;
  }
  spook(from, delayMax = 0.8) {
    if (this.spooked) return; this.spooked = true;
    for (const b of this.b) {
      b.delay = range(0, delayMax) + b.p.distanceTo(from) * 0.01;
      const away = new THREE.Vector3(b.p.x - from.x, 0, b.p.z - from.z).normalize();
      b.v.set(away.x * range(2, 4) + range(-1, 1), range(4, 7), away.z * range(2, 4) + range(-2, 0.5));
      b.turn = range(-0.6, 0.6);
    }
    this.g.audio.play('birds_flap', { x: from.x, y: 2, z: from.z, volume: 0.9 });
  }
  update(dt) {
    let k = 0;
    for (const b of this.b) {
      b.t += dt;
      let flap = 1;
      if (b.state === 'ground') {
        if (this.spooked) { b.delay -= dt; if (b.delay <= 0) b.state = 'fly'; }
        // pecking / shuffling
        b.peck += dt * 3;
        if (Math.sin(b.peck) > 0.95) b.yaw += range(-0.5, 0.5) * dt * 10;
        flap = 0.05;
        _e.set(Math.sin(b.peck * 2.3) > 0.6 ? 0.5 : 0.05, b.yaw, 0);
      } else if (b.state === 'fly') {
        // climb out of the canyon, then level off and curve away
        b.v.y = Math.max(b.v.y - dt * (b.p.y > 24 ? 3 : 0.4), b.p.y > 30 ? 0.5 : 2.5);
        const sp = Math.hypot(b.v.x, b.v.z), target = b.p.y > 14 ? 11 : 5;
        const ang = Math.atan2(b.v.z, b.v.x) + b.turn * dt;
        const ns = sp + (target - sp) * Math.min(1, dt * 0.8);
        b.v.x = Math.cos(ang) * ns; b.v.z = Math.sin(ang) * ns;
        b.p.addScaledVector(b.v, dt);
        b.ph += dt * (b.p.y > 26 ? 9 : 17);
        flap = Math.sin(b.ph);
        b.yaw = Math.atan2(-b.v.x, -b.v.z);
        _e.set(-Math.atan2(b.v.y, Math.hypot(b.v.x, b.v.z)) * 0.6, b.yaw, b.turn * 0.6);
        if (b.p.y > 90 || b.t > 60) { b.state = 'gone'; }
      }
      if (b.state === 'gone') continue;
      _q.setFromEuler(_e);
      _m.compose(b.p, _q, _s.set(1, flap, 1));
      this.mesh.setMatrixAt(k++, _m);
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
// default perches: sidewalks and the median of block 1, a few on the intersection
export function birdSpots(groundFn) {
  const out = [];
  const flock = (cx, cz, n, r) => { for (let i = 0; i < n; i++) { const x = cx + range(-r, r), z = cz + range(-r, r); out.push(new THREE.Vector3(x, groundFn(x, z) + 0.02, z)); } };
  flock(12.8, 24, 9, 1.8); flock(-13.2, 16, 8, 1.6); flock(1.5, 4.5, 10, 2.4); flock(-12.5, -6, 7, 1.5); flock(13.5, -14, 8, 1.8); flock(0, -50, 10, 3);
  return out;
}
