import * as THREE from 'three';
import { clamp, range, rand } from '../../rng.js';
import { glowTexture } from '../../textures.js';

// =====================================================================================
//  THE LASER DESIGNATOR + THE STRIKES. From the strike beat on, the left hand (the grenade
//  launcher's laser module) paints targets: hold the trigger (VR) / right mouse (desktop) on a
//  target tower — a red beam from the muzzle, a dot on the facade, a lock tone — and after
//  LOCK seconds the salvo is called: cruise missiles streak in from the Gulf, hit the tower at
//  mid-height, and it comes down (MidRig) a beat later. The hero is painted the same way.
//  The autopilot paints by aiming at game.paintTarget.
// =====================================================================================

const LOCK = 1.5;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();

export class Strikes {
  constructor(game, player, onImpact) {
    this.g = game; this.player = player; this.onImpact = onImpact;
    this.on = false; this.held = false;
    this.targets = new Map(); // tower -> { lock, called, aim }
    this.painted = null; this.lock = 0;
    this.missiles = [];
    // beam: a thin cone from the muzzle (fades near the eye in the shader), and the dot
    const geo = new THREE.CylinderGeometry(1, 0.06, 1, 8, 1, true); geo.translate(0, -0.5, 0); geo.rotateX(-Math.PI / 2); // from z = 0 to z = -1
    this.beamU = { uLen: { value: 1 }, uA: { value: 0 } };
    this.beam = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.beamU,
      vertexShader: 'varying float vZ; void main(){ vZ = -position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uLen; uniform float uA; varying float vZ;
        void main(){ float d = vZ * uLen; float a = uA * smoothstep(0.5, 3.0, d) * (0.35 + 0.65 * smoothstep(0.0, 0.2, vZ));
          gl_FragColor = vec4(vec3(2.2, 0.15, 0.08) * a, 0.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.beam.frustumCulled = false; this.beam.visible = false; this.beam.renderOrder = 12;
    game.scene.add(this.beam);
    this.dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2a10, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.dot.visible = false; this.dot.renderOrder = 12; game.scene.add(this.dot);
    // the launcher's trigger becomes the designator while painting is on
    const L = player.launcher, orig = L.tryFire.bind(L);
    L.tryFire = (trig) => { if (!this.on) return orig(trig); L.lastTrigger = trig; this.held = trig; return false; };
  }
  addTarget(tower, aimY) { this.targets.set(tower, { lock: 0, called: false, aim: new THREE.Vector3(tower.x, aimY ?? tower.h * 0.55, tower.z) }); }
  remaining() { let n = 0; for (const T of this.targets.values()) if (!T.called) n++; return n; }
  // the ray the designator paints along: VR = the launcher's muzzle, desktop = the crosshair
  _ray(o, d) {
    const P = this.player;
    if (P.mode === 'vr') { const mz = P.launcher.model.muzzle; mz.getWorldPosition(o); mz.getWorldDirection(d).negate(); }
    else { this.g.camera.getWorldPosition(o); this.g.camera.getWorldDirection(d); }
  }
  update(dt, rdt) {
    const g = this.g;
    const held = this.on && (this.held || this.autoHeld);
    this.held = false;
    let hitT = null, hitP = null;
    if (held) {
      const o = new THREE.Vector3(), d = new THREE.Vector3();
      this._ray(o, d);
      const hit = g.towerRay(o, d, 4000) || (this.heroBox && this.heroBox(o, d));
      const end = hit ? o.clone().addScaledVector(d, hit.t) : o.clone().addScaledVector(d, 1500);
      // beam from the launcher muzzle (both modes: on desktop it leaves the viewmodel)
      const mz = this.player.launcher.model.muzzle.getWorldPosition(new THREE.Vector3());
      const L = mz.distanceTo(end);
      this.beam.position.copy(mz); this.beam.lookAt(end); this.beam.rotateY(Math.PI);
      this.beam.scale.set(Math.max(0.05, L * 0.0012), Math.max(0.05, L * 0.0012), L);
      this.beamU.uLen.value = L; this.beamU.uA.value = 1;
      this.beam.visible = true;
      if (hit) { this.dot.visible = true; this.dot.position.copy(end).addScaledVector(d, -1.5); const s = 3 + L * 0.012; this.dot.scale.set(s, s, s); hitT = hit.tower; hitP = end; }
      else this.dot.visible = false;
    } else { this.beam.visible = false; this.dot.visible = false; }
    // lock on a target
    const T = hitT && this.targets.get(hitT);
    if (T && !T.called) {
      if (this.painted !== hitT) { this.painted = hitT; this.lock = 0; }
      this.lock += rdt;
      if (Math.floor(this.lock * 6) !== Math.floor((this.lock - rdt) * 6)) g.audio.play('laser_lock', { volume: 0.6 + this.lock * 0.3 });
      if (this.lock >= LOCK) { T.called = true; this.lock = 0; this.painted = null; this.call(hitT, T, hitP); }
    } else { this.lock = Math.max(0, this.lock - rdt * 2); if (this.lock === 0) this.painted = null; }
    this._missiles(dt);
  }
  get lockFrac() { return this.painted ? clamp(this.lock / LOCK, 0, 1) : 0; }
  // the salvo: 3 missiles from over the Gulf, staggered, into the painted face
  call(tower, T, hitP) {
    const g = this.g;
    g.hud.callout('TARGET LOCKED', hitP.clone().setY(hitP.y + 20), 'big');
    g.audio.play('laser_lock', { volume: 1, pitch: 1.5 });
    g.events.push({ type: 'strikeCalled', tower });
    const aim = hitP ? hitP.clone() : T.aim.clone();
    for (let k = 0; k < 3; k++) {
      g.fx.later(1.2 + k * 0.45, () => {
        const from = aim.clone().add(_v.set(-0.55, 0, -0.85).normalize().multiplyScalar(2600)).add(_v2.set(range(-120, 120), 700 + range(0, 200), range(-120, 120)));
        const to = aim.clone().add(_v.set(range(-6, 6), range(-12, 12) - k * 14, range(-6, 6)));
        const m = { pos: from, to, vel: to.clone().sub(from).normalize().multiplyScalar(300), tower, k, dead: false, id: 'm' + Math.floor(rand() * 1e9) };
        this.missiles.push(m);
      });
    }
  }
  _missiles(dt) {
    const g = this.g;
    for (const m of this.missiles) {
      if (m.dead) continue;
      const step = m.vel.length() * dt;
      // steer onto the aim point (it was painted on a moving world: the tower may already lean)
      const to = _v.subVectors(m.to, m.pos); const d = to.length();
      m.vel.lerp(to.normalize().multiplyScalar(300), Math.min(1, dt * 2));
      m.pos.addScaledVector(m.vel, dt);
      g.fx.trailEmit(m, m.pos, 3.2, (q) => g.fx.smoke(q, 2.2, 0.85, 3.5, 0.3, 0.55), 0);
      g.fx.main.spawn({ x: m.pos.x, y: m.pos.y, z: m.pos.z, frame: 8 * 16, s0: 4, s1: 3, life: 0.05, r: 2.5, g: 1.4, b: 0.6, a: 1 });
      g.audio.setLoop('rocket:' + m.id, { x: m.pos.x, y: m.pos.y, z: m.pos.z, volume: 1 });
      if (d < step + 2) {
        m.dead = true; g.audio.stopLoop('rocket:' + m.id);
        const P = m.to.clone();
        g.fx.explosion(P, 1.8); g.fx.later(0.1, () => g.fx.explosion(P.clone().add(_v.set(range(-8, 8), range(-6, 6), range(-8, 8))), 1.6, { noRing: true }));
        g.fx.light(P, 900, 0.5, 0xff8a3a, false, 300);
        g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
        g.lastExplosionT = g.time; g.lastExplosionShake = 0.5;
        this.onImpact?.(m.tower, P, m.k);
      }
    }
    this.missiles = this.missiles.filter(m => !m.dead);
  }
}
