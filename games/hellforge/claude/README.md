# Hellforge

A dark-fantasy action RPG in the classic isometric hack-and-slash mold. Pick a hero, clear demon-infested fields, caves and catacombs, and hunt ever better loot on the way down to the Hellforge. It runs in any modern browser, phones included, and needs no downloads: all the art and sound are generated in code.

## Play

```sh
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN so you can open it on a phone)
```

`npm run build` writes a static site to `dist/` that you can host anywhere (it is published to GitHub Pages from this repo). On a phone, "Add to Home Screen" runs it fullscreen. Landscape is recommended, but portrait works too.

URL options: `?seed=123` fixes the world layout, `?autostart&class=huntress` skips the menu with a fresh hero.

## Controls

| | Touch | Mouse / keyboard |
|---|---|---|
| Move | Joystick (touch the left side of the screen), or tap the ground | Left click / hold |
| Attack | Big ⚔ button (auto-targets the nearest enemy, hold to keep attacking), or tap a monster | Left click a monster (Shift: attack in place) |
| Skills | The three buttons around ⚔ | Right click (slot 2), or `Q` `W` `E` `R` for slots 1-4 |
| Pick up, talk, take stairs | Tap the label / NPC / stairs, or the context button that appears nearby | Click it, or `F` for the nearest thing |
| Potions | Tap a belt slot | `1` `2` `3` `4` |
| Town Portal | ◎ button | `T` |
| Panels | Buttons on the bottom bar | `I` inventory, `C` character, `K` skills, `Tab`/`M` automap, `Esc` menu |

Panels pause the game.

## The game

- **Three classes.** The **Reaver** (melee: Bash, Frenzy, Leap Attack, Whirlwind, War Cry), the **Arcanist** (Fire Bolt, Ice Bolt, Charged Bolt, Frost Nova, Teleport, Fireball, Meteor) and the **Huntress** (bows: Power Shot, Multishot, Exploding and Storm Arrows, Strafe, plus Critical Eye and Evade). Each level gives 5 stat points and a skill point. Skill trees have level requirements, prerequisites and synergies.
- **Loot.** Items drop as normal, socketed (grey), magic (blue), rare (yellow), set (green) or unique (gold). Magic and better items drop unidentified; the sage identifies them for free. Gems in seven types and five grades go into sockets, with different effects in weapons, armor and shields. Your inventory is a grid where items take up space by size. Magic find improves your odds.
- **Monsters.** Imps that flee when a packmate dies and Hexers that raise them again, ghouls, skeletons, archers, bats, hounds, brutes, wraiths and cultists. Champion packs (blue) and uniques with modifiers like Fire Enchanted, Stone Skin and Extra Fast (gold). Bosses: Gorvath the Glutton, the Drowned Bishop, Ossuary Warden Krell, and Vhorza, Mother of Cinders.
- **The world.** Emberwatch Camp (healer, blacksmith, sage, gambler, stash) and seven randomly generated areas: Cinder Fields, Hollow Cave, Gloomwood, Sunken Chapel, Catacombs 1-2 and the Hellforge. Activate waypoints to fast-travel, and cast Town Portal to restock and come back. Shrines, chests and (occasionally explosive) barrels are scattered around.
- **Quests.** Cleanse the Hollow Cave (+1 skill point), slay the Drowned Bishop (+5 stat points), and destroy the Mother of Cinders to unlock **Nightmare**, then **Hell**: tougher monsters, immunities and resistance penalties.
- **Hardcore** heroes die permanently. Softcore heroes respawn in town and lose some gold.

Progress saves automatically to the browser's local storage.

## Development

```sh
npm test           # Vitest: engine unit tests, world simulation, and a bot that plays the whole act with every class
npm run e2e        # Playwright on phone-landscape, phone-portrait and desktop (screenshots land in test-results/)
npm run typecheck
```

| Path | What |
|---|---|
| `src/game/` | Pure simulation with no DOM: map generation, pathfinding, items, skills, monsters, combat, `World` |
| `src/render/` | Canvas renderer: isometric camera, procedural sprites, lighting, automap, item/skill icons |
| `src/ui/` | DOM HUD, panels, title screen, input, audio, saves |
| `tests/` | Vitest suites (`bot.ts` is the playthrough bot used by `act.test.ts`) |
| `e2e/` | Playwright specs |
