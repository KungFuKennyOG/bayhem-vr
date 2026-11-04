# envelope / centroid over time for one catalog slot: python3 l2env.py file.wav name [frame_ms]
import sys, re, numpy as np
from scipy.io import wavfile
src = open(__file__.replace('l2env.py', 'l2.cjs')).read()
names = re.findall(r"'([a-z_]+)'", re.search(r"const CAT = \[(.*?)\];", src).group(1))
sr, x = wavfile.read(sys.argv[1]); m = x.astype(np.float32).mean(axis=1) / 32768
fr = float(sys.argv[3]) if len(sys.argv) > 3 else 100
for n in sys.argv[2].split(','):
    k = names.index(n); a = 0.5 + 4.5 * k; seg = m[int(a * sr):int((a + 4.45) * sr)]; F = int(fr / 1000 * sr)
    out = []
    for i in range(0, len(seg) - F, F):
        s = seg[i:i + F]; r = 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-12)
        if r < -70: break
        P = np.abs(np.fft.rfft(s * np.hanning(F))) ** 2; f = np.fft.rfftfreq(F, 1 / sr); c = (P * f).sum() / (P.sum() + 1e-20)
        out.append(f'{i/sr:.2f}:{r:.0f}/{c:.0f}')
    print(n, ' '.join(out))
