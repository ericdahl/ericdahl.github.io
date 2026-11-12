import { Rng } from './rng';

export type StatKey =
  | 'str' | 'dex' | 'vit' | 'ene' | 'allAttr'
  | 'life' | 'mana'
  | 'minDmg' | 'maxDmg' | 'edPct' | 'ar' | 'arPct'
  | 'def' | 'defPct'
  | 'fireRes' | 'coldRes' | 'lightRes' | 'poisonRes' | 'allRes'
  | 'fireMin' | 'fireMax' | 'coldMin' | 'coldMax' | 'lightMin' | 'lightMax' | 'poisonDmg'
  | 'lifeSteal' | 'manaSteal' | 'ias' | 'frw' | 'fcr' | 'mf' | 'gf' | 'thorns'
  | 'lifeRegen' | 'manaRegen' | 'allSkills' | 'skills_reaver' | 'skills_arcanist' | 'skills_huntress' | 'skills_necromancer' | 'skills_forgewright'
  | 'block' | 'crit' | 'dmgReduce' | 'lifeOnKill' | 'manaOnKill';

export interface Mod {
  stat: StatKey;
  value: number;
}

export type ItemKind =
  | 'weapon' | 'shield' | 'armor' | 'helm' | 'gloves' | 'boots' | 'belt' | 'ring' | 'amulet'
  | 'potion' | 'gem' | 'scroll';
export type WeaponCat = 'sword' | 'axe' | 'mace' | 'dagger' | 'wand' | 'staff' | 'bow';
export type Rarity = 'normal' | 'magic' | 'rare' | 'set' | 'unique';
export type Slot = 'head' | 'body' | 'weapon' | 'offhand' | 'gloves' | 'belt' | 'boots' | 'amulet' | 'ring1' | 'ring2';
export type ClassId = 'reaver' | 'arcanist' | 'huntress' | 'necromancer' | 'forgewright';

export interface PotionInfo {
  type: 'hp' | 'mp' | 'rejuv';
  amount: number;
}

export interface BaseItem {
  id: string;
  name: string;
  kind: ItemKind;
  cat?: WeaponCat;
  w: number;
  h: number;
  qlvl: number;
  minDmg?: number;
  maxDmg?: number;
  /** Attacks per second. */
  speed?: number;
  /** Melee reach or projectile range, in tiles. */
  range?: number;
  twoHanded?: boolean;
  defMin?: number;
  defMax?: number;
  block?: number;
  /** Potions carried per pool while this belt is worn. */
  potionCap?: number;
  reqStr?: number;
  reqDex?: number;
  maxSockets?: number;
  potion?: PotionInfo;
  gem?: { type: GemType; grade: number };
  /** Made for one class: it drops often for them and seldom for anyone else. */
  forClass?: ClassId;
  /** Only spawns as magic or better (jewelry, circlets). */
  magicOnly?: boolean;
  value?: number;
}

export interface Item {
  uid: number;
  base: string;
  rarity: Rarity;
  ilvl: number;
  identified: boolean;
  mods: Mod[];
  name?: string;
  def?: number;
  sockets: number;
  gems: string[];
  uniqueId?: string;
  setId?: string;
  reqLvl: number;
}

const W = (
  id: string, name: string, cat: WeaponCat, qlvl: number, minDmg: number, maxDmg: number, speed: number,
  w: number, h: number, extra: Partial<BaseItem> = {},
): BaseItem => ({
  id, name, kind: 'weapon', cat, qlvl, minDmg, maxDmg, speed, w, h,
  range: cat === 'bow' ? 9 : cat === 'dagger' ? 0.9 : 1.15, maxSockets: Math.min(w * h, 3), ...extra,
});
const A = (
  id: string, name: string, kind: ItemKind, qlvl: number, defMin: number, defMax: number, w: number, h: number,
  extra: Partial<BaseItem> = {},
): BaseItem => ({ id, name, kind, qlvl, defMin, defMax, w, h, ...extra });

export const BASES: BaseItem[] = [
  W('short_sword', 'Short Sword', 'sword', 1, 2, 7, 1.5, 1, 3),
  W('club', 'Club', 'mace', 1, 1, 6, 1.55, 1, 3),
  W('dagger', 'Dagger', 'dagger', 2, 1, 5, 1.85, 1, 2, { maxSockets: 1 }),
  W('hand_axe', 'Hand Axe', 'axe', 3, 3, 6, 1.45, 1, 3),
  W('mace', 'Mace', 'mace', 6, 3, 10, 1.35, 2, 3, { reqStr: 27 }),
  W('long_sword', 'Long Sword', 'sword', 8, 3, 13, 1.4, 2, 3, { reqStr: 40, reqDex: 20 }),
  W('war_axe', 'War Axe', 'axe', 10, 7, 14, 1.25, 2, 3, { reqStr: 52 }),
  W('morning_star', 'Morning Star', 'mace', 13, 7, 17, 1.25, 2, 3, { reqStr: 60 }),
  W('broad_sword', 'Broad Sword', 'sword', 15, 8, 16, 1.35, 2, 3, { reqStr: 60, reqDex: 30 }),
  W('great_axe', 'Great Axe', 'axe', 12, 10, 30, 1.0, 2, 4, { twoHanded: true, reqStr: 70, maxSockets: 4 }),
  W('claymore', 'Claymore', 'sword', 17, 14, 32, 1.05, 2, 4, { twoHanded: true, reqStr: 85, maxSockets: 4 }),
  // Two-handed hammers: slow, heavy, and the Forgewright's weapon of choice.
  W('sledge', 'Sledge', 'mace', 1, 3, 9, 1.2, 2, 3, { twoHanded: true, forClass: 'forgewright' }),
  W('war_hammer', 'War Hammer', 'mace', 8, 8, 22, 1.1, 2, 4, { twoHanded: true, reqStr: 45, maxSockets: 4, forClass: 'forgewright' }),
  W('great_maul', 'Great Maul', 'mace', 15, 14, 34, 1.05, 2, 4, { twoHanded: true, reqStr: 75, maxSockets: 4, forClass: 'forgewright' }),
  W('yew_wand', 'Yew Wand', 'wand', 1, 2, 4, 1.35, 1, 2, { maxSockets: 1 }),
  W('bone_wand', 'Bone Wand', 'wand', 10, 3, 7, 1.35, 1, 2, { maxSockets: 2 }),
  W('short_staff', 'Short Staff', 'staff', 1, 2, 6, 1.3, 1, 3, { twoHanded: true, maxSockets: 2 }),
  W('gnarled_staff', 'Gnarled Staff', 'staff', 7, 4, 12, 1.3, 1, 4, { twoHanded: true, maxSockets: 3 }),
  W('battle_staff', 'Battle Staff', 'staff', 15, 6, 15, 1.3, 1, 4, { twoHanded: true, maxSockets: 4 }),
  W('short_bow', 'Short Bow', 'bow', 1, 1, 4, 1.45, 2, 3, { twoHanded: true, reqDex: 15 }),
  W('hunters_bow', "Hunter's Bow", 'bow', 4, 2, 6, 1.4, 2, 3, { twoHanded: true, reqDex: 28 }),
  W('long_bow', 'Long Bow', 'bow', 9, 3, 10, 1.35, 2, 4, { twoHanded: true, reqDex: 35, maxSockets: 4 }),
  W('composite_bow', 'Composite Bow', 'bow', 12, 4, 12, 1.45, 2, 3, { twoHanded: true, reqDex: 48, reqStr: 25 }),
  W('battle_bow', 'Battle Bow', 'bow', 16, 6, 16, 1.4, 2, 3, { twoHanded: true, reqDex: 60, reqStr: 30 }),
  W('jambiya', 'Jambiya', 'dagger', 18, 8, 15, 1.8, 1, 2, { reqDex: 40, maxSockets: 2 }),
  W('scimitar', 'Scimitar', 'sword', 19, 11, 22, 1.5, 1, 3, { reqStr: 50, reqDex: 45 }),
  W('crescent_axe', 'Crescent Axe', 'axe', 21, 14, 27, 1.3, 2, 3, { reqStr: 75 }),
  W('sun_flail', 'Sun Flail', 'mace', 22, 15, 26, 1.3, 2, 3, { reqStr: 72 }),
  W('khopesh', 'Khopesh', 'sword', 24, 18, 32, 1.4, 2, 3, { reqStr: 80, reqDex: 50 }),
  W('obsidian_maul', 'Obsidian Maul', 'mace', 23, 24, 48, 1.05, 2, 4, { twoHanded: true, reqStr: 90, maxSockets: 4, forClass: 'forgewright' }),
  W('glass_wand', 'Glass Wand', 'wand', 20, 5, 11, 1.4, 1, 2, { maxSockets: 2 }),
  W('dial_staff', 'Dial Staff', 'staff', 24, 9, 22, 1.3, 1, 4, { twoHanded: true, maxSockets: 4 }),
  W('recurve_bow', 'Recurve Bow', 'bow', 21, 9, 20, 1.45, 2, 3, { twoHanded: true, reqDex: 72, reqStr: 35 }),
  W('rime_pick', 'Rime Pick', 'axe', 26, 19, 34, 1.3, 2, 3, { reqStr: 88 }),
  W('founders_maul', "Founder's Maul", 'mace', 28, 26, 48, 1.0, 2, 4, { twoHanded: true, reqStr: 105, maxSockets: 4 }),
  W('watch_blade', 'Watch Blade', 'sword', 29, 22, 38, 1.4, 2, 3, { reqStr: 92, reqDex: 58 }),
  W('icicle_dirk', 'Icicle Dirk', 'dagger', 26, 12, 21, 1.85, 1, 2, { reqDex: 55, maxSockets: 2 }),
  W('ember_wand', 'Ember Wand', 'wand', 27, 7, 15, 1.4, 1, 2, { maxSockets: 2 }),
  W('bell_staff', 'Bell Staff', 'staff', 29, 12, 27, 1.3, 1, 4, { twoHanded: true, maxSockets: 4 }),
  W('horn_bow', 'Horn Bow', 'bow', 27, 12, 26, 1.45, 2, 4, { twoHanded: true, reqDex: 90, reqStr: 42, maxSockets: 4 }),

  A('quilted_armor', 'Quilted Armor', 'armor', 1, 8, 11, 2, 3, { maxSockets: 2 }),
  A('leather_armor', 'Leather Armor', 'armor', 3, 14, 17, 2, 3, { reqStr: 15, maxSockets: 2 }),
  A('hard_leather', 'Hard Leather Armor', 'armor', 5, 21, 24, 2, 3, { reqStr: 20, maxSockets: 2 }),
  A('studded_leather', 'Studded Leather', 'armor', 8, 32, 35, 2, 3, { reqStr: 27, maxSockets: 2 }),
  A('ring_mail', 'Ring Mail', 'armor', 11, 45, 48, 2, 3, { reqStr: 36, maxSockets: 3 }),
  A('scale_mail', 'Scale Mail', 'armor', 13, 57, 60, 2, 3, { reqStr: 44, maxSockets: 3 }),
  A('chain_mail', 'Chain Mail', 'armor', 15, 72, 75, 2, 3, { reqStr: 48, maxSockets: 3 }),
  A('plate_mail', 'Plate Mail', 'armor', 22, 108, 116, 2, 3, { reqStr: 65, maxSockets: 4 }),
  A('cap', 'Cap', 'helm', 1, 3, 5, 2, 2, { maxSockets: 2 }),
  A('skull_cap', 'Skull Cap', 'helm', 5, 8, 11, 2, 2, { reqStr: 15, maxSockets: 2 }),
  A('helm', 'Helm', 'helm', 11, 15, 18, 2, 2, { reqStr: 26, maxSockets: 2 }),
  A('full_helm', 'Full Helm', 'helm', 15, 23, 26, 2, 2, { reqStr: 41, maxSockets: 2 }),
  A('great_helm', 'Great Helm', 'helm', 23, 30, 35, 2, 2, { reqStr: 63, maxSockets: 3 }),
  A('wrapped_helm', 'Wrapped Helm', 'helm', 19, 26, 31, 2, 2, { reqStr: 40, maxSockets: 2 }),
  A('lamellar', 'Lamellar Coat', 'armor', 20, 88, 95, 2, 3, { reqStr: 55, maxSockets: 3 }),
  A('sun_plate', 'Sun Plate', 'armor', 26, 128, 138, 2, 3, { reqStr: 80, maxSockets: 4 }),
  A('fur_mantle', 'Fur Mantle', 'armor', 25, 104, 114, 2, 3, { reqStr: 48, maxSockets: 3 }),
  A('founders_plate', "Founder's Plate", 'armor', 30, 150, 164, 2, 3, { reqStr: 95, maxSockets: 4 }),
  A('watch_helm', 'Watch Helm', 'helm', 27, 36, 42, 2, 2, { reqStr: 70, maxSockets: 3 }),
  A('bell_shield', 'Bell Shield', 'shield', 27, 34, 40, 2, 3, { block: 40, reqStr: 82, maxSockets: 3 }),
  A('fur_mitts', 'Fur Mitts', 'gloves', 25, 14, 17, 2, 2, { reqStr: 45 }),
  A('snow_treads', 'Snow Treads', 'boots', 25, 14, 17, 2, 2, { reqStr: 50 }),
  A('founders_girdle', "Founder's Girdle", 'belt', 26, 10, 13, 2, 1, { potionCap: 24, reqStr: 70 }),
  A('bronze_targe', 'Bronze Targe', 'shield', 20, 26, 30, 2, 2, { block: 34, reqStr: 55, maxSockets: 2 }),
  A('wrapped_gauntlets', 'Wrapped Gauntlets', 'gloves', 18, 10, 12, 2, 2, { reqStr: 40 }),
  A('dune_boots', 'Dune Boots', 'boots', 18, 10, 12, 2, 2, { reqStr: 40 }),
  A('circlet', 'Circlet', 'helm', 12, 20, 30, 2, 2, { magicOnly: true }),
  A('buckler', 'Buckler', 'shield', 1, 4, 6, 2, 2, { block: 20, maxSockets: 1 }),
  A('small_shield', 'Small Shield', 'shield', 5, 8, 10, 2, 2, { block: 25, reqStr: 22, maxSockets: 2 }),
  A('large_shield', 'Large Shield', 'shield', 11, 12, 14, 2, 3, { block: 32, reqStr: 34, maxSockets: 3 }),
  A('kite_shield', 'Kite Shield', 'shield', 13, 16, 18, 2, 3, { block: 30, reqStr: 47, maxSockets: 3 }),
  A('tower_shield', 'Tower Shield', 'shield', 16, 22, 25, 2, 3, { block: 38, reqStr: 75, maxSockets: 3 }),
  A('leather_gloves', 'Leather Gloves', 'gloves', 1, 2, 3, 2, 2),
  A('heavy_gloves', 'Heavy Gloves', 'gloves', 7, 5, 6, 2, 2),
  A('chain_gloves', 'Chain Gloves', 'gloves', 12, 8, 9, 2, 2, { reqStr: 25 }),
  A('gauntlets', 'Gauntlets', 'gloves', 23, 12, 15, 2, 2, { reqStr: 60 }),
  A('boots', 'Boots', 'boots', 1, 2, 3, 2, 2),
  A('heavy_boots', 'Heavy Boots', 'boots', 7, 5, 6, 2, 2, { reqStr: 18 }),
  A('chain_boots', 'Chain Boots', 'boots', 12, 8, 9, 2, 2, { reqStr: 30 }),
  A('greaves', 'Greaves', 'boots', 23, 12, 15, 2, 2, { reqStr: 70 }),
  A('sash', 'Sash', 'belt', 1, 2, 2, 2, 1, { potionCap: 12 }),
  A('light_belt', 'Light Belt', 'belt', 7, 3, 3, 2, 1, { potionCap: 12 }),
  A('belt', 'Belt', 'belt', 12, 5, 5, 2, 1, { potionCap: 16, reqStr: 25 }),
  A('heavy_belt', 'Heavy Belt', 'belt', 15, 6, 6, 2, 1, { potionCap: 16, reqStr: 45 }),
  A('plated_belt', 'Plated Belt', 'belt', 20, 8, 11, 2, 1, { potionCap: 20, reqStr: 60 }),
  { id: 'ring', name: 'Ring', kind: 'ring', qlvl: 1, w: 1, h: 1, magicOnly: true },
  { id: 'amulet', name: 'Amulet', kind: 'amulet', qlvl: 1, w: 1, h: 1, magicOnly: true },

  { id: 'hp1', name: 'Minor Healing Potion', kind: 'potion', qlvl: 1, w: 1, h: 1, potion: { type: 'hp', amount: 30 }, value: 30 },
  { id: 'hp2', name: 'Light Healing Potion', kind: 'potion', qlvl: 4, w: 1, h: 1, potion: { type: 'hp', amount: 60 }, value: 60 },
  { id: 'hp3', name: 'Healing Potion', kind: 'potion', qlvl: 10, w: 1, h: 1, potion: { type: 'hp', amount: 110 }, value: 110 },
  { id: 'hp4', name: 'Greater Healing Potion', kind: 'potion', qlvl: 16, w: 1, h: 1, potion: { type: 'hp', amount: 190 }, value: 190 },
  { id: 'hp5', name: 'Super Healing Potion', kind: 'potion', qlvl: 24, w: 1, h: 1, potion: { type: 'hp', amount: 330 }, value: 330 },
  { id: 'mp1', name: 'Minor Mana Potion', kind: 'potion', qlvl: 1, w: 1, h: 1, potion: { type: 'mp', amount: 20 }, value: 30 },
  { id: 'mp2', name: 'Light Mana Potion', kind: 'potion', qlvl: 4, w: 1, h: 1, potion: { type: 'mp', amount: 40 }, value: 60 },
  { id: 'mp3', name: 'Mana Potion', kind: 'potion', qlvl: 10, w: 1, h: 1, potion: { type: 'mp', amount: 80 }, value: 110 },
  { id: 'mp4', name: 'Greater Mana Potion', kind: 'potion', qlvl: 16, w: 1, h: 1, potion: { type: 'mp', amount: 150 }, value: 190 },
  { id: 'mp5', name: 'Super Mana Potion', kind: 'potion', qlvl: 24, w: 1, h: 1, potion: { type: 'mp', amount: 250 }, value: 330 },
  { id: 'rejuv', name: 'Rejuvenation Potion', kind: 'potion', qlvl: 8, w: 1, h: 1, potion: { type: 'rejuv', amount: 35 }, value: 450 },
  { id: 'rejuv_full', name: 'Full Rejuvenation Potion', kind: 'potion', qlvl: 18, w: 1, h: 1, potion: { type: 'rejuv', amount: 100 }, value: 1500 },
  { id: 'tp_scroll', name: 'Scroll of Town Portal', kind: 'scroll', qlvl: 1, w: 1, h: 1, value: 100 },
];

export type GemType = 'ruby' | 'sapphire' | 'topaz' | 'emerald' | 'amethyst' | 'diamond' | 'skull';
export const GEM_TYPES: GemType[] = ['ruby', 'sapphire', 'topaz', 'emerald', 'amethyst', 'diamond', 'skull'];
export const GEM_GRADES = ['Chipped', 'Flawed', '', 'Flawless', 'Perfect'];
const GEM_QLVL = [1, 6, 12, 18, 26];
for (const t of GEM_TYPES)
  for (let g = 1; g <= 5; g++) {
    const nm = t === 'skull' ? 'Skull' : t[0].toUpperCase() + t.slice(1);
    BASES.push({
      id: `gem_${t}_${g}`,
      name: `${GEM_GRADES[g - 1]} ${nm}`.trim(),
      kind: 'gem',
      qlvl: GEM_QLVL[g - 1],
      w: 1,
      h: 1,
      gem: { type: t, grade: g },
      value: 40 * g * g,
    });
  }

export const BASE_BY_ID: Record<string, BaseItem> = Object.fromEntries(BASES.map((b) => [b.id, b]));
export function baseOf(item: Item | string): BaseItem {
  const b = BASE_BY_ID[typeof item === 'string' ? item : item.base];
  if (!b) throw new Error(`unknown item base ${typeof item === 'string' ? item : item.base}`);
  return b;
}

type GemHost = 'weapon' | 'armor' | 'shield';
const G = (stat: StatKey, vals: number[]) => ({ stat, vals });
export const GEM_EFFECTS: Record<GemType, Record<GemHost, { stat: StatKey; vals: number[] }[]>> = {
  ruby: {
    weapon: [G('fireMin', [3, 5, 8, 10, 15]), G('fireMax', [4, 8, 12, 16, 20])],
    armor: [G('life', [10, 17, 24, 31, 38])],
    shield: [G('fireRes', [12, 16, 22, 28, 40])],
  },
  sapphire: {
    weapon: [G('coldMin', [1, 3, 4, 6, 10]), G('coldMax', [3, 5, 7, 10, 14])],
    armor: [G('mana', [10, 17, 24, 31, 38])],
    shield: [G('coldRes', [12, 16, 22, 28, 40])],
  },
  topaz: {
    weapon: [G('lightMin', [1, 1, 1, 1, 1]), G('lightMax', [8, 14, 22, 30, 40])],
    armor: [G('mf', [9, 13, 16, 20, 24])],
    shield: [G('lightRes', [12, 16, 22, 28, 40])],
  },
  emerald: {
    weapon: [G('poisonDmg', [10, 20, 30, 50, 70])],
    armor: [G('dex', [3, 4, 6, 8, 10])],
    shield: [G('poisonRes', [12, 16, 22, 28, 40])],
  },
  amethyst: {
    weapon: [G('ar', [40, 60, 80, 100, 150])],
    armor: [G('str', [3, 4, 6, 8, 10])],
    shield: [G('def', [8, 12, 18, 24, 30])],
  },
  diamond: {
    weapon: [G('crit', [3, 5, 7, 10, 14])],
    armor: [G('ar', [20, 40, 60, 80, 100])],
    shield: [G('allRes', [6, 8, 11, 14, 19])],
  },
  skull: {
    weapon: [G('lifeSteal', [2, 2, 3, 3, 4]), G('manaSteal', [1, 2, 2, 3, 3])],
    armor: [G('lifeRegen', [1, 1, 2, 2, 3]), G('manaRegen', [8, 12, 16, 20, 25])],
    shield: [G('thorns', [4, 8, 12, 16, 20])],
  },
};

export function gemHost(kind: ItemKind): GemHost {
  return kind === 'weapon' ? 'weapon' : kind === 'shield' ? 'shield' : 'armor';
}

export function gemMods(gemBase: string, hostKind: ItemKind): Mod[] {
  const g = baseOf(gemBase).gem!;
  return GEM_EFFECTS[g.type][gemHost(hostKind)].map((e) => ({ stat: e.stat, value: e.vals[g.grade - 1] }));
}

// ---------------------------------------------------------------- affixes

type KindSel = ItemKind | 'melee' | 'caster' | 'bow' | 'jewelry' | 'defensive';
export interface Affix {
  id: string;
  name: string;
  type: 'prefix' | 'suffix';
  lvl: number;
  kinds: KindSel[];
  mods: { stat: StatKey; min: number; max: number }[];
  group: string;
  w?: number;
}

const DEF_KINDS: KindSel[] = ['defensive'];
const P = (id: string, name: string, lvl: number, kinds: KindSel[], group: string, mods: Affix['mods'], w = 10): Affix => ({
  id, name, type: 'prefix', lvl, kinds, mods, group, w,
});
const S = (id: string, name: string, lvl: number, kinds: KindSel[], group: string, mods: Affix['mods'], w = 10): Affix => ({
  id, name, type: 'suffix', lvl, kinds, mods, group, w,
});
const m = (stat: StatKey, min: number, max: number) => ({ stat, min, max });

export const AFFIXES: Affix[] = [
  P('sturdy', 'Sturdy', 1, DEF_KINDS, 'defPct', [m('defPct', 10, 20)]),
  P('strong', 'Strong', 6, DEF_KINDS, 'defPct', [m('defPct', 21, 30)]),
  P('glorious', 'Glorious', 14, DEF_KINDS, 'defPct', [m('defPct', 31, 50)]),
  P('blessed', 'Blessed', 22, DEF_KINDS, 'defPct', [m('defPct', 51, 80)]),
  P('jagged', 'Jagged', 1, ['weapon'], 'edPct', [m('edPct', 10, 20)]),
  P('deadly', 'Deadly', 5, ['weapon'], 'edPct', [m('edPct', 21, 35)]),
  P('vicious', 'Vicious', 10, ['weapon'], 'edPct', [m('edPct', 36, 55)]),
  P('brutal', 'Brutal', 16, ['weapon'], 'edPct', [m('edPct', 56, 80)]),
  P('savage', 'Savage', 24, ['weapon'], 'edPct', [m('edPct', 81, 120)]),
  P('bronze', 'Bronze', 1, ['weapon', 'gloves', 'jewelry'], 'ar', [m('ar', 10, 20)]),
  P('iron', 'Iron', 5, ['weapon', 'gloves', 'jewelry'], 'ar', [m('ar', 21, 40)]),
  P('steel', 'Steel', 11, ['weapon', 'gloves', 'jewelry'], 'ar', [m('ar', 41, 70)]),
  P('golden', 'Golden', 18, ['weapon', 'jewelry'], 'ar', [m('ar', 71, 120)]),
  P('crimson', 'Crimson', 1, ['defensive', 'jewelry'], 'fireRes', [m('fireRes', 5, 10)]),
  P('garnet', 'Garnet', 10, ['defensive', 'jewelry'], 'fireRes', [m('fireRes', 11, 25)]),
  P('azure', 'Azure', 1, ['defensive', 'jewelry'], 'coldRes', [m('coldRes', 5, 10)]),
  P('cobalt', 'Cobalt', 10, ['defensive', 'jewelry'], 'coldRes', [m('coldRes', 11, 25)]),
  P('amber', 'Amber', 1, ['defensive', 'jewelry'], 'lightRes', [m('lightRes', 5, 10)]),
  P('stormy', 'Stormy', 10, ['defensive', 'jewelry'], 'lightRes', [m('lightRes', 11, 25)]),
  P('verdant', 'Verdant', 1, ['defensive', 'jewelry'], 'poisonRes', [m('poisonRes', 5, 10)]),
  P('viridian', 'Viridian', 10, ['defensive', 'jewelry'], 'poisonRes', [m('poisonRes', 11, 25)]),
  P('prismatic', 'Prismatic', 12, ['defensive', 'jewelry'], 'allRes', [m('allRes', 5, 15)], 4),
  P('smoldering', 'Smoldering', 2, ['weapon', 'jewelry'], 'fire', [m('fireMin', 1, 2), m('fireMax', 3, 6)]),
  P('blazing', 'Blazing', 12, ['weapon'], 'fire', [m('fireMin', 4, 8), m('fireMax', 10, 18)]),
  P('chilling', 'Chilling', 3, ['weapon', 'jewelry'], 'cold', [m('coldMin', 1, 2), m('coldMax', 2, 5)]),
  P('freezing', 'Freezing', 13, ['weapon'], 'cold', [m('coldMin', 3, 6), m('coldMax', 8, 14)]),
  P('shocking', 'Shocking', 4, ['weapon', 'jewelry'], 'light', [m('lightMin', 1, 1), m('lightMax', 6, 12)]),
  P('thundering', 'Thundering', 14, ['weapon'], 'light', [m('lightMin', 1, 3), m('lightMax', 20, 35)]),
  P('venomous', 'Venomous', 4, ['weapon'], 'poison', [m('poisonDmg', 8, 16)]),
  P('berserkers', "Berserker's", 6, ['melee', 'amulet', 'helm'], 'skills', [m('skills_reaver', 1, 1)], 4),
  P('magus', "Magus's", 6, ['caster', 'amulet', 'helm'], 'skills', [m('skills_arcanist', 1, 1)], 4),
  P('rangers', "Ranger's", 6, ['bow', 'amulet', 'gloves'], 'skills', [m('skills_huntress', 1, 1)], 4),
  P('gravecallers', "Gravecaller's", 6, ['caster', 'amulet', 'helm'], 'skills', [m('skills_necromancer', 1, 1)], 4),
  P('smiths', "Smith's", 6, ['melee', 'amulet', 'gloves'], 'skills', [m('skills_forgewright', 1, 1)], 4),
  P('lucky', 'Lucky', 3, ['jewelry', 'boots', 'gloves', 'helm'], 'mf', [m('mf', 5, 12)]),
  P('fortuitous', 'Fortuitous', 12, ['jewelry', 'boots', 'gloves', 'helm'], 'mf', [m('mf', 13, 25)]),
  P('lapis', 'Lapis', 4, ['jewelry', 'helm', 'caster', 'shield'], 'mana', [m('mana', 5, 15)]),
  P('sapphirine', 'Sapphirine', 13, ['jewelry', 'helm', 'caster'], 'mana', [m('mana', 16, 30)]),
  S('of_strength', 'of Strength', 1, ['weapon', 'jewelry', 'defensive'], 'str', [m('str', 1, 3)]),
  S('of_might', 'of Might', 8, ['weapon', 'jewelry', 'defensive'], 'str', [m('str', 4, 7)]),
  S('of_the_titan', 'of the Titan', 16, ['weapon', 'jewelry', 'gloves', 'belt'], 'str', [m('str', 8, 12)]),
  S('of_dexterity', 'of Dexterity', 1, ['weapon', 'jewelry', 'defensive'], 'dex', [m('dex', 1, 3)]),
  S('of_finesse', 'of Finesse', 8, ['weapon', 'jewelry', 'defensive'], 'dex', [m('dex', 4, 7)]),
  S('of_grace', 'of Grace', 16, ['weapon', 'jewelry', 'gloves', 'boots'], 'dex', [m('dex', 8, 12)]),
  S('of_vigor', 'of Vigor', 1, ['jewelry', 'defensive'], 'vit', [m('vit', 1, 3)]),
  S('of_endurance', 'of Endurance', 8, ['jewelry', 'defensive'], 'vit', [m('vit', 4, 7)]),
  S('of_fortitude', 'of Fortitude', 16, ['jewelry', 'armor', 'belt', 'shield'], 'vit', [m('vit', 8, 12)]),
  S('of_energy', 'of Energy', 1, ['jewelry', 'caster', 'helm'], 'ene', [m('ene', 1, 3)]),
  S('of_the_mind', 'of the Mind', 8, ['jewelry', 'caster', 'helm'], 'ene', [m('ene', 4, 7)]),
  S('of_brilliance', 'of Brilliance', 16, ['jewelry', 'caster'], 'ene', [m('ene', 8, 12)]),
  S('of_health', 'of Health', 1, ['jewelry', 'defensive'], 'life', [m('life', 3, 10)]),
  S('of_the_bear', 'of the Bear', 8, ['jewelry', 'defensive'], 'life', [m('life', 11, 25)]),
  S('of_the_ox', 'of the Ox', 18, ['amulet', 'armor', 'shield', 'belt'], 'life', [m('life', 26, 40)]),
  S('of_thought', 'of Thought', 1, ['jewelry', 'helm', 'caster'], 'manaMax', [m('mana', 3, 10)]),
  S('of_the_seer', 'of the Seer', 9, ['jewelry', 'helm', 'caster'], 'manaMax', [m('mana', 11, 25)]),
  S('of_the_leech', 'of the Leech', 4, ['weapon', 'ring', 'gloves'], 'lifeSteal', [m('lifeSteal', 3, 5)]),
  S('of_the_vampire', 'of the Vampire', 14, ['weapon', 'ring', 'amulet'], 'lifeSteal', [m('lifeSteal', 6, 8)]),
  S('of_draining', 'of Draining', 4, ['weapon', 'ring', 'gloves'], 'manaSteal', [m('manaSteal', 2, 4)]),
  S('of_readiness', 'of Readiness', 3, ['weapon', 'gloves'], 'ias', [m('ias', 10, 10)]),
  S('of_alacrity', 'of Alacrity', 10, ['weapon', 'gloves'], 'ias', [m('ias', 20, 20)]),
  S('of_pacing', 'of Pacing', 1, ['boots'], 'frw', [m('frw', 10, 10)]),
  S('of_haste', 'of Haste', 8, ['boots'], 'frw', [m('frw', 20, 20)]),
  S('of_speed', 'of Speed', 16, ['boots'], 'frw', [m('frw', 30, 30)]),
  S('of_focus', 'of Focus', 5, ['jewelry', 'caster', 'helm'], 'fcr', [m('fcr', 10, 10)]),
  S('of_sorcery', 'of Sorcery', 14, ['amulet', 'caster'], 'fcr', [m('fcr', 20, 20)]),
  S('of_thorns', 'of Thorns', 1, ['armor', 'shield'], 'thorns', [m('thorns', 1, 3)]),
  S('of_spikes', 'of Spikes', 9, ['armor', 'shield'], 'thorns', [m('thorns', 4, 10)]),
  S('of_mending', 'of Mending', 3, ['jewelry', 'armor', 'helm', 'belt'], 'lifeRegen', [m('lifeRegen', 1, 2)]),
  S('of_regrowth', 'of Regrowth', 13, ['jewelry', 'armor', 'helm', 'belt'], 'lifeRegen', [m('lifeRegen', 3, 5)]),
  S('of_greed', 'of Greed', 1, ['jewelry', 'boots', 'gloves', 'belt'], 'gf', [m('gf', 10, 40)]),
  S('of_fortune', 'of Fortune', 6, ['jewelry', 'boots', 'gloves', 'helm'], 'mfs', [m('mf', 5, 15)]),
  S('of_warding', 'of Warding', 3, ['shield'], 'block', [m('block', 5, 10)]),
  S('of_ruin', 'of Ruin', 8, ['weapon'], 'crit', [m('crit', 5, 12)]),
  S('of_the_bulwark', 'of the Bulwark', 6, ['armor', 'shield', 'helm', 'belt'], 'dmgReduce', [m('dmgReduce', 1, 3)]),
  S('of_the_hunt', 'of the Hunt', 3, ['weapon', 'jewelry', 'gloves'], 'lifeOnKill', [m('lifeOnKill', 1, 4)]),
  S('of_siphoning', 'of Siphoning', 3, ['weapon', 'jewelry', 'caster'], 'manaOnKill', [m('manaOnKill', 1, 3)]),
  S('of_maiming', 'of Maiming', 3, ['weapon', 'gloves', 'ring'], 'maxDmg', [m('maxDmg', 1, 4)]),
  S('of_carnage', 'of Carnage', 12, ['weapon'], 'maxDmg', [m('maxDmg', 5, 10)]),
];

function affixFits(a: Affix, b: BaseItem): boolean {
  return a.kinds.some((k) => {
    if (k === b.kind) return true;
    if (k === 'jewelry') return b.kind === 'ring' || b.kind === 'amulet';
    if (k === 'defensive') return ['armor', 'helm', 'shield', 'gloves', 'boots', 'belt'].includes(b.kind);
    if (k === 'melee') return b.kind === 'weapon' && b.cat !== 'bow' && b.cat !== 'wand' && b.cat !== 'staff';
    if (k === 'caster') return b.cat === 'wand' || b.cat === 'staff' || b.id === 'circlet';
    if (k === 'bow') return b.cat === 'bow';
    return false;
  });
}

// ---------------------------------------------------------------- uniques & sets

export interface UniqueDef {
  id: string;
  name: string;
  base: string;
  qlvl: number;
  mods: { stat: StatKey; min: number; max: number }[];
}

const U = (id: string, name: string, base: string, qlvl: number, mods: UniqueDef['mods']): UniqueDef => ({ id, name, base, qlvl, mods });
export const UNIQUES: UniqueDef[] = [
  U('ember_fang', 'The Ember Fang', 'short_sword', 2, [m('edPct', 50, 80), m('fireMin', 2, 2), m('fireMax', 6, 6), m('ar', 30, 30), m('lifeSteal', 3, 3)]),
  U('gravedigger', "Gravedigger's Mattock", 'club', 3, [m('edPct', 60, 90), m('str', 5, 5), m('ias', 10, 10), m('life', 10, 10)]),
  U('whisperbough', 'Whisperbough', 'short_bow', 3, [m('edPct', 60, 80), m('dex', 5, 5), m('ias', 20, 20), m('frw', 10, 10), m('coldMin', 1, 1), m('coldMax', 4, 4)]),
  U('spark_old_mage', 'Spark of the Old Mage', 'yew_wand', 3, [m('skills_arcanist', 1, 1), m('mana', 15, 15), m('fcr', 10, 10), m('lightRes', 15, 15)]),
  U('pilgrims_cowl', "Pilgrim's Cowl", 'cap', 2, [m('defPct', 40, 60), m('life', 15, 15), m('allRes', 5, 5), m('mf', 15, 15)]),
  U('wanderers_band', "Wanderer's Band", 'ring', 4, [m('dex', 4, 4), m('str', 4, 4), m('mf', 10, 10), m('life', 10, 10)]),
  U('hollowmail', 'Hollowmail', 'leather_armor', 4, [m('defPct', 60, 80), m('vit', 6, 6), m('poisonRes', 25, 25), m('thorns', 4, 4)]),
  U('cinderstep', 'Cinderstep', 'boots', 5, [m('frw', 20, 20), m('fireRes', 25, 25), m('defPct', 40, 60), m('dex', 5, 5)]),
  U('knotted_vow', 'Knotted Vow', 'sash', 6, [m('life', 25, 25), m('str', 5, 5), m('dmgReduce', 2, 2)]),
  U('graspfist', 'Graspfist', 'heavy_gloves', 8, [m('ias', 15, 15), m('str', 6, 6), m('lifeSteal', 3, 3), m('ar', 40, 40)]),
  U('wyrmscale', 'Wyrmscale Ward', 'small_shield', 9, [m('block', 15, 15), m('allRes', 15, 15), m('defPct', 70, 90)]),
  U('coldheart', 'Coldheart Loop', 'ring', 10, [m('coldRes', 25, 25), m('mana', 20, 20), m('manaSteal', 4, 4), m('coldMin', 2, 2), m('coldMax', 6, 6)]),
  U('gloomshroud', 'Gloomshroud', 'studded_leather', 10, [m('defPct', 100, 120), m('frw', 10, 10), m('ias', 10, 10), m('dex', 10, 10), m('allRes', 10, 10)]),
  U('marrowcall', 'Marrowcall', 'bone_wand', 11, [m('skills_necromancer', 2, 2), m('fcr', 20, 20), m('mana', 30, 30), m('poisonRes', 25, 25), m('life', 15, 15)]),
  U('cryptkeepers_shroud', "Cryptkeeper's Shroud", 'hard_leather', 7, [m('skills_necromancer', 1, 1), m('defPct', 60, 80), m('mana', 25, 25), m('poisonRes', 20, 20)]),
  U('ironwrath', 'Ironwrath', 'war_axe', 12, [m('skills_reaver', 2, 2), m('edPct', 80, 110), m('ar', 60, 60), m('life', 20, 20)]),
  U('stormcaller', 'Stormcaller', 'gnarled_staff', 12, [m('skills_arcanist', 2, 2), m('fcr', 20, 20), m('lightRes', 30, 30), m('mana', 40, 40)]),
  U('vaels_requiem', "Vael's Requiem", 'long_bow', 13, [m('edPct', 100, 140), m('skills_huntress', 1, 1), m('ias', 20, 20), m('lightMin', 1, 1), m('lightMax', 25, 25)]),
  U('butchers_oath', "Butcher's Oath", 'great_axe', 14, [m('edPct', 120, 160), m('crit', 15, 15), m('lifeSteal', 6, 6), m('str', 10, 10)]),
  U('plaguevine', 'Plaguevine Grips', 'chain_gloves', 14, [m('poisonDmg', 30, 30), m('poisonRes', 30, 30), m('dex', 8, 8), m('ias', 20, 20)]),
  U('eye_of_hellforge', 'Eye of the Hellforge', 'amulet', 14, [m('allSkills', 1, 1), m('allRes', 15, 15), m('life', 20, 20), m('mf', 20, 20)]),
  U('bulwark_ivo', 'Bulwark of Saint Ivo', 'large_shield', 15, [m('defPct', 120, 150), m('block', 20, 20), m('life', 40, 40), m('dmgReduce', 4, 4)]),
  U('glassfang', 'Glassfang', 'jambiya', 19, [m('edPct', 90, 130), m('crit', 12, 12), m('ias', 25, 25), m('dex', 10, 10)]),
  U('sunder_of_imhara', 'Sunder of Imhara', 'scimitar', 20, [m('edPct', 110, 150), m('fireMin', 8, 8), m('fireMax', 22, 22), m('str', 12, 12), m('lifeSteal', 5, 5)]),
  U('viziers_wrappings', "Vizier's Wrappings", 'lamellar', 21, [m('skills_necromancer', 2, 2), m('defPct', 90, 120), m('life', 35, 35), m('fcr', 15, 15)]),
  U('last_kite', 'The Last Kite', 'recurve_bow', 22, [m('skills_huntress', 2, 2), m('edPct', 100, 140), m('ias', 15, 15), m('frw', 15, 15)]),
  U('caravan_queen', "Caravan Queen's Sandals", 'dune_boots', 19, [m('frw', 35, 35), m('allRes', 15, 15), m('mf', 25, 25), m('life', 25, 25)]),
  U('hollow_crown', 'The Hollow Crown', 'wrapped_helm', 22, [m('allSkills', 1, 1), m('defPct', 100, 130), m('fireRes', 35, 35), m('mana', 50, 50)]),
  U('noons_verdict', "Noon's Verdict", 'dial_staff', 24, [m('skills_arcanist', 3, 3), m('fcr', 30, 30), m('fireRes', 25, 25), m('mana', 60, 60)]),
  U('oathsworn_khopesh', 'The Queen\'s Oath', 'khopesh', 24, [m('skills_reaver', 2, 2), m('edPct', 130, 170), m('lifeSteal', 7, 7), m('allRes', 15, 15)]),
  U('winters_tooth', "Winter's Tooth", 'icicle_dirk', 27, [m('edPct', 110, 150), m('coldMin', 10, 10), m('coldMax', 26, 26), m('ias', 25, 25), m('crit', 12, 12)]),
  U('odruns_hammer', "Odrun's Hammer", 'founders_maul', 29, [m('skills_reaver', 2, 2), m('edPct', 140, 180), m('fireMin', 12, 12), m('fireMax', 34, 34), m('str', 15, 15)]),
  U('last_watch', 'The Last Watch', 'watch_blade', 30, [m('edPct', 130, 170), m('allRes', 20, 20), m('lifeSteal', 6, 6), m('lifeOnKill', 8, 8)]),
  U('emberkeeper', 'Emberkeeper', 'ember_wand', 28, [m('skills_necromancer', 2, 2), m('skills_arcanist', 2, 2), m('fcr', 25, 25), m('fireRes', 30, 30), m('coldRes', 30, 30)]),
  U('founders_voice', "The Founder's Voice", 'bell_staff', 30, [m('skills_arcanist', 3, 3), m('fcr', 35, 35), m('mana', 80, 80), m('coldRes', 35, 35)]),
  U('rimefall', 'Rimefall', 'horn_bow', 28, [m('skills_huntress', 2, 2), m('edPct', 120, 160), m('coldMin', 8, 8), m('coldMax', 20, 20), m('ias', 20, 20)]),
  U('wrens_mantle', "Wren's Mantle", 'fur_mantle', 26, [m('defPct', 100, 130), m('coldRes', 40, 40), m('life', 45, 45), m('allSkills', 1, 1)]),
  U('unlit_crown', 'Crown of the Unlit', 'watch_helm', 31, [m('allSkills', 2, 2), m('defPct', 110, 140), m('coldRes', 40, 40), m('life', 40, 40), m('mana', 40, 40)]),
  U('bell_of_the_deep', 'Bell of the Deep', 'bell_shield', 28, [m('defPct', 120, 150), m('block', 18, 18), m('dmgReduce', 6, 6), m('thorns', 20, 20), m('coldRes', 25, 25)]),
  U('hearthstriders', 'Hearthstriders', 'snow_treads', 26, [m('frw', 35, 35), m('coldRes', 35, 35), m('fireRes', 20, 20), m('lifeRegen', 3, 3), m('vit', 10, 10)]),
  U('first_strike', 'The First Strike', 'sledge', 3, [m('skills_forgewright', 1, 1), m('edPct', 60, 90), m('fireMin', 1, 1), m('fireMax', 5, 5), m('life', 12, 12)]),
  U('bellowsmaw', 'Bellowsmaw', 'war_hammer', 11, [m('skills_forgewright', 2, 2), m('edPct', 90, 120), m('fireMin', 4, 4), m('fireMax', 14, 14), m('fireRes', 25, 25)]),
  U('quenchers_mitts', "Quencher's Mitts", 'heavy_gloves', 9, [m('skills_forgewright', 1, 1), m('ias', 15, 15), m('fireRes', 30, 30), m('str', 8, 8)]),
  U('anvil_of_imhara', 'Anvil of Imhara', 'obsidian_maul', 24, [m('skills_forgewright', 2, 2), m('edPct', 130, 170), m('crit', 12, 12), m('str', 15, 15), m('allRes', 12, 12)]),
  U('crown_of_ash', 'Crown of Ash', 'full_helm', 18, [m('defPct', 100, 130), m('allSkills', 1, 1), m('life', 30, 30), m('fireRes', 30, 30), m('lifeSteal', 4, 4)]),
];
export const UNIQUE_BY_ID: Record<string, UniqueDef> = Object.fromEntries(UNIQUES.map((u) => [u.id, u]));

export interface SetDef {
  id: string;
  name: string;
  /** Pieces drop more often for this class. */
  classId?: ClassId;
  pieces: { id: string; name: string; base: string; mods: { stat: StatKey; min: number; max: number }[] }[];
  /** bonuses[n] applies once n pieces are worn. */
  bonuses: Record<number, Mod[]>;
}

export const SETS: SetDef[] = [
  {
    id: 'ashbound',
    name: 'Ashbound Vigil',
    pieces: [
      { id: 'ashbound_helm', name: 'Ashbound Visor', base: 'skull_cap', mods: [m('life', 15, 15), m('defPct', 30, 30)] },
      { id: 'ashbound_armor', name: 'Ashbound Hauberk', base: 'hard_leather', mods: [m('defPct', 50, 50), m('fireRes', 20, 20)] },
      { id: 'ashbound_gloves', name: 'Ashbound Grips', base: 'leather_gloves', mods: [m('ias', 10, 10), m('str', 5, 5)] },
      { id: 'ashbound_belt', name: 'Ashbound Cord', base: 'light_belt', mods: [m('life', 20, 20)] },
    ],
    bonuses: {
      2: [{ stat: 'ar', value: 60 }],
      3: [{ stat: 'life', value: 40 }],
      4: [{ stat: 'allRes', value: 20 }, { stat: 'edPct', value: 40 }, { stat: 'allSkills', value: 1 }],
    },
  },
  {
    id: 'moonwhisper',
    name: 'Moonwhisper Garb',
    pieces: [
      { id: 'moon_hood', name: 'Moonwhisper Hood', base: 'cap', mods: [m('dex', 5, 5), m('mana', 15, 15)] },
      { id: 'moon_boots', name: 'Moonwhisper Treads', base: 'boots', mods: [m('frw', 20, 20), m('coldRes', 20, 20)] },
      { id: 'moon_band', name: 'Moonwhisper Band', base: 'ring', mods: [m('ar', 50, 50), m('life', 10, 10)] },
    ],
    bonuses: {
      2: [{ stat: 'dex', value: 10 }],
      3: [{ stat: 'frw', value: 15 }, { stat: 'mf', value: 40 }, { stat: 'ias', value: 20 }],
    },
  },
  {
    id: 'cinderguard',
    name: 'Cinderguard Battlegear',
    classId: 'reaver',
    pieces: [
      { id: 'cinderguard_helm', name: 'Cinderguard Helm', base: 'helm', mods: [m('life', 25, 25), m('fireRes', 15, 15)] },
      { id: 'cinderguard_mail', name: 'Cinderguard Mail', base: 'ring_mail', mods: [m('defPct', 60, 60), m('str', 8, 8)] },
      { id: 'cinderguard_fists', name: 'Cinderguard Fists', base: 'heavy_gloves', mods: [m('ias', 15, 15), m('ar', 40, 40)] },
      { id: 'cinderguard_treads', name: 'Cinderguard Treads', base: 'heavy_boots', mods: [m('frw', 15, 15), m('life', 15, 15)] },
    ],
    bonuses: {
      2: [{ stat: 'edPct', value: 30 }],
      3: [{ stat: 'lifeSteal', value: 4 }],
      4: [{ stat: 'skills_reaver', value: 2 }, { stat: 'allRes', value: 20 }, { stat: 'life', value: 40 }],
    },
  },
  {
    id: 'starweave',
    name: 'Starweave Vestments',
    classId: 'arcanist',
    pieces: [
      { id: 'starweave_cowl', name: 'Starweave Cowl', base: 'skull_cap', mods: [m('mana', 25, 25), m('fcr', 10, 10)] },
      { id: 'starweave_robe', name: 'Starweave Robe', base: 'studded_leather', mods: [m('defPct', 40, 40), m('lightRes', 20, 20), m('mana', 20, 20)] },
      { id: 'starweave_wraps', name: 'Starweave Wraps', base: 'leather_gloves', mods: [m('ene', 8, 8), m('coldRes', 15, 15)] },
      { id: 'starweave_sigil', name: 'Starweave Sigil', base: 'amulet', mods: [m('fireRes', 15, 15), m('manaRegen', 12, 12)] },
    ],
    bonuses: {
      2: [{ stat: 'fcr', value: 15 }],
      3: [{ stat: 'mana', value: 40 }],
      4: [{ stat: 'skills_arcanist', value: 2 }, { stat: 'allRes', value: 15 }],
    },
  },
  {
    id: 'thornstalker',
    name: "Thornstalker's Kit",
    classId: 'huntress',
    pieces: [
      { id: 'thornstalker_hood', name: 'Thornstalker Hood', base: 'skull_cap', mods: [m('dex', 8, 8), m('life', 15, 15)] },
      { id: 'thornstalker_jerkin', name: 'Thornstalker Jerkin', base: 'leather_armor', mods: [m('defPct', 50, 50), m('poisonRes', 20, 20)] },
      { id: 'thornstalker_grips', name: 'Thornstalker Grips', base: 'heavy_gloves', mods: [m('ias', 15, 15), m('dex', 6, 6)] },
      { id: 'thornstalker_stride', name: 'Thornstalker Stride', base: 'heavy_boots', mods: [m('frw', 20, 20), m('ar', 40, 40)] },
    ],
    bonuses: {
      2: [{ stat: 'ar', value: 80 }],
      3: [{ stat: 'crit', value: 10 }],
      4: [{ stat: 'skills_huntress', value: 2 }, { stat: 'edPct', value: 40 }, { stat: 'ias', value: 15 }],
    },
  },
  {
    id: 'bonewright',
    name: "Bonewright's Shroud",
    classId: 'necromancer',
    pieces: [
      { id: 'bonewright_mask', name: 'Bonewright Mask', base: 'skull_cap', mods: [m('mana', 20, 20), m('poisonRes', 15, 15)] },
      { id: 'bonewright_mantle', name: 'Bonewright Mantle', base: 'hard_leather', mods: [m('life', 25, 25), m('defPct', 40, 40)] },
      { id: 'bonewright_girdle', name: 'Bonewright Girdle', base: 'light_belt', mods: [m('vit', 6, 6), m('mana', 15, 15)] },
      { id: 'bonewright_talisman', name: 'Bonewright Talisman', base: 'amulet', mods: [m('fcr', 10, 10), m('life', 15, 15)] },
    ],
    bonuses: {
      2: [{ stat: 'manaOnKill', value: 3 }],
      3: [{ stat: 'allRes', value: 15 }],
      4: [{ stat: 'skills_necromancer', value: 2 }, { stat: 'fcr', value: 20 }, { stat: 'mana', value: 40 }],
    },
  },
  {
    id: 'emberwatch',
    name: 'Vigil of the Ember Road',
    pieces: [
      { id: 'emberwatch_helm', name: "Vigil's Watch Helm", base: 'watch_helm', mods: [m('coldRes', 25, 25), m('life', 35, 35)] },
      { id: 'emberwatch_mantle', name: "Vigil's Mantle", base: 'fur_mantle', mods: [m('defPct', 80, 80), m('vit', 12, 12)] },
      { id: 'emberwatch_mitts', name: "Vigil's Mitts", base: 'fur_mitts', mods: [m('ias', 15, 15), m('fireMin', 6, 6), m('fireMax', 14, 14)] },
      { id: 'emberwatch_treads', name: "Vigil's Treads", base: 'snow_treads', mods: [m('frw', 25, 25), m('coldRes', 20, 20)] },
      { id: 'emberwatch_girdle', name: "Vigil's Girdle", base: 'founders_girdle', mods: [m('life', 40, 40), m('mana', 30, 30)] },
    ],
    bonuses: {
      2: [{ stat: 'coldRes', value: 30 }],
      3: [{ stat: 'life', value: 60 }, { stat: 'lifeRegen', value: 3 }],
      4: [{ stat: 'allRes', value: 20 }, { stat: 'mf', value: 40 }],
      5: [{ stat: 'allSkills', value: 2 }, { stat: 'dmgReduce', value: 6 }, { stat: 'edPct', value: 50 }],
    },
  },
  {
    id: 'emberwright',
    name: "Emberwright's Harness",
    classId: 'forgewright',
    pieces: [
      { id: 'emberwright_visor', name: 'Emberwright Visor', base: 'helm', mods: [m('life', 20, 20), m('fireRes', 20, 20)] },
      { id: 'emberwright_apron', name: 'Emberwright Apron', base: 'studded_leather', mods: [m('defPct', 60, 60), m('str', 8, 8)] },
      { id: 'emberwright_mitts', name: 'Emberwright Mitts', base: 'heavy_gloves', mods: [m('ias', 15, 15), m('fireMin', 2, 2), m('fireMax', 8, 8)] },
      { id: 'emberwright_girdle', name: 'Emberwright Girdle', base: 'belt', mods: [m('life', 25, 25), m('dmgReduce', 2, 2)] },
    ],
    bonuses: {
      2: [{ stat: 'edPct', value: 30 }],
      3: [{ stat: 'life', value: 40 }, { stat: 'fireRes', value: 20 }],
      4: [{ stat: 'skills_forgewright', value: 2 }, { stat: 'allRes', value: 15 }, { stat: 'ias', value: 15 }],
    },
  },
  {
    id: 'imharan',
    name: 'Regalia of Lost Imhara',
    pieces: [
      { id: 'imharan_helm', name: 'Imharan Diadem', base: 'wrapped_helm', mods: [m('allRes', 12, 12), m('life', 25, 25)] },
      { id: 'imharan_coat', name: 'Imharan Coat', base: 'lamellar', mods: [m('defPct', 70, 70), m('vit', 10, 10)] },
      { id: 'imharan_targe', name: 'Imharan Targe', base: 'bronze_targe', mods: [m('block', 12, 12), m('fireRes', 25, 25)] },
      { id: 'imharan_boots', name: 'Imharan Sandals', base: 'dune_boots', mods: [m('frw', 20, 20), m('mana', 25, 25)] },
    ],
    bonuses: {
      2: [{ stat: 'life', value: 40 }],
      3: [{ stat: 'fireRes', value: 30 }, { stat: 'mf', value: 40 }],
      4: [{ stat: 'allSkills', value: 1 }, { stat: 'dmgReduce', value: 6 }, { stat: 'allRes', value: 20 }],
    },
  },
];
export const SET_PIECES = SETS.flatMap((s) => s.pieces.map((p) => ({ ...p, setId: s.id, qlvl: Math.max(2, baseOf(p.base).qlvl + 2) })));
export const SET_BY_ID: Record<string, SetDef> = Object.fromEntries(SETS.map((s) => [s.id, s]));

// ---------------------------------------------------------------- generation

let uidCounter = 1;
export function nextUid(): number {
  return uidCounter++;
}
export function bumpUid(min: number) {
  if (uidCounter <= min) uidCounter = min + 1;
}

export function isEquipment(b: BaseItem): boolean {
  return !['potion', 'gem', 'scroll'].includes(b.kind);
}

export const EQUIP_KINDS: ItemKind[] = ['weapon', 'shield', 'armor', 'helm', 'gloves', 'boots', 'belt', 'ring', 'amulet'];

const CLASS_WEAPONS: Record<ClassId, WeaponCat[]> = {
  reaver: ['sword', 'axe', 'mace'],
  arcanist: ['wand', 'staff'],
  huntress: ['bow', 'dagger'],
  necromancer: ['wand', 'dagger'],
  forgewright: ['mace', 'axe'],
};

export function makeItem(baseId: string, ilvl = 1, rarity: Rarity = 'normal'): Item {
  const b = baseOf(baseId);
  const item: Item = { uid: nextUid(), base: baseId, rarity, ilvl, identified: true, mods: [], sockets: 0, gems: [], reqLvl: 1 };
  if (b.defMin !== undefined) item.def = b.defMin;
  return item;
}

function rollAffixes(rng: Rng, b: BaseItem, ilvl: number, nPre: number, nSuf: number): { mods: Mod[]; pre: Affix[]; suf: Affix[] } {
  const used = new Set<string>();
  const pick = (type: 'prefix' | 'suffix', n: number) => {
    const out: Affix[] = [];
    for (let i = 0; i < n; i++) {
      const pool = AFFIXES.filter((a) => a.type === type && a.lvl <= ilvl && !used.has(a.group) && affixFits(a, b));
      if (!pool.length) break;
      // Favour affixes close to the item level so deeper drops are stronger.
      const a = rng.weighted(pool.map((v) => ({ w: (v.w ?? 10) * (1 + v.lvl / Math.max(4, ilvl)), v })));
      used.add(a.group);
      out.push(a);
    }
    return out;
  };
  const pre = pick('prefix', nPre);
  const suf = pick('suffix', nSuf);
  const mods: Mod[] = [];
  for (const a of [...pre, ...suf]) for (const md of a.mods) mods.push({ stat: md.stat, value: rng.int(md.min, md.max) });
  return { mods, pre, suf };
}

const RARE_A = ['Ash', 'Blood', 'Bone', 'Doom', 'Dread', 'Ghoul', 'Grim', 'Gloom', 'Hate', 'Pain', 'Plague', 'Rune', 'Shadow', 'Skull', 'Storm', 'Viper', 'Wraith', 'Cinder', 'Hollow', 'Night'];
const RARE_B: Partial<Record<ItemKind | 'bow', string[]>> = {
  weapon: ['Bite', 'Cleaver', 'Edge', 'Fang', 'Gnash', 'Razor', 'Song', 'Spike', 'Thirst', 'Wound'],
  bow: ['Flight', 'Quill', 'Branch', 'Wing', 'Thorn'],
  armor: ['Shell', 'Ward', 'Hide', 'Coat', 'Carapace', 'Mantle'],
  helm: ['Crown', 'Visage', 'Brow', 'Veil', 'Hood'],
  shield: ['Wall', 'Guard', 'Bastion', 'Aegis'],
  gloves: ['Grip', 'Hand', 'Claw', 'Fist'],
  boots: ['Stride', 'Trek', 'Spur', 'Track'],
  belt: ['Coil', 'Lock', 'Strap', 'Girdle'],
  ring: ['Band', 'Loop', 'Circle', 'Whorl'],
  amulet: ['Charm', 'Talisman', 'Heart', 'Eye'],
};

function finalize(item: Item, rng: Rng) {
  const b = baseOf(item);
  if (b.defMin !== undefined) item.def = rng.int(b.defMin, b.defMax!);
}

export function pickBase(rng: Rng, ilvl: number, classId?: ClassId, kinds = EQUIP_KINDS): BaseItem {
  const pool = BASES.filter((b) => kinds.includes(b.kind) && b.qlvl <= ilvl && b.qlvl >= ilvl - 14);
  const fallback = pool.length ? pool : BASES.filter((b) => kinds.includes(b.kind) && b.qlvl <= Math.max(1, ilvl));
  return rng.weighted(
    fallback.map((b) => {
      let w = 1 + b.qlvl / Math.max(1, ilvl);
      if (b.forClass) w *= b.forClass === classId ? 2 : 0.15;
      else if (b.kind === 'weapon') w *= classId && CLASS_WEAPONS[classId].includes(b.cat!) ? 1.6 : 0.6;
      if (b.kind === 'ring' || b.kind === 'amulet') w *= 0.7;
      return { w, v: b };
    }),
  );
}

export interface RarityRoll {
  mf: number;
  /** Multiplier on unique/set/rare odds (champions, bosses). */
  bonus: number;
}

export function rollRarity(rng: Rng, { mf, bonus }: RarityRoll): Rarity {
  const eff = (k: number) => (mf * k) / (mf + k);
  if (rng.chance(0.01 * bonus * (1 + eff(250) / 100))) return 'unique';
  if (rng.chance(0.018 * bonus * (1 + eff(500) / 100))) return 'set';
  if (rng.chance(0.07 * Math.sqrt(bonus) * (1 + eff(600) / 100))) return 'rare';
  if (rng.chance(Math.min(0.85, 0.3 * Math.sqrt(bonus) * (1 + mf / 100)))) return 'magic';
  return 'normal';
}

export interface GenOpts {
  mf?: number;
  bonus?: number;
  rarity?: Rarity;
  base?: string;
  classId?: ClassId;
  kinds?: ItemKind[];
}

export function generateItem(rng: Rng, ilvl: number, opts: GenOpts = {}): Item {
  let b = opts.base ? baseOf(opts.base) : pickBase(rng, ilvl, opts.classId, opts.kinds);
  let rarity = opts.rarity ?? rollRarity(rng, { mf: opts.mf ?? 0, bonus: opts.bonus ?? 1 });
  if (rarity === 'unique') {
    const kindOk = (base: string) => !opts.kinds || opts.kinds.includes(baseOf(base).kind);
    const pool = UNIQUES.filter((u) => u.qlvl <= ilvl && (u.base === b.id || !opts.base) && kindOk(u.base));
    const exact = pool.filter((u) => u.base === b.id);
    const u = exact.length && rng.chance(0.6) ? rng.pick(exact) : pool.length ? rng.pick(pool) : null;
    if (u) {
      const item = makeItem(u.base, ilvl, 'unique');
      item.uniqueId = u.id;
      item.name = u.name;
      item.mods = u.mods.map((md) => ({ stat: md.stat, value: rng.int(md.min, md.max) }));
      item.reqLvl = Math.max(1, Math.floor(u.qlvl * 0.9));
      item.identified = false;
      finalize(item, rng);
      return item;
    }
    rarity = 'rare';
  }
  if (rarity === 'set') {
    const pool = SET_PIECES.filter(
      (p) => p.qlvl <= ilvl && (!opts.base || p.base === b.id) && (!opts.kinds || opts.kinds.includes(baseOf(p.base).kind)),
    );
    if (pool.length) {
      const p = rng.weighted(pool.map((v) => ({ w: opts.classId && SET_BY_ID[v.setId].classId === opts.classId ? 3 : 1, v })));
      const item = makeItem(p.base, ilvl, 'set');
      item.setId = p.setId;
      item.uniqueId = p.id;
      item.name = p.name;
      item.mods = p.mods.map((md) => ({ stat: md.stat, value: rng.int(md.min, md.max) }));
      item.reqLvl = Math.max(1, p.qlvl - 1);
      item.identified = false;
      finalize(item, rng);
      return item;
    }
    rarity = 'rare';
  }
  if (rarity === 'normal' && b.magicOnly) rarity = 'magic';
  b = baseOf(b.id);
  const item = makeItem(b.id, ilvl, rarity);
  if (rarity === 'normal') {
    if (b.maxSockets && rng.chance(0.25)) item.sockets = rng.int(1, b.maxSockets);
  } else if (rarity === 'magic') {
    const r = rng.next();
    const { mods, pre, suf } = rollAffixes(rng, b, ilvl, r < 0.75 ? 1 : 0, r > 0.25 ? 1 : 0);
    item.mods = mods;
    item.name = [pre[0]?.name, b.name, suf[0]?.name].filter(Boolean).join(' ');
    item.reqLvl = Math.max(1, ...[...pre, ...suf].map((a) => Math.floor(a.lvl * 0.8)));
    item.identified = false;
  } else {
    const total = rng.int(3, Math.min(6, 3 + Math.floor(ilvl / 6)));
    const nPre = rng.int(1, Math.min(3, total - 1));
    const { mods, pre, suf } = rollAffixes(rng, b, ilvl, nPre, Math.min(3, total - nPre));
    item.mods = mods;
    const key = b.cat === 'bow' ? 'bow' : b.kind;
    item.name = `${rng.pick(RARE_A)} ${rng.pick(RARE_B[key] ?? RARE_B.weapon!)}`;
    item.reqLvl = Math.max(1, ...[...pre, ...suf].map((a) => Math.floor(a.lvl * 0.9) + 1));
    item.identified = false;
  }
  finalize(item, rng);
  return item;
}

// ---------------------------------------------------------------- queries

/** All active modifiers on an item: rolled affixes plus socketed gems. Unidentified items give nothing. */
export function itemMods(item: Item): Mod[] {
  if (!item.identified) return [];
  const out = item.mods.slice();
  const b = baseOf(item);
  for (const g of item.gems) out.push(...gemMods(g, b.kind));
  return out;
}

export function modTotal(item: Item, stat: StatKey): number {
  let v = 0;
  for (const md of itemMods(item)) if (md.stat === stat) v += md.value;
  return v;
}

/** Item defense with its own +% defense applied (local mod, as in the classics). */
export function itemDefense(item: Item): number {
  if (item.def === undefined) return 0;
  return Math.floor(item.def * (1 + modTotal(item, 'defPct') / 100));
}

export function displayName(item: Item): string {
  const b = baseOf(item);
  if (!item.identified) return b.name;
  if (item.rarity === 'normal') return item.sockets ? `${b.name} [${item.sockets}]` : b.name;
  return item.name ?? b.name;
}

export const RARITY_COLORS: Record<Rarity | 'socketed' | 'gold', string> = {
  normal: '#e8e2d0',
  socketed: '#9b9b9b',
  magic: '#6c7cff',
  rare: '#f5e45c',
  set: '#3fd34a',
  unique: '#c7a46b',
  gold: '#e8c860',
};

export function itemColor(item: Item): string {
  if (item.rarity === 'normal') {
    const b = baseOf(item);
    if (b.kind === 'gem') return '#e8e2d0';
    return item.sockets ? RARITY_COLORS.socketed : RARITY_COLORS.normal;
  }
  return RARITY_COLORS[item.rarity];
}

const STAT_TEXT: Record<StatKey, (v: number) => string> = {
  str: (v) => `+${v} to Strength`,
  dex: (v) => `+${v} to Dexterity`,
  vit: (v) => `+${v} to Vitality`,
  ene: (v) => `+${v} to Energy`,
  allAttr: (v) => `+${v} to all Attributes`,
  life: (v) => `+${v} to Life`,
  mana: (v) => `+${v} to Mana`,
  minDmg: (v) => `+${v} to Minimum Damage`,
  maxDmg: (v) => `+${v} to Maximum Damage`,
  edPct: (v) => `+${v}% Enhanced Damage`,
  ar: (v) => `+${v} to Attack Rating`,
  arPct: (v) => `+${v}% Attack Rating`,
  def: (v) => `+${v} Defense`,
  defPct: (v) => `+${v}% Enhanced Defense`,
  fireRes: (v) => `Fire Resist +${v}%`,
  coldRes: (v) => `Cold Resist +${v}%`,
  lightRes: (v) => `Lightning Resist +${v}%`,
  poisonRes: (v) => `Poison Resist +${v}%`,
  allRes: (v) => `All Resistances +${v}`,
  fireMin: (v) => `+${v} Minimum Fire Damage`,
  fireMax: (v) => `+${v} Maximum Fire Damage`,
  coldMin: (v) => `+${v} Minimum Cold Damage`,
  coldMax: (v) => `+${v} Maximum Cold Damage`,
  lightMin: (v) => `+${v} Minimum Lightning Damage`,
  lightMax: (v) => `+${v} Maximum Lightning Damage`,
  poisonDmg: (v) => `+${v} Poison Damage over 3 seconds`,
  lifeSteal: (v) => `${v}% Life Stolen per Hit`,
  manaSteal: (v) => `${v}% Mana Stolen per Hit`,
  ias: (v) => `+${v}% Increased Attack Speed`,
  frw: (v) => `+${v}% Faster Run/Walk`,
  fcr: (v) => `+${v}% Faster Cast Rate`,
  mf: (v) => `${v}% Better Chance of Getting Magic Items`,
  gf: (v) => `${v}% Extra Gold from Monsters`,
  thorns: (v) => `Attacker Takes Damage of ${v}`,
  lifeRegen: (v) => `Replenish Life +${v}`,
  manaRegen: (v) => `Regenerate Mana ${v}%`,
  allSkills: (v) => `+${v} to All Skills`,
  skills_reaver: (v) => `+${v} to Reaver Skills`,
  skills_arcanist: (v) => `+${v} to Arcanist Skills`,
  skills_huntress: (v) => `+${v} to Huntress Skills`,
  skills_necromancer: (v) => `+${v} to Necromancer Skills`,
  skills_forgewright: (v) => `+${v} to Forgewright Skills`,
  block: (v) => `${v}% Increased Chance of Blocking`,
  crit: (v) => `${v}% Chance of Deadly Strike`,
  dmgReduce: (v) => `Damage Reduced by ${v}`,
  lifeOnKill: (v) => `+${v} Life after each Kill`,
  manaOnKill: (v) => `+${v} to Mana after each Kill`,
};

/** Collapse min/max pairs into one line like the classics do. */
export function describeMods(mods: Mod[]): string[] {
  const sum: Partial<Record<StatKey, number>> = {};
  const order: StatKey[] = [];
  for (const md of mods) {
    if (sum[md.stat] === undefined) order.push(md.stat);
    sum[md.stat] = (sum[md.stat] ?? 0) + md.value;
  }
  const lines: string[] = [];
  const pairs: [StatKey, StatKey, string][] = [
    ['fireMin', 'fireMax', 'Fire'],
    ['coldMin', 'coldMax', 'Cold'],
    ['lightMin', 'lightMax', 'Lightning'],
  ];
  const done = new Set<StatKey>();
  for (const st of order) {
    if (done.has(st)) continue;
    const pair = pairs.find((p) => p[0] === st || p[1] === st);
    if (pair && sum[pair[0]] !== undefined && sum[pair[1]] !== undefined) {
      lines.push(`Adds ${sum[pair[0]]}-${sum[pair[1]]} ${pair[2]} Damage`);
      done.add(pair[0]).add(pair[1]);
      continue;
    }
    lines.push(STAT_TEXT[st](sum[st]!));
    done.add(st);
  }
  return lines;
}

export function itemValue(item: Item): number {
  const b = baseOf(item);
  if (b.value) return b.value;
  const mult = { normal: 1, magic: 2.5, rare: 5, set: 6, unique: 8 }[item.rarity];
  return Math.floor((20 + b.qlvl * 18) * mult + item.mods.length * 25 + item.sockets * 30 + item.ilvl * 4);
}

export function sellPrice(item: Item): number {
  return Math.max(1, Math.floor(itemValue(item) / 4));
}

export function buyPrice(item: Item): number {
  return Math.floor(itemValue(item) * 1.25);
}

export function gamblePrice(kind: ItemKind, clvl: number): number {
  const k = kind === 'ring' || kind === 'amulet' ? 1.6 : kind === 'weapon' || kind === 'armor' ? 1.2 : 1;
  return Math.floor((150 + clvl * clvl * 12 + clvl * 60) * k);
}

/** Gamble result: random base of the kind, much better odds than a drop. */
export function gamble(rng: Rng, kind: ItemKind, clvl: number): Item {
  const r = rng.next();
  const rarity: Rarity = r < 0.02 ? 'unique' : r < 0.05 ? 'set' : r < 0.2 ? 'rare' : 'magic';
  return generateItem(rng, Math.max(1, clvl + rng.int(-2, 4)), { kinds: [kind], rarity });
}

export function potionFor(type: 'hp' | 'mp', ilvl: number): string {
  const tiers = BASES.filter((b) => b.potion?.type === type && b.qlvl <= Math.max(1, ilvl));
  return tiers[tiers.length - 1].id;
}

export type Drop = { kind: 'gold'; amount: number } | { kind: 'item'; item: Item };
export type DropTier = 'normal' | 'champion' | 'unique' | 'boss' | 'chest' | 'barrel';

const TIER: Record<DropTier, { picks: number; nodrop: number; bonus: number }> = {
  normal: { picks: 1, nodrop: 0.6, bonus: 1 },
  champion: { picks: 2, nodrop: 0.35, bonus: 1.8 },
  unique: { picks: 4, nodrop: 0.2, bonus: 3 },
  boss: { picks: 7, nodrop: 0, bonus: 8 },
  chest: { picks: 2, nodrop: 0.3, bonus: 1.2 },
  barrel: { picks: 1, nodrop: 0.55, bonus: 1 },
};

export function rollDrops(rng: Rng, mlvl: number, tier: DropTier, opts: { mf?: number; gf?: number; classId?: ClassId } = {}): Drop[] {
  const t = TIER[tier];
  const out: Drop[] = [];
  let guaranteedMagic = tier === 'boss' ? 3 : tier === 'unique' ? 1 : 0;
  for (let i = 0; i < t.picks; i++) {
    if (rng.chance(t.nodrop)) continue;
    const what = rng.weighted([
      { w: 30, v: 'gold' },
      { w: 26, v: 'potion' },
      { w: guaranteedMagic > 0 ? 200 : 30, v: 'item' },
      { w: 4, v: 'gem' },
      { w: 4, v: 'tp' },
      { w: 2, v: 'rejuv' },
    ] as const);
    if (what === 'gold') {
      const amt = Math.floor((rng.int(2, 10) + mlvl * rng.range(2, 5)) * (1 + (opts.gf ?? 0) / 100) * (tier === 'boss' ? 4 : 1));
      out.push({ kind: 'gold', amount: Math.max(1, amt) });
    } else if (what === 'potion') {
      out.push({ kind: 'item', item: makeItem(potionFor(rng.chance(0.6) ? 'hp' : 'mp', mlvl)) });
    } else if (what === 'rejuv') {
      out.push({ kind: 'item', item: makeItem(mlvl >= 18 && rng.chance(0.3) ? 'rejuv_full' : 'rejuv') });
    } else if (what === 'tp') {
      out.push({ kind: 'item', item: makeItem('tp_scroll') });
    } else if (what === 'gem') {
      const grades = GEM_QLVL.filter((q) => q <= mlvl).length;
      const grade = Math.max(1, rng.int(Math.max(1, grades - 1), grades));
      out.push({ kind: 'item', item: makeItem(`gem_${rng.pick(GEM_TYPES)}_${grade}`) });
    } else {
      const forceMagic = guaranteedMagic > 0;
      guaranteedMagic--;
      let item = generateItem(rng, mlvl, { mf: opts.mf, bonus: t.bonus, classId: opts.classId });
      if (forceMagic && item.rarity === 'normal') item = generateItem(rng, mlvl, { rarity: rng.chance(0.3) ? 'rare' : 'magic', classId: opts.classId });
      out.push({ kind: 'item', item });
    }
  }
  // Bosses and uniques always deliver their promised magic items, whatever the picks rolled.
  for (; guaranteedMagic > 0; guaranteedMagic--) {
    out.push({ kind: 'item', item: generateItem(rng, mlvl, { mf: opts.mf, bonus: t.bonus, classId: opts.classId, rarity: rng.chance(0.3) ? 'rare' : 'magic' }) });
  }
  return out;
}
