import type { Entry, Macros, Meal } from './types';
import { MEALS } from './types';
import { describeQty, round1 } from './nutrition';

/**
 * Food entries as lines in a workout-log repo's per-day JSONL files (db/YYYY/MM/DD.jsonl), next
 * to lines written by other tools. Those other lines are never parsed beyond their timestamp and
 * are written back byte for byte.
 *
 *   {"ts": "2026-11-07T08:05:00-08:00", "type": "food", "id": "e:…", "meal": "breakfast",
 *    "food": "Rolled oats (dry)", "food_id": "b:oats-dry", "qty": 86, "unit": "g", "grams": 86,
 *    "kcal": 326, "protein_g": 11.4, "fat_g": 5.6, "carbs_g": 58.2, "fiber_g": 8.7,
 *    "source": "app", "raw": "86g oatmeal dry"}
 */

export const FOOD_TYPE = 'food';

const MEAL_TIME: Record<Meal, [number, number]> = { breakfast: [8, 0], lunch: [12, 30], dinner: [18, 30], snack: [15, 0] };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "2026-11-07T08:05:00-08:00": local time with the device's UTC offset at that moment. */
export function isoWithOffset(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

function localDateOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The timestamp for an entry's line: when it was logged, or the meal's usual time if logged on another day. */
export function entryTs(e: Entry): string {
  if (e.ts) return e.ts;
  const at = new Date(e.at);
  if (!Number.isNaN(at.getTime()) && localDateOf(at) === e.date) return isoWithOffset(at);
  const [y, m, d] = e.date.split('-').map(Number);
  const [hh, mm] = MEAL_TIME[e.meal];
  return isoWithOffset(new Date(y, m - 1, d, hh, mm));
}

/** JSON with Python's json.dumps spacing ({"a": 1, "b": [2, 3]}), matching the existing repo lines. */
export function pyJson(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(pyJson).join(', ')}]`;
  if (typeof v === 'object') {
    return `{${Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => `${JSON.stringify(k)}: ${pyJson(x)}`)
      .join(', ')}}`;
  }
  return JSON.stringify(v);
}

export function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function entryToLine(e: Entry): string {
  if (e.remoteLine) return e.remoteLine;
  return pyJson({
    ts: entryTs(e),
    type: FOOD_TYPE,
    id: e.id,
    meal: e.meal,
    food: e.name,
    food_id: e.foodId,
    qty: e.qty,
    unit: e.unit,
    grams: e.grams != null ? round1(e.grams) : undefined,
    kcal: Math.round(e.kcal),
    protein_g: round1(e.protein),
    fat_g: round1(e.fat),
    carbs_g: round1(e.carbs),
    fiber_g: round1(e.fiber),
    source: e.source ?? 'app',
    raw: e.raw ?? (e.unit === 'serving' && e.qty === 1 ? e.name : `${describeQty(e.qty, e.unit)} ${e.name}`),
  });
}

type Obj = Record<string, unknown>;
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

function readMacros(o: Obj): Macros | null {
  const kcal = num(o.kcal) ?? num(o.calories);
  const protein = num(o.protein_g) ?? num(o.protein);
  const fat = num(o.fat_g) ?? num(o.fat);
  const carbs = num(o.carbs_g) ?? num(o.carbs);
  if (kcal == null && protein == null && fat == null && carbs == null) return null;
  const p = protein ?? 0;
  const f = fat ?? 0;
  const c = carbs ?? 0;
  return { kcal: kcal ?? Math.round(p * 4 + c * 4 + f * 9), protein: p, fat: f, carbs: c, fiber: num(o.fiber_g) ?? num(o.fiber) ?? 0 };
}

function mealAt(ts: string | undefined): Meal {
  const d = ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return 'snack';
  // the hour as written in the timestamp, not converted to this device's zone
  const h = Number(/T(\d{2})/.exec(ts!)?.[1] ?? d.getHours());
  return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}

/** A food line read from the repo. `needsMacros` is set when the line names a food but gives no numbers. */
export interface RemoteFood {
  entry: Entry;
  needsMacros: boolean;
}

export function lineToEntry(o: Obj, text: string, date: string): RemoteFood {
  const ts = str(o.ts);
  const m = readMacros(o);
  const meal = (MEALS as readonly string[]).includes(String(o.meal)) ? (o.meal as Meal) : mealAt(ts);
  const at = ts && !Number.isNaN(Date.parse(ts)) ? new Date(ts).toISOString() : `${date}T12:00:00.000Z`;
  return {
    needsMacros: !m,
    entry: {
      id: str(o.id) ?? `r:${hash(text)}`,
      date,
      meal,
      foodId: str(o.food_id),
      name: str(o.food) ?? str(o.name) ?? str(o.raw) ?? 'Food',
      qty: num(o.qty) ?? 1,
      unit: str(o.unit) ?? 'serving',
      grams: num(o.grams),
      ...(m ?? { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }),
      at,
      ts,
      raw: str(o.raw),
      source: str(o.source),
      remoteLine: text,
    },
  };
}

export interface DayFile {
  foods: RemoteFood[];
  /** Every line that isn't a food entry, verbatim, in file order. */
  others: string[];
}

export function parseDayFile(text: string, date: string): DayFile {
  const out: DayFile = { foods: [], others: [] };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let o: unknown = null;
    try {
      o = JSON.parse(line);
    } catch {
      /* not JSON: keep it as-is */
    }
    if (o && typeof o === 'object' && (o as Obj).type === FOOD_TYPE) out.foods.push(lineToEntry(o as Obj, line, date));
    else out.others.push(line);
  }
  return out;
}

function lineTime(line: string): number | null {
  const m = /"ts"\s*:\s*"([^"]+)"/.exec(line);
  if (!m) return null;
  const t = Date.parse(m[1]);
  return Number.isNaN(t) ? null : t;
}

/**
 * The day's file with its food lines replaced by `foods`. Other lines keep their order and text;
 * food lines are slotted in by timestamp so the file stays chronological.
 */
export function composeDay(others: string[], foods: Entry[]): string {
  const foodLines = foods
    .map((e) => ({ line: entryToLine(e), t: Date.parse(entryTs(e)) }))
    .sort((a, b) => a.t - b.t);
  const out: string[] = [];
  let i = 0;
  for (const line of others) {
    const t = lineTime(line);
    if (t != null) while (i < foodLines.length && foodLines[i].t < t) out.push(foodLines[i++].line);
    out.push(line);
  }
  while (i < foodLines.length) out.push(foodLines[i++].line);
  return out.length ? out.join('\n') + '\n' : '';
}

/**
 * Three-way merge of one day's food entries, by id.
 *  - base: ids present after the last sync of this day (empty if never synced)
 *  - local: the app's entries now. One that still carries `remoteLine` is unchanged since it was
 *    synced; one without it was added or edited on this device.
 *  - remote: the entries in the repo now
 * Additions on either side are kept. An entry on both sides takes the local version only if it was
 * edited here. A deletion wins over an unchanged entry; an entry edited here survives a deletion
 * in the repo, so no edit is lost silently.
 */
export function mergeDay(base: Set<string>, local: Entry[], remote: Entry[]): Entry[] {
  const L = new Map(local.map((e) => [e.id, e]));
  const R = new Map(remote.map((e) => [e.id, e]));
  const out: Entry[] = [];
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(id);
    const r = R.get(id);
    if (l && r) out.push(l.remoteLine ? r : l);
    else if (l) {
      if (!base.has(id) || !l.remoteLine) out.push(l);
    } else if (r && !base.has(id)) out.push(r);
  }
  return out.sort((a, b) => Date.parse(entryTs(a)) - Date.parse(entryTs(b)));
}

/** Whether two entry lists would write the same lines (ignoring order). */
export function sameLines(a: Entry[], b: Entry[]): boolean {
  if (a.length !== b.length) return false;
  const x = a.map(entryToLine).sort();
  const y = b.map(entryToLine).sort();
  return x.every((l, i) => l === y[i]);
}
