# per-sound analysis of the catalog render (each sound at 0.5 + 3k s)
import sys, numpy as np
from scipy.io import wavfile
names = ['rifle','enemy_gun','impact_metal','impact_glass','impact_flesh','whiz','casing','reload','explosion_big','explosion_small','rocket_launch','metal_crash','tire_screech','slowmo_in','slowmo_out','hit_marker','kill_confirm','player_hurt','ear_ring','heli_flyby','ui_select']
sr, x = wavfile.read(sys.argv[1]); x = x.astype(np.float32) / 32768.0; m = x.mean(axis=1)
bands = [(20, 45), (45, 90), (90, 180), (180, 400), (400, 1000), (1000, 2500), (2500, 6000), (6000, 16000)]
print('name              peak   rms50  ' + ' '.join(f'{a}-{b}'.rjust(8) for a, b in bands))
for k, n in enumerate(names):
    a = 0.5 + 3 * k; seg = m[int(a * sr):int((a + 2.9) * sr)]
    pk = 20 * np.log10(np.abs(seg).max() + 1e-12); s50 = seg[:int(0.05 * sr)]; r50 = 20 * np.log10(np.sqrt(np.mean(s50 ** 2)) + 1e-12)
    P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; f = np.fft.rfftfreq(len(seg), 1 / sr); tot = P.sum()
    print(f'{n:16s} {pk:6.1f} {r50:6.1f}  ' + ' '.join(f'{10*np.log10(P[(f>=lo)&(f<hi)].sum()/tot+1e-12):8.1f}' for lo, hi in bands))
