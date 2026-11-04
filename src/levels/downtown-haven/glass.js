import * as THREE from 'three';
import { rand, range, chance, clamp } from '../../rng.js';
import { CELL } from '../../particles.js';
import { crackedGlassTexture } from '../../textures.js';

// =====================================================================================
//  Breakable glass: every pane exported by the world builders lives in one InstancedMesh
//  (+ a crack overlay), owns a thin collider until it breaks, and shatters into instanced
//  triangle shards (one draw call for every shard in the level) that tumble, glint, bounce
//  and settle on the ground. Free-standing bursts (tower facades, the gunship impact, the
//  falling tower) use the same shard pool.
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const Z = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0);
const MAX_SHARDS = 1400;

export class GlassSystem {
  constructor(game, panes) {
    this.g = game; this.scene = game.scene; this.fx = game.fx; this.audio = game.audio; this.col = game.col;
    this.panes = panes.map((p, i) => {
      const n = new THREE.Vector3(...p.n).normalize();
      const c = new THREE.Vector3(...p.c);
      // in-plane axes: u = horizontal (or x for horizontal panes), v = up (or z)
      const u = Math.abs(n.y) > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-n.z, 0, n.x).normalize();
      const v = new THREE.Vector3().crossVectors(n, u).normalize();
      return { i, c, n, u, v, w: p.w, h: p.h, kind: p.kind || 'store', tint: p.tint, hp: p.kind === 'lobby' ? 2 : p.kind === 'sky' ? 2 : 1, state: 'ok', crack: null, box: null };
    });
    this._initPanes();
    this._initShards();
    this.lastSound = -1;
  }

  // ---------------------------------------------------------------- panes
  _initPanes() {
    const N = Math.max(1, this.panes.length);
    const geo = new THREE.PlaneGeometry(1, 1);
    // reflective, slightly see-through: storefront interiors and the lobby read through it
    this.mat = new THREE.MeshStandardMaterial({ color: 0x5c7480, metalness: 0.92, roughness: 0.04, transparent: true, opacity: 0.42, envMapIntensity: 1.9, side: THREE.DoubleSide, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, N);
    this.mesh.renderOrder = 3; this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    // cracks: an additive overlay per pane, invisible until hit
    const cm = new THREE.MeshBasicMaterial({ map: crackedGlassTexture(), transparent: true, depthWrite: false, opacity: 0.85, blending: THREE.AdditiveBlending, color: 0xb8c8d0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
    this.cracks = new THREE.InstancedMesh(geo, cm, N);
    this.cracks.renderOrder = 4; this.cracks.frustumCulled = false; this.cracks.count = N;
    for (const p of this.panes) {
      this._writePane(p);
      const t = p.tint || (p.kind === 'sky' ? [0.85, 0.95, 1.05] : p.kind === 'lobby' ? [0.9, 1.0, 1.05] : [0.92 + rand() * 0.1, 0.96 + rand() * 0.08, 1.0]);
      this.mesh.instanceColor.setXYZ(p.i, t[0], t[1], t[2]);
      _m.makeScale(0, 0, 0); this.cracks.setMatrixAt(p.i, _m);
      // collider: thin slab along the pane (horizontal panes don't block walking, only bullets)
      const hx = Math.abs(p.u.x) * p.w / 2 + Math.abs(p.v.x) * p.h / 2 + Math.abs(p.n.x) * 0.04;
      const hy = Math.abs(p.u.y) * p.w / 2 + Math.abs(p.v.y) * p.h / 2 + Math.abs(p.n.y) * 0.04;
      const hz = Math.abs(p.u.z) * p.w / 2 + Math.abs(p.v.z) * p.h / 2 + Math.abs(p.n.z) * 0.04;
      p.box = this.col.add([p.c.x - hx, p.c.y - hy, p.c.z - hz], [p.c.x + hx, p.c.y + hy, p.c.z + hz], { kind: 'glass', mat: 'glass', ref: p, thin: true, noStand: true, noBlock: p.kind === 'sky' });
    }
    this.mesh.count = this.panes.length;
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
    this.scene.add(this.mesh, this.cracks);
  }
  _writePane(p) {
    if (p.state === 'gone') _m.makeScale(0, 0, 0);
    else { _m.makeBasis(p.u, p.v, p.n); _m.scale(_s.set(p.w, p.h, 1)); _m.setPosition(p.c); }
    this.mesh.setMatrixAt(p.i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // block / unblock nav cells under intact vertical panes (soldiers path through broken glass)
  blockNav(nav) {
    this.nav = nav;
    for (const p of this.panes) if (p.kind !== 'sky' && p.box) nav.blockBox(p.box.min, p.box.max, 1);
  }

  // a bullet (or anything) hits a pane at P travelling along dir. Returns true if the pane broke.
  hit(p, P, dir, power = 1) {
    if (p.state === 'gone') return false;
    p.hp -= power;
    this.fx.impact(P, _v.copy(dir).negate(), 'glass');
    if (p.hp > 0) {
      // spider-web crack centred on the hit
      p.state = 'cracked';
      const cw = Math.min(p.w, 2.6), ch = Math.min(p.h, 2.6);
      _v2.subVectors(P, p.c);
      const a = clamp(_v2.dot(p.u), -(p.w - cw) / 2, (p.w - cw) / 2), b = clamp(_v2.dot(p.v), -(p.h - ch) / 2, (p.h - ch) / 2);
      _v.copy(p.c).addScaledVector(p.u, a).addScaledVector(p.v, b).addScaledVector(dir, -0.012);
      _m.makeBasis(p.u, p.v, p.n); _m.scale(_s.set(cw, ch, 1)); _m.setPosition(_v);
      this.cracks.setMatrixAt(p.i, _m); this.cracks.instanceMatrix.needsUpdate = true;
      this.audio.play('impact_glass', { x: P.x, y: P.y, z: P.z, volume: 0.9 });
      return false;
    }
    this.shatter(p, P, dir, power);
    return true;
  }

  // break a pane: shards fly along `dir` from the impact point, the rest falls out of the frame
  shatter(p, P = null, dir = null, power = 1, opts = {}) {
    if (p.state === 'gone') return;
    p.state = 'gone';
    this._writePane(p);
    _m.makeScale(0, 0, 0); this.cracks.setMatrixAt(p.i, _m); this.cracks.instanceMatrix.needsUpdate = true;
    if (p.box) { this.col.remove(p.box); if (this.nav && p.kind !== 'sky') this.nav.blockBox(p.box.min, p.box.max, 0); }
    P ||= p.c; dir ||= _v2.copy(p.n).negate();
    const area = p.w * p.h;
    const n = Math.min(opts.max ?? 34, Math.max(8, Math.round(area * 3.2)));
    // shards from a jittered grid over the pane; the ones near the hit get the most speed
    const cols = Math.max(2, Math.round(Math.sqrt(n * p.w / p.h))), rows = Math.max(2, Math.round(n / cols));
    const push = opts.push ?? (2.5 + power * 2.5);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = (i + 0.5 + range(-0.35, 0.35)) / cols - 0.5, b = (j + 0.5 + range(-0.35, 0.35)) / rows - 0.5;
      const pos = _v.copy(p.c).addScaledVector(p.u, a * p.w).addScaledVector(p.v, b * p.h);
      const d = pos.distanceTo(P);
      const k = Math.exp(-d / Math.max(0.6, Math.min(p.w, p.h) * 0.5));
      const vel = new THREE.Vector3().copy(dir).multiplyScalar(push * (0.25 + k) * range(0.6, 1.2));
      vel.addScaledVector(_v2.subVectors(pos, P).normalize(), k * push * 0.3);
      vel.add(new THREE.Vector3(range(-0.4, 0.4), range(-0.2, 0.6), range(-0.4, 0.4)));
      if (opts.vel) vel.add(opts.vel);
      const sz = Math.min(p.w / cols, p.h / rows) * range(0.7, 1.35);
      this.spawnShard(pos, vel, sz, p.u, p.v, p.n, opts.life);
    }
    // sparkle + dust of the frame
    for (let i = 0; i < 24; i++) {
      _v.copy(p.c).addScaledVector(p.u, range(-0.5, 0.5) * p.w).addScaledVector(p.v, range(-0.5, 0.5) * p.h);
      this.fx.sparks.spawn({ x: _v.x, y: _v.y, z: _v.z, vx: dir.x * range(1, 5) + range(-1.5, 1.5), vy: range(-1, 2.5), vz: dir.z * range(1, 5) + range(-1.5, 1.5), grav: -9.8, drag: 0.6, frame: CELL.SPARK, s0: 1, w: 0.025, len: 0.05, life: range(0.5, 1.1), r: 1.6, g: 1.8, b: 2.0, a: 0.9, fadeOut: 0.6, ground: true });
    }
    this.fx.main.spawn({ x: P.x, y: P.y, z: P.z, vx: dir.x * 1.5, vz: dir.z * 1.5, vy: 0.2, drag: 2.5, frame: CELL.DUST, s0: 0.4, s1: Math.min(3, p.w), life: 0.9, rot: rand() * 6, r: 0.75, g: 0.8, b: 0.85, a: 0.25, fadeIn: 0.02, fadeOut: 0.5 });
    // one big crash per burst of panes (a strafe breaking 10 panes shouldn't be 10 identical sounds)
    if (!opts.quiet && this.g.time - this.lastSound > 0.07) {
      this.lastSound = this.g.time;
      this.audio.play('glass_break', { x: P.x, y: P.y, z: P.z, volume: clamp(0.45 + area * 0.06, 0.5, 1), pitch: area > 6 ? 0.85 : 1 });
    }
    this.g.events.push({ type: 'glass', p });
  }

  // explosion / shockwave: break panes in a radius, shards blown away from the blast
  blast(P, radius, power = 1) {
    let n = 0;
    for (const p of this.panes) {
      if (p.state === 'gone') continue;
      const d = p.c.distanceTo(P);
      if (d > radius + Math.max(p.w, p.h) * 0.5) continue;
      const dir = _v.subVectors(p.c, P); dir.y *= 0.5; dir.normalize();
      const delay = d / 340 + range(0, 0.04);
      const dd = dir.clone();
      this.fx.later(delay, () => this.shatter(p, p.c.clone().addScaledVector(dd, -0.2), dd, power * (1 - d / (radius * 1.6)) * 2 + 0.5, { quiet: n++ > 2 }));
    }
  }

  // free shards (tower facades, the gunship impact, the collapse): count shards around P
  burst(P, dir, count, { spread = 1.5, speed = 4, size = 0.35, life = 10, plane = null, up = 0 } = {}) {
    count = Math.min(count, 220);
    for (let i = 0; i < count; i++) {
      const pos = _v.set(P.x + range(-spread, spread), P.y + range(-spread, spread) * 0.6, P.z + range(-spread, spread));
      if (plane) pos.addScaledVector(plane, -plane.dot(_v2.subVectors(pos, P)));
      const vel = new THREE.Vector3(dir.x * speed * range(0.3, 1.2) + range(-1.5, 1.5), dir.y * speed * range(0.3, 1.2) + range(-0.5, 1.5) + up, dir.z * speed * range(0.3, 1.2) + range(-1.5, 1.5));
      _e.set(rand() * 6, rand() * 6, rand() * 6); _q.setFromEuler(_e);
      this.spawnShard(pos, vel, size * range(0.5, 1.4), null, null, null, life, _q);
    }
  }

  // ---------------------------------------------------------------- shards
  _initShards() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.42, 0, 0.5, -0.5, 0, 0.08, 0.5, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    // pale, half-clear slivers that flash white when they catch the sky (not blue confetti)
    const m = new THREE.MeshStandardMaterial({ color: 0xe2ebee, metalness: 0.55, roughness: 0.06, envMapIntensity: 1.7, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false, emissive: 0x2a3034, emissiveIntensity: 1 });
    // two-tone: sky-tinted face-on, a hot white edge glint at grazing angles (glass catching the sun as it tumbles)
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'float shFr = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);\noutgoingLight += vec3(1.6, 1.5, 1.3) * shFr;\ndiffuseColor.a = mix(diffuseColor.a, 1.0, shFr);\n#include <opaque_fragment>'); };
    this.shardMesh = new THREE.InstancedMesh(g, m, MAX_SHARDS);
    this.shardMesh.frustumCulled = false; this.shardMesh.count = 0; this.shardMesh.castShadow = false;
    this.scene.add(this.shardMesh);
    this.shards = []; this.cursor = 0;
  }
  spawnShard(pos, vel, size, u, v, n, life = 12, quat = null) {
    let s;
    if (this.shards.length < MAX_SHARDS) { s = { q: new THREE.Quaternion(), w: new THREE.Vector3(), p: new THREE.Vector3(), vel: new THREE.Vector3() }; this.shards.push(s); }
    else { s = this.shards[this.cursor % MAX_SHARDS]; this.cursor++; }
    s.p.copy(pos); s.vel.copy(vel);
    if (quat) s.q.copy(quat);
    else { _m.makeBasis(u, v, n); s.q.setFromRotationMatrix(_m); _q.setFromAxisAngle(Z, rand() * 6.28); s.q.multiply(_q); }
    s.w.set(range(-9, 9), range(-9, 9), range(-9, 9)).multiplyScalar(0.4 + vel.length() * 0.12);
    s.sx = size * range(0.6, 1.3); s.sy = size * range(0.6, 1.4);
    s.life = life * range(0.7, 1.2); s.max = s.life; s.rest = false; s.alive = true; s.bounce = 0;
  }
  update(dt) {
    let k = 0;
    const ground = this.g.world.fastGround;
    for (const s of this.shards) {
      if (!s.alive) continue;
      s.life -= dt;
      if (s.life <= 0) { s.alive = false; continue; }
      if (!s.rest) {
        s.vel.y -= 9.8 * dt;
        s.vel.multiplyScalar(Math.exp(-dt * 0.35)); // flutter
        s.p.addScaledVector(s.vel, dt);
        const wl = s.w.length();
        if (wl > 1e-3) { _q.setFromAxisAngle(_v.copy(s.w).divideScalar(wl), wl * dt); s.q.premultiply(_q); }
        const gy = ground(s.p.x, s.p.z) + 0.01;
        if (s.p.y < gy) {
          s.p.y = gy;
          if (s.vel.y < -2.5 && s.bounce < 2) {
            s.bounce++; s.vel.y *= -0.22; s.vel.x *= 0.45; s.vel.z *= 0.45; s.w.multiplyScalar(0.5);
            if (s.bounce === 1 && rand() < 0.04 && this.g.headPos.distanceToSquared(s.p) < 400) this.audio.play('impact_glass', { x: s.p.x, y: s.p.y, z: s.p.z, volume: 0.25, pitch: range(1.2, 1.8) });
          } else {
            // settle flat on the ground at a random spin
            s.rest = true; s.vel.set(0, 0, 0);
            _e.set(-Math.PI / 2 + range(-0.08, 0.08), 0, rand() * 6.28); s.q.setFromEuler(_e);
          }
        }
      }
      const fade = Math.min(1, s.life / Math.min(2, s.max * 0.3));
      _m.compose(s.p, s.q, _s.set(s.sx * fade, s.sy * fade, 1));
      this.shardMesh.setMatrixAt(k++, _m);
    }
    this.shardMesh.count = k;
    this.shardMesh.instanceMatrix.needsUpdate = true;
  }
  // nearest intact pane along the facade lines (for the gunship strafe)
  panesNear(P, r, filter) { const out = []; for (const p of this.panes) if (p.state !== 'gone' && p.c.distanceTo(P) < r && (!filter || filter(p))) out.push(p); return out; }
}
