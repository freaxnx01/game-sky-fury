# Shift+←/→ Thrust & Brake, Opposite-Arrow Flip Implementation Plan

> **For agentic workers:** execute task-by-task; each task ends with a manual browser check and a commit.

**Goal:** Brake moves to Shift + the arrow behind you, a plain tap of the arrow behind you flips the plane (F still works), and the flip works from speed 100 instead of 135 (#15).

**Architecture:** Add an edge-triggered one-shot `wantFlip` input flag (same pattern as `wantCarpet`/`wantTorp`) that stores only the tapped direction (`+1` →, `-1` ←). `updatePlayer` reads and clears it at the top of every sim step and, in the flying branch, calls the existing `tryFlip()` when the tapped direction is opposite to `fwd`. Brake requires Shift, read from the existing `this.keys` map. The flip threshold `135` becomes a named constant `FLIP_MIN_S = 100`. Menu card rows and README Controls are reworded in place (same row count, `cardH` unchanged).

**Global Constraints:**
- **Pipeline verification commands** (run BEFORE and AFTER, paste the output into the PR; before→after values verified on `main` @ `b5a8056` and on a scratch copy with this plan applied):
  ```bash
  node --check sky-fury.js                                  # no output, exit 0 — before and after
  grep -cF 'wantFlip' sky-fury.js                           # before: 0 — after: 4
  grep -cF 'FLIP_MIN_S' sky-fury.js                         # before: 0 — after: 2
  grep -cF 'p.s < 135' sky-fury.js                          # before: 1 — after: 0
  grep -cF 'ShiftLeft || k.ShiftRight' sky-fury.js          # before: 0 — after: 1
  grep -cF 'SHIFT ← →' sky-fury.js                          # before: 0 — after: 1
  grep -cF 'tap the arrow behind you' sky-fury.js           # before: 0 — after: 1
  grep -cF 'Shift+← / →' README.md                          # before: 0 — after: 1
  grep -cF '**F** — flip' README.md                         # before: 1 — after: 0
  git diff --name-only origin/main                          # after: README.md, sky-fury.js (plus docs/ai-notes/** if the spec/plan ride along)
  ```
  The manual playtest remains the human gate. Don't claim it was run; list it in the PR as outstanding.
- Buildless vanilla JS, single file `sky-fury.js`; `const`/`let` only; no new files, packages or globals.
- Input handlers only set flags; flip/brake decisions happen in `updatePlayer` (fixed step `SIM_DT = 1/120`, `sky-fury.js:138`).
- `F` keeps its current code path (`sky-fury.js:357`) — do not rewrite it.
- Do not change flip duration, the flip speed floor (90, `:512`), stall physics, thrust/brake magnitudes, or other weapons.
- Keep the menu card at 9 rows and `cardH = 300`.
- Line numbers refer to `sky-fury.js` / `README.md` at `main` @ `b5a8056`; re-locate by the quoted code if they have shifted.
- Test gate is a manual playtest: `python3 -m http.server 8000` in the repo root, open `http://localhost:8000/`, DevTools console open.

---

### Task 1: Flip threshold constant + opposite-arrow flip flag

**Files:**
- Modify: `sky-fury.js:131` (flight constants)
- Modify: `sky-fury.js:194` (`_onBlur`)
- Modify: `sky-fury.js:282` (`beginGame`)
- Modify: `sky-fury.js:359` (`onKey`, after the `KeyB` line)
- Modify: `sky-fury.js:368` (`tryFlip`)
- Modify: `sky-fury.js:446` (`updatePlayer` head)
- Modify: `sky-fury.js:503-504` (flying branch, after `fwd`)

- [ ] **Step 1: Add the threshold constant** after line 131.

Before:
```js
const GRAV = 340, THRUST = 275, STALL = 112, MAXS = 560, TURN = 2.35, FLIP_DUR = 0.5;
const FUEL_MAX = 420;
```
After:
```js
const GRAV = 340, THRUST = 275, STALL = 112, MAXS = 560, TURN = 2.35, FLIP_DUR = 0.5;
const FLIP_MIN_S = 100; // min flip speed: below STALL so a slow plane can still flip, above the flip's 90 speed floor so unpowered flips can't chain
const FUEL_MAX = 420;
```

- [ ] **Step 2: Use it in `tryFlip`** (line 368).

Before:
```js
    if (p.state !== 'fly' || p.flipT > 0 || p.s < 135) return;
```
After:
```js
    if (p.state !== 'fly' || p.flipT > 0 || p.s < FLIP_MIN_S) return;
```

- [ ] **Step 3: Clear the flag on blur** (line 194).

Before:
```js
    this._onBlur = () => { this.keys = {}; this.wantTorp = false; this.wantCarpet = false; this.last = 0; this.accumulator = 0; if (this.state === 'playing') this.paused = true; };
```
After:
```js
    this._onBlur = () => { this.keys = {}; this.wantTorp = false; this.wantCarpet = false; this.wantFlip = 0; this.last = 0; this.accumulator = 0; if (this.state === 'playing') this.paused = true; };
```

- [ ] **Step 4: Clear the flag in `beginGame`** (line 282).

Before:
```js
    this.keys = {}; this.wantTorp = false; this.wantCarpet = false;
```
After:
```js
    this.keys = {}; this.wantTorp = false; this.wantCarpet = false; this.wantFlip = 0;
```

- [ ] **Step 5: Set the flag in `onKey`** — new line after line 359 (the `KeyB` line). Plain arrow only (`!e.shiftKey`), keydown edge only (`!e.repeat`), only while flying. Records the direction, not the facing.

Before:
```js
    if (c === 'KeyB' && e.shiftKey && !e.repeat && this.state === 'playing' && !this.paused && this.player.state === 'fly') this.wantCarpet = true;
  }
```
After:
```js
    if (c === 'KeyB' && e.shiftKey && !e.repeat && this.state === 'playing' && !this.paused && this.player.state === 'fly') this.wantCarpet = true;
    if ((c === 'ArrowLeft' || c === 'ArrowRight') && !e.shiftKey && !e.repeat && this.state === 'playing' && !this.paused && this.player.state === 'fly') this.wantFlip = c === 'ArrowRight' ? 1 : -1;
  }
```

- [ ] **Step 6: Consume the flag every sim step** (line 446, `updatePlayer` head) — read-and-clear before any state branch so a stale tap never fires after death/landing/relaunch.

Before:
```js
    const p = this.player, k = this.keys;
    p.propT += dt * (8 + p.s * 0.05);
```
After:
```js
    const p = this.player, k = this.keys;
    const flipReq = this.wantFlip; this.wantFlip = 0;
    p.propT += dt * (8 + p.s * 0.05);
```

- [ ] **Step 7: Flip when the tapped arrow is behind the plane** (flying branch, after `const fwd` at line 503). Task 2 adds the `shift` line right after `fwd`; in this task insert only the flip call.

Before:
```js
    const fwd = Math.cos(p.a) >= 0 ? 1 : -1;
    let th = 0, br = 0;
```
After:
```js
    const fwd = Math.cos(p.a) >= 0 ? 1 : -1;
    if (flipReq === -fwd) this.tryFlip();
    let th = 0, br = 0;
```

- [ ] **Step 8: Verify** — `node --check sky-fury.js` (no output); `grep -cF 'wantFlip' sky-fury.js` → 4; `grep -cF 'FLIP_MIN_S' sky-fury.js` → 2; `grep -cF 'p.s < 135' sky-fury.js` → 0.

- [ ] **Step 9: Manual browser check**
  - Console empty on load.
  - Facing right in flight, tap ← once → half-loop, plane ends facing left. Facing left, tap → → flips back.
  - Tap the arrow you're already facing → no flip.
  - Hold ← (no Shift) → exactly one flip, no chained flips while held (auto-repeat ignored).
  - `F` still flips.
  - Slow down to ~100–110 (stall warning territory) → tap the rear arrow → flips. After an unpowered flip (exit ≈ 90) an immediate second tap does nothing.
  - On the deck / during takeoff roll, tapping → or ← does nothing; `↑` takeoff still works.
  - Pause (P), tap ← → no flip on resume.

- [ ] **Step 10: Commit**
```bash
git add sky-fury.js
git commit -m "feat(controls): flip by tapping the opposite arrow, from speed 100 (#15)"
```

---

### Task 2: Brake needs Shift

**Files:**
- Modify: `sky-fury.js:503-507` (flying branch thrust/brake; +1 line after Task 1)

- [ ] **Step 1: Gate the brake on Shift.** Shift state is in `this.keys` (`ShiftLeft`/`ShiftRight`), maintained by `onKey`/`_onKeyUp` and cleared on blur. Same-direction arrow keeps thrusting with or without Shift.

Before (after Task 1):
```js
    const fwd = Math.cos(p.a) >= 0 ? 1 : -1;
    if (flipReq === -fwd) this.tryFlip();
    let th = 0, br = 0;
    if ((k.ArrowRight && fwd > 0) || (k.ArrowLeft && fwd < 0)) th = 1;
    if ((k.ArrowRight && fwd < 0) || (k.ArrowLeft && fwd > 0)) br = 1;
```
After:
```js
    const fwd = Math.cos(p.a) >= 0 ? 1 : -1;
    const shift = k.ShiftLeft || k.ShiftRight;
    if (flipReq === -fwd) this.tryFlip();
    let th = 0, br = 0;
    if ((k.ArrowRight && fwd > 0) || (k.ArrowLeft && fwd < 0)) th = 1;
    if (shift && ((k.ArrowRight && fwd < 0) || (k.ArrowLeft && fwd > 0))) br = 1;
```

- [ ] **Step 2: Verify** — `node --check sky-fury.js`; `grep -cF 'ShiftLeft || k.ShiftRight' sky-fury.js` → 1.

- [ ] **Step 3: Manual browser check**
  - Facing right: hold `Shift+→` → accelerates (same as plain →). Hold `Shift+←` → decelerates, no flip.
  - Holding plain ← after a flip (now facing left) → thrusts.
  - Release Shift while still holding ← → braking stops, no flip triggered.
  - `Shift+B` carpet bombing still works while Shift+arrow is held.

- [ ] **Step 4: Commit**
```bash
git add sky-fury.js
git commit -m "feat(controls): brake with Shift + the arrow behind you (#15)"
```

---

### Task 3: Menu card and README Controls

**Files:**
- Modify: `sky-fury.js:2177` and `:2179` (controls card rows; shifted +5 lines after Tasks 1–2 → `:2182`, `:2184`)
- Modify: `README.md:38`, `README.md:43`

- [ ] **Step 1: Reword the two card rows** (row count stays 9, `cardH = 300` unchanged).

Before:
```js
      ['← →', 'Thrust & brake along your facing'],
      ['↑ ↓', 'Climb / dive'],
      ['F', 'Flip — half-loop to reverse for a strafing pass'],
```
After:
```js
      ['SHIFT ← →', 'Thrust & brake along your facing'],
      ['↑ ↓', 'Climb / dive'],
      ['← → / F', 'Flip — tap the arrow behind you (or F)'],
```

- [ ] **Step 2: README Controls** (lines 38 and 43).

Before:
```markdown
- **↑ ↓** — pitch; **← →** — throttle
```
After:
```markdown
- **↑ ↓** — pitch; **Shift+← / →** — thrust / brake along your facing (plain arrow in your facing also thrusts)
```

Before:
```markdown
- **F** — flip (half-loop) to reverse direction
```
After:
```markdown
- **Tap the arrow behind you** (or **F**) — flip (half-loop) to reverse direction; needs speed ≥ 100
```

- [ ] **Step 3: Verify** — `node --check sky-fury.js`; `grep -cF 'SHIFT ← →' sky-fury.js` → 1; `grep -cF 'tap the arrow behind you' sky-fury.js` → 1; `grep -cF 'Shift+← / →' README.md` → 1; `grep -cF '**F** — flip' README.md` → 0; `git diff --name-only origin/main` → `README.md`, `sky-fury.js`.

- [ ] **Step 4: Manual browser check**
  - Menu: `SHIFT ← →` and `← → / F` labels fit the label column (don't overlap the description starting at `cx + 118`) at desktop width and at a narrow (~400 px) window.
  - Card still 9 rows; "PRESS ENTER TO TAKE OFF" below the card is not overlapped.
  - README renders the two updated bullets.

- [ ] **Step 5: Commit**
```bash
git add sky-fury.js README.md
git commit -m "feat(controls): document Shift thrust/brake and arrow flip (#15)"
```
