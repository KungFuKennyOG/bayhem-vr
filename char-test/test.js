import * as THREE from 'three';
import { patchFog, createSky, createEnvironment, createLights, updateSun, updateFogView, FOG_AWAY } from '/src/atmosphere.js';
import { initMaterials, buildSUV } from '/src/vehicles.js';
import { Gunman } from '/src/characters.js';

patchFog();
const W = 960, H = 540;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_AWAY.clone(), 25, 520);
const camera = new THREE.PerspectiveCamera(70, W / H, 0.05, 3000);
scene.environment = createEnvironment(renderer); scene.environmentIntensity = 0.8;
scene.add(createSky());
const { sun } = createLights(scene, 2048);
initMaterials();
// road
const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.92 }));
road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
const dashM = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.7 });
for (let z = -200; z < 200; z += 12) for (const x of [-1.85, 1.85, 5.55]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3), dashM); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.005, z); scene.add(d); }

const SLOTS = { L: [-0.98, 1.0, 0.95], R: [0.98, 1.0, 0.95], roof: [0, 1.45, 0.2] };
const cars = [];
function addCar(x, z, seed0, yaw = 0) {
  const m = buildSUV(); m.root.position.set(x, 0, z); m.root.rotation.y = yaw; scene.add(m.root);
  const gms = [];
  let k = 0;
  for (const [s, L] of Object.entries(SLOTS)) {
    const gm = new Gunman({ pose: s === 'roof' ? 'roof' : 'window', side: s === 'L' ? -1 : s === 'R' ? 1 : 0, seed: seed0 + k++ });
    gm.root.position.set(...L); m.root.add(gm.root); gms.push(gm);
  }
  const car = { m, gms, vel: new THREE.Vector3() }; cars.push(car); return car;
}
const ragdolls = [];
const target = new THREE.Vector3();
let G = 31;
window.__api = {
  setup(opts = {}) {
    for (const c of cars) scene.remove(c.m.root);
    cars.length = 0;
    for (const r of ragdolls) r.dispose(); ragdolls.length = 0;
    for (const c of opts.cars || [[0, 0, 1]]) addCar(...c);
    return 'ok';
  },
  solo(list) { // [[seed, headgear, x, z]] standing on the road, roof pose with the pelvis at standing height
    const car = { m: { root: new THREE.Group() }, gms: [], vel: new THREE.Vector3() };
    scene.add(car.m.root);
    for (const [seed, hg, x, z] of list) {
      const gm = new Gunman({ pose: 'roof', seed, headgear: hg, hipOffset: new THREE.Vector3(0, 0.97, 0) });
      gm.root.position.set(x, 0, z); car.m.root.add(gm.root); car.gms.push(gm);
    }
    cars.push(car); return 'ok';
  },
  camRag(i, off, fov = 55) { const p = ragdolls[i].position; camera.position.set(p.x + off[0], Math.max(0.3, p.y + off[1]), p.z + off[2]); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(p); camera.updateMatrixWorld(); return p.toArray().map(v => +v.toFixed(2)); },
  cam(p, look, fov = 70) { camera.position.set(...p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(new THREE.Vector3(...look)); camera.updateMatrixWorld(); },
  target(p) { target.set(...p); },
  live(n, dt = 1 / 60, fire = false) {
    for (let i = 0; i < n; i++) for (const c of cars) for (const g of c.gms) if (!g.dead) { g.update(dt, target); if (fire && i % 7 === 0 && g.canFire) g.fire(); }
  },
  kill(ci, gi, dir = [0, 0.3, -1], power = 1) {
    const g = cars[ci].gms[gi];
    const rd = g.die(cars[ci].vel, new THREE.Vector3(...dir), scene, power); ragdolls.push(rd); return true;
  },
  hit(ci, gi, dir) { cars[ci].gms[gi].hit(new THREE.Vector3(...dir)); },
  rag(n, dt = 1 / 60) { let imp = 0; for (let i = 0; i < n; i++) for (const r of ragdolls) { r.update(dt, G); imp = Math.max(imp, r.impact); } return { imp, pos: ragdolls.map(r => r.position.toArray().map(v => +v.toFixed(2))), done: ragdolls.map(r => r.done) }; },
  info() { return cars.map(c => c.gms.map(g => ({ dead: g.dead, canFire: g.canFire, aimable: g.aimable, reload: g.reloading, kind: g.kind, mz: g.muzzle.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)), head: g.headCenter.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)) }))); },
  render() {
    updateSun(sun, camera.position);
    updateFogView(camera);
    renderer.render(scene, camera);
    return renderer.info.render.calls;
  },
  stats() { const g = cars[0]?.gms[0]; return g ? { verts: g.mesh.geometry.attributes.position.count, tris: g.mesh.geometry.index.count / 3, bones: g.mesh.skeleton.bones.length } : null; },
  scene, THREE, cars, ragdolls,
};
window.__ready = true;
