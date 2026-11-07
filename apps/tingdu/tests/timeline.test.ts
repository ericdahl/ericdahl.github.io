import { describe, expect, it } from 'vitest';
import { buildTimeline, charAt, sentenceAt } from '../src/timeline';
import type { Story } from '../src/types';

const story: Story = {
  id: 't',
  title: '小猫',
  titleTrad: '小貓',
  en: 'Kitten',
  level: 1,
  kind: 'story',
  sentences: [
    { role: 'title', para: -1, en: '', start: 100, end: 600, tokens: [{ t: '小猫', py: ['xiǎo', 'māo'], s: 100, e: 600 }] },
    {
      role: 'body',
      para: 0,
      en: '',
      start: 1000,
      end: 2000,
      tokens: [
        { t: '“' },
        { t: '你好', py: ['nǐ', 'hǎo'], s: 1000, e: 1400 },
        { t: '！' },
        { t: '我', py: ['wǒ'], s: 1700, e: 2000 },
        { t: '。”' },
      ],
    },
  ],
};

describe('buildTimeline', () => {
  const tl = buildTimeline(story);

  it('has one entry per spoken character, skipping punctuation', () => {
    expect(tl.chars.map((c) => `${c.sentence}.${c.token}.${c.index}`)).toEqual(['0.0.0', '0.0.1', '1.1.0', '1.1.1', '1.3.0']);
  });

  it('shares a word’s time equally among its characters', () => {
    expect(tl.chars[0]).toMatchObject({ start: 100, end: 350 });
    expect(tl.chars[1]).toMatchObject({ start: 350, end: 600 });
  });

  it('pads line windows into the surrounding silence without overlapping', () => {
    expect(tl.sentences[0].start).toBe(0);
    expect(tl.sentences[0].end).toBeGreaterThan(600);
    expect(tl.sentences[0].end).toBeLessThanOrEqual(tl.sentences[1].start);
    expect(tl.sentences[1].first).toBe(2);
    expect(tl.sentences[1].last).toBe(4);
  });

  it('finds the character being spoken', () => {
    expect(charAt(tl, 50)).toBe(-1);
    expect(charAt(tl, 120)).toBe(0);
    expect(charAt(tl, 400)).toBe(1);
    expect(charAt(tl, 1250)).toBe(3);
    // just after a word the highlight lingers briefly, then clears in a long pause
    expect(charAt(tl, 1500)).toBe(3);
    expect(charAt(tl, 1690)).toBe(-1);
    expect(charAt(tl, 1800)).toBe(4);
  });

  it('finds the line being read', () => {
    expect(sentenceAt(tl, 0)).toBe(0);
    expect(sentenceAt(tl, 950)).toBe(1);
    expect(sentenceAt(tl, 99999)).toBe(1);
  });
});
