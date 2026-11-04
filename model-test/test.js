// Generic asset viewer for procedural models, lit like the game (sky, sun, rim, grade, fog, dusk).
// ?mod=/src/levels/port-of-victory/ship.js&fn=buildShip&args=[...json]
//  camera: &cx&cy&cz (target) &az&el (deg) &dist  or  &px&py&pz (position) with target
//  &dusk=0..1 &sunel=deg &sunax&sunaz (sun azimuth vector)  &ground=0 to hide the ground plane  &w &h &fov
import * as THREE from 'three';
import { patchFog, createSky, createEnvironment, createLights, createSunFlare, updateSun, updateFogView, FOG_AWAY, SUN_DIR, applyDusk, setSunElevation } from '/src/atmosphere.js';
import { initMaterials } from '/src/vehicles.js';

patchFog();
const P = new URLSearchParams(location.search);
const num = (k, d) => (P.has(k) ? +P.get(k) : d);
const W = num('w', 1280), H = num('h', 720);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = P.get('shadow') !== '0'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_AWAY.clone(), num('fogNear', 25), num('fogFar', 700));
const camera = new THREE.PerspectiveCamera(num('fov', 60), W / H, 0.05, 4000);
if (P.has('sunel') || P.has('sunax')) setSunElevation(num('sunel', 6), P.has('sunax') ? new THREE.Vector3(num('sunax', -0.42), 0, num('sunaz', -1)) : SUN_DIR.clone());
const sky = createSky(); scene.add(sky);
const flare = createSunFlare(); scene.add(flare);
const { sun, hemi } = createLights(scene, 2048);
applyDusk(num('dusk', 0), { sun, hemi, fog: scene.fog, renderer });
scene.environment = createEnvironment(renderer); scene.environmentIntensity = 0.8;
initMaterials();
if (P.get('ground') !== '0') {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.95 }));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
}
const tgt = new THREE.Vector3(num('cx', 0), num('cy', 1), num('cz', 0));
if (P.has('px')) camera.position.set(num('px', 0), num('py', 2), num('pz', 10));
else {
  const az = num('az', 35) * Math.PI / 180, el = num('el', 15) * Math.PI / 180, d = num('dist', 12);
  camera.position.set(tgt.x + Math.sin(az) * Math.cos(el) * d, tgt.y + Math.sin(el) * d, tgt.z + Math.cos(az) * Math.cos(el) * d);
}
camera.lookAt(tgt);
const t0 = performance.now();
if (P.has('nogable')) window.__noGable = true;
const mod = await import(/* @vite-ignore */ P.get('mod'));
const args = P.has('args') ? JSON.parse(P.get('args')) : [];
let res = await mod[P.get('fn')](...args, { renderer, scene, camera, sun, hemi });
const obj = res?.isObject3D ? res : res?.root;
if (obj && !obj.parent) scene.add(obj);
const buildMs = performance.now() - t0;
const shadowCenter = P.has('scx') ? new THREE.Vector3(num('scx', 0), 0, num('scz', 0)) : tgt;
let calls = 0, tris = 0;
window.__frame = (t = 0) => {
  if (res?.update) res.update(1 / 30, t);
  sky.position.copy(camera.position); sky.material.uniforms.time.value = t; sky.material.uniforms.sunDir.value.copy(SUN_DIR);
  flare.position.copy(camera.position).addScaledVector(SUN_DIR, 2000);
  updateSun(sun, shadowCenter); camera.updateMatrixWorld(); updateFogView(camera);
  renderer.render(scene, camera);
  calls = renderer.info.render.calls; tris = renderer.info.render.triangles;
};
window.__frame(0);
window.__info = () => ({ buildMs: Math.round(buildMs), calls, tris, extra: res?.info });
window.__ready = true;
