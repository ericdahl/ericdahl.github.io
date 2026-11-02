import { describe, expect, it } from 'vitest';
import { AREAS } from '../src/game/areas';
import { floodDistances, FLOOR, generateLevel, idx, isWalkable } from '../src/game/map';
import { Rng } from '../src/game/rng';

describe('level generation', () => {
  for (const area of AREAS) {
    it(`${area.id}: every exit, waypoint and spawn is reachable from the start`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const l = generateLevel(area.spec, new Rng(seed * 977));
        expect(isWalkable(l, l.start.x, l.start.y)).toBe(true);
        const dist = floodDistances(l, l.start.x, l.start.y);
        expect(l.exits.length).toBe(area.spec.links.length);
        for (const e of l.exits) expect(dist[idx(l, e.x, e.y)]).toBeGreaterThanOrEqual(0);
        if (area.spec.waypoint || area.id === 'town') {
          expect(l.waypoint).not.toBeNull();
          expect(dist[idx(l, l.waypoint!.x, l.waypoint!.y)]).toBeGreaterThanOrEqual(0);
        }
        for (const s of l.spawns) expect(dist[idx(l, s.x, s.y)]).toBeGreaterThan(0);
        for (const o of l.objects) expect(l.tiles[idx(l, o.x, o.y)]).toBe(FLOOR);
        if (area.spec.bossLair) expect(dist[idx(l, l.spots.boss.x, l.spots.boss.y)]).toBeGreaterThan(0);
        if (area.packs) expect(l.spawns.length).toBeGreaterThanOrEqual(Math.min(area.packs, 8));
      }
    });
  }

  it('is deterministic for the same seed', () => {
    const spec = AREAS.find((a) => a.id === 'catacombs1')!.spec;
    const a = generateLevel(spec, new Rng(5));
    const b = generateLevel(spec, new Rng(5));
    expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
  });

  it('borders are solid', () => {
    const spec = AREAS.find((a) => a.id === 'gloomwood')!.spec;
    const l = generateLevel(spec, new Rng(3));
    for (let x = 0; x < l.w; x++) {
      expect(l.tiles[idx(l, x, 0)]).not.toBe(FLOOR);
      expect(l.tiles[idx(l, x, l.h - 1)]).not.toBe(FLOOR);
    }
  });
});
