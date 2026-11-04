import sys, numpy as np
from scipy.io import wavfile
sr, x = wavfile.read(sys.argv[1]); m = x.astype(np.float32).mean(axis=1) / 32768
names = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']; bar2 = 60/128*8; t0 = 0.25
for k in range(int(sys.argv[2]) if len(sys.argv) > 2 else 8):
    a = t0 + k*bar2 + 0.4; seg = m[int(a*sr):int((a+bar2-0.6)*sr)]
    P = np.abs(np.fft.rfft(seg*np.hanning(len(seg))))**2; f = np.fft.rfftfreq(len(seg), 1/sr)
    sel = (f > 60) & (f < 1000); midi = np.round(69 + 12*np.log2(f[sel]/440)).astype(int) % 12
    ch = np.bincount(midi, weights=P[sel], minlength=12); top = np.argsort(ch)[::-1][:3]
    print(f'block {k} t={a:5.1f}: ' + ' '.join(names[i] for i in top))
