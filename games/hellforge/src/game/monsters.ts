import { Rng } from './rng';
import type { Element } from './skills';

export type MonsterShape =
  | 'imp' | 'hexer' | 'ghoul' | 'skeleton' | 'archer' | 'bat' | 'hound' | 'brute' | 'wraith' | 'cultist'
  | 'glutton' | 'bishop' | 'warden' | 'mother'
  | 'scarab' | 'scorpion' | 'burrower' | 'kite' | 'mummy' | 'raider' | 'acolyte' | 'mirage' | 'colossus'
  | 'corvin' | 'noon';
export type MonsterAI = 'melee' | 'ranged' | 'caster' | 'bat' | 'hexer' | 'boss' | 'burrow';

export interface Resists {
  phys: number;
  fire: number;
  cold: number;
  light: number;
  poison: number;
}

export type BossAbility =
  | 'nova_fire' | 'nova_cold' | 'fire_spread' | 'summon_imps' | 'summon_skeletons' | 'charge' | 'meteor_rain'
  | 'poison_spray' | 'summon_scarabs' | 'burrow_strike' | 'summon_kites' | 'corpse_feast' | 'sun_lance'
  | 'summon_mummies' | 'raise_dead' | 'mirage_split' | 'summon_acolytes' | 'noon_burst';

/** A boss stage, entered once life falls to `at` (0..1 of maximum). */
export interface BossPhase {
  at: number;
  abilities: BossAbility[];
  line: string;
  name?: string;
  shape?: MonsterShape;
  color?: string;
}

export interface MonsterDef {
  id: string;
  name: string;
  shape: MonsterShape;
  ai: MonsterAI;
  lifeMul: number;
  dmgMul: number;
  speed: number;
  radius: number;
  /** Melee reach beyond touching, or missile range for ranged AIs. */
  range: number;
  attackRate: number;
  xpMul: number;
  res: Partial<Resists>;
  element?: Element;
  missile?: { element: Element; speed: number; kind: string };
  flees?: boolean;
  undead?: boolean;
  scale: number;
  color: string;
  abilities?: BossAbility[];
  phases?: BossPhase[];
  /** Bursts into this many shards when killed. */
  burst?: number;
  /** Gets back up once, unless burned to death or its corpse is used. */
  rises?: boolean;
  /** Wards nearby allies with an absorbing shield. */
  support?: boolean;
  /** Splits into harmless copies on first sight of the player. */
  mirage?: boolean;
  /** Dives on corpses to heal. */
  feeds?: boolean;
  /** Winds up a telegraphed ground slam. */
  slam?: boolean;
  /** Packs of this monster are led by one of it and followed by these. */
  pack?: string;
}

const D = (d: Omit<MonsterDef, 'res' | 'scale'> & { res?: Partial<Resists>; scale?: number }): MonsterDef => ({ res: {}, scale: 1, ...d });

export const MONSTERS: Record<string, MonsterDef> = {
  imp: D({ id: 'imp', name: 'Cinder Imp', shape: 'imp', ai: 'melee', lifeMul: 0.55, dmgMul: 0.65, speed: 3.3, radius: 0.3, range: 0.45, attackRate: 1.3, xpMul: 0.7, flees: true, res: { fire: 25 }, scale: 0.8, color: '#b8452c' }),
  hexer: D({ id: 'hexer', name: 'Imp Hexer', shape: 'hexer', ai: 'hexer', lifeMul: 0.6, dmgMul: 0.8, speed: 2.8, radius: 0.32, range: 7, attackRate: 0.5, xpMul: 1.3, missile: { element: 'fire', speed: 7, kind: 'm_fire' }, res: { fire: 40 }, scale: 0.85, color: '#c86b2c' }),
  ghoul: D({ id: 'ghoul', name: 'Rotting Ghoul', shape: 'ghoul', ai: 'melee', lifeMul: 1.5, dmgMul: 1.15, speed: 1.5, radius: 0.38, range: 0.5, attackRate: 0.9, xpMul: 1.1, undead: true, res: { poison: 50 }, color: '#7d8f4e' }),
  skeleton: D({ id: 'skeleton', name: 'Bonewalker', shape: 'skeleton', ai: 'melee', lifeMul: 0.9, dmgMul: 1.0, speed: 2.4, radius: 0.33, range: 0.55, attackRate: 1.1, xpMul: 1.0, undead: true, res: { poison: 75, cold: 25 }, color: '#d8d0b8' }),
  archer: D({ id: 'archer', name: 'Bone Archer', shape: 'archer', ai: 'ranged', lifeMul: 0.75, dmgMul: 0.85, speed: 2.2, radius: 0.33, range: 8, attackRate: 0.7, xpMul: 1.2, undead: true, missile: { element: 'phys', speed: 11, kind: 'm_arrow' }, res: { poison: 75 }, color: '#cfc4a5' }),
  bat: D({ id: 'bat', name: 'Gloom Bat', shape: 'bat', ai: 'bat', lifeMul: 0.45, dmgMul: 0.6, speed: 4.4, radius: 0.28, range: 0.4, attackRate: 1.6, xpMul: 0.8, element: 'light', res: { light: 50 }, scale: 0.9, color: '#5b4a6e' }),
  hound: D({ id: 'hound', name: 'Ashen Hound', shape: 'hound', ai: 'melee', lifeMul: 0.85, dmgMul: 0.9, speed: 4.0, radius: 0.36, range: 0.45, attackRate: 1.5, xpMul: 1.0, res: { fire: 30 }, color: '#6e5a4a' }),
  brute: D({ id: 'brute', name: 'Pit Brute', shape: 'brute', ai: 'melee', lifeMul: 2.6, dmgMul: 1.9, speed: 1.7, radius: 0.55, range: 0.7, attackRate: 0.65, xpMul: 2.2, res: { phys: 15 }, scale: 1.35, color: '#8a5d48' }),
  wraith: D({ id: 'wraith', name: 'Hollow Wraith', shape: 'wraith', ai: 'melee', lifeMul: 0.9, dmgMul: 0.9, speed: 2.6, radius: 0.34, range: 0.55, attackRate: 1.0, xpMul: 1.4, element: 'cold', undead: true, res: { phys: 40, cold: 50, poison: 100 }, color: '#9fb7d9' }),
  cultist: D({ id: 'cultist', name: 'Ash Cultist', shape: 'cultist', ai: 'caster', lifeMul: 0.8, dmgMul: 1.0, speed: 2.3, radius: 0.33, range: 7, attackRate: 0.45, xpMul: 1.5, missile: { element: 'light', speed: 9, kind: 'm_light' }, res: { light: 40, fire: 20 }, color: '#5c3b6b' }),

  glutton: D({ id: 'glutton', name: 'Gorvath the Glutton', shape: 'glutton', ai: 'boss', lifeMul: 8, dmgMul: 1.5, speed: 1.9, radius: 0.7, range: 0.8, attackRate: 0.8, xpMul: 8, res: { phys: 20, poison: 60 }, scale: 1.6, color: '#7c6a3e', abilities: ['charge'] }),
  bishop: D({ id: 'bishop', name: 'The Drowned Bishop', shape: 'bishop', ai: 'boss', lifeMul: 11, dmgMul: 1.6, speed: 2.2, radius: 0.5, range: 6, attackRate: 0.7, xpMul: 12, undead: true, element: 'cold', missile: { element: 'cold', speed: 8, kind: 'm_cold' }, res: { cold: 75, poison: 100, fire: -20 }, scale: 1.35, color: '#4c7a8a', abilities: ['nova_cold', 'summon_skeletons'] }),
  warden: D({ id: 'warden', name: 'Ossuary Warden Krell', shape: 'warden', ai: 'boss', lifeMul: 13, dmgMul: 2.4, speed: 2.4, radius: 0.6, range: 0.8, attackRate: 0.9, xpMul: 14, undead: true, element: 'cold', res: { phys: 30, cold: 60, poison: 100 }, scale: 1.55, color: '#d8d3c2', abilities: ['charge', 'summon_skeletons'] }),
  // Necromancer servants (never spawned as enemies).
  raised_skeleton: D({ id: 'raised_skeleton', name: 'Skeleton', shape: 'skeleton', ai: 'melee', lifeMul: 0.9, dmgMul: 0.75, speed: 3.8, radius: 0.3, range: 0.55, attackRate: 1.2, xpMul: 0, undead: true, res: { poison: 50 }, color: '#ece6d2' }),
  grave_golem: D({ id: 'grave_golem', name: 'Grave Golem', shape: 'brute', ai: 'melee', lifeMul: 3.0, dmgMul: 1.0, speed: 3.6, radius: 0.5, range: 0.7, attackRate: 0.85, xpMul: 0, res: { poison: 100, phys: 10 }, scale: 1.2, color: '#6e5a44' }),
  mother: D({ id: 'mother', name: 'Vhorza, Mother of Cinders', shape: 'mother', ai: 'boss', lifeMul: 30, dmgMul: 2.6, speed: 2.3, radius: 0.9, range: 1.0, attackRate: 0.8, xpMul: 40, element: 'fire', missile: { element: 'fire', speed: 8, kind: 'm_fire' }, res: { fire: 75, poison: 30, light: 20, cold: 10 }, scale: 2.1, color: '#c23b1f', abilities: ['fire_spread', 'nova_fire', 'summon_imps', 'meteor_rain'] }),

  // ------------------------------------------------------------ Act 2: The Glass Sea
  jackal: D({ id: 'jackal', name: 'Dust Jackal', shape: 'hound', ai: 'melee', lifeMul: 0.8, dmgMul: 0.85, speed: 4.3, radius: 0.34, range: 0.45, attackRate: 1.6, xpMul: 0.95, res: { fire: 15 }, color: '#a8875a' }),
  scarab: D({ id: 'scarab', name: 'Glass Scarab', shape: 'scarab', ai: 'melee', lifeMul: 0.42, dmgMul: 0.55, speed: 3.7, radius: 0.27, range: 0.4, attackRate: 1.4, xpMul: 0.65, burst: 5, res: { fire: 20, cold: -15 }, scale: 0.85, color: '#3fa6a0' }),
  raider: D({ id: 'raider', name: 'Glassfoot Raider', shape: 'raider', ai: 'ranged', lifeMul: 0.85, dmgMul: 0.95, speed: 2.6, radius: 0.33, range: 8, attackRate: 0.75, xpMul: 1.2, missile: { element: 'phys', speed: 11.5, kind: 'm_arrow' }, color: '#8a6a44' }),
  kite: D({ id: 'kite', name: 'Carrion Kite', shape: 'kite', ai: 'bat', lifeMul: 0.6, dmgMul: 0.75, speed: 4.2, radius: 0.3, range: 0.45, attackRate: 1.3, xpMul: 0.9, feeds: true, res: { poison: 30 }, color: '#4e4238' }),
  scorpion: D({ id: 'scorpion', name: 'Cistern Scorpion', shape: 'scorpion', ai: 'melee', lifeMul: 1.15, dmgMul: 1.0, speed: 2.7, radius: 0.42, range: 0.6, attackRate: 1.0, xpMul: 1.2, element: 'poison', res: { poison: 75, phys: 10 }, color: '#5c4a2e' }),
  burrower: D({ id: 'burrower', name: 'Dune Burrower', shape: 'burrower', ai: 'burrow', lifeMul: 1.6, dmgMul: 1.3, speed: 2.5, radius: 0.5, range: 0.7, attackRate: 0.85, xpMul: 1.7, res: { phys: 15, cold: -20 }, scale: 1.15, color: '#b08a58' }),
  mirage: D({ id: 'mirage', name: 'Mirage Dancer', shape: 'mirage', ai: 'caster', lifeMul: 0.7, dmgMul: 1.05, speed: 2.8, radius: 0.33, range: 7, attackRate: 0.55, xpMul: 1.6, mirage: true, missile: { element: 'fire', speed: 9, kind: 'm_sun' }, res: { light: 30 }, color: '#d8a24a' }),
  mummy: D({ id: 'mummy', name: 'Embalmed Dead', shape: 'mummy', ai: 'melee', lifeMul: 1.35, dmgMul: 1.05, speed: 1.8, radius: 0.36, range: 0.55, attackRate: 0.95, xpMul: 1.15, undead: true, rises: true, res: { poison: 100, fire: -30 }, color: '#c8b892' }),
  acolyte: D({ id: 'acolyte', name: 'Noon Acolyte', shape: 'acolyte', ai: 'caster', lifeMul: 0.85, dmgMul: 0.9, speed: 2.3, radius: 0.33, range: 7, attackRate: 0.5, xpMul: 1.6, support: true, pack: 'mummy', missile: { element: 'fire', speed: 8, kind: 'm_sun' }, res: { fire: 40, light: 20 }, color: '#c08a2a' }),
  colossus: D({ id: 'colossus', name: 'Salt Colossus', shape: 'colossus', ai: 'melee', lifeMul: 2.9, dmgMul: 1.9, speed: 1.55, radius: 0.58, range: 0.75, attackRate: 0.6, xpMul: 2.3, slam: true, res: { phys: 25, poison: 100, cold: 25 }, scale: 1.4, color: '#d8d4c8' }),
  shade: D({ id: 'shade', name: 'Glassbound Shade', shape: 'wraith', ai: 'melee', lifeMul: 0.95, dmgMul: 1.0, speed: 2.9, radius: 0.34, range: 0.55, attackRate: 1.05, xpMul: 1.4, element: 'fire', undead: true, res: { phys: 40, fire: 40, poison: 100 }, color: '#e8b860' }),

  skarn: D({ id: 'skarn', name: 'Skarn, Tyrant of the Cistern', shape: 'scorpion', ai: 'boss', lifeMul: 12, dmgMul: 1.7, speed: 2.5, radius: 0.85, range: 0.9, attackRate: 0.9, xpMul: 14, element: 'poison', res: { poison: 75, phys: 20 }, scale: 2.2, color: '#3e6a32',
    abilities: ['poison_spray', 'summon_scarabs'],
    phases: [{ at: 0.5, abilities: ['poison_spray', 'summon_scarabs', 'burrow_strike'], line: 'Skarn tears down into the stone!' }] }),
  karrik: D({ id: 'karrik', name: 'Karrik, the Carrion King', shape: 'kite', ai: 'boss', lifeMul: 14, dmgMul: 1.9, speed: 3.2, radius: 0.75, range: 0.8, attackRate: 1.0, xpMul: 16, res: { poison: 40, light: -15 }, scale: 2.5, color: '#3a2f2a',
    abilities: ['charge', 'summon_kites'],
    phases: [{ at: 0.55, abilities: ['charge', 'summon_kites', 'corpse_feast'], line: 'Karrik shrieks for carrion!' }] }),
  embalmer: D({ id: 'embalmer', name: 'Vizier Ohm-Tet, the Embalmer', shape: 'mummy', ai: 'boss', lifeMul: 16, dmgMul: 1.75, speed: 2.1, radius: 0.6, range: 6.5, attackRate: 0.75, xpMul: 20, undead: true, element: 'fire', missile: { element: 'fire', speed: 8, kind: 'm_sun' }, res: { poison: 100, fire: 20, phys: 15 }, scale: 1.75, color: '#d8c068',
    abilities: ['summon_mummies', 'sun_lance'],
    phases: [{ at: 0.5, abilities: ['summon_mummies', 'raise_dead', 'sun_lance', 'nova_fire'], line: '"Rise. Rise, all of you. The Queen has need of us."' }] }),
  corvin: D({ id: 'corvin', name: 'Old Corvin', shape: 'corvin', ai: 'boss', lifeMul: 28, dmgMul: 1.9, speed: 2.5, radius: 0.5, range: 7, attackRate: 0.85, xpMul: 50, element: 'cold', missile: { element: 'cold', speed: 9, kind: 'm_cold' }, res: { fire: 30, cold: 30, light: 30, poison: 20 }, scale: 1.3, color: '#4a5068',
    abilities: ['nova_cold', 'mirage_split', 'sun_lance'],
    phases: [
      { at: 0.62, name: 'Corvane, Noon-Risen', shape: 'noon', color: '#e8a838', abilities: ['sun_lance', 'nova_fire', 'meteor_rain', 'summon_acolytes'], line: '"Enough of the old man. Look upon a Dialist of Imhara."' },
      { at: 0.28, name: 'Corvane, the Hollow Sun', shape: 'noon', color: '#fff0b0', abilities: ['noon_burst', 'sun_lance', 'meteor_rain', 'noon_burst'], line: '"It is noon. It is always noon. Find what shade you can."' },
    ] }),
};

export type MonsterRarity = 'normal' | 'champion' | 'unique' | 'minion' | 'boss';
export type UniqueMod = 'fast' | 'strong' | 'stoneskin' | 'fireEnch' | 'coldEnch' | 'vampiric' | 'extraLife';
export const UNIQUE_MODS: UniqueMod[] = ['fast', 'strong', 'stoneskin', 'fireEnch', 'coldEnch', 'vampiric', 'extraLife'];
export const MOD_LABEL: Record<UniqueMod, string> = {
  fast: 'Extra Fast', strong: 'Extra Strong', stoneskin: 'Stone Skin', fireEnch: 'Fire Enchanted',
  coldEnch: 'Cold Enchanted', vampiric: 'Vampiric', extraLife: 'Extra Health',
};

export interface MonsterStats {
  life: number;
  dmgMin: number;
  dmgMax: number;
  ar: number;
  def: number;
  speed: number;
  xp: number;
  res: Resists;
}

export function baseLife(mlvl: number): number {
  return 7 + mlvl * 4 + mlvl * mlvl * 0.25;
}

export function baseDamage(mlvl: number): number {
  return 1.2 + mlvl * 1.15 + mlvl * mlvl * 0.045;
}

export function monsterStats(def: MonsterDef, mlvl: number, rarity: MonsterRarity, mods: UniqueMod[] = [], difficulty = 0): MonsterStats {
  const rarLife = { normal: 1, minion: 1.6, champion: 3, unique: 4, boss: 1 }[rarity];
  const rarDmg = { normal: 1, minion: 1.25, champion: 1.5, unique: 1.6, boss: 1 }[rarity];
  const rarXp = { normal: 1, minion: 2, champion: 3, unique: 5, boss: 1 }[rarity];
  let life = baseLife(mlvl) * def.lifeMul * rarLife * (1 + difficulty * 0.5);
  let dmg = baseDamage(mlvl) * def.dmgMul * rarDmg;
  let speed = def.speed * (rarity === 'champion' ? 1.2 : 1);
  let defense = 5 + mlvl * 8;
  const res: Resists = { phys: 0, fire: 0, cold: 0, light: 0, poison: 0, ...def.res };
  for (const md of mods) {
    if (md === 'fast') speed *= 1.45;
    if (md === 'strong') dmg *= 1.8;
    if (md === 'stoneskin') (defense *= 3), (res.phys = Math.min(75, res.phys + 40));
    if (md === 'extraLife') life *= 1.6;
    if (md === 'fireEnch') res.fire = Math.min(100, res.fire + 50);
    if (md === 'coldEnch') res.cold = Math.min(100, res.cold + 50);
  }
  // Higher difficulties grant immunities on some already-resistant monsters.
  if (difficulty > 0) for (const k of ['fire', 'cold', 'light', 'poison'] as const) if (res[k] >= 50) res[k] = Math.min(110, res[k] + 25 * difficulty);
  return {
    life: Math.max(1, Math.round(life)),
    dmgMin: Math.max(1, Math.round(dmg * 0.6)),
    dmgMax: Math.max(2, Math.round(dmg * 1.25)),
    ar: Math.round(10 + mlvl * 11),
    def: Math.round(defense),
    speed,
    xp: Math.round((5 + mlvl * 5 + mlvl * mlvl * 0.55) * def.xpMul * rarXp * (1 + difficulty * 0.6)),
    res,
  };
}

export function rollUniqueMods(rng: Rng, n: number): UniqueMod[] {
  return rng.shuffle(UNIQUE_MODS.slice()).slice(0, n);
}

const UNQ_A = ['Gore', 'Rot', 'Bile', 'Ash', 'Grim', 'Blight', 'Gloom', 'Pus', 'Death', 'Bone', 'Flesh', 'Soot', 'Storm', 'Doom'];
const UNQ_B = ['maw', 'fang', 'spine', 'wart', 'hide', 'gut', 'skull', 'claw', 'thorn', 'tongue', 'eye', 'grin'];
const UNQ_C = ['the Hungry', 'the Cruel', 'the Wretched', 'the Vile', 'the Unclean', 'the Butcher', 'the Defiler', 'the Hunter', 'the Mad', 'the Pale'];

export function uniqueName(rng: Rng): string {
  return `${rng.pick(UNQ_A)}${rng.pick(UNQ_B)} ${rng.pick(UNQ_C)}`;
}
