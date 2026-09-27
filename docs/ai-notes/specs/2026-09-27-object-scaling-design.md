# Object scaling: bigger aircraft and targets (issue #2)

**Issue:** #2 "Objekte vergrössern um Faktor 1.5 / 2 (vor allem das Flugzeug)"
**Date:** 2026-09-27
**Status:** Draft (quick-mode enrich, no questions asked; decisions are recorded as assumptions in the issue body)

## Goal

Make game objects easier to see: the player's plane gets the biggest boost, and the
other objects get a moderate one. The playing field stays the same size: world
coordinates, camera zoom, terrain, the carrier deck, the sea line and distances are
all unchanged.

## How the game sizes things today

- A single world-to-screen zoom `this.scale = h / 980` (`sky-fury.js:219`) is applied by
  `this.sx/this.sy` (`sky-fury.js:1205-1206`). That is the "field". Changing it would
  zoom the whole view, which the issue rules out.
- Each sprite is drawn in local units multiplied by a per-object pixel scale `s`:
  - player `1.15 * sc` (`:1620`)
  - fighter `1.05 * sc` (`:1651`)
  - bomber `1.1 * sc` (`:1666`)
  - ground targets `s = sc` (`:1464`, parked planes `0.9 * s` at `:1526`)
  - projectiles use `sc` directly (bombs `:1731-1733`, rockets `:1743-1746`, torpedoes `:1758-1763`)
- Hitboxes are hard-coded world-unit numbers that are separate from the drawing:
  - fighter vs bullet radius `20` (`:837`)
  - bomber box `34x14` (bullets `:845`) and `36x16` (rockets `:948`)
  - ground target box `hw 22/30, hh 24/52` (`:827`) and rocket box `26/30` (`:941`)
  - blast target padding `+18` (`:1061`)
  - player: enemy bullet radius `16` (`:875`), mid-air collision `26` (`:653`), flak `56` (`:1017`)
- Spawn offsets are tied to the plane's size: muzzle `20` (`:495`), bomb `+10` (`:508`),
  rocket `16/+6` (`:514`), torpedo `+12` (`:524`), vapor/smoke tail `14/16` (`:455`, `:535`),
  AA barrel pivot `t.y - 12` (`:718`), bomber bomb bay `+14` (`:692`).

## Approach

Add two named constants next to the other constants (`sky-fury.js:131-134`):

```js
const PLANE_SCALE = 2;   // all aircraft in flight (player, fighters, bombers)
const OBJ_SCALE = 1.5;   // ground targets (incl. parked planes) and projectile sprites
```

- **Aircraft ×2.** Multiply the three `const s = … * sc` lines in `drawAircraft` by
  `PLANE_SCALE`. Enemy aircraft get the same factor as the player, so relative plane
  sizes stay believable.
- **Ground targets ×1.5.** In `drawTargets`, change `const sc = this.scale` to
  `this.scale * OBJ_SCALE`. The sprite, the wreck and the damage bar all scale from
  this one line, and parked planes inherit it.
- **Projectile sprites ×1.5.** Bombs, rockets and torpedoes use a local
  `os = sc * OBJ_SCALE` in `drawProjectiles`. Tracer lines and flak dots stay as they
  are, because their length encodes velocity.
- **Hitboxes follow the visuals for things the player shoots at.** The fighter radius
  and bomber box scale by `PLANE_SCALE`. Ground target boxes, the rocket box and the
  blast padding scale by `OBJ_SCALE`.
- **The player's own damage hitboxes stay as they are** (bullet 16, mid-air 26, flak,
  blast). This is a deliberately forgiving arcade hitbox, so the bigger plane doesn't
  make the game 4x harder.
- **Spawn offsets that are tied to the plane's geometry scale by `PLANE_SCALE`.** These
  are muzzle, bomb, rocket, torpedo, vapor and smoke on the player, and the bomber's
  bomb bay. The AA barrel pivot scales by `OBJ_SCALE`. Without this, shots would come
  out of the middle of the fuselage.
- **Unchanged (field / physics):**
  - `this.scale`, `WORLD_W`, `DECK_Y`, `CV`, `ISLE`
  - ship width `w: 190` and the carrier
  - the plane's rest height on deck `DECK_Y - 12` and the crash thresholds (`:557-558`)
  - all speeds, turn rates, spawn timers and spawn spacing
  - explosion and fx sizes

  At ×2 the plane's belly (about 11.5 world units below its centre) just touches the
  deck at `DECK_Y - 12`, so no landing-physics change is needed.

## Acceptance criteria

- The player's plane is drawn at 2x its current size. Enemy fighters and bombers are
  also 2x.
- Ground targets (AA, tank, jeep, bunker, fuel, parked plane, radar), their wrecks and
  their damage bars are drawn at 1.5x.
- Bombs, rockets and torpedoes (and the torpedo wake) are drawn at 1.5x.
- The playing field is unchanged: the same world area is visible for a given window
  height, and terrain, carrier, ships and sea level look identical.
- Bullets hit enemy fighters, bombers and ground targets wherever their enlarged
  sprites are visibly struck.
- The player's damage hitboxes are unchanged.
- Gun tracers leave from the enlarged nose. Bombs, rockets and torpedoes leave from
  beneath or in front of the enlarged plane, not from inside it.
- The plane sits on the carrier deck without visibly sinking into it or floating
  above it. Take-off, landing and rearm still work.
- Both factors can be tuned by editing a single constant each.
- The console is empty on load and during play.

## Out of scope

- Any camera or zoom change, and a bigger world.
- Scaling ships, the carrier, the island, clouds, explosions, smoke, debris, sparks or
  the HUD.
- Rebalancing speeds, AI distances (e.g. fighter extend at `130`, `:620`), spawn
  counts or timers.
- A user-facing setting for the scale.
- Bomb aiming aid (#4), carpet bombing (#5), infinite bombs / invulnerability (#3).
