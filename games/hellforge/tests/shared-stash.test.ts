import { describe, expect, it } from 'vitest';
import { createCharacter, newSharedStash, STASH_COLS, STASH_ROWS } from '../src/game/character';
import { generateItem, makeItem } from '../src/game/items';
import { Rng } from '../src/game/rng';
import { World } from '../src/game/world';
import { bundle, bundleJson, decodeBundle, decodeSave, encodeCode } from '../src/ui/transfer';

function hero(name: string, shared = newSharedStash(), cls: Parameters<typeof createCharacter>[1] = 'reaver') {
  return new World(createCharacter(name, cls), 7, shared);
}

/** Puts a freshly rolled item in the hero's backpack and returns it. */
function loot(w: World, seed = 1) {
  const it = generateItem(new Rng(seed), 20, { kinds: ['ring'], rarity: 'rare' });
  w.char.inventory.push({ item: it, x: 0, y: 0 });
  return it;
}

describe('the shared stash', () => {
  it('passes an item from one hero to another', () => {
    const shared = newSharedStash();
    const a = hero('Ann', shared);
    const ring = loot(a);
    expect(a.toStash(ring.uid, true)).toBe(true);
    expect(a.char.inventory).toEqual([]);
    expect(a.char.stash).toEqual([]);
    expect(shared.items.map((e) => e.item.uid)).toEqual([ring.uid]);

    const b = hero('Bo', shared, 'arcanist');
    expect(b.findItem(ring.uid)).toMatchObject({ where: 'stash', shared: true });
    expect(b.fromStash(ring.uid)).toBe(true);
    expect(b.char.inventory.map((e) => e.item)).toEqual([ring]);
    expect(shared.items).toEqual([]);
  });

  it('keeps apart from the hero’s own stash', () => {
    const w = hero('Ann');
    const mine = loot(w, 1);
    w.toStash(mine.uid);
    const ours = loot(w, 2);
    w.toStash(ours.uid, true);
    expect(w.char.stash.map((e) => e.item.uid)).toEqual([mine.uid]);
    expect(w.shared.items.map((e) => e.item.uid)).toEqual([ours.uid]);
    expect(w.findItem(mine.uid)!.shared).toBeUndefined();
    // Taking out finds the item in whichever stash holds it.
    expect(w.fromStash(mine.uid)).toBe(true);
    expect(w.fromStash(ours.uid)).toBe(true);
    expect(w.char.stash.length + w.shared.items.length).toBe(0);
    expect(w.fromStash(12345678)).toBe(false);
  });

  it('holds gold of its own', () => {
    const shared = newSharedStash();
    const a = hero('Ann', shared);
    a.char.gold = 500;
    a.depositGold(200, true);
    a.depositGold(100);
    expect([a.char.gold, shared.gold, a.char.stashGold]).toEqual([200, 200, 100]);
    a.depositGold(undefined, true);
    expect([a.char.gold, shared.gold]).toEqual([0, 400]);
    const b = hero('Bo', shared);
    b.char.gold = 0;
    b.withdrawGold(150, true);
    expect([b.char.gold, shared.gold]).toEqual([150, 250]);
    b.withdrawGold(undefined, true);
    expect([b.char.gold, shared.gold, b.char.stashGold]).toEqual([400, 0, 0]);
    b.withdrawGold(999, true);
    expect(b.char.gold).toBe(400);
  });

  it('says so when it is full, and loses nothing', () => {
    const w = hero('Ann');
    for (let y = 0; y < STASH_ROWS; y += 3) for (let x = 0; x < STASH_COLS; x += 2) w.shared.items.push({ item: makeItem('plate_mail'), x, y });
    while (w.toStash(loot(w, w.shared.items.length).uid, true));
    const left = w.char.inventory.length;
    expect(left).toBe(1);
    expect(w.events.some((e) => e.type === 'msg' && e.text === 'Shared stash is full')).toBe(true);
    const n = w.shared.items.length;
    // A full backpack refuses the item and leaves it where it was.
    w.char.inventory.length = 0;
    for (let y = 0; y < 4; y += 2) for (let x = 0; x < 10; x += 2) w.char.inventory.push({ item: makeItem('plate_mail'), x, y });
    const big = w.shared.items.find((e) => e.item.base === 'plate_mail')!.item;
    expect(w.fromStash(big.uid)).toBe(false);
    expect(w.shared.items.length).toBe(n);
    expect(w.shared.items.some((e) => e.item === big)).toBe(true);
  });

  it('gives an item a new id when two heroes’ items share one', () => {
    const shared = newSharedStash();
    const a = hero('Ann', shared);
    const mine = loot(a, 1);
    a.toStash(mine.uid, true);
    // A hero brought over from another device, whose ring happens to carry the same id.
    const b = hero('Bo', shared);
    const theirs = generateItem(new Rng(9), 20, { kinds: ['ring'], rarity: 'magic' });
    theirs.uid = mine.uid;
    b.char.inventory.push({ item: theirs, x: 0, y: 0 });
    expect(b.toStash(theirs.uid, true)).toBe(true);
    expect(new Set(shared.items.map((e) => e.item.uid)).size).toBe(2);
    b.char.inventory.push({ item: { ...theirs, uid: mine.uid }, x: 0, y: 0 });
    expect(b.fromStash(mine.uid)).toBe(true);
    expect(new Set(b.char.inventory.map((e) => e.item.uid)).size).toBe(2);
  });

  it('is in reach of the sage, and out of reach of the forge like any stash', () => {
    const w = hero('Ann');
    const ring = loot(w);
    ring.identified = false;
    w.toStash(ring.uid, true);
    expect(w.identifyAll()).toBe(1);
    expect(ring.identified).toBe(true);
    expect(w.forge({ type: 'salvage', uid: ring.uid }).ok).toBe(false);
    expect(w.shared.items.length).toBe(1);
  });

  it('potions come out into the potion pools', () => {
    const w = hero('Ann');
    const before = w.char.potions.hp1 ?? 0;
    w.shared.items.push({ item: makeItem('hp1'), x: 0, y: 0 });
    expect(w.fromStash(w.shared.items[0].item.uid)).toBe(true);
    expect(w.char.potions.hp1).toBe(before + 1);
    expect(w.shared.items).toEqual([]);
  });
});

describe('the shared stash in a save', () => {
  const stashes = () => {
    const soft = newSharedStash();
    soft.gold = 777;
    soft.items.push({ item: generateItem(new Rng(3), 30, { mf: 300 }), x: 0, y: 0 });
    return { soft, hard: newSharedStash() };
  };

  it('travels with an export, as a file or a code', async () => {
    const chars = [createCharacter('Ann', 'reaver')];
    const sh = stashes();
    expect((await decodeBundle(bundleJson(chars, sh))).shared).toEqual(sh);
    const viaCode = await decodeBundle(await encodeCode(chars, sh));
    expect(viaCode.shared).toEqual(sh);
    expect(viaCode.chars).toEqual(chars);
    expect(await decodeSave(bundleJson(chars, sh))).toEqual(chars);
  });

  it('is left out when empty, and older saves without one still load', async () => {
    const chars = [createCharacter('Ann', 'reaver')];
    expect(bundle(chars, { soft: newSharedStash(), hard: newSharedStash() }).shared).toBeUndefined();
    expect(bundle(chars).shared).toBeUndefined();
    expect((await decodeBundle(bundleJson(chars))).shared).toBeUndefined();
    const broken = JSON.stringify({ ...bundle(chars), shared: { soft: { items: 'x' }, hard: {} } });
    expect((await decodeBundle(broken)).shared).toBeUndefined();
  });
});
