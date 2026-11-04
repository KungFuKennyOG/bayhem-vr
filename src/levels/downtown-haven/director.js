import * as THREE from 'three';
import { pick, range, clamp, damp, rand } from '../../rng.js';
import { SNIPERS, SUBWAY, LOBBY, MERIDIAN, CROSS } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _look = new THREE.Vector3(), _to = new THREE.Vector3(), _tgt = new THREE.Vector3();

// =====================================================================================
//  DOWNTOWN HAVEN CITY — the beats. Triggers are positional for real play; the autopilot
//  walks the same route in demo / trailer mode.
// =====================================================================================
export class Director {
  constructor(game, hud, audio, setp, auto, trailer) {
    Object.assign(this, { g: game, hud, audio, sp: setp, auto, trailer });
    this.stepIdx = -1; this.t = 0; this.total = 0; this.done = false;
    this.duskTarget = game.dusk;
    const g = game;
    const T = trailer ? 0.7 : 1;
    const say = (line, d = 3) => { audio.play('radio_squelch', { volume: 0.6 }); hud.subtitle('DRIVER', line, d); };
    this.say = say;
    const later = (t, fn) => g.fx.later(t, fn);
    const alive = (f) => g.enemiesAlive(f);
    const pz = () => g.headPos.z, px = () => g.headPos.x;
    const A = auto;
    const ground = (x, z, o = {}) => ({ p: V(x, 0, z), nav: 'ground', ...o });
    const S = (o) => g.spawnSoldier(o);
    const sniper = (id, o = {}) => { const p = SNIPERS[id]; return S({ x: p.x, y: p.y, z: p.z, face: p.face, role: 'sniper', noNade: true, ...o }); };
    const inLobby = (s) => s.pos.x > LOBBY.x0 - 0.5 && s.pos.z < LOBBY.z1 && s.pos.z > LOBBY.z0;
    const subTop = V((SUBWAY.x0 + SUBWAY.x1) / 2, 0, SUBWAY.zTop);
    this.once = new Set();
    const first = (k) => { if (this.once.has(k)) return false; this.once.add(k); return true; };
    // reactions that can happen in any beat
    this.react = (e) => {
      if (e.type === 'sniperShot' && first('snipe')) later(0.5, () => say(e.hit ? 'That was a fifty-cal! Keep MOVING, don\'t let the dot settle!' : 'Fifty-cal! Don\'t let that red dot sit on you!', 3));
      if (e.type === 'carBoom' && first('carboom')) later(0.9, () => say('...Okay. The cars are bombs. Noted.', 2.6));
      if (e.type === 'kill' && e.s.role === 'sniper' && first('sniperdown')) later(0.9, () => say('Sniper down! Look at him go!', 2.4));
      if (e.type === 'kill' && e.s.role === 'sniper' && this.once.has('sniperdown') && g.snipersDown === 3) later(0.9, () => say('That\'s three. Roofs are getting quieter.', 2.6));
    };
    this.steps = [
      { name: 'intro', wp: null, music: 0.3, dusk: 0.05, enter: () => {
          hud.black.material.opacity = 1;
          if (g.player) { g.player.camDip = 0.6; g.player.camDipRate = 0.5; }
          hud.showTitle(V(0, 34, -110), 'DOWNTOWN HAVEN CITY', 'LEVEL 3  •  GLASS CANYON', trailer ? 4.2 : 5.5);
          audio.startMusic();
          this.introSnipers = [sniper('s1', { delay: 1.2 }), sniper('s2', { delay: 2.2, lockTime: 2.4 })];
          for (const s of this.introSnipers) s.holdFire = true; // they paint you during the title, they shoot once the fight starts
          later(0.8, () => say('Haven City. The guy who owned that ship? He owns that tower. Meridian.', 3.6));
          later(3.4, () => g.birds.spook(V(-2, 0, 8), 1.4)); // the flock goes up as the first laser finds the street
          later(4.6, () => say('Red dots on the asphalt... ROOFTOPS! Watch the rooftops!', 3));
          A?.go([ground(-4.4, 31.2, { slow: 0.8 })]);
          if (g.player) g.player.autoState.holdFire = true; // let the title breathe
        }, update: (t) => { hud.black.material.opacity = Math.max(0, 1 - t / 1.8); },
        until: (t) => t > (trailer ? 5.5 : 7.5) },
      { name: 'avenue', wp: V(0, 2.5, -40), hunt: true, music: 0.65, dusk: 0.1, enter: () => {
          hud.objective('Take out the rooftop snipers');
          if (g.player) g.player.autoState.holdFire = false;
          if (!this.introSnipers) this.introSnipers = [sniper('s1', { delay: 0.2 }), sniper('s2', { delay: 0.4, lockTime: 2.4 })];
          for (const s of this.introSnipers || []) { s.holdFire = false; s.laser.lock = Math.min(s.laser.lock, s.laser.lockTime * 0.4); }
          S({ x: -5.6, z: 4.5, delay: 0.4 });
          S({ x: 6.5, z: -0.5, delay: 1.0 });
          S({ x: -9.6, z: -12.5, delay: 1.6, flanker: true });
          S({ x: 10.0, z: -17, delay: 2.4 });
          S({ x: 0.5, z: -26, role: 'rusher', delay: 8, entry: V(-1, 0, -10) });
          later(2.0, () => say('Two on the roofs, more in the cars! Use the traffic for cover.', 3));
          A?.go([ground(-4.6, 24.5, { slow: 0.55 }), ground(5.4, 15.6, { slow: 0.5 }), ground(-0.6, 6.2, { slow: 0.45 })]);
        }, until: (t) => (t > 4 && alive() === 0) || t > 75 * T },
      { name: 'avenue2', wp: V(0, 2.5, -53), hunt: true, music: 0.8, dusk: 0.16, enter: () => {
          sniper('s3', { delay: 0.5 }); sniper('s4', { delay: 2.5, lockTime: 1.9 });
          S({ x: -30, z: -51, delay: 0.6, entry: V(-7.5, 0, -40) });
          S({ x: 30, z: -55, delay: 1.4, entry: V(7.4, 0, -38), flanker: true });
          S({ x: -3.5, z: -38, delay: 2.0 });
          S({ x: 0, z: -48, role: 'rusher', delay: 6.5 });
          later(0.6, () => say('More of them at the intersection — and two more roofs!', 3));
          A?.go([ground(5.6, -4.6, { slow: 0.5 }), ground(-2.0, -12.2, { slow: 0.5 }), ground(5.0, -20.5, { slow: 0.45 })]);
        }, until: (t) => (t > 4 && alive() === 0) || t > 75 * T },
      { name: 'gunship', wp: null, music: 1.0, dusk: 0.22, enter: () => {
          hud.objective('Bring down the gunship');
          later(0.4, () => { audio.play('heli_flyby', { x: 80, y: 30, z: -53, volume: 0.6 }); });
          later(1.6, () => setp.spawnHeli());
          later(2.4, () => say('Is that— ANOTHER gunship?! Do they get them in bulk?!', 3));
          later(7.0, () => say('Grenades! Hit it with the grenades!', 2.4));
          S({ x: -24, z: -50, delay: 9 }); S({ x: 25, z: -56, delay: 12, flanker: true });
          A?.go([ground(-3.0, -31.5, { slow: 0.6 })]);
        }, update: (t) => {
          for (const e of g.events) {
            if (e.type === 'strafe') later(0.4, () => say('Strafing run! Get behind something solid!', 2.4));
            if (e.type === 'heliDying') { later(0.3, () => say('It\'s going down— it\'s going— oh. Oh no. Not that way.', 3)); g.cinematicLook = setp.heli.pos; g.cinematicW = 3.5; }
            if (e.type === 'heliCrash') {
              g.cinematicLook = V(MERIDIAN.impact[0], MERIDIAN.impact[1] + 4, MERIDIAN.impact[2]); g.cinematicW = 3;
              later(trailer ? 3.0 : 3.6, () => { g.cinematicLook = null; });
              later(2.2, () => say('...Right into Meridian. Well. That\'s one way to ring the doorbell.', 3.4));
            }
          }
        }, until: (t) => (setp.heli && !setp.heli.alive && t > 3 && !g.cinematicLook) || t > 150 },
      { name: 'lobby', wp: V(15.5, 2.6, LOBBY.doors[0][0] + 2), hunt: true, music: 0.85, dusk: 0.3, enter: () => {
          hud.objective('Clear the Haven Trust lobby');
          later(0.8, () => say('They\'re dug in behind the glass at Haven Trust. Go in loud.', 3));
          for (const [x, z, o] of [[21.5, -93, {}], [26, -100, { flanker: true }], [30.4, -103, {}], [34.5, -95, {}], [24.5, -112, {}], [33, -116, { flanker: true }], [38, -107, {}]]) S({ x, z, delay: range(0.2, 1.6), noNade: false, ...o });
          S({ x: -6, z: -96, delay: 1.5 }); S({ x: 5, z: -104, delay: 2.5, flanker: true });
          sniper('s6', { delay: 3 }); sniper('s5', { delay: 6, lockTime: 2.4 });
          A?.go([ground(-1.5, -50, { slow: 0.7 }), ground(5.2, -70, { slow: 0.6 }), ground(10.6, -84, { slow: 0.5 }), ground(14.4, -88.4, { slow: 0.45 }), ground(19.5, -89, { slow: 0.45 }), ground(22, -96, { slow: 0.4 })]);
        }, update: (t) => {
          const inside = g.headPos.x > LOBBY.x0 + 1.5 && pz() < LOBBY.z1 && pz() > LOBBY.z0;
          const lob = alive(inLobby);
          if (!setp.lobbyDone && t > 4 && (inside && t > 3 || (lob <= 3 && t > 10))) {
            setp.lobbyCollapse();
            later(0.2, () => say('Whoa whoa — the whole block\'s shaking! Is that MERIDIAN?!', 3));
          }
        }, until: (t) => (t > 6 && alive(s => s.role !== 'sniper') === 0 && setp.lobbyDone) || t > 110 * T },
      { name: 'collapse', wp: V(15.5, 2.6, LOBBY.doors[0][0] + 2), music: 1.0, dusk: 0.38, enter: () => {
          // VR can't steer your head, so the beat earns the look: 1) get out to the street, 2) the waypoint marks
          // the Meridian and the collapse waits until you're actually looking at it, 3) only then: RUN.
          this.runT = -1; this.lookT = 0; this.fell = false; this.running = false; this._pt = 0; this.outT = -1;
          hud.objective('Get out to the street!');
          say('The whole block\'s shaking — get OUT of there! Out to the avenue!', 3);
          // kill anything left (they run too)
          for (const s of g.soldiers) if (s.alive && s.role === 'sniper') s.delay = 999;
          if (A) { later(1.0, () => setp.startCollapse()); this.runT = 0; } // autopilot / trailer: the cinematic look covers it
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          if (!setp.col) {
            const out = px() < LOBBY.x0 - 0.5 || pz() > LOBBY.z1 || pz() < LOBBY.z0;
            if (this.outT < 0 && ((out && t > 0.5) || t > 14)) {
              this.outT = t;
              hud.objT = Math.min(hud.objT, 0.3); // the "get out" card fades: nothing on screen but the tower
              hud.setWaypoint(V(0, 66, -167));
              say('LOOK DOWN THE AVENUE! MERIDIAN — it\'s going!', 3);
            }
            if (this.outT >= 0) {
              g.camera.getWorldDirection(_look); _to.set(0, 66, -167).sub(g.headPos).normalize();
              const seen = _look.dot(_to) > 0.8 && g.col.visible(g.headPos, _tgt.set(0, 66, -167));
              this.lookT = seen ? this.lookT + dt : 0;
              if (this.lookT > 0.35 || t - this.outT > 5) setp.startCollapse();
            }
          }
          for (const e of g.events) if (e.type === 'collapseFall' && !this.fell) { this.fell = true; if (this.runT < 0) this.runT = t + 1.6; }
          // 2) RUN: objective + waypoint to the subway, once it's tipping
          if (this.runT >= 0 && t >= this.runT && !this.running) {
            this.running = true;
            if (g.world) g.world.beaconK = 1; // the subway globes blaze through the dust: the one thing to find
            hud.objective('RUN! Get underground — the subway!');
            hud.setWaypoint(V(subTop.x, 2.4, subTop.z));
            if (!A) say('It\'s coming DOWN THE AVENUE! The subway — back by the intersection! RUN!', 3.2);
            else { say('Meridian\'s coming down! It\'s coming DOWN THE AVENUE! RUN!', 3); later(3.5, () => say('The subway — back by the intersection! GO GO GO!', 3)); }
            A?.go([ground(19.6, -88.6, { sprint: true }), ground(14.4, -88.4, { sprint: true }), ground(6.5, -82, { sprint: true }), ground(5.5, -52, { sprint: true }), ground(9.6, -46.5, { sprint: true }), ground(13.7, -43.4, { sprint: true }), { p: V(subTop.x, 0, SUBWAY.zTop + 0.6), nav: null, sprint: true }, { p: V(subTop.x, 0, SUBWAY.zBot + 1.5), nav: null, sprint: true, tol: 0.8 }]);
          }
          for (const e of g.events) {
            if (e.type === 'collapseFall') this.lookBack = 1; // as soon as you're out on the street
            if (e.type === 'closeCall') { g.cinematicLook = e.P.clone().setY(9); g.cinematicW = 3.2; later(trailer ? 2.0 : 2.4, () => { g.cinematicLook = null; }); later(0.6, () => say('DON\'T LOOK BACK! DUST! THERE\'S A WALL OF DUST!', 2.6)); }
          }
          // the dust wall catches up: one last look over the shoulder in slow-mo, then dive
          const D = setp.dust;
          if (D && !this.dustLook && pz() - D.z < 15 && pz() < SUBWAY.zTop - 4) { this.dustLook = true; g.slowmo(2.2, 0.32, true); g.cinematicLook = V(px(), 6, D.z - 12); g.cinematicW = 3.2; later(trailer ? 1.8 : 2.2, () => { g.cinematicLook = null; }); }
          if (this.dustLook && g.cinematicLook && D) g.cinematicLook.set(px(), 6, D.z - 12);
          // the look back down the avenue at the leaning tower, once you're out of the lobby
          if (this.lookBack === 1 && px() < LOBBY.x0 - 1) { this.lookBack = 2; g.cinematicLook = V(0, 52, -165); g.cinematicW = 2.4; later(trailer ? 2.6 : 3.2, () => { g.cinematicLook = null; }); }
        }, until: () => g.rig.position.y < -1.4 && pz() > SUBWAY.zTop + 2 },
      { name: 'dive', wp: null, music: 1.0, dusk: 0.42, enter: () => {
          if (g.world) g.world.beaconK = 0;
          g.slowmo(2.6, 0.3, true);
          audio.play('body_fall', { volume: 1 });
          g.cinematicLook = V(subTop.x, 3.5, SUBWAY.zTop - 6); g.cinematicW = 2.4;
          // the dust wall pours over the entrance behind you
          this.pourT = 0;
        }, update: (t) => {
          this.pourT += 1;
          if (t < 4) for (let i = 0; i < 4; i++) g.fx.main.spawn({ x: range(SUBWAY.x0 - 4, SUBWAY.x1 + 4), y: range(0.5, 6), z: SUBWAY.zTop + range(-6, 1), vx: range(-1, 1), vy: range(-2.5, 0.5), vz: range(3, 7), drag: 0.5, frameKind: 2, frame: rand() * 40, frames: 16, s0: 3, s1: range(8, 14), life: range(2.5, 4), rot: rand() * 6, r: 0.5, g: 0.44, b: 0.36, a: 0.95, fadeIn: 0.05, fadeOut: 0.4 });
          hud.black.material.opacity = clamp((t - 1.4) / 2.2, 0, 0.94);
        }, until: (t) => t > (trailer ? 3.6 : 4.4) },
      { name: 'outro', music: 1.0, dusk: 0.45, enter: () => {
          audio.musicStinger('victory');
          audio.stopLoop('dust_roar');
          g.bossInfo = null;
          later(0.8, () => say('...Kid? KID! Say something!', 2.4));
          later(3.6, () => say('...Oh, thank God. Okay. Airport. Last stop. I\'m bringing a bigger truck.', 3.8));
          later(trailer ? 1.6 : 2.2, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.kills, 'GOON')}  •  ${pl(g.snipersDown, 'SNIPER')}  •  ${pl(g.carsBlown, 'CAR')}  •  SCORE ${g.score}`;
            g.cinematicLook = V(subTop.x, 3.5, SUBWAY.zTop - 6);
            hud.showTitle(V(subTop.x, 3.6, SUBWAY.zTop - 5), 'DOWNTOWN HAVEN CITY', sub, 999);
          });
        }, update: (t) => { hud.black.material.opacity = 0.94; },
        until: (t) => t > (trailer ? 8 : 11) },
    ];
    // ?beat=<name>: jump straight to a beat (screenshots / testing)
    const jump = game.params.get('beat');
    const START = { avenue: [-4.4, 0, 31], avenue2: [-0.6, 0, 6], gunship: [-3, 0, -31], lobby: [-2, 0, -46], collapse: [24, 0.15, -104], dive: [13.7, 0, -42.5], outro: [13.7, -4, -29] };
    const ji = jump ? this.steps.findIndex(s => s.name === jump) : -1;
    if (ji > 0) {
      for (let i = 0; i < ji; i++) { const st = this.steps[i]; if (st.dusk !== undefined) this.duskTarget = game.dusk = st.dusk; }
      const p = START[jump]; if (p && !game.params.has('px')) game.rig.position.set(p[0], p[1], p[2]);
      if (ji > this.steps.findIndex(s => s.name === 'gunship')) { setp.spawnHeli(); setp.heli.pos.set(...MERIDIAN.impact); setp.killHeli(); setp._heliCrash(); g.cinematicLook = null; g.slowT = 0; for (const c of hud.callouts) hud.scene.remove(c.s); hud.callouts.length = 0; }
      if (ji > this.steps.findIndex(s => s.name === 'collapse')) setp.collapsedState();
      if (ji > this.steps.findIndex(s => s.name === 'lobby')) { setp.lobbyDone = true; for (const p of g.glass.panes) if (p.kind === 'sky' || p.kind === 'lobby') g.glass.shatter(p, p.c, p.n.clone().negate(), 0.5, { quiet: true, life: 1 }); }
      this.stepIdx = ji - 1;
    }
    this.next();
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
      for (const e of this.g.events) this.react(e);
      this.cur.update?.(this.t);
      if (this.cur.until(this.t)) this.next();
    }
    this.g.dusk = damp(this.g.dusk, this.duskTarget, 0.3, dt);
    this.g.events.length = 0;
  }
}
