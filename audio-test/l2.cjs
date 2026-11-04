// Level 2 sound checks. Needs a vite server on :5180 (npx vite --port 5180) and playwright (NODE_PATH=/opt/npm-tools/node_modules).
//   node l2.cjs raw                      -> per-variant buffer stats (NaN / peak / RMS / duration) for every bake + init ms
//   node l2.cjs catalog <out.wav>        -> each new one-shot (and reference sounds) at 0.5 + 4.5k s, 2D, through the runtime chain
//   node l2.cjs loops <out.wav>          -> each new loop for 6 s at 4 m, then the intensity sweep (crane_motor/forklift 0 -> 1)
//   node l2.cjs demo <out.wav>           -> ~20 s audition sequence of the new sounds
//   node l2.cjs init                     -> init (bake) time, 5 runs
const { chromium } = require('playwright');
const fs = require('fs');
const CAT = ['step_concrete','step_metal','step_run','container_slam','container_dent','container_doors','crane_alarm','crane_release','barrel_hit','barrel_hiss','barrel_explode','grenade_bounce','grenade_pin','glass_break','ship_horn','metal_groan','alarm_klaxon','radio_squelch','body_fall','gear_rattle','fuel_whoomp','explosion_big','impact_metal','rifle','metal_crash','explosion_small'];
const LOOPS = ['harbor','crane_motor','forklift','fire_big','sodium_hum','fire'];
const SLOT = 4.5;

function catalogEvents() { return { ev: CAT.map((n, k) => ({ t: 0.5 + k * SLOT, type: 'play', name: n, opts: {} })), dur: 0.5 + CAT.length * SLOT }; }
function loopEvents() {
  const ev = []; let t0 = 0.5;
  for (const n of LOOPS) {
    const twoD = n === 'harbor';
    for (let t = t0; t < t0 + 6; t += 0.1) ev.push({ t: +t.toFixed(3), type: 'loop', name: n + ':1', opts: twoD ? { volume: 1, intensity: 1 } : { x: 0, y: 1.65, z: -4, volume: 1, intensity: 0.5 } });
    t0 += 7;
  }
  for (const n of ['crane_motor', 'forklift']) { // intensity sweep 0 -> 1 over 6 s
    for (let t = t0; t < t0 + 6; t += 0.1) ev.push({ t: +t.toFixed(3), type: 'loop', name: n + ':2', opts: { x: 0, y: 1.65, z: -4, volume: 1, intensity: (t - t0) / 6 } });
    t0 += 7;
  }
  return { ev, dur: t0 };
}
function demoEvents() {
  // listener at origin looking -z. A short port skirmish: footsteps -> crane -> container drop -> fight -> ship.
  const ev = [], P = (t, name, o = {}) => ev.push({ t, type: 'play', name, opts: o }), L = (t, name, o = {}) => ev.push({ t, type: 'loop', name, opts: o });
  for (let t = 0; t < 21.5; t += 0.1) { L(+t.toFixed(2), 'harbor', { volume: 1 }); if (t < 4) L(+t.toFixed(2), 'sodium_hum:1', { x: 1.2, y: 3, z: -1, volume: 1 }); }
  for (let k = 0; k < 6; k++) P(0.3 + k * 0.52, 'step_concrete', { x: (k % 2 ? 0.12 : -0.12), y: 0, z: 0, volume: 0.9 }); // walking, 0.3-3.0
  P(3.3, 'radio_squelch', {});
  for (let t = 3.6; t < 8.6; t += 0.1) L(+t.toFixed(2), 'crane_motor:1', { x: -6, y: 18, z: -14 + (t - 3.6) * 1.2, volume: 1, intensity: Math.min(1, (t - 3.6) / 2) });
  P(4.0, 'crane_alarm', { x: -6, y: 18, z: -12 });
  P(6.3, 'crane_release', { x: -6, y: 18, z: -9 });
  P(7.9, 'container_slam', { x: -5, y: 0, z: -10 });
  P(9.2, 'grenade_pin', { x: 7, y: 1.5, z: -12 }); P(9.9, 'grenade_bounce', { x: 3, y: 0, z: -6 });
  for (let k = 0; k < 4; k++) P(10.0 + k * 0.28, 'step_run', { x: -0.1 + 0.2 * (k % 2), y: 0, z: 0, volume: 1 });
  P(10.3, 'gear_rattle', { x: 6, y: 1, z: -8 });
  P(11.4, 'container_dent', { x: 5, y: 1.5, z: -8 }); P(11.4, 'container_doors', { x: -4, y: 1.5, z: -9 });
  [12.4, 12.55, 12.75].forEach((t) => P(t, 'barrel_hit', { x: 4, y: 0.8, z: -7 }));
  P(12.9, 'barrel_hiss', { x: 4, y: 0.8, z: -7 });
  P(14.0, 'barrel_explode', { x: 4, y: 0.8, z: -7 });
  P(14.6, 'body_fall', { x: 6, y: 0, z: -9 });
  P(15.1, 'glass_break', { x: -3, y: 6, z: -12 });
  for (let k = 0; k < 4; k++) P(15.3 + k * 0.5, 'step_metal', { x: (k % 2 ? 0.12 : -0.12), y: 0, z: 0, volume: 0.9 });
  for (let t = 15.5; t < 21.5; t += 0.1) L(+t.toFixed(2), 'fire_big:1', { x: 8, y: 1, z: -18, volume: Math.min(1, (t - 15.5) / 0.8) });
  P(15.5, 'fuel_whoomp', { x: 8, y: 1, z: -18 });
  P(16.4, 'alarm_klaxon', { x: 20, y: 9, z: -45 }); P(18.4, 'alarm_klaxon', { x: 20, y: 9, z: -45 });
  P(17.0, 'ship_horn', { x: 30, y: 25, z: -60 });
  P(18.8, 'metal_groan', { x: 20, y: 6, z: -40 });
  return { ev, dur: 22 };
}

(async () => {
  const mode = process.argv[2] || 'raw', out = process.argv[3];
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  const logs = []; p.on('pageerror', (e) => logs.push('pageerror ' + e.message)); p.on('console', (m) => { if (m.type() !== 'log') logs.push(m.type() + ' ' + m.text()); });
  await p.goto('http://127.0.0.1:5180/audio-test/l2.html'); await p.waitForFunction(() => window.__loaded, null, { timeout: 30000 });
  if (mode === 'raw') console.log(JSON.stringify(await p.evaluate(() => window.rawBakes())));
  else if (mode === 'raw-wav') { // node l2.cjs raw-wav out.wav name1,name2
    const r = await p.evaluate((n) => window.dumpRaw(n), process.argv[4].split(','));
    fs.writeFileSync(out, Buffer.from(r.wav, 'base64')); console.log('marks', JSON.stringify(r.marks));
  }
  else if (mode === 'init') { for (let i = 0; i < 5; i++) console.log('init ms', (await p.evaluate(() => window.timeInit())).toFixed(0)); }
  else {
    const { ev, dur } = mode === 'catalog' ? catalogEvents() : mode === 'loops' ? loopEvents() : demoEvents();
    const r = await p.evaluate(([e, d]) => window.renderEvents(e, d), [ev, dur]);
    fs.writeFileSync(out, Buffer.from(r.wav, 'base64')); console.log('render ms', r.ms.toFixed(0), 'events', ev.length, 'dur', dur, '->', out);
  }
  console.log('console:', logs.slice(0, 20).join('\n') || '(none)'); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
