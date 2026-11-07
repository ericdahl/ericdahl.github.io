import type { Entry, Food, Macros, Targets } from './types';
import { ZERO } from './types';

const MASS: Record<string, number> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592, mg: 0.001 };
const VOLUME: Record<string, number> = { ml: 1, l: 1000, cup: 240, tbsp: 15, tsp: 5, 'fl oz': 29.57 };

/** Canonical spelling for a unit word, or the word itself (a serving name) if it's not a standard unit. */
export function canonicalUnit(u: string): string {
  const w = u.toLowerCase().replace(/\.$/, '').trim();
  const map: Record<string, string> = {
    g: 'g', gr: 'g', gram: 'g', grams: 'g', gm: 'g', gms: 'g',
    kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
    mg: 'mg',
    oz: 'oz', ounce: 'oz', ounces: 'oz',
    lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
    ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
    l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
    cup: 'cup', cups: 'cup', c: 'cup',
    tbsp: 'tbsp', tbsps: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', tbl: 'tbsp',
    tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
    floz: 'fl oz', 'fl oz': 'fl oz',
    serving: 'serving', servings: 'serving',
  };
  return map[w] ?? w;
}

export function isStandardUnit(u: string): boolean {
  const c = canonicalUnit(u);
  return c in MASS || c in VOLUME || c === 'serving';
}

/** Simple English singular for matching serving names ("scoops" → "scoop", "softgels" → "softgel"). */
export function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(ches|shes|xes|ses|oes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function findServing(food: Food, unit: string) {
  const u = singular(unit.toLowerCase().trim());
  return food.servings.find((s) => singular(s.name.toLowerCase()) === u);
}

/** Grams for qty×unit of a food. `approx` is set when a volume is converted at water density. */
export function toGrams(food: Food, qty: number, unit: string): { grams: number; approx: boolean } {
  const c = canonicalUnit(unit);
  const serving = findServing(food, c) ?? findServing(food, unit);
  if (serving) return { grams: qty * serving.grams, approx: false };
  if (c in MASS) return { grams: qty * MASS[c], approx: false };
  if (c === 'serving') {
    const s = food.servings.find((x) => x.name === food.defaultServing) ?? food.servings[0];
    return { grams: qty * (s?.grams ?? 100), approx: !s };
  }
  if (c in VOLUME) return { grams: qty * VOLUME[c], approx: true };
  return { grams: qty * 100, approx: true };
}

export function scale(per100: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    fat: per100.fat * f,
    carbs: per100.carbs * f,
    fiber: per100.fiber * f,
  };
}

export function add(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, protein: a.protein + b.protein, fat: a.fat + b.fat, carbs: a.carbs + b.carbs, fiber: a.fiber + b.fiber };
}

export function sum(items: Macros[]): Macros {
  return items.reduce(add, { ...ZERO });
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function roundMacros(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein: round1(m.protein), fat: round1(m.fat), carbs: round1(m.carbs), fiber: round1(m.fiber) };
}

/** Carbs target in grams: fixed, or whatever calories remain after protein and the fat cap. */
export function carbTarget(t: Targets): number {
  if (t.carbs != null) return t.carbs;
  return Math.max(0, Math.round((t.kcal - t.protein * 4 - t.fat * 9) / 4));
}

export interface Remaining {
  kcal: number;
  protein: number;
  fat: number;
  /** Carbs that still fit: the calories left after the protein still needed and the fat still allowed. */
  carbs: number;
}

export function remaining(t: Targets, eaten: Macros): Remaining {
  const kcal = t.kcal - eaten.kcal;
  const protein = Math.max(0, t.protein - eaten.protein);
  const fat = Math.max(0, t.fat - eaten.fat);
  const carbsByKcal = (kcal - protein * 4 - fat * 9) / 4;
  const carbs = t.carbs != null ? Math.min(t.carbs - eaten.carbs, carbsByKcal) : carbsByKcal;
  return { kcal, protein, fat, carbs: Math.max(0, carbs) };
}

export function entryMacros(e: Entry): Macros {
  return { kcal: e.kcal, protein: e.protein, fat: e.fat, carbs: e.carbs, fiber: e.fiber };
}

/** Pretty quantity: 1.5 → "1.5", 0.333 → "0.33", 86 → "86". */
export function fmtQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export function fmtUnit(qty: number, unit: string): string {
  if (unit === 'g' || unit === 'ml' || unit === 'kg' || unit === 'oz' || unit === 'lb' || unit === 'l' || unit === 'mg' || unit === 'fl oz') return unit;
  if (qty === 1 || unit === 'tbsp' || unit === 'tsp') return unit;
  if (/(s|sh|ch|x)$/.test(unit)) return unit + 'es';
  if (/[^aeiou]y$/.test(unit)) return unit.slice(0, -1) + 'ies';
  return unit + 's';
}

export function describeQty(qty: number, unit: string): string {
  const u = fmtUnit(qty, unit);
  return /^(g|ml|mg|kg|oz|lb|l)$/.test(unit) ? `${fmtQty(qty)} ${u}`.replace(/ (g|ml|mg)$/, '$1') : `${fmtQty(qty)} ${u}`;
}
