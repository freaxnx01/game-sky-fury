/* ============================================================================
   SKY FURY — a side-scrolling WWII carrier-aviation action game.
   An original homage to 1987 carrier-combat arcade classics.
   Single self-contained vanilla web component: <sky-fury waves="5" lives="4">
   Canvas 2D rendering, Web Audio synthesis. No assets, no dependencies.
   ========================================================================== */
(() => {
'use strict';

/* ---------------------------------- utils -------------------------------- */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const chance = p => Math.random() < p;
function wrapA(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function rotTo(a, target, maxD) {
  const d = wrapA(target - a);
  return a + clamp(d, -maxD, maxD);
}
function fnt(px, w) { return (w || 700) + ' ' + px + 'px Nunito, "Segoe UI", system-ui, sans-serif'; }

/* ---------------------------------- audio -------------------------------- */
class SFAudio {
  constructor() {
    this.ok = false; this.muted = false; this.ctx = null;
    try { this.muted = localStorage.getItem('sky-fury-muted') === '1'; } catch (e) {}
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(ctx.destination);
      // engine: saw osc -> lowpass -> tremolo gain
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 2;
      this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 70;
      this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 35;
      const o2g = ctx.createGain(); o2g.gain.value = 0.4;
      this.engOsc.connect(lp); this.engOsc2.connect(o2g); o2g.connect(lp);
      lp.connect(this.engGain); this.engGain.connect(this.master);
      this.engOsc.start(); this.engOsc2.start();
      // shared noise buffer
      const len = ctx.sampleRate * 1.2, buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.ok = true;
    } catch (e) { this.ctx = null; this.ok = false; }
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('sky-fury-muted', m ? '1' : '0'); } catch (e) {}
    if (this.ok) this.master.gain.value = m ? 0 : 0.55;
  }
  _noiseShot(dur, type, freq, q, vol, sweepTo) {
    if (!this.ok || this.muted) return;
    try {
      const c = this.ctx, t = c.currentTime;
      const src = c.createBufferSource(); src.buffer = this.noise;
      src.playbackRate.value = rand(0.85, 1.2);
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
    } catch (e) {}
  }
  updateEngine(throttle, speed, active, dt) {
    if (!this.ok) return;
    try {
      const target = active ? 0.10 + throttle * 0.06 : 0;
      const g = this.engGain.gain;
      g.value = lerp(g.value, this.muted ? 0 : target, clamp(dt * 6, 0, 1));
      const f = 55 + speed * 0.16 + throttle * 40;
      this.engOsc.frequency.value = lerp(this.engOsc.frequency.value, f, clamp(dt * 4, 0, 1));
      this.engOsc2.frequency.value = this.engOsc.frequency.value * 0.5;
    } catch (e) {}
  }
  gun() { this._noiseShot(0.07, 'bandpass', rand(1500, 2100), 1.2, 0.5); }
  enemyGun() { this._noiseShot(0.06, 'bandpass', rand(900, 1300), 1.5, 0.22); }
  boom(size) {
    if (!this.ok || this.muted) return;
    const s = clamp(size || 1, 0.5, 3);
    this._noiseShot(0.5 * s, 'lowpass', 900, 0.7, 0.8, 60);
    try {
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.4 * s);
      const g = c.createGain();
      g.gain.setValueAtTime(0.7, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45 * s);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.5 * s);
    } catch (e) {}
  }
  splash(big) { this._noiseShot(big ? 0.55 : 0.3, 'bandpass', 800, 0.6, big ? 0.5 : 0.25, 300); }
  flak() { this._noiseShot(0.18, 'highpass', 500, 0.8, 0.3); }
  whoosh() { this._noiseShot(0.4, 'bandpass', 400, 1.5, 0.25, 1400); }
  click() {
    if (!this.ok || this.muted) return;
    try {
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 660;
      const g = c.createGain();
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.1);
    } catch (e) {}
  }
}

/* --------------------------------- constants ------------------------------ */
const WORLD_W = 12400;
const DECK_Y = -46;
const CV = { x0: 11360, x1: 12040, d0: 11372, d1: 12028, cx: 11700 };
const ISLE = [
  [2800, 0], [3080, -58], [3500, -124], [3980, -102], [4480, -172], [4980, -152],
  [5520, -206], [6120, -158], [6720, -188], [7250, -118], [7840, -142],
  [8320, -72], [8840, -88], [9180, -34], [9400, 0]
];
const GRAV = 340, THRUST = 275, STALL = 112, MAXS = 560, TURN = 2.35, FLIP_DUR = 0.5;
const FUEL_MAX = 420;
const AMMO = { bombs: 5, rockets: 6, torps: 2 };
const SCORE = { jeep: 50, aa: 100, parked: 100, tank: 150, fuel: 200, bunker: 250, radar: 300, ship: 500, fighter: 200, bomber: 300 };

/* ----------------------------------- game --------------------------------- */
class Game {
  constructor(host, canvas) {
    this.host = host; this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = new SFAudio();
    this.keys = {};
    this.state = 'menu';       // menu | playing | over | win
    this.paused = false;
    this.overReason = '';
    this.t = 0; this.last = 0;
    this.best = 0;
    try { this.best = +localStorage.getItem('sky-fury-best') || 0; } catch (e) {}
    // terrain lookup
    this.gh = new Float32Array((WORLD_W >> 3) + 4);
    for (let i = 1; i < ISLE.length; i++) {
      const [x0, y0] = ISLE[i - 1], [x1, y1] = ISLE[i];
      for (let x = x0; x <= x1; x += 8) {
        const t = (x - x0) / (x1 - x0);
        this.gh[x >> 3] = lerp(y0, y1, t);
      }
    }
    // decorative palms & rocks
    this.palms = [];
    for (let i = 0; i < 14; i++) {
      const x = rand(3100, 9100);
      this.palms.push({ x, y: this.groundAt(x), s: rand(0.8, 1.3), lean: rand(-0.25, 0.25) });
    }
    // clouds
    this.clouds = [];
    for (let i = 0; i < 26; i++) {
      this.clouds.push({
        x: rand(-500, WORLD_W + 500), y: rand(-1900, -350),
        r: rand(40, 110), par: chance(0.5) ? 0.35 : 0.6, a: rand(0.5, 0.85)
      });
    }
    this.readConfig();
    this.resetWorld();
    // bindings
    this._onKey = this.onKey.bind(this);
    this._onKeyUp = e => { this.keys[e.code] = false; };
    this._onBlur = () => { this.keys = {}; this.wantTorp = false; if (this.state === 'playing') this.paused = true; };
    this._onResize = this.resize.bind(this);
    this._frame = this.frame.bind(this);
  }

  readConfig() {
    const gi = (n, d, lo, hi) => {
      const v = parseInt(this.host.getAttribute(n), 10);
      return isNaN(v) ? d : clamp(v, lo, hi);
    };
    const diff = { easy: 0.7, normal: 1, hard: 1.45 }[this.host.getAttribute('difficulty')] || 1;
    this.cfg = {
      waves: gi('waves', 5, 1, 12), lives: gi('lives', 4, 1, 9),
      diff, infFuel: this.host.getAttribute('inf-fuel') === 'true'
    };
  }

  start() {
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onBlur);
    this.resize();
    this._raf = requestAnimationFrame(this._frame);
  }
  destroy() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onBlur);
    try { this.audio.ctx && this.audio.ctx.close(); } catch (e) {}
  }
  resize() {
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.W = w; this.H = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = h / 980;
  }

  /* ------------------------------ world / reset --------------------------- */
  groundAt(x) {
    if (x < 2800 || x > 9400) return 0;
    return this.gh[clamp(x >> 3, 0, this.gh.length - 1)];
  }
  overIsland(x) { return x > 2810 && x < 9390; }

  resetWorld() {
    this.readConfig();
    this.score = 0;
    this.lives = this.cfg.lives;
    this.wave = 1;
    this.carrierHp = 100;
    this.carrierSinking = 0;
    this.fighters = []; this.bombers = [];
    this.pbullets = []; this.ebullets = [];
    this.bombs = []; this.rockets = []; this.torps = []; this.flaks = [];
    this.delayed = [];
    this.fx = { expl: [], debris: [], smoke: [], splash: [], spark: [], vapor: [] };
    this.ground = []; this.ships = [];
    this.banners = [];
    this.shakeMag = 0;
    this.waveTransition = 0;
    this.fighterBudget = 0; this.fighterTimer = 0;
    this.bomberTimer = 0;
    this.cvGunT = 0;
    this.waterT = 0;
    this.player = this.newPlane();
    this.cam = { x: 11250, y: -330 };
  }
  newPlane() {
    return {
      state: 'deck', // deck | takeoff | roll | fly | dead
      x: 11980, y: DECK_Y - 12, a: Math.PI, s: 0, vx: 0, vy: 0, vr: -1,
      hp: 100, fuel: FUEL_MAX,
      bombs: AMMO.bombs, rockets: AMMO.rockets, torps: AMMO.torps,
      heat: 0, jammed: false, gunT: 0, bombT: 0, rktT: 0,
      flipT: 0, flipDir: 0, deadT: 0, rearmT: 3, smokeT: 0, propT: 0
    };
  }
  beginGame() {
    this.resetWorld();
    this.keys = {}; this.wantTorp = false;
    this.state = 'playing';
    this.paused = false;
    this.spawnWave(1);
    this.banner('WAVE 1', 'Destroy all island targets and ships', 3.2);
  }

  spawnWave(n) {
    const g = this.ground = [];
    // slots across the island
    const slots = [];
    for (let x = 3150; x < 9150; x += 372) slots.push(x + rand(-70, 70));
    for (let i = slots.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const take = () => slots.pop() || rand(3200, 9000);
    const put = (type, hp, extra) => {
      const x = take();
      g.push(Object.assign({ type, x, y: this.groundAt(x), hp, maxHp: hp, alive: true, rot: rand(0, TAU), fireT: rand(0.5, 2), dirn: chance(0.5) ? 1 : -1, homeX: x }, extra));
    };
    const nAA = Math.min(2 + n, 7);
    for (let i = 0; i < nAA; i++) put('aa', 4);
    for (let i = 0; i < Math.min(1 + n, 4); i++) put('tank', 8, { armored: true });
    for (let i = 0; i < 2; i++) put('jeep', 2);
    for (let i = 0; i < Math.min(1 + (n >> 1), 3); i++) put('bunker', 12, { armored: true });
    for (let i = 0; i < 2; i++) put('fuel', 2);
    for (let i = 0; i < 2; i++) put('parked', 3);
    put('radar', 6);
    // ships offshore (left of island)
    this.ships = [];
    const nShips = Math.min(1 + ((n + 1) >> 1), 3);
    for (let i = 0; i < nShips; i++) {
      this.ships.push({
        x: 2150 - i * 700, y: 0, w: 190, hp: 26, maxHp: 26, alive: true,
        sink: 0, fireT: rand(1, 3), tilt: 0
      });
    }
    // air opposition
    const d = this.cfg.diff || 1;
    this.fighterBudget = Math.max(1, Math.round((2 + n * 2) * d));
    this.fighterMaxAlive = Math.min(1 + Math.ceil(n / 2), 3) + (d > 1.2 ? 1 : 0);
    this.fighterTimer = 6;
    this.bomberTimer = n >= (d < 1 ? 3 : 2) ? Math.round(16 / d) : 1e9;
    this.aaInterval = Math.max(1.9 - n * 0.12, 1.0) / d;
    this.aaSpeed = 460 + n * 18;
    this.ftrSpeed = Math.min(300 + n * 15, 400);
    this.ftrTurn = Math.min(1.55 + n * 0.09, 2.1);
  }
  primaryLeft() {
    let c = 0;
    for (const t of this.ground) if (t.alive) c++;
    for (const s of this.ships) if (s.alive) c++;
    return c;
  }

  /* --------------------------------- input -------------------------------- */
  onKey(e) {
    const c = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(c)) e.preventDefault();
    this.keys[c] = true;
    this.audio.ensure();
    if (c === 'KeyM') { this.audio.setMuted(!this.audio.muted); return; }
    if (c === 'KeyP' && this.state === 'playing') { this.paused = !this.paused; this.audio.click(); return; }
    if (c === 'Enter') {
      if (this.state === 'menu' || this.state === 'over' || this.state === 'win') {
        this.audio.click(); this.beginGame(); return;
      }
      if (this.state === 'playing' && this.paused) { this.paused = false; return; }
      const p = this.player;
      if (this.state === 'playing' && p.state === 'deck' && p.rearmT >= 2.6) {
        p.state = 'takeoff'; p.s = 0; p.a = Math.PI; this.audio.click();
      }
    }
    if (c === 'KeyF' && this.state === 'playing' && !this.paused) this.tryFlip();
    if ((c === 'KeyX' || c === 'KeyT') && !e.repeat && this.state === 'playing' && !this.paused) this.wantTorp = true;
  }
  tryFlip() {
    const p = this.player;
    if (p.state !== 'fly' || p.flipT > 0 || p.s < 135) return;
    const fwd = Math.cos(p.a) >= 0 ? 1 : -1;
    p.flipT = FLIP_DUR;
    p.flipDir = -fwd;
    this.audio.whoosh();
  }

  /* ------------------------------- main loop ------------------------------ */
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

  update(dt) {
    this.waterT += dt;
    for (const c of this.clouds) { c.x += dt * 4; if (c.x > WORLD_W + 600) c.x = -600; }
    for (const b of this.banners) b.t -= dt;
    this.banners = this.banners.filter(b => b.t > 0);
    this.shakeMag *= Math.pow(0.02, dt);

    if (this.state !== 'playing' || this.paused) {
      this.audio.updateEngine(0, 0, false, dt);
      this.updateFx(dt);
      return;
    }

    this.updatePlayer(dt);
    this.updateFighters(dt);
    this.updateBombers(dt);
    this.updateGround(dt);
    this.updateShips(dt);
    this.updateCarrier(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.updateCamera(dt);
    this.checkWave(dt);
  }

  /* --------------------------------- player ------------------------------- */
  updatePlayer(dt) {
    const p = this.player, k = this.keys;
    p.propT += dt * (8 + p.s * 0.05);

    if (p.state === 'dead') {
      p.deadT -= dt;
      this.audio.updateEngine(0, 0, false, dt);
      if (p.deadT <= 0) {
        if (this.lives <= 0) { this.state = 'over'; this.overReason = 'OUT OF PLANES'; this.saveBest(); }
        else if (this.carrierHp <= 0) { /* carrier handles game over */ }
        else { this.player = this.newPlane(); this.player.rearmT = 3; }
      }
      return;
    }

    if (p.state === 'deck') {
      p.rearmT += dt;
      const f = clamp(p.rearmT / 2.6, 0, 1);
      p.fuel = lerp(p.fuel, FUEL_MAX, dt * 2.5);
      p.hp = lerp(p.hp, 100, dt * 2.5);
      if (f >= 1) {
        p.fuel = FUEL_MAX; p.hp = 100;
        p.bombs = AMMO.bombs; p.rockets = AMMO.rockets; p.torps = AMMO.torps;
        p.heat = 0; p.jammed = false;
      }
      p.x = 11980; p.y = DECK_Y - 12; p.a = Math.PI; p.s = 0; p.vx = 0; p.vy = 0; p.vr = -1;
      this.audio.updateEngine(0.15, 0, true, dt);
      return;
    }

    if (p.state === 'takeoff') {
      p.s += 255 * dt;
      p.x -= p.s * dt;
      p.y = DECK_Y - 12; p.a = Math.PI;
      if (!this.cfg.infFuel) p.fuel -= 2 * dt;
      this.audio.updateEngine(1, p.s, true, dt);
      if (k.ArrowUp && p.s > 165) { p.state = 'fly'; p.a = wrapA(Math.PI + 0.12); }
      else if (p.x < CV.d0 + 10) {
        p.state = 'fly';
        p.a = wrapA(p.s >= 165 ? Math.PI + 0.08 : Math.PI - 0.05);
      }
      p.vx = Math.cos(p.a) * p.s; p.vy = Math.sin(p.a) * p.s;
      return;
    }

    if (p.state === 'roll') {
      const fwd = p.vx >= 0 ? 1 : -1;
      p.s = Math.max(0, p.s - 480 * dt);
      p.x += fwd * p.s * dt;
      p.y = DECK_Y - 12;
      this.audio.updateEngine(0.1, p.s, true, dt);
      if (p.x > CV.d1 + 4 || p.x < CV.d0 - 4) { p.state = 'fly'; p.a = fwd > 0 ? 0.1 : Math.PI - 0.1; return; }
      if (p.s < 22) { p.state = 'deck'; p.rearmT = 0; this.banner('REARMING', '', 1.4); }
      return;
    }

    /* ------ flying ------ */
    const fwd = Math.cos(p.a) >= 0 ? 1 : -1;
    let th = 0, br = 0;
    if ((k.ArrowRight && fwd > 0) || (k.ArrowLeft && fwd < 0)) th = 1;
    if ((k.ArrowRight && fwd < 0) || (k.ArrowLeft && fwd > 0)) br = 1;
    if (p.fuel <= 0) th = 0;

    if (p.flipT > 0) {
      p.flipT -= dt;
      p.a += (Math.PI / FLIP_DUR) * p.flipDir * dt;
      p.s = Math.max(p.s - 26 * dt, 90);
      if (chance(0.7)) this.fx.vapor.push({ x: p.x - Math.cos(p.a) * 14, y: p.y - Math.sin(p.a) * 14, r: rand(2, 5), life: 0.5, t: 0 });
    } else {
      const eff = clamp(p.s / 220, 0.35, 1);
      if (k.ArrowUp) p.a -= TURN * eff * fwd * dt;
      if (k.ArrowDown) p.a += TURN * eff * fwd * dt;
    }
    p.a = wrapA(p.a);

    // speed integration
    p.s += (th * THRUST - br * 230) * dt;
    p.s += GRAV * Math.sin(p.a) * 0.8 * dt;
    p.s -= (0.0016 * p.s * p.s + 14) * dt;
    p.s = clamp(p.s, 0, MAXS);
    // stall
    if (p.s < STALL && p.flipT <= 0) {
      p.a = rotTo(p.a, Math.PI / 2, (1.8 * (1 - p.s / STALL)) * dt);
    }
    p.vx = Math.cos(p.a) * p.s;
    p.vy = Math.sin(p.a) * p.s;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 40, WORLD_W - 40);
    if (p.y < -2400) p.y = -2400;

    if (!this.cfg.infFuel) p.fuel -= (2.2 + th * 3.4) * dt;
    if (p.fuel < 0) p.fuel = 0;

    // roll visual
    const targetVr = fwd > 0 ? 1 : -1;
    p.vr = lerp(p.vr, targetVr, clamp(dt * 7, 0, 1));

    // guns
    p.heat = Math.max(0, p.heat - 30 * dt);
    if (p.jammed && p.heat < 40) p.jammed = false;
    p.gunT -= dt; p.bombT -= dt; p.rktT -= dt;
    if (k.Space && !p.jammed && p.gunT <= 0) {
      p.gunT = 0.075;
      p.heat += 7.5;
      if (p.heat >= 100) { p.jammed = true; }
      const sp = 900;
      const mx = p.x + Math.cos(p.a) * 20, my = p.y + Math.sin(p.a) * 20;
      this.pbullets.push({
        x: mx, y: my,
        vx: p.vx + Math.cos(p.a + rand(-0.02, 0.02)) * sp,
        vy: p.vy + Math.sin(p.a + rand(-0.02, 0.02)) * sp,
        life: 0.9, dmg: 1
      });
      this.audio.gun();
      p.muzzle = 0.05;
    }
    p.muzzle = Math.max(0, (p.muzzle || 0) - dt);
    if (k.KeyB && p.bombT <= 0 && p.bombs > 0) {
      p.bombT = 0.32; p.bombs--;
      this.bombs.push({ x: p.x, y: p.y + 10, vx: p.vx, vy: p.vy + 30, hostile: false });
      this.audio.click();
    }
    if (k.KeyR && p.rktT <= 0 && p.rockets > 0) {
      p.rktT = 0.26; p.rockets--;
      this.rockets.push({
        x: p.x + Math.cos(p.a) * 16, y: p.y + Math.sin(p.a) * 16 + 6,
        vx: p.vx + Math.cos(p.a) * 380, vy: p.vy + Math.sin(p.a) * 380,
        a: p.a, life: 2.2
      });
      this.audio.whoosh();
    }
    if (this.wantTorp) {
      this.wantTorp = false;
      if (p.torps > 0 && !p.torpT) {
        p.torpT = 0.5; p.torps--;
        this.torps.push({ x: p.x, y: p.y + 12, vx: p.vx, vy: p.vy + 20, water: false, life: 10 });
        this.audio.click();
      }
    }
    if (p.torpT) { p.torpT -= dt; if (p.torpT <= 0) p.torpT = 0; }

    // damage smoke
    if (p.hp < 40) {
      p.smokeT -= dt;
      if (p.smokeT <= 0) {
        p.smokeT = 0.06;
        this.addSmoke(p.x - Math.cos(p.a) * 16, p.y - Math.sin(p.a) * 16, rand(3, 6));
      }
    }

    this.audio.updateEngine(th, p.s, p.fuel > 0, dt);

    /* collisions: deck, terrain, water */
    const onDeckX = p.x > CV.d0 - 6 && p.x < CV.d1 + 6;
    if (onDeckX && this.carrierHp > 0 && p.y >= DECK_Y - 14 && p.vy >= -15) {
      const level = Math.abs(Math.sin(p.a)) < 0.4;
      if (p.vy < 175 && p.s < 265 && level && p.flipT <= 0) {
        // touchdown
        p.state = 'roll'; p.y = DECK_Y - 12;
        p.vx = Math.cos(p.a) * p.s; p.vy = 0;
        this.addSpark(p.x, p.y + 10, 4);
        this.audio.splash(false);
      } else {
        this.crashPlane('deck');
      }
      return;
    }
    if (this.overIsland(p.x)) {
      if (p.y > this.groundAt(p.x) - 10) { this.crashPlane('ground'); return; }
    } else if (p.y > -8 && !onDeckX) {
      this.crashPlane('water'); return;
    }
  }

  crashPlane(where) {
    const p = this.player;
    if (p.state === 'dead') return;
    p.state = 'dead'; p.deadT = 1.9;
    this.lives--;
    if (where === 'water') {
      this.addSplash(p.x, 0, true);
      this.audio.splash(true);
    } else {
      this.addExplosion(p.x, p.y, 1.3);
      this.audio.boom(1.4);
    }
    this.addDebris(p.x, p.y, 10, '#3e5a77');
    this.shake(14);
    if (this.lives > 0) this.banner('PLANE LOST', this.lives + (this.lives === 1 ? ' plane' : ' planes') + ' remaining', 2.2);
  }

  /* ------------------------------- fighters ------------------------------- */
  updateFighters(dt) {
    const p = this.player;
    // spawning
    if (this.fighterBudget > 0 && !this.waveTransition) {
      this.fighterTimer -= dt;
      const alive = this.fighters.length;
      if (this.fighterTimer <= 0 && alive < this.fighterMaxAlive) {
        this.fighterBudget--;
        this.fighterTimer = Math.max(9 - this.wave * 0.5, 5);
        const side = chance(0.6) ? 1 : -1;
        const x = clamp(p.x + side * rand(1400, 1900), 400, WORLD_W - 200);
        this.fighters.push({
          x, y: rand(-700, -350), a: side > 0 ? Math.PI : 0, s: this.ftrSpeed,
          hp: 4, fireT: rand(0.5, 1.5), state: 'pursue', stateT: 0, vr: 1, smokeT: 0
        });
      }
    }
    for (let i = this.fighters.length - 1; i >= 0; i--) {
      const f = this.fighters[i];
      f.stateT -= dt;
      const engaging = p.state === 'fly' && !this.waveTransition && !f.flee;
      let tx, ty;
      if (f.flee) { tx = f.x + 800; ty = -1600; }
      else if (!engaging) { tx = 6300 + Math.cos(this.t * 0.3) * 1400; ty = -520; }
      else { tx = p.x + p.vx * 0.35; ty = p.y + p.vy * 0.35; }
      const dx = tx - f.x, dy = ty - f.y;
      const dist = Math.hypot(dx, dy);
      let desired = Math.atan2(dy, dx);
      if (f.state === 'extend') desired = f.extendA;
      // ground avoidance
      const gy = this.overIsland(f.x) ? this.groundAt(f.x) : 0;
      if (f.y > gy - 130) desired = Math.cos(f.a) >= 0 ? -0.7 : Math.PI + 0.7;
      f.a = rotTo(f.a, desired, this.ftrTurn * dt);
      f.a = wrapA(f.a);
      f.s = lerp(f.s, this.ftrSpeed, dt * 0.8);
      f.x += Math.cos(f.a) * f.s * dt;
      f.y += Math.sin(f.a) * f.s * dt;
      f.vr = lerp(f.vr, Math.cos(f.a) >= 0 ? 1 : -1, clamp(dt * 6, 0, 1));

      if (engaging && f.state === 'pursue' && dist < 130) {
        f.state = 'extend'; f.stateT = 1.6; f.extendA = f.a;
      }
      if (f.state === 'extend' && f.stateT <= 0) f.state = 'pursue';

      // fire
      f.fireT -= dt;
      if (engaging && f.fireT <= 0 && dist < 560) {
        const aimA = Math.atan2(p.y - f.y, p.x - f.x);
        if (Math.abs(wrapA(aimA - f.a)) < 0.28) {
          f.fireT = rand(1.1, 1.9);
          for (let b = 0; b < 4; b++) {
            this.ebullets.push({
              x: f.x, y: f.y, delay: b * 0.09,
              vx: Math.cos(f.a + rand(-0.04, 0.04)) * 780 + Math.cos(f.a) * 100,
              vy: Math.sin(f.a + rand(-0.04, 0.04)) * 780,
              life: 1.0, dmg: 5
            });
          }
          this.audio.enemyGun();
        }
      }
      // collisions
      if (f.hp < 2) {
        f.smokeT -= dt;
        if (f.smokeT <= 0) { f.smokeT = 0.08; this.addSmoke(f.x, f.y, rand(3, 5)); }
      }
      const groundY = this.overIsland(f.x) ? this.groundAt(f.x) : 0;
      if (f.y > groundY - 8) {
        this.killFighter(i, true);
        continue;
      }
      // midair with player
      if (p.state === 'fly' && Math.hypot(f.x - p.x, f.y - p.y) < 26) {
        this.damagePlayer(65, 'collision');
        this.killFighter(i, false);
        continue;
      }
      if (f.flee && (f.y < -1500 || f.x < 100)) this.fighters.splice(i, 1);
    }
  }
  killFighter(i, terrain) {
    const f = this.fighters[i];
    this.addExplosion(f.x, f.y, 1);
    this.addDebris(f.x, f.y, 7, '#5f6247');
    this.audio.boom(1);
    this.score += SCORE.fighter;
    this.fighters.splice(i, 1);
  }

  /* -------------------------------- bombers ------------------------------- */
  updateBombers(dt) {
    if (!this.waveTransition) {
      this.bomberTimer -= dt;
      if (this.bomberTimer <= 0) {
        this.bomberTimer = Math.max(34 - this.wave * 2, 22);
        const n = 1 + (this.wave >= 4 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          this.bombers.push({
            x: 100 - i * 260, y: rand(-470, -390), vx: 138,
            hp: 12, dropped: 0, dropT: 0, smokeT: 0
          });
        }
        this.banner('BOMBERS INBOUND', 'Defend the carrier!', 2.6);
      }
    }
    for (let i = this.bombers.length - 1; i >= 0; i--) {
      const b = this.bombers[i];
      b.x += b.vx * dt;
      b.dropT -= dt;
      if (b.dropped < 3 && Math.abs(b.x - CV.cx) < 300 && b.dropT <= 0) {
        b.dropped++; b.dropT = 0.38;
        this.bombs.push({ x: b.x, y: b.y + 14, vx: b.vx + rand(-14, 14), vy: 40, hostile: true });
      }
      if (b.hp < 5) {
        b.smokeT -= dt;
        if (b.smokeT <= 0) { b.smokeT = 0.07; this.addSmoke(b.x + rand(-14, 14), b.y, rand(4, 6)); }
      }
      if (b.x > WORLD_W + 300) this.bombers.splice(i, 1);
    }
  }

  /* --------------------------- ground & ships AI --------------------------- */
  updateGround(dt) {
    const p = this.player;
    for (const t of this.ground) {
      if (!t.alive) continue;
      if (t.type === 'radar') t.rot += dt * 1.4;
      if (t.type === 'jeep' || t.type === 'tank') {
        const v = t.type === 'jeep' ? 46 : 16;
        t.x += t.dirn * v * dt;
        if (Math.abs(t.x - t.homeX) > 130 || t.x < 3020 || t.x > 9240) {
          t.x = clamp(t.x, 3020, 9240);
          t.dirn *= -1;
        }
        t.y = this.groundAt(t.x);
      }
      if (t.type === 'aa' && p.state === 'fly') {
        const gx = t.x, gy = t.y - 12;
        const dx = p.x - gx, dy = p.y - gy;
        const d = Math.hypot(dx, dy);
        t.aim = Math.atan2(dy, dx);
        t.fireT -= dt;
        if (d < 950 && t.fireT <= 0) {
          t.fireT = this.aaInterval + rand(0, 0.5);
          const lead = d / this.aaSpeed;
          const ax = p.x + p.vx * lead - gx, ay = p.y + p.vy * lead - gy;
          const aa = Math.atan2(ay, ax);
          for (let b = 0; b < 3; b++) {
            const sp = this.aaSpeed;
            this.ebullets.push({
              x: gx, y: gy, delay: b * 0.1,
              vx: Math.cos(aa + rand(-0.05, 0.05)) * sp,
              vy: Math.sin(aa + rand(-0.05, 0.05)) * sp,
              life: 2.1, dmg: 7
            });
          }
          this.audio.enemyGun();
        }
      }
    }
    // delayed secondary explosions
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i];
      d.t -= dt;
      if (d.t <= 0) {
        this.addExplosion(d.x, d.y, d.size);
        this.blast(d.x, d.y, d.r, d.dmg, true, false);
        this.audio.boom(d.size);
        this.delayed.splice(i, 1);
      }
    }
  }

  updateShips(dt) {
    const p = this.player;
    for (let i = this.ships.length - 1; i >= 0; i--) {
      const s = this.ships[i];
      if (!s.alive) {
        s.sink += dt;
        s.tilt = lerp(s.tilt, 0.25, dt);
        s.y += dt * 14;
        if (chance(0.3)) this.addSmoke(s.x + rand(-60, 60), -10, rand(4, 8));
        if (s.sink > 4) this.ships.splice(i, 1);
        continue;
      }
      if (this.wave >= 2 && p.state === 'fly') {
        s.fireT -= dt;
        const d = Math.hypot(p.x - s.x, p.y + 30);
        if (d < 1100 && s.fireT <= 0) {
          s.fireT = 2.4 - Math.min(this.wave * 0.15, 1);
          const tt = d / 600;
          this.flaks.push({
            x: s.x, y: -34,
            tx: p.x + p.vx * tt + rand(-60, 60), ty: p.y + p.vy * tt + rand(-40, 40),
            t: 0, dur: tt
          });
        }
      }
    }
  }

  updateCarrier(dt) {
    if (this.carrierHp <= 0) {
      this.carrierSinking += dt;
      if (chance(0.4)) this.addSmoke(rand(CV.x0, CV.x1), DECK_Y + rand(0, 20) + this.carrierSinking * 12, rand(6, 12));
      if (chance(0.2)) this.addSplash(rand(CV.x0, CV.x1), 0, false);
      if (this.carrierSinking > 3.2 && this.state === 'playing') {
        this.state = 'over'; this.overReason = 'CARRIER LOST'; this.saveBest();
      }
      return;
    }
    if (this.carrierHp < 50 && chance(0.25)) this.addSmoke(rand(CV.cx - 80, CV.cx + 120), DECK_Y, rand(4, 8));
    // defensive gun on the tower
    this.cvGunT -= dt;
    if (this.cvGunT <= 0) {
      this.cvGunT = 0.14;
      let best = null, bd = 820;
      for (const b of this.bombers) { const d = Math.hypot(b.x - 11522, b.y - DECK_Y); if (d < bd) { bd = d; best = b; } }
      if (!best) for (const f of this.fighters) { const d = Math.hypot(f.x - 11522, f.y - DECK_Y); if (d < bd) { bd = d; best = f; } }
      if (best) {
        const a = Math.atan2(best.y - (DECK_Y - 40), best.x - 11522) + rand(-0.09, 0.09);
        this.pbullets.push({ x: 11522, y: DECK_Y - 40, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, life: 1.1, dmg: 0.5, cv: true });
      }
    }
  }

  /* ------------------------------ projectiles ------------------------------ */
  updateProjectiles(dt) {
    const p = this.player;

    // player bullets
    for (let i = this.pbullets.length - 1; i >= 0; i--) {
      const b = this.pbullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) {
        const gy = this.overIsland(b.x) ? this.groundAt(b.x) : 0;
        if (b.y > gy) {
          if (gy === 0) this.addSplash(b.x, 0, false); else this.addSpark(b.x, gy, 2);
          dead = true;
        }
      }
      if (!dead) {
        // ground targets
        for (const t of this.ground) {
          if (!t.alive) continue;
          const hw = t.type === 'bunker' ? 30 : 22, hh = t.type === 'radar' ? 52 : 24;
          if (Math.abs(b.x - t.x) < hw && b.y > t.y - hh && b.y < t.y + 6) {
            if (t.armored) { this.addSpark(b.x, b.y, 3); }
            else { t.hp -= b.dmg; this.addSpark(b.x, b.y, 3); if (t.hp <= 0) this.destroyTarget(t); }
            dead = true; break;
          }
        }
      }
      if (!dead) for (let j = this.fighters.length - 1; j >= 0; j--) {
        const f = this.fighters[j];
        if (Math.hypot(b.x - f.x, b.y - f.y) < 20) {
          f.hp -= b.dmg; this.addSpark(b.x, b.y, 2); dead = true;
          if (f.hp <= 0) this.killFighter(j, false);
          break;
        }
      }
      if (!dead) for (let j = this.bombers.length - 1; j >= 0; j--) {
        const bo = this.bombers[j];
        if (Math.abs(b.x - bo.x) < 34 && Math.abs(b.y - bo.y) < 14) {
          bo.hp -= b.dmg; this.addSpark(b.x, b.y, 2); dead = true;
          if (bo.hp <= 0) {
            this.addExplosion(bo.x, bo.y, 1.4);
            this.addDebris(bo.x, bo.y, 9, '#5f6247');
            this.audio.boom(1.5);
            this.score += SCORE.bomber;
            this.bombers.splice(j, 1);
          }
          break;
        }
      }
      if (!dead) for (const s of this.ships) {
        if (s.alive && Math.abs(b.x - s.x) < s.w / 2 && b.y > -46 && b.y < 2) {
          this.addSpark(b.x, b.y, 3); dead = true; break;
        }
      }
      if (dead) this.pbullets.splice(i, 1);
    }

    // enemy bullets
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      if (b.delay > 0) { b.delay -= dt; continue; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0;
      if (!dead) {
        const gy = this.overIsland(b.x) ? this.groundAt(b.x) : 0;
        if (b.y > gy) { if (gy === 0) this.addSplash(b.x, 0, false); dead = true; }
      }
      if (!dead && p.state === 'fly' && Math.hypot(b.x - p.x, b.y - p.y) < 16) {
        this.damagePlayer(b.dmg, 'gunfire');
        this.addSpark(b.x, b.y, 3);
        dead = true;
      }
      if (dead) this.ebullets.splice(i, 1);
    }

    // bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.vy += GRAV * dt;
      b.vx *= (1 - 0.25 * dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      let boom = false;
      const gy = this.overIsland(b.x) ? this.groundAt(b.x) : 0;
      // carrier hit (enemy bombs only)
      if (b.hostile && b.x > CV.x0 && b.x < CV.x1 && b.y >= DECK_Y - 4 && this.carrierHp > 0) {
        this.carrierHp = Math.max(0, this.carrierHp - 16);
        this.addExplosion(b.x, DECK_Y, 1.3);
        this.audio.boom(1.6); this.shake(12);
        // player parked on deck caught in blast
        if (p.state !== 'fly' && p.state !== 'dead' && Math.abs(p.x - b.x) < 90) this.damagePlayer(50, 'bomb');
        if (this.carrierHp <= 0) this.banner('CARRIER SINKING', '', 3);
        else if (this.carrierHp <= 40) this.banner('CARRIER CRITICAL', 'Hull at ' + Math.round(this.carrierHp) + '%', 2);
        this.bombs.splice(i, 1); continue;
      }
      // ships (player bombs)
      if (!b.hostile) {
        let hitShip = false;
        for (const s of this.ships) {
          if (s.alive && Math.abs(b.x - s.x) < s.w / 2 && b.y > -40) {
            this.damageShip(s, 16); boom = true; hitShip = true; break;
          }
        }
        if (hitShip) {
          this.addExplosion(b.x, b.y, 1.5); this.audio.boom(1.7); this.shake(8);
          this.bombs.splice(i, 1); continue;
        }
      }
      if (b.y >= gy) boom = true;
      if (boom) {
        if (gy === 0 && !this.overIsland(b.x)) {
          this.addSplash(b.x, 0, true); this.audio.splash(true);
          this.blast(b.x, 0, 60, 10, !b.hostile, false);
        } else {
          this.addExplosion(b.x, gy, 1.6);
          this.audio.boom(1.8); this.shake(9);
          this.blast(b.x, gy, 84, 16, !b.hostile, false);
        }
        this.bombs.splice(i, 1);
      }
    }

    // rockets
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.vy += GRAV * 0.25 * dt;
      r.x += r.vx * dt; r.y += r.vy * dt; r.life -= dt;
      r.a = Math.atan2(r.vy, r.vx);
      if (chance(0.8)) this.fx.vapor.push({ x: r.x - Math.cos(r.a) * 10, y: r.y - Math.sin(r.a) * 10, r: rand(1.5, 3), life: 0.3, t: 0 });
      let hit = r.life <= 0;
      const gy = this.overIsland(r.x) ? this.groundAt(r.x) : 0;
      if (r.y >= gy) hit = true;
      if (!hit) {
        for (const t of this.ground) {
          if (t.alive && Math.abs(r.x - t.x) < 26 && r.y > t.y - 30 && r.y < t.y + 6) { hit = true; break; }
        }
        if (!hit) for (const s of this.ships) {
          if (s.alive && Math.abs(r.x - s.x) < s.w / 2 && r.y > -44) { this.damageShip(s, 4); hit = true; break; }
        }
        if (!hit) for (let j = this.bombers.length - 1; j >= 0; j--) {
          const bo = this.bombers[j];
          if (Math.abs(r.x - bo.x) < 36 && Math.abs(r.y - bo.y) < 16) {
            bo.hp -= 8; hit = true;
            if (bo.hp <= 0) {
              this.addExplosion(bo.x, bo.y, 1.4); this.audio.boom(1.5);
              this.score += SCORE.bomber; this.bombers.splice(j, 1);
            }
            break;
          }
        }
      }
      if (hit) {
        if (gy === 0 && !this.overIsland(r.x) && r.y >= -4) { this.addSplash(r.x, 0, false); this.audio.splash(false); }
        else { this.addExplosion(r.x, Math.min(r.y, gy), 0.9); this.audio.boom(0.9); this.shake(4); }
        this.blast(r.x, r.y, 46, 8, true, false);
        this.rockets.splice(i, 1);
      }
    }

    // torpedoes
    for (let i = this.torps.length - 1; i >= 0; i--) {
      const tp = this.torps[i];
      tp.life -= dt;
      if (!tp.water) {
        tp.vy += GRAV * 0.5 * dt;
        tp.x += tp.vx * dt; tp.y += tp.vy * dt;
        const gy = this.overIsland(tp.x) ? this.groundAt(tp.x) : 0;
        if (this.overIsland(tp.x) && tp.y >= gy) {
          this.addExplosion(tp.x, gy, 0.9); this.audio.boom(1);
          this.blast(tp.x, gy, 50, 8, true, false);
          this.torps.splice(i, 1); continue;
        }
        if (tp.y >= 0) {
          if (Math.abs(tp.vy) < 300) {
            tp.water = true; tp.y = 4; tp.vy = 0;
            tp.vx = (tp.vx >= 0 ? 1 : -1) * 225;
            this.addSplash(tp.x, 0, false); this.audio.splash(false);
          } else {
            this.addSplash(tp.x, 0, true); this.audio.splash(true);
            this.torps.splice(i, 1); continue;
          }
        }
      } else {
        tp.x += tp.vx * dt;
        if (chance(0.9)) this.fx.vapor.push({ x: tp.x - (tp.vx > 0 ? 12 : -12), y: -1, r: rand(1.5, 3.5), life: 0.5, t: 0 });
        let hit = false;
        for (const s of this.ships) {
          if (s.alive && Math.abs(tp.x - s.x) < s.w / 2 + 6) { this.damageShip(s, 30); hit = true; break; }
        }
        if (this.overIsland(tp.x)) hit = true;
        if (hit) {
          this.addExplosion(tp.x, -8, 2); this.addSplash(tp.x, 0, true);
          this.audio.boom(2.2); this.shake(12);
          this.torps.splice(i, 1); continue;
        }
      }
      if (tp.life <= 0) this.torps.splice(i, 1);
    }

    // flak shells
    for (let i = this.flaks.length - 1; i >= 0; i--) {
      const f = this.flaks[i];
      f.t += dt;
      const q = clamp(f.t / f.dur, 0, 1);
      f.cx = lerp(f.x, f.tx, q); f.cy = lerp(f.y, f.ty, q);
      if (q >= 1) {
        this.addExplosion(f.tx, f.ty, 0.55, true);
        this.audio.flak();
        if (p.state === 'fly') {
          const d = Math.hypot(p.x - f.tx, p.y - f.ty);
          if (d < 56) this.damagePlayer(16 * (1 - d / 56) + 5, 'flak');
        }
        this.flaks.splice(i, 1);
      }
    }
  }

  damagePlayer(dmg, why) {
    const p = this.player;
    if (p.state === 'dead') return;
    p.hp -= dmg;
    p.hitFlash = 0.15;
    this.shake(Math.min(dmg * 0.4, 8));
    if (p.hp <= 0) this.crashPlane(why === 'water' ? 'water' : 'air');
  }
  damageShip(s, dmg) {
    if (!s.alive) return;
    s.hp -= dmg;
    if (s.hp <= 0) {
      s.alive = false; s.sink = 0;
      this.addExplosion(s.x, -24, 2.2);
      this.addDebris(s.x, -24, 12, '#6b7280');
      this.audio.boom(2.4); this.shake(10);
      this.score += SCORE.ship;
    }
  }
  destroyTarget(t) {
    if (!t.alive) return;
    t.alive = false;
    const size = t.type === 'fuel' ? 1.8 : t.type === 'bunker' || t.type === 'radar' ? 1.4 : 1;
    this.addExplosion(t.x, t.y - 8, size);
    this.addDebris(t.x, t.y - 8, 8, '#57534e');
    this.audio.boom(size); this.shake(6);
    this.score += SCORE[t.type] || 100;
    if (t.type === 'fuel') {
      for (let i = 1; i <= 3; i++) {
        this.delayed.push({ x: t.x + rand(-40, 40), y: t.y - rand(0, 20), t: i * 0.22, size: rand(1, 1.6), r: 70, dmg: 8 });
      }
    }
  }
  blast(x, y, r, dmg, fromPlayer, hitsCarrier) {
    for (const t of this.ground) {
      if (!t.alive) continue;
      const d = Math.hypot(t.x - x, t.y - 10 - y);
      if (d < r + 18) {
        const f = clamp(1.5 * (1 - d / (r + 18)), 0, 1);
        t.hp -= dmg * f;
        if (t.hp <= 0) this.destroyTarget(t);
      }
    }
    for (const s of this.ships) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - x, -20 - y);
      if (d < r + s.w / 2) this.damageShip(s, dmg * 0.6);
    }
    for (let j = this.fighters.length - 1; j >= 0; j--) {
      const f = this.fighters[j];
      if (Math.hypot(f.x - x, f.y - y) < r) { this.killFighter(j, false); }
    }
    const p = this.player;
    if (p.state === 'fly') {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r) this.damagePlayer(40 * (1 - d / r), 'blast');
    }
  }

  /* ------------------------------- wave logic ------------------------------ */
  checkWave(dt) {
    if (this.state !== 'playing') return;
    if (this.waveTransition > 0) {
      this.waveTransition -= dt;
      if (this.waveTransition <= 0) {
        if (this.wave >= this.cfg.waves) {
          this.state = 'win';
          this.score += this.lives * 400;
          this.saveBest();
        } else {
          this.wave++;
          this.spawnWave(this.wave);
          this.banner('WAVE ' + this.wave, this.wave === this.cfg.waves ? 'Final wave — give them everything' : 'Resistance is stiffening', 3);
        }
      }
      return;
    }
    if (this.primaryLeft() === 0) {
      this.waveTransition = 4;
      for (const f of this.fighters) f.flee = true;
      this.banner(this.wave >= this.cfg.waves ? 'ALL WAVES CLEARED' : 'WAVE ' + this.wave + ' CLEARED', this.wave >= this.cfg.waves ? '' : 'Land on the carrier to rearm', 3.4);
      this.audio.click();
    }
  }
  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { localStorage.setItem('sky-fury-best', String(this.best)); } catch (e) {}
    }
  }
  banner(text, sub, dur) { this.banners.push({ text, sub, t: dur, dur }); }
  shake(m) { this.shakeMag = Math.min(this.shakeMag + m, 26); }

  /* ---------------------------------- fx ----------------------------------- */
  addExplosion(x, y, size, flak) {
    this.fx.expl.push({ x, y, t: 0, dur: 0.55 + size * 0.2, size, flak: !!flak });
    if (!flak) {
      for (let i = 0; i < 5 * size; i++) this.addSmoke(x + rand(-14, 14) * size, y + rand(-14, 6) * size, rand(4, 9) * size);
    }
  }
  addDebris(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0), sp = rand(80, 320);
      this.fx.debris.push({
        x, y, vx: Math.cos(a) * sp + rand(-40, 40), vy: Math.sin(a) * sp,
        rot: rand(0, TAU), vr: rand(-8, 8), life: rand(0.7, 1.6), w: rand(2, 6), color
      });
    }
  }
  addSmoke(x, y, r) {
    this.fx.smoke.push({ x, y, r, vy: rand(-28, -12), vx: rand(-8, 8), life: rand(0.8, 1.7), t: 0 });
  }
  addSplash(x, y, big) {
    const n = big ? 16 : 6;
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.85, -Math.PI * 0.15), sp = big ? rand(90, 300) : rand(50, 140);
      this.fx.splash.push({ x: x + rand(-8, 8), y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.5, 1.1), r: rand(1.5, 4) });
    }
    if (big) this.fx.expl.push({ x, y: -4, t: 0, dur: 0.5, size: 1, water: true });
  }
  addSpark(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(40, 180);
      this.fx.spark.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rand(0.15, 0.4) });
    }
  }
  updateFx(dt) {
    const fx = this.fx;
    for (let i = fx.expl.length - 1; i >= 0; i--) {
      const e = fx.expl[i]; e.t += dt;
      if (e.t > e.dur) fx.expl.splice(i, 1);
    }
    for (let i = fx.debris.length - 1; i >= 0; i--) {
      const d = fx.debris[i];
      d.vy += GRAV * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.life -= dt;
      if (d.y > 0 && !this.overIsland(d.x)) { if (chance(0.4)) this.addSplash(d.x, 0, false); d.life = 0; }
      if (d.life <= 0) fx.debris.splice(i, 1);
    }
    for (let i = fx.smoke.length - 1; i >= 0; i--) {
      const s = fx.smoke[i];
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 14;
      if (s.t > s.life) fx.smoke.splice(i, 1);
    }
    for (let i = fx.splash.length - 1; i >= 0; i--) {
      const s = fx.splash[i];
      s.vy += GRAV * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || s.y > 4) fx.splash.splice(i, 1);
    }
    for (let i = fx.spark.length - 1; i >= 0; i--) {
      const s = fx.spark[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) fx.spark.splice(i, 1);
    }
    for (let i = fx.vapor.length - 1; i >= 0; i--) {
      const v = fx.vapor[i];
      v.t += dt; v.r += dt * 8;
      if (v.t > v.life) fx.vapor.splice(i, 1);
    }
  }

  /* -------------------------------- camera --------------------------------- */
  updateCamera(dt) {
    const p = this.player;
    const viewH = this.H / this.scale, viewW = this.W / this.scale;
    const fwd = Math.cos(p.a) >= 0 ? 1 : -1;
    let tx = p.x + (p.state === 'fly' ? fwd * viewW * 0.16 : -viewW * 0.22);
    let ty = Math.min(p.y, -viewH * 0.34);
    if (p.state === 'dead') { tx = this.cam.x; ty = this.cam.y; }
    const f = clamp(dt * 3.2, 0, 1);
    this.cam.x = lerp(this.cam.x, tx, f);
    this.cam.y = lerp(this.cam.y, ty, f);
  }

  /* ================================= DRAW ================================== */
  draw() {
    const ctx = this.ctx, W = this.W, H = this.H, sc = this.scale;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const shX = (Math.random() * 2 - 1) * this.shakeMag * 0.6;
    const shY = (Math.random() * 2 - 1) * this.shakeMag * 0.6;
    const camX = this.cam.x + shX, camY = this.cam.y + shY;
    this.sx = wx => (wx - camX) * sc + W / 2;
    this.sy = wy => (wy - camY) * sc + H / 2;

    this.drawSky(ctx, camY);
    this.drawFar(ctx, camX, camY);
    this.drawClouds(ctx, camX, camY);
    this.drawSea(ctx, camX, camY);
    this.drawIsland(ctx);
    this.drawTargets(ctx);
    this.drawShips(ctx);
    this.drawCarrier(ctx);
    this.drawProjectiles(ctx);
    this.drawAircraft(ctx);
    this.drawFx(ctx);

    if (this.state === 'menu') this.drawMenu(ctx);
    else {
      this.drawHUD(ctx);
      this.drawBanners(ctx);
      if (this.state === 'over' || this.state === 'win') this.drawEnd(ctx);
      else if (this.paused) this.drawPause(ctx);
    }
  }

  drawSky(ctx, camY) {
    const H = this.H, W = this.W;
    const alt = clamp(-camY / 2200, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${lerp(96, 40, alt) | 0},${lerp(166, 90, alt) | 0},${lerp(214, 160, alt) | 0})`);
    g.addColorStop(0.7, '#a8d4e6');
    g.addColorStop(1, '#cfe6ee');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // sun
    const sx = W * 0.78, sy = H * 0.16 + camY * 0.02;
    const rg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
    rg.addColorStop(0, 'rgba(255,246,214,0.95)');
    rg.addColorStop(0.3, 'rgba(255,240,190,0.45)');
    rg.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(sx, sy, 90, 0, TAU); ctx.fill();
  }
  drawFar(ctx, camX, camY) {
    // distant island silhouettes, low parallax
    const sc = this.scale;
    const horizon = (0 - camY * 0.2) * sc + this.H / 2;
    ctx.fillStyle = 'rgba(120,158,180,0.45)';
    for (let i = 0; i < 3; i++) {
      const bx = ((2500 + i * 4200) - camX * 0.15) * sc + this.W / 2;
      const w = 620 * sc, h = (60 + i * 26) * sc;
      ctx.beginPath();
      ctx.moveTo(bx - w, horizon);
      ctx.quadraticCurveTo(bx, horizon - h * 2, bx + w, horizon);
      ctx.fill();
    }
  }
  drawClouds(ctx, camX, camY) {
    const sc = this.scale;
    for (const c of this.clouds) {
      const x = (c.x - camX * c.par) * sc + this.W / 2;
      const y = (c.y - camY * c.par) * sc + this.H / 2;
      const r = c.r * sc;
      if (x < -r * 3 || x > this.W + r * 3) continue;
      ctx.fillStyle = `rgba(255,255,255,${c.a * 0.75})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.62, 0, TAU);
      ctx.arc(x - r * 0.7, y + r * 0.18, r * 0.45, 0, TAU);
      ctx.arc(x + r * 0.72, y + r * 0.15, r * 0.5, 0, TAU);
      ctx.fill();
    }
  }
  drawSea(ctx, camX, camY) {
    const seaY = this.sy(0);
    if (seaY > this.H) return;
    const g = ctx.createLinearGradient(0, seaY, 0, this.H);
    g.addColorStop(0, '#1e6f8f');
    g.addColorStop(0.4, '#155d7c');
    g.addColorStop(1, '#0c3f58');
    ctx.fillStyle = g;
    ctx.fillRect(0, seaY, this.W, this.H - seaY);
    // shimmering highlight bands
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = Math.max(1, this.scale * 1.4);
    for (let band = 0; band < 4; band++) {
      const wy = 14 + band * 26;
      const y = this.sy(wy);
      if (y > this.H) break;
      ctx.beginPath();
      const phase = this.waterT * (18 + band * 7) + band * 200;
      for (let x = 0; x <= this.W; x += 26) {
        const wob = Math.sin((x + camX * this.scale) * 0.02 + phase * 0.06) * 2;
        if (x === 0) ctx.moveTo(x, y + wob); else ctx.lineTo(x, y + wob);
      }
      ctx.stroke();
    }
    // horizon line
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, seaY, this.W, Math.max(1, this.scale));
  }
  drawIsland(ctx) {
    const sc = this.scale;
    const x0 = this.sx(ISLE[0][0]);
    if (this.sx(ISLE[ISLE.length - 1][0]) < -50 || x0 > this.W + 50) return;
    // land mass
    ctx.beginPath();
    ctx.moveTo(this.sx(2800), this.sy(30));
    for (const [x, y] of ISLE) ctx.lineTo(this.sx(x), this.sy(y));
    ctx.lineTo(this.sx(9400), this.sy(30));
    ctx.closePath();
    const g = ctx.createLinearGradient(0, this.sy(-210), 0, this.sy(30));
    g.addColorStop(0, '#7a9455');
    g.addColorStop(0.35, '#8a7d4e');
    g.addColorStop(1, '#b09a63');
    ctx.fillStyle = g;
    ctx.fill();
    // grass lip
    ctx.strokeStyle = '#5f7f45';
    ctx.lineWidth = 4 * sc;
    ctx.beginPath();
    for (let i = 0; i < ISLE.length; i++) {
      const [x, y] = ISLE[i];
      if (i === 0) ctx.moveTo(this.sx(x), this.sy(y)); else ctx.lineTo(this.sx(x), this.sy(y));
    }
    ctx.stroke();
    // palms
    for (const pl of this.palms) {
      const x = this.sx(pl.x), y = this.sy(pl.y);
      if (x < -40 || x > this.W + 40) continue;
      const s = pl.s * sc;
      ctx.strokeStyle = '#6d5433';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + pl.lean * 22 * s, y - 20 * s, x + pl.lean * 36 * s, y - 34 * s);
      ctx.stroke();
      const tx = x + pl.lean * 36 * s, ty = y - 34 * s;
      ctx.strokeStyle = '#4c7a3d';
      ctx.lineWidth = 2.4 * s;
      for (let f = 0; f < 5; f++) {
        const a = -Math.PI * 0.15 - f * 0.35 + pl.lean;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * 12 * s, ty + Math.sin(a) * 12 * s - 4 * s, tx + Math.cos(a) * 20 * s, ty + Math.sin(a) * 20 * s + 3 * s);
        ctx.stroke();
      }
    }
  }

  /* -------- carrier & ships -------- */
  drawCarrier(ctx) {
    const sc = this.scale;
    const x0 = this.sx(CV.x0), x1 = this.sx(CV.x1);
    if (x1 < -60 || x0 > this.W + 60) return;
    const sink = this.carrierSinking * 16;
    const dy = this.sy(sink);
    const deckY = this.sy(DECK_Y + sink);
    const bob = Math.sin(this.waterT * 0.8) * 1.5 * sc;
    ctx.save();
    ctx.translate(0, bob);
    if (this.carrierSinking) ctx.transform(1, 0.02 * this.carrierSinking, 0, 1, 0, 0);
    // hull
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.moveTo(x0, deckY);
    ctx.lineTo(x1, deckY);
    ctx.lineTo(x1 - 26 * sc, this.sy(10 + sink));
    ctx.lineTo(x0 + 40 * sc, this.sy(10 + sink));
    ctx.closePath();
    ctx.fill();
    // hull shading + waterline stripe
    ctx.fillStyle = '#374151';
    ctx.fillRect(x0 + 34 * sc, this.sy(-6 + sink), (CV.x1 - CV.x0 - 56) * sc, 8 * sc);
    // deck
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(this.sx(CV.d0), deckY - 5 * sc, (CV.d1 - CV.d0) * sc, 6 * sc);
    // deck stripes
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let x = CV.d0 + 30; x < CV.d1 - 20; x += 60) {
      ctx.fillRect(this.sx(x), deckY - 2.4 * sc, 26 * sc, 1.6 * sc);
    }
    // island tower (background, no collision)
    ctx.fillStyle = '#525c6b';
    ctx.fillRect(this.sx(11488), this.sy(DECK_Y - 44 + sink), 66 * sc, 40 * sc);
    ctx.fillStyle = '#414a57';
    ctx.fillRect(this.sx(11500), this.sy(DECK_Y - 62 + sink), 34 * sc, 20 * sc);
    // rotating radar bar
    ctx.save();
    ctx.translate(this.sx(11517), this.sy(DECK_Y - 66 + sink));
    ctx.rotate(this.waterT * 2);
    ctx.strokeStyle = '#2d3540';
    ctx.lineWidth = 2 * sc;
    ctx.beginPath(); ctx.moveTo(-10 * sc, 0); ctx.lineTo(10 * sc, 0); ctx.stroke();
    ctx.restore();
    // windows
    ctx.fillStyle = '#b6c6d4';
    for (let i = 0; i < 4; i++) ctx.fillRect(this.sx(11494 + i * 15), this.sy(DECK_Y - 38 + sink), 8 * sc, 4 * sc);
    // bow number
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = fnt(Math.max(9, 11 * sc), 800);
    ctx.textAlign = 'center';
    ctx.fillText('7', this.sx(CV.x1 - 60), this.sy(-2 + sink));
    ctx.restore();
    // wake foam
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x0 + 20 * sc, this.sy(0), (CV.x1 - CV.x0 - 40) * sc, 2.4 * sc);
  }
  drawShips(ctx) {
    const sc = this.scale;
    for (const s of this.ships) {
      const x = this.sx(s.x);
      if (x < -200 || x > this.W + 200) continue;
      ctx.save();
      ctx.translate(x, this.sy(s.y));
      if (!s.alive) ctx.rotate(s.tilt);
      const w = s.w * sc;
      // hull
      ctx.fillStyle = '#5b6672';
      ctx.beginPath();
      ctx.moveTo(-w / 2, -14 * sc);
      ctx.lineTo(w / 2, -14 * sc);
      ctx.lineTo(w / 2 - 16 * sc, 8 * sc);
      ctx.lineTo(-w / 2 + 12 * sc, 8 * sc);
      ctx.closePath(); ctx.fill();
      // superstructure
      ctx.fillStyle = '#6e7a87';
      ctx.fillRect(-30 * sc, -34 * sc, 52 * sc, 20 * sc);
      ctx.fillRect(-12 * sc, -46 * sc, 22 * sc, 12 * sc);
      // mast
      ctx.strokeStyle = '#3f4a55';
      ctx.lineWidth = 2 * sc;
      ctx.beginPath(); ctx.moveTo(0, -46 * sc); ctx.lineTo(0, -62 * sc); ctx.stroke();
      // turrets
      ctx.fillStyle = '#48525d';
      ctx.fillRect(-w / 2 + 20 * sc, -22 * sc, 18 * sc, 8 * sc);
      ctx.fillRect(w / 2 - 42 * sc, -22 * sc, 18 * sc, 8 * sc);
      ctx.restore();
      if (s.alive) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x - w / 2, this.sy(0), w, 2 * sc);
      }
    }
  }

  /* -------- ground targets -------- */
  drawTargets(ctx) {
    const sc = this.scale;
    for (const t of this.ground) {
      const x = this.sx(t.x), y = this.sy(t.y);
      if (x < -80 || x > this.W + 80) continue;
      if (!t.alive) {
        // scorch + wreck
        ctx.fillStyle = 'rgba(30,25,20,0.55)';
        ctx.beginPath(); ctx.ellipse(x, y, 22 * sc, 5 * sc, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a3733';
        ctx.fillRect(x - 8 * sc, y - 6 * sc, 16 * sc, 6 * sc);
        continue;
      }
      ctx.save();
      ctx.translate(x, y);
      const s = sc;
      switch (t.type) {
        case 'aa': {
          ctx.fillStyle = '#7d7458';
          ctx.beginPath(); ctx.ellipse(0, 0, 18 * s, 6 * s, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#4d4a3a';
          ctx.fillRect(-7 * s, -12 * s, 14 * s, 10 * s);
          const a = t.aim != null ? t.aim : -Math.PI / 3;
          ctx.strokeStyle = '#33312a';
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.moveTo(0, -12 * s);
          ctx.lineTo(Math.cos(a) * 20 * s, -12 * s + Math.sin(a) * 20 * s);
          ctx.stroke();
          break;
        }
        case 'tank': {
          ctx.fillStyle = '#4f5744';
          ctx.beginPath();
          ctx.moveTo(-18 * s, -6 * s); ctx.lineTo(18 * s, -6 * s);
          ctx.lineTo(14 * s, 0); ctx.lineTo(-14 * s, 0);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#3c4234';
          for (let w = -12; w <= 12; w += 6) { ctx.beginPath(); ctx.arc(w * s, -2 * s, 2.4 * s, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#5a6350';
          ctx.fillRect(-8 * s, -13 * s, 14 * s, 7 * s);
          ctx.strokeStyle = '#3c4234';
          ctx.lineWidth = 2 * s;
          ctx.beginPath(); ctx.moveTo(4 * s, -10 * s); ctx.lineTo(18 * s * t.dirn, -12 * s); ctx.stroke();
          break;
        }
        case 'jeep': {
          ctx.fillStyle = '#6a6446';
          ctx.fillRect(-10 * s, -8 * s, 20 * s, 6 * s);
          ctx.fillRect(-4 * s, -12 * s, 8 * s, 4 * s);
          ctx.fillStyle = '#2e2b22';
          ctx.beginPath(); ctx.arc(-6 * s, -1.4 * s, 2.6 * s, 0, TAU); ctx.arc(6 * s, -1.4 * s, 2.6 * s, 0, TAU); ctx.fill();
          break;
        }
        case 'bunker': {
          ctx.fillStyle = '#8b8778';
          ctx.beginPath(); ctx.ellipse(0, 0, 26 * s, 18 * s, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#2d2b25';
          ctx.fillRect(-12 * s, -10 * s, 24 * s, 4 * s);
          break;
        }
        case 'fuel': {
          ctx.fillStyle = '#8a5c3c';
          ctx.fillRect(-20 * s, -16 * s, 12 * s, 16 * s);
          ctx.fillRect(-4 * s, -20 * s, 12 * s, 20 * s);
          ctx.fillRect(12 * s, -13 * s, 10 * s, 13 * s);
          ctx.fillStyle = '#a06f4a';
          ctx.beginPath();
          ctx.ellipse(-14 * s, -16 * s, 6 * s, 2.4 * s, 0, 0, TAU);
          ctx.ellipse(2 * s, -20 * s, 6 * s, 2.4 * s, 0, 0, TAU);
          ctx.ellipse(17 * s, -13 * s, 5 * s, 2 * s, 0, 0, TAU);
          ctx.fill();
          break;
        }
        case 'parked': {
          ctx.save();
          ctx.scale(t.dirn, 1);
          this.paintPlane(ctx, 0.9 * s, '#6a6f4d', '#585c40', true);
          ctx.restore();
          break;
        }
        case 'radar': {
          ctx.strokeStyle = '#4a4a44';
          ctx.lineWidth = 2.6 * s;
          ctx.beginPath();
          ctx.moveTo(-9 * s, 0); ctx.lineTo(0, -40 * s); ctx.lineTo(9 * s, 0);
          ctx.moveTo(-6 * s, -14 * s); ctx.lineTo(6 * s, -14 * s);
          ctx.moveTo(-4 * s, -27 * s); ctx.lineTo(4 * s, -27 * s);
          ctx.stroke();
          ctx.save();
          ctx.translate(0, -46 * s);
          ctx.rotate(Math.sin(t.rot) * 0.9);
          ctx.fillStyle = '#5b6b70';
          ctx.fillRect(-12 * s, -3 * s, 24 * s, 6 * s);
          ctx.restore();
          break;
        }
      }
      ctx.restore();
      // damage bar for tough armored targets
      if (t.armored && t.hp < t.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x - 14 * sc, y - 30 * sc, 28 * sc, 3 * sc);
        ctx.fillStyle = '#e8b84a';
        ctx.fillRect(x - 14 * sc, y - 30 * sc, 28 * sc * clamp(t.hp / t.maxHp, 0, 1), 3 * sc);
      }
    }
  }

  /* -------- aircraft painting -------- */
  paintPlane(ctx, s, body, dark, parked) {
    // nose points +x. s = pixel scale.
    ctx.lineJoin = 'round';
    // tailplane
    ctx.fillStyle = dark;
    ctx.fillRect(-17 * s, -1.6 * s, 6 * s, 3.2 * s);
    // fin
    ctx.beginPath();
    ctx.moveTo(-17 * s, 0);
    ctx.lineTo(-13 * s, -9 * s);
    ctx.lineTo(-9 * s, -9 * s);
    ctx.lineTo(-8 * s, 0);
    ctx.closePath(); ctx.fill();
    // fuselage
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-16 * s, 0);
    ctx.quadraticCurveTo(-6 * s, -5.4 * s, 6 * s, -4.6 * s);
    ctx.quadraticCurveTo(15 * s, -4 * s, 16 * s, 0);
    ctx.quadraticCurveTo(15 * s, 4 * s, 6 * s, 4.4 * s);
    ctx.quadraticCurveTo(-6 * s, 5 * s, -16 * s, 0);
    ctx.closePath(); ctx.fill();
    // wing (side view)
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(-7 * s, 1 * s);
    ctx.lineTo(7 * s, 0.4 * s);
    ctx.lineTo(6 * s, 3.6 * s);
    ctx.lineTo(-8 * s, 3.4 * s);
    ctx.closePath(); ctx.fill();
    // cowl
    ctx.fillStyle = '#2b2f36';
    ctx.beginPath();
    ctx.moveTo(11 * s, -4 * s);
    ctx.lineTo(16 * s, -3.4 * s);
    ctx.lineTo(16 * s, 3.4 * s);
    ctx.lineTo(11 * s, 4 * s);
    ctx.closePath(); ctx.fill();
    // canopy
    ctx.fillStyle = 'rgba(200,230,245,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -4.6 * s);
    ctx.quadraticCurveTo(3 * s, -7.6 * s, 7 * s, -4.4 * s);
    ctx.closePath(); ctx.fill();
    if (parked) {
      // idle prop blade
      ctx.strokeStyle = '#26292e';
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath(); ctx.moveTo(17 * s, -8 * s); ctx.lineTo(17 * s, 8 * s); ctx.stroke();
    }
  }
  drawAircraft(ctx) {
    const sc = this.scale, p = this.player;
    // player
    if (p.state !== 'dead') {
      const x = this.sx(p.x), y = this.sy(p.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.a);
      const vr = clamp(p.vr, -1, 1);
      ctx.scale(1, Math.abs(vr) < 0.18 ? (vr < 0 ? -0.18 : 0.18) : vr);
      const s = 1.15 * sc;
      this.paintPlane(ctx, s, p.hitFlash > 0 ? '#8fb6dd' : '#3e6285', '#31506e', false);
      // roundel
      ctx.fillStyle = '#e8edf2';
      ctx.beginPath(); ctx.arc(-6 * s, -0.5 * s, 2.6 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#31506e';
      ctx.beginPath(); ctx.arc(-6 * s, -0.5 * s, 1.2 * s, 0, TAU); ctx.fill();
      // spinning prop disc
      if (p.fuel > 0) {
        ctx.fillStyle = 'rgba(220,230,235,0.28)';
        ctx.beginPath(); ctx.ellipse(17.5 * s, 0, 2.2 * s, 12 * s, 0, 0, TAU); ctx.fill();
      }
      // muzzle flash
      if (p.muzzle > 0) {
        ctx.fillStyle = 'rgba(255,220,120,0.9)';
        ctx.beginPath();
        ctx.moveTo(19 * s, -2 * s); ctx.lineTo(26 * s, 0); ctx.lineTo(19 * s, 2 * s);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      if (p.hitFlash > 0) p.hitFlash -= 1 / 60;
    }
    // fighters
    for (const f of this.fighters) {
      const x = this.sx(f.x), y = this.sy(f.y);
      if (x < -80 || x > this.W + 80) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(f.a);
      const vr = clamp(f.vr, -1, 1);
      ctx.scale(1, Math.abs(vr) < 0.18 ? (vr < 0 ? -0.18 : 0.18) : vr);
      const s = 1.05 * sc;
      this.paintPlane(ctx, s, '#77754f', '#5f5e3f', false);
      ctx.fillStyle = '#c8452e';
      ctx.beginPath(); ctx.arc(-6 * s, -0.5 * s, 2.4 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(220,230,235,0.25)';
      ctx.beginPath(); ctx.ellipse(17.5 * s, 0, 2 * s, 11 * s, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // bombers
    for (const b of this.bombers) {
      const x = this.sx(b.x), y = this.sy(b.y);
      if (x < -120 || x > this.W + 120) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(-1, 1); // flying left
      const s = 1.1 * sc;
      ctx.fillStyle = '#5e6247';
      // fuselage
      ctx.beginPath();
      ctx.moveTo(-30 * s, 0);
      ctx.quadraticCurveTo(-10 * s, -7 * s, 18 * s, -5 * s);
      ctx.quadraticCurveTo(30 * s, -3 * s, 31 * s, 0);
      ctx.quadraticCurveTo(28 * s, 5 * s, 10 * s, 6 * s);
      ctx.quadraticCurveTo(-12 * s, 7 * s, -30 * s, 0);
      ctx.closePath(); ctx.fill();
      // wing
      ctx.fillStyle = '#4d5139';
      ctx.fillRect(-12 * s, -1 * s, 26 * s, 4.4 * s);
      // engines
      ctx.fillStyle = '#33362a';
      ctx.fillRect(-4 * s, -2 * s, 8 * s, 7 * s);
      ctx.fillRect(9 * s, -2 * s, 7 * s, 6 * s);
      // fin
      ctx.fillStyle = '#4d5139';
      ctx.beginPath();
      ctx.moveTo(-30 * s, 0); ctx.lineTo(-25 * s, -12 * s); ctx.lineTo(-19 * s, -12 * s); ctx.lineTo(-17 * s, 0);
      ctx.closePath(); ctx.fill();
      // canopy
      ctx.fillStyle = 'rgba(200,230,245,0.85)';
      ctx.fillRect(18 * s, -5 * s, 8 * s, 4 * s);
      // roundel
      ctx.fillStyle = '#c8452e';
      ctx.beginPath(); ctx.arc(-10 * s, 0, 3 * s, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /* -------- projectiles & fx -------- */
  drawProjectiles(ctx) {
    const sc = this.scale;
    ctx.lineCap = 'round';
    // player tracers
    ctx.strokeStyle = '#eaf6ff';
    ctx.lineWidth = 2.2 * sc;
    ctx.beginPath();
    for (const b of this.pbullets) {
      const x = this.sx(b.x), y = this.sy(b.y);
      ctx.moveTo(x, y);
      ctx.lineTo(x - b.vx * 0.016 * sc, y - b.vy * 0.016 * sc);
    }
    ctx.stroke();
    // enemy tracers
    ctx.strokeStyle = '#ffce7a';
    ctx.lineWidth = 2.4 * sc;
    ctx.beginPath();
    for (const b of this.ebullets) {
      if (b.delay > 0) continue;
      const x = this.sx(b.x), y = this.sy(b.y);
      ctx.moveTo(x, y);
      ctx.lineTo(x - b.vx * 0.02 * sc, y - b.vy * 0.02 * sc);
    }
    ctx.stroke();
    // bombs
    ctx.fillStyle = '#2f3640';
    for (const b of this.bombs) {
      const x = this.sx(b.x), y = this.sy(b.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.beginPath();
      ctx.ellipse(0, 0, 7 * sc, 3 * sc, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-9 * sc, -2.4 * sc, 3 * sc, 4.8 * sc);
      ctx.restore();
    }
    // rockets
    for (const r of this.rockets) {
      const x = this.sx(r.x), y = this.sy(r.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r.a);
      ctx.fillStyle = '#d8dde2';
      ctx.fillRect(-6 * sc, -1.6 * sc, 12 * sc, 3.2 * sc);
      ctx.fillStyle = '#ffb54a';
      ctx.beginPath();
      ctx.moveTo(-6 * sc, 0); ctx.lineTo(-12 * sc, 0);
      ctx.lineWidth = 2.6 * sc; ctx.strokeStyle = 'rgba(255,180,74,0.9)'; ctx.stroke();
      ctx.restore();
    }
    // torpedoes
    for (const t of this.torps) {
      const x = this.sx(t.x), y = this.sy(t.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t.water ? 0 : Math.atan2(t.vy, t.vx));
      ctx.fillStyle = '#3a4750';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11 * sc, 2.8 * sc, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (t.water) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x - (t.vx > 0 ? 30 : -6) * sc, this.sy(-1), 24 * sc, 1.6 * sc);
      }
    }
    // flak shells in flight
    ctx.fillStyle = '#ffdf9e';
    for (const f of this.flaks) {
      if (f.cx == null) continue;
      ctx.beginPath();
      ctx.arc(this.sx(f.cx), this.sy(f.cy), 2.2 * sc, 0, TAU);
      ctx.fill();
    }
  }
  drawFx(ctx) {
    const sc = this.scale, fx = this.fx;
    // vapor
    for (const v of fx.vapor) {
      const q = 1 - v.t / v.life;
      ctx.fillStyle = `rgba(240,248,252,${0.5 * q})`;
      ctx.beginPath();
      ctx.arc(this.sx(v.x), this.sy(v.y), v.r * sc, 0, TAU);
      ctx.fill();
    }
    // smoke
    for (const s of fx.smoke) {
      const q = 1 - s.t / s.life;
      ctx.fillStyle = `rgba(70,70,74,${0.4 * q})`;
      ctx.beginPath();
      ctx.arc(this.sx(s.x), this.sy(s.y), s.r * sc, 0, TAU);
      ctx.fill();
    }
    // explosions
    for (const e of fx.expl) {
      const q = clamp(e.t / e.dur, 0, 1);
      const x = this.sx(e.x), y = this.sy(e.y);
      const r = (e.flak ? 20 : 40) * e.size * (0.3 + q * 0.9) * sc;
      if (e.water) {
        ctx.fillStyle = `rgba(230,245,250,${0.7 * (1 - q)})`;
        ctx.beginPath();
        ctx.ellipse(x, this.sy(0), r * 1.2, r * 0.5, 0, Math.PI, 0);
        ctx.fill();
        continue;
      }
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      if (e.flak) {
        g.addColorStop(0, `rgba(60,60,66,${0.85 * (1 - q)})`);
        g.addColorStop(1, 'rgba(60,60,66,0)');
      } else {
        g.addColorStop(0, `rgba(255,255,240,${0.95 * (1 - q * 0.6)})`);
        g.addColorStop(0.3, `rgba(255,190,80,${0.9 * (1 - q)})`);
        g.addColorStop(0.7, `rgba(230,90,40,${0.7 * (1 - q)})`);
        g.addColorStop(1, 'rgba(60,50,50,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      if (!e.flak && q < 0.5) {
        ctx.strokeStyle = `rgba(255,240,210,${0.6 * (1 - q * 2)})`;
        ctx.lineWidth = 2 * sc;
        ctx.beginPath(); ctx.arc(x, y, r * 1.5 * (0.5 + q), 0, TAU); ctx.stroke();
      }
    }
    // debris
    for (const d of fx.debris) {
      ctx.save();
      ctx.translate(this.sx(d.x), this.sy(d.y));
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w * sc / 2, -d.w * sc / 3, d.w * sc, d.w * sc * 0.66);
      ctx.restore();
    }
    // splashes
    ctx.fillStyle = 'rgba(235,248,252,0.85)';
    for (const s of fx.splash) {
      ctx.beginPath();
      ctx.arc(this.sx(s.x), this.sy(s.y), s.r * sc, 0, TAU);
      ctx.fill();
    }
    // sparks
    ctx.fillStyle = '#ffd873';
    for (const s of fx.spark) {
      ctx.fillRect(this.sx(s.x) - sc, this.sy(s.y) - sc, 2 * sc, 2 * sc);
    }
  }

  /* --------------------------------- HUD ----------------------------------- */
  drawHUD(ctx) {
    const W = this.W, H = this.H, p = this.player;
    const pad = 14;
    ctx.textBaseline = 'alphabetic';

    // ---- top-left: score ----
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(10,25,38,0.55)';
    this.rr(ctx, pad, pad, 168, 54, 10); ctx.fill();
    ctx.fillStyle = '#cfe4f2';
    ctx.font = fnt(12, 700);
    ctx.fillText('SCORE', pad + 12, pad + 20);
    ctx.fillStyle = '#fff';
    ctx.font = fnt(24, 800);
    ctx.fillText(String(this.score), pad + 12, pad + 44);

    // ---- top-center: wave + objective ----
    const tgt = this.primaryLeft();
    ctx.fillStyle = 'rgba(10,25,38,0.55)';
    this.rr(ctx, W / 2 - 130, pad, 260, 54, 10); ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cfe4f2';
    ctx.font = fnt(12, 700);
    ctx.fillText('WAVE ' + this.wave + ' / ' + this.cfg.waves, W / 2, pad + 20);
    ctx.fillStyle = tgt === 0 ? '#8fe3a1' : '#fff';
    ctx.font = fnt(20, 800);
    ctx.fillText(tgt === 0 ? 'AREA SECURED' : tgt + ' TARGETS LEFT', W / 2, pad + 44);

    // ---- top-right: planes remaining ----
    ctx.fillStyle = 'rgba(10,25,38,0.55)';
    this.rr(ctx, W - pad - 168, pad, 168, 54, 10); ctx.fill();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cfe4f2';
    ctx.font = fnt(12, 700);
    ctx.fillText('PLANES', W - pad - 12, pad + 20);
    for (let i = 0; i < this.cfg.lives; i++) {
      const x = W - pad - 20 - i * 24, y = pad + 38;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = i < this.lives ? 1 : 0.22;
      this.paintPlane(ctx, 0.55, '#9fc3e0', '#7ba3c4', false);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ---- bottom-left: fuel / heat / ammo ----
    const by = H - 96;
    ctx.fillStyle = 'rgba(10,25,38,0.55)';
    this.rr(ctx, pad, by, 250, 82, 10); ctx.fill();
    ctx.textAlign = 'left';
    // fuel
    const fFrac = clamp(p.fuel / FUEL_MAX, 0, 1);
    ctx.fillStyle = '#cfe4f2'; ctx.font = fnt(11, 700);
    ctx.fillText('FUEL', pad + 12, by + 18);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.rr(ctx, pad + 56, by + 9, 180, 10, 5); ctx.fill();
    ctx.fillStyle = fFrac < 0.25 ? (Math.sin(this.t * 8) > 0 ? '#f0644a' : '#a8432f') : '#7fd0e8';
    if (fFrac > 0.01) { this.rr(ctx, pad + 56, by + 9, 180 * fFrac, 10, 5); ctx.fill(); }
    // heat
    ctx.fillStyle = '#cfe4f2';
    ctx.fillText('GUNS', pad + 12, by + 36);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.rr(ctx, pad + 56, by + 27, 180, 10, 5); ctx.fill();
    ctx.fillStyle = p.jammed ? '#f0644a' : '#e8b84a';
    if (p.heat > 1) { this.rr(ctx, pad + 56, by + 27, 180 * clamp(p.heat / 100, 0, 1), 10, 5); ctx.fill(); }
    if (p.jammed) {
      ctx.fillStyle = '#f0644a'; ctx.font = fnt(10, 800);
      ctx.fillText('OVERHEATED', pad + 160, by + 36);
    }
    // ammo
    ctx.font = fnt(15, 800);
    ctx.fillStyle = p.bombs ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.fillText('B ' + p.bombs, pad + 12, by + 66);
    ctx.fillStyle = p.rockets ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.fillText('R ' + p.rockets, pad + 76, by + 66);
    ctx.fillStyle = p.torps ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.fillText('X ' + p.torps, pad + 148, by + 66);
    ctx.fillStyle = 'rgba(207,228,242,0.6)'; ctx.font = fnt(10, 700);
    ctx.fillText('BOMB', pad + 12, by + 78);
    ctx.fillText('RKT', pad + 76, by + 78);
    ctx.fillText('TORP', pad + 148, by + 78);

    // ---- bottom-right: alt/spd + carrier ----
    ctx.fillStyle = 'rgba(10,25,38,0.55)';
    this.rr(ctx, W - pad - 250, by, 250, 82, 10); ctx.fill();
    ctx.textAlign = 'left';
    const alt = Math.max(0, Math.round(-p.y - 12));
    const spd = Math.round(p.s);
    ctx.fillStyle = '#cfe4f2'; ctx.font = fnt(11, 700);
    ctx.fillText('ALT', W - pad - 238, by + 22);
    ctx.fillText('SPD', W - pad - 238, by + 46);
    ctx.fillStyle = '#fff'; ctx.font = fnt(18, 800);
    ctx.fillText(String(alt), W - pad - 200, by + 22);
    ctx.fillText(String(spd), W - pad - 200, by + 46);
    // carrier status
    ctx.fillStyle = '#cfe4f2'; ctx.font = fnt(11, 700);
    ctx.fillText('CARRIER', W - pad - 130, by + 22);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.rr(ctx, W - pad - 130, by + 28, 118, 10, 5); ctx.fill();
    const chp = clamp(this.carrierHp / 100, 0, 1);
    ctx.fillStyle = chp > 0.5 ? '#8fe3a1' : chp > 0.25 ? '#e8b84a' : '#f0644a';
    if (chp > 0.01) { this.rr(ctx, W - pad - 130, by + 28, 118 * chp, 10, 5); ctx.fill(); }
    ctx.fillStyle = 'rgba(207,228,242,0.7)'; ctx.font = fnt(11, 700);
    ctx.fillText(this.carrierHp <= 0 ? 'SINKING' : 'Hull ' + Math.round(this.carrierHp) + '%', W - pad - 130, by + 56);
    // plane hp mini-bar
    ctx.fillText('AIRFRAME', W - pad - 238, by + 66);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.rr(ctx, W - pad - 238, by + 70, 96, 8, 4); ctx.fill();
    const php = clamp(p.hp / 100, 0, 1);
    ctx.fillStyle = php > 0.5 ? '#8fe3a1' : php > 0.25 ? '#e8b84a' : '#f0644a';
    if (php > 0.01) { this.rr(ctx, W - pad - 238, by + 70, 96 * php, 8, 4); ctx.fill(); }

    // ---- bottom-center: key hints ----
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,242,250,0.55)';
    ctx.font = fnt(12, 700);
    ctx.fillText('←→ thrust · ↑↓ pitch · F flip · SPACE guns · B/R/X ordnance · P pause', W / 2, H - 12);

    // ---- deck prompts ----
    if (p.state === 'deck') {
      const ready = p.rearmT >= 2.6;
      ctx.font = fnt(22, 800);
      ctx.fillStyle = ready ? '#8fe3a1' : '#e8b84a';
      ctx.fillText(ready ? 'ENTER — TAKE OFF' : 'REARMING…', W / 2, H * 0.62);
      if (!ready) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        this.rr(ctx, W / 2 - 90, H * 0.62 + 12, 180, 8, 4); ctx.fill();
        ctx.fillStyle = '#e8b84a';
        this.rr(ctx, W / 2 - 90, H * 0.62 + 12, 180 * clamp(p.rearmT / 2.6, 0, 1), 8, 4); ctx.fill();
      }
    }
    // ---- landing approach helper ----
    if (p.state === 'fly' && this.carrierHp > 0) {
      const d = Math.hypot(p.x - CV.cx, p.y - DECK_Y);
      if (d < 700 && p.y < DECK_Y + 10) {
        const slowOk = p.s < 265, sinkOk = p.vy < 175 && p.vy > -40, levelOk = Math.abs(Math.sin(p.a)) < 0.4;
        ctx.font = fnt(13, 800);
        const cy = H * 0.30;
        const items = [['SLOW', slowOk], ['LEVEL', levelOk], ['SINK', sinkOk]];
        items.forEach((it, i) => {
          ctx.fillStyle = it[1] ? '#8fe3a1' : '#f0644a';
          ctx.fillText((it[1] ? '● ' : '○ ') + it[0], W / 2 + (i - 1) * 84, cy);
        });
      }
    }
    // low fuel warning
    if (p.state === 'fly' && fFrac < 0.22 && Math.sin(this.t * 6) > 0) {
      ctx.font = fnt(18, 800);
      ctx.fillStyle = '#f0644a';
      ctx.fillText(p.fuel <= 0 ? 'FUEL EXHAUSTED — GLIDE HOME' : 'LOW FUEL — RETURN TO CARRIER', W / 2, H * 0.24);
    }
  }

  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  drawBanners(ctx) {
    const W = this.W, H = this.H;
    for (const b of this.banners) {
      const q = clamp(b.t / b.dur, 0, 1);
      const a = q > 0.85 ? (1 - q) / 0.15 : q < 0.25 ? q / 0.25 : 1;
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(8,20,32,0.6)';
      const w = Math.max(340, b.text.length * 26 + 80);
      this.rr(ctx, W / 2 - w / 2, H * 0.36 - 40, w, b.sub ? 86 : 62, 12); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = fnt(34, 800);
      ctx.fillText(b.text, W / 2, H * 0.36 + 4);
      if (b.sub) {
        ctx.fillStyle = '#a9cde2';
        ctx.font = fnt(16, 700);
        ctx.fillText(b.sub, W / 2, H * 0.36 + 32);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawMenu(ctx) {
    const W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(7,18,30,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    // title
    ctx.fillStyle = '#0b2233';
    ctx.font = fnt(Math.min(86, W * 0.11), 900);
    ctx.fillText('SKY FURY', W / 2 + 3, H * 0.26 + 3);
    ctx.fillStyle = '#f4f9fc';
    ctx.fillText('SKY FURY', W / 2, H * 0.26);
    ctx.fillStyle = '#a9cde2';
    ctx.font = fnt(17, 700);
    ctx.fillText('Carrier strikes in the Pacific — clear ' + this.cfg.waves + ' island waves', W / 2, H * 0.26 + 34);

    // controls card
    const cw = Math.min(520, W - 40), cx = W / 2 - cw / 2, cy = H * 0.36;
    ctx.fillStyle = 'rgba(8,20,32,0.72)';
    this.rr(ctx, cx, cy, cw, 240, 14); ctx.fill();
    const rows = [
      ['← →', 'Thrust & brake along your facing'],
      ['↑ ↓', 'Climb / dive'],
      ['F', 'Flip — half-loop to reverse for a strafing pass'],
      ['SPACE', 'Machine guns (watch the heat)'],
      ['B / R / X', 'Bombs · Rockets · Torpedo (limited)'],
      ['ENTER', 'Take off from the deck'],
      ['', 'Land low, slow & level on the carrier to rearm']
    ];
    ctx.textAlign = 'left';
    rows.forEach((r, i) => {
      const y = cy + 34 + i * 30;
      ctx.fillStyle = '#7fd0e8';
      ctx.font = fnt(15, 800);
      ctx.fillText(r[0], cx + 26, y);
      ctx.fillStyle = '#dcebf5';
      ctx.font = fnt(15, 600);
      ctx.fillText(r[1], cx + 118, y);
    });
    // start prompt
    ctx.textAlign = 'center';
    const pulse = 0.6 + Math.sin(this.t * 4) * 0.4;
    ctx.fillStyle = `rgba(143,227,161,${pulse})`;
    ctx.font = fnt(24, 800);
    ctx.fillText('PRESS ENTER TO TAKE OFF', W / 2, cy + 240 + 46);
    ctx.fillStyle = 'rgba(220,235,245,0.5)';
    ctx.font = fnt(13, 600);
    const bestStr = this.best > 0 ? 'Best score ' + this.best + ' · ' : '';
    ctx.fillText(bestStr + 'M mute · P pause', W / 2, cy + 240 + 74);
  }

  drawPause(ctx) {
    const W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(7,18,30,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = fnt(42, 800);
    ctx.fillText('PAUSED', W / 2, H / 2 - 8);
    ctx.fillStyle = '#a9cde2';
    ctx.font = fnt(16, 700);
    ctx.fillText('P or ENTER to resume', W / 2, H / 2 + 26);
  }

  drawEnd(ctx) {
    const W = this.W, H = this.H;
    ctx.fillStyle = 'rgba(7,18,30,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const win = this.state === 'win';
    ctx.fillStyle = win ? '#8fe3a1' : '#f0644a';
    ctx.font = fnt(52, 900);
    ctx.fillText(win ? 'VICTORY' : 'MISSION FAILED', W / 2, H * 0.4);
    ctx.fillStyle = '#dcebf5';
    ctx.font = fnt(19, 700);
    ctx.fillText(win ? 'All ' + this.cfg.waves + ' waves cleared. The island is ours.' : this.overReason, W / 2, H * 0.4 + 36);
    ctx.fillStyle = '#fff';
    ctx.font = fnt(28, 800);
    ctx.fillText('SCORE  ' + this.score, W / 2, H * 0.4 + 84);
    if (this.score >= this.best && this.score > 0) {
      ctx.fillStyle = '#e8b84a';
      ctx.font = fnt(15, 800);
      ctx.fillText('NEW BEST', W / 2, H * 0.4 + 110);
    }
    const pulse = 0.6 + Math.sin(this.t * 4) * 0.4;
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.font = fnt(20, 800);
    ctx.fillText('ENTER — FLY AGAIN', W / 2, H * 0.4 + 156);
  }
}

/* ------------------------------ web component ----------------------------- */
class SkyFury extends HTMLElement {
  static get observedAttributes() { return ['waves', 'lives', 'difficulty', 'inf-fuel']; }
  connectedCallback() {
    if (this._booted) return;
    this._booted = true;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      ':host{position:fixed;inset:0;display:block;background:#0c3f58;overflow:hidden;' +
      'font-family:Nunito,"Segoe UI",system-ui,sans-serif;}' +
      'canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}' +
      '</style><canvas></canvas>';
    this._game = new Game(this, root.querySelector('canvas'));
    this._game.start();
  }
  disconnectedCallback() {
    if (this._game) { this._game.destroy(); this._game = null; this._booted = false; }
  }
  attributeChangedCallback() {
    if (this._game) this._game.readConfig();
  }
}
if (!customElements.get('sky-fury')) customElements.define('sky-fury', SkyFury);
})();
