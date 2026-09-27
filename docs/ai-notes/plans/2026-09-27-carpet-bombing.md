# Carpet Bombing (Bombenteppich) Implementation Plan

> **For agentic workers:** execute task-by-task; each task ends with a manual browser check and a commit.

**Goal:** `Shift+B` releases the plane's remaining bombs (max 5) as a timed stream — one now, then one every 0.1 s — laying a Bombenteppich along the flight path.

**Architecture:** Reuse the existing player-bomb projectile and impact code unchanged. Add an edge-triggered `wantCarpet` input flag (same pattern as `wantTorp`), two per-plane fields (`carpetN` = bombs still to release, `carpetT` = time until next release), and four small `Game` methods (`dropPlayerBomb`, `updateCarpet`, `startCarpet`, `releaseCarpetBomb`) called from the flying branch of `updatePlayer`. Document the control in the menu card and README.

**Global Constraints:**
- **Rebased onto #2 + #4 (2026-09-28):** the single-bomb drop on `main` is now `this.bombs.push(Object.assign(bombLaunch(p), { hostile: false }));` (shared helper from #4, release point `p.y + 10 * PLANE_SCALE` from #2). `dropPlayerBomb()` must keep using `bombLaunch(p)` — never reintroduce the old inline literal.
- **Pipeline verification commands** (run BEFORE and AFTER, paste the output into the PR):
  ```bash
  node --check sky-fury.js      # syntax: no output, exit 0 before and after
  grep -c 'CARPET\|startCarpet\|dropPlayerBomb' sky-fury.js   # before: 0 — after: > 0
  git diff --name-only origin/main   # after: only sky-fury.js (+ README.md if the plan names it)
  ```
  The manual playtest remains the human gate. Don't claim it was run; list it in the PR as outstanding.
- Buildless vanilla JS, single file `sky-fury.js`; `const`/`let` only; no new files, packages or globals.
- Input handlers only set flags; simulation state changes happen in `updatePlayer`.
- Do not change bomb physics, damage, cooldown values or other weapons.
- Line numbers refer to `sky-fury.js` at commit `1000717`; re-locate by the quoted code if they have shifted (issues #2/#3/#4 touch the same file).
- Test gate is a manual playtest: `python3 -m http.server 8000` in the repo root, open `http://localhost:8000/`, DevTools console open.

---

### Task 1: Constants, plane state and input flag

**Files:**
- Modify: `sky-fury.js:133` (constants)
- Modify: `sky-fury.js:177` (`_onBlur`)
- Modify: `sky-fury.js:258` (`newPlane`)
- Modify: `sky-fury.js:264` (`beginGame`)
- Modify: `sky-fury.js:339` (`onKey`)

- [ ] **Step 1: Add the carpet constant** after `const AMMO = ...` (line 133):

```js
const AMMO = { bombs: 5, rockets: 6, torps: 2 };
const CARPET = { size: AMMO.bombs, interval: 0.1 };
```

- [ ] **Step 2: Add salvo state to `newPlane`** (line 258):

```js
      heat: 0, jammed: false, gunT: 0, bombT: 0, rktT: 0, carpetN: 0, carpetT: 0,
```

- [ ] **Step 3: Clear the flag wherever `wantTorp` is cleared.** Line 177:

```js
    this._onBlur = () => { this.keys = {}; this.wantTorp = false; this.wantCarpet = false; if (this.state === 'playing') this.paused = true; };
```

Line 264 (`beginGame`):

```js
    this.keys = {}; this.wantTorp = false; this.wantCarpet = false;
```

- [ ] **Step 4: Set the flag on `Shift+B`** — insert after the torpedo line in `onKey` (line 339):

```js
    if (c === 'KeyB' && e.shiftKey && !e.repeat && this.state === 'playing' && !this.paused) this.wantCarpet = true;
```

- [ ] **Step 5: Verify in browser.** Serve with `python3 -m http.server 8000`, open `http://localhost:8000/`, start a game, press `Shift+B` in flight. Expected: game runs, console empty, behaviour unchanged (a single bomb may drop because `B` is held — the flag has no consumer yet).

- [ ] **Step 6: Commit**

```bash
git add sky-fury.js
git commit -m "feat(weapons): add carpet-bombing input flag and plane state"
```

---

### Task 2: Salvo logic

**Files:**
- Modify: `sky-fury.js:403-413` (deck branch of `updatePlayer`)
- Modify: `sky-fury.js:506-510` (single-bomb block)
- Modify: `sky-fury.js:348` (insert new methods after `tryFlip`)

- [ ] **Step 1: Add the salvo methods** directly after `tryFlip()` (closing brace at line 348), before the `/* --- main loop --- */` comment:

```js
  dropPlayerBomb() {
    const p = this.player;
    p.bombs--;
    this.bombs.push(Object.assign(bombLaunch(p), { hostile: false }));
    this.audio.click();
  }
  updateCarpet(dt) {
    const p = this.player;
    if (this.wantCarpet) { this.wantCarpet = false; this.startCarpet(); }
    if (!p.carpetN) return;
    p.carpetT -= dt;
    if (p.carpetT > 0) return;
    this.releaseCarpetBomb();
  }
  startCarpet() {
    const p = this.player;
    if (p.carpetN || p.bombs <= 0) return;
    p.carpetN = Math.min(p.bombs, CARPET.size);
    p.carpetT = 0;
    this.audio.whoosh();
  }
  releaseCarpetBomb() {
    const p = this.player;
    this.dropPlayerBomb();
    p.carpetN = p.bombs > 0 ? p.carpetN - 1 : 0;
    p.carpetT = CARPET.interval;
    p.bombT = 0.32;
  }
```

- [ ] **Step 2: Replace the single-bomb block** (lines 506-510):

```js
    if (k.KeyB && p.bombT <= 0 && p.bombs > 0) {
      p.bombT = 0.32; p.bombs--;
      this.bombs.push(Object.assign(bombLaunch(p), { hostile: false }));
      this.audio.click();
    }
```

with:

```js
    this.updateCarpet(dt);
    if (k.KeyB && !p.carpetN && p.bombT <= 0 && p.bombs > 0) {
      p.bombT = 0.32;
      this.dropPlayerBomb();
    }
```

(`updateCarpet` runs first, so the `Shift+B` keydown frame starts the salvo and the held `B` cannot add an extra single bomb.)

- [ ] **Step 3: Drop any pending salvo on deck** — in the deck branch, right after `p.rearmT += dt;` (line 404):

```js
      p.rearmT += dt;
      p.carpetN = 0; this.wantCarpet = false;
```

- [ ] **Step 4: Verify in browser** (`http://localhost:8000/`, console open):
  - Take off, fly over the island at medium altitude, press `Shift+B`: 5 bombs leave in a quick stream (~0.5 s total), land in a line, each explodes; HUD `B` goes 5 → 0; `whoosh` at start, click per bomb.
  - Drop 3 single bombs with `B`, then `Shift+B`: exactly 2 bombs stream out.
  - Hold `Shift+B`: only one salvo. Tap `B` during a salvo: no extra bomb.
  - `Shift+B` with 0 bombs, while paused (`P`), or on deck: nothing happens; after takeoff no stale salvo fires.
  - Land to rearm: `B 5`; single `B`, `R`, `X`, `Space` unchanged.
  - Console shows no errors/warnings.

- [ ] **Step 5: Commit**

```bash
git add sky-fury.js
git commit -m "feat(weapons): add Shift+B carpet bombing salvo" -m "Closes #5"
```

---

### Task 3: Document the control

**Files:**
- Modify: `sky-fury.js:2050-2079` (`drawMenu` controls card)
- Modify: `README.md:40`

- [ ] **Step 1: Grow the controls card and add a row.** In `drawMenu`, change the card height at line 2050:

```js
    this.rr(ctx, cx, cy, cw, 270, 14); ctx.fill();
```

insert a row after the `'B / R / X'` row (line 2056):

```js
      ['B / R / X', 'Bombs · Rockets · Torpedo (limited)'],
      ['SHIFT+B', 'Carpet bombing — all bombs in one stream'],
```

and shift the two prompt lines (lines 2075 and 2079) from `cy + 240` to `cy + 270`:

```js
    ctx.fillText('PRESS ENTER TO TAKE OFF', W / 2, cy + 270 + 46);
```

```js
    ctx.fillText(bestStr + 'M mute · P pause', W / 2, cy + 270 + 74);
```

- [ ] **Step 2: README** — after line 40 (`- **B** / **R** / **T** — bombs, rockets, torpedo`) add:

```markdown
- **Shift+B** — carpet bombing: release all remaining bombs in one stream
```

- [ ] **Step 3: Verify in browser.** Reload `http://localhost:8000/`: the menu card shows 8 rows, the `SHIFT+B` row is inside the card, "PRESS ENTER TO TAKE OFF" and the "M mute · P pause" line sit below the card without overlap (check also a ~1280×720 window). Console empty.

- [ ] **Step 4: Commit**

```bash
git add sky-fury.js README.md
git commit -m "docs(controls): document Shift+B carpet bombing"
```
