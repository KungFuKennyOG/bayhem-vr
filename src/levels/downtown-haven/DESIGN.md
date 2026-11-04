# LEVEL 3 — DOWNTOWN HAVEN CITY (design + asset contracts)

On foot down a canyon of glass towers at golden hour, sun setting straight down the avenue just right of
**Meridian Tower** (the villain's HQ that closes the end of the avenue). Abandoned traffic, smoke columns
from the earlier chaos, steam from manholes, red sniper lasers dancing on the asphalt.

Beats (positional triggers; the autopilot walks the same route for capture):
1. **intro** (z +34): title card over the avenue, driver on the radio. Laser dots already on the street.
2. **avenue** (z +30 → -40): street war. Rooftop snipers with laser sights + lens glint on the podium roofs,
   ground goons using the abandoned cars as cover. Cars are explosive cover (smoke → fire + alarm → boom + flip).
3. **gunship** (intersection z -44…-62): "WIDOWMAKER 2" comes in low down the cross street, strafes the
   avenue (rounds walk through cars and up the storefront glass), rockets the cars you hide behind.
   Shot down, it spins down the avenue and slams into Meridian's face at `MERIDIAN.impact` (y 40):
   fireball, glass waterfall down the facade, a burning hole and a smoke column.
4. **lobby** (Haven Trust, right side z -82…-126): goons dug in behind the lobby glass. Enter, clear it.
   Mid-fight Meridian groans, the building shakes, the atrium skylight comes down in slow-mo and the glass
   curtain wall bursts in.
5. **collapse** (finale): out of the lobby onto the avenue (z ≈ -118). Meridian breaks at the impact floor;
   the floors above lean down the avenue and shed into the canyon one by one. Run back up the avenue (+z,
   sun behind you), across the intersection, to the subway entrance at z -41; the closest floor lands just
   behind you (slow-mo), the dust wall rolls up the canyon after you (it rubber-bands to stay a few metres
   back while you keep running); dive down the stairs as the dust swallows the street.
6. **outro**: underground, dust rolling over the entrance, stats, the driver.

## World frame (metres) — see `layout.js` for the numbers
- y up. Road y = 0, sidewalks/plaza/lobby floor y = 0.15 (curb). `streetGround(x, z)` is the ground truth
  (it also encodes the subway stairs).
- Avenue: building faces at x = ±16, sidewalks |x| ∈ [11, 16], road |x| < 11. Runs from z = +150 (behind the
  start, blocked at z ≈ +44 by a burning police barricade) to the plaza at z = -150.
- Cross street (intersection): z ∈ [-62, -44], road z ∈ [-58, -48], runs along x to ±220.
- Plaza: z ∈ [-170, -150], x ∈ [-46, 46]. **Meridian Tower**: x ∈ [-19, 19], z ∈ [-208, -170], h 132 m.
- Lots (`LOTS`): podium (street wall) + optional setback tower, per side of the avenue.
- **Haven Trust lobby** (lot R5): x ∈ [16, 42], z ∈ [-126, -82], floor 0.15, ceiling 9.5, podium roof 14.
  Facade glass on the x = 16 plane, open doorways at z ∈ [-90.5, -86.5] and [-121.5, -117.5].
  Atrium skylight at x ∈ [22, 36], z ∈ [-116, -92] (glass roof at y = 9.5).
- **Subway** (`SUBWAY`): right sidewalk at the end of block 1, x ∈ [12.0, 15.4]; top step z = -41 (y 0.15),
  stairs go DOWN toward +z to z = -31 (y -4.0), landing/tunnel to z = -26. Open end faces -z (toward the
  intersection and Meridian).
- Sniper perches (`SNIPERS`): podium roofs, ~1 m in from the avenue edge, behind a parapet
  (`PARAPET`: 1.05 m high, 0.35 m thick, flush with the facade).
- Sun: azimuth ≈ (0.3, 0, -1) (down the avenue, right of Meridian), elevation 7° → 2° over the level
  (dusk 0.05 → 0.45). The street is mostly in the shadow of the right-hand towers, with golden shafts through
  the cross street and gaps; upper floors on the left catch the sun; glass reflects the burning sky.

## Conventions (all procedural, no asset files)
- three.js r170, `src/geom.js` helpers, canvas textures (`src/textures.js`), deterministic `makeRng(seed)`.
- `MeshStandardMaterial` (+ `onBeforeCompile` if you need it — the global chunk patches still apply: grade,
  sun-aware fog, rim light). No screen-space post, no runtime lights. Glows = additive billboards.
- Dusk: emissive materials that light up at dusk (windows, signs, lamp lenses) get
  `material.userData.duskEmissive = <peak emissiveIntensity>`; the level ramps them.
- Model space: forward = -z, up = +y. Builders return
  `{ root, colliders: [{ min:[x,y,z], max:[x,y,z], data? }], anchors: {...}, panes?: [...], update?(dt, t, dusk, head), info? }`.
  Colliders are in world space for the city/lobby/street/subway builders (they place themselves),
  in model space for cars.
- **Breakable glass is NOT modelled by the builders** — they export it as `panes`:
  `{ c: [x,y,z], n: [nx,ny,nz], w, h, kind: 'store'|'lobby'|'sky'|'tower', tint?: [r,g,b] }`
  (centre, outward normal, width along the in-plane horizontal axis, height). The game renders all panes in
  one InstancedMesh, adds their colliders, and shatters them into instanced shards. Builders model the
  frames/mullions around them and whatever is visible behind them.
- Quest 3 budget for the whole level: ≲ 350k visible triangles, ≲ 150 draw calls. Merge static geometry per
  material, instance repeats. Few textures (≤ 1024², share them).
- Viewer: `npx vite` on :5173, then
  `NODE_PATH=/opt/npm-tools/node_modules node model-test/shot.cjs "mod=/src/levels/downtown-haven/<file>.js&fn=<builder>&cx=..&cy=..&cz=..&az=..&el=..&dist=..&dusk=0.2&sunel=6&fogFar=900" out.jpg`
  (the builder receives `{renderer, scene, camera, sun, hemi}` as its last argument). Look from street level
  (cy ≈ 1.6), toward -z (into the sun, backlit) AND toward +z, at dusk 0.05 and 0.5.

## Files
- `layout.js` — numbers (owned by the level).
- `city.js` — `buildCity(ctx)`: all avenue/cross-street/plaza buildings except Meridian and the Haven Trust
  podium, rooftop clutter, far skyline. `buildMeridian(ctx)`: the chunked hero tower.
- `street.js` — `buildStreet(ctx)`: road/sidewalk/plaza surfaces + markings, street furniture.
  `buildSubway(ctx)`: the entrance.
- `cars.js` — `buildCar(type, opts)`: sedan, taxi, police, suv, van, bus, wreck.
- `lobby.js` — `buildLobby(ctx)`: the Haven Trust podium (shell, facade frame, interior, skylight frame).
- `world.js` — assembles everything, collision world, nav grid, dusk, glows.
- `game.js`, `ai.js`, `glass.js`, `snipers.js`, `setpieces.js` (gunship, Meridian collapse, dust wall),
  `director.js`, `auto.js`, `index.js` — gameplay.
