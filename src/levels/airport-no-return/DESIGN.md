# LEVEL 4 — AIRPORT NO RETURN (design notes)

On foot across a sunset airport apron, two airliners taxiing for take-off go up in a fireball on the
taxiway, then a borrowed FOLLOW-ME jeep chases a four-engine cargo plane down runway 27. The jeep puts
you under the open ramp as the plane rotates; you jump, land in the hold, and the credits roll over the
burning airport as the ramp closes.

Look: Michael Bay at a polished PS2-era level. Low sun straight down the runway (`SUN_AZ` in game.js,
just left of the runway heading, elevation 6° → below the horizon by the credits), long shadows, the
cargo plane silhouetted against the sun during the chase, runway / taxiway / approach lights coming on.

## World frame (metres) — see layout.js
- y up, ground y = 0 everywhere on the airfield. Runway 27: centreline x = 0, 60 m wide, from the
  threshold at z = +420 to z = -2900 (aircraft roll toward -z, into the sun).
- Taxiway A at x = 112 (23 m wide) with connectors; the high-speed exit at z ≈ -150 → -330 is the jeep's way
  onto the runway.
- Apron (concrete) x 124…336, z 84…340. Hangars 1-3 (58 × 46 m, doors face -z) at x = 168 / 232 / 296, door
  plane z = 340. Start: inside hangar 2.
- Tower (360, 70), fuel farm (300, 30), passenger terminal across the runway (scenery).
- On-foot bounds: x ≥ 121.5 (taxiway edge, opened when you board), z 80…392, x ≤ 338.

## Beats (director.js) — `?level=airport-no-return&beat=<name>` jumps to any of them
1. **intro** — hangar 2, title card, the driver on the radio.
2. **apronA** — six goons among the GSE, a perch on a stair truck, a rusher; JET A-1 refuelers explode.
3. **apronB** — seven more around the parked PACIFICA airliner (refueler by its wing).
4. **taxi** — two airliners taxi up taxiway A toward the threshold. Shoot / grenade an engine: it smokes,
   burns, blows, then the wing + centre tanks go and the airframe breaks into four burning rigid pieces
   (+ a loose engine that cartwheels across the apron). The second jet brakes too late and ploughs in.
   Fallback: the lead jet's engine gives out once it's level with the apron.
5. **getaway** — the cargo plane starts its roll; the FOLLOW-ME jeep J-turns at the apron edge; get in.
6. **chase1 / chase2** — rail mode (Level 1's truck-bed idea: the driver drives, you shoot). Black SUVs with
   window + roof gunners, ramp crew firing from the hold, drum pallets kicked out of the ramp (the driver
   swerves), a speed bar for the plane.
7. **jump** — the plane holds just under rotation speed until the jeep is under the ramp, then rotates (the
   ramp lip scrapes sparks off the runway). Jump: grip / A in VR, Space on desktop, auto after 3 s.
8. **aboard** — land in the hold; the jeep peels off into the grass and blows up (the driver bailed).
9. **credits** — world-space credits rise behind the ramp, the ramp closes, fade to black.

## Systems
- `world.js` — static geometry is merged per material (`StaticBatch`): one mesh for all GSE, one for the
  world props. Lights are one `BillboardBatch` (runway edge / centreline / threshold / approach rabbit /
  taxiway / sodium masts / obstruction / tower beacon / PAPI) with a minimum angular size so they read as
  points far down the runway; other systems add per-frame glows via `world.addGlow`.
- `aircraft.js` — lofted fuselages (`shapes.js` `loft`), NACA-section wings, canvas liveries mapped
  length × angle. Airliners are four parts (nose, aft, wings) so they can break up; the cargo plane has a
  hinged ramp, a lit hold, crew positions.
- `game.js` — combat sandbox adapted from Level 2 (`PortGame`), plus refuelers (leak → burn → blow + flip),
  persistent smoke columns, enemy fire that knows when you ride something (`game.carrier`).
- `setpieces.js` — jets, cargo plane, jeep ride (Catmull-Rom path, speed chases a scripted gap to the ramp
  lip), chase SUVs, ramp crew, pallets, leap, credits. While riding, the muzzle-flash particle system is
  offset with the carrier and casings inherit its velocity.
- Soldier AI is Level 2's `port-of-victory/ai.js` (imported). It should move to `src/` once Level 2 lands.
