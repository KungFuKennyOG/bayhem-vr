import * as THREE from 'three';
import { SNIPERS } from './layout.js';

// PLACEHOLDER (being replaced by the full Haussmann build): loads, places itself, returns the contract.
export async function buildParis() {
  const root = new THREE.Group(); root.name = 'paris';
  const colliders = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0xcdbfa6, roughness: 0.85 });
  const add = (x0, x1, z0, z1, h) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat);
    g.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); root.add(g);
    colliders.push({ min: [x0, 0, Math.min(z0, z1)], max: [x1, h, Math.max(z0, z1)], data: { mat: 'concrete' } });
  };
  for (let x = -520; x < 520; x += 20) if (Math.abs(x + 10) > 24) add(x, x + 20, 78, 104, 22.2);
  for (let x = -520; x < 520; x += 20) if (Math.abs(x + 10) > 100) add(x, x + 20, -104, -78, 22.2);
  for (const s of [SNIPERS.n1, SNIPERS.n2]) colliders.push({ min: [s.x - 10, 19.2, 76.85], max: [s.x + 10, 20.25, 77.0], data: { mat: 'metal' } });
  return { root, colliders, anchors: { glows: [], reflect: [] }, info: { placeholder: true } };
}
