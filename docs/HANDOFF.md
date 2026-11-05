# BAYHEM: handoff for the next levels

BAYHEM is a WebXR VR shooter for Meta Quest 3 built with three.js r170 and Vite. The target is Michael Bay spectacle at a polished PS2-era AAA look. Everything is procedural: there are no model or texture files, and the only audio files are the driver's voiced radio lines (`public/vo/`, see `tools/vo/README.md`).

## Status
- **All four levels are merged into `main` and live on Pages.** Next step: a Quest 3 test pass (frame rate at the heaviest moments, `VR_HOLD` gun grips, locomotion comfort, text readability) before more art polish.
- **Level 6, "Tokyo Scramble" (on foot, Shibuya/Shinjuku stand-in on a hard-sun afternoon), is built** on branch `level-6-tokyo` — see its section below and `src/levels/tokyo-scramble/DESIGN.md`.
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
- **Driver voice (Nov 2026):** every DRIVER line is voiced with local AI TTS (Chatterbox cloned onto a Kokoro male voice, both free to ship) and a baked radio filter. Kenny picked it over a calmer TTS after listening to samples. A real voice actor is still an option for a final pass. Any new or reworded driver line needs `tools/vo` re-run, or it plays silent (subtitle + squelch only).
- **Engine:** stay in WebXR with three.js. Keep the art pipeline: procedural geometry and canvas/shader textures, with no screen-space post-processing. Grade, rim light and glows live in material shaders or sprites so they're free on Quest.

## Reusable modules (src/)
- **`collision.js`** (new): `CollisionWorld` (AABB grid: `pushCircle` for bodies, `raycast`/`visible` for bullets and line of sight, `groundAt` for floors/ramps/box tops, `collidePoint` for particles) and `NavGrid` (A* + string pulling, dynamic blockers).
- **`locomotion.js`** (new): smooth stick/WASD movement relative to the head, comfort vignette, 45° snap turn around the head, ground following, no walking off ledges; room-scale intrusions into walls push the rig back.
- **`settings.js`** (new): persisted player settings (`settings.comfortVignette`, `setSetting(k, v)`, localStorage with a private-mode fallback). The comfort vignette toggles from the menu button or by clicking the right stick in VR.
- **`soundbus.js`**: the live/recording audio bus (was in main.js).
- **`vo.js`** (new): wraps `hud.subtitle` so every `DRIVER` line with a clip in `vo-manifest.js` is spoken over the radio (keyed by a hash of the exact text, preloaded per level, ducks the score, ignores slow-mo, recorded for trailer renders). It also owns the radio squelch, so level code just calls `hud.subtitle('DRIVER', text)`.
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

- **Playtest fixes (Nov 4, 2026, from Kenny's Quest run):**
  - `src/beats.js`: beats can add `gate: () => Vector3 | null` (+ `gateMsg`). When `arrive()` still says no and the player has stood on the marker for 2 s, the waypoint moves to what is holding the beat and returns once it's dealt with. Level 3's avenues point at the nearest live sniper; Level 5's quay points at the tour boat. Level 5's quay and bridge beats now use `arrive` too (the bridge used to need you 10 m *past* its marker).
  - Level 5 tour boat: bullets only hit a 1.4 m sphere on the stern tank, so shooting the boat itself did nothing. `_rayBoat` now tests the boat's own colliders in boat space (hull 0.75, tank 3 damage; it smokes, then burns, as it takes hits).
  - Level 5 speedboat: a quay-edge collider sat across the pontoon's entrance instead of its river side, so you could never step on to board. Boarding now triggers anywhere on the pontoon.
  - Level 5 art: ramp cobbles stopped 0.45 m short of the river-side wall (a see-through strip); wall lanterns that a ramp lifted above the retaining wall hung in the sky and are skipped.
  - Level 3 subway: the rear half of the headhouse was an open street-level slab with a poster wall (from the top of the stairs it read as stairs down to a walled-off shelf). A granite headwall with the HAVEN METRO sign now closes it over the stair lintel.
  - Level 4: the end credits are now a "LEVEL 4 COMPLETE / NEXT STOP PARIS" card in the same sky band, and the beat is ~13 s shorter.

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

**Performance pass (branch `downtown-perf`).** Measured in the sandbox with a Quest user agent (Quest pools and shadow size), at fixed frames per beat; no headset frame times yet. Per VR frame (both eye passes + sun shadow) triangles fell 13–24% (intro 1.42M → 1.23M, avenue 1.44M → 1.19M, gunship 1.08M → 0.82M, collapse 1.02M → 0.81M); the shadow pass roughly halved everywhere; dust overdraw in front of the player during the collapse went from ~16 to ~9 screens; lobby simulation CPU ~30% lower. Screenshots before/after match.
- `shadowlod.js`: car bodies cast the sun shadow from a vertex-clustered copy appended to their own geometry (draw range swapped in `onBeforeShadow`/`onAfterShadow`), so no extra draw calls. Cars were half the shadow pass. `?noshadowlod` turns it off.
- `game._cullSoldiers`: gunmen ship with `frustumCulled = false`; while alive they now cull against a fixed 1.7 m sphere around the root (ragdolls keep the old behaviour) and stop casting sun shadows past 40 m. `?nosoldiercull`.
- `dustfx.js`: puffs hidden by fog, by the near fade, or completely behind denser nearer puffs (angle grid around the eye, so it holds for both eyes) are skipped; a fill budget (`fillBudget`, Quest 6 / desktop 14, `?fill=N`) fades the farthest in-view puffs out first. `?noocc`.
- `ai.js`: a soldier with no free cover rescanned all ~700 cover points every frame; a miss is now remembered for 0.33 s (17× fewer scans, same decisions). Port of Victory's `ai.js` (also used by the airport) has the same pattern and would take the same fix.
- Tried and dropped: splitting the merged city/street/lobby meshes into ground cells (4% fewer triangles for ~20 more draw calls per pass).
- Still heavy: the shared particle batch at the gunship crash and the dive (~14–25 screens of overdraw, `fx.main` pool full), and ~450–510k eye-pass triangles at the start and down the avenue (cars and soldiers ~9–11k tris each). Headset check: frame time during the collapse and the dive.
Original brief:
- **Setting:** a canyon of glass towers, abandoned traffic, and smoke columns from the earlier chaos.
- **Beats:**
  1. Street war down an avenue against rooftop snipers with laser sights.
  2. A gunship returns.
  3. Clear a lobby with collapsing glass.
  4. Finale: a skyscraper collapses down the avenue and you sprint ahead of the dust wall in slow-mo, diving into a subway entrance.

### Level 4: AIRPORT NO RETURN (on foot, ending in a vehicle) — DONE
Built on top of Level 2's framework (branch `level-4-airport`). Code: `src/levels/airport-no-return/` (`layout.js` positions, `world.js` airfield / lights / collision, `aircraft.js` airliner + cargo plane, `gse.js` jeep / refuelers / tugs / carts / stairs, `game.js` combat, `setpieces.js` jets / cargo plane / jeep ride / chase SUVs / leap / credits, `director.js` beats, `auto.js` demo autopilot). Beats: hangar intro → apron fight (2 waves, exploding JET A-1 refuelers) → two jets taxi up and blow on the taxiway (break into burning pieces) → FOLLOW-ME jeep pulls up → rail chase down runway 27 (SUVs, ramp crew, drum pallets) → jump onto the ramp as the plane rotates → credits behind the ramp. Test any beat with `?level=airport-no-return&beat=<name>`; see `DESIGN.md` there. Soldier AI is imported from `port-of-victory/ai.js` (should move to `src/` once Level 2 lands). Shared-file changes: `src/audio.js` (jet / cargo loops, spool-up), `src/levels/index.js` (registry), `src/particles.js` (atlas edge fade), `src/fx.js` (debris trails). It went through nine independent screenshot reviews, ending at 8.0/10; the remaining issues are listed in the PR.

**Polish pass (branch `airport-polish`).** The old 8.0 came from reviews that never saw the other levels; reviewed side by side with Level 2/3 frames it scored **4.5** (Port 7.0, Downtown 6.5 in that round). Four calibrated reviews went **4.5 → 6.0 → 6.3 → 6.5** (the last round put Port at 6.5 and Downtown at 6.0 on the same scale, so the airport is now level with them).
- Midground: `terminal.js` (new) builds CONCOURSE B (glass gate lounges, jet bridges to two nose-in airliners, NORDAIR / AERO CORAL liveries), the HAVEN AIR CARGO shed on the south edge, four sheds down taxiway A for the chase and the far terminal across the runway. All buildings merge into one `StaticBatch` (draw calls at the getaway: 227 → 181).
- Apron: catering high-loaders (SKYCHEF livery), crew buses, jersey barriers, per-vertex grime wash, gate / stand / service-road markings; masts and cones moved to a no-shadow batch (their 280 m low-sun shadows striped the whole apron).
- Ground: calmer asphalt (no per-pixel grain in the normal map: it sparkled like sand), runway tyre streaks, shader-side grass patchwork + mowed stripes along the runway strip, field edge + approach lights past the far end.
- Hangars: lamp light pools, grimy self-lit wall and door liners, mezzanine offices, clutter in hangar 2, matte floor.
- FX: Level 2's dusk fire look (`fx.heat 0.86`, `fireHue 1`, lit debris) plus a level-local clamp that keeps every fire sprite orange; the fuel carpet is flames instead of 14 flash sprites (the white ground band); wreck columns use Level 3's `DustClouds` (imported from `downtown-haven/dustfx.js`, own pool) with a low flame sheet at the base instead of `fx.flame` (which shot beads 10 m up the column).
- Staging: jets start in view (`TAXI.zStart` 60), the jeep arrives up the taxiway inside the view, the chase cuts across the infield onto the runway behind the plane (dust wake, bounce), the plane starts ~100 m ahead with jet-blast dust, the jeep is centred under the ramp for the leap, the hold side walls now reach the ramp rails.
- Bug fix: the perch goons on the stair trucks spawned 1–4 m off the platforms (and rotated trucks inflated their AABB decks); perch trucks are axis-aligned and spawns come from `world.perches`.
- Open issues from the last review: the chase ground and runway still read flat and empty; the taxi kill is a long shot unless you walk to the apron edge; props and buildings are too clean (no rust / grime gradients); the hold is a tunnel of identical rings; shared-engine items (callouts buried in smoke, hard blob shadows / scorch discs, enemy muzzle flash size). Procedural art is close to its plateau here too: the next real jump is authored meshes or engine-level ground / FX work.
- Still needs a Quest 3 check: frame time at the jet kill (clouds + fire) and the getaway view (most buildings in frame).
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

### Level 6: TOKYO SCRAMBLE (on foot, Shibuya / Shinjuku on a hard-sun afternoon) — BUILT, in review
Code: `src/levels/tokyo-scramble/` — see its `DESIGN.md` (beats, world frame, the layered East Exit decks, rendering modules). The brief changed mid-build (Nov 5): night neon → **sunny afternoon, hard light** (overcast tested flat), and the parking deck → **the East Exit** (a bus plaza under a ring of pedestrian decks). `?night=1` still renders the night-neon version.
Beats: intro (station skybridge over the tracks) → crossing (the scramble under the giant screens; they flip to an emergency broadcast) → avenue → eastexit (bus plaza, `perch` gunmen pacing the decks overhead) → decks (up the stairs, along the arms, the station's face stair to its roof terrace, the link) → xway (the jam) → tanker (look-gated; a span hinges down into the street) → offramp → center (Center-gai) → gas (the chain chases you down the street) → dive (slow-mo into the crossing) → outro. `?level=tokyo-scramble&beat=<name>`.
New tech:
- **2.5D city-wide sun shadows** (`sunshadow.js`): a building-height map rasterised from the collision boxes; every static material marches 16 steps toward the sun (`patchSun`, chains onto existing shader patches), plus an invisible caster mesh for the realtime shadow map (cars / people). Lit tops over shaded canyons out to the horizon, no extra draw calls for the art.
- **Walkable decks over walkable ground**: collider tops + `col.walk` ramps (the engine's `groundAt` is height-aware); deck balustrades tagged `layer:'deck'` are switched off while the street nav is built; gunmen up there are `perch` soldiers.
- **Time of day switch** (`tod.js`): how much night-built emissive art glows by day; signs render as printed albedo + a little self-illumination (`signMat`).
Shared-engine changes: `downtown-haven/cars.js` — `city: 'tokyo'` now has its own atlas (Japanese plates, a navy JPN-taxi with the andon, a white/black patrol car, a courier box truck, a city bus); the default build is untouched. `src/levels/index.js` (registry).
Review status (fresh reviewer each round, same calibration frames: L2 gate/crane, L3 street/dust, L5 quay):
- Round 1 (first daylight build): 6.0. Center-gai and the gas chase ~7 (Level 5 quality); plaza / deck / expressway ~5 ("greybox"); "hard sun" read as overcast.
- Round 2: 6.0. The tanker review frames were taken before its look gate opened (fixed: gate at 7 s, frames later); smoke columns read as boxes; factory-clean surfaces; no crowd.
- Round 3: 6.5. Smoke columns (baked plume texture) and the fleeing crowd landed; Center-gai 7.5 ("best frame in the game for sense of place"). Open: the span drop hidden in smoke, empty decks, generic glass towers, American-looking sedans, debris / glass shards as flat white polygons (shared `fx.js`).
- Round 4: 6.2 — within reviewer noise of round 3, so an honest plateau around 6.2–6.5 (Levels 2/3 territory, below Level 5's 7.5). Every round: street level (crossing, Center-gai, gas chase, dive) 7–7.5 and reads as Tokyo "more strongly than any other level reads as its city"; the middle third (plaza, deck, expressway) 5–6.
- Found in round 4: the "thick bar" lying across the skybridge in the intro was the sniper scope's realtime shadow streaking from a far rooftop; Tokyo's snipers' scopes no longer cast (`game.js spawnSoldier`). Level 3's snipers use the same scope + sun shadows: check them for the same streak.
Open issues (round 4, by impact):
- The span drop: from the deck the fallen slab is below your eye line and the fire / dust hides it; frame it from the side (a landing beside the gore, or a cinematic look) and add a dust ring where it hits.
- The plaza / deck / expressway still read generic next to the streets: a denser jam, Shuto-style parapets with the grey-green band, a second deck stacked over parts of the expressway, buildings closer to the road.
- Filler buildings (white grids, glass slabs) — a Tokyo mixed-use kit: external stair cores, balcony stacks with laundry, rooftop billboard frames everywhere.
- Shared `fx.js`: flat black / white debris chips, flat white glass shards, an olive fringe on big fireballs (same engine-level limit Levels 3 and 5 hit).
- Cars keep their American bodies under the Tokyo liveries (a boxy JPN-taxi / kei-van body in `cars.js` would fix the last vehicle cue).
- HUD: the objective, a callout and a radio line can stack at once at the crossing.
Headset checks needed: the 2.5D sun-shadow march cost on Quest (16 texture taps on every static fragment facing the sun; drop to 10 steps or bake the ground into a map if it's heavy), the deck layering (walking up the open stairs, perch gunmen above you), the crowd at the start, and the fleeing crowd's comfort (none should run through the player).
