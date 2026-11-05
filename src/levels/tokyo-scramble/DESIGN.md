# LEVEL 6 — TOKYO SCRAMBLE (design + asset contracts)

Kurogane (a fictional Tokyo ward) at midnight, **dry neon** (no rain: Level 5 had it). You start on the station
terrace above the plaza, go down into the scramble crossing under the giant screens, east down the avenue, up
through a multi-storey car park onto the elevated expressway, fight west through the jam, and when the fuel tanker
goes up it takes a span of the expressway down into the street below. You take the off-ramp down into the north
end of Center-gai (the shopping street), fight south — and the burning fuel finds the gas main. The street blows
itself up behind you, storefront by storefront, all the way back to the crossing, where you dive out of the street
mouth as the last one goes off in slow-mo.

Look: Michael Bay at a polished PS2-era level. Midnight: a low overcast lit sodium-orange and magenta from below,
no afterglow. Everything warm or coloured is emissive: ~70 % backlit light-box signs (white / cream / colour field
with coloured characters), ~30 % neon tube; lit shop interiors; vending machines; LED street lamps (cold white);
the expressway's sodium masts (orange). Light on the ground comes from one baked top-down light map. Enemies are
dark silhouettes against bright signs (+ lifted cloth, lit reflective bands, contact shadows).

## Beats (director.js) — `?level=tokyo-scramble&beat=<name>` jumps to any of them
1. **intro** — the station terrace (y 7), title card over the crossing, two catwalk / roof snipers paint the plaza.
2. **crossing** — down the stairs, across the plaza (kōban, bronze cat, planters, taxi rank), into the scramble
   (abandoned cars, the four giant screens). After ~9 s every screen tears over to the emergency broadcast
   (緊急警報 / EVACUATE, red, flashing — the crossing pulses red with them). Screens can be shot out.
3. **avenue** — east to the car park entrance; a sniper on the roof across the avenue.
4. **garage** — ramp R1 to deck A (y 6), ramp R2 up the back to deck B (y 12), the link onto the expressway.
5. **xway** — west through the jam (both carriageways), a sniper on a roof north of the road.
6. **tanker** — shoot the tanker (it leaks, catches, blows). VR rule: if you don't, it goes once you're looking at it
   (or after 22 s). It takes its span's east pier with it: the span hinges down about its west pier into the cross
   street (slow-mo), still burning. Objective only after the money shot.
7. **offramp** — down the off-ramp (it peels off the south side, y 12 → 0.15) into the north end of Center-gai.
8. **center** — fight south down Center-gai (shops, bars, crates, the takoyaki stall, bikes, garbage piles).
9. **gas** — "LOOK back up the street": waits for the look (or 5 s), the gas works blow, then the chain runs down the
   street after you: manhole covers launch on fire jets, shopfronts erupt one after another (glass blasts out, signs
   rain sparks), a fire carpet + black smoke behind the front. Rubber-banded 4–13 m behind you; too close hurts.
10. **dive** — out of the street mouth into the crossing: the last blast rolls out after you in slow-mo, the arch sign
    comes down in sparks. **outro** — stats card.

## World frame (metres) — `layout.js` has every number
- y up, east = +x, **north = −z**. Street level 0 (asphalt), CURB 0.15 (sidewalks, plaza, Center-gai).
- **Crossing**: asphalt square |x|,|z| < 22, the sidewalk ring to 28. East avenue (road |z| < 11), south avenue
  (road |x| < 11), Center-gai north (x ±8, z −140..−28), the plaza west (x −80..−22) with a taxi lane (x −42..−22).
- **Station**: building x −150..−96; terrace x −96..−80 at y 7; stair x −80..−69 (|z| < 18) down to the plaza.
- **Car park** x 44..112, z −128..−17: apron (x 44..50) → R1 along the avenue side (x 50→90, y 0.15→6) → deck A
  (z −80..−25, y 6) → R2 along its back (x 108→64, y 6→12, z −86..−80) → deck B (z −128..−86, y 12).
- **Expressway** z −160..−140, deck top y 12, piers every 32 m. The tanker span is x −14..18 (hinge at −14).
  Gore + link x 86..104, z −140..−128. Off-ramp x 14..86, z −139..−131 (y rises toward +x); a flat lane x 8..14
  into Center-gai. The cross street under it (z −164..−140) is closed (rubble / fire).
- **Every walkable surface is single-valued in x/z** (nothing walkable stacks above anything walkable), so one floor
  function (`groundAt`) serves the player, soldiers, particles and the nav grid; elevated decks are floor-function
  regions, not boxes; bodies below decks are `noBlock` bullet blockers, with thin street-level walls around them.

## Rendering (all procedural, no asset files)
- `signs.js` — one 2048² atlas: 40 blade signs (tategaki), 16 fascias, 8 big panels (billboards, the station name),
  16 small plates, 8 vending-machine fronts, 4 lit shop interiors. Japanese text from the system CJK fonts
  (Noto CJK on Quest / Android, Hiragino / Yu Gothic on desktop).
- `facade.js` — one 2048×1024 atlas of facade bays (DataTexture, alpha = glass). The facade shader tiles a cell in
  bay / floor units and lights every window from a hash: offices light whole floors (cool), bars / flats window by
  window (warm, rare magenta / blue), ceiling-tube rows, blinds, silhouettes. `flat` varyings (an interpolated seed
  feeding a hash speckles per pixel).
- `city.js` — blocks → narrow lots along their street fronts: facade box, shopfront (breakable glass + lit interior
  cards, or a roller shutter), blade signs (stacked on tall lots), floor fascias, rooftop billboards with floodlights,
  roof clutter, aviation lights. Neon throws light on the wall behind it (additive halo quads, one mesh) and on the
  pavement (light-map anchors). `SCREENS` = the giant LED screens (`screens.js`: programme cycle, alert mode, shot-out).
- `lightmap.js` — the ground light map (1024², ~0.33 m/texel) + a blurred building-footprint AO map + four live
  screen lights (the crossing changes colour with the screens). Patched into every ground material.
- `street.js`, `station.js`, `garage.js`, `xway.js`, `props.js` — the surfaces, markings and furniture.
- Draw calls: one per material per module (facades, props, signs, halos, ground surfaces, paint), the screens one
  each, characters / cars as usual. No runtime lights beyond the shared `fx.light` pool.

## Gameplay code
`game.js` (from Level 5: soldiers, snipers, glass, traffic, scoring, slow-mo; `applyTokyo(heat)` warms the night as
things burn), `ai.js` + `auto.js` imported from Level 5, `traffic.js` (Level 5's, `city: 'tokyo'` liveries: dark
taxis, all-red police light bars), `setpieces.js` (tanker + span, gas works + chain, dive), `director.js`.
