import * as THREE from 'three';
import { buildRifle, buildLauncher, Gun, VR_HOLD } from './weapons.js';
import { rand, range, clamp, damp } from './rng.js';
import { rotateRigAboutHead } from './locomotion.js';
import { settings, setSetting } from './settings.js';

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
    this.rifle.holder.position.set(0.2, -0.27, -0.6);
    this.launcher.holder.position.set(-0.31, -0.35, -0.67);
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
    this.keys = {};
    addEventListener('keydown', (e) => { if (e.code === 'KeyR') this.inputs.reload = true; this.keys[e.code] = true; });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
  }

  // ---------- on-foot movement (levels that call enableLocomotion) ----------
  enableLocomotion(loco) { this.loco = loco; this.autoMove = new THREE.Vector3(); this._wish = new THREE.Vector3(); this.snapArmed = true; this.stepDist = 0; this.bob = 0; }
  _moveInput(rdt) {
    const w = this._wish.set(0, 0, 0);
    if (this.auto) { w.copy(this.autoMove); return w; }
    if (this.mode === 'desktop') {
      const k = this.keys;
      const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), r = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      w.set(-sy * f + cy * r, 0, -cy * f - sy * r);
      if (w.lengthSq() > 1) w.normalize();
      if (k.ShiftLeft || k.ShiftRight) w.multiplyScalar(1.5);
      return w;
    }
    // VR: left stick moves relative to where the head looks, right stick snaps 45°
    // world-space head direction (the user camera sits under the rig, so this includes snap turns)
    this.camera.getWorldDirection(_d); _d.y = 0; if (_d.lengthSq() < 1e-6) _d.set(0, 0, -1); _d.normalize();
    for (const c of this.controllers) {
      const gp = c.source?.gamepad; if (!gp || gp.axes.length < 4) continue;
      const ax = gp.axes[2], ay = gp.axes[3];
      if (c.hand === 'left') {
        const m = Math.hypot(ax, ay), dz = 0.15;
        if (m > dz) {
          const s = ((m - dz) / (1 - dz)) / m;
          w.set(_d.x * -ay * s - _d.z * -ax * s * -1, 0, _d.z * -ay * s + _d.x * ax * s);
          if (gp.buttons[3]?.pressed) w.multiplyScalar(1.5);
        }
      } else if (c.hand === 'right') {
        if (this.snapArmed && Math.abs(ax) > 0.7) { this.snapArmed = false; rotateRigAboutHead(this.rig, this.camera, -Math.sign(ax) * Math.PI / 4); this.loco.turnFX = 1; }
        else if (Math.abs(ax) < 0.3) this.snapArmed = true;
        // right stick click: comfort vignette on/off (saved for next time)
        const click = !!gp.buttons[3]?.pressed;
        if (click && !this.comfortClick) {
          setSetting('comfortVignette', !settings.comfortVignette);
          this.g.hud.subtitle('SETTINGS', `Comfort vignette ${settings.comfortVignette ? 'ON' : 'OFF'}`, 1.6);
          this.g.audio.play('ui_select', { volume: 0.3 });
        }
        this.comfortClick = click;
      }
    }
    return w;
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
        if (entry.hand === 'left') this.g.hud.attachWrist(c); // score / HP / ammo watch on the left wrist
      });
      c.addEventListener('disconnected', () => {
        if (entry.gun) entry.gun.holder.removeFromParent();
        if (entry.hand === 'left') this.g.hud.attachWrist(null);
        entry.gun = null; entry.source = null;
      });
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
  // The level's game supplies candidates via autoTargets(A, head): [{kind, p, score, ref}] where kind is
  // 'look' (cinematic: never fire), anything else is shootable; heavy:true asks for a grenade. It also
  // says when the current target is stale via autoTargetDead(target).
  autopilot(rdt, dt) {
    const g = this.g, A = this.autoState;
    A.retarget -= dt; A.grenadeT -= dt;
    const head = g.headPos;
    const candidates = g.autoTargets(A, head);
    if (A.retarget <= 0 || !A.target || g.autoTargetDead(A.target)) {
      candidates.sort((a, b) => b.score - a.score);
      const nt = candidates[0] || null;
      if (nt && (!A.target || nt.ref !== A.target.ref)) A.err.set(range(-0.07, 0.07), range(-0.04, 0.05));
      A.target = nt;
      A.retarget = 0.35;
    }
    // aim
    let wantYaw = this.yaw, wantPitch = this.pitch, fire = false;
    if (A.target) {
      const p = g.autoAimPoint ? g.autoAimPoint(A.target, _v) : _v.copy(A.target.p);
      A.aimPoint.copy(p);
      _d.subVectors(p, this.camera.getWorldPosition(new THREE.Vector3()));
      const dist = _d.length();
      wantYaw = Math.atan2(-_d.x, -_d.z) + A.err.x;
      wantPitch = Math.atan2(_d.y, Math.hypot(_d.x, _d.z)) + A.err.y;
      A.err.multiplyScalar(Math.exp(-dt * 3.5));
      let dy = wantYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      const angErr = Math.hypot(dy, wantPitch - this.pitch);
      fire = angErr < (A.target.tol ?? 0.035) && dist < 85 && A.target.kind !== 'look' && !A.holdFire;
      // grenades at vehicles / heli
      const isHeavy = A.target.kind === 'look' ? false : (A.target.heavy ?? (A.target.kind === 'car' || A.target.kind === 'heli' || (A.target.kind === 'gunman' && dist > 25)));
      if (isHeavy && A.grenadeT <= 0 && dist > (A.target.minNade ?? 14) && dist < 70 && angErr < 0.08) {
        A.grenadeT = range(2.5, 4.5);
        this.autoGrenade = { dist };
      }
      wantYaw = this.yaw + dy;
    } else {
      // idle: the level decides where to look (default: slowly scan, glance at the sunset ahead now and then)
      A.lookAway += dt;
      const idle = g.autoIdleLook ? g.autoIdleLook(A, this) : null;
      if (idle) { wantYaw = idle.yaw; wantPitch = idle.pitch; }
      else {
        const ahead = Math.sin(A.lookAway * 0.25) > 0.3;
        wantYaw = ahead ? 0.25 : Math.PI * 0.95 + Math.sin(A.lookAway * 0.4) * 0.5;
        wantPitch = 0.02;
      }
      let dy = wantYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      wantYaw = this.yaw + dy;
    }
    // critically damped spring (human-ish, readable on video)
    const w = A.target ? (A.target.kind === 'look' ? (A.target.w ?? 4) : 9) : (A.idleW ?? 2.2);
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
    let bobY = 0, bobX = 0;
    if (this.loco) {
      // movement runs on sim time (slow-mo slows the player too, like everything else)
      this.camera.getWorldPosition(_v);
      this.loco.update(dt, this._moveInput(rdt), _v);
      const sp = this.loco.speed;
      this.bob += dt * (sp > 0.3 ? 1.6 + sp * 0.55 : 0) * Math.PI * 2;
      const bk = clamp(sp / 4, 0, 1) * (this.mode === 'desktop' ? 1 : 0);
      bobY = -Math.abs(Math.sin(this.bob * 0.5)) * 0.045 * bk; bobX = Math.sin(this.bob * 0.5) * 0.02 * bk;
      // footsteps by distance walked
      const stride = sp > 4 ? 1.05 : 0.78;
      if (this.loco.dist - this.stepDist > stride) {
        this.stepDist = this.loco.dist;
        g.audio.play(this.loco.onMetal ? 'step_metal' : (sp > 4 ? 'step_run' : 'step_concrete'), { volume: 0.35 + Math.min(0.35, sp * 0.06) });
      }
      g.hud.setComfort?.(this.mode === 'vr' && settings.comfortVignette ? Math.max(clamp((sp - 0.4) / 3, 0, 1) * 0.85, this.loco.turnFX) : 0);
    }
    if (this.mode === 'desktop') {
      this.shake *= Math.exp(-rdt * 6);
      const sh = this.shake;
      // camDip: scripted "knocked down / getting up" (desktop + capture only; VR never moves the head)
      const dip = this.camDip || 0;
      if (dip > 0) this.camDip = Math.max(0, dip - rdt * (this.camDipRate || 0.6));
      const dk = dip > 0 ? dip * dip * (3 - 2 * dip) : 0;
      this.camera.rotation.set(this.pitch + (sh ? Math.sin(g.time * 47) * sh * 0.02 : 0) + bobY * 0.15 + dk * 0.25, this.yaw + (sh ? Math.sin(g.time * 39) * sh * 0.02 : 0), dk * 0.35, 'YXZ');
      this.camera.position.set(Math.cos(this.yaw) * bobX, 1.65 + bobY - dk * 1.2, -Math.sin(this.yaw) * bobX);
      // viewmodel sway + converge onto the aim point
      this.camera.updateMatrixWorld();
      const aimDist = 30;
      for (const [gun, base] of [[this.rifle, [0.2, -0.27, -0.6]], [this.launcher, [-0.31, -0.35, -0.67]]]) {
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
      g.hud?.setLastHit?.(hit.point);
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
    this.g.aimAssistPoints?.(tryP);
    if (best) dir.lerp(best, 0.6).normalize();
  }
}
