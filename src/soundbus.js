// Audio bus: forwards to the live AudioSystem, or records every call (capture mode) so the soundtrack
// can be rendered offline in sync with a frame-by-frame video capture.
export class SoundBus {
  constructor(record) { this.sys = null; this.record = record; this.events = []; this.t = 0; this.listenerN = 0; }
  async init() {
    if (this.record) return;
    try {
      const loader = import.meta.glob('./audio.js')['./audio.js'];
      if (!loader) throw new Error('audio module missing');
      const mod = await loader();
      this.sys = new mod.AudioSystem();
      await this.sys.init();
    } catch (e) { console.warn('audio unavailable', e); this.sys = null; }
  }
  _ev(type, name, opts, value) { if (this.record) this.events.push({ t: +this.t.toFixed(4), type, name, opts: opts ? { ...opts } : undefined, value }); }
  play(name, opts = {}) { this._ev('play', name, opts); this.sys?.play(name, opts); }
  setLoop(name, opts = {}) {
    if (this.record) { this._lt ??= {}; if (this._lt[name] === undefined || this.t - this._lt[name] > 0.1) { this._lt[name] = this.t; this._ev('loop', name, opts); } }
    this.sys?.setLoop(name, opts);
  }
  stopLoop(name) { this._ev('stopLoop', name); this.sys?.stopLoop?.(name); }
  setTimeScale(s) { if (this.record) { if (Math.abs((this._ts ?? 1) - s) > 0.02) { this._ts = s; this._ev('timescale', null, null, +s.toFixed(3)); } } this.sys?.setTimeScale(s); }
  setListener(p, f, u) {
    if (this.record) { if (this.listenerN++ % 3 === 0) this.events.push({ t: +this.t.toFixed(4), type: 'listener', args: [p.x, p.y, p.z, f.x, f.y, f.z, u.x, u.y, u.z].map(v => +v.toFixed(3)) }); }
    this.sys?.setListener(p.x, p.y, p.z, f.x, f.y, f.z, u.x, u.y, u.z);
  }
  startMusic() { this._ev('musicStart'); this.sys?.startMusic(); }
  setMusicIntensity(v) { this._ev('musicIntensity', null, null, v); this.sys?.setMusicIntensity(v); }
  musicStinger(n) { this._ev('stinger', n); this.sys?.musicStinger(n); }
  stopMusic(f = 2) { this._ev('musicStop', null, null, f); this.sys?.stopMusic(f); }
  update(dt) { this.sys?.update(dt); }
}

