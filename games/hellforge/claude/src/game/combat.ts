import type { Resists } from './monsters';
import type { Rng } from './rng';

export interface Damage {
  phys: number;
  fire: number;
  cold: number;
  light: number;
  poison: number;
}

export const ZERO_DAMAGE: Damage = { phys: 0, fire: 0, cold: 0, light: 0, poison: 0 };

/** Classic ARPG to-hit: AR vs defense, scaled by the level ratio, clamped to 5..95%. */
export function hitChance(ar: number, def: number, attackerLvl: number, defenderLvl: number): number {
  const c = 2 * (ar / Math.max(1, ar + def)) * (attackerLvl / Math.max(1, attackerLvl + defenderLvl));
  return Math.min(0.95, Math.max(0.05, c));
}

export function resisted(amount: number, res: number): number {
  return amount * (1 - Math.min(res, 100) / 100);
}

/** Total damage after resistances. Poison is dealt separately over time. */
export function applyResists(d: Damage, res: Resists): { total: number; poison: number } {
  const total = resisted(d.phys, res.phys) + resisted(d.fire, res.fire) + resisted(d.cold, res.cold) + resisted(d.light, res.light);
  return { total: Math.max(0, total), poison: Math.max(0, resisted(d.poison, res.poison)) };
}

export function roll(rng: Rng, min: number, max: number): number {
  if (max <= min) return min;
  return rng.range(min, max);
}

export function scaleDamage(d: Damage, k: number): Damage {
  return { phys: d.phys * k, fire: d.fire * k, cold: d.cold * k, light: d.light * k, poison: d.poison * k };
}

/** Physical damage reduction against the player from flat "damage reduced by". */
export function reducePhysical(phys: number, flat: number): number {
  return Math.max(phys > 0 ? 1 : 0, phys - flat);
}
