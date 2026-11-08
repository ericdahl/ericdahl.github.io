import { describe, expect, it } from 'vitest';
import {
  addPotion, addToInventory, addXp, allocStat, canLearn, choosePotion, computeStats, createCharacter, equipFromInventory, findSpace,
  learnSkill, migrateCharacter, potionCount, skillLevel, sortGrid, takePotion, xpForLevel, INV_COLS, INV_ROWS, SAVE_VERSION, type Character,
} from '../src/game/character';
import { baseOf, makeItem } from '../src/game/items';
import { SKILL_BY_ID } from '../src/game/skills';
import { World } from '../src/game/world';
import v1Save from './fixtures/save-v1.json';

describe('character', () => {
  it('starts with class gear and a starter skill', () => {
    const c = createCharacter('Kor', 'reaver');
    expect(c.equipment.weapon?.base).toBe('short_sword');
    expect(c.equipment.offhand?.base).toBe('buckler');
    expect(c.skills.bash).toBe(1);
    expect(c.hotbar[1]).toBe('bash');
    const s = computeStats(c);
    expect(s.maxLife).toBe(55);
    expect(s.block).toBeGreaterThan(0);
  });

  it('levels up with stat and skill points', () => {
    const c = createCharacter('A', 'arcanist');
    expect(addXp(c, xpForLevel(3))).toBe(2);
    expect(c.level).toBe(3);
    expect(c.statPoints).toBe(10);
    expect(c.skillPoints).toBe(2);
    const before = computeStats(c).maxMana;
    allocStat(c, 'ene');
    expect(computeStats(c).maxMana).toBe(before + 2);
  });

  it('enforces skill requirements and prerequisites', () => {
    const c = createCharacter('H', 'huntress');
    c.skillPoints = 5;
    expect(canLearn(c, SKILL_BY_ID.multishot)).toMatch(/level/);
    c.level = 6;
    expect(learnSkill(c, 'multishot')).toBe(true);
    expect(c.hotbar).toContain('multishot');
    expect(canLearn(c, SKILL_BY_ID.bash)).toBe('Wrong class');
    c.level = 12;
    expect(canLearn(c, SKILL_BY_ID.evade)).toMatch(/Critical Eye/);
  });

  it('+skills only boost learned skills', () => {
    const c = createCharacter('A', 'arcanist');
    const amu = makeItem('amulet', 1, 'magic');
    amu.mods = [{ stat: 'skills_arcanist', value: 2 }];
    c.equipment.amulet = amu;
    expect(skillLevel(c, 'fire_bolt')).toBe(3);
    expect(skillLevel(c, 'ice_bolt')).toBe(0);
  });

  it('two-handed weapons swap out the shield', () => {
    const c = createCharacter('K', 'reaver');
    c.level = 20;
    c.alloc.str = 60;
    const axe = makeItem('great_axe');
    addToInventory(c, axe);
    expect(equipFromInventory(c, axe.uid)).toBeNull();
    expect(c.equipment.weapon?.uid).toBe(axe.uid);
    expect(c.equipment.offhand).toBeUndefined();
    expect(c.inventory.map((e) => e.item.base).sort()).toEqual(['buckler', 'short_sword']);
  });

  it('refuses gear above requirements', () => {
    const c = createCharacter('A', 'arcanist');
    const plate = makeItem('plate_mail');
    addToInventory(c, plate);
    expect(equipFromInventory(c, plate.uid)).toMatch(/Strength/);
  });

  it('inventory grid respects item sizes', () => {
    const c = createCharacter('A', 'arcanist');
    let n = 0;
    while (addToInventory(c, makeItem('quilted_armor'))) n++;
    // 2x3 items: 5 columns of pairs, one row band of 3 within 4 rows.
    expect(n).toBe(5);
    expect(findSpace(c.inventory, INV_COLS, INV_ROWS, 1, 1)).not.toBeNull();
    expect(findSpace(c.inventory, INV_COLS, INV_ROWS, 2, 2)).toBeNull();
  });

  describe('rearranging the grid', () => {
    /** One gem in every odd column of row 1 leaves no 2x3 gap, with most of the bag empty. */
    function scattered() {
      const c = createCharacter('A', 'arcanist');
      c.inventory = [1, 3, 5, 7, 9].map((x) => ({ item: makeItem('gem_ruby_1'), x, y: 1 }));
      return c;
    }
    const expectValidLayout = (c: Character) => {
      const cells = new Set<string>();
      for (const e of c.inventory) {
        const b = baseOf(e.item);
        expect(e.x + b.w).toBeLessThanOrEqual(INV_COLS);
        expect(e.y + b.h).toBeLessThanOrEqual(INV_ROWS);
        for (let x = e.x; x < e.x + b.w; x++) for (let y = e.y; y < e.y + b.h; y++) cells.add(`${x},${y}`);
      }
      expect(cells.size).toBe(c.inventory.reduce((n, e) => n + baseOf(e.item).w * baseOf(e.item).h, 0));
    };

    it('makes room for an item that fits only after rearranging', () => {
      const c = scattered();
      const uids = c.inventory.map((e) => e.item.uid);
      const armor = makeItem('quilted_armor');
      expect(findSpace(c.inventory, INV_COLS, INV_ROWS, 2, 3)).toBeNull();
      expect(addToInventory(c, armor)).toBe(true);
      expect(c.inventory.map((e) => e.item.uid).sort((a, b) => a - b)).toEqual([...uids, armor.uid].sort((a, b) => a - b));
      expectValidLayout(c);
    });

    it('leaves the layout alone when there is an open gap', () => {
      const c = scattered();
      const before = structuredClone(c.inventory);
      expect(addToInventory(c, makeItem('gem_ruby_1'))).toBe(true);
      expect(c.inventory.slice(0, 5)).toEqual(before);
    });

    it('leaves the layout alone when the item cannot fit at all', () => {
      const c = createCharacter('A', 'arcanist');
      while (addToInventory(c, makeItem('quilted_armor')));
      const before = structuredClone(c.inventory);
      expect(addToInventory(c, makeItem('quilted_armor'))).toBe(false);
      expect(c.inventory).toEqual(before);
    });

    it('sorts into a compact layout and keeps every item', () => {
      const c = scattered();
      c.inventory.push({ item: makeItem('quilted_armor'), x: 3, y: 2 } as never);
      c.inventory[5].y = 2;
      expect(sortGrid(c.inventory, INV_COLS, INV_ROWS)).toBe(true);
      expect(c.inventory.length).toBe(6);
      expectValidLayout(c);
      expect(baseOf(c.inventory[0].item).id).toBe('quilted_armor');
      expect(c.inventory[0]).toMatchObject({ x: 0, y: 0 });
      expect(c.inventory.slice(1).map((e) => [e.x, e.y])).toEqual([[0, 3], [1, 3], [2, 0], [2, 1], [2, 2]]);
    });
  });

  it('potion pools are capped by the belt', () => {
    const c = createCharacter('A', 'arcanist');
    c.potions = { hp1: 8 };
    expect(addPotion(c, 'hp1')).toBe(false);
    expect(addPotion(c, 'gem_ruby_1')).toBe(false);
    // Pools are separate.
    expect(addPotion(c, 'mp1')).toBe(true);
    c.equipment.belt = makeItem('belt');
    expect(addPotion(c, 'hp1')).toBe(true);
    expect(potionCount(c, 'hp')).toBe(9);
    takePotion(c, 'mp1');
    expect(c.potions.mp1).toBeUndefined();
  });

  it('a full pool trades its weakest potion up but never down', () => {
    const c = createCharacter('A', 'arcanist');
    c.potions = { hp1: 1, hp2: 7 };
    expect(addPotion(c, 'hp3')).toBe(true);
    expect(c.potions).toEqual({ hp2: 7, hp3: 1 });
    expect(addPotion(c, 'hp1')).toBe(false);
    expect(addPotion(c, 'hp2')).toBe(false);
    expect(c.potions).toEqual({ hp2: 7, hp3: 1 });
  });

  it('picks the smallest potion that covers the need, else the strongest', () => {
    const c = createCharacter('A', 'arcanist');
    c.potions = { hp1: 1, hp2: 1, hp3: 1 };
    expect(choosePotion(c, 'hp', 25)).toBe('hp1');
    expect(choosePotion(c, 'hp', 50)).toBe('hp2');
    expect(choosePotion(c, 'hp', 300)).toBe('hp3');
    expect(choosePotion(c, 'mp', 10)).toBeNull();
  });

  describe('migrating a version 1 save', () => {
    const hero = () => structuredClone(v1Save) as unknown as Character & { belt?: string[][] };

    it('moves belt and backpack potions into pools and keeps everything else', () => {
      const c = hero();
      expect(migrateCharacter(c)).toBe(true);
      expect(c.version).toBe(SAVE_VERSION);
      expect(c.belt).toBeUndefined();
      expect(c.potions).toEqual({ hp1: 5, hp2: 1, hp3: 1, mp1: 1, mp2: 12, rejuv: 1 });
      expect(c.inventory.map((e) => e.item.base)).toEqual(['gem_ruby_1', 'short_sword']);
      expect(c.stash.map((e) => e.item.base)).toEqual(['hp4']);
    });

    it('keeps potions above the cap', () => {
      const c = hero();
      migrateCharacter(c);
      expect(potionCount(c, 'mp')).toBe(13);
      expect(computeStats(c).potionCap).toBe(12);
    });

    it('only runs once', () => {
      const c = hero();
      migrateCharacter(c);
      const after = structuredClone(c);
      expect(migrateCharacter(c)).toBe(false);
      expect(c).toEqual(after);
    });

    it('produces a hero the game can play, drink and restock from the stash', () => {
      const c = hero();
      migrateCharacter(c);
      const w = new World(c, 1);
      w.step(1 / 30);
      expect(w.usePotion('rejuv')).toBe(true);
      expect(w.fromStash(c.stash[0].item.uid)).toBe(true);
      expect(c.potions.hp4).toBe(1);
      expect(c.stash).toEqual([]);
    });
  });

  it('resistances suffer difficulty penalties and cap at 75', () => {
    const c = createCharacter('A', 'arcanist');
    const r = makeItem('ring', 1, 'magic');
    r.mods = [{ stat: 'allRes', value: 90 }];
    c.equipment.ring1 = r;
    expect(computeStats(c).res.fire).toBe(75);
    r.mods = [{ stat: 'allRes', value: 20 }];
    c.difficulty = 2;
    expect(computeStats(c).res.cold).toBe(-40);
  });
});
