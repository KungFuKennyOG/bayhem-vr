// Same hash as src/vo.js voKey(): FNV-1a over the exact subtitle text, 8 hex chars.
function voKey(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
module.exports = { voKey };
