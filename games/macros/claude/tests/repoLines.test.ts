import { describe, expect, it } from 'vitest';
import type { Entry } from '../src/types';
import { composeDay, entryToLine, entryTs, mergeDay, parseDayFile, pyJson } from '../src/repoLines';
import { dayPath, pathDate } from '../src/sync';

// A day file in the workout repo's format (written by a CLI and by Claude), no food yet.
const WORKOUTS = [
  '{"ts": "2026-11-05T07:10:00-08:00", "type": "cardio", "modality": "run", "distance_miles": 3.1, "duration_min": 26.5, "source": "cli", "raw": "/log run 3.1 miles 26:30"}',
  '{"ts": "2026-11-05T17:45:00-08:00", "type": "strength", "exercise": "bench_press", "unit": "lb", "sets": [{"weight": 275.0, "reps": 3}, {"weight": 275.0, "reps": 2}], "source": "claude", "raw": "bench 275 - 3,2"}',
  '{"ts": "2026-11-05T18:05:00-08:00", "type": "note", "notes": "felt strong", "source": "cli", "raw": "/note felt strong"}',
];

const entry = (over: Partial<Entry>): Entry => ({
  id: 'e:1', date: '2026-11-05', meal: 'breakfast', foodId: 'b:oats-dry', name: 'Rolled oats (dry)', qty: 86, unit: 'g', grams: 86,
  kcal: 325.94, protein: 11.352, fat: 5.59, carbs: 58.22, fiber: 8.686, at: '2026-11-05T16:30:00.000Z', raw: '86g oatmeal dry', ...over,
});

describe('food lines', () => {
  it('match the repo\u2019s Python-style JSON and field conventions', () => {
    expect(pyJson({ a: 1, b: [2, { c: 'x' }], d: undefined })).toBe('{"a": 1, "b": [2, {"c": "x"}]}');
    expect(entryToLine(entry({}))).toBe(
      '{"ts": "2026-11-05T08:30:00-08:00", "type": "food", "id": "e:1", "meal": "breakfast", "food": "Rolled oats (dry)", "food_id": "b:oats-dry", ' +
        '"qty": 86, "unit": "g", "grams": 86, "kcal": 326, "protein_g": 11.4, "fat_g": 5.6, "carbs_g": 58.2, "fiber_g": 8.7, "source": "app", "raw": "86g oatmeal dry"}',
    );
  });

  it('use the meal\u2019s usual time when logged on a different day', () => {
    expect(entryTs(entry({ date: '2026-11-03', meal: 'dinner' }))).toBe('2026-11-03T18:30:00-08:00');
    expect(entryTs(entry({ date: '2026-07-03', meal: 'lunch', at: '2026-11-05T16:30:00.000Z' }))).toBe('2026-07-03T12:30:00-07:00');
  });

  it('slot into the day chronologically and leave every other line byte for byte', () => {
    const lunch = entry({ id: 'e:2', meal: 'lunch', name: 'Burrito', foodId: undefined, at: '2026-11-05T20:00:00.000Z', raw: 'burrito 900 kcal' });
    const text = composeDay(WORKOUTS, [lunch, entry({})]);
    const lines = text.trimEnd().split('\n');
    expect(text.endsWith('\n')).toBe(true);
    expect(lines.map((l) => JSON.parse(l).type)).toEqual(['cardio', 'food', 'food', 'strength', 'note']);
    expect(lines.filter((l) => !l.includes('"food"'))).toEqual(WORKOUTS);

    const back = parseDayFile(text, '2026-11-05');
    expect(back.others).toEqual(WORKOUTS);
    expect(back.foods.map((f) => [f.entry.id, f.entry.meal, f.entry.kcal, f.entry.protein, f.entry.raw])).toEqual([
      ['e:1', 'breakfast', 326, 11.4, '86g oatmeal dry'],
      ['e:2', 'lunch', 326, 11.4, 'burrito 900 kcal'],
    ]);
    // unchanged entries write back exactly what was read
    expect(composeDay(back.others, back.foods.map((f) => f.entry))).toBe(text);
  });

  it('read lines Claude wrote by hand: no id, loose fields, missing macros', () => {
    const text = [
      ...WORKOUTS,
      '{"ts": "2026-11-05T19:30:00-08:00", "type": "food", "food": "Chipotle bowl", "calories": 665, "protein": 52, "fat": 24, "carbs": 63, "source": "claude", "raw": "chipotle bowl for dinner"}',
      '{"ts": "2026-11-05T21:30:00-08:00", "type": "food", "food": "eggs", "qty": 4, "unit": "egg", "source": "claude", "raw": "4 eggs"}',
    ].join('\n');
    const day = parseDayFile(text, '2026-11-05');
    const [bowl, eggs] = day.foods;
    expect(bowl.entry).toMatchObject({ meal: 'dinner', kcal: 665, protein: 52, source: 'claude', raw: 'chipotle bowl for dinner' });
    expect(bowl.entry.id).toMatch(/^r:/);
    expect(parseDayFile(text, '2026-11-05').foods[0].entry.id).toBe(bowl.entry.id);
    expect(eggs.needsMacros).toBe(true);
    expect(eggs.entry.meal).toBe('snack');
    // written back untouched, so Claude's lines aren't rewritten just because the app synced
    expect(composeDay(day.others, day.foods.map((f) => f.entry))).toBe(text + '\n');
  });

  it('never drop non-JSON lines', () => {
    expect(composeDay(['not json', ...WORKOUTS], [])).toBe(['not json', ...WORKOUTS].join('\n') + '\n');
    expect(parseDayFile('garbage\n', 'x').others).toEqual(['garbage']);
  });
});

describe('three-way merge', () => {
  const synced = (e: Entry) => ({ ...e, remoteLine: entryToLine(e) });
  const a = synced(entry({ id: 'a' }));
  const b = synced(entry({ id: 'b', at: '2026-11-05T17:00:00.000Z' }));

  it('keeps additions from both sides', () => {
    const mine = entry({ id: 'mine', at: '2026-11-05T18:00:00.000Z' });
    const theirs = synced(entry({ id: 'theirs', at: '2026-11-05T19:00:00.000Z', source: 'claude' }));
    expect(mergeDay(new Set(['a']), [a, mine], [a, theirs]).map((e) => e.id)).toEqual(['a', 'mine', 'theirs']);
  });

  it('applies deletions from either side', () => {
    expect(mergeDay(new Set(['a', 'b']), [a], [a, b]).map((e) => e.id)).toEqual(['a']);
    expect(mergeDay(new Set(['a', 'b']), [a, b], [b]).map((e) => e.id)).toEqual(['b']);
  });

  it('prefers a local edit, otherwise the repo\u2019s version', () => {
    const editedHere = { ...a, qty: 100, remoteLine: undefined };
    expect(mergeDay(new Set(['a']), [editedHere], [a])[0].qty).toBe(100);
    const editedThere = synced({ ...a, qty: 50, remoteLine: undefined });
    expect(mergeDay(new Set(['a']), [a], [editedThere])[0].qty).toBe(50);
  });

  it('keeps an entry edited here even if the repo deleted it', () => {
    expect(mergeDay(new Set(['a']), [{ ...a, qty: 1, remoteLine: undefined }], []).map((e) => e.id)).toEqual(['a']);
  });

  it('merges a never-synced day as a union', () => {
    expect(mergeDay(new Set(), [entry({ id: 'x' })], [b]).map((e) => e.id).sort()).toEqual(['b', 'x']);
  });
});

describe('paths', () => {
  it('map dates to day files and back', () => {
    expect(dayPath('db', '2026-11-05')).toBe('db/2026/11/05.jsonl');
    expect(dayPath('', '2026-11-05')).toBe('2026/11/05.jsonl');
    expect(pathDate('db', 'db/2026/11/05.jsonl')).toBe('2026-11-05');
    expect(pathDate('db', 'db/foods.jsonl')).toBeNull();
    expect(pathDate('db', 'other/2026/11/05.jsonl')).toBeNull();
  });
});
