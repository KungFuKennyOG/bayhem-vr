import * as THREE from 'three';
import { clamp, range } from '../../rng.js';

// =====================================================================================
//  Autopilot for demo / trailer capture: walks a goal chain on the nav grids (or straight
//  lines down the subway stairs), slows down to fight, sprints when told; looks where it is going
//  when nothing needs shooting.
// =====================================================================================
const _v = new THREE.Vector3();
export class Auto {
  constructor(game, player) {
    this.g = game; this.p = player;
    this.goals = []; this.path = null; this.pathI = 0; this.repath = 0;
    this.sprint = false; this.look = null; this.lookT = 0;
    this.stuck = 0; this.last = new THREE.Vector3();
  }
  // goals: [{ p: Vector3, nav: 'ground'|'deck'|null, sprint?, wait? }]
  go(goals, opts = {}) {
    this.goals = goals.map(g => {
      const p = g.p.clone(), nav = g.nav === 'ground' ? this.g.world.nav : null;
      if (nav && !nav.free(p.x, p.z)) { const j = nav.nearestFree(p.x, p.z, 4); if (j >= 0) { const c = nav.center(j, new THREE.Vector3()); p.x = c.x; p.z = c.z; } }
      return { ...g, p };
    });
    this.path = null; this.sprint = !!opts.sprint;
  }
  get idle() { return this.goals.length === 0; }
  get feet() { return _v.set(this.g.headPos.x, this.g.rig.position.y, this.g.headPos.z); }

  update(dt) {
    const p = this.p, g = this.g;
    p.autoMove.set(0, 0, 0);
    // hunting: nothing to shoot for a while but enemies remain -> go find them
    const A = p.autoState;
    const fighting = A.target && A.target.kind !== 'look';
    this.noTgt = fighting ? 0 : (this.noTgt || 0) + dt;
    if (fighting && this.goals[0]?.hunt) this.goals.shift();
    if (this.hunt && this.goals.length === 0 && this.noTgt > 2.2) {
      const feet = this.feet; let best = null, bd = 1e9;
      for (const s of g.soldiers) if (s.alive && s.delay <= 0 && s.role !== 'seated' && s.role !== 'deck') { const d = s.pos.distanceTo(feet) + (s.role === 'sniper' ? 25 : 0); if (d < bd) { bd = d; best = s; } }
      // snipers: get somewhere in front of them with a view (out along the direction they face)
      if (best && best.role === 'sniper') this.goals.push({ p: new THREE.Vector3(best.pos.x + best.face[0] * 26, 0, best.pos.z + best.face[1] * 26), nav: 'ground', slow: 0.75, tol: 6, hunt: true });
      else if (best) this.goals.push({ p: best.pos.clone().setY(0), nav: 'ground', slow: 0.75, tol: 5, hunt: true });
    }
    const G = this.goals[0];
    if (!G) return;
    const feet = this.feet.clone();
    const navG = G.nav === 'ground' ? g.world.nav : null;
    if (navG && (!this.path || this.repath <= 0)) { this.path = navG.path(feet, G.p) || [feet.clone(), G.p.clone()]; this.pathI = 1; this.repath = 1.5; }
    if (!navG) { this.path = [feet.clone(), G.p.clone()]; this.pathI = 1; }
    this.repath -= dt;
    while (this.pathI < this.path.length - 1 && Math.hypot(this.path[this.pathI].x - feet.x, this.path[this.pathI].z - feet.z) < 0.7) this.pathI++;
    const W = this.path[Math.min(this.pathI, this.path.length - 1)];
    const dx = W.x - feet.x, dz = W.z - feet.z, d = Math.hypot(dx, dz);
    const dGoal = Math.hypot(G.p.x - feet.x, G.p.z - feet.z);
    if (dGoal < (G.tol ?? 0.6)) { this.goals.shift(); this.path = null; return; }
    // fighting: walk (it's a shooter, not a marathon); otherwise jog / sprint
    const engaged = p.autoState.target && p.autoState.target.kind !== 'look';
    let mag = (G.sprint ?? this.sprint) ? 1.5 : engaged ? 0.8 : 1.0;
    if (G.slow) mag = Math.min(mag, G.slow);
    mag *= clamp(dGoal / 1.5, 0.35, 1);
    if (d > 1e-3) p.autoMove.set(dx / d * mag, 0, dz / d * mag);
    // unstick: if we barely moved for a while, repath / nudge sideways
    if (feet.distanceTo(this.last) < 0.02 * dt * 30) this.stuck += dt; else this.stuck = 0;
    this.last.copy(feet);
    if (this.stuck > 1.2) { this.repath = 0; p.autoMove.set(-dz / (d || 1), 0, dx / (d || 1)); if (this.stuck > 2.5) this.stuck = 0; }
  }
  // where to look when nothing needs shooting: along the path (a little ahead), or a director look point
  idleLook(A, player) {
    const head = this.g.headPos;
    let tx, ty, tz;
    if (this.look && this.lookT > 0) { tx = this.look.x; ty = this.look.y; tz = this.look.z; }
    else if (this.path && this.goals.length) {
      const W = this.path[Math.min(this.pathI + 1, this.path.length - 1)];
      tx = W.x; tz = W.z; ty = head.y - 0.1;
      if (Math.hypot(tx - head.x, tz - head.z) < 2) { const G = this.goals[0].p; tx = G.x; tz = G.z; }
    } else return { yaw: player.yaw, pitch: player.pitch * 0.95 };
    const ddx = tx - head.x, ddz = tz - head.z;
    const yaw = Math.atan2(-ddx, -ddz);
    let dy = yaw - player.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    return { yaw: player.yaw + dy, pitch: Math.atan2(ty - head.y, Math.hypot(ddx, ddz)) * 0.8 };
  }
}
