import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Gun, VR_HOLD, buildMinigun } from '../../weapons.js';
import { clamp, damp } from '../../rng.js';

// =====================================================================================
//  THE MINIGUN — an M134-class six-barrel minigun carried in your right hand (Bay rules:
//  nobody mounts it). Replaces the right-hand rifle: the shared Gun state machine runs it
//  (fire rate, "mag" = belt between cool-downs, haptics, casings) and the Player puts it in
//  your hand like any rifle. The belt runs from an ammo can on the floor up a feed chute to
//  the gun. The barrels spin up before the first round, glow with heat, and a long burst
//  forces a cool-down. Can frame = the rig (your seat): -z out of the door, +x toward the nose.
// =====================================================================================

export const MOUNT = new THREE.Vector3(0.38, 1.08, -0.66); // the can's frame, rig-local (floor = -MOUNT.y)

function part(list, geo, col, k = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.attributes.position.count, c = new Float32Array(n * 3), kk = new Float32Array(n);
  for (let i = 0; i < n; i++) { c.set(col, i * 3); kk[i] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aK', new THREE.BufferAttribute(kk, 1));
  if (g.attributes.uv) g.deleteAttribute('uv');
  list.push(g);
}
// bevelled boxes: a hard box edge at arm's length aliases and reads as Lego
const B = (w, h, d, x, y, z) => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.22).translate(x, y, z);
const Cz = (r, len, x, y, z, seg = 12, r2 = r) => new THREE.CylinderGeometry(r2, r, len, seg).rotateX(Math.PI / 2).translate(x, y, z);

const GUNMETAL = [0.045, 0.048, 0.055], PARK = [0.055, 0.058, 0.062], WORN = [0.085, 0.088, 0.095], RUB = [0.02, 0.02, 0.02], OD = [0.12, 0.13, 0.08], REDB = [0.5, 0.05, 0.03], BRASS = [0.55, 0.38, 0.12];

function gunMaterial(heatU) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.35, envMapIntensity: 0.35 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uHeat = heatU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aK; varying float vK; varying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvK = aK; vObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uHeat; varying float vK; varying vec3 vObj;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (vK > 1.5) roughnessFactor = 0.85;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (vK > 1.5) metalnessFactor = 0.0;')
      // barrels (k = 1) glow from the muzzle back as they heat up
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (vK > 0.5 && vK < 1.5) { float t = clamp((-vObj.z - 0.3) / 0.5, 0.0, 1.0); totalEmissiveRadiance += vec3(1.0, 0.28, 0.05) * pow(uHeat, 2.0) * t * 2.5; }');
  };
  m.customProgramCacheKey = () => 'doorgun';
  return m;
}

function buildCan(mat) {
  // the ammo can on the floor beside you: the belt runs up the chute to the gun in your hand
  const L = [];
  part(L, B(0.32, 0.36, 0.5, 0.3, -0.9, 0.78), OD, 2);
  part(L, B(0.33, 0.04, 0.51, 0.3, -0.71, 0.78), [0.08, 0.09, 0.06], 2);
  part(L, B(0.1, 0.03, 0.04, 0.3, -0.69, 0.78), WORN);
  part(L, B(0.004, 0.08, 0.2, 0.462, -0.88, 0.78), [0.45, 0.4, 0.2], 2);
  return new THREE.Mesh(mergeGeometries(L), mat);
}

export class DoorGun {
  constructor(game, player, seat, camera) {
    this.g = game; this.player = player; this.camera = camera;
    this.heatU = { value: 0 };
    const mat = gunMaterial(this.heatU);
    this.mat = mat;
    this.mount = new THREE.Group(); this.mount.position.copy(MOUNT); seat.add(this.mount);
    this.mount.add(buildCan(mat));
    // the minigun model: built with the shared weapon kit (same bake, materials and gloved hand as the launcher)
    const M = buildMinigun();
    M.group.scale.setScalar(0.86); // a touch smaller than true scale: it was filling a quarter of the view
    const model = M;
    this.gun = new Gun(model, { rpm: 1500, mag: 320, reload: 2.4, auto: true });
    this.M = M; this.spinG = M.spin;
    // feed chute: segments between the feeder (in your hand) and the can (fixed), one instanced draw
    this.chuteN = 16;
    this.chute = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.02, 1), new THREE.MeshStandardMaterial({ color: 0x1e211a, roughness: 0.55, metalness: 0.4 }), this.chuteN);
    this.chute.frustumCulled = false; this.mount.add(this.chute);
    this.feed = M.feed;
    this.canPt = new THREE.Vector3(0.3, -0.68, 0.62); // the can sits on the floor at your right hip, behind the gun
    // spent brass piling up on the floor round the mount while you fire (one instanced draw)
    this.brassN = 420; this.brassShown = 0;
    const cg = new THREE.CylinderGeometry(0.0055, 0.0055, 0.051, 6); cg.rotateZ(Math.PI / 2);
    this.brass = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0xb08a3c, roughness: 0.35, metalness: 0.9 }), this.brassN);
    this.brass.count = 0; this.brass.frustumCulled = false;
    { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), r = (a) => (Math.sin(a * 12.9898) * 43758.5453) % 1;
      for (let i = 0; i < this.brassN; i++) {
        const a = Math.abs(r(i + 1)) * Math.PI * 2, rr = Math.sqrt(Math.abs(r(i + 7))) * 0.55;
        e.set(0, Math.abs(r(i + 3)) * 6.28, 0); q.setFromEuler(e);
        m.compose(new THREE.Vector3(0.05 + Math.cos(a) * rr * 0.8, -MOUNT.y + 0.006 + (i > 200 ? 0.01 * Math.abs(r(i + 11)) : 0), 0.15 + Math.sin(a) * rr), q, new THREE.Vector3(1, 1, 1));
        this.brass.setMatrixAt(i, m);
      } }
    this.mount.add(this.brass);
    this.spin = 0; this.heat = 0; this.cooling = false;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._m = new THREE.Matrix4();
    // replace the rifle
    const old = player.rifle;
    old.holder.removeFromParent();
    player.rifle = this.gun;
    camera.add(this.gun.holder); // desktop: the Player places and aims it like the rifle
    this._old = old;
  }
  // VR: the right controller carries the gun (also when it connected before this level loaded)
  aim() {
    const P = this.player;
    if (P.mode !== 'vr') return;
    for (const c of P.controllers) {
      if (c.hand !== 'right') continue;
      if (c.gun !== this.gun) {
        if (c.gun) c.gun.holder.removeFromParent();
        c.gun = this.gun;
        this.gun.holder.position.fromArray(VR_HOLD.rifle.position);
        this.gun.holder.rotation.set(...VR_HOLD.rifle.rotation);
      }
      if (this.gun.holder.parent !== c.space) c.space.add(this.gun.holder);
    }
  }
  // after player.update: spin, heat, chute, sound
  update(rdt, dt) {
    const G = this.gun, P = this.player;
    // (the autopilot keeps the barrels turning while it has a live target, like a gunner riding the trigger)
    const tk = P.auto && P.autoState.target ? P.autoState.target.kind : null;
    const trig = P.inputs.fireR || (P.auto && G.sinceShot < 0.1) || (tk && tk !== 'look' && tk !== 'paint');
    // spin-up: the first rounds wait for the barrels
    const want = trig && !this.cooling ? 1 : 0;
    this.spin = damp(this.spin, want, want ? 6 : 1.6, rdt);
    if (trig && this.spin < 0.55) G.cool = Math.max(G.cool, 0.03);
    this.spinG.rotation.z += rdt * this.spin * 95;
    // heat: rises with each round, the belt runs out = forced cool-down
    if (G.sinceShot < 0.001) { this.heat = Math.min(1, this.heat + 1 / 300); this.fired = (this.fired || 0) + 1; this.brass.count = Math.min(this.brassN, Math.floor(this.fired / 3)); }
    this.heat = Math.max(0, this.heat - rdt * (G.reloading > 0 ? 0.42 : 0.12));
    this.cooling = G.reloading > 0;
    this.heatU.value = this.heat;
    // feed chute
    this.mount.updateMatrixWorld(true);
    const a = this.feed.getWorldPosition(new THREE.Vector3());
    this.mount.worldToLocal(a);
    const b = this.canPt;
    const m = this._m, q = new THREE.Quaternion(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), dv = new THREE.Vector3();
    // the belt hangs straight down from the feeder, then runs back along the floor to the can (a quadratic
    // curve through a point under the gun): it stays under the gun instead of cutting across the view
    const c = this._c || (this._c = new THREE.Vector3()); c.set(a.x, b.y - 0.05, a.z + 0.05);
    const pt = (t, out) => { const u = 1 - t; return out.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z); };
    for (let i = 0; i < this.chuteN; i++) {
      pt(i / this.chuteN, p0); pt((i + 1) / this.chuteN, p1);
      dv.subVectors(p1, p0); const L = dv.length(); q.setFromUnitVectors(Z, dv.normalize());
      m.compose(p0.add(p1).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, L * 1.05));
      this.chute.setMatrixAt(i, m);
    }
    this.chute.instanceMatrix.needsUpdate = true;
    // sound: the motor whine + the buzz (one loop; intensity = spin, rate climbs with it)
    const fire = G.sinceShot < 0.08;
    if (this.spin > 0.02) this.g.audio.setLoop('minigun_spin', { intensity: this.spin, volume: 0.35 * this.spin });
    else this.g.audio.stopLoop('minigun_spin');
    if (fire) this.g.audio.setLoop('minigun', { intensity: 1, volume: 0.9 }); else this.g.audio.stopLoop('minigun');
    // vibration on the desktop view: tiny camera shake while firing
    if (fire) P.shake = Math.min(0.6, P.shake + rdt * 2.2);
  }
  ammoText() {
    const G = this.gun;
    if (G.reloading > 0) return 'COOLING';
    return `GUN ${Math.round(this.heat * 100)}% HEAT`;
  }
  warmMaterials() { return [this.mat, this.chute.material, this.brass.material, this.M.mesh.material]; }
}
