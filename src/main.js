import * as THREE from 'three';
import '@fontsource/anton/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import { patchFog, createSky, createEnvironment, createSunFlare, createLights, updateSun, updateFogView, FOG_AWAY, SUN_DIR } from './atmosphere.js';
import { buildAtlas } from './particles.js';
import { World } from './world.js';
import { initMaterials, MAT, buildSUV, buildSedan, buildTanker } from './vehicles.js';
import { buildHeli } from './heli.js';
import { warmupGunmen } from './characters.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { Game } from './game.js';
import { Player } from './player.js';
import { Director } from './director.js';
import { seed } from './rng.js';

patchFog();
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const TRAILER = params.has('trailer');
const SANDBOX = params.has('sandbox');
const AUTO = !SANDBOX && (CAPTURE || params.has('demo') || TRAILER);
seed(parseInt(params.get('seed') || '1337', 10));

// ---------------- audio bus (live or recorded for offline render) ----------------
class SoundBus {
  constructor() { this.sys = null; this.record = CAPTURE; this.events = []; this.t = 0; this.listenerN = 0; }
  async init() {
    if (this.record) return;
    try {
      const loader = import.meta.glob('./audio.js')['./audio.js'];
      if (!loader) throw new Error('audio module missing');
      const mod = await loader();
      this.sys = new mod.AudioSystem();
      await this.sys.init();
    } catch (e) { console.warn('audio unavailable', e); this.sys = null; }
  }
  _ev(type, name, opts, value) { if (this.record) this.events.push({ t: +this.t.toFixed(4), type, name, opts: opts ? { ...opts } : undefined, value }); }
  play(name, opts = {}) { this._ev('play', name, opts); this.sys?.play(name, opts); }
  setLoop(name, opts = {}) {
    if (this.record) { this._lt ??= {}; if (this._lt[name] === undefined || this.t - this._lt[name] > 0.1) { this._lt[name] = this.t; this._ev('loop', name, opts); } }
    this.sys?.setLoop(name, opts);
  }
  stopLoop(name) { this._ev('stopLoop', name); this.sys?.stopLoop?.(name); }
  setTimeScale(s) { if (this.record) { if (Math.abs((this._ts ?? 1) - s) > 0.02) { this._ts = s; this._ev('timescale', null, null, +s.toFixed(3)); } } this.sys?.setTimeScale(s); }
  setListener(p, f, u) {
    if (this.record) { if (this.listenerN++ % 3 === 0) this.events.push({ t: +this.t.toFixed(4), type: 'listener', args: [p.x, p.y, p.z, f.x, f.y, f.z, u.x, u.y, u.z].map(v => +v.toFixed(3)) }); }
    this.sys?.setListener(p.x, p.y, p.z, f.x, f.y, f.z, u.x, u.y, u.z);
  }
  startMusic() { this._ev('musicStart'); this.sys?.startMusic(); }
  setMusicIntensity(v) { this._ev('musicIntensity', null, null, v); this.sys?.setMusicIntensity(v); }
  musicStinger(n) { this._ev('stinger', n); this.sys?.musicStinger(n); }
  stopMusic(f = 2) { this._ev('musicStop', null, null, f); this.sys?.stopMusic(f); }
  update(dt) { this.sys?.update(dt); }
}

async function boot() {
  await Promise.all([document.fonts.load('400 64px Anton'), document.fonts.load('700 64px Oswald'), document.fonts.load('500 64px Oswald')]).catch(() => {});
  const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);
  const quality = isQuest ? 'quest' : 'high';
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
  renderer.setPixelRatio(CAPTURE ? 1 : Math.min(devicePixelRatio, isQuest ? 1 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = (isQuest || params.has('pcf')) ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  if (params.has('noshadow')) renderer.shadowMap.enabled = false;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_AWAY.clone(), 25, 520);
  const camera = new THREE.PerspectiveCamera(CAPTURE ? 70 : 72, innerWidth / innerHeight, 0.05, 3000);
  const rig = new THREE.Group();
  scene.add(rig); rig.add(camera);
  camera.position.set(0, 1.65, 0);

  scene.environment = createEnvironment(renderer);
  scene.environmentIntensity = 0.8;
  const sky = createSky(); scene.add(sky);
  const flare = createSunFlare(); scene.add(flare);
  const { sun } = createLights(scene, isQuest ? 1024 : 2048);
  const atlas = buildAtlas(renderer);
  initMaterials();
  const world = new World(scene, renderer, atlas, scene.fog, quality);
  const fx = new FX(scene, atlas, scene.fog, quality);
  const hud = new HUD(scene, camera);
  hud.setAspect(innerWidth / innerHeight);
  const audio = new SoundBus();

  const game = new Game({ scene, fx, world, hud, audio, rig, camera, params, mode: AUTO ? 'auto' : 'play' });
  const player = new Player(game, camera, rig, renderer, { auto: AUTO });
  game.onHaptic = (i, ms) => player.pulse(i, ms);
  let director = null;
  window.__veh = { buildSUV, buildSedan, buildTanker, MAT }; window.__scene = scene;
  window.__hud = hud; window.__game = game; window.__fx = fx; window.__player = player; window.__THREE = THREE;
  if (params.has('yaw')) { player.yaw = parseFloat(params.get('yaw')) * Math.PI / 180; player.pitch = parseFloat(params.get('pitch') || '0') * Math.PI / 180; }

  // warm up: compile every material/program we will ever need before the first explosion (no hitch on Quest)
  const warm = new THREE.Group();
  for (const v of [buildSUV(), buildSedan(MAT.civ[0]), buildSedan(MAT.civ[1]), buildSedan(MAT.civ[2]), buildTanker()]) warm.add(v.root);
  warm.add(buildHeli().root, warmupGunmen());
  const box = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  for (const m of Object.values(MAT)) for (const mm of [].concat(m)) warm.add(new THREE.Mesh(box, mm));
  warm.position.set(0, -50, 0);
  scene.add(warm);
  renderer.compile(scene, camera);
  scene.remove(warm);

  // ---------------- frame ----------------
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), q = new THREE.Quaternion();
  let started = false;
  let videoTime = 0, lastExp = -1;
  const ctx = { bedFloor: 0.91, bedX: 0, bedHalfW: 0.78, bedZ0: 0.25, bedZ1: 2.6, onCasing: (c) => audio.play('casing', { x: c.x, y: c.y, z: c.z, volume: 0.35 }) };
  const start = () => { started = true; if (!SANDBOX) director = new Director(game, hud, audio, TRAILER || CAPTURE); };

  function frame(rdt, noRender = false) {
    videoTime += rdt;
    audio.t = videoTime;
    // sub-step the sim for stable physics
    const steps = rdt > 1 / 45 ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      const sdt = rdt / steps;
      const dt = game.update(sdt);
      player.update(sdt, started ? dt : 0);
      ctx.bedX = game.truckX;
      fx.update(dt, game.dz, ctx);
      if (director) director.update(dt);
    }
    camera.updateMatrixWorld(true);
    const xrCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    xrCam.getWorldPosition(tmp);
    game.headPos.copy(tmp);
    hud.update(rdt, game, tmp);
    hud.drawScore(game.score, game.hp, `${player.rifle.reloading > 0 ? 'RELOADING' : player.rifle.ammo + ' RDS'}   ${player.launcher.reloading > 0 ? '--' : player.launcher.ammo} GL`, game.comboT > 0 ? game.combo : 0);
    xrCam.getWorldDirection(fwd); up.set(0, 1, 0).applyQuaternion(xrCam.getWorldQuaternion(q));
    audio.setListener(tmp, fwd, up);
    if (started) { audio.setLoop('wind', { volume: 0.8, intensity: 1 }); audio.setLoop('truck', { volume: 0.7, intensity: 0.6 }); }
    audio.update(rdt);
    if (game.lastExplosionT > lastExp) { lastExp = game.lastExplosionT; player.shake = Math.min(1.5, player.shake + 0.8); }
    sky.position.copy(tmp);
    sky.material.uniforms.time.value = videoTime;
    flare.position.copy(tmp).addScaledVector(SUN_DIR, 2000);
    updateSun(sun, rig.position);
    updateFogView(xrCam);
    if (!noRender) renderer.render(scene, camera);
  }

  window.__step = (dt, noRender) => frame(dt, noRender);
  window.__audioEvents = () => audio.events;
  window.__state = () => ({ t: videoTime, step: director?.cur?.name, done: director?.done, score: game.score, cars: game.cars.length });
  if (CAPTURE) { start(); window.__ready = true; return; }
  window.__ready = true;

  // ---------------- live loop + start screen ----------------
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const n = performance.now();
    const rdt = Math.min(1 / 20, (n - last) / 1000); last = n;
    frame(rdt);
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    hud.setAspect(camera.aspect);
  });
  if (AUTO) { const kick = async () => { removeEventListener('pointerdown', kick); await audio.init(); }; addEventListener('pointerdown', kick); start(); return; }
  const ui = buildStartScreen();
  const go = async (vr) => {
    try {
      await audio.init();
      audio.play('ui_select', {});
      if (vr) {
        const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
        renderer.xr.setFramebufferScaleFactor(1.0);
        await renderer.xr.setSession(session);
        player.setupVR();
        hud.setVR(true);
        session.addEventListener('end', () => {
          hud.setVR(false); player.mode = 'desktop';
          for (const g of [player.rifle, player.launcher]) { camera.add(g.holder); g.model.setMode?.('desktop'); }
        });
      } else renderer.domElement.requestPointerLock?.();
    } catch (e) { console.warn(e); }
    ui.remove();
    start();
  };
  ui.querySelector('#play').onclick = () => go(false);
  const vrBtn = ui.querySelector('#vr');
  if (navigator.xr) navigator.xr.isSessionSupported('immersive-vr').then(ok => { if (ok) { vrBtn.disabled = false; vrBtn.textContent = 'ENTER VR'; vrBtn.onclick = () => go(true); } }).catch(() => {});
}

function buildStartScreen() {
  const d = document.createElement('div');
  d.innerHTML = `
  <style>
    #bay{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
      background:radial-gradient(ellipse at 50% 70%, rgba(255,120,30,0.16), rgba(10,4,2,0.8) 72%);z-index:10;text-align:center;padding:16px}
    #bay h1{font:400 clamp(64px,14vw,180px)/0.9 Anton,Impact,sans-serif;margin:0;letter-spacing:0.02em;
      background:linear-gradient(#fff 0%,#ffe2b4 42%,#6a4a2c 50%,#ffc46b 58%,#fff2d6 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
      filter:drop-shadow(0 0 24px rgba(255,110,10,0.7)) drop-shadow(0 4px 0 #1a0d04)}
    #bay p{font:500 clamp(14px,2.2vw,20px) Oswald,sans-serif;letter-spacing:0.25em;color:#ffd9a8;margin:0 0 12px}
    #bay .row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
    #bay button{font:400 22px Anton,Impact,sans-serif;letter-spacing:0.08em;padding:14px 30px;border-radius:4px;border:2px solid #ffb35a;
      background:linear-gradient(#ff8a2a,#c8400e);color:#fff8ee;cursor:pointer;box-shadow:0 0 24px rgba(255,120,20,0.45);min-width:200px}
    #bay button:disabled{opacity:0.35;cursor:default;box-shadow:none}
    #bay button.alt{background:rgba(20,10,4,0.6)}
    #bay small{font:500 13px Oswald,sans-serif;color:#d9b99a;letter-spacing:0.08em;max-width:560px;line-height:1.6}
  </style>
  <div id="bay">
    <h1>BAYHEM</h1>
    <p>A HIGHWAY CHASE IN FIVE EXPLOSIONS</p>
    <div class="row"><button id="vr" disabled>VR NOT DETECTED</button><button id="play" class="alt">PLAY ON DESKTOP</button></div>
    <small>VR: right trigger = rifle, left trigger = grenade launcher, A/X = reload.<br>Desktop: mouse to aim, left click = rifle, right click = launcher, R = reload.</small>
  </div>`;
  document.body.appendChild(d);
  return d;
}

boot();
