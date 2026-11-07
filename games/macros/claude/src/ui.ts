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
  prev: '<path d="M15 5l-7 7 7 7" />',
  next: '<path d="M9 5l7 7-7 7" />',
  close: '<path d="M6 6l12 12M18 6L6 18" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />',
  today: '<circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" />',
  chart: '<path d="M5 19V11M10 19V6M15 19v-9M20 19v-5" />',
  food: '<path d="M7 3v8a2 2 0 002 2v8M5 3v5M9 3v5M16 21V3c2.5 1.5 3.5 4 3.5 7s-1.5 4-3.5 4" />',
  data: '<path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 19h14" />',
  scan: '<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" /><path d="M8 9v6M11 9v6M14 9v6M17 9v6" />',
  search: '<circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" />',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15V6a1 1 0 011-1h9" />',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z" />',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z" />',
  cloud: '<path d="M7 18a4 4 0 01-.6-7.96A5.5 5.5 0 0117 8.5a3.75 3.75 0 01.5 7.47V16H7z" />',
  sparkle: '<path d="M12 4l1.8 4.6L18 10l-4.2 1.4L12 16l-1.8-4.6L6 10l4.2-1.4z" /><path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />',
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

export function g(n: number): string {
  return `${fmt(n < 10 ? Math.round(n * 10) / 10 : Math.round(n))}g`;
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
