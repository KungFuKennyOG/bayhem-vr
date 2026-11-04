// BAYHEM — procedural audio system (Web Audio API only, no asset files, no deps).
//
// Design:
//  * At init every one-shot / loop / music instrument is synthesized ONCE with real Web Audio graphs
//    (oscillators, filtered noise, waveshapers) rendered through small OfflineAudioContexts ("bakes").
//    At runtime a sound is just BufferSource -> gain -> (lowpass) -> panner -> bus, which keeps the
//    Quest 3 cheap and makes bullet-time trivial (playbackRate).
//  * Master: buses -> concussion LP -> slow-mo LP -> glue comp -> limiter -> safety gain -> soft clip.
//    One shared ConvolverNode (generated IR) on a send bus.
//  * Music: lookahead step sequencer on ctx time (128 BPM, D minor, i-VI-III-VII), 4 crossfaded layers.
//  * Offline: renderOffline() steps an OfflineAudioContext with suspend()/resume() in 0.25 s chunks,
//    dispatching recorded events at their exact time via `sys._when`.

const BPM = 128;
const S16 = 60 / BPM / 4; // sixteenth note, seconds
const CHUNK = 0.25; // offline dispatch chunk

// ---------------------------------------------------------------- utils
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mhz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const semi = (s) => Math.pow(2, s / 12);

const _curves = new Map();
function tanhCurve(drive) {
  const k = drive.toFixed(2);
  let c = _curves.get(k);
  if (!c) {
    const n = 2048; c = new Float32Array(n); const nd = Math.tanh(drive);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(drive * x) / nd; }
    _curves.set(k, c);
  }
  return c;
}
// final soft clipper: input range [-1,1] represents [-2,2] (pre-scaled by 0.5); linear to 0.8, tanh knee, ceiling ~0.97
function clipCurve() {
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2; const ax = Math.abs(x);
    const y = ax < 0.8 ? ax : 0.8 + 0.17 * Math.tanh((ax - 0.8) / 0.17);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

// ---------------------------------------------------------------- noise / IR generation (JS, once)
function makeNoise(ctx) {
  const sr = ctx.sampleRate, len = Math.floor(sr * 2.5), R = rng(9001);
  const white = ctx.createBuffer(1, len, sr), pink = ctx.createBuffer(1, len, sr), brown = ctx.createBuffer(1, len, sr);
  const crackle = ctx.createBuffer(1, Math.floor(sr * 4), sr), wind = ctx.createBuffer(2, len, sr);
  const w = white.getChannelData(0); for (let i = 0; i < len; i++) w[i] = R() * 2 - 1;
  const pinkFill = (d) => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, pk = 0;
    for (let i = 0; i < d.length; i++) {
      const x = R() * 2 - 1;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362; b6 = x * 0.115926; pk = Math.max(pk, Math.abs(d[i]));
    }
    for (let i = 0; i < d.length; i++) d[i] /= pk;
  };
  pinkFill(pink.getChannelData(0)); pinkFill(wind.getChannelData(0)); pinkFill(wind.getChannelData(1));
  { const d = brown.getChannelData(0); let y = 0, pk = 0; for (let i = 0; i < len; i++) { y = (y + 0.02 * (R() * 2 - 1)) * 0.996; d[i] = y; pk = Math.max(pk, Math.abs(y)); } for (let i = 0; i < len; i++) d[i] /= pk; }
  {
    const d = crackle.getChannelData(0), n = d.length, dens = 90 / sr;
    for (let i = 0; i < n; i++) {
      if (R() < dens) {
        const a = Math.pow(R(), 2.2) * (R() < 0.5 ? -1 : 1), tau = 4 + R() * 40, wv = 0.3 + R() * 2.4, L = Math.min(n - i, Math.floor(tau * 6));
        for (let k = 0; k < L; k++) d[i + k] += a * Math.exp(-k / tau) * Math.cos(k * wv);
      }
    }
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < n; i++) d[i] /= pk || 1;
  }
  return { white, pink, brown, crackle, wind };
}

function makeIR(ctx) {
  const sr = ctx.sampleRate, T = 2.6, len = Math.floor(sr * T), buf = ctx.createBuffer(2, len, sr), R = rng(4242);
  const pre = Math.floor(0.014 * sr), T60 = 2.3;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let y = 0, y2 = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const alpha = lerp(0.85, 0.06, Math.min(1, t / 1.8)); // darker tail
      y += alpha * (R() * 2 - 1 - y); y2 += alpha * (y - y2);
      const env = Math.exp((-6.9 * t) / T60) * Math.min(1, t / 0.012);
      d[i] = y2 * env * 2.2;
    }
    const taps = [0.019, 0.026, 0.037, 0.044, 0.058, 0.071, 0.089, 0.103];
    taps.forEach((tt, k) => { const i = Math.floor((tt + (ch ? 0.0031 * (k % 3) : 0)) * sr); if (i < len) d[i] += (k % 2 === ch ? 0.6 : 0.35) * Math.exp(-k * 0.25); });
  }
  return buf;
}

// make a seamlessly looping buffer from a render of length len+xf (equal-power crossfade of tail into head)
function loopify(ctx, buf, loopLen, xfLen) {
  const sr = buf.sampleRate, L = Math.floor(loopLen * sr), X = Math.floor(xfLen * sr);
  const out = ctx.createBuffer(buf.numberOfChannels, L, sr);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const s = buf.getChannelData(ch), d = out.getChannelData(ch);
    for (let i = 0; i < L; i++) {
      if (i < X && L + i < s.length) { const a = (i / X) * Math.PI * 0.5; d[i] = s[i] * Math.sin(a) + s[L + i] * Math.cos(a); }
      else d[i] = s[i];
    }
  }
  return out;
}

function normalize(buf, peak = 1, fadeOut = 0.015) {
  let pk = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { const a = d[i] < 0 ? -d[i] : d[i]; if (a > pk) pk = a; } }
  const g = pk > 1e-9 ? peak / pk : 0, F = Math.floor(fadeOut * buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch), n = d.length;
    for (let i = 0; i < n; i++) d[i] *= g;
    for (let i = 0; i < F && i < n; i++) d[n - 1 - i] *= i / F;
  }
  return buf;
}

// ---------------------------------------------------------------- bake DSL (runs inside an OfflineAudioContext)
class Bk {
  constructor(c, N, R) { this.c = c; this.N = N; this.R = R; this.o = c.destination; this.ny = c.sampleRate * 0.45; }
  r(a, b) { return a + (b - a) * this.R(); }
  g(v = 1) { const g = this.c.createGain(); g.gain.value = v; return g; }
  f(type, freq, Q = 0.707) { const f = this.c.createBiquadFilter(); f.type = type; f.frequency.value = Math.min(freq, this.ny); f.Q.value = Q; return f; }
  sh(drive) { const w = this.c.createWaveShaper(); w.curve = tanhCurve(drive); return w; }
  dly(t) { const d = this.c.createDelay(Math.max(1, t + 0.1)); d.delayTime.value = t; return d; }
  src(kind, t = 0, rate = 1) { const s = this.c.createBufferSource(); s.buffer = this.N[kind]; s.loop = true; s.playbackRate.value = rate; s.start(t, this.R() * (s.buffer.duration - 0.2)); return s; }
  osc(type, f, t = 0) { const o = this.c.createOscillator(); o.type = type; o.frequency.value = Math.min(f, this.ny); o.start(t); return o; }
  ch(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
  perc(p, t, peak, a, tau) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.setTargetAtTime(0, t + a, tau); }
  sweep(p, t, f0, f1, d) { p.setValueAtTime(Math.min(f0, this.ny), t); p.exponentialRampToValueAtTime(Math.min(Math.max(f1, 1), this.ny), t + d); }
  nz(dest, o) {
    const { t = 0, kind = 'white', type = 'bandpass', f = 1000, Q = 0.707, f1, fd = 0.1, peak = 1, a = 0.001, tau = 0.05, rate = 1 } = o;
    const s = this.src(kind, t, rate), fl = this.f(type, f, Q), g = this.g(0);
    if (f1) this.sweep(fl.frequency, t, f, f1, fd);
    this.perc(g.gain, t, peak, a, tau); this.ch(s, fl, g, dest); s.stop(t + a + tau * 9 + 0.05); return g;
  }
  tn(dest, o) {
    const { t = 0, type = 'sine', f = 200, f1, fd = 0.1, peak = 1, a = 0.001, tau = 0.1 } = o;
    const os = this.osc(type, f, t), g = this.g(0);
    if (f1) this.sweep(os.frequency, t, f, f1, fd);
    this.perc(g.gain, t, peak, a, tau); this.ch(os, g, dest); os.stop(t + a + tau * 9 + 0.05); return g;
  }
  // stack of detuned oscillators at a MIDI pitch
  stack(dest, midi, n, cents, type = 'sawtooth', vib = null, t = 0) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const o = this.osc(type, mhz(midi), t);
      o.detune.value = (n === 1 ? 0 : lerp(-cents, cents, k / (n - 1))) + this.r(-3, 3);
      if (vib) vib.connect(o.detune);
      o.connect(dest); out.push(o);
    }
    return out;
  }
  vib(rate, depth) { const l = this.osc('sine', rate); const g = this.g(depth); l.connect(g); return g; }
  // amplitude envelope gain node: attack, hold until rel, then release tau
  env(peak, a, rel, tau, t = 0) { const g = this.g(0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + rel); g.gain.setTargetAtTime(0, t + rel, tau); return g; }
}

// ---------------------------------------------------------------- sound definitions
// gain: level at refDistance / 2D (buffers are peak-normalized), verb: reverb send, roll: rolloff,
// max: voices per name, vary: random playbackRate spread, twoD: ignore position, post: bypass slow-mo/concussion filters,
// noTime: not affected by time scale, sub: extra 2D low-end path for distant explosions.
const SFX = {
  rifle: { n: 6, gain: 0.33, verb: 0.09, max: 8, vary: 0.03, twoD: true },
  enemy_gun: { n: 4, gain: 0.8, verb: 0.2, max: 8, vary: 0.06, roll: 0.55, hrtf: true },
  impact_metal: { n: 6, gain: 0.5, verb: 0.08, max: 8, vary: 0.08, roll: 0.9 },
  impact_glass: { n: 3, gain: 0.45, verb: 0.12, max: 4, vary: 0.06, roll: 0.9 },
  impact_flesh: { n: 3, gain: 0.55, verb: 0.05, max: 4, vary: 0.08, roll: 0.9 },
  whiz: { n: 3, gain: 0.55, verb: 0.04, max: 4, vary: 0.1, roll: 1.4, hrtf: true },
  casing: { n: 4, gain: 0.3, verb: 0.02, max: 6, vary: 0.08, roll: 1.2 },
  reload: { n: 1, gain: 0.5, verb: 0.04, max: 2, vary: 0.01, twoD: true },
  explosion_big: { n: 4, gain: 1.0, verb: 0.42, max: 5, vary: 0.07, roll: 0.3, hrtf: true, sub: 0.55 },
  explosion_small: { n: 3, gain: 0.7, verb: 0.28, max: 4, vary: 0.08, roll: 0.5, hrtf: true },
  rocket_launch: { n: 2, gain: 0.7, verb: 0.25, max: 4, vary: 0.05, roll: 0.5, hrtf: true },
  metal_crash: { n: 4, gain: 0.75, verb: 0.22, max: 4, vary: 0.07, roll: 0.5, hrtf: true },
  tire_screech: { n: 2, gain: 0.4, verb: 0.15, max: 3, vary: 0.06, roll: 0.6 },
  slowmo_in: { n: 1, gain: 0.85, verb: 0.35, max: 1, noTime: true, twoD: true },
  slowmo_out: { n: 1, gain: 0.6, verb: 0.25, max: 1, noTime: true, twoD: true },
  hit_marker: { n: 1, gain: 0.3, verb: 0, max: 3, vary: 0.02, noTime: true, twoD: true, post: true },
  kill_confirm: { n: 1, gain: 0.42, verb: 0.05, max: 2, noTime: true, twoD: true, post: true },
  player_hurt: { n: 1, gain: 0.75, verb: 0.05, max: 2, noTime: true, twoD: true },
  ear_ring: { n: 1, gain: 0.15, verb: 0, max: 1, noTime: true, twoD: true, post: true },
  heli_flyby: { n: 1, gain: 0.9, verb: 0.3, max: 2, roll: 0.4, hrtf: true },
  ui_select: { n: 1, gain: 0.32, verb: 0.05, max: 2, noTime: true, twoD: true, post: true },
  // --- Level 2 (Port of Victory). duck: dip the music like explosion_big; conc: [radius m, amount, hold s] concussion muffle.
  step_concrete: { n: 6, gain: 0.2, verb: 0.02, max: 6, vary: 0.06, roll: 1.4 },
  step_metal: { n: 6, gain: 0.22, verb: 0.05, max: 6, vary: 0.05, roll: 1.3 },
  step_run: { n: 4, gain: 0.26, verb: 0.03, max: 6, vary: 0.06, roll: 1.3 },
  container_slam: { n: 1, gain: 1.0, verb: 0.45, max: 2, vary: 0.04, roll: 0.3, hrtf: true, sub: 0.6, duck: true, conc: [28, 0.4, 0.5] },
  container_dent: { n: 3, gain: 0.62, verb: 0.2, max: 4, vary: 0.08, roll: 0.55, hrtf: true },
  container_doors: { n: 2, gain: 0.62, verb: 0.22, max: 2, vary: 0.05, roll: 0.55, hrtf: true },
  crane_alarm: { n: 1, gain: 0.3, verb: 0.25, max: 2, vary: 0, roll: 0.45 },
  crane_release: { n: 1, gain: 0.6, verb: 0.22, max: 2, vary: 0.04, roll: 0.5, hrtf: true },
  barrel_hit: { n: 4, gain: 0.42, verb: 0.08, max: 6, vary: 0.08, roll: 0.9 },
  barrel_hiss: { n: 1, gain: 0.32, verb: 0.06, max: 4, vary: 0.1, roll: 0.9 },
  barrel_explode: { n: 2, gain: 0.95, verb: 0.35, max: 4, vary: 0.07, roll: 0.35, hrtf: true, sub: 0.4, duck: true, conc: [16, 0.3, 0.35] },
  grenade_bounce: { n: 3, gain: 0.34, verb: 0.05, max: 4, vary: 0.08, roll: 1.1, hrtf: true },
  grenade_pin: { n: 1, gain: 0.3, verb: 0.03, max: 3, vary: 0.06, roll: 1.2 },
  glass_break: { n: 1, gain: 0.62, verb: 0.2, max: 2, vary: 0.05, roll: 0.6, hrtf: true },
  ship_horn: { n: 1, gain: 0.8, verb: 0.5, max: 1, vary: 0, roll: 0.12, hrtf: true, sub: 0.35, duck: true },
  metal_groan: { n: 2, gain: 0.6, verb: 0.4, max: 2, vary: 0.06, roll: 0.25, hrtf: true },
  alarm_klaxon: { n: 1, gain: 0.32, verb: 0.3, max: 2, vary: 0, roll: 0.4 },
  radio_squelch: { n: 1, gain: 0.22, verb: 0, max: 2, vary: 0.03, noTime: true, twoD: true, post: true },
  body_fall: { n: 3, gain: 0.42, verb: 0.05, max: 4, vary: 0.07, roll: 1.0 },
  gear_rattle: { n: 3, gain: 0.16, verb: 0.02, max: 6, vary: 0.08, roll: 1.5 },
  fuel_whoomp: { n: 1, gain: 0.62, verb: 0.35, max: 3, vary: 0.05, roll: 0.4, hrtf: true, sub: 0.5 },
  // --- Level 3 (Downtown Haven City)
  sniper_shot: { n: 2, gain: 1.0, verb: 0.35, max: 3, vary: 0.04, roll: 0.25, hrtf: true, sub: 0.4, duck: true, conc: [30, 0.25, 0.25] },
  laser_lock: { n: 1, gain: 0.25, verb: 0.05, max: 4, vary: 0, roll: 0.5 },
  collapse_rumble: { n: 1, gain: 1.0, verb: 0.4, max: 2, vary: 0.03, twoD: true },
  collapse_impact: { n: 2, gain: 1.0, verb: 0.45, max: 4, vary: 0.06, roll: 0.2, hrtf: true, sub: 0.9, duck: true, conc: [60, 0.5, 0.6] },
  glass_rain: { n: 1, gain: 0.8, verb: 0.3, max: 2, vary: 0.05, roll: 0.35, hrtf: true },
  birds_flap: { n: 1, gain: 0.55, verb: 0.25, max: 1, vary: 0.05, roll: 0.5 },
};

const LOOPS = {
  wind: { gain: 0.045, twoD: true },
  truck: { gain: 0.07, twoD: true, rate: (i) => 0.85 + 0.3 * i, lp: (i) => 380 + 900 * i, verb: 0 },
  heli: { gain: 1.0, roll: 0.35, hrtf: true, rate: () => 1, lp: () => 20000, verb: 0.2, sub: 0.9, doppler: true },
  rocket: { gain: 0.55, roll: 0.8, hrtf: true, rate: (i) => 0.9 + 0.2 * i, lp: () => 20000, verb: 0.15, doppler: true, max: 6 },
  suv: { gain: 0.45, roll: 0.7, rate: (i) => 0.8 + 0.6 * i, lp: (i) => 600 + 2200 * i, verb: 0.08, doppler: true, max: 8 },
  fire: { gain: 0.45, roll: 0.8, rate: () => 1, lp: (i) => 2500 + 9000 * i, verb: 0.15, max: 6 },
  // --- Level 2. amb: 2D loop routed to the ambience bus (like truck).
  harbor: { gain: 0.11, twoD: true, amb: true, rate: () => 1, lp: (i) => 2500 + 15000 * i, verb: 0 },
  crane_motor: { gain: 0.42, roll: 0.6, rate: (i) => 0.7 + 0.6 * i, lp: (i) => 2000 + 8000 * i, verb: 0.15, max: 3 },
  forklift: { gain: 0.42, roll: 0.75, rate: (i) => 0.75 + 0.75 * i, lp: (i) => 900 + 3500 * i, verb: 0.08, doppler: true, max: 3 },
  fire_big: { gain: 0.7, roll: 0.5, rate: () => 1, lp: (i) => 1500 + 9000 * i, verb: 0.2, sub: 0.5, max: 4 },
  sodium_hum: { gain: 0.06, roll: 1.8, rate: () => 1, lp: (i) => 2500 + 12000 * i, verb: 0, max: 8 },
  // --- Level 3
  car_alarm: { gain: 0.35, roll: 0.8, rate: () => 1, lp: (i) => 3000 + 6000 * i, verb: 0.15, max: 3 },
  dust_roar: { gain: 0.9, roll: 0.3, rate: () => 1, lp: (i) => 800 + 6000 * i, verb: 0.2, sub: 0.8, max: 1 },
  city: { gain: 0.12, twoD: true, amb: true, rate: () => 1, lp: (i) => 2500 + 12000 * i, verb: 0 },
};

// --- Level 2 one-shot bakes (Port of Victory)
// modal ring: a set of decaying sine partials at base*ratios (hollow steel). det adds a detuned twin -> beating.
// Synthesized in JS into one buffer (an oscillator+gain pair per partial costs far more bake time).
function ring(b, dest, t, base, ratios, o = {}) {
  const { peak = 0.3, tau = 0.3, tauFall = 0.5, spread = 0.025, a = 0.0005, det = 0 } = o;
  const P = [];
  ratios.forEach((r, k) => {
    const f = base * r * b.r(1 - spread, 1 + spread), p = (peak * b.r(0.6, 1)) / (1 + k * 0.35), ta = (tau * b.r(0.75, 1.25)) / (1 + k * tauFall);
    const ph = b.R() * 6.283;
    P.push([f, p, ta, ph]); if (det) P.push([f * (1 + det), p * 0.6, ta, ph + 1.7]);
  });
  const sr = b.c.sampleRate, ny = sr * 0.45, A = Math.max(1, Math.round(a * sr));
  const len = Math.max(1, Math.min(b.c.length - Math.floor(t * sr), Math.ceil((a + 7 * Math.max(...P.map((x) => x[2]))) * sr))), buf = b.c.createBuffer(1, len, sr), d = buf.getChannelData(0);
  for (const [f, p, ta, ph] of P) {
    if (f >= ny) continue;
    const w = (6.283185307 * f) / sr, cw = Math.cos(w), sw = Math.sin(w), dk = Math.exp(-1 / (ta * sr)), n = Math.min(len, Math.ceil((a + 7 * ta) * sr));
    let s = Math.sin(ph), c = Math.cos(ph), e = p;
    for (let i = 0; i < n; i++) {
      d[i] += s * (i < A ? (p * i) / A : e);
      const s2 = s * cw + c * sw; c = c * cw - s * sw; s = s2;
      if (i >= A) e *= dk;
    }
  }
  const s = b.c.createBufferSource(); s.buffer = buf; s.connect(dest); s.start(t);
}
// grain cloud synthesized in JS into one buffer (replaces dozens of tn/nz node pairs).
// each grain: { t, f, peak, tau, a?, k: 'sin' | 'tri' | 'bp' (resonant noise, Q) | 'hp' (bright click), Q? }
function grains(b, dest, list) {
  const sr = b.c.sampleRate, len = b.c.length, d = new Float32Array(len), R = b.R;
  for (const g of list) {
    const i0 = Math.floor(g.t * sr); if (i0 >= len) continue;
    const A = Math.max(1, Math.round((g.a ?? 0.0004) * sr)), n = Math.min(len - i0, A + Math.ceil(7 * g.tau * sr)), dk = Math.exp(-1 / (g.tau * sr));
    const k = g.k || 'sin', f = Math.min(g.f || 1000, sr * 0.45);
    let e = g.peak;
    if (k === 'sin' || k === 'tri') {
      const w = (6.283185307 * f) / sr, cw = Math.cos(w), sw = Math.sin(w); let s = 0, c = 1;
      for (let i = 0; i < n; i++) {
        const v = k === 'tri' ? (2 / Math.PI) * Math.asin(s) : s;
        d[i0 + i] += v * (i < A ? (g.peak * i) / A : e);
        const s2 = s * cw + c * sw; c = c * cw - s * sw; s = s2; if (i >= A) e *= dk;
      }
    } else if (k === 'bp') { // RBJ bandpass (constant 0 dB peak) on white noise
      const w = (6.283185307 * f) / sr, al = Math.sin(w) / (2 * (g.Q || 2)), a0 = 1 + al, b0 = al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) {
        const x = R() * 2 - 1, y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y;
        d[i0 + i] += y * 1.7 * (i < A ? (g.peak * i) / A : e); if (i >= A) e *= dk;
      }
    } else { // 'hp': first-difference white noise ~ bright click
      let xp = 0;
      for (let i = 0; i < n; i++) { const x = R() * 2 - 1; d[i0 + i] += (x - xp) * 0.5 * (i < A ? (g.peak * i) / A : e); xp = x; if (i >= A) e *= dk; }
    }
  }
  const buf = b.c.createBuffer(1, len, sr); buf.copyToChannel(d, 0);
  const s = b.c.createBufferSource(); s.buffer = buf; s.connect(dest); s.start(0);
}
const PLATE = [1, 1.62, 2.31, 2.98, 3.87, 5.1];
const DRUM = [1, 1.59, 2.14, 2.65, 3.16, 4.1];
const L2_BAKES = {
  step_concrete: { dur: 0.3, fn(b) {
    const o = b.o, toe = b.r(0.055, 0.085);
    b.nz(o, { kind: 'pink', type: 'lowpass', f: b.r(380, 520), peak: 1, a: 0.002, tau: b.r(0.012, 0.018) });
    b.tn(o, { f: b.r(95, 120), f1: 60, fd: 0.03, peak: 0.45, a: 0.002, tau: 0.016 });
    b.nz(o, { type: 'bandpass', f: b.r(1600, 2400), Q: 1.2, peak: 0.22, a: 0.001, tau: 0.007 });
    b.nz(o, { t: toe, kind: 'pink', type: 'lowpass', f: b.r(600, 900), peak: 0.5, a: 0.003, tau: 0.011 });
    b.nz(o, { t: 0.002, kind: 'crackle', type: 'highpass', f: 2500, peak: b.r(0.5, 0.8), a: 0.004, tau: 0.028, rate: b.r(1.6, 2.4) });
    b.nz(o, { t: toe, kind: 'crackle', type: 'bandpass', f: b.r(3500, 6000), Q: 0.8, peak: b.r(0.4, 0.7), a: 0.006, tau: 0.032, rate: b.r(1.6, 2.4) });
    b.nz(o, { t: toe + 0.03, type: 'bandpass', f: b.r(2500, 4000), Q: 1, peak: 0.07, a: 0.02, tau: 0.03 });
  } },
  step_metal: { dur: 0.6, sr: 32000, fn(b) {
    const o = b.o, toe = b.r(0.05, 0.08), base = b.r(150, 230);
    b.nz(o, { kind: 'pink', type: 'lowpass', f: 700, peak: 0.8, a: 0.0015, tau: 0.011 });
    b.tn(o, { f: b.r(110, 140), f1: 70, fd: 0.03, peak: 0.35, a: 0.0015, tau: 0.018 });
    b.nz(o, { type: 'highpass', f: 3500, peak: 0.22, a: 0.0004, tau: 0.004 });
    ring(b, o, 0, base, PLATE, { peak: 0.42, tau: 0.15, tauFall: 0.25, a: 0.001, det: 0.01 });
    ring(b, o, 0, b.r(900, 1400), [1, 1.41, 2.2, 3.05], { peak: 0.24, tau: 0.06, a: 0.0005 });
    b.nz(o, { t: toe, kind: 'pink', type: 'lowpass', f: 1000, peak: 0.4, a: 0.002, tau: 0.009 });
    ring(b, o, toe, base, PLATE, { peak: 0.2, tau: 0.1, tauFall: 0.3, a: 0.001 });
    grains(b, o, Array.from({ length: 3 }, () => ({ t: b.r(0.01, 0.13), k: 'tri', f: b.r(600, 1100), peak: 0.08, tau: 0.007 })));
  } },
  step_run: { dur: 0.32, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.4), b.o);
    const toe = b.r(0.028, 0.042);
    b.nz(o, { kind: 'brown', type: 'lowpass', f: b.r(450, 600), peak: 1.1, a: 0.0015, tau: 0.022 });
    b.tn(o, { f: b.r(100, 120), f1: 52, fd: 0.04, peak: 0.6, a: 0.0015, tau: 0.026 });
    b.nz(o, { type: 'bandpass', f: b.r(1500, 2200), Q: 1, peak: 0.3, a: 0.0008, tau: 0.008 });
    b.nz(o, { t: toe, kind: 'pink', type: 'lowpass', f: b.r(700, 1000), peak: 0.6, a: 0.002, tau: 0.012 });
    b.nz(o, { kind: 'crackle', type: 'highpass', f: 2200, peak: b.r(0.6, 0.9), a: 0.003, tau: 0.04, rate: b.r(1.8, 2.6) });
    b.nz(o, { t: toe + 0.05, type: 'bandpass', f: b.r(2500, 3500), Q: 0.9, peak: 0.14, a: 0.008, tau: 0.03 });
    grains(b, o, [0, 1].map(() => ({ t: b.r(0.01, 0.06), f: b.r(2200, 3800), peak: 0.05, a: 0.0003, tau: 0.01 })));
  } },
  container_slam: { dur: 4.6, sr: 32000, fn(b) {
    const o = b.g(1); o.connect(b.o);
    const hot = b.g(1); b.ch(hot, b.sh(3), o);
    const sb = b.g(1); b.ch(sb, b.sh(1.8), o);
    const box = b.r(52, 58), wall = b.r(260, 300), tb = b.r(0.38, 0.46);
    // corner castings smash the asphalt
    b.nz(hot, { type: 'lowpass', f: 7000, peak: 0.9, a: 0.0005, tau: 0.012 });
    b.nz(hot, { kind: 'brown', type: 'lowpass', f: 900, peak: 1.6, a: 0.002, tau: 0.09 });
    b.tn(sb, { f: 72, f1: 31, fd: 0.7, peak: 0.75, a: 0.004, tau: 0.65 });
    b.tn(sb, { f: 150, f1: 55, fd: 0.1, peak: 0.6, a: 0.002, tau: 0.12 });
    // giant hollow box: low cavity/panel modes (beating pairs) + corrugated wall ring
    ring(b, o, 0.005, box, [1, 1.48, 2.06, 2.71, 3.32, 4.13, 5.27, 6.6], { peak: 0.3, tau: 1.3, tauFall: 0.22, det: 0.012, a: 0.006 });
    ring(b, o, 0.01, wall, [1, 1.37, 1.83, 2.41, 3.09, 3.94, 5.2], { peak: 0.3, tau: 0.85, tauFall: 0.25, det: 0.006 });
    ring(b, o, 0.004, b.r(650, 800), [1, 1.29, 1.71, 2.26, 2.9], { peak: 0.16, tau: 0.35, tauFall: 0.3, det: 0.004 }); // frame / corner posts clang
    // crunching / buckling steel
    const G = [], GH = [];
    for (let k = 0; k < 10; k++) {
      const t = b.r(0, 0.35);
      GH.push({ t, k: 'bp', f: b.r(600, 2500), Q: 1.5, peak: b.r(0.4, 0.9), a: 0.001, tau: b.r(0.02, 0.06) });
      G.push({ t, k: 'bp', f: b.r(1500, 4000), Q: 3, peak: b.r(0.12, 0.3), a: 0.0005, tau: 0.015 });
    }
    b.nz(hot, { kind: 'crackle', type: 'bandpass', f: 1400, Q: 0.9, peak: 0.8, a: 0.002, tau: 0.12, rate: 0.8 });
    { const s = b.src('white'), f = b.f('bandpass', 1100, 3), l = b.osc('sine', 11), lg = b.g(500), g = b.g(0);
      b.ch(l, lg, f.frequency); g.gain.setValueAtTime(0, 0.02); g.gain.linearRampToValueAtTime(0.3, 0.08); g.gain.setTargetAtTime(0, 0.25, 0.15); b.ch(s, f, g, o); }
    // rebound + settle
    b.nz(hot, { t: tb, kind: 'brown', type: 'lowpass', f: 500, peak: 0.8, a: 0.003, tau: 0.08 });
    b.tn(sb, { t: tb, f: 90, f1: 40, fd: 0.2, peak: 0.35, a: 0.003, tau: 0.2 });
    ring(b, o, tb, box, [1, 2.06, 3.32, 5.27], { peak: 0.1, tau: 0.8, tauFall: 0.3 });
    // rattling fittings (doors, locking bars, twistlocks)
    for (let k = 0; k < 26; k++) {
      const t = 0.12 + Math.min(2.2, -Math.log(1 - b.R() * 0.97) * 0.5), a = Math.exp(-t / 0.9) * b.r(0.1, 0.3), f0 = b.r(500, 2200);
      G.push({ t, k: 'tri', f: f0, peak: a, tau: b.r(0.01, 0.04) }, { t, f: f0 * 2.71, peak: a * 0.5, a: 0.0003, tau: 0.02 });
    }
    // debris
    { const s = b.src('crackle', 0, 1.3), f = b.f('highpass', 1500), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.08); g.gain.setTargetAtTime(0, 0.3, 0.6); b.ch(s, f, g, o); }
    for (let k = 0; k < 14; k++) { const t = b.r(0.2, 2.8); G.push({ t, k: 'bp', f: b.r(1500, 6000), Q: b.r(2, 5), peak: b.r(0.05, 0.25) * Math.exp(-t / 1.2), tau: b.r(0.004, 0.015) }); }
    grains(b, o, G); grains(b, hot, GH);
    { const s = b.src('brown'), f = b.f('lowpass', 220), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.45, 0.25); g.gain.setTargetAtTime(0, 0.5, 1.0); b.ch(s, f, g, o); }
  } },
  container_dent: { dur: 1.3, sr: 32000, fn(b) {
    const o = b.g(1); o.connect(b.o); const hot = b.g(1); b.ch(hot, b.sh(2), o);
    const base = b.r(80, 110);
    b.nz(hot, { kind: 'brown', type: 'lowpass', f: 600, peak: 1, a: 0.002, tau: 0.04 });
    b.nz(o, { type: 'highpass', f: 2500, peak: 0.35, a: 0.0004, tau: 0.005 });
    b.tn(o, { f: base * 1.3, f1: base, fd: 0.07, peak: 0.55, a: 0.002, tau: 0.22 }); // oil-can "boing"
    ring(b, o, 0.002, base, [1, 1.52, 2.23, 2.9, 3.7], { peak: 0.3, tau: 0.45, tauFall: 0.3, det: 0.01 });
    ring(b, o, 0.002, b.r(320, 450), [1, 1.43, 2.1, 2.8], { peak: 0.12, tau: 0.25, tauFall: 0.3 });
    grains(b, o, Array.from({ length: 6 }, () => ({ t: b.r(0.04, 0.5), k: 'tri', f: b.r(700, 2000), peak: 0.05, tau: 0.015 })));
  } },
  container_doors: { dur: 2.2, sr: 32000, fn(b) {
    const o = b.g(1); o.connect(b.o); const hot = b.g(1); b.ch(hot, b.sh(2.5), o);
    // blast whack on the doors / locking bars
    b.nz(hot, { kind: 'brown', type: 'lowpass', f: 800, peak: 1, a: 0.002, tau: 0.05 });
    b.nz(o, { type: 'highpass', f: 3000, peak: 0.45, a: 0.0004, tau: 0.004 });
    ring(b, o, 0, b.r(400, 600), [1, 1.5, 2.2, 3.1], { peak: 0.18, tau: 0.15 });
    grains(b, o, Array.from({ length: 4 }, () => ({ t: b.r(0.02, 0.12), k: 'tri', f: b.r(500, 1500), peak: 0.1, tau: 0.015 })));
    // hinge screech: stick-slip sawtooth through resonances, pitch rising
    const t0 = 0.07, t1 = b.r(0.55, 0.7), f0 = b.r(520, 700);
    const os = b.osc('sawtooth', f0, t0);
    os.frequency.setValueAtTime(f0, t0); os.frequency.linearRampToValueAtTime(f0 * 1.6, t0 + 0.25); os.frequency.linearRampToValueAtTime(f0 * 1.25, t1);
    b.ch(b.src('white', t0), b.f('lowpass', 60), b.g(f0 * 1.2), os.frequency);
    const am = b.g(0.5); b.ch(b.osc('square', b.r(28, 40), t0), b.g(0.5), am.gain);
    const env = b.g(0); env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(1.6, t0 + 0.04); env.gain.setValueAtTime(1.6, t1 - 0.08); env.gain.linearRampToValueAtTime(0, t1);
    const sum = b.g(1); os.connect(am);
    [[1400, 4], [2600, 6], [4100, 8]].forEach(([f, Q]) => b.ch(am, b.f('bandpass', f * b.r(0.9, 1.1), Q), sum));
    b.ch(sum, env, o); os.stop(t1 + 0.1);
    // door swings into the container side: big clang + rebound
    const tc = t1 + b.r(0.02, 0.08), base = b.r(180, 240);
    b.nz(hot, { t: tc, kind: 'brown', type: 'lowpass', f: 700, peak: 1.1, a: 0.002, tau: 0.06 });
    b.nz(o, { t: tc, type: 'highpass', f: 2500, peak: 0.5, a: 0.0004, tau: 0.005 });
    ring(b, o, tc, base, [1, 1.48, 2.05, 2.6, 3.3, 4.4, 5.6], { peak: 0.35, tau: 0.6, tauFall: 0.25, det: 0.008 });
    ring(b, o, tc, b.r(800, 1100), [1, 1.37, 2.2], { peak: 0.15, tau: 0.2 });
    const tr = tc + b.r(0.18, 0.26);
    b.nz(hot, { t: tr, kind: 'brown', type: 'lowpass', f: 600, peak: 0.35, a: 0.002, tau: 0.04 });
    ring(b, o, tr, base, [1, 2.05, 3.3], { peak: 0.1, tau: 0.3 });
  } },
  crane_alarm: { dur: 1.6, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.6), b.o);
    b.ch(o, b.dly(0.17), b.f('lowpass', 1800), b.g(0.22), b.o); // slap off the container stacks
    [0, 0.5, 1.0].forEach((t) => {
      const env = b.g(0); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.5, t + 0.006); env.gain.setValueAtTime(0.5, t + 0.31); env.gain.linearRampToValueAtTime(0, t + 0.325);
      const sum = b.g(1);
      [[830, 1], [1245, 0.6]].forEach(([f, g]) => { const x = b.osc('square', f, t); b.ch(x, b.g(g), sum); x.stop(t + 0.35); });
      b.ch(sum, b.f('bandpass', 1500, 0.9), b.f('lowpass', 4200), env, o);
    });
  } },
  crane_release: { dur: 1.7, fn(b) {
    const o = b.g(1); o.connect(b.o); const hot = b.g(1); b.ch(hot, b.sh(2), o);
    b.nz(o, { type: 'bandpass', f: 3500, Q: 0.8, peak: 0.3, a: 0.01, tau: 0.08 }); // hydraulic valve
    [0.04, 0.07, 0.15, 0.185].forEach((t, k) => { // twistlocks unlock, two pairs
      const a = k < 2 ? 1 : 0.8;
      b.nz(hot, { t, kind: 'brown', type: 'lowpass', f: 500, peak: 0.9 * a, a: 0.0015, tau: 0.035 });
      b.tn(hot, { t, f: b.r(115, 130), f1: 70, fd: 0.04, peak: 0.5 * a, a: 0.0015, tau: 0.04 });
      b.nz(o, { t, type: 'highpass', f: 2500, peak: 0.35 * a, a: 0.0003, tau: 0.003 });
      ring(b, o, t, b.r(350, 500), [1, 1.6, 2.3], { peak: 0.14 * a, tau: 0.09 });
    });
    const G = [];
    for (let k = 0; k < 45; k++) { // chain links rattling as the spreader goes slack
      const t = 0.22 + 1.3 * Math.pow(b.R(), 1.4), a = 0.25 * Math.exp(-(t - 0.22) / 0.7) * b.r(0.4, 1), f0 = b.r(1800, 4200);
      G.push({ t, f: f0, peak: a, a: 0.0003, tau: b.r(0.006, 0.02) }, { t, f: f0 * 1.53, peak: a * 0.5, a: 0.0003, tau: 0.01 });
      if (k % 4 === 0) G.push({ t, k: 'tri', f: b.r(250, 450), peak: a * 0.8, a: 0.0005, tau: 0.012 });
    }
    grains(b, o, G);
    { const s = b.src('pink'), f = b.f('bandpass', 600, 1.2), g = b.g(0); g.gain.setValueAtTime(0, 0.2); g.gain.linearRampToValueAtTime(0.12, 0.45); g.gain.setTargetAtTime(0, 0.6, 0.3); b.ch(s, f, g, o); }
  } },
  barrel_hit: { dur: 0.75, fn(b) {
    const o = b.o, base = b.r(150, 210);
    b.nz(o, { type: 'highpass', f: 4000, peak: 0.9, a: 0.0003, tau: 0.002 });
    ring(b, o, 0, b.r(1800, 2600), [1, 1.47, 2.09], { peak: 0.55, tau: 0.035 }); // plink
    ring(b, o, 0.001, base, DRUM, { peak: 0.42, tau: 0.3, tauFall: 0.35, det: 0.015 }); // hollow bong
    b.tn(o, { f: b.r(85, 100), peak: 0.25, a: 0.001, tau: 0.04 });
    b.nz(o, { kind: 'pink', type: 'bandpass', f: base * 2, Q: 4, peak: 0.3, a: 0.001, tau: 0.08 });
  } },
  barrel_hiss: { dur: 1.55, fn(b) {
    const o = b.o;
    b.nz(o, { type: 'highpass', f: 3000, peak: 0.6, a: 0.0003, tau: 0.003 });
    const env = b.g(0); env.gain.setValueAtTime(0, 0.005); env.gain.linearRampToValueAtTime(1, 0.03); env.gain.setTargetAtTime(0.6, 0.05, 0.4); env.gain.setTargetAtTime(0, 1.15, 0.1);
    const fl = b.g(0.7); b.ch(b.osc('sine', b.r(13, 19)), b.g(0.2), fl.gain); b.ch(b.src('white'), b.f('lowpass', 40), b.g(6), fl.gain);
    const sum = b.g(1); b.ch(sum, fl, env, o);
    const jet = b.f('bandpass', 4500, 1.2); b.sweep(jet.frequency, 0, b.r(4200, 5000), 3000, 1.4);
    b.ch(b.src('white'), jet, b.g(0.8), sum);
    b.ch(b.src('white'), b.f('highpass', 7000), b.g(0.3), sum);
    const gl = b.g(0.3); b.ch(b.src('crackle', 0, 0.6), b.f('lowpass', 30), b.g(10), gl.gain); b.ch(b.src('pink'), b.f('bandpass', 900, 2), gl, sum); // liquid gurgle
  } },
  barrel_explode: { dur: 2.6, sr: 32000, fn(b) {
    const o = b.g(1); o.connect(b.o); const hot = b.g(1); b.ch(hot, b.sh(3), o);
    b.nz(hot, { type: 'lowpass', f: 12000, peak: 1, a: 0.0003, tau: 0.012 });
    b.nz(hot, { type: 'bandpass', f: b.r(2500, 3500), Q: 0.8, peak: 1.1, a: 0.0006, tau: 0.06 });
    b.nz(o, { type: 'highpass', f: 4000, peak: 0.5, a: 0.001, tau: 0.08 }); // bright fuel flash sizzle
    const sb = b.g(1); b.ch(sb, b.sh(2), o);
    b.tn(sb, { f: b.r(130, 150), f1: 48, fd: 0.25, peak: 0.6, a: 0.002, tau: 0.22 });
    b.nz(hot, { kind: 'brown', type: 'lowpass', f: 1600, f1: 250, fd: 0.5, peak: 1.8, a: 0.002, tau: 0.22 });
    b.nz(hot, { kind: 'pink', type: 'bandpass', f: b.r(900, 1400), Q: 0.7, peak: 0.9, a: 0.002, tau: 0.15 });
    ring(b, o, 0, b.r(160, 220), DRUM.slice(0, 5), { peak: 0.12, tau: 0.25, det: 0.02 });
    { const s = b.src('crackle'), f = b.f('highpass', 1500), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.45, 0.1); g.gain.setTargetAtTime(0, 0.3, 0.35); b.ch(s, f, g, o); }
    // the drum flies off tumbling: whoosh with a doppler-ish band sweep + tumble AM
    const tw = 0.12, w = b.f('bandpass', 400, 1.8), am = b.g(0.55), g = b.g(0);
    w.frequency.setValueAtTime(400, tw); w.frequency.exponentialRampToValueAtTime(1600, tw + 0.55); w.frequency.exponentialRampToValueAtTime(450, tw + 1.5);
    b.ch(b.osc('sine', b.r(6, 9)), b.g(0.45), am.gain);
    g.gain.setValueAtTime(0, tw); g.gain.linearRampToValueAtTime(0.5, tw + 0.55); g.gain.setTargetAtTime(0, tw + 0.6, 0.4);
    b.ch(b.src('pink'), w, am, g, o);
    { const x = b.osc('triangle', 650, tw), xg = b.g(0); x.frequency.setValueAtTime(650, tw); x.frequency.linearRampToValueAtTime(780, tw + 0.5); x.frequency.linearRampToValueAtTime(520, tw + 1.2);
      xg.gain.setValueAtTime(0, tw); xg.gain.linearRampToValueAtTime(0.05, tw + 0.5); xg.gain.setTargetAtTime(0, tw + 0.6, 0.3); b.ch(x, am, xg, o); }
    const tl = b.r(1.6, 1.9); // lands somewhere off
    b.nz(o, { t: tl, kind: 'pink', type: 'lowpass', f: 900, peak: 0.12, a: 0.002, tau: 0.03 });
    ring(b, o, tl, b.r(160, 220), [1, 1.59, 2.14], { peak: 0.06, tau: 0.15 });
  } },
  grenade_bounce: { dur: 0.9, fn(b) {
    const o = b.o; let t = 0, dt = b.r(0.18, 0.24), a = 1; const G = [];
    for (let k = 0; k < 4; k++) {
      G.push({ t, k: 'hp', peak: 0.7 * a, a: 0.0002, tau: 0.002 }, { t, k: 'tri', f: b.r(380, 520), peak: 0.5 * a, tau: 0.01 }, { t, k: 'bp', f: b.r(3500, 6000), Q: 1, peak: 0.35 * a, a: 0.002, tau: 0.015 });
      ring(b, o, t, b.r(2600, 3400), [1, 1.52, 2.31], { peak: 0.3 * a, tau: 0.025 });
      t += dt; dt *= 0.62; a *= 0.6;
    }
    { const s = b.src('crackle', t - 0.05, 1.8), f = b.f('bandpass', 3200, 0.9), g = b.g(0); g.gain.setValueAtTime(0, t - 0.05); g.gain.linearRampToValueAtTime(0.3, t + 0.02); g.gain.setTargetAtTime(0, t + 0.08, 0.08); b.ch(s, f, g, o); }
    for (let k = 0; k < 5; k++) G.push({ t: t + b.r(-0.05, 0.25), f: b.r(2500, 4000), peak: 0.06, a: 0.0003, tau: 0.006 });
    grains(b, o, G);
  } },
  grenade_pin: { dur: 0.7, fn(b) {
    const o = b.o;
    { const s = b.src('white'), f = b.f('bandpass', 5000, 3), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.25, 0.04); g.gain.linearRampToValueAtTime(0, 0.09); b.ch(s, f, g, o); }
    b.nz(o, { t: 0.09, type: 'highpass', f: 4000, peak: 0.5, a: 0.0002, tau: 0.002 });
    b.tn(o, { t: 0.09, f: 3800, peak: 0.25, a: 0.0003, tau: 0.01 });
    const ts = b.r(0.24, 0.3), f0 = b.r(2600, 3100); // spoon flies off
    b.nz(o, { t: ts, type: 'highpass', f: 3000, peak: 0.7, a: 0.0002, tau: 0.003 });
    b.tn(o, { t: ts, f: f0, f1: f0 * 0.97, fd: 0.2, peak: 0.5, a: 0.0003, tau: 0.09 });
    b.tn(o, { t: ts, f: f0 * 2.4, peak: 0.22, a: 0.0003, tau: 0.05 });
    b.tn(o, { t: ts, f: f0 * 0.51, peak: 0.12, a: 0.0005, tau: 0.04 });
    b.tn(o, { t: ts + 0.28, f: b.r(4000, 5000), peak: 0.12, a: 0.0003, tau: 0.015 });
    b.nz(o, { t: ts + 0.28, type: 'highpass', f: 5000, peak: 0.2, a: 0.0002, tau: 0.002 });
  } },
  glass_break: { dur: 2.2, fn(b) {
    const o = b.o, hot = b.g(1); b.ch(hot, b.sh(2), o);
    b.nz(hot, { type: 'highpass', f: 1500, peak: 1, a: 0.0003, tau: 0.008 });
    b.nz(o, { kind: 'pink', type: 'lowpass', f: 600, peak: 0.5, a: 0.001, tau: 0.03 });
    b.nz(o, { type: 'bandpass', f: 3500, Q: 0.7, peak: 0.8, a: 0.001, tau: 0.09 });
    b.nz(o, { type: 'highpass', f: 6000, peak: 0.45, a: 0.003, tau: 0.25 });
    b.nz(o, { kind: 'crackle', type: 'highpass', f: 3000, peak: 0.6, a: 0.002, tau: 0.15, rate: 2 });
    const G = [];
    for (let k = 0; k < 44; k++) {
      const t = Math.min(1.7, -Math.log(1 - b.R() * 0.98) * 0.35), a = b.r(0.06, 0.25) * Math.exp(-t / 1.1), f = b.r(2500, 10000);
      G.push({ t, f, peak: a, a: 0.0003, tau: b.r(0.008, 0.05) });
      if (b.R() < 0.5) G.push({ t, f: f * b.r(1.4, 2.2), peak: a * 0.5, a: 0.0003, tau: 0.012 });
    }
    for (let k = 0; k < 14; k++) G.push({ t: b.r(0.8, 1.9), k: 'bp', f: b.r(3000, 8000), Q: 3, peak: b.r(0.05, 0.12), a: 0.0003, tau: 0.006 }); // landing below
    grains(b, o, G);
  } },
  ship_horn: { dur: 4.4, sr: 16000, fn(b) {
    const out = b.g(1), lp = b.f('lowpass', 2400); b.ch(out, lp, b.o);
    [[0.37, 900, 0.35], [0.82, 650, 0.22], [1.35, 500, 0.12]].forEach(([d, f, g]) => b.ch(out, b.dly(d), b.f('lowpass', f), b.g(g), b.o)); // harbour echoes
    const f0 = 82, env = b.g(0), sum = b.g(1);
    env.gain.setValueAtTime(0, 0); env.gain.linearRampToValueAtTime(0.25, 0.08); env.gain.linearRampToValueAtTime(1, 0.35); env.gain.setValueAtTime(1, 3.0); env.gain.setTargetAtTime(0, 3.0, 0.22);
    const v = b.vib(0.6, 5); // slow pressure wobble
    [[1, 1], [1.0045, 0.8], [0.997, 0.5]].forEach(([m, g]) => { // detuned reeds -> beating
      const x = b.osc('sawtooth', f0 * m); x.frequency.setValueAtTime(f0 * m * 0.93, 0); x.frequency.linearRampToValueAtTime(f0 * m, 0.3); x.frequency.setValueAtTime(f0 * m, 3.0); x.frequency.linearRampToValueAtTime(f0 * m * 0.96, 3.6);
      v.connect(x.detune); b.ch(x, b.g(g), sum);
    });
    const form = b.g(1);
    [[165, 2, 1], [330, 3, 0.8], [620, 4, 0.45], [1050, 5, 0.18]].forEach(([f, Q, g]) => b.ch(sum, b.f('bandpass', f, Q), b.g(g), form));
    b.ch(sum, b.f('lowpass', 140), b.g(0.9), form);
    b.ch(b.src('pink'), b.f('bandpass', 300, 1), b.g(0.08), form);
    b.ch(form, b.sh(2), env, out);
  } },
  metal_groan: { dur: 2.6, sr: 24000, fn(b) {
    const o = b.g(1); o.connect(b.o);
    b.ch(o, b.dly(0.12), b.f('lowpass', 800), b.g(0.3), b.o); // inside the hull
    const f0 = b.r(38, 55), os = b.osc('sawtooth', f0);
    os.frequency.setValueAtTime(f0, 0); os.frequency.linearRampToValueAtTime(f0 * b.r(1.3, 1.8), 0.9); os.frequency.linearRampToValueAtTime(f0 * b.r(0.8, 1.1), 1.6); os.frequency.linearRampToValueAtTime(f0 * b.r(1.2, 1.6), 2.3);
    b.ch(b.src('white'), b.f('lowpass', 30), b.g(f0 * 4), os.frequency); // stick-slip jitter
    const am = b.g(0.6); b.ch(b.src('white'), b.f('lowpass', 25), b.g(12), am.gain);
    const env = b.g(0); env.gain.setValueAtTime(0, 0); env.gain.linearRampToValueAtTime(1, 0.4); env.gain.setValueAtTime(1, 1.9); env.gain.setTargetAtTime(0, 1.9, 0.22);
    os.connect(am); const res = b.g(1);
    [[b.r(110, 140), 6, 1], [b.r(230, 280), 8, 0.8], [b.r(380, 450), 10, 0.6], [b.r(640, 760), 10, 0.35], [b.r(1100, 1300), 12, 0.15]].forEach(([f, Q, g]) => b.ch(am, b.f('bandpass', f, Q), b.g(g), res));
    b.ch(res, b.sh(1.5), env, o);
    { const s = b.src('brown'), f = b.f('lowpass', 90), g = b.env(0.35, 0.5, 1.9, 0.3); b.ch(s, f, g, o); }
    grains(b, o, Array.from({ length: 5 }, () => ({ t: b.r(0.2, 2.2), k: 'hp', peak: 0.3, a: 0.0003, tau: 0.003 })));
    for (let k = 0; k < 4; k++) ring(b, o, b.r(0.2, 2.2), b.r(250, 400), [1, 1.6, 2.3], { peak: 0.06, tau: 0.1 });
  } },
  alarm_klaxon: { dur: 2.0, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.4), b.o);
    const env = b.env(1, 0.008, 1.88, 0.03), am = b.g(0.25); rotorPulse(b.c, 18).connect(am.gain);
    const base = b.r(920, 980);
    [[1, 1], [2.76, 0.6], [5.4, 0.35], [8.9, 0.15]].forEach(([r, g]) => b.ch(b.osc('sine', base * r), b.g(g * 0.4), am));
    const ck = b.g(0); rotorPulse(b.c, 18).connect(ck.gain); b.ch(b.src('white'), b.f('highpass', 3000), ck, b.g(0.08), am); // striker
    b.ch(am, env, o);
  } },
  radio_squelch: { dur: 0.3, fn(b) {
    const o = b.g(1); b.ch(o, b.f('highpass', 350), b.f('lowpass', 3600), b.o); // radio band
    b.nz(o, { type: 'highpass', f: 2000, peak: 0.9, a: 0.0002, tau: 0.0015 });
    b.tn(o, { type: 'square', f: 1200, peak: 0.2, a: 0.0002, tau: 0.004 });
    const env = b.g(0); env.gain.setValueAtTime(0, 0.006); env.gain.linearRampToValueAtTime(0.6, 0.014); env.gain.setValueAtTime(0.55, 0.2); env.gain.setTargetAtTime(0, 0.21, 0.006);
    const ch = b.g(0.7); b.ch(b.osc('square', 45), b.g(0.15), ch.gain); b.ch(b.src('white'), b.f('lowpass', 80), b.g(8), ch.gain);
    b.ch(b.src('white'), b.f('bandpass', 1800, 0.6), b.sh(3), ch, env, o);
    b.nz(o, { t: 0.222, type: 'highpass', f: 2500, peak: 0.5, a: 0.0002, tau: 0.0015 });
  } },
  body_fall: { dur: 0.9, sr: 32000, fn(b) {
    const o = b.g(1); o.connect(b.o); const hot = b.g(1); b.ch(hot, b.sh(2), o);
    b.nz(hot, { kind: 'brown', type: 'lowpass', f: 400, peak: 0.8, a: 0.003, tau: 0.04 }); // knees
    b.tn(hot, { f: b.r(85, 105), f1: 50, fd: 0.06, peak: 0.45, a: 0.003, tau: 0.05 });
    const t2 = b.r(0.1, 0.18); // torso
    b.nz(hot, { t: t2, kind: 'brown', type: 'lowpass', f: 350, peak: 1.2, a: 0.004, tau: 0.06 });
    b.tn(hot, { t: t2, f: 75, f1: 42, fd: 0.08, peak: 0.65, a: 0.004, tau: 0.07 });
    b.nz(o, { t: t2, kind: 'pink', type: 'bandpass', f: 1200, Q: 0.8, peak: 0.35, a: 0.002, tau: 0.03 });
    b.nz(o, { t: t2, kind: 'crackle', type: 'highpass', f: 2500, peak: 0.4, a: 0.003, tau: 0.05, rate: 2 });
    const G = [];
    for (let k = 0; k < 5; k++) { // rifle / mags / helmet
      const t = Math.max(0, t2 + b.r(-0.05, 0.3)), f = b.r(700, 2200), a = b.r(0.06, 0.18), ta = b.r(0.02, 0.06);
      G.push({ t, f, peak: a, tau: ta }, { t, f: f * 2.4, peak: a * 0.6, tau: ta * 0.7 }, { t, f: f * 3.9, peak: a * 0.4, tau: ta * 0.5 }, { t, k: 'tri', f: b.r(250, 450), peak: 0.15, a: 0.0005, tau: 0.01 });
    }
    grains(b, o, G);
    { const s = b.src('pink'), f = b.f('bandpass', 2500, 1), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.12, t2); g.gain.setTargetAtTime(0, t2 + 0.05, 0.08); b.ch(s, f, g, o); }
    const t3 = t2 + b.r(0.15, 0.28); // arm flops
    b.nz(hot, { t: t3, kind: 'brown', type: 'lowpass', f: 500, peak: 0.35, a: 0.003, tau: 0.03 });
  } },
  gear_rattle: { dur: 0.55, fn(b) {
    const o = b.o;
    const G = [];
    [0, b.r(0.26, 0.32)].forEach((t0) => {
      for (let k = 0; k < 5; k++) { const t = t0 + b.r(0, 0.06), f = b.r(1800, 4500); G.push({ t, f, peak: b.r(0.1, 0.3), a: 0.0003, tau: b.r(0.006, 0.02) }, { t, f: f * 1.47, peak: 0.08, a: 0.0003, tau: 0.008 }); }
      G.push({ t: t0, k: 'tri', f: b.r(300, 500), peak: 0.25, a: 0.0005, tau: 0.012 }, { t: t0, k: 'bp', f: b.r(1500, 2500), Q: 0.8, peak: 0.25, a: 0.02, tau: 0.05 });
    });
    grains(b, o, G);
  } },
  fuel_whoomp: { dur: 2.8, sr: 24000, fn(b) {
    const o = b.g(1); o.connect(b.o); const sb = b.g(1); b.ch(sb, b.sh(1.6), o);
    b.tn(sb, { f: 62, f1: 36, fd: 0.35, peak: 0.9, a: 0.03, tau: 0.25 });
    b.nz(sb, { kind: 'brown', type: 'lowpass', f: 350, f1: 120, fd: 0.4, peak: 1.4, a: 0.025, tau: 0.2 });
    { const s = b.src('pink'), f = b.f('lowpass', 250, 0.9), g = b.g(0), fl = b.g(0.75);
      f.frequency.setValueAtTime(250, 0.05); f.frequency.exponentialRampToValueAtTime(2800, 0.9); f.frequency.setTargetAtTime(1400, 1.0, 0.6);
      g.gain.setValueAtTime(0, 0.05); g.gain.linearRampToValueAtTime(0.7, 0.7); g.gain.setTargetAtTime(0.45, 0.8, 0.5); g.gain.setTargetAtTime(0, 1.8, 0.35);
      b.ch(b.osc('sine', b.r(7, 10)), b.g(0.2), fl.gain); b.ch(b.src('white'), b.f('lowpass', 15), b.g(10), fl.gain);
      b.ch(s, f, fl, g, o); }
    { const s = b.src('brown'), f = b.f('lowpass', 300), g = b.g(0); g.gain.setValueAtTime(0, 0.1); g.gain.linearRampToValueAtTime(0.6, 0.8); g.gain.setTargetAtTime(0, 1.6, 0.4); b.ch(s, f, g, o); }
    { const s = b.src('crackle'), f = b.f('highpass', 1200), g = b.g(0); g.gain.setValueAtTime(0, 0.2); g.gain.linearRampToValueAtTime(0.35, 1.0); g.gain.setTargetAtTime(0, 1.6, 0.35); b.ch(s, f, g, o); }
  } },
};

// --- one-shot bakes
const BAKES = {
  rifle: { dur: 0.7, fn(b) {
    const bus = b.g(1); b.ch(bus, b.sh(1.3), b.o);
    b.ch(bus, b.dly(b.r(0.055, 0.08)), b.f('lowpass', 2200), b.g(0.14), b.o); // truck-bed slap
    b.nz(bus, { type: 'highpass', f: 2500, peak: 1.0, a: 0.0003, tau: 0.004 });
    b.nz(bus, { type: 'bandpass', f: b.r(2500, 3300), Q: 0.8, peak: 1.5, a: 0.0005, tau: b.r(0.016, 0.022) });
    b.nz(bus, { type: 'bandpass', f: b.r(1300, 1700), Q: 1, peak: 0.9, a: 0.0006, tau: 0.024 });
    const th = b.g(1); b.ch(th, b.sh(2.2), bus);
    b.tn(th, { f: b.r(220, 250), f1: b.r(72, 82), fd: 0.035, peak: 0.42, a: 0.001, tau: b.r(0.035, 0.045) });
    b.nz(bus, { kind: 'pink', type: 'bandpass', f: b.r(230, 290), Q: 0.8, peak: 0.9, a: 0.001, tau: 0.03 });
    b.nz(bus, { kind: 'pink', type: 'lowpass', f: 1200, peak: 0.22, a: 0.004, tau: 0.08 });
  } },
  enemy_gun: { dur: 0.6, fn(b) {
    const bus = b.g(1); b.ch(bus, b.sh(1.6), b.o);
    b.ch(bus, b.dly(b.r(0.09, 0.13)), b.f('lowpass', 1600), b.g(0.28), b.o);
    b.nz(bus, { type: 'bandpass', f: b.r(1700, 2500), Q: 1.1, peak: 1, a: 0.0005, tau: b.r(0.016, 0.024) });
    b.tn(bus, { f: b.r(210, 250), f1: 100, fd: 0.04, peak: 0.45, a: 0.001, tau: 0.03 });
    b.nz(bus, { kind: 'pink', type: 'lowpass', f: 1800, peak: 0.55, a: 0.001, tau: 0.03 });
    b.nz(bus, { kind: 'pink', type: 'lowpass', f: 900, peak: 0.18, a: 0.004, tau: 0.13 });
  } },
  impact_metal: { dur: 0.6, fn(b) {
    b.nz(b.o, { type: 'highpass', f: 3000, peak: 0.9, a: 0.0003, tau: 0.002 });
    b.nz(b.o, { type: 'bandpass', f: b.r(1200, 2000), Q: 1, peak: 0.5, a: 0.0005, tau: 0.012 });
    const base = b.r(900, 1600), ratios = [1, 2.32, 3.17, 4.53, 5.9];
    const nP = 3 + Math.floor(b.R() * 3);
    for (let k = 0; k < nP; k++) b.tn(b.o, { f: base * ratios[k] * b.r(0.97, 1.03), peak: b.r(0.15, 0.45) / (1 + k * 0.4), a: 0.0004, tau: b.r(0.04, 0.17) });
    b.tn(b.o, { type: 'triangle', f: b.r(280, 420), peak: 0.35, a: 0.0005, tau: 0.03 });
  } },
  impact_glass: { dur: 1.0, fn(b) {
    b.nz(b.o, { type: 'highpass', f: 2000, peak: 1, a: 0.0003, tau: 0.006 });
    b.nz(b.o, { type: 'highpass', f: 4200, peak: 0.45, a: 0.002, tau: 0.11 });
    b.nz(b.o, { type: 'bandpass', f: 6500, Q: 1.5, peak: 0.35, a: 0.003, tau: 0.08 });
    for (let k = 0; k < 16; k++) b.tn(b.o, { t: b.r(0.005, 0.5) * (k < 6 ? 0.2 : 1), f: b.r(3000, 9500), peak: b.r(0.05, 0.22), a: 0.0003, tau: b.r(0.01, 0.045) });
  } },
  impact_flesh: { dur: 0.35, fn(b) {
    b.nz(b.o, { kind: 'pink', type: 'lowpass', f: b.r(550, 800), peak: 1, a: 0.001, tau: 0.03 });
    b.tn(b.o, { f: b.r(110, 140), f1: 65, fd: 0.06, peak: 0.8, a: 0.001, tau: 0.05 });
    b.nz(b.o, { type: 'bandpass', f: 1200, Q: 2, peak: 0.3, a: 0.0005, tau: 0.008 });
  } },
  whiz: { dur: 0.55, fn(b) {
    const s = b.src('white'), f = b.f('bandpass', 4000, b.r(3, 5)), g = b.g(0), pk = b.r(0.08, 0.12);
    b.sweep(f.frequency, 0, b.r(3800, 4600), b.r(1000, 1300), 0.32);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, pk); g.gain.setTargetAtTime(0, pk, 0.055); b.ch(s, f, g, b.o);
    const o = b.osc('sine', 2600), g2 = b.g(0); b.sweep(o.frequency, 0, b.r(2400, 2900), b.r(900, 1100), 0.32);
    g2.gain.setValueAtTime(0, 0); g2.gain.linearRampToValueAtTime(0.12, pk); g2.gain.setTargetAtTime(0, pk, 0.05); b.ch(o, g2, b.o);
  } },
  casing: { dur: 0.45, fn(b) {
    let t = 0; const base = b.r(3200, 4200); const amps = [1, 0.5, 0.28, 0.14];
    for (let k = 0; k < 4; k++) {
      [1, 2.76, 5.4].forEach((m, j) => b.tn(b.o, { t, f: base * m * b.r(0.98, 1.02), peak: amps[k] * [0.6, 0.35, 0.2][j], a: 0.0003, tau: b.r(0.02, 0.05) }));
      b.nz(b.o, { t, type: 'highpass', f: 5000, peak: amps[k] * 0.4, a: 0.0002, tau: 0.001 });
      t += k === 0 ? b.r(0.07, 0.1) : b.r(0.035, 0.06);
    }
  } },
  reload: { dur: 1.0, fn(b) {
    const o = b.o;
    b.nz(o, { t: 0, type: 'bandpass', f: 3000, Q: 3, peak: 0.7, a: 0.0003, tau: 0.006 });
    b.tn(o, { t: 0, type: 'triangle', f: 900, peak: 0.3, a: 0.0003, tau: 0.01 });
    { const s = b.src('white', 0.04), f = b.f('bandpass', 1500, 0.8), g = b.g(0); g.gain.setValueAtTime(0, 0.04); g.gain.linearRampToValueAtTime(0.22, 0.07); g.gain.linearRampToValueAtTime(0, 0.2); b.ch(s, f, g, o); }
    b.nz(o, { t: 0.38, kind: 'pink', type: 'lowpass', f: 600, peak: 1, a: 0.0008, tau: 0.03 });
    b.tn(o, { t: 0.38, f: 180, peak: 0.5, a: 0.0008, tau: 0.04 });
    b.nz(o, { t: 0.385, type: 'highpass', f: 2500, peak: 0.8, a: 0.0003, tau: 0.003 });
    b.nz(o, { t: 0.68, type: 'bandpass', f: 2500, Q: 2, peak: 0.85, a: 0.0003, tau: 0.01 });
    b.tn(o, { t: 0.68, f: 1700, peak: 0.25, a: 0.0003, tau: 0.03 });
    b.nz(o, { t: 0.8, type: 'bandpass', f: 2000, Q: 1.5, peak: 1, a: 0.0003, tau: 0.012 });
    b.tn(o, { t: 0.8, f: 300, peak: 0.5, a: 0.0005, tau: 0.03 });
    [2400, 3900].forEach((f) => b.tn(o, { t: 0.8, f, peak: 0.2, a: 0.0003, tau: 0.04 }));
  } },
  explosion_big: { dur: 5.5, fn(b) {
    const o = b.g(1); o.connect(b.o);
    const hot = b.g(1); b.ch(hot, b.sh(3), o);
    b.nz(hot, { type: 'lowpass', f: 9000, peak: 0.9, a: 0.0005, tau: 0.018 });
    b.nz(hot, { type: 'bandpass', f: b.r(1800, 2600), Q: 0.8, peak: 0.6, a: 0.001, tau: 0.05 });
    const sb = b.g(1); b.ch(sb, b.sh(1.8), o);
    b.tn(sb, { f: b.r(95, 110), f1: b.r(40, 46), fd: 0.6, peak: 0.55, a: 0.004, tau: b.r(0.6, 0.75) });
    b.tn(sb, { f: b.r(180, 220), f1: b.r(60, 70), fd: 0.12, peak: 0.6, a: 0.002, tau: 0.13 });
    { const s = b.src('brown'), f = b.f('lowpass', 1400, 0.9), g = b.g(0); b.sweep(f.frequency, 0, 1400, 160, 1.4); b.perc(g.gain, 0, 2.2, 0.003, b.r(0.4, 0.5)); b.ch(s, f, g, hot); }
    { const s = b.src('pink'), f = b.f('bandpass', b.r(250, 350), 0.7), g = b.g(0); b.perc(g.gain, 0, 1.2, 0.004, 0.35); b.ch(s, f, g, hot); }
    { const s = b.src('pink'), f = b.f('bandpass', b.r(700, 1100), 0.6), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.7, 0.06); g.gain.setTargetAtTime(0.35, 0.06, 0.4); g.gain.setTargetAtTime(0, 1.2, 0.8); b.ch(s, f, g, o); }
    { const s = b.src('crackle'), f = b.f('highpass', 1200), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.55, 0.15); g.gain.setTargetAtTime(0, 0.5, 1.0); b.ch(s, f, g, o); }
    for (let k = 0; k < 34; k++) {
      const t = 0.1 + Math.min(3.8, -Math.log(1 - b.R() * 0.98) * 0.8), a = b.r(0.05, 0.3) * Math.exp(-t / 1.4);
      if (b.R() < 0.3) b.tn(o, { t, type: 'triangle', f: b.r(500, 1800), peak: a * 0.6, a: 0.0005, tau: b.r(0.02, 0.07) });
      else b.nz(o, { t, type: 'bandpass', f: b.r(1500, 6500), Q: b.r(2, 6), peak: a * 1.6, a: 0.0005, tau: b.r(0.004, 0.02) });
    }
    { const s = b.src('brown'), f = b.f('lowpass', 260), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.35); g.gain.setTargetAtTime(0, 0.5, 1.5); b.ch(s, f, g, o); }
  } },
  explosion_small: { dur: 1.2, fn(b) {
    const hot = b.g(1); b.ch(hot, b.sh(3), b.o);
    b.nz(hot, { type: 'lowpass', f: 5000, peak: 1, a: 0.0004, tau: 0.008 });
    b.tn(b.o, { f: b.r(150, 170), f1: 62, fd: 0.1, peak: 0.6, a: 0.002, tau: 0.1 });
    b.nz(hot, { kind: 'brown', type: 'lowpass', f: 900, peak: 1.4, a: 0.002, tau: 0.14 });
    for (let k = 0; k < 8; k++) b.nz(b.o, { t: b.r(0.05, 0.7), type: 'bandpass', f: b.r(1500, 5000), Q: 4, peak: b.r(0.05, 0.2), a: 0.0004, tau: 0.01 });
  } },
  rocket_launch: { dur: 1.8, fn(b) {
    const th = b.g(1); b.ch(th, b.sh(2), b.o);
    b.tn(th, { f: b.r(95, 105), f1: 45, fd: 0.1, peak: 1, a: 0.002, tau: 0.09 });
    b.nz(th, { kind: 'pink', type: 'lowpass', f: 800, peak: 0.8, a: 0.001, tau: 0.04 });
    const s = b.src('white'), f = b.f('bandpass', 900, 1), g = b.g(0);
    f.frequency.setValueAtTime(900, 0); f.frequency.exponentialRampToValueAtTime(3200, 0.25); f.frequency.exponentialRampToValueAtTime(1600, 1.3);
    b.perc(g.gain, 0, 0.6, 0.02, 0.45); b.ch(s, f, g, b.o);
    b.ch(b.src('crackle'), b.f('highpass', 2000), (() => { const x = b.g(0); b.perc(x.gain, 0, 0.3, 0.02, 0.5); return x; })(), b.o);
  } },
  metal_crash: { dur: 1.8, fn(b) {
    const hot = b.g(1); b.ch(hot, b.sh(4), b.o);
    const nH = 4 + Math.floor(b.R() * 3);
    for (let k = 0; k < nH; k++) {
      const t = k === 0 ? 0 : b.r(0.02, 0.55);
      b.nz(hot, { t, kind: 'brown', type: 'lowpass', f: 900, peak: b.r(0.5, 1), a: 0.001, tau: 0.05 });
      b.nz(b.o, { t, type: 'bandpass', f: b.r(1800, 3200), Q: 1.2, peak: 0.4, a: 0.0005, tau: 0.02 });
    }
    for (let k = 0; k < 6; k++) b.tn(b.o, { f: b.r(180, 1400), peak: b.r(0.08, 0.2), a: 0.001, tau: b.r(0.15, 0.5) });
    { const s = b.src('white'), f = b.f('bandpass', 1200, 2), l = b.osc('sine', b.r(6, 9)), lg = b.g(400), g = b.g(0);
      b.ch(l, lg, f.frequency); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.35, 0.06); g.gain.setTargetAtTime(0, 0.45, 0.35); b.ch(s, f, g, b.o); }
    for (let k = 0; k < 6; k++) b.tn(b.o, { t: b.r(0.05, 0.5), f: b.r(3000, 7000), peak: 0.06, a: 0.0003, tau: 0.02 });
  } },
  tire_screech: { dur: 1.8, fn(b) {
    const f0 = b.r(820, 1050), o = b.osc('sawtooth', f0), v1 = b.osc('sine', 9), v1g = b.g(25), v2 = b.osc('sine', 23), v2g = b.g(15);
    b.ch(v1, v1g, o.frequency); b.ch(v2, v2g, o.frequency);
    o.frequency.setValueAtTime(f0, 0); o.frequency.linearRampToValueAtTime(f0 * 0.93, 1.5);
    const env = b.env(1, 0.08, 1.1, 0.2), b1 = b.f('bandpass', f0, 6), b2 = b.f('bandpass', f0 * 2, 8), sum = b.g(1);
    o.connect(b1); o.connect(b2); b1.connect(sum); b2.connect(sum); b.ch(sum, env, b.o);
    const env2 = b.env(0.35, 0.08, 1.1, 0.2); b.ch(b.src('white'), b.f('bandpass', 2500, 1.5), env2, b.o);
  } },
  slowmo_in: { dur: 1.8, fn(b) {
    const s = b.src('pink'), f = b.f('lowpass', 200, 2), g = b.g(0);
    f.frequency.setValueAtTime(200, 0); f.frequency.exponentialRampToValueAtTime(4000, 0.85); f.frequency.setTargetAtTime(150, 0.86, 0.05);
    g.gain.setValueAtTime(0.01, 0); g.gain.exponentialRampToValueAtTime(1, 0.85); g.gain.setTargetAtTime(0, 0.86, 0.04); b.ch(s, f, g, b.o);
    const th = b.g(1); b.ch(th, b.sh(2), b.o);
    b.tn(th, { t: 0.85, f: 120, f1: 42, fd: 0.5, peak: 1.0, a: 0.004, tau: 0.4 });
    b.nz(th, { t: 0.85, kind: 'brown', type: 'lowpass', f: 400, peak: 1.0, a: 0.004, tau: 0.35 });
  } },
  slowmo_out: { dur: 0.9, fn(b) {
    const s = b.src('pink'), f = b.f('bandpass', 300, 1.2), g = b.g(0);
    f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(6000, 0.2);
    g.gain.setValueAtTime(0.01, 0); g.gain.exponentialRampToValueAtTime(0.8, 0.2); g.gain.setTargetAtTime(0, 0.2, 0.06); b.ch(s, f, g, b.o);
    b.nz(b.o, { t: 0.2, type: 'highpass', f: 2500, peak: 1, a: 0.0003, tau: 0.004 });
    b.tn(b.o, { t: 0.2, f: 110, f1: 55, fd: 0.1, peak: 0.5, a: 0.002, tau: 0.1 });
  } },
  hit_marker: { dur: 0.12, fn(b) {
    b.tn(b.o, { f: 2700, peak: 0.8, a: 0.0005, tau: 0.012 });
    b.tn(b.o, { f: 4100, peak: 0.3, a: 0.0005, tau: 0.008 });
    b.nz(b.o, { type: 'highpass', f: 6000, peak: 0.5, a: 0.0002, tau: 0.002 });
  } },
  kill_confirm: { dur: 0.5, fn(b) {
    b.tn(b.o, { f: 140, f1: 80, fd: 0.05, peak: 0.8, a: 0.001, tau: 0.05 });
    b.nz(b.o, { type: 'highpass', f: 4000, peak: 0.6, a: 0.0002, tau: 0.003 });
    [[1600, 0.45], [2400, 0.3], [3200, 0.12]].forEach(([f, p]) => b.tn(b.o, { f, peak: p, a: 0.0005, tau: 0.1 }));
    [[2133, 0.35], [3200, 0.18]].forEach(([f, p]) => b.tn(b.o, { t: 0.06, f, peak: p, a: 0.0005, tau: 0.14 }));
  } },
  player_hurt: { dur: 0.7, fn(b) {
    const th = b.g(1); b.ch(th, b.sh(2), b.o);
    b.tn(th, { f: 120, f1: 58, fd: 0.15, peak: 0.7, a: 0.003, tau: 0.13 });
    b.nz(th, { kind: 'brown', type: 'lowpass', f: 450, peak: 1.2, a: 0.002, tau: 0.12 });
  } },
  ear_ring: { dur: 2.8, fn(b) {
    [[3800, 0.6], [3871, 0.4], [7600, 0.05]].forEach(([f, p]) => { const o = b.osc('sine', f), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(p, 0.05); g.gain.setTargetAtTime(0, 0.15, 0.8); b.ch(o, g, b.o); });
  } },
  heli_flyby: { dur: 3.5, fn(b) {
    const c = b.c, sr = c.sampleRate, per = Math.round(sr / 20), pb = c.createBuffer(1, per, sr), d = pb.getChannelData(0);
    for (let k = 0; k < per; k++) d[k] = Math.exp((-k / per) * 7) * (1 - Math.exp(-k / (0.0015 * sr)));
    const p = c.createBufferSource(); p.buffer = pb; p.loop = true; p.start(0);
    p.playbackRate.setValueAtTime(1.08, 0); p.playbackRate.linearRampToValueAtTime(1.05, 1.4); p.playbackRate.linearRampToValueAtTime(0.85, 1.9); p.playbackRate.linearRampToValueAtTime(0.82, 3.5);
    const am = b.g(0); p.connect(am.gain);
    const bell = b.g(0); bell.gain.setValueAtTime(0.02, 0); bell.gain.exponentialRampToValueAtTime(1, 1.6); bell.gain.exponentialRampToValueAtTime(0.01, 3.4);
    b.ch(b.src('brown'), b.f('lowpass', 600, 1), am); b.ch(am, b.sh(1.5), bell, b.o);
    const am2 = b.g(0); p.connect(am2.gain); b.ch(b.src('white'), b.f('bandpass', 1200, 0.8), am2, b.g(0.3), bell);
    const wh = b.osc('sine', 2050); wh.frequency.setValueAtTime(2050, 0); wh.frequency.linearRampToValueAtTime(1980, 1.4); wh.frequency.linearRampToValueAtTime(1650, 1.9); b.ch(wh, b.g(0.05), bell);
    const ws = b.src('pink'), wf = b.f('bandpass', 700, 0.7); b.sweep(wf.frequency, 0, 500, 1400, 1.6); b.ch(ws, wf, b.g(0.35), bell);
  } },
  ui_select: { dur: 0.2, fn(b) {
    b.tn(b.o, { f: 880, peak: 0.7, a: 0.002, tau: 0.03 });
    b.tn(b.o, { t: 0.05, f: 1320, peak: 0.6, a: 0.002, tau: 0.04 });
  } },
};

// --- loop bakes (rendered len+xf, then loopified). All oscillator freqs are multiples of 1/len -> periodic.
function rotorPulse(c, hz) {
  const sr = c.sampleRate, per = Math.round(sr / hz), pb = c.createBuffer(1, per, sr), d = pb.getChannelData(0);
  for (let k = 0; k < per; k++) d[k] = Math.exp((-k / per) * 7) * (1 - Math.exp(-k / (0.0015 * sr)));
  const s = c.createBufferSource(); s.buffer = pb; s.loop = true; s.start(0); return s;
}
const LOOP_BAKES = {
  loop_heli: { dur: 2.25, loop: [2, 0.25], fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.6), b.o);
    { const g = b.g(0); rotorPulse(b.c, 20).connect(g.gain); b.ch(b.src('brown'), b.f('lowpass', 420, 1), g, o); }
    { const g = b.g(0); rotorPulse(b.c, 20).connect(g.gain); b.ch(b.osc('sine', 40), g, b.g(0.8), o); }
    { const g = b.g(0); rotorPulse(b.c, 20).connect(g.gain); b.ch(b.src('white'), b.f('bandpass', 1100, 0.9), g, b.g(0.28), o); }
    b.ch(b.osc('sawtooth', 97.5), b.f('lowpass', 600), b.g(0.1), o);
    b.ch(b.osc('sine', 1900), b.g(0.04), o); b.ch(b.osc('sine', 2850), b.g(0.015), o);
    b.ch(b.src('white'), b.f('highpass', 3500), b.g(0.05), o);
  } },
  loop_truck: { dur: 2.25, loop: [2, 0.25], fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.5), b.o);
    b.ch(b.osc('sawtooth', 66.5), b.f('lowpass', 320, 1.5), b.g(0.5), o);
    b.ch(b.osc('square', 33.5), b.f('lowpass', 140), b.g(0.45), o);
    const am = b.g(0.45); b.ch(b.osc('sine', 33.5), b.g(0.25), am.gain); b.ch(b.src('brown'), b.f('lowpass', 220), am, o);
    b.ch(b.src('pink'), b.f('bandpass', 260, 1.2), b.g(0.2), o);
  } },
  loop_suv: { dur: 2.25, loop: [2, 0.25], fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.8), b.o);
    b.ch(b.osc('sawtooth', 88.5), b.f('lowpass', 500, 1.5), b.g(0.5), o);
    b.ch(b.osc('square', 44.5), b.f('lowpass', 200), b.g(0.35), o);
    const am = b.g(0.4); b.ch(b.osc('sine', 44.5), b.g(0.2), am.gain); b.ch(b.src('brown'), b.f('lowpass', 300), am, o);
    b.ch(b.src('pink'), b.f('bandpass', 400, 1.2), b.g(0.25), o);
  } },
  loop_rocket: { dur: 1.75, loop: [1.5, 0.25], fn(b) {
    b.ch(b.src('white'), b.f('bandpass', 2800, 0.6), b.g(0.5), b.o);
    b.ch(b.src('white'), b.f('highpass', 6000), b.g(0.2), b.o);
    const am = b.g(0.6); b.ch(b.osc('sine', 14), b.g(0.15), am.gain); b.ch(b.src('pink'), b.f('lowpass', 700), am, b.o);
    b.ch(b.src('crackle'), b.f('highpass', 1000), b.g(0.35), b.o);
  } },
  loop_fire: { dur: 3.25, loop: [3, 0.25], fn(b) {
    b.ch(b.src('pink'), b.f('lowpass', 450), b.g(0.55), b.o);
    b.ch(b.src('brown'), b.f('lowpass', 150), b.g(0.4), b.o);
    b.ch(b.src('crackle'), b.f('highpass', 900), b.g(0.7), b.o);
    b.ch(b.src('crackle', 0, 0.7), b.f('bandpass', 3000, 1), b.g(0.3), b.o);
    for (let k = 0; k < 20; k++) b.nz(b.o, { t: b.r(0, 3.2), type: 'bandpass', f: b.r(1000, 3000), Q: 3, peak: b.r(0.1, 0.4), a: 0.0003, tau: 0.01 });
  } },
};
// --- Level 2 loops (baked with L2_BAKES after the music, see _init)
const L2_LOOP_BAKES = {
  loop_harbor: { dur: 6.5, loop: [6, 0.5], ch: 2, sr: 24000, fn(b) {
    const m = b.c.createChannelMerger(2); m.connect(b.o);
    for (let side = 0; side < 2; side++) {
      const o = b.g(1); o.connect(m, 0, side);
      b.ch(b.src('pink'), b.f('bandpass', 700, 0.4), b.g(0.07), o); // gentle wind / air
      const sw = b.g(0.12); b.ch(b.osc('sine', 1 / 6 * (side ? 1 : 2)), b.g(0.08), sw.gain); b.ch(b.src('brown'), b.f('bandpass', 220, 0.8), sw, o); // swell
      let t = b.r(0, 0.4); const G = []; // water slapping the quay wall
      while (t < 6.3) {
        const a = b.r(0.25, 1);
        G.push({ t, k: 'bp', f: b.r(140, 320), Q: 0.7, peak: 0.6 * a, a: b.r(0.04, 0.1), tau: b.r(0.1, 0.22) });
        G.push({ t: t + b.r(0.03, 0.1), k: 'bp', f: b.r(700, 1600), Q: 0.9, peak: 0.22 * a, a: b.r(0.02, 0.05), tau: b.r(0.05, 0.12) });
        if (b.R() < 0.5) G.push({ t: t + b.r(0.08, 0.2), k: 'bp', f: b.r(1800, 3500), Q: 1.2, peak: 0.07 * a, a: 0.01, tau: 0.04 }); // splash fizz
        for (let k = 0; k < 3; k++) if (b.R() < 0.6) G.push({ t: t + b.r(0.1, 0.5), f: b.r(600, 1600), peak: 0.03 * a, a: 0.002, tau: 0.012 }); // drips / bubbles
        t += b.r(0.45, 1.3);
      }
      grains(b, o, G);
    }
    const hum = b.g(1); hum.connect(b.o); // distant port machinery (centred)
    [[60, 0.01], [120, 0.012], [180, 0.006]].forEach(([f, g]) => b.ch(b.osc('sine', f), b.g(g), hum));
    b.ch(b.src('brown'), b.f('bandpass', 110, 1), b.g(0.05), hum);
  } },
  loop_crane_motor: { dur: 2.25, loop: [2, 0.25], sr: 24000, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.3), b.o);
    [[310, 0.12], [620, 0.06], [930, 0.035], [1860, 0.02]].forEach(([f, g]) => b.ch(b.osc('sine', f), b.g(g), o)); // motor whine
    b.ch(b.osc('sawtooth', 120), b.f('lowpass', 500, 2), b.g(0.12), o); // field hum
    const gm = b.g(0); rotorPulse(b.c, 38).connect(gm.gain); b.ch(b.src('white'), b.f('bandpass', 1500, 1.5), gm, b.g(0.25), o); // gear mesh
    const gb = b.g(0.6); b.ch(b.osc('sine', 4.5), b.g(0.3), gb.gain); b.ch(b.osc('square', 76), b.f('lowpass', 300), gb, b.g(0.12), o); // gearbox
    b.ch(b.src('brown'), b.f('lowpass', 200), b.g(0.25), o);
    b.ch(b.src('pink'), b.f('highpass', 3000), b.g(0.03), o);
  } },
  loop_forklift: { dur: 2.25, loop: [2, 0.25], sr: 24000, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.8), b.o);
    const hz = 26; // ~780 rpm 4-cyl diesel idle
    { const g = b.g(0); rotorPulse(b.c, hz).connect(g.gain); b.ch(b.src('brown'), b.f('lowpass', 380, 1), g, b.g(0.9), o); }
    b.ch(b.osc('sawtooth', hz), b.f('highpass', 45), b.f('lowpass', 260, 1.5), b.g(0.35), o);
    b.ch(b.osc('square', hz * 2), b.f('lowpass', 160), b.g(0.12), o);
    { const g = b.g(0); rotorPulse(b.c, hz).connect(g.gain); b.ch(b.src('white'), b.f('bandpass', 2200, 1.2), g, b.g(0.22), o); } // injector clatter
    b.ch(b.src('pink'), b.f('bandpass', 700, 1.2), b.g(0.1), o);
    b.ch(b.osc('sine', 1450), b.g(0.008), o); // hydraulic pump whine
  } },
  loop_fire_big: { dur: 3.25, loop: [3, 0.25], sr: 32000, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.3), b.o);
    const am = b.g(0.6); [[2 / 3, 0.18], [5 / 3, 0.12], [10 / 3, 0.08]].forEach(([f, d]) => b.ch(b.osc('sine', f), b.g(d), am.gain)); // turbulent breathing
    b.ch(b.src('brown'), b.f('bandpass', 90, 0.6), b.g(0.9), am, o);
    b.ch(b.src('pink'), b.f('lowpass', 320), b.g(0.8), am);
    { const fl = b.g(0.5); b.ch(b.src('white'), b.f('lowpass', 12), b.g(8), fl.gain); b.ch(b.src('pink'), b.f('bandpass', 700, 0.7), fl, b.g(0.3), o); } // flutter
    b.ch(b.src('crackle', 0, 0.55), b.f('bandpass', 1400, 0.8), b.g(0.45), o); // deep pops
    b.ch(b.src('crackle', 0, 0.9), b.f('highpass', 2500), b.g(0.25), o);
    const G = [];
    for (let k = 0; k < 10; k++) G.push({ t: b.r(0, 3.1), k: 'bp', f: b.r(150, 400), Q: 0.8, peak: b.r(0.15, 0.4), a: 0.05, tau: 0.15 }); // gusts
    for (let k = 0; k < 14; k++) G.push({ t: b.r(0, 3.2), k: 'bp', f: b.r(800, 2500), Q: 3, peak: b.r(0.08, 0.3), a: 0.0003, tau: 0.012 });
    grains(b, o, G);
  } },
  loop_sodium_hum: { dur: 1.1, loop: [1, 0.1], fn(b) {
    const o = b.o;
    [[120, 0.4], [240, 0.25], [360, 0.12], [480, 0.06]].forEach(([f, g]) => b.ch(b.osc('sine', f), b.g(g), o)); // ballast magnetostriction
    const bz = b.g(0.7); b.ch(b.osc('sine', 3), b.g(0.25), bz.gain); b.ch(b.osc('sawtooth', 120), b.f('highpass', 2000), b.f('lowpass', 6000), bz, b.g(0.2), o); // arc buzz
    b.ch(b.src('crackle', 0, 1.5), b.f('highpass', 4000), b.g(0.04), o);
  } },
};

// --- Level 3 bakes (Downtown Haven City)
const L3_BAKES = {
  sniper_shot: { dur: 3.2, sr: 32000, fn(b) {
    const o = b.o, bus = b.g(1); b.ch(bus, b.sh(2.2), o);
    b.nz(bus, { type: 'highpass', f: 3000, peak: 1.2, a: 0.0002, tau: 0.003 }); // supersonic crack
    b.nz(bus, { type: 'bandpass', f: b.r(1600, 2000), Q: 0.7, peak: 1.2, a: 0.0004, tau: 0.03 });
    b.tn(bus, { f: 160, f1: 45, fd: 0.18, peak: 0.9, a: 0.001, tau: 0.12 }); // muzzle boom
    b.nz(bus, { kind: 'brown', type: 'lowpass', f: 400, peak: 0.8, a: 0.002, tau: 0.25 });
    [[0.21, 1600, 0.45], [0.43, 1100, 0.32], [0.71, 800, 0.22], [1.1, 600, 0.14], [1.6, 450, 0.08]].forEach(([d, f, g]) => b.ch(bus, b.dly(d), b.f('lowpass', f), b.g(g), o)); // the canyon throws it back
    b.nz(o, { kind: 'pink', type: 'lowpass', f: 700, peak: 0.25, a: 0.05, tau: 0.9 });
  } },
  laser_lock: { dur: 0.15, fn(b) {
    b.tn(b.o, { f: 2400, peak: 0.6, a: 0.002, tau: 0.03 }); b.tn(b.o, { f: 4800, peak: 0.12, a: 0.002, tau: 0.02 });
  } },
  collapse_rumble: { dur: 6.5, sr: 24000, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.5), b.o);
    { const s = b.src('brown'), f = b.f('lowpass', 140, 0.8), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1.0, 1.2); g.gain.setValueAtTime(1.0, 4.5); g.gain.linearRampToValueAtTime(0, 6.4); b.ch(s, f, g, o); }
    { const x = b.osc('sine', 38); x.frequency.setValueAtTime(38, 0); x.frequency.linearRampToValueAtTime(26, 6); const g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.7, 1.5); g.gain.linearRampToValueAtTime(0, 6.3); b.ch(x, g, o); }
    { const s = b.src('crackle', 0, 0.4), f = b.f('bandpass', 600, 0.8), g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 2); g.gain.linearRampToValueAtTime(0, 6.3); b.ch(s, f, g, o); }
    for (let k = 0; k < 5; k++) ring(b, o, b.r(0.3, 4.5), b.r(55, 110), [1, 1.42, 2.13, 2.9], { peak: 0.35, tau: 0.9, tauFall: 0.3, det: 0.01 }); // steel frame groaning
  } },
  collapse_impact: { dur: 4.0, sr: 32000, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(2.5), b.o);
    b.tn(o, { f: 70, f1: 28, fd: 0.6, peak: 1.0, a: 0.004, tau: 0.8 });
    b.nz(o, { kind: 'brown', type: 'lowpass', f: 300, peak: 1.0, a: 0.003, tau: 0.7 });
    b.nz(o, { kind: 'pink', type: 'bandpass', f: 900, Q: 0.6, peak: 0.8, a: 0.002, tau: 0.25 });
    b.nz(o, { kind: 'crackle', type: 'highpass', f: 1500, peak: 0.7, a: 0.01, tau: 0.6, rate: 0.8 });
    const G = []; for (let k = 0; k < 40; k++) { const t = b.r(0.1, 2.8); G.push({ t, f: b.r(2500, 9000), peak: b.r(0.03, 0.12) * Math.exp(-t / 1.5), a: 0.0003, tau: b.r(0.01, 0.04) }); }
    grains(b, o, G);
  } },
  glass_rain: { dur: 4.2, fn(b) {
    const o = b.o;
    b.nz(o, { type: 'highpass', f: 5000, peak: 0.25, a: 0.3, tau: 1.2 });
    const G = [];
    for (let k = 0; k < 160; k++) { const t = Math.min(4, Math.pow(b.R(), 1.6) * 3.8); G.push({ t, f: b.r(2800, 10000), peak: b.r(0.04, 0.18), a: 0.0003, tau: b.r(0.006, 0.04) }); if (b.R() < 0.3) G.push({ t, k: 'bp', f: b.r(3000, 7000), Q: 4, peak: b.r(0.04, 0.1), a: 0.0003, tau: 0.008 }); }
    grains(b, o, G);
  } },
};
L3_BAKES.birds_flap = { dur: 2.2, fn(b) {
  // a flock taking off: dozens of soft wing claps, dense at first, thinning out as they climb away
  const G = [];
  for (let k = 0; k < 140; k++) { const t = Math.pow(b.R(), 1.8) * 1.9; G.push({ t, k: 'bp', f: b.r(450, 1300), Q: 1.2, peak: b.r(0.15, 0.45) * (1 - t / 2.4), a: 0.004, tau: b.r(0.015, 0.03) }); }
  for (let k = 0; k < 6; k++) G.push({ t: b.r(0.05, 0.6), k: 'bp', f: b.r(1800, 2600), Q: 6, peak: 0.06, a: 0.01, tau: 0.05 }); // a coo or two
  grains(b, b.o, G);
} };
const L3_LOOP_BAKES = {
  loop_car_alarm: { dur: 2.25, loop: [2, 0.25], fn(b) {
    const o = b.g(0.5); b.ch(o, b.f('bandpass', 1500, 0.7), b.o);
    const lfo = b.osc('triangle', 2);
    const x = b.osc('square', 1100), lg = b.g(450); b.ch(lfo, lg); lg.connect(x.frequency); b.ch(x, b.g(0.6), o);
    const x2 = b.osc('square', 1650), lg2 = b.g(600); lfo.connect(lg2); lg2.connect(x2.frequency); b.ch(x2, b.g(0.15), o);
  } },
  loop_dust_roar: { dur: 3.25, loop: [3, 0.25], sr: 24000, fn(b) {
    const o = b.g(1); b.ch(o, b.sh(1.4), b.o);
    b.ch(b.src('brown'), b.f('lowpass', 220), b.g(1.2), o);
    const am = b.g(0.6); [[1 / 3, 0.2], [2 / 3, 0.15], [4 / 3, 0.1]].forEach(([f, d]) => b.ch(b.osc('sine', f), b.g(d), am.gain));
    b.ch(b.src('pink'), b.f('bandpass', 500, 0.5), am, b.g(0.8), o);
    b.ch(b.src('white'), b.f('highpass', 3000), b.g(0.12), o);
    b.ch(b.src('crackle', 0, 0.6), b.f('bandpass', 1200, 0.8), b.g(0.3), o);
  } },
  loop_city: { dur: 6.5, loop: [6, 0.5], sr: 24000, fn(b) {
    const o = b.o;
    b.ch(b.src('brown'), b.f('lowpass', 180), b.g(0.5), o); // far traffic / rumble
    b.ch(b.src('pink'), b.f('bandpass', 700, 0.4), b.g(0.12), o);
    const s = b.osc('sine', 850), lfo = b.osc('sine', 1 / 3), lg = b.g(250); b.ch(lfo, lg); lg.connect(s.frequency); // distant siren
    const sg = b.g(0.06); b.ch(s, sg, b.f('lowpass', 1500), o); b.ch(sg, b.dly(0.37), b.g(0.5), b.f('lowpass', 900), o);
    const s2 = b.osc('sine', 700), lfo2 = b.osc('sine', 0.5), lg2 = b.g(180); b.ch(lfo2, lg2); lg2.connect(s2.frequency);
    b.ch(s2, b.g(0.03), b.f('lowpass', 1200), o);
  } },
};

// --- music bakes
const CHORDS = [
  { root: 0, pad: [38, 45, 50, 53, 57], brass: [38, 45, 50, 53], choir: [57, 62, 65, 69] }, // Dm
  { root: -4, pad: [34, 41, 46, 50, 53], brass: [34, 41, 46, 50], choir: [58, 62, 65, 70] }, // Bb
  { root: 3, pad: [41, 48, 53, 57, 60], brass: [41, 48, 53, 57], choir: [57, 60, 65, 69] }, // F
  { root: -2, pad: [36, 43, 48, 52, 55], brass: [36, 43, 48, 52], choir: [55, 60, 64, 67] }, // C
];
const PAD_LEN = S16 * 32; // 2 bars
function bakePad(b, notes, rel = PAD_LEN) {
  const sum = b.g(1), env = b.env(1, 0.6, rel, 0.45), lp = b.f('lowpass', 1100, 0.5), vib = b.vib(5.2, 4);
  notes.forEach((m) => { const ng = b.g(m < 45 ? 0.6 : 1); ng.connect(sum); b.stack(ng, m, 2, 7, 'sawtooth', vib); });
  b.ch(sum, lp, env, b.o);
}
function bakeChoir(b, notes) {
  const src = b.g(1), env = b.env(1, 0.8, PAD_LEN, 0.5);
  notes.forEach((m) => { const v = b.vib(b.r(4.8, 5.8), b.r(9, 14)); b.stack(src, m, 3, 10, 'sawtooth', v); });
  b.ch(b.src('pink'), b.f('bandpass', 1200, 0.8), b.g(0.15), src);
  const out = b.g(1);
  [[750, 5, 1], [1150, 7, 0.55], [2600, 9, 0.25]].forEach(([f, Q, g]) => b.ch(src, b.f('bandpass', f, Q), b.g(g), out));
  b.ch(out, env, b.o);
}
function bakeBrass(b, notes, dur = 1.2, sweep = [120, 2600, 1000]) {
  const sum = b.g(1), lp = b.f('lowpass', sweep[0], 1.5), env = b.env(1, 0.02, dur, 0.2);
  lp.frequency.setValueAtTime(sweep[0], 0); lp.frequency.exponentialRampToValueAtTime(sweep[1], 0.07); lp.frequency.setTargetAtTime(sweep[2], 0.07, 0.25);
  notes.forEach((m) => b.stack(sum, m, 3, 9, 'sawtooth'));
  b.stack(sum, notes[0] - 12, 1, 0, 'square');
  b.ch(sum, b.g(0.3), lp, b.sh(2), env, b.o);
}
function bakeHit(b, o, big = 1) {
  const th = b.g(1); b.ch(th, b.sh(3), o);
  b.tn(th, { f: 73.4, f1: 36.7, fd: 0.5, peak: 1 * big, a: 0.003, tau: 0.7 });
  b.nz(th, { kind: 'brown', type: 'lowpass', f: 220, peak: 0.6 * big, a: 0.003, tau: 0.4 });
  b.tn(o, { f: 130, f1: 73.4, fd: 0.08, peak: 0.7, a: 0.002, tau: 0.35 });
  b.nz(o, { kind: 'pink', type: 'lowpass', f: 900, peak: 0.5, a: 0.001, tau: 0.03 });
  b.nz(o, { type: 'highpass', f: 4500, peak: 0.25, a: 0.002, tau: 0.7 });
}
const MUSIC_BAKES = {
  kick: { dur: 0.6, fn(b) { const th = b.g(1); b.ch(th, b.sh(2), b.o); b.tn(th, { f: 160, f1: 55, fd: 0.06, peak: 1, a: 0.001, tau: 0.18 }); b.nz(b.o, { type: 'highpass', f: 3000, peak: 0.4, a: 0.0003, tau: 0.004 }); } },
  snare: { dur: 0.5, fn(b) { b.nz(b.o, { type: 'bandpass', f: 2000, Q: 0.7, peak: 1, a: 0.0005, tau: 0.09 }); b.nz(b.o, { type: 'highpass', f: 5000, peak: 0.5, a: 0.0005, tau: 0.05 }); b.tn(b.o, { type: 'triangle', f: 196, f1: 174.6, fd: 0.05, peak: 0.8, a: 0.0005, tau: 0.06 }); } },
  taikoLo: { dur: 1.4, fn(b) { const th = b.g(1); b.ch(th, b.sh(1.5), b.o); b.tn(th, { f: 130, f1: 73.4, fd: 0.08, peak: 1, a: 0.002, tau: 0.35 }); b.tn(th, { f: 260, f1: 146.8, fd: 0.08, peak: 0.25, a: 0.002, tau: 0.1 }); b.nz(th, { kind: 'pink', type: 'lowpass', f: 900, peak: 0.6, a: 0.001, tau: 0.03 }); } },
  taikoHi: { dur: 0.8, fn(b) { b.tn(b.o, { f: 200, f1: 110, fd: 0.06, peak: 1, a: 0.001, tau: 0.2 }); b.nz(b.o, { kind: 'pink', type: 'lowpass', f: 1500, peak: 0.6, a: 0.001, tau: 0.025 }); } },
  boom: { dur: 2.5, fn(b) { bakeHit(b, b.o, 1.2); } },
  crash: { dur: 2.5, fn(b) { b.nz(b.o, { type: 'highpass', f: 4500, peak: 0.8, a: 0.002, tau: 0.7 }); b.nz(b.o, { type: 'bandpass', f: 7000, Q: 1, peak: 0.4, a: 0.002, tau: 0.5 }); } },
  tick: { dur: 0.08, fn(b) { b.nz(b.o, { type: 'highpass', f: 7000, peak: 1, a: 0.0003, tau: 0.012 }); } },
  ostLo: { dur: 0.45, fn(b) { bakeOst(b, 38, 3500); } },
  ostHi: { dur: 0.45, fn(b) { bakeOst(b, 50, 4500); } },
  ostDark: { dur: 0.6, fn(b) {
    const sum = b.g(1), env = b.g(0); b.perc(env.gain, 0, 1, 0.012, 0.11);
    b.stack(sum, 38, 2, 10); b.stack(sum, 26, 1, 0, 'triangle');
    b.ch(sum, b.f('lowpass', 420, 1), env, b.o);
  } },
  braaam: { dur: 7, fn(b) {
    const sum = b.g(0.25), lp = b.f('lowpass', 80, 2), env = b.g(0);
    lp.frequency.setValueAtTime(80, 0); lp.frequency.exponentialRampToValueAtTime(2200, 0.35); lp.frequency.setTargetAtTime(500, 1.2, 1.4);
    env.gain.setValueAtTime(0, 0); env.gain.linearRampToValueAtTime(1, 0.05); env.gain.setValueAtTime(1, 2.2); env.gain.setTargetAtTime(0, 2.2, 1.2);
    [26, 38, 45, 50].forEach((m) => b.stack(sum, m, 4, 18));
    b.ch(sum, lp, b.sh(3), env, b.o);
    b.ch(b.osc('sine', mhz(26)), (() => { const g = b.g(0); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.6, 0.05); g.gain.setTargetAtTime(0, 1.5, 1.5); return g; })(), b.o);
    bakeHit(b, b.o, 1.3);
  } },
  victory: { dur: 9, fn(b) {
    bakeHit(b, b.o, 1.3);
    const br = b.g(1); b.ch(br, b.g(0.9), b.o); bakeBrass({ __proto__: b, o: br }, [38, 45, 50, 54, 57, 62], 3.0, [150, 2400, 900]);
    const st = b.g(0.7); st.connect(b.o);
    { const sum = b.g(1), env = b.env(1, 0.3, 3.2, 1.8), vib = b.vib(5, 5); [62, 66, 69, 74].forEach((m) => b.stack(sum, m, 2, 8, 'sawtooth', vib)); b.ch(sum, b.f('lowpass', 2500, 0.5), b.g(0.5), env, st); }
    { const sum = b.g(1), env = b.env(1, 0.2, 3.5, 2.0), vib = b.vib(5, 5); [26, 38, 45].forEach((m) => b.stack(sum, m, 2, 8, 'sawtooth', vib)); b.ch(sum, b.f('lowpass', 600, 0.5), b.g(0.5), env, st); }
  } },
};
function bakeOst(b, midi, fc) {
  const sum = b.g(1), lp = b.f('lowpass', fc, 3), env = b.g(0);
  lp.frequency.setValueAtTime(fc, 0); lp.frequency.setTargetAtTime(500, 0.005, 0.05);
  b.perc(env.gain, 0, 1, 0.003, 0.07);
  b.stack(sum, midi, 2, 12); b.stack(sum, midi, 1, 0, 'square');
  b.ch(sum, b.g(0.4), lp, b.sh(1.5), env, b.o);
}
CHORDS.forEach((ch, i) => {
  MUSIC_BAKES['pad' + i] = { dur: PAD_LEN + 2, fn(b) { bakePad(b, ch.pad); } };
  MUSIC_BAKES['choir' + i] = { dur: PAD_LEN + 2, fn(b) { bakeChoir(b, ch.choir); } };
  MUSIC_BAKES['brass' + i] = { dur: 1.9, fn(b) { bakeBrass(b, ch.brass); } };
});

// ---------------------------------------------------------------- the system
export class AudioSystem {
  constructor() {
    this.ctx = null; this._ready = false; this._mReady = false; this._initP = null; this._when = undefined;
    this.buf = {}; this.voices = []; this.byName = {}; this.loops = new Map(); this._last = {};
    this.L = [0, 1.65, 0]; this._ts = 1; this._sfxRate = 1; this._mRate = 1;
    this.R = rng(1337); this._exRecent = [];
    this.mOn = false; this.mInt = 0; this.mStep = 0; this.mNext = 0; this.mStopAt = null; this.mActive = new Set(); this._mPending = null;
  }
  get ready() { return this._ready; }
  get extrasReady() { return !!this._xReady; } // Level 2 sound set baked (see _init)
  _now() { return this._when ?? this.ctx.currentTime; }

  init(ctx) { if (!this._initP) this._initP = this._init(ctx); return this._initP; }
  async _init(ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    const c = ctx || new AC({ latencyHint: 'interactive' });
    this.ctx = c;
    this._offline = typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext;
    if (!this._offline && c.state !== 'running') {
      c.resume().catch(() => {});
      const kick = () => { if (c.state !== 'running') c.resume().catch(() => {}); };
      if (typeof addEventListener === 'function') ['pointerdown', 'keydown', 'touchend'].forEach((e) => addEventListener(e, kick, { passive: true }));
    }
    this._buildMaster();
    if (!this._offline) { try { this._hrtfWarm = this._panner(true, 1); } catch (e) {} } // load HRTF database now, not on first gunshot
    this.N = makeNoise(c);
    this.conv.buffer = makeIR(c);
    await this._bakeSet(Object.assign({}, BAKES, LOOP_BAKES));
    this._ready = true;
    if (this._ts !== 1) { const s = this._ts; this._ts = 1; this.setTimeScale(s); }
    const mp = this._bakeSet(MUSIC_BAKES).then(() => {
      this._mReady = true;
      const p = this._mPending; this._mPending = null;
      if (p && p.start) this.startMusic();
    });
    // Level 2 + 3 sounds bake in the background after the music so they don't delay start-up; until they are in,
    // play() of those names is a silent no-op and setLoop() retries on the next call.
    const xp = mp.catch(() => {}).then(() => this._bakeSet(Object.assign({}, L2_BAKES, L2_LOOP_BAKES, L3_BAKES, L3_LOOP_BAKES))).then(() => { this._xReady = true; });
    if (this._offline) { await mp; await xp; } else { mp.catch((e) => console.warn('music bake failed', e)); xp.catch((e) => console.warn('L2 bake failed', e)); }
  }

  _buildMaster() {
    const c = this.ctx, G = (v = 1) => { const g = c.createGain(); g.gain.value = v; return g; };
    const ny = c.sampleRate / 2;
    this.fMax = Math.min(20000, ny * 0.9);
    this.dry = G(1); this.sfx = G(0.42); this.amb = G(1); this.post = G(0.6);
    this.ambHP = c.createBiquadFilter(); this.ambHP.type = 'highpass'; this.ambHP.frequency.value = 55; this.ambHP.Q.value = 0.6;
    this.sfx.connect(this.dry); this.amb.connect(this.ambHP); this.ambHP.connect(this.dry);
    // reverb send bus
    this.verbIn = G(1); this.conv = c.createConvolver(); this.verbOut = G(0.55);
    this.verbIn.connect(this.conv); this.conv.connect(this.verbOut);
    // slow-mo extra send
    this.slowSend = G(0); this.dry.connect(this.slowSend); this.slowSend.connect(this.verbIn);
    // concussion LP and slow-mo LP
    this.conc = c.createBiquadFilter(); this.conc.type = 'lowpass'; this.conc.frequency.value = this.fMax; this.conc.Q.value = 0.5;
    this.slowLP = c.createBiquadFilter(); this.slowLP.type = 'lowpass'; this.slowLP.frequency.value = this.fMax; this.slowLP.Q.value = 0.7;
    this.hp = c.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 30; this.hp.Q.value = 0.6;
    this.dry.connect(this.conc); this.verbOut.connect(this.conc); this.conc.connect(this.slowLP);
    // dynamics
    this.glue = c.createDynamicsCompressor();
    Object.entries({ threshold: -14, knee: 8, ratio: 3.5, attack: 0.004, release: 0.22 }).forEach(([k, v]) => (this.glue[k].value = v));
    this.lim = c.createDynamicsCompressor();
    Object.entries({ threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.12 }).forEach(([k, v]) => (this.lim[k].value = v));
    this.master = G(1.15); this.clipIn = G(0.5); this.clip = c.createWaveShaper(); this.clip.curve = clipCurve();
    this.slowLP.connect(this.hp); this.hp.connect(this.glue); this.post.connect(this.glue);
    this.glue.connect(this.lim); this.lim.connect(this.master); this.master.connect(this.clipIn); this.clipIn.connect(this.clip); this.clip.connect(c.destination);
    // music: layers -> mSumD/W -> fade -> duck -> dry / verbIn
    this.mSumD = G(0.085); this.mSumW = G(0.085); this.mFadeD = G(1); this.mFadeW = G(1); this.mDuckD = G(1); this.mDuckW = G(1);
    this.mHP = c.createBiquadFilter(); this.mHP.type = 'highpass'; this.mHP.frequency.value = 45; this.mHP.Q.value = 0.6;
    this.mSumD.connect(this.mHP); this.mHP.connect(this.mFadeD); this.mFadeD.connect(this.mDuckD); this.mDuckD.connect(this.dry);
    this.mSumW.connect(this.mFadeW); this.mFadeW.connect(this.mDuckW); this.mDuckW.connect(this.verbIn);
    const sends = { drone: 0.3, perc: 0.16, percWet: 0.55, ost: 0.12, brass: 0.3, choir: 0.45, sting: 0.45 };
    this.mL = {};
    for (const [k, s] of Object.entries(sends)) {
      const g = G(k === 'sting' ? 1 : 0), w = G(s); g.connect(this.mSumD); g.connect(w); w.connect(this.mSumW);
      this.mL[k] = { g, target: k === 'sting' ? 1 : 0, until: 0 };
    }
  }

  async _bakeSet(defs) {
    const c = this.ctx, sr = c.sampleRate, jobs = [];
    for (const [key, d] of Object.entries(defs)) {
      const n = d.n ?? SFX[key]?.n ?? 1;
      for (let i = 0; i < n; i++) jobs.push({ key, i, d });
    }
    const run = async (j) => {
      const bsr = j.d.sr ? Math.min(sr, j.d.sr) : sr; // optional reduced bake rate for band-limited sounds (resampled on playback)
      const len = Math.ceil(j.d.dur * bsr), oc = new OfflineAudioContext(j.d.ch || 1, len, bsr);
      j.d.fn(new Bk(oc, this.N, rng(hashStr(j.key) + j.i * 7919)), j.i);
      let buf = await oc.startRendering();
      if (j.d.loop) { buf = loopify(c, buf, j.d.loop[0], j.d.loop[1]); normalize(buf, 1, 0); }
      else normalize(buf, 1, 0.015);
      (this.buf[j.key] ||= [])[j.i] = buf;
    };
    let next = 0;
    const worker = async () => { while (next < jobs.length) { const j = jobs[next++]; await run(j); } };
    await Promise.all(Array.from({ length: 6 }, worker));
  }

  // ---------------------------------------------------------------- listener / time scale
  setListener(px, py, pz, fx, fy, fz, ux, uy, uz) {
    this.L[0] = px; this.L[1] = py; this.L[2] = pz;
    if (!this._ready) return;
    const l = this.ctx.listener, t = this._now();
    if (l.positionX) {
      const v = [px, py, pz, fx, fy, fz, ux, uy, uz], ps = [l.positionX, l.positionY, l.positionZ, l.forwardX, l.forwardY, l.forwardZ, l.upX, l.upY, l.upZ];
      for (let i = 0; i < 9; i++) { if (this._offline) ps[i].linearRampToValueAtTime(v[i], t); else ps[i].value = v[i]; }
    } else { l.setPosition(px, py, pz); l.setOrientation(fx, fy, fz, ux, uy, uz); }
  }
  _dist(x, y, z) { return Math.hypot(x - this.L[0], (y ?? 0) - this.L[1], z - this.L[2]); }

  setTimeScale(s) {
    s = clamp(+s || 1, 0.05, 1);
    if (!this._ready) { this._ts = s; return; }
    if (Math.abs(s - this._ts) < 0.01 && !(s === 1 && this._ts !== 1)) return;
    this._ts = s;
    const t = this._now(), k = clamp((1 - s) / 0.75, 0, 1);
    this._sfxRate = 0.35 + 0.65 * s;
    this._mRate = 0.6 + 0.4 * s;
    this.slowLP.frequency.setTargetAtTime(this.fMax * Math.pow(1700 / this.fMax, k), t, 0.08);
    this.slowLP.Q.setTargetAtTime(0.7 + 0.5 * k, t, 0.08);
    this.slowSend.gain.setTargetAtTime(0.5 * k, t, 0.1);
    for (const L of this.loops.values()) this._loopRate(L, t);
    for (const n of this.mActive) n.src.playbackRate.setTargetAtTime(n.base * this._mRate, t, 0.12);
  }

  // ---------------------------------------------------------------- one-shots
  play(name, opts = {}) {
    if (!this._ready) return;
    const def = SFX[name], bufs = this.buf[name];
    if (!def || !bufs) return;
    opts = opts || {};
    const c = this.ctx, t = this._now();
    // pick variant (avoid immediate repeat)
    let vi = Math.floor(this.R() * bufs.length);
    if (bufs.length > 1 && vi === this._last[name]) vi = (vi + 1) % bufs.length;
    this._last[name] = vi;
    const buf = bufs[vi];
    if (!buf) return; // variant still baking
    // voice limits
    const list = (this.byName[name] ||= []);
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead || list[i].end < t) list.splice(i, 1);
    let live = list.filter((v) => !v.stopping);
    if (live.length >= def.max) this._steal(live[0], t);
    if (this.voices.length > 64) this.voices = this.voices.filter((v) => !v.dead && v.end >= t);
    live = this.voices.filter((v) => !v.stopping && !v.dead && v.end >= t);
    if (live.length >= 40) this._steal(live[0], t);

    let rate = (opts.pitch ?? 1) * (def.noTime ? 1 : this._sfxRate) * (1 + (this.R() * 2 - 1) * (def.vary || 0));
    rate = clamp(rate, 0.1, 4);
    let vol = (opts.volume ?? 1) * def.gain * (1 + (this.R() * 2 - 1) * (def.vary || 0) * 1.5);
    if (name === 'explosion_big') {
      this._exRecent = this._exRecent.filter((x) => t - x < 0.7);
      vol *= 1 / (1 + 0.35 * this._exRecent.length);
      this._exRecent.push(t);
      this._duck(t);
    }
    else if (def.duck) this._duck(t);
    if (!(vol > 0.0001)) return;

    const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = vol; src.connect(g);
    const nodes = [src, g];
    const bus = def.post ? this.post : this.sfx;
    const spatial = !def.twoD && Number.isFinite(opts.x) && Number.isFinite(opts.z);
    let wet = def.verb || 0;
    if (spatial) {
      const y = Number.isFinite(opts.y) ? opts.y : this.L[1];
      const d = this._dist(opts.x, y, opts.z);
      let node = g;
      if (d > 14) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(this.fMax * Math.pow(14 / d, 1.25), 900, this.fMax); g.connect(lp); node = lp; nodes.push(lp); }
      const p = this._panner(def.hrtf, def.roll ?? 1); p.positionX.value = opts.x; p.positionY.value = y; p.positionZ.value = opts.z;
      node.connect(p); p.connect(bus); nodes.push(p);
      wet *= 1 / (1 + d / 60);
      if (def.sub) {
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = 0.7;
        const sg = c.createGain(); sg.gain.value = def.sub / (1 + Math.max(0, d - 4) / 30);
        g.connect(lp); lp.connect(sg); sg.connect(bus); nodes.push(lp, sg);
      }
      if (name === 'explosion_big' && d < 25) this._conc(t, 0.35 * (1 - d / 25), 0.4);
      else if (def.conc && d < def.conc[0]) this._conc(t, def.conc[1] * (1 - d / def.conc[0]) * clamp(opts.volume ?? 1, 0, 1), def.conc[2]);
    } else g.connect(bus);
    if (wet > 0.001) { const s = c.createGain(); s.gain.value = wet; g.connect(s); s.connect(this.verbIn); nodes.push(s); }

    if (name === 'ear_ring') this._conc(t, clamp(opts.volume ?? 1, 0, 1), 1.2);
    if (name === 'player_hurt') this._conc(t, 0.4 * clamp(opts.volume ?? 1, 0, 1), 0.3);

    src.start(t);
    const v = { name, src, g, nodes, t0: t, end: t + buf.duration / rate + 0.05, dead: false, stopping: false };
    src.onended = () => { if (v.dead) return; v.dead = true; for (const n of nodes) { try { n.disconnect(); } catch (e) {} } };
    list.push(v); this.voices.push(v);
  }
  _panner(hrtf, roll) {
    const p = this.ctx.createPanner();
    p.panningModel = hrtf && !this._offline ? 'HRTF' : 'equalpower';
    p.distanceModel = 'inverse'; p.refDistance = 4; p.rolloffFactor = roll; p.maxDistance = 10000;
    return p;
  }
  _steal(v, t) {
    if (!v || v.stopping || v.dead) return;
    v.stopping = true;
    try { v.g.gain.setTargetAtTime(0, t, 0.008); v.src.stop(t + 0.05); } catch (e) {}
  }
  _duck(t) {
    for (const g of [this.mDuckD, this.mDuckW]) { const p = g.gain; p.cancelScheduledValues(t); p.setTargetAtTime(0.5, t, 0.015); p.setTargetAtTime(1, t + 0.8, 0.35); }
  }
  // concussion muffle: amount 0..1, hold seconds
  _conc(t, amt, hold) {
    if (amt <= 0.02) return;
    const p = this.conc.frequency, f = this.fMax * Math.pow(650 / this.fMax, Math.pow(clamp(amt, 0, 1), 0.7));
    p.cancelScheduledValues(t); p.setTargetAtTime(f, t, 0.02); p.setTargetAtTime(this.fMax, t + hold * (0.5 + amt * 0.5), 0.7);
  }

  // ---------------------------------------------------------------- loops
  setLoop(name, opts = {}) {
    if (!this._ready || typeof name !== 'string') return;
    opts = opts || {};
    const t = this._now();
    let L = this.loops.get(name);
    if (!L) { L = this._makeLoop(name, opts, t); if (!L) return; this.loops.set(name, L); }
    L.last = t;
    this._updLoop(L, opts, t);
  }
  stopLoop(name) {
    if (!this._ready) return;
    const L = this.loops.get(name); if (!L) return;
    this.loops.delete(name); this._killLoop(L, this._now(), 0.3);
  }
  _makeLoop(name, opts, t) {
    const base = name.split(':')[0], def = LOOPS[base];
    if (!def) return null;
    if (def.max) { let n = 0; for (const L of this.loops.values()) if (L.base === base) n++; if (n >= def.max) return null; }
    const c = this.ctx, nodes = [], srcs = [];
    const G = (v) => { const g = c.createGain(); g.gain.value = v; nodes.push(g); return g; };
    const F = (type, f, Q = 0.707) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = Math.min(f, this.fMax); x.Q.value = Q; nodes.push(x); return x; };
    const fade = G(0); fade.gain.setValueAtTime(0, t); fade.gain.setTargetAtTime(1, t, 0.08);
    const L = { name, base, def, nodes, srcs, fade, last: t, vals: {}, spatial: false, vr: 0, pd: null, pt: t, int: 0.5 };
    if (base === 'wind') {
      const s = c.createBufferSource(); s.buffer = this.N.wind; s.loop = true; s.start(t, this.R() * 2); srcs.push(s); nodes.push(s);
      const vol = G(0); L.vol = vol;
      const roar = F('lowpass', 320, 0.5), roarG = G(3.0); s.connect(roar); roar.connect(roarG); roarG.connect(vol);
      const body = F('bandpass', 750, 0.5), bodyG = G(0.55); s.connect(body); body.connect(bodyG); bodyG.connect(vol);
      const air = F('highpass', 3800), airG = G(0.06); s.connect(air); air.connect(airG); airG.connect(vol);
      [[0.13, 0.25], [0.37, 0.12], [0.071, 0.18]].forEach(([f, d]) => { const o = c.createOscillator(); o.frequency.value = f; o.start(t); srcs.push(o); nodes.push(o); const og = G(d); o.connect(og); og.connect(bodyG.gain); });
      L.filters = [[roar, 320], [body, 750], [air, 3800]]; L.roarG = roarG; L.srcRate = s.playbackRate;
      vol.connect(fade); fade.connect(this.amb);
    } else {
      const buf = this.buf['loop_' + base]?.[0]; if (!buf) return null;
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(t, this.R() * buf.duration); srcs.push(s); nodes.push(s);
      L.srcRate = s.playbackRate;
      const vol = G(0); L.vol = vol; s.connect(vol);
      const tone = F('lowpass', def.lp(0.5)); L.tone = tone; vol.connect(tone); tone.connect(fade);
      L.spatial = !def.twoD && Number.isFinite(opts.x) && Number.isFinite(opts.z);
      const bus = this.sfx;
      if (L.spatial) {
        const dlp = F('lowpass', this.fMax); L.dlp = dlp;
        const p = this._panner(def.hrtf, def.roll ?? 1); nodes.push(p); L.p = p;
        const y = Number.isFinite(opts.y) ? opts.y : this.L[1];
        p.positionX.setValueAtTime(opts.x, t); p.positionY.setValueAtTime(y, t); p.positionZ.setValueAtTime(opts.z, t);
        fade.connect(dlp); dlp.connect(p); p.connect(bus);
        if (def.sub) { const sl = F('lowpass', 130), sg = G(0); L.subG = sg; fade.connect(sl); sl.connect(sg); sg.connect(bus); }
      } else fade.connect(base === 'truck' || def.amb ? this.amb : bus);
      if (def.verb) { const w = G(0); L.send = w; fade.connect(w); w.connect(this.verbIn); }
    }
    srcs[0].onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) {} } };
    return L;
  }
  _set(L, key, param, v, t, tau = 0.05) {
    const o = L.vals[key];
    if (o !== undefined && Math.abs(v - o) <= Math.abs(o) * 0.004 + 1e-5) return;
    L.vals[key] = v; param.setTargetAtTime(v, t, tau);
  }
  _updLoop(L, o, t) {
    const def = L.def;
    if (Number.isFinite(o.intensity)) L.int = clamp(o.intensity, 0, 1);
    let vol = (Number.isFinite(o.volume) ? o.volume : 1) * def.gain;
    if (L.base === 'wind') {
      vol *= 0.35 + 0.65 * L.int;
      this._set(L, 'vol', L.vol.gain, vol, t, 0.1);
      this._set(L, 'roar', L.roarG.gain, 1.5 + 2.0 * L.int, t, 0.1);
      this._loopRate(L, t);
      return;
    }
    if (L.spatial && Number.isFinite(o.x) && Number.isFinite(o.z)) {
      const y = Number.isFinite(o.y) ? o.y : this.L[1], p = L.p;
      if (this._offline) { p.positionX.linearRampToValueAtTime(o.x, t); p.positionY.linearRampToValueAtTime(y, t); p.positionZ.linearRampToValueAtTime(o.z, t); }
      else { p.positionX.value = o.x; p.positionY.value = y; p.positionZ.value = o.z; }
      const d = this._dist(o.x, y, o.z);
      if (def.doppler && L.pd !== null && t - L.pt > 0.015) { const vr = clamp((d - L.pd) / (t - L.pt), -120, 120); L.vr = lerp(L.vr, vr, 0.35); }
      if (L.pd === null || t - L.pt > 0.015) { L.pd = d; L.pt = t; }
      L.d = d;
      this._set(L, 'dlp', L.dlp.frequency, d > 14 ? clamp(this.fMax * Math.pow(14 / d, 1.25), 900, this.fMax) : this.fMax, t, 0.08);
      if (L.subG) this._set(L, 'sub', L.subG.gain, def.sub * vol / (1 + Math.pow(d / 12, 2)), t, 0.08);
      if (L.send) this._set(L, 'send', L.send.gain, def.verb / (1 + d / 60), t, 0.1);
    } else if (L.send) this._set(L, 'send', L.send.gain, def.verb, t, 0.1);
    this._set(L, 'vol', L.vol.gain, vol, t, 0.06);
    this._set(L, 'tone', L.tone.frequency, Math.min(def.lp(L.int), this.fMax), t, 0.1);
    this._loopRate(L, t);
  }
  _loopRate(L, t) {
    const ts = this._sfxRate;
    if (L.base === 'wind') {
      this._set(L, 'rate', L.srcRate, ts, t, 0.1);
      for (let i = 0; i < L.filters.length; i++) { const [f, base] = L.filters[i]; this._set(L, 'f' + i, f.frequency, Math.min(this.fMax, base * Math.sqrt(ts) * (i === 0 ? 0.8 + 0.4 * L.int : 1)), t, 0.1); }
      return;
    }
    const dop = L.def.doppler ? clamp(343 / (343 + L.vr), 0.82, 1.22) : 1;
    this._set(L, 'rate', L.srcRate, clamp(L.def.rate(L.int) * dop * ts, 0.1, 4), t, 0.06);
  }
  _killLoop(L, t, dur) {
    if (L.killed) return; L.killed = true;
    L.fade.gain.cancelScheduledValues(t); L.fade.gain.setTargetAtTime(0, t, dur / 4);
    for (const s of L.srcs) { try { s.stop(t + dur + 0.1); } catch (e) {} }
  }

  // ---------------------------------------------------------------- music
  startMusic() {
    if (!this._ready || !this._mReady) { this._mPending = { start: true }; return; }
    const t = this._now();
    if (this.mOn && this.mStopAt === null) return;
    this.mOn = true; this.mStopAt = null; this.mStep = 0; this.mNext = t + 0.05;
    for (const g of [this.mFadeD, this.mFadeW]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(1, t, 0.05); }
    this._mApply(t, 0.3);
  }
  setMusicIntensity(v) {
    v = clamp(+v || 0, 0, 1);
    if (Math.abs(v - this.mInt) < 0.004) return;
    this.mInt = v;
    if (this._ready && this.mOn && !this.mEnding) this._mApply(this._now(), 0.6);
  }
  _mApply(t, tau) {
    const v = this.mInt, tg = {
      drone: 1.25 - 0.5 * sstep(0.55, 1, v), perc: 0.72 * sstep(0.12, 0.5, v), percWet: 0.72 * sstep(0.12, 0.5, v),
      ost: 0.7 * sstep(0.3, 0.62, v), brass: 0.68 * sstep(0.62, 0.95, v), choir: 0.75 * sstep(0.78, 1, v),
    };
    for (const [k, x] of Object.entries(tg)) {
      const L = this.mL[k];
      if (Math.abs(L.target - x) < 0.002) continue;
      if (x < 0.005 && L.target >= 0.005) L.until = t + tau * 5;
      L.target = x; L.g.gain.setTargetAtTime(x, t, tau);
    }
    this.mEnding = false;
  }
  _on(k, t) { const L = this.mL[k]; return L.target > 0.005 || t < L.until; }
  _mNote(key, t, gain, layer, { semis = 0, dur = 0, track = false } = {}) {
    const b = this.buf[key]?.[0]; if (!b || gain <= 0) return;
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain(), base = semi(semis);
    src.buffer = b; src.playbackRate.value = base * this._mRate; g.gain.value = gain;
    src.connect(g); g.connect(this.mL[layer].g);
    src.start(t);
    if (dur > 0) { const te = t + dur / this._mRate; g.gain.setValueAtTime(gain, te); g.gain.setTargetAtTime(0, te, 0.05); src.stop(te + 0.4); }
    const n = { src, base };
    if (track) this.mActive.add(n);
    src.onended = () => { this.mActive.delete(n); try { src.disconnect(); g.disconnect(); } catch (e) {} };
  }
  _mSched(t) {
    const ahead = this._offline ? CHUNK + 0.2 : 0.22;
    const dt = () => S16 / this._mRate;
    if (this.mNext < t - 0.05) { const k = Math.ceil((t - this.mNext) / dt()); this.mStep += k; this.mNext += k * dt(); }
    let guard = 0;
    while (this.mOn && this.mNext < t + ahead && guard++ < 64) {
      if (this.mStopAt !== null && this.mNext >= this.mStopAt) { this.mOn = false; break; }
      this._mStep(this.mStep, this.mNext);
      this.mStep++; this.mNext += dt();
    }
  }
  _mStep(step, t) {
    const s = step % 16, bar = Math.floor(step / 16), ci = Math.floor(bar / 2) % 4, ch = CHORDS[ci], pb = bar % 8, inCh = bar % 2;
    const v = this.mInt, R = this.R, hum = () => 0.9 + 0.2 * R();
    // L1 drone + pulse + ticks
    if (this._on('drone', t)) {
      if (s === 0 && inCh === 0) this._mNote('pad' + ci, t, 0.55, 'drone', { track: true });
      this._mNote('tick', t, (s % 4 === 0 ? 0.11 : s % 2 === 0 ? 0.06 : 0.035) * hum(), 'drone');
      if (s % 2 === 0) this._mNote('ostDark', t, (s % 4 === 0 ? 0.36 : 0.22) * hum(), 'drone', { semis: ch.root });
    }
    // L2 percussion
    if (this._on('perc', t)) {
      const kicks = v > 0.72 ? [0, 6, 8, 10] : [0, 8];
      if (kicks.includes(s)) this._mNote('kick', t, 0.9 * hum(), 'perc');
      if (s === 4 || s === 12) this._mNote('snare', t, 0.55 * hum(), 'percWet');
      if ([0, 7, 10].includes(s) || (v > 0.8 && s === 13)) this._mNote('taikoLo', t, 0.62 * hum(), 'perc');
      if (pb === 7 && s >= 8) this._mNote('taikoHi', t, (0.25 + 0.05 * (s - 8)) * hum(), 'percWet');
      else if (s === 3 || s === 14) this._mNote('taikoHi', t, 0.42 * hum(), 'percWet');
    }
    // L3 ostinato (16ths, 3-3-2 accents)
    if (this._on('ost', t)) {
      const pat = [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 7, 0, 12, 7][s], acc = [0, 3, 6, 8, 11, 14].includes(s);
      const r = ch.root + pat;
      this._mNote(r >= 6 ? 'ostHi' : 'ostLo', t, (acc ? 0.5 : 0.28) * hum(), 'ost', { semis: r >= 6 ? r - 12 : r });
    }
    // L4 bombast
    if (this._on('brass', t)) {
      if (s === 0 && inCh === 0) { this._mNote('brass' + ci, t, 1.0, 'brass', { dur: S16 * 10 }); this._mNote('boom', t, 0.55, 'brass'); }
      if (inCh === 1 && (s === 6 || s === 10)) this._mNote('brass' + ci, t, 0.75, 'brass', { dur: S16 * 1.5 });
      if (inCh === 1 && s === 14) this._mNote('brass' + ((ci + 1) % 4), t, 0.8, 'brass', { dur: S16 * 1.6 });
      if (s === 0 && pb === 0) this._mNote('crash', t, 0.3, 'brass');
      if (pb === 7 && s === 8) this._mNote('boom', t, 0.6, 'brass');
    }
    if (this._on('choir', t) && s === 0 && inCh === 0) this._mNote('choir' + ci, t, 0.5, 'choir', { track: true });
  }
  musicStinger(name) {
    if (!this._ready || !this._mReady) return;
    const t = this._now();
    for (const g of [this.mFadeD, this.mFadeW]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(1, t, 0.03); }
    if (name === 'boss') {
      this._mNote('braaam', t, 2.5, 'sting', { track: true });
    } else if (name === 'victory') {
      this._mNote('victory', t, 2.6, 'sting', { track: true });
      this.mEnding = true; this.mOn = false;
      for (const [k, L] of Object.entries(this.mL)) if (k !== 'sting') { L.target = 0; L.g.gain.setTargetAtTime(0, t, 0.12); }
    }
  }
  stopMusic(fadeSeconds = 2) {
    if (!this._ready) { this._mPending = null; return; }
    const t = this._now(), f = Math.max(0.05, +fadeSeconds || 2);
    for (const g of [this.mFadeD, this.mFadeW]) { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, f / 4); }
    this.mStopAt = t + f;
  }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    if (!this._ready) return;
    const t = this._now();
    if (this.mOn) this._mSched(t);
    for (const [n, L] of this.loops) if (t - L.last > 0.5) { this.loops.delete(n); this._killLoop(L, t, 0.3); }
    if (t - (this._lastClean ?? 0) > 1) {
      this._lastClean = t;
      this.voices = this.voices.filter((v) => !v.dead && v.end >= t - 0.5);
    }
  }
}

// ---------------------------------------------------------------- offline render
export async function renderOffline(events, duration, sampleRate = 48000) {
  const len = Math.ceil(duration * sampleRate);
  const ctx = new OfflineAudioContext(2, len, sampleRate);
  const sys = new AudioSystem();
  await sys.init(ctx);
  const evs = (events || []).filter((e) => e && Number.isFinite(e.t)).slice().sort((a, b) => a.t - b.t);
  let i = 0;
  const dispatch = (e) => {
    try {
      switch (e.type) {
        case 'play': sys.play(e.name, e.opts || {}); break;
        case 'loop': sys.setLoop(e.name, e.opts || {}); break;
        case 'stopLoop': sys.stopLoop(e.name); break;
        case 'listener': if (e.args) sys.setListener(...e.args); break;
        case 'timescale': sys.setTimeScale(e.value ?? e.opts?.value ?? 1); break;
        case 'musicStart': sys.startMusic(); break;
        case 'musicIntensity': sys.setMusicIntensity(e.value ?? e.opts?.value ?? 0); break;
        case 'stinger': sys.musicStinger(e.name ?? e.value); break;
        case 'musicStop': sys.stopMusic(e.value ?? e.opts?.value ?? 2); break;
      }
    } catch (err) { console.warn('renderOffline event failed', e, err); }
  };
  const step = (T) => {
    const end = T + CHUNK;
    while (i < evs.length && evs[i].t < end) { const e = evs[i++]; sys._when = Math.max(e.t, T); dispatch(e); }
    sys._when = T;
    try { sys.update(CHUNK); } catch (err) { console.warn('renderOffline update failed', err); }
    sys._when = undefined;
  };
  const nChunks = Math.ceil(duration / CHUNK);
  for (let k = 1; k < nChunks; k++) {
    const T = k * CHUNK;
    ctx.suspend(T).then(() => { try { step(ctx.currentTime); } catch (err) { console.warn('renderOffline step failed', err); } finally { ctx.resume(); } });
  }
  step(0);
  return await ctx.startRendering();
}

export function audioBufferToWav(buffer) {
  const n = buffer.length, sr = buffer.sampleRate, L = buffer.getChannelData(0), R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  const dataLen = n * 4, ab = new ArrayBuffer(44 + dataLen), dv = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, dataLen, true);
  const pcm = new Int16Array(ab, 44, n * 2);
  for (let i = 0; i < n; i++) {
    const a = L[i] < -1 ? -1 : L[i] > 1 ? 1 : L[i], b = R[i] < -1 ? -1 : R[i] > 1 ? 1 : R[i];
    pcm[i * 2] = a < 0 ? a * 32768 : a * 32767; pcm[i * 2 + 1] = b < 0 ? b * 32768 : b * 32767;
  }
  return ab;
}
