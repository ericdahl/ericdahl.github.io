# Starforge

A mobile-friendly real-time strategy game in the classic sci-fi RTS mold: gather two resources, manage supply, climb a tech tree, build an army and destroy the enemy base. It runs in any modern browser, including iOS and Android, with no assets to download. All the art and sound are generated in code.

## Play

```sh
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN so you can open it on a phone)
```

`npm run build` writes a static site to `dist/` that you can host anywhere. On a phone, use "Add to Home Screen" to run it fullscreen.

URL options: `?seed=123` fixes the map, and `?autostart` skips the menu.

## How to play

| | Touch | Mouse / keyboard |
|---|---|---|
| Select | Tap a unit | Left click |
| Box select | Long-press then drag, or the **Select** button | Left drag |
| Select all of a type | Double-tap a unit | Double click |
| Move / gather / attack | With units selected, tap ground, a resource or an enemy | Right click |
| Attack-move | **Attack** button, then tap | `A`, then click |
| Pan / zoom | Drag / pinch | Arrow keys, middle drag / wheel |
| Jump camera | Tap the minimap | Click the minimap |
| Control groups | – | `Ctrl+1-9` assigns, `1-9` selects (double press to center) |

Hotkeys are shown on each command button. `Esc` cancels and `P` pauses.

### Economy and tech

- **Harvesters** mine **crystal** and carry it back to a **Command Core**. To collect **flux**, build an **Extractor** on a flux vent.
- **Habitats** add supply (max 200).
- Tech path: Command Core → **Garrison** (Trooper, Ranger) → **War Works** (Raider, Crawler) → **Skyport** (Wasp). A **Turret** needs a Garrison.

| Unit | Role |
|---|---|
| Trooper | Cheap rifle infantry; hits ground and air |
| Ranger | Long-range marksman |
| Raider | Fast melee hover-bike; bonus damage vs light units |
| Crawler | Artillery walker; long-range splash vs ground |
| Wasp | Gunship; flies over terrain, hits ground and air |

Destroy every enemy building to win. The AI comes in Easy, Normal and Hard. Hard gathers 25% faster.

## Development

```sh
npm test           # Vitest: simulation unit tests + AI-vs-AI games (headless)
npm run e2e        # Playwright: phone landscape, phone portrait, desktop; screenshots in test-results/
npm run typecheck
```

### Architecture

```
src/game/      Pure, deterministic simulation (no DOM). Runs headless in tests.
  defs.ts        Unit/building/resource stats and tech tree
  map.ts         Seeded, point-symmetric map generator
  pathfinding.ts A* on the tile grid + line-of-sight smoothing
  world.ts       Fixed 20 Hz simulation: orders, economy, production, combat, fog, victory
  ai.ts          Scripted opponent that uses the same Command API as the player
src/render/    Canvas 2D renderer (procedural art) and camera
src/ui/        Game controller, touch/mouse input, HUD, minimap, audio
```

The player and the AI both change the world only through `World.issue(player, command)`, so the AI follows the same rules as the player. Rendering interpolates between simulation ticks for smooth motion at any frame rate.
