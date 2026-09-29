# Fixed-Timestep Game Loop Implementation Plan

> **For agentic workers:** execute task-by-task; each task ends with a manual in-browser check and a commit.
> This is a buildless browser game — there is no test runner. Verification = the pipeline commands below
> plus a manual playtest (`python3 -m http.server 8000` in the repo root, open `http://localhost:8000/`,
> DevTools console open).

**Goal:** Replace the variable-`dt` loop with a fixed-timestep accumulator loop (`SIM_DT = 1/60`), reset the
loop clock on blur/tab-hide, and make the bomb aiming aid use the same step (issue #6).

**Architecture:** Two module constants (`SIM_DT`, `MAX_FRAME_DT`) next to the physics constants in
`sky-fury.js`. `Game.frame()` feeds clamped wall-clock time into `this.accumulator` and runs
`this.update(SIM_DT)` while a full step is available, then draws once. `_onBlur` also zeroes the clock.
`predictBombImpact()` steps with `SIM_DT`. `update()` itself and all `update*` functions are unchanged.

**Global Constraints:**
- **Pipeline verification commands** (run BEFORE and AFTER, paste the output into the PR):
  ```bash
  node --check sky-fury.js                        # before: exit 0, no output — after: exit 0, no output
  grep -c 'SIM_DT' sky-fury.js                    # before: 0 — after: 6
  grep -c 'accumulator' sky-fury.js               # before: 0 — after: 5
  grep -c 'MAX_FRAME_DT' sky-fury.js              # before: 0 — after: 2
  grep -c 'clamp(dt, 0, 1 / 30)' sky-fury.js      # before: 1 — after: 0
  grep -c 'AIM_DT' sky-fury.js                    # before: 2 — after: 0
  grep -c 'this.last = 0' sky-fury.js             # before: 1 — after: 2
  git diff --name-only origin/main                # after: sky-fury.js (only)
  ```
  Before-values verified on `main` @ `01dc944`. `grep -c` counts lines; "after" values assume the code
  below is pasted exactly (the `while` and `-=` lines contain both `SIM_DT` and `accumulator`). Note:
  `grep -c` exits 1 when the count is 0 — that is expected, not a failure. The manual playtest remains the
  human gate; don't claim it was run, list it in the PR as outstanding.
- Only `sky-fury.js` changes. No new files, no dependencies, no build step.
- `const`/`let` only; `draw()` only reads state; no render interpolation.
- Do not touch `update()` or any `update*` function; they already take `dt`.
- Line numbers refer to `sky-fury.js` at `01dc944`; re-locate by the quoted code if they shifted.
  (The issue body cites `:351-360` for the loop — that is stale; it is `:403-412`.)
- Do not bump `version.js` or edit `CHANGELOG.md` (git-cliff generates it at release).

---

### Task 1: Fixed-timestep accumulator loop

**Files:**
- Modify: `sky-fury.js:136-137` (constants block, after `OBJ_SCALE`)
- Modify: `sky-fury.js:159` (constructor clock fields)
- Modify: `sky-fury.js:403-412` (`frame(now)`)

- [ ] **Step 1: Add the loop constants.** After line 137
  (`const OBJ_SCALE = 1.5;   // ground targets (incl. parked planes) and projectile sprites`) add:

```js
const SIM_DT = 1 / 60;      // fixed simulation step (s); also used by the bomb aiming aid
const MAX_FRAME_DT = 0.1;   // max wall-clock time fed into one frame (caps at 6 steps)
```

- [ ] **Step 2: Initialise the accumulator.** Line 159, before:

```js
    this.t = 0; this.last = 0;
```

after:

```js
    this.t = 0; this.last = 0; this.accumulator = 0;
```

- [ ] **Step 3: Replace the frame body.** Lines 403-412, before:

```js
  frame(now) {
    this._raf = requestAnimationFrame(this._frame);
    if (!this.last) this.last = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = clamp(dt, 0, 1 / 30);
    this.t += dt;
    this.update(dt);
    this.draw();
  }
```

after:

```js
  frame(now) {
    this._raf = requestAnimationFrame(this._frame);
    if (!this.last) this.last = now;
    this.accumulator += clamp((now - this.last) / 1000, 0, MAX_FRAME_DT);
    this.last = now;
    while (this.accumulator >= SIM_DT) {
      this.t += SIM_DT;
      this.update(SIM_DT);
      this.accumulator -= SIM_DT;
    }
    this.draw();
  }
```

- [ ] **Step 4: Syntax check.** `node --check sky-fury.js` → exit 0, no output.

- [ ] **Step 5: Manual browser check.** `python3 -m http.server 8000`, open `http://localhost:8000/`.
  - Console empty; menu renders; start a game, fly, shoot, bomb, land on the carrier — feels as before.
  - Step rate probe — paste in the console, expect **~60** printed:
    ```js
    (() => { const g = document.querySelector('sky-fury')._game, u = g.update.bind(g); let n = 0;
      g.update = dt => { n++; u(dt); }; setTimeout(() => { g.update = u; console.log('steps/s', n / 5); }, 5000); })();
    ```
  - Repeat the probe with DevTools → Performance → CPU **6x slowdown**: still ~60, game speed real-time.
  - On a **120/144 Hz** display (or Chrome with `--disable-gpu-vsync --disable-frame-rate-limit`): still ~60;
    the plane moves at the same speed as on 60 Hz.
  - Torpedo (`X`) and carpet (`Shift+B`): one press → exactly one torpedo / one carpet run.

- [ ] **Step 6: Commit.**

```bash
git add sky-fury.js
git commit -m "refactor(loop): run simulation in fixed 1/60 s steps with accumulator (#6)"
```

---

### Task 2: Reset the loop clock on blur / tab hide

**Files:**
- Modify: `sky-fury.js:192` (`_onBlur`, shared by `window` `blur` and `document` `visibilitychange`)

- [ ] **Step 1: Zero the clock in `_onBlur`.** Before:

```js
    this._onBlur = () => { this.keys = {}; this.wantTorp = false; this.wantCarpet = false; if (this.state === 'playing') this.paused = true; };
```

after:

```js
    this._onBlur = () => { this.keys = {}; this.wantTorp = false; this.wantCarpet = false; this.last = 0; this.accumulator = 0; if (this.state === 'playing') this.paused = true; };
```

- [ ] **Step 2: Syntax check.** `node --check sky-fury.js` → exit 0.

- [ ] **Step 3: Manual browser check.**
  - Mid-game, switch to another tab for ~10 s, come back: game shows `PAUSED`; press `P`/`Enter` —
    no jump, no burst of explosions/bullets, the plane continues from where it was.
  - On the **menu**, switch tabs for ~10 s and return: clouds/waves continue smoothly, no skip.
  - Click into the DevTools pane (window blur) mid-game: game pauses, resumes cleanly.

- [ ] **Step 4: Commit.**

```bash
git add sky-fury.js
git commit -m "fix(loop): reset loop clock on blur and tab hide (#6)"
```

---

### Task 3: Bomb aiming aid uses the simulation step

**Files:**
- Modify: `sky-fury.js:868` and `:872` (`predictBombImpact()`)

- [ ] **Step 1: Drop `AIM_DT`.** Line 868, before:

```js
    const AIM_DT = 1 / 60, AIM_MAX_STEPS = 480, PATH_EVERY = 3;
```

after:

```js
    const AIM_MAX_STEPS = 480, PATH_EVERY = 3;
```

Line 872, before:

```js
      stepBomb(b, AIM_DT);
```

after:

```js
      stepBomb(b, SIM_DT);
```

- [ ] **Step 2: Run the pipeline verification commands** (Global Constraints) and compare to the
  expected after-values (`SIM_DT` 6, `accumulator` 5, `MAX_FRAME_DT` 2, old clamp 0, `AIM_DT` 0,
  `this.last = 0` 2, diff = `sky-fury.js` only).

- [ ] **Step 3: Manual browser check.**
  - Fly level and at a dive over the island, drop single bombs (`B`): the bomb lands on the aim marker.
  - Repeat with CPU 6x slowdown and (if available) on a 120/144 Hz display: still lands on the marker.
  - Bomb a ship: the marker stops on the ship and the bomb hits it.

- [ ] **Step 4: Commit.**

```bash
git add sky-fury.js
git commit -m "refactor(aim): step bomb prediction with shared SIM_DT (#6)"
```
