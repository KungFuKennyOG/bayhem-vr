import * as THREE from 'three';
import { rand, range, chance, clamp, lerp, damp, pick } from '../../rng.js';
import { Gunman, Ragdoll } from '../../characters.js';
import { buildHeli } from '../../heli.js';
import { CollisionWorld } from '../../collision.js';
import { RigidBox } from '../../physics.js';
import { CELL } from '../../particles.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHammer, heliMaterials } from './helimodel.js';
import { HERO } from './layout.js';

// =====================================================================================
//  SAND CASTLES — combat. The player is a door gunner on a rail; everything shoots up at you
//  from the roofs: rifle squads (tracers, near-miss whizz, hits spark on the airframe), RPG
//  teams (smoke-trailed rockets that mostly miss by a few metres, shoot them down), rooftop
//  AA guns (tracer streams + flak bursts round the cabin), and WIDOWMAKER 4, the gunship that
//  duels you through the haboob. HAMMER TWO, the wingman, flies with you until the boulevard.
//  Hit tests: gunmen are generous spheres (they're 100–250 m away), towers are boxes in their
//  own frame, the ground is y = 0. Nobody dies in this level: at 0 HP the pilot pulls you out.
// =====================================================================================

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
let SEED = 11;

function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r, h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : (-b + Math.sqrt(h) > 0 ? 0.01 : -1);
}
function rayOBB(origin, dir, matWorld, half, outNormal) {
  _inv.copy(matWorld).invert();
  _ro.copy(origin).applyMatrix4(_inv); _rd.copy(dir).transformDirection(_inv);
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
  if (outNormal) { outNormal.set(0, 0, 0); if (axis >= 0) outNormal.setComponent(axis, sign); }
  return tmin > 0 ? tmin : tmax;
}

export class SandGame {
  constructor(E, F, W) {
    Object.assign(this, { E, F, W, scene: E.scene, fx: E.fx, hud: E.hud, audio: E.audio, camera: E.camera, rig: E.rig, params: E.params });
    this.time = 0; this.timeScale = 1; this.slowT = 0; this.slowScale = 1; this.slowCool = 0; this.allowSlowmo = F.slowmo;
    this.hp = 100; this.hurtT = 9; this.hurtFlash = 0; this.score = 0; this.combo = 0; this.comboT = 0;
    this.kills = 0; this.headshots = 0; this.rpgsDown = 0; this.towersDown = 0; this.aaDown = 0;
    this.headPos = new THREE.Vector3();
    this.lastExplosionT = -1; this.lastExplosionShake = 0.8;
    this.events = [];
    this.men = []; this.rockets = []; this.nades = []; this.ragdolls = []; this.aas = []; this.flak = [];
    this.gunship = null; this.bossInfo = null;
    this.dmgMul = 1; this.enemyAcc = 1;
    this.onHaptic = () => {};
    this.fx.onSound = (name, P) => this.audio.play(name, P ? { x: P.x, y: P.y, z: P.z } : {});
    // roofs for the ragdolls (bodies land on the fight towers' roofs, or go over the edge)
    this.col = new CollisionWorld({ cell: 24, minX: -2300, minZ: -2400, maxX: 2000, maxZ: 1400, floor: 0 });
    for (const t of W.plan.towers) if (t.role === 'fight') { const hw = (t.kind === 'round' || t.kind === 'tri' ? 0.34 : 0.5) * Math.min(t.w, t.d); this.col.add([t.x - hw, 0, t.z - hw], [t.x + hw, t.h, t.z + hw], { kind: 'roof' }); }
    Ragdoll.world = this.col;
    this.towerList = W.plan.towers;
    this.wing = null;
  }

  // ------------------------------------------------------------------ HUD + helpers
  get boss() { const g = this.gunship; return g && g.phase === 'fight' ? { frac: g.hp / g.maxHp, name: 'GUNSHIP  "WIDOWMAKER 4"' } : null; }
  get heliPos() { return this.W.rail.pos; }
  addScore(n, label, pos, style) {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1; this.comboT = 3.5;
    const mult = Math.min(5, this.combo); this.score += n * mult;
    if (label && !this.quietScore) this.hud.callout(label, pos, style || 'big', mult > 1 ? `+${n * mult}  x${mult}` : `+${n}`);
  }
  hitMarker(big) { this.hud.hitMarker(big); this.audio.play('hit_marker', { volume: big ? 1 : 0.6 }); }
  haptic(i, ms) { this.onHaptic(i, ms); }
  slowmoReq(dur, scale, force = false) {
    if (!this.allowSlowmo || (!force && this.slowCool > 0)) return;
    if (this.slowT <= 0) this.audio.play('slowmo_in', {});
    this.slowT = Math.max(this.slowT, dur); this.slowScale = scale; this.slowCool = dur + 4;
  }
  hurt(amount, from) {
    if (this.params.has('trailer') || this.params.has('god')) amount *= 0.2;
    this.hp -= amount; this.hurtT = 0; this.hurtFlash = Math.min(1, this.hurtFlash + amount / 25);
    this.audio.play('player_hurt', { volume: Math.min(1, amount / 18) });
    this.haptic(0.8, 90);
    if (this.hp <= 0 && !this.downed) {
      this.downed = true; this.hp = 1;
      this.slowmoReq(1.6, 0.3, true);
      this.hud.subtitle('DRIVER', "Stay on that gun! I'm not flying home alone!", 3);
      this.fx.later(1.6, () => { this.hp = 100; this.downed = false; });
    }
  }
  // a squad left behind: gone without a body (the heli has moved on)
  dropSquad(list) { for (const m of list) if (m.alive) { m.alive = false; m.gm.dispose(); } this.men = this.men.filter(m => m.alive || !list.includes(m)); }
  enemiesAlive(f = null) { return this.men.filter(m => m.alive && (!f || f(m))).length; }

  // ------------------------------------------------------------------ towers as hit boxes
  // returns { t, tower, n } for the first tower face the ray hits (skips fallen / falling towers)
  towerRay(o, d, maxT = 3000) {
    let best = null;
    for (const T of this.towerList) {
      if (T.gone) continue;
      const h = T.hNow ?? T.h;
      // quick reject: distance from the ray to the tower axis in xz
      const ox = T.x - o.x, oz = T.z - o.z, dl = Math.hypot(d.x, d.z) || 1e-6;
      const along = (ox * d.x + oz * d.z) / (dl * dl);
      if (along < -60 || along > maxT) continue;
      const px = o.x + d.x * along - T.x, pz = o.z + d.z * along - T.z, R = Math.hypot(T.w, T.d) * 0.5;
      if (px * px + pz * pz > R * R * 1.1) continue;
      // slab test in the tower's frame
      const c = Math.cos(-(T.rot || 0)), s = Math.sin(-(T.rot || 0));
      const lx = (o.x - T.x) * c + (o.z - T.z) * s, lz = -(o.x - T.x) * s + (o.z - T.z) * c;
      const dx = d.x * c + d.z * s, dz = -d.x * s + d.z * c;
      const k = T.kind === 'round' || T.kind === 'tri' || T.kind === 'twist' ? 0.42 : 0.5;
      const hx = T.w * k, hz = (T.kind === 'round' || T.kind === 'tri' ? T.w : T.d) * k;
      let t0 = 0, t1 = maxT, ax = -1;
      for (const [oo, dd, lo, hi, a] of [[lx, dx, -hx, hx, 0], [o.y, d.y, 0, h, 1], [lz, dz, -hz, hz, 2]]) {
        if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) { t0 = 1e9; break; } continue; }
        let ta = (lo - oo) / dd, tb = (hi - oo) / dd; if (ta > tb) { const q = ta; ta = tb; tb = q; }
        if (ta > t0) { t0 = ta; ax = a; } if (tb < t1) t1 = tb;
        if (t0 > t1) { t0 = 1e9; break; }
      }
      if (t0 < 1e8 && t0 > 0 && (!best || t0 < best.t)) {
        const n = new THREE.Vector3();
        if (ax === 1) n.set(0, 1, 0); else { const sg = ax === 0 ? -Math.sign(dx) : -Math.sign(dz); const lnx = ax === 0 ? sg : 0, lnz = ax === 2 ? sg : 0; n.set(lnx * c - lnz * s, 0, lnx * s + lnz * c); }
        best = { t: t0, tower: T, n };
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ player fire
  fireRay(origin, dir) {
    let best = { t: 2500, kind: 'none' };
    for (const m of this.men) {
      if (!m.alive || m.delay > 0) continue;
      const dist = m.pos.distanceTo(origin);
      m.gm.headCenter.getWorldPosition(_v);
      let t = raySphere(origin, dir, _v, 0.2 + dist * 0.0012);
      if (t > 0 && t < best.t) best = { t, kind: 'head', m };
      m.gm.chestCenter.getWorldPosition(_v);
      t = raySphere(origin, dir, _v, 0.42 + dist * 0.004);
      if (t > 0 && t < best.t) best = { t, kind: 'body', m };
    }
    for (const r of this.rockets) { if (r.dead) continue; const t = raySphere(origin, dir, r.pos, 2.2 + r.pos.distanceTo(origin) * 0.006); if (t > 0 && t < best.t) best = { t, kind: 'rocket', r }; }
    for (const a of this.aas) { if (!a.alive) continue; const t = raySphere(origin, dir, a.center, 3.2); if (t > 0 && t < best.t) best = { t, kind: 'aa', a }; }
    const g = this.gunship;
    if (g && g.phase !== 'gone' && g.phase !== 'enter') { const n = new THREE.Vector3(); g.m.root.updateMatrixWorld(); _m.compose(g.pos, g.m.root.quaternion, _v2.set(1.6, 1.6, 1.6)); const t = rayOBB(origin, dir, _m.multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0.6)), _v3.set(2.4, 1.6, 6.5), n); if (t > 0 && t < best.t) best = { t, kind: 'gunship', n: n.clone() }; }
    const tw = this.towerRay(origin, dir, best.t);
    if (tw && tw.t < best.t) best = { t: tw.t, kind: 'tower', tower: tw.tower, n: tw.n };
    if (dir.y < 0) { const t = -origin.y / dir.y; if (t < best.t) best = { t, kind: 'ground' }; }
    best.point = origin.clone().addScaledVector(dir, best.t);
    return best;
  }
  playerShot(origin, dir) {
    const hit = this.fireRay(origin, dir);
    const P = hit.point, dist = hit.t;
    // tracers every round, fattened with range so they read at 200 m
    this.fx.tracer(origin, P, { speed: 700, width: 0.06 + Math.min(0.45, dist * 0.0016), len: 5 + dist * 0.012, color: [2.0, 0.75, 0.25] });
    switch (hit.kind) {
      case 'head': case 'body': {
        const m = hit.m;
        m.hp -= hit.kind === 'head' ? 99 : 36 * this.dmgMul;
        this.fx.impact(P, _v.copy(dir).negate(), 'body');
        this.hitMarker(hit.kind === 'head');
        if (m.hp <= 0) this.killMan(m, dir, hit.kind === 'head'); else m.gm.hit(dir);
        break;
      }
      case 'rocket': { this.explodeRocket(hit.r, null); this.rpgsDown++; this.addScore(250, 'ROCKET DOWN', hit.r.pos.clone(), 'big'); this.hitMarker(true); break; }
      case 'aa': { const a = hit.a; a.hp -= 2 * this.dmgMul; this.fx.impact(P, _v.copy(dir).negate(), 'metal'); this.hitMarker(false); if (a.hp <= 0) this.killAA(a, 'gun'); break; }
      case 'gunship': {
        const g = this.gunship;
        this.fx.impact(P, _v.copy(dir).negate(), 'metal');
        if (g.phase === 'fight') { g.hp -= 1.15 * this.dmgMul; g.hit = 1; this.hitMarker(false); if (g.hp <= 0) this.killGunship(); }
        break;
      }
      case 'tower': {
        // facade hits: a spark + a puff of dust / glass, an occasional glint shower
        this.fx.impact(P, hit.n, rand() < 0.5 ? 'glass' : 'concrete');
        break;
      }
      case 'ground': this.fx.impact(P, _v.set(0, 1, 0), 'ground'); break;
    }
    // suppressive splash: rounds landing round a gunman still put him down
    if (hit.kind !== 'head' && hit.kind !== 'body') for (const m of this.men) {
      if (!m.alive || m.delay > 0) continue;
      const d = m.pos.distanceTo(P);
      if (d < 2.2) { m.hp -= 22 * (1 - d / 2.2) + 6; if (m.hp <= 0) this.killMan(m, dir, false); else m.suppress = 1.2; }
    }
    return hit;
  }
  launchGrenade(origin, dir) { this.nades.push({ pos: origin.clone(), vel: dir.clone().multiplyScalar(80), t: 0 }); }

  killMan(m, dir, head) {
    if (!m.alive) return;
    m.alive = false; this.kills++; if (head) this.headshots++;
    this.audio.play('kill_confirm', {});
    m.gm.chestCenter.getWorldPosition(_v);
    this.addScore(m.role === 'rpg' ? 200 : head ? 150 : 100, m.role === 'rpg' ? 'RPG DOWN' : head ? 'HEADSHOT' : null, _v.clone().setY(_v.y + 2), 'small');
    // over the edge sometimes: Bay physics
    const out = _v2.subVectors(m.pos, m.tower ? _v3.set(m.tower.x, m.pos.y, m.tower.z) : m.pos).normalize();
    const imp = dir.clone().multiplyScalar(0.6).add(out.multiplyScalar(0.5)).normalize();
    const rd = m.gm.die(new THREE.Vector3(), imp, this.scene, head ? 1.3 : 1.1);
    this.ragdolls.push({ rd, t: 0 });
    if (this.ragdolls.length > 10) { const o = this.ragdolls.shift(); o.rd.dispose(); }
    this.events.push({ type: 'kill', m });
  }

  // ------------------------------------------------------------------ enemies
  // a squad on a fight tower's roof: men stand round the edge on the route side
  spawnRoof(tower, n, rpg, opts = {}) {
    const out = [];
    const inner = this.W.city.roofs.get(tower)?.inner ?? Math.min(tower.w, tower.d) * 0.8;
    for (let i = 0; i < n; i++) {
      const role = i < rpg ? 'rpg' : 'rifle';
      const gm = new Gunman({ pose: 'ground', seed: SEED++, outfit: 'port' });
      gm.root.scale.setScalar(2.0); // ~100 m below the door: bigger reads in VR, and nobody can tell from up here
      this.scene.add(gm.root);
      const a = (i / Math.max(1, n)) * Math.PI * 1.3 + range(-0.2, 0.2);
      const m = { gm, role, tower, alive: true, hp: 70, delay: (opts.delay ?? 0) + i * 0.6, a, r: inner * 0.42, pos: new THREE.Vector3(), fireT: range(1.2, 3.5), burst: 0, suppress: 0, rpgT: role === 'rpg' ? range(2.5, 5) : 99, crouch: rand() < 0.4 };
      this._placeMan(m);
      gm.root.visible = m.delay <= 0;
      this.men.push(m); out.push(m);
    }
    return out;
  }
  _placeMan(m) {
    const T = m.tower, H = this.heliPos;
    // the side of the roof facing the heli's path, spread round that edge
    const base = Math.atan2(H.z - T.z, H.x - T.x);
    const ang = base + (m.a - 0.65);
    m.pos.set(T.x + Math.cos(ang) * m.r, T.h, T.z + Math.sin(ang) * m.r);
    m.gm.root.position.copy(m.pos);
  }
  _updateMen(dt) {
    const H = this.heliPos;
    for (const m of this.men) {
      if (!m.alive) continue;
      if (m.delay > 0) { if (m.pos.distanceTo(H) < 480) m.delay -= dt; if (m.delay <= 0) { m.gm.root.visible = true; this._placeMan(m); } continue; }
      const gm = m.gm;
      const dx = H.x - m.pos.x, dz = H.z - m.pos.z, dist = Math.hypot(dx, dz, H.y - m.pos.y);
      gm.root.rotation.y = Math.atan2(-dx, -dz);
      gm.setMove(0, 0);
      m.suppress = Math.max(0, m.suppress - dt);
      gm.setCrouch(m.suppress > 0 ? 1 : m.crouch ? 0.6 : 0);
      _v.set(H.x + range(-1, 1), H.y + 1.2, H.z);
      gm.update(dt, _v);
      if (dist > 520) continue;
      // rifle: bursts
      m.fireT -= dt;
      if (m.role === 'rifle' && m.fireT <= 0 && m.suppress <= 0 && !this.ceasefire) {
        if (m.burst <= 0) m.burst = 3 + Math.floor(rand() * 4);
        if (gm.fire()) this.enemyShot(m, dist);
        m.burst--; m.fireT = m.burst > 0 ? 0.11 : range(1.4, 2.8);
      }
      if (m.role === 'rpg') {
        m.rpgT -= dt;
        if (m.rpgT <= 0 && !this.ceasefire && m.suppress <= 0) { m.rpgT = range(6, 9); this.fireRocket(m.gm.muzzle.getWorldPosition(new THREE.Vector3()), 'rpg'); }
      }
    }
  }
  enemyShot(m, dist) {
    const H = this.heliPos, mz = m.gm.muzzle.getWorldPosition(new THREE.Vector3());
    const pHit = clamp(0.06 - dist / 5000, 0.015, 0.06) * this.enemyAcc;
    const hit = rand() < pHit;
    // a miss passes close to the door: that's the point (tracers you can see go by)
    const aim = _v.copy(this.headPos).add(_v2.set(range(-1, 1), range(-0.6, 0.8), range(-1, 1)).multiplyScalar(hit ? 0.4 : range(2.5, 7)));
    const to = aim.clone().addScaledVector(_v2.subVectors(aim, mz).normalize(), hit ? 0 : 40);
    this.fx.tracer(mz, to, { speed: 480, width: 0.06 + dist * 0.001, len: 6, color: [1.6, 0.55, 0.25] });
    this.fx.muzzle(mz, _v2.subVectors(aim, mz).normalize(), 'rifle', false);
    this.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, volume: 0.9 });
    if (hit) {
      this.hurt(range(3, 6), mz);
      // the round sparks off the door frame / the airframe beside you
      _v3.set(range(-0.3, 0.3), range(0.4, 1.9), range(-1.2, 1.0));
      const C = this.W.cabin.root; const p = new THREE.Vector3(-1.25, _v3.y, _v3.z).applyMatrix4(C.matrixWorld);
      this.fx.impact(p, _v2.subVectors(mz, p).normalize(), 'metal');
      this.audio.play('impact_metal', { x: p.x, y: p.y, z: p.z, volume: 0.8 });
    } else if (rand() < 0.35) this.audio.play('whiz', { x: aim.x, y: aim.y, z: aim.z, volume: 0.8 });
  }
  fireRocket(from, src, aimErr = null) {
    const H = this.heliPos, vH = _v2.copy(this.W.rail.vel || _v2.set(0, 0, 0));
    const speed = src === 'gunship' ? 85 : 62;
    const tFly = from.distanceTo(H) / speed;
    // aim: lead the heli; most rockets miss by a few metres (you hear and see them go past)
    const miss = aimErr ?? (rand() < 0.3 * this.enemyAcc ? 0.5 : range(6, 14));
    const tgt = H.clone().addScaledVector(vH, tFly).add(_v3.set(range(-1, 1), range(-0.3, 0.6), range(-1, 1)).normalize().multiplyScalar(miss));
    const vel = tgt.sub(from).normalize().multiplyScalar(speed);
    const r = { pos: from.clone(), vel, life: 9, dead: false, src, id: (this._rid = (this._rid || 0) + 1), close: false };
    this.rockets.push(r);
    this.audio.play('rocket_launch', { x: from.x, y: from.y, z: from.z, volume: 0.9 });
    this.fx.smoke(from.clone(), 2.5, 0.6, 3, 1, 0.6);
    this.events.push({ type: 'rpg', r });
    return r;
  }
  explodeRocket(r, onHeli) {
    if (r.dead) return;
    r.dead = true;
    this.audio.stopLoop('rocket:' + r.id);
    this.fx.explosion(r.pos.clone(), onHeli ? 0.9 : 1.1, { noRing: true });
    this.lastExplosionT = this.time; this.lastExplosionShake = onHeli ? 1.2 : 0.4;
    if (onHeli) { this.hurt(20, r.pos); this.haptic(1, 220); this.events.push({ type: 'heliHit' }); this.W.cabin.U.uWarn.value = 1; this.audio.play('warn_tone', {}); this.fx.later(3, () => { this.W.cabin.U.uWarn.value = 0; }); }
  }
  _updateRockets(dt) {
    const H = this.heliPos;
    for (const r of this.rockets) {
      if (r.dead) continue;
      r.life -= dt;
      r.pos.addScaledVector(r.vel, dt);
      this.fx.trailEmit(r, r.pos, 1.6, (q) => this.fx.smoke(q, 1.3, 0.55, 2.6, 0.6, 0.55), 0);
      this.audio.setLoop('rocket:' + r.id, { x: r.pos.x, y: r.pos.y, z: r.pos.z, volume: 0.8 });
      const d = r.pos.distanceTo(H);
      if (d < 4.2) { this.explodeRocket(r, true); continue; }
      if (d < 18 && !r.close) { r.close = true; this.audio.play('whiz', { x: r.pos.x, y: r.pos.y, z: r.pos.z, volume: 1, pitch: 0.6 }); this.events.push({ type: 'nearMiss' }); }
      if (r.pos.y < 0.5 || r.life <= 0) { this.explodeRocket(r, false); continue; }
      // into a tower face
      const tw = this.towerRay(r.pos, _v.copy(r.vel).normalize(), r.vel.length() * dt + 0.5);
      if (tw) { this.explodeRocket(r, false); }
    }
    this.rockets = this.rockets.filter(r => !r.dead);
  }
  _updateNades(dt) {
    for (const n of this.nades) {
      n.vel.y -= 9.8 * dt; const step = n.vel.length() * dt;
      const dir = _v.copy(n.vel).normalize();
      const tw = this.towerRay(n.pos, dir, step + 0.3);
      n.pos.addScaledVector(n.vel, dt); n.t += dt;
      this.fx.trailEmit(n, n.pos, 0.8, (q) => this.fx.smoke(q, 0.6, 0.6, 1.4, 0.4, 0.45), 0);
      const g = this.gunship;
      const nearG = g && g.phase === 'fight' && n.pos.distanceTo(g.pos) < 9;
      if (tw || n.pos.y < 0.3 || n.t > 9 || nearG || this.men.some(m => m.alive && m.delay <= 0 && m.pos.distanceTo(n.pos) < 2.5)) {
        n.dead = true;
        const P = n.pos.clone(); if (P.y < 0.5) P.y = 0.5;
        this.fx.explosion(P, 1.25);
        this.lastExplosionT = this.time; this.lastExplosionShake = 0.2;
        for (const m of this.men) if (m.alive && m.delay <= 0 && m.pos.distanceTo(P) < 9) this.killMan(m, _v2.subVectors(m.pos, P).setY(2).normalize(), false);
        for (const a of this.aas) if (a.alive && a.center.distanceTo(P) < 10) { a.hp -= 40; if (a.hp <= 0) this.killAA(a, 'nade'); }
        if (g && g.phase === 'fight' && g.pos.distanceTo(P) < 14) { g.hp -= 45; g.hit = 1; this.hitMarker(true); if (g.hp <= 0) this.killGunship(); }
      }
    }
    this.nades = this.nades.filter(n => !n.dead);
  }
  // bodies: simulated for a few seconds, then gone (each is a skinned mesh: they add up fast)
  _updateBodies(dt) {
    for (const r of this.ragdolls) {
      r.t += dt;
      if (r.t < 9) r.rd.update(dt, 0);
      if (!r.gone && (r.t > 9 || (r.t > 3 && r.rd.position && r.rd.position.distanceTo(this.headPos) > 650))) { r.gone = true; r.rd.dispose(); }
    }
    this.ragdolls = this.ragdolls.filter(r => !r.gone);
  }

  // ------------------------------------------------------------------ rooftop AA (the strike targets)
  addAA(tower) {
    const g = buildAAGun();
    g.position.set(tower.x, tower.h, tower.z);
    this.scene.add(g);
    const a = { tower, root: g, gun: g.getObjectByName('aaGun'), alive: true, hp: 60, fireT: range(0.5, 2), flakT: range(1, 3), center: new THREE.Vector3(tower.x, tower.h + 2, tower.z), active: false };
    this.aas.push(a);
    return a;
  }
  killAA(a, how) {
    if (!a.alive) return;
    a.alive = false; this.aaDown++;
    this.fx.explosion(a.center.clone(), 1.6);
    this.fx.later(0.25, () => this.fx.explosion(a.center.clone().add(_v.set(range(-3, 3), 2, range(-3, 3))), 1.2, { noRing: true }));
    a.root.visible = false;
    this.lastExplosionT = this.time;
    if (how !== 'strike') this.addScore(400, 'AA DOWN', a.center.clone().setY(a.center.y + 6), 'big');
    this.events.push({ type: 'aaDown', a, how });
  }
  _updateAA(dt) {
    const H = this.heliPos;
    for (const a of this.aas) {
      if (!a.alive || !a.active) continue;
      // traverse toward the heli, fire streams of tracers into the sky ahead of it
      const dx = H.x - a.center.x, dz = H.z - a.center.z, dy = H.y - a.center.y;
      a.gun.rotation.y = Math.atan2(-dx, -dz);
      a.gun.children[0].rotation.x = Math.atan2(dy, Math.hypot(dx, dz));
      a.fireT -= dt;
      if (a.fireT <= 0 && !this.ceasefire) {
        a.fireT = 0.2; a.burst = (a.burst ?? 0) + 1;
        if (a.burst > 6) { a.burst = 0; a.fireT = range(1.2, 2.4); }
        const mz = a.center.clone().add(_v.set(0, 1.6, 0));
        const aim = H.clone().add(_v2.set(range(-30, 30), range(8, 60), range(-30, 30)));
        this.fx.tracer(mz, aim.clone().addScaledVector(_v3.subVectors(aim, mz).normalize(), 200), { speed: 520, width: 0.7, len: 34, color: [2.0, 0.6, 0.18] });
        if (a.burst % 3 === 0) this.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, volume: 1, pitch: 0.55 });
      }
      a.flakT -= dt;
      if (a.flakT <= 0 && !this.ceasefire) {
        a.flakT = range(0.8, 1.6);
        const near = rand() < 0.18 * this.enemyAcc;
        const P = H.clone().add(_v.set(range(-1, 1), range(0.1, 0.9), range(-1, 1)).normalize().multiplyScalar(near ? range(8, 14) : range(22, 70)));
        this.flakBurst(P, near);
      }
    }
  }
  flakBurst(P, near) {
    this.fx.light(P, 300, 0.12, 0xffa050, false, 120);
    for (let i = 0; i < 4; i++) this.fx.main.spawn({ x: P.x + range(-1, 1), y: P.y + range(-1, 1), z: P.z + range(-1, 1), vx: range(-2, 2), vy: range(-1, 1), vz: range(-2, 2), frame: CELL.DUST, s0: 3, s1: 9, life: 4, rot: rand() * 6, r: 0.06, g: 0.055, b: 0.05, a: 0.85, fadeOut: 0.5 });
    this.fx.main.spawn({ x: P.x, y: P.y, z: P.z, frame: CELL.FLASH, s0: 6, s1: 10, life: 0.12, r: 2.4, g: 1.3, b: 0.5, a: 1 });
    this.audio.play('explosion_small', { x: P.x, y: P.y, z: P.z, volume: near ? 1 : 0.7 });
    if (near) { this.hurt(6, P); this.lastExplosionT = this.time; this.lastExplosionShake = 0.5; }
  }

  // ------------------------------------------------------------------ WIDOWMAKER 4
  spawnGunship() {
    const m = buildHeli();
    m.root.scale.setScalar(1.6);
    this.scene.add(m.root);
    const H = this.heliPos, f = this._frame();
    const pos = H.clone().addScaledVector(f.fwd, 420).addScaledVector(f.left, 260).add(_v.set(0, 40, 0));
    this.gunship = { m, pos, vel: new THREE.Vector3(), hp: 260, maxHp: 260, phase: 'enter', t: 0, gunT: 3, rocketT: 6, burst: 0, hit: 0, yaw: 0, spin: 0, off: new THREE.Vector3(140, 30, 160), offT: 0 };
    this.audio.musicStinger?.('boss');
    return this.gunship;
  }
  _frame() {
    const rail = this.W.rail, y = rail.pathYaw(rail.s + 40);
    return { fwd: new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y)), left: new THREE.Vector3(-Math.cos(y), 0, Math.sin(y)) };
  }
  // a set-piece callout toward P but no further than 60 m (past that the storm / haze washes it out)
  calloutAt(P) { const h = this.headPos, d = P.distanceTo(h), Q = h.clone().lerp(P, Math.min(1, 60 / Math.max(1, d))); Q.y = clamp(Q.y, h.y - 8, h.y + 6); return Q; }
  killGunship() {
    const g = this.gunship; if (!g || g.phase === 'dying' || g.phase === 'gone') return;
    g.phase = 'dying'; g.t = 0; g.spin = 0.6;
    g.m.breakTail?.();
    g.m.setDamage?.(0.9);
    this.fx.explosion(g.pos.clone(), 1.5, { noRing: true });
    this.slowmoReq(2.4, 0.25, true);
    this.addScore(5000, 'BIRD DOWN!', this.calloutAt(g.pos), 'huge');
    this.audio.play('metal_crash', { x: g.pos.x, y: g.pos.y, z: g.pos.z });
    this.events.push({ type: 'gunshipDying' });
  }
  _updateGunship(dt) {
    const g = this.gunship; if (!g || g.phase === 'gone') return;
    g.t += dt;
    const H = this.heliPos, f = this._frame();
    const m = g.m;
    if (g.phase === 'enter' || g.phase === 'fight') {
      // duel: hold a station off the door side, changing it every few seconds (ahead / abeam / above)
      g.offT -= dt;
      if (g.offT <= 0) { g.offT = range(4, 7); g.off.set(range(-30, 110), range(-5, 30), range(75, 125)); }
      const want = H.clone().addScaledVector(f.fwd, g.off.x).addScaledVector(f.left, g.off.z).add(_v.set(0, g.off.y, 0));
      const acc = _v2.subVectors(want, g.pos).multiplyScalar(0.35).sub(_v3.copy(g.vel).multiplyScalar(0.9));
      if (acc.length() > 9) acc.setLength(9);
      g.vel.addScaledVector(acc, dt); g.pos.addScaledVector(g.vel, dt);
      if (g.phase === 'enter' && g.pos.distanceTo(want) < 90) { g.phase = 'fight'; this.events.push({ type: 'gunshipFight' }); }
      // face us to shoot, or along its velocity when repositioning fast
      const toH = _v.subVectors(H, g.pos);
      const face = g.vel.length() > 25 ? Math.atan2(-g.vel.x, -g.vel.z) : Math.atan2(-toH.x, -toH.z);
      let dyaw = face - g.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      g.yaw += dyaw * Math.min(1, dt * 1.6);
      const bank = clamp(-g.vel.dot(_v2.set(Math.cos(g.yaw), 0, -Math.sin(g.yaw))) * 0.012, -0.5, 0.5);
      m.root.position.copy(g.pos); m.root.rotation.set(clamp(-g.vel.dot(_v2.set(-Math.sin(g.yaw), 0, -Math.cos(g.yaw))) * 0.006, -0.3, 0.3), g.yaw, bank, 'YXZ');
      if (g.phase === 'fight' && !this.ceasefire) {
        g.gunT -= dt;
        const firing = g.burst > 0;
        m.aimGun?.(_v.copy(this.headPos).add(_v2.set(range(-2, 2), range(-1, 1), range(-2, 2))), dt, firing);
        if (g.gunT <= 0) {
          if (g.burst <= 0) g.burst = 14;
          g.burst--; g.gunT = g.burst > 0 ? 0.07 : range(2.0, 3.4);
          const mz = m.gun.getWorldPosition(new THREE.Vector3());
          const hit = rand() < 0.08 * this.enemyAcc;
          const aim = _v.copy(this.headPos).add(_v2.set(range(-1, 1), range(-1, 1), range(-1, 1)).multiplyScalar(hit ? 0.5 : range(3, 9)));
          this.fx.tracer(mz, aim.clone().addScaledVector(_v3.subVectors(aim, mz).normalize(), hit ? 0 : 60), { speed: 450, width: 0.28, len: 7, color: [2.0, 0.55, 0.18] });
          this.fx.muzzle(mz, _v3.subVectors(aim, mz).normalize(), 'rifle', false);
          if (g.burst % 2 === 0) this.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, volume: 1, pitch: 0.75 });
          if (hit) { this.hurt(3, mz); }
        }
        g.rocketT -= dt;
        if (g.rocketT <= 0) { g.rocketT = range(5, 8); const pod = m.pods[rand() < 0.5 ? 0 : 1].getWorldPosition(new THREE.Vector3()); this.fireRocket(pod, 'gunship'); }
      }
      g.hit *= Math.exp(-dt * 6);
      m.setDamage?.(clamp(1 - g.hp / g.maxHp, 0, 0.85));
      if (g.hp < g.maxHp * 0.5) this.fx.trailEmit(g, m.smokePt.getWorldPosition(_v), 2.2, (q) => this.fx.smoke(q, 1.6, 0.18, 3, 1.5, 0.6), 0);
    } else if (g.phase === 'dying') {
      // spins down into the crash tower (setpieces sets g.crashAt)
      const T = g.crashAt || g.pos.clone().setY(0);
      const to = _v.subVectors(T, g.pos);
      const dist = to.length();
      g.vel.lerp(to.normalize().multiplyScalar(Math.min(48, 20 + g.t * 14)), Math.min(1, dt * 1.2));
      g.pos.addScaledVector(g.vel, dt);
      g.spin = Math.min(5, g.spin + dt * 2.2); g.yaw += g.spin * dt;
      m.root.position.copy(g.pos); m.root.rotation.set(0.25, g.yaw, 0.35 * Math.sin(g.t * 3), 'YXZ');
      this.fx.trailEmit(g, m.smokePt.getWorldPosition(_v2), 1.6, (q) => { this.fx.smoke(q, 2.2, 0.1, 4, 1, 0.8); this.fx.flame(q, 1.2); }, 0);
      this.audio.setLoop('heli:enemy', { x: g.pos.x, y: g.pos.y, z: g.pos.z, volume: 0.9, intensity: 1 });
      if (dist < 8 || g.t > 9) {
        g.phase = 'gone'; m.root.visible = false;
        this.audio.stopLoop('heli:enemy');
        this.fx.explosion(g.pos.clone(), 1.8);
        this.fx.later(0.15, () => this.fx.explosion(g.pos.clone().add(_v.set(4, -3, 2)), 1.6, { noRing: true }));
        this.lastExplosionT = this.time; this.lastExplosionShake = 0.6;
        this.events.push({ type: 'gunshipCrash', p: g.pos.clone() });
        return;
      }
    }
    if (m.rotor) m.rotor.rotation.y += dt * 30;
    if (m.tailRotor) m.tailRotor.rotation.x += dt * 70;
    if (g.phase !== 'dying') this.audio.setLoop('heli:enemy', { x: g.pos.x, y: g.pos.y, z: g.pos.z, volume: 1, intensity: 0.9 });
  }

  // ------------------------------------------------------------------ HAMMER TWO (wingman)
  spawnWing() {
    // on the door side, a little ahead: you see your wingman out of the door
    this.wing = { m: buildHammer(this.W.cabin.mats), phase: 'fly', t: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, spin: 0, side: 1, ds: 45 };
    this.scene.add(this.wing.m.root);
    return this.wing;
  }
  _updateWing(dt) {
    const w = this.wing; if (!w || w.phase === 'gone') return;
    const rail = this.W.rail;
    w.t += dt;
    if (w.phase === 'fly') {
      const s = rail.s + w.ds, p = rail.point(s), y = rail.pathYaw(s + 40);
      const left = _v.set(-Math.cos(y), 0, Math.sin(y));
      const want = p.addScaledVector(left, 55 * w.side).add(_v2.set(0, 14 + Math.sin(this.time * 0.5) * 3, 0));
      if (w.t < 0.05) w.pos.copy(want);
      const prev = w.pos.clone();
      w.pos.lerp(want, Math.min(1, dt * 1.2));
      w.vel.subVectors(w.pos, prev).divideScalar(Math.max(dt, 1e-3));
      w.yaw += (((y - w.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 1.5);
      w.m.root.position.copy(w.pos); w.m.root.rotation.set(0.06, w.yaw, 0, 'YXZ');
      this.audio.setLoop('heli:wing', { x: w.pos.x, y: w.pos.y, z: w.pos.z, volume: 0.6, intensity: 0.8 });
    } else if (w.phase === 'hit') {
      // tail hit: spinning, trailing fire and smoke, falling into the boulevard
      w.vel.y -= 9.8 * 0.55 * dt; w.vel.multiplyScalar(Math.exp(-dt * 0.15));
      w.pos.addScaledVector(w.vel, dt);
      w.spin = Math.min(4.5, w.spin + dt * 2.4); w.yaw += w.spin * dt;
      w.m.root.position.copy(w.pos); w.m.root.rotation.set(0.2 + w.t * 0.05, w.yaw, 0.3 * Math.sin(w.t * 2.5), 'YXZ');
      const tail = _v2.set(0, 2.2, 7).applyQuaternion(w.m.root.quaternion).add(w.pos);
      this.fx.trailEmit(w, tail, 1.7, (q) => { this.fx.smoke(q, 2.4, 0.08, 5, 1.2, 0.85); this.fx.flame(q, 1.3); }, 0);
      this.audio.setLoop('heli:wing', { x: w.pos.x, y: w.pos.y, z: w.pos.z, volume: 0.8, intensity: 1 });
      if (w.pos.y < 3) {
        w.phase = 'gone'; w.m.root.visible = false; this.audio.stopLoop('heli:wing');
        const P = w.pos.clone().setY(2);
        this.fx.explosion(P, 1.8); this.fx.later(0.2, () => this.fx.explosion(P.clone().add(_v.set(5, 2, -3)), 1.5, { noRing: true }));
        this.lastExplosionT = this.time;
        this.events.push({ type: 'wingCrash', p: P });
      }
    }
    w.m.update(dt, w.phase === 'gone' ? 0 : 1);
  }
  shootDownWing() {
    const w = this.wing; if (!w || w.phase !== 'fly') return;
    w.phase = 'hit'; w.t = 0; w.spin = 0.4;
    w.vel.set(-Math.sin(w.yaw), 0, -Math.cos(w.yaw)).multiplyScalar(26).setY(-2);
    const tail = _v2.set(0, 2.2, 6).applyQuaternion(w.m.root.quaternion).add(w.pos);
    this.fx.explosion(tail.clone(), 1.3, { noRing: true });
    this.audio.play('metal_crash', { x: tail.x, y: tail.y, z: tail.z, volume: 1 });
    this.events.push({ type: 'wingHit' });
  }

  // ------------------------------------------------------------------ autopilot hooks
  aimAssistPoints(tryP) {
    for (const m of this.men) if (m.alive && m.delay <= 0) tryP(m.gm.chestCenter.getWorldPosition(new THREE.Vector3()));
    for (const r of this.rockets) tryP(r.pos);
    if (this.gunship?.phase === 'fight') tryP(this.gunship.pos);
  }
  autoTargets(A, head) {
    const c = [];
    for (const r of this.rockets) { const d = r.pos.distanceTo(head); if (d < 260 && d > 12) c.push({ kind: 'rocket', p: r.pos, score: 150 - d * 0.2, ref: r, tol: 0.03 }); }
    for (const m of this.men) {
      if (!m.alive || m.delay > 0) continue;
      const d = m.pos.distanceTo(head);
      if (d > 420) continue;
      c.push({ kind: 'gunman', p: m.pos, score: 70 - d * 0.12 + (m.role === 'rpg' ? 25 : 0) + (A.target?.ref === m ? 25 : 0), ref: m, tol: 0.02, heavy: false });
    }
    for (const a of this.aas) if (a.alive && a.active) { const d = a.center.distanceTo(head); if (d < 500) c.push({ kind: 'aa', p: a.center, score: 30 - d * 0.03, ref: a, tol: 0.02, heavy: false }); }
    const g = this.gunship;
    if (g && g.phase === 'fight') c.push({ kind: 'heli', p: g.pos, score: 60 + (A.target?.ref === g ? 25 : 0), ref: g, tol: 0.04, heavy: false });
    if (g && g.phase === 'dying') { c.length = 0; c.push({ kind: 'look', p: g.pos, score: 999, ref: g, w: 6 }); }
    else if (this.cinematicLook && !c.some(x => x.kind === 'rocket')) { c.length = 0; c.push({ kind: 'look', p: this.cinematicLook, score: 999, ref: this.cinematicLook, w: this.cinematicW ?? 3 }); }
    if (this.paintTarget) { c.length = 0; c.push({ kind: 'paint', p: this.paintTarget, score: 999, ref: this.paintTarget, tol: 0.03, w: 4 }); }
    return c;
  }
  autoTargetDead(t) { return (t.kind === 'gunman' && !t.ref.alive) || (t.kind === 'rocket' && t.ref.dead) || (t.kind === 'aa' && !t.ref.alive) || (t.kind === 'heli' && t.ref.phase !== 'fight'); }
  // the shared autopilot turns a world point into yaw / pitch as if the rig were unrotated; ours flies a
  // rotated rig, so hand it the point rotated into the rig's frame (about the eye)
  autoAimPoint(t, out) {
    if (t.kind === 'gunman') t.ref.gm.chestCenter.getWorldPosition(out); else out.copy(t.p);
    const cam = this.camera.getWorldPosition(_v2);
    return out.sub(cam).applyQuaternion(_q.copy(this.rig.quaternion).invert()).add(cam);
  }
  autoIdleLook() {
    // default: out of the door, a little ahead, down toward the roofs
    const P = this.idleLook || _v3.copy(this.headPos).add(_v.set(0, 0, -1).applyQuaternion(this.rig.quaternion).multiplyScalar(220)).add(_v2.set(0, -70, 0));
    _v.subVectors(P, this.headPos).applyQuaternion(_q.copy(this.rig.quaternion).invert());
    return { yaw: Math.atan2(-_v.x, -_v.z), pitch: Math.atan2(_v.y, Math.hypot(_v.x, _v.z)) };
  }

  // ------------------------------------------------------------------ update
  update(rdt) {
    if (this.slowT > 0) { this.slowT -= rdt; if (this.slowT <= 0) this.audio.play('slowmo_out', {}); }
    this.slowCool -= rdt;
    this.timeScale = damp(this.timeScale, this.slowT > 0 ? this.slowScale : 1, this.slowT > 0 ? 10 : 3, rdt);
    this.audio.setTimeScale?.(this.timeScale);
    const dt = rdt * this.timeScale;
    this.time += dt; this.comboT -= dt;
    this.hurtT += dt;
    if (this.hurtT > 3 && this.hp < 100) this.hp = Math.min(100, this.hp + 14 * dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - rdt * 1.2);
    this._updateMen(dt);
    this._updateRockets(dt);
    this._updateNades(dt);
    this._updateAA(dt);
    this._updateGunship(dt);
    this._updateWing(dt);
    this._updateBodies(dt);
    return dt;
  }
}

// a twin 23 mm-style AA cannon on a turntable, sandbagged — 4 draws: sandbags, base, turntable, cradle
function buildAAGun() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c2f26, roughness: 0.6, metalness: 0.5 });
  const sand = new THREE.MeshStandardMaterial({ color: 0x7a6a4c, roughness: 0.95 });
  const bags = [];
  for (let i = 0; i < 14; i++) for (const [y, r0] of [[0.3, 0], [0.82, 0.2]]) { const a = (i / 14) * Math.PI * 2; const b = new THREE.BoxGeometry(1.4, 0.55, 0.7); b.rotateY(-a + r0); b.translate(Math.cos(a) * 3.4, y, Math.sin(a) * 3.4); bags.push(b); }
  g.add(new THREE.Mesh(mergeGeometries(bags), sand));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.5, 12), dark); base.position.y = 0.25; g.add(base);
  const turn = new THREE.Group(); turn.name = 'aaGun'; turn.position.y = 0.6; g.add(turn);
  const cradle = new THREE.Group(); cradle.position.y = 0.9; turn.add(cradle);
  const cp = [new THREE.BoxGeometry(1.4, 0.7, 1.6)];
  for (const sx of [-0.35, 0.35]) cp.push(new THREE.CylinderGeometry(0.07, 0.09, 3.0, 8).rotateX(Math.PI / 2).translate(sx, 0.15, -2.0));
  cradle.add(new THREE.Mesh(mergeGeometries(cp.map(x => x.index ? x.toNonIndexed() : x)), dark));
  const tp = [new THREE.BoxGeometry(0.5, 0.5, 0.5).translate(0.9, 0.2, 0.6), new THREE.BoxGeometry(1.8, 0.9, 0.08).translate(0, 0.7, -0.9)];
  turn.add(new THREE.Mesh(mergeGeometries(tp), dark));
  turn.children.reverse(); // children[0] stays the cradle (the director pitches it)
  turn.children.sort((a, b) => (a === cradle ? -1 : b === cradle ? 1 : 0));
  g.scale.setScalar(1.6);
  return g;
}
