import * as THREE from 'three';
import { DAY } from './tod.js';
import { makeCanvas, canvasTex } from '../../textures.js';
import { makeRng } from '../../rng.js';

// =====================================================================================
//  Facades: a 2048×1024 atlas of 256² cells, each one "bay" (≈3 m) × one floor (≈3.4 m) of a
//  facade style. Alpha = glass. The facade shader tiles a cell over a wall in bay/floor units and
//  lights every window from a hash of (building, bay, floor): dark, cool office white, warm bar
//  amber, karaoke magenta / blue, with ceiling-light bands, blinds and silhouettes — so the whole
//  city is one material and one draw call.
// =====================================================================================
export const FCELL = {
  // row 0: upper-floor bays
  tileWhite: 0, tileBeige: 1, ribbon: 2, curtain: 3, brick: 4, balcony: 5, darkPanel: 6, tileGreen: 7,
  // row 1: variants
  tileWhiteAC: 8, tileBeigeAC: 9, ribbonDark: 10, curtainBlue: 11, brickAC: 12, balconyLaundry: 13, darkPanelSlot: 14, office: 15,
  // row 2: side walls / roofs / far towers
  side: 16, sideWin: 17, sideStain: 18, roof: 19, farGrid: 20, farGrid2: 21, sideTile: 22, garageWall: 23,
  // row 3: street level
  shutter: 24, shutterTag: 25, pilaster: 26, base: 27, garageOpen: 28, stationGlass: 29, concrete: 30, xwaySide: 31,
};
export function cellRect(i) { const c = i % 8, r = Math.floor(i / 8); return [c / 8, 1 - (r + 1) / 4, 1 / 8, 1 / 4]; }

const W = 2048, H = 1024, C = 256;
let cache = null;
export function facadeAtlas() {
  if (cache) return cache;
  const cv = makeCanvas(W, H), g = cv.getContext('2d');
  const rng = makeRng(77);
  const cell = (i, fn) => { const x = (i % 8) * C, y = Math.floor(i / 8) * C; g.save(); g.beginPath(); g.rect(x, y, C, C); g.clip(); g.translate(x, y); fn(g); g.restore(); };
  // glass is drawn with alpha = 1 in a second pass: we keep a mask canvas and merge at the end
  const mk = makeCanvas(W, H), m = mk.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, W, H);
  const glass = (i, x, y, w, h) => { m.fillStyle = '#fff'; m.fillRect((i % 8) * C + x, Math.floor(i / 8) * C + y, w, h); };
  const noise = (g, k, a = 0.08) => { for (let n = 0; n < 900 * k; n++) { const v = rng(); g.fillStyle = `rgba(${v < 0.5 ? '0,0,0' : '255,255,255'},${a * rng()})`; g.fillRect(rng() * C, rng() * C, 1 + rng() * 3, 1 + rng() * 3); } };
  const tiles = (g, base, line, tw = 16, th = 8) => {
    g.fillStyle = base; g.fillRect(0, 0, C, C);
    g.strokeStyle = line; g.lineWidth = 1;
    for (let y = 0; y < C; y += th) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(C, y + 0.5); g.stroke(); for (let x = ((y / th) % 2) * tw / 2; x < C; x += tw) { g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + th); g.stroke(); } }
    for (let n = 0; n < 160; n++) { g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + rng() * 0.05})`; g.fillRect(Math.floor(rng() * C / tw) * tw, Math.floor(rng() * C / th) * th, tw, th); }
  };
  const streaks = (g, x0, x1, y0, k = 1) => { for (let n = 0; n < 7 * k; n++) { const x = x0 + rng() * (x1 - x0); const gr = g.createLinearGradient(0, y0, 0, y0 + 40 + rng() * 90); gr.addColorStop(0, `rgba(30,24,18,${0.18 + rng() * 0.2})`); gr.addColorStop(1, 'rgba(30,24,18,0)'); g.fillStyle = gr; g.fillRect(x, y0, 2 + rng() * 5, 130); } };
  const winFrame = (i, g, x, y, w, h, frame = '#9aa0a4', mull = 2) => {
    g.fillStyle = '#121418'; g.fillRect(x, y, w, h); glass(i, x + 4, y + 4, w - 8, h - 8);
    g.strokeStyle = frame; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
    g.lineWidth = 4; for (let k = 1; k < mull; k++) { g.beginPath(); g.moveTo(x + w * k / mull, y); g.lineTo(x + w * k / mull, y + h); g.stroke(); }
    g.fillStyle = '#6e7276'; g.fillRect(x - 6, y + h, w + 12, 7); // sill
  };
  const acUnit = (g, x, y) => { g.fillStyle = '#c9c8c0'; g.fillRect(x, y, 58, 40); g.fillStyle = '#3a3a3a'; g.beginPath(); g.arc(x + 22, y + 20, 15, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#9a9a92'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + 8, y + 8 + k * 8); g.lineTo(x + 36, y + 8 + k * 8); g.stroke(); } g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y + 40, 58, 5); };

  // ---- row 0
  cell(0, (g) => { tiles(g, '#d9d6cc', '#bdb9ae'); winFrame(0, g, 34, 40, 188, 132); streaks(g, 40, 216, 180); noise(g, 1); });
  cell(1, (g) => { tiles(g, '#c8b89a', '#ad9d80', 22, 10); winFrame(1, g, 52, 46, 152, 120, '#7e7a70'); streaks(g, 50, 200, 172); noise(g, 1); });
  cell(2, (g) => { g.fillStyle = '#8f9092'; g.fillRect(0, 0, C, C); g.fillStyle = '#7d7e80'; g.fillRect(0, 180, C, 76); g.fillStyle = '#141619'; g.fillRect(0, 34, C, 136); glass(2, 0, 38, C, 128); g.fillStyle = '#5d6064'; for (let x = 0; x < C; x += 64) g.fillRect(x, 34, 5, 136); g.fillStyle = '#6a6c70'; g.fillRect(0, 168, C, 8); streaks(g, 0, C, 176, 1.4); noise(g, 1); });
  cell(3, (g) => { g.fillStyle = '#1c2228'; g.fillRect(0, 0, C, C); glass(3, 0, 0, C, 214); g.fillStyle = '#4a5058'; g.fillRect(0, 214, C, 42); for (let x = 0; x < C; x += 128) g.fillRect(x, 0, 7, C); g.fillRect(0, 210, C, 6); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, C, 214); noise(g, 0.5); });
  cell(4, (g) => { tiles(g, '#6e4434', '#563226', 20, 9); winFrame(4, g, 40, 44, 176, 128, '#3a3634'); streaks(g, 40, 216, 178, 0.6); noise(g, 1.2); });
  cell(5, (g) => { g.fillStyle = '#cfcac0'; g.fillRect(0, 0, C, C); g.fillStyle = '#1a1c20'; g.fillRect(20, 20, 216, 176); glass(5, 24, 24, 208, 100); g.fillStyle = '#d8d4cc'; g.fillRect(10, 128, 236, 86); g.fillStyle = '#b8b4aa'; g.fillRect(10, 128, 236, 6); g.strokeStyle = '#a8a49a'; for (let x = 18; x < 246; x += 10) { g.beginPath(); g.moveTo(x, 134); g.lineTo(x, 214); g.stroke(); } g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(10, 214, 236, 10); streaks(g, 10, 246, 222); noise(g, 1); });
  cell(6, (g) => { g.fillStyle = '#26272a'; g.fillRect(0, 0, C, C); g.strokeStyle = '#323438'; g.lineWidth = 2; for (let x = 0; x < C; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, C); g.stroke(); } for (const x of [26, 154]) { g.fillStyle = '#0c0d10'; g.fillRect(x, 26, 76, 170); glass(6, x + 4, 30, 68, 162); } noise(g, 0.8, 0.05); });
  cell(7, (g) => { tiles(g, '#9fae9e', '#87968a', 14, 7); winFrame(7, g, 30, 36, 196, 140, '#e4e4de', 3); streaks(g, 30, 226, 184); noise(g, 1); });
  // ---- row 1 variants
  cell(8, (g) => { tiles(g, '#dedbd2', '#c2beb3'); winFrame(8, g, 34, 40, 150, 132); acUnit(g, 188, 150); streaks(g, 40, 216, 180); noise(g, 1); });
  cell(9, (g) => { tiles(g, '#bfae90', '#a39376', 22, 10); winFrame(9, g, 30, 46, 140, 120, '#7e7a70'); acUnit(g, 178, 128); streaks(g, 30, 200, 172); noise(g, 1); });
  cell(10, (g) => { g.fillStyle = '#5a5b5e'; g.fillRect(0, 0, C, C); g.fillStyle = '#0e1013'; g.fillRect(0, 40, C, 120); glass(10, 0, 44, C, 112); g.fillStyle = '#3e4044'; for (let x = 0; x < C; x += 85) g.fillRect(x, 40, 6, 120); streaks(g, 0, C, 166, 1.6); noise(g, 1); });
  cell(11, (g) => { g.fillStyle = '#16222e'; g.fillRect(0, 0, C, C); glass(11, 0, 0, C, 220); g.fillStyle = '#5a6b7a'; g.fillRect(0, 220, C, 36); for (let x = 0; x < C; x += 85) g.fillRect(x, 0, 5, C); g.fillStyle = 'rgba(120,170,220,0.08)'; g.fillRect(0, 0, C, 220); noise(g, 0.4); });
  cell(12, (g) => { tiles(g, '#5e3a2c', '#4a2a20', 20, 9); winFrame(12, g, 30, 44, 140, 128, '#3a3634'); acUnit(g, 180, 150); streaks(g, 30, 216, 178, 0.6); noise(g, 1.2); });
  cell(13, (g) => { g.fillStyle = '#c4c0b6'; g.fillRect(0, 0, C, C); g.fillStyle = '#1a1c20'; g.fillRect(20, 20, 216, 176); glass(13, 24, 24, 208, 100); g.fillStyle = '#ccc8c0'; g.fillRect(10, 128, 236, 86); g.strokeStyle = '#888'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 112); g.lineTo(236, 112); g.stroke(); for (let k = 0; k < 7; k++) { g.fillStyle = `hsl(${Math.floor(rng() * 360)},40%,${50 + rng() * 30}%)`; g.fillRect(28 + k * 30, 112, 20, 14 + rng() * 20); } streaks(g, 10, 246, 222); noise(g, 1); });
  cell(14, (g) => { g.fillStyle = '#2c2a28'; g.fillRect(0, 0, C, C); g.fillStyle = '#0c0d10'; g.fillRect(28, 60, 200, 60); glass(14, 32, 64, 192, 52); g.fillStyle = '#3a3836'; g.fillRect(0, 0, C, 12); noise(g, 0.8, 0.05); });
  cell(15, (g) => { g.fillStyle = '#b6b8b6'; g.fillRect(0, 0, C, C); g.fillStyle = '#16191d'; g.fillRect(12, 30, 232, 160); glass(15, 14, 32, 228, 156); g.fillStyle = '#d0d2d0'; g.fillRect(124, 30, 8, 160); g.fillStyle = '#9a9c9a'; g.fillRect(0, 196, C, 60); streaks(g, 0, C, 200); noise(g, 1); });
  // ---- row 2: side walls, roofs, far towers
  cell(16, (g) => { g.fillStyle = '#7c7a76'; g.fillRect(0, 0, C, C); noise(g, 2, 0.1); streaks(g, 0, C, 0, 2); });
  cell(17, (g) => { g.fillStyle = '#8a8782'; g.fillRect(0, 0, C, C); noise(g, 2, 0.1); winFrame(17, g, 96, 80, 64, 80, '#777'); streaks(g, 90, 170, 168); });
  cell(18, (g) => { g.fillStyle = '#6c6a66'; g.fillRect(0, 0, C, C); noise(g, 2.5, 0.12); streaks(g, 0, C, 0, 3); g.fillStyle = 'rgba(40,36,30,0.25)'; g.fillRect(0, 200, C, 56); });
  cell(19, (g) => { g.fillStyle = '#4a4a4a'; g.fillRect(0, 0, C, C); noise(g, 3, 0.14); g.strokeStyle = 'rgba(0,0,0,0.3)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(rng() * C, rng() * C); g.lineTo(rng() * C, rng() * C); g.stroke(); } });
  cell(20, (g) => { g.fillStyle = '#20242a'; g.fillRect(0, 0, C, C); for (let y = 0; y < C; y += 32) for (let x = 0; x < C; x += 32) { g.fillStyle = '#0a0c10'; g.fillRect(x + 4, y + 8, 24, 18); glass(20, x + 4, y + 8, 24, 18); } });
  cell(21, (g) => { g.fillStyle = '#3a3a3c'; g.fillRect(0, 0, C, C); for (let y = 0; y < C; y += 32) { g.fillStyle = '#0a0c10'; g.fillRect(0, y + 10, C, 16); glass(21, 0, y + 10, C, 16); } for (let x = 0; x < C; x += 64) { g.fillStyle = '#3a3a3c'; g.fillRect(x, 0, 5, C); } });
  cell(22, (g) => { tiles(g, '#a8a296', '#8e887c', 18, 9); noise(g, 1.5, 0.08); streaks(g, 0, C, 0, 2.5); });
  cell(23, (g) => { g.fillStyle = '#8c8a84'; g.fillRect(0, 0, C, C); g.fillStyle = '#a5a29a'; g.fillRect(0, 0, C, 60); g.fillStyle = '#6d6b66'; g.fillRect(0, 60, C, 6); noise(g, 2, 0.1); streaks(g, 0, C, 66, 2); });
  // ---- row 3: street level
  cell(24, (g) => { g.fillStyle = '#9a9c9e'; g.fillRect(0, 0, C, C); for (let y = 0; y < C; y += 9) { g.fillStyle = '#7e8082'; g.fillRect(0, y, C, 2); g.fillStyle = '#b4b6b8'; g.fillRect(0, y + 2, C, 1); } g.fillStyle = '#6a6c6e'; g.fillRect(0, 0, C, 18); noise(g, 2, 0.08); g.fillStyle = 'rgba(30,26,20,0.35)'; g.fillRect(0, 210, C, 46); });
  cell(25, (g) => { g.fillStyle = '#8e9092'; g.fillRect(0, 0, C, C); for (let y = 0; y < C; y += 9) { g.fillStyle = '#727476'; g.fillRect(0, y, C, 2); } g.fillStyle = '#6a6c6e'; g.fillRect(0, 0, C, 18);
    // a tag: round bubble letters, spray drips
    g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = '#1a1a1a'; g.fillStyle = ['#e83a8a', '#3ac8e8', '#f2c21a'][Math.floor(rng() * 3)];
    g.font = '900 78px Anton, sans-serif'; g.textAlign = 'center'; g.strokeText('KRGN', 128, 140); g.fillText('KRGN', 128, 140);
    for (let k = 0; k < 6; k++) g.fillRect(70 + rng() * 120, 150, 3, 20 + rng() * 40); noise(g, 2, 0.08); });
  cell(26, (g) => { g.fillStyle = '#3c3a38'; g.fillRect(0, 0, C, C); g.fillStyle = '#4a4846'; g.fillRect(0, 0, C, 20); noise(g, 2, 0.1); });
  cell(27, (g) => { tiles(g, '#5a5650', '#48443e', 32, 16); noise(g, 2, 0.1); });
  cell(28, (g) => { g.fillStyle = '#7a7872'; g.fillRect(0, 0, C, C); g.fillStyle = '#121212'; g.fillRect(0, 60, C, 196); g.fillStyle = '#8a8882'; g.fillRect(0, 0, C, 60); g.fillStyle = '#5a5852'; g.fillRect(0, 56, C, 6); g.fillStyle = '#f2c21a'; for (let x = 0; x < C; x += 40) g.fillRect(x, 236, 20, 6); noise(g, 2, 0.1); });
  cell(29, (g) => { g.fillStyle = '#20262c'; g.fillRect(0, 0, C, C); glass(29, 0, 0, C, C); g.fillStyle = '#8a9298'; for (let x = 0; x < C; x += 64) g.fillRect(x, 0, 6, C); g.fillRect(0, 124, C, 6); });
  cell(30, (g) => { g.fillStyle = '#86847e'; g.fillRect(0, 0, C, C); noise(g, 3, 0.1); for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(60,56,50,0.2)'; g.fillRect(0, rng() * C, C, 2); } });
  cell(31, (g) => { g.fillStyle = '#9a9890'; g.fillRect(0, 0, C, C); g.fillStyle = '#878580'; g.fillRect(0, 0, C, 40); g.fillStyle = '#6e6c66'; g.fillRect(0, 40, C, 4); noise(g, 2, 0.1); streaks(g, 0, C, 44, 2); g.fillStyle = 'rgba(30,26,20,0.3)'; g.fillRect(0, 200, C, 56); });

  // merge the glass mask into alpha — in a DataTexture: a canvas would premultiply and wreck the RGB under alpha ~0
  const d = new Uint8Array(g.getImageData(0, 0, W, H).data), mm = m.getImageData(0, 0, W, H).data;
  for (let i = 0; i < d.length; i += 4) d[i + 3] = mm[i];
  // canvas rows run top-down; flip so v = 0 is the bottom (cellRect assumes flipY)
  const flipped = new Uint8Array(d.length), row = W * 4;
  for (let y = 0; y < H; y++) flipped.set(d.subarray(y * row, (y + 1) * row), (H - 1 - y) * row);
  const tex = new THREE.DataTexture(flipped, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8; tex.needsUpdate = true;
  cache = { tex, canvas: cv };
  return cache;
}

// The facade material: map × vertex colour, windows lit from a hash. Geometry attributes:
//   uv = continuous (bay, floor) coordinates on the wall, aCell = atlas rect, aInfo = (seed, lit fraction, warmth, kind)
// kind: 0 street facade, 1 side / back wall (dimmer, fewer lit), 2 far tower (tiny windows, more lit), 3 never lit
export function facadeMaterial() {
  const { tex } = facadeAtlas();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, metalness: 0.0, emissive: 0xffffff, emissiveIntensity: 1 });
  m.userData.tex = tex;
  m.onBeforeCompile = (s) => {
    s.uniforms.tFac = { value: tex };
    s.uniforms.uNightK = m.userData.nightK ||= { value: DAY.facadeNight };
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aCell;\nattribute vec4 aInfo;\nvarying vec2 vFUV;\nflat varying vec4 vCell;\nflat varying vec4 vInfo;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFUV = uv; vCell = aCell; vInfo = aInfo;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tFac; uniform float uNightK;
varying vec2 vFUV; flat varying vec4 vCell; flat varying vec4 vInfo;
float fh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`)
      .replace('#include <map_fragment>', `
  vec2 fF = fract(vFUV);
  vec2 aUV = vCell.xy + clamp(fF, 0.004, 0.996) * vCell.zw;
  vec4 fT = textureGrad(tFac, aUV, dFdx(vFUV) * vCell.zw, dFdy(vFUV) * vCell.zw);
  diffuseColor.rgb *= fT.rgb;
  float fGlass = smoothstep(0.35, 0.75, fT.a);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, fGlass);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.55, fGlass);')
      .replace('#include <emissivemap_fragment>', `
  {
    // which window is this? (bay, floor) + building seed; ribbon / curtain cells split into 2-3 rooms per bay
    vec2 wid = floor(vFUV * vec2(vInfo.w > 1.5 ? 4.0 : 1.0, 1.0));
    float seed = mod(vInfo.x, 97.0) + 1.0;
    float h1 = fh(wid + seed * 13.17), h2 = fh(wid.yx + seed * 7.31 + 3.1), h3 = fh(wid * 1.7 + seed + 9.4);
    // offices (cool buildings) light whole floors; bars / flats light window by window
    float hf = fh(vec2(wid.y, seed * 3.3)), hf2 = fh(vec2(wid.y * 1.3 + 7.0, seed));
    float office = step(vInfo.z, 0.45);
    float litP = vInfo.y * (vInfo.w > 0.5 && vInfo.w < 1.5 ? 0.45 : 1.0);
    float lit = mix(step(h1, litP), step(hf, litP) * step(0.12, h1), office);
    vec3 cool = vec3(0.8, 0.86, 0.9), warm = vec3(1.1, 0.72, 0.38), mag = vec3(1.05, 0.3, 0.8), blu = vec3(0.32, 0.55, 1.15);
    vec3 wc = office > 0.5 ? mix(cool, cool * vec3(1.05, 1.0, 0.88), step(0.7, hf2)) : mix(cool * 0.9, warm, step(h2, 0.75));
    wc = (office < 0.5 && h3 > 0.975) ? mag : (office < 0.5 && h3 > 0.955) ? blu : wc;
    // the room: rows of ceiling lights, a falloff down the wall, blinds on some, desks / shelves as dark shapes
    float tubes = 0.25 + 0.75 * step(0.55, fract(fF.x * (2.0 + floor(h2 * 3.0))));
    float ceil = 0.12 + 0.55 * smoothstep(0.35, 0.9, fF.y) + 0.7 * smoothstep(0.86, 0.95, fF.y) * tubes;
    float blinds = h3 < 0.3 ? 0.6 + 0.4 * step(0.45, fract(fF.y * 16.0)) : 1.0;
    float shape = 1.0 - 0.7 * step(abs(fF.x - fract(h1 * 7.0)), 0.14) * step(fF.y, 0.42 + 0.2 * h2);
    shape *= 1.0 - 0.5 * step(abs(fF.x - fract(h2 * 5.0)), 0.09) * step(fF.y, 0.65);
    float k = (vInfo.w > 1.5 && vInfo.w < 2.5) ? 0.45 : 0.38;
    totalEmissiveRadiance = fGlass * lit * wc * ceil * blinds * shape * k * uNightK * (0.7 + 0.5 * h2);
    // unlit glass: a hint of the room in the dark + the city's glow on it
    totalEmissiveRadiance += fGlass * (1.0 - lit) * vec3(0.012, 0.014, 0.022);
  }`);
  };
  m.customProgramCacheKey = () => 'tokyoFacade';
  return m;
}
