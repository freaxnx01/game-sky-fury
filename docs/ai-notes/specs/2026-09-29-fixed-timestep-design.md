# Fixed-Timestep Game Loop — Design

Issue: #6 — `chore(loop): switch game loop to fixed timestep`
Base: `main` @ `01dc944`, file `sky-fury.js` (2268 lines)

## Goal

Bring the main loop in line with the browser-game stack rule (CLAUDE.md, "Game Loop"): a
**fixed-timestep simulation** advanced by an **accumulator** inside `requestAnimationFrame`, with
**variable-rate rendering**, and a loop that does not catch up after the tab was hidden or the window
lost focus. Side benefit: the bomb aiming aid (#4) simulates with the same step as the game, so its
impact marker becomes exact.

## Current state (verified)

- `frame(now)` at `sky-fury.js:403-412` computes a variable `dt`, clamps it with
  `dt = clamp(dt, 0, 1 / 30);` (line 408), advances `this.t` and calls `this.update(dt)` once per frame.
  (The issue cites lines 351-360; the code has since moved to 403-412.)
- Below 30 fps the game runs in slow motion (dt capped); above 60 Hz each frame runs a smaller step.
- `predictBombImpact()` (`sky-fury.js:867-880`) uses a local `AIM_DT = 1 / 60` with `stepBomb`, while the
  real bomb is stepped with the frame's variable `dt` (`sky-fury.js:964`) — so the marker drifts from the
  real impact whenever the frame rate is not exactly 60 Hz.
- **Pause on hide already exists:** `document.addEventListener('visibilitychange', this._onBlur)`
  (`sky-fury.js:214`) and `window` `blur` (`:212`) both run `_onBlur` (`:192`), which clears held keys and
  one-shot flags and sets `paused = true` while playing. It does **not** reset the loop clock, so the
  first frame after returning computes a large `dt` (today clamped to 1/30 s).
- Input is already sampled into a state object: held keys in `this.keys`, one-shot intents in
  `this.wantTorp` / `this.wantCarpet`, consumed by the simulation (`:381`, `:574-575`).

## Approach

1. Two module constants next to the physics constants (`sky-fury.js:131-137`):
   - `SIM_DT = 1 / 60` — the fixed simulation step (seconds).
   - `MAX_FRAME_DT = 0.1` — the largest wall-clock slice one frame may feed into the accumulator
     (spiral-of-death clamp: at most 6 steps per frame).
2. `this.accumulator = 0` in the constructor next to `this.t` / `this.last`.
3. `frame(now)`: add the clamped frame time to the accumulator, then
   `while (accumulator >= SIM_DT) { this.t += SIM_DT; this.update(SIM_DT); accumulator -= SIM_DT; }`,
   then `this.draw()` once. No render interpolation.
4. `_onBlur` additionally resets `this.last = 0; this.accumulator = 0;` so returning to the tab/window
   starts a fresh clock with no catch-up burst.
5. `predictBombImpact()` drops its local `AIM_DT` and steps with `SIM_DT`, so prediction and real bomb use
   the identical integrator and step.

### Per-step vs per-frame

Everything inside `update()` runs **per step** — gameplay, timers, particles/fx, banners, clouds, shake
decay, camera easing, engine-audio smoothing and the aim prediction. They are all `dt`-driven already,
so this needs no change and keeps their timing frame-rate independent. `draw()` runs **once per frame**
and only reads state (the per-frame `Math.random()` screen-shake jitter in `draw()` stays as is).
`this.t` advances by `SIM_DT` per step, because the simulation reads it (fighter patrol, `:659`).

### Input one-shots

`wantTorp` / `wantCarpet` are set by `onKey` and cleared by the first step that reads them
(`:381`, `:575`). With a fixed step:

- **0 steps this frame** (e.g. 144 Hz display): the flag stays set until the next frame's step — not lost.
- **Several steps this frame** (slow frame): the first step consumes and clears it — fires once, not per step.

No change needed. `tryFlip()` (`:355`) and the `KeyP` pause toggle (`:343`) mutate state directly from the
key handler; that is pre-existing and deliberately out of scope.

### High refresh rate / slow CPU

- 120 Hz: ~1 step every 2 frames. 144 Hz: 2-3 frames per step (uneven) — the picture can repeat a frame;
  accepted (up to one step, 16.7 ms, of visual latency, no interpolation).
- Slow CPU (10-60 fps): 1-6 steps per frame, game speed stays real-time.
- Below 10 fps: `MAX_FRAME_DT` caps the work; the game slows down instead of freezing.

## Acceptance criteria

- `frame()` advances the simulation only in fixed `SIM_DT = 1/60` s steps via an accumulator and draws once per frame.
- The variable `dt = clamp(dt, 0, 1 / 30)` clamp is gone; frame time is capped by `MAX_FRAME_DT` (≤ 6 steps per frame).
- `predictBombImpact()` uses `SIM_DT`; no separate `AIM_DT` constant remains.
- Blur / tab hide still pauses a running game and additionally resets the loop clock; on return there is no catch-up burst.
- The simulation runs at ~60 steps/s on 60 Hz, 120/144 Hz and CPU-throttled browsers.
- One-shot inputs (torpedo `X`/`T`, carpet `Shift+B`) fire exactly once per key press at any refresh rate.
- `node --check sky-fury.js` passes; only `sky-fury.js` changes.

## Out of scope

- Render interpolation between the previous and current simulation state.
- Moving `tryFlip()` / pause toggling out of the key handler into the step.
- Deterministic simulation (seeded RNG) — only needed for P2P lockstep, which this game does not have.
- Moving cosmetic updates (clouds, fx, banners) to per-frame.
- Version bump / CHANGELOG edits (release flow).
