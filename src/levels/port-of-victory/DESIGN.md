# LEVEL 2 — PORT OF VICTORY (design + asset contracts)

On foot through a container port at dusk (golden hour drifting into blue hour). The player starts at the
gate next to the wrecked pickup from Level 1, fights through a container maze, survives a crane dropping a
container on them, triggers forklift / fuel-drum chain reactions, boards a moored cargo ship, blows its
fuel hold and runs down the gangway as the ship goes up in a mushroom fireball (slow-mo).

Look: Michael Bay at a polished PS2-era AAA level. Low sun straight down the level (sun is toward -z,
slightly -x: `SUN_DIR = (-0.42, ~0.08, -1)` normalized, elevation drops from ~5° to below the horizon),
long shadows, backlit silhouettes with the shared sun rim light, sodium-orange floodlights flickering on.

## World frame (metres)
- y up. Asphalt yard at y = 0. Player walks from z ≈ +36 toward -z.
- **Gate** z +26…+32: perimeter fence along z = +28 (x -80…+80), road opening x ∈ [-9, 9].
  Gatehouse booth at (x +12, z +30). Sign gantry over the road at z = +27. Wrecked pickup in the barrier at (x -1.5, z +29).
- **Yard / container maze** z +24 … -110 (x -75…+75). Painted yard markings.
- **RTG crane** straddles x ∈ [-17.5, +5.5] (legs at those x), centred at z = -82, beam top ~19 m.
- **Apron** z -110 … -151 (concrete). Forklift + fuel drums here.
- **Quay edge** at z = -151.0 (coping 0.35 m high, bollards every 12 m). Water surface y = -2.2 for z < -151.
- **STS quay cranes** (`cranes.js`): rails at z = -124 (landside) and z = -149 (waterside). Crane A centred x = -48
  (boom lowered over the ship), crane B centred x = +46 (boom raised). Portal legs at x ±9 from centre.
- **Ship**: hull side facing the quay at z = -153.0, beam 27 m (far side z = -180). Bow at x = -95, stern at x = +65.
  Main deck y = 9.0. Superstructure (accommodation + bridge) at the stern x ∈ [+40, +58]; funnel aft of it.
  Quay-side deck walkway z ∈ [-153.4, -157.2] at y = 9 runs the length of the cargo area; hatch covers occupy
  z ∈ [-157.6, -176] (top ~ y 10.8) with gaps (≈3 m) between hatches along x so you can cross the deck.
  **Fuel bunker manifold** (the finale target) on the walkway at x = -6, z ≈ -155.5.
- **Gangway** hangs over the gap: centreline z = -152.0, width 1.8 m, bottom landing on the quay at
  x ∈ [-6, -2] (y 0), ramp rising along +x from x = -2 (y 0) to x = +22 (y 9.0), top platform x ∈ [22, 25] (y 9),
  bulwark gap onto the deck at x ∈ [22, 25].
- Far shore across the harbour (z < -600): skyline, refinery, other cranes (world.js).

## Conventions (all procedural, no asset files)
- three.js r170. Use `src/geom.js` helpers (`box`, `at`, `cyl`, `merge`, `mergeGrouped`) and canvas textures
  (see `src/textures.js`: `concreteTexture`, `metalTexture`, `textTexture`, …). Deterministic: `makeRng(seed)` from `src/rng.js`, never `Math.random`.
- `MeshStandardMaterial` (the global shader patch adds the color grade, sun-aware fog and rim light for free).
  No screen-space post. Glows = additive sprites/billboards. No runtime lights (the level owns a fixed pool).
- Merge static parts per material (few draw calls). Set `castShadow` on big silhouettes, `receiveShadow` on surfaces.
- Night: emissive materials that should light up at dusk (windows, lamp lenses) get
  `material.userData.duskEmissive = <peak emissiveIntensity>` and start at emissiveIntensity 0; the level ramps them.
- Model space: forward = -z, up = +y unless stated. Builders return
  `{ root: THREE.Group, colliders: [{ min: [x,y,z], max: [x,y,z] }], anchors: { name: THREE.Vector3 | Object3D }, update?(dt, t), info? }`
  with colliders in the same space as `root` (the caller transforms them if it moves the root).
- Quest 3 budget: whole level ≲ 350k triangles visible, ≲ 150 draw calls. Instancing for repeats.
- Viewer: `npx vite` on :5173, then
  `NODE_PATH=/opt/npm-tools/node_modules node model-test/shot.cjs "mod=/src/levels/port-of-victory/<file>.js&fn=<builder>&cx=..&cy=..&cz=..&az=..&el=..&dist=..&dusk=0.3&sunel=4" out.jpg`
  (the builder receives `{renderer, scene, camera, sun, hemi}` as its last argument; return `{root, update?}`).
  Look at shots from several angles, including backlit (camera looking toward -z, into the sun) and at dusk=0.8.
