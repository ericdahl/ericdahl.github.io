import type { Entry, Food, Macros, Meal } from './types';
import { MEALS } from './types';
import { canonicalUnit, describeQty, scale, toGrams } from './nutrition';
import { lookupBarcode, looksWrong } from './off';
import * as store from './store';
import { fmt, g, h, icon, numberInput, readNum, sheet, toast } from './ui';

export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export function makeEntry(food: Food | undefined, name: string, qty: number, unit: string, grams: number | undefined, m: Macros, date: string, meal: Meal): Entry {
  return {
    id: store.uid('e:'),
    date,
    meal,
    foodId: food?.id,
    name: food ? (food.brand ? `${food.name} (${food.brand})` : food.name) : name,
    qty,
    unit,
    grams,
    kcal: m.kcal,
    protein: m.protein,
    fat: m.fat,
    carbs: m.carbs,
    fiber: m.fiber,
    at: new Date().toISOString(),
  };
}

export function entryFor(food: Food, qty: number, unit: string, date: string, meal: Meal): Entry {
  const { grams } = toGrams(food, qty, unit);
  return makeEntry(food, food.name, qty, unit, grams, scale(food.per100, grams), date, meal);
}

export function macroLine(m: Macros): HTMLElement {
  return h(
    'span',
    { class: 'macro-line' },
    h('b', {}, `${fmt(Math.round(m.kcal))} kcal`),
    h('span', { class: 'p' }, `P ${g(m.protein)}`),
    h('span', { class: 'f' }, `F ${g(m.fat)}`),
    h('span', { class: 'c' }, `C ${g(m.carbs)}`),
  );
}

export function unitsFor(food: Food): string[] {
  const list = [...food.servings.map((s) => s.name), 'g', 'oz'];
  if (food.servings.length === 0) list.push('cup', 'tbsp', 'tsp', 'ml');
  return [...new Set(list)];
}

function unitSelect(food: Food, current: string): HTMLSelectElement {
  const units = unitsFor(food);
  if (!units.includes(current)) units.unshift(current);
  return h(
    'select',
    { 'aria-label': 'Unit' },
    units.map((u) => {
      const s = food.servings.find((x) => x.name === u);
      return h('option', { value: u, selected: u === current }, s ? `${u} (${fmt(s.grams, 1)}g)` : u);
    }),
  );
}

function mealSelect(current: Meal): HTMLSelectElement {
  return h('select', { 'aria-label': 'Meal' }, MEALS.map((m) => h('option', { value: m, selected: m === current }, MEAL_LABEL[m])));
}

function foodTitle(food: Food): HTMLElement {
  return h(
    'div',
    { class: 'food-title' },
    h('div', { class: 'food-name' }, food.name),
    h('div', { class: 'food-meta' }, [food.brand, sourceLabel(food)].filter(Boolean).join(' · ')),
  );
}

export function sourceLabel(f: Food): string {
  return { builtin: 'Built-in (USDA)', custom: 'Your food', off: 'Open Food Facts', import: 'Imported' }[f.source];
}

/** Pick an amount of a food and log it, or (with onPick) hand the choice back instead. */
export function foodSheet(
  food: Food,
  opts: { date: string; meal: Meal; qty?: number; unit?: string; onPick?: (food: Food, qty: number, unit: string) => void; save?: boolean },
): void {
  const unit0 = opts.unit ?? food.defaultServing ?? food.servings[0]?.name ?? 'g';
  const qtyIn = numberInput({ value: String(opts.qty ?? (unit0 === 'g' ? 100 : 1)), 'aria-label': 'Amount' });
  const unitSel = unitSelect(food, unit0);
  const meal = mealSelect(opts.meal);
  const out = h('div', { class: 'live' });
  const warn = looksWrong(food.per100) ? h('p', { class: 'warn' }, 'These numbers look inconsistent (calories don’t match the macros). Check the label before relying on them.') : null;
  const update = () => {
    const q = readNum(qtyIn) ?? 0;
    const { grams, approx } = toGrams(food, q, unitSel.value);
    out.replaceChildren(macroLine(scale(food.per100, grams)), h('span', { class: 'muted' }, ` ${approx ? '≈' : ''}${fmt(grams, 1)}g`));
  };
  qtyIn.addEventListener('input', update);
  unitSel.addEventListener('change', update);
  update();
  sheet(opts.onPick ? 'Choose amount' : 'Add food', (close) => {
    const submit = (e: Event) => {
      e.preventDefault();
      const q = readNum(qtyIn);
      if (!q || q <= 0) return qtyIn.focus();
      if (opts.save || food.source === 'off') store.upsertFood(food);
      if (opts.onPick) opts.onPick(food, q, unitSel.value);
      else {
        const entry = entryFor(food, q, unitSel.value, opts.date, meal.value as Meal);
        store.addEntries([entry]);
        toast(`Added ${describeQty(q, unitSel.value)} ${food.name}`, { label: 'Undo', run: () => store.deleteEntry(entry.id) });
      }
      close();
    };
    return h(
      'form',
      { class: 'stack', onsubmit: submit },
      foodTitle(food),
      warn,
      h('div', { class: 'row' }, qtyIn, unitSel, opts.onPick ? null : meal),
      out,
      per100Table(food),
      h(
        'div',
        { class: 'row end' },
        food.source !== 'builtin'
          ? h('button', { type: 'button', class: 'btn ghost', onclick: () => (close(), foodEditor(food)) }, icon('edit'), 'Edit food')
          : null,
        h('button', { type: 'submit', class: 'btn primary' }, opts.onPick ? 'Use' : 'Add'),
      ),
    );
  });
  setTimeout(() => qtyIn.select(), 50);
}

function per100Table(food: Food): HTMLElement {
  const m = food.per100;
  return h(
    'p',
    { class: 'muted small' },
    `Per 100g: ${fmt(m.kcal)} kcal · P ${fmt(m.protein, 1)} · F ${fmt(m.fat, 1)} · C ${fmt(m.carbs, 1)} · fiber ${fmt(m.fiber, 1)}`,
    food.servings.length ? h('br') : null,
    food.servings.length ? `Servings: ${food.servings.map((s) => `${s.name} = ${fmt(s.grams, 1)}g`).join(', ')}` : null,
  );
}

/** Edit or delete a logged entry. */
export function entrySheet(entry: Entry): void {
  const food = store.getFood(entry.foodId);
  sheet('Edit entry', (close) => {
    const meal = mealSelect(entry.meal);
    const dateIn = h('input', { type: 'date', value: entry.date, 'aria-label': 'Date' });
    const del = h('button', {
      type: 'button',
      class: 'btn danger',
      onclick: () => {
        const removed = store.deleteEntry(entry.id);
        close();
        if (removed) toast(`Removed ${removed.name}`, { label: 'Undo', run: () => store.addEntries([removed]) });
      },
    }, icon('trash'), 'Delete');

    if (food) {
      const qtyIn = numberInput({ value: String(entry.qty), 'aria-label': 'Amount' });
      const unitSel = unitSelect(food, entry.unit);
      const out = h('div', { class: 'live' });
      const update = () => {
        const { grams } = toGrams(food, readNum(qtyIn) ?? 0, unitSel.value);
        out.replaceChildren(macroLine(scale(food.per100, grams)));
      };
      qtyIn.addEventListener('input', update);
      unitSel.addEventListener('change', update);
      update();
      const submit = (e: Event) => {
        e.preventDefault();
        const q = readNum(qtyIn);
        if (!q || q <= 0) return qtyIn.focus();
        const fresh = entryFor(food, q, unitSel.value, dateIn.value || entry.date, meal.value as Meal);
        store.updateEntry({ ...fresh, id: entry.id, at: entry.at, name: entry.name });
        close();
      };
      return h('form', { class: 'stack', onsubmit: submit }, foodTitle(food), h('div', { class: 'row' }, qtyIn, unitSel), h('div', { class: 'row' }, meal, dateIn), out, h('div', { class: 'row end' }, del, h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
    }

    // a quick-add or imported entry with no food behind it: edit the numbers directly
    const nameIn = h('input', { type: 'text', value: entry.name, 'aria-label': 'Name' });
    const fields = macroInputs(entry);
    const submit = (e: Event) => {
      e.preventDefault();
      store.updateEntry({ ...entry, name: nameIn.value.trim() || entry.name, meal: meal.value as Meal, date: dateIn.value || entry.date, ...fields.read() });
      close();
    };
    return h('form', { class: 'stack', onsubmit: submit }, nameIn, fields.el, h('div', { class: 'row' }, meal, dateIn), h('div', { class: 'row end' }, del, h('button', { type: 'submit', class: 'btn primary' }, 'Save')));
  });
}

function macroInputs(m?: Partial<Macros>) {
  const mk = (label: string, key: keyof Macros, cls: string) => {
    const el = numberInput({ value: m?.[key] != null ? String(Math.round(m[key]! * 10) / 10) : '', 'aria-label': label, placeholder: '0' });
    return { key, el, wrap: h('label', { class: `field ${cls}` }, h('span', {}, label), el) };
  };
  const fields = [mk('kcal', 'kcal', ''), mk('Protein g', 'protein', 'p'), mk('Fat g', 'fat', 'f'), mk('Carbs g', 'carbs', 'c'), mk('Fiber g', 'fiber', '')];
  return {
    el: h('div', { class: 'grid5' }, fields.map((f) => f.wrap)),
    inputs: fields,
    read(): Macros {
      const v = Object.fromEntries(fields.map((f) => [f.key, readNum(f.el) ?? 0])) as unknown as Macros;
      if (!v.kcal) v.kcal = Math.round(v.protein * 4 + v.carbs * 4 + v.fat * 9);
      return v;
    },
  };
}

/** Log plain macros, e.g. a restaurant meal. */
export function quickMacrosSheet(date: string, meal: Meal): void {
  sheet('Quick add macros', (close) => {
    const nameIn = h('input', { type: 'text', placeholder: 'Name (optional)', 'aria-label': 'Name' });
    const fields = macroInputs();
    const mealSel = mealSelect(meal);
    const submit = (e: Event) => {
      e.preventDefault();
      const m = fields.read();
      if (!m.kcal) return fields.inputs[0].el.focus();
      const entry = makeEntry(undefined, nameIn.value.trim() || 'Quick add', 1, 'serving', undefined, m, date, mealSel.value as Meal);
      store.addEntries([entry]);
      close();
    };
    return h('form', { class: 'stack', onsubmit: submit }, nameIn, fields.el, h('p', { class: 'muted small' }, 'Leave kcal empty to compute it from the macros.'), h('div', { class: 'row end' }, mealSel, h('button', { type: 'submit', class: 'btn primary' }, 'Add')));
  });
}

/** Create or edit one of your own foods, entered from a nutrition label. */
export function foodEditor(existing?: Partial<Food>, onSaved?: (f: Food) => void): void {
  const isNew = !existing?.id || existing.source === 'builtin';
  const serving = existing?.servings?.find((s) => s.name === existing.defaultServing) ?? existing?.servings?.[0];
  sheet(isNew ? 'New food' : 'Edit food', (close) => {
    const name = h('input', { type: 'text', value: existing?.name ?? '', placeholder: 'Name, e.g. Kirkland Greek yogurt', required: true, 'aria-label': 'Name' });
    const brand = h('input', { type: 'text', value: existing?.brand ?? '', placeholder: 'Brand (optional)', 'aria-label': 'Brand' });
    const sName = h('input', { type: 'text', value: serving?.name ?? '', placeholder: 'serving name, e.g. scoop', 'aria-label': 'Serving name' });
    const sGrams = numberInput({ value: serving ? String(serving.grams) : '', placeholder: 'grams', 'aria-label': 'Serving grams' });
    const basis = h('select', { 'aria-label': 'Nutrition basis' }, h('option', { value: 'serving' }, 'per serving'), h('option', { value: '100' }, 'per 100g'));
    // Show existing numbers per serving if there is one, as on a label.
    const shown: Partial<Macros> | undefined = existing?.per100 ? (serving ? scale(existing.per100, serving.grams) : existing.per100) : undefined;
    if (existing?.per100 && !serving) basis.value = '100';
    const fields = macroInputs(shown);
    const aliases = h('input', { type: 'text', value: (existing?.aliases ?? []).join(', '), placeholder: 'other names for quick add, comma separated', 'aria-label': 'Aliases' });
    const err = h('p', { class: 'warn', hidden: true });
    const submit = (e: Event) => {
      e.preventDefault();
      const grams = readNum(sGrams);
      const m = fields.read();
      const per = basis.value === '100' ? 100 : grams;
      if (!per) {
        err.hidden = false;
        err.textContent = 'Enter the serving weight in grams (it’s on the label, e.g. "1 scoop (31 g)"), or switch to per 100g.';
        return;
      }
      const f = 100 / per;
      const sn = sName.value.trim().toLowerCase() || 'serving';
      const servings = grams ? [{ name: canonicalUnit(sn) === 'g' ? 'serving' : sn, grams }] : [];
      for (const s of existing?.servings ?? []) if (!servings.some((x) => x.name === s.name)) servings.push(s);
      const food: Food = {
        id: !isNew && existing?.id ? existing.id : store.uid('c:'),
        name: name.value.trim(),
        brand: brand.value.trim() || undefined,
        aliases: aliases.value.split(',').map((a) => a.trim()).filter(Boolean),
        per100: { kcal: m.kcal * f, protein: m.protein * f, fat: m.fat * f, carbs: m.carbs * f, fiber: m.fiber * f },
        servings,
        defaultServing: servings[0]?.name,
        source: existing?.source && existing.source !== 'builtin' ? existing.source : 'custom',
        barcode: existing?.barcode,
      };
      store.upsertFood(food);
      close();
      onSaved?.(food);
      toast(`Saved ${food.name}`);
    };
    return h(
      'form',
      { class: 'stack', onsubmit: submit },
      name,
      brand,
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, '1'), sName, sGrams, h('span', { class: 'lbl' }, 'g')),
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Nutrition'), basis),
      fields.el,
      aliases,
      err,
      h(
        'div',
        { class: 'row end' },
        !isNew
          ? h('button', {
              type: 'button',
              class: 'btn danger',
              onclick: () => {
                if (!confirm(`Delete ${existing!.name}? Logged entries keep their numbers.`)) return;
                store.deleteFood(existing!.id!);
                close();
              },
            }, icon('trash'), 'Delete')
          : null,
        h('button', { type: 'submit', class: 'btn primary' }, 'Save'),
      ),
    );
  });
  setTimeout(() => (document.querySelector('dialog.sheet input') as HTMLInputElement | null)?.focus(), 50);
}

// ---------- barcode ----------

interface Detector {
  detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

async function makeDetector(): Promise<Detector> {
  const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
  const Native = (globalThis as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
  if (Native) return new Native({ formats });
  // iPhone Safari and Firefox have no BarcodeDetector: use the ZXing WebAssembly build.
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: formats as never }) as unknown as Detector;
}

/** Scan (or type) a barcode, look it up on Open Food Facts, then pick an amount. */
export function scanSheet(date: string, meal: Meal): void {
  let stream: MediaStream | null = null;
  let stop = false;
  const video = h('video', { playsinline: true, muted: true, class: 'scan-video' });
  const status = h('p', { class: 'muted small' }, 'Starting camera…');
  const codeIn = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'or type the barcode number', 'aria-label': 'Barcode' });
  let close = () => {};

  const found = async (code: string) => {
    stop = true;
    status.textContent = `Looking up ${code}…`;
    const local = store.allFoods().find((f) => f.barcode === code);
    try {
      const food = local ?? (await lookupBarcode(code));
      close();
      if (food) foodSheet(food, { date, meal, save: true });
      else {
        toast('Not in Open Food Facts. Enter it from the label.');
        foodEditor({ barcode: code });
      }
    } catch (e) {
      status.textContent = `Lookup failed: ${(e as Error).message}`;
      stop = false;
    }
  };

  close = sheet(
    'Scan barcode',
    () => [
      video,
      status,
      h('form', { class: 'row', onsubmit: (e: Event) => (e.preventDefault(), codeIn.value.trim() && found(codeIn.value.trim())) }, codeIn, h('button', { class: 'btn' }, 'Look up')),
    ],
    {
      onClose: () => {
        stop = true;
        stream?.getTracks().forEach((t) => t.stop());
      },
    },
  );

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (stop) return stream.getTracks().forEach((t) => t.stop());
      video.srcObject = stream;
      await video.play();
      status.textContent = 'Point the camera at the barcode.';
      const detector = await makeDetector();
      while (!stop) {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video).catch(() => []);
          if (codes[0]?.rawValue && !stop) return found(codes[0].rawValue);
        }
        await new Promise((r) => setTimeout(r, 180));
      }
    } catch (e) {
      video.hidden = true;
      status.textContent = `Camera unavailable (${(e as Error).name || 'error'}). Type the number under the barcode instead.`;
    }
  })();
}
