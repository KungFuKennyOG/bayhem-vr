import * as THREE from 'three';
import { clamp, range } from '../../rng.js';
import { HERO } from './layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _look = new THREE.Vector3(), _to = new THREE.Vector3();

// =====================================================================================
//  SAND CASTLES — the beats. The helicopter flies the route by itself; each beat sets the
//  cruise speed, may HOLD the aircraft at a point (a hover) until the fight there is done or
//  a timeout passes (reaching the marker always moves the level on), and turns the door toward
//  the fight. VR rules: the big moments (the wingman, the haboob, the Spire) wait until you are
//  looking (or ~5 s), and the objective card comes after the money shot.
//  Driver = HAMMER ONE's pilot (same voice as the other levels' driver).
// =====================================================================================
export class Director {
  constructor(game, hud, audio, setp, W, opts) {
    Object.assign(this, { g: game, hud, audio, sp: setp, W, trailer: opts.trailer, auto: opts.auto });
    this.stepIdx = -1; this.t = 0; this.total = 0; this.done = false;
    const g = game, rail = W.rail, F = W.F;
    const T = opts.trailer ? 0.75 : 1;
    const say = (line, d = 3) => hud.subtitle('DRIVER', line, d);
    const later = (t, fn) => g.fx.later(t, fn);
    const S = (tag) => rail.tag(tag);
    const looking = (P, dot = 0.86) => { g.camera.getWorldDirection(_look); _to.subVectors(P, g.headPos).normalize(); return _look.dot(_to) > dot; };
    this.looking = looking;
    const fight = (i) => W.plan.fights[i];
    const squad = (i, delay = 0) => { const f = fight(i); return g.spawnRoof(f.tower, f.men, f.rpg, { delay }); };
    const alive = (list) => list.filter(m => m.alive).length;
    const roofP = (i) => { const t = fight(i).tower; return V(t.x, t.h + 2, t.z); };
    const speed = (k) => rail.setCruise(F.speed * k);
    this.once = new Set();
    const first = (k) => { if (this.once.has(k)) return false; this.once.add(k); return true; };
    this.react = (e) => {
      if (e.type === 'nearMiss' && first('nearmiss')) later(0.3, () => say('RPG! Too close — keep their heads down!', 2.4));
      if (e.type === 'heliHit' && first('hit1')) later(0.4, () => say("We're hit — we're still flying. Keep shooting!", 2.6));
      if (e.type === 'kill' && e.m.role === 'rpg' && first('rpgkill')) later(0.6, () => say('RPG team down. Good.', 2));
      if (e.type === 'aaDown' && e.how !== 'strike' && first('aagun')) later(0.6, () => say('You shot the flak gun off a skyscraper. With a door gun. Noted.', 3));
      if (e.type === 'towerLanded' && first('landed')) later(0.8, () => say('...And that was a forty-storey building. Insurance is going to love us.', 3.2));
    };
    // the fight stations' squads
    this.squads = [];
    // ---------------------------------------------------------------- the beats
    this.steps = [
      // 1 ---- title over the Gulf, the palm island below, the skyline ahead
      { name: 'intro', music: 0.25, enter: () => {
          hud.black.material.opacity = 1;
          speed(1.15);
          this.cityP = V(-1350, 160, -1350);
          rail.face(this.cityP);
          g.fx.later(0.05, () => hud.showTitle(g.headPos.clone().add(this._outF().multiplyScalar(26)).add(V(0, 3, 0)), 'SAND CASTLES', 'LEVEL 8  •  AL-SARAB, 15:40', T * 6));
          audio.startMusic();
          g.spawnWing();
          g.idleLook = this.cityP;
          later(1.2, () => say("Al-Sarab. Tallest skyline on Earth, and as of this morning, it's all theirs.", 3.6));
          later(5.6, () => say("HAMMER TWO on our right. You're on the door gun. Marina first — they've got men on the roofs.", 3.8));
        }, update: (t) => { hud.black.material.opacity = Math.max(0, 1 - t / 2.2); },
        until: (t) => rail.s > S('coast') - 120 || t > 60 },
      // 2 ---- the marina: three roofs on the canal (pools, a pad, a deck)
      { name: 'marina', music: 0.6, wp: () => roofP(0), enter: () => {
          speed(0.82);
          g.idleLook = null;
          this.squads = [squad(0, 0.5), squad(1, 4), squad(2, 9)];
          hud.objective('Clear the marina rooftops');
          later(0.4, () => say('Pool deck on the left — gunmen. Light them up!', 2.6));
          later(9, () => say('Helipad — RPG! Shoot the rocket if you have to!', 2.8));
          rail.holdAt(S('marina2') + 140);
        }, update: (t) => {
          // face the nearest live squad's roof
          const cur = [0, 1, 2].find(i => alive(this.squads[i]) > 0);
          rail.face(cur != null ? roofP(cur) : null);
          if (cur != null) hud.setWaypoint(roofP(cur));
          if (cur == null && first('marinaClear')) { say('Marina clear. Moving down the boulevard.', 2.4); rail.release(); }
        }, until: (t) => (t > 6 && this.squads.every(q => alive(q) === 0) && rail.s > S('marina2')) || (rail.holding && t > 70 * T) || t > 110 },
      // 3 ---- the boulevard: the canyon, three more roofs, HAMMER TWO goes down
      { name: 'blvd', music: 0.7, enter: () => {
          rail.release(); speed(0.9); hud.setWaypoint(roofP(3));
          for (const q of this.squads) g.dropSquad(q);
          this.squads = [squad(3, 1), squad(4, 5), squad(5, 10)];
          later(0.6, () => say('Crescent Boulevard. Every roof on the left is shooting at us.', 3));
          rail.holdAt(S('blvd2') + 470);
        }, update: (t, dt) => {
          const cur = [0, 1, 2].find(i => alive(this.squads[i]) > 0);
          rail.face(cur != null ? roofP(3 + cur) : null);
          if (cur != null) hud.setWaypoint(roofP(3 + cur));
          // HAMMER TWO: an RPG from the far roof, when you can see it happen
          const w = g.wing;
          if (w && w.phase === 'fly' && rail.s > S('blvd2') - 120 && !this.wingArmed) {
            this.wingArmed = true; this.wingT = 0;
            w.side = 1; // the pilot pulls him onto the door side first ("HAMMER TWO, tighten up")
            say('HAMMER TWO, tighten up on our left.', 2.2);
          }
          if (this.wingArmed && !this.wingShot) {
            this.wingT += dt;
            if ((looking(w.pos, 0.82) && this.wingT > 2.5) || this.wingT > 7) {
              this.wingShot = true;
              const f = fight(5).tower, from = V(f.x, f.h + 2, f.z);
              const r = g.fireRocket(from, 'rpg', 0);
              r.vel.copy(w.pos.clone().sub(from).normalize().multiplyScalar(90)); r.wing = true;
              say('RPG — HAMMER TWO, BREAK—', 1.4);
            }
          }
          if (this.wingShot && !this.wingDown && g.wing?.phase === 'fly') {
            const r = g.rockets.find(x => x.wing);
            if (!r || r.pos.distanceTo(g.wing.pos) < 6) { if (r) g.explodeRocket(r, false); g.shootDownWing(); this.wingDown = true; g.slowmoReq(2.2, 0.3, true); later(0.8, () => say("HAMMER TWO is hit! He's going in — he's going in!", 2.8)); later(5, () => say("...No chutes. Make them pay for it.", 2.6)); }
          }
          if (cur == null && first('blvdClear')) { rail.release(); later(0.5, () => say('Boulevard clear. Turning south.', 2)); }
        }, until: (t) => (t > 8 && this.squads.every(q => alive(q) === 0) && rail.s > S('blvd2') + 200) || (rail.holding && t > 60 * T) || t > 120 },
      // 4 ---- the haboob: look south, a 900 m wall of sand rolls over the city
      { name: 'haboob', music: 0.55, enter: () => {
          rail.release(); speed(1.0);
          for (const q of this.squads) g.dropSquad(q);
          if (g.wing && g.wing.phase === 'fly') g.shootDownWing();
          this.sp.haboob.start(1900, 40);
          this.habP = V(1300, 400, 2400);
          later(1.0, () => say("Hold on. Look south. ...That's not smoke.", 3));
          later(4.5, () => say("Haboob. A sandstorm the size of the city — and it's coming right at us.", 3.6));
        }, update: (t) => {
          const hb = this.sp.haboob.state;
          this.habP.set(g.headPos.x, 230, hb ? hb.z : 2000);
          rail.face(this.habP);
          hud.setWaypoint(t < 9 ? this.habP : null);
          if (this.auto) g.cinematicLook = this.habP;
          // the storm look comes on as the front reaches you
          const inside = this.sp.haboob.inside(g.headPos);
          this.sp.storm = Math.max(this.sp.storm, clamp((inside + 120) / 380, 0, 1));
        }, until: (t) => this.sp.storm > 0.7 || t > 40 },
      // 5 ---- WIDOWMAKER 4 in the murk; it ends up in a tower
      { name: 'gunship', music: 0.9, enter: () => {
          g.cinematicLook = null;
          speed(0.78);
          g.spawnGunship();
          hud.objective('WIDOWMAKER 4 — shoot it down');
          later(0.5, () => say("Contact! Gunship in the dust — WIDOWMAKER again. How many of these do they HAVE?", 3.6));
          later(9, () => say('Rockets! Shoot them out of the air!', 2.4));
          rail.holdAt(S('pass') + 60);
        }, update: (t) => {
          this.sp.storm = Math.max(this.sp.storm, clamp((this.sp.haboob.inside(g.headPos) + 120) / 380, 0, 1));
          const gs = g.gunship;
          if (gs && gs.phase === 'fight') { rail.face(gs.pos); hud.setWaypoint(gs.pos); }
          // the crash: into the twisted tower south of the route
          if (gs && gs.phase === 'dying' && !gs.crashAt) { const C = this.sp.tower('C1'); gs.crashAt = V(C.x, C.h * 0.62, C.z); later(0.8, () => say("He's going down — into that tower! LOOK!", 2.4)); g.cinematicLook = gs.crashAt; }
          // a long fight: the jets finish him so the level moves on
          if (gs && gs.phase === 'fight' && t > 75 * T) { gs.hp = 0; g.killGunship(); say('Splash! Fast movers took him. Thank you, Air Force.', 2.8); }
        }, until: (t) => this.crashDone && t > 3 },
      // 6 ---- the strike: the storm passes, the designator, the AA towers come down one by one
      { name: 'strike', music: 0.8, enter: () => {
          g.cinematicLook = null; g.ceasefire = false;
          rail.release(); speed(0.72);
          this.stormFade = true;
          for (const id of ['T1', 'T2', 'T3', 'T4']) { const T_ = this.sp.tower(id); this.sp.strikes.addTarget(T_); const a = g.aas.find(x => x.tower === T_); if (a) a.active = true; }
          this.sp.strikes.on = true;
          later(0.6, () => say("Storm's breaking. Flak towers ahead — four of them. Laser's on your left hand: hold it on the building till it locks.", 4.4));
          later(5.5, () => hud.objective('Paint the flak towers — hold the laser on them'));
          rail.holdAt(S('strike3') + 60);
          this.escT = 18;
        }, update: (t, dt) => {
          const left = ['T1', 'T2', 'T3', 'T4'].map(id => this.sp.tower(id)).filter(T_ => !this.sp.strikes.targets.get(T_)?.called);
          // the nearest unpainted target: door toward it, waypoint on it, the autopilot paints it
          let best = null, bd = 1e9; for (const T_ of left) { const d = Math.hypot(T_.x - g.headPos.x, T_.z - g.headPos.z); if (d < bd) { bd = d; best = T_; } }
          if (best) { const P = V(best.x, best.h * 0.86, best.z); rail.face(P); hud.setWaypoint(P); g.paintTarget = this.auto ? P : null; } else { g.paintTarget = null; rail.face(null); }
          // escalation: a neighbour every ~25 s, never more than two towers falling at once
          this.escT -= dt;
          if (this.escT <= 0 && this.sp.falling() < 2) { this.escT = 22; const id = ['E1', 'E2', 'E3'].find(i => !this.sp.mids.isDown(this.sp.tower(i).rigIdx)); if (id) { this.sp.fallTower(id, g.headPos); if (first('esc')) later(1, () => say("They're blowing their own buildings now. Scorched earth.", 3)); } }
          if (!left.length && first('strikeDone')) { rail.release(); later(1.5, () => say("That's all four. Now the big one.", 2.4)); }
          // pacing: whatever is left gets bombed for you
          // (one at a time, and only while fewer than two towers are falling: the staggered finale rule)
          this.autoCallT = (this.autoCallT ?? 0) - dt;
          if (t > 95 * T && left.length && this.autoCallT <= 0 && this.sp.falling() < 2) {
            this.autoCallT = 7;
            const T_ = best || left[0], tg = this.sp.strikes.targets.get(T_); tg.called = true; this.sp.strikes.call(T_, tg, V(T_.x, T_.h * 0.8, T_.z));
            if (first('bombers')) say('Bombers have the rest. Come about — the Spire.', 2.6);
          }
          g.sunsetTarget = clamp(0.25 + t / 120, 0, 0.8);
        }, until: (t) => (t > 10 && this.sp.strikes.remaining() === 0 && this.sp.falling() === 0 && rail.s > S('strike3') - 200) || t > 140 },
      // 7 ---- the Spire: hover, paint the base, the money shot
      { name: 'spire', music: 1.0, enter: () => {
          g.paintTarget = null;
          speed(0.7);
          rail.holdAt(S('spire'));
          for (const a of g.aas) a.active = false;
          this.heroP = V(HERO.x, 360, HERO.z);
          this.sp.strikes.addTarget(this.sp.heroTarget, 360);
          this.sp.strikes.on = true;
          later(1.0, () => say('SARAB SPIRE. Seven hundred metres of command post. Paint her, then hang on to something.', 3.8));
          later(5.2, () => hud.objective('Paint the SARAB SPIRE'));
        }, update: (t, dt) => {
          rail.face(this.heroP);
          hud.setWaypoint(this.heroP);
          if (this.auto) g.paintTarget = rail.holding ? V(HERO.x, 360, HERO.z) : null;
          // the marker always moves the level on: after a while in the hover the bombers take the shot
          if (rail.holding) this.holdT = (this.holdT ?? 0) + dt;
          if (this.holdT > 22 && !this.heroStruck && !this.heroCalled) { this.heroCalled = true; const tg = this.sp.strikes.targets.get(this.sp.heroTarget); if (tg && !tg.called) { tg.called = true; this.sp.strikes.call(this.sp.heroTarget, tg, V(HERO.x, 360, HERO.z)); } say('Bombers are on her. Watch the Spire!', 2.4); }
          g.sunsetTarget = Math.max(g.sunsetTarget ?? 0, 0.85);
          if (this.heroStruck && !this.heroGo && (looking(V(HERO.x, 330, HERO.z), 0.8) || t - this.heroStruck > 5)) {
            this.heroGo = true; g.paintTarget = null; hud.setWaypoint(null);
            this.sp.strikes.on = false;
            this.sp.hero.fallDir = new THREE.Vector3(1, 0, 0.25).normalize();
            this.sp.hero.start(g.headPos);
            this.sp.heroDown = true;
            g.events.push({ type: 'heroFall' });
            later(1.0, () => say('Here she comes...', 1.8));
            later(5.0, () => { say("THE SPIRE — IT'S COMING AT US! HOLD ON!", 2.4); rail.dive(-48); });
            later(6.0, () => { this.sp.wall.start(1050, 1500, 620); });
            later(7.5, () => this.sp.fallTower('N1', g.headPos, { x: 0.3, z: 1 }));
            later(13, () => { rail.dive(-20); say('...She is down. Al-Sarab just lost its skyline.', 3); });
            if (this.auto) { g.cinematicLook = V(HERO.x + 60, 260, HERO.z); g.cinematicW = 1.2; }
          }
        }, until: (t) => this.heroGo && this.sp.hero.done() && t > 20 },
      // 8 ---- out over the dust sea to the Gulf at sunset, limping
      { name: 'escape', music: 0.5, enter: () => {
          rail.release(); speed(0.85); rail.face(null);
          g.cinematicLook = null; g.idleLook = V(HERO.x - 200, 120, HERO.z + 300);
          this.W.cabin.U.uWarn.value = 0.6; audio.play('warn_tone', {});
          later(1.2, () => say("Master caution's lit. Number two engine's eating sand. We're going home slow.", 3.6));
          later(8, () => say('Look at it. Twenty minutes ago that was a city.', 2.8));
          hud.setWaypoint(null);
        }, update: (t) => { g.sunsetTarget = 1; this.W.cabin.U.uWarn.value = 0.6 * (1 - clamp(t / 12, 0, 1)); },
        until: (t) => rail.s > S('sea') - 200 || t > 70 * T },
      { name: 'outro', music: 1.0, enter: () => {
          audio.musicStinger?.('victory');
          later(opts.trailer ? 1 : 1.6, () => {
            const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 'S'}`;
            const sub = `${pl(g.kills, 'GOON')}  •  ${pl(g.rpgsDown, 'ROCKET')}  •  ${pl(g.towersDown, 'TOWER')}  •  1 GUNSHIP  •  SCORE ${g.score}`;
            const P = g.headPos.clone().add(this._outF().multiplyScalar(14)).add(V(0, 2.5, 0));
            hud.showTitle(P, 'SAND CASTLES', sub, 999);
            g.cinematicLook = P.clone();
          });
        }, update: (t) => { hud.black.material.opacity = clamp((t - 0.2) / 1.2, 0, 0.5); },
        until: (t) => t > (opts.trailer ? 7 : 10) },
    ];
    this._jump(game.params.get('beat'));
    this.next();
  }
  _outF() { const q = this.g.rig.getWorldQuaternion(new THREE.Quaternion()); return new THREE.Vector3(0, 0, -1).applyQuaternion(q).setY(0).normalize(); }
  // ?beat=<name>: jump straight to a beat, with the world in the state it would be in
  _jump(name) {
    const ji = name ? this.steps.findIndex(s => s.name === name) : -1;
    if (ji <= 0) return;
    const g = this.g, W = this.W, rail = W.rail, sp = this.sp;
    const at = { marina: 'coast', blvd: 'marina2', haboob: 'turn', gunship: 'haboob', strike: 'pass', spire: 'spire', escape: 'spire', outro: 'sea' }[name];
    const off = { marina: -40, blvd: 300, haboob: 0, gunship: 700, strike: 0, spire: -330, escape: 0, outro: -260 }[name] || 0;
    rail.jumpTo(rail.tag(at) + off, W.F.speed * (name === 'spire' ? 0.45 : 0.8));
    g.quietScore = true; g.fx.later(3, () => { g.quietScore = false; });
    const idx = (n) => this.steps.findIndex(s => s.name === n);
    if (name === 'blvd') g.spawnWing();
    if (ji > idx('blvd')) { this.wingDown = true; }
    if (ji > idx('haboob')) { sp.storm = 1; sp.haboob.start(rail.pos.z - 500, 32); }
    if (ji > idx('gunship')) { this.crashDone = true; sp.setFallen('C1', g.headPos); sp.storm = 0.6; this.stormFade = true; }
    if (ji > idx('strike')) { for (const id of ['T1', 'T2', 'T3', 'T4', 'E1', 'E2', 'E3']) sp.setFallen(id, g.headPos); for (const a of g.aas) { a.alive = false; a.root.visible = false; } sp.storm = 0; g.sunsetTarget = 0.85; g.sunset = 0.8; sp.wall.start(1050, 1500, 620); sp.wall.state.t = 30; }
    if (ji > idx('spire')) { sp.heroDown = true; sp.hero.fallDir = new THREE.Vector3(1, 0, 0.25).normalize(); sp.hero.start(g.headPos); this.heroGo = true; for (let i = 0; i < 1200; i++) sp.hero.update(1 / 30); sp.setFallen('N1', g.headPos); g.sunsetTarget = 1; g.sunset = 1; g.slowT = 0; }
    g.score = [0, 0, 2400, 6200, 7000, 15000, 26000, 40000, 46000][ji] || 0;
    for (const c of this.hud.callouts) this.hud.scene.remove(c.s); this.hud.callouts.length = 0;
    for (const L of Object.values(this.hud.lanes || {})) { L.q.length = 0; L.cur = null; }
    this.stepIdx = ji - 1;
  }
  next() {
    this.stepIdx++; this.t = 0;
    const s = this.steps[this.stepIdx];
    if (!s) { this.done = true; return; }
    this.cur = s;
    this.audio.setMusicIntensity(s.music);
    this.hud.setWaypoint(s.wp ? s.wp() : null);
    s.enter();
  }
  update(dt, rdt) {
    const g = this.g;
    for (const e of g.events) {
      this.react(e);
      if (e.type === 'gunshipCrash') { const C = this.sp.tower('C1'); this.sp.fallTower('C1', g.headPos, { x: 0.2, z: 1 }); this.sp.column(e.p.x, e.p.z, 120, 1); g.fx.later(4, () => { this.crashDone = true; g.cinematicLook = null; }); }
      if (e.type === 'wingCrash') this.sp.column(e.p.x, e.p.z, 100, 0.9);
      if (e.type === 'heroStruck') this.heroStruck = this.t;
    }
    if (!this.done) {
      this.t += dt; this.total += dt;
      this.cur.update?.(this.t, dt);
      if (this.cur.until(this.t)) this.next();
    }
    // the storm passes once the gunship is down
    if (this.stormFade) this.sp.storm = Math.max(0, this.sp.storm - dt / 35);
    g.events.length = 0;
  }
}
