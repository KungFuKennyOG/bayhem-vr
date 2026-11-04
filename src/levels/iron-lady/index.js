import * as THREE from 'three';
import { IronWorld } from './world.js';
import { IronGame, SUN_AZ, sunElevation, applyNight } from './game.js';
import { SetPieces } from './setpieces.js';
import { Director } from './director.js';
import { Auto } from './auto.js';
import { START } from './layout.js';
import { createNightSkyMaterial, createNightEnvironment } from './sky.js';
import { Player } from '../../player.js';
import { Locomotion } from '../../locomotion.js';
import { warmupGunmen, Gunman, setGunmanLook } from '../../characters.js';
import { initMaterials, MAT } from '../../vehicles.js';
import { setSunElevation } from '../../atmosphere.js';
import { buildScope } from '../downtown-haven/snipers.js';

// LEVEL 5 — "THE IRON LADY": Paris after rain. Fight down the Seine quays, cross the bridge, bring down a
// gunship that threads the tower's legs — and watch the tower come down across the river.
export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  initMaterials();
  const night0 = params.has('dusk') ? +params.get('dusk') : 0.15;
  setSunElevation(sunElevation(night0), SUN_AZ);
  // a Paris night sky (lit cloud deck, afterglow behind the tower), no sun glare
  E.sky.material = createNightSkyMaterial();
  E.flare.visible = false;
  applyNight(night0, { sun: E.sun, hemi: E.hemi, fog: scene.fog, renderer, scene });
  scene.fog.near = 60; scene.fog.far = 1500;
  camera.far = 6000; camera.updateProjectionMatrix();
  // goons in dark kit against wet dark stone: lift them a little and light their reflective bands
  setGunmanLook({ lift: 0.22, band: 0.55 });
  fx.fireHue = 1; // orange core, deep-red edges, dark smoke shroud (no white blow-outs at night)
  fx.heat = Math.min(fx.heat ?? 1, 0.85);
  // fire sprites: push toward orange and cool into near-black soot (the grade's teal shadows put cyan / olive rims on
  // pale fire edges against the night sky) — level-local patch, fx.js untouched
  { const m = fx.main, spawn = m.spawn.bind(m); m.spawn = (o) => { if (o.frameKind === 1 && o.b > 0.8 && o.r > 1.6) { o.r *= 1.12; o.g *= 0.6; o.b *= 0.22; if ((o.life ?? 1) > 0.9 && o.r1 === undefined) { o.r1 = 0.09; o.g1 = 0.07; o.b1 = 0.06; } } return spawn(o); }; }
  const world = await new IronWorld(E).build();
  const game = new IronGame(E, world);
  // dark smoke puffs: keep them warm brown-black (the grade's teal split-tone turns neutral greys teal at night)
  { const c = game.clouds, spawn = c.spawn.bind(c); c.spawn = (o) => { if ((o.r ?? 0.5) < 0.3 && Math.abs((o.r ?? 0) - (o.b ?? 0)) < 0.05) { o.r *= 1.22; o.g *= 1.02; o.b *= 0.72; if (o.r1 !== undefined) { o.r1 *= 1.18; o.b1 *= 0.75; } } return spawn(o); }; }
  game.dusk = night0;
  const setp = new SetPieces(game);
  game.setpieces = setp;
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = START.yaw; player.pitch = 0.08;
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  const loco = new Locomotion(rig, world.col, { walk: 3.1, sprint: 5.3 });
  player.enableLocomotion(loco);
  rig.position.set(START.x, START.y, START.z);
  if (params.has('px')) rig.position.set(+params.get('px'), +(params.get('py') || 0), +params.get('pz'));
  const auto = flags.AUTO ? new Auto(game, player) : null;
  game.auto = auto; game.player = player; game.loco = loco;
  if (auto) player.autoState.idleW = 4.5;

  // warm-up set: every material we will need mid-fight
  const warm = new THREE.Group();
  warm.add(warmupGunmen());
  const gm = new Gunman({ pose: 'ground', seed: 3 }); buildScope(gm); warm.add(gm.root);
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const m of Object.values(MAT)) for (const mm of [].concat(m)) warm.add(new THREE.Mesh(box, mm));
  for (const c of game.traffic.cars.slice(0, 1)) if (c.m.burntMaterials) for (const mm of c.m.burntMaterials) warm.add(new THREE.Mesh(box, mm));
  for (const m of setp.warmMaterials()) warm.add(new THREE.Mesh(box, m));
  warm.add(new THREE.Mesh(game.clouds.geometry, game.clouds.material));
  const { buildHeli } = await import('../../heli.js');
  warm.add(buildHeli().root);
  if (world.mods.boatsM?.buildBoat) for (const k of ['bateau', 'speedboat']) { try { const b = world.mods.boatsM.buildBoat(k, { seed: 1 }); warm.add(b.root); b.setBurnt?.(); const c = b.root.clone(); warm.add(c); } catch (e) { /* stand-in */ } }

  // particle / glow batches copy the fog range at creation: keep them on this level's fog (dust mix included)
  const fogged = () => { const out = []; scene.traverse(o => { const u = o.material?.uniforms; if (u?.fogNear && u?.fogFar && !out.includes(u)) out.push(u); }); return out; };
  let fogU = null, envDone = false;
  const ctx = { groundAt: (x, z) => world.fastGround(x, z), onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.3 }) };
  let director = null;
  return {
    game, player, warm, world, setp,
    environmentIntensity: 0.6,
    get director() { return director; },
    start() { if (!flags.SANDBOX) director = new Director(game, hud, audio, setp, auto, flags.TRAILER || flags.CAPTURE); },
    step(sdt, started) {
      if (!envDone) { envDone = true; scene.environment = createNightEnvironment(renderer); } // main.js bakes the day sky env after create(): replace it
      const dt = game.update(sdt);
      if (auto && started && !setp.riding) auto.update(dt);
      player.update(sdt, started ? dt : 0);
      setp.afterPlayer(sdt, dt);
      fx.update(dt, 0, ctx);
      fogU ||= fogged();
      for (const u of fogU) { u.fogNear.value = scene.fog.near; u.fogFar.value = scene.fog.far; }
      if (director) director.update(dt);
      else game.events.length = 0;
    },
    frame(rdt, started) {
      if (started) { audio.setLoop('harbor', { volume: 0.5 }); audio.setLoop('city', { volume: 0.35 }); }
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() { return { step: director?.cur?.name, done: director?.done, score: game.score, kills: game.kills, alive: game.enemiesAlive(), x: +rig.position.x.toFixed(2), y: +rig.position.y.toFixed(2), z: +rig.position.z.toFixed(2), hp: Math.round(game.hp), night: +game.dusk.toFixed(2), boat: setp.boat?.state ?? null, heli: setp.heli ? Math.round(setp.heli.hp) : null, fall: setp.fall ? setp.fall.phase + ':' + setp.fall.th.toFixed(2) : null, ride: setp.escape?.state ?? null }; },
  };
}
