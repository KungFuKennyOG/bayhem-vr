import * as THREE from 'three';
import { buildRifle, buildLauncher, Gun, VR_HOLD } from './weapons.js';
import { rand, range, clamp, damp } from './rng.js';

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();

export class Player {
  constructor(game, camera, rig, renderer, opts) {
    this.g = game; this.camera = camera; this.rig = rig; this.renderer = renderer;
    this.auto = opts.auto;
    this.yaw = opts.yaw ?? Math.PI * 0.92; this.pitch = -0.08;
    this.vyaw = 0; this.vpitch = 0;
    this.rifle = new Gun(buildRifle({ supportHand: false }), { rpm: 690, mag: 45, reload: 1.5, auto: true });
    this.launcher = new Gun(buildLauncher(), { rpm: 110, mag: 6, reload: 2.4, auto: false });
    this.inputs = { fireR: false, fireL: false, reload: false };
    this.mode = 'desktop';
    this.shake = 0;
    // desktop viewmodels
    this.rifle.holder.position.set(0.17, -0.225, -0.5);
    this.launcher.holder.position.set(-0.27, -0.3, -0.56);
    camera.add(this.rifle.holder, this.launcher.holder);
    this.controllers = [];
    this.autoState = { target: null, retarget: 0, err: new THREE.Vector2(), grenadeT: 3, lookAway: 0, aimPoint: new THREE.Vector3(), wantFire: false };
    this.setupDesktop();
  }

  setupDesktop() {
    const el = this.renderer.domElement;
    this.mouseDown = [false, false, false];
    el.addEventListener('mousedown', (e) => { if (this.mode !== 'desktop' || this.auto) return; if (document.pointerLockElement !== el) { el.requestPointerLock?.(); } this.mouseDown[e.button] = true; });
    addEventListener('mouseup', (e) => { this.mouseDown[e.button] = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.mode !== 'desktop' || this.auto || document.pointerLockElement !== el) return;
      this.yaw -= e.movementX * 0.0022; this.pitch -= e.movementY * 0.0022;
      this.pitch = clamp(this.pitch, -1.35, 1.35);
    });
    addEventListener('keydown', (e) => { if (e.code === 'KeyR') this.inputs.reload = true; });
  }

  setupVR() {
    this.mode = 'vr';
    const xr = this.renderer.xr;
    for (let i = 0; i < 2; i++) {
      const c = xr.getController(i);
      this.rig.add(c);
      const entry = { space: c, gun: null, source: null, hand: null };
      c.addEventListener('connected', (e) => {
        entry.source = e.data; entry.hand = e.data.handedness;
        const gun = entry.hand === 'left' ? this.launcher : this.rifle;
        entry.gun = gun;
        const hold = VR_HOLD[gun.model.kind];
        gun.holder.position.fromArray(hold.position);
        gun.holder.rotation.set(hold.rotation[0], hold.rotation[1], hold.rotation[2]);
        gun.model.setMode?.('vr');
        c.add(gun.holder);
      });
      c.addEventListener('disconnected', () => { if (entry.gun) entry.gun.holder.removeFromParent(); entry.gun = null; entry.source = null; });
      this.controllers.push(entry);
    }
  }

  pulse(intensity, ms, hand) {
    for (const c of this.controllers) {
      if (hand && c.hand !== hand) continue;
      const h = c.source?.gamepad?.hapticActuators?.[0];
      if (h && h.pulse) h.pulse(intensity, ms);
    }
  }

  // ---------- autopilot (demo / trailer capture) ----------
  autopilot(rdt, dt) {
    const g = this.g, A = this.autoState;
    A.retarget -= dt; A.grenadeT -= dt;
    const head = g.headPos;
    const candidates = [];
    for (const r of g.rockets) { const d = r.pos.distanceTo(head); if (d < 70 && d > 6) candidates.push({ kind: 'rocket', p: r.pos, score: 120 - d, ref: r }); }
    for (const c of g.cars) {
      if (c.state !== 'drive') continue;
      const d = c.pos.distanceTo(head);
      if (c.isTanker && d < 95 && d > 12) candidates.push({ kind: 'car', p: c.center(new THREE.Vector3()), score: 70 - d * 0.3, ref: c });
      if (c.team !== 'enemy') continue;
      for (const gm of c.gunmen) if (gm.alive && d < 75) {
        const p = gm.g.chestCenter.getWorldPosition(new THREE.Vector3());
        candidates.push({ kind: 'gunman', p, score: 60 - d * 0.6 + (A.target?.ref === gm ? 25 : 0), ref: gm });
      }
      if (!c.gunmen.some(x => x.alive) && d < 70) candidates.push({ kind: 'car', p: c.center(new THREE.Vector3()), score: 30 - d * 0.4 + (A.target?.ref === c ? 20 : 0), ref: c });
    }
    const h = g.heli;
    if (h && h.alive && h.phase === 'fight') candidates.push({ kind: 'heli', p: h.pos, score: 35 + (A.target?.ref === h ? 20 : 0) + (h.hp < h.maxHp * 0.3 ? 45 : 0), ref: h });
    // cinematic beats: watch the gunship go down / look at the end title
    if (h && h.phase === 'dying') { candidates.length = 0; candidates.push({ kind: 'look', p: h.pos, score: 999, ref: h }); }
    else if (g.cinematicLook && !candidates.some(c => c.kind === 'rocket')) { candidates.length = 0; candidates.push({ kind: 'look', p: g.cinematicLook, score: 999, ref: g.cinematicLook }); }
    if (A.retarget <= 0 || !A.target || (A.target.kind === 'gunman' && !A.target.ref.alive) || (A.target.kind === 'car' && A.target.ref.state !== 'drive') || (A.target.kind === 'rocket' && A.target.ref.dead)) {
      candidates.sort((a, b) => b.score - a.score);
      const nt = candidates[0] || null;
      if (nt && (!A.target || nt.ref !== A.target.ref)) A.err.set(range(-0.07, 0.07), range(-0.04, 0.05));
      A.target = nt;
      A.retarget = 0.35;
    }
    // aim
    let wantYaw = this.yaw, wantPitch = this.pitch, fire = false;
    if (A.target) {
      const p = A.target.kind === 'gunman' ? A.target.ref.g.chestCenter.getWorldPosition(_v) : A.target.kind === 'car' ? A.target.ref.center(_v) : _v.copy(A.target.p);
      A.aimPoint.copy(p);
      _d.subVectors(p, this.camera.getWorldPosition(new THREE.Vector3()));
      const dist = _d.length();
      wantYaw = Math.atan2(-_d.x, -_d.z) + A.err.x;
      wantPitch = Math.atan2(_d.y, Math.hypot(_d.x, _d.z)) + A.err.y;
      A.err.multiplyScalar(Math.exp(-dt * 3.5));
      let dy = wantYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      const angErr = Math.hypot(dy, wantPitch - this.pitch);
      fire = angErr < 0.035 && dist < 85 && A.target.kind !== 'look';
      // grenades at vehicles / heli
      const isHeavy = A.target.kind === 'look' ? false : A.target.kind === 'car' || A.target.kind === 'heli' || (A.target.kind === 'gunman' && dist > 25);
      if (isHeavy && A.grenadeT <= 0 && dist > 14 && dist < 70 && angErr < 0.08) {
        A.grenadeT = range(2.5, 4.5);
        this.autoGrenade = { dist };
      }
      wantYaw = this.yaw + dy;
    } else {
      // idle: slowly scan, glance at the sunset ahead now and then
      A.lookAway += dt;
      const ahead = Math.sin(A.lookAway * 0.25) > 0.3;
      wantYaw = ahead ? 0.25 : Math.PI * 0.95 + Math.sin(A.lookAway * 0.4) * 0.5;
      wantPitch = 0.02;
      let dy = wantYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      wantYaw = this.yaw + dy;
    }
    // critically damped spring (human-ish, readable on video)
    const w = A.target ? 9 : 2.2;
    const ay = (wantYaw - this.yaw) * w * w - 2 * w * this.vyaw;
    const ap = (wantPitch - this.pitch) * w * w - 2 * w * this.vpitch;
    this.vyaw += ay * rdt; this.vpitch += ap * rdt;
    const maxV = 4.2;
    this.vyaw = clamp(this.vyaw, -maxV, maxV); this.vpitch = clamp(this.vpitch, -maxV, maxV);
    this.yaw += this.vyaw * rdt; this.pitch += this.vpitch * rdt;
    this.inputs.fireR = fire;
  }

  update(rdt, dt) {
    const g = this.g;
    if (this.auto) this.autopilot(rdt, dt);
    else if (this.mode === 'desktop') { this.inputs.fireR = this.mouseDown[0]; this.inputs.fireL = this.mouseDown[2]; }
    if (this.mode === 'desktop') {
      this.shake *= Math.exp(-rdt * 6);
      const sh = this.shake;
      this.camera.rotation.set(this.pitch + (sh ? Math.sin(g.time * 47) * sh * 0.02 : 0), this.yaw + (sh ? Math.sin(g.time * 39) * sh * 0.02 : 0), 0, 'YXZ');
      this.camera.position.set(0, 1.65, 0);
      // viewmodel sway + converge onto the aim point
      this.camera.updateMatrixWorld();
      const aimDist = 30;
      for (const [gun, base] of [[this.rifle, [0.17, -0.225, -0.5]], [this.launcher, [-0.27, -0.3, -0.56]]]) {
        gun.holder.position.set(base[0] - this.vyaw * 0.004, base[1] + this.vpitch * 0.004 - Math.abs(Math.sin(g.time * 3)) * 0.002, base[2]);
        // aim the gun at a point on the crosshair ray
        _v.set(0, 0, -aimDist);
        gun.holder.lookAt(_v.applyMatrix4(this.camera.matrixWorld));
        gun.holder.rotateY(Math.PI); // Object3D.lookAt points +z at the target; our barrels run along -z
      }
    }
    if (this.mode === 'vr') {
      this.inputs.fireR = false; this.inputs.fireL = false;
      for (const c of this.controllers) {
        const gp = c.source?.gamepad; if (!gp) continue;
        const trig = gp.buttons[0]?.pressed;
        if (c.gun === this.rifle) this.inputs.fireR = trig; else if (c.gun === this.launcher) this.inputs.fireL = trig;
        if (gp.buttons[4]?.pressed || gp.buttons[5]?.pressed) this.inputs.reload = true;
      }
    }
    this.rifle.update(dt); this.launcher.update(dt);
    if (this.inputs.reload) { this.inputs.reload = false; if (this.rifle.startReload()) g.audio.play('reload', {}); }
    if (this.rifle.reloadStarted) { this.rifle.reloadStarted = false; g.audio.play('reload', {}); }
    if (this.launcher.reloadStarted) { this.launcher.reloadStarted = false; g.audio.play('reload', { pitch: 0.8 }); }
    // fire rifle
    if (this.rifle.tryFire(this.inputs.fireR)) {
      const mz = this.rifle.model.muzzle.getWorldPosition(new THREE.Vector3());
      const dir = new THREE.Vector3();
      let origin;
      if (this.mode === 'vr') { origin = mz.clone(); this.rifle.model.muzzle.getWorldDirection(dir).negate(); this.aimAssist(origin, dir); }
      else { origin = this.camera.getWorldPosition(new THREE.Vector3()); this.camera.getWorldDirection(dir); }
      // spread
      const sp = 0.006 + (this.auto ? 0.004 : 0);
      dir.x += range(-sp, sp); dir.y += range(-sp, sp); dir.z += range(-sp, sp); dir.normalize();
      const hit = g.fireRay(origin, dir);
      g.playerShot(this.mode === 'vr' ? origin : mz, hit.point.clone().sub(this.mode === 'vr' ? origin : mz).normalize(), 'rifle');
      g.fx.muzzle(mz, dir, 'rifle', true);
      g.fx.light(mz, 6, 0.05, 0xffb060, false, 6);
      g.audio.play('rifle', {});
      const port = this.rifle.model.port.getWorldPosition(new THREE.Vector3());
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.rifle.model.group.getWorldQuaternion(_q));
      g.fx.casing(port, right.multiplyScalar(range(3.0, 4.2)).add(new THREE.Vector3(range(-0.3, 0.3), range(1.4, 2.2), range(0.2, 0.8))));
      this.pulse(0.35, 30, 'right');
      this.shake = Math.min(1, this.shake + 0.08);
    }
    // grenade launcher
    let launch = this.inputs.fireL;
    if (this.auto && this.autoGrenade) { launch = true; }
    if (this.launcher.tryFire(launch)) {
      const mz = this.launcher.model.muzzle.getWorldPosition(new THREE.Vector3());
      const dir = new THREE.Vector3();
      if (this.mode === 'vr') this.launcher.model.muzzle.getWorldDirection(dir).negate();
      else {
        this.camera.getWorldDirection(dir);
        if (this.auto && this.autoGrenade) { const t = this.autoGrenade.dist / 58; dir.y += 0.5 * 9.8 * t * t / this.autoGrenade.dist; dir.normalize(); }
      }
      g.launchGrenade(mz.clone().addScaledVector(dir, 0.3), dir);
      g.fx.muzzle(mz, dir, 'launcher', true);
      g.audio.play('rocket_launch', { volume: 0.55, pitch: 1.6 });
      this.pulse(0.9, 70, 'left');
      this.shake = Math.min(1, this.shake + 0.35);
    }
    if (this.auto) { this.autoGrenade = null; this.inputs.fireL = false; }
  }

  aimAssist(origin, dir) {
    // gentle magnetism toward gunmen/rockets within ~3 degrees (VR only)
    let best = null, bestA = 0.05;
    const tryP = (p) => { _v.subVectors(p, origin); const d = _v.length(); if (d > 90) return; _v.divideScalar(d); const a = Math.acos(Math.min(1, _v.dot(dir))); if (a < bestA) { bestA = a; best = _v.clone(); } };
    for (const c of this.g.cars) for (const gm of c.gunmen) if (gm.alive) tryP(gm.g.chestCenter.getWorldPosition(new THREE.Vector3()));
    for (const r of this.g.rockets) tryP(r.pos);
    if (best) dir.lerp(best, 0.6).normalize();
  }
}
