# LEVEL 9 — LIGHTS OUT (the rebuild)

BAYHEM 2's Level 5, the finale. Longwu, a fictional Chongqing: a city stacked up both banks of a river gorge, at
dusk going to night. The city's power goes out district by district behind you until one gold tower is the last
light in it; then that goes too.

The first version (PR #28) was thrown away after Kenny's first headset run: he quit on the first flight of stairs
because the way down did not read as open. See `claude/BAYHEM-level9-postmortem.md`. This one was designed from
the route outwards.

## The rule
**The way forward must read as open from standing eye height.** Nothing crosses the eye line on the route ahead.

- The whole on-foot route is **one level** (y 20), wide, outdoors: no stairs, no ramps, no interiors.
- `layout.LANES` are the strips you walk. Nothing taller than 1.2 m stands in them: `node tools/check-lanes.mjs`.
- Cover is 0.85–1.0 m (under a standing eye). Tall things (buses, shopfronts, lamps, masts, stays, the crown's
  columns) stand **beside** the lane. Nothing spans the lane below ~16 m.
- The goal is always in view and always the brightest thing ahead: the road points at the bridge, the bridge
  points at the tower, a lit inlay on the forecourt points at the lift.
- Every review round starts with `tools/lights-out-review.sh`: real-play frames (no autopilot) at eye height at the
  start of every beat. The autopilot walking it proves nothing about what it looks like.

## The place (`layout.js` holds every number)
+x east (upstream), +z south. The river runs east–west between z 160 and z 300.

- **South bank:** Kuixing Plaza (the start) and the cliff road, a riverside road on a retaining wall 20 m over the
  water. Shophouses along its south side, the city stacked up the bank behind them.
- **North bank, opposite the road:** the terraced hillside district (quay y 3, crest y 64), 120–260 m away and
  rising above you. It slides into the river (`slide.js`, the old level's skinned-mesh landslide, unchanged).
- **The bridge:** 141 m, cable-stayed, masts and stays outside the kerbs.
- **North bank, at the bridge's end:** Jinlong Tower on its podium. A lift platform up its south face, the roof,
  the gap in the west parapet.
- **The glide:** off the roof's west edge, 30° south of west out over the river, then west down the middle of it.

The route is low on purpose. From a road level with the hill's crest (the first grey box) the district hid under
your own cliff edge and sat 300 m off: the old level's "the slide doesn't read" again.

## Beats (`director.js`) — `?level=lights-out&beat=<name>`
1. **intro** — the plaza: title, the tower named. Look-gated (5 s cap): the upstream skyline goes dark.
2. **road** — the first half of the road: the jam, gunmen in the traffic and on the low shop roofs to your right.
3. **heron** — NIGHT HERON ONE comes up out of the gorge beside you and holds 35–55 m off the rail. Shot down (or
   burning on its own after 75 s) it holds until you look (4 s cap), then limps across the river into the gold
   tower on the hill's crest. The hill slides into the river, square on, lit.
4. **wave** — downstream goes, then the road's own lamps, section by section, past you and on ahead, then the
   south bank's skyline. The bridge and the tower are still lit: that is the way.
5. **bridge** — the rest of the road and the bridge. Its lamps die behind you span by span; mid-river the north
   skyline goes. A sniper on the podium.
6. **fore** — the forecourt, lit by the tower alone.
7. **lift** — step on; it goes when you have stood on it for a moment. ~32 s up the face over the dark city.
8. **roof** — NIGHT HERON TWO: rises off the west edge, circles the crown, ducks under the roof line, ropes men
   onto the deck. This one you finish; it comes round and goes into the tower's west face under the parapet.
9. **jump** — the orange locker (the rig), the gap in the west parapet, the jump.
10. **glide** — 3 s after the canopy opens the tower goes over, due west. Its crown sweeps past ~50 m off your right
    side at your own height, lights dying as it goes; it lands across the hole the hill left and Longwu is dark.
    Then jumpers, two barges with searchlights, the gunboat (shoot the drums); you land on its deck.
11. **outro** — the lights come back, district by district, from downstream up. Stats card.
12. **credits**.

## Comfort (VR)
- Smooth stick + 45° snap turn on foot. Code never moves the head.
- **Lift:** a steady ride (ease in, 6.5 m/s, ease out), open platform, you can walk about on it. `?lift=blink`
  swaps it for a blink to black.
- **Glide:** no free fall (the canopy opens 0.75 s after the edge, in slow-mo), a rail at a steady 8.2 m/s and
  1 : 2.64, no roll, yaw follows the line at ≤ 3°/s (one 30° turn in the whole glide). The canopy is a fixed frame
  whose risers sit above and behind your head.
- **The tower passing:** ~50 m off the line. `?fall=far` sends it 15° further away.
- Big moments are look-gated with a timeout (the first cut, both gunship deaths). The tower fall is not: it comes
  into your view on its own, and a marker rides its crown.
- Nothing waits on your aim: both gunships burn down on their own (75 s / 170 s).

## Power (`kit.js` POWER, `layout.DIST`, `setpieces.cut`)
One code per emissive vertex. Districts: R0–R3 (the road, west → east), BR0–BR2 (the bridge, south → north), HILL,
EAST (the static hill and the terraces east of the tower), FORE, TOWER (must stay 10: the dying-tower shader),
FAR_N / FAR_S / FAR_E / FAR_W (the skylines), ALWAYS. `setpieces.cut(id, {kind})` queues one cut (`flick`, `cut`
top-down, `on`). The city's glow (sky, fog) follows whatever is still lit.

## Modules
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
