import * as ol from './ol';
import * as store from './store';
import type { Book, Hit, Shelf } from './types';
import { SHELF_LABEL, SHELVES } from './types';
import { coverEl, fmt, h, icon, numberInput, readNum, sheet, stars, toast } from './ui';

let lastQuery = '';
let lastHits: Hit[] = [];

export function openAdd(view: HTMLElement, initial: string): () => void {
  const ctrl = { current: null as AbortController | null };
  let timer = 0;
  const input = h('input', {
    type: 'search',
    class: 'big-search',
    placeholder: 'Title, author or ISBN',
    'aria-label': 'Search books',
    autocomplete: 'off',
    enterkeyhint: 'search',
    value: initial || lastQuery,
  });
  const results = h('div', { class: 'list results', 'aria-live': 'polite' });

  const run = async (q: string) => {
    ctrl.current?.abort();
    q = q.trim();
    lastQuery = q;
    if (q.length < 2) {
      lastHits = [];
      results.replaceChildren(hint());
      return;
    }
    const ac = new AbortController();
    ctrl.current = ac;
    results.replaceChildren(h('p', { class: 'muted center loading' }, 'Searching Open Library…'));
    try {
      const isbn = ol.normalizeIsbn(q);
      const hits = isbn ? [await ol.byIsbn(isbn, ac.signal)].filter((x): x is Hit => !!x) : await ol.search(q, ac.signal);
      if (ac.signal.aborted) return;
      lastHits = hits;
      renderHits(hits, q);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      results.replaceChildren(
        h('p', { class: 'muted center' }, 'Couldn’t reach Open Library. ', h('button', { type: 'button', class: 'link', onclick: () => run(q) }, 'Try again')),
        manualRow(q),
      );
    }
  };

  const renderHits = (hits: Hit[], q: string) => {
    if (!hits.length) {
      results.replaceChildren(h('p', { class: 'muted center' }, `Nothing found for “${q}”.`), manualRow(q));
      return;
    }
    results.replaceChildren(...hits.map(hitRow), manualRow(q));
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => run(input.value), 350);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      clearTimeout(timer);
      run(input.value);
      input.blur();
    }
  });

  view.replaceChildren(
    h('header', { class: 'top' }, h('h1', {}, 'Add a book')),
    h('div', { class: 'search-row' }, h('div', { class: 'search-wrap' }, icon('search'), input)),
    h(
      'div',
      { class: 'row tight' },
      h('button', { type: 'button', class: 'chip', onclick: () => scanSheet() }, icon('scan'), 'Scan ISBN barcode'),
      h('button', { type: 'button', class: 'chip', onclick: () => manualSheet(input.value) }, icon('edit'), 'Add by hand'),
    ),
    results,
  );

  if (initial && initial !== lastQuery) run(initial);
  else if (lastQuery && lastHits.length) renderHits(lastHits, lastQuery);
  else if (input.value) run(input.value);
  else results.replaceChildren(hint());
  setTimeout(() => {
    if (!input.value && matchMedia('(hover: hover)').matches) input.focus();
  }, 50);

  const unsub = store.subscribe(() => lastHits.length && renderHits(lastHits, lastQuery));
  return () => {
    unsub();
    clearTimeout(timer);
    ctrl.current?.abort();
  };
}

function hint(): HTMLElement {
  return h('p', { class: 'muted center small' }, 'Book details, covers and ratings come from Open Library, a free, open catalog of books.');
}

function manualRow(q: string): HTMLElement {
  return h('p', { class: 'center small' }, 'Not the right book? ', h('button', { type: 'button', class: 'link', onclick: () => manualSheet(q) }, 'Add it by hand'));
}

function hitRow(hit: Hit): HTMLElement {
  const have = store.findSame(hit.work, hit.isbn);
  return h(
    'button',
    { type: 'button', class: 'book hit', onclick: () => (have ? (location.hash = `#/book/${encodeURIComponent(have.id)}`) : addSheet(hit)) },
    coverEl(hit, ol.coverUrl(hit, 'M'), 'sm'),
    h(
      'div',
      { class: 'book-body' },
      h('div', { class: 'title' }, hit.title),
      h('div', { class: 'author' }, hit.authors.slice(0, 3).join(', ') || 'Unknown author'),
      h('div', { class: 'muted small' }, [hit.year, hit.pages ? `${fmt(hit.pages)} pages` : null, hit.editions && hit.editions > 1 ? `${fmt(hit.editions)} editions` : null].filter(Boolean).join(' · ')),
      hit.ratingAvg && hit.ratingCount ? h('div', { class: 'row tight' }, stars(hit.ratingAvg), h('span', { class: 'muted small' }, `${fmt(hit.ratingAvg, 1)} (${fmt(hit.ratingCount)})`)) : null,
      have ? h('span', { class: 'badge' }, icon('check'), `On ${SHELF_LABEL[have.shelf]}`) : null,
    ),
  );
}

export function newBook(hit: Hit, shelf: Shelf): Book {
  const now = new Date().toISOString();
  const b: Book = {
    id: `ol:${hit.work}`,
    work: hit.work,
    title: hit.title,
    authors: hit.authors.slice(0, 4),
    cover: hit.cover,
    isbn: hit.isbn,
    year: hit.year,
    pages: hit.pages,
    shelf: 'want',
    added: now,
    updated: now,
  };
  return store.moveTo(b, shelf);
}

/** Pick a shelf for a search result. */
function addSheet(hit: Hit): void {
  sheet('Add to shelf', (close) => {
    const add = (shelf: Shelf, open: boolean) => {
      const b = newBook(hit, shelf);
      store.upsertBook(b);
      close();
      toast(`Added to ${SHELF_LABEL[shelf]}`, { label: 'Undo', run: () => store.deleteBook(b.id) });
      if (open) location.hash = `#/book/${encodeURIComponent(b.id)}`;
    };
    return h(
      'div',
      { class: 'stack' },
      h('div', { class: 'hit-head' }, coverEl(hit, ol.coverUrl(hit, 'M'), 'sm'), h('div', {}, h('div', { class: 'title' }, hit.title), h('div', { class: 'author' }, hit.authors.slice(0, 3).join(', ')))),
      h(
        'div',
        { class: 'shelf-pick' },
        SHELVES.map((s) =>
          h('button', { type: 'button', class: `btn ${s === 'want' ? 'primary' : ''}`, onclick: () => add(s, s === 'read') }, SHELF_LABEL[s]),
        ),
      ),
      h('p', { class: 'muted small' }, 'Read takes you to the book so you can rate it and write what you thought.'),
    );
  });
}

/** For books Open Library doesn't have, or when you're offline. */
export function manualSheet(q = ''): void {
  sheet('Add by hand', (close) => {
    const isbn0 = ol.normalizeIsbn(q);
    const title = h('input', { type: 'text', value: isbn0 ? '' : q, 'aria-label': 'Title', required: true });
    const authors = h('input', { type: 'text', 'aria-label': 'Authors', placeholder: 'Separate with commas' });
    const pages = numberInput({ 'aria-label': 'Pages', inputmode: 'numeric' });
    const isbn = h('input', { type: 'text', 'aria-label': 'ISBN', inputmode: 'numeric', value: isbn0 ?? '' });
    const shelf = h('select', { 'aria-label': 'Shelf' }, SHELVES.map((s) => h('option', { value: s, selected: s === 'want' }, SHELF_LABEL[s])));
    const field = (label: string, el: HTMLElement) => h('label', { class: 'field' }, h('span', {}, label), el);
    setTimeout(() => title.focus(), 50);
    return h(
      'form',
      {
        class: 'stack',
        onsubmit: (e: Event) => {
          e.preventDefault();
          if (!title.value.trim()) return title.focus();
          const now = new Date().toISOString();
          const b = store.moveTo(
            {
              id: store.uid('m:'),
              title: title.value.trim(),
              authors: authors.value.split(',').map((a) => a.trim()).filter(Boolean),
              pages: readNum(pages) ? Math.round(readNum(pages)!) : undefined,
              isbn: ol.normalizeIsbn(isbn.value) ?? undefined,
              shelf: 'want',
              added: now,
              updated: now,
            },
            shelf.value as Shelf,
          );
          store.upsertBook(b);
          close();
          location.hash = `#/book/${encodeURIComponent(b.id)}`;
        },
      },
      field('Title', title),
      field('Authors', authors),
      h('div', { class: 'row' }, field('Pages', pages), field('ISBN', isbn)),
      field('Shelf', shelf),
      h('p', { class: 'muted small' }, 'The app will still try to find it on Open Library for a cover and details.'),
      h('div', { class: 'row end' }, h('button', { type: 'submit', class: 'btn primary' }, 'Add')),
    );
  });
}

// ---------- ISBN barcode ----------

interface Detector {
  detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

async function makeDetector(): Promise<Detector> {
  const formats = ['ean_13'];
  const Native = (globalThis as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
  if (Native) return new Native({ formats });
  // iPhone Safari and Firefox have no BarcodeDetector: use the ZXing WebAssembly build.
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: formats as never }) as unknown as Detector;
}

/** Scan the barcode on the back of a book (an EAN-13 starting 978 or 979: the ISBN). */
function scanSheet(): void {
  let stream: MediaStream | null = null;
  let stop = false;
  const video = h('video', { playsinline: true, muted: true, class: 'scan-video' });
  const status = h('p', { class: 'muted small' }, 'Starting camera…');
  const codeIn = h('input', { type: 'text', inputmode: 'numeric', placeholder: 'or type the ISBN', 'aria-label': 'ISBN' });
  let close = () => {};

  const found = async (raw: string) => {
    const isbn = ol.normalizeIsbn(raw);
    if (!isbn) {
      status.textContent = /^\d{13}$/.test(raw) && !/^97[89]/.test(raw) ? 'That’s a price or product barcode. Look for the one starting 978 or 979.' : 'That isn’t a valid ISBN.';
      return;
    }
    stop = true;
    const have = store.findSame(undefined, isbn);
    if (have) {
      close();
      location.hash = `#/book/${encodeURIComponent(have.id)}`;
      return;
    }
    status.textContent = `Looking up ${isbn}…`;
    try {
      const hit = await ol.byIsbn(isbn);
      close();
      if (hit) {
        const same = store.findSame(hit.work);
        if (same) location.hash = `#/book/${encodeURIComponent(same.id)}`;
        else addSheet(hit);
      } else {
        toast('Not on Open Library. Add it by hand.');
        manualSheet(isbn);
      }
    } catch (e) {
      status.textContent = `Lookup failed: ${(e as Error).message}`;
      stop = false;
    }
  };

  close = sheet(
    'Scan ISBN',
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
      status.textContent = 'Point the camera at the barcode on the back cover.';
      const detector = await makeDetector();
      let lastBad = '';
      while (!stop) {
        if (video.readyState >= 2) {
          const codes = await detector.detect(video).catch(() => []);
          const code = codes.find((c) => /^97[89]\d{10}$/.test(c.rawValue))?.rawValue;
          if (code && !stop) return found(code);
          if (codes[0]?.rawValue && codes[0].rawValue !== lastBad) {
            lastBad = codes[0].rawValue;
            status.textContent = 'That’s a price or product barcode. Look for the one starting 978 or 979.';
          }
        }
        await new Promise((r) => setTimeout(r, 180));
      }
    } catch (e) {
      video.hidden = true;
      status.textContent = `Camera unavailable (${(e as Error).name || 'error'}). Type the ISBN instead; it’s above the barcode.`;
    }
  })();
}
