import * as THREE from 'three';
import { pick, range, clamp, damp } from '../../rng.js';
import { CARGO } from './aircraft.js';
import { JEEP_STOP, START, TAXI } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// =====================================================================================
//  AIRPORT NO RETURN — the beats. Triggers are positional / kill-based for real play; the
//  autopilot walks the same route in demo / trailer mode. ?beat=<name> jumps to a beat.
// =====================================================================================
export class Director {
  constructor(game, hud, audio, setp, auto, trailer) {
    Object.assign(this, { g: game, hud, audio, sp: setp, auto, trailer });
    this.stepIdx = -1; this.t = 0; this.total = 0; this.done = false;
    this.duskTarget = game.dusk;
    const g = game, T = trailer ? 0.7 : 1;
    const say = (line, d = 3, who = 'DRIVER') => { audio.play('radio_squelch', { volume: 0.6 }); hud.subtitle(who, line, d); };
    const later = (t, fn) => g.fx.later(t, fn);
    const alive = (f) => g.enemiesAlive(f);
    const pz = () => g.headPos.z, px = () => g.headPos.x;
    const A = auto;
    const ground = (x, z, o = {}) => ({ p: V(x, 0, z), nav: 'ground', ...o });
    const S = (o) => g.spawnSoldier(o);
    this.say = say;
    this.steps = [
      { name: 'intro', wp: null, music: 0.25, dusk: 0.0, enter: () => {
          hud.black.material.opacity = 1;
          hud.showTitle(V(START.x - 6, 15, START.z - 70), 'AIRPORT NO RETURN', 'LEVEL 4  •  RUNWAY 27  •  SUNSET', trailer ? 4.2 : 5.5);
          audio.startMusic();
          audio.play('ship_horn', { x: 0, y: 8, z: 168, volume: 0.25, pitch: 2.2 });
          later(0.8, () => say('Last stop. Their boss is on that grey cargo plane, wheels-up in five.', 3.4));
          later(4.4, () => say('I\'m gonna find us a ride. You go make some noise on the apron.', 3.2));
          A?.go([ground(226, 352, { slow: 0.75 }), ground(228, 334, { slow: 0.8 })]);
        }, update: (t) => { hud.black.material.opacity = Math.max(0, 1 - t / 1.8); },
        until: (t) => t > (trailer ? 6.0 : 8.0) },
      { name: 'apronA', wp: V(212, 2.6, 288), hunt: true, music: 0.6, dusk: 0.03, enter: () => {
          hud.objective('Cross the apron');
          S({ x: 214, z: 302, delay: 0.3, flanker: false });
          S({ x: 186, z: 312, delay: 0.8, flanker: true });
          S({ x: 246, z: 296, delay: 0.5 });
          S({ x: 204 + 0, z: 316.5, y: 4.42, role: 'perch', delay: 0.6 });
          S({ x: 264, z: 304, delay: 2.0, role: 'rusher' });
          S({ x: 196, z: 276, delay: 4.0, entry: V(200, 0, 296) });
          later(1.2, () => say('Welcoming committee, twelve o\'clock! Use the fuel trucks — JET A-1 really wants to explode.', 3.6));
          A?.go([ground(226, 324, { slow: 0.6 }), ground(220, 308, { slow: 0.55 })]);
        }, until: (t) => (t > 4 && alive() === 0) || t > 70 * T || (t > 10 && pz() < 278) },
      { name: 'apronB', wp: V(186, 2.6, 214), hunt: true, music: 0.8, dusk: 0.06, enter: () => {
          S({ x: 240, z: 254, delay: 0.4 });
          S({ x: 240, z: 226, delay: 0.8, flanker: true });
          S({ x: 214, z: 246, delay: 0.2 });
          S({ x: 196, z: 232, delay: 1.5, role: 'rusher' });
          S({ x: 252, z: 228, delay: 2.4, flanker: true });
          S({ x: 230, z: 204, delay: 3.6, entry: V(226, 0, 224) });
          S({ x: 236, z: 262, delay: 5.0 });
          later(0.8, () => say('More of them by the parked airliner. Don\'t hit the jet. Hit the TRUCK next to the jet.', 3.4));
          A?.go([ground(214, 272, { slow: 0.6 }), ground(222, 256, { slow: 0.55 }), ground(212, 238, { slow: 0.5 })]);
        }, until: (t) => (t > 5 && alive() === 0) || t > 75 * T || (t > 12 && pz() < 212 && alive() <= 2) },
      { name: 'taxi', wp: null, music: 0.95, dusk: 0.09, enter: () => {
          hud.objective('Stop those jets!');
          setp.startJets();
          S({ x: 176, z: 170.5, y: 4.42, role: 'perch', delay: 1.0 });
          S({ x: 164, z: 186, delay: 1.5 });
          S({ x: 150, z: 160, delay: 2.5, flanker: true });
          later(0.6, () => say('Two jets on the taxiway — packed with his guys! They are NOT taking off!', 3.2));
          later(4.2, () => say('Shoot the engines! Grenades! Anything!', 2.4));
          A?.go([ground(180, 214, { slow: 1.0 }), ground(150, 202, { slow: 0.9 })]); // get close to the taxiway: the jet kills are the level's money shot
        }, update: (t) => {
          const j0 = setp.jets[0];
          g.bossInfo = j0.state === 'taxi' || j0.state === 'hurt' ? { frac: Math.max(0, (j0.eng[0].hp + j0.eng[1].hp) / 24), name: 'SUNWEST 27  —  ENGINES' } : null;
          for (const e of g.events) {
            if (e.type === 'jetBoom' && e.J.idx === 0) { later(1.6, () => say('Oh, that\'s gonna be on the news.', 2.4)); setp.startTakeoff(); }
            if (e.type === 'jetBoom' && e.J.idx === 1) later(2.2, () => say('...And THAT one didn\'t have brakes. Okay!', 2.6));
          }
          // nobody shot them? the lead jet's engine gives up anyway once it's level with the apron (see setpieces)
        }, until: (t) => (setp.jets[1].state === 'boom' || setp.jets[1].state === 'wreck') && t > 2 || t > 60 * T },
      { name: 'getaway', wp: V(JEEP_STOP.x + 0.5, 3.4, JEEP_STOP.z + 1.5), music: 0.75, dusk: 0.12, enter: () => {
          g.bossInfo = null;
          setp.startTakeoff();
          for (const s of g.soldiers) if (s.alive && s.pos.distanceTo(g.headPos) > 45) s.alive = false, s.root.visible = false; // stragglers leave
          later(0.4, () => say('He\'s rolling! The cargo plane is ROLLING!', 2.4));
          later(1.6, () => setp.jeepArrive());
          later(3.2, () => say('Look left! Checkered jeep! I borrowed it! Get in the back!', 3));
          A?.go([ground(JEEP_STOP.x + 3.5, JEEP_STOP.z + 6, { sprint: true, tol: 1.0 })]);
        }, update: (t) => {
          if (setp.jeep.state === 'wait') {
            hud.objective('Get in the jeep', 3);
            const bed = setp.jeep.root.localToWorld(V(0, 1.0, 1.45));
            if (Math.hypot(g.headPos.x - bed.x, g.headPos.z - bed.z) < 3.2) setp.board();
            if (A && A.idle) A.go([{ p: bed.clone().setY(0), nav: null, sprint: true, tol: 0.5 }]);
          }
        }, until: () => setp.riding && setp.ride.state === 'chase' },
      { name: 'chase1', wp: null, music: 1.0, dusk: 0.16, enter: () => {
          hud.objective('Catch that plane!', 4);
          say('HOLD ON TO SOMETHING!', 2);
          later(7, () => { setp.spawnCar({ side: -1, dz: 4, from: 70, slots: ['R', 'roof'] }); setp.spawnCar({ side: 1, dz: 9, from: 95, slots: ['L', 'roof'] }); });
          later(9.5, () => say('Company! Black SUVs, six o\'clock!', 2.4));
        }, update: (t) => this._chaseBar(),
        until: (t) => t > 24 * (trailer ? 0.85 : 1) || (t > 14 && setp.cars.every(c => !c.alive)) },
      { name: 'chase2', wp: null, music: 1.0, dusk: 0.2, enter: () => {
          setp.spawnCar({ side: 1, dz: -2, from: 80, slots: ['L', 'FL', 'roof'] });
          later(1.5, () => say('They\'re shooting from the ramp! Take \'em out!', 2.4));
          later(4.5, () => { setp.dropPallet('drums'); setp.swerveT = 1.4; setp.swerveA = 3.2; });
          later(5.2, () => say('BARRELS! Hang on!', 1.6));
          later(10.5, () => { setp.dropPallet('crate'); later(0.5, () => setp.dropPallet('drums')); setp.swerveT = 1.6; setp.swerveA = -3.4; });
        }, update: (t) => this._chaseBar(),
        until: (t) => t > (trailer ? 15 : 18) },
      { name: 'jump', wp: null, music: 1.0, dusk: 0.23, enter: () => {
          setp.allowRotate = true;
          setp._cargoBoost = 1.0;
          say('He\'s rotating! I\'m putting you under that ramp — you JUMP!', 3);
          for (const c of setp.cars) if (c.alive) c.ramT = 99;
        }, update: (t) => {
          this._chaseBar();
          const c = setp.cargo;
          const ready = setp.gap !== undefined && setp.gap < 9 && (c.state === 'rotate' || c.state === 'climb');
          if (ready && !this.jumpPrompt) { this.jumpPrompt = true; hud.objective(g.player.mode === 'vr' ? 'JUMP!  (grip / A)' : 'JUMP!  (SPACE)', 2.5); say('NOW! JUMP!!', 1.6); g.slowmo(1.2, 0.45, true); }
          if (ready && (this._jumpPressed() || A || t > 30)) setp.beginLeap();
          if (this.jumpPrompt && !setp.leapT && this.t > 0 && this._promptT === undefined) this._promptT = 0;
          if (this._promptT !== undefined && setp.leapT === undefined) { this._promptT += 1 / 30; if (this._promptT > 3) setp.beginLeap(); }
        }, until: () => setp.ride.state === 'onPlane' },
      { name: 'aboard', wp: null, music: 1.0, dusk: 0.3, enter: () => {
          g.bossInfo = null;
          audio.musicStinger('victory');
          g.cinematicLook = setp.jeep.root.position.clone().setY(1); g.cinematicW = 3;
          later(1.0, () => say('Yeah! YEAH! You made it!', 2));
          later(3.2, () => say('I\'m okay, by the way! The jeep... is not.', 2.8));
          later(trailer ? 4.5 : 5.5, () => { g.cinematicLook = null; });
        }, update: (t) => { if (g.cinematicLook && setp.jeep.rb) g.cinematicLook.copy(setp.jeep.rb.pos).setY(1); },
        until: (t) => t > (trailer ? 6.5 : 8) },
      { name: 'credits', wp: null, music: 0.6, dusk: 0.62, enter: () => {
          setp.holdNight = 0; // the hold goes to red night lighting as the credits roll
          const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
          setp.rollCredits([
            { text: 'BAYHEM', big: true, sub: 'A FILM BY EXPLOSIONS' },
            null,
            { text: `${pl(g.kills, 'GOON')}  •  ${pl(g.jetsDown, 'JET')}  •  ${pl(g.carsDown, 'SUV')}`, dim: true },
            { text: `${pl(g.headshots, 'HEADSHOT')}  •  SCORE ${g.score}`, dim: true },
            null,
            { text: 'STARRING', dim: true }, { text: 'YOU' },
            null,
            { text: 'THE DRIVER', dim: true }, { text: 'HIMSELF' },
            null,
            { text: 'THE JEEP', dim: true }, { text: 'IN LOVING MEMORY' },
            null,
            { text: 'THE FORKLIFT', dim: true }, { text: 'AS ITSELF' },
            null,
            { text: 'GOONS', dim: true }, { text: 'ALL OF THEM' },
            null,
            { text: 'NO JETS WERE HARMED', dim: true }, { text: '(THAT IS A LIE)' },
            null, null,
            { text: 'THANKS FOR PLAYING', big: true },
          ]);
          say('Hey — where are we flying?', 2.4, 'DRIVER');
          later(3.0, () => say('...Is that a question I should be worried about?', 2.8, 'DRIVER'));
          A?.go([]);
        }, update: (t) => {
          g.cinematicLook = setp.cargo.root.localToWorld(V(0, CARGO.floorY + 2.4, 30)); g.cinematicW = 2; // eye on the sky band where the credits roll
          g.scene.fog.far = Math.min(5200, g.scene.fog.far + (1 / 30) * 300); // open up the view: airport lights on the horizon
          // last shot: the ramp starts closing on the sunset
          if (t > (trailer ? 18 : 24)) { setp.rampA = Math.max(-0.42, setp.rampA - (1 / 30) * 0.06); setp.cargo.setRamp(setp.rampA); }
          if (t > (trailer ? 22 : 30)) hud.black.material.opacity = Math.min(1, (t - (trailer ? 22 : 30)) / 2);
        }, until: (t) => t > (trailer ? 25 : 33) },
    ];
    // ?beat=<name>: jump straight to a beat (screenshots / testing)
    const jump = game.params.get('beat');
    const START_AT = { apronA: [226, 0, 326], apronB: [216, 0, 274], taxi: [190, 0, 220], getaway: [150, 0, 190], chase1: null, chase2: null, jump: null, aboard: null, credits: null };
    const ji = jump ? this.steps.findIndex(s => s.name === jump) : -1;
    if (ji > 0) {
      for (let i = 0; i < ji; i++) { const st = this.steps[i]; if (st.dusk !== undefined) this.duskTarget = game.dusk = st.dusk; }
      const p = START_AT[jump]; if (p && !game.params.has('px')) game.rig.position.set(p[0], p[1], p[2]);
      if (ji >= this.steps.findIndex(s => s.name === 'getaway')) {
        for (const J of setp.jets) { J.a.root.position.z = J.z = TAXI.zBlow - J.idx * 20; setp.explodeJet(J); }
        g.slowT = 0; g.timeScale = 1;
        setp.startTakeoff();
      }
      if (ji >= this.steps.findIndex(s => s.name === 'chase1')) {
        // fast-forward: plane already rolling, you're in the jeep at the right distance behind it
        const lead = { chase1: 0, chase2: 24, jump: 40, aboard: 58, credits: 58 }[jump] ?? 0;
        setp.fastForward(lead);
      }
      if (ji >= this.steps.findIndex(s => s.name === 'aboard')) { setp.cargo.state = 'climb'; setp.cargo.pitch = 0.13; setp.cargo.alt = jump === 'credits' ? 60 : 4; setp.cargo.vy = 6; setp.cargo.v = 66; setp.beginLeap(); setp.leapT = 2; g.slowT = 0; }
      this.stepIdx = ji - 1;
    }
    setp._cargoBoost = 1;
    this.next();
  }
  _jumpPressed() {
    const p = this.g.player;
    if (p.mode === 'desktop') return !!(p.keys?.Space) || !!p.mouseDown?.[0];
    for (const c of p.controllers) { const gp = c.source?.gamepad; if (gp && (gp.buttons[1]?.pressed || gp.buttons[4]?.pressed || gp.buttons[5]?.pressed)) return true; }
    return false;
  }
  _chaseBar() {
    const c = this.sp.cargo, k = clamp(c.v / 58, 0, 1);
    this.g.bossInfo = { frac: k, name: c.state === 'roll' ? `STRATOFREIGHTER  —  TAKEOFF SPEED ${Math.round(k * 100)}%` : 'STRATOFREIGHTER  —  ROTATING!' };
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
      this.cur.update?.(this.t);
      if (this.cur.until(this.t)) this.next();
    }
    this.g.dusk = damp(this.g.dusk, this.duskTarget, 0.3, dt);
    this.g.events.length = 0;
  }
}
