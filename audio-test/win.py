# max 400ms RMS (dBFS) within windows: python3 win.py file.wav a-b ...
import sys, numpy as np
from scipy.io import wavfile
sr, x = wavfile.read(sys.argv[1]); m = x.astype(np.float32).mean(axis=1) / 32768
W = int(0.4 * sr); c = np.cumsum(np.concatenate([[0], m ** 2]))
r = 10 * np.log10((c[W:] - c[:-W]) / W + 1e-12)
print(sys.argv[1].split('/')[-1], ' '.join(f"{w}:{r[int(float(w.split('-')[0])*sr):int(float(w.split('-')[1])*sr)].max():.1f}" for w in sys.argv[2:]))
