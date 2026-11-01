import { generateMap, type MapData } from '../src/game/map';
import { World } from '../src/game/world';

/** An open map with no rocks or resources, for isolated mechanic tests. */
export function emptyMap(size = 40): MapData {
  const terrain = new Uint8Array(size * size);
  return {
    w: size, h: size, seed: 1, terrain, deco: new Uint8Array(size * size),
    starts: [{ tx: 4, ty: 4 }, { tx: size - 8, ty: size - 7 }], expansions: [], resources: [],
  };
}

export function emptyWorld(size = 40) {
  const w = new World(emptyMap(size));
  w.victoryEnabled = false;
  w.revealAll(1);
  w.revealAll(2);
  return w;
}

export function standardWorld(seed = 42) {
  const w = new World(generateMap(seed));
  w.setupStart();
  return w;
}

export function run(w: World, seconds: number, each?: () => void) {
  const ticks = Math.round(seconds * 20);
  for (let i = 0; i < ticks; i++) {
    each?.();
    w.step();
  }
}
