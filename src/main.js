import * as THREE from 'three';
import '@fontsource/anton/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import { patchFog, createSky, createEnvironment, createSunFlare, createLights, updateSun, updateFogView, FOG_AWAY, SUN_DIR } from './atmosphere.js';
import { buildAtlas } from './particles.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { SoundBus } from './soundbus.js';
import { seed } from './rng.js';
import { LEVELS, levelById, loadLevel, nextLevel } from './levels/index.js';

// =====================================================================================
//  BAYHEM boot: shared engine (renderer, atmosphere, FX, HUD, audio) + one level module.
//  ?level=<id> picks the level (capture runs default to level 1); the menu reloads the page
//  with that parameter so every level boots into a clean engine.
// =====================================================================================
patchFog();
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const TRAILER = params.has('trailer');
const SANDBOX = params.has('sandbox');
const AUTO = !SANDBOX && (CAPTURE || params.has('demo') || TRAILER);
const flags = { CAPTURE, TRAILER, SANDBOX, AUTO };
seed(parseInt(params.get('seed') || '1337', 10));
const LEVEL_ID = levelById(params.get('level') || (CAPTURE ? null : safeGet('bayhem.level')) || LEVELS[0].id).id;
function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

async function boot() {
  const ui = CAPTURE ? null : buildStartScreen();
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

  const sky = createSky(); scene.add(sky);
  const flare = createSunFlare(); scene.add(flare);
  const { sun, hemi } = createLights(scene, isQuest ? 1024 : 2048);
  const atlas = buildAtlas(renderer);
  const fx = new FX(scene, atlas, scene.fog, quality);
  const hud = new HUD(scene, camera);
  hud.setAspect(innerWidth / innerHeight);
  const audio = new SoundBus(CAPTURE);
  const E = { scene, renderer, camera, rig, sky, flare, sun, hemi, atlas, fx, hud, audio, params, quality, flags, isQuest };

  const levelMod = await loadLevel(LEVEL_ID);
  const L = await levelMod.create(E);
  // the level may customise the atmosphere (sun, dusk) before the environment map is baked
  scene.environment = createEnvironment(renderer);
  scene.environmentIntensity = L.environmentIntensity ?? 0.8;
  const { game, player } = L;
  window.__renderer = renderer; window.__scene = scene; window.__hud = hud; window.__game = game; window.__fx = fx; window.__player = player; window.__THREE = THREE; window.__level = L;
  if (params.has('yaw')) { player.yaw = parseFloat(params.get('yaw')) * Math.PI / 180; player.pitch = parseFloat(params.get('pitch') || '0') * Math.PI / 180; }

  // warm up: compile every material/program we will ever need before the first explosion (no hitch on Quest)
  if (L.warm) { L.warm.position.set(rig.position.x, -60, rig.position.z); scene.add(L.warm); }
  renderer.compile(scene, camera);
  if (L.warm) scene.remove(L.warm);

  // ---------------- frame ----------------
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), q = new THREE.Quaternion();
  let started = false, ended = false;
  let videoTime = 0, lastExp = -1;
  const start = () => { started = true; L.start(); };

  function frame(rdt, noRender = false) {
    videoTime += rdt;
    audio.t = videoTime;
    // sub-step the sim for stable physics
    const steps = rdt > 1 / 45 ? 2 : 1;
    for (let i = 0; i < steps; i++) L.step(rdt / steps, started);
    camera.updateMatrixWorld(true);
    const xrCam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
    xrCam.getWorldPosition(tmp);
    game.headPos.copy(tmp);
    hud.update(rdt, game, tmp);
    hud.drawScore(game.score, game.hp, L.ammoText(), game.comboT > 0 ? game.combo : 0);
    xrCam.getWorldDirection(fwd); up.set(0, 1, 0).applyQuaternion(xrCam.getWorldQuaternion(q));
    audio.setListener(tmp, fwd, up);
    L.frame?.(rdt, started, tmp);
    audio.update(rdt);
    if (game.lastExplosionT > lastExp) { lastExp = game.lastExplosionT; player.shake = Math.min(1.5, player.shake + (game.lastExplosionShake ?? 0.8)); }
    sky.position.copy(tmp);
    sky.material.uniforms.time.value = videoTime;
    sky.material.uniforms.sunDir.value.copy(SUN_DIR);
    flare.position.copy(tmp).addScaledVector(SUN_DIR, 2000);
    updateSun(sun, rig.position);
    updateFogView(xrCam);
    if (!noRender) renderer.render(scene, camera);
    if (started && !ended && L.director?.done && !CAPTURE) { ended = true; setTimeout(() => showEndScreen(renderer, hud), 2500); }
  }

  window.__step = (dt, noRender) => frame(dt, noRender);
  window.__audioEvents = () => audio.events;
  window.__state = () => ({ t: videoTime, level: LEVEL_ID, ...L.state() });
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
  if (AUTO) { ui?.remove(); const kick = async () => { removeEventListener('pointerdown', kick); await audio.init(); }; addEventListener('pointerdown', kick); start(); return; }
  const go = async (vr) => {
    try {
      // request the XR session first: it must happen inside the click's user activation
      const sessionP = vr ? navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }) : null;
      await audio.init();
      audio.play('ui_select', {});
      if (vr) {
        const session = await sessionP;
        renderer.xr.setFramebufferScaleFactor(1.0);
        await renderer.xr.setSession(session);
        player.setupVR();
        hud.setVR(true);
        session.addEventListener('end', () => {
          hud.setVR(false); player.mode = 'desktop';
          for (const g of [player.rifle, player.launcher]) { camera.add(g.holder); g.model.setMode?.('desktop'); }
          player.onExitVR?.();
        });
      } else renderer.domElement.requestPointerLock?.();
    } catch (e) { console.warn(e); }
    ui.remove();
    start();
  };
  ui.ready(go);
}

// ---------------- menus ----------------
const MENU_CSS = `
  #bay{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
    background:radial-gradient(ellipse at 50% 70%, rgba(255,120,30,0.16), rgba(10,4,2,0.82) 72%);z-index:10;text-align:center;padding:16px;overflow:auto}
  #bay h1{font:400 clamp(60px,12vw,170px)/0.9 Anton,Impact,sans-serif;margin:0;letter-spacing:0.02em;
    background:linear-gradient(#fff 0%,#ffe2b4 42%,#6a4a2c 50%,#ffc46b 58%,#fff2d6 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 0 24px rgba(255,110,10,0.7)) drop-shadow(0 4px 0 #1a0d04)}
  #bay .levels{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:980px}
  #bay .lv{all:unset;box-sizing:border-box;cursor:pointer;width:min(440px,92vw);text-align:left;padding:14px 18px;border-radius:6px;border:2px solid rgba(255,179,90,0.28);
    background:linear-gradient(135deg,rgba(40,18,6,0.78),rgba(12,6,3,0.78));transition:border-color .15s, transform .15s, box-shadow .15s}
  #bay .lv:hover{border-color:rgba(255,179,90,0.7);transform:translateY(-2px)}
  #bay .lv.sel{border-color:#ffb35a;box-shadow:0 0 26px rgba(255,120,20,0.35), inset 0 0 40px rgba(255,120,20,0.08)}
  #bay .lv .n{font:400 15px Anton,Impact,sans-serif;letter-spacing:0.2em;color:#ff8a2a}
  #bay .lv .t{font:400 34px/1.05 Anton,Impact,sans-serif;letter-spacing:0.04em;color:#fff3df;margin:2px 0 4px}
  #bay .lv .g{font:700 12px Oswald,sans-serif;letter-spacing:0.22em;color:#ffd9a8}
  #bay .lv .b{font:500 14px/1.45 Oswald,sans-serif;color:#d9b99a;margin-top:6px}
  #bay .row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
  #bay button.go{font:400 22px Anton,Impact,sans-serif;letter-spacing:0.08em;padding:14px 30px;border-radius:4px;border:2px solid #ffb35a;
    background:linear-gradient(#ff8a2a,#c8400e);color:#fff8ee;cursor:pointer;box-shadow:0 0 24px rgba(255,120,20,0.45);min-width:200px}
  #bay button.go:disabled{opacity:0.35;cursor:default;box-shadow:none}
  #bay button.alt{background:rgba(20,10,4,0.6)}
  #bay small{font:500 13px Oswald,sans-serif;color:#d9b99a;letter-spacing:0.08em;max-width:620px;line-height:1.6}`;

function buildStartScreen() {
  const d = document.createElement('div');
  const lv = levelById(LEVEL_ID);
  d.innerHTML = `<style>${MENU_CSS}</style>
  <div id="bay">
    <h1>BAYHEM</h1>
    <div class="levels">${LEVELS.map(l => `<button class="lv${l.id === lv.id ? ' sel' : ''}" data-id="${l.id}"><div class="n">LEVEL ${l.num}</div><div class="t">${l.title}</div><div class="g">${l.tagline}</div><div class="b">${l.blurb}</div></button>`).join('')}</div>
    <div class="row"><button id="vr" class="go" disabled>LOADING…</button><button id="play" class="go alt" disabled>LOADING…</button></div>
    <small>${lv.help}<br>VR: right trigger = rifle, left trigger = grenade launcher, A/X = reload.<br>Desktop: mouse to aim, left click = rifle, right click = launcher, R = reload.</small>
  </div>`;
  document.body.appendChild(d);
  for (const b of d.querySelectorAll('.lv')) b.onclick = () => {
    if (b.dataset.id === lv.id) return;
    safeSet('bayhem.level', b.dataset.id);
    const u = new URL(location.href); u.searchParams.set('level', b.dataset.id); location.href = u.toString();
  };
  d.ready = (go) => {
    const play = d.querySelector('#play'), vrBtn = d.querySelector('#vr');
    play.disabled = false; play.textContent = 'PLAY ON DESKTOP'; play.onclick = () => go(false);
    vrBtn.textContent = 'VR NOT DETECTED';
    if (navigator.xr) navigator.xr.isSessionSupported('immersive-vr').then(ok => { if (ok) { vrBtn.disabled = false; vrBtn.textContent = 'ENTER VR'; vrBtn.onclick = () => go(true); } }).catch(() => {});
  };
  return d;
}

function showEndScreen(renderer, hud) {
  hud?.endCard(true); // no score panel / crosshair behind the end menu
  const s = renderer.xr.getSession?.(); if (s) s.end().catch(() => {});
  document.exitPointerLock?.();
  const nx = nextLevel(LEVEL_ID);
  const d = document.createElement('div');
  d.innerHTML = `<style>${MENU_CSS} #bay{background:radial-gradient(ellipse at 50% 70%, rgba(255,120,30,0.10), rgba(10,4,2,0.55) 72%)}</style>
  <div id="bay"><div class="row">${nx ? `<button class="go" id="next">NEXT: ${nx.title}</button>` : ''}<button class="go alt" id="again">PLAY AGAIN</button><button class="go alt" id="menu">LEVEL SELECT</button></div></div>`;
  document.body.appendChild(d);
  const nav = (id) => { const u = new URL(location.href); u.searchParams.set('level', id); safeSet('bayhem.level', id); location.href = u.toString(); };
  d.querySelector('#next')?.addEventListener('click', () => nav(nx.id));
  d.querySelector('#again').onclick = () => nav(LEVEL_ID);
  d.querySelector('#menu').onclick = () => { const u = new URL(location.href); u.searchParams.delete('level'); location.href = u.toString(); };
}

boot();
