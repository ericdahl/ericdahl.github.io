import { coverUrl } from './ol';
import { matches, sortBooks, type Sort } from './stats';
import * as store from './store';
import type { Book, Shelf } from './types';
import { SHELF_LABEL, SHELVES } from './types';
import { coverEl, fmt, fmtDate, h, icon, plural, stars } from './ui';

const SORTS: Record<Shelf, [Sort, string][]> = {
  reading: [['recent', 'Recently updated'], ['title', 'Title'], ['author', 'Author']],
  want: [['recent', 'Recently added'], ['title', 'Title'], ['author', 'Author']],
  read: [['finished', 'Date finished'], ['rating', 'My rating'], ['title', 'Title'], ['author', 'Author']],
};

const prefs = { sort: {} as Partial<Record<Shelf, Sort>>, q: '' };

export function defaultShelf(): Shelf {
  return store.books().some((b) => b.shelf === 'reading') ? 'reading' : store.books().some((b) => b.shelf === 'want') ? 'want' : 'read';
}

export function openShelf(view: HTMLElement, shelf: Shelf): () => void {
  const filter = h('input', { type: 'search', class: 'filter', placeholder: 'Filter by title or author', 'aria-label': 'Filter books', value: prefs.q });
  const sortSel = h(
    'select',
    { class: 'sort', 'aria-label': 'Sort' },
    SORTS[shelf].map(([v, label]) => h('option', { value: v, selected: v === (prefs.sort[shelf] ?? SORTS[shelf][0][0]) }, label)),
  );
  const tabs = h('nav', { class: 'seg', 'aria-label': 'Shelves' });
  const list = h('div', { class: 'list' });

  const render = () => {
    const all = store.books();
    tabs.replaceChildren(
      ...SHELVES.map((s) =>
        h(
          'a',
          { href: `#/shelf/${s}`, class: s === shelf ? 'on' : '', 'aria-current': s === shelf ? 'page' : undefined },
          SHELF_LABEL[s],
          h('span', { class: 'count' }, all.filter((b) => b.shelf === s).length),
        ),
      ),
    );
    const onShelf = all.filter((b) => b.shelf === shelf);
    const shown = sortBooks(onShelf.filter((b) => matches(b, filter.value)), sortSel.value as Sort);
    if (!onShelf.length) {
      list.replaceChildren(empty(shelf));
      return;
    }
    if (!shown.length) {
      list.replaceChildren(h('p', { class: 'muted center' }, `No books match “${filter.value}”.`));
      return;
    }
    // The read shelf, by date finished, is split into years.
    if (shelf === 'read' && sortSel.value === 'finished') {
      const groups = new Map<string, Book[]>();
      for (const b of shown) {
        const y = b.finished?.slice(0, 4) ?? 'Date unknown';
        groups.set(y, [...(groups.get(y) ?? []), b]);
      }
      list.replaceChildren(
        ...[...groups].map(([y, bs]) => h('section', { class: 'group' }, h('h3', {}, y, h('span', { class: 'muted' }, plural(bs.length, 'book'))), bs.map(card))),
      );
    } else list.replaceChildren(...shown.map(card));
  };

  filter.addEventListener('input', () => {
    prefs.q = filter.value;
    render();
  });
  sortSel.addEventListener('change', () => {
    prefs.sort[shelf] = sortSel.value as Sort;
    render();
  });

  view.replaceChildren(
    h('header', { class: 'top' }, h('h1', {}, 'Bookshelf'), h('a', { class: 'icon-btn', href: '#/add', 'aria-label': 'Add a book' }, icon('plus'))),
    tabs,
    h('div', { class: 'row tools' }, filter, sortSel),
    list,
  );
  render();
  return store.subscribe(render);
}

function empty(shelf: Shelf): HTMLElement {
  const text = {
    reading: 'Nothing on the go. Start one from Want to read, or find a book.',
    want: 'Books you want to read go here.',
    read: 'Books you’ve finished go here, with your rating and thoughts.',
  }[shelf];
  return h(
    'div',
    { class: 'empty card' },
    h('p', {}, text),
    h('a', { class: 'btn primary', href: '#/add' }, icon('search'), 'Find a book'),
    store.books().length ? null : h('p', { class: 'muted small' }, 'Coming from Goodreads? Import your library on the ', h('a', { href: '#/data' }, 'Data'), ' page.'),
  );
}

export function card(b: Book): HTMLElement {
  const meta: (Node | string)[] = [];
  if (b.shelf === 'reading') {
    const pct = b.pages && b.page ? Math.min(100, Math.round((b.page / b.pages) * 100)) : null;
    meta.push(
      h(
        'div',
        { class: 'progress' },
        h('div', { class: 'bar' }, h('i', { style: `width:${pct ?? 0}%` })),
        h('span', { class: 'muted small' }, pct != null ? `${pct}% · p. ${fmt(b.page!)} of ${fmt(b.pages!)}` : b.started ? `Started ${fmtDate(b.started)}` : 'Started'),
      ),
    );
  } else if (b.shelf === 'read') {
    meta.push(
      h(
        'div',
        { class: 'row tight' },
        b.rating ? stars(b.rating) : h('span', { class: 'muted small' }, 'Not rated'),
        b.finished ? h('span', { class: 'muted small' }, fmtDate(b.finished)) : null,
      ),
    );
    if (b.review) meta.push(h('p', { class: 'snippet' }, b.review));
  } else {
    meta.push(h('span', { class: 'muted small' }, [b.year, b.pages ? `${fmt(b.pages)} pages` : null].filter(Boolean).join(' · ')));
  }
  return h(
    'a',
    { class: 'book', href: `#/book/${encodeURIComponent(b.id)}` },
    coverEl(b, coverUrl(b, 'M'), 'sm'),
    h('div', { class: 'book-body' }, h('div', { class: 'title' }, b.title), h('div', { class: 'author' }, b.authors.join(', ') || 'Unknown author'), ...meta),
  );
}
