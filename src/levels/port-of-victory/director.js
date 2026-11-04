import * as THREE from 'three';
import { pick, range, clamp, damp, smooth } from '../../rng.js';
import { DECK_Y, CH, QUAY_Z } from './layout.js';
import { arrivedAtMarker } from '../../beats.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// =====================================================================================
//  PORT OF VICTORY — the beats. Triggers are positional for real play; the autopilot walks
//  the same route in demo / trailer mode.
// =====================================================================================
export class Director {
  constructor(game, hud, audio, setp, auto, trailer) {
    Object.assign(this, { g: game, hud, audio, sp: setp, auto, trailer });
    this.stepIdx = -1; this.t = 0; this.total = 0; this.done = false;
    this.duskTarget = game.dusk;
    const g = game;
    const T = trailer ? 0.7 : 1;
    const say = (line, d = 3) => { audio.play('radio_squelch', { volume: 0.6 }); hud.subtitle('DRIVER', line, d); };
    const later = (t, fn) => g.fx.later(t, fn);
    const alive = (f) => g.enemiesAlive(f);
    const cleared = (t, min) => t > min && (alive() === 0 || (trailer && alive() <= 1 && t > min + 14));
    const pz = () => g.headPos.z, px = () => g.headPos.x;
    const A = auto;
    const ground = (x, z, o = {}) => ({ p: V(x, 0, z), nav: 'ground', ...o });
    const deck = (x, z, o = {}) => ({ p: V(x, DECK_Y, z), nav: 'deck', ...o });
    const S = (o) => g.spawnSoldier(o);
    const nav = () => g.world.nav, navDeck = () => g.world.navDeck;
    this.steps = [
      { name: 'intro', wp: null, music: 0.25, dusk: 0.12, enter: () => {
          hud.black.material.opacity = 1;
          // thrown out of the wreck: crash, ringing ears, getting up off the asphalt
          audio.play('metal_crash', { volume: 1 }); audio.play('ear_ring', { volume: 0.6 });
          if (g.player) { g.player.camDip = 1; g.player.camDipRate = 0.42; }
          g.slowmo(1.2, 0.5, true);
          hud.showTitle(V(0, 13, -40), 'PORT OF VICTORY', 'LEVEL 2  •  DOCKS AT DUSK', trailer ? 4 : 5.5);
          audio.startMusic();
          later(0.7, () => say('End of the line, truck\'s done. That\'s the port.', 3));
          later(3.8, () => say('Their boss loads the ship at sundown. Go! I\'ve got your back... from here.', 3.6));
          A?.go([ground(1.5, 26.5)]);
        }, update: (t) => { hud.black.material.opacity = Math.max(0, 1 - t / 1.6); },
        until: (t) => t > (trailer ? 5.5 : 7.5) },
      { name: 'gate', wp: V(0, 2.5, 4), hunt: true, arrive: true, music: 0.6, dusk: 0.17, enter: () => {
          hud.objective('Push into the container yard');
          S({ x: -6, z: 4, role: 'rusher', delay: 0.6, entry: V(-5, 0, 14) });
          S({ x: 8.5, z: 3, delay: 0.2 });
          S({ x: -14, z: 6, delay: 1.0, flanker: true });
          S({ x: 12.4, z: 16.5, y: CH * 2, role: 'perch', delay: 0.4 });
          S({ x: -20, z: -4, delay: 2.5, entry: V(-18, 0, 14) });
          later(1.2, () => say('They\'re coming out of the containers!', 2.4));
          A?.go([ground(2.5, 24, { slow: 0.6 }), ground(-0.8, 21, { slow: 0.6 })]);
        }, until: (t) => cleared(t, 4) || t > 60 * T },
      { name: 'maze1', music: 0.7, dusk: 0.24, enter: () => {
          this.lightsOn([0, 1], 0.4);
          later(1.4, () => say('Somebody hit the lights. Great — now they can see you.', 3));
          A?.go([ground(-0.6, 13), ground(-1.2, 2, { slow: 0.7 })]);
        }, until: (t) => t > 1.0 && pz() < 15 },
      { name: 'maze1b', wp: V(0, 2.5, -28), hunt: true, arrive: true, music: 0.8, dusk: 0.28, enter: () => {
          S({ x: 2.5, z: -15, delay: 0.3 });
          S({ x: -1, z: -21, delay: 0.8 });
          S({ x: -20.3, z: -6, delay: 1.2, flanker: true, entry: V(-20.3, 0, -18) });
          S({ x: 17.7, z: -9, delay: 1.8, flanker: true, entry: V(17.7, 0, -20) });
          S({ x: 5.6, z: 3.5, y: CH, role: 'perch', delay: 0.6 });
          S({ x: -12, z: -26, role: 'rusher', delay: 4.5 });
          later(5, () => say('Watch the side aisles, they\'re flanking!', 2.6));
          A?.go([ground(-3.3, -4, { slow: 0.6 }), ground(-3.3, -12, { slow: 0.6 }), ground(0.4, -19, { slow: 0.5 })]);
        }, until: (t) => cleared(t, 4) || t > 70 * T },
      { name: 'maze2', wp: V(0, 2.5, -70), hunt: true, arrive: true, music: 0.85, dusk: 0.34, enter: () => {
          this.lightsOn([2, 3], 0.3);
          S({ x: -5.2, z: -36, y: CH, role: 'perch', delay: 0.5 });
          S({ x: 2.2, z: -44, delay: 0.2 });
          S({ x: -2.5, z: -56, delay: 1.0 });
          S({ x: -20.3, z: -50, delay: 1.5, flanker: true });
          S({ x: 17.7, z: -36, delay: 2.0, flanker: true });
          S({ x: 9, z: -70, delay: 3.0, entry: V(3, 0, -62) });
          S({ x: 0, z: -64, role: 'rusher', delay: 6 });
          later(0.8, () => say('More of them in the stacks. Use the barrels — everything here burns.', 3.2));
          A?.go([ground(0.6, -27, { slow: 0.6 }), ground(0.2, -36, { slow: 0.55 }), ground(3.1, -46, { slow: 0.5 }), ground(3.0, -52, { slow: 0.5 }), ground(0, -58, { slow: 0.5 })]);
        }, until: (t) => cleared(t, 5) || t > 75 * T },
      { name: 'crane', wp: V(0, 2.5, -106), music: 0.75, dusk: 0.42, enter: () => {
          this.lightsOn([4, 5], 0.3);
          setp.craneStart();
          later(0.4, () => say('Uh... the crane\'s moving. Why is the crane moving?!', 3));
          S({ x: 0.5, z: -104, delay: 3 });
          S({ x: -9, z: -106, delay: 3.5 });
          S({ x: 5.4, z: -79, y: CH * 2, role: 'perch', delay: 5 });
          A?.go([ground(0.5, -70), ground(0.2, -82, { slow: 0.45 })]);
        }, update: (t) => {
          for (const e of g.events) {
            if (e.type === 'craneDrop') {
              say('MOVE! MOVE!!', 1.6);
              // dodge sideways out of the footprint (the autopilot sprints)
              if (A) { const side = px() > e.at.x ? 1 : -1; A.go([ground(clamp(e.at.x + side * 4.6, -3.6, 3.8), pz() + 1.5, { sprint: true, tol: 0.4 })]); }
            }
            if (e.type === 'craneImpact') { later(1.2, () => say(setp.crane.opAlive ? 'Shoot the guy in the cab before he does that again!' : 'That was close. Way too close.', 3)); A && later(0.8, () => { A.go([ground(3.6, -88, { slow: 0.4 })]); }); }
            if (e.type === 'operatorDown') later(1.4, () => say('Crane operator\'s fired. HR is gonna love that.', 3));
          }
        }, until: (t) => (setp.crane.mode === 'after' || setp.crane.mode === 'done') && !setp.crane.opAlive && alive() === 0 && t > 5 || t > 70 * T },
      { name: 'apron', wp: V(-4, 2.6, -148.5), hunt: true, arrive: () => this.forkGo && setp.fork.state !== 'charge', music: 0.95, dusk: 0.55, enter: () => {
          this.lightsOn([6, 7, 8, 9], 0.5);
          hud.objective('Get to the ship');
          this.forkGo = false;
          S({ x: 19, z: -117, delay: 0.5 }); S({ x: 31, z: -119, delay: 1.2 }); S({ x: -13, z: -123, delay: 1.5 }); S({ x: -27, z: -117, delay: 2.4, flanker: true });
          S({ x: -1, z: -155.4, y: DECK_Y, nav: navDeck(), role: 'deck', delay: 2, noNade: true });
          S({ x: 8, z: -155.4, y: DECK_Y, nav: navDeck(), role: 'deck', delay: 3, noNade: true });
          A?.go([ground(2.0, -100, { slow: 0.6 }), ground(3.5, -113, { slow: 0.5 }), ground(4, -118, { slow: 0.45 })]);
        }, update: (t) => {
          // the forklift comes round the stacks once you step out onto the open apron
          if (!this.forkGo && (pz() < -109 || t > 12)) { this.forkGo = true; setp.forkliftStart(); later(0.5, () => say('Forklift! Forklift full of fuel drums! Of course!', 3)); }
          for (const e of g.events) if (e.type === 'forkliftWreck') later(1.5, () => say('...I have never seen a forklift do that.', 2.6));
        }, until: (t) => (t > 6 && this.forkGo && alive(s => s.floorY < 1) === 0 && setp.fork.state !== 'charge') || t > 75 * T },
      { name: 'board', wp: V(23.5, DECK_Y + 2.4, -152), music: 0.85, dusk: 0.64, enter: () => {
          audio.play('ship_horn', { x: 30, y: 30, z: -170, volume: 1 });
          hud.objective('Board the ship');
          later(2.2, () => say('That\'s her. Up the gangway — the fuel hold is mid-ship.', 3.2));
          S({ x: 4, z: -155.6, y: DECK_Y, nav: navDeck(), role: 'deck', delay: 1, noNade: true });
          S({ x: 14, z: -155.8, y: DECK_Y, nav: navDeck(), role: 'deck', delay: 6, noNade: true, entry: V(16, DECK_Y, -156) });
          S({ x: 0, z: -156, y: DECK_Y, nav: navDeck(), role: 'deck', delay: 8, noNade: true });
          A?.go([ground(-3.5, -146.5, { slow: 0.8 }), { p: V(-3.9, 0, -150.2), nav: null }, { p: V(-1.6, 0, -152), nav: null }, { p: V(22.5, DECK_Y, -152), nav: null, slow: 0.9 }, { p: V(23.8, DECK_Y, -154.6), nav: null }, deck(17, -155.3, { slow: 0.55 })]);
        }, until: (t) => { const on = g.rig.position.y > DECK_Y - 0.5; return on && ((px() < 24 && alive(s => s.floorY > 5) === 0 && t > 4) || t > 80 * T); } },
      { name: 'manifold', wp: V(-6, DECK_Y + 2.6, -155.5), music: 0.9, dusk: 0.7, enter: () => {
          setp.armManifold();
          // trailer: let the objective read for a beat before the autopilot lights it up
          if (A?.p?.autoState) { A.p.autoState.holdFire = true; later(4.2, () => { A.p.autoState.holdFire = false; }); }
          hud.objective('Shoot the fuel manifold');
          say('Red valves, mid-deck. Light it up!', 2.6);
          A?.go([deck(4, -155.2, { slow: 0.6 })]);
        }, until: () => setp.man.state === 'burning' },
      { name: 'escape', wp: V(-4, 2.6, -148.5), music: 1.0, dusk: 0.76, enter: () => {
          audio.play('alarm_klaxon', { x: -6, y: DECK_Y + 3, z: -160, volume: 1 });
          hud.objective('Get off the ship!');
          later(0.6, () => say('She\'s gonna blow! Get off the ship! RUN!!', 2.6));
          this.escapeT = trailer ? 13.5 : 18;
          this.escape0 = this.escapeT;
          later(1.6, () => setp.deckBlast(-16)); later(3.6, () => setp.deckBlast(-4)); later(5.6, () => setp.deckBlast(6)); later(7.8, () => setp.deckBlast(14)); later(10, () => setp.deckBlast(20));
          A?.go([deck(23.5, -154.6, { sprint: true }), { p: V(23.6, DECK_Y, -152), nav: null, sprint: true }, { p: V(21.5, DECK_Y, -152), nav: null, sprint: true }, { p: V(-2.2, 0, -152), nav: null, sprint: true }, { p: V(-3.9, 0, -150.2), nav: null, sprint: true }, ground(-4, -145, { sprint: true }), ground(-6, -133, { sprint: true }), ground(-6.5, -126, { sprint: true })]);
        }, update: (t) => {
          const left = Math.max(0, this.escape0 - t);
          g.bossInfo = { frac: left / this.escape0, name: 'FUEL HOLD — GET CLEAR' }; g.countdown = left;
          if (t % 1.6 < 1 / 30) audio.play('alarm_klaxon', { x: -6, y: DECK_Y + 3, z: -160, volume: 0.7 });
          if (t % 2.3 < 1 / 30) audio.play('metal_groan', { x: -10, y: DECK_Y, z: -165, volume: 0.8 });
          setp.escapeFX(this.dt, t);
          // off the gangway: keep running, get clear of the blast
          if (!this.offShip && t > 3 && g.rig.position.y < 0.5 && pz() > -150) { this.offShip = true; hud.objective('Get clear!'); hud.setWaypoint(V(-6, 0.5, -130)); }
        }, until: (t) => t > this.escape0 || (t > 3 && g.rig.position.y < 0.5 && pz() > -138.5) },
      { name: 'kaboom', wp: null, music: 1.0, dusk: 0.84, enter: () => {
          g.bossInfo = null; g.countdown = null;
          if (g.rig.position.y > 4) g.hurt(70, V(-15, DECK_Y, -167)); // still on the ship: it hurts
          setp.escapeEnd();
          setp.kaboom();
          audio.musicStinger('boss');
          hud.setWaypoint(null);
          // look back over the shoulder while running: the camera follows the fireball up into the cap
          if (A) { g.cinematicLook = V(-15, DECK_Y + 6, -167); g.cinematicW = 3.4; }
        }, update: (t) => { if (g.cinematicLook) g.cinematicLook.y = DECK_Y + 6 + smooth(Math.min(1, t / 2.6)) * 16; },
        until: (t) => t > (trailer ? 4.2 : 6) },
      { name: 'outro', music: 1.0, dusk: 0.9, enter: () => {
          audio.musicStinger('victory');
          A?.go([ground(-6.5, -127)]);
          later(1.0, () => { g.cinematicLook = V(-12, DECK_Y + 14, -168); g.cinematicW = 2.4; });
          later(1.8, () => say('...Was that our boat?', 2.4));
          later(4.6, () => say('We\'ll take the next one.', 2.6));
          later(trailer ? 3.2 : 4.0, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.kills, 'GOON')}  •  ${pl(g.drumsBlown, 'DRUM')}  •  ${pl(g.headshots, 'HEADSHOT')}  •  SCORE ${g.score}`;
            hud.showTitle(V(-12, DECK_Y + 30, -175), 'PORT OF VICTORY', sub, 999);
            g.cinematicLook = V(-12, DECK_Y + 24, -175); g.cinematicW = 2;
          });
        }, until: (t) => t > (trailer ? 11 : 15) },
    ];
    // ?beat=<name>: jump straight to a beat (screenshots / testing): teleport, lights, dusk
    const jump = game.params.get('beat');
    const START = { gate: [1.5, 0, 26.5], maze1: [-3.2, 0, 16], maze1b: [-3.2, 0, 14], maze2: [2.4, 0, -22], crane: [0.5, 0, -64], apron: [2, 0, -98], board: [-3.5, 0, -142], manifold: [16, DECK_Y, -155.3], escape: [2, DECK_Y, -155.3], kaboom: [8, 3.75, -152], outro: [-6, 0, -130] };
    const ji = jump ? this.steps.findIndex(s => s.name === jump) : -1;
    if (ji > 0) {
      for (let i = 0; i < ji; i++) { const st = this.steps[i]; if (st.dusk !== undefined) this.duskTarget = game.dusk = st.dusk; }
      const lit = { maze1b: [0, 1], maze2: [0, 1, 2, 3], crane: [0, 1, 2, 3, 4, 5] }[jump] || (ji >= 6 ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : []);
      for (const i of lit) { const m = game.world.mastLamps[i]; if (m) { m.on = true; m.k = 1; } }
      const p = START[jump]; if (p && !game.params.has('px')) game.rig.position.set(p[0], p[1], p[2]);
      if (ji >= this.steps.findIndex(s => s.name === 'escape')) setp.man.state = 'armed';
      if (jump === 'escape') setp.rupture();
      this.stepIdx = ji - 1;
    }
    this.next();
  }
  lightsOn(idx, stagger = 0.4) {
    const ms = this.g.world.mastLamps;
    idx.forEach((i, k) => this.g.fx.later(k * stagger + 0.2, () => { const m = ms[i]; if (!m || m.on) return; m.on = true; m.k = 0.15; m.flick = 1.1; this.audio.play('impact_metal', { x: m.x, y: 28, z: m.z, volume: 0.3, pitch: 1.6 }); }));
  }
  next() {
    if (this.auto) this.auto.hunt = false;
    this.stepIdx++;
    this.t = 0;
    const s = this.steps[this.stepIdx];
    if (!s) { this.done = true; return; }
    this.cur = s;
    this.audio.setMusicIntensity(s.music);
    if (this.auto) this.auto.hunt = !!s.hunt;
    if (s.wp !== undefined) this.hud.setWaypoint(s.wp);
    if (s.dusk !== undefined) this.duskTarget = s.dusk;
    s.enter();
  }
  update(dt) {
    if (!this.done) {
      this.t += dt; this.total += dt;
      this.dt = dt; this.cur.update?.(this.t);
      if (this.cur.until(this.t) || arrivedAtMarker(this, dt)) this.next();
    }
    this.g.dusk = damp(this.g.dusk, this.duskTarget, 0.35, dt);
    this.g.events.length = 0;
  }
}
