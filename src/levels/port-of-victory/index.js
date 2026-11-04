import * as THREE from 'three';
import { PortWorld } from './world.js';
import { PortGame } from './game.js';
import { SetPieces } from './setpieces.js';
import { Director } from './director.js';
import { Auto } from './auto.js';
import { Player } from '../../player.js';
import { Locomotion } from '../../locomotion.js';
import { warmupGunmen, Gunman } from '../../characters.js';
import { mushroomWarm } from './mushroom.js';
import { initMaterials, MAT } from '../../vehicles.js';
import { applyDusk, setSunElevation } from '../../atmosphere.js';

// LEVEL 2 — "PORT OF VICTORY": on foot through a container port at dusk, ends with the ship going up.
export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  initMaterials();
  // dusk/sun before the environment map is baked (main.js bakes it after create())
  setSunElevation(5.5 - 0.12 * 9.5, new THREE.Vector3(-0.42, 0, -1));
  applyDusk(0.12, { sun: E.sun, hemi: E.hemi, fog: scene.fog, renderer });
  scene.fog.near = 30; scene.fog.far = 640;
  // dusk + close quarters: orange cores fading to deep red, wrapped in dark oily smoke (no white blow-outs)
  fx.heat = 0.82; fx.fireHue = 1; fx.smokeMul = 1.3;
  // debris reads as lit, hot metal chunks (not black squares)
  fx.debrisMesh.material = new THREE.MeshStandardMaterial({ color: 0x4a423c, roughness: 0.55, metalness: 0.55, emissive: 0x5a1a04, emissiveIntensity: 0.55 });
  const world = await new PortWorld(E).build();
  const game = new PortGame(E, world);
  const setp = new SetPieces(game);
  game.setpieces = setp;
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = 0.0; player.pitch = -0.02;
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  const loco = new Locomotion(rig, world.col, { walk: 3.1, sprint: 5.2 });
  player.enableLocomotion(loco);
  rig.position.set(2.6, 0, 35.2);
  if (params.has('px')) rig.position.set(+params.get('px'), +(params.get('py') || 0), +params.get('pz'));
  if (params.has('dusk')) game.dusk = +params.get('dusk');
  const auto = flags.AUTO ? new Auto(game, player) : null;
  game.auto = auto;
  game.player = player;
  if (auto) player.autoState.idleW = 4.5;

  // warm-up set
  const warm = new THREE.Group();
  warm.add(warmupGunmen(), mushroomWarm());
  const g = new Gunman({ pose: 'ground', seed: 3 }); warm.add(g.root);
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const m of Object.values(MAT)) for (const mm of [].concat(m)) warm.add(new THREE.Mesh(box, mm));

  const ctx = { groundAt: (x, z) => world.fastGround(x, z), onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.3 }) };
  let director = null;
  const L = {
    game, player, warm, world, setp,
    environmentIntensity: 0.8,
    get director() { return director; },
    start() { if (!flags.SANDBOX) director = new Director(game, hud, audio, setp, auto, flags.TRAILER || flags.CAPTURE); },
    step(sdt, started) {
      const dt = game.update(sdt);
      if (auto && started) auto.update(dt);
      player.update(sdt, started ? dt : 0);
      fx.update(dt, 0, ctx);
      if (director) director.update(dt);
      else game.events.length = 0;
    },
    frame(rdt, started, head) {
      if (started) audio.setLoop('harbor', { volume: 0.8 });
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() { return { step: director?.cur?.name, done: director?.done, score: game.score, kills: game.kills, alive: game.enemiesAlive(), x: +rig.position.x.toFixed(2), y: +rig.position.y.toFixed(2), z: +rig.position.z.toFixed(2), hp: Math.round(game.hp), dusk: +game.dusk.toFixed(2) }; },
  };
  return L;
}
