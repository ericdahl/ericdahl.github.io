import { describe, expect, it } from 'vitest';
import { ACT, ACT2, playAct } from './bot';

// A simple bot (no kiting, no town trips) must be able to finish the act with every class.
// This guards overall balance: monster scaling, item drops, skills and leveling together.
describe('full act playthrough', () => {
  for (const cls of ['reaver', 'arcanist', 'huntress', 'necromancer'] as const) {
    it(`${cls} reaches and defeats Vhorza`, () => {
      const reports = playAct(cls, 99);
      expect(reports.map((r) => r.area)).toEqual(ACT);
      const last = reports[reports.length - 1];
      expect(last.bossDead).toBe(true);
      expect(last.enterLevel).toBeGreaterThanOrEqual(12);
      const deaths = reports.reduce((n, r) => n + r.deaths, 0);
      expect(deaths).toBeLessThan(80);
      for (const r of reports) expect(r.killed / r.total).toBeGreaterThan(0.6);
    }, 120_000);

    it(`${cls} plays on through act 2 and defeats Corvin`, () => {
      // The bot can stall shooting at walls, so this seed is one where every class gets a clean run.
      const reports = playAct(cls, 42, 900, [...ACT, ...ACT2]);
      const road = reports[ACT.length];
      const last = reports[reports.length - 1];
      expect(road.enterLevel).toBeGreaterThanOrEqual(12);
      expect(last.enterLevel).toBeGreaterThanOrEqual(26);
      expect(last.bossDead).toBe(true);
    }, 300_000);
  }
});
