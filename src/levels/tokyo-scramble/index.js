import * as THREE from 'three';
import { TokyoWorld } from './world.js';
import { TokyoGame, SUN_AZ, sunElevation, applyTokyo } from './game.js';
import { SetPieces } from './setpieces.js';
import { Director } from './director.js';
import { Auto } from '../iron-lady/auto.js';
import { START } from './layout.js';
import { DAY } from './tod.js';
import { buildCrowd } from './crowd.js';
import { buildJam } from './jam.js';
import { patchSun } from './sunshadow.js';
import { createTokyoSky, createTokyoEnvironment } from './sky.js';
import { Player } from '../../player.js';
import { Locomotion } from '../../locomotion.js';
import { warmupGunmen, Gunman, setGunmanLook } from '../../characters.js';
import { initMaterials, MAT } from '../../vehicles.js';
import { setSunElevation } from '../../atmosphere.js';
import { buildScope } from '../downtown-haven/snipers.js';

// LEVEL 6 — "TOKYO SCRAMBLE": Kurogane on a hard-sun afternoon. Down the station stairs into the scramble
// crossing, through the East Exit bus plaza and up its decks onto the expressway, drop a span into the street, then the gas main chases you
// down Center-gai and out into the crossing.
export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  initMaterials();
  setSunElevation(sunElevation(0), SUN_AZ);
  E.sky.material = createTokyoSky();
  E.flare.visible = false;
  applyTokyo(0, { sun: E.sun, hemi: E.hemi, fog: scene.fog, renderer, scene });
  scene.fog.near = DAY.on ? 140 : 40; scene.fog.far = DAY.on ? 1700 : 900;
  // day: the soft afternoon sun casts (cars, people, props near you); night: the moon key is too weak
  E.sun.castShadow = DAY.on;
  camera.far = 4000; camera.updateProjectionMatrix();
  // dark kit against bright signs: a little lift + lit reflective bands so they never vanish in the black gaps
  setGunmanLook(DAY.on ? { lift: 0.06, band: 0.25 } : { lift: 0.32, band: 0.65 });
  fx.fireHue = 1; // orange core, deep-red edges, dark smoke (no white blow-outs against the neon)
  fx.heat = Math.min(fx.heat ?? 1, 0.86);
  // fire sprites: push toward orange and cool into near-black soot (same level-local patch as Level 5)
  { const m = fx.main, spawn = m.spawn.bind(m); m.spawn = (o) => { if (o.frameKind === 2 && (o.r ?? 1) < 0.8) { o.r = (o.r ?? 0.5) * 1.3; o.g = (o.g ?? 0.5) * 0.97; o.b = (o.b ?? 0.5) * 0.6; } if (o.frameKind === 1 && o.b > 0.8 && o.r > 1.6) { o.r *= 1.12; o.g *= 0.6; o.b *= 0.22; if ((o.life ?? 1) > 0.9 && o.r1 === undefined) { o.r1 = 0.11; o.g1 = 0.06; o.b1 = 0.045; } } return spawn(o); }; }
  const world = await new TokyoWorld(E).build();
  const game = new TokyoGame(E, world);
  { const c = game.clouds, spawn = c.spawn.bind(c); c.spawn = (o) => { if ((o.r ?? 0.5) < 0.3 && Math.abs((o.r ?? 0) - (o.b ?? 0)) < 0.05) { o.r *= 1.18; o.b *= 0.8; if (o.r1 !== undefined) { o.r1 *= 1.12; o.b1 *= 0.82; } } return spawn(o); }; }
  game.dusk = 0;
  // the last of the crowd running out of the scramble as the level opens (not on a beat jump past it)
  const jb = params.get('beat');
  if (!flags.SANDBOX && (!jb || jb === 'crossing')) { game.crowd = buildCrowd(scene); patchSun(game.crowd.mat); }
  game.jam = buildJam(scene, { patchSun });   // the gridlock past where you fight (instanced stand-ins)
  const setp = new SetPieces(game);
  game.setpieces = setp;
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = START.yaw; player.pitch = -0.04;
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  const loco = new Locomotion(rig, world.col, { walk: 3.1, sprint: 5.3 });
  player.enableLocomotion(loco);
  rig.position.set(START.x, START.y, START.z);
  if (params.has('px')) rig.position.set(+params.get('px'), +(params.get('py') || world.fastGround(+params.get('px'), +params.get('pz'))), +params.get('pz'));
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

  const fogged = () => { const out = []; scene.traverse(o => { const u = o.material?.uniforms; if (u?.fogNear && u?.fogFar && !out.includes(u)) out.push(u); }); return out; };
  let fogU = null, envDone = false;
  const ctx = { groundAt: (x, z) => world.fastGround(x, z), onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.3 }) };
  let director = null;
  return {
    game, player, warm, world, setp,
    environmentIntensity: DAY.on ? 1.0 : 0.75,
    get director() { return director; },
    start() { if (!flags.SANDBOX) director = new Director(game, hud, audio, setp, auto, flags.TRAILER || flags.CAPTURE); },
    step(sdt, started) {
      if (!envDone) { envDone = true; scene.environment = createTokyoEnvironment(renderer); }
      const dt = game.update(sdt);
      if (started) game.crowd?.update(dt, world.fastGround);
      if (auto && started) auto.update(dt);
      player.update(sdt, started ? dt : 0);
      setp.afterPlayer?.(sdt, dt);
      fx.update(dt, 0, ctx);
      fogU ||= fogged();
      for (const u of fogU) { u.fogNear.value = scene.fog.near; u.fogFar.value = scene.fog.far; }
      if (director) director.update(dt);
      else game.events.length = 0;
    },
    frame(rdt, started) {
      if (started) audio.setLoop('city', { volume: 0.45 });
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() { return { step: director?.cur?.name, done: director?.done, score: game.score, kills: game.kills, alive: game.enemiesAlive(), x: +rig.position.x.toFixed(2), y: +rig.position.y.toFixed(2), z: +rig.position.z.toFixed(2), hp: Math.round(game.hp), heat: +game.dusk.toFixed(2), span: setp.span?.phase ?? null, gas: setp.gas?.phase ?? null }; },
  };
}
