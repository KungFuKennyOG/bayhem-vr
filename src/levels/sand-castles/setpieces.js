import * as THREE from 'three';
import { range, rand, clamp } from '../../rng.js';
import { SUN_DIR } from '../../atmosphere.js';
import { OverDust } from '../dubai-proto/overdust.js';
import { MidRig } from './midrig.js';
import { HeroTower } from './hero.js';
import { HorizonWallC, Haboob, SandStreaks } from './storm.js';
import { Strikes } from './strikes.js';
import { HERO } from './layout.js';

// =====================================================================================
//  SET PIECES — everything that comes down, and the weather:
//   - the fallers (MidRig): strike targets, the gunship's crash tower, the escalation towers,
//     the spire's neighbour. Staggered by design: at most 2 falling at once (+ the hero),
//   - the hero, SARAB SPIRE (HeroTower), and the far dust ring that hides the ruin swap,
//   - the haboob, the sand streaks, burning-wreck smoke columns,
//   - the designator strikes.
// =====================================================================================

const _v = new THREE.Vector3();

export class SetPieces {
  constructor(game, W, F, player) {
    this.g = game; this.W = W; this.F = F;
    const scene = game.scene;
    this.dust = new OverDust(scene, scene.fog, { dust: F.dust, occl: F.occl, fill: F.fill, isQuest: F.isQuest });
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
  column(x, z, life = 60, rate = 0.8) { this.columns.push({ x, z, t: 0, life, rate, acc: 0 }); }
  _strikeHit(tower, P, k) {
    const g = this.g;
    if (tower === this.heroTarget) { if (k === 2) this.g.events.push({ type: 'heroStruck' }); return; }
    for (const a of g.aas) if (a.tower === tower && a.alive) g.killAA(a, 'strike');
    for (let i = 0; i < 6; i++) this.dust.plume(P.x + range(-10, 10), P.y + range(-8, 8), P.z + range(-10, 10), range(-6, 6), range(-6, 6), 1.1, rand() < 0.6);
    if (k === 2) g.fx.later(0.7, () => { if (this.fallTower(tower.id, g.headPos)) { g.addScore(2500, 'TOWER DOWN', P.clone().setY(P.y + 30), 'huge'); g.slowmoReq(1.6, 0.4); } });
  }
  update(dt, rdt, eye) {
    const g = this.g;
    this.mids.update(dt, this.dust, (T, x, z) => { this.column(x, z, 70, 0.7); g.audio.play('collapse_impact', { x, y: 5, z, volume: 1 }); g.lastExplosionT = g.time; g.lastExplosionShake = 0.3; g.events.push({ type: 'towerLanded', T }); });
    if (this.mids.falling() === 0 && this._sunDirty) { this.W.city.sun.commit(); this._sunDirty = false; }
    this.hero.update(dt);
    this.wall.update(dt, SUN_DIR);
    this.haboob.update(dt, eye, SUN_DIR, g.scene.fog);
    this.strikes.update(dt, rdt);
    // burning columns: dark plumes with a fire glow at the base, drifting with the wind
    for (const c of this.columns) {
      c.t += dt; if (c.t > c.life) continue;
      c.acc += dt * c.rate * this.dust.rate;
      while (c.acc >= 1) { c.acc -= 1; this.dust.plume(c.x + range(-12, 12), range(8, 30), c.z + range(-12, 12), 3, -1.5, 1.15, true); }
    }
    this.columns = this.columns.filter(c => c.t < c.life);
    this.dust.update(dt, eye, g.camera);
    this.streaks.update(rdt, eye, this.storm);
  }
  get falls() { return this.mids.falling() + (this.hero.S && !this.hero.done() ? 1 : 0); }
}
