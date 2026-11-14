import {
  BASES, baseOf, itemDefense, itemMods, makeItem, SET_BY_ID, weaponBaseDamage,
  type BaseItem, type ClassId, type Item, type Mod, type PotionInfo, type Slot, type StatKey,
} from './items';
import { classSkills, SKILL_BY_ID, type SkillDef } from './skills';

export interface ClassDef {
  id: ClassId;
  name: string;
  str: number;
  dex: number;
  vit: number;
  ene: number;
  life: number;
  lifePerLvl: number;
  lifePerVit: number;
  mana: number;
  manaPerLvl: number;
  manaPerEne: number;
  arBonus: number;
  castTime: number;
  color: string;
  desc: string;
  start: string[];
  starter: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  reaver: {
    id: 'reaver', name: 'Reaver', str: 30, dex: 20, vit: 25, ene: 10, life: 55, lifePerLvl: 2, lifePerVit: 4,
    mana: 10, manaPerLvl: 1, manaPerEne: 1, arBonus: 20, castTime: 0.6, color: '#b5542f',
    desc: 'A savage warrior of the northern clans. Masters every melee weapon, shrugs off blows and tears through crowds.',
    start: ['short_sword', 'buckler'], starter: 'bash',
  },
  arcanist: {
    id: 'arcanist', name: 'Arcanist', str: 10, dex: 25, vit: 10, ene: 35, life: 40, lifePerLvl: 1, lifePerVit: 2,
    mana: 35, manaPerLvl: 2, manaPerEne: 2, arBonus: -15, castTime: 0.45, color: '#4f7bd8',
    desc: 'A scholar of fire, frost and storm. Fragile, but commands devastating elemental magic.',
    start: ['short_staff'], starter: 'fire_bolt',
  },
  huntress: {
    id: 'huntress', name: 'Huntress', str: 20, dex: 25, vit: 20, ene: 15, life: 50, lifePerLvl: 2, lifePerVit: 3,
    mana: 15, manaPerLvl: 1.5, manaPerEne: 1.5, arBonus: 5, castTime: 0.55, color: '#4f9d58',
    desc: 'A swift archer from the deep woods. Rains arrows on her foes and slips away from danger.',
    start: ['short_bow'], starter: 'power_shot',
  },
  necromancer: {
    id: 'necromancer', name: 'Necromancer', str: 15, dex: 25, vit: 15, ene: 25, life: 45, lifePerLvl: 1.5, lifePerVit: 2,
    mana: 25, manaPerLvl: 2, manaPerEne: 2, arBonus: -10, castTime: 0.5, color: '#6c8a5c',
    desc: 'A pale scholar of the grave. Raises the dead as servants, curses foes and shatters them with bone.',
    start: ['yew_wand'], starter: 'bone_shards',
  },
  forgewright: {
    id: 'forgewright', name: 'Forgewright', str: 28, dex: 18, vit: 24, ene: 15, life: 55, lifePerLvl: 2, lifePerVit: 3.5,
    mana: 18, manaPerLvl: 1.5, manaPerEne: 1.5, arBonus: 15, castTime: 0.55, color: '#c8782a',
    desc: 'A smith-warden of the old forges. Swings a great hammer, builds turrets and golems mid-fight, and runs hot: Heat makes every blow burn, until it burns the smith.',
    start: ['sledge'], starter: 'sunder',
  },
};

export const SAVE_VERSION = 3;
export const INV_COLS = 10;
export const INV_ROWS = 4;
export const STASH_COLS = 10;
export const STASH_ROWS = 8;
export const MAX_LEVEL = 60;
export const DIFFICULTIES = ['Normal', 'Nightmare', 'Hell'];

export interface GridEntry {
  item: Item;
  x: number;
  y: number;
}

export type EssenceType = 'fire' | 'cold' | 'light' | 'poison';
export const ESSENCE_TYPES: EssenceType[] = ['fire', 'cold', 'light', 'poison'];

/** What a hero has gathered and learned at the Forge. */
export interface ForgeState {
  /** The common material, from salvaging anything. */
  cinders: number;
  /** Elemental essences, from salvaging magic and better items. */
  essences: Record<EssenceType, number>;
  /** Forge mastery experience: grows with every job done at the Forge. */
  xp: number;
}

export function newForgeState(): ForgeState {
  return { cinders: 0, essences: { fire: 0, cold: 0, light: 0, poison: 0 }, xp: 0 };
}

export type QuestState = 'none' | 'active' | 'done' | 'rewarded';

export interface Character {
  version: number;
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  statPoints: number;
  skillPoints: number;
  alloc: { str: number; dex: number; vit: number; ene: number };
  skills: Record<string, number>;
  equipment: Partial<Record<Slot, Item>>;
  inventory: GridEntry[];
  stash: GridEntry[];
  /** How many of each potion base the hero carries. */
  potions: Record<string, number>;
  gold: number;
  stashGold: number;
  tpCharges: number;
  hotbar: (string | null)[];
  waypoints: string[];
  quests: Record<string, QuestState>;
  difficulty: number;
  maxDifficulty: number;
  hardcore: boolean;
  dead: boolean;
  created: number;
  playTime: number;
  forge: ForgeState;
  /** Feats, for the character sheet. Absent on heroes from before they were counted. */
  bestSpree?: number;
  tithes?: number;
  purges?: number;
  /** The deepest floor of the Underforge whose warden has fallen, by difficulty. */
  deepest?: number[];
}

export function createCharacter(name: string, classId: ClassId, hardcore = false): Character {
  const cls = CLASSES[classId];
  const c: Character = {
    version: SAVE_VERSION,
    id: `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    classId,
    level: 1,
    xp: 0,
    statPoints: 0,
    skillPoints: 0,
    alloc: { str: 0, dex: 0, vit: 0, ene: 0 },
    skills: { [cls.starter]: 1 },
    equipment: {},
    inventory: [],
    stash: [],
    potions: { hp1: 2, mp1: 2 },
    gold: 100,
    stashGold: 0,
    tpCharges: 2,
    hotbar: ['attack', cls.starter, null, null],
    waypoints: ['0:town'],
    quests: {},
    difficulty: 0,
    maxDifficulty: 0,
    hardcore,
    dead: false,
    created: Date.now(),
    playTime: 0,
    forge: newForgeState(),
  };
  for (const b of cls.start) {
    const it = makeItem(b);
    c.equipment[baseOf(b).kind === 'shield' ? 'offhand' : 'weapon'] = it;
  }
  return c;
}

// ---------------------------------------------------------------- experience

export const XP_TABLE: number[] = [0, 0];
for (let n = 2; n <= MAX_LEVEL + 1; n++) XP_TABLE[n] = Math.round(80 * Math.pow(n - 1, 2.2));

export function xpForLevel(level: number): number {
  return XP_TABLE[Math.min(level, MAX_LEVEL + 1)];
}

export function xpMultiplier(mlvl: number, clvl: number): number {
  const d = mlvl - clvl;
  if (d < -5) return Math.max(0.05, 1 - (-d - 5) * 0.15);
  if (d > 5) return Math.max(0.3, 1 - (d - 5) * 0.1);
  return 1;
}

/** Adds experience and returns how many levels were gained. */
export function addXp(c: Character, amount: number): number {
  if (c.level >= MAX_LEVEL) return 0;
  c.xp += Math.max(0, Math.floor(amount));
  let gained = 0;
  while (c.level < MAX_LEVEL && c.xp >= xpForLevel(c.level + 1)) {
    c.level++;
    c.statPoints += 5;
    c.skillPoints += 1;
    gained++;
  }
  return gained;
}

// ---------------------------------------------------------------- skills

export function skillBonusFromItems(c: Character): number {
  let v = 0;
  for (const md of equippedMods(c)) {
    if (md.stat === 'allSkills' || md.stat === `skills_${c.classId}`) v += md.value;
  }
  return v;
}

/** Effective skill level: hard points plus +skills (only for learned skills). */
export function skillLevel(c: Character, id: string, bonus = skillBonusFromItems(c)): number {
  if (id === 'attack') return 1;
  const hard = c.skills[id] ?? 0;
  return hard > 0 ? hard + bonus : 0;
}

export function canLearn(c: Character, s: SkillDef): string | null {
  if (s.classId !== c.classId) return 'Wrong class';
  if (c.skillPoints <= 0) return 'No skill points';
  if (c.level < s.reqLevel) return `Requires level ${s.reqLevel}`;
  if ((c.skills[s.id] ?? 0) >= 20) return 'Maximum level';
  for (const p of s.prereq ?? []) if (!c.skills[p]) return `Requires ${SKILL_BY_ID[p].name}`;
  return null;
}

export function learnSkill(c: Character, id: string): boolean {
  const s = SKILL_BY_ID[id];
  if (!s || canLearn(c, s)) return false;
  c.skills[id] = (c.skills[id] ?? 0) + 1;
  c.skillPoints--;
  if (s.kind !== 'passive' && !c.hotbar.includes(id)) {
    const free = c.hotbar.indexOf(null);
    if (free >= 0) c.hotbar[free] = id;
  }
  return true;
}

export function allocStat(c: Character, stat: keyof Character['alloc']): boolean {
  if (c.statPoints <= 0) return false;
  c.alloc[stat]++;
  c.statPoints--;
  return true;
}

// ---------------------------------------------------------------- derived stats

export interface Buffs {
  defPct?: number;
  lifePct?: number;
  manaPct?: number;
  ias?: number;
  frw?: number;
  edPct?: number;
  ar?: number;
}

export interface Stats {
  str: number;
  dex: number;
  vit: number;
  ene: number;
  maxLife: number;
  maxMana: number;
  lifeRegen: number;
  manaRegen: number;
  ar: number;
  def: number;
  minDmg: number;
  maxDmg: number;
  fireMin: number;
  fireMax: number;
  coldMin: number;
  coldMax: number;
  lightMin: number;
  lightMax: number;
  poisonDmg: number;
  attackSpeed: number;
  castTime: number;
  moveSpeed: number;
  range: number;
  isBow: boolean;
  res: { fire: number; cold: number; light: number; poison: number };
  block: number;
  lifeSteal: number;
  manaSteal: number;
  mf: number;
  gf: number;
  thorns: number;
  crit: number;
  evade: number;
  dmgReduce: number;
  lifeOnKill: number;
  manaOnKill: number;
  skillBonus: number;
  potionCap: number;
}

export function equippedItems(c: Character): Item[] {
  return Object.values(c.equipment).filter((i): i is Item => !!i);
}

/** All item, gem and set bonus mods from worn gear. */
export function equippedMods(c: Character): Mod[] {
  const out: Mod[] = [];
  const setCounts: Record<string, number> = {};
  for (const it of equippedItems(c)) {
    out.push(...itemMods(it));
    if (it.setId && it.identified) setCounts[it.setId] = (setCounts[it.setId] ?? 0) + 1;
  }
  for (const [id, n] of Object.entries(setCounts)) {
    const set = SET_BY_ID[id];
    for (const [k, mods] of Object.entries(set.bonuses)) if (n >= Number(k)) out.push(...mods);
  }
  return out;
}

const dimin = (v: number, k: number) => (v * k) / (v + k);

export function resistPenalty(difficulty: number): number {
  return [0, 30, 60][difficulty] ?? 60;
}

export function computeStats(c: Character, buffs: Buffs = {}): Stats {
  const cls = CLASSES[c.classId];
  const sum: Partial<Record<StatKey, number>> = {};
  for (const md of equippedMods(c)) sum[md.stat] = (sum[md.stat] ?? 0) + md.value;
  const g = (k: StatKey) => sum[k] ?? 0;
  const bonus = g('allSkills') + g(`skills_${c.classId}` as StatKey);
  const lvl = (id: string) => skillLevel(c, id, bonus);
  const p = (id: string) => {
    const l = lvl(id);
    return l > 0 ? SKILL_BY_ID[id].params(l) : null;
  };

  const str = cls.str + c.alloc.str + g('str') + g('allAttr');
  const dex = cls.dex + c.alloc.dex + g('dex') + g('allAttr');
  const vit = cls.vit + c.alloc.vit + g('vit') + g('allAttr');
  const ene = cls.ene + c.alloc.ene + g('ene') + g('allAttr');

  const iron = p('iron_skin');
  const mastery = p('weapon_mastery');
  const lifePct = (iron?.pct2 ?? 0) + (buffs.lifePct ?? 0);
  const maxLife = Math.floor(
    (cls.life + (c.level - 1) * cls.lifePerLvl + (vit - cls.vit) * cls.lifePerVit + g('life')) * (1 + lifePct / 100),
  );
  const maxMana = Math.floor(
    (cls.mana + (c.level - 1) * cls.manaPerLvl + (ene - cls.ene) * cls.manaPerEne + g('mana')) * (1 + (buffs.manaPct ?? 0) / 100),
  );

  const weapon = c.equipment.weapon;
  const wb = weapon ? baseOf(weapon) : null;
  const isBow = wb?.cat === 'bow';
  const meleeMastery = !isBow && wb && ['sword', 'axe', 'mace', 'dagger'].includes(wb.cat!) ? mastery : null;

  let armorDef = 0;
  for (const it of equippedItems(c)) armorDef += itemDefense(it);
  const defPct = (iron?.pct ?? 0) + (buffs.defPct ?? 0);
  const def = Math.floor((dex / 4 + armorDef + g('def')) * (1 + defPct / 100));
  const arPct = g('arPct') + (meleeMastery?.pct2 ?? 0);
  const ar = Math.max(10, Math.floor((dex * 5 - 35 + cls.arBonus + (c.level - 1) * 6 + g('ar') + (buffs.ar ?? 0)) * (1 + arPct / 100)));

  const wdmg = weapon ? weaponBaseDamage(weapon) : null;
  const bmin = wdmg?.min ?? 1;
  const bmax = wdmg?.max ?? 3;
  const ed = g('edPct') + (meleeMastery?.pct ?? 0) + (buffs.edPct ?? 0);
  const attrBonus = isBow ? dex : str;
  const minDmg = Math.max(1, Math.floor((bmin * (1 + ed / 100) + g('minDmg')) * (1 + attrBonus / 100)));
  const maxDmg = Math.max(minDmg + 1, Math.floor((bmax * (1 + ed / 100) + g('maxDmg')) * (1 + attrBonus / 100)));

  const ias = dimin(g('ias') + (buffs.ias ?? 0), 120);
  const fcr = dimin(g('fcr'), 120);
  const frw = dimin(g('frw') + (buffs.frw ?? 0), 150);
  const penalty = resistPenalty(c.difficulty);
  const allRes = g('allRes');
  const r = (k: StatKey) => Math.min(75, g(k) + allRes - penalty + (k === 'fireRes' ? (p('temper')?.pct2 ?? 0) : 0));

  let block = 0;
  const off = c.equipment.offhand;
  if (off) block = (baseOf(off).block ?? 0) + g('block') + (c.classId === 'reaver' ? 5 : 0);

  const potionCap = potionCapOf(c);

  return {
    str, dex, vit, ene, maxLife, maxMana,
    lifeRegen: g('lifeRegen'),
    manaRegen: (maxMana / 90) * (1 + g('manaRegen') / 100),
    ar, def, minDmg, maxDmg,
    fireMin: g('fireMin'), fireMax: g('fireMax'),
    coldMin: g('coldMin'), coldMax: g('coldMax'),
    lightMin: g('lightMin'), lightMax: g('lightMax'),
    poisonDmg: g('poisonDmg'),
    attackSpeed: (wb?.speed ?? 1.5) * (1 + ias / 100),
    castTime: cls.castTime / (1 + fcr / 100),
    moveSpeed: 4.6 * (1 + frw / 100),
    range: wb?.range ?? 1,
    isBow,
    res: { fire: r('fireRes'), cold: r('coldRes'), light: r('lightRes'), poison: r('poisonRes') },
    block: Math.min(75, block),
    lifeSteal: g('lifeSteal'),
    manaSteal: g('manaSteal'),
    mf: g('mf'),
    gf: g('gf'),
    thorns: g('thorns'),
    crit: Math.min(75, g('crit') + (meleeMastery?.chill ?? 0) + (isBow ? (p('critical_eye')?.pct ?? 0) : 0)),
    evade: p('evade')?.pct ?? 0,
    dmgReduce: g('dmgReduce'),
    lifeOnKill: g('lifeOnKill'),
    manaOnKill: g('manaOnKill'),
    skillBonus: bonus,
    potionCap,
  };
}

// ---------------------------------------------------------------- inventory grid

export function fitsAt(entries: GridEntry[], cols: number, rows: number, w: number, h: number, x: number, y: number, ignore?: number): boolean {
  if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
  for (const e of entries) {
    if (e.item.uid === ignore) continue;
    const b = baseOf(e.item);
    if (x < e.x + b.w && x + w > e.x && y < e.y + b.h && y + h > e.y) return false;
  }
  return true;
}

export function findSpace(entries: GridEntry[], cols: number, rows: number, w: number, h: number): { x: number; y: number } | null {
  for (let x = 0; x <= cols - w; x++) for (let y = 0; y <= rows - h; y++) if (fitsAt(entries, cols, rows, w, h, x, y)) return { x, y };
  return null;
}

const PACK_ORDERS: ((a: BaseItem, b: BaseItem) => number)[] = [
  (a, b) => b.h - a.h || b.w - a.w,
  (a, b) => b.w * b.h - a.w * a.h || b.h - a.h,
  (a, b) => b.w - a.w || b.h - a.h,
];

/** A tidy layout for these items, or null if none of the orders fits them all. */
function packGrid(items: Item[], cols: number, rows: number): GridEntry[] | null {
  for (const order of PACK_ORDERS) {
    const sorted = items.slice().sort((a, b) => order(baseOf(a), baseOf(b)) || a.base.localeCompare(b.base) || a.uid - b.uid);
    const packed: GridEntry[] = [];
    for (const item of sorted) {
      const b = baseOf(item);
      const at = findSpace(packed, cols, rows, b.w, b.h);
      if (!at) break;
      packed.push({ item, ...at });
    }
    if (packed.length === items.length) return packed;
  }
  return null;
}

export function addToGrid(entries: GridEntry[], cols: number, rows: number, item: Item): boolean {
  const b = baseOf(item);
  const at = findSpace(entries, cols, rows, b.w, b.h);
  if (at) {
    entries.push({ item, ...at });
    return true;
  }
  // Scattered gaps can add up to enough room. Packing makes new entries, so a caller's backup of the old ones stays valid.
  const packed = packGrid([...entries.map((e) => e.item), item], cols, rows);
  if (!packed) return false;
  entries.splice(0, entries.length, ...packed);
  return true;
}

export function sortGrid(entries: GridEntry[], cols: number, rows: number): boolean {
  const packed = packGrid(entries.map((e) => e.item), cols, rows);
  if (!packed) return false;
  entries.splice(0, entries.length, ...packed);
  return true;
}

export function removeFromGrid(entries: GridEntry[], uid: number): Item | null {
  const i = entries.findIndex((e) => e.item.uid === uid);
  if (i < 0) return null;
  return entries.splice(i, 1)[0].item;
}

export function addToInventory(c: Character, item: Item): boolean {
  return addToGrid(c.inventory, INV_COLS, INV_ROWS, item);
}

// ---------------------------------------------------------------- potions

export type PotionPool = PotionInfo['type'];
export const POTION_POOLS: PotionPool[] = ['hp', 'mp', 'rejuv'];
const POOL_NAMES: Record<PotionPool, string> = { hp: 'Health', mp: 'Mana', rejuv: 'Rejuvenation' };

/** A pool's potion bases, weakest first. */
export function potionTiers(pool: PotionPool): BaseItem[] {
  return BASES.filter((b) => b.potion?.type === pool).sort((a, b) => a.potion!.amount - b.potion!.amount);
}

export function potionCapOf(c: Character): number {
  return (c.equipment.belt && baseOf(c.equipment.belt).potionCap) || 8;
}

export function potionCount(c: Character, pool: PotionPool): number {
  return potionTiers(pool).reduce((n, b) => n + (c.potions[b.id] ?? 0), 0);
}

export function takePotion(c: Character, baseId: string) {
  if (--c.potions[baseId] <= 0) delete c.potions[baseId];
}

export function addPotion(c: Character, baseId: string): boolean {
  const pot = baseOf(baseId).potion;
  if (!pot) return false;
  if (potionCount(c, pot.type) >= potionCapOf(c)) {
    // A full pool trades its weakest potion up, so outdated tiers drop out on their own.
    const weakest = potionTiers(pot.type).find((b) => c.potions[b.id]);
    if (!weakest || weakest.potion!.amount >= pot.amount) return false;
    takePotion(c, weakest.id);
  }
  c.potions[baseId] = (c.potions[baseId] ?? 0) + 1;
  return true;
}

/** The smallest owned potion that covers `missing`, else the strongest owned. */
export function choosePotion(c: Character, pool: PotionPool, missing: number): string | null {
  const owned = potionTiers(pool).filter((b) => c.potions[b.id]);
  if (!owned.length) return null;
  return (owned.find((b) => b.potion!.amount >= missing) ?? owned[owned.length - 1]).id;
}

export function potionSummary(c: Character, pool: PotionPool): string {
  const held = potionTiers(pool).filter((b) => c.potions[b.id]).map((b) => `${c.potions[b.id]} ${b.name}`);
  return `${POOL_NAMES[pool]} potions ${potionCount(c, pool)}/${potionCapOf(c)}${held.length ? `: ${held.join(', ')}` : ''}`;
}

// ---------------------------------------------------------------- saves

/** Brings a saved hero up to SAVE_VERSION in place. Returns whether anything changed. */
export function migrateCharacter(c: Character & { belt?: string[][] }): boolean {
  if (c.version >= SAVE_VERSION) return false;
  if (c.version < 2) {
    // v1 kept potions in belt columns and the backpack. Counts may exceed the cap: migrating never destroys potions.
    c.potions = {};
    const keep = (id: string) => (c.potions[id] = (c.potions[id] ?? 0) + 1);
    for (const id of (c.belt ?? []).flat()) keep(id);
    delete c.belt;
    c.inventory = c.inventory.filter((e) => {
      if (baseOf(e.item).kind !== 'potion') return true;
      keep(e.item.base);
      return false;
    });
  }
  // v3 added the Forge: materials and mastery start empty.
  if (c.version < 3) c.forge = { ...newForgeState(), ...c.forge };
  c.version = SAVE_VERSION;
  return true;
}

// ---------------------------------------------------------------- equipment

export function slotsFor(item: Item): Slot[] {
  switch (baseOf(item).kind) {
    case 'weapon':
      return ['weapon'];
    case 'shield':
      return ['offhand'];
    case 'armor':
      return ['body'];
    case 'helm':
      return ['head'];
    case 'gloves':
      return ['gloves'];
    case 'boots':
      return ['boots'];
    case 'belt':
      return ['belt'];
    case 'ring':
      return ['ring1', 'ring2'];
    case 'amulet':
      return ['amulet'];
    default:
      return [];
  }
}

export function requirementError(c: Character, item: Item, stats = computeStats(c)): string | null {
  const b = baseOf(item);
  if (c.level < item.reqLvl) return `Requires level ${item.reqLvl}`;
  if (b.reqStr && stats.str < b.reqStr) return `Requires ${b.reqStr} Strength`;
  if (b.reqDex && stats.dex < b.reqDex) return `Requires ${b.reqDex} Dexterity`;
  return null;
}

/**
 * Equips an inventory item, moving whatever it replaces back into the inventory.
 * Two-handed weapons and shields displace each other. Returns an error message or null.
 */
export function equipFromInventory(c: Character, uid: number, preferSlot?: Slot): string | null {
  const entry = c.inventory.find((e) => e.item.uid === uid);
  if (!entry) return 'Item not found';
  const item = entry.item;
  const slots = slotsFor(item);
  if (!slots.length) return 'Cannot equip that';
  const err = requirementError(c, item);
  if (err) return err;
  const b = baseOf(item);
  let slot = preferSlot && slots.includes(preferSlot) ? preferSlot : slots[0];
  if (!preferSlot && slots.length > 1) slot = slots.find((s) => !c.equipment[s]) ?? slots[0];
  const displaced: Slot[] = [slot];
  if (b.twoHanded) displaced.push('offhand');
  if (b.kind === 'shield' && c.equipment.weapon && baseOf(c.equipment.weapon).twoHanded) displaced.push('weapon');
  const backup = c.inventory.slice();
  removeFromGrid(c.inventory, uid);
  const moved: { slot: Slot; item: Item }[] = [];
  for (const s of displaced) {
    const old = c.equipment[s];
    if (!old) continue;
    if (!addToInventory(c, old)) {
      c.inventory.length = 0;
      c.inventory.push(...backup);
      for (const mv of moved) c.equipment[mv.slot] = mv.item;
      return 'Not enough room in inventory';
    }
    moved.push({ slot: s, item: old });
    delete c.equipment[s];
  }
  c.equipment[slot] = item;
  return null;
}

export function unequip(c: Character, slot: Slot): string | null {
  const it = c.equipment[slot];
  if (!it) return null;
  if (!addToInventory(c, it)) return 'Not enough room in inventory';
  delete c.equipment[slot];
  return null;
}

export function classSkillList(c: Character) {
  return classSkills(c.classId);
}
