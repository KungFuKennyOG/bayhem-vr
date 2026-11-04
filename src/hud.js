import * as THREE from 'three';
import { textTexture } from './textures.js';

const texCache = new Map();
const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3();
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
    this.vr = false;
    // damage vignette
    this.hurt = plane(vignetteTexture('rgba(120,0,0,0)', 'rgba(160,6,0,0.95)'), 4.2, 4.2);
    this.hurt.position.set(0, 0, -0.9); this.hurt.material.opacity = 0;
    this.slow = plane(vignetteTexture('rgba(30,14,0,0)', 'rgba(25,10,0,0.85)'), 4.2, 4.2);
    this.slow.position.set(0, 0, -0.91); this.slow.material.opacity = 0;
    this.white = plane(null, 4, 4, { color: 0xfff0d8 }); this.white.position.set(0, 0, -0.89); this.white.material.opacity = 0;
    this.black = plane(null, 4, 4, { color: 0x000000 }); this.black.position.set(0, 0, -0.88); this.black.material.opacity = 0;
    this.root.add(this.hurt, this.slow, this.white, this.black);
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
    if (v) { this.scorePanel.position.set(-0.3, -0.28, -1.2); this.sub.position.set(0, -0.42, -1.3); this.boss.position.set(0, 0.3, -1.3); }
    else { this.scorePanel.position.set(-0.52, 0.33, -1.2); this.sub.position.set(0, -0.36, -1.2); this.boss.position.set(0, 0.42, -1.2); }
  }
  setAspect(aspect) {
    if (this.vr) return;
    // keep score panel in the top-left corner for any aspect
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.2;
    const halfW = halfH * aspect;
    this.scorePanel.position.set(-halfW + 0.24, halfH - 0.1, -1.2);
    this.boss.position.set(0, halfH - 0.09, -1.2);
    this.sub.position.set(0, -halfH + 0.13, -1.2);
  }
  hitMarker(big) { this.markerT = 0.12; this.marker.scale.setScalar(big ? 1.5 : 1); }

  callout(text, pos, style = 'big', sub = null) {
    const size = style === 'huge' ? 150 : style === 'big' ? 120 : 84;
    const color = style === 'small' ? '#fff3dc' : style === 'huge' ? 'fire' : 'chrome';
    const tt = cachedText(text + '|' + style + '|' + sub, () => textTexture(text, { size, color, sub, glow: style === 'small' ? 'rgba(0,0,0,0.8)' : 'rgba(255,110,10,0.95)' }));
    const mat = new THREE.SpriteMaterial({ map: tt.texture, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, fog: false });
    const s = new THREE.Sprite(mat);
    s.renderOrder = 150;
    s.position.copy(pos);
    this.scene.add(s);
    const ang = style === 'huge' ? 0.22 : style === 'big' ? 0.13 : 0.07; // angular height (rad)
    // avoid stacking: offset if other callouts are near
    // screen-space stacking: if this callout overlaps a live one from the camera's view, lift it above
    const cam = this.lastCam;
    if (cam) {
      s.position.lerp(cam, 0.15); // sit in front of the explosion it labels
      for (let k = 0; k < 4; k++) {
        let moved = false;
        for (const c of this.callouts) {
          const a = _d1.subVectors(c.s.position, cam), b = _d2.subVectors(s.position, cam);
          const da = a.length(), db = b.length();
          const sep = a.angleTo(b), need = (ang + c.ang) * 0.62;
          if (sep < need) { s.position.y += db * (need - sep + 0.02) * 1.1; moved = true; }
        }
        if (!moved) break;
      }
    }
    this.callouts.push({ s, t: 0, life: style === 'huge' ? 2.4 : 1.6, ang, aspect: tt.aspect, vy: 1.0 });
  }

  subtitle(speaker, text, dur = 2.5) {
    this.subSpeaker = speaker.toUpperCase();
    const c = this.subCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(8,5,3,0.55)';
    const r = 26;
    ctx.beginPath(); ctx.roundRect(30, 30, c.width - 60, c.height - 60, r); ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.font = '700 40px Oswald, sans-serif';
    const sp = speaker.toUpperCase() + ':  ';
    const w0 = ctx.measureText(sp).width;
    ctx.font = '500 40px Oswald, sans-serif';
    const w1 = ctx.measureText(text).width;
    let x = (c.width - (w0 + w1)) / 2;
    ctx.font = '700 40px Oswald, sans-serif'; ctx.fillStyle = '#ffae3a'; ctx.fillText(sp, x, c.height / 2);
    ctx.font = '500 40px Oswald, sans-serif'; ctx.fillStyle = '#fff4e2'; ctx.fillText(text, x + w0, c.height / 2);
    this.subTex.needsUpdate = true;
    this.subT = dur;
  }

  showTitle(pos, text = 'BAYHEM', sub = null, life = 4) {
    const tt = textTexture(text, { size: 220, color: 'chrome', sub, stroke: 12, padding: 70 });
    const mat = new THREE.SpriteMaterial({ map: tt.texture, depthTest: false, transparent: true, toneMapped: false, fog: false });
    const s = new THREE.Sprite(mat); s.renderOrder = 160;
    s.position.copy(pos);
    this.scene.add(s);
    this.title = { s, t: 0, life, aspect: tt.aspect, base: pos.clone() };
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
    ctx.fillStyle = '#fff1dc'; ctx.font = '700 46px Oswald, sans-serif'; ctx.textBaseline = 'middle';
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
    this.lastCam = (this.lastCam || new THREE.Vector3()).copy(camPos);
    // callouts: pop in, drift up, keep constant angular size
    for (const c of this.callouts) {
      c.t += rdt;
      const k = c.t / c.life;
      const pop = c.t < 0.15 ? 0.3 + (c.t / 0.15) * 0.9 : c.t < 0.3 ? 1.2 - (c.t - 0.15) / 0.15 * 0.2 : 1;
      c.s.position.y += c.vy * rdt;
      const d = c.s.position.distanceTo(camPos);
      const h = Math.max(0.6, d * c.ang) * pop;
      c.s.scale.set(h * c.aspect, h, 1);
      c.s.material.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      if (k >= 1) { this.scene.remove(c.s); c.s.material.dispose(); c.dead = true; }
    }
    this.callouts = this.callouts.filter(c => !c.dead);
    if (this.title) {
      const t = this.title; t.t += rdt;
      const k = t.t / t.life;
      const d = t.s.position.distanceTo(camPos);
      const pop = t.t < 0.35 ? 0.6 + (t.t / 0.35) * 0.4 : 1 + (t.t - 0.35) * 0.02;
      const h = d * (t.life > 900 ? 0.5 : 0.3) * pop;
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
    const h = game.heli;
    if (h && h.phase !== 'enter' && h.alive) { this.boss.visible = true; this.drawBoss(h.hp / h.maxHp, 'GUNSHIP  "WIDOWMAKER"'); } else this.boss.visible = false;
  }
}
