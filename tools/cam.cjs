// usage: node tools/cam.cjs "<query>" <steps> <outprefix> "px,py,pz,tx,ty,tz[,fov]" ["..." ...]
// Runs the level for <steps> frames (no render), then renders the scene from free cameras (a set piece, a model in place).
const { chromium } = require('playwright');
(async () => {
  const [q, steps, out, ...cams] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await p.goto((process.env.URL || 'http://localhost:5173/') + '?capture=1&' + q);
  await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }).catch(() => logs.push('TIMEOUT ready'));
  if (process.env.PRE) await p.evaluate(process.env.PRE).catch(e => logs.push('PRE ' + e.message));
  await p.evaluate((n) => { for (let i = 0; i < n; i++) window.__step(1 / 30, i < n - 1); }, +steps);
  let i = 0;
  for (const c of cams) {
    const data = await p.evaluate((c) => {
      const v = c.startsWith('[') ? eval(c) : c.split(',').map(Number);
      const T = window.__THREE, r = window.__renderer;
      const cam = new T.PerspectiveCamera(v[6] || 60, 1280 / 720, 0.1, 6000);
      cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]); cam.updateMatrixWorld(true);
      r.render(window.__scene, cam);
      return document.querySelector('canvas').toDataURL('image/jpeg', 0.9);
    }, c);
    require('fs').writeFileSync(`${out}_${i++}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log(logs.slice(0, 10).join('\n'));
  await b.close();
})();
