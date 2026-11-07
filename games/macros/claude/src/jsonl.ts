import type { Entry, Food, Macros, Meal, Routine, Serving, Targets } from './types';
import { MEALS } from './types';
import { carbTarget, entryMacros, round1, roundMacros, sum } from './nutrition';

/**
 * JSON Lines export: one self-describing object per line, so an AI (or jq) can read it a line
 * at a time. Field names carry their units. The first line explains the format.
 *
 *   {"type":"meta", ...}       format notes, export time, time zone
 *   {"type":"targets", ...}    daily targets
 *   {"type":"day", ...}        one per day: totals vs targets
 *   {"type":"entry", ...}      one per logged item
 *   {"type":"food", ...}       your own foods (built-ins are omitted), nutrition per 100 g
 *   {"type":"routine", ...}    saved meals
 *
 * Import accepts the same lines, so food or entry lines written by an AI can be pasted back in.
 */

export const FORMAT_VERSION = 1;

interface ExportInput {
  entries: Entry[];
  foods: Food[];
  routines: Routine[];
  targets: Targets;
  /** Food names for routine items. */
  foodName?: (id: string) => string | undefined;
  now?: Date;
}

const r1 = round1;

function macroFields(m: Macros) {
  const x = roundMacros(m);
  return { kcal: x.kcal, protein_g: x.protein, fat_g: x.fat, carbs_g: x.carbs, fiber_g: x.fiber };
}

export function targetsLine(t: Targets) {
  return {
    type: 'targets',
    kcal: t.kcal,
    protein_g_min: t.protein,
    fat_g_max: t.fat,
    carbs_g: carbTarget(t),
    carbs_rule: t.carbs == null ? 'remainder: (kcal - 4*protein - 9*fat) / 4' : 'fixed',
    fiber_g_min: t.fiber,
  };
}

export function dayLines(entries: Entry[], t: Targets) {
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  return [...byDay.keys()].sort().map((date) => {
    const list = byDay.get(date)!;
    const tot = sum(list.map(entryMacros));
    const meals: Partial<Record<Meal, number>> = {};
    for (const m of MEALS) {
      const k = sum(list.filter((e) => e.meal === m).map(entryMacros)).kcal;
      if (k) meals[m] = Math.round(k);
    }
    return {
      type: 'day',
      date,
      ...macroFields(tot),
      items: list.length,
      kcal_by_meal: meals,
      protein_target_met: tot.protein >= t.protein,
      fat_under_max: tot.fat <= t.fat,
      kcal_vs_target: Math.round(tot.kcal - t.kcal),
    };
  });
}

export function entryLine(e: Entry) {
  return {
    type: 'entry',
    id: e.id,
    date: e.date,
    meal: e.meal,
    food: e.name,
    food_id: e.foodId ?? null,
    qty: e.qty,
    unit: e.unit,
    grams: e.grams != null ? r1(e.grams) : null,
    ...macroFields(e),
    logged_at: e.at,
  };
}

export function foodLine(f: Food) {
  return {
    type: 'food',
    id: f.id,
    name: f.name,
    brand: f.brand ?? null,
    per_100g: macroFields(f.per100),
    servings: f.servings.map((s) => ({ name: s.name, grams: s.grams })),
    default_serving: f.defaultServing ?? null,
    aliases: f.aliases ?? [],
    barcode: f.barcode ?? null,
    source: f.source,
  };
}

export function toJsonl(input: ExportInput): string {
  const now = input.now ?? new Date();
  const dates = input.entries.map((e) => e.date).sort();
  const lines: unknown[] = [
    {
      type: 'meta',
      app: 'macros',
      format_version: FORMAT_VERSION,
      exported_at: now.toISOString(),
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      first_date: dates[0] ?? null,
      last_date: dates[dates.length - 1] ?? null,
      notes:
        'Food log, one JSON object per line. Energy in kcal, macros in grams. "day" lines total each date; ' +
        '"entry" lines are individual items with macros already computed for the amount eaten; ' +
        '"food" lines give nutrition per 100 g with named servings in grams. Dates are local calendar days (YYYY-MM-DD).',
    },
    targetsLine(input.targets),
    ...dayLines(input.entries, input.targets),
    ...[...input.entries].sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at)).map(entryLine),
    ...input.foods.map(foodLine),
    ...input.routines.map((r) => ({
      type: 'routine',
      id: r.id,
      name: r.name,
      meal: r.meal ?? null,
      items: r.items.map((i) => ({ food_id: i.foodId, food: input.foodName?.(i.foodId) ?? null, qty: i.qty, unit: i.unit })),
    })),
  ];
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

// ---------- import ----------

export interface ImportResult {
  entries: Entry[];
  foods: Food[];
  routines: Routine[];
  targets?: Targets;
  /** Entry lines that named a food and amount but no macros, for the app to resolve. */
  unresolved: { date: string; meal: Meal; text: string }[];
  errors: string[];
}

type Obj = Record<string, unknown>;

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Read macros from either our names (protein_g) or plain ones (protein, calories). */
function readMacros(o: Obj | undefined): Macros | null {
  if (!o) return null;
  const kcal = num(o.kcal) ?? num(o.calories) ?? num(o.energy_kcal);
  const protein = num(o.protein_g) ?? num(o.protein);
  const fat = num(o.fat_g) ?? num(o.fat);
  const carbs = num(o.carbs_g) ?? num(o.carbs) ?? num(o.carbohydrates_g) ?? num(o.carbohydrates);
  const fiber = num(o.fiber_g) ?? num(o.fiber) ?? 0;
  if (kcal == null && protein == null && fat == null && carbs == null) return null;
  const p = protein ?? 0;
  const f = fat ?? 0;
  const c = carbs ?? 0;
  return { kcal: kcal ?? Math.round(p * 4 + c * 4 + f * 9), protein: p, fat: f, carbs: c, fiber };
}

function readMeal(v: unknown): Meal {
  const s = String(v ?? '').toLowerCase();
  return (MEALS as readonly string[]).includes(s) ? (s as Meal) : 'snack';
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Parse JSONL (or a JSON array) produced by this app or by an AI following its format. */
export function parseImport(text: string): ImportResult {
  const out: ImportResult = { entries: [], foods: [], routines: [], unresolved: [], errors: [] };
  const trimmed = text.trim().replace(/^```(?:jsonl?|ndjson)?\s*|```$/g, '').trim();
  let objects: unknown[] = [];
  if (trimmed.startsWith('[')) {
    try {
      objects = JSON.parse(trimmed);
    } catch (e) {
      out.errors.push(`Not valid JSON: ${(e as Error).message}`);
      return out;
    }
  } else {
    trimmed.split(/\r?\n/).forEach((line, i) => {
      const l = line.trim();
      if (!l || l.startsWith('//') || l.startsWith('#')) return;
      try {
        objects.push(JSON.parse(l));
      } catch {
        out.errors.push(`Line ${i + 1} isn't valid JSON`);
      }
    });
  }

  for (const raw of objects) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Obj;
    const type = str(o.type) ?? (o.per_100g || o.per_serving ? 'food' : o.date ? 'entry' : '');
    if (type === 'food') {
      const name = str(o.name);
      if (!name) {
        out.errors.push('A food line has no name');
        continue;
      }
      const servings: Serving[] = Array.isArray(o.servings)
        ? (o.servings as Obj[]).flatMap((s) => (str(s.name) && num(s.grams) ? [{ name: str(s.name)!, grams: num(s.grams)! }] : []))
        : [];
      let per100 = readMacros(o.per_100g as Obj);
      const perServing = readMacros(o.per_serving as Obj);
      const servingGrams = num(o.serving_grams) ?? num((o.per_serving as Obj | undefined)?.grams);
      const servingName = str(o.serving_name) ?? str((o.per_serving as Obj | undefined)?.name) ?? 'serving';
      if (!per100 && perServing && servingGrams) {
        const f = 100 / servingGrams;
        per100 = { kcal: perServing.kcal * f, protein: perServing.protein * f, fat: perServing.fat * f, carbs: perServing.carbs * f, fiber: perServing.fiber * f };
        if (!servings.some((s) => s.name === servingName)) servings.unshift({ name: servingName, grams: servingGrams });
      }
      if (!per100) {
        out.errors.push(`"${name}" has no per_100g (or per_serving with grams) nutrition`);
        continue;
      }
      const brand = str(o.brand);
      const source = str(o.source);
      out.foods.push({
        id: str(o.id) && !String(o.id).startsWith('b:') ? String(o.id) : `i:${slug((brand ? brand + ' ' : '') + name)}`,
        name,
        brand,
        aliases: Array.isArray(o.aliases) ? (o.aliases as unknown[]).map(String) : [],
        per100: roundMacros(per100),
        servings,
        defaultServing: str(o.default_serving) ?? (servings[0]?.name || undefined),
        source: source === 'custom' || source === 'off' ? source : 'import',
        barcode: str(o.barcode),
      });
    } else if (type === 'entry') {
      const date = str(o.date);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        out.errors.push('An entry line has no date (YYYY-MM-DD)');
        continue;
      }
      const meal = readMeal(o.meal);
      const name = str(o.food) ?? str(o.name) ?? 'Item';
      const m = readMacros(o);
      if (!m) {
        // "2 eggs" with no numbers: let the app look it up
        const qty = num(o.qty);
        out.unresolved.push({ date, meal, text: [qty, str(o.unit), name].filter((x) => x != null && x !== '').join(' ') });
        continue;
      }
      const at = str(o.logged_at) ?? `${date}T12:00:00.000Z`;
      out.entries.push({
        id: str(o.id) ?? `i:${hash(JSON.stringify(o))}`,
        date,
        meal,
        foodId: str(o.food_id),
        name,
        qty: num(o.qty) ?? 1,
        unit: str(o.unit) ?? 'serving',
        grams: num(o.grams),
        ...m,
        at,
      });
    } else if (type === 'routine') {
      const name = str(o.name);
      if (!name || !Array.isArray(o.items)) continue;
      out.routines.push({
        id: str(o.id) ?? `r:${slug(name)}`,
        name,
        meal: o.meal ? readMeal(o.meal) : undefined,
        items: (o.items as Obj[]).flatMap((i) => (str(i.food_id) ? [{ foodId: str(i.food_id)!, qty: num(i.qty) ?? 1, unit: str(i.unit) ?? 'serving' }] : [])),
      });
    } else if (type === 'targets') {
      const kcal = num(o.kcal);
      const protein = num(o.protein_g_min) ?? num(o.protein_g);
      const fat = num(o.fat_g_max) ?? num(o.fat_g);
      if (kcal && protein != null && fat != null) {
        const fixed = o.carbs_rule === 'fixed' ? num(o.carbs_g) : undefined;
        out.targets = { kcal, protein, fat, carbs: fixed ?? null, fiber: num(o.fiber_g_min) ?? null };
      }
    }
  }
  return out;
}

/** Prompt to paste into an AI chat so it replies with food lines this app can import. */
export function aiFoodPrompt(description = '<describe the foods, or attach a photo of the nutrition label>'): string {
  return [
    'Give me nutrition data for the foods below as JSON Lines (one JSON object per line, no other text), in exactly this shape:',
    '{"type":"food","name":"Chicken burrito bowl","brand":"Chipotle","per_serving":{"name":"bowl","grams":550,"kcal":665,"protein_g":52,"fat_g":24,"carbs_g":63,"fiber_g":15},"aliases":["burrito bowl"]}',
    'Use per_serving with the serving\'s weight in grams (or per_100g with the same macro fields instead). Use the label or official numbers when you know them, otherwise a careful estimate.',
    '',
    `Foods: ${description}`,
  ].join('\n');
}
