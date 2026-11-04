# BAYHEM — notes for Claude

WebXR VR shooter for Quest 3 (three.js r170 + Vite). Michael Bay spectacle, polished PS2-era AAA look, **everything procedural** (no model/texture/audio files). Read `docs/HANDOFF.md` for the level roadmap and the decisions already made.

## Commands
- `npm run dev` (port 5173) · `npm run build` (dist/, deployed to GitHub Pages by .github/workflows/deploy.yml) · `npm run build:single` (one HTML file)
- Screenshots in the cloud sandbox (no GPU, SwiftShader ≈1 s/frame at 720p): `PRE="js" POST="js" node tools/shot.cjs "<query>" <outprefix> <frame,frame,...>` — renders only the listed frames, simulation runs without rendering in between. Query flags: `capture=1` (implied), `trailer=1`, `sandbox=1&yaw=..&pitch=..`.
- Trailer: build to `dist-capture/`, serve it on 5174 (not the dev server — HMR reloads break long captures), `node tools/capture.cjs <outdir>` → `video.mp4` + `audio-events.json`; then `node tools/render-soundtrack.cjs <events.json> <out.wav>` (needs the dev server for /src/audio.js) and mux with ffmpeg.

## Conventions / gotchas
- Deterministic: never `Math.random` in game code; use `rand/range` (seeded stream) or `makeRng(seed)` from `src/rng.js`.
- Level 1 is a treadmill: truck at the origin, world scrolls toward +z at `V`; "anchored" particles get `+dz`. On-foot levels should use ground speed 0.
- Global shader patches live in `src/atmosphere.js` (`bayGrade` color grade, sun-aware fog, sun rim light). Custom ShaderMaterials must include `<tonemapping_fragment>` + `<colorspace_fragment>` to get the grade.
- Fixed pool of 3 point lights (`fx.light`) — never add/remove lights at runtime (shader recompiles). Warm up new materials in `main.js` before gameplay.
- `Object3D.lookAt` points +z at the target; guns/vehicles face -z → `rotateY(Math.PI)` after lookAt.
- Fire/smoke particles are premultiplied: RGB = emission, A = smoke coverage. Use `fx.trailEmit` for moving emitters (no "string of pearls").
- Quest budget: no screen-space post, instancing for repeated props, ≤2 draw calls per character, keep particles in the shared batches.
- Get an independent screenshot critique before calling art "done".
