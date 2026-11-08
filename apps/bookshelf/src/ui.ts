type Attrs = Record<string, string | boolean | number | ((e: Event) => void) | undefined | null>;
type Child = Node | string | number | null | undefined | false;

/** Tiny DOM builder: h('button', { class: 'x', onclick }, 'text', childNode). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (typeof v === 'function') e.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'hidden') e.hidden = Boolean(v);
    else if (k === 'value' && 'value' in e) (e as HTMLInputElement).value = String(v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(typeof c === 'number' ? String(c) : c);
  }
  return e;
}

const PATHS: Record<string, string> = {
  back: '<path d="M15 5l-7 7 7 7" />',
  close: '<path d="M6 6l12 12M18 6L6 18" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />',
  shelf: '<path d="M5 4v14M9 4v14M14 5l3.5 13M3 20h18" />',
  chart: '<path d="M5 19V11M10 19V6M15 19v-9M20 19v-5" />',
  data: '<path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 19h14" />',
  scan: '<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" /><path d="M8 9v6M11 9v6M14 9v6M17 9v6" />',
  search: '<circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" />',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15V6a1 1 0 011-1h9" />',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z" />',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" />',
  check: '<path d="M5 12l5 5 9-10" />',
};

export function icon(name: string): SVGSVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
  return tpl.content.firstElementChild as SVGSVGElement;
}

/** A bottom sheet (dialog). Returns a close function. */
export function sheet(title: string, body: (close: () => void) => Node | Node[], opts: { onClose?: () => void; wide?: boolean } = {}): () => void {
  const dlg = h('dialog', { class: `sheet${opts.wide ? ' wide' : ''}`, 'aria-label': title });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dlg.close();
    dlg.remove();
    opts.onClose?.();
  };
  const head = h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('close')));
  const content = body(close);
  dlg.append(head, h('div', { class: 'sheet-body' }, ...(Array.isArray(content) ? content : [content])));
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  document.body.append(dlg);
  dlg.showModal();
  return close;
}

let toastTimer = 0;
/** Short message at the bottom; with an action button such as "Undo". */
export function toast(msg: string, action?: { label: string; run: () => void }): void {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = h(
    'div',
    { class: 'toast', role: 'status' },
    h('span', {}, msg),
    action &&
      h('button', {
        onclick: () => {
          action.run();
          t.remove();
        },
      }, action.label),
  );
  document.body.append(t);
  toastTimer = window.setTimeout(() => t.remove(), action ? 6000 : 2500);
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function numberInput(attrs: Attrs = {}): HTMLInputElement {
  return h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', ...attrs });
}

export function readNum(el: HTMLInputElement): number | null {
  const v = el.value.trim().replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function download(name: string, text: string, type = 'application/x-ndjson'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />';

/** Read-only stars, e.g. ★★★★☆ for 4. Fractions fill part of a star. */
export function stars(value: number, label?: string): HTMLElement {
  const wrap = h('span', { class: 'stars', role: 'img', 'aria-label': label ?? `${fmt(value, 1)} out of 5 stars` });
  for (let i = 1; i <= 5; i++) {
    const fill = Math.max(0, Math.min(1, value - (i - 1)));
    const s = h('span', { class: 'star', style: `--fill:${Math.round(fill * 100)}%` });
    s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg><svg class="on" viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`;
    wrap.append(s);
  }
  return wrap;
}

/** Five tappable stars. Tapping the current rating again clears it. */
export function starInput(value: number | undefined, onChange: (v: number | undefined) => void): HTMLElement {
  let current = value;
  const wrap = h('div', { class: 'star-input', role: 'radiogroup', 'aria-label': 'Your rating' });
  const btns: HTMLButtonElement[] = [];
  const paint = () => btns.forEach((b, i) => {
    b.classList.toggle('on', current != null && i < current);
    b.setAttribute('aria-checked', String(current === i + 1));
  });
  for (let i = 1; i <= 5; i++) {
    const b = h('button', {
      type: 'button',
      role: 'radio',
      'aria-label': `${i} star${i > 1 ? 's' : ''}`,
      onclick: () => {
        current = current === i ? undefined : i;
        paint();
        onChange(current);
      },
    });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${STAR}</svg>`;
    btns.push(b);
    wrap.append(b);
  }
  paint();
  return wrap;
}

/** A book cover, or a plain colored stand-in with the title when there's no image. */
export function coverEl(b: { title: string; authors?: string[] }, url: string | undefined, cls = ''): HTMLElement {
  const hue = [...b.title].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const fallback = () =>
    h('div', { class: `cover none ${cls}`, style: `--hue:${hue}`, 'aria-hidden': 'true' }, h('span', {}, b.title), b.authors?.[0] ? h('small', {}, b.authors[0]) : null);
  if (!url) return fallback();
  const img = h('img', { class: `cover ${cls}`, src: url, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.replaceWith(fallback()));
  // Open Library serves a 1×1 image for some covers it doesn't have.
  img.addEventListener('load', () => {
    if (img.naturalWidth < 5) img.replaceWith(fallback());
  });
  return img;
}

/** "Mar 2026", "12 Mar 2026". */
export function fmtDate(date: string | undefined, withDay = true): string {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d || 1).toLocaleDateString(undefined, withDay ? { day: 'numeric', month: 'short', year: 'numeric' } : { month: 'short', year: 'numeric' });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmt(n)} ${n === 1 ? one : many}`;
}
