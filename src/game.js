// Which game this page is. BAYHEM (Levels 1–4, Haven City) lives at the site root, BAYHEM 2 (abroad:
// Paris, Tokyo, the Grauhorn, Al-Sarab) at /2/. Both pages load the same engine (src/main.js); each
// index.html says which game it is and where the site root is with two meta tags:
//   <meta name="bayhem-game" content="2">   <meta name="bayhem-root" content="../">
const meta = (n) => (typeof document !== 'undefined' && document.querySelector(`meta[name="${n}"]`)?.content) || null;

export const PAGE_GAME = parseInt(meta('bayhem-game') || '1', 10) === 2 ? 2 : 1;
export const ROOT = meta('bayhem-root') || './'; // relative path from this page to the site root

// absolute URL of a file under the site root (public/ assets such as vo/<key>.ogg)
export const rootUrl = (path) => new URL(ROOT + path, location.href).toString();

// URL of a game's page; keeps the current query string (debug flags) unless `keep` is false
export function gameUrl(game, levelId = null, keep = true) {
  const u = new URL(ROOT + (game === 2 ? '2/' : ''), location.href);
  if (keep) u.search = location.search;
  if (levelId) u.searchParams.set('level', levelId); else u.searchParams.delete('level');
  return u.toString();
}

export const GAMES = {
  1: { title: 'BAYHEM', sub: null, store: 'bayhem.level' },
  2: { title: 'BAYHEM', two: '2', sub: 'THIS TIME IT’S GLOBAL', store: 'bayhem2.level' },
};
