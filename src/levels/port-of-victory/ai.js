import * as THREE from 'three';
import { Gunman } from '../../characters.js';
import { rand, range, chance, clamp, damp } from '../../rng.js';

// =====================================================================================
//  On-foot soldier AI: cover -> peek -> burst -> back to cover, flanking, grenades, rushers,
//  perched shooters on container tops. Drives a Gunman in the 'ground' pose.
// =====================================================================================
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _eye = new THREE.Vector3();
let SEED = 1;

// cover points are generated once from the collision world
export function buildCoverPoints(col, nav, { y = 0, kinds = null, spacing = 2.4 } = {}) {
  const pts = [];
  for (const b of col.boxes) {
    if (!b.enabled || b.data.noBullet || b.data.noBlock || b.data.thin || ['fence', 'bound', 'edge', 'rail', 'truck'].includes(b.data.kind)) continue;
    if (kinds && !kinds.includes(b.data.kind)) continue;
    if (b.min.y > y + 0.4 || b.max.y < y + 0.95) continue;
    const h = b.max.y - y, tall = h > 1.7;
    const faces = [[b.min.x, 0, -1, 0], [b.max.x, 0, 1, 0], [b.min.z, 1, 0, -1], [b.max.z, 1, 0, 1]];
    for (const [fv, ax, nx, nz] of faces) {
      const a0 = ax ? b.min.x : b.min.z, a1 = ax ? b.max.x : b.max.z, L = a1 - a0;
      const n = Math.max(1, Math.floor(L / spacing));
      for (let i = 0; i <= n; i++) {
        const a = n === 0 ? (a0 + a1) / 2 : a0 + 0.55 + (L - 1.1) * (i / n);
        const px = ax ? a : fv + nx * 0.62, pz = ax ? fv + nz * 0.62 : a;
        if (!nav.free(px, pz)) continue;
        const edge = Math.min(a - a0, a1 - a) < 1.2;
        pts.push({ p: new THREE.Vector3(px, y, pz), n: new THREE.Vector3(nx, 0, nz), t: new THREE.Vector3(nz, 0, -nx), tall, edge, box: b, taken: null });
      }
    }
  }
  return pts;
}

export class Soldier {
  constructor(game, o) {
    this.g = game;
    this.role = o.role || 'rifle';            // 'rifle' | 'rusher' | 'perch' | 'deck' | 'seated'
    this.nav = o.nav || game.world.nav;
    this.floorY = o.y ?? this.nav?.y ?? 0;
    if (this.nav && o.role !== 'perch' && o.role !== 'seated' && !this.nav.free(o.x, o.z)) { const j = this.nav.nearestFree(o.x, o.z, 8); if (j >= 0) { const c = this.nav.center(j, _v); o = { ...o, x: c.x, z: c.z }; } }
    this.gm = new Gunman({ pose: this.role === 'seated' ? 'window' : 'ground', side: o.side ?? -1, seed: (SEED++ * 7919 + 13) >>> 0, headgear: o.headgear });
    this.root = this.gm.root;
    this.pos = new THREE.Vector3(o.x, this.floorY, o.z);
    this.vel = new THREE.Vector3();
    this.yaw = o.yaw ?? Math.atan2(-(game.headPos.x - o.x), -(game.headPos.z - o.z));
    if (this.role !== 'seated') { this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; game.scene.add(this.root); }
    this.hp = o.hp ?? 3;
    this.alive = true;
    this.state = o.state || 'engage';
    this.path = null; this.pathI = 0; this.cover = null; this.peekSpot = null;
    this.t = 0; this.stateT = 0; this.thinkT = range(0.2, 1.2);
    this.burst = 0; this.cool = range(0.6, 1.8);
    this.los = false; this.losT = 0; this.losCheckT = 0; this.seenT = 0;
    this.aim = new THREE.Vector3();
    this.aggress = o.aggress ?? range(0.3, 0.8);
    this.flanker = o.flanker ?? chance(0.35);
    this.delay = o.delay ?? 0;                // seconds before acting (staggered entries)
    this.entry = o.entry || null;              // optional point to run to first (entering the fight)
    this.perch = o.perch || null;              // {x,z,y, edgeN}
    this.noNade = !!o.noNade;
    this.speedRun = range(4.2, 5.0); this.speedWalk = 1.6;
    this.stepAcc = 0;
    if (this.role === 'perch') {
      this.floorY = o.y; this.pos.y = o.y; this.root.position.y = o.y; this.gm.setCrouch(1);
      // the stack we stand on: we walk along its top to the edge nearest the player
      game.col.query(o.x, o.z, o.x, o.z, (b) => { if (Math.abs(b.max.y - o.y) < 0.3 && o.x >= b.min.x && o.x <= b.max.x && o.z >= b.min.z && o.z <= b.max.z) this.perchBox = b; });
    }
    this.gm.update(1 / 60, game.headPos);
  }

  get chest() { return this.gm.chestCenter.getWorldPosition(_v); }

  // ------------------------------------------------------------ brain
  update(dt) {
    if (!this.alive) return;
    const g = this.g, gm = this.gm;
    this.t += dt; this.stateT += dt;
    if (this.delay > 0) { this.delay -= dt; gm.setMove(0, 0); gm.update(dt, g.headPos); return; }
    const head = g.headPos;
    // line of sight to the player (throttled)
    this.losCheckT -= dt;
    if (this.losCheckT <= 0) {
      this.losCheckT = 0.2 + rand() * 0.1;
      gm.headCenter.getWorldPosition(_eye);
      this.los = g.col.visible(_eye, head, (b) => b.data.noBullet || b.data.ref === this.ignoreBox);
      if (!this.los && this.peekSpot) { _eye.set(this.peekSpot.x, this.floorY + 1.5, this.peekSpot.z); }
    }
    if (this.los) { this.losT += dt; this.seenT = 0; } else { this.losT = 0; this.seenT += dt; }
    const dist = Math.hypot(head.x - this.pos.x, head.z - this.pos.z);
    let moveTo = null, speed = this.speedRun, crouch = 0, peek = 0, aimAt = head, wantFire = false;

    switch (this.role) {
      case 'perch': {
        // crouched on a stack edge: pop up to shoot, duck down to reload / when hit
        const up = this.stateT % 6 < 3.6 && gm.reloadT < 0;
        crouch = up ? 0.15 : 1;
        wantFire = up && this.stateT % 6 > 0.5;
        const b = this.perchBox;
        if (b) { this._pt ||= new THREE.Vector3(); this._pt.set(clamp(head.x, b.min.x + 0.45, b.max.x - 0.45), this.floorY, clamp(head.z, b.min.z + 0.45, b.max.z - 0.45)); moveTo = this._pt; speed = 1.8; }
        break;
      }
      case 'seated': wantFire = false; break;
      case 'rusher': {
        // charge straight at the player, shooting from the hip when in view
        if (dist > 5 || !this.los) moveTo = this._toward(head, dt);
        speed = this.los && dist < 16 ? 2.4 : this.speedRun;
        gm.aimWhileRunning = true;
        wantFire = this.los && dist < 30;
        break;
      }
      default: this._coverBrain(dt, dist); moveTo = this.moveTo; speed = this.moveSpeed; crouch = this.crouchW; peek = this.peekW; wantFire = this.wantFire;
    }
    if (this.entry) { moveTo = this._follow(this.entry, dt); speed = this.speedRun; wantFire = false; if (!moveTo) this.entry = null; }

    // ---- locomotion (path following, soldier separation, walls)
    let vx = 0, vz = 0;
    if (moveTo) {
      _v.set(moveTo.x - this.pos.x, 0, moveTo.z - this.pos.z);
      const d = _v.length();
      if (d > 0.08) { const s = Math.min(speed, d * 4); vx = _v.x / d * s; vz = _v.z / d * s; }
    }
    if (this.role === 'perch') { this.vel.x = damp(this.vel.x, vx, 8, dt); this.vel.z = damp(this.vel.z, vz, 8, dt); this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; }
    if (this.role !== 'perch' && this.role !== 'seated') {
      for (const o of g.soldiers) { if (o === this || !o.alive || o.role === 'perch') continue; const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, d2 = dx * dx + dz * dz; if (d2 < 0.81 && d2 > 1e-6) { const d = Math.sqrt(d2); vx += dx / d * 2.5; vz += dz / d * 2.5; } }
      this.vel.x = damp(this.vel.x, vx, 8, dt); this.vel.z = damp(this.vel.z, vz, 8, dt);
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      g.col.pushCircle(this.pos, 0.32, this.floorY + 0.3, this.floorY + 1.7, 2);
      this.pos.y = this.role === 'deck' ? g.col.groundAt(this.pos.x, this.pos.z, this.floorY + 0.4, 0.5) : this.floorY;
    }
    // facing: toward the player when engaging, toward travel when running blind
    const sp = Math.hypot(this.vel.x, this.vel.z);
    let faceYaw = Math.atan2(-(head.x - this.pos.x), -(head.z - this.pos.z));
    if (sp > 2.5 && !this.los && !gm.aimWhileRunning) faceYaw = Math.atan2(-this.vel.x, -this.vel.z);
    let dy = faceYaw - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * (1 - Math.exp(-dt * (sp > 2.5 ? 7 : 4)));
    if (this.role !== 'seated') { this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; }
    gm.setMove(this.vel.x, this.vel.z);
    gm.setCrouch(crouch); gm.setPeek(peek);
    if (!this.los && sp > 2.5) { _v3.set(this.pos.x + this.vel.x, this.floorY + 1.4, this.pos.z + this.vel.z); aimAt = _v3; }
    // aim point: chest/head of the player with a little sway
    this.aim.copy(aimAt === head ? _v2.set(head.x, head.y - 0.25, head.z) : aimAt);
    gm.update(dt, this.aim);
    // footsteps (only close ones are audible anyway)
    if (gm.stepEvents > 0) { gm.stepEvents = 0; if (dist < 22 && chance(0.7)) g.audio.play(chance(0.25) ? 'gear_rattle' : (this.floorY > 1.5 ? 'step_metal' : 'step_concrete'), { x: this.pos.x, y: this.pos.y, z: this.pos.z, volume: 0.6 }); }
    // grenade release
    if (gm.releaseNow) { gm.releaseNow = false; this.g.enemyGrenade(this); }

    // ---- shooting
    this.cool -= dt;
    if (wantFire && this.los && this.losT > 0.25 && this.cool <= 0 && dist < 70) {
      if (!gm.canFire) { this.cool = 0.12; }
      else {
        if (this.burst <= 0) this.burst = 2 + Math.floor(rand() * 5);
        this.burst--;
        this.cool = this.burst > 0 ? 0.105 : range(0.9, 2.2) * (g.trailer ? 1.25 : 1);
        gm.fire();
        g.enemyShot(this, dist);
      }
    }
  }

  // cover fighter: pick cover, run there, peek & shoot, relocate, flank, throw grenades
  _coverBrain(dt, dist) {
    const g = this.g, gm = this.gm, head = g.headPos;
    this.moveTo = null; this.moveSpeed = this.speedRun; this.crouchW = 0; this.peekW = 0; this.wantFire = false;
    this.thinkT -= dt;
    const coverBad = this.cover && !this._coverValid(this.cover, head);
    if (!this.cover || this.thinkT <= 0 && (coverBad || this.stateT > range(9, 16) || (dist < 6 && chance(0.5)))) {
      this.thinkT = range(1.5, 3);
      const c = this._pickCover(head);
      if (c && c !== this.cover) { if (this.cover) this.cover.taken = null; this.cover = c; c.taken = this; this.path = null; this.state = 'move'; this.stateT = 0; }
      else if (!c && !this.cover) { this.state = 'push'; }
    }
    // nobody has seen the player for a while: go looking (Bay goons don't camp)
    if ((this.state === 'cover' || this.state === 'peek') && this.seenT > (g.trailer ? 3.5 : 6.5)) { this.state = 'push'; this.stateT = 0; }
    if (this.state === 'push' && this.los && this.losT > 0.6 && this.stateT > 1.5) { this.state = 'cover'; this.thinkT = 0; if (this.cover) this.cover.taken = null; this.cover = null; this.state = 'move'; }
    if (this.state === 'push' || (!this.cover && this.state !== 'move')) { // no cover found: advance and shoot
      this.moveTo = this.los && dist < 18 ? null : this._toward(head, dt);
      this.moveSpeed = this.los ? 1.6 : this.speedRun; gm.aimWhileRunning = true;
      this.wantFire = true;
      return;
    }
    if (!this.cover) return;
    const c = this.cover;
    if (this.state === 'move') {
      gm.aimWhileRunning = this.los && rand() < 0.02 ? true : gm.aimWhileRunning;
      const mt = this._follow(c.p, dt);
      if (this.pathFailed) { c.bad = g.time; c.taken = null; this.cover = null; this.pathFailed = false; this.thinkT = 0; this.state = 'push'; return; }
      this.moveTo = mt; this.wantFire = this.los && gm.aimWhileRunning;
      if (!mt || this.pos.distanceToSquared(c.p) < 0.2) { this.state = 'cover'; this.stateT = 0; this.peekPhase = range(0.6, 1.4); this.peekSpot = null; gm.aimWhileRunning = false; }
      return;
    }
    if (this.state === 'cover' || this.state === 'peek') {
      // reload behind cover
      if (gm.ammo < 8 && gm.reloadT < 0 && this.state === 'cover') gm.reload();
      this.peekPhase -= dt;
      if (this.state === 'cover') {
        this.crouchW = c.tall ? 0.85 : 1;
        this.moveTo = c.p; this.moveSpeed = 2.5;
        // grenade when the player has been hiding a while
        if (!this.noNade && this.seenT > 3.5 && dist > 7 && dist < 26 && g.nadeCool <= 0 && chance(dt * 0.6)) { if (gm.throwGrenade()) { g.nadeCool = range(7, 11) * (g.trailer ? 1.4 : 1); } }
        if (this.peekPhase <= 0 && gm.reloadT < 0 && gm.throwT < 0) {
          this.peekSpot = this._findPeek(c, head);
          if (this.peekSpot) { this.state = 'peek'; this.peekPhase = range(1.4, 2.8); }
          else { this.peekPhase = range(0.8, 1.5); if (this.seenT > 6) this.thinkT = 0; }
        }
      } else {
        // out of cover: step to the peek spot, shoot, go back
        this.moveTo = this.peekSpot.p; this.moveSpeed = 2.6;
        this.crouchW = this.peekSpot.crouch; this.peekW = this.peekSpot.lean;
        this.wantFire = true;
        if (this.peekPhase <= 0 || gm.ammo <= 0 || gm.hitT > 0.3) { this.state = 'cover'; this.peekPhase = range(1.0, 2.6) * (1.2 - this.aggress * 0.6); }
      }
    }
  }
  _coverValid(c, T) {
    _v.subVectors(T, c.p); const d = _v.length();
    if (d < 4) return false;
    return _v.dot(c.n) < -0.25 * d;
  }
  _pickCover(T) {
    const g = this.g, pts = g.cover;
    if (!pts) return null;
    let best = null, bs = -1e9;
    const myD = Math.hypot(T.x - this.pos.x, T.z - this.pos.z);
    const fx = g.playerFwd.x, fz = g.playerFwd.z;
    for (const c of pts) {
      if (c.taken && c.taken !== this) continue;
      if (c.bad && g.time - c.bad < 20) continue;
      if (c === this.cover && this.seenT > 5) continue;
      if (c.p.y !== this.floorY && Math.abs(c.p.y - this.floorY) > 0.5) continue;
      const dxs = c.p.x - this.pos.x, dzs = c.p.z - this.pos.z, ds = Math.hypot(dxs, dzs);
      if (ds > 34) continue;
      const dx = c.p.x - T.x, dz = c.p.z - T.z, dp = Math.hypot(dx, dz);
      if (dp < 9 || dp > 38) continue;
      if (!this._coverValid(c, T)) continue;
      let s = -Math.abs(dp - (14 + (1 - this.aggress) * 10)) * 1.2 - ds * 0.35;
      if (c.edge) s += 4; // corners are where you can peek from
      if (this.flanker) { const side = (dx * fx + dz * fz) / dp; s += (1 - Math.abs(side)) * 6 - (side > 0.6 ? 6 : 0); }
      // prefer cover in front of the player (not behind his back), and moving forward
      s += (dp < myD ? 2 : 0) * this.aggress;
      for (const o of g.soldiers) if (o !== this && o.alive && o.cover && o.cover.p.distanceToSquared(c.p) < 9) s -= 6;
      if (s > bs) { bs = s; best = c; }
    }
    return best;
  }
  // try small offsets around the cover point (step past the edge, stand up over low cover) for a spot with LOS
  _findPeek(c, head) {
    const g = this.g;
    const tries = c.tall ? [[1.1, 0, 0], [-1.1, 0, 0], [1.8, 0, 0], [-1.8, 0, 0]] : [[0, 0.1, 0], [0.9, 0, 0], [-0.9, 0, 0]];
    for (const [t, crouch] of tries) {
      const p = _v.copy(c.p).addScaledVector(c.t, t);
      if (!this.nav.free(p.x, p.z)) continue;
      _eye.set(p.x, this.floorY + (crouch > 0.5 ? 1.0 : 1.55), p.z);
      if (g.col.visible(_eye, head, (b) => b.data.noBullet)) return { p: p.clone(), crouch: c.tall ? 0 : crouch, lean: t > 0 ? 1 * Math.sign(c.t.x * 0 + 1) * 0 : 0 };
    }
    return null;
  }
  // path following on the nav grid (repaths when the goal moves)
  _follow(goal, dt) {
    if (!this.nav) return goal;
    if (!this.path || this.pathGoal.distanceToSquared(goal) > 1 || this.repathT <= 0) {
      const pth = this.nav.path(this.pos, goal);
      this.pathFailed = !pth;
      this.path = pth || [this.pos.clone(), goal.clone()];
      this.pathI = 1; this.pathGoal = (this.pathGoal || new THREE.Vector3()).copy(goal); this.repathT = 3;
    }
    this.repathT -= dt;
    while (this.pathI < this.path.length && Math.hypot(this.path[this.pathI].x - this.pos.x, this.path[this.pathI].z - this.pos.z) < 0.6) this.pathI++;
    if (this.pathI >= this.path.length) return null;
    return this.path[this.pathI];
  }
  _toward(T, dt) { this._tw ||= new THREE.Vector3(); this._tw.set(T.x, this.floorY, T.z); const r = this._follow(this._tw, dt); return r; }

  // ------------------------------------------------------------ damage
  hit(dir, kind) {
    this.hp -= kind === 'head' ? 99 : kind === 'leg' ? 0.8 : 1;
    if (this.hp > 0) { this.gm.hit(dir); if (this.state === 'peek') { this.state = 'cover'; this.peekPhase = range(0.8, 1.6); } }
    return this.hp <= 0;
  }
  die(dir, power, scene) {
    this.alive = false;
    if (this.cover) this.cover.taken = null;
    _v.set(this.vel.x, 0, this.vel.z);
    return this.gm.die(_v, dir, scene, power);
  }
}
