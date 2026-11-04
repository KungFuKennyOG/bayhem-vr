// Render the recorded audio events of a capture into a WAV with the game's own audio engine.
// usage: node render-soundtrack.cjs <audio-events.json> <out.wav>
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [inp, out] = process.argv.slice(2);
  const { duration, events } = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto((process.env.URL || 'http://localhost:5173/') + 'audio-test/index.html');
  const t0 = Date.now();
  const b64 = await p.evaluate(async ([events, duration]) => {
    const mod = await import('/src/audio.js');
    const buf = await mod.renderOffline(events, duration + 0.5, 48000);
    const wav = new Uint8Array(mod.audioBufferToWav(buf));
    let s = ''; for (let i = 0; i < wav.length; i += 0x8000) s += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
    return btoa(s);
  }, [events, duration]);
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log('rendered', out, 'in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
