import { createCharacter } from '../src/game/character';
import type { ClassId } from '../src/game/items';
import { World } from '../src/game/world';

export function makeWorld(classId: ClassId = 'reaver', seed = 1234) {
  return new World(createCharacter('Test', classId), seed);
}

export function run(w: World, seconds: number, each?: () => void) {
  for (let t = 0; t < seconds; t += 1 / 30) {
    each?.();
    w.step(1 / 30);
  }
}

/** Puts the player on a floor tile right next to a live monster in the current area. */
export function nextToMonster(w: World) {
  const m = w.area.monsters.find((x) => !x.dead && !x.superId)!;
  w.player.x = m.x;
  w.player.y = m.y;
  // Step off the monster onto a walkable neighbour.
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = m.x + dx * 0.8;
    const y = m.y + dy * 0.8;
    if (w.area.level.tiles[Math.floor(y) * w.area.level.w + Math.floor(x)] === 1) {
      w.player.x = x;
      w.player.y = y;
      break;
    }
  }
  w.player.invuln = 0;
  return m;
}
