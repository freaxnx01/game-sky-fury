# Controls: Shift+←/→ thrust & brake, opposite-arrow flip — Design

Issue: #15 · Base: `main` @ `b5a8056` · Date: 2026-10-01 · Mode: quick enrichment (no questions; assumptions recorded)

## Problem

Playtest feedback on v0.2.1: the flip is awkward. It needs its own key (`F`) and only works at speed ≥ 135 (`sky-fury.js:368`), so it is out of reach in the slow, tight moments where a reversal is most wanted. The tester also asked for **Shift + ← / →** to accelerate.

## Owner decisions (binding, issue comment 2026-10-01)

1. **Shift+← / Shift+→** take over acceleration (thrust / brake).
2. The **plain opposite arrow** (← while facing right, → while facing left) triggers the flip.
3. **`F` stays** as an alternative flip key.
4. The flip speed threshold (135) **comes down**.

## Current behaviour (main @ b5a8056)

| Where | What |
|---|---|
| `sky-fury.js:131` | `STALL = 112`, `MAXS = 560`, `FLIP_DUR = 0.5` |
| `sky-fury.js:339-342` | `onKey` records every key in `this.keys[e.code]` (incl. `ShiftLeft`/`ShiftRight`) |
| `sky-fury.js:357` | `F` → `tryFlip()` directly from the handler |
| `sky-fury.js:359` | `Shift+B` → one-shot `wantCarpet` flag (edge: `!e.repeat`, only in `'fly'`) |
| `sky-fury.js:366-373` | `tryFlip()`: needs `p.state === 'fly'`, no flip in progress, `p.s >= 135`; flips toward `-fwd` (always a half-loop *upwards*) |
| `sky-fury.js:383` | `wantCarpet` consumed in the sim (`updateCarpet`) |
| `sky-fury.js:194`, `:282` | one-shot flags cleared on window blur and in `beginGame` |
| `sky-fury.js:482` | `ArrowUp` lifts off during `'takeoff'` (arrows ←/→ unused on deck/takeoff/roll) |
| `sky-fury.js:505-506` | same-direction arrow = thrust, opposite arrow = brake (`230`/s) |
| `sky-fury.js:509-513` | during a flip, speed is floored at **90** (`:512`, `Math.max(p.s - 26*dt, 90)`) and the stall pull (`:527`) is suspended |
| `sky-fury.js:2173-2185` | menu controls card, `cardH = 300`, 9 rows (`← →` thrust/brake row, `F` flip row) |
| `README.md:38`, `:43` | Controls: `← →` throttle, `F` flip |

## Design

### Input mapping (flying)

| Input | Effect |
|---|---|
| Plain arrow **in** facing direction (held) | thrust (unchanged) |
| **Shift** + arrow in facing direction (held) | thrust (same as above) |
| **Shift** + arrow **opposite** facing (held) | brake (was: plain opposite arrow) |
| Plain arrow **opposite** facing (**tap**, keydown edge) | flip (half-loop reversal) |
| `F` (keydown) | flip (unchanged code path) |

Holding the opposite arrow no longer brakes. A nice side-effect: tap-and-hold ← while facing right flips, and once the plane faces left the still-held ← is now "in facing direction" and thrusts — "turn around and go".

### Flip trigger as a one-shot flag

Matches the `wantCarpet` / `wantTorp` pattern and the stack rule "input handlers write state, the simulation consumes it":

- `onKey`: on `ArrowLeft`/`ArrowRight` keydown with **no Shift**, **not** `e.repeat`, state `'playing'`, not paused, player in `'fly'` → `this.wantFlip = +1` (→) or `-1` (←). Only the direction is recorded; the handler does not read the plane's angle.
- `updatePlayer`: the flag is read **and cleared at the top of every sim step** (`const flipReq = this.wantFlip; this.wantFlip = 0;`), so it never survives into a later state (death, landing, relaunch). In the flying branch, after `fwd` is computed: `if (flipReq === -fwd) this.tryFlip();`. A same-direction tap is consumed and ignored.
- `tryFlip()` keeps all its guards (`'fly'`, no flip in progress, speed). Deck/takeoff/roll can never flip — the handler guard and `tryFlip` both require `'fly'`, so `ArrowUp` takeoff (`:482`) is unaffected.
- `wantFlip` is reset with the other flags on blur (`:194`) and in `beginGame` (`:282`).
- Edge-only (`!e.repeat`) means holding the arrow cannot chain flips; a new flip needs a new tap after the current one finishes (`flipT > 0` guard).

### Brake requires Shift

`br = 1` only when Shift (`k.ShiftLeft || k.ShiftRight`) is held together with the opposite arrow. Shift state comes from `this.keys`, which `onKey`/`_onKeyUp` already maintain for every `e.code`; blur clears it.

### Flip threshold: 135 → 100 (`FLIP_MIN_S`)

- **Below `STALL = 112`**: a slow, nose-dropping plane can still flip out of trouble — the "flip is awkward" complaint.
- **Above the flip's speed floor of 90** (`:512`): the floor can never *raise* the speed of a flip that was allowed to start, so a flip gives no free energy.
- **No unpowered chaining**: a fixed-step simulation of the flip (`dt = 1/120`, same equations as `:509-525`) gives an exit speed of **89.8** for any unpowered entry speed (100, 112, 135, 200) → below 100, so tapping again does nothing until the player gains speed. Powered (thrust held) flips exit at ≥ 121 and can be chained — that already happens today above 135 and costs fuel; it is a legitimate loop.
- During a flip the stall pull is suspended (`:527`); entering at 100–112 just means stall resumes after the 0.5 s flip if the player doesn't add power. Not exploitable given the no-chain property.
- Introduced as a named constant next to the other flight constants rather than another magic number.

### Menu card & README

Keep the card at 9 rows and `cardH = 300`:

- `['← →', 'Thrust & brake along your facing']` → `['SHIFT ← →', 'Thrust & brake along your facing']`
- `['F', 'Flip — half-loop to reverse for a strafing pass']` → `['← → / F', 'Flip — tap the arrow behind you (or F)']`

Key labels must fit the 92 px label column (`cx + 26` → `cx + 118`) at `fnt(15, 800)` — `SHIFT+B` and `B / R / X` already do; verify in the manual check.

README Controls lines 38 and 43 are updated to match.

## Out of scope

- Moving `F` to the flag pattern (it calls `tryFlip()` from the handler today; works, left untouched — surgical).
- Flip duration, flip speed floor, stall physics, thrust/brake magnitudes.
- i18n (arcade carve-out), `version.js`, `CHANGELOG.md` (release-time / git-cliff).

## Verification

Buildless: `node --check sky-fury.js`, grep counts (see plan), `git diff --name-only origin/main` → `README.md`, `sky-fury.js`; manual browser playtest is the human gate.
