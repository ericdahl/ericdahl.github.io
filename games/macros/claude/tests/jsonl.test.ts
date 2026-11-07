import { describe, expect, it } from 'vitest';
import { BUILTIN_FOODS } from '../src/foods';
import { parseImport, toJsonl } from '../src/jsonl';
import type { Entry, Food } from '../src/types';
import { DEFAULT_TARGETS } from '../src/types';

const entry = (over: Partial<Entry>): Entry => ({
  id: 'e:1', date: '2026-11-07', meal: 'breakfast', foodId: 'b:oats-dry', name: 'Rolled oats (dry)', qty: 86, unit: 'g', grams: 86,
  kcal: 325.94, protein: 11.352, fat: 5.59, carbs: 58.22, fiber: 8.686, at: '2026-11-07T14:00:00.000Z', ...over,
});

const myFood: Food = {
  id: 'c:abc', name: 'Kirkland Greek yogurt', per100: { kcal: 60, protein: 10, fat: 0.5, carbs: 4, fiber: 0 },
  servings: [{ name: 'cup', grams: 227 }], defaultServing: 'cup', source: 'custom',
};

describe('JSONL export', () => {
  const text = toJsonl({
    entries: [entry({}), entry({ id: 'e:2', date: '2026-11-06', meal: 'dinner', kcal: 3200, protein: 150, fat: 90, carbs: 380, fiber: 30 })],
    foods: [myFood],
    routines: [{ id: 'r:1', name: 'Breakfast', items: [{ foodId: 'b:oats-dry', qty: 86, unit: 'g' }] }],
    targets: DEFAULT_TARGETS,
    foodName: (id) => BUILTIN_FOODS.find((f) => f.id === id)?.name,
    now: new Date('2026-11-07T20:00:00Z'),
  });
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));

  it('is one typed object per line, meta first', () => {
    expect(lines.map((l) => l.type)).toEqual(['meta', 'targets', 'day', 'day', 'entry', 'entry', 'food', 'routine']);
    expect(lines[0]).toMatchObject({ app: 'macros', format_version: 1, first_date: '2026-11-06', last_date: '2026-11-07' });
  });

  it('labels units and rounds numbers', () => {
    expect(lines[1]).toMatchObject({ kcal: 3000, protein_g_min: 200, fat_g_max: 70, carbs_g: 393 });
    const e = lines.find((l) => l.type === 'entry' && l.id === 'e:1');
    expect(e).toMatchObject({ food: 'Rolled oats (dry)', qty: 86, unit: 'g', kcal: 326, protein_g: 11.4, fat_g: 5.6, carbs_g: 58.2 });
    const day = lines.find((l) => l.type === 'day' && l.date === '2026-11-06');
    expect(day).toMatchObject({ kcal: 3200, protein_target_met: false, fat_under_max: false, kcal_vs_target: 200 });
    expect(lines.at(-1).items[0]).toEqual({ food_id: 'b:oats-dry', food: 'Rolled oats (dry)', qty: 86, unit: 'g' });
  });

  it('round-trips through import', () => {
    const back = parseImport(text);
    expect(back.errors).toEqual([]);
    expect(back.entries.map((e) => e.id).sort()).toEqual(['e:1', 'e:2']);
    expect(back.entries.find((e) => e.id === 'e:1')).toMatchObject({ date: '2026-11-07', meal: 'breakfast', foodId: 'b:oats-dry', kcal: 326, protein: 11.4 });
    expect(back.foods[0]).toMatchObject({ id: 'c:abc', name: 'Kirkland Greek yogurt', source: 'custom', servings: [{ name: 'cup', grams: 227 }] });
    expect(back.routines[0].items).toEqual([{ foodId: 'b:oats-dry', qty: 86, unit: 'g' }]);
    expect(back.targets).toEqual({ kcal: 3000, protein: 200, fat: 70, carbs: null, fiber: 38 });
  });
});

describe('import from an AI', () => {
  it('accepts per-serving food lines in a code fence, and loose field names', () => {
    const res = parseImport(
      '```jsonl\n' +
        '{"type":"food","name":"Chicken burrito bowl","brand":"Chipotle","per_serving":{"name":"bowl","grams":550,"kcal":665,"protein_g":52,"fat_g":24,"carbs_g":63,"fiber_g":15}}\n' +
        '{"type":"entry","date":"2026-11-05","meal":"Lunch","food":"Burrito","calories":1000,"protein":50,"fat":40,"carbs":110}\n' +
        '{"type":"entry","date":"2026-11-05","meal":"dinner","food":"eggs","qty":3}\n' +
        'not json\n```',
    );
    expect(res.foods[0]).toMatchObject({ id: 'i:chipotle-chicken-burrito-bowl', defaultServing: 'bowl', servings: [{ name: 'bowl', grams: 550 }] });
    expect(res.foods[0].per100.kcal).toBe(121);
    expect(res.entries[0]).toMatchObject({ meal: 'lunch', kcal: 1000, protein: 50 });
    expect(res.unresolved).toEqual([{ date: '2026-11-05', meal: 'dinner', text: '3 eggs' }]);
    expect(res.errors).toEqual(["Line 4 isn't valid JSON"]);
  });

  it('gives a stable id to entries without one, so importing twice does not duplicate', () => {
    const line = '{"type":"entry","date":"2026-11-05","food":"Burrito","kcal":1000}';
    expect(parseImport(line).entries[0].id).toBe(parseImport(line).entries[0].id);
  });
});
