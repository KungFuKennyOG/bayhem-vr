import * as THREE from 'three';
import { box, at, cyl } from '../../geom.js';
import { makeRng } from '../../rng.js';
import { SUN_DIR, duskShared } from '../../atmosphere.js';
import { HAZE_GLSL } from './water.js';

// =====================================================================================
//  Far shore / horizon: one draw call. A hazy shore band all around the harbour, three
//  skyline layers (city across the water, a taller hazier layer behind it, low industry
//  inland), two hill ridges, a container terminal with STS crane silhouettes, a refinery
//  and anchored ships. Everything uses one shader that fades toward the sky's horizon
//  colour with distance (so the sea never meets a white band) and lights window grids
//  as the dusk deepens. Lights (aircraft-warning blinkers, crane lamps, flare) are
//  returned as glow points in far-group space.
// =====================================================================================

const AW = 2048, AH = 512;
// atlas rows (canvas y, 0 = top). Each layer's "ground" is its bottom row.
const LAYERS = {
  near: { y0: 0, y1: 200 },
  far: { y0: 200, y1: 360 },
  inland: { y0: 360, y1: 472 },
  shore: { y0: 472, y1: 512 },
};
const vOf = (row) => 1 - row / AH;
const SOLID_V = vOf(506);

function makeAtlas() {
  const px = new Uint8ClampedArray(AW * AH * 4);
  const put = (x, y, r, g, a = 255) => { if (x < 0 || x >= AW || y < 0 || y >= AH) return; const i = (y * AW + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = 0; px[i + 3] = a; };
  const rect = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, 0, 0); };
  const towers = { near: [], far: [], inland: [] };
  // ---- skyline layers
  const city = (name, seed, profile, { minW, maxW, base, tall, tallP, litP, pitchX = 2, pitchY = 3 }) => {
    const L = LAYERS[name], g = L.y1 - 1, r = makeRng(seed), Hmax = L.y1 - L.y0 - 6;
    let x = 0;
    while (x < AW) {
      const u = x / AW, prof = profile(u);
      const w = Math.round(minW + r() * (maxW - minW));
      const isTall = r() < tallP * prof;
      let h = Math.round((base * (0.35 + r() * 0.65)) * (0.4 + 0.6 * prof) + (isTall ? tall * (0.45 + r() * 0.55) * prof : 0));
      h = Math.max(4, Math.min(Hmax, h));
      rect(x, g - h + 1, w, h);
      // setback crown on tall towers
      let top = h;
      if (isTall && w > 8 && r() < 0.6) { const sw = Math.max(3, Math.round(w * (0.4 + r() * 0.3))), sh = Math.round(4 + r() * 12); if (h + sh < Hmax) { rect(x + ((w - sw) >> 1), g - h - sh + 1, sw, sh); top = h + sh; } }
      // antenna / mast
      let ant = 0;
      if (isTall && r() < 0.5) { ant = Math.round(5 + r() * 14); if (top + ant < Hmax) { for (let k = 0; k < ant; k++) put(x + (w >> 1), g - top - k, 0, 0); top += ant; } }
      // window grid
      const lit = litP * (0.35 + r() * 1.1), tint = r();
      for (let wy = g - h + 3; wy < g - 1; wy += pitchY) for (let wx = x + 1; wx < x + w - 1; wx += pitchX) {
        if (r() < lit) put(wx, wy, 140 + r() * 115, (tint * 200 + r() * 55) | 0);
      }
      // rooftop light strip on some
      if (isTall && r() < 0.3) for (let k = 1; k < w - 1; k++) put(x + k, g - h + 1, 220, 230);
      if (isTall || h > Hmax * 0.6) towers[name].push({ u: (x + w / 2) / AW, top, ant: ant > 0 });
      x += w + (r() < 0.25 ? Math.round(r() * 6) : 0);
    }
  };
  // near city: downtown cluster right of the sun, a second cluster left; low-rise right at the sun
  const gauss = (u, c, s) => Math.exp(-((u - c) * (u - c)) / (2 * s * s));
  city('near', 11, (u) => 0.25 + 0.75 * gauss(u, 0.36, 0.07) + 0.55 * gauss(u, 0.78, 0.06) + 0.2 * gauss(u, 0.15, 0.1) - 0.2 * gauss(u, 0.5, 0.035),
    { minW: 6, maxW: 22, base: 34, tall: 150, tallP: 0.32, litP: 0.32 });
  city('far', 12, (u) => 0.3 + 0.7 * gauss(u, 0.38, 0.12) + 0.4 * gauss(u, 0.8, 0.1),
    { minW: 8, maxW: 26, base: 40, tall: 110, tallP: 0.35, litP: 0.22 });
  city('inland', 13, (u) => 0.5 + 0.5 * Math.sin(u * 23.0) * Math.sin(u * 7.0),
    { minW: 10, maxW: 44, base: 44, tall: 56, tallP: 0.16, litP: 0.14, pitchX: 3, pitchY: 3 });
  // chimneys on the inland layer
  { const r = makeRng(14), L = LAYERS.inland; for (let i = 0; i < 18; i++) { const x = Math.floor(r() * AW), h = 40 + Math.floor(r() * 50); rect(x, L.y1 - h, 2, h); towers.inland.push({ u: (x + 1) / AW, top: h, ant: true }); } }
  // ---- shore strip: solid, a broken row of waterfront lights
  { const L = LAYERS.shore, r = makeRng(15);
    for (let y = L.y0; y < L.y1; y++) for (let x = 0; x < AW; x++) put(x, y, 0, 0);
    let x = 0; while (x < AW) { const run = 6 + r() * 60, on = r() < 0.55, tint = r() * 255; for (let k = 0; k < run; k++) if (on && r() < 0.5) { put(x + k, L.y0 + 7 + (r() < 0.3 ? 1 : 0), 200 + r() * 55, tint); if (r() < 0.25) put(x + k, L.y0 + 4, 160, tint); } x += run; }
  }
  const c = document.createElement('canvas'); c.width = AW; c.height = AH;
  c.getContext('2d').putImageData(new ImageData(px, AW, AH), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4; t.needsUpdate = true;
  return { texture: t, towers };
}

// geometry accumulator: position, uv, aHaze, aH
class Acc {
  constructor() { this.p = []; this.uv = []; this.hz = []; this.h = []; this.idx = []; }
  v(x, y, z, u, v, hz, h) { this.p.push(x, y, z); this.uv.push(u, v); this.hz.push(hz); this.h.push(h); return this.p.length / 3 - 1; }
  geo(g, haze, groundY = 0) { // add a three geometry with solid uv
    const pos = g.attributes.position, base = this.p.length / 3, ix = g.index;
    for (let i = 0; i < pos.count; i++) this.v(pos.getX(i), pos.getY(i), pos.getZ(i), 0.5, SOLID_V, haze, pos.getY(i) - groundY);
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i)); else for (let i = 0; i < pos.count; i++) this.idx.push(base + i);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aHaze', new THREE.Float32BufferAttribute(this.hz, 1));
    g.setAttribute('aH', new THREE.Float32BufferAttribute(this.h, 1));
    g.setIndex(this.idx); g.computeBoundingSphere();
    return g;
  }
}
const dirOf = (th) => [Math.sin(th), Math.cos(th)];

export function buildFar({ waterY = -2.2 } = {}) {
  const A = new Acc(), glows = [];
  const { texture, towers } = makeAtlas();
  const thSun = Math.atan2(SUN_DIR.x, SUN_DIR.z);
  // textured skyline strip: arc [th0, th1] at radius r, from y0 to y0 + H mapping atlas rows [L.y0, L.y1]
  const strip = (r, th0, th1, y0, H, L, uRep, haze, seg = 160) => {
    const base = A.p.length / 3;
    for (let i = 0; i <= seg; i++) {
      const th = th0 + (th1 - th0) * i / seg, [s, c] = dirOf(th), u = uRep * i / seg;
      A.v(s * r, y0, c * r, u, vOf(L.y1 - 0.5), haze, 0);
      A.v(s * r, y0 + H, c * r, u, vOf(L.y0), haze, H);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; A.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  const towerGlows = (list, r, th0, th1, y0, H, rows, uRep, minFrac, size) => {
    const tw = Math.max(1, uRep);
    for (let rep = 0; rep < tw; rep++) for (const t of list) {
      if (t.top < rows * minFrac) continue;
      const uu = (t.u + rep) / uRep; if (uu > 1) continue;
      const th = th0 + (th1 - th0) * uu, [s, c] = dirOf(th);
      glows.push({ p: new THREE.Vector3(s * (r - 2), y0 + (t.top / rows) * H + 1.5, c * (r - 2)), size, color: [2.4, 0.16, 0.05], blink: true, phase: (t.u * 97) % 6.28, dusk: true });
    }
  };
  // ---- shore band (full ring): bottom well below the water, waterline row, rolling top
  const RS = 920;
  {
    const seg = 320, r = makeRng(21), hs = [];
    let h = 0.5; for (let i = 0; i <= seg; i++) { h += (r() - 0.5) * 0.35; h = Math.max(0, Math.min(1, h)); hs.push(h); }
    for (let p = 0; p < 3; p++) for (let i = 1; i < seg; i++) hs[i] = (hs[i - 1] + hs[i] * 2 + hs[i + 1]) / 4;
    hs[seg] = hs[0];
    const base = A.p.length / 3, L = LAYERS.shore;
    for (let i = 0; i <= seg; i++) {
      const th = thSun + Math.PI * 2 * (i / seg - 0.5), [s, c] = dirOf(th), u = 6 * i / seg;
      const top = 4 + hs[i] * 16;
      A.v(s * RS, -60, c * RS, u, vOf(L.y1 - 0.5), 0.16, 0);
      A.v(s * RS, waterY + 0.4, c * RS, u, vOf(L.y0 + 9), 0.16, 0);
      A.v(s * RS, top, c * RS, u, vOf(L.y0 + 1), 0.16, top);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 3; for (const k of [0, 1]) A.idx.push(a + k, a + 1 + k, a + 3 + k, a + 1 + k, a + 4 + k, a + 3 + k); }
  }
  // ---- skyline layers
  const nearR = 1060, nearTh0 = thSun - 1.3, nearTh1 = thSun + 1.3, nearH = 175;
  strip(nearR, nearTh0, nearTh1, 2, nearH, LAYERS.near, 1, 0.28);
  towerGlows(towers.near, nearR, nearTh0, nearTh1, 2, nearH, 200, 1, 0.42, 7);
  const farR = 1260, farTh0 = thSun - 1.05, farTh1 = thSun + 1.05, farH = 235;
  strip(farR, farTh0, farTh1, 4, farH, LAYERS.far, 1, 0.56);
  towerGlows(towers.far, farR, farTh0, farTh1, 4, farH, 160, 1, 0.55, 9);
  const inR = 980, inTh0 = thSun + 1.3, inTh1 = thSun + Math.PI * 2 - 1.3, inH = 120;
  strip(inR, inTh0, inTh1, 1, inH, LAYERS.inland, 2, 0.18, 200);
  towerGlows(towers.inland, inR, inTh0, inTh1, 1, inH, 112, 2, 0.5, 6);
  // ---- hill ridges (hazy, behind everything)
  const ridge = (radius, height, seed, haze, jag) => {
    const r = makeRng(seed), seg = 200, hs = [];
    let h = 0.5; for (let i = 0; i <= seg; i++) { h += (r() - 0.5) * jag; h = Math.max(0.05, Math.min(1, h)); hs.push(h); }
    for (let p = 0; p < 2; p++) for (let i = 1; i < seg; i++) hs[i] = (hs[i - 1] + hs[i] * 2 + hs[i + 1]) / 4;
    hs[seg] = hs[0];
    const base = A.p.length / 3;
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2, [s, c] = dirOf(th);
      // flatten the ridge right behind the sun so it never eats the sunset
      const sunGap = 1 - 0.75 * Math.exp(-Math.pow(Math.atan2(Math.sin(th - thSun), Math.cos(th - thSun)) / 0.35, 2));
      const top = hs[i] * height * sunGap;
      A.v(s * radius, -30, c * radius, 0.5, SOLID_V, haze, 0);
      A.v(s * radius, top, c * radius, 0.5, SOLID_V, haze, top);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; A.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  };
  ridge(2150, 210, 7, 0.8, 0.2);
  ridge(1750, 120, 13, 0.66, 0.28);
  // ---- container terminal across the harbour: STS crane silhouettes with lamps
  const rr = makeRng(5);
  const place = (g, th, r) => { const [s, c] = dirOf(th); g.applyMatrix4(new THREE.Matrix4().makeRotationY(th + Math.PI)); g.translate(s * r, 0, c * r); return g; };
  for (let i = 0; i < 8; i++) {
    const th = thSun + 0.42 + i * 0.075 + rr() * 0.02, r = RS - 14, sc = 0.9 + rr() * 0.25, up = rr() < 0.35;
    // local: +z toward the harbour (boom side), x along the shore
    const parts = [];
    for (const lx of [-8, 8]) for (const lz of [-7, 7]) parts.push(at(box(1.3 * sc, 44 * sc, 1.3 * sc), lx * sc, 22 * sc, lz * sc));
    parts.push(at(box(18 * sc, 2.6 * sc, 2 * sc), 0, 30 * sc, 7 * sc), at(box(18 * sc, 2.6 * sc, 2 * sc), 0, 30 * sc, -7 * sc));
    parts.push(at(box(2.4 * sc, 2.6 * sc, 16 * sc), -8 * sc, 30 * sc, 0), at(box(2.4 * sc, 2.6 * sc, 16 * sc), 8 * sc, 30 * sc, 0));
    parts.push(at(box(1.4 * sc, 26 * sc, 1.4 * sc), 0, 58 * sc, -4 * sc));
    if (up) parts.push(at(box(2.2 * sc, 62 * sc, 2.6 * sc), 0, 72 * sc, 22 * sc, -0.42));
    else parts.push(at(box(2.4 * sc, 2.6 * sc, 92 * sc), 0, 45 * sc, 18 * sc));
    parts.push(at(box(3 * sc, 4 * sc, 5 * sc), 0, 41 * sc, up ? 2 * sc : 26 * sc)); // trolley/cab
    parts.push(at(box(10 * sc, 6 * sc, 12 * sc), 0, 48 * sc, -18 * sc)); // machinery house / counterweight
    for (const g of parts) A.geo(place(g, th, r), 0.22);
    const tip = new THREE.Vector3(0, up ? 98 * sc : 46.5 * sc, up ? 36 * sc : 63 * sc), apex = new THREE.Vector3(0, 71 * sc, -4 * sc);
    for (const [p, col, size, blink] of [[tip, [2.0, 1.5, 0.9], 6, false], [apex, [2.4, 0.16, 0.05], 6, true]]) {
      const v = p.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(th + Math.PI)); const [s, c] = dirOf(th); v.x += s * r; v.z += c * r;
      glows.push({ p: v, size, color: col, blink, phase: i * 1.7, dusk: true });
    }
    // boom floodlights along the girder
    if (!up) for (let k = 1; k < 4; k++) { const v = new THREE.Vector3(0, 43 * sc, (18 + k * 14) * sc).applyMatrix4(new THREE.Matrix4().makeRotationY(th + Math.PI)); const [s, c] = dirOf(th); v.x += s * r; v.z += c * r; glows.push({ p: v, size: 5, color: [1.9, 1.05, 0.4], dusk: true }); }
  }
  // stacked containers behind the terminal cranes (low blocks)
  for (let i = 0; i < 22; i++) { const th = thSun + 0.4 + i * 0.027, r = RS - 30 - rr() * 30, h = 5 + Math.floor(rr() * 4) * 2.6; A.geo(place(at(box(18 + rr() * 14, h, 14), 0, h / 2, 0), th, r), 0.24); }
  // ---- refinery on the right: columns, tank farm, flare stack
  let flare;
  {
    const th = thSun - 0.78, r = RS - 30;
    for (let i = 0; i < 7; i++) { const g = at(cyl(2.4 + rr() * 1.5, 3, 40 + rr() * 40, 8), (i - 3) * 22, 0, rr() * 20); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); A.geo(place(g, th, r), 0.22); }
    for (let i = 0; i < 10; i++) A.geo(place(at(cyl(9, 9, 14, 14), -120 + i * 24, 7, 40 + (i % 2) * 22), th, r), 0.22);
    const st = at(cyl(1.6, 2.4, 95, 8), 100, 47.5, 10); A.geo(place(st, th, r), 0.22);
    const v = new THREE.Vector3(100, 100, 10).applyMatrix4(new THREE.Matrix4().makeRotationY(th + Math.PI)); const [s, c] = dirOf(th); v.x += s * r; v.z += c * r;
    flare = v;
    glows.push({ p: new THREE.Vector3(100, 96, 10).applyMatrix4(new THREE.Matrix4().makeRotationY(th + Math.PI)).add(new THREE.Vector3(s * r, 0, c * r)), size: 6, color: [2.4, 0.16, 0.05], blink: true, phase: 2, dusk: true });
    for (let i = 0; i < 7; i++) { const p = new THREE.Vector3((i - 3) * 22, 20 + (i % 3) * 14, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(th + Math.PI)).add(new THREE.Vector3(s * r, 0, c * r)); glows.push({ p, size: 5, color: [2.0, 1.25, 0.5], dusk: true }); }
  }
  // ---- anchored ships out in the harbour (dark hulls with deck lights)
  for (const [x, z, L] of [[-320, -520, 140], [150, -470, 110], [480, -600, 180], [-560, -600, 200]]) {
    const ry = Math.atan2(x, z) + Math.PI / 2 + 0.2;
    const parts = [at(box(L, 10, L * 0.16), 0, waterY + 3, 0), at(box(L * 0.14, 14, L * 0.15), L * 0.38, waterY + 14, 0), at(box(L * 0.6, 5, L * 0.12), -L * 0.08, waterY + 10, 0)];
    for (const g of parts) { g.rotateY(ry); g.translate(x, 0, z); A.geo(g, 0.08, waterY); }
    for (let k = 0; k < 5; k++) { const p = new THREE.Vector3(-L * 0.4 + k * L * 0.2, waterY + 9 + (k === 4 ? 12 : 0), 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry); p.x += x; p.z += z; glows.push({ p, size: 4.5, color: [2.0, 1.6, 1.0], dusk: true }); }
  }

  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: texture }, uDusk: duskShared, uSun: { value: SUN_DIR } },
    vertexShader: /* glsl */`
      attribute float aHaze; attribute float aH;
      varying vec2 vUv; varying float vHaze; varying float vH; varying vec3 vW;
      void main() {
        vUv = uv; vHaze = aHaze; vH = aH;
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: HAZE_GLSL + /* glsl */`
      uniform sampler2D uMap; uniform float uDusk; uniform vec3 uSun;
      varying vec2 vUv; varying float vHaze; varying float vH; varying vec3 vW;
      void main() {
        vec4 tx = texture2D(uMap, vUv);
        if (tx.a < 0.5) discard;
        vec3 d = normalize(vW - cameraPosition);
        vec3 hor = horizonCol(d, uSun, uDusk);
        vec3 hz = hazeCol(d, uSun, uDusk);
        float gh = 1.0 - smoothstep(0.0, 60.0, vH);
        float k = clamp(vHaze + gh * 0.16, 0.0, 1.0);
        vec3 col = mix(hz * 0.5, hz * 1.15 + hor * 0.03, k * k);
        float em = smoothstep(0.1, 0.7, uDusk);
        float wv = tx.r * (0.1 + 0.9 * em) * (1.0 - 0.6 * k);
        vec3 wc = tx.g > 0.8 ? vec3(0.62, 0.78, 1.0) : tx.g > 0.55 ? vec3(1.0, 0.86, 0.6) : vec3(1.0, 0.58, 0.24);
        col += wc * wv * 1.5;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    fog: false,
  });
  const mesh = new THREE.Mesh(A.build(), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -30;
  return { mesh, material: mat, glows, flare };
}
