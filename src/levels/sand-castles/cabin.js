import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SUN_DIR } from '../../atmosphere.js';
import { buildHammer, heliMaterials } from './helimodel.js';

// =====================================================================================
//  HAMMER ONE's cabin — what you look at between the explosions. Heli frame (forward -z,
//  floor y = 0, the open door on the left at x = -1.25). Quilted sound-proofing between frame
//  ribs, a ribbed floor with tie-down rails, troop seats with red webbing on the far wall, a cargo
//  net, the extinguisher, cable runs, a red cabin light, and through the passage the cockpit:
//  two pilots, the instrument panel with lit displays, the windscreen.
//  Lighting: no shadow maps up here, so the lining lets the sun in only where a ray toward the
//  sun leaves through the door opening (analytic, in the shader), and the fill dims away from
//  the door — the cabin is a shaded room with a bright doorway, not a lit box.
// =====================================================================================

export const DOOR = { x: -1.25, z0: -1.25, z1: 1.05, y1: 2.12 };
const CAB = { x0: -1.25, x1: 1.25, z0: -1.75, z1: 1.95, h: 2.28 };

const U = { uW2H: { value: new THREE.Matrix4() }, uSun: { value: new THREE.Vector3() }, uRed: { value: 0.25 }, uWarn: { value: 0 }, uTime: { value: 0 } };

const LINE_GLSL = /* glsl */`
uniform mat4 uW2H; uniform vec3 uSun; uniform float uRed; uniform float uWarn; uniform float uTime;
varying vec3 vObj; varying float vK;
float cH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float cN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cH(i), cH(i + vec3(1,0,0)), f.x), mix(cH(i + vec3(0,1,0)), cH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(cH(i + vec3(0,0,1)), cH(i + vec3(1,0,1)), f.x), mix(cH(i + vec3(0,1,1)), cH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float doorSun(vec3 p){
  vec3 L = normalize((uW2H * vec4(uSun, 0.0)).xyz);
  if (L.x > -0.02) return 0.0;
  float t = (${DOOR.x.toFixed(2)} - p.x) / L.x;
  vec3 h = p + L * t;
  float inZ = smoothstep(${DOOR.z0.toFixed(2)}, ${DOOR.z0.toFixed(2)} + 0.06, h.z) * smoothstep(${DOOR.z1.toFixed(2)}, ${DOOR.z1.toFixed(2)} - 0.06, h.z);
  float inY = smoothstep(-0.05, 0.02, h.y) * smoothstep(${DOOR.y1.toFixed(2)}, ${DOOR.y1.toFixed(2)} - 0.06, h.y);
  return inZ * inY;
}`;

function lineMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aK; varying vec3 vObj; varying float vK;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position; vK = aK;');
    const begin = THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= dSun;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LINE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vK > 0.5 && vK < 1.5) {
          // quilted sound-proofing: diamond stitching + puffed cells
          vec2 q = vec2(vObj.z + vObj.y, vObj.z - vObj.y) / 0.16;
          vec2 f = abs(fract(q) - 0.5);
          float st = smoothstep(0.47, 0.5, max(f.x, f.y));
          float fq = clamp(1.0 - fwidth(q.x) * 1.5, 0.0, 1.0);
          diffuseColor.rgb *= mix(0.93, (0.86 + 0.14 * (1.0 - length(f) * 1.4)) * (1.0 - 0.3 * st), fq);
        } else if (vK > 1.5 && vK < 2.5) {
          // floor: diamond tread plate
          vec2 q = vec2(vObj.x + vObj.z, vObj.x - vObj.z) / 0.06;
          float d = step(0.82, fract(q.x)) * step(0.4, fract(q.y * 0.5));
          float fq = clamp(1.0 - fwidth(q.x) * 1.5, 0.0, 1.0);
          diffuseColor.rgb *= mix(0.96, 0.9 + 0.25 * d, fq);
          // boot-worn path down the middle, dust in the corners
          diffuseColor.rgb *= mix(1.0, 1.35, smoothstep(0.5, 0.0, abs(vObj.x + 0.3)) * (0.5 + 0.5 * cN(vObj * 6.0)));
        } else if (vK > 4.5 && vK < 5.5) {
          // painted door jamb: olive paint, worn lighter along its edges where hands and boots rub it
          float wear = smoothstep(0.55, 0.85, cN(vObj * 11.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.3 + 0.02, wear * 0.25);
        }
        // everything: grime and hand-worn patches, darker low down (no spotless surfaces)
        diffuseColor.rgb *= (0.94 + 0.06 * cN(vObj * 4.3)) * (0.82 + 0.18 * smoothstep(0.0, 0.6, vObj.y));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (vK > 2.5 && vK < 3.5) {
          // displays: a dark bezel, scan lines, a moving horizon / bar graph so they read as instruments
          vec2 q = fract(vObj.xy * vec2(3.3, 3.8));
          float bez = step(0.08, q.x) * step(q.x, 0.92) * step(0.1, q.y) * step(q.y, 0.9);
          float hz = 1.0 - smoothstep(0.0, 0.03, abs(q.y - 0.5 - 0.15 * sin(uTime * 0.7 + vObj.x * 3.0) * (q.x - 0.5)));
          float bars = step(q.y, 0.25 + 0.5 * fract(sin(floor(q.x * 8.0) * 12.9) * 43.7)) * step(0.55, q.x);
          float scan = 0.8 + 0.2 * sin(vObj.y * 900.0);
          totalEmissiveRadiance += vColor.rgb * (0.25 + 1.8 * max(hz, bars * 0.6)) * bez * scan;
        }
        if (vK > 3.5 && vK < 4.5) totalEmissiveRadiance += vec3(1.0, 0.12, 0.05) * (uRed * 0.6 + uWarn * (0.5 + 0.5 * sin(uTime * 9.0)) * 4.0); // red cabin light / warning
        `)
      .replace('#include <lights_fragment_begin>', `float dSun = doorSun(vObj);\n${begin}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        // fill dims away from the door; the red cabin light spills a little
        float near = 1.0 - smoothstep(0.2, 2.3, vObj.x - ${DOOR.x.toFixed(2)});
        float into = 1.0 - smoothstep(0.3, 1.6, max(${DOOR.z0.toFixed(2)} - vObj.z, vObj.z - ${DOOR.z1.toFixed(2)}));
        float fill = 0.45 + 0.55 * near * mix(0.55, 1.0, into); // never a black hole when you turn round into the cabin
        float cao = smoothstep(0.0, 0.35, vObj.y) * smoothstep(0.0, 0.3, 2.28 - vObj.y) * smoothstep(0.0, 0.3, 1.25 - vObj.x) * smoothstep(0.0, 0.3, 1.95 - vObj.z);
        fill *= 0.55 + 0.45 * cao; reflectedLight.directDiffuse *= 0.7 + 0.3 * cao;
        reflectedLight.indirectDiffuse *= fill; reflectedLight.indirectSpecular *= fill;
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.5, 0.04, 0.02) * (uRed * 0.35 + uWarn * 0.5) * smoothstep(1.6, 2.1, 2.1 - abs(vObj.z) * 0.3);`);
  };
  m.customProgramCacheKey = () => 'hammer-cabin';
  return m;
}

function piece(list, w, h, d, x, y, z, col, k = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), kk = new Float32Array(n);
  for (let i = 0; i < n; i++) { c.set(col, i * 3); kk[i] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aK', new THREE.BufferAttribute(kk, 1)); g.deleteAttribute('uv');
  list.push(g);
}
function cyl(list, r, h, x, y, z, col, k = 0, rx = 0, rz = 0, seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, h, seg).toNonIndexed();
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
  g.translate(x, y, z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), kk = new Float32Array(n);
  for (let i = 0; i < n; i++) { c.set(col, i * 3); kk[i] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aK', new THREE.BufferAttribute(kk, 1)); g.deleteAttribute('uv');
  list.push(g);
}

function buildLining() {
  const L = [];
  const QUILT = [0.2, 0.205, 0.165], RIB = [0.15, 0.15, 0.14], FLOOR = [0.11, 0.115, 0.1], DARK = [0.05, 0.05, 0.05], RED = [0.36, 0.05, 0.04], STEEL = [0.32, 0.32, 0.3], YEL = [0.62, 0.45, 0.06], OD = [0.14, 0.15, 0.1];
  const { x0, x1, z0, z1, h } = CAB;
  const T = 0.05;
  // floor + tie-down rails
  piece(L, x1 - x0, T, z1 - z0, 0, -T / 2, (z0 + z1) / 2, FLOOR, 2);
  for (let x = -0.9; x <= 0.95; x += 0.6) piece(L, 0.05, 0.02, z1 - z0 - 0.1, x, 0.01, (z0 + z1) / 2, STEEL);
  // the sill: hazard stripes along the door edge
  for (let z = DOOR.z0; z < DOOR.z1; z += 0.2) piece(L, 0.12, 0.03, 0.1, x0 + 0.06, 0.015, z + 0.05, YEL);
  piece(L, 0.1, 0.05, DOOR.z1 - DOOR.z0, x0 + 0.03, 0.02, (DOOR.z0 + DOOR.z1) / 2, DARK);
  // ceiling
  piece(L, x1 - x0, T, z1 - z0, 0, h + T / 2, (z0 + z1) / 2, QUILT, 1);
  // right wall (opposite the door) + rear and front bulkheads
  piece(L, T, h, z1 - z0, x1 + T / 2, h / 2, (z0 + z1) / 2, QUILT, 1);
  piece(L, x1 - x0, h, T, 0, h / 2, z1 + T / 2, QUILT, 1);
  // front bulkhead with the cockpit passage (x -0.45..0.45, y 0.25..1.75)
  piece(L, 0.8, h, T, -0.85, h / 2, z0 - T / 2, QUILT, 1); piece(L, 0.8, h, T, 0.85, h / 2, z0 - T / 2, QUILT, 1);
  piece(L, 0.9, 0.35, T, 0, h - 0.175, z0 - T / 2, QUILT, 1); piece(L, 0.9, 0.25, T, 0, 0.125, z0 - T / 2, QUILT, 1);
  // left wall around the door: front post, rear post, header
  piece(L, T, h, DOOR.z0 - z0, x0 - T / 2, h / 2, (z0 + DOOR.z0) / 2, QUILT, 1);
  piece(L, T, h, z1 - DOOR.z1, x0 - T / 2, h / 2, (DOOR.z1 + z1) / 2, QUILT, 1);
  piece(L, T, h - DOOR.y1, DOOR.z1 - DOOR.z0, x0 - T / 2, (h + DOOR.y1) / 2, (DOOR.z0 + DOOR.z1) / 2, QUILT, 1);
  // door frame: a thick painted jamb all round the opening (the skin is ~12 cm deep here)
  piece(L, 0.16, DOOR.y1, 0.07, x0 - 0.05, DOOR.y1 / 2, DOOR.z0 - 0.035, [0.24, 0.25, 0.18], 5);
  piece(L, 0.16, DOOR.y1, 0.07, x0 - 0.05, DOOR.y1 / 2, DOOR.z1 + 0.035, [0.24, 0.25, 0.18], 5);
  piece(L, 0.16, 0.07, DOOR.z1 - DOOR.z0 + 0.14, x0 - 0.05, DOOR.y1 + 0.035, (DOOR.z0 + DOOR.z1) / 2, [0.24, 0.25, 0.18], 5);
  for (const z of [DOOR.z0 - 0.075, DOOR.z1 + 0.075]) for (let y = 0.1; y < 0.6; y += 0.16) piece(L, 0.01, 0.07, 0.075, x0 + 0.035, y, z, YEL, 0, 0.5);
  // frame ribs (vertical) and stringers
  for (let z = z0 + 0.3; z < z1; z += 0.55) {
    piece(L, 0.06, h, 0.05, x1 - 0.02, h / 2, z, RIB);
    piece(L, x1 - x0, 0.06, 0.05, 0, h - 0.02, z, RIB);
    if (z < DOOR.z0 - 0.05 || z > DOOR.z1 + 0.05) piece(L, 0.06, h, 0.05, x0 + 0.02, h / 2, z, RIB);
  }
  for (const y of [0.55, 1.35]) piece(L, 0.04, 0.04, z1 - z0, x1 - 0.03, y, (z0 + z1) / 2, RIB);
  // grab bar over the door + a handle on each post
  cyl(L, 0.016, DOOR.z1 - DOOR.z0 - 0.2, x0 + 0.42, h - 0.1, (DOOR.z0 + DOOR.z1) / 2, STEEL, 0, Math.PI / 2);
  for (const z of [DOOR.z0 - 0.12, DOOR.z1 + 0.12]) cyl(L, 0.016, 0.5, x0 + 0.08, 1.2, z, [0.38, 0.3, 0.1]);
  // troop seats on the far wall: tube frames + red webbing backs, folded pans
  for (const z of [-1.3, -0.65, 0.0, 0.65, 1.3]) {
    piece(L, 0.06, 0.6, 0.5, x1 - 0.1, 0.95, z, RED, 0); // webbing back
    for (let k = -1; k <= 1; k++) piece(L, 0.065, 0.02, 0.5, x1 - 0.09, 0.95 + k * 0.18, z, [0.2, 0.03, 0.02]);
    piece(L, 0.42, 0.05, 0.46, x1 - 0.3, 0.45, z, [0.26, 0.04, 0.03]); // pan
    cyl(L, 0.015, 0.45, x1 - 0.5, 0.22, z - 0.21, STEEL); cyl(L, 0.015, 0.45, x1 - 0.5, 0.22, z + 0.21, STEEL);
    cyl(L, 0.015, 0.42, x1 - 0.3, 0.47, z - 0.23, STEEL, 0, 0, Math.PI / 2); cyl(L, 0.015, 0.42, x1 - 0.3, 0.47, z + 0.23, STEEL, 0, 0, Math.PI / 2);
  }
  // cargo net on the rear bulkhead
  for (let x = -1.0; x <= 1.0; x += 0.25) piece(L, 0.035, 1.6, 0.02, x, 0.95, z1 - 0.06, [0.08, 0.085, 0.06]);
  for (let y = 0.25; y <= 1.7; y += 0.25) piece(L, 2.1, 0.035, 0.02, 0, y, z1 - 0.07, [0.08, 0.085, 0.06]);
  // extinguisher, first-aid box, stencilled panel, the red cabin light, cable runs overhead
  cyl(L, 0.07, 0.42, -0.95, 1.25, z1 - 0.12, [0.2, 0.06, 0.045]); cyl(L, 0.03, 0.08, -0.95, 1.5, z1 - 0.12, DARK);
  piece(L, 0.32, 0.22, 0.1, 0.7, 1.55, z1 - 0.1, [0.5, 0.48, 0.42]); piece(L, 0.08, 0.16, 0.02, 0.7, 1.55, z1 - 0.16, [0.55, 0.06, 0.04]); piece(L, 0.16, 0.08, 0.02, 0.7, 1.55, z1 - 0.165, [0.55, 0.06, 0.04]);
  piece(L, 0.18, 0.06, 0.18, 0.3, h - 0.04, 0.2, [1, 0.3, 0.2], 4);
  piece(L, 0.18, 0.06, 0.18, 0.3, h - 0.04, -1.1, [1, 0.3, 0.2], 4);
  for (const x of [-0.6, -0.5, 0.55]) cyl(L, 0.022, z1 - z0 - 0.2, x, h - 0.06, (z0 + z1) / 2, [0.08, 0.08, 0.08], 0, Math.PI / 2);
  piece(L, 0.4, 0.3, 0.12, 1.05, 1.75, 1.6, OD); piece(L, 0.05, 0.05, 0.02, 1.0, 1.82, 1.53, [0.2, 0.9, 0.3], 3); piece(L, 0.05, 0.05, 0.02, 1.08, 1.82, 1.53, [0.95, 0.6, 0.1], 3);
  // monkey straps and a coiled gunner's tether hanging from the ceiling track (it's a working cabin)
  for (const [x, z, l] of [[-0.55, -0.9, 0.55], [-0.35, 0.35, 0.42], [0.2, -0.3, 0.6], [0.6, 0.9, 0.5]]) { piece(L, 0.035, l, 0.006, x, h - l / 2 - 0.04, z, [0.12, 0.12, 0.08]); piece(L, 0.05, 0.03, 0.02, x, h - l - 0.04, z, STEEL); }
  for (let i = 0; i < 5; i++) cyl(L, 0.012, 0.09, -0.2 + Math.sin(i * 1.3) * 0.03, h - 0.5 - i * 0.07, -0.95, [0.5, 0.42, 0.1], 0, 0, Math.PI / 2 + Math.sin(i) * 0.2);
  // stencils: rivet rows along the ribs (dark dots)
  for (let z = z0 + 0.3; z < z1; z += 0.55) for (let y = 0.2; y < h - 0.1; y += 0.12) piece(L, 0.012, 0.012, 0.012, x1 - 0.055, y, z + 0.026, [0.25, 0.25, 0.23]);
  // an ICS intercom box + cord by the door
  piece(L, 0.12, 0.18, 0.08, x0 + 0.06, 1.5, DOOR.z0 - 0.25, OD); piece(L, 0.03, 0.03, 0.01, x0 + 0.06, 1.55, DOOR.z0 - 0.205, [0.2, 0.9, 0.3], 3);
  // ---- cockpit (through the passage): seats, pilots, consoles, the instrument panel
  const cz = -2.65;
  for (const sx of [-0.6, 0.6]) {
    piece(L, 0.55, 0.85, 0.12, sx, 1.0, cz + 0.4, [0.12, 0.12, 0.1]); // seat back
    piece(L, 0.55, 0.12, 0.5, sx, 0.55, cz + 0.1, [0.12, 0.12, 0.1]);
    // the pilot from behind: shoulders, helmet, NVG mount
    piece(L, 0.46, 0.3, 0.26, sx, 1.45, cz + 0.22, [0.25, 0.23, 0.17]);
    piece(L, 0.12, 0.1, 0.18, sx - 0.2, 1.5, cz + 0.2, [0.12, 0.13, 0.1]);
    cyl(L, 0.13, 0.26, sx, 1.75, cz + 0.18, [0.22, 0.22, 0.2], 0, 0, 0, 12);
    piece(L, 0.28, 0.12, 0.2, sx, 1.84, cz + 0.16, [0.24, 0.24, 0.22]);
    piece(L, 0.06, 0.06, 0.1, sx, 1.78, cz + 0.03, [0.06, 0.06, 0.06]);
  }
  piece(L, 0.32, 0.5, 1.1, 0, 0.6, cz - 0.4, [0.1, 0.1, 0.1]);       // centre console
  piece(L, 2.1, 0.55, 0.3, 0, 1.12, cz - 1.0, [0.08, 0.08, 0.08]);   // instrument panel
  piece(L, 2.1, 0.06, 0.45, 0, 1.42, cz - 0.95, [0.06, 0.06, 0.06]); // glare shield
  for (const x of [-0.85, -0.4, 0.4, 0.85]) piece(L, 0.3, 0.26, 0.02, x, 1.12, cz - 0.84, x < 0 ? [0.05, 0.55, 0.25] : [0.12, 0.35, 0.6], 3);
  for (let i = 0; i < 10; i++) piece(L, 0.03, 0.03, 0.02, -0.25 + i * 0.055, 0.9, cz - 0.84, i % 3 ? [0.9, 0.55, 0.1] : [0.2, 0.9, 0.3], 3);
  piece(L, 2.4, 0.06, 2.6, 0, 2.1, cz - 0.3, [0.14, 0.14, 0.12]); // cockpit roof
  piece(L, 0.8, 0.12, 0.9, 0, 2.02, cz - 0.1, [0.1, 0.1, 0.1]);   // overhead console
  for (let i = 0; i < 8; i++) piece(L, 0.025, 0.025, 0.015, -0.3 + i * 0.085, 1.96, cz - 0.3, i % 2 ? [0.9, 0.6, 0.1] : [0.2, 0.8, 0.3], 3);
  piece(L, 2.5, 0.05, 2.6, 0, -0.025, cz - 0.3, FLOOR, 2);
  return mergeGeometries(L);
}

export class Cabin {
  constructor(scene) {
    this.mats = heliMaterials();
    this.hammer = buildHammer(this.mats, { wings: false }); // no stub wings on ours: the gunner's view stays clear
    this.hammer.amtK = 0.3; // seen from under it, a blur disc is barely there (it read as a grey plate across the sky)
    this.root = this.hammer.root;
    this.lineMat = lineMat();
    this.lining = new THREE.Mesh(buildLining(), this.lineMat);
    this.lining.name = 'cabinLining';
    this.root.add(this.lining);
    // the open sliding door, parked back along the outside of the fuselage
    const dg = new THREE.BoxGeometry(0.06, 1.85, 2.0); dg.translate(-1.42, 0.98, 2.05);
    const door = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: 0x3a3d2c, roughness: 0.75, metalness: 0.15 })); this.root.add(door);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.6), new THREE.MeshStandardMaterial({ color: 0x2a2a28, roughness: 0.5, metalness: 0.6 })); rail.position.set(-1.38, DOOR.y1 + 0.1, 0.55); this.root.add(rail);
    const rail2 = rail.clone(); rail2.position.y = -0.04; this.root.add(rail2);
    // stencils: worn military markings on the bulkheads and the door post (one canvas, a few quads)
    { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
      x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, 512, 256);
      x.font = 'bold 44px Oswald, Impact, sans-serif'; x.fillStyle = '#c9b46a'; x.fillText('HAMMER 1', 18, 56);
      x.font = 'bold 26px Oswald, Impact, sans-serif'; x.fillStyle = '#bba760'; x.fillText('SECURE ALL CARGO', 18, 100); x.fillText('BEFORE FLIGHT', 18, 130);
      x.fillStyle = '#b8382a'; x.fillRect(300, 20, 190, 70); x.fillStyle = '#1b1b18'; x.font = 'bold 30px Oswald, Impact, sans-serif'; x.fillText('FIRE EXT.', 318, 66);
      x.fillStyle = '#c9b46a'; x.font = 'bold 34px Oswald, Impact, sans-serif'; x.fillText('NO STEP', 300, 150);
      x.fillStyle = '#d0b040'; for (let i = 0; i < 8; i++) { x.save(); x.translate(18 + i * 60, 190); x.transform(1, 0, -0.6, 1, 0, 0); x.fillRect(0, 0, 30, 46); x.restore(); }
      // wear: knock pixels out
      const id = x.getImageData(0, 0, 512, 256); let r = 7; for (let i = 3; i < id.data.length; i += 4) { r = (r * 16807) % 2147483647; if (r % 100 < 22) id.data[i] *= 0.3; } x.putImageData(id, 0, 0);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const quad = (u0, v0, u1, v1, w, h, pos, ry) => { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < 4; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i)); const m = new THREE.Mesh(g, mat); m.position.set(...pos); m.rotation.y = ry; m.renderOrder = 1; this.root.add(m); };
      quad(0, 0.5, 0.5, 1, 0.9, 0.45, [0.1, 1.72, CAB.z1 - 0.03], Math.PI);           // HAMMER 1 / SECURE ALL CARGO
      quad(0.58, 0.64, 0.97, 0.93, 0.36, 0.13, [-0.95, 1.58, CAB.z1 - 0.03], Math.PI); // FIRE EXT.
      quad(0, 0, 1, 0.28, 1.2, 0.17, [CAB.x1 - 0.04, 0.12, 0.2], -Math.PI / 2);       // hazard stripes on the far wall's foot
      }
    // our own skin: back faces cull away from inside; the lining is what we see
    scene.add(this.root);
    this.seat = new THREE.Object3D(); this.seat.position.set(-0.42, 0, -0.1); this.seat.rotation.y = Math.PI / 2;
    this.root.add(this.seat);
    this.U = U;
    this._inv = new THREE.Matrix4();
  }
  update(dt, time) {
    this.hammer.update(dt, 1);
    this._inv.copy(this.root.matrixWorld).invert();
    U.uW2H.value.copy(this._inv);
    U.uSun.value.copy(SUN_DIR);
    U.uTime.value = time;
  }
  warmMaterials() { return [this.lineMat, this.mats.body, this.mats.glass, this.mats.rotor, this.hammer.blur.material]; }
}
