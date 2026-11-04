import * as THREE from 'three';
import { rand, range, chance, clamp, lerp, damp, pick } from '../../rng.js';
import { CELL, BillboardBatch } from '../../particles.js';
import { buildHeli } from '../../heli.js';
import { MAT } from '../../vehicles.js';
import { MERIDIAN, LOBBY, SUBWAY, AVE, CROSS } from './layout.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r, h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}

// ---- broken concrete / facade chunks (one instanced draw): jagged, tumbling, settle and sink into the dust
class Rubble {
  constructor(g) {
    this.g = g;
    const geo = new THREE.IcosahedronGeometry(0.5, 0).toNonIndexed();
    const p = geo.attributes.position, R = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const map = new Map();
    for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; if (!map.has(k)) map.set(k, 0.6 + R(map.size + 1) * 0.7); const s = map.get(k); p.setXYZ(i, p.getX(i) * s * 1.3, p.getY(i) * s * 0.7, p.getZ(i) * s); }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6d645b, roughness: 0.95, metalness: 0.05, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, 220); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(220 * 3), 3);
    g.scene.add(this.mesh);
    this.list = []; this.cur = 0;
  }
  spawn(p, v, s) {
    let r = this.list.length < 220 ? (this.list.push({}), this.list[this.list.length - 1]) : this.list[this.cur++ % 220];
    Object.assign(r, { p: p.clone(), v: v.clone(), q: new THREE.Quaternion().setFromEuler(_e.set(rand() * 6, rand() * 6, rand() * 6)), w: new THREE.Vector3(range(-3, 3), range(-3, 3), range(-3, 3)), s, rest: false, sink: 0, dark: range(0.55, 1.05), glass: chance(0.25) });
  }
  update(dt) {
    const m = this.mesh, gr = this.g.world.fastGround;
    let k = 0;
    for (const r of this.list) {
      if (!r.rest) {
        r.v.y -= 9.8 * dt; r.p.addScaledVector(r.v, dt);
        const wl = r.w.length(); if (wl > 1e-3) { _q.setFromAxisAngle(_v.copy(r.w).divideScalar(wl), wl * dt); r.q.premultiply(_q); }
        const gy = gr(r.p.x, r.p.z) + r.s * 0.3;
        if (r.p.y < gy) { r.p.y = gy; if (r.v.y < -4) { r.v.y *= -0.25; r.v.x *= 0.5; r.v.z *= 0.5; r.w.multiplyScalar(0.5); } else r.rest = true; }
      } else if (r.sink < r.s * 0.4) { r.sink += dt * 0.2; r.p.y -= dt * 0.2; }
      _m.compose(r.p, r.q, _v.set(r.s, r.s, r.s)); m.setMatrixAt(k, _m);
      if (r.glass) m.instanceColor.setXYZ(k, 0.35, 0.4, 0.44); else m.instanceColor.setXYZ(k, r.dark, r.dark * 0.95, r.dark * 0.9);
      k++;
    }
    m.count = k; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  }
}

// =====================================================================================
//  DOWNTOWN HAVEN CITY set pieces:
//   - WIDOWMAKER 2: the gunship (strafes the avenue through the glass, rockets the cars,
//     crashes into Meridian Tower when it dies)
//   - the lobby: skylight + curtain wall come down in slow-mo
//   - the finale: Meridian breaks at the impact floor, leans down the avenue, sheds its
//     floors one by one into the canyon; the dust wall rolls up the street after you
// =====================================================================================
export class SetPieces {
  constructor(game) {
    this.g = game; this.world = game.world;
    this.heli = null;
    this.rockets = [];
    this.holeFire = 0;
    this.col = null; // collapse state
    this.dust = null;
    const g = game;
    this.heliTarget = {
      active: () => !!this.heli && this.heli.alive && this.heli.phase !== 'dying',
      ray: (o, d) => {
        const H = this.heli; let best = -1;
        for (const [pt, r] of H.hit) { pt.getWorldPosition(_v); const t = raySphere(o, d, _v, r); if (t > 0 && (best < 0 || t < best)) best = t; }
        return best;
      },
      hit: (P, dir) => { g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.8, pitch: 0.75 }); this.damageHeli(0.35, P); g.hitMarker(false); },
      near: (p) => this.heli.pos.distanceTo(p) < 4.2,
      direct: (p) => { this.damageHeli(20, p); g.hitMarker(true); },
      blast: (P, r, dmg) => { const d = this.heli.pos.distanceTo(P); if (d < r + 4) this.damageHeli(dmg * 0.12 * (1 - d / (r + 4)) + 2, P); },
      aim: () => this.heli.pos,
      auto: (head, A) => {
        const H = this.heli; if (H.phase === 'enter' && H.t < 3.2) return null;
        const d = H.pos.distanceTo(head); if (d > 90) return null;
        return { kind: 'target', p: H.pos.clone(), score: 72 + (A.target?.ref === this.heliTarget ? 25 : 0) + (H.hp < H.maxHp * 0.35 ? 30 : 0), ref: this.heliTarget, heavy: true, minNade: 12, tol: 0.07 };
      },
    };
    game.targets.push(this.heliTarget);
    this.rubble = new Rubble(game);
    this.clouds = game.clouds;
  }

  update(dt) {
    this._updHeli(dt);
    this._updRockets(dt);
    this._updTail(dt);
    this._updHole(dt);
    this._updCollapse(dt);
    this._updDust(dt);
    this.rubble.update(dt);
  }

  // ================================================================== GUNSHIP
  spawnHeli() {
    const g = this.g, m = buildHeli();
    m.root.scale.setScalar(1.55); // the boss fills the canyon
    g.scene.add(m.root);
    // hit spheres (fuselage, cockpit, tail)
    const mk = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); m.tilt.add(o); return o; };
    const hit = [[mk(0, 0.2, -0.8), 1.9], [mk(0, 0.4, -3.4), 1.3], [mk(0, 0.4, 3.0), 1.1], [mk(0, 0.5, 6.5), 0.8]];
    const hp = g.trailer ? 130 : 150;
    this.heli = { m, hit, pos: m.root.position.set(170, 30, CROSS.road0 + 4), vel: new THREE.Vector3(-40, 0, 0), yaw: Math.PI / 2, hp, maxHp: hp, phase: 'enter', t: 0, rocketT: 3.5, gunT: 2.5, burst: 0, wp: new THREE.Vector3(), wpT: 0, spin: 0, alive: true, bank: 0, pitch: 0, strafeT: 14, hitT: 0 };
    g.audio.musicStinger('boss');
    if (!this.glowB) { this.glowB = new BillboardBatch(8, g.E.atlas, { boost: 1, renderOrder: 19, fog: g.scene.fog }); g.scene.add(this.glowB.mesh); }
    return this.heli;
  }
  damageHeli(d, P) {
    const H = this.heli; if (!H || !H.alive || H.phase === 'dying') return;
    H.hp -= d; H.hitT = 1;
    // progressive scorch; at half health the engine access panel blows off
    if (H.m.setDamage?.(clamp(1 - H.hp / H.maxHp, 0, 1))) {
      const p = H.m.sparkPt.getWorldPosition(new THREE.Vector3());
      this.g.fx.smallExplosion(p, 0.7);
      for (let i = 0; i < 4; i++) this.g.fx.spawnDebris(p, H.vel.x + range(-5, 5), range(2, 6), H.vel.z + range(-5, 5), range(0.15, 0.35), true);
      this.g.audio.play('metal_crash', { x: p.x, y: p.y, z: p.z, volume: 0.7, pitch: 1.3 });
      this.g.callout('ENGINE HIT!', p.clone().setY(p.y + 3), 'small');
    }
    if (H.hp <= 0) this.killHeli();
  }
  killHeli() {
    const g = this.g, H = this.heli;
    if (H.phase === 'dying') return;
    H.phase = 'dying'; H.t = 0; H.spin = 0.6;
    g.fx.explosion(H.pos.clone(), 1.3, { noRing: true });
    g.slowmo(2.4, 0.28, true);
    g.addScore(5000, 'BIRD DOWN!', H.pos.clone().setY(H.pos.y + 4), 'huge');
    g.audio.play('metal_crash', { x: H.pos.x, y: H.pos.y, z: H.pos.z });
    g.bossInfo = null;
    g.events.push({ type: 'heliDying' });
    H.crash = new THREE.Vector3(...MERIDIAN.impact).add(_v.set(0, 0, 1.2));
    H.start = H.pos.clone();
  }
  _updHeli(dt) {
    const g = this.g, H = this.heli;
    if (!H || H.phase === 'gone') return;
    H.t += dt; H.hitT = Math.max(0, H.hitT - dt * 6);
    const m = H.m, head = g.headPos;
    const target = _v;
    let speedK = 1.1, maxV = 34;
    if (H.alive && H.phase !== 'dying') g.bossInfo = { frac: Math.max(0, H.hp / H.maxHp), name: 'GUNSHIP  "WIDOWMAKER 2"' };
    if (H.phase === 'enter') {
      // in low down the cross street, over the intersection, a hard bank and back up the avenue at you
      const t = H.t;
      if (t < 3.6) { target.set(lerp(170, -60, t / 3.6), lerp(30, 17, Math.min(1, t / 2.6)), lerp(CROSS.road0 + 4, -50, t / 3.6)); speedK = 3.2; maxV = 70; }
      else if (t < 6.5) { target.set(-6, 24, clamp(head.z - 34, -130, -40)); speedK = 1.2; }
      else { H.phase = 'fight'; H.wpT = 0; }
      if (t > 1.5 && !H.flyby) { H.flyby = true; g.audio.play('heli_flyby', { x: H.pos.x, y: H.pos.y, z: H.pos.z }); }
    }
    if (H.phase === 'fight' || H.phase === 'strafe') this._heliWeapons(dt);
    m.aimGun?.(H.aimAt || head, dt, H.phase !== 'dying' && (H.burst > 0 || (H.phase === 'strafe' && H.t > 2.2)));
    if (H.hp < H.maxHp * 0.5 && rand() < dt * 25) { m.sparkPt.getWorldPosition(_v2); g.fx.flame(_v2, 0.5, H.vel); if (rand() < 0.3) g.fx.sparks.spawn({ x: _v2.x, y: _v2.y, z: _v2.z, vx: H.vel.x + range(-3, 3), vy: range(0, 4), vz: H.vel.z + range(-3, 3), grav: -9.8, frame: CELL.SPARK, s0: 1, w: 0.04, life: range(0.4, 0.9), r: 2, g: 1, b: 0.4, a: 1, fadeOut: 0.5 }); }
    if (H.phase === 'fight') {
      H.wpT -= dt; H.strafeT -= dt;
      if (H.wpT <= 0) {
        H.wpT = range(3.5, 5.5);
        const inX = head.z < CROSS.z1 + 6 && head.z > CROSS.z0 - 6;
        H.wp.set(inX ? range(-22, 22) : range(-5, 5), range(14, 22), clamp(head.z - range(17, 30), -140, 10));
      }
      target.copy(H.wp);
      if (H.strafeT <= 0 && H.hp > 0) { H.phase = 'strafe'; H.t = 0; H.sx = range(-3, 3); H.s0 = clamp(head.z - 75, -150, -20); H.s1 = head.z + 30; g.events.push({ type: 'strafe' }); }
      if (H.hp < H.maxHp * 0.5) g.fx.trailEmit(H, m.smokePt.getWorldPosition(_v2), 0.8, (q) => g.fx.smoke(q, 1.1, 0.13, 2.5, 0.5, 0.65), 0);
      // a black ribbon of smoke hanging in the canyon behind it, so you can follow it against the sky
      if (H.hp < H.maxHp * 0.6) g.fx.trailEmit(H.ribbon ||= {}, m.smokePt.getWorldPosition(_v2), 2.2, (q) => this.clouds.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.4, 0.4), vy: range(0.3, 1), vz: range(-0.4, 0.4), drag: 0.5, buoy: 0.1, s0: 2.2, s1: range(9, 13), life: range(6, 8), a: H.hp < H.maxHp * 0.3 ? 0.92 : 0.7, fadeIn: 0.05, fadeOut: 0.55, vrot: range(-0.2, 0.2), r: 0.07, g: 0.062, b: 0.058, r1: 0.2, g1: 0.18, b1: 0.16 }), 0);
      if (H.hp < H.maxHp * 0.25 && rand() < dt * 20) g.fx.flame(m.smokePt.getWorldPosition(_v2), 0.8, H.vel);
    }
    if (H.phase === 'strafe') {
      // strafing run straight down the avenue: up the canyon at 13 m, guns stitching both shopfront lines
      const T = H.t;
      const dur = (H.s1 - H.s0) / 28;
      if (T < 2.2) { target.set(H.sx, 26, H.s0); speedK = 1.6; }
      else {
        const k = clamp((T - 2.2) / dur, 0, 1);
        target.set(H.sx, lerp(18, 13, Math.sin(k * Math.PI)), lerp(H.s0, H.s1, k)); speedK = 4; maxV = 40;
        if (k > 0.05 && k < 0.85) this._strafeFire(dt);
        if (k >= 1) { H.phase = 'fight'; H.strafeT = range(16, 22); H.wpT = 0; }
      }
    }
    if (H.phase === 'dying') {
      // spinning, burning, lurching down the avenue into Meridian's face
      H.spin = Math.min(5.5, H.spin + dt * 2.2);
      H.yaw += H.spin * dt;
      const d = H.pos.distanceTo(H.crash);
      const sp = Math.min(34, 12 + H.t * 7);
      // lurch down the middle of the avenue, then into the face of the tower
      _v3.copy(H.crash); if (H.pos.z > H.crash.z + 40) { _v3.x = clamp(H.pos.x * 0.5, -6, 6); _v3.z = H.pos.z - 30; _v3.y = lerp(H.pos.y, H.crash.y, 0.3); }
      _v2.subVectors(_v3, H.pos).normalize();
      // wobble so it doesn't fly a ruler line
      _v2.x += Math.sin(H.t * 2.3) * 0.25; _v2.y += Math.sin(H.t * 3.1) * 0.15; _v2.normalize();
      H.vel.lerp(_v2.multiplyScalar(sp), 1 - Math.exp(-dt * 2.5));
      if (!(H.pos.z < CROSS.z1 && H.pos.z > CROSS.z0)) this._canyon(H, dt);
      g.fx.trailEmit(H, m.smokePt.getWorldPosition(_v3), 0.7, (q) => { g.fx.flame(q, 1.2); g.fx.smoke(q, 1.6, 0.1, 3.5, 1, 0.85); }, 0);
      g.fx.trailEmit(H.ribbon ||= {}, m.smokePt.getWorldPosition(_v3), 2.0, (q) => this.clouds.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.5, 0.5), vy: range(0.5, 1.5), vz: range(-0.5, 0.5), drag: 0.5, buoy: 0.1, s0: 3, s1: range(12, 16), life: range(7, 9), a: 0.94, fadeIn: 0.03, fadeOut: 0.5, vrot: range(-0.2, 0.2), r: 0.06, g: 0.052, b: 0.048, r1: 0.18, g1: 0.16, b1: 0.14, glow: 1.2, glowFade: 6 }), 0);
      // the tail boom lets go and tumbles down into the street
      if (H.t > 0.8 && !H.tail && m.breakTail) {
        const tb = m.breakTail();
        if (tb) { H.tail = { o: tb.object, v: tb.velocityHint.clone().add(H.vel), w: tb.spinHint.clone() }; g.fx.smallExplosion(tb.object.getWorldPosition(new THREE.Vector3()), 0.9); }
      }
      if (d < 3 || H.pos.z < H.crash.z + 0.5 || H.t > 14) { this._heliCrash(); return; }
    } else {
      _v2.subVectors(target, H.pos).multiplyScalar(speedK);
      if (_v2.length() > maxV) _v2.setLength(maxV);
      H.vel.lerp(_v2, 1 - Math.exp(-dt * 1.6));
      // keep the rotor inside the canyon (no clipping into towers)
      this._canyon(H, dt);
    }
    H.pos.addScaledVector(H.vel, dt);
    if (H.phase !== 'dying') {
      const faceYaw = H.phase === 'enter' && H.t < 3.6 ? Math.atan2(-H.vel.x, -H.vel.z) : H.phase === 'strafe' && H.t > 2.2 ? Math.atan2(-H.vel.x, -H.vel.z + 0.001) : Math.atan2(-(head.x - H.pos.x), -(head.z - H.pos.z));
      let dy = faceYaw - H.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      H.yaw += dy * (1 - Math.exp(-dt * 2.4));
    }
    const cy = Math.cos(H.yaw), sy = Math.sin(H.yaw);
    const fwd = H.vel.x * -sy + H.vel.z * -cy, side = H.vel.x * cy - H.vel.z * sy;
    H.pitch = damp(H.pitch, -clamp(fwd * 0.012, -0.35, 0.35), 3, dt);
    H.bank = damp(H.bank, -clamp(side * 0.02, -0.55, 0.55), 3, dt);
    m.root.position.copy(H.pos);
    m.root.rotation.set(0, H.yaw, 0);
    m.tilt.rotation.set(H.pitch, 0, H.bank + (H.phase === 'dying' ? Math.sin(H.t * 3) * 0.3 : 0));
    m.rotor.rotation.y += dt * 38; m.tailRotor.rotation.x += dt * 60;
    m.root.updateMatrixWorld();
    g.audio.setLoop('heli', { x: H.pos.x, y: H.pos.y, z: H.pos.z, volume: 1 });
    // rotor wash: dust, paper and smoke whipped off the street
    if (H.pos.y < 26) {
      H.dustT = (H.dustT || 0) - dt;
      if (H.dustT <= 0) {
        H.dustT = 0.06;
        const gy = this.world.fastGround(H.pos.x, H.pos.z), a = 1 - (H.pos.y - gy) / 26;
        const ang = rand() * 6.28, r = range(2, 8);
        g.fx.main.spawn({ x: H.pos.x + Math.cos(ang) * r, y: gy + 0.4, z: H.pos.z + Math.sin(ang) * r, vx: Math.cos(ang) * range(6, 11), vz: Math.sin(ang) * range(6, 11), vy: range(0.3, 1.2), drag: 1.1, frame: CELL.DUST, s0: 2, s1: 7, life: 1.6, rot: rand() * 6, r: 0.8, g: 0.72, b: 0.62, a: 0.4 * a, fadeOut: 0.35 });
        if (rand() < 0.4) g.fx.sparks.spawn({ x: H.pos.x + range(-6, 6), y: gy + 0.3, z: H.pos.z + range(-6, 6), vx: range(-6, 6), vy: range(2, 5), vz: range(-6, 6), grav: -3, drag: 1.5, frame: CELL.CHIP, s0: 1, w: 0.08, len: 0.12, life: 2, r: 0.9, g: 0.88, b: 0.82, a: 0.8 * a, fadeOut: 0.4 });
      }
    }
    // nav lights + searchlight glow
    const G = this.glowB, blink = Math.sin(g.time * 6) > 0.3;
    let gi = 0;
    if (H.phase !== 'dying') for (const [pt, col] of m.navLights) { if (col[3] && !blink) continue; pt.getWorldPosition(_v); G.set(gi++, _v.x, _v.y, _v.z, 1.3, 1.3, 0, CELL.GLOW, 0, col[0], col[1], col[2], 1); }
    if (H.phase !== 'dying') { m.lightPt.getWorldPosition(_v); G.set(gi++, _v.x, _v.y, _v.z, 4, 4, 0, CELL.GLOW, 0, 2.2, 2.0, 1.7, 0.9); }
    G.commit(gi);
  }
  // keep the rotor inside the canyon (the cross street is the only wide spot): a soft spring, never a kick
  _canyon(H, dt) {
    const inX = H.pos.z < CROSS.z1 - 1 && H.pos.z > CROSS.z0 + 1;
    const lim = inX ? 230 : AVE.half - 7;
    const over = Math.abs(H.pos.x) - lim;
    if (over > 0) {
      H.vel.x = damp(H.vel.x, -Math.sign(H.pos.x) * Math.min(14, over * 2.5), 5, dt);
      if (over > 3) H.pos.x = Math.sign(H.pos.x) * (lim + 3);
    }
  }
  _heliWeapons(dt) {
    const g = this.g, H = this.heli, m = H.m, head = g.headPos;
    H.rocketT -= dt; H.gunT -= dt;
    const hpFrac = H.hp / H.maxHp;
    if (H.phase === 'fight' && H.rocketT <= 0) {
      H.rocketT = range(3.6, 5.5) * (hpFrac < 0.5 ? 0.75 : 1);
      // rockets go for the car you're hiding behind
      const cars = g.traffic.near(head, 12).sort((a, b) => a.root.position.distanceTo(head) - b.root.position.distanceTo(head));
      const pod = m.pods[Math.floor(rand() * 2)];
      const p = pod.getWorldPosition(new THREE.Vector3());
      let aim;
      if (cars.length && chance(0.75)) aim = g.traffic.worldCenter(cars[0], new THREE.Vector3());
      else aim = head.clone().add(_v.set(range(-4, 4), -1.4, range(-4, 4)));
      const dir = aim.clone().sub(p).normalize();
      this.rockets.push({ pos: p, vel: dir.multiplyScalar(42), life: 5 });
      g.audio.play('rocket_launch', { x: p.x, y: p.y, z: p.z });
      g.fx.muzzle(p, dir, 'launcher', false);
    }
    if (H.phase === 'fight' && H.gunT <= 0) {
      if (H.burst <= 0) { H.burst = 16; H.walk0 = head.clone().add(_v.set(range(-6, 6), 0, range(-12, -8))); H.walk1 = head.clone(); H.walkSide = chance(0.5); }
      H.burst--;
      H.gunT = H.burst > 0 ? 0.075 : range(2.2, 3.4);
      const mz = m.gun.getWorldPosition(new THREE.Vector3());
      const prog = 1 - H.burst / 16;
      // walk the rounds onto you; half the bursts rake a shopfront on the way
      const tgt = _v2.lerpVectors(H.walk0, H.walk1, prog);
      tgt.y = this.world.fastGround(tgt.x, tgt.z) + (H.walkSide ? range(0.2, 3.5) : range(-0.3, 0.6));
      if (H.walkSide) tgt.x = lerp(tgt.x, Math.sign(tgt.x || 1) * AVE.half, 0.6 * (1 - prog));
      tgt.x += range(-0.8, 0.8); tgt.z += range(-0.8, 0.8);
      (H.aimAt ||= new THREE.Vector3()).copy(tgt);
      this._gunRound(mz, tgt.clone());
    }
  }
  _gunRound(mz, tgt) {
    const g = this.g;
    if (this.heli) (this.heli.aimAt ||= new THREE.Vector3()).copy(tgt);
    _v.subVectors(tgt, mz).normalize();
    g.fx.muzzle(mz, _v, 'enemy', false);
    if (rand() < 0.4) g.fx.light(mz, 12, 0.05, 0xffb060, true, 12);
    g.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, pitch: 0.62, volume: 1 });
    const { end } = g._round(mz, tgt, null, { speed: 300, color: [2.0, 0.65, 0.28], width: 0.09, len: 6, carDmg: 2 });
    g.fx.later(mz.distanceTo(end) / 300, () => {
      // 30 mm: big dirt kicks
      g.fx.main.spawn({ x: end.x, y: end.y + 0.3, z: end.z, vy: range(2, 4), frame: CELL.DIRT, s0: 0.6, s1: 2.2, ease: 0.5, life: 0.9, rot: rand() * 6, r: 1, g: 0.95, b: 0.9, a: 0.85, fadeIn: 0.02, fadeOut: 0.3 });
      if (end.distanceTo(g.headPos) < 1.6 + (g.trailer ? -0.6 : 0)) g.hurt(6, end);
    });
  }
  _strafeFire(dt) {
    const g = this.g, H = this.heli, m = H.m;
    H.sfT = (H.sfT || 0) - dt;
    if (H.sfT > 0) return;
    H.sfT = 0.07;
    const mz = m.gun.getWorldPosition(new THREE.Vector3());
    // alternate: the street ahead (zig-zag) and the shopfronts on either side
    H.sfK = (H.sfK || 0) + 1;
    const ahead = H.pos.z + 22;
    if (H.sfK % 3) this._gunRound(mz, new THREE.Vector3(Math.sin(H.sfK * 0.7) * 8, 0, ahead + range(-3, 3)));
    else {
      const side = H.sfK % 6 ? 1 : -1;
      const ps = g.glass.panesNear(new THREE.Vector3(side * AVE.half, 3, ahead), 9, (p) => p.kind === 'store');
      const p = ps.length ? pick(ps) : null;
      this._gunRound(mz, p ? p.c.clone().add(_v.set(0, range(-0.8, 0.8), range(-0.6, 0.6))) : new THREE.Vector3(side * AVE.half, range(1, 5), ahead));
    }
  }
  _updTail(dt) {
    const T = this.heli?.tail; if (!T || T.done) return;
    const g = this.g;
    T.v.y -= 9.8 * dt; T.o.position.addScaledVector(T.v, dt);
    _q.setFromAxisAngle(_v.copy(T.w).normalize(), T.w.length() * dt); T.o.quaternion.premultiply(_q);
    g.fx.trailEmit(T, T.o.position, 0.6, (q) => g.fx.smoke(q, 1.0, 0.12, 2.5, 0.6, 0.7), 0);
    const gy = this.world.fastGround(T.o.position.x, T.o.position.z);
    if (T.o.position.y < gy + 0.8) { T.done = true; T.o.position.y = gy + 0.6; g.boom(T.o.position.clone(), 0.9, { radius: 6, dmg: 30 }); for (const mm of [T.o]) mm.traverse(o => { if (o.isMesh) o.material = MAT.charred; }); }
  }
  _updRockets(dt) {
    const g = this.g;
    for (const r of this.rockets) {
      r.life -= dt;
      const prev = _v2.copy(r.pos);
      r.pos.addScaledVector(r.vel, dt);
      g.fx.trailEmit(r, r.pos, 0.35, (q) => { g.fx.main.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.3, 0.3), vy: range(0.2, 0.6), vz: range(-0.3, 0.3), drag: 1.2, frameKind: 2, frame: rand() * 40, frames: 12, s0: 0.5, s1: 2.4, life: range(1.6, 2.4), rot: rand() * 6, r: 0.55, g: 0.52, b: 0.5, a: 0.55, fadeOut: 0.5 }); }, 0);
      g.fx.main.spawn({ x: r.pos.x, y: r.pos.y, z: r.pos.z, frame: CELL.GLOW, s0: 0.9, life: 0.04, r: 3.8, g: 1.8, b: 0.6, a: 1, anchored: false });
      g.audio.setLoop('rocket:' + (r.id ||= Math.floor(rand() * 1e6)), { x: r.pos.x, y: r.pos.y, z: r.pos.z, volume: 0.8 });
      _v.subVectors(r.pos, prev); const L = _v.length(); _v.divideScalar(L || 1);
      const hit = L > 0 ? g.col.raycast(prev, _v, L, b => b.data.noBullet || b.data.kind === 'glass') : null;
      const gy = this.world.fastGround(r.pos.x, r.pos.z);
      if (hit || r.pos.y < gy + 0.2 || r.life <= 0) {
        r.dead = true;
        const P = hit ? prev.clone().addScaledVector(_v, hit.t - 0.2) : r.pos.clone().setY(Math.max(r.pos.y, gy + 0.3));
        if (hit && hit.box.data.kind === 'car') { g.traffic.ignite(hit.box.data.ref, 0.05); hit.box.data.ref.lastHitDir = _v.clone(); }
        g.audio.stopLoop('rocket:' + r.id);
        g.boom(P, 1.0, { radius: 6.5, dmg: 40 });
      }
    }
    this.rockets = this.rockets.filter(r => !r.dead);
  }
  _heliCrash() {
    const g = this.g, H = this.heli, m = H.m;
    H.phase = 'gone'; H.alive = false;
    g.audio.stopLoop('heli'); this.glowB.commit(0);
    const I = new THREE.Vector3(...MERIDIAN.impact);
    // wedged in the facade, nose first, burnt
    m.root.position.set(I.x, I.y - 0.5, I.z + 0.6); m.root.rotation.set(0.35, Math.PI * 0.12, 0.6); m.root.scale.setScalar(1.55); // nose buried in the floor plates, tail boom out over the plaza
    m.tilt.rotation.set(0, 0, 0); m.body.material = [MAT.charred, MAT.charred, MAT.charred];
    for (const b of m.burnables || []) b.material = MAT.charred;
    m.rotorBlur?.(0, true);
    m.rotor.visible = false; m.cone.visible = false; // the rotor sheared off on the facade
    for (let k = 0; k < 6; k++) g.fx.spawnDebris(I.clone().add(_v.set(range(-4, 4), 3, 6)), range(-8, 8), range(4, 10), range(4, 12), range(0.5, 0.9), true);
    m.root.updateMatrixWorld(true);
    this.wreck = m;
    if (this.world.meridian.hole) this.world.meridian.hole.visible = true;
    g.fx.explosion(I.clone().add(_v.set(0, 0, 3)), 4.2, { noRing: true });
    for (let k = 1; k <= 8; k++) g.fx.later(0.1 * k + rand() * 0.1, () => g.fx.explosion(I.clone().add(_v.set(range(-12, 12), range(-7, 8), range(1, 5))), range(1.8, 2.8), { noRing: true }));
    // the blast cloud: black, fire-lit, rolling up the facade and staying there
    for (let k = 0; k < 14; k++) g.fx.later(0.15 + k * 0.08, () => this.clouds.spawn({ x: I.x + range(-14, 14), y: I.y + range(-6, 8), z: I.z + range(3, 9), vx: range(-4, 4), vy: range(4, 9), vz: range(1, 5), drag: 0.5, buoy: 0.6, s0: range(14, 20), s1: range(40, 56), life: range(10, 14), a: 0.95, fadeIn: 0.02, fadeOut: 0.4, vrot: range(-0.1, 0.1), r: 0.06, g: 0.052, b: 0.047, r1: 0.14, g1: 0.125, b1: 0.11, glow: 1.4, glowFade: 1.6 }));
    g.fx.light(I.clone().add(_v.set(0, 0, 6)), 900, 1.8, 0xff9040, true, 140);
    g.lastExplosionT = g.time; g.lastExplosionShake = 0.6;
    g.audio.play('explosion_big', { x: I.x, y: I.y, z: I.z + 10, volume: 1 });
    g.audio.play('metal_crash', { x: I.x, y: I.y, z: I.z + 10, volume: 1 });
    g.fx.later(0.6, () => g.audio.play('glass_rain', { x: I.x, y: 10, z: I.z + 8, volume: 1 }));
    // the glass waterfall: the facade around the hole sheds down onto the plaza
    for (let k = 0; k < 14; k++) g.fx.later(k * 0.07, () => g.glass.burst(_v.set(I.x + range(-14, 14), I.y + range(-8, 10), MERIDIAN.z1 + 0.6), _v2.set(range(-0.2, 0.2), -0.1, 1), 16, { spread: 2.5, speed: range(4, 9), size: range(0.35, 0.7), life: 14, up: 1 }));
    for (let k = 0; k < 120; k++) g.fx.sparks.spawn({ x: I.x + range(-12, 12), y: I.y + range(-6, 8), z: MERIDIAN.z1 + 1, vx: range(-3, 3), vy: range(-2, 4), vz: range(2, 10), grav: -9.8, drag: 0.4, frame: CELL.SPARK, s0: 1, w: 0.05, len: 0.15, life: range(2, 4), r: 2, g: 2.1, b: 2.3, a: 0.9, fadeOut: 0.5, ground: true });
    g.slowmo(1.8, 0.35, true);
    g.addScore(1500, 'RIGHT IN THE LOBBY!', I.clone().add(_v.set(0, 10, 10)), 'big');
    // the crash owns the big-sprite budget for a few seconds
    g.fx.main.bigBudget += 90; g.fx.later(5, () => { g.fx.main.bigBudget -= 90; });
    this.megaFireball(I.clone().add(_v.set(0, 2, 6)), 2.3);
    g.fx.later(0.35, () => this.megaFireball(I.clone().add(_v.set(range(-6, 6), 7, 4)), 1.5));
    for (let k = 0; k < 12; k++) g.fx.later(0.25 + k * 0.13, () => {
      const P = new THREE.Vector3(I.x + range(-17, 17), I.y + (k % 2 ? 1 : -1) * range(2, 4 + k * 1.6), MERIDIAN.z1 + 0.8);
      g.fx.explosion(P, range(1.1, 1.6), { noRing: true }); g.smokeAfter(P, 1.3);
      g.glass.burst(P, _v2.set(range(-0.2, 0.2), 0, 1), 14, { spread: 3, speed: 7, size: 0.5, life: 12, up: 1 });
    });
    // the facade comes down onto the plaza: concrete and twisted panels rain out of the hole
    for (let k = 0; k < 40; k++) g.fx.later(rand() * 1.2, () => this.rubble.spawn(_v.set(I.x + range(-9, 9), I.y + range(-6, 6), MERIDIAN.z1 + range(1, 3)), _v2.set(range(-4, 4), range(-2, 4), range(3, 10)), range(0.4, 1.6)));
    this.holeFire = 1;
    g.events.push({ type: 'heliCrash', P: I.clone() });
  }
  // one-off hero fireball: big rolling flipbook fire that climbs and turns to black smoke (crash, break floor)
  megaFireball(P, k = 1) {
    const g = this.g;
    g.fx.light(P, 1600 * k, 2.2, 0xff9a40, true, 180);
    g.fx.main.spawn({ x: P.x, y: P.y, z: P.z, frame: CELL.FLASH, s0: 30 * k, s1: 60 * k, life: 0.3, r: 3, g: 2.3, b: 1.4, a: 1, fadeIn: 0, fadeOut: 0.3 });
    for (let i = 0; i < 12; i++) g.fx.later(i * 0.04, () => {
      const a = rand() * 6.28, el = range(0.1, 1.2), sp = range(6, 16) * k;
      g.fx.main.spawn({ x: P.x + range(-4, 4) * k, y: P.y + range(-2, 3) * k, z: P.z + range(-2, 4) * k, vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp + 4, vz: Math.abs(Math.sin(a)) * Math.cos(el) * sp + 3, drag: 1.6, grav: 2, frameKind: 1, s0: range(9, 13) * k, s1: range(22, 32) * k, ease: 0.55, life: range(1.8, 2.6), rot: rand() * 6, vrot: range(-0.6, 0.6), r: 2.3, g: 1.9, b: 1.6, a: 1, fadeIn: 0.02, fadeOut: 0.8 });
    });
    for (let i = 0; i < 9; i++) g.fx.later(range(0.4, 1.3), () => this.clouds.spawn({ x: P.x + range(-8, 8) * k, y: P.y + range(3, 10) * k, z: P.z + range(0, 6), vx: range(-2, 2), vy: range(5, 9), vz: range(0, 3), drag: 0.45, buoy: 0.5, s0: 12 * k, s1: range(30, 42) * k, life: range(8, 11), a: 0.95, fadeIn: 0.08, fadeOut: 0.45, vrot: range(-0.12, 0.12), r: 0.07, g: 0.06, b: 0.055, r1: 0.15, g1: 0.13, b1: 0.115, glow: 1.2, glowFade: 2 }));
  }
  _updHole(dt) {
    if (!this.holeFire || this.col?.phase === 'fall' || this.col?.phase === 'down') return;
    const g = this.g, I = _v.set(...MERIDIAN.impact).add(_v2.set(0, 0, 2));
    // a burning wound in the tower: fire belching out, a black column climbing past the crown
    if (rand() < dt * 26) g.fx.main.spawn({ x: I.x + range(-7, 7), y: I.y + range(-3, 3), z: I.z + range(0, 2), vx: range(-1, 1), vy: range(3, 7), vz: range(1, 4), drag: 1.2, frameKind: 1, s0: range(4, 6), s1: range(10, 15), ease: 0.6, life: range(0.9, 1.5), rot: rand() * 6, vrot: range(-1, 1), r: 2.2, g: 1.8, b: 1.5, a: 1, fadeIn: 0.02, fadeOut: 0.6 });
    if (rand() < dt * 2.2) this.clouds.spawn({ x: I.x + range(-7, 7), y: I.y + 3, z: I.z + range(1, 4), vx: range(-0.5, 0.5) + 1.1, vy: range(6, 9), vz: range(0.3, 1.5), drag: 0.15, buoy: 0.4, s0: 12, s1: range(48, 64), life: range(13, 16), a: 0.95, fadeIn: 0.04, fadeOut: 0.45, vrot: range(-0.06, 0.06), r: 0.06, g: 0.053, b: 0.048, r1: 0.15, g1: 0.135, b1: 0.12, glow: 1.3, glowFade: 4 });
    if (g.headPos.distanceTo(I) < 90) g.audio.setLoop('fire_big', { x: I.x, y: I.y, z: I.z, volume: 0.9, intensity: 0.9 });
  }

  // ================================================================== LOBBY
  lobbyCollapse() {
    const g = this.g;
    if (this.lobbyDone) return; this.lobbyDone = true;
    g.audio.play('collapse_rumble', { volume: 0.8 });
    g.audio.play('metal_groan', { x: 30, y: 9, z: -104, volume: 1 });
    g.lastExplosionT = g.time; g.lastExplosionShake = 0.9;
    g.slowmo(3.0, 0.3, true);
    g.haptic(1, 500);
    // grit raining from the ceiling first
    for (let i = 0; i < 40; i++) g.fx.later(rand() * 0.6, () => g.fx.main.spawn({ x: range(LOBBY.x0 + 1, LOBBY.x1 - 1), y: LOBBY.ceilY - 0.2, z: range(LOBBY.z0 + 1, LOBBY.z1 - 1), vy: range(-3, -1), drag: 1, frame: CELL.DUST, s0: 0.4, s1: 3, life: 2.2, rot: rand() * 6, r: 0.85, g: 0.8, b: 0.72, a: 0.45, fadeIn: 0.1, fadeOut: 0.5 }));
    // the skylight lets go row by row, then the curtain wall bursts in
    const sky = g.glass.panes.filter(p => p.kind === 'sky' && p.state !== 'gone').sort((a, b) => b.c.z - a.c.z);
    sky.forEach((p, i) => g.fx.later(0.35 + i * 0.045 + rand() * 0.05, () => g.glass.shatter(p, p.c, _v.set(range(-0.2, 0.2), -1, range(-0.2, 0.2)).normalize().clone(), 0.4, { push: 0.8, vel: new THREE.Vector3(0, -1.5, 0), quiet: i % 4 !== 0, max: 22, life: 30 })));
    g.fx.later(0.5, () => g.audio.play('glass_rain', { x: 29, y: 8, z: -104, volume: 1 }));
    const wall = g.glass.panes.filter(p => p.kind === 'lobby' && p.state !== 'gone').sort((a, b) => b.c.z - a.c.z);
    wall.forEach((p, i) => g.fx.later(1.3 + i * 0.035, () => g.glass.shatter(p, p.c, _v.set(1, range(-0.1, 0.25), range(-0.2, 0.2)).normalize().clone(), 1.2, { quiet: i % 5 !== 0, life: 30 })));
    // anyone standing under the skylight
    g.fx.later(1.0, () => {
      const S = LOBBY.sky;
      for (const s of g.soldiers) if (s.alive && s.pos.x > S.x0 && s.pos.x < S.x1 && s.pos.z > S.z0 && s.pos.z < S.z1) g.killSoldier(s, _v.set(0, -1, 0), 1.2, false, 'GLASS RAIN!');
      const h = g.headPos; if (h.x > S.x0 && h.x < S.x1 && h.z > S.z0 && h.z < S.z1) g.hurt(8, h);
    });
    g.events.push({ type: 'lobbyCollapse' });
  }

  // ================================================================== MERIDIAN COLLAPSE
  startCollapse() {
    const g = this.g, M = this.world.meridian;
    if (this.col) return;
    const pivot = M.pivot.clone();
    const H = MERIDIAN.h - MERIDIAN.breakY;
    this.col = { phase: 'groan', t: 0, th: 0, om: 0, sink: 0, sinkV: 0, pivot, pivot0: pivot.clone(), H, flying: [], landed: 0, firstLand: false };
    M.chunks.forEach((c, i) => {
      c.updateMatrixWorld(true);
      const hy = c.position.y, frac = clamp(hy / H, 0, 1);
      c.userData.detach = (lerp(60, 30, frac) + range(-10, 10)) * Math.PI / 180;
      c.userData.idx = i;
    });
    g.audio.play('collapse_rumble', { volume: 1 });
    g.audio.play('metal_groan', { x: 0, y: 40, z: -165, volume: 1 });
    // the finale owns the big-sprite budget: the distant columns stop, the dust gets the headroom
    // the floors above the break leave: their colliders go with them
    for (const b of M.boxes || []) if (b.data.chunk !== undefined || b.data.part === 'upper') g.col.remove(b);
    g.finale = true;
    g.fx.main.bigBudget = Math.round(g.fx.main.bigBudget * 1.9);
    g.events.push({ type: 'collapseStart' });
  }
  _updCollapse(dt) {
    const C = this.col; if (!C) return;
    const g = this.g, M = this.world.meridian;
    C.t += dt;
    if (C.phase === 'groan') {
      // the tower creaks: dust jets out of the hole, windows pop up and down the face
      if (rand() < dt * 8) { const y = range(26, 60), x = range(-18, 18); g.glass.burst(_v.set(x, y, MERIDIAN.z1 + 0.5), _v2.set(0, -0.3, 1), 8, { spread: 1.2, speed: 5, size: 0.4, life: 12 }); this.clouds.spawn({ x, y, z: MERIDIAN.z1 + 2, vz: range(5, 9), vy: range(-1, 1), drag: 1.1, s0: 3, s1: range(10, 16), life: 3.5, a: 0.8, fadeIn: 0.03, fadeOut: 0.5, r: 0.62, g: 0.55, b: 0.46 }); }
      g.lastExplosionT = g.time; g.lastExplosionShake = 0.12 + C.t * 0.08;
      if (C.t > 2.4) {
        C.phase = 'fall'; C.t = 0; C.om = 0.04;
        if (this.wreck) this.wreck.root.visible = false; // the floor it was wedged in just blew out
        if (M.hole) M.hole.visible = false;
        this.holeFire = 0;
        this.megaFireball(new THREE.Vector3(0, MERIDIAN.breakY, MERIDIAN.z1 + 2), 1.1);
        for (let i = 0; i < 36; i++) { const a = rand() * Math.PI; this.rubble.spawn(_v.set(range(-18, 18), MERIDIAN.breakY + range(-3, 3), MERIDIAN.z1 + range(0, 2)), _v2.set(Math.cos(a) * range(3, 9), range(0, 6), Math.sin(a) * range(4, 12)), range(0.6, 2.2)); }
        // the floors at the wound give way all at once
        for (let k = 0; k < 7; k++) g.fx.later(k * 0.09, () => g.fx.explosion(new THREE.Vector3(range(-18, 18), MERIDIAN.breakY + range(-2, 2), lerp(MERIDIAN.z1, MERIDIAN.z0, rand() * 0.4)), range(1.8, 2.6), { noRing: true })); // fresh vectors: fx keeps P for its delayed smoke
        g.audio.play('explosion_big', { x: 0, y: 40, z: -168, volume: 1 });
        g.slowmo(1.6, 0.4, true);
        g.events.push({ type: 'collapseFall' });
      }
      return;
    }
    if (C.phase === 'fall' || C.phase === 'down') {
      // the floors below the break pancake (the lower section sinks into its own dust cloud)
      C.sinkV = Math.min(11, C.sinkV + dt * 4.5);
      if (C.sink < MERIDIAN.breakY * 0.75) { C.sink += C.sinkV * dt; M.lower.position.y = -C.sink; }
      // base dust: a boiling cloud swallowing the plaza
      C.skirtT = (C.skirtT || 0) - dt;
      if (C.skirtT <= 0) {
        // the skirt: a boiling wall of dust rolling out of the base and climbing the stump
        C.skirtT = g.E.isQuest ? 0.16 : 0.09;
        const a = rand() * Math.PI, rr = range(18, 34), up = rand() < 0.4;
        this.clouds.spawn({ x: Math.cos(a) * rr * 1.1, y: up ? range(14, 30) : range(4, 12), z: (MERIDIAN.z0 + MERIDIAN.z1) / 2 + Math.sin(a) * rr, vx: Math.cos(a) * range(4, 10), vy: up ? range(3, 6) : range(1, 3), vz: Math.sin(a) * range(5, 12) + 3, drag: 0.35, buoy: up ? 0.5 : 0.2, s0: range(16, 22), s1: range(46, 70), life: range(9, 12), a: 0.97, fadeIn: 0.04, fadeOut: 0.4, vrot: range(-0.1, 0.1), r: 0.36, g: 0.31, b: 0.25, r1: 0.5, g1: 0.44, b1: 0.36 });
      }
      const nb = Math.min(2, Math.round(dt * 5 + rand()));
      for (let i = 0; i < nb; i++) { const up = rand() < 0.35; g.fx.main.spawn({ x: range(-26, 26), y: up ? range(10, C.pivot.y + 10) : range(1, 10), z: range(MERIDIAN.z1 - 10, MERIDIAN.z1 + 6), vx: range(-7, 7), vy: up ? range(2, 6) : range(1, 4), vz: range(3, 11), drag: 0.45, frameKind: 2, frame: rand() * 40, frames: 16, s0: 12, s1: range(30, 52), ease: 0.55, life: range(7, 10), rot: rand() * 6, vrot: range(-0.15, 0.15), r: up ? 0.48 : 0.36, g: up ? 0.41 : 0.31, b: up ? 0.34 : 0.26, r1: 0.32, g1: 0.28, b1: 0.23, a: 0.97, fadeIn: 0.05, fadeOut: 0.4 }); }
    }
    if (C.phase === 'fall') {
      // the upper section leans down the avenue about the break, riding the sinking stump
      const k = g.trailer ? 0.5 : 0.42;
      C.om += k * Math.sin(C.th + 0.12) * dt;
      C.th += C.om * dt;
      C.pivot.y = C.pivot0.y - C.sink;
      M.upper.position.copy(C.pivot);
      M.upper.rotation.x = C.th;
      M.upper.updateMatrixWorld(true);
      // shed the floors from the top down as it leans
      for (const c of [...M.upper.children]) {
        if (!c.userData.half || c.userData.detach === undefined) continue;
        if (C.th > c.userData.detach) this._detach(c);
      }
      if (C.th > 0.95 || !M.upper.children.some(c => c.userData.half)) {
        for (const c of [...M.upper.children]) if (c.userData.half) this._detach(c);
        C.phase = 'down';
      }
      g.lastExplosionT = g.time; g.lastExplosionShake = 0.2;
      // the break line pours dust and smoke: it wraps the hinge and climbs up the leaning block
      if (rand() < dt * 9) {
        _v.set(range(-20, 20), range(-4, 10), range(-14, 14)).applyAxisAngle(_v2.set(1, 0, 0), C.th * 0.5).add(C.pivot);
        const dark = rand() < 0.35;
        this.clouds.spawn({ x: _v.x, y: _v.y, z: _v.z + 4, vx: range(-3, 3), vy: range(2, 6), vz: range(2, 7), drag: 0.3, buoy: 0.5, s0: range(12, 18), s1: range(40, 60), life: range(8, 11), a: 0.95, fadeIn: 0.05, fadeOut: 0.45, vrot: range(-0.1, 0.1), r: dark ? 0.09 : 0.42, g: dark ? 0.08 : 0.36, b: dark ? 0.07 : 0.29, r1: 0.46, g1: 0.4, b1: 0.33, glow: dark ? 1.0 : 0, glowFade: 3 });
      }
      if (rand() < dt * 6) g.audio.play('metal_groan', { x: 0, y: C.pivot.y + 20, z: -160, volume: 1, pitch: range(0.6, 0.9) });
    }
    // detached floors: ballistic, tumbling, then they hit the canyon floor
    for (const f of C.flying) {
      if (f.rest) { if ((f.sink ?? 0) < 5) { f.sink = (f.sink || 0) + dt * 1.6; f.o.position.y -= dt * 1.6; } continue; } // rubble settles into its own dust
      f.v.y -= 9.8 * dt * 0.85;
      f.o.position.addScaledVector(f.v, dt);
      _q.setFromAxisAngle(_v.copy(f.w).normalize(), f.w.length() * dt); f.o.quaternion.premultiply(_q);
      g.fx.trailEmit(f, f.o.position, 4.0, (q) => {
        // a dust shroud pouring off every edge of the falling floor
        const h = f.o.userData.half;
        _v3.set(range(-h[0], h[0]), range(-h[1], h[1]), range(-h[2], h[2])).applyQuaternion(f.o.quaternion).add(q);
        this.clouds.spawn({ x: _v3.x, y: _v3.y, z: _v3.z, vx: f.v.x * 0.35 + range(-2, 2), vy: f.v.y * 0.25 + range(0, 3), vz: f.v.z * 0.35 + range(-2, 2), drag: 0.6, buoy: 0.3, s0: range(9, 14), s1: range(28, 40), life: range(5, 7), a: 0.93, fadeIn: 0.04, fadeOut: 0.45, vrot: range(-0.15, 0.15), r: 0.44, g: 0.38, b: 0.31, r1: 0.5, g1: 0.44, b1: 0.36 });
      }, 0);
      if (rand() < dt * 10) g.glass.burst(f.o.position, f.v.clone().normalize().multiplyScalar(0.3), 4, { spread: 6, speed: 3, size: 0.5, life: 10 });
      // the slab crumbles as it falls: concrete and facade chunks shed off its edges
      if (rand() < dt * 9) { const h = f.o.userData.half; _v.set(range(-h[0], h[0]), range(-h[1], h[1]), range(-h[2], h[2])).applyQuaternion(f.o.quaternion).add(f.o.position); this.rubble.spawn(_v, _v2.copy(f.v).multiplyScalar(range(0.7, 1)).add(_v3.set(range(-3, 3), range(-1, 2), range(-3, 3))), range(0.5, 1.8)); }
      if (f.o.userData.fire) g.fx.trailEmit(f.fire ||= {}, _v.set(0, f.o.userData.half[1] * 0.6, f.o.userData.half[2] * 0.6).applyQuaternion(f.o.quaternion).add(f.o.position), 3, (q) => { g.fx.flame(q.clone().add(_v2.set(range(-6, 6), 0, range(-6, 6))), f.o.userData.idx >= this.world.meridian.chunks.length - 5 ? 3.4 : 2.2); }, 0);
      // lowest corner
      const h = f.o.userData.half; let lo = 1e9;
      f.o.updateMatrixWorld(true);
      for (let i = 0; i < 8; i++) { _v.set(i & 1 ? h[0] : -h[0], i & 2 ? h[1] : -h[1], i & 4 ? h[2] : -h[2]).applyMatrix4(f.o.matrixWorld); lo = Math.min(lo, _v.y); }
      const gy = 0.15 - f.bury;
      if (lo < gy) {
        f.o.position.y += gy - lo;
        if (!f.hit) this._chunkImpact(f);
        f.hit++;
        f.v.y = Math.abs(f.v.y) * 0.08; f.v.x *= 0.4; f.v.z *= 0.3; f.w.multiplyScalar(0.4);
        f.bury = Math.min(7, f.bury + 2.2);
        if (f.hit > 3 || f.v.lengthSq() < 4) { f.rest = true; this._rubble(f); }
      }
    }
  }
  _detach(c) {
    c.userData.fire = true; // every floor that lets go is burning
    const g = this.g, C = this.col;
    c.updateMatrixWorld(true);
    g.scene.attach(c);
    // rigid-body velocity of the chunk at the moment it lets go, tamed (Bay physics, not a sim)
    _v.subVectors(c.position, C.pivot);
    const v = new THREE.Vector3(0, -_v.z * C.om, _v.y * C.om).add(_v2.set(0, -C.sinkV, 0));
    v.y = clamp(v.y, -14, 2);
    // aim the landing: floors come down along the avenue, the closest one just behind the player
    const tFall = (v.y + Math.sqrt(v.y * v.y + 2 * 8.3 * Math.max(1, c.position.y))) / 8.3;
    const zMax = Math.min(-112, g.headPos.z - 32) - range(0, 14); // centre of a 38 m deep slab: its near edge lands ~13 m behind you
    v.z = clamp(v.z, 3, Math.max(3, (zMax - c.position.z) / tFall)); v.x += range(-1.5, 1.5) + Math.sign(c.position.x) * range(0.5, 2);
    const w = new THREE.Vector3(C.om * range(0.5, 1.9) + range(-0.05, 0.3), range(-0.45, 0.45), range(-0.4, 0.4) + Math.sign(c.position.x) * -0.2);
    // no two floors leave alike: a kick off the axis so the slabs don't fan out like cards
    _e.set(range(-0.12, 0.12), range(-0.2, 0.2), range(-0.14, 0.14)); _q.setFromEuler(_e); c.quaternion.multiply(_q);
    C.flying.push({ o: c, v, w, hit: 0, bury: 0, rest: false });
    for (let i = 0; i < 5; i++) this.clouds.spawn({ x: c.position.x + range(-14, 14), y: c.position.y + range(-4, 4), z: c.position.z + range(-10, 10), vx: range(-2, 2), vy: range(-1, 2), vz: range(0, 4), drag: 0.6, buoy: 0.3, s0: range(8, 12), s1: range(26, 36), life: range(5, 7), a: 0.9, fadeIn: 0.04, fadeOut: 0.5, r: 0.5, g: 0.44, b: 0.36 });
    for (let i = 0; i < 10; i++) g.glass.burst(_v.set(c.position.x + range(-14, 14), c.position.y + range(-4, 4), c.position.z + range(-12, 12)), _v2.set(range(-0.3, 0.3), -0.2, 0.6), 6, { spread: 4, speed: 5, size: 0.5, life: 10 });
  }
  _chunkImpact(f) {
    const g = this.g, C = this.col, P = f.o.position.clone().setY(1);
    C.landed++;
    const dp = g.headPos.distanceTo(P);
    g.lastExplosionT = g.time; g.lastExplosionShake = clamp(2.2 - dp / 60, 0.4, 1.8);
    g.haptic(1, 300);
    g.audio.play('collapse_impact', { x: P.x, y: P.y, z: P.z, volume: 1 });
    g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 0.8, pitch: 0.7 });
    if (chance(0.6)) g.fx.explosion(P.clone().add(_v.set(range(-6, 6), 2, range(-4, 4))), 1.6, { noRing: true });
    // a ring of dust bursting out from under the slab, glass everywhere
    for (let i = 0; i < 14; i++) {
      const a = rand() * 6.28, sp = range(10, 26), up = rand() < 0.35;
      this.clouds.spawn({ x: P.x + Math.cos(a) * 10, y: up ? range(8, 18) : range(3, 7), z: P.z + Math.sin(a) * 12, vx: Math.cos(a) * sp * (up ? 0.4 : 1), vy: up ? range(5, 10) : range(1, 4), vz: Math.sin(a) * sp * (up ? 0.4 : 1) + 4, drag: 0.8, buoy: 0.3, s0: range(14, 20), s1: range(44, 64), life: range(8, 11), a: 0.97, fadeIn: 0.03, fadeOut: 0.4, vrot: range(-0.15, 0.15), r: 0.4, g: 0.35, b: 0.28, r1: 0.5, g1: 0.44, b1: 0.36 });
    }
    for (let i = 0; i < 6; i++) {
      const a = rand() * 6.28, sp = range(8, 24), up = rand() < 0.3;
      g.fx.main.spawn({ x: P.x + Math.cos(a) * 9, y: up ? range(6, 18) : range(1, 6), z: P.z + Math.sin(a) * 9, vx: Math.cos(a) * sp * (up ? 0.4 : 1), vy: up ? range(5, 11) : range(1, 5), vz: Math.sin(a) * sp * (up ? 0.4 : 1) + 4, drag: 0.85, frameKind: 2, frame: rand() * 40, frames: 16, s0: 14, s1: range(34, 56), ease: 0.55, life: range(6, 8), rot: rand() * 6, vrot: range(-0.2, 0.2), r: 0.54, g: 0.47, b: 0.38, r1: 0.42, g1: 0.37, b1: 0.31, a: 0.95, fadeIn: 0.03, fadeOut: 0.4 });
    }
    for (let i = 0; i < 18; i++) g.fx.spawnDebris(P, range(-12, 12), range(6, 18), range(-6, 14), range(0.25, 0.6), chance(0.3));
    for (let i = 0; i < 26; i++) { const a = rand() * 6.28; this.rubble.spawn(_v.set(P.x + range(-9, 9), range(1, 6), P.z + range(-12, 12)), _v2.set(Math.cos(a) * range(4, 14), range(3, 12), Math.sin(a) * range(4, 14) + 3), range(0.5, 2.4)); }
    g.glass.burst(P.clone().setY(4), _v.set(0, 0.6, 0.5), 60, { spread: 9, speed: 9, size: 0.45, life: 12, up: 3 });
    g.glass.blast(P, 26, 1.5);
    // the canyon walls get hit too: shopfronts along the slab burst
    for (const c of g.traffic.cars) if (c.explosive && c.root.position.distanceTo(P) < 16) g.traffic.damage(c, 999, P, 'blast');
    for (const s of g.soldiers) if (s.alive && s.pos.distanceTo(P) < 14) g.killSoldier(s, _v.subVectors(s.pos, P).normalize().clone(), 3, false);
    if (dp < 9) g.hurt(25, P);
    if (!C.firstLand) { C.firstLand = true; this.startDust(P.z + 10); g.events.push({ type: 'firstLand', P }); }
    if (dp < 48 && !C.closeCall) { C.closeCall = true; g.slowmo(2.6, 0.28, true); g.events.push({ type: 'closeCall', P }); }
  }
  _rubble(f) {
    // resting slab becomes cover/blocker (coarse AABB)
    const h = f.o.userData.half, bb = new THREE.Box3();
    f.o.updateMatrixWorld(true);
    for (let i = 0; i < 8; i++) bb.expandByPoint(_v.set(i & 1 ? h[0] : -h[0], i & 2 ? h[1] : -h[1], i & 4 ? h[2] : -h[2]).applyMatrix4(f.o.matrixWorld));
    bb.min.y = Math.max(0, bb.min.y);
    if (bb.max.y > 0.5) this.g.col.add(bb.min.toArray(), bb.max.toArray(), { kind: 'rubble', mat: 'concrete' });
  }

  // beat jumps past the finale: Meridian is down, the avenue is full of dust
  collapsedState() {
    const g = this.g, M = this.world.meridian;
    M.upper.visible = false; M.lower.position.y = -MERIDIAN.breakY * 0.75;
    if (M.hole) M.hole.visible = false;
    if (this.wreck) this.wreck.root.visible = false;
    this.holeFire = 0;
    for (const b of M.boxes || []) if (b.data.chunk !== undefined || b.data.part === 'upper') g.col.remove(b);
    this.col = { phase: 'done', t: 0, flying: [] };
    g.finale = true; g.fx.main.bigBudget = Math.round(g.fx.main.bigBudget * 1.9);
    this.startDust(g.headPos.z - 4);
    // the street is buried in it: settled rubble, the ceiling already overhead
    for (let i = 0; i < 70; i++) this.rubble.spawn(_v.set(range(-15, 15), 0.3, g.headPos.z - range(4, 60)), _v2.set(0, -1, 0), range(0.3, 1.6));
    for (let i = 0; i < 40; i++) this.clouds.spawn({ x: range(-26, 26), y: range(16, 50), z: g.headPos.z + range(-70, 25), vx: range(-1, 1), vz: range(0, 2), drag: 0.2, s0: range(45, 60), s1: range(70, 90), life: range(10, 14), a: 0.75, fadeIn: 0.01, fadeOut: 0.4, vrot: range(-0.04, 0.04), r: 0.42, g: 0.36, b: 0.29 });
    g.fogMix.k = 0.75; g.fogMix.color.setRGB(0.42, 0.36, 0.29); g.fogMix.near = 1; g.fogMix.far = 40;
  }

  // ================================================================== DUST WALL
  startDust(z0) {
    this.dust = { z: Math.min(z0, this.g.headPos.z - 10), v: 15, t: 0, gap: 8, still: 0, inside: false };
    this.g.events.push({ type: 'dustWall' });
  }
  _updDust(dt) {
    const D = this.dust; if (!D) return;
    const g = this.g, head = g.headPos;
    D.t += dt;
    const safe = g.rig.position.y < -1.2 && head.z > SUBWAY.zTop; // down the stairs
    // rubber band: the wall stays just behind you while you run; stop and it takes you
    D.still = (g.playerSpeed || 0) < 1.2 ? D.still + dt : Math.max(0, D.still - dt * 2);
    const gapT = safe ? -30 : D.still > 1.5 ? -6 : (g.trailer ? 7 : 8);
    D.gap = damp(D.gap, gapT, safe ? 0.8 : 1.5, dt);
    D.v = head.z - D.gap - D.z > 25 ? 32 : 18;
    D.z = Math.min(D.z + D.v * dt, head.z - D.gap);
    if (safe) D.z += D.v * dt * 0.6;
    const zf = D.z;
    // the front: a cliff of dust from the asphalt to the 12th floor, filling the canyon wall to wall.
    // Soft lit clouds ride the front (they stay with it however the rubber band moves it); the
    // tallest ones roll over the top so the crest is dark, lumpy and moving.
    const half = zf < CROSS.z1 && zf > CROSS.z0 ? 60 : AVE.half;
    D.wallT = (D.wallT || 0) - dt;
    const quest = g.E.isQuest;
    while (D.wallT <= 0) {
      D.wallT += (quest ? 0.075 : 0.045) * (half > AVE.half ? 0.7 : 1);
      const row = rand(), y = row < 0.45 ? range(2, 9) : row < 0.8 ? range(9, 22) : range(22, 40);
      const top = y > 20, s0 = top ? range(16, 22) : range(12, 18);
      const shade = clamp(y / 40, 0, 1), k = range(0.94, 1.06);
      this.clouds.spawn({ x: range(-half - 4, half + 4), y, z: zf, ride: D, oz: range(-3, 2), vx: range(-1.5, 1.5) + (half > AVE.half ? range(-4, 4) : 0), vy: top ? range(1.5, 4) : range(0.3, 2), vz: -range(2, 6), drag: 0.15, buoy: top ? 0.6 : 0.1, s0, s1: s0 * range(1.8, 2.4), life: range(2.6, 3.4), a: 0.98, fadeIn: 0.08, fadeOut: 0.35, vrot: range(-0.35, 0.35), r: lerp(0.36, 0.44, shade) * k, g: lerp(0.31, 0.38, shade) * k, b: lerp(0.25, 0.3, shade) * k });
    }
    // the crest curls over you: the top of the wall outruns its foot and rolls overhead, then pours
    // down into the subway mouth behind you
    if (head.z - zf < 14 && !D.inside) {
      D.overT = (D.overT || 0) - dt;
      while (D.overT <= 0) {
        D.overT += quest ? 0.18 : 0.11;
        const s0 = range(14, 20);
        this.clouds.spawn({ x: head.x + range(-14, 14), y: range(13, 28), z: zf + range(-2, 3), vx: range(-2, 2), vy: -range(0.5, 2.5), vz: D.v + range(7, 13), drag: 0.25, s0, s1: s0 * range(2, 2.6), life: range(2.6, 3.4), a: 0.96, fadeIn: 0.1, fadeOut: 0.35, vrot: range(-0.3, 0.3), r: 0.5, g: 0.43, b: 0.35, r1: 0.47, g1: 0.41, b1: 0.33 });
      }
    }
    if (safe && D.t - (D.pourT || 0) > (quest ? 0.2 : 0.12)) {
      D.pourT = D.t;
      this.clouds.spawn({ x: range(SUBWAY.x0 - 1, SUBWAY.x1 + 1), y: range(2, 5), z: SUBWAY.zTop + range(-4, 0), vx: range(-0.5, 0.5), vy: -range(1, 2.5), vz: range(3, 6), drag: 0.6, s0: range(3, 5), s1: range(9, 13), life: range(2.2, 3), a: 0.9, fadeIn: 0.1, fadeOut: 0.4, vrot: range(-0.4, 0.4), r: 0.44, g: 0.38, b: 0.31 });
    }
    // the leading edge: dense small puffs right at the front (big sprites fade near the eye; these don't)
    const ne = Math.min(18, Math.round(dt * 110 + rand()));
    for (let i = 0; i < ne; i++) {
      const y = Math.pow(rand(), 1.6) * 16, top = y > 7;
      g.fx.main.spawn({ x: range(-half, half), y, z: zf + range(-1, 3), vx: range(-2, 2), vy: range(-0.5, 2.5), vz: D.v * range(0.8, 1.1), drag: 0.6, frameKind: 2, frame: rand() * 40, frames: 16, s0: 2, s1: range(4, 5), ease: 0.5, life: range(1.6, 2.6), rot: rand() * 6, vrot: range(-1, 1), r: top ? 0.66 : 0.34, g: top ? 0.56 : 0.29, b: top ? 0.44 : 0.23, a: 0.95, fadeIn: 0.02, fadeOut: 0.4 });
    }
    // debris and paper riding the front
    if (rand() < dt * 60) g.fx.sparks.spawn({ x: range(-half, half), y: range(0.3, 8), z: zf + range(1, 7), vx: range(-2, 2), vy: range(-1, 3), vz: D.v * range(0.9, 1.3), grav: -2, drag: 0.6, frame: CELL.CHIP, s0: 1, w: range(0.05, 0.12), len: 0.15, life: 1.5, r: 0.85, g: 0.82, b: 0.75, a: 0.9, fadeOut: 0.4 });
    // you, inside it: brown-out, choking, glass ticking off everything
    const dz = head.z - zf;
    g.sunBlock = damp(g.sunBlock || 0, 1 - THREE.MathUtils.smoothstep(dz, 8, 45), 3, dt);
    const k = THREE.MathUtils.smoothstep(-dz, -1, 5);
    g.fogMix.k = Math.max(g.fogMix.k * Math.exp(-dt * 0.2), k * (safe ? 0.85 : 1));
    g.fogMix.color.setRGB(0.42, 0.36, 0.29); g.fogMix.near = 1; g.fogMix.far = safe ? 30 : 26;
    if (dz < -1 && !safe) { D.inside = true; if (rand() < dt * 2) g.hurt(3, head); }
    if (dz < 0 || safe) {
      D.ceilT = (D.ceilT || 0) - dt;
      if (D.ceilT <= 0) { D.ceilT = 0.2; this.clouds.spawn({ x: range(-26, 26), y: range(18, 50), z: Math.min(zf - 6, head.z + range(-40, 20)), vx: range(-1, 1), vy: range(-0.2, 0.6), vz: range(0, 2), drag: 0.2, s0: range(45, 60), s1: range(70, 90), life: range(10, 14), a: 0.75, fadeIn: 0.15, fadeOut: 0.4, vrot: range(-0.04, 0.04), r: 0.42, g: 0.36, b: 0.29 }); }
      if (rand() < dt * 30) g.fx.sparks.spawn({ x: head.x + range(-8, 8), y: head.y + range(2, 6), z: head.z + range(-8, 8), vx: range(-0.3, 0.3), vy: range(-1.2, -0.5), vz: range(-0.3, 0.3), grav: -0.4, drag: 0.4, frame: CELL.CHIP, s0: 1, w: 0.02, len: 0.03, life: 4, r: 0.8, g: 0.75, b: 0.65, a: 0.8, fadeOut: 0.4 });
    }
    g.audio.setLoop('dust_roar', { x: head.x, y: 6, z: zf, volume: clamp(1.2 - dz / 60, 0.2, 1) });
    if (!safe) g.bossInfo = { frac: clamp((dz) / 30, 0, 1), name: 'DUST WALL  —  ' + Math.max(0, dz).toFixed(0) + ' m' };
    else if (g.bossInfo?.name?.startsWith('DUST')) g.bossInfo = null;
  }
}
