import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toneOf } from '../src/pinyin';
import type { Story, StorySummary } from '../src/types';

const dir = join(import.meta.dirname, '..', 'public');
const index = JSON.parse(readFileSync(join(dir, 'stories', 'index.json'), 'utf8')).stories as StorySummary[];
const SYLLABLE = /^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/;

describe('built content', () => {
  it('lists every story file', () => {
    const files = readdirSync(join(dir, 'stories')).filter((f) => f !== 'index.json');
    expect(index.map((s) => `${s.id}.json`).sort()).toEqual(files.sort());
  });

  for (const summary of index) {
    describe(summary.id, () => {
      const story = JSON.parse(readFileSync(join(dir, 'stories', `${summary.id}.json`), 'utf8')) as Story;

      it('has its narration', () => {
        expect(statSync(join(dir, story.audio!)).size).toBeGreaterThan(10_000);
      });

      it('has pinyin for every character, and only real syllables', () => {
        for (const s of story.sentences) {
          for (const tok of s.tokens) {
            if (!tok.py) {
              expect(tok.t).toMatch(/^[\p{P}\s]+$/u);
              continue;
            }
            expect(tok.py).toHaveLength([...tok.t].length);
            for (const syl of tok.py) {
              // 儿 after a syllable is written "r" (erhua)
              expect(syl === 'r' || SYLLABLE.test(syl), `${tok.t}: "${syl}"`).toBe(true);
            }
            if (tok.tt) expect([...tok.tt]).toHaveLength([...tok.t].length);
          }
        }
      });

      it('times every word, in order, within the audio', () => {
        let last = 0;
        for (const s of story.sentences) {
          for (const tok of s.tokens) {
            if (!tok.py) continue;
            expect(tok.s, tok.t).toBeTypeOf('number');
            expect(tok.s!).toBeGreaterThanOrEqual(last - 1);
            expect(tok.e!).toBeGreaterThanOrEqual(tok.s!);
            last = tok.e!;
          }
        }
        expect(last).toBeLessThanOrEqual(story.duration!);
      });

      it('has an English line for every Chinese line', () => {
        for (const s of story.sentences) if (s.role !== 'author') expect(s.en.length).toBeGreaterThan(0);
      });
    });
  }

  it('marks 一 and 不 with the tone they are spoken with', () => {
    const all = index.flatMap((s) => (JSON.parse(readFileSync(join(dir, 'stories', `${s.id}.json`), 'utf8')) as Story).sentences);
    for (const s of all) {
      const chars = s.tokens.flatMap((t) => [...t.t].map((ch, i) => ({ ch, py: t.py?.[i] })));
      chars.forEach(({ ch, py }, i) => {
        const next = chars[i + 1];
        if (ch === '不' && next?.py && toneOf(next.py) === 4 && chars[i - 1]?.ch !== next.ch) expect(py, chars.map((c) => c.ch).join('')).toMatch(/^b(ú|u)$/); // 看不见 kàn bu jiàn is neutral
        if (ch === '一' && next?.py && toneOf(next.py) === 4 && chars[i - 1]?.ch !== '第') expect(py, chars.map((c) => c.ch).join('')).toBe('yí');
      });
    }
  });
});
