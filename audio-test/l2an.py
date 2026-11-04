# analyse l2.cjs catalog render: python3 l2an.py file.wav   (sounds at 0.5 + 4.5k s; names from l2.cjs CAT)
import sys, re, numpy as np
from scipy.io import wavfile
src = open(__file__.replace('l2an.py', 'l2.cjs')).read()
names = re.findall(r"'([a-z_]+)'", re.search(r"const CAT = \[(.*?)\];", src).group(1))
sr, x = wavfile.read(sys.argv[1]); m = x.astype(np.float32).mean(axis=1) / 32768
bands = [(20, 45), (45, 90), (90, 180), (180, 400), (400, 1000), (1000, 2500), (2500, 6000), (6000, 16000)]
print('name             peak  rms50 rms400 cent   dur-40  ' + ' '.join(f'{a}-{b}'.rjust(8) for a, b in bands))
for k, n in enumerate(names):
    a = 0.5 + 4.5 * k; seg = m[int(a * sr):int((a + 4.45) * sr)]
    pk = 20 * np.log10(np.abs(seg).max() + 1e-12)
    W = lambda w: 20 * np.log10(np.sqrt(np.mean(seg[:int(w * sr)] ** 2)) + 1e-12)
    # max 400 ms RMS
    c = np.cumsum(np.concatenate([[0], seg ** 2])); Wn = int(0.4 * sr); r4 = 10 * np.log10((c[Wn:] - c[:-Wn]).max() / Wn + 1e-12)
    # duration until envelope (20ms RMS) stays 40 dB under peak-env
    h = int(0.02 * sr); env = np.sqrt(np.convolve(seg ** 2, np.ones(h) / h, 'same')); edb = 20 * np.log10(env + 1e-12); thr = edb.max() - 40
    above = np.where(edb > thr)[0]; dur = (above[-1] / sr) if len(above) else 0
    P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2; f = np.fft.rfftfreq(len(seg), 1 / sr); tot = P.sum()
    cent = (P * f).sum() / tot
    print(f'{n:15s} {pk:6.1f} {W(0.05):6.1f} {r4:6.1f} {cent:6.0f} {dur:6.2f}  ' + ' '.join(f'{10*np.log10(P[(f>=lo)&(f<hi)].sum()/tot+1e-12):8.1f}' for lo, hi in bands))
