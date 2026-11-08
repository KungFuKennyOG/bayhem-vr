import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Gun } from '../../weapons.js';
import { clamp, damp } from '../../rng.js';

// =====================================================================================
//  THE DOOR GUN — an M134-class six-barrel minigun on a pintle in HAMMER ONE's door.
//  Replaces the right-hand rifle: the shared Gun state machine still runs it (fire rate,
//  "mag" = belt between cool-downs, haptics, casings), but its model hangs off the mount,
//  not your hand. Aim: VR = where your right controller points (the gun swings to it with
//  a little weight, inside the door's arc); desktop = the crosshair. The barrels spin up
//  before the first round, glow with heat, and a long burst forces a cool-down.
//  Mount frame = the rig (your seat): -z out of the door, +x toward the nose, +y up.
// =====================================================================================

export const MOUNT = new THREE.Vector3(0.38, 1.08, -0.66); // pivot, rig-local
const LIM = { yaw: 1.25, up: 0.42, down: -1.05 };

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

function buildModel(mat) {
  // pitch frame: pivot at the trunnions, barrels along -z
  const body = [], spin = [];
  // receiver housing + rear cap + motor + feeder/delinker
  part(body, Cz(0.072, 0.27, 0, 0, -0.13, 16), GUNMETAL);
  part(body, Cz(0.076, 0.03, 0, 0, 0.015, 16), WORN);
  part(body, B(0.075, 0.085, 0.17, 0.088, 0.025, -0.09), PARK);
  part(body, Cz(0.035, 0.12, 0.088, 0.025, -0.2, 10), PARK);
  part(body, B(0.1, 0.1, 0.13, -0.105, -0.005, -0.075), PARK);
  part(body, B(0.06, 0.03, 0.09, -0.16, 0.0, -0.075), WORN);
  // cradle / yoke (trunnion plates) — moves with pitch
  for (const sx of [-1, 1]) { part(body, B(0.018, 0.1, 0.14, sx * 0.095, -0.01, 0.02), PARK); part(body, Cz(0.022, 0.03, sx * 0.105, 0, 0.0, 8).rotateY(Math.PI / 2), WORN); }
  // spade grips + thumb triggers at the back
  part(body, new THREE.CylinderGeometry(0.016, 0.016, 0.24, 10).rotateZ(Math.PI / 2).translate(0, 0.0, 0.14), PARK);
  for (const sx of [-1, 1]) {
    part(body, new THREE.CylinderGeometry(0.019, 0.019, 0.15, 10).translate(sx * 0.115, -0.01, 0.16), RUB, 2);
    part(body, B(0.03, 0.02, 0.05, sx * 0.115, 0.075, 0.15), PARK);
    part(body, B(0.012, 0.01, 0.012, sx * 0.1, 0.078, 0.13), [0.45, 0.25, 0.04], 2);
  }
  part(body, B(0.03, 0.03, 0.14, 0, -0.04, 0.08), PARK);
  // ring sight
  { const t = new THREE.TorusGeometry(0.035, 0.0035, 6, 20); t.translate(0, 0.115, -0.62); part(body, t, WORN); part(body, B(0.006, 0.04, 0.006, 0, 0.088, -0.62), WORN); part(body, B(0.01, 0.025, 0.01, 0, 0.09, -0.05), WORN); }
  // barrel cluster (spins about z)
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; part(spin, Cz(0.0105, 0.56, Math.cos(a) * 0.034, Math.sin(a) * 0.034, -0.52, 8), GUNMETAL, 1); }
  part(spin, Cz(0.052, 0.035, 0, 0, -0.775, 14), WORN);
  part(spin, Cz(0.05, 0.03, 0, 0, -0.5, 14), PARK);
  part(spin, Cz(0.04, 0.05, 0, 0, -0.265, 12), PARK);
  const group = new THREE.Group();
  const bm = new THREE.Mesh(mergeGeometries(body), mat); group.add(bm);
  const spinG = new THREE.Group(); spinG.add(new THREE.Mesh(mergeGeometries(spin), mat)); group.add(spinG);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, -0.8); group.add(muzzle);
  const port = new THREE.Object3D(); port.position.set(0, -0.07, -0.12); group.add(port);
  return { group, spinG, muzzle, port };
}

function buildYoke(mat) {
  // yaw frame: the pintle post + the U that carries the trunnions
  const L = [];
  part(L, new THREE.CylinderGeometry(0.03, 0.035, 0.52, 10).translate(0, -0.32, 0.0), PARK);
  part(L, new THREE.CylinderGeometry(0.022, 0.022, 0.22, 10).rotateZ(Math.PI / 2).translate(0, -0.065, 0.0), PARK);
  for (const sx of [-1, 1]) part(L, B(0.02, 0.07, 0.05, sx * 0.115, -0.03, 0.0), PARK);
  return new THREE.Mesh(mergeGeometries(L), mat);
}
function buildArm(mat) {
  // fixed: socket under the pivot, an arm to the door's front post, an ammo can on the floor
  const L = [];
  part(L, new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12).translate(0, -0.55, 0), PARK);
  part(L, B(0.06, 0.06, 0.66, 0, -0.6, 0.33).rotateY(0), PARK);
  part(L, B(0.18, 0.2, 0.08, 0, -0.6, 0.68), PARK);
  // ammo can (OD green), on the floor beside you
  part(L, B(0.32, 0.36, 0.5, -0.36, -0.92, 0.3), OD, 2);
  part(L, B(0.33, 0.04, 0.51, -0.36, -0.73, 0.3), [0.08, 0.09, 0.06], 2);
  part(L, B(0.1, 0.03, 0.04, -0.36, -0.71, 0.3), WORN);
  return new THREE.Mesh(mergeGeometries(L), mat);
}

// a simple gloved fist for the VR right hand (the rifle model, which carries the hand, is gone)
function buildGlove() {
  const L = [], G = [0.07, 0.06, 0.045], D = [0.04, 0.035, 0.028];
  part(L, B(0.085, 0.09, 0.1, 0, -0.01, 0.05), G, 2);
  for (let k = 0; k < 4; k++) part(L, B(0.02, 0.026, 0.07, -0.03 + k * 0.021, -0.045, 0.0).rotateX(0.6), G, 2);
  part(L, B(0.024, 0.024, 0.06, 0.045, 0.01, 0.02).rotateZ(-0.4), G, 2);
  part(L, B(0.09, 0.07, 0.08, 0, -0.01, 0.13), D, 2);
  const m = new THREE.Mesh(mergeGeometries(L), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  return m;
}

export class DoorGun {
  constructor(game, player, seat, camera) {
    this.g = game; this.player = player; this.camera = camera;
    this.heatU = { value: 0 };
    const mat = gunMaterial(this.heatU);
    this.mat = mat;
    this.mount = new THREE.Group(); this.mount.position.copy(MOUNT); seat.add(this.mount);
    this.mount.add(buildArm(mat));
    this.yawG = new THREE.Group(); this.yawG.scale.setScalar(0.88); this.mount.add(this.yawG);
    this.yawG.add(buildYoke(mat));
    this.pitchG = new THREE.Group(); this.yawG.add(this.pitchG);
    const M = buildModel(mat);
    // the shared Gun state machine, with this model; the model leaves Gun's holder for the mount
    const model = {
      group: M.group, muzzle: M.muzzle, port: M.port, kind: 'rifle', doorGun: true,
      setMode() {},
      animate: (s) => { M.group.position.set(0, 0, s.kick * 0.004); M.group.rotation.set(0, 0, 0); },
    };
    this.gun = new Gun(model, { rpm: 1500, mag: 320, reload: 2.4, auto: true });
    this.pitchG.add(M.group);
    this.spinG = M.spinG;
    // feed chute: segments between the feeder (moves) and the can (fixed), one instanced draw
    this.chuteN = 14;
    this.chute = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.05, 1), new THREE.MeshStandardMaterial({ color: 0x1a1c18, roughness: 0.6, metalness: 0.5 }), this.chuteN);
    this.chute.frustumCulled = false; this.mount.add(this.chute);
    this.feed = new THREE.Object3D(); this.feed.position.set(-0.16, 0.0, -0.075); M.group.add(this.feed);
    this.canPt = new THREE.Vector3(-0.36, -0.7, 0.18);
    this.glove = buildGlove();
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
    // aim state
    this.yaw = 0; this.pitch = -0.25; this.spin = 0; this.heat = 0; this.cooling = false;
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._m = new THREE.Matrix4();
    // replace the rifle
    const old = player.rifle;
    old.holder.removeFromParent();
    player.rifle = this.gun;
    camera.add(this.gun.holder); // empty: the Player positions it, nothing to see
  }
  // the hand the player aims with (VR) — re-attach the glove when the right controller connects
  _vrHand() {
    const c = this.player.controllers.find(e => e.hand === 'right');
    if (c && this.glove.parent !== c.space) { c.space.add(this.glove); this.glove.position.set(0, -0.02, 0.05); }
    return c?.space || null;
  }
  // before player.update: aim (so the muzzle is where the shot leaves from)
  aim(rdt) {
    const P = this.player, cam = this.camera;
    let dir;
    if (P.mode === 'vr') {
      const s = this._vrHand();
      if (s) { s.getWorldQuaternion(this._q); dir = this._v.set(0, 0, -1).applyQuaternion(this._q); }
    } else {
      cam.updateMatrixWorld();
      const p = this._v.set(0, 0, -260).applyMatrix4(cam.matrixWorld);
      this.mount.updateMatrixWorld();
      dir = p.sub(this.mount.getWorldPosition(new THREE.Vector3())).normalize();
    }
    if (dir) {
      // into mount-local space
      this.mount.getWorldQuaternion(this._q).invert();
      const d = dir.clone().applyQuaternion(this._q);
      let ty = Math.atan2(-d.x, -d.z), tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
      ty = clamp(ty, -LIM.yaw, LIM.yaw); tp = clamp(tp, LIM.down, LIM.up);
      // a heavy gun on a pintle: fast, but it doesn't teleport (desktop / capture follows exactly)
      const k = P.mode === 'vr' ? 22 : 60;
      this.yaw = damp(this.yaw, ty, k, rdt); this.pitch = damp(this.pitch, tp, k, rdt);
    }
    this.yawG.rotation.y = this.yaw;
    this.pitchG.rotation.x = this.pitch;
    this.mount.updateMatrixWorld(true);
  }
  // after player.update: spin, heat, chute, sound
  update(rdt, dt) {
    const G = this.gun, P = this.player;
    const trig = P.inputs.fireR;
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
    const pt = (t, out) => { out.lerpVectors(a, b, t); out.y -= Math.sin(t * Math.PI) * 0.16; out.x -= Math.sin(t * Math.PI) * 0.08; return out; };
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
  warmMaterials() { return [this.mat, this.chute.material, this.glove.material, this.brass.material]; }
}
