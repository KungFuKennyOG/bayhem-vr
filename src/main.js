import * as THREE from 'three';
import '@fontsource/anton/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/700.css';
import { patchFog, createSky, createEnvironment, createSunFlare, createLights, updateSun, updateFogView, FOG_AWAY, SUN_DIR } from './atmosphere.js';
import { buildAtlas } from './particles.js';
import { FX } from './fx.js';
import { HUD } from './hud.js';
import { SoundBus } from './soundbus.js';
import { attachVoice } from './vo.js';
import { seed } from './rng.js';
import { settings, setSetting } from './settings.js';
import { LEVELS, levelsOf, levelById, findLevel, loadLevel, nextLevel } from './levels/index.js';
import { PAGE_GAME, GAMES, gameUrl } from './game.js';

// =====================================================================================
//  BAYHEM boot: shared engine (renderer, atmosphere, FX, HUD, audio) + one level module.
//  ?level=<id> picks the level (capture runs default to level 1); the menu reloads the page
//  with that parameter so every level boots into a clean engine. Two pages share this file:
//  BAYHEM (/, Levels 1–4) and BAYHEM 2 (/2/, abroad); see src/game.js.
// =====================================================================================
patchFog();
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const TRAILER = params.has('trailer');
const SANDBOX = params.has('sandbox');
const AUTO = !SANDBOX && !params.has('noauto') && (CAPTURE || params.has('demo') || TRAILER); // noauto: capture without the autopilot (test real-play beats)
const flags = { CAPTURE, TRAILER, SANDBOX, AUTO };
seed(parseInt(params.get('seed') || '1337', 10));
// the level: ?level= wins; otherwise the last one played in this game, otherwise the game's first level
const asked = findLevel(params.get('level'));
const stored = CAPTURE ? null : findLevel(safeGet(GAMES[PAGE_GAME].store));
const LEVEL_ID = (asked || (stored && stored.game === PAGE_GAME && !stored.hidden ? stored : null) || levelsOf(PAGE_GAME)[0] || LEVELS[0]).id;
// a level from the other game asked on this page: move to that game's page (captures stay put so tools/ keep working)
const MOVED = !CAPTURE && asked && asked.game !== PAGE_GAME;
if (MOVED) location.replace(gameUrl(asked.game, asked.id));
const GAME = levelById(LEVEL_ID).game;
document.title = GAME === 2 ? 'BAYHEM 2' : 'BAYHEM';
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
  attachVoice(hud, audio, LEVEL_ID); // driver lines are spoken over the radio
  const E = { scene, renderer, camera, rig, sky, flare, sun, hemi, atlas, fx, hud, audio, params, quality, flags, isQuest };

  const levelMod = await loadLevel(LEVEL_ID);
  const L = await levelMod.create(E);
  // the level may customise the atmosphere (sun, dusk) before the environment map is baked
  scene.environment = createEnvironment(renderer);
  scene.environmentIntensity = L.environmentIntensity ?? 0.8;
  const { game, player } = L;
  window.__renderer = renderer; window.__scene = scene; window.__hud = hud; window.__game = game; window.__fx = fx; window.__player = player; window.__THREE = THREE; window.__level = L; window.__audio = audio;
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
    // head pose in WORLD space. In VR use the user camera (child of the rig), never renderer.xr.getCamera():
    // the XR array camera has no parent, so its getWorld*() returns tracking space and ignores the rig's
    // position + snap turns (enemies would aim at the level origin, movement would drift after a turn).
    camera.updateWorldMatrix(true, false);
    const xrCam = camera;
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
  #bay button.opt{all:unset;cursor:pointer;font:700 14px Oswald,sans-serif;letter-spacing:0.18em;color:#d9b99a;padding:8px 16px;border-radius:4px;border:1px solid rgba(255,179,90,0.3);background:rgba(20,10,4,0.5)}
  #bay button.opt.on{color:#ffd9a8;border-color:rgba(255,179,90,0.7)}
  #bay .two{font:400 1.05em/0.9 Anton,Impact,sans-serif;margin-left:0.06em;
    background:linear-gradient(#fff6e8 0%,#ff9a4a 40%,#5a1206 50%,#ff3c12 60%,#ffd2a0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  #bay .sub{font:700 clamp(13px,1.6vw,18px) Oswald,sans-serif;letter-spacing:0.5em;color:#ffb35a;margin:-6px 0 4px;padding-left:0.5em}
  #bay.g2{background:radial-gradient(ellipse at 50% 70%, rgba(255,70,20,0.18), rgba(10,3,2,0.84) 72%)}
  #bay .lv .n .of{color:#8a6a4c;letter-spacing:0.14em}
  #bay a.xg{font:700 14px Oswald,sans-serif;letter-spacing:0.22em;color:#ffd9a8;text-decoration:none;padding:8px 16px;border-radius:4px;border:1px solid rgba(255,179,90,0.45);background:rgba(20,10,4,0.5)}
  #bay a.xg:hover{border-color:#ffb35a;color:#fff3df}
  #bay small{font:500 13px Oswald,sans-serif;color:#d9b99a;letter-spacing:0.08em;max-width:620px;line-height:1.6}`;

function buildStartScreen() {
  const d = document.createElement('div');
  const lv = levelById(LEVEL_ID), G = GAMES[GAME], other = GAME === 2 ? 1 : 2;
  const list = levelsOf(GAME);
  if (lv.hidden) list.push(lv); // a URL-only prototype still shows as the selected card
  d.innerHTML = `<style>${MENU_CSS}</style>
  <div id="bay" class="g${GAME}">
    <h1>${G.title}${G.two ? `<span class="two">${G.two}</span>` : ''}</h1>
    ${G.sub ? `<div class="sub">${G.sub}</div>` : ''}
    <div class="levels">${list.map(l => `<button class="lv${l.id === lv.id ? ' sel' : ''}" data-id="${l.id}"><div class="n">LEVEL ${l.num}</div><div class="t">${l.title}</div><div class="g">${l.tagline}</div><div class="b">${l.blurb}</div></button>`).join('')}</div>
    <div class="row"><button id="vr" class="go" disabled>LOADING…</button><button id="play" class="go alt" disabled>LOADING…</button></div>
    <div class="row"><button id="comfort" class="opt"></button><a class="xg" href="${gameUrl(other, null, false)}">${other === 2 ? 'BAYHEM 2: ABROAD →' : '← BAYHEM: HAVEN CITY'}</a></div>
    <small>${lv.help}<br>VR: right trigger = rifle, left trigger = grenade launcher, A/X = reload, click the right stick = comfort vignette on/off.<br>Desktop: mouse to aim, left click = rifle, right click = launcher, R = reload.</small>
  </div>`;
  document.body.appendChild(d);
  const cb = d.querySelector('#comfort');
  const drawComfort = () => { cb.textContent = `COMFORT VIGNETTE: ${settings.comfortVignette ? 'ON' : 'OFF'}`; cb.classList.toggle('on', settings.comfortVignette); };
  drawComfort(); cb.onclick = () => { setSetting('comfortVignette', !settings.comfortVignette); drawComfort(); };
  cb.title = 'Darkens the edges of your view while you move on foot in VR (reduces motion sickness)';
  for (const b of d.querySelectorAll('.lv')) b.onclick = () => {
    if (b.dataset.id === lv.id) return;
    safeSet(G.store, b.dataset.id);
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
  // the last level of BAYHEM hands over to BAYHEM 2
  const sequel = !nx && GAME === 1 && levelById(LEVEL_ID).id === levelsOf(1).at(-1).id ? levelsOf(2)[0] : null;
  const d = document.createElement('div');
  d.innerHTML = `<style>${MENU_CSS} #bay{background:radial-gradient(ellipse at 50% 70%, rgba(255,120,30,0.10), rgba(10,4,2,0.55) 72%)}</style>
  <div id="bay"><div class="row">${nx ? `<button class="go" id="next">NEXT: ${nx.title}</button>` : ''}${sequel ? `<button class="go" id="sequel">PLAY BAYHEM 2</button>` : ''}<button class="go alt" id="again">PLAY AGAIN</button><button class="go alt" id="menu">LEVEL SELECT</button></div></div>`;
  document.body.appendChild(d);
  const nav = (id) => { const u = new URL(location.href); u.searchParams.set('level', id); safeSet(GAMES[GAME].store, id); location.href = u.toString(); };
  d.querySelector('#next')?.addEventListener('click', () => nav(nx.id));
  d.querySelector('#sequel')?.addEventListener('click', () => { safeSet(GAMES[2].store, sequel.id); location.href = gameUrl(2, sequel.id, false); });
  d.querySelector('#again').onclick = () => nav(LEVEL_ID);
  d.querySelector('#menu').onclick = () => { const u = new URL(location.href); u.searchParams.delete('level'); location.href = u.toString(); };
}

if (!MOVED) boot();
