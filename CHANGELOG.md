# Changelog

All notable changes to this project are documented here, following
[Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

## [Unreleased]

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
- Fullscreen toggle (⛶) in the game navigation

## [0.1.0] - 2026-07-18

### Added

- Initial versioned release of game-sky-fury.
- In-game version badge sourced from `version.js`.
