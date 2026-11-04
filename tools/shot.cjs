// usage: node shot.cjs "<query>" outprefix stepsList(comma) [w h]
const { chromium } = require('playwright');
(async () => {
  const [q, out, stepsArg = '3', w = '1280', h = '720'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await p.goto((process.env.URL || 'http://localhost:5173/') + '?capture=1&' + q);
  await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }).catch(e => logs.push('TIMEOUT ready'));
  if (process.env.PRE) await p.evaluate(process.env.PRE).catch(e => logs.push('PRE ' + e.message));
  let done = 0;
  for (const target of stepsArg.split(',').map(Number)) {
    const t0 = Date.now();
    const n = target - done;
    await p.evaluate(async ([n, process_full]) => {
      const c = document.querySelector('canvas'); const gl = c.getContext('webgl2');
      const px = new Uint8Array(4);
      for (let i = 0; i < n; i++) { const r = process_full || i >= n - 2; window.__step(1 / 30, !r); if (r) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    }, [n, !!process.env.FULL]).catch(e => logs.push('STEP ' + e.message));
    done = target;
    const t1 = Date.now();
    const st = await p.evaluate(() => window.__state && window.__state()).catch(() => null);
    const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.9));
    require('fs').writeFileSync(`${out}_${target}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
    if (process.env.POST) console.log('POST', JSON.stringify(await p.evaluate(process.env.POST).catch(e => 'ERR ' + e.message)));
    console.log('frame', target, 'ms/step', (n ? (t1 - t0) / n : 0).toFixed(0), JSON.stringify(st));
  }
  console.log([...new Set(logs)].slice(0, 15).join('\n'));
  await b.close();
})();
