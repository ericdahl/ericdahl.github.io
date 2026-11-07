import { isOpening, toneOf } from './pinyin';
import type { Story, Token } from './types';

export interface RenderedStory {
  root: HTMLElement;
  /** one element per spoken character, in reading order (matches Timeline.chars) */
  chars: HTMLElement[];
  /** one element per line */
  sentences: HTMLElement[];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function charEl(ch: string, trad: string, py: string | null): HTMLElement {
  const c = el('span', py ? 'c' : 'c p');
  const p = el('span', 'py', py ?? ' ');
  if (py) p.classList.add(`t${toneOf(py)}`);
  const hz = el('span', 'hz', ch);
  if (trad !== ch) {
    hz.dataset.s = ch;
    hz.dataset.t = trad;
  }
  c.append(p, hz);
  return c;
}

/**
 * Renders the text as words of characters with pinyin above each one. Punctuation is glued to
 * the neighbouring word so a line never starts with a comma or ends with an opening quote.
 */
export function renderStory(story: Story, traditional: boolean): RenderedStory {
  const root = el('article', `story kind-${story.kind}`);
  const chars: HTMLElement[] = [];
  const sentences: HTMLElement[] = [];

  let para: HTMLElement | null = null;
  let paraIndex = -2;

  story.sentences.forEach((sentence, si) => {
    let container: HTMLElement;
    if (sentence.role === 'title') {
      container = el('h1', 'sent title');
      root.append(container);
    } else if (sentence.role === 'author') {
      container = el('div', 'sent author');
      root.append(container);
    } else {
      if (sentence.para !== paraIndex || !para) {
        para = el('p', 'para');
        root.append(para);
        paraIndex = sentence.para;
      }
      container = el('span', 'sent');
      para.append(container);
    }
    container.dataset.s = String(si);
    sentences.push(container);

    const line = el('span', 'line');
    container.append(line);
    let pendingOpen: HTMLElement[] = [];
    let lastWord: HTMLElement | null = null;

    sentence.tokens.forEach((tok: Token, ti) => {
      const trad = tok.tt ?? tok.t;
      if (!tok.py) {
        // punctuation (or a space): attach to a word
        const marks = [...tok.t].map((ch, j) => charEl(ch, trad[j] ?? ch, null));
        if (isOpening(tok.t[0]) || !lastWord) pendingOpen.push(...marks);
        else lastWord.append(...marks);
        return;
      }
      const w = el('span', 'w');
      w.dataset.s = String(si);
      w.dataset.k = String(ti);
      if (pendingOpen.length) {
        w.append(...pendingOpen);
        pendingOpen = [];
      }
      [...tok.t].forEach((ch, j) => {
        const c = charEl(ch, trad[j] ?? ch, tok.py![j] ?? null);
        c.dataset.i = String(chars.length);
        chars.push(c);
        w.append(c);
      });
      line.append(w);
      lastWord = w;
    });
    if (pendingOpen.length) {
      const w = el('span', 'w');
      w.append(...pendingOpen);
      line.append(w);
    }

    if (sentence.en) container.append(el('span', 'en', sentence.en));
  });

  setScript(root, traditional);
  return { root, chars, sentences };
}

/** Switches every character in `root` between Simplified and Traditional. */
export function setScript(root: HTMLElement, traditional: boolean): void {
  root.querySelectorAll<HTMLElement>('.hz[data-t]').forEach((hz) => {
    hz.textContent = (traditional ? hz.dataset.t : hz.dataset.s) ?? hz.textContent;
  });
}

/** Characters (in the current script) and pinyin of one word, for the word card. */
export function wordInfo(story: Story, si: number, ti: number, traditional: boolean): { text: string; py: string[] } | null {
  const tok = story.sentences[si]?.tokens[ti];
  if (!tok?.py) return null;
  return { text: traditional ? (tok.tt ?? tok.t) : tok.t, py: tok.py };
}
