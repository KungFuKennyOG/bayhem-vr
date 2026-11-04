// Is the driver audible over a worst-case firefight? Renders the same 16 s of chaos (full-intensity score,
// rifle + enemy fire, explosions every ~2 s, big fire loop) with and without three driver lines through the
// game's own offline mixer. Then run tools/vo/mixcheck.py on the two WAVs (Whisper on the mix).
// usage: npx vite (port 5173), then NODE_PATH=/opt/npm-tools/node_modules node tools/vo/mixtest.cjs <outdir> <key> <key> <key>
const fs = require('fs'), path = require('path');
const [out, ...keys] = process.argv.slice(2);
const ev = [{ t: 0, type: 'musicStart' }, { t: 0, type: 'musicIntensity', value: 1 }];
for (let t = 0.1; t < 16; t += 0.11) ev.push({ t: +t.toFixed(3), type: 'play', name: 'rifle', opts: {} });
for (let t = 0.3; t < 16; t += 0.37) ev.push({ t: +t.toFixed(3), type: 'play', name: 'enemy_gun', opts: { x: 12, y: 1, z: -20 } });
for (let t = 1.2; t < 16; t += 2.1) ev.push({ t: +t.toFixed(3), type: 'play', name: 'explosion_big', opts: { x: -15, y: 2, z: -25 } });
for (let t = 0; t < 16; t += 0.08) ev.push({ t: +t.toFixed(3), type: 'loop', name: 'fire_big', opts: { x: 6, y: 1, z: -10, volume: 1 } });
const voice = keys.map((k, i) => ({ t: 2 + i * 4.5, type: 'voice', name: k, opts: { url: `/vo/${k}.ogg` } }));
fs.mkdirSync(out, { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  p.on('console', (m) => m.type() === 'warning' && console.log('WARN', m.text()));
  await p.goto('http://localhost:5173/audio-test/index.html');
  for (const [name, events] of [['chaos_only', ev], ['chaos_voice', ev.concat(voice)]]) {
    const b64 = await p.evaluate(async (events) => {
      const mod = await import('/src/audio.js');
      const wav = new Uint8Array(mod.audioBufferToWav(await mod.renderOffline(events, 16.5, 48000)));
      let s = ''; for (let i = 0; i < wav.length; i += 0x8000) s += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
      return btoa(s);
    }, events);
    fs.writeFileSync(path.join(out, name + '.wav'), Buffer.from(b64, 'base64'));
    console.log('wrote', name);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
