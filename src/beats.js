// =====================================================================================
//  Shared beat helpers for the on-foot directors.
//
//  Reaching the objective marker moves the beat on. Combat beats used to wait for EVERY
//  soldier to die (or a 60–110 s fallback), so one hidden perch, a flanker still walking in,
//  or a straggler you ran past left the player standing on the marker with nothing happening.
//
//  A beat opts in with `arrive: true` (or `arrive: () => bool` for extra conditions, e.g.
//  "the snipers must be down"). Once the player stands within ARRIVE_R of the marker:
//    - a beat with at most 2 soldiers left nearby moves on after ~1 s;
//    - otherwise it moves on after 6 s at the marker, whatever is left.
//  Soldiers more than 45 m away leave the fight when that happens (Level 4's getaway rule),
//  so they can't block the next beat's "cleared" check from behind you.
// =====================================================================================
const ARRIVE_R = 6;        // m, horizontal
const NEAR_R = 35;         // soldiers inside this still count as "the fight"
const FAR_R = 45;          // soldiers beyond this are dropped on an arrival skip
const QUICK = 1.0, MAX_WAIT = 6.0;

//  A beat whose `arrive()` still says no (snipers up, the boat still afloat) can add `gate: () =>
//  Vector3 | null`: once the player has stood at the marker for GATE_T, the waypoint moves to what is
//  holding the beat (and `gateMsg` pops as a callout), then returns to the marker when it's dealt with.
//  Before, the marker just sat under the player's feet with nothing happening.
const GATE_T = 2.0;

function updateGate(dir, s, atMarker, dt) {
  const g = dir.g, hud = g.hud;
  if (dir.gateBeat !== s) { dir.gateBeat = s; dir.gateOn = false; dir.gateT = 0; }
  if (!s.gate || !hud) return;
  if (!dir.gateOn) {
    dir.gateT = atMarker ? dir.gateT + dt : 0;
    if (dir.gateT < GATE_T) return;
    const P = s.gate(); if (!P) return;
    dir.gateOn = true;
    if (s.gateMsg) g.callout?.(s.gateMsg, P.clone().setY(P.y + 3), 'small');
  }
  const P = s.gate();
  if (P) hud.setWaypoint(P); else { dir.gateOn = false; dir.gateT = 0; hud.setWaypoint(s.wp); }
}

export function arrivedAtMarker(dir, dt) {
  const s = dir.cur, g = dir.g;
  if (!s || !s.wp || !s.arrive || dir.t < 3) return false;
  const h = g.headPos;
  const at = Math.hypot(h.x - s.wp.x, h.z - s.wp.z) <= ARRIVE_R;
  if (typeof s.arrive === 'function' && !s.arrive()) { dir.atMarker = 0; updateGate(dir, s, at, dt); return false; }
  if (dir.gateOn) { dir.gateOn = false; g.hud?.setWaypoint(s.wp); }
  if (!at) { dir.atMarker = 0; return false; }
  dir.atMarker = (dir.atMarker || 0) + dt;
  let near = 0;
  for (const o of g.soldiers) if (o.alive && o.pos.distanceTo(h) < NEAR_R) near++;
  if (!(dir.atMarker > QUICK && near <= 2) && dir.atMarker < MAX_WAIT) return false;
  for (const o of g.soldiers) {
    if (!o.alive || o.role === 'sniper' || o.pos.distanceTo(h) < FAR_R) continue;
    o.alive = false; o.root.visible = false;
  }
  dir.atMarker = 0;
  return true;
}
