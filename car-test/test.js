import * as THREE from 'three';
import { patchFog, createSky, createEnvironment, createLights, updateSun, updateFogView, FOG_AWAY } from '/src/atmosphere.js';
import { initMaterials, MAT, buildSUV, buildCivilian, buildTanker, buildPickup, buildSedan, addBulletHole } from '/src/vehicles.js';
import { Gunman } from '/src/characters.js';

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
const camera = new THREE.PerspectiveCamera(70, W / H, 0.05, 3000);
scene.environment = createEnvironment(renderer); scene.environmentIntensity = 0.8;
scene.add(createSky());
const { sun } = createLights(scene, 2048);
initMaterials();
const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.92 }));
road.rotation.x = -Math.PI / 2; road.receiveShadow = true; scene.add(road);
const dashM = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.7 });
for (let z = -300; z < 300; z += 12) for (const x of [-3.7, 0 - 1.85 + 1.85, 3.7, 7.4]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3), dashM); d.rotation.x = -Math.PI / 2; d.position.set(x - 1.85, 0.005, z); scene.add(d); }

const objs = [];
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
function make(type) {
  if (type === 'suv') return buildSUV();
  if (type === 'tanker') return buildTanker();
  if (type === 'pickup') return buildPickup();
  if (type.startsWith('civ')) { const st = +type[3]; return buildCivilian(MAT.civ[+(type[5] ?? st)], st); }
}
let G = 1;
window.__api = {
  setup(list) {
    for (const o of objs) scene.remove(o.root); objs.length = 0;
    for (const [type, x, z, yaw = 0, opts = {}] of list) {
      const m = make(type); m.root.position.set(x, 0, z); m.root.rotation.y = yaw; scene.add(m.root);
      if (opts.gunmen) for (const [s, L] of Object.entries({ L: [-0.98, 1.0, 0.95], R: [0.98, 1.0, 0.95], roof: [0, 1.45, 0.2] })) {
        const gm = new Gunman({ pose: s === 'roof' ? 'roof' : 'window', side: s === 'L' ? -1 : s === 'R' ? 1 : 0, seed: G++ });
        gm.root.position.set(...L); m.root.add(gm.root);
      }
      if (opts.flip) { m.root.rotation.z = Math.PI; m.root.position.y = (m.half ? m.half.y * 2 : 2) + 0.02; }
      if (opts.cracked) m.mesh.material[1] = MAT.glassCracked;
      if (opts.charred) { const c = m.mesh.material; c[0] = c[1] = c[2] = MAT.charred; c[4] = c[5] = MAT.plastic; if (m.decal) m.decal.visible = false; }
      objs.push(m);
    }
    return 'ok';
  },
  cam(p, look, fov = 70) { camera.position.set(...p); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(new THREE.Vector3(...look)); camera.updateMatrixWorld(); },
  render() { updateSun(sun, camera.position); updateFogView(camera); renderer.render(scene, camera); return renderer.info.render.calls; },
  stats() {
    const out = {};
    for (const t of ['suv', 'civ0', 'civ1', 'civ2', 'tanker', 'pickup']) {
      const m = make(t);
      out[t] = { body: tris(m.mesh.geometry), groups: m.mesh.geometry.groups.length, wheel: tris(m.wheels[0].geometry), nWheels: m.wheels.length, decal: m.decal ? tris(m.decal.geometry) : 0, total: tris(m.mesh.geometry) + m.wheels.length * tris(m.wheels[0].geometry) + (m.decal ? tris(m.decal.geometry) : 0), driver: m.driver ? tris(m.driver.children[0].geometry) : 0, half: m.half?.toArray() };
    }
    return out;
  },
  holes(i, list) { const m = objs[i]; for (const [p, n] of list) addBulletHole(m, new THREE.Vector3(...p), new THREE.Vector3(...n)); return m.holeN; },
  sedanStyles() { return MAT.civ.map(p => buildSedan(p).mesh.geometry.groups.length + ':' + buildSedan(p).half.toArray().map(v=>v.toFixed(2)).join('/')); },
  verts() { const out = {}; for (const t of ['suv','civ0','tanker','pickup']) { const m = make(t); out[t] = m.mesh.geometry.attributes.position.count + ' v / ' + tris(m.mesh.geometry) + ' t; wheel ' + m.wheels[0].geometry.attributes.position.count + ' v'; } return out; },
  scene, THREE, objs,
};
window.__ready = true;
