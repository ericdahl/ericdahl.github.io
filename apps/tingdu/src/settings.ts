import { load, save } from './storage';

export type PinyinMode = 'show' | 'hide';
export type Script = 'simplified' | 'traditional';
export type FontStyle = 'sans' | 'kai' | 'song';
export type PlayMode = 'continuous' | 'sentence' | 'repeat';

export interface Settings {
  pinyin: PinyinMode;
  toneColors: boolean;
  script: Script;
  english: boolean;
  /** text size step, 0 (smallest) to 4 */
  size: number;
  font: FontStyle;
  rate: number;
  mode: PlayMode;
  autoScroll: boolean;
}

const DEFAULTS: Settings = {
  pinyin: 'show',
  toneColors: true,
  script: 'simplified',
  english: false,
  size: typeof window !== 'undefined' && window.innerWidth >= 900 ? 3 : 2,
  font: 'sans',
  rate: 1,
  mode: 'continuous',
  autoScroll: true,
};

export const RATES = [0.6, 0.75, 0.9, 1, 1.2];
export const SIZES = [22, 26, 32, 40, 48];

const KEY = 'tingdu.settings';
const listeners = new Set<(s: Settings) => void>();

export const settings: Settings = { ...DEFAULTS, ...load<Partial<Settings>>(KEY, {}) };

export function update(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  save(KEY, settings);
  applyToDocument();
  listeners.forEach((fn) => fn(settings));
}

export function onChange(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Display preferences are CSS classes and variables on <html>, so re-rendering is never needed. */
export function applyToDocument(): void {
  const root = document.documentElement;
  root.classList.toggle('no-pinyin', settings.pinyin === 'hide');
  root.classList.toggle('tone-colors', settings.toneColors);
  root.classList.toggle('trad', settings.script === 'traditional');
  root.classList.toggle('show-english', settings.english);
  root.dataset.font = settings.font;
  root.style.setProperty('--hz-size', `${SIZES[settings.size] ?? SIZES[2]}px`);
}

// ---------------------------------------------------------------- reading progress

interface Progress {
  /** ms into the narration (or line number for pasted text) where the reader left off */
  position: number;
  done: boolean;
  /** when it was last opened, for "continue reading" */
  opened: number;
}

const PROGRESS_KEY = 'tingdu.progress';
const progress: Record<string, Progress> = load(PROGRESS_KEY, {});

export function getProgress(id: string): Progress | undefined {
  return progress[id];
}

export function setProgress(id: string, patch: Partial<Progress>): void {
  const prev: Partial<Progress> = progress[id] ?? {};
  progress[id] = { position: 0, done: false, opened: Date.now(), ...prev, ...patch };
  save(PROGRESS_KEY, progress);
}
