import { describe, expect, it } from 'vitest';
import { BUILTIN_FOODS } from '../src/foods';
import { parseText, splitItems } from '../src/parse';
import { carbTarget, remaining, sum } from '../src/nutrition';
import { DEFAULT_TARGETS } from '../src/types';

const p = (t: string) => parseText(t, BUILTIN_FOODS);

describe('quick-add parser', () => {
  it('parses a typical breakfast', () => {
    const items = p('86g oatmeal dry, 100g blueberries, 2 scoops protein powder (optimum nutrition), 3 fish oil soft gels');
    expect(items.map((i) => [i.food?.id, i.qty, i.unit, Math.round(i.grams!)])).toEqual([
      ['b:oats-dry', 86, 'g', 86],
      ['b:blueberries', 100, 'g', 100],
      ['b:on-whey', 2, 'scoop', 62],
      ['b:fish-oil', 3, 'softgel', 3],
    ]);
    const total = sum(items.map((i) => i.macros));
    expect(Math.round(total.protein)).toBe(60); // 11.4 + 0.7 + 48 + 0
    expect(Math.round(items[2].macros.kcal)).toBe(240);
    expect(Math.round(items[3].macros.kcal)).toBe(30);
  });

  it('handles units, word numbers, fractions and trailing quantities', () => {
    const [a, b, c, d, e, f] = p('2 eggs; a banana; 1 1/2 cups white rice cooked; oatmeal 40g; 6 oz chicken breast; ½ tbsp olive oil');
    expect([a.food?.id, a.qty, a.unit]).toEqual(['b:egg', 2, 'egg']);
    expect([b.food?.id, b.qty, b.unit]).toEqual(['b:banana', 1, 'medium']);
    expect([c.food?.id, c.qty, c.unit, c.grams]).toEqual(['b:rice-white', 1.5, 'cup', 237]);
    expect([d.food?.id, d.grams]).toEqual(['b:oats-dry', 40]);
    expect([e.food?.id, Math.round(e.grams!)]).toEqual(['b:chicken-breast', 170]);
    expect([f.food?.id, f.qty, f.unit]).toEqual(['b:olive-oil', 0.5, 'tbsp']);
  });

  it('keeps "half and half" together but splits "and 2 eggs"', () => {
    expect(splitItems('2 tbsp half and half and 2 eggs')).toEqual(['2 tbsp half and half', '2 eggs']);
    expect(p('2 tbsp half and half')[0].food?.id).toBe('b:half-and-half');
  });

  it('respects dry vs cooked', () => {
    expect(p('80g rice dry')[0].food?.id).toBe('b:rice-white-dry');
    expect(p('200g cooked rice')[0].food?.id).toBe('b:rice-white');
    expect(p('oatmeal')[0].food?.id).toBe('b:oats-dry');
  });

  it('reads quick macro entries', () => {
    const [q] = p('burrito 900 kcal 45p 35f 100c');
    expect(q.quick?.name).toBe('burrito');
    expect(q.macros).toMatchObject({ kcal: 900, protein: 45, fat: 35, carbs: 100 });
  });

  it('knows mini (street taco) tortillas', () => {
    const [t] = p('4 mini corn tortillas');
    expect([t.food?.id, t.qty, t.unit, t.grams]).toEqual(['b:tortilla-corn', 4, 'mini tortilla', 52]);
  });

  it('bare numbers ≥ 20 are grams', () => {
    expect(p('150 chicken breast')[0].grams).toBe(150);
  });

  it('flags unknown foods', () => {
    expect(p('3 zorblax')[0].food).toBeUndefined();
  });
});

describe('targets', () => {
  it('carbs default to the remaining calories', () => {
    expect(carbTarget(DEFAULT_TARGETS)).toBe(393); // (3000 - 800 - 630) / 4
  });
  it('remaining carbs leave room for protein still needed and fat still allowed', () => {
    const r = remaining(DEFAULT_TARGETS, { kcal: 1000, protein: 100, fat: 30, carbs: 125, fiber: 0 });
    expect(r.protein).toBe(100);
    expect(r.fat).toBe(40);
    expect(r.carbs).toBe((2000 - 400 - 360) / 4);
  });
});
