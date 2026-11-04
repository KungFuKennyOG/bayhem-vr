const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', e => console.log('err', e.message)); p.on('console', m => console.log(m.type(), m.text()));
await p.goto('http://127.0.0.1:5180/audio-test/index.html'); await p.waitForFunction(() => window.__loaded);
const r = await p.evaluate(async () => {
  const { renderOffline } = await import('/src/audio.js');
  const rms = (buf, a, b) => { const d = buf.getChannelData(0), s = Math.floor(a * buf.sampleRate), e = Math.floor(b * buf.sampleRate); let x = 0; for (let i = s; i < e; i++) x += d[i] * d[i]; return +(10 * Math.log10(x / (e - s) + 1e-15)).toFixed(1); };
  const out = {};
  // 1) rocket loop that stops receiving events at 1.2 s (no stopLoop)
  let ev = []; for (let t = 0; t < 1.2; t += 0.1) ev.push({ t, type: 'loop', name: 'rocket:9', opts: { x: 2, y: 1, z: -10 + t * 5, volume: 0.6 } });
  let buf = await renderOffline(ev, 3); out.rocket = { during: rms(buf, 0.4, 1.1), after: rms(buf, 2.2, 3) };
  // 2) music start then stop with 1 s fade at 5 s
  ev = [{ t: 0.1, type: 'musicStart' }, { t: 0.1, type: 'musicIntensity', value: 1 }, { t: 5, type: 'musicStop', value: 1 }];
  buf = await renderOffline(ev, 10); out.musicStop = { playing: rms(buf, 3, 5), after: rms(buf, 8.5, 10) };
  // 3) victory winds music down
  ev = [{ t: 0.1, type: 'musicStart' }, { t: 0.1, type: 'musicIntensity', value: 1 }, { t: 4, type: 'stinger', name: 'victory' }];
  buf = await renderOffline(ev, 16); out.victory = { before: rms(buf, 2, 4), hit: rms(buf, 4, 6), tail: rms(buf, 9, 11), end: rms(buf, 14.5, 16) };
  // 4) slow-mo: wind loop spectral centroid drop
  ev = []; for (let t = 0; t < 6; t += 0.1) ev.push({ t, type: 'loop', name: 'wind', opts: { volume: 0.8, intensity: 1 } });
  ev.push({ t: 3, type: 'timescale', value: 0.25 }); buf = await renderOffline(ev, 6); out.windSlow = { normal: rms(buf, 1, 3), slow: rms(buf, 4, 6) };
  return out;
});
console.log(JSON.stringify(r, null, 1)); await b.close(); })();
