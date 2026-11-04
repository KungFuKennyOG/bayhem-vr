import * as THREE from 'three';
import { patchFog, createSky, createEnvironment, createLights, updateSun, updateFogView, FOG_AWAY } from '/src/atmosphere.js';
import { buildAtlas } from '/src/particles.js';
import { World } from '/src/world.js';
import { initMaterials } from '/src/vehicles.js';
patchFog();
await Promise.all([document.fonts.load('400 64px Anton'), document.fonts.load('700 64px Oswald')]).catch(() => {});
const W = 960, H = 540;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_AWAY.clone(), 25, 520);
const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 3000);
scene.environment = createEnvironment(renderer); scene.environmentIntensity = 0.8;
const sky = createSky(); scene.add(sky);
const { sun } = createLights(scene, 2048);
initMaterials();
const t0 = performance.now();
const world = new World(scene, renderer, buildAtlas(renderer), scene.fog, 'high');
const buildMs = performance.now() - t0;
world.update(0, new THREE.Vector3());
window.__api = {
  buildMs: () => buildMs,
  cam(p, look, fov = 60) { camera.position.set(...p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(new THREE.Vector3(...look)); camera.updateMatrixWorld(); sky.position.copy(camera.position); },
  scroll(dz) { world.update(dz, new THREE.Vector3()); },
  render() { updateSun(sun, new THREE.Vector3(camera.position.x, 0, camera.position.z)); updateFogView(camera); renderer.render(scene, camera); return renderer.info.render.calls + ' calls ' + renderer.info.render.triangles + ' tris'; },
  bld() { const out = []; for (const s of world.scrollers) if (s.mesh.material === world.buildingMat) for (const it of s.items) out.push([+(it.data.x).toFixed(1), +(it.z + (it.data.dz || 0)).toFixed(1)]); return out.filter(p => p[0] > 0 && Math.abs(p[1]) < 120).slice(0, 12); },
  tris() { let n = 0; for (const s of world.scrollers) if (s.mesh.material === world.buildingMat) n += s.mesh.geometry.attributes.position.count / 3 * s.mesh.count; return n; },
};
window.__ready = true;
