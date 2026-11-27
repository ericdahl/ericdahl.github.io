import { CLASSES, ARMOR_MUL, WEAPONS, weaponDps, armorAf, mobHp, mobDps, STATS, type ClassId, type MobDef, type StatId } from './data';
import type { Item, Slot } from './items';
import type { Weapon } from './types';

const SLOT_AF: Record<string, number> = { helm: 0.16, chest: 0.3, legs: 0.24, hands: 0.14, feet: 0.16 };

export interface Derived {
  stats: Record<StatId, number>;
  maxHp: number;
  maxPower: number;
  weapon: Weapon;
  af: number;
  parry: number;
  block: number;
  evade: number;
  shield: boolean;
}

export function classDerived(cls: ClassId, level: number, gear?: Partial<Record<Slot, Item>>): Derived {
  const def = CLASSES[cls];
  const stats = {} as Record<StatId, number>;
  for (const s of STATS) stats[s] = def.base[s] + def.growth[s] * (level - 1);
  let hpBonus = 0;
  let af = 0;
  let wdps = weaponDps(level, 0.93);
  if (gear) {
    for (const it of Object.values(gear)) {
      if (!it) continue;
      for (const s of STATS) stats[s] += it.bonuses[s] ?? 0;
      hpBonus += it.bonuses.hp ?? 0;
      // Outgrown gear still counts for three-quarters of what your level deserves,
      // so a hero who never shops is weaker, not helpless.
      if (it.slot !== 'weapon') af += Math.max(it.af ?? 0, armorAf(level, 0.75)) * (SLOT_AF[it.slot] ?? 0.2);
    }
    wdps = Math.max(gear.weapon?.dps ?? 0, weaponDps(level, 0.75));
  } else {
    af = armorAf(level, 0.93);
  }
  af *= ARMOR_MUL[def.armor];
  const w = WEAPONS[def.weapon];
  const maxHp = Math.round(50 + def.hpPerLevel * level + (stats.con - 40) * 2 + hpBonus);
  const ps = def.powerStat;
  const maxPower = ps ? Math.round(30 + level * 9 + (stats[ps] - 50) * 0.8) : 0;
  return {
    stats, maxHp, maxPower,
    weapon: { kind: def.weapon, dps: wdps, speed: w.speed, range: w.range, ranged: !!w.ranged },
    af,
    parry: def.parry, block: def.block, evade: def.evade + Math.max(0, stats.dex - 50) / 1500,
    shield: def.block > 0,
  };
}

export function mobDerived(def: MobDef, level: number, hpMul = 1): Derived {
  const w = WEAPONS[def.weapon];
  const stats = { str: 50, con: 50, dex: 50, int: 50, pie: 50 };
  return {
    stats,
    maxHp: Math.round(mobHp(level) * def.hp * hpMul),
    maxPower: def.caster ? 100 : 0,
    weapon: { kind: def.weapon, dps: mobDps(level) * def.dmg, speed: w.speed, range: def.ranged ? 28 : w.range * Math.max(1, def.scale * 0.8), ranged: !!def.ranged },
    af: armorAf(level) * 0.6 * (def.armor ?? 1),
    parry: def.shape === 'humanoid' ? 0.05 : 0, block: 0, evade: def.shape === 'quadruped' ? 0.06 : 0.03,
    shield: false,
  };
}
