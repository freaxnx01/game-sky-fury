# Bomb Aiming Aid — Implementation Plan

**Goal:** Show a predicted bomb impact point (dashed arc + crosshair) while the player is flying with bombs left (issue #4).

**Architecture:** Extract bomb launch state and bomb physics step into pure module-level helpers shared by the real simulation and a new `Game.predictBombImpact()`. `update()` stores the prediction in `this.bombAim`; a new read-only `drawBombAim(ctx)` layer renders it. Spec: `docs/ai-notes/specs/2026-09-27-bomb-aiming-aid-design.md`.

**Global Constraints:**
- Buildless vanilla JS, single file `sky-fury.js`; no new files, packages, or build steps.
- `const`/`let` only; render functions must not mutate game state.
- Existing bomb behaviour must stay identical (pure refactor in Task 1).
- Verification = manual in-browser playtest: `python3 -m http.server 8000` in the repo root, open `http://localhost:8000/`, DevTools console open.
- Line numbers refer to `sky-fury.js` at commit `1000717`; re-locate by the quoted code if earlier tasks shifted them.

---

### Task 1: Extract shared bomb helpers (pure refactor)

**Files:** `sky-fury.js` — constants block (after line 134), bomb drop (lines 506-510), bomb update (lines 884-888)

- [ ] **Step 1:** After the `const SCORE = {…};` line (134), add:

```js
/* ------------------------------ bomb physics ------------------------------ */
function bombLaunch(p) {
  return { x: p.x, y: p.y + 10, vx: p.vx, vy: p.vy + 30 };
}
function stepBomb(b, dt) {
  b.vy += GRAV * dt;
  b.vx *= (1 - 0.25 * dt);
  b.x += b.vx * dt; b.y += b.vy * dt;
}
```

- [ ] **Step 2:** In `updatePlayer`, replace

```js
      this.bombs.push({ x: p.x, y: p.y + 10, vx: p.vx, vy: p.vy + 30, hostile: false });
```

with

```js
      this.bombs.push(Object.assign(bombLaunch(p), { hostile: false }));
```

- [ ] **Step 3:** In `updateProjectiles` (`// bombs` loop), replace

```js
      b.vy += GRAV * dt;
      b.vx *= (1 - 0.25 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
```

with

```js
      stepBomb(b, dt);
```

- [ ] **Step 4 (verify):** Serve and play. Drop bombs over the island and the sea, and let an enemy bomber attack the carrier: bombs fall, explode, splash and damage exactly as before; console empty.

- [ ] **Step 5 (commit):**

```bash
git commit -am "refactor(bombs): extract shared bomb launch and physics step"
```

---

### Task 2: Predict the impact point in `update`

**Files:** `sky-fury.js` — `resetWorld` (line 238), `update` (line 376), new method before `/* --- projectiles --- */` (line 807)

- [ ] **Step 1:** In `resetWorld`, after `this.bombs = []; this.rockets = []; this.torps = []; this.flaks = [];` add:

```js
    this.bombAim = null;
```

- [ ] **Step 2:** In `update`, directly after `this.updatePlayer(dt);` add:

```js
    this.bombAim = this.canAimBomb() ? this.predictBombImpact() : null;
```

- [ ] **Step 3:** Insert before the `/* ------------------------------ projectiles ------------------------------ */` comment:

```js
  /* ------------------------------ bomb aiming ------------------------------ */
  canAimBomb() {
    const p = this.player;
    return p.state === 'fly' && p.bombs > 0;
  }
  predictBombImpact() {
    const AIM_DT = 1 / 60, AIM_MAX_STEPS = 480, PATH_EVERY = 3;
    const b = bombLaunch(this.player);
    const path = [{ x: b.x, y: b.y }];
    for (let i = 1; i <= AIM_MAX_STEPS; i++) {
      stepBomb(b, AIM_DT);
      if (i % PATH_EVERY === 0) path.push({ x: b.x, y: b.y });
      if (this.bombHitsShip(b)) break;
      const gy = this.overIsland(b.x) ? this.groundAt(b.x) : 0;
      if (b.y >= gy) { b.y = gy; break; }
    }
    path.push({ x: b.x, y: b.y });
    return { path, x: b.x, y: b.y };
  }
  bombHitsShip(b) {
    return this.ships.some(s => s.alive && Math.abs(b.x - s.x) < s.w / 2 && b.y > -40);
  }
```

(Ship test mirrors `updateProjectiles`' player-bomb ship check; leave that loop untouched — it needs the hit ship reference for `damageShip`.)

- [ ] **Step 4 (verify):** The game instance lives inside an IIFE, so add a temporary `console.log(this.bombAim && Math.round(this.bombAim.x))` after Step 2's line, serve, take off: the x value sits ahead of the plane in its flight direction, and is `null` on deck and with 0 bombs. **Remove the log** before committing; no other console output.

- [ ] **Step 5 (commit):**

```bash
git commit -am "feat(bombs): predict bomb impact point each tick"
```

---

### Task 3: Draw the aiming aid

**Files:** `sky-fury.js` — `draw()` layer list (lines 1215-1216), new method after `drawAircraft`'s closing brace / before `drawProjectiles` (line 1699)

- [ ] **Step 1:** In `draw()`, between `this.drawCarrier(ctx);` and `this.drawProjectiles(ctx);` add:

```js
    if (this.state === 'playing') this.drawBombAim(ctx);
```

- [ ] **Step 2:** Insert before `drawProjectiles(ctx) {`:

```js
  drawBombAim(ctx) {
    const aim = this.bombAim;
    if (!aim) return;
    const sc = this.scale;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5 * sc;
    ctx.setLineDash([4 * sc, 8 * sc]);
    ctx.beginPath();
    aim.path.forEach((pt, i) => {
      const x = this.sx(pt.x), y = this.sy(pt.y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    this.drawAimReticle(ctx, this.sx(aim.x), this.sy(aim.y), sc);
    ctx.restore();
  }
  drawAimReticle(ctx, x, y, sc) {
    const r = 11 * sc, tick = 6 * sc;
    ctx.strokeStyle = 'rgba(255,210,74,0.9)';
    ctx.lineWidth = 2 * sc;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.moveTo(x - r - tick, y); ctx.lineTo(x - r + tick, y);
    ctx.moveTo(x + r - tick, y); ctx.lineTo(x + r + tick, y);
    ctx.moveTo(x, y - r - tick); ctx.lineTo(x, y - r + tick);
    ctx.moveTo(x, y + r - tick); ctx.lineTo(x, y + r + tick);
    ctx.stroke();
  }
```

- [ ] **Step 3 (verify):** Serve and playtest the spec's acceptance criteria:
  - Flying with bombs: dashed arc from the plane to an amber crosshair on terrain/sea; follows speed, dive/climb and flip smoothly.
  - Drop bombs at low/high altitude, facing left and right, over island, sea and an enemy ship: each explosion lands at (within ~15 px of) the crosshair's position at release.
  - No aid on deck, during takeoff/roll, after being shot down, or once bombs hit 0; it returns after rearming.
  - Pause (`P`): aid stays frozen under the overlay; game over / menu: no aid.
  - Console empty, no visible frame drops.

- [ ] **Step 4 (commit):**

```bash
git commit -am "feat(bombs): draw predicted impact arc and crosshair

Closes #4"
```
