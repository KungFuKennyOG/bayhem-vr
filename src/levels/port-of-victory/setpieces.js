import * as THREE from 'three';
import { rand, range, pick, chance, clamp, lerp, damp, smooth } from '../../rng.js';
import { Gunman } from '../../characters.js';
import { RigidBox } from '../../physics.js';
import { CELL } from '../../particles.js';
import { CW, CH, C40, C20, RTG, DECK_Y, QUAY_Z } from './layout.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();

function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}
function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = 1e9;
  for (const a of ['x', 'y', 'z']) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return -1; continue; }
    let ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a];
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return t0 > 0 ? t0 : -1;
}

// =====================================================================================
//  Set pieces: the gantry crane drop, the forklift charge, the ship's fuel hold finale.
// =====================================================================================
export class SetPieces {
  constructor(game) {
    this.g = game; this.w = game.world;
    game.targets = game.targets || [];
    this._crane();
    this._forklift();
    this._ship();
  }
  update(dt) {
    this._updCrane(dt);
    this._updForklift(dt);
    this._updShip(dt);
  }

  // ================================================================== RTG crane drop
  _crane() {
    const g = this.g, rtg = this.w.rtg;
    const C = this.crane = { rtg, mode: 'idle', z: RTG.z, tz: RTG.z, trolley: 0, tTrolley: 0, hoist: 14.5, t: 0, drops: 0, opAlive: true, glass: true };
    rtg.setTrolley?.(0); rtg.setHoist?.(C.hoist);
    // the carried box
    const hc = this.g.spawnHero(0, -500, 0, 0, 40, 0, 4242); // spawned far away, then re-parented to the spreader
    g.col.remove(hc.box); hc.box.enabled = false;
    C.box = hc;
    // RTGs carry boxes along the block rows (long axis along world z)
    hc.hc.root.position.set(0, -CH, 0); hc.hc.root.rotation.set(0, Math.PI / 2, 0);
    rtg.spreader.add(hc.hc.root);
    // leg colliders move with the gantry
    C.legBoxes = (rtg.boxes || []).map(b => ({ b, min: b.min.clone(), max: b.max.clone() }));
    // the operator (seated in the cab)
    const op = new Gunman({ pose: 'window', side: -1, seed: 777 });
    (rtg.cabSeat || rtg.cab).add(op.root);
    op.root.position.set(0, 0, 0);
    C.op = op;
    // drop shadow decal (grows while the box falls)
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    sh.renderOrder = 3; g.scene.add(sh); C.shadow = sh;
    // shootable: cab glass + operator
    g.targets.push({
      name: 'cab', active: () => C.opAlive && C.mode !== 'idle',
      ray: (o, d) => {
        const op = C.op; let best = -1;
        op.headCenter.getWorldPosition(_v); let t = raySphere(o, d, _v, 0.2); if (t > 0) best = t;
        op.chestCenter.getWorldPosition(_v); t = raySphere(o, d, _v, 0.34); if (t > 0 && (best < 0 || t < best)) best = t;
        if (C.glass && rtg.cabGlass) { const bb = new THREE.Box3().setFromObject(rtg.cabGlass); const tb = rayBox(o, d, bb.min, bb.max); if (tb > 0 && (best < 0 || tb < best)) { C._glassT = tb; best = tb; } }
        return best;
      },
      hit: (P, dir) => {
        if (C.glass && rtg.cabGlass) { C.glass = false; rtg.cabGlass.visible = false; g.audio.play('glass_break', { x: P.x, y: P.y, z: P.z }); for (let i = 0; i < 40; i++) g.fx.sparks.spawn({ x: P.x + range(-0.6, 0.6), y: P.y + range(-0.4, 0.4), z: P.z + range(-0.6, 0.6), vx: dir.x * 2 + range(-2, 2), vy: range(-1, 2), vz: dir.z * 2 + range(-2, 2), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 1, w: 0.03, len: 0.07, life: range(1.0, 1.8), r: 0.9, g: 1.0, b: 1.1, a: 0.9, fadeOut: 0.7, ground: true }); }
        g.hitMarker(true);
        C.opHits = (C.opHits || 0) + 1;
        if (C.opHits >= 2) this.killOperator(dir);
      },
      aim: () => C.op.chestCenter.getWorldPosition(new THREE.Vector3()),
      auto: (head, A) => {
        if (!(C.mode === 'track' || C.mode === 'after')) return null;
        const p = C.op.chestCenter.getWorldPosition(new THREE.Vector3());
        if (p.distanceTo(head) > 45) return null;
        return { kind: 'target', p, score: C.mode === 'after' ? 95 : 40, ref: g.targets.find(t => t.name === 'cab'), tol: 0.025 };
      },
    });
  }
  killOperator(dir) {
    const C = this.crane, g = this.g;
    if (!C.opAlive) return;
    C.opAlive = false;
    g.kills++;
    C.op.root.updateWorldMatrix(true, true);
    const rd = C.op.die(new THREE.Vector3(0, 0, 0), dir.clone().setY(0.2).normalize(), g.scene, 1.6);
    g.ragdolls.push({ rd, thud: 0 });
    C.op.chestCenter.getWorldPosition(_v);
    g.addScore(1000, 'CRANE OPERATOR — FIRED!', _v.clone().setY(_v.y + 1.5), 'huge');
    g.audio.play('kill_confirm', {});
    g.events.push({ type: 'operatorDown' });
    if (C.mode !== 'drop') { C.mode = 'after'; C.t = 0; }
  }
  // director: start hunting the player with a suspended container
  craneStart() { const C = this.crane; C.mode = 'track'; C.t = 0; C.alarmT = 0; this.g.audio.play('crane_alarm', { x: RTG.x, y: 16, z: C.z, volume: 1 }); }
  _updCrane(dt) {
    const C = this.crane, g = this.g, rtg = C.rtg, head = g.headPos;
    if (!rtg) return;
    C.t += dt;
    let moving = 0;
    if (C.mode === 'track') {
      // gantry travels along z to the player, trolley to the player's x (local to the crane)
      C.tz = clamp(head.z, -104, -60);
      C.tTrolley = clamp(head.x - RTG.x, -9.5, 9.5);
      C.alarmT -= dt;
      if (C.alarmT <= 0) { C.alarmT = 1.6; g.audio.play('crane_alarm', { x: RTG.x + C.trolley, y: 16, z: C.z, volume: 0.9 }); }
      const aligned = Math.abs(C.tz - C.z) < 1.2 && Math.abs(C.tTrolley - C.trolley) < 1.0;
      if ((aligned && C.t > 2.6) || C.t > (g.trailer ? 6 : 9)) this.craneDrop();
    }
    const vz = clamp((C.tz - C.z) * 0.9, -4.2, 4.2), vt = clamp((C.tTrolley - C.trolley) * 1.4, -3.4, 3.4);
    if (C.mode === 'track' || C.mode === 'after') {
      C.z += vz * dt; C.trolley += vt * dt; moving = Math.abs(vz) + Math.abs(vt);
      rtg.root.position.z = C.z; rtg.setTrolley?.(C.trolley);
      for (const lb of C.legBoxes) g.col.update(lb.b, [lb.min.x, lb.min.y, lb.min.z + C.z - RTG.z], [lb.max.x, lb.max.y, lb.max.z + C.z - RTG.z]);
    }
    if (C.mode === 'after') { C.tz = -96; C.tTrolley = 7; if (C.hoist < 14.5) C.hoist = Math.min(14.5, C.hoist + dt * 2); rtg.setHoist?.(C.hoist); }
    g.audio.setLoop('crane_motor', { x: RTG.x + C.trolley, y: 17, z: C.z, volume: C.mode === 'idle' ? 0 : 0.5 + Math.min(0.5, moving * 0.12), intensity: Math.min(1, moving * 0.2) });
    if (C.op && C.opAlive) C.op.update(dt, C.mode === 'idle' ? null : head);
    if (C.mode === 'track') {
      // telegraph: the hanging box sways and its shadow paints a pulsing target on the asphalt
      const root = C.box.hc.root; root.rotation.z = Math.sin(C.t * 2.1) * 0.035; root.rotation.x = Math.sin(C.t * 1.6 + 1) * 0.025;
      rtg.spreader.updateWorldMatrix(true, false); rtg.spreader.getWorldPosition(_v);
      C.shadow.position.set(_v.x, 0.04, _v.z); C.shadow.scale.set(CW * 1.25, 1, C40 * 1.1);
      C.shadow.material.opacity = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(C.t * 9));
      C.shadow.material.color.setRGB(0.25 * (0.5 + 0.5 * Math.sin(C.t * 9)), 0.02, 0);
    } else if (!C.fall) C.shadow.material.opacity = 0;
    // falling box
    const F = C.fall;
    if (F) {
      F.v += 9.81 * dt * 1.12; F.y -= F.v * dt;
      F.rx += F.wr * dt;
      F.obj.position.y = F.y; F.obj.rotation.set(F.rx * 0.4, F.yaw, F.rx);
      const k = 1 - clamp((F.y - 0) / F.y0, 0, 1);
      C.shadow.material.opacity = 0.25 + 0.55 * k; C.shadow.scale.set(F.Lx * (1.6 - 0.6 * k), 1, F.Lz * (1.6 - 0.6 * k));
      if (F.y <= 0) this._craneImpact();
    }
  }
  craneDrop() {
    const C = this.crane, g = this.g, rtg = C.rtg;
    if (C.mode !== 'track') return;
    C.mode = 'drop';
    const hc = C.box;
    const root = hc.hc.root;
    root.updateWorldMatrix(true, false);
    const wp = root.getWorldPosition(new THREE.Vector3());
    g.scene.attach(root);
    const L = C40;
    const e = new THREE.Euler().setFromQuaternion(root.quaternion, 'YXZ');
    C.shadow.material.color.setRGB(0, 0, 0);
    C.fall = { obj: root, y: wp.y, y0: wp.y, v: 0, rx: 0, wr: range(-0.35, 0.35), yaw: e.y, Lx: CW, Lz: L };
    C.shadow.position.set(wp.x, 0.04, wp.z);
    g.audio.play('crane_release', { x: wp.x, y: wp.y + 3, z: wp.z, volume: 1 });
    g.callout('INCOMING!', new THREE.Vector3(wp.x, 4.5, wp.z), 'big');
    g.events.push({ type: 'craneDrop', at: wp.clone() });
    C.dropPos = wp.clone();
    g.slowmo(1.1, 0.42, true);
  }
  _craneImpact() {
    const C = this.crane, g = this.g, F = C.fall;
    C.fall = null; C.shadow.material.opacity = 0;
    const root = F.obj; root.position.y = 0; root.rotation.set(0, F.yaw, (rand() - 0.5) * 0.04);
    const hc = C.box;
    hc.hc.crush?.(0.85);
    const P = root.getWorldPosition(new THREE.Vector3());
    hc.x = P.x; hc.z = P.z; hc.y = 0; hc.rot = 0;
    const hx = F.Lx / 2, hz = F.Lz / 2;
    hc.box.enabled = true;
    g.col.update(hc.box, [P.x - hx, 0, P.z - hz], [P.x + hx, CH * 0.92, P.z + hz]);
    this.w.nav.blockBox(hc.box.min, hc.box.max, 1);
    g.audio.play('container_slam', { x: P.x, y: 1, z: P.z, volume: 1 });
    g.lastExplosionT = g.time; g.lastExplosionShake = 1.6;
    g.haptic(1, 400);
    // dust wall + sparks along the bottom edges
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2, s = range(6, 16);
      g.fx.main.spawn({ x: P.x + range(-hx, hx), y: 0.5, z: P.z + range(-hz, hz) * 2, vx: Math.cos(a) * s, vy: range(0.5, 3), vz: Math.sin(a) * s, drag: 2.2, frame: CELL.DUST, s0: 1.5, s1: range(5, 9), life: range(1.6, 3.2), rot: rand() * 6, r: 0.78, g: 0.7, b: 0.6, a: 0.65, fadeIn: 0.03, fadeOut: 0.35 });
    }
    for (let i = 0; i < 70; i++) g.fx.sparks.spawn({ x: P.x + range(-hx, hx), y: 0.1, z: P.z + (rand() < 0.5 ? -hz : hz), vx: range(-6, 6), vy: range(2, 8), vz: range(-6, 6), grav: -14, drag: 0.8, frame: CELL.SPARK, s0: 1, w: 0.06, life: range(0.4, 1.0), r: 1.7, g: 1.0, b: 0.45, fadeOut: 0.5, ground: true });
    g.fx.ring(P, 26, 0.5, 0);
    // crushed anyone underneath?
    for (const s of g.soldiers) if (s.alive && Math.abs(s.pos.x - P.x) < hx + 0.3 && Math.abs(s.pos.z - P.z) < hz + 0.3) g.killSoldier(s, new THREE.Vector3(0, -1, 0), 0.5, false, 'SQUASHED!');
    const dx = Math.abs(g.headPos.x - P.x), dz = Math.abs(g.headPos.z - P.z);
    if (dx < hx + 0.25 && dz < hz + 0.25) g.hurt(75, P);
    else if (dx < hx + 2.5 && dz < hz + 2.5) { g.hurt(8, P); g.addScore(500, 'CLOSE SHAVE!', P.clone().setY(4), 'big'); }
    g.slowmo(1.4, 0.3, true);
    C.drops++;
    C.mode = C.opAlive ? 'after' : 'done'; C.t = 0;
    g.events.push({ type: 'craneImpact', at: P });
  }

  // ================================================================== forklift charge
  _forklift() {
    const g = this.g, pm = this.w.mods.propM;
    const F = this.fork = { state: 'idle', pos: new THREE.Vector3(34, 0, -122), yaw: Math.PI / 2, speed: 0, lift: 1.4, alive: true, drums: [], t: 0 };
    let model;
    if (pm?.buildForklift) model = pm.buildForklift();
    else {
      const root = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 4), new THREE.MeshStandardMaterial({ color: 0xd9a514, roughness: 0.6 })); body.position.y = 1.2; body.castShadow = true; root.add(body);
      const forks = new THREE.Group(); forks.position.set(0, 0.2, -2.4); root.add(forks);
      const seat = new THREE.Group(); seat.position.set(0, 1.4, 0.2); root.add(seat);
      model = { root, anchors: { forks, seat, exhaust: seat, beacon: seat }, setLift(h) { forks.position.y = 0.2 + h; }, spin() {}, steer() {}, colliders: [{ min: [-1.1, 0, -2.6], max: [1.1, 2.4, 2.2] }] };
    }
    F.model = model; F.root = model.root;
    F.root.position.copy(F.pos); F.root.rotation.y = F.yaw; F.root.visible = false;
    F.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.scene.add(F.root);
    model.setLift?.(F.lift);
    // driver
    const drv = new Gunman({ pose: 'window', side: -1, seed: 5150 });
    (model.anchors.seat || F.root).add(drv.root);
    F.driver = drv; F.driverAlive = true;
    // forklift hitbox (approx) as a shootable target + collider that follows it
    F.half = new THREE.Vector3(1.15, 1.25, 2.3);
    g.targets.push({
      name: 'forklift', active: () => F.alive && F.state !== 'idle',
      ray: (o, d) => {
        let best = -1;
        if (F.driverAlive) { F.driver.headCenter.getWorldPosition(_v); let t = raySphere(o, d, _v, 0.2); if (t > 0) best = t; F.driver.chestCenter.getWorldPosition(_v); t = raySphere(o, d, _v, 0.33); if (t > 0 && (best < 0 || t < best)) { best = t; F._hitDrv = 'body'; } else if (best > 0) F._hitDrv = 'head'; }
        // body (OBB): transform the ray into forklift space
        _inv.copy(F.root.matrixWorld).invert();
        const lo = _v.copy(o).applyMatrix4(_inv), ld = _v2.copy(d).transformDirection(_inv);
        const tb = rayBox(lo, ld, _v3.set(-F.half.x, 0, -F.half.z), new THREE.Vector3(F.half.x, F.half.y * 2, F.half.z));
        if (tb > 0 && (best < 0 || tb < best - 0.05)) { best = tb; F._hitDrv = null; }
        return best;
      },
      hit: (P, dir) => {
        if (F._hitDrv && F.driverAlive) { F.drvHits = (F.drvHits || 0) + (F._hitDrv === 'head' ? 3 : 1); g.fx.impact(P, dir.clone().negate(), 'body'); g.hitMarker(F._hitDrv === 'head'); if (F.drvHits >= 2) this.killDriver(dir); return; }
        g.fx.impact(P, dir.clone().negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.7 });
        F.hp = (F.hp ?? 20) - 1; g.hitMarker(false);
        if (F.hp <= 0) this.wreckForklift('shot');
      },
      near: (p) => F.root.position.distanceTo(p) < 2.6,
      blast: () => this.wreckForklift('grenade'),
      aim: () => F.driver.chestCenter.getWorldPosition(new THREE.Vector3()),
      auto: (head) => {
        if (F.state !== 'charge') return null;
        // Bay logic: shoot the fuel drums on the forks
        const d = F.drums.find(x => x.state === 'ok' || x.state === 'leak');
        if (!d) return null;
        const p = d.pos.clone().setY(d.pos.y + 0.45);
        if (p.distanceTo(head) > 55) return null;
        return { kind: 'drum', p, score: 120, ref: d, tol: 0.07 };
      },
    });
  }
  forkliftStart() {
    const F = this.fork, g = this.g;
    F.state = 'charge'; F.root.visible = true; F.t = 0; F.speed = 0; F.hp = 22;
    if (g.auto) { g.cinematicLook = F.root.position.clone().setY(1.6); g.cinematicW = 5; g.fx.later(1.4, () => { if (g.cinematicLook && g.cinematicLook.y === 1.6) g.cinematicLook = null; }); }
    // pallet of fuel drums on the forks
    const forks = F.model.anchors.forks;
    for (let i = 0; i < 4; i++) {
      const d = g.addDrum(new THREE.Vector3(), { hp: 1, onFork: true, forkOff: new THREE.Vector3((i % 2 - 0.5) * 0.62, 0.14, (Math.floor(i / 2) - 0.5) * 0.62 - 0.7) });
      F.drums.push(d);
    }
    // forklift collider (updated every frame)
    F.box = g.col.add([0, 0, 0], [0.1, 0.1, 0.1], { kind: 'forklift', mat: 'metal', noBullet: true });
    g.audio.play('tire_screech', { x: F.pos.x, y: 1, z: F.pos.z, volume: 0.7 });
  }
  killDriver(dir) {
    const F = this.fork, g = this.g;
    if (!F.driverAlive) return;
    F.driverAlive = false; g.kills++;
    F.driver.root.updateWorldMatrix(true, true);
    const rd = F.driver.die(new THREE.Vector3(Math.sin(F.yaw) * -F.speed, 0, Math.cos(F.yaw) * -F.speed), dir, g.scene, 1.4);
    g.ragdolls.push({ rd, thud: 0 });
    F.driver.chestCenter.getWorldPosition(_v);
    g.addScore(300, 'DRIVER DOWN', _v.clone().setY(_v.y + 1.2), 'big');
    // dead man's pedal: it keeps rolling and veers into the fuel depot
    F.state = 'runaway';
  }
  wreckForklift(cause) {
    const F = this.fork, g = this.g;
    if (!F.alive) return;
    F.alive = false; F.state = 'wreck';
    if (F.driverAlive) { F.driverAlive = false; F.driver.root.updateWorldMatrix(true, true); const rd = F.driver.die(new THREE.Vector3(0, 0, 0), new THREE.Vector3(range(-0.5, 0.5), 1, range(-0.5, 0.5)).normalize(), g.scene, 2.8); g.ragdolls.push({ rd, thud: 0 }); g.kills++; }
    for (const d of F.drums) if (d.state !== 'gone') g.igniteDrum(d, range(0.0, 0.25));
    const P = F.root.position.clone().setY(1.2);
    g.boom(P, 1.6, { radius: 8, dmg: 60 });
    g.slowmo(2.0, 0.24, true);
    g.addScore(2000, 'FORKLIFT FLIP!', P.clone().setY(5), 'huge');
    const rb = new RigidBox(F.half.x, F.half.y, F.half.z, 3);
    rb.pos.copy(F.root.position).setY(F.half.y + 0.05); rb.quat.copy(F.root.quaternion);
    rb.vel.set(Math.sin(F.yaw) * -F.speed * 0.7, 9.5, Math.cos(F.yaw) * -F.speed * 0.7); rb.ang.set(range(-3, 3), range(-1.5, 1.5), (chance(0.5) ? -1 : 1) * range(4, 6));
    rb.angDamp = 0.15;
    F.rb = rb; F.burn = 25;
    if (F.box) { g.col.remove(F.box); F.box = null; }
    g.events.push({ type: 'forkliftWreck' });
  }
  _updForklift(dt) {
    const F = this.fork, g = this.g;
    if (F.state === 'idle') return;
    F.t += dt;
    if (F.state === 'charge' || F.state === 'runaway') {
      let tx, tz;
      if (F.state === 'charge') { tx = g.headPos.x; tz = g.headPos.z; }
      else { tx = 26; tz = -122; } // the drum stack
      const want = Math.atan2(-(tx - F.pos.x), -(tz - F.pos.z));
      let dy = want - F.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      const dist = Math.hypot(tx - F.pos.x, tz - F.pos.z);
      F.yaw += clamp(dy, -1.2 * dt, 1.2 * dt);
      // after a ram it backs off and lines up again (never pins the player)
      if (F.backT > 0) { F.backT -= dt; F.speed = damp(F.speed, -3, 3, dt); }
      else { const top = F.state === 'charge' ? (dist < 7 ? 2.5 : 7.5) : 6.5; F.speed = damp(F.speed, top, 1.2, dt); }
      F.pos.x += -Math.sin(F.yaw) * F.speed * dt; F.pos.z += -Math.cos(F.yaw) * F.speed * dt;
      F.pos.z = Math.max(F.pos.z, QUAY_Z + 3);
      F.root.position.copy(F.pos); F.root.rotation.set(0, F.yaw, 0);
      F.model.spin?.(F.speed * dt); F.model.steer?.(clamp(dy, -0.6, 0.6));
      F.model.setLift?.(F.lift + Math.sin(F.t * 7) * 0.02);
      if (F.state === 'runaway' && dist < 4) this.wreckForklift('crash');
      if (F.state === 'charge' && dist < 4.7 && !(F.backT > 0)) { F.backT = 1.8; g.hurt(F.rammed ? 10 : 22, F.pos); F.rammed = true; g.audio.play('metal_crash', { x: F.pos.x, y: 1, z: F.pos.z }); g.lastExplosionT = g.time; g.lastExplosionShake = 0.6; }
      g.audio.setLoop('forklift', { x: F.pos.x, y: 1, z: F.pos.z, volume: 0.9, intensity: Math.min(1, F.speed / 7) });
      // exhaust smoke
      if (F.model.anchors.exhaust && rand() < dt * 12) g.fx.smoke(F.model.anchors.exhaust.getWorldPosition ? F.model.anchors.exhaust.getWorldPosition(_v) : _v.copy(F.pos).setY(2.6), 0.4, 0.12, 1.5, 1.2, 0.4);
      if (F.box) g.col.update(F.box, [F.pos.x - 1.2, 0, F.pos.z - 1.2], [F.pos.x + 1.2, 2.4, F.pos.z + 1.2]);
      if (F.driverAlive) F.driver.update(dt, g.headPos);
    }
    if (F.state === 'wreck' && F.rb) {
      const rb = F.rb; rb.floorY = 0; rb.step(dt, 0);
      F.root.quaternion.copy(rb.quat);
      F.root.position.copy(rb.pos).sub(_v.set(0, F.half.y, 0).applyQuaternion(rb.quat));
      if (rb.contactSpeed > 4 && (F.lastCrash ?? -9) < g.time - 0.35) { F.lastCrash = g.time; g.audio.play('metal_crash', { x: rb.pos.x, y: 1, z: rb.pos.z, volume: Math.min(1, rb.contactSpeed / 10) }); }
      if (F.burn > 0) {
        F.burn -= dt;
        F.fireT = (F.fireT || 0) - dt;
        if (F.fireT <= 0) { F.fireT = 0.04; g.fx.flame(_v.copy(rb.pos).setY(rb.pos.y + 0.6), 1.2); if (rand() < 0.5) g.fx.smoke(_v.setY(_v.y + 1.4), 1.6, 0.12, 4, 2.5, 0.8); }
        g.audio.setLoop('fire', { x: rb.pos.x, y: 1, z: rb.pos.z, volume: 0.7, intensity: 1 });
      }
    }
    // drums ride on the forks
    if (F.drums.length) {
      const forks = F.model.anchors.forks; forks.updateWorldMatrix(true, false);
      for (const d of F.drums) {
        if (d.state === 'gone' || !d.onFork) continue;
        if (F.state === 'wreck') { d.onFork = false; continue; }
        d.pos.copy(d.forkOff).applyMatrix4(forks.matrixWorld); d.yaw = F.yaw;
        if (d.box) g.col.update(d.box, [d.pos.x - 0.3, d.pos.y, d.pos.z - 0.3], [d.pos.x + 0.3, d.pos.y + 0.88, d.pos.z + 0.3]);
        else d.box = g.col.add([d.pos.x - 0.3, d.pos.y, d.pos.z - 0.3], [d.pos.x + 0.3, d.pos.y + 0.88, d.pos.z + 0.3], { kind: 'drum', mat: 'drum', ref: d, small: true });
      }
    }
    for (const e of g.events) if (e.type === 'forkDrum' && F.alive) this.wreckForklift('drums');
  }

  // ================================================================== the ship: manifold, alarm, the big one
  _ship() {
    const g = this.g, ship = this.w.ship;
    const M = this.man = { hp: 14, state: 'idle', pos: (ship.anchors?.manifold?.isVector3 ? ship.anchors.manifold.clone() : ship.anchors?.manifold?.getWorldPosition?.(new THREE.Vector3())) || new THREE.Vector3(-6, DECK_Y, -155.5), t: 0, fires: [] };
    M.center = M.pos.clone().setY(M.pos.y + 0.9);
    // the manifold's own colliders must not eat the bullets aimed at it
    g.col.query(M.center.x - 2, M.center.z - 2, M.center.x + 2, M.center.z + 2, (b) => { if (b.min.x < M.center.x + 1 && b.max.x > M.center.x - 1 && b.min.z < M.center.z + 1 && b.max.z > M.center.z - 1 && b.max.y > DECK_Y + 0.3 && b.min.y < DECK_Y + 2) b.data.isManifold = true; });
    g.targets.push({
      name: 'manifold', active: () => M.state === 'armed',
      ray: (o, d) => raySphere(o, d, M.center, 0.95),
      hit: (P, dir) => {
        g.fx.impact(P, dir.clone().negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.8 }); g.hitMarker(false);
        M.hp -= 1;
        if (M.hp % 4 === 0) { this.fuelJet(P, dir); g.audio.play('barrel_hiss', { x: P.x, y: P.y, z: P.z }); }
        if (M.hp <= 0) this.rupture();
      },
      near: (p) => p.distanceTo(M.center) < 2.2,
      blast: () => { M.hp -= 8; if (M.hp <= 0) this.rupture(); },
      aim: () => M.center,
      auto: (head) => (M.state === 'armed' && head.y > DECK_Y && M.center.distanceTo(head) < 40 ? { kind: 'target', p: M.center, score: 110, ref: g.targets.find(t => t.name === 'manifold'), tol: 0.04 } : null),
    });
  }
  fuelJet(P, dir) { this.man.fires.push({ p: P.clone(), n: dir.clone().negate().setY(0.3).normalize(), life: 99 }); }
  armManifold() { this.man.state = 'armed'; }
  rupture() {
    const M = this.man, g = this.g;
    if (M.state !== 'armed') return;
    M.state = 'burning'; M.t = 0;
    g.audio.play('fuel_whoomp', { x: M.center.x, y: M.center.y, z: M.center.z });
    g.fx.explosion(M.center.clone(), 1.3, { noRing: true });
    g.lastExplosionT = g.time; g.lastExplosionShake = 1.0;
    const mo = this.w.ship.anchors?.manifoldObj; if (mo) mo.visible = false;
    for (let i = 0; i < 4; i++) M.fires.push({ p: M.center.clone().add(_v.set(range(-0.8, 0.8), range(-0.4, 0.4), range(-0.3, 0.3))), n: new THREE.Vector3(range(-1, 1), range(0.6, 1.2), range(-0.5, 0.2)).normalize(), life: 99 });
    g.addScore(1500, 'FUEL LINE CUT!', M.center.clone().setY(M.center.y + 2.5), 'huge');
    g.events.push({ type: 'rupture' });
  }
  // pre-blasts on the deck while you run
  deckBlast(x) { const g = this.g; g.boom(new THREE.Vector3(x, DECK_Y + 0.8, -158 - rand() * 2), 1.3, { radius: 5, dmg: 15, noRing: true }); g.audio.play('metal_groan', { x, y: DECK_Y, z: -165 }); }
  // the big one: the fuel hold goes up in a mushroom fireball, chain blasts along the hull
  kaboom() {
    const g = this.g, M = this.man;
    M.state = 'gone'; M.kaboomT = 0;
    const P = new THREE.Vector3(-15, DECK_Y + 2, -167);
    this.mush = { P, t: 0 };
    g.fx.main.bigBudget = Math.max(g.fx.main.bigBudget, 230); // the one moment worth the fill rate
    g.slowmo(3.6, 0.2, true);
    g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
    g.audio.play('fuel_whoomp', { x: P.x, y: P.y, z: P.z, volume: 1 });
    g.audio.play('ear_ring', { volume: 0.8 });
    g.fx.light(P.clone().setY(P.y + 12), 9000, 4.5, 0xff8a3a, true, 260);
    g.lastExplosionT = g.time; g.lastExplosionShake = 2.2;
    g.haptic(1, 900);
    g.hud.white.material.opacity = 0.85;
    g.fx.ring(P, 160, 1.4, DECK_Y);
    // kill anyone left on the deck
    for (const s of g.soldiers) if (s.alive && s.floorY > 5) g.killSoldier(s, new THREE.Vector3(range(-0.5, 0.5), 1, 0.6).normalize(), 3.5, false);
    // secondary blasts marching along the hull
    const xs = [-40, -28, 4, 14, -58, 28, -72, 36];
    xs.forEach((x, i) => g.fx.later(0.25 + i * 0.32, () => { g.fx.explosion(new THREE.Vector3(x, DECK_Y + range(1, 4), -160 - rand() * 14), range(1.5, 2.2), { noRing: true }); g.audio.play('explosion_big', { x, y: DECK_Y, z: -165 }); g.lastExplosionT = g.time; g.lastExplosionShake = 0.8; }));
    // deck containers thrown into the sky
    for (let i = 0; i < 4; i++) g.fx.later(0.15 + i * 0.2, () => this._flingBox(new THREE.Vector3(-30 + i * 14 + range(-3, 3), DECK_Y + 3, -168 + range(-4, 4))));
    for (let i = 0; i < 40; i++) g.fx.spawnDebris(P.clone().setY(P.y + 3), range(-25, 25), range(14, 34), range(-10, 30), range(0.3, 0.9), rand() < 0.5);
    // the ship chars over a few seconds (ship.js setBurnt), windows die
    this.burnK = 0;
    // persistent fires along the ship
    this.shipFires = [];
    for (let i = 0; i < 14; i++) this.shipFires.push({ p: new THREE.Vector3(range(-80, 34), DECK_Y + range(0.5, 2.5), range(-158, -176)), s: range(1.5, 3.5) });
    g.events.push({ type: 'kaboom' });
  }
  _flingBox(P) {
    const g = this.g;
    const h = g.spawnHero(P.x, P.z, P.y, 0, chance(0.5) ? 40 : 20, Math.floor(rand() * 8), Math.floor(rand() * 9999));
    g.col.remove(h.box);
    const L = h.L, rb = new RigidBox(L / 2, CH / 2, CW / 2, 20);
    rb.pos.set(P.x, P.y + CH / 2, P.z); rb.vel.set(range(-8, 8), range(16, 26), range(4, 14)); rb.ang.set(range(-1.5, 1.5), range(-1, 1), range(-2, 2));
    rb.restitution = 0.15;
    h.hc.dent?.(P.clone(), new THREE.Vector3(0, 1, 0), 2.5, 0.5);
    h.flying = { rb, burn: 12 };
    (this.flyBoxes ||= []).push(h);
  }
  _updShip(dt) {
    const M = this.man, g = this.g;
    for (const f of M.fires) {
      // pressurised fuel jets: long licking flames out of the manifold
      if (rand() < dt * 45) g.fx.main.spawn({ x: f.p.x, y: f.p.y, z: f.p.z, vx: f.n.x * range(6, 10), vy: f.n.y * range(6, 10) + 1, vz: f.n.z * range(6, 10), drag: 2.2, grav: 3, frameKind: 1, s0: 0.5, s1: range(2.2, 3.4), ease: 0.5, life: range(0.5, 0.8), rot: rand() * 6, vrot: range(-1, 1), r: 2.2, g: 1.8, b: 1.5, a: 1, fadeIn: 0.02, fadeOut: 0.6 });
      if (rand() < dt * 8) g.fx.smoke(_v.copy(f.p).addScaledVector(f.n, 3).setY(f.p.y + 2.5), 1.6, 0.1, 4.5, 2.5, 0.75);
    }
    if (M.fires.length && M.state !== 'gone') g.audio.setLoop('fire_big', { x: M.center.x, y: M.center.y, z: M.center.z, volume: 0.9, intensity: 1 });
    if (M.state === 'burning' || M.state === 'gone') M.t += dt;
    // mushroom cloud (rate-based emitters: slow-mo must not multiply the particle count)
    const mu = this.mush;
    if (mu) {
      mu.t += dt;
      const P = mu.P, t = mu.t, fx = g.fx;
      const emit = (k, rate, fn) => { mu[k] = (mu[k] || 0) + rate * dt; while (mu[k] >= 1) { mu[k] -= 1; fn(); } };
      // initial fireball: a column of huge puffs punching up out of the hold, clearing the hull
      if (t < 0.45) emit('core', 30, () => fx.main.spawn({ x: P.x + range(-6, 6), y: P.y + range(0, 5), z: P.z + range(-5, 5), vx: range(-7, 7), vy: range(24, 40), vz: range(-6, 6), drag: 1.0, grav: 1.5, frameKind: 1, s0: range(12, 16), s1: range(36, 50), ease: 0.5, life: range(2.6, 3.6), rot: rand() * 6, vrot: range(-0.4, 0.4), r: 1.6, g: 1.15, b: 0.8, a: 1, fadeIn: 0.01, fadeOut: 0.72 }));
      // stem: fire column rising into the cap, wrapped in dark smoke
      if (t < 3.6) emit('stem', 9, () => fx.main.spawn({ x: P.x + range(-3, 3), y: P.y + range(2, 12), z: P.z + range(-3, 3), vx: range(-1, 1), vy: range(22, 32), vz: range(-1, 1), drag: 0.5, frameKind: 1, s0: range(7, 9), s1: range(14, 20), ease: 0.6, life: range(2.0, 2.6), rot: rand() * 6, vrot: range(-0.3, 0.3), r: 1.5, g: 1.0, b: 0.68, a: 1, fadeOut: 0.7 }));
      if (t > 0.3 && t < 4) emit('stemS', 4, () => { const sh = range(0.08, 0.13); fx.main.spawn({ x: P.x + range(-5, 5), y: P.y + range(4, 20), z: P.z + range(-5, 5), vx: range(-1.5, 1.5), vy: range(7, 12), vz: range(-1.5, 1.5), drag: 0.4, frameKind: 2, frame: rand() * 40, frames: 16, s0: 10, s1: range(22, 30), ease: 0.6, life: range(6, 8), rot: rand() * 6, vrot: range(-0.1, 0.1), r: sh * 1.4, g: sh, b: sh * 0.8, a: 0.85, fadeIn: 0.1, fadeOut: 0.6 }); });
      // cap: a rolling ring of fire turning into black smoke at 30-55 m
      if (t > 0.5 && t < 4.6) {
        emit('capF', 9, () => { const a = rand() * Math.PI * 2, R = range(8, 15) + t * 5, cy = P.y + 46 + t * 9; fx.main.spawn({ x: P.x + Math.cos(a) * R, y: cy + range(-3, 3), z: P.z + Math.sin(a) * R, vx: Math.cos(a) * range(3, 6), vy: range(1, 3), vz: Math.sin(a) * range(3, 6), drag: 0.4, frameKind: 1, s0: range(15, 19), s1: range(30, 40), ease: 0.6, life: range(2.2, 3.2), rot: rand() * 6, vrot: range(-0.2, 0.2), r: 1.45, g: 0.9, b: 0.55, a: 1, fadeOut: 0.65 }); });
        emit('capS', 5, () => { const a = rand() * Math.PI * 2, R = range(10, 18) + t * 5.5, cy = P.y + 52 + t * 9, sh = range(0.07, 0.14); fx.main.spawn({ x: P.x + Math.cos(a) * R, y: cy + range(0, 8), z: P.z + Math.sin(a) * R, vx: Math.cos(a) * range(2, 4.5), vy: range(1.5, 4), vz: Math.sin(a) * range(2, 4.5), drag: 0.25, frameKind: 2, frame: rand() * 40, frames: 18, s0: range(20, 26), s1: range(50, 70), ease: 0.6, life: range(10, 14), rot: rand() * 6, vrot: range(-0.08, 0.08), r: sh * 1.5, g: sh * 1.05, b: sh * 0.8, r1: sh * 1.1, g1: sh * 0.95, b1: sh * 0.9, a: 0.9, fadeIn: 0.1, fadeOut: 0.6 }); });
      }
      if (t > 0.1 && t < 0.4) g.hud.white.material.opacity = Math.max(0, 0.85 - (t - 0.1) * 3);
      if (t > 16) this.mush = null;
    }
    // burning ship after the blast
    if (this.burnK !== undefined && this.burnK < 1) { this.burnK = Math.min(1, this.burnK + dt * 0.6); this.w.ship.setBurnt?.(this.burnK); }
    if (this.shipFires) {
      for (const f of this.shipFires) if (rand() < dt * 9) { g.fx.flame(_v.copy(f.p).add(_v2.set(range(-1, 1), 0, range(-1, 1))), f.s); if (rand() < 0.35) g.fx.smoke(_v.setY(f.p.y + f.s * 1.5), f.s * 1.4, 0.09, 7, 3, 0.85); }
      g.audio.setLoop('fire_big', { x: -12, y: DECK_Y, z: -165, volume: 1, intensity: 1 });
    }
    for (const h of this.flyBoxes || []) {
      const F = h.flying; if (!F) continue;
      F.rb.floorY = g.world.fastGround(F.rb.pos.x, F.rb.pos.z);
      F.rb.step(dt, 0);
      h.hc.root.quaternion.copy(F.rb.quat); h.hc.root.position.copy(F.rb.pos).sub(_v.set(0, CH / 2, 0).applyQuaternion(F.rb.quat));
      if (F.burn > 0) { F.burn -= dt; if (rand() < dt * 30) g.fx.flame(_v.copy(F.rb.pos), 1.6); }
      if (F.rb.contactSpeed > 6 && !F.landed) { F.landed = true; g.audio.play('container_slam', { x: F.rb.pos.x, y: F.rb.pos.y, z: F.rb.pos.z, volume: 0.9 }); h.hc.crush?.(0.5); }
    }
  }
}
