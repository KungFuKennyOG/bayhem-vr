// usage: node car-test/run.cjs script.json   (array of js strings or {shot:name})
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  for (let attempt = 0; attempt < 3; attempt++) {
    await p.goto('http://localhost:5181/car-test/world.html');
    const ok = await p.waitForFunction(() => window.__ready, null, { timeout: 90000 }).then(() => true).catch(() => false);
    if (ok) break;
  }
  for (const s of steps) {
    const t0 = Date.now();
    try {
      if (typeof s === 'string') {
        const r = await p.evaluate(`(()=>{ const A = window.__api; return ${s}; })()`);
        if (r !== undefined && r !== 'ok' && r !== true) console.log('>', s.slice(0, 50), '=>', JSON.stringify(r));
      } else if (s.shot) {
        await p.evaluate(() => window.__api.render());
        const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.9));
        fs.writeFileSync(`/home/claude/bayhem/car-test/shots/env/${s.shot}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
        console.log('shot', s.shot, (Date.now() - t0) + 'ms');
      }
    } catch (e) { console.log('ERR', typeof s === 'string' ? s.slice(0, 80) : s.shot, e.message.split('\n')[0]); }
  }
  console.log([...new Set(logs)].slice(0, 12).join('\n'));
  await b.close();
})();
