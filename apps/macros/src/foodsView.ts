import type { Food, Routine } from './types';
import { MEALS } from './types';
import { aiFoodPrompt, parseImport } from './jsonl';
import { entryMacros, fmtUnit, sum } from './nutrition';
import { looksWrong, searchOff } from './off';
import { searchFoods } from './parse';
import { entryFor, foodEditor, foodSheet, macroLine, MEAL_LABEL, scanSheet, sourceLabel } from './sheets';
import * as store from './store';
import { copyText, fmt, h, icon, numberInput, readNum, sheet, toast } from './ui';

function foodRow(f: Food, onClick: () => void): HTMLElement {
  const m = f.per100;
  const s = f.servings.find((x) => x.name === f.defaultServing) ?? f.servings[0];
  const perServing = s ? `${fmt(Math.round((m.kcal * s.grams) / 100))} kcal / ${s.name}` : `${fmt(Math.round(m.kcal))} kcal / 100g`;
  return h(
    'button',
    { class: 'list-item', onclick: onClick },
    h('span', { class: 'li-main' }, h('span', { class: 'li-name' }, f.name), h('small', { class: 'muted' }, [f.brand, f.source === 'builtin' ? null : sourceLabel(f)].filter(Boolean).join(' · '))),
    h('span', { class: 'li-side' }, h('small', {}, perServing), f.source === 'off' && looksWrong(m) ? h('small', { class: 'warn' }, 'check numbers') : h('small', { class: 'muted' }, `P ${fmt(m.protein, 1)} · F ${fmt(m.fat, 1)} · C ${fmt(m.carbs, 1)} /100g`)),
  );
}

export function routineEditor(r: Routine, isNew = false): void {
  const draft: Routine = { ...r, items: r.items.map((i) => ({ ...i })) };
  sheet(isNew ? 'Save meal' : 'Edit meal', (close) => {
    const name = h('input', { type: 'text', value: draft.name, 'aria-label': 'Meal name', required: true });
    const meal = h('select', { 'aria-label': 'Adds to' }, h('option', { value: '' }, 'current meal'), MEALS.map((m) => h('option', { value: m, selected: draft.meal === m }, MEAL_LABEL[m])));
    const list = h('div', { class: 'stack tight' });
    const total = h('div', { class: 'live' });
    const draw = () => {
      list.replaceChildren(
        ...draft.items.map((it, i) => {
          const f = store.getFood(it.foodId);
          const q = numberInput({ value: String(it.qty), 'aria-label': `Amount of ${f?.name ?? it.foodId}`, class: 'qty-sm' });
          q.addEventListener('input', () => {
            it.qty = readNum(q) ?? it.qty;
            drawTotal();
          });
          return h(
            'div',
            { class: 'row ritem' },
            q,
            h('span', { class: 'ritem-name' }, `${fmtUnit(it.qty, it.unit)} ${f?.name ?? '(deleted food)'}`),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove', onclick: () => (draft.items.splice(i, 1), draw()) }, icon('close')),
          );
        }),
      );
      drawTotal();
    };
    const drawTotal = () => {
      const m = sum(draft.items.flatMap((i) => (store.getFood(i.foodId) ? [entryFor(store.getFood(i.foodId)!, i.qty, i.unit, '', 'snack')] : [])).map(entryMacros));
      total.replaceChildren(macroLine(m));
    };
    draw();
    const addIn = h('input', { type: 'search', placeholder: 'Add a food…', 'aria-label': 'Add a food to this meal' });
    const results = h('div', { class: 'list' });
    addIn.addEventListener('input', () => {
      results.replaceChildren(
        ...searchFoods(store.allFoods(), addIn.value, store.usageCounts(), 6).map((f) =>
          foodRow(f, () =>
            foodSheet(f, {
              date: '',
              meal: 'snack',
              onPick: (ff, qty, unit) => {
                draft.items.push({ foodId: ff.id, qty, unit });
                addIn.value = '';
                results.replaceChildren();
                draw();
              },
            }),
          ),
        ),
      );
    });
    const submit = (e: Event) => {
      e.preventDefault();
      if (!draft.items.length) return toast('Add at least one food.');
      store.upsertRoutine({ ...draft, name: name.value.trim() || draft.name, meal: (meal.value || undefined) as Routine['meal'] });
      close();
      toast(`Saved “${name.value.trim()}”. It’s a one-tap button under quick add.`);
    };
    return h(
      'form',
      { class: 'stack', onsubmit: submit },
      name,
      h('div', { class: 'row' }, h('span', { class: 'lbl' }, 'Adds to'), meal),
      list,
      total,
      addIn,
      results,
      h(
        'div',
        { class: 'row end' },
        !isNew
          ? h('button', {
              type: 'button',
              class: 'btn danger',
              onclick: () => {
                if (!confirm(`Delete “${draft.name}”?`)) return;
                store.deleteRoutine(draft.id);
                close();
              },
            }, icon('trash'), 'Delete')
          : null,
        h('button', { type: 'submit', class: 'btn primary' }, 'Save'),
      ),
    );
  });
}

export function aiImportSheet(): void {
  sheet('Add foods with an AI', (close) => {
    const desc = h('input', { type: 'text', placeholder: 'e.g. Chipotle chicken bowl with rice, beans, salsa', 'aria-label': 'Describe the food' });
    const paste = h('textarea', { rows: 6, placeholder: 'Paste the AI’s reply here (JSON lines)', 'aria-label': 'AI reply', spellcheck: false });
    const msg = h('p', { class: 'small' });
    return [
      h('p', { class: 'muted small' }, 'For restaurant meals or anything not in the database: copy the prompt into ChatGPT, Claude or Gemini (a photo of the label works too), then paste its answer back here.'),
      h('div', { class: 'stack' },
        desc,
        h('button', {
          type: 'button',
          class: 'btn',
          onclick: async () => {
            const ok = await copyText(aiFoodPrompt(desc.value.trim() || undefined));
            toast(ok ? 'Prompt copied' : 'Couldn’t copy');
          },
        }, icon('copy'), 'Copy prompt'),
        paste,
        msg,
        h('button', {
          type: 'button',
          class: 'btn primary',
          onclick: () => {
            const res = parseImport(paste.value);
            if (!res.foods.length && !res.entries.length) {
              msg.className = 'small warn';
              msg.textContent = res.errors[0] ?? 'No food lines found in that text.';
              return;
            }
            store.merge({ foods: res.foods.map((f) => ({ ...f, source: 'custom' as const })), entries: res.entries });
            close();
            toast(`Added ${res.foods.length} food${res.foods.length === 1 ? '' : 's'}${res.entries.length ? ` and ${res.entries.length} entries` : ''}`);
          },
        }, 'Save foods'),
      ),
    ];
  });
}

export function openFoods(root: HTMLElement, initialQuery: string): () => void {
  const date = store.localDate();
  const q = h('input', { type: 'search', value: initialQuery, placeholder: 'Search foods', 'aria-label': 'Search foods', class: 'search', autocomplete: 'off' });
  const results = h('div', { class: 'list' });
  const online = h('div', { class: 'list' });
  const onlineBtn = h('button', { class: 'btn', type: 'button' }, icon('search'), 'Search Open Food Facts');
  const mine = h('div');
  let ctrl: AbortController | null = null;

  const pick = (f: Food) => foodSheet(f, { date, meal: store.mealForTime() });

  const draw = () => {
    const text = q.value.trim();
    online.replaceChildren();
    onlineBtn.hidden = !text;
    results.replaceChildren(...(text ? searchFoods(store.allFoods(), text, store.usageCounts(), 30).map((f) => foodRow(f, () => pick(f))) : []));
    if (text && !results.childElementCount) results.append(h('p', { class: 'muted small' }, 'No match in your foods or the built-in list.'));
    const yours = store.userFoods();
    const rs = store.routines();
    mine.replaceChildren(
      h('h3', { class: 'section' }, 'Saved meals'),
      rs.length
        ? h('div', { class: 'list' }, rs.map((r) =>
            h('button', { class: 'list-item', onclick: () => routineEditor(r) },
              h('span', { class: 'li-main' }, h('span', { class: 'li-name' }, r.name), h('small', { class: 'muted' }, r.items.map((i) => store.getFood(i.foodId)?.name ?? '?').join(', '))),
              h('span', { class: 'li-side' }, icon('edit')),
            ),
          ))
        : h('p', { class: 'muted small' }, 'Log a meal, then tap “Save as a meal” under it on the Today page.'),
      h('h3', { class: 'section' }, `Your foods (${yours.length})`),
      yours.length ? h('div', { class: 'list' }, yours.map((f) => foodRow(f, () => pick(f)))) : h('p', { class: 'muted small' }, 'Foods you create, scan or import appear here. The built-in list has about 170 common foods.'),
    );
  };

  onlineBtn.addEventListener('click', async () => {
    ctrl?.abort();
    ctrl = new AbortController();
    online.replaceChildren(h('p', { class: 'muted small' }, 'Searching…'));
    try {
      const foods = await searchOff(q.value.trim(), ctrl.signal);
      online.replaceChildren(
        h('h3', { class: 'section' }, 'Open Food Facts'),
        ...(foods.length ? foods.map((f) => foodRow(f, () => pick(f))) : [h('p', { class: 'muted small' }, 'Nothing found.')]),
        h('p', { class: 'muted small' }, 'Crowd-sourced data: check it against the label. Foods you add are saved to your list.'),
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') online.replaceChildren(h('p', { class: 'warn small' }, `Search failed: ${(e as Error).message}`));
    }
  });

  q.addEventListener('input', draw);
  const unsub = store.subscribe(draw);
  root.replaceChildren(
    h('header', { class: 'top' }, h('h1', {}, 'Foods')),
    h('section', { class: 'card stack' },
      q,
      h('div', { class: 'row wrap' },
        h('button', { class: 'chip', onclick: () => scanSheet(date, store.mealForTime()) }, icon('scan'), 'Scan barcode'),
        h('button', { class: 'chip', onclick: () => foodEditor({ name: q.value.trim() }) }, icon('plus'), 'New food'),
        h('button', { class: 'chip', onclick: aiImportSheet }, icon('sparkle'), 'Ask an AI'),
      ),
      results,
      onlineBtn,
      online,
    ),
    h('section', { class: 'card stack' }, mine),
  );
  draw();
  if (initialQuery) onlineBtn.focus();
  else q.focus({ preventScroll: true });
  return () => {
    unsub();
    ctrl?.abort();
  };
}
