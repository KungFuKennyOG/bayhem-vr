# BAYHEM quality bar

Read this before building or polishing a level. It collects what four levels of independent reviews and the first Quest 3 playtest taught us. `HANDOFF.md` has the per-level history; `CLAUDE.md` has the code gotchas.

## The bar
- **Look:** polished PS2-era AAA (think *Black*, *Killzone*, *Medal of Honor* era), all procedural. Michael Bay tone: golden-hour light, big readable explosions, slow-mo, radio chatter, constant motion.
- **"Done" means an independent reviewer scores it close to 10/10.** In practice, aim for at least 8 before calling a pass finished. Level 4 ended at 8.0. Levels 2 and 3 plateaued around 6–6.5 and their notes say why.
- **Be honest about plateaus.** If three passes in a row don't move the score, say so and name what would (authored meshes, engine-level FX work), rather than polishing in circles.

## The review loop (Kenny's rule)
1. Take **screenshots, not videos** (`tools/shot.cjs`). Use fixed camera positions so before and after line up: player height, the angles a player actually sees, and the heaviest spectacle moment.
2. Give a **fresh** reviewer agent only the images and this bar, never your own conclusions. Ask for scores, the top problems by impact with concrete fixes, and anything that got worse.
3. Fix what it says, re-shoot the same angles, and review again until it's close to 10 or genuinely plateaued.
4. Record the score history and the open issues in the level's `HANDOFF.md` section.

## VR first: it's played in a headset
These came out of the first Quest playtest. Desktop testing hid all of them.
- **You can't steer the player's head.** `game.cinematicLook` only works on desktop and in trailers. In VR a big moment has to earn the look:
  1. Put the player somewhere the set piece is visible.
  2. Point the waypoint at it and have the radio call it out ("LOOK DOWN THE AVENUE!").
  3. Wait until the player is actually looking (head direction plus line of sight, with a timeout of about 5 s), then trigger it.

  See Level 3's `collapse` beat.
- **Spectacle first, objective after.** Don't show "RUN TO X" before or while the big thing happens: players chase the waypoint and miss the show. Show the objective about 1–2 s after the money shot.
- **Head pose:** always use `game.headPos` or the user `camera` under the rig, never `renderer.xr.getCamera().getWorld*()`, which returns tracking space. This one bug made every enemy aim at the level origin.
- **Comfort:** smooth stick movement plus 45° snap turn, the comfort vignette (toggle in `settings.js`), and never move the player's head from code in VR.
- **Enemies must read as smart up close.**
  - They face the player whenever they know where the player is, and run sideways with the gun on target between covers.
  - They only turn their back once they've lost track of the player.
  - Use contact shadows, and `setGunmanLook` so they don't vanish against dark scenery at dusk.
- **Test the real-play path, not just the autopilot:** add `noauto=1` to the screenshot query. The autopilot and trailer code paths can hide broken beat logic.
- **Scale and distance:** guns, doorways, stair heights and the truck bed must feel right at 1:1. Anything that "reads small at 720p" reads smaller in a headset.

## What reviewers keep marking down (check before every review)
- **Lighting:**
  - Flat, uniform exposure.
  - No corner darkening where walls meet floors and ceilings.
  - Lamps that don't throw light pools.
  - Backlit objects crushing to black (the global rim light helps; don't fight it).
- **Too clean:** spotless "freshly installed" surfaces. Bake grime gradients at the base of walls, water and rust streaks, wear on edges and floors, litter. Vertex colours are free on Quest.
- **Saturation:** saturated primaries everywhere look like a cartoon. Keep accents (signs, safety yellow) small, worn and dirty.
- **Repetition:** identical props, buildings or signs in a row. Vary them with seeded colour, scale and rotation, and skip some instances.
- **Readability:** details that exist but read too small (mooring lines, fenders, beacons, puddles). Scale them up for VR distances.
- **Dead ends:** blank walls, empty backdrops, corridors ending in a flat wall. Always hint at more beyond: a recess, a light, a skyline, smoke columns.
- **Consistency:** texture scale must match across adjacent surfaces (use world space). No shading creases from bad normals. Text on every sign instance, with no blank or noisy placeholder textures.
- **Explosions and FX:**
  - Smoke trails that look like a string of beads (use `fx.trailEmit`).
  - White blow-outs at dusk (use `fx.heat` and `fx.fireHue`).
  - Square sprite edges.
  - Puffy fireballs with an olive fringe.
- **Viewmodels:** guns too big or toy-like, or pointing backwards (`lookAt` faces +z, so `rotateY(Math.PI)`).
- **Thin bright lines:** unlit cream or white handrails and cables glow like laser beams. Give them thickness, a dark metal material and brackets.
- **Combat spaces:** sparse areas need props that double as cover, with colliders.

## Quest 3 budget (non-negotiable)
- No screen-space post-processing. Grade, rim light and glows live in material shaders or sprites.
- Use instancing or merged geometry for repeated props. At most 2 draw calls per character.
- Fixed light pool (`fx.light` plus lights created at load). Never add or remove lights at runtime. Bake lighting into vertex colours where you can.
- Overdraw is the bottleneck. Keep particles in the shared batches under `bigBudget`, cap sprite sizes, and halve spawn rates on Quest.
- Warm up every new material through the level's `warm` group.
- Verify on the headset at the heaviest moment of each level (finale, crash, collapse).

## Spectacle and pacing
- A "holy shit" beat every 30–60 s, building to a finale with slow-mo.
- Radio lines from the driver to set up the next beat. At most one big and one small callout on screen at a time.
- Every finale ends on a title card with the level's stats.

## Pre-merge checklist
- [ ] `npm run build` passes, and all four levels boot from the menu with no page errors.
- [ ] Every beat jumps cleanly with `?beat=`, tested with and without `noauto=1`.
- [ ] Fonts load: don't symlink `node_modules` from outside the repo, or Vite returns 403 and the screenshots show Arial.
- [ ] The independent screenshot review was done, and the score history and open issues are in `HANDOFF.md`.
- [ ] No shared-engine change breaks another level: re-shoot one frame per level.
- [ ] Note anything that still needs a headset check.
