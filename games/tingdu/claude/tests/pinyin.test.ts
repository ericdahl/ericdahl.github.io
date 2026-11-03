import { describe, expect, it } from 'vitest';
import { isOpening, isSpoken, toneOf } from '../src/pinyin';
import { splitSentences } from '../src/custom';

describe('toneOf', () => {
  it('reads the tone mark', () => {
    expect(toneOf('mā')).toBe(1);
    expect(toneOf('má')).toBe(2);
    expect(toneOf('mǎ')).toBe(3);
    expect(toneOf('mà')).toBe(4);
    expect(toneOf('ma')).toBe(5);
    expect(toneOf('lǜ')).toBe(4);
    expect(toneOf('nǚ')).toBe(3);
  });
  it('handles decomposed accents', () => {
    expect(toneOf('mà')).toBe(4);
  });
});

describe('character classes', () => {
  it('knows spoken characters from punctuation', () => {
    expect(isSpoken('猫')).toBe(true);
    expect(isSpoken('A')).toBe(true);
    expect(isSpoken('，')).toBe(false);
    expect(isSpoken('“')).toBe(false);
    expect(isOpening('“')).toBe(true);
    expect(isOpening('”')).toBe(false);
  });
});

describe('splitSentences', () => {
  it('splits at sentence-ending punctuation and keeps closing quotes', () => {
    expect(splitSentences('他说：“你好！”我笑了。然后呢')).toEqual(['他说：“你好！”', '我笑了。', '然后呢']);
  });
  it('keeps runs of punctuation together', () => {
    expect(splitSentences('真的吗？！太好了……')).toEqual(['真的吗？！', '太好了……']);
  });
});
