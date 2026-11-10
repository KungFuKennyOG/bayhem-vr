import * as THREE from 'three';
import { Buckets, em, hexc, GOLD, DIST, DUSK, signQuad } from './kit.js';
import { SIGN } from './signs.js';
import { materials, SHADOW_KEYS } from './mats.js';
import { Y, TOWER, LIFT, ROOFTOP, HINGE, COVER } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — Jinlong Tower: 175 m of gold glass on the north bank's podium, the last lit thing
//  in Longwu. An open lift platform runs up its south face to the roof; the roof is the arena for
//  the last gunship; the west parapet has the gap you jump through; then the whole tower goes over
//  its west edge (the body hangs off one pivot at HINGE, so the fall is one rotation).
//
//  The roof's middle is open: plant housings and the crown's columns stand at the corners, the
//  crown's ring beam is 16 m overhead.
// =====================================================================================
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const CROWN_H = 16;

export function buildJinlong(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'jinlong';
  const pivot = new THREE.Group(); pivot.position.set(HINGE.x, HINGE.y, HINGE.z); root.add(pivot);
  const inner = new THREE.Group(); inner.position.set(-HINGE.x, -HINGE.y, -HINGE.z); pivot.add(inner);
  const glows = [], colliders = [], riding = [];
  const T = TOWER, R = ROOFTOP, RY = R.y, code = DIST.TOWER;
  const solid = (x0, y0, z0, x1, y1, z1, data = {}) => colliders.push({ min: V3(x0, y0, z0), max: V3(x1, y1, z1), data: { tw: true, ...data } });
  const ride = (x, y, z, o) => { const g = { p: V3(x, y, z), local: V3(x, y, z), code: DUSK + code, prio: 1, far: true, ...o }; glows.push(g); riding.push(g); return g; };

  // ---- the shaft: gold-finned glass, a darker base band, lit corner strips
  const W = B.get('win', 'tw');
  W.set({ col: hexc(0x5a5346), rm: [0.32, 0.25, 0], em: [0, 0, 0, code], cell: [2.0, 3.9, 21, 4] });
  W.box(T.x0, Y + 9, T.z0, T.x1, RY - 0.6, T.z1, { faces: 'xXzZ', s: 1, wy0: Y + 9 });
  W.set({ col: hexc(0x3f3a33), rm: [0.3, 0.3, 0], em: [0, 0, 0, code], cell: [2.0, 3.0, 5, 3] });
  W.box(T.x0, Y, T.z0, T.x1, Y + 9, T.z1, { faces: 'xXzZ', s: 1, wy0: Y });
  const Gd = B.get('plain', 'tw');
  // the base at eye level: a dark stone plinth, gold piers every 4 m, a transom line (a lobby front, not one sheet of glass)
  { const St = B.get('concrete', 'twb'); St.set({ col: [0.2, 0.19, 0.18], rm: [0.6, 0, 0], em: [0, 0, 0, 0], cell: [0, 0, 0, 0] });
    St.box(T.x0 - 0.18, Y, T.z0 - 0.18, T.x1 + 0.18, Y + 0.9, T.z1 + 0.18, { faces: 'xXzZY', s: 1 });
    Gd.set({ col: [0.46, 0.35, 0.16], rm: [0.35, 0.8, 0], em: em(GOLD, 0.3, DUSK + code) });
    for (let k = 0; k <= 8; k++) { const fx = T.x0 + (T.x1 - T.x0) * k / 8, fz = T.z0 + (T.z1 - T.z0) * k / 8;
      Gd.box(fx - 0.2, Y + 0.9, T.z0 - 0.3, fx + 0.2, Y + 8.6, T.z0, { faces: 'xXz' });
      if (fx < LIFT.x0 - 0.5 || fx > LIFT.x1 + 0.5) Gd.box(fx - 0.2, Y + 0.9, T.z1, fx + 0.2, Y + 8.6, T.z1 + 0.3, { faces: 'xXZ' });
      Gd.box(T.x0 - 0.3, Y + 0.9, fz - 0.2, T.x0, Y + 8.6, fz + 0.2, { faces: 'xzZ' }); Gd.box(T.x1, Y + 0.9, fz - 0.2, T.x1 + 0.3, Y + 8.6, fz + 0.2, { faces: 'XzZ' }); }
    Gd.box(T.x0 - 0.12, Y + 3.9, T.z0 - 0.12, T.x1 + 0.12, Y + 4.1, T.z1 + 0.12, { faces: 'xXzZ' }); }
  Gd.set({ col: [0.4, 0.3, 0.14], rm: [0.35, 0.8, 0], em: em(GOLD, 1.5, DUSK + code) });
  for (const [cx, cz] of [[T.x0, T.z0], [T.x1, T.z0], [T.x0, T.z1], [T.x1, T.z1]]) Gd.box(cx - 0.35, Y + 9, cz - 0.35, cx + 0.35, RY + 1.1, cz + 0.35, { faces: 'xXzZ' });
  Gd.set({ em: em(GOLD, 1.0, DUSK + code) });
  Gd.box(T.x0 - 0.25, Y + 8.6, T.z0 - 0.25, T.x1 + 0.25, Y + 9.2, T.z1 + 0.25, { faces: 'xXzZ' });
  // vertical gold fins up every face and four lit belts round the shaft: from across the river it is a gold lantern
  Gd.set({ col: [0.42, 0.31, 0.14], rm: [0.35, 0.8, 0], em: em(GOLD, 0.55, DUSK + code) });
  for (let k = 1; k < 8; k++) {
    const fx = T.x0 + (T.x1 - T.x0) * k / 8, fz = T.z0 + (T.z1 - T.z0) * k / 8;
    Gd.box(fx - 0.12, Y + 9.2, T.z0 - 0.45, fx + 0.12, RY - 0.6, T.z0, { faces: 'xXz' }); Gd.box(fx - 0.12, Y + 9.2, T.z1, fx + 0.12, RY - 0.6, T.z1 + 0.45, { faces: 'xXZ' });
    Gd.box(T.x0 - 0.45, Y + 9.2, fz - 0.12, T.x0, RY - 0.6, fz + 0.12, { faces: 'xzZ' }); Gd.box(T.x1, Y + 9.2, fz - 0.12, T.x1 + 0.45, RY - 0.6, fz + 0.12, { faces: 'XzZ' });
  }
  Gd.set({ em: em(GOLD, 1.6, DUSK + code) });
  for (const by of [Y + 48, Y + 87, Y + 126, Y + 165]) Gd.box(T.x0 - 0.5, by, T.z0 - 0.5, T.x1 + 0.5, by + 0.9, T.z1 + 0.5, { faces: 'xXzZ' });
  // the entrance: two gold columns and a lit beam with the tower's name across the foot of the lift (the platform runs up behind it)
  Gd.set({ col: [0.5, 0.38, 0.18], rm: [0.35, 0.8, 0], em: em(GOLD, 0.2, DUSK + code) });
  for (const px of [LIFT.x0 - 2.0, LIFT.x1 + 1.2]) { Gd.box(px, Y, LIFT.z1 + 0.5, px + 0.8, Y + 9.6, LIFT.z1 + 1.3, { faces: 'xXzZ' }); solid(px, Y, LIFT.z1 + 0.5, px + 0.8, Y + 9.6, LIFT.z1 + 1.3, { mat: 'metal' }); }
  Gd.box(LIFT.x0 - 2.0, Y + 7.4, LIFT.z1 + 0.5, LIFT.x1 + 2.0, Y + 9.6, LIFT.z1 + 1.3, { faces: 'xXzZy' });
  { const S = B.get('sign', 'tw'); S.set({ col: [1, 1, 1], rm: [0.6, 0, 0], em: em([1, 1, 1], 1.6, DUSK + code) }); signQuad(S, [(LIFT.x0 + LIFT.x1) / 2, Y + 8.5, LIFT.z1 + 1.34], [0, 0, 1], 11.2, 1.9, SIGN.gate); }
  // the lift bay behind the portal is lit (a warm back wall and a floor wash): an open, bright bay, not a dark panel
  Gd.set({ col: [0.6, 0.5, 0.32], rm: [0.6, 0.1, 0], em: em(GOLD, 0.55, DUSK + code) });
  Gd.box(LIFT.x0 - 0.3, Y + 0.9, T.z1, LIFT.x1 + 0.3, Y + 7.4, T.z1 + 0.06, { faces: 'Z' });
  Gd.set({ col: [0.3, 0.24, 0.12], rm: [0.4, 0.7, 0], em: em(GOLD, 0.15, DUSK + code) });
  for (let yy = Y + 2.2; yy < Y + 7.4; yy += 1.3) Gd.box(LIFT.x0 - 0.3, yy, T.z1 + 0.06, LIFT.x1 + 0.3, yy + 0.08, T.z1 + 0.1, { faces: 'Z' });
  solid(T.x0, Y, T.z0, T.x1, RY, T.z1, { mat: 'glass' });

  // ---- the roof deck: concrete, a helipad H in the middle, parapets with two gaps (south: the lift; west: the jump)
  const Cc = B.get('concrete', 'tw'), Pl = B.get('plain', 'tw'), Mt = B.get('metal', 'tw');
  Cc.set({ col: [0.62, 0.61, 0.6], rm: [0.7, 0, 0], em: em(GOLD, 0.045, DUSK + code), cell: [0, 0, 0, 0] });   // the crown's floods on the deck
  Cc.box(T.x0, RY - 0.6, T.z0, T.x1, RY, T.z1, { faces: 'xXzZY', s: 1 });
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
  Pl.set({ col: [0.6, 0.56, 0.38], rm: [0.8, 0, 0], em: em(GOLD, 0.03, DUSK + code) });
  Pl.box(cx - 2.6, RY, cz - 3.4, cx - 1.8, RY + 0.012, cz + 3.4, { faces: 'Y' }); Pl.box(cx + 1.8, RY, cz - 3.4, cx + 2.6, RY + 0.012, cz + 3.4, { faces: 'Y' }); Pl.box(cx - 1.8, RY, cz - 0.4, cx + 1.8, RY + 0.012, cz + 0.4, { faces: 'Y' });
  for (let i = 0; i < 28; i++) { const a0 = i / 28 * Math.PI * 2, a1 = (i + 0.7) / 28 * Math.PI * 2, r0 = 8.4, r1 = 9.0; Pl.quad([cx + Math.cos(a0) * r1, RY + 0.012, cz + Math.sin(a0) * r1], [cx + Math.cos(a0) * r0, RY + 0.012, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, RY + 0.012, cz + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, RY + 0.012, cz + Math.sin(a1) * r1]); }
  const par = (x0, z0, x1, z1) => { Cc.set({ col: [0.4, 0.39, 0.37] }); Cc.box(x0, RY, z0, x1, RY + 1.1, z1, { s: 1 }); solid(x0, RY, z0, x1, RY + 1.1, z1, { mat: 'concrete' });
    Gd.set({ col: [0.4, 0.3, 0.14], rm: [0.35, 0.8, 0], em: em(GOLD, 0.9, DUSK + code) }); Gd.box(x0 - 0.02, RY + 1.1, z0 - 0.02, x1 + 0.02, RY + 1.18, z1 + 0.02, {}); };
  par(R.x0, R.z0, R.x1, R.z0 + 0.4); par(R.x1 - 0.4, R.z0, R.x1, R.z1);
  par(R.x0, R.z1 - 0.4, LIFT.x0, R.z1); par(LIFT.x1, R.z1 - 0.4, R.x1, R.z1);
  par(R.x0, R.z0, R.x0 + 0.4, R.gap[0]); par(R.x0, R.gap[1], R.x0 + 0.4, R.z1);
  // the bar across the jump gap (it lifts when you take the rig)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, R.gap[1] - R.gap[0]), new THREE.MeshStandardMaterial({ color: 0xb02a18, roughness: 0.6, emissive: 0x501008 }));
  bar.position.set(R.x0 + 0.2, RY + 1.0, R.gap[0]); inner.add(bar);   // hinged at its north end: it swings up when you take the rig
  solid(R.x0, RY, R.gap[0], R.x0 + 0.4, RY + 1.1, R.gap[1], { kind: 'gapbar', noBullet: true });
  // the barrier arm across the gap: thick, striped (it lifts when you take the rig) — and the way off marked on the deck:
  // amber chevrons from the helipad to the gap, a lamp either side of it
  { const g0 = R.gap[0], g1 = R.gap[1]; const stripe = new THREE.Group();
    for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, (g1 - g0) / 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd8d2c0 : 0xb02a18, roughness: 0.6, emissive: i % 2 ? 0x2a2820 : 0x501008 })); m.position.set(0, 0, (i + 0.5) * (g1 - g0) / 8); stripe.add(m); }
    bar.add(stripe); bar.material.visible = false;
    // the jump gantry: a grated stub out past the edge in the middle of the gap, lit edges, rails outside it. This is
    // the one place on the roof that says 'off here'
    { const zc = (g0 + g1) / 2, x0 = R.x0 - 3.2, hw = 1.7;
      Mt.set({ col: [0.2, 0.2, 0.21], rm: [0.55, 0.7, 0], em: [0, 0, 0, 0] });
      Mt.box(x0, RY - 0.14, zc - hw, R.x0 + 0.4, RY + 0.0, zc + hw, { s: 1 });
      for (let i = 0; i < 9; i++) Mt.box(x0 + 0.1 + i * 0.4, RY, zc - hw, x0 + 0.16 + i * 0.4, RY + 0.02, zc + hw, { faces: 'xXY' });
      for (const sd of [-1, 1]) { const z = zc + sd * hw; for (const xx of [x0 + 0.05, x0 + 1.6, R.x0 - 0.05]) Mt.cyl(xx, RY, z, 0.035, 0.035, RY + 1.0, 5); Mt.box(x0, RY + 0.96, z - 0.03, R.x0, RY + 1.02, z + 0.03, {}); Mt.box(x0, RY + 0.5, z - 0.02, R.x0, RY + 0.54, z + 0.02, {});
        Mt.box(x0 + 0.2, RY - 0.14, z - 0.05, x0 + 0.3, RY - 2.2, z + 0.05, {}); }
      Gd.set({ col: [0.6, 0.38, 0.08], rm: [0.6, 0.2, 0], em: em([1, 0.62, 0.18], 2.2, DUSK + DIST.ALWAYS) });
      for (const sd of [-1, 1]) Gd.box(x0, RY + 0.0, zc + sd * (hw - 0.12) - 0.05, R.x0 + 0.4, RY + 0.025, zc + sd * (hw - 0.12) + 0.05, { faces: 'Y' });
      Gd.box(x0, RY + 0.0, zc - hw, x0 + 0.12, RY + 0.03, zc + hw, { faces: 'Yx' });
      // the parapet either side of the gantry mouth ends in a lit post (the gap is 12 m wide; the gantry is its middle)
      for (const sd of [-1, 1]) { const z = zc + sd * (hw + 0.25); Mt.cyl(R.x0 + 0.2, RY, z, 0.09, 0.09, RY + 1.25, 6); ride(R.x0 + 0.2, RY + 1.35, z, { color: [0.5, 2.4, 0.9], size: 0.9, code: DUSK + DIST.ALWAYS }); } }
    Gd.set({ col: [0.6, 0.38, 0.08], rm: [0.6, 0.2, 0], em: em([1, 0.62, 0.18], 0.7, DUSK + DIST.ALWAYS) });
    for (let k = 0; k < 6; k++) { const x1 = R.x0 + 2.2 + k * 1.9, zc = (g0 + g1) / 2; Gd.quad([x1 + 0.9, RY + 0.014, zc - 1.5], [x1 + 1.35, RY + 0.014, zc - 1.5], [x1 + 0.45, RY + 0.014, zc], [x1, RY + 0.014, zc]); Gd.quad([x1, RY + 0.014, zc], [x1 + 0.45, RY + 0.014, zc], [x1 + 1.35, RY + 0.014, zc + 1.5], [x1 + 0.9, RY + 0.014, zc + 1.5]); }
    for (const gz of [g0 - 0.5, g1 + 0.5]) { Mt.set({ col: [0.14, 0.14, 0.15], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] }); Mt.cyl(R.x0 + 0.2, RY + 1.1, gz, 0.07, 0.07, RY + 2.6, 6); Gd.box(R.x0 + 0.05, RY + 2.6, gz - 0.15, R.x0 + 0.35, RY + 2.85, gz + 0.15, {}); ride(R.x0 + 0.2, RY + 2.75, gz, { color: [2.6, 1.3, 0.4], size: 0.8, code: DUSK + DIST.ALWAYS }); } }
  // roof plant along the north and east edges (AC units, vent stacks, cable trays: the deck is a working roof)
  { const U = [[683, 105, 2.4, 1.4, 1.5], [688, 105, 1.6, 1.3, 1.1], [692.5, 104.9, 3.0, 1.2, 1.7], [697, 105, 1.5, 1.4, 1.2], [706, 113, 1.4, 2.6, 1.6], [706, 118, 1.3, 1.6, 1.0], [706.1, 122, 1.4, 2.2, 1.9]];
    for (const [ux, uz, w, d, h] of U) { Mt.set({ col: [0.36, 0.37, 0.38], rm: [0.6, 0.5, 0], em: [0, 0, 0, 0] }); Mt.box(ux - w / 2, RY, uz - d / 2 + 0.6, ux + w / 2, RY + h, uz + d / 2 + 0.6, { s: 1, foot: 0.3 }); Mt.set({ col: [0.1, 0.1, 0.11] }); Mt.cyl(ux, RY + h, uz + 0.6, Math.min(w, d) * 0.3, Math.min(w, d) * 0.3, RY + h + 0.12, 10); solid(ux - w / 2, RY, uz - d / 2 + 0.6, ux + w / 2, RY + h, uz + d / 2 + 0.6, { mat: 'metal', kind: 'cover' }); }
    Mt.set({ col: [0.2, 0.2, 0.21] }); Mt.box(R.x0 + 2, RY + 0.25, R.z0 + 0.5, R.x1 - 2, RY + 0.4, R.z0 + 0.8, {}); Mt.box(R.x1 - 0.8, RY + 0.25, R.z0 + 2, R.x1 - 0.5, RY + 0.4, R.z1 - 2, {}); }
  // low plant on the deck (0.95 m: cover you can see over), clear of the helipad, the chevrons and the lift's mouth
  for (const [ux, uz, w, d] of [[680.4, 109.6, 3.2, 1.2], [685.2, 107.8, 1.2, 2.6], [703, 130.2, 3.0, 1.2], [699.6, 132.4, 1.2, 2.4], [680, 126.2, 2.8, 1.1], [703.4, 109.5, 1.2, 2.8]]) {
    Mt.set({ col: [0.4, 0.41, 0.42], rm: [0.55, 0.6, 0], em: [0, 0, 0, 0] }); Mt.box(ux - w / 2, RY, uz - d / 2, ux + w / 2, RY + 0.95, uz + d / 2, { s: 1, foot: 0.3 });
    Mt.set({ col: [0.12, 0.12, 0.13] }); Mt.box(ux - w / 2 + 0.15, RY + 0.95, uz - d / 2 + 0.15, ux + w / 2 - 0.15, RY + 1.0, uz + d / 2 - 0.15, { faces: 'xXzZY' });
    Mt.set({ col: [0.7, 0.55, 0.1] }); Mt.box(ux - w / 2 - 0.01, RY + 0.55, uz - d / 2 - 0.01, ux + w / 2 + 0.01, RY + 0.65, uz + d / 2 + 0.01, { faces: 'xXzZ' });
    solid(ux - w / 2, RY, uz - d / 2, ux + w / 2, RY + 0.95, uz + d / 2, { mat: 'metal' }); }
  // lit edge marks either side of the gap (the way off)
  Gd.set({ col: [0.5, 0.2, 0.1], em: em([1, 0.35, 0.12], 2.2, DUSK + DIST.ALWAYS) });
  Gd.box(R.x0 + 0.4, RY, R.gap[0] - 0.2, R.x0 + 3.4, RY + 0.02, R.gap[0], { faces: 'Y' }); Gd.box(R.x0 + 0.4, RY, R.gap[1], R.x0 + 3.4, RY + 0.02, R.gap[1] + 0.2, { faces: 'Y' });

  // ---- the crown: four corner columns and a ring beam 16 m up (a lantern cage: over you, not around you); a mast on the NE column
  // worn bronze (the metal texture: plate seams and grime), gold only where its own floods catch it
  const Cr = B.get('metal', 'twc'); Cr.set({ cell: [0, 0, 0, 0] });
  Cr.set({ col: [0.62, 0.46, 0.2], rm: [0.45, 0.7, 0], em: em(GOLD, 0.1, DUSK + code) });
  for (const [px, pz] of [[R.x0 + 0.9, R.z0 + 0.9], [R.x1 - 0.9, R.z0 + 0.9], [R.x0 + 0.9, R.z1 - 0.9], [R.x1 - 0.9, R.z1 - 0.9]]) {
    Cr.box(px - 0.7, RY, pz - 0.7, px + 0.7, RY + CROWN_H, pz + 0.7, { faces: 'xXzZ', foot: 0.0, top: [0.2, 0.15, 0.08] });
    solid(px - 0.7, RY, pz - 0.7, px + 0.7, RY + CROWN_H, pz + 0.7, { mat: 'metal' });
    ride(px, RY + 2.2, pz, { color: [2.6, 1.6, 0.7], size: 2.4 });
  }
  Cr.set({ em: em(GOLD, 0.3, DUSK + code) });
  Cr.box(R.x0, RY + CROWN_H, R.z0, R.x1, RY + CROWN_H + 1.6, R.z0 + 1.6, {}); Cr.box(R.x0, RY + CROWN_H, R.z1 - 1.6, R.x1, RY + CROWN_H + 1.6, R.z1, {});
  Cr.box(R.x0, RY + CROWN_H, R.z0 + 1.6, R.x0 + 1.6, RY + CROWN_H + 1.6, R.z1 - 1.6, {}); Cr.box(R.x1 - 1.6, RY + CROWN_H, R.z0 + 1.6, R.x1, RY + CROWN_H + 1.6, R.z1 - 1.6, {});
  // the lantern cage: cross-braces between the columns from 6 m up (over your head), the tower's name on the ring beam
  Cr.set({ col: [0.46, 0.35, 0.17], rm: [0.4, 0.8, 0], em: em(GOLD, 0.13, DUSK + code) });
  { const y0 = RY + 6.2, y1 = RY + CROWN_H, n = 4;
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n, xa = R.x0 + 1.6 + (R.x1 - R.x0 - 3.2) * u0, xb = R.x0 + 1.6 + (R.x1 - R.x0 - 3.2) * u1, za = R.z0 + 1.6 + (R.z1 - R.z0 - 3.2) * u0, zb = R.z0 + 1.6 + (R.z1 - R.z0 - 3.2) * u1;
      for (const zz of [R.z0 + 0.8, R.z1 - 0.8]) { Cr.beam([xa, y0, zz], [xb, y1, zz], 0.3, 0.3); Cr.beam([xb, y0, zz], [xa, y1, zz], 0.3, 0.3); }
      for (const xx of [R.x0 + 0.8, R.x1 - 0.8]) { Cr.beam([xx, y0, za], [xx, y1, zb], 0.3, 0.3); Cr.beam([xx, y0, zb], [xx, y1, za], 0.3, 0.3); }
    }
    Cr.box(R.x0 + 0.5, y0 - 0.25, R.z0 + 0.6, R.x1 - 0.5, y0 + 0.15, R.z0 + 1.0, {}); Cr.box(R.x0 + 0.5, y0 - 0.25, R.z1 - 1.0, R.x1 - 0.5, y0 + 0.15, R.z1 - 0.6, {});
    Cr.box(R.x0 + 0.6, y0 - 0.25, R.z0 + 0.5, R.x0 + 1.0, y0 + 0.15, R.z1 - 0.5, {}); Cr.box(R.x1 - 1.0, y0 - 0.25, R.z0 + 0.5, R.x1 - 0.6, y0 + 0.15, R.z1 - 0.5, {}); }
  { const S = B.get('sign', 'tw'); S.set({ col: [1, 1, 1], rm: [0.6, 0, 0], em: em([1, 1, 1], 2.0, DUSK + code) });
    signQuad(S, [cx, RY + CROWN_H + 5.6, R.z1 + 0.06], [0, 0, 1], 15, 7.5, SIGN.jinlong); signQuad(S, [R.x0 - 0.06, RY + CROWN_H + 5.6, cz], [-1, 0, 0], 15, 7.5, SIGN.jinlong);
    signQuad(S, [cx, RY + CROWN_H + 5.6, R.z0 - 0.06], [0, 0, -1], 15, 7.5, SIGN.jinlong); signQuad(S, [R.x1 + 0.06, RY + CROWN_H + 5.6, cz], [1, 0, 0], 15, 7.5, SIGN.jinlong);
    const Bk = B.get('plain', 'tw'); Bk.set({ col: [0.03, 0.03, 0.03], rm: [0.8, 0, 0], em: [0, 0, 0, 0] });
    Bk.box(cx - 8, RY + CROWN_H + 1.6, R.z1 - 0.3, cx + 8, RY + CROWN_H + 9.6, R.z1, {}); Bk.box(cx - 8, RY + CROWN_H + 1.6, R.z0, cx + 8, RY + CROWN_H + 9.6, R.z0 + 0.3, {});
    Bk.box(R.x0, RY + CROWN_H + 1.6, cz - 8, R.x0 + 0.3, RY + CROWN_H + 9.6, cz + 8, {}); Bk.box(R.x1 - 0.3, RY + CROWN_H + 1.6, cz - 8, R.x1, RY + CROWN_H + 9.6, cz + 8, {}); }
  // deck lights: amber studs round the helipad, a line of them to the jump gap
  Cr.set({ col: [0.5, 0.3, 0.1], rm: [0.4, 0.3, 0], em: em([1, 0.6, 0.2], 3, DUSK + DIST.ALWAYS) });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; Cr.box(cx + Math.cos(a) * 9.6 - 0.12, RY, cz + Math.sin(a) * 9.6 - 0.12, cx + Math.cos(a) * 9.6 + 0.12, RY + 0.06, cz + Math.sin(a) * 9.6 + 0.12, { faces: 'xXzZY' }); }
  Mt.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] });
  Mt.cyl(R.x1 - 0.9, RY + CROWN_H + 1.6, R.z0 + 0.9, 0.35, 0.12, RY + CROWN_H + 30, 8);
  ride(R.x1 - 0.9, RY + CROWN_H + 30.6, R.z0 + 0.9, { color: [3, 0.2, 0.1], size: 4, blink: true, rate: 2.6, code: DUSK + DIST.ALWAYS });
  ride(cx, RY + CROWN_H + 0.8, cz, { color: [2.2, 1.35, 0.55], size: 26 });                                 // the crown's halo: Longwu's last light

  // ---- plant housings at the roof's corners (cover), the BASE locker
  for (const [x0, z0, x1, z1, h] of COVER) {
    if (!(x0 >= R.x0 && x1 <= R.x1 && z0 >= R.z0 && z1 <= R.z1)) continue;
    Mt.set({ col: [0.3, 0.31, 0.32], rm: [0.6, 0.5, 0], em: [0, 0, 0, 0] }); Mt.box(x0, RY, z0, x1, RY + h, z1, { s: 1 });
    solid(x0, RY, z0, x1, RY + h, z1, { mat: 'metal', kind: 'cover' });
  }
  { const L = R.locker; Mt.set({ col: [0.5, 0.2, 0.08], rm: [0.6, 0.4, 0], em: em([1, 0.4, 0.12], 0.25, DUSK + DIST.ALWAYS) });
    Mt.box(L.x - 0.6, RY, L.z - 0.35, L.x + 0.6, RY + 1.9, L.z + 0.35, {});
    Mt.set({ col: [0.08, 0.08, 0.08], em: [0, 0, 0, 0] }); Mt.box(L.x - 0.02, RY + 0.1, L.z - 0.37, L.x + 0.02, RY + 1.8, L.z - 0.35, {}); for (let i = 0; i < 4; i++) Mt.box(L.x - 0.62, RY + 0.25 + i * 0.12, L.z - 0.36, L.x + 0.62, RY + 0.3 + i * 0.12, L.z - 0.355, {});
    Mt.set({ col: [0.85, 0.75, 0.2], em: em([1, 0.8, 0.2], 0.4, DUSK + DIST.ALWAYS) }); Mt.box(L.x - 0.6, RY + 1.55, L.z - 0.37, L.x + 0.6, RY + 1.75, L.z - 0.355, {});
    Mt.set({ col: [0.14, 0.14, 0.15], em: [0, 0, 0, 0] }); Mt.cyl(L.x + 0.75, RY, L.z, 0.05, 0.05, RY + 2.9, 6); solid(L.x - 0.6, RY, L.z - 0.35, L.x + 0.6, RY + 1.9, L.z + 0.35, { mat: 'metal' });
    ride(L.x + 0.75, RY + 3.0, L.z, { color: [2.6, 0.9, 0.25], size: 1.5, blink: true, rate: 4, code: DUSK + DIST.ALWAYS }); }

  // ---- the lift's guide rails up the south face (the platform itself is a separate group: it doesn't fall with the tower)
  Mt.set({ col: [0.16, 0.16, 0.17], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] });
  for (const rx of [LIFT.x0 - 0.3, LIFT.x1 + 0.05]) Mt.box(rx, Y, T.z1, rx + 0.25, RY + 1.1, T.z1 + 0.45, { faces: 'xXZ' });
  Gd.set({ col: [0.4, 0.3, 0.14], em: em(GOLD, 1.3, DUSK + code) });
  for (const rx of [LIFT.x0 - 0.02, LIFT.x1 - 0.06]) Gd.box(rx, Y, T.z1 + 0.45, rx + 0.08, RY, T.z1 + 0.5, { faces: 'Z' });

  const { tris } = B.finish(inner, { shadowKeys: SHADOW_KEYS });

  // ================================================================== the lift platform: an open deck with side rails, lit edges
  const lift = new THREE.Group(); lift.name = 'lift';
  {
    const LB = new Buckets(); for (const [k, m] of Object.entries(M)) LB.mat(k, m);
    const D = LB.get('metal', 'l'), E = LB.get('plain', 'l');
    const { x0, x1, z0, z1 } = LIFT;
    D.set({ col: [0.26, 0.27, 0.28], rm: [0.6, 0.6, 0], em: [0, 0, 0, 0] });
    D.box(x0, -0.3, z0, x1, 0, z1, { s: 1 });
    D.box(x0, -1.4, z0 + 0.4, x0 + 0.3, -0.3, z1 - 0.4, {}); D.box(x1 - 0.3, -1.4, z0 + 0.4, x1, -0.3, z1 - 0.4, {});
    D.set({ col: [0.1, 0.11, 0.12] });
    for (const sx of [x0 + 0.06, x1 - 0.06]) {
      for (let z = z0 + 0.1; z <= z1 - 0.05; z += (z1 - z0 - 0.2) / 3) D.box(sx - 0.05, 0, z - 0.05, sx + 0.05, 1.1, z + 0.05, { faces: 'xXzZ' });
      D.beam([sx, 1.1, z0], [sx, 1.1, z1], 0.1, 0.07); D.beam([sx, 0.55, z0], [sx, 0.55, z1], 0.05, 0.05);
    }
    E.set({ col: [0.5, 0.36, 0.14], rm: [0.4, 0.5, 0], em: em(GOLD, 1.5, DUSK + DIST.ALWAYS) });
    E.box(x0, 0, z0, x1, 0.02, z0 + 0.06, { faces: 'Y' }); E.box(x0, 0, z1 - 0.06, x1, 0.02, z1, { faces: 'Y' }); E.box(x0, 0, z0, x0 + 0.06, 0.02, z1, { faces: 'Y' }); E.box(x1 - 0.06, 0, z0, x1, 0.02, z1, { faces: 'Y' });
    // hazard chevrons across the deck's open edge, a warm glow up through the grating
    E.set({ col: [0.75, 0.55, 0.1], rm: [0.7, 0, 0], em: em([1, 0.7, 0.2], 0.25, DUSK + DIST.ALWAYS) });
    for (let cx2 = x0 + 0.5; cx2 < x1 - 0.6; cx2 += 1.2) E.quad([cx2, 0.012, z1 - 0.1], [cx2 + 0.6, 0.012, z1 - 0.1], [cx2 + 0.95, 0.012, z1 - 0.75], [cx2 + 0.35, 0.012, z1 - 0.75]);
    D.set({ col: [0.34, 0.34, 0.34], rm: [0.5, 0.6, 0], em: em(GOLD, 0.03, DUSK + DIST.ALWAYS) }); D.box(x0 + 0.1, 0, z0 + 0.1, x1 - 0.1, 0.008, z1 - 0.8, { faces: 'Y', s: 1 });
    // tread bars and two inspection hatches: a steel deck, not a coloured slab
    D.set({ col: [0.13, 0.13, 0.14], rm: [0.5, 0.7, 0], em: [0, 0, 0, 0] });
    for (let z = z0 + 0.35; z < z1 - 0.9; z += 0.42) D.box(x0 + 0.25, 0.008, z, x1 - 0.25, 0.02, z + 0.07, { faces: 'Y' });
    for (const hx of [x0 + 1.4, x1 - 2.6]) { D.box(hx, 0.02, z0 + 1.2, hx + 1.2, 0.03, z0 + 2.4, { faces: 'Y' }); }
    E.box(x0, -0.32, z1, x1, -0.02, z1 + 0.03, { faces: 'Z' });
    LB.finish(lift, { shadowKeys: SHADOW_KEYS });
  }
  lift.position.y = Y; root.add(lift);
  // the gate across the platform's open south side: shut while it moves
  const gate = new THREE.Mesh(new THREE.BoxGeometry(LIFT.x1 - LIFT.x0 - 0.2, 0.09, 0.09), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.6 }));
  gate.position.set((LIFT.x0 + LIFT.x1) / 2, 1.05, LIFT.z1 - 0.08); gate.visible = false; lift.add(gate);
  const liftGlow = { p: V3((LIFT.x0 + LIFT.x1) / 2, Y + 0.6, LIFT.z1), color: [2.4, 1.5, 0.6], size: 1.0, code: DUSK + DIST.ALWAYS, prio: 1 };
  glows.push(liftGlow);

  const top = V3(cx, RY + CROWN_H, cz);
  return { root, colliders, anchors: { glows, named: { tower: { pivot, inner, lift, gate, bar, riding, top, liftGlow, colliders } } }, tris };
}
