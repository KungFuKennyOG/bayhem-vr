const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', e => console.log('err', e.message));
await p.goto('http://127.0.0.1:5180/audio-test/index.html'); await p.waitForFunction(() => window.__loaded);
const r = await p.evaluate(async () => {
  const { renderOffline } = await import('/src/audio.js');
  const rms = (buf, a, b) => { const d = buf.getChannelData(0), s = Math.floor(a * buf.sampleRate), e = Math.floor(b * buf.sampleRate); let x = 0; for (let i = s; i < e; i++) x += d[i] * d[i]; return +(10 * Math.log10(x / (e - s) + 1e-15)).toFixed(1); };
  const ev = [{ t: 0.1, type: 'musicStart' }, { t: 0.1, type: 'musicIntensity', value: 0.85 }, { t: 4, type: 'stinger', name: 'boss' }, { t: 9, type: 'stinger', name: 'victory' }];
  const buf = await renderOffline(ev, 16);
  return { music: rms(buf, 2, 4), boss: rms(buf, 4, 5.5), bossTail: rms(buf, 6, 8), victory: rms(buf, 9, 10.5), vTail: rms(buf, 11, 13) };
});
console.log(JSON.stringify(r)); await b.close(); })();
