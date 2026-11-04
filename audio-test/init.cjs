const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', e => console.log('err', e.message)); p.on('console', m => console.log(m.type(), m.text()));
await p.goto('http://localhost:5173/audio-test/index.html'); await p.waitForFunction(() => window.__loaded);
console.log('init ms', await p.evaluate(() => window.timeInit())); await b.close(); })();
