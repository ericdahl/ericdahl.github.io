import type { Rng } from './rng';

/**
 * Hirelings: one companion a hero can pay for at the captain in any town.
 * They fight at the hero's level, follow between areas, and are brought back for a fee if they fall.
 */
export type HireKind = 'guard' | 'archer' | 'mage';
export const HIRE_KINDS: HireKind[] = ['guard', 'archer', 'mage'];

export interface HireDef {
  kind: HireKind;
  /** The monster definition the hireling fights as. */
  def: string;
  title: string;
  desc: string;
  names: string[];
}

export const HIRELINGS: Record<HireKind, HireDef> = {
  guard: {
    kind: 'guard', def: 'hire_guard', title: 'Shieldbearer',
    desc: 'Sword and shield. Tough, and stands between you and whatever is coming. Good company for anyone who fights from a distance.',
    names: ['Aldric', 'Brenna', 'Corwen', 'Dunstan', 'Edda', 'Garrick', 'Hesper', 'Ivo'],
  },
  archer: {
    kind: 'archer', def: 'hire_archer', title: 'Bowman',
    desc: 'Shoots from behind you and keeps shooting. Fragile up close. Good company for anyone who fights in the thick of it.',
    names: ['Ashlin', 'Bram', 'Calla', 'Derrow', 'Fenn', 'Isolde', 'Joss', 'Maren'],
  },
  mage: {
    kind: 'mage', def: 'hire_mage', title: 'Ember-Keeper',
    desc: 'Throws fire, which burns what it hits. Carries a coal of their own: in the cold, standing close to them is a little warm.',
    names: ['Ansel', 'Brigid', 'Cinna', 'Emrys', 'Hale', 'Liss', 'Orrin', 'Tamsin'],
  },
};

/** What is kept on the hero: who they hired, and whether that person is waiting to be brought back. */
export interface HirelingState {
  kind: HireKind;
  name: string;
  dead?: boolean;
}

export function hireCost(level: number): number {
  return 150 + level * 60;
}

export function reviveCost(level: number): number {
  return 50 + level * 20;
}

export function hirelingName(kind: HireKind, rng: Rng): string {
  return rng.pick(HIRELINGS[kind].names);
}
