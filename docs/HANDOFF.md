# BAYHEM: handoff for the next levels

BAYHEM is a WebXR VR shooter for Meta Quest 3 built with three.js r170 and Vite. The target is Michael Bay spectacle at a polished PS2-era AAA look. Everything is procedural: there are no model or texture files, and the only audio files are the driver's voiced radio lines (`public/vo/`, see `tools/vo/README.md`).

## Status
- **Level 8, "Sand Castles" (door gunner on a helicopter on rails over a fictional Gulf megacity), is built and merged (PR #22, Nov 8, 2026) — see its section below and `src/levels/sand-castles/DESIGN.md`. Reviews plateaued at ~6.0 (Level 5 ≈ 6.8, Level 6 ≈ 6.3 on the same scale). **Needs a Quest 3 run** (test plan in its section). The grey-box prototype stays URL-only at `?level=dubai-proto`.
- **Dubai (Level 8) prototype, merged as PR #14, URL only** (`?level=dubai-proto`, not in the menu): a grey-box tech test of the Level 8 finale with an in-VR perf panel and load flags. **Needs a Quest 3 run** — see "Dubai prototype" below for the test plan and pass/fail numbers.
- **All four levels are merged into `main` and live on Pages.** Next step: a Quest 3 test pass (frame rate at the heaviest moments, `VR_HOLD` gun grips, locomotion comfort, text readability) before more art polish.
- **Level 7, "WHITEOUT" (on foot + cable car: a blizzard on a fictional Alpine peak, the summit observatory, an avalanche), is built** on branch `level-7-whiteout` — see its section below and `src/levels/whiteout/DESIGN.md`. Independent reviews plateaued at ~5.0 (below the other levels' 6–7.5); the section says what would move it.
- **Level 6, "Tokyo Scramble" (on foot, Shibuya/Shinjuku stand-in on a hard-sun afternoon), is built and merged** (PR #19; polish pass in PR #21, `level-6-polish`) — see its section below and `src/levels/tokyo-scramble/DESIGN.md`.
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
- **Level 8 (Dubai) runs at 72 Hz** (decided Nov 5, 2026, after the first prototype run on the headset). The level asks the XR session for 72; the other levels keep the browser's 90. Its finale is staggered: by the money shot most towers are already down behind the dust, and only the hero plus at most 2 mid towers fall at the same moment. See "Dubai prototype". Level 8 itself (`sand-castles`) also flies low between the towers at rooftop height (altitude, speed and clearance are URL flags until measured on the headset), keeps a fixed cabin frame with capped banking and never moves the head from code, and uses only fictional city and building names.
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

### Level 6: TOKYO SCRAMBLE (on foot, Shibuya / Shinjuku on a hard-sun afternoon) — BUILT, merged (PR #19)
Code: `src/levels/tokyo-scramble/` — see its `DESIGN.md` (beats, world frame, the layered East Exit decks, rendering modules). The brief changed mid-build (Nov 5): night neon → **sunny afternoon, hard light** (overcast tested flat), and the parking deck → **the East Exit** (a bus plaza under a ring of pedestrian decks). `?night=1` still renders the night-neon version.
Beats: intro (station skybridge over the tracks) → crossing (the scramble under the giant screens; they flip to an emergency broadcast) → avenue → eastexit (bus plaza, `perch` gunmen pacing the decks overhead) → decks (up the stairs, along the arms, the station's face stair to its roof terrace, the link) → xway (the jam) → tanker (look-gated; a span hinges down into the street) → offramp (the emergency stair) → center (Center-gai) → gas (the chain chases you down the street) → dive (slow-mo into the crossing) → outro. `?level=tokyo-scramble&beat=<name>`.
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
Playtest feedback after merge (Kenny, Nov 7: "pretty good… I like it") and the fixes (PR #21, branch `level-6-polish`):
- "The stairs look weird when you go up": the station face stair R2 was 48 m of 7 cm steps with the risers drawn on the wrong side → now a paved 7° ramp with tactile edge strips (centre rail gone).
- "Weird to go on the highway and then go back": the offramp beat sent you 50 m back east to the gore → a steel **emergency stair** (非常口 sign) straight down from the jam's south parapet onto the off-ramp right where the tanker beat leaves you; objective, driver line (voiced) and autopilot route follow it.
- "The explosion of the highway looks kinda weird": the span dropped within a second, inside the fireball, and the smoke parked over it → the follow-up blasts go off higher and lean north, the shared fireball smoke is thinned for these three booms (`fx.smokeMul` × 0.4 around the calls, level-local) and replaced by a column that rises off fast; the east pier now **topples** sideways and slams into the street (it used to vanish); the span **sags** on its hinge for 1.2 s (jolts, sparks, concrete raining off) before it lets go.
- "The gas chain at the end looked underwhelming because the street looked fine after": bigger shop blasts (every third a big one, a second blast up the floors, more debris, glass, sparks) and taller manhole jets — and the damage now **stays** (`ruin.js`): gutted ember-lit shopfronts, soot up the facades over the signs, fallen fascias / shutters / awning frames, rubble fans, scorch marks, burning heaps in the street, burning holes a floor up on the big ones, craters at the manholes, fires that keep burning to the end.
Independent review of the fixes (fresh reviewer): emergency stair 6/10 ("works, easy to find, read as a ramp" → dark risers, nosings on the right edge, a low stringer so the sawtooth shows, a bigger lit sign, chevrons on the road), span collapse 4/10 ("a brown curtain covers the break; grenade callouts steal the moment" → shared smoke 15 %, column starts higher, no grenades for 9 s, a beige dust surge at the impact), gas aftermath 6/10 ("shops look unlit rather than burned, fires float, rubble reads as black cubes" → brighter embers, lighter concrete rubble, fires on the big lumps, a smoke column off every gutted front). Not re-scored after those changes.
Open issues (round 4, by impact):
- The span drop: improved (see above), but from the jam the fallen slab is still below your eye line; a side vantage (the new emergency-stair landing is one) or a cinematic look would sell it more.
- The plaza / deck / expressway still read generic next to the streets: a denser jam, Shuto-style parapets with the grey-green band, a second deck stacked over parts of the expressway, buildings closer to the road.
- Filler buildings (white grids, glass slabs) — a Tokyo mixed-use kit: external stair cores, balcony stacks with laundry, rooftop billboard frames everywhere.
- Shared `fx.js`: flat black / white debris chips, flat white glass shards, an olive fringe on big fireballs (same engine-level limit Levels 3 and 5 hit).
- Cars keep their American bodies under the Tokyo liveries (a boxy JPN-taxi / kei-van body in `cars.js` would fix the last vehicle cue).
- HUD: the objective, a callout and a radio line can stack at once at the crossing.
Driver VO: all 32 Level 6 lines are voiced (31 new Chatterbox takes, the emergency-stair line added Nov 7; Whisper-checked, 0 flagged; built with only the Tokyo takes and merged into `src/vo-manifest.js`, because the other levels' raw takes aren't kept in git and `build.py` rewrites the manifest from whatever raw takes exist — rebuild the full set only on a machine that has them all). Pre-merge sweep: every beat jumps cleanly with and without `noauto=1` (22/22, no page errors); the autopilot finishes the level from `beat=xway` (done at the outro).
Headset checks needed: the 2.5D sun-shadow march cost on Quest (16 texture taps on every static fragment facing the sun; drop to 10 steps or bake the ground into a map if it's heavy), the deck layering (walking up the open stairs, perch gunmen above you), the crowd at the start, and the fleeing crowd's comfort (none should run through the player).

### Level 7: WHITEOUT (on foot + cable car, a mountain comes down) — BUILT, in review (branch `level-7-whiteout`)
Code: `src/levels/whiteout/` — see its `DESIGN.md` (beats, world frame, rendering modules). `layout.js` (every number:
the road polyline, the switchback legs and hairpins, the stations, the cable line `lineY(z)`, the summit fortress,
the face; the analytic mountain baked to a 1 m heightfield; `structFloor` + `groundAt` + the walk mask `walkable`),
`terrain.js` (chunked LOD heightfield + far peaks + the snow / rock shader), `kit.js` (merge bucket + `snowPatch`:
snow on every up-facing surface, rime on the windward side), `snow.js` (wind, gusts, whiteout surges, GPU snowfall,
spindrift), `sky.js` (storm ↔ clear sky, env re-bake, cloud sea), `road.js`, `props.js`, `flora.js`, `station.js`,
`fortress.js`, `cabin.js`, `avalanche.js`, `world.js`, `game.js`, `ai.js`, `traffic.js`, `setpieces.js`,
`director.js`, `auto.js`.
Beats: intro (the burning snowcat, title over the slope) → road1 (leg 1: roadblock; gunmen on the road above fire
down) → road2 (leg 2: a laser sniper on the rib; flankers come up the road below; the Berghaus and its propane tank)
→ road3 → yard (Mittelstation yard, the fuel tank, a shed sniper) → board → cable (the ride across the gorge; cabin 2
drops into the gorge; the haul rope snaps 42 m out, the brakes scream it into the dock) → hall (your cabin rolls back
down into the pylon) → court (they fire down from the roof walk) → roof (you fire down into the courtyard) → summit
(the terrace: the storm breaks, the face, the convoy, the Gazex cannons) → avalanche (the slab breaks, the front comes
down the face, look-gated) → run (east along the roof walk; the front is rubber-banded) → gallery (it goes over the
gallery roof and pours past the pillars) → outro (the railcar). `?level=whiteout&beat=<name>`.
New tech:
- **Heightfield world with a walk mask**: the mountain is an analytic function (road shelves carved with retaining
  steps, plateaus flattened) baked at 1 m; struct floors (roofs, stairs, landings) never overlap in xz so ground is one
  2D function; the locomotion sees no ground outside `walkable()`; `col.raycast` / `col.visible` also march the
  heightfield, so bullets and line of sight stop at the hill; the nav grid tests colliders against the local floor.
- **`snowPatch`** (kit.js): one onBeforeCompile patch that settles noisy snow on every up-facing surface and feathers
  rime on the windward side, chained onto any MeshStandardMaterial.
- **Weather**: gusts and surges drive the fog (whiteout), GPU snowfall streaks along screen-space velocity, masked under
  roofs (and inside the moving cabin), catching the nearest fire.
- **The avalanche front** (avalanche.js): a terrain-hugging rolling band (toe → nose → crest → back) with vertex lumps
  from 3D noise rolling along the profile, fragment billows via a surface-gradient bump, gold sun on the front, AO in
  the folds, an eroded crest, smooth analytic normals; it rides over the station roofs and stops at the gallery's edge
  once you're inside. The powder cloud is big two-tone sprites in the shared `clouds` batch plus a dust skirt ahead of
  the toe (the blended plume band is built but off: it read as glacier ice); slab blocks; the crown crack; the curtain.
- **Set dressing helpers** (kit.js): `floorPools` (additive light-pool decals on floors that aren't terrain: the
  terrain bakes its own), `trackDecals` (tyre / track marks following a polyline on flat snow).
Shared-engine changes: `src/characters.js` (`alpine` palette outfit: dark cold-weather kit, amber goggles, orange
hi-vis bands — palette only, default untouched), `src/levels/index.js` (registry).
Review status (fresh reviewer each round; the same 10 fixed angles in `review.sh` order; calibration frames L2 maze1b, L3 avenue, L5 quay, L6 crossing, which reviewers scored 6.0–7.5 every round):
- Round 1: 4.5. The climax read as beige lumps (the front) and a white wall; the face was noise with dark stripes; Gazex unreadable; empty yard / courtyard floors; the cabin a box of planes; a primitive snowcat. The Berghaus frame was best (6.0).
- Round 2: 5.0. The powder cloud (sprites), the face side-lit (sun swung to WSW), ribbed rock, bigger gunmetal Gazex on rock outcrops, courtyard cover clusters, burning barrels, tyre tracks, the snowcat rebuilt, the gallery whiteout blue-grey (the pour reads), floor light pools, window streaks / lintels / icicles.
- Round 3: 5.0. Snow value ramp (sun-facing warm, shade blue), alpine kit with orange hi-vis bands, layered snowfall (big soft near flakes, varied streak length), storm thinned over the gorge, scour patches softened.
- Round 4: 5.0. Alpenglow, the plume band dropped for a denser two-tone powder cloud, plough berms, marker poles, finer far mesh. **Honest plateau at ~5.0**, about 1.5 below Levels 2/3/5/6 on the same calibration scale. Every round the blizzard road (01–03) scores 5.5–6.5 and the Berghaus is the best frame; the spectacle half (cable car, avalanche, gallery) scores 4–5.5.
What would move it (beyond more polish passes):
- **The avalanche** needs a real volumetric look: a dense flipbook-lit billow sheet that hugs the slope (self-shadowed undersides, speed streaks, debris, pylons going down), filling half the frame in the run. Sprite puffs on a mesh front read as "fair-weather cumulus" to every reviewer. This is engine-FX work in `particles.js` (a lit billow cell with a normal-mapped flipbook), the same limit Levels 3/5 hit.
- **The face terrain** reads as "crumpled paper": an analytic heightfield at 2–8 m can't carve couloirs, aretes, cornices and rock buttresses. It needs authored cliff meshes (rock buttresses with snow on the top faces) placed along the ribs, or a much finer bake under the face.
- **The cable car** (reviewers' "should be the money shot"): the gorge walls are terrain far away in fog. It needs close set-dressing: cliff meshes beside the line, a second pylon passing close, the haul rope visible from inside, a textured cabin interior.
- **Ground planes**: more value zones (packed grey-brown at doors, dirty plough banks), AO strips at every wall base.
Open issues (round 4, by impact): the avalanche (above); the face (above); the cable car (above); flat yard and courtyard ground; uniform snow streaks (still read as "scratches on the lens" to some reviewers: thin them further after the storm breaks); no key-light direction in the blizzard (a warm glow behind the cloud deck); the snowcat still blocky; the radome plain; hard blue blob shadows on the face (low 7° sun, the shadow map's terrain bumps); stray debris cards in the gallery.
Polish pass 2 (branch `level-7-polish`, after Kenny's first look: "needs an extreme amount of polish", "I cannot move inside the cabin"):
- **You can walk inside the cable car during the ride.** It used to pin the rig to one spot (the locomotion only knows static ground). Now `setpieces.cabFloor` gives the locomotion the cabin floor inside its walls and a drop elsewhere, and `afterPlayer` carries your position in the cabin's frame. Lesson: never lock the player's position for a set piece in VR; test rides by actually moving.
- The powder cloud is `billow.js` (lit impostors, graded then premultiplied); the front body is lower and smoother underneath it. `cliffs.js`: buttresses and cliff bands on the face, the cornice, stratified rock walls in the gorge. Gazex lower on the face, hazard orange. Cabin interior textured (riveted panels, rubber floor). Gallery: no fog-out inside, snow heaps pile up in the openings, the tunnel is dark from both sides. Sodium light cones under the floodlights and the road light tower; packed-slush patches at doors and stacks; a warm glow behind the storm deck; fewer, more varied snowflakes; darker, bluer storm fog starting further out.
Review status after polish pass 2 (same 10 angles, except 10 now looks down the gallery toward the railcar; same calibration frames at 5.5–7.5): **4.8, 5.5, 5.5, 5.3**, up from the first pass's 5.0 plateau. Best frames: the Berghaus 6.5, the storm break and the gallery 5.5–6.0. Still open, in every round: the yard / courtyard / roof floors read as flat white (snow albedo is now ~0.75–0.85 but reviewers want ~0.7 with darker anchors in every frame); the face lacks couloirs and a cornice silhouette from the terrace (scale cues); the avalanche reads as puffs, not a menacing front (wants a dense dark-bellied front wall + a moving shadow + debris); the cable ride's gorge is still mostly haze; the HUD stacks SNIPER! over CABLE CUT!; the ragdolls on the falling cabin are in starfish poses.
Gameplay checks: every beat jumps cleanly with and without `noauto=1` (30/30, no page errors); the other six levels boot. The full autopilot runs found real-play blockers, all fixed:
- the walk mask had thin seams the locomotion treats as ledges: the Mittelstation doorway (the hall stopped at z 7, the yard started at 8 — you could not walk into the station), the foot of stair A, the landing onto the terrace, the roof walk into the gallery (`walkable` now has explicit joins; a node scan of the mask for 1 m seams is worth repeating after layout edits);
- after the cable car docked it rolled back once a head-in-cabin test (wrong frame) said you were out, and `riding` stayed true while it rolled — it carried you back down the line and parked you in mid-air at the pylon. `inCabin` now works in the cabin's own frame, the roll-back waits until you're really out, and `riding` is only true while it is carrying you;
- the autopilot wedged itself into prop pockets (the leg-1 van against the roadblock — moved; a crate on leg 3); nav cells now need the whole body on the walk mask; the autopilot side-steps / skips a goal when pinned, and its summit / run routes cross the landing instead of the terrace railing.
The cable ride's hit chance is ×0.22 (rifle) / ×0.4 (sniper laser) while riding.
Hard-surface pass (same branch, after Kenny: "most of the structure and buildings looked not polished — truck, cabin, facilities"):
- **Vehicles**: `groomer.js` replaces the box snowcat everywhere (the yard's machine, the burning wreck by the road with its glass gone, the court's cover): stadium track belts with cleats, a glasshouse cab, a curved blade on push arms, the tiller. The cable car is lofted from a rounded plan (belly, bumper, cream belt, crown roof with equipment box, carriage with two bogies, a framed sliding door, six panes).
- **The two halls** (`interior.js` `dressStation`, shared): cream lining over a green wainscot (they were bare black concrete boxes), the cabinet bank, steel doors with signs, extinguishers, benches, a ski rack, the route map, a clock, ticket gates, yellow guide rails along the docks, warm light pools under the sodium lamps (bucket floors don't get the terrain's baked pools), cold daylight panes and frames for the windows. The summit hall gets roof trusses (the Mittelstation's carriage rails run too close to its roof for them) and a daylight spill at the doors.
- **The Mittelstation**: its raking roof was pitched the wrong way (it rose to the south, leaving a 4 m slot of open sky over the front and a wedge over each side wall, so from the yard it read as a dark box): it now rises to the north over the cables, the side walls have gable infill, the north end has a mullioned glazed screen with slots for the hangers and a wall up to the roof. Pour-lift joints and a drip course outside, and the shared `concrete` material is lighter (0xdcd8d0; its shaded faces read black in the storm).
- **The yard**: the fuel tank is a cylinder with dished heads, hoops, saddles with straps, a catwalk with railings, a ladder, a manhole and vent, pipework, a valve, DIESEL / UN 1202 placards and a curved snow crust (it was a stretched capsule with a smeared stripe). The groomer shed has ribbed roll-up doors in steel frames with hoods, numbers, bollards, lamps, downpipes and a PISTENFAHRZEUGE sign.
- **The research block**: the name is on a fascia panel between the window rows (the letters ran behind the windows: "FORSCHUNGSSTA ION GRAUHO N"), a stone ground floor and a pale concrete upper storey with a string course.
Review after this pass (a fresh reviewer, the same 10 angles + 9 asset close-ups, the same calibration frames at 6.0–7.0): **assets 5.0, level 5.3** — "silhouettes and signage are there, surfaces still read as blockout with good labels". After it: the wreck charred only partly (its red shows) and nosed into the ditch, dimmer window panes, smaller shed lamp glows, snow banked at the shed doors. Still open on the hard surfaces: the snow floors around every building (blue AO at bases, drifts, trampled zones — still the top critique), the interiors want pipes / cable trays / grating / tracked-in snow, the black SUVs (shared vehicle paint near 0 value), the station ropes read as a dark plank where they enter the summit hall, a dark spike over the Mittelstation's bull wheel.
Headset checks needed: the big powder puffs at the avalanche (fill rate: `clouds` max is 200 on Quest, puffs every 0.06 s), the floor-pool and track decals (blended), the snowfall layers at eye distance, the cable ride's comfort (the view never rotates with the cabin; the sway is the cabin, not your head), the long run along the roof walk.
Driver VO: all 38 Level 7 lines are voiced (37 new Chatterbox takes + one line shared with Levels 3/6; Whisper-checked: 3 flagged, all spelling-only after one re-roll — "1500 meters", "hall rope / breaks"; built with the new keep-old-clips `build.py`, only the 37 new .ogg files added).

### Level 8: SAND CASTLES (door gunner in a helicopter on rails, a fictional Gulf megacity) — BUILT, merged (PR #22)
Code: `src/levels/sand-castles/` — see its `DESIGN.md` (beats, modules, comfort model, every URL flag, budget notes). Branch `level-8-dubai`, PR #22. In the menu as 08; `?level=sand-castles&beat=<intro|marina|blvd|haboob|gunship|strike|spire|escape|outro>`. The grey-box prototype stays URL-only at `?level=dubai-proto` as the tech bench.
What it is: you ride HAMMER ONE's open door with a pintle minigun (right hand; the left keeps the grenade launcher, which doubles as the laser designator) over **Al-Sarab**, a fictional city (no real towers or names). Hot late afternoon → the marina rooftops → Crescent Boulevard (HAMMER TWO is shot down) → a haboob rolls over the city → the WIDOWMAKER 4 duel inside the storm → the storm breaks into sunset, paint four flak towers for cruise-missile strikes → paint **SARAB SPIRE** (520 m + 160 m spire): floors blow out, it breaks and falls across the view, the spire tips at you, the pilot dives, its neighbour goes, the dust ring rises → limp home over the Gulf with an engine eating sand.
Decisions applied (from the brief):
- **72 Hz**, requested from the XR session (`&hz=`). **Staggered finale**: by the money shot the four strike targets and three escalation towers are already down behind the dust; only the Spire plus at most one neighbour fall together (escalation never lets more than two fall at once).
- **Low route between the towers** (the prototype's route=low, rebuilt as an open Catmull-Rom path through the real city). Altitude, speed and clearance are URL flags (`&alt=150&speed=34&clear=55` defaults); the tower plan re-solves round the path every load (min clearance at defaults ≈ 64 m, route ≈ 14.9 km). Perf panel behind `&perf=1` (`window.__perf()` returns the per-beat table).
- **Comfort**: fixed cabin frame, the rig rides the seat and code never moves the head; jerk-limited speed; yaw rate capped and further capped so v·ω ≤ 3 m/s²; bank ≤ 6°, pitch ≤ 2°; door-facing crab ≤ 50° at cruise. All tunable (`&bank &pitch &yaw &crab`).
Reused prototype tech: hero chunk collapse (`hero.js`, now with facades, fire at the break, LED-free grimy fins), mid-tower vertex rig (`midrig.js`, on real kit towers), the far-skyline ruin swap behind the dust ring (now city-wide through a per-tower ruin-height texture), overhead dust shading (`OverDust`, imported; the level overrides `plume()` with soot), the perf panel.
New tech worth reusing: one facade shader for every surface (fwidth-faded, no moiré) with a **city-wide 2.5D sun-shadow march** over a 1 byte = 3 m height map (the same idea as Tokyo's `sunshadow.js`, done inside the facade/ground shaders), roof contact shadows from the same map, a haboob shadow that darkens the city ahead of the front; procedural tower kit (8 plan shapes, podiums, roof features) merged into one draw; an analytic ground shader (Gulf, canal, palm island, dunes, street grid, boulevard, sand drifts); the rail with hold/hover braking.
Shared-file changes: `src/levels/index.js` (registry), `src/player.js` (`g.autoRange` / `g.aimRange` overrides for the autopilot, defaults unchanged), `src/audio.js` (`warn_tone`, `minigun` / `minigun_spin` loops, Level 8 bake set), `src/levels/dubai-proto/debug.js` (hint text hooks), `tools/vo/gen.py` (pronunciations), `tools/vo/lines.json`, `src/vo-manifest.js` + `public/vo/` (34 new lines).
Review status (fresh reviewer each round, same 11 Level 8 frames, calibrated against L5 quay/collapse and L6 crossing/gas):
| Round | L8 | L5 | L6 | What changed |
|---|---|---|---|---|
| r1 | 5.0 | 7.1 | 6.4 | first full build |
| r2 | 5.6 | 7.0 | 6.3 | late-afternoon light, facade grime, ambient war (distant blasts, flak, burning roofs), continuous haboob, seamless storm horizon, finale framing |
| r3 | 5.7 | 6.8 | 6.0 | AA guns merged (185 → ~60 draws), glazing noise fixed, bigger gunship |
| r4 | 6.0 | 7.0 | 6.3 | haboob billows + storm shadow on the city, soot smoke, fire at the Spire's break, palms, warmer light, darker gun |
| r5 | 5.9 | 6.8 | 6.2 | own rotor disc no longer a grey arc across the sky, lobed dust ring, bevelled gun, bigger gunmen, deeper golden light |
| r6 | 6.1 | 6.8 | 6.3 | bigger gunship, thicker tracers, banner above the kill, wind-flattened storm billows (haboob +0.4; nine frames unchanged) |
Honest read: **procedural art has plateaued here at ~6.0 (6.0 → 5.9 → 6.1 over the last three rounds, inside reviewer noise): ~0.7 under Level 5, within ~0.2 of Level 6. It is not level with the best levels.** Every round rates the wide vistas (intro over the Gulf, the boulevard canyon, the sunset dust bank) as the best establishing shots in the game; what keeps it down is the same engine-level limit Levels 3–5 hit: puffy sprite smoke ("cotton balls"), collapses that read as boxes, and enemies that are a few pixels from a door 100 m up.
Open issues (by impact, from rounds 4–6):
- Combat readability: rooftop gunmen are still tiny at 100 m (now 2× scale); no frame shows the minigun firing. Ideas: a red smoke flare on each squad's roof, rim-lit gunmen, mid-fire review frames, the RPG with a thick trail.
- The FX: haboob / collapse smoke reads as cumulus puffs; the collapse reads as box chains. The next real jump is a different smoke renderer (noise-eroded or raymarched) or authored fracture, not more tuning.
- SARAB SPIRE needs a heroic silhouette (setbacks, a needle crown, gold glass) — it is a tapered stack of boxes up close.
- Repetition: crowns and tower types repeat in the wide sunset shots; more silhouette types (sky-bridges, sails) and roof clutter would help.
- The cabin is plain (no wear, no warm spill falloff).
- Ground: the 2.5D shadows are hard-edged at 3 m per texel (they read as stains from 120 m up), and the sunset ambient gives the streets a lavender cast.
- Sunset light reads lavender away from the sun; the afternoon still reads close to neutral at 720p.
Driver VO: 34 new lines, Chatterbox takes Whisper-checked; five bad takes re-rolled with pronunciation fixes (`Haboob` → "Huh-boob", `SARAB SPIRE` → "Sa-rahb Spire"). Built with only the Level 8 takes and merged into the manifest (other levels' clips kept as built).
Pre-merge sweep: all seven other levels boot from the URL with no page errors, and every Level 8 beat jumps cleanly with and without `noauto=1` (18/18; `outro` reaches done).
Budget (desktop, per eye): ~40 draws cruising, ~60 in fights; ~300k triangles at the marina (city ~92k, low-rise ~40k, fallers + hero ~30k, skinned gunmen are the rest). `&shadows=0` is the first lever if the GPU is short.

**Quest 3 test plan (Level 8).** Quest Browser; the level asks for 72 Hz (13.9 ms). Add `&perf=1` for the bulkhead panel (per-beat table: avg fps, worst ms, % frames over 20.8 ms); `window.__perf()` over remote devtools returns it as JSON.
1. Full play-through: `?level=sand-castles&perf=1`. Photograph the panel table at the end. Pass = every beat avg ≥ 71.5 fps and < 1% misses; the heaviest beats are `strike` (towers falling + dust + flak) and `spire` (hero chunks + glass + dust ring + neighbour).
2. If a beat fails, jump to it and isolate one flag at a time: `&beat=spire&shadows=0` (the sun-map march in every facade / ground pixel), `&dust=low`, `&fill=2`, `&glass=0`, `&traffic=0`.
3. Route at rooftop height: try `&alt=120`, `&alt=180`, `&speed=26`, `&speed=40`, `&clear=40`, `&clear=80`. Note the panel's `clear` minimum and whether anything feels too close.
4. Comfort: three loops of the default; then `&bank=0`, `&bank=10`, `&yaw=5`, `&yaw=12`, `&crab=0`. Note any queasiness, especially in the hover pivots (marina end, spire) and the finale dive.
5. Door gun: does it go where your hand points, is the weight right, can you reach / see the full arc out of the door; brass pile and haptics.
6. Designator: paint a flak tower and the Spire (left trigger held). Lock in ~1.5 s?
7. Readability: can you see the rooftop gunmen at ~100 m? The RPG rockets coming? The waypoint?

### Dubai prototype (Level 8 tech test) — merged (PR #14), NOT a level
Grey boxes only, built to find out whether the Level 8 finale fits a Quest 3 before Tokyo and the mountain get built. URL only: https://kungfukennyog.github.io/bayhem-vr/?level=dubai-proto (registered with `hidden: true`, so it is not in the menu and never offered as "next level"). Code: `src/levels/dubai-proto/`. Its `DESIGN.md` lists every module, control and URL flag. Nothing outside that folder changed except the registry in `src/levels/index.js`.

**What it does.** A door-gunner heli loops the city (radius ~640 m, ~250 m up, 38 m/s) with the open door facing the centre. The scene has:
- **The hero, THE SPINDLE** (470 m + 130 m spire): about 150 chunks on a 30-node CPU spine. Floors blow out down the face toward the heli with a glass waterfall, the spire shears off and tips toward the heli, the stump pancakes, and the upper chunks detach into rigid bodies.
- **6 mid towers** (tilt, pancake and lean) in one draw through a vertex-shader rig.
- **48 far towers** that swap to ruins behind a horizon dust wall.
- **Overhead dust:** DustClouds re-shaded for a top-down view.
- **A perf panel** on the cabin bulkhead.

The worst case (left grip, key 1, or `beat=worst`) drops all mid towers and the hero at once, forces `dust=high`, throws a dust sea of 10 huge puffs over the centre and raises the far wall.

**Measured in the cloud sandbox.** It is software-rendered, so there are no fps numbers here, only counts:
- Draw calls: 32 idle, up to 45 worst, per eye. In WebXR, three r170 draws every object once per eye, so expect about 2× on the headset.
- Triangles: 52–80k at `detail=1`, 280k at `towers=12&far=160&detail=4`. Hero 9.8k, mid 1.9k at `detail=1`.
- Shared fx particles: peak ~1 150 / 4 200, big sprites capped by `bigBudget`. Clouds: 240 / 240 at high. Glass shards: up to ~1 200.
- **Dust fill estimate peaks at 3.5–4.2 screens of blended dust**, a few seconds into the worst case and when the heli looks across the dust sea. This is the number to watch.
- Shader programs stay constant from load to the end of the worst case (29). Sun shadows were turning one on mid-collapse: a depth program for the shared fx debris. They are off in this level now (`&shadows=1` to compare): the shadow frustum follows the rig (~140 m), so from 250 m up it shadows nothing in the city anyway.
- Comfort numbers on the default loop:
  - yaw rate ≤ 5.1°/s;
  - lateral acceleration ≤ 3.6 m/s², mostly the steady centripetal pull of circling;
  - smoothed jerk ≤ 0.4 m/s³;
  - bank ≤ 6°.

  The first version used random spline knots: 16°/s yaw and 10 m/s² (1 g) lateral. A smooth parametric loop fixed that. The default 200-division arc-length table on a 4 km loop also gave the speed a small step every 20 m (micro-stutter), so it is now 1 m.
- Far swap: 48/48 (and 160/160 at `far=160`) swap while the wall is opaque in front of them. The red `swapdebug` ruins only show once the wall thins about 40 s later. No pops in any capture.

**First Quest 3 run (Nov 5, 2026, default flags, `beat=cycle` + one manual worst case):**
- **The Quest Browser runs WebXR at 90 Hz** (11.1 ms), not 72. The panel now reads the session's real rate and sets its budget from it.
- **Steady state is at 90 fps** in idle, hero and settle: hero 89.9 avg (worst frame 20 ms), settle 89.8, with 199 clouds at `high` on screen.
- **Worst case (manual):** 76.2 avg, worst frame 34 ms, 0.3% of frames over 20.8 ms. That's above 72 fps but not at 90: roughly 13 ms frames when everything falls at once with full dust, in grey boxes.
- **The idle and mid rows were contaminated:**
  - idle 68.9–71.1 avg with 197–427 ms worst frames, mid 69.5 with a 326 ms worst frame;
  - the timeline started on page load, so those rows included the menu in the 2D window and the XR session-start hitch;
  - fixed: a run now starts (and the table resets) when play starts, and the first 1.5 s isn't recorded.
- **Draw calls in the headset:** 70–76, about 2× the desktop count, as predicted (no multiview).
- **CPU:** 3.6–4.2 ms. The GPU timer isn't exposed in Quest Browser (`gpu n/a`).
- **Dust fill estimate:** v1 read 16–23 "screens" at a steady 90 fps, so it was wrong. It divided by depth along the view axis and blew up peripheral puffs. It's now angular area over the eye's field of view, an upper bound. **Overdraw was not the problem I expected:** full dust in view holds 90 fps.

- **The far-swap pop seen on that run** was most likely the harness reset: every reset put the whole skyline back and removed the wall in one frame. Resets now happen behind a 0.85 s fade to black. If a tower is still caught switching, that's a real bug in the swap.

**Decision (Nov 5): Level 8 targets 72 Hz with a staggered finale.**
- Grey-box worst case is ~13 ms (76 fps), i.e. it would need ~15% cut to hold 90, before any art.
- At 72 (13.9 ms) it already passes with everything falling at once, but the real art (window textures, emissive floors, more triangles) will eat that margin. Staggering the finale buys the rest.
- A seated heli ride at 72 Hz is comfortable; it's the Quest's own default for most apps.
- The prototype now asks for 72 by default (`hz=90` to compare).

**Second Quest 3 run (Nov 7, orbit, 72 Hz, clean measuring):** idle, mid, hero and settle all pass: 71.9 fps avg in every row, worst frames 23–36 ms, misses 0.1–0.3%. CPU 4.0 ms, 78 draw calls, 163k triangles. The orbit holds 72 with one tower falling at a time. The screenshot was taken before the auto worst-case beat, so everything-at-once at 72 Hz is still unmeasured (it was 76 fps at 90 Hz on the first run, so it should pass).

**Low route (`&route=low`, added Nov 5).** The Level 8 plan says to fly low between the towers rather than orbit, since destruction reads small from 400–600 m.
- What it does: weaves between the mid towers at rooftop height (~150 m, 30 m/s), passing 50–70 m from tower faces. Mid towers fall away from the path, the hero falls square across the view, and the panel shows a live clearance (closest tower or chunk) and its minimum.
- Sandbox comfort numbers: yaw ≤ 9.2°/s, lateral ≤ 4.5 m/s², smoothed jerk ≤ 2.2 m/s³. The orbit is 5.1 / 3.6 / 0.4. The weaving is the cost; still gentle by VR standards, but it needs a headset check.
- **Next headset run:** `?level=dubai-proto&route=low`, two loops. Up close, collapses and dust fill much more of the screen, so expect this to be the expensive case.

**Test plan for the Quest 3** (Quest Browser, 72 Hz, budget 13.9 ms). For each run, photograph the per-phase table on the bulkhead panel, or call `__perf()` over remote devtools.
1. `?level=dubai-proto&beat=idle`, 30 s: the baseline (sky, ground, 6 + 1 towers, far skyline, cabin, escort). If this fails, the base scene is the problem, not the finale.
2. `?level=dubai-proto` (beat=cycle), two full loops (~4 min): the table gets idle / mid / hero / settle / worst rows. **This is the main run.**
3. If `worst` fails, isolate it, one flag at a time:
   1. `beat=worst&dust=off`: geometry + rigs + fx without dust.
   2. `beat=worst&glass=0&fx=0`.
   3. `beat=worst&dust=low`, then `dust=mid`.
   4. `beat=worst&fill=3`, then `fill=2`. Does a fill cap save it, and does it still read as a dust sea?
   5. `beat=worst&occl=0`. If fps goes up, the occlusion CPU costs more than the overdraw it saves.
4. From the best passing config, push until it breaks: `towers=9`, `towers=12`, `detail=2`, `detail=4`, `far=160`.
5. Comfort: `beat=idle&bank=0`, then `bank=6` (default), then `bank=12`, then `speed=55`. Ride three loops each. Note any queasiness and whether looking down past the skid is OK.
6. `hz=90` with the best passing config (11.1 ms budget).

Pass / fail per phase (miss = a frame longer than 1.5× budget, i.e. > 20.8 ms at 72 Hz):
- **Pass:** avg ≥ 71.5 fps and miss < 1%. If the browser exposes the GPU timer, GPU ≤ 11 ms (headroom for the real art). The `progs` count must not change after load (a change = a compile hitch).
- **Marginal:** avg 68–71.5 or miss 1–3%. The scale-down levers below should fix it.
- **Fail:** avg < 68 or miss > 3% in any phase the player will actually see.
- **Comfort:** fails if three loops at that bank/speed make you queasy.

**My expectation (honest, not measured).** Geometry, draw calls and CPU look comfortable: two instanced draws plus one merged draw carry all the towers. Fill rate is the risk.
- `dust=high` in the worst case, with an estimated 3.5–4 screens of blended full-res dust on top of the scene, will probably miss 72 on the Quest 3.
- `mid` is borderline.
- The horizon wall and the far swap are cheap: 1 + 2 draws, and the swap is a few hundred vector ops time-sliced over 4 frames.

**If it doesn't fit, scale the finale down in this order:**
1. **Cap the dust fill** with `fillBudget` (~2 screens). Sell density with fog instead of layers: pull `scene.fog` in toward the dust colour as the sea spreads (Level 3's `fogMix`), so the far half of the city is fog, not puffs.
2. **Stagger instead of "everything at once".** The Level 8 plan already says one tower every 30–60 s. The finale only needs the hero plus 1–2 mid towers falling at the same moment; the rest can be down already, behind the wall.
3. **Fewer, bigger puffs only near the heli.** Let the HorizonWall (one layer) carry everything past ~900 m. Add a second, nearer ring wall rather than more puffs.
4. **Hero glass and fx:**
   - From 400–600 m, 1 m shards are sub-pixel; they're 2.5–3 m sheets here and still read as glitter at best. Keep glass on the face toward the heli only, or swap it for a sparkle sprite sheet.
   - The shared `fx.explosion` balls read as small dark blobs at that range. Floor blow-outs need a custom big-but-cheap sprite (one flash card per floor), not the ground-level explosion stack.
5. **Rendering scale:** `framebufferScaleFactor` 0.9 or dynamic foveation during the finale only (main.js sets foveation 1 already).

**Open questions.**
- Does Quest Browser expose `EXT_disjoint_timer_query_webgl2`? If the panel says `gpu n/a`, judge by the fps and miss columns.
- Multiview: three r170 doesn't use `OVR_multiview2` in WebXR, so every draw call is issued twice. Check whether a newer three release adds it before the real Level 8; it would halve the draw-call CPU cost of a busy skyline.
- Does the DustClouds occlusion grid cost more CPU than it saves with 240 *huge* puffs? It loops angular cells per puff, and huge near puffs cover many. That's the `occl=0` test.
- Sort popping: DustClouds sorts by distance every frame. With 200–400 m puffs overlapping at similar distances, the order flips as the heli moves, which may read as flicker. Watch for it in the headset. It doesn't show in stills.
- The ring wall reads as a uniform band with a bright crest. It works as an occluder but needs real art (layered rings, a lit rolling crest, puffs riding the top) before the level.
- The mid-tower crush mound is a grey-box stand-in; it's hidden by the skirts at default dust and visible at `dust=off`.
- On the headset: open the Pages URL above in the Quest browser and add the flags (bookmark the test-plan variants). For live reload and `__perf()` over remote devtools: `npm run dev`, `adb reverse tcp:5173 tcp:5173`, then http://localhost:5173/?level=dubai-proto on the Quest.

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
