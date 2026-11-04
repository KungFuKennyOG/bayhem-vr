import fs from 'fs';
let src = fs.readFileSync(new URL('../src/weapons.js', import.meta.url), 'utf8');
src = src.replace("add(g, o = {}) { this.parts.push(", "add(g, o = {}) { const ln = (new Error().stack.split('\\n')[2].match(/:(\\d+):\\d+\\)?$/) || [])[1]; globalThis.__parts.push([ln, () => (g.index ? g.index.count : g.attributes.position.count) / 3]); this.parts.push(");
fs.writeFileSync(new URL('./_w.mjs', import.meta.url), src);
globalThis.__parts = [];
const W = await import('./_w.mjs');
for (const fn of ['buildRifle', 'buildLauncher']) {
  globalThis.__parts = [];
  const m = W[fn]();
  const agg = {};
  for (const [ln, f] of globalThis.__parts) agg[ln] = (agg[ln] || 0) + f();
  const tot = Object.values(agg).reduce((a, b) => a + b, 0);
  console.log(fn, 'final tris', m.triangles, 'raw', tot, 'verts', m.mesh.geometry.attributes.position.count);
  console.log(Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 22).map(([l, n]) => `L${l}:${n}`).join('  '));
}
