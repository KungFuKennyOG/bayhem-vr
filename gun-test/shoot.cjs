// usage: node gun-test/shoot.cjs outdir name1 "query1" [name2 "query2" ...]
const { chromium } = require('playwright');
(async () => {
  const [outdir, ...rest] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i], q = rest[i + 1];
    const W = +(process.env.W || 960), H = +(process.env.H || 540);
    const p = await b.newPage({ viewport: { width: W, height: H } });
    const logs = [];
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
    for (let attempt = 0; attempt < 1; attempt++) {
      await p.goto(`http://localhost:${process.env.PORT || 5183}/gun-test/index.html?w=${W}&h=${H}&` + q);
      const ok = await p.waitForFunction(() => window.__done, null, { timeout: 40000 }).then(() => true).catch(() => false);
      if (ok) break;
    }
    const info = await p.evaluate(() => window.__info).catch(() => null);
    const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.92)).catch(() => null);
    if (data) require('fs').writeFileSync(`${outdir}/${name}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
    console.log(name, JSON.stringify(info), logs.slice(0, 6).join('\n'));
    await p.close();
  }
  await b.close();
})();
