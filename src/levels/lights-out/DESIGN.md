# LEVEL 9 — LIGHTS OUT (the rebuild)

BAYHEM 2's Level 5, the finale. Longwu, a fictional Chongqing: a city stacked up both banks of a river gorge, at
dusk going to night. The city's power goes out district by district behind you until one gold tower is the last
light in it; then that goes too.

The first version (PR #28) was thrown away after Kenny's first headset run: he quit on the first flight of stairs
because the way down did not read as open. See `claude/BAYHEM-level9-postmortem.md`. This one was designed from
the route outwards.

## The rule
**The way forward must read as open from standing eye height.** Nothing crosses the eye line on the route ahead.

- The on-foot route is wide and outdoors: no interiors, no ramps. It is **one level** (y 20) from the plaza on. The one
  exception is the opening, **the Hundred Steps**: the first version's first flight of stairs, which Kenny liked
  ("it's only the other stairs that was not well built"). It is back (`steps.js`): a 12 m wide open stair between
  shophouses, long landings, and from its head you see the plaza at its foot. Polish pass (Nov 13): no centre rail
  (wall rails on the flights only), flat granite treads with pale nosings and dark risers so a flight reads as steps
  from the top, stepped cheeks down both edges, paved landings, and single-storey stalls under the flyover.
- `layout.LANES` are the strips you walk. Nothing taller than 1.2 m stands in them: `node tools/check-lanes.mjs`.
- Cover is 0.85–1.0 m (under a standing eye). Tall things (buses, shopfronts, lamps, masts, stays, the crown's
  columns) stand **beside** the lane. Nothing spans the lane below ~16 m.
- The goal is always in view and always the brightest thing ahead: the road points at the bridge, the bridge
  points at the tower, a lit inlay on the forecourt points at the lift.
- Every review round starts with `tools/lights-out-review.sh`: real-play frames (no autopilot) at eye height at the
  start of every beat. The autopilot walking it proves nothing about what it looks like.

## The place (`layout.js` holds every number)
+x east (upstream), +z south. The river runs east–west between z 160 and z 300.

- **South bank, above the road:** the Longwu Department Store's roof (the start, y 34) and the Hundred Steps down
  from it, north, into Kuixing Plaza. The ring-road flyover crosses over the steps.
- **South bank:** Kuixing Plaza and the cliff road, a riverside road on a retaining wall 20 m over the
  water. Shophouses along its south side, the city stacked up the bank behind them.
- **North bank, opposite the road:** the terraced hillside district (quay y 3, crest y 64), 120–260 m away and
  rising above you. It is lit all level and it goes into the river at the very end (`slide.js`, the old level's
  skinned-mesh landslide, unchanged).
- **The bridge:** 141 m, cable-stayed, masts and stays outside the kerbs.
- **North bank, at the bridge's end:** Jinlong Tower on its podium. A lift platform up its south face, the roof,
  the gap in the west parapet.
- **The glide:** off the roof's west edge, south-west past the falling tower, then west along the hill's face at
  the hill's own height (106 → 31 m up, 22–50 m off its toe), then a flatter run-in down the river to the gunboat.
  Jinlong is 130 m tall (it was 195) for exactly this: from a taller roof you pass the hill 100 m above it and the
  slide happens under your feet instead of beside you.

The route is low on purpose. From a road level with the hill's crest (the first grey box) the district hid under
your own cliff edge and sat 300 m off: the old level's "the slide doesn't read" again.

## Beats (`director.js`) — `?level=lights-out&beat=<name>`
1. **intro** — the store's roof: title, the tower named. Look-gated (4 s cap): the upstream skyline goes dark. The roof
   is yours to leave at any time: reach the head of the steps and the intro ends there (the cut happens at once if it
   hasn't, the rest of the intro's lines are dropped).
2. **steps** — down the Hundred Steps: gunmen on the landings below, two on the flyover above, a laser sniper.
   Nobody spawns behind you: every spawn on the on-foot route is checked against how far along the route you have got
   (`route()` in `director.js`), and a point you have already reached is skipped.
3. **road** — the first half of the road: the jam, gunmen in the traffic and on the low shop roofs to your right.
4. **heron** — NIGHT HERON ONE comes up out of the gorge beside you and holds 35–55 m off the rail. Shot down (or
   burning on its own after 75 s) it holds until you look (4 s cap), then limps across the river into the gold
   block on the hill's crest and stays there, burning. The hill holds. The district east of it goes dark.
5. **wave** — downstream goes, then the road's own lamps, section by section, past you and on ahead, then the
   south bank's skyline. The bridge and the tower are still lit: that is the way.
6. **bridge** — the rest of the road and the bridge. Its lamps die behind you span by span; mid-river the north
   skyline goes. A sniper on the podium.
7. **fore** — the forecourt, lit by the tower alone.
8. **lift** — step on; it goes when you have stood on it for a moment. ~20 s up the face over the dark city.
9. **roof** — NIGHT HERON TWO: rises off the west edge, circles the crown, ducks under the roof line, ropes men
   onto the deck. This one you finish; it comes round and goes into the tower's west face under the parapet.
10. **jump** — the orange locker (the rig), the jump gantry in the west parapet, the jump.
11. **glide** — THE MONEY SHOT. 3 s after the canopy opens the tower goes over, due west, and lands on the hillside
    district: the only thing in Longwu still lit. As you come level with the hill it lets go (`director.js`:
    `sp.rail.s > 105` after the impact) and slides into the river beside you, east to west, with its lights on, gas
    mains going up under it. Then Longwu is dark. Jumpers, two barges with searchlights, the gunboat (shoot the
    drums). The boat swings broadside before you reach it: you land on its aft deck looking west across the beam.
12. **outro** — the lights come back, district by district, from downstream up. Stats card.
13. **credits**.

## Art pass on the stairs and the gunboat (Nov 13, after Kenny: "to the same level as the other levels")
Independent reviews (fresh reviewer each round, calibrated on Iron Lady ≈ 8, Tokyo ≈ 6.5), stairs / boat:
5 / 4 → 5.5 / 4.5 → 5.5 / 4.5 → **6.5 / 5**. What moved it: the floor light (the stair floor's baked pools were far too
bright: a uniform noon floor; now dark granite with warm spill off the shops and pools under the lanterns, the shop
lights in the light map at a third), granite flags with joints, striped faded awnings, weathered signs (the atlas is
desaturated 22 % with soot edges), no AC units / balconies in front of fascia signs, shop interiors with stocked shelves,
the boat's painted-steel / anti-skid textures, a lit aft bulkhead, a real torus lifebuoy, hose reel, door, porthole.
Second pass (Nov 13 evening): the outro surroundings. The river's banks were black slabs from the deck: the stilt houses
under the road now take the gold lamp line's wash from above (`box({ emHi })`, new in kit.js, with `emLo` for washes
from below), the north quay houses and the shelf's mid-rises a wash from below, tower podiums a street-level wash
(level-wide), the north rock face pools of light round the cliff-stair lamps, the south cliff a sodium wash from the
road; lamp posts with pools along the north quay; burning wreckage from the slide drifting down past the gunboat
(`buildWreck`, `spawnDrift`: its fires feed the pooled lights, so the deck flickers); searchlight lens glows sized by
distance. Reviews after it: stairs 6.5 / 6, boat 5.5 / 4.5 (reviewer spread ±1): a plateau around **stairs 6.5,
boat 5**. Iron Lady is 8.
Still open (in order): the city reads as boxes (towers are pillars with striped window grids, the riverfront slabs repeat)
— this is the level-wide city kit, not the boat; the wreckage needs real modelling (hull fragments, broken ribs, foam);
signs repeat between neighbouring frames; the stair floors are clean (no litter / puddle decals);
the riverbank and skyline in the outro crush to black boxes (level-wide city facades); shop
interiors still read as dioramas; stair props read as plastic (desaturate, scale the noodle cups down, cluster into
stalls); no wet reflections; the boat deck could use more work-light and seams; the outro has no spectacle left
(smoke columns, fires on the bank).

## The radio (`director.js`, `Radio`)
One line at a time; a clip never cuts off the one before it. Story lines queue in order (12 s shelf life); urgent lines
(what a gunship / the tower is doing right now) go next; barks (taxi jokes, "sniper down") only play into silence.
Lines timed inside a beat (`beatLater`) are dropped if you have left that beat. Changing a line's text drops its voice:
regenerate with `tools/vo` (README there).

## Laser sights
`game.beamOver` caps how far a beam runs past its aim (rifles 4 m, snipers 18 m) and `game.clipBeam` marches it against
`groundAt` (the steps, the banks, the water): none of those are in the collision world, and the beams used to run on
through the flights and across the river. Both hooks are opt-in in the shared laser code.

## Comfort (VR)
- Smooth stick + 45° snap turn on foot. Code never moves the head.
- **Stairs:** only the Hundred Steps, walked with the stick like any ground (33° flights, 13–15 m landings).
- **Lift:** a steady ride (ease in, 6.5 m/s, ease out), open platform, you can walk about on it. `?lift=blink`
  swaps it for a blink to black.
- **Glide:** no free fall (the canopy opens 0.75 s after the edge, in slow-mo), a rail at a steady 8.2 m/s,
  1 : 2.64 past the hill and 1 : 5 on the run-in, no roll, yaw follows the line at ≤ 3°/s (one slow turn in the whole glide). The canopy is a fixed frame
  whose risers sit above and behind your head.
- **The tower passing:** its crown comes down ahead-right of you, 40–60 m off the line. `?fall=far` sends it 15° further away.
- Big moments are look-gated with a timeout (the first cut, both gunship deaths). The tower fall is not: it comes
  into your view on its own, and a marker rides its crown.
- Nothing waits on your aim: both gunships burn down on their own (75 s / 170 s).

## Power (`kit.js` POWER, `layout.DIST`, `setpieces.cut`)
One code per emissive vertex. Districts: R0–R3 (the road, west → east), BR0–BR2 (the bridge, south → north), HILL,
EAST (the static hill and the terraces east of the tower), FORE, TOWER (must stay 10: the dying-tower shader),
FAR_N / FAR_S / FAR_E / FAR_W (the skylines), ALWAYS. `setpieces.cut(id, {kind})` queues one cut (`flick`, `cut`
top-down, `on`). The city's glow (sky, fog) follows whatever is still lit. In the blackout `POWER.dim` takes the
facades down and the fog goes darker than the sky's horizon, so the city is dark shapes against the sky, with
fires (`city.js` glows) and red beacons in it.

## Modules
- Back from the first version, in its own old frame, turned and set down: `steps.js` (the store's roof, the Hundred
  Steps, the flyover).
- New: `layout.js`, `route.js` (plaza, road, frontage, bridge, forecourt), `jinlong.js` (tower, roof, lift),
  `boss.js` (both gunships), `setpieces.js`, `director.js`, `world.js`, `index.js`.
- Re-sited: `terrain.js` (banks), `city.js` (`buildCity`: four skyline districts; `towerBlock` unchanged).
- Kept as systems: `kit.js`, `kitbuild.js`, `mats.js`, `tex.js`, `signs.js`, `sky.js`, `lightmap.js`, `slide.js`,
  `glide.js`, `searchlights.js`, `river.js`, `ai.js`, `traffic.js`, `game.js`.
- Gone with the old level: `west.js`, `lantern.js`, `east.js`, `bridge.js`, `tower.js`, `gunship.js`.

## Tools
- `tools/lights-out-review.sh <dir>` — the fixed review frames.
- `tools/run-level.cjs "level=lights-out" 700 10 [prefix]` — a fast headless autopilot run, state every 10 s.
- `tools/check-lanes.mjs` — the lanes are clear.
- `tools/beat-sweep.cjs lights-out <beats>` — every beat boots and runs with and without the autopilot.

## Skyline pass (city.js / kit.js / route.js / terrain.js)
Blind A/B reviews: skyline 4.5–5 → 6 (Iron Lady calibration ≈ 8).
- Towers: setbacks, cruciform (notched) plans, notched roof slabs, antenna masts + red lights, LED roof outlines, helipads,
  tower cranes (one tall roof in eleven), two hero "skybridge" clusters (ne/sw). LED corner strips and floor bands follow
  each stage's real outline (they used to run round the bounding box and stood off notched/set-back facades like a cage).
- The south hill has a ground now: a dark heightfield on `southBase` with a sodium street grid (out with each district),
  retaining walls of windowed cliff-houses round the store's hole and along the hill's foot, and 140 low old-town blocks
  packed up the hill round the store. (The towers used to stand on 30 m plinths over the flat road-level plane: stilts
  over a void from the roof, the lift and the glide.)
- Fog: far 1450; lit things get part of what the fog took back (`gWinEm`, ×0.45); the haze thins with height in the
  lit-kit shader (fog × (1 − 0.38·smoothstep(45, 230, y))) so tall far towers no longer stand out pale against the
  darker sky ('cardboard ghosts').
- Darker, varied walls on the river-facing rows (the stilt houses under the road, the far frontage blocks, the north
  terraces) + roof clutter (tanks, plant rooms, AC) on the north terraces.
Left: blackout views (roof/lift) are one dark value plane; the north ridge reads as a smooth dome; LED trims can still
alias at distance on Quest; mid-ground window grids are uniform.
