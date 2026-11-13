// =====================================================================================
//  Phones and tablets: on-screen touch controls + full screen.
//
//  The touch layer drives the same desktop inputs the mouse and keyboard do, so every level works without
//  level code knowing about touch: it writes `player.touch` = { mx, my, sprint, fire, nade } and the player
//  folds that into movement (like WASD + Shift), the rifle (like left click) and the launcher (like right
//  click); RELOAD sets `player.inputs.reload` like R. Look drags turn `player.yaw / pitch` like the mouse.
//  - left thumb (on-foot levels): a floating stick where the thumb lands; push past the rim to sprint.
//    Rail levels (no locomotion) have no stick: the whole screen is a look pad.
//  - drag anywhere else to aim. Holding FIRE or NADE and sliding the thumb aims too (fire while turning).
//  - full screen: the Fullscreen API (Android, iPad, desktop) plus a landscape lock on phones. iPhone Safari
//    has no Fullscreen API for pages: the button explains Add to Home Screen instead (the pages carry the
//    web-app meta tags, so the game opens from the home screen without browser chrome).
//  Detection: a coarse primary pointer with touch points, never the Quest browser. `?touch=1` / `?touch=0`
//  forces it on / off (test the layout on desktop with ?touch=1 and a mouse).
// =====================================================================================

const params = new URLSearchParams(location.search);
export const TOUCH = (() => {
  if (params.has('touch')) return params.get('touch') !== '0';
  if (/OculusBrowser|Quest/i.test(navigator.userAgent)) return false;
  return (navigator.maxTouchPoints || 0) > 0 && matchMedia('(pointer: coarse)').matches;
})();

// ---------------- full screen ----------------
const de = document.documentElement;
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
// launched from the home screen as a web app: already full screen, nothing to toggle
export const standalone = () => !!navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
export const canFullscreen = () => !!(de.requestFullscreen || de.webkitRequestFullscreen);
export const isFullscreen = () => !!fsEl();
// call straight from a click / tap handler (before any await): browsers only allow it inside the user gesture
export function enterFullscreen() {
  if (fsEl()) return Promise.resolve(true);
  let p;
  try {
    if (de.requestFullscreen) p = de.requestFullscreen({ navigationUI: 'hide' });
    else if (de.webkitRequestFullscreen) p = de.webkitRequestFullscreen();
    else return Promise.resolve(false);
  } catch (e) { return Promise.resolve(false); }
  return Promise.resolve(p).then(() => {
    // phones: hold landscape while full screen (Android Chrome; Safari has no orientation lock and rejects)
    if (TOUCH) screen.orientation?.lock?.('landscape').catch(() => {});
    return true;
  }).catch(() => false);
}
export function exitFullscreen() {
  if (!fsEl()) return;
  try { screen.orientation?.unlock?.(); } catch (e) { /* not locked */ }
  (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
}
export function toggleFullscreen() { return fsEl() ? exitFullscreen() : enterFullscreen(); }
export function onFullscreenChange(fn) {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}

// iPhone Safari: no Fullscreen API for pages, so explain the home-screen route instead
export function showHomeScreenHint(game = 1) {
  if (document.getElementById('bay-a2hs')) return;
  const d = document.createElement('div');
  d.id = 'bay-a2hs';
  d.innerHTML = `<style>
    #bay-a2hs{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);padding:20px}
    #bay-a2hs .card{max-width:420px;padding:18px 22px;border-radius:6px;font:500 15px/1.5 Oswald,system-ui,sans-serif;letter-spacing:0.04em;text-align:left;
      border:2px solid ${game === 2 ? 'rgba(140,180,225,0.6)' : 'rgba(255,179,90,0.6)'};background:${game === 2 ? 'rgba(8,14,24,0.94)' : 'rgba(24,11,4,0.94)'};color:${game === 2 ? '#dfeaf7' : '#ffe2b4'}}
    #bay-a2hs b{font:400 22px Anton,Impact,sans-serif;letter-spacing:0.08em;display:block;margin-bottom:6px;color:#fff3df}
    #bay-a2hs .ok{margin-top:12px;font:700 13px Oswald,sans-serif;letter-spacing:0.2em;opacity:0.8}
  </style><div class="card"><b>FULL SCREEN ON IPHONE</b>Safari can't put a web page in full screen on iPhone.
    Tap <b style="display:inline;font:inherit;letter-spacing:inherit;color:#fff">Share</b>, then <b style="display:inline;font:inherit;letter-spacing:inherit;color:#fff">Add to Home Screen</b>,
    and open ${game === 2 ? 'BAYHEM 2' : 'BAYHEM'} from your home screen: it runs full screen there.<div class="ok">TAP TO CLOSE</div></div>`;
  const close = (e) => { e.preventDefault(); e.stopPropagation(); d.remove(); };
  d.addEventListener('pointerdown', close);
  document.body.appendChild(d);
}

// what the full screen buttons do on this device
export function fullscreenAction(game) {
  if (canFullscreen()) return toggleFullscreen();
  if (!standalone()) showHomeScreenHint(game);
}
// is there anything for a full screen button to do here?
export const fullscreenUseful = () => !standalone() && (canFullscreen() || TOUCH);

// ---------------- touch controls ----------------
const FS_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path class="in" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><path class="out" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

const CSS = `
  #tc{position:fixed;inset:0;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
    -webkit-tap-highlight-color:transparent;font-family:Anton,Impact,sans-serif;--ln:rgba(255,179,90,0.55);--bg:rgba(24,11,4,0.34);--tx:#ffe2b4;--hot:rgba(255,110,20,0.55)}
  #tc.g2{--ln:rgba(150,190,235,0.55);--bg:rgba(8,14,24,0.38);--tx:#dfeaf7;--hot:rgba(90,150,230,0.5)}
  #tc .b{position:absolute;box-sizing:border-box;border-radius:50%;border:2px solid var(--ln);background:var(--bg);color:var(--tx);
    display:flex;align-items:center;justify-content:center;letter-spacing:0.08em;text-shadow:0 1px 3px rgba(0,0,0,0.8);
    backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);transition:transform .06s, background .06s}
  #tc .b.on{transform:scale(0.92);background:var(--hot);border-color:#fff3df}
  #tc .fire{width:96px;height:96px;font-size:19px;right:calc(26px + env(safe-area-inset-right));bottom:calc(30px + env(safe-area-inset-bottom));
    border-width:3px;background:radial-gradient(circle at 50% 40%, rgba(255,90,20,0.38), var(--bg) 70%)}
  #tc.g2 .fire{background:radial-gradient(circle at 50% 40%, rgba(255,110,40,0.32), var(--bg) 70%)}
  #tc .nade{width:66px;height:66px;font-size:14px;right:calc(136px + env(safe-area-inset-right));bottom:calc(30px + env(safe-area-inset-bottom))}
  #tc .rel{width:58px;height:58px;font-size:11px;right:calc(46px + env(safe-area-inset-right));bottom:calc(140px + env(safe-area-inset-bottom))}
  #tc .fs{width:44px;height:44px;border-radius:8px;right:calc(14px + env(safe-area-inset-right));top:calc(12px + env(safe-area-inset-top))}
  #tc .fs .out{display:none} #tc .fs.full .in{display:none} #tc .fs.full .out{display:inline}
  #tc .stick{position:absolute;width:124px;height:124px;margin:-62px 0 0 -62px;border-radius:50%;box-sizing:border-box;
    border:2px solid var(--ln);background:radial-gradient(circle, rgba(0,0,0,0) 55%, var(--bg) 100%);opacity:0.35;transition:opacity .15s;pointer-events:none}
  #tc .stick.live{opacity:1;transition:none}
  #tc .stick.sprint{border-color:#ff8a2a;box-shadow:0 0 18px rgba(255,120,20,0.55)}
  #tc .knob{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;
    background:var(--hot);border:2px solid #fff3df;box-sizing:border-box}
  #tc .stick:not(.live) .knob{background:var(--bg);border-color:var(--ln)}
  #tc .rot{display:none;position:absolute;left:50%;top:calc(14px + env(safe-area-inset-top));transform:translateX(-50%);padding:8px 16px;border-radius:4px;
    font:700 13px Oswald,sans-serif;letter-spacing:0.2em;white-space:nowrap;color:var(--tx);background:rgba(0,0,0,0.6);border:1px solid var(--ln);pointer-events:none}
  @media (orientation: portrait){ #tc .rot{display:block} }`;

export class TouchControls {
  constructor(player, camera, { game = 1 } = {}) {
    this.p = player; this.camera = camera; this.game = game;
    this.s = player.touch = { mx: 0, my: 0, sprint: false, fire: false, nade: false };
    this.ptrs = new Map();   // pointerId -> { role, x, y, ox, oy }
    this.stickId = null;
    this.R = 58;             // stick radius in CSS px (full deflection)
    const d = this.root = document.createElement('div');
    d.id = 'tc'; d.className = `g${game}`; d.style.display = 'none';
    d.innerHTML = `<style>${CSS}</style>
      <div class="stick"><div class="knob"></div></div>
      <div class="b fire" data-b="fire">FIRE</div>
      <div class="b nade" data-b="nade">NADE</div>
      <div class="b rel" data-b="reload">RELOAD</div>
      ${fullscreenUseful() ? `<div class="b fs" data-b="fs">${FS_ICON}</div>` : ''}
      <div class="rot">TURN YOUR PHONE SIDEWAYS</div>`;
    document.body.appendChild(d);
    this.stick = d.querySelector('.stick'); this.knob = d.querySelector('.knob');
    this.btn = { fire: d.querySelector('.fire'), nade: d.querySelector('.nade'), reload: d.querySelector('.rel'), fs: d.querySelector('.fs') };
    this._park();
    const fsSync = () => this.btn.fs?.classList.toggle('full', isFullscreen());
    onFullscreenChange(fsSync); fsSync();
    d.addEventListener('pointerdown', (e) => this._down(e), { passive: false });
    d.addEventListener('pointermove', (e) => this._move(e), { passive: false });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) d.addEventListener(ev, (e) => this._up(e.pointerId));
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    // a call, a notification shade or an app switch drops every touch without a pointerup
    const reset = () => this.reset();
    addEventListener('blur', reset); addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
    addEventListener('resize', () => { if (this.stickId == null) this._park(); });
  }
  show() { this.root.style.display = ''; this._park(); }
  hide() { this.reset(); this.root.style.display = 'none'; }
  // on-foot levels get the stick; rail levels (no locomotion) don't
  get walks() { return !!this.p.loco; }
  reset() {
    for (const id of [...this.ptrs.keys()]) this._up(id);
    Object.assign(this.s, { mx: 0, my: 0, sprint: false, fire: false, nade: false });
  }
  // the idle stick sits faintly bottom-left so the player knows it's there
  _park() {
    this.stick.style.display = this.walks ? '' : 'none';
    this.stick.style.left = `calc(${Math.round(this.R + 46)}px + env(safe-area-inset-left))`;
    this.stick.style.top = `calc(100% - ${Math.round(this.R + 40)}px - env(safe-area-inset-bottom))`;
    this.knob.style.transform = '';
    this.stick.classList.remove('live', 'sprint');
  }
  _down(e) {
    e.preventDefault(); // no emulated mouse events, no double-tap zoom, no text selection
    const b = e.target.closest?.('[data-b]')?.dataset.b || null;
    if (b === 'fs') { fullscreenAction(this.game); return; }
    try { this.root.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    const t = { role: 'look', x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
    if (b === 'fire') { t.role = 'fire'; this.s.fire = true; }
    else if (b === 'nade') { t.role = 'nade'; this.s.nade = true; }
    else if (b === 'reload') { t.role = 'reload'; this.p.inputs.reload = true; }
    else if (this.walks && this.stickId == null && e.clientX < innerWidth * 0.42) {
      t.role = 'stick'; this.stickId = e.pointerId;
      this.stick.style.display = '';
      this.stick.style.left = `${e.clientX}px`; this.stick.style.top = `${e.clientY}px`;
      this.stick.classList.add('live');
    }
    if (b) this.btn[b]?.classList.add('on');
    this.ptrs.set(e.pointerId, t);
  }
  _move(e) {
    const t = this.ptrs.get(e.pointerId); if (!t) return;
    e.preventDefault();
    // coalesced events keep fast flicks accurate on 120 Hz touch panels
    const list = e.getCoalescedEvents?.() || [];
    const last = list.length ? list[list.length - 1] : e;
    const dx = last.clientX - t.x, dy = last.clientY - t.y;
    t.x = last.clientX; t.y = last.clientY;
    if (t.role === 'stick') this._stick(t);
    else this._look(dx, dy);
  }
  _up(id) {
    const t = this.ptrs.get(id); if (!t) return;
    this.ptrs.delete(id);
    if (t.role === 'stick') { this.stickId = null; this.s.mx = this.s.my = 0; this.s.sprint = false; this._park(); }
    else if (t.role === 'fire' || t.role === 'nade' || t.role === 'reload') {
      // another finger may still hold the same button
      const still = [...this.ptrs.values()].some(o => o.role === t.role);
      if (!still) { if (t.role !== 'reload') this.s[t.role] = false; this.btn[t.role]?.classList.remove('on'); }
    }
  }
  _stick(t) {
    const R = this.R;
    let dx = t.x - t.ox, dy = t.y - t.oy, d = Math.hypot(dx, dy);
    // the base follows a thumb that slides past the rim, so reversing direction is instant
    const follow = R * 1.2;
    if (d > follow) {
      const k = (d - follow) / d; t.ox += dx * k; t.oy += dy * k;
      this.stick.style.left = `${t.ox}px`; this.stick.style.top = `${t.oy}px`;
      dx = t.x - t.ox; dy = t.y - t.oy; d = follow;
    }
    const dead = 0.12, m = Math.min(1, Math.max(0, (d / R - dead) / (1 - dead)));
    this.s.mx = d > 0 ? dx / d * m : 0; this.s.my = d > 0 ? dy / d * m : 0;
    this.s.sprint = d > R * 1.06;
    const kd = Math.min(d, R);
    this.knob.style.transform = d > 0 ? `translate(${dx / d * kd}px, ${dy / d * kd}px)` : '';
    this.stick.classList.toggle('sprint', this.s.sprint);
  }
  _look(dx, dy) {
    const p = this.p;
    if (p.auto || p.mode !== 'desktop') return;
    // a drag the full height of the screen turns ~1.1 vertical fields of view: the world tracks the thumb
    const s = (this.camera.fov * Math.PI / 180) * 1.1 / Math.max(240, innerHeight);
    p.yaw -= dx * s; p.pitch -= dy * s;
    p.pitch = Math.max(-1.35, Math.min(1.35, p.pitch));
  }
}
