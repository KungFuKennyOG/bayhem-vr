// Level registry. Each level folder exports `create(E)` from its index.js (loaded lazily, one chunk per level).
const loaders = import.meta.glob('./*/index.js');

// every level, including prototypes (hidden: true = loads with ?level=<id> but stays out of the menu).
// game: 1 = BAYHEM (site root, Haven City), 2 = BAYHEM 2 (/2/, abroad). `num` is the number inside its game.
// Level ids never change between games, so ?level=<id>, ?beat=, the tools and the docs keep working.
const ALL = [
  {
    id: 'the-405-job', game: 1, num: '01', title: 'THE 405 JOB', tagline: 'A HIGHWAY CHASE IN FIVE EXPLOSIONS',
    blurb: 'Freeway at sunset. You ride the truck bed. They bring SUVs, a fuel tanker and a gunship.',
    help: 'Rail level: aim and shoot, the driver handles the road.',
  },
  {
    id: 'port-of-victory', game: 1, num: '02', title: 'PORT OF VICTORY', tagline: 'DOCKS AT DUSK. ONE SHIP. TOO MUCH FUEL.',
    blurb: 'On foot through a container maze at golden hour, all the way to the cargo ship. Then blow it up.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint.',
  },
  {
    id: 'downtown-haven', game: 1, num: '03', title: 'DOWNTOWN HAVEN CITY', tagline: 'GLASS CANYON. RED DOTS. ONE FALLING SKYSCRAPER.',
    blurb: 'On foot down an avenue of glass towers at sunset: rooftop snipers, a gunship, and a dust wall to outrun.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. Watch for red laser dots.',
  },
  {
    id: 'airport-no-return', game: 1, num: '04', title: 'AIRPORT NO RETURN', tagline: 'RUNWAY 27. SUNSET. ONE WAY OUT.',
    blurb: 'Fight across a sunset apron, ground two jets, then chase a cargo plane down the runway in a borrowed jeep.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. In the jeep: just shoot. When it says JUMP: grip / A (VR) or Space.',
  },
  {
    id: 'iron-lady', game: 2, num: '01', code: 'PAR', loc: 'PARIS', time: '21:00', title: 'THE IRON LADY', tagline: 'PARIS AFTER RAIN. 7,300 TONNES OF STEEL.',
    blurb: 'Fight down the Seine quays at night, cross the bridge, bring down a gunship among the lattice — then watch her fall.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. At the end, run onto the boat.',
  },
  {
    id: 'tokyo-scramble', game: 2, num: '02', code: 'TYO', loc: 'KUROGANE, TOKYO', time: '15:40', title: 'TOKYO SCRAMBLE', tagline: 'HARD SUN. ONE CROSSING. ONE GAS MAIN.',
    blurb: 'Down into the scramble crossing under the giant screens, up through the station decks onto the expressway — then run from the street itself.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. Watch the billboard catwalks for red dots — and look up at the decks.',
  },
  {
    id: 'whiteout', game: 2, num: '03', code: 'GRH', loc: 'GRAUHORN, ALPS', time: '3 412 M', title: 'WHITEOUT', tagline: 'ONE STORM. ONE CABLE CAR. ONE VERY BIG MOUNTAIN.',
    blurb: 'Fight up the switchbacks in a blizzard, ride the cable car across the gorge, take the summit station — then the storm breaks.',
    help: 'On foot: left stick / WASD to move, right stick snaps 45°, Shift to sprint. In the cable car: just shoot. Look up the slope — they shoot down from the road above.',
  },
  {
    id: 'sand-castles', game: 2, num: '04', code: 'SRB', loc: 'AL-SARAB, GULF', time: '16:50', title: 'SAND CASTLES', tagline: 'SUPERTALLS. SANDSTORM. ONE DOOR GUN.',
    blurb: 'Door gunner over Al-Sarab: rooftop fights, a gunship duel inside a haboob, a laser designator — and the tallest tower in the Gulf.',
    help: 'Seated or standing, the helicopter flies itself. Right hand: the door gun (hold the trigger). Left hand: grenade launcher, and later the laser designator (hold on a target).',
  },
  {
    id: 'dubai-proto', game: 2, num: '04', title: 'DUBAI PROTOTYPE', tagline: 'TECH TEST: GREY BOXES, PERF PANEL', proto: true, hidden: true,
    blurb: 'Door-gunner heli loop around a collapsing grey-box skyline. Measures the Level 8 finale on the headset.',
    help: 'Heli rail, seated. L-grip = worst case, R-grip = reset, A = next mid tower, B = hero tower, X = dust level, Y = panel. Desktop: 1 worst, 0 reset, 2 mid, 3 hero, 4 dust, 5 panel.',
  },
];

// announced but not built yet: shown in their game's menu as a locked card (and on BAYHEM 2's route line), never
// loadable and never offered as the next level. When a level gets built, move it into ALL with the same fields.
export const SOON = [
  {
    id: 'chongqing', game: 2, num: '05', code: 'CKG', loc: 'CHONGQING', time: 'DUSK \u2192 NIGHT', title: 'CHONGQING', final: true,
    tagline: 'THE LAST JUMP.',
    blurb: 'A city stacked on cliffs over a fogged gorge. Fight up and down through it as the lights go out \u2014 then the only way out is down.',
  },
];
export const soonOf = (game) => SOON.filter(l => l.game === game);

// the menu and the level order (both games, in play order)
export const LEVELS = ALL.filter(l => !l.hidden);
export const levelsOf = (game) => LEVELS.filter(l => l.game === game);

export const levelById = (id) => ALL.find(l => l.id === id) || LEVELS[0];
export const findLevel = (id) => ALL.find(l => l.id === id) || null;
export function loadLevel(id) {
  const l = loader(id);
  if (!l) throw new Error('unknown level ' + id);
  return l();
}
function loader(id) { return loaders[`./${id}/index.js`]; }
// prototypes are never offered as the "next level" (and have no next level themselves); the next level
// stays inside the same game (the last level of BAYHEM hands over to BAYHEM 2 from the end screen)
export const nextLevel = (id) => {
  const i = LEVELS.findIndex(l => l.id === id); const cur = LEVELS[i], n = i < 0 ? null : LEVELS[i + 1];
  return n && !n.proto && n.game === cur.game ? n : null;
};
