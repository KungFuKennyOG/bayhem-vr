import * as THREE from 'three';
import { box, at, cyl, mergeGrouped } from './geom.js';
import { MAT } from './vehicles.js';

// Attack helicopter. Forward = -z. Origin at fuselage center.
export function buildHeli() {
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a4f42, metalness: 0.45, roughness: 0.38, envMapIntensity: 1.8 });
  const darker = new THREE.MeshStandardMaterial({ color: 0x24261f, metalness: 0.55, roughness: 0.45, envMapIntensity: 1.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1418, metalness: 0.95, roughness: 0.05, envMapIntensity: 2.2 });
  const p = [];
  // fuselage: lathe profile along z
  const prof = [];
  const L = 9.0;
  const rad = (t) => { // t 0 (nose) .. 1 (tail start)
    if (t < 0.15) return 0.35 + Math.sqrt(t / 0.15) * 0.75;
    if (t < 0.6) return 1.1;
    return 1.1 - (t - 0.6) / 0.4 * 0.75;
  };
  for (let i = 0; i <= 20; i++) { const t = i / 20; prof.push(new THREE.Vector2(rad(t), t * L)); }
  const fus = new THREE.LatheGeometry(prof, 16);
  fus.rotateX(Math.PI / 2); // y-axis -> z
  fus.translate(0, 0, -L * 0.55);
  fus.scale(0.85, 1.0, 1.0);
  p.push([fus, 0]);
  // tail boom
  p.push([at(cyl(0.22, 0.4, 6.5, 10), 0, 0.35, 6.8, Math.PI / 2, 0, 0), 0]);
  // tail fin + rotor housing
  p.push([at(box(0.12, 2.4, 1.3), 0, 1.4, 9.9, -0.25, 0, 0), 0]);
  p.push([at(box(3.0, 0.1, 0.8), 0, 0.45, 9.4), 0]);
  // cockpit canopies (tandem)
  const can = new THREE.SphereGeometry(0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  can.scale(0.85, 0.75, 1.6);
  p.push([at(can.clone(), 0, 0.55, -3.0), 2]);
  p.push([at(can, 0, 0.8, -1.4), 2]);
  // engine nacelles + exhausts
  for (const sx of [-1, 1]) {
    p.push([at(cyl(0.38, 0.42, 2.6, 12), sx * 0.75, 1.05, 0.6, Math.PI / 2, 0, 0), 0]);
    p.push([at(cyl(0.3, 0.3, 0.5, 10), sx * 0.95, 1.1, 2.0, Math.PI / 2 + 0.3, 0, 0), 1]);
    // stub wings + rocket pods
    p.push([at(box(2.2, 0.12, 0.9), sx * 1.8, 0.0, -0.3, 0, 0, sx * -0.08), 0]);
    p.push([at(cyl(0.28, 0.28, 1.5, 12), sx * 2.6, -0.32, -0.4, Math.PI / 2, 0, 0), 1]);
    p.push([at(cyl(0.18, 0.18, 1.2, 10), sx * 1.7, -0.3, -0.3, Math.PI / 2, 0, 0), 1]);
    // landing gear
    p.push([at(box(0.1, 0.8, 0.1), sx * 0.8, -1.2, -1.5), 1]);
    p.push([at(cyl(0.25, 0.25, 0.18, 12), sx * 0.85, -1.6, -1.5, 0, 0, Math.PI / 2), 1]);
  }
  // chin gun turret
  p.push([at(new THREE.SphereGeometry(0.3, 12, 8), 0, -0.75, -3.8), 1]);
  p.push([at(cyl(0.05, 0.05, 1.2, 8), 0, -0.8, -4.5, Math.PI / 2, 0, 0), 1]);
  // rotor mast
  p.push([at(cyl(0.18, 0.22, 0.9, 10), 0, 1.6, -0.2), 1]);
  // searchlight
  p.push([at(cyl(0.14, 0.18, 0.25, 10), 0.5, -0.95, -2.8, Math.PI / 2, 0, 0), 1]);
  const { geometry } = mergeGrouped(p, 3);
  const body = new THREE.Mesh(geometry, [dark, darker, glass]);
  body.castShadow = true;
  const root = new THREE.Group();
  const tilt = new THREE.Group(); // banking/pitch
  root.add(tilt); tilt.add(body);
  // main rotor: blades + translucent blur disc
  const rotor = new THREE.Group(); rotor.position.set(0, 2.08, -0.2);
  const bladeGeo = box(7.2, 0.05, 0.42); bladeGeo.translate(3.6, 0, 0);
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(bladeGeo, darker); b.rotation.y = (k / 4) * Math.PI * 2; b.castShadow = true; rotor.add(b); }
  const dc = document.createElement('canvas'); dc.width = dc.height = 256; const dx = dc.getContext('2d');
  const dg = dx.createRadialGradient(128, 128, 10, 128, 128, 128); dg.addColorStop(0, 'rgba(20,22,16,0)'); dg.addColorStop(0.6, 'rgba(20,22,16,0.10)'); dg.addColorStop(0.93, 'rgba(20,22,16,0.16)'); dg.addColorStop(1, 'rgba(20,22,16,0)');
  dx.fillStyle = dg; dx.fillRect(0, 0, 256, 256);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(7.4, 40), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dc), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2; rotor.add(disc);
  tilt.add(rotor);
  const tailRotor = new THREE.Group(); tailRotor.position.set(0.2, 1.7, 10.2);
  for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(box(0.06, 2.0, 0.2), darker); b.rotation.x = k * Math.PI / 2; tailRotor.add(b); }
  tilt.add(tailRotor);
  // hardpoints for rockets and gun
  const pods = [new THREE.Object3D(), new THREE.Object3D()];
  pods[0].position.set(-2.6, -0.32, -1.3); pods[1].position.set(2.6, -0.32, -1.3);
  pods.forEach(p => tilt.add(p));
  const gun = new THREE.Object3D(); gun.position.set(0, -0.8, -5.1); tilt.add(gun);
  const smokePt = new THREE.Object3D(); smokePt.position.set(0.9, 1.2, 2.2); tilt.add(smokePt);
  const lightPt = new THREE.Object3D(); lightPt.position.set(0.5, -1.0, -3.0); tilt.add(lightPt);
  // nav lights: red port, green starboard, white tail strobe (blinks)
  const navLights = [];
  for (const [x, y, z, col] of [[-3.3, 0.0, -0.3, [3, 0.2, 0.1, 0]], [3.3, 0.0, -0.3, [0.2, 3, 0.4, 0]], [0, 2.7, 10.2, [3, 3, 3, 1]], [0, -1.1, 0.5, [3, 0.3, 0.1, 1]]]) {
    const o = new THREE.Object3D(); o.position.set(x, y, z); tilt.add(o); navLights.push([o, col]);
  }
  // searchlight cone (additive, gradient)
  const cc = document.createElement('canvas'); cc.width = 8; cc.height = 128; const cx = cc.getContext('2d');
  const cg = cx.createLinearGradient(0, 0, 0, 128); cg.addColorStop(0, 'rgba(255,240,210,0.0)'); cg.addColorStop(0.1, 'rgba(255,240,210,0.55)'); cg.addColorStop(1, 'rgba(255,240,210,0)');
  cx.fillStyle = cg; cx.fillRect(0, 0, 8, 128);
  const coneGeo = new THREE.CylinderGeometry(0.2, 5.5, 34, 20, 1, true); coneGeo.translate(0, -17, 0);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.35, fog: false, toneMapped: false }));
  cone.position.copy(lightPt.position); cone.rotation.x = 0.75;
  tilt.add(cone);
  return { root, tilt, body, navLights, cone, rotor, tailRotor, pods, gun, smokePt, lightPt, half: new THREE.Vector3(1.3, 1.3, 5.6), center: new THREE.Vector3(0, 0, 0.5) };
}
