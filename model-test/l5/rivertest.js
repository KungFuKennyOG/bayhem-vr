// Level 5 river + reflections test scene: Seine, quay walls, lower quays (wet cobbles), lamps with glows and
// reflections, a bridge slab, and a column of gold points standing in for the tower 200+ m away.
// ?mod=/model-test/l5/rivertest.js&fn=riverTest&args=[night]
import * as THREE from 'three';
import { buildRiver } from '/src/levels/iron-lady/river.js';
import { Reflections } from '/src/levels/iron-lady/reflections.js';
import { createNightSkyMaterial, createNightEnvironment, nightShared } from '/src/levels/iron-lady/sky.js';
import { buildAtlas, BillboardBatch, CELL } from '/src/particles.js';
import { fogShared, rimShared, applyDusk } from '/src/atmosphere.js';
import { WATER_Y, LOW_Y, RIVER, LOWQ, BRIDGE } from '/src/levels/iron-lady/layout.js';
import { makeRng } from '/src/rng.js';
import { buildBoat } from '/src/levels/iron-lady/boats.js';

export async function riverTest(night = 0.3, ctx) {
  if (typeof night === 'object') { ctx = night; night = 0.3; }
  const { scene, renderer, sun, hemi } = ctx;
  // the level's night look (game.js applyNight, copied)
  applyDusk(1, { sun, hemi, fog: scene.fog, renderer });
  nightShared.value = night;
  const L = (a, b) => a + (b - a) * night;
  sun.color.setRGB(0.62, 0.66, 0.95); sun.intensity = L(0.32, 0.2);
  hemi.color.setRGB(L(0.34, 0.2), L(0.42, 0.27), L(0.78, 0.55)); hemi.groundColor.setRGB(L(0.3, 0.2), L(0.2, 0.13), L(0.14, 0.09)); hemi.intensity = L(0.62, 0.5);
  scene.fog.color.setRGB(L(0.17, 0.085), L(0.12, 0.07), L(0.13, 0.08));
  fogShared.sunColor.r = L(0.55, 0.2); fogShared.sunColor.g = L(0.24, 0.1); fogShared.sunColor.b = L(0.13, 0.07);
  rimShared.color.r = L(0.32, 0.22); rimShared.color.g = L(0.38, 0.27); rimShared.color.b = L(0.6, 0.45);
  renderer.toneMappingExposure = L(1.12, 1.18);
  scene.traverse(o => { if (o.material?.uniforms?.dusk && o.material.uniforms.sunDir) o.material = createNightSkyMaterial(); });
  scene.traverse(o => { if (o.isSprite) o.visible = false; });
  scene.environment = createNightEnvironment(renderer); scene.environmentIntensity = L(0.62, 0.5);

  const root = new THREE.Group();
  const river = buildRiver(ctx); root.add(river.root);
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a463f, roughness: 0.55, metalness: 0.0 });
  const cobble = new THREE.MeshStandardMaterial({ color: 0x2c2a27, roughness: 0.28, metalness: 0.05 });
  const lampM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.6 });
  const lens = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb060, emissiveIntensity: 3 });
  const towerM = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.7, emissive: 0xff8a2a, emissiveIntensity: 0.12 });
  const add = (x0, y0, z0, x1, y1, z1, m) => { const g = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.receiveShadow = true; root.add(g); return g; };
  for (const s of [-1, 1]) {
    add(-1200, WATER_Y - 3, s > 0 ? LOWQ.edge : -LOWQ.wall, 1400, LOW_Y, s > 0 ? LOWQ.wall : -LOWQ.edge, cobble);   // lower quay + its river wall
    add(-1200, LOW_Y, s > 0 ? LOWQ.wall : -LOWQ.wall - 2, 1400, 0, s > 0 ? LOWQ.wall + 2 : -LOWQ.wall, stone);      // retaining wall
    add(-1200, -0.5, s > 0 ? LOWQ.wall + 2 : -140, 1400, 0, s > 0 ? 140 : -LOWQ.wall - 2, cobble);                  // street level
    add(-1200, 0, s > 0 ? 78 : -98, 1400, 22, s > 0 ? 98 : -78, stone);                                           // facades
  }
  add(-BRIDGE.half, -1.4, -LOWQ.wall, BRIDGE.half, 0, LOWQ.wall, stone);
  for (const z of BRIDGE.piers) add(-BRIDGE.half, WATER_Y - 2, z - 2, BRIDGE.half, -1.4, z + 2, stone);
  // tower stand-in: a dim gold lattice mass at (0, -140)
  for (const [y0, y1, w] of [[0, 56, 46], [56, 112, 26], [112, 262, 10], [262, 300, 2]]) add(-w, y0, -140 - w, w, y1, -140 + w, towerM).scale.set(0.5, 1, 0.5);

  const Q = new URLSearchParams(location.search), noRefl = Q.get('refl') === '0', fewLamps = Q.get('few') === '1';
  const atlas = buildAtlas(renderer);
  const refl = new Reflections(scene, { max: 400 });
  const glows = [];
  const lamp = (x, y, z, ground, water) => {
    add(x - 0.08, ground, z - 0.08, x + 0.08, y - 0.3, z + 0.08, lampM);
    add(x - 0.22, y - 0.3, z - 0.22, x + 0.22, y + 0.25, z + 0.22, lens);
    glows.push([x, y, z]);
    const c = [2.6, 1.55, 0.62];
    if (noRefl) return;
    refl.add({ p: [x, y, z], color: c, len: 9, width: 1.3, ground });
    if (water) refl.add({ p: [x, y, z], color: c, len: 9, width: 1.6, ground: WATER_Y, water: true });
  };
  for (let x = -400; x <= 600; x += fewLamps ? 78 : 26) {
    for (const s of [-1, 1]) lamp(x + (s > 0 ? 0 : 11), 4.6, s * 55.2, 0, true);                // upper quay lamps (behind the parapet)
    if (x > 16) for (const s of [-1, 1]) lamp(x + 7, LOW_Y + 4.0, s * 44, LOW_Y, true);          // lower quay lamps
  }
  for (let z = -46; z <= 46; z += 15.3) for (const x of [-13.7, 13.7]) lamp(x, 4.4, z, 0, true);    // bridge lamps
  // the tower's lights reflected in the river (same anchors the level uses)
  if (!noRefl) for (let i = 0; i < 18; i++) { const y = 6 + i * 14.5; const w = y < 112 ? 30 : 8; refl.add({ p: [0, y, -140 + w * 0.2], color: [1.6, 0.95, 0.42], len: 96, width: Math.max(4, w * 0.6), ground: WATER_Y, water: true }); }
  const G = new BillboardBatch(glows.length + 40, atlas, { boost: 1, renderOrder: 19, fog: scene.fog });
  glows.forEach(([x, y, z], i) => G.set(i, x, y, z, 1.4, 1.4, 0, CELL.GLOW, 0, 2.6, 1.55, 0.62, 0.9));
  let gi = glows.length;
  const rng = makeRng(4);
  for (let k = 0; k < 36; k++) { const y = 8 + k * 7.5; G.set(gi++, (rng() - 0.5) * 40 * Math.exp(-y / 90), y, -140 + 30 * Math.exp(-y / 90), 6, 6, 0, CELL.GLOW, 0, 2.4, 1.45, 0.6, 0.8); }
  G.commit(gi);
  root.add(G.mesh);
  // boats: &boats=bateau:x:z:yawDeg:burnt,peniche:x:z:yaw:seed,...
  const boats = [];
  for (const spec of (Q.get('boats') || '').split(',').filter(Boolean)) {
    const [k, x, z, yaw, extra] = spec.split(':');
    const b = buildBoat(k, { seed: k === 'peniche' ? +(extra || 3) : 5 });
    if (k !== 'peniche' && extra === 'burnt') b.setBurnt();
    b.root.position.set(+x, WATER_Y, +z); b.root.rotation.y = (+yaw || 0) * Math.PI / 180;
    root.add(b.root); boats.push(b);
    b.root.updateMatrixWorld(true);
    for (const r of b.anchors.reflect || []) { const p = new THREE.Vector3(...r.p).applyMatrix4(b.root.matrixWorld); refl.add({ ...r, p: p.toArray(), ground: WATER_Y, water: true }); }
    for (const g of b.anchors.glows || []) { if (k === 'peniche') { const p = new THREE.Vector3(...g.p).applyMatrix4(b.root.matrixWorld); G.set(gi++, p.x, p.y, p.z, g.size, g.size, 0, CELL.GLOW, 0, g.color[0], g.color[1], g.color[2], 0.9); } }
    if (k === 'peniche') for (const g of (b.anchors.glows || []).filter((g, i) => i % 3 === 0)) { const p = new THREE.Vector3(...g.p).applyMatrix4(b.root.matrixWorld); refl.add({ p: p.toArray(), color: g.color, len: 6, width: 1, ground: WATER_Y, water: true }); }
  }
  G.commit(gi);
  refl.update(0);
  return {
    root,
    update(dt, t) { river.update(dt, t + 3, 0.85 + night * 0.15); refl.update(dt); for (const b of boats) b.update?.(dt, t + 3); },
    info: { refl: refl.info, boats: boats.map(b => b.info) },
  };
}
