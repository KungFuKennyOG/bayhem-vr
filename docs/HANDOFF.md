# BAYHEM: handoff for the next levels

BAYHEM is a WebXR VR shooter for Meta Quest 3 built with three.js r170 and Vite. The target is Michael Bay spectacle at a polished PS2-era AAA look. Everything is procedural: there are no model, texture or audio files.

## Status
- **Level 3, "Downtown Haven City" (on foot, glass canyon at sunset), is done** — see its section below and `src/levels/downtown-haven/DESIGN.md`.
- **Level 2, "Port of Victory" (on foot, docks at dusk), is done** — see its section below and `src/levels/port-of-victory/DESIGN.md`.
- **The repo is multi-level:** shared engine in `src/`, one folder per level in `src/levels/<id>/` (lazy-loaded), a level-select menu, `?level=<id>` in the URL.
- **Level 1, "The 405 Job" (freeway chase), is done.** The player rides in a pickup bed.
  - Five beats: SUV wave, SUV wave plus one from ahead, fuel tanker, a four-SUV box-in, then the gunship "WIDOWMAKER", which crashes ahead of the truck.
  - It has animated skinned soldiers with ragdolls, hero guns with gloved hands, a procedural adaptive score and SFX, an in-shader color grade and rim light, and slow-mo.
- **Source:** GitHub `KungFuKennyOG/bayhem-vr` (branch `main`).
  - It deploys to GitHub Pages at https://kungfukennyog.github.io/bayhem-vr/ once Pages is set to "GitHub Actions" in the repo settings.
  - Start a new chat with: "continue BAYHEM from KungFuKennyOG/bayhem-vr, build <level>".

## Decisions made (apply to all levels)
- **Locomotion for the on-foot levels:** smooth thumbstick movement with a comfort vignette while moving, plus 45° snap turn.
- **Each new level gets its own chat.**
- **Engine:** stay in WebXR with three.js. Keep the art pipeline: procedural geometry and canvas/shader textures, with no screen-space post-processing. Grade, rim light and glows live in material shaders or sprites so they're free on Quest.

## Reusable modules (src/)
- **`collision.js`** (new): `CollisionWorld` (AABB grid: `pushCircle` for bodies, `raycast`/`visible` for bullets and line of sight, `groundAt` for floors/ramps/box tops, `collidePoint` for particles) and `NavGrid` (A* + string pulling, dynamic blockers).
- **`locomotion.js`** (new): smooth stick/WASD movement relative to the head, comfort vignette, 45° snap turn around the head, ground following, no walking off ledges; room-scale intrusions into walls push the rig back.
- **`soundbus.js`**: the live/recording audio bus (was in main.js).
- **`atmosphere.js`:** sunset sky shader, sun-aware fog, PMREM environment. The global shader patches add the color grade (`bayGrade`), fog toward the sun, and a sun rim light on every lit material.
- **`particles.js`:** a GPU-generated FX atlas with 64-frame fire and smoke flipbooks, plus an instanced billboard renderer that draws in one call and supports stretched sparks.
- **`fx.js`:** layered explosions (flash, fireballs, mushroom, oily smoke, sparks, embers, debris, shockwave ring, scorch decal, pooled lights). Also tracers, muzzle flashes, casings, and `trailEmit` for continuous smoke trails.
- **`characters.js`:** sculpted skinned `Gunman` soldiers (window, roof and **ground** poses: stand, crouch, walk/run/strafe gait with 2-bone leg IK, peek lean, low-ready run, grenade throw; aiming, fire, hit, reload; 3 headgear variants; one draw call each), the verlet `Ragdoll` (moving road, or `Ragdoll.world` = a CollisionWorld so bodies land on decks/roofs and go to sleep; Level 1 also pushes ragdolls out of car bodies via `game.collideRagdoll`), and the animated sidekick `Driver` + `DRIVER_SEAT`.
- **`weapons.js`:**
  - `buildRifle` and `buildLauncher` with gloved hands and animations (bolt, mag swap, drum, ammo counter).
  - The `Gun` state machine.
  - `VR_HOLD` offsets for the Quest controllers, which still need tuning on a headset.
- **`audio.js`:** `AudioSystem` (procedural SFX, loops, 128 BPM D-minor adaptive score, stingers, bullet-time) and `renderOffline` for trailers.
- **`physics.js`:** a small rigid box against a moving ground plane. On foot, the ground velocity is 0.
- **`hud.js`:** world-space callouts, subtitles, score panel, boss bar, vignettes.
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

## Level briefs

### Level 2: PORT OF VICTORY (on foot) — DONE
Built as briefed. Code: `src/levels/port-of-victory/` (`layout.js` maze + positions, `world.js` environment/lights/collision, `ai.js` soldiers, `game.js` combat, `setpieces.js` crane/forklift/ship finale, `director.js` beats, `auto.js` demo autopilot; assets in `ship.js`, `containers.js`, `props.js`). Beats: intro at the wreck → gate → maze (two waves, lights flicker on) → RTG crane drops a box on you (shoot the operator) → apron forklift with fuel drums → board the ship → shoot the fuel manifold → escape down the gangway → mushroom fireball in slow-mo → outro. Golden hour → blue hour is driven by `game.dusk` (`atmosphere.applyDusk`). Test any beat with `?level=port-of-victory&beat=<name>`.
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
Original brief:
- **Setting:** a canyon of glass towers, abandoned traffic, and smoke columns from the earlier chaos.
- **Beats:**
  1. Street war down an avenue against rooftop snipers with laser sights.
  2. A gunship returns.
  3. Clear a lobby with collapsing glass.
  4. Finale: a skyscraper collapses down the avenue and you sprint ahead of the dust wall in slow-mo, diving into a subway entrance.

### Level 4: AIRPORT NO RETURN (on foot, ending in a vehicle)
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

## Quality bar and lessons from Level 1
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
