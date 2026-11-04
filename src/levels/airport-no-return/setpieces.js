import * as THREE from 'three';
import { rand, range, pick, chance, clamp, lerp, damp, smooth } from '../../rng.js';
import { Gunman, Driver } from '../../characters.js';
import { RigidBox } from '../../physics.js';
import { CELL } from '../../particles.js';
import { MAT, buildSUV } from '../../vehicles.js';
import { textTexture } from '../../textures.js';
import { buildAirliner, buildCargoPlane, CARGO, cargoHoldMaterial } from './aircraft.js';
import { buildJeep, gseMaterials, JEEP, JEEP_SEAT } from './gse.js';
import { raySphere, rayOBB } from './game.js';
import { TWY, RWY, TAXI, CARGO_HOLD, JEEP_STOP, LIFTOFF_Z } from './layout.js';
import { loft } from './shapes.js';

const _fv = new THREE.Vector3(), _red = new THREE.Color(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// smooth path through points (xz), sampled by arc length
class Path {
  constructor(pts) {
    const c = new THREE.CatmullRomCurve3(pts.map(p => V3(p[0], 0, p[1])), false, 'centripetal', 0.5);
    this.c = c; this.L = c.getLength();
    this.lut = c.getSpacedPoints(Math.max(32, Math.ceil(this.L / 2)));
  }
  at(s, out) { const t = clamp(s / this.L, 0, 1) * (this.lut.length - 1), i = Math.floor(t), f = t - i; const a = this.lut[i], b = this.lut[Math.min(i + 1, this.lut.length - 1)]; return out.lerpVectors(a, b, f); }
  dir(s, out) { const a = this.at(s - 1, _v3.clone()), b = this.at(s + 1, out); return b.sub(a).setY(0).normalize(); }
}

// =====================================================================================
//  Set pieces: two jets taxiing into a fireball, the cargo plane's takeoff roll, the FOLLOW-ME
//  jeep (rail mode, Level 1 style), chasing SUVs, the ramp crew, the leap, and the credits.
// =====================================================================================
export class SetPieces {
  constructor(game) {
    this.g = game; this.w = game.world;
    this.riding = false; this.ride = { state: 'none' };
    this.carrierVel = new THREE.Vector3();
    this._jets();
    this._cargo();
    this._jeep();
    this.cars = [];
    this.pallets = [];
    this.credits = null;
    this.casingFloor = (x, z) => this._casingFloor(x, z);
    this._patchNearFx();
  }
  warmMaterials() {
    const out = [];
    for (const j of this.jets) out.push(...j.a.parts.nose.userData.mesh.material);
    out.push(...this.cargo.mesh.material);
    return out;
  }

  // ================================================================== jets on taxiway A
  _jets() {
    const g = this.g;
    this.jets = [];
    for (const [liv, z0] of [['sunwest', TAXI.zStart], ['haven', TAXI.zStart - 82]]) {
      const a = buildAirliner(liv);
      a.root.position.set(TAXI.x, 0, z0); a.root.rotation.y = Math.PI; // nose toward +z (toward the threshold)
      g.scene.add(a.root);
      for (const [w, d, z] of [[5.5, 38, 0], [36, 8, 0.8]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), MAT.blob); b.position.set(0, 0.04, z); b.renderOrder = 3; a.whole.add(b); }
      const J = { a, z: z0, v: 0, vTarget: 0, state: 'hold', eng: [{ hp: 12, fire: 0, side: -1 }, { hp: 12, fire: 0, side: 1 }], t: 0, pieces: [], idx: this.jets.length, spool: 0.25 };
      this.jets.push(J);
      g.targets.push({
        name: 'jet', ref: J, active: () => J.state === 'hold' || J.state === 'taxi' || J.state === 'hurt',
        ray: (o, d) => this._jetRay(J, o, d),
        hit: (P, dir) => this._jetHit(J, P, dir),
        aim: () => this._jetAim(J),
        near: (p) => this._jetNear(J, p),
        blast: (p) => this._jetBlast(J, p),
        blastAt: (P, size, radius) => { const d = J.a.root.position.distanceTo(P) - 10; if (d < radius) this._damageEngine(J, J.a.root.worldToLocal(_v.copy(P)).x < 0 ? 0 : 1, 6 * size * (1 - Math.max(0, d) / radius)); },
        dead: () => J.state === 'boom' || J.state === 'wreck',
        auto: (head, A) => {
          if (!this.jetsArmed || !(J.state === 'taxi' || J.state === 'hurt')) return null;
          const p = this._jetAim(J); const d = p.distanceTo(head);
          if (d > 85 || d < 12) return null;
          return { kind: 'target', p, score: 140 - J.idx * 30, ref: g.targets.find(t => t.ref === J), heavy: true, minNade: 12, tol: 0.05 };
        },
      });
    }
  }
  startJets() {
    this.jetsArmed = true;
    for (const J of this.jets) { J.state = 'taxi'; J.vTarget = J.idx === 0 ? 11.5 : 12.5; }
    this.g.audio.play('jet_spool', { x: TAXI.x, y: 3, z: this.jets[0].z, volume: 1 });
  }
  _jetMatrix(J) { J.a.root.updateMatrixWorld(true); return J.a.root.matrixWorld; }
  _jetRay(J, o, d) {
    const M = this._jetMatrix(J); let best = -1; J._hitName = null;
    for (const h of J.a.hit) { const t = rayOBB(o, d, M, h.min, h.max); if (t > 0 && (best < 0 || t < best)) { best = t; J._hitName = h.name; } }
    return best;
  }
  _jetHit(J, P, dir) {
    const g = this.g, n = J._hitName;
    g.fx.impact(P, _v.copy(dir).negate(), 'metal');
    g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.6 });
    if (n === 'engL' || n === 'engR') { this._damageEngine(J, n === 'engL' ? 0 : 1, 1); g.hitMarker(false); }
    else if (n === 'fus' && chance(0.15)) g.hitMarker(false);
  }
  _jetAim(J) {
    // aim at the less damaged engine's intake (that's what makes it go)
    const e = J.eng[0].hp <= J.eng[1].hp ? 0 : 1;
    return J.a.root.localToWorld(V3(J.eng[e].side * 5.05, 1.42, -3.6));
  }
  _jetNear(J, p) {
    if (!(J.state === 'taxi' || J.state === 'hold' || J.state === 'hurt')) return false;
    const L = J.a.root.worldToLocal(_v.copy(p));
    return (Math.abs(L.x) < 2.3 && L.y < 5.4 && L.z > -18.5 && L.z < 19) || (Math.abs(Math.abs(L.x) - 5) < 1.6 && L.y < 2.6 && L.z > -6 && L.z < 0.5) || (Math.abs(L.x) < 17 && L.y < 3.6 && L.y > 1.4 && L.z > -3.6 && L.z < 6);
  }
  _jetBlast(J, p) {
    const L = J.a.root.worldToLocal(_v.copy(p));
    const e = L.x < 0 ? 0 : 1;
    this._damageEngine(J, e, Math.abs(Math.abs(L.x) - 5) < 3 ? 9 : 5);
  }
  _damageEngine(J, e, amount) {
    const E = J.eng[e];
    if (E.hp <= 0 || J.state === 'boom' || J.state === 'wreck') return;
    E.hp -= amount;
    if (E.hp < 7 && !E.smoke) { E.smoke = true; this.g.audio.play('metal_groan', { ...this._engPos(J, e), volume: 0.7 }); }
    if (E.hp <= 0) {
      const P = J.a.root.localToWorld(V3(E.side * 5.05, 1.6, -2.4));
      this.g.fx.explosion(P, 1.3);
      this.g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z });
      this.g.addScore(400, 'ENGINE OUT!', P.clone().setY(P.y + 5), 'big');
      J.state = 'hurt'; J.fuse = 0.9; J.hurtE = e;
      this.g.events.push({ type: 'jetHurt', J });
    }
  }
  _engPos(J, e) { const p = J.a.root.localToWorld(V3(J.eng[e].side * 5.05, 1.4, -3)); return { x: p.x, y: p.y, z: p.z }; }

  // the big one: fuel tanks go, the airframe breaks into four burning pieces
  explodeJet(J, cause = 'player') {
    if (J.state === 'boom' || J.state === 'wreck') return;
    const g = this.g, root = J.a.root;
    J.state = 'boom'; J.t = 0;
    root.updateMatrixWorld(true);
    const C = root.localToWorld(V3(0, 2.6, 0.5));
    g.jetsDown++;
    g.audio.play('fuel_whoomp', { x: C.x, y: C.y, z: C.z, volume: 1 });
    g.audio.play('explosion_big', { x: C.x, y: C.y, z: C.z, volume: 1 });
    g.audio.musicStinger('boss');
    // fireballs: wing tank -> centre tank (huge, mushroom) -> other wing
    const wE = J.hurtE ?? 0, s0 = wE === 0 ? -1 : 1;
    g.boom(root.localToWorld(V3(s0 * 7, 2.6, 0.8)), 2.0, { radius: 12, dmg: 70, shake: 1.2 });
    g.fx.later(0.22, () => g.boom(C.clone(), 3.4, { radius: 16, dmg: 90, shake: 1.6 }));
    g.fx.later(0.5, () => g.boom(root.localToWorld(V3(-s0 * 7, 2.6, 0.8)), 2.2, { radius: 12, dmg: 70 }));
    g.fx.later(0.75, () => { g.fx.explosion(root.localToWorld(V3(0, 4, 12)), 1.6); g.audio.play('metal_crash', { x: C.x, y: C.y, z: C.z, volume: 1 }); });
    // mushroom column + burning fuel carpet under the wings
    for (let k = 0; k < 6; k++) g.fx.later(0.25 + k * 0.09, () => g.fx.main.spawn({ x: C.x, y: C.y + 4 + k * 3, z: C.z, vy: range(9, 13), vx: range(-1, 1), vz: range(-1, 1), drag: 1.0, frameKind: 1, s0: 9, s1: 22, ease: 0.6, life: range(2.0, 2.8), rot: rand() * 6, vrot: 0.25, r: 2.2, g: 1.8, b: 1.5, fadeOut: 0.8 }));
    for (let k = 0; k < 22; k++) g.fx.later(0.15 + k * 0.035, () => { const a = rand() * 6.28, r = range(3, 16); g.fx.explosion(V3(C.x + Math.cos(a) * r, 0.5, C.z + Math.sin(a) * r * 1.3), range(0.4, 0.75), { noRing: true }); });
    g.slowmo(1.8, 0.28, true);
    g.addScore(5000, J.idx === 0 ? 'JET SET!' : 'DOUBLE TAXI!', C.clone().setY(C.y + 12), 'huge');
    if (cause === 'crash') g.callout('NO BRAKES!', C.clone().setY(C.y + 20), 'big');
    // breakup: the four pieces become rigid bodies with the jet's velocity + blast impulses
    const vel = V3(0, 0, J.v); // nose toward +z
    const kicks = { nose: V3(range(-2, 2), 7, 9), aft: V3(range(-2, 2), 5, -5), wingL: V3(-6 * (wE === 0 ? 1.6 : 1), 9, 0), wingR: V3(6 * (wE === 1 ? 1.6 : 1), 9, 0) };
    const spins = { nose: V3(range(-0.6, 0.6), range(-1.2, 1.2), range(-0.8, 0.8)), aft: V3(range(-0.9, -0.5), range(-0.6, 0.6), range(-0.4, 0.4)), wingL: V3(range(-1, 1), range(-1, 1), range(1.5, 2.5)), wingR: V3(range(-1, 1), range(-1, 1), -range(1.5, 2.5)) };
    J.pieces = [];
    J.a.breakApart();
    for (const [name, part] of Object.entries(J.a.parts)) {
      const com = part.userData.com, half = part.userData.half;
      const rb = new RigidBox(half.x, half.y, half.z, name.startsWith('wing') ? 5 : 9);
      rb.pos.copy(root.localToWorld(com.clone())); rb.quat.copy(root.quaternion);
      rb.vel.copy(vel).add(kicks[name].applyQuaternion(root.quaternion)); rb.ang.copy(spins[name]); rb.restitution = 0.12; rb.friction = 0.6; rb.linDamp = 0.05;
      // re-parent the piece into the scene, pivoting about its centre of mass
      const pivot = new THREE.Group(); g.scene.add(pivot); pivot.position.copy(rb.pos); pivot.quaternion.copy(rb.quat);
      part.position.copy(com).negate(); pivot.add(part);
      J.pieces.push({ name, rb, pivot, fire: 1, smokeT: 0, settled: false });
      g.fx.later(1.0, () => { part.userData.mesh.material = part.userData.mesh.material.map((m, i) => (i === 0 || i === 1 || i === 2 || i === 6 || i === 11 ? this._scorched(m, i === 1 || i === 11) : m)); });
    }
    // a detached engine cartwheels across the apron
    const eng = this._looseEngine(J, root.localToWorld(V3(s0 * 5.05, 1.42, -3)), V3(range(9, 12), 7, J.v * 0.6 + range(-2, 2)));
    J.pieces.push(eng);
    for (const f of J.a.fans) f.visible = true;
    g.smokeCols.push({ p: C.clone().setY(1), k: 2.4, life: 400, fire: 2.2 });
    g.events.push({ type: 'jetBoom', J, P: C.clone() });
  }
  _scorched(m, plain = false) { return this.g.scorch(m, plain); }
  _looseEngine(J, P, vel) {
    const g = this.g;
    if (!this._engGeo) {
      this._engGeo = loft([{ z: -2.3, cy: 0, rx: 0.86, ry: 0.86 }, { z: -2.2, cy: 0, rx: 1.0, ry: 1.0 }, { z: -0.5, cy: 0, rx: 1.02, ry: 1.02 }, { z: 1.4, cy: 0, rx: 0.86, ry: 0.86 }, { z: 2.1, cy: 0, rx: 0.62, ry: 0.62 }, { z: 2.9, cy: 0, rx: 0.3, ry: 0.3 }], { segs: 22 });
      this._engFace = new THREE.CircleGeometry(0.84, 22); this._engFace.rotateY(Math.PI); this._engFace.translate(0, 0, -2.0);
    }
    const nacMat = this._scorched(J.a.parts.wingR.userData.mesh.material[2]);
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(this._engGeo, nacMat); mesh.castShadow = true; pivot.add(mesh);
    const face = new THREE.Mesh(this._engFace, J.a.fans[0].material); pivot.add(face);
    g.scene.add(pivot);
    const rb = new RigidBox(1.0, 1.0, 2.4, 3); rb.pos.copy(P); rb.vel.copy(vel); rb.ang.set(range(-1, 1), range(3, 5), range(-6, -4)); rb.restitution = 0.35; rb.friction = 0.35;
    return { name: 'engine', rb, pivot, fire: 0.9, smokeT: 0, settled: false, engine: true };
  }
  _updJets(dt) {
    const g = this.g;
    for (const J of this.jets) {
      J.t += dt;
      if (J.state === 'hold' || J.state === 'taxi' || J.state === 'hurt') {
        J.v = damp(J.v, J.state === 'hold' ? 0 : J.vTarget, 0.5, dt);
        // the second jet brakes hard when the first one goes up, but too late
        if (J.idx === 1 && this.jets[0].state !== 'taxi' && this.jets[0].state !== 'hold' && J.state !== 'hurt') {
          if (!J.braking) { J.braking = true; g.audio.play('tire_screech', { x: TAXI.x, y: 1, z: J.z, volume: 1, pitch: 0.6 }); }
          J.vTarget = 0; J.v = Math.max(0, J.v - dt * 1.6);
          const lead = this.jets[0].pieces.find(p => p.name === 'aft');
          if (lead && J.z + 18 > lead.rb.pos.z - 10 && J.state !== 'boom') this.explodeJet(J, 'crash');
          else if (J.v < 0.5 && J.braking && J.t > 0) { J.crashT = (J.crashT ?? 2.5) - dt; if (J.crashT <= 0) this.explodeJet(J, 'crash'); }
        }
        J.z += J.v * dt;
        J.a.root.position.z = J.z;
        // nose bob as it brakes / rolls over the joints
        J.a.root.rotation.x = Math.sin(J.t * 3.1) * 0.002 + (J.braking ? 0.012 : 0);
        J.spool = damp(J.spool, J.state === 'hold' ? 0.3 : 0.75, 0.6, dt);
        for (const f of J.a.fans) f.rotation.z -= dt * (8 + J.spool * 30);
        // nav / beacon / taxi lights
        const A = J.a.anchors, lit = (p, sz, r, gg, b, al = 1) => this.w.addGlow(J.a.root.localToWorld(_v.copy(p)), sz, r, gg, b, al);
        lit(A.navL, 1.3, 2.8, 0.2, 0.1); lit(A.navR, 1.3, 0.2, 2.8, 0.6); lit(A.tail, 1.0, 2.4, 2.4, 2.4);
        if (Math.sin(g.time * 6.5 + J.idx) > 0.55) { lit(A.beaconTop, 2.0, 3, 0.25, 0.1); lit(A.beaconBot, 2.0, 3, 0.25, 0.1); }
        if (J.state !== 'hold') { lit(A.landL, 4.5, 3, 2.9, 2.6, 0.9); lit(A.landR, 4.5, 3, 2.9, 2.6, 0.9); lit(A.taxi, 3.5, 3, 2.9, 2.6, 0.9); }
        // damaged engines smoke / burn; a dead engine cooks the wing until the tank goes
        J.eng.forEach((E, e) => {
          if (!E.smoke) return;
          const P = J.a.root.localToWorld(_v.set(E.side * 5.05, 1.5, 0.2));
          g.fx.trailEmit(E, P, 0.4, (q) => { g.fx.smoke(q, 1.3 * range(0.6, 1.4), E.hp <= 0 ? 0.08 : 0.22, 3.5 * range(0.7, 1.3), 1.4, 0.7); if (E.hp < 3) g.fx.flame(q, 0.9 * range(0.7, 1.3)); }, 0);
        });
        if (J.state === 'hurt') { J.fuse -= dt; if (J.fuse <= 0) this.explodeJet(J); }
        // scripted fallback: the refueler parked by the taxiway catches it if nobody shoots it
        if (J.idx === 0 && J.state === 'taxi' && J.z > TAXI.zBlow && this.jetsArmed) { this._damageEngine(J, 1, 99); }
        if (J.z > RWY.z0 - 20) J.state = 'hold';
      } else if (J.state === 'boom' || J.state === 'wreck') {
        for (const P of J.pieces) {
          if (P.settled) { this._pieceFire(P, dt); continue; }
          const rb = P.rb;
          rb.floorY = 0; rb.step(dt, 0);
          P.pivot.position.copy(rb.pos); P.pivot.quaternion.copy(rb.quat);
          if (rb.contactSpeed > 4 && (P.lastHit ?? -9) < g.time - 0.35) { P.lastHit = g.time; g.audio.play('metal_crash', { x: rb.pos.x, y: rb.pos.y, z: rb.pos.z, volume: Math.min(1, rb.contactSpeed / 10) }); g.fx.ring(rb.pos, 10, 0.4, 0); }
          if (rb.scrape > 6) for (let k = 0; k < 3; k++) g.fx.sparks.spawn({ x: rb.contactPoint.x, y: 0.1, z: rb.contactPoint.z, vx: rb.vel.x * 0.6 + range(-3, 3), vy: range(2, 6), vz: rb.vel.z * 0.6 + range(-3, 3), grav: -12, drag: 0.8, frame: CELL.SPARK, s0: 1, w: 0.06, life: range(0.3, 0.7), r: 1.8, g: 1.0, b: 0.4, a: 1, fadeOut: 0.5 });
          this._pieceFire(P, dt);
          if (rb.onGround && rb.vel.lengthSq() < 0.3 && rb.ang.lengthSq() < 0.08) P.settled = true;
        }
        if (J.state === 'boom' && J.t > 6) J.state = 'wreck';
      }
      // jet noise: idle whine on the taxiway
      if (J.state === 'hold' || J.state === 'taxi' || J.state === 'hurt') g.audio.setLoop('jet:' + J.idx, { x: TAXI.x, y: 2, z: J.z, volume: 0.9, intensity: J.spool });
    }
  }
  _pieceFire(P, dt) {
    const g = this.g;
    P.fire = Math.max(0.35, P.fire - dt * 0.01);
    P.smokeT -= dt;
    if (P.smokeT > 0) return;
    P.smokeT = P.engine ? 0.06 : 0.05;
    const rb = P.rb, near = g.headPos.distanceTo(rb.pos) < 220;
    if (!near && rand() < 0.6) return;
    // moving fast: emit along the path with jittered, overlapping puffs (timer emission beads into a string of pearls)
    if (rb.vel.lengthSq() > 9) {
      g.fx.trailEmit(P, rb.pos, 0.5, (q) => {
        g.fx.flame(q, (P.engine ? 0.9 : 1.4) * P.fire * range(0.7, 1.3), _fv.copy(rb.vel).multiplyScalar(0.8));
        if (rand() < 0.75) g.fx.smoke(q, (P.engine ? 2.0 : 3.0) * range(0.6, 1.4), 0.1, range(4, 7), range(2, 4), 0.75);
      }, 0);
      return;
    }
    P._tl = null;
    const h = P.engine ? 1 : rb.h.length() * 0.3;
    const p = _v.set(rb.pos.x + range(-1, 1) * h, Math.max(0.3, rb.pos.y + range(0, 1)), rb.pos.z + range(-1, 1) * h);
    g.fx.flame(p, (P.engine ? 0.9 : 1.6) * P.fire);
    if (rand() < 0.5) g.fx.smoke(p, P.engine ? 1.2 : 2.4, 0.1, 6, 3, 0.8);
  }

  // ================================================================== cargo plane
  _cargo() {
    const g = this.g;
    const c = this.cargo = buildCargoPlane();
    c.root.position.set(CARGO_HOLD.x, 0, CARGO_HOLD.z);
    g.scene.add(c.root);
    this.rampA = 0.14; c.setRamp(this.rampA);
    Object.assign(c, { z: CARGO_HOLD.z, v: 0, state: 'hold', pitch: 0, alt: 0, vy: 0, t: 0, spool: 0.25, vel: new THREE.Vector3() });
    // ramp crew: three goons in the hold, firing back at you
    c.crew = [];
    for (const [x, z, kneel, seed] of [[-1.5, 8.2, 0, 71], [1.4, 7.6, 0.6, 72], [0.2, 5.5, 0.2, 73]]) {
      const gm = new Gunman({ pose: 'ground', seed: seed * 7919, headgear: seed % 3 });
      gm.root.position.set(x, CARGO.floorY, z); gm.root.rotation.y = Math.PI; // facing +z (out of the ramp)
      gm.setCrouch(kneel);
      c.root.add(gm.root);
      c.crew.push({ gm, alive: true, hp: 3, cool: range(1, 2.5), burst: 0, kneel, x, z, active: false });
    }
    g.targets.push({
      name: 'crew', active: () => this.cargo.crew.some(k => k.alive && k.active),
      ray: (o, d) => {
        let best = -1; this._crewHit = null;
        for (const k of this.cargo.crew) {
          if (!k.alive) continue;
          for (const [obj, r, kind] of [[k.gm.headCenter, 0.18, 'head'], [k.gm.chestCenter, 0.32, 'body']]) { const t = raySphere(o, d, obj.getWorldPosition(_v), r); if (t > 0 && (best < 0 || t < best)) { best = t; this._crewHit = { k, kind }; } }
        }
        return best;
      },
      hit: (P, dir) => { const h = this._crewHit; if (!h) return; this.g.fx.impact(P, _v.copy(dir).negate(), 'body'); this.g.audio.play('impact_flesh', { x: P.x, y: P.y, z: P.z }); this.g.hitMarker(h.kind === 'head'); h.k.hp -= h.kind === 'head' ? 99 : 1; if (h.k.hp <= 0) this._killCrew(h.k, dir, h.kind === 'head'); else h.k.gm.hit(dir); },
      aim: () => { const k = this.cargo.crew.find(k => k.alive && k.active); return k ? k.gm.chestCenter.getWorldPosition(new THREE.Vector3()) : this.cargo.root.position; },
      near: (p) => { const L = this.cargo.root.worldToLocal(_v.copy(p)); return Math.abs(L.x) < 3 && L.y > CARGO.floorY - 0.5 && L.y < CARGO.floorY + 4 && L.z > 2 && L.z < 17; },
      blast: (p) => { for (const k of this.cargo.crew) if (k.alive && k.active && k.gm.chestCenter.getWorldPosition(_v).distanceTo(p) < 4.5) this._killCrew(k, _v2.subVectors(_v, p).normalize().add(UP), false, 2.4); },
      auto: (head, A) => {
        const k = this.cargo.crew.find(k => k.alive && k.active); if (!k) return null;
        const p = k.gm.chestCenter.getWorldPosition(new THREE.Vector3()); if (p.distanceTo(head) > 80) return null;
        return { kind: 'target', p, score: 120, ref: g.targets.find(t => t.name === 'crew'), tol: 0.03 };
      },
    });
  }
  _killCrew(k, dir, head, power = 1.4) {
    const g = this.g; if (!k.alive) return;
    k.alive = false; g.kills++; if (head) g.headshots++;
    g.audio.play('kill_confirm', {});
    const P = k.gm.chestCenter.getWorldPosition(new THREE.Vector3());
    g.addScore(head ? 250 : 200, head ? 'HEADSHOT' : pick(['OFF THE RAMP!', 'BAGGAGE CLAIM!', 'WRONG FLIGHT!']), P.clone().setY(P.y + 1.4), 'small');
    g.addCorpse(k.gm, this.cargo.vel.clone().setY(0), dir.clone().add(V3(0, 0.3, 0.6)).normalize(), power);
  }
  startTakeoff() {
    const c = this.cargo; if (c.state !== 'hold') return;
    c.state = 'roll'; c.t = 0;
    this.g.audio.play('jet_spool', { x: c.root.position.x, y: 5, z: c.z, volume: 1, pitch: 0.7 });
  }
  _updCargo(dt) {
    const g = this.g, c = this.cargo;
    c.t += dt;
    const accel = c.state === 'roll' ? (c.v < 20 ? 1.5 : c.v < 45 ? 1.35 : 1.15) * (this.ride.state === 'chase' ? this._cargoBoost : 1) : 0;
    if (c.state === 'roll' || c.state === 'rotate' || c.state === 'climb') c.v += accel * dt;
    if (c.state === 'climb') c.v = c.alt < 80 ? Math.min(c.v + dt * 1.2, 80) : damp(c.v, 62, 0.3, dt);
    if (c.state === 'roll') c.v = Math.min(c.v, this.allowRotate ? 64 : 56.5); // holds just under rotation speed until the jeep is close
    c.z -= c.v * dt;
    // rotate: nose up about the main gear, tail (and the ramp lip) sinks toward the runway
    if (c.state === 'roll' && this.allowRotate && c.v > 52 && ((this.gap ?? 99) < 16 || c.z < RWY.z1 + 700)) { c.state = 'rotate'; c.t = 0; g.events.push({ type: 'rotate' }); }
    if (c.state === 'rotate') { c.pitch = Math.min(this.leapT !== undefined && this.ride.state === 'onPlane' ? 0.15 : 0.07, c.pitch + dt * 0.05); this.rampA = damp(this.rampA, 0.05, 1.5, dt); c.setRamp(this.rampA); if (c.t > (this.leapT !== undefined || this.ride.state !== 'chase' ? 2.2 : 4.5)) { c.state = 'climb'; c.t = 0; g.events.push({ type: 'liftoff' }); } }
    if (c.state === 'climb') { c.vy = c.alt < 80 ? Math.min(9, c.vy + dt * 2.2) : damp(c.vy, 1.2, 0.4, dt); c.alt += c.vy * dt; c.pitch = damp(c.pitch, c.alt < 80 ? 0.13 : 0.05, 0.5, dt); }
    c.vel.set(0, c.state === 'climb' ? c.vy : 0, -c.v);
    // place: pivot about the main gear contact point (c.z = the root's z at zero pitch)
    const gz = CARGO.gearZ, th = c.pitch;
    c.root.rotation.set(th, 0, 0);
    c.root.position.set(CARGO_HOLD.x, c.alt + gz * Math.sin(th), c.z + gz - gz * Math.cos(th));
    c.root.updateMatrixWorld(true);
    // engines + lights
    c.spool = damp(c.spool, c.state === 'hold' ? 0.3 : 1, 0.5, dt);
    for (const f of c.fans) f.rotation.z -= dt * (10 + c.spool * 40);
    const W = this.w;
    const lit = (p, s, r, gg, b, a = 1) => { const w = c.root.localToWorld(_v.copy(p)); W.addGlow(w, s, r, gg, b, a); };
    lit(c.anchors.navL, 1.6, 2.8, 0.2, 0.1); lit(c.anchors.navR, 1.6, 0.2, 2.8, 0.6); lit(c.anchors.tail, 1.2, 2.5, 2.5, 2.5);
    if (Math.sin(g.time * 6) > 0.6) { lit(c.anchors.beaconTop, 2.4, 3, 0.25, 0.1); lit(c.anchors.beaconBot, 2.4, 3, 0.25, 0.1); }
    if (c.state !== 'hold') { lit(c.anchors.landL, 6, 3, 2.9, 2.6); lit(c.anchors.landR, 6, 3, 2.9, 2.6); }
    for (const p of c.anchors.holdLamps) lit(p, 0.9, 2.6, 0.25, 0.1, 0.8);
    if (c.state !== 'hold') for (const p of c.anchors.exhausts) lit(p, 2.2 + c.spool * 1.2, 2.4, 1.0, 0.35, 0.55 * c.spool);
    if ((g.time * 1.1) % 1 < 0.06) { lit(c.anchors.navL, 4, 4, 4, 4); lit(c.anchors.navR, 4, 4, 4, 4); }
    // exhaust heat / thrust: smoke-ish shimmer behind the engines, dust kicked off the runway
    if (c.state !== 'hold' && c.alt < 40) {
      for (const p of c.anchors.exhausts) if (rand() < dt * 18 * c.spool) { const w = c.root.localToWorld(_v.copy(p)); g.fx.main.spawn({ x: w.x, y: w.y, z: w.z, vx: range(-1, 1), vy: range(0, 1), vz: c.vel.z * 0.2 + 30, drag: 1.5, frame: CELL.WISP, s0: 1.2, s1: 4, life: 0.8, rot: rand() * 6, r: 0.5, g: 0.45, b: 0.4, a: 0.12, fadeOut: 0.6 }); }
      if (rand() < dt * 10 * c.spool) { const w = c.root.localToWorld(_v.set(range(-14, 14), 0, 8)); g.fx.main.spawn({ x: w.x, y: 0.3, z: w.z, vx: range(-2, 2), vy: range(0.1, 0.5), vz: 18, drag: 1.2, frame: CELL.DUST, s0: 1.5, s1: 6, life: 1.4, rot: rand() * 6, r: 0.7, g: 0.58, b: 0.46, a: 0.14, fadeOut: 0.6 }); }
    }
    // ramp lip scraping the runway during rotation: sparks!
    if (c.state === 'rotate' || (c.state === 'climb' && c.alt < 1.5)) {
      const lip = c.ramp.localToWorld(_v.set(range(-2.4, 2.4), -0.4, CARGO.rampLen));
      if (lip.y < 0.25) {
        for (let k = 0; k < 6; k++) g.fx.sparks.spawn({ x: lip.x + range(-0.4, 0.4), y: 0.05, z: lip.z, vx: range(-4, 4), vy: range(2, 7), vz: range(10, 30), grav: -12, drag: 0.6, frame: CELL.SPARK, s0: 1, w: 0.07, life: range(0.3, 0.8), r: 2, g: 1.1, b: 0.4, a: 1, fadeOut: 0.5 });
        if ((this._scrapeT ?? -9) < g.time - 0.25) { this._scrapeT = g.time; g.audio.play('metal_groan', { x: lip.x, y: 0.5, z: lip.z, volume: 0.9, pitch: 1.4 }); }
      }
    }
    // crew behaviour: open fire once you're inside ~140 m
    this._updCrew(dt);
  }
  _updCrew(dt) {
    const g = this.g, c = this.cargo, head = g.headPos;
    for (const k of c.crew) {
      if (!k.alive) continue;
      const dist = k.gm.chestCenter.getWorldPosition(_v).distanceTo(head);
      k.active = this.ride.state === 'chase' && dist < 140;
      // aim in the crew's local frame (plane moves): target = player head
      k.gm.setMove(0, 0);
      k.gm.update(dt, head);
      if (!k.active) continue;
      k.cool -= dt;
      if (k.cool <= 0 && k.gm.canFire) {
        if (k.burst <= 0) k.burst = 3 + Math.floor(rand() * 5);
        k.burst--; k.cool = k.burst > 0 ? 0.1 : range(1.0, 2.0) * (g.trailer ? 1.3 : 1);
        k.gm.fire(); g.enemyShot({ gm: k.gm, role: 'crew' }, dist);
      }
    }
  }

  // ================================================================== the FOLLOW-ME jeep
  _jeep() {
    const g = this.g, mats = gseMaterials();
    const b = buildJeep();
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(b.geometry, mats); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    // the shared animated sidekick (Level 1's buddy): steers, flinches at blasts, talks on the radio, glances back
    const buddy = new Driver({ seed: 11, seat: JEEP_SEAT }); buddy.root.position.fromArray(JEEP_SEAT.position); root.add(buddy.root);
    const driver = buddy.root;
    const sign = new THREE.Mesh(b.sign, mats); sign.position.copy(b.signPos); sign.castShadow = true; root.add(sign);
    { const bl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 6.2).rotateX(-Math.PI / 2), MAT.blob); bl.position.y = 0.03; bl.renderOrder = 3; root.add(bl); }
    root.position.set(110, 0, -60); root.visible = false;
    g.scene.add(root);
    const J = this.jeep = { root, mesh, driver, buddy, buddySt: { steer: 0, bump: 0, talking: false, lookBack: 0, flinch: 0, time: 0 }, sign, signFold: 0, b, pos: root.position, yaw: Math.PI, v: 0, state: 'away', t: 0, s: 0, wheelSpin: 0, roll: 0, pitch: 0, sway: 0, lat: 0, vel: new THREE.Vector3(), lastPos: new THREE.Vector3() };
    J.randomHullPoint = () => J.root.localToWorld(V3(range(-1, 1), range(0.7, 1.2), range(-2.5, 2.4)));
  }
  jeepArrive() {
    const J = this.jeep, g = this.g;
    J.state = 'arrive'; J.t = 0; J.root.visible = true;
    // comes up taxiway A from the west at speed, handbrake-turns, stops at the apron edge facing -z
    J.arrive = new Path([[114, -70], [114, 40], [115, 108], [118, 128], [124, 138], [JEEP_STOP.x, JEEP_STOP.z]]);
    J.s = 0; J.v = 26;
    g.audio.play('tire_screech', { x: 114, y: 1, z: 90, volume: 0.6 });
  }
  boardable() { return this.jeep.state === 'wait'; }
  board() {
    const J = this.jeep, g = this.g;
    if (J.state !== 'wait') return;
    J.state = 'board'; J.t = 0;
    this.riding = true; this.ride = { state: 'board', t: 0 };
    g.loco.enabled = false;
    g.carrier = this;
    this.boardFrom = g.rig.position.clone();
    if (g.player.mode === 'vr') g.hud.black.material.opacity = 1; // VR: blink into the bed
    else { g.player.camDip = 0.6; g.player.camDipRate = 1.6; }
    g.audio.play('metal_crash', { volume: 0.35, pitch: 1.6 });
    // the taxiway bound opens for the jeep
    g.col.remove(this.w.boundTaxi);
  }
  get vel() { return this.ride.state === 'onPlane' ? this.cargo.vel : this.jeep.vel; }
  _bedPoint(out) { return this.jeep.root.localToWorld(out.set(0, JEEP.bedY, 1.45)); }
  _casingFloor(x, z) {
    if (this.ride.state === 'onPlane') return this.cargo.root.position.y + CARGO.floorY - 0.2;
    if (!this.riding) return 0;
    const L = this.jeep.root.worldToLocal(_v.set(x, 0, z));
    return Math.abs(L.x) < 0.95 && L.z > 0.3 && L.z < 2.4 ? this.jeep.pos.y + JEEP.bedY : 0;
  }
  // ride plan: taxiway -> high-speed exit -> runway centreline, then straight down runway 27
  _ridePath() { return new Path([[JEEP_STOP.x, JEEP_STOP.z], [119, 110], [114, 40], [113, -90], [100, -170], [60, -250], [14, -320], [2, -380], [0, -460], [0, -3000]]); }
  _updJeep(dt) {
    const J = this.jeep, g = this.g;
    J.t += dt;
    J.lastPos.copy(J.pos);
    if (J.state === 'arrive') {
      const P = J.arrive;
      const remain = P.L - J.s;
      J.v = remain > 40 ? 26 : Math.max(2, remain * 0.9);
      J.s += J.v * dt;
      P.at(J.s, J.pos); const d = P.dir(J.s, _v);
      let want = Math.atan2(-d.x, -d.z);
      // handbrake slide: the body over-rotates on the last curve
      if (remain < 28) { want = 0; J.slide = (J.slide || 0) + dt; }
      J.yaw = this._lerpAng(J.yaw, want, remain < 28 ? 5 : 6, dt);
      if (remain < 32 && remain > 6) for (const sx of [-0.98, 0.98]) if (rand() < 0.6) { const w = J.root.localToWorld(_v.set(sx, 0.2, 1.45)); g.fx.main.spawn({ x: w.x, y: 0.3, z: w.z, vx: range(-1, 1), vy: range(0.5, 1.5), vz: range(-1, 1), drag: 1.5, frame: CELL.DUST, s0: 0.8, s1: 3.4, life: 1.6, rot: rand() * 6, r: 0.8, g: 0.78, b: 0.76, a: 0.5, fadeOut: 0.5 }); }
      if (remain < 30 && !J.screech) { J.screech = true; g.audio.play('tire_screech', { x: J.pos.x, y: 1, z: J.pos.z, volume: 1 }); }
      if (remain < 0.4) { J.state = 'wait'; J.t = 0; J.v = 0; g.events.push({ type: 'jeepHere' }); }
      if (J.state === 'wait') J.yaw = this._lerpAng(J.yaw, 0, 8, dt);
    } else if (J.state === 'wait') {
      J.v = 0; J.yaw = this._lerpAng(J.yaw, 0, 8, dt);
    } else if (J.state === 'board') {
      if (J.t > 0.45) { J.state = 'ride'; J.t = 0; J.path = this._ridePath(); J.s = 0; this.ride = { state: 'chase', t: 0, phase: 0 }; g.hud.black.material.opacity = Math.max(g.hud.black.material.opacity, 0); g.events.push({ type: 'rideStart' }); }
    } else if (J.state === 'ride' || J.state === 'leap') {
      // speed: chase the plane — close the gap on a schedule (the driver handles the road)
      const c = this.cargo, R = this.ride;
      R.t += dt;
      const gap = this.gap = (J.pos.z - (c.root.localToWorld(_v.set(0, 0, CARGO.hinge.z + CARGO.rampLen)).z));
      const want = this.wantGap(R.t);
      const vWant = c.v + clamp((gap - want) * 0.35, -12, 26);
      const a = vWant > J.v ? (J.v < 20 ? 7 : 5) : -9;
      J.v = clamp(J.v + clamp(vWant - J.v, -9 * dt, a * dt), 0, 78);
      J.s += J.v * dt;
      J.path.at(J.s, J.pos);
      // weave behind the plane on the runway (dodges, swerves set by the director)
      const onRunway = J.pos.z < -420;
      const swerve = (this.swerveT > 0 ? Math.sin(this.swerveT * 3.2) * this.swerveA : 0);
      this.swerveT = Math.max(0, (this.swerveT || 0) - dt);
      J.lat = damp(J.lat || 0, onRunway ? (this.laneX ?? 0) + swerve : 0, 2.2, dt);
      J.pos.x += J.lat;
      const d = J.path.dir(J.s, _v);
      J.yaw = this._lerpAng(J.yaw, Math.atan2(-d.x, -d.z) - (J.lat - (J.prevLat ?? J.lat)) / Math.max(1, J.v * dt) * 0.5, 6, dt);
      J.prevLat = J.lat;
      // tire smoke on the launch
      if (R.t < 2.5) for (const sx of [-0.98, 0.98]) if (rand() < 0.8) { const w = J.root.localToWorld(_v.set(sx, 0.25, 1.6)); g.fx.main.spawn({ x: w.x, y: 0.35, z: w.z, vx: range(-1, 1), vy: range(0.5, 2), vz: range(-1, 1), drag: 1.2, frame: CELL.DUST, s0: 0.9, s1: 3.8, life: 1.8, rot: rand() * 6, r: 0.82, g: 0.8, b: 0.78, a: 0.55, fadeOut: 0.5 }); }
    } else if (J.state === 'crash') {
      const rb = J.rb;
      rb.floorY = 0; rb.step(dt, 0);
      J.root.position.copy(rb.pos).sub(_v.set(0, 0.9, 0).applyQuaternion(rb.quat)); J.root.quaternion.copy(rb.quat);
      if (rb.contactSpeed > 4 && (J.lastHit ?? -9) < g.time - 0.3) { J.lastHit = g.time; g.audio.play('metal_crash', { x: rb.pos.x, y: 1, z: rb.pos.z, volume: 0.9 }); }
      if (!J.boomed && J.t > 0.06) { // right under the ramp, while it is still big in frame
        // the jeep goes up BIG: layered fireballs that travel with the tumbling wreck, a fuel-tank pop, a dark mushroom
        J.boomed = true; const P0 = rb.pos.clone().setY(1.2), cv = rb.vel.clone().multiplyScalar(0.7);
        g.boom(P0, 1.8, { radius: 8, dmg: 0, player: false });
        g.fx.explosion(P0.clone().setY(2.2), 1.8, { carVel: cv, noRing: true });
        g.fx.later(0.18, () => g.fx.explosion(rb.pos.clone().setY(2.8), 1.6, { carVel: rb.vel.clone().multiplyScalar(0.6), noRing: true }));
        g.fx.later(0.45, () => { g.fx.explosion(rb.pos.clone().setY(3.5), 1.3, { carVel: rb.vel.clone().multiplyScalar(0.5), noRing: true }); for (let i = 0; i < 10; i++) g.fx.smoke(_v.copy(rb.pos).add(V3(range(-2, 2), range(2, 5), range(-2, 2))), 3.2, 0.06, 7, range(5, 8), 0.85); });
        rb.vel.y += 9; rb.ang.multiplyScalar(1.3);
        J.mesh.material = J.mesh.material.map((m) => g.scorch(m)); J.sign.visible = false;
        g.smokeCols.push({ p: rb.pos.clone().setY(0.5), k: 1.5, life: 200, fire: 1.6, follow: rb });
      }
      if (J.boomed) g.fx.trailEmit(J, rb.pos, 0.7, (q) => { g.fx.flame(q, 1.1, _fv.copy(rb.vel).multiplyScalar(0.9)); if (rand() < 0.5) g.fx.smoke(q, 1.3, 0.1, 3, 2, 0.7); }, 0);
      return this._jeepVisuals(dt, true);
    }
    // velocity / pose
    J.vel.subVectors(J.pos, J.lastPos).divideScalar(Math.max(1e-4, dt));
    this._jeepVisuals(dt, false);
  }
  _jeepVisuals(dt, crashed) {
    const J = this.jeep, g = this.g;
    if (!crashed) {
      const accel = (J.v - (J.prevV ?? J.v)) / Math.max(1e-4, dt); J.prevV = J.v;
      J.pitch = damp(J.pitch, clamp(-accel * 0.004, -0.05, 0.05), 6, dt);
      J.roll = damp(J.roll, clamp((J.lat - (J.prevLat2 ?? J.lat)) / Math.max(1e-4, dt) * -0.02, -0.06, 0.06), 5, dt); J.prevLat2 = J.lat;
      const bump = J.v > 3 ? Math.sin(g.time * 23) * 0.004 + Math.sin(g.time * 37.7) * 0.003 : 0;
      J.root.position.copy(J.pos); J.root.position.y = bump;
      J.root.rotation.set(J.pitch + bump * 0.5, J.yaw, J.roll, 'YXZ');
    }
    if (J.driver.visible) {
      const st = J.buddySt, dl = (J.lat - (J.prevLat3 ?? J.lat)) / Math.max(1e-4, dt); J.prevLat3 = J.lat;
      st.steer = clamp(dl * 0.5 + (J.yawRate || 0) * 0.6, -1, 1);
      st.bump = J.v > 3 ? clamp(Math.abs(J.pitch) * 12, 0, 1) : 0;
      st.talking = g.hud.subT > 0.25 && g.hud.subSpeaker === 'DRIVER';
      const head = J.root.localToWorld(_v.set(-0.45, 1.8, -0.1));
      st.lookBack = 0;
      st.flinch = g.lastBoomP ? clamp(1 - (g.time - g.lastExplosionT) / 0.8, 0, 1) * clamp(1 - g.lastBoomP.distanceTo(head) / 30, 0, 1) : 0;
      st.time = g.time;
      J.buddy.update(dt, st);
    }
    J.signFold = damp(J.signFold, this.riding ? 1 : 0, 3, dt);
    J.sign.rotation.x = -J.signFold * Math.PI / 2; // the driver folds it down when you climb in...
    J.sign.visible = J.signFold < 0.7;             // ...and it's gone (out of your sightline)
    J.root.updateMatrixWorld(true);
    // amber beacons + headlights
    if (J.state !== 'away' && !(crashed && J.boomed)) {
      const on = Math.sin(g.time * 9) > 0;
      const bl = J.sign.localToWorld(_v.set(-0.6, 0.5, 0)), br = J.sign.localToWorld(_v2.set(0.6, 0.5, 0));
      // (folded sign = beacons sit a metre from your face; headlights point away from you once you ride)
      if (J.sign.visible) this.w.addGlow(on ? bl : br, 0.7, 2.6, 1.3, 0.2, 0.9);
      if (!this.riding) {
        this.w.addGlow(J.root.localToWorld(_v.copy(J.b.anchors.headL)), 1.4, 2.6, 2.5, 2.2, 0.9);
        this.w.addGlow(J.root.localToWorld(_v.copy(J.b.anchors.headR)), 1.4, 2.6, 2.5, 2.2, 0.9);
      }
    }
    // engine audio
    if (J.state === 'arrive') g.audio.setLoop('suv:jeep', { x: J.pos.x, y: 1, z: J.pos.z, volume: 0.9, intensity: 0.9 });
  }
  _lerpAng(a, b, k, dt) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * (1 - Math.exp(-k * dt)); }
  // testing helper (?beat=chase1..): put the plane / jeep where they would be `lead` seconds into the ride
  fastForward(lead) {
    const c = this.cargo, J = this.jeep;
    this.startTakeoff();
    // integrate the plane's roll from the moment the jets went up (~12 s before the ride starts)
    const T = 12 + lead; let v = 0, z = CARGO_HOLD.z;
    for (let t = 0; t < T; t += 1 / 30) { v += (v < 20 ? 1.5 : v < 45 ? 1.35 : 1.15) / 30; z -= v / 30; }
    c.v = v; c.z = z; c.state = 'roll';
    this._updCargo(0);
    J.root.visible = true; J.state = 'wait'; J.pos.set(JEEP_STOP.x, 0, JEEP_STOP.z); J.yaw = 0;
    this.board(); J.t = 1; this._updJeep(1 / 30);
    if (lead > 0) {
      const lip = c.root.localToWorld(_v.set(0, 0, CARGO.hinge.z + CARGO.rampLen)).z;
      J.s = this.sForZ(J.path, lip + this.wantGap(lead)); J.v = c.v; this.ride.t = lead;
      J.path.at(J.s, J.pos);
    }
  }
  sForZ(path, z) { let best = 0, bd = 1e9; for (let s = 0; s < path.L; s += 2) { const d = Math.abs(path.at(s, _v2).z - z); if (d < bd) { bd = d; best = s; } } return best; }
  // choreography: how far behind the ramp lip the jeep should be at ride time t
  wantGap(t) {
    if (this.leapT !== undefined) return -2;
    if (this.allowRotate) return 4;
    const k = [[0, 210], [10, 180], [22, 115], [32, 60], [40, 30], [48, 18]];
    for (let i = 0; i < k.length - 1; i++) if (t < k[i + 1][0]) return lerp(k[i][1], k[i + 1][1], smooth((t - k[i][0]) / (k[i + 1][0] - k[i][0])));
    return 6;
  }

  // ================================================================== chasing SUVs
  spawnCar(o) {
    const g = this.g, model = buildSUV();
    g.scene.add(model.root);
    const car = { model, root: model.root, pos: model.root.position, hp: 24, alive: true, yaw: Math.PI, vel: new THREE.Vector3(), side: o.side, dz: o.dz, gunmen: [], ramT: range(6, 10), t: 0, sway: 0 };
    const J = this.jeep;
    car.pos.set(J.pos.x + o.side * 6, 0, J.pos.z + (o.from ?? 60));
    car.v = J.v + 8;
    for (const slot of o.slots || ['L', 'roof']) {
      const L = { L: [-0.98, 1.0, 0.95], R: [0.98, 1.0, 0.95], roof: [0, 1.45, 0.2], FL: [-0.98, 1.0, -0.2], FR: [0.98, 1.0, -0.2] }[slot];
      const gm = new Gunman({ pose: slot === 'roof' ? 'roof' : 'window', side: slot === 'roof' ? 0 : (slot.endsWith('L') ? -1 : 1), seed: (this.cars.length * 31 + car.gunmen.length * 7 + 5) * 7919 });
      gm.root.position.set(L[0], L[1], L[2]); car.root.add(gm.root);
      car.gunmen.push({ gm, alive: true, hp: 2, cool: range(1.2, 2.5), burst: 0 });
    }
    car.half = model.half.clone(); car.center = V3(0, model.half.y, model.centerOffsetZ || 0);
    this.cars.push(car);
    g.targets.push({
      name: 'car', ref: car, active: () => car.alive,
      ray: (o2, d) => this._carRay(car, o2, d),
      hit: (P, dir) => this._carHit(car, P, dir),
      aim: () => { const gg = car.gunmen.find(x => x.alive); return gg ? gg.gm.chestCenter.getWorldPosition(new THREE.Vector3()) : car.root.localToWorld(car.center.clone()); },
      near: (p) => car.alive && car.root.worldToLocal(_v.copy(p)).sub(car.center).length() < 3.2,
      blast: () => this._carDamage(car, 30, null),
      dead: () => !car.alive,
      auto: (head) => {
        if (!car.alive) return null;
        const gg = car.gunmen.find(x => x.alive);
        const p = gg ? gg.gm.chestCenter.getWorldPosition(new THREE.Vector3()) : car.root.localToWorld(car.center.clone());
        const d = p.distanceTo(head); if (d > 70) return null;
        return { kind: 'target', p, score: 100 - d * 0.5, ref: g.targets.find(t => t.ref === car), heavy: !gg || d > 18, minNade: 9, tol: 0.035 };
      },
    });
    return car;
  }
  _carRay(car, o, d) {
    let best = -1; car._hit = null;
    for (const gg of car.gunmen) {
      if (!gg.alive) continue;
      for (const [obj, r, kind] of [[gg.gm.headCenter, 0.18, 'head'], [gg.gm.chestCenter, 0.3, 'body']]) { const t = raySphere(o, d, obj.getWorldPosition(_v), r); if (t > 0 && (best < 0 || t < best)) { best = t; car._hit = { gg, kind }; } }
    }
    car.root.updateMatrixWorld(true);
    const c = car.center, h = car.half;
    const t = rayOBB(o, d, car.root.matrixWorld, [c.x - h.x, c.y - h.y, c.z - h.z], [c.x + h.x, c.y + h.y, c.z + h.z]);
    if (t > 0 && (best < 0 || t < best - 0.05)) { best = t; car._hit = { body: true }; }
    return best;
  }
  _carHit(car, P, dir) {
    const g = this.g, h = car._hit; if (!h) return;
    if (h.body) { g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.7 }); this._carDamage(car, 1, P); return; }
    g.fx.impact(P, _v.copy(dir).negate(), 'body'); g.audio.play('impact_flesh', { x: P.x, y: P.y, z: P.z }); g.hitMarker(h.kind === 'head');
    h.gg.hp -= h.kind === 'head' ? 99 : 1;
    if (h.gg.hp <= 0) this._killGunner(car, h.gg, dir, h.kind === 'head'); else h.gg.gm.hit(dir);
  }
  _killGunner(car, gg, dir, head) {
    const g = this.g; if (!gg.alive) return;
    gg.alive = false; g.kills++; if (head) g.headshots++;
    g.audio.play('kill_confirm', {});
    const P = gg.gm.chestCenter.getWorldPosition(new THREE.Vector3());
    g.addScore(head ? 150 : 100, head ? 'HEADSHOT' : null, P.clone().setY(P.y + 1.2), 'small');
    g.addCorpse(gg.gm, car.vel.clone(), dir, 1.3);
  }
  _carDamage(car, n, P) {
    if (!car.alive) return;
    car.hp -= n;
    if (car.hp <= 8 && !car.smoking) car.smoking = true;
    if (car.hp <= 0) this._carExplode(car);
  }
  _carExplode(car) {
    const g = this.g; car.alive = false; g.carsDown++;
    car.root.updateMatrixWorld(true);
    const P = car.root.localToWorld(car.center.clone());
    g.boom(P, 1.5, { radius: 7, dmg: 30 });
    for (const gg of car.gunmen) if (gg.alive) { gg.alive = false; g.kills++; g.addCorpse(gg.gm, car.vel.clone().add(V3(range(-3, 3), 6, 0)), V3(range(-1, 1), 1, 0).normalize(), 2.5); }
    g.addScore(600, pick(['TOTALED!', 'NO INSURANCE!', 'WRITE-OFF!']), P.clone().setY(P.y + 3), 'big');
    // flip down the runway
    const rb = new RigidBox(car.half.x, car.half.y, car.half.z, 2);
    rb.pos.copy(P); rb.quat.copy(car.root.quaternion);
    rb.vel.copy(car.vel).add(V3(range(-3, 3), range(7, 10), 0)); rb.ang.set(range(-2, 2), range(-1.5, 1.5), (car.side || 1) * range(5, 8)); rb.restitution = 0.25; rb.linDamp = 0.12;
    car.rb = rb; car.burnT = 0;
    car.model.mesh.material = car.model.mesh.material.map((m) => g.scorch(m));
    g.audio.play('metal_crash', { x: P.x, y: P.y, z: P.z, volume: 1 });
    g.events.push({ type: 'carBoom', car });
  }
  _updCars(dt) {
    const g = this.g, J = this.jeep;
    for (const car of this.cars) {
      car.t += dt;
      if (car.alive) {
        // hold a slot beside / behind the jeep, weave, occasionally lunge to ram
        car.ramT -= dt;
        const ram = car.ramT < 0 && car.ramT > -1.6;
        if (car.ramT < -3) car.ramT = range(7, 11);
        const tx = J.pos.x + car.side * (ram ? 2.4 : 5.6 + Math.sin(car.t * 0.7) * 0.8), tz = J.pos.z + car.dz + Math.sin(car.t * 0.5) * 2;
        const vz = J.vel.z + clamp((tz - car.pos.z) * 0.9, -10, 10);
        car.vel.z = damp(car.vel.z, vz, 2.2, dt);
        car.vel.x = damp(car.vel.x, clamp((tx - car.pos.x) * 1.4, -6, 6), 3, dt);
        car.pos.addScaledVector(car.vel, dt);
        // no driving through the jeep
        const dx = car.pos.x - J.pos.x, dz = car.pos.z - J.pos.z;
        if (Math.abs(dz) < 4.8 && Math.abs(dx) < 2.3) {
          car.pos.x = J.pos.x + Math.sign(dx || car.side) * 2.3;
          if (!car.hitJeep || car.t - car.hitJeep > 1) { car.hitJeep = car.t; g.audio.play('metal_crash', { x: J.pos.x, y: 1, z: J.pos.z, volume: 0.9 }); g.player.shake = Math.min(1.5, g.player.shake + 0.8); g.haptic(1, 120); this.swerveT = 0.6; this.swerveA = -Math.sign(dx || car.side) * 1.2; for (let k = 0; k < 14; k++) g.fx.sparks.spawn({ x: (car.pos.x + J.pos.x) / 2, y: 0.8, z: J.pos.z + range(-1, 1), vx: J.vel.x + range(-4, 4), vy: range(1, 5), vz: J.vel.z + range(-6, 6), grav: -12, frame: CELL.SPARK, s0: 1, w: 0.05, life: range(0.2, 0.5), r: 1.8, g: 1.1, b: 0.5, a: 1, fadeOut: 0.5 }); if (chance(0.6)) g.hud.subtitle('DRIVER', pick(['He\'s RAMMING us!', 'Not the paint job!', 'Back off, pal!']), 1.8); }
        }
        car.yaw = Math.PI + clamp(-car.vel.x / Math.max(5, -car.vel.z) * 0.9, -0.35, 0.35);
        car.root.position.y = 0;
        car.root.rotation.set(0, car.yaw, clamp(-car.vel.x * 0.01, -0.05, 0.05));
        car.root.updateMatrixWorld(true);
        if (car.smoking) g.fx.trailEmit(car, car.root.localToWorld(_v.set(0, 1.0, -2.2)), 0.35, (q) => g.fx.smoke(q, 1.0 * range(0.6, 1.4), 0.12, 2 * range(0.7, 1.3), 1, 0.6), 0);
        // gunners
        for (const gg of car.gunmen) {
          if (!gg.alive) continue;
          gg.gm.update(dt, g.headPos);
          gg.cool -= dt;
          const dist = gg.gm.chestCenter.getWorldPosition(_v).distanceTo(g.headPos);
          if (gg.cool <= 0 && gg.gm.canFire && dist < 60) {
            if (gg.burst <= 0) gg.burst = 3 + Math.floor(rand() * 4);
            gg.burst--; gg.cool = gg.burst > 0 ? 0.11 : range(1.2, 2.4) * (g.trailer ? 1.3 : 1);
            gg.gm.fire(); g.enemyShot({ gm: gg.gm, role: 'car' }, dist);
          }
        }
        g.audio.setLoop('suv:' + this.cars.indexOf(car), { x: car.pos.x, y: 1, z: car.pos.z, volume: 0.8, intensity: 0.9 });
        for (const w of car.model.wheels || []) w.rotation.x -= car.vel.length() * dt / 0.43;
      } else if (car.rb) {
        const rb = car.rb;
        rb.floorY = 0; rb.step(dt, 0);
        car.root.position.copy(rb.pos).sub(_v.copy(car.center).applyQuaternion(rb.quat)); car.root.quaternion.copy(rb.quat);
        if (rb.contactSpeed > 4 && (car.lastHit ?? -9) < g.time - 0.3) { car.lastHit = g.time; g.audio.play('metal_crash', { x: rb.pos.x, y: 1, z: rb.pos.z, volume: 0.8 }); }
        if (rb.scrape > 6) for (let k = 0; k < 4; k++) g.fx.sparks.spawn({ x: rb.contactPoint.x, y: 0.1, z: rb.contactPoint.z, vx: rb.vel.x * 0.5 + range(-3, 3), vy: range(2, 5), vz: rb.vel.z * 0.5 + range(-3, 3), grav: -12, frame: CELL.SPARK, s0: 1, w: 0.05, life: range(0.3, 0.6), r: 1.8, g: 1.0, b: 0.4, a: 1, fadeOut: 0.5 });
        car.burnT += dt;
        if (car.burnT < 30 && g.headPos.distanceTo(rb.pos) < 300) g.fx.trailEmit(car, rb.pos, 0.8, (q) => { g.fx.flame(q, 1.0, _fv.copy(rb.vel).multiplyScalar(0.9)); if (rand() < 0.4) g.fx.smoke(q, 1.2, 0.1, 3, 2, 0.7); }, 0); // flames ride the wreck (no string of pearls), smoke stays behind
        if (rb.onGround && rb.vel.lengthSq() < 0.2) car.rb = null;
      }
    }
  }

  // ================================================================== pallets kicked out of the ramp
  dropPallet(kind = 'drums') {
    const g = this.g, c = this.cargo;
    const root = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 2.2), MAT.underbody); base.position.y = 0.075; root.add(base);
    const drums = [];
    if (kind === 'drums') for (let k = 0; k < 4; k++) { const d = new THREE.Mesh(g.drumGeo, g.drumMat); d.position.set((k % 2 - 0.5) * 0.65, 0.15, (Math.floor(k / 2) - 0.5) * 0.65); d.castShadow = true; root.add(d); drums.push(d); }
    else { const cr = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 1.9), new THREE.MeshStandardMaterial({ color: 0x4d5a36, roughness: 0.85 })); cr.position.y = 0.9; cr.castShadow = true; root.add(cr); }
    g.scene.add(root);
    // start on the hold floor near the hinge, slide out over the ramp
    const start = c.root.localToWorld(V3(range(-1, 1), CARGO.floorY + 0.1, CARGO.hinge.z - 1.5));
    const rb = new RigidBox(1.1, 0.7, 1.1, 2); rb.pos.copy(start); rb.quat.copy(c.root.quaternion);
    rb.vel.copy(c.vel).add(V3(range(-1, 1), 1.0, 9)); rb.ang.set(range(1, 3), range(-1, 1), range(-1, 1)); rb.restitution = 0.3;
    const P = { root, rb, drums, kind, t: 0, hp: kind === 'drums' ? 2 : 5, alive: true };
    this.pallets.push(P);
    g.audio.play('metal_crash', { x: start.x, y: start.y, z: start.z, volume: 0.8, pitch: 0.7 });
    g.targets.push({
      name: 'pallet', ref: P, active: () => P.alive,
      ray: (o, d) => raySphere(o, d, P.rb.pos, 1.3),
      hit: (Pt, dir) => { g.fx.impact(Pt, _v.copy(dir).negate(), 'metal'); g.audio.play('barrel_hit', { x: Pt.x, y: Pt.y, z: Pt.z }); g.hitMarker(false); if (--P.hp <= 0) this._palletBoom(P); },
      aim: () => P.rb.pos.clone(), near: (p) => P.alive && p.distanceTo(P.rb.pos) < 1.8, blast: () => this._palletBoom(P), dead: () => !P.alive,
      auto: (head) => P.alive && P.t > 0.3 && P.rb.pos.distanceTo(head) < 60 && P.rb.pos.distanceTo(head) > 12 ? { kind: 'target', p: P.rb.pos.clone(), score: 160, ref: g.targets.find(t => t.ref === P), tol: 0.06 } : null,
    });
    return P;
  }
  _palletBoom(P) {
    if (!P.alive) return;
    const g = this.g; P.alive = false;
    g.scene.remove(P.root);
    g.boom(P.rb.pos.clone().setY(Math.max(0.6, P.rb.pos.y)), P.kind === 'drums' ? 1.7 : 1.0, { radius: 7, dmg: 35 });
    if (P.kind === 'drums') g.addScore(300, pick(['SPECIAL DELIVERY!', 'RETURN TO SENDER!']), P.rb.pos.clone().setY(4), 'big');
  }
  _updPallets(dt) {
    const g = this.g;
    for (const P of this.pallets) {
      if (!P.alive) continue;
      P.t += dt;
      const rb = P.rb;
      // while on the ramp: the ramp is the floor
      const L = this.cargo.root.worldToLocal(_v.copy(rb.pos));
      if (Math.abs(L.x) < 2.6 && L.z < CARGO.hinge.z + CARGO.rampLen && L.z > CARGO.hinge.z - 3) {
        const along = clamp(L.z - CARGO.hinge.z, 0, CARGO.rampLen);
        rb.floorY = this.cargo.root.localToWorld(_v2.set(L.x, CARGO.floorY - Math.sin(this.rampA) * along, L.z)).y;
      } else rb.floorY = 0;
      rb.step(dt, 0);
      P.root.position.copy(rb.pos).sub(_v.set(0, 0.7, 0).applyQuaternion(rb.quat)); P.root.quaternion.copy(rb.quat);
      if (rb.contactSpeed > 6 && rb.pos.y < 2 && (P.lastHit ?? -9) < g.time - 0.3) { P.lastHit = g.time; g.audio.play('metal_crash', { x: rb.pos.x, y: 1, z: rb.pos.z, volume: 0.9 }); for (let k = 0; k < 10; k++) g.fx.sparks.spawn({ x: rb.pos.x, y: 0.1, z: rb.pos.z, vx: rb.vel.x + range(-4, 4), vy: range(1, 5), vz: rb.vel.z * 0.4 + range(-4, 4), grav: -12, frame: CELL.SPARK, s0: 1, w: 0.06, life: range(0.3, 0.7), r: 1.8, g: 1.0, b: 0.4, a: 1, fadeOut: 0.5 }); }
      // drum pallets go off when they get close to the jeep (the driver swerves)
      if (P.kind === 'drums' && P.t > 1.0 && this.riding && rb.pos.distanceTo(this.jeep.pos) < 13) this._palletBoom(P);
      if (P.t > 12) { P.alive = false; g.scene.remove(P.root); }
    }
  }

  // ================================================================== the leap + the ride on the ramp
  beginLeap() {
    const g = this.g;
    if (this.leapT !== undefined) return;
    this.leapT = 0;
    this.ride.state = 'leap';
    this.leapFrom = g.rig.position.clone();
    g.slowmo(3.2, 0.22, true);
    g.invuln = true;
    g.audio.play('slowmo_in', {});
    g.events.push({ type: 'leap' });
  }
  _rampLandLocal(out) { return out.set(0.2, CARGO.floorY, CARGO.hinge.z - 1.2); }
  _updRide(dt, rdt) {
    const g = this.g, J = this.jeep, rig = g.rig;
    if (!this.riding) return;
    const R = this.ride;
    if (R.state === 'board') {
      // desktop / capture: hop into the bed over half a second
      const k = smooth(clamp(J.t / 0.45, 0, 1));
      this._bedPoint(_v); rig.position.lerpVectors(this.boardFrom, _v, k); rig.position.y = _v.y * k + Math.sin(k * Math.PI) * 0.5;
    } else if (R.state === 'chase') {
      this._bedPoint(rig.position);
      if (g.hud.black.material.opacity > 0) g.hud.black.material.opacity = Math.max(0, g.hud.black.material.opacity - rdt * 3);
    } else if (R.state === 'leap') {
      this.leapT += dt;
      const T = 1.05, k = clamp(this.leapT / T, 0, 1);
      const from = this._bedPoint(_v2.clone()), to = this.cargo.root.localToWorld(this._rampLandLocal(_v3.clone()));
      rig.position.lerpVectors(from, to, smooth(k)); rig.position.y += Math.sin(k * Math.PI) * 1.6;
      g.hud.setComfort?.(g.player.mode === 'vr' ? 0.9 : 0);
      if (k >= 1) { R.state = 'onPlane'; R.t = 0; this._landOnRamp(); }
    } else if (R.state === 'onPlane') {
      R.t += dt;
      this.cargo.root.localToWorld(this._rampLandLocal(rig.position));
    }
  }
  _landOnRamp() {
    const g = this.g, J = this.jeep;
    g.audio.play('body_fall', { volume: 1 }); g.audio.play('metal_crash', { volume: 0.7, pitch: 1.3 });
    g.player.shake = 1.2; g.haptic(1, 200);
    if (g.player.mode !== 'vr') { g.player.camDip = 0.5; g.player.camDipRate = 1.2; }
    g.addScore(10000, 'STICK THE LANDING!', this.cargo.root.localToWorld(V3(0, CARGO.floorY + 5.4, 13)), 'huge'); // high in the opening: the jeep crash plays out below it
    g.events.push({ type: 'landed' });
    // the jeep peels off into the grass and flips; the driver bails first (we hear him on the radio)
    J.state = 'crash'; J.t = 0;
    const rb = new RigidBox(1.05, 0.7, 2.6, 2); rb.pos.copy(J.root.localToWorld(V3(0, 0.9, 0))); rb.quat.copy(J.root.quaternion);
    rb.vel.copy(J.vel).multiplyScalar(0.8).add(V3(16, 6, 0)); rb.ang.set(range(-2, 2), range(2, 3), range(-10, -8)); rb.restitution = 0.3; rb.linDamp = 0.1;
    J.rb = rb; J.driver.visible = false;
    g.invuln = false;
  }

  // ================================================================== credits (in the sky behind the ramp)
  rollCredits(lines) {
    const g = this.g, c = this.cargo;
    const grp = new THREE.Group(); c.root.add(grp);
    let y = 0;
    const items = [];
    for (const L of lines) {
      if (!L) { y -= 3.2; continue; }
      const big = L.big, tt = textTexture(L.text, { size: big ? 200 : 110, color: big ? 'chrome' : (L.dim ? 'rgba(255,214,168,0.92)' : '#fff3df'), stroke: big ? 10 : 5, sub: L.sub || null, glow: big ? 'rgba(255,110,10,0.95)' : 'rgba(0,0,0,0.75)', padding: 30 });
      const h = big ? 5.2 : L.sub ? 3.4 : 2.3;
      const mat = new THREE.MeshBasicMaterial({ map: tt.texture, transparent: true, depthWrite: false, toneMapped: false, fog: false, opacity: 0 });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(h * tt.aspect, h), mat);
      pl.rotation.y = 0; pl.position.set(0, y, 0); pl.renderOrder = 170;
      grp.add(pl); items.push(pl);
      y -= h + 1.0;
    }
    grp.position.set(0, CARGO.floorY, 30);
    this.credits = { grp, items, t: 0, span: -y };
  }
  _updCredits(dt) {
    const C = this.credits; if (!C) return;
    C.t += dt;
    const speed = 1.5;
    C.grp.position.y = CARGO.floorY - 6 + C.t * speed;
    // face the player (plane frame: player looks toward +z out of the ramp)
    C.grp.rotation.set(-this.cargo.pitch, Math.PI, 0);
    for (const it of C.items) {
      const wy = C.grp.position.y + it.position.y - CARGO.floorY;
      // visible only in the sky band between the horizon and the hold's ceiling edge (≈ 0..9° above the eye from the ramp)
      it.material.opacity = clamp(1.6 - Math.abs(wy - 3.2) / 1.6, 0, 1);
    }
  }

  // ================================================================== hooks
  update(dt) {
    this._updJets(dt);
    this._updCargo(dt);
    this._updJeep(dt);
    this._updCars(dt);
    this._updPallets(dt);
    this._updCredits(dt);
    if (this.holdNight !== undefined && this.holdNight < 1) {
      this.holdNight = Math.min(1, this.holdNight + dt / 4);
      const m = cargoHoldMaterial(), k = this.holdNight * this.holdNight * (3 - 2 * this.holdNight);
      m.emissive.setRGB(1, 0.82, 0.63).lerp(_red.setRGB(1, 0.1, 0.05), k); m.emissiveIntensity = 1.4 + 2.2 * k;
    }
  }
  // after the player moved (so the rig rides the jeep / the plane this frame)
  afterPlayer(rdt, dt) {
    this._updRide(dt, rdt);
    const g = this.g;
    if (this.riding && this.ride.state === 'chase' && dt > 0) {
      // sense of speed: grit and heat haze on the runway stream past, a little road buzz in the camera
      const J = this.jeep, k = clamp(J.v / 60, 0, 1);
      if (g.player.mode === 'desktop') g.player.shake = Math.max(g.player.shake, 0.04 + 0.1 * k);
    }
    if (this.riding) {
      g.rig.updateMatrixWorld(true);
      g.carrier = this.ride.state === 'onPlane' ? { vel: this.cargo.vel, randomHullPoint: () => null } : this.jeep;
    }
    // keep near-field FX (muzzle flashes) riding with the carrier
    const v = this.riding ? (this.ride.state === 'onPlane' ? this.cargo.vel : this.jeep.vel) : null;
    if (v) this._nearOff.addScaledVector(v, dt); else this._nearOff.set(0, 0, 0);
    this.g.fx.near.mesh.position.copy(this._nearOff);
  }
  _patchNearFx() {
    // muzzle flashes live in the 'near' particle system; while riding, it is offset with the carrier so the
    // flash stays on the muzzle at 60 m/s (spawn positions are converted into the offset frame)
    this._nearOff = new THREE.Vector3();
    const near = this.g.fx.near, spawn = near.spawn.bind(near), off = this._nearOff;
    near.spawn = (o) => { o.x -= off.x; o.y -= off.y; o.z -= off.z; return spawn(o); };
    // casings: inherit the carrier's velocity
    const fx = this.g.fx, cas = fx.casing.bind(fx);
    fx.casing = (pos, vel) => { if (this.riding) vel.add(this.ride.state === 'onPlane' ? this.cargo.vel : this.jeep.vel); return cas(pos, vel); };
  }
  frameAudio(rdt) {
    const fog = this.g.scene.fog, wantNear = this.riding ? 260 : 70;
    fog.near += (wantNear - fog.near) * Math.min(1, rdt * 0.8);
    const g = this.g, c = this.cargo;
    g.audio.setLoop('cargo', { x: c.root.position.x, y: c.root.position.y + 6, z: c.root.position.z, volume: 1, intensity: c.spool });
    if (this.riding && this.ride.state !== 'onPlane') {
      const k = clamp(this.jeep.v / 60, 0, 1);
      g.audio.setLoop('truck', { volume: 0.8, intensity: 0.3 + k * 0.7 });
      g.audio.setLoop('wind', { volume: 0.25 + k * 0.75, intensity: k });
    } else if (this.ride.state === 'onPlane') g.audio.setLoop('wind', { volume: 0.9, intensity: 1 });
    else g.audio.setLoop('wind', { volume: 0.18, intensity: 0.2 });
  }
}
