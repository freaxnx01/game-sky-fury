# Sandbox mode (unlimited bombs + invulnerable) — Design

Issue: #3 "Modus: unendlich viele Bomben und unverwundbar"
Date: 2026-09-27
Status: enriched (quick mode — decisions made without user Q&A, see Assumptions in the issue)

## Goal

Offer an optional **Sandbox** mode in which the player has **unlimited bombs** and is
**invulnerable**, so the game can be played relaxed (e.g. by kids or for trying things out)
without running out of bombs or planes.

## Current behaviour (evidence)

- Bombs are a per-sortie ammo pool: `AMMO = { bombs: 5, … }` (`sky-fury.js:133`), copied into the
  plane in `newPlane()` (`sky-fury.js:257`), decremented on drop (`sky-fury.js:506-508`) and refilled
  when rearming on deck (`sky-fury.js:410`).
- All player damage goes through `damagePlayer(dmg, why)` (`sky-fury.js:1024-1031`): gunfire
  (`:876`), fighter collision (`:654`), enemy bombs on deck (`:897`), flak (`:1017`), own blast (`:1079`).
- Plane loss goes through `crashPlane(where)` (`sky-fury.js:563-578`), which decrements `this.lives`;
  terrain/water/deck crashes call it directly (`:552`, `:557`, `:559`). `lives <= 0` → game over (`:396`).
- The carrier only takes damage from hostile bombs (`sky-fury.js:893`); hull 0 → game over "CARRIER LOST" (`:783-789`).
- Game states `menu | playing | over | win` (`sky-fury.js:143`); Enter starts a run from menu/over/win (`:329-331`).
- Only config today comes from element attributes (`readConfig`, `sky-fury.js:183-192`, incl. `inf-fuel`).
- `localStorage` keys: `sky-fury-muted` (`:27`, `:59`), `sky-fury-best` (`:148`, `:1111`).
- The UI is English-only; no i18n infrastructure exists (pure-arcade carve-out of the browser-game stack).

## Approach

1. **Toggle**: key **G** on the menu and end screens (never mid-run) toggles `this.sandbox`.
   The menu controls card shows a row `G — Sandbox: unlimited bombs, invulnerable  [ON|OFF]`.
2. **Persistence**: the choice is stored in `localStorage['sky-fury-sandbox']` (`'1'`/`'0'`),
   mirroring the existing mute persistence pattern; wrapped in try/catch.
3. **Effects while `this.sandbox` is true** (run-scoped — the value is fixed for the whole run because
   it can only change outside `playing`):
   - Dropping a bomb does not decrement `p.bombs` (cooldown `bombT` unchanged, so no bomb spam beyond today's rate).
   - `damagePlayer()` returns immediately — no HP loss, no hit flash, no shake, no crash from damage.
   - `crashPlane()` still destroys the plane on terrain/water/bad deck landing (physics stay honest),
     but **does not decrement `lives`**; banner reads "PLANE LOST — sandbox: no plane used".
   - Hostile bombs do **not** reduce carrier hull, so the run cannot end by "CARRIER LOST".
   - Rockets, torpedoes, fuel and gun heat are unchanged.
4. **Score**: points are still counted and shown, but **the best score is not saved** (`saveBest()` is a
   no-op in sandbox). The end screen shows `SANDBOX — SCORE NOT RECORDED` instead of `NEW BEST`.
5. **Indicator**: HUD shows an amber `SANDBOX` tag in the score panel, and the bomb counter reads `B ∞`.
6. **Language**: labels in English to match the existing all-English UI (German name for reference: „Sandkasten“).

## Acceptance criteria

- [ ] On the menu, pressing **G** toggles Sandbox ON/OFF; the controls card shows the current state.
- [ ] G does nothing during a running game (neither toggles nor affects controls).
- [ ] The Sandbox choice survives a page reload (`localStorage['sky-fury-sandbox']`).
- [ ] With Sandbox ON, holding B drops bombs indefinitely at the normal cadence; HUD shows `B ∞`.
- [ ] With Sandbox ON, gunfire, flak, fighter collisions, enemy bombs and own blasts cause no HP loss.
- [ ] With Sandbox ON, crashing into terrain/water/deck respawns the plane on deck without losing a plane.
- [ ] With Sandbox ON, enemy bombers cannot damage the carrier hull.
- [ ] With Sandbox ON, the HUD shows a `SANDBOX` tag; the best score is not updated and the end screen says `SANDBOX — SCORE NOT RECORDED`.
- [ ] With Sandbox OFF, gameplay, HUD and best-score behaviour are unchanged.
- [ ] Console is empty (no errors/warnings) in both modes.

## Out of scope

- Unlimited rockets/torpedoes, infinite fuel (already exists as the `inf-fuel` attribute), no gun overheat.
- A separate sandbox high-score table.
- A `sandbox` HTML attribute / URL parameter.
- Introducing a de/en i18n system for the (English-only) game UI.
- Touch/mobile toggle UI (the game is keyboard-only today).
