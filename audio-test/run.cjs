const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const mode = process.argv[2] || '40', solo = process.argv[3] || null, out = process.argv[4] || __dirname + '/test.wav';
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.goto('http://127.0.0.1:5180/audio-test/index.html');
  await page.waitForFunction(() => window.__loaded, null, { timeout: 30000 });
  if (mode === 'live') {
    const r = await page.evaluate(() => window.runLive(5));
    console.log(JSON.stringify(r, null, 1));
  } else {
    const r = await page.evaluate(([m, s]) => window.runOffline(m, s), [mode, solo]);
    fs.writeFileSync(out, Buffer.from(r.wav, 'base64'));
    console.log('render ms', r.ms.toFixed(0), 'events', r.events, '->', out);
  }
  console.log('console:', logs.slice(0, 20).join('\n') || '(none)');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
