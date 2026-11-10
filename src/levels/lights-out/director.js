import * as THREE from 'three';
import { clamp, damp } from '../../rng.js';
import { arrivedAtMarker } from '../../beats.js';
import { POWER, DIST } from './kit.js';
import { START, ROAD, BRIDGE, PODIUM, TOWER, LIFT, ROOFTOP, CRASH, Y, groundAt } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _look = new THREE.Vector3(), _to = new THREE.Vector3();

// =====================================================================================
//  LIGHTS OUT — the beats. Positional triggers for real play; the autopilot walks the same route for
//  demo / trailer capture. VR rules: the big moments wait for the look (with a timeout); the
//  objective comes after the money shot; reaching a marker moves the beat on.
//
//  The power goes in this order, each cut its own event: upstream (intro) → the hillside (it slides)
//  → downstream, the cliff road and the south bank (the wave) → the bridge behind you and the north
//  skyline → the forecourt → the tower, as it falls. Then, on the boat, it all comes back.
// =====================================================================================
const UPSTREAM = V(1120, 130, 250);                              // the skyline east, past the bridge (the first cut)
const HILL = V(481, 34, 112);                                    // the hillside district, across the river from the road
const JIN = V((TOWER.x0 + TOWER.x1) / 2, 200, (TOWER.z0 + TOWER.z1) / 2);
const BX = (BRIDGE.x0 + BRIDGE.x1) / 2, LX = (LIFT.x0 + LIFT.x1) / 2, RZ = (ROOFTOP.gap[0] + ROOFTOP.gap[1]) / 2;
export class Director {
  constructor(game, hud, audio, setp, auto, trailer) {
    Object.assign(this, { g: game, hud, audio, sp: setp, auto, trailer });
    this.stepIdx = -1; this.t = 0; this.total = 0; this.done = false;
    const g = game, sp = setp;
    const T = trailer ? 0.7 : 1;
    const say = (line, d = 3) => { hud.subtitle('DRIVER', line, d); };
    this.say = say;
    const later = (t, fn) => g.fx.later(t, fn);
    const alive = (f) => g.enemiesAlive(f);
    const px = () => g.headPos.x, pz = () => g.headPos.z;
    const A = auto;
    const go = (x, z, o = {}) => ({ p: V(x, 0, z), nav: 'ground', ...o });
    const S = (o) => g.spawnSoldier({ ...o, y: o.y ?? groundAt(o.x, o.z) });
    const perchAt = (P, d, o = {}) => S({ x: P.x, z: P.z, y: P.y, role: 'perch', delay: d, noNade: true, ...o });
    const sniper = (x, y, z, face, o = {}) => S({ x, z, y, face, role: 'sniper', noNade: true, ...o });
    const looking = (P, dot = 0.8) => { g.camera.getWorldDirection(_look); _to.subVectors(P, g.headPos).normalize(); return _look.dot(_to) > dot; };
    const perches = g.world.named.perches || [];
    const perchNear = (x) => perches.slice().sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
    this.once = new Set();
    const first = (k) => { if (this.once.has(k)) return false; this.once.add(k); return true; };
    const night = (n) => { this.nightTarget = n; };
    this.nightTarget = g.night;
    this.react = (e) => {
      if (e.type === 'sniperShot' && first('snipe')) later(0.5, () => say('Sniper! Watch for the red line in the fog!', 2.8));
      if (e.type === 'carBoom' && first('carboom')) later(0.9, () => say('Longwu taxis. Built to go bang. Apparently.', 2.6));
      if (e.type === 'kill' && e.s.role === 'sniper' && first('sniperdown')) later(0.9, () => say('Sniper down. Good.', 2));
      if (e.type === 'kill' && e.s.role === 'perch' && !e.s.roper && first('perchdown')) later(0.6, () => say('That\'s a long way down for him.', 2.2));
      if (e.type === 'spotted' && first('spotted')) later(0.2, () => say('Searchlight\'s on you! Shoot the lamp — no light, no aim!', 3));
      if (e.type === 'searchlightDown' && first('sldown')) later(0.6, () => say('Ha! Lights out for HIM.', 2.2));
      if (e.type === 'canopyDown' && first('canopy')) later(0.6, () => say('Canopy\'s gone — he\'s going for a swim!', 2.6));
      if (e.type === 'boatDown' && first('boat')) later(0.8, () => say('Boat\'s clear! It\'s all yours — bring it in!', 2.8));
      if (e.type === 'heliUp' && e.mode === 'river' && first('heliup')) later(1.6, () => say('GUNSHIP! Right off the edge! Hit it — the cockpit, the engines, anything!', 3.4));
      if (e.type === 'heliUp' && e.mode === 'roof' && first('heliup2')) later(1.4, () => say('They had ANOTHER one! West edge — it\'s coming up the west side!', 3.2));
      if (e.type === 'heliDrop' && first('helidrop')) later(0.8, () => say('It\'s roping guys onto the roof! Get them on the ropes!', 2.8));
      if (e.type === 'heliHurt' && first('helihurt' + e.mode)) later(0.5, () => say('Engine\'s hit! It\'s smoking — stay on it!', 2.4));
      if (e.type === 'heliDive' && first('helidive')) later(0.6, () => say('It dropped under the edge — watch the sides, it\'s coming back up!', 3));
      if (e.type === 'heliDying' && e.mode === 'river' && first('helidying')) later(0.8, () => say('It\'s going DOWN — it\'s going into the hill—', 2.4));
      if (e.type === 'heliDying' && e.mode === 'roof' && first('helidying2')) later(0.6, () => say('That\'s a kill! It\'s coming round — it\'s going to hit the TOWER—', 2.8));
      if (e.type === 'slide' && first('slidevo')) later(1.6, () => say('The BANK — the whole riverside\'s going with it!', 2.8));
    };
    this.steps = [
      // 1 ---- Kuixing Plaza: title over the gorge at dusk; the first district goes (upstream, look-gated)
      { name: 'intro', wp: null, music: 0.3, enter: () => {
          night(0.3);
          hud.black.material.opacity = 1;
          if (g.player) { g.player.camDip = 0.6; g.player.camDipRate = 0.5; g.player.autoState.holdFire = true; }
          hud.showTitle(V(START.x + 46, Y + 9, 426), 'LIGHTS OUT', 'LEVEL 5  •  LONGWU, 18:40', trailer ? 4.4 : 5.8);
          audio.startMusic();
          later(0.9, () => say('Longwu. A city built on a cliff, in the fog, two rivers deep. Last stop.', 3.6));
          later(5.0, () => say('The gold tower past the bridge — Jinlong. Their whole crew is in it. Straight down this road.', 4));
          if (A) { g.cinematicLook = JIN.clone(); g.cinematicW = 1.2; }
          this.lookT = 0; this._pt = 0;
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          hud.black.material.opacity = Math.max(0, 1 - t / 1.8);
          // the first cut: upstream, beyond the bridge. It waits for you to look that way (or 5 s)
          if (t > 8.5 && !this.cut1) {
            if (first('uphint')) { say('Hold on. Upstream — past the bridge. LOOK.', 2.6); hud.setWaypoint(UPSTREAM.clone()); if (A) { g.cinematicLook = UPSTREAM.clone(); g.cinematicW = 1.4; } }
            this.lookT = looking(UPSTREAM, 0.8) ? this.lookT + dt : 0;
            if (this.lookT > 0.5 || t > 14) { this.cut1 = t; sp.cut(DIST.FAR_E, { kind: 'cut', c0: 330, c1: 40, dur: 3.2 }); hud.setWaypoint(null); later(2.6, () => say('That was a whole district. ...They\'re pulling the plug on the city. Move.', 3.4)); }
          }
        }, until: (t) => this.cut1 && t > this.cut1 + (trailer ? 3.5 : 5.2) },
      // 2 ---- the cliff road, first half: the jam, gunmen in the traffic and on the shop terraces to your right
      { name: 'road', wp: V(528, Y + 1.6, 434), hunt: true, arrive: true, music: 0.65, enter: () => {
          night(0.38); g.cinematicLook = null; if (g.player) g.player.autoState.holdFire = false;
          later(0.3, () => hud.objective('East along the cliff road — to the bridge'));
          for (const [x, z, d, fl] of [[446, 430, 0.6], [462, 438, 1.4], [478, 431, 2.2], [494, 437, 3.0, true], [512, 430, 4.4], [530, 438, 6, true], [548, 432, 8]]) S({ x, z, delay: d, flanker: !!fl });
          for (const [x, d] of [[470, 2.4], [520, 5]]) { const P = perchNear(x); if (P) perchAt(P, d); }
          S({ x: 540, z: 434, role: 'rusher', delay: 16, entry: V(560, 0, 434) });
          later(7, () => say('Terraces on your right! They\'re up over the shops!', 2.4));
          A?.go([go(420, 434, { slow: 0.6 }), go(446, 434, { slow: 0.5 }), go(474, 434, { slow: 0.5 }), go(502, 434, { slow: 0.5 }), go(526, 434, {})]);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper' && s.role !== 'perch') === 0 && px() > 520) || t > 150 * T },
      // 3 ---- NIGHT HERON ONE: up out of the gorge beside you. Shot down, it goes into the hill across the river — and the hill goes
      { name: 'heron', wp: null, music: 0.95, enter: () => {
          this._pt = 0; this.crashT = -1;
          later(0.4, () => sp.heron1.spawn());
          later(2.2, () => hud.objective('Shoot down the gunship'));
          for (const [x, z, d, fl] of [[566, 431, 3], [584, 438, 5], [602, 431, 9, true], [622, 437, 12]]) S({ x, z, delay: d, flanker: !!fl });
          { const P = perchNear(590); if (P) perchAt(P, 6); }
          if (A) { A.go([go(548, 434, { slow: 0.4 }), go(566, 433, { slow: 0.4 })]); later(1.2, () => { g.cinematicLook = V(px() + 30, Y + 16, 384); g.cinematicW = 1.4; }); later(5, () => { g.cinematicLook = null; }); }
        }, update: (t) => {
          const H = sp.heron1.H;
          // it never waits on your aim: after a minute and a quarter it is burning on its own
          if (H && H.alive && H.phase !== 'dying' && t > 75) sp.heron1.damage(999);
          for (const e of g.events) {
            if (e.type === 'heliDying' && e.mode === 'river') { hud.setWaypoint(V(...CRASH)); }
            if (e.type === 'heliCrash' && e.mode === 'river') { this.crashT = t; hud.setWaypoint(null); }
          }
          if (A && H && H.phase === 'dying') { g.cinematicLook = H.pos.clone(); g.cinematicW = 1.5; }
          if (A && this.crashT >= 0) { g.cinematicLook = HILL.clone(); g.cinematicW = 1.0; }
        }, until: (t) => (this.crashT >= 0 && t > this.crashT + (trailer ? 9 : 12)) || t > 140 },
      // 4 ---- the wave: downstream goes, then the cliff road, lamp by lamp, past you and on ahead; the bridge is still lit
      { name: 'wave', wp: null, music: 0.6, enter: () => {
          night(0.7); this.waveT = 0;
          g.cinematicLook = null;
          say('Oh no. Look — LOOK at the city.', 2.4);
          sp.cut(DIST.FAR_W, { kind: 'cut', c0: 330, c1: 40, dur: 3 });
          sp.cut(DIST.R0, { delay: 2.2 }); sp.cut(DIST.R1, { delay: 3.3 }); sp.cut(DIST.R2, { delay: 4.4 }); sp.cut(DIST.R3, { delay: 5.5 });
          sp.cut(DIST.FAR_S, { delay: 4.2, kind: 'cut', c0: 330, c1: 50, dur: 4.5 });
          later(6.6, () => say('Bridges. The river. The whole south bank. ...Every light in Longwu.', 3.6));
          if (A) { g.cinematicLook = V(px() - 120, Y + 30, 520); g.cinematicW = 1.2; later(4.5, () => { g.cinematicLook = V(BX, Y + 40, 300); }); }
        }, until: (t) => t > (trailer ? 8 : 9.5) },
      // 5 ---- the rest of the road and the bridge: its lamps die behind you as you cross; a sniper on the tower's podium
      { name: 'bridge', wp: V(BX, Y + 1.6, BRIDGE.z0 + 8), hunt: true, arrive: true, music: 0.85, enter: () => {
          night(0.85); g.cinematicLook = null;
          later(0.4, () => say('The bridge still has power — and so does Jinlong. Onto the bridge. GO.', 3.4));
          later(1.6, () => hud.objective('Across the bridge — to the tower'));
          for (const [x, z, d, fl] of [[640, 431, 0.5], [662, 437, 1.5], [BX - 3, 398, 3], [BX + 3, 370, 4.5], [BX - 3, 336, 6, true], [BX + 3, 300, 8], [BX - 3, 262, 10, true], [BX + 3, 226, 12], [BX - 2, 190, 14]]) S({ x, z, delay: d, flanker: !!fl });
          sniper(PODIUM.x0 + 6, Y, PODIUM.z1 - 3, [0.2, 1], { delay: 9, lockTime: 3 });
          S({ x: BX, z: 250, role: 'rusher', delay: 20, entry: V(BX, 0, 230) });
          A?.go([go(600, 434, { slow: 0.55 }), go(650, 434, { slow: 0.5 }), go(BX, 430, { slow: 0.6 }), go(BX, 396, { slow: 0.75 }), go(BX, 350, { slow: 0.75 }), go(BX, 300, { slow: 0.75 }), go(BX, 250, { slow: 0.75 }), go(BX, 204, { slow: 0.75 }), go(BX, 170, {})]);
        }, update: () => {
          // the lamps go out behind you, span by span; mid-river the north skyline goes too
          const z = pz(), on = px() > BRIDGE.x0 - 2 && px() < BRIDGE.x1 + 2;
          if (on && z < 372 && first('br0')) sp.cut(DIST.BR0);
          if (on && z < 290 && first('br1')) { sp.cut(DIST.BR1); sp.cut(DIST.FAR_N, { delay: 0.8, kind: 'cut', c0: 330, c1: 50, dur: 4 }); later(2.2, () => say('It\'s following you across. Don\'t stop.', 2.4)); }
          if (on && z < 204 && first('br2')) sp.cut(DIST.BR2);
        }, until: (t) => (t > 8 && alive(s => s.role !== 'sniper') === 0 && pz() < BRIDGE.z0 + 14) || t > 300 * T },
      // 6 ---- the forecourt: the last fight on foot, lit by the tower alone
      { name: 'fore', wp: V(LX, Y + 1.6, LIFT.z1 + 1.5), hunt: true, arrive: true, music: 0.95, enter: () => {
          night(1);
          for (const k of ['br0', 'br1', 'br2']) if (first(k)) sp.cut(k === 'br0' ? DIST.BR0 : k === 'br1' ? DIST.BR1 : DIST.BR2);
          later(0.4, () => say('Jinlong. Last light in the city. Clear the forecourt — the lift\'s on the tower\'s face, dead ahead.', 4));
          later(1.6, () => hud.objective('Clear the forecourt — to the lift'));
          for (const [x, z, d, fl] of [[662, 147, 0.4], [722, 147, 1.0], [680, 143, 1.8], [704, 143, 2.6], [668, 139, 3.6, true], [716, 139, 4.6, true], [656, 152, 6], [728, 152, 7]]) S({ x, z, delay: d, flanker: !!fl });
          S({ x: 700, z: 146, role: 'rusher', delay: 12, entry: V(BX, 0, 150) });
          A?.go([go(BX, 156, { slow: 0.5 }), go(BX - 2, 150, { slow: 0.45 }), go(LX, 144, { slow: 0.5 }), go(LX, 142.5, {})]);
        }, until: (t) => (t > 6 && alive(s => s.role !== 'sniper') === 0 && pz() < 150) || t > 140 * T },
      // 7 ---- the lift: step on; it goes when you are on it
      { name: 'lift', wp: V(LX, Y + 1.6, (LIFT.z0 + LIFT.z1) / 2), music: 0.8, enter: () => {
          this.onT = 0; this._pt = 0;
          sp.cut(DIST.FORE, { delay: 1.2 });
          say('Forecourt\'s clear. Step onto the lift — there\'s a BASE rig up on the roof. It\'s the only way back down.', 4.2);
          later(1.0, () => hud.objective('Step onto the lift'));
          if (A) A.go([{ p: V(LX, 0, (LIFT.z0 + LIFT.z1) / 2 + 0.4), nav: null, slow: 0.6 }]);
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          this.onT = sp.inLift() ? this.onT + dt : 0;
          if (sp.lift.state === 'bottom' && (this.onT > 0.8 || t > 45 * T)) { if (!sp.inLift()) { g.rig.position.set(LX, Y, (LIFT.z0 + LIFT.z1) / 2); } sp.liftStart(); hud.setWaypoint(null); later(3, () => say('Look at that. The whole city, dark. ...You did not do that. Mostly.', 3.6)); }
          if (A && sp.lift.state === 'up') { g.cinematicLook = V(LX - 60, sp.lift.y - 30, 330); g.cinematicW = 0.8; }
        }, until: () => sp.onRoof },
      // 8 ---- the roof: NIGHT HERON TWO. This one you finish; it goes into the tower's own face
      { name: 'roof', wp: null, music: 1.0, enter: () => {
          hud.setWaypoint(null); g.cinematicLook = null;
          this.crash2 = -1;
          later(0.7, () => say('Top of the world. ...Hear that? That is NOT the wind.', 3));
          later(2.6, () => sp.heron2.spawn());
          later(3.8, () => hud.objective('Shoot down the gunship'));
          if (A) { A.go([{ p: V(LX + 2, 0, ROOFTOP.z1 - 6), nav: null, slow: 0.5 }, { p: V(LX + 4, 0, RZ + 4), nav: null, slow: 0.5 }]); later(2.8, () => { g.cinematicLook = V(TOWER.x0 - 46, ROOFTOP.y + 6, RZ + 6); g.cinematicW = 1.4; }); later(7.5, () => { g.cinematicLook = null; }); }
        }, update: (t) => {
          const H = sp.heron2.H;
          if (H && H.alive && H.phase !== 'dying' && t > 170) sp.heron2.damage(999);
          for (const e of g.events) if (e.type === 'heliCrash' && e.mode === 'roof') this.crash2 = t;
          if (A && H && H.phase === 'dying') { g.cinematicLook = H.pos.clone(); g.cinematicW = 1.5; }
        }, until: (t) => (this.crash2 >= 0 && t > this.crash2 + 3.2) || t > 230 },
      // 9 ---- the tower's going: the rig from the locker, the gap in the west parapet, the jump
      { name: 'jump', wp: V(ROOFTOP.locker.x, ROOFTOP.y + 1.6, ROOFTOP.locker.z), music: 1.0, enter: () => {
          g.cinematicLook = null; if (g.loco) g.loco.enabled = true; g.bossInfo = null;
          say('That\'s it — she\'s coming off the cliff! The locker by the edge — grab the rig!', 3.4);
          later(1.2, () => hud.objective('The orange locker — grab the BASE rig'));
          if (A) A.go([{ p: V(ROOFTOP.locker.x + 0.6, 0, ROOFTOP.locker.z - 1.8), nav: null, slow: 0.8 }]);
          this.jt = 0; this._pt = 0;
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t;
          sp.towerGroan(1);
          if (!sp.rigOn && (sp.nearLocker() || t > 25)) {
            sp.takeRig();
            hud.setWaypoint(V(ROOFTOP.x0 + 0.4, ROOFTOP.y + 1, RZ));
            later(0.4, () => say('Rig\'s on! The gap in the railing — run and JUMP! Don\'t think!', 2.8));
            if (A) later(0.8, () => A.go([{ p: V(ROOFTOP.x0 + 6, 0, RZ), nav: null, sprint: true }, { p: V(ROOFTOP.x0 + 0.5, 0, RZ), nav: null, sprint: true }]));
          }
          if (sp.rigOn) { this.jt += dt; if (sp.atEdge() || this.jt > 20) sp.jump(); }
        }, until: () => !!sp.glide },
      // 10 ---- the glide: the tower comes down past your right shoulder and puts the city's last light out; then jumpers,
      // the barges, the gunboat; you land on its deck
      { name: 'glide', wp: null, music: 1.0, enter: () => {
          hud.setWaypoint(null);
          this._pt = 0; this.downT = 0; this.flyT = -1;
          later(1.4, () => say('Canopy\'s open! Good! ...Now LOOK BACK!', 2.6));
          if (A) later(1.6, () => { g.cinematicLook = JIN.clone().setY(150); g.cinematicW = 1.3; });
        }, update: (t) => {
          const dt = t - this._pt; this._pt = t; void dt;
          if (sp.glide?.state === 'fly' && this.flyT < 0) this.flyT = t;
          const ft = this.flyT < 0 ? -1 : t - this.flyT;
          // she goes 3 s after the canopy opens, whatever you are looking at: she comes past you on her own
          if (ft > 3.0 && !sp.fall) { sp.towerFall(); later(2.2, () => say('She\'s coming DOWN — right side! She\'s coming down WITH you!', 3)); }
          for (const e of g.events) if (e.type === 'towerDown') { this.downT = t; hud.setWaypoint(null); later(1.4, () => say('...Jinlong Tower. Gone. Into the river.', 2.8)); later(4.6, () => say('And that was the last light in Longwu.', 2.6)); }
          // the marker rides her crown while she falls (VR: where to look), the desktop / trailer camera follows it
          if (sp.fall && !this.downT && sp.fall.top) { if (sp.fall.t > 1.5) hud.setWaypoint(sp.fall.top.clone()); if (A) { g.cinematicLook = sp.fall.top.clone().lerp(V(HINGE_X, Y + 30, HINGE_Z), 0.35); g.cinematicW = 1.4; } }
          if (A && this.downT && t > this.downT + 3 && first('fallLookEnd')) g.cinematicLook = null;
          if (this.downT && t > this.downT + 5 && first('jumpers')) { for (let i = 0; i < 3; i++) later(i * 2.2, () => sp.spawnJumper(i)); later(1.5, () => say('Jumpers! Behind you — they followed you off the roof!', 3)); }
          const left = sp.rail.len - sp.rail.s;
          if (left < 150 && first('boathint')) { say('Gunboat under you! The drums on its stern — hit them!', 3.2); for (const s of sp.boatCrew || []) s.delay = Math.min(s.delay, 0.5); }
          if (left < 150 && !sp.boatClear && sp.glide?.state === 'fly') hud.setWaypoint(sp.boat.userData.drumsP.clone().applyMatrix4(sp.boat.matrixWorld));
          if (A && left < 123 && sp.glide?.state === 'fly') { g.cinematicLook = sp.boat.userData.deck.clone().add(V(-8, 2, 0)).applyMatrix4(sp.boat.matrixWorld); g.cinematicW = 1.2; }
          if (sp.boatClear && first('boatwp')) hud.setWaypoint(null);
          // the boat must be clear before you land: a stray round finds the drums if you didn't
          if (sp.glide?.state === 'fly' && sp.rail.remaining < 6 && !sp.boatClear) sp.blowDrums();
        }, until: () => sp.glide?.state === 'landed' },
      // 11 ---- the deck: Longwu comes back on, district by district; stats
      { name: 'outro', music: 1.0, enter: () => {
          audio.musicStinger('victory');
          g.bossInfo = null; hud.setWaypoint(null);
          for (const s of g.soldiers) if (s.alive) { s.alive = false; s.root.visible = false; }
          later(0.8, () => say('...Nice landing. I\'m two minutes out. Don\'t touch anything.', 3.4));
          later(2.4, () => sp.lightsReturn());
          later(4.6, () => say('...Huh. Somebody found the breakers.', 2.6));
          if (A) g.cinematicLook = V(g.headPos.x + 200, 80, 440);
          later(trailer ? 4 : 6.4, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.kills, 'GOON')}  •  2 GUNSHIPS  •  ${pl(g.jumpersDown, 'CANOPY')}  •  1 HILLSIDE  •  1 TOWER  •  SCORE ${g.score}`;
            const P = g.headPos.clone().add(V(14, 5, 6));
            hud.showTitle(P, 'LIGHTS OUT', sub, 999);
            g.cinematicLook = P.clone();
          });
        }, update: (t) => { hud.black.material.opacity = clamp((t - 9) / 2, 0, 0.5); },
        until: (t) => t > (trailer ? 12 : 15) },
      // credits for the whole game
      { name: 'credits', music: 0.7, enter: () => {
          this.cards = [
            ['BAYHEM 2', 'FIVE CITIES  •  ONE VERY LOUD WEEK'],
            ['THE IRON LADY  •  TOKYO SCRAMBLE', 'WHITEOUT  •  SAND CASTLES  •  LIGHTS OUT'],
            ['AND BEFORE THAT: BAYHEM', 'THE 405 JOB  •  PORT OF VICTORY  •  DOWNTOWN HAVEN  •  AIRPORT NO RETURN'],
            ['A GAME BY KENNY', 'KUNGFUKENNYOG  •  BUILT WITH CLAUDE'],
            ['THANKS FOR PLAYING', 'THE DRIVER WILL SEE YOU NEXT TIME'],
          ];
          this.cardI = -1;
          hud.black.material.opacity = 0.85;
        }, update: (t) => {
          const i = Math.floor(t / 4.2);
          if (i !== this.cardI && i < this.cards.length) { this.cardI = i; const P = g.headPos.clone().addScaledVector(g.playerFwd, 9).setY(g.headPos.y + 0.6); hud.showTitle(P, this.cards[i][0], this.cards[i][1], 999); }
          hud.black.material.opacity = 0.85;
        }, until: (t) => t > (trailer ? 12 : 4.2 * 5 + 1) },
    ];
    // ?beat=<name>: jump straight to a beat (screenshots / testing)
    const jump = game.params.get('beat');
    const RY = ROOFTOP.y;
    const START_P = { road: [404, Y, 434], heron: [530, Y, 434], wave: [560, Y, 434], bridge: [566, Y, 434], fore: [BX, Y, 166], lift: [LX, Y, 146], roof: [LX, RY, 132], jump: [LX + 2, RY, 124], glide: [ROOFTOP.x0 + 2, RY, RZ], outro: [ROOFTOP.x0 + 2, RY, RZ], credits: [ROOFTOP.x0 + 2, RY, RZ] };
    const YAW = { road: -Math.PI / 2, heron: -Math.PI / 2, wave: -Math.PI / 2, bridge: -Math.PI / 2, fore: 0, lift: 0, roof: 0, jump: Math.PI / 2, glide: Math.PI / 2 };
    const ji = jump ? this.steps.findIndex(s => s.name === jump) : -1;
    const NIGHT = { intro: 0.3, road: 0.38, heron: 0.5, wave: 0.7, bridge: 0.85 };
    if (ji > 0) {
      const p = START_P[jump]; if (p && !game.params.has('px')) game.rig.position.set(p[0], p[1], p[2]);
      if (g.player && YAW[jump] !== undefined && !game.params.has('yaw')) g.player.yaw = YAW[jump];
      const idx = (n) => this.steps.findIndex(s => s.name === n);
      g.quietScore = true; g.fx.later(3, () => { g.quietScore = false; });
      g.night = NIGHT[jump] ?? 1; this.nightTarget = g.night;
      this.cut1 = -99; sp.cutNow([DIST.FAR_E]);
      if (ji > idx('heron')) { sp.heron1.skip(); sp.landslide(true); }
      if (ji > idx('wave')) sp.cutNow([DIST.FAR_W, DIST.R0, DIST.R1, DIST.R2, DIST.R3, DIST.FAR_S]);
      if (ji > idx('bridge')) { sp.cutNow([DIST.BR0, DIST.BR1, DIST.BR2, DIST.FAR_N]); for (const k of ['br0', 'br1', 'br2']) this.once.add(k); }
      if (ji > idx('lift')) { sp.cutNow([DIST.FORE]); sp.liftTop(); }
      if (ji > idx('roof')) { sp.heron2.skip(); sp.towerHit(); }
      if (ji >= idx('glide')) { sp.takeRig(); sp.jump(); g.slowT = 0; }
      if (ji > idx('glide')) { sp.towerFall(true); sp.cutNow([DIST.TOWER, DIST.EAST]); }
      g.score = [0, 0, 2400, 7800, 9000, 15600, 19400, 20000, 27000, 28000, 37000, 44000][ji] || 0;
      for (const c of hud.callouts) hud.scene.remove(c.s); hud.callouts.length = 0;
      for (const L of Object.values(hud.lanes || {})) { L.q.length = 0; L.cur = null; }
      this.stepIdx = ji - 1;
    }
    void ROAD; void POWER;
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
    // the night deepens with the route
    g.night = damp(g.night, this.nightTarget, 0.25, dt);
    g.events.length = 0;
  }
}
const HINGE_X = TOWER.x0, HINGE_Z = (TOWER.z0 + TOWER.z1) / 2;
