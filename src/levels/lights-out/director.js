import * as THREE from 'three';
import { clamp, damp, range } from '../../rng.js';
import { arrivedAtMarker } from '../../beats.js';
import { POWER, DIST } from './kit.js';
import { START, STAIRS, LSTREET, GATE, GSTAIR, G40, BALC, LOWROOF, BRIDGE, CROWN, PLAZA, F1, F2, TANKER, CLIMB, SKYST, FOOTB, LOBBY, TERRACE, LOCKER, ROOFTOP, PSPAN, FLYOVER_W, TOWER, stairY, climbY, groundAt } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _look = new THREE.Vector3(), _to = new THREE.Vector3();

// =====================================================================================
//  LIGHTS OUT — the beats. Positional triggers for real play; the autopilot walks the same route
//  for demo / trailer capture. VR rules: the big moments (the pancake, the blackout, the tower)
//  wait for the look; the objective only after the money shot; reaching a marker moves the beat on.
// =====================================================================================
const CITY_LOOK = new THREE.Vector3(80, 60, 150);   // the city the blackout sweeps across (seen from the plaza)
export class Director {
  constructor(game, hud, audio, setp, auto, trailer) {
    Object.assign(this, { g: game, hud, audio, sp: setp, auto, trailer });
    this.stepIdx = -1; this.t = 0; this.total = 0; this.done = false;
    const g = game;
    const T = trailer ? 0.7 : 1;
    const say = (line, d = 3) => { hud.subtitle('DRIVER', line, d); };
    this.say = say;
    const later = (t, fn) => g.fx.later(t, fn);
    const alive = (f) => g.enemiesAlive(f);
    const px = () => g.headPos.x, pz = () => g.headPos.z, py = () => g.rig.position.y;
    const A = auto;
    const go = (x, z, o = {}) => ({ p: V(x, 0, z), nav: 'ground', ...o });
    const S = (o) => g.spawnSoldier({ ...o, y: o.y ?? groundAt(o.x, o.z) });
    // perch on whatever is highest at (x, z) (a roof, a deck, a balcony)
    const perch = (x, z, d, o = {}) => S({ x, z, y: o.y ?? g.col.groundAt(x, z, 999), role: 'perch', delay: d, noNade: true, ...o });
    const sniper = (x, z, face, o = {}) => S({ x, z, y: o.y ?? g.col.groundAt(x, z, 999), face, role: 'sniper', noNade: true, ...o });
    const looking = (P, dot = 0.8) => { g.camera.getWorldDirection(_look); _to.subVectors(P, g.headPos).normalize(); return _look.dot(_to) > dot; };
    this.once = new Set();
    const first = (k) => { if (this.once.has(k)) return false; this.once.add(k); return true; };
    const night = (n) => { this.nightTarget = n; };
    this.nightTarget = g.night;
    this.react = (e) => {
      if (e.type === 'sniperShot' && first('snipe')) later(0.5, () => say(e.hit ? 'Red dot — he\'s got the angle on you!' : 'Sniper! Watch for the red line in the fog!', 2.8));
      if (e.type === 'carBoom' && first('carboom')) later(0.9, () => say('Longwu taxis. Built to go bang. Apparently.', 2.6));
      if (e.type === 'kill' && e.s.role === 'sniper' && first('sniperdown')) later(0.9, () => say('Sniper down. Good.', 2));
      if (e.type === 'kill' && e.s.role === 'perch' && first('perchdown')) later(0.6, () => say('That\'s a long way down for him.', 2.2));
      if (e.type === 'tankerLeak' && first('leak')) later(0.3, () => say('It\'s leaking! Again!', 1.8));
      if (e.type === 'spotted' && first('spotted')) later(0.2, () => say('Searchlight\'s on you! Shoot the lamp — no light, no aim!', 3));
      if (e.type === 'searchlightDown' && first('sldown')) later(0.6, () => say('Ha! Lights out for HIM.', 2.2));
      if (e.type === 'canopyDown' && first('canopy')) later(0.6, () => say('Canopy\'s gone — he\'s going for a swim!', 2.6));
      if (e.type === 'boatDown' && first('boat')) later(0.8, () => say('Boat\'s clear! It\'s all yours — bring it in!', 2.8));
      if (e.type === 'heliUp' && first('heliup')) later(1.6, () => say('GUNSHIP! Right off the edge! Hit it — the cockpit, the engines, anything!', 3.4));
      if (e.type === 'heliDrop' && first('helidrop')) later(0.8, () => say('It\'s roping guys onto the roof! Get them on the ropes!', 2.8));
      if (e.type === 'heliHurt' && first('helihurt')) later(0.5, () => say('Engine\'s hit! It\'s smoking — stay on it!', 2.4));
      if (e.type === 'heliDive' && first('helidive')) later(0.6, () => say('It dropped under the edge — watch the sides, it\'s coming back up!', 3));
      if (e.type === 'heliDying' && first('helidying')) later(0.8, () => say('It\'s going DOWN — it\'s going into the hill—', 2.4));
      if (e.type === 'slide' && first('slidevo')) later(1.6, () => say('The BANK — the whole riverside\'s going with it!', 2.8));
    };
    const glow = (k) => { this.glowTarget = k; };
    this.steps = [
      // 1 ---- the roof: title over the gorge at dusk, the city's lights coming on
      { name: 'intro', wp: null, music: 0.3, enter: () => {
          night(0.26);
          hud.black.material.opacity = 1;
          if (g.player) { g.player.camDip = 0.6; g.player.camDipRate = 0.5; }
          hud.showTitle(V(-100, 74, 132), 'LIGHTS OUT', 'LEVEL 9  •  LONGWU, 18:40', trailer ? 4.4 : 5.8);
          audio.startMusic();
          later(0.9, () => say('Longwu. A city built on a cliff, in the fog, two rivers deep. Last stop.', 3.6));
          later(5.0, () => say('Their whole crew is holed up in Jinlong Tower — the gold one, way across the ravine. Down the Hundred Steps.', 4));
          if (A) { g.cinematicLook = V(-75, 18, 300); g.cinematicW = 1.2; }
          if (g.player) g.player.autoState.holdFire = true;
        }, update: (t) => { hud.black.material.opacity = Math.max(0, 1 - t / 1.8); },
        until: (t) => t > (trailer ? 6.5 : 9.5) },
      // 2 ---- the Hundred Steps: shoot DOWN the flights, UP at the flyover
      { name: 'steps', wp: V(-62, 52, 76), hunt: true, arrive: true, music: 0.65, enter: () => {
          night(0.3); g.cinematicLook = null; if (g.player) g.player.autoState.holdFire = false;
          hud.objective('Down the Hundred Steps');
          S({ x: -106, z: 74, delay: 0.6 }); S({ x: -104, z: 79, delay: 1.4 }); S({ x: -86, z: 73, delay: 2.2 }); S({ x: -84, z: 80, delay: 3.0, flanker: true });
          S({ x: -70, z: 76, delay: 4.5 }); S({ x: -60, z: 84, delay: 6, flanker: true });
          perch(FLYOVER_W.x0 + 2, 64, 1.8); perch(FLYOVER_W.x1 - 2, 90, 3.4);
          sniper(-87, 94, [-1, -0.15], { y: FLYOVER_W.y, delay: 5, lockTime: 2.8 });
          S({ x: -72, z: 76, role: 'rusher', delay: 16, entry: V(-80, 0, 76) });
          later(1.8, () => say('They\'re on the landings below you — and up on the flyover. Look up, look down.', 3.4));
          A?.go([{ p: V(-124, 0, 76), nav: null, slow: 0.7 }, go(-112, 76, { slow: 0.5 }), go(-104, 74, { slow: 0.45 }), go(-92, 77, { slow: 0.45 }), go(-82, 76, { slow: 0.5 }), go(-68, 76, { slow: 0.5 }), go(-62, 78, {})]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper' && s.role !== 'perch') === 0 && px() > -70) || t > 150 * T },
      // 3 ---- Lantern Street: the cliff-top street, the monorail through the tower, to the red gate
      { name: 'lstreet', wp: V((GATE.x0 + GATE.x1) / 2, 52, 93), hunt: true, arrive: true, music: 0.75, enter: () => {
          night(0.42);
          hud.objective('East along Lantern Street — the red gate');
          later(0.6, () => say('Lantern Street. Go east — the red gate takes you down into Lantern Cliff.', 3.2));
          for (const [x, z, d] of [[-34, 78, 0.5], [-14, 84, 1.2], [6, 74, 2], [24, 82, 2.8], [44, 89, 3.6], [62, 75, 5], [80, 84, 7]]) S({ x, z, delay: d, flanker: d > 4 });
          perch(0, 64.4, 2.4); perch(40, 64.4, 4.2); perch(70, 64.4, 6);
          sniper(92, 64.6, [-0.85, 0.5], { delay: 8, lockTime: 2.8 });
          S({ x: 40, z: 80, role: 'rusher', delay: 18, entry: V(60, 0, 80) });
          later(9, () => say('Rooftops on your left! They\'re over the shops!', 2.4));
          A?.go([go(-50, 82, { slow: 0.55 }), go(-24, 86, { slow: 0.5 }), go(4, 88, { slow: 0.5 }), go(32, 86, { slow: 0.5 }), go(58, 86, { slow: 0.5 }), go(84, 92, {})]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper' && s.role !== 'perch') === 0 && px() > 70) || t > 150 * T },
      // 4 ---- down the atrium stair onto the gallery: fight along it — UP at the balconies, DOWN at the roofs
      { name: 'gallery', wp: V(G40.x1 - 3, 42, 109), hunt: true, arrive: true, music: 0.8, enter: () => {
          night(0.55);
          hud.objective('Down through the gate — along the gallery to the bridge');
          later(0.5, () => say('Down the stairs, along the gallery. They\'re on the balconies over you — and the roofs under you.', 3.6));
          for (const [x, z, d, fl] of [[66, 108, 3], [80, 110, 4], [94, 107, 5.5], [104, 111, 7], [48, 109, 9, true]]) S({ x, z, delay: d, flanker: !!fl });
          for (const [x, d] of [[60, 4], [84, 5.5], [100, 7]]) perch(x, (BALC.z0 + BALC.z1) / 2, d, { y: BALC.y });
          for (const [x, d] of [[52, 5], [76, 6.5], [98, 8.5]]) perch(x, (LOWROOF.z0 + LOWROOF.z1) / 2, d, { y: LOWROOF.y });
          S({ x: 100, z: 109, role: 'rusher', delay: 16, entry: V(104, 0, 109) });
          A?.go([{ p: V(84, 0, 93), nav: null, slow: 0.7 }, { p: V(84, 0, 102), nav: null, slow: 0.6 }, { p: V(64, 0, 102), nav: null, slow: 0.55 }, { p: V(58, 0, 102), nav: null, slow: 0.55 }, go(58, 108, { slow: 0.55 }), go(76, 108, { slow: 0.5 }), go(92, 108, { slow: 0.5 }), go(108, 109, {})]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper' && s.role !== 'perch') === 0 && px() > 100) || t > 160 * T },
      // 5 ---- the Qiansi bridge: 38 m over the ravine, gunmen on the arch's crown
      { name: 'bridge', wp: V(BRIDGE.x1 + 2, 42, 109), hunt: true, arrive: true, music: 0.85, enter: () => {
          night(0.68);
          hud.objective('Across the Qiansi bridge');
          later(0.6, () => say('Qiansi bridge. Don\'t look down. ...Okay, look down a little. Then look UP — the arch!', 3.6));
          for (const [x, z, d, fl] of [[128, 106, 0.6], [140, 112, 1.4], [152, 106, 2.4], [164, 111, 3.4], [176, 104, 5, true], [182, 112, 7, true]]) S({ x, z, delay: d, flanker: !!fl });
          perch(CROWN.x0 + 2, 104, 2.2, { y: CROWN.y }); perch(CROWN.x1 - 2, 114, 3.6, { y: CROWN.y });
          sniper(196, 39.4, [-0.75, 0.66], { delay: 6, lockTime: 3 });
          S({ x: 170, z: 108, role: 'rusher', delay: 15, entry: V(178, 0, 100) });
          A?.go([go(116, 109, { slow: 0.55 }), go(130, 109, { slow: 0.5 }), go(146, 110, { slow: 0.5 }), go(160, 108, { slow: 0.5 }), go(174, 109, {})]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper' && s.role !== 'perch') === 0 && px() > 168) || t > 150 * T },
      // 6 ---- the plaza under the stacked interchange: perch gunmen on both decks
      { name: 'plaza', wp: V(276, 42, 96), hunt: true, arrive: true, music: 0.85, enter: () => {
          night(0.82);
          hud.objective('Through the plaza under the interchange');
          later(0.6, () => say('Interchange. Two decks of road over your head — and they\'re up on both.', 3.2));
          for (const [x, z, d, fl] of [[192, 92, 0.6], [206, 100, 1.4], [222, 84, 2.2], [240, 94, 3.2], [256, 100, 4.4], [272, 90, 5.6, true], [264, 76, 7, true], [210, 74, 8.5, true]]) S({ x, z, delay: d, flanker: !!fl });
          perch(196, 57, 1.6, { y: F1.y }); perch(276, 57, 2.6, { y: F1.y }); perch(214, 58, 3.4, { y: F2.y }); perch(246, 58, 4.4, { y: F2.y });
          S({ x: 250, z: 96, role: 'rusher', delay: 16, entry: V(270, 0, 96) });
          A?.go([go(184, 100, { slow: 0.55 }), go(200, 96, { slow: 0.5 }), go(220, 98, { slow: 0.5 }), go(240, 100, { slow: 0.5 }), go(262, 98, { slow: 0.5 })]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'perch') === 0) || t > 140 * T },
      // 7 ---- the tanker over the substation: shoot it (or it goes once you're looking)
      { name: 'pancake', wp: V(TANKER.x, F2.y + 4, TANKER.z), music: 0.95, enter: () => {
          this.lookT = 0; this._pt = 0; this.sp.tankerArmed = true; this.sp.autoTanker = true;
          say('Tanker up on the top deck — right over the substation. ...You\'re going to shoot it, aren\'t you.', 3.8);
          if (A) later(2.4, () => { g.cinematicLook = this.sp.tanker.center.clone(); g.cinematicW = 2; });
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          const T_ = this.sp.tanker;
          if (T_.state !== 'boom' && t > 7) {
            if (first('tankhint')) say('The TANKER! Up on the top deck!', 2);
            this.lookT = looking(T_.center, 0.82) ? this.lookT + dt : 0;
            if (this.lookT > 0.4 || t > 22) this.sp.damageTanker(99);
          }
          for (const e of g.events) {
            if (e.type === 'tankerBoom') { hud.setWaypoint(null); later(1.4, () => say('The whole deck\'s going — BOTH decks—', 2.2)); if (A) { g.cinematicLook = V((PSPAN.x0 + PSPAN.x1) / 2 + 6, F1.y - 2, (F2.z0 + F2.z1) / 2); g.cinematicW = 1.6; } }
            if (e.type === 'pancake') { later(0.4, () => say('...and the substation.', 1.8)); }
          }
        }, until: (t) => this.sp.blackoutArmed || this.sp.blackT > 0.1 || t > 60 },
      // 8 ---- the blackout: the whole city goes dark, district by district (look out over it)
      { name: 'blackout', wp: null, music: 0.6, enter: () => {
          night(1);
          this.lookT = 0; this._pt = 0; this.boT = -1;
          later(0.3, () => say('Oh no. Look — LOOK at the city.', 2.4));
          hud.setWaypoint(CITY_LOOK.clone());
          if (A) { g.cinematicLook = CITY_LOOK.clone(); g.cinematicW = 1.4; }
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          // VR: the blackout waits for the look (or 6 s), so it plays in front of you
          if (this.sp.blackT < 0) { this.lookT = looking(CITY_LOOK, 0.78) ? this.lookT + dt : 0; if (this.lookT > 0.5 || t > 6) { this.sp.startBlackout(); hud.setWaypoint(null); } }
          if (this.sp.blackT > 6 && first('bo2')) say('Bridges. The river. The whole south bank. ...Every light in Longwu.', 3.6);
        }, until: () => this.sp.blackT > (trailer ? 9 : 12.5) },
      // 9 ---- the climb in the dark: lasers, searchlights, fires
      { name: 'climb', wp: V((FOOTB.x0 + FOOTB.x1) / 2, 58, FOOTB.z0 - 1), hunt: true, arrive: true, music: 0.9, enter: () => {
          g.cinematicLook = null;
          later(0.4, () => say('Jinlong\'s still lit — generators. Up the steps, onto Sky Street, over the footbridge.', 3.6));
          later(1.6, () => hud.objective('Up to Sky Street — the footbridge into the tower'));
          const sh = [];
          for (const [x, z, d, fl] of [[300, 97, 1], [312, 99, 2], [322, 96, 3.5], [338, 76, 5], [352, 92, 6], [344, 58, 7.5, true], [334, 100, 9, true]]) sh.push(S({ x, z, delay: d, flanker: !!fl }));
          for (const [x, z, d] of [[230, 96, 2], [266, 102, 3]]) sh.push(S({ x, z, delay: d }));
          sniper(331, 44, [-0.7, 0.7], { delay: 7, lockTime: 3 });
          this.sp.postBlackoutLights(sh);
          A?.go([go(286, 98, { slow: 0.55 }), { p: V(296, 0, 98), nav: null, slow: 0.55 }, { p: V(326, 0, 98), nav: null, slow: 0.55 }, go(338, 96, { slow: 0.5 }), go(341, 106, {})]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper') === 0 && pz() > 100 && px() > 330) || t > 160 * T },
      // 10 ---- the sky lobby: it groans; clear it, out onto the terrace
      { name: 'lobby', wp: V(340, 58, 151), hunt: true, arrive: true, music: 0.95, enter: () => {
          later(0.4, () => say('Sky lobby. Clear it. ...Does that building sound right to you?', 3));
          later(1.4, () => hud.objective('Clear the sky lobby'));
          for (const [x, z, d] of [[330, 140, 0.4], [350, 139, 1.0], [340, 146, 1.8], [326, 148, 2.6], [354, 147, 3.4], [338, 130, 4.4]]) S({ x, z, delay: d });
          S({ x: 340, z: 150, role: 'rusher', delay: 10, entry: V(340, 0, 140) });
          A?.go([{ p: V(341, 0, 112), nav: null, slow: 0.6 }, { p: V(341, 0, 121), nav: null, slow: 0.6 }, go(328, 130, { slow: 0.5 }), go(330, 142, { slow: 0.5 }), go(340, 146, {})]);
        }, update: (t) => { this.sp.towerGroan(clamp(t / 40, 0.2, 0.8)); },
        until: (t) => (t > 6 && alive(s => s.role !== 'sniper') === 0) || t > 140 * T },
      // 10b ---- the lift: the rig's on the roof (the helipad), 180 m up; the lift still has power
      { name: 'lift', wp: V(ROOFTOP.lift.x, LOBBY.y + 1.6, ROOFTOP.lift.z), music: 0.9, enter: () => {
          say('Lobby\'s clear. There\'s a BASE rig up on the helipad — take the lift. ...Roof. Now.', 3.6);
          later(1.0, () => hud.objective('The lift — up to the roof'));
          if (A) A.go([go(334, 124, { slow: 0.6 }), { p: V(ROOFTOP.lift.x, 0, ROOFTOP.lift.z), nav: null, slow: 0.5 }]);
        }, update: (t) => {
          this.sp.towerGroan(0.8);
          if (!this.sp.lift && (this.sp.nearLift() || t > 40 * T)) this.sp.liftRide();
        }, until: () => !!this.sp.onRoof },
      // 11 ---- the roof, 240 m up: a gunship comes up over the edge, ropes men onto the roof, rockets, the chin gun. Bring
      // it down and it spirals into the hillside district below — into the gold tower on the crest — and the hill lets go
      { name: 'roof', wp: null, music: 1.0, enter: () => {
          hud.setWaypoint(null);
          this._pt = 0; this.crashT = -1;
          later(0.7, () => say('Top of the world. ...Hear that? That is NOT the wind.', 3));
          later(2.6, () => this.sp.gun.spawn());
          later(3.6, () => hud.objective('Bring down the gunship'));
          if (A) { A.go([{ p: V(343, 0, 145), nav: null, slow: 0.5 }]); later(2.8, () => { g.cinematicLook = V(350, 236, 196); g.cinematicW = 1.4; }); later(7.5, () => { if (!this.sp.gun.dead) g.cinematicLook = null; }); }
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          const G = this.sp.gun, H = G.H;
          // no one is stuck up here forever: after three minutes it's burning anyway
          if (H && H.alive && H.phase !== 'dying' && t > 180) G.damage(dt * 4);
          for (const e of g.events) {
            if (e.type === 'heliCrash') this.crashT = t;
            // to the railing: it goes down into the district under the east face (VR: lean over and watch it)
            if (e.type === 'heliDying') { hud.setWaypoint(V(ROOFTOP.x1 - 0.6, ROOFTOP.y + 1.2, 138)); later(1.2, () => hud.objective('The railing — watch it go')); if (A) { g.cinematicW = 1.6; A.go([{ p: V(ROOFTOP.x1 - 0.7, 0, 138), nav: null, sprint: true }]); } }
            if (e.type === 'heliCrash') later(4, () => hud.setWaypoint(null));
          }
          // the trailer / desktop camera: the burning bird all the way down, then the hill
          if (A && H && H.phase === 'dying') g.cinematicLook = H.pos.clone();
          if (A && this.crashT >= 0 && t > this.crashT + 0.4) { g.cinematicLook = t > this.crashT + 3.5 ? V(520, 12, 168) : V(462, 90, 80); g.cinematicW = 0.9; }
          if (this.crashT >= 0 && t > this.crashT + 5) this.sp.towerGroan(0.9);
          // the desktop / trailer camera leans out over the railing to look down (VR: you lean yourself)
          if (A && g.player && H && !H.alive && g.headPos.x > ROOFTOP.x1 - 1.6) { g.player.lean = V(1.6, 0.45, 0); if (g.loco) g.loco.enabled = false; }
        }, until: (t) => this.crashT >= 0 && t > this.crashT + 12 },
      // 12 ---- the tower's going: the rig, the gap, the jump
      { name: 'jump', wp: V(ROOFTOP.locker.x, ROOFTOP.y + 1.6, ROOFTOP.locker.z), music: 1.0, enter: () => {
          this.sp.towerGroan(1); g.cinematicLook = null; if (g.player) g.player.lean = null; if (g.loco) g.loco.enabled = true;
          say('That\'s it — she\'s coming off the cliff! The locker by the edge — grab the rig!', 3.4);
          later(1.2, () => hud.objective('The locker — grab the BASE rig'));
          if (A) A.go([{ p: V(ROOFTOP.locker.x - 1.2, 0, ROOFTOP.locker.z - 1.4), nav: null, slow: 0.8 }]);
          this.jt = 0;
        }, update: (t) => {
          this.sp.towerGroan(1);
          if (!this.sp.rigOn && (this.sp.nearLocker() || t > 25)) {
            this.sp.takeRig();
            hud.setWaypoint(V((ROOFTOP.gap[0] + ROOFTOP.gap[1]) / 2, ROOFTOP.y + 1, ROOFTOP.z1 - 0.3));
            later(0.4, () => say('Rig\'s on! The gap in the railing — run and JUMP! Don\'t think!', 2.8));
            if (A) later(0.8, () => A.go([{ p: V(340, 0, ROOFTOP.z1 - 0.3), nav: null, sprint: true }]));
          }
          if (this.sp.rigOn) { this.jt += 1 / 60; if (this.sp.atEdge() || this.jt > 20) this.sp.jump(); }
        }, until: () => !!this.sp.glide },
      // 13 ---- the glide: look back (the tower comes down onto the slid hill), jumpers, the barges, the gunboat
      { name: 'glide', wp: null, music: 1.0, enter: () => {
          hud.setWaypoint(null);
          this.lookT = 0; this._pt = 0; this.downT = 0;
          later(5.2, () => say('Canopy\'s open! Good! ...Now LOOK BACK!', 2.6));
          if (A) later(6.0, () => { g.cinematicLook = V(346, 160, 140); g.cinematicW = 1.3; });
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          const sp = this.sp;
          if (!sp.slide.active) sp.landslide(true);
          if (!sp.fall && t > 6.5) { this.lookT = looking(V(342, 160, 140), 0.55) ? this.lookT + dt : 0; if (this.lookT > 0.35 || t > 12) sp.towerFall(); }
          for (const e of g.events) {
            if (e.type === 'towerDown') { this.downT = t; later(1.2, () => say('...Jinlong Tower. Gone. Into the river.', 2.8)); }
            // the trailer / desktop camera: the bank as it goes, then the tower as it comes off the stump
            if (e.type === 'towerFall' && A) later(3.0, () => { g.cinematicLook = V(400, 120, 150); g.cinematicW = 1.2; });
            if (e.type === 'towerFree' && A) { g.cinematicLook = V(470, 30, 165); g.cinematicW = 1.2; }
            if (e.type === 'landed') { /* next beat */ }
          }
          if (sp.fall && ((this.downT && t > this.downT + 3) || t > 26) && first('jumpers')) { for (let i = 0; i < 3; i++) later(i * 2.2, () => sp.spawnJumper(i)); later(1.5, () => say('Jumpers! Behind you — they followed you off the roof!', 3)); if (A) g.cinematicLook = null; }
          if (A && g.cinematicLook && this.downT && t > this.downT + 2.6 && first('fallLookEnd')) g.cinematicLook = null;
          if (sp.rail.len - sp.rail.s < 150 && first('boathint')) { say('Gunboat under you! The drums on its stern — hit them!', 3.2); for (const s of sp.boatCrew || []) s.delay = Math.min(s.delay, 0.5); }
          // the boat: a marker on the drums (VR: look down at it), and the desktop / trailer camera goes with it
          if (sp.rail.len - sp.rail.s < 150 && !sp.boatClear) hud.setWaypoint(sp.boat.userData.drumsP.clone().applyMatrix4(sp.boat.matrixWorld));
          if (A && sp.rail.len - sp.rail.s < 123) { g.cinematicLook = sp.boat.userData.deck.clone().add(V(8, 2, 0)).applyMatrix4(sp.boat.matrixWorld); g.cinematicW = 1.2; }
          if (sp.boatClear && first('boatwp')) hud.setWaypoint(null);
          // the boat must be clear before you land: a stray round from the bridge finds the drums if you didn't
          if (sp.rail.remaining < 6 && !sp.boatClear) sp.blowDrums();
        }, until: () => this.sp.glide?.state === 'landed' },
      { name: 'outro', music: 1.0, enter: () => {
          audio.musicStinger('victory');
          g.bossInfo = null;
          for (const s of g.soldiers) if (s.alive) { s.alive = false; s.root.visible = false; }
          later(0.8, () => say('...Nice landing. I\'m two minutes out. Don\'t touch anything.', 3.4));
          later(trailer ? 3 : 4.4, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.kills, 'GOON')}  •  ${pl(g.lightsOut, 'SEARCHLIGHT')}  •  ${pl(g.jumpersDown, 'CANOPY')}  •  1 CITY  •  SCORE ${g.score}`;
            const P = g.headPos.clone().add(V(-12, 4, 2));
            hud.showTitle(P, 'LIGHTS OUT', sub, 999);
            g.cinematicLook = P.clone();
          });
        }, update: (t) => { hud.black.material.opacity = clamp((t - 2.5) / 1.5, 0, 0.5); },
        until: (t) => t > (trailer ? 10 : 13) },
      // credits for the whole game
      { name: 'credits', music: 0.7, enter: () => {
          this.cards = [
            ['BAYHEM', 'NINE LEVELS  •  ONE VERY LOUD WEEK'],
            ['THE 405 JOB  •  PORT OF VICTORY  •  DOWNTOWN HAVEN', 'THE IRON LADY  •  AIRPORT NO RETURN'],
            ['TOKYO SCRAMBLE  •  WHITEOUT  •  SAND CASTLES', 'LIGHTS OUT'],
            ['A GAME BY KENNY', 'KUNGFUKENNYOG  •  BUILT WITH CLAUDE'],
            ['THANKS FOR PLAYING', 'THE DRIVER WILL SEE YOU NEXT TIME'],
          ];
          this.cardI = -1; this.cardT = 0;
          hud.black.material.opacity = 0.85;
        }, update: (t) => {
          const i = Math.floor(t / 4.2);
          if (i !== this.cardI && i < this.cards.length) { this.cardI = i; const P = g.headPos.clone().addScaledVector(g.playerFwd, 9).setY(g.headPos.y + 0.6); hud.showTitle(P, this.cards[i][0], this.cards[i][1], 999); }
          hud.black.material.opacity = 0.85;
        }, until: (t) => t > (trailer ? 12 : 4.2 * 5 + 1) },
    ];
    // ?beat=<name>: jump straight to a beat (screenshots / testing)
    const jump = game.params.get('beat');
    const START_P = { steps: [-122, 64, 76], lstreet: [-62, 50, 80], gallery: [84, 50, 94], bridge: [108, 40, 109], plaza: [176, 40, 104], pancake: [276, 40, 98], blackout: [250, 40, 100], climb: [270, 40, 98], lobby: [341, 56, 106], lift: [340, 56, 140], roof: [340, 239, 132], jump: [340, 239, 140], glide: [340, 239, 153], outro: [340, 239, 153], credits: [340, 239, 153] };
    const ji = jump ? this.steps.findIndex(s => s.name === jump) : -1;
    const NIGHT = { intro: 0.26, steps: 0.3, lstreet: 0.42, gallery: 0.55, bridge: 0.68, plaza: 0.82, pancake: 0.85, blackout: 1, climb: 1, lobby: 1, lift: 1, roof: 1, jump: 1, glide: 1, outro: 1, credits: 1 };
    if (ji > 0) {
      const p = START_P[jump]; if (p && !game.params.has('px')) game.rig.position.set(p[0], p[1], p[2]);
      const idx = (n) => this.steps.findIndex(s => s.name === n);
      g.quietScore = true; g.fx.later(3, () => { g.quietScore = false; });
      g.night = NIGHT[jump] ?? g.night; this.nightTarget = g.night;
      if (ji > idx('pancake')) { this.sp.tankerArmed = true; this.sp.spanDownNow(); g.fire = 0.75; this.sp.blackoutArmed = true; }
      if (ji > idx('blackout')) { this.sp.startBlackout(true); g.glow = 0.1; }
      if (ji > idx('blackout')) { this.sp.blackT = 30; }
      if (ji > idx('lift')) this.sp.onRoof = true;
      if (ji > idx('roof')) { this.sp.gun.skip(); this.sp.landslide(true); }
      if (ji >= idx('glide')) { this.sp.takeRig(); this.sp.jump(); g.slowT = 0; }
      if (ji > idx('glide')) { this.sp.towerFall(true); }
      g.score = [0, 0, 2400, 5200, 8600, 12000, 15600, 19400, 21800, 22600, 26000, 26800, 34000, 35000, 37000, 44000][ji] || 0;
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
    const g = this.g;
    if (!this.done) {
      this.t += dt; this.total += dt;
      g.fx.dt0 = dt;
      for (const e of g.events) this.react(e);
      this.cur.update?.(this.t);
      if (this.cur.until(this.t) || arrivedAtMarker(this, dt)) this.next();
    }
    // the night deepens with the route (and the blackout takes the glow)
    g.night = damp(g.night, this.nightTarget, 0.25, dt);
    g.events.length = 0;
  }
}
