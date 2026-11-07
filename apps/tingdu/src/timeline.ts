import type { Story } from './types';

/** One spoken character, with the slice of the narration it occupies. */
export interface TimedChar {
  sentence: number;
  token: number;
  /** index of the character within its token */
  index: number;
  start: number;
  end: number;
}

export interface SentenceSpan {
  /** first and last index into Timeline.chars (last < first when the line has no spoken characters) */
  first: number;
  last: number;
  /** where to start and stop playing the line, in ms */
  start: number;
  end: number;
}

export interface Timeline {
  chars: TimedChar[];
  sentences: SentenceSpan[];
}

/** A little silence kept around a line when it is played on its own. */
const LEAD_IN = 120;
const TAIL = 350;

/**
 * Flattens a narrated story into per-character timings. The narration reports words; a word's
 * duration is shared equally among its characters, which is close enough for highlighting.
 */
export function buildTimeline(story: Story): Timeline {
  const chars: TimedChar[] = [];
  const sentences: SentenceSpan[] = [];
  story.sentences.forEach((sentence, si) => {
    const first = chars.length;
    sentence.tokens.forEach((tok, ti) => {
      if (!tok.py) return;
      const n = tok.t.length;
      const s = tok.s ?? 0;
      const e = tok.e ?? s;
      for (let j = 0; j < n; j++) {
        chars.push({ sentence: si, token: ti, index: j, start: s + ((e - s) * j) / n, end: s + ((e - s) * (j + 1)) / n });
      }
    });
    sentences.push({ first, last: chars.length - 1, start: sentence.start ?? 0, end: sentence.end ?? 0 });
  });
  // Pad each line's play window into the silence around it, without overlapping its neighbours.
  for (let i = 0; i < sentences.length; i++) {
    const cur = sentences[i];
    const prevEnd = i > 0 ? sentences[i - 1].end : 0;
    const nextStart = i + 1 < sentences.length ? sentences[i + 1].start : Infinity;
    const start = Math.max(prevEnd, cur.start - LEAD_IN, 0);
    const end = Math.min(cur.end + TAIL, Math.max(cur.end, nextStart - 30));
    cur.start = start;
    cur.end = end;
  }
  return { chars, sentences };
}

/** Index of the character being spoken at `ms`, or -1 between words (in a pause longer than `grace`). */
export function charAt(timeline: Timeline, ms: number, grace = 250): number {
  const { chars } = timeline;
  let lo = 0;
  let hi = chars.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (chars[mid].start <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return -1;
  return ms <= chars[found].end + grace ? found : -1;
}

/** The line being read at `ms`: the last line that has started. */
export function sentenceAt(timeline: Timeline, ms: number): number {
  const { sentences } = timeline;
  let found = 0;
  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].start <= ms) found = i;
    else break;
  }
  return found;
}
