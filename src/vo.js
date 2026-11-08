// Driver voice-over. Every DRIVER subtitle that has a recorded clip (src/vo-manifest.js, public/vo/<key>.ogg)
// is also spoken over the radio. Lines are matched by their exact subtitle text, so level code keeps calling
// hud.subtitle('DRIVER', text) and nothing else changes. Lines with no clip still get the radio squelch.
// To add or change lines: edit the text in the level, then run tools/vo (see tools/vo/README.md).
import { rootUrl } from './game.js';
import MANIFEST from './vo-manifest.js';

export function voKey(s) { // FNV-1a, same as tools/vo/key.cjs
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

const url = (k) => rootUrl(`vo/${k}.ogg`); // from the site root, so /2/ (BAYHEM 2) finds the same clips

export function attachVoice(hud, audio, levelId) {
  // Download this level's clips right away (no user gesture needed), decode them once the AudioContext exists.
  // A line that fires before its clip is ready just plays as subtitle + squelch.
  const mine = Object.keys(MANIFEST).filter((k) => MANIFEST[k][1].includes(levelId));
  const bytes = audio.record ? [] : mine.map((k) => [k, fetch(url(k)).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })]);
  bytes.forEach(([, p]) => p.catch(() => {})); // failures are reported by loadVoices
  // audio.init() awaits this, so the intro line is ready when the level starts; never hold the start up for long
  const load = () => Promise.race([audio.loadVoices(bytes), new Promise((r) => setTimeout(r, 3000))]);
  if (audio.sys) load(); else audio.onReady = load;

  const subtitle = hud.subtitle.bind(hud);
  hud.subtitle = (speaker, text, dur = 2.5) => {
    if (speaker.toUpperCase() === 'DRIVER') {
      audio.play('radio_squelch', { volume: 0.6 });
      const k = voKey(text), m = MANIFEST[k];
      if (m) { audio.voice(k, url(k)); dur = Math.max(dur, m[0] + 0.4); } // keep the subtitle up while he talks
    }
    subtitle(speaker, text, dur);
  };
}
