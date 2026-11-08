import * as THREE from 'three';
import { WhiteWorld } from './world.js';
import { WhiteGame, SUN_AZ, sunElevation, applyWeather } from './game.js';
import { SetPieces } from './setpieces.js';
import { Director } from './director.js';
import { Auto } from './auto.js';
import { START } from './layout.js';
import { createSkyMaterial, createEnvironment, skyShared } from './sky.js';
import { Player } from '../../player.js';
import { Locomotion } from '../../locomotion.js';
import { warmupGunmen, Gunman, setGunmanLook, prebuildOutfit } from '../../characters.js';
import { initMaterials, MAT } from '../../vehicles.js';
import { setSunElevation } from '../../atmosphere.js';
import { buildScope } from '../downtown-haven/snipers.js';

// LEVEL 7 — "WHITEOUT": a blizzard on the Grauhorn. Up the switchbacks, across the gorge in the cable car,
// through the fortified observatory on the summit — then the storm breaks, and the mountain comes down.
export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  initMaterials();
  const storm0 = params.has('storm') ? +params.get('storm') : 1;
  setSunElevation(sunElevation(storm0), SUN_AZ);
  E.sky.material = createSkyMaterial();
  E.flare.visible = false;
  applyWeather(storm0, { sun: E.sun, hemi: E.hemi, fog: scene.fog, renderer, scene });
  camera.far = 12000; camera.updateProjectionMatrix();
  // dark cold-weather kit: lift it a touch so it never crushes to black against the rock, keep the snow white
  setGunmanLook({ lift: 0.16, band: 0 });
  prebuildOutfit('alpine');
  fx.fireHue = 1;                 // orange core, deep-red edges (no white-hot blow-outs against the snow)
  fx.heat = Math.min(fx.heat ?? 1, 0.9);
  const world = await new WhiteWorld(E).build();
  const game = new WhiteGame(E, world);
  game.storm = storm0;
  const setp = new SetPieces(game);
  game.setpieces = setp;
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = START.yaw; player.pitch = 0.05;
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  // locomotion sees the walk mask: off the road / off the summit there is no ground (= a ledge)
  const col = world.col;
  const walkWorld = {
    pushCircle: (...a) => col.pushCircle(...a),
    groundAt: (x, z, y, s) => (world.walkable(x, z) || setp.extraWalk?.(x, z)) ? col.groundAt(x, z, y, s) : -1e9,
  };
  const loco = new Locomotion(rig, walkWorld, { walk: 3.1, sprint: 5.3 });
  player.enableLocomotion(loco);
  rig.position.set(START.x, world.fastGround(START.x, START.z), START.z);
  if (params.has('px')) { const x = +params.get('px'), z = +params.get('pz'); rig.position.set(x, params.has('py') ? +params.get('py') : world.fastGround(x, z), z); }
  const auto = flags.AUTO ? new Auto(game, player) : null;
  game.auto = auto; game.player = player; game.loco = loco;
  if (auto) player.autoState.idleW = 4.5;

  // warm-up set: every material we will need mid-fight
  const warm = new THREE.Group();
  warm.add(warmupGunmen());
  const gm = new Gunman({ pose: 'ground', seed: 3, outfit: 'alpine' }); buildScope(gm); warm.add(gm.root);
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const m of Object.values(MAT)) for (const mm of [].concat(m)) warm.add(new THREE.Mesh(box, mm));
  for (const c of game.traffic.cars.slice(0, 1)) if (c.m.burntMaterials) for (const mm of c.m.burntMaterials) warm.add(new THREE.Mesh(box, mm));
  for (const m of setp.warmMaterials()) warm.add(new THREE.Mesh(box, m));
  warm.add(new THREE.Mesh(game.clouds.geometry, game.clouds.material));

  let fogU = null, envT = 0, envClear = -1;
  const ctx = { groundAt: (x, z) => world.fastGround(x, z), onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.3 }) };
  let director = null;
  const fogged = () => { const out = []; scene.traverse(o => { const u = o.material?.uniforms; if (u?.fogNear && u?.fogFar && !out.includes(u)) out.push(u); }); return out; };
  return {
    game, player, warm, world, setp,
    environmentIntensity: 0.6,
    get director() { return director; },
    start() { if (!flags.SANDBOX) director = new Director(game, hud, audio, setp, auto, flags.TRAILER || flags.CAPTURE); },
    step(sdt, started) {
      // main.js bakes the default sunset env after create(): replace it, and re-bake as the storm clears
      envT -= sdt;
      if (envClear < 0 || (envT <= 0 && Math.abs(skyShared.clear.value - envClear) > 0.12)) { envClear = skyShared.clear.value; envT = 1.5; scene.environment = createEnvironment(renderer); }
      const dt = game.update(sdt);
      if (auto && started && !setp.riding) auto.update(dt);
      player.update(sdt, started ? dt : 0);
      setp.afterPlayer(sdt, dt);
      fx.update(dt, 0, ctx);
      if (!fogU || (game.time % 3) < dt) fogU = fogged();
      for (const u of fogU) { u.fogNear.value = scene.fog.near; u.fogFar.value = scene.fog.far; }
      if (director) director.update(dt);
      else game.events.length = 0;
    },
    frame(rdt, started) {
      if (started) audio.setLoop('wind', { volume: 0.25 + 0.65 * game.storm * (0.6 + 0.4 * game.weather.gust), intensity: 0.4 + 0.6 * game.weather.gust * game.storm });
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() { return { step: director?.cur?.name, done: director?.done, score: game.score, kills: game.kills, alive: game.enemiesAlive(), x: +rig.position.x.toFixed(2), y: +rig.position.y.toFixed(2), z: +rig.position.z.toFixed(2), hp: Math.round(game.hp), storm: +game.storm.toFixed(2), ride: setp.ride?.state ?? null, aval: setp.aval?.phase ?? null }; },
  };
}
