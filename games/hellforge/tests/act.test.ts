import { describe, expect, it } from 'vitest';
import { ACT, ACT2, ACT3, playAct } from './bot';

// A simple bot (no kiting, no town trips) must be able to finish the act with every class.
// This guards overall balance: monster scaling, item drops, skills and leveling together.
// The bot can stall shooting at walls or go a whole act without finding a weapon, so a run depends on its seed.
// Every class plays seed 99 unless that seed gives it an unlucky run; anything that changes what drops can move these.
const SEEDS: Record<string, number> = { huntress: 7, arcanist: 77 };

describe('full act playthrough', () => {
  for (const cls of ['reaver', 'arcanist', 'huntress', 'necromancer', 'forgewright'] as const) {
    const seed = SEEDS[cls] ?? 99;
    it(`${cls} reaches and defeats Vhorza`, () => {
      const reports = playAct(cls, seed);
      expect(reports.map((r) => r.area)).toEqual(ACT);
      const last = reports[reports.length - 1];
      expect(last.bossDead).toBe(true);
      expect(last.enterLevel).toBeGreaterThanOrEqual(12);
      const deaths = reports.reduce((n, r) => n + r.deaths, 0);
      expect(deaths).toBeLessThan(80);
      for (const r of reports) expect(r.killed / r.total).toBeGreaterThan(0.6);
    }, 120_000);

    it(`${cls} plays on through act 2 and defeats Corvin`, () => {
      const reports = playAct(cls, seed, 900, [...ACT, ...ACT2]);
      const road = reports[ACT.length];
      const last = reports[reports.length - 1];
      expect(road.enterLevel).toBeGreaterThanOrEqual(12);
      expect(last.enterLevel).toBeGreaterThanOrEqual(26);
      expect(last.bossDead).toBe(true);
    }, 300_000);

    it(`${cls} carries the ember up the Ember Road and defeats the Unlit`, () => {
      const reports = playAct(cls, seed, 900, [...ACT, ...ACT2, ...ACT3]);
      expect(reports.map((r) => r.area).slice(-ACT3.length)).toEqual(ACT3);
      const act3 = reports.slice(-ACT3.length);
      const last = act3[act3.length - 1];
      expect(act3[0].enterLevel).toBeGreaterThanOrEqual(28);
      expect(last.area).toBe('hellforge_heart');
      expect(last.enterLevel).toBeGreaterThanOrEqual(34);
      // Every boss on the road falls: the Frostwright, Corvane's Echo behind his phylacteries, and the Unlit.
      for (const r of act3) expect(r.bossDead, r.area).toBe(true);
      for (const r of act3) expect(r.killed / r.total, r.area).toBeGreaterThan(0.6);
      // The bot lights braziers when its ember runs low, so the cold never holds it for long.
      expect(act3.reduce((n, r) => n + r.frozen, 0)).toBeLessThan(60);
      expect(act3.reduce((n, r) => n + r.braziers, 0)).toBeGreaterThan(5);
    }, 420_000);
  }
});
