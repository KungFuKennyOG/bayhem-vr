import * as THREE from 'three';
import * as G from '/src/levels/airport-no-return/gse.js';
export function lineup() {
  const mats = G.gseMaterials(), root = new THREE.Group();
  const list = [[G.buildJeep(), 0], [G.buildRefueler(), 6], [G.buildTug(), 12], [G.buildCart(3), 15.5], [G.buildULD(), 19], [G.buildStairTruck(), 23.5], [G.buildBeltLoader(), 28], [G.buildGPU(), 31.5], [G.buildCone(), 34], [G.buildSign(1), 37]];
  for (const [b, x] of list) {
    const m = new THREE.Mesh(b.geometry, mats); m.position.set(x, 0, 0); m.castShadow = m.receiveShadow = true; root.add(m);
    if (b.driver) { const d = new THREE.Mesh(b.driver, mats); d.position.copy(b.driverPos); m.add(d); }
  }
  return { root };
}
