// Level 5 quays test: the level's night look + quays.js + river + glows + wet reflections (+ tower with &tower=1).
// ?mod=/model-test/l5/quaystest.js&fn=quaysTest&night=0.3&tower=1
import * as THREE from 'three';
import { buildQuays } from '/src/levels/iron-lady/quays.js';
import { buildRiver } from '/src/levels/iron-lady/river.js';
import { Reflections } from '/src/levels/iron-lady/reflections.js';
import { createNightSkyMaterial, createNightEnvironment, nightShared } from '/src/levels/iron-lady/sky.js';
import { buildAtlas, BillboardBatch, CELL } from '/src/particles.js';
import { fogShared, rimShared, applyDusk } from '/src/atmosphere.js';
import { WATER_Y } from '/src/levels/iron-lady/layout.js';

export async function quaysTest(ctx) {
  const { scene, renderer, sun, hemi, camera } = ctx;
  const Q = new URLSearchParams(location.search), night = Q.has('night') ? +Q.get('night') : 0.3;
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
  camera.far = 6000; camera.updateProjectionMatrix();

  const root = new THREE.Group();
  const q = await buildQuays(ctx); root.add(q.root);
  const em = 0.8 + 0.2 * night;
  q.root.traverse(o => { if (o.material?.userData?.duskEmissive !== undefined) o.material.emissiveIntensity = o.material.userData.duskEmissive * em; });
  let river = null;
  if (Q.get('river') !== '0') { river = buildRiver(ctx); root.add(river.root); }
  const atlas = buildAtlas(renderer);
  let refl = null;
  if (Q.get('refl') !== '0') { refl = new Reflections(scene, { max: 420 }); for (const r of q.anchors.reflect) refl.add(r); }
  let tower = null;
  if (Q.get('tower') === '1') {
    const { buildTower } = await import('/src/levels/iron-lady/tower.js');
    tower = await buildTower(ctx); root.add(tower.root); if (tower.extra) scene.add(tower.extra);
    root.traverse(o => { if (o.material?.userData?.duskEmissive !== undefined) o.material.emissiveIntensity = o.material.userData.duskEmissive * em; });
    if (refl) for (const r of tower.anchors.reflect) { const p = r.rest.clone().add(tower.root.position); refl.add({ p: p.toArray(), color: r.color, len: r.len * 2.4, width: r.width, ground: WATER_Y, water: true }); }
  }
  const G = new BillboardBatch(q.anchors.glows.length + 16, atlas, { boost: 1, renderOrder: 19, fog: scene.fog });
  root.add(G.mesh);
  const head = camera.position;
  const fillGlows = (t) => {
    let gi = 0;
    for (const gl of q.anchors.glows) {
      const p = gl.p;
      if (gl.blink && Math.sin(t * (gl.rate || 3.2) + p[0] * 0.7) < 0.15) continue;
      if (gl.far !== true && Math.hypot(p[0] - head.x, p[1] - head.y, p[2] - head.z) > 320) continue;
      const c = gl.color, s = gl.size || 1;
      G.set(gi++, p[0], p[1], p[2], s, s, 0, CELL.GLOW, 0, c[0], c[1], c[2], 0.9);
    }
    G.commit(gi);
  };
  fillGlows(0);
  if (refl) refl.update(0, head);
  return {
    root,
    update(dt, t) { q.update?.(dt, t + 3, 0.85 + night * 0.15, head); river?.update(dt, t + 3, 0.85 + night * 0.15); tower?.update?.(dt, t + 3, 0.85 + night * 0.15, head); fillGlows(t); refl?.update(dt, head); },
    info: q.info,
  };
}
