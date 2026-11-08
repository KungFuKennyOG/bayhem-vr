import * as THREE from 'three';
import { range, rand, clamp, makeRng } from '../../rng.js';
import { SUN_DIR } from '../../atmosphere.js';
import { OverDust } from '../dubai-proto/overdust.js';
import { MidRig } from './midrig.js';
import { HeroTower } from './hero.js';
import { HorizonWallC, Haboob, SandStreaks } from './storm.js';
import { Strikes } from './strikes.js';
import { HERO, GRID, isWater } from './layout.js';
import { glowTexture } from '../../textures.js';
import { FAC } from './facade.js';
import { installSmoke } from './smoke.js';
import { TOD } from './sky.js';

// =====================================================================================
//  SET PIECES — everything that comes down, and the weather:
//   - the fallers (MidRig): strike targets, the gunship's crash tower, the escalation towers,
//     the spire's neighbour. Staggered by design: at most 2 falling at once (+ the hero),
//   - the hero, SARAB SPIRE (HeroTower), and the far dust ring that hides the ruin swap,
//   - the haboob, the sand streaks, burning-wreck smoke columns,
//   - the designator strikes.
// =====================================================================================

const _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export class SetPieces {
  constructor(game, W, F, player) {
    this.g = game; this.W = W; this.F = F;
    const scene = game.scene;
    this.dust = new OverDust(scene, scene.fog, { dust: F.dust, occl: F.occl, fill: F.fill, isQuest: F.isQuest });
    // no cotton balls: every puff is a self-shadowed noise volume (smoke.js); &smoke=atlas keeps the old atlas puffs
    this.smokeT = F.smoke !== 'atlas' ? installSmoke(this.dust.clouds.mesh.material) : null;
    // smoke here is soot, not dust: dark plumes start bigger (no small black spots inside the tan ones) and age to a
    // grey-brown so a column reads as one dark core thinning out, not a leopard print
    { const D = this.dust, base = D.plume.bind(D);
      // light plumes are pulverised concrete: ochre-grey, a touch darker, never cotton white
      D.plume = (x, y, z, vx = 0, vz = 0, s = 1, dark = false) => !dark ? D.spawn({ x, y, z, vx: vx + range(-3, 3), vy: range(1, 5), vz: vz + range(-3, 3), drag: 0.35, buoy: 0.4, s0: range(22, 40) * s, s1: range(80, 140) * s, life: range(12, 16), a: 0.95, fadeIn: 0.05, fadeOut: 0.4, vrot: range(-0.06, 0.06), r: 0.4, g: 0.36, b: 0.3, r1: 0.5, g1: 0.45, b1: 0.37 }) : D.spawn({ x, y, z, vx: vx + range(-3, 3), vy: range(2, 6), vz: vz + range(-3, 3), drag: 0.35, buoy: 0.5, s0: range(44, 60) * s, s1: range(125, 165) * s, life: range(13, 17), a: 0.9, fadeIn: 0.06, fadeOut: 0.45, vrot: range(-0.06, 0.06), r: 0.27, g: 0.24, b: 0.21, r1: 0.44, g1: 0.4, b1: 0.35 }); }
    const special = W.plan.towers.filter(t => t.role === 'target' || t.role === 'crash' || t.role === 'mid');
    this.mids = new MidRig(scene, special, W.city.sun);
    W.city.sun.commit();
    this.byId = Object.fromEntries(special.map(t => [t.id, t]));
    this.hero = new HeroTower(game, this.dust, { glass: F.glass, fx: true, detail: 1 });
    this.wall = new HorizonWallC(scene, scene.fog, HERO.x, HERO.z);
    this.haboob = new Haboob(scene, this.dust);
    this.streaks = new SandStreaks(scene, F.isQuest ? 160 : 320);
    this.columns = [];
    this.storm = 0; this.stormT = 0;
    this.strikes = new Strikes(game, player, (tower, P, k) => this._strikeHit(tower, P, k));
    this.heroDown = false;
    // the hero as a paintable target: a box round its base / mid section
    this.strikes.heroBox = (o, d) => {
      if (this.heroDown) return null;
      const hw = HERO.w0 * 0.5;
      let t0 = 0, t1 = 4000;
      for (const [oo, dd, lo, hi] of [[o.x - HERO.x, d.x, -hw, hw], [o.y, d.y, 0, HERO.h], [o.z - HERO.z, d.z, -hw, hw]]) {
        if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return null; continue; }
        let a = (lo - oo) / dd, b = (hi - oo) / dd; if (a > b) { const q = a; a = b; b = q; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return null;
      }
      return { t: t0, tower: this.heroTarget };
    };
    this.heroTarget = { id: 'HERO', x: HERO.x, z: HERO.z, h: HERO.h, w: HERO.w0, d: HERO.w0 };
    // the Spire's aviation light (rides the spire tip, even as it falls)
    this.heroBeacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff2010, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.heroBeacon.scale.setScalar(14); scene.add(this.heroBeacon);
    // the city is already at war when you arrive: fires and black smoke columns across the skyline
    for (const [x, z] of [[-620, -420], [380, 520], [1150, -80], [-1050, 380], [700, -1350], [-260, 1150], [1700, 420]]) this.column(x, z, 1e9, 0.55);
    // burning roofs: a few towers already hit, fire glowing under their smoke
    this.roofFires = W.plan.towers.filter(t => t.role === 'static' && t.h > 110 && t.h < 260 && t.roof !== 'pool').filter((t, i) => i % 23 === 5).slice(0, 7);
    for (const t of this.roofFires) this.column(t.x, t.z, 1e9, 0.35, t.h);
    // the city fights back far away: tracer fire arcing up from a few distant roofs
    this.flakRoofs = W.plan.towers.filter(t => t.role === 'static' && t.h > 120).filter((t, i) => i % 31 === 7).slice(0, 8).map(t => ({ t, burst: 0, wait: range(0, 4) }));
    this.ambT = 2; this.war = 1;
    // burnt-out and burning wrecks on the streets (one instanced draw): the city's been fought over all day
    { const n = 46, geo = new THREE.BoxGeometry(4.6, 1.45, 2.0); geo.translate(0, 0.72, 0);
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x17140f, roughness: 0.95 }), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); this.wrecks = [];
      // their own random stream: set dressing must not shift the game's seeded sequence (beats, timings, the autopilot)
      const R = makeRng(9127), rr = (a, b) => a + (b - a) * R(); this.vr = R;
      for (let i = 0, tries = 0; i < n && tries < 2000; tries++) {
        const alongX = R() < 0.5, k = Math.floor(rr(0, 40)), t = rr(GRID.x0, GRID.x1);
        const x = alongX ? t : GRID.x0 + k * GRID.pitch + rr(-6, 6), z = alongX ? GRID.z0 + k * GRID.pitch + rr(-6, 6) : rr(GRID.z0, GRID.z1);
        if (z > GRID.z1 || x > GRID.x1 || isWater(x, z) || Math.hypot(x - HERO.x, z - HERO.z) < 120) continue;
        q.setFromAxisAngle(_up, (alongX ? 0 : Math.PI / 2) + rr(-0.5, 0.5));
        m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 1)); mesh.setMatrixAt(i, m4);
        this.wrecks.push({ x, z, burning: i % 3 === 0 }); i++;
      }
      mesh.count = this.wrecks.length; scene.add(mesh); this.wreckMesh = mesh; }
  }
  tower(id) { return this.byId[id]; }
  // the direction a tower falls: across the view from the heli, a little away from it
  awayDir(T, eye) {
    const ax = T.x - eye.x, az = T.z - eye.z, l = Math.hypot(ax, az) || 1;
    const sx = -az / l, sz = ax / l;
    const s = (T.rigIdx % 2 ? 1 : -1);
    return { x: sx * s * 0.8 + (ax / l) * 0.6, z: sz * s * 0.8 + (az / l) * 0.6 };
  }
  fallTower(id, eye, dir = null) {
    const T = this.byId[id]; if (!T || this.mids.isDown(T.rigIdx)) return false;
    this.mids.fall(T.rigIdx, dir || this.awayDir(T, eye));
    this.g.towersDown++;
    this.g.audio.play('collapse_rumble', { volume: 0.9 });
    this.g.audio.play('metal_groan', { x: T.x, y: T.h * 0.6, z: T.z, volume: 1, pitch: 0.7 });
    this.g.events.push({ type: 'towerFall', T });
    return true;
  }
  setFallen(id, eye) { const T = this.byId[id]; if (!T) return; this.mids.setFallen(T.rigIdx, this.awayDir(T, eye)); this.column(T.x, T.z, 9999, 0.5); }
  falling() { return this.mids.falling(); }
  column(x, z, life = 60, rate = 0.8, y0 = 0) { this.columns.push({ x, z, y0, t: 0, life, rate, acc: 0 }); }
  _strikeHit(tower, P, k) {
    const g = this.g;
    if (tower === this.heroTarget) { if (k === 2) this.g.events.push({ type: 'heroStruck' }); return; }
    for (const a of g.aas) if (a.tower === tower && a.alive) g.killAA(a, 'strike');
    for (let i = 0; i < 6; i++) this.dust.plume(P.x + range(-10, 10), P.y + range(-8, 8), P.z + range(-10, 10), range(-6, 6), range(-6, 6), 1.1, rand() < 0.6);
    if (k === 2) g.fx.later(0.7, () => { if (this.fallTower(tower.id, g.headPos)) { g.addScore(2500, 'TOWER DOWN', g.calloutAt(P.clone().setY(P.y + 30)), 'huge'); g.slowmoReq(1.6, 0.4); } });
  }
  update(dt, rdt, eye) {
    const g = this.g;
    this.mids.update(dt, this.dust, (T, x, z) => { this.column(x, z, 70, 0.7); g.audio.play('collapse_impact', { x, y: 5, z, volume: 1 }); g.lastExplosionT = g.time; g.lastExplosionShake = 0.3; g.events.push({ type: 'towerLanded', T }); });
    if (this.mids.falling() === 0 && this._sunDirty) { this.W.city.sun.commit(); this._sunDirty = false; }
    this.hero.update(dt);
    { const H = this.hero, B = H.spireBody; const top = B ? _v.set(0, HERO.spire, 0).applyQuaternion(B.q).add(B.p) : _v.set(0, HERO.spire, 0).applyQuaternion(H.nodes[H.B].q).add(H.nodes[H.B].p);
      this.heroBeacon.position.copy(top); this.heroBeacon.material.opacity = (Math.sin(this.g.time * 3.4) > 0 ? 1 : 0.15) * (B && B.landed ? 0 : 1); }
    this.wall.update(dt, SUN_DIR);
    this.haboob.stormK = TOD.storm;
    this.haboob.update(dt, eye, SUN_DIR, g.scene.fog);
    // the storm's shadow on the city ahead of the front (until you're inside it and the whole look goes to storm)
    if (this.haboob.state) FAC.uStormF.value.set(this.haboob.state.z, clamp(1 - this.haboob.inside(eye) / 300, 0, 1) * (1 - TOD.storm)); else FAC.uStormF.value.set(1e6, 0);
    this.strikes.update(dt, rdt);
    // burning columns: dark plumes with a fire glow at the base, drifting with the wind
    for (const c of this.columns) {
      c.t += dt; if (c.t > c.life) continue;
      c.acc += dt * c.rate * this.dust.rate;
      while (c.acc >= 1) { c.acc -= 1; this.dust.plume(c.x + range(-7, 7), c.y0 + range(4, 16), c.z + range(-7, 7), 3, -1.5, 1.15, true); }
      // fire at the foot of the near ones
      { const d = Math.hypot(c.x - eye.x, c.z - eye.z); if (d < 1500 && rand() < dt * 5) g.fx.flame(_v.set(c.x + range(-9, 9), c.y0 + 2, c.z + range(-9, 9)), 5 + d * 0.006); }
    }
    this.columns = this.columns.filter(c => c.t < c.life);
    this._ambient(dt, eye);
    if (this.smokeT) this.smokeT.value += dt;
    this.dust.update(dt, eye, g.camera);
    this.streaks.update(rdt, eye, this.storm);
  }
  // the war going on round you: distant explosions on the skyline, tracer streams arcing into the sky,
  // flames on the burning roofs (all far: cheap, but there's always something happening out of the door)
  _ambient(dt, eye) {
    const g = this.g; if (!this.war) return;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(g.rig.quaternion); fwd.y = 0; fwd.normalize();
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = range(2.2, 4.5) / this.war;
      const a = Math.atan2(fwd.z, fwd.x) + range(-0.9, 0.9), r = range(450, 1300);
      const P = new THREE.Vector3(eye.x + Math.cos(a) * r, 0, eye.z + Math.sin(a) * r);
      const roof = g.W.plan.towers.find(t => !t.gone && Math.hypot(t.x - P.x, t.z - P.z) < 60);
      P.y = roof ? roof.h + 2 : 4;
      g.fx.explosion(P, 1.8); g.fx.light(P, 1500, 0.4, 0xff8a3a, false, 400);
      this.dust.plume(P.x, P.y + 10, P.z, 0, 0, 1.4, true);
      g.audio.play('explosion_big', { x: P.x, y: P.y, z: P.z, volume: 0.5, pitch: range(0.6, 0.8) });
    }
    for (const f of this.flakRoofs) {
      f.wait -= dt; if (f.wait > 0) continue;
      const t = f.t, mz = new THREE.Vector3(t.x, t.h + 3, t.z);
      if (mz.distanceTo(eye) > 1800 || mz.distanceTo(eye) < 250) { f.wait = 2; continue; }
      if (f.burst <= 0) { f.burst = 8; f.dir = new THREE.Vector3(range(-0.5, 0.5), 1, range(-0.5, 0.5)).normalize(); }
      f.burst--; f.wait = f.burst > 0 ? 0.14 : range(2, 5);
      const to = mz.clone().addScaledVector(f.dir, 900).add(new THREE.Vector3(range(-30, 30), 0, range(-30, 30)));
      g.fx.tracer(mz, to, { speed: 380, width: 1.1, len: 45, color: [2.2, 0.6, 0.18] });
    }
    // the burning wrecks: low flames and a thin smoke trail from the near ones
    { const R = this.vr; for (const w of this.wrecks) if (w.burning) { const d = Math.hypot(w.x - eye.x, w.z - eye.z); if (d < 1300 && R() < dt * 2.5) { g.fx.flame(_v.set(w.x + (R() - 0.5) * 3, 1.2, w.z + (R() - 0.5) * 2), 2.2 + d * 0.002); if (R() < 0.5) g.fx.smoke(_v.set(w.x, 3, w.z), 3 + d * 0.004, 0.12, 5, 3, 0.6); } } }
    for (const t of this.roofFires) if (rand() < dt * 3 && Math.hypot(t.x - eye.x, t.z - eye.z) < 1400) g.fx.flame(new THREE.Vector3(t.x + range(-8, 8), t.h + 2, t.z + range(-8, 8)), 6);
  }
  get falls() { return this.mids.falling() + (this.hero.S && !this.hero.done() ? 1 : 0); }
}
