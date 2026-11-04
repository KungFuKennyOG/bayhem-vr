import * as THREE from 'three';
import { pick, range, clamp, damp, rand } from '../../rng.js';
import { SNIPERS, TOWER, LEGS, START, LOW_Y, RAMP_N, RAMP_S, BRIDGE, BOAT_DOCK, PONTOON, RIVERBOAT } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _look = new THREE.Vector3(), _to = new THREE.Vector3();

// =====================================================================================
//  THE IRON LADY — the beats. Triggers are positional for real play; the autopilot walks the
//  same route in demo / trailer mode. VR rule: the big moments wait until you're looking.
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
    const px = () => g.headPos.x, pz = () => g.headPos.z;
    const A = auto;
    const go = (x, z, o = {}) => ({ p: V(x, 0, z), nav: 'ground', ...o });
    const S = (o) => g.spawnSoldier({ ...o, y: o.y ?? g.world.fastGround(o.x, o.z) });
    const sniper = (id, o = {}) => { const p = SNIPERS[id]; return S({ x: p.x, y: p.y, z: p.z, face: p.face, role: 'sniper', noNade: true, ...o }); };
    const towerC = V(TOWER.x, 150, TOWER.z);
    // is the player looking at P (head direction + line of sight)?
    const looking = (P, dot = 0.8) => { g.camera.getWorldDirection(_look); _to.subVectors(P, g.headPos).normalize(); return _look.dot(_to) > dot; };
    this.once = new Set();
    const first = (k) => { if (this.once.has(k)) return false; this.once.add(k); return true; };
    this.react = (e) => {
      if (e.type === 'sniperShot' && first('snipe')) later(0.5, () => say(e.hit ? 'Balconies! Red dot! Keep moving!' : 'Snipers on the balconies — don\'t let the dot settle on you!', 3));
      if (e.type === 'carBoom' && first('carboom')) later(0.9, () => say('Even the Peugeots explode. Of course they do.', 2.6));
      if (e.type === 'kill' && e.s.role === 'sniper' && first('sniperdown')) later(0.9, () => say('Sniper down! Off the balcony, very French.', 2.6));
    };
    const quayTargets = () => alive(s => s.role !== 'deck');
    this.steps = [
      // 1 ---- title over the river, the tower sparkling in the rain
      { name: 'intro', wp: null, music: 0.3, dusk: 0.15, enter: () => {
          hud.black.material.opacity = 1;
          if (g.player) { g.player.camDip = 0.6; g.player.camDipRate = 0.5; }
          setp.T.state.sparkle = 1;
          hud.showTitle(V(60, 30, -70), 'THE IRON LADY', 'LEVEL 5  •  PARIS, 21:00', trailer ? 4.4 : 5.8);
          audio.startMusic();
          this.introSnipers = [sniper('n1', { delay: 1.4 }), sniper('n2', { delay: 2.6, lockTime: 2.4 })];
          for (const s of this.introSnipers) s.holdFire = true;
          later(0.8, () => say('Paris. Nine o\'clock — she does the sparkle on the hour. Pretty, right?', 3.4));
          later(4.4, () => say('Our guy is in the tower. His friends are on the quay. Go say bonsoir.', 3.2));
          A?.go([go(166, 45.5, { slow: 0.6 })]);
          if (A) { g.cinematicLook = V(40, 70, -100); g.cinematicW = 1.6; } // desktop / trailer: frame the tower (VR starts facing it)
          if (g.player) g.player.autoState.holdFire = true;
        }, update: (t) => { hud.black.material.opacity = Math.max(0, 1 - t / 1.8); },
        until: (t) => t > (trailer ? 5.8 : 7.8) },
      // 2 ---- the quay fight
      { name: 'quay', wp: V(70, LOW_Y + 2.4, 44), hunt: true, music: 0.65, dusk: 0.25, enter: () => {
          g.cinematicLook = null;
          hud.objective('Fight down the quay to the bridge');
          if (g.player) g.player.autoState.holdFire = false;
          setp.T.state.sparkle = 0;
          if (!this.introSnipers) this.introSnipers = [sniper('n1', { delay: 0.2 }), sniper('n2', { delay: 0.5, lockTime: 2.4 })];
          // one sniper at a time: the second one only opens up once the first has had a go
          const [s1, s2] = this.introSnipers;
          s1.holdFire = false; s1.laser.lock = 0;
          s2.laser.lock = 0; later(9, () => { s2.holdFire = false; });
          S({ x: 142, z: 47, delay: 0.4 }); S({ x: 133, z: 43, delay: 1.0 }); S({ x: 120, z: 49, delay: 1.6, flanker: true });
          S({ x: 110, z: 44, delay: 2.4 }); S({ x: 98, z: 47.5, delay: 3.2 });
          S({ x: 82, z: 45, role: 'rusher', delay: 9, entry: V(105, 0, 44) });
          later(2.0, () => say('Use the barges and the bar for cover. And keep an eye on those balconies.', 3));
          A?.go([go(156, 46.5, { slow: 0.55 }), go(146, 43.5, { slow: 0.5 }), go(134, 47.5, { slow: 0.45 })]);
        }, update: (t) => {
          // the riverboat: comes up behind you once you're into the fight
          if (!setp.boat && (t > 16 * T || px() < 132 || quayTargets() <= 2)) {
            setp.spawnRiverboat(Math.max(px() + 80, 230));
            later(0.4, () => say('BEHIND YOU — ON THE RIVER! A tour boat full of them!', 3));
            hud.setWaypoint(V(setp.boat.x, -2, RIVERBOAT.z));
            this.boatWp = true;
          }
          if (this.boatWp && setp.boat) { if (setp.boat.state === 'cruise') hud.setWaypoint(setp.boat.fuelW.clone().setY(setp.boat.fuelW.y + 3)); else { this.boatWp = false; hud.setWaypoint(V(70, LOW_Y + 2.4, 44)); } }
          if (setp.boat && setp.boat.state === 'cruise' && this.t > 0 && first('fueltip')) later(5, () => { if (setp.boat.state === 'cruise') say('The fuel tank — at the stern! Hit it with a grenade!', 3); });
          for (const e of g.events) if (e.type === 'boatBoom') later(1.2, () => say('...You set fire to a bateau-mouche. On the Seine. They will write songs about you.', 3.6));
        },
        until: (t) => (t > 6 && quayTargets() === 0 && setp.boat && setp.boat.state !== 'cruise') || t > 110 * T },
      // 3 ---- up the ramp, across the bridge (tower snipers on the first platform)
      { name: 'bridge', wp: V(0, 2.5, -46), hunt: true, music: 0.8, dusk: 0.35, enter: () => {
          hud.objective('Cross the bridge to the tower');
          later(0.6, () => say('Up the ramp and across the bridge. She\'s waiting.', 2.8));
          S({ x: 26, z: 63, delay: 0.5 }); S({ x: 8, z: 46, delay: 1.2 });
          S({ x: -3, z: 24, delay: 2.0 }); S({ x: 7, z: 14, delay: 2.6, flanker: true }); S({ x: -7, z: 2, delay: 3.4 });
          S({ x: 6, z: -12, delay: 4.2 }); S({ x: -2, z: -30, delay: 5 }); S({ x: 8, z: -40, delay: 5.6 });
          S({ x: 0, z: -20, role: 'rusher', delay: 14 });
          sniper('t1', { delay: 4, lockTime: 2.6 });
          later(7, () => say('Laser from the FIRST PLATFORM — up on the tower!', 2.8));
          A?.go([go(80, 45, { slow: 0.7 }), go(64, 49, {}), go(28, 49.5, {}), go(16, 56, { slow: 0.6 }), go(5, 44, { slow: 0.5 }), go(-5, 28, { slow: 0.45 }), go(5, 12, { slow: 0.45 }), go(-4, -6, { slow: 0.45 })]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper') === 0 && pz() < -20) || (pz() < -56 && t > 6) || t > 120 * T },
      // 4 ---- the gunship, threading the legs
      { name: 'gunship', wp: null, music: 1.0, dusk: 0.45, enter: () => {
          hud.objective('Bring down the gunship');
          later(0.4, () => audio.play('heli_flyby', { x: -150, y: 20, z: 0, volume: 0.6 }));
          later(1.2, () => setp.spawnHeli());
          later(2.2, () => say('Gunship — up the river! WIDOWMAKER again?! How many of these does this guy OWN?', 3.4));
          later(9.0, () => say('Grenades! And stay under the lattice, it can\'t see through all that iron!', 3));
          S({ x: -20, z: -92, delay: 6 }); S({ x: 26, z: -118, delay: 9, flanker: true }); S({ x: -30, z: -150, delay: 14 }); S({ x: 18, z: -166, delay: 18 });
          sniper('t2', { delay: 12, lockTime: 2.8 });
          A?.go([go(4, -50, { slow: 0.7 }), go(10, -82, { slow: 0.6 }), go(-6, -112, { slow: 0.5 })]);
        }, update: (t) => {
          for (const e of g.events) {
            if (e.type === 'thread') later(0.3, () => say('It\'s going THROUGH the tower! Between the legs!', 2.4));
            if (e.type === 'heliDying') { later(0.3, () => say('Hit! It\'s going down— no no no, not into the TOWER—', 3)); g.cinematicLook = setp.heli.pos; g.cinematicW = 3.5; }
            if (e.type === 'heliCrash') {
              g.cinematicLook = e.P.clone(); g.cinematicW = 3;
              later(trailer ? 2.6 : 3.2, () => { g.cinematicLook = null; });
              later(1.6, () => say('...Okay. Okay. Into the LEG. That\'s... that\'s bad. Hear that?', 3.2));
            }
          }
        }, until: (t) => (setp.heli && !setp.heli.alive && t > 3 && !g.cinematicLook) || t > 160 },
      // 5 ---- get out from under it: she's listing, girders are falling
      { name: 'evac', wp: V(RAMP_S.xHigh + 4, 2.6, -49), music: 0.9, dusk: 0.55, enter: () => {
          // nothing on screen but the tower for a beat, then the objective (spectacle first)
          later(1.2, () => hud.objective('GET OUT FROM UNDER HER — the river, EAST!'));
          say('She\'s groaning — she\'s LEANING! Get out from under her! Down to the river, east!', 3.4);
          for (const s of g.soldiers) if (s.alive) s.delay = 999;
          A?.go([go(30, -96, { sprint: true }), go(64, -66, { sprint: true }), go(RAMP_S.xHigh - 2, -49, { sprint: true }), { p: V(RAMP_S.xLow + 2, 0, -49), nav: null, sprint: true }, go(RAMP_S.xLow + 14, -45, { sprint: true })]);
        }, update: (t) => {
          if (t > 4 && t % 3 < g.fx.dt0) setp.tear(10, 120, 3, -1, 4);
        }, until: (t) => (px() > RAMP_S.xLow - 4 && g.rig.position.y < LOW_Y + 1.5) || t > 45 },
      // 6 ---- the fall: wait for the look, then she goes over across the river
      { name: 'collapse', wp: towerC, music: 1.0, dusk: 0.62, enter: () => {
          this.lookT = 0; this.fell = false; this._pt = 0;
          hud.objT = Math.min(hud.objT, 0.3);
          say('LOOK! LOOK AT HER! She\'s going over!', 3);
          if (A) { later(1.0, () => setp.startFall()); g.cinematicLook = towerC.clone(); g.cinematicW = 2.6; }
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          if (!setp.fall || setp.fall.phase === 'wounded') {
            this.lookT = looking(towerC, 0.75) ? this.lookT + dt : 0;
            if (this.lookT > 0.35 || t > 5) setp.startFall();
          }
          // keep the look on the top while it comes down (desktop / trailer only)
          if (g.cinematicLook && setp.fall) { const tip = setp.T.rig.S[16].clone().add(setp.T.root.position); g.cinematicLook.lerp(tip, 0.06); }
          for (const e of g.events) {
            if (e.type === 'bridgeHit') { later(0.8, () => say('...She took the bridge with her.', 2.6)); }
            if (e.type === 'spireHit') later(2.8, () => say('And the whole north bank. Somebody\'s getting a very big bill.', 3));
          }
        }, until: (t) => (setp.fall?.phase === 'down' && setp.fall.t > 1.4) || t > 40 },
      // 7 ---- run: a wall of spray and dust coming down the river; the boat
      { name: 'run', wp: V(BOAT_DOCK.x, 0, BOAT_DOCK.z), music: 1.0, dusk: 0.7, enter: () => {
          g.cinematicLook = null;
          setp.startWall(); setp.callBoat();
          later(0.2, () => say('Here comes the spray — RUN! I\'m bringing the boat to the pontoon!', 3.2));
          later(1.4, () => hud.objective('RUN! The boat — down the quay!'));
          A?.go([go(BOAT_DOCK.x - 26, -46, { sprint: true }), go(PONTOON.x0 + 5, -42, { sprint: true }), { p: V(BOAT_DOCK.x, 0, PONTOON.z1 - 0.6), nav: null, sprint: true, tol: 0.8 }]);
        }, update: (t) => {
          const E = setp.escape;
          if (E && E.state === 'wait') {
            hud.setWaypoint(E.root.position.clone().setY(LOW_Y + 2.2));
            const d = Math.hypot(px() - E.root.position.x, pz() - (PONTOON.z0 + PONTOON.z1) / 2);
            if (d < 6 && first('jumpin')) say('GET IN!', 1.4);
            if (d < 4.5 && g.headPos.z > PONTOON.z0 - 0.5) setp.board();
          }
        }, until: () => setp.riding },
      // 8 ---- the getaway
      { name: 'escape', wp: null, music: 1.0, dusk: 0.8, enter: () => {
          hud.setWaypoint(null);
          g.slowmo(1.6, 0.35, true);
          later(0.8, () => say('Hold on to something!', 1.8));
          later(3.8, () => say('...I\'ll miss her. She had a good run. Mostly before you showed up.', 3.6));
        }, until: (t) => t > (trailer ? 9 : 11) },
      { name: 'outro', music: 1.0, dusk: 0.85, enter: () => {
          audio.musicStinger('victory');
          audio.stopLoop('dust_roar');
          g.bossInfo = null;
          later(trailer ? 1.2 : 1.8, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.kills, 'GOON')}  •  ${pl(g.snipersDown, 'SNIPER')}  •  ${pl(g.carsBlown, 'CAR')}  •  1 TOWER  •  SCORE ${g.score}`;
            const P = g.headPos.clone().add(V(-12, 2.5, 0));
            hud.showTitle(P, 'THE IRON LADY', sub, 999);
            g.cinematicLook = P.clone();
          });
        }, update: (t) => { hud.black.material.opacity = clamp((t - 0.2) / 1.2, 0, 0.55); },
        until: (t) => t > (trailer ? 7 : 10) },
    ];
    // ?beat=<name>: jump straight to a beat (screenshots / testing)
    const jump = game.params.get('beat');
    const START_P = { quay: [166, LOW_Y, 45.5], bridge: [76, LOW_Y, 45], gunship: [2, 0, -60], evac: [-4, 0, -112], collapse: [RAMP_S.xLow + 10, LOW_Y, -45], run: [RAMP_S.xLow + 14, LOW_Y, -45], escape: [BOAT_DOCK.x, LOW_Y, PONTOON.z1 - 0.6], outro: [BOAT_DOCK.x, LOW_Y, PONTOON.z1 - 0.6] };
    const ji = jump ? this.steps.findIndex(s => s.name === jump) : -1;
    if (ji > 0) {
      for (let i = 0; i < ji; i++) { const st = this.steps[i]; if (st.dusk !== undefined) this.duskTarget = game.dusk = st.dusk; }
      const p = START_P[jump]; if (p && !game.params.has('px')) game.rig.position.set(p[0], p[1], p[2]);
      const idx = (n) => this.steps.findIndex(s => s.name === n);
      if (ji > idx('quay')) { setp.spawnRiverboat(60); setp.explodeBoat(); setp.boat.x = BRIDGE.half + 30; setp.boat.burnT = 30; g.slowT = 0; }
      if (ji > idx('gunship')) { setp.spawnHeli(); setp.heli.pos.copy(setp.crashPoint()); setp.killHeli(); setp._heliCrash(); g.cinematicLook = null; g.slowT = 0; for (const c of hud.callouts) hud.scene.remove(c.s); hud.callouts.length = 0; }
      if (ji > idx('collapse')) setp.collapsedState();
      if (ji > idx('run')) { setp.callBoat(); setp.escape.x = BOAT_DOCK.x; setp.escape.state = 'wait'; }
      if (ji >= idx('escape')) { setp.board(); }
      g.score = [0, 0, 1200, 3400, 9800, 11200, 12400, 24000, 25600, 25600][ji] || 0;
      // drop whatever the fast-forward queued (score callouts from the scripted kills)
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
    if (s.dusk !== undefined) this.duskTarget = s.dusk;
    s.enter();
  }
  update(dt) {
    if (!this.done) {
      this.t += dt; this.total += dt;
      this.g.fx.dt0 = dt;
      for (const e of this.g.events) this.react(e);
      this.cur.update?.(this.t);
      if (this.cur.until(this.t)) this.next();
    }
    this.g.dusk = damp(this.g.dusk, this.duskTarget, 0.3, dt);
    this.g.events.length = 0;
  }
}
