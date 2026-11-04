// Segmented deterministic capture: run several of these in parallel (one per CPU), each one simulates
// the run headless up to its first frame, then renders + encodes its own frame range.
// usage: node capture-seg.cjs <outdir> <startFrame> <endFrame|auto> [w] [h]
//   env: URL (default http://localhost:5174/), QUERY (extra query, e.g. level=port-of-victory)
//   endFrame=auto: run until the director is done (+2.5 s hold) — also writes audio-events.json (whole run)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const [outDir, startS = '0', endS = 'auto', w = '1280', h = '720'] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const start = +startS, auto = endS === 'auto', end = auto ? 30 * 600 : +endS;
  const name = `seg_${String(start).padStart(6, '0')}`;
  const tmp = path.join(outDir, name + '.partial.mp4'), final = path.join(outDir, name + '.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto((process.env.URL || 'http://localhost:5174/') + '?capture=1&trailer=1' + (process.env.QUERY ? '&' + process.env.QUERY : ''));
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const t0 = Date.now();
  // fast-forward without rendering
  for (let f = 0; f < start; f += 300) {
    const n = Math.min(300, start - f);
    await p.evaluate((n) => { for (let i = 0; i < n; i++) window.__step(1 / 30, true); }, n);
  }
  console.log(`${name}: skipped ${start} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  let doneAt = -1;
  for (let f = start; f < end; f++) {
    const res = await p.evaluate(() => {
      window.__step(1 / 30);
      const st = window.__state();
      return { img: document.querySelector('canvas').toDataURL('image/jpeg', 0.92), done: st.done, step: st.step };
    });
    const buf = Buffer.from(res.img.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (auto && res.done && doneAt < 0) doneAt = f;
    if (auto && doneAt >= 0 && f - doneAt > 30 * 2.5) break;
    if (f % 150 === 0) console.log(`${name}: frame ${f} (${(f / 30).toFixed(1)}s) step=${res.step} elapsed=${((Date.now() - t0) / 60000).toFixed(1)}min`);
  }
  if (auto) {
    const events = await p.evaluate(() => window.__audioEvents());
    const dur = await p.evaluate(() => window.__state().t);
    fs.writeFileSync(path.join(outDir, 'audio-events.json'), JSON.stringify({ duration: dur, events }));
    console.log('events', events.length, 'duration', dur.toFixed(2));
  }
  await b.close();
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  fs.renameSync(tmp, final);
  console.log('DONE', final);
})();
