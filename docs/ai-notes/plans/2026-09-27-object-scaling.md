# Object Scaling Implementation Plan (issue #2)

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to carry this plan out task by task.

**Goal:** Draw aircraft at 2x and ground targets and projectiles at 1.5x. Hitboxes for
the things the player shoots at grow to match. The playing field (world, camera zoom,
terrain, carrier, ships) stays unchanged.

**Architecture:** Two new constants, `PLANE_SCALE = 2` and `OBJ_SCALE = 1.5`, sit in
the constants block of `sky-fury.js`. They multiply the per-object pixel scale `s` in
the draw functions, the matching hard-coded hitbox numbers in the update and collision
code, and the spawn offsets tied to the plane's geometry. `this.scale` (the
world-to-screen zoom, `sky-fury.js:219`) is not touched.

**Global Constraints:**
- The stack is a buildless browser game. There is no test runner, so each task ends
  with a manual in-browser check: `python3 -m http.server 8000` in the repo root, then
  open `http://localhost:8000/`.
- **Pipeline verification commands** (run BEFORE and AFTER, paste the output into the PR):
  ```bash
  node --check sky-fury.js                      # syntax: no output, exit 0 before and after
  grep -c 'PLANE_SCALE\|OBJ_SCALE' sky-fury.js  # before: 0 — after: > 0
  git diff --name-only origin/main              # after: only sky-fury.js
  ```
  The manual playtest (Task 5) remains the human gate. Don't claim it was run; list it in the PR as outstanding.
- Only edit `sky-fury.js`. Don't touch `index.html`, `version.js`, the world
  constants (`WORLD_W`, `DECK_Y`, `CV`, `ISLE`), speeds or timers.
- Use `const`/`let` and keep the existing code style. Leave no commented-out code.
- The player's own damage hitboxes (`:653` mid-air 26, `:875` bullet 16, `:1017` flak
  56, `blast()` player check) stay unchanged. This is deliberate.
- Line numbers refer to `main` at `1000717`. If they have shifted (#3/#4/#5 may land
  first), find each edit by its quoted text.

---

### Task 1: Constants and aircraft sprites ×2, with player spawn offsets

**Files:**
- Modify: `sky-fury.js:134` (add the constants after `SCORE`)
- Modify: `sky-fury.js:1620`, `:1651`, `:1666` (aircraft pixel scale)
- Modify: `sky-fury.js:455`, `:495`, `:508`, `:514`, `:524`, `:535` (player spawn offsets)
- Modify: `sky-fury.js:692` (bomber bomb bay)

- [ ] **Step 1: Add the constants** directly after line 134 (`const SCORE = …`):

```js
const PLANE_SCALE = 2;   // aircraft in flight: player, fighters, bombers
const OBJ_SCALE = 1.5;   // ground targets (incl. parked planes) and projectile sprites
```

- [ ] **Step 2: Scale the aircraft sprites** in `drawAircraft`:

```js
// :1620 player
const s = 1.15 * sc * PLANE_SCALE;
// :1651 fighters
const s = 1.05 * sc * PLANE_SCALE;
// :1666 bombers
const s = 1.1 * sc * PLANE_SCALE;
```

- [ ] **Step 3: Move the player's spawn points to the enlarged airframe:**

```js
// :455 flip vapor
if (chance(0.7)) this.fx.vapor.push({ x: p.x - Math.cos(p.a) * 14 * PLANE_SCALE, y: p.y - Math.sin(p.a) * 14 * PLANE_SCALE, r: rand(2, 5), life: 0.5, t: 0 });
// :495 gun muzzle
const mx = p.x + Math.cos(p.a) * 20 * PLANE_SCALE, my = p.y + Math.sin(p.a) * 20 * PLANE_SCALE;
// :508 bomb release
this.bombs.push({ x: p.x, y: p.y + 10 * PLANE_SCALE, vx: p.vx, vy: p.vy + 30, hostile: false });
// :514 rocket launch
x: p.x + Math.cos(p.a) * 16 * PLANE_SCALE, y: p.y + Math.sin(p.a) * 16 * PLANE_SCALE + 6 * PLANE_SCALE,
// :524 torpedo release
this.torps.push({ x: p.x, y: p.y + 12 * PLANE_SCALE, vx: p.vx, vy: p.vy + 20, water: false, life: 10 });
// :535 damage smoke
this.addSmoke(p.x - Math.cos(p.a) * 16 * PLANE_SCALE, p.y - Math.sin(p.a) * 16 * PLANE_SCALE, rand(3, 6));
```

- [ ] **Step 4: Move the bomber's bomb bay** (`:692`):

```js
this.bombs.push({ x: b.x, y: b.y + 14 * PLANE_SCALE, vx: b.vx + rand(-14, 14), vy: 40, hostile: true });
```

- [ ] **Step 5: Check in the browser.** Serve the game, open it, and start a game (Enter):
  - The player plane on the deck is visibly about 2x bigger. It rests on the deck
    without sinking in or floating.
  - Take off. Tracers start at the nose. `B` drops a bomb below the fuselage, `R`
    launches a rocket in front of it, and the torpedo drops from below.
  - Land again. Touchdown and REARMING still work.
  - Fighters (and bombers from wave 2) are 2x.
  - The console is empty.

- [ ] **Step 6: Commit**

```bash
git add sky-fury.js
git commit -m "feat(render): draw aircraft at 2x via PLANE_SCALE (#2)"
```

---

### Task 2: Enemy aircraft hitboxes follow PLANE_SCALE

**Files:**
- Modify: `sky-fury.js:837` (fighter vs player bullet)
- Modify: `sky-fury.js:845` (bomber vs player bullet)
- Modify: `sky-fury.js:948` (bomber vs rocket)

- [ ] **Step 1: Make the edits**

```js
// :837
if (Math.hypot(b.x - f.x, b.y - f.y) < 20 * PLANE_SCALE) {
// :845
if (Math.abs(b.x - bo.x) < 34 * PLANE_SCALE && Math.abs(b.y - bo.y) < 14 * PLANE_SCALE) {
// :948
if (Math.abs(r.x - bo.x) < 36 * PLANE_SCALE && Math.abs(r.y - bo.y) < 16 * PLANE_SCALE) {
```

- [ ] **Step 2: Check in the browser.**
  - Shoot a fighter through a wingtip or the tail of its enlarged sprite. It registers
    sparks and hits.
  - Shoot a bomber (wave 2 or later) near its nose or tail. It registers hits.
  - Let a fighter fire at you. Only near-centre hits damage you (the player hitbox is
    unchanged).

- [ ] **Step 3: Commit**

```bash
git add sky-fury.js
git commit -m "feat(combat): scale enemy aircraft hitboxes with PLANE_SCALE (#2)"
```

---

### Task 3: Ground targets ×1.5 (sprites and hitboxes)

**Files:**
- Modify: `sky-fury.js:1450` (`drawTargets` scale)
- Modify: `sky-fury.js:827` (bullet box), `:941` (rocket box), `:1061` (blast padding)
- Modify: `sky-fury.js:718` (AA barrel pivot)

- [ ] **Step 1: Scale the whole of `drawTargets` with one line** (`:1450`). Every use of
  `sc` in this function is a size, not a position (positions go through
  `this.sx/this.sy`). So this one change scales the sprites (`s = sc`, `:1464`), the
  parked planes (`0.9 * s`), the wrecks (`:1457-1459`) and the damage bars
  (`:1551-1553`):

```js
drawTargets(ctx) {
  const sc = this.scale * OBJ_SCALE;
```

- [ ] **Step 2: Scale the hitboxes**

```js
// :827
const hw = (t.type === 'bunker' ? 30 : 22) * OBJ_SCALE, hh = (t.type === 'radar' ? 52 : 24) * OBJ_SCALE;
// :941
if (t.alive && Math.abs(r.x - t.x) < 26 * OBJ_SCALE && r.y > t.y - 30 * OBJ_SCALE && r.y < t.y + 6) { hit = true; break; }
// :1061-1062
if (d < r + 18 * OBJ_SCALE) {
  const f = clamp(1.5 * (1 - d / (r + 18 * OBJ_SCALE)), 0, 1);
```

- [ ] **Step 3: Move the AA barrel pivot** (`:718`) so that flak leaves the enlarged turret:

```js
const gx = t.x, gy = t.y - 12 * OBJ_SCALE;
```

- [ ] **Step 4: Check in the browser.** Fly over the island (around x 3000-9400):
  - All seven target types are 1.5x bigger and sit on the terrain line, not floating.
  - Strafe the edge of a tank or bunker. You get sparks.
  - Destroy a jeep. The wreck is 1.5x.
  - Damage a tank. Its damage bar sits above the sprite.
  - AA tracers come from the barrel tip area.
  - The island outline and the carrier are unchanged. The console is empty.

- [ ] **Step 5: Commit**

```bash
git add sky-fury.js
git commit -m "feat(render): draw ground targets at 1.5x via OBJ_SCALE (#2)"
```

---

### Task 4: Projectile sprites ×1.5

**Files:**
- Modify: `sky-fury.js:1700` (add `os`), `:1731-1733` (bombs), `:1743-1747` (rockets), `:1758` and `:1763` (torpedoes)

- [ ] **Step 1: Add a local projectile scale** after `const sc = this.scale;` in
  `drawProjectiles` (`:1700`). Tracers and flak keep using `sc`.

```js
const os = sc * OBJ_SCALE;
```

- [ ] **Step 2: Replace `sc` with `os` in the bomb, rocket and torpedo sprite lines only:**

```js
// bombs :1731-1733
ctx.ellipse(0, 0, 7 * os, 3 * os, 0, 0, TAU);
ctx.fill();
ctx.fillRect(-9 * os, -2.4 * os, 3 * os, 4.8 * os);
// rockets :1743-1747
ctx.fillRect(-6 * os, -1.6 * os, 12 * os, 3.2 * os);
ctx.fillStyle = '#ffb54a';
ctx.beginPath();
ctx.moveTo(-6 * os, 0); ctx.lineTo(-12 * os, 0);
ctx.lineWidth = 2.6 * os; ctx.strokeStyle = 'rgba(255,180,74,0.9)'; ctx.stroke();
// torpedoes :1758, :1763
ctx.ellipse(0, 0, 11 * os, 2.8 * os, 0, 0, TAU);
ctx.fillRect(x - (t.vx > 0 ? 30 : -6) * os, this.sy(-1), 24 * os, 1.6 * os);
```

- [ ] **Step 3: Check in the browser.**
  - Drop a bomb, fire a rocket, and launch a torpedo at a ship.
  - Each sprite is visibly bigger. The torpedo wake trails behind the torpedo.
  - Tracer lines look unchanged.
  - The console is empty.

- [ ] **Step 4: Commit**

```bash
git add sky-fury.js
git commit -m "feat(render): draw bombs, rockets and torpedoes at 1.5x (#2)"
```

---

### Task 5: Full playtest (acceptance)

- [ ] **Step 1:** Run the stack checklist from `CLAUDE.md` (Tooling & Testing):
  - The page loads with an empty console.
  - The first frame renders.
  - Input works: movement, fire, `P` pause.
  - The best score persists across a reload.
- [ ] **Step 2:** Play waves 1-2 end to end:
  - take off
  - destroy targets
  - land and rearm
  - survive a bomber raid

  The difficulty feels reasonable and nothing looks clipped at the screen edges.
  Culling margins are 80 px for fighters and 120 px for bombers; a sprite popping in
  or out at the edge means a margin needs raising, so flag it.
- [ ] **Step 3:** Resize the window to a short height (about 500 px). Objects shrink
  together with the field and keep their proportions.
- [ ] **Step 4:** Tune if needed. Adjust only `PLANE_SCALE` / `OBJ_SCALE` (e.g. 1.75)
  and commit with `fix(render): tune object scale factors (#2)`.
