import { describe, expect, it } from 'vitest';
import { createCharacter } from '../src/game/character';
import { makeItem } from '../src/game/items';
import { compareEquip, defaultSlot } from '../src/ui/compare';

describe('gear comparison', () => {
  it('shows what a better weapon changes and what it replaces', () => {
    const c = createCharacter('T', 'reaver');
    const axe = makeItem('hand_axe');
    axe.mods = [{ stat: 'fireRes', value: 20 }];
    const cmp = compareEquip(c, axe, defaultSlot(c, axe)!);
    expect(cmp.slot).toBe('weapon');
    expect(cmp.replaced.map((i) => i.base)).toEqual(['short_sword']);
    const fire = cmp.changes.find((ch) => ch.label === 'Fire Resist')!;
    expect(fire).toMatchObject({ before: '0%', after: '20%' });
    expect(fire.better).toBeGreaterThan(0);
  });

  it('a two-hander also takes off the shield', () => {
    const c = createCharacter('T', 'reaver');
    const staff = makeItem('short_staff');
    const cmp = compareEquip(c, staff, 'weapon');
    expect(cmp.replaced.map((i) => i.base).sort()).toEqual(['buckler', 'short_sword']);
    const def = cmp.changes.find((ch) => ch.label === 'Defense')!;
    expect(def.better).toBeLessThan(0);
  });

  it('rings go to a free hand first, and an identical item changes nothing', () => {
    const c = createCharacter('T', 'arcanist');
    const ring = makeItem('ring');
    expect(defaultSlot(c, ring)).toBe('ring1');
    c.equipment.ring1 = makeItem('ring');
    expect(defaultSlot(c, ring)).toBe('ring2');
    c.equipment.ring2 = makeItem('ring');
    expect(defaultSlot(c, ring)).toBe('ring1');
    expect(compareEquip(c, ring, 'ring1').changes).toEqual([]);
  });

  it('lower cast time counts as better', () => {
    const c = createCharacter('T', 'arcanist');
    const amu = makeItem('amulet');
    amu.mods = [{ stat: 'fcr', value: 20 }];
    const ch = compareEquip(c, amu, 'amulet').changes.find((x) => x.label === 'Cast Time')!;
    expect(ch.better).toBeGreaterThan(0);
  });
});
