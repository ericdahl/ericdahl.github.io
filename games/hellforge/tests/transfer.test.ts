import { describe, expect, it } from 'vitest';
import { createCharacter } from '../src/game/character';
import { generateItem } from '../src/game/items';
import { Rng } from '../src/game/rng';
import { bundleJson, decodeSave, encodeCode } from '../src/ui/transfer';

function loadedHero() {
  const c = createCharacter('Mira', 'arcanist', true);
  const rng = new Rng(42);
  // A well-stocked hero: full stash and inventory of rolled loot.
  for (let i = 0; i < 80; i++) c.stash.push({ item: generateItem(rng, 30, { mf: 300 }), x: i % 10, y: Math.floor(i / 10) });
  for (let i = 0; i < 30; i++) c.inventory.push({ item: generateItem(rng, 30, { mf: 300 }), x: i % 10, y: Math.floor(i / 10) });
  c.gold = 12345;
  return c;
}

describe('save transfer', () => {
  it('round-trips heroes through a save code', async () => {
    const chars = [loadedHero(), createCharacter('Brann', 'reaver')];
    const code = await encodeCode(chars);
    expect(code.startsWith('HF1.')).toBe(true);
    // Compressed codes stay small enough to paste around comfortably.
    expect(code.length).toBeLessThan(JSON.stringify(chars).length / 2);
    expect(await decodeSave(code)).toEqual(chars);
    // Line breaks picked up while pasting are ignored.
    expect(await decodeSave(`  ${code.replace(/(.{60})/g, '$1\n')}  `)).toEqual(chars);
  });

  it('round-trips heroes through an exported file', async () => {
    const chars = [loadedHero()];
    expect(await decodeSave(bundleJson(chars))).toEqual(chars);
  });

  it('rejects things that are not saves', async () => {
    await expect(decodeSave('hello')).rejects.toThrow(/does not look like/);
    await expect(decodeSave('{"foo":1}')).rejects.toThrow(/does not look like/);
    await expect(decodeSave('HF1.AAAA')).rejects.toThrow(/damaged/);
    const code = await encodeCode([loadedHero()]);
    await expect(decodeSave(code.slice(0, code.length / 2))).rejects.toThrow(/damaged/);
  });
});
