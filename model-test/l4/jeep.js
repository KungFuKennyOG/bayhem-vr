import * as THREE from 'three';
import * as G from '/src/levels/airport-no-return/gse.js';
import { initMaterials } from '/src/vehicles.js';
export function jeep() { initMaterials(); const mats = G.gseMaterials(), b = G.buildJeep(), root = new THREE.Group(); const m = new THREE.Mesh(b.geometry, mats); m.castShadow = m.receiveShadow = true; root.add(m); const d = new THREE.Mesh(b.driver, mats); d.position.copy(b.driverPos); root.add(d); return { root }; }
