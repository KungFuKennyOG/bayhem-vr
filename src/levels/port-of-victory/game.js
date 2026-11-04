import * as THREE from 'three';
import { rand, range, pick, chance, clamp, lerp, damp } from '../../rng.js';
import { Ragdoll } from '../../characters.js';
import { RigidBox } from '../../physics.js';
import { CELL } from '../../particles.js';
import { bulletHoleTexture } from '../../textures.js';
import { applyDusk, setSunElevation } from '../../atmosphere.js';
import { Soldier, buildCoverPoints } from './ai.js';
import { CW, CH, C40, C20, DRUMS, DECK_Y, QUAY_Z } from './layout.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}

// =====================================================================================
//  PORT OF VICTORY — combat sandbox: soldiers, grenades, explosive drums, destructible
//  containers, bullet holes, scoring, slow-mo. Set pieces live in setpieces.js.
// =====================================================================================
export class PortGame {
  constructor(E, world) {
    Object.assign(this, { scene: E.scene, fx: E.fx, hud: E.hud, audio: E.audio, rig: E.rig, camera: E.camera, params: E.params, world, E });
    this.col = world.col;
    this.trailer = E.params.has('trailer');
    this.soldiers = []; this.grenades = []; this.nades = []; this.ragdolls = []; this.props = []; this.flyers = [];
    this.time = 0; this.timeScale = 1; this.slowT = 0; this.slowCool = 0; this.slowScale = 1;
    this.score = 0; this.kills = 0; this.headshots = 0; this.drumsBlown = 0; this.combo = 0; this.comboT = 0;
    this.hp = 100; this.hurtT = 9; this.hurtFlash = 0; this.downed = false;
    this.dmgMul = this.trailer ? 1.8 : 1;
    this.headPos = new THREE.Vector3(0, 1.65, 30);
    this.playerFwd = new THREE.Vector3(0, 0, -1);
    this.lastExplosionT = -10; this.lastExplosionShake = 0.8;
    this.recentExplosions = [];
    this.nadeCool = 6;
    this.dusk = 0.12;
    this.events = [];
    this.bossInfo = null;
    this.fx.onSound = (n, p) => this.audio.play(n, p ? { x: p.x, y: p.y, z: p.z } : {});
    this.fx.setGround(world.fastGround);
    Ragdoll.world = this.col;
    this._initHoles();
    this._initDrums();
    this._initHeroes();
    world.buildNav();
    this.cover = buildCoverPoints(this.col, world.nav, { y: 0 });
    this.coverDeck = world.navDeck ? buildCoverPoints(this.col, world.navDeck, { y: DECK_Y }) : [];
    this.cover.push(...this.coverDeck);
  }

  // ---------------------------------------------------------------- bullet holes (instanced decals on world surfaces)
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
    const A = this.world.drumAssets;
    const geo = A?.geometry || (() => { const g = new THREE.CylinderGeometry(0.29, 0.29, 0.88, 14); g.translate(0, 0.44, 0); return g; })();
    const mat = A?.material || new THREE.MeshStandardMaterial({ color: 0xa3170f, metalness: 0.5, roughness: 0.5 });
    this.drumGeo = geo; this.drumMat = mat; this.drumBurnt = A?.burntMaterial || mat;
    const list = [];
    const r = rand;
    for (const [cx, cz, n, lay] of DRUMS) {
      for (let i = 0; i < n; i++) {
        let x = cx, z = cz, y = 0;
        if (lay === 'pallet') { x += (i % 2 - 0.5) * 0.62; z += (Math.floor(i / 2) % 2 - 0.5) * 0.62; y = 0.14; }
        else if (lay === 'row') { x += (i - n / 2) * 0.64 + range(-0.05, 0.05); z += range(-0.1, 0.1); }
        else { const ring = i < 6 ? 0 : 1; const k = ring ? i - 6 : i; x += (k % 3 - 1) * 0.62 + (ring ? 0.31 : 0); z += (Math.floor(k / 3) - 0.5) * 0.62; y = ring ? 0.9 : 0; }
        const d = { pos: new THREE.Vector3(x, y, z), yaw: r() * 6.28, tilt: 0, hp: 2, state: 'ok', fuse: 0, i: list.length, leakT: 0, onFork: false };
        if (!this.col.walk.length || true) d.box = this.col.add([x - 0.3, y, z - 0.3], [x + 0.3, y + 0.88, z + 0.3], { kind: 'drum', mat: 'drum', ref: d, small: true });
        list.push(d);
      }
    }
    this.drums = list;
    this.drumCap = list.length + 8;
    this.drumMesh = new THREE.InstancedMesh(geo, mat, this.drumCap);
    this.drumMesh.castShadow = true; this.drumMesh.receiveShadow = true; this.drumMesh.frustumCulled = false;
    this.scene.add(this.drumMesh);
    this._drumsDirty = true;
  }
  addDrum(pos, opts = {}) { // extra drums (forklift pallet)
    const d = { pos: pos.clone(), yaw: rand() * 6.28, tilt: 0, hp: 2, state: 'ok', fuse: 0, i: this.drums.length, leakT: 0, ...opts };
    if (this.drums.length >= this.drumCap) return d;
    this.drums.push(d); this._drumsDirty = true; return d;
  }
  _writeDrums() {
    const m = _m;
    this.drums.forEach((d, i) => {
      if (d.state === 'gone' || d.flying) m.makeScale(0, 0, 0);
      else { _q.setFromEuler(new THREE.Euler(d.tilt, d.yaw, 0)); m.compose(d.pos, _q, _v.set(1, 1, 1)); }
      this.drumMesh.setMatrixAt(i, m);
    });
    this.drumMesh.count = this.drums.length;
    this.drumMesh.instanceMatrix.needsUpdate = true;
  }
  hitDrum(d, P, n, source) {
    if (d.state === 'gone' || d.state === 'burning') return;
    d.hp -= 1;
    this.audio.play('barrel_hit', { x: P.x, y: P.y, z: P.z, volume: 0.9 });
    if (d.state === 'ok') { d.state = 'leak'; d.leakN = n.clone(); d.leakP = P.clone(); d.leakT = 0; this.audio.play('barrel_hiss', { x: P.x, y: P.y, z: P.z, volume: 0.8 }); }
    if (d.hp <= 0) this.igniteDrum(d, range(0.05, 0.25));
  }
  igniteDrum(d, delay = 0) {
    if (d.state === 'gone' || d.state === 'burning') return;
    d.state = 'burning'; d.fuse = delay;
  }
  _updateDrums(dt) {
    let dirty = this._drumsDirty; this._drumsDirty = false;
    for (const d of this.drums) {
      if (d.onFork && d.state !== 'gone') { dirty = true; }
      if (d.state === 'leak') {
        d.leakT += dt;
        // fuel spurting out of the bullet hole (it ignites after a few seconds if it keeps leaking)
        if (rand() < dt * 30) this.fx.main.spawn({ x: d.leakP.x, y: d.leakP.y, z: d.leakP.z, vx: d.leakN.x * 2 + range(-0.3, 0.3), vy: range(-0.5, 0.6), vz: d.leakN.z * 2 + range(-0.3, 0.3), grav: -9, drag: 0.5, frame: CELL.WISP, s0: 0.06, s1: 0.18, life: 0.5, r: 0.55, g: 0.48, b: 0.3, a: 0.6, fadeOut: 0.5 });
        if (d.leakT > 3.5) this.igniteDrum(d, 0);
      }
      if (d.state === 'burning') {
        d.fuse -= dt;
        if (d.fuse > 0 && rand() < dt * 25) this.fx.flame(_v.set(d.pos.x, d.pos.y + 0.95, d.pos.z), 0.45);
        if (d.fuse <= 0) this.explodeDrum(d);
      }
    }
    // flying drums (launched by explosions): spin, trail fire, explode again when they land
    for (const f of this.flyers) {
      f.rb.floorY = this.world.fastGround(f.rb.pos.x, f.rb.pos.z);
      f.rb.step(dt, 0);
      f.mesh.position.copy(f.rb.pos); f.mesh.quaternion.copy(f.rb.quat);
      f.life -= dt;
      this.fx.trailEmit(f, f.rb.pos, 0.35, (q) => { this.fx.flame(q, 0.55); if (rand() < 0.5) this.fx.smoke(q, 0.8, 0.14, 2.4, 0.6, 0.7); }, 0);
      const hit = this.col.collidePoint(_v.copy(f.rb.pos), 0.45, _hitOut).hit;
      if ((f.rb.onGround && f.age > 0.4) || hit || f.life <= 0) { f.dead = true; this.scene.remove(f.mesh); if (f.boom) this.boom(f.rb.pos.clone().setY(Math.max(f.rb.pos.y, f.rb.floorY + 0.5)), 0.8, { radius: 5, dmg: 40 }); }
      f.age += dt;
    }
    this.flyers = this.flyers.filter(f => !f.dead);
    if (dirty || this.drums.some(d => d.onFork)) this._writeDrums();
  }
  explodeDrum(d) {
    if (d.state === 'gone') return;
    d.state = 'gone';
    if (d.box) this.col.remove(d.box);
    this.drumsBlown++;
    const P = d.pos.clone(); P.y += 0.5;
    this.audio.play('barrel_explode', { x: P.x, y: P.y, z: P.z });
    this.boom(P, 1.05, { radius: 6.5, dmg: 70, src: d, drum: true });
    // Bay rule: at least one drum per cluster goes flying, burning, and explodes again where it lands
    if (chance(0.45) && this.flyers.length < 6) {
      const mesh = new THREE.Mesh(this.drumGeo, this.drumBurnt);
      mesh.castShadow = true; this.scene.add(mesh);
      const rb = new RigidBox(0.29, 0.44, 0.29, 1);
      rb.pos.copy(P); rb.vel.set(range(-5, 5), range(11, 16), range(-5, 5)); rb.ang.set(range(-9, 9), range(-6, 6), range(-9, 9));
      rb.restitution = 0.3;
      this.flyers.push({ mesh, rb, life: 4, age: 0, boom: chance(0.6) });
    }
    if (d.onFork) this.events.push({ type: 'forkDrum', d });
    this.addScore(150, this.drumsBlown % 4 === 0 ? 'CHAIN REACTION!' : null, P.clone().setY(P.y + 2), 'big');
  }

  // ---------------------------------------------------------------- destructible containers
  _initHeroes() {
    this.heroes = [];
    const HC = this.world.HeroContainer;
    for (const c of this.world.containerList.filter(c => c.hero)) this.spawnHero(c.x, c.z, c.tier * CH, c.rot, c.len, c.livery, c.seed);
  }
  spawnHero(x, z, y, rot, len, livery = 0, seed = 1) {
    const HC = this.world.HeroContainer;
    let hc;
    if (HC) hc = new HC({ len, livery, seed });
    else { // stand-in
      const L = len === 40 ? C40 : C20;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(L, CH, CW), new THREE.MeshStandardMaterial({ color: 0x7a2a1c, roughness: 0.6, metalness: 0.3 }));
      mesh.position.y = CH / 2; mesh.castShadow = true;
      const root = new THREE.Group(); root.add(mesh);
      hc = { root, dent() {}, burst() { return { pieces: [], spill: [] }; }, crush() {}, update() {} };
    }
    hc.root.position.set(x, y, z); hc.root.rotation.y = rot ? Math.PI / 2 : 0;
    hc.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(hc.root);
    const L = len === 40 ? C40 : C20, hx = (rot ? CW : L) / 2, hz = (rot ? L : CW) / 2;
    const h = { hc, x, z, y, len, rot, dmg: 0, burst: false, box: null, L };
    h.box = this.col.add([x - hx, y, z - hz], [x + hx, y + CH, z + hz], { kind: 'hero', mat: 'metal', ref: h });
    this.heroes.push(h);
    return h;
  }
  damageHero(h, P, power) {
    _v.subVectors(_v2.set(h.x, h.y + CH / 2, h.z), P).normalize();
    // dent the face toward the blast
    const hit = this.col.raycast(P, _v, 12, b => b !== h.box);
    const pt = hit && hit.box === h.box ? _v2.copy(P).addScaledVector(_v, hit.t) : _v2.set(h.x, h.y + CH / 2, h.z);
    h.hc.dent?.(pt, _v, 1.4 + power * 1.2, 0.18 + power * 0.32);
    h.dmg += power;
    this.audio.play('container_dent', { x: pt.x, y: pt.y, z: pt.z, volume: Math.min(1, 0.5 + power) });
    if (h.dmg > 1.1 && !h.burst) {
      h.burst = true;
      const res = h.hc.burst?.(_v.clone()) || {};
      this.audio.play('container_doors', { x: h.x, y: h.y + 1, z: h.z });
      for (const p of (res.pieces || [])) { // torn-off doors fly
        const rb = new RigidBox(0.6, 1.2, 0.05, 2); p.obj.getWorldPosition(rb.pos); p.obj.getWorldQuaternion(rb.quat);
        this.scene.attach(p.obj); rb.vel.copy(p.vel || _v3.set(range(-4, 4), range(5, 9), range(-4, 4))); rb.ang.copy(p.angVel || _v3.set(range(-6, 6), range(-6, 6), range(-6, 6)));
        this.props.push({ obj: p.obj, rb, life: 30, metal: true });
      }
      for (const s of (res.spill || [])) { // boxes thrown out
        const rb = new RigidBox(0.25, 0.2, 0.25, 0.4); s.obj.getWorldPosition(rb.pos); this.scene.attach(s.obj);
        rb.vel.copy(s.vel || _v3.set(range(-3, 3), range(2, 6), range(-3, 3))); rb.ang.set(range(-8, 8), range(-8, 8), range(-8, 8));
        this.props.push({ obj: s.obj, rb, life: 30 });
      }
    }
  }

  // ---------------------------------------------------------------- spawning
  spawnSoldier(o) {
    const s = new Soldier(this, o);
    this.soldiers.push(s);
    return s;
  }
  enemiesAlive(filter) { return this.soldiers.filter(s => s.alive && (!filter || filter(s))).length; }

  // ---------------------------------------------------------------- player weapons
  fireRay(origin, dir) {
    let best = { t: 220, kind: 'none' };
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const gm = s.gm;
      if (s.pos.distanceToSquared(origin) > 250 * 250) continue;
      gm.headCenter.getWorldPosition(_v);
      let t = raySphere(origin, dir, _v, 0.17); if (t > 0 && t < best.t) best = { t, kind: 'head', s };
      gm.chestCenter.getWorldPosition(_v);
      t = raySphere(origin, dir, _v, 0.3); if (t > 0 && t < best.t) best = { t, kind: 'body', s };
      gm.bones[0].getWorldPosition(_v); _v.y -= 0.05;
      t = raySphere(origin, dir, _v, 0.24); if (t > 0 && t < best.t) best = { t, kind: 'body', s };
      gm.bones[14].getWorldPosition(_v); t = raySphere(origin, dir, _v, 0.14); if (t > 0 && t < best.t) best = { t, kind: 'leg', s };
      gm.bones[17].getWorldPosition(_v); t = raySphere(origin, dir, _v, 0.14); if (t > 0 && t < best.t) best = { t, kind: 'leg', s };
    }
    // extra targets registered by set pieces (crane cab, manifold, forklift...)
    for (const tg of this.targets || []) {
      if (!tg.active()) continue;
      const t = tg.ray(origin, dir);
      if (t > 0 && t < best.t) best = { t, kind: 'target', target: tg };
    }
    const manOn = this.setpieces?.man?.state === 'armed';
    const hit = this.col.raycast(origin, dir, best.t, (b) => b.data.noBullet || (manOn && b.data.isManifold));
    if (hit) {
      const d = hit.box.data;
      best = { t: hit.t, kind: d.kind === 'drum' ? 'drum' : d.kind === 'hero' ? 'hero' : 'world', box: hit.box, normal: hit.normal, mat: d.mat };
    }
    if (best.kind === 'none' && dir.y < 0) {
      // ground plane (yard / deck / water)
      let t = (0 - origin.y) / dir.y;
      const px = origin.x + dir.x * t, pz = origin.z + dir.z * t;
      const gy = this.world.fastGround(px, pz);
      if (gy !== 0) t = (gy - origin.y) / dir.y;
      if (t > 0 && t < best.t) best = { t, kind: gy < -1 ? 'water' : 'ground', normal: UP };
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
      case 'drum': {
        const d = hit.box.data.ref;
        this.fx.impact(P, hit.normal, 'metal');
        this.addHole(P, hit.normal);
        this.hitDrum(d, P, hit.normal, 'player');
        this.hitMarker(false);
        break;
      }
      case 'hero': case 'world': {
        const mat = hit.mat || 'metal';
        this.fx.impact(P, hit.normal, mat === 'concrete' ? 'ground' : 'metal');
        if (mat !== 'fence') this.addHole(P, hit.normal);
        this.audio.play(mat === 'concrete' ? 'impact_metal' : 'impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.55, pitch: mat === 'concrete' ? 0.7 : 1 });
        break;
      }
      case 'target': hit.target.hit(P, dir); break;
      case 'water': {
        for (let i = 0; i < 6; i++) this.fx.sparks.spawn({ x: P.x, y: P.y, z: P.z, vx: range(-1, 1), vy: range(3, 7), vz: range(-1, 1), grav: -12, frame: CELL.SPARK, s0: 1, w: 0.04, life: range(0.3, 0.6), r: 0.7, g: 0.8, b: 0.85, a: 0.8, fadeOut: 0.5 });
        break;
      }
      case 'ground': this.fx.impact(P, UP, 'ground'); break;
    }
    return hit;
  }

  launchGrenade(origin, dir) {
    const g = { pos: origin.clone(), vel: dir.clone().multiplyScalar(55), life: 4, armed: 0 };
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

  // ---------------------------------------------------------------- explosions
  // generic blast: FX + damage to soldiers, drums, containers, bodies and the player
  boom(P, size = 1, { radius = 7, dmg = 60, src = null, drum = false, noRing = false, shake = null, player = true } = {}) {
    this.fx.explosion(P, size, { noRing });
    this.recentExplosions.push(this.time);
    this.lastExplosionT = this.time;
    const dp = this.headPos.distanceTo(P);
    this.lastExplosionShake = shake ?? clamp(1.4 * size * (1 - dp / 60), 0.15, 1.6);
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
      if (d === src || d.state === 'gone') continue;
      const dd = d.pos.distanceTo(P);
      if (dd < radius * 0.85) this.igniteDrum(d, range(0.12, 0.32));
      else if (dd < radius * 1.3 && d.state === 'ok') { d.state = 'leak'; d.leakN = _v.subVectors(d.pos, P).normalize().clone(); d.leakP = d.pos.clone().setY(d.pos.y + 0.5); d.leakT = 2.5; }
    }
    for (const h of this.heroes) {
      const d = Math.hypot(h.x - P.x, h.z - P.z) - h.L * 0.3;
      if (d < radius) this.damageHero(h, P, (1 - Math.max(0, d) / radius) * size);
    }
    // push existing corpses / props
    for (const r of this.ragdolls) {
      const rd = r.rd; if (rd.disposed) continue;
      const d = rd.position.distanceTo(P);
      if (d < radius * 1.5) { rd.asleep = false; rd.still = 0; const k = (1 - d / (radius * 1.5)) * 9; const x = rd.x, v = rd.v; for (let i = 0; i < rd.np; i++) { const j = i * 3; _v.set(x[j] - P.x, x[j + 1] - P.y + 1.2, x[j + 2] - P.z).normalize(); v[j] += _v.x * k; v[j + 1] += _v.y * k + 2; v[j + 2] += _v.z * k; } }
    }
    for (const p of this.props) { const d = p.rb.pos.distanceTo(P); if (d < radius * 1.5) { p.rb.vel.addScaledVector(_v.subVectors(p.rb.pos, P).normalize().add(UP), 10 * (1 - d / (radius * 1.5))); p.rb.ang.add(_v.set(range(-5, 5), range(-5, 5), range(-5, 5))); p.sleep = false; } }
    if (player && dp < radius * 0.75) this.hurt(Math.min(45, dmg * (1 - dp / (radius * 0.75))), P);
    if (dp < 10) this.audio.play('ear_ring', { volume: 0.4 });
    // slow-mo: chains and close calls
    const multi = this.recentExplosions.filter(t => this.time - t < 1.4).length >= 3;
    if (multi && this.slowCool <= 0) { this.slowmo(1.4, 0.3); this.callout('MULTI-KILL', P.clone().setY(P.y + 4), 'big'); }
    else if (dp < 14 && chance(0.4)) this.slowmo(0.9, 0.35);
    this.events.push({ type: 'boom', P: P.clone(), size });
  }

  hurt(amount, from) {
    if (this.god) return;
    if (this.trailer) amount *= 0.25;
    this.hp -= amount; this.hurtT = 0; this.hurtFlash = Math.min(1, this.hurtFlash + amount / 25);
    this.audio.play('player_hurt', { volume: Math.min(1, amount / 20) });
    this.haptic(0.8, 80);
    if (this.hp <= 0 && !this.downed) {
      this.downed = true; this.hp = 1;
      this.slowmo(1.6, 0.25, true);
      this.audio.play('radio_squelch', {});
      this.hud.subtitle('DRIVER', pick(["Get up! I'm not explaining this to your mom!", "Stay with me! Breathe! Shoot!", "You don't get to die on a Tuesday!"]), 3.5);
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

  // ---------------------------------------------------------------- enemy fire
  enemyShot(s, dist) {
    const mz = s.gm.muzzle.getWorldPosition(new THREE.Vector3());
    _v.subVectors(this.headPos, mz).normalize();
    this.fx.muzzle(mz, _v, 'enemy', false);
    if (this.fx.lights.some(l => l.userData.life <= 0)) this.fx.light(mz, 6, 0.05, 0xffb060, true, 7);
    this.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, volume: 0.85 });
    const moving = this.playerSpeed || 0;
    let hitChance = clamp(0.16 - dist * 0.0028, 0.03, 0.16) * (moving > 2 ? 0.55 : 1) * (this.trailer ? 0.55 : 1) * (s.role === 'rusher' ? 0.7 : 1);
    const target = this.headPos.clone();
    if (rand() < hitChance) {
      target.y -= 0.45;
      this.fx.tracer(mz, target, { speed: 330, color: [1.8, 0.5, 0.25], width: 0.05, len: 4 });
      this.fx.later(dist / 330, () => this.hurt(7, mz));
    } else {
      // near miss: pass the head and smack into whatever is behind the player (sparks on the containers around you)
      target.add(_v2.set(range(-1.3, 1.3), range(-0.9, 1.2), range(-1.3, 1.3)));
      _v3.subVectors(target, mz).normalize();
      const far = this.col.raycast(mz, _v3, dist + 40, b => b.data.noBullet || b.data.ref === s);
      let tEnd = far ? far.t : dist + 40;
      let gnd = false;
      if (_v3.y < 0) { const tg = (this.world.fastGround(target.x, target.z) - mz.y) / _v3.y; if (tg > 0 && tg < tEnd) { tEnd = tg; gnd = true; } }
      const end = mz.clone().addScaledVector(_v3, tEnd);
      this.fx.tracer(mz, end, { speed: 330, color: [1.8, 0.5, 0.25], width: 0.05, len: 4 });
      const n = far && !gnd ? far.normal.clone() : UP;
      const kind = far && !gnd ? 'metal' : 'ground';
      this.fx.later(tEnd / 330, () => { this.fx.impact(end, n, kind); if (kind === 'metal') { this.addHole(end, n); if (end.distanceTo(this.headPos) < 8) this.audio.play('impact_metal', { x: end.x, y: end.y, z: end.z, volume: 0.5 }); } });
      const closest = _v2.subVectors(this.headPos, mz).dot(_v3);
      const cp = mz.clone().addScaledVector(_v3, closest);
      if (closest < tEnd && cp.distanceTo(this.headPos) < 1.8 && rand() < 0.55) this.fx.later(closest / 330, () => this.audio.play('whiz', { x: cp.x, y: cp.y, z: cp.z }));
      if (far && far.box.data.kind === 'drum' && chance(0.3)) { const d = far.box.data.ref; this.fx.later(tEnd / 330, () => this.hitDrum(d, end, n, 'enemy')); }
    }
  }
  enemyGrenade(s) {
    s.gm.bones[8].getWorldPosition(_v); // left hand
    const P = _v.clone();
    // ballistic arc to land near the player (they lead a little, and miss a little)
    const T = this.headPos.clone(); T.y = this.world.fastGround(T.x, T.z);
    T.x += range(-1.8, 1.8) + (this.playerVel?.x || 0) * 0.8; T.z += range(-1.8, 1.8) + (this.playerVel?.z || 0) * 0.8;
    const flight = clamp(P.distanceTo(T) / 13, 0.9, 1.7);
    const vel = new THREE.Vector3((T.x - P.x) / flight, (T.y - P.y + 0.5 * 9.8 * flight * flight) / flight, (T.z - P.z) / flight);
    this.nades.push({ pos: P, vel, fuse: 2.7, bounces: 0, spin: range(5, 12), rot: 0 });
    this.audio.play('grenade_pin', { x: P.x, y: P.y, z: P.z });
    if (chance(0.7)) this.fx.later(0.3, () => { this.callout('GRENADE!', T.clone().setY(T.y + 1.6), 'small'); });
  }
  _updateNades(dt) {
    // enemy frag grenades: bounce off the ground / containers, fuse, blast
    let nearest = null, nd = 1e9;
    for (const n of this.nades) {
      n.fuse -= dt;
      n.vel.y -= 9.8 * dt;
      n.pos.addScaledVector(n.vel, dt);
      const gy = this.world.fastGround(n.pos.x, n.pos.z);
      const c = this.col.collidePoint(n.pos, 0.06, _hitOut);
      if (n.pos.y < gy + 0.06) { n.pos.y = gy + 0.06; if (n.vel.y < -1.5) { n.vel.y *= -0.35; n.vel.x *= 0.6; n.vel.z *= 0.6; if (n.bounces++ < 3) this.audio.play('grenade_bounce', { x: n.pos.x, y: n.pos.y, z: n.pos.z }); } else { n.vel.y = 0; n.vel.x *= Math.exp(-dt * 4); n.vel.z *= Math.exp(-dt * 4); } }
      else if (c.hit) { const vn = n.vel.x * c.nx + n.vel.y * c.ny + n.vel.z * c.nz; if (vn < 0) { n.vel.x -= 1.4 * vn * c.nx; n.vel.y -= 1.4 * vn * c.ny; n.vel.z -= 1.4 * vn * c.nz; n.vel.multiplyScalar(0.6); if (n.bounces++ < 4) this.audio.play('grenade_bounce', { x: n.pos.x, y: n.pos.y, z: n.pos.z }); } }
      // red blinking light so you can find it
      if (Math.sin(this.time * (14 + (2.7 - n.fuse) * 10)) > 0) this.fx.main.spawn({ x: n.pos.x, y: n.pos.y + 0.08, z: n.pos.z, frame: CELL.GLOW, s0: 0.35, life: 0.04, r: 3.5, g: 0.3, b: 0.1, a: 1, anchored: false });
      const d = n.pos.distanceTo(this.headPos);
      if (d < nd) { nd = d; nearest = n; }
      if (n.fuse <= 0) { n.dead = true; this.boom(n.pos.clone().setY(n.pos.y + 0.2), 0.8, { radius: 6, dmg: 60 }); }
    }
    this.nades = this.nades.filter(n => !n.dead);
    this.dangerNade = nearest && nd < 12 ? nearest : null;
    // player 40 mm: impact fused
    for (const g of this.grenades) {
      g.life -= dt;
      g.vel.y -= 9.8 * dt;
      const prev = _v2.copy(g.pos);
      g.pos.addScaledVector(g.vel, dt);
      // swept test vs world + soldiers
      _v.subVectors(g.pos, prev); const L = _v.length(); _v.divideScalar(L || 1);
      let boom = g.life <= 0;
      const hit = L > 0 ? this.col.raycast(prev, _v, L, b => b.data.noBullet && !b.data.noStand) : null;
      if (hit) { g.pos.copy(prev).addScaledVector(_v, Math.max(0, hit.t - 0.15)); boom = true; if (hit.box.data.kind === 'drum') this.igniteDrum(hit.box.data.ref, 0); }
      const gy = this.world.fastGround(g.pos.x, g.pos.z);
      if (g.pos.y <= gy + 0.1) { g.pos.y = gy + 0.25; boom = true; }
      for (const s of this.soldiers) if (s.alive && s.pos.distanceToSquared(g.pos) < 0.8 && Math.abs(g.pos.y - s.pos.y - 1) < 1.1) boom = true;
      for (const tg of this.targets || []) if (tg.active() && tg.near?.(g.pos)) { boom = true; tg.blast?.(g.pos); }
      // smoke trail
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
    // player motion (for enemy accuracy / grenade leading)
    this.playerVel ||= new THREE.Vector3();
    if (this._lastHead) { this.playerVel.subVectors(this.headPos, this._lastHead).divideScalar(Math.max(dt, 1e-4)).setY(0); this.playerSpeed = this.playerVel.length(); }
    (this._lastHead ||= new THREE.Vector3()).copy(this.headPos);
    this.camera.getWorldDirection(this.playerFwd); this.playerFwd.y = 0; this.playerFwd.normalize();

    for (const s of this.soldiers) s.update(dt);
    this._updateNades(dt);
    this._updateDrums(dt);
    for (const h of this.heroes) h.hc.update?.(dt);
    this.setpieces?.update(dt);
    this._updateBodies(dt);
    this._ambient(dt);
    // atmosphere: golden hour drifts to blue hour as the level progresses
    if (Math.abs((this._appliedDusk ?? -1) - this.dusk) > 0.002) {
      this._appliedDusk = this.dusk;
      setSunElevation(5.5 - this.dusk * 9.5, _sunAz);
      applyDusk(this.dusk, { sun: this.E.sun, hemi: this.E.hemi, fog: this.scene.fog, renderer: this.E.renderer });
      this.scene.environmentIntensity = 0.8 - this.dusk * 0.45;
    }
    this.world.update(dt, this.headPos, this.dusk);
    // grenade warning indicator
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

  // ---------------------------------------------------------------- ambience: the wrecked truck smoulders, smoke columns from earlier chaos
  _ambient(dt) {
    const pk = this.world.pickup;
    if (pk) {
      if (!this._pkHood) { pk.root.updateMatrixWorld(true); this._pkHood = new THREE.Vector3(0, 1.05, -1.9).applyMatrix4(pk.root.matrixWorld); }
      const h = this._pkHood;
      if (rand() < dt * 10) this.fx.smoke(_v.copy(h).add(_v2.set(range(-0.4, 0.4), 0, range(-0.3, 0.3))), 0.7, 0.13, 4.5, 1.6, 0.55);
      if (rand() < dt * 6) this.fx.smoke(_v.copy(h), 0.5, 0.75, 1.6, 1.2, 0.25); // steam from the radiator
      if (rand() < dt * 14) this.fx.flame(_v.copy(h).add(_v2.set(range(-0.3, 0.3), -0.1, range(-0.2, 0.2))), 0.35);
      if (this.headPos.distanceTo(h) < 30) this.audio.setLoop('fire', { x: h.x, y: h.y, z: h.z, volume: 0.35, intensity: 0.4 });
    }
    // distant black smoke columns (the freeway chase is still burning behind the port)
    this._colT = (this._colT || 0) - dt;
    if (this._colT <= 0) {
      this._colT = 0.9;
      for (const [x, z] of [[-140, 160], [95, 230]]) this.fx.main.spawn({ x: x + range(-4, 4), y: 6, z: z + range(-4, 4), vx: range(-0.5, 0.5) + 1.5, vy: range(4, 6), vz: range(-0.5, 0.5) - 1, drag: 0.15, frameKind: 2, frame: rand() * 40, frames: 14, s0: 12, s1: range(34, 48), ease: 0.6, life: range(11, 14), rot: rand() * 6, vrot: range(-0.05, 0.05), r: 0.16, g: 0.13, b: 0.11, a: 0.8, fadeIn: 0.08, fadeOut: 0.55 });
    }
  }

  // ---------------------------------------------------------------- player hooks
  get boss() { return this.bossInfo; }
  aimAssistPoints(tryP) {
    for (const s of this.soldiers) if (s.alive) tryP(s.gm.chestCenter.getWorldPosition(new THREE.Vector3()));
    for (const tg of this.targets || []) if (tg.active() && tg.aim) tryP(tg.aim());
  }
  autoTargets(A, head) {
    const out = [];
    for (const s of this.soldiers) {
      if (!s.alive || s.delay > 0) continue;
      const p = s.gm.chestCenter.getWorldPosition(new THREE.Vector3());
      const d = p.distanceTo(head);
      if (d > 60) continue;
      // only what the player can actually see (checked lazily for the current target)
      const vis = this.col.visible(head, p, b => b.data.noBullet);
      if (!vis) continue;
      out.push({ kind: 'soldier', p, score: 60 - d * 0.7 + (A.target?.ref === s ? 25 : 0) + (s.role === 'rusher' ? 10 : 0), ref: s, heavy: d > 16 && (s.cover?.tall === false || s.role === 'perch'), minNade: 9 });
    }
    for (const d of this.drums) {
      if (d.state !== 'ok' && d.state !== 'leak') continue;
      const dd = d.pos.distanceTo(head);
      if (dd < 8 || dd > 45) continue;
      // shoot drums when enemies stand next to them (Bay logic)
      const near = this.soldiers.filter(s => s.alive && s.delay <= 0 && s.pos.distanceTo(d.pos) < 4.5).length;
      if (near === 0 && !d.onFork) continue;
      if (d.onFork && dd > 24) continue;
      const p = d.pos.clone().setY(d.pos.y + 0.45);
      if (!this.col.visible(head, p, b => b.data.noBullet || b === d.box)) continue;
      out.push({ kind: 'drum', p, score: 50 + near * 22 + (d.onFork ? 40 : 0) - dd * 0.5 + (A.target?.ref === d ? 20 : 0), ref: d, tol: 0.03 });
    }
    for (const tg of this.targets || []) if (tg.active() && tg.auto) { const t = tg.auto(head, A); if (t && this.col.visible(head, t.p, b => b.data.noBullet || b.data.kind === 'drum' || b.data.isManifold)) out.push(t); }
    if (this.cinematicLook) { out.length = 0; out.push({ kind: 'look', p: this.cinematicLook, score: 999, ref: this.cinematicLook, w: this.cinematicW ?? 5 }); }
    A.targetVisible = true;
    return out;
  }
  autoTargetDead(t) {
    if (t.kind === 'soldier') { if (!t.ref.alive) return true; if (this.col.visible(this.headPos, t.ref.gm.chestCenter.getWorldPosition(_v), b => b.data.noBullet)) { t.lost = 0; return false; } t.lost = (t.lost || 0) + 1; return t.lost > 12; }
    if (t.kind === 'drum') return t.ref.state === 'gone' || t.ref.state === 'burning';
    if (t.kind === 'target') return !t.ref.active();
    return false;
  }
  autoAimPoint(t, out) {
    if (t.kind === 'soldier') return t.ref.gm.chestCenter.getWorldPosition(out);
    if (t.kind === 'drum') return out.copy(t.ref.pos).setY(t.ref.pos.y + 0.45);
    if (t.kind === 'target' && t.ref.aim) return out.copy(t.ref.aim());
    return out.copy(t.p);
  }
  autoIdleLook(A, player) { return this.auto ? this.auto.idleLook(A, player) : null; }
}
const _hitOut = { hit: false, nx: 0, ny: 0, nz: 0 };
const _sunAz = new THREE.Vector3(-0.42, 0, -1).normalize();
