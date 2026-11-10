# Level 8 — SAND CASTLES (`?level=sand-castles`)

Gunner (minigun in hand) on **HAMMER ONE**, a utility helicopter on rails, over **Al-Sarab** — a fictional Gulf megacity (no real towers or names). Hot, hazy afternoon → a haboob swallows the city → the storm breaks into sunset. The finale is staggered: by the money shot most towers are already down behind the dust; only the hero (**SARAB SPIRE**) and at most one neighbour fall at the same moment. Runs at **72 Hz** (requested from the XR session).

The grey-box tech test stays at `?level=dubai-proto` (URL only). This level reuses its tech: the hero chunk collapse (`hero.js`, adapted), the mid-tower vertex rig (`midrig.js`, now on real kit towers), the swap-proof horizon dust ring (`storm.js` `HorizonWallC`, re-centred), the overhead dust shading (`OverDust`, imported unchanged), the rail comfort model (`rail.js`, open path) and the perf panel (`PerfPanel`, imported, behind `&perf=1`).

## Beats (`&beat=<name>`)
| Beat | Where | What happens |
|---|---|---|
| `intro` | over the Gulf, the palm island below | Title through the open door (the pilot crabs so the door faces the skyline). HAMMER TWO flies on your right. |
| `marina` | the canal | Three rooftop squads (pool deck, helipad with an RPG team, stepped deck). The heli turns its door to each roof and hovers at the end of the canal until they're down (timeout). |
| `blvd` | Crescent Boulevard (the 14-lane canyon) | Three more roofs. The pilot pulls HAMMER TWO onto the door side, then an RPG from the far roof takes it down (look-gated, slow-mo) and it spins into the boulevard; a smoke column marks it for the rest of the level. |
| `haboob` | turning south | "Look south. ...That's not smoke." A 900 m wall of sand rolls north across the city; puffs ride its crest. The storm look starts while the wall is ~750 m off and is full ~400 m inside it, never faster than 10 s (the reflection map steps day → haze → storm), so it rolls over you instead of switching on. |
| `gunship` | inside the storm | WIDOWMAKER 4 duels you off the door side (station-keeping ahead / abeam / above), chin-gun bursts and shootable rockets. Killed, it spins into whichever of the five crash towers (`C1`–`C5`, ~180–210 m out on the door side along the storm leg) is in front of the door with a clear sightline; the pilot keeps the door on it (braking if it's off to one side) and the tower comes down across the view. |
| `strike` | the strike loop round the business district | The storm passes, the sun drops. The laser designator (left hand) paints four flak towers (AA guns, flak bursts round the cabin): hold until it locks, cruise missiles come in from the Gulf, the tower falls. Escalation towers fall behind the dust, one every ~22 s, never more than two at once. |
| `spire` | a hover north of the Spire | Paint the SARAB SPIRE. When you're looking, floors blow out down its face, it breaks and falls east across the view, the spire tips toward you, the pilot dives, its neighbour goes, the dust ring rises round the downtown. |
| `escape` | north to the Gulf at sunset | Master caution, number two engine eating sand. The far city swaps to ruins behind the dust ring. |
| `outro` | over the sea | Title card with stats. |

## Modules
| File | What |
|---|---|
| `layout.js` | URL flags, the land (coast, marina canal, palm island, the boulevard, the grid), the route (control points with beat tags), the tower plan: towers are placed on grid lots and kept `clear` m from the path at its height (lower ones may pass under it); fight towers sit off the door side below the path; the specials (targets, crash tower, fallers, the Spire's neighbour). |
| `facade.js` | The facade shader for every tower surface (curtain wall / clad / roof / plant / crown fins + LED / helipad / pool / deck / podium / ruin), fwidth-faded so it never moirés; the 2.5D sun-shadow march over a tower height map (`SunMap`, 1 byte = 3 m). |
| `towerkit.js` | Procedural towers as raw attributes: box, chamfer, round, tri (Y plan), twist, stepped (setbacks), slab, sail; podiums, parapets, roof features. |
| `city.js` | All static towers in one merged draw with a per-tower ruin height (float texture: the vertex shader crushes anything above it into a sooty stump, so any tower can be swapped behind the dust); the low-rise fabric + palm villas (instanced facades); the far ring (intact / ruined instanced); aviation beacons. |
| `ground.js` | One ground plane: the Gulf (deep → turquoise shallows, waves, foam), the canal, the palm island, desert dunes, the street grid and the boulevard drawn analytically, city-wide shadows. Instanced traffic, palms, yachts, the metro viaduct. |
| `sky.js` | Sky shader (afternoon haze / sunset / haboob), three baked reflection environments, `applyLook(sunset, storm, elevation)`. |
| `helimodel.js` | HAMMER — lofted utility helicopter (your own and the wingman): fuselage, glazing, cowl, boom, fin, stabilator, tail rotor, stub wings with tank + rocket pod, wheels, rotor + blur disc, panel lines. |
| `cabin.js` | The cabin interior (quilted lining, ribs, troop seats, cargo net, extinguisher, red light, cockpit with pilots and lit displays). The lining is lit only where a ray to the sun leaves through the door opening. |
| `doorgun.js` | The minigun in your right hand (the model is `buildMinigun()` in `src/weapons.js`, the same kit as the rifle / launcher): replaces the right-hand rifle (the shared `Gun` state machine drives it), spins up, heats, cools down; the belt hangs to an ammo can at your right hip; brass piles on the floor. |
| `rail.js` | The open-path rail (see comfort below). |
| `game.js` | Combat: rooftop squads (rifles, RPG teams), rockets, grenades, AA guns + flak, WIDOWMAKER 4, HAMMER TWO, hit tests (generous spheres for men at range, towers as boxes in their own frame), the autopilot hooks. |
| `midrig.js` | The fallers: kit towers in one draw on the prototype's vertex rig (tilt / lean / pancake + crush mound). |
| `hero.js` | SARAB SPIRE: the prototype's chunked hero with facades on every chunk. |
| `storm.js` | `HorizonWallC` (the far dust ring), `Haboob`, `SandStreaks`. |
| `strikes.js` | The laser designator and the cruise-missile salvos. |
| `setpieces.js` | Orchestrates the above; burning smoke columns. |
| `director.js` | The beats. |

## Comfort (all from the URL)
- The cabin is a fixed frame: the rig rides the seat; code never moves the head.
- Speed: jerk-limited (≤ 0.7 m/s³, ≤ 1 m/s² along the path); holds brake at 0.8 m/s² into a hover.
- Heading: critically damped spring; the yaw rate is capped at `&yaw` deg/s and further so that v·ω ≤ 3 m/s² sideways; yaw acceleration is capped (no lateral-jerk steps). The door-facing crab is at most 50° at cruise, 115° in a hover (`&crab=0` disables it).
- Bank: a scaled coordinated-turn angle, capped at `&bank` (default 6°, 0 = horizon locked). Pitch: from acceleration, capped at `&pitch`.
- The finale dive: a vertical offset with acceleration capped at 2.5 m/s².

## URL flags
| Flag | Default | Meaning |
|---|---|---|
| `beat` | — | Jump to a beat (the world is put in the state it would be in). |
| `alt` | 150 | Route altitude (m); the whole height profile scales with it. The tower plan re-solves around it. |
| `speed` | 34 | Cruise speed (m/s); each beat flies a fraction of it. |
| `clear` | 55 | Minimum horizontal distance from the path to any tower face at path height (the plan moves / lowers towers to keep it). |
| `bank` / `pitch` / `yaw` / `crab` | 6 / 2 / 8 / 1 | Comfort caps (deg, deg, deg/s, on/off). |
| `hz` | 72 | XR display rate to request (0 = browser default). |
| `perf` | 0 | Perf panel on the cabin bulkhead (desktop: overlay; key 5 cycles cabin / float / off). `window.__perf()` returns the per-beat table. |
| `panel` | `cabin` | `cabin`, `float`. |
| `dust` | high (Quest: mid) | Overhead dust pool: `off`, `low`, `mid`, `high`. |
| `fill` | 0 (Quest: 2.5) | DustClouds fill budget in screens. |
| `shadows` | 1 | City-wide 2.5D sun shadows. |
| `traffic` | 320 (Quest: 180) | Cars on the roads. |
| `glass`, `swap`, `swapdebug`, `slowmo`, `occl` | 1, 1, 0, 1, 1 | As in the prototype. |
| `god` | — | Player damage × 0.2 (testing). |

## Budget notes
- Draw calls (desktop, per eye): ~40 cruising, ~50–60 in fights, more with many ragdolls (they're disposed after 9 s / 650 m).
- Triangles: city ~92k, falling towers + hero ~30k, low-rise ~40k, gunmen are the expensive bit (skinned).
- The facade + ground shaders march the sun map 18 steps per pixel: `&shadows=0` is the first lever if the GPU is short.
