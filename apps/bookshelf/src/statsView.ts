import { coverUrl } from './ol';
import { goalPace, yearStats, years } from './stats';
import * as store from './store';
import type { Book } from './types';
import { coverEl, fmt, h, numberInput, plural, readNum, sheet, stars } from './ui';

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'narrow' }));
const MONTHS_LONG = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }));

export function openStats(view: HTMLElement, year0?: number): () => void {
  const thisYear = new Date().getFullYear();
  const render = () => {
    const all = store.books();
    const ys = years(all, thisYear);
    const year = year0 && ys.includes(year0) ? year0 : thisYear;
    const s = yearStats(all, year);
    const goal = store.goal(year);

    const yearNav = h(
      'nav',
      { class: 'seg scroll', 'aria-label': 'Year' },
      ys.map((y) => h('a', { href: `#/stats/${y}`, class: y === year ? 'on' : '', 'aria-current': y === year ? 'page' : undefined }, String(y))),
    );

    const tiles = h(
      'div',
      { class: 'tiles' },
      tile(fmt(s.books.length), s.books.length === 1 ? 'book read' : 'books read'),
      tile(fmt(s.pages), s.missingPages ? `pages (${s.missingPages} without a count)` : 'pages'),
      tile(s.avgRating ? fmt(s.avgRating, 1) : '–', s.rated ? `average rating (${s.rated} rated)` : 'average rating'),
      tile(s.books.length && s.pages ? fmt(Math.round(s.pages / (s.books.length - s.missingPages || 1))) : '–', 'pages per book'),
    );

    // goal
    const goalCard = h('section', { class: 'card goal' });
    if (goal) {
      const pct = Math.min(100, Math.round((s.books.length / goal) * 100));
      const pace = year === thisYear ? goalPace(s.books.length, goal, year) : null;
      goalCard.append(
        h('div', { class: 'row between' }, h('h2', {}, `${year} goal`), h('button', { type: 'button', class: 'link', onclick: () => goalSheet(year) }, 'Change')),
        h('div', { class: 'goal-num' }, h('b', {}, fmt(s.books.length)), ` of ${plural(goal, 'book')}`),
        h('div', { class: 'bar big', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Goal progress' }, h('i', { style: `width:${pct}%` })),
        h(
          'p',
          { class: 'muted small' },
          s.books.length >= goal
            ? 'Goal reached.'
            : pace == null
              ? `${pct}%`
              : pace >= 0.5
                ? `${plural(Math.floor(pace), 'book')} ahead of schedule`
                : pace <= -0.5
                  ? `${plural(Math.ceil(-pace), 'book')} behind schedule`
                  : 'Right on schedule',
        ),
      );
    } else {
      goalCard.append(
        h('div', { class: 'row between' }, h('h2', {}, `${year} goal`), h('button', { type: 'button', class: 'btn small', onclick: () => goalSheet(year) }, 'Set a goal')),
        h('p', { class: 'muted small' }, 'How many books do you want to read this year?'),
      );
    }

    const maxM = Math.max(...s.byMonth, 1);
    const nowMonth = year === thisYear ? new Date().getMonth() : 11;
    const months = h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Books by month'),
      h(
        'div',
        { class: 'months', role: 'table', 'aria-label': 'Books finished each month' },
        s.byMonth.map((n, i) =>
          h(
            'div',
            { class: `month${i > nowMonth ? ' future' : ''}`, role: 'row', title: `${MONTHS_LONG[i]}: ${plural(n, 'book')}` },
            h('span', { class: 'n', role: 'cell' }, n ? String(n) : ''),
            h('div', { class: 'col' }, h('i', { style: `height:${(n / maxM) * 100}%` })),
            h('span', { class: 'm', role: 'rowheader' }, MONTHS[i]),
          ),
        ),
      ),
    );

    const maxR = Math.max(...s.byRating, 1);
    const ratings = s.rated
      ? h(
          'section',
          { class: 'card' },
          h('h2', {}, 'Your ratings'),
          h(
            'div',
            { class: 'dist' },
            [5, 4, 3, 2, 1].map((r) =>
              h('div', { class: 'dist-row' }, h('span', {}, `${r}★`), h('div', { class: 'bar' }, h('i', { style: `width:${(s.byRating[r - 1] / maxR) * 100}%` })), h('span', { class: 'muted small' }, String(s.byRating[r - 1]))),
            ),
          ),
        )
      : null;

    const notable = [
      s.longest ? note('Longest', s.longest, `${fmt(s.longest.pages!)} pages`) : null,
      s.shortest ? note('Shortest', s.shortest, `${fmt(s.shortest.pages!)} pages`) : null,
      ...s.books
        .filter((b) => b.rating === 5)
        .slice(-3)
        .map((b) => note('Loved', b)),
    ].filter(Boolean);

    const authors = s.topAuthors.length
      ? h('section', { class: 'card' }, h('h2', {}, 'Authors you came back to'), h('ul', { class: 'plain' }, s.topAuthors.map((a) => h('li', { class: 'row between' }, h('span', {}, a.name), h('span', { class: 'muted' }, plural(a.count, 'book'))))))
      : null;

    const read = s.books.length
      ? h(
          'section',
          { class: 'card' },
          h('h2', {}, `Read in ${year}`),
          h('div', { class: 'cover-grid' }, [...s.books].reverse().map((b) => h('a', { href: `#/book/${encodeURIComponent(b.id)}`, title: b.title }, coverEl(b, coverUrl(b, 'M'), 'grid')))),
        )
      : null;

    const parts: (HTMLElement | null)[] = [
      h('header', { class: 'top' }, h('h1', {}, 'Stats')),
      yearNav,
      tiles,
      goalCard,
      s.books.length ? months : h('p', { class: 'muted center' }, `No books finished in ${year} yet.`),
      ratings,
      notable.length ? h('section', { class: 'card' }, h('h2', {}, 'Highlights'), h('div', { class: 'list' }, notable)) : null,
      authors,
      read,
      h(
        'p',
        { class: 'muted small center' },
        `All time: ${plural(all.filter((b) => b.shelf === 'read').length, 'book')} read · ${all.filter((b) => b.shelf === 'reading').length} reading · ${all.filter((b) => b.shelf === 'want').length} want to read`,
      ),
    ];
    view.replaceChildren(...parts.filter((p): p is HTMLElement => !!p));
  };
  render();
  return store.subscribe(render);
}

function tile(value: string, label: string): HTMLElement {
  return h('div', { class: 'tile' }, h('b', {}, value), h('span', {}, label));
}

function note(label: string, b: Book, extra?: string): HTMLElement {
  return h(
    'a',
    { class: 'book compact', href: `#/book/${encodeURIComponent(b.id)}` },
    coverEl(b, coverUrl(b, 'S'), 'xs'),
    h(
      'div',
      { class: 'book-body' },
      h('span', { class: 'eyebrow' }, label),
      h('div', { class: 'title' }, b.title),
      h('div', { class: 'row tight' }, b.rating ? stars(b.rating) : null, extra ? h('span', { class: 'muted small' }, extra) : null),
    ),
  );
}

function goalSheet(year: number): void {
  sheet(`${year} reading goal`, (close) => {
    const n = numberInput({ value: String(store.goal(year) ?? ''), 'aria-label': 'Books', inputmode: 'numeric', placeholder: '24' });
    setTimeout(() => n.select(), 50);
    return h(
      'form',
      {
        class: 'stack',
        onsubmit: (e: Event) => {
          e.preventDefault();
          const v = readNum(n);
          store.setGoal(year, v ? Math.round(v) : undefined);
          close();
        },
      },
      h('label', { class: 'field' }, h('span', {}, 'Books to read this year'), n),
      h('p', { class: 'muted small' }, 'Leave it empty to remove the goal.'),
      h('div', { class: 'row end' }, h('button', { type: 'submit', class: 'btn primary' }, 'Save')),
    );
  });
}
