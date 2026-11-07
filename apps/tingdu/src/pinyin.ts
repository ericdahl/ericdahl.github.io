const MARKS: Record<string, number> = {};
for (const [tone, chars] of [[1, 'āēīōūǖĀĒĪŌŪǕ'], [2, 'áéíóúǘÁÉÍÓÚǗ'], [3, 'ǎěǐǒǔǚǍĚǏǑǓǙ'], [4, 'àèìòùǜÀÈÌÒÙǛ']] as const) {
  for (const c of chars) MARKS[c] = tone;
}

/** Tone of a pinyin syllable written with tone marks: 1-4, or 5 for the neutral tone. */
export function toneOf(syllable: string): number {
  for (const c of syllable.normalize('NFC')) {
    const t = MARKS[c];
    if (t) return t;
  }
  return 5;
}

const OPENING = new Set('“‘「『（(《〈【');

/** Punctuation that belongs with the word after it (opening quotes and brackets). */
export function isOpening(ch: string): boolean {
  return OPENING.has(ch);
}

/** A character the narrator says, as opposed to punctuation or space. */
export function isSpoken(ch: string): boolean {
  return /[\p{Script=Han}\p{L}\p{N}]/u.test(ch);
}

export function isHan(ch: string): boolean {
  return /\p{Script=Han}/u.test(ch);
}
