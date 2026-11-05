# LEVEL 6 — TOKYO SCRAMBLE (design + asset contracts)

Kurogane (a fictional Tokyo ward, Shibuya + Shinjuku stand-ins) on a **clear, hard-sun afternoon** (the brief changed
from night neon on Nov 5: Kenny wanted daylight, and overcast tested flat). You start on the station skybridge over the
tracks, go down into the scramble crossing under the giant screens, east down the avenue into the station's **East
Exit** (a bus plaza under a ring of pedestrian decks), up the decks and the station's face stair onto its roof terrace,
across the link onto the elevated expressway, and fight west through the jam. When the fuel tanker goes up it takes a
span of the expressway down into the street below. You take the off-ramp down into the north end of Center-gai, fight
south, and the burning fuel finds the gas main. The street blows itself up behind you, storefront by storefront, all
the way back to the crossing, where you dive out of the street mouth as the last one goes off in slow-mo.

Look: Michael Bay at a polished PS2-era level, the *Transformers* Chicago look. A deep blue sky with fair-weather
cumulus; a hard sun from the west (behind you on the intro, lighting the crossing's faces); lit building tops over
shaded street canyons; black smoke columns standing over the skyline from the first frame. Signs read as printed
colour (lightboxes by day), the giant screens still pop. Pale Tokyo tile (off-white, beige, cool grey, the odd pink or
sage), grey glass, dense poles and wires, yellow tactile paving, white guard rails; shabby old kiosks next to sleek
glass (Ghostwire: Tokyo's trick). `?night=1` brings back the night-neon build for comparison (`tod.js`).

## Beats (director.js) — `?level=tokyo-scramble&beat=<name>` jumps to any of them
1. **intro** — the station skybridge (y 13) over the tracks, title card over the crossing, two catwalk / roof snipers
   paint the plaza.
2. **crossing** — down the stair, across the plaza (kōban, the dog statue, the retired green railcar, planters, the
   taxi rank), into the scramble (abandoned cars, the giant screens). After ~9 s every screen tears over to the
   emergency broadcast (緊急警報 / EVACUATE). Screens can be shot out.
3. **avenue** — east under the yellow subway bridge to the East Exit; a sniper on the roof across the avenue.
4. **eastexit** — the bus plaza (buses, shelters, zelkovas, the old kiosk, vending under the deck). Gunmen pace the
   deck ring overhead (`perch` role: they walk their arm toward you, duck behind the frosted glass, pop up to fire)
   while more come at you across the plaza: you shoot **up**.
5. **decks** — up the east stair, along the east and north arms (gunmen left in the plaza now shoot up at you; you
   shoot **down**), up the station's face stair to the roof terrace (sky garden, kiosk pavilion, the station tower),
   then the link bridge onto the expressway.
6. **xway** — west through the jam (both carriageways), a sniper on a roof north of the road.
7. **tanker** — shoot the tanker (it leaks, catches, blows). VR rule: if you don't, it goes once you're looking at it
   (or after 22 s). It takes its span's east pier with it: the span hinges down about its west pier into the cross
   street (slow-mo), still burning. Objective only after the money shot.
8. **offramp** — down the off-ramp (y 12 → 0.15) into the north end of Center-gai.
9. **center** — fight south down Center-gai (shops, bars, crates, the takoyaki stall, bikes, garbage piles).
10. **gas** — "LOOK back up the street": waits for the look (or 5 s), the gas works blow, then the chain runs down the
    street after you: manhole covers launch on fire jets, shopfronts erupt one after another, signs rain sparks, a
    fire carpet + black smoke behind the front. Rubber-banded 4–13 m behind you; too close hurts.
11. **dive** — out of the street mouth into the crossing: the last blast rolls out after you in slow-mo, the arch sign
    comes down in sparks. **outro** — stats card.

## World frame (metres) — `layout.js` has every number
- y up, east = +x, **north = −z**. Street level 0 (asphalt), CURB 0.15 (sidewalks, plazas, Center-gai).
- **Crossing**: asphalt square |x|,|z| < 22, the sidewalk ring to 28. East avenue (road |z| < 11), south avenue
  (road |x| < 11), Center-gai north (x ±8, z −140..−28, the red gate at its mouth), the plaza west (x −74..−22) with a
  taxi lane (x −42..−22), Kōen-dōri off the north-east corner (barricaded).
- **Station**: the building x −170..−100, its tower x −150..−112; the elevated tracks (viaduct x −88..−76, deck y 7,
  bars in the arches, trains run through); the skybridge x −100..−72 at y 13 and its stair down to the plaza
  (x −72..−51).
- **Landmarks**: KUROGANE 108 (the silver cylinder in the fork, x 37 z 26), the yellow subway bridge over the avenue
  (x 132), K-FRONT (the tower with the big screen over the crossing's north side).
- **East Exit** x 44..112, z −128..−17:
  - the bus plaza at street level, z −80..−17;
  - the deck ring at y 6: west arm x 46..52, east arm x 104..110, north arm z −80..−74, centre bridge z −56..−50;
  - open stairs from the arms down to the avenue edge (STAIR_W x 52..70, STAIR_E x 86..104, z −30..−24);
  - the station's east building, z −128..−80: its face stair R2 (x 100→52, y 6→12, z −86..−80), the landing R2LAND,
    the roof terrace DECK_B (y 12) with the station tower (ETOWER, 150 m) on its west end.
- **Expressway** z −160..−140, deck top y 12, piers every 32 m. The tanker span is x −14..18 (hinge at −14).
  Gore + link x 86..104, z −140..−128. Off-ramp x 14..86, z −139..−131 (y rises toward +x); a flat lane x 8..14
  into Center-gai. The cross street under it (z −164..−140) is closed (rubble / fire).
- **The floor function is single-valued in x/z** (`groundAt` serves the player, soldiers, particles and the main nav
  grid; elevated decks are floor-function regions, bodies below them `noBlock` bullet blockers). **One exception:**
  the East Exit's deck ring sits over the walkable plaza. Its slabs are collider tops (the engine's
  `CollisionWorld.groundAt` picks the highest surface under your feet), its stairs are `col.walk` ramps, its
  balustrades are tagged `layer: 'deck'` and switched off while the main nav is built, and the gunmen up there are
  `perch` soldiers (no nav). Particles still land on the street under the decks (`fx.setGround` = floor function).

## Rendering (all procedural, no asset files)
- `tod.js` — time of day: how much the night-built art glows by day (rm emissive, sign self-illumination, window
  lighting, the ground light map, glow sprites — only blinking aviation / warning lamps by day).
- `sky.js` — the afternoon sky (blue, cumulus lit toward the sun, cirrus, the sun's glare, haze; the finale's smoke
  browns the low sky) and the reflection environment (sky + a band of pale city).
- `sunshadow.js` — **city-wide sun shadows in 2.5D**: a 1024² building-height map (~0.66 m texels, 1 byte = 1 m)
  rasterised from the collision boxes; every static standard material marches 16 steps toward the sun over it and
  scales the sun's light (`patchSun`, chained onto existing shader patches). The same boxes as an invisible mesh cast
  into the realtime shadow map (±38 m round the player), so cars and people darken in building shadows too.
- `plumes.js` — six black smoke columns over the skyline (camera-facing cards, a column envelope × two scrolling
  noise octaves, sunlit side, fire at the foot).
- `signs.js` / `signs2.js` — the sign atlases: blade signs (tategaki), fascias, panels, plates, vending fronts, shop
  interiors; tenant directory plates, window lettering, posters, store bands, the 108's vertical name, the train
  livery, the Center-gai gate, the station's green line band. Japanese text from the system CJK fonts. By day they
  render with `signMat` (kit.js): the print is the albedo, a little self-illumination on top.
- `facade.js` — one 2048×1024 atlas of facade bays (DataTexture, alpha = glass); the shader tiles a cell in bay /
  floor units; window lighting is mostly off by day (`DAY.facadeNight`).
- `city.js` — blocks → narrow lots along their street fronts: facade box (Tokyo tile tints by day), shopfront
  (breakable glass + interior cards, or a roller shutter), blade signs, directories, posters, floor fascias, rooftop
  billboards, roof clutter. `SCREENS` = the giant LED screens (`screens.js`: programme cycle, alert mode, shot-out).
- `lightmap.js` — the ground light map (night only) + a blurred building-footprint AO map with soft roof shade under
  the decks / the expressway / the skybridge. Patched into every ground material.
- `street.js`, `station.js`, `eastexit.js`, `xway.js`, `props.js`, `landmarks.js` — the surfaces, markings,
  structures and furniture.
- Draw calls: one per material per module, the screens one each, characters / cars as usual. No runtime lights
  beyond the shared `fx.light` pool.

## Gameplay code
`game.js` (from Level 5: soldiers, snipers, glass, traffic, scoring, slow-mo; `applyTokyo(heat)` sets the afternoon
and browns it as things burn), `ai.js` + `auto.js` imported from Level 5, `traffic.js` (Level 5's, `city: 'tokyo'`
liveries: dark taxis, all-red police light bars), `setpieces.js` (tanker + span, gas works + chain, dive),
`director.js`.
