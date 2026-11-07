import type { Entry, Food, Macros, Meal, Routine, Targets } from './types';
import { MEALS } from './types';
import { carbTarget, describeQty, entryMacros, remaining, sum } from './nutrition';
import { parseText, resolve, type ParsedItem } from './parse';
import { entryFor, entrySheet, foodSheet, macroLine, makeEntry, MEAL_LABEL, quickMacrosSheet, scanSheet } from './sheets';
import * as store from './store';
import { fmt, h, icon, sheet, toast } from './ui';
import { routineEditor } from './foodsView';

export function prettyDate(date: string): string {
  const today = store.localDate();
  if (date === today) return 'Today';
  if (date === store.shiftDate(today, -1)) return 'Yesterday';
  if (date === store.shiftDate(today, 1)) return 'Tomorrow';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---------- summary ----------

function ring(eaten: number, target: number): SVGSVGElement {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = target > 0 ? eaten / target : 0;
  const over = frac > 1.03;
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="ring${over ? ' over' : ''}" viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="${Math.round(eaten)} of ${target} kcal">
    <circle cx="60" cy="60" r="${r}" class="ring-track" />
    <circle cx="60" cy="60" r="${r}" class="ring-fill"${frac > 0.005 ? '' : ' visibility="hidden"'} stroke-dasharray="${(Math.min(frac, 1) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)" />
  </svg>`;
  return tpl.content.firstElementChild as SVGSVGElement;
}

type Kind = 'min' | 'max' | 'target';

function bar(label: string, cls: string, eaten: number, target: number, kind: Kind): HTMLElement {
  const frac = target > 0 ? eaten / target : 0;
  const met = kind === 'min' && eaten >= target;
  const over = kind === 'max' ? eaten > target : kind === 'target' && frac > 1.1;
  const left = target - eaten;
  const sign = kind === 'min' ? '≥' : kind === 'max' ? '≤' : '';
  let note: string;
  if (met) note = 'target met';
  else if (over) note = `${fmt(Math.round(-left))}g over`;
  else note = kind === 'min' ? `${fmt(Math.round(left))}g to go` : `${fmt(Math.round(left))}g left`;
  return h(
    'div',
    { class: `bar ${cls}${over ? ' over' : ''}${met ? ' met' : ''}` },
    h('div', { class: 'bar-top' }, h('span', { class: 'bar-label' }, h('i', { class: 'dot' }), label), h('span', { class: 'bar-num' }, h('b', {}, fmt(Math.round(eaten))), ` / ${sign}${fmt(target)}g`)),
    h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${Math.min(100, frac * 100).toFixed(1)}%` })),
    h('div', { class: 'bar-note' }, met ? '✓ ' : over ? '! ' : '', note),
  );
}

export function summary(t: Targets, eaten: Macros): HTMLElement {
  const carbs = carbTarget(t);
  const left = remaining(t, eaten);
  const kcalLeft = Math.round(left.kcal);
  return h(
    'section',
    { class: 'card summary' },
    h(
      'div',
      { class: 'kcal' },
      ring(eaten.kcal, t.kcal),
      h(
        'div',
        { class: 'kcal-center' },
        h('b', {}, fmt(Math.abs(kcalLeft))),
        h('span', {}, kcalLeft >= 0 ? 'kcal left' : 'kcal over'),
        h('small', {}, `${fmt(Math.round(eaten.kcal))} / ${fmt(t.kcal)}`),
      ),
    ),
    h(
      'div',
      { class: 'bars' },
      bar('Protein', 'p', eaten.protein, t.protein, 'min'),
      bar('Fat', 'f', eaten.fat, t.fat, 'max'),
      bar('Carbs', 'c', eaten.carbs, carbs, 'target'),
    ),
    h(
      'p',
      { class: 'budget' },
      left.kcal > 0
        ? [
            h('span', {}, 'Still to eat: '),
            left.protein > 0 ? h('b', { class: 'tp' }, `${fmt(Math.round(left.protein))}g protein`) : h('span', {}, 'protein done'),
            ' · ',
            h('b', { class: 'tf' }, `≤ ${fmt(Math.round(left.fat))}g fat`),
            ' · ',
            h('b', { class: 'tc' }, `~${fmt(Math.round(left.carbs))}g carbs`),
          ]
        : h('span', {}, 'Calorie target reached.'),
      t.fiber ? h('span', { class: 'fiber' }, ` · fiber ${fmt(Math.round(eaten.fiber))}/${t.fiber}g`) : null,
    ),
  );
}

// ---------- quick add ----------

interface Override {
  food: Food;
  qty: number;
  unit: string;
}

function quickAdd(date: string, getMeal: () => Meal, setMeal: (m: Meal) => void): HTMLElement {
  const input = h('textarea', {
    class: 'quick-input',
    rows: 1,
    placeholder: 'e.g. 86g oats, 100g blueberries, 2 scoops whey',
    'aria-label': 'Quick add foods',
    enterkeyhint: 'done',
    autocapitalize: 'off',
    autocomplete: 'off',
    spellcheck: false,
  });
  const preview = h('div', { class: 'preview', 'aria-live': 'polite' });
  const addBtn = h('button', { class: 'btn primary', type: 'submit', disabled: true }, 'Add');
  const mealSel = h('select', { class: 'meal-pick', 'aria-label': 'Meal' }, MEALS.map((m) => h('option', { value: m, selected: m === getMeal() }, MEAL_LABEL[m])));
  mealSel.addEventListener('change', () => setMeal(mealSel.value as Meal));
  const overrides = new Map<string, Override>();
  let items: ParsedItem[] = [];

  const grow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(160, input.scrollHeight)}px`;
  };

  const render = () => {
    const text = input.value.trim();
    items = text ? parseText(text, store.allFoods(), store.usageCounts()) : [];
    items = items.map((it) => {
      const o = overrides.get(it.text);
      return o ? { ...resolve(it.text, o.food, o.qty, o.unit, it.alternatives), alternatives: it.alternatives } : it;
    });
    const ok = items.filter((i) => i.food || i.quick);
    addBtn.disabled = ok.length === 0;
    addBtn.textContent = ok.length > 1 ? `Add ${ok.length}` : 'Add';
    if (!items.length) {
      preview.replaceChildren();
      return;
    }
    const total = sum(ok.map((i) => i.macros));
    preview.replaceChildren(
      ...items.map((it) => previewRow(it, date, getMeal(), (o) => (overrides.set(it.text, o), render()))),
    );
    if (ok.length > 1) preview.append(h('div', { class: 'preview-total' }, h('span', {}, 'Total'), macroLine(total)));
  };

  const submit = (e?: Event) => {
    e?.preventDefault();
    const ok = items.filter((i) => i.food || i.quick);
    if (!ok.length) return;
    const meal = getMeal();
    const entries = ok.map((i) => (i.food ? entryFor(i.food, i.qty, i.unit, date, meal) : makeEntry(undefined, i.quick!.name, 1, 'serving', undefined, i.macros, date, meal)));
    store.addEntries(entries);
    const unmatched = items.filter((i) => !i.food && !i.quick).map((i) => i.text);
    input.value = unmatched.join(', ');
    overrides.clear();
    grow();
    render();
    toast(`Added ${entries.length} item${entries.length > 1 ? 's' : ''} to ${MEAL_LABEL[meal].toLowerCase()}`, { label: 'Undo', run: () => entries.forEach((x) => store.deleteEntry(x.id)) });
  };

  input.addEventListener('input', () => {
    grow();
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  });

  const form = h(
    'form',
    { class: 'card quick', onsubmit: submit },
    h('div', { class: 'quick-row' }, input, addBtn),
    preview,
    h(
      'div',
      { class: 'quick-tools' },
      mealSel,
      h('button', { type: 'button', class: 'chip', onclick: () => scanSheet(date, getMeal()) }, icon('scan'), 'Scan'),
      h('button', { type: 'button', class: 'chip', onclick: () => quickMacrosSheet(date, getMeal()) }, icon('bolt'), 'Macros'),
      h('a', { class: 'chip', href: '#/foods' }, icon('search'), 'Foods'),
    ),
    h('div', { class: 'shortcuts' }),
  );
  return form;
}

function previewRow(it: ParsedItem, date: string, meal: Meal, pick: (o: Override) => void): HTMLElement {
  if (it.quick) return h('div', { class: 'prow' }, h('div', { class: 'prow-main' }, h('span', { class: 'prow-name' }, it.quick.name), h('span', { class: 'muted' }, ' quick add')), macroLine(it.macros));
  if (!it.food) {
    return h(
      'div',
      { class: 'prow miss' },
      h('div', { class: 'prow-main' }, h('span', { class: 'prow-name' }, `“${it.text}”`), h('span', { class: 'muted' }, ' no match')),
      h('a', { class: 'link', href: `#/foods?q=${encodeURIComponent(it.text.replace(/^[\d./\s]+(g|oz|ml)?\s*/i, ''))}` }, 'Find it →'),
    );
  }
  const food = it.food;
  const choose = () =>
    sheet('Which food?', (close) => [
      h('p', { class: 'muted small' }, `For “${it.text}”`),
      h(
        'div',
        { class: 'list' },
        [food, ...it.alternatives].map((f) =>
          h('button', {
            class: `list-item${f === food ? ' sel' : ''}`,
            onclick: () => {
              close();
              foodSheet(f, { date, meal, qty: f === food ? it.qty : undefined, unit: f === food ? it.unit : undefined, onPick: (ff, q, u) => pick({ food: ff, qty: q, unit: u }) });
            },
          }, h('span', {}, f.name, f.brand ? h('small', {}, ` ${f.brand}`) : null), h('small', { class: 'muted' }, `${fmt(f.per100.kcal)} kcal/100g`)),
        ),
      ),
      h('a', { class: 'link', href: `#/foods?q=${encodeURIComponent(it.text)}`, onclick: close }, 'Search more, or online →'),
    ]);
  return h(
    'button',
    { type: 'button', class: 'prow', onclick: choose, title: 'Change food or amount' },
    h('div', { class: 'prow-main' }, h('span', { class: 'prow-qty' }, `${it.approx ? '≈' : ''}${describeQty(it.qty, it.unit)}`), ' ', h('span', { class: 'prow-name' }, food.name), food.brand ? h('small', { class: 'muted' }, ` ${food.brand}`) : null),
    macroLine(it.macros),
  );
}

function routineMacros(r: Routine): Macros {
  return sum(
    r.items.flatMap((i) => {
      const f = store.getFood(i.foodId);
      return f ? [entryFor(f, i.qty, i.unit, '', 'snack')] : [];
    }).map(entryMacros),
  );
}

export function logRoutine(r: Routine, date: string, meal: Meal): void {
  const entries = r.items.flatMap((i) => {
    const f = store.getFood(i.foodId);
    return f ? [entryFor(f, i.qty, i.unit, date, meal)] : [];
  });
  store.addEntries(entries);
  toast(`Added ${r.name}`, { label: 'Undo', run: () => entries.forEach((e) => store.deleteEntry(e.id)) });
}

function shortcuts(date: string, getMeal: () => Meal): HTMLElement[] {
  const rs = store.routines();
  const freq = store.frequentPortions(8);
  return [
    ...rs.map((r) =>
      h('button', { type: 'button', class: 'chip routine', onclick: () => logRoutine(r, date, r.meal ?? getMeal()), title: r.items.length + ' items' }, icon('plus'), r.name, h('small', {}, `${fmt(Math.round(routineMacros(r).kcal))}`)),
    ),
    ...freq.map((f) => {
      const food = store.getFood(f.foodId);
      return h('button', {
        type: 'button',
        class: 'chip',
        onclick: () => {
          const meal = getMeal();
          const e = food ? entryFor(food, f.qty, f.unit, date, meal) : { ...f.sample, id: store.uid('e:'), date, meal, at: new Date().toISOString() };
          store.addEntries([e]);
          toast(`Added ${e.name}`, { label: 'Undo', run: () => store.deleteEntry(e.id) });
        },
      }, icon('plus'), `${f.unit === 'serving' ? '' : describeQty(f.qty, f.unit) + ' '}${food?.name ?? f.name}`);
    }),
  ];
}

// ---------- meals ----------

function mealSection(meal: Meal, entries: Entry[], date: string): HTMLElement | null {
  if (!entries.length) return null;
  const tot = sum(entries.map(entryMacros));
  const saveAsRoutine = () => {
    const items = entries.filter((e) => e.foodId).map((e) => ({ foodId: e.foodId!, qty: e.qty, unit: e.unit }));
    if (!items.length) return toast('Only foods (not quick-add macros) can go in a saved meal.');
    routineEditor({ id: store.uid('r:'), name: `${MEAL_LABEL[meal]} ${prettyDate(date).toLowerCase()}`.replace(' today', ''), meal, items }, true);
  };
  return h(
    'section',
    { class: 'card meal' },
    h(
      'div',
      { class: 'meal-head' },
      h('h3', {}, MEAL_LABEL[meal]),
      h('span', { class: 'meal-tot' }, `${fmt(Math.round(tot.kcal))} kcal · P ${Math.round(tot.protein)} · F ${Math.round(tot.fat)} · C ${Math.round(tot.carbs)}`),
    ),
    h(
      'ul',
      { class: 'entries' },
      entries.map((e) =>
        h(
          'li',
          {},
          h(
            'button',
            { class: 'entry', onclick: () => entrySheet(e) },
            h('span', { class: 'entry-name' }, e.name, h('small', {}, e.unit === 'serving' && e.qty === 1 ? '' : describeQty(e.qty, e.unit))),
            h('span', { class: 'entry-kcal' }, fmt(Math.round(e.kcal))),
            h('span', { class: 'entry-macros' }, h('i', { class: 'p' }, `${Math.round(e.protein)}p`), h('i', { class: 'f' }, `${Math.round(e.fat)}f`), h('i', { class: 'c' }, `${Math.round(e.carbs)}c`)),
          ),
        ),
      ),
    ),
    h('button', { class: 'link small', onclick: saveAsRoutine }, 'Save as a meal for one-tap adding'),
  );
}

// ---------- page ----------

export function openToday(root: HTMLElement, date: string): () => void {
  let meal: Meal = date === store.localDate() ? store.mealForTime() : 'snack';
  const quick = quickAdd(date, () => meal, (m) => (meal = m));
  const summaryHost = h('div');
  const mealsHost = h('div', { class: 'meals' });
  const shortcutsHost = quick.querySelector('.shortcuts')!;
  const dateIn = h('input', { type: 'date', value: date, class: 'date-input', 'aria-label': 'Pick a date', onchange: (e: Event) => (location.hash = `#/day/${(e.target as HTMLInputElement).value}`) });

  const render = () => {
    const entries = store.entriesFor(date);
    summaryHost.replaceChildren(summary(store.targets(), sum(entries.map(entryMacros))));
    mealsHost.replaceChildren(
      ...MEALS.map((m) => mealSection(m, entries.filter((e) => e.meal === m), date)).filter((x): x is HTMLElement => !!x),
    );
    if (!entries.length) mealsHost.append(h('p', { class: 'empty' }, 'Nothing logged yet. Type what you ate above, or tap a saved meal.'));
    shortcutsHost.replaceChildren(...shortcuts(date, () => meal));
  };

  root.replaceChildren(
    h(
      'header',
      { class: 'top' },
      h('a', { class: 'icon-btn', href: `#/day/${store.shiftDate(date, -1)}`, 'aria-label': 'Previous day' }, icon('prev')),
      h('label', { class: 'date-label' }, h('span', {}, prettyDate(date)), dateIn),
      h('a', { class: 'icon-btn', href: `#/day/${store.shiftDate(date, 1)}`, 'aria-label': 'Next day' }, icon('next')),
    ),
    summaryHost,
    quick,
    mealsHost,
  );
  let pending = 0;
  const unsub = store.subscribe(() => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(render);
  });
  render();
  return () => {
    unsub();
    cancelAnimationFrame(pending);
  };
}
