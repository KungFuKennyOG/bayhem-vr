// App icons (home screen, favicon, Android install) for both games, drawn procedurally from the menu title's
// look: the Anton "B" with the title's gradient and glow on the menu's background. Writes PNGs to public/icons/.
// Re-run after changing the look:  NODE_PATH=/opt/npm-tools/node_modules node tools/icons/make.cjs
//   b-<size>.png  = BAYHEM (sunset brass)      b2-<size>.png = BAYHEM 2 (night steel + the molten 2)
// iOS rounds the corners itself and fills transparency with black, so the icons are full-bleed and opaque.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'public/icons');
const FONT = path.join(ROOT, 'node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2');
const SIZES = [16, 32, 48, 180, 192, 512];

const draw = `async (game, sizes) => {
  await document.fonts.load('400 700px Anton');
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const two = game === 2;
  // background: the menu's dark field with a glow rising behind the letter
  x.fillStyle = two ? '#04080f' : '#0e0604'; x.fillRect(0, 0, S, S);
  let g = x.createRadialGradient(S * 0.5, S * 0.62, 0, S * 0.5, S * 0.62, S * 0.75);
  if (two) { g.addColorStop(0, 'rgba(60,120,210,0.55)'); g.addColorStop(0.45, 'rgba(25,55,105,0.35)'); g.addColorStop(1, 'rgba(3,7,14,0)'); }
  else { g.addColorStop(0, 'rgba(255,120,30,0.62)'); g.addColorStop(0.45, 'rgba(150,50,10,0.32)'); g.addColorStop(1, 'rgba(14,6,4,0)'); }
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  // BAYHEM 2: the menu's steel grid, faint
  if (two) { x.strokeStyle = 'rgba(120,180,255,0.07)'; x.lineWidth = 3; for (let i = 64; i < S; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); } }
  // vignette
  g = x.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);

  // the B: Anton, the title's gradient (bright top, a dark chrome line through the middle), glow + hard drop
  // BAYHEM 2: B and the molten 2 side by side at the same height, like the menu title; the pair is centred
  const fsz = two ? 580 : 760;
  x.font = 'italic 400 ' + fsz + 'px Anton';
  const w2 = two ? x.measureText('2').width : 0, gap = fsz * 0.05;
  x.font = '400 ' + fsz + 'px Anton'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const m = x.measureText('B'), capH = m.actualBoundingBoxAscent, wB = m.width;
  // the 2's skew leans its top right: shift the pair left by half that lean so it reads centred
  const left = (S - (wB + (two ? gap + w2 : 0))) / 2 - (two ? fsz * 0.03 : 0);
  const bx = two ? left + wB / 2 : S * 0.5, by = S * 0.5 + capH / 2;
  const tx2 = left + wB + gap + w2 / 2;
  const top = by - capH;
  const lg = x.createLinearGradient(0, top, 0, by);
  const stops = two ? [[0, '#ffffff'], [0.38, '#dfeaf7'], [0.5, '#3b4d63'], [0.56, '#9fb6cf'], [1, '#eef5ff']]
    : [[0, '#ffffff'], [0.42, '#ffe2b4'], [0.5, '#6a4a2c'], [0.58, '#ffc46b'], [1, '#fff2d6']];
  for (const [o, col] of stops) lg.addColorStop(o, col);
  x.save();
  x.shadowColor = two ? 'rgba(90,160,255,0.75)' : 'rgba(255,110,10,0.85)'; x.shadowBlur = 70;
  x.fillStyle = two ? '#9fb6cf' : '#ffb35a'; x.fillText('B', bx, by);   // glow pass
  x.restore();
  x.fillStyle = two ? '#04080f' : '#1a0d04'; x.fillText('B', bx, by + 16); // hard drop shadow
  x.fillStyle = lg; x.fillText('B', bx, by);
  x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.25)'; x.strokeText('B', bx, by);

  if (two) {
    // the molten italic 2, the B's height, skewed like the title's
    x.save();
    x.font = 'italic 400 ' + fsz + 'px Anton';
    x.translate(tx2, by); x.transform(1, 0, -0.1, 1, 0, 0);
    const m2 = x.measureText('2'), h2 = m2.actualBoundingBoxAscent;
    const mg = x.createLinearGradient(0, -h2, 0, 0);
    for (const [o, col] of [[0, '#fff4d6'], [0.3, '#ffb14a'], [0.55, '#ff5a14'], [0.78, '#9e1606'], [1, '#ff7a2a']]) mg.addColorStop(o, col);
    x.shadowColor = 'rgba(255,90,20,0.9)'; x.shadowBlur = 60; x.fillStyle = '#ff6a1a'; x.fillText('2', 0, 0);
    x.shadowBlur = 0; x.fillStyle = '#04080f'; x.fillText('2', 0, 14);
    x.fillStyle = mg; x.fillText('2', 0, 0);
    x.restore();
  }
  // downscale in halving steps (sharp small sizes)
  const out = {};
  for (const n of sizes) {
    let src = c, w = S;
    while (w / 2 >= n * 1.5) { const h = document.createElement('canvas'); h.width = h.height = w / 2; const hx = h.getContext('2d'); hx.imageSmoothingQuality = 'high'; hx.drawImage(src, 0, 0, w / 2, w / 2); src = h; w /= 2; }
    const d = document.createElement('canvas'); d.width = d.height = n; const dx = d.getContext('2d'); dx.imageSmoothingQuality = 'high'; dx.drawImage(src, 0, 0, n, n);
    out[n] = d.toDataURL('image/png').split(',')[1];
  }
  return out;
}`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const font = fs.readFileSync(FONT).toString('base64');
  const b = await chromium.launch();
  const page = await b.newPage();
  await page.setContent(`<style>@font-face{font-family:Anton;src:url(data:font/woff2;base64,${font}) format('woff2')}</style><body>`);
  for (const game of [1, 2]) {
    const pngs = await page.evaluate(`(${draw})(${game}, ${JSON.stringify(SIZES)})`);
    for (const [n, data] of Object.entries(pngs)) {
      const f = path.join(OUT, `${game === 2 ? 'b2' : 'b'}-${n}.png`);
      fs.writeFileSync(f, Buffer.from(data, 'base64'));
      console.log(path.relative(ROOT, f), fs.statSync(f).size, 'bytes');
    }
  }
  await b.close();
})();
