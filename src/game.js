import * as THREE from 'three';
import { rand, range, pick, chance, clamp, lerp, damp } from './rng.js';
import { buildSUV, buildSedan, buildTanker, buildPickup, MAT, addBulletHole } from './vehicles.js';
import { Gunman } from './characters.js';
let gunmanSeed = 1;
import { buildHeli } from './heli.js';
import { RigidBox } from './physics.js';
import { LANES } from './world.js';
import { CELL } from './particles.js';

export const V = 31; // truck ground speed m/s (~112 km/h)
const ONCOMING_LANES = [-13.25, -16.95, -20.65, -24.35];

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();

// ray vs OBB (local half extents) ; returns t or -1, and writes local normal
function rayOBB(origin, dir, matWorld, half, outNormal, outLocal) {
  _inv.copy(matWorld).invert();
  _ro.copy(origin).applyMatrix4(_inv);
  _rd.copy(dir).transformDirection(_inv);
  let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 1;
  for (let a = 0; a < 3; a++) {
    const o = _ro.getComponent(a), d = _rd.getComponent(a), h = half.getComponent(a);
    if (Math.abs(d) < 1e-8) { if (o < -h || o > h) return -1; continue; }
    let t1 = (-h - o) / d, t2 = (h - o) / d, s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (tmax < 0) return -1;
  const t = tmin > 0 ? tmin : tmax;
  if (outNormal) { outNormal.set(0, 0, 0); if (axis >= 0) outNormal.setComponent(axis, sign); }
  if (outLocal) outLocal.copy(_ro).addScaledVector(_rd, t);
  return t;
}
function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}

class Car {
  constructor(game, type, opts = {}) {
    this.game = game; this.type = type;
    this.team = opts.team || 'enemy';
    this.model = type === 'suv' ? buildSUV() : type === 'tanker' ? buildTanker() : buildSedan(pick(MAT.civ));
    this.root = this.model.root;
    game.scene.add(this.root);
    this.pos = this.root.position;
    this.pos.set(opts.x ?? 0, 0, opts.z ?? 0);
    this.vel = new THREE.Vector3(0, 0, opts.vz ?? 0);
    this.yaw = 0; this.roll = 0; this.pitch = 0;
    this.groundSpeed = V - this.vel.z;
    this.hp = type === 'suv' ? 26 : type === 'tanker' ? 22 : 18;
    this.state = 'drive';
    this.gunmen = [];
    this.slot = null;
    this.tx = this.pos.x; this.tz = this.pos.z;
    this.aiT = range(2, 5);
    this.wheelSpin = 0;
    this.burn = 0;
    this.tire = -1; this.tireT = 0;
    this.ram = 0; this.ramCool = range(4, 9);
    this.cruise = opts.cruise ?? null; // civilians: fixed relative speed
    this.age = 0;
    this.headGlows = this.model.lights;
    this.mats = this.model.mesh.material;
    this.hitFlash = 0;
    this.dead = false;
    this.scoreValue = type === 'suv' ? 500 : type === 'tanker' ? 2000 : 0;
    if (type === 'suv' && this.team === 'enemy') {
      const slots = opts.gunners || ['L', 'R', 'roof'];
      for (const s of slots) this.addGunman(s);
    }
    this.hitboxHalf = this.model.half.clone();
    this.hitboxCenter = new THREE.Vector3(0, this.model.half.y, this.model.centerOffsetZ || 0);
    this.matWorld = new THREE.Matrix4();
    this.updateMatrix();
  }
  addGunman(slot) {
    const L = { L: [-0.98, 1.0, 0.95], R: [0.98, 1.0, 0.95], roof: [0, 1.45, 0.2], FL: [-0.98, 1.0, -0.2], FR: [0.98, 1.0, -0.2] }[slot];
    const g = new Gunman({ pose: slot === 'roof' ? 'roof' : 'window', side: slot === 'roof' ? 0 : (slot.endsWith('L') ? -1 : 1), seed: gunmanSeed++ * 7919 });
    g.root.position.set(L[0], L[1], L[2]);
    this.root.add(g.root);
    this.gunmen.push({ g, slot, alive: true, hp: 3, cool: range(1.5, 3.5), burst: 0 });
  }
  updateMatrix() {
    this.root.updateMatrixWorld();
    _m.makeTranslation(this.hitboxCenter.x, this.hitboxCenter.y, this.hitboxCenter.z);
    this.matWorld.multiplyMatrices(this.root.matrixWorld, _m);
    (this.invWorld ??= new THREE.Matrix4()).copy(this.matWorld).invert();
  }
  center(out) { return out.copy(this.hitboxCenter).applyMatrix4(this.root.matrixWorld); }
}

export class Game {
  constructor(ctx) {
    Object.assign(this, ctx); // scene, fx, world, hud, audio, rig, camera, params, mode
    this.cars = []; this.rockets = []; this.grenades = []; this.ragdolls = []; this.props = []; this.oncoming = [];
    this.heli = null;
    this.time = 0;
    this.timeScale = 1; this.slowT = 0; this.slowCool = 0;
    this.score = 0; this.kills = 0; this.carsDestroyed = 0; this.headshots = 0; this.rocketsShot = 0;
    this.combo = 0; this.comboT = 0;
    this.hp = 100; this.hurtT = 9; this.hurtFlash = 0; this.downed = false;
    this.truck = buildPickup();
    this.scene.add(this.truck.root);
    this.truckX = LANES[2]; this.truckTargetX = LANES[2]; this.truckVX = 0;
    this.truckSway = 0; this.truckBump = 0;
    this.bed = this.truck.bed;
    this.recentExplosions = [];
    this.dmgMul = this.params.has('trailer') ? 1.8 : 1;
    this.civSpawnT = 2; this.oncomingT = 1;
    this.enemyCap = 6;
    this.headPos = new THREE.Vector3();
    this.events = []; // for director/hud
    this.fx.onSound = (n, p) => this.audio.play(n, p ? { x: p.x, y: p.y, z: p.z } : {});
    this.truckRumble = 0;
    this.lastExplosionT = -10;
  }

  // ---------------- spawning ----------------
  spawnSUV(opts = {}) {
    const lane = opts.lane ?? pick([0, 1, 3]);
    const from = opts.from || 'behind';
    const z = opts.z ?? (from === 'behind' ? range(70, 95) : range(-170, -140));
    const c = new Car(this, 'suv', { x: LANES[lane], z, vz: from === 'behind' ? -14 : 10, gunners: opts.gunners });
    c.mode = 'approach';
    this.cars.push(c);
    return c;
  }
  spawnCivilian(lane, z, cruiseRel) {
    const c = new Car(this, 'sedan', { team: 'civ', x: LANES[lane], z, vz: cruiseRel, cruise: cruiseRel });
    this.cars.push(c);
    return c;
  }
  spawnTanker() {
    const c = new Car(this, 'tanker', { team: 'civ', x: LANES[3], z: this.params.has('trailer') ? -150 : -230, vz: 9, cruise: 6 });
    c.isTanker = true;
    c.hp = 18;
    this.cars.push(c);
    return c;
  }
  spawnHeli() {
    const h = buildHeli();
    h.root.scale.setScalar(1.2);
    this.scene.add(h.root);
    this.heli = { m: h, pos: h.root.position.set(-40, 30, 160), vel: new THREE.Vector3(), yaw: 0, hp: 110, maxHp: 110, phase: 'enter', t: 0, rocketT: 4, gunT: 3, burst: 0, wp: new THREE.Vector3(), wpT: 0, spin: 0, alive: true, smokeT: 0, bank: 0, pitch: 0, matWorld: new THREE.Matrix4(), hit: 0 };
    this.audio.musicStinger('boss');
    return this.heli;
  }

  enemiesAlive() { return this.cars.filter(c => c.team === 'enemy' && c.state === 'drive').length + (this.heli && this.heli.alive ? 1 : 0); }

  // ---------------- player weapon fire ----------------
  fireRay(origin, dir, gunKind) {
    // returns hit {t, point, kind, car, gunman, ...}
    let best = { t: 220, kind: 'none' };
    const n = new THREE.Vector3(), lp = new THREE.Vector3();
    for (const c of this.cars) {
      if (c.state === 'gone') continue;
      // gunmen first (spheres)
      for (const gm of c.gunmen) {
        if (!gm.alive) continue;
        gm.g.headCenter.getWorldPosition(_v);
        let t = raySphere(origin, dir, _v, 0.17);
        if (t > 0 && t < best.t) best = { t, kind: 'head', car: c, gm };
        gm.g.chestCenter.getWorldPosition(_v);
        t = raySphere(origin, dir, _v, 0.32);
        if (t > 0 && t < best.t) best = { t, kind: 'body', car: c, gm };
      }
      const t = rayOBB(origin, dir, c.matWorld, c.hitboxHalf, n, lp);
      if (t > 0 && t < best.t) {
        // which part
        let kind = 'car';
        const yLocal = lp.y + c.hitboxHalf.y;
        if (c.type !== 'tanker' && yLocal > (c.type === 'suv' ? 1.18 : 0.98) && n.y < 0.5) kind = 'glass';
        best = { t, kind, car: c, normal: n.clone(), local: lp.clone() };
        // tires
        if (c.state === 'drive' && c.type === 'suv') {
          c.model.wheels.forEach((w, i) => {
            w.getWorldPosition(_v);
            const tw = raySphere(origin, dir, _v, 0.48);
            if (tw > 0 && tw < t + 0.3) best = { t: tw, kind: 'tire', car: c, wheel: i };
          });
        }
      }
    }
    for (const r of this.rockets) {
      const t = raySphere(origin, dir, r.pos, 1.1);
      if (t > 0 && t < best.t) best = { t, kind: 'rocket', rocket: r };
    }
    const h = this.heli;
    if (h && h.phase !== 'gone') {
      const t = rayOBB(origin, dir, h.matWorld, h.m.half, n, lp);
      if (t > 0 && t < best.t) best = { t, kind: 'heli', normal: n.clone() };
    }
    if (best.kind === 'none' && dir.y < 0) {
      const t = -origin.y / dir.y;
      if (t < best.t) best = { t, kind: 'ground' };
    }
    best.point = origin.clone().addScaledVector(dir, best.t);
    return best;
  }

  playerShot(origin, dir, kind) {
    const hit = this.fireRay(origin, dir, kind);
    const P = hit.point;
    const dmg = this.dmgMul;
    // tracer every shot (Bay loves tracers)
    this.fx.tracer(origin, P, { speed: 520, width: 0.045, len: 6 });
    switch (hit.kind) {
      case 'head': case 'body': {
        const gm = hit.gm;
        gm.hp -= hit.kind === 'head' ? 99 : dmg;
        this.fx.impact(P, _v.copy(dir).negate(), 'body');
        this.audio.play('impact_flesh', { x: P.x, y: P.y, z: P.z, volume: 0.8 });
        this.hitMarker(hit.kind === 'head');
        if (gm.hp <= 0) this.killGunman(hit.car, gm, dir, hit.kind === 'head');
        else gm.g.hit(dir);
        break;
      }
      case 'glass': case 'car': {
        const c = hit.car;
        const wn = hit.normal.clone().transformDirection(c.matWorld);
        this.fx.impact(P, wn, hit.kind === 'glass' ? 'glass' : 'metal');
        this.audio.play(hit.kind === 'glass' ? 'impact_glass' : 'impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.7 });
        if (hit.kind === 'glass' && c.mats[1] !== MAT.glassCracked && c.state === 'drive') c.mats[1] = MAT.glassCracked;
        if (hit.kind === 'car') { const lp = hit.local.clone().add(c.hitboxCenter); addBulletHole(c.model, lp, hit.normal); }
        if (c.state === 'drive' && (c.team === 'enemy' || c.isTanker)) {
          c.hp -= dmg; c.hitFlash = 1;
          this.hitMarker(false);
          if (c.hp <= 0) this.destroyCar(c, 'shot');
          else if (c.hp < 10 && !c.smoking) c.smoking = true;
        }
        break;
      }
      case 'tire': {
        const c = hit.car;
        if (c.tire < 0 && c.state === 'drive') {
          c.tire = hit.wheel; c.tireT = 0;
          this.fx.smallExplosion(P, 0.35);
          this.audio.play('tire_screech', { x: P.x, y: P.y, z: P.z });
          this.callout('TIRE SHOT!', P, 'small');
        } else this.fx.impact(P, _v.set(0, 1, 0), 'metal');
        break;
      }
      case 'rocket': {
        this.explodeRocket(hit.rocket, true);
        this.rocketsShot++;
        this.addScore(250, 'ROCKET DOWN', hit.rocket.pos);
        break;
      }
      case 'heli': {
        const h = this.heli;
        this.fx.impact(P, hit.normal.clone().transformDirection(h.matWorld), 'metal');
        this.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.6, pitch: 0.8 });
        if (h.phase !== 'dying') { h.hp -= dmg; h.hit = 1; this.hitMarker(false); if (h.hp <= 0) this.killHeli(); }
        break;
      }
      case 'ground': {
        this.fx.impact(P, _v.set(0, 1, 0), 'ground');
        break;
      }
    }
    return hit;
  }

  launchGrenade(origin, dir) {
    const g = { pos: origin.clone(), vel: dir.clone().multiplyScalar(58), life: 4, trail: 0 };
    g.vel.y += 1.5;
    this.grenades.push(g);
  }

  hitMarker(big) { this.hud.hitMarker(big); this.audio.play('hit_marker', { volume: big ? 1 : 0.6 }); }

  addScore(n, label, pos, style) {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 3.5;
    const mult = Math.min(5, this.combo);
    this.score += n * mult;
    if (label) this.callout(label, pos, style || 'big', mult > 1 ? `+${n * mult}  x${mult}` : `+${n}`);
  }
  callout(text, pos, style = 'big', sub = null) { this.hud.callout(text, pos, style, sub); }

  killGunman(car, gm, dir, head, power) {
    gm.alive = false;
    this.kills++;
    if (head) this.headshots++;
    this.audio.play('kill_confirm', {});
    gm.g.chestCenter.getWorldPosition(_v);
    this.addScore(head ? 150 : 100, head ? 'HEADSHOT' : null, _v.clone().setY(_v.y + 1.2), 'small');
    // eject as an articulated ragdoll
    const rd = gm.g.die(car.vel, dir, this.scene, power ?? (head ? 1.2 : 1));
    this.ragdolls.push({ rd, thud: 0, src: car });
  }

  destroyCar(c, cause) {
    if (c.state !== 'drive') return;
    c.state = 'wreck';
    c.center(_v);
    const P = _v.clone();
    const s = c.isTanker ? 2.6 : c.type === 'suv' ? 1.25 : 1.0;
    if (!c.isHeliWreck) this.fx.explosion(P, s, { carVel: c.vel });
    this.recentExplosions.push(this.time);
    this.lastExplosionT = this.time;
    if (c.isTanker) {
      // secondary blasts along the tank
      for (let k = 1; k <= 3; k++) this.fx.later(0.18 * k, () => { _v.set(range(-1, 1), 2.5, range(-6, 8)).applyMatrix4(c.root.matrixWorld); this.fx.explosion(_v, 1.6, { noRing: true }); });
      this.fx.later(0.05, () => this.fx.ring(P, 80, 0.7));
    }
    // gunmen die
    for (const gm of c.gunmen) if (gm.alive) this.killGunman(c, gm, _v2.set(range(-0.5, 0.5), 1, range(-0.5, 0.5)).normalize(), false, 1.8);
    // materials -> charred
    if (c.model.decal) c.model.decal.visible = false;
    c.mats[0] = MAT.charred; c.mats[1] = MAT.charred; c.mats[2] = MAT.charred; c.mats[4] = MAT.plastic; c.mats[5] = MAT.plastic;
    if (c.isTanker) c.mats[7] = MAT.charred;
    else { c.mats[7] = MAT.charred; c.mats[8] = MAT.charred; }
    // rigid body
    const h = c.hitboxHalf;
    const rb = new RigidBox(h.x, h.y, h.z, c.isTanker ? 6 : 1.5);
    rb.pos.copy(P); rb.quat.copy(c.root.quaternion);
    rb.vel.copy(c.vel);
    const up = c.isTanker ? 5 : range(9, 13);
    rb.vel.y = up;
    rb.vel.z -= c.isTanker ? 0 : range(0, 4); // keep some forward momentum: Bay flips go forward
    const flipType = rand();
    if (c.isTanker) rb.ang.set(range(-0.5, 0.5), range(-0.6, 0.6), range(-0.8, 0.8));
    else if (flipType < 0.5) rb.ang.set(range(-1, 1), range(-1.5, 1.5), (rand() < 0.5 ? -1 : 1) * range(4, 7)); // barrel roll
    else rb.ang.set((rand() < 0.5 ? -1 : 1) * range(3, 5.5), range(-1.5, 1.5), range(-2, 2)); // end over end
    rb.angDamp = 0.12;
    c.rb = rb;
    c.burn = c.isTanker ? 14 : 9;
    // fling a wheel or two
    const nW = c.isHeliWreck ? 0 : c.isTanker ? 2 : (rand() < 0.7 ? 1 : 2);
    for (let k = 0; k < nW; k++) {
      const w = c.model.wheels[Math.floor(rand() * c.model.wheels.length)];
      if (!w || w.userData.flung) continue;
      w.userData.flung = true;
      this.scene.attach(w);
      const wb = new RigidBox(0.16, 0.42, 0.42, 0.3);
      w.getWorldPosition(wb.pos); wb.quat.copy(w.quaternion);
      wb.vel.copy(c.vel).add(_v2.set(range(-6, 6), range(8, 15), range(-6, 6)));
      wb.ang.set(range(-15, 15), range(-5, 5), range(-15, 15));
      wb.restitution = 0.45; wb.friction = 0.3;
      this.props.push({ obj: w, rb, life: 6 }); // placeholder replaced next line
      this.props[this.props.length - 1].rb = wb;
    }
    if (c.team === 'enemy' || c.isTanker) {
      this.carsDestroyed++;
      const label = c.isTanker ? 'TANKER!!!' : cause === 'tire' ? 'FLIPPED IT!' : cause === 'chain' ? 'CHAIN REACTION!' : cause === 'grenade' ? 'KABOOM!' : 'WRECKED!';
      this.addScore(c.isTanker ? 2000 : 500, label, P.clone().setY(P.y + 3), 'big');
    }
    // slow-mo rules
    const close = P.length() < 22;
    const multi = this.recentExplosions.filter(t => this.time - t < 1.6).length >= 2;
    if (c.isTanker) this.slowmo(2.2, 0.22, true);
    else if (multi) { this.slowmo(1.3, 0.3); this.callout('MULTI-KILL', P.clone().setY(P.y + 5), 'big'); }
    else if (close && chance(0.5)) this.slowmo(1.0, 0.33);
    // damage nearby
    this.blast(P, c.isTanker ? 26 : 9, c.isTanker ? 200 : 30, c);
    this.haptic(c.isTanker ? 1 : 0.6, 160);
    if (P.length() < 14) this.audio.play('ear_ring', { volume: 0.5 });
    this.events.push({ type: 'carDestroyed', car: c });
  }

  blast(P, radius, dmg, src) {
    for (const o of this.cars) {
      if (o === src || o.state !== 'drive') continue;
      o.center(_v2);
      const d = _v2.distanceTo(P);
      if (d < radius) {
        const k = 1 - d / radius;
        if (o.team === 'civ' && !o.isTanker) { if (k > 0.35) this.destroyCar(o, 'chain'); continue; }
        o.hp -= dmg * k;
        if (o.hp <= 0) this.fx.later(range(0.08, 0.25), () => this.destroyCar(o, 'chain'));
        else for (const gm of o.gunmen) if (gm.alive && k > 0.5) this.killGunman(o, gm, _v2.subVectors(_v2, P).normalize(), false);
      }
    }
    if (this.heli && this.heli.alive && this.heli.phase !== 'dying') {
      const d = this.heli.pos.distanceTo(P);
      if (d < radius + 4) { this.heli.hp -= dmg * 0.2 * (1 - d / (radius + 4)) + 6; this.heli.hit = 1; if (this.heli.hp <= 0) this.killHeli(); }
    }
    // the player
    const dp = this.headPos.distanceTo(P);
    if (dp < radius * 0.7) this.hurt(Math.min(35, 50 * (1 - dp / (radius * 0.7))), P);
  }

  hurt(amount, from) {
    if (this.params.has('trailer')) amount *= 0.25;
    this.hp -= amount; this.hurtT = 0; this.hurtFlash = Math.min(1, this.hurtFlash + amount / 25);
    this.audio.play('player_hurt', { volume: Math.min(1, amount / 20) });
    this.haptic(0.8, 80);
    if (this.hp <= 0 && !this.downed) {
      this.downed = true; this.hp = 1;
      this.slowmo(1.6, 0.25, true);
      this.hud.subtitle('DRIVER', "Stay with me! You don't get to die before the credits!", 3.5);
      this.fx.later(1.5, () => { this.hp = 100; this.downed = false; });
    }
  }

  slowmo(dur, scale, force = false) {
    if (!force && this.slowCool > 0) return;
    if (this.slowT <= 0) this.audio.play('slowmo_in', {});
    this.slowT = Math.max(this.slowT, dur);
    this.slowScale = scale;
    this.slowCool = dur + 5;
  }

  haptic(intensity, ms) { if (this.onHaptic) this.onHaptic(intensity, ms); }

  killHeli() {
    const h = this.heli;
    if (h.phase === 'dying') return;
    h.phase = 'dying'; h.t = 0;
    h.spin = 0.5;
    const tail = h.m.breakTail ? h.m.breakTail() : null;
    if (tail) {
      const rb = new RigidBox(0.5, 0.9, 2.0, 0.6);
      tail.object.getWorldPosition(rb.pos); tail.object.getWorldQuaternion(rb.quat);
      rb.vel.copy(tail.velocityHint).add(h.vel); rb.ang.copy(tail.spinHint);
      rb.restitution = 0.3; rb.friction = 0.5;
      // keep the object's local offset: drive it from the body center
      this.props.push({ obj: tail.object, rb, life: 12, burn: true });
      this.fx.smallExplosion(rb.pos.clone(), 0.6);
    }
    this.fx.explosion(h.pos.clone(), 1.4, { noRing: true });
    this.slowmo(2.6, 0.22, true);
    this.addScore(5000, 'BIRD DOWN!', h.pos.clone().setY(h.pos.y + 4), 'huge');
    this.audio.play('metal_crash', { x: h.pos.x, y: h.pos.y, z: h.pos.z });
    this.hud.subtitle('DRIVER', "It's going down — it's going down ON US!", 3);
    this.events.push({ type: 'heliDying' });
  }

  explodeRocket(r, inAir) {
    r.dead = true;
    if (inAir) { this.fx.explosion(r.pos.clone(), 0.75, { noRing: true }); }
  }

  // ---------------- update ----------------
  update(rdt, playerInput) {
    // time scale (real dt -> sim dt)
    if (this.slowT > 0) { this.slowT -= rdt; if (this.slowT <= 0) this.audio.play('slowmo_out', {}); }
    this.slowCool -= rdt;
    const targetTS = this.slowT > 0 ? this.slowScale : 1;
    this.timeScale = damp(this.timeScale, targetTS, this.slowT > 0 ? 14 : 4, rdt);
    this.audio.setTimeScale(this.timeScale);
    const dt = rdt * this.timeScale;
    this.time += dt;
    const dz = V * dt;
    this.dz = dz;
    this.comboT -= dt;
    this.recentExplosions = this.recentExplosions.filter(t => this.time - t < 2);
    // player health
    this.hurtT += dt;
    if (this.hurtT > 2.5 && this.hp < 100) this.hp = Math.min(100, this.hp + 18 * dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - rdt * 1.2);

    this.updateTruck(dt);
    this.updateTraffic(dt, dz);
    for (const c of this.cars) this.updateCar(c, dt, dz);
    this.separateCars();
    this.cars = this.cars.filter(c => {
      if (c.state === 'gone' || c.pos.z > 470 || c.pos.z < -700) { this.scene.remove(c.root); for (const gm of c.gunmen) if (gm.alive) gm.g.dispose(); return false; }
      return true;
    });
    this.updateHeli(dt, dz);
    this.updateGlows();
    this.updateProjectiles(dt, dz);
    this.updateBodies(dt, dz);
    this.world.update(dz, this.rig.position);
    return dt;
  }

  updateTruck(dt) {
    // choose lane: avoid obstacles ahead in current lane
    const laneOf = (x) => LANES.reduce((bi, lx, i) => Math.abs(lx - x) < Math.abs(LANES[bi] - x) ? i : bi, 0);
    const cur = laneOf(this.truckTargetX);
    const blocked = (li) => this.cars.some(c => Math.abs(c.pos.x - LANES[li]) < 2.4 && c.pos.z < 9 && c.pos.z > (c.state === 'wreck' ? -90 : -34) && (c.state === 'wreck' || c.team === 'civ' || c.vel.z > 2 || c.pos.z > -12));
    if (this.forceLane != null) this.truckTargetX = LANES[this.forceLane];
    else if (blocked(cur)) {
      const opts = [cur - 1, cur + 1].filter(l => l >= 0 && l <= 3 && !blocked(l));
      if (opts.length) { this.truckTargetX = LANES[opts.sort((a, b) => Math.abs(a - 1.5) - Math.abs(b - 1.5))[0]]; }
    }
    // smooth lateral motion (comfort: capped speed)
    const want = clamp((this.truckTargetX - this.truckX) * 1.6, -3.0, 3.0);
    this.truckVX = damp(this.truckVX, want, 3, dt);
    this.truckX += this.truckVX * dt;
    this.truckBump *= Math.exp(-dt * 5);
    const t = this.truck.root;
    t.position.set(this.truckX, 0.0, 0);
    t.rotation.set(Math.sin(this.time * 7.3) * 0.0025 + this.truckBump * 0.02, -this.truckVX * 0.012, -this.truckVX * 0.008 + Math.sin(this.time * 5.1) * 0.002 + this.truckBump * 0.03 * Math.sin(this.time * 40));
    t.position.y = Math.sin(this.time * 11) * 0.004;
    for (const w of this.truck.wheels) w.rotation.x -= V / 0.44 * dt;
    this.rig.position.set(this.truckX, this.bed.floorY, (this.bed.z0 + this.bed.z1) / 2);
  }

  updateTraffic(dt, dz) {
    // civilians in our direction (slower than us)
    this.civSpawnT -= dt;
    const civCount = this.cars.filter(c => c.team === 'civ').length;
    if (this.civSpawnT <= 0 && civCount < (this.civMax ?? 5)) {
      this.civSpawnT = range(2.5, 5);
      const lane = pick([0, 1, 2, 3]);
      const z = -range(380, 460);
      if (!this.cars.some(c => Math.abs(c.pos.x - LANES[lane]) < 2 && Math.abs(c.pos.z - z) < 20)) this.spawnCivilian(lane, z, range(6, 11));
    }
    // oncoming eye-candy
    this.oncomingT -= dt;
    if (this.oncomingT <= 0) {
      this.oncomingT = range(0.6, 2.2);
      const m = rand() < 0.15 ? buildTanker() : buildSedan(pick(MAT.civ));
      m.root.position.set(pick(ONCOMING_LANES), 0, -560);
      m.root.rotation.y = Math.PI;
      this.scene.add(m.root);
      this.oncoming.push({ m, v: V + range(22, 30) });
    }
    for (const o of this.oncoming) {
      o.m.root.position.z += o.v * dt;
      for (const w of o.m.wheels) w.rotation.x -= (o.v - V) / 0.4 * dt;
    }
    this.oncoming = this.oncoming.filter(o => { if (o.m.root.position.z > 470) { this.scene.remove(o.m.root); return false; } return true; });
  }

  slotFor(c) {
    const tl = LANES.reduce((bi, lx, i) => Math.abs(lx - this.truckX) < Math.abs(LANES[bi] - this.truckX) ? i : bi, 0);
    const opts = [];
    for (let li = 0; li < 4; li++) {
      if (li === tl) { opts.push([li, range(14, 22)], [li, -range(18, 26)]); continue; }
      const adj = Math.abs(li - tl) === 1;
      opts.push([li, adj ? range(-2, 7) : range(4, 14)]);
      opts.push([li, -range(10, 18)]);
    }
    // prefer unoccupied
    const taken = this.cars.filter(o => o !== c && o.team === 'enemy' && o.state === 'drive' && o.slot);
    const free = opts.filter(([li, z]) => !taken.some(o => o.slot[0] === li && Math.abs(o.slot[1] - z) < 9));
    const list = free.length ? free : opts;
    return list[Math.floor(rand() * list.length)];
  }

  updateCar(c, dt, dz) {
    c.age += dt;
    c.hitFlash = Math.max(0, c.hitFlash - dt * 8);
    if (c.state === 'drive') {
      if (c.team === 'enemy') this.driveEnemy(c, dt);
      else {
        // civilians: constant speed, stay in lane, panic swerve near wrecks
        c.vel.z = damp(c.vel.z, c.cruise, 1, dt);
        const wreckNear = this.cars.some(o => o.state === 'wreck' && Math.abs(o.pos.z - c.pos.z) < 18 && Math.abs(o.pos.x - c.pos.x) < 3);
        if (wreckNear && !c.panic) { c.panic = true; c.tx = c.pos.x + (c.pos.x > 0 ? -3.7 : 3.7); this.audio.play('tire_screech', { x: c.pos.x, y: 0.5, z: c.pos.z, volume: 0.6 }); }
        const want = clamp(((c.tx ?? c.pos.x) - c.pos.x) * 1.5, -4, 4);
        c.vel.x = damp(c.vel.x, want, 3, dt);
      }
      // separation from other cars
      for (const o of this.cars) {
        if (o === c || o.state !== 'drive') continue;
        const dx = c.pos.x - o.pos.x, dzz = c.pos.z - o.pos.z;
        const len = (c.hitboxHalf.z + o.hitboxHalf.z) + 1.5;
        if (Math.abs(dx) < 2.3 && Math.abs(dzz) < len) {
          if (c.team === 'enemy') { c.vel.x += Math.sign(dx || 1) * 6 * dt; c.vel.z += Math.sign(dzz || 1) * 4 * dt; }
        }
      }
      // keep away from the truck body
      const tdx = c.pos.x - this.truckX, tdz = c.pos.z - 0;
      if (Math.abs(tdz) < c.hitboxHalf.z + 3.2 && Math.abs(tdx) < 2.4) {
        if (c.ram > 0 && Math.abs(tdx) < 2.3) {
          // impact!
          c.ram = 0; c.ramCool = range(6, 10);
          this.truckBump = 1;
          _v.set((c.pos.x + this.truckX) / 2, 0.9, c.pos.z * 0.5);
          for (let i = 0; i < 18; i++) this.fx.sparks.spawn({ x: _v.x, y: _v.y, z: _v.z, vx: range(-3, 3), vy: range(1, 5), vz: range(4, 14), grav: -12, frame: CELL.SPARK, s0: 1, w: 0.05, life: range(0.3, 0.7), r: 1.7, g: 1.0, b: 0.5, fadeOut: 0.5 });
          this.audio.play('metal_crash', { x: _v.x, y: _v.y, z: _v.z });
          this.hurt(6, _v);
          this.haptic(1, 200);
        }
        c.vel.x += Math.sign(tdx || 1) * 18 * dt;
      }
      if (c.tire >= 0) {
        c.tireT += dt;
        c.vel.x += Math.sin(c.tireT * 9) * 22 * dt;
        c.yawWobble = Math.sin(c.tireT * 7) * 0.35 * Math.min(1, c.tireT * 2);
        if (c.tireT > 0.7) {
          // dig in and flip, explode on landing
          this.destroyCar(c, 'tire');
          if (c.rb) { c.rb.ang.set(range(-1, 1), range(-2, 2), (c.pos.x > this.truckX ? 1 : -1) * range(6, 9)); c.rb.vel.y = range(7, 10); }
        }
      }
      if (c.state === 'drive') {
        c.pos.x += c.vel.x * dt;
        c.pos.z += c.vel.z * dt;
        // hard constraint: never overlap the player's truck (truck spans z -3.1..2.8, half width 1.05)
        const odx = c.pos.x - this.truckX, overlapZ = Math.abs(c.pos.z - c.hitboxCenter.z + 0.15) < c.hitboxHalf.z + 3.0;
        const minX = c.hitboxHalf.x + 1.12;
        if (overlapZ && Math.abs(odx) < minX) { c.pos.x = this.truckX + Math.sign(odx || 1) * minX; if (Math.sign(c.vel.x) === -Math.sign(odx)) c.vel.x = 0; }
        c.pos.x = clamp(c.pos.x, -7.6, 8.0);
        c.groundSpeed = V - c.vel.z;
        c.yaw = damp(c.yaw, -Math.atan2(c.vel.x, Math.max(5, c.groundSpeed)) + (c.yawWobble || 0), 8, dt);
        c.roll = damp(c.roll, c.vel.x * 0.012, 4, dt);
        c.pitch = damp(c.pitch, -(c.lastVz !== undefined ? (c.vel.z - c.lastVz) / Math.max(dt, 1e-4) : 0) * 0.004, 3, dt);
        c.lastVz = c.vel.z;
        c.root.position.y = Math.sin(c.age * 9 + c.pos.x) * 0.01;
        c.root.rotation.set(c.pitch, c.yaw, c.roll, 'YXZ');
        c.wheelSpin += c.groundSpeed / 0.43 * dt;
        c.model.wheels.forEach((w, i) => { w.rotation.x = -c.wheelSpin; if (i < 2) w.rotation.y = (w.position.x < 0 ? Math.PI : 0) + c.vel.x * 0.04; });
        if (c.smoking) { c.smokeT = (c.smokeT || 0) - dt; if (c.smokeT <= 0) { c.smokeT = 0.08; _v.set(0, c.hitboxHalf.y * 1.6, -c.hitboxHalf.z * 0.75).applyMatrix4(c.root.matrixWorld); this.fx.smoke(_v, 0.7, 0.3, 1.8, 1.0, 0.5); } }
      }
      this.updateGunmen(c, dt);
    } else if (c.state === 'wreck') {
      const rb = c.rb;
      rb.step(dt, V);
      rb.quat.normalize();
      // position the model so that the OBB center matches the body
      c.root.quaternion.copy(rb.quat);
      _v.copy(c.hitboxCenter).applyQuaternion(rb.quat);
      c.root.position.copy(rb.pos).sub(_v);
      c.vel.copy(rb.vel);
      // landing effects
      if (rb.contactSpeed > 3) {
        this.fx.sparks.spawn({ x: rb.contactPoint.x, y: 0.1, z: rb.contactPoint.z, vx: range(-4, 4), vy: range(2, 6), vz: range(8, 18), grav: -12, frame: CELL.SPARK, s0: 1, w: 0.07, life: 0.6, r: 1.7, g: 1, b: 0.5, fadeOut: 0.5 });
        if (rb.contactSpeed > 5 && (c.lastCrash ?? -9) < this.time - 0.35) { c.lastCrash = this.time; this.audio.play('metal_crash', { x: c.pos.x, y: 0.5, z: c.pos.z, volume: Math.min(1, rb.contactSpeed / 10) }); this.fx.main.spawn({ x: rb.contactPoint.x, y: 0.5, z: rb.contactPoint.z, vy: 1, frame: CELL.DUST, s0: 2, s1: 6, life: 1.2, rot: rand() * 6, r: 0.85, g: 0.72, b: 0.58, a: 0.6, fadeOut: 0.3 }); }
      }
      if (rb.scrape > 6) for (let i = 0; i < 3; i++) this.fx.sparks.spawn({ x: rb.contactPoint.x, y: 0.05, z: rb.contactPoint.z, vx: range(-3, 3), vy: range(1, 4), vz: rb.scrape * range(0.3, 0.7), grav: -10, frame: CELL.SPARK, s0: 1, w: 0.06, life: range(0.2, 0.5), r: 1.8, g: 1.0, b: 0.45, fadeOut: 0.4 });
      // burning
      if (c.burn > 0) {
        c.burn -= dt;
        c.fireT = (c.fireT || 0) - dt;
        if (c.fireT <= 0) {
          c.fireT = c.isTanker ? 0.03 : c.isHeliWreck ? 0.045 : 0.05;
          c.center(_v);
          if (_v.distanceTo(this.headPos) < 9) { c.fireT = 0.15; } else {
          _v.y += 0.4;
          this.fx.flame(_v, c.isTanker ? 2.4 : 1.3, _v2.set(rb.vel.x, 0, rb.vel.z));
          if (rand() < 0.6) this.fx.smoke(_v.setY(_v.y + 1), c.isTanker ? 3 : 1.6, 0.12, 3.5, 2.5, 0.8);
          }
        }
      }
      // chain reaction: tumbling wreck hits a driving car
      for (const o of this.cars) {
        if (o.state !== 'drive' || o === c) continue;
        if (Math.abs(o.pos.x - c.pos.x) < 2.6 && Math.abs(o.pos.z - c.pos.z) < c.hitboxHalf.z + o.hitboxHalf.z && rb.pos.y < 4) {
          if (o.team === 'civ' && !o.isTanker) { this.destroyCar(o, 'chain'); }
          else { o.hp -= 60 * dt * 10; if (o.hp <= 0) this.destroyCar(o, 'chain'); }
        }
      }
      // solid collision with the player's truck (truck footprint: x ±1.05, z -3.1..2.8, height ~2.1)
      {
        const reach = Math.max(c.hitboxHalf.x, c.hitboxHalf.z) * 0.75;
        const dx = rb.pos.x - this.truckX, dzc = rb.pos.z + 0.15;
        const ox = 1.05 + reach - Math.abs(dx), oz = 2.95 + reach - Math.abs(dzc);
        if (ox > 0 && oz > 0 && rb.pos.y < 2.1 + c.hitboxHalf.y) {
          if (ox < oz) { rb.pos.x += Math.sign(dx || 1) * ox; if (Math.sign(rb.vel.x) !== Math.sign(dx || 1)) rb.vel.x = -rb.vel.x * 0.3 + Math.sign(dx || 1) * 3; }
          else { rb.pos.z += Math.sign(dzc || 1) * oz; rb.vel.z = Math.sign(dzc || 1) * Math.max(Math.abs(rb.vel.z) * 0.4, 6); }
          rb.ang.y += (rand() - 0.5) * 2;
          if ((c.lastTruckHit ?? -9) < this.time - 0.5) {
            c.lastTruckHit = this.time;
            this.truckBump = 1;
            if (!c.hitTruck) { c.hitTruck = true; this.hurt(10, c.pos); }
            this.audio.play('metal_crash', { x: rb.pos.x, y: 1, z: rb.pos.z });
            this.haptic(1, 160);
            for (let i = 0; i < 16; i++) this.fx.sparks.spawn({ x: this.truckX + Math.sign(dx || 1) * 1.05, y: range(0.6, 1.4), z: rb.pos.z * 0.5, vx: Math.sign(dx || 1) * range(2, 8), vy: range(1, 5), vz: range(4, 14), grav: -12, frame: CELL.SPARK, s0: 1, w: 0.05, life: range(0.3, 0.7), r: 1.7, g: 1.0, b: 0.5, fadeOut: 0.5 });
          }
        }
      }
    }
    c.updateMatrix();
  }

  driveEnemy(c, dt) {
    c.aiT -= dt;
    c.ramCool -= dt;
    if (c.mode === 'approach' || c.aiT <= 0 || !c.slot) {
      c.slot = this.slotFor(c);
      c.mode = 'hold';
      c.aiT = range(5, 9);
    }
    c.tx = LANES[c.slot[0]];
    c.tz = c.slot[1];
    const gunnersAlive = c.gunmen.some(g => g.alive);
    // ramming behaviour when adjacent
    if (c.ram <= 0 && c.ramCool <= 0 && Math.abs(c.pos.z) < 5 && Math.abs(Math.abs(c.pos.x - this.truckX) - 3.7) < 0.8 && (chance(0.4) || !gunnersAlive)) {
      c.ram = 2.2;
      this.audio.play('tire_screech', { x: c.pos.x, y: 0.5, z: c.pos.z, volume: 0.8 });
      if (chance(0.5)) this.hud.subtitle('DRIVER', pick(['He\'s gonna ram us!', 'Hold on to something!', 'Not the paint job!']), 2);
    }
    if (c.ram > 0) { c.ram -= dt; c.tx = this.truckX + Math.sign(c.pos.x - this.truckX || 1) * 2.25; c.tz = 0.5; }
    // speed control toward slot
    const wantVz = clamp((c.tz - c.pos.z) * 0.7, -15, 12);
    const acc = 7;
    c.vel.z += clamp(wantVz - c.vel.z, -acc * dt, acc * dt);
    // lateral
    const wantVx = clamp((c.tx - c.pos.x) * 1.4, c.ram > 0 ? -6 : -4, c.ram > 0 ? 6 : 4);
    c.vel.x = damp(c.vel.x, wantVx, 2.5, dt);
    // weave a little for life
    c.vel.x += Math.sin(c.age * 0.9 + c.pos.z) * 0.6 * dt;
  }

  updateGunmen(c, dt) {
    const head = this.headPos;
    for (const gm of c.gunmen) {
      if (!gm.alive) continue;
      gm.g.update(dt, head);
      gm.cool -= dt;
      const dist = c.pos.length();
      if (gm.cool <= 0 && dist < 70 && c.age > 1.5) {
        if (!gm.g.canFire) { gm.cool = 0.15; continue; }
        if (gm.burst <= 0) gm.burst = Math.floor(range(3, 7));
        gm.burst--;
        gm.cool = gm.burst > 0 ? 0.11 : range(1.2, 2.8) * (this.params.has('trailer') ? 1.3 : 1);
        gm.g.fire();
        this.enemyShot(c, gm, dist);
      }
    }
  }

  enemyShot(c, gm, dist) {
    const mz = gm.g.muzzle.getWorldPosition(new THREE.Vector3());
    _v.subVectors(this.headPos, mz).normalize();
    this.fx.muzzle(mz, _v, 'enemy', false);
    if (this.fx.lights.some(l => l.userData.life <= 0)) this.fx.light(mz, 8, 0.05, 0xffb060, true, 8);
    this.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, volume: 0.8 });
    const hitChance = clamp(0.1 - dist * 0.0012, 0.03, 0.1) * (this.params.has('trailer') ? 0.6 : 1);
    const target = this.headPos.clone();
    if (rand() < hitChance) {
      target.y -= 0.4;
      this.fx.tracer(mz, target, { speed: 360, color: [1.8, 0.5, 0.25], width: 0.05, len: 4 });
      this.hurt(5, mz);
    } else {
      // near miss: pass by the head and continue
      target.add(_v2.set(range(-1.6, 1.6), range(-0.8, 1.4), range(-1.6, 1.6)));
      _v3.subVectors(target, mz).normalize();
      const end = mz.clone().addScaledVector(_v3, dist + 30);
      if (end.y < 0) { const t = -mz.y / _v3.y; end.copy(mz).addScaledVector(_v3, t); this.fx.later(dist / 360, () => this.fx.impact(end, _v2.set(0, 1, 0), 'ground')); }
      this.fx.tracer(mz, end, { speed: 360, color: [1.8, 0.5, 0.25], width: 0.05, len: 4 });
      // whiz if passes close to head
      const closest = _v2.subVectors(this.headPos, mz).dot(_v3);
      const cp = mz.clone().addScaledVector(_v3, closest);
      if (cp.distanceTo(this.headPos) < 1.8 && rand() < 0.5) this.fx.later(closest / 360, () => this.audio.play('whiz', { x: cp.x, y: cp.y, z: cp.z }));
      // bullets ping the truck sometimes
      if (rand() < 0.15) { const p = new THREE.Vector3(this.truckX + range(-1, 1), range(1.0, 1.3), range(-2, 2.5)); this.fx.later(dist / 360, () => { this.fx.impact(p, _v2.set(0, 1, 0), 'metal'); this.audio.play('impact_metal', { x: p.x, y: p.y, z: p.z, volume: 0.6 }); }); }
    }
  }

  // driving cars never interpenetrate: push apart along the axis of least overlap
  separateCars() {
    const L = this.cars;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.state !== 'drive' || a.isHeliWreck) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (b.state !== 'drive' || b.isHeliWreck) continue;
        const dx = b.pos.x - a.pos.x, dzz = (b.pos.z + b.hitboxCenter.z) - (a.pos.z + a.hitboxCenter.z);
        const ox = a.hitboxHalf.x + b.hitboxHalf.x + 0.05 - Math.abs(dx);
        const oz = a.hitboxHalf.z + b.hitboxHalf.z + 0.1 - Math.abs(dzz);
        if (ox <= 0 || oz <= 0) continue;
        const wa = a.team === 'enemy' ? 0.6 : a.isTanker ? 0.1 : 0.5, wb = 1 - wa;
        if (ox < oz) {
          const sx = Math.sign(dx || 1);
          a.pos.x -= sx * ox * wa; b.pos.x += sx * ox * wb;
          const rv = b.vel.x - a.vel.x; if (rv * sx < 0) { a.vel.x += rv * 0.5; b.vel.x -= rv * 0.5; }
          if (Math.abs(rv) > 2 && (a.lastScrape ?? -9) < this.time - 0.4) { a.lastScrape = this.time; this.audio.play('metal_crash', { x: (a.pos.x + b.pos.x) / 2, y: 0.8, z: a.pos.z, volume: 0.5 }); }
        } else {
          const sz = Math.sign(dzz || 1);
          a.pos.z -= sz * oz * wa; b.pos.z += sz * oz * wb;
          const rv = b.vel.z - a.vel.z; if (rv * sz < 0) { a.vel.z += rv * 0.5; b.vel.z -= rv * 0.5; }
        }
      }
    }
  }

  // keep ragdoll bodies out of car bodies (doors, roofs, hoods)
  collideRagdoll(r) {
    const rd = r.rd, x = rd.x, v = rd.v, np = rd.np;
    if (!x || rd.age < 0.12) return;
    const p = rd.position;
    for (const c of this.cars) {
      if (c.state === 'gone' || c.isHeliWreck || !c.invWorld) continue;
      if (c === r.src && rd.age < 0.45) continue;
      if (Math.abs(c.pos.x - p.x) > 5 || Math.abs(c.pos.z - p.z) > c.hitboxHalf.z + 4) continue;
      const h = c.hitboxHalf, M = c.invWorld.elements, W = c.matWorld.elements;
      for (let i = 0; i < np; i++) {
        const wx = x[i * 3], wy = x[i * 3 + 1], wz = x[i * 3 + 2];
        const lx = M[0] * wx + M[4] * wy + M[8] * wz + M[12], ly = M[1] * wx + M[5] * wy + M[9] * wz + M[13], lz = M[2] * wx + M[6] * wy + M[10] * wz + M[14];
        const px = h.x + 0.06 - Math.abs(lx), py = h.y + 0.06 - ly, pz = h.z + 0.06 - Math.abs(lz);
        if (px <= 0 || pz <= 0 || py <= 0 || ly < -h.y) continue;
        let nx = 0, ny = 0, nz = 0, d;
        if (py < px && py < pz) { ny = 1; d = py; } else if (px < pz) { nx = Math.sign(lx || 1); d = px; } else { nz = Math.sign(lz || 1); d = pz; }
        // local push -> world
        const wnx = W[0] * nx + W[4] * ny + W[8] * nz, wny = W[1] * nx + W[5] * ny + W[9] * nz, wnz = W[2] * nx + W[6] * ny + W[10] * nz;
        x[i * 3] += wnx * d; x[i * 3 + 1] += wny * d; x[i * 3 + 2] += wnz * d;
        // velocity: take on the car's motion along the normal, keep some tangential slide
        const vn = (v[i * 3] - c.vel.x) * wnx + (v[i * 3 + 1] - c.vel.y) * wny + (v[i * 3 + 2] - c.vel.z) * wnz;
        if (vn < 0) { v[i * 3] -= vn * wnx * 1.2; v[i * 3 + 1] -= vn * wny * 1.2; v[i * 3 + 2] -= vn * wnz * 1.2; }
        if (rd.x0) { rd.x0[i * 3] = x[i * 3] - v[i * 3] * 1e-3; rd.x0[i * 3 + 1] = x[i * 3 + 1] - v[i * 3 + 1] * 1e-3; rd.x0[i * 3 + 2] = x[i * 3 + 2] - v[i * 3 + 2] * 1e-3; }
      }
    }
  }

  // ---------------- helicopter ----------------
  updateHeli(dt, dz) {
    const h = this.heli;
    if (!h || h.phase === 'gone') return;
    h.t += dt;
    h.hit = Math.max(0, h.hit - dt * 6);
    const m = h.m;
    const target = _v;
    let speedK = 1.2;
    if (h.phase === 'enter') {
      // swoop from behind, low over the truck, out in front
      const t = h.t;
      if (t < 4.5) { target.set(lerp(-30, 6, t / 4.5), lerp(28, 11, Math.min(1, t / 3.5)), lerp(150, -40, t / 4.5)); speedK = 3; }
      else { h.phase = 'fight'; h.wpT = 0; this.hud.subtitle('DRIVER', 'Helicopter! Why is it ALWAYS a helicopter?!', 3); }
      if (t > 2.6 && !h.flyby) { h.flyby = true; this.audio.play('heli_flyby', { x: h.pos.x, y: h.pos.y, z: h.pos.z }); }
    }
    if (h.phase === 'fight') {
      h.wpT -= dt;
      if (h.wpT <= 0) {
        h.wpT = range(3.5, 6);
        const side = rand() < 0.5 ? -1 : 1;
        const ahead = rand() < 0.55;
        h.wp.set(this.truckX + side * range(11, 20), range(8, 14), ahead ? -range(16, 34) : range(8, 24));
      }
      target.copy(h.wp);
      // weapons
      h.rocketT -= dt; h.gunT -= dt;
      const hpFrac = h.hp / h.maxHp;
      if (h.rocketT <= 0) {
        h.rocketT = range(3.2, 5.5) * (hpFrac < 0.5 ? 0.7 : 1);
        const pod = m.pods[Math.floor(rand() * 2)];
        const p = pod.getWorldPosition(new THREE.Vector3());
        const miss = rand() < 0.65;
        const aim = miss ? new THREE.Vector3(this.truckX + range(4, 9) * (rand() < 0.5 ? -1 : 1), 0, range(-12, 6)) : this.headPos.clone();
        const dir = aim.clone().sub(p).normalize();
        this.rockets.push({ pos: p, vel: dir.multiplyScalar(36), target: aim, miss, life: 5, trail: 0 });
        this.audio.play('rocket_launch', { x: p.x, y: p.y, z: p.z });
        this.fx.muzzle(p, dir, 'launcher', false);
      }
      if (h.gunT <= 0) {
        if (h.burst <= 0) h.burst = 14;
        h.burst--;
        h.gunT = h.burst > 0 ? 0.07 : range(2, 3.5);
        const mz = m.gun.getWorldPosition(new THREE.Vector3());
        _v2.subVectors(this.headPos, mz).normalize();
        this.fx.muzzle(mz, _v2, 'enemy', false);
        this.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, pitch: 0.7, volume: 1 });
        // walk rounds across the road toward the truck
        const prog = 1 - h.burst / 14;
        const end = new THREE.Vector3(this.truckX + lerp(-6, 1, prog) + range(-1, 1), 0, lerp(-14, 2, prog) + range(-1, 1));
        this.fx.tracer(mz, end, { speed: 300, color: [1.9, 0.6, 0.25], width: 0.08, len: 5 });
        this.fx.later(mz.distanceTo(end) / 300, () => { this.fx.impact(end, _v2.set(0, 1, 0), 'ground'); if (Math.abs(end.x - this.truckX) < 1.3 && Math.abs(end.z) < 2.5) this.hurt(4, end); });
      }
      if (hpFrac < 0.5) this.fx.trailEmit(h, m.smokePt.getWorldPosition(new THREE.Vector3()), 0.5, (q) => this.fx.smoke(q, 1.6, 0.15, 2.2, 0.5, 0.6), dz);
      if (m.aimGun) m.aimGun(this.headPos, dt, h.burst > 0);
      if (m.setDamage && m.setDamage(1 - hpFrac)) { this.fx.explosion(m.sparkPt.getWorldPosition(new THREE.Vector3()), 0.45, { noRing: true }); this.audio.play('explosion_small', { x: h.pos.x, y: h.pos.y, z: h.pos.z }); }
      if (hpFrac < 0.5 && m.sparkPt) { h.sparkT = (h.sparkT || 0) - dt; if (h.sparkT <= 0) { h.sparkT = range(0.05, 0.2); m.sparkPt.getWorldPosition(_v3); for (let i = 0; i < 3; i++) this.fx.sparks.spawn({ x: _v3.x, y: _v3.y, z: _v3.z, vx: range(-3, 3), vy: range(-1, 3), vz: range(2, 8), grav: -10, frame: CELL.SPARK, s0: 1, w: 0.05, life: range(0.3, 0.6), r: 1.8, g: 1.0, b: 0.45, fadeOut: 0.5 }); if (hpFrac < 0.3) this.fx.flame(_v3, 0.7); } }
    }
    if (h.phase === 'dying') {
      h.spin = Math.min(7, h.spin + dt * 3);
      h.yaw += h.spin * dt;
      // fall forward ahead of the truck, crash onto the road
      if (!h.crashP) {
        const side = h.pos.x > this.truckX ? 1 : -1;
        h.crashP = new THREE.Vector3(this.truckX + side * 3.5, 0, -52);
        h.d0 = Math.hypot(h.crashP.x - h.pos.x, h.crashP.z - h.pos.z); h.y0 = h.pos.y;
        h.fallSpeed = Math.max(22, h.d0 / 2.4);
      }
      // spiral down along a path that ends on the road ahead of the truck
      _v2.set(h.crashP.x - h.pos.x, 0, h.crashP.z - h.pos.z);
      const dRem = _v2.length();
      const step = Math.min(dRem, h.fallSpeed * dt);
      if (dRem > 1e-3) _v2.multiplyScalar(step / dRem);
      const prevY = h.pos.y;
      h.pos.x += _v2.x; h.pos.z += _v2.z;
      h.pos.y = 1.0 + (h.y0 - 1.0) * Math.pow(Math.max(0, dRem - step) / Math.max(1, h.d0), 1.3);
      h.vel.set(_v2.x / Math.max(dt, 1e-4), (h.pos.y - prevY) / Math.max(dt, 1e-4), _v2.z / Math.max(dt, 1e-4));
      h.pos.addScaledVector(h.vel, -dt); // the generic integrator below re-applies vel*dt
      target.copy(h.pos);
      h.smokeT -= dt;
      this.fx.trailEmit(h, m.smokePt.getWorldPosition(new THREE.Vector3()), 0.45, (q) => { if (rand() < 0.45) this.fx.flame(q, 1.0); this.fx.smoke(q, 2.0, 0.12, 2.4, 0.8, 0.75); }, dz);
      if (h.pos.y < 1.6) {
        // crash
        h.phase = 'gone'; h.alive = false;
        const P = h.pos.clone().setY(1);
        this.fx.explosion(P, 3.0);
        for (let k = 1; k <= 3; k++) this.fx.later(0.18 * k, () => this.fx.explosion(P.clone().add(_v2.set(range(-5, 5), range(0, 3), range(-6, 6))), 1.3, { noRing: true }));
        this.blast(P, 18, 100, null);
        this.slowmo(2.4, 0.25, true);
        this.haptic(1, 400);
        this.audio.play('ear_ring', { volume: 0.7 });
        this.audio.play('metal_crash', { x: P.x, y: P.y, z: P.z });
        // leave a burning wreck that slides back toward us: we swerve around
        const wreck = new Car(this, 'suv', { team: 'civ', x: P.x, z: P.z, vz: 0 });
        wreck.isHeliWreck = true;
        wreck.model.mesh.visible = false; wreck.model.wheels.forEach(w => { w.visible = false; w.userData.flung = true; });
        this.scene.remove(m.root);
        wreck.root.add(m.root); m.root.position.set(0, 0.6, 0); m.root.rotation.set(0.2, h.yaw, 0.5);
        m.body.material = [MAT.charred, MAT.charred, MAT.charred];
        (m.burnables || []).forEach(b => { b.material = MAT.charred; });
        m.rotor.rotation.z = 0.4;
        wreck.state = 'drive'; wreck.hp = 1;
        this.cars.push(wreck);
        this.destroyCar(wreck, 'heli');
        wreck.rb.vel.set(0, 3, V * 0.35); wreck.rb.ang.set(0.5, 2.0, 0.3); wreck.burn = 30;
        this.forceLane = LANES.reduce((bi, lx, i) => Math.abs(lx - P.x) > Math.abs(LANES[bi] - P.x) ? i : bi, 0);
        this.events.push({ type: 'heliCrashed' });
        return;
      }
    }
    // fly toward target with smooth accel
    if (h.phase !== 'dying') {
      _v2.subVectors(target, h.pos);
      const desired = _v2.multiplyScalar(speedK);
      if (desired.length() > 40) desired.setLength(40);
      h.vel.lerp(desired, 1 - Math.exp(-dt * 1.6));
    }
    h.pos.addScaledVector(h.vel, dt);
    // face the truck while fighting
    if (h.phase !== 'dying') {
      const faceYaw = h.phase === 'enter' ? Math.atan2(-h.vel.x, -h.vel.z + 0.001) : Math.atan2(-(this.truckX - h.pos.x), -(0 - h.pos.z));
      let dy = faceYaw - h.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      h.yaw += dy * (1 - Math.exp(-dt * 2));
    }
    // bank/pitch from velocity in local frame
    const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
    const fwd = -(h.vel.x * -sy + h.vel.z * -cy) * -1; // forward speed
    const side = h.vel.x * cy - h.vel.z * sy;
    h.pitch = damp(h.pitch, -clamp(fwd * 0.012, -0.35, 0.35), 3, dt);
    h.bank = damp(h.bank, -clamp(side * 0.02, -0.5, 0.5), 3, dt);
    m.root.position.copy(h.pos);
    m.root.rotation.set(0, h.yaw, 0);
    m.tilt.rotation.set(h.pitch, 0, h.bank + (h.phase === 'dying' ? Math.sin(h.t * 3) * 0.3 : 0));
    m.rotor.rotation.y += dt * 38;
    m.tailRotor.rotation.x += dt * 60;
    m.root.updateMatrixWorld();
    _m.makeTranslation(m.center.x, m.center.y, m.center.z);
    h.matWorld.multiplyMatrices(m.tilt.matrixWorld, _m);
    this.audio.setLoop('heli', { x: h.pos.x, y: h.pos.y, z: h.pos.z, volume: 1 });
    // rotor downwash dust when low
    if (h.pos.y < 14) { h.dustT = (h.dustT || 0) - dt; if (h.dustT <= 0) { h.dustT = 0.08; this.fx.main.spawn({ x: h.pos.x + range(-6, 6), y: 0.4, z: h.pos.z + range(-6, 6), vx: range(-5, 5), vz: range(-5, 5), drag: 1, frame: CELL.DUST, s0: 2, s1: 6, life: 1.5, rot: rand() * 6, r: 0.9, g: 0.78, b: 0.62, a: 0.35 * (1 - h.pos.y / 14), fadeOut: 0.3 }); } }
  }

  updateGlows() {
    const B = this.fx.carGlows;
    let i = 0;
    const head = this.headPos;
    const add = (c, list) => {
      for (const L of list) {
        if (i >= B.max - 2) return;
        _v.copy(L.p).applyMatrix4(c.root.matrixWorld);
        // brighter when the light faces the viewer
        _v2.set(0, 0, L.kind === 'head' ? -1 : 1).transformDirection(c.root.matrixWorld);
        _v3.subVectors(head, _v).normalize();
        const facing = Math.max(0, _v2.dot(_v3));
        if (L.kind === 'head') B.set(i++, _v.x, _v.y, _v.z, 0.35 + facing * 0.7, 0.3 + facing * 0.5, 0, CELL.GLOW, 0, 1.3, 1.15, 0.9, 0.15 + facing * 0.45);
        else B.set(i++, _v.x, _v.y, _v.z, 0.5 + facing * 0.9, 0.5 + facing * 0.7, 0, CELL.GLOW, 0, 2.0, 0.15, 0.05, 0.3 + facing * 0.7);
      }
    };
    for (const c of this.cars) if (c.state === 'drive' && !c.isHeliWreck) add(c, c.headGlows);
    for (const o of this.oncoming) add(o.m.root ? { root: o.m.root } : o, o.m.lights);
    const h = this.heli;
    if (h && h.phase !== 'gone') {
      const m = h.m;
      const blink = Math.sin(this.time * 6) > 0.3;
      for (const [pt, col] of m.navLights) {
        pt.getWorldPosition(_v);
        if (col[3] && !blink) continue;
        B.set(i++, _v.x, _v.y, _v.z, 1.2, 1.2, 0, CELL.GLOW, 0, col[0], col[1], col[2], 1);
      }
      m.lightPt.getWorldPosition(_v);
      B.set(i++, _v.x, _v.y, _v.z, 3.5, 3.5, 0, CELL.GLOW, 0, 2.2, 2.0, 1.7, 0.9);
    }
    B.commit(i);
  }

  updateProjectiles(dt, dz) {
    // grenades
    for (const g of this.grenades) {
      g.life -= dt;
      g.vel.y -= 9.8 * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (!g.last) g.last = g.pos.clone();
      g.last.z += dz;
      const gs = g.pos.distanceTo(g.last), gn = Math.min(10, Math.floor(gs / 0.4));
      for (let k = 0; k < gn; k++) { _v.lerpVectors(g.last, g.pos, (k + rand()) / gn); this.fx.main.spawn({ x: _v.x, y: _v.y, z: _v.z, vy: 0.3, drag: 2, frame: CELL.WISP, s0: 0.12, s1: 0.6, life: 0.7, rot: rand() * 6, r: 0.8, g: 0.8, b: 0.8, a: 0.35, fadeOut: 0.3 }); }
      if (gn > 0) g.last.copy(g.pos);
      this.fx.main.spawn({ x: g.pos.x, y: g.pos.y, z: g.pos.z, frame: CELL.GLOW, s0: 0.35, life: 0.04, r: 3.6, g: 1.4, b: 0.5, a: 1, anchored: false });
      let boom = g.pos.y <= 0.15 || g.life <= 0;
      for (const c of this.cars) { if (c.state === 'gone') continue; _v.copy(g.pos).applyMatrix4(_inv.copy(c.matWorld).invert()); if (Math.abs(_v.x) < c.hitboxHalf.x + 0.3 && Math.abs(_v.y) < c.hitboxHalf.y + 0.3 && Math.abs(_v.z) < c.hitboxHalf.z + 0.3) boom = true; }
      if (this.heli && this.heli.alive && this.heli.pos.distanceTo(g.pos) < 5) boom = true;
      if (boom) {
        g.dead = true;
        const P = g.pos.clone(); P.y = Math.max(P.y, 0.3);
        this.fx.explosion(P, 0.9);
        this.recentExplosions.push(this.time);
        // grenade blast
        for (const c of this.cars) {
          if (c.state !== 'drive') continue;
          const d = c.center(_v2).distanceTo(P);
          if (d < 8) {
            if (c.team === 'civ' && !c.isTanker) { if (d < 4) this.destroyCar(c, 'chain'); continue; }
            c.hp -= 80 * (1 - d / 8) * this.dmgMul + 10;
            if (c.hp <= 0) this.destroyCar(c, 'grenade');
            else for (const gm of c.gunmen) if (gm.alive && d < 5) this.killGunman(c, gm, _v2.subVectors(_v2, P).normalize(), false);
          }
        }
        if (this.heli && this.heli.alive && this.heli.phase !== 'dying' && this.heli.pos.distanceTo(P) < 7) { this.heli.hp -= 16 * this.dmgMul; this.heli.hit = 1; this.hitMarker(true); if (this.heli.hp <= 0) this.killHeli(); }
      }
    }
    this.grenades = this.grenades.filter(g => !g.dead);
    // rockets
    for (const r of this.rockets) {
      r.life -= dt;
      if (!r.miss) { _v.subVectors(this.headPos, r.pos).normalize().multiplyScalar(36); r.vel.lerp(_v, 1 - Math.exp(-dt * 0.8)); }
      else r.target.z += dz;
      r.pos.addScaledVector(r.vel, dt);
      // trail spawned by distance (in world space) with jitter -> continuous ribbon, not a string of pearls
      if (!r.last) r.last = r.pos.clone();
      r.last.z += dz;
      const seg = r.pos.distanceTo(r.last);
      const nT = Math.min(12, Math.floor(seg / 0.32));
      for (let k = 0; k < nT; k++) {
        const t = (k + rand()) / Math.max(1, nT);
        _v.lerpVectors(r.last, r.pos, t);
        const sz = range(0.35, 0.6);
        this.fx.main.spawn({ x: _v.x + range(-0.08, 0.08), y: _v.y + range(-0.08, 0.08), z: _v.z, vx: range(-0.6, 0.6), vy: range(0, 0.7), vz: range(-0.6, 0.6), drag: 1.5, frame: CELL.WISP, s0: sz, s1: sz * range(3.5, 5.5), ease: 0.6, life: range(1.6, 2.6), rot: rand() * 6, vrot: range(-0.5, 0.5), r: 0.78, g: 0.74, b: 0.7, a: 0.5, fadeIn: 0.02, fadeOut: 0.35 });
      }
      if (nT > 0) r.last.copy(r.pos);
      this.fx.main.spawn({ x: r.pos.x, y: r.pos.y, z: r.pos.z, frame: CELL.FLASH, s0: 1.0, s1: 0.6, life: 0.04, r: 3.8, g: 2.4, b: 1.2, a: 1, anchored: false });
      this.audio.setLoop('rocket:' + (r.id ??= Math.floor(rand() * 1e6)), { x: r.pos.x, y: r.pos.y, z: r.pos.z, volume: 0.6 });
      const dHead = r.pos.distanceTo(this.headPos);
      if (r.pos.y <= 0.2 || r.life <= 0 || dHead < 2.5) {
        r.dead = true;
        const P = r.pos.clone(); P.y = Math.max(0.3, P.y);
        this.fx.explosion(P, 1.1);
        this.blast(P, 7, 40, null);
        this.haptic(1, 150);
        if (dHead < 12) { this.audio.play('ear_ring', { volume: 0.6 }); this.hurtFlash = Math.min(1, this.hurtFlash + 0.4); }
      }
      if (r.dead) this.audio.stopLoop('rocket:' + r.id);
    }
    this.rockets = this.rockets.filter(r => !r.dead);
  }

  updateBodies(dt, dz) {
    for (const r of this.ragdolls) {
      r.rd.update(dt, V);
      this.collideRagdoll(r);
      const imp = Math.max(r.rd.impact || 0, r.rd.gunImpact || 0);
      if (imp > 3 && this.time - r.thud > 0.25) {
        r.thud = this.time;
        const p = r.rd.position;
        this.fx.main.spawn({ x: p.x, y: 0.3, z: p.z, vy: 0.6, frame: CELL.DUST, s0: 0.5, s1: 1.8, life: 0.8, rot: rand() * 6, r: 0.85, g: 0.72, b: 0.58, a: 0.55, fadeOut: 0.3 });
        if (imp > 5) this.audio.play('impact_flesh', { x: p.x, y: 0.3, z: p.z, volume: 0.5, pitch: 0.7 });
      }
      if (r.rd.done) { r.rd.dispose(); r.dead = true; }
    }
    this.ragdolls = this.ragdolls.filter(r => !r.dead);
    for (const p of this.props) {
      p.life -= dt;
      p.rb.step(dt, V);
      p.obj.position.copy(p.rb.pos); p.obj.quaternion.copy(p.rb.quat);
      if (p.burn && p.rb.pos.distanceTo(this.headPos) > 8) this.fx.trailEmit(p, p.rb.pos, 0.45, (q) => { this.fx.smoke(q, 1.3, 0.13, 2.0, 0.8, 0.65); if (rand() < 0.35) this.fx.flame(q, 0.6); }, dz);
      if (p.rb.pos.z > 420 || p.life <= 0) { p.dead = true; this.scene.remove(p.obj); }
    }
    this.props = this.props.filter(p => !p.dead);
  }
}
