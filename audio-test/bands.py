# band energy (dBFS RMS) for time windows of a wav: python3 bands.py file.wav a-b [a-b ...]
import sys, numpy as np
from scipy.io import wavfile
sr, x = wavfile.read(sys.argv[1]); x = x.astype(np.float32) / 32768.0; m = x.mean(axis=1)
bands = [(20, 45), (45, 90), (90, 180), (180, 400), (400, 1000), (1000, 2500), (2500, 6000), (6000, 16000)]
print('window      total  ' + ' '.join(f'{a}-{b}'.rjust(9) for a, b in bands))
for w in sys.argv[2:]:
    a, b = map(float, w.split('-')); seg = m[int(a * sr):int(b * sr)]
    F = np.fft.rfft(seg * np.hanning(len(seg))); P = np.abs(F) ** 2; f = np.fft.rfftfreq(len(seg), 1 / sr); tot = P.sum()
    tr = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12)
    print(f'{w:10s} {tr:6.1f}  ' + ' '.join(f'{10*np.log10(P[(f>=lo)&(f<hi)].sum()/tot+1e-12):9.1f}' for lo, hi in bands))
