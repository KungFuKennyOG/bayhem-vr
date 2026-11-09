import * as THREE from 'three';
import { range, rand, clamp, damp, lerp } from '../../rng.js';
import { CELL } from '../../particles.js';
import { Buckets, em, hexc, mix3, DUSK, DIST } from './kit.js';
import { materials } from './mats.js';
import { GLIDE, GLIDE_SPEED, STEER_MAX, BOAT, WATER_Y } from './layout.js';
import { RIVER_U } from './river.js';

// =====================================================================================
//  The glide: a ram-air canopy over you (a fixed frame, like the heli cabin in Level 8), its
//  lines down to your shoulders; a rail through the gorge you can nudge sideways; enemy jumpers
//  on their own canopies (shoot the canopy: it folds and he drops past you into the fog); the
//  gunboat waiting under the end of the line (you land on its deck).
//  Comfort: barely any free fall (the canopy opens 0.7 s after the jump, in slow-mo), a slow
//  steady descent, no swing / no roll, the yaw follows the line at ≤ 3°/s.
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// a ram-air canopy: an arched wing of cells, lines to two risers. y up, the wing's centre at the origin,
// the risers at (±0.24, -drop, 0). col: [top colour, stripe colour]
export function buildCanopy({ top = hexc(0x2a2d30), stripe = hexc(0xc8501a), drop = 6.4, span = 9.2, chord = 3.4, lit = false } = {}) {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const g = new THREE.Group();
  const A = B.get('dbl', 'c');
  const cells = 11, arc = 0.9;   // arc: how far the wing curls down at its tips (radians either side)
  const R = span / 2 / Math.sin(arc);
  const P = (t, c, h) => { const a = (t - 0.5) * 2 * arc; return [Math.sin(a) * (R + h), Math.cos(a) * (R + h) - R, c]; };
  for (let i = 0; i < cells; i++) {
    const t0 = i / cells, t1 = (i + 1) / cells;
    const col = i === 5 || i === 2 || i === 8 ? stripe : top;
    // the underside catches the fires below (a faint warm wash) so the canopy reads against the night sky
    A.set({ col, rm: [0.75, 0, 0], em: em([1, 0.45, 0.2], lit ? 0.12 : 0.05, DUSK + DIST.ALWAYS) });
    // top skin (curved chordwise: thicker at the leading edge), bottom skin, the rib wall
    for (let k = 0; k < 3; k++) {
      const c0 = -chord / 2 + chord * k / 3, c1 = -chord / 2 + chord * (k + 1) / 3;
      const th = (c) => 0.42 * Math.max(0, 1 - Math.pow((c + chord * 0.15) / (chord * 0.62), 2));
      A.quad(P(t0, c0, th(c0)), P(t1, c0, th(c0)), P(t1, c1, th(c1)), P(t0, c1, th(c1)));
      // the underside: dark nylon, every other cell a shade lighter (the cell structure reads from below), seams dark
      // (lighter than it was: from under it, the canopy read as a flat black slab over your head; the stripes show too)
      { const u = (i % 2 ? 0.2 : 0.15) * (k === 1 ? 1.12 : 1); const st = col === stripe; A.set({ col: st ? stripe.map(v => v * 0.6) : [u, u, u * 1.08], em: em([1, 0.45, 0.2], st ? 0.06 : 0.03, DUSK + DIST.ALWAYS) }); }
      A.quad(P(t0, c1, 0), P(t1, c1, 0), P(t1, c0, 0), P(t0, c0, 0));
      A.set({ col, em: em([1, 0.45, 0.2], 0.05, DUSK + DIST.ALWAYS) });
    }
    // the rib seams under each cell wall
    A.set({ col: [0.03, 0.03, 0.035], em: [0, 0, 0, 0] });
    { const a0 = P(t0, -chord / 2, -0.01), a1 = P(t0, chord / 2, -0.01), b0 = P(t0 + 0.006, -chord / 2, -0.01), b1 = P(t0 + 0.006, chord / 2, -0.01); A.quad(a0, a1, b1, b0); }
    // the open cell mouths at the leading edge (dark)
    A.set({ col: [0.04, 0.04, 0.04] }); A.quad(P(t0, -chord / 2, 0), P(t1, -chord / 2, 0), P(t1, -chord / 2, 0.42 * 0.94), P(t0, -chord / 2, 0.42 * 0.94));
  }
  // lines: from the bottom skin at the cell walls down to the two risers
  // (1-px GL lines: thin at any distance — a beam this close to your eye fills the view with a white wedge)
  const lp = [];
  for (let i = 0; i <= cells; i += 2) for (const c of [-chord * 0.35, chord * 0.1, chord * 0.42]) {
    const p = P(i / cells, c, 0), side = p[0] < 0 ? -1 : 1;
    lp.push(...p, side * 0.32, -drop, 0);
  }
  // the risers and the slider
  for (const s of [-1, 1]) lp.push(s * 0.32, -drop, 0, s * 0.26, -drop - 0.38, 0.03);   // the risers (lines too: a mesh this close to the eye blows out)
  { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x15130f, transparent: true, opacity: 0.85 })); ls.frustumCulled = false; g.add(ls); }
  B.finish(g);
  g.userData.drop = drop;
  return g;
}

export class GlideRail {
  constructor() {
    this.curve = new THREE.CatmullRomCurve3(GLIDE.map(p => new THREE.Vector3(...p)), false, 'centripetal', 0.5);
    this.curve.arcLengthDivisions = 2000;
    this.len = this.curve.getLength();
    this.s = 0; this.steer = 0; this.steerV = 0;
    this.pos = new THREE.Vector3(...GLIDE[0]); this.tan = new THREE.Vector3(0, 0, 1);
    this.yaw = Math.atan2(-this.tan.x, -this.tan.z);
  }
  get u() { return clamp(this.s / this.len, 0, 1); }
  get remaining() { return (this.len - this.s) / GLIDE_SPEED; }
  at(s, out) { return this.curve.getPointAt(clamp(s / this.len, 0, 1), out); }
  step(dt, steerIn) {
    this.s = Math.min(this.len, this.s + GLIDE_SPEED * dt);
    const u = this.u;
    this.curve.getPointAt(u, this.pos); this.curve.getTangentAt(u, this.tan);
    // steering: a soft lateral offset (right of travel = +), slows to zero near the end so you still land
    const lim = STEER_MAX * clamp((this.len - this.s) / 60, 0, 1);
    this.steerV = damp(this.steerV, steerIn * 4, 3, dt);
    this.steer = clamp(this.steer + this.steerV * dt, -lim, lim);
    _v.set(-this.tan.z, 0, this.tan.x).normalize();
    this.pos.addScaledVector(_v, this.steer);
    // yaw follows the line, rate-limited (3°/s)
    const want = Math.atan2(-this.tan.x, -this.tan.z);
    let d = want - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += clamp(d, -0.052 * dt, 0.052 * dt);
  }
}

// the gunboat: a 32 m grey river patrol boat. A lofted hull (raked, flared bow; the sheer rising forward;
// a white boot-top at the waterline, a hull number), a stepped superstructure with a lit bridge, a lattice
// radar mast, a twin gun on the foredeck (turns to track you), red / green / white nav lights, fuel drums
// lashed on the stern (its weak spot) and a foam wake. Deck at y 1.25; x = forward.
export function buildGunboat() {
  const M = materials();
  const B = new Buckets(); for (const [k, m] of Object.entries(M)) B.mat(k, m);
  const g = new THREE.Group(); g.name = 'gunboat';
  const A = B.get('plain', 'b'), Mt = B.get('metal', 'b'), W = B.get('win', 'b'), Lt = B.get('plain', 'b');
  const L = 32, x0 = -L / 2, x1 = L / 2;
  // hull sections: [x, half-width at the deck, deck height, half-width at the chine, chine height, keel depth]
  const sec = [];
  for (let i = 0; i <= 16; i++) {
    const x = x0 + L * i / 16, u = (x - x0) / L;
    const bow = Math.max(0, (u - 0.62) / 0.38);                       // 0 aft of the shoulder .. 1 at the stem
    const hwD = 3.8 * Math.sqrt(Math.max(0, 1 - bow * bow * 0.98)) * (1 - bow * 0.15);
    const hwC = 3.4 * Math.sqrt(Math.max(0, 1 - Math.pow(bow, 1.4))) ;
    const yD = 1.25 + bow * bow * 1.4 + (u < 0.06 ? 0 : 0);
    const keel = -1.7 + bow * bow * 1.3 + (u < 0.08 ? (0.08 - u) * 6 : 0);
    sec.push([x, hwD, yD, hwC, 0.15 + bow * 0.6, keel]);
  }
  const HULL = hexc(0x4a5157), HULL2 = hexc(0x3a4046), BOOT = [0.82, 0.82, 0.8];
  A.set({ col: HULL, rm: [0.55, 0.35, 0], em: [0, 0, 0, 0] });
  for (let i = 0; i < sec.length - 1; i++) {
    const [xa, wa, ya, ca, cya, ka] = sec[i], [xb, wb, yb, cb, cyb, kb] = sec[i + 1];
    for (const sd of [-1, 1]) {
      const q = (p0, p1, p2, p3, col) => { A.set({ col }); if (sd > 0) A.quad(p0, p1, p2, p3); else A.quad(p0, p3, p2, p1); };
      // topsides (deck edge to chine), the boot-top stripe, the bottom (chine to keel)
      q([xa, cya + 0.3, sd * ca], [xb, cyb + 0.3, sd * cb], [xb, yb, sd * wb], [xa, ya, sd * wa], i % 2 ? HULL : mix3(HULL, HULL2, 0.4));
      q([xa, cya, sd * ca], [xb, cyb, sd * cb], [xb, cyb + 0.3, sd * cb], [xa, cya + 0.3, sd * ca], BOOT);
      q([xa, ka, 0], [xb, kb, 0], [xb, cyb, sd * cb], [xa, cya, sd * ca], HULL2);
    }
  }
  // the transom
  { const [x, w, y, c, cy, k] = sec[0]; A.set({ col: HULL2 }); const K = [x, k, 0], Cp = [x, cy, c], Cm = [x, cy, -c], Wp = [x, y, w], Wm = [x, y, -w]; for (const [a1, b1] of [[Cp, Wp], [Wp, Wm], [Wm, Cm]]) { A.tri(K, a1, b1); A.tri(K, b1, a1); } }
  // the deck (triangle strips over the sections) and a gunwale on top of the sheer
  const D = B.get('wood', 'b'); D.set({ col: [0.42, 0.4, 0.36], rm: [0.8, 0, 0], em: em([1.0, 0.8, 0.55], 0.12, DUSK + DIST.ALWAYS) });   // lit by the deck lamps
  for (let i = 0; i < sec.length - 1; i++) { const [xa, wa, ya] = sec[i], [xb, wb, yb] = sec[i + 1]; D.quad([xa, ya, wa - 0.15], [xb, yb, wb - 0.15], [xb, yb, -wb + 0.15], [xa, ya, -wa + 0.15]); }
  Mt.set({ col: [0.55, 0.57, 0.6], rm: [0.4, 0.8, 0], em: [0, 0, 0, 0] });
  for (let i = 0; i < sec.length - 1; i++) for (const sd of [-1, 1]) {
    const [xa, wa, ya] = sec[i], [xb, wb, yb] = sec[i + 1];
    Mt.beam([xa, ya + 0.95, sd * (wa - 0.1)], [xb, yb + 0.95, sd * (wb - 0.1)], 0.06, 0.06);
    if (i % 2 === 0 && wa > 0.4) Mt.box(xa - 0.03, ya, sd * (wa - 0.1) - 0.03, xa + 0.03, ya + 0.95, sd * (wa - 0.1) + 0.03, { faces: 'xXzZ' });
  }
  // the hull number on both bows (white stencil from the sign atlas would need text; blocky digits instead)
  A.set({ col: [0.85, 0.85, 0.82] });
  for (const sd of [-1, 1]) for (const [dx, h] of [[0, 1.1], [0.8, 1.1], [1.6, 1.1]]) { const x = 7 + dx, w = 0.55; const hw = 3.55 - (x - 4) * 0.12; A.box(x, 1.0, sd * hw - 0.02, x + w, 1.0 + h, sd * hw + 0.02, { faces: sd > 0 ? 'Z' : 'z' }); }
  // superstructure: a long deckhouse, the bridge on top (lit windows wrapping round), a funnel aft
  A.set({ col: hexc(0x5a6168), em: em([1.0, 0.75, 0.5], 0.06, DUSK + DIST.ALWAYS) });
  A.box(-7, 1.25, -2.6, 4.5, 3.6, 2.6, { faces: 'xXzZY' });
  A.box(-3.5, 3.6, -2.2, 3.5, 6.0, 2.2, { faces: 'xXzZY' });
  W.set({ col: [0.2, 0.22, 0.24], rm: [0.25, 0, 0], em: em([0.9, 1.0, 0.85], 0.35, DUSK + DIST.ALWAYS), cell: [0, 0, 0, 0] });   // the bridge: lit glass all round
  W.box(-3.52, 4.6, -2.22, 3.52, 5.6, 2.22, { faces: 'xXzZ', s: 1, wy0: 4.5 });
  W.box(-7.02, 2.2, -2.62, 4.52, 3.0, 2.62, { faces: 'zZ', s: 1, wy0: 2.1 });
  A.set({ col: hexc(0x2e3236) }); A.box(-6.2, 3.6, -1.0, -4.4, 6.6, 1.0, { faces: 'xXzZY' });
  // the lattice radar mast with a yard, a horn antenna on top
  Mt.set({ col: [0.3, 0.32, 0.34], rm: [0.4, 0.7, 0] });
  for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) Mt.beam([dx * 2, 6.0, dz * 2], [dx * 0.4, 11, dz * 0.4], 0.07, 0.07);
  for (let y = 7; y < 11; y += 1.3) { const k = (y - 6) / 5, r = 1 - k * 0.8; Mt.box(-r, y, -r, r, y + 0.05, r, { faces: 'xXzZ' }); }
  Mt.box(-0.25, 9.6, -2.6, 0.25, 9.7, 2.6); Mt.cyl(0, 11, 0, 0.08, 0.05, 13.2, 6);
  // the foredeck gun: a ring mount; the turret is its own mesh so it can turn
  Mt.set({ col: [0.22, 0.24, 0.24], rm: [0.4, 0.7, 0] });
  const gun = new THREE.Group(); gun.position.set(9.5, 1.9, 0);
  Mt.cyl(9.5, 1.6, 0, 1.0, 1.0, 1.95, 12);
  // nav lights (housing + emissive lens): red port, green starboard, white masthead, white stern
  Lt.set({ col: [1, 0.15, 0.1], rm: [0.3, 0, 0], em: em([1, 0.08, 0.05], 3, DUSK + DIST.ALWAYS) }); Lt.box(-0.3, 6.1, -2.3, 0.3, 6.4, -2.15);
  Lt.set({ col: [0.1, 1, 0.3], rm: [0.3, 0, 0], em: em([0.1, 1, 0.25], 3, DUSK + DIST.ALWAYS) }); Lt.box(-0.3, 6.1, 2.15, 0.3, 6.4, 2.3);
  Lt.set({ col: [1, 1, 1], rm: [0.3, 0, 0], em: em([1, 0.95, 0.85], 3, DUSK + DIST.ALWAYS) }); Lt.box(-0.15, 13.2, -0.15, 0.15, 13.5, 0.15); Lt.box(x0 + 0.2, 2.3, -0.15, x0 + 0.5, 2.6, 0.15);
  B.finish(g);
  const B2 = new Buckets(); for (const [k, m] of Object.entries(M)) B2.mat(k, m);
  const G = B2.get('metal', 'g'); G.set({ col: [0.25, 0.27, 0.27], rm: [0.4, 0.7, 0], em: [0, 0, 0, 0] });
  G.box(-0.8, 0.0, -1.1, 0.6, 1.5, 1.1, { faces: 'xXzZY' });
  G.box(-0.8, 0.0, -1.1, 0.6, 1.2, 1.1, { faces: 'y' });
  for (const z of [-0.3, 0.3]) { G.box(0.6, 0.8, z - 0.08, 3.6, 0.95, z + 0.08, { faces: 'xXzZyY' }); G.box(3.3, 0.76, z - 0.11, 3.7, 0.99, z + 0.11, { faces: 'xXzZyY' }); }
  B2.finish(gun); g.add(gun);
  // the stern: red fuel drums lashed by the rail (the boat's weak spot)
  const drums = new THREE.Group(); const B3 = new Buckets(); for (const [k, m] of Object.entries(M)) B3.mat(k, m);
  const Dr = B3.get('plain', 'd'); Dr.set({ col: hexc(0x8a1a12), rm: [0.5, 0.3, 0], em: [0, 0, 0, 0] });
  for (const [x, z] of [[-14, -1.9], [-14, -0.9], [-13, -1.9], [-13, -0.9], [-14, 0.1]]) Dr.cyl(x, 1.25, z, 0.3, 0.3, 2.15, 10);
  B3.finish(drums); g.add(drums);
  // the wake: a foam V spreading behind the stern, and the bow wave (noise-streaked, scrolling with the boat)
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: RIVER_U.uTime },
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`uniform float uTime; varying vec2 vUv; varying vec3 vW;
      float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
      void main(){
        float along = vUv.y, across = abs(vUv.x - 0.5) * 2.0;
        float edge = smoothstep(0.55, 0.95, across) * 0.8 + (1.0 - smoothstep(0.0, 0.35, across)) * 0.9 * (1.0 - along);   // the two arms + the churned centre
        float n = vn(vec2(vUv.x * 18.0, vUv.y * 40.0 - uTime * 1.6)) * vn(vec2(vUv.x * 7.0 + 3.0, vUv.y * 13.0 - uTime * 0.9));
        float a = edge * smoothstep(0.18, 0.55, n) * (1.0 - smoothstep(0.35, 1.0, along)) * smoothstep(0.0, 0.03, along);
        gl_FragColor = vec4(vec3(0.62, 0.64, 0.66) * 0.55, a * 0.75);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const wake = new THREE.Mesh(new THREE.BufferGeometry(), wakeMat);
  { // a trapezoid from the stern (6 m wide) out to 70 m behind (34 m wide), on the water
    const p = [], uv = [], idx = [];
    const xs = x0 + 0.5, len = 70;
    for (let i = 0; i <= 10; i++) { const t = i / 10, x = xs - t * len, w = 3.2 + t * 17; p.push(x, -0.12, -w, x, -0.12, w); uv.push(0, t, 1, t); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    wake.geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); wake.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wake.geometry.setIndex(idx);
  }
  wake.renderOrder = 16; wake.frustumCulled = false; g.add(wake);
  g.userData = { gun, drums, wake, deck: new THREE.Vector3(-8.5, 1.3, 0.8), lamp: new THREE.Vector3(0.6, 6.4, 0), gunner: new THREE.Vector3(8.2, 1.25, 0), crew: [new THREE.Vector3(-5, 1.25, -2.4), new THREE.Vector3(5.8, 1.6, 2.4)], drumsP: new THREE.Vector3(-13.5, 1.7, -1.2),
    nav: [[new THREE.Vector3(0, 6.25, -2.4), [3, 0.15, 0.1]], [new THREE.Vector3(0, 6.25, 2.4), [0.15, 3, 0.4]], [new THREE.Vector3(0, 13.4, 0), [3, 2.9, 2.6]],
      [new THREE.Vector3(-7.2, 3.8, -2.7), [1.6, 1.3, 0.9]], [new THREE.Vector3(-7.2, 3.8, 2.7), [1.6, 1.3, 0.9]], [new THREE.Vector3(4.6, 3.8, 0), [1.6, 1.3, 0.9]], [new THREE.Vector3(x1 - 1, 2.9, 0), [1.4, 1.2, 0.8]]] };
  return g;
}
export { BOAT, WATER_Y };
