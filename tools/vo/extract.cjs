// Collect every DRIVER line from the level code into tools/vo/lines.json.
// A line is any string literal passed (directly, or inside pick([...]) / a ternary) to
// `say(...)` or `hud.subtitle(...)`, where the speaker is DRIVER (or `say` has no speaker arg).
// Usage: node tools/vo/extract.cjs   (re-run after writing new lines, then tools/vo/gen.py)
const fs = require('fs'), path = require('path');
const { parseAst } = require('rollup/parseAst');
const { voKey } = require('./key.cjs');

const ROOT = path.resolve(__dirname, '../..');
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p); } })(path.join(ROOT, 'src'));

const SPEAKER = /^[A-Z]{2,}$/;
const lines = new Map(); // text -> { levels:Set, files:Set }
const levelOf = (f) => (f.match(/levels[\\/]([^\\/]+)/) || [])[1] || 'shared';

function strings(node, out) {
  if (!node || typeof node !== 'object') return out;
  if (node.type === 'Literal' && typeof node.value === 'string') out.push(node.value);
  else if (node.type === 'ArrayExpression') node.elements.forEach((e) => strings(e, out));
  else if (node.type === 'ConditionalExpression') { strings(node.consequent, out); strings(node.alternate, out); }
  else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'pick') node.arguments.forEach((a) => strings(a, out));
  return out;
}

function visit(node, file) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => visit(n, file));
  if (node.type === 'CallExpression') {
    const c = node.callee;
    const isSay = c.type === 'Identifier' && c.name === 'say';
    const isSub = c.type === 'MemberExpression' && c.property.name === 'subtitle';
    if (isSay || isSub) {
      const strs = node.arguments.flatMap((a) => strings(a, []));
      const speakers = strs.filter((s) => SPEAKER.test(s));
      const driver = speakers.length ? speakers.includes('DRIVER') : isSay;
      if (driver) for (const s of strs) if (!SPEAKER.test(s) && /[a-z]/i.test(s)) {
        const e = lines.get(s) || { levels: new Set(), files: new Set() };
        e.levels.add(levelOf(file)); e.files.add(path.relative(ROOT, file)); lines.set(s, e);
      }
    }
  }
  for (const k in node) if (k !== 'parent' && node[k] && typeof node[k] === 'object') visit(node[k], file);
}

for (const f of files) visit(parseAst(fs.readFileSync(f, 'utf8')), f);

const out = [...lines].map(([text, e]) => ({ key: voKey(text), text, levels: [...e.levels].sort(), files: [...e.files].sort() }))
  .sort((a, b) => a.levels[0].localeCompare(b.levels[0]) || a.files[0].localeCompare(b.files[0]));
const keys = new Set(out.map((l) => l.key));
if (keys.size !== out.length) throw new Error('voKey collision');
fs.writeFileSync(path.join(__dirname, 'lines.json'), JSON.stringify(out, null, 1));
const by = {}; out.forEach((l) => l.levels.forEach((v) => (by[v] = (by[v] || 0) + 1)));
console.log(out.length, 'driver lines', by);
