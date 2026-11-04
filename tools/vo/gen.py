"""Generate dry driver VO with Chatterbox (Resemble AI, MIT) cloned onto a Kokoro (Apache-2.0) male voice.

  python tools/vo/gen.py [--force] [key ...]
Reads tools/vo/lines.json (from extract.cjs), writes tools/vo/raw/<key>.wav (gitignored).
Existing takes are kept unless --force or the key is listed. Then run tools/vo/build.py.
Setup (CPU is fine, ~25 s per line): pip install chatterbox-tts kokoro-onnx faster-whisper soundfile scipy
"""
import json, os, re, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw'); os.makedirs(RAW, exist_ok=True)
REF = os.path.join(HERE, 'driver_ref.wav')

# What the TTS reads, when the subtitle text would trip it up.
SPOKEN = {
    'MOVE! MOVE!!': 'Move! Move! MOVE!',
    'JET A-1': 'Jet A one',
    'GO GO GO!': 'Go! Go! GO!',
}

def spoken(text):
    t = text
    for a, b in SPOKEN.items(): t = t.replace(a, b)
    t = re.sub(r'(\w)—', r'\1...', t)              # cut-off ("Is that— ANOTHER")
    t = re.sub(r'\s*—\s*', ', ', t)                # spaced dash -> pause
    t = re.sub(r'^\.\.\.\s*', '', t)               # leading "..." makes it mumble; style() still reads it as deadpan
    # Chatterbox spells out ALL-CAPS words ("O N U S"), so read them as normal words; the shouting comes from
    # style(), which looks at the original caps.
    t = re.sub(r"\b[A-Z][A-Z']+\b", lambda m: m.group(0) if m.group(0) in KEEP_CAPS else m.group(0).capitalize(), t)
    return t.strip()

KEEP_CAPS = {'HR', 'SUV', 'SUVs'}

def style(text):
    """(exaggeration, cfg_weight): deadpan for '...' asides, louder with ! and CAPS."""
    caps = len([w for w in re.findall(r"[A-Z][A-Z']+", text) if w not in ('HR', 'A-1')])
    bangs = text.count('!')
    if text.startswith('...') and not bangs: return 0.4, 0.5
    if caps >= 3 or 'RUN' in text or '!!' in text: return 1.15, 0.3
    if caps >= 1 or bangs >= 2: return 0.95, 0.35
    if bangs: return 0.75, 0.4
    return 0.5, 0.5

def make_ref():
    if os.path.exists(REF): return
    import soundfile as sf
    from kokoro_onnx import Kokoro
    kd = os.environ.get('KOKORO_DIR', os.path.expanduser('~/kokoro'))
    k = Kokoro(os.path.join(kd, 'kokoro.onnx'), os.path.join(kd, 'voices.bin'))
    s, sr = k.create("Listen to me. I've been driving this truck for eleven years, and I have never once seen a day like "
                     "today. Keep your head down, keep shooting, and we both get home tonight.", voice='am_fenrir', speed=1.05, lang='en-us')
    sf.write(REF, s, sr)

if __name__ == '__main__':
    args = sys.argv[1:]; force = '--force' in args; only = {a for a in args if not a.startswith('--')}
    lines = json.load(open(os.path.join(HERE, 'lines.json')))
    todo = [l for l in lines if (l['key'] in only) or (not only and (force or not os.path.exists(os.path.join(RAW, l['key'] + '.wav'))))]
    if not todo: print('nothing to do'); sys.exit()
    make_ref()
    import torch, torchaudio
    from chatterbox.tts import ChatterboxTTS
    torch.set_num_threads(os.cpu_count() or 2)
    torch.manual_seed(int(os.environ.get('SEED', 7)))
    model = ChatterboxTTS.from_pretrained(device='cpu')
    model.prepare_conditionals(REF, exaggeration=0.5)
    for i, l in enumerate(todo):
        ex, cfg = style(l['text'])
        t = time.time()
        wav = model.generate(spoken(l['text']), exaggeration=ex, cfg_weight=cfg)
        torchaudio.save(os.path.join(RAW, l['key'] + '.wav'), wav, model.sr)
        print(f"[{i+1}/{len(todo)}] {l['key']} ex={ex} {time.time()-t:.0f}s  {l['text']}", flush=True)
