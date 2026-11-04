# Driver voice-over

The one exception to "no asset files": the driver's radio lines are pre-rendered speech in `public/vo/<key>.ogg`
(mono Opus, ~10 KB each, loaded per level). Everything else stays procedural.

- **Voice:** [Chatterbox](https://github.com/resemble-ai/chatterbox) (Resemble AI, MIT licence), voice-cloned onto
  `driver_ref.wav`, a male reference read by [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) `am_fenrir`
  (Apache-2.0). Both run locally on CPU; nothing needs an API key, and the output is free to ship.
- **Radio sound:** baked into the files by `build.py` (band-limit, mic drive, compression, hiss, closing squelch).
  The opening squelch is the game's procedural `radio_squelch`, played by `src/vo.js`.
- **In game:** `src/vo.js` wraps `hud.subtitle`. Any `DRIVER` subtitle whose exact text has a clip is spoken;
  the subtitle stays up for the clip's length, the score ducks under it, and slow-mo doesn't pitch it down.
  Lines without a clip still work (subtitle + squelch). Trailer captures record a `voice` event and
  `renderOffline` loads the clip.

## Adding or changing a line
Lines are matched by text, so **editing a line's wording silently drops its voice until you regenerate.**

```bash
pip install chatterbox-tts kokoro-onnx faster-whisper soundfile scipy   # once (CPU torch is fine)
node tools/vo/extract.cjs          # rescan the levels -> tools/vo/lines.json
python tools/vo/gen.py             # renders only lines with no take yet (~25 s each on 2 CPUs)
python tools/vo/build.py           # Whisper check + radio + Opus -> public/vo/, src/vo-manifest.js
```

- `build.py` prints `CHECK` for takes whose words don't match the line (dropped words, mumbles, extra syllables).
  Re-roll those with `SEED=<n> python tools/vo/gen.py <key> ...`, then build again.
- Delivery is picked from the text (`style()` in `gen.py`): `...` asides are deadpan, `!` and CAPS get louder.
  Words the TTS misreads go in `SPOKEN` (e.g. `JET A-1` -> `Jet A one`).
- `gen.py` needs `kokoro.onnx` + `voices.bin` (kokoro-onnx release `model-files-v1.0`) in `$KOKORO_DIR` only if
  `driver_ref.wav` is missing.
- Old `.ogg` files for lines that no longer exist can be deleted; the manifest only lists current lines.
