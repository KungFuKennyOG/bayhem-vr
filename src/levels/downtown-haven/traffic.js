import * as THREE from 'three';
import { rand, range, chance, clamp, pick } from '../../rng.js';
import { RigidBox } from '../../physics.js';
import { BillboardBatch, CELL } from '../../particles.js';
import { CARS } from './layout.js';

// =====================================================================================
//  Abandoned traffic = explosive cover. Each car: hp -> engine smoke + alarm + hazards ->
//  fire under the hood (fuse) -> BOOM: launched, flipping, lands as a burning wreck that is
//  still cover. Grenades and nearby blasts cook them off; chains are the point.
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const PAINTS = [0x8a8f96, 0xd8d6d0, 0x1c2a44, 0x5a1414, 0x2b2f33, 0x6f6450, 0x123a2c, 0xa79f8d];
const HP = { sedan: 13, taxi: 13, police: 15, suv: 17, van: 16, bus: Infinity, wreck: Infinity };

export class Traffic {
  constructor(game, carMod, fallback) {
    this.g = game; this.scene = game.scene; this.col = game.col;
    this.cars = [];
    this.glows = new BillboardBatch(220, game.E.atlas, { boost: 1, renderOrder: 19, fog: game.scene.fog });
    this.scene.add(this.glows.mesh);
    let k = 0;
    for (const [x, z, yawDeg, type, flags = ''] of CARS) {
      const f = flags.split(/\s+/);
      const paint = type === 'sedan' || type === 'suv' || type === 'van' ? (type === 'suv' ? 0x101114 : type === 'van' ? 0xe8e6e0 : PAINTS[k % PAINTS.length]) : undefined;
      const m = carMod?.buildCar ? carMod.buildCar(type, { paint, doorOpen: f.includes('open'), seed: 101 + k }) : fallback(type, paint);
      const yaw = yawDeg * Math.PI / 180;
      m.root.position.set(x, this.g.world.fastGround(x, z), z); m.root.rotation.y = yaw;
      m.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(m.root);
      m.root.updateMatrixWorld(true);
      const half = new THREE.Vector3(...m.half), center = new THREE.Vector3(...(m.center || [0, m.half[1], 0]));
      const c = {
        i: k++, type, m, root: m.root, yaw, half, center, flags: f,
        hp: HP[type] ?? 14, maxHp: HP[type] ?? 14,
        state: type === 'wreck' ? 'wreck' : 'ok', explosive: type !== 'bus' && type !== 'wreck',
        alarm: f.includes('alarm'), haz: f.includes('haz') || type === 'police', fuse: 0, burn: type === 'wreck' ? (z > 40 ? 999 : 0) : 0, smoke: 0,
        boxes: [], rb: null, holes: 0, alarmT: 0,
      };
      if (type === 'wreck' && z > 40) c.burn = 999; // the barricade burns forever
      this._addBoxes(c);
      this.cars.push(c);
    }
  }

  // ------------------------------------------------------------ collision: a rotated car -> 1..3 AABBs
  _addBoxes(c) {
    for (const b of c.boxes) this.col.remove(b);
    c.boxes.length = 0;
    const p = c.root.position, h = c.half;
    _e.setFromQuaternion(c.root.quaternion, 'YXZ');
    const yaw = _e.y, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const diag = Math.abs(Math.sin(2 * yaw));
    const k = diag > 0.35 ? 3 : 1;
    const top = p.y + c.center.y + h.y;
    const cx = p.x + rx * c.center.x - fx * c.center.z, cz = p.z + rz * c.center.x - fz * c.center.z;
    for (let i = 0; i < k; i++) {
      const s = ((i + 0.5) / k - 0.5) * 2 * h.z;
      const sx = cx + fx * s, sz = cz + fz * s;
      const hl = h.z / k;
      const ex = Math.abs(fx) * hl + Math.abs(rx) * h.x, ez = Math.abs(fz) * hl + Math.abs(rz) * h.x;
      c.boxes.push(this.col.add([sx - ex, p.y, sz - ez], [sx + ex, top, sz + ez], { kind: 'car', mat: 'metal', ref: c }));
    }
  }
  worldCenter(c, out) { return out.copy(c.center).applyMatrix4(c.root.matrixWorld); }
  hood(c, out) { if (c.m.anchors?.engine || c.m.anchors?.hood) return out.copy(c.m.anchors.engine || c.m.anchors.hood).applyMatrix4(c.root.matrixWorld); return out.set(0, c.half.y * 1.6, -c.half.z * 0.7).applyMatrix4(c.root.matrixWorld); }

  // ------------------------------------------------------------ damage
  damage(c, amount, P, cause = 'bullet') {
    if (!c.explosive || c.state === 'boom' || c.state === 'flying' || c.state === 'wreck') return;
    c.hp -= amount;
    if (cause === 'bullet') {
      this.g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.6, pitch: range(0.8, 1.1) });
      if (chance(0.35)) this.g.audio.play('impact_glass', { x: P.x, y: P.y, z: P.z, volume: 0.35 });
    }
    if (!c.alarm && (c.hp < c.maxHp * 0.85 || cause !== 'bullet')) { c.alarm = true; c.haz = true; }
    if (c.state === 'ok' && c.hp < c.maxHp * 0.5) c.state = 'smoke';
    if (c.hp <= 0 && c.state !== 'fire') this.ignite(c, cause === 'blast' ? range(0.2, 0.6) : range(1.8, 3.0));
  }
  ignite(c, fuse) {
    if (!c.explosive || c.state === 'fire' || c.state === 'boom' || c.state === 'flying' || c.state === 'wreck') return;
    c.state = 'fire'; c.fuse = fuse; c.alarm = true; c.haz = true;
    const h = this.hood(c, _v);
    this.g.audio.play('fuel_whoomp', { x: h.x, y: h.y, z: h.z, volume: 0.7 });
    this.g.events.push({ type: 'carFire', c });
  }
  explode(c) {
    if (c.state === 'boom' || c.state === 'flying' || c.state === 'wreck') return;
    c.state = 'flying';
    const g = this.g;
    const P = this.worldCenter(c, new THREE.Vector3());
    for (const b of c.boxes) this.col.remove(b); c.boxes.length = 0;
    g.boom(P.clone().setY(P.y + 0.4), c.type === 'suv' || c.type === 'van' ? 1.35 : 1.2, { radius: 7.5, dmg: 70, src: c, car: true });
    g.carsBlown++;
    // launched: up, away from whatever hit it, spinning (Bay flips)
    const rb = new RigidBox(c.half.x, c.half.y, c.half.z, 4);
    rb.pos.copy(P); rb.quat.copy(c.root.quaternion);
    const away = c.lastHitDir ? _v2.copy(c.lastHitDir).setY(0).normalize() : _v2.set(range(-1, 1), 0, range(-1, 1)).normalize();
    rb.vel.set(away.x * range(2, 5), range(7.5, 10.5), away.z * range(2, 5));
    const flip = chance(0.6);
    rb.ang.set(flip ? range(3, 5.5) * (chance(0.5) ? -1 : 1) : range(-1.5, 1.5), range(-2.5, 2.5), flip ? range(-1, 1) : range(2.5, 5) * (chance(0.5) ? -1 : 1));
    rb.restitution = 0.18; rb.friction = 0.7;
    c.rb = rb; c.airT = 0;
    c.m.setBurnt?.();
    c.alarm = false; c.haz = false;
    g.audio.stopLoop('car_alarm:' + c.i);
    g.events.push({ type: 'carBoom', c, P });
    // a door / hood / bumper comes off
    for (let i = 0; i < 4; i++) g.fx.spawnDebris(P, range(-9, 9), range(8, 15), range(-9, 9), range(0.2, 0.42), chance(0.5));
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, fx = g.fx, head = g.headPos;
    let gi = 0;
    const G = this.glows, blink = Math.sin(g.time * 7.5) > 0, police = Math.sin(g.time * 11);
    for (const c of this.cars) {
      const near = c.root.position.distanceToSquared(head) < 70 * 70;
      if (c.state === 'smoke' && near && rand() < dt * 14) fx.smoke(this.hood(c, _v), 0.55, c.hp < c.maxHp * 0.25 ? 0.12 : 0.42, 3, 1.4, 0.55);
      if (c.state === 'fire') {
        c.fuse -= dt;
        const h = this.hood(c, _v);
        if (rand() < dt * 40) fx.flame(_v2.copy(h).add(_v.set(range(-0.4, 0.4), range(-0.3, 0.1), range(-0.3, 0.3))), 0.6);
        if (rand() < dt * 18) fx.flame(this.worldCenter(c, _v2).setY(c.root.position.y + 0.25 + rand() * 0.2), 0.5); // burning underneath
        if (rand() < dt * 10) fx.smoke(this.hood(c, _v), 0.9, 0.14, 4, 2.2, 0.7);
        if (rand() < dt * 2.2) { this.hood(c, _v); g.audio.play('impact_glass', { x: _v.x, y: _v.y, z: _v.z, volume: 0.5, pitch: 0.7 }); } // windows popping
        g.audio.setLoop('fire:' + c.i, { x: h.x, y: h.y, z: h.z, volume: 0.6, intensity: 0.7 });
        if (c.fuse <= 0) this.explode(c);
      }
      if (c.state === 'flying') {
        const rb = c.rb;
        rb.floorY = g.world.fastGround(rb.pos.x, rb.pos.z);
        rb.step(dt, 0);
        c.airT += dt;
        // ride the box: root = body pose minus the model-space centre offset
        c.root.quaternion.copy(rb.quat);
        c.root.position.copy(c.center).negate().applyQuaternion(rb.quat).add(rb.pos);
        c.root.updateMatrixWorld(true);
        fx.trailEmit(c, this.worldCenter(c, _v), 0.6, (q) => { fx.flame(q, 0.9); fx.smoke(q, 1.2, 0.12, 3.5, 1.4, 0.7); }, 0);
        if (rb.contactSpeed > 3 && (c.lastThud ?? -1) < g.time - 0.25) { c.lastThud = g.time; g.audio.play('metal_crash', { x: rb.pos.x, y: rb.pos.y, z: rb.pos.z, volume: Math.min(1, rb.contactSpeed / 8) }); g.fx.main.spawn({ x: rb.pos.x, y: rb.floorY + 0.3, z: rb.pos.z, vy: 1, frame: CELL.DUST, s0: 2, s1: 6, life: 1.4, rot: rand() * 6, r: 0.6, g: 0.55, b: 0.5, a: 0.5, fadeOut: 0.4 }); }
        // crushes anyone it lands on
        for (const s of g.soldiers) if (s.alive && rb.vel.y < -2 && s.pos.distanceTo(rb.pos) < c.half.z + 0.4 && Math.abs(rb.pos.y - s.pos.y - 1) < 1.6) g.killSoldier(s, _v.set(0, -1, 0), 1.6, false, 'SQUASHED!');
        if ((rb.onGround && rb.vel.lengthSq() < 0.3 && rb.ang.lengthSq() < 0.3 && c.airT > 1.2) || c.airT > 7) {
          c.state = 'wreck'; c.burn = range(20, 35); c.rb = null;
          c.root.updateMatrixWorld(true);
          this._addBoxes(c);
          this.g.events.push({ type: 'carLanded', c });
        }
      }
      if (c.state === 'wreck' && c.burn > 0) {
        c.burn -= dt;
        if (near) {
          const p = this.worldCenter(c, _v);
          const big = c.burn < 999;
          if (rand() < dt * 26) fx.flame(_v2.copy(p).add(_v.set(range(-c.half.x, c.half.x) * 0.8, range(0, 0.5), range(-c.half.z, c.half.z) * 0.7).applyQuaternion(c.root.quaternion)), big ? 1.0 : 0.7);
          // tall tongues licking out of the cabin, embers streaming up
          if (big && rand() < dt * 9) fx.flame(_v2.copy(p).add(_v.set(range(-0.5, 0.5), c.half.y * 1.6 + range(0, 0.4), range(-0.8, 0.8))), range(1.3, 1.8));
          if (big && rand() < dt * 14) fx.sparks.spawn({ x: p.x + range(-0.8, 0.8), y: p.y + c.half.y * 2, z: p.z + range(-0.8, 0.8), vx: range(-0.6, 0.6) + 0.5, vy: range(2.5, 5), vz: range(-0.6, 0.6) + 0.3, grav: 0.6, drag: 0.4, frame: CELL.SPARK, s0: 1, w: 0.035, len: 0.06, life: range(1.2, 2.4), r: 2.4, g: 1.1, b: 0.35, a: 1, fadeOut: 0.5 });
          if (rand() < dt * 3) fx.smoke(this.worldCenter(c, _v).setY(c.root.position.y + c.half.y * 2), 1.2, 0.1, 6, 2.6, 0.75);
          // the column: black oil smoke lit orange underneath, climbing out of the canyon
          if (rand() < dt * (big ? 1.1 : 0.5)) { const s0 = range(2.5, 3.5); g.clouds.spawn({ x: p.x + range(-0.6, 0.6), y: c.root.position.y + c.half.y * 2 + 1.5, z: p.z + range(-0.6, 0.6), vx: range(-0.3, 0.3) + 0.6, vy: range(3.5, 5), vz: range(-0.3, 0.3) + 0.4, drag: 0.12, buoy: 0.25, s0, s1: s0 * range(6, 8), life: range(9, 12), a: 0.9, fadeIn: 0.06, fadeOut: 0.5, vrot: range(-0.15, 0.15), r: 0.05, g: 0.045, b: 0.042, r1: 0.16, g1: 0.145, b1: 0.13, glow: 1.4, glowFade: 5 }); }
          if (head.distanceToSquared(c.root.position) < 26 * 26) g.audio.setLoop('fire:' + c.i, { x: p.x, y: p.y, z: p.z, volume: c.burn > 900 ? 0.4 : 0.55, intensity: 0.6 });
        }
      }
      // alarms (Bay: every car alarm in the city goes off)
      if (c.alarm && c.state !== 'wreck' && c.state !== 'flying') {
        if (c.root.position.distanceToSquared(head) < 45 * 45) g.audio.setLoop('car_alarm:' + c.i, { x: c.root.position.x, y: 1, z: c.root.position.z, volume: 0.5 });
        else g.audio.stopLoop('car_alarm:' + c.i);
      }
      // lights
      if (gi < G.max - 8 && c.state !== 'wreck' && c.state !== 'flying' && near) {
        const lights = c.m.anchors?.lights || c.m.lights || [];
        for (const L of lights) {
          const kind = L.kind;
          let r = 0, gg = 0, b = 0, s = 0.6;
          if (kind === 'haz' || ((kind === 'head' || kind === 'tail') && c.haz)) { if (!blink) continue; r = 3.0; gg = 1.5; b = 0.25; s = kind === 'tail' ? 0.75 : 0.55; }
          else if (kind === 'red') { if (police < 0.2) continue; r = 3.5; gg = 0.15; b = 0.1; s = 1.1; }
          else if (kind === 'blue') { if (police > -0.2) continue; r = 0.2; gg = 0.6; b = 3.8; s = 1.1; }
          else if (kind === 'tail') { r = 1.0; gg = 0.05; b = 0.03; s = 0.35; }
          else continue;
          const p = L.p ? _v.fromArray(L.p).applyMatrix4(c.root.matrixWorld) : _v.copy(L.pos || L).applyMatrix4(c.root.matrixWorld);
          G.set(gi++, p.x, p.y, p.z, s, s, 0, CELL.GLOW, 0, r, gg, b, 0.9);
        }
      }
    }
    G.commit(gi);
  }

  // autopilot: shoot the car the goons hide behind
  near(P, r) { return this.cars.filter(c => c.explosive && (c.state === 'ok' || c.state === 'smoke') && c.root.position.distanceTo(P) < r); }
}
