# Scaling Leftovers — Design (issue #9)

**Date:** 2026-09-29
**Issue:** #9 — fix(render): finish hitbox/anchor scaling left over from #2
**Origin:** review of PR #8 (#2, object scaling: `PLANE_SCALE = 2` for aircraft in flight,
`OBJ_SCALE = 1.5` for ground targets and projectile sprites; `sky-fury.js:136-137`).
**Baseline:** `sky-fury.js` on `main` @ `01dc944` (after #4 bomb aiming aid, #5 carpet bombing, #3 sandbox).

## Goal

Finish the consistency work PR #8 left open, so that the gameplay geometry of enlarged sprites
follows the sprites everywhere #2 intended it to, and remove the one stray whitespace change:

1. **Fighter splash footprint** — `blast()` kills fighters only within the bare radius `r`
   (`sky-fury.js:1150`), although fighters are drawn 2× and the ground-target branch of the same
   function already pads by `18 * OBJ_SCALE` (`sky-fury.js:1137-1138`).
2. **Ground-target vertical anchors** — death explosion / debris spawn at `t.y - 8`
   (`sky-fury.js:1123-1124`) and the blast distance is measured from `t.y - 10`
   (`sky-fury.js:1136`), both unscaled, so explosions read low on the 1.5× taller sprites.
3. **Ground-target hitbox lower bound** — `t.y + 6` is unscaled while top and half-width are
   scaled. It appears in two hit tests: player bullets (`sky-fury.js:906`) and player rockets
   (`sky-fury.js:1017`).
4. **Flip-vapor indent** — `sky-fury.js:509` is indented 8 spaces; its siblings in the flip branch
   (`sky-fury.js:506-508`) use 6.

## Approach

Pure constant-scaling edits in `sky-fury.js`, following the pattern #2 already established
(`<base literal> * <SCALE>`):

| # | Location | Before | After |
|---|---|---|---|
| 1 | `blast()` fighter branch, `:1150` | `< r` | `< r + 10 * PLANE_SCALE` |
| 2 | `destroyTarget()`, `:1123-1124` | `t.y - 8` | `t.y - 8 * OBJ_SCALE` |
| 2 | `blast()` ground branch, `:1136` | `t.y - 10 - y` | `t.y - 10 * OBJ_SCALE - y` |
| 3 | bullet vs ground target, `:906` | `b.y < t.y + 6` | `b.y < t.y + 6 * OBJ_SCALE` |
| 3 | rocket vs ground target, `:1017` | `r.y < t.y + 6` | `r.y < t.y + 6 * OBJ_SCALE` |
| 4 | flip vapor, `:509` | 8-space indent | 6-space indent |

**Fighter padding value (`10 * PLANE_SCALE` = +20 world units):** the pre-#2 blast had no fighter
padding at all. #2 grew the fighter's direct-hit box from 20 to `20 * PLANE_SCALE` = 40
(`sky-fury.js:915`), i.e. by +20. Padding the splash radius by the same +20 makes the splash
footprint grow exactly as much as the direct-hit box did, written in the house `N * PLANE_SCALE`
form the issue asks for. `20 * PLANE_SCALE` (+40) was rejected: it would add a whole enlarged
fighter's radius on top of a blast that previously had none — a larger balance swing than the
sprite growth justifies.

**Bomb aiming aid (#4) consistency:** `predictBombImpact()` / `bombHitsShip()`
(`sky-fury.js:867-883`) stop the predicted bomb only on ships and terrain/sea — they do **not**
replicate any ground-target hit test or the `blast()` geometry. Live bombs likewise detonate only on
ships/terrain (`sky-fury.js:961-1000`) and reach ground targets through `blast()`. None of the edits
above changes the predicted impact point, so no change to the prediction is needed.

## Acceptance Criteria

- `blast()` fighter branch uses `r + 10 * PLANE_SCALE`.
- `destroyTarget()` spawns explosion and debris at `t.y - 8 * OBJ_SCALE`.
- `blast()` ground branch measures distance from `t.y - 10 * OBJ_SCALE`.
- Both ground-target hit tests (bullets, rockets) use lower bound `t.y + 6 * OBJ_SCALE`.
- Flip-vapor line in `updatePlayer` is indented 6 spaces, identical otherwise.
- Player damage hitboxes unchanged: mid-air ram `< 26`, enemy bullet `< 16`, flak `< 56`.
- `predictBombImpact()` / `bombHitsShip()` untouched.
- `node --check sky-fury.js` passes; only `sky-fury.js` differs from `origin/main`.
- Manual playtest: ground-target death explosions sit visibly on the sprite body, bullets/rockets
  still register on ground targets, a bomb/rocket burst next to a fighter's wing kills it, console clean.

## Out of Scope

- Player damage hitboxes (mid-air ram 26, enemy bullet 16, flak 56) — owner decision A4 in #2.
- World-vertical release offsets for bomb/torpedo/rocket — owner decision in the PR #8 review.
- Fuel-depot secondary explosions `t.y - rand(0, 20)` (`sky-fury.js:1129`) — not named in #9.
- Bomber splash damage (bombers are not in `blast()` at all today).
- `version.js`, `CHANGELOG.md` (git-cliff at release), README.
