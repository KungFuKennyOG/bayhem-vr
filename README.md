# BAYHEM

A WebXR highway-chase shooter for Meta Quest 3, styled after a Michael Bay set piece: golden hour, black SUVs, flips, a fuel tanker and a gunship.

It's one self-contained level, "a highway chase in five explosions". You ride in the bed of a pickup doing about 110 km/h down an LA-style freeway:

1. SUV wave
2. SUV wave plus one coming back at you from ahead
3. A fuel tanker you absolutely should not shoot
4. A four-SUV box-in, with ramming
5. The gunship "WIDOWMAKER", which brings rockets, a chin gun and reinforcements. When it goes down it crashes on the road ahead, and the truck swerves through the wreck.

All geometry, textures, effects, music and sound are generated in code. There are no asset files.

## Run it

```bash
npm install
npm run dev         # http://localhost:5173 (desktop)
npm run build       # static site in dist/ (deploy to GitHub Pages / any HTTPS host)
npm run build:single  # one self-contained HTML file in dist-single/
```

WebXR needs HTTPS (or `localhost`). On a Quest you have two options:
- Open the deployed HTTPS URL in the Quest Browser and press **ENTER VR**.
- Or run `npm run dev`, then `adb reverse tcp:5173 tcp:5173` and open `http://localhost:5173` on the headset.

### Controls
| | VR | Desktop |
|---|---|---|
| Rifle (auto) | right trigger | left mouse |
| Grenade launcher (6-shot drum) | left trigger | right mouse |
| Reload | A / X | R |

Useful URL flags:
- `?demo`: watch it play itself (the same autopilot that recorded the trailer).
- `?trailer`: shorter, punchier pacing.
- `?seed=N`: a different deterministic run.
- `?sandbox&yaw=180`: no director. Free-fire range.

## How it's put together

| File | What it does |
|---|---|
| `src/main.js` | Renderer, XR session, frame loop, start screen, audio bus (live or recorded for offline render) |
| `src/director.js` | The scripted five-beat set piece, radio chatter, music intensity |
| `src/game.js` | Cars, enemy AI (slots, ramming, gunmen), hitscan, grenades, rockets, gunship, wreck physics, chain reactions, slow-mo, scoring |
| `src/world.js` | Treadmill freeway. The truck sits at the origin while the world scrolls past (no float drift, cheap). It also holds the sound walls, palms, overpasses, gantries, buildings and far skyline. |
| `src/atmosphere.js` | Sunset sky shader, sun-aware fog, PMREM environment, and shader patches. The patches add the Bay color grade (split-tone + S-curve) and a sun rim light per material, so they cost nothing in VR. |
| `src/particles.js` | GPU-generated FX atlas (64-frame fire and smoke flipbooks) plus a single-draw-call billboard renderer |
| `src/fx.js` | Explosions (flash, staggered fireballs, mushroom, oily smoke, sparks, embers, debris, shockwave ring, scorch decal, pooled lights), tracers, muzzle flashes, casings |
| `src/vehicles.js`, `heli.js`, `characters.js`, `weapons.js` | Procedural models |
| `src/physics.js` | Small rigid-body box solver against the moving road (flips, tumbling gunmen, flying wheels) |
| `src/audio.js` | Procedural Web Audio SFX + adaptive score, with an offline renderer for the trailer soundtrack |
| `tools/capture.cjs`, `tools/render-soundtrack.cjs` | Deterministic frame-by-frame trailer capture (headless Chromium → ffmpeg) |

VR hold tuning: if the guns sit oddly in your hands on the headset, tweak `VR_HOLD` at the top of `src/weapons.js` (offset from the Touch controller's aim ray, in meters/radians).

Performance notes for Quest: there is no post-processing. The grade, rim light and glows all live in material shaders or sprites. The renderer uses a fixed pool of 3 point lights, so explosions never trigger shader recompiles. Particles are instanced, and lower particle and shadow budgets are picked automatically on Quest.
