import { buildCargoPlane } from '/src/levels/airport-no-return/aircraft.js';
export function cargoOpen(ramp = 0.14, door = 0.9) { const p = buildCargoPlane(); p.setRamp(ramp); p.setDoor(door); return p; }
