// Level registry. Each level folder exports `create(E)` from its index.js (loaded lazily, one chunk per level).
const loaders = import.meta.glob('./*/index.js');

// every level, including prototypes (hidden: true = loads with ?level=<id> but stays out of the menu)
const ALL = [
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
  {
    id: 'downtown-haven', num: '03', title: 'DOWNTOWN HAVEN CITY', tagline: 'GLASS CANYON. RED DOTS. ONE FALLING SKYSCRAPER.',
    blurb: 'On foot down an avenue of glass towers at sunset: rooftop snipers, a gunship, and a dust wall to outrun.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. Watch for red laser dots.',
  },
  {
    id: 'airport-no-return', num: '04', title: 'AIRPORT NO RETURN', tagline: 'RUNWAY 27. SUNSET. ONE WAY OUT.',
    blurb: 'Fight across a sunset apron, ground two jets, then chase a cargo plane down the runway in a borrowed jeep.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. In the jeep: just shoot. When it says JUMP: grip / A (VR) or Space.',
  },
  {
    id: 'iron-lady', num: '05', title: 'THE IRON LADY', tagline: 'PARIS AFTER RAIN. 7,300 TONNES OF STEEL.',
    blurb: 'Fight down the Seine quays at night, cross the bridge, bring down a gunship among the lattice — then watch her fall.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. At the end, run onto the boat.',
  },
  {
    id: 'tokyo-scramble', num: '06', title: 'TOKYO SCRAMBLE', tagline: 'HARD SUN. ONE CROSSING. ONE GAS MAIN.',
    blurb: 'Down into the scramble crossing under the giant screens, up through the station decks onto the expressway — then run from the street itself.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. Watch the billboard catwalks for red dots — and look up at the decks.',
  },
  {
    id: 'whiteout', num: '07', title: 'WHITEOUT', tagline: 'ONE STORM. ONE CABLE CAR. ONE VERY BIG MOUNTAIN.',
    blurb: 'Fight up the switchbacks in a blizzard, ride the cable car across the gorge, take the summit station — then the storm breaks.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. In the cable car: just shoot. Look up the slope — they shoot down from the road above.',
  },
  {
    id: 'dubai-proto', num: '08', title: 'DUBAI PROTOTYPE', tagline: 'TECH TEST: GREY BOXES, PERF PANEL', proto: true, hidden: true,
    blurb: 'Door-gunner heli loop around a collapsing grey-box skyline. Measures the Level 8 finale on the headset.',
    help: 'Heli rail, seated. L-grip = worst case, R-grip = reset, A = next mid tower, B = hero tower, X = dust level, Y = panel. Desktop: 1 worst, 0 reset, 2 mid, 3 hero, 4 dust, 5 panel.',
  },
];

// the menu and the level order
export const LEVELS = ALL.filter(l => !l.hidden);

export const levelById = (id) => ALL.find(l => l.id === id) || LEVELS[0];
export function loadLevel(id) {
  const l = loader(id);
  if (!l) throw new Error('unknown level ' + id);
  return l();
}
function loader(id) { return loaders[`./${id}/index.js`]; }
// prototypes are never offered as the "next level" (and have no next level themselves)
export const nextLevel = (id) => { const i = LEVELS.findIndex(l => l.id === id); const n = i < 0 ? null : LEVELS[i + 1]; return n && !n.proto ? n : null; };
