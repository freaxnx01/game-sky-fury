# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.3.0] - 2026-10-01

### Added

- Flip by tapping the opposite arrow, from speed 100 (#15)

- Brake with Shift + the arrow behind you (#15)

- Document Shift thrust/brake and arrow flip (#15)

### Fixed

- Move carpet bombing to C, clarify thrust/brake row (#15)


## [0.2.1] - 2026-09-30

### Changed

- Run simulation in fixed 1/60 s steps with accumulator (#6)

- Step bomb prediction with shared SIM_DT (#6)

### Fixed

- Scale ground-target anchors and hitbox by OBJ_SCALE (#9)

- Pad fighter blast radius by PLANE_SCALE, revert vapor indent (#9)

- Reset loop clock on blur and tab hide (#6)

- Step at 1/120 s and compute bomb aim once per frame (#6)

## [0.2.0] - 2026-09-29

### Added

- Add favicon

- Scale aircraft x2 and ground/projectile sprites x1.5 (#2)

- Predict bomb impact point each tick

- Draw predicted impact arc and crosshair

- Add carpet-bombing input flag and plane state

- Add Shift+B carpet bombing salvo

- Add sandbox mode toggle on menu (G), persisted

- Sandbox gives unlimited bombs and invulnerability

- Show sandbox HUD tag and skip best score in sandbox

- Add fullscreen toggle

### Changed

- Extract shared bomb launch and physics step

### Documentation

- Document Shift+B carpet bombing

### Fixed

- Add missing per-release version header to changelog template

- Grant actions: write to agent-workflow caller

- Sandbox toggle on menu only, clarify its menu text

## [0.1.0] - 2026-07-18

### Added

- Initial versioned release of game-sky-fury.
- In-game version badge sourced from `version.js`.
