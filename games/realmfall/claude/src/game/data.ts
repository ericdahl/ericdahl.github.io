/** Static game data: classes, abilities, monsters, item bases and progression curves. */
import type { RealmId } from './geo';

export type ClassId = 'warden' | 'ranger' | 'runecaller' | 'cleric';
export type StatId = 'str' | 'con' | 'dex' | 'int' | 'pie';
export const STATS: StatId[] = ['str', 'con', 'dex', 'int', 'pie'];
export const STAT_NAMES: Record<StatId, string> = { str: 'Strength', con: 'Constitution', dex: 'Dexterity', int: 'Intelligence', pie: 'Piety' };

export type WeaponKind = 'sword' | 'bow' | 'staff' | 'mace' | 'claws' | 'fangs' | 'fists' | 'branch' | 'spores';
export const WEAPONS: Record<WeaponKind, { speed: number; range: number; verb: string; noun: string; ranged?: boolean }> = {
  sword: { speed: 3.4, range: 3.6, verb: 'attack', noun: 'sword' },
  bow: { speed: 4.2, range: 38, verb: 'shoot', noun: 'bow', ranged: true },
  staff: { speed: 4.0, range: 3.8, verb: 'attack', noun: 'staff' },
  mace: { speed: 3.6, range: 3.6, verb: 'attack', noun: 'mace' },
  claws: { speed: 3.0, range: 3.4, verb: 'claws', noun: 'claws' },
  fangs: { speed: 3.0, range: 3.4, verb: 'bites', noun: 'fangs' },
  fists: { speed: 3.8, range: 4.4, verb: 'pummels', noun: 'fists' },
  branch: { speed: 4.4, range: 4.6, verb: 'lashes', noun: 'branches' },
  spores: { speed: 3.2, range: 3.4, verb: 'stings', noun: 'touch' },
};

export type ArmorType = 'plate' | 'chain' | 'leather' | 'cloth';
export const ARMOR_MUL: Record<ArmorType, number> = { plate: 1, chain: 0.85, leather: 0.62, cloth: 0.35 };

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  desc: string;
  hpPerLevel: number;
  powerStat: 'int' | 'pie' | null;
  base: Record<StatId, number>;
  growth: Record<StatId, number>;
  weapon: WeaponKind;
  armor: ArmorType;
  parry: number;
  block: number;
  evade: number;
  /** multiplier on melee swings */
  melee: number;
  abilities: string[];
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warden: {
    id: 'warden', name: 'Warden', role: 'Sword and shield',
    desc: 'Heavy armour, a shield and a chain of sword styles. Parries open Riposte; Slash opens Backhand, and Backhand opens Executioner.',
    hpPerLevel: 21, powerStat: null,
    base: { str: 60, con: 55, dex: 45, int: 30, pie: 35 }, growth: { str: 2.5, con: 2, dex: 1, int: 0, pie: 0.5 },
    weapon: 'sword', armor: 'plate', parry: 0.09, block: 0.14, evade: 0.03, melee: 1.25,
    abilities: ['slash', 'shield_bash', 'riposte', 'backhand', 'rally', 'flank_cut', 'executioner', 'taunt'],
  },
  ranger: {
    id: 'ranger', name: 'Ranger', role: 'Bow',
    desc: 'Leather, a longbow and a hunter’s patience. Draw times are long and any hit spoils the shot, so open from range and snare whatever runs at you.',
    hpPerLevel: 15, powerStat: null,
    base: { str: 45, con: 45, dex: 60, int: 30, pie: 35 }, growth: { str: 1, con: 1.5, dex: 2.5, int: 0, pie: 0.5 },
    weapon: 'bow', armor: 'leather', parry: 0.04, block: 0, evade: 0.12, melee: 0.5,
    abilities: ['aimed_shot', 'crippling_arrow', 'quick_shot', 'evasion', 'critical_shot', 'volley'],
  },
  runecaller: {
    id: 'runecaller', name: 'Runecaller', role: 'Fire, frost and lightning',
    desc: 'Cloth robes and a stack of runes. Hits for more than anyone, but a single blow interrupts a spell. Root and Frost Lance keep things at a distance.',
    hpPerLevel: 11, powerStat: 'int',
    base: { str: 30, con: 40, dex: 50, int: 65, pie: 35 }, growth: { str: 0, con: 1, dex: 1, int: 3, pie: 0 },
    weapon: 'staff', armor: 'cloth', parry: 0, block: 0, evade: 0.04, melee: 0.55,
    abilities: ['fire_bolt', 'frost_lance', 'root', 'focus', 'arcane_shield', 'flame_ring', 'lightning', 'meteor'],
  },
  cleric: {
    id: 'cleric', name: 'Cleric', role: 'Healing and holy wrath',
    desc: 'Chain mail, a mace and a prayer for every occasion. Heals itself and its realm-mates, stuns, and smites from range.',
    hpPerLevel: 16, powerStat: 'pie',
    base: { str: 45, con: 50, dex: 40, int: 30, pie: 65 }, growth: { str: 1, con: 1.5, dex: 0.5, int: 0, pie: 2.5 },
    weapon: 'mace', armor: 'chain', parry: 0.03, block: 0.1, evade: 0.03, melee: 1.15,
    abilities: ['smite', 'mend', 'renew', 'focus', 'blessing', 'holy_stun', 'greater_mend', 'sanctuary'],
  },
};
export const CLASS_IDS: ClassId[] = ['warden', 'ranger', 'runecaller', 'cleric'];

export type EffectDef =
  | { type: 'stun'; dur: number }
  | { type: 'root'; dur: number }
  | { type: 'snare'; dur: number; value: number }
  | { type: 'dot'; dur: number; value: number } // fraction of the hit, per second
  | { type: 'hot'; dur: number; value: number } // heal coefficient per tick
  | { type: 'buff'; dur: number; stat: 'dmg' | 'armor' | 'evade' | 'speed'; value: number; name: string }
  | { type: 'absorb'; dur: number; value: number }
  | { type: 'focus'; dur: number }
  | { type: 'taunt'; dur: number };

export interface AbilityDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  level: number;
  /** style: modifies the next swing. shot/spell: cast or drawn. instant: happens at once. */
  kind: 'style' | 'shot' | 'spell' | 'instant';
  costType: 'endu' | 'power';
  cost: number; // endurance: flat. power: percent of max power
  cast?: number;
  cd?: number;
  range?: number;
  target: 'enemy' | 'self' | 'ally' | 'pbaoe' | 'pbaoeAlly' | 'enemyAoe';
  radius?: number;
  school: 'melee' | 'ranged' | 'fire' | 'cold' | 'energy' | 'holy';
  /** style or shot: multiplier added to the swing */
  bonus?: number;
  /** spell damage or heal: a + b * level */
  power?: [number, number];
  heal?: boolean;
  req?: { pos?: 'behind' | 'side'; after?: 'parry' | 'block' | 'evade'; follow?: string; shield?: boolean };
  effects?: EffectDef[];
  /** spell can be cast while moving (instants always can) */
  noInterrupt?: boolean;
}

export const ABILITIES: Record<string, AbilityDef> = {
  // Warden
  slash: { id: 'slash', name: 'Slash', icon: 'sword', desc: 'A heavy cut. Opens Backhand.', level: 1, kind: 'style', costType: 'endu', cost: 5, target: 'enemy', school: 'melee', bonus: 0.45 },
  shield_bash: { id: 'shield_bash', name: 'Shield Bash', icon: 'shield', desc: 'Stuns the target for 3 seconds and interrupts any spell.', level: 2, kind: 'instant', costType: 'endu', cost: 8, cd: 20, range: 4, target: 'enemy', school: 'melee', bonus: -0.5, effects: [{ type: 'stun', dur: 3 }] },
  riposte: { id: 'riposte', name: 'Riposte', icon: 'riposte', desc: 'After you parry: a fast counter for heavy damage.', level: 4, kind: 'style', costType: 'endu', cost: 4, target: 'enemy', school: 'melee', bonus: 1.3, req: { after: 'parry' } },
  backhand: { id: 'backhand', name: 'Backhand', icon: 'chain', desc: 'Follows Slash. Hits hard and slows the target by 35% for 8 seconds. Opens Executioner.', level: 6, kind: 'style', costType: 'endu', cost: 6, target: 'enemy', school: 'melee', bonus: 0.95, req: { follow: 'slash' }, effects: [{ type: 'snare', dur: 8, value: 0.35 }] },
  rally: { id: 'rally', name: 'Rally', icon: 'banner', desc: '+25% armour for 30 seconds.', level: 9, kind: 'instant', costType: 'endu', cost: 10, cd: 60, target: 'self', school: 'melee', effects: [{ type: 'buff', dur: 30, stat: 'armor', value: 0.25, name: 'Rally' }] },
  flank_cut: { id: 'flank_cut', name: 'Flank Cut', icon: 'flank', desc: 'From the side or behind: a deep cut that bleeds for 10 seconds.', level: 12, kind: 'style', costType: 'endu', cost: 7, target: 'enemy', school: 'melee', bonus: 1.4, req: { pos: 'side' }, effects: [{ type: 'dot', dur: 10, value: 0.06 }] },
  executioner: { id: 'executioner', name: 'Executioner', icon: 'axe', desc: 'Follows Backhand. A brutal finishing blow.', level: 15, kind: 'style', costType: 'endu', cost: 8, target: 'enemy', school: 'melee', bonus: 2.2, req: { follow: 'backhand' } },
  taunt: { id: 'taunt', name: 'Challenge', icon: 'horn', desc: 'Forces nearby monsters and soldiers to attack you for 6 seconds.', level: 18, kind: 'instant', costType: 'endu', cost: 6, cd: 20, target: 'pbaoe', radius: 12, school: 'melee', effects: [{ type: 'taunt', dur: 6 }] },

  // Ranger
  aimed_shot: { id: 'aimed_shot', name: 'Aimed Shot', icon: 'arrow', desc: 'A long draw for double damage.', level: 1, kind: 'shot', costType: 'endu', cost: 5, cast: 2.6, range: 40, target: 'enemy', school: 'ranged', bonus: 1.0 },
  crippling_arrow: { id: 'crippling_arrow', name: 'Crippling Arrow', icon: 'snarearrow', desc: 'A quick draw that slows the target by 45% for 10 seconds.', level: 3, kind: 'shot', costType: 'endu', cost: 6, cast: 1.5, range: 40, target: 'enemy', school: 'ranged', bonus: 0.1, effects: [{ type: 'snare', dur: 10, value: 0.45 }] },
  quick_shot: { id: 'quick_shot', name: 'Snap Shot', icon: 'quick', desc: 'An instant shot. Usable in melee.', level: 5, kind: 'instant', costType: 'endu', cost: 7, cd: 8, range: 40, target: 'enemy', school: 'ranged', bonus: 0.2 },
  evasion: { id: 'evasion', name: 'Evasion', icon: 'wind', desc: '+25% chance to evade for 15 seconds.', level: 8, kind: 'instant', costType: 'endu', cost: 8, cd: 60, target: 'self', school: 'ranged', effects: [{ type: 'buff', dur: 15, stat: 'evade', value: 0.25, name: 'Evasion' }] },
  critical_shot: { id: 'critical_shot', name: 'Heart-Seeker', icon: 'crit', desc: 'A four-second draw for four times the damage. Patience.', level: 11, kind: 'shot', costType: 'endu', cost: 10, cast: 4, cd: 12, range: 45, target: 'enemy', school: 'ranged', bonus: 3.0 },
  volley: { id: 'volley', name: 'Volley', icon: 'volley', desc: 'Rains arrows on everything within 8 metres of the target.', level: 15, kind: 'shot', costType: 'endu', cost: 12, cast: 2, cd: 25, range: 40, radius: 8, target: 'enemyAoe', school: 'ranged', bonus: 0.6 },

  // Runecaller
  fire_bolt: { id: 'fire_bolt', name: 'Fire Bolt', icon: 'fire', desc: 'Hurls fire at the target.', level: 1, kind: 'spell', costType: 'power', cost: 7, cast: 2.5, range: 34, target: 'enemy', school: 'fire', power: [9, 5.6] },
  frost_lance: { id: 'frost_lance', name: 'Frost Lance', icon: 'frost', desc: 'Cold damage that slows the target by 50% for 10 seconds.', level: 2, kind: 'spell', costType: 'power', cost: 7, cast: 2.1, range: 34, target: 'enemy', school: 'cold', power: [6, 3.6], effects: [{ type: 'snare', dur: 10, value: 0.5 }] },
  root: { id: 'root', name: 'Earthbind', icon: 'root', desc: 'Roots the target in place for 15 seconds. Damage frees it after the first two.', level: 4, kind: 'spell', costType: 'power', cost: 8, cast: 1.6, cd: 12, range: 32, target: 'enemy', school: 'energy', effects: [{ type: 'root', dur: 15 }] },
  focus: { id: 'focus', name: 'Focus', icon: 'eye', desc: 'Your next spell cannot be interrupted.', level: 5, kind: 'instant', costType: 'power', cost: 3, cd: 30, target: 'self', school: 'energy', effects: [{ type: 'focus', dur: 20 }] },
  arcane_shield: { id: 'arcane_shield', name: 'Rune Ward', icon: 'ward', desc: 'Absorbs damage equal to a third of your life for 20 seconds.', level: 7, kind: 'instant', costType: 'power', cost: 12, cd: 45, target: 'self', school: 'energy', effects: [{ type: 'absorb', dur: 20, value: 0.33 }] },
  flame_ring: { id: 'flame_ring', name: 'Flame Ring', icon: 'ring', desc: 'Instant fire around you (8 m).', level: 10, kind: 'instant', costType: 'power', cost: 10, cd: 15, radius: 8, target: 'pbaoe', school: 'fire', power: [8, 4] },
  lightning: { id: 'lightning', name: 'Thunderclap', icon: 'bolt', desc: 'A slow cast that strikes very hard.', level: 13, kind: 'spell', costType: 'power', cost: 11, cast: 3.2, range: 36, target: 'enemy', school: 'energy', power: [16, 10] },
  meteor: { id: 'meteor', name: 'Starfall', icon: 'meteor', desc: 'Fire from the sky on everything within 9 m of the target.', level: 17, kind: 'spell', costType: 'power', cost: 16, cast: 3.5, cd: 30, range: 36, radius: 9, target: 'enemyAoe', school: 'fire', power: [14, 7.5] },

  // Cleric
  smite: { id: 'smite', name: 'Smite', icon: 'sun', desc: 'Holy damage at range.', level: 1, kind: 'spell', costType: 'power', cost: 6, cast: 2.2, range: 32, target: 'enemy', school: 'holy', power: [7, 4.6] },
  mend: { id: 'mend', name: 'Mend', icon: 'heart', desc: 'Heals you or your target.', level: 1, kind: 'spell', costType: 'power', cost: 8, cast: 2.5, range: 30, target: 'ally', school: 'holy', power: [14, 8], heal: true },
  renew: { id: 'renew', name: 'Renew', icon: 'renew', desc: 'Heals over 12 seconds. Instant.', level: 3, kind: 'instant', costType: 'power', cost: 7, cd: 10, range: 30, target: 'ally', school: 'holy', power: [3, 1.4], heal: true, effects: [{ type: 'hot', dur: 12, value: 1 }] },
  blessing: { id: 'blessing', name: 'Blessing of Arms', icon: 'bless', desc: '+15% damage for you and realm-mates within 20 m, for 10 minutes.', level: 6, kind: 'instant', costType: 'power', cost: 10, cd: 10, radius: 20, target: 'pbaoeAlly', school: 'holy', effects: [{ type: 'buff', dur: 600, stat: 'dmg', value: 0.15, name: 'Blessing of Arms' }] },
  holy_stun: { id: 'holy_stun', name: 'Rebuke', icon: 'stun', desc: 'Stuns the target for 4 seconds.', level: 9, kind: 'instant', costType: 'power', cost: 8, cd: 30, range: 20, target: 'enemy', school: 'holy', effects: [{ type: 'stun', dur: 4 }] },
  greater_mend: { id: 'greater_mend', name: 'Greater Mend', icon: 'bigheart', desc: 'A slower, much larger heal.', level: 12, kind: 'spell', costType: 'power', cost: 14, cast: 3.2, range: 30, target: 'ally', school: 'holy', power: [30, 17], heal: true },
  sanctuary: { id: 'sanctuary', name: 'Sanctuary', icon: 'sanct', desc: 'Heals you and every realm-mate within 15 m.', level: 16, kind: 'instant', costType: 'power', cost: 18, cd: 30, radius: 15, target: 'pbaoeAlly', school: 'holy', power: [18, 9], heal: true },

  // Monster abilities
  bog_bolt: { id: 'bog_bolt', name: 'bog bolt', icon: 'frost', desc: '', level: 1, kind: 'spell', costType: 'power', cost: 0, cast: 2.4, range: 28, target: 'enemy', school: 'cold', power: [5, 3.2], effects: [{ type: 'snare', dur: 5, value: 0.3 }] },
  venom: { id: 'venom', name: 'venomous bite', icon: 'fangs', desc: '', level: 1, kind: 'style', costType: 'endu', cost: 0, target: 'enemy', school: 'melee', bonus: 0.2, effects: [{ type: 'dot', dur: 9, value: 0.08 }] },
  slam: { id: 'slam', name: 'ground slam', icon: 'stun', desc: '', level: 1, kind: 'instant', costType: 'endu', cost: 0, cd: 18, range: 5, target: 'enemy', school: 'melee', bonus: 0.6, effects: [{ type: 'stun', dur: 2 }] },
};

export const SPRINT_SPEED = 1.35;
export const RUN_SPEED = 7.2;

// ---------- Monsters ----------

export type Shape = 'humanoid' | 'quadruped' | 'spider' | 'sprite' | 'treant';

export interface MobDef {
  id: string;
  name: string;
  shape: Shape;
  /** quadrupeds: 'wolf' | 'boar' | 'bear' | 'rat' */
  variant?: string;
  color: string;
  color2: string;
  scale: number;
  levels: [number, number];
  realms?: RealmId[];
  hp: number; // multiplier
  dmg: number;
  speed: number;
  aggro: number; // metres; 0 = only fights back
  social?: boolean;
  weapon: WeaponKind;
  abilities?: string[];
  armor?: number;
  ranged?: boolean;
  caster?: boolean;
  flees?: boolean;
  look?: { body: string; trim: string; weapon?: 'sword' | 'bow' | 'staff' | 'mace' | 'none'; helm?: boolean; bones?: boolean };
}

export const MOBS: MobDef[] = [
  { id: 'rat', name: 'river rat', shape: 'quadruped', variant: 'rat', color: '#6d5b4b', color2: '#a1887f', scale: 0.45, levels: [1, 3], hp: 0.8, dmg: 0.8, speed: 5.5, aggro: 0, weapon: 'fangs', flees: true },
  { id: 'young_wolf', name: 'young wolf', shape: 'quadruped', variant: 'wolf', color: '#8d8478', color2: '#cfc6b8', scale: 0.75, levels: [1, 4], hp: 0.9, dmg: 0.95, speed: 6.5, aggro: 0, social: true, weapon: 'fangs' },
  { id: 'boar', name: 'wild boar', shape: 'quadruped', variant: 'boar', color: '#5d4037', color2: '#3e2723', scale: 0.85, levels: [2, 7], hp: 1.15, dmg: 0.95, speed: 6, aggro: 0, weapon: 'fangs' },
  { id: 'grey_wolf', name: 'grey wolf', shape: 'quadruped', variant: 'wolf', color: '#6f6f6f', color2: '#bdbdbd', scale: 0.95, levels: [4, 10], hp: 1, dmg: 1, speed: 6.8, aggro: 11, social: true, weapon: 'fangs' },
  { id: 'brigand', name: 'brigand', shape: 'humanoid', color: '#6b4f3a', color2: '#3b2f28', scale: 1, levels: [4, 12], hp: 1, dmg: 1.05, speed: 6.2, aggro: 13, social: true, weapon: 'sword', look: { body: '#5b4636', trim: '#8a2f2f', weapon: 'sword' } },
  { id: 'brigand_archer', name: 'brigand bowman', shape: 'humanoid', color: '#5a5a3a', color2: '#3b2f28', scale: 1, levels: [5, 12], hp: 0.85, dmg: 0.9, speed: 6.2, aggro: 18, social: true, weapon: 'bow', ranged: true, look: { body: '#4f5a35', trim: '#8a2f2f', weapon: 'bow' } },
  { id: 'spider', name: 'cave spider', shape: 'spider', color: '#2b2b33', color2: '#7a1f2b', scale: 1, levels: [6, 13], hp: 0.95, dmg: 0.95, speed: 6.5, aggro: 10, weapon: 'fangs', abilities: ['venom'] },
  { id: 'bear', name: 'moss bear', shape: 'quadruped', variant: 'bear', color: '#4e3b2a', color2: '#5f7a3a', scale: 1.3, levels: [9, 16], realms: [1, 2], hp: 1.35, dmg: 1.1, speed: 6, aggro: 0, weapon: 'claws' },
  { id: 'sprite', name: 'bog sprite', shape: 'sprite', color: '#6fe3c1', color2: '#1d6b57', scale: 0.8, levels: [6, 14], realms: [1], hp: 0.75, dmg: 0.8, speed: 6, aggro: 16, weapon: 'spores', caster: true, abilities: ['bog_bolt'] },
  { id: 'wight', name: 'barrow wight', shape: 'humanoid', color: '#cfc8b0', color2: '#3d4a52', scale: 1.05, levels: [10, 17], realms: [0], hp: 1.1, dmg: 1.05, speed: 6, aggro: 13, weapon: 'sword', look: { body: '#3d4a52', trim: '#9aa7b0', weapon: 'sword', bones: true, helm: true } },
  { id: 'ice_wolf', name: 'rime wolf', shape: 'quadruped', variant: 'wolf', color: '#dfe8ef', color2: '#8fb5d0', scale: 1.05, levels: [8, 15], realms: [2], hp: 1, dmg: 1.05, speed: 7, aggro: 12, social: true, weapon: 'fangs' },
  { id: 'treant', name: 'thornback treant', shape: 'treant', color: '#5b4030', color2: '#4f7f36', scale: 1.7, levels: [12, 19], realms: [1], hp: 1.6, dmg: 1.1, speed: 4.4, aggro: 9, weapon: 'branch', abilities: ['slam'], armor: 1.3 },
  { id: 'troll', name: 'frost troll', shape: 'humanoid', color: '#7fa0a8', color2: '#3e5560', scale: 1.75, levels: [13, 19], realms: [2], hp: 1.55, dmg: 1.15, speed: 5.6, aggro: 12, weapon: 'fists', abilities: ['slam'], look: { body: '#5c7a83', trim: '#d8e4e8', weapon: 'none' } },
  { id: 'dire_wolf', name: 'dire wolf', shape: 'quadruped', variant: 'wolf', color: '#2f2a28', color2: '#6b5f58', scale: 1.25, levels: [12, 19], hp: 1.1, dmg: 1.1, speed: 7.2, aggro: 14, social: true, weapon: 'fangs' },
  { id: 'fallen', name: 'fallen knight', shape: 'humanoid', color: '#34363d', color2: '#6b1f24', scale: 1.1, levels: [14, 19], realms: [0], hp: 1.3, dmg: 1.15, speed: 6, aggro: 13, weapon: 'sword', armor: 1.3, look: { body: '#2c2e34', trim: '#6b1f24', weapon: 'sword', helm: true } },
  { id: 'cultist', name: 'mistcaller', shape: 'humanoid', color: '#4a3a66', color2: '#a58bd6', scale: 1, levels: [9, 18], hp: 0.85, dmg: 0.9, speed: 6, aggro: 15, social: true, weapon: 'staff', caster: true, abilities: ['bog_bolt'], look: { body: '#3e2f5c', trim: '#a58bd6', weapon: 'staff' } },
];
export const MOB_BY_ID = Object.fromEntries(MOBS.map((m) => [m.id, m]));

/** Unique, rarely seen monsters with better loot. */
export const NAMED: { mob: string; name: string; realm?: RealmId }[] = [
  { mob: 'grey_wolf', name: 'Old Greyjaw' },
  { mob: 'boar', name: 'Tuskarr the Bristled' },
  { mob: 'brigand', name: 'Black Hesk' },
  { mob: 'spider', name: 'Mother Webb' },
  { mob: 'wight', name: 'The Unquiet Earl', realm: 0 },
  { mob: 'fallen', name: 'Ser Calloway the Lost', realm: 0 },
  { mob: 'treant', name: 'Elderbark', realm: 1 },
  { mob: 'sprite', name: 'Willowisp', realm: 1 },
  { mob: 'troll', name: 'Grundvald', realm: 2 },
  { mob: 'ice_wolf', name: 'Fenra Whitefang', realm: 2 },
  { mob: 'dire_wolf', name: 'Gorehowl' },
  { mob: 'cultist', name: 'Mother Morrow' },
];

// ---------- Curves ----------

export const MAX_LEVEL = 20;
export const xpToNext = (lvl: number) => Math.round(80 * Math.pow(lvl, 1.9));
export const mobXp = (lvl: number) => Math.round(24 * Math.pow(lvl, 1.5));

export function mobHp(lvl: number) {
  return 30 + lvl * 22;
}
export function mobDps(lvl: number) {
  return 1.4 + lvl * 1.7;
}
export function weaponDps(ilvl: number, quality = 1) {
  return (2.2 + ilvl * 0.95) * quality;
}
export function armorAf(ilvl: number, quality = 1) {
  return (3 + ilvl * 1.7) * quality;
}

export type ConColor = 'grey' | 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'purple';
export function conColor(viewer: number, target: number): ConColor {
  const d = target - viewer;
  const greyAt = viewer < 10 ? -4 : -5;
  if (d <= greyAt) return 'grey';
  if (d <= -3) return 'green';
  if (d <= -1) return 'blue';
  if (d === 0) return 'yellow';
  if (d <= 2) return 'orange';
  if (d === 3) return 'red';
  return 'purple';
}
export const CON_HEX: Record<ConColor, string> = {
  grey: '#9e9e9e', green: '#4cd964', blue: '#4aa3ff', yellow: '#ffd84a', orange: '#ff9f2e', red: '#ff4b3e', purple: '#c77dff',
};
export const CON_XP: Record<ConColor, number> = { grey: 0, green: 0.45, blue: 0.75, yellow: 1, orange: 1.25, red: 1.5, purple: 1.8 };

export const REALM_RANKS = [0, 400, 1200, 2800, 5500, 9500, 15000, 23000, 34000, 50000];
export const RANK_TITLES = [
  ['Recruit', 'Squire', 'Sergeant', 'Knight', 'Banneret', 'Captain', 'Lord Protector', 'Paladin', 'Marshal', 'Hero of Valmora'],
  ['Sapling', 'Thorn', 'Bramble', 'Warden of the Glade', 'Mistwalker', 'Elder Thorn', 'Oakheart', 'Champion of the Wood', 'Ard-Laoch', 'Hero of Eldwyn'],
  ['Thrall', 'Karl', 'Huscarl', 'Shieldbreaker', 'Wolfcoat', 'Raven-Feeder', 'Jarl', 'Saga-Sworn', 'Einherjar', 'Hero of Hroth'],
];
export function realmRank(rp: number) {
  let r = 0;
  while (r + 1 < REALM_RANKS.length && rp >= REALM_RANKS[r + 1]) r++;
  return r;
}

// ---------- Names ----------

const SYL: [string[], string[], string[]][] = [
  [['Ald', 'Bran', 'Cor', 'Ed', 'Gar', 'Hal', 'Is', 'Lor', 'Mer', 'Os', 'Per', 'Row', 'Tris', 'Wil', 'Ely', 'Gwen', 'Ros', 'Mar'], ['a', 'e', 'i', 'o', 'ar', 'el', 'en', 'is'], ['ric', 'wyn', 'mund', 'iel', 'ith', 'an', 'ard', 'ine', 'ot', 'ell', 'a']],
  [['Ae', 'Bri', 'Cae', 'Dei', 'Fio', 'Gra', 'Lia', 'Nia', 'Oi', 'Rho', 'Sio', 'Tad', 'Ul', 'Eo', 'Mae', 'Cia'], ['n', 'r', 'l', 'th', 'dh', 'v', 'nn'], ['ach', 'ra', 'wen', 'agh', 'an', 'ith', 'ael', 'id', 'a', 'eth']],
  [['Bjo', 'Dag', 'Ei', 'Gun', 'Hal', 'Ing', 'Kol', 'Rag', 'Sig', 'Thor', 'Ulf', 'Vig', 'Ast', 'Fre', 'Hel', 'Sol'], ['r', 'n', 'nd', 'l', 'rd', 'g'], ['ar', 'a', 'vald', 'rid', 'ulf', 'ny', 'mar', 'leif', 'hild', 'grim', 'is']],
];
export function realmName(realm: RealmId, r: () => number): string {
  const [a, b, c] = SYL[realm];
  const p = (arr: string[]) => arr[Math.floor(r() * arr.length)];
  let n = p(a) + (r() < 0.5 ? p(b) : '') + p(c);
  if (n.length > 11) n = n.slice(0, 11);
  return n[0].toUpperCase() + n.slice(1).toLowerCase();
}
