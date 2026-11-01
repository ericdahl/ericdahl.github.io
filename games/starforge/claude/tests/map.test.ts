import { describe, expect, it } from 'vitest';
import { generateMap, GROUND } from '../src/game/map';
import { RESOURCES } from '../src/game/defs';
import { findPath } from '../src/game/pathfinding';

describe('generateMap', () => {
  it('is deterministic for a seed', () => {
    const a = generateMap(7);
    const b = generateMap(7);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
  });

  it('is point-symmetric', () => {
    const m = generateMap(123);
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) expect(m.terrain[y * m.w + x]).toBe(m.terrain[(m.h - 1 - y) * m.w + (m.w - 1 - x)]);
  });

  it('places resources on open ground without overlap', () => {
    for (const seed of [1, 2, 3, 99]) {
      const m = generateMap(seed);
      const used = new Set<number>();
      for (const r of m.resources) {
        const d = RESOURCES[r.kind];
        for (let y = r.ty; y < r.ty + d.h; y++)
          for (let x = r.tx; x < r.tx + d.w; x++) {
            expect(m.terrain[y * m.w + x]).toBe(GROUND);
            expect(used.has(y * m.w + x)).toBe(false);
            used.add(y * m.w + x);
          }
      }
    }
  });

  it('connects both starting bases', () => {
    for (const seed of [5, 6, 7, 8]) {
      const m = generateMap(seed);
      const grid = { w: m.w, h: m.h, blocked: (x: number, y: number) => x < 0 || y < 0 || x >= m.w || y >= m.h || m.terrain[y * m.w + x] !== GROUND };
      const [a, b] = m.starts;
      const p = findPath(grid, a.tx, a.ty + 4, b.tx, b.ty - 1, 1e6);
      const last = p[p.length - 1];
      expect(last).toEqual({ x: b.tx, y: b.ty - 1 });
    }
  });
});
