import * as THREE from 'three';
import { pick, range } from '../../rng.js';

// Scripted set piece: "THE 405 JOB" — a highway chase in five beats.
export class Director {
  constructor(game, hud, audio, trailer) {
    this.g = game; this.hud = hud; this.audio = audio; this.trailer = trailer;
    this.stepIdx = -1; this.t = 0; this.total = 0;
    this.done = false;
    const T = trailer ? 0.6 : 1;
    const g = game;
    const enemiesLeft = () => g.cars.some(c => c.team === 'enemy' && c.state === 'drive');
    const say = (who, line, d = 3) => hud.subtitle(who, line, d);
    this.steps = [
      { name: 'intro', music: 0.25, enter: () => {
          hud.showTitle(new THREE.Vector3(g.truckX, 9, 60), 'BAYHEM', 'A HIGHWAY CHASE IN FIVE EXPLOSIONS', trailer ? 3.6 : 5);
          this.audio.startMusic();
          g.fx.later(0.8, () => say('DRIVER', "Black SUVs, six o'clock. Get on the gun!", 3));
        }, until: (t) => t > (trailer ? 3.4 : 6) },
      { name: 'wave1', music: 0.6, enter: () => {
          g.spawnSUV({ lane: 1, z: 70, gunners: ['L', 'R'] });
          g.spawnSUV({ lane: 3, z: 85, gunners: ['L', 'roof'] });
        }, until: (t) => (t > 3 && !enemiesLeft()) || t > 50 * T },
      { name: 'breather1', music: 0.45, enter: () => { say('DRIVER', pick(['Woo! That one had a sunroof!', 'Nice! Reload, more coming!']), 2.5); }, until: (t) => t > (trailer ? 1.2 : 3) },
      { name: 'wave2', music: 0.75, enter: () => {
          g.spawnSUV({ lane: 0, z: 75, gunners: ['R', 'roof'] });
          g.spawnSUV({ lane: 1, from: 'ahead', z: -150, gunners: ['L', 'R', 'roof'] });
          g.spawnSUV({ lane: 3, z: 95, gunners: ['L'] });
          g.fx.later(2, () => say('DRIVER', 'One coming back from ahead — eyes front!', 2.5));
        }, until: (t) => (t > 3 && !enemiesLeft()) || t > 55 * T },
      { name: 'tanker', music: 0.85, enter: () => {
          this.tanker = g.spawnTanker();
          g.civMax = 2;
          g.fx.later(0.3, () => say('DRIVER', 'Is that a fuel tanker? Don\'t you dare...', 3));
          g.spawnSUV({ lane: 2, from: 'ahead', z: -190, gunners: ['L', 'R'] });
          g.spawnSUV({ lane: 0, z: 70, gunners: ['R', 'roof'] });
        }, until: (t) => {
          const tk = this.tanker;
          if (tk && tk.state !== 'drive' && !this.saidTanker) { this.saidTanker = true; g.fx.later(1.2, () => say('DRIVER', 'You did. You absolutely did.', 2.5)); }
          return (t > 4 && tk.state !== 'drive' && !enemiesLeft()) || t > 60 * T || (tk.pos.z > 60 && !enemiesLeft());
        } },
      { name: 'wave3', music: 0.9, enter: () => {
          g.civMax = 4;
          say('DRIVER', 'Four more! They\'re gonna try to box us in!', 2.8);
          g.spawnSUV({ lane: 1, z: 70, gunners: ['L', 'R'] });
          g.spawnSUV({ lane: 3, z: 80, gunners: ['L', 'roof'] });
          g.fx.later(trailer ? 2 : 5, () => { g.spawnSUV({ lane: 0, z: 90, gunners: ['R'] }); g.spawnSUV({ lane: 2, from: 'ahead', z: -170, gunners: ['roof', 'L'] }); });
        }, until: (t) => (t > (trailer ? 4 : 7) && !enemiesLeft()) || t > 60 * T },
      { name: 'boss', music: 1.0, enter: () => {
          g.civMax = 1;
          say('DRIVER', 'Is that... rotor noise?', 2);
          g.fx.later(1.5, () => g.spawnHeli());
          this.reinforced = false;
        }, until: (t) => {
          const h = g.heli;
          if (h && h.alive && !this.reinforced && h.hp < h.maxHp * 0.55) { this.reinforced = true; g.spawnSUV({ lane: 1, z: 80, gunners: ['L', 'roof'] }); g.spawnSUV({ lane: 3, z: 90, gunners: ['L'] }); say('DRIVER', 'It called friends!', 2); }
          return h && h.phase === 'gone' && t > 3;
        } },
      { name: 'outro', music: 1.0, enter: () => {
          this.audio.musicStinger('victory');
          g.fx.later(2.2, () => { g.forceLane = null; say('DRIVER', '...We should really get this truck washed.', 3.5); });
          g.fx.later(trailer ? 3.0 : 4.0, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.carsDestroyed, 'CAR')}  •  ${pl(g.kills, 'GOON')}  •  ${pl(g.rocketsShot, 'ROCKET')} SHOT DOWN  •  SCORE ${g.score}`;
            hud.showTitle(new THREE.Vector3(g.truckX - 2, 7, -55), 'BAYHEM', sub, 999);
            g.cinematicLook = new THREE.Vector3(g.truckX - 2, 5, -55);
          });
        }, until: (t) => t > (trailer ? 9 : 14) },
    ];
    this.next();
  }
  next() {
    this.stepIdx++;
    this.t = 0;
    const s = this.steps[this.stepIdx];
    if (!s) { this.done = true; return; }
    this.cur = s;
    this.audio.setMusicIntensity(s.music);
    s.enter();
  }
  update(dt) {
    if (this.done) return;
    this.t += dt; this.total += dt;
    if (this.cur.until(this.t)) this.next();
  }
}
