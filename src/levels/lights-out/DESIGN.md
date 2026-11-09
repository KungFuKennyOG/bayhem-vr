# LEVEL 9 — LIGHTS OUT (design + asset contracts)

Longwu, a fictional Chongqing: a city stacked on a cliff over a fogged river gorge, at dusk going to night. You start
on the roof car park of the Longwu Department Store, fight down the Hundred Steps between shophouses, along Lantern
Street on the cliff top, down through Lantern Cliff (a Hongyadong-style stilt-house wall), across the Qiansi through-arch
bridge, under the stacked interchange (a fuel tanker blows, the top span pancakes onto the substation), watch the city's
power go district by district, climb to Sky Street in the dark (searchlights, lasers), clear Jinlong Tower's sky lobby
and BASE-jump off its terrace as it shears off the cliff. A parafoil glide down the gorge (enemy jumpers, bridge gunners,
searchlights you can shoot) ends on a gunboat's deck. Outro stats, then credits for the whole game.

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
11. **jump** — grab the BASE rig from the locker; run for the gap in the terrace balustrade; slow-mo jump.
12. **glide** — the rail swings out south-east into the river first, so "LOOK BACK" (look-gated, from ~7 s) faces the
    east bank square on: the **landslide**. East of Jinlong the bank is a terraced hillside district (it carries on east
    past the slide, static, so the slide tears a gap out of it) (six streets of
    low housing stepping down from the y-64 hill to the quay, lit terrace lines, shops in the retaining walls,
    stairways, three towers and three crest buildings on top). It breaks into 12 blocks and slides into the river
    toe-first and east-first, the blocks leaning, rolling and dropping at different rates, the towers toppling off
    and breaking in two, dust out of the opening gaps, spray and silt where each block goes in. A raw scar is left
    (fires, rubble, the cut-open backs of the crest buildings, wreckage in the river). 7.6 s after it starts,
    Jinlong goes over, tears off its stump and drops into the river. Then jumpers on canopies (shoot the canopy),
    gunners on the Chaotian bridge, searchlights, barges; the gunboat (shoot the drums on its stern, marker on
    them), then you land on its deck.
13. **outro** / **credits** — stats card, then the credits for all nine levels.

## Comfort (VR)
- No free fall: the canopy opens 0.7 s after the jump, in slow-mo. Steady descent on a rail (`GlideRail`), sideways
  nudge only, yaw follows the line at ≤ 3°/s, no roll. The canopy is a fixed frame over you (lines to your shoulders).
- Big moments are look-gated (tanker, blackout, landslide + tower fall) with a timeout; markers point at them. The
  landslide and the tower are 150–300 m away and move away from / alongside the rail, never at the player.

## Systems
- `kit.js`: the shared material patch (vertex colour albedo, per-vertex rough/metal, emissive with a power code,
  procedural windows with Chinese residential details, wall-base grime from the light map's floor heights), `Acc`
  geometry accumulator, `Buckets`. **Power**: `POWER.pow[16]` / `POWER.cut[16]` per district (`DIST`); emissive code =
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
- `glide.js`: canopy, rail, gunboat (lofted hull, mast, nav lights, wake). `searchlights.js`: instanced beams that lock on.
- Shared code reused: `whiteout/ai.js` (copied as `ai.js` with the jumper role), `whiteout/auto.js`,
  `iron-lady/reflections.js`, `downtown-haven/{glass,cars,...}.js` (cars got a `city: 'longwu'` livery: blue 渝 plates,
  yellow 出租 taxis, 警察 police, a Longwu bus; the default build is untouched), `tokyo-scramble/lasers.js`.
