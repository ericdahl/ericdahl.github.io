import type { Entry, Targets } from './types';
import { parseImport, toJsonl } from './jsonl';
import { carbTarget } from './nutrition';
import { parseText } from './parse';
import { entryFor, makeEntry } from './sheets';
import * as store from './store';
import * as sync from './sync';
import { syncCard } from './syncView';
import { copyText, download, fmt, h, numberInput, readNum, toast } from './ui';

function exportText(days: number | null): string {
  const since = days == null ? '' : store.shiftDate(store.localDate(), -(days - 1));
  const entries = store.allEntries().filter((e) => e.date >= since);
  return toJsonl({
    entries,
    foods: store.userFoods(),
    routines: store.routines(),
    targets: store.targets(),
    foodName: (id) => store.getFood(id)?.name,
  });
}

function targetsCard(): HTMLElement {
  const t = store.targets();
  const kcal = numberInput({ value: String(t.kcal), 'aria-label': 'Calories per day' });
  const protein = numberInput({ value: String(t.protein), 'aria-label': 'Protein minimum' });
  const fat = numberInput({ value: String(t.fat), 'aria-label': 'Fat maximum' });
  const carbs = numberInput({ value: t.carbs == null ? '' : String(t.carbs), placeholder: 'auto', 'aria-label': 'Carbs target' });
  const fiber = numberInput({ value: t.fiber == null ? '' : String(t.fiber), placeholder: 'none', 'aria-label': 'Fiber target' });
  const note = h('p', { class: 'muted small' });
  const read = (): Targets => ({
    kcal: readNum(kcal) ?? t.kcal,
    protein: readNum(protein) ?? t.protein,
    fat: readNum(fat) ?? t.fat,
    carbs: readNum(carbs),
    fiber: readNum(fiber),
  });
  const upd = () => {
    const x = read();
    const c = carbTarget(x);
    note.textContent =
      x.carbs == null
        ? `Carbs fill the rest: (${fmt(x.kcal)} − ${x.protein}×4 − ${x.fat}×9) ÷ 4 = ${c}g.`
        : `Protein ${x.protein * 4} + fat ${x.fat * 9} + carbs ${x.carbs * 4} = ${fmt(x.protein * 4 + x.fat * 9 + x.carbs * 4)} kcal.`;
  };
  for (const el of [kcal, protein, fat, carbs]) el.addEventListener('input', upd);
  upd();
  const row = (label: string, el: HTMLInputElement, unit: string) => h('label', { class: 'trow' }, h('span', {}, label), el, h('span', { class: 'muted' }, unit));
  return h(
    'form',
    {
      class: 'card stack',
      onsubmit: (e: Event) => {
        e.preventDefault();
        store.setTargets(read());
        toast('Targets saved');
      },
    },
    h('h3', { class: 'section' }, 'Daily targets'),
    row('Calories', kcal, 'kcal'),
    row('Protein, at least', protein, 'g'),
    row('Fat, at most', fat, 'g'),
    row('Carbs (blank = the rest)', carbs, 'g'),
    row('Fiber, at least', fiber, 'g'),
    note,
    h('div', { class: 'row end' }, h('button', { class: 'btn primary' }, 'Save targets')),
  );
}

function exportCard(): HTMLElement {
  const range = h('select', { 'aria-label': 'Export range' }, h('option', { value: '' }, 'All data'), h('option', { value: '7' }, 'Last 7 days'), h('option', { value: '30' }, 'Last 30 days'), h('option', { value: '90' }, 'Last 90 days'));
  const days = () => (range.value ? Number(range.value) : null);
  const name = () => `macros-${store.localDate()}.jsonl`;
  const canShare = typeof navigator.share === 'function' && typeof File !== 'undefined';
  const count = store.allEntries().length;
  const dates = new Set(store.allEntries().map((e) => e.date)).size;
  return h(
    'section',
    { class: 'card stack' },
    h('h3', { class: 'section' }, 'Export'),
    h('p', { class: 'muted small' }, `${fmt(count)} entries over ${dates} day${dates === 1 ? '' : 's'} are stored in this browser only. Export JSON Lines to back them up or hand them to an AI: one object per line, with day totals, every entry, your foods and targets. The first line describes the format.`),
    h('div', { class: 'row wrap' },
      range,
      h('button', { class: 'btn', onclick: () => download(name(), exportText(days())) }, 'Download .jsonl'),
      h('button', {
        class: 'btn',
        onclick: async () => toast((await copyText(exportText(days()))) ? 'Copied. Paste it into an AI chat.' : 'Couldn’t copy'),
      }, 'Copy'),
      canShare
        ? h('button', {
            class: 'btn',
            onclick: async () => {
              const file = new File([exportText(days())], name(), { type: 'text/plain' });
              try {
                if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Macros export' });
                else await navigator.share({ text: exportText(days()), title: 'Macros export' });
              } catch {
                /* cancelled */
              }
            },
          }, 'Share…')
        : null,
    ),
  );
}

/** Turn imported entry lines that only name a food ("2 eggs") into real entries. */
function resolveUnresolved(list: { date: string; meal: Entry['meal']; text: string }[]): { entries: Entry[]; missed: string[] } {
  const entries: Entry[] = [];
  const missed: string[] = [];
  for (const u of list) {
    const [it] = parseText(u.text, store.allFoods());
    if (it?.food) entries.push(entryFor(it.food, it.qty, it.unit, u.date, u.meal));
    else if (it?.quick) entries.push(makeEntry(undefined, it.quick.name, 1, 'serving', undefined, it.macros, u.date, u.meal));
    else missed.push(u.text);
  }
  return { entries, missed };
}

function importCard(): HTMLElement {
  const file = h('input', { type: 'file', accept: '.jsonl,.ndjson,.json,.txt,application/json', 'aria-label': 'Import file' });
  const paste = h('textarea', { rows: 4, placeholder: 'or paste JSON lines here', spellcheck: false, 'aria-label': 'Paste JSON lines' });
  const msg = h('p', { class: 'small' });
  const run = (text: string) => {
    const res = parseImport(text);
    const extra = resolveUnresolved(res.unresolved);
    const entries = [...res.entries, ...extra.entries];
    if (!entries.length && !res.foods.length && !res.routines.length && !res.targets) {
      msg.className = 'small warn';
      msg.textContent = res.errors[0] ?? 'Nothing to import.';
      return;
    }
    store.merge({ entries, foods: res.foods, routines: res.routines, targets: res.targets });
    const parts = [`${entries.length} entries`, `${res.foods.length} foods`, `${res.routines.length} meals`];
    if (res.targets) parts.push('targets');
    msg.className = 'small';
    msg.textContent = `Imported ${parts.join(', ')}.${extra.missed.length ? ` Couldn’t match: ${extra.missed.join('; ')}.` : ''}${res.errors.length ? ` ${res.errors.length} line(s) skipped.` : ''}`;
    paste.value = '';
  };
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (f) run(await f.text());
    file.value = '';
  });
  return h(
    'section',
    { class: 'card stack' },
    h('h3', { class: 'section' }, 'Import'),
    h('p', { class: 'muted small' }, 'Restores an export (matching ids are replaced, so importing twice is safe), or takes food and entry lines written by an AI in the same format.'),
    file,
    paste,
    h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: () => run(paste.value) }, 'Import pasted text')),
    msg,
  );
}

export function openData(root: HTMLElement): () => void {
  const sc = syncCard();
  root.replaceChildren(
    h('header', { class: 'top' }, h('h1', {}, 'Targets & data')),
    targetsCard(),
    sc.el,
    exportCard(),
    importCard(),
    h(
      'section',
      { class: 'card stack' },
      h('h3', { class: 'section' }, 'Reset'),
      h('button', {
        class: 'btn danger',
        onclick: () => {
          const msg = sync.isConnected()
            ? 'Delete every entry, food, saved meal and target in this browser, and disconnect GitHub sync? The repository is not changed.'
            : 'Delete every entry, food, saved meal and target in this browser? Export first if you want a copy.';
          if (!confirm(msg)) return;
          sync.disconnect();
          store.clearAll();
          location.hash = '#/';
        },
      }, 'Delete all data'),
    ),
  );
  return sc.dispose;
}
