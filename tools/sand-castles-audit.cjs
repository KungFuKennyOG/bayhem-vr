// Sand Castles visibility audit: a full autopilot run that samples every scripted event over its whole duration and says
// whether you could see it from the seat through the door (see src/levels/sand-castles/DESIGN.md). Dev server on 5173.
// usage: NODE_PATH=/opt/npm-tools/node_modules node tools/sand-castles-audit.cjs [extra query] [report.txt]
const { chromium } = require('playwright');
(async () => {
  const [extra = '', out = ''] = process.argv.slice(2), q = 'level=sand-castles&god=1' + (extra ? '&' + extra : '');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const logs = [];
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
  await p.goto('http://localhost:5173/?capture=1&' + q);
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  await p.evaluate(require('fs').readFileSync(require('path').join(__dirname, 'sand-castles-audit.pre.js'), 'utf8'));
  for (let t = 0; t < 900; t += 20) {
    const st = await p.evaluate(() => { for (let i = 0; i < 600; i++) window.__step(1 / 30, true); return window.__state(); });
    console.log(t + 20, st.step, st.t, 'hp', st.hp);
    if (st.done) break;
  }
  const rep = await p.evaluate(() => window.__report());
  if (out) require('fs').writeFileSync(out, rep);
  console.log(rep); console.log([...new Set(logs)].slice(0, 10).join('\n'));
  await b.close();
})();
