import * as THREE from 'three';
import { World } from './world.js';
import { Game } from './game.js';
import { Director } from './director.js';
import { initMaterials, MAT, buildSUV, buildSedan, buildTanker } from '../../vehicles.js';
import { buildHeli } from '../../heli.js';
import { warmupGunmen } from '../../characters.js';
import { Player } from '../../player.js';

// LEVEL 1 — "THE 405 JOB": a freeway chase from the bed of a pickup (treadmill world, truck at the origin).
export async function create(E) {
  const { scene, renderer, atlas, fx, hud, audio, rig, camera, params, quality, flags } = E;
  initMaterials();
  const world = new World(scene, renderer, atlas, scene.fog, quality);
  const game = new Game({ scene, fx, world, hud, audio, rig, camera, params, mode: flags.AUTO ? 'auto' : 'play' });
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO });
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  window.__veh = { buildSUV, buildSedan, buildTanker, MAT };

  // warm-up set: every material/program the level will need before the first explosion (no hitch on Quest)
  const warm = new THREE.Group();
  for (const v of [buildSUV(), buildSedan(MAT.civ[0]), buildSedan(MAT.civ[1]), buildSedan(MAT.civ[2]), buildTanker()]) warm.add(v.root);
  warm.add(buildHeli().root, warmupGunmen());
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const m of Object.values(MAT)) for (const mm of [].concat(m)) warm.add(new THREE.Mesh(box, mm));

  const ctx = { bedFloor: 0.91, bedX: 0, bedHalfW: 0.78, bedZ0: 0.25, bedZ1: 2.6, onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.35 }) };
  let director = null;
  return {
    game, player, warm,
    get director() { return director; },
    start() { if (!flags.SANDBOX) director = new Director(game, hud, audio, flags.TRAILER || flags.CAPTURE); },
    step(sdt, started) {
      const dt = game.update(sdt);
      player.update(sdt, started ? dt : 0);
      ctx.bedX = game.truckX;
      fx.update(dt, game.dz, ctx);
      if (director) director.update(dt);
    },
    frame(rdt, started) {
      if (started) { audio.setLoop('wind', { volume: 0.8, intensity: 1 }); audio.setLoop('truck', { volume: 0.7, intensity: 0.6 }); }
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() { return { step: director?.cur?.name, done: director?.done, score: game.score, cars: game.cars.length }; },
  };
}
