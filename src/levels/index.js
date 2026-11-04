// Level registry. Each level folder exports `create(E)` from its index.js (loaded lazily, one chunk per level).
const loaders = import.meta.glob('./*/index.js');

export const LEVELS = [
  {
    id: 'the-405-job', num: '01', title: 'THE 405 JOB', tagline: 'A HIGHWAY CHASE IN FIVE EXPLOSIONS',
    blurb: 'Freeway at sunset. You ride the truck bed. They bring SUVs, a fuel tanker and a gunship.',
    help: 'Rail level: aim and shoot, the driver handles the road.',
  },
  {
    id: 'port-of-victory', num: '02', title: 'PORT OF VICTORY', tagline: 'DOCKS AT DUSK. ONE SHIP. TOO MUCH FUEL.',
    blurb: 'On foot through a container maze at golden hour, all the way to the cargo ship. Then blow it up.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint.',
  },
];

export const levelById = (id) => LEVELS.find(l => l.id === id) || LEVELS[0];
export function loadLevel(id) {
  const l = loader(id);
  if (!l) throw new Error('unknown level ' + id);
  return l();
}
function loader(id) { return loaders[`./${id}/index.js`]; }
export const nextLevel = (id) => { const i = LEVELS.findIndex(l => l.id === id); return LEVELS[i + 1] || null; };
