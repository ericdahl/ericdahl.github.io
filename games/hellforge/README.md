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
| Dodge | ➠ button (rolls the way you are steering) | `Space` (rolls toward the cursor) |
| Pick up, talk, take stairs | Tap the label / NPC / stairs, or the context button that appears nearby | Click it, or `F` for the nearest thing |
| Potions | Tap a potion slot (long-press for details) | `1` health, `2` mana, `3` rejuvenation |
| Town Portal | ◎ button | `T` |
| Panels | Buttons on the bottom bar | `I` inventory, `C` character, `K` skills, `Tab`/`M` automap, `Esc` menu |
| Items | Tap an item, then a button | Hover an item and press `E` equip/unequip, `U` use, `S` sell, `B` buy, `D` drop, `X` stash/inventory, `G` socket; right-click for the main action |

Panels pause the game.

## The game

- **Four classes.** The **Reaver** (melee: Bash, Frenzy, Leap Attack, Whirlwind, War Cry), the **Arcanist** (Fire Bolt, Ice Bolt, Charged Bolt, Frost Nova, Teleport, Fireball, Meteor), the **Huntress** (bows: Power Shot, Multishot, Exploding and Storm Arrows, Strafe, plus Critical Eye and Evade) and the **Necromancer** (summons: Raise Skeleton from corpses, Grave Golem, Skeletal Mastery; curses and corpses: Mark of Frailty, Corpse Burst; bone and poison: Bone Shards, Bone Ward, Bone Lance, Bone Storm, Blight Nova). Servants follow you between areas, and monsters fight them as well as you. Each level gives 5 stat points and a skill point. Skill trees have level requirements, prerequisites and synergies.
- **Loot.** Items drop as normal, socketed (grey), magic (blue), rare (yellow), set (green) or unique (gold). Magic and better items drop unidentified; the sage identifies them for free. Gems in seven types and five grades go into sockets, with different effects in weapons, armor and shields. Your inventory is a grid where items take up space by size. Magic find improves your odds.
- **Monsters.** Imps that flee when a packmate dies and Hexers that raise them again, ghouls, skeletons, archers, bats, hounds, brutes, wraiths and cultists. Champion packs (blue) and uniques with modifiers like Fire Enchanted, Stone Skin, Extra Fast, Lightning Enchanted, Teleporter and Bombardier (gold). Bosses: Gorvath the Glutton, the Drowned Bishop, Ossuary Warden Krell, and Vhorza, Mother of Cinders.
- **The world.** Emberwatch Camp (healer, blacksmith, sage, gambler, stash) and seven randomly generated areas: Cinder Fields, Hollow Cave, Gloomwood, Sunken Chapel, Catacombs 1-2 and the Hellforge. Activate waypoints to fast-travel, and cast Town Portal to restock and come back. Shrines, chests and (occasionally explosive) barrels are scattered around.
- **Act 2: The Glass Sea.** Killing Vhorza opens a caravan to Tel Maresh and seven more areas: the Ashfall Road, Cistern of Whispers, the Glass Sea, Carrion Mesa, Buried Imhara (the Bazaar and the Hall of Dials) and the Noon Vault. Sandstorms and quicksand change how the desert plays, the new monsters each have a rule to learn (Embalmed Dead rise unless burned, Mirage Dancers split into copies with no shadow, Noon Acolytes ward their allies, Dune Burrowers tunnel to you, Carrion Kites heal on corpses, Salt Colossi telegraph ground slams), and the four bosses change phase as they are wounded.
- **Dodging and sprees.** A dodge roll (1.5 second cooldown) makes the hero untouchable for a moment and cancels a swing or cast. Kills made within four seconds of each other build a spree (Killing Spree at 5, then Rampage, Massacre, Slaughter, Annihilation, Hell Unleashed); each rank adds run speed and experience per kill, and restores some life and mana.
- **Things to find.** Soul orbs restore life or mana when walked over. A Tithe Imp may hide in any area but the Hollow Cave: it flees, drops gold when struck, and escapes through a portal unless killed. Shrines grant Armor, Combat, Experience, Storm, Fortune or Fleet blessings, refill life and mana, or (Cursed) call a three-wave ambush with a hoard at the end. Killing everything in an area purges it for experience and loot.
- **Quests.** Cleanse the Hollow Cave (+1 skill point), slay the Drowned Bishop (+5 stat points), destroy the Mother of Cinders to open the road south, then finish Act 2's four quests to unlock **Nightmare**, then **Hell**: tougher monsters, immunities and resistance penalties.
- **Hardcore** heroes die permanently. Softcore heroes respawn in town and lose some gold.

Music, ambient sound and weather are all generated in code too; the menu has switches for each.

Progress saves automatically to the browser's local storage. To move heroes to another device, use **Export / Import** on the title screen: download a save file or copy a short save code, then load the file or paste the code on the other device. Importing replaces a hero with the same identity and keeps the rest.

## Versions

The version is shown at the bottom of the title screen; tap it for the player-facing changelog (`src/changelog.ts`, add an entry with each version bump).

| Version | Commit | Notes |
|---|---|---|
| 0.11.0 | | Dodge roll, killing sprees, soul orbs, the Tithe Imp, four new shrines, three new elite modifiers, area purges |
| 0.10.0 | | Redrawn character art: hero gear shows on the model, new monster and NPC models, keyframed weapon swings |
| 0.9.1 | | Stash no longer overlaps the backpack |
| 0.9.0 | | Act 2: The Glass Sea |
| 0.8.2 | | Light beam and chime for rare drops |
| 0.8.1 | | Loot with no room hops back up with a thud |
| 0.8.0 | | Four class item sets; set pieces favour the hero's class |
| 0.7.3 | | New uniques: Ironwrath (Reaver) and Cryptkeeper's Shroud (Necromancer) |
| 0.7.2 | | Other classes' skill bonuses marked "(no effect)" on items |
| 0.7.1 | | Backpack and stash rearrange to fit items; Sort button |
| 0.7.0 | | Potion pools replace belt columns and backpack potions; first save migration (`migrateCharacter`, `SAVE_VERSION`) |
| 0.6.1 | | Hollow Cave stragglers on the HUD and automap; skeleton count on the Raise Skeleton button |
| 0.6.0 | | Hit feedback: freeze frames, crit pops, death effects by damage type, boss flashes |
| 0.5.0 | `41e78b6` | Generated music, ambient sound, weather and status vignettes |
| 0.4.2 | `81bbadc` | Equipped/Backpack separation and side-by-side gear comparison |
| 0.4.1 | `d77a7a5` | Item keyboard shortcuts and right-click |
| 0.4.0 | `12380da` | Necromancer class |
| 0.3.0 | `45bb4fd` | Changelog viewer on the title screen |
| 0.2.0 | `d6c3a2d` | Save export/import (file or copy/paste code) |
| 0.1.0 | `0fffeff` | Initial release. Roll back with `git checkout 0fffeff -- games/hellforge/claude` |

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
| `src/render/figures.ts`, `creatures.ts`, `looks.ts` | Character art: the shading kit and humanoids, monster bodies, and what the hero and townsfolk wear |
| `gallery.html` | Dev-only page (`npm run dev`, then `/gallery.html`) showing every character model in several poses; `?zoom=4&m=imp,bat` narrows it |
| `src/ui/` | DOM HUD, panels, title screen, input, audio, saves |
| `tests/` | Vitest suites (`bot.ts` is the playthrough bot used by `act.test.ts`) |
| `e2e/` | Playwright specs |
