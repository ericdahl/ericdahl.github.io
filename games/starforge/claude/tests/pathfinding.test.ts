import { describe, expect, it } from 'vitest';
import { findPath, lineClear, nearestFreeTile, smoothPath, type Grid } from '../src/game/pathfinding';

function grid(rows: string[]): Grid {
  return {
    w: rows[0].length,
    h: rows.length,
    blocked: (x, y) => x < 0 || y < 0 || y >= rows.length || x >= rows[0].length || rows[y][x] === '#',
  };
}

describe('pathfinding', () => {
  const g = grid([
    '..........',
    '.########.',
    '.#......#.',
    '.#.####.#.',
    '...#......',
    '####..####',
    '..........',
  ]);

  it('finds a path around walls', () => {
    const p = findPath(g, 0, 0, 4, 6);
    expect(p[p.length - 1]).toEqual({ x: 4, y: 6 });
    for (const t of p) expect(g.blocked(t.x, t.y)).toBe(false);
  });

  it('never cuts corners diagonally', () => {
    const p = [{ x: 0, y: 0 }, ...findPath(g, 0, 0, 9, 6)];
    for (let i = 1; i < p.length; i++) {
      const dx = p[i].x - p[i - 1].x;
      const dy = p[i].y - p[i - 1].y;
      if (dx && dy) {
        expect(g.blocked(p[i - 1].x + dx, p[i - 1].y)).toBe(false);
        expect(g.blocked(p[i - 1].x, p[i - 1].y + dy)).toBe(false);
      }
    }
  });

  it('routes to nearest reachable tile when goal is blocked', () => {
    const p = findPath(g, 0, 0, 3, 1);
    expect(p.length).toBeGreaterThan(0);
    const last = p[p.length - 1];
    expect(g.blocked(last.x, last.y)).toBe(false);
    expect(Math.abs(last.x - 3) + Math.abs(last.y - 1)).toBeLessThanOrEqual(2);
  });

  it('returns a partial path toward an enclosed goal', () => {
    const boxed = grid(['.....', '.###.', '.#.#.', '.###.', '.....']);
    const p = findPath(boxed, 0, 0, 2, 2);
    expect(p.length).toBeGreaterThan(0);
  });

  it('nearestFreeTile finds an open neighbour', () => {
    const f = nearestFreeTile(g, 3, 1, 0, 0)!;
    expect(g.blocked(f.x, f.y)).toBe(false);
  });

  it('smoothPath keeps clear lines and shortens straight runs', () => {
    const open = grid(['..........', '..........', '..........']);
    const tiles = findPath(open, 0, 1, 9, 1);
    const s = smoothPath(open, 0.5, 1.5, tiles);
    expect(s).toEqual([{ x: 9.5, y: 1.5 }]);
    expect(lineClear(g, 0.5, 0.5, 9.5, 0.5, 0.3)).toBe(true);
    expect(lineClear(g, 0.5, 0.5, 0.5, 6.5, 0.3)).toBe(false);
  });
});
