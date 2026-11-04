import * as THREE from 'three';
import { rand, range, chance, clamp, lerp, damp, pick } from '../../rng.js';
import { CELL, BillboardBatch } from '../../particles.js';
import { buildHeli } from '../../heli.js';
import { MAT } from '../../vehicles.js';
import { Driver } from '../../characters.js';
import { NODES, NODE_H, HA, W, LEGC } from './tower.js';
import { TOWER, LEGS, WATER_Y, LOW_Y, RIVERBOAT, BOAT_DOCK, PONTOON, BRIDGE, groundAt } from './layout.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r, h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}
// where the falling tower comes to rest: water (it sinks in a little), quays, street, bridge deck, the
// roofs of the north frontage (the spire goes through them)
function towerFloor(x, z) {
  const g = groundAt(x, z);
  if (g <= WATER_Y + 0.01) return WATER_Y - 2.5;
  if (z > 78 && z < 110 && Math.abs(x) < 60) return 9;   // the crushed frontage
  return g;
}

// ---- torn girders (one instanced draw): ripped off the lattice, tumbling, sparking, splashing into the Seine
class Girders {
  constructor(g, max = 160) {
    this.g = g; this.max = max;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3b2c22, roughness: 0.55, metalness: 0.6, emissive: new THREE.Color(1, 0.45, 0.15), emissiveIntensity: 0.08 });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    g.scene.add(this.mesh);
    this.list = []; this.cur = 0;
  }
  get material() { return this.mesh.material; }
  spawn(a, b, w, vel, spin = 2) {
    const r = this.list.length < this.max ? (this.list.push({}), this.list[this.list.length - 1]) : this.list[this.cur++ % this.max];
    const d = _v.subVectors(b, a), L = d.length();
    Object.assign(r, {
      p: a.clone().add(b).multiplyScalar(0.5), v: vel.clone(), q: new THREE.Quaternion().setFromUnitVectors(UP, d.divideScalar(L || 1)),
      w: new THREE.Vector3(range(-spin, spin), range(-spin, spin), range(-spin, spin)), s: new THREE.Vector3(w, L, w), rest: false, sink: 0, t: 0, wet: false,
    });
  }
  update(dt) {
    const m = this.mesh, g = this.g;
    let k = 0;
    for (const r of this.list) {
      r.t += dt;
      if (!r.rest) {
        r.v.y -= 9.8 * dt; r.p.addScaledVector(r.v, dt);
        const wl = r.w.length(); if (wl > 1e-3) { _q.setFromAxisAngle(_v.copy(r.w).divideScalar(wl), wl * dt); r.q.premultiply(_q); }
        const gy = groundAt(r.p.x, r.p.z);
        if (gy <= WATER_Y + 0.01 && r.p.y < WATER_Y) {
          if (!r.wet) { r.wet = true; g.setp.splash(r.p.clone().setY(WATER_Y), Math.min(1.4, 0.3 + r.s.y * 0.06)); }
          r.v.multiplyScalar(Math.exp(-dt * 3)); r.w.multiplyScalar(Math.exp(-dt * 2));
          if (r.p.y < WATER_Y - 6) r.rest = true;
        } else if (r.p.y < gy + r.s.x) {
          r.p.y = gy + r.s.x;
          if (r.v.y < -5) {
            r.v.y *= -0.2; r.v.x *= 0.5; r.v.z *= 0.5; r.w.multiplyScalar(0.5);
            if (r.s.y > 3 && g.headPos.distanceToSquared(r.p) < 90 * 90) { g.audio.play('metal_crash', { x: r.p.x, y: r.p.y, z: r.p.z, volume: Math.min(1, r.s.y / 12), pitch: range(0.6, 0.9) }); }
            for (let i = 0; i < 6; i++) g.fx.sparks.spawn({ x: r.p.x, y: r.p.y, z: r.p.z, vx: range(-4, 4), vy: range(1, 5), vz: range(-4, 4), grav: -9.8, drag: 0.6, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.12, life: range(0.5, 1.2), r: 2.6, g: 1.5, b: 0.6, a: 1, fadeOut: 0.5, ground: true });
            g.fx.main.spawn({ x: r.p.x, y: r.p.y + 0.5, z: r.p.z, vy: 1, frame: CELL.DUST, s0: 1.5, s1: 5, life: 1.6, rot: rand() * 6, r: 0.55, g: 0.5, b: 0.46, a: 0.5, fadeOut: 0.4 });
          } else r.rest = true;
        }
      }
      _m.compose(r.p, r.q, r.s); m.setMatrixAt(k++, _m);
    }
    m.count = k; m.instanceMatrix.needsUpdate = true;
    // they glow hot for a few seconds after they tear off
    m.material.emissiveIntensity = 0.08;
  }
}

// =====================================================================================
//  THE IRON LADY set pieces:
//   - the riverboat: a bateau-mouche full of gunmen glides down the Seine past the quay fight
//   - WIDOWMAKER 3: the gunship, threading the tower's legs; it dies in the north-east leg
//   - the fall: the leg buckles, the tower lists, then goes over north across the river onto
//     the bridge (spine solve + per-leg buckling feeding tower.js's vertex rig)
//   - the spray wall rolling down the river after you, the driver's speedboat, the getaway
// =====================================================================================
export class SetPieces {
  constructor(game) {
    this.g = game; this.world = game.world;
    this.T = game.world.tower;
    game.setp = this;
    this.heli = null; this.rockets = [];
    this.boat = null; this.fall = null; this.wall = null; this.escape = null;
    this.girders = new Girders(game);
    this.clouds = game.clouds;
    this.glowB = new BillboardBatch(24, game.E.atlas, { boost: 1, renderOrder: 19, fog: game.scene.fog });
    game.scene.add(this.glowB.mesh);
    const g = game;
    this.heliTarget = {
      active: () => !!this.heli && this.heli.alive && this.heli.phase !== 'dying',
      ray: (o, d) => { const H = this.heli; let best = -1; for (const [pt, r] of H.hit) { pt.getWorldPosition(_v); const t = raySphere(o, d, _v, r); if (t > 0 && (best < 0 || t < best)) best = t; } return best; },
      hit: (P, dir) => { g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.8, pitch: 0.75 }); this.damageHeli(0.35, P); g.hitMarker(false); },
      near: (p) => this.heli.pos.distanceTo(p) < 4.2,
      direct: (p) => { this.damageHeli(20, p); g.hitMarker(true); },
      blast: (P, r, dmg) => { const d = this.heli.pos.distanceTo(P); if (d < r + 4) this.damageHeli(dmg * 0.12 * (1 - d / (r + 4)) + 2, P); },
      aim: () => this.heli.pos,
      auto: (head, A) => {
        const H = this.heli; if (H.phase === 'enter' && H.t < 3.0) return null;
        const d = H.pos.distanceTo(head); if (d > 110) return null;
        if (!g.col.visible(head, H.pos, b => b.data.noBullet)) return null;
        return { kind: 'target', p: H.pos.clone(), score: 72 + (A.target?.ref === this.heliTarget ? 25 : 0) + (H.hp < H.maxHp * 0.35 ? 30 : 0), ref: this.heliTarget, heavy: true, minNade: 12, tol: 0.07 };
      },
    };
    this.boatTarget = {
      active: () => !!this.boat && this.boat.state === 'cruise',
      ray: (o, d) => { const B = this.boat; const f = B.fuelW; const t = raySphere(o, d, f, 1.4); return t; },
      hit: (P, dir) => { g.fx.impact(P, _v.copy(dir).negate(), 'metal'); g.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.8 }); this.damageBoat(1, P); g.hitMarker(false); },
      near: (p) => this.boat.fuelW.distanceTo(p) < 3.5,
      direct: (p) => { this.damageBoat(14, p); g.hitMarker(true); },
      blast: (P, r) => { const d = this.boat.fuelW.distanceTo(P); if (d < r + 3) this.damageBoat(8 * (1 - d / (r + 3)) + 2, P); },
      aim: () => this.boat.fuelW,
      auto: (head, A) => {
        const B = this.boat, d = B.fuelW.distanceTo(head);
        if (d > 80 || g.enemiesAlive(s => s.role === 'deck') > 2) return null;
        return { kind: 'target', p: B.fuelW.clone(), score: 70 + (A.target?.ref === this.boatTarget ? 25 : 0), ref: this.boatTarget, heavy: true, minNade: 10, tol: 0.04 };
      },
    };
    game.targets.push(this.heliTarget, this.boatTarget);
  }

  warmMaterials() { return [this.girders.material]; }

  update(dt) {
    this._updBoat(dt);
    this._updHeli(dt);
    this._updRockets(dt);
    this._updTail(dt);
    this._updFall(dt);
    this._updWall(dt);
    this._updEscape(dt);
    this._updFires(dt);
    this.girders.update(dt);
  }

  // ---------------------------------------------------------------- water
  splash(P, k = 1) {
    const g = this.g;
    g.fx.main.spawn({ x: P.x, y: WATER_Y + 0.2, z: P.z, frame: CELL.RING, s0: 1.5 * k, s1: 9 * k, life: 1.2, r: 0.8, g: 0.85, b: 0.9, a: 0.5, fadeOut: 0.6, rot: rand() * 6 });
    for (let i = 0; i < 6 + k * 6; i++) g.fx.main.spawn({ x: P.x + range(-1, 1) * k, y: WATER_Y + 0.3, z: P.z + range(-1, 1) * k, vx: range(-2.5, 2.5) * k, vy: range(5, 12) * k, vz: range(-2.5, 2.5) * k, grav: 9.8, drag: 0.6, frame: CELL.WISP, s0: 0.8 * k, s1: range(3, 5) * k, life: range(1.2, 2), rot: rand() * 6, r: 0.72, g: 0.76, b: 0.8, a: 0.55, fadeIn: 0.02, fadeOut: 0.6 });
    if (k > 0.8 && g.headPos.distanceToSquared(P) < 140 * 140) g.audio.play('body_fall', { x: P.x, y: P.y, z: P.z, volume: Math.min(1, k * 0.6), pitch: 0.5 });
  }

  // ================================================================== RIVERBOAT
  spawnRiverboat(x0) {
    const g = this.g, mod = this.world.mods.boatsM;
    let m = null;
    try { m = mod?.buildBoat?.('bateau', { seed: 5 }); } catch (e) { console.warn('bateau', e); }
    if (!m) { // stand-in
      const root = new THREE.Group(), hull = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 40), new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6 })); hull.position.y = 1; root.add(hull);
      m = { root, half: [4, 2, 20], anchors: { deck: [[-2, 2.6, 8], [2, 2.6, 10], [-2, 2.6, 13], [2, 2.6, 15], [0, 2.6, 17], [-1, 2.6, 6]].map(a => ({ x: a[0], y: a[1], z: a[2] })), fuel: [0, 1.2, 18], glows: [] }, setBurnt() { hull.material = MAT.charred; } };
    }
    m.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const B = this.boat = { m, root: m.root, x: x0, z: RIVERBOAT.z, v: RIVERBOAT.speed, yaw: Math.PI / 2, state: 'cruise', hp: g.trailer ? 16 : 22, t: 0, roll: 0, sink: 0, vel: new THREE.Vector3(-RIVERBOAT.speed, 0, 0), fuelW: new THREE.Vector3(), burnT: 0 };
    g.scene.add(m.root);
    this._placeBoat(0);
    // gunmen on the open deck
    const deck = (m.anchors.deck || []).map(d => (Array.isArray(d) ? new THREE.Vector3(...d) : new THREE.Vector3(d.x, d.y, d.z)));
    B.gunmen = [];
    for (let i = 0; i < Math.min(deck.length, g.trailer ? 5 : 6); i++) {
      const L = deck[i];
      const w = L.clone().applyMatrix4(m.root.matrixWorld);
      B.gunmen.push(g.spawnSoldier({ x: w.x, z: w.z, y: w.y, role: 'deck', carrier: { obj: m.root, local: L, vel: B.vel }, delay: 0.6 + i * 0.35, noNade: true, hp: 2 }));
    }
    g.audio.play('ship_horn', { x: B.x, y: WATER_Y + 4, z: B.z, volume: 1 });
    return B;
  }
  _placeBoat(dt) {
    const B = this.boat, r = B.root;
    r.position.set(B.x, WATER_Y - B.sink + Math.sin(this.g.time * 0.9) * 0.06, B.z);
    r.rotation.set(Math.sin(this.g.time * 0.7) * 0.01 + B.pitch_ || 0, B.yaw, B.roll + Math.sin(this.g.time * 0.8) * 0.012, 'YXZ');
    r.updateMatrixWorld(true);
    const f = B.m.anchors.fuel; B.fuelW.set(...(Array.isArray(f) ? f : [f.x, f.y, f.z])).applyMatrix4(r.matrixWorld);
  }
  damageBoat(d, P) {
    const B = this.boat; if (!B || B.state !== 'cruise') return;
    B.hp -= d;
    if (B.hp < 8 && !B.leak) { B.leak = true; this.g.callout('FUEL LEAK!', B.fuelW.clone().setY(B.fuelW.y + 3), 'small'); }
    if (B.hp <= 0) this.explodeBoat();
  }
  explodeBoat() {
    const g = this.g, B = this.boat;
    if (B.state !== 'cruise') return;
    B.state = 'burning'; B.burnT = 0;
    const P = B.fuelW.clone();
    g.boom(P, 2.6, { radius: 14, dmg: 30 });
    this.megaFireball(P.clone().setY(P.y + 2), 2.0);
    g.fx.later(0.25, () => g.boom(P.clone().add(_v.set(range(-3, 3), 1, 0)).applyAxisAngle(UP, 0), 1.6, { radius: 10, dmg: 20, player: false }));
    for (let k = 0; k < 7; k++) g.fx.later(0.3 + k * 0.18, () => { const p = _v.set(range(-2.5, 2.5), range(2, 4), range(-16, 14)).applyMatrix4(B.root.matrixWorld); g.fx.explosion(p.clone(), range(1.1, 1.6), { noRing: true }); g.smokeAfter(p, 1.2); });
    for (const s of B.gunmen) if (s.alive) { _v.set(range(-0.4, 0.4), 0.9, range(-0.4, 0.4)).normalize(); g.killSoldier(s, _v.clone(), 3.2, false, null); }
    for (let i = 0; i < 16; i++) g.fx.spawnDebris(_v.set(range(-3, 3), range(2.5, 4), range(-14, 18)).applyMatrix4(B.root.matrixWorld).clone(), range(-9, 9), range(9, 20), range(-9, 9), range(0.35, 0.9), chance(0.7));
    // the saloon roof goes: glass + panels blown up along the whole cabin
    for (let k = 0; k < 6; k++) g.fx.later(0.1 + k * 0.08, () => { const p = _v.set(range(-2, 2), 3.6, -16 + k * 6).applyMatrix4(B.root.matrixWorld); g.fx.explosion(p.clone(), range(1.2, 1.7), { noRing: true }); });
    this.splash(P, 1.8);
    B.m.setBurnt?.();
    g.boatsSunk++;
    g.slowmo(1.6, 0.3, true);
    g.addScore(2500, 'BATEAU FLAMBÉ!', P.clone().setY(P.y + 16), 'huge');
    g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 1 });
    g.fx.light(P.clone().setY(P.y + 3), 500, 2, 0xff9040, true, 55);
    // a water column thrown up beside the hull
    for (let k = 0; k < 14; k++) g.fx.main.spawn({ x: P.x + range(-3, 3), y: WATER_Y + 0.5, z: P.z + range(-2, 2), vx: range(-2, 2), vy: range(10, 22), vz: range(-2, 2), grav: 9.8, drag: 0.4, frame: CELL.WISP, s0: 2, s1: range(6, 10), life: range(1.6, 2.4), rot: rand() * 6, r: 0.5, g: 0.52, b: 0.55, a: 0.6, fadeIn: 0.02, fadeOut: 0.6 });
    g.events.push({ type: 'boatBoom', P });
  }
  _updBoat(dt) {
    const B = this.boat; if (!B || B.state === 'gone') return;
    const g = this.g;
    B.t += dt;
    if (B.state === 'cruise') {
      B.v = RIVERBOAT.speed;
      // it never gets past the bridge in one piece (Bay rule): rams the pier
      if (B.x < BRIDGE.half + 26) this.explodeBoat();
      if (B.t % 7 < dt) g.audio.play('ship_horn', { x: B.x, y: WATER_Y + 4, z: B.z, volume: 0.6, pitch: 0.95 });
    } else {
      B.burnT += dt;
      B.v = damp(B.v, B.x < BRIDGE.half + 28 ? 0 : 2.2, 0.6, dt);
      B.sink = Math.min(2.6, B.burnT * 0.08); B.roll = damp(B.roll, 0.14, 0.2, dt);
      // a burning hulk: fire along the cabin, a black column climbing over the river
      if (g.headPos.distanceToSquared(B.root.position) < 220 * 220) {
        if (rand() < dt * 24) g.fx.flame(_v.set(range(-2.5, 2.5), range(2, 3.5), range(-17, 15)).applyMatrix4(B.root.matrixWorld), range(1.0, 1.6));
        // burning fuel slick spreading on the river around the hull
        if (B.burnT < 40 && rand() < dt * 16) { const r = Math.min(14, 4 + B.burnT * 0.6), a = rand() * 6.28; g.fx.main.spawn({ x: B.x + Math.cos(a) * r * range(0.4, 1.3), y: WATER_Y + 0.3, z: B.z + Math.sin(a) * r * 0.5, vx: range(-0.4, 0.4), vy: range(1.5, 3), vz: range(-0.4, 0.4), drag: 1.4, frameKind: 1, s0: range(1.2, 2), s1: range(3, 5), ease: 0.6, life: range(0.8, 1.4), rot: rand() * 6, vrot: range(-1, 1), r: 2.2, g: 1.4, b: 0.9, a: 1, fadeIn: 0.05, fadeOut: 0.6 }); }
        if (rand() < dt * 1.4) this.clouds.spawn({ x: B.x + range(-8, 8), y: WATER_Y + 5, z: B.z + range(-2, 2), vx: range(-0.4, 0.4) + 1.2, vy: range(4, 6), vz: range(-0.3, 0.3), drag: 0.12, buoy: 0.3, s0: 4, s1: range(24, 34), life: range(10, 13), a: 0.9, fadeIn: 0.08, fadeOut: 0.5, vrot: range(-0.1, 0.1), r: 0.06, g: 0.055, b: 0.05, r1: 0.14, g1: 0.13, b1: 0.12, glow: 1.2, glowFade: 4 });
        g.audio.setLoop('fire_big', { x: B.x, y: WATER_Y + 3, z: B.z, volume: 0.6, intensity: 0.7 });
      }
    }
    B.x -= B.v * dt; B.vel.set(-B.v, 0, 0);
    // bow wave
    if (B.state === 'cruise' && rand() < dt * 10) { const p = _v.set(range(-3, 3), 0.3, -20.5).applyMatrix4(B.root.matrixWorld); g.fx.main.spawn({ x: p.x, y: WATER_Y + 0.2, z: p.z, vx: range(-1, 1), vy: 0.4, vz: range(-2, 2), drag: 1, frame: CELL.WISP, s0: 0.8, s1: 3, life: 1.5, rot: rand() * 6, r: 0.62, g: 0.66, b: 0.7, a: 0.35, fadeOut: 0.5 }); }
    this._placeBoat(dt);
    if (B.state === 'cruise') B.m.update?.(dt, g.time); // searchlight sweep
    if (B.state === 'cruise') g.audio.setLoop('suv:boat', { x: B.x, y: WATER_Y + 2, z: B.z, volume: 0.8 });
    else g.audio.stopLoop('suv:boat');
  }

  // ================================================================== GUNSHIP
  spawnHeli() {
    const g = this.g, m = buildHeli();
    m.root.scale.setScalar(1.6);
    // under the tower's floods the belly picks up gold: a warm lift so it never reads as a black toy
    m.root.traverse(o => { if (o.isMesh && o.material && !o.material.isShaderMaterial) { o.material = [].concat(o.material).map(mm => { if (!mm.isMeshStandardMaterial) return mm; const c = mm.clone(); c.emissive = new THREE.Color(0x3a2410); c.emissiveIntensity = 1; return c; }); if (o.material.length === 1) o.material = o.material[0]; } });
    // a visible searchlight cone sweeping the gravel
    { const L = 70, cg = new THREE.ConeGeometry(9, L, 18, 1, true); cg.translate(0, -L / 2, 0);
      const cm = new THREE.ShaderMaterial({ vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y / ${L.toFixed(1)}; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
        fragmentShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float a = pow(abs(dot(vN, vV)), 1.5) * pow(1.0 - vY, 1.8) * 0.16; gl_FragColor = vec4(vec3(0.9, 0.92, 1.0) * a, a); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
      const cone = new THREE.Mesh(cg, cm); cone.frustumCulled = false; cone.renderOrder = 18;
      this.spot = cone; g.scene.add(cone); }
    g.scene.add(m.root);
    const mk = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); m.tilt.add(o); return o; };
    const hit = [[mk(0, 0.2, -0.8), 1.9], [mk(0, 0.4, -3.4), 1.3], [mk(0, 0.4, 3.0), 1.1], [mk(0, 0.5, 6.5), 0.8]];
    const hp = g.trailer ? 120 : 145;
    // in low over the river from the west, up the bridge axis
    this.heli = { m, hit, pos: m.root.position.set(-220, 16, 0), vel: new THREE.Vector3(45, 0, 0), yaw: -Math.PI / 2, hp, maxHp: hp, phase: 'enter', t: 0, rocketT: 3.5, gunT: 2.5, burst: 0, wp: new THREE.Vector3(), wpT: 0, spin: 0, alive: true, bank: 0, pitch: 0, threadT: 16, hitT: 0, orbit: rand() * 6 };
    g.audio.musicStinger('boss');
    return this.heli;
  }
  damageHeli(d, P) {
    const H = this.heli; if (!H || !H.alive || H.phase === 'dying') return;
    H.hp -= d; H.hitT = 1;
    if (H.m.setDamage?.(clamp(1 - H.hp / H.maxHp, 0, 1))) {
      const p = H.m.sparkPt.getWorldPosition(new THREE.Vector3());
      this.g.fx.smallExplosion(p, 0.7);
      for (let i = 0; i < 4; i++) this.g.fx.spawnDebris(p, H.vel.x + range(-5, 5), range(2, 6), H.vel.z + range(-5, 5), range(0.15, 0.35), true);
      this.g.audio.play('metal_crash', { x: p.x, y: p.y, z: p.z, volume: 0.7, pitch: 1.3 });
      this.g.callout('ENGINE HIT!', p.clone().setY(p.y + 3), 'small');
    }
    if (H.hp <= 0) this.killHeli();
  }
  killHeli() {
    const g = this.g, H = this.heli;
    if (H.phase === 'dying') return;
    H.phase = 'dying'; H.t = 0; H.spin = 0.6;
    g.fx.explosion(H.pos.clone(), 1.3, { noRing: true });
    g.slowmo(2.4, 0.28, true);
    g.addScore(5000, 'BIRD DOWN!', H.pos.clone().setY(H.pos.y + 4), 'huge');
    g.audio.play('metal_crash', { x: H.pos.x, y: H.pos.y, z: H.pos.z });
    g.bossInfo = null;
    g.events.push({ type: 'heliDying' });
    // it goes into the north-east leg of the tower, where the lattice meets the first arch
    H.crash = this.crashPoint();
    H.lookT = 0; H.commit = false;
  }
  crashPoint() { const c = LEGC(TOWER.crashY), L = LEGS[TOWER.crashLeg]; return new THREE.Vector3(TOWER.x + L.sx * c, TOWER.crashY, TOWER.z + L.sz * c); }
  _updHeli(dt) {
    const g = this.g, H = this.heli;
    if (!H || H.phase === 'gone') return;
    H.t += dt; H.hitT = Math.max(0, H.hitT - dt * 6);
    const m = H.m, head = g.headPos;
    const target = _v;
    let speedK = 1.1, maxV = 34;
    const TC = _v3.set(TOWER.x, 0, TOWER.z);
    if (H.alive && H.phase !== 'dying') g.bossInfo = { frac: Math.max(0, H.hp / H.maxHp), name: 'GUNSHIP  "WIDOWMAKER 3"' };
    if (H.phase === 'enter') {
      // low up the river, a hard climbing turn at the bridge and in over the park
      const t = H.t;
      if (t < 4.2) { target.set(lerp(-220, 10, t / 4.2), lerp(16, 22, t / 4.2), lerp(0, -10, t / 4.2)); speedK = 3; maxV = 60; }
      else if (t < 7.5) { target.set(30, 32, clamp(head.z + 30, -120, -60)); speedK = 1.4; }
      else { H.phase = 'fight'; H.wpT = 0; }
      if (t > 1.2 && !H.flyby) { H.flyby = true; g.audio.play('heli_flyby', { x: H.pos.x, y: H.pos.y, z: H.pos.z }); }
    }
    if (H.phase === 'fight' || H.phase === 'thread') this._heliWeapons(dt);
    m.aimGun?.(H.aimAt || head, dt, H.phase !== 'dying' && H.burst > 0);
    if (H.hp < H.maxHp * 0.5 && rand() < dt * 25) { m.sparkPt.getWorldPosition(_v2); g.fx.flame(_v2, 0.5, H.vel); }
    if (H.phase === 'fight') {
      H.wpT -= dt; H.threadT -= dt;
      if (H.wpT <= 0) {
        // circle the tower, staying on the player's side, outside the legs; dip low between them sometimes
        H.wpT = range(3.5, 5.5);
        const toP = Math.atan2(head.z - TC.z, head.x - TC.x);
        H.orbit = toP + range(-0.9, 0.9);
        const R = range(78, 96);
        H.wp.set(TC.x + Math.cos(H.orbit) * R, range(24, 42), TC.z + Math.sin(H.orbit) * R);
      }
      target.copy(H.wp);
      if (H.threadT <= 0) {
        // threading run: straight through the tower under the first platform, between the legs
        H.phase = 'thread'; H.t = 0;
        const ax = chance(0.5) ? 'x' : 'z', s = head[ax] > TC[ax] ? -1 : 1;
        H.a0 = TC.clone().setY(30); H.a1 = TC.clone().setY(30);
        if (ax === 'x') { H.a0.x -= s * 120; H.a1.x += s * 130; } else { H.a0.z -= s * 120; H.a1.z += s * 130; }
        g.events.push({ type: 'thread' });
      }
      if (H.hp < H.maxHp * 0.5) g.fx.trailEmit(H, m.smokePt.getWorldPosition(_v2), 0.8, (q) => g.fx.smoke(q, 1.1, 0.13, 2.5, 0.5, 0.65), 0);
      if (H.hp < H.maxHp * 0.6) g.fx.trailEmit(H.ribbon ||= {}, m.smokePt.getWorldPosition(_v2), 2.2, (q) => this.clouds.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.4, 0.4), vy: range(0.3, 1), vz: range(-0.4, 0.4), drag: 0.5, buoy: 0.1, s0: 2.2, s1: range(9, 13), life: range(6, 8), a: H.hp < H.maxHp * 0.3 ? 0.92 : 0.7, fadeIn: 0.05, fadeOut: 0.55, vrot: range(-0.2, 0.2), r: 0.07, g: 0.062, b: 0.058, r1: 0.2, g1: 0.18, b1: 0.16 }), 0);
    }
    if (H.phase === 'thread') {
      const T = H.t;
      if (T < 3.0) { target.copy(H.a0); speedK = 1.6; }
      else {
        const k = clamp((T - 3.0) / 6.5, 0, 1);
        target.lerpVectors(H.a0, H.a1, k); target.y = 30 + Math.sin(k * Math.PI) * -4; speedK = 4; maxV = 42;
        if (k > 0.2 && k < 0.8) this._strafeFire(dt);
        if (k >= 1) { H.phase = 'fight'; H.threadT = range(18, 24); H.wpT = 0; }
      }
    }
    if (H.phase === 'dying') {
      H.spin = Math.min(5.5, H.spin + dt * 2.2);
      H.yaw += H.spin * dt;
      // VR: the crash waits until you're looking at the leg (or 5 s): it limps in a burning circle near it
      if (!H.commit) {
        g.camera.getWorldDirection(_v3); const to = _v2.subVectors(H.pos, g.headPos).normalize();
        H.lookT = _v3.dot(to) > 0.8 ? H.lookT + dt : 0;
        if (H.lookT > 0.3 || H.t > 5 || g.auto) H.commit = true;
      }
      const goal = H.commit ? H.crash : _v.copy(H.crash).add(_v3.set(Math.cos(H.t * 0.9) * 26, 10 + Math.sin(H.t * 1.3) * 3, Math.sin(H.t * 0.9) * 26));
      const d = H.pos.distanceTo(H.crash);
      const sp = H.commit ? Math.min(30, 12 + H.t * 6) : 14;
      _v2.subVectors(goal, H.pos).normalize();
      _v2.x += Math.sin(H.t * 2.3) * 0.25; _v2.y += Math.sin(H.t * 3.1) * 0.15; _v2.normalize();
      H.vel.lerp(_v2.multiplyScalar(sp), 1 - Math.exp(-dt * 2.5));
      g.fx.trailEmit(H, m.smokePt.getWorldPosition(_v3), 0.7, (q) => { g.fx.flame(q, 1.2); g.fx.smoke(q, 1.6, 0.1, 3.5, 1, 0.85); }, 0);
      g.fx.trailEmit(H.ribbon ||= {}, m.smokePt.getWorldPosition(_v3), 2.0, (q) => this.clouds.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.5, 0.5), vy: range(0.5, 1.5), vz: range(-0.5, 0.5), drag: 0.5, buoy: 0.1, s0: 3, s1: range(12, 16), life: range(7, 9), a: 0.94, fadeIn: 0.03, fadeOut: 0.5, vrot: range(-0.2, 0.2), r: 0.06, g: 0.052, b: 0.048, r1: 0.18, g1: 0.16, b1: 0.14, glow: 1.2, glowFade: 6 }), 0);
      if (H.t > 0.8 && !H.tail && m.breakTail) {
        const tb = m.breakTail();
        if (tb) { H.tail = { o: tb.object, v: tb.velocityHint.clone().add(H.vel), w: tb.spinHint.clone() }; g.fx.smallExplosion(tb.object.getWorldPosition(new THREE.Vector3()), 0.9); }
      }
      if ((H.commit && d < 3) || H.t > 14) { this._heliCrash(); return; }
    } else {
      _v2.subVectors(target, H.pos).multiplyScalar(speedK);
      if (_v2.length() > maxV) _v2.setLength(maxV);
      H.vel.lerp(_v2, 1 - Math.exp(-dt * 1.6));
      this._avoidLegs(H, dt);
    }
    H.pos.addScaledVector(H.vel, dt);
    if (H.phase !== 'dying') {
      const faceYaw = (H.phase === 'enter' && H.t < 4.2) || (H.phase === 'thread' && H.t > 3) ? Math.atan2(-H.vel.x, -H.vel.z) : Math.atan2(-(head.x - H.pos.x), -(head.z - H.pos.z));
      let dy = faceYaw - H.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      H.yaw += dy * (1 - Math.exp(-dt * 2.4));
    }
    const cy = Math.cos(H.yaw), sy = Math.sin(H.yaw);
    const fwd = H.vel.x * -sy + H.vel.z * -cy, side = H.vel.x * cy - H.vel.z * sy;
    H.pitch = damp(H.pitch, -clamp(fwd * 0.012, -0.35, 0.35), 3, dt);
    H.bank = damp(H.bank, -clamp(side * 0.02, -0.55, 0.55), 3, dt);
    m.root.position.copy(H.pos);
    m.root.rotation.set(0, H.yaw, 0);
    m.tilt.rotation.set(H.pitch, 0, H.bank + (H.phase === 'dying' ? Math.sin(H.t * 3) * 0.3 : 0));
    m.rotor.rotation.y += dt * 38; m.tailRotor.rotation.x += dt * 60;
    m.root.updateMatrixWorld();
    g.audio.setLoop('heli', { x: H.pos.x, y: H.pos.y, z: H.pos.z, volume: 1 });
    // rotor wash: gravel, leaves, rain spray whipped off the park
    const gy = this.world.fastGround(H.pos.x, H.pos.z);
    if (H.pos.y - gy < 30) {
      H.dustT = (H.dustT || 0) - dt;
      if (H.dustT <= 0) {
        H.dustT = 0.06;
        const a = 1 - (H.pos.y - gy) / 30, ang = rand() * 6.28, r = range(2, 8);
        const water = gy <= WATER_Y + 0.01;
        g.fx.main.spawn({ x: H.pos.x + Math.cos(ang) * r, y: gy + 0.4, z: H.pos.z + Math.sin(ang) * r, vx: Math.cos(ang) * range(6, 11), vz: Math.sin(ang) * range(6, 11), vy: range(0.3, 1.2), drag: 1.1, frame: water ? CELL.WISP : CELL.DUST, s0: 2, s1: 7, life: 1.6, rot: rand() * 6, r: water ? 0.7 : 0.6, g: water ? 0.75 : 0.56, b: water ? 0.8 : 0.5, a: 0.4 * a, fadeOut: 0.35 });
      }
    }
    // searchlight cone: from the nose, aimed where the gun is looking (or down-ahead)
    if (this.spot) {
      this.spot.visible = H.phase !== 'dying' && H.alive;
      if (this.spot.visible) { m.lightPt.getWorldPosition(_v); this.spot.position.copy(_v); const tg = _v2.copy(H.aimAt || g.headPos); tg.y = Math.min(tg.y, _v.y - 4); _v3.subVectors(tg, _v).normalize(); this.spot.quaternion.setFromUnitVectors(_v.set(0, -1, 0), _v3); }
    }
    // nav lights + searchlight glow
    const G = this.glowB, blink = Math.sin(g.time * 6) > 0.3;
    let gi = 0;
    if (H.phase !== 'dying') for (const [pt, col] of m.navLights) { if (col[3] && !blink) continue; pt.getWorldPosition(_v); G.set(gi++, _v.x, _v.y, _v.z, 1.3, 1.3, 0, CELL.GLOW, 0, col[0], col[1], col[2], 1); }
    if (H.phase !== 'dying') { m.lightPt.getWorldPosition(_v); G.set(gi++, _v.x, _v.y, _v.z, 4, 4, 0, CELL.GLOW, 0, 2.2, 2.0, 1.7, 0.9); }
    G.commit(gi);
  }
  // soft repulsion from the four legs (and the first platform from below): it threads them, never clips them
  _avoidLegs(H, dt) {
    const p = H.pos;
    for (const L of LEGS) {
      const c = LEGC(clamp(p.y, 0, HA)), lx = TOWER.x + L.sx * c, lz = TOWER.z + L.sz * c;
      const dx = p.x - lx, dz = p.z - lz, d = Math.hypot(dx, dz), R = 17;
      if (d < R && p.y < HA + 6) { const k = (R - d) * 3; H.vel.x += dx / (d || 1) * k * dt * 10; H.vel.z += dz / (d || 1) * k * dt * 10; }
    }
    const inTower = Math.abs(p.x - TOWER.x) < TOWER.p1.half + 6 && Math.abs(p.z - TOWER.z) < TOWER.p1.half + 6;
    if (inTower && p.y > TOWER.p1.y - 14 && p.y < TOWER.p1.y + 6) H.vel.y = damp(H.vel.y, -6, 4, dt);
    if (p.y < 12) H.vel.y = damp(H.vel.y, 6, 4, dt);
  }
  _heliWeapons(dt) {
    const g = this.g, H = this.heli, m = H.m, head = g.headPos;
    H.rocketT -= dt; H.gunT -= dt;
    const hpFrac = H.hp / H.maxHp;
    if (H.phase === 'fight' && H.rocketT <= 0) {
      H.rocketT = range(3.6, 5.5) * (hpFrac < 0.5 ? 0.75 : 1);
      const cars = g.traffic.near(head, 12).sort((a, b) => a.root.position.distanceTo(head) - b.root.position.distanceTo(head));
      const pod = m.pods[Math.floor(rand() * 2)];
      const p = pod.getWorldPosition(new THREE.Vector3());
      const aim = cars.length && chance(0.7) ? g.traffic.worldCenter(cars[0], new THREE.Vector3()) : head.clone().add(_v.set(range(-4, 4), -1.4, range(-4, 4)));
      const dir = aim.clone().sub(p).normalize();
      this.rockets.push({ pos: p, vel: dir.multiplyScalar(42), life: 5 });
      g.audio.play('rocket_launch', { x: p.x, y: p.y, z: p.z });
      g.fx.muzzle(p, dir, 'launcher', false);
    }
    if (H.gunT <= 0 && H.phase === 'fight') {
      if (H.burst <= 0) { H.burst = 16; H.walk0 = head.clone().add(_v.set(range(-7, 7), 0, range(-12, -8))); H.walk1 = head.clone(); }
      H.burst--;
      H.gunT = H.burst > 0 ? 0.075 : range(2.2, 3.4);
      const mz = m.gun.getWorldPosition(new THREE.Vector3());
      const prog = 1 - H.burst / 16;
      const tgt = _v2.lerpVectors(H.walk0, H.walk1, prog);
      tgt.y = this.world.fastGround(tgt.x, tgt.z) + range(-0.3, 0.6);
      tgt.x += range(-0.8, 0.8); tgt.z += range(-0.8, 0.8);
      this._gunRound(mz, tgt.clone());
    }
  }
  _gunRound(mz, tgt) {
    const g = this.g;
    if (this.heli) (this.heli.aimAt ||= new THREE.Vector3()).copy(tgt);
    _v.subVectors(tgt, mz).normalize();
    g.fx.muzzle(mz, _v, 'enemy', false);
    if (rand() < 0.4) g.fx.light(mz, 12, 0.05, 0xffb060, true, 12);
    g.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, pitch: 0.62, volume: 1 });
    const { end } = g._round(mz, tgt, null, { speed: 300, color: [2.0, 0.65, 0.28], width: 0.09, len: 6, carDmg: 2 });
    g.fx.later(mz.distanceTo(end) / 300, () => {
      g.fx.main.spawn({ x: end.x, y: end.y + 0.3, z: end.z, vy: range(2, 4), frame: CELL.DIRT, s0: 0.6, s1: 2.2, ease: 0.5, life: 0.9, rot: rand() * 6, r: 0.8, g: 0.75, b: 0.68, a: 0.85, fadeIn: 0.02, fadeOut: 0.3 });
      if (end.distanceTo(g.headPos) < 1.6 + (g.trailer ? -0.6 : 0)) g.hurt(6, end);
    });
  }
  _strafeFire(dt) {
    const g = this.g, H = this.heli, m = H.m;
    H.sfT = (H.sfT || 0) - dt;
    if (H.sfT > 0) return;
    H.sfT = 0.07;
    H.sfK = (H.sfK || 0) + 1;
    const mz = m.gun.getWorldPosition(new THREE.Vector3());
    // a zig-zag of 30 mm ahead of it along the gravel, sparks off the leg plinths
    _v.copy(H.vel).setY(0).normalize();
    const P = H.pos.clone().addScaledVector(_v, 26 + range(-3, 3)).add(_v2.set(-_v.z, 0, _v.x).multiplyScalar(Math.sin(H.sfK * 0.7) * 9));
    P.y = this.world.fastGround(P.x, P.z);
    this._gunRound(mz, P);
  }
  _updTail(dt) {
    const T = this.heli?.tail; if (!T || T.done) return;
    const g = this.g;
    T.v.y -= 9.8 * dt; T.o.position.addScaledVector(T.v, dt);
    _q.setFromAxisAngle(_v.copy(T.w).normalize(), T.w.length() * dt); T.o.quaternion.premultiply(_q);
    g.fx.trailEmit(T, T.o.position, 0.6, (q) => g.fx.smoke(q, 1.0, 0.12, 2.5, 0.6, 0.7), 0);
    const gy = this.world.fastGround(T.o.position.x, T.o.position.z);
    if (T.o.position.y < gy + 0.8) { T.done = true; T.o.position.y = gy + 0.6; g.boom(T.o.position.clone(), 0.9, { radius: 6, dmg: 30 }); T.o.traverse(o => { if (o.isMesh) o.material = MAT.charred; }); }
  }
  _updRockets(dt) {
    const g = this.g;
    for (const r of this.rockets) {
      r.life -= dt;
      const prev = _v2.copy(r.pos);
      r.pos.addScaledVector(r.vel, dt);
      g.fx.trailEmit(r, r.pos, 0.35, (q) => { g.fx.main.spawn({ x: q.x, y: q.y, z: q.z, vx: range(-0.3, 0.3), vy: range(0.2, 0.6), vz: range(-0.3, 0.3), drag: 1.2, frameKind: 2, frame: rand() * 40, frames: 12, s0: 0.5, s1: 2.4, life: range(1.6, 2.4), rot: rand() * 6, r: 0.55, g: 0.52, b: 0.5, a: 0.55, fadeOut: 0.5 }); }, 0);
      g.fx.main.spawn({ x: r.pos.x, y: r.pos.y, z: r.pos.z, frame: CELL.GLOW, s0: 0.9, life: 0.04, r: 3.8, g: 1.8, b: 0.6, a: 1, anchored: false });
      g.audio.setLoop('rocket:' + (r.id ||= Math.floor(rand() * 1e6)), { x: r.pos.x, y: r.pos.y, z: r.pos.z, volume: 0.8 });
      _v.subVectors(r.pos, prev); const L = _v.length(); _v.divideScalar(L || 1);
      const hit = L > 0 ? g.col.raycast(prev, _v, L, b => b.data.noBullet || b.data.kind === 'glass') : null;
      const gy = this.world.fastGround(r.pos.x, r.pos.z);
      if (hit || r.pos.y < gy + 0.2 || r.life <= 0) {
        r.dead = true;
        const P = hit ? prev.clone().addScaledVector(_v, hit.t - 0.2) : r.pos.clone().setY(Math.max(r.pos.y, gy + 0.3));
        if (hit && hit.box.data.kind === 'car') { g.traffic.ignite(hit.box.data.ref, 0.05); hit.box.data.ref.lastHitDir = _v.clone(); }
        g.audio.stopLoop('rocket:' + r.id);
        g.boom(P, 1.0, { radius: 6.5, dmg: 40 });
      }
    }
    this.rockets = this.rockets.filter(r => !r.dead);
  }
  _heliCrash() {
    const g = this.g, H = this.heli, m = H.m;
    H.phase = 'gone'; H.alive = false;
    g.audio.stopLoop('heli'); this.glowB.commit(0); if (this.spot) this.spot.visible = false;
    const I = H.crash.clone();
    // wedged in the lattice, nose first, burning
    m.root.position.copy(I).add(_v.set(-3, -1, 3)); m.root.rotation.set(0.5, Math.PI * 0.75, 0.9);
    m.tilt.rotation.set(0, 0, 0); m.body.material = [MAT.charred, MAT.charred, MAT.charred];
    for (const b of m.burnables || []) b.material = MAT.charred;
    m.rotorBlur?.(0, true);
    m.rotor.visible = false; m.cone.visible = false;
    m.root.updateMatrixWorld(true);
    this.wreck = { m, I };
    g.fx.explosion(I.clone(), 4.0, { noRing: true });
    for (let k = 1; k <= 7; k++) g.fx.later(0.1 * k + rand() * 0.1, () => g.fx.explosion(I.clone().add(_v.set(range(-8, 8), range(-6, 10), range(-8, 8))), range(1.6, 2.6), { noRing: true }));
    for (let k = 0; k < 12; k++) g.fx.later(0.15 + k * 0.08, () => this.clouds.spawn({ x: I.x + range(-10, 10), y: I.y + range(-4, 8), z: I.z + range(-10, 10), vx: range(-4, 4), vy: range(4, 9), vz: range(-4, 4), drag: 0.5, buoy: 0.6, s0: range(10, 16), s1: range(34, 48), life: range(10, 14), a: 0.95, fadeIn: 0.02, fadeOut: 0.4, vrot: range(-0.1, 0.1), r: 0.06, g: 0.052, b: 0.047, r1: 0.14, g1: 0.125, b1: 0.11, glow: 1.4, glowFade: 1.6 }));
    g.fx.light(I, 900, 1.8, 0xff9040, true, 140);
    g.lastExplosionT = g.time; g.lastExplosionShake = 0.7;
    g.audio.play('explosion_big', { x: I.x, y: I.y, z: I.z, volume: 1 });
    g.audio.play('metal_crash', { x: I.x, y: I.y, z: I.z, volume: 1 });
    for (let k = 0; k < 140; k++) g.fx.sparks.spawn({ x: I.x + range(-6, 6), y: I.y + range(-4, 8), z: I.z + range(-6, 6), vx: range(-5, 5), vy: range(-2, 5), vz: range(-5, 5), grav: -9.8, drag: 0.4, frame: CELL.SPARK, s0: 1, w: 0.05, len: 0.15, life: range(2, 4), r: 2.6, g: 1.6, b: 0.6, a: 0.9, fadeOut: 0.5, ground: true });
    g.slowmo(1.8, 0.35, true);
    g.addScore(1500, 'RIGHT IN THE LEG!', I.clone().add(_v.set(0, 10, 0)), 'big');
    g.fx.main.bigBudget += 90; g.fx.later(5, () => { g.fx.main.bigBudget -= 90; });
    this.megaFireball(I.clone(), 2.0);
    // tear girders off the struck leg
    this.tear(TOWER.crashY - 14, TOWER.crashY + 14, 26, TOWER.crashLeg, 9);
    this.legFire = { P: I.clone(), t: 0 };
    this.woundTower();
    g.events.push({ type: 'heliCrash', P: I.clone() });
  }
  megaFireball(P, k = 1) {
    const g = this.g;
    g.fx.light(P, 1600 * k, 2.2, 0xff9a40, true, 180);
    g.fx.main.spawn({ x: P.x, y: P.y, z: P.z, frame: CELL.FLASH, s0: 16 * k, s1: 34 * k, life: 0.25, r: 2.2, g: 1.1, b: 0.4, a: 1, fadeIn: 0, fadeOut: 0.3, force: true });
    for (let i = 0; i < 12; i++) g.fx.later(i * 0.04, () => {
      const a = rand() * 6.28, el = range(0.1, 1.2), sp = range(6, 16) * k;
      g.fx.main.spawn({ x: P.x + range(-4, 4) * k, y: P.y + range(-2, 3) * k, z: P.z + range(-4, 4) * k, vx: Math.cos(a) * Math.cos(el) * sp, vy: Math.sin(el) * sp + 4, vz: Math.sin(a) * Math.cos(el) * sp, drag: 1.6, grav: 2, frameKind: 1, s0: range(9, 13) * k, s1: range(22, 32) * k, ease: 0.55, life: range(1.8, 2.6), rot: rand() * 6, vrot: range(-0.6, 0.6), r: 2.3, g: 1.6, b: 1.1, a: 1, fadeIn: 0.02, fadeOut: 0.8 });
    });
    for (let i = 0; i < 9; i++) g.fx.later(range(0.4, 1.3), () => this.clouds.spawn({ x: P.x + range(-8, 8) * k, y: P.y + range(3, 10) * k, z: P.z + range(-6, 6), vx: range(-2, 2), vy: range(5, 9), vz: range(-2, 2), drag: 0.45, buoy: 0.5, s0: 12 * k, s1: range(30, 42) * k, life: range(8, 11), a: 0.95, fadeIn: 0.08, fadeOut: 0.45, vrot: range(-0.12, 0.12), r: 0.07, g: 0.06, b: 0.055, r1: 0.15, g1: 0.13, b1: 0.115, glow: 1.2, glowFade: 2 }));
  }
  _updFires(dt) {
    const g = this.g, F = this.legFire;
    if (!F || (this.fall && this.fall.phase === 'down' && this.fall.t > 30)) return;
    F.t += dt;
    const I = this.fall ? this._legPoint(TOWER.crashLeg, TOWER.crashY, _v2) : F.P;
    // the wreck stays wedged in the leg while the leg buckles and falls
    if (this.wreck && this.fall && this.fall.phase !== 'wounded' || this.wreck && this.fall?.wound > 0) { this.wreck.m.root.position.copy(I).add(_v.set(-3, -1, 3)); this.wreck.m.root.updateMatrixWorld(true); }
    if (g.headPos.distanceToSquared(I) < 250 * 250) {
      if (rand() < dt * 22) g.fx.main.spawn({ x: I.x + range(-5, 5), y: I.y + range(-3, 3), z: I.z + range(-5, 5), vx: range(-1, 1), vy: range(3, 7), vz: range(-1, 1), drag: 1.2, frameKind: 1, s0: range(3, 5), s1: range(8, 12), ease: 0.6, life: range(0.9, 1.5), rot: rand() * 6, vrot: range(-1, 1), r: 2.2, g: 1.5, b: 1.0, a: 1, fadeIn: 0.02, fadeOut: 0.6 });
      if (rand() < dt * 1.8) this.clouds.spawn({ x: I.x + range(-5, 5), y: I.y + 4, z: I.z + range(-5, 5), vx: range(-0.5, 0.5) + 1.0, vy: range(6, 9), vz: range(-0.5, 0.5), drag: 0.15, buoy: 0.4, s0: 10, s1: range(40, 54), life: range(13, 16), a: 0.95, fadeIn: 0.04, fadeOut: 0.45, vrot: range(-0.06, 0.06), r: 0.06, g: 0.053, b: 0.048, r1: 0.15, g1: 0.135, b1: 0.12, glow: 1.3, glowFade: 4 });
      if (rand() < dt * 30) g.fx.sparks.spawn({ x: I.x + range(-4, 4), y: I.y + range(0, 8), z: I.z + range(-4, 4), vx: range(-1, 1), vy: range(-1, 2), vz: range(-1, 1), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 1, w: 0.04, len: 0.12, life: range(1.5, 3), r: 2.6, g: 1.5, b: 0.6, a: 1, fadeOut: 0.5, ground: true });
      g.audio.setLoop('fire_big', { x: I.x, y: I.y, z: I.z, volume: 0.8, intensity: 0.8 });
    }
  }
  _legPoint(leg, y, out) {
    const L = LEGS[leg], c = LEGC(y);
    return this.T.rig.deform(out.set(L.sx * c, y, L.sz * c), out).add(this.T.root.position);
  }

  // ================================================================== THE TOWER
  // rip `n` girders off the structure between heights y0..y1 (optionally one leg), flinging them out
  tear(y0, y1, n, leg = -1, speed = 6) {
    const T = this.T, R = T.rig, beams = T.beams, g = this.g;
    let tries = 0;
    while (n > 0 && tries++ < n * 30) {
      const i = (rand() * beams.length) | 0, b = beams[i];
      if (b.gone || b.kind === 4) continue;
      const my = (b.a.y + b.b.y) / 2; if (my < y0 || my > y1) continue;
      if (leg >= 0) { const L = LEGS[leg]; if (Math.sign(b.a.x) !== L.sx || Math.sign(b.a.z) !== L.sz) continue; }
      if (b.kind === 1 && chance(0.7)) continue; // corner chords mostly hold
      b.gone = true; n--;
      const a = R.deform(b.a, new THREE.Vector3()).add(T.root.position), c = R.deform(b.b, new THREE.Vector3()).add(T.root.position);
      const mid = _v.addVectors(a, c).multiplyScalar(0.5);
      const out = _v2.set(mid.x - T.root.position.x, 0, mid.z - T.root.position.z).normalize();
      const vel = out.multiplyScalar(range(1, speed)).add(_v3.set(range(-2, 2), range(-1, 4), range(-2, 2))).add(this.fall?.vel || _v3.set(0, 0, 0));
      this.girders.spawn(a, c, b.w, vel, 2.5);
      this.hideBeam(i);
      if (rand() < 0.5) for (let k = 0; k < 8; k++) g.fx.sparks.spawn({ x: mid.x, y: mid.y, z: mid.z, vx: range(-4, 4), vy: range(-1, 4), vz: range(-4, 4), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 1, w: 0.05, len: 0.14, life: range(1.5, 3.5), r: 2.8, g: 1.8, b: 0.7, a: 1, fadeOut: 0.5, ground: true });
    }
  }
  hideBeam(i) {
    const geo = this.T.girders.geometry;
    for (let c = 0; c < 4; c++) { const a = geo.getAttribute('iM' + c); a.array.fill(0, i * 4, i * 4 + 4); a.needsUpdate = true; }
  }
  // the leg buckles where the gunship hit; the tower lists toward it and groans
  woundTower() {
    const F = this.fall = {
      phase: 'wounded', t: 0, th: 0, om: 0, wound: 0, dir: new THREE.Vector3(0.45, 0, 1).normalize(), twist: 0, sink: 0, slide: 0,
      landed: new Array(NODES).fill(false), vel: new THREE.Vector3(), prevTop: null, powerLo: -10, groanT: 0.5, tearT: 1, lastTip: new THREE.Vector3(),
    };
    this.T.rig.active = 1;
    this.T.state.sparkle = 0;
    this.g.audio.play('metal_groan', { volume: 1, pitch: 0.5 });
    return F;
  }
  startFall() {
    const F = this.fall || this.woundTower();
    if (F.phase === 'fall' || F.phase === 'down') return;
    F.phase = 'fall'; F.t = 0; F.om = 0.02;
    // the last show: she sparkles all the way down
    this.T.state.sparkle = 1;
    this.g.events.push({ type: 'fallStart' });
    this.g.audio.play('metal_groan', { volume: 1, pitch: 0.4 });
    this.g.audio.play('collapse_rumble', { volume: 1 });
    this.g.audio.setLoop('dust_roar', { volume: 0.3 });
  }
  _updFall(dt) {
    const F = this.fall; if (!F) return;
    const g = this.g, T = this.T, R = T.rig;
    F.t += dt;
    // ---- drive the big angle
    if (F.phase === 'wounded') {
      F.wound = Math.min(1, F.wound + dt * 0.6);
      F.th = damp(F.th, 0.045 * F.wound + Math.sin(F.t * 7) * 0.002 * F.wound, 1.5, dt);
      F.groanT -= dt;
      if (F.groanT <= 0) { F.groanT = range(2.2, 3.8); g.audio.play('metal_groan', { x: T.root.position.x, y: 40, z: T.root.position.z, volume: 1, pitch: range(0.5, 0.75) }); g.lastExplosionT = g.time; g.lastExplosionShake = 0.12; this.tear(10, 70, 3, -1, 3); }
      R.u.uFlicker.value = F.t < 6 ? 0.5 : 0.15;
    } else if (F.phase === 'fall') {
      F.wound = 1;
      // inverted pendulum: slow, then everything at once
      F.om += 0.13 * Math.sin(Math.max(F.th, 0.06)) * dt;
      F.th = Math.min(1.62, F.th + F.om * dt);
      if (F.th >= 1.62) F.om = 0;
      F.dir.lerp(_v.set(0.05, 0, 1).normalize(), 1 - Math.exp(-dt * 0.8)).normalize();
      F.twist = damp(F.twist, 0.32, 0.5, dt);
      F.sink = Math.min(9, F.sink + dt * 1.6);
      F.slide = Math.min(16, F.slide + dt * F.th * 3);
      // power dies floor by floor from the feet up; flicker everywhere
      // she stays lit all the way down (the money shot); only the torn feet go dark, then everything dies on impact
      F.powerLo = Math.min(F.bridgeHit ? 150 : 400, F.powerLo + dt * (F.bridgeHit ? 160 : 3.5));
      R.u.uPowerLo.value = F.powerLo; R.u.uFlicker.value = F.bridgeHit ? 0.7 : 0.2;
      T.state.light = F.bridgeHit ? Math.max(0.55, T.state.light - dt * 0.45) : 1;
      if (F.th > 0.5) T.state.beacon = Math.max(0, T.state.beacon - dt * 0.15);
      if (F.th > 1.0) T.state.sparkle = Math.max(0, T.state.sparkle - dt * 0.4);
      // the bend: rivets let go in showers at the first platform and the second
      if (F.th > 0.12) for (const hy of [TOWER.p1.y, TOWER.p2.y]) if (rand() < dt * 30) {
        const sx = rand() < 0.5 ? -1 : 1, P = R.deform(_v.set(sx * W(hy) * range(0.3, 1), hy, range(-1, 1) * W(hy)), _v).add(T.root.position);
        for (let k = 0; k < 6; k++) g.fx.sparks.spawn({ x: P.x, y: P.y, z: P.z, vx: range(-3, 3) + F.vel.x, vy: range(-2, 3), vz: range(-3, 3) + F.vel.z, grav: -9.8, drag: 0.25, frame: CELL.SPARK, s0: 1, w: 0.06, len: 0.16, life: range(1.5, 3), r: 2.8, g: 1.7, b: 0.6, a: 1, fadeOut: 0.5, ground: true });
      }
      // girders shed from the joints that bend most
      F.tearT -= dt;
      if (F.tearT <= 0) { F.tearT = range(0.15, 0.3); this.tear(F.th > 0.4 ? 40 : 10, F.th > 0.4 ? 230 : 80, F.th > 0.6 ? 4 : 2, -1, 6); }
      if (F.th > 1.58 && F.t > 2 && !F.settled) { F.settled = true; F.phase = 'down'; F.t = 0; g.events.push({ type: 'fallDown' }); }
    } else if (F.phase === 'down') {
      // the wreck burns along its length: fires in the lattice, black columns over the river
      const head = g.headPos;
      if (rand() < dt * 9) {
        const i = 6 + ((rand() * (NODES - 7)) | 0), P = _v.copy(R.S[i]).add(T.root.position);
        P.x += range(-8, 8); P.z += range(-6, 6); P.y += range(-4, 6);
        if (head.distanceToSquared(P) < 320 * 320) g.fx.main.spawn({ x: P.x, y: P.y, z: P.z, vx: range(-1, 1), vy: range(3, 6), vz: range(-1, 1), drag: 1.2, frameKind: 1, s0: range(3, 6), s1: range(9, 15), ease: 0.6, life: range(1.0, 1.6), rot: rand() * 6, vrot: range(-1, 1), r: 2.2, g: 1.4, b: 0.9, a: 1, fadeIn: 0.02, fadeOut: 0.6 });
      }
      F.colT = (F.colT || 0) - dt;
      if (F.colT <= 0) {
        F.colT = g.E.isQuest ? 1.4 : 0.8;
        const i = 8 + ((rand() * (NODES - 9)) | 0), P = _v.copy(R.S[i]).add(T.root.position);
        this.clouds.spawn({ x: P.x + range(-6, 6), y: P.y + 6, z: P.z + range(-6, 6), vx: range(-0.4, 0.4) + 1.3, vy: range(5, 7), vz: range(-0.4, 0.4) + 0.4, drag: 0.1, buoy: 0.3, s0: 9, s1: range(38, 52), life: range(14, 17), a: 0.9, fadeIn: 0.05, fadeOut: 0.45, vrot: range(-0.06, 0.06), r: 0.06, g: 0.055, b: 0.05, r1: 0.13, g1: 0.12, b1: 0.11, glow: 1.0, glowFade: 3 });
      }
      // a third of her lights hang on, flickering, so the wreck still reads as the Iron Lady
      T.state.light = damp(T.state.light, 0.55, 0.8, dt); T.state.beacon = Math.max(0, T.state.beacon - dt * 0.5); T.state.sparkle = 0; T.state.aviation = Math.max(0, T.state.aviation - dt);
      R.u.uPowerLo.value = 150; R.u.uFlicker.value = 0.45;
    }
    this._solveSpine(F, dt);
  }
  // forward kinematics of the spine with the ground: each node rotates by the fall angle (+ a lag toward the
  // top while it swings, + twist); nodes that would go under the ground are laid on it (the tower drapes over
  // the quays, the bridge and the river) and the legs buckle / tear their feet out to follow.
  _solveSpine(F, dt) {
    const T = this.T, R = T.rig, S = R.S, root = T.root.position, g = this.g;
    const ax = _v3.set(F.dir.z, 0, -F.dir.x).normalize();
    const axis = ax.clone();
    const prevTip = _tip.copy(S[NODES - 1]);
    S[0].set(F.dir.x * F.slide, -F.sink * 0.35, F.dir.z * F.slide);
    let hitNew = -1;
    for (let i = 0; i < NODES; i++) {
      const h = i * NODE_H;
      const hk = clamp((h - 90) / 210, 0, 1);
      const lag = F.phase === 'fall' ? -F.om * 0.22 * hk : 0;
      // the base turns less than the shaft (the legs take it), and she buckles at the first platform
      const kink = F.phase !== 'wounded' ? clamp((h - TOWER.p1.y) / 30, 0, 1) * 0.24 * clamp(F.th / 0.7, 0, 1) - clamp((h - 190) / 60, 0, 1) * 0.1 * clamp(F.th / 1.2, 0, 1) : 0;
      const phi = F.th * (0.72 + 0.28 * clamp(h / HA, 0, 1)) + kink + lag;
      _q.setFromAxisAngle(axis, phi);
      _q2.setFromAxisAngle(UP, F.twist * clamp((h - 50) / 250, 0, 1));
      _q.multiply(_q2);
      _m.makeRotationFromQuaternion(_q);
      R.R[i].setFromMatrix4(_m);
      if (i < NODES - 1) {
        const n = S[i + 1].copy(S[i]).add(_v2.set(0, NODE_H, 0).applyQuaternion(_q));
        // ground: lay it down (radius ~ the shaft half-width)
        if (h + NODE_H >= HA * 0.9) {
          const rad = W(h + NODE_H) * 0.75;
          const wx = n.x + root.x, wz = n.z + root.z, fl = towerFloor(wx, wz) + rad;
          if (n.y < fl) {
            const dy = fl - S[i].y, dh = Math.sqrt(Math.max(0.01, NODE_H * NODE_H - Math.min(dy * dy, NODE_H * NODE_H * 0.98)));
            _v2.set(n.x - S[i].x, 0, n.z - S[i].z); if (_v2.lengthSq() < 1e-6) _v2.copy(F.dir); _v2.normalize();
            n.set(S[i].x + _v2.x * dh, Math.max(fl, S[i].y + Math.max(dy, -NODE_H)), S[i].z + _v2.z * dh);
            if (!F.landed[i + 1]) { F.landed[i + 1] = true; hitNew = Math.max(hitNew, i + 1); }
            // re-orient this segment along where it actually lies
            _v2.subVectors(n, S[i]).normalize(); _q.setFromUnitVectors(UP, _v2).multiply(_q2);
            R.R[i].setFromMatrix4(_m.makeRotationFromQuaternion(_q));
          }
        }
      }
    }
    // legs: buckle where they're crushed, rip the feet out where they're stretched
    for (const L of LEGS) {
      const i = L.i, cA = 0.5 * W(HA);
      const CA = _v.set(L.sx * cA, HA, L.sz * cA);
      const Td = R._S(HA, _v2).add(_m3v.set(L.sx * cA, 0, L.sz * cA).applyMatrix3(R._R(HA, _m3)));
      const F0 = _vF.set(L.sx * LEGC(0), 0, L.sz * LEGC(0));
      const rest = CA.distanceTo(F0), now = Td.distanceTo(_vT.copy(F0).add(_vd.set(R.foot[i].x, R.foot[i].y, R.foot[i].z)));
      const c = 1 - now / rest; // + compressed, - stretched
      const out = _vd.set(L.sx, 0, L.sz).normalize();
      const crash = i === TOWER.crashLeg ? F.wound : 0;
      const bw = Math.max(0, c) * 55 + crash * 7;
      R.bow[i].set(out.x * bw + (i === TOWER.crashLeg ? F.dir.x * 4 * crash : 0), -Math.max(0, c) * 18 - crash * 5, out.z * bw);
      if (c < -0.03 && F.phase !== 'wounded') {
        // stretched: the foot tears out of its plinth and follows
        const k = clamp((-c - 0.03) * 4, 0, 0.92);
        const dT = _vT.subVectors(Td, CA);
        const wasFree = R.foot[i].w > 0.5;
        R.foot[i].set(dT.x * k, Math.max(-2, dT.y * k), dT.z * k, k > 0.05 ? 1 : 0);
        if (!wasFree && R.foot[i].w > 0.5) this._footRip(L);
      }
    }
    R.commit();
    // the top's velocity (for torn girders) and impacts
    F.vel.subVectors(S[NODES - 1], prevTip).divideScalar(Math.max(dt, 1e-4)).multiplyScalar(0.35);
    if (hitNew >= 0) this._impact(F, hitNew);
  }
  _footRip(L) {
    const g = this.g, P = new THREE.Vector3(L.x, 3, L.z);
    g.boom(P, 1.4, { radius: 9, dmg: 30, glass: false });
    for (let k = 0; k < 16; k++) g.fx.spawnDebris(P, range(-8, 8), range(6, 14), range(-8, 8), range(0.4, 1.0), chance(0.3));
    for (let k = 0; k < 6; k++) this.clouds.spawn({ x: P.x + range(-6, 6), y: 2, z: P.z + range(-6, 6), vx: range(-3, 3), vy: range(2, 5), vz: range(-3, 3), drag: 0.6, buoy: 0.2, s0: 6, s1: range(18, 26), life: range(7, 10), a: 0.9, fadeIn: 0.05, fadeOut: 0.5, vrot: range(-0.1, 0.1), r: 0.36, g: 0.33, b: 0.3, r1: 0.22, g1: 0.2, b1: 0.19 });
  }
  // a node of the falling tower hits the ground / water / bridge / buildings
  _impact(F, i) {
    const g = this.g, T = this.T, R = T.rig;
    if (F.quiet) return;
    const P = R.S[i].clone().add(T.root.position);
    const gy = groundAt(P.x, P.z), water = gy <= WATER_Y + 0.01, h = i * NODE_H;
    const big = h > 140;
    P.y = water ? WATER_Y : towerFloor(P.x, P.z);
    g.lastExplosionT = g.time; g.lastExplosionShake = clamp(1.6 - g.headPos.distanceTo(P) / 200, 0.25, 1.4);
    g.audio.play(big ? 'explosion_big' : 'metal_crash', { x: P.x, y: P.y + 3, z: P.z, volume: 1, pitch: range(0.5, 0.7) });
    g.audio.play(big ? 'collapse_impact' : 'collapse_rumble', { x: P.x, y: P.y, z: P.z, volume: 0.9 });
    if (water) {
      this.splash(P, 4.5);
      // a wall of spray thrown up both sides of the falling shaft
      for (let k = 0; k < 10; k++) this.clouds.spawn({ x: P.x + range(-14, 14), y: WATER_Y + range(2, 10), z: P.z + range(-8, 8), vx: range(-6, 6), vy: range(10, 20), vz: range(-4, 4), drag: 0.9, buoy: -2, s0: range(6, 9), s1: range(22, 32), life: range(4, 6), a: 0.75, fadeIn: 0.02, fadeOut: 0.6, vrot: range(-0.2, 0.2), r: 0.26, g: 0.28, b: 0.32, r1: 0.14, g1: 0.15, b1: 0.17 });
    } else {
      for (let k = 0; k < 8; k++) this.clouds.spawn({ x: P.x + range(-12, 12), y: P.y + range(1, 6), z: P.z + range(-8, 8), vx: range(-6, 6), vy: range(3, 8), vz: range(-6, 6), drag: 0.7, buoy: 0.15, s0: range(6, 10), s1: range(24, 36), life: range(8, 11), a: 0.92, fadeIn: 0.03, fadeOut: 0.5, vrot: range(-0.15, 0.15), r: 0.2, g: 0.18, b: 0.16, r1: 0.12, g1: 0.11, b1: 0.1, glow: 0.8, glowFade: 2 });
      for (let k = 0; k < 40; k++) g.fx.sparks.spawn({ x: P.x + range(-10, 10), y: P.y + range(0, 5), z: P.z + range(-6, 6), vx: range(-9, 9), vy: range(3, 12), vz: range(-9, 9), grav: -9.8, drag: 0.3, frame: CELL.SPARK, s0: 1, w: 0.06, len: 0.18, life: range(1, 2.5), r: 2.8, g: 1.7, b: 0.7, a: 1, fadeOut: 0.5, ground: true });
      g.fx.explosion(P.clone().setY(P.y + 2), big ? 2.4 : 1.6, { noRing: true });
    }
    // the bridge: every car on it gets crushed / cooks off in a chain
    if (Math.abs(P.x) < BRIDGE.half + 16 && Math.abs(P.z) < BRIDGE.z1 + 8) {
      for (const c of g.traffic.cars) if (c.explosive && c.root.position.distanceTo(P) < 26) { c.lastHitDir = _v.set(range(-1, 1), 0.5, range(-1, 1)).normalize().clone(); g.traffic.ignite(c, range(0.1, 1.2)); }
      if (!F.bridgeHit) { F.bridgeHit = true; g.slowmo(2.6, 0.3, true); g.events.push({ type: 'bridgeHit', P }); g.addScore(10000, 'SHE\'S DOWN!', P.clone().setY(P.y + 30), 'huge'); }
      for (const L of this.world.glowList) { const p = L._p || (L.p.isVector3 ? L.p : null); if (p && Math.abs(p.x) < BRIDGE.half + 2 && Math.abs(p.z - P.z) < 20) L.dead = true; }
    }
    if (P.z > 70 && !F.spireHit && i >= NODES - 3) { F.spireHit = true; this.megaFireball(P.clone().setY(P.y + 6), 1.8); g.events.push({ type: 'spireHit', P }); }
    if (i === NODES - 1 || F.landed.filter(Boolean).length === 3) this.tear(80, 260, 18, -1, 9);
  }
  // ?beat= jumps: put the tower straight into its final pose
  collapsedState() {
    const F = this.woundTower();
    F.phase = 'fall'; F.wound = 1; F.quiet = true;
    for (let k = 0; k < 500; k++) { F.om += 0.13 * Math.sin(Math.max(F.th, 0.06)) / 30; F.th = Math.min(1.62, F.th + F.om / 30); if (F.th >= 1.62) F.om = 0; F.slide = Math.min(16, F.slide + F.th * 0.1); F.sink = Math.min(9, F.sink + 0.05); F.twist = 0.32; F.dir.set(0.05, 0, 1).normalize(); this._solveSpine(F, 1 / 30); }
    F.landed.fill(true); F.quiet = false;
    F.phase = 'down'; F.t = 40; F.bridgeHit = F.spireHit = true;
    const S = this.T.state; S.light = 0.55; S.beacon = 0; S.sparkle = 0; S.aviation = 0;
    this.T.rig.u.uPowerLo.value = 150;
    for (const c of this.g.traffic.cars) if (Math.abs(c.root.position.x) < BRIDGE.half && Math.abs(c.root.position.z) < BRIDGE.z1) { c.state = 'wreck'; c.burn = range(20, 60); c.m.setBurnt?.(); }
    this.tear(40, 260, 60, -1, 3);
  }

  // ================================================================== SPRAY / DUST WALL down the river
  startWall() {
    if (this.wall) return;
    this.wall = { x: 40, v: 10, t: 0, spawnT: 0, reached: false };
    this.g.audio.setLoop('dust_roar', { volume: 0.6 });
    this.g.events.push({ type: 'wallStart' });
  }
  _updWall(dt) {
    const Wl = this.wall; if (!Wl) return;
    const g = this.g, head = g.headPos;
    Wl.t += dt;
    // it rubber-bands a few metres behind you while you run; once you're on the boat it falls behind
    const riding = this.escape && this.escape.state !== 'wait' && this.escape.state !== 'arrive';
    const want = riding ? Wl.x + 7 * dt : clamp(head.x - 14, Wl.x + 4 * dt, Wl.x + 16 * dt);
    Wl.x = Math.max(Wl.x + 6 * dt, want);
    if (!riding) Wl.x = Math.min(Wl.x, head.x - 7);
    // the front: spray off the river + dust off the quays, rolling, crest higher than the foot
    Wl.spawnT -= dt;
    if (Wl.spawnT <= 0) {
      Wl.spawnT = g.E.isQuest ? 0.07 : 0.04;
      const z = range(-60, 60), onRiver = Math.abs(z) < 40;
      const y = (onRiver ? WATER_Y : groundAt(Wl.x, z)) + range(0, 4);
      const crest = rand() < 0.4;
      const k = range(0.8, 1.1);
      // a low rolling front: many smaller puffs hugging the water/quay, a ragged crest, no clean cumulus
      this.clouds.spawn({ x: Wl.x + range(-5, 2), y: crest ? y + range(6, 16) : y + range(0.5, 4), z, vx: range(8, 12), vy: crest ? range(-0.5, 1.5) : range(0.3, 2), vz: range(-1.5, 1.5), drag: 0.4, buoy: 0, s0: range(4, 7), s1: range(12, 20), life: range(3.5, 5), a: 0.85, fadeIn: 0.05, fadeOut: 0.5, vrot: range(-0.4, 0.4), spray: true, r: (onRiver ? 0.11 : 0.13) * k, g: (onRiver ? 0.11 : 0.11) * k, b: (onRiver ? 0.12 : 0.09) * k, r1: 0.07, g1: 0.065, b1: 0.06, glow: 0.12, glowFade: 1.5 });
      // spray sheets and grit streaking ahead of it
      if (rand() < 0.6) g.fx.main.spawn({ x: Wl.x + range(0, 6), y: y + range(0.3, 3), z: z * 0.8, vx: range(10, 16), vy: range(0, 2), vz: range(-1, 1), drag: 0.8, frame: CELL.WISP, s0: 1.5, s1: range(5, 9), life: range(1.2, 2), rot: rand() * 6, r: 0.3, g: 0.31, b: 0.33, a: 0.45, fadeIn: 0.05, fadeOut: 0.5 });
    }
    const d = head.x - Wl.x;
    g.fogMix.k = damp(g.fogMix.k, clamp(1 - (d - 3) / 18, 0, 0.85) * (riding ? 0.4 : 1), 1.5, dt);
    g.fogMix.color.setRGB(0.24, 0.23, 0.24);
    g.audio.setLoop('dust_roar', { x: Wl.x, y: 0, z: head.z, volume: clamp(1 - d / 80, 0.3, 1) });
    if (d < 9 && !riding) g.hurt(dt * 6, new THREE.Vector3(Wl.x, head.y, head.z));
  }

  // ================================================================== THE GETAWAY BOAT
  callBoat() {
    if (this.escape) return this.escape;
    const g = this.g, mod = this.world.mods.boatsM;
    let m = null;
    try { m = mod?.buildBoat?.('speedboat', { seed: 9 }); } catch (e) { console.warn('speedboat', e); }
    if (!m) {
      const root = new THREE.Group(), hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 8.5), new THREE.MeshStandardMaterial({ color: 0x5a2c16, roughness: 0.3, metalness: 0.1 })); hull.position.y = 0.3; root.add(hull);
      m = { root, anchors: { seat: { x: -0.5, y: 0.75, z: -0.8 }, stand: { x: 0, y: 0.95, z: 1.6 }, wake: { x: 0, y: 0, z: 4.4 } } };
    }
    m.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.scene.add(m.root);
    const v3 = (a) => (Array.isArray(a) ? new THREE.Vector3(...a) : new THREE.Vector3(a.x, a.y, a.z));
    const E = this.escape = { m, root: m.root, state: 'arrive', t: 0, x: BOAT_DOCK.x + 160, z: BOAT_DOCK.z, yaw: Math.PI / 2, v: 18, stand: v3(m.anchors.stand), seat: v3(m.anchors.seat), wake: v3(m.anchors.wake || { x: 0, y: 0, z: 4 }), vel: new THREE.Vector3() };
    // the driver at the wheel
    try {
      const d = new Driver({ seed: 3 });
      d.root.position.copy(E.seat); d.root.position.y -= 0.42;
      m.root.add(d.root); E.driver = d; E.dst = { steer: 0, bump: 0, talking: false, lookBack: 0, flinch: 0, time: 0 };
    } catch (e) { console.warn('driver', e); }
    g.audio.play('ship_horn', { x: E.x, y: 0, z: E.z, volume: 1, pitch: 1.3 });
    return E;
  }
  canBoard() { const E = this.escape; return E && E.state === 'wait'; }
  board() {
    const E = this.escape, g = this.g;
    if (!E || E.state !== 'wait') return;
    E.state = 'board'; E.t = 0;
    g.loco.enabled = false;
    if (g.player.mode === 'vr') g.hud.black.material.opacity = 1; else { g.player.camDip = 0.6; g.player.camDipRate = 1.6; }
    g.audio.play('body_fall', { volume: 0.8 });
    g.events.push({ type: 'boarded' });
  }
  _updEscape(dt) {
    const E = this.escape; if (!E) return;
    const g = this.g;
    E.t += dt;
    if (E.state === 'arrive') {
      const remain = E.x - BOAT_DOCK.x;
      E.v = remain > 30 ? 18 : Math.max(0, remain * 0.6);
      E.x -= E.v * dt;
      if (remain < 0.3) { E.state = 'wait'; E.v = 0; g.events.push({ type: 'boatHere' }); }
    } else if (E.state === 'wait') {
      E.v = 0;
    } else if (E.state === 'board') {
      if (E.t > 0.5) { E.state = 'turn'; E.t = 0; g.hud.black.material.opacity = 0; }
    } else if (E.state === 'turn') {
      // a power turn away from the quay, spray everywhere, then flat out down the river
      E.yaw = lerp(Math.PI / 2, -Math.PI / 2, THREE.MathUtils.smoothstep(E.t, 0, 2.4));
      E.v = 6 + E.t * 3; E.z = BOAT_DOCK.z + Math.sin(clamp(E.t / 2.4, 0, 1) * Math.PI) * 8;
      if (E.t > 2.4) { E.state = 'run'; E.t = 0; g.events.push({ type: 'rideStart' }); }
    } else if (E.state === 'run') {
      E.v = Math.min(26, E.v + dt * 6);
      E.x += E.v * dt;
      E.z = damp(E.z, -24, 0.4, dt);
    }
    E.vel.set(-Math.sin(E.yaw), 0, -Math.cos(E.yaw)).multiplyScalar(E.v);
    const bob = Math.sin(g.time * 2.3) * 0.05 + (E.state === 'run' ? Math.sin(g.time * 7) * 0.03 : 0);
    E.root.position.set(E.x, WATER_Y + bob, E.z);
    E.root.rotation.set(E.state === 'run' ? -0.06 : 0, E.yaw, E.state === 'turn' ? -0.18 : Math.sin(g.time * 1.7) * 0.02, 'YXZ');
    E.root.updateMatrixWorld(true);
    // wake: white water off the stern, spray sheets in the turn
    const k = clamp(E.v / 20, 0, 1);
    if (k > 0.1 && rand() < dt * 40 * k) {
      const p = _v2.copy(E.wake).applyMatrix4(E.root.matrixWorld);
      g.fx.main.spawn({ x: p.x + range(-0.6, 0.6), y: WATER_Y + 0.3, z: p.z + range(-0.6, 0.6), vx: -E.vel.x * 0.3 + range(-1.5, 1.5), vy: range(1, 3) * k, vz: -E.vel.z * 0.3 + range(-1.5, 1.5), grav: 6, drag: 0.8, frame: CELL.WISP, s0: 0.6, s1: range(2.5, 4) * k + 1, life: range(1, 1.8), rot: rand() * 6, r: 0.7, g: 0.74, b: 0.78, a: 0.5, fadeOut: 0.5 });
    }
    if (E.driver) { E.dst.time += dt; E.dst.talking = !!g.hud.subT && g.hud.subT > 0; E.dst.steer = E.state === 'turn' ? 0.8 : 0; E.driver.update(dt, E.dst); }
    g.audio.setLoop('truck', { volume: 0.5 + 0.4 * k, intensity: 0.3 + 0.7 * k });
    if (this.riding) g.audio.setLoop('wind', { volume: 0.2 + 0.7 * k, intensity: k });
  }
  get riding() { const E = this.escape; return !!E && (E.state === 'board' || E.state === 'turn' || E.state === 'run'); }
  // after the player moved: the rig rides the boat
  afterPlayer(rdt, dt) {
    if (!this.riding) return;
    const E = this.escape, g = this.g;
    const p = _v.copy(E.stand).applyMatrix4(E.root.matrixWorld);
    g.rig.position.set(p.x, p.y, p.z);
    g.rig.updateMatrixWorld(true);
  }
  casingFloor(x, z) { return groundAt(x, z); }
}
const _tip = new THREE.Vector3(), _m3 = new THREE.Matrix3(), _m3v = new THREE.Vector3(), _vF = new THREE.Vector3(), _vT = new THREE.Vector3(), _vd = new THREE.Vector3();
