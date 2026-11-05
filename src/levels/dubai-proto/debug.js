import * as THREE from 'three';

// =====================================================================================
//  PERF PANEL — readable in the headset: frame time / fps, worst frame, missed frames,
//  draw calls, triangles, shader programs, particle + cloud counts, dust fill, comfort
//  numbers, and a per-phase table (idle / mid / hero / worst / settle) so one run gives
//  the answer. Mounted on the cabin bulkhead, on the left wrist, or hidden (&panel=, Y/5).
//  The canvas redraws 4× a second (a 512² texture upload is cheap; every frame is not).
//  Timing: frame time = real time between frames (XR rAF), CPU = level step + render
//  submit measured with performance.now(), GPU = EXT_disjoint_timer_query_webgl2 around
//  renderer.render when the browser exposes it (shown as n/a otherwise).
// =====================================================================================

const W = 512, H = 640;

export class PerfPanel {
  constructor(E, F, hz) {
    this.E = E; this.F = F;
    this.budgetMs = 1000 / (hz || 72);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    this.ctx = c.getContext('2d');
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    const m = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), m);
    this.mesh.renderOrder = 999;
    this.mode = F.panel;
    this.frames = new Float32Array(150); this.fi = 0;
    this.win = { n: 0, sum: 0, t0: performance.now() };
    this.fps = 0; this.ms = 0; this.worst2s = 0; this.worstHist = [];
    this.cpu = 0; this.gpu = null; this.calls = 0; this.tris = 0; this.programs = 0;
    this.phases = new Map(); // label -> {n, sum, worst, miss}
    this.redraw = 0;
    this.last = performance.now();
    this._wrapRender(E.renderer, F);
    // desktop: mirror as text in the page (no headset there)
    this.dom = document.createElement('pre');
    Object.assign(this.dom.style, { position: 'fixed', right: '8px', top: '8px', margin: 0, padding: '8px 10px', font: '12px/1.35 monospace', color: '#e8f5e0', background: 'rgba(0,0,0,0.6)', zIndex: 5, pointerEvents: 'none', whiteSpace: 'pre' });
    if (!E.flags.CAPTURE) document.body.appendChild(this.dom);
  }
  _wrapRender(renderer, F) {
    const gl = renderer.getContext();
    const ext = F.gpu ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    this.gpuOk = !!ext;
    const pending = [];
    const orig = renderer.render.bind(renderer);
    renderer.render = (scene, camera) => {
      let q = null;
      if (ext && pending.length < 4) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); }
      const t0 = performance.now();
      orig(scene, camera);
      this.renderCpu = performance.now() - t0;
      if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(q); }
      const inf = renderer.info.render; this.calls = inf.calls; this.tris = inf.triangles;
      this.programs = renderer.info.programs?.length ?? 0;
      // collect finished queries (they resolve a few frames later)
      while (pending.length) {
        const pq = pending[0];
        if (!gl.getQueryParameter(pq, gl.QUERY_RESULT_AVAILABLE)) break;
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        const ns = gl.getQueryParameter(pq, gl.QUERY_RESULT);
        if (!disjoint) this.gpu = this.gpu == null ? ns / 1e6 : this.gpu * 0.85 + (ns / 1e6) * 0.15;
        gl.deleteQuery(pq); pending.shift();
      }
    };
  }
  setBudget(hz) { this.budgetMs = 1000 / hz; }
  mount(mode, rig, wristSpace) {
    this.mode = mode;
    this.mesh.removeFromParent();
    if (mode === 'cabin') {
      // on the forward bulkhead, to your right as you face the door: a head turn away, never in the view out
      // (the rig faces the door, so rig +x is the heli's nose); double size: it is ~1.8 m away
      rig.add(this.mesh); this.mesh.position.set(1.72, 1.3, -0.35); this.mesh.rotation.set(0, -1.37, 0);
    } else if (mode === 'wrist' && wristSpace) {
      wristSpace.add(this.mesh); this.mesh.position.set(0.0, 0.07, 0.03); this.mesh.rotation.set(-1.1, 0, 0); this.mesh.scale.setScalar(0.6);
    } else if (mode === 'float') {
      rig.add(this.mesh); this.mesh.position.set(0, 1.0, -0.7); this.mesh.rotation.set(-0.5, 0, 0);
    }
    if (mode === 'cabin') this.mesh.scale.setScalar(2); else if (mode !== 'wrist') this.mesh.scale.setScalar(1);
  }
  // call once per displayed frame with the sim CPU time of this frame
  frame(simMs, phase) {
    const now = performance.now(), ft = now - this.last; this.last = now;
    this.cpu = this.cpu * 0.9 + (simMs + (this.renderCpu || 0)) * 0.1;
    this.frames[this.fi++ % this.frames.length] = ft;
    this.win.n++; this.win.sum += ft;
    this.worstHist.push([now, ft]); while (this.worstHist.length && now - this.worstHist[0][0] > 2000) this.worstHist.shift();
    if (now - this.win.t0 > 500) { this.ms = this.win.sum / this.win.n; this.fps = 1000 / this.ms; this.win = { n: 0, sum: 0, t0: now }; }
    // per-phase stats (ignore the first second after a phase change: that's the switch itself, not the load)
    if (phase && ft < 500) {
      let P = this.phases.get(phase); if (!P) { P = { n: 0, sum: 0, worst: 0, miss: 0 }; this.phases.set(phase, P); }
      P.n++; P.sum += ft; P.worst = Math.max(P.worst, ft); if (ft > this.budgetMs * 1.5) P.miss++;
    }
  }
  resetPhases() { this.phases.clear(); }
  draw(info) {
    const now = performance.now();
    if (now - this.redraw < 250) return;
    this.redraw = now;
    this.worst2s = this.worstHist.reduce((m, [, f]) => Math.max(m, f), 0);
    const x = this.ctx, b = this.budgetMs;
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(8,10,12,0.86)'; x.fillRect(0, 0, W, H);
    const ok = this.ms <= b * 1.04, warn = this.ms <= b * 1.25;
    x.fillStyle = ok ? '#7dff8a' : warn ? '#ffd24a' : '#ff5a4a';
    x.font = 'bold 54px monospace'; x.fillText(`${this.fps.toFixed(1)} fps`, 16, 58);
    x.font = 'bold 26px monospace'; x.fillStyle = '#e8eef0';
    x.fillText(`${this.ms.toFixed(1)} ms  worst ${this.worst2s.toFixed(0)}`, 16, 92);
    // frame time graph with the budget line
    const gx = 16, gy = 104, gw = W - 32, gh = 70;
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(gx, gy, gw, gh);
    const sc = gh / (b * 3);
    x.strokeStyle = '#7dff8a'; x.beginPath(); x.moveTo(gx, gy + gh - b * sc); x.lineTo(gx + gw, gy + gh - b * sc); x.stroke();
    const n = this.frames.length;
    for (let i = 0; i < n; i++) {
      const f = this.frames[(this.fi + i) % n]; if (!f) continue;
      const hh = Math.min(gh, f * sc);
      x.fillStyle = f > b * 1.5 ? '#ff5a4a' : f > b * 1.1 ? '#ffd24a' : '#5fb7ff';
      x.fillRect(gx + (i / n) * gw, gy + gh - hh, Math.max(1, gw / n - 0.5), hh);
    }
    x.font = '22px monospace'; x.fillStyle = '#e8eef0';
    const L = [
      `cpu ${this.cpu.toFixed(1)}ms  gpu ${this.gpu == null ? 'n/a' : this.gpu.toFixed(1) + 'ms'}`,
      `calls ${this.calls}  tris ${(this.tris / 1000).toFixed(0)}k  progs ${this.programs}`,
      `fx ${info.fx}  sparks ${info.sparks}  big ${info.big}`,
      `clouds ${info.clouds}/${info.cloudMax} ${info.dust}  fill ${info.fill.toFixed(1)} (pk ${info.fillPeak.toFixed(1)})`,
      `glass ${info.glass}  bodies ${info.bodies}  mid ${info.mid}`,
      `far swapped ${info.swapped}/${info.far}  wall ${info.wall}`,
      `heli ${info.speed.toFixed(0)}m/s yaw ${info.yawRate.toFixed(1)}°/s bank ${info.bank.toFixed(1)}°`,
      `acc lat ${info.lat.toFixed(2)} lon ${info.lon.toFixed(2)} vert ${info.vert.toFixed(2)}`,
      `max yaw ${info.maxYaw.toFixed(1)} lat ${info.maxLat.toFixed(2)} jerk ${info.maxJerk.toFixed(2)}`,
      `${info.phase}  ${info.flags}`,
    ];
    L.forEach((s, i) => x.fillText(s, 16, 206 + i * 27));
    // per-phase table: avg fps, worst frame, % frames over 1.5× budget
    let y = 206 + L.length * 27 + 14;
    x.fillStyle = '#9fb3bd'; x.font = 'bold 20px monospace'; x.fillText('phase     avg fps  worst ms  miss%', 16, y); y += 24;
    x.font = '20px monospace';
    for (const [k, P] of this.phases) {
      const avg = 1000 / (P.sum / Math.max(1, P.n)), miss = (100 * P.miss) / Math.max(1, P.n);
      x.fillStyle = avg >= 1000 / b - 1 && miss < 1 ? '#7dff8a' : miss < 5 ? '#ffd24a' : '#ff5a4a';
      x.fillText(`${k.padEnd(9)} ${avg.toFixed(1).padStart(7)}  ${P.worst.toFixed(0).padStart(8)}  ${miss.toFixed(1).padStart(5)}`, 16, y); y += 23;
      if (y > H - 30) break;
    }
    x.fillStyle = '#6f8590'; x.font = '17px monospace';
    x.fillText('L-grip WORST  R-grip RESET  A mid  B hero', 16, H - 30);
    x.fillText('X dust lvl  Y panel  | desktop: 1 0 2 3 4 5', 16, H - 10);
    this.tex.needsUpdate = true;
    if (this.dom.isConnected) this.dom.textContent = [`${this.fps.toFixed(1)} fps  ${this.ms.toFixed(1)} ms  worst ${this.worst2s.toFixed(0)}`, ...L, '', ...[...this.phases].map(([k, P]) => `${k.padEnd(9)} ${(1000 / (P.sum / Math.max(1, P.n))).toFixed(1)} fps  worst ${P.worst.toFixed(0)} ms  miss ${((100 * P.miss) / Math.max(1, P.n)).toFixed(1)}%`), '', 'keys: 1 worst  0 reset  2 mid  3 hero  4 dust  5 panel'].join('\n');
  }
  // one line per phase, for copying off the headset (window.__perf() in remote devtools)
  summary() { return [...this.phases].map(([k, P]) => ({ phase: k, avgFps: +(1000 / (P.sum / Math.max(1, P.n))).toFixed(1), worstMs: +P.worst.toFixed(1), missPct: +((100 * P.miss) / Math.max(1, P.n)).toFixed(2), frames: P.n })); }
}
