# BAYHEM: handoff for the next levels

BAYHEM is a WebXR VR shooter for Meta Quest 3 built with three.js r170 and Vite. The target is Michael Bay spectacle at a polished PS2-era AAA look. Everything is procedural: there are no model, texture or audio files.

## Status
- **All four levels are merged into `main` and live on Pages.** Next step: a Quest 3 test pass (frame rate at the heaviest moments, `VR_HOLD` gun grips, locomotion comfort, text readability) before more art polish.
- **Level 5, "The Iron Lady" (on foot, Paris at blue hour, a fictional lattice tower falls across the Seine), is built** on branch `level-5-iron-lady` — see its section below and `src/levels/iron-lady/DESIGN.md`.
- **Level 4, "Airport No Return" (on foot, ends in a jeep chase), is done** — see its section below.
- **Level 3, "Downtown Haven City" (on foot, glass canyon at sunset), is done** — see its section below and `src/levels/downtown-haven/DESIGN.md`.
- **Level 2, "Port of Victory" (on foot, docks at dusk), is done** — see its section below and `src/levels/port-of-victory/DESIGN.md`.
- **The repo is multi-level:** shared engine in `src/`, one folder per level in `src/levels/<id>/` (lazy-loaded), a level-select menu, `?level=<id>` in the URL.
- **Level 1, "The 405 Job" (freeway chase), is done.** The player rides in a pickup bed.
  - Five beats: SUV wave, SUV wave plus one from ahead, fuel tanker, a four-SUV box-in, then the gunship "WIDOWMAKER", which crashes ahead of the truck.
  - It has animated skinned soldiers with ragdolls, hero guns with gloved hands, a procedural adaptive score and SFX, an in-shader color grade and rim light, and slow-mo.
- **Source:** GitHub `KungFuKennyOG/bayhem-vr` (branch `main`).
  - It deploys to GitHub Pages at https://kungfukennyog.github.io/bayhem-vr/ once Pages is set to "GitHub Actions" in the repo settings.
  - Start a new chat with: "continue BAYHEM from KungFuKennyOG/bayhem-vr, build <level>". Read `docs/QUALITY.md` first.

## Decisions made (apply to all levels)
- **Locomotion for the on-foot levels:** smooth thumbstick movement with a comfort vignette while moving, plus 45° snap turn.
- **Each new level gets its own chat.**
- **Engine:** stay in WebXR with three.js. Keep the art pipeline: procedural geometry and canvas/shader textures, with no screen-space post-processing. Grade, rim light and glows live in material shaders or sprites so they're free on Quest.

## Reusable modules (src/)
- **`collision.js`** (new): `CollisionWorld` (AABB grid: `pushCircle` for bodies, `raycast`/`visible` for bullets and line of sight, `groundAt` for floors/ramps/box tops, `collidePoint` for particles) and `NavGrid` (A* + string pulling, dynamic blockers).
- **`locomotion.js`** (new): smooth stick/WASD movement relative to the head, comfort vignette, 45° snap turn around the head, ground following, no walking off ledges; room-scale intrusions into walls push the rig back.
- **`settings.js`** (new): persisted player settings (`settings.comfortVignette`, `setSetting(k, v)`, localStorage with a private-mode fallback). The comfort vignette toggles from the menu button or by clicking the right stick in VR.
- **`soundbus.js`**: the live/recording audio bus (was in main.js).
- **`atmosphere.js`:** sunset sky shader, sun-aware fog, PMREM environment. The global shader patches add the color grade (`bayGrade`), fog toward the sun, and a sun rim light on every lit material.
- **`particles.js`:** a GPU-generated FX atlas with 64-frame fire and smoke flipbooks, plus an instanced billboard renderer that draws in one call and supports stretched sparks.
- **`fx.js`:** layered explosions (flash, fireballs, mushroom, oily smoke, sparks, embers, debris, shockwave ring, scorch decal, pooled lights). Also tracers, muzzle flashes, casings, and `trailEmit` for continuous smoke trails.
  - Per-level look knobs: `fx.heat` (fire emission), `fx.fireHue` (0 = white-hot Level 1 look, 1 = orange core / deep-red edges with an early dark smoke shroud, no white blow-outs), `fx.smokeMul`.
  - `fx.setGround(fn)` for on-foot levels (particles, debris, casings, scorch land on decks/container tops). `spawnDebris(..., burning = 2)` = heavy wreckage trailing a fat black smoke ribbon.
  - Particles: `spawn({ force: true })` bypasses `bigBudget` (only for one-off hero effects like the Level 2 finale).
- **`characters.js`:** `new Gunman({ outfit: 'port' })` gives the Level 2 dock-worker look (navy workwear, hi-vis carrier, reflective bands); `setGunmanLook({ lift, band })` keeps dark cloth readable at dusk (defaults 0 = Level 1 unchanged); `blobShadowMaterial/Geometry` for contact shadows.
- **`characters.js`:** sculpted skinned `Gunman` soldiers (window, roof and **ground** poses: stand, crouch, walk/run/strafe gait with 2-bone leg IK, peek lean, low-ready run, grenade throw; aiming, fire, hit, reload; 3 headgear variants; one draw call each), the verlet `Ragdoll` (moving road, or `Ragdoll.world` = a CollisionWorld so bodies land on decks/container tops/roofs and go to sleep; Level 1 also pushes ragdolls out of car bodies via `game.collideRagdoll`), and the animated sidekick `Driver` + `DRIVER_SEAT`.
- **`weapons.js`:**
  - `buildRifle` and `buildLauncher` with gloved hands and animations (bolt, mag swap, drum, ammo counter).
  - The `Gun` state machine.
  - `VR_HOLD` offsets for the Quest controllers, which still need tuning on a headset.
- **`audio.js`:** `AudioSystem` (procedural SFX, loops, 128 BPM D-minor adaptive score, stingers, bullet-time) and `renderOffline` for trailers.
- **`physics.js`:** a small rigid box against a moving ground plane. On foot, the ground velocity is 0.
- **`hud.js`:** world-space callouts (queued in two lanes, at most one big + one small line at a time, duplicates dropped), subtitles, score panel, boss bar, vignettes, comfort vignette, `objective()` (large text on a plate), `setWaypoint()`, `danger()` grenade markers. A title with `life > 900` (the outro card) hides the gameplay HUD (`hud.endCard(on)`).
- **`director.js`:** scripted beats with `until` conditions, music intensity and radio chatter.
- **`tools/capture.cjs` and `tools/render-soundtrack.cjs`:** deterministic headless trailer capture plus offline soundtrack mux. URL flags: `?capture&trailer`, `?demo`, `?sandbox`.

## Changelog (pull main before starting; shared modules keep changing)
- **Characters:** sculpted bodies, faces and gear; animated `Driver`. A second polish pass is in progress.
- **Vehicles (`vehicles.js`):**
  - Lofted bodies with tinted glass and visible drivers.
  - `buildCivilian(paint, style)` with three civilian styles.
  - Material slots [7] interior and [8] skin, which must be charred when wrecked.
- **Helicopter (`heli.js`):** rebuilt, with `aimGun`, `setDamage`, `breakTail`, `burnables` and `sparkPt`.
- **Particles:** an O(1) free list plus a big-sprite budget (`bigBudget`); explosion sizes are capped for fill rate. Keep this, because overdraw is the Quest bottleneck.
- **Collisions:** `game.separateCars()`, a solid truck-vs-wreck push, and ragdoll-vs-car.
- **Polish rule from Kenny:** after each pass, get an independent screenshot review. If it isn't close to 10/10, polish more. Be honest if procedural art plateaus.
- **Level 4 additions to the shared engine:**
  - `particles.js`: the dust, wisp and dirt atlas cells now fade to zero at the cell edge (they had square borders on big sprites).
  - `fx.js`: burning-debris trails are short and jittered, which removes the "string of pearls".
- **Gotchas found on Level 4:**
  - Particle and glow batches copy the fog near/far at creation, so they stay on Level 1's 25–520 m unless a level syncs `batch.material.uniforms.fogNear/fogFar` each frame. Smoke near the sun turns salmon otherwise (see the airport `index.js`).
  - The camera far plane is 3 km; Level 4 raises it to 12 km.
  - With near = 0.05, depth precision at 4 km is about 20 m, so far glows must be lifted off the ground.

## Level briefs

### Level 2: PORT OF VICTORY (on foot) — DONE
Built as briefed. Code: `src/levels/port-of-victory/` (`layout.js` maze + positions, `world.js` environment/lights/collision, `ai.js` soldiers, `game.js` combat, `setpieces.js` crane/forklift/ship finale, `director.js` beats, `auto.js` demo autopilot; assets in `ship.js`, `containers.js`, `props.js`). Beats: intro at the wreck → gate → maze (two waves, lights flicker on) → RTG crane drops a box on you (shoot the operator) → apron forklift with fuel drums → board the ship → shoot the fuel manifold → escape down the gangway → mushroom fireball in slow-mo → outro. Golden hour → blue hour is driven by `game.dusk` (`atmosphere.applyDusk`). Test any beat with `?level=port-of-victory&beat=<name>`.
Level 2 notes for the next chats:
- The finale mushroom is `mushroom.js`: five noise-displaced shader shells (core, stem, rolling toroidal cap, dome, base skirt) that cool from fire into black smoke, plus forced particles for soft edges. Reuse it for any "big one" (Level 3 tower collapse dust, Level 4 jet explosions).
- Explosions in this level use `fx.fireHue = 1` (orange/red + dark smoke). Level 1 keeps the old look.
- Environment pieces: `water.js` (harbour water), `far.js` (far shore / skyline with dusk windows), `decals.js` (ground grime, puddles), `warehouses.js`, `ship-detail.js` (hull plating, walkway, breaches, burnt state).
- Polish status: independent screenshot reviews went 5 → 5.5 → 6.3 → 6.5 → 6.5 → 6.5 over the passes (environment/lighting/containers ≈ 8, finale + ship hull the weak spots). The last two reviews mostly asked for scale/readability (bigger hull breaches, a meatier mushroom cap, a ship hull with more shape, busier apron ground) and for things that exist but read small at 720p (mooring lines, quay fenders, alarm beacons, pipe jets, puddles). Next levers if someone continues: a real lofted hull with bow flare, a volumetric-looking cap (raymarched noise sprite or many lit puffs), apron clutter props.
- Still to verify on a Quest 3: frame time during the finale (mushroom shells + forced particles are the heaviest moment), sodium light hopping, `VR_HOLD`.
Original brief:
- **Setting:** docks at dusk, the same golden hour drifting toward blue hour. Container stacks form a maze, gantry cranes and a moored cargo ship sit at the edge, with sodium lights flickering on.
- **Beats:**
  1. Bail out of the wrecked truck at the port gate.
  2. Fight through the container maze against soldiers who take cover and flank.
  3. A crane operator drops a container on you; dodge it.
  4. Forklift and fuel-drum chain reactions.
  5. Clear the ship deck.
  6. Finale: blow the ship's fuel hold and run down the gangway as it goes up in a mushroom fireball, in slow-mo.
- **New tech:**
  - On-foot locomotion and collisions against an AABB container grid.
  - Soldier AI: cover points, flanking, grenades.
  - Explosive barrels.
  - Destructible containers that dent and burst open.
  - Night-transition lighting with sodium point lights, kept to a fixed pool.

### Level 3: DOWNTOWN HAVEN CITY (on foot) — DONE
Code: `src/levels/downtown-haven/` — see its `DESIGN.md`. `layout.js` (avenue, lots, sniper perches, cars, subway, `streetGround`), `world.js` (assembles the art modules `city.js` / `street.js` / `cars.js` / `lobby.js`, collision world, nav grid, glows, dusk), `game.js` (combat), `ai.js` (Level 2 soldiers + rooftop **snipers**), `snipers.js` (scope, laser beams, dots, glints), `glass.js` (breakable glass), `traffic.js` (explosive cars), `setpieces.js` (gunship, lobby collapse, Meridian collapse, dust wall), `birds.js` (pigeons), `director.js`, `auto.js`.
Beats: intro (title, lasers find the street, pigeons go up) → avenue (2 snipers + goons in the traffic) → avenue2 (2 more roofs, the intersection) → gunship "WIDOWMAKER 2" (strafing runs through the shopfront glass, rockets the car you hide behind; shot down it spins into Meridian's face: glass waterfall + burning hole) → Haven Trust lobby (skylight + curtain wall come down in slow-mo) → collapse (Meridian leans down the avenue and sheds its floors into the canyon; the dust wall rubber-bands a few metres behind you) → dive down the subway stairs → outro. `?level=downtown-haven&beat=<intro|avenue|avenue2|gunship|lobby|collapse|dive|outro>`.
New tech (reusable for Level 4):
- **Breakable glass** (`glass.js`): builders export panes `{c, n, w, h, kind}`; one InstancedMesh for all panes + crack overlay, thin colliders until broken, 1 400-shard instanced pool (one draw) with tumble/bounce/settle, `blast()` for explosions, `burst()` for free shards. Bullets and grenades pass through glass (breaking it); enemy LOS ignores it.
- **Snipers**: scan → track (lock builds, beeps speed up, glint grows) → one heavy shot → bolt/duck. Lasers are an instanced additive beam that fades near the eye (safe in VR).
- **Explosive traffic** (`traffic.js`): hp → smoke + alarm + hazards → fire → BOOM + RigidBox flip → burning wreck (still cover). Rotated cars become 1–3 AABBs.
- **Collapse + dust wall** (`setpieces.js`): a chunked tower (`upper` group rotating about a pivot, chunks detach with tamed rigid-body velocities, random kicks and aimed landing zones), lower section pancakes, fog pulled in with `game.fogMix` only once the wall actually reaches you. The wall is clouds riding the front (`ride: D`), its crest outruns its foot and rolls over your head near the subway.
- **Volumetric dust/smoke clouds** (`dustfx.js`, `game.clouds`): level-local instanced puffs (one draw, own pool of 320 / 170 on Quest, sorted back to front) sampling a baked cauliflower height atlas (thickness + normal + density), lit like lumpy spheres (sky from above, low-sun wrap, sun through thin fringes, optional fire glow from below), with the game's sun-aware fog. Used for the dust wall, collapse shroud/skirt/chunk trails, the crash smoke column, burning-wreck columns and the side-street smoke columns. It never touches the shared particle big-sprite budget. Fill rate is the Quest risk: spawn rates halve on Quest.
Review status: five independent screenshot reviews went 5.5 → 5.5 → 5.5 → 6.0 → 6.2/10 (final frames in `docs/level3/`). The reviewers rate the canyon lighting, set dressing, lobby, sniper lasers and collapse staging well. What they still mark down:
- the shared fireball sprites (`fx.js`: puffy, with an olive fringe where the orange meets the grade);
- the collapse fracture reading as boxes;
- the dust wall's front edge;
- glass shards reading as paper;
- low-contrast enemies in the lobby;
- the desktop gun materials.

Procedural art plateaued here. The next real jumps need shared-engine explosion work or authored fracture meshes.
Original brief:
- **Setting:** a canyon of glass towers, abandoned traffic, and smoke columns from the earlier chaos.
- **Beats:**
  1. Street war down an avenue against rooftop snipers with laser sights.
  2. A gunship returns.
  3. Clear a lobby with collapsing glass.
  4. Finale: a skyscraper collapses down the avenue and you sprint ahead of the dust wall in slow-mo, diving into a subway entrance.

### Level 4: AIRPORT NO RETURN (on foot, ending in a vehicle) — DONE
Built on top of Level 2's framework (branch `level-4-airport`). Code: `src/levels/airport-no-return/` (`layout.js` positions, `world.js` airfield / lights / collision, `aircraft.js` airliner + cargo plane, `gse.js` jeep / refuelers / tugs / carts / stairs, `game.js` combat, `setpieces.js` jets / cargo plane / jeep ride / chase SUVs / leap / credits, `director.js` beats, `auto.js` demo autopilot). Beats: hangar intro → apron fight (2 waves, exploding JET A-1 refuelers) → two jets taxi up and blow on the taxiway (break into burning pieces) → FOLLOW-ME jeep pulls up → rail chase down runway 27 (SUVs, ramp crew, drum pallets) → jump onto the ramp as the plane rotates → credits behind the ramp. Test any beat with `?level=airport-no-return&beat=<name>`; see `DESIGN.md` there. Soldier AI is imported from `port-of-victory/ai.js` (should move to `src/` once Level 2 lands). Shared-file changes: `src/audio.js` (jet / cargo loops, spool-up), `src/levels/index.js` (registry), `src/particles.js` (atlas edge fade), `src/fx.js` (debris trails). It went through nine independent screenshot reviews, ending at 8.0/10; the remaining issues are listed in the PR.
Original brief:
- **Setting:** a sunset tarmac with hangars, jets and fuel trucks.
- **Beats:**
  1. Fight across the apron.
  2. Jets explode during taxi.
  3. Commandeer a baggage cart or jeep to chase a cargo plane down the runway.
  4. Finale: leap onto its open ramp as it lifts off; credits.
- **New tech:**
  - Large open space with long sightlines.
  - Huge jet explosions.
  - The truck-bed "rail" mode from Level 1 can be reused for the chase.

### Level 5: THE IRON LADY (on foot, a European landmark comes down) — BUILT, in review
Code: `src/levels/iron-lady/` — see its `DESIGN.md` (beats, world frame, collapse rig, asset contracts). `layout.js` (every number: river, quays, ramps, bridge, park, tower, snipers, cars, `groundAt`), `tower.js` (the 300 m lattice tower: ~2 660 instanced girders + cut-out skin panels, floodlight bands, sparkle / necklace bulbs, aviation lights, twin beacon; the collapse rig), `sky.js` (night sky shader + night env), `rain.js` (GPU drizzle + splash rings), `paris.js` (Haussmann frontages from a facade atlas, cross streets, far city, landmarks), `quays.js` / `quays-kit.js` (stone quays, ramps, lower quays, props), `river.js` + `reflections.js` (the Seine and the light columns on water / wet stone), `boats.js` (bateau-mouche, péniches, the speedboat), `world.js`, `game.js`, `ai.js`, `traffic.js`, `setpieces.js` (riverboat, gunship, tower fall, spray wall, escape), `director.js`, `auto.js`.
Beats: intro (title over the river, balcony lasers) → quay (fight down the lower quay; a bateau-mouche full of gunmen: shoot its fuel tank, her back breaks) → bridge (traffic jam, police block, a sniper on the first platform) → gunship "WIDOWMAKER 3" (threads the tower; killed, it spins into the north-east leg) → evac (the leg buckles, she lists and sheds girders) → collapse (look-gated: she falls north across the Seine onto the bridge, spire through the north frontage) → run (a spray / dust wall rolls down the river after you) → escape (speedboat east, look back at the wreck) → outro. `?level=iron-lady&beat=<intro|quay|bridge|gunship|evac|collapse|run|escape|outro>`.
New tech:
- **Vertex-shader collapse rig** (`tower.js` `twDeform`): a 25-node spine above the second platform, per-leg Bézier curves below it (feet tear out, legs bow), solved on the CPU with ground draping (`setpieces._solveSpine`); `TowerRig.deform()` mirrors it for glows / reflections / debris. Torn girders = zeroed instances re-spawned as rigid `Girders`.
- **Reflections** (`reflections.js`): analytic light columns for every lamp / window / the tower on water and wet cobbles (one draw).
- **Boat split**: a hull mesh cut in two by triangle centroid at explosion time (same material, no new shader).
Shared-engine changes: `hud.js` (callouts are clamped into the central ~45° and ≥ 4 m out — past the guns; affects every level), `downtown-haven/dustfx.js` (optional per-puff horizontal stretch `st`, default 1 = unchanged; the fire under-glow is clamped at 0 — it went negative late in a puff's life and **subtracted orange**, which was the teal / olive smoke reviewers flagged in Level 3 too), `downtown-haven/cars.js` (`city: 'paris'` liveries; the default build is bit-identical), `src/levels/index.js` (registry).
Review status: five independent screenshot reviews went 5.5 → 6.2 → 6.3 → 6.5 → 6.3/10 (final frames in `docs/level5/`; fresh reviewer each round; the last two are within reviewer noise of each other, so this is an honest plateau, like Levels 2 and 3). Kept by every reviewer: the tower (gold lattice, bulbs, glow — "the best hero object in the project"), the blue-hour sky, wet cobbles with lamp reflections, lamp streaks on the river, the bridge framing, the fire light washing the plaza in the gunship crash, the mid-fall fold framed across the river, the radio writing.
Fixed along the way: teal / olive smoke (root cause in `dustfx.js`, see above), river "TV static" (reflected window cells now average out under ripples), dark rain specks over fire (rain is additive), callouts clipping off-screen or sitting on the guns, the tour boat surviving its own blast (split hull), the wreck going dark (a third of the bulbs + aviation lights hang on), floating roof slabs in the frontages, the autopilot stalling at the ramps.
Open issues (round 5, by impact):
- The spray / dust wall still reads as haze, not a wall. Next lever: a structured front (stacked camera-facing ribbons with a noise-eroded top and a hard leading edge in a ShaderMaterial, a churned-water band ahead of it) instead of puffs.
- The impact is never framed: from the south lower quay the wall hides the base and the bridge landing. Next lever: a landing stage 10–15 m out on the river for the collapse beat, a tall white water plume and a hinged bridge-deck break at contact.
- Explosions: shared `fx.js` fireball sprites (band-shaped cores, a magenta rim on big blasts, black square debris chips). Same engine-level limit Level 3 hit.
- The quay wall is the most-seen surface and read as a high-contrast tile in round 5 (block tone variance narrowed since, not yet re-reviewed; next: an algae / tide band at the foot, mooring rings, drains).
- The gunship is small and lit flat by the tower (gunmetal paint + rim instead of the warm emissive lift; route it closer).
- The bridge "jam" is a handful of cars; repeated facade grids along the river; low-poly planter shrubs; the speedboat needs a wake and bow spray.
Headset checks needed: frame rate during the fall (2 660 instanced girders through the rig shader + rain + reflections + up to 320 cloud puffs), the look-gated collapse trigger, rain streak comfort within 1.2–13 m, callout placement with the new clamp, speedboat ride comfort (power turn), and the shared `VR_HOLD` grips.

## Quality bar and lessons from Level 1
- **The consolidated quality bar for all levels is `docs/QUALITY.md`** (review loop, VR-first rules from the Quest playtest, recurring review hits, Quest budget, pre-merge checklist).
- An independent reviewer critiqued the screenshots twice, and both times it was worth it.
- Recurring problems:
  - Backlit objects crushing to black (fixed by the rim light).
  - "String of pearls" smoke trails (use `trailEmit`).
  - Repetition.
  - Huge or toy-like viewmodels.
- The desktop viewmodel gotcha: `Object3D.lookAt` points +z. Barrels run along -z, so call `rotateY(Math.PI)` after it.
- Rendering in the cloud sandbox is software (SwiftShader), at about 1 s per 720p frame, so a 90 s trailer takes roughly 50 min to record.
- Quest performance and the `VR_HOLD` offsets still have to be verified on a real headset.
- **Structure suggestion for multiple levels:** move level-specific code (`world.js`, `director.js`, the truck and traffic parts of `game.js`) under `src/levels/<name>/`, and keep shared engine modules in `src/`. Add a level-select screen.
