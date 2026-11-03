import { AudioPlayer, SpeechPlayer, type Player, type PlayerState } from './player';
import { renderStory, setScript, type RenderedStory } from './render';
import { RATES, SIZES, getProgress, onChange, setProgress, settings, update, type PlayMode } from './settings';
import { buildTimeline, type Timeline } from './timeline';
import { toneOf } from './pinyin';
import type { Story } from './types';
import { h, icon } from './ui';

const MODES: { mode: PlayMode; label: string; zh: string; icon: string }[] = [
  { mode: 'continuous', label: 'Read all', zh: '连续', icon: 'all' },
  { mode: 'sentence', label: 'One line at a time', zh: '逐句', icon: 'line' },
  { mode: 'repeat', label: 'Repeat this line', zh: '重复', icon: 'repeat' },
];

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface ReaderOptions {
  story: Story;
  /** base URL the story's audio path is relative to */
  base: string;
  back: () => void;
  /** where the back button goes, for its label */
  backLabel?: string;
}

/** The reading screen: text with pinyin, highlighted as it is read, and the player controls. */
export function openReader(container: HTMLElement, opts: ReaderOptions): () => void {
  const { story } = opts;
  const timeline: Timeline = buildTimeline(story);
  const view: RenderedStory = renderStory(story, settings.script === 'traditional');
  const player: Player = story.audio ? new AudioPlayer(story, timeline, opts.base + story.audio) : new SpeechPlayer(story, timeline);
  player.setRate(settings.rate);
  player.setMode(settings.mode);

  // ------------------------------------------------------------ layout
  const backBtn = h('button', { class: 'icon-btn', 'aria-label': opts.backLabel ?? 'Back', onclick: opts.back }, icon('back'));
  const settingsBtn = h('button', { class: 'icon-btn', 'aria-label': 'Display settings', onclick: () => toggleSheet() }, icon('text'));
  const topTitle = h('div', { class: 'top-title' }, h('span', { class: 'zh' }, settings.script === 'traditional' ? story.titleTrad : story.title), h('span', { class: 'en' }, story.en));
  const topbar = h('header', { class: 'topbar' }, backBtn, topTitle, settingsBtn);

  const meta: HTMLElement[] = [];
  if (story.kind === 'poem' && story.dynasty) meta.push(h('div', { class: 'story-meta' }, `${story.dynasty}代 · ${story.authorEn ?? ''}`));
  if (story.note) meta.push(h('div', { class: 'story-meta' }, story.note));
  const titleEl = view.sentences[0];
  const headEnd = story.sentences[1]?.role === 'author' ? view.sentences[1] : titleEl;
  if (story.kind !== 'custom') headEnd.after(...meta);

  const body = h('main', { class: 'reader-body' }, view.root, h('div', { class: 'end-space' }));

  const slider = h('input', { type: 'range', class: 'seek', min: '0', max: String(player.state.duration || 1), step: '10', value: '0', 'aria-label': 'Position' }) as HTMLInputElement;
  const timeNow = h('span', { class: 'time' }, '0:00');
  const timeTotal = h('span', { class: 'time' }, player.seekable ? fmt(player.state.duration) : '');
  const progressRow = h('div', { class: 'progress-row' }, timeNow, slider, timeTotal);
  if (!player.seekable) slider.disabled = true;

  const modeBtn = h('button', { class: 'ctl small', 'aria-label': 'Reading mode' });
  const prevBtn = h('button', { class: 'ctl', 'aria-label': 'Previous line', onclick: () => step(-1) }, icon('prev'));
  const playBtn = h('button', { class: 'ctl play', 'aria-label': 'Play' }, icon('play'));
  const nextBtn = h('button', { class: 'ctl', 'aria-label': 'Next line', onclick: () => step(1) }, icon('next'));
  const rateBtn = h('button', { class: 'ctl small rate', 'aria-label': 'Speed' });
  const controls = h('div', { class: 'controls' }, modeBtn, prevBtn, playBtn, nextBtn, rateBtn);
  const footer = h('footer', { class: 'player' }, progressRow, controls);

  const card = h('div', { class: 'wordcard', hidden: true });
  const sheet = buildSettingsSheet(() => toggleSheet(false));
  const screen = h('div', { class: 'screen reader' }, topbar, body, card, footer, sheet);
  container.replaceChildren(screen);

  // ------------------------------------------------------------ highlighting
  let curChar = -1;
  let curSentence = -1;
  let lastUserScroll = 0;

  function highlight(state: PlayerState): void {
    if (state.sentence !== curSentence) {
      view.sentences[curSentence]?.classList.remove('cur');
      curSentence = state.sentence;
      const s = view.sentences[curSentence];
      s?.classList.add('cur');
      if (s) follow(s.querySelector('.c') as HTMLElement | null);
    }
    if (state.char !== curChar) {
      const old = view.chars[curChar];
      old?.classList.remove('cur');
      old?.parentElement?.classList.remove('cur');
      curChar = state.char;
      const c = view.chars[curChar];
      if (c) {
        c.classList.add('cur');
        c.parentElement?.classList.add('cur');
        follow(c);
      }
    }
  }

  /** Keep the character being read in view, unless the reader has just scrolled by hand. */
  function follow(target: HTMLElement | null): void {
    if (!target || !settings.autoScroll || !player.state.playing) return;
    if (performance.now() - lastUserScroll < 4000) return;
    const r = target.getBoundingClientRect();
    const top = topbar.getBoundingClientRect().bottom + 16;
    const bottom = footer.getBoundingClientRect().top - 24;
    if (r.top < top || r.bottom > bottom) {
      const y = body.scrollTop + r.top - top - (bottom - top) * 0.3;
      body.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }
  const markScroll = () => (lastUserScroll = performance.now());
  body.addEventListener('wheel', markScroll, { passive: true });
  body.addEventListener('touchmove', markScroll, { passive: true });

  // ------------------------------------------------------------ player state -> UI
  let dragging = false;
  let lastSaved = 0;
  player.onChange = (state) => {
    highlight(state);
    playBtn.replaceChildren(icon(state.playing ? 'pause' : 'play'));
    playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    playBtn.classList.toggle('on', state.playing);
    if (player.seekable) {
      if (!dragging) slider.value = String(state.time);
      slider.max = String(state.duration || 1);
      timeNow.textContent = fmt(state.time);
      timeTotal.textContent = fmt(state.duration);
      slider.style.setProperty('--pct', `${(100 * state.time) / (state.duration || 1)}%`);
    } else {
      const n = story.sentences.length;
      timeNow.textContent = `${Math.min(state.sentence + 1, n)} / ${n}`;
      slider.max = String(Math.max(1, n - 1));
      slider.value = String(state.sentence);
      slider.style.setProperty('--pct', `${(100 * state.sentence) / Math.max(1, n - 1)}%`);
    }
    if (performance.now() - lastSaved > 1500 && story.kind !== 'custom') {
      lastSaved = performance.now();
      setProgress(story.id, { position: player.seekable ? state.time : state.sentence });
    }
  };
  player.onEnded = () => {
    if (story.kind !== 'custom') setProgress(story.id, { done: true, position: 0 });
    curChar = -1;
  };

  slider.addEventListener('input', () => {
    dragging = true;
    timeNow.textContent = fmt(Number(slider.value));
  });
  slider.addEventListener('change', () => {
    dragging = false;
    player.seek(Number(slider.value));
  });

  playBtn.addEventListener('click', () => {
    hideCard();
    if (player.state.playing) player.pause();
    else {
      lastUserScroll = 0;
      player.play();
    }
  });

  function step(delta: number): void {
    hideCard();
    lastUserScroll = 0;
    const target = Math.max(0, Math.min(story.sentences.length - 1, player.state.sentence + delta));
    player.gotoSentence(target);
    view.sentences[target]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function renderMode(): void {
    const m = MODES.find((x) => x.mode === settings.mode) ?? MODES[0];
    modeBtn.replaceChildren(icon(m.icon), h('span', { class: 'lbl' }, m.zh));
    modeBtn.setAttribute('aria-label', `Reading mode: ${m.label}`);
    modeBtn.title = m.label;
  }
  modeBtn.addEventListener('click', () => {
    const i = MODES.findIndex((x) => x.mode === settings.mode);
    const next = MODES[(i + 1) % MODES.length];
    update({ mode: next.mode });
    player.setMode(next.mode);
    renderMode();
    toast(`${next.zh} · ${next.label}`);
  });
  renderMode();

  function renderRate(): void {
    rateBtn.textContent = `${settings.rate}×`;
  }
  rateBtn.addEventListener('click', () => {
    const i = RATES.indexOf(settings.rate);
    const next = RATES[(i + 1) % RATES.length] ?? 1;
    update({ rate: next });
    player.setRate(next);
    renderRate();
    toast(`Speed ${next}×`);
  });
  renderRate();

  // ------------------------------------------------------------ tapping words
  let cardFor: { s: number; k: number } | null = null;

  view.root.addEventListener('click', (e) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>('.w');
    if (!w || w.dataset.s == null) return;
    const s = Number(w.dataset.s);
    const k = Number(w.dataset.k);
    if (player.state.playing && !cardFor) {
      player.playFrom(s, k);
      return;
    }
    showCard(s, k, w);
    player.playWord(s, k);
  });

  function showCard(s: number, k: number, anchor: HTMLElement): void {
    const tok = story.sentences[s].tokens[k];
    if (!tok.py) return;
    cardFor = { s, k };
    view.root.querySelectorAll('.w.picked').forEach((x) => x.classList.remove('picked'));
    anchor.classList.add('picked');
    const trad = tok.tt ?? tok.t;
    const shown = settings.script === 'traditional' ? trad : tok.t;
    const other = settings.script === 'traditional' ? tok.t : trad;
    const chars = [...shown].map((ch, j) =>
      h('span', { class: 'card-c' }, h('span', { class: `py t${toneOf(tok.py![j] ?? '')}` }, tok.py![j] ?? ''), h('span', { class: 'hz' }, ch)),
    );
    card.replaceChildren(
      h('div', { class: 'card-word' }, ...chars),
      other !== shown ? h('div', { class: 'card-alt' }, `${settings.script === 'traditional' ? '简体' : '繁體'} ${other}`) : '',
      h(
        'div',
        { class: 'card-actions' },
        h('button', { class: 'pill', onclick: () => player.playWord(s, k) }, icon('sound'), ' 再听 Again'),
        h('button', { class: 'pill primary', onclick: () => { hideCard(); lastUserScroll = 0; player.playFrom(s, k); } }, icon('play'), ' 从这里读 Read from here'),
        h('button', { class: 'icon-btn close', 'aria-label': 'Close', onclick: hideCard }, icon('close')),
      ),
    );
    card.hidden = false;
  }

  function hideCard(): void {
    card.hidden = true;
    cardFor = null;
    view.root.querySelectorAll('.w.picked').forEach((x) => x.classList.remove('picked'));
  }
  body.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.w')) hideCard();
  });

  // ------------------------------------------------------------ settings sheet
  function toggleSheet(force?: boolean): void {
    const open = force ?? Boolean(sheet.hidden);
    sheet.hidden = !open;
    settingsBtn.classList.toggle('on', open);
  }

  const offSettings = onChange((s) => {
    setScript(view.root, s.script === 'traditional');
    (topTitle.firstChild as HTMLElement).textContent = s.script === 'traditional' ? story.titleTrad : story.title;
  });

  // ------------------------------------------------------------ keyboard
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      playBtn.click();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'Escape') {
      if (!card.hidden) hideCard();
      else if (!sheet.hidden) toggleSheet(false);
      else opts.back();
    }
  };
  document.addEventListener('keydown', onKey);

  // ------------------------------------------------------------ resume where we left off
  const saved = story.kind !== 'custom' ? getProgress(story.id) : undefined;
  if (story.kind !== 'custom') setProgress(story.id, { opened: Date.now() });
  if (saved && saved.position > 1500 && player.seekable) player.seek(saved.position);
  else player.onChange(player.state);
  view.sentences[player.state.sentence]?.classList.add('cur');
  curSentence = player.state.sentence;
  if (player.state.sentence > 0) requestAnimationFrame(() => view.sentences[player.state.sentence]?.scrollIntoView({ block: 'center' }));

  return () => {
    if (story.kind !== 'custom' && !getProgress(story.id)?.done) {
      setProgress(story.id, { position: player.seekable ? player.state.time : player.state.sentence });
    }
    player.destroy();
    offSettings();
    document.removeEventListener('keydown', onKey);
  };
}

// ====================================================================== settings sheet

function segmented<T extends string | number | boolean>(
  label: string,
  options: { value: T; text: string }[],
  get: () => T,
  set: (v: T) => void,
): HTMLElement {
  const buttons = options.map((o) => {
    const b = h('button', { class: 'seg', type: 'button' }, o.text);
    b.addEventListener('click', () => {
      set(o.value);
      refresh();
    });
    return b;
  });
  const refresh = () => buttons.forEach((b, i) => b.classList.toggle('on', options[i].value === get()));
  refresh();
  return h('div', { class: 'setting' }, h('div', { class: 'setting-label' }, label), h('div', { class: 'segs' }, ...buttons));
}

export function buildSettingsSheet(close: () => void): HTMLElement {
  const sheet = h(
    'div',
    { class: 'sheet', hidden: true },
    h('div', { class: 'sheet-head' }, h('strong', {}, '显示 Display'), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('close'))),
    segmented('拼音 Pinyin', [{ value: 'show', text: '显示 Show' }, { value: 'hide', text: '隐藏 Hide' }], () => settings.pinyin, (v) => update({ pinyin: v })),
    segmented('声调颜色 Tone colors', [{ value: true, text: '开 On' }, { value: false, text: '关 Off' }], () => settings.toneColors, (v) => update({ toneColors: v })),
    segmented('字体 Characters', [{ value: 'simplified', text: '简体' }, { value: 'traditional', text: '繁體' }], () => settings.script, (v) => update({ script: v })),
    segmented('英文 English', [{ value: true, text: '显示 Show' }, { value: false, text: '隐藏 Hide' }], () => settings.english, (v) => update({ english: v })),
    segmented('大小 Size', SIZES.map((_, i) => ({ value: i, text: ['小', '中', '大', '特大', '超大'][i] })), () => settings.size, (v) => update({ size: v })),
    segmented('字型 Font', [{ value: 'sans', text: '黑体' }, { value: 'kai', text: '楷体' }, { value: 'song', text: '宋体' }], () => settings.font, (v) => update({ font: v })),
    segmented('自动滚动 Follow along', [{ value: true, text: '开 On' }, { value: false, text: '关 Off' }], () => settings.autoScroll, (v) => update({ autoScroll: v })),
    h('p', { class: 'hint' }, 'Tap any word to hear it on its own. Tap it while reading to jump there.'),
  );
  return sheet;
}

let toastTimer = 0;
export function toast(text: string): void {
  let t = document.querySelector<HTMLElement>('.toast');
  if (!t) {
    t = h('div', { class: 'toast', role: 'status' });
    document.body.append(t);
  }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 1400);
}
