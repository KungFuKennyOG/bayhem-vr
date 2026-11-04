import * as THREE from 'three';
import { patchFog, createSky, createEnvironment, createLights, updateSun, updateFogView, FOG_AWAY, SUN_DIR } from '/src/atmosphere.js';
import { initMaterials, MAT } from '/src/vehicles.js';

patchFog();
const P = new URLSearchParams(location.search);
const W = +(P.get('w') || 960), H = +(P.get('h') || 540);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = P.get('shadow') !== '0'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const { buildHeli } = await import('/src/heli.js');
initMaterials();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_AWAY.clone(), 25, 520);
const camera = new THREE.PerspectiveCamera(+(P.get('fov') || 60), W / H, 0.05, 3000);
scene.environment = createEnvironment(renderer);
scene.add(createSky());
const { sun } = createLights(scene, 2048);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x3d3834, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

if (P.get('view') === 'atlas') {
  const h0 = buildHeli();
  const c = h0.debug.cache.tex.debugCanvas;
  c.style.width = '100%'; document.body.innerHTML = ''; document.body.appendChild(c);
  window.__done = true;
} else {
  const t0 = performance.now();
  const h = buildHeli();
  const buildMs = performance.now() - t0;
  const hp = new THREE.Vector3(...(P.get('hp') || '0,12,0').split(',').map(Number));
  h.root.position.copy(hp); h.root.scale.setScalar(1.2);
  h.root.rotation.y = (+(P.get('yaw') || 0)) * Math.PI / 180;
  h.tilt.rotation.set((+(P.get('pitch') || 0)) * Math.PI / 180, 0, (+(P.get('bank') || 0)) * Math.PI / 180);
  scene.add(h.root);
  if (P.get('dmg')) h.setDamage(+P.get('dmg'));
  if (P.get('blur')) h.rotorBlur(+P.get('blur'), true); else h.rotorBlur(0, true);
  h.rotor.rotation.y = +(P.get('rot') || 0.3);
  h.tailRotor.rotation.x = 0.4;
  if (P.get('tail') === '1') { const r = h.breakTail(); r.object.position.add(new THREE.Vector3(1.5, -1, 3)); r.object.rotation.y += 0.6; }
  // camera: relative to heli, either explicit or in sun-relative presets
  const cam = (P.get('cam') || '10,4,-12').split(',').map(Number);
  camera.position.copy(hp).add(new THREE.Vector3(...cam));
  const look = (P.get('look') || '0,0,0').split(',').map(Number);
  camera.lookAt(hp.clone().add(new THREE.Vector3(...look)));
  scene.updateMatrixWorld(true);
  if (P.get('aim')) h.aimGun(P.get('aimAt') ? hp.clone().add(new THREE.Vector3(...P.get('aimAt').split(',').map(Number))) : camera.position, 10, true);
  if (P.get('mz')) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06), new THREE.MeshBasicMaterial({ color: 0xff00ff })); h.gun.add(m); }
  if (P.get('wreck') === '1') { h.body.material = [MAT.charred, MAT.charred]; h.burnables.forEach(b => b.material = MAT.charred); }
  if (P.get('noblur')) h.debug.blurMesh.visible = false;
  if (P.get('hide')) for (const k of P.get('hide').split(',')) { const o = k === 'body' ? h.body : k === 'rotor' ? h.rotor : k === 'cone' ? h.cone : null; if (o) o.visible = false; }
  updateSun(sun, hp.clone().setY(0));
  sun.shadow.camera.far = 400; sun.shadow.camera.updateProjectionMatrix();
  updateFogView(camera);
  renderer.render(scene, camera);
  let tris = 0; h.root.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
  window.__h = h; window.__info = { buildMs: Math.round(buildMs), cacheMs: Math.round(h.debug.cache.buildMs), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, heliTris: Math.round(tris) };
  window.__done = true;
}
