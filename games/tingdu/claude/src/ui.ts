type Attrs = Record<string, string | boolean | number | ((e: Event) => void) | undefined>;
type Child = Node | string | null | undefined | false;

/** Tiny DOM builder: h('button', { class: 'x', onclick }, 'text', childNode). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (typeof v === 'function') e.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'hidden') e.hidden = Boolean(v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    e.append(c);
  }
  return e;
}

const PATHS: Record<string, string> = {
  back: '<path d="M15 5l-7 7 7 7" />',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" stroke="none" />',
  prev: '<path d="M6 5v14" /><path d="M18 6l-8.5 6 8.5 6z" fill="currentColor" />',
  next: '<path d="M18 5v14" /><path d="M6 6l8.5 6L6 18z" fill="currentColor" />',
  text: '<path d="M4 18L9 6l5 12M5.8 14h6.4" /><path d="M15 18l3-7.5 3 7.5M15.9 16h4.2" />',
  close: '<path d="M6 6l12 12M18 6L6 18" />',
  sound: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" /><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" />',
  all: '<path d="M4 7h16M4 12h16M4 17h10" />',
  line: '<path d="M4 12h11" /><path d="M19 7v10" />',
  repeat: '<path d="M17 4l3 3-3 3" /><path d="M4 11V9.5A2.5 2.5 0 016.5 7H20" /><path d="M7 20l-3-3 3-3" /><path d="M20 13v1.5a2.5 2.5 0 01-2.5 2.5H4" />',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />',
  book: '<path d="M4 5.5A1.5 1.5 0 015.5 4H11v15H5.5A1.5 1.5 0 014 17.5z" /><path d="M20 5.5A1.5 1.5 0 0018.5 4H13v15h5.5a1.5 1.5 0 001.5-1.5z" />',
};

export function icon(name: string): SVGSVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = `<svg class="ico" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
  return tpl.content.firstElementChild as SVGSVGElement;
}
