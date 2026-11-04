import * as THREE from 'three';
import { patchFog, createSky, createEnvironment, createLights, updateSun, updateFogView, FOG_AWAY } from '/src/atmosphere.js';
import { buildRifle, buildLauncher, Gun, VR_HOLD } from '/src/weapons.js';

patchFog();
const P = new URLSearchParams(location.search);
const view = P.get('view') || 'desktop';
const W = +(P.get('w') || 960), H = +(P.get('h') || 540);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_AWAY.clone(), 25, 520);
const camera = new THREE.PerspectiveCamera(+(P.get('fov') || 70), W / H, 0.02, 3000);
const rig = new THREE.Group(); scene.add(rig); rig.add(camera);
scene.environment = createEnvironment(renderer); scene.environmentIntensity = 0.8;
scene.add(createSky());
const { sun } = createLights(scene, 512); sun.castShadow = false; updateSun(sun, new THREE.Vector3());
// a ground plane + a truck-bed-ish floor so there's some context
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

const t0 = performance.now();
const rifle = new Gun(buildRifle({ supportHand: P.get('support') === '1' }), { rpm: 690, mag: 45, reload: 1.5, auto: true });
const launcher = new Gun(buildLauncher(), { rpm: 110, mag: 6, reload: 2.4, auto: false });
const buildMs = performance.now() - t0;
const yaw = (+(P.get('yaw') ?? 166)) * Math.PI / 180, pitch = (+(P.get('pitch') ?? -4)) * Math.PI / 180;

function sim(gun, shots, extra = 0, trig = false) {
  for (let i = 0; i < shots; i++) { gun.tryFire(true); gun.update(1 / 60); gun.tryFire(false); gun.cool = 0; gun.update(1 / 60); }
  let t = extra; while (t > 0) { gun.tryFire(trig); gun.update(1 / 60); t -= 1 / 60; }
}
// state
const st = P.get('state') || '';
if (st === 'reload') { sim(rifle, 45, +(P.get('rt') || 0.9)); sim(launcher, 4, 0.0); launcher.startReload(); sim(launcher, 0, +(P.get('lt') || 1.0)); }
else if (st === 'fire') { sim(rifle, 6, 0.03, true); sim(launcher, 2, 0.05); }
else { sim(rifle, 0, 0.1); sim(launcher, 0, 0.1); }

camera.position.set(0, 1.65, 0);
if (view === 'desktop') {
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const rp = (P.get('rp') || '0.19,-0.255,-0.53').split(',').map(Number), lp = (P.get('lp') || '-0.3,-0.335,-0.6').split(',').map(Number);
  rifle.holder.position.fromArray(rp); launcher.holder.position.fromArray(lp);
  camera.add(rifle.holder, launcher.holder);
  camera.updateMatrixWorld(true);
  const tgt = new THREE.Vector3(0, 0, -30).applyMatrix4(camera.matrixWorld);
  for (const g of [rifle, launcher]) { g.holder.lookAt(tgt); g.holder.rotateY(Math.PI); }
} else if (view === 'orbit') {
  const gun = P.get('gun') === 'launcher' ? launcher : rifle;
  scene.add(gun.holder); gun.holder.position.set(0, 1.4, 0);
  const az = (+(P.get('az') ?? 35)) * Math.PI / 180, el = (+(P.get('el') ?? 12)) * Math.PI / 180, dist = +(P.get('dist') || 0.75);
  const c = new THREE.Vector3(+(P.get('cx') || 0), 1.4 + (+(P.get('cy') || 0.03)), +(P.get('cz') || -0.12));
  camera.position.set(c.x + Math.sin(az) * Math.cos(el) * dist, c.y + Math.sin(el) * dist, c.z + Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(c);
  gun.holder.rotation.y = (+(P.get('gy') || 0)) * Math.PI / 180;
} else if (view === 'vr') {
  // head at 1.65 looking forward/down; controllers at chest height, pointing ahead
  camera.rotation.set(-0.42, yaw, 0, 'YXZ');
  const mk = (x, y, z, rx, ry, rz) => { const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.set(rx, ry, rz, 'YXZ'); return o; };
  const fwd = new THREE.Group(); fwd.rotation.y = yaw; scene.add(fwd);
  const cR = mk(0.19, 1.22, -0.36, 0.08, -0.12, 0.0), cL = mk(-0.2, 1.2, -0.34, 0.05, 0.14, 0.0);
  fwd.add(cR, cL);
  for (const [c, g, h] of [[cR, rifle, VR_HOLD.rifle], [cL, launcher, VR_HOLD.launcher]]) { g.holder.position.fromArray(h.position); g.holder.rotation.fromArray(h.rotation); c.add(g.holder); }
  if (P.get('ray') === '1') for (const c of [cR, cL]) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -3)]), new THREE.LineBasicMaterial({ color: 0x00ff00 })); c.add(l); }
  rifle.model.setMode("vr"); launcher.model.setMode("vr");
}
scene.updateMatrixWorld(true);
updateFogView(camera);
renderer.render(scene, camera);
window.__info = { buildMs: Math.round(buildMs), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, rifleTris: rifle.model.triangles, launcherTris: launcher.model.triangles, rifleDC: rifle.model.drawCalls, launcherDC: launcher.model.drawCalls };
window.__done = true;
