import { BUILTIN_FOODS } from './foods';
import type { Entry, Food, Meal, Routine, Targets } from './types';
import { DEFAULT_TARGETS } from './types';

/** localStorage that never throws (private browsing, blocked storage) and falls back to memory. */
const memory = new Map<string, string>();
const PREFIX = 'macros.v1.';

function load<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    raw = memory.get(key) ?? null;
  }
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    /* storage unavailable or full: keep the in-memory copy */
  }
}

interface State {
  entries: Entry[];
  foods: Food[];
  routines: Routine[];
  targets: Targets;
}

/**
 * Built-in saved meals. Each is added once per device (tracked in "seeded"), so one added in a
 * later version still appears for existing users, and one the user deleted stays deleted.
 */
const SEED_ROUTINES: Routine[] = [
  {
    id: 'r:morning',
    name: 'Usual breakfast',
    meal: 'breakfast',
    items: [
      { foodId: 'b:oats-dry', qty: 86, unit: 'g' },
      { foodId: 'b:blueberries', qty: 100, unit: 'g' },
      { foodId: 'b:on-whey', qty: 2, unit: 'scoop' },
      { foodId: 'b:fish-oil', qty: 3, unit: 'softgel' },
    ],
  },
  {
    id: 'r:protein-shake',
    name: 'Protein shake',
    items: [{ foodId: 'b:on-whey', qty: 2, unit: 'scoop' }],
  },
  {
    id: 'r:egg-tacos',
    name: 'Egg tacos',
    items: [
      { foodId: 'b:egg', qty: 4, unit: 'egg' },
      { foodId: 'b:tortilla-corn', qty: 4, unit: 'mini tortilla' },
      { foodId: 'b:salsa', qty: 2, unit: 'tbsp' },
    ],
  },
];

function seedRoutines(): Routine[] {
  const stored = load<Routine[] | null>('routines', null);
  // Before seeds were tracked, only the breakfast existed; count it as offered if routines were saved.
  const seeded = new Set(load<string[] | null>('seeded', null) ?? (stored ? ['r:morning'] : []));
  const list = stored ?? [];
  const fresh = SEED_ROUTINES.filter((r) => !seeded.has(r.id) && !list.some((x) => x.id === r.id));
  if (!fresh.length && stored) return stored;
  const out = [...list, ...fresh];
  save('routines', out);
  save('seeded', SEED_ROUTINES.map((r) => r.id));
  return out;
}

const state: State = {
  entries: load<Entry[]>('entries', []),
  foods: load<Food[]>('foods', []),
  routines: seedRoutines(),
  targets: { ...DEFAULT_TARGETS, ...load<Partial<Targets>>('targets', {}) },
};

const listeners = new Set<() => void>();
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed(...keys: (keyof State)[]): void {
  for (const k of keys) save(k, state[k]);
  for (const fn of listeners) fn();
}

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14);
  return prefix + r;
}

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

export function mealForTime(d = new Date()): Meal {
  const h = d.getHours();
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

// ---- foods ----

export function allFoods(): Food[] {
  // user foods first so they win ties and can shadow a built-in with the same id
  const mine = new Set(state.foods.map((f) => f.id));
  return [...state.foods, ...BUILTIN_FOODS.filter((f) => !mine.has(f.id))];
}

export function userFoods(): Food[] {
  return state.foods;
}

export function getFood(id: string | undefined): Food | undefined {
  if (!id) return undefined;
  return state.foods.find((f) => f.id === id) ?? BUILTIN_FOODS.find((f) => f.id === id);
}

export function upsertFood(food: Food): void {
  const i = state.foods.findIndex((f) => f.id === food.id);
  if (i >= 0) state.foods[i] = food;
  else state.foods.unshift(food);
  changed('foods');
}

export function deleteFood(id: string): void {
  state.foods = state.foods.filter((f) => f.id !== id);
  changed('foods');
}

// ---- entries ----

export function entriesFor(date: string): Entry[] {
  return state.entries.filter((e) => e.date === date);
}

export function allEntries(): Entry[] {
  return state.entries;
}

export function addEntries(entries: Entry[]): void {
  state.entries.push(...entries);
  changed('entries');
}

export function updateEntry(entry: Entry): void {
  const i = state.entries.findIndex((e) => e.id === entry.id);
  if (i >= 0) state.entries[i] = entry;
  changed('entries');
}

export function deleteEntry(id: string): Entry | undefined {
  const e = state.entries.find((x) => x.id === id);
  state.entries = state.entries.filter((x) => x.id !== id);
  changed('entries');
  return e;
}

/** How often each food was logged in the last 90 days, for ranking search results. */
export function usageCounts(): Map<string, number> {
  const since = shiftDate(localDate(), -90);
  const m = new Map<string, number>();
  for (const e of state.entries) if (e.foodId && e.date >= since) m.set(e.foodId, (m.get(e.foodId) ?? 0) + 1);
  return m;
}

export interface Frequent {
  foodId?: string;
  name: string;
  qty: number;
  unit: string;
  count: number;
  last: string;
  sample: Entry;
}

/** Portions logged at least twice in 60 days (same food, amount and unit), most used first. */
export function frequentPortions(limit = 12): Frequent[] {
  const since = shiftDate(localDate(), -60);
  const m = new Map<string, Frequent>();
  for (const e of state.entries) {
    if (e.date < since) continue;
    const key = `${e.foodId ?? e.name}|${e.qty}|${e.unit}`;
    const f = m.get(key);
    if (f) {
      f.count++;
      if (e.at > f.last) {
        f.last = e.at;
        f.sample = e;
      }
    } else m.set(key, { foodId: e.foodId, name: e.name, qty: e.qty, unit: e.unit, count: 1, last: e.at, sample: e });
  }
  return [...m.values()]
    .filter((f) => f.count >= 2)
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit);
}

// ---- routines ----

export function routines(): Routine[] {
  return state.routines;
}

export function upsertRoutine(r: Routine): void {
  const i = state.routines.findIndex((x) => x.id === r.id);
  if (i >= 0) state.routines[i] = r;
  else state.routines.push(r);
  changed('routines');
}

export function deleteRoutine(id: string): void {
  state.routines = state.routines.filter((r) => r.id !== id);
  changed('routines');
}

// ---- targets ----

export function targets(): Targets {
  return state.targets;
}

export function setTargets(t: Targets): void {
  state.targets = t;
  changed('targets');
}

/** Merge imported data. Entries and foods with an existing id are replaced. */
export function merge(data: { entries?: Entry[]; foods?: Food[]; routines?: Routine[]; targets?: Targets }): void {
  if (data.entries?.length) {
    const byId = new Map(state.entries.map((e) => [e.id, e]));
    for (const e of data.entries) byId.set(e.id, e);
    state.entries = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  }
  if (data.foods?.length) {
    const byId = new Map(state.foods.map((f) => [f.id, f]));
    for (const f of data.foods) byId.set(f.id, f);
    state.foods = [...byId.values()];
  }
  if (data.routines?.length) {
    const byId = new Map(state.routines.map((r) => [r.id, r]));
    for (const r of data.routines) byId.set(r.id, r);
    state.routines = [...byId.values()];
  }
  if (data.targets) state.targets = data.targets;
  changed('entries', 'foods', 'routines', 'targets');
}

export function clearAll(): void {
  state.entries = [];
  state.foods = [];
  state.routines = [];
  state.targets = { ...DEFAULT_TARGETS };
  changed('entries', 'foods', 'routines', 'targets');
}
