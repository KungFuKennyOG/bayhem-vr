import * as THREE from 'three';
import { clamp, damp } from '../../rng.js';
import { arrivedAtMarker } from '../../beats.js';
import { SNIPERS, START, CURB, SKY, STAIRS, GASWORKS, DIVE_Z, TANKER, XWAY, GORE } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _look = new THREE.Vector3(), _to = new THREE.Vector3();

// =====================================================================================
//  TOKYO SCRAMBLE — the beats. Triggers are positional for real play; the autopilot walks the
//  same route in demo / trailer mode. VR rule: the big moments (the tanker, the gas main) wait
//  until you're looking, and the objective card only comes after the money shot.
// =====================================================================================
export class Director {
  constructor(game, hud, audio, setp, auto, trailer) {
    Object.assign(this, { g: game, hud, audio, sp: setp, auto, trailer });
    this.stepIdx = -1; this.t = 0; this.total = 0; this.done = false;
    this.duskTarget = game.dusk;
    const g = game;
    const T = trailer ? 0.7 : 1;
    const say = (line, d = 3) => { hud.subtitle('DRIVER', line, d); };
    this.say = say;
    const later = (t, fn) => g.fx.later(t, fn);
    const alive = (f) => g.enemiesAlive(f);
    const px = () => g.headPos.x, pz = () => g.headPos.z, py = () => g.rig.position.y;
    const A = auto;
    const go = (x, z, o = {}) => ({ p: V(x, 0, z), nav: 'ground', ...o });
    const S = (o) => g.spawnSoldier({ ...o, y: o.y ?? g.world.fastGround(o.x, o.z) });
    const sniper = (id, o = {}) => { const p = SNIPERS[id]; return S({ x: p.x, y: p.y, z: p.z, face: p.face, role: 'sniper', noNade: true, ...o }); };
    const looking = (P, dot = 0.8) => { g.camera.getWorldDirection(_look); _to.subVectors(P, g.headPos).normalize(); return _look.dot(_to) > dot; };
    this.once = new Set();
    const first = (k) => { if (this.once.has(k)) return false; this.once.add(k); return true; };
    const screens = (on) => { for (const S_ of g.world.screens) S_.alertTarget = on ? 1 : 0; };
    this.react = (e) => {
      if (e.type === 'sniperShot' && first('snipe')) later(0.5, () => say(e.hit ? 'Red dot! Up on the screens — the catwalk!' : 'Sniper on the big screen catwalk! Don\'t let the dot settle on you!', 3));
      if (e.type === 'carBoom' && first('carboom')) later(0.9, () => say('Even the taxis explode. Of course they do.', 2.6));
      if (e.type === 'kill' && e.s.role === 'sniper' && first('sniperdown')) later(0.9, () => say('Sniper down! Good. That one was ruining the ads.', 2.6));
      if (e.type === 'screenDown' && first('screen')) later(0.7, () => say('You shot the cola ad. Somewhere a marketing guy just felt that.', 3));
      if (e.type === 'tankerLeak' && first('leak')) later(0.3, () => say('It\'s leaking! Hit it again!', 2));
    };
    const towerSniper = () => this.snipers?.find(s => s.alive);
    this.steps = [
      // 1 ---- title over the crossing from the station terrace; lasers find the plaza
      { name: 'intro', wp: null, music: 0.3, enter: () => {
          hud.black.material.opacity = 1;
          if (g.player) { g.player.camDip = 0.6; g.player.camDipRate = 0.5; }
          hud.showTitle(V(-30, 24, 0), 'TOKYO SCRAMBLE', 'LEVEL 6  •  KUROGANE, 00:12', trailer ? 4.4 : 5.8);
          audio.startMusic();
          this.snipers = [sniper('c1', { delay: 1.2, lockTime: 2.6 }), sniper('c2', { delay: 2.4, lockTime: 2.8 })];
          for (const s of this.snipers) s.holdFire = true;
          later(0.8, () => say('Kurogane. Midnight. Busiest crossing on Earth, and not one tourist. That\'s how you know.', 3.6));
          later(4.6, () => say('Our guy\'s on the far side of the crossing. His friends are between you and him. Down the stairs.', 3.4));
          if (A) { g.cinematicLook = V(10, 16, -10); g.cinematicW = 1.4; }
          if (g.player) g.player.autoState.holdFire = true;
        }, update: (t) => { hud.black.material.opacity = Math.max(0, 1 - t / 1.8); },
        until: (t) => t > (trailer ? 5.8 : 7.8) },
      // 2 ---- down the stairs, across the plaza, into the scramble
      { name: 'crossing', wp: V(30, 2, -8), hunt: true, arrive: true, music: 0.65, enter: () => {
          g.cinematicLook = null;
          hud.objective('Down the stairs — fight across the scramble');
          if (g.player) g.player.autoState.holdFire = false;
          if (!this.snipers) this.snipers = [sniper('c1', { delay: 0.3, lockTime: 2.6 }), sniper('c2', { delay: 0.6, lockTime: 2.8 })];
          const [s1, s2] = this.snipers;
          s1.holdFire = false; s1.laser.lock = 0; s2.laser.lock = 0; later(10, () => { s2.holdFire = false; });
          S({ x: -56, z: -8, delay: 0.5 }); S({ x: -50, z: 13, delay: 1.0 }); S({ x: -40, z: -26, delay: 1.6, flanker: true });
          S({ x: -12, z: 2, delay: 3 }); S({ x: 4, z: -12, delay: 3.6 }); S({ x: 12, z: 11, delay: 4.2 }); S({ x: -4, z: 19, delay: 5 }); S({ x: 18, z: -18, delay: 6, flanker: true });
          S({ x: 14, z: 4, role: 'rusher', delay: 16, entry: V(26, 0, 0) });
          later(2.0, () => say('Plaza first. Then the crossing — the cars are your cover.', 2.8));
          later(9.0, () => { screens(true); say('...Every screen in Kurogane just went to emergency broadcast. Subtle.', 3.2); });
          A?.go([{ p: V(-74, 0, 0.6), nav: null, slow: 0.8 }, { p: V(-50, 0, 0.6), nav: null, slow: 0.7 }, go(-40, -4, { slow: 0.5 }), go(-20, 4, { slow: 0.45 }), go(0, -2, { slow: 0.45 }), go(18, -6, { slow: 0.5 })]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper') === 0 && px() > 22) || t > 130 * T },
      // 3 ---- east down the avenue to the car park
      { name: 'avenue', wp: V(47, 2, -21), hunt: true, arrive: true, music: 0.75, enter: () => {
          later(0.8, () => say('Car park on the left — up the ramp. The expressway runs right past the roof.', 3.2));
          later(1.4, () => hud.objective('Up through the car park'));
          S({ x: 40, z: -4, delay: 0.5 }); S({ x: 55, z: 6, delay: 1.2 }); S({ x: 62, z: -8, delay: 2 }); S({ x: 76, z: 4, delay: 2.8, flanker: true }); S({ x: 70, z: -14, delay: 3.6 });
          S({ x: 52, z: -22, role: 'rusher', delay: 11, entry: V(48, 0, -20) });
          sniper('g1', { delay: 4, lockTime: 2.8 });
          later(7, () => say('Another dot — across the avenue, on the roof!', 2.6));
          A?.go([go(36, -12, { slow: 0.6 }), go(44, -14, { slow: 0.55 }), go(47, -20, { slow: 0.6 })]);
        }, until: (t) => (t > 6 && alive(s => s.role !== 'sniper') === 0 && px() > 44 && pz() < -18) || t > 110 * T },
      // 4 ---- the decks: deck A, the back ramp, deck B, the link
      { name: 'garage', wp: V(98, XWAY.y + 2, -133), hunt: true, arrive: true, music: 0.8, enter: () => {
          later(0.6, () => say('Two decks. They\'ll come down the ramps at you — use the cars and the pillars.', 3));
          for (const [x, z, d] of [[62, -46, 1], [78, -62, 2], [96, -40, 2.6], [104, -70, 3.4], [84, -83, 5], [60, -100, 7], [82, -116, 8], [102, -104, 9]]) S({ x, z, delay: d, flanker: d > 6 });
          S({ x: 70, z: -96, role: 'rusher', delay: 18, entry: V(66, 0, -84) });
          A?.go([go(56, -22, { slow: 0.7 }), go(72, -22, { slow: 0.6 }), go(92, -22, { slow: 0.6 }), go(100, -42, { slow: 0.5 }), go(105, -74, { slow: 0.5 }), go(104, -83, { slow: 0.6 }), go(70, -83, { slow: 0.6 }), go(56, -90, { slow: 0.5 }), go(80, -112, { slow: 0.5 }), go(97, -126, { slow: 0.6 }), go(97, -133, {})]);
        }, until: (t) => (pz() < -128 && py() > XWAY.y - 0.5 && t > 6) || t > 150 * T },
      // 5 ---- the expressway jam
      { name: 'xway', wp: V(36, XWAY.y + 2, -148), hunt: true, arrive: true, music: 0.85, enter: () => {
          this.sp.tankerArmed = true;
          hud.objective('West along the expressway');
          later(0.6, () => say('Shuto expressway, jammed solid both ways. Duck between the cars and keep going west.', 3.4));
          for (const [x, z, d] of [[84, -147, 0.5], [74, -153, 1.2], [64, -144, 2], [54, -150, 2.8], [46, -156, 3.6], [38, -144, 4.4], [30, -152, 6]]) S({ x, z, delay: d, flanker: d > 3 });
          S({ x: 50, z: -148, role: 'rusher', delay: 14, entry: V(40, 0, -148) });
          sniper('x1', { delay: 6, lockTime: 2.8 });
          later(8, () => say('Roof across the road — red dot, north side!', 2.4));
          A?.go([go(96, -146, { slow: 0.7 }), go(82, -150, { slow: 0.55 }), go(66, -148, { slow: 0.5 }), go(50, -149, { slow: 0.5 }), go(38, -148, { slow: 0.6 })]);
        }, until: (t) => (t > 6 && alive(s => s.role !== 'sniper') === 0 && px() < 44) || t > 130 * T },
      // 6 ---- the tanker: shoot it (it's what you'd do) — or someone does it for you once you're looking
      { name: 'tanker', wp: V(TANKER.x, XWAY.y + 4, TANKER.z), music: 0.95, enter: () => {
          this.lookT = 0; this._pt = 0; this.sp.tankerArmed = true; this.sp.autoTanker = true;
          say('That\'s a fuel tanker. In the middle of a jam. On a bridge. ...Yeah, you know what to do.', 3.6);
          S({ x: 32, z: -146, delay: 1 }); S({ x: 31, z: -156, delay: 2 });
          if (A) later(2.5, () => { g.cinematicLook = this.sp.tanker.center.clone(); g.cinematicW = 2; });
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          const T_ = this.sp.tanker;
          if (T_ && T_.state !== 'boom' && t > 12) {
            if (first('tankhint')) say('The TANKER! Shoot the tanker!', 2);
            this.lookT = looking(T_.center, 0.82) ? this.lookT + dt : 0;
            if (this.lookT > 0.4 || t > 22) this.sp.damageTanker(99);
          }
          for (const e of g.events) {
            if (e.type === 'tankerBoom') { hud.setWaypoint(null); later(1.6, () => say('...She\'s going— the WHOLE SPAN is going—', 2.6)); if (A) { g.cinematicLook = V(10, 6, -150); g.cinematicW = 2.2; } }
            if (e.type === 'spanDown') later(1.4, () => say('...You dropped a piece of expressway on a street. In Tokyo. They will never let me drive here again.', 4));
          }
        }, until: (t) => (this.sp.span?.phase === 'down' && this.sp.span.t > 2.2) || t > 60 },
      // 7 ---- down the off-ramp into Center-gai (spectacle first: the objective comes after)
      { name: 'offramp', wp: V(10, 2, -135), hunt: true, music: 0.8, enter: () => {
          g.cinematicLook = null;
          later(1.2, () => hud.objective('The off-ramp — down into Center-gai'));
          S({ x: 46, z: -135, delay: 1.5 }); S({ x: 26, z: -135, delay: 2.5 }); S({ x: 3, z: -118, delay: 3.5 });
          A?.go([go(86, -136, { slow: 0.8 }), go(60, -135, { slow: 0.6 }), go(34, -135, { slow: 0.55 }), go(12, -135, { slow: 0.6 })]);
        }, until: (t) => (px() < 15 && py() < 1.2 && t > 2) || t > 90 * T },
      // 8 ---- south down Center-gai
      { name: 'center', wp: V(0, 2, -74), hunt: true, arrive: true, music: 0.85, enter: () => {
          hud.objective('South down Center-gai, back to the crossing');
          say('Center-gai. Watch the shops — they love a doorway.', 2.8);
          for (const [x, z, d] of [[-4, -112, 0.5], [4, -104, 1.2], [-3, -96, 2], [5, -88, 2.8], [-5, -80, 3.6], [3, -66, 4.4], [-2, -58, 6]]) S({ x, z, delay: d, flanker: d > 3 });
          S({ x: 0, z: -60, role: 'rusher', delay: 13, entry: V(0, 0, -80) });
          later(14, () => { if (this.cur?.name === 'center') say('Smell that? The fuel off that tanker\'s running into the drains...', 3); });
          A?.go([go(2, -122, { slow: 0.6 }), go(-2, -108, { slow: 0.5 }), go(2, -94, { slow: 0.5 }), go(-2, -82, { slow: 0.5 }), go(0, -74, { slow: 0.6 })]);
        }, until: (t) => (t > 6 && alive(s => s.role !== 'sniper') === 0 && pz() > -80) || t > 120 * T },
      // 9 ---- the gas main: look back up the street (VR: wait for the look), then RUN
      { name: 'gas', wp: V(GASWORKS.x, 5, GASWORKS.z), music: 1.0, enter: () => {
          this.lookT = 0; this._pt = 0; this.went = false;
          for (const s of g.soldiers) if (s.alive && s.role !== 'sniper') s.delay = 999;
          hud.objT = Math.min(hud.objT, 0.3);
          say('Wait— that\'s gas. The fuel\'s in the gas main. LOOK — back up the street!', 3.2);
          if (A) { g.cinematicLook = V(0, 4, -124); g.cinematicW = 3; }
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          if (!this.went) {
            this.lookT = looking(V(GASWORKS.x, 3, GASWORKS.z), 0.78) ? this.lookT + dt : 0;
            if (this.lookT > 0.35 || t > 5) {
              this.went = true; this.sp.startGas();
              later(0.5, () => say('RUN! RUN! OUT TO THE CROSSING!', 2.4));
              later(1.6, () => { hud.objective('RUN! Out into the crossing!'); hud.setWaypoint(V(0, 2, -8)); });
              if (A) { later(0.9, () => { g.cinematicLook = null; A.go([{ p: V(0, 0, -40), nav: null, sprint: true }, { p: V(0, 0, -8), nav: null, sprint: true }]); }); }
            }
          }
          if (this.went && t > 3 && first('halfway') && pz() > -50) say('Keep going! It\'s right behind you!', 1.8);
        }, until: () => pz() > DIVE_Z },
      // 10 ---- the dive: the last one comes out of the street behind you
      { name: 'dive', wp: null, music: 1.0, enter: () => {
          this.sp.finale();
          say('GET DOWN!', 1.4);
          later(2.4, () => say('...Okay. Okay. You\'re alive. The street isn\'t.', 3));
          if (A) { A.go([{ p: V(2, 0, 4), nav: null, sprint: true }]); later(0.8, () => { g.cinematicLook = V(0, 5, -34); g.cinematicW = 1.5; }); }
        }, until: (t) => t > (trailer ? 5 : 6) },
      { name: 'outro', music: 1.0, enter: () => {
          audio.musicStinger('victory');
          audio.stopLoop('fire_big');
          g.bossInfo = null;
          later(trailer ? 1.2 : 1.8, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.kills, 'GOON')}  •  ${pl(g.snipersDown, 'SNIPER')}  •  ${pl(g.carsBlown, 'CAR')}  •  1 EXPRESSWAY  •  SCORE ${g.score}`;
            const P = g.headPos.clone().add(V(0, 3, -12));
            hud.showTitle(P, 'TOKYO SCRAMBLE', sub, 999);
            g.cinematicLook = P.clone();
          });
        }, update: (t) => { hud.black.material.opacity = clamp((t - 0.2) / 1.2, 0, 0.55); },
        until: (t) => t > (trailer ? 7 : 10) },
    ];
    // ?beat=<name>: jump straight to a beat (screenshots / testing)
    const jump = game.params.get('beat');
    const START_P = { crossing: [-49, CURB, 0.6], avenue: [26, 0.15, -8], garage: [47, CURB, -21], xway: [97, XWAY.y, -136], tanker: [38, XWAY.y, -148], offramp: [40, XWAY.y, -148], center: [10, CURB, -135], gas: [0, CURB, -76], dive: [0, CURB, -26], outro: [0, 0, -14] };
    const ji = jump ? this.steps.findIndex(s => s.name === jump) : -1;
    if (ji > 0) {
      const p = START_P[jump]; if (p && !game.params.has('px')) game.rig.position.set(p[0], p[1], p[2]);
      const idx = (n) => this.steps.findIndex(s => s.name === n);
      g.quietScore = true; g.fx.later(3, () => { g.quietScore = false; });
      if (ji > idx('crossing')) screens(true);
      if (ji > idx('tanker')) { setp.tankerArmed = true; setp.blowTanker(); setp.spanDownNow(); g.slowT = 0; }
      if (ji > idx('gas')) { setp.startGas(); setp.gas.F = DIVE_Z - 6; for (const S_ of setp.shops) S_.done = true; g.slowT = 0; }
      if (jump === 'gas' || jump === 'dive' || jump === 'outro') g.dusk = 0.6;
      g.score = [0, 0, 1800, 3600, 7400, 11000, 15500, 17200, 20400, 24200, 26800, 26800][ji] || 0;
      for (const c of hud.callouts) hud.scene.remove(c.s); hud.callouts.length = 0;
      for (const L of Object.values(hud.lanes || {})) { L.q.length = 0; L.cur = null; }
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
    s.enter();
  }
  update(dt) {
    if (!this.done) {
      this.t += dt; this.total += dt;
      this.g.fx.dt0 = dt;
      for (const e of this.g.events) this.react(e);
      this.cur.update?.(this.t);
      if (this.cur.until(this.t) || arrivedAtMarker(this, dt)) this.next();
    }
    // the screens tear over to the emergency broadcast row by row
    for (const S of this.g.world.screens) if (S.alertTarget !== undefined) S.alert = damp(S.alert, S.alertTarget, 0.7, dt);
    this.g.events.length = 0;
  }
}
