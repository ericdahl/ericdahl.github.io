import { describe, expect, it } from 'vitest';
import {
  addToBelt, addToInventory, addXp, allocStat, canLearn, computeStats, createCharacter, equipFromInventory, findSpace,
  learnSkill, skillLevel, takeFromBelt, xpForLevel, INV_COLS, INV_ROWS,
} from '../src/game/character';
import { makeItem } from '../src/game/items';
import { SKILL_BY_ID } from '../src/game/skills';

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

  it('belt stacks potions by column', () => {
    const c = createCharacter('A', 'arcanist');
    c.belt = [[], [], [], []];
    expect(addToBelt(c, 'hp1')).toBe(true);
    expect(addToBelt(c, 'hp1')).toBe(true);
    // Without a belt each column holds one potion.
    expect(c.belt.filter((col) => col.length).length).toBe(2);
    c.equipment.belt = makeItem('belt');
    expect(addToBelt(c, 'hp1')).toBe(true);
    expect(c.belt[0].length).toBe(2);
    expect(takeFromBelt(c, 0)).toBe('hp1');
    expect(addToBelt(c, 'gem_ruby_1')).toBe(false);
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
