import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { Buckets, em, mul3, hexc, GOLD, SODIUM, DIST, DUSK, signQuad } from './kit.js';
import { materials } from './mats.js';
import { SIGN } from './signs.js';
import { lampPost } from './kitbuild.js';
import { BRIDGE, CROWN, RAVINE, CHAOTIAN, FARARCH, FARBANK, RIVER, WATER_Y, QUAY } from './layout.js';

// =====================================================================================
//  LIGHTS OUT — the bridges.
//   QIANSI (playable): a steel through-arch over the ravine, painted Chongqing red-orange, the deck
//   hung from the ribs by hangers above and propped on struts below, wind bracing over the crown
//   with a maintenance catwalk (gunmen up there), every rib edge outlined in gold.
//   CHAOTIAN (the glide flies under it): a 500 m cable-stayed bridge across the Yan, two H pylons
//   156 m tall, floodlit; its stay fans are LED-lit, span by span (the blackout takes them span by
//   span); its north end runs into a tunnel in the cliff under the store.
//   Two arched bridges up- and downstream (backdrop): long necklaces of gold over the fog.
// =====================================================================================
const RIBC = hexc(0xa83a1c), STEEL = hexc(0x5c6066);
export const archY = (x) => { const t = (x - (BRIDGE.x0 + BRIDGE.x1) / 2) / ((BRIDGE.x1 - BRIDGE.x0) / 2 - 2); return BRIDGE.spring + (BRIDGE.crown - BRIDGE.spring) * (1 - t * t); };

export function buildBridges(ctx = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const root = new THREE.Group(); root.name = 'bridges';
  const glows = [], lights = [], colliders = [];
  const r = makeRng(3131);
  const AR = DIST.ARCH;

  // ================================================================== Qiansi: the deck
  {
    const Br = BRIDGE, C = B.get('concrete', 'qs'), A = B.get('asphalt', 'qs'), P = B.get('plain', 'qs'), Mt = B.get('metal', 'qs');
    C.set({ col: [0.55, 0.55, 0.54], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
    C.box(Br.x0 - 1, Br.y - 2.2, Br.z0, Br.x1 + 1, Br.y - 0.1, Br.z1, { faces: 'yzZ', s: 1 });
    A.set({ col: [0.48, 0.48, 0.5], rm: [0.32, 0, 0], em: [0, 0, 0, 0] });
    A.box(Br.x0 - 1, Br.y - 0.4, Br.z0 + 1.6, Br.x1 + 1, Br.y, Br.z1 - 1.6, { faces: 'Y', s: 1 });
    const Sw = B.get('stone', 'qs'); Sw.set({ col: [0.55, 0.53, 0.5], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    Sw.box(Br.x0 - 1, Br.y - 0.4, Br.z0, Br.x1 + 1, Br.y + 0.15, Br.z0 + 1.6, { faces: 'YZ', s: 1 }); Sw.box(Br.x0 - 1, Br.y - 0.4, Br.z1 - 1.6, Br.x1 + 1, Br.y + 0.15, Br.z1, { faces: 'Yz', s: 1 });
    // road paint
    P.set({ col: [0.85, 0.65, 0.12], rm: [0.6, 0, 0], em: [0, 0, 0, 0] });
    const zc = (Br.z0 + Br.z1) / 2; P.box(Br.x0, Br.y + 0.004, zc - 0.2, Br.x1, Br.y + 0.008, zc - 0.08, { faces: 'Y' }); P.box(Br.x0, Br.y + 0.004, zc + 0.08, Br.x1, Br.y + 0.008, zc + 0.2, { faces: 'Y' });
    // edge girders + steel railings (low: you can see straight down into the ravine)
    Mt.set({ col: STEEL, rm: [0.45, 0.7, 0], em: [0, 0, 0, 0] });
    for (const z of [Br.z0 + 0.15, Br.z1 - 0.15]) {
      Mt.box(Br.x0 - 1, Br.y + 0.15, z - 0.06, Br.x1 + 1, Br.y + 1.15, z + 0.06, { faces: 'zZY' });
      for (let x = Br.x0; x < Br.x1; x += 1.2) Mt.box(x - 0.03, Br.y + 0.15, z - 0.04, x + 0.03, Br.y + 1.1, z + 0.04, { faces: 'xXzZ' });
      colliders.push({ min: [Br.x0 - 1, Br.y, z - 0.15], max: [Br.x1 + 1, Br.y + 1.15, z + 0.15], data: { mat: 'metal', kind: 'rail' } });
    }
    for (let x = Br.x0 + 8; x < Br.x1 - 4; x += 15) for (const [z, d] of [[Br.z0 + 0.9, [0, 0, 1]], [Br.z1 - 0.9, [0, 0, -1]]]) lampPost(B, 'qs', x, Br.y + 0.15, z, { dir: d, h: 7, code: AR, lights, glows, grp: 2, col: SODIUM });
    // the plaque on the west abutment
    const Sg = B.get('sign', 'qs'); Sg.set({ col: [1, 1, 1], rm: [0.5, 0, 0], em: em([1, 1, 1], 1.4, DUSK + AR) });
    Sw.set({ col: [0.6, 0.58, 0.55] }); Sw.box(Br.x0 - 1.4, Br.y, Br.z0 - 1.2, Br.x0 + 0.6, Br.y + 3.0, Br.z0 + 0.2, { faces: 'xXzZY', s: 1 });
    signQuad(Sg, [Br.x0 - 0.4, Br.y + 1.9, Br.z0 + 0.22], [0, 0, 1], 1.9, 0.42, SIGN.qiansi);
    colliders.push({ min: [Br.x0 - 1.4, Br.y, Br.z0 - 1.2], max: [Br.x0 + 0.6, Br.y + 3.0, Br.z0 + 0.2], data: { mat: 'stone', kind: 'post' } });
  }
  // ================================================================== Qiansi: the ribs, hangers, struts, bracing, crown catwalk
  {
    const Br = BRIDGE, Mt = B.get('metal', 'qs'), L = B.get('plain', 'qs');
    const N = 28, x0 = Br.x0 + 2, x1 = Br.x1 - 2;
    for (const zr of Br.ribZ) {
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const x = x0 + (x1 - x0) * i / N, p = [x, archY(x), zr];
        if (prev) {
          Mt.set({ col: RIBC, rm: [0.45, 0.55, 0], em: [0, 0, 0, 0] }); Mt.beam(prev, p, 1.6, 2.6, RIBC, [0, 0, 1]);
          // gold LED lines along the rib's top and bottom edges
          L.set({ col: [0.25, 0.2, 0.1], rm: [0.5, 0.3, 0], em: em(GOLD, 0.8, DUSK + AR) });
          if (p[1] > BRIDGE.y + 6 && prev[1] > BRIDGE.y + 6) for (const dy of [1.32]) for (const dz of [-0.82, 0.82]) L.beam([prev[0], prev[1] + dy, zr + dz], [p[0], p[1] + dy, zr + dz], 0.1, 0.1);   // only up the arch, not at your eye line
        }
        prev = p;
        if (i % 2 === 0 && i > 0 && i < N) glows.push({ p: [x, archY(x) + 1.4, zr], color: [1.6, 1.0, 0.4], size: 1.6, code: DUSK + AR, far: true });
      }
      // hangers above the deck, struts below it
      Mt.set({ col: STEEL, rm: [0.4, 0.7, 0], em: [0, 0, 0, 0] });
      for (let x = x0 + 3; x < x1 - 2; x += 4.4) {
        const ya = archY(x);
        const zd = zr < 108 ? Br.z0 : Br.z1;
        if (ya > Br.y + 2) Mt.tube([x, Br.y - 0.2, zd + (zr < 108 ? -0.2 : 0.2)], [x, ya - 1.3, zr], 0.07, 5);
        else if (ya < Br.y - 3) Mt.beam([x, ya + 1.3, zr], [x, Br.y - 2.2, zr], 0.5, 0.5);
      }
      // the springing bearings on the ravine walls
      const C = B.get('concrete', 'qs'); C.set({ col: [0.5, 0.5, 0.48], rm: [0.9, 0, 0], em: [0, 0, 0, 0] });
      for (const x of [x0 - 1, x1 + 1]) C.box(x - 3, Br.spring - 6, zr - 2, x + 3, Br.spring + 1.5, zr + 2, { faces: 'xXzZY', s: 1 });
    }
    // cross bracing between the ribs where they're above the deck (a K-truss), deck cross-beams below
    Mt.set({ col: RIBC, rm: [0.45, 0.55, 0], em: [0, 0, 0, 0] });
    const [za, zb] = Br.ribZ;
    for (let x = x0 + 6; x < x1 - 5; x += 5.5) {
      const y = archY(x);
      if (y > Br.y + 7) { Mt.beam([x, y, za], [x, y, zb], 0.8, 1.0, RIBC, [0, 1, 0]); if (y > Br.y + 12) { Mt.beam([x, y - 0.4, za], [x + 2.75, archY(x + 2.75), (za + zb) / 2], 0.5, 0.5); Mt.beam([x, y - 0.4, zb], [x + 2.75, archY(x + 2.75), (za + zb) / 2], 0.5, 0.5); } }
    }
    // the crown catwalk: grating, rails, a ladder up the rib (gunmen stand up here)
    const Cw = CROWN;
    Mt.set({ col: hexc(0x3b3e42), rm: [0.5, 0.7, 0] });
    Mt.box(Cw.x0, Cw.y - 0.12, Cw.z0, Cw.x1, Cw.y, Cw.z1, { faces: 'yYxXzZ' });
    for (const z of [Cw.z0 + 0.1, Cw.z1 - 0.1]) { Mt.box(Cw.x0, Cw.y + 1.0, z - 0.04, Cw.x1, Cw.y + 1.08, z + 0.04); for (let x = Cw.x0; x <= Cw.x1; x += 1.25) Mt.box(x - 0.03, Cw.y, z - 0.03, x + 0.03, Cw.y + 1.05, z + 0.03); }
    colliders.push({ min: [Cw.x0, Cw.y - 0.6, Cw.z0], max: [Cw.x1, Cw.y, Cw.z1], data: { mat: 'metal', kind: 'deck', layer: 'deck' } });
    // a red aviation lamp on the crown
    glows.push({ p: [(Cw.x0 + Cw.x1) / 2, Cw.y + 1.6, (Cw.z0 + Cw.z1) / 2], color: [3, 0.2, 0.1], size: 2.2, blink: true, code: DUSK + AR, far: true });
    // under-deck: blue-white strip lights (the bridge glows from below over the ravine)
    L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em([0.6, 0.8, 1.0], 0.5, DUSK + AR) });
    L.box(Br.x0, Br.y - 2.25, Br.z0 + 0.3, Br.x1, Br.y - 2.2, Br.z0 + 0.5); L.box(Br.x0, Br.y - 2.25, Br.z1 - 0.5, Br.x1, Br.y - 2.2, Br.z1 - 0.3);
  }

  // ================================================================== Chaotian: the cable-stayed bridge across the Yan
  {
    const Ch = CHAOTIAN, C = B.get('concrete', 'ch'), A = B.get('asphalt', 'ch'), L = B.get('plain', 'ch'), Mt = B.get('metal', 'ch');
    const xa = Ch.x - Ch.w / 2, xb = Ch.x + Ch.w / 2;
    const span = (z) => z < Ch.pylons[0] ? DIST.CH_A : z < (Ch.pylons[0] + Ch.pylons[1]) / 2 ? DIST.CH_B : z < Ch.pylons[1] ? DIST.CH_C : DIST.CH_D;
    C.set({ col: [0.6, 0.6, 0.58], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
    C.box(xa, Ch.y - 3.2, Ch.z0, xb, Ch.y - 0.2, Ch.z1, { faces: 'xXy', s: 1 });
    A.set({ col: [0.45, 0.45, 0.47], rm: [0.35, 0, 0], em: [0, 0, 0, 0] }); A.box(xa, Ch.y - 0.4, Ch.z0, xb, Ch.y, Ch.z1, { faces: 'Y', s: 1 });
    // the tunnel portal in the cliff (its lit mouth)
    C.box(xa - 4, Ch.y - 3.2, Ch.z0 - 2, xb + 4, Ch.y + 9, Ch.z0, { faces: 'Z', s: 1 });
    L.set({ col: [0.05, 0.05, 0.05], rm: [0.9, 0, 0], em: em([1.0, 0.6, 0.3], 0.8, DUSK + DIST.CH_A) }); L.box(xa + 1, Ch.y, Ch.z0 - 0.1, xb - 1, Ch.y + 7, Ch.z0 + 0.02, { faces: 'Z' });
    // deck edges: barriers, the LED line along both fascias, lamp heads
    Mt.set({ col: [0.55, 0.57, 0.6], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
    for (const x of [xa + 0.2, xb - 0.2]) Mt.box(x - 0.1, Ch.y, Ch.z0, x + 0.1, Ch.y + 1.1, Ch.z1, { faces: 'xXY' });
    for (let z = Ch.z0 + 10; z < Ch.z1; z += 25) for (const x of [xa + 1, xb - 1]) { L.set({ col: [1, 1, 1], em: em(SODIUM, 3, DUSK + span(z)) }); L.box(x - 0.3, Ch.y + 9, z - 0.2, x + 0.3, Ch.y + 9.15, z + 0.2); Mt.set({ col: [0.2, 0.2, 0.22] }); Mt.box(x - 0.08, Ch.y, z - 0.08, x + 0.08, Ch.y + 9, z + 0.08); glows.push({ p: [x, Ch.y + 8.8, z], color: [2.0, 1.1, 0.45], size: 3.2, code: DUSK + span(z), far: true }); }
    for (let z = Ch.z0; z < Ch.z1; z += 30) { L.set({ col: [0.2, 0.2, 0.2], em: em([0.7, 0.85, 1.0], 1.0, DUSK + span(z)) }); L.box(xa - 0.08, Ch.y - 1.8, z, xa, Ch.y - 1.5, Math.min(Ch.z1, z + 30)); L.box(xb, Ch.y - 1.8, z, xb + 0.08, Ch.y - 1.5, Math.min(Ch.z1, z + 30)); }
    // the pylons: H frames on caissons in the river, floodlit gold from the base, LED edges, red lamps on top
    for (const zp of Ch.pylons) {
      const code = span(zp - 1);
      for (const s of [-1, 1]) {
        const x = Ch.x + s * (Ch.w / 2 + 1.6);
        // floodlit from the water: the wash fades up the leg (bands), so the pylon has a form, not a flat cream slab
        { const y0 = WATER_Y - 2, y1 = Ch.y + 20, nb = 6; for (let k = 0; k < nb; k++) { const ya = y0 + (y1 - y0) * k / nb, yb = y0 + (y1 - y0) * (k + 1) / nb; C.set({ col: [0.55, 0.55, 0.53], rm: [0.85, 0, 0], em: em(GOLD, 0.42 * Math.pow(1 - k / nb, 1.6) + 0.04, DUSK + code) }); C.box(x - 2.2, ya, zp - 3.2, x + 2.2, yb, zp + 3.2, { faces: 'xXzZ', s: 1 }); } }
        C.set({ col: [0.55, 0.55, 0.53], em: em(GOLD, 0.05, DUSK + code) });
        C.box(x - 1.8, Ch.y + 20, zp - 2.6, x + 1.8, Ch.pylonH, zp + 2.6, { faces: 'xXzZY', s: 1 });
        L.set({ col: [0.2, 0.2, 0.2], rm: [0.5, 0, 0], em: em(GOLD, 1.4, DUSK + code) });
        for (const dz of [-2.65, 2.62]) L.box(x - 1.85, Ch.y + 20, zp + dz, x - 1.75, Ch.pylonH, zp + dz + 0.06);
        glows.push({ p: [x, Ch.pylonH + 1.5, zp], color: [3, 0.2, 0.1], size: 3.5, blink: true, rate: 1.7, code: DUSK + code, far: true });
        glows.push({ p: [x, Ch.y + 10, zp - 4], color: [1.4, 0.9, 0.4], size: 14, code: DUSK + code, far: true });
      }
      C.set({ col: [0.6, 0.6, 0.58], em: [0, 0, 0, 0] });
      C.box(Ch.x - Ch.w / 2 - 3.8, Ch.y - 6, zp - 2.4, Ch.x + Ch.w / 2 + 3.8, Ch.y - 3.2, zp + 2.4, { faces: 'xXzZyY', s: 1 });
      C.box(Ch.x - Ch.w / 2 - 3.8, Ch.pylonH - 18, zp - 2.2, Ch.x + Ch.w / 2 + 3.8, Ch.pylonH - 13, zp + 2.2, { faces: 'xXzZyY', s: 1 });
      C.box(Ch.x - 20, WATER_Y - 3, zp - 9, Ch.x + 20, WATER_Y + 2.2, zp + 9, { faces: 'xXzZY', s: 1 });
      // stay fans (LED-lit cables) both planes, both directions
      for (const s of [-1, 1]) {
        const xp = Ch.x + s * (Ch.w / 2 + 1.6), xd = Ch.x + s * (Ch.w / 2 - 0.4);
        for (let i = 0; i < 16; i++) {
          const ya = Ch.pylonH - 22 - i * 3.4;
          for (const dir of [-1, 1]) {
            const zd = zp + dir * (14 + i * 7.2);
            if (zd < Ch.z0 + 6 || zd > Ch.z1 - 4) continue;
            L.set({ col: [0.22, 0.23, 0.25], rm: [0.4, 0.7, 0], em: em([1.0, 0.85, 0.6], 0.1, DUSK + span(zd)) });   // dark steel stays, a faint warm catch-light
            L.beam([xp, ya, zp + dir * 1.5], [xd, Ch.y + 0.8, zd], 0.22, 0.22);
          }
        }
      }
    }
    // a few stalled cars on the deck (the shooters use them in the glide) are added by setpieces
  }

  // ================================================================== the far arches (backdrop necklaces)
  for (const fa of FARARCH) {
    const L = B.get('plain', 'far'), C = B.get('concrete', 'far'), Mt = B.get('metal', 'far');
    const z0 = RIVER.z0 - 8, z1 = FARBANK.z + 8, zc = (z0 + z1) / 2, half = (z1 - z0) / 2;
    C.set({ col: [0.55, 0.55, 0.53], rm: [0.85, 0, 0], em: [0, 0, 0, 0] });
    C.box(fa.x - 11, fa.y - 2.6, z0, fa.x + 11, fa.y, z1, { faces: 'xXyY', s: 1 });
    const ay = (z) => fa.y - 6 + 70 * (1 - ((z - zc) / half) ** 2);
    for (const s of [-1, 1]) {
      let prev = null;
      for (let i = 0; i <= 40; i++) {
        const z = z0 + (z1 - z0) * i / 40, p = [fa.x + s * 10, ay(z), z];
        if (prev) { Mt.set({ col: hexc(0x9a3a20), rm: [0.5, 0.5, 0], em: [0, 0, 0, 0] }); Mt.beam(prev, p, 1.6, 2.4); L.set({ col: [0.2, 0.2, 0.2], em: em(GOLD, 1.4, DUSK + fa.code) }); L.beam([prev[0], prev[1] + 1.25, prev[2]], [p[0], p[1] + 1.25, p[2]], 0.35, 0.35); }
        if (i % 3 === 0) glows.push({ p: [p[0], p[1] + 1.4, p[2]], color: [1.4, 0.9, 0.35], size: 5, code: DUSK + fa.code, far: true });
        if (i % 2 === 0 && p[1] > fa.y + 1) { Mt.set({ col: [0.3, 0.3, 0.32] }); Mt.box(p[0] - 0.15, fa.y, z - 0.15, p[0] + 0.15, p[1], z + 0.15); }
        prev = p;
      }
    }
    for (let z = z0; z < z1; z += 18) glows.push({ p: [fa.x, fa.y + 7, z], color: [1.8, 1.0, 0.4], size: 4, code: DUSK + fa.code, far: true });
  }
  const { tris } = B.finish(root, { shadowKeys: ['metal'] });
  return { root, anchors: { glows, lights }, colliders, tris };
}
