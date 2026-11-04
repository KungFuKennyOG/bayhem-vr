// usage: node model-test/shot.cjs "<query>" out.jpg   (needs `npx vite` on :5173; NODE_PATH=/opt/npm-tools/node_modules)
const { chromium } = require('playwright');
(async () => {
  const [q, out] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const qs = new URLSearchParams(q);
  const p = await b.newPage({ viewport: { width: +(qs.get('w') || 1280), height: +(qs.get('h') || 720) } });
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await p.goto('http://localhost:5173/model-test/?' + q);
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 }).catch(() => logs.push('TIMEOUT'));
  const frames = +(qs.get('frames') || 1);
  for (let i = 1; i < frames; i++) await p.evaluate((i) => window.__frame(i / 30), i).catch(e => logs.push('FRAME ' + e.message));
  const info = await p.evaluate(() => window.__info && window.__info()).catch(() => null);
  const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.9)).catch(() => null);
  if (data) require('fs').writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log('info', JSON.stringify(info));
  console.log(logs.filter(l => !/GPU stall|GL Driver/.test(l)).slice(0, 12).join('\n'));
  await b.close();
})();
