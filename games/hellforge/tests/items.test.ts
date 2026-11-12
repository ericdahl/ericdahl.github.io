import { describe, expect, it } from 'vitest';
import {
  AFFIXES, BASES, baseOf, describeMods, displayName, gamble, gemMods, generateItem, itemDefense, itemMods, makeItem,
  rollDrops, rollRarity, SETS, UNIQUES, type Rarity,
} from '../src/game/items';
import { computeStats, createCharacter, slotsFor } from '../src/game/character';
import { Rng } from '../src/game/rng';

describe('item data', () => {
  it('unique and set bases exist', () => {
    for (const u of UNIQUES) expect(() => baseOf(u.base)).not.toThrow();
    for (const s of SETS) for (const p of s.pieces) expect(() => baseOf(p.base)).not.toThrow();
  });

  it('every class has a unique that raises its skills', () => {
    for (const cls of ['reaver', 'arcanist', 'huntress', 'necromancer', 'forgewright']) {
      expect(UNIQUES.some((u) => u.mods.some((md) => md.stat === `skills_${cls}`))).toBe(true);
    }
  });

  it('set piece ids are unique', () => {
    const ids = SETS.flatMap((s) => s.pieces.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const cls of ['reaver', 'arcanist', 'huntress', 'necromancer', 'forgewright'] as const) {
    it(`the ${cls} has a full set that raises its skills by 2`, () => {
      const set = SETS.find((s) => s.classId === cls)!;
      const c = createCharacter('T', cls);
      const before = computeStats(c).skillBonus;
      for (const p of set.pieces) {
        const it = makeItem(p.base, 20, 'set');
        it.setId = set.id;
        it.uniqueId = p.id;
        it.identified = true;
        c.equipment[slotsFor(it)[0]] = it;
      }
      expect(computeStats(c).skillBonus).toBe(before + 2);
    });
  }

  it('set pieces favour the class they were made for', () => {
    const rng = new Rng(3);
    let own = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (generateItem(rng, 30, { rarity: 'set', classId: 'necromancer' }).setId === 'bonewright') own++;
    // 12 of the 39 weighted shares, against 4 of 31 without the bias.
    expect(own / n).toBeGreaterThan(0.26);
    expect(own / n).toBeLessThan(0.44);
  });

  it('affix groups do not repeat within an item', () => {
    const rng = new Rng(9);
    for (let i = 0; i < 400; i++) {
      const it = generateItem(rng, 20, { rarity: 'rare' });
      const counts: Record<string, number> = {};
      for (const m of it.mods) counts[m.stat] = (counts[m.stat] ?? 0) + 1;
      // At most one prefix and one suffix may share a stat (e.g. magic find).
      for (const [stat, n] of Object.entries(counts)) expect(n, `${it.name} repeats ${stat}`).toBeLessThanOrEqual(2);
      expect(it.mods.length).toBeGreaterThanOrEqual(3);
    }
    expect(AFFIXES.length).toBeGreaterThan(50);
  });
});

describe('generateItem', () => {
  it('respects rarity rules', () => {
    const rng = new Rng(123);
    for (let i = 0; i < 500; i++) {
      const it = generateItem(rng, rng.int(1, 30));
      const b = baseOf(it);
      expect(b.qlvl).toBeLessThanOrEqual(Math.max(it.ilvl, b.qlvl));
      if (it.rarity === 'magic') expect(it.mods.length).toBeLessThanOrEqual(4);
      if (it.rarity === 'normal') {
        expect(it.mods.length).toBe(0);
        expect(b.magicOnly).toBeFalsy();
      }
      if (it.rarity !== 'normal') expect(it.identified).toBe(false);
      if (b.defMin !== undefined) {
        expect(it.def).toBeGreaterThanOrEqual(b.defMin);
        expect(it.def).toBeLessThanOrEqual(b.defMax!);
      }
      expect(it.sockets).toBeLessThanOrEqual(b.maxSockets ?? 0);
    }
  });

  it('rings and amulets are never plain', () => {
    const rng = new Rng(4);
    for (let i = 0; i < 100; i++) expect(generateItem(rng, 5, { base: 'ring', rarity: 'normal' }).rarity).not.toBe('normal');
  });

  it('magic find improves rarity', () => {
    const count = (mf: number) => {
      const rng = new Rng(99);
      const n: Record<Rarity, number> = { normal: 0, magic: 0, rare: 0, set: 0, unique: 0 };
      for (let i = 0; i < 20000; i++) n[rollRarity(rng, { mf, bonus: 1 })]++;
      return n;
    };
    const lo = count(0);
    const hi = count(300);
    expect(hi.magic + hi.rare + hi.unique).toBeGreaterThan(lo.magic + lo.rare + lo.unique);
    expect(hi.unique).toBeGreaterThan(lo.unique);
    expect(lo.unique).toBeGreaterThan(0);
  });

  it('unidentified items give no bonuses until identified', () => {
    const it = generateItem(new Rng(3), 10, { rarity: 'unique' });
    expect(it.rarity).toBe('unique');
    expect(itemMods(it)).toEqual([]);
    expect(displayName(it)).toBe(baseOf(it).name);
    it.identified = true;
    expect(itemMods(it).length).toBeGreaterThan(0);
    expect(displayName(it)).toBe(it.name);
  });

  it('enhanced defense is local to the item', () => {
    const it = makeItem('quilted_armor');
    it.def = 10;
    it.mods = [{ stat: 'defPct', value: 50 }];
    expect(itemDefense(it)).toBe(15);
  });

  it('gamble respects the requested kind', () => {
    const rng = new Rng(11);
    for (let i = 0; i < 100; i++) expect(baseOf(gamble(rng, 'boots', 12)).kind).toBe('boots');
  });

  it('every base can be generated at its quality level', () => {
    const rng = new Rng(5);
    for (const b of BASES.filter((x) => !['potion', 'gem', 'scroll'].includes(x.kind))) {
      const it = generateItem(rng, b.qlvl, { base: b.id, rarity: 'magic' });
      expect(it.base).toBe(b.id);
    }
  });
});

describe('gems and text', () => {
  it('gem effects depend on the host', () => {
    expect(gemMods('gem_ruby_3', 'weapon').map((m) => m.stat)).toEqual(['fireMin', 'fireMax']);
    expect(gemMods('gem_ruby_3', 'helm')).toEqual([{ stat: 'life', value: 24 }]);
    expect(gemMods('gem_ruby_3', 'shield')).toEqual([{ stat: 'fireRes', value: 22 }]);
  });

  it('socketed gems apply through itemMods', () => {
    const it = makeItem('cap');
    it.sockets = 1;
    it.gems = ['gem_amethyst_5'];
    expect(itemMods(it)).toEqual([{ stat: 'str', value: 10 }]);
  });

  it('describeMods merges min/max damage pairs', () => {
    expect(describeMods([{ stat: 'fireMin', value: 2 }, { stat: 'fireMax', value: 6 }, { stat: 'str', value: 3 }])).toEqual([
      'Adds 2-6 Fire Damage',
      '+3 to Strength',
    ]);
  });
});

describe('drops', () => {
  it('bosses always drop several magic-or-better items', () => {
    const rng = new Rng(77);
    for (let i = 0; i < 30; i++) {
      const d = rollDrops(rng, 12, 'boss');
      const good = d.filter((x) => x.kind === 'item' && x.item.rarity !== 'normal' && !['potion', 'gem', 'scroll'].includes(baseOf(x.item).kind));
      expect(good.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('normal monsters often drop nothing', () => {
    const rng = new Rng(2);
    let empty = 0;
    for (let i = 0; i < 1000; i++) if (!rollDrops(rng, 5, 'normal').length) empty++;
    expect(empty).toBeGreaterThan(450);
    expect(empty).toBeLessThan(750);
  });
});
