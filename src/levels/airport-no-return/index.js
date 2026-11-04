import * as THREE from 'three';
import { AirportWorld } from './world.js';
import { AirportGame, SUN_AZ, sunElevation } from './game.js';
import { SetPieces } from './setpieces.js';
import { Director } from './director.js';
import { Auto } from './auto.js';
import { START } from './layout.js';
import { Player } from '../../player.js';
import { Locomotion } from '../../locomotion.js';
import { warmupGunmen, Gunman } from '../../characters.js';
import { initMaterials, MAT, buildSUV } from '../../vehicles.js';
import { applyDusk, setSunElevation } from '../../atmosphere.js';
import { gseMaterials } from './gse.js';

// LEVEL 4 — "AIRPORT NO RETURN": on foot across a sunset apron, two jets go up on the taxiway,
// then a FOLLOW-ME jeep chase down runway 27 after a cargo plane. You jump onto its ramp. Credits.
export async function create(E) {
  const { scene, renderer, fx, hud, audio, rig, camera, params, flags } = E;
  initMaterials();
  const dusk0 = params.has('dusk') ? +params.get('dusk') : 0.0;
  setSunElevation(sunElevation(dusk0), SUN_AZ);
  applyDusk(dusk0, { sun: E.sun, hemi: E.hemi, fog: scene.fog, renderer });
  scene.fog.near = 70; scene.fog.far = 2600;
  // long sightlines: the climb-out looks back over 4+ km of airfield and city (engine default far plane is 3 km)
  camera.far = 12000; camera.updateProjectionMatrix();
  // a slightly wider shadow frustum: big aircraft, long shadows
  const sc = E.sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.far = 320; sc.updateProjectionMatrix();
  // tighter sun glare: the low sun sits right down the runway and the default halo washes out the plane
  { const [g2, g1, st] = E.flare.children; g1.scale.setScalar(240); g2.scale.setScalar(480); g2.material.opacity = 0.3; st.material.opacity = 0.35; }
  // sunset grade for fire: the shared fireball emission (≈2.1/1.8/1.5) goes peach-pink against this sky, so this level's
  // FX instance pushes fire sprites toward orange (level-local patch, fx.js untouched)
  { const m = fx.main, spawn = m.spawn.bind(m); m.spawn = (o) => { if (o.frameKind === 1 && o.b > 1.0 && o.r > 1.8) { o.r *= 1.12; o.g *= 0.8; o.b *= 0.5; } return spawn(o); }; }
  const world = await new AirportWorld(E).build();
  const game = new AirportGame(E, world);
  game.dusk = dusk0;
  const setp = new SetPieces(game);
  game.setpieces = setp;
  const player = new Player(game, camera, rig, renderer, { auto: flags.AUTO, yaw: 0 });
  player.yaw = START.yaw; player.pitch = 0.06;
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  const loco = new Locomotion(rig, world.col, { walk: 3.2, sprint: 5.4 });
  player.enableLocomotion(loco);
  rig.position.set(START.x, 0, START.z);
  if (params.has('px')) rig.position.set(+params.get('px'), +(params.get('py') || 0), +params.get('pz'));
  const auto = flags.AUTO ? new Auto(game, player) : null;
  game.auto = auto; game.player = player; game.loco = loco;
  if (auto) player.autoState.idleW = 4.5;

  // warm-up set: every material the level uses, compiled before the first frame
  const warm = new THREE.Group();
  warm.add(warmupGunmen());
  const gr = new Gunman({ pose: 'ground', seed: 3 }); warm.add(gr.root);
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const m of Object.values(MAT)) for (const mm of [].concat(m)) warm.add(new THREE.Mesh(box, mm));
  for (const mm of gseMaterials()) warm.add(new THREE.Mesh(box, mm));
  warm.add(buildSUV().root);
  for (const m of setp.warmMaterials()) warm.add(new THREE.Mesh(box, m));
  // burnt variants (wrecks swap to these mid-fight: compile them now, no hitch on the first explosion)
  for (const mm of [...gseMaterials(), ...[].concat(...Object.values(MAT)), ...buildSUV().root.children.flatMap(c => [].concat(c.material || []))]) if (mm && mm.isMaterial) warm.add(new THREE.Mesh(box, game.scorch(mm)));

  const ctx = { groundAt: () => 0, onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.3 }) };
  let director = null;
  return {
    game, player, warm, world, setp,
    environmentIntensity: 0.8,
    get director() { return director; },
    start() { if (!flags.SANDBOX) director = new Director(game, hud, audio, setp, auto, flags.TRAILER || flags.CAPTURE); },
    step(sdt, started) {
      const dt = game.update(sdt);
      if (auto && started && !setp.riding) auto.update(dt);
      player.update(sdt, started ? dt : 0);
      setp.afterPlayer(sdt, dt);
      // casings bounce on whatever the player stands on (jeep bed / ramp / apron)
      ctx.groundAt = setp.casingFloor;
      fx.update(dt, 0, ctx);
      if (director) director.update(dt);
      else game.events.length = 0;
    },
    frame(rdt, started, head) {
      if (started) setp.frameAudio(rdt);
    },
    ammoText() { return `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`; },
    state() { return { step: director?.cur?.name, done: director?.done, score: game.score, kills: game.kills, alive: game.enemiesAlive(), x: +rig.position.x.toFixed(2), y: +rig.position.y.toFixed(2), z: +rig.position.z.toFixed(2), hp: Math.round(game.hp), dusk: +game.dusk.toFixed(2), ride: setp.riding ? setp.ride.state : null }; },
  };
}
