const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 480, height: 270 } });
  const logs = [];
  p.on('console', (m) => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
  p.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  await p.goto('http://localhost:5173/?capture=1&noshadow');
  const ok = await p.waitForFunction(() => window.__ready, null, { timeout: 120000 }).then(() => true).catch(() => false);
  let st = null;
  if (ok) st = await p.evaluate(() => { const pl = window.__player; for (let i = 0; i < 3; i++) window.__step(1 / 30, false); return { rifle: pl.rifle.model.kind, tris: pl.rifle.model.triangles, ammo: pl.rifle.ammo, launcher: pl.launcher.model.kind, drum: !!pl.launcher.model.drum }; }).catch((e) => 'ERR ' + e.message);
  console.log('ready', ok, JSON.stringify(st)); console.log(logs.slice(0, 8).join('\n'));
  await b.close();
})();
