# Sandbox Mode Implementation Plan

> **For agentic workers:** execute task-by-task; each task ends with a manual in-browser check and a commit.
> This is a buildless browser game — there is no test runner. Verification = manual playtest
> (`python3 -m http.server 8000` in the repo root, open `http://localhost:8000/`, DevTools console open).

**Goal:** Add a persisted, menu-toggled **Sandbox** mode (key G) with unlimited bombs and an invulnerable
player/carrier, a HUD indicator, and no best-score recording (issue #3).

**Architecture:** One boolean `this.sandbox` on `Game` (`sky-fury.js`), loaded from / saved to
`localStorage['sky-fury-sandbox']`, togglable only while `state !== 'playing'`. Gameplay code reads it at the
existing choke points: bomb drop, `damagePlayer()`, `crashPlane()`, hostile-bomb carrier hit, `saveBest()`.
Render code (`drawMenu`, `drawHUD`, `drawEnd`) only reads it.

**Global Constraints:**
- Only `sky-fury.js` changes. No new files, no dependencies, no build step.
- `const`/`let` only; input handler writes state, draw functions only read it.
- `localStorage` access wrapped in `try/catch` (existing pattern, `sky-fury.js:27`, `:59`).
- UI text English (existing UI has no i18n; arcade carve-out).
- Line numbers refer to `sky-fury.js` at commit `1000717`; re-locate by the quoted code if they shifted
  (issues #2/#4/#5 touch the same file).
- Do not bump `version.js` or edit `CHANGELOG.md` (git-cliff generates it at release).

---

### Task 1: Sandbox state, G toggle, persistence, menu row

**Files:**
- Modify: `sky-fury.js:147-148` (constructor, next to `this.best`)
- Modify: `sky-fury.js:322-340` (`onKey`)
- Modify: `sky-fury.js:2032-2085` (`drawMenu`)

- [ ] **Step 1: Load the flag in the constructor.** After line 148
  (`try { this.best = +localStorage.getItem('sky-fury-best') || 0; } catch (e) {}`) add:

```js
    this.sandbox = false;
    try { this.sandbox = localStorage.getItem('sky-fury-sandbox') === '1'; } catch (e) {}
```

- [ ] **Step 2: Add a toggle command method** directly after `onKey()` (before `tryFlip()`):

```js
  toggleSandbox() {
    this.sandbox = !this.sandbox;
    try { localStorage.setItem('sky-fury-sandbox', this.sandbox ? '1' : '0'); } catch (e) {}
    this.audio.click();
  }
```

- [ ] **Step 3: Bind G outside of a run.** In `onKey`, directly after the `KeyP` line (`sky-fury.js:327`) add:

```js
    if (c === 'KeyG' && this.state !== 'playing' && !e.repeat) { this.toggleSandbox(); return; }
```

- [ ] **Step 4: Menu row.** In `drawMenu`:
  - replace the three `240` card-height literals with a local `const cardH = 270;`
    (`this.rr(ctx, cx, cy, cw, cardH, 14)`, and the two prompt lines `cy + cardH + 46` / `cy + cardH + 74`);
  - append a row to `rows` (after the "Land low, slow & level…" row):

```js
      ['G', 'Sandbox: unlimited bombs, invulnerable — ' + (this.sandbox ? 'ON' : 'OFF')]
```

  - inside `rows.forEach`, colour the sandbox row amber when on: change the description `fillStyle` line to

```js
      ctx.fillStyle = r[0] === 'G' && this.sandbox ? '#e8b84a' : '#dcebf5';
```

- [ ] **Step 5: Verify in browser.** Serve with `python3 -m http.server 8000`, open the page:
  menu shows the G row with `OFF`; press G → `ON` (amber), click sound; reload → still `ON`;
  press Enter, then G during flight → nothing happens; console empty.

- [ ] **Step 6: Commit.**

```bash
git add sky-fury.js
git commit -m "feat(game): add sandbox mode toggle on menu (G), persisted"
```

---

### Task 2: Gameplay effects — unlimited bombs, invulnerable plane and carrier, no lives lost

**Files:**
- Modify: `sky-fury.js:506-508` (bomb drop in `updatePlayer`)
- Modify: `sky-fury.js:563-578` (`crashPlane`)
- Modify: `sky-fury.js:891-893` (hostile bomb hits carrier in `updateProjectiles`)
- Modify: `sky-fury.js:1024-1031` (`damagePlayer`)

- [ ] **Step 1: Bombs not consumed.** Replace `p.bombT = 0.32; p.bombs--;` with:

```js
      p.bombT = 0.32;
      if (!this.sandbox) p.bombs--;
```

- [ ] **Step 2: Invulnerable plane.** In `damagePlayer`, change the guard
  `if (p.state === 'dead') return;` to:

```js
    if (p.state === 'dead' || this.sandbox) return;
```

- [ ] **Step 3: Crashes cost no plane.** In `crashPlane`, replace `this.lives--;` with
  `if (!this.sandbox) this.lives--;` and replace the final banner line with:

```js
    if (this.sandbox) this.banner('PLANE LOST', 'Sandbox — no plane used', 2.2);
    else if (this.lives > 0) this.banner('PLANE LOST', this.lives + (this.lives === 1 ? ' plane' : ' planes') + ' remaining', 2.2);
```

- [ ] **Step 4: Carrier hull protected.** In the hostile-bomb carrier hit block (`sky-fury.js:893`) replace
  `this.carrierHp = Math.max(0, this.carrierHp - 16);` with:

```js
        if (!this.sandbox) this.carrierHp = Math.max(0, this.carrierHp - 16);
```

  (Explosion/splash FX stay; the `damagePlayer(50, 'bomb')` call on `:897` is already neutralised by Step 2.)

- [ ] **Step 5: Verify in browser (Sandbox ON).** Take off, hold B for > 10 s → bombs keep falling at the normal
  cadence, count never drops. Fly into flak/fighters → HP bar stays full, no hit flash. Dive into the sea → plane
  lost, banner "Sandbox — no plane used", PLANES icons unchanged, respawn on deck. Wait for "BOMBERS INBOUND" and
  let them bomb the carrier → hull stays 100 %. Then toggle **OFF** on the end/menu screen and confirm bombs run
  out after 5, damage and plane loss work as before. Console empty.

- [ ] **Step 6: Commit.**

```bash
git add sky-fury.js
git commit -m "feat(game): sandbox gives unlimited bombs and invulnerability"
```

---

### Task 3: HUD indicator, ∞ bomb counter, best score excluded

**Files:**
- Modify: `sky-fury.js:1108-1113` (`saveBest`)
- Modify: `sky-fury.js:1853-1862` (`drawHUD` score panel)
- Modify: `sky-fury.js:1917-1919` (`drawHUD` bomb counter)
- Modify: `sky-fury.js:2108-2112` (`drawEnd` NEW BEST block)

- [ ] **Step 1: Do not record best score.** At the top of `saveBest()` add the guard:

```js
    if (this.sandbox) return;
```

- [ ] **Step 2: SANDBOX tag.** In `drawHUD`, after `ctx.fillText('SCORE', pad + 12, pad + 20);` add:

```js
    if (this.sandbox) {
      ctx.fillStyle = '#e8b84a';
      ctx.font = fnt(11, 800);
      ctx.fillText('SANDBOX', pad + 90, pad + 20);
    }
```

  (the following score-value lines set their own `fillStyle`/`font`, so nothing else changes).

- [ ] **Step 3: ∞ bomb counter.** Replace

```js
    ctx.fillStyle = p.bombs ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.fillText('B ' + p.bombs, pad + 12, by + 66);
```

  with

```js
    ctx.fillStyle = p.bombs ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.fillText('B ' + (this.sandbox ? '∞' : p.bombs), pad + 12, by + 66);
```

- [ ] **Step 4: End screen.** Replace the `NEW BEST` block in `drawEnd` with:

```js
    if (this.sandbox) {
      ctx.fillStyle = '#e8b84a';
      ctx.font = fnt(15, 800);
      ctx.fillText('SANDBOX — SCORE NOT RECORDED', W / 2, H * 0.4 + 110);
    } else if (this.score >= this.best && this.score > 0) {
      ctx.fillStyle = '#e8b84a';
      ctx.font = fnt(15, 800);
      ctx.fillText('NEW BEST', W / 2, H * 0.4 + 110);
    }
```

- [ ] **Step 5: Verify in browser.** Note the menu "Best score" value (or `localStorage['sky-fury-best']`).
  Sandbox ON: HUD shows amber `SANDBOX` next to SCORE and `B ∞`. Score some points, then end the run
  (e.g. set `waves="1"` on `<sky-fury>` in DevTools *before* pressing Enter, then clear the wave) → end screen says
  `SANDBOX — SCORE NOT RECORDED`; menu best score unchanged after reload. Sandbox OFF: no tag, `B 5`,
  `NEW BEST` and best-score saving behave as before. Console empty.

- [ ] **Step 6: Commit.**

```bash
git add sky-fury.js
git commit -m "feat(ui): show sandbox HUD tag and skip best score in sandbox"
```

---

### Final check (browser-game manual gate)

- [ ] Page loads with an empty console; initial frame renders.
- [ ] Core loop responds to input in both modes (move, flip, guns, B/R/X, pause, mute).
- [ ] `sky-fury-sandbox`, `sky-fury-best`, `sky-fury-muted` all persist across reload.
