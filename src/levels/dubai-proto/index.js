import * as THREE from 'three';
import { readFlags, midTowers, farTowers, HERO } from './layout.js';
import { ProtoGame } from './game.js';
import { MidTowers, FarSkyline, buildGround } from './towers.js';
import { HeroTower } from './hero.js';
import { OverDust, HorizonWall } from './overdust.js';
import { HeliRail } from './rail.js';
import { PerfPanel } from './debug.js';
import { Player } from '../../player.js';
import { SUN_DIR, setSunElevation } from '../../atmosphere.js';
import { range } from '../../rng.js';

// =====================================================================================
//  LEVEL 8 PROTOTYPE — "DUBAI" as grey boxes, built to answer one question on a Quest 3:
//  can a door-gunner heli loop around a skyline where a hero supertall and 4–6 mid towers
//  all come down at once, in a sea of dust seen from above, while the far skyline swaps to
//  ruins without a visible pop — at 72 fps?  Flags + test plan: DESIGN.md.
// =====================================================================================

export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  const F = readFlags(params, E.isQuest);
  setSunElevation(7, SUN_DIR);
  scene.fog.near = 500; scene.fog.far = 6500;
  camera.far = 12000; camera.updateProjectionMatrix();
  fx.fireHue = 1; fx.heat = 0.9; // orange fire against the dust (no white blow-outs), the Level 2+ look
  fx.groundAt = () => 0;
  // no sun shadows: the shadow frustum follows the rig (~140 m) and at 250 m up nothing in the city lands in it,
  // but the pass still renders every caster (fx debris) and compiled a depth program mid-collapse. &shadows=1 to compare.
  if (!params.has('shadows') || params.get('shadows') === '0') renderer.shadowMap.enabled = false;

  const game = new ProtoGame(E);
  game.allowSlowmo = F.slowmo;
  buildGround(scene);
  const mids = new MidTowers(scene, midTowers(F.towers), F);
  const far = new FarSkyline(scene, farTowers(F.far), F);
  const dust = new OverDust(scene, scene.fog, F);
  const wall = new HorizonWall(scene, scene.fog);
  const hero = F.hero ? new HeroTower(game, dust, F) : null;
  const rail = new HeliRail(E, F, game, mids.list);
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = 0; player.pitch = -0.12;
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  game.focus = new THREE.Vector3(0, 250, 0);
  const panel = new PerfPanel(E, F, F.hz || 72);
  panel.mount(F.panel === 'wrist' ? 'cabin' : F.panel, rig, null); // the wrist mount needs a controller: re-mounted on connect

  // ---------------------------------------------------------------- the set-piece scheduler
  // phases are what the per-phase table in the panel measures
  const T = { phase: 'idle', t: 0, step: 0, gen: 0, midNext: 0, midI: 0, wallStarted: false };
  const setPhase = (p) => { T.phase = p; T.t = 0; };
  // the far dust sea rises ~5 s after the first tower goes (a reset in between cancels it)
  const startWall = () => { if (!T.wallStarted) { T.wallStarted = true; const gen = T.gen; game.fx.later(5, () => { if (gen === T.gen) wall.start(950, 1265, 540); }); } };
  // on the low route a mid tower falls away from the path (the default sideways fall would sweep through it)
  const away = mids.list.map(t => F.route === 'low' ? rail.awayFrom(t.x, t.z) : null);
  const awayDir = (i) => away[i];
  // clearance: the closest the cabin gets to tower geometry (intact mid towers as footprint boxes, the intact hero,
  // flying / resting hero chunks). Falling mid towers aren't tracked (their pieces fall away from the route).
  const clearance = () => {
    const h = rail.root.position; let m = 1e9;
    mids.list.forEach((t, i) => {
      const S = mids.state[i]; if (S) return;
      const dh = Math.max(0, Math.hypot(h.x - t.x, h.z - t.z) - 0.71 * Math.max(t.w, t.d)), dv = h.y - t.h - 30;
      m = Math.min(m, dv > 0 ? Math.hypot(dh, dv) : dh);
    });
    if (hero) {
      if (!hero.S) { const dh = Math.max(0, Math.hypot(h.x, h.z) - HERO.w0 * 0.71); m = Math.min(m, h.y > HERO.h + HERO.spire ? Math.hypot(dh, h.y - HERO.h - HERO.spire) : dh); }
      for (const c of hero.chunks) if (c.state === 'fly') m = Math.min(m, Math.max(0, c.p.distanceTo(h) - Math.max(c.h.x, c.h.y, c.h.z) * 1.4));
      const sb = hero.spireBody; if (sb && !sb.landed) m = Math.min(m, Math.max(0, sb.p.distanceTo(h) - 40));
    }
    return m;
  };
  const CL = { now: 0, min: 1e9 };
  const fallMid = () => { while (T.midI < mids.list.length && !mids.fall(T.midI, awayDir(T.midI))) T.midI++; if (T.midI < mids.list.length) { T.midI++; startWall(); audio.play('collapse_rumble', { volume: 0.8 }); return true; } return false; };
  const fallHero = () => { if (hero && hero.start(game.headPos)) { startWall(); return true; } return false; };
  let dustBefore = null;
  const worst = () => {
    // everything at once + full dust
    dustBefore = dust.level; dust.setLevel('high');
    for (let i = 0; i < mids.list.length; i++) mids.fall(i, awayDir(i));
    T.midI = mids.list.length;
    fallHero(); startWall();
    // the dust sea: a few huge puffs over the whole centre, rolling out
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, r = range(150, 520); dust.sea(Math.cos(a) * r, Math.sin(a) * r); }
    setPhase('worst');
  };
  const reset = () => {
    mids.reset(); hero?.reset(); dust.clear(); wall.stop(); far.reset();
    T.midI = 0; T.wallStarted = false; T.gen++; game.slowT = 0;
    if (dustBefore) { dust.setLevel(dustBefore); dustBefore = null; }
    dust.fillPeak = 0; CL.min = 1e9;
    setPhase('idle');
  };
  // Resets are a test-harness thing (the real level never un-destroys a city), but done in the open they pop the whole
  // skyline back and look exactly like the swap failing. So a reset happens behind a short fade to black
  // (0.3 s out, 0.15 s hold, 0.4 s in: the VR-safe way to cut), and those frames aren't recorded.
  const fade = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  fade.renderOrder = 1000; fade.visible = false; camera.add(fade);
  const B = { t: -1, fn: null, done: false };
  const blink = (fn) => { if (B.t >= 0) return; B.t = 0; B.fn = fn; B.done = false; };
  const updBlink = (rdt) => {
    if (B.t < 0) return;
    B.t += rdt;
    const k = B.t < 0.3 ? B.t / 0.3 : B.t < 0.45 ? 1 : 1 - (B.t - 0.45) / 0.4;
    if (B.t >= 0.3 && !B.done) { B.done = true; B.fn(); }
    fade.material.opacity = Math.max(0, Math.min(1, k)); fade.visible = k > 0;
    if (B.t > 0.85) { B.t = -1; fade.visible = false; }
  };
  // auto timelines (&beat=): cycle (default), worst, mid, hero, idle
  const timeline = {
    cycle: [['idle', 14], ['mid', null], ['hero', null], ['settle', 26], ['reset', 0], ['idle', 6], ['worst', null], ['settle', 40], ['reset', 0]],
    worst: [['idle', 8], ['worst', null], ['settle', 40], ['reset', 0]],
    mid: [['idle', 8], ['mid', null], ['settle', 26], ['reset', 0]],
    hero: [['idle', 8], ['hero', null], ['settle', 30], ['reset', 0]],
    idle: [['idle', 1e9]],
  }[F.beat] || null;
  let manual = false; // a button press takes over from the timeline until RESET
  const runTimeline = (dt) => {
    if (!timeline || manual) return;
    const [name, dur] = timeline[T.step % timeline.length];
    const next = () => { T.step++; const [n2] = timeline[T.step % timeline.length]; enter(n2); };
    if (name === 'idle' || name === 'settle') { if (T.t > dur) next(); }
    else if (name === 'reset') { if (B.t < 0 && T.phase !== 'reset!') { T.phase = 'reset!'; blink(() => { reset(); next(); }); } }
    else if (name === 'mid') { T.midNext -= dt; if (T.midNext <= 0) { T.midNext = 4; if (!fallMid()) next(); } }
    else if (name === 'hero') { if (T.t > 4 && (!hero || hero.done() || T.t > 22)) next(); }
    else if (name === 'worst') { if (T.t > 20) next(); }
  };
  const enter = (n) => {
    if (n === 'worst') worst();
    else if (n === 'hero') { setPhase('hero'); fallHero(); }
    else if (n === 'mid') { setPhase('mid'); T.midNext = 0; }
    else if (n === 'settle' || n === 'idle') setPhase(n);
    else if (n === 'reset') setPhase('reset');
  };
  if (timeline) enter(timeline[0][0]);

  // ---------------------------------------------------------------- input (VR buttons + desktop keys)
  const prev = {};
  const press = (k, on) => { const was = prev[k]; prev[k] = on; return on && !was; };
  const DUSTS = ['off', 'low', 'mid', 'high'], PANELS = ['cabin', 'wrist', 'float', 'off'];
  const actions = {
    worst: () => { manual = true; worst(); },
    reset: () => blink(() => { manual = false; reset(); T.step = 0; if (timeline) enter(timeline[0][0]); panel.resetPhases(); }),
    mid: () => { manual = true; if (fallMid()) setPhase('mid'); },
    hero: () => { manual = true; if (fallHero()) setPhase('hero'); },
    dust: () => { dust.setLevel(DUSTS[(DUSTS.indexOf(dust.level) + 1) % 4]); hud.subtitle('DEBUG', `dust ${dust.level}`, 1.5); },
    panel: () => { const m = PANELS[(PANELS.indexOf(panel.mode) + 1) % PANELS.length]; panel.mount(m, rig, wristSpace()); hud.subtitle('DEBUG', `panel ${m}`, 1.5); },
  };
  const wristSpace = () => player.controllers.find(c => c.hand === 'left')?.space || null;
  const keys = { Digit1: 'worst', Digit0: 'reset', Digit2: 'mid', Digit3: 'hero', Digit4: 'dust', Digit5: 'panel' };
  addEventListener('keydown', (e) => { const a = keys[e.code]; if (a && !e.repeat) actions[a](); });
  const pollVR = () => {
    for (const c of player.controllers) {
      const b = c.source?.gamepad?.buttons; if (!b) continue;
      const L = c.hand === 'left';
      if (press(c.hand + 'grip', !!b[1]?.pressed)) actions[L ? 'worst' : 'reset']();
      if (press(c.hand + 'b4', !!b[4]?.pressed)) actions[L ? 'dust' : 'mid']();
      if (press(c.hand + 'b5', !!b[5]?.pressed)) actions[L ? 'panel' : 'hero']();
    }
    if (panel.mode === 'wrist' && !panel.mesh.parent) panel.mount('wrist', rig, wristSpace());
    if (F.panel === 'wrist' && !T.wristDone && wristSpace()) { T.wristDone = true; panel.mount('wrist', rig, wristSpace()); }
  };
  // display rate request, once per XR session (Quest Browser runs WebXR at 90 Hz unless asked; Level 8 targets 72)
  let hzSession = null;
  const tryHz = () => {
    if (!F.hz) return;
    const s = renderer.xr.getSession?.(); if (!s?.updateTargetFrameRate || s === hzSession) return;
    hzSession = s;
    const rates = s.supportedFrameRates ? [...s.supportedFrameRates] : [];
    if (!rates.length || rates.includes(F.hz)) s.updateTargetFrameRate(F.hz).then(() => panel.setBudget(F.hz)).catch(() => {});
  };

  // ---------------------------------------------------------------- warm-up: every program before the first frame
  const warm = new THREE.Group();
  warm.add(new THREE.Mesh(dust.clouds.geometry, dust.clouds.material));
  if (hero?.glass) warm.add(new THREE.Mesh(hero.glass.shardMesh.geometry, hero.glass.shardMesh.material));
  warm.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), far.ruined.material));
  const { buildHeli } = await import('../../heli.js'); warm.add(buildHeli().root);

  // particle / glow batches copy the fog range at creation: keep them on this level's fog
  const fogged = () => { const out = []; scene.traverse(o => { const u = o.material?.uniforms; if (u?.fogNear && u?.fogFar && !out.includes(u)) out.push(u); }); return out; };
  let fogU = null, simMs = 0;
  const _fw = new THREE.Vector3();
  const ctx = { groundAt: () => 0 };
  window.__perf = () => panel.summary();
  // A measured run starts when play starts (ENTER VR / PLAY ON DESKTOP), and again whenever the mode changes:
  // the menu in the Quest's 2D browser window renders at the window's rate and the XR session start is a
  // ~0.3 s hitch, and neither belongs in the table. The first 1.5 s of a run aren't recorded either.
  let runKey = null, graceUntil = 0;
  const restartRun = () => { manual = false; reset(); T.step = 0; if (timeline) enter(timeline[0][0]); panel.resetPhases(); graceUntil = performance.now() + 1500; };
  // the display rate the session actually runs at (Quest Browser: 90 Hz unless asked otherwise) sets the panel's budget
  let rateT = 0;
  const syncRate = () => { const s = renderer.xr.getSession?.(); const r = s?.frameRate; if (r && Math.abs(1000 / r - panel.budgetMs) > 0.05) panel.setBudget(r); };
  return {
    game, player, warm,
    environmentIntensity: 0.7,
    director: null,
    start() {},
    step(sdt, started) {
      const t0 = performance.now();
      // the heli runs on real time (slow-mo never drags the cabin), the world on sim time
      rail.update(sdt);
      const dt = game.update(sdt);
      if (started) { T.t += sdt; runTimeline(sdt); }
      player.update(sdt, started ? dt : 0);
      mids.update(dt, dust);
      hero?.update(dt);
      wall.update(dt, SUN_DIR);
      fx.update(dt, 0, ctx);
      fogU ||= fogged();
      for (const u of fogU) { u.fogNear.value = scene.fog.near; u.fogFar.value = scene.fog.far; }
      game.events.length = 0;
      simMs += performance.now() - t0;
    },
    frame(rdt, started, head) {
      const t0 = performance.now();
      const key = started ? (renderer.xr.isPresenting ? 'vr' : 'flat') : null;
      if (key && key !== runKey) { runKey = key; restartRun(); }
      if ((rateT -= rdt) <= 0) { rateT = 1; syncRate(); }
      updBlink(rdt);
      pollVR(); tryHz();
      dust.update(game.timeScale * rdt, head, camera);
      far.update(head, wall);
      if (hero && hero.S) game.focus.copy(hero.focus()); else game.focus.set(0, 250, 0);
      if (started) audio.setLoop('heli', { x: head.x, y: head.y + 2.5, z: head.z, volume: 0.55, intensity: 0.7 });
      if (wall.state) audio.setLoop('dust_roar', { x: head.x * 1.6, y: 40, z: head.z * 1.6, volume: 0.5 });
      simMs += performance.now() - t0;
      panel.frame(simMs, !runKey || B.t >= 0 || performance.now() < graceUntil ? null : manual ? T.phase + '*' : T.phase); simMs = 0;
      CL.now = clearance(); if (runKey && T.t > 1) CL.min = Math.min(CL.min, CL.now);
      const R = rail.st;
      camera.getWorldDirection(_fw);
      panel.draw({
        fx: `${fx.main.max - fx.main.free.length}/${fx.main.max}`, sparks: fx.sparks.max - fx.sparks.free.length, big: `${fx.main.bigAlive}/${fx.main.bigBudget}`,
        clouds: dust.alive, cloudMax: dust.clouds.max, dust: dust.level, fill: dust.fill, fillPeak: dust.fillPeak,
        glass: hero?.shards ?? 0, bodies: hero?.bodies ?? 0, mid: `${mids.falling()}/${mids.list.length}`,
        swapped: far.count, far: far.list.length, wall: wall.state ? `${wall.state.R.toFixed(0)}m ${wall.state.H.toFixed(0)}h` : 'off',
        speed: rail.speed, yawRate: R.yawRate, bank: rail.bank * 180 / Math.PI, lat: R.latA, lon: R.lonA, vert: R.vertA,
        maxYaw: R.maxYawRate, maxLat: R.maxLat, maxJerk: R.maxJerk,
        clr: `${CL.now > 1e8 ? '-' : CL.now.toFixed(0) + 'm'} (min ${CL.min > 1e8 ? '-' : CL.min.toFixed(0) + 'm'})`, route: F.route,
        phase: `${T.phase}${manual ? '*' : ''} ${T.t.toFixed(0)}s`, flags: `T${mids.list.length} H${hero ? 1 : 0} D${F.detail}`,
      });
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() {
      return { phase: T.phase, t: +T.t.toFixed(1), fps: +panel.fps.toFixed(1), calls: panel.calls, tris: panel.tris, clouds: dust.alive, fill: +dust.fill.toFixed(2), fx: fx.main.max - fx.main.free.length, glass: hero?.shards ?? 0, bodies: hero?.bodies ?? 0, swapped: far.count, wall: wall.state ? +wall.state.R.toFixed(0) : 0, heroPhase: hero?.S?.phase ?? null, mid: mids.falling(), speed: +rail.speed.toFixed(1), clear: CL.now > 1e8 ? null : +CL.now.toFixed(0), clearMin: CL.min > 1e8 ? null : +CL.min.toFixed(0), route: F.route, yawRate: +rail.st.yawRate.toFixed(2), maxYaw: +rail.st.maxYawRate.toFixed(2), maxLat: +rail.st.maxLat.toFixed(2), maxJerk: +rail.st.maxJerk.toFixed(2), tris0: { mid: mids.tris, hero: hero?.tris ?? 0 } };
    },
  };
}
