# Scaling Leftovers Implementation Plan

> **For agentic workers:** execute task-by-task; each task ends with a manual in-browser check and a commit.
> This is a buildless browser game — there is no test runner. Verification = the pipeline commands below
> plus a manual playtest (`python3 -m http.server 8000` in the repo root, open `http://localhost:8000/`,
> DevTools console open).

**Goal:** Finish the hitbox/anchor scaling PR #8 left open (issue #9): pad the fighter splash radius by
`PLANE_SCALE`, scale the ground-target vertical anchors and hitbox lower bound by `OBJ_SCALE`, and revert the
stray flip-vapor re-indent.

**Architecture:** Seven single-line constant edits in `sky-fury.js`, all in the existing
`<base literal> * <SCALE>` form introduced by #2 (`PLANE_SCALE = 2`, `OBJ_SCALE = 1.5`, `sky-fury.js:136-137`).
No new functions, state or files. The #4 bomb aiming aid (`predictBombImpact()` / `bombHitsShip()`,
`sky-fury.js:867-883`) only tests ships and terrain, so none of these edits moves the predicted impact point.

**Global Constraints:**
- **Pipeline verification commands** (run BEFORE and AFTER, paste the output into the PR):
  ```bash
  node --check sky-fury.js                                          # before: no output, exit 0 — after: no output, exit 0
  grep -c 'OBJ_SCALE' sky-fury.js                                   # before: 8  — after: 12
  grep -c 'PLANE_SCALE' sky-fury.js                                 # before: 14 — after: 15
  grep -nE 't\.y (- 8|- 10|\+ 6)([,)]| -)' sky-fury.js              # before: 5 lines (906, 1017, 1123, 1124, 1136) — after: no output (exit 1)
  grep -cE '^ {8}if \(chance\(0\.7\)\) this\.fx\.vapor' sky-fury.js # before: 1 — after: 0
  grep -c '< r) { this.killFighter' sky-fury.js                     # before: 1 — after: 0
  git diff --name-only origin/main                                  # after: sky-fury.js only
  ```
  Values verified on `main` @ `01dc944` and on a scratch copy with all edits applied (`grep -c` exits 1 when
  it prints `0`; that is expected). The manual playtest remains the human gate — don't claim it was run;
  list it in the PR as outstanding if not done.
- Only `sky-fury.js` changes. No new files, no dependencies, no build step.
- **Do not change** the player's damage hitboxes: mid-air ram `< 26`, enemy bullet `< 16`, flak `< 56`
  (owner decision A4 in #2). Do not change release offsets (world-vertical, owner decision in PR #8 review).
- Do not touch `predictBombImpact()` / `bombHitsShip()`.
- Surgical edits: each changed line differs from `main` only in the quoted token; no reformatting elsewhere.
- Line numbers refer to `sky-fury.js` at `01dc944`; re-locate by the quoted code if they shifted.
- Do not bump `version.js` or edit `CHANGELOG.md` (git-cliff generates it at release).

---

### Task 1: Scale ground-target anchors and hitbox lower bound by OBJ_SCALE

Covers issue items 2 and 3.

**Files:**
- Modify: `sky-fury.js:906` (player bullets vs ground targets, in `updateProjectiles`)
- Modify: `sky-fury.js:1017` (player rockets vs ground targets, in `updateProjectiles`)
- Modify: `sky-fury.js:1123-1124` (`destroyTarget`)
- Modify: `sky-fury.js:1136` (`blast`, ground-target branch)

- [ ] **Step 1: Run the pipeline verification commands** and keep the BEFORE output for the PR.

- [ ] **Step 2: Bullet hitbox lower bound** (`sky-fury.js:906`).

Before:
```js
          if (Math.abs(b.x - t.x) < hw && b.y > t.y - hh && b.y < t.y + 6) {
```
After:
```js
          if (Math.abs(b.x - t.x) < hw && b.y > t.y - hh && b.y < t.y + 6 * OBJ_SCALE) {
```

- [ ] **Step 3: Rocket hitbox lower bound** (`sky-fury.js:1017`) — same box, kept consistent with Step 2.

Before:
```js
          if (t.alive && Math.abs(r.x - t.x) < 26 * OBJ_SCALE && r.y > t.y - 30 * OBJ_SCALE && r.y < t.y + 6) { hit = true; break; }
```
After:
```js
          if (t.alive && Math.abs(r.x - t.x) < 26 * OBJ_SCALE && r.y > t.y - 30 * OBJ_SCALE && r.y < t.y + 6 * OBJ_SCALE) { hit = true; break; }
```

- [ ] **Step 4: Death explosion / debris anchor** (`sky-fury.js:1123-1124`, `destroyTarget`).

Before:
```js
    this.addExplosion(t.x, t.y - 8, size);
    this.addDebris(t.x, t.y - 8, 8, '#57534e');
```
After:
```js
    this.addExplosion(t.x, t.y - 8 * OBJ_SCALE, size);
    this.addDebris(t.x, t.y - 8 * OBJ_SCALE, 8, '#57534e');
```

- [ ] **Step 5: Blast distance anchor** (`sky-fury.js:1136`, `blast`).

Before:
```js
      const d = Math.hypot(t.x - x, t.y - 10 - y);
```
After:
```js
      const d = Math.hypot(t.x - x, t.y - 10 * OBJ_SCALE - y);
```

- [ ] **Step 6: Syntax check.** `node --check sky-fury.js` → no output, exit 0.
  `grep -nE 't\.y (- 8|- 10|\+ 6)([,)]| -)' sky-fury.js` → no output.

- [ ] **Step 7: Manual browser check.** `python3 -m http.server 8000`, open `http://localhost:8000/`,
  DevTools console open. Start a run, fly to the island:
  - strafe an AA gun / tank with guns: hits register, as before, when bullets strike the lower sprite edge;
  - fire rockets (R) at a ground target: hits register;
  - destroy a radar and a fuel depot: the death explosion and debris originate on the sprite body, not at its base;
  - drop a bomb next to (not on) a ground target: splash damage still applies;
  - console shows no errors.

- [ ] **Step 8: Commit.**
```bash
git add sky-fury.js
git commit -m "fix(render): scale ground-target anchors and hitbox by OBJ_SCALE (#9)"
```

---

### Task 2: Pad fighter splash radius by PLANE_SCALE and revert flip-vapor indent

Covers issue items 1 and 4.

**Files:**
- Modify: `sky-fury.js:1150` (`blast`, fighter branch)
- Modify: `sky-fury.js:509` (`updatePlayer`, flip branch)

- [ ] **Step 1: Fighter splash padding** (`sky-fury.js:1150`). `10 * PLANE_SCALE` (= +20) equals the growth of
  the fighter's direct-hit box from 20 to `20 * PLANE_SCALE` (`sky-fury.js:915`).

Before:
```js
      if (Math.hypot(f.x - x, f.y - y) < r) { this.killFighter(j, false); }
```
After:
```js
      if (Math.hypot(f.x - x, f.y - y) < r + 10 * PLANE_SCALE) { this.killFighter(j, false); }
```

- [ ] **Step 2: Revert the flip-vapor re-indent** (`sky-fury.js:509`): 8 → 6 spaces, content unchanged, matching
  `sky-fury.js:506-508`.

Before (8 spaces):
```js
        if (chance(0.7)) this.fx.vapor.push({ x: p.x - Math.cos(p.a) * 14 * PLANE_SCALE, y: p.y - Math.sin(p.a) * 14 * PLANE_SCALE, r: rand(2, 5), life: 0.5, t: 0 });
```
After (6 spaces):
```js
      if (chance(0.7)) this.fx.vapor.push({ x: p.x - Math.cos(p.a) * 14 * PLANE_SCALE, y: p.y - Math.sin(p.a) * 14 * PLANE_SCALE, r: rand(2, 5), life: 0.5, t: 0 });
```

- [ ] **Step 3: Run the pipeline verification commands** and compare against the AFTER values in Global Constraints
  (`OBJ_SCALE` 12, `PLANE_SCALE` 15, unscaled-anchor grep empty, 8-space vapor 0, bare `< r) { this.killFighter` 0,
  diff = `sky-fury.js` only).

- [ ] **Step 4: Manual browser check.** `python3 -m http.server 8000`, open `http://localhost:8000/`,
  DevTools console open:
  - fire a rocket so it bursts just past a fighter's wing tip (or bomb terrain under a low fighter): the fighter dies;
  - the player's own damage is unchanged — enemy bullets and flak hit as before, mid-air collision unchanged;
  - press F in flight: flip still animates and leaves the vapor trail;
  - console shows no errors.

- [ ] **Step 5: Commit.**
```bash
git add sky-fury.js
git commit -m "fix(render): pad fighter blast radius by PLANE_SCALE, revert vapor indent (#9)"
```
