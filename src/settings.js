// Player settings that persist between sessions (localStorage; falls back to defaults in private mode).
const KEY = 'bayhem.settings';
const DEFAULTS = { comfortVignette: true };

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEFAULTS }; }
}
export const settings = load();
export function setSetting(k, v) {
  settings[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* private mode: this session only */ }
}
