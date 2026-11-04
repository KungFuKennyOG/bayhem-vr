// default (Level 3) taxi next to the Paris taxi / police / van: ?mod=/model-test/l5/cars.js&fn=carRow
import * as THREE from 'three';
import { buildCar } from '/src/levels/downtown-haven/cars.js';
export function carRow() {
  const root = new THREE.Group();
  const row = [['taxi', {}], ['taxi', { city: 'paris' }], ['police', { city: 'paris' }], ['van', { city: 'paris', paint: 0xe8e6e0 }], ['police', {}]];
  row.forEach(([t, o], i) => { const m = buildCar(t, { seed: 101 + i, shattered: false, hoodUp: false, trunkOpen: false, ...o }); m.root.position.set((i - 2) * 3.2, 0, 0); m.root.rotation.y = i === 3 ? 0.35 : Math.PI / 2; root.add(m.root); });
  // rear views of the Paris taxi (plate)
  const back = buildCar('taxi', { seed: 3, city: 'paris', shattered: false, hoodUp: false, trunkOpen: false }); back.root.position.set(-1.2, 0, -7); back.root.rotation.y = Math.PI * 0.85; root.add(back.root);
  return { root };
}
