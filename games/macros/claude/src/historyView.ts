import type { Macros, Targets } from './types';
import { carbTarget, entryMacros, sum } from './nutrition';
import * as store from './store';
import { fmt, h } from './ui';
import { prettyDate } from './today';

interface Day {
  date: string;
  m: Macros;
  n: number;
}

const SVG = 'http://www.w3.org/2000/svg';
function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** One measure per chart, with its target as a dashed line. Tap or hover a bar for the value. */
function chart(title: string, cls: string, days: Day[], value: (d: Day) => number, target: number, unit: string, rule: 'min' | 'max' | 'target'): HTMLElement {
  const W = 340;
  const H = 120;
  const pad = { l: 34, r: 6, t: 8, b: 18 };
  const vals = days.map(value);
  const max = Math.max(target * 1.15, ...vals) || 1;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const slot = iw / days.length;
  const bw = Math.max(2, Math.min(22, slot - 2));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: `chart ${cls}`, role: 'img', 'aria-label': `${title} per day` });
  // recessive grid: zero and target only
  svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y(0), y2: y(0), class: 'axis' }));
  const tip = h('div', { class: 'tip', hidden: true });
  days.forEach((d, i) => {
    const v = vals[i];
    const x = pad.l + i * slot + (slot - bw) / 2;
    const top = y(v);
    const bad = d.n > 0 && (rule === 'max' ? v > target : rule === 'min' ? v < target : false);
    const g = s('g', { class: `col${bad ? ' miss' : ''}${d.n ? '' : ' none'}`, tabindex: 0 });
    // the hit target is the whole column, wider and taller than the bar
    g.append(s('rect', { x: pad.l + i * slot, y: pad.t, width: slot, height: ih, class: 'hit' }));
    if (v > 0) {
      const r = Math.min(4, bw / 2, (y(0) - top) / 2);
      const hgt = y(0) - top;
      // rounded top, square base
      g.append(s('path', { class: 'bar-mark', d: `M${x},${y(0)} v${-(hgt - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${hgt - r} z` }));
    }
    const show = () => {
      tip.hidden = false;
      tip.textContent = `${prettyDate(d.date)}: ${d.n ? `${fmt(Math.round(v))}${unit}` : 'nothing logged'}`;
      const px = ((x + bw / 2) / W) * 100;
      tip.style.left = `${Math.min(80, Math.max(10, px))}%`;
    };
    g.addEventListener('mouseenter', show);
    g.addEventListener('focus', show);
    g.addEventListener('click', show);
    g.addEventListener('mouseleave', () => (tip.hidden = true));
    svg.append(g);
  });
  svg.append(s('line', { x1: pad.l, x2: W - pad.r, y1: y(target), y2: y(target), class: 'target' }));
  const tl = s('text', { x: pad.l - 4, y: y(target) + 3, class: 'tick', 'text-anchor': 'end' });
  tl.textContent = fmt(target);
  svg.append(tl);
  const zero = s('text', { x: pad.l - 4, y: y(0) + 3, class: 'tick', 'text-anchor': 'end' });
  zero.textContent = '0';
  svg.append(zero);
  if (days.length) {
    for (const [i, anchor] of [[0, 'start'], [days.length - 1, 'end']] as const) {
      const t = s('text', { x: anchor === 'start' ? pad.l : W - pad.r, y: H - 4, class: 'tick', 'text-anchor': anchor });
      t.textContent = prettyDate(days[i].date);
      svg.append(t);
    }
  }
  const ruleText = rule === 'min' ? `target ≥ ${fmt(target)}${unit}` : rule === 'max' ? `limit ≤ ${fmt(target)}${unit}` : `target ${fmt(target)}${unit}`;
  return h('figure', { class: 'card chart-card' }, h('figcaption', {}, h('b', {}, title), h('small', { class: 'muted' }, ` · dashed line: ${ruleText}`)), h('div', { class: 'chart-wrap' }, svg, tip));
}

function tiles(days: Day[], t: Targets): HTMLElement {
  const logged = days.filter((d) => d.n > 0);
  const n = logged.length || 1;
  const avg = sum(logged.map((d) => d.m));
  const a = (k: keyof Macros) => Math.round(avg[k] / n);
  const pMet = logged.filter((d) => d.m.protein >= t.protein).length;
  const fOk = logged.filter((d) => d.m.fat <= t.fat).length;
  const tile = (label: string, value: string, sub: string) => h('div', { class: 'tile' }, h('small', {}, label), h('b', {}, value), h('small', { class: 'muted' }, sub));
  return h(
    'section',
    { class: 'tiles' },
    tile('Avg calories', fmt(a('kcal')), `target ${fmt(t.kcal)}`),
    tile('Avg protein', `${a('protein')}g`, `${pMet} of ${logged.length} days ≥ ${t.protein}g`),
    tile('Avg fat', `${a('fat')}g`, `${fOk} of ${logged.length} days ≤ ${t.fat}g`),
    tile('Avg carbs', `${a('carbs')}g`, `target ~${carbTarget(t)}g`),
  );
}

export function openHistory(root: HTMLElement, range: number): () => void {
  const today = store.localDate();
  const t = store.targets();
  const days: Day[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const date = store.shiftDate(today, -i);
    const es = store.entriesFor(date);
    days.push({ date, m: sum(es.map(entryMacros)), n: es.length });
  }
  const logged = days.filter((d) => d.n > 0);
  root.replaceChildren(
    h('header', { class: 'top' }, h('h1', {}, 'History')),
    h('div', { class: 'seg', role: 'tablist' }, [7, 14, 30, 90].map((r) => h('a', { href: `#/history/${r}`, class: r === range ? 'on' : '', role: 'tab', 'aria-selected': String(r === range) }, `${r} days`))),
    logged.length ? tiles(days, t) : h('p', { class: 'empty' }, 'No days logged in this range yet.'),
    chart('Calories', 'k', days, (d) => d.m.kcal, t.kcal, '', 'target'),
    chart('Protein', 'p', days, (d) => d.m.protein, t.protein, 'g', 'min'),
    chart('Fat', 'f', days, (d) => d.m.fat, t.fat, 'g', 'max'),
    chart('Carbs', 'c', days, (d) => d.m.carbs, carbTarget(t), 'g', 'target'),
    h(
      'section',
      { class: 'card' },
      h(
        'table',
        { class: 'days' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Day'), h('th', {}, 'kcal'), h('th', {}, 'P'), h('th', {}, 'F'), h('th', {}, 'C'))),
        h(
          'tbody',
          {},
          [...logged].reverse().map((d) =>
            h(
              'tr',
              {},
              h('td', {}, h('a', { href: `#/day/${d.date}` }, prettyDate(d.date))),
              h('td', {}, fmt(Math.round(d.m.kcal))),
              h('td', { class: d.m.protein >= t.protein ? 'ok' : '' }, Math.round(d.m.protein)),
              h('td', { class: d.m.fat > t.fat ? 'bad' : '' }, Math.round(d.m.fat)),
              h('td', {}, Math.round(d.m.carbs)),
            ),
          ),
        ),
      ),
    ),
  );
  return () => {};
}
