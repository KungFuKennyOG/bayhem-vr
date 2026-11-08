import * as THREE from 'three';
import { pick, range, clamp, damp, rand } from '../../rng.js';
import { arrivedAtMarker } from '../../beats.js';
import { LEG1, LEG2, LEG3, HP1, HP2, YARD, MID, DOCK, HALL, COURT, BLOCK, TOWER, STAIR_A, LAND_A, STAIR_B, LAND_B, GALLERY, RAILCAR, SNIPERS, START, CORNICE, GAZEX, PYLON, groundAt, roadNearest, terrainAt } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _look = new THREE.Vector3(), _to = new THREE.Vector3();

// a point on a road leg at fraction t, lat metres to the left of travel (+ = the uphill side on legs 1 and 3)
function onLeg(L, t, lat = 0) {
  const x = L.a[0] + (L.b[0] - L.a[0]) * t, z = L.a[2] + (L.b[2] - L.a[2]) * t;
  const R = roadNearest(x, z); const nx = -R.sz, nz = R.sx;
  return { x: x + nx * lat, z: z + nz * lat };
}

// =====================================================================================
//  WHITEOUT — the beats. Triggers are positional for real play; the autopilot walks the same
//  route in demo / trailer mode. VR rules: big moments wait for the look; spectacle, then objective.
// =====================================================================================
export class Director {
  constructor(game, hud, audio, setp, auto, trailer) {
    Object.assign(this, { g: game, hud, audio, sp: setp, auto, trailer });
    this.stepIdx = -1; this.t = 0; this.total = 0; this.done = false;
    this.stormTarget = game.storm;
    const g = game;
    const T = trailer ? 0.7 : 1;
    const say = (line, d = 3) => { audio.play('radio_squelch', { volume: 0.6 }); hud.subtitle('DRIVER', line, d); };
    this.say = say;
    const later = (t, fn) => g.fx.later(t, fn);
    const alive = (f) => g.enemiesAlive(f);
    const px = () => g.headPos.x, pz = () => g.headPos.z, py = () => g.rig.position.y;
    const A = auto;
    const go = (x, z, o = {}) => ({ p: V(x, groundAt(x, z), z), nav: 'ground', ...o });
    const S = (o) => g.spawnSoldier({ ...o, y: o.y ?? groundAt(o.x, o.z) });
    const L = (leg, t, lat, o = {}) => { const p = onLeg(leg, t, lat); return S({ x: p.x, z: p.z, ...o }); };
    const sniper = (id, o = {}) => { const p = SNIPERS[id]; const y = o.y ?? terrainAt(p.x, p.z); return S({ x: p.x, z: p.z, y, face: p.face, role: 'sniper', noNade: true, ...o }); };
    const looking = (P, dot = 0.8) => { g.camera.getWorldDirection(_look); _to.subVectors(P, g.headPos).normalize(); return _look.dot(_to) > dot; };
    this.once = new Set();
    const first = (k) => { if (this.once.has(k)) return false; this.once.add(k); return true; };
    this.react = (e) => {
      if (e.type === 'sniperShot' && first('snipe')) later(0.5, () => say(e.hit ? 'Sniper! Follow the laser back to him — and keep moving!' : 'Red dot! Somewhere high — don\'t let it settle on you!', 3));
      if (e.type === 'carBoom' && first('carboom')) later(0.9, () => say('Good. Anything with a fuel tank is a bomb up here. Use that.', 2.8));
      if (e.type === 'expBoom' && e.e.kind === 'propane' && first('propane')) later(0.9, () => say('...There goes the fondue.', 2.2));
      if (e.type === 'kill' && e.s.role === 'sniper' && first('sniperdown')) later(0.9, () => say('Sniper down! Long way to the bottom, buddy.', 2.6));
    };
    const ROAD1_END = V(HP1.c[0] + 10, 9.6, HP1.c[1]), ROAD2_END = V(HP2.c[0] - 10, 19.6, HP2.c[1]), ROAD3_END = V(54, 30, 38);
    this.steps = [
      // 1 ---- the bottom of the road in the storm, the snowcat burning
      { name: 'intro', wp: null, music: 0.3, storm: 1, enter: () => {
          hud.black.material.opacity = 1;
          if (g.player) { g.player.camDip = 0.6; g.player.camDipRate = 0.5; g.player.autoState.holdFire = true; }
          hud.showTitle(V(-36, 15, 106), 'WHITEOUT', 'LEVEL 7  •  GRAUHORN, 3 412 M', trailer ? 4.4 : 5.8);
          audio.startMusic();
          later(0.9, () => say('...You alive? Good. That was our snowcat. The road\'s the only way up now.', 3.4));
          later(4.6, () => say('Three hairpins to the cable car. And they know we\'re coming — see the headlamps?', 3.4));
          // headlamps up on the road above, walking into position
          this.intro = [L(LEG2, 0.62, 2.2, { delay: 2.0, holdFire: true }), L(LEG2, 0.8, 1.6, { delay: 3.0 })];
          A?.go([go(START.x + 4, START.z - 1.5, { slow: 0.5 })]);
          if (A) { g.cinematicLook = V(-20, 12, 92); g.cinematicW = 1.4; }
        }, update: (t) => { hud.black.material.opacity = Math.max(0, 1 - t / 1.8); },
        until: (t) => t > (trailer ? 6.4 : 8.4) },
      // 2 ---- leg 1: the roadblock ahead, gunmen on the road above firing DOWN at you
      { name: 'road1', wp: ROAD1_END, hunt: true, arrive: true, music: 0.65, storm: 1, enter: () => {
          g.cinematicLook = null;
          hud.objective('Fight up the road — hairpin 1');
          if (g.player) g.player.autoState.holdFire = false;
          for (const s of this.intro || []) s.holdFire = false;
          L(LEG1, 0.42, 0.5, { delay: 0.6 }); L(LEG1, 0.55, -1.8, { delay: 1.2 }); L(LEG1, 0.62, 1.4, { delay: 1.8, flanker: true }); L(LEG1, 0.8, -0.5, { delay: 3 });
          // above: on leg 2, behind its parapet
          L(LEG2, 0.45, -2.6, { delay: 4 }); L(LEG2, 0.3, -2.2, { delay: 7 }); L(LEG2, 0.62, -2.4, { delay: 11 });
          L(LEG1, 0.92, 0, { role: 'rusher', delay: 14 });
          later(2.4, () => say('Barricade on the road — and more above you on the next leg. Look UP.', 3.2));
          A?.go([go(-52, 110, { slow: 0.6 }), go(-34, 109.5, { slow: 0.5 }), go(-12, 107.5, { slow: 0.45 }), go(8, 106, { slow: 0.45 }), go(28, 103.5, { slow: 0.5 })]);
        }, update: (t) => {
          if (t > 6 && first('lookup')) later(0.1, () => { if (alive(s => s.pos.y > py() + 4) > 0) say('They\'re shooting down from the road above! Over the wall — UP!', 3); });
        }, until: (t) => (t > 8 && alive() === 0 && px() > 30) || t > 120 * T },
      // 3 ---- leg 2: west, a sniper on the rib, and they come up the road BEHIND and BELOW you
      { name: 'road2', wp: ROAD2_END, hunt: true, arrive: () => alive(s => s.role === 'sniper') === 0 || this.t > 50, gate: () => { const s = g.soldiers.find(s => s.alive && s.role === 'sniper'); return s ? s.pos.clone().setY(s.pos.y + 2) : null; }, gateMsg: 'SNIPER — ON THE ROCKS', music: 0.75, storm: 1, enter: () => {
          hud.objective('Hairpin 2 — the Berghaus');
          L(LEG2, 0.18, 0.8, { delay: 0.5 }); L(LEG2, 0.32, -1.5, { delay: 1.4 }); L(LEG2, 0.5, 1.0, { delay: 2.4, flanker: true }); L(LEG2, 0.72, -0.4, { delay: 4 });
          L(LEG3, 0.25, -2.4, { delay: 5 }); L(LEG3, 0.4, -2.6, { delay: 9 });
          sniper('rib', { delay: 6, lockTime: 2.4 });
          later(8.5, () => say('Laser — up on the rocks, above the next road! See it?', 2.8));
          // flankers come up leg 1 behind you: you look DOWN over the parapet at them
          later(12 * T, () => { L(LEG1, 0.85, 0, { delay: 0, entry: null }); L(LEG1, 0.7, 1, { delay: 1.5 }); L(LEG1, 0.95, -1, { delay: 3 }); later(1.0, () => say('Behind you — DOWN on the road! They\'re coming up after you!', 3)); });
          // the Berghaus: they come out of the door as you get close
          this.hutOut = false;
          A?.go([go(36, 82, { slow: 0.6 }), go(22, 80, { slow: 0.45 }), go(4, 78.5, { slow: 0.45 }), go(-16, 77, { slow: 0.45 }), go(-34, 75.5, { slow: 0.5 })]);
        }, update: (t) => {
          if (!this.hutOut && px() < -10) { this.hutOut = true; for (let i = 0; i < 3; i++) S({ x: -59.5, z: 62 + i * 1.6, delay: i * 0.8, entry: V(-52, 19.5, 66) }); later(0.6, () => say('The Berghaus! Propane tank on the terrace — you know what to do.', 3)); }
        }, until: (t) => (t > 8 && alive() === 0 && px() < -48) || t > 130 * T },
      // 4 ---- leg 3: east to the yard
      { name: 'road3', wp: ROAD3_END, hunt: true, arrive: true, music: 0.8, storm: 1, enter: () => {
          hud.objective('The Mittelstation');
          L(LEG3, 0.3, 0.5, { delay: 0.6 }); L(LEG3, 0.5, -1.6, { delay: 1.4 }); L(LEG3, 0.72, 1.6, { delay: 2.4, flanker: true }); L(LEG3, 0.9, 0, { delay: 4, role: 'rusher' });
          S({ x: 62, z: 36, delay: 6 }); S({ x: 70, z: 40, delay: 8 });
          later(1.5, () => say('Last leg. The station\'s at the top — I\'ll meet you there. I know a way round.', 3.2));
          A?.go([go(-36, 53, { slow: 0.6 }), go(-16, 51, { slow: 0.45 }), go(6, 49, { slow: 0.45 }), go(26, 47, { slow: 0.5 }), go(44, 42, { slow: 0.6 }), go(ROAD3_END.x, ROAD3_END.z, { slow: 0.6 })]);
        }, until: (t) => (t > 8 && alive() === 0 && px() > 48) || t > 120 * T },
      // 5 ---- the yard: containers, the fuel tank, the shed sniper
      { name: 'yard', wp: V(85, 31.5, 6), hunt: true, arrive: () => alive(s => s.role === 'sniper') === 0, gate: () => { const s = g.soldiers.find(s => s.alive && s.role === 'sniper'); return s ? s.pos.clone().setY(s.pos.y + 2) : null; }, gateMsg: 'SNIPER — ON THE SHED', music: 0.9, storm: 1, enter: () => {
          hud.objective('Clear the station yard');
          S({ x: 72, z: 26, delay: 0.5 }); S({ x: 82, z: 18, delay: 1 }); S({ x: 98, z: 26, delay: 1.6, flanker: true }); S({ x: 64, z: 16, delay: 2.4 }); S({ x: 104, z: 14, delay: 3.2 });
          S({ x: 86, z: 2, delay: 9, entry: V(86, 30, 12) }); S({ x: 78, z: -4, delay: 11, entry: V(78, 30, 10) }); S({ x: 92, z: -6, delay: 13, role: 'rusher' });
          sniper('shed', { y: 36.3, delay: 4, lockTime: 2.5 });
          later(1.2, () => say('Fuel tank on the left of the yard. Just saying.', 2.6));
          A?.go([go(54, 37, { slow: 0.6 }), go(66, 32, { slow: 0.45 }), go(80, 24, { slow: 0.45 }), go(88, 14, { slow: 0.45 })]);
        }, until: (t) => (t > 10 && alive() === 0) || t > 130 * T },
      // 6 ---- get in the cabin
      { name: 'board', wp: V(80, 32.5, -10), music: 0.5, storm: 0.9, enter: () => {
          say('I\'m in the control room. Get in the cabin — number ONE. I\'ll run you up.', 3.4);
          later(1.6, () => hud.objective('Get in the cable car'));
          for (const s of g.soldiers) if (s.alive && s.pos.distanceTo(g.headPos) > 40) { s.alive = false; s.root.visible = false; }
          A?.go([go(85, 0, { slow: 0.8 }), { p: V(83.6, 30, -9.8), nav: null, tol: 0.5 }, { p: V(80.2, 30, -9.8), nav: null, tol: 0.5 }]);
        }, update: () => { if (this.sp.inCabin(g.headPos)) this.sp.board(); },
        until: () => !!this.sp.ride },
      // 7 ---- the ride across the gorge
      { name: 'cable', wp: null, music: 1.0, storm: 0.6, /* the storm thins over the gorge: you see the drop */ enter: () => {
          hud.setWaypoint(null);
          later(2.5, () => say('Hold on. Fifteen hundred metres of nothing under you, and it\'s all downhill.', 3.2));
          later(9, () => say('Cabin two coming down the other side — and it is FULL of them. Shoot the carriage!', 3.4));
          sniper('pylon', { y: this.sp.world.anchors.pylonDeck.y, delay: 6, lockTime: 2.6 });
          sniper('cliff', { y: terrainAt(SNIPERS.cliff.x, SNIPERS.cliff.z), delay: 20, lockTime: 2.6 });
          if (A) { g.cinematicLook = V(90, 70, -150); g.cinematicW = 1.0; }
        }, update: (t) => {
          for (const e of g.events) {
            if (e.type === 'cabDrop') { later(1.2, () => say('...That one\'s going to leave a mark.', 2.4)); if (A) { g.cinematicLook = e.P.clone().setY(e.P.y - 30); g.cinematicW = 2.5; later(3, () => { g.cinematicLook = V(80, 140, -307); g.cinematicW = 1.2; }); } }
            if (e.type === 'cabCrash') later(0.4, () => say('Didn\'t even need a ticket.', 2));
            if (e.type === 'snap') { later(0.2, () => say('That\'s the HAUL ROPE! Brakes — come on, come ON—', 2.8)); }
          }
        }, until: () => this.sp.ride?.state === 'arrived' },
      // 8 ---- out of the cabin, into the arrival hall (and your ride rolls back down the line)
      { name: 'hall', wp: V(87, 141.5, -326), hunt: true, arrive: true, music: 0.85, storm: 0.85, enter: () => {
          g.cinematicLook = null;
          say('...We\'re in. Out — OUT, the brakes won\'t hold it!', 2.6);
          later(1.8, () => hud.objective('Into the station'));
          S({ x: 72, z: -316, delay: 1.5 }); S({ x: 100, z: -300, delay: 2.5 }); S({ x: 92, z: -322, delay: 4, entry: V(90, 140, -326) });
          A?.go([{ p: V(80.7, 140, -305.9), nav: null, tol: 0.4 }, { p: V(83.6, 140, -305.9), nav: null, tol: 0.5 },   // out through the door (rear half of the east side)
            go(86, -312, { slow: 0.6 }), go(87, -322, { slow: 0.6 })]);
        }, update: () => {
          for (const e of g.events) if (e.type === 'rollback') later(0.5, () => say('There goes the cabin. Don\'t look— okay, look. That was pretty good.', 3));
        }, until: (t) => (t > 6 && alive() === 0 && pz() < -322) || t > 80 * T },
      // 9 ---- the courtyard: they fire DOWN from the roof walk
      { name: 'court', wp: V(STAIR_A.x0 + 1, 141.5, -379.5), hunt: true, arrive: true, music: 0.95, storm: 0.85, enter: () => {
          hud.objective('Up to the roof walk — the stairs on the right');
          S({ x: 80, z: -340, delay: 0.5 }); S({ x: 100, z: -346, delay: 1 }); S({ x: 124, z: -338, delay: 1.6, flanker: true }); S({ x: 68, z: -358, delay: 2.6 });
          for (const [x, d] of [[80, 3], [96, 5], [112, 8], [88, 12]]) S({ x, z: -385, y: BLOCK.roofY, delay: d });
          for (const [d, i] of [[10, 0], [14, 1], [18, 0]]) { const D = this.sp.world.anchors.blockDoors?.[i]; if (D) S({ x: D.x, z: D.z, delay: d, entry: D.clone().setZ(D.z + 6) }); }
          later(1.4, () => say('On the ROOF! They\'ve got the high ground — sandbags up there!', 3));
          A?.go([go(84, -334, { slow: 0.5 }), go(100, -344, { slow: 0.45 }), go(112, -362, { slow: 0.45 }), go(STAIR_A.x0 - 1, -376.5, { slow: 0.5 })]);
        }, until: (t) => (t > 10 && alive() === 0) || t > 110 * T },
      // 10 ---- the roof walk: west along it, firing DOWN into the courtyard
      { name: 'roof', wp: V(72, 149.5, -385), hunt: true, arrive: true, music: 1.0, storm: 0.75, enter: () => {
          hud.objective('Along the roof — the observatory');
          S({ x: 116, z: -386, y: BLOCK.roofY, delay: 1 }); S({ x: 100, z: -388, y: BLOCK.roofY, delay: 2 }); S({ x: 84, z: -387, y: BLOCK.roofY, delay: 4, flanker: true });
          S({ x: 96, z: -356, delay: 5 }); S({ x: 76, z: -346, delay: 7 }); S({ x: 120, z: -350, delay: 9 }); S({ x: 66, z: -366, delay: 12 });
          sniper('radar', { y: BLOCK.roofY + 0.2, delay: 3, lockTime: 2.4 });
          later(6, () => say('More of them in the courtyard below you. Shoot down — they can\'t hide from up here.', 3.2));
          A?.go([{ p: V(STAIR_A.x0 + 1, 140, -380), nav: null }, { p: V(STAIR_A.x1, 148, -380), nav: null }, { p: V(124, 148, -381), nav: null }, go(116, -386, { slow: 0.5 }), go(96, -386, { slow: 0.45 }), go(80, -386, { slow: 0.5 })]);
        }, until: (t) => (t > 10 && alive() === 0 && px() < 80) || t > 110 * T },
      // 11 ---- the terrace: the storm breaks. The face. The convoy. The cannons.
      { name: 'summit', wp: V(64, 157.5, -383.5), music: 0.6, storm: 0.75, enter: () => {
          hud.objective('Up to the observatory terrace');
          this.broke = false;
          A?.go([{ p: V(72, 148, -384.5), nav: null, tol: 1.0 }, { p: V(72, 156, -397.8), nav: null }, { p: V(67, 156, -398), nav: null, tol: 0.8 }, { p: V(65, 156, -383.5), nav: null, tol: 0.8 }]);   // across the landing, THEN onto the terrace (its railing runs along x 70)
        }, update: (t) => {
          if (!this.broke && py() > TOWER.roofY - 1) {
            this.broke = true; this.brokeT = 0; this.stormTarget = 0;
            this.sp.showRidge();
            g.slowmo(1.2, 0.6, true);
            say('...Would you look at that. The storm\'s breaking.', 2.8);
            later(3.6, () => say('Bad news: snowcats on the face. A whole convoy, coming down on top of us.', 3.4));
            later(8.2, () => say('Good news: see those red tubes on the ridge? Avalanche cannons. Gas.', 3.2));
            later(12, () => { say('Light them up. Bring the mountain down on them.', 2.8); hud.objective('Shoot the avalanche cannons on the ridge'); hud.setWaypoint(this.sp.ridge.targets[1].p.clone().setY(this.sp.ridge.targets[1].p.y + 14)); });
            if (A) { g.cinematicLook = V(110, 330, -650); g.cinematicW = 1.0; }
          }
          if (this.broke) {
            this.brokeT += g.fx.dt0 || 0;
            // VR rule: the cannons only go off by themselves once you're looking up at the face
            if (this.brokeT > 32 && !this.sp.chain && looking(V(110, 380, -690), 0.7)) { say('Fine — I\'ll do it. Watch the ridge.', 2); for (const t2 of this.sp.ridge.targets.slice(0, 2)) later(1 + this.sp.ridge.targets.indexOf(t2) * 0.5, () => this.sp.gazexBoom(t2)); }
            if (this.brokeT > 46 && !this.sp.chain) for (const t2 of this.sp.ridge.targets.slice(0, 2)) this.sp.gazexBoom(t2);
          }
        }, until: () => !!this.sp.aval },
      // 12 ---- the slab lets go. Watch it. Then run.
      { name: 'avalanche', wp: null, music: 1.0, storm: 0.1, enter: () => {
          hud.setWaypoint(null);
          this.stormTarget = 0.05;
          say('...Uh-oh.', 1.2);
          later(1.8, () => { g.slowmo(3.2, 0.32, true); say('IT\'S ALL COMING DOWN!', 2); });
          if (A) { g.cinematicLook = V(110, 280, -620); g.cinematicW = 1.2; }
        }, update: (t) => {
          if (A && this.sp.av.on) g.cinematicLook.set(110, this.sp.av.crest(110, _to).y, this.sp.av.zf);
        }, until: (t) => (this.sp.av.on && this.sp.av.t > 2.4) || t > 14 },
      // 13 ---- run for the gallery
      { name: 'run', wp: V(GALLERY.x0 + 6, GALLERY.y + 1.5, -390), music: 1.0, storm: 0.35, enter: () => {
          g.cinematicLook = null;
          say('RUN! The railway gallery — along the roof, EAST! GO GO GO!', 3);
          later(0.6, () => hud.objective('RUN! The gallery — east along the roof'));
          A?.go([{ p: V(66, 156, -397.5), nav: null, sprint: true, tol: 0.8 }, { p: V(72, 156, -397.5), nav: null, sprint: true }, { p: V(72, 148, -383.5), nav: null, sprint: true }, go(100, -386.5, { sprint: true }), go(130, -386.5, { sprint: true }), go(150, -389, { sprint: true }), go(186, -391.5, { sprint: true })]);
        }, update: () => {
          if (px() > GALLERY.x0 + 2 && first('ingal')) { hud.setWaypoint(V(GALLERY.x0 + 46, GALLERY.y + 1.5, -391)); say('Keep going! Deeper! Get away from the openings!', 2.4); }
        }, until: (t) => !!this.sp.aval?.over || t > 70 },
      // 14 ---- it goes over the gallery. Then: headlights in the tunnel.
      { name: 'gallery', wp: null, music: 1.0, storm: 0.6, enter: () => {
          hud.setWaypoint(null);
          later(4.5, () => say('...Hey. HEY! Still with me? Lights — in the tunnel. That\'s me.', 3.2));
          later(6.5, () => { hud.setWaypoint(V(RAILCAR.x - 4, GALLERY.y + 2, RAILCAR.z)); hud.objective('Get on the railcar'); });
          A?.go([go(GALLERY.x0 + 60, -391.5, { sprint: false }), { p: V(RAILCAR.x - 5.5, GALLERY.y, RAILCAR.z), nav: null }]);
        }, update: (t) => { if (t > 6 && this.sp.canBoardRail()) this.sp.boardRail(); },
        until: () => this.sp.onRail },
      { name: 'outro', music: 1.0, storm: 0.6, enter: () => {
          audio.musicStinger('victory');
          audio.stopLoop('dust_roar');
          hud.setWaypoint(null);
          later(1.2, () => say('Next stop: the valley. I\'ll put the heating on.', 2.8));
          later(trailer ? 2.2 : 3.0, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.kills, 'GOON')}  •  ${pl(g.snipersDown, 'SNIPER')}  •  1 CABLE CAR  •  1 MOUNTAIN  •  SCORE ${g.score}`;
            const P = g.headPos.clone().add(V(10, 1.8, 0));
            hud.showTitle(P, 'WHITEOUT', sub, 999);
            g.cinematicLook = P.clone();
          });
        }, update: (t) => { hud.black.material.opacity = clamp((t - 0.6) / 1.4, 0, 0.6); },
        until: (t) => t > (trailer ? 8 : 11) },
    ];
    // ?beat=<name>: jump straight to a beat (screenshots / testing)
    const jump = game.params.get('beat');
    const START_P = {
      road1: [START.x + 4, START.z - 1.5], road2: [ROAD1_END.x, ROAD1_END.z], road3: [ROAD2_END.x, ROAD2_END.z], yard: [36, 46],
      board: [85, 8], cable: [80.3, -9.6], hall: [83.3, -307], court: [87, -324], roof: [STAIR_A.x0 - 2, -376], summit: [76, -385], avalanche: [65, -383.5], run: [65, -383.5], gallery: [GALLERY.x0 + 30, -391], outro: [RAILCAR.x - 6, RAILCAR.z],
    };
    const ji = jump ? this.steps.findIndex(s => s.name === jump) : -1;
    if (ji > 0) {
      for (let i = 0; i < ji; i++) { const st = this.steps[i]; if (st.storm !== undefined) this.stormTarget = game.storm = st.storm; }
      const p = START_P[jump]; if (p && !game.params.has('px')) game.rig.position.set(p[0], groundAt(p[0], p[1]), p[1]);
      const idx = (n) => this.steps.findIndex(s => s.name === n);
      g.quietScore = true; g.fx.later(3, () => { g.quietScore = false; });
      const sp = this.sp;
      if (ji > idx('yard')) for (const e of sp.exp) if (e.kind === 'fueltank') { e.alive = false; sp.fires.push({ p: e.p.clone().setY(30.3), size: 2.2, light: 1.5, t: 0, life: 999, col: true }); }
      if (ji === idx('cable')) { sp.board(); }
      if (ji > idx('cable')) {
        sp.ride = { state: 'arrived', t: 0, v: 0, d: -10.2 - DOCK.z, snapped: true, gunmen: [] };
        for (const b of sp.cab.dockBoxes) g.col.remove(b);
        sp._placeCab(sp.cab, DOCK.z); sp.cab.m.setDoor(true); sp.cab.dockBoxes = sp._dockColliders(sp.cab);
        sp.enemyCab = { state: 'dead' }; sp.cab2.root.visible = false;
      }
      if (ji > idx('hall')) { sp.ride.state = 'out'; sp.cab.root.visible = false; for (const b of sp.cab.dockBoxes) g.col.remove(b); }
      if (ji > idx('summit')) { this.stormTarget = g.storm = 0.05; this.broke = true; sp.showRidge(); for (const t2 of sp.ridge.targets) t2.alive = false; sp.chain = true; sp.release(); }
      if (ji > idx('avalanche')) { sp.aval.phase = 'slide'; sp.av.blocks.release(sp.rng); sp.av.start(); sp.av.zf = -560; sp.av.H = 40; sp.av.v = 30; sp.av.t = 3; }
      if (ji >= idx('gallery')) { sp.aval.over = true; sp.aval.overT = 3; sp.curtain.mesh.visible = true; sp.av.zf = -330; }
      if (ji >= idx('outro')) sp.boardRail();
      g.score = [0, 0, 1800, 4200, 6600, 9800, 11000, 15600, 17000, 21000, 24500, 25500, 27500, 29000, 31000][ji] || 0;
      for (const c of hud.callouts) hud.scene.remove(c.s); hud.callouts.length = 0;
      for (const Ln of Object.values(hud.lanes || {})) { Ln.q.length = 0; Ln.cur = null; }
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
    if (s.storm !== undefined) this.stormTarget = s.storm;
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
    // the storm eases toward its target (it breaks over ~8 s at the summit)
    this.g.storm = damp(this.g.storm, this.stormTarget, this.stormTarget < this.g.storm ? 0.35 : 0.5, dt);
    this.g.events.length = 0;
  }
}
