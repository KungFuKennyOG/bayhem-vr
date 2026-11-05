import * as THREE from 'three';
import { makeRng } from '../../rng.js';
import { makeNoise, fbm, makeCanvas, canvasTex } from '../../textures.js';
import { AVE, SUBWAY, streetGround } from './layout.js';
import { Bucket, M4 } from './cars.js';

// =====================================================================================
//  HAVEN METRO interior: stairs, tiled walls, landing, tunnel, turnstiles, platform glimpse,
//  and the tiled inner faces of the street headhouse.
//  Underground nothing is lit by the sun/sky: every surface uses an unlit material whose vertex colours
//  carry baked light (fluorescent tubes + daylight spilling down the open stairwell + corner AO + grime).
//  On top: additive light-pool decals + haze cards, a glaze sheen on tile/metal (view-dependent, in-shader),
//  one dead tube and one flickering tube (an updater). Cheap on Quest: no lights, no PBR.
// =====================================================================================
const SW = AVE.sidewalkY;
const RM0 = [0, 0, 0];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sst = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------------- textures
let TX = null;
function textures() {
  if (TX) return TX;
  // glazed 2:1 subway tile, running bond, thin light grout, cushion edge + glaze gradient. 512 px = 0.48 m (4 x 8)
  const tile = (() => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), r = makeRng(9101), n = makeNoise(9102, 16), n2 = makeNoise(9104, 32);
    const tw = 128, th = 64, tone = [], kind = [];
    for (let k = 0; k < 64; k++) { tone.push((r() - 0.5) * 0.04); const q = r(); kind.push(q < 0.015 ? 1 : q < 0.04 ? 2 : 0); } // 1 = stained, 2 = replacement tile
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const row = (y / th) | 0, off = row % 2 ? tw / 2 : 0, col = (((x + off) % S) / tw) | 0, lx = (x + off) % tw, ly = y % th, id = (row * 4 + col) % 64;
      const e = Math.min(lx, ly, tw - 1 - lx, th - 1 - ly);
      let br = 0.9 + tone[id] + (fbm(n, x / S, y / S, 4, 3) - 0.5) * 0.035;
      let tr = 1, tg = 1, tb = 1;
      if (kind[id] === 1) { tg = 0.97; tb = 0.9; br *= 0.95; }         // yellowed
      if (kind[id] === 2) { tr = 0.97; tg = 1.0; tb = 1.03; br *= 1.03; } // newer, colder replacement
      br *= 1.03 - 0.07 * (ly / th);                                       // glaze: top of each tile catches the light
      if (e < 2) { br = 0.5; tr = 1; tg = 0.97; tb = 0.9; }                 // thin grout
      else if (e < 6) br *= 0.9 + 0.1 * (e - 2) / 4;                       // cushion edge
      br *= 1 - 0.06 * Math.max(0, fbm(n2, x / S, y / S, 2, 3) - 0.55) * 3; // grime in patches (most dirt is baked per vertex)
      const i = (y * S + x) * 4; img.data[i] = br * tr * 250; img.data[i + 1] = br * tg * 249; img.data[i + 2] = br * tb * 243; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 14; k++) { // crazing / cracks
      g.strokeStyle = `rgba(80,70,58,${0.25 + r() * 0.3})`; g.lineWidth = 1; g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 26; y += (r() - 0.3) * 12; g.lineTo(x, y); } g.stroke();
    }
    for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(60,52,44,0.6)'; g.beginPath(); g.arc(r() * S, r() * S, 1.5 + r() * 2.5, 0, 7); g.fill(); } // chips
    return canvasTex(c, { aniso: 8 });
  })();
  // terrazzo floor: warm grey base with chips, brass divider strip at the edge (512 px = 1.5 m)
  const terr = (() => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), r = makeRng(9201), n = makeNoise(9202, 8);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const b = 0.6 + (fbm(n, x / S, y / S, 3, 4) - 0.5) * 0.14, i = (y * S + x) * 4;
      img.data[i] = b * 255; img.data[i + 1] = b * 246; img.data[i + 2] = b * 232; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const chips = ['#d8d2c6', '#3a3836', '#7a5a44', '#676c60', '#a89b84', '#2a2826'];
    for (let k = 0; k < 2600; k++) {
      g.fillStyle = chips[(r() * chips.length) | 0]; const x = r() * S, y = r() * S, s = 1 + r() * 4.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + r() * s); g.lineTo(x + r() * s, y + s); g.closePath(); g.fill();
    }
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(20,18,16,${0.15 + r() * 0.25})`; g.beginPath(); g.arc(r() * S, r() * S, 2 + r() * 5, 0, 7); g.fill(); } // gum / stains
    g.fillStyle = '#6c5a36'; g.fillRect(0, 0, S, 3); g.fillRect(0, 0, 3, S);   // divider strips
    return canvasTex(c, { aniso: 8 });
  })();
  // speckled granite (stair treads, skirting) — 256 px = 0.8 m
  const gran = (() => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), r = makeRng(9301), n = makeNoise(9302, 8);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = fbm(n, x / S, y / S, 4, 4), s = r(), b = 0.6 + (v - 0.5) * 0.18 + (s < 0.06 ? -0.28 : s > 0.96 ? 0.16 : 0), i = (y * S + x) * 4;
      img.data[i] = b * 255; img.data[i + 1] = b * 250; img.data[i + 2] = b * 244; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 18; k++) { g.fillStyle = `rgba(15,14,12,${0.2 + r() * 0.3})`; g.beginPath(); g.arc(r() * S, r() * S, 1.5 + r() * 3, 0, 7); g.fill(); }
    return canvasTex(c, { aniso: 8 });
  })();
  // stained concrete (ceiling, soffit, track bed) — 256 px = 2 m, board-form lines, leaks
  const conc = (() => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), n = makeNoise(9402, 8), n2 = makeNoise(9403, 4);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let b = 0.6 + (fbm(n, x / S, y / S, 4, 5) - 0.5) * 0.25 - Math.max(0, fbm(n2, x / S, y / S, 2, 3) - 0.5) * 1.1;
      if (y % 64 < 2) b *= 0.75;
      const i = (y * S + x) * 4; img.data[i] = b * 255; img.data[i + 1] = b * 248; img.data[i + 2] = b * 238; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvasTex(c, { aniso: 4 });
  })();
  // signs, 4 rows of 1024 x 128: [0] "↑ TO TRAINS ②④⑦", [1] "UPTOWN · DOWNTOWN ②④⑦", [2] GRAND ST enamel tablet, [3] TOKENS
  const sign = (() => {
    const W = 1024, H = 512, c = makeCanvas(W, H), g = c.getContext('2d'), r = makeRng(9501);
    const FONT = '"Anton", Impact, "Arial Black", sans-serif';
    const bullets = (y0) => [['2', '#a8443a'], ['4', '#3f7f52'], ['7', '#71508a']].forEach(([t, col], k) => {
      const x = W - 70 - (2 - k) * 92; g.fillStyle = col; g.beginPath(); g.arc(x, y0 + 64, 37, 0, 7); g.fill();
      g.fillStyle = '#ece6da'; g.font = `400 50px ${FONT}`; g.textAlign = 'center'; g.fillText(t, x, y0 + 67); g.textAlign = 'left';
    });
    const panel = (y0, txt, arrow) => {
      const gr = g.createLinearGradient(0, y0, 0, y0 + 128); gr.addColorStop(0, '#16261c'); gr.addColorStop(1, '#0b1610');
      g.fillStyle = gr; g.fillRect(0, y0, W, 128);
      g.fillStyle = '#d9d3c4'; g.fillRect(0, y0 + 7, W, 3); g.fillRect(0, y0 + 118, W, 3);
      g.textBaseline = 'middle';
      let tx = 40;
      if (arrow) { // up arrow (= straight ahead)
        const ax = 80, ay = y0 + 66; g.beginPath(); g.moveTo(ax, ay - 42); g.lineTo(ax + 34, ay - 6); g.lineTo(ax + 13, ay - 6); g.lineTo(ax + 13, ay + 40); g.lineTo(ax - 13, ay + 40); g.lineTo(ax - 13, ay - 6); g.lineTo(ax - 34, ay - 6); g.closePath(); g.fill();
        tx = 150;
      }
      g.font = `400 ${txt.length > 12 ? 58 : 72}px ${FONT}`; g.fillText(txt, tx, y0 + 66);
      bullets(y0);
    };
    panel(0, 'TO TRAINS', true);
    panel(128, 'UPTOWN · DOWNTOWN', false);
    { // enamel station tablet: flat green with a soft gradient, cream border, centred name
      const y0 = 256, gr = g.createLinearGradient(0, y0, 0, y0 + 128);
      gr.addColorStop(0, '#2f5a43'); gr.addColorStop(0.5, '#264d39'); gr.addColorStop(1, '#1d3d2d');
      g.fillStyle = gr; g.fillRect(0, y0, W, 128);
      g.strokeStyle = '#d8cfb6'; g.lineWidth = 5; g.strokeRect(14, y0 + 14, W - 28, 100);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(20, y0 + 20, W - 40, 22); // enamel sheen
      g.fillStyle = '#ede6d2'; g.font = `400 84px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      if ('letterSpacing' in g) g.letterSpacing = '18px';
      g.fillText('GRAND  ST', W / 2 + 9, y0 + 68); g.textAlign = 'left';
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(20,16,10,${0.2 + r() * 0.35})`; g.beginPath(); g.arc(r() * W, y0 + 10 + r() * 108, 1 + r() * 3.5, 0, 7); g.fill(); } // chips in the enamel
    }
    { const y0 = 384; g.fillStyle = '#1b1712'; g.fillRect(0, y0, W, 128); g.fillStyle = '#e8c070'; g.font = `400 80px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TOKENS · FARE CARDS', W / 2, y0 + 66); g.textAlign = 'left'; }
    return canvasTex(c, { repeat: false, aniso: 8 });
  })();
  // soft radial blob for the additive light pools / haze cards
  const blob = (() => {
    const S = 128, c = makeCanvas(S, S), g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    return canvasTex(c, { repeat: false, aniso: 1 });
  })();
  // water / rust streaks running down from the ceiling line (white = no change; drawn with multiply blending)
  const stain = (() => {
    const Wd = 256, Hd = 512, c = makeCanvas(Wd, Hd), g = c.getContext('2d'), r = makeRng(9601);
    g.fillStyle = '#fff'; g.fillRect(0, 0, Wd, Hd);
    for (let k = 0; k < 16; k++) {
      const x = 10 + r() * (Wd - 20), w = 3 + r() * 14, len = (0.25 + r() * 0.75) * Hd, rust = r() < 0.4;
      const gr = g.createLinearGradient(0, 0, 0, len);
      const col = rust ? [120, 78, 44] : [110, 102, 88], a0 = 0.45 + r() * 0.4;
      gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${a0})`); gr.addColorStop(0.6, `rgba(${col[0]},${col[1]},${col[2]},${a0 * 0.45})`); gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, 0);
      for (let y = 0; y <= len; y += 16) g.lineTo(x - w / 2 + Math.sin(y * 0.05 + k) * 2 + (r() - 0.5) * 2, y);
      for (let y = len; y >= 0; y -= 16) g.lineTo(x + w / 2 * (1 - 0.6 * y / len) + Math.sin(y * 0.05 + k) * 2, y);
      g.closePath(); g.fill();
    }
    const gr = g.createLinearGradient(0, 0, 0, 60); gr.addColorStop(0, 'rgba(90,82,70,0.55)'); gr.addColorStop(1, 'rgba(90,82,70,0)'); g.fillStyle = gr; g.fillRect(0, 0, Wd, 60); // damp band under the ceiling
    return canvasTex(c, { repeat: false, aniso: 4 });
  })();
  TX = { tile, terr, gran, conc, sign, blob, stain };
  return TX;
}
// view-dependent glaze on an unlit material: fresnel + a streak of the ceiling lights, scaled by the baked light
function glaze(m, gloss, sharp) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uGloss = { value: gloss };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGN;\nvarying vec3 vGV;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGN = normalize(normalMatrix * normal); vGV = -mvPosition.xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGN;\nvarying vec3 vGV;\nuniform float uGloss;')
      .replace('#include <opaque_fragment>', `{
        vec3 gn = normalize(vGN), gv = normalize(vGV);
        vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float lum = dot(vColor.rgb, vec3(0.3, 0.5, 0.2));
        float fr = pow(1.0 - clamp(dot(gn, gv), 0.0, 1.0), 4.0);
        float sp = pow(max(dot(reflect(-gv, gn), upV), 0.0), ${sharp.toFixed(1)});
        outgoingLight += vec3(1.0, 0.97, 0.9) * uGloss * min(lum, 0.8) * (fr * 0.5 + sp * 1.8);
      }
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `subway-glaze-${gloss}-${sharp}`;
  return m;
}
let MATS = null;
function materials(propsAtlas) {
  if (MATS && MATS.props.map === propsAtlas) return MATS;
  const T = textures();
  const mk = (map, key) => { const m = new THREE.MeshBasicMaterial({ map, vertexColors: true }); m.name = 'subway-' + key; return m; };
  const add = (key) => { const m = new THREE.MeshBasicMaterial({ map: T.blob, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); m.name = 'subway-' + key; return m; };
  MATS = {
    tile: glaze(mk(T.tile, 'tile'), 0.35, 18), terr: glaze(mk(T.terr, 'terr'), 0.12, 30), gran: mk(T.gran, 'gran'), conc: mk(T.conc, 'conc'),
    sign: mk(T.sign, 'sign'), props: mk(propsAtlas, 'props'), metal: glaze(mk(propsAtlas, 'metal'), 0.9, 10), pool: add('pool'),
    stain: (() => { const m = new THREE.MeshBasicMaterial({ map: T.stain, transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); m.name = 'subway-stain'; return m; })(),
  };
  return MATS;
}

// ---------------------------------------------------------------------- builder
// opts: { atlas (props atlas texture), A (atlas rects), PA (atlas size) }
export function buildSubwayInterior({ atlas, A, PA = 1024 }) {
  const S = SUBWAY, x0 = S.x0, x1 = S.x1, zT = S.zTop, zB = S.zBot, yB = S.yBot, zE = S.zEnd;
  const W = x1 - x0, xc = (x0 + x1) / 2, zH = zB - 3.4, zT2 = zE + 7, xT = x1 + 8;
  const ramp = (z) => streetGround(xc, z);
  const floorAt = (z) => (z <= zT ? SW : z < zB ? ramp(z) : yB);
  const YC = yB + 2.75;                              // landing / tunnel ceiling
  const ceil = (z) => (z < zH ? SW : Math.min(SW - 0.42, ramp(Math.min(z, zB)) + 2.75)); // flush with the lintel, then parallel to the stairs
  // platform glimpse behind the end wall
  const zW2 = zT2 + 0.3, zP = zT2 + 3.0, zF = zP + 4.0, yPC = yB + 3.1, yTr = yB - 1.15, ox0 = x0 + 0.22, ox1 = x1 - 0.22, oy = yB + 2.4;
  const rng = makeRng(5601), nz = makeNoise(5602, 16), nz2 = makeNoise(5603, 8);
  const M = materials(atlas);
  const BK = { tile: new Bucket(), terr: new Bucket(), gran: new Bucket(), conc: new Bucket(), sign: new Bucket(), props: new Bucket(), metal: new Bucket(), pool: new Bucket(), stain: new Bucket() };
  const FL = { props: new Bucket(), pool: new Bucket() };   // the flickering tube (own meshes, toggled by update())
  const glows = [], colliders = [];
  const rUV = (r) => [r[0] / PA, 1 - (r[1] + r[3]) / PA, (r[0] + r[2]) / PA, 1 - r[1] / PA];
  const WHITE = [16 / PA, 1 - 16 / PA];

  // ---- light rig (baked into vertex colours). zone: 'c' corridor/stairs, 'p' platform
  const fix = [];
  for (let z = zH + 1.0, k = 0; z < zT2 - 0.6; z += 3.1, k++) fix.push({ p: [xc, ceil(z) - 0.1, z], k: k === 0 ? 0 : k === 3 ? 0.55 : 1, zone: 'c', dead: k === 0, flick: k === 3 });
  for (let x = x1 + 1.4; x < xT - 1; x += 2.6) fix.push({ p: [x, YC - 0.1, zT2 - W / 2], k: 0.55, zone: 'c', along: 'x' });
  for (const x of [xc - 3.2, xc, xc + 3.2]) fix.push({ p: [x, yPC - 0.1, zT2 + 1.6], k: 0.5, zone: 'p', along: 'x' });
  const zoneOf = (p) => (p[2] > zW2 - 0.02 ? 'p' : 'c');
  const light = (p, n) => {
    let r = 0.014, g = 0.016, b = 0.02;                        // cold ambient
    const zo = zoneOf(p);
    for (const F of fix) {
      if (F.zone !== zo || !F.k) continue;
      const [fx, fy, fz] = F.p, dx = fx - p[0], dy = fy - p[1], dz = fz - p[2], d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) || 1;
      const lam = Math.max(0, (n[0] * dx + n[1] * dy + n[2] * dz) / d) * 0.9 + 0.1;
      const I = F.k * 1.0 * lam / (1 + d2 * 0.75);
      r += I; g += I * 0.97; b += I * 0.86;
    }
    if (zo === 'c') { // dusk daylight falling down the open front of the stairwell (warm, from above)
      const t = sst(zH + 2.5, zT + 0.5, p[2]), up = 0.5 + 0.5 * clamp((p[1] - floorAt(p[2])) / 3.5, 0, 1);
      const day = t * up * (0.55 + 0.45 * Math.max(0, n[1]) + 0.25 * Math.max(0, -n[2]));
      r += day * 0.9; g += day * 0.74; b += day * 0.6;
    }
    return [r, g, b];
  };
  const grime = (p, k = 1) => 1 - k * 0.32 * clamp((fbm(nz, p[0] * 0.35 + p[1] * 0.5, p[2] * 0.35 + p[1] * 0.2, 2, 4) - 0.35) * 2, 0, 1);
  const shade = (p, n, alb, extra = 1) => { const L = light(p, n), k = extra; return [alb[0] * L[0] * k, alb[1] * L[1] * k, alb[2] * L[2] * k]; };
  // above-ground (inside the headhouse): warm dusk light from the open canopy, darker low down
  const dayShade = (p, n, alb) => { const h = clamp((p[1] - SW) / 2.8, 0, 1), k = (0.38 + 0.32 * h) * (0.85 + 0.15 * Math.max(0, -n[2])); return [alb[0] * k * 0.98, alb[1] * k * 0.86, alb[2] * k * 0.74]; };

  // generic tessellated sheet: pos(s,t) -> [x,y,z]; n: normal; uvf(p); colf(p,s,t) -> [r,g,b] (already lit)
  function sheet(bk, nu, nv, pos, n, uvf, colf) {
    const V = [];
    for (let i = 0; i <= nu; i++) { const row = []; for (let j = 0; j <= nv; j++) { const s = i / nu, t = j / nv, p = pos(s, t); row.push({ p, uv: uvf(p), c: colf(p, s, t) }); } V.push(row); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = V[i][j], b = V[i + 1][j], c = V[i + 1][j + 1], d = V[i][j + 1];
      bk.tri(a.p, b.p, c.p, n, n, n, a.uv, b.uv, c.uv, [...a.c, ...b.c, ...c.c], RM0);
      bk.tri(a.p, c.p, d.p, n, n, n, a.uv, c.uv, d.uv, [...a.c, ...c.c, ...d.c], RM0);
    }
  }
  // a transformed geometry with per-vertex baked colour; uv: 'world' (box-projected, sc m/repeat) or an atlas rect / 'white'
  const _v = new THREE.Vector3(), _n3 = new THREE.Matrix3();
  function baked(bk, geo, m4, alb, { uv = 'world', sc = 0.8, rect = null, emit = 0, ao = null, day = false } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    _n3.getNormalMatrix(m4);
    const ru = rect ? rUV(rect) : null;
    for (let i = 0; i < P.count; i += 3) {
      const pts = [], nrm = [], uvs = [], cols = [];
      for (let k = 0; k < 3; k++) {
        _v.fromBufferAttribute(P, i + k).applyMatrix4(m4); const p = [_v.x, _v.y, _v.z];
        _v.fromBufferAttribute(N, i + k).applyMatrix3(_n3).normalize(); const n = [_v.x, _v.y, _v.z];
        pts.push(p); nrm.push(n);
        if (ru && U) uvs.push([ru[0] + (ru[2] - ru[0]) * U.getX(i + k), ru[1] + (ru[3] - ru[1]) * U.getY(i + k)]);
        else if (uv === 'white') uvs.push(WHITE);
        else { const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]); uvs.push(ay >= ax && ay >= az ? [p[0] / sc, p[2] / sc] : ax >= az ? [p[2] / sc, p[1] / sc] : [p[0] / sc, p[1] / sc]); }
        const c = emit ? [alb[0] * emit, alb[1] * emit, alb[2] * emit] : day ? dayShade(p, n, alb) : shade(p, n, alb, ao ? ao(p, n) : 1);
        cols.push(...c);
      }
      bk.tri(pts[0], pts[1], pts[2], nrm[0], nrm[1], nrm[2], uvs[0], uvs[1], uvs[2], cols, RM0);
    }
  }
  const BOX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const CYL = (r0, r1, h, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s, 1, true);
  const segment = (bk, a, b, r, alb, opt, sides = 8) => { // cylinder from a to b
    const Av = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), L = Av.distanceTo(Bv), mid = Av.clone().add(Bv).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(Av).normalize());
    baked(bk, CYL(r, r, L, sides), new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), alb, opt);
  };
  // textured quad from the sign canvas (row 0..3) or the props atlas (rect); colour lit or emissive
  function texQuad(bk, c, right, up, w, h, uv, col) {
    const nrm = new THREE.Vector3(...right).cross(new THREE.Vector3(...up)).normalize().toArray();
    const P = (a, b) => [c[0] + right[0] * a + up[0] * b, c[1] + right[1] * a + up[1] * b, c[2] + right[2] * a + up[2] * b];
    const a = P(-w / 2, -h / 2), b = P(w / 2, -h / 2), cc = P(w / 2, h / 2), d = P(-w / 2, h / 2);
    bk.tri(a, b, cc, nrm, nrm, nrm, [uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], col, RM0);
    bk.tri(a, cc, d, nrm, nrm, nrm, [uv[0], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]], col, RM0);
  }
  const rowUV = (row) => [0, 1 - (row + 1) / 4, 1, 1 - row / 4];

  // ---- tiled walls: green wainscot / maroon cap band / cream field, bands follow the local floor line
  const CREAM = [0.84, 0.82, 0.75], GREEN = [0.24, 0.36, 0.29], MAROON = [0.4, 0.18, 0.13];
  const wallColour = (alb, p, f, top) => {
    const h = p[1] - f, ht = top - p[1];
    const dirt = 0.42 + 0.58 * sst(0.0, 0.48, h) * (0.85 + 0.15 * fbm(nz2, p[2] * 2.2, p[0] + 3, 2, 3));   // kick-up dirt, bottom 0.5 m
    const cornerTop = 0.5 + 0.5 * sst(0.0, 0.45, ht);                                                    // wall/ceiling AO
    const streak = 1 - 0.16 * clamp((fbm(nz2, p[2] * 0.7 + p[0], p[1] * 0.09, 2, 3) - 0.45) * 3, 0, 1) * sst(0.3, 1.6, h); // broad damp (the drips are a decal layer)
    const rust = 1 - 0.3 * clamp((fbm(nz, p[2] * 0.9 + 7, p[1] * 0.25, 2, 3) - 0.58) * 4, 0, 1) * sst(0.8, 0.0, ht + 0.4);
    const g = grime(p, 0.9) * streak * dirt * cornerTop;
    return [alb[0] * g, alb[1] * g * rust, alb[2] * g * rust * rust];
  };
  const TS = 0.48; // tile texture repeat (m)
  // wall along z at x = xw (normal nx) over [za, zb]; top(z). Segments break at zH so the band/ceiling kink never creases.
  function zWall(xw, nx, za, zb, top) {
    const n = [nx, 0, 0], f = (z) => (z < zB ? ramp(Math.max(z, zT)) : yB);
    const cuts = [za, ...[zH, zB].filter((z) => z > za + 0.01 && z < zb - 0.01), zb];
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k], b = cuts[k + 1], nu = Math.max(2, Math.round((b - a) / 0.22));
      const band = (y0f, y1f, nv, alb) => sheet(BK.tile, nu, nv, (s, t) => { const z = a + (b - a) * s, y0 = y0f(z), y1 = Math.max(y0, y1f(z)); return [xw, y0 + (y1 - y0) * t, z]; }, n,
        (p) => [p[2] / TS, p[1] / TS], (p) => shade(p, n, wallColour(alb, p, f(p[2]), top(p[2]))));
      band((z) => f(z) - 0.35, (z) => f(z) + 1.05, 6, GREEN);
      band((z) => f(z) + 1.05, (z) => f(z) + 1.16, 1, MAROON);
      band((z) => f(z) + 1.16, (z) => Math.max(f(z) + 1.16, top(z)), 12, CREAM);
    }
  }
  // wall along x at z = zw (normal nzv) over [xa, xb], floor y0, top y1
  function xWall(zw, nzv, xa, xb, y0 = yB, y1 = YC, light2 = shade) {
    const n = [0, 0, nzv], nu = Math.max(2, Math.round((xb - xa) / 0.3));
    const band = (ya, yb2, nv, alb) => { if (yb2 <= ya) return; sheet(BK.tile, nu, nv, (s, t) => [xa + (xb - xa) * s, ya + (yb2 - ya) * t, zw], n, (p) => [p[0] / TS, p[1] / TS], (p) => light2(p, n, wallColour(alb, p, y0, y1))); };
    band(y0 - 0.05, Math.min(y1, y0 + 1.05), 4, GREEN); band(y0 + 1.05, Math.min(y1, y0 + 1.16), 1, MAROON); band(y0 + 1.16, y1 + 0.02, 6, CREAM);
  }
  const topZ = (z) => (z < zH ? SW : ceil(z) + 0.02);
  zWall(x0 + 0.004, 1, zT, zT2, topZ);
  zWall(x1 - 0.004, -1, zT, zT2 - W, topZ);
  // end wall with an opening onto the platform
  xWall(zT2 - 0.004, -1, x0, ox0); xWall(zT2 - 0.004, -1, ox1, xT);
  sheet(BK.tile, 7, 2, (s, t) => [ox0 + (ox1 - ox0) * s, oy + (YC + 0.02 - oy) * t, zT2 - 0.004], [0, 0, -1], (p) => [p[0] / TS, p[1] / TS], (p) => shade(p, [0, 0, -1], wallColour(CREAM, p, yB, YC)));
  sheet(BK.tile, 7, 1, (s, t) => [ox0 + (ox1 - ox0) * s, oy, zT2 + (zW2 - zT2) * t], [0, -1, 0], (p) => [p[0] / TS, p[2] / TS], (p) => shade(p, [0, -1, 0], MAROON.map((v) => v * 0.6)));
  for (const [x, s] of [[ox0, 1], [ox1, -1]]) sheet(BK.tile, 1, 5, (u, t) => [x, yB + (oy - yB) * t, zT2 + (zW2 - zT2) * u], [s, 0, 0], (p) => [p[2] / TS, p[1] / TS], (p) => shade(p, [s, 0, 0], wallColour(GREEN, p, yB, oy)));
  xWall(zT2 - W + 0.004, 1, x1 - 0.004, xT);  // far wall of the turn

  // ---- stairs: granite treads (worn centre, dirty edges), dark risers, worn aluminium nosing + broken ochre strip
  const n = 28, tl = (zB - zT) / n;
  const TREAD = [0.6, 0.58, 0.54], RISER = [0.34, 0.33, 0.31];
  for (let i = 0; i < n; i++) {
    const za = zT + i * tl, zb2 = za + tl, y = ramp((za + zb2) / 2), yPrev = i ? ramp(za - tl / 2) : SW;
    const tone = 0.92 + rng() * 0.12;
    sheet(BK.gran, 8, 2, (s, t) => [x0 + W * s, y, za + (zb2 - za) * t], [0, 1, 0], (p) => [p[0] / 0.8, p[2] / 0.8], (p, s, t) => {
      const wear = 1 + 0.12 * Math.exp(-((s - 0.5) * (s - 0.5)) / 0.04) - 0.45 * Math.exp(-Math.min(s, 1 - s) / 0.07);
      return shade(p, [0, 1, 0], TREAD.map((v) => v * tone * wear * (0.6 + 0.4 * sst(0, 0.5, t)) * grime(p, 0.6))); // dark in the riser's corner
    });
    sheet(BK.gran, 4, 1, (s, t) => [x0 + W * s, y + (yPrev - y) * t, za], [0, 0, 1], (p) => [p[0] / 0.8, p[1] / 0.8], (p, s, t) => shade(p, [0, 0, 1], RISER.map((v) => v * (0.55 + 0.45 * t) * (1 - 0.35 * Math.exp(-Math.min(s, 1 - s) / 0.08)))));
    baked(BK.metal, BOX(W - 0.07, 0.022, 0.035), M4(xc, yPrev - 0.008, za - 0.018), [0.24, 0.24, 0.23], { uv: 'white' });
    // safety strip: narrow, worn through in places (segments with gaps), dirty ochre
    let xs = x0 + 0.25;
    while (xs < x1 - 0.3) {
      const len = 0.25 + rng() * 0.6, xe = Math.min(x1 - 0.25, xs + len), k = 0.55 + rng() * 0.35;
      if (rng() > 0.18) baked(BK.props, BOX(xe - xs, 0.003, 0.014), M4((xs + xe) / 2, yPrev + 0.002, za - 0.045), [0.34 * k, 0.26 * k, 0.07 * k], { uv: 'white' });
      xs = xe + 0.03 + rng() * 0.12;
    }
  }
  // sloped granite skirting along both walls (stringer) — hides the tread/wall joint; then a baseboard along the tunnel
  for (const [xw, s] of [[x0 + 0.035, 1], [x1 - 0.035, -1]]) {
    const zEndBase = xw < xc ? zT2 : zT2 - W;
    sheet(BK.gran, 20, 1, (u, t) => { const z = zT + (zB - zT) * u; return [xw, ramp(z) - 0.22 + 0.5 * t, z]; }, [s, 0, 0], (p) => [p[2] / 0.8, p[1] / 0.8], (p, u, t) => shade(p, [s, 0, 0], [0.24, 0.23, 0.22].map((v) => v * (0.6 + 0.4 * t))));
    sheet(BK.gran, 20, 1, (u, t) => { const z = zT + (zB - zT) * u, yy = ramp(z) + 0.28; return [xw - s * 0.035 * (1 - t), yy, z]; }, [0, 1, 0], (p) => [p[2] / 0.8, p[0] / 0.8], (p) => shade(p, [0, 1, 0], [0.3, 0.29, 0.27]));
    sheet(BK.gran, 12, 1, (u, t) => [xw, yB - 0.02 + 0.18 * t, zB + (zEndBase - zB) * u], [s, 0, 0], (p) => [p[2] / 0.8, p[1] / 0.8], (p, u, t) => shade(p, [s, 0, 0], [0.24, 0.23, 0.22].map((v) => v * (0.6 + 0.4 * t))));
  }

  // ---- floors: terrazzo landing + tunnel + turn: strong AO at the walls, worn path down the middle
  const floorCol = (p) => {
    const dw = p[0] > x1 ? Math.min(p[2] - (zT2 - W), zT2 - p[2]) : Math.min(p[0] - x0, x1 - p[0]);
    const k = (0.34 + 0.66 * sst(0, 0.7, dw)) * grime(p, 1.1) * (1 - 0.25 * clamp((fbm(nz2, p[0] * 0.6, p[2] * 0.6, 2, 3) - 0.5) * 4, 0, 1));
    return shade(p, [0, 1, 0], [0.74 * k, 0.72 * k, 0.68 * k]);
  };
  sheet(BK.terr, 10, Math.round((zT2 - zB) / 0.4), (s, t) => [x0 + W * s, yB, zB + (zT2 - zB) * t], [0, 1, 0], (p) => [p[0] / 1.5, p[2] / 1.5], floorCol);
  sheet(BK.terr, 18, 9, (s, t) => [x1 + (xT - x1) * s, yB, zT2 - W + W * t], [0, 1, 0], (p) => [p[0] / 1.5, p[2] / 1.5], floorCol);

  // ---- ceiling: dark stained concrete soffit following the stairs, then flat; AO at the walls
  const ceilCol = (n0) => (p) => {
    const dw = p[0] > x1 + 0.01 ? Math.min(p[2] - (zT2 - W), zT2 - p[2]) : Math.min(p[0] - x0, x1 - p[0]);
    return shade(p, n0, [0.2, 0.195, 0.19].map((v) => v * grime(p, 1.4) * (0.45 + 0.55 * sst(0, 0.6, dw))));
  };
  sheet(BK.conc, 6, Math.round((zT2 - zH) / 0.4), (s, t) => { const z = zH + (zT2 - zH) * t; return [x0 + W * s, ceil(z), z]; }, [0, -1, 0], (p) => [p[0] / 2, p[2] / 2], ceilCol([0, -1, 0]));
  sheet(BK.conc, 16, 4, (s, t) => [x1 + (xT - x1) * s, YC, zT2 - W + W * t], [0, -1, 0], (p) => [p[0] / 2, p[2] / 2], ceilCol([0, -1, 0]));
  { // lintel where the covered part starts: tiled face + TO TRAINS lightbox
    const yL0 = SW - 0.42, zl = zH - 0.02;
    sheet(BK.tile, 8, 2, (s, t) => [x0 + W * s, yL0 + (SW + 0.02 - yL0) * t, zl], [0, 0, -1], (p) => [p[0] / TS, p[1] / TS], (p) => shade(p, [0, 0, -1], CREAM.map((v) => v * grime(p, 0.8))));
    sheet(BK.tile, 8, 1, (s, t) => [x0 + W * s, yL0 + 0.06 * t, zl - 0.001], [0, 0, -1], (p) => [p[0] / TS, p[1] / TS], (p) => shade(p, [0, 0, -1], MAROON));
    baked(BK.metal, BOX(2.18, 0.35, 0.08), M4(xc, yL0 + 0.24, zl - 0.045), [0.12, 0.13, 0.12], { uv: 'white' });
    texQuad(BK.sign, [xc, yL0 + 0.24, zl - 0.09], [-1, 0, 0], [0, 1, 0], 2.06, 0.26, rowUV(0), [0.95, 0.92, 0.85]);
  }

  // ---- fluorescent fixtures (housing + diffuser), light pools on walls/floor, haze cards; conduit along the corners
  const pool = (bk, c, right, up, w, h, I) => texQuad(bk, c, right, up, w, h, [0, 0, 1, 1], [I * 1.0, I * 0.95, I * 0.82]);
  for (const F of fix) {
    const [fx, fy, fz] = F.p, alongX = F.along === 'x', bk = F.flick ? FL : BK, kk = F.flick ? 1 : F.k;
    baked(BK.props, alongX ? BOX(1.25, 0.07, 0.24) : BOX(0.24, 0.07, 1.25), M4(fx, fy + 0.06, fz), [0.18, 0.19, 0.19], { uv: 'white' });
    if (F.dead) { baked(BK.props, BOX(0.17, 0.014, 1.15), M4(fx, fy + 0.02, fz), [0.12, 0.12, 0.11], { uv: 'white', emit: 1 }); continue; }
    baked(bk.props, alongX ? BOX(1.15, 0.014, 0.17) : BOX(0.17, 0.014, 1.15), M4(fx, fy + 0.02, fz), [0.95, 1.0, 0.92], { uv: 'white', emit: 1.5 * (0.6 + 0.4 * kk) });
    const gl = { p: [fx, fy - 0.02, fz], color: [0.5 * kk, 0.55 * kk, 0.48 * kk], size: 1.2 };
    glows.push(gl); if (F.flick) FL.glow = gl;
    if (F.zone !== 'c' || alongX) continue;
    const fl = floorAt(fz);
    pool(bk.pool, [fx, fy - 0.002, fz], [1, 0, 0], [0, 0, 1], 1.0, 2.0, 0.22 * kk);           // halo on the ceiling
    for (const [xw, s] of [[x0 + 0.008, 1], [x1 - 0.008, -1]]) {                               // pools on the walls
      if (s < 0 && fz > zT2 - W - 0.5) continue;
      pool(bk.pool, [xw, (fy + fl) / 2 + 0.25, fz], [0, 0, -s], [0, 1, 0], 3.4, 2.4, 0.13 * kk);
    }
    if (fz > zB) pool(bk.pool, [fx, yB + 0.004, fz], [1, 0, 0], [0, 0, -1], 2.8, 3.4, 0.16 * kk); // floor pool
    pool(bk.pool, [fx, (fy + fl) / 2, fz + 0.4], [1, 0, 0], [0, 1, 0], W * 0.9, fy - fl, 0.035 * kk); // haze card
  }
  for (const xw of [x0 + 0.22, x1 - 0.22]) {
    let prev = null;
    for (let z = zH + 0.3; z <= (xw < xc ? zT2 : zT2 - W) - 0.1; z += 0.8) {
      const p = [xw, ceil(z) - 0.07, z];
      if (prev) segment(BK.props, prev, p, 0.028, [0.16, 0.19, 0.16], { uv: 'white' }, 6);
      if (Math.round(z / 0.8) % 3 === 0) baked(BK.props, BOX(0.08, 0.03, 0.03), M4(xw, ceil(z) - 0.025, z), [0.12, 0.12, 0.12], { uv: 'white' });
      prev = p;
    }
    baked(BK.props, BOX(0.18, 0.18, 0.08), M4(xw, ceil(zB + 2) - 0.14, zB + 2), [0.17, 0.18, 0.17], { uv: 'white' }); // junction box
  }

  // ---- handrails: 4.5 cm dark green steel, wall brackets every ~1.2 m, ends return to the wall
  const RAIL = [0.07, 0.13, 0.09];
  for (const [x, s, wx] of [[x0 + 0.1, 1, x0 + 0.004], [x1 - 0.1, -1, x1 - 0.004]]) {
    const pts = [[zT + 0.25, SW + 0.92], [zB, yB + 0.92], [zE + 1.0, yB + 0.92]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [za, ya] = pts[i], [zb2, yb] = pts[i + 1];
      segment(BK.metal, [x, ya, za], [x, yb, zb2], 0.0225, RAIL, { uv: 'white' });
      const L = Math.hypot(zb2 - za, yb - ya), nb = Math.max(1, Math.round(L / 1.2));
      for (let k = 0; k <= nb; k++) {
        const t = k / nb, z = za + (zb2 - za) * t, y = ya + (yb - ya) * t;
        segment(BK.metal, [wx, y - 0.04, z], [x, y - 0.01, z], 0.011, RAIL, { uv: 'white' }, 6);
        baked(BK.metal, CYL(0.035, 0.035, 0.012, 8), M4(wx + s * 0.006, y - 0.04, z, 0, 0, Math.PI / 2), RAIL, { uv: 'white' });
      }
    }
    for (const [z, y, dz] of [[zT + 0.25, SW + 0.92, 0.12], [zE + 1.0, yB + 0.92, -0.12]]) { // end returns: bend down + back into the wall
      segment(BK.metal, [x, y, z], [x, y - 0.05, z - dz * 0.6], 0.0225, RAIL, { uv: 'white' });
      segment(BK.metal, [x, y - 0.05, z - dz * 0.6], [wx, y - 0.08, z - dz * 0.7], 0.0225, RAIL, { uv: 'white' });
    }
  }

  // ---- station name tablets (enamel, every instance has text), posters + system map with clear gaps
  const framed = (xw, s, z, y, w, h, uv, bk, lit = 0.92) => {
    baked(BK.metal, BOX(0.025, h + 0.07, w + 0.07), M4(xw + s * 0.012, y, z), [0.14, 0.12, 0.09], { uv: 'white' });
    const nrm = [s, 0, 0], p = [xw + s * 0.026, y, z], col = shade(p, nrm, [lit, lit, lit]).map((v) => v * grime(p, 0.6));
    texQuad(bk, p, [0, 0, -s], [0, 1, 0], w, h, uv, col);
  };
  const items = [ // [wall, z, y-above-floor, kind]
    [-1, zB + 4.3, 1.3, 'map'], [1, zB + 2.6, 1.3, 'poster'], [-1, zB + 1.5, 1.3, 'ad'],
  ];
  for (const [xw, s] of [[x0 + 0.004, 1], [x1 - 0.004, -1]]) {
    for (let z = zH + 1.3; z < zT2 - 1.0; z += 3.1) {
      if (s < 0 && z > zT2 - W - 1.2) continue;
      const f = z < zB ? ramp(z) : yB, y = f + 2.0;
      if (y + 0.2 > ceil(z) - 0.08) continue;
      framed(xw, s, z, y, 1.7, 0.21, rowUV(2), BK.sign, 0.9);
    }
  }
  for (const [side, z, hy, kind] of items) {
    const xw = side > 0 ? x0 + 0.004 : x1 - 0.004, s = side > 0 ? 1 : -1;
    if (kind === 'map') framed(xw, s, z, yB + hy, 1.25, 0.84, rUV(A.map), BK.props);
    else framed(xw, s, z, yB + hy, 0.66, 0.99, rUV(kind === 'poster' ? A.poster : A.ad2), BK.props);
  }
  // hanging TO TRAINS sign over the landing: metal bezel, dirty face, a slight tilt, one cable hanging loose
  {
    const c = new THREE.Vector3(xc, yB + 2.12, zB + 2.6), e = new THREE.Euler(0.06, 0.03, -0.035), q = new THREE.Quaternion().setFromEuler(e);
    const R = new THREE.Vector3(-1, 0, 0).applyQuaternion(q).toArray(), U = new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray(), Nf = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const m4 = new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1));
    baked(BK.metal, BOX(2.06, 0.38, 0.09), m4, [0.13, 0.13, 0.12], { uv: 'white' });
    for (const [dy, hh] of [[0.18, 0.022], [-0.18, 0.022]]) baked(BK.metal, BOX(2.1, hh, 0.11), m4.clone().multiply(M4(0, dy, 0)), [0.2, 0.2, 0.19], { uv: 'white' });
    const dirt = [0.66, 0.62, 0.55];
    texQuad(BK.sign, c.clone().addScaledVector(Nf, 0.047).toArray(), R, U, 1.94, 0.27, rowUV(0), dirt);
    texQuad(BK.sign, c.clone().addScaledVector(Nf, -0.047).toArray(), R.map((v) => -v), U, 1.94, 0.27, rowUV(1), dirt.map((v) => v * 0.85));
    const top = (dx) => new THREE.Vector3(dx, 0.19, 0).applyQuaternion(q).add(c).toArray();
    segment(BK.props, top(-0.8), [xc - 0.8, YC, zB + 2.6], 0.008, [0.12, 0.12, 0.12], { uv: 'white' }, 5);
    segment(BK.props, top(0.8), [xc + 0.8, YC, zB + 2.6], 0.008, [0.12, 0.12, 0.12], { uv: 'white' }, 5);
    // loose cable: from the ceiling, sagging down past the sign's right end
    const cab = [[xc + 1.15, YC, zB + 2.75], [xc + 1.2, YC - 0.25, zB + 2.72], [xc + 1.18, YC - 0.55, zB + 2.66], [xc + 1.1, YC - 0.8, zB + 2.62], [xc + 1.04, YC - 0.92, zB + 2.63]];
    for (let i = 0; i < cab.length - 1; i++) segment(BK.props, cab[i], cab[i + 1], 0.007, [0.05, 0.05, 0.05], { uv: 'white' }, 5);
  }
  // sign over the platform opening
  baked(BK.metal, BOX(2.3, 0.31, 0.06), M4(xc, oy + 0.18, zT2 - 0.035), [0.12, 0.13, 0.12], { uv: 'white' });
  texQuad(BK.sign, [xc, oy + 0.18, zT2 - 0.068], [-1, 0, 0], [0, 1, 0], 2.2, 0.26, rowUV(1), [0.8, 0.77, 0.7]);

  // ---- platform glimpse through the opening: dim platform, worn edge stripe, dark track pit, tunnel lights
  {
    const PX0 = x0 - 6, PX1 = xT + 2;
    const pcol = (p) => shade(p, [0, 1, 0], [0.72, 0.7, 0.66].map((v) => v * grime(p, 1.0)));
    sheet(BK.terr, 16, 4, (s, t) => [PX0 + (PX1 - PX0) * s, yB, zW2 + (zP - 0.6 - zW2) * t], [0, 1, 0], (p) => [p[0] / 1.5, p[2] / 1.5], pcol);
    sheet(BK.props, 16, 1, (s, t) => [PX0 + (PX1 - PX0) * s, yB, zP - 0.6 + 0.45 * t], [0, 1, 0], () => WHITE, (p) => shade(p, [0, 1, 0], [0.7, 0.55, 0.12].map((v) => v * grime(p, 1.2))));  // tactile strip
    sheet(BK.props, 16, 1, (s, t) => [PX0 + (PX1 - PX0) * s, yB, zP - 0.15 + 0.15 * t], [0, 1, 0], () => WHITE, (p) => shade(p, [0, 1, 0], [0.5, 0.49, 0.46]));                        // edge coping
    sheet(BK.conc, 16, 1, (s, t) => [PX0 + (PX1 - PX0) * s, yB - (yB - yTr) * t, zP], [0, 0, 1], (p) => [p[0] / 2, p[1] / 2], (p) => shade(p, [0, 0, 1], [0.12, 0.11, 0.1]));             // edge face
    sheet(BK.conc, 16, 2, (s, t) => [PX0 + (PX1 - PX0) * s, yTr, zP + (zF - zP) * t], [0, 1, 0], (p) => [p[0] / 2, p[2] / 2], (p) => shade(p, [0, 1, 0], [0.09, 0.085, 0.08]));             // track bed
    for (const z of [zP + 1.2, zP + 2.65]) segment(BK.metal, [PX0, yTr + 0.15, z], [PX1, yTr + 0.15, z], 0.03, [0.3, 0.29, 0.27], { uv: 'white' }, 5);       // rails
    xWall(zF - 0.004, -1, PX0, PX1, yTr, yPC);                                                                                                               // far tunnel wall
    sheet(BK.conc, 16, 4, (s, t) => [PX0 + (PX1 - PX0) * s, yPC, zW2 + (zF - zW2) * t], [0, -1, 0], (p) => [p[0] / 2, p[2] / 2], (p) => shade(p, [0, -1, 0], [0.12, 0.115, 0.11]));
    for (const x of [xc - 2.4, xc + 2.4]) { // I-beam columns, dark green paint
      baked(BK.metal, BOX(0.22, yPC - yB, 0.05), M4(x, (yPC + yB) / 2, zT2 + 1.75 - 0.1), [0.06, 0.12, 0.08], { uv: 'white' });
      baked(BK.metal, BOX(0.22, yPC - yB, 0.05), M4(x, (yPC + yB) / 2, zT2 + 1.75 + 0.1), [0.06, 0.12, 0.08], { uv: 'white' });
      baked(BK.metal, BOX(0.03, yPC - yB, 0.2), M4(x, (yPC + yB) / 2, zT2 + 1.75), [0.05, 0.1, 0.07], { uv: 'white' });
    }
    // hanging GRAND ST sign under the platform ceiling, seen through the opening
    baked(BK.metal, BOX(1.9, 0.3, 0.05), M4(xc + 2.6, yB + 2.75, zT2 + 1.2), [0.12, 0.12, 0.11], { uv: 'white' });
    texQuad(BK.sign, [xc + 2.6, yB + 2.75, zT2 + 1.2 - 0.028], [-1, 0, 0], [0, 1, 0], 1.8, 0.22, rowUV(2), [0.62, 0.6, 0.55]);
    for (const dx of [-0.8, 0.8]) segment(BK.props, [xc + 2.6 + dx, yB + 2.9, zT2 + 1.2], [xc + 2.6 + dx, yPC, zT2 + 1.2], 0.008, [0.1, 0.1, 0.1], { uv: 'white' }, 5);
    // a train standing at the platform: stainless car side, lit windows, one door open
    {
      const zs = zP + 0.3, X0 = PX0 - 0.5, X1 = PX1 + 0.5, yb0 = yTr + 0.3, yb1 = yB + 2.25, SS = [0.2, 0.205, 0.215];
      const side = (xa, xb, ya, yb2, nu, nv) => sheet(BK.metal, nu, nv, (s, t) => [xa + (xb - xa) * s, ya + (yb2 - ya) * t, zs], [0, 0, -1], () => WHITE, (p) => shade(p, [0, 0, -1], SS.map((v) => v * (0.7 + 0.3 * sst(yb0, yB + 1.0, p[1])) * grime(p, 0.8))));
      const dx0 = xc - 0.65, dx1 = xc + 0.65;  // the open doorway stays a hole
      side(X0, dx0, yb0, yb1, 12, 6); side(dx1, X1, yb0, yb1, 12, 6); side(dx0, dx1, yB + 1.95, yb1, 2, 1); side(dx0, dx1, yb0, yB, 2, 1);
      baked(BK.props, BOX(X1 - X0, 0.08, 0.02), M4((X0 + X1) / 2, yB + 0.62, zs - 0.012), [0.3, 0.1, 0.09], { uv: 'white' });          // stripe
      sheet(BK.metal, 24, 2, (s, t) => [X0 + (X1 - X0) * s, yb1 + 0.28 * Math.sin(t * 1.4), zs + 0.5 * (1 - Math.cos(t * 1.4))], [0, 0.7, -0.7], () => WHITE, (p) => shade(p, [0, 0.7, -0.7], [0.12, 0.12, 0.125])); // roof curve
      baked(BK.props, BOX(X1 - X0, yb0 - yTr, 2.6), M4((X0 + X1) / 2, (yTr + yb0) / 2, zs + 1.3), [0.02, 0.02, 0.02], { uv: 'white' }); // trucks
      for (let k = -9; k <= 9; k++) {
        const x = xc + k * 2.3; if (x < X0 + 0.9 || x > X1 - 0.9) continue;
        const door = k % 2 === 0, open = k === 0;
        if (open) { // open door: a lit car interior (seats, grab pole, far-side windows)
          const zi = zs + 2.7, ic = (c, e = 0.8) => ({ uv: 'white', emit: e });
          baked(BK.props, BOX(1.3, 0.01, 2.7), M4(x, yB + 0.01, zs + 1.35), [0.3, 0.3, 0.29], ic(0, 0.75));               // floor
          baked(BK.props, BOX(3.2, 2.0, 0.02), M4(x, yB + 1.0, zi), [0.62, 0.64, 0.6], ic(0, 0.8));                        // far wall
          for (const dx of [-0.85, 0.85]) baked(BK.props, BOX(1.0, 0.6, 0.012), M4(x + dx, yB + 1.45, zi - 0.015), [0.04, 0.05, 0.06], { uv: 'white' }); // dark windows
          baked(BK.props, BOX(3.2, 0.45, 0.45), M4(x, yB + 0.42, zi - 0.25), [0.72, 0.36, 0.1], ic(0, 0.75));              // bench
          baked(BK.props, BOX(3.2, 0.02, 2.7), M4(x, yB + 2.2, zs + 1.35), [0.85, 0.85, 0.8], ic(0, 1.1));                 // ceiling light
          baked(BK.props, CYL(0.02, 0.02, 2.2, 8), M4(x + 0.25, yB + 1.1, zs + 0.9), [0.8, 0.62, 0.1], ic(0, 0.9));        // grab pole
          for (const dx of [-0.66, 0.66]) baked(BK.props, BOX(0.04, 1.95, 0.06), M4(x + dx, yB + 0.98, zs - 0.01), [0.02, 0.02, 0.02], { uv: 'white' }); // rubber edges
          baked(BK.props, BOX(1.36, 0.06, 0.06), M4(x, yB + 1.97, zs - 0.01), [0.02, 0.02, 0.02], { uv: 'white' });
          glows.push({ p: [x, yB + 1.1, zs + 0.2], color: [0.3, 0.32, 0.28], size: 2.2 });
        } else if (door) {
          baked(BK.props, BOX(1.3, 1.95, 0.02), M4(x, yB + 0.99, zs - 0.012), [0.2, 0.21, 0.22], { uv: 'white' });
          for (const dx of [-0.32, 0.32]) baked(BK.props, BOX(0.36, 0.7, 0.01), M4(x + dx, yB + 1.4, zs - 0.024), [0.7, 0.75, 0.72], { uv: 'white', emit: 0.85 });
        } else {
          for (const dx of [-0.6, 0.6]) {
            baked(BK.props, BOX(1.02, 0.84, 0.01), M4(x + dx * 0.95, yB + 1.42, zs - 0.008), [0.03, 0.03, 0.03], { uv: 'white' });
            baked(BK.props, BOX(0.9, 0.72, 0.012), M4(x + dx * 0.95, yB + 1.42, zs - 0.014), [0.5, 0.56, 0.54], { uv: 'white', emit: 0.7 });
            baked(BK.props, BOX(0.9, 0.3, 0.013), M4(x + dx * 0.95, yB + 1.2, zs - 0.016), [0.05, 0.06, 0.08], { uv: 'white' }); // seat backs
          }
        }
      }
      // destination sign over the open door
      baked(BK.props, BOX(0.9, 0.16, 0.02), M4(xc, yB + 2.1, zs - 0.015), [1.0, 0.55, 0.1], { uv: 'white', emit: 1.2 });
    }
    // tunnel signal + caged work light on the far wall, and a faint headlight glow far down the tunnel
    glows.push({ p: [xc + 1.7, yB + 0.4, zF - 0.06], color: [0.9, 0.08, 0.05], size: 0.35 });
    glows.push({ p: [xc - 1.9, yB + 1.2, zF - 0.06], color: [0.9, 0.55, 0.2], size: 0.5 });
    baked(BK.props, BOX(0.12, 0.2, 0.06), M4(xc + 1.7, yB + 0.4, zF - 0.04), [0.04, 0.04, 0.04], { uv: 'white' });
    baked(BK.props, new THREE.SphereGeometry(0.05, 8, 6), M4(xc - 1.9, yB + 1.2, zF - 0.06), [1.0, 0.7, 0.35], { uv: 'white', emit: 1.6 });
    // fade the platform ends into the dark
    for (const [x, sg] of [[PX0 + 0.05, 1], [PX1 - 0.05, -1]]) sheet(BK.conc, 1, 1, (s, t) => [x, yTr + (yPC - yTr) * t, zW2 + (zF - zW2) * s], [sg, 0, 0], () => [0, 0], () => [0, 0, 0]);
  }

  // ---- landing hardware (cover): barrier railing on the stop line, trash can, knocked-over sandwich board
  const GREEN_PAINT = [0.07, 0.14, 0.1];
  {
    const zr = zE - 0.05, posts = [x0 + 0.15, x0 + 1.0, xc - 0.45, xc + 0.45, x1 - 1.0, x1 - 0.15];
    for (const x of posts) segment(BK.metal, [x, yB, zr], [x, yB + 1.04, zr], 0.03, GREEN_PAINT, { uv: 'white' });
    segment(BK.metal, [x0 + 0.05, yB + 1.04, zr], [x1 - 0.05, yB + 1.04, zr], 0.025, GREEN_PAINT, { uv: 'white' });
    segment(BK.metal, [x0 + 0.05, yB + 0.55, zr], [x1 - 0.05, yB + 0.55, zr], 0.018, GREEN_PAINT, { uv: 'white' });
    for (let x = xc - 0.4; x <= xc + 0.41; x += 0.1) segment(BK.metal, [x, yB + 0.1, zr], [x, yB + 1.0, zr], 0.008, GREEN_PAINT, { uv: 'white' }, 5); // gate bars
    baked(BK.sign, BOX(0.6, 0.16, 0.012), M4(xc, yB + 0.78, zr - 0.02), [0.0, 0.0, 0.0], { uv: 'white' });
    colliders.push({ min: [x0, yB, zr - 0.06], max: [x1, yB + 1.06, zr + 0.06], data: { kind: 'prop', mat: 'metal', thin: true } });
    // trash can (left wall)
    const tc = [x0 + 0.32, -27.3];
    baked(BK.metal, new THREE.CylinderGeometry(0.23, 0.21, 0.86, 12, 1, false), M4(tc[0], yB + 0.43, tc[1]), GREEN_PAINT, { uv: 'white' });
    for (const y of [0.12, 0.45, 0.78]) baked(BK.metal, new THREE.CylinderGeometry(0.236, 0.236, 0.03, 12, 1, true), M4(tc[0], yB + y, tc[1]), [0.1, 0.18, 0.13], { uv: 'white' });
    baked(BK.props, new THREE.CylinderGeometry(0.2, 0.2, 0.01, 12), M4(tc[0], yB + 0.865, tc[1]), [0.02, 0.02, 0.02], { uv: 'white' });
    colliders.push({ min: [tc[0] - 0.24, yB, tc[1] - 0.24], max: [tc[0] + 0.24, yB + 0.88, tc[1] + 0.24], data: { kind: 'prop', mat: 'metal' } });
    // sandwich board knocked flat + its second leaf leaning on it (right wall)
    const sb = [x1 - 0.6, -28.4];
    baked(BK.props, BOX(0.62, 0.025, 0.9), M4(sb[0], yB + 0.013, sb[1], 0, 0.35, 0), [0.06, 0.12, 0.09], { uv: 'white' });
    texQuad(BK.props, [sb[0], yB + 0.027, sb[1]], [Math.cos(0.35), 0, -Math.sin(0.35)], [-Math.sin(0.35), 0, -Math.cos(0.35)], 0.5, 0.75, rUV(A.ad2), shade([sb[0], yB + 0.03, sb[1]], [0, 1, 0], [0.6, 0.6, 0.6]));
    baked(BK.props, BOX(0.62, 0.025, 0.9), M4(sb[0] + 0.08, yB + 0.18, sb[1] + 0.05, 0.42, 0.35, 0), [0.06, 0.12, 0.09], { uv: 'white' });
    texQuad(BK.props, [sb[0] + 0.08, yB + 0.2, sb[1] + 0.06], [Math.cos(0.35), 0, -Math.sin(0.35)], [Math.sin(0.35) * Math.sin(0.42), Math.cos(0.42), Math.cos(0.35) * Math.sin(0.42)].map((v) => v), 0.5, 0.72, rUV(A.poster), shade([sb[0], yB + 0.2, sb[1]], [0, 1, 0], [0.7, 0.7, 0.7]));
    colliders.push({ min: [sb[0] - 0.45, yB, sb[1] - 0.5], max: [sb[0] + 0.45, yB + 0.4, sb[1] + 0.5], data: { kind: 'prop', mat: 'wood' } });
  }
  // ---- fare control: chunky turnstiles with stainless tops, ticket machines, token booth in the turn
  const zTS = zT2 - W - 0.9;
  for (let k = 0; k < 4; k++) {
    const x = x0 + 0.2 + k * (W - 0.4) / 3;
    baked(BK.props, BOX(0.3, 0.95, 1.0), M4(x, yB + 0.475, zTS), [0.16, 0.17, 0.17], { uv: 'white' });
    baked(BK.metal, BOX(0.34, 0.05, 1.04), M4(x, yB + 0.975, zTS), [0.45, 0.45, 0.44], { uv: 'white' });
    baked(BK.props, BOX(0.18, 0.1, 0.012), M4(x, yB + 0.8, zTS - 0.506), [0.85, 0.65, 0.12], { uv: 'white' });
    baked(BK.props, BOX(0.06, 0.04, 0.06), M4(x, yB + 1.02, zTS - 0.35), k % 2 ? [0.2, 0.8, 0.3] : [0.9, 0.25, 0.12], { uv: 'white', emit: 1.3 });
    if (k < 3) for (let a = 0; a < 3; a++) {
      const hub = [x + 0.16, yB + 0.82, zTS - 0.15], ang = a * Math.PI * 2 / 3 + 0.3;
      const d = new THREE.Vector3(0, Math.cos(ang), Math.sin(ang)).applyAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 4);
      segment(BK.metal, hub, [hub[0] + Math.abs(d.x) * 0.45 + 0.03, hub[1] + d.y * 0.45, hub[2] + d.z * 0.45], 0.02, [0.5, 0.5, 0.48], { uv: 'white' }, 6);
    }
    glows.push({ p: [x, yB + 1.05, zTS - 0.35], color: k % 2 ? [0.08, 0.45, 0.15] : [0.5, 0.1, 0.05], size: 0.2 });
  }
  for (const z of [zE + 0.9, zE + 1.75]) { // ticket machines against the left wall
    baked(BK.props, BOX(0.45, 1.75, 0.62), M4(x0 + 0.23, yB + 0.875, z), [0.14, 0.15, 0.16], { uv: 'white' });
    baked(BK.props, BOX(0.04, 0.34, 0.42), M4(x0 + 0.46, yB + 1.35, z), [0.3, 0.3, 0.3], { uv: 'white' });
    baked(BK.props, BOX(0.01, 0.26, 0.34), M4(x0 + 0.485, yB + 1.35, z), [0.2, 0.32, 0.42], { uv: 'white', emit: 0.75 });
    baked(BK.props, BOX(0.04, 0.12, 0.3), M4(x0 + 0.46, yB + 0.95, z), [0.08, 0.08, 0.08], { uv: 'white' });
    glows.push({ p: [x0 + 0.5, yB + 1.35, z], color: [0.12, 0.2, 0.3], size: 0.6 });
  }
  { // token booth in the turn, against the end wall, window facing back toward the landing
    const bx0 = x1 + 0.7, bx1 = x1 + 2.9, bz1 = zT2 - 0.02, bz0 = bz1 - 1.3, bxc = (bx0 + bx1) / 2, bzc = (bz0 + bz1) / 2, BG = [0.06, 0.12, 0.09];
    baked(BK.props, BOX(bx1 - bx0, 1.0, bz1 - bz0), M4(bxc, yB + 0.5, bzc), BG, { uv: 'white' });
    baked(BK.metal, BOX(bx1 - bx0 + 0.06, 0.05, bz1 - bz0 + 0.06), M4(bxc, yB + 1.02, bzc), [0.4, 0.4, 0.38], { uv: 'white' });
    baked(BK.props, BOX(bx1 - bx0 - 0.06, 1.15, 0.02), M4(bxc, yB + 1.62, bz1 - 0.12), [1.0, 0.72, 0.4], { uv: 'white', emit: 0.55 });   // lit back of the booth
    for (const x of [bx0 + 0.03, bx1 - 0.03]) baked(BK.props, BOX(0.06, 1.2, bz1 - bz0), M4(x, yB + 1.62, bzc), BG, { uv: 'white' });
    baked(BK.props, BOX(bx1 - bx0, 0.12, bz1 - bz0), M4(bxc, yB + 2.26, bzc), BG, { uv: 'white' });
    for (const x of [bx0 + 0.03, bxc, bx1 - 0.03]) baked(BK.props, BOX(0.05, 1.2, 0.05), M4(x, yB + 1.62, bz0), BG, { uv: 'white' }); // window mullions
    baked(BK.props, BOX(bx1 - bx0, 0.05, 0.06), M4(bxc, yB + 1.3, bz0 - 0.02), [0.3, 0.3, 0.28], { uv: 'white' });                     // counter
    texQuad(BK.sign, [bxc, yB + 2.12, bz0 - 0.065], [-1, 0, 0], [0, 1, 0], 1.9, 0.2, rowUV(3), [0.95, 0.9, 0.8]);
    glows.push({ p: [bxc, yB + 1.6, bz0 - 0.1], color: [0.45, 0.3, 0.14], size: 1.8 });
  }
  // ---- litter on the landing
  for (let k = 0; k < 11; k++) {
    const r = A.papers[k % A.papers.length], x = x0 + 0.3 + rng() * (W - 0.6), z = zB + 0.5 + rng() * (zT2 - zB - 3), a = rng() * 6.28, s = 0.14 + rng() * 0.12;
    const c = Math.cos(a), sn = Math.sin(a), u = rUV(r), y = yB + 0.004, nrm = [0, 1, 0], col = shade([x, y, z], nrm, [0.7, 0.68, 0.62]);
    const P = (dx, dz) => [x + dx * c - dz * sn, y, z + dx * sn + dz * c];
    BK.props.tri(P(-s, -s), P(s, -s), P(s, s), nrm, nrm, nrm, [u[0], u[1]], [u[2], u[1]], [u[2], u[3]], col, RM0);
    BK.props.tri(P(-s, -s), P(s, s), P(-s, s), nrm, nrm, nrm, [u[0], u[1]], [u[2], u[3]], [u[0], u[3]], col, RM0);
  }

  // (the street-level headhouse behind the stair lintel is closed by a headwall in street.js: nothing to tile here)
  function framedX(x, y, zw, w, h, uv) {
    baked(BK.metal, BOX(w + 0.07, h + 0.07, 0.03), M4(x, y, zw - 0.015), [0.14, 0.12, 0.09], { uv: 'white', day: true });
    texQuad(BK.sign, [x, y, zw - 0.032], [-1, 0, 0], [0, 1, 0], w, h, uv, dayShade([x, y, zw], [0, 0, -1], [1.25, 1.25, 1.25]));
  }

  // ---- assemble
  const root = new THREE.Group(); root.name = 'subway-interior';
  // ---- streak decals down from the ceiling line (multiply)
  const stainQuad = (xw, s, z, ytop, w, h) => { const u0 = rng() < 0.5 ? 0 : 1; texQuad(BK.stain, [xw + s * 0.012, ytop - h / 2, z], [0, 0, -s], [0, 1, 0], w, h, [u0, 0, 1 - u0, 1], [1, 1, 1]); };
  for (const [xw, s, zEnd] of [[x0 + 0.004, 1, zT2 - 0.6], [x1 - 0.004, -1, zT2 - W - 0.4]]) {
    for (let z = zT + 0.6; z < zEnd; z += 0.9 + rng() * 1.4) {
      const top = z < zH ? SW : ceil(z), w = 0.5 + rng() * 0.8, h = 0.8 + rng() * 1.4;
      if (top - h < (z < zB ? ramp(Math.max(z, zT)) : yB) + 0.2) continue;
      stainQuad(xw, s, z, top - 0.01, w, h);
    }
  }
  const order = { pool: 6, stain: 5 };
  for (const [k, bk] of Object.entries(BK)) {
    if (!bk.tris) continue;
    const m = new THREE.Mesh(bk.geometry(), M[k]);
    m.receiveShadow = false; m.castShadow = false; m.renderOrder = order[k] || 0;
    root.add(m);
  }
  const flick = [];
  for (const [k, bk] of Object.entries(FL)) { if (!bk.tris) continue; const m = new THREE.Mesh(bk.geometry(), M[k]); m.renderOrder = order[k] || 0; root.add(m); flick.push(m); }
  const glowCol = FL.glow ? FL.glow.color.slice() : null;
  // flickering tube: mostly on, stutters in bursts (deterministic in time, no Math.random)
  const update = (dt, t) => {
    const slot = Math.floor(t * 9), burst = hash(Math.floor(t * 0.45)) > 0.55;
    const on = !burst || hash(slot) > 0.45;
    for (const m of flick) m.visible = on;
    if (FL.glow) for (let i = 0; i < 3; i++) FL.glow.color[i] = on ? glowCol[i] : 0;
  };
  return { root, glows, colliders, update, materials: Object.values(M) };
}
