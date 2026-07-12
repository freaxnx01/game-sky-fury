# Sky Fury

A side-scrolling WWII carrier-aviation action game — an original homage to the 1987
carrier-combat arcade classics. Launch a single-engine Navy fighter from your carrier's
deck, strafe anti-aircraft guns, tanks, and fuel dumps on an enemy-held Pacific island,
torpedo ships offshore, dogfight scrambling fighters, then bring it back low, slow, and
level to land, rearm, and do it all again. All art is drawn procedurally on a canvas and
all sound is synthesized in the browser — the game is a single self-contained web
component with zero dependencies and no build step.

**Play it:** open `index.html`, or visit the GitHub Pages URL once published.

## Files

- `index.html` — full-screen entry page (loads the Nunito font and the component)
- `sky-fury.js` — the entire game: a `<sky-fury>` custom element (Canvas 2D + Web Audio)

No build, no `package.json`, no bundler — static hosting is sufficient. The only
external request is the Nunito font from Google Fonts; the game falls back to system
fonts if it's unavailable.

## Configuration

Set attributes on the tag in `index.html`:

```html
<sky-fury waves="5" lives="4" difficulty="normal"></sky-fury>
```

- `waves` — island waves to clear, 1–12
- `lives` — planes, 1–9
- `difficulty` — `easy` | `normal` | `hard`
- `inf-fuel` — `true` for practice mode with infinite fuel

## Controls

- **Enter** — start / restart
- **↑ ↓** — pitch; **← →** — throttle
- **Space** — guns (watch the overheat lockout)
- **B** / **R** / **T** — bombs, rockets, torpedo
- **F** — flip (half-loop) to reverse direction
- **P** — pause (also pauses on window blur); **M** — mute

Land by approaching the deck low, slow, and level (on-screen SLOW · LEVEL · SINK
helper) to arrest, rearm, refuel, and repair. Bombers raid your carrier — if the hull
bar empties, the game is over.
