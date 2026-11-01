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
- Tap **∞ CHEAT** in the top bar, or press `F`, to toggle infinite flux. Unit supply limits still apply.
- Tap **Supply +8** in the command deck, or press `R`, to queue a supply expansion for 100 flux. Each expansion adds 8 supply after 8 seconds, up to 80 total.

## Tests

```sh
npm test
npm run check
```

## Repository note

This workspace reserves the `.git` path, so Git metadata is stored in `.repo` instead. Use `./git status`, `./git log`, and other `./git` commands from this directory. The working tree and commits are otherwise ordinary Git.
