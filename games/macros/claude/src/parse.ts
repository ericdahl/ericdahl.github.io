import type { Food, Macros } from './types';
import { canonicalUnit, isStandardUnit, scale, singular, toGrams } from './nutrition';

/** One line of quick-add text, resolved to a food (or a plain macro entry). */
export interface ParsedItem {
  text: string;
  qty: number;
  unit: string;
  food?: Food;
  /** Other plausible foods, best first, for the "not this one?" picker. */
  alternatives: Food[];
  grams?: number;
  /** The amount was guessed (unknown unit, or a volume converted at water density). */
  approx: boolean;
  macros: Macros;
  /** For "450 kcal 30p 20f burrito" style entries with no food. */
  quick?: { name: string };
}

const STOP = new Set(['of', 'a', 'an', 'the', 'with', 'some', 'my', 'x', 'and', 'in', 'for', 'to']);
const WORD_NUM: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, quarter: 0.25,
};
const FRACTIONS: Record<string, string> = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[½¼¾⅓⅔⅛]/g, (c) => FRACTIONS[c])
    .replace(/[()[\]{}"“”]/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(s: string): string[] {
  return normalize(s)
    .replace(/[^a-z0-9%&\s'/-]/g, ' ')
    .split(/[\s/-]+/)
    .map((w) => singular(w.replace(/'s$/, '').replace(/'/g, '')))
    .filter((w) => w && !STOP.has(w));
}

function parseNumber(tok: string): number | null {
  if (/^\d+(\.\d+)?$/.test(tok)) return Number(tok);
  if (/^\.\d+$/.test(tok)) return Number(tok);
  const f = /^(\d+)\/(\d+)$/.exec(tok);
  if (f && Number(f[2]) > 0) return Number(f[1]) / Number(f[2]);
  return null;
}

/** Splits "86g oats, 100g blueberries and 2 eggs" into item chunks, keeping "half and half" whole. */
export function splitItems(text: string): string[] {
  return text
    .split(/[,;\n]|\s\+\s|\splus\s/i)
    .flatMap((part) => part.split(/\s(?:and|&)\s(?=\s*(?:\d|a\s|an\s|one\s|two\s|three\s))/i))
    .map((s) => s.trim())
    .filter(Boolean);
}

interface Index {
  food: Food;
  words: Set<string>;
  nameWords: string[];
  phrases: string[];
  servingWords: Set<string>;
}

const indexCache = new WeakMap<Food, Index>();

function indexOf(food: Food): Index {
  let ix = indexCache.get(food);
  if (!ix) {
    const nameWords = words(food.name);
    const all = [...nameWords, ...words(food.brand ?? ''), ...(food.aliases ?? []).flatMap(words)];
    const phrases = [food.name, ...(food.aliases ?? []), food.brand ? `${food.brand} ${food.name}` : ''].map((p) => words(p).sort().join(' ')).filter(Boolean);
    ix = {
      food,
      words: new Set(all),
      nameWords,
      phrases,
      servingWords: new Set(food.servings.flatMap((s) => words(s.name))),
    };
    indexCache.set(food, ix);
  }
  return ix;
}

/** How well a food matches query words, 0..~1.6. `usage` is how often the food was logged. */
export function scoreFood(food: Food, query: string[], usage = 0): number {
  if (!query.length) return 0;
  const ix = indexOf(food);
  let hit = 0;
  for (const q of query) {
    if (ix.words.has(q)) hit += 1;
    else if (q.length >= 3 && [...ix.words].some((w) => w.startsWith(q) || (w.length >= 4 && q.startsWith(w)))) hit += 0.7;
    else if (ix.servingWords.has(q)) hit += 0.35;
  }
  const coverage = hit / query.length;
  if (coverage === 0) return 0;
  const qset = new Set(query);
  const precision = ix.nameWords.length ? ix.nameWords.filter((w) => qset.has(w)).length / ix.nameWords.length : 0;
  const phrase = [...query].sort().join(' ');
  const phraseBonus = ix.phrases.includes(phrase) ? 0.35 : ix.phrases.some((p) => p.length > 3 && phrase.includes(p)) ? 0.15 : 0;
  // Qualifiers that change the numbers a lot: don't hand "cooked rice" to someone who weighed it dry.
  const conflict = (a: string, b: string) => (qset.has(a) && ix.nameWords.includes(b) && !ix.words.has(a) ? 0.3 : 0);
  const penalty = conflict('cooked', 'dry') + conflict('cooked', 'raw') + conflict('dry', 'cooked') + conflict('raw', 'cooked');
  const usageBonus = Math.min(0.2, Math.log1p(usage) * 0.06);
  const mine = food.source === 'builtin' ? 0 : 0.05;
  return coverage + precision * 0.25 + phraseBonus + usageBonus + mine - penalty;
}

export function searchFoods(foods: Food[], query: string, usage: Map<string, number> = new Map(), limit = 20): Food[] {
  const q = words(query);
  if (!q.length) return [];
  return foods
    .map((f) => ({ f, s: scoreFood(f, q, usage.get(f.id) ?? 0) }))
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

const QUICK = /(\d+(?:\.\d+)?)\s*(kcal|cals?|calories|p|protein|f|fat|c|carbs?|fib(?:er|re)?)\b/g;

function parseQuick(chunk: string): ParsedItem | null {
  const n = chunk.toLowerCase();
  if (!/\d\s*(kcal|cals?|calories)\b/.test(n)) return null;
  const m: Macros = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  for (const [, v, k] of n.matchAll(QUICK)) {
    const val = Number(v);
    if (/^(kcal|cal|cals|calories)$/.test(k)) m.kcal = val;
    else if (k === 'p' || k === 'protein') m.protein = val;
    else if (k === 'f' || k === 'fat') m.fat = val;
    else if (k.startsWith('fib')) m.fiber = val;
    else m.carbs = val;
  }
  const name = chunk.replace(QUICK, ' ').replace(/\s+/g, ' ').replace(/^[\s,:-]+|[\s,:-]+$/g, '').trim() || 'Quick add';
  return { text: chunk, qty: 1, unit: 'serving', alternatives: [], approx: false, macros: m, quick: { name } };
}

/** Resolve one chunk like "2 scoops protein powder (optimum nutrition)". */
export function parseItem(chunk: string, foods: Food[], usage: Map<string, number> = new Map()): ParsedItem {
  const quick = parseQuick(chunk);
  if (quick) return quick;

  const toks = normalize(chunk).split(' ').filter(Boolean);
  let qty: number | null = null;
  let qi = -1;
  for (let i = 0; i < toks.length; i++) {
    let n = parseNumber(toks[i]);
    if (n == null && i === 0 && toks[i] in WORD_NUM && toks[1] !== 'and') n = WORD_NUM[toks[i]];
    if (n != null) {
      qty = n;
      qi = i;
      // "1 1/2 cups"
      const frac = toks[i + 1] && /^\d+\/\d+$/.test(toks[i + 1]) ? parseNumber(toks[i + 1]) : null;
      if (frac != null && /^\d+$/.test(toks[i])) {
        qty += frac;
        toks.splice(i + 1, 1);
      }
      break;
    }
  }
  let rest = toks.slice();
  let unit = '';
  if (qi >= 0) {
    rest.splice(qi, 1);
    const after = rest.slice(qi);
    const two = after.slice(0, 2).join(' ');
    if (after.length > 1 && isStandardUnit(two)) {
      unit = canonicalUnit(two);
      rest.splice(qi, 2);
    } else if (after.length && (isStandardUnit(after[0]) || after[0] === 'x')) {
      unit = after[0] === 'x' ? '' : canonicalUnit(after[0]);
      rest.splice(qi, 1);
    }
    // "x2" after the food
    if (rest[rest.length - 1] === 'x') rest.pop();
  }
  const query = rest.flatMap((w) => words(w));
  const ranked = foods
    .map((f) => ({ f, s: scoreFood(f, query, usage.get(f.id) ?? 0) }))
    .filter((x) => x.s >= 0.5)
    .sort((a, b) => b.s - a.s);
  const food = ranked[0]?.f;
  const alternatives = ranked.slice(1, 8).map((x) => x.f);
  const amount = qty ?? 1;

  if (!food) return { text: chunk, qty: amount, unit: unit || 'serving', alternatives: [], approx: true, macros: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 } };

  if (!unit) unit = (amount < 20 ? servingFromWords(food, rest) : null) ?? defaultUnit(food, amount);
  return resolve(chunk, food, amount, unit, alternatives);
}

/** A serving name mentioned anywhere in the words, e.g. "3 fish oil soft gels" → "softgel". */
function servingFromWords(food: Food, toks: string[]): string | null {
  const t = toks.map(singular);
  // "soft gels" should find "softgel", so also try each pair of words run together
  const text = ' ' + [...t, ...t.slice(1).map((_, i) => singular(toks[i] + toks[i + 1]))].join(' ') + ' ';
  const byLength = [...food.servings].sort((a, b) => b.name.length - a.name.length);
  for (const s of byLength) {
    const name = s.name.toLowerCase().split(' ').map(singular).join(' ');
    if (text.includes(` ${name} `)) return s.name;
  }
  return null;
}

export function defaultUnit(food: Food, qty: number): string {
  // "150 chicken" means grams; "2 eggs" means eggs.
  if (qty >= 20 || !food.servings.length) return 'g';
  return food.defaultServing ?? food.servings[0].name;
}

export function resolve(text: string, food: Food, qty: number, unit: string, alternatives: Food[] = []): ParsedItem {
  const { grams, approx } = toGrams(food, qty, unit);
  return { text, qty, unit, food, alternatives, grams, approx, macros: scale(food.per100, grams) };
}

export function parseText(text: string, foods: Food[], usage?: Map<string, number>): ParsedItem[] {
  return splitItems(text).map((c) => parseItem(c, foods, usage));
}
