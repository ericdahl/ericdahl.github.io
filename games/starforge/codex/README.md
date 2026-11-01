# Starforge

A mobile-friendly, single-player real-time strategy game for the browser. Mine flux, train a fleet, and destroy the opposing forge.

## Run

```sh
npm run dev
```

Open http://localhost:5173. No install step is required.

## Controls

- Tap a unit or drag a selection box to select forces.
- Tap terrain to move, an enemy to attack, or a flux crystal to gather with selected workers.
- Use the command bar to train units, switch to attack-move, or select all combat units.
- Drag the battlefield with two fingers to pan on touchscreens. Use the minimap to jump around the map.
- Keyboard: `A` attack-move, `S` stop, `1` select army, `Esc` cancel command.

## Tests

```sh
npm test
npm run check
```

## Repository note

This workspace reserves the `.git` path, so Git metadata is stored in `.repo` instead. Use `./git status`, `./git log`, and other `./git` commands from this directory. The working tree and commits are otherwise ordinary Git.
