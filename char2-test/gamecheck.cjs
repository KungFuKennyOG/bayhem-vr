const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await p.goto('http://localhost:5182/?capture=1');
  const ok = await p.waitForFunction(() => window.__ready, null, { timeout: 120000 }).then(() => true).catch(() => false);
  if (ok) await p.evaluate(() => { for (let i = 0; i < 240; i++) window.__step(1 / 30, true); window.__step(1 / 30, false); });
  const st = ok ? await p.evaluate(() => window.__state && window.__state()) : null;
  console.log('ready', ok, JSON.stringify(st), logs.slice(0, 8).join('\n') || 'no errors');
  await b.close();
})();
