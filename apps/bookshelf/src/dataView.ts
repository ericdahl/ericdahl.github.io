import { parseImport, toJsonl } from './io';
import * as store from './store';
import { copyText, download, h, icon, plural, toast } from './ui';

export function openData(view: HTMLElement): () => void {
  const render = () => {
    const books = store.books();
    const fileIn = h('input', { type: 'file', accept: '.jsonl,.json,.csv,.txt,text/csv,application/json', hidden: true, 'aria-label': 'Import file' });
    const paste = h('textarea', { rows: 4, 'aria-label': 'Paste data to import', placeholder: 'Paste JSONL or a Goodreads CSV here' });
    const result = h('p', { class: 'small', 'aria-live': 'polite' });

    const doImport = (text: string) => {
      const parsed = parseImport(text, () => store.uid('m:'));
      if (!parsed.books.length && !parsed.settings) {
        result.textContent = parsed.errors[0] ?? 'Nothing to import.';
        result.className = 'small warn';
        return;
      }
      const { added, updated } = store.merge(parsed);
      const msg = `Imported: ${plural(added, 'new book')}${updated ? `, ${plural(updated, 'book')} updated` : ''}.${parsed.errors.length ? ` Skipped ${plural(parsed.errors.length, 'line')}.` : ''}`;
      toast(msg);
      paste.value = '';
    };
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files?.[0];
      if (f) doImport(await f.text());
      fileIn.value = '';
    });

    const name = `bookshelf-${store.localDate()}.jsonl`;
    const text = () => toJsonl(store.books(), store.settings());

    view.replaceChildren(
      h('header', { class: 'top' }, h('h1', {}, 'Data')),
      h(
        'section',
        { class: 'card stack' },
        h('h2', {}, 'Export'),
        h('p', { class: 'muted small' }, `${plural(books.length, 'book')}, with your ratings, thoughts and dates, as JSON Lines: one book per line, readable by people, scripts and AIs.`),
        h(
          'div',
          { class: 'row wrap' },
          h('button', { type: 'button', class: 'btn primary', onclick: () => download(name, text()) }, icon('data'), 'Download .jsonl'),
          h('button', { type: 'button', class: 'btn', onclick: async () => toast((await copyText(text())) ? 'Copied' : 'Couldn’t copy') }, icon('copy'), 'Copy'),
          'share' in navigator
            ? h('button', {
                type: 'button',
                class: 'btn',
                onclick: () => navigator.share({ files: [new File([text()], name, { type: 'text/plain' })] }).catch(() => {}),
              }, 'Share…')
            : null,
        ),
      ),
      h(
        'section',
        { class: 'card stack' },
        h('h2', {}, 'Import'),
        h(
          'p',
          { class: 'muted small' },
          'A Bookshelf export, or your Goodreads library (on Goodreads: My Books → Import and export → Export library). Books already here are updated rather than added twice.',
        ),
        fileIn,
        h('div', { class: 'row wrap' }, h('button', { type: 'button', class: 'btn', onclick: () => fileIn.click() }, 'Choose file…')),
        paste,
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', onclick: () => paste.value.trim() && doImport(paste.value) }, 'Import pasted')),
        result,
      ),
      h(
        'section',
        { class: 'card stack' },
        h('h2', {}, 'Storage'),
        h(
          'p',
          { class: 'muted small' },
          'Everything is stored in this browser on this device. Nothing is sent anywhere except searches and lookups to Open Library. Clearing site data deletes your shelves, so export now and then.',
        ),
        h(
          'div',
          { class: 'row' },
          h('button', {
            type: 'button',
            class: 'btn danger',
            onclick: () => {
              if (!books.length) return;
              if (confirm(`Delete all ${plural(books.length, 'book')}? This can’t be undone. Export first if you might want them back.`)) {
                store.clearAll();
                toast('All data deleted');
              }
            },
          }, icon('trash'), 'Delete everything'),
        ),
      ),
    );
  };
  render();
  return store.subscribe(render);
}
