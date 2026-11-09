# LEVEL 9 — LIGHTS OUT (design + asset contracts)

Longwu, a fictional Chongqing: a city stacked on a cliff over a fogged river gorge, at dusk going to night. You start
on the roof car park of the Longwu Department Store, fight down the Hundred Steps between shophouses, along Lantern
Street on the cliff top, down through Lantern Cliff (a Hongyadong-style stilt-house wall), across the Qiansi through-arch
bridge, under the stacked interchange (a fuel tanker blows, the top span pancakes onto the substation), watch the city's
power go district by district, climb to Sky Street in the dark (searchlights, lasers), clear Jinlong Tower's sky lobby,
ride the lift to the roof and fight a gunship 240 m over the city. Shot down, it spirals into the hillside district
below and the whole hill slides into the river; Jinlong's footings go with it. You BASE-jump off the roof and glide
out over the river as the tower comes down behind you (enemy jumpers, barge gunners, searchlights you can shoot), onto
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
11. **roof** — the climax, on the roof (`gunship.js`). The gunship rises out of the gorge past the gap in the south
    parapet, searchlight in your face; it circles the crown on your side (outside the cage, off the mast), drops
    under the roof line and comes back up somewhere else, and hovers over the roof's west end to fast-rope four men
    onto it (two more once it is under 55 %). Rockets short of you onto the deck, a chin-gun burst walking in. The east
    parapet is a see-through railing: when it is going down the marker sends you there, and its dive (look-gated, it
    swings round the tower, never through it) goes into the gold LED tower on the hillside crest below. The hill lets
    go from that column outward: the **landslide**, watched leaning over the railing, 50° down. East of Jinlong the bank
    is a terraced hillside district (it carries on east past the slide, static, so the slide tears a gap out of it)
    (six streets of low housing stepping down from the y-64 hill to the quay, lit terrace lines, shops in the retaining
    walls, stairways, three towers and three crest buildings on top). It breaks into 12 blocks and slides into the river
    toe-first, the blocks leaning, rolling and dropping at different rates, the towers toppling off and breaking in two
    (the wreck rides its tower down), dust out of the opening gaps, spray and silt where each block goes in. A raw scar
    is left (fires, rubble, the cut-open backs of the crest buildings, wreckage in the river).
12. **jump** — Jinlong's footings were in that hill: it shudders. The BASE rig from the locker by the helipad; run for the
    gap in the south parapet; slow-mo jump.
13. **glide** — about a minute: the rail descends from 240 m at a steady 2.2 : 1, swinging out south-east over the river
    first, so "LOOK BACK" (look-gated, from 6.5 s) faces the tower: Jinlong goes over onto the slid hillside (60 m off at
    its closest, falling away from you), tears off its stump and drops into the river. Then jumpers on canopies (shoot the
    canopy), barge gunners and searchlights; the gunboat (shoot the drums on its stern, marker on them), then you land on
    its deck.
14. **outro** / **credits** — stats card, then the credits for all nine levels.

## Comfort (VR)
- No free fall: the canopy opens 0.7 s after the jump, in slow-mo. Steady descent on a rail (`GlideRail`), sideways
  nudge only, yaw follows the line at ≤ 3°/s, no roll. The canopy is a fixed frame over you (lines to your shoulders).
- Big moments are look-gated (tanker, blackout, the gunship's dive, the tower fall) with a timeout; markers point at
  them. The landslide is 150–300 m off, below the roof. The tower falls away from the rail (60 m at its closest).
- The roof never tilts or moves under you: the tower's shudder is sound, dust, glass and a light shake only.
- The gunship never takes more than three minutes: after that it burns down on its own.

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
- `gunship.js`: the roof fight. The engine's WIDOWMAKER (`src/heli.js`, as in Level 5): rise / fight (orbit) / dive (under the
  roof line) / drop (fast-ropes: perch soldiers slid down the rope during their `delay`, then holding a patch of roof) /
  dying (look-gated dive that circles round the tower) / the crash into `CRASH` (the c1 tower's face), where the wreck is
  parented to that tower's upper-segment bone (`Landslide.attach`), then `setpieces.landslide(false, 1)`.
- `glide.js`: canopy, rail, gunboat (lofted hull, mast, nav lights, wake). `searchlights.js`: instanced beams that lock on.
- Shared code reused: `whiteout/ai.js` (copied as `ai.js` with the jumper role), `whiteout/auto.js`,
  `iron-lady/reflections.js`, `downtown-haven/{glass,cars,...}.js` (cars got a `city: 'longwu'` livery: blue 渝 plates,
  yellow 出租 taxis, 警察 police, a Longwu bus; the default build is untouched), `tokyo-scramble/lasers.js`.
