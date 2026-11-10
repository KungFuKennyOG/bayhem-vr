import * as THREE from 'three';
import { readFlags, buildPlan, HERO } from './layout.js';
import { City, buildBeacons } from './city.js';
import { Ground } from './ground.js';
import { createSky, bakeEnv, applyLook, TOD } from './sky.js';
import { FAC } from './facade.js';
import { SandGame } from './game.js';
import { Cabin } from './cabin.js';
import { Rail } from './rail.js';
import { DoorGun } from './doorgun.js';
import { SetPieces } from './setpieces.js';
import { Director } from './director.js';
import { PerfPanel } from '../dubai-proto/debug.js';
import { Player } from '../../player.js';
import { warmupGunmen, Gunman, setGunmanLook } from '../../characters.js';
import { buildHeli } from '../../heli.js';
import { damp } from '../../rng.js';
import { CELL } from '../../particles.js';

// =====================================================================================
//  LEVEL 8 — "SAND CASTLES": door gunner on HAMMER ONE over Al-Sarab, a fictional Gulf
//  megacity. Marina rooftops -> the boulevard canyon (the wingman goes down) -> a haboob rolls
//  over the city with WIDOWMAKER 4 inside it -> the storm breaks, the laser designator brings
//  the flak towers down one at a time -> sunset, paint the SARAB SPIRE, the money shot, the
//  dive -> out over the dust sea to the Gulf. Runs at 72 Hz (asked of the XR session).
//  Flags + modules: DESIGN.md. The grey-box test bench stays at ?level=dubai-proto.
// =====================================================================================
export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  const F = readFlags(params, E.isQuest);
  const plan = buildPlan(F);
  E.sky.material = createSky();
  camera.far = 14000; camera.updateProjectionMatrix();
  // no realtime sun shadows: their frustum follows the rig (~140 m) and from up here it would only
  // shadow the cabin wrongly; the cabin lets the sun in through the door analytically, the city
  // shadows itself with the 2.5D height-map march
  renderer.shadowMap.enabled = false;
  fx.fireHue = 1; fx.heat = 0.9;
  // the explosions' own dark smoke balls read as black spots inside the tan dust plumes at 400 m: the soot plumes do that job here
  fx.smokeMul = 0.35;
  fx.groundAt = () => 0;
  setGunmanLook({ lift: 0.22, band: 0.8 });
  // fire sprites: orange cores, near-black soot (the Level 5/6 level-local clamp)
  { const m = fx.main, spawn = m.spawn.bind(m); m.spawn = (o) => { if (o.frameKind === 2 && (o.r ?? 1) < 0.8) { o.r = (o.r ?? 0.5) * 1.3; o.g = (o.g ?? 0.5) * 0.97; o.b = (o.b ?? 0.5) * 0.6; } if (o.frameKind === 1 && o.b > 0.8 && o.r > 1.6) { o.r *= 1.12; o.g *= 0.6; o.b *= 0.22; }
    // no white blow-outs: any near-white hot sprite (flash, glow) is pushed to a yellow-orange core
    else if (o.frameKind !== 2 && (o.r ?? 0) > 1.2 && (o.g ?? 0) > 0.9 && (o.b ?? 0) > 0.6) { o.r = Math.min(o.r, 2.2); o.g = o.r * 0.6; o.b = o.r * 0.2; }
    if (o.frame === CELL.FLASH || o.frame === CELL.STAR) { o.r *= 0.6; o.g *= 0.5; o.b *= 0.4; } // stacked additive flashes went white
    return spawn(o); }; }
  // the door gun's muzzle flash is a metre from your eye: hot orange, not a white disc
  { const n = fx.near, sp = n.spawn.bind(n); n.spawn = (o) => { if (o.frame === CELL.STAR || o.frame === CELL.STAR2 || o.frame === CELL.GLOW) { o.r *= 0.85; o.g *= 0.6; o.b *= 0.3; o.s0 *= 1.3; o.s1 *= 1.3; } return sp(o); }; }
  const look = { sunset: 0, storm: 0 };
  applyLook(E, 0, 0, 12);
  const city = new City(scene, plan, F);
  const ground = new Ground(scene, F);
  buildBeacons(scene, city.statics);
  FAC.uShadow.value = F.shadows ? 1 : 0;
  const cabin = new Cabin(scene);
  const W = { plan, city, cabin, F };
  const rail = new Rail(E, F, cabin); W.rail = rail;
  const game = new SandGame(E, F, W);
  game.aimRange = 420; game.autoRange = 420;
  game.sunset = 0; game.sunsetTarget = 0;
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = 0; player.pitch = -0.2;
  game.player = player;
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  if (flags.AUTO) player.autoState.idleW = 2.6;
  const gun = new DoorGun(game, player, cabin.seat, camera);
  const setp = new SetPieces(game, W, F, player);
  W.setp = setp;
  for (const id of ['T1', 'T2', 'T3', 'T4']) game.addAA(setp.tower(id));
  // perf panel (&perf=1): the prototype's panel, on the bulkhead / wrist / floating
  const panel = F.perf ? new PerfPanel(E, F, F.hz || 72) : null;
  if (panel) { panel.hint = ['&perf=1  Y = panel position', `alt ${F.alt} speed ${F.speed} clear ${F.clear} hz ${F.hz}`]; panel.hintKeys = 'keys: 5 panel'; panel.mount(F.panel === 'wrist' ? 'cabin' : F.panel, rig, null); window.__perf = () => panel.summary(); }
  // VR: the display rate request (once per session)
  let hzSession = null;
  const tryHz = () => {
    if (!F.hz) return;
    const s = renderer.xr.getSession?.(); if (!s?.updateTargetFrameRate || s === hzSession) return;
    hzSession = s;
    const rates = s.supportedFrameRates ? [...s.supportedFrameRates] : [];
    if (!rates.length || rates.includes(F.hz)) s.updateTargetFrameRate(F.hz).then(() => panel?.setBudget(F.hz)).catch(() => {});
  };
  // warm-up: every program before the first frame
  const warm = new THREE.Group();
  warm.add(warmupGunmen());
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const m of [...cabin.warmMaterials(), ...gun.warmMaterials()]) warm.add(new THREE.Mesh(box, m));
  warm.add(new THREE.Mesh(setp.dust.clouds.geometry, setp.dust.clouds.material));
  if (setp.hero.glass) warm.add(new THREE.Mesh(setp.hero.glass.shardMesh.geometry, setp.hero.glass.shardMesh.material));
  warm.add(buildHeli().root);
  warm.add(game.threats.warmObjects()[3]); // the Vipers' charcoal paint (the instanced drones / depots / tankers live in the scene already)
  for (const o of [setp.wall.mesh, setp.haboob.mesh, setp.streaks.mesh, setp.strikes.beam, setp.strikes.dot]) { const c = o.clone(); c.visible = true; warm.add(c); }
  // env maps: day / storm / sunset (baked on the first step, swapped while the screen is busy)
  const envs = {};
  let envKey = null;
  const fogged = () => { const out = []; scene.traverse(o => { const u = o.material?.uniforms; if (u?.fogNear && u?.fogFar && !out.includes(u)) out.push(u); }); return out; };
  let fogU = null, simMs = 0, director = null;
  const ctx = { groundAt: () => 0 };
  // clearance for the panel: the closest tower face at the heli's height
  const clearance = () => { const h = rail.pos; let m = 1e9; for (const t of plan.towers) { if (t.gone || h.y > t.h + 25) continue; m = Math.min(m, Math.hypot(h.x - t.x, h.z - t.z) - Math.hypot(t.w, t.d) * 0.5); } if (!setp.heroDown && h.y < HERO.h + HERO.spire) m = Math.min(m, Math.hypot(h.x - HERO.x, h.z - HERO.z) - HERO.w0 * 0.71); return m; };
  const CL = { now: 0, min: 1e9 };
  const keys = (e) => { if (e.code === 'Digit5' && panel) { const P = ['cabin', 'float', 'off']; const m = P[(P.indexOf(panel.mode) + 1) % P.length]; panel.mount(m, rig, null); } };
  addEventListener('keydown', keys);
  const _f = new THREE.Vector3(), _ex = new THREE.Vector3(), _rp = new THREE.Vector3();
  return {
    game, player, warm, setp, rail,
    environmentIntensity: 0.7,
    get director() { return director; },
    start() { if (!flags.SANDBOX) director = new Director(game, hud, audio, setp, W, { trailer: flags.TRAILER || flags.CAPTURE, auto: flags.AUTO }); },
    step(sdt, started) {
      const t0 = performance.now();
      if (!envs.day) { envs.day = bakeEnv(renderer, 0, 0); envs.storm = bakeEnv(renderer, 1, 0.2); envs.haze = bakeEnv(renderer, 0.5, 0.1); envs.sunset = bakeEnv(renderer, 0, 1); }
      // the heli flies on real time: slow-mo never drags the cabin
      _rp.copy(rig.position);
      if (started) rail.update(sdt); else rail.place(0);
      // the heli carries its own effects: muzzle flashes (the 'near' batch) ride along with the cabin instead of
      // being left 1–2 m behind every frame at 34 m/s (they read as coming from the tail, not your hands)
      _rp.subVectors(rig.position, _rp);
      if (_rp.lengthSq() > 0 && _rp.lengthSq() < 400) for (const q of fx.near.p) if (q.alive) { q.x += _rp.x; q.y += _rp.y; q.z += _rp.z; }
      game.rigVel = rail.vel;
      const dt = game.update(sdt);
      FAC.uTime.value += dt;
      cabin.update(sdt, game.time);
      // time of day: the director's sunset target, the storm from the set pieces
      game.sunset = damp(game.sunset, game.sunsetTarget, 0.25, sdt);
      look.sunset = game.sunset; look.storm = setp.storm;
      applyLook(E, look.sunset, look.storm, 12 - 8.5 * look.sunset);
      // a half-storm reflection between day and storm: the glass greys over in two small steps, not one big flip
      const k = look.storm > 0.7 ? 'storm' : look.storm > 0.25 ? 'haze' : look.sunset > 0.55 ? 'sunset' : 'day';
      if (k !== envKey && envs[k]) { envKey = k; scene.environment = envs[k]; }
      gun.aim(sdt);
      // the autopilot paints with the designator once it is on target
      if (flags.AUTO && setp.strikes.on && game.paintTarget) { const A = player.autoState; setp.strikes.autoHeld = !!A.target && A.target.kind === 'paint' && Math.hypot(A.err.x, A.err.y) < 0.05; } else setp.strikes.autoHeld = false;
      player.update(sdt, started ? dt : 0);
      gun.update(sdt, dt);
      // desktop: the launcher viewmodel sits lower and further out (it hid the middle of the view)
      if (player.mode === 'desktop') { player.launcher.holder.position.add(_ex.set(-0.07, -0.06, 0.02)); player.rifle.holder.position.add(_ex.set(0.15, -0.13, 0.13)); player.rifle.holder.rotateY(0.12); } // the minigun low at the hip, canted in a touch so its side reads
      setp.update(dt, sdt, game.headPos);
      // limping home: number two engine trails smoke past the door
      if (director && (director.cur?.name === 'escape' || director.cur?.name === 'outro')) { cabin.root.localToWorld(_ex.set(0.85, 2.7, 2.4)); fx.trailEmit(cabin, _ex, 0.7, (q) => fx.smoke(q, 2.2, 0.17, 3.5, 0.6, 0.5), 0); }
      ground.update(dt);
      fx.update(dt, 0, ctx);
      fogU ||= fogged();
      for (const u of fogU) { u.fogNear.value = scene.fog.near; u.fogFar.value = scene.fog.far; }
      if (director) director.update(dt, sdt); else game.events.length = 0;
      simMs += performance.now() - t0;
    },
    frame(rdt, started, head) {
      const t0 = performance.now();
      tryHz();
      city.far.update(head, setp.wall);
      // inside the haboob the far ring would poke out of the murk as flat cut-outs: the storm hides it
      city.far.intact.visible = city.far.ruined.visible = look.storm < 0.35;
      // the ruin swap for the whole city: static towers past the dust ring go to stumps once hidden
      if (F.swap && setp.wall.state) { swapStatics(city, setp.wall, head); }
      if (started) audio.setLoop('heli', { x: head.x, y: head.y + 2.4, z: head.z, volume: 0.5, intensity: 0.75 });
      if (started && setp.storm > 0.05) audio.setLoop('dust_roar', { x: head.x, y: head.y, z: head.z + 30, volume: 0.6 * setp.storm }); else audio.stopLoop('dust_roar');
      simMs += performance.now() - t0;
      if (panel) {
        if (renderer.xr.getSession?.()?.frameRate) { const r = renderer.xr.getSession().frameRate; if (Math.abs(1000 / r - panel.budgetMs) > 0.05) panel.setBudget(r); }
        panel.frame(simMs, started ? (director?.cur?.name || 'idle') : null);
        CL.now = clearance(); if (started) CL.min = Math.min(CL.min, CL.now);
        const R = rail.st;
        panel.draw({
          fx: `${fx.main.max - fx.main.free.length}/${fx.main.max}`, sparks: fx.sparks.max - fx.sparks.free.length, big: `${fx.main.bigAlive}/${fx.main.bigBudget}`,
          clouds: setp.dust.alive, cloudMax: setp.dust.clouds.max, dust: setp.dust.level, fill: setp.dust.fill, fillPeak: setp.dust.fillPeak,
          glass: setp.hero.shards, bodies: setp.hero.bodies, mid: `${setp.mids.falling()}/${setp.mids.list.length}`,
          swapped: city.far.count + city.ruined, far: city.far.list.length + city.statics.length, wall: setp.wall.state ? `${setp.wall.state.R.toFixed(0)}m` : 'off',
          speed: rail.speed, yawRate: R.yawRate, bank: rail.bank * 180 / Math.PI, lat: R.latA, lon: R.lonA, vert: R.vertA,
          maxYaw: R.maxYawRate, maxLat: R.maxLat, maxJerk: R.maxJerk,
          clr: `${CL.now > 1e8 ? '-' : CL.now.toFixed(0) + 'm'} (min ${CL.min > 1e8 ? '-' : CL.min.toFixed(0) + 'm'})`, route: `alt ${F.alt}`,
          phase: `${director?.cur?.name || '-'} ${(director?.t || 0).toFixed(0)}s`, flags: `men ${game.enemiesAlive()} hp ${Math.round(game.hp)}`,
        });
      }
      simMs = 0;
    },
    ammoText() { return `${gun.ammoText()}   ${setp.strikes.on ? (setp.strikes.lockFrac > 0 ? `LOCK ${Math.round(setp.strikes.lockFrac * 100)}%` : 'LASER') : (player.launcher.reloading > 0 ? '--' : player.launcher.ammo + ' GL')}`; },
    state() {
      return { step: director?.cur?.name, done: director?.done, t: +(director?.total || 0).toFixed(1), s: Math.round(rail.s), L: Math.round(rail.L), v: +rail.speed.toFixed(1), y: Math.round(rail.pos.y), hp: Math.round(game.hp), score: game.score, kills: game.kills, alive: game.enemiesAlive(), air: game.threats.active, down: { ...game.threats.down }, storm: +setp.storm.toFixed(2), sunset: +game.sunset.toFixed(2), falling: setp.mids.falling(), hero: setp.hero.S?.phase ?? null, gunship: game.gunship?.phase ?? null, wing: game.wing?.phase ?? null, clouds: setp.dust.alive, ruined: city.ruined, far: city.far.count, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, maxYaw: +rail.st.maxYawRate.toFixed(1), maxLat: +rail.st.maxLat.toFixed(2), maxJerk: +rail.st.maxJerk.toFixed(2), clear: Math.round(clearance()) };
    },
  };
}

// time-sliced: a few static towers per frame; a tower outside the ring swaps to its stump once every
// sample point on it is behind the opaque body of the dust wall from your eye
const _P = new THREE.Vector3();
function swapStatics(city, wall, eye) {
  const list = city.statics, n = Math.min(list.length, 24);
  city._cur = city._cur || 0; city.ruined = city.ruined || 0;
  for (let k = 0; k < n; k++) {
    const t = list[city._cur++ % list.length];
    if (t.ruinedNow || t.role === 'fight') continue;
    const R = Math.hypot(t.x - wall.cx, t.z - wall.cz);
    if (!wall.state || R < wall.state.R + 30) continue;
    let ok = true;
    for (const [dx, y] of [[0, 3], [0, t.h * 0.5], [0, t.h], [t.w * 0.5, t.h * 0.5], [-t.w * 0.5, t.h * 0.5], [0, t.h + 30]]) {
      _P.set(t.x + dx, y, t.z);
      if (!wall.hides(eye, _P)) { ok = false; break; }
    }
    if (ok) { t.ruinedNow = true; t.gone = true; city.ruin(t, t.h * (0.15 + ((t.idx * 0.37) % 0.3))); city.ruined++; }
  }
}
