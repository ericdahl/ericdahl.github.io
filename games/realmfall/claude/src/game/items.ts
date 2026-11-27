import type { Rng } from './rng';
import { CLASSES, STATS, weaponDps, armorAf, type ClassId, type StatId, type WeaponKind } from './data';

export type Slot = 'weapon' | 'helm' | 'chest' | 'legs' | 'hands' | 'feet';
export const SLOTS: Slot[] = ['weapon', 'helm', 'chest', 'legs', 'hands', 'feet'];
export const SLOT_NAMES: Record<Slot, string> = { weapon: 'Weapon', helm: 'Head', chest: 'Torso', legs: 'Legs', hands: 'Hands', feet: 'Feet' };

export type Bonus = StatId | 'hp';
export interface Item {
  uid: number;
  name: string;
  slot: Slot;
  level: number;
  quality: number; // 0.85 .. 1.0
  rarity: 0 | 1 | 2 | 3;
  dps?: number;
  speed?: number;
  weapon?: WeaponKind;
  af?: number;
  bonuses: Partial<Record<Bonus, number>>;
  value: number; // copper
  potion?: 'health' | 'power';
}

export const RARITY_NAMES = ['Common', 'Fine', 'Superior', 'Artifact'];
export const RARITY_HEX = ['#e8e4da', '#5fd068', '#4aa3ff', '#c77dff'];

const BASES: Record<Slot, Record<string, string[]>> = {
  weapon: { sword: ['Arming Sword', 'Broadsword', 'Bastard Sword', 'Runeblade'], bow: ['Hunting Bow', 'Longbow', 'Recurve Bow', 'Warbow'], staff: ['Oak Staff', 'Runed Staff', 'Spellstave', 'Archstaff'], mace: ['Cudgel', 'Flanged Mace', 'Morning Star', 'Sanctum Mace'] },
  helm: { plate: ['Pot Helm', 'Great Helm'], chain: ['Coif', 'Mail Hood'], leather: ['Leather Cap', 'Ranger Hood'], cloth: ['Cowl', 'Circlet'] },
  chest: { plate: ['Breastplate', 'Cuirass'], chain: ['Hauberk', 'Mail Shirt'], leather: ['Jerkin', 'Brigandine'], cloth: ['Robe', 'Vestments'] },
  legs: { plate: ['Greaves', 'Cuisses'], chain: ['Chausses', 'Mail Leggings'], leather: ['Leggings', 'Breeches'], cloth: ['Trousers', 'Pantaloons'] },
  hands: { plate: ['Gauntlets'], chain: ['Mail Gloves'], leather: ['Gloves'], cloth: ['Wraps'] },
  feet: { plate: ['Sabatons'], chain: ['Mail Boots'], leather: ['Boots'], cloth: ['Slippers'] },
};
const PREFIX: Partial<Record<Bonus, string[]>> = {
  str: ['Mighty', 'Brawny'], con: ['Stalwart', 'Hardy'], dex: ['Nimble', 'Deft'], int: ['Runic', 'Sage’s'], pie: ['Blessed', 'Devout'], hp: ['Vital', 'Hale'],
};
const SUFFIX: Partial<Record<Bonus, string>> = {
  str: 'of the Bear', con: 'of the Oak', dex: 'of the Fox', int: 'of the Owl', pie: 'of the Dawn', hp: 'of Vigor',
};

const CLASS_STATS: Record<ClassId, Bonus[]> = {
  warden: ['str', 'con', 'dex', 'hp'],
  ranger: ['dex', 'con', 'str', 'hp'],
  runecaller: ['int', 'dex', 'con', 'hp'],
  cleric: ['pie', 'con', 'str', 'hp'],
};

let uidSeq = 1;
export function nextUid(): number {
  return uidSeq++;
}
export function bumpUid(min: number) {
  uidSeq = Math.max(uidSeq, min + 1);
}

function tier(level: number) {
  return Math.min(3, Math.floor((level - 1) / 5));
}

export function makeItem(rng: Rng, cls: ClassId, level: number, opts: { rarity?: 0 | 1 | 2 | 3; slot?: Slot; quality?: number } = {}): Item {
  const def = CLASSES[cls];
  const slot = opts.slot ?? rng.pick(SLOTS);
  const rarity = opts.rarity ?? (rng.chance(0.08) ? 2 : rng.chance(0.35) ? 1 : 0);
  const quality = opts.quality ?? Math.round(rng.range(0.86, 1) * 100) / 100;
  const bonuses: Partial<Record<Bonus, number>> = {};
  const pool = CLASS_STATS[cls];
  const n = rarity === 0 ? 0 : rarity === 1 ? 1 : rarity === 2 ? 2 : 3;
  const chosen: Bonus[] = [];
  for (let i = 0; i < n; i++) {
    const s = rng.weighted(pool.filter((p) => !chosen.includes(p)), (p) => (p === pool[0] ? 3 : 1.4));
    chosen.push(s);
    const amt = s === 'hp' ? Math.round((4 + level * 2.2) * rng.range(0.7, 1.1)) : Math.max(1, Math.round((1 + level * 0.75) * rng.range(0.7, 1.1)));
    bonuses[s] = amt;
  }
  let base: string;
  let it: Item;
  if (slot === 'weapon') {
    base = BASES.weapon[def.weapon][tier(level)];
    const wk = def.weapon;
    it = { uid: nextUid(), name: base, slot, level, quality, rarity, weapon: wk, dps: Math.round(weaponDps(level, quality) * 10) / 10, speed: wk === 'bow' ? 4.2 : wk === 'staff' ? 4.0 : wk === 'sword' ? 3.4 : 3.6, bonuses, value: 0 };
  } else {
    const opts2 = BASES[slot][def.armor];
    base = opts2[Math.min(opts2.length - 1, Math.floor(tier(level) / 2))];
    it = { uid: nextUid(), name: base, slot, level, quality, rarity, af: Math.round(armorAf(level, quality) * 10) / 10, bonuses, value: 0 };
  }
  if (chosen.length >= 1) {
    const p = PREFIX[chosen[0]]!;
    it.name = `${p[level % p.length]} ${it.name}`;
  }
  if (chosen.length >= 2) it.name = `${it.name} ${SUFFIX[chosen[1]]}`;
  it.value = Math.round((20 + level * level * 6) * (1 + rarity * 0.8) * quality);
  return it;
}

export function potion(kind: 'health' | 'power', level: number): Item {
  return {
    uid: nextUid(),
    name: kind === 'health' ? 'Healing Draught' : 'Draught of Clarity',
    slot: 'weapon',
    level,
    quality: 1,
    rarity: 0,
    bonuses: {},
    value: 8 + level * 6,
    potion: kind,
  };
}

/** Starter kit: common items of level 1 in every slot. */
export function starterKit(rng: Rng, cls: ClassId): Record<Slot, Item> {
  const out = {} as Record<Slot, Item>;
  for (const s of SLOTS) {
    const it = makeItem(rng, cls, 1, { slot: s, rarity: 0, quality: 0.9 });
    it.name = (s === 'weapon' ? 'Worn ' : 'Patched ') + it.name;
    out[s] = it;
  }
  return out;
}

export function itemScore(it: Item | undefined): number {
  if (!it) return 0;
  let s = (it.dps ?? 0) * 10 + (it.af ?? 0) * 2;
  for (const k of STATS) s += (it.bonuses[k] ?? 0) * 1.5;
  s += (it.bonuses.hp ?? 0) * 0.4;
  return s;
}

export function formatMoney(copper: number): string {
  const g = Math.floor(copper / 10000), s = Math.floor((copper % 10000) / 100), c = copper % 100;
  const parts: string[] = [];
  if (g) parts.push(`${g}g`);
  if (s) parts.push(`${s}s`);
  if (c || parts.length === 0) parts.push(`${c}c`);
  return parts.join(' ');
}

export function shopPrice(it: Item) {
  return Math.round(it.value * 4);
}
