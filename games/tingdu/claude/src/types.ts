/** One word as the narrator said it, or one punctuation mark. */
export interface Token {
  /** Simplified characters */
  t: string;
  /** Traditional characters, when different */
  tt?: string;
  /** One pinyin syllable per character; absent for punctuation */
  py?: string[];
  /** Start / end of the word in the narration, in ms */
  s?: number;
  e?: number;
}

export type SentenceRole = 'title' | 'author' | 'body';

export interface Sentence {
  role: SentenceRole;
  /** Paragraph number for body sentences, -1 for the title and author lines */
  para: number;
  en: string;
  start: number | null;
  end: number | null;
  tokens: Token[];
}

export interface Story {
  id: string;
  title: string;
  titleTrad: string;
  en: string;
  level: number;
  kind: 'story' | 'poem' | 'custom';
  /** Narration file relative to the site root; absent for pasted text (read by the device voice) */
  audio?: string;
  duration?: number;
  voice?: string;
  authorEn?: string;
  dynasty?: string;
  note?: string;
  sentences: Sentence[];
}

export interface StorySummary {
  id: string;
  title: string;
  titleTrad: string;
  titlePy: string;
  en: string;
  level: number;
  kind: 'story' | 'poem';
  duration: number;
  chars: number;
  unique: number;
}
