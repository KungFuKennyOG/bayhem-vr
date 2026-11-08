import * as THREE from 'three';
import { range, rand, clamp, lerp, chance } from '../../rng.js';
import { GlassSystem } from '../downtown-haven/glass.js';
import { HERO } from './layout.js';
import { facadeMaterial } from './facade.js';

// =====================================================================================
//  SARAB SPIRE — the hero supertall (from the Dubai prototype's THE SPINDLE, now dressed in
//  the city's facade shader: bronze glass with vertical fins, every chunk carrying its own facade
//  coordinates so the pattern stays on the pieces as they fly). Positioned at HERO.x / HERO.z.
//   - ~150 chunks (4-floor bands: a core + four facade slabs each, and the spire) in ONE
//     instanced draw, riding a 30-node spine solved on the CPU (Level 5's twDeform idea:
//     node positions + rotations, the upper section hinging and bending above a break band;
//     here chunks are rigid so they take their node's transform per instance instead of a
//     per-vertex shader deform),
//   - floors blow out down the face (shared fx.js explosions) with a glass waterfall
//     (Level 3's glass.js shard pool, one draw),
//   - the spire shears off and tips toward the heli,
//   - the stump pancakes into its own dust, upper chunks detach top-down into tumbling rigid
//     bodies (Level 3's _detach: tamed rigid-body velocities) that trail dust and hit the ground.
// =====================================================================================

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _m3 = new THREE.Matrix3();
const UP = new THREE.Vector3(0, 1, 0);

export class HeroTower {
  constructor(game, dust, F) {
    this.g = game; this.dust = dust; this.F = F;
    const B = Math.round(HERO.h / HERO.band);
    this.B = B;
    // four setbacks up to the needle (a stepped silhouette, not one fat stack)
    const widthAt = (b) => (b < 9 ? HERO.w0 : b < 17 ? lerp(HERO.w0, HERO.w1, 0.5) : b < 25 ? HERO.w1 : HERO.w1 * 0.74);
    this.widthAt = widthAt;
    // chunk list: band b, local centre (relative to node b at the band floor), half extents, colour
    const C = [];
    for (let b = 0; b < B; b++) {
      const w = widthAt(b), hb = HERO.band, t = w * 0.2;
      C.push({ b, kind: 'core', c: [0, hb / 2, 0], h: [w * 0.3, hb / 2 - 0.1, w * 0.3], col: [0.42, 0.41, 0.4] });
      C.push({ b, kind: 'face', n: [0, 0, 1], c: [0, hb / 2, w / 2 - t / 2], h: [w / 2, hb / 2 - 0.2, t / 2], col: [0.55, 0.62, 0.68] });
      C.push({ b, kind: 'face', n: [0, 0, -1], c: [0, hb / 2, -w / 2 + t / 2], h: [w / 2, hb / 2 - 0.2, t / 2], col: [0.55, 0.62, 0.68] });
      C.push({ b, kind: 'face', n: [1, 0, 0], c: [w / 2 - t / 2, hb / 2, 0], h: [t / 2, hb / 2 - 0.2, w / 2 - t], col: [0.5, 0.58, 0.64] });
      C.push({ b, kind: 'face', n: [-1, 0, 0], c: [-w / 2 + t / 2, hb / 2, 0], h: [t / 2, hb / 2 - 0.2, w / 2 - t], col: [0.5, 0.58, 0.64] });
    }
    // the spire: tapering stack on the roof, all one rigid body when it shears off
    const SP = 8, sh = HERO.spire / SP;
    for (let k = 0; k < SP; k++) { const r = lerp(9, 1.2, k / SP); C.push({ b: B, kind: 'spire', c: [0, k * sh + sh / 2, 0], h: [r, sh / 2, r], col: [0.7, 0.7, 0.72] }); }
    this.chunks = C.map((c, i) => ({ ...c, i, c: new THREE.Vector3(...c.c), h: new THREE.Vector3(...c.h), state: 'on', p: new THREE.Vector3(), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: new THREE.Vector3(), sink: 0, hit: 0 }));
    const seg = (n) => Math.max(1, Math.round(n * F.detail));
    const geo = new THREE.BoxGeometry(2, 2, 2, seg(2), seg(3), seg(2)); // unit half-extent box, scaled per instance
    // (the facade shader reads its pattern from the instance scale: lp = position * scale)
    this.mesh = new THREE.InstancedMesh(geo, facadeMaterial({ inst: true, key: 'hero', vertexTail: 'if (vF.z > 1.5 && vF.z < 2.5) vF.z = 9.0; vS.w = -1.0;' }), C.length);
    { const org = new Float32Array(C.length * 4), st = new Float32Array(C.length * 4);
      this.chunks.forEach(c => {
        const y = c.kind === 'spire' ? HERO.h + c.c.y : c.b * HERO.band + c.c.y;
        org.set([0, y, c.kind === 'face' && c.b >= this.B - 3 ? 1 : 0, c.kind === 'face' ? (c.n[0] + 2 * c.n[2]) * 37 : 0], c.i * 4);
        st.set(c.kind === 'core' ? [5, 0.4, 4, 1] : c.kind === 'spire' ? [1, 0.9, 4, 0] : [2, 0.55, 4.2, 0], c.i * 4); // gold glass: the one tower that catches the sunset
      });
      geo.setAttribute('aOrg', new THREE.InstancedBufferAttribute(org, 4)); geo.setAttribute('aSt', new THREE.InstancedBufferAttribute(st, 4)); }
    this.mesh.frustumCulled = false;
    game.scene.add(this.mesh);
    this.tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3 * C.length;
    // spine: B+1 nodes (band floors) + the roof node the spire stands on
    this.O = new THREE.Vector3(HERO.x, 0, HERO.z);
    this.nodes = Array.from({ length: B + 1 }, (_, j) => ({ p: new THREE.Vector3(HERO.x, j * HERO.band, HERO.z), q: new THREE.Quaternion() }));
    this.spireBody = null;
    // glass: Level 3's GlassSystem with no panes, only its free-shard pool (one draw for 1 400 shards)
    if (F.glass) {
      const shim = { scene: game.scene, fx: game.fx, audio: game.audio, col: { add: () => null, remove() {} }, events: game.events, headPos: game.headPos, world: { fastGround: () => 0 }, get time() { return game.time; } };
      this.glass = new GlassSystem(shim, []);
    }
    this.reset();
  }
  get bodies() { return this.chunks.filter(c => c.state === 'fly').length; }
  get shards() { return this.glass ? this.glass.shardMesh.count : 0; }
  reset() {
    this.S = null;
    for (const c of this.chunks) { c.state = 'on'; c.sink = 0; c.hit = 0; c._tl = null; c.thr = undefined; }
    for (let j = 0; j <= this.B; j++) { this.nodes[j].p.set(HERO.x, j * HERO.band, HERO.z); this.nodes[j].q.identity(); }
    this.spireBody = null;
    if (this.glass) for (const s of this.glass.shards) s.alive = false;
    this._write();
  }
  // eye: where the money shot is seen from (the heli). The top goes over SIDEWAYS to that view, the spire toward it.
  start(eye) {
    if (this.S) return false;
    const to = _v.set(eye.x - HERO.x, 0, eye.z - HERO.z).normalize();
    const side = new THREE.Vector3(-to.z, 0, to.x); // perpendicular: we watch it fall across the frame
    // a little toward us (Bay) when watched from the orbit; square across the view on the low route (we fly through
    // where a 'toward us' top would land)
    const fd = this.fallDir ? this.fallDir.clone() : side.clone();
    this.S = { t: 0, phase: 'blowout', th: 0, om: 0, bend: 0, sink: 0, sinkV: 0, fd, ax: new THREE.Vector3().crossVectors(UP, fd).normalize(), face: to.clone(), eye: eye.clone(), blowBand: this.B - 2, blowT: 0, landed: 0 };
    // which facade faces us: blow those out first
    let best = -2; for (const c of this.chunks) if (c.kind === 'face') { const d = c.n[0] * to.x + c.n[2] * to.z; if (d > best) best = d; }
    this.S.faceN = this.chunks.find(c => c.kind === 'face' && Math.abs(c.n[0] * to.x + c.n[2] * to.z - best) < 1e-3).n;
    this.g.audio.play('collapse_rumble', { volume: 1 });
    return true;
  }
  update(dt) {
    const S = this.S;
    if (this.glass) this.glass.update(dt);
    if (!S) return;
    const g = this.g, dust = this.dust, B = this.B, K = HERO.breakBand;
    S.t += dt;
    // ---- 1. floors blow out down the face, glass pouring off it
    if (S.blowBand >= K - 3) {
      S.blowT -= dt;
      if (S.blowT <= 0) {
        S.blowT = 0.16;
        const b = S.blowBand--, w = this.widthAt(b), n = S.faceN;
        const node = this.nodes[b];
        const P = new THREE.Vector3(n[0] * (w / 2 + 1), HERO.band * 0.5, n[2] * (w / 2 + 1)).applyQuaternion(node.q).add(node.p);
        // a floor blowing out has to read from 400 m: a cluster of fireballs along the face, a big
        // flash, and a dark plume punched out of it (the shared fx balls alone are pinpricks at range)
        const side = _v2.set(-n[2], 0, n[0]).applyQuaternion(node.q);
        for (let k = -1; k <= 1; k++) g.fx.later(Math.abs(k) * 0.05, () => g.fx.explosion(P.clone().addScaledVector(side, k * w * 0.3), 1.8, { noRing: true }));
        g.fx.light(P, 900, 0.6, 0xff9040, false, 260);
        if (b % 2 === 0) dust.plume(P.x + side.x * (rand() - 0.5) * w * 0.5, P.y, P.z + side.z * (rand() - 0.5) * w * 0.5, n[0] * 16, n[2] * 16, 1.4, true);
        if (this.glass) {
          const dir = _v2.set(n[0], -0.35, n[2]);
          this.glass.burst(P, dir, 45, { spread: w * 0.4, speed: 9, size: 3.2, life: 14, plane: _v.set(n[0], 0, n[2]) }); // 3 m sheets: 1 m shards are sub-pixel from the heli
        }
        if (b % 3 === 0) dust.plume(P.x, P.y, P.z, n[0] * 10, n[2] * 10, 1.3, true);
        if (b % 3 === 0) g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 0.9, pitch: range(0.7, 0.9) });
        g.lastExplosionT = g.time; g.lastExplosionShake = 0.25;
      }
    }
    if (S.phase === 'blowout' && S.t > 2.6) {
      S.phase = 'fall'; S.t = 0; S.om = 0.05;
      g.slowmoReq?.(3.2, 0.45);
      g.audio.play('metal_groan', { x: HERO.x, y: K * HERO.band, z: HERO.z, volume: 1 });
      // the break band lets go all round
      const nb = this.nodes[K].p;
      for (let k = 0; k < 4; k++) g.fx.later(k * 0.12, () => g.fx.explosion(new THREE.Vector3(HERO.x + range(-25, 25), nb.y + range(-4, 4), HERO.z + range(-25, 25)), 2.4, { noRing: true }));
      for (let k = 0; k < Math.round(10 * dust.rate); k++) dust.plume(HERO.x + range(-30, 30), nb.y + range(-8, 8), HERO.z + range(-30, 30), range(-8, 8), range(-8, 8), 1.3, k % 2 === 0);
      // the break burns: a long orange light that washes the neighbours, fire pouring out of the torn floors
      g.fx.light(nb.clone(), 5200, 9, 0xff6a20, false, 650);
      S.fireT = 9;
    }
    if (S.fireT > 0) {
      S.fireT -= dt;
      const nb = this.nodes[K].p, w = this.widthAt(K) * 0.5;
      for (let k = Math.round(dt * 26 * clamp(S.fireT / 3, 0.2, 1) + rand()); k > 0; k--) {
        const a = rand() * Math.PI * 2;
        g.fx.flame(_v.set(HERO.x + Math.cos(a) * w * range(0.5, 1.05), nb.y + range(-6, 10), HERO.z + Math.sin(a) * w * range(0.5, 1.05)), range(8, 14));
      }
      if (rand() < dt * 6) dust.plume(HERO.x + range(-w, w), nb.y + 12, HERO.z + range(-w, w), range(-4, 4), range(-4, 4), 1.1, true);
    }
    if (S.phase === 'fall' || S.phase === 'down') {
      // the upper section leans over about the break (Level 3), the stump pancakes after a beat
      S.om += 0.34 * Math.sin(S.th + 0.1) * dt;
      S.th = Math.min(1.45, S.th + S.om * dt);
      S.bend = Math.min(0.55, S.bend + dt * 0.12 * (1 + S.th));
      if (S.t > 1.2) { S.sinkV = Math.min(16, S.sinkV + 6 * dt); S.sink = Math.min(K * HERO.band + 10, S.sink + S.sinkV * dt); }
      // spire shears off and tips toward the heli
      if (!this.spireBody && S.th > 0.22) this._shearSpire();
      for (let k = dust.emitN(4, dt); k > 0; k--) dust.skirt(HERO.x, HERO.z, 70);
      if (S.sink > 4) for (let k = dust.emitN(3, dt); k > 0; k--) dust.plume(HERO.x + range(-35, 35), Math.max(10, K * HERO.band - S.sink + range(-10, 5)), HERO.z + range(-35, 35), range(-6, 6), range(-6, 6), 1.2, rand() < 0.4);
      if (rand() < dt * 3) g.audio.play('metal_groan', { x: HERO.x, y: 200, z: HERO.z, volume: 0.9, pitch: range(0.55, 0.8) });
      g.lastExplosionT = g.time; g.lastExplosionShake = 0.15;
    }
    this._solveSpine();
    // ---- 2. upper chunks detach top-down as it leans
    if (S.phase === 'fall') {
      for (const c of this.chunks) {
        if (c.state !== 'on' || c.kind === 'spire' || c.b <= K) continue;
        const frac = (c.b - K) / (B - K);
        c.thr ??= lerp(0.95, 0.38, frac) + range(-0.08, 0.08);
        if (S.th > c.thr) this._detach(c);
      }
      if (S.th > 1.2) { for (const c of this.chunks) if (c.state === 'on' && c.b > K && c.kind !== 'spire') this._detach(c); S.phase = 'down'; }
    }
    // ---- 3. the stump: bands pushed under the ground are crushed (hidden) — their dust is the skirt
    for (const c of this.chunks) if (c.state === 'on' && c.b <= K && this.nodes[c.b].p.y + HERO.band < -3) c.state = 'gone';
    // ---- 4. rigid bodies
    for (const c of this.chunks) if (c.state === 'fly' || c.state === 'rest') this._body(c, dt);
    if (this.spireBody) this._spire(dt);
    this._write();
  }
  _solveSpine() {
    const S = this.S, K = HERO.breakBand, B = this.B, N = this.nodes;
    for (let j = 0; j <= K; j++) { N[j].p.set(HERO.x, j * HERO.band - S.sink, HERO.z); N[j].q.identity(); }
    // hinge on the break band's edge in the fall direction
    const w = this.widthAt(K), hinge = _v.copy(S.fd).multiplyScalar(w / 2).add(N[K].p);
    const q0 = _q.setFromAxisAngle(S.ax, S.th);
    const p = new THREE.Vector3().subVectors(N[K].p, hinge).applyQuaternion(q0).add(hinge);
    for (let j = K; j <= B; j++) {
      const a = S.th * (1 + S.bend * Math.pow((j - K) / (B - K), 1.4)); // whiplash: the top bends further than the base
      N[j].q.setFromAxisAngle(S.ax, a);
      N[j].p.copy(p);
      p.add(_v2.set(0, HERO.band, 0).applyQuaternion(N[j].q));
    }
  }
  _chunkWorld(c, outP, outQ) {
    const n = this.nodes[Math.min(c.b, this.B)];
    outQ.copy(n.q);
    outP.copy(c.c).applyQuaternion(n.q).add(n.p);
  }
  _detach(c) {
    const S = this.S, g = this.g;
    this._chunkWorld(c, c.p, c.q);
    // rigid-body velocity at the moment it lets go, tamed (Bay physics, not a sim)
    const K = HERO.breakBand;
    const hinge = _v.copy(S.fd).multiplyScalar(this.widthAt(K) / 2).add(this.nodes[K].p);
    const r = _v2.subVectors(c.p, hinge);
    c.v.crossVectors(_s.copy(S.ax).multiplyScalar(S.om), r).add(_v.set(0, -S.sinkV, 0));
    c.v.y = clamp(c.v.y, -16, 3);
    const hs = Math.hypot(c.v.x, c.v.z); if (hs > 30) { c.v.x *= 30 / hs; c.v.z *= 30 / hs; }
    c.v.x += range(-3, 3); c.v.z += range(-3, 3);
    c.w.copy(S.ax).multiplyScalar(S.om * range(0.5, 1.8)).add(_v.set(range(-0.25, 0.25), range(-0.3, 0.3), range(-0.25, 0.25)));
    c.state = 'fly'; c.hit = 0; c.sink = 0;
    if (c.kind === 'face' && this.glass && chance(0.6)) this.glass.burst(c.p, _v.copy(c.v).normalize().multiplyScalar(0.3), 18, { spread: c.h.x, speed: 4, size: 2.5, life: 12 });
    if (chance(0.5)) this.dust.plume(c.p.x, c.p.y, c.p.z, c.v.x * 0.4, c.v.z * 0.4, 0.8);
    g.events.push({ type: 'detach' });
  }
  _shearSpire() {
    const S = this.S, top = this.nodes[this.B];
    // one rigid body for the whole spire, pivoting on the roof node; it tips toward the heli
    const to = _v.set(S.eye.x - top.p.x, 0, S.eye.z - top.p.z).normalize();
    this.spireBody = { p: top.p.clone(), q: top.q.clone(), v: to.clone().multiplyScalar(14).setY(4), w: new THREE.Vector3().crossVectors(UP, to).multiplyScalar(0.55), t: 0, landed: false };
    for (const c of this.chunks) if (c.kind === 'spire') c.state = 'spire';
    this.g.fx.explosion(top.p.clone(), 1.8, { noRing: true });
    this.g.audio.play('metal_crash', { x: top.p.x, y: top.p.y, z: top.p.z, volume: 1, pitch: 0.6 });
    this.g.events.push({ type: 'spire' });
  }
  _spire(dt) {
    const b = this.spireBody;
    b.t += dt;
    if (!b.landed) {
      b.v.y -= 9.8 * 0.85 * dt;
      b.p.addScaledVector(b.v, dt);
      const wl = b.w.length(); if (wl > 1e-4) { _q.setFromAxisAngle(_v.copy(b.w).divideScalar(wl), wl * dt); b.q.premultiply(_q); }
      this.g.fx.trailEmit(b, _v.set(0, HERO.spire * 0.5, 0).applyQuaternion(b.q).add(b.p), 5, (q) => this.dust.plume(q.x, q.y, q.z, 0, 0, 1.0), 0);
      if (b.p.y < 6) { b.landed = true; this.dust.impact(b.p.x, b.p.z, 40, 1); this.g.audio.play('collapse_impact', { x: b.p.x, y: 2, z: b.p.z, volume: 1 }); }
    } else if (b.p.y > -HERO.spire) b.p.y -= dt * 3;
  }
  _body(c, dt) {
    if (c.state === 'rest') { c.sink += dt * 2; c.p.y -= dt * 2; if (c.sink > c.h.y * 2 + 2) c.state = 'gone'; return; }
    c.v.y -= 9.8 * 0.85 * dt;
    c.p.addScaledVector(c.v, dt);
    const wl = c.w.length(); if (wl > 1e-4) { _q.setFromAxisAngle(_v.copy(c.w).divideScalar(wl), wl * dt); c.q.premultiply(_q); }
    // dust shroud off the big pieces (trailEmit spaces it along the path: no string of pearls)
    if (c.kind === 'core' || c.i % 3 === 0) this.g.fx.trailEmit(c, c.p, 9 / Math.max(0.3, this.dust.rate), (q) => this.dust.plume(q.x, q.y, q.z, c.v.x * 0.3, c.v.z * 0.3, 1.1), 0);
    // lowest corner vs the ground
    _m.makeRotationFromQuaternion(c.q); const e = _m.elements;
    const lo = c.p.y - (Math.abs(e[1]) * c.h.x + Math.abs(e[5]) * c.h.y + Math.abs(e[9]) * c.h.z);
    if (lo < 0) {
      c.p.y -= lo;
      if (!c.hit) this._impact(c);
      c.hit++;
      c.v.y = Math.abs(c.v.y) * 0.1; c.v.x *= 0.4; c.v.z *= 0.4; c.w.multiplyScalar(0.4);
      if (c.hit > 2 || c.v.lengthSq() < 4) c.state = 'rest';
    }
  }
  _impact(c) {
    const g = this.g, S = this.S;
    S.landed++;
    if (c.kind === 'core' || S.landed % 4 === 0) this.dust.impact(c.p.x, c.p.z, 30, c.kind === 'core' ? 0.8 : 0.4);
    if (S.landed % 6 === 0) g.fx.explosion(c.p.clone().setY(3), 1.6, { noRing: true });
    if (S.landed % 3 === 0) g.audio.play('collapse_impact', { x: c.p.x, y: 2, z: c.p.z, volume: 0.9 });
    if (this.glass && S.landed % 2 === 0) this.glass.burst(_v.copy(c.p).setY(4), _v2.set(0, 0.6, 0), 20, { spread: 12, speed: 8, size: 2, life: 8, up: 3 });
  }
  _write() {
    const m = this.mesh;
    for (const c of this.chunks) {
      if (c.state === 'gone') { _m.makeScale(0, 0, 0); m.setMatrixAt(c.i, _m); continue; }
      if (c.state === 'on') this._chunkWorld(c, _v, _q);
      else if (c.state === 'spire') {
        const b = this.spireBody; if (!b) { _m.makeScale(0, 0, 0); m.setMatrixAt(c.i, _m); continue; }
        _v.copy(c.c).applyQuaternion(b.q).add(b.p); _q.copy(b.q);
      } else { _v.copy(c.p); _q.copy(c.q); }
      _m.compose(_v, _q, c.h);
      m.setMatrixAt(c.i, _m);
    }
    m.instanceMatrix.needsUpdate = true;
  }
  done() { const S = this.S; return !!S && S.phase === 'down' && !this.chunks.some(c => c.state === 'fly'); }
  // a point on the tower to look at (autopilot / waypoint)
  focus(out = new THREE.Vector3()) { return out.set(HERO.x, HERO.breakBand * HERO.band + 40 - (this.S?.sink ?? 0) * 0.5, HERO.z); }
}
