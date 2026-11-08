import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  HAMMER — a utility helicopter (Black Hawk class, fictional), fully procedural.
//  Heli frame: forward -z, up +y, cabin floor at y = 0, the open gunner's door on the LEFT (-x).
//  Exterior: lofted fuselage (superellipse sections), cockpit glazing, engine cowl, tail boom,
//  fin + stabilator, tail rotor, 4-blade main rotor + blur disc, stub wings with an external
//  tank and a rocket pod, wheels. Desert tan with panel lines, soot at the exhausts, worn edges
//  (vertex colours + a small panel-line shader). One opaque draw + glass + rotor blur.
//  Used for your own aircraft (seen from inside: the skin's back faces cull away, the cabin
//  lining in cabin.js is what you see) and for the wingman HAMMER TWO.
// =====================================================================================

const TAN = [0.36, 0.3, 0.22], TAN_D = [0.26, 0.22, 0.16], GREY = [0.2, 0.2, 0.2], BLACK = [0.05, 0.05, 0.05], SOOT = [0.07, 0.06, 0.05];

function colorize(g, c, jitter = 0) {
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c[0], c[1], c[2]], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
const nonIdx = (g) => (g.index ? g.toNonIndexed() : g);

// superellipse ring: half width a, half height b, bottom at y0, exponent p (2 = ellipse, 4+ = boxy)
function ring(z, a, b, yc, p, n = 22) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    out.push([Math.sign(c) * a * Math.pow(Math.abs(c), 2 / p), yc + Math.sign(s) * b * Math.pow(Math.abs(s), 2 / p), z]);
  }
  return out;
}
function loft(stations, n = 22, capEnds = true) {
  const pos = [];
  const rings = stations.map(s => ring(s.z, s.a, s.b, s.yc, s.p ?? 3.2, n));
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pos.push(...A[i], ...B[i], ...B[j], ...A[i], ...B[j], ...A[j]);
    }
  }
  if (capEnds) for (const [R, flip] of [[rings[0], true], [rings[rings.length - 1], false]]) {
    const c = R.reduce((s, p) => [s[0] + p[0] / n, s[1] + p[1] / n, s[2] + p[2] / n], [0, 0, 0]);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (flip) pos.push(...c, ...R[j], ...R[i]); else pos.push(...c, ...R[i], ...R[j]); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // the loft's winding depends on the ring direction: make normals point away from the axis
  const P = g.attributes.position, N = g.attributes.normal;
  let flipAll = 0;
  for (let i = 0; i < P.count; i += 7) { const dx = P.getX(i), dy = P.getY(i) - 0.9; flipAll += Math.sign(dx * N.getX(i) + dy * N.getY(i)); }
  if (flipAll < 0) { for (let i = 0; i < P.count; i += 3) { for (let k = 0; k < 3; k++) { const t = P.getX(i + 1); } } const arr = P.array; for (let i = 0; i < arr.length; i += 9) { for (let k = 0; k < 3; k++) { const t = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = t; } } g.computeVertexNormals(); }
  return g;
}

const CACHE = {};
function build(wings = true) {
  const rng = makeRng(2026);
  const opaque = [], glass = [];
  // ---- fuselage: nose (z -5.4) .. cabin (z -1.8 .. 2.0) .. aft body (z 3.4), floor y = 0
  const st = [
    { z: -5.5, a: 0.25, b: 0.25, yc: 0.75, p: 2.2 },
    { z: -5.15, a: 0.72, b: 0.62, yc: 0.85, p: 2.5 },
    { z: -4.5, a: 1.05, b: 0.95, yc: 1.0, p: 3.0 },
    { z: -3.4, a: 1.25, b: 1.15, yc: 1.05, p: 3.6 },
    { z: -1.8, a: 1.36, b: 1.3, yc: 1.12, p: 4.2 },
    { z: 2.0, a: 1.36, b: 1.3, yc: 1.12, p: 4.2 },
    { z: 3.4, a: 1.05, b: 1.0, yc: 1.25, p: 3.4 },
    { z: 4.6, a: 0.5, b: 0.55, yc: 1.65, p: 2.6 },
  ];
  const fus = loft(st, 26);
  opaque.push(colorize(fus, TAN));
  // engine cowl + rotor pylon on top
  const cowl = loft([{ z: -2.6, a: 0.25, b: 0.12, yc: 2.6, p: 2 }, { z: -2.0, a: 0.85, b: 0.3, yc: 2.72, p: 3.2 }, { z: 1.5, a: 0.9, b: 0.32, yc: 2.75, p: 3.2 }, { z: 3.2, a: 0.55, b: 0.22, yc: 2.6, p: 2.6 }], 18);
  opaque.push(colorize(cowl, TAN));
  // exhausts (sooted)
  for (const sx of [-1, 1]) { const e = new THREE.CylinderGeometry(0.2, 0.24, 0.9, 10).rotateX(Math.PI / 2 - 0.25).rotateY(sx * 0.35); e.translate(sx * 0.82, 2.65, 1.7); opaque.push(colorize(nonIdx(e), SOOT)); }
  // tail boom + fin + stabilator
  const boom = loft([{ z: 4.4, a: 0.48, b: 0.5, yc: 1.7, p: 2.4 }, { z: 9.8, a: 0.22, b: 0.26, yc: 2.0, p: 2.2 }, { z: 10.6, a: 0.18, b: 0.25, yc: 2.05, p: 2.2 }], 14);
  opaque.push(colorize(boom, TAN));
  const fin = new THREE.BoxGeometry(0.16, 2.4, 1.3); { const p = fin.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setZ(i, p.getZ(i) + 0.75); fin.computeVertexNormals(); }
  fin.translate(0, 3.1, 10.55); opaque.push(colorize(nonIdx(fin), TAN));
  const stab = new THREE.BoxGeometry(4.2, 0.08, 0.8); stab.translate(0, 2.0, 10.1); opaque.push(colorize(nonIdx(stab), TAN_D));
  // stub wings with a tank and a rocket pod each side (above the doors)
  for (const sx of [-1, 1]) {
    if (wings) {
    const wing = new THREE.BoxGeometry(2.1, 0.12, 0.85); { const p = wing.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - Math.abs(p.getX(i)) * 0.06 * 0); }
    wing.rotateZ(-sx * 0.12); wing.translate(sx * 2.25, 2.35, -2.35); opaque.push(colorize(nonIdx(wing), TAN_D));
    const pyl = new THREE.BoxGeometry(0.12, 0.45, 0.6); pyl.translate(sx * 2.0, 1.95, -2.35); opaque.push(colorize(nonIdx(pyl), GREY));
    const tank = new THREE.CapsuleGeometry(0.2, 1.3, 4, 10).rotateX(Math.PI / 2); tank.translate(sx * 2.05, 1.72, -2.6); opaque.push(colorize(nonIdx(tank), TAN));
    const pyl2 = new THREE.BoxGeometry(0.1, 0.38, 0.5); pyl2.translate(sx * 3.05, 1.98, -2.35); opaque.push(colorize(nonIdx(pyl2), GREY));
    const pod = new THREE.CylinderGeometry(0.24, 0.24, 1.6, 12).rotateX(Math.PI / 2); pod.translate(sx * 3.05, 1.62, -2.4); opaque.push(colorize(nonIdx(pod), [0.18, 0.19, 0.17]));
    const podF = new THREE.CircleGeometry(0.235, 12); podF.rotateY(Math.PI); podF.translate(sx * 3.05, 1.62, -3.21); opaque.push(colorize(nonIdx(podF), BLACK));
    }
    // main wheels under the cockpit doors
    const strut = new THREE.BoxGeometry(0.12, 0.8, 0.12); strut.rotateZ(sx * 0.35); strut.translate(sx * 1.45, -0.2, -2.25); opaque.push(colorize(nonIdx(strut), GREY));
    const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 14).rotateZ(Math.PI / 2); wheel.translate(sx * 1.62, -0.55, -2.25); opaque.push(colorize(nonIdx(wheel), BLACK));
  }
  const tw = new THREE.CylinderGeometry(0.15, 0.15, 0.14, 10).rotateZ(Math.PI / 2); tw.translate(0, 0.12, 10.0); opaque.push(colorize(nonIdx(tw), BLACK));
  // antennas, a cable cutter
  const ant = new THREE.BoxGeometry(0.04, 0.5, 0.18); ant.translate(0, 2.65, 0.4); opaque.push(colorize(nonIdx(ant), BLACK));
  const cut = new THREE.BoxGeometry(0.05, 0.6, 0.08); cut.rotateX(0.5); cut.translate(0, 2.25, -4.1); opaque.push(colorize(nonIdx(cut), GREY));
  // rotor head + mast
  const mast = new THREE.CylinderGeometry(0.18, 0.24, 0.7, 10); mast.translate(0, 3.1, -0.3); opaque.push(colorize(nonIdx(mast), GREY));
  // ---- cockpit glazing (separate material): windscreen + chin windows + cockpit door windows
  const ws = loft([{ z: -5.1, a: 0.6, b: 0.5, yc: 1.05, p: 2.6 }, { z: -4.45, a: 0.96, b: 0.82, yc: 1.15, p: 3.0 }, { z: -3.5, a: 1.2, b: 0.95, yc: 1.2, p: 3.4 }], 20, false);
  { const p = ws.attributes.position, keep = []; const arr = p.array; const out = [];
    for (let i = 0; i < arr.length; i += 9) { const y = (arr[i + 1] + arr[i + 4] + arr[i + 7]) / 3; if (y > 1.15) out.push(...arr.slice(i, i + 9)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.computeVertexNormals();
    // push it out a hair so it sits on the skin
    const q = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < q.count; i++) q.setXYZ(i, q.getX(i) + n.getX(i) * 0.02, q.getY(i) + n.getY(i) * 0.02, q.getZ(i) + n.getZ(i) * 0.02);
    glass.push(g); }
  for (const sx of [-1, 1]) { const w = new THREE.PlaneGeometry(1.2, 0.8); w.rotateY(sx * Math.PI / 2); w.translate(sx * 1.33, 1.55, -2.8); glass.push(nonIdx(w)); }
  // panel-line + wear shader on the opaque body
  const og = mergeGeometries(opaque.map(nonIdx));
  // darker belly, sooty aft of the exhausts, a little grime gradient
  { const p = og.attributes.position, c = og.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i);
      let k = 0.86 + 0.14 * Math.min(1, Math.max(0, (y - 0.0) / 1.6));
      if (y > 2.0 && z > 1.6 && z < 5.5) k *= 0.55 + 0.45 * Math.min(1, (z - 1.6) / 4);
      c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
    } }
  const gg = mergeGeometries(glass.map(g => { if (g.attributes.uv) g.deleteAttribute('uv'); return g; }));
  // rotor blades (4) and the tail rotor
  const blade = new THREE.BoxGeometry(0.5, 0.06, 7.9); blade.translate(0, 0, 4.15);
  const blades = [];
  for (let k = 0; k < 4; k++) blades.push(nonIdx(blade.clone().rotateY(k * Math.PI / 2)));
  const hub = new THREE.CylinderGeometry(0.42, 0.42, 0.25, 10); blades.push(nonIdx(hub));
  const rotorG = colorize(mergeGeometries(blades), [0.08, 0.08, 0.08]);
  const tb = new THREE.BoxGeometry(0.06, 1.4, 0.18); const tr = [nonIdx(tb), nonIdx(tb.clone().rotateX(Math.PI / 2))];
  const tailRotorG = colorize(mergeGeometries(tr), [0.1, 0.1, 0.1]);
  return { og, gg, rotorG, tailRotorG };
}

const PANEL = /* glsl */`
varying vec3 vObj;
float hpl(float x, float p, float w){ float f = fract(x / p); return 1.0 - smoothstep(0.0, w, min(f, 1.0 - f)); }
`;
export function heliMaterials() {
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 });
  body.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + PANEL).replace('#include <color_fragment>', `#include <color_fragment>
      // panel lines every ~0.9 m along the body and a few round the hoop frames, rivet rows, chipped edges
      float pl = max(hpl(vObj.z, 0.92, 0.012), hpl(vObj.y + vObj.x * 0.2, 0.75, 0.01) * 0.6);
      float wear = smoothstep(0.62, 0.8, fract(sin(dot(floor(vObj * 3.0), vec3(12.9, 78.2, 37.7))) * 43758.5));
      diffuseColor.rgb *= 1.0 - 0.45 * pl;
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.02, wear * 0.25);`);
  };
  body.customProgramCacheKey = () => 'hammer-body';
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0f12, roughness: 0.06, metalness: 0.9, transparent: true, opacity: 0.88 });
  const rotor = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
  // blur disc: dark rotating sectors (one per blade) over a faint disc, alpha by radius
  const blur = new THREE.ShaderMaterial({
    uniforms: { uPhase: { value: 0 }, uAmt: { value: 1 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uPhase; uniform float uAmt; varying vec2 vP;
      void main(){ float r = length(vP) / 8.1; if (r > 1.0 || r < 0.06) discard;
        float a = atan(vP.y, vP.x);
        float bl = pow(max(0.0, cos(2.0 * (a - uPhase))), 14.0);
        float al = (0.07 + 0.2 * bl) * smoothstep(1.0, 0.6, r) * smoothstep(0.06, 0.2, r) * uAmt;
        gl_FragColor = vec4(vec3(0.03) * al, al);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  return { body, glass, rotor, blur };
}

// one helicopter: { root, rotor, tailRotor, blur, mats, update(dt) }
export function buildHammer(mats = heliMaterials(), { wings = true } = {}) {
  const key = wings ? 'w' : 'n';
  CACHE[key] ||= build(wings);
  const G = CACHE[key];
  const root = new THREE.Group();
  const body = new THREE.Mesh(G.og, mats.body); body.name = 'hammerBody'; root.add(body);
  const glass = new THREE.Mesh(G.gg, mats.glass); glass.renderOrder = 2; root.add(glass);
  const rotor = new THREE.Group(); rotor.position.set(0, 3.5, -0.3);
  rotor.add(new THREE.Mesh(G.rotorG, mats.rotor));
  const blurM = mats.blur.clone(); blurM.uniforms = { uPhase: { value: 0 }, uAmt: { value: 1 } };
  const blur = new THREE.Mesh(new THREE.CircleGeometry(8.1, 48).rotateX(-Math.PI / 2), blurM); blur.position.y = 0.04; blur.renderOrder = 3;
  rotor.add(blur);
  root.add(rotor);
  const tailRotor = new THREE.Group(); tailRotor.position.set(0.32, 2.6, 10.6); tailRotor.add(new THREE.Mesh(G.tailRotorG, mats.rotor)); root.add(tailRotor);
  let ph = 0;
  return {
    root, rotor, tailRotor, blur, body, glass, amtK: 1,
    // spin: the blades vanish into the disc (VR-safe: no strobing blade at 72 Hz)
    update(dt, spin = 1) {
      ph += dt * 27 * spin;
      rotor.children[0].visible = spin < 0.4;
      rotor.children[0].rotation.y = ph;
      blurM.uniforms.uPhase.value = ph * 0.13; blurM.uniforms.uAmt.value = Math.min(1, spin * 1.5) * this.amtK;
      tailRotor.rotation.x += dt * 80 * spin;
    },
  };
}
