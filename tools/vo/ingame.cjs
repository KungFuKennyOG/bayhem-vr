// Boot each level in demo mode with live audio and log every DRIVER subtitle, whether its clip played,
// and any page errors / failed clip fetches.
// usage: npx vite (5173), then NODE_PATH=/opt/npm-tools/node_modules node tools/vo/ingame.cjs [seconds] [level ...]
const { chromium } = require('playwright');
const [secs = '45', ...lv] = process.argv.slice(2);
const LEVELS = lv.length ? lv : ['the-405-job', 'port-of-victory', 'downtown-haven', 'airport-no-return'];
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  let bad = 0;
  for (const level of LEVELS) {
    const p = await b.newPage({ viewport: { width: 640, height: 360 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    p.on('console', (m) => /vo load failed|voice/i.test(m.text()) && errs.push('CONSOLE ' + m.text()));
    p.on('response', (r) => r.url().includes('/vo/') && !r.ok() && errs.push('HTTP ' + r.status() + ' ' + r.url()));
    await p.goto(`http://localhost:5173/?demo&level=${level}${process.env.Q || ""}`);
    await p.waitForFunction(() => window.__hud && window.__audio, null, { timeout: 180000 });
    await p.evaluate(() => {
      window.__log = [];
      const hud = window.__hud, sub = hud.subtitle;
      hud.subtitle = (sp, text, d) => {
        const before = window.__audio.sys?._vo;
        sub(sp, text, d);
        const after = window.__audio.sys?._vo;
        if (sp === 'DRIVER') window.__log.push({ t: +(window.__game?.time ?? 0).toFixed?.(1), text, voiced: !!after && after !== before, loaded: Object.keys(window.__audio.sys?.vo || {}).length });
      };
    });
    await p.mouse.click(320, 180); // user gesture -> AudioContext + clip decode
    await p.waitForTimeout(+secs * 1000);
    const log = await p.evaluate(() => ({ log: window.__log, loaded: Object.keys(window.__audio.sys?.vo || {}).length, ctx: window.__audio.sys?.ctx?.state }));
    console.log(`\n== ${level}: ${log.loaded} clips decoded, AudioContext ${log.ctx}`);
    for (const l of log.log) { console.log(`  ${l.voiced ? 'VOICED' : 'silent'}  ${l.text}`); if (!l.voiced) bad++; }
    errs.forEach((e) => console.log('  ' + e)); bad += errs.length;
    await p.close();
  }
  await b.close();
  console.log(bad ? `\n${bad} problem(s)` : '\nall driver lines voiced, no errors');
})().catch((e) => { console.error(e); process.exit(1); });
