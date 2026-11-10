import * as THREE from 'three';
import { rand, range, chance, clamp, lerp, damp, makeRng } from '../../rng.js';
import { BillboardBatch, CELL } from '../../particles.js';
import { RigidBox } from '../../physics.js';
import { Driver } from '../../characters.js';
import { buildCabin } from './cabin.js';
import { Avalanche, buildRidge, buildCurtain } from './avalanche.js';
import { BillowCloud } from './billow.js';
import { scourU } from './terrain.js';
import { SUN_DIR } from '../../atmosphere.js';
import { Bucket, M4, mats, rbox } from './kit.js';
import { skyShared } from './sky.js';
import { TRACK_X, LINE, DOCK, HANG, PYLON, CABIN, GALLERY, RAILCAR, BLOCK, TOWER, CORNICE, GAZEX, lineY, terrainAt, groundAt, SUMMIT_Y, MID } from './layout.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const MID_DOCK_Z = -10.2;
function raySphere(o, d, c, r) { _v3.subVectors(o, c); const b = _v3.dot(d), cc = _v3.lengthSq() - r * r, h = b * b - cc; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t > 0 ? t : -1; }
// slab-test a ray against an oriented box given as (inverse matrix, half extents)
function rayOBox(o, d, inv, hx, hy, hz, y0 = 0) {
  const lo = _v.copy(o).applyMatrix4(inv), ld = _v2.copy(d).transformDirection(inv);
  let t0 = 0, t1 = 1e9;
  for (const [oa, da, a, b] of [[lo.x, ld.x, -hx, hx], [lo.y, ld.y, y0, y0 + hy], [lo.z, ld.z, -hz, hz]]) {
    if (Math.abs(da) < 1e-9) { if (oa < a || oa > b) return -1; continue; }
    let ta = (a - oa) / da, tb = (b - oa) / da; if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
  }
  return t0 > 0 ? t0 : -1;
}

// =====================================================================================
//  WHITEOUT set pieces: everything that moves, burns or comes down.
// =====================================================================================
const _inv = new THREE.Matrix4(), _v4 = new THREE.Vector3();
export class SetPieces {
  constructor(game) {
    this.g = game; this.world = game.world; game.setp = this;
    const g = game, W = game.world, A = W.anchors;
    this.glowB = new BillboardBatch(96, g.E.atlas, { boost: 1, renderOrder: 19, fog: g.scene.fog });
    g.scene.add(this.glowB.mesh);
    this.rng = makeRng(6060);
    // ---- warm point lights at load (they hop to whatever is burning / lit nearby; never added at runtime)
    this.lights = [0, 1].map(() => { const l = new THREE.PointLight(0xff9a50, 0, 22, 1.6); l.castShadow = false; g.scene.add(l); return { l, k: 0, p: new THREE.Vector3() }; });
    // ---- fires that burn from the start (the snowcat)
    this.fires = [];
    (A.snowcatFire || []).forEach((p, i) => this.fires.push({ p: p.clone(), size: i ? 0.75 : 1.3, light: i ? 0 : 1, col: !i }));
    for (const p of A.barrels || []) this.fires.push({ p: p.clone(), size: 0.42, light: 0.6, col: false });   // burning barrels in the courtyard
    this.flares = (A.flares || []).map(p => ({ p, t: rand() * 3 }));
    this.chimneys = A.chimneys || [];
    // ---- explosives (drums, the propane tank, the yard fuel tank, the courtyard bowser)
    this.exp = [...(A.explosives || []), ...(A.explosivesStation || []), ...(A.explosivesFort || [])].map(e => ({ ...e, alive: true, maxHp: e.hp, leak: 0 }));
    this.expTarget = {
      active: () => this.exp.some(e => e.alive),
      ray: (o, d) => { let best = -1; this.lastExp = null; for (const e of this.exp) { if (!e.alive) continue; if (e.p.distanceToSquared(o) > 200 * 200) continue; const t = raySphere(o, d, e.p, e.r); if (t > 0 && (best < 0 || t < best)) { best = t; this.lastExp = e; } } return best; },
      hit: (P, dir) => { const e = this.lastExp; if (!e) return; g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play(e.kind === 'drum' ? 'barrel_hit' : 'impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.8 }); this.damageExp(e, 1, P); g.hitMarker(false); },
      near: (p) => this.exp.some(e => e.alive && e.p.distanceTo(p) < e.r + 0.8),
      direct: (p) => { for (const e of this.exp) if (e.alive && e.p.distanceTo(p) < e.r + 1) this.damageExp(e, 99, p); },
      blast: (P, r) => { for (const e of this.exp) { if (!e.alive) continue; const d = e.p.distanceTo(P); if (d < r * 0.8) this.damageExp(e, 99, P, 0.15 + d * 0.03); else if (d < r * 1.4) this.damageExp(e, 2, P); } },
      aim: () => this.exp.find(e => e.alive)?.p,
      auto: (head, Au) => {
        let best = null, bs = -1e9;
        for (const e of this.exp) {
          if (!e.alive) continue;
          const d = e.p.distanceTo(head); if (d < 8 || d > 55) continue;
          const near = g.soldiers.filter(s => s.alive && s.delay <= 0 && s.pos.distanceTo(e.p) < (e.size > 2 ? 9 : 5)).length;
          if (!near) continue;
          if (!g.col.visible(head, e.p, b => b.data.noBullet || b.data.kind === 'tank')) continue;
          const sc = 52 + near * 20 + e.size * 6 - d * 0.4;
          if (sc > bs) { bs = sc; best = e; }
        }
        if (!best) return null;
        this.autoExp = best;
        return { kind: 'target', p: best.p.clone(), score: bs, ref: this.expTarget, tol: 0.05, heavy: best.size > 2, minNade: 9 };
      },
    };
    g.targets.push(this.expTarget);
    // ---- headlamps on the gunmen + other moving glows
    this.ride = null; this.enemyCab = null; this.whip = null; this.aval = null;
    // ---- the cable cars
    this.cab = this._makeCabin(1, TRACK_X[0], 0x9c1712);
    this.cab2 = this._makeCabin(2, TRACK_X[1], 0x9c1712);
    this._placeCab(this.cab, MID_DOCK_Z); this.cab.m.setDoor(true);
    this._placeCab(this.cab2, DOCK.z);
    this.cab.dockBoxes = this._dockColliders(this.cab);
    this.cabTarget = {
      active: () => !!this.enemyCab && this.enemyCab.state === 'ride',
      ray: (o, d) => { const C = this.cab2; C.root.updateMatrixWorld(true); _m.copy(C.root.matrixWorld).invert(); return rayOBox(o, d, _m, CABIN.w / 2, CABIN.h + 0.4, CABIN.l / 2, 0); },
      hit: (P, dir) => { g.fx.impact(P, _v.copy(dir).negate(), chance(0.5) ? 'glass' : 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.7 }); this._cabPane(this.cab2, P); this.damageCab(0.6, P); g.hitMarker(false); },
      near: (p) => this.cab2.root.position.distanceTo(p) < 4.5 || _v.copy(this.cab2.m.anchors.carriage).applyMatrix4(this.cab2.root.matrixWorld).distanceTo(p) < 3,
      direct: (p) => { this.damageCab(14, p); g.hitMarker(true); },
      blast: (P, r) => { const d = this.cab2.root.position.distanceTo(P); if (d < r + 4) this.damageCab(8 * (1 - d / (r + 4)) + 3, P); },
      aim: () => _v.copy(this.cab2.m.anchors.carriage).applyMatrix4(this.cab2.root.matrixWorld).clone(),
      auto: (head) => { const C = this.cab2; const d = C.root.position.distanceTo(head); if (d > 120 || g.enemiesAlive(s => s.role === 'deck') > 1) return null; const p = _v.copy(C.m.anchors.carriage).applyMatrix4(C.root.matrixWorld).clone(); return { kind: 'target', p, score: 80, ref: this.cabTarget, heavy: true, minNade: 10, tol: 0.05 }; },
    };
    g.targets.push(this.cabTarget);
    // ---- the summit ridge (Gazex cannons + the convoy), the avalanche, the gallery curtain
    this.ridge = buildRidge(); g.scene.add(this.ridge.root); this.ridge.root.visible = false;
    for (const gl of this.ridge.glows) W.glowList.push(gl);
    this.gazexTarget = {
      active: () => this.ridge.root.visible && this.ridge.targets.some(t => t.alive) && !this.aval,
      ray: (o, d) => { let best = -1; this.lastGz = null; for (const t of this.ridge.targets) { if (!t.alive) continue; const tt = raySphere(o, d, t.p, t.r); if (tt > 0 && (best < 0 || tt < best)) { best = tt; this.lastGz = t; } } return best; },
      hit: (P) => { const t = this.lastGz; if (!t) return; g.fx.impact(P, UP, 'metal'); t.hp -= 1; g.hitMarker(t.hp <= 0); if (t.hp <= 0) this.gazexBoom(t); },
      near: (p) => this.ridge.targets.some(t => t.alive && t.p.distanceTo(p) < t.r + 2),
      direct: (p) => { for (const t of this.ridge.targets) if (t.alive && t.p.distanceTo(p) < t.r + 3) this.gazexBoom(t); },
      aim: () => this.ridge.targets.find(t => t.alive)?.p,
      auto: (head) => { const t = this.ridge.targets.find(t => t.alive); if (!t) return null; return { kind: 'target', p: t.p.clone(), score: 90, ref: this.gazexTarget, tol: 0.01, minNade: 999 }; },
    };
    g.targets.push(this.gazexTarget);
    this.av = new Avalanche(g);
    this.curtain = buildCurtain(); g.scene.add(this.curtain.mesh);
    this.billow = new BillowCloud(g.scene, { max: g.E.isQuest ? 130 : 320 });
    // snow heaps that pile up in the gallery openings as it pours (one mesh, grows from the floor)
    {
      const b = new Bucket(), hr = makeRng(808);
      for (let x = GALLERY.x0 + 6; x < GALLERY.x1; x += 6.5) {
        for (let k = 0; k < 3; k++) {
          const gq = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
          const P = gq.attributes.position; for (let i = 0; i < P.count; i++) { const vx = P.getX(i), vy = P.getY(i), vz = P.getZ(i); P.setXYZ(i, vx, vy * (1 + Math.sin(vx * 5 + x) * 0.15), vz); } gq.computeVertexNormals();
          const cx = x + 1.2 + k * 1.6 + hr() * 0.6, cz = GALLERY.z1 + 0.6 - k * 0.5 - hr() * 0.8;
          b.add(gq, M4(cx, 0, cz, 0, hr() * 6, 0, 1.4 + hr() * 1.2, 0.9 + hr() * 1.1 - k * 0.2, 1.4 + hr()), (q) => { const kk = 0.84 + 0.14 * Math.min(1, q.y / 1.5); return [kk * 0.94, kk * 0.97, kk]; });
        }
      }
      this.heaps = b.mesh(mats.snow(), { shadow: false });
      this.heaps.position.y = GALLERY.y; this.heaps.scale.y = 0.01; this.heaps.visible = false;
      g.scene.add(this.heaps);
    }
    this.railcar = this._makeRailcar();
    this.extraWalk = (x, z) => this.ride && this.ride.state === 'arrived' && Math.abs(x - this.cab.root.position.x) < CABIN.w / 2 - 0.25 && Math.abs(z - this.cab.root.position.z) < CABIN.l / 2 - 0.25;
  }
  warmMaterials() { return [...this.av.warmMaterials(), this.curtain.mesh.material, this.cab.m.glassM, this.billow.material]; }

  // ================================================================== explosives
  damageExp(e, d, P, fuse = 0) {
    if (!e.alive) return;
    e.hp -= d;
    const g = this.g;
    if (e.hp > 0 && e.hp < e.maxHp * 0.6 && !e.leak) { e.leak = 1; g.audio.play('barrel_hiss', { x: e.p.x, y: e.p.y, z: e.p.z }); }
    if (e.hp <= 0) {
      e.alive = false;
      g.fx.later(fuse || 0.05, () => {
        const P2 = e.p.clone();
        g.boom(P2, e.size, { radius: 3 + e.size * 2.6, dmg: 50 + e.size * 12, glass: false });
        g.audio.play(e.size > 2 ? 'explosion_big' : 'barrel_explode', { x: P2.x, y: P2.y, z: P2.z });
        if (e.size > 2) { g.slowmo(1.3, 0.3); this._fogFlash(1.2); for (let i = 0; i < 6; i++) g.fx.spawnDebris(P2, range(-12, 12), range(10, 20), range(-12, 12), range(0.3, 0.7), 2); }
        // it keeps burning where it stood
        this.fires.push({ p: P2.clone().setY(groundAt(P2.x, P2.z) + 0.3), size: e.size > 2 ? 2.2 : 1.0, light: e.size > 2 ? 1.5 : 0.7, t: 0, life: e.size > 2 ? 60 : 25, col: e.size > 1.5 });
        g.events.push({ type: 'expBoom', e, P: P2 });
        g.addScore(e.size > 2 ? 300 : 75, e.size > 2 ? (e.kind === 'propane' ? 'GAS!' : 'KA-BLOOEY!') : null, P2.clone().setY(P2.y + 3), 'big');
      });
    }
  }
  // the storm lights up from inside: the fog takes the fire colour for a moment
  _fogFlash(k = 1) { this.flash = Math.max(this.flash || 0, k); }

  // ================================================================== the cable cars
  _makeCabin(num, tx, paint) {
    const m = buildCabin({ num, seed: num * 7, paint });
    this.g.scene.add(m.root);
    m.root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
    return { m, root: m.root, tx, z: 0, num, hp: 30, sway: 0, swayV: 0 };
  }
  _placeCab(C, z, extraY = 0) {
    C.z = z;
    const y = Math.max(z > LINE.z0 ? MID.y + 0.02 : -1e9, lineY(Math.min(z, LINE.z0)) - HANG) + extraY;
    C.root.position.set(C.tx, y, z);
    C.root.rotation.set(C.sway * 0.4, 0, C.sway, 'YXZ');
    C.m.hanger.rotation.set(-C.sway * 0.4, 0, -C.sway);
    C.root.updateMatrixWorld(true);
  }
  _dockColliders(C) { C.root.updateMatrixWorld(true); return this.g.col.addFromObject(C.m.colliders, C.root.matrixWorld, { kind: 'cabin', mat: 'metal' }); }
  _cabPane(C, P) {
    // break the pane closest to the hit
    let bi = -1, bd = 1e9;
    C.m.panes.forEach((p, i) => { if (p.broken) return; p.mesh.getWorldPosition(_v); const d = _v.distanceTo(P); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0 && bd < 2.6 && C.m.breakPane(bi)) { C.m.panes[bi].mesh.getWorldPosition(_v); this.g.audio.play('glass_break', { x: _v.x, y: _v.y, z: _v.z, volume: 0.7 }); for (let i = 0; i < 14; i++) this.g.fx.sparks.spawn({ x: _v.x + range(-0.8, 0.8), y: _v.y + range(-0.4, 0.4), z: _v.z + range(-0.8, 0.8), vx: range(-2, 2), vy: range(-1, 2), vz: range(-2, 2), grav: -9.8, drag: 0.4, frame: CELL.SPARK, s0: 1, w: 0.03, len: 0.06, life: range(0.5, 1.2), r: 0.8, g: 0.9, b: 1.0, a: 0.8, fadeOut: 0.6 }); }
  }
  // the player is in the cabin footprint at the Mittelstation
  // the head in the cabin's own frame (its root can sit anywhere along the hanger; the body sways)
  inCabin(p) { const R = this.cab.root; R.updateMatrixWorld(); _inv.copy(R.matrixWorld).invert(); const l = _v4.copy(p).applyMatrix4(_inv); return Math.abs(l.x) < CABIN.w / 2 - 0.15 && Math.abs(l.z) < CABIN.l / 2 - 0.15 && l.y > -0.5 && l.y < CABIN.h + 0.6; }
  board() {
    if (this.ride) return;
    const g = this.g;
    this.ride = { state: 'close', t: 0, v: 0, d: 0, snapped: false, gunmen: [] };
    for (const b of this.cab.dockBoxes) g.col.remove(b);
    // you keep your legs: walk round the cabin during the ride (afterPlayer carries your spot in the cabin's frame)
    this.cabLocal = null;
    g.events.push({ type: 'boarded' });
    g.audio.play('crane_alarm', { x: this.cab.root.position.x, y: this.cab.root.position.y + 2, z: this.cab.root.position.z, volume: 0.6 });
  }
  // the locomotion's ground while the cabin carries you: its floor inside, a drop everywhere else (you can't step out)
  cabFloor(x, z) {
    if (!this.riding) return undefined;
    const R = this.cab.root; _inv.copy(R.matrixWorld).invert(); const l = _v4.set(x, R.position.y, z).applyMatrix4(_inv);
    return Math.abs(l.x) < CABIN.w / 2 - 0.2 && Math.abs(l.z) < CABIN.l / 2 - 0.2 ? R.position.y : -1e9;
  }
  // only while it's carrying you (rolling back down the line it must never take you with it)
  get riding() { const R = this.ride; return !!R && (R.state === 'close' || R.state === 'go' || R.state === 'brake'); }
  startEnemyCabin() {
    const g = this.g;
    this.enemyCab = { state: 'ride', t: 0, fallV: new THREE.Vector3(), spin: new THREE.Vector3() };
    // four of them inside, firing out of the windows
    for (const sp of this.cab2.m.anchors.spots) {
      const s = g.spawnSoldier({ x: this.cab2.root.position.x, z: this.cab2.root.position.z, y: this.cab2.root.position.y, role: 'deck', noNade: true, hp: 2, carrier: { obj: this.cab2.root, local: sp.clone(), vel: new THREE.Vector3() } });
      s.delay = range(0.5, 2.5);
      this.ride.gunmen.push(s);
    }
  }
  damageCab(d, P) {
    const E = this.enemyCab; if (!E || E.state !== 'ride') return;
    this.cab2.hp -= d;
    this.cab2.swayV += (rand() - 0.5) * 0.08 * d;
    if (this.cab2.hp < 18 && rand() < 0.3) this.g.fx.smoke(_v.copy(this.cab2.m.anchors.carriage).applyMatrix4(this.cab2.root.matrixWorld), 1.0, 0.15, 3, 1.5, 0.6);
    if (this.cab2.hp <= 0) this.dropCab('shot');
  }
  dropCab(cause) {
    const E = this.enemyCab, g = this.g, C = this.cab2;
    if (!E || E.state !== 'ride') return;
    E.state = 'fall'; E.t = 0;
    const P = _v.copy(C.m.anchors.carriage).applyMatrix4(C.root.matrixWorld).clone();
    // the carriage blows off the rope: sparks, a burst of fire at the hanger, the cabin drops away
    g.fx.explosion(P, 1.2);
    g.audio.play('explosion_small', { x: P.x, y: P.y, z: P.z }); g.audio.play('metal_groan', { x: P.x, y: P.y, z: P.z, volume: 1 });
    for (let i = 0; i < 40; i++) g.fx.sparks.spawn({ x: P.x, y: P.y, z: P.z, vx: range(-8, 8), vy: range(-2, 8), vz: range(-8, 8), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 1, w: 0.05, len: 0.15, life: range(0.6, 1.6), r: 2.6, g: 1.3, b: 0.45, a: 1, fadeOut: 0.5 });
    E.fallV.set(range(-1, 1), -1, (this.ride ? this.ride.v : 0) * (cause === 'pylon' ? 0.9 : 0.6));
    E.spin.set(range(-0.8, 0.8), range(-0.5, 0.5), range(-1.2, 1.2));
    C.m.hanger.visible = cause !== 'shot' ? true : false;
    for (const s of this.ride?.gunmen || []) if (s.alive) g.killSoldier(s, _v.set(range(-1, 1), 1, range(-1, 1)).normalize(), 2.5, false, null);
    g.slowmo(2.0, 0.3, true);
    g.addScore(1500, 'CABLE CUT!', P.clone().setY(P.y + 4), 'big');
    g.events.push({ type: 'cabDrop', P });
  }
  _updEnemyCab(dt) {
    const E = this.enemyCab; if (!E) return;
    const C = this.cab2, g = this.g;
    E.t += dt;
    if (E.state === 'fall') {
      E.fallV.y -= 9.8 * dt;
      C.root.position.addScaledVector(E.fallV, dt);
      C.root.rotation.x += E.spin.x * dt; C.root.rotation.y += E.spin.y * dt; C.root.rotation.z += E.spin.z * dt;
      C.root.updateMatrixWorld(true);
      g.fx.trailEmit(C, C.root.position, 0.9, (q) => { g.fx.flame(q, 1.3); g.fx.smoke(q, 1.8, 0.1, 4, 1.2, 0.8); }, 0);
      const gy = terrainAt(C.root.position.x, C.root.position.z);
      if (C.root.position.y < gy + 1.5 || E.t > 9) {
        E.state = 'dead';
        const P = C.root.position.clone(); P.y = gy + 1.5;
        g.boom(P, 3.2, { radius: 12, dmg: 0, player: false, glass: false });
        g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
        this._fogFlash(1.6);
        this.fires.push({ p: P.clone(), size: 2.6, light: 0, t: 0, life: 999, col: true, far: true });
        C.root.visible = false;
        g.events.push({ type: 'cabCrash', P });
      }
    }
  }
  _updRide(dt) {
    const R = this.ride, g = this.g, C = this.cab;
    // gentle pendulum sway (the cabin moves; the player's view does not rotate with it)
    for (const K of [this.cab, this.cab2]) { K.swayV += (-K.sway * 3.0 - K.swayV * 0.6) * dt + (g.weather ? (g.weather.gust - 0.3) * 0.004 * dt * 10 : 0); K.sway += K.swayV * dt; K.sway = clamp(K.sway, -0.05, 0.05); }
    if (!R) { this._placeCab(this.cab, this.cab.z); return; }
    R.t += dt;
    const total = MID_DOCK_Z - DOCK.z;
    if (R.state === 'close') { C.m.setDoor(false); if (R.t > 1.6) { R.state = 'go'; R.t = 0; g.events.push({ type: 'rideStart' }); this.startEnemyCabin(); g.audio.play('metal_groan', { volume: 0.5 }); } }
    else if (R.state === 'go') {
      // a smooth speed profile: ease up to 7.5 m/s, cruise; the snap comes 42 m out
      const vMax = 7.5;
      R.v = Math.min(vMax, R.v + dt * 0.5);
      R.d += R.v * dt;
      if (!R.snapped && R.d > total - 42) this._snap();
    } else if (R.state === 'brake') {
      // the haul rope's gone: the brakes clamp the track rope, screaming; it slides in to the buffers
      const left = total - R.d;
      const want = Math.sqrt(Math.max(0, 2 * 0.62 * left));
      R.v = Math.max(0.6, Math.min(R.v, want));
      R.d = Math.min(total, R.d + R.v * dt);
      const P = _v.copy(C.m.anchors.carriage).applyMatrix4(C.root.matrixWorld);
      if (rand() < dt * 30) g.fx.sparks.spawn({ x: P.x + range(-0.2, 0.2), y: P.y + 0.1, z: P.z + range(-1.2, 1.2), vx: range(-2, 2), vy: range(-1, 3), vz: range(2, 8), grav: -9.8, drag: 0.4, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.12, life: range(0.4, 1.0), r: 2.6, g: 1.4, b: 0.5, a: 1, fadeOut: 0.5 });
      g.audio.setLoop('crane_motor', { x: P.x, y: P.y, z: P.z, volume: 0.6, intensity: 1 });
      if (R.d >= total - 0.01) { R.state = 'arrived'; R.t = 0; R.v = 0; g.audio.stopLoop('crane_motor'); g.audio.play('container_slam', { x: P.x, y: P.y, z: P.z, volume: 0.6 }); C.m.setDoor(true); this.cab.dockBoxes = this._dockColliders(C); g.events.push({ type: 'arrived' }); if (g.player) g.player.shake = Math.min(1.2, (g.player.shake || 0) + 0.6); }
    } else if (R.state === 'arrived') {
      // once you're off, the brakes let go: it rolls back out of the station, down the line, into the pylon
      const out = !this.inCabin(g.headPos);
      R.outT = out ? (R.outT || 0) + dt : 0;
      if (R.outT > 2.5) { R.state = 'back';   // only once you're out: it must never carry you back down the line
        R.t = 0; R.v = 0; for (const b of this.cab.dockBoxes) g.col.remove(b); g.audio.play('metal_groan', { x: C.root.position.x, y: C.root.position.y, z: C.root.position.z, volume: 1 }); g.events.push({ type: 'rollback' }); }
    } else if (R.state === 'back') {
      R.v = Math.min(26, R.v + dt * 2.6);
      R.d -= R.v * dt;
      const zz = MID_DOCK_Z - R.d;
      if (zz > PYLON.z - 3) {
        R.state = 'out';
        const P = new THREE.Vector3(C.tx, lineY(PYLON.z) - 2, PYLON.z + 4);
        g.boom(P, 3.0, { radius: 12, dmg: 0, player: false, glass: false });
        g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
        this._fogFlash(1.0);
        C.root.visible = false;
        this.fires.push({ p: P.clone(), size: 2.2, light: 0, t: 0, life: 40, col: true, far: true });
        for (let i = 0; i < 8; i++) g.fx.spawnDebris(P, range(-10, 10), range(4, 12), range(-4, 8), range(0.3, 0.7), 2);
        g.events.push({ type: 'pylonHit', P });
      }
    }
    if (R.state !== 'out') {
      this._placeCab(C, MID_DOCK_Z - R.d);
      // the enemy cabin rides the same haul rope the other way (until the snap / the drop)
      if (this.enemyCab?.state === 'ride') {
        const z2 = DOCK.z + R.d;
        this._placeCab(this.cab2, z2);
        // it never gets past you: when we jolt over the pylon saddle the rope jumps, and its carriage comes off
        // the rope ~17 m ahead of you, off to the right (Bay physics)
        if (R.d > (MID_DOCK_Z - PYLON.z) + 1 && R.state === 'go') this.dropCab('pylon');
        for (const s of R.gunmen) if (s.carrier) s.carrier.vel.set(0, 0, R.v);
      }
    }
    // mist drifting through the gorge below and beside the cabin: parallax, depth, the drop under you
    if (R.state === 'go' || R.state === 'brake') {
      R.mistT = (R.mistT || 0) - dt;
      if (R.mistT <= 0) {
        R.mistT = g.E.isQuest ? 0.5 : 0.28;
        const zc = C.root.position.z - range(10, 70), yc = C.root.position.y;
        const x = C.tx + range(-60, 60), y = yc - range(8, 45);
        if (y > terrainAt(x, zc) + 4) { const s0 = range(10, 18); g.clouds.spawn({ x, y, z: zc, vx: g.weather.wind.x * 0.3, vy: range(-0.3, 0.3), vz: g.weather.wind.z * 0.3, drag: 0.05, buoy: 0, s0, s1: s0 * 1.8, st: range(1.6, 2.6), life: range(8, 12), a: 0.42, fadeIn: 0.25, fadeOut: 0.4, r: 0.6, g: 0.65, b: 0.74, r1: 0.58, g1: 0.63, b1: 0.72, glow: 0, glowFade: 1, spray: true }); }
      }
    }
    const v = R.state === 'go' || R.state === 'brake' || R.state === 'back' ? R.v : 0;
    g.audio.setLoop('truck', { volume: R.state === 'go' ? 0.25 + v * 0.03 : 0, intensity: 0.2 });
  }
  _snap() {
    const R = this.ride, g = this.g, C = this.cab;
    R.snapped = true; R.state = 'brake';
    const P = _v.copy(C.m.anchors.carriage).applyMatrix4(C.root.matrixWorld).clone();
    g.audio.play('metal_crash', { x: P.x, y: P.y, z: P.z, volume: 1 }); g.audio.play('metal_groan', { x: P.x, y: P.y + 2, z: P.z, volume: 1 });
    for (let i = 0; i < 50; i++) g.fx.sparks.spawn({ x: P.x, y: P.y + 0.5, z: P.z, vx: range(-6, 6), vy: range(-2, 9), vz: range(-6, 6), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 1, w: 0.05, len: 0.15, life: range(0.6, 1.4), r: 2.6, g: 1.3, b: 0.45, a: 1, fadeOut: 0.5 });
    // the broken haul rope whips back down the line past the windows
    this.whip = { t: 0, a: P.clone().add(_v2.set(0, 1.1, -2)) };
    g.slowmo(1.4, 0.4);
    g.events.push({ type: 'snap', P });
    if (this.enemyCab?.state === 'ride') this.dropCab('pylon');
  }
  _updWhip(dt) {
    const W = this.whip; if (!W) return;
    W.t += dt;
    if (!this.whipMesh) {
      const g = new THREE.CylinderGeometry(0.05, 0.05, 1, 5); g.translate(0, 0.5, 0);
      this.whipMesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.5, metalness: 0.6 }), 24);
      this.whipMesh.frustumCulled = false; this.g.scene.add(this.whipMesh);
    }
    // a travelling sine down a rope that falls back toward the gorge
    const N = 24, seg = 2.2, k = Math.min(1, W.t / 3.5);
    let px = W.a.x, py = W.a.y, pz = W.a.z;
    for (let i = 0; i < N; i++) {
      const s = i / N;
      const amp = (1 - k) * 4 * Math.sin(s * 9 - W.t * 14) * (s + 0.1);
      const nx = W.a.x + amp * 0.7, nz = W.a.z + (i + 1) * seg * (0.6 + 0.4 * k), ny = W.a.y - (i + 1) * seg * (0.25 + k * 0.9) + amp * 0.6 - k * k * 12 * s;
      _v.set(nx - px, ny - py, nz - pz); const L = _v.length();
      _q.setFromUnitVectors(UP, _v.normalize());
      _m.compose(_v2.set(px, py, pz), _q, _v3.set(1, L, 1)); this.whipMesh.setMatrixAt(i, _m);
      px = nx; py = ny; pz = nz;
    }
    this.whipMesh.instanceMatrix.needsUpdate = true;
    if (W.t > 6) { this.whip = null; this.whipMesh.visible = false; }
  }

  // ================================================================== the summit: storm break, the ridge, the avalanche
  showRidge() { this.ridge.root.visible = true; for (const c of this.ridge.cats) c.obj.visible = true; }
  gazexBoom(t) {
    if (!t.alive) return;
    t.alive = false;
    const g = this.g;
    g.fx.explosion(t.p, 4.5);
    g.fx.light(t.p, 60, 0.4, 0xffa040, true, 260);
    g.audio.play('explosion_big', { x: t.p.x, y: t.p.y, z: t.p.z, volume: 1 });
    for (let i = 0; i < 10; i++) g.clouds.spawn({ x: t.p.x + range(-10, 10), y: t.p.y + range(0, 6), z: t.p.z + range(-6, 10), vx: range(-6, 6), vy: range(2, 8), vz: range(2, 10), drag: 0.3, buoy: 0, s0: 10, s1: range(30, 45), life: range(5, 7), a: 0.8, fadeIn: 0.05, fadeOut: 0.5, r: 0.85, g: 0.88, b: 0.94, r1: 0.8, g1: 0.84, b1: 0.9, glow: 0.6, glowFade: 1, spray: true });
    g.addScore(400, 'GAZEX!', t.p.clone().setY(t.p.y + 14), 'big');
    g.events.push({ type: 'gazex', t });
    const left = this.ridge.targets.filter(x => x.alive);
    // two down and the rest go in sequence (the gas lines are linked): then the slab lets go
    if (left.length <= this.ridge.targets.length - 2 && !this.chain) {
      this.chain = true;
      left.forEach((x, i) => g.fx.later(0.5 + i * 0.45, () => this.gazexBoom(x)));
      g.fx.later(0.6 + left.length * 0.45 + 0.4, () => this.release());
    }
  }
  release() {
    if (this.aval) return;
    const g = this.g;
    this.aval = { phase: 'crack', t: 0 };
    this.ridge.crack.visible = true; this.ridge.crack.scale.y = 0.05;
    g.audio.play('collapse_rumble', { volume: 1 });
    g.events.push({ type: 'crack' });
  }
  _updAval(dt) {
    const A = this.aval, g = this.g; if (!A) { this.av.update(dt); return; }
    A.t += dt;
    if (A.phase === 'crack') {
      // the crown crack runs across the face, puffing snow along its length
      const k = Math.min(1, A.t / 1.4);
      this.ridge.crack.scale.y = 0.05 + k * 0.95;
      const x = CORNICE.x0 + (CORNICE.x1 - CORNICE.x0) * k;
      if (rand() < dt * 30) { const z = CORNICE.z, y = terrainAt(x, z); g.clouds.spawn({ x, y: y + 2, z, vx: range(-3, 3), vy: range(2, 5), vz: range(1, 4), drag: 0.4, buoy: 0, s0: 8, s1: 26, life: 3.5, a: 0.75, fadeIn: 0.05, fadeOut: 0.5, r: 0.88, g: 0.9, b: 0.96, r1: 0.82, g1: 0.86, b1: 0.92, glow: 0, glowFade: 1, spray: true }); }
      if (A.t > 1.6) { A.phase = 'slide'; A.t = 0; this.av.blocks.release(this.rng); g.audio.setLoop('dust_roar', { volume: 0.7 }); g.events.push({ type: 'release' }); }
    } else if (A.phase === 'slide') {
      if (A.t > 1.2 && !this.av.on) { this.av.start(); g.events.push({ type: 'front' }); }
    }
    if (this.av.on) {
      // rubber band: the front never gets within ~22 m of you until you're in the gallery
      const head = g.headPos;
      const inGal = head.x > GALLERY.x0 + 4 && head.z > GALLERY.z0 && head.z < GALLERY.z1 + 0.5 && head.y > GALLERY.y + 0.5;
      const nose = this.av.H * 0.45 + 2;   // the toe runs ahead of the front line
      const zLim = inGal ? 1e9 : head.z - nose - 22 - Math.max(0, GALLERY.x0 + 4 - head.x) * 0.15;
      if (inGal) this.av.cap = GALLERY.z1 - 1;
      this.av.update(dt, { zLimit: Math.max(this.av.zf, Math.min(zLim, 1e9)), speed: inGal ? 40 : 34 });
      A.dist = head.z - this.av.zfAt(head.x) - nose;
      // the crest: soft puffs riding it, chunks tumbling out ahead of the toe
      A.puffT = (A.puffT || 0) - dt;
      if (A.puffT <= 0) {
        A.puffT = g.E.isQuest ? 0.06 : 0.03;
        // the powder cloud: big soft puffs boiling up off the crest, two to three times the slide's height,
        // white on top, blue-grey underneath, rolling forward and up
        const x = -60 + rand() * 340;
        const P = this.av.crest(x, _v);
        const H = this.av.H, near = Math.abs(x - head.x) < 140;
        if (near || rand() < 0.5) {
          // the head: tight rolling billows low on the front, bright tops / steel-blue undersides
          const yo = range(-0.85, 0.15), up = clamp((yo + 0.85) / 1.0, 0, 1), s0 = (0.1 + 0.12 * up) * H + 3;
          this.billow.spawn({ x: P.x + range(-5, 5), y: P.y + yo * H, z: P.z + range(-2, 6), vx: range(-2, 2), vy: range(1, 5), vz: this.av.v * range(0.75, 0.95), s0, s1: s0 * range(1.5, 1.9), life: range(3.5, 5), tone: up * 0.8, a: 1, drag: 0.4, rise: 0.4 });
          // the powder above it: bigger, thinner, boiling up behind
          if (rand() < 0.45) { const s1 = (0.25 + 0.2 * rand()) * H + 6; this.billow.spawn({ x: P.x + range(-6, 6), y: P.y + range(0.3, 1.1) * H, z: P.z - range(0.2, 0.8) * H, vx: range(-2, 2), vy: range(5, 10), vz: this.av.v * range(0.45, 0.65), s0: s1 * 0.6, s1: s1 * 2.0, life: range(6, 8), tone: 1, a: 0.55, drag: 0.3, rise: 0.8 }); }
        }
        // the dust skirt: a ground-hugging blast running ahead of the toe
        if (rand() < 0.6) { const T = this.av.toe(-40 + rand() * 300, _v2); this.billow.spawn({ x: T.x, y: T.y + range(1, 3), z: T.z + range(4, 16), vx: range(-3, 3), vy: range(0.5, 2), vz: this.av.v * range(0.85, 1.1), s0: range(3, 5), s1: range(10, 16), life: range(1.6, 2.4), tone: range(0.1, 0.35), a: 0.6, drag: 0.6 }); }   // the dust skirt racing ahead (low, shaded)
        if (rand() < 0.7) { const T = this.av.toe(-40 + rand() * 300, _v2); g.fx.main.spawn({ x: T.x, y: T.y + range(0.5, 3), z: T.z + range(0, 4), vx: range(-2, 2), vy: range(2, 7), vz: this.av.v * range(0.6, 1.0), grav: 6, drag: 0.3, frame: CELL.WISP, s0: 3, s1: range(10, 18), life: range(1.2, 2), rot: rand() * 6, r: 0.9, g: 0.93, b: 0.98, a: 0.55, fadeIn: 0.05, fadeOut: 0.5 }); }
        if (rand() < 0.3 && near) { const T = this.av.toe(head.x + range(-50, 50), _v2); g.fx.spawnDebris(T.clone().setY(T.y + 2), range(-4, 4), range(6, 14), this.av.v * 0.7, range(0.4, 1.0), false); }
      }
      // the convoy gets taken
      for (const c of this.ridge.cats) if (c.alive && this.av.zfAt(c.obj.position.x) > c.obj.position.z - 4) { c.alive = false; c.tumble = 1; g.events.push({ type: 'catTaken' }); }
      // near you: the whiteout closes in, the wind howls
      const d = A.dist;
      g.fogMix.k = damp(g.fogMix.k, clamp(1 - (d - 8) / 60, 0, 0.85) * (inGal ? 0.4 : 0.8), 1.4, dt);   // inside: the pillars must silhouette against the bright openings
      // the whiteout is a blue-grey wall, not paper white: the pouring snow and the powder have to read against it
      if (inGal) { g.fogMix.color.setRGB(0.5, 0.57, 0.68); g.fogMix.near = 10; g.fogMix.far = 110; }
      else { g.fogMix.color.setRGB(0.74, 0.79, 0.86); g.fogMix.near = 2; g.fogMix.far = 40; }
      skyShared.white.value = clamp(1 - (d - 10) / 90, 0, 1);
      g.audio.setLoop('dust_roar', { x: head.x, y: head.y, z: head.z - Math.max(5, d), volume: clamp(1.2 - d / 200, 0.4, 1) });
      if (d < 30 && g.player) g.player.shake = Math.max(g.player.shake || 0, (30 - d) / 60);
      // it reaches the gallery: the curtain pours off the roof past the pillars
      if (inGal && this.av.zfRaw(head.x) > GALLERY.z0 - 2 && !A.over) { A.over = true; A.overT = 0; this.curtain.mesh.visible = true; g.slowmo(2.4, 0.3, true); g.events.push({ type: 'over' }); g.audio.play('collapse_impact', { volume: 1 }); }
      if (A.over) {
        A.overT += dt;
        if (A.overT > 0.4) this.av.plume.mesh.visible = false;   // over the roof now: the gold-lit underside must not show through the openings
        this.curtain.u.uK.value = clamp(A.overT * 1.5, 0, 1) * clamp(1 - (A.overT - 9) / 3, 0, 1);
        this.heaps.visible = true; this.heaps.scale.y = Math.max(0.01, clamp((A.overT - 0.6) / 5, 0, 1) ** 0.7);
        this.curtain.u.uTime.value += dt;
        // powder blasting in between the pillars
        if (rand() < dt * 10) { const x = head.x + range(-14, 18); this.billow.spawn({ x, y: GALLERY.y + range(0.5, 2.5), z: GALLERY.z1 + 1.5, vx: range(-1, 1), vy: range(0, 0.6), vz: -range(2, 4), s0: 1.0, s1: range(2.2, 3.2), life: 1.8, tone: range(0.3, 0.7), a: 0.5, drag: 1.2 }); }   // spray bursting in at the openings, not a fog in the gallery
      }
    }
  }
  _updConvoy(dt) {
    if (!this.ridge.root.visible) return;
    const T = this.g.time;
    for (const c of this.ridge.cats) {
      if (c.alive) { c.z += c.v * dt; c.obj.position.set(c.x, terrainAt(c.x, c.z), c.z); const e = 3, gz = terrainAt(c.x, c.z + e) - terrainAt(c.x, c.z - e); c.obj.rotation.set(Math.atan2(gz, 2 * e), Math.PI, 0, 'YXZ'); }
      else if (c.tumble > 0 && this.av.on) { c.tumble += dt; const z = this.av.zfAt(c.x) - 6; c.obj.position.set(c.x + Math.sin(c.tumble) * 4, terrainAt(c.x, z) + 8 + Math.sin(c.tumble * 3) * 4, z); c.obj.rotation.x += dt * 3; c.obj.rotation.z += dt * 2; if (c.tumble > 4) { c.obj.visible = false; c.tumble = 0; } }
      c.obj.updateMatrixWorld(true);
      c.hl.forEach((h, i) => { h.p.set(i ? 1.0 : -1.0, 1.6, -3.0).applyMatrix4(c.obj.matrixWorld); h.dead = !c.alive && (c.tumble <= 0 || Math.sin(T * 30 + i) > 0); });
    }
  }

  // ================================================================== the railcar in the gallery (the way out)
  _makeRailcar() {
    const root = new THREE.Group();
    const b = new Bucket(), l = new Bucket();
    const red = [0.45, 0.12, 0.08], cream = [0.85, 0.8, 0.68];
    b.add(rbox(2.6, 1.2, 9, 0.1), M4(0, 0.9, 0), red);
    b.add(rbox(2.6, 1.2, 9, 0.1), M4(0, 2.4, 0), (p) => (p.y > 2.9 ? red : cream));
    b.add(rbox(2.7, 0.3, 9.1, 0.12), M4(0, 3.1, 0), [0.25, 0.25, 0.26]);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) l.add(new THREE.PlaneGeometry(1.1, 0.8), M4(s * 1.31, 2.35, -3.4 + i * 1.35, 0, s * Math.PI / 2, 0), [0.9, 0.6, 0.3]);
    for (const s of [-0.8, 0.8]) l.add(new THREE.CircleGeometry(0.18, 10), M4(s, 1.2, 4.51, 0, 0, 0), [3, 2.7, 2.2]);
    root.add(b.mesh(mats.paint()), l.mesh(mats.lamp(), { shadow: false }));
    root.position.set(RAILCAR.x, GALLERY.y + 0.2, RAILCAR.z);
    root.rotation.y = -Math.PI / 2;        // front (+z local) toward -x (into the gallery)
    this.g.scene.add(root);
    const glows = [new THREE.Vector3(-0.8, 1.2, 4.7), new THREE.Vector3(0.8, 1.2, 4.7)].map(p => ({ local: p, g: { p: new THREE.Vector3(), color: [3.0, 2.6, 2.0], size: 2.4 } }));
    for (const gl of glows) this.world.glowList.push(gl.g);
    let driver = null;
    try { driver = new Driver({ seed: 3 }); driver.root.position.set(-0.4, 0.4, 3.4); driver.root.rotation.y = 0; root.add(driver.root); } catch (e) { /* no driver */ }
    const R = { root, glows, driver, state: 'wait', t: 0, x: RAILCAR.x, dst: { steer: 0, bump: 0, talking: false, lookBack: 0, flinch: 0, time: 0 } };
    return R;
  }
  canBoardRail() { const R = this.railcar, h = this.g.headPos; return R.state === 'wait' && Math.abs(h.x - R.x) < 7.5 && Math.abs(h.z - RAILCAR.z) < 2.8; }
  boardRail() {
    const R = this.railcar, g = this.g;
    if (R.state !== 'wait') return;
    R.state = 'board'; R.t = 0;
    g.loco.enabled = false;
    if (g.player.mode === 'vr') g.hud.black.material.opacity = 1; else { g.player.camDip = 0.6; g.player.camDipRate = 1.6; }
    g.events.push({ type: 'railBoard' });
  }
  get onRail() { const s = this.railcar.state; return s === 'board' || s === 'go'; }
  _updRail(dt) {
    const R = this.railcar, g = this.g;
    R.t += dt;
    if (R.state === 'board' && R.t > 0.5) { R.state = 'go'; R.t = 0; g.hud.black.material.opacity = 0; }
    if (R.state === 'go') { const end = GALLERY.portal + 24; R.v = R.x < end - 14 ? Math.min(9, (R.v || 0) + dt * 1.5) : Math.max(0, R.v - dt * 4); R.x = Math.min(end, R.x + R.v * dt); R.root.position.x = R.x; }   // it stops inside the dark tunnel (the outro card is up by then)
    R.root.updateMatrixWorld(true);
    for (const gl of R.glows) gl.g.p.copy(gl.local).applyMatrix4(R.root.matrixWorld);
    if (R.driver) { R.dst.time += dt; R.dst.talking = !!g.hud.subT && g.hud.subT > 0; R.driver.update(dt, R.dst); }
  }

  // ================================================================== per frame
  update(dt) {
    const g = this.g;
    this._updRide(dt);
    this._updEnemyCab(dt);
    this._updWhip(dt);
    this._updAval(dt);
    this._updConvoy(dt);
    this._updRail(dt);
    this._updFires(dt);
    scourU.value = this.av.on ? this.av.zf - 20 : -1e9;
    this.billow.update(dt, g.camera, SUN_DIR, { fog: g.scene.fog, light: Math.max(0.3, 1 - g.storm * 0.8), time: g.time });
    // fog flash (the storm lit from inside by a big fire)
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 0.9); g.fogFlash = this.flash; } else g.fogFlash = 0;
  }
  _updFires(dt) {
    const g = this.g, fx = g.fx, head = g.headPos;
    let gi = 0;
    const G = this.glowB;
    const near = [];
    for (const F of this.fires) {
      F.t = (F.t || 0) + dt;
      if (F.life && F.t > F.life) continue;
      const d = F.p.distanceTo(head);
      if (d > (F.far ? 400 : 150)) continue;
      const k = F.life && F.life < 900 ? clamp(1 - (F.t - F.life * 0.7) / (F.life * 0.3), 0, 1) : 1;
      if (rand() < dt * 22 * F.size * k) fx.flame(_v.copy(F.p).add(_v2.set(range(-0.6, 0.6) * F.size, range(0, 0.4), range(-0.6, 0.6) * F.size)), F.size * range(0.7, 1.1));
      if (rand() < dt * 5 * k) fx.smoke(_v.copy(F.p).setY(F.p.y + F.size * 1.2), F.size * 1.1, 0.1, 4, 2, 0.75);
      if (F.col && rand() < dt * 0.9 * k) { const s0 = range(2.5, 3.5) * F.size * 0.7; g.clouds.spawn({ x: F.p.x + range(-0.5, 0.5), y: F.p.y + F.size * 2 + 1, z: F.p.z + range(-0.5, 0.5), vx: g.weather.wind.x * 0.25, vy: range(3, 4.5), vz: g.weather.wind.z * 0.25, drag: 0.12, buoy: 0.25, s0, s1: s0 * range(5, 7), life: range(8, 11), a: 0.8, fadeIn: 0.1, fadeOut: 0.5, vrot: range(-0.15, 0.15), r: 0.07, g: 0.064, b: 0.06, r1: 0.16, g1: 0.15, b1: 0.15, glow: 0.9, glowFade: 4 }); }
      if (gi < G.max - 8) { const fl = 0.8 + 0.2 * Math.sin(g.time * 17 + F.p.x) * Math.sin(g.time * 23.7); G.set(gi++, F.p.x, F.p.y + F.size * 0.8, F.p.z, F.size * 4 * fl * k, F.size * 4 * fl * k, 0, CELL.GLOW, 0, 1.4, 0.6, 0.2, 0.7); }
      if (F.light && d < 30) near.push({ p: F.p, k: F.light * k, d });
    }
    // flares: red fire + a thin smoke thread downwind
    for (const f of this.flares) {
      if (f.p.distanceToSquared(head) > 90 * 90) continue;
      f.t += dt;
      if (rand() < dt * 10) fx.main.spawn({ x: f.p.x, y: f.p.y + 0.05, z: f.p.z, vx: range(-0.2, 0.2), vy: range(0.6, 1.2), vz: range(-0.2, 0.2), frame: CELL.GLOW, s0: 0.25, s1: 0.05, life: 0.4, r: 3.4, g: 0.4, b: 0.2, a: 1, fadeOut: 0.6 });
      if (rand() < dt * 6) fx.main.spawn({ x: f.p.x, y: f.p.y + 0.2, z: f.p.z, vx: g.weather.wind.x * 0.4, vy: range(0.8, 1.4), vz: g.weather.wind.z * 0.4, drag: 0.3, frame: CELL.WISP, s0: 0.2, s1: range(1.5, 2.5), life: range(2, 3), rot: rand() * 6, r: 0.5, g: 0.22, b: 0.2, a: 0.35, fadeIn: 0.1, fadeOut: 0.6 });
    }
    // chimney smoke from the Berghaus
    for (const c of this.chimneys) if (c.distanceToSquared(head) < 160 * 160 && rand() < dt * 1.5) fx.main.spawn({ x: c.x, y: c.y, z: c.z, vx: g.weather.wind.x * 0.3, vy: range(0.8, 1.4), vz: g.weather.wind.z * 0.3, drag: 0.2, frame: CELL.WISP, s0: 0.8, s1: range(4, 6), life: range(3, 5), rot: rand() * 6, r: 0.2, g: 0.2, b: 0.22, a: 0.45, fadeIn: 0.15, fadeOut: 0.6 });
    // headlamps on the gunmen (the storm makes them readable at 40 m)
    for (const s of g.soldiers) {
      if (!s.alive || s.role === 'deck' || gi >= G.max - 2 || !s.lamp) continue;
      if (s.pos.distanceToSquared(head) > 90 * 90) continue;
      s.gm.headCenter.getWorldPosition(_v);
      _v2.set(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
      _v.addScaledVector(_v2, 0.2).y += 0.09;
      G.set(gi++, _v.x, _v.y, _v.z, 0.22, 0.22, 0, CELL.GLOW, 0, 2.8, 2.2, 1.3, 1);
    }
    G.commit(gi);
    // the two warm point lights go to the nearest fires
    near.sort((a, b) => a.d - b.d);
    this.lights.forEach((L, i) => {
      const n = near[i];
      if (n) { L.p.copy(n.p).setY(n.p.y + 1.5); L.k = damp(L.k, 9 * n.k * (0.85 + 0.15 * Math.sin(g.time * 19 + i * 3)), 6, dt); } else L.k = damp(L.k, 0, 3, dt);
      L.l.position.copy(L.p); L.l.intensity = L.k;
    });
    // flakes catch the nearest fire
    g.weather.warm(near[0] ? near[0].p : null, 12);
  }
  afterPlayer(rdt, dt) {
    const g = this.g;
    // no snow falling inside our cabin (roof slot 9 follows it)
    { const C = this.cab.root.position; const U = g.weather.u; U.uRoof.value[9].set(C.x - CABIN.w / 2, C.z - CABIN.l / 2, C.x + CABIN.w / 2, C.z + CABIN.l / 2); U.uRoofY.value[9] = this.cab.root.visible ? C.y + CABIN.h + 0.4 : -1e6; }
    if (this.riding) {
      const C = this.cab, R = C.root;
      R.updateMatrixWorld(true);
      if (!this.cabLocal) {
        // first frame aboard: wherever you stepped in
        _inv.copy(R.matrixWorld).invert();
        this.cabLocal = _v4.copy(g.rig.position).applyMatrix4(_inv).clone().setY(0);
      } else {
        // what the stick moved you since we last put you down, turned into the cabin's frame
        _v.subVectors(g.rig.position, this.cabLast).setY(0);
        _q.copy(R.quaternion).invert(); _v.applyQuaternion(_q);
        this.cabLocal.add(_v);
      }
      const mx = CABIN.w / 2 - 0.38, mz = CABIN.l / 2 - 0.38;
      this.cabLocal.x = clamp(this.cabLocal.x, -mx, mx); this.cabLocal.z = clamp(this.cabLocal.z, -mz, mz); this.cabLocal.y = 0;
      const p = _v.copy(this.cabLocal).applyMatrix4(R.matrixWorld);
      g.rig.position.set(p.x, R.position.y, p.z);
      g.rig.updateMatrixWorld(true);
      (this.cabLast ||= new THREE.Vector3()).copy(g.rig.position);
    } else if (this.onRail) {
      const R = this.railcar;
      const p = _v.set(0.5, 0.25, -1.5).applyMatrix4(R.root.matrixWorld);
      g.rig.position.copy(p); g.rig.updateMatrixWorld(true);
    }
  }
}
