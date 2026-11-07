import { isHan, isSpoken } from './pinyin';
import { pickChineseVoice, voicesReady } from './player';
import { load, save } from './storage';
import type { Sentence, Story, Token } from './types';
import { h, icon } from './ui';

export interface SavedText {
  id: string;
  text: string;
  created: number;
}

const KEY = 'tingdu.texts';

export function savedTexts(): SavedText[] {
  return load<SavedText[]>(KEY, []);
}

function storeTexts(list: SavedText[]): void {
  save(KEY, list);
}

export function getText(id: string): SavedText | undefined {
  return savedTexts().find((t) => t.id === id);
}

const SAMPLE = `秋天到了，天气凉了。
一群大雁往南飞，一会儿排成个“人”字，一会儿排成个“一”字。
树叶黄了，一片片叶子从树上落下来。`;

/** Splits text into lines at sentence-ending punctuation (keeping closing quotes with their line). */
export function splitSentences(paragraph: string): string[] {
  const out = paragraph.match(/[^。！？!?；;…]+(?:[。！？!?；;…]+[”’」』）)]*|$)/g) ?? [];
  return out.map((s) => s.trim()).filter(Boolean);
}

/**
 * Turns pasted text into the reader's story format: lines split at full stops, words found with
 * the browser's own word segmenter, pinyin from pinyin-pro. There is no narration, so the
 * device voice reads it.
 */
export async function textToStory(saved: SavedText): Promise<Story> {
  const { pinyin } = await import('pinyin-pro');
  const segmenter = 'Segmenter' in Intl ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;

  const toTokens = (line: string): Token[] => {
    const py = pinyin(line, { type: 'all' }) as { origin: string; pinyin: string; isZh: boolean }[];
    // pinyin-pro returns one entry per character; line it up with UTF-16 offsets
    const byOffset = new Map<number, string>();
    let offset = 0;
    for (const item of py) {
      if (item.isZh) byOffset.set(offset, item.pinyin);
      offset += item.origin.length;
    }
    const pieces = segmenter ? [...segmenter.segment(line)].map((s) => ({ text: s.segment, at: s.index })) : [...line].map((ch, i) => ({ text: ch, at: i }));
    const tokens: Token[] = [];
    for (const { text, at } of pieces) {
      if ([...text].every((ch) => isSpoken(ch))) {
        // a word: Chinese characters get pinyin; letters and digits are shown plain
        const chars = [...text];
        let off = at;
        const syllables = chars.map((ch) => {
          const p = isHan(ch) ? (byOffset.get(off) ?? '') : '';
          off += ch.length;
          return p;
        });
        tokens.push({ t: text, py: syllables });
      } else {
        // punctuation and spaces, one token per run
        for (const ch of text) {
          if (isSpoken(ch)) tokens.push({ t: ch, py: [isHan(ch) ? (byOffset.get(at) ?? '') : ''] });
          else tokens.push({ t: ch });
        }
      }
    }
    return tokens;
  };

  const sentences: Sentence[] = [];
  const paragraphs = saved.text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  const firstLine = paragraphs[0] ? splitSentences(paragraphs[0])[0] ?? paragraphs[0] : '';
  const title = [...firstLine].slice(0, 14).join('') + ([...firstLine].length > 14 ? '…' : '');
  paragraphs.forEach((p, pi) => {
    for (const line of splitSentences(p)) {
      sentences.push({ role: 'body', para: pi, en: '', start: null, end: null, tokens: toTokens(line) });
    }
  });
  return {
    id: `mine-${saved.id}`,
    title,
    titleTrad: title,
    en: 'Your text',
    level: 0,
    kind: 'custom',
    sentences,
  };
}

function voiceWarning(): HTMLElement | null {
  if (!('speechSynthesis' in window)) {
    return h('div', { class: 'notice' }, 'This browser can’t speak text aloud. Pinyin will still be shown. Try Safari on iPhone or Chrome on Android.');
  }
  if (pickChineseVoice()) return null;
  return h(
    'div',
    { class: 'notice' },
    h('strong', {}, 'No Mandarin voice found on this device. '),
    'Pinyin will still be shown, but to hear the text, add a Chinese voice: ',
    h('br'),
    'iPhone/iPad: Settings → Accessibility → Spoken Content → Voices → Chinese (China mainland). ',
    'Android: Settings → Accessibility → Text-to-speech → Google → install Chinese (Mandarin). ',
    'Windows: Settings → Time & language → Speech → Add voices → Chinese (Simplified).',
  );
}

/** The "your own text" page: paste text, keep a list of what you pasted. */
export async function openMine(container: HTMLElement, back: () => void): Promise<() => void> {
  const area = h('textarea', {
    class: 'paste',
    rows: '7',
    placeholder: '在这里粘贴中文…\nPaste or type Chinese text here (simplified characters work best).',
    lang: 'zh',
  }) as HTMLTextAreaElement;
  const readBtn = h('button', { class: 'pill primary big' }, icon('book'), ' 朗读 Read it');
  const sampleBtn = h('button', { class: 'pill' }, '试一试 Try a sample');
  const list = h('div', { class: 'saved' });
  const warning = h('div', {});

  const drawList = () => {
    const items = savedTexts();
    list.replaceChildren(
      ...(items.length ? [h('h2', {}, h('span', { lang: 'zh' }, '我的文章'), h('small', {}, 'Saved on this device'))] : []),
      ...items.map((t) =>
        h(
          'div',
          { class: 'saved-item' },
          h('a', { href: `#/mine/${t.id}`, lang: 'zh' }, t.text.replace(/\s+/g, ' ').slice(0, 40)),
          h(
            'button',
            {
              class: 'icon-btn',
              'aria-label': 'Delete',
              onclick: () => {
                storeTexts(savedTexts().filter((x) => x.id !== t.id));
                drawList();
              },
            },
            icon('trash'),
          ),
        ),
      ),
    );
  };

  readBtn.addEventListener('click', () => {
    const text = area.value.trim();
    if (!text) {
      area.focus();
      return;
    }
    const items = savedTexts();
    let item = items.find((t) => t.text === text);
    if (!item) {
      item = { id: Date.now().toString(36), text, created: Date.now() };
      storeTexts([item, ...items].slice(0, 50));
    }
    location.hash = `#/mine/${item.id}`;
  });
  sampleBtn.addEventListener('click', () => {
    area.value = SAMPLE;
    area.focus();
  });

  container.replaceChildren(
    h(
      'div',
      { class: 'screen mine' },
      h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: back }, icon('back')), h('div', { class: 'top-title' }, h('span', { class: 'zh' }, '自己的文章'), h('span', { class: 'en' }, 'Your own text')), h('span', { class: 'icon-btn placeholder' })),
      h(
        'main',
        { class: 'mine-body' },
        h('p', { class: 'intro' }, 'Paste a story, a message from family, a news article — anything in Chinese. It gets pinyin over every character and is read aloud by your device’s own Mandarin voice, one line at a time.'),
        warning,
        area,
        h('div', { class: 'row' }, readBtn, sampleBtn),
        list,
      ),
    ),
  );
  drawList();
  await voicesReady();
  const w = voiceWarning();
  if (w) warning.replaceChildren(w);
  return () => {};
}
