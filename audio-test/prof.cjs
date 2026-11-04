// per-bake render time profiler: node prof.cjs [filter-regex]   (vite on :5180)
const { chromium } = require('playwright');
(async () => {
  const re = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage(); p.on('pageerror', (e) => console.log('err', e.message));
  await p.goto('http://127.0.0.1:5180/audio-test/l2.html'); await p.waitForFunction(() => window.__loaded);
  const r = await p.evaluate(async (re) => {
    const src = await (await fetch('/src/audio.js')).text();
    const url = URL.createObjectURL(new Blob([src + '\nexport { BAKES, LOOP_BAKES, MUSIC_BAKES, L2_BAKES, L2_LOOP_BAKES, Bk, makeNoise, rng, hashStr, SFX };'], { type: 'text/javascript' }));
    const M = await import(url);
    const ctx = new OfflineAudioContext(1, 48000, 48000), N = M.makeNoise(ctx), out = [];
    const all = Object.assign({}, M.BAKES, M.LOOP_BAKES, M.MUSIC_BAKES, M.L2_BAKES, M.L2_LOOP_BAKES);
    for (let pass = 0; pass < 2; pass++) { out.length = 0;
    for (const [k, d] of Object.entries(all)) {
      if (!new RegExp(re).test(k)) continue;
      const n = d.n ?? M.SFX[k]?.n ?? 1; let ms = 0, nodes = 0;
      for (let i = 0; i < n; i++) {
        const bsr = d.sr ? Math.min(48000, d.sr) : 48000, oc = new OfflineAudioContext(d.ch || 1, Math.ceil(d.dur * bsr), bsr);
        const t0 = performance.now(); d.fn(new M.Bk(oc, N, M.rng(M.hashStr(k) + i * 7919)), i); await oc.startRendering(); ms += performance.now() - t0;
      }
      out.push([k, n, d.dur, Math.round(ms)]);
    }
    }
    return out;
  }, re);
  let tot = 0; r.sort((a, b) => b[3] - a[3]).forEach(([k, n, d, ms]) => { tot += ms; console.log(k.padEnd(18), 'n', n, 'dur', d, 'ms', ms); });
  console.log('TOTAL (serial) ms', tot); await b.close();
})();
