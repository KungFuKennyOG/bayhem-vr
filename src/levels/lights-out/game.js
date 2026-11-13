import * as THREE from 'three';
import { rand, range, pick, chance, clamp, lerp, damp } from '../../rng.js';
import { Ragdoll } from '../../characters.js';
import { CELL } from '../../particles.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { applyDusk, setSunElevation, fogShared, rimShared } from '../../atmosphere.js';
import { Soldier, buildCoverPoints } from './ai.js';
import { GlassSystem } from '../downtown-haven/glass.js';
import { LaserFX } from '../downtown-haven/snipers.js';
import { RifleLasers } from '../tokyo-scramble/lasers.js';
import { DustClouds } from '../downtown-haven/dustfx.js';
import { Birds } from '../downtown-haven/birds.js';
import { Traffic } from './traffic.js';
import { SKY } from './sky.js';
import { POWER, HFOG } from './kit.js';
import { START, groundAt, PLZ, Y } from './layout.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
// the sun has set in the south-south-west (the afterglow sits under the cloud deck over the river)
export const SUN_AZ = new THREE.Vector3(-0.32, 0, 0.95).normalize();
export const sunElevation = (n) => -1.5 - n * 6;
const C = (r, g, b) => new THREE.Color(r, g, b);
const L3 = (a, b, t) => a.clone().lerp(b, t);
// night 0 = dusk (blue hour, afterglow) .. 1 = night; glow = the city's power (1 lit .. 0 blackout); fire = what burns
export function applyLook(night, glow, fire, { sun, hemi, fog, renderer, scene }) {
  night = clamp(night, 0, 1); glow = clamp(glow, 0, 1); fire = clamp(fire, 0, 1);
  applyDusk(1, { sun, hemi, fog, renderer });
  SKY.night.value = night; SKY.glow.value = glow; SKY.fire.value = fire;
  POWER.night.value = night;
  // the key: a warm dusk afterglow fading into a cool, weak moon behind the deck
  // (blue hour, not sunset: the last light is a soft rose on the tops, the city's own light does the rest)
  sun.color.copy(L3(C(0.95, 0.62, 0.55), C(0.55, 0.62, 0.9), night)); sun.intensity = lerp(0.75, 0.3 + 0.34 * (1 - glow), night);   // with the city dark the moon carries the key (blue rim on everything)
  // the fill: a grey-violet sky over a ground lit by the city (gold) — or by fire after the blackout
  hemi.color.copy(L3(C(0.5, 0.52, 0.72), C(0.34, 0.4, 0.6), night));   // the moon is the sky at night: up-facing surfaces (roads, decks) take it
  hemi.groundColor.copy(L3(C(0.42, 0.3, 0.26), C(0.36, 0.22, 0.12).multiplyScalar(0.4 + 0.6 * glow), night)).add(C(0.3, 0.09, 0.02).multiplyScalar(fire * night));
  hemi.intensity = lerp(0.8, 0.78, night);   // never a black void underfoot: with the city dark the sky and the moon still fill   // blackout: the towers go to silhouettes against the sky
  // fog: wet violet haze at dusk, blue-black by night, the city's sodium in it, then fire
  // (grey-green river murk, sodium in it — not a pink glamour haze)
  fog.color.copy(L3(C(0.3, 0.29, 0.3), C(0.072, 0.082, 0.08), night)).add(C(0.06, 0.042, 0.018).multiplyScalar(glow * night)).add(C(0.06, 0.02, 0.0).multiplyScalar(fire * night));
  // the engine's fog mixes in display space: lift it toward the sky's horizon glow so distance reads as haze (fog
  // city), not as towers going black against a bright horizon
  // ...but in the blackout the haze has nothing to glow with: it goes dark and the towers stand as silhouettes against the
  // fire-lit sky (reviewers kept reading the pale grey fog on dark towers as 'the city is still lit')
  fog.color.multiplyScalar(lerp(1.25, 1.9, night) * lerp(1, 0.3, (1 - glow) * night));
  // ...and darker and bluer than the sky's horizon, so the far ranks are dark shapes against it, never pale grey boxes
  fog.color.lerp(C(0.028, 0.032, 0.05), 0.8 * (1 - glow) * night);
  // the gorge mist (height fog): the same haze, a touch brighter and warmer where the city lights it
  HFOG.c.value.copy(fog.color).multiplyScalar(1.1).add(C(0.05, 0.03, 0.01).multiplyScalar(glow * night));
  HFOG.p.value.x = lerp(0.0022, 0.0032, night);
  fogShared.sunColor.r = lerp(0.85, 0.12, night); fogShared.sunColor.g = lerp(0.42, 0.1, night); fogShared.sunColor.b = lerp(0.3, 0.12, night);
  rimShared.color.r = lerp(0.6, 0.3, night) + fire * 0.3; rimShared.color.g = lerp(0.42, 0.32, night) + fire * 0.08; rimShared.color.b = lerp(0.45, 0.5, night);
  POWER.dim.value = lerp(1, 0.2, (1 - glow) * night);
  renderer.toneMappingExposure = lerp(1.05, 1.2, night);
  if (scene) scene.environmentIntensity = lerp(0.75, 0.55, night) * (0.35 + 0.65 * glow);
}

function raySphere(o, d, c, r) {
  _v3.subVectors(o, c);
  const b = _v3.dot(d), cc = _v3.lengthSq() - r * r;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}

// =====================================================================================
//  LIGHTS OUT — combat sandbox (from Levels 5 / 6 / 7): soldiers on multi-level ground (cover,
//  flanking, perch gunmen on the decks / flyovers / the arch, rooftop snipers with lasers),
//  rifle-mounted lasers (in the fog they are how you find the man), explosive traffic, breakable
//  shop glass, scoring, slow-mo. Set pieces (the pancake, the blackout, the tower, the glide)
//  live in setpieces.js.
// =====================================================================================
export class LightsGame {
  constructor(E, world) {
    this.autoRigYaw = true;   // the glide turns the rig: autopilot aim is rig-relative (player.js)
    Object.assign(this, { scene: E.scene, fx: E.fx, hud: E.hud, audio: E.audio, rig: E.rig, camera: E.camera, params: E.params, world, E });
    this.col = world.col;
    this.trailer = E.params.has('trailer');
    this.soldiers = []; this.grenades = []; this.nades = []; this.ragdolls = []; this.props = []; this.targets = [];
    this.time = 0; this.timeScale = 1; this.slowT = 0; this.slowCool = 0; this.slowScale = 1;
    this.score = 0; this.kills = 0; this.headshots = 0; this.carsBlown = 0; this.panesBroken = 0; this.snipersDown = 0; this.lightsOut = 0; this.jumpersDown = 0; this.combo = 0; this.comboT = 0;
    this.hp = 100; this.hurtT = 9; this.hurtFlash = 0; this.downed = false;
    this.headPos = new THREE.Vector3(START.x, START.y + 1.65, START.z);
    this.playerFwd = new THREE.Vector3(0, 0, -1);
    this.lastExplosionT = -10; this.lastExplosionShake = 0.8;
    this.recentExplosions = [];
    this.nadeCool = 7;
    this.night = 0.12; this.glow = 1; this.fire = 0;
    this.events = [];
    this.bossInfo = null;
    this.fogMix = { k: 0, color: new THREE.Color(0.22, 0.17, 0.13), near: 4, far: 80 };
    this._fog0 = { near: E.scene.fog.near, far: E.scene.fog.far, color: new THREE.Color() };
    this.fx.onSound = (n, p) => this.audio.play(n, p ? { x: p.x, y: p.y, z: p.z } : {});
    this.fx.setGround(world.fastGround);
    Ragdoll.world = this.col;
    this._initHoles();
    this.glass = new GlassSystem(this, world.panes);
    // night glass: see the lit shops through it, only a faint reflection of the street
    this.glass.mat.envMapIntensity = 0.55; this.glass.mat.opacity = 0.26; this.glass.mat.metalness = 0.6; this.glass.mat.color.set(0x3a4850);
    this.traffic = new Traffic(this, world.carMod, world.fallbackCar);
    // laser sights: a beam ends a few metres past what it is aimed at and stops on the ground, the steps and the banks
    // (none of those are in the collision world: the beams used to run on through the flights and across the river)
    this.beamOver = { rifle: 4, sniper: 18 };
    this.lasers = new LaserFX(this);
    this.rifleLasers = new RifleLasers(this);
    this.clouds = new DustClouds(E.scene, E.scene.fog, { max: E.isQuest ? 170 : 320, soft: 0.7 });
    this.dustDome = new THREE.Mesh(new THREE.SphereGeometry(2000, 24, 12), new THREE.MeshBasicMaterial({ color: 0x3a3028, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.dustDome.renderOrder = -99; this.dustDome.frustumCulled = false; this.dustDome.visible = false;
    E.scene.add(this.dustDome);
    // pigeons along the promenade rail (they go up with the first shot)
    { const spots = []; const r = (a, b) => a + rand() * (b - a);
      for (let i = 0; i < 26; i++) { const x = r(PLZ.x1 + 4, PLZ.x1 + 60), z = r(422, 425.5); spots.push(new THREE.Vector3(x, Y, z)); }
      this.birds = new Birds(this, spots); }
    world.buildNav();
    this.glass.blockNav?.(world.nav);
    this.cover = buildCoverPoints(this.col, world.nav, groundAt);
    for (const c of this.cover) c.p.y = groundAt(c.p.x, c.p.z);
    this.smokeColumns = world.named.smokeColumns || [];
  }

  // ---------------------------------------------------------------- bullet holes (instanced decals on world surfaces)
  _initHoles() {
    const g = new THREE.PlaneGeometry(0.11, 0.11);
    const m = new THREE.MeshBasicMaterial({ map: holeTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, color: 0xffffff });
    this.holes = new THREE.InstancedMesh(g, m, 400); this.holes.count = 0; this.holes.frustumCulled = false; this.holes.renderOrder = 4;
    this.scene.add(this.holes); this.holeN = 0;
  }
  addHole(p, n) {
    _q.setFromUnitVectors(_v.set(0, 0, 1), n);
    _m.compose(_v2.copy(p).addScaledVector(n, 0.012), _q, _v3.setScalar(0.7 + rand() * 0.7));
    this.holes.setMatrixAt(this.holeN % 400, _m); this.holeN++;
    this.holes.count = Math.min(400, this.holeN); this.holes.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- spawning
  spawnSoldier(o) {
    const s = new Soldier(this, o);
    s.root.traverse((m) => { if (m.isMesh && !m.isSkinnedMesh) m.castShadow = false; });
    this.soldiers.push(s);
    return s;
  }
  clipBeam(a, d, len) {
    const G = this.world.fastGround;
    const under = (t) => a.y + d.y * t < G(a.x + d.x * t, a.z + d.z * t) - 0.02;
    let prev = 0;
    for (let t = 0.8; t < len + 0.8; t += 0.8) {
      const tt = Math.min(t, len);
      if (under(tt)) { let lo = prev, hi = tt; for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (under(m)) hi = m; else lo = m; } return lo; }
      prev = tt;
    }
    return len;
  }
  enemiesAlive(filter) { return this.soldiers.filter(s => s.alive && (!filter || filter(s))).length; }

  panesAlong(o, d, maxT) {
    const out = [], seen = new Set();
    for (let k = 0; k < 4; k++) {
      const h = this.col.raycast(o, d, maxT, (b) => b.data.kind !== 'glass' || seen.has(b));
      if (!h) break;
      seen.add(h.box); out.push({ p: h.box.data.ref, t: h.t });
    }
    return out;
  }

  // ---------------------------------------------------------------- player weapons
  fireRay(origin, dir) {
    let best = { t: 300, kind: 'none' };
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const gm = s.gm;
      if (s.pos.distanceToSquared(origin) > 300 * 300) continue;
      gm.headCenter.getWorldPosition(_v);
      let t = raySphere(origin, dir, _v, s.hitR ? 0.24 : 0.17); if (t > 0 && t < best.t) best = { t, kind: 'head', s };
      gm.chestCenter.getWorldPosition(_v);
      t = raySphere(origin, dir, _v, s.hitR ? 0.42 : 0.3); if (t > 0 && t < best.t) best = { t, kind: 'body', s };
      gm.bones[0].getWorldPosition(_v); _v.y -= 0.05;
      t = raySphere(origin, dir, _v, 0.24); if (t > 0 && t < best.t) best = { t, kind: 'body', s };
      gm.bones[14].getWorldPosition(_v); t = raySphere(origin, dir, _v, 0.14); if (t > 0 && t < best.t) best = { t, kind: 'leg', s };
      gm.bones[17].getWorldPosition(_v); t = raySphere(origin, dir, _v, 0.14); if (t > 0 && t < best.t) best = { t, kind: 'leg', s };
    }
    for (const tg of this.targets) {
      if (!tg.active()) continue;
      const t = tg.ray(origin, dir);
      if (t > 0 && t < best.t) best = { t, kind: 'target', target: tg };
    }
    const hit = this.col.raycast(origin, dir, best.t, (b) => b.data.noBullet || b.data.kind === 'glass');
    if (hit) {
      const d = hit.box.data;
      best = { t: hit.t, kind: d.kind === 'car' ? 'car' : 'world', box: hit.box, normal: hit.normal, mat: d.mat };
    }
    if (best.kind === 'none' && dir.y < 0) {
      // the floor under the ray: march down to whatever level it lands on
      for (let t = 0.5; t < best.t; t += 0.5) {
        const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
        if (py <= this.world.fastGround(px, pz)) { best = { t, kind: 'ground', normal: UP }; break; }
      }
    }
    best.point = origin.clone().addScaledVector(dir, best.t);
    best.panes = this.panesAlong(origin, dir, best.t);
    return best;
  }

  playerShot(origin, dir) {
    this.birds.spook(this.headPos, 0.5);
    const hit = this.fireRay(origin, dir);
    const P = hit.point;
    this.fx.tracer(origin, P, { speed: 520, width: 0.04, len: 5 });
    for (const { p, t } of hit.panes) { const Pp = origin.clone().addScaledVector(dir, t); if (this.glass.hit(p, Pp, dir, 1)) { this.panesBroken++; if (this.panesBroken % 12 === 0) this.addScore(50, null); } }
    switch (hit.kind) {
      case 'head': case 'body': case 'leg': {
        const s = hit.s;
        this.fx.impact(P, _v.copy(dir).negate(), 'body');
        this.audio.play('impact_flesh', { x: P.x, y: P.y, z: P.z, volume: 0.8 });
        this.hitMarker(hit.kind === 'head');
        if (s.hit(dir, hit.kind)) this.killSoldier(s, dir, hit.kind === 'head' ? 1.3 : 1, hit.kind === 'head', s.role === 'sniper' ? (hit.kind === 'head' ? 'COUNTER-SNIPE!' : 'SNIPER DOWN') : null);
        break;
      }
      case 'car': {
        const c = hit.box.data.ref;
        this.fx.impact(P, hit.normal, 'metal');
        c.lastHitDir = dir.clone();
        this.traffic.damage(c, 1, P);
        if (c.explosive) this.hitMarker(false);
        break;
      }
      case 'world': this.worldImpact(P, hit.normal, hit.mat, true); if (hit.box.data.onHit) hit.box.data.onHit(P, dir); break;
      case 'target': hit.target.hit(P, dir); break;
      case 'ground': this.fx.impact(P, UP, 'ground'); break;
    }
    return hit;
  }
  worldImpact(P, n, mat, loud = false) {
    if (mat === 'glass') {
      this.fx.impact(P, n, 'glass');
      this.addHole(P, n);
      if (loud) this.audio.play('impact_glass', { x: P.x, y: P.y, z: P.z, volume: 0.5 });
    } else if (mat === 'concrete' || mat === 'stone' || mat === 'wood') {
      this.fx.impact(P, n, 'ground');
      this.addHole(P, n);
      this.fx.main.spawn({ x: P.x, y: P.y, z: P.z, vx: n.x * 1.5, vy: 0.4, vz: n.z * 1.5, drag: 3, frame: CELL.DUST, s0: 0.15, s1: 0.8, life: 0.7, rot: rand() * 6, r: 0.7, g: 0.66, b: 0.6, a: 0.6, fadeOut: 0.4 });
      if (loud) this.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.45, pitch: 0.6 });
    } else {
      this.fx.impact(P, n, 'metal');
      if (mat !== 'fence') this.addHole(P, n);
      if (loud) this.audio.play('impact_metal', { x: P.x, y: P.y, z: P.z, volume: 0.55 });
    }
  }

  launchGrenade(origin, dir) {
    const g = { pos: origin.clone(), vel: dir.clone().multiplyScalar(55), life: 4, armed: 0 };
    if (this.rigVel) g.vel.add(this.rigVel);
    g.vel.y += 1.2;
    this.grenades.push(g);
  }
  hitMarker(big) { this.hud.hitMarker(big); this.audio.play('hit_marker', { volume: big ? 1 : 0.6 }); }
  addScore(n, label, pos, style) {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 3.5;
    const mult = Math.min(5, this.combo);
    this.score += n * mult;
    if (label && pos && !this.quietScore) this.hud.callout(label, pos, style || 'big', mult > 1 ? `+${n * mult}  x${mult}` : `+${n}`);
  }
  callout(text, pos, style = 'big', sub = null) { this.hud.callout(text, pos, style, sub); }

  killSoldier(s, dir, power = 1, head = false, label = null) {
    if (!s.alive) return;
    this.kills++;
    if (head) this.headshots++;
    if (s.role === 'sniper') this.snipersDown++;
    this.audio.play('kill_confirm', {});
    s.gm.chestCenter.getWorldPosition(_v);
    const P = _v.clone();
    this.addScore(s.role === 'sniper' ? 250 : head ? 150 : 100, label || (head ? 'HEADSHOT' : null), P.clone().setY(P.y + 1.1), s.role === 'sniper' ? 'big' : 'small');
    if (s.onDie) { s.onDie(dir, power); this.events.push({ type: 'kill', s }); return; }
    const rd = s.die(dir, power, this.scene);
    this.ragdolls.push({ rd, thud: 0, s, fall: s.role === 'sniper' || s.role === 'perch' ? 1 : 0 });
    this.events.push({ type: 'kill', s });
    if (this.ragdolls.length > 26) { const old = this.ragdolls.shift(); old.rd.dispose(); }
  }

  // ---------------------------------------------------------------- explosions
  smokeAfter(P, size = 1, lift = 0) {
    const x = P.x, y = P.y, z = P.z, n = Math.round(2 + size * 1.5);
    for (let i = 0; i < n; i++) this.fx.later(0.12 + i * 0.12, () => {
      const s0 = range(2.4, 3.6) * size, low = i === 0;
      this.clouds.spawn({ x: x + range(-2.2, 2.2) * size, y: y + (low ? 0.4 : range(1.5, 3.5)) * size + lift * 6, z: z + range(-2.2, 2.2) * size, vx: range(-2, 2) + 0.5, vy: (low ? range(0.5, 1.5) : range(2, 4)) * Math.sqrt(size) + lift * 7, vz: range(-2, 2), drag: 0.8 - lift * 0.4, buoy: 0.3, s0, s1: s0 * range(3, 4.2) * (1 - 0.3 * lift), life: range(5, 7), a: 0.8, fadeIn: 0.05, fadeOut: 0.55, vrot: range(-0.3, 0.3), r: 0.06, g: 0.05, b: 0.045, r1: 0.11, g1: 0.1, b1: 0.09, glow: 1.4, glowFade: 3 });
    });
  }
  boom(P, size = 1, { radius = 7, dmg = 60, src = null, car = false, noRing = false, shake = null, player = true, glass = true, lift = 0 } = {}) {
    this.fx.explosion(P, size, { noRing });
    this.smokeAfter(P, size, lift);
    this.recentExplosions.push(this.time);
    this.lastExplosionT = this.time;
    const dp = this.headPos.distanceTo(P);
    this.lastExplosionShake = shake ?? clamp(1.4 * size * (1 - dp / 60), 0.15, 1.6);
    this.haptic(Math.min(1, size * 0.8), 160);
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = s.pos.distanceTo(P) - (s.role === 'sniper' ? 2 : 0);
      if (d < radius) {
        _v.subVectors(s.pos, P).setY(0).normalize().add(_v2.set(0, 0.9, 0)).normalize();
        this.killSoldier(s, _v.clone(), 2.2 + (1 - d / radius) * 2.5, false, d < radius * 0.6 ? pick(['KABOOM!', 'AIRBORNE!', 'SPICY!', 'HOTPOT!']) : null);
      } else if (d < radius * 1.6) s.gm.hit(_v.subVectors(s.pos, P).normalize());
    }
    for (const c of this.traffic.cars) {
      if (c === src || !c.explosive) continue;
      const d = this.traffic.worldCenter(c, _v).distanceTo(P) - c.half.z * 0.5;
      if (d < radius * 0.55) { c.lastHitDir = _v2.subVectors(_v, P).normalize().clone(); this.traffic.damage(c, 999, P, 'blast'); }
      else if (d < radius * 1.2) { c.lastHitDir = _v2.subVectors(_v, P).normalize().clone(); this.traffic.damage(c, Math.round(10 * (1 - d / (radius * 1.2)) + 2), P, 'near'); }
    }
    if (glass) this.glass.blast(P, radius * 1.4, size);
    for (const r of this.ragdolls) {
      const rd = r.rd; if (rd.disposed) continue;
      const d = rd.position.distanceTo(P);
      if (d < radius * 1.5) { rd.asleep = false; rd.still = 0; const k = (1 - d / (radius * 1.5)) * 9; const x = rd.x, v = rd.v; for (let i = 0; i < rd.np; i++) { const j = i * 3; _v.set(x[j] - P.x, x[j + 1] - P.y + 1.2, x[j + 2] - P.z).normalize(); v[j] += _v.x * k; v[j + 1] += _v.y * k + 2; v[j + 2] += _v.z * k; } }
    }
    for (const tg of this.targets) if (tg.active() && tg.blast) tg.blast(P, radius, dmg);
    if (player && dp < radius * 0.75) this.hurt(Math.min(45, dmg * (1 - dp / (radius * 0.75))), P);
    if (dp < 10) this.audio.play('ear_ring', { volume: 0.4 });
    const multi = this.recentExplosions.filter(t => this.time - t < 1.4).length >= 3;
    if (multi && this.slowCool <= 0) { this.slowmo(1.4, 0.3); this.callout('CHAIN REACTION!', P.clone().setY(P.y + 4), 'big'); }
    else if (car && dp < 16 && chance(0.5)) this.slowmo(1.0, 0.33);
    this.events.push({ type: 'boom', P: P.clone(), size });
  }

  hurt(amount, from, label = null) {
    if (this.god) return;
    if (this.trailer) amount *= 0.25;
    this.hp -= amount; this.hurtT = 0; this.hurtFlash = Math.min(1, this.hurtFlash + amount / 25);
    this.audio.play('player_hurt', { volume: Math.min(1, amount / 20) });
    this.haptic(0.8, 80);
    if (this.hp <= 0 && !this.downed) {
      this.downed = true; this.hp = 1;
      this.slowmo(1.6, 0.25, true);
      if (this.radio) this.radio.say(pick(['Get up! Last city, last fight — you do not get to quit here!', 'Breathe! Shoot back! In that order!', 'Not in the final level. Not on my watch. Up!']), 3.5, { pri: 'urgent', ttl: 2 });
      else this.hud.subtitle('DRIVER', pick(['Get up! Last city, last fight — you do not get to quit here!', 'Breathe! Shoot back! In that order!', 'Not in the final level. Not on my watch. Up!']), 3.5);
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
  _round(from, target, owner, opts = {}) {
    _v3.subVectors(target, from); const L = _v3.length(); _v3.divideScalar(L);
    const dir = _v3.clone();
    const far = this.col.raycast(from, dir, L + 40, b => b.data.noBullet || b.data.kind === 'glass' || b.data.ref === owner);
    let tEnd = far ? far.t : L + 40, gnd = false;
    if (dir.y < 0) { for (let t = 1; t < tEnd; t += 1) { const px = from.x + dir.x * t, py = from.y + dir.y * t, pz = from.z + dir.z * t; if (py <= this.world.fastGround(px, pz)) { tEnd = t; gnd = true; break; } } }
    const end = from.clone().addScaledVector(dir, tEnd);
    const spd = opts.speed || 330;
    this.fx.tracer(from, end, { speed: spd, color: opts.color || [1.8, 0.5, 0.25], width: opts.width || 0.05, len: opts.len || 4 });
    for (const { p, t } of this.panesAlong(from, dir, tEnd)) { const Pp = from.clone().addScaledVector(dir, t); this.fx.later(t / spd, () => this.glass.hit(p, Pp, dir, 2)); }
    const box = far && !gnd ? far.box : null, n = box ? far.normal.clone() : UP;
    this.fx.later(tEnd / spd, () => {
      if (box && box.data.kind === 'car') { this.fx.impact(end, n, 'metal'); box.data.ref.lastHitDir = dir; this.traffic.damage(box.data.ref, opts.carDmg ?? 1, end); }
      else if (box) this.worldImpact(end, n, box.data.mat, end.distanceTo(this.headPos) < 9);
      else this.fx.impact(end, UP, 'ground');
    });
    return { end, dir, tEnd };
  }
  enemyShot(s, dist) {
    const mz = s.gm.muzzle.getWorldPosition(new THREE.Vector3());
    _v.subVectors(this.headPos, mz).normalize();
    this.fx.muzzle(mz, _v, 'enemy', false);
    if (this.fx.lights.some(l => l.userData.life <= 0)) this.fx.light(mz, 6, 0.05, 0xffb060, true, 7);
    this.audio.play('enemy_gun', { x: mz.x, y: mz.y, z: mz.z, volume: 0.85 });
    const moving = this.playerSpeed || 0;
    const d3 = mz.distanceTo(this.headPos);
    let hitChance = clamp(0.16 - d3 * 0.0028, 0.03, 0.16) * (moving > 2 ? 0.55 : 1) * (this.trailer ? 0.55 : 1) * (s.role === 'rusher' ? 0.7 : 1) * (this.hitMul ?? 1) * (s.hitMul ?? 1);
    const target = this.headPos.clone();
    if (rand() < hitChance) {
      target.y -= 0.45;
      this.fx.tracer(mz, target, { speed: 330, color: [1.8, 0.5, 0.25], width: 0.05, len: 4 });
      for (const { p, t } of this.panesAlong(mz, _v2.subVectors(target, mz).normalize(), mz.distanceTo(target))) this.glass.hit(p, mz.clone().addScaledVector(_v2, t), _v2, 2);
      this.fx.later(d3 / 330, () => this.hurt(7, mz));
    } else {
      target.add(_v2.set(range(-1.3, 1.3), range(-0.9, 1.2), range(-1.3, 1.3)));
      const { dir, tEnd } = this._round(mz, target, s);
      const closest = _v2.subVectors(this.headPos, mz).dot(dir);
      const cp = mz.clone().addScaledVector(dir, closest);
      if (closest < tEnd && cp.distanceTo(this.headPos) < 1.8 && rand() < 0.55) this.fx.later(closest / 330, () => this.audio.play('whiz', { x: cp.x, y: cp.y, z: cp.z }));
    }
  }
  sniperShot(s) {
    const mz = s.gm.muzzle.getWorldPosition(new THREE.Vector3());
    s.gm.fire();
    _v.subVectors(this.headPos, mz).normalize();
    this.fx.muzzle(mz, _v, 'launcher', false);
    this.fx.light(mz, 40, 0.08, 0xffc080, true, 18);
    this.fx.main.spawn({ x: mz.x, y: mz.y, z: mz.z, frame: CELL.FLASH, s0: 1.2, s1: 2.4, life: 0.09, r: 3, g: 2.4, b: 1.6, fadeIn: 0, fadeOut: 0.3 });
    for (let i = 0; i < 4; i++) this.fx.main.spawn({ x: mz.x, y: mz.y, z: mz.z, vx: _v.x * range(2, 6) + range(-0.5, 0.5), vy: range(0, 0.8), vz: _v.z * range(2, 6) + range(-0.5, 0.5), drag: 3, frame: CELL.WISP, s0: 0.3, s1: 1.6, life: 1.2, rot: rand() * 6, r: 0.6, g: 0.6, b: 0.62, a: 0.4, fadeOut: 0.4 });
    this.audio.play('sniper_shot', { x: mz.x, y: mz.y, z: mz.z, volume: 1 });
    const dist = mz.distanceTo(this.headPos);
    const moving = (this.playerSpeed || 0) > 3.6;
    const hit = s.los && rand() < (this.trailer ? 0.35 : moving ? 0.4 : 0.8);
    if (hit) {
      const tgt = this.headPos.clone().add(_v2.set(0, -0.35, 0));
      this.fx.tracer(mz, tgt, { speed: 900, color: [2.2, 0.85, 0.32], width: 0.06, len: 6 });
      for (const { p, t } of this.panesAlong(mz, _v, dist)) this.glass.hit(p, mz.clone().addScaledVector(_v, t), _v, 3);
      this.fx.later(dist / 900, () => { this.hurt(34, mz); this.callout('SNIPER!', this.headPos.clone().addScaledVector(this.playerFwd, 3).setY(this.headPos.y + 0.6), 'small'); });
    } else {
      const tgt = this.headPos.clone().add(_v2.set(range(-1.4, 1.4), range(-1.6, -0.6), range(-1.4, 1.4)));
      const { dir, tEnd } = this._round(mz, tgt, s, { speed: 900, color: [2.4, 1.6, 1.0], width: 0.07, len: 9, carDmg: 4 });
      const closest = _v2.subVectors(this.headPos, mz).dot(dir);
      const cp = mz.clone().addScaledVector(dir, closest);
      if (closest < tEnd) this.fx.later(closest / 900, () => this.audio.play('whiz', { x: cp.x, y: cp.y, z: cp.z, volume: 1, pitch: 0.8 }));
    }
    this.events.push({ type: 'sniperShot', s, hit });
  }
  enemyGrenade(s) {
    if (this.noNades > 0) return;
    s.gm.bones[8].getWorldPosition(_v);
    const P = _v.clone();
    const T = this.headPos.clone(); T.y = this.world.fastGround(T.x, T.z);
    T.x += range(-1.8, 1.8) + (this.playerVel?.x || 0) * 0.8; T.z += range(-1.8, 1.8) + (this.playerVel?.z || 0) * 0.8;
    const flight = clamp(P.distanceTo(T) / 13, 0.9, 1.7);
    const vel = new THREE.Vector3((T.x - P.x) / flight, (T.y - P.y + 0.5 * 9.8 * flight * flight) / flight, (T.z - P.z) / flight);
    this.nades.push({ pos: P, vel, fuse: 2.7, bounces: 0 });
    this.audio.play('grenade_pin', { x: P.x, y: P.y, z: P.z });
    if (chance(0.7)) this.fx.later(0.3, () => { this.callout('GRENADE!', T.clone().setY(T.y + 1.6), 'small'); });
  }
  _updateNades(dt) {
    let nearest = null, nd = 1e9;
    for (const n of this.nades) {
      n.fuse -= dt;
      n.vel.y -= 9.8 * dt;
      n.pos.addScaledVector(n.vel, dt);
      const gy = this.col.groundAt(n.pos.x, n.pos.z, n.pos.y, 0.3);
      const c = this.col.collidePoint(n.pos, 0.06, _hitOut);
      if (n.pos.y < gy + 0.06) { n.pos.y = gy + 0.06; if (n.vel.y < -1.5) { n.vel.y *= -0.35; n.vel.x *= 0.6; n.vel.z *= 0.6; if (n.bounces++ < 3) this.audio.play('grenade_bounce', { x: n.pos.x, y: n.pos.y, z: n.pos.z }); } else { n.vel.y = 0; n.vel.x *= Math.exp(-dt * 4); n.vel.z *= Math.exp(-dt * 4); } }
      else if (c.hit) { const vn = n.vel.x * c.nx + n.vel.y * c.ny + n.vel.z * c.nz; if (vn < 0) { n.vel.x -= 1.4 * vn * c.nx; n.vel.y -= 1.4 * vn * c.ny; n.vel.z -= 1.4 * vn * c.nz; n.vel.multiplyScalar(0.6); if (n.bounces++ < 4) this.audio.play('grenade_bounce', { x: n.pos.x, y: n.pos.y, z: n.pos.z }); } }
      if (Math.sin(this.time * (14 + (2.7 - n.fuse) * 10)) > 0) this.fx.main.spawn({ x: n.pos.x, y: n.pos.y + 0.08, z: n.pos.z, frame: CELL.GLOW, s0: 0.35, life: 0.04, r: 3.5, g: 0.3, b: 0.1, a: 1, anchored: false });
      const d = n.pos.distanceTo(this.headPos);
      if (d < nd) { nd = d; nearest = n; }
      if (n.fuse <= 0) { n.dead = true; this.boom(n.pos.clone().setY(n.pos.y + 0.2), 0.8, { radius: 6, dmg: 60 }); }
    }
    this.nades = this.nades.filter(n => !n.dead);
    this.dangerNade = nearest && nd < 12 ? nearest : null;
    for (const g of this.grenades) {
      g.life -= dt;
      g.vel.y -= 9.8 * dt;
      const prev = _v2.copy(g.pos);
      g.pos.addScaledVector(g.vel, dt);
      _v.subVectors(g.pos, prev); const L = _v.length(); _v.divideScalar(L || 1);
      let boom = g.life <= 0;
      const hit = L > 0 ? this.col.raycast(prev, _v, L, b => (b.data.noBullet && !b.data.noStand) || b.data.kind === 'glass') : null;
      if (L > 0) for (const { p, t } of this.panesAlong(prev, _v, hit ? hit.t : L)) this.glass.shatter(p, prev.clone().addScaledVector(_v, t), _v.clone(), 2);
      if (hit) { g.pos.copy(prev).addScaledVector(_v, Math.max(0, hit.t - 0.15)); boom = true; if (hit.box.data.kind === 'car') this.traffic.ignite(hit.box.data.ref, 0.12); }
      const gy = this.world.fastGround(g.pos.x, g.pos.z);
      if (g.pos.y <= gy + 0.1) { g.pos.y = gy + 0.25; boom = true; }
      for (const s of this.soldiers) if (s.alive && s.pos.distanceToSquared(g.pos) < 0.8 && Math.abs(g.pos.y - s.pos.y - 1) < 1.1) boom = true;
      for (const tg of this.targets) if (tg.active() && tg.near?.(g.pos)) { boom = true; tg.direct?.(g.pos); }
      this.fx.trailEmit(g, g.pos, 0.4, (q) => this.fx.main.spawn({ x: q.x, y: q.y, z: q.z, vy: 0.3, drag: 2, frame: CELL.WISP, s0: 0.12, s1: 0.6, life: 0.7, rot: rand() * 6, r: 0.7, g: 0.7, b: 0.7, a: 0.35, fadeOut: 0.3 }), 0);
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
    this.comboT -= dt; this.nadeCool -= dt; this.noNades = (this.noNades || 0) - dt;
    this.recentExplosions = this.recentExplosions.filter(t => this.time - t < 2);
    this.hurtT += dt;
    if (this.hurtT > 2.5 && this.hp < 100) this.hp = Math.min(100, this.hp + 20 * dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - rdt * 1.2);
    this.playerVel ||= new THREE.Vector3();
    if (this._lastHead) { this.playerVel.subVectors(this.headPos, this._lastHead).divideScalar(Math.max(dt, 1e-4)).setY(0); this.playerSpeed = this.playerVel.length(); }
    (this._lastHead ||= new THREE.Vector3()).copy(this.headPos);
    this.camera.getWorldDirection(this.playerFwd); this.playerFwd.y = 0; this.playerFwd.normalize();

    for (const s of this.soldiers) s.update(dt);
    this._updateNades(dt);
    this.traffic.update(dt);
    this.glass.update(dt);
    this.setpieces?.update(dt);
    this.lasers.update(dt);
    this.rifleLasers.update(dt);
    this.birds.update(dt);
    this._updateBodies(dt);
    this._ambient(dt);
    this.clouds.material.uniforms.uDim.value = 0.25 + this.night * 0.45;
    this.clouds.update(dt, this.headPos, 0);
    // the look follows the night, the city's power and the fires
    const key = this.night * 1000 + this.glow * 100 + this.fire * 10;
    if (Math.abs((this._appliedKey ?? -1) - key) > 0.05) {
      this._appliedKey = key;
      setSunElevation(sunElevation(this.night), SUN_AZ);
      applyLook(this.night, this.glow, this.fire, { sun: this.E.sun, hemi: this.E.hemi, fog: this.scene.fog, renderer: this.E.renderer, scene: this.scene });
      this._fog0.color.copy(this.scene.fog.color);
    }
    const F = this.fogMix, fog = this.scene.fog;
    if (F.k > 0.001 || this._fogDirty) {
      this._fogDirty = F.k > 0.001;
      fog.color.copy(this._fog0.color).lerp(F.color, F.k);
      fog.near = lerp(this._fog0.near, F.near, F.k); fog.far = lerp(this._fog0.far, F.far, F.k);
    }
    this.dustDome.visible = F.k > 0.01;
    if (this.dustDome.visible) { this.dustDome.position.copy(this.headPos); this.dustDome.material.color.copy(fog.color).multiplyScalar(0.9); this.dustDome.material.opacity = Math.min(1, F.k * 1.15); }
    this.world.update(dt, this.headPos);
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
        this.fx.main.spawn({ x: p.x, y: p.y, z: p.z, vy: 0.6, frame: CELL.DUST, s0: 0.5, s1: 1.8, life: 0.8, rot: rand() * 6, r: 0.6, g: 0.56, b: 0.52, a: 0.5, fadeOut: 0.3 });
        if (imp > 5) this.audio.play('body_fall', { x: p.x, y: p.y, z: p.z, volume: Math.min(1, imp / 10) });
        if (r.fall && imp > 6) { r.fall = 0; for (const c of this.traffic.cars) if (c.explosive && c.root.position.distanceTo(p) < 3.2) { c.alarm = true; c.haz = true; this.callout('SPLAT', p.clone().setY(p.y + 1.5), 'small'); } }
      }
    }
    for (const p of this.props) {
      if (p.sleep) continue;
      p.life -= dt;
      p.rb.floorY = this.col.groundAt(p.rb.pos.x, p.rb.pos.z, p.rb.pos.y, 0.3);
      p.rb.step(dt, 0);
      p.obj.position.copy(p.rb.pos); p.obj.quaternion.copy(p.rb.quat);
      if (p.rb.onGround && p.rb.vel.lengthSq() < 0.05 && p.rb.ang.lengthSq() < 0.05) p.sleep = true;
      if (p.life <= 0) { p.dead = true; this.scene.remove(p.obj); }
    }
    this.props = this.props.filter(p => !p.dead);
  }

  // smoke from whatever burned before you got here (and later, from what you burned)
  _ambient(dt) {
    this._colT = (this._colT || 0) - dt;
    if (this._colT <= 0 && this.smokeColumns.length) {
      this._colT = 1.9;
      for (const [x, y, z, s] of this.smokeColumns) {
        if (Math.hypot(x - this.headPos.x, z - this.headPos.z) > 700) continue;
        this.clouds.spawn({ x: x + range(-3, 3), y, z: z + range(-3, 3), vx: range(-0.5, 0.5) - 1.2, vy: range(4, 6) * s, vz: range(-0.5, 0.5) + 0.4, drag: 0.08, s0: 10 * s, s1: range(34, 48) * s, life: range(15, 18), a: 0.9, fadeIn: 0.05, fadeOut: 0.45, vrot: range(-0.05, 0.05), r: 0.05, g: 0.045, b: 0.045, r1: 0.09, g1: 0.085, b1: 0.085, glow: 1.6, glowFade: 3.5 });
      }
    }
  }

  // ---------------------------------------------------------------- player hooks
  get boss() { return this.bossInfo; }
  aimAssistPoints(tryP) {
    for (const s of this.soldiers) if (s.alive) tryP(s.gm.chestCenter.getWorldPosition(new THREE.Vector3()));
    for (const tg of this.targets) if (tg.active() && tg.aim) tryP(tg.aim());
  }
  autoTargets(A, head) {
    const out = [];
    for (const s of this.soldiers) {
      if (!s.alive || s.delay > 0) continue;
      const p = (s.role === 'sniper' ? s.gm.headCenter : s.gm.chestCenter).getWorldPosition(new THREE.Vector3());
      const d = p.distanceTo(head);
      if (d > (s.role === 'sniper' ? 80 : s.role === 'jumper' ? 90 : 65)) continue;
      const vis = (A.target?.ref === s) ? A.targetVisible !== false : this.col.visible(head, p, b => b.data.noBullet || b.data.kind === 'glass');
      if (!vis) continue;
      let score = 60 - d * 0.6 + (A.target?.ref === s ? 25 : 0) + (s.role === 'rusher' ? 10 : 0);
      if (s.role === 'sniper') score += 15 + clamp(s.laser.lock / s.laser.lockTime, 0, 1) * 55;
      out.push({ kind: 'soldier', p, score, ref: s, heavy: s.role !== 'sniper' && d > 18 && s.cover?.tall === false, minNade: 9, tol: s.role === 'sniper' ? 0.02 : undefined });
    }
    for (const c of this.traffic.cars) {
      if (!c.explosive || (c.state !== 'ok' && c.state !== 'smoke')) continue;
      const cp = this.traffic.worldCenter(c, new THREE.Vector3());
      const dd = cp.distanceTo(head);
      if (dd < 9 || dd > 45) continue;
      const near = this.soldiers.filter(s => s.alive && s.delay <= 0 && s.role !== 'sniper' && s.pos.distanceTo(cp) < 4.5).length;
      if (near === 0) continue;
      if (!this.col.visible(head, cp, b => b.data.noBullet || b.data.kind === 'glass' || c.boxes.includes(b))) continue;
      out.push({ kind: 'car', p: cp, score: 48 + near * 22 + (c.state === 'smoke' ? 25 : 0) - dd * 0.5 + (A.target?.ref === c ? 20 : 0), ref: c, tol: 0.05, heavy: near >= 2, minNade: 10 });
    }
    for (const tg of this.targets) if (tg.active() && tg.auto) { const t = tg.auto(head, A); if (t) out.push(t); }
    if (this.cinematicLook) { out.length = 0; out.push({ kind: 'look', p: this.cinematicLook, score: 999, ref: this.cinematicLook, w: this.cinematicW ?? 5 }); }
    A.targetVisible = true;
    return out;
  }
  autoTargetDead(t) {
    if (t.kind === 'soldier') return !t.ref.alive || (this.time % 0.5 < 0.04 && !this.col.visible(this.headPos, this.autoAimPoint(t, _v), b => b.data.noBullet || b.data.kind === 'glass'));
    if (t.kind === 'car') return t.ref.state !== 'ok' && t.ref.state !== 'smoke';
    if (t.kind === 'target') return !t.ref.active();
    return false;
  }
  autoAimPoint(t, out) {
    if (t.kind === 'soldier') return (t.ref.role === 'sniper' ? t.ref.gm.headCenter : t.ref.gm.chestCenter).getWorldPosition(out);
    if (t.kind === 'car') return this.traffic.worldCenter(t.ref, out);
    if (t.kind === 'target' && t.ref.aim) return out.copy(t.ref.aim());
    return out.copy(t.p);
  }
  autoIdleLook(A, player) { return this.auto ? this.auto.idleLook(A, player) : null; }
}
const _hitOut = { hit: false, nx: 0, ny: 0, nz: 0 };
function holeTexture() {
  const S = 64, c = makeCanvas(S, S), x = c.getContext('2d');
  const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(5,5,6,1)'); gr.addColorStop(0.16, 'rgba(12,11,10,1)'); gr.addColorStop(0.22, 'rgba(120,118,112,0.55)');
  gr.addColorStop(0.3, 'rgba(30,28,26,0.55)'); gr.addColorStop(0.7, 'rgba(25,22,20,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, S, S);
  return canvasTex(c, { repeat: false });
}
