// Jump to every beat of a level with and without the autopilot, run 20 s of simulation, report page errors.
// usage: NODE_PATH=... node tools/beat-sweep.cjs <level> <beat,beat,...>
const { chromium } = require('playwright');
(async () => {
  const [level, beats] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let bad = 0, n = 0;
  for (const beat of beats.split(',')) for (const na of ['', '&noauto=1']) {
    const p = await b.newPage({ viewport: { width: 640, height: 360 } });
    const logs = [];
    p.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
    p.on('console', m => { if (m.type() === 'error') logs.push('error ' + m.text()); });
    await p.goto((process.env.URL || 'http://localhost:5173/') + `?capture=1&level=${level}&beat=${beat}${na}`);
    await p.waitForFunction(() => window.__ready, null, { timeout: 120000 }).catch(() => logs.push('TIMEOUT'));
    const st = await p.evaluate(() => { for (let i = 0; i < 600; i++) window.__step(1 / 30, true); window.__step(1 / 30, false); return window.__state(); }).catch(e => { logs.push('STEP ' + e.message); return {}; });
    n++; if (logs.length) bad++;
    console.log(`${beat}${na ? ' (noauto)' : ''}: step=${st.step} ${logs.length ? 'ERRORS: ' + logs.slice(0, 3).join(' | ') : 'ok'}`);
    await p.close();
  }
  console.log(`${n - bad}/${n} clean`);
  await b.close();
})();
