// LIGHTS OUT: nothing taller than 1.2 m may stand in the lanes the player walks (layout.LANES).
// Checks the abandoned cars and the low cover against them. usage: node tools/check-lanes.mjs
import { readFileSync } from 'node:fs';
// (the repo's package.json says commonjs, so load the ES module through a data: URL)
const src = readFileSync(new URL('../src/levels/lights-out/layout.js', import.meta.url), 'utf8');
const { LANES, CARS, COVER } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
const HALF = { sedan: [0.95, 2.4, 1.45], taxi: [0.95, 2.4, 1.6], police: [0.95, 2.4, 1.6], suv: [1.05, 2.5, 1.8], van: [1.05, 2.7, 2.1], bus: [1.35, 6.0, 3.1], wreck: [0.95, 2.4, 1.3] };
let bad = 0;
const hit = (a, L) => a.x1 > L.x0 && a.x0 < L.x1 && a.z1 > L.z0 && a.z0 < L.z1;
for (const [x, z, yaw, type] of CARS) {
  const [w, l, h] = HALF[type] || HALF.sedan, a = yaw * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const hx = w * c + l * s, hz = w * s + l * c, box = { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz };
  for (const L of LANES) if (hit(box, L)) { bad++; console.log(`CAR in lane: ${type} at ${x}, ${z} (h ${h} m)`); }
}
for (const [x0, z0, x1, z1, h] of COVER) for (const L of LANES) if (h > 1.2 && hit({ x0, x1, z0, z1 }, L)) { bad++; console.log(`COVER ${h} m in lane at ${x0}, ${z0}`); }
console.log(bad ? `${bad} lane violations` : `lanes clear: ${CARS.length} cars, ${COVER.length} cover pieces, ${LANES.length} lanes`);
process.exit(bad ? 1 : 0);
