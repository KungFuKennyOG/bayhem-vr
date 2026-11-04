import * as THREE from 'three';
import { rand, range, pick, chance, clamp, damp } from '../../rng.js';
import { Ragdoll, Gunman } from '../../characters.js';
import { RigidBox } from '../../physics.js';
import { CELL } from '../../particles.js';
import { bulletHoleTexture } from '../../textures.js';
import { MAT } from '../../vehicles.js';
import { applyDusk, setSunElevation } from '../../atmosphere.js';
// The on-foot soldier AI (cover, peeking, flanking, grenades) comes from Level 2.
// TODO(level-2 merge): move port-of-victory/ai.js to src/ once Level 2 lands — it's engine code now.
import { Soldier, buildCoverPoints } from '../port-of-victory/ai.js';
import { buildRefueler, gseMaterials } from './gse.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
export const SUN_AZ = new THREE.Vector3(-0.22, 0, -1).normalize(); // the sun sits just left of the runway heading
export const sunElevation = (dusk) => 6.0 - dusk * 9.0;

export function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}
// ray vs oriented box given by a world matrix and local AABB -> t or -1
const _inv = new THREE.Matrix4(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
export function rayOBB(o, d, matWorld, min, max) {
  _inv.copy(matWorld).invert();
  _ro.copy(o).applyMatrix4(_inv); _rd.copy(d).transformDirection(_inv);
  let t0 = 0, t1 = 1e9;
  for (let a = 0; a < 3; a++) {
    const oa = _ro.getComponent(a), da = _rd.getComponent(a), lo = min[a], hi = max[a];
    if (Math.abs(da) < 1e-9) { if (oa < lo || oa > hi) return -1; continue; }
    let ta = (lo - oa) / da, tb = (hi - oa) / da; if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return -1;
  }
  return t0 > 0 ? t0 : -1;
}

// =====================================================================================
//  AIRPORT NO RETURN — combat sandbox: soldiers, grenades, fuel drums, JET A-1 refuelers,
//  bullet holes, scoring, slow-mo. Jets, the jeep chase and the cargo plane live in setpieces.js.
// =====================================================================================
export class AirportGame {
  constructor(E, world) {
    Object.assign(this, { scene: E.scene, fx: E.fx, hud: E.hud, audio: E.audio, rig: E.rig, camera: E.camera, params: E.params, world, E });
    this.col = world.col;
    this.trailer = E.params.has('trailer');
    this.soldiers = []; this.grenades = []; this.nades = []; this.ragdolls = []; this.props = []; this.flyers = []; this.trucks = [];
    this.targets = [];
    this.time = 0; this.timeScale = 1; this.slowT = 0; this.slowCool = 0; this.slowScale = 1;
    this.score = 0; this.kills = 0; this.headshots = 0; this.drumsBlown = 0; this.jetsDown = 0; this.carsDown = 0; this.combo = 0; this.comboT = 0;
    this.hp = 100; this.hurtT = 9; this.hurtFlash = 0; this.downed = false;
    this.headPos = new THREE.Vector3(0, 1.65, 0);
    this.playerFwd = new THREE.Vector3(0, 0, -1);
    this.lastExplosionT = -10; this.lastExplosionShake = 0.8;
    this.recentExplosions = [];
    this.nadeCool = 6;
    this.dusk = 0.0;
    this.events = [];
    this.bossInfo = null;
    this.smokeCols = [];   // persistent burning wrecks: { p, k, life }
    this.fx.onSound = (n, p) => this.audio.play(n, p ? { x: p.x, y: p.y, z: p.z } : {});
    this.fx.setGround(world.fastGround);
    Ragdoll.world = this.col;
    this._initHoles();
    this._initDrums();
    this._initTrucks();
    world.buildNav();
    this.cover = buildCoverPoints(this.col, world.nav, { y: 0 });
  }

  // ---------------------------------------------------------------- bullet holes (instanced decals)
  _initHoles() {
    const g = new THREE.PlaneGeometry(0.11, 0.11);
    const m = new THREE.MeshBasicMaterial({ map: bulletHoleTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, color: 0xffffff });
    this.holes = new THREE.InstancedMesh(g, m, 400); this.holes.count = 0; this.holes.frustumCulled = false; this.holes.renderOrder = 4;
    this.scene.add(this.holes); this.holeN = 0;
  }
  addHole(p, n) {
    _q.setFromUnitVectors(_v.set(0, 0, 1), n);
    _m.compose(_v2.copy(p).addScaledVector(n, 0.012), _q, _v3.setScalar(0.7 + rand() * 0.7));
    this.holes.setMatrixAt(this.holeN % 400, _m); this.holeN++;
    this.holes.count = Math.min(400, this.holeN); this.holes.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- explosive drums
  _initDrums() {
    const geo = new THREE.CylinderGeometry(0.29, 0.29, 0.88, 14); geo.translate(0, 0.44, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa3170f, metalness: 0.5, roughness: 0.45 });
    this.drumGeo = geo; this.drumMat = mat; this.drumBurnt = MAT.charred || mat;
    const list = [];
    for (const [cx, cz, n, lay] of this.world.drumSpots || []) {
      for (let i = 0; i < n; i++) {
        let x = cx, z = cz, y = 0;
        if (lay === 'pallet') { x += (i % 2 - 0.5) * 0.62; z += (Math.floor(i / 2) % 2 - 0.5) * 0.62; y = 0.14; }
        else if (lay === 'row') { x += (i - n / 2) * 0.64 + range(-0.05, 0.05); z += range(-0.1, 0.1); }
        else { const ring = i < 4 ? 0 : 1; const k = ring ? i - 4 : i; x += (k % 2 - 0.5) * 0.62 + (ring ? 0.31 : 0); z += (Math.floor(k / 2) - 0.5) * 0.62; y = ring ? 0.9 : 0; }
        const d = { pos: new THREE.Vector3(x, y, z), yaw: rand() * 6.28, tilt: 0, hp: 2, state: 'ok', fuse: 0, i: list.length, leakT: 0 };
        d.box = this.col.add([x - 0.3, y, z - 0.3], [x + 0.3, y + 0.88, z + 0.3], { kind: 'drum', mat: 'drum', ref: d, small: true });
        list.push(d);
      }
    }
    this.drums = list;
    this.drumCap = list.length + 24;
    this.drumMesh = new THREE.InstancedMesh(geo, mat, this.drumCap);
    this.drumMesh.castShadow = true; this.drumMesh.receiveShadow = true; this.drumMesh.frustumCulled = false;
    this.scene.add(this.drumMesh);
    this._drumsDirty = true;
  }
  addDrum(pos, opts = {}) {
    const d = { pos: pos.clone(), yaw: rand() * 6.28, tilt: 0, hp: 2, state: 'ok', fuse: 0, i: this.drums.length, leakT: 0, ...opts };
    if (this.drums.length >= this.drumCap) return d;
    this.drums.push(d); this._drumsDirty = true; return d;
  }
  _writeDrums() {
    this.drums.forEach((d, i) => {
      if (d.state === 'gone' || d.hidden) _m.makeScale(0, 0, 0);
      else if (d.obj) { d.obj.updateWorldMatrix(true, false); _m.copy(d.obj.matrixWorld); }
      else { _q.setFromEuler(new THREE.Euler(d.tilt, d.yaw, 0)); _m.compose(d.pos, _q, _v.set(1, 1, 1)); }
      this.drumMesh.setMatrixAt(i, _m);
    });
    this.drumMesh.count = this.drums.length;
    this.drumMesh.instanceMatrix.needsUpdate = true;
  }
  hitDrum(d, P, n) {
    if (d.state === 'gone' || d.state === 'burning') return;
    d.hp -= 1;
    this.audio.play('barrel_hit', { x: P.x, y: P.y, z: P.z, volume: 0.9 });
    if (d.state === 'ok') { d.state = 'leak'; d.leakN = n.clone(); d.leakP = P.clone(); d.leakT = 0; this.audio.play('barrel_hiss', { x: P.x, y: P.y, z: P.z, volume: 0.8 }); }
    if (d.hp <= 0) this.igniteDrum(d, range(0.05, 0.25));
  }
  igniteDrum(d, delay = 0) { if (d.state === 'gone' || d.state === 'burning') return; d.state = 'burning'; d.fuse = delay; }
  _updateDrums(dt) {
    let dirty = this._drumsDirty; this._drumsDirty = false;
    for (const d of this.drums) {
      if (d.obj) dirty = true;
      if (d.state === 'leak' && d.leakP) {
        d.leakT += dt;
        if (rand() < dt * 30) this.fx.main.spawn({ x: d.leakP.x, y: d.leakP.y, z: d.leakP.z, vx: d.leakN.x * 2 + range(-0.3, 0.3), vy: range(-0.5, 0.6), vz: d.leakN.z * 2 + range(-0.3, 0.3), grav: -9, drag: 0.5, frame: CELL.WISP, s0: 0.06, s1: 0.18, life: 0.5, r: 0.55, g: 0.48, b: 0.3, a: 0.6, fadeOut: 0.5 });
        if (d.leakT > 3.5) this.igniteDrum(d, 0);
      }
      if (d.state === 'burning') {
        d.fuse -= dt;
        const P = d.obj ? d.obj.getWorldPosition(_v2) : d.pos;
        if (d.fuse > 0 && rand() < dt * 25) this.fx.flame(_v.set(P.x, P.y + 0.95, P.z), 0.45);
        if (d.fuse <= 0) this.explodeDrum(d);
      }
    }
    for (const f of this.flyers) {
      f.rb.floorY = 0;
      f.rb.step(dt, 0);
      f.mesh.position.copy(f.rb.pos); f.mesh.quaternion.copy(f.rb.quat);
      f.life -= dt;
      this.fx.trailEmit(f, f.rb.pos, 0.35, (q) => { this.fx.flame(q, 0.55); if (rand() < 0.5) this.fx.smoke(q, 0.8, 0.14, 2.4, 0.6, 0.7); }, 0);
      const hit = this.col.collidePoint(_v.copy(f.rb.pos), 0.45, _hitOut).hit;
      if ((f.rb.onGround && f.age > 0.4) || hit || f.life <= 0) { f.dead = true; this.scene.remove(f.mesh); if (f.boom) this.boom(f.rb.pos.clone().setY(Math.max(f.rb.pos.y, 0.5)), 0.8, { radius: 5, dmg: 40 }); }
      f.age += dt;
    }
    this.flyers = this.flyers.filter(f => !f.dead);
    if (dirty) this._writeDrums();
  }
  explodeDrum(d) {
    if (d.state === 'gone') return;
    d.state = 'gone';
    if (d.box) this.col.remove(d.box);
    this.drumsBlown++;
    const P = (d.obj ? d.obj.getWorldPosition(new THREE.Vector3()) : d.pos.clone()); P.y += 0.5;
    this.audio.play('barrel_explode', { x: P.x, y: P.y, z: P.z });
    this.boom(P, 1.05, { radius: 6.5, dmg: 70, src: d, drum: true });
    if (chance(0.45) && this.flyers.length < 6) {
      const mesh = new THREE.Mesh(this.drumGeo, this.drumBurnt); mesh.castShadow = true; this.scene.add(mesh);
      const rb = new RigidBox(0.29, 0.44, 0.29, 1);
      rb.pos.copy(P); rb.vel.set(range(-5, 5), range(11, 16), range(-5, 5)); rb.ang.set(range(-9, 9), range(-6, 6), range(-9, 9)); rb.restitution = 0.3;
      if (d.vel) rb.vel.add(d.vel);
      this.flyers.push({ mesh, rb, life: 4, age: 0, boom: chance(0.6) });
    }
    this.addScore(150, this.drumsBlown % 4 === 0 ? 'CHAIN REACTION!' : null, P.clone().setY(P.y + 2), 'big');
  }

  // ---------------------------------------------------------------- JET A-1 refuelers: leak, burn, BLOW (and flip)
  _initTrucks() {
    const mats = gseMaterials();
    for (const [x, z, ry] of this.world.refuelerSpots || []) this.spawnTruck(x, z, ry, mats);
  }
  spawnTruck(x, z, ry, mats = gseMaterials()) {
    const b = buildRefueler();
    const root = new THREE.Group(); const mesh = new THREE.Mesh(b.geometry, mats.slice()); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    root.position.set(x, 0, z); root.rotation.y = ry; this.scene.add(root); root.updateMatrixWorld(true);
    const t = { root, mesh, b, hp: 14, state: 'ok', leaks: [], fireT: 0, fuse: 0, boxes: [] };
    t.boxes = this.col.addFromObject(b.colliders, root.matrixWorld, { kind: 'truck', mat: 'metal', ref: t });
    this.trucks.push(t);
    this.targets.push({
      name: 'truck', ref: t, active: () => t.state !== 'gone' && t.state !== 'wreck',
      ray: () => -1, // bullets use the collision boxes (kind 'truck')
      aim: () => t.root.localToWorld(_v.copy(b.anchors.tank)),
      near: (p) => t.state !== 'gone' && t.root.worldToLocal(_v.copy(p)).length() < 6,
      blast: () => this.damageTruck(t, 8, null),
      auto: (head, A) => {
        if (t.state === 'wreck' || t.state === 'gone') return null;
        const p = t.root.localToWorld(new THREE.Vector3().copy(b.anchors.tank)); const d = p.distanceTo(head);
        if (d < 16 || d > 60) return null;
        const near = this.soldiers.filter(s => s.alive && s.delay <= 0 && s.pos.distanceTo(p) < 9).length;
        if (!near) return null;
        if (!this.col.visible(head, p, bx => bx.data.noBullet || bx.data.ref === t)) return null;
        return { kind: 'target', p, score: 70 + near * 25, ref: this.targets.find(tg => tg.ref === t), heavy: true, minNade: 14, tol: 0.05 };
      },
    });
    return t;
  }
  damageTruck(t, amount, P, n) {
    if (t.state === 'gone' || t.state === 'wreck') return;
    t.hp -= amount;
    if (P) {
      this.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.7, pitch: 0.8 });
      // fuel squirts out of the tank where you hit it
      if (t.leaks.length < 4 && P.y > 1.1 && P.y < 3.1) { t.leaks.push({ p: P.clone(), n: (n || UP).clone() }); this.audio.play('barrel_hiss', { x: P.x, y: P.y, z: P.z, volume: 0.9 }); }
    }
    if (t.hp < 7 && t.state === 'ok') { t.state = 'burning'; t.fuse = range(1.8, 2.6); this.callout('IT\'S GONNA BLOW!', t.root.localToWorld(_v.set(0, 5, 0)).clone(), 'small'); this.audio.play('fuel_whoomp', { x: t.root.position.x, y: 2, z: t.root.position.z, volume: 0.8 }); }
    if (t.hp <= 0 && t.state !== 'boom') { t.state = 'boom'; t.fuse = Math.min(t.fuse || 0.2, 0.2); }
  }
  explodeTruck(t) {
    t.state = 'wreck';
    const P = t.root.localToWorld(new THREE.Vector3(0, 2.0, 1.2));
    this.audio.play('fuel_whoomp', { x: P.x, y: P.y, z: P.z, volume: 1 });
    this.boom(P, 2.2, { radius: 13, dmg: 80, truck: t });
    this.fx.later(0.12, () => this.fx.explosion(t.root.localToWorld(new THREE.Vector3(0, 2.6, -2.4)), 1.4));
    this.fx.later(0.3, () => this.fx.explosion(t.root.localToWorld(new THREE.Vector3(0, 3.5, 4)), 1.2));
    // burning fuel carpet
    for (let k = 0; k < 14; k++) this.fx.later(k * 0.05, () => { const a = rand() * 6.28, r = range(2, 9); this.fx.explosion(_v.set(P.x + Math.cos(a) * r, 0.4, P.z + Math.sin(a) * r).clone(), range(0.35, 0.6), { noRing: true }); });
    // the truck jumps and flips (rigid box), charred
    for (const bx of t.boxes) this.col.remove(bx);
    t.mesh.material = t.mesh.material.map(() => MAT.charred);
    const rb = new RigidBox(t.b.half.x, t.b.half.y, t.b.half.z, 8);
    t.root.updateMatrixWorld(true);
    rb.pos.copy(t.root.localToWorld(t.b.com.clone())); rb.quat.copy(t.root.quaternion);
    rb.vel.set(range(-2, 2), range(9, 12), range(-2, 2)); rb.ang.set(range(-1.5, 1.5), range(-1, 1), range(-2.5, 2.5)); rb.restitution = 0.15;
    t.rb = rb; t.com = t.b.com.clone();
    this.smokeCols.push({ p: P.clone().setY(1), k: 1.2, life: 60, fire: 1.0 });
    this.addScore(800, 'FUEL TRUCK!', P.clone().setY(P.y + 6), 'huge');
    this.events.push({ type: 'truckBoom', t });
  }
  _updateTrucks(dt) {
    for (const t of this.trucks) {
      if (t.state === 'ok' || t.state === 'burning' || t.state === 'boom') {
        for (const L of t.leaks) if (rand() < dt * 40) this.fx.main.spawn({ x: L.p.x, y: L.p.y, z: L.p.z, vx: L.n.x * 4 + range(-0.4, 0.4), vy: range(0.2, 1.4), vz: L.n.z * 4 + range(-0.4, 0.4), grav: -9.8, drag: 0.3, frame: CELL.WISP, s0: 0.08, s1: 0.3, life: 0.6, r: 0.6, g: 0.52, b: 0.32, a: 0.55, fadeOut: 0.5 });
        if (t.leaks.length && t.state === 'ok') { t.leakT = (t.leakT || 0) + dt; if (t.leakT > 6) this.damageTruck(t, 8, null); }
      }
      if (t.state === 'burning' || t.state === 'boom') {
        t.fuse -= dt;
        if (rand() < dt * 30) { const L = t.leaks[0]; const p = L ? L.p : t.root.localToWorld(_v.set(range(-1, 1), 2.6, range(-1, 3))); this.fx.flame(_v2.copy(p), 0.7); if (rand() < 0.4) this.fx.smoke(_v2, 1.0, 0.12, 2.5, 2, 0.6); }
        if (t.fuse <= 0) this.explodeTruck(t);
      }
      if (t.rb) {
        t.rb.floorY = 0; t.rb.step(dt, 0);
        t.root.quaternion.copy(t.rb.quat);
        t.root.position.copy(t.rb.pos).sub(_v.copy(t.com).applyQuaternion(t.rb.quat));
        if (t.rb.contactSpeed > 3) { if ((t.lastThud ?? -9) < this.time - 0.4) { t.lastThud = this.time; this.audio.play('metal_crash', { x: t.rb.pos.x, y: 1, z: t.rb.pos.z, volume: 0.8 }); this.fx.ring(t.rb.pos, 8, 0.4, 0); } }
        if (t.rb.onGround && t.rb.vel.lengthSq() < 0.1 && t.rb.ang.lengthSq() < 0.05) {
          // settle: re-add a collision box around the wreck
          t.root.updateMatrixWorld(true);
          t.boxes = this.col.addFromObject([{ min: [-1.3, 0, -4.6], max: [1.3, 2.8, 6.4] }], new THREE.Matrix4().makeTranslation(t.root.position.x, 0, t.root.position.z).multiply(new THREE.Matrix4().makeRotationY(Math.round(new THREE.Euler().setFromQuaternion(t.root.quaternion, 'YXZ').y / (Math.PI / 2)) * Math.PI / 2)), { kind: 'wreck', mat: 'metal' });
          t.rb = null;
        }
      }
    }
  }

  // ---------------------------------------------------------------- spawning
  spawnSoldier(o) { const s = new Soldier(this, o); this.soldiers.push(s); return s; }
  enemiesAlive(filter) { return this.soldiers.filter(s => s.alive && (!filter || filter(s))).length; }

  // ---------------------------------------------------------------- player weapons
  fireRay(origin, dir) {
    let best = { t: 400, kind: 'none' };
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const gm = s.gm;
      if (s.pos.distanceToSquared(origin) > 300 * 300) continue;
      gm.headCenter.getWorldPosition(_v);
      let t = raySphere(origin, dir, _v, 0.17); if (t > 0 && t < best.t) best = { t, kind: 'head', s };
      gm.chestCenter.getWorldPosition(_v);
      t = raySphere(origin, dir, _v, 0.3); if (t > 0 && t < best.t) best = { t, kind: 'body', s };
      gm.bones[0].getWorldPosition(_v); _v.y -= 0.05;
      t = raySphere(origin, dir, _v, 0.24); if (t > 0 && t < best.t) best = { t, kind: 'body', s };
      gm.bones[14].getWorldPosition(_v); t = raySphere(origin, dir, _v, 0.14); if (t > 0 && t < best.t) best = { t, kind: 'leg', s };
      gm.bones[17].getWorldPosition(_v); t = raySphere(origin, dir, _v, 0.14); if (t > 0 && t < best.t) best = { t, kind: 'leg', s };
    }
    for (const tg of this.targets) {
      if (!tg.active()) continue;
      const t = tg.ray(origin, dir);
      if (t > 0 && t < best.t) best = { t, kind: 'target', target: tg };
    }
    const hit = this.col.raycast(origin, dir, best.t, (b) => b.data.noBullet);
    if (hit) {
      const d = hit.box.data;
      best = { t: hit.t, kind: d.kind === 'drum' ? 'drum' : d.kind === 'truck' ? 'truck' : 'world', box: hit.box, normal: hit.normal, mat: d.mat };
    }
    if (best.kind === 'none' && dir.y < 0) {
      const t = (0 - origin.y) / dir.y;
      if (t > 0 && t < best.t) best = { t, kind: 'ground', normal: UP };
    }
    best.point = origin.clone().addScaledVector(dir, best.t);
    return best;
  }
  playerShot(origin, dir) {
    const hit = this.fireRay(origin, dir);
    const P = hit.point;
    this.fx.tracer(origin, P, { speed: 520, width: 0.04, len: 5 });
    switch (hit.kind) {
      case 'head': case 'body': case 'leg': {
        const s = hit.s;
        this.fx.impact(P, _v.copy(dir).negate(), 'body');
        this.audio.play('impact_flesh', { x: P.x, y: P.y, z: P.z, volume: 0.8 });
        this.hitMarker(hit.kind === 'head');
        if (s.hit(dir, hit.kind)) this.killSoldier(s, dir, hit.kind === 'head' ? 1.3 : 1, hit.kind === 'head');
        break;
      }
      case 'drum': { const d = hit.box.data.ref; this.fx.impact(P, hit.normal, 'metal'); this.addHole(P, hit.normal); this.hitDrum(d, P, hit.normal); this.hitMarker(false); break; }
      case 'truck': { const t = hit.box.data.ref; this.fx.impact(P, hit.normal, 'metal'); this.addHole(P, hit.normal); this.damageTruck(t, 1, P, hit.normal); this.hitMarker(false); break; }
      case 'world': {
        const mat = hit.mat || 'metal';
        this.fx.impact(P, hit.normal, mat === 'concrete' || mat === 'wood' ? 'ground' : 'metal');
        this.addHole(P, hit.normal);
        this.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.55, pitch: mat === 'concrete' ? 0.7 : 1 });
        break;
      }
      case 'target': hit.target.hit?.(P, dir); break;
      case 'ground': this.fx.impact(P, UP, 'ground'); break;
    }
    return hit;
  }
  launchGrenade(origin, dir) {
    const g = { pos: origin.clone(), vel: dir.clone().multiplyScalar(55), life: 4, armed: 0 };
    if (this.carrier) g.vel.add(this.carrier.vel); // fired from a moving jeep / plane
    g.vel.y += 1.2;
    this.grenades.push(g);
  }
  hitMarker(big) { this.hud.hitMarker(big); this.audio.play('hit_marker', { volume: big ? 1 : 0.6 }); }
  addScore(n, label, pos, style) {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 3.5;
    const mult = Math.min(5, this.combo);
    this.score += n * mult;
    if (label && pos) this.hud.callout(label, pos, style || 'big', mult > 1 ? `+${n * mult}  x${mult}` : `+${n}`);
  }
  callout(text, pos, style = 'big', sub = null) { this.hud.callout(text, pos, style, sub); }
  killSoldier(s, dir, power = 1, head = false, label = null) {
    if (!s.alive) return;
    this.kills++;
    if (head) this.headshots++;
    this.audio.play('kill_confirm', {});
    s.gm.chestCenter.getWorldPosition(_v);
    const P = _v.clone();
    this.addScore(head ? 150 : 100, label || (head ? 'HEADSHOT' : null), P.clone().setY(P.y + 1.1), 'small');
    const rd = s.die(dir, power, this.scene);
    this.ragdolls.push({ rd, thud: 0, s });
    this.events.push({ type: 'kill', s });
    if (this.ragdolls.length > 26) { const old = this.ragdolls.shift(); old.rd.dispose(); }
  }
  // ragdoll for a Gunman that isn't a ground Soldier (window gunners, ramp crew): vel = carrier velocity
  addCorpse(gm, vel, dir, power = 1.4) {
    const rd = gm.die(vel, dir, this.scene, power);
    this.ragdolls.push({ rd, thud: 0 });
    if (this.ragdolls.length > 26) { const old = this.ragdolls.shift(); old.rd.dispose(); }
    return rd;
  }

  // ---------------------------------------------------------------- explosions
  boom(P, size = 1, { radius = 7, dmg = 60, src = null, noRing = false, shake = null, player = true, truck = null } = {}) {
    this.fx.explosion(P, size, { noRing });
    this.recentExplosions.push(this.time);
    this.lastExplosionT = this.time;
    const dp = this.headPos.distanceTo(P);
    this.lastExplosionShake = shake ?? clamp(1.4 * size * (1 - dp / (60 * Math.max(1, size * 0.7))), 0.15, 1.6);
    this.haptic(Math.min(1, size * 0.8), 160);
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = s.pos.distanceTo(P);
      if (d < radius) {
        _v.subVectors(s.pos, P).setY(0).normalize().multiplyScalar(1.0).add(_v2.set(0, 0.9, 0)).normalize();
        this.killSoldier(s, _v.clone(), 2.2 + (1 - d / radius) * 2.5, false, d < radius * 0.6 ? pick(['KABOOM!', 'AIRBORNE!', 'YEET!']) : null);
      } else if (d < radius * 1.6) s.gm.hit(_v.subVectors(s.pos, P).normalize());
    }
    for (const d of this.drums) {
      if (d === src || d.state === 'gone' || d.obj) continue;
      const dd = d.pos.distanceTo(P);
      if (dd < radius * 0.85) this.igniteDrum(d, range(0.12, 0.32));
      else if (dd < radius * 1.3 && d.state === 'ok') { d.state = 'leak'; d.leakN = _v.subVectors(d.pos, P).normalize().clone(); d.leakP = d.pos.clone().setY(d.pos.y + 0.5); d.leakT = 2.5; }
    }
    for (const t of this.trucks) {
      if (t === truck || t.state === 'wreck' || t.state === 'gone') continue;
      const d = t.root.position.distanceTo(P);
      if (d < radius + 4) this.damageTruck(t, (1 - d / (radius + 4)) * 16 * size, null);
    }
    for (const tg of this.targets) if (tg.active() && tg.blastAt) tg.blastAt(P, size, radius);
    for (const r of this.ragdolls) {
      const rd = r.rd; if (rd.disposed) continue;
      const d = rd.position.distanceTo(P);
      if (d < radius * 1.5) { rd.asleep = false; rd.still = 0; const k = (1 - d / (radius * 1.5)) * 9; const x = rd.x, v = rd.v; for (let i = 0; i < rd.np; i++) { const j = i * 3; _v.set(x[j] - P.x, x[j + 1] - P.y + 1.2, x[j + 2] - P.z).normalize(); v[j] += _v.x * k; v[j + 1] += _v.y * k + 2; v[j + 2] += _v.z * k; } }
    }
    for (const p of this.props) { const d = p.rb.pos.distanceTo(P); if (d < radius * 1.5) { p.rb.vel.addScaledVector(_v.subVectors(p.rb.pos, P).normalize().add(UP), 10 * (1 - d / (radius * 1.5))); p.rb.ang.add(_v.set(range(-5, 5), range(-5, 5), range(-5, 5))); p.sleep = false; } }
    if (player && dp < radius * 0.75 && !this.invuln) this.hurt(Math.min(45, dmg * (1 - dp / (radius * 0.75))), P);
    if (dp < 10 * Math.max(1, size)) this.audio.play('ear_ring', { volume: 0.4 });
    const multi = this.recentExplosions.filter(t => this.time - t < 1.4).length >= 3;
    if (multi && this.slowCool <= 0) { this.slowmo(1.4, 0.3); this.callout('MULTI-KILL', P.clone().setY(P.y + 4), 'big'); }
    else if (dp < 14 && chance(0.4)) this.slowmo(0.9, 0.35);
    this.events.push({ type: 'boom', P: P.clone(), size });
  }
  hurt(amount, from) {
    if (this.god || this.invuln) return;
    if (this.trailer) amount *= 0.25;
    this.hp -= amount; this.hurtT = 0; this.hurtFlash = Math.min(1, this.hurtFlash + amount / 25);
    this.audio.play('player_hurt', { volume: Math.min(1, amount / 20) });
    this.haptic(0.8, 80);
    if (this.hp <= 0 && !this.downed) {
      this.downed = true; this.hp = 1;
      this.slowmo(1.6, 0.25, true);
      this.audio.play('radio_squelch', {});
      this.hud.subtitle('DRIVER', pick(["Get up! The plane's not gonna wait!", "Stay with me! Breathe! Shoot!", "Not today! Not on MY runway!"]), 3.5);
      this.fx.later(1.5, () => { this.hp = 100; this.downed = false; });
    }
  }
  slowmo(dur, scale, force = false) {
    if (!force && this.slowCool > 0) return;
    if (this.slowT <= 0) this.audio.play('slowmo_in', {});
    this.slowT = Math.max(this.slowT, dur);
    this.slowScale = scale;
    this.slowCool = dur + 4;
  }
  haptic(intensity, ms) { if (this.onHaptic) this.onHaptic(intensity, ms); }

  // ---------------------------------------------------------------- enemy fire (shared by soldiers, window gunners, ramp crew)
  enemyShot(s, dist, mzIn = null) {
    const mz = mzIn || s.gm.muzzle.getWorldPosition(new THREE.Vector3());
    _v.subVectors(this.headPos, mz).normalize();
    this.fx.muzzle(mz, _v, 'enemy', false);
    if (this.fx.lights.some(l => l.userData.life <= 0)) this.fx.light(mz, 6, 0.05, 0xffb060, true, 7);
    this.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, volume: 0.85 });
    const moving = this.playerSpeed || 0;
    let hitChance = clamp(0.16 - dist * 0.0028, 0.03, 0.16) * (moving > 2 && !this.carrier ? 0.55 : 1) * (this.trailer ? 0.55 : 1) * (s.role === 'rusher' ? 0.7 : 1) * (this.carrier ? 0.6 : 1);
    const target = this.headPos.clone();
    if (rand() < hitChance) {
      target.y -= 0.45;
      this.fx.tracer(mz, target, { speed: 330, color: [1.8, 0.5, 0.25], width: 0.05, len: 4 });
      this.fx.later(dist / 330, () => this.hurt(7, mz));
    } else {
      target.add(_v2.set(range(-1.3, 1.3), range(-0.9, 1.2), range(-1.3, 1.3)));
      _v3.subVectors(target, mz).normalize();
      const far = this.col.raycast(mz, _v3, dist + 40, b => b.data.noBullet || b.data.ref === s);
      let tEnd = far ? far.t : dist + 40;
      let gnd = false;
      if (_v3.y < 0) { const tg = (0 - mz.y) / _v3.y; if (tg > 0 && tg < tEnd) { tEnd = tg; gnd = true; } }
      const end = mz.clone().addScaledVector(_v3, tEnd);
      this.fx.tracer(mz, end, { speed: 330, color: [1.8, 0.5, 0.25], width: 0.05, len: 4 });
      const n = far && !gnd ? far.normal.clone() : UP;
      const kind = far && !gnd ? 'metal' : 'ground';
      this.fx.later(tEnd / 330, () => { this.fx.impact(end, n, kind); if (kind === 'metal') { this.addHole(end, n); if (end.distanceTo(this.headPos) < 8) this.audio.play('impact_metal', { x: end.x, y: end.y, z: end.z, volume: 0.5 }); } });
      const closest = _v2.subVectors(this.headPos, mz).dot(_v3);
      const cp = mz.clone().addScaledVector(_v3, closest);
      if (closest < tEnd && cp.distanceTo(this.headPos) < 1.8 && rand() < 0.55) this.fx.later(closest / 330, () => this.audio.play('whiz', { x: cp.x, y: cp.y, z: cp.z }));
      if (far && far.box.data.kind === 'drum' && chance(0.3)) { const d = far.box.data.ref; this.fx.later(tEnd / 330, () => this.hitDrum(d, end, n)); }
      // stray rounds into the jeep body: sparks right next to you
      if (this.carrier && chance(0.25)) { const p = this.carrier.randomHullPoint?.(); if (p) this.fx.later(dist / 330, () => { this.fx.impact(p, UP, 'metal'); this.audio.play('impact_metal', { x: p.x, y: p.y, z: p.z, volume: 0.6 }); }); }
    }
  }
  enemyGrenade(s) {
    s.gm.bones[8].getWorldPosition(_v);
    const P = _v.clone();
    const T = this.headPos.clone(); T.y = 0;
    T.x += range(-1.8, 1.8) + (this.playerVel?.x || 0) * 0.8; T.z += range(-1.8, 1.8) + (this.playerVel?.z || 0) * 0.8;
    const flight = clamp(P.distanceTo(T) / 13, 0.9, 1.7);
    const vel = new THREE.Vector3((T.x - P.x) / flight, (T.y - P.y + 0.5 * 9.8 * flight * flight) / flight, (T.z - P.z) / flight);
    this.nades.push({ pos: P, vel, fuse: 2.7, bounces: 0 });
    this.audio.play('grenade_pin', { x: P.x, y: P.y, z: P.z });
    if (chance(0.7)) this.fx.later(0.3, () => { this.callout('GRENADE!', T.clone().setY(T.y + 1.6), 'small'); });
  }
  _updateNades(dt) {
    let nearest = null, nd = 1e9;
    for (const n of this.nades) {
      n.fuse -= dt;
      n.vel.y -= 9.8 * dt;
      n.pos.addScaledVector(n.vel, dt);
      const c = this.col.collidePoint(n.pos, 0.06, _hitOut);
      if (n.pos.y < 0.06) { n.pos.y = 0.06; if (n.vel.y < -1.5) { n.vel.y *= -0.35; n.vel.x *= 0.6; n.vel.z *= 0.6; if (n.bounces++ < 3) this.audio.play('grenade_bounce', { x: n.pos.x, y: n.pos.y, z: n.pos.z }); } else { n.vel.y = 0; n.vel.x *= Math.exp(-dt * 4); n.vel.z *= Math.exp(-dt * 4); } }
      else if (c.hit) { const vn = n.vel.x * c.nx + n.vel.y * c.ny + n.vel.z * c.nz; if (vn < 0) { n.vel.x -= 1.4 * vn * c.nx; n.vel.y -= 1.4 * vn * c.ny; n.vel.z -= 1.4 * vn * c.nz; n.vel.multiplyScalar(0.6); if (n.bounces++ < 4) this.audio.play('grenade_bounce', { x: n.pos.x, y: n.pos.y, z: n.pos.z }); } }
      if (Math.sin(this.time * (14 + (2.7 - n.fuse) * 10)) > 0) this.fx.main.spawn({ x: n.pos.x, y: n.pos.y + 0.08, z: n.pos.z, frame: CELL.GLOW, s0: 0.35, life: 0.04, r: 3.5, g: 0.3, b: 0.1, a: 1, anchored: false });
      const d = n.pos.distanceTo(this.headPos);
      if (d < nd) { nd = d; nearest = n; }
      if (n.fuse <= 0) { n.dead = true; this.boom(n.pos.clone().setY(n.pos.y + 0.2), 0.8, { radius: 6, dmg: 60 }); }
    }
    this.nades = this.nades.filter(n => !n.dead);
    this.dangerNade = nearest && nd < 12 ? nearest : null;
    for (const g of this.grenades) {
      g.life -= dt;
      g.vel.y -= 9.8 * dt;
      const prev = _v2.copy(g.pos);
      g.pos.addScaledVector(g.vel, dt);
      _v.subVectors(g.pos, prev); const L = _v.length(); _v.divideScalar(L || 1);
      let boom = g.life <= 0;
      const hit = L > 0 ? this.col.raycast(prev, _v, L, b => b.data.noBullet && !b.data.noStand) : null;
      if (hit) { g.pos.copy(prev).addScaledVector(_v, Math.max(0, hit.t - 0.15)); boom = true; const d = hit.box.data; if (d.kind === 'drum') this.igniteDrum(d.ref, 0); if (d.kind === 'truck') this.damageTruck(d.ref, 9, g.pos, _v.clone().negate()); }
      if (g.pos.y <= 0.1) { g.pos.y = 0.25; boom = true; }
      for (const s of this.soldiers) if (s.alive && s.pos.distanceToSquared(g.pos) < 0.8 && Math.abs(g.pos.y - s.pos.y - 1) < 1.1) boom = true;
      for (const tg of this.targets) if (tg.active() && tg.near?.(g.pos)) { boom = true; tg.blast?.(g.pos); }
      this.fx.trailEmit(g, g.pos, 0.4, (q) => this.fx.main.spawn({ x: q.x, y: q.y, z: q.z, vy: 0.3, drag: 2, frame: CELL.WISP, s0: 0.12, s1: 0.6, life: 0.7, rot: rand() * 6, r: 0.8, g: 0.8, b: 0.8, a: 0.35, fadeOut: 0.3 }), 0);
      this.fx.main.spawn({ x: g.pos.x, y: g.pos.y, z: g.pos.z, frame: CELL.GLOW, s0: 0.35, life: 0.04, r: 3.6, g: 1.4, b: 0.5, a: 1, anchored: false });
      if (boom) { g.dead = true; this.boom(g.pos.clone(), 0.95, { radius: 7, dmg: 50 }); }
    }
    this.grenades = this.grenades.filter(g => !g.dead);
  }

  // ---------------------------------------------------------------- update
  update(rdt) {
    if (this.slowT > 0) { this.slowT -= rdt; if (this.slowT <= 0) this.audio.play('slowmo_out', {}); }
    this.slowCool -= rdt;
    const targetTS = this.slowT > 0 ? this.slowScale : 1;
    this.timeScale = damp(this.timeScale, targetTS, this.slowT > 0 ? 14 : 4, rdt);
    this.audio.setTimeScale(this.timeScale);
    const dt = rdt * this.timeScale;
    this.time += dt; this.dz = 0;
    this.comboT -= dt; this.nadeCool -= dt;
    this.recentExplosions = this.recentExplosions.filter(t => this.time - t < 2);
    this.hurtT += dt;
    if (this.hurtT > 2.5 && this.hp < 100) this.hp = Math.min(100, this.hp + 20 * dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - rdt * 1.2);
    this.playerVel ||= new THREE.Vector3();
    if (this._lastHead) { this.playerVel.subVectors(this.headPos, this._lastHead).divideScalar(Math.max(dt, 1e-4)).setY(0); this.playerSpeed = this.playerVel.length(); }
    (this._lastHead ||= new THREE.Vector3()).copy(this.headPos);
    this.camera.getWorldDirection(this.playerFwd); this.playerFwd.y = 0; this.playerFwd.normalize();

    for (const s of this.soldiers) s.update(dt);
    this._updateNades(dt);
    this._updateDrums(dt);
    this._updateTrucks(dt);
    this.setpieces?.update(dt);
    this._updateBodies(dt);
    this._ambient(dt);
    if (Math.abs((this._appliedDusk ?? -1) - this.dusk) > 0.002) {
      this._appliedDusk = this.dusk;
      setSunElevation(sunElevation(this.dusk), SUN_AZ);
      applyDusk(this.dusk, { sun: this.E.sun, hemi: this.E.hemi, fog: this.scene.fog, renderer: this.E.renderer });
      this.scene.environmentIntensity = 0.8 - this.dusk * 0.4;
    }
    this.world.update(dt, this.headPos, this.dusk);
    if (this.dangerNade) this.hud.danger(this.dangerNade.pos, this.headPos, this.camera.getWorldQuaternion(_q), 1);
    else this.hud.danger(null);
    return dt;
  }
  _updateBodies(dt) {
    for (const r of this.ragdolls) {
      r.rd.update(dt, 0);
      const imp = Math.max(r.rd.impact || 0, r.rd.gunImpact || 0);
      if (imp > 3 && this.time - r.thud > 0.3) {
        r.thud = this.time;
        const p = r.rd.position;
        this.fx.main.spawn({ x: p.x, y: p.y, z: p.z, vy: 0.6, frame: CELL.DUST, s0: 0.5, s1: 1.8, life: 0.8, rot: rand() * 6, r: 0.75, g: 0.68, b: 0.6, a: 0.5, fadeOut: 0.3 });
        if (imp > 5) this.audio.play('body_fall', { x: p.x, y: p.y, z: p.z, volume: Math.min(1, imp / 10) });
      }
    }
    for (const p of this.props) {
      if (p.sleep) continue;
      p.life -= dt;
      p.rb.floorY = this.col.groundAt(p.rb.pos.x, p.rb.pos.z, p.rb.pos.y, 0.3);
      p.rb.step(dt, 0);
      p.obj.position.copy(p.rb.pos); p.obj.quaternion.copy(p.rb.quat);
      if (p.rb.contactSpeed > 4 && p.metal && (p.lastClang ?? -9) < this.time - 0.3) { p.lastClang = this.time; this.audio.play('impact_metal', { x: p.rb.pos.x, y: p.rb.pos.y, z: p.rb.pos.z, volume: 0.8, pitch: 0.6 }); }
      if (p.rb.onGround && p.rb.vel.lengthSq() < 0.05 && p.rb.ang.lengthSq() < 0.05) p.sleep = true;
      if (p.life <= 0) { p.dead = true; this.scene.remove(p.obj); }
    }
    this.props = this.props.filter(p => !p.dead);
  }
  // persistent smoke columns + fires from wrecks (jets, trucks, cars)
  _ambient(dt) {
    this._colT = (this._colT || 0) - dt;
    const emit = this._colT <= 0;
    if (emit) this._colT = 0.12;
    for (const c of this.smokeCols) {
      c.life -= dt;
      if (c.life <= 0) continue;
      const near = this.headPos.distanceTo(c.p) < 260;
      if (emit) {
        const k = c.k;
        if (near || rand() < 0.35) this.fx.main.spawn({ x: c.p.x + range(-2, 2) * k, y: c.p.y + 2 * k, z: c.p.z + range(-2, 2) * k, vx: range(-0.5, 0.5) + 1.8, vy: range(3.5, 5.5), vz: range(-0.5, 0.5) + 0.6, drag: 0.15, frameKind: 2, frame: rand() * 40, frames: 14, s0: 4 * k, s1: range(16, 26) * k, ease: 0.6, life: range(9, 13), rot: rand() * 6, vrot: range(-0.05, 0.05), r: 0.13, g: 0.11, b: 0.1, a: 0.82, fadeIn: 0.06, fadeOut: 0.55 });
        if (c.fire && near) for (let i = 0; i < 2; i++) this.fx.flame(_v.set(c.p.x + range(-3, 3) * c.k, c.p.y, c.p.z + range(-3, 3) * c.k), range(1.2, 2.0) * c.fire);
      }
      if (c.fire && near && this.headPos.distanceTo(c.p) < 70) this.audio.setLoop('fire_big:' + this.smokeCols.indexOf(c), { x: c.p.x, y: c.p.y, z: c.p.z, volume: 0.7, intensity: 0.8 });
    }
  }

  // ---------------------------------------------------------------- player hooks
  get boss() { return this.bossInfo; }
  aimAssistPoints(tryP) {
    for (const s of this.soldiers) if (s.alive) tryP(s.gm.chestCenter.getWorldPosition(new THREE.Vector3()));
    for (const tg of this.targets) if (tg.active() && tg.aim) tryP(tg.aim());
  }
  autoTargets(A, head) {
    const out = [];
    for (const s of this.soldiers) {
      if (!s.alive || s.delay > 0) continue;
      const p = s.gm.chestCenter.getWorldPosition(new THREE.Vector3());
      const d = p.distanceTo(head);
      if (d > 70) continue;
      const vis = (A.target?.ref === s) ? A.targetVisible !== false : this.col.visible(head, p, b => b.data.noBullet);
      if (!vis) continue;
      out.push({ kind: 'soldier', p, score: 60 - d * 0.7 + (A.target?.ref === s ? 25 : 0) + (s.role === 'rusher' ? 10 : 0), ref: s, heavy: d > 16 && (s.cover?.tall === false || s.role === 'perch'), minNade: 9 });
    }
    for (const d of this.drums) {
      if ((d.state !== 'ok' && d.state !== 'leak') || d.obj) continue;
      const dd = d.pos.distanceTo(head);
      if (dd < 8 || dd > 45) continue;
      const near = this.soldiers.filter(s => s.alive && s.delay <= 0 && s.pos.distanceTo(d.pos) < 4.5).length;
      if (near === 0) continue;
      const p = d.pos.clone().setY(d.pos.y + 0.45);
      if (!this.col.visible(head, p, b => b.data.noBullet || b === d.box)) continue;
      out.push({ kind: 'drum', p, score: 50 + near * 22 - dd * 0.5 + (A.target?.ref === d ? 20 : 0), ref: d, tol: 0.03 });
    }
    for (const tg of this.targets) if (tg.active() && tg.auto) { const t = tg.auto(head, A); if (t) out.push(t); }
    if (this.cinematicLook) { out.length = 0; out.push({ kind: 'look', p: this.cinematicLook, score: 999, ref: this.cinematicLook, w: this.cinematicW ?? 5 }); }
    A.targetVisible = true;
    return out;
  }
  autoTargetDead(t) {
    if (t.kind === 'soldier') return !t.ref.alive || (this.time % 0.5 < 0.04 && !this.col.visible(this.headPos, t.ref.gm.chestCenter.getWorldPosition(_v), b => b.data.noBullet));
    if (t.kind === 'drum') return t.ref.state === 'gone' || t.ref.state === 'burning';
    if (t.kind === 'target') return !t.ref.active() || (t.ref.dead?.() ?? false);
    return false;
  }
  autoAimPoint(t, out) {
    if (t.kind === 'soldier') return t.ref.gm.chestCenter.getWorldPosition(out);
    if (t.kind === 'drum') return out.copy(t.ref.pos).setY(t.ref.pos.y + 0.45);
    if (t.kind === 'target' && t.ref.aim) return out.copy(t.ref.aim());
    return out.copy(t.p);
  }
  autoIdleLook(A, player) {
    // riding: keep eyes on the prize (the open ramp ahead); otherwise look where we walk
    const sp = this.setpieces;
    if (sp?.riding && sp.ride.state !== 'onPlane') {
      const p = sp.cargo.root.localToWorld(_v.set(0, 3.2, 14)), h = this.headPos;
      const dx = p.x - h.x, dz = p.z - h.z;
      const yaw = Math.atan2(-dx, -dz); let dy = yaw - player.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      return { yaw: player.yaw + dy, pitch: Math.atan2(p.y - h.y, Math.hypot(dx, dz)) * 0.8 };
    }
    return this.auto ? this.auto.idleLook(A, player) : null;
  }
}
const _hitOut = { hit: false, nx: 0, ny: 0, nz: 0 };
