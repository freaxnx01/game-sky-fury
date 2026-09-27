# Bomb Aiming Aid — Design

Issue: #4 "Zielhilfe für Bomben" · Date: 2026-09-27 · Mode: quick (no clarifying round; decisions recorded as assumptions in the issue body)

## Goal

Show the player where a bomb dropped *right now* would land, so bombing ground targets and ships becomes a skill of positioning rather than guesswork.

## Current behaviour (evidence)

- Drop: `B` key, player must be in `fly` state; bomb spawns at `(p.x, p.y + 10)` with the plane's velocity plus `+30` downward — `sky-fury.js:506-510`.
- Physics per frame: `vy += GRAV*dt` (`GRAV = 340`, `sky-fury.js:131`), horizontal drag `vx *= (1 - 0.25*dt)`, Euler position step — `sky-fury.js:884-888`.
- Impact: player bombs explode on an alive ship when `|b.x - s.x| < s.w/2 && b.y > -40` (`sky-fury.js:903-913`), otherwise when `b.y >= gy`, where `gy = overIsland(x) ? groundAt(x) : 0` (`sky-fury.js:890`, `919`; terrain `sky-fury.js:223-227`). The carrier only stops hostile bombs (`sky-fury.js:892`).
- Loop: variable `dt` clamped to `1/30` (`sky-fury.js:351-360`) — *not* a fixed-timestep accumulator.
- Render: `draw()` builds world→screen mappers `this.sx/this.sy` and draws layers in order (`sky-fury.js:1199-1227`); bombs are drawn in `drawProjectiles` (`sky-fury.js:1723-1734`).

## Approach

1. **Single source of bomb physics.** Extract two module-level pure helpers and use them in both the real simulation and the prediction, so the aid can never drift from the real physics (this also covers #2 changing the spawn offset):
   - `bombLaunch(p)` → `{ x, y, vx, vy }` of a freshly released bomb.
   - `stepBomb(b, dt)` → one Euler step (gravity + drag + position).
2. **Prediction in update, not render.** `Game.predictBombImpact()` simulates a virtual bomb from `bombLaunch(this.player)` with a fixed step of `1/60 s` (cap 8 s) until it hits an alive ship or the ground/sea, using the same impact tests as `updateProjectiles`. It returns `{ path: [{x,y},…], x, y }`. `update()` stores the result in `this.bombAim` each tick (or `null` when not aimable). Render only reads it — keeps the state/render separation.
3. **Aimable when:** player `state === 'fly'` and `bombs > 0`. Otherwise `bombAim = null` → nothing drawn.
4. **Visual:** a faint dashed trajectory arc (white, ~35 % alpha) from the plane to the impact point plus a small amber crosshair reticle at the impact point. Drawn in a new `drawBombAim(ctx)` layer between `drawCarrier` and `drawProjectiles`, so real bombs and the plane draw on top of it.
5. **Always on**, no toggle key (issue asks for an aid, not an option; key space is already crowded — see `todo.md` "keys side by side").

## Acceptance criteria

- While flying with at least one bomb, a dashed arc and crosshair show the predicted impact point on terrain, sea, or an alive ship.
- A bomb dropped at 60 fps lands within ~15 world px of where the crosshair was at release (manual check, several altitudes/speeds, both directions, over island and sea).
- No aid on deck, during takeoff/roll, when dead, or with 0 bombs; it reappears after rearming.
- Existing bomb behaviour (drop cadence, trajectory, blast) is unchanged.
- Empty console; no noticeable frame-rate drop.

## Out of scope

- Toggle key / settings option for the aid.
- Target lock-on highlighting (e.g. reticle turns red over a target in blast radius) — possible follow-up.
- Aiming aids for rockets or torpedoes.
- Accounting for the frame-rate dependence of the existing Euler integration (prediction uses a 1/60 s step; at low fps the real bomb may land a few px off).
- i18n: no new text is introduced.
