import { describe, expect, it } from 'vitest';
import { hashSeed, Rng, tileHash } from '../src/game/rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('int stays within inclusive bounds and hits both ends', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('weighted respects weights', () => {
    const r = new Rng(1);
    let heavy = 0;
    for (let i = 0; i < 5000; i++) if (r.weighted([{ w: 9, v: 'a' }, { w: 1, v: 'b' }]) === 'a') heavy++;
    expect(heavy / 5000).toBeGreaterThan(0.85);
    expect(heavy / 5000).toBeLessThan(0.95);
  });

  it('hashes are stable and spread', () => {
    expect(hashSeed('a', 1)).toBe(hashSeed('a', 1));
    expect(hashSeed('a', 1)).not.toBe(hashSeed('a', 2));
    const v = tileHash(3, 4);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
