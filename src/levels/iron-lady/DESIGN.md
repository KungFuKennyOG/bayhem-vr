# LEVEL 5 — THE IRON LADY (design + asset contracts)

Paris, blue hour sinking into night, light drizzle, wet streets. A fictional lattice tower — **the Iron Lady**,
bigger and darker than the real one, strung with gold lights — stands on the south bank of the Seine. You
start on the north lower quay, fight west along the river, climb to the bridge, cross it toward the tower,
fight a gunship that weaves through the lattice, and when the gunship goes into a leg the tower buckles and
falls north across the river onto the bridge while you watch from the south lower quay. Then a wall of spray
and dust rolls down the river at you: run to the driver's speedboat; credits as you race away.

Look: Michael Bay at a polished PS2-era level. **Blue hour → night**: deep blue/pink sky with a warm
afterglow band low in the west-south-west, right behind the tower as seen from the start. Everything warm
comes from artificial light: sodium/gold floodlights on the tower, warm lit windows, ornate street lamps,
lamp reflections smeared on wet cobbles and on the river. Cool blue fill everywhere else. Rain: fine
drizzle streaks, puddles with ring splashes.

## Beats (director.js) — `?level=iron-lady&beat=<name>` jumps to any of them
1. **intro** — north lower quay at x 172, title card over the river, the tower sparkling (hourly show), drizzle.
   Two balcony snipers paint the cobbles during the title (they hold fire until the fight starts).
2. **quay** — fight west along the lower quay (barges, a closed buvette, crates as cover; rusher). Once you're into
   it a **bateau-mouche** full of gunmen comes up the river behind you; shoot the stern fuel tank (or grenade it):
   BATEAU FLAMBÉ — it burns and drifts to the bridge. If it survives it rams the bridge pier and blows anyway.
3. **bridge** — up the north ramp, across the bridge through a traffic jam (explosive cars, police block at the
   south end), a laser sniper on the tower's first platform.
4. **gunship** — WIDOWMAKER 3 comes up the river and fights around the tower; every ~20 s it threads straight
   through the tower under the first platform. Killed, it spins into the **north-east leg** (y 24).
5. **evac** — the leg buckles (rig: bow + crash kink), the tower lists, groans and sheds girders; the objective
   sends you east along the south quay road and down the south ramp to the lower quay (spectacle first: the
   objective card comes 1.2 s after the crash).
6. **collapse** — VR-safe trigger: waypoint on the tower, the radio says LOOK, and it goes when you're looking
   (or after 5 s). She stays lit and sparkles all the way down, falls north across the river and lands on the
   bridge (slow-mo, every car on it cooks off), the spire goes through the north frontage; lights die on impact.
7. **run** — a wall of spray and dust rolls east down the river after you (rubber-bands a few metres behind);
   the driver brings a speedboat to the pontoon at x 205. Step onto the pontoon next to it to board.
8. **escape** — power turn, flat out east down the Seine; **outro** title card with stats.

## Collapse rig (tower.js)
Every tower vertex goes through `twDeform()` in the vertex shader: above the second platform (y 112) it follows a
25-node spine (position + rotation per node, solved on the CPU in `setpieces._solveSpine`); below it each leg is a
quadratic curve from its foot (displacement `uFoot`) to where it meets the shaft, bowed by `uBow` — so legs buckle
when compressed and tear their feet out of the plinths when stretched, and the shaft bends, kinks at the first
platform, twists and drapes over the quays / bridge / river (nodes are laid on `towerFloor`). `TowerRig.deform()`
is the same function on the CPU (glows, beacon, reflections, girder debris, the heli wreck). Torn girders are
hidden instances (zeroed matrices) re-spawned as rigid debris (`Girders`).

## World frame (metres) — `layout.js` has every number; this is the picture
- y up. Seine along x (east = +x, north = +z). Water `WATER_Y = -7`, river between quay walls at z = ±40.
- **Lower quays** (cobbled berges) at `LOW_Y = -5.6`, |z| 40..52, both banks, both sides of the bridge (walkable
  only east of the bridge, x > 16; the bridge abutment closes them at x = 16). Rusticated limestone retaining
  wall at |z| = 52 up to street level (y 0).
- **Ramps** against the retaining wall (|z| 46..52): north rises toward -x from x 66 (LOW_Y) to x 30 (y 0);
  south falls toward +x from x 70 (y 0) to x 106 (LOW_Y). The lower quay continues beside each ramp (|z| 40..46).
- **Upper quays** (y 0): parapet balustrade 1.0 m on the wall top (|z| 52..52.6), tree sidewalk 52.6..58,
  road 58..72, sidewalk 72..78, Haussmann facades at |z| = 78 (south bank: only where |x| > 90).
- **Bridge**: deck y 0, x ∈ [-14, 14], z ∈ [-52, 52]; road |x| < 9.5, sidewalks to 13.4, balustrade 13.4..14.
  Five stone arches: piers at z = ±8, ±24, abutments at the quay walls (the first/last arch spans the lower quay).
  An avenue continues north from the bridge between the facades (x ±14).
- **Tower park** ("Champ"): x ∈ [-90, 90], z ∈ [-250, -78], y 0. Gravel, lawns, hedges.
- **The tower** (tower.js, built by the level): centre (0, -140), feet at x ±50, z -90/-190, first platform
  y 56, second y 112, top y 262, spire 282, antenna 300. Leg feet: 14 m square stone plinths.
- Escape pontoon on the south lower quay: x 196..214, z -40..-36.5 (floats at LOW_Y - 0.25).
- Sun: azimuth ≈ (-1, 0, -0.3) (west-south-west), elevation -3° → -6° (below the horizon), dusk 0.82 → 1.0.
- Start: (172, LOW_Y, 46) looking west along the river — the tower is ahead-left across the water.

## Conventions (all procedural, no asset files)
- three.js r170, `src/geom.js` helpers, canvas textures (`src/textures.js`), deterministic `makeRng(seed)` —
  never `Math.random`.
- `MeshStandardMaterial` (+ `onBeforeCompile` if needed — the global chunk patches still apply: grade,
  sun-aware fog, rim light). Custom `ShaderMaterial`s must include `<tonemapping_fragment>` +
  `<colorspace_fragment>` (and fog chunks if they should fog). **No screen-space post, no runtime lights.**
  Glows = additive billboards (return them as `anchors.glows`, the level draws them in one batch).
- Night lighting: the directional "sun" is weak; the hemisphere + environment give a cool blue fill. Anything
  that should read warm must be emissive or baked: emissive windows/lamp lenses get
  `material.userData.duskEmissive = <peak emissiveIntensity>` (the level ramps them); bake light pools
  under lamps and grime/wet darkening into **vertex colours** (free on Quest).
- Wet: street-level stone/asphalt/cobbles use low roughness (0.2–0.45) and darkened albedo so the env map and
  the reflection streaks sell "after rain". Puddles = flatter, darker, glossier patches.
- Model space: forward = -z, up = +y. Builders return
  `{ root, colliders: [{ min:[x,y,z], max:[x,y,z], data? }], anchors: {...}, update?(dt, t, dusk, head), info? }`.
  Colliders are **world space** for builders that place themselves (city, quays, bridge, park), model space for
  movable things (boats). `data.mat`: 'concrete' | 'metal' | 'glass' | 'wood' (bullet impact FX). Colliders that
  shouldn't stop bullets: `data.noBullet = true`; that shouldn't block walking: `data.noBlock = true`.
- Glow anchor: `{ p: [x,y,z], color: [r,g,b] (HDR, ~1–4), size, dusk?: true (fades in with dusk), blink?, rate?, far?: true (draw beyond 260 m) }`.
- Reflection anchor (lights that should smear on the wet ground / river): `anchors.reflect: [{ p:[x,y,z], color:[r,g,b], len, width, ground: y }]`.
- Quest 3 budget for the whole level: ≲ 400k visible triangles, ≲ 160 draw calls. Merge static geometry per
  material, instance repeats. Few textures (≤ 1024², share them). Each builder module: aim for ≤ 25 draw calls.
- Shared-file rule: **don't change `src/*.js` or other levels' files** (except where the contract says so,
  keeping their default behaviour identical).

## Viewer
`npx vite` runs on :5173. Render any builder with the game's lighting:
`cd model-test && NODE_PATH=/opt/npm-tools/node_modules node shot.cjs "mod=/src/levels/iron-lady/<file>.js&fn=<builder>&px=..&py=..&pz=..&cx=..&cy=..&cz=..&dusk=0.88&sunel=-4&sunax=-1&sunaz=-0.3&fogNear=60&fogFar=1400&ground=0" out.jpg`
(the builder receives `{renderer, scene, camera, sun, hemi}` as its last argument; `args=[...]` JSON for earlier
arguments). Always check from player eye height (y = LOW_Y + 1.65 on the lower quay, 1.65 on the street),
looking both toward the afterglow (west) and away from it (east), at dusk 0.85 and 1.0. Rendering is software
(≈1–3 s per frame) and the machine has 2 cores shared with other agents: keep renders few and purposeful.

## Files
- `layout.js` — numbers (owned by the level).
- `paris.js` — `buildParis(ctx)`: Haussmann frontage on both banks, the snipers' balconies, far Paris skyline.
- `quays.js` — `buildQuays(ctx)`: lower/upper quays, walls, ramps, stairs, parapets + bouquinistes, trees,
  lamps, the bridge, the tower park furniture, far bridges. `Reflections` (wet streaks).
- `river.js` — `buildRiver(ctx)`: the Seine water (night shader, rain pocks, light reflections).
- `boats.js` — `buildBoat(kind)`: 'bateau' (tour boat), 'peniche' (moored barge), 'speedboat' (escape).
- `tower.js` — `buildTower(ctx)`: the Iron Lady (instanced lattice, lights, sparkle, beacon, collapse rig).
- `world.js`, `game.js`, `ai.js`, `rain.js`, `setpieces.js`, `director.js`, `index.js` — gameplay.
