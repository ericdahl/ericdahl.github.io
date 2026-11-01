# Hellforge

A mobile friendly dark fantasy action RPG for GitHub Pages. Choose one of three heroes, fight through generated ruins, collect enchanted gear, level up, and face Azrath in the forge. Victory opens a deeper, stronger dungeon. Progress saves automatically in the browser.

## Play

Open `index.html` through a local web server, or visit the Pages deployment at `games/hellforge/codex/`.

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD or arrow keys | Drag the left joystick |
| Attack | Hold mouse button | Hold ATTACK, or tap the dungeon |
| Class skill | 1 or Q | SKILL |
| Potion | Space | POTION |
| Inventory | I | Inventory button |

Equipment is collected by walking over drops. Open Inventory and select an item to equip it. Potions restore both life and mana. Azrath waits in the northeast chamber.

## Develop

No build step or runtime dependencies are needed. From this directory:

```sh
python3 -m http.server 8000
npm test
```

The repository's Pages workflow copies static games directly, so `index.html`, `style.css`, `main.js`, and `game.js` are ready to publish.
