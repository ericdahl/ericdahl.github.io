import { describe, expect, it } from 'vitest';
import { FLOOR, WALL, type Level } from '../src/game/map';
import { FlowField, findPath, lineOfSight } from '../src/game/path';

function grid(rows: string[]): Level {
  const h = rows.length;
  const w = rows[0].length;
  const tiles = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => (tiles[y * w + x] = c === '#' ? WALL : FLOOR)));
  return { w, h, tiles, theme: 'crypt', start: { x: 1, y: 1 }, exits: [], waypoint: null, spawns: [], props: [], objects: [], rooms: [], spots: {} };
}

const MAZE = grid([
  '#########',
  '#...#...#',
  '#.#.#.#.#',
  '#.#...#.#',
  '#.#####.#',
  '#.......#',
  '#########',
]);

describe('pathfinding', () => {
  it('finds a path around walls', () => {
    const path = findPath(MAZE, { x: 1.5, y: 1.5 }, { x: 7.5, y: 1.5 });
    expect(path.length).toBeGreaterThan(5);
    const last = path[path.length - 1];
    expect(Math.floor(last.x)).toBe(7);
    expect(Math.floor(last.y)).toBe(1);
    for (const p of path) expect(MAZE.tiles[Math.floor(p.y) * MAZE.w + Math.floor(p.x)]).toBe(FLOOR);
  });

  it('never cuts wall corners diagonally', () => {
    const path = findPath(MAZE, { x: 1.5, y: 1.5 }, { x: 3.5, y: 3.5 });
    let prev = { x: 1.5, y: 1.5 };
    for (const p of path) {
      const dx = Math.sign(p.x - prev.x);
      const dy = Math.sign(p.y - prev.y);
      if (dx && dy) {
        expect(MAZE.tiles[Math.floor(prev.y) * MAZE.w + Math.floor(prev.x + dx)]).toBe(FLOOR);
        expect(MAZE.tiles[Math.floor(prev.y + dy) * MAZE.w + Math.floor(prev.x)]).toBe(FLOOR);
      }
      prev = p;
    }
  });

  it('heads to the closest reachable tile when the goal is a wall', () => {
    const path = findPath(MAZE, { x: 1.5, y: 1.5 }, { x: 4.5, y: 4.5 });
    expect(path.length).toBeGreaterThan(0);
  });

  it('line of sight is blocked by walls', () => {
    expect(lineOfSight(MAZE, { x: 1.5, y: 5.5 }, { x: 7.5, y: 5.5 })).toBe(true);
    expect(lineOfSight(MAZE, { x: 1.5, y: 1.5 }, { x: 7.5, y: 1.5 })).toBe(false);
  });

  it('flow field leads downhill to the root', () => {
    const f = new FlowField(MAZE, 40);
    f.update(7.5, 1.5);
    let pos = { x: 1.5, y: 1.5 };
    for (let i = 0; i < 40 && f.at(pos.x, pos.y) > 0; i++) pos = f.next(pos.x, pos.y)!;
    expect(Math.floor(pos.x)).toBe(7);
    expect(Math.floor(pos.y)).toBe(1);
  });
});
