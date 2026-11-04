import * as THREE from 'three';
import { patchFog, createSky, createEnvironment, createLights, updateSun, updateFogView, FOG_AWAY, SUN_DIR } from '/src/atmosphere.js';
import { initMaterials, buildSUV, buildPickup } from '/src/vehicles.js';
import * as C from '/src/characters.js';

patchFog();
const W = 960, H = 540;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(FOG_AWAY.clone(), 25, 520);
const camera = new THREE.PerspectiveCamera(70, W / H, 0.03, 3000);
scene.environment = createEnvironment(renderer); scene.environmentIntensity = 0.8;
scene.add(createSky());
const { sun } = createLights(scene, 2048);
initMaterials();
const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.92 }));
road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
const dashM = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.7 });
for (let z = -200; z < 200; z += 12) for (const x of [-1.85, 1.85, 5.55]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3), dashM); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.005, z); scene.add(d); }

const world = new THREE.Group(); scene.add(world);
const gms = [], ragdolls = [], cars = [];
let pickup = null, driver = null;
const target = new THREE.Vector3(0, 1.6, 12);
const st = { steer: 0, bump: 0, talking: false, lookBack: 0, flinch: 0, time: 0 };
const SLOTS = { L: [-0.98, 1.0, 0.95], R: [0.98, 1.0, 0.95], roof: [0, 1.45, 0.2] };

window.__api = {
  clear() { for (const g of gms) g.dispose(); gms.length = 0; for (const r of ragdolls) r.dispose(); ragdolls.length = 0; world.clear(); cars.length = 0; pickup = null; driver = null; return 'ok'; },
  pickup(oldDriver = false) {
    pickup = buildPickup(); world.add(pickup.root);
    pickup.driver.visible = oldDriver;
    if (!oldDriver && C.Driver) { driver = new C.Driver({ seed: 3 }); driver.root.position.set(...C.DRIVER_SEAT.position); pickup.root.add(driver.root); }
    return 'ok';
  },
  driverSolo(x = 0, z = 0, yaw = 0) { driver = new C.Driver({ seed: 3 }); driver.root.position.set(x, 0.93, z); driver.root.rotation.y = yaw; world.add(driver.root); return 'ok'; },
  solo(list) { // [[seed, headgear, x, z, yaw]] standing
    for (const [seed, hg, x, z, yaw = 0] of list) {
      const gm = new C.Gunman({ pose: 'roof', seed, headgear: hg, hipOffset: new THREE.Vector3(0, 0.97, 0) });
      gm.root.position.set(x, 0, z); gm.root.rotation.y = yaw; world.add(gm.root); gms.push(gm);
    }
    return 'ok';
  },
  suv(x, z, seed0 = 5, slots = ['L', 'R', 'roof'], yaw = 0) {
    const m = buildSUV(); m.root.position.set(x, 0, z); m.root.rotation.y = yaw; world.add(m.root); cars.push(m);
    let k = 0;
    for (const s of slots) {
      const gm = new C.Gunman({ pose: s === 'roof' ? 'roof' : 'window', side: s === 'L' ? -1 : s === 'R' ? 1 : 0, seed: seed0 + k++ });
      gm.root.position.set(...SLOTS[s]); m.root.add(gm.root); gms.push(gm);
    }
    return 'ok';
  },
  cam(p, look, fov = 70) { camera.position.set(...p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(new THREE.Vector3(...look)); camera.updateMatrixWorld(); return 'ok'; },
  camRag(i, off, fov = 55) { const p = ragdolls[i].position; camera.position.set(p.x + off[0], Math.max(0.3, p.y + off[1]), p.z + off[2]); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(p); return p.toArray().map(v => +v.toFixed(2)); },
  target(p) { target.set(...p); return 'ok'; },
  state(o) { Object.assign(st, o); return 'ok'; },
  live(n, dt = 1 / 30) {
    for (let i = 0; i < n; i++) {
      st.time += dt;
      for (const g of gms) if (!g.dead) g.update(dt, target);
      if (driver) driver.update(dt, st);
    }
    return 'ok';
  },
  kill(i, dir = [0, 0.3, -1], power = 1) { const rd = gms[i].die(new THREE.Vector3(0, 0, 0), new THREE.Vector3(...dir), scene, power); ragdolls.push(rd); return 'ok'; },
  rag(n, dt = 1 / 60, G = 0) { for (let i = 0; i < n; i++) for (const r of ragdolls) r.update(dt, G); return ragdolls.map(r => r.position.toArray().map(v => +v.toFixed(2))); },
  sunBehind(on) { // move the sun so it's behind the subject relative to the camera (only affects light dir)
    return 'ok';
  },
  render() { updateSun(sun, camera.position); updateFogView(camera); renderer.render(scene, camera); return renderer.info.render.calls; },
  stats() {
    const out = {};
    for (const g of gms.slice(0, 3)) out['gm' + g.kind] = { verts: g.mesh.geometry.attributes.position.count, tris: g.mesh.geometry.index.count / 3 };
    if (driver) { const m = driver.mesh; out.driver = { verts: m.geometry.attributes.position.count, tris: m.geometry.index.count / 3 }; }
    return out;
  },
  get driver() { return driver; }, get pickupObj() { return pickup; },
  scene, THREE, C, gms, ragdolls, camera, sun,
};
window.__ready = true;
