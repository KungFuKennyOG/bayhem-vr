import * as THREE from 'three';
import { litMat } from './kit.js';
import { textures, TS } from './tex.js';
import { signTexture } from './signs.js';

// the level's static materials (one draw call per material per region bucket).
// Geometry UVs are in METRES everywhere (Acc.box s = 1); each tiling map repeats every TS[key] metres.
let _M = null;
const rep = (t, k) => { if (!t) return t; const c = t.clone(); c.repeat.set(1 / k, 1 / k); c.needsUpdate = true; return c; };
export function materials() {
  if (_M) return _M;
  const T = textures();
  const tm = (key, o = {}) => litMat(key, { map: rep(T[key].map, TS[key]), normalMap: rep(T[key].normal, TS[key]), ...o });
  _M = {
    concrete: tm('concrete', { nScale: 0.9 }),
    stone: tm('stone', { nScale: 0.9 }),
    asphalt: tm('asphalt'),
    plaster: tm('plaster', { nScale: 0.6 }),
    wood: tm('wood', { nScale: 0.7 }),
    roof: tm('roof', { nScale: 1.3 }),
    rock: tm('rock', { nScale: 1.1 }),
    tile: tm('tile', { win: true }),
    metal: tm('metal'),
    steel: tm('steel', { nScale: 0.75 }),
    deck: tm('deck', { nScale: 0.7 }),
    granite: tm('granite', { nScale: 0.45 }),
    plain: litMat('plain'),
    win: litMat('win', { win: true }),
    sign: litMat('sign', { map: signTexture(), emMap: 1 }),
    glass: litMat('glass', { transparent: true, opacity: 0.35, depthWrite: false }),
    dbl: litMat('dbl', { side: THREE.DoubleSide }),
  };
  _M.sign.map.wrapS = _M.sign.map.wrapT = THREE.ClampToEdgeWrapping;
  return _M;
}
export const SHADOW_KEYS = ['concrete', 'plaster', 'wood', 'metal', 'plain', 'dbl', 'steel'];
