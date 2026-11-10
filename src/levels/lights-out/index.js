import * as THREE from 'three';
import { LightsWorld } from './world.js';
import { LightsGame, SUN_AZ, sunElevation, applyLook } from './game.js';
import { SetPieces } from './setpieces.js';
import { Director } from './director.js';
import { Auto } from '../whiteout/auto.js';
import { START, ROOFTOP, Y, walkable, roofWalk } from './layout.js';
import { createSky, createEnvironment, SKY } from './sky.js';
import { POWER } from './kit.js';
import { Player } from '../../player.js';
import { Locomotion } from '../../locomotion.js';
import { warmupGunmen, Gunman, setGunmanLook } from '../../characters.js';
import { initMaterials, MAT } from '../../vehicles.js';
import { setSunElevation } from '../../atmosphere.js';
import { buildScope } from '../downtown-haven/snipers.js';

// LEVEL 9 — "LIGHTS OUT" (the rebuild): Longwu, a city stacked up the cliffs of a river gorge, from dusk
// into night. One wide, level road along the south cliff, a bridge, the gold tower at its far end — and
// the city's power going out behind you, district by district, until the tower is the last light, and
// then it goes too.
export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  initMaterials();
  const n0 = params.has('night') ? +params.get('night') : 0.22;
  setSunElevation(sunElevation(n0), SUN_AZ);
  E.sky.material = createSky();
  E.flare.visible = false;
  applyLook(n0, 1, 0, { sun: E.sun, hemi: E.hemi, fog: scene.fog, renderer, scene });
  scene.fog.near = 40; scene.fog.far = 1080;   // the fog city: the far skylines and the ridges fade to silhouettes
  E.sun.castShadow = params.get('shadows') === '1';   // off: at dusk-to-night the sun shadow bought nothing and cost a second geometry pass (?shadows=1 to compare)
  camera.far = 5000; camera.updateProjectionMatrix();
  // dark kit in a dark city: a lift and lit reflective bands so they read against the fog and the lights
  setGunmanLook({ lift: 0.26, band: 0.6 });
  fx.fireHue = 1.4;               // orange-red core, deep-red edges, dark smoke (at 1 the cores went yellow, and yellow under smoke reads olive)
  fx.heat = Math.min(fx.heat ?? 1, 0.76);   // stacked tanker booms blew out to white at 0.88
  fx.smokeTint = [1.0, 0.86, 0.9];          // charcoal-red smoke: the yellow-brown went olive under the grade at night
  // fire sprites: push toward orange and cool into near-black soot (as Levels 5 / 6)
  { const m = fx.main, spawn = m.spawn.bind(m); m.spawn = (o) => { if (o.frameKind === 2 && (o.r ?? 1) < 0.8) { o.r = (o.r ?? 0.5) * 1.3; o.g = (o.g ?? 0.5) * 0.97; o.b = (o.b ?? 0.5) * 0.6; } if (o.frameKind === 1 && o.b > 0.8 && o.r > 1.6) { o.r *= 1.12; o.g *= 0.6; o.b *= 0.22; if ((o.life ?? 1) > 0.9 && o.r1 === undefined) { o.r1 = 0.11; o.g1 = 0.06; o.b1 = 0.045; } } return spawn(o); }; }
  const world = await new LightsWorld(E).build();
  const game = new LightsGame(E, world);
  game.night = n0;
  const setp = new SetPieces(game);
  game.setpieces = setp;
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = START.yaw; player.pitch = -0.04;   // (main.js applies ?yaw=<degrees>&pitch= after this)
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  // the locomotion's ground: the route is one level (y 64) inside the walk mask; the lift platform while you are on
  // it; the roof. Off the mask there is no ground (= a ledge: you can't walk off it)
  const col = world.col;
  const walkWorld = {
    pushCircle: (...a) => col.pushCircle(...a),
    groundAt: (x, z, y) => {
      const lf = setp.liftFloor(x, z, y); if (lf !== undefined) return lf;
      if (y > 150) return roofWalk(x, z) ? ROOFTOP.y : -1e9;
      return walkable(x, z) ? Y : -1e9;
    },
  };
  const loco = new Locomotion(rig, walkWorld, { walk: 3.1, sprint: 5.3 });
  player.enableLocomotion(loco);
  rig.position.set(START.x, START.y, START.z);
  if (params.has('px')) { const x = +params.get('px'), z = +params.get('pz'); rig.position.set(x, params.has('py') ? +params.get('py') : world.fastGround(x, z), z); }
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

  let fogU = null, envT = 0, envKey = -1;
  const ctx = { groundAt: (x, z) => world.fastGround(x, z), onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.3 }) };
  let director = null;
  const fogged = () => { const out = []; scene.traverse(o => { const u = o.material?.uniforms; if (u?.fogNear && u?.fogFar && !out.includes(u)) out.push(u); }); return out; };
  return {
    game, player, warm, world, setp,
    environmentIntensity: 0.7,
    get director() { return director; },
    start() { if (!flags.SANDBOX) director = new Director(game, hud, audio, setp, auto, flags.TRAILER || flags.CAPTURE); },
    step(sdt, started) {
      // main.js bakes the default sunset env after create(): replace it, and re-bake as the night / power change
      envT -= sdt;
      const key = Math.round(SKY.night.value * 8) * 100 + Math.round(SKY.glow.value * 4) * 10 + Math.round(SKY.fire.value * 4);
      if (envKey < 0 || (envT <= 0 && key !== envKey)) { envKey = key; envT = 2; scene.environment = createEnvironment(renderer); }
      const dt = game.update(sdt);
      if (auto && started && !setp.riding && setp.lift.state !== 'up') auto.update(dt);
      player.update(sdt, started ? dt : 0);
      setp.afterPlayer(sdt, dt);
      fx.update(dt, 0, ctx);
      if (!fogU || (game.time % 3) < dt) fogU = fogged();
      for (const u of fogU) { u.fogNear.value = scene.fog.near; u.fogFar.value = scene.fog.far; }
      if (director) director.update(dt);
      else game.events.length = 0;
    },
    frame(rdt, started) {
      if (started) { audio.setLoop('city', { volume: 0.35 * (0.3 + 0.7 * game.glow) }); audio.setLoop('wind', { volume: setp.riding ? 0.7 : 0.18, intensity: setp.riding ? 0.8 : 0.3 }); }
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() { return { step: director?.cur?.name, done: director?.done, score: game.score, kills: game.kills, alive: game.enemiesAlive(), x: +rig.position.x.toFixed(2), y: +rig.position.y.toFixed(2), z: +rig.position.z.toFixed(2), hp: Math.round(game.hp), night: +game.night.toFixed(2), glow: +game.glow.toFixed(2), glide: setp.glide?.state ?? null, lift: setp.lift.state, fall: setp.fall ? +setp.fall.a.toFixed(2) : null, slide: setp.slide.active }; },
    tris: () => world.tris,
    POWER,
  };
}
