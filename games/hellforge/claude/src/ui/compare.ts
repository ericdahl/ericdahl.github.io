import { computeStats, slotsFor, type Buffs, type Character, type Stats } from '../game/character';
import { baseOf, type Item, type Slot } from '../game/items';

export interface StatChange {
  label: string;
  before: string;
  after: string;
  /** Positive when the swap is an improvement. */
  better: number;
}

export interface Comparison {
  /** The slot the item would go into. */
  slot: Slot;
  /** Items that would come off: the slot's item, plus a shield for a two-hander (or a two-hander for a shield). */
  replaced: Item[];
  changes: StatChange[];
}

/** The slot an item would be equipped into by default: a free one, else the first. */
export function defaultSlot(c: Character, item: Item): Slot | null {
  const slots = slotsFor(item);
  if (!slots.length) return null;
  return slots.find((s) => !c.equipment[s]) ?? slots[0];
}

/** What wearing `item` in `slot` would change, compared with the current gear. */
export function compareEquip(c: Character, item: Item, slot: Slot, buffs: Buffs = {}): Comparison {
  const b = baseOf(item);
  const eq = { ...c.equipment };
  const replaced: Item[] = [];
  const take = (s: Slot) => {
    if (eq[s]) replaced.push(eq[s]!);
    delete eq[s];
  };
  take(slot);
  if (b.twoHanded) take('offhand');
  if (b.kind === 'shield' && eq.weapon && baseOf(eq.weapon).twoHanded) take('weapon');
  eq[slot] = item;
  const now = computeStats(c, buffs);
  const next = computeStats({ ...c, equipment: eq }, buffs);
  return { slot, replaced, changes: statChanges(now, next) };
}

const pct = (v: number) => `${Math.round(v)}%`;
const int = (v: number) => String(Math.round(v));

/** Stats worth showing, in tooltip order. `lower` marks stats where less is better. */
const ROWS: { label: string; get: (s: Stats) => number; fmt?: (v: number, s: Stats) => string; lower?: boolean }[] = [
  { label: 'Damage', get: (s) => (s.minDmg + s.maxDmg) / 2, fmt: (_, s) => `${s.minDmg}-${s.maxDmg}` },
  { label: 'Attack Speed', get: (s) => s.attackSpeed, fmt: (v) => `${v.toFixed(2)}/s` },
  { label: 'Attack Rating', get: (s) => s.ar },
  { label: 'Fire Damage', get: (s) => (s.fireMin + s.fireMax) / 2, fmt: (_, s) => `${s.fireMin}-${s.fireMax}` },
  { label: 'Cold Damage', get: (s) => (s.coldMin + s.coldMax) / 2, fmt: (_, s) => `${s.coldMin}-${s.coldMax}` },
  { label: 'Lightning Damage', get: (s) => (s.lightMin + s.lightMax) / 2, fmt: (_, s) => `${s.lightMin}-${s.lightMax}` },
  { label: 'Poison Damage', get: (s) => s.poisonDmg },
  { label: 'Defense', get: (s) => s.def },
  { label: 'Block', get: (s) => s.block, fmt: pct },
  { label: 'Life', get: (s) => s.maxLife },
  { label: 'Mana', get: (s) => s.maxMana },
  { label: '+Skills', get: (s) => s.skillBonus },
  { label: 'Strength', get: (s) => s.str },
  { label: 'Dexterity', get: (s) => s.dex },
  { label: 'Vitality', get: (s) => s.vit },
  { label: 'Energy', get: (s) => s.ene },
  { label: 'Fire Resist', get: (s) => s.res.fire, fmt: pct },
  { label: 'Cold Resist', get: (s) => s.res.cold, fmt: pct },
  { label: 'Lightning Resist', get: (s) => s.res.light, fmt: pct },
  { label: 'Poison Resist', get: (s) => s.res.poison, fmt: pct },
  { label: 'Critical Strike', get: (s) => s.crit, fmt: pct },
  { label: 'Life Stolen', get: (s) => s.lifeSteal, fmt: pct },
  { label: 'Mana Stolen', get: (s) => s.manaSteal, fmt: pct },
  { label: 'Cast Time', get: (s) => s.castTime, fmt: (v) => `${v.toFixed(2)}s`, lower: true },
  { label: 'Run Speed', get: (s) => s.moveSpeed, fmt: (v) => v.toFixed(1) },
  { label: 'Damage Reduced', get: (s) => s.dmgReduce },
  { label: 'Thorns', get: (s) => s.thorns },
  { label: 'Life Regen', get: (s) => s.lifeRegen },
  { label: 'Life per Kill', get: (s) => s.lifeOnKill },
  { label: 'Mana per Kill', get: (s) => s.manaOnKill },
  { label: 'Magic Find', get: (s) => s.mf, fmt: pct },
  { label: 'Gold Find', get: (s) => s.gf, fmt: pct },
  { label: 'Potion Belt Rows', get: (s) => s.beltRows },
];

export function statChanges(now: Stats, next: Stats): StatChange[] {
  const out: StatChange[] = [];
  for (const r of ROWS) {
    const a = r.get(now);
    const b = r.get(next);
    const fmt = r.fmt ?? int;
    const before = fmt(a, now);
    const after = fmt(b, next);
    if (before === after) continue;
    out.push({ label: r.label, before, after, better: r.lower ? a - b : b - a });
  }
  return out;
}
