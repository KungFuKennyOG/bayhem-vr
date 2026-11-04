import * as THREE from 'three';
import { textTexture } from './textures.js';

const texCache = new Map();
const _hv = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hm = new THREE.Matrix4(), _hu = new THREE.Vector3(), _hp = new THREE.Vector3();
// callout lanes: at most one 'big' (big/huge) and one 'small' line on screen; the rest queue, spaced in time
const LANE_GAP = 0.55;          // s between two callouts of the same lane
const LANE_MAX = { big: 3, small: 2 };
const LANE_WAIT = { big: 1.3, small: 0.9, huge: 2.6 }; // a queued callout older than this is stale: dropped
const PRIO = { huge: 3, big: 2, small: 1 };
const URGENT = new Set(['GRENADE!', 'INCOMING!']);
function roundPlate(ctx, x, y, w, h, r, fill, blur) {
  ctx.save(); ctx.fillStyle = fill; ctx.shadowColor = fill; ctx.shadowBlur = blur;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.restore();
}
// soft dark halo behind a callout's text (drawn under it) so it still reads in front of a fireball
function backed(tt, size, hasSub) {
  const c = tt.canvas; if (!c) return tt;
  const x = c.getContext('2d'), W = c.width, H = c.height, pad = 40;
  x.save(); x.globalCompositeOperation = 'destination-over';
  const cy = pad + size * 0.68 + (hasSub ? size * 0.2 : 0), h = size * (hasSub ? 1.45 : 1.05), w = W - pad * 1.2;
  x.fillStyle = 'rgba(12,6,2,0.5)'; x.shadowColor = 'rgba(12,6,2,0.55)'; x.shadowBlur = size * 0.32;
  x.beginPath(); x.roundRect((W - w) / 2, cy - h / 2, w, h, h / 2); x.fill();
  x.restore();
  tt.texture.needsUpdate = true;
  return tt;
}
// title card: chrome title (textTexture) + subtitle line on a dark soft plate so it reads against a bright sky
function titleTexture(text, sub) {
  const size = 220, tt = textTexture(text, { size, color: 'chrome', stroke: 12, padding: 70 });
  if (!sub) return { ...tt, hk: 1 };
  const src = tt.canvas, fs = 54, font = `700 ${fs}px Oswald, sans-serif`;
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const sw = m.measureText(sub).width + fs * 0.12 * sub.length * 0.35;
  const textBottom = 70 + size * 0.68 + size * 0.42, subY = textBottom + fs * 0.95;
  const W = Math.ceil(Math.max(src.width, sw + fs * 3)), H = Math.ceil(Math.max(src.height, subY + fs * 1.25));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // plate: soft dark band with warm hairlines (behind both the subtitle and the title's lower glow)
  const pw = sw + fs * 1.8, ph = fs * 1.42, px = (W - pw) / 2, py = subY - ph / 2;
  roundPlate(x, px, py, pw, ph, ph / 2, 'rgba(10,6,3,0.66)', fs * 0.7);
  const hl = x.createLinearGradient(px, 0, px + pw, 0);
  hl.addColorStop(0, 'rgba(255,150,50,0)'); hl.addColorStop(0.5, 'rgba(255,160,60,0.85)'); hl.addColorStop(1, 'rgba(255,150,50,0)');
  x.fillStyle = hl; x.fillRect(px + ph * 0.4, py + 2, pw - ph * 0.8, 3); x.fillRect(px + ph * 0.4, py + ph - 5, pw - ph * 0.8, 3);
  x.drawImage(src, (W - src.width) / 2, 0);
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  if ('letterSpacing' in x) x.letterSpacing = '4px';
  x.shadowColor = 'rgba(0,0,0,0.95)'; x.shadowBlur = 10; x.fillStyle = '#fff0d8';
  x.fillText(sub, W / 2, subY + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  tt.texture.dispose();
  return { texture: t, aspect: W / H, hk: H / src.height };
}
function cachedText(key, fn) {
  if (!texCache.has(key)) texCache.set(key, fn());
  return texCache.get(key);
}
function vignetteTexture(inner, outer) {
  const S = 256; const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function plane(tex, w, h, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false, ...opts }));
  m.renderOrder = 200; m.frustumCulled = false;
  return m;
}

export class HUD {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.root = new THREE.Group(); // head-locked
    camera.add(this.root);
    this.callouts = [];
    this.lanes = { big: { q: [], cur: null, gap: 0 }, small: { q: [], cur: null, gap: 0 } };
    this.endK = 0; this.endCardOn = false;
    this.vr = false;
    // damage vignette
    this.hurt = plane(vignetteTexture('rgba(120,0,0,0)', 'rgba(160,6,0,0.95)'), 4.2, 4.2);
    this.hurt.position.set(0, 0, -0.9); this.hurt.material.opacity = 0;
    this.slow = plane(vignetteTexture('rgba(30,14,0,0)', 'rgba(25,10,0,0.85)'), 4.2, 4.2);
    this.slow.position.set(0, 0, -0.91); this.slow.material.opacity = 0;
    this.white = plane(null, 4, 4, { color: 0xfff0d8 }); this.white.position.set(0, 0, -0.89); this.white.material.opacity = 0;
    this.black = plane(null, 4, 4, { color: 0x000000 }); this.black.position.set(0, 0, -0.88); this.black.material.opacity = 0;
    // comfort vignette (VR locomotion): tunnel the periphery while moving / right after a snap turn
    this.comfort = plane(vignetteTexture('rgba(0,0,0,0)', 'rgba(0,0,0,1)'), 2.6, 2.6);
    this.comfort.position.set(0, 0, -0.87); this.comfort.material.opacity = 0; this.comfortK = 0;
    this.root.add(this.hurt, this.slow, this.white, this.black, this.comfort);
    // objective line (top centre) and grenade warning
    this.objCanvas = document.createElement('canvas'); this.objCanvas.width = 1024; this.objCanvas.height = 176;
    this.objTex = new THREE.CanvasTexture(this.objCanvas); this.objTex.colorSpace = THREE.SRGBColorSpace;
    this.obj = plane(this.objTex, 0.8, 0.1375); this.obj.position.set(0, 0.3, -1.2); this.obj.material.opacity = 0;
    this.root.add(this.obj); this.objT = 0;
    this.warnCanvas = document.createElement('canvas'); this.warnCanvas.width = 256; this.warnCanvas.height = 256;
    this.warnTex = new THREE.CanvasTexture(this.warnCanvas); this.warnTex.colorSpace = THREE.SRGBColorSpace;
    this.warn = plane(this.warnTex, 0.09, 0.09); this.warn.material.opacity = 0; this.root.add(this.warn);
    this._drawWarn();
    // world-space objective marker (diamond + distance), constant angular size
    this.wpCanvas = document.createElement('canvas'); this.wpCanvas.width = 128; this.wpCanvas.height = 160;
    this.wpTex = new THREE.CanvasTexture(this.wpCanvas); this.wpTex.colorSpace = THREE.SRGBColorSpace;
    this.wp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.wpTex, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false, opacity: 0 }));
    this.wp.renderOrder = 140; this.wp.center.set(0.5, 0.2); scene.add(this.wp); this.wpPos = null; this.wpDist = -1;
    // hit marker
    const hm = document.createElement('canvas'); hm.width = hm.height = 128;
    const hx = hm.getContext('2d'); hx.strokeStyle = '#fff'; hx.lineWidth = 9; hx.lineCap = 'round';
    hx.shadowColor = 'rgba(0,0,0,0.8)'; hx.shadowBlur = 6;
    for (const [a, b, c, d] of [[24, 24, 50, 50], [104, 24, 78, 50], [24, 104, 50, 78], [104, 104, 78, 78]]) { hx.beginPath(); hx.moveTo(a, b); hx.lineTo(c, d); hx.stroke(); }
    const hmt = new THREE.CanvasTexture(hm);
    this.marker = plane(hmt, 0.06, 0.06); this.marker.position.set(0, 0, -1.2); this.marker.material.opacity = 0;
    this.root.add(this.marker);
    this.markerT = 0;
    // crosshair (desktop only)
    const ch = document.createElement('canvas'); ch.width = ch.height = 64;
    const cx = ch.getContext('2d'); cx.fillStyle = 'rgba(255,240,220,0.9)'; cx.shadowColor = 'rgba(0,0,0,0.9)'; cx.shadowBlur = 4;
    cx.beginPath(); cx.arc(32, 32, 3.2, 0, Math.PI * 2); cx.fill();
    cx.fillRect(10, 31, 12, 2); cx.fillRect(42, 31, 12, 2); cx.fillRect(31, 10, 2, 12); cx.fillRect(31, 42, 2, 12);
    this.cross = plane(new THREE.CanvasTexture(ch), 0.035, 0.035); this.cross.position.set(0, 0, -1.2);
    this.root.add(this.cross);
    // subtitle
    this.subCanvas = document.createElement('canvas'); this.subCanvas.width = 1024; this.subCanvas.height = 160;
    this.subTex = new THREE.CanvasTexture(this.subCanvas); this.subTex.colorSpace = THREE.SRGBColorSpace;
    this.sub = plane(this.subTex, 0.95, 0.148); this.sub.position.set(0, -0.36, -1.2); this.sub.material.opacity = 0;
    this.root.add(this.sub);
    this.subT = 0;
    // score panel
    this.scoreCanvas = document.createElement('canvas'); this.scoreCanvas.width = 512; this.scoreCanvas.height = 180;
    this.scoreTex = new THREE.CanvasTexture(this.scoreCanvas); this.scoreTex.colorSpace = THREE.SRGBColorSpace;
    this.scorePanel = plane(this.scoreTex, 0.4, 0.140625); this.scorePanel.position.set(-0.52, 0.33, -1.2);
    this.root.add(this.scorePanel);
    this.lastScore = -1; this.lastHp = -1; this.lastAmmo = '';
    // boss bar
    this.bossCanvas = document.createElement('canvas'); this.bossCanvas.width = 1024; this.bossCanvas.height = 96;
    this.bossTex = new THREE.CanvasTexture(this.bossCanvas); this.bossTex.colorSpace = THREE.SRGBColorSpace;
    this.boss = plane(this.bossTex, 0.7, 0.0656); this.boss.position.set(0, 0.42, -1.2); this.boss.visible = false;
    this.root.add(this.boss);
    this.lastBoss = -1;
    // world title
    this.title = null;
  }
  setVR(v) {
    this.vr = v;
    this.cross.visible = !v;
    // move panels a bit inward/down for headset comfort
    if (v) { this.scorePanel.position.set(-0.3, -0.28, -1.2); this.sub.position.set(0, -0.42, -1.3); this.boss.position.set(0, 0.3, -1.3); this.obj.position.set(0, 0.2, -1.3); }
    else { this.scorePanel.position.set(-0.52, 0.33, -1.2); this.sub.position.set(0, -0.36, -1.2); this.boss.position.set(0, 0.42, -1.2); this.obj.position.set(0, 0.3, -1.2); this.setAspect(this.camera.aspect); }
  }
  setAspect(aspect) {
    if (this.vr) return;
    // keep score panel in the top-left corner for any aspect
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.2;
    const halfW = halfH * aspect;
    this.scorePanel.position.set(-halfW + 0.24, halfH - 0.1, -1.2);
    this.boss.position.set(0, halfH - 0.09, -1.2);
    this.sub.position.set(0, -halfH + 0.13, -1.2);
    this.obj.position.set(0, halfH - 0.235, -1.2);
  }
  setComfort(k) { this.comfortK = k; }
  setWaypoint(pos) { this.wpPos = pos ? pos.clone() : null; }
  _drawWp(d) {
    const c = this.wpCanvas, x = c.getContext('2d');
    x.clearRect(0, 0, 128, 160);
    x.shadowColor = 'rgba(255,110,20,0.9)'; x.shadowBlur = 14;
    x.fillStyle = 'rgba(255,170,60,0.95)';
    x.beginPath(); x.moveTo(64, 98); x.lineTo(88, 74); x.lineTo(64, 50); x.lineTo(40, 74); x.closePath(); x.fill();
    x.shadowBlur = 0; x.fillStyle = 'rgba(40,16,4,0.9)'; x.beginPath(); x.moveTo(64, 88); x.lineTo(78, 74); x.lineTo(64, 60); x.lineTo(50, 74); x.closePath(); x.fill();
    x.font = '700 30px Oswald, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff2dc'; x.shadowColor = 'rgba(0,0,0,0.9)'; x.shadowBlur = 6;
    x.fillText(d + ' M', 64, 34);
    this.wpTex.needsUpdate = true;
  }
  objective(text, dur = 6) {
    const c = this.objCanvas, ctx = c.getContext('2d'), T = text.toUpperCase();
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = 66;
    for (;;) { ctx.font = `700 ${fs}px Oswald, sans-serif`; if (ctx.measureText(T).width < c.width - 150 || fs <= 36) break; fs -= 2; }
    const tw = ctx.measureText(T).width, pw = Math.min(c.width - 40, Math.max(420, tw + 110)), px = (c.width - pw) / 2;
    // backing plate: dark soft pill + orange accent bar, label tab on top
    roundPlate(ctx, px, 52, pw, 108, 22, 'rgba(10,6,3,0.68)', 18);
    ctx.fillStyle = '#ff8a2a'; ctx.fillRect(px + 22, 155, pw - 44, 4);
    roundPlate(ctx, c.width / 2 - 112, 14, 224, 46, 10, 'rgba(255,128,32,0.95)', 0);
    ctx.font = '400 34px Anton, Impact, sans-serif'; ctx.fillStyle = '#1a0c04';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
    ctx.fillText('OBJECTIVE', c.width / 2 + 2, 38);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
    ctx.font = `700 ${fs}px Oswald, sans-serif`; ctx.fillStyle = '#fff4e2'; ctx.fillText(T, c.width / 2, 108);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    this.objTex.needsUpdate = true; this.objT = dur;
  }
  _drawWarn() {
    const c = this.warnCanvas, x = c.getContext('2d');
    x.clearRect(0, 0, 256, 256);
    x.shadowColor = 'rgba(0,0,0,0.8)'; x.shadowBlur = 10;
    x.fillStyle = 'rgba(255,60,20,0.92)'; x.beginPath(); x.arc(128, 128, 92, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0; x.strokeStyle = '#fff0e0'; x.lineWidth = 8; x.stroke();
    x.fillStyle = '#fff6ea'; x.font = '400 92px Anton, Impact'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 128, 128);
    this.warnTex.needsUpdate = true;
  }
  // grenade / danger indicator around the reticle pointing toward a world position (null = hide)
  danger(pos, camPos, camQuat, k = 1) {
    if (!pos) { this.warn.material.opacity = 0; return; }
    const v = _hv.copy(pos).sub(camPos).applyQuaternion(_hq.copy(camQuat).invert());
    const a = Math.atan2(v.x, v.y), r = v.z < 0 && Math.hypot(v.x, v.y) / -v.z < 0.25 ? 0 : 0.17;
    this.warn.position.set(Math.sin(a) * r, Math.cos(a) * r - (r ? 0 : 0.08), -1.2);
    this.warn.material.opacity = k;
    this.warn.scale.setScalar(1 + 0.15 * Math.sin(performance.now() * 0.02));
  }

  hitMarker(big) { this.markerT = 0.12; this.marker.scale.setScalar(big ? 1.5 : 1); }

  // queue a world-space callout; lanes keep at most one big + one small on screen (see _laneUpdate)
  callout(text, pos, style = 'big', sub = null) {
    if (this.endCardOn) return;
    const lane = this.lanes[style === 'small' ? 'small' : 'big'];
    // duplicates: same line already up (and young) or already waiting -> drop it
    if (lane.cur && lane.cur.text === text && lane.cur.t < 1.0) return;
    if (lane.q.some((q) => q.text === text)) return;
    const prio = (PRIO[style] || 1) + (URGENT.has(text) ? 2 : 0);
    lane.q.push({ text, pos: pos.clone(), style, sub, prio, age: 0 });
    // back-pressure: drop the lowest-priority (oldest first) entry
    const max = LANE_MAX[style === 'small' ? 'small' : 'big'];
    while (lane.q.length > max) { let wi = 0; for (let i = 1; i < lane.q.length; i++) if (lane.q[i].prio < lane.q[wi].prio) wi = i; lane.q.splice(wi, 1); }
  }
  _laneUpdate(rdt) {
    for (const key of ['big', 'small']) {
      const L = this.lanes[key];
      L.gap -= rdt;
      for (const q of L.q) q.age += rdt;
      L.q = L.q.filter((q) => q.age < (LANE_WAIT[q.style] || 1) + (URGENT.has(q.text) ? 0.6 : 0));
      if (L.gap > 0 || !L.q.length) continue;
      let bi = 0; for (let i = 1; i < L.q.length; i++) if (L.q[i].prio > L.q[bi].prio) bi = i;
      const q = L.q.splice(bi, 1)[0];
      if (L.cur && !L.cur.dead) { L.cur.retire = true; L.cur.vy = 3.2; } // the previous line flies up and fades fast
      L.cur = this._spawnCallout(q.text, q.pos, q.style, q.sub, key);
      L.gap = q.style === 'huge' ? 1.3 : LANE_GAP; // a set-piece line gets to breathe before anything replaces it
    }
  }
  _spawnCallout(text, pos, style, sub, lane) {
    const size = style === 'huge' ? 150 : style === 'big' ? 120 : 84;
    const color = style === 'small' ? '#fff3dc' : style === 'huge' ? 'fire' : 'chrome';
    const tt = cachedText(text + '|' + style + '|' + sub, () => backed(textTexture(text, { size, color, sub, glow: style === 'small' ? 'rgba(0,0,0,0.8)' : 'rgba(255,110,10,0.95)' }), size, !!sub));
    const mat = new THREE.SpriteMaterial({ map: tt.texture, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 150;
    s.position.copy(pos);
    this.scene.add(s);
    const ang = style === 'huge' ? 0.22 : style === 'big' ? 0.13 : 0.07; // angular height (rad)
    const c = { s, text, lane, t: 0, life: style === 'huge' ? 2.4 : 1.6, ang, aspect: tt.aspect, vy: 1.0, base: pos.clone(), rise: 0, off: 0, h: 0, retire: false, fade: 1 };
    this.callouts.push(c);
    return c;
  }
  // screen-space separation: the small-lane line slides below (or above) the big one instead of overlapping it
  _separate(camPos) {
    const big = this.lanes.big.cur, sm = this.lanes.small.cur;
    _hm.copy(this.camera.matrixWorld).invert();
    _hu.set(0, 1, 0).applyQuaternion(this.camera.getWorldQuaternion(_hq));
    // anchor (without separation offset) in camera tangent space: x/z, y/z, z = depth
    const proj = (c, o) => { _hp.copy(c.base).setY(c.base.y + c.rise).applyMatrix4(_hm); o.z = Math.max(0.5, -_hp.z); o.x = _hp.x / o.z; o.y = _hp.y / o.z; return o; };
    let want = 0;
    if (sm && big && !big.dead && !big.retire && !sm.retire) {
      const A = proj(big, this._pa || (this._pa = {})), Bp = proj(sm, this._pb || (this._pb = {}));
      const ah = big.h / A.z, bh = sm.h / Bp.z;
      // the textures carry generous padding: compare the text bodies, not the quads
      if (Math.abs(A.x - Bp.x) < (ah * big.aspect + bh * sm.aspect) * 0.5 * 0.85) {
        const need = (ah + bh) * 0.5 * 0.66;
        const dy = Bp.y - A.y;
        if (Math.abs(dy) < need) want = ((dy <= 0 ? -need : need) - dy) * Bp.z;
      }
    }
    for (const c of this.callouts) {
      const tgt = c === sm ? want : c.off;
      c.off += (tgt - c.off) * (c.t < 0.08 ? 1 : Math.min(1, (this._rdt || 0.016) * 14));
      c.s.position.copy(c.base).addScaledVector(_hu, c.off); c.s.position.y += c.rise;
    }
  }

  subtitle(speaker, text, dur = 2.5) {
    this.subSpeaker = speaker.toUpperCase();
    const c = this.subCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(8,5,3,0.55)';
    const r = 26;
    ctx.beginPath(); ctx.roundRect(30, 30, c.width - 60, c.height - 60, r); ctx.fill();
    ctx.textBaseline = 'middle';
    const sp = speaker.toUpperCase() + ':  ';
    let fs = 40, w0, w1;
    for (;;) { // shrink long lines to fit the panel
      ctx.font = `700 ${fs}px Oswald, sans-serif`; w0 = ctx.measureText(sp).width;
      ctx.font = `500 ${fs}px Oswald, sans-serif`; w1 = ctx.measureText(text).width;
      if (w0 + w1 < c.width - 110 || fs <= 24) break;
      fs -= 2;
    }
    let x = (c.width - (w0 + w1)) / 2;
    ctx.font = `700 ${fs}px Oswald, sans-serif`; ctx.fillStyle = '#ffae3a'; ctx.fillText(sp, x, c.height / 2);
    ctx.font = `500 ${fs}px Oswald, sans-serif`; ctx.fillStyle = '#fff4e2'; ctx.fillText(text, x + w0, c.height / 2);
    this.subTex.needsUpdate = true;
    this.subT = dur;
  }

  showTitle(pos, text = 'BAYHEM', sub = null, life = 4) {
    if (this.title) { this.scene.remove(this.title.s); this.title.s.material.map?.dispose(); this.title.s.material.dispose(); }
    const tt = titleTexture(text, sub);
    const mat = new THREE.SpriteMaterial({ map: tt.texture, depthTest: false, transparent: true, toneMapped: false, fog: false });
    const s = new THREE.Sprite(mat); s.renderOrder = 160;
    s.position.copy(pos);
    this.scene.add(s);
    this.title = { s, t: 0, life, aspect: tt.aspect, hk: tt.hk, base: pos.clone() };
    if (life > 900) this.endCard(true); // the outro card: gameplay HUD goes away
  }
  // end card / outro title: hide the gameplay HUD (score, ammo, crosshair, objective, markers, callouts)
  endCard(on = true) {
    this.endCardOn = on;
    if (on) { for (const L of Object.values(this.lanes)) L.q.length = 0; this.objT = Math.min(this.objT, 0.3); this.wpPos = null; }
  }

  drawScore(score, hp, ammo, combo) {
    const key = score + '|' + Math.round(hp) + '|' + ammo + '|' + combo;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const c = this.scoreCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(8,5,3,0.5)'; ctx.beginPath(); ctx.roundRect(2, 2, 430, c.height - 4, 18); ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8;
    const g = ctx.createLinearGradient(0, 10, 0, 86);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, '#ffd38a'); g.addColorStop(1, '#ff9a2a');
    ctx.fillStyle = g; ctx.font = '400 74px Anton, Impact, sans-serif'; ctx.textBaseline = 'top';
    ctx.fillText(String(score).padStart(6, '0'), 14, 8);
    if (combo > 1) { ctx.fillStyle = '#ff5a1f'; ctx.font = '400 50px Anton, Impact'; ctx.fillText('x' + Math.min(5, combo), 290, 26); }
    // health bar
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(16, 100, 300, 16);
    const hpc = hp > 50 ? '#f4e3c4' : hp > 25 ? '#ffae3a' : '#ff3a1a';
    ctx.fillStyle = hpc; ctx.fillRect(18, 102, 296 * Math.max(0, hp) / 100, 12);
    ctx.fillStyle = '#fff1dc'; ctx.font = '700 40px Oswald, sans-serif'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
    ctx.fillText(ammo, 14, 146);
    this.scoreTex.needsUpdate = true;
  }
  drawBoss(frac, name) {
    const f = Math.round(frac * 200) / 200;
    if (f === this.lastBoss) return;
    this.lastBoss = f;
    const c = this.bossCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8;
    ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(8,5,3,0.55)'; ctx.beginPath(); ctx.roundRect(90, 0, 844, 92, 18); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#fff0d6'; ctx.font = '400 44px Anton, Impact'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(name, c.width / 2, 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(112, 54, 800, 22);
    const g = ctx.createLinearGradient(0, 0, c.width, 0); g.addColorStop(0, '#ff3a10'); g.addColorStop(1, '#ffb030');
    ctx.fillStyle = g; ctx.fillRect(116, 58, 792 * Math.max(0, f), 14);
    this.bossTex.needsUpdate = true;
  }

  update(rdt, game, camPos) {
    this._rdt = rdt;
    this._laneUpdate(rdt);
    // callouts: pop in, drift up, keep constant angular size
    for (const c of this.callouts) {
      c.t += rdt;
      const k = c.t / c.life;
      const pop = c.t < 0.15 ? 0.3 + (c.t / 0.15) * 0.9 : c.t < 0.3 ? 1.2 - (c.t - 0.15) / 0.15 * 0.2 : 1;
      c.rise += c.vy * rdt;
      if (c.retire || this.endCardOn) c.fade -= rdt / 0.16;
      const d = _hp.copy(c.base).setY(c.base.y + c.rise).distanceTo(camPos);
      const h = Math.max(0.6, d * c.ang) * pop;
      c.h = h;
      c.s.scale.set(h * c.aspect, h, 1);
      c.s.material.opacity = Math.max(0, Math.min(c.fade, k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1));
      if (k >= 1 || c.fade <= 0) { this.scene.remove(c.s); c.s.material.dispose(); c.dead = true; }
    }
    this.callouts = this.callouts.filter(c => !c.dead);
    for (const L of Object.values(this.lanes)) if (L.cur && L.cur.dead) L.cur = null;
    this._separate(camPos);
    if (this.title) {
      const t = this.title; t.t += rdt;
      const k = t.t / t.life;
      const d = t.s.position.distanceTo(camPos);
      const pop = t.t < 0.35 ? 0.6 + (t.t / 0.35) * 0.4 : 1 + (t.t - 0.35) * 0.02;
      const h = d * (t.life > 900 ? 0.5 : 0.3) * pop * (t.hk || 1);
      t.s.scale.set(h * t.aspect, h, 1);
      t.s.material.opacity = t.t < 0.2 ? t.t / 0.2 : k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
      if (k >= 1 && t.life < 900) { this.scene.remove(t.s); this.title = null; }
    }
    this.markerT -= rdt;
    this.marker.material.opacity = this.markerT > 0 ? 1 : 0;
    this.subT -= rdt;
    this.sub.material.opacity = Math.max(0, Math.min(1, this.subT * 3));
    const hurtA = Math.min(1, game.hurtFlash * 0.9 + (game.hp < 40 ? (40 - game.hp) / 40 * 0.55 : 0));
    this.hurt.material.opacity = hurtA;
    this.slow.material.opacity = Math.min(1, (1 - game.timeScale) * 1.3) * 0.85;
    const ck = this.comfort.material.opacity; this.comfort.material.opacity = ck + (this.comfortK - ck) * Math.min(1, rdt * 10);
    this.comfort.visible = this.comfort.material.opacity > 0.01;
    if (this.wpPos) {
      const d = this.wpPos.distanceTo(camPos), dr = Math.round(d);
      if (dr !== this.wpDist) { this.wpDist = dr; this._drawWp(dr); }
      this.wp.position.copy(this.wpPos);
      const h = d * 0.06; this.wp.scale.set(h * 0.8, h, 1);
      const tgt = d < 5 ? 0 : Math.min(0.9, (d - 5) / 6);
      this.wp.material.opacity += (tgt - this.wp.material.opacity) * Math.min(1, rdt * 4);
    } else this.wp.material.opacity = Math.max(0, this.wp.material.opacity - rdt * 3);
    this.wp.visible = this.wp.material.opacity > 0.01;
    this.objT -= rdt; this.obj.material.opacity = Math.max(0, Math.min(1, this.objT * 1.5, (6 - this.objT) * 3 + 0.0));
    const b = game.boss;
    if (b) { this.boss.visible = true; this.drawBoss(b.frac, b.name); } else this.boss.visible = false;
    // end card: fade the gameplay HUD out (score/ammo panel, crosshair, boss bar, markers); subtitles stay
    this.endK += ((this.endCardOn ? 1 : 0) - this.endK) * Math.min(1, rdt * 6);
    const hk = 1 - this.endK, on = hk > 0.02;
    this.scorePanel.material.opacity = hk; this.scorePanel.visible = on;
    this.cross.material.opacity = hk; this.cross.visible = on && !this.vr;
    if (!on) { this.boss.visible = false; this.marker.material.opacity = 0; this.warn.material.opacity = 0; this.obj.material.opacity = 0; this.wp.visible = false; }
  }
}
