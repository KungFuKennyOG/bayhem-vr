import * as THREE from 'three';
import { ParticleSystem, BillboardBatch, CELL, FIRE0 } from './particles.js';
import { rand, range, sgn } from './rng.js';
import { ringTexture, scorchTexture } from './textures.js';

const _v = new THREE.Vector3(), _u = new THREE.Vector3();

export class FX {
  constructor(scene, atlas, fog, quality) {
    this.scene = scene;
    this.q = quality;
    const big = quality === 'high';
    this.main = new ParticleSystem(big ? 4200 : 1600, atlas, { boost: 1, renderOrder: 20, fog });
    this.sparks = new ParticleSystem(big ? 1400 : 800, atlas, { stretch: true, boost: 3.0, renderOrder: 21, fog });
    // near particles that live in the truck frame (muzzle flashes)
    this.near = new ParticleSystem(200, atlas, { boost: 2.6, renderOrder: 22, fog });
    this.carGlows = new BillboardBatch(260, atlas, { boost: 1, renderOrder: 19, fog });
    scene.add(this.main.mesh, this.sparks.mesh, this.near.mesh, this.carGlows.mesh);
    this.time = 0;
    this.queue = [];
    // pooled lights (fixed count => no shader recompiles)
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xff8a3a, 0, 45, 1.6);
      l.userData = { life: 0, max: 1, peak: 0, anchored: true };
      scene.add(l);
      this.lights.push(l);
    }
    // debris
    const dg = new THREE.BoxGeometry(1, 1, 1);
    this.debrisMesh = new THREE.InstancedMesh(dg, new THREE.MeshStandardMaterial({ color: 0x151313, roughness: 0.7, metalness: 0.4 }), 160);
    this.debrisMesh.castShadow = true; this.debrisMesh.frustumCulled = false;
    this.debrisMesh.count = 0;
    scene.add(this.debrisMesh);
    this.debris = [];
    // casings (truck frame)
    const cg = new THREE.CylinderGeometry(0.0045, 0.0045, 0.03, 6); cg.rotateZ(Math.PI / 2);
    this.casingMesh = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0xd9a845, metalness: 1, roughness: 0.25, envMapIntensity: 1.5 }), 60);
    this.casingMesh.frustumCulled = false; this.casingMesh.count = 0;
    scene.add(this.casingMesh);
    this.casings = []; this.casingCursor = 0;
    // ground rings + scorch decals (anchored)
    const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb070, toneMapped: false });
    const rg = new THREE.PlaneGeometry(1, 1); rg.rotateX(-Math.PI / 2);
    this.ringMesh = new THREE.InstancedMesh(rg, ringMat, 8);
    this.ringMesh.frustumCulled = false; this.ringMesh.count = 8;
    this.ringMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(8 * 3), 3);
    scene.add(this.ringMesh);
    this.rings = [];
    for (let i = 0; i < 8; i++) this.rings.push({ life: 0, max: 1, x: 0, y: 0, z: 0, size: 1 });
    const sc = new THREE.MeshBasicMaterial({ map: scorchTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0.85 });
    this.scorchMesh = new THREE.InstancedMesh(rg, sc, 20);
    this.scorchMesh.frustumCulled = false; this.scorchMesh.count = 20;
    scene.add(this.scorchMesh);
    this.scorch = []; for (let i = 0; i < 20; i++) this.scorch.push({ z: 1e4, x: 0, s: 0, r: 0 });
    this.scorchCursor = 0;
    this.emitters = [];
    this.groundV = 30;
    this.onSound = () => {};
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
  }

  later(delay, fn) { this.queue.push({ t: this.time + delay, fn }); }

  light(pos, intensity, life, color = 0xff8a3a, anchored = true, dist = 45) {
    // pick the weakest light
    let best = this.lights[0], bv = Infinity;
    for (const l of this.lights) { const v = l.userData.life > 0 ? l.userData.peak * (l.userData.life / l.userData.max) : 0; if (v < bv) { bv = v; best = l; } }
    best.position.copy(pos);
    best.color.set(color);
    best.distance = dist;
    best.userData = { life, max: life, peak: intensity, anchored };
    best.intensity = intensity;
  }

  // ---------------- composite effects ----------------
  explosion(pos, s = 1, { carVel = null, noRing = false } = {}) {
    const P = pos;
    this.onSound('explosion_big', P);
    this.light(_v.copy(P).setY(P.y + 1.5), 260 * s, 1.1, 0xff9040, true, 60 * s);
    // flash
    this.main.spawn({ x: P.x, y: P.y + 0.6, z: P.z, frame: CELL.FLASH, s0: 5 * s, s1: 11 * s, life: 0.2, r: 3.0, g: 2.1, b: 1.2, a: 1, fadeIn: 0.0, fadeOut: 0.2, ease: 0.4 });
    this.main.spawn({ x: P.x, y: P.y + 0.6, z: P.z, frame: CELL.STAR, s0: 8 * s, s1: 16 * s, life: 0.14, r: 2.8, g: 2.0, b: 1.1, a: 1, fadeIn: 0, fadeOut: 0.1, rot: rand() * 6 });
    // main fireballs, staggered
    const n = Math.round(7 * s + 2);
    for (let i = 0; i < n; i++) {
      const d = i < 3 ? 0 : range(0, 0.25);
      const fn = () => {
        const a = rand() * Math.PI * 2, el = range(0.1, 1.2), sp = range(3, 10) * s;
        this.main.spawn({
          x: P.x + range(-0.8, 0.8) * s, y: P.y + range(0.2, 1.4) * s, z: P.z + range(-0.8, 0.8) * s,
          vx: Math.cos(a) * Math.cos(el) * sp + (carVel ? carVel.x * 0.5 : 0), vy: Math.sin(el) * sp + range(1, 4), vz: Math.sin(a) * Math.cos(el) * sp + (carVel ? carVel.z * 0.5 : 0),
          drag: 2.6, grav: 2.2, frameKind: 1, s0: range(2.4, 3.6) * s, s1: range(6.5, 10) * s, ease: 0.55, life: range(1.1, 1.9), rot: rand() * 6.28, vrot: range(-0.8, 0.8),
          r: 2.3, g: 1.9, b: 1.6, a: 1, fadeIn: 0.02, fadeOut: 0.85,
        });
      };
      if (d === 0) fn(); else this.later(d, fn);
    }
    // rising mushroom core
    for (let i = 0; i < 3; i++) this.later(0.1 + i * 0.08, () => {
      this.main.spawn({ x: P.x, y: P.y + 2 * s, z: P.z, vy: range(6, 9) * s, vx: range(-1, 1), vz: range(-1, 1), drag: 1.1, frameKind: 1, s0: 4 * s, s1: 11 * s, ease: 0.6, life: range(1.6, 2.2), rot: rand() * 6, vrot: 0.3, r: 2.1, g: 1.8, b: 1.5, fadeOut: 0.8 });
    });
    // dark smoke column
    for (let i = 0; i < Math.round(8 * s + 2); i++) this.later(range(0.25, 0.9), () => {
      const sh = range(0.16, 0.32);
      this.main.spawn({ x: P.x + range(-1.5, 1.5) * s, y: P.y + range(1, 3) * s, z: P.z + range(-1.5, 1.5) * s, vx: range(-1.5, 1.5), vy: range(2.5, 5.5), vz: range(-1.5, 1.5), drag: 0.6, grav: 0.4,
        frameKind: 2, frame: rand() * 40, frames: 20, s0: 5 * s, s1: range(13, 19) * s, ease: 0.6, life: range(4, 7), rot: rand() * 6.28, vrot: range(-0.2, 0.2),
        r: sh * 1.35, g: sh * 1.0, b: sh * 0.72, r1: sh * 1.1, g1: sh * 0.9, b1: sh * 0.75, a: 0.88, fadeIn: 0.1, fadeOut: 0.5 });
    });
    // sparks
    for (let i = 0; i < Math.round(70 * s); i++) {
      const a = rand() * Math.PI * 2, el = range(-0.1, 1.3), sp = range(14, 38) * Math.sqrt(s);
      this.sparks.spawn({ x: P.x, y: P.y + 0.8, z: P.z, vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp, vz: Math.sin(a) * Math.cos(el) * sp, grav: -14, drag: 0.8,
        frame: CELL.SPARK, s0: 1, w: range(0.06, 0.12), life: range(0.5, 1.4), r: 1.6, g: range(0.7, 1.0), b: 0.35, a: 1, fadeOut: 0.6, ground: true });
    }
    // embers
    for (let i = 0; i < Math.round(30 * s); i++) this.main.spawn({ x: P.x + range(-2, 2) * s, y: P.y + range(0.5, 3) * s, z: P.z + range(-2, 2) * s, vx: range(-4, 4), vy: range(2, 9), vz: range(-4, 4), drag: 1.2, grav: -1.5,
      frame: CELL.SPARK, s0: range(0.12, 0.25), life: range(1.5, 3.2), r: 4.0, g: 1.8, b: 0.6, a: 1, fadeOut: 0.5 });
    // dust ring on ground
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.main.spawn({ x: P.x, y: 0.6, z: P.z, vx: Math.cos(a) * 14 * s, vz: Math.sin(a) * 14 * s, vy: 0.5, drag: 3, frame: CELL.DUST, s0: 2 * s, s1: 6 * s, life: 1.6, rot: rand() * 6, r: 0.9, g: 0.78, b: 0.62, a: 0.55, fadeIn: 0.05, fadeOut: 0.3 });
    }
    if (!noRing && P.y < 4) this.ring(P, 22 * s, 0.45);
    if (P.y < 3) this.scorchAt(P.x, P.z, 7 * s);
    // debris
    for (let i = 0; i < Math.round(9 * s + 3); i++) {
      const a = rand() * Math.PI * 2, sp = range(6, 18);
      this.spawnDebris(P, Math.cos(a) * sp * 0.6 + (carVel ? carVel.x : 0), range(6, 16), Math.sin(a) * sp * 0.6 + (carVel ? carVel.z : 0), range(0.12, 0.42) * Math.sqrt(s), rand() < 0.22);
    }
  }

  smallExplosion(pos, s = 0.5) {
    this.onSound('explosion_small', pos);
    this.light(pos, 60, 0.4, 0xffa050, true, 20);
    this.main.spawn({ x: pos.x, y: pos.y, z: pos.z, frame: CELL.FLASH, s0: 2.5, s1: 5, life: 0.12, r: 3, g: 2.2, b: 1.3, fadeIn: 0, fadeOut: 0.2 });
    for (let i = 0; i < 5; i++) this.main.spawn({ x: pos.x + range(-0.3, 0.3), y: pos.y + range(0, 0.4), z: pos.z + range(-0.3, 0.3), vx: range(-3, 3), vy: range(1, 4), vz: range(-3, 3), drag: 3, frameKind: 1, s0: 1.2 * s * 2, s1: 3.2 * s * 2, ease: 0.5, life: range(0.6, 1.0), rot: rand() * 6, r: 2.2, g: 1.9, b: 1.6, fadeOut: 0.8 });
    for (let i = 0; i < 4; i++) this.main.spawn({ x: pos.x, y: pos.y + 0.5, z: pos.z, vx: range(-1, 1), vy: range(1.5, 3), vz: range(-1, 1), drag: 0.8, frameKind: 2, frame: rand() * 40, frames: 16, s0: 1.5, s1: 5, life: range(2, 3.5), rot: rand() * 6, r: 0.36, g: 0.28, b: 0.22, a: 0.75, fadeOut: 0.5 });
    for (let i = 0; i < 25; i++) { const a = rand() * 6.28, el = range(0, 1.2), sp = range(8, 20); this.sparks.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp, vz: Math.sin(a) * Math.cos(el) * sp, grav: -14, drag: 1, frame: CELL.SPARK, s0: 1, w: 0.06, life: range(0.3, 0.8), r: 1.6, g: 0.9, b: 0.4, fadeOut: 0.5, ground: true }); }
  }

  ring(P, size, life) {
    let r = this.rings.find(x => x.life <= 0) || this.rings[0];
    r.life = life; r.max = life; r.x = P.x; r.y = Math.max(0.15, P.y * 0.2); r.z = P.z; r.size = size;
  }
  scorchAt(x, z, s) {
    const d = this.scorch[this.scorchCursor++ % this.scorch.length];
    d.x = x; d.z = z; d.s = s; d.r = rand() * 6.28;
  }

  spawnDebris(P, vx, vy, vz, size, burning) {
    let d = this.debris.find(x => !x.alive);
    if (!d) { if (this.debris.length >= 160) d = this.debris[(this.time * 1000 | 0) % 160]; else { d = {}; this.debris.push(d); } }
    d.alive = true; d.x = P.x; d.y = P.y + 1; d.z = P.z; d.vx = vx; d.vy = vy; d.vz = vz;
    d.sx = size * range(0.6, 1.6); d.sy = size * range(0.1, 0.4); d.sz = size * range(0.6, 1.4);
    d.rx = rand() * 6; d.ry = rand() * 6; d.rz = rand() * 6; d.wx = range(-12, 12); d.wy = range(-12, 12); d.wz = range(-12, 12);
    d.life = range(3, 5); d.burning = burning; d.emit = 0; d.ground = false;
  }

  muzzle(pos, dir, kind = 'rifle', near = true) {
    const sys = near ? this.near : this.main;
    const k = near ? 1 : 2.4;
    const big = kind === 'launcher';
    const s = big ? 0.5 : kind === 'enemy' ? 0.55 : 0.32;
    sys.spawn({ x: pos.x + dir.x * s * 0.3, y: pos.y + dir.y * s * 0.3, z: pos.z + dir.z * s * 0.3, frame: rand() < 0.5 ? CELL.STAR : CELL.STAR2, s0: s, s1: s * 1.3, life: 0.05, rot: rand() * 6.28, r: 1.6 * k, g: 1.2 * k, b: 0.7 * k, a: 1, fadeIn: 0, fadeOut: 0.3, anchored: !near });
    sys.spawn({ x: pos.x + dir.x * s * 0.8, y: pos.y + dir.y * s * 0.8, z: pos.z + dir.z * s * 0.8, frame: CELL.GLOW, s0: s * 1.2, s1: s * 1.6, life: 0.06, r: 1.4 * k, g: 0.8 * k, b: 0.35 * k, a: 1, fadeIn: 0, fadeOut: 0.2, anchored: !near });
    if (!near || big) for (let i = 0; i < 2; i++) this.main.spawn({ x: pos.x + dir.x * 0.2, y: pos.y + dir.y * 0.2, z: pos.z + dir.z * 0.2, vx: dir.x * 3 + range(-0.5, 0.5), vy: dir.y * 3 + 0.5, vz: dir.z * 3 + range(-0.5, 0.5), drag: 4, frame: CELL.WISP, s0: 0.2, s1: 0.9, life: 0.7, rot: rand() * 6, r: 0.8, g: 0.78, b: 0.75, a: 0.35, fadeIn: 0.05, fadeOut: 0.3, anchored: true });
  }

  tracer(from, to, { speed = 420, color = [1.6, 1.0, 0.45], width = 0.05, len = 5 } = {}) {
    _v.subVectors(to, from);
    const dist = _v.length();
    if (dist < 0.5) return;
    _v.divideScalar(dist);
    const life = dist / speed;
    this.sparks.spawn({ x: from.x + _v.x * len * 0.5, y: from.y + _v.y * len * 0.5, z: from.z + _v.z * len * 0.5, vx: _v.x * speed, vy: _v.y * speed, vz: _v.z * speed, frame: CELL.SPARK, s0: 1, len: Math.min(len, dist), w: width, life: Math.max(0.016, life), r: color[0], g: color[1], b: color[2], a: 1, fadeIn: 0, fadeOut: 0.9, anchored: false });
  }

  impact(pos, normal, kind) {
    if (kind === 'metal' || kind === 'glass') {
      const n = kind === 'metal' ? 8 : 4;
      for (let i = 0; i < n; i++) {
        _u.set(range(-1, 1), range(-1, 1), range(-1, 1)).normalize().multiplyScalar(0.7).add(normal).normalize();
        const sp = range(6, 16);
        this.sparks.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: _u.x * sp, vy: _u.y * sp, vz: _u.z * sp, grav: -12, drag: 1.5, frame: CELL.SPARK, s0: 1, w: 0.035, life: range(0.15, 0.45), r: 1.7, g: 1.1, b: 0.55, a: 1, fadeOut: 0.4 });
      }
      this.main.spawn({ x: pos.x + normal.x * 0.05, y: pos.y + normal.y * 0.05, z: pos.z + normal.z * 0.05, frame: CELL.STAR2, s0: 0.35, s1: 0.5, life: 0.06, rot: rand() * 6, r: 3.6, g: 2.6, b: 1.6, fadeIn: 0, fadeOut: 0.2 });
      if (kind === 'glass') for (let i = 0; i < 10; i++) this.sparks.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: normal.x * range(1, 4) + range(-2, 2), vy: range(0, 3), vz: normal.z * range(1, 4) + range(-2, 2), grav: -9.8, drag: 0.5, frame: CELL.SPARK, s0: 1, w: 0.03, len: 0.06, life: range(0.4, 0.8), r: 0.8, g: 0.9, b: 1.0, a: 0.8, fadeOut: 0.6, ground: true });
    } else if (kind === 'ground') {
      this.main.spawn({ x: pos.x, y: 0.15, z: pos.z, vy: range(0.8, 2), frame: CELL.DIRT, s0: 0.3, s1: 1.4, ease: 0.5, life: 0.8, rot: rand() * 6, r: 1, g: 1, b: 1, a: 0.8, fadeIn: 0.02, fadeOut: 0.3 });
      for (let i = 0; i < 3; i++) this.sparks.spawn({ x: pos.x, y: 0.05, z: pos.z, vx: range(-3, 3), vy: range(3, 7), vz: range(-3, 3), grav: -12, frame: CELL.SPARK, s0: 1, w: 0.03, life: 0.3, r: 1.5, g: 1.0, b: 0.5, fadeOut: 0.4 });
    } else if (kind === 'body') {
      // non-gory: fabric/dust puff
      this.main.spawn({ x: pos.x, y: pos.y, z: pos.z, vx: normal.x, vy: 0.5, vz: normal.z, drag: 3, frame: CELL.DUST, s0: 0.2, s1: 0.8, life: 0.5, rot: rand() * 6, r: 0.5, g: 0.45, b: 0.42, a: 0.7, fadeIn: 0.02, fadeOut: 0.3 });
    }
  }

  smoke(pos, size, shade = 0.22, life = 3, vy = 2.5, alpha = 0.7) {
    this.main.spawn({ x: pos.x + range(-0.2, 0.2), y: pos.y, z: pos.z + range(-0.2, 0.2), vx: range(-0.4, 0.4), vy: vy * range(0.7, 1.2), vz: range(-0.4, 0.4), drag: 0.5, frameKind: 2, frame: rand() * 40, frames: 16,
      s0: size * 0.5, s1: size * 2.2, ease: 0.6, life: life * range(0.8, 1.2), rot: rand() * 6.28, vrot: range(-0.3, 0.3), r: shade * 1.3, g: shade, b: shade * 0.75, a: alpha, fadeIn: 0.08, fadeOut: 0.45 });
  }
  flame(pos, size, vel = null) {
    // flames ride with their source (vel in truck frame); smoke is left behind by the wind
    this.main.spawn({ x: pos.x + range(-0.3, 0.3) * size, y: pos.y, z: pos.z + range(-0.3, 0.3) * size, vx: range(-0.5, 0.5) + (vel ? vel.x : 0), vy: range(2, 4) * size, vz: range(-0.5, 0.5) + (vel ? vel.z * 0.8 : 0), anchored: !vel, drag: vel ? 0 : 1.5, frameKind: 1,
      s0: size * 0.9, s1: size * 1.8, ease: 0.7, life: range(0.5, 0.8), rot: rand() * 6.28, vrot: range(-1, 1), r: 2.1, g: 1.8, b: 1.5, a: 1, fadeIn: 0.02, fadeOut: 0.6 });
  }

  // spawn along the path travelled since last call (world-anchored), so trails are continuous ribbons
  trailEmit(owner, pos, spacing, fn, dz) {
    if (!owner._tl) { owner._tl = pos.clone(); fn(pos); return; }
    owner._tl.z += dz;
    const d = owner._tl.distanceTo(pos);
    const n = Math.min(10, Math.floor(d / spacing));
    if (n <= 0) return;
    for (let k = 0; k < n; k++) { _u.lerpVectors(owner._tl, pos, (k + rand()) / n); fn(_u); }
    owner._tl.copy(pos);
  }

  casing(pos, vel) {
    const c = this.casings[this.casingCursor % 60] || (this.casings[this.casingCursor % 60] = {});
    this.casingCursor++;
    Object.assign(c, { alive: true, x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, rx: 0, ry: rand() * 6, rz: 0, w: range(10, 30), life: 2.5, bounced: 0 });
    this.casingMesh.count = Math.min(60, this.casingCursor);
  }

  update(dt, dz, ctx) {
    this.time += dt;
    for (let i = this.queue.length - 1; i >= 0; i--) if (this.queue[i].t <= this.time) { const q = this.queue[i]; this.queue.splice(i, 1); q.fn(); }
    this.main.update(dt, dz); this.sparks.update(dt, dz); this.near.update(dt, 0);
    for (const l of this.lights) {
      const u = l.userData;
      if (u.life > 0) {
        u.life -= dt;
        const t = Math.max(0, u.life / u.max);
        l.intensity = u.peak * t * t * (0.85 + 0.15 * Math.sin(this.time * 60));
        if (u.anchored) l.position.z += dz;
      } else l.intensity = 0;
    }
    // debris
    const m = this._m, q = this._q, s = this._s, p = this._p;
    let n = 0;
    for (const d of this.debris) {
      if (!d.alive) continue;
      d.life -= dt;
      if (d.life <= 0 || d.z > 160) { d.alive = false; continue; }
      d.vy -= 9.8 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt + dz;
      if (d.y < d.sy * 0.5) {
        d.y = d.sy * 0.5;
        if (d.vy < -2) { d.vy = -d.vy * 0.3; d.wx *= 0.5; d.wz *= 0.5; } else d.vy = 0;
        // ground friction pulls toward ground speed (+z relative = 0 world)
        d.vx *= 0.8; d.vz = d.vz * 0.8;
        d.ground = true;
      }
      if (!d.ground) { d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt; }
      if (d.burning) {
        this.trailEmit(d, _v.set(d.x, d.y, d.z), 0.5, (q) => { this.flame(q, 0.3); this.smoke(q, 0.45, 0.16, 1.5, 0.5, 0.55); }, dz);
      }
      p.set(d.x, d.y, d.z); q.setFromEuler(new THREE.Euler(d.rx, d.ry, d.rz)); s.set(d.sx, d.sy, d.sz);
      m.compose(p, q, s); this.debrisMesh.setMatrixAt(n++, m);
    }
    this.debrisMesh.count = n; this.debrisMesh.instanceMatrix.needsUpdate = true;
    // casings (truck frame, bounce on the bed floor)
    const floor = ctx ? ctx.bedFloor : 0.91;
    for (let i = 0; i < Math.min(60, this.casingCursor); i++) {
      const c = this.casings[i];
      if (!c || !c.alive) { s.set(0, 0, 0); m.compose(p.set(0, -10, 0), q.identity(), s); this.casingMesh.setMatrixAt(i, m); continue; }
      c.life -= dt;
      c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      const inBed = ctx && Math.abs(c.x - ctx.bedX) < ctx.bedHalfW && c.z > ctx.bedZ0 && c.z < ctx.bedZ1;
      const fy = inBed ? floor + 0.006 : 0.006;
      if (!inBed) c.z += dz; // fell off onto road
      if (c.y < fy) { c.y = fy; if (c.vy < -0.5) { c.vy *= -0.4; c.vx *= 0.6; c.vz *= 0.6; c.w *= 0.6; if (c.bounced++ < 2 && ctx && ctx.onCasing && inBed) ctx.onCasing(c); } else { c.vy = 0; c.vx *= 0.9; c.vz *= 0.9; c.w *= 0.9; } }
      c.rz += c.w * dt; c.ry += c.w * 0.3 * dt;
      if (c.life <= 0 || c.z > 150) c.alive = false;
      p.set(c.x, c.y, c.z); q.setFromEuler(new THREE.Euler(0, c.ry, c.rz)); s.set(1, 1, 1);
      m.compose(p, q, s); this.casingMesh.setMatrixAt(i, m);
    }
    this.casingMesh.instanceMatrix.needsUpdate = true;
    // rings
    const col = this.ringMesh.instanceColor;
    this.rings.forEach((r, i) => {
      if (r.life > 0) { r.life -= dt; r.z += dz; }
      const t = 1 - Math.max(0, r.life) / r.max;
      const sz = r.life > 0 ? r.size * (0.15 + 0.85 * Math.sqrt(t)) : 0;
      p.set(r.x, r.y, r.z); s.set(sz, 1, sz); m.compose(p, q.identity(), s);
      this.ringMesh.setMatrixAt(i, m);
      const a = r.life > 0 ? (1 - t) * 1.2 : 0;
      col.setXYZ(i, a, a, a);
    });
    this.ringMesh.instanceMatrix.needsUpdate = true; col.needsUpdate = true;
    // scorch
    this.scorch.forEach((d, i) => {
      d.z += dz;
      const vis = d.z < 160;
      p.set(d.x, 0.02, d.z); q.setFromEuler(new THREE.Euler(0, d.r, 0)); s.set(vis ? d.s : 0, 1, vis ? d.s : 0);
      m.compose(p, q, s); this.scorchMesh.setMatrixAt(i, m);
    });
    this.scorchMesh.instanceMatrix.needsUpdate = true;
    // emitters
    for (let i = this.emitters.length - 1; i >= 0; i--) { if (this.emitters[i](dt) === false) this.emitters.splice(i, 1); }
  }
}
