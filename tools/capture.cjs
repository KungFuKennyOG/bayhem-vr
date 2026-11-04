// Deterministic frame-by-frame capture of the trailer run.
// usage: node capture.cjs <outdir> [maxSeconds] [w] [h]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const [outDir, maxS = '130', w = '1280', h = '720'] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = path.join(outDir, 'video.partial.mp4');
  const final = path.join(outDir, 'video.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto('' + (process.env.URL || 'http://localhost:5174/') + '?capture=1&trailer=1');
  await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  const maxFrames = Math.round(+maxS * 30);
  let doneAt = -1;
  const t0 = Date.now();
  for (let f = 0; f < maxFrames; f++) {
    const res = await p.evaluate(() => {
      window.__step(1 / 30);
      const st = window.__state();
      return { img: document.querySelector('canvas').toDataURL('image/jpeg', 0.92), done: st.done, step: st.step };
    });
    const buf = Buffer.from(res.img.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (res.done && doneAt < 0) doneAt = f;
    if (doneAt >= 0 && f - doneAt > 30 * 2.5) break; // hold the end card 2.5 s
    if (f % 150 === 0) console.log(`frame ${f} (${(f / 30).toFixed(1)}s) step=${res.step} elapsed=${((Date.now() - t0) / 60000).toFixed(1)}min`);
  }
  const events = await p.evaluate(() => window.__audioEvents());
  const dur = await p.evaluate(() => window.__state().t);
  fs.writeFileSync(path.join(outDir, 'audio-events.json'), JSON.stringify({ duration: dur, events }));
  await b.close();
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  fs.renameSync(tmp, final);
  console.log('DONE', final, 'duration', dur.toFixed(2), 'events', events.length);
})();
