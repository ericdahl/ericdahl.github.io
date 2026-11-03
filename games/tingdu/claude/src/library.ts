import { loadIndex } from './data';
import { getProgress, settings, update } from './settings';
import { toneOf } from './pinyin';
import type { StorySummary } from './types';
import { h, icon } from './ui';

const LEVELS: Record<number, { zh: string; en: string }> = {
  1: { zh: '第一级 · 入门', en: 'Level 1 · First steps' },
  2: { zh: '第二级 · 初级', en: 'Level 2 · Getting going' },
  3: { zh: '第三级 · 进阶', en: 'Level 3 · Longer stories' },
};

function minutes(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} sec` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`;
}

/** The title with pinyin over each character, like the reader. */
function rubyTitle(s: StorySummary): HTMLElement {
  const text = settings.script === 'traditional' ? s.titleTrad : s.title;
  const py = s.titlePy.split(' ');
  return h(
    'div',
    { class: text.length >= 7 ? 'card-title long' : 'card-title', lang: 'zh' },
    ...[...text].map((ch, i) => h('span', { class: 'c' }, h('span', { class: `py t${toneOf(py[i] ?? '')}` }, py[i] ?? ''), h('span', { class: 'hz' }, ch))),
  );
}

function storyCard(s: StorySummary): HTMLElement {
  const p = getProgress(s.id);
  const status = p?.done
    ? h('span', { class: 'badge done' }, icon('check'), ' 读完了 Read')
    : p && p.position > 1500
      ? h('span', { class: 'badge started' }, '读到一半 In progress')
      : null;
  return h(
    'a',
    { class: `card kind-${s.kind}`, href: `#/read/${s.id}` },
    rubyTitle(s),
    h('div', { class: 'card-en' }, s.en),
    h('div', { class: 'card-foot' }, h('span', {}, `${minutes(s.duration)} · ${s.chars} 字`), status),
  );
}

export async function openLibrary(container: HTMLElement): Promise<() => void> {
  const scriptBtn = h('button', { class: 'pill script-toggle', 'aria-label': 'Switch between Simplified and Traditional characters' });
  const renderScriptBtn = () => {
    scriptBtn.textContent = settings.script === 'traditional' ? '繁體 → 简体' : '简体 → 繁體';
  };
  renderScriptBtn();

  const grid = h('div', { class: 'library-sections' }, h('p', { class: 'loading' }, '加载中… Loading'));
  const screen = h(
    'div',
    { class: 'screen library' },
    h(
      'header',
      { class: 'hero' },
      h(
        'div',
        { class: 'brand' },
        h('div', { class: 'logo', lang: 'zh' }, h('span', { class: 'c' }, h('span', { class: 'py t1' }, 'tīng'), h('span', { class: 'hz' }, '听')), h('span', { class: 'c' }, h('span', { class: 'py t2' }, 'dú'), h('span', { class: 'hz' }, '读'))),
        h('div', { class: 'tagline' }, h('div', {}, '跟着听，跟着读'), h('div', { class: 'en' }, 'Listen and read along in Chinese')),
      ),
      scriptBtn,
    ),
    grid,
  );
  container.replaceChildren(screen);

  const draw = (stories: StorySummary[]) => {
    const sections: HTMLElement[] = [];
    // "continue" shortcut to the story opened most recently and not finished
    const recent = stories
      .map((s) => ({ s, p: getProgress(s.id) }))
      .filter((x) => x.p && !x.p.done && x.p.position > 1500)
      .sort((a, b) => b.p!.opened - a.p!.opened)[0];
    if (recent) {
      sections.push(
        h(
          'a',
          { class: 'continue', href: `#/read/${recent.s.id}` },
          icon('play'),
          h('span', {}, '继续读 Continue: ', h('strong', { lang: 'zh' }, settings.script === 'traditional' ? recent.s.titleTrad : recent.s.title), ` · ${recent.s.en}`),
        ),
      );
    }
    for (const level of [1, 2, 3]) {
      const list = stories.filter((s) => s.kind === 'story' && s.level === level);
      if (!list.length) continue;
      sections.push(
        h('section', {}, h('h2', {}, h('span', { lang: 'zh' }, LEVELS[level].zh), h('small', {}, LEVELS[level].en)), h('div', { class: 'cards' }, ...list.map(storyCard))),
      );
    }
    const poems = stories.filter((s) => s.kind === 'poem');
    if (poems.length) {
      sections.push(h('section', {}, h('h2', {}, h('span', { lang: 'zh' }, '古诗'), h('small', {}, 'Classic Tang poems, learned by every child in China')), h('div', { class: 'cards' }, ...poems.map(storyCard))));
    }
    sections.push(
      h(
        'section',
        {},
        h('h2', {}, h('span', { lang: 'zh' }, '自己的文章'), h('small', {}, 'Your own text')),
        h('a', { class: 'card mine', href: '#/mine' }, h('div', { class: 'mine-icon' }, icon('plus')), h('div', {}, h('div', { class: 'card-en' }, 'Paste any Chinese text'), h('div', { class: 'card-foot' }, 'Read aloud by your device’s voice, with pinyin'))),
      ),
    );
    sections.push(
      h(
        'footer',
        { class: 'about' },
        h('p', {}, 'Stories are written for this app; poems are public domain. Narration is a Microsoft neural voice, generated ahead of time.'),
      ),
    );
    grid.replaceChildren(...sections);
  };

  let stories: StorySummary[] = [];
  scriptBtn.addEventListener('click', () => {
    update({ script: settings.script === 'traditional' ? 'simplified' : 'traditional' });
    renderScriptBtn();
    draw(stories);
  });

  try {
    stories = await loadIndex();
    draw(stories);
  } catch (err) {
    grid.replaceChildren(h('p', { class: 'error' }, `Couldn’t load the stories (${String(err)}). Check your connection and reload.`));
  }
  return () => {};
}
