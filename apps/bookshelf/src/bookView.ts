import * as ol from './ol';
import * as store from './store';
import type { Book, Details, Shelf } from './types';
import { SHELF_LABEL, SHELVES } from './types';
import { coverEl, fmt, fmtDate, h, icon, numberInput, plural, readNum, sheet, starInput, stars, toast } from './ui';

const STALE_MS = 30 * 24 * 3600 * 1000;

export function openBook(view: HTMLElement, id: string): () => void {
  const ctrl = new AbortController();
  let saveTimer = 0;
  const about = h('section', { class: 'about' });
  let heroEl: HTMLElement | null = null;
  let mineEl: HTMLElement | null = null;

  const current = () => store.getBook(id);
  const update = (patch: Partial<Book>) => {
    const b = current();
    if (b) store.upsertBook({ ...b, ...patch });
  };

  const render = () => {
    const b = current();
    if (!b) {
      view.replaceChildren(
        topBar('#/'),
        h('div', { class: 'empty card' }, h('p', {}, 'This book isn’t on your shelves.'), h('a', { class: 'btn', href: '#/' }, 'Back to shelves')),
      );
      return;
    }
    heroEl = hero(b);
    mineEl = mine(b);
    view.replaceChildren(topBar(`#/shelf/${b.shelf}`, b), heroEl, mineEl, about);
    renderAbout();
  };

  /** New details arrived: refresh the header, and your section unless you're typing in it. */
  const refresh = () => {
    const b = current();
    if (!b || !heroEl || !mineEl) return;
    const h2 = hero(b);
    heroEl.replaceWith(h2);
    heroEl = h2;
    if (!mineEl.contains(document.activeElement)) {
      const m2 = mine(b);
      mineEl.replaceWith(m2);
      mineEl = m2;
    }
  };

  // ---------- your part: shelf, progress, dates, rating, thoughts ----------

  const mine = (b: Book): HTMLElement => {
    const seg = h(
      'div',
      { class: 'seg buttons', role: 'group', 'aria-label': 'Shelf' },
      SHELVES.map((s) =>
        h('button', { type: 'button', class: s === b.shelf ? 'on' : '', 'aria-pressed': String(s === b.shelf), onclick: () => move(s) }, SHELF_LABEL[s]),
      ),
    );
    const parts: (HTMLElement | null)[] = [seg];

    if (b.shelf === 'reading') parts.push(progress(b));

    if (b.shelf !== 'want') {
      const dateIn = (key: 'started' | 'finished', label: string) => {
        const el = h('input', { type: 'date', value: b[key] ?? '', 'aria-label': label, max: store.localDate() });
        el.addEventListener('change', () => update({ [key]: el.value || undefined }));
        return h('label', { class: 'field' }, h('span', {}, label), el);
      };
      parts.push(h('div', { class: 'row dates' }, dateIn('started', 'Started'), b.shelf === 'read' ? dateIn('finished', 'Finished') : null));
      parts.push(
        h(
          'div',
          { class: 'field' },
          h('span', {}, 'Your rating'),
          starInput(b.rating, (v) => update({ rating: v })),
        ),
      );
    }

    const thoughts = h('textarea', {
      class: 'thoughts',
      rows: 5,
      'aria-label': 'Your thoughts',
      placeholder: b.shelf === 'want' ? 'Why you want to read it, who recommended it…' : 'What you thought: what stayed with you, quotes, who you’d recommend it to…',
    });
    thoughts.value = b.review ?? '';
    const saved = h('span', { class: 'muted small saved' });
    thoughts.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saved.textContent = '';
      saveTimer = window.setTimeout(() => {
        update({ review: thoughts.value.trim() ? thoughts.value : undefined });
        saved.textContent = 'Saved';
      }, 500);
    });
    thoughts.addEventListener('blur', () => {
      if (!saveTimer) return;
      clearTimeout(saveTimer);
      saveTimer = 0;
      if ((current()?.review ?? '') !== thoughts.value.trim() && (current()?.review ?? '') !== thoughts.value) {
        update({ review: thoughts.value.trim() ? thoughts.value : undefined });
        saved.textContent = 'Saved';
      }
    });
    parts.push(h('label', { class: 'field' }, h('span', { class: 'row between' }, b.shelf === 'want' ? 'Notes' : 'Your thoughts', saved), thoughts));

    return h('section', { class: 'card mine' }, ...parts);
  };

  const progress = (b: Book): HTMLElement => {
    const pageIn = numberInput({ value: b.page ? String(b.page) : '', 'aria-label': 'Current page', inputmode: 'numeric', placeholder: '0' });
    const pagesIn = numberInput({ value: b.pages ? String(b.pages) : '', 'aria-label': 'Total pages', inputmode: 'numeric', placeholder: '?' });
    const bar = h('i');
    const label = h('span', { class: 'muted small' });
    const paint = () => {
      const p = readNum(pageIn);
      const n = readNum(pagesIn);
      const pct = p && n ? Math.min(100, Math.round((p / n) * 100)) : 0;
      bar.style.width = `${pct}%`;
      label.textContent = n ? `${pct}%${p && n > p ? ` · ${plural(Math.round(n - p), 'page')} to go` : ''}` : 'Add the page count to see progress';
    };
    const commit = () => {
      const p = readNum(pageIn);
      const n = readNum(pagesIn);
      update({ page: p && p > 0 ? Math.round(p) : undefined, pages: n && n > 0 ? Math.round(n) : undefined });
      if (p && n && p >= n) {
        toast('Last page! Mark it as read?', { label: 'Mark read', run: () => move('read') });
      }
    };
    pageIn.addEventListener('input', paint);
    pagesIn.addEventListener('input', paint);
    pageIn.addEventListener('change', commit);
    pagesIn.addEventListener('change', commit);
    paint();
    return h(
      'div',
      { class: 'progress big' },
      h('div', { class: 'row tight' }, h('span', {}, 'Page'), pageIn, h('span', {}, 'of'), pagesIn),
      h('div', { class: 'bar' }, bar),
      h('div', { class: 'row between' }, label, h('button', { type: 'button', class: 'btn small', onclick: () => move('read') }, icon('check'), 'Finished it')),
    );
  };

  const move = (shelf: Shelf) => {
    const b = current();
    if (!b || b.shelf === shelf) return;
    const before = { ...b };
    store.upsertBook(store.moveTo(b, shelf));
    render();
    const msg = { reading: 'Started reading', want: 'Moved to Want to read', read: 'Marked as read' }[shelf];
    toast(shelf === 'read' && !b.rating ? `${msg}. How was it? Rate it below.` : msg, { label: 'Undo', run: () => (store.upsertBook(before), render()) });
  };

  // ---------- about: what Open Library knows ----------

  let state: 'idle' | 'loading' | 'error' | 'unlinked' = 'idle';

  const renderAbout = () => {
    const b = current();
    if (!b) return;
    const d = store.details(b.work);
    const kids: (Node | null)[] = [h('h2', {}, 'About this book')];
    if (d) kids.push(...detailsBody(b, d));
    else if (state === 'loading') kids.push(h('p', { class: 'muted loading' }, 'Looking it up on Open Library…'));
    else if (state === 'unlinked')
      kids.push(
        h('p', { class: 'muted' }, 'Couldn’t find this book on Open Library, so there are no details. Check the title and author with “Edit”, or search for it.'),
        h('a', { class: 'btn', href: `#/add?q=${encodeURIComponent(`${b.title} ${b.authors[0] ?? ''}`.trim())}` }, icon('search'), 'Search Open Library'),
      );
    else if (state === 'error')
      kids.push(h('p', { class: 'muted' }, 'Couldn’t reach Open Library. ', h('button', { type: 'button', class: 'link', onclick: () => fetchAbout(true) }, 'Try again')));
    about.replaceChildren(...kids.filter((k): k is Node => !!k));
  };

  const fetchAbout = async (force = false) => {
    let b = current();
    if (!b) return;
    const cached = store.details(b.work);
    if (cached && !force && Date.now() - Date.parse(cached.fetched) < STALE_MS) return;
    state = 'loading';
    if (!cached) renderAbout();
    try {
      if (!b.work) {
        const hit = (b.isbn ? await ol.byIsbn(b.isbn, ctrl.signal).catch(() => null) : null) ?? (await ol.match(b.title, b.authors[0], ctrl.signal));
        if (!hit) {
          state = 'unlinked';
          renderAbout();
          return;
        }
        b = { ...current()!, work: hit.work, cover: b.cover ?? hit.cover, pages: b.pages ?? hit.pages, year: b.year ?? hit.year, isbn: b.isbn ?? hit.isbn };
        store.upsertBook(b);
      }
      store.setDetails(await ol.fetchDetails(b.work!, ctrl.signal));
      state = 'idle';
      refresh();
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      state = cached ? 'idle' : 'error';
    }
    renderAbout();
  };

  render();
  fetchAbout();
  return () => {
    ctrl.abort();
    clearTimeout(saveTimer);
  };
}

function topBar(back: string, b?: Book): HTMLElement {
  return h(
    'header',
    { class: 'top' },
    h('a', { class: 'icon-btn', href: back, 'aria-label': 'Back' }, icon('back')),
    b ? h('div', { class: 'row tight' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Edit book details', onclick: () => editSheet(b) }, icon('edit')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove book', onclick: () => {
        const removed = store.deleteBook(b.id);
        location.hash = `#/shelf/${b.shelf}`;
        if (removed) toast(`Removed “${removed.title}”`, { label: 'Undo', run: () => store.upsertBook(removed) });
      } }, icon('trash')),
    ) : null,
  );
}

function hero(b: Book): HTMLElement {
  const d = store.details(b.work);
  return h(
    'section',
    { class: 'hero' },
    coverEl(b, ol.coverUrl(b, 'L'), 'lg'),
    h(
      'div',
      { class: 'hero-body' },
      h('h1', {}, b.title),
      h('div', { class: 'author' }, b.authors.join(', ') || 'Unknown author'),
      h('div', { class: 'muted small' }, [b.year ? `First published ${b.year}` : null, b.pages ? `${fmt(b.pages)} pages` : null].filter(Boolean).join(' · ')),
      d?.ratingAvg && d.ratingCount
        ? h('div', { class: 'row tight community' }, stars(d.ratingAvg), h('span', { class: 'small' }, `${fmt(d.ratingAvg, 2)}`), h('span', { class: 'muted small' }, `(${plural(d.ratingCount, 'rating')})`))
        : null,
    ),
  );
}

function detailsBody(b: Book, d: Details): Node[] {
  const out: Node[] = [];
  if (d.description) {
    const p = h('div', { class: 'desc clamp' }, ...d.description.split(/\n{2,}/).map((para) => h('p', {}, para)));
    out.push(p);
    if (d.description.length > 420) {
      const more = h('button', { type: 'button', class: 'link' }, 'Show more');
      more.addEventListener('click', () => {
        const open = p.classList.toggle('clamp');
        more.textContent = open ? 'Show more' : 'Show less';
      });
      out.push(more);
    } else p.classList.remove('clamp');
  } else out.push(h('p', { class: 'muted' }, 'Open Library has no description for this book.'));

  if (d.ratingCount && d.ratingCounts) {
    const max = Math.max(...Object.values(d.ratingCounts), 1);
    out.push(
      h(
        'div',
        { class: 'block' },
        h('h3', {}, 'Open Library readers'),
        h(
          'div',
          { class: 'dist', role: 'table', 'aria-label': 'Rating distribution' },
          [5, 4, 3, 2, 1].map((n) => {
            const c = d.ratingCounts![String(n)] ?? 0;
            return h('div', { class: 'dist-row', role: 'row' }, h('span', { role: 'cell' }, `${n}★`), h('div', { class: 'bar', role: 'cell' }, h('i', { style: `width:${(c / max) * 100}%` })), h('span', { class: 'muted small', role: 'cell' }, fmt(c)));
          }),
        ),
        b.rating ? h('p', { class: 'small muted' }, `You gave it ${b.rating}★; the average is ${fmt(d.ratingAvg ?? 0, 1)}★.`) : null,
        d.shelfCounts
          ? h('p', { class: 'small muted' }, `${fmt(d.shelfCounts.read)} have read it · ${fmt(d.shelfCounts.reading)} reading · ${fmt(d.shelfCounts.want)} want to`)
          : null,
      ),
    );
  }

  if (d.subjects.length) out.push(h('div', { class: 'block' }, h('h3', {}, 'Subjects'), h('div', { class: 'chips' }, d.subjects.map((s) => h('span', { class: 'chip' }, s)))));

  for (const a of d.authors.filter((a) => a.bio)) {
    out.push(
      h(
        'div',
        { class: 'block' },
        h('h3', {}, `About ${a.name}`),
        a.birth ? h('p', { class: 'small muted' }, `${a.birth}${a.death ? ` – ${a.death}` : ''}`) : null,
        h('p', { class: 'bio' }, ol.cleanDescription(a.bio) ?? ''),
      ),
    );
  }

  const links = [{ title: 'Open Library', url: ol.workUrl(d.work) }, ...d.links.slice(0, 5)];
  out.push(
    h(
      'div',
      { class: 'block links' },
      h('h3', {}, 'Links'),
      h('ul', {}, links.map((l) => h('li', {}, h('a', { href: l.url, target: '_blank', rel: 'noopener' }, icon('link'), l.title)))),
      h('p', { class: 'muted small' }, `Details from Open Library, ${fmtDate(d.fetched.slice(0, 10))}.`),
    ),
  );
  return out;
}

/** Fix the title, authors, pages, year or ISBN, for hand-added books or Open Library gaps. */
export function editSheet(b: Book): void {
  sheet('Edit book', (close) => {
    const title = h('input', { type: 'text', value: b.title, 'aria-label': 'Title', required: true });
    const authors = h('input', { type: 'text', value: b.authors.join(', '), 'aria-label': 'Authors', placeholder: 'Separate with commas' });
    const pages = numberInput({ value: b.pages ? String(b.pages) : '', 'aria-label': 'Pages', inputmode: 'numeric' });
    const year = numberInput({ value: b.year ? String(b.year) : '', 'aria-label': 'Year first published', inputmode: 'numeric' });
    const isbn = h('input', { type: 'text', value: b.isbn ?? '', 'aria-label': 'ISBN', inputmode: 'numeric' });
    const relink = h('input', { type: 'checkbox' });
    const field = (label: string, el: HTMLElement) => h('label', { class: 'field' }, h('span', {}, label), el);
    return h(
      'form',
      {
        class: 'stack',
        onsubmit: (e: Event) => {
          e.preventDefault();
          if (!title.value.trim()) return title.focus();
          const cur = store.getBook(b.id) ?? b;
          const next: Book = {
            ...cur,
            title: title.value.trim(),
            authors: authors.value.split(',').map((a) => a.trim()).filter(Boolean),
            pages: readNum(pages) ? Math.round(readNum(pages)!) : undefined,
            year: readNum(year) ? Math.round(readNum(year)!) : undefined,
            isbn: ol.normalizeIsbn(isbn.value) ?? (isbn.value.trim() || undefined),
          };
          if (relink.checked) {
            next.work = undefined;
            next.cover = undefined;
          }
          store.upsertBook(next);
          close();
          // re-render the page with the new details (and re-match if asked)
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        },
      },
      field('Title', title),
      field('Authors', authors),
      h('div', { class: 'row' }, field('Pages', pages), field('First published', year)),
      field('ISBN', isbn),
      b.work ? h('label', { class: 'check' }, relink, h('span', {}, 'Wrong book? Find it on Open Library again from the title and author')) : null,
      h('div', { class: 'row end' }, h('button', { type: 'submit', class: 'btn primary' }, 'Save')),
    );
  });
}
