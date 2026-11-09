# LEVEL 9 — LIGHTS OUT (design + asset contracts)

Longwu, a fictional Chongqing: a city stacked on a cliff over a fogged river gorge, at dusk going to night. You start
on the roof car park of the Longwu Department Store, fight down the Hundred Steps between shophouses, along Lantern
Street on the cliff top, down through Lantern Cliff (a Hongyadong-style stilt-house wall), across the Qiansi through-arch
bridge, under the stacked interchange (a fuel tanker blows, the top span pancakes onto the substation), watch the city's
power go district by district, climb to Sky Street in the dark (searchlights, lasers), clear Jinlong Tower's sky lobby,
ride the lift to the roof and fight a gunship 240 m over the city. It rockets the tower and backs off; you BASE-jump
off the roof and it chases your glide. Shot down, it spirals into the hillside district below, the whole hill slides
into the river, and Jinlong, its footings gone, comes down behind you (enemy jumpers, barge gunners, searchlights you can shoot), onto
a gunboat's deck. Outro stats, then credits for the whole game.

Look: wet violet dusk → blue-black night in fog; gold floodlit structures (Jinlong, the bridges, the lantern wall's eave
lines), red lanterns, hanzi lightboxes and blade signs everywhere at street level, rooftop neon names on the towers,
residential estates with roof frames on the hills; after the blackout only fires, generators, emergency windows and the
searchlights. Every number lives in `layout.js`.

## Beats (`director.js`) — `?level=lights-out&beat=<name>`
1. **intro** — the roof rail over the gorge, the Chaotian bridge, the title. Lights coming on.
2. **steps** — down the Hundred Steps: gunmen on the landings below, perch gunmen on the flyover above, a laser sniper.
3. **lstreet** — east along Lantern Street (cars, hotpot tables, the monorail through a tower), rooftop perches; the red gate.
4. **gallery** — down the atrium stair into Lantern Cliff, along the covered gallery: gunmen on the balconies above and the roofs below.
5. **bridge** — the Qiansi bridge, perch gunmen on the arch crown, a sniper on the far side.
6. **plaza** — under the stacked interchange (perches on both decks).
7. **pancake** — the tanker on the top deck over the substation: shoot it, or it goes once you look at it (look gate, 22 s cap).
   The top span hinges down onto the lower one, the stack drops onto the substation, transformers blow in a chain.
8. **blackout** — "LOOK at the city": waits for the look (or 6 s), then district by district — flickers and top-down
   cuts sweep across the bridges, the cliff, the far bank; blue-white transformer arcs pop in each district. A minute
   later a scattering of emergency windows comes back (the dark city still reads as a city).
9. **climb** — up to Sky Street in the dark: generator searchlights (shoot the lamps), lasers, fires.
10. **lobby** — over the footbridge into Jinlong's sky lobby (marble, gold, the 金龙 bulkhead); the building groans.
10b. **lift** — the lift up to the roof (a blink to black, the hum of the ride): 239 m up, inside the crown's lantern cage.
11. **roof** — on the roof (`gunship.js`). The gunship rises out of the gorge past the gap in the south parapet,
    searchlight in your face; it circles the crown on your side (outside the cage, off the mast), drops under the roof
    line and comes back up somewhere else, and hovers over the roof's west end to fast-rope four men onto it (two more
    under 70 %). Rockets short of you onto the deck, a chin-gun burst walking in. It can't be finished here: under 42 %
    it puts a four-rocket salvo into the tower under the roof (glass, the crown shudders) and drops away into the gorge.
12. **jump** — "she's coming off the cliff": the BASE rig from the locker by the helipad; run for the gap in the south
    parapet; slow-mo jump.
13. **glide** — ~77 s: the rail descends from 240 m at a steady 2.6 : 1, out over the river then EAST (upstream) along
    the foot of the hillside district at 80–150 m. "LOOK BACK": the gunship comes back up out of the gorge and chases you
    on the hill's side (gun bursts, proximity rockets; it burns down on its own from 14 s). Its dive (look-gated, round
    the tower) goes into the gold LED tower on the crest, and the hill lets go from that column outward: the **landslide**,
    right beside / under you — 12 blocks of terraced district sliding into the river toe-first, towers toppling and
    breaking in two, a rolling dust front, muddy surge. Past x 560 "the hill took Jinlong's footings — LOOK BACK":
    Jinlong falls east into the hole the hill left, across the scar toward you; its top lands ~45 m behind the line and
    it lies half sunk. Then over the gold arch bridge, jumpers on canopies, barge gunners, the gunboat (shoot the
    drums), and you land on its deck.
14. **outro** / **credits** — stats card, then the credits for all nine levels.

## Comfort (VR)
- No free fall: the canopy opens 0.7 s after the jump, in slow-mo. Steady descent on a rail (`GlideRail`), sideways
  nudge only, yaw follows the line at ≤ 3°/s, no roll. The canopy is a fixed frame over you (lines to your shoulders).
- Big moments are look-gated (tanker, blackout, the gunship's dive, the tower fall) with a timeout; markers point at
  them. The landslide is 150–300 m off, below the roof. The tower falls away from the rail (60 m at its closest).
- The roof never tilts or moves under you: the tower's shudder is sound, dust, glass and a light shake only.
- The gunship backs off the roof after 2.5 minutes whatever you do, and in the glide it burns down on its own after 26 s:
  the destruction never waits on your aim.

## Systems
- `kit.js`: the shared material patch (vertex colour albedo, per-vertex rough/metal, emissive with a power code,
  procedural windows with Chinese residential details, wall-base grime from the light map's floor heights), `Acc`
  geometry accumulator, `Buckets`. **Windows:** frames, glass, balconies, AC boxes and bars are analytic up close and
  fade out by ~4 px per window; the lights themselves are baked into two 256² mip-mapped textures (one texel per window:
  RGB = lit at full power, A = the sparse emergency pattern) sampled with the window grid's own gradients, so distant
  towers filter smoothly. Hash inputs that come from interpolated varyings (the building seed / style) are rounded
  first: hashing the raw varying turned float noise into the per-pixel 'window static' the reviews flagged for weeks.
  **Power**: `POWER.pow[16]` / `POWER.cut[16]` per district (`DIST`); emissive code =
  district (+16 = on at dusk). `powK()` mirrors it on the CPU for glows and reflections.
- `lightmap.js`: lamp pools baked into a 2D map over the play space (4 power groups, colour, 16-bit floor height).
- `signs.js`: the canvas sign atlas (shop fascias, blades, plaques, gantries, rooftop names, ads, posters).
- `city.js` towers (styles, setbacks, LED bands, crowns: led / lantern / pagoda / diamond / frame / spire, rooftop
  names), estates; `terrain.js`; `west.js` (roof, steps, flyover, Lantern Street, monorail); `lantern.js` (the stilt
  wall, gallery, atrium stair, pavilion towers, banners); `bridge.js` (Qiansi arch, Chaotian cable-stayed, far arches);
  `east.js` (plaza, interchange spans, substation, climb, Sky Street, footbridge); `tower.js` (Jinlong: stump, body on a
  hinge, crown on its own hinge, lobby, terrace); `river.js` (water, mist, boats, reflections on water and wet streets).
- `setpieces.js`: fires, the pancake, the blackout + arcs, the tower fall (a rod on its hinge, then a free body once it
  tears off the stump), the glide (rail, jumpers, gunboat, landing).
- `slide.js`: the landslide. `SLIDE` / `TERR` / `hillY` / `scarY0` in `layout.js`. The hillside is 12 blocks (4 columns ×
  3 rows) plus the three towers (two segments each), all **bones**. All of their geometry (built in world space with
  the city kit: `towerBlock`, `lampPost`, `lantern`, `tree`) is merged into one `SkinnedMesh` per material (about 12
  draw calls). Each block carries its terraces, retaining walls, housing and the earth under it down to the slip
  surface, so the gaps that open between blocks show raw earth. The scar (slip surface, rough valley walls,
  rubble, torn road slabs, the cut-open back halves of the crest buildings) is static and hidden inside the hill
  until the blocks leave. Its emissive bakes the light of the fires on it. Streets and some housing are district
  TOWER (Jinlong's generators); the rest are EAST (emergency windows). Riding glows follow their bones.
  `world.glowList` is sorted so `prio` halos are never the ones the capped batch drops.
- `gunship.js`: the roof fight and the chase. The engine's WIDOWMAKER (`src/heli.js`, as in Level 5): rise / fight (orbit) /
  dive (under the roof line) / drop (fast-ropes: perch soldiers slid down the rope during their `delay`, then holding a
  patch of roof) / retreat (the salvo into the tower) / lurk / chase (station-keeping off the glide rail) /
  dying (look-gated dive that circles round the tower) / the crash into `CRASH` (the c1 tower's face), where the wreck is
  parented to that tower's upper-segment bone (`Landslide.attach`), then `setpieces.landslide(false, 1)`.
- `glide.js`: canopy, rail, gunboat (lofted hull, mast, nav lights, wake). `searchlights.js`: instanced beams that lock on.
- Shared code reused: `whiteout/ai.js` (copied as `ai.js` with the jumper role), `whiteout/auto.js`,
  `iron-lady/reflections.js`, `downtown-haven/{glass,cars,...}.js` (cars got a `city: 'longwu'` livery: blue 渝 plates,
  yellow 出租 taxis, 警察 police, a Longwu bus; the default build is untouched), `tokyo-scramble/lasers.js`.
