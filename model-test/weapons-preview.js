// asset viewer wrappers for the viewmodels (they return { group }, the viewer wants { root })
import { buildRocketPod, buildLauncher, buildRifle } from '../src/weapons.js';
const wrap = (m, sf = 0, ammo = 6) => { m.setMode?.('vr'); m.animate?.({ dt: 0.016, shotsFired: sf, ammo, mag: 6, sinceShot: 9, trigger: false, reloading: false }); return { root: m.group }; };
export const pod = (sf = 0, ammo = 6) => wrap(buildRocketPod(), sf, ammo);
export const launcher = () => wrap(buildLauncher());
export const rifle = () => wrap(buildRifle());
