// Fast headless play-through (no rendering between samples): prints the level state every <chunk> steps.
// usage: NODE_PATH=... node tools/run-level.cjs "<query>" [maxSeconds] [chunkSeconds] [shotPrefix]
//   with shotPrefix: saves a frame at the first sample of every beat (and at the end)
const { chromium } = require('playwright');
(async () => {
  const [q, maxS = '900', chunkS = '10', shot = ''] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  p.on('console', m => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
  await p.goto((process.env.URL || 'http://localhost:5173/') + '?capture=1&' + q);
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  let last = null, t = 0;
  const grab = async (name) => { await p.evaluate(() => { window.__step(1 / 30, false); const c = document.querySelector('canvas'); c.getContext('webgl2').readPixels(0, 0, 1, 1, 6408, 5121, new Uint8Array(4)); }); const d = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.88)); require('fs').writeFileSync(`${shot}_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64')); };
  while (t < +maxS) {
    const n = Math.round(+chunkS * 30);
    const st = await p.evaluate((n) => { for (let i = 0; i < n; i++) window.__step(1 / 30, true); return window.__state(); }, n);
    t += +chunkS;
    console.log(t.toFixed(0).padStart(4), JSON.stringify(st));
    if (shot && st.step !== last) await grab(String(Math.round(t)).padStart(4, '0') + '_' + st.step);
    last = st.step;
    if (logs.length) { console.log(logs.slice(0, 6).join('\n')); logs.length = 0; }
    if (st.done) break;
  }
  if (shot) await grab('end');
  await b.close();
})();
