# Carpet Bombing (Bombenteppich) — Design

Issue: #5 · Date: 2026-09-27 · Mode: quick (decisions made without user Q&A, recorded as assumptions)

## Goal

Let the player lay a **Bombenteppich**: one input releases the plane's remaining bombs as a
rapid, evenly timed stream, so the bombs land in a line along the flight path and blanket a
cluster of island targets (or a ship) in a single pass.

## Current state (evidence)

- Bombs are a limited ammo type: `AMMO = { bombs: 5, ... }` (`sky-fury.js:133`), carried per
  plane (`newPlane`, `sky-fury.js:257-258`) and refilled only by landing/rearming on the
  carrier (`sky-fury.js:409-410`).
- Single bomb: held `KeyB` with a 0.32 s cooldown (`p.bombT`) pushes one player bomb that
  inherits the plane's velocity (`sky-fury.js:506-510`).
- Bomb physics and impacts (ground blast r=84, dmg 16; ship hit dmg 16; water splash) are in
  `updateProjectiles` (`sky-fury.js:883-927`) — reused unchanged.
- Edge-triggered weapons use a `want*` flag set in `onKey` with `!e.repeat` and consumed in
  `updatePlayer` (torpedo: `sky-fury.js:339`, `sky-fury.js:511-518`).
- Input is keyboard-only; there is **no touch/pointer control** anywhere in the game
  (`grep touch|pointer` → none).
- There is no pickup/power-up system.
- `todo.md:9` already flags that adjacent ammo keys cause mispresses.

## Approach

- **Trigger:** `Shift+B` (edge-triggered, ignores key repeat), only while playing and unpaused.
  A modifier on the existing bomb key is easy to remember and cannot be hit by accident
  (unlike a neighbouring letter such as `V`).
- **Salvo size:** all remaining bombs, capped at `CARPET.size = AMMO.bombs` (5). The cap
  keeps the salvo finite if another mode (issue #3 infinite bombs) makes `p.bombs` unbounded.
- **Pattern:** a timed stream — first bomb released immediately, then one every
  `CARPET.interval = 0.1 s`. Each bomb uses the exact single-bomb release (position,
  inherited velocity), so the spacing on the ground is `speed × 0.1 s` (~30–50 px at typical
  speed) — well inside the 84 px blast radius, giving an overlapping carpet.
- **Cost:** consumes the bombs it drops; no extra resource or charges. Normal `B` is blocked
  while a salvo is in progress; after the last bomb the regular 0.32 s bomb cooldown applies.
- **Cancellation:** the salvo only advances while flying. Bombs not yet released stay in the
  inventory; the pending salvo is cleared when the plane is on deck (rearm) or a new plane is
  spawned.
- **Feedback:** a `whoosh` when the salvo starts, the existing `click` per bomb; the HUD
  bomb counter (`sky-fury.js:1918-1919`) counts down visibly. The menu controls card and the
  README controls list gain a `Shift+B` entry.

## Acceptance criteria

- Pressing `Shift+B` in flight with N ≥ 1 bombs releases min(N, 5) bombs, one immediately and
  then one every 0.1 s, each following the normal bomb trajectory.
- The bombs land as a line along the flight path and each explodes with the normal bomb
  damage/blast; targets under the carpet are destroyed/damaged accordingly.
- The HUD bomb count drops by one per released bomb and ends at 0 after a full salvo.
- Holding `Shift+B` does not start a second salvo (key repeat ignored); plain `B` does nothing
  while a salvo is in progress.
- `Shift+B` with 0 bombs, while paused, on the menu, or on the deck does nothing (no stale
  salvo fires after takeoff).
- Landing / crashing mid-salvo stops the stream; after rearming the plane has a full 5 bombs
  and no pending salvo.
- Single `B` bombing, rockets, torpedo and guns behave exactly as before.
- The start-menu controls card and README list `Shift+B` carpet bombing; the card still fits
  and the "PRESS ENTER" prompt is not overlapped.
- Console is empty (no errors/warnings) during a full playtest.

## Out of scope

- Touch/mobile controls (the game has none; adding them is a separate feature).
- Pickups/power-ups, extra carpet-only ammo, or score multipliers for carpet kills.
- Horizontal/lateral spread (a 2D side-scroller has only one ground axis — a stream along the
  track *is* the carpet).
- Remapping the other ammo keys (`todo.md` UX item) and German/English i18n of the menu
  (pure-arcade carve-out; game text is English-only today).
- Changing the frame loop to a fixed-timestep accumulator.
