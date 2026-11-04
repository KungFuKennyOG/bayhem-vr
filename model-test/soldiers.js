import * as THREE from 'three';
import { Gunman } from '/src/characters.js';

// on-foot soldier pose test: idle, walk, run, crouch, peek, strafe, throw
export function soldiers() {
  const root = new THREE.Group();
  const P = new URLSearchParams(location.search);
  const states = (P.get('states') || 'idle,walk,run,crouch,peekL,strafe,throw,crouchwalk').split(',');
  const list = [];
  states.forEach((st, i) => {
    const g = new Gunman({ pose: 'ground', seed: 11 + i * 7 });
    g.root.position.set((i - (states.length - 1) / 2) * 1.6, 0, 0);
    root.add(g.root);
    const tgt = new THREE.Vector3(g.root.position.x + 0.5, 1.4, 12); // look toward the camera (+z)
    g.root.rotation.y = Math.PI; // face +z
    list.push({ g, st, tgt });
  });
  const update = (dt) => {
    for (const { g, st, tgt } of list) {
      let vx = 0, vz = 0, aim = tgt;
      if (st === 'walk') vz = 1.5;
      if (st === 'run') { vz = 5.0; g.aimWhileRunning = false; }
      if (st === 'strafe') vx = 2.2;
      if (st === 'crouch' || st === 'peekL' || st === 'crouchwalk') g.setCrouch(1);
      if (st === 'crouchwalk') vz = 1.2;
      if (st === 'peekL') g.setPeek(-1);
      if (st === 'throw' && g.throwT < 0 && !g._did) { g._did = true; g.throwGrenade(); }
      g.setMove(vx, vz);
      // keep them in place visually (treadmill): we don't move the root
      g.update(dt, aim);
    }
  };
  for (let i = 0; i < +(P.get('pre') || 20); i++) update(1 / 30);
  return { root, update };
}
