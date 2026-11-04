// Scripted ~40 s event timeline exercising the whole audio API (same format the game records).
export function scenario(off = 0, opts = {}) {
  const ev = [];
  let seed = 7 + off;
  const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const push = (t, o) => ev.push({ t: +(t + off).toFixed(4), ...o });
  const play = (t, name, o = {}) => push(t, { type: 'play', name, opts: o });
  const loop = (t, name, o = {}) => push(t, { type: 'loop', name, opts: o });
  const D = 40;

  if (!opts.noMusicStart) { play(0.05, 'ui_select'); push(0.2, { type: 'musicStart' }); }
  // listener sway, every 0.05 s
  for (let t = 0; t < D; t += 0.05) push(t, { type: 'listener', args: [Math.sin(t * 0.7) * 0.1, 1.65, 1.2, Math.sin(t * 0.3) * 0.2, 0, -1, 0, 1, 0] });
  // music intensity curve
  const inten = (t) => (t < 4 ? 0 : t < 10 ? (t - 4) / 12 : t < 17 ? 0.5 + (t - 10) * 0.035 : t < 24 ? 0.75 + (t - 17) * 0.036 : 1);
  for (let t = 0.3; t < 34; t += 0.1) push(t, { type: 'musicIntensity', value: +inten(t).toFixed(3) });
  // ambience loops
  for (let t = 0; t < D; t += 0.1) { loop(t, 'wind', { volume: 0.8, intensity: 1 }); loop(t, 'truck', { volume: 0.7, intensity: 0.6 }); }
  // an SUV engine + fire loop and an unknown loop for robustness
  for (let t = 5; t < 9; t += 0.1) loop(t, 'suv:7', { x: 4, y: 0.8, z: -20 + (t - 5) * 2, volume: 1, intensity: 0.7 });
  for (let t = 9.1; t < 16; t += 0.1) loop(t, 'fire:7', { x: 5, y: 1, z: -30 - (t - 9) * 5, volume: 1, intensity: 0.8 });
  loop(5, 'banana:1', { x: 1, z: 1 }); play(5, 'not_a_sound', {});

  // player rifle bursts at 11.5/s + casings + impacts
  const bursts = [[3, 4.5], [8, 9.6], [13, 16], [20, 22], [26, 29], [33, 35]];
  let n = 0;
  for (const [a, b] of bursts) for (let t = a; t < b; t += 1 / 11.5) {
    play(t, 'rifle', {}); n++;
    play(t + 0.35 + R() * 0.2, 'casing', { x: 0.3, y: 0.95, z: 1.5, volume: 0.35 });
    if (n % 3 === 0) play(t + 0.08, 'impact_metal', { x: 5 + R() * 2, y: 1, z: -28, volume: 0.7 });
    if (n % 17 === 0) play(t + 0.08, 'impact_glass', { x: 5, y: 1.4, z: -27, volume: 0.7 });
    if (n % 23 === 0) { play(t + 0.08, 'impact_flesh', { x: 5, y: 1.4, z: -27, volume: 0.8 }); play(t + 0.09, 'hit_marker', { volume: 1 }); }
    if (n % 5 === 0) play(t + 0.09, 'hit_marker', { volume: 0.6 });
  }
  [4.6, 15.5, 28.8].forEach((t) => play(t, 'kill_confirm', {}));
  [6, 17, 30].forEach((t) => play(t, 'reload', {}));
  play(16.3, 'reload', { pitch: 0.8 });
  // enemy fire (bursts of ~9/s), whizzes, return impacts on the truck
  for (let t = 6; t < 30; t += 1.4 + R()) {
    const x = R() < 0.5 ? -6 : 6, z = -25 - R() * 15;
    for (let k = 0; k < 6; k++) play(t + k * 0.11, 'enemy_gun', { x, y: 1.5, z, volume: 0.8 });
    if (R() < 0.5) play(t + 0.15, 'whiz', { x: 0.6, y: 1.7, z: 1.0 });
    if (R() < 0.4) play(t + 0.2, 'impact_metal', { x: 0.8, y: 1.1, z: 0.5, volume: 0.6 });
  }
  // explosions: 30 m, chain of 3 within a second, heli crash
  play(9.0, 'explosion_big', { x: 5, y: 1, z: -30 });
  play(9.05, 'metal_crash', { x: 5, y: 1, z: -30 });
  play(11, 'tire_screech', { x: -4, y: 0.5, z: -15, volume: 0.8 });
  play(12, 'explosion_small', { x: -4, y: 0.5, z: -15 });
  play(18.0, 'explosion_big', { x: -8, y: 1, z: -12 });
  play(18.0, 'ear_ring', { volume: 0.5 });
  play(18.1, 'metal_crash', { x: -8, y: 1, z: -12 });
  play(18.35, 'explosion_big', { x: -12, y: 1, z: -35 });
  play(18.8, 'explosion_big', { x: 4, y: 1, z: -60 });
  // slow-mo 1 -> 0.25 -> 1
  play(18.0, 'slowmo_in', {});
  for (let t = 18.0; t <= 18.45; t += 0.05) push(t, { type: 'timescale', value: +(1 - 0.75 * Math.min(1, (t - 18) / 0.4)).toFixed(3) });
  for (let t = 20.5; t <= 21.0; t += 0.05) push(t, { type: 'timescale', value: +(0.25 + 0.75 * Math.min(1, (t - 20.5) / 0.45)).toFixed(3) });
  push(21.05, { type: 'timescale', value: 1 });
  play(20.6, 'slowmo_out', {});
  // player grenades
  play(15, 'rocket_launch', { volume: 0.55, pitch: 1.6 });
  play(27, 'rocket_launch', { volume: 0.55, pitch: 1.6 });
  // boss helicopter
  push(22.0, { type: 'stinger', name: 'boss' });
  const heli = (t) => {
    const u = (t - 22) / 8.5;
    if (u < 0.5) { const k = u / 0.5; return [60 - 60 * k, 20 - 8 * k, -120 + 125 * k]; }
    const k = (u - 0.5) / 0.5; return [-40 * Math.sin(k * 3), 12 + 3 * k, 5 + 50 * Math.sin(k * 2.2) - 30 * k];
  };
  play(22.5, 'heli_flyby', { x: 30, y: 15, z: -40 });
  for (let t = 22; t < 30.5; t += 0.1) { const [x, y, z] = heli(t); loop(t, 'heli', { x, y, z, volume: 1 }); }
  for (let t = 27; t < 29; t += 0.09) { const [x, y, z] = heli(t); play(t, 'enemy_gun', { x, y, z, pitch: 0.7, volume: 1 }); }
  // heli rocket: loop that stops receiving events (no stopLoop)
  { const [hx, hy, hz] = heli(24); play(24, 'rocket_launch', { x: hx, y: hy, z: hz });
    for (let t = 24; t < 25.2; t += 0.1) { const k = (t - 24) / 1.2; loop(t, 'rocket:4242', { x: lerp(hx, 3, k), y: lerp(hy, 1, k), z: lerp(hz, -5, k), volume: 0.6 }); }
    play(25.2, 'explosion_small', { x: 3, y: 1, z: -5 }); play(25.25, 'player_hurt', { volume: 0.6 }); play(25.5, 'metal_crash', { x: 3, y: 1, z: -5, volume: 0.6 }); }
  // heli crash
  { const [x, y, z] = heli(30.5); play(30.5, 'metal_crash', { x, y, z }); play(30.6, 'explosion_big', { x: x * 0.5, y: 1, z: -15 }); play(30.6, 'ear_ring', { volume: 0.7 });
    push(31, { type: 'stopLoop', name: 'heli' }); }
  push(34.0, { type: 'stinger', name: 'victory' });
  if (!opts.noMusicStop) push(38.5, { type: 'musicStop', value: 1.5 });
  return ev;
}
function lerp(a, b, t) { return a + (b - a) * t; }
