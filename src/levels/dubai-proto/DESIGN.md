# Dubai prototype (`?level=dubai-proto`, URL only — not in the menu)

A tech test for the Level 8 finale, not the level. Grey boxes, no art polish. It answers one question on a Quest 3: can a door-gunner heli loop around a skyline where a hero supertall and 4–6 mid towers all come down at once, in a sea of dust seen from above, while the far skyline swaps to ruins with no visible pop, at 72 fps?

## What's in it
| Risk | Module | How |
|---|---|---|
| Hero collapse | `hero.js` | ~150 chunks (core + 4 facade slabs per 4-floor band, 8 spire pieces) in one instanced draw, riding a 30-node CPU spine (Level 5's twDeform idea: per-node position + rotation, hinge + whiplash bend above band 17). Floors blow out down the face toward the heli (shared `fx.explosion`) with a glass waterfall (Level 3 `glass.js` free-shard pool, one draw). The spire shears off and tips toward the heli. The stump pancakes; upper chunks detach top-down into tamed rigid bodies (Level 3 `_detach`). |
| Mid towers | `towers.js` `MidTowers` | All mid towers merged into one draw. Vertex-shader rig, 3 vec4 uniforms per tower: an upper section hinged on a break line, an extra drop for it, a whole-tower drop, and anything below ground crushed into a lumpy mound. Three modes: tilt, pancake, lean. No debris sim. |
| Ruined skyline swap | `towers.js` `FarSkyline`, `overdust.js` `HorizonWall` | Intact and ruined far towers are two instanced draws. The far dust sea is one ring mesh with an eroded crest. A tower swaps only when every sample point (base, middle, top, both edges, top + 25 m) is behind the wall's opaque body as seen from the current eye. The test uses the lowest possible crest minus the soft band, so it never depends on the noise. The wall thins to a haze about 40 s later and the ruins show through. |
| Overhead dust | `overdust.js` `OverDust` | Level 3/5 `DustClouds` (one instanced draw, own pool) with a replacement fragment shader for a camera that looks down: a deck term that darkens puffs low in the stack, a low-sun lit shoulder and cool shadow side, and a thin rim on the crests. `dustfx.js` itself is untouched. A per-frame estimate of the blended dust fill (screens' worth) goes to the panel. |
| Heli comfort | `rail.js` | Closed Catmull-Rom loop with a 1 m arc-length table. Jerk-limited speed (≤ 0.8 m/s², ≤ 0.6 m/s³). The heading follows a critically damped spring. Bank and pitch are capped. The heli runs on real time, so world slow-mo never drags the cabin. The rig rides the seat, and the head is never moved by code. The cabin is one merged draw; the escort WIDOWMAKER (`heli.js`) flies alongside. |
| Measuring | `debug.js` | The perf panel sits on the forward bulkhead, the left wrist, or floating (or is hidden). It shows fps, ms, the worst frame in the last 2 s, and a frame graph with the budget line. It also shows CPU (sim + render submit), GPU (`EXT_disjoint_timer_query_webgl2` if exposed), draw calls, triangles, shader programs, particle / cloud / glass / body counts, dust fill, far swaps, and the comfort numbers. A per-phase table gives avg fps, worst ms and the % of frames over 1.5× budget. `window.__perf()` returns the table as JSON (remote devtools). |

## Controls
- **VR:** left grip = WORST CASE, right grip = RESET, A = next mid tower, B = hero tower, X = dust level (off → low → mid → high), Y = panel (cabin → wrist → float → off). Triggers fire the rifle and launcher at the ground.
- **Desktop:** 1 worst, 0 reset, 2 mid, 3 hero, 4 dust, 5 panel.
- A button press takes over from the auto timeline until RESET. Manual phases show with a `*` in the table.
- A run (and the table) starts when play starts. Resets happen behind a short fade to black, which isn't recorded: a reset puts the whole skyline back, and done in the open it looks exactly like the swap popping.

## URL flags
| Flag | Default | Meaning |
|---|---|---|
| `beat` | `cycle` | Auto timeline. `cycle`: idle 14 s → mid towers every 4 s → hero → settle 26 s → reset → idle 6 s → worst → settle 40 s → reset, looping. `worst`, `mid` and `hero` loop just that set piece, and `idle` runs nothing. |
| `towers` | 6 | Mid towers (0–12). |
| `hero` | 1 | Hero tower on/off. |
| `far` | 48 | Far skyline towers (0–160). |
| `dust` | `mid` | `off`, `low` (60 puffs), `mid` (120), `high` (240). The worst case forces `high`. |
| `fill` | 0 | DustClouds fill budget in screens (0 = no cap). |
| `occl` | 1 | DustClouds occlusion cull (CPU) on/off. |
| `glass` | 1 | Hero glass shards on/off. |
| `fx` | 1 | Shared fx.js explosions on the hero on/off. |
| `detail` | 1 | Vertex density multiplier on every tower (2, 4, 8 emulate final-art meshes). |
| `swap` / `swapdebug` | 1 / 0 | Far swap on/off. `swapdebug` tints the ruins red so swaps are easy to spot. |
| `escort` | 1 | WIDOWMAKER flying alongside. |
| `speed` / `bank` / `pitch` / `alt` / `radius` | 38 / 6 / 1.5 / 250 / 640 | Rail: m/s, max roll in degrees (0 = horizon-locked), max pitch in degrees, altitude, loop radius. |
| `slowmo` | 1 | World slow-mo on the hero break. |
| `hz` | 72 | Ask the XR session for this display rate (72 = the Level 8 target; 90 / 120 to compare; 0 = browser default, which is 90 on Quest Browser). The panel's budget follows the session's real rate. |
| `panel` | `cabin` | `cabin`, `wrist`, `float`, `off`. |
| `shadows` | 0 | Sun shadows (off by default, see HANDOFF). |
| `gpu` | 1 | GPU timer queries. |

The test plan and findings are in `docs/HANDOFF.md`, section "Dubai prototype".
