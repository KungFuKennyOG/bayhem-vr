# LEVEL 7 — WHITEOUT (design + asset contracts)

The Grauhorn (a fictional Alpine peak, 3 412 m) in a blizzard. Your snowcat gets hit at the bottom of the mountain
road; you fight up three switchback legs (gunmen on the road above firing down, flankers coming up the road below),
clear the Mittelstation yard, ride the cable car across the gorge (the enemy cabin comes down the other track; the
haul rope snaps near the top), fight through **Grauhorn Station** — a 1930s observatory and cable-car top station on
the summit saddle, fortified — and up its observatory tower. On the terrace **the storm breaks**: low gold sun, a
sea of clouds, the whole Grauhorn face lit, an enemy snowcat convoy coming down it. You shoot the Gazex avalanche
cannons on the ridge; the slab lets go and the face comes down. You run along the roof walk into the rack-railway
avalanche gallery; it goes over the gallery roof and pours past the pillars; the driver's railcar takes you out
through the tunnel.

Look: Michael Bay at a polished PS2-era level. **Blizzard**: blue-grey overcast, ~100 m visibility (whiteout surges
to ~50 m), wind-driven snow streaking sideways, spindrift skating across the road, plumes off the ridges. **Warm
against cold**: the burning snowcat, red road flares, sodium light towers and floodlights, lit chalet and fortress
windows, headlamps on the gunmen, searchlight beams sweeping through the snow. **Clear** (summit): deep alpine blue,
low gold sun in the south-south-west, the lit face, a lenticular cap, the cloud sea below.

## Beats (director.js) — `?level=whiteout&beat=<name>` jumps to any of them
1. **intro** — bottom of the road, the snowcat burning, title over the slope; headlamps on the road above.
2. **road1** — leg 1 east: the roadblock (jersey barriers, sandbags, a light-tower trailer, fuel drums); gunmen on
   leg 2 above fire **down** at you over its parapet (you shoot **up**).
3. **road2** — leg 2 west: a laser sniper on the rock rib above leg 3 (gated: the marker points at him); flankers
   come up leg 1 behind and **below** you (you shoot **down**); gunmen come out of the Berghaus Edelweiss at
   hairpin 2 (its propane tank goes up).
4. **road3** — leg 3 east into the station yard.
5. **yard** — the Mittelstation yard: containers, the fuel tank (big boom), a sniper on the groomer shed.
6. **board** — the driver takes the control room; step into cabin 1.
7. **cable** — the ride across the gorge (7.5 m/s): pylon sniper, cliff sniper; cabin 2 comes down full of gunmen —
   shoot its carriage (or it gets thrown at the pylon saddle anyway) and it drops into the gorge, the fog lights up.
   42 m from the top the haul rope snaps (it whips back past the windows), the brakes scream, the cabin slides into
   the dock.
8. **hall** — step out; once you're off, the brakes let go and the cabin rolls back down the line into the pylon.
9. **court** — the courtyard: they fire down from the sandbags on the north block's roof walk.
10. **roof** — stair A up to the roof walk, west along it; more of them in the courtyard below (you fire down);
    a sniper by the radome.
11. **summit** — stair B up the tower to the terrace: the storm breaks (look up: it's the sky), the ridge with the
    Gazex cannons and the convoy appears; objective after the reveal. Two cannons down → the gas line chains the
    rest → the crown crack runs across. VR rule: if you never shoot, they go off by themselves only once you're
    looking at the face (or at 46 s).
12. **avalanche** — the slab breaks into blocks, the front forms and comes down the face (slow-mo), takes the convoy.
13. **run** — east along the roof walk into the gallery. The front is rubber-banded: never within ~24 m of you until
    you're inside.
14. **gallery** — it goes over: the curtain pours off the roof past the pillars, powder blasts in, whiteout,
    slow-mo; then the railcar's headlights in the tunnel. **outro** — stats card.

## World frame (metres, y up, east = +x, NORTH = −z = uphill) — `layout.js` has every number
- **Road**: one polyline (`ROAD`), half width 3.6. Valley (y −6.5) → pull-out by the snowcat (x −96..−60) → leg 1
  east (y 0 → 9) → hairpin 1 (centre 40, 92) → leg 2 west (10 → 19) → hairpin 2 (−46, 64) → leg 3 east (20 → 28.4)
  → the yard (y 30). Legs are 28 m apart in z. Uphill side = north: dressed-stone retaining walls (as tall as the cut);
  downhill side: stone parapets (cover) or W-beam rails at the hairpins. The Berghaus terrace (`HUT`) is walkable.
- **Mittelstation** (`MID`) x 62..110, z −20..8, y 30; the cabin docks inside at x 80 (ours) / 90 (theirs), z −10.
- **Cable line** (`LINE`, `lineY(z)`): track rope from z −9 (y 36.6) over the pylon saddle (z −150, y 93.5) to the
  summit dock (z −307, y 146.6), sagging spans. Cabin floor = rope − `HANG` (6.6). The gorge floor is at ~−42.
- **Grauhorn Station** (y 140): hall x 64..108, z −324..−292 (cable opening south, doors north); courtyard
  x 54..152, z −378..−324; north block x 70..140, z −398..−382, roof walk y 148; tower x 50..70, z −400..−380,
  terrace y 156, dome at (54.8, −384.8) in its SW corner (the terrace looks up the face past it), antenna in the NW corner; stair A (courtyard → roof, rising east, landing `LAND_A`); stair B (roof →
  terrace, rising north, landing `LAND_B`); gallery x 140..232, z −398..−383, floor y 148, roof 154.5, portal at
  x 232; the railcar at (222, −390.5).
- **The face** rises north of the saddle from z −412 (y 141) at ~40° to the cornice (z −705, y ~380); Gazex
  cannons at `GAZEX`, the convoy at `CONVOY`.
- Struct floors (roofs, stairs, decks) never overlap in xz, so ground is one 2D function: `groundAt` =
  `structFloor ?? terrainAt`. `walkable(x, z)` is the walk mask: the locomotion sees no ground outside it (= a ledge).
- Sun: azimuth (−0.8, 0, 0.6) (west-south-west, so the south-facing face is side-lit and its ribs throw shadow), 14° in the storm → 7° clear. Alpenglow (`alpenU` in terrain.js) tints the high sunlit snow pink-orange once the storm breaks.

## Rendering modules
- `terrain.js` — the heightfield (baked 1 m in `layout.js`), drawn as 32 m chunks at 2 / 4 / 8 m by distance to the
  walk mask (skirts hide the cracks, one merged draw) + a far mesh to 9 km (ridged peaks; only drawn when the storm
  has broken). `snowRockMaterial`: wind-rippled snow, triplanar granite on the steep parts (snow kept in the
  hollows), vertex AO in the creases, snow glints, warm pools from every lamp / fire baked as emissive.
- `kit.js` — the merge bucket, `floorPools` (additive light-pool decals on non-terrain floors), `trackDecals` (tyre /
  belt marks on flat snow) + **`snowPatch(material)`**: snow settles on every up-facing surface (noisy soft cap),
  rime feathers the windward side. Every static material in the level goes through it (indoor ones don't:
  `concreteIn`, `paintIn`).
- `snow.js` — `Weather`: wind + gusts + whiteout surges (they drive the fog), GPU snowfall (streaks along the
  screen-space velocity, nothing within 1 m of the eye, masked under roofs, catching the nearest fire), spindrift,
  ridge plumes.
- `sky.js` — one sky shader for storm and clear (the deck tears open from the top), the environment re-bake, the
  cloud sea.
- `road.js`, `props.js`, `flora.js`, `station.js`, `fortress.js`, `cabin.js` — the art (see their headers).
- `avalanche.js` — the **BillowFront**: a terrain-hugging band, cross-section toe → nose → crest → back; vertex
  lumps from 3D noise whose coordinates roll along the profile (it tumbles forward); fragment billows with a
  surface-gradient bump, smooth analytic normals (finite differences in the vertex shader), blue folds, AO, an eroded
  crest. It rides OVER the station roofs (`surfAt`) and is capped at the gallery's south edge once you're inside (the
  snow that goes on over is the curtain). The powder cloud is sprites in the shared `clouds` batch (big puffs off the
  crest, blue-grey low / white high, plus a dust skirt ahead of the toe); the translucent plume band is built but off
  (it read as glacier ice). Slab blocks, the crown crack, the Gazex ridge (gunmetal tubes on dark rock outcrops,
  beacons with halos), the convoy, the gallery curtain.

## Conventions
Same as the other levels: deterministic rng, no runtime lights (2 warm point lights created at load hop to the nearest
fires), glows as anchors, custom ShaderMaterials include the tonemapping + colorspace chunks
(premultiplied ones `bay_premul_colorspace`). Shared-file changes: `src/characters.js` (an `alpine` palette
outfit: dark cold-weather kit, amber goggles — palette only, default look untouched) and `src/levels/index.js`.
