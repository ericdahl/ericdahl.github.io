import { addToInventory, ESSENCE_TYPES, removeFromGrid, type Character, type EssenceType } from './character';
import {
  AFFIXES, affixFits, baseOf, describeMods, displayName, forgeLevel, generateItem, isEquipment, MAX_FORGE_LEVEL, SET_PIECES,
  UNIQUE_BY_ID, UNIQUES,
  type Affix, type Item, type ItemKind, type Mod, type Rarity, type Slot, type StatKey,
} from './items';
import type { Rng } from './rng';

// The Forge: salvage loot into materials, then spend them to improve the gear worth keeping.
// Everything here is pure: it changes a Character and its items and reports what happened.

export const ESSENCE_NAMES: Record<EssenceType, string> = { fire: 'Fire', cold: 'Cold', light: 'Lightning', poison: 'Poison' };
export const ESSENCE_COLORS: Record<EssenceType, string> = { fire: '#ff8a4a', cold: '#8ad0ff', light: '#ffe86a', poison: '#8ae06a' };

const ELEMENT_STATS: Record<EssenceType, { dmg: StatKey[]; res: StatKey }> = {
  fire: { dmg: ['fireMin', 'fireMax'], res: 'fireRes' },
  cold: { dmg: ['coldMin', 'coldMax'], res: 'coldRes' },
  light: { dmg: ['lightMin', 'lightMax'], res: 'lightRes' },
  poison: { dmg: ['poisonDmg'], res: 'poisonRes' },
};

function elementOfStat(stat: StatKey): { element: EssenceType; kind: 'dmg' | 'res' } | null {
  for (const e of ESSENCE_TYPES) {
    if (ELEMENT_STATS[e].dmg.includes(stat)) return { element: e, kind: 'dmg' };
    if (ELEMENT_STATS[e].res === stat) return { element: e, kind: 'res' };
  }
  return null;
}

// ---------------------------------------------------------------- mastery

export interface MasteryRank {
  name: string;
  xp: number;
  /** What reaching this rank teaches. */
  unlock?: string;
}

export const MASTERY_RANKS: MasteryRank[] = [
  { name: 'Novice', xp: 0 },
  { name: 'Apprentice', xp: 20, unlock: 'Socket punching' },
  { name: 'Journeyman', xp: 60, unlock: 'Ember-Seal' },
  { name: 'Artisan', xp: 150, unlock: 'Smelting rare items into legends' },
  { name: 'Master', xp: 320 },
  { name: 'Grandmaster', xp: 600 },
];

/** The mastery rank a recipe needs. */
export const RECIPE_RANK = { punch: 1, seal: 2, legend: 3 } as const;

export function forgeRank(c: Character): number {
  let r = 0;
  for (let i = 0; i < MASTERY_RANKS.length; i++) if (c.forge.xp >= MASTERY_RANKS[i].xp) r = i;
  return r;
}

/** Progress toward the next rank, 0..1 (1 at the top rank). */
export function masteryProgress(c: Character): number {
  const r = forgeRank(c);
  const next = MASTERY_RANKS[r + 1];
  if (!next) return 1;
  return (c.forge.xp - MASTERY_RANKS[r].xp) / (next.xp - MASTERY_RANKS[r].xp);
}

/** Vhorza's ember, won at the end of Act 2, burns in the forge from then on. */
export function hasEmber(c: Character): boolean {
  return c.maxDifficulty > 0 || Object.entries(c.quests).some(([k, v]) => k.endsWith(':hollow_sun') && (v === 'done' || v === 'rewarded'));
}

// ---------------------------------------------------------------- modifiers

/** Everything that tilts the Forge in a hero's favour. Mastery and the ember feed it; classes and gear can too. */
export interface ForgeModifiers {
  /** Multiplier on Cinder and Essence costs. */
  materials: number;
  /** Multiplier on gold costs. */
  gold: number;
  /** Percentage points added to the chance that a Heat succeeds. */
  success: number;
  /** Multiplier on Cinders gained from salvage. */
  salvage: number;
  /** Multiplier on mastery experience. */
  mastery: number;
  /** Multiplier on the chance that a failed Heat shatters a Hardcore hero's item. */
  shatter: number;
}

export type ForgeModifierSource = (c: Character) => Partial<ForgeModifiers> | null | undefined;

const sources: ForgeModifierSource[] = [];

/**
 * Registers a source of Forge bonuses (a class passive, a set bonus, an event). Multipliers stack by
 * multiplying, `success` by adding. Returns a function that removes the source again.
 */
export function addForgeModifier(src: ForgeModifierSource): () => void {
  sources.push(src);
  return () => {
    const i = sources.indexOf(src);
    if (i >= 0) sources.splice(i, 1);
  };
}

// A Forgewright is at home here: the first class to bring a bonus of its own to the Forge.
addForgeModifier((c) => (c.classId === 'forgewright' ? { materials: 0.9, success: 3 } : null));

export function forgeModifiers(c: Character): ForgeModifiers {
  const rank = forgeRank(c);
  const m: ForgeModifiers = { materials: 1 - 0.03 * rank, gold: 1, success: 2 * rank, salvage: 1 + 0.05 * rank, mastery: 1, shatter: 1 };
  if (hasEmber(c)) m.success += 5;
  for (const src of sources) {
    const x = src(c);
    if (!x) continue;
    m.materials *= x.materials ?? 1;
    m.gold *= x.gold ?? 1;
    m.success += x.success ?? 0;
    m.salvage *= x.salvage ?? 1;
    m.mastery *= x.mastery ?? 1;
    m.shatter *= x.shatter ?? 1;
  }
  return m;
}

// ---------------------------------------------------------------- costs

export interface ForgeCost {
  gold: number;
  cinders: number;
  essences: Partial<Record<EssenceType, number>>;
}

function scaled(c: Character, gold: number, cinders: number, essences: Partial<Record<EssenceType, number>> = {}): ForgeCost {
  const m = forgeModifiers(c);
  const out: ForgeCost = { gold: Math.max(0, Math.round(gold * m.gold)), cinders: cinders > 0 ? Math.max(1, Math.round(cinders * m.materials)) : 0, essences: {} };
  for (const e of ESSENCE_TYPES) if (essences[e]) out.essences[e] = Math.max(1, Math.round(essences[e]! * m.materials));
  return out;
}

export function costText(cost: ForgeCost): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(`${cost.gold.toLocaleString()} gold`);
  if (cost.cinders) parts.push(`${cost.cinders} Cinder${cost.cinders > 1 ? 's' : ''}`);
  for (const e of ESSENCE_TYPES) if (cost.essences[e]) parts.push(`${cost.essences[e]} ${ESSENCE_NAMES[e]} Essence`);
  return parts.join(' · ') || 'Free';
}

/** Why the hero can't pay, or null. */
export function cantAfford(c: Character, cost: ForgeCost): string | null {
  if (c.gold < cost.gold) return 'Not enough gold';
  if (c.forge.cinders < cost.cinders) return 'Not enough Cinders';
  for (const e of ESSENCE_TYPES) if ((cost.essences[e] ?? 0) > c.forge.essences[e]) return `Not enough ${ESSENCE_NAMES[e]} Essence`;
  return null;
}

function pay(c: Character, cost: ForgeCost) {
  c.gold -= cost.gold;
  c.forge.cinders -= cost.cinders;
  for (const e of ESSENCE_TYPES) c.forge.essences[e] -= cost.essences[e] ?? 0;
}

/** 1 for the humblest bases up to 5 for the finest. */
function tier(item: Item): number {
  return 1 + Math.min(4, Math.floor(baseOf(item).qlvl / 6));
}

// ---------------------------------------------------------------- affixes

/** One affix as the player sees it: a line of the tooltip. Elemental min/max pairs count as one. */
export interface ItemAffix {
  /** Positions in item.mods; always consecutive. */
  idx: number[];
  mods: Mod[];
  text: string;
  sealed: boolean;
  quenched: boolean;
}

const PAIRS: [StatKey, StatKey][] = [['fireMin', 'fireMax'], ['coldMin', 'coldMax'], ['lightMin', 'lightMax']];

export function itemAffixes(item: Item): ItemAffix[] {
  const out: ItemAffix[] = [];
  for (let i = 0; i < item.mods.length; i++) {
    const md = item.mods[i];
    const next = item.mods[i + 1];
    const paired = next && PAIRS.some((p) => p[0] === md.stat && p[1] === next.stat) && !!next.quenched === !!md.quenched;
    const idx = paired ? [i, i + 1] : [i];
    const mods = idx.map((k) => item.mods[k]);
    out.push({ idx, mods, text: describeMods(mods).join(', '), sealed: mods.some((x) => x.sealed), quenched: mods.some((x) => x.quenched) });
    if (paired) i++;
  }
  return out;
}

/** The affix definition that could have rolled these mods on this base, if any. */
function affixDefOf(item: Item, mods: Mod[], taken: Set<string>): Affix | null {
  const b = baseOf(item);
  const match = (a: Affix) => a.mods.length === mods.length && a.mods.every((am, k) => am.stat === mods[k].stat && mods[k].value >= am.min && mods[k].value <= am.max);
  const all = AFFIXES.filter(match);
  return all.find((a) => affixFits(a, b) && !taken.has(a.id)) ?? all[0] ?? null;
}

/** A magic item is named after its affixes, so its name follows them when they change. */
function renameMagic(item: Item, known = new Map<number, Affix>()) {
  if (item.rarity !== 'magic') return;
  const pre: string[] = [];
  const suf: string[] = [];
  const taken = new Set<string>();
  for (const g of itemAffixes(item)) {
    if (g.quenched) continue;
    const def = known.get(g.idx[0]) ?? affixDefOf(item, g.mods, taken);
    if (!def) continue;
    taken.add(def.id);
    (def.type === 'prefix' ? pre : suf).push(def.name);
  }
  item.name = [...pre, baseOf(item).name, ...suf].join(' ');
}

/** The fixed ranges a unique or set piece rolls its properties from. */
function legendRanges(item: Item): { stat: StatKey; min: number; max: number }[] | null {
  if (item.rarity === 'unique') return (item.uniqueId && UNIQUE_BY_ID[item.uniqueId]?.mods) || null;
  if (item.rarity === 'set') return SET_PIECES.find((p) => p.id === item.uniqueId)?.mods ?? null;
  return null;
}

// ---------------------------------------------------------------- heat

const HEAT_SUCCESS = [100, 100, 100, 100, 100, 80, 70, 55, 40, 30];
/** Share of failures that shatter the item outright, for Hardcore heroes, by target level. */
const HEAT_SHATTER = [0, 0, 0, 0, 0, 0, 0, 0.25, 0.35, 0.5];
/** The most a perfectly timed strike adds to the success chance, in percentage points. */
export const STRIKE_BONUS = 10;

export interface HeatOdds {
  /** The level a success reaches. */
  target: number;
  /** Chances in percent; they add up to 100. */
  success: number;
  /** The item loses a level. */
  crack: number;
  /** The item is destroyed (Hardcore only). */
  shatter: number;
}

/** The odds of the next Heat. `strike` is how well the hammer blow was timed, 0..1. */
export function heatOdds(c: Character, item: Item, strike = 0): HeatOdds {
  const target = forgeLevel(item) + 1;
  const base = HEAT_SUCCESS[target - 1] ?? 0;
  const m = forgeModifiers(c);
  const success = base >= 100 ? 100 : Math.max(5, Math.min(100, Math.round(base + m.success + STRIKE_BONUS * Math.max(0, Math.min(1, strike)))));
  const fail = 100 - success;
  const shatter = c.hardcore ? Math.round(fail * Math.min(1, (HEAT_SHATTER[target - 1] ?? 0) * m.shatter)) : 0;
  return { target, success, crack: fail - shatter, shatter };
}

function heatCinders(item: Item, target: number): number {
  return Math.ceil(target * (1.5 + target * 0.5) * (0.75 + 0.25 * tier(item)));
}

// ---------------------------------------------------------------- salvage

export interface Materials {
  cinders: number;
  essences: Partial<Record<EssenceType, number>>;
}

const SALVAGE_BASE: Record<Rarity, [number, number]> = { normal: [1, 10], magic: [3, 6], rare: [7, 4], set: [12, 4], unique: [16, 3] };

/** What breaking an item down gives. Essences without a matching affix are drawn at random, so pass an Rng to roll them. */
export function salvageYield(c: Character, item: Item, rng?: Rng): Materials {
  const b = baseOf(item);
  const [flat, per] = SALVAGE_BASE[item.rarity];
  let cinders = flat + Math.floor(b.qlvl / per) + item.gems.length * 2;
  // Some of the Cinders burned into an item come back out of it.
  for (let l = 1; l <= forgeLevel(item); l++) cinders += Math.floor(heatCinders(item, l) * 0.3);
  const out: Materials = { cinders: Math.max(1, Math.round(cinders * forgeModifiers(c).salvage)), essences: {} };
  if (item.rarity === 'normal') return out;
  const found = new Set<EssenceType>();
  for (const md of item.mods) {
    const el = elementOfStat(md.stat);
    if (el) found.add(el.element);
  }
  for (const e of found) out.essences[e] = 1;
  if (rng) {
    const want = item.rarity === 'magic' ? (rng.chance(0.35) ? 1 : 0) : item.rarity === 'rare' ? 1 : 2;
    for (let n = found.size; n < want; n++) {
      const e = rng.pick(ESSENCE_TYPES);
      out.essences[e] = (out.essences[e] ?? 0) + 1;
    }
  }
  return out;
}

function gain(c: Character, m: Materials) {
  c.forge.cinders += m.cinders;
  for (const e of ESSENCE_TYPES) c.forge.essences[e] += m.essences[e] ?? 0;
}

export function materialsText(m: Materials): string {
  const parts = [`${m.cinders} Cinder${m.cinders === 1 ? '' : 's'}`];
  for (const e of ESSENCE_TYPES) if (m.essences[e]) parts.push(`${m.essences[e]} ${ESSENCE_NAMES[e]} Essence`);
  return parts.join(', ');
}

/** Plain loot nobody would miss: normal, never worked at the forge, no gems in it. */
export function isJunk(item: Item): boolean {
  return isEquipment(baseOf(item)) && item.rarity === 'normal' && !item.forge && !item.gems.length;
}

/** Whether salvaging deserves a second look first. */
export function salvageNeedsConfirm(item: Item): boolean {
  return item.rarity === 'rare' || item.rarity === 'set' || item.rarity === 'unique' || !!item.forge || item.gems.length > 0;
}

// ---------------------------------------------------------------- smelt

const NEXT_RARITY: Partial<Record<Rarity, Rarity>> = { normal: 'magic', magic: 'rare', rare: 'unique' };
const SMELT_COST: Partial<Record<Rarity, [number, number]>> = { normal: [0, 6], magic: [120, 16], rare: [1200, 50] };

/** Which legend three rares of this kind can become at this item level: a unique if one exists, else a set piece. */
function legendRarity(kind: ItemKind, ilvl: number): Rarity | null {
  if (UNIQUES.some((u) => u.qlvl <= ilvl && baseOf(u.base).kind === kind)) return 'unique';
  if (SET_PIECES.some((p) => p.qlvl <= ilvl && baseOf(p.base).kind === kind)) return 'set';
  return null;
}

// ---------------------------------------------------------------- actions

export type ForgeAction =
  | { type: 'salvage'; uid: number }
  /** Salvages every plain item in the backpack at once. */
  | { type: 'salvageJunk' }
  /** `strike` is how well the optional hammer blow was timed, 0..1. */
  | { type: 'heat'; uid: number; strike?: number }
  /** `affix` indexes itemAffixes(item). */
  | { type: 'temper'; uid: number; affix: number }
  | { type: 'quench'; uid: number; element: EssenceType }
  | { type: 'seal'; uid: number; affix: number }
  | { type: 'punch'; uid: number }
  | { type: 'smelt'; uids: number[] };

export type ForgeActionType = ForgeAction['type'];

export interface ForgePreview {
  cost: ForgeCost;
  /** Why it can't be done right now, or null. */
  error: string | null;
  odds?: HeatOdds;
  /** What salvage would give, without the randomly drawn essences. */
  yield?: Materials;
  /** What the action would do, in a few words. */
  note?: string;
}

export interface ForgeSuccess {
  ok: true;
  type: ForgeActionType;
  /** One line for the message log. */
  text: string;
  tone: 'good' | 'great' | 'bad' | 'plain';
  outcome?: 'success' | 'crack' | 'shatter';
  /** The item worked on, or made. Absent when it was destroyed. */
  item?: Item;
  gained?: Materials;
  /** A new mastery rank, when this job earned one. */
  rankUp?: MasteryRank;
  /** A word from whoever is watching the fire. */
  say?: { who: 'smith' | 'ember'; text: string };
}

export type ForgeResult = ForgeSuccess | { ok: false; error: string };

const FREE: ForgeCost = { gold: 0, cinders: 0, essences: {} };

function locate(c: Character, uid: number): { item: Item; slot?: Slot } | null {
  const inv = c.inventory.find((e) => e.item.uid === uid);
  if (inv) return { item: inv.item };
  for (const [slot, it] of Object.entries(c.equipment)) if (it?.uid === uid) return { item: it, slot: slot as Slot };
  return null;
}

function workable(c: Character, uid: number): { item: Item; slot?: Slot } | string {
  const at = locate(c, uid);
  if (!at) return 'Bring the item to the forge in your backpack, or wear it';
  if (!isEquipment(baseOf(at.item))) return 'Only weapons, armor and jewelry can be worked';
  if (!at.item.identified) return 'Have it identified first';
  return at;
}

function quenchPlan(item: Item, element: EssenceType): { def: Affix; replace: ItemAffix | null } {
  const b = baseOf(item);
  const dmg = b.kind === 'weapon';
  const group = dmg ? element : `${element}Res`;
  const defs = AFFIXES.filter((a) => a.group === group).sort((x, y) => x.lvl - y.lvl);
  const def = defs.filter((a) => a.lvl <= item.ilvl).pop() ?? defs[0];
  const affixes = itemAffixes(item).filter((g) => !g.sealed);
  // The quenched affix is converted first; magic and rare items give up a natural one of the same kind instead.
  let replace = affixes.find((g) => g.quenched) ?? null;
  if (!replace && (item.rarity === 'magic' || item.rarity === 'rare')) {
    replace = affixes.find((g) => g.mods.every((md) => elementOfStat(md.stat)?.kind === (dmg ? 'dmg' : 'res'))) ?? null;
  }
  return { def, replace };
}

/** What an action would cost and whether it can be done, without doing it. */
export function forgePreview(c: Character, a: ForgeAction): ForgePreview {
  const fail = (error: string, cost = FREE): ForgePreview => ({ cost, error });
  const rank = forgeRank(c);
  const needRank = (r: number) => (rank < r ? `Requires ${MASTERY_RANKS[r].name} forge mastery` : null);
  switch (a.type) {
    case 'salvageJunk':
      return { cost: FREE, error: c.inventory.some((e) => isJunk(e.item)) ? null : 'No plain items to salvage' };
    case 'salvage': {
      const at = locate(c, a.uid);
      if (!at) return fail('Item not found');
      if (at.slot) return fail('Unequip it first');
      if (!isEquipment(baseOf(at.item))) return fail('Only weapons, armor and jewelry can be salvaged');
      return { cost: FREE, error: null, yield: salvageYield(c, at.item) };
    }
    case 'heat': {
      const at = workable(c, a.uid);
      if (typeof at === 'string') return fail(at);
      const b = baseOf(at.item);
      if (b.minDmg === undefined && b.defMin === undefined) return fail('Rings and amulets have no metal to heat');
      if (forgeLevel(at.item) >= MAX_FORGE_LEVEL) return fail(`Already +${MAX_FORGE_LEVEL}: it can take no more`);
      const odds = heatOdds(c, at.item, a.strike);
      const cost = scaled(c, 0, heatCinders(at.item, odds.target));
      return { cost, error: cantAfford(c, cost), odds };
    }
    case 'temper': {
      const at = workable(c, a.uid);
      if (typeof at === 'string') return fail(at);
      const it = at.item;
      const g = itemAffixes(it)[a.affix];
      if (!g) return fail('Choose an affix to temper');
      const k = 1 + 0.35 * (it.tempers ?? 0);
      const rar = it.rarity === 'rare' ? 1.6 : it.rarity === 'magic' ? 1 : 2.5;
      const cost = scaled(c, (60 + it.ilvl * 25) * rar * k, (3 + tier(it)) * k);
      if (g.sealed) return fail('Ember-sealed: tempering cannot change it', cost);
      if (g.quenched) return fail('A quenched affix changes only by quenching again', cost);
      const ranges = legendRanges(it);
      if (ranges && !g.idx.some((i) => ranges[i]?.stat === it.mods[i].stat && ranges[i].min < ranges[i].max)) return fail('This property never varies', cost);
      return { cost, error: cantAfford(c, cost) };
    }
    case 'quench': {
      const at = workable(c, a.uid);
      if (typeof at === 'string') return fail(at);
      const cost = scaled(c, 0, 4 + 2 * tier(at.item), { [a.element]: 1 });
      const { def, replace } = quenchPlan(at.item, a.element);
      const best = describeMods(def.mods.map((md) => ({ stat: md.stat, value: md.max }))).join(', ');
      const note = `${replace ? `Converts "${replace.text}"` : 'Adds an affix'}: up to ${best}`;
      return { cost, error: cantAfford(c, cost), note };
    }
    case 'seal': {
      const at = workable(c, a.uid);
      if (typeof at === 'string') return fail(at);
      const it = at.item;
      const k = hasEmber(c) ? 0.5 : 1;
      const cost = scaled(c, (2000 + it.ilvl * 250) * k, 60 * k, { fire: 1, cold: 1, light: 1, poison: 1 });
      const lock = needRank(RECIPE_RANK.seal);
      if (lock) return fail(lock, cost);
      const affixes = itemAffixes(it);
      const g = affixes[a.affix];
      if (!g) return fail('Choose an affix to seal', cost);
      if (affixes.some((x) => x.sealed)) return fail('An item holds only one seal', cost);
      if (g.quenched) return fail('Quenched metal will not hold a seal', cost);
      return { cost, error: cantAfford(c, cost) };
    }
    case 'punch': {
      const at = workable(c, a.uid);
      if (typeof at === 'string') return fail(at);
      const it = at.item;
      const b = baseOf(it);
      const cost = scaled(c, (200 + 150 * tier(it)) * (it.sockets + 1), 12 * (it.sockets + 1));
      const lock = needRank(RECIPE_RANK.punch);
      if (lock) return fail(lock, cost);
      // Magic in the metal leaves room for a single socket; plain items take as many as the base allows.
      const max = it.rarity === 'normal' ? b.maxSockets ?? 0 : Math.min(1, b.maxSockets ?? 0);
      if (!max) return fail('This item cannot take a socket', cost);
      if (it.sockets >= max) return fail('No room for another socket', cost);
      return { cost, error: cantAfford(c, cost) };
    }
    case 'smelt': {
      const items = a.uids.map((uid) => c.inventory.find((e) => e.item.uid === uid)?.item);
      if (a.uids.length !== 3 || new Set(a.uids).size !== 3 || items.some((x) => !x)) return fail('Put three items from your backpack in the crucible');
      const its = items as Item[];
      const first = its[0];
      const kind = baseOf(first).kind;
      if (its.some((x) => !isEquipment(baseOf(x)))) return fail('Only weapons, armor and jewelry can be smelted');
      if (its.some((x) => !x.identified)) return fail('Have them identified first');
      if (its.some((x) => baseOf(x).kind !== kind || x.rarity !== first.rarity)) return fail('All three must be the same type and rarity');
      const sc = SMELT_COST[first.rarity];
      if (!sc) return fail('Set and unique items cannot be smelted further');
      const t = Math.max(...its.map(tier));
      const legend = first.rarity === 'rare';
      const cost = scaled(c, sc[0] * t, sc[1] * (0.75 + 0.25 * t), legend ? { fire: 1, cold: 1, light: 1, poison: 1 } : {});
      if (legend) {
        const lock = needRank(RECIPE_RANK.legend);
        if (lock) return fail(lock, cost);
        if (!legendRarity(kind, Math.max(...its.map((x) => x.ilvl)))) return fail('No legend of this kind can be forged from items this weak', cost);
      }
      return { cost, error: cantAfford(c, cost), note: `Makes one ${legend ? 'unique or set' : NEXT_RARITY[first.rarity]} ${KIND_NAMES[kind] ?? kind}` };
    }
  }
}

const KIND_NAMES: Partial<Record<ItemKind, string>> = {
  weapon: 'weapon', shield: 'shield', armor: 'body armor', helm: 'helm', gloves: 'gloves', boots: 'boots', belt: 'belt', ring: 'ring', amulet: 'amulet',
};

const SAY = {
  smith: {
    heat: ['Now that is work.', 'Hear it ring? That is a true edge.', 'Do not tell the others I let you near the good coals.'],
    max: ['Ten folds. I have made one of those in my life. Now you have too.'],
    crack: ['It happens. Steel has moods.', 'Too greedy with the heat. We go again.'],
    shatter: ['Gone. Sweep it up and do not look at me like that.'],
    legend: ['Three into one. I did not think it would take.'],
    temper: ['A cleaner line than the last. Keep that one.'],
    seal: ['Sealed. Nothing I own will shift it now.'],
    rank: ['You are getting the feel of it.'],
  },
  ember: {
    heat: ['Yes. Like that. I remember making things.', 'It holds. Good. So few things do.', 'Hotter than they would dare. Well struck.'],
    max: ['There. Nothing I ever forged burned so clean. Keep it lit.'],
    crack: ['It cracked. Let it rest. So did I, once.', 'Patience. The fire is not angry with you.'],
    shatter: ['Gone. I am sorry. Fire only ever takes what it is offered.'],
    legend: ['Three made one. That is all the star ever wanted, too.'],
    temper: ['A fine line. Whoever taught you patience, thank them.'],
    seal: ['Sealed. My fire will keep it, as it once kept worse.'],
    rank: ['You learn quickly. I had four hundred years and learned one thing.'],
  },
} as const;

function say(c: Character, rng: Rng, key: keyof (typeof SAY)['smith']): ForgeSuccess['say'] {
  const who = hasEmber(c) ? 'ember' : 'smith';
  return { who, text: rng.pick(SAY[who][key] as readonly string[] as string[]) };
}

function destroy(c: Character, uid: number) {
  if (removeFromGrid(c.inventory, uid)) return;
  for (const [slot, it] of Object.entries(c.equipment)) if (it?.uid === uid) delete c.equipment[slot as Slot];
}

function rollAffix(rng: Rng, def: Affix): Mod[] {
  return def.mods.map((md) => ({ stat: md.stat, value: rng.int(md.min, md.max) }));
}

/** Does one job at the forge: pays for it, changes the item and the hero's materials, and says how it went. */
export function forgeApply(c: Character, rng: Rng, a: ForgeAction): ForgeResult {
  const pre = forgePreview(c, a);
  if (pre.error) return { ok: false, error: pre.error };
  const rankBefore = forgeRank(c);
  let xp = 0;
  let res: ForgeSuccess;
  switch (a.type) {
    case 'salvage': {
      const item = locate(c, a.uid)!.item;
      const gained = salvageYield(c, item, rng);
      removeFromGrid(c.inventory, a.uid);
      gain(c, gained);
      xp = item.rarity === 'normal' ? 1 : item.rarity === 'magic' ? 2 : 3;
      res = { ok: true, type: a.type, text: `Salvaged ${displayName(item)}: ${materialsText(gained)}`, tone: 'plain', gained };
      break;
    }
    case 'salvageJunk': {
      const gained: Materials = { cinders: 0, essences: {} };
      let n = 0;
      for (const e of c.inventory.slice()) {
        if (!isJunk(e.item)) continue;
        gained.cinders += salvageYield(c, e.item, rng).cinders;
        removeFromGrid(c.inventory, e.item.uid);
        n++;
      }
      gain(c, gained);
      xp = n;
      res = { ok: true, type: a.type, text: `Salvaged ${n} plain item${n > 1 ? 's' : ''}: ${materialsText(gained)}`, tone: 'plain', gained };
      break;
    }
    case 'heat': {
      const item = locate(c, a.uid)!.item;
      const odds = pre.odds!;
      pay(c, pre.cost);
      const r = rng.next() * 100;
      if (r < odds.success) {
        item.forge = odds.target;
        xp = odds.target;
        const high = odds.target >= 7;
        res = {
          ok: true, type: a.type, outcome: 'success', item, tone: high ? 'great' : 'good',
          text: `The metal takes the heat: ${displayName(item)}`,
          say: odds.target >= MAX_FORGE_LEVEL ? say(c, rng, 'max') : high ? say(c, rng, 'heat') : undefined,
        };
      } else if (r < odds.success + odds.shatter) {
        const name = displayName(item);
        const gained: Materials = { cinders: Math.max(1, Math.floor(salvageYield(c, item).cinders / 2)), essences: {} };
        destroy(c, a.uid);
        gain(c, gained);
        xp = Math.ceil(odds.target / 2);
        res = { ok: true, type: a.type, outcome: 'shatter', tone: 'bad', gained, text: `${name} shatters on the anvil! (${materialsText(gained)} swept up)`, say: say(c, rng, 'shatter') };
      } else {
        item.forge = Math.max(0, forgeLevel(item) - 1) || undefined;
        xp = Math.ceil(odds.target / 2);
        res = { ok: true, type: a.type, outcome: 'crack', item, tone: 'bad', text: `The metal cracks: ${displayName(item)}`, say: say(c, rng, 'crack') };
      }
      break;
    }
    case 'temper': {
      const item = locate(c, a.uid)!.item;
      const g = itemAffixes(item)[a.affix];
      const before = g.text;
      const ranges = legendRanges(item);
      let great = false;
      if (ranges) {
        // Uniques and set pieces keep their properties; tempering re-rolls one within its range.
        great = true;
        for (const i of g.idx) {
          const rg = ranges[i];
          if (rg?.stat !== item.mods[i].stat) continue;
          item.mods[i].value = rng.int(rg.min, rg.max);
          if (item.mods[i].value < rg.max) great = false;
        }
      } else {
        const b = baseOf(item);
        const taken = new Set(item.mods.filter((_, i) => !g.idx.includes(i)).map((md) => md.stat));
        const pool = AFFIXES.filter((af) => af.lvl <= item.ilvl && affixFits(af, b) && !af.mods.some((md) => taken.has(md.stat)));
        if (!pool.length) return { ok: false, error: 'Nothing else can be drawn out of this metal' };
        let def = pool[0];
        let mods: Mod[] = [];
        for (let tries = 0; tries < 8; tries++) {
          def = rng.weighted(pool.map((v) => ({ w: (v.w ?? 10) * (1 + v.lvl / Math.max(4, item.ilvl)), v })));
          mods = rollAffix(rng, def);
          if (describeMods(mods).join() !== before) break;
        }
        item.mods.splice(g.idx[0], g.idx.length, ...mods);
        renameMagic(item, new Map([[g.idx[0], def]]));
        const top = Math.max(...pool.filter((x) => x.group === def.group).map((x) => x.lvl));
        const m0 = def.mods[def.mods.length - 1];
        great = def.lvl === top && def.lvl >= item.ilvl * 0.5 && mods[mods.length - 1].value >= m0.min + (m0.max - m0.min) * 0.75;
      }
      pay(c, pre.cost);
      item.tempers = (item.tempers ?? 0) + 1;
      xp = 3;
      const now = itemAffixes(item).find((x) => x.idx[0] === g.idx[0])?.text ?? '';
      res = { ok: true, type: a.type, item, tone: great ? 'great' : 'good', text: `Tempered: ${before} → ${now}`, say: great ? say(c, rng, 'temper') : undefined };
      break;
    }
    case 'quench': {
      const item = locate(c, a.uid)!.item;
      const { def, replace } = quenchPlan(item, a.element);
      const mods = rollAffix(rng, def);
      // An affix the item was born with stays an ordinary affix; one the forge added stays marked.
      if (!replace || replace.quenched) for (const md of mods) md.quenched = true;
      if (replace) item.mods.splice(replace.idx[0], replace.idx.length, ...mods);
      else item.mods.push(...mods);
      if (replace && !replace.quenched) renameMagic(item);
      pay(c, pre.cost);
      xp = 3;
      res = { ok: true, type: a.type, item, tone: 'good', text: `Quenched in ${ESSENCE_NAMES[a.element]} Essence: ${describeMods(mods).join(', ')}` };
      break;
    }
    case 'seal': {
      const item = locate(c, a.uid)!.item;
      const g = itemAffixes(item)[a.affix];
      for (const md of g.mods) md.sealed = true;
      pay(c, pre.cost);
      xp = 12;
      res = { ok: true, type: a.type, item, tone: 'great', text: `Ember-sealed: ${g.text}`, say: say(c, rng, 'seal') };
      break;
    }
    case 'punch': {
      const item = locate(c, a.uid)!.item;
      item.sockets++;
      pay(c, pre.cost);
      xp = 5;
      res = { ok: true, type: a.type, item, tone: 'good', text: `Punched a socket: ${displayName(item)}` };
      break;
    }
    case 'smelt': {
      const its = a.uids.map((uid) => c.inventory.find((e) => e.item.uid === uid)!.item);
      const kind = baseOf(its[0]).kind;
      const ilvl = Math.max(...its.map((x) => x.ilvl));
      const legend = its[0].rarity === 'rare';
      const rarity = legend ? legendRarity(kind, ilvl)! : NEXT_RARITY[its[0].rarity]!;
      // Lesser smelts keep the finest of the three bases, so the player chooses what comes out.
      const best = its.reduce((p, x) => (baseOf(x).qlvl > baseOf(p).qlvl ? x : p));
      const made = generateItem(rng, ilvl, { rarity, kinds: [kind], classId: c.classId, base: legend ? undefined : best.base });
      made.identified = true;
      const backup = c.inventory.slice();
      for (const uid of a.uids) removeFromGrid(c.inventory, uid);
      if (!addToInventory(c, made)) {
        c.inventory.splice(0, c.inventory.length, ...backup);
        return { ok: false, error: 'No room in your backpack for what comes out' };
      }
      pay(c, pre.cost);
      xp = legend ? 12 : its[0].rarity === 'magic' ? 6 : 4;
      res = { ok: true, type: a.type, item: made, tone: legend ? 'great' : 'good', text: `Smelted: ${displayName(made)}`, say: legend ? say(c, rng, 'legend') : undefined };
      break;
    }
  }
  c.forge.xp += Math.max(1, Math.round(xp * forgeModifiers(c).mastery));
  const rank = forgeRank(c);
  if (rank > rankBefore) {
    res.rankUp = MASTERY_RANKS[rank];
    res.say ??= say(c, rng, 'rank');
  }
  return res;
}
