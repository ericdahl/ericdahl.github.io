import './style.css';
import { openData } from './dataView';
import { openFoods } from './foodsView';
import { openHistory } from './historyView';
import * as store from './store';
import { startAutoSync } from './sync';
import { openToday } from './today';
import { h, icon } from './ui';

const app = document.getElementById('app')!;
const view = h('main', { class: 'view' });
const tabs = [
  { id: 'today', href: '#/', label: 'Today', icon: 'today' },
  { id: 'history', href: '#/history/7', label: 'History', icon: 'chart' },
  { id: 'foods', href: '#/foods', label: 'Foods', icon: 'food' },
  { id: 'data', href: '#/data', label: 'Data', icon: 'data' },
];
const nav = h('nav', { class: 'tabs' }, tabs.map((t) => h('a', { href: t.href, 'data-tab': t.id }, icon(t.icon), h('span', {}, t.label))));
app.append(view, nav);

let cleanup = () => {};

function route(): void {
  cleanup();
  document.querySelectorAll('dialog.sheet').forEach((d) => d.remove());
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [page, arg] = path.split('/').map(decodeURIComponent);
  const params = new URLSearchParams(query);
  let tab = 'today';
  if (page === 'history') {
    tab = 'history';
    cleanup = openHistory(view, [7, 14, 30, 90].includes(Number(arg)) ? Number(arg) : 7);
  } else if (page === 'foods') {
    tab = 'foods';
    cleanup = openFoods(view, params.get('q') ?? '');
  } else if (page === 'data') {
    tab = 'data';
    cleanup = openData(view);
  } else {
    const date = page === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(arg ?? '') ? arg : store.localDate();
    cleanup = openToday(view, date);
  }
  for (const a of nav.querySelectorAll('a')) a.classList.toggle('on', a.dataset.tab === tab);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
startAutoSync();

// A new day while the app sits open on "Today": move to it.
let lastDay = store.localDate();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = store.localDate();
  if (now !== lastDay && !location.hash.startsWith('#/day/') && /^#?\/?$/.test(location.hash)) route();
  lastDay = now;
});
