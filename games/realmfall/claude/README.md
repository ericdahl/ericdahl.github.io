# Realmfall

A single-player realm-war RPG in 3D, in the browser. Pick one of three realms, level a hero in its homeland, then go out to the frontier, where the realms' AI warbands fight over seven keeps whether you're there or not. Everything (terrain, trees, castles, people, monsters, icons, sound) is generated in code with [Three.js](https://threejs.org); there are no asset files.

## Play

```sh
npm install
npm run dev        # http://localhost:5173
```

`npm run build` writes a static site to `dist/`. Desktop browsers with a keyboard and mouse are the target.

URL options: `?seed=N` builds a different world (default 7), `?fps` shows the frame rate, frame time, draw calls and triangles (also under Menu → Show frame rate), and `?autostart&class=warden|ranger|runecaller|cleric&realm=0|1|2&level=N` skips the title screen with a fresh hero.

## Controls

| | |
|---|---|
| Move | `W` `S` forward/back, `A` `D` strafe, `Q` `E` turn, `Space` jump, `X` sprint on/off (or hold `Shift`), `R` auto-run |
| Camera | Right-drag turns you with the camera (then `Q`/`E` strafe too), left-drag looks around, both buttons run, wheel zooms |
| Target | Click, `Tab` for the nearest enemy, `Esc` to clear |
| Fight | `1`–`0` hotbar, `Z` or right-click an enemy to auto-attack, `G` healing draught, `V` power draught |
| Talk / use | `F` (NPCs, soldiers of your realm, and the banner inside a keep your realm holds) |
| Windows | `C` character, `I` backpack, `K` abilities (drag them to the hotbar), `M` war map, `F1` help |

## The game

**Realms.** Valmora (meadows and stone, blue), Eldwyn (deep forest, green) and Hroth (snow and fjords, red) each have a town, a home region walled off from the others by mountains, and a gate fortress onto the shared frontier in the middle.

**Classes.** Every realm can play all four:

| Class | Plays as |
|---|---|
| Warden | Plate and shield. Styles replace the next swing and chain: Slash opens Backhand, Backhand opens Executioner, a parry opens Riposte, and Flank Cut needs you beside or behind the target. |
| Ranger | A longbow with long draws (Aimed Shot, Heart-Seeker) that any hit ruins, so it snares and opens from range. |
| Runecaller | The hardest-hitting caster: Fire Bolt, Frost Lance, Thunderclap, Starfall. A single blow interrupts a spell, so it roots, kites and uses Focus. |
| Cleric | Chain mail, a mace, heals (Mend, Renew, Greater Mend, Sanctuary), a stun and Smite. Slow alone, very welcome in a warband. |

**Levelling (1–20).** Monster camps get tougher the farther they are from town, and every monster's name is coloured by how it compares to you (grey, green, blue, yellow, orange, red, purple). Wolves call their packmates, brigands fight in gangs, bog sprites and mistcallers cast, trolls and treants slam, a few named monsters roam with better loot, and you can die. The Taskmaster pays for culling monsters, the Merchant sells potions and gear of your level, and loot drops with up to three bonuses. Other heroes of your realm level in the same fields and chatter in region chat.

**The frontier.** Each realm sends warbands of six to nine soldiers out of its gate every minute or so. They pick a keep, gather outside it, batter down its gate and kill its lord to take it. A keep has a lord, a garrison that refills while it's quiet, and a gate that rebuilds itself; if a realm's keep is attacked, nearby warbands of that realm come to defend it. Keeps change hands on their own (a 20-minute headless run sees several captures). You can fight alongside your realm's warbands for realm points and realm rank, or talk to a soldier and **take command of the whole warband**: it follows you and attacks what you attack. Releasing in the frontier sends you to the nearest keep your realm holds, and the banner inside any keep your realm holds lets you travel between them.

Heroes save to the browser's local storage every ten seconds. The keeps don't: each visit starts the war fresh.

## Development

```sh
npm test           # Vitest: the realm war runs 20 minutes headless; combat and progression rules
npm run e2e        # Playwright smoke test: create a hero, travel to the frontier, open the map
npm run typecheck
```

Release notes live in `src/changelog.ts` and show in game (click the version on the title screen, or Menu → Release notes). With each version bump, add an entry at the top; `tests/changelog.test.ts` fails if it doesn't match `package.json`.

On a machine where Playwright's own browser isn't installed, point `PW_CHROMIUM` at a Chromium binary.

| Path | What |
|---|---|
| `src/game/` | The simulation, with no DOM: `geo.ts` (the map), `data.ts` (classes, abilities, monsters, curves), `world.ts` (entities, movement, combat, rewards), `ai.ts` (monsters, soldiers, guards, adventurers), `war.ts` (keeps, warbands, the war director), `spawn.ts` (populating a new world) |
| `src/render/` | Three.js: terrain and its painted map, instanced trees, keeps and houses, procedural character rigs (merged per limb to keep draw calls down), sky, day and night, effects, nameplates |
| `src/ui/` | DOM HUD, windows, title screen, controls, canvas-drawn icons, synthesized sound, saves |

The simulation runs at a fixed 20 ticks a second, and `World.run(seconds)` runs it as fast as it can, which is how the tests play out the war.
