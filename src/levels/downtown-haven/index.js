import * as THREE from 'three';
import { DowntownWorld } from './world.js';
import { DowntownGame, SUN_AZ } from './game.js';
import { SetPieces } from './setpieces.js';
import { Director } from './director.js';
import { Auto } from './auto.js';
import { GlassSystem } from './glass.js';
import { Player } from '../../player.js';
import { Locomotion } from '../../locomotion.js';
import { warmupGunmen, Gunman } from '../../characters.js';
import { initMaterials, MAT } from '../../vehicles.js';
import { applyDusk, setSunElevation } from '../../atmosphere.js';
import { buildScope } from './snipers.js';

// LEVEL 3 — "DOWNTOWN HAVEN CITY": on foot down a glass canyon at golden hour; snipers, explosive
// traffic, a gunship, a lobby made of glass, and a skyscraper falling down the avenue behind you.
export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  initMaterials();
  // sun straight down the avenue, just right of Meridian; golden hour (main.js bakes the env map after create())
  setSunElevation(7 - 0.06 * 11, SUN_AZ);
  applyDusk(0.06, { sun: E.sun, hemi: E.hemi, fog: scene.fog, renderer });
  scene.fog.near = 40; scene.fog.far = 760;
  const world = await new DowntownWorld(E).build();
  const game = new DowntownGame(E, world);
  const setp = new SetPieces(game);
  game.setpieces = setp;
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = 0.0; player.pitch = 0.03;
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  const loco = new Locomotion(rig, world.col, { walk: 3.1, sprint: 5.3 });
  player.enableLocomotion(loco);
  rig.position.set(2.0, 0, 37);
  if (params.has('px')) rig.position.set(+params.get('px'), +(params.get('py') || 0), +params.get('pz'));
  if (params.has('dusk')) game.dusk = +params.get('dusk');
  const auto = flags.AUTO ? new Auto(game, player) : null;
  game.auto = auto;
  game.player = player;
  if (auto) player.autoState.idleW = 4.5;

  // warm-up set: every material we will need mid-fight (burnt cars, shards, scope, gunship...)
  const warm = new THREE.Group();
  warm.add(warmupGunmen());
  const gm = new Gunman({ pose: 'ground', seed: 3 }); buildScope(gm); warm.add(gm.root);
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const m of Object.values(MAT)) for (const mm of [].concat(m)) warm.add(new THREE.Mesh(box, mm));
  warm.add(new THREE.Mesh(box, game.glass.shardMesh.material));
  for (const c of game.traffic.cars.slice(0, 1)) if (c.m.burntMaterials) for (const mm of c.m.burntMaterials) warm.add(new THREE.Mesh(box, mm));
  warm.add(new THREE.Mesh(game.clouds.geometry, game.clouds.material));
  warm.add(new THREE.Mesh(box, game.dustDome.material));
  const { buildHeli } = await import('../../heli.js');
  const hw = buildHeli(); warm.add(hw.root);

  const ctx = { groundAt: (x, z) => world.fastGround(x, z), onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.3 }) };
  let director = null;
  const L = {
    game, player, warm, world, setp,
    environmentIntensity: 0.85,
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
      if (started) audio.setLoop('city', { volume: 0.8 });
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() { return { step: director?.cur?.name, done: director?.done, score: game.score, kills: game.kills, alive: game.enemiesAlive(), x: +rig.position.x.toFixed(2), y: +rig.position.y.toFixed(2), z: +rig.position.z.toFixed(2), hp: Math.round(game.hp), dusk: +game.dusk.toFixed(2), cars: game.carsBlown, panes: game.panesBroken, heli: setp.heli ? Math.round(setp.heli.hp) : null }; },
  };
  void GlassSystem;
  return L;
}
