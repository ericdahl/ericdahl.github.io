import './style.css';
import { openAdd } from './addView';
import { openBook } from './bookView';
import { openData } from './dataView';
import { defaultShelf, openShelf } from './shelfView';
import { openStats } from './statsView';
import type { Shelf } from './types';
import { SHELVES } from './types';
import { h, icon } from './ui';

const app = document.getElementById('app')!;
const view = h('main', { class: 'view' });
const tabs = [
  { id: 'shelf', href: '#/', label: 'Shelves', icon: 'shelf' },
  { id: 'add', href: '#/add', label: 'Add', icon: 'search' },
  { id: 'stats', href: '#/stats', label: 'Stats', icon: 'chart' },
  { id: 'data', href: '#/data', label: 'Data', icon: 'data' },
];
const nav = h('nav', { class: 'tabs' }, tabs.map((t) => h('a', { href: t.href, 'data-tab': t.id }, icon(t.icon), h('span', {}, t.label))));
app.append(view, nav);

let cleanup = () => {};
// Remember the scroll position of each shelf so coming back from a book lands where you were.
const scrolls = new Map<string, number>();
let current = '';

function route(): void {
  if (current) scrolls.set(current, window.scrollY);
  cleanup();
  document.querySelectorAll('dialog.sheet').forEach((d) => d.remove());
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [page, arg] = path.split('/').map(decodeURIComponent);
  const params = new URLSearchParams(query);
  let tab = 'shelf';
  let key = path;
  if (page === 'book' && arg) {
    cleanup = openBook(view, arg);
  } else if (page === 'add') {
    tab = 'add';
    cleanup = openAdd(view, params.get('q') ?? '');
  } else if (page === 'stats') {
    tab = 'stats';
    cleanup = openStats(view, Number(arg) || undefined);
  } else if (page === 'data') {
    tab = 'data';
    cleanup = openData(view);
  } else {
    const shelf = SHELVES.includes(arg as Shelf) ? (arg as Shelf) : defaultShelf();
    key = `shelf/${shelf}`;
    cleanup = openShelf(view, shelf);
  }
  for (const a of nav.querySelectorAll('a')) a.classList.toggle('on', a.dataset.tab === tab);
  window.scrollTo(0, page === 'book' ? 0 : (scrolls.get(key) ?? 0));
  current = key;
}

window.addEventListener('hashchange', route);
route();
