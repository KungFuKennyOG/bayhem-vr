import * as THREE from 'three';
import { range, damp } from '../../rng.js';

// =====================================================================================
//  A thin game object: what the shared Player / HUD / main.js loop expect, nothing more.
//  The rifle and launcher work (tracers, impacts on the ground, grenades that explode) so
//  the shared FX get exercised the way they will be in the real level, but there are no
//  enemies in the prototype.
// =====================================================================================

const _v = new THREE.Vector3();

export class ProtoGame {
  constructor(E) {
    Object.assign(this, { E, scene: E.scene, fx: E.fx, hud: E.hud, audio: E.audio, camera: E.camera, rig: E.rig });
    this.time = 0; this.timeScale = 1; this.slowT = 0; this.slowScale = 1;
    this.hp = 100; this.hurtFlash = 0; this.score = 0; this.combo = 0; this.comboT = 0; this.kills = 0;
    this.boss = null; this.countdown = null;
    this.headPos = new THREE.Vector3();
    this.lastExplosionT = -1; this.lastExplosionShake = 0.8;
    this.events = [];
    this.nades = [];
    this.onHaptic = () => {};
    this.allowSlowmo = true;
    E.fx.onSound = (name, P) => E.audio.play(name, { x: P.x, y: P.y, z: P.z });
  }
  // world slow-mo (the heli ignores it: it runs on real time)
  slowmoReq(dur, scale) { if (!this.allowSlowmo) return; if (this.slowT <= 0) this.audio.play('slowmo_in', {}); this.slowT = dur; this.slowScale = scale; }
  update(rdt) {
    if (this.slowT > 0) { this.slowT -= rdt; if (this.slowT <= 0) this.audio.play('slowmo_out', {}); }
    this.timeScale = damp(this.timeScale, this.slowT > 0 ? this.slowScale : 1, this.slowT > 0 ? 10 : 3, rdt);
    this.audio.setTimeScale?.(this.timeScale);
    const dt = rdt * this.timeScale;
    this.time += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - rdt * 2);
    // grenades: ballistic, burst on the ground
    for (const n of this.nades) {
      n.v.y -= 9.8 * dt; n.p.addScaledVector(n.v, dt); n.t += dt;
      this.fx.trailEmit(n, n.p, 0.6, (q) => this.fx.smoke(q, 0.5, 0.5, 1.2, 0.3, 0.4), 0);
      if (n.p.y <= 0.5 || n.t > 12) { n.dead = true; this.fx.explosion(n.p.clone().setY(Math.max(0.5, n.p.y)), 1.2); }
    }
    this.nades = this.nades.filter(n => !n.dead);
    return dt;
  }
  haptic(i, ms) { this.onHaptic(i, ms); }
  // rays hit the ground plane only (enough to see tracers and impacts from the door)
  fireRay(o, d) {
    const t = d.y < -1e-3 ? -o.y / d.y : 900;
    const point = o.clone().addScaledVector(d, Math.min(900, t));
    if (t < 900) this.fx.impact(point, _v.set(0, 1, 0), 'concrete');
    return { point };
  }
  playerShot(from, dir) { this.fx.tracer(from.clone().addScaledVector(dir, 1.5), from.clone().addScaledVector(dir, 400), { speed: 600 }); }
  launchGrenade(p, dir) { this.nades.push({ p: p.clone(), v: dir.clone().multiplyScalar(70).add(new THREE.Vector3(0, 2, 0)), t: 0 }); }
  aimAssistPoints() {}
  autoTargets() { return []; }
  autoTargetDead() { return true; }
  // autopilot / screenshots: look at the level's focus point (set by index.js), in rig-local yaw / pitch
  autoIdleLook() {
    if (!this.focus) return null;
    _v.subVectors(this.focus, this.headPos).applyQuaternion(this.rig.quaternion.clone().invert());
    return { yaw: Math.atan2(-_v.x, -_v.z), pitch: Math.atan2(_v.y, Math.hypot(_v.x, _v.z)) + range(-0.002, 0.002) };
  }
}
