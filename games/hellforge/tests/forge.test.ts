import { describe, expect, it } from 'vitest';
import { addToInventory, computeStats, createCharacter, migrateCharacter, SAVE_VERSION, type Character } from '../src/game/character';
import {
  addForgeModifier, forgeApply, forgeModifiers, forgePreview, forgeRank, hasEmber, heatOdds, itemAffixes, MASTERY_RANKS, RECIPE_RANK,
  salvageYield, type ForgeAction, type ForgeSuccess,
} from '../src/game/forge';
import { baseOf, displayName, generateItem, itemDefense, makeItem, MAX_FORGE_LEVEL, UNIQUE_BY_ID, type Item } from '../src/game/items';
import { Rng } from '../src/game/rng';
import { ACT, playAct } from './bot';
import { makeWorld, run } from './helpers';

/** An Rng whose raw rolls are fixed, to force a Heat to succeed (0) or fail (0.999). */
function fixed(v: number): Rng {
  const r = new Rng(1);
  r.next = () => v;
  return r;
}

function hero(classId: Parameters<typeof createCharacter>[1] = 'reaver', hardcore = false): Character {
  const c = createCharacter('Smith', classId, hardcore);
  c.gold = 1_000_000;
  c.forge.cinders = 100_000;
  c.forge.essences = { fire: 50, cold: 50, light: 50, poison: 50 };
  return c;
}

function give(c: Character, item: Item): Item {
  item.identified = true;
  expect(addToInventory(c, item)).toBe(true);
  return item;
}

function ok(c: Character, a: ForgeAction, rng = new Rng(7)): ForgeSuccess {
  const r = forgeApply(c, rng, a);
  if (!r.ok) throw new Error(r.error);
  return r;
}

const err = (c: Character, a: ForgeAction) => {
  const r = forgeApply(c, new Rng(7), a);
  return r.ok ? null : r.error;
};

const magicSword = (seed = 3) => generateItem(new Rng(seed), 20, { rarity: 'magic', base: 'long_sword' });
const rareArmor = (seed = 3) => generateItem(new Rng(seed), 20, { rarity: 'rare', base: 'chain_mail' });

describe('salvage', () => {
  it('breaks a plain item into Cinders and nothing else', () => {
    const c = createCharacter('S', 'reaver');
    const it = give(c, makeItem('club'));
    const r = ok(c, { type: 'salvage', uid: it.uid });
    expect(c.inventory).toEqual([]);
    expect(c.forge.cinders).toBe(r.gained!.cinders);
    expect(c.forge.cinders).toBeGreaterThan(0);
    expect(Object.values(c.forge.essences).every((n) => n === 0)).toBe(true);
  });

  it('gives an essence of the element a magic item carries', () => {
    const c = createCharacter('S', 'reaver');
    const it = give(c, makeItem('long_sword', 12, 'magic'));
    it.mods = [{ stat: 'coldMin', value: 2 }, { stat: 'coldMax', value: 5 }];
    ok(c, { type: 'salvage', uid: it.uid });
    expect(c.forge.essences.cold).toBeGreaterThanOrEqual(1);
  });

  it('pays more for better items, and returns some of the Cinders heated into them', () => {
    const c = createCharacter('S', 'reaver');
    const plain = makeItem('long_sword');
    const rare = generateItem(new Rng(1), 20, { rarity: 'rare', base: 'long_sword' });
    expect(salvageYield(c, rare).cinders).toBeGreaterThan(salvageYield(c, plain).cinders);
    const heated = { ...plain, forge: 6 };
    expect(salvageYield(c, heated).cinders).toBeGreaterThan(salvageYield(c, plain).cinders);
  });

  it('refuses worn items, and potions', () => {
    const c = createCharacter('S', 'reaver');
    expect(err(c, { type: 'salvage', uid: c.equipment.weapon!.uid })).toMatch(/Unequip/);
    const p = give(c, makeItem('hp1'));
    expect(err(c, { type: 'salvage', uid: p.uid })).toBeTruthy();
  });

  it('salvages all plain items at once and leaves the rest', () => {
    const c = createCharacter('S', 'reaver');
    give(c, makeItem('club'));
    give(c, makeItem('cap'));
    const keep = give(c, magicSword());
    const heated = give(c, makeItem('dagger'));
    heated.forge = 2;
    const r = ok(c, { type: 'salvageJunk' });
    expect(r.gained!.cinders).toBeGreaterThanOrEqual(2);
    expect(c.inventory.map((e) => e.item.uid).sort()).toEqual([keep.uid, heated.uid].sort());
    expect(err(c, { type: 'salvageJunk' })).toMatch(/No plain items/);
  });
});

describe('heat', () => {
  it('adds a forge level that raises weapon damage and shows in the name', () => {
    const c = hero();
    const before = computeStats(c);
    const sword = c.equipment.weapon!;
    for (let i = 0; i < 5; i++) ok(c, { type: 'heat', uid: sword.uid });
    expect(sword.forge).toBe(5);
    expect(displayName(sword)).toBe('+5 Short Sword');
    const after = computeStats(c);
    expect(after.maxDmg).toBeGreaterThan(before.maxDmg);
    expect(c.forge.cinders).toBeLessThan(100_000);
  });

  it('raises the defense of armor', () => {
    const c = hero();
    const armor = give(c, makeItem('chain_mail'));
    const d = itemDefense(armor);
    for (let i = 0; i < 5; i++) ok(c, { type: 'heat', uid: armor.uid });
    expect(itemDefense(armor)).toBe(Math.floor(d * 1.2));
  });

  it('cannot fail through +5, and gets riskier from +6', () => {
    const c = createCharacter('S', 'reaver');
    const it = makeItem('long_sword');
    const odds = [];
    for (let l = 0; l < MAX_FORGE_LEVEL; l++) {
      it.forge = l;
      odds.push(heatOdds(c, it).success);
    }
    expect(odds.slice(0, 5)).toEqual([100, 100, 100, 100, 100]);
    for (let i = 5; i < odds.length; i++) expect(odds[i]).toBeLessThan(odds[i - 1]);
  });

  it('a failure cracks the item back a level and still costs the Cinders', () => {
    const c = hero();
    const sword = c.equipment.weapon!;
    sword.forge = 7;
    const cinders = c.forge.cinders;
    const r = ok(c, { type: 'heat', uid: sword.uid }, fixed(0.999));
    expect(r.outcome).toBe('crack');
    expect(sword.forge).toBe(6);
    expect(c.forge.cinders).toBeLessThan(cinders);
    expect(c.equipment.weapon).toBe(sword);
  });

  it('never shatters a softcore item', () => {
    const c = hero();
    const sword = c.equipment.weapon!;
    sword.forge = 9;
    expect(heatOdds(c, sword).shatter).toBe(0);
    // Just past the success chance is where a shatter would be.
    const r = ok(c, { type: 'heat', uid: sword.uid }, fixed((heatOdds(c, sword).success + 0.5) / 100));
    expect(r.outcome).toBe('crack');
  });

  it('can shatter a Hardcore item on a failed high heat, worn or carried', () => {
    const c = hero('reaver', true);
    const sword = c.equipment.weapon!;
    sword.forge = 6;
    expect(heatOdds(c, sword).shatter).toBe(0);
    sword.forge = 8;
    const odds = heatOdds(c, sword);
    expect(odds.shatter).toBeGreaterThan(0);
    expect(odds.success + odds.crack + odds.shatter).toBe(100);
    const r = ok(c, { type: 'heat', uid: sword.uid }, fixed((odds.success + 0.5) / 100));
    expect(r.outcome).toBe('shatter');
    expect(c.equipment.weapon).toBeUndefined();
    expect(r.item).toBeUndefined();
  });

  it('stops at +10 and refuses jewelry and unidentified items', () => {
    const c = hero();
    const sword = c.equipment.weapon!;
    sword.forge = MAX_FORGE_LEVEL;
    expect(err(c, { type: 'heat', uid: sword.uid })).toMatch(/\+10/);
    const ring = give(c, generateItem(new Rng(2), 10, { rarity: 'magic', base: 'ring' }));
    expect(err(c, { type: 'heat', uid: ring.uid })).toMatch(/Rings/);
    const unid = give(c, magicSword());
    unid.identified = false;
    expect(err(c, { type: 'heat', uid: unid.uid })).toMatch(/identified/);
  });

  it('needs the Cinders', () => {
    const c = createCharacter('S', 'reaver');
    expect(err(c, { type: 'heat', uid: c.equipment.weapon!.uid })).toBe('Not enough Cinders');
    expect(c.equipment.weapon!.forge).toBeUndefined();
  });

  it('a well-timed strike improves the odds, a perfect one the most', () => {
    const c = createCharacter('S', 'reaver');
    const it = makeItem('long_sword');
    it.forge = 7;
    const plain = heatOdds(c, it).success;
    expect(heatOdds(c, it, 0.5).success).toBe(plain + 5);
    expect(heatOdds(c, it, 1).success).toBe(plain + 10);
    it.forge = 2;
    expect(heatOdds(c, it, 1).success).toBe(100);
  });
});

describe('temper', () => {
  it('re-rolls only the chosen affix, for gold and Cinders', () => {
    const c = hero();
    const armor = give(c, rareArmor());
    const before = itemAffixes(armor).map((g) => g.text);
    expect(before.length).toBeGreaterThanOrEqual(3);
    const gold = c.gold;
    const r = ok(c, { type: 'temper', uid: armor.uid, affix: 1 });
    const after = itemAffixes(armor).map((g) => g.text);
    expect(after.length).toBe(before.length);
    expect(after[1]).not.toBe(before[1]);
    expect(after.filter((_, i) => i !== 1)).toEqual(before.filter((_, i) => i !== 1));
    expect(c.gold).toBeLessThan(gold);
    expect(r.text).toContain(before[1]);
  });

  it('never rolls a stat the item already has', () => {
    const c = hero();
    for (let seed = 1; seed < 40; seed++) {
      const armor = give(c, rareArmor(seed));
      ok(c, { type: 'temper', uid: armor.uid, affix: 0 }, new Rng(seed));
      const stats = armor.mods.map((m) => m.stat);
      expect(new Set(stats).size).toBe(stats.length);
      c.inventory = [];
    }
  });

  it('gets dearer each time on the same item', () => {
    const c = hero();
    const armor = give(c, rareArmor());
    const first = forgePreview(c, { type: 'temper', uid: armor.uid, affix: 0 }).cost.gold;
    ok(c, { type: 'temper', uid: armor.uid, affix: 0 });
    expect(forgePreview(c, { type: 'temper', uid: armor.uid, affix: 0 }).cost.gold).toBeGreaterThan(first);
  });

  it('renames a magic item after its new affix', () => {
    const c = hero();
    const sword = give(c, magicSword());
    const name = sword.name;
    ok(c, { type: 'temper', uid: sword.uid, affix: 0 });
    expect(sword.name).not.toBe(name);
    expect(sword.name).toContain('Long Sword');
  });

  it('re-rolls a unique within its own range and keeps its properties', () => {
    const c = hero();
    const u = give(c, generateItem(new Rng(4), 30, { rarity: 'unique', base: 'short_sword' }));
    expect(u.uniqueId).toBe('ember_fang');
    const stats = u.mods.map((m) => m.stat);
    for (let i = 0; i < 10; i++) ok(c, { type: 'temper', uid: u.uid, affix: 0 }, new Rng(i + 1));
    expect(u.mods.map((m) => m.stat)).toEqual(stats);
    const range = UNIQUE_BY_ID.ember_fang.mods[0];
    expect(u.mods[0].value).toBeGreaterThanOrEqual(range.min);
    expect(u.mods[0].value).toBeLessThanOrEqual(range.max);
    // +30 Attack Rating is fixed on this unique: nothing to re-roll.
    const fixedIdx = itemAffixes(u).findIndex((g) => g.mods[0].stat === 'ar');
    expect(err(c, { type: 'temper', uid: u.uid, affix: fixedIdx })).toMatch(/never varies/);
  });

  it('has nothing to do on a plain item', () => {
    const c = hero();
    expect(err(c, { type: 'temper', uid: c.equipment.weapon!.uid, affix: 0 })).toBeTruthy();
  });
});

describe('quench', () => {
  it('adds elemental damage to a weapon and spends the essence', () => {
    const c = hero();
    const sword = c.equipment.weapon!;
    ok(c, { type: 'quench', uid: sword.uid, element: 'fire' });
    expect(c.forge.essences.fire).toBe(49);
    expect(sword.mods.map((m) => m.stat)).toEqual(['fireMin', 'fireMax']);
    expect(sword.mods.every((m) => m.quenched)).toBe(true);
    expect(computeStats(c).fireMax).toBeGreaterThan(0);
  });

  it('quenching again converts the affix instead of stacking another', () => {
    const c = hero();
    const sword = c.equipment.weapon!;
    ok(c, { type: 'quench', uid: sword.uid, element: 'fire' });
    ok(c, { type: 'quench', uid: sword.uid, element: 'poison' });
    expect(sword.mods.map((m) => m.stat)).toEqual(['poisonDmg']);
    const s = computeStats(c);
    expect(s.fireMax).toBe(0);
    expect(s.poisonDmg).toBeGreaterThan(0);
  });

  it('gives armor a resistance', () => {
    const c = hero();
    const armor = give(c, makeItem('chain_mail', 20));
    ok(c, { type: 'quench', uid: armor.uid, element: 'light' });
    expect(armor.mods).toHaveLength(1);
    expect(armor.mods[0].stat).toBe('lightRes');
    expect(armor.mods[0].value).toBeGreaterThanOrEqual(11);
  });

  it("converts a magic item's own elemental affix and renames it", () => {
    const c = hero();
    const sword = give(c, makeItem('long_sword', 20, 'magic'));
    sword.mods = [{ stat: 'fireMin', value: 5 }, { stat: 'fireMax', value: 12 }];
    sword.name = 'Blazing Long Sword';
    ok(c, { type: 'quench', uid: sword.uid, element: 'cold' });
    expect(sword.mods.map((m) => m.stat)).toEqual(['coldMin', 'coldMax']);
    expect(sword.name).toBe('Freezing Long Sword');
  });

  it('needs an essence of that element', () => {
    const c = hero();
    c.forge.essences.cold = 0;
    expect(err(c, { type: 'quench', uid: c.equipment.weapon!.uid, element: 'cold' })).toBe('Not enough Cold Essence');
  });
});

describe('ember-seal', () => {
  it('is taught by mastery, locks one affix, and tempering then leaves it alone', () => {
    const c = hero();
    const armor = give(c, rareArmor());
    expect(err(c, { type: 'seal', uid: armor.uid, affix: 0 })).toMatch(/Requires Journeyman/);
    c.forge.xp = MASTERY_RANKS[RECIPE_RANK.seal].xp;
    const text = itemAffixes(armor)[0].text;
    ok(c, { type: 'seal', uid: armor.uid, affix: 0 });
    expect(itemAffixes(armor)[0].sealed).toBe(true);
    expect(err(c, { type: 'temper', uid: armor.uid, affix: 0 })).toMatch(/sealed/);
    ok(c, { type: 'temper', uid: armor.uid, affix: 1 });
    expect(itemAffixes(armor)[0].text).toBe(text);
    expect(err(c, { type: 'seal', uid: armor.uid, affix: 1 })).toMatch(/only one seal/);
  });

  it('is expensive, and half the price once the ember burns in the forge', () => {
    const c = hero();
    c.forge.xp = 1000;
    const armor = give(c, rareArmor());
    const cost = forgePreview(c, { type: 'seal', uid: armor.uid, affix: 0 }).cost;
    expect(cost.gold).toBeGreaterThan(2000);
    expect(Object.keys(cost.essences).sort()).toEqual(['cold', 'fire', 'light', 'poison']);
    c.quests['0:hollow_sun'] = 'rewarded';
    expect(hasEmber(c)).toBe(true);
    expect(forgePreview(c, { type: 'seal', uid: armor.uid, affix: 0 }).cost.gold).toBeLessThan(cost.gold * 0.6);
  });
});

describe('smelt', () => {
  it('turns three plain items of a type into one magic item of the finest base', () => {
    const c = hero();
    const a = give(c, makeItem('club', 12));
    const b = give(c, makeItem('long_sword', 12));
    const d = give(c, makeItem('dagger', 12));
    const r = ok(c, { type: 'smelt', uids: [a.uid, b.uid, d.uid] });
    expect(c.inventory).toHaveLength(1);
    expect(r.item!.rarity).toBe('magic');
    expect(r.item!.base).toBe('long_sword');
    expect(r.item!.identified).toBe(true);
    expect(r.item!.mods.length).toBeGreaterThan(0);
  });

  it('turns three magic items into a rare', () => {
    const c = hero();
    const uids = [1, 2, 3].map((s) => give(c, magicSword(s)).uid);
    const r = ok(c, { type: 'smelt', uids });
    expect(r.item!.rarity).toBe('rare');
    expect(baseOf(r.item!).kind).toBe('weapon');
  });

  it('refuses mixed types, mixed rarities and repeats', () => {
    const c = hero();
    const a = give(c, makeItem('club'));
    const b = give(c, makeItem('cap'));
    const d = give(c, makeItem('dagger'));
    const m = give(c, magicSword());
    expect(err(c, { type: 'smelt', uids: [a.uid, b.uid, d.uid] })).toMatch(/same type and rarity/);
    expect(err(c, { type: 'smelt', uids: [a.uid, d.uid, m.uid] })).toMatch(/same type and rarity/);
    expect(err(c, { type: 'smelt', uids: [a.uid, a.uid, d.uid] })).toMatch(/three items/);
    expect(c.inventory).toHaveLength(4);
  });

  it('makes a unique or set piece from three rares, once mastery allows', () => {
    const c = hero();
    const uids = [1, 2, 3].map((s) => give(c, rareArmor(s)).uid);
    expect(err(c, { type: 'smelt', uids })).toMatch(/Requires Artisan/);
    c.forge.xp = MASTERY_RANKS[RECIPE_RANK.legend].xp;
    const r = ok(c, { type: 'smelt', uids });
    expect(['unique', 'set']).toContain(r.item!.rarity);
    expect(baseOf(r.item!).kind).toBe('armor');
    expect(r.tone).toBe('great');
    expect(r.say).toBeDefined();
  });
});

describe('socket punching', () => {
  it('is taught at Apprentice and fills a plain item up to what its base allows', () => {
    const c = hero();
    const sword = c.equipment.weapon!;
    expect(err(c, { type: 'punch', uid: sword.uid })).toMatch(/Requires Apprentice/);
    c.forge.xp = MASTERY_RANKS[RECIPE_RANK.punch].xp;
    const max = baseOf(sword).maxSockets!;
    for (let i = 0; i < max; i++) ok(c, { type: 'punch', uid: sword.uid });
    expect(sword.sockets).toBe(max);
    expect(err(c, { type: 'punch', uid: sword.uid })).toMatch(/No room/);
  });

  it('gives a magic item one socket at most', () => {
    const c = hero();
    c.forge.xp = 1000;
    const sword = give(c, magicSword());
    ok(c, { type: 'punch', uid: sword.uid });
    expect(err(c, { type: 'punch', uid: sword.uid })).toMatch(/No room/);
  });
});

describe('forge mastery and modifiers', () => {
  it('grows with use and announces a new rank', () => {
    const c = hero();
    expect(forgeRank(c)).toBe(0);
    let rankUp;
    for (let i = 0; i < 30 && !rankUp; i++) rankUp = ok(c, { type: 'salvage', uid: give(c, makeItem('club')).uid }).rankUp;
    expect(rankUp?.name).toBe('Apprentice');
    expect(forgeRank(c)).toBe(1);
  });

  it('makes work cheaper and heats likelier', () => {
    const novice = createCharacter('N', 'reaver');
    const master = createCharacter('M', 'reaver');
    master.forge.xp = 1000;
    const it = makeItem('long_sword');
    it.forge = 7;
    expect(heatOdds(master, it).success).toBeGreaterThan(heatOdds(novice, it).success);
    expect(forgeModifiers(master).materials).toBeLessThan(forgeModifiers(novice).materials);
    expect(salvageYield(master, rareArmor()).cinders).toBeGreaterThan(salvageYield(novice, rareArmor()).cinders);
  });

  it("Vhorza's ember, won at the end of Act 2, makes heats likelier and has her speak", () => {
    const c = hero();
    const sword = c.equipment.weapon!;
    sword.forge = 6;
    const before = heatOdds(c, sword).success;
    expect(hasEmber(c)).toBe(false);
    c.quests['0:hollow_sun'] = 'done';
    expect(heatOdds(c, sword).success).toBe(before + 5);
    const r = ok(c, { type: 'heat', uid: sword.uid }, fixed(0));
    expect(sword.forge).toBe(7);
    expect(r.say?.who).toBe('ember');
  });

  it('takes bonuses from registered sources, such as a class', () => {
    const c = createCharacter('S', 'reaver');
    c.forge.cinders = 1000;
    const sword = c.equipment.weapon!;
    sword.forge = 7;
    const odds = heatOdds(c, sword).success;
    const cost = forgePreview(c, { type: 'heat', uid: sword.uid }).cost.cinders;
    const remove = addForgeModifier((ch) => (ch.classId === 'reaver' ? { success: 7, materials: 0.5 } : null));
    expect(heatOdds(c, sword).success).toBe(odds + 7);
    expect(forgePreview(c, { type: 'heat', uid: sword.uid }).cost.cinders).toBe(Math.round(cost / 2));
    expect(heatOdds(createCharacter('A', 'arcanist'), sword).success).toBe(odds);
    remove();
    expect(heatOdds(c, sword).success).toBe(odds);
  });

  it('the Forgewright works the forge better than anyone', () => {
    const smith = createCharacter('F', 'forgewright');
    const other = createCharacter('R', 'reaver');
    const it = makeItem('long_sword');
    it.forge = 7;
    expect(heatOdds(smith, it).success).toBeGreaterThan(heatOdds(other, it).success);
    expect(forgeModifiers(smith).materials).toBeLessThan(forgeModifiers(other).materials);
  });
});

describe('the forge in the world', () => {
  for (const town of ['town', 'tel_maresh', 'emberwatch_ruins']) {
    it(`stands in ${town}, and walking up to it opens the forge`, () => {
      const w = makeWorld();
      w.enterArea(town, 'start');
      w.events.length = 0;
      expect(w.interactLabel({ kind: 'forge' })).toBe('The Forge');
      w.cmdInteract({ kind: 'forge' });
      run(w, 12);
      expect(w.events.some((e) => e.type === 'open' && e.panel === 'forge')).toBe(true);
      const f = w.area.level.spots.forge;
      expect(Math.hypot(w.player.x - (f.x + 0.5), w.player.y - (f.y + 0.5))).toBeLessThan(1.4);
    });
  }

  it('has no forge outside town', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    expect(w.interactPos({ kind: 'forge' })).toBeNull();
  });

  it('World.forge applies the job, refreshes stats and makes a sound', () => {
    const w = makeWorld();
    w.char.forge.cinders = 500;
    const before = w.stats.maxDmg;
    w.events.length = 0;
    for (let i = 0; i < 5; i++) expect(w.forge({ type: 'heat', uid: w.char.equipment.weapon!.uid }).ok).toBe(true);
    expect(w.stats.maxDmg).toBeGreaterThan(before);
    expect(w.events.some((e) => e.type === 'sound' && e.id === 'anvil')).toBe(true);
    expect(w.forge({ type: 'heat', uid: 999999 }).ok).toBe(false);
  });

  it('forge rolls leave loot and the world untouched', () => {
    const a = makeWorld('reaver', 77);
    const b = makeWorld('reaver', 77);
    a.char.forge.cinders = 5000;
    a.char.equipment.weapon!.forge = 6;
    for (let i = 0; i < 6; i++) a.forge({ type: 'heat', uid: a.char.equipment.weapon!.uid });
    expect(a.rng.next()).toBe(b.rng.next());
  });

  it('a heated item is worth more and shows its level on the ground', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const sword = w.char.equipment.weapon!;
    sword.forge = 7;
    expect(w.unequip('weapon')).toBeNull();
    w.dropFromInventory(sword.uid);
    expect(w.groundLabel(w.area.ground[0]).text).toBe('+7 Short Sword');
  });
});

describe('saves', () => {
  it('a version 2 hero gains an empty forge and keeps everything else', () => {
    const c = createCharacter('Old', 'huntress');
    const old = structuredClone(c) as Omit<Character, 'forge'> & { forge?: Character['forge'] };
    delete old.forge;
    old.version = 2;
    expect(migrateCharacter(old as Character)).toBe(true);
    expect(old.version).toBe(SAVE_VERSION);
    expect(old.forge).toEqual({ cinders: 0, essences: { fire: 0, cold: 0, light: 0, poison: 0 }, xp: 0 });
    expect(old.equipment).toEqual(c.equipment);
    expect(migrateCharacter(old as Character)).toBe(false);
  });

  it('forge levels, seals and materials survive a save and load', () => {
    const c = hero();
    c.forge.xp = 1000;
    const armor = give(c, rareArmor());
    ok(c, { type: 'heat', uid: armor.uid });
    ok(c, { type: 'seal', uid: armor.uid, affix: 0 });
    const loaded = JSON.parse(JSON.stringify(c)) as Character;
    const it = loaded.inventory[0].item;
    expect(displayName(it)).toMatch(/^\+1 /);
    expect(itemAffixes(it)[0].sealed).toBe(true);
    expect(loaded.forge).toEqual(c.forge);
  });
});

describe('playthrough with the forge', () => {
  it('a bot that salvages its loot and heats its gear finishes the act with forged equipment', () => {
    const reports = playAct('reaver', 99, 900, ACT, { forge: true });
    const last = reports[reports.length - 1];
    expect(last.bossDead).toBe(true);
    expect(last.forged).toBeGreaterThanOrEqual(5);
    // Junk loot alone pays for it: the weapon is being heated within the first two areas.
    expect(reports[1].forged).toBeGreaterThan(0);
  }, 120_000);
});
