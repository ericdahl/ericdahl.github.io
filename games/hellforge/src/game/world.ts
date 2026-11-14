import { AREA_BY_ID, areaAct, DIFFICULTY_LEVELS, QUEST_BY_ID, QUESTS, TOWN_OF_ACT, WAYPOINT_AREAS, type AreaDef } from './areas';
import {
  addPotion, addToGrid, addToInventory, addXp, choosePotion, CLASSES, computeStats, equipFromInventory, INV_COLS, INV_ROWS,
  removeFromGrid, respec, skillLevel, STASH_COLS, STASH_ROWS, takePotion, unequip, xpForLevel, xpMultiplier,
  type Buffs, type Character, type PotionPool, type Stats,
} from './character';
import { applyResists, hitChance, reducePhysical, roll, ZERO_DAMAGE, type Damage } from './combat';
import {
  baseOf, buyPrice, displayName, gamble, gamblePrice, generateItem, itemColor, makeItem, potionFor, rollDrops,
  sellPrice, type DropTier, type Item, type ItemKind, type Slot,
} from './items';
import { afflictionLabel, DEPTH_BOSSES, DEPTH_STRIDE, depthCinders, depthDef, depthFortune, depthId, depthOf, depthStarts, isDepthId } from './depths';
import { forgeApply, type ForgeAction, type ForgeResult } from './forge';
import { floodDistances, generateLevel, idx, isWalkable, nearestFloor, type Level, type Point } from './map';
import {
  baseDamage, baseLife, MOD_LABEL, MONSTERS, monsterStats, rollUniqueMods, uniqueName,
  type BossAbility, type MonsterDef, type MonsterRarity, type MonsterShape, type Resists, type UniqueMod,
} from './monsters';
import { FlowField, findPath, lineOfSight } from './path';
import { hashSeed, Rng } from './rng';
import { SKILL_BY_ID, synergyBonus, type Element, type SkillDef, type SkillParams } from './skills';
import type { StoryId } from './story';

export type SoundId =
  | 'swing' | 'hit' | 'miss' | 'death' | 'hurt' | 'gold' | 'item' | 'unique' | 'potion' | 'levelup' | 'fire' | 'cold'
  | 'light' | 'bow' | 'portal' | 'nova' | 'block' | 'shrine' | 'chest' | 'boom' | 'nomana' | 'roar' | 'quest' | 'step' | 'thud' | 'rare'
  | 'spree' | 'orb' | 'dodge' | 'jackpot' | 'cackle' | 'curse' | 'bell' | 'kindle' | 'snuff' | 'anvil' | 'crack' | 'shatter' | 'quench';

/** Seconds a ground item takes to bounce when it lands or refuses to be picked up. */
export const LOOT_BOUNCE = 0.4;

export type Panel = 'healer' | 'smith' | 'sage' | 'fence' | 'stash' | 'waypoint' | 'caravan' | 'forge';

export type GameEvent =
  | { type: 'sound'; id: SoundId }
  | { type: 'msg'; text: string; color?: string }
  | { type: 'levelup'; level: number }
  | { type: 'open'; panel: Panel }
  | { type: 'death' }
  | { type: 'area'; id: string }
  | { type: 'quest'; id: string }
  | { type: 'victory' }
  | { type: 'story'; id: StoryId }
  | { type: 'shake'; amount: number }
  /** Freeze the action for a moment to sell a heavy hit. */
  | { type: 'hitstop'; t: number }
  /** A full-screen colour flash (boss abilities, boss deaths). */
  | { type: 'flash'; color: string; a: number }
  /** A big line across the middle of the screen: sprees, purges, ambushes. */
  | { type: 'announce'; text: string; sub?: string; color: string };

export type FxKind =
  | 'blood' | 'spark' | 'nova' | 'explosion' | 'chain' | 'meteor_mark' | 'burn' | 'teleport' | 'levelup' | 'heal'
  | 'shrine' | 'text' | 'shout' | 'revive' | 'whirl' | 'slam' | 'portal_open' | 'raise' | 'curse'
  | 'shatter' | 'cinders' | 'zap' | 'gore' | 'shade_mark' | 'dust' | 'dash' | 'coins'
  | 'frost_mark' | 'warm_mark' | 'snuff_mark' | 'kindle' | 'snuff' | 'toll_mark' | 'frost'
  | 'anvil' | 'wave' | 'flame' | 'warmth';

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  t: number;
  dur: number;
  r?: number;
  color?: string;
  text?: string;
  pts?: Point[];
  /** Font size for floating text. */
  size?: number;
  /** World-space direction, for effects that point somewhere. */
  ang?: number;
}

/** How a monster died, for its death effect and corpse. */
export type DeathKind = 'normal' | 'shatter' | 'burn' | 'shock' | 'melt' | 'gib';

export interface Monster {
  id: number;
  def: MonsterDef;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  level: number;
  dmgMin: number;
  dmgMax: number;
  ar: number;
  def_: number;
  res: Resists;
  speed: number;
  xp: number;
  rarity: MonsterRarity;
  name: string;
  mods: UniqueMod[];
  alert: boolean;
  homeX: number;
  homeY: number;
  wanderT: number;
  wanderTo: Point | null;
  atkCd: number;
  action: { t: number; hitAt: number; dur: number; done: boolean; kind: 'melee' | 'shoot' | 'cast' | 'toll' } | null;
  abilityCd: number;
  chill: number;
  stun: number;
  poison: { dps: number; t: number };
  fleeT: number;
  knock: Point;
  dead: boolean;
  deadT: number;
  packId: number;
  facing: number;
  walk: number;
  flash: number;
  revived: number;
  superId?: string;
  charge?: { dx: number; dy: number; t: number; hit: boolean };
  summoned?: boolean;
  /** Set on the player's servants: raised dead and built constructs. */
  ally?: Ally;
  /** A construct that stays where it was built. */
  fixed?: boolean;
  /** Seconds before a construct winds down. */
  ttl?: number;
  /** The skill numbers a construct was built with, and its synergy multiplier. */
  built?: { pr: SkillParams; syn: number };
  /** Armor cracked by Sunder: more physical damage taken. */
  sunder?: { t: number; pct: number };
  /** Current opponent: a minion id for monsters, a monster id for minions. */
  foe?: number;
  curse?: { t: number; pct: number };
  /** A corpse that was raised or exploded and can't be used again. */
  used?: boolean;
  stuckT?: number;
  deathKind?: DeathKind;
  /** Seconds left underground. Buried monsters can't be hit or targeted. */
  sub?: number;
  /** The burrow ends in a boss's heavier strike. */
  subStrike?: boolean;
  /** A harmless copy: dies to any hit, drops nothing, and casts no shadow. */
  illusion?: boolean;
  ownerId?: number;
  split?: boolean;
  shield?: number;
  shieldT?: number;
  /** Already got back up once. */
  rose?: boolean;
  /** Current boss phase, and what it changed. */
  phase?: number;
  /** A Tithe Imp's getaway: time left before it escapes, and where it is running. */
  thief?: { t: number; started: boolean; path: Point[]; repath: number; dropCd: number; stagger: number };
  /** Called up by a cursed shrine (the shrine's object id). */
  ambush?: number;
  /** World time before an elite's modifier ability is ready again. */
  sparkAt?: number;
  blinkAt?: number;
  mortarAt?: number;
  abilities?: BossAbility[];
  shape?: MonsterShape;
  color?: string;
  invulnT?: number;
  /** Seconds left ablaze after a fire hit. A burning monster is warm to stand beside. */
  burnT?: number;
  /** A Slag Golem's temper: above SLAG_MOLTEN it is molten, below SLAG_BRITTLE it is brittle. */
  heat?: number;
  /** A Hearth-Eater is drinking the ember while this is above zero. */
  drainT?: number;
  /** The phylactery (a monster id) that keeps this boss from harm while it stands. */
  wardId?: number;
  /** Holds the stairs of an Underforge floor: they stay sealed while it lives. */
  warden?: boolean;
}

/** A Slag Golem at or past these tempers is molten or brittle. */
export const SLAG_MOLTEN = 0.3;
export const SLAG_BRITTLE = -0.3;

/** A bell's toll: a shockwave spreading from where it was rung. It strikes once as it passes, unless rolled through. */
export interface Ring {
  x: number;
  y: number;
  r: number;
  speed: number;
  max: number;
  dmg: Damage;
  srcLevel: number;
  passed: boolean;
  hit: Set<number>;
}

/** Tiles of warmth around a lit brazier. */
export const BRAZIER_RADIUS = 4.5;
/** Seconds a full ember lasts in the cold with no fire near, and how long frostbite takes to set in once it is out. */
export const EMBER_TIME = 60;
export const FROST_TIME = 10;
export type Ally = 'skeleton' | 'golem' | 'ballista' | 'bellows' | 'sentinel' | 'furnace';
const ALLY_DEF: Record<Ally, string> = {
  skeleton: 'raised_skeleton', golem: 'grave_golem', ballista: 'ballista_turret', bellows: 'bellows_turret', sentinel: 'brass_sentinel', furnace: 'furnace',
};
/** Which servant each Forgewright construct skill builds. */
export const CONSTRUCT_OF: Record<string, Ally> = { ballista: 'ballista', bellows: 'bellows', brass_sentinel: 'sentinel', furnace: 'furnace' };

/** Heat: where Slag Burst becomes usable, where it leaves burning ground, and where an overheated smith stops burning. */
export const HEAT_MAX = 100;
export const HEAT_VENT = 25;
export const HEAT_SLAG = 75;
const HEAT_COOLED = 60;

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  owner: 'player' | 'monster';
  dmg: Damage;
  radius: number;
  kind: string;
  ar?: number;
  srcLevel: number;
  pierce?: boolean;
  explode?: number;
  chill?: number;
  /** Ember taken from the hero on a hit (rime shards). */
  sap?: number;
  chains?: { n: number; dmg: Damage };
  wobble?: boolean;
  hit: Set<number>;
  srcId?: number;
  /** The construct that fired it, so its target can turn on it. */
  servant?: Monster;
}

export interface GroundItem {
  id: number;
  x: number;
  y: number;
  item?: Item;
  gold?: number;
  t: number;
}

/** A soul orb left by the dead. Walking over it restores life or mana. */
export interface Orb {
  id: number;
  x: number;
  y: number;
  kind: 'life' | 'mana';
  t: number;
}

/** Seconds a soul orb lasts on the ground. */
export const ORB_LIFE = 30;

/** Kills needed for each spree rank, and what the rank is called. */
export const SPREE_TIERS: { n: number; title: string; color: string }[] = [
  { n: 5, title: 'Killing Spree', color: '#e8c860' },
  { n: 10, title: 'Rampage', color: '#ffb040' },
  { n: 16, title: 'Massacre', color: '#ff8030' },
  { n: 24, title: 'Slaughter', color: '#ff5a28' },
  { n: 35, title: 'Annihilation', color: '#ff3a3a' },
  { n: 50, title: 'Hell Unleashed', color: '#ff40c0' },
];
/** Seconds after a kill before a spree lapses. */
export const SPREE_WINDOW = 4;
export const DODGE_COOLDOWN = 1.5;
const DODGE_TIME = 0.22;
const DODGE_DIST = 3.1;
/** Seconds a Tithe Imp runs before its portal opens, and how long the portal takes. */
const THIEF_RUN = 15;
const THIEF_CHANNEL = 1.6;

export interface WorldObject {
  id: number;
  x: number;
  y: number;
  kind: 'chest' | 'barrel' | 'shrine' | 'brazier';
  /** Opened, spent or, for a brazier, lit. */
  used: boolean;
  shrine?: ShrineKind;
}

export type ShrineKind = 'armor' | 'combat' | 'refill' | 'experience' | 'storm' | 'fortune' | 'haste' | 'cursed';
export const SHRINE_KINDS: ShrineKind[] = ['armor', 'combat', 'refill', 'experience', 'storm', 'fortune', 'haste', 'cursed'];
const SHRINE_NAMES: Record<ShrineKind, string> = {
  armor: 'Armor Shrine', combat: 'Combat Shrine', refill: 'Refilling Shrine', experience: 'Experience Shrine',
  storm: 'Storm Shrine', fortune: 'Fortune Shrine', haste: 'Fleet Shrine', cursed: 'Cursed Shrine',
};
const SHRINE_TIME: Partial<Record<ShrineKind, number>> = { storm: 45, fortune: 120, haste: 60 };

export type NpcKind = 'healer' | 'smith' | 'sage' | 'fence' | 'caravan';
export interface Npc {
  id: number;
  kind: NpcKind;
  name: string;
  title: string;
  x: number;
  y: number;
  facing: number;
}

export const NPC_INFO: Record<NpcKind, { name: string; title: string }> = {
  healer: { name: 'Sister Ilsa', title: 'Healer' },
  smith: { name: 'Brannoc', title: 'Blacksmith' },
  sage: { name: 'Old Corvin', title: 'Sage' },
  fence: { name: 'Mirela', title: 'Gambler' },
  caravan: { name: 'Dov', title: 'Caravan Master' },
};

const NPC_ACT2: Record<NpcKind, { name: string; title: string }> = {
  healer: { name: 'Nessa', title: 'Well-Keeper' },
  smith: { name: 'Hadrun', title: 'Glasswright' },
  sage: { name: 'Keeper Imre', title: 'Archivist' },
  fence: { name: 'Sefa', title: 'Bonecaster' },
  caravan: { name: 'Dov', title: 'Caravan Master' },
};

const NPC_ACT3: Record<NpcKind, { name: string; title: string }> = {
  healer: { name: 'Sister Ilsa', title: 'Hearth-Keeper' },
  smith: { name: 'Brannoc', title: 'Blacksmith' },
  sage: { name: 'Wren', title: 'Last of the Watch' },
  fence: { name: 'Ysolde', title: 'Scavenger' },
  caravan: { name: 'Dov', title: 'Caravan Master' },
};

export interface Hazard {
  x: number;
  y: number;
  t: number;
  delay: number;
  dur: number;
  radius: number;
  dmg: Damage;
  owner: 'player' | 'monster';
  burnDps: number;
  srcLevel: number;
  fired: boolean;
  /** Skip the shake and boom, for attacks made of many small blasts. */
  quiet?: boolean;
  /** Ice rather than fire: it chills, saps the ember, and gives no warmth. */
  cold?: boolean;
  /** A falling anvil: lands with a slam and stuns. */
  anvil?: boolean;
  stun?: number;
}

export interface AreaState {
  def: AreaDef;
  level: Level;
  monsters: Monster[];
  ground: GroundItem[];
  orbs: Orb[];
  projectiles: Projectile[];
  objects: WorldObject[];
  npcs: Npc[];
  hazards: Hazard[];
  rings: Ring[];
  fx: Fx[];
  explored: Uint8Array;
  /** Goes up whenever a new tile is explored, so the automap knows when to redraw. */
  exploredRev: number;
  flow: FlowField;
  /** Every monster here has been killed and the reward paid. */
  purged?: boolean;
}

type Intent =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'skill'; skill: string; x: number; y: number; targetId?: number }
  | { kind: 'interact'; target: Interactable };

export type Interactable =
  | { kind: 'item'; id: number }
  | { kind: 'object'; id: number }
  | { kind: 'npc'; id: number }
  | { kind: 'waypoint' }
  | { kind: 'stash' }
  | { kind: 'forge' }
  | { kind: 'portal' }
  | { kind: 'exit'; index: number };

interface PlayerAction {
  kind: 'melee' | 'shoot' | 'cast' | 'leap' | 'whirl' | 'dodge';
  skill: string;
  t: number;
  dur: number;
  hitAt: number;
  done: boolean;
  x: number;
  y: number;
  targetId?: number;
  fromX?: number;
  fromY?: number;
  tick?: number;
}

export interface PlayerState {
  x: number;
  y: number;
  life: number;
  mana: number;
  facing: number;
  moving: boolean;
  walk: number;
  path: Point[];
  pathT: number;
  moveDir: Point | null;
  intent: Intent | null;
  action: PlayerAction | null;
  heal: { hp: number; mp: number; t: number }[];
  buffs: Record<string, { t: number; p: SkillParams }>;
  frenzy: { stacks: number; t: number };
  invuln: number;
  dead: boolean;
  chill: number;
  poison: { dps: number; t: number };
  hurt: number;
  xpBonus: number;
  /** The Forgewright's Heat, 0 to HEAT_MAX, seconds since it last rose, and whether it has boiled over. */
  heat: number;
  heatT: number;
  overheat: boolean;
}

export interface Portal {
  area: string;
  x: number;
  y: number;
}

export interface VendorStock {
  healer: Item[];
  smith: Item[];
}

export const GAMBLE_KINDS: ItemKind[] = ['ring', 'amulet', 'weapon', 'armor', 'helm', 'shield', 'gloves', 'boots', 'belt'];

const TAU = Math.PI * 2;

const SHRINE_TEXT: Record<ShrineKind, string> = {
  armor: 'your armor hardens', combat: 'your blows land harder', refill: 'life and mana restored', experience: 'you learn faster',
  storm: 'lightning hunts your foes', fortune: 'the dead give up more treasure', haste: 'you move and strike faster',
  cursed: 'they are coming for you!',
};

export class World {
  char: Character;
  stats!: Stats;
  rng: Rng;
  seed: number;
  areas = new Map<string, AreaState>();
  area!: AreaState;
  /** The player's raised servants. They follow the player between areas. */
  minions: Monster[] = [];
  player: PlayerState;
  events: GameEvent[] = [];
  portal: Portal | null = null;
  vendors: VendorStock = { healer: [], smith: [] };
  time = 0;
  focusId = -1;
  focusT = 0;
  private nextId = 1;
  private exploreT = 0;
  private msgCd: Record<string, number> = {};
  private regenAcc = 0;
  /** 0..1 strength of the current sandstorm. */
  storm = 0;
  private stormIn = 25;
  private stormLeft = 0;
  /** The current run of quick kills. `tier` indexes SPREE_TIERS, or -1 below the first rank. */
  streak = { n: 0, t: 0, tier: -1 };
  /** Seconds until the dodge roll is ready again. */
  dodgeCd = 0;
  /** Cursed shrines whose ambush is still being fought, by the shrine's object id. */
  private ambushes = new Map<number, { area: AreaState; x: number; y: number; wave: number }>();
  private stormShrineT = 0;
  /** Rolls for the extras (orbs, elite tricks), kept apart so they never shift loot or level generation. */
  private luck: Rng;
  /** 0..1: how much heat Vhorza's ember has left. It burns down in the cold and is fed by fire. */
  ember = 1;
  /** 0..1 frostbite. It builds once the ember is out: past half it slows, when full it wounds. */
  frost = 0;
  /** Whether the hero is standing in something's warmth right now. */
  nearFire = false;
  /** Rolls made at the Forge, kept apart for the same reason. */
  private forgeRng: Rng;
  /** Descents into the Underforge this session. Each one rolls its floors afresh. */
  private depthRun = 0;

  constructor(char: Character, seed = Date.now() >>> 0) {
    this.char = char;
    this.seed = seed;
    this.rng = new Rng(hashSeed(seed, 'world'));
    this.luck = new Rng(hashSeed(seed, 'luck'));
    this.forgeRng = new Rng(hashSeed(seed, 'forge'));
    this.player = {
      x: 0, y: 0, life: 1, mana: 1, facing: Math.PI / 4, moving: false, walk: 0, path: [], pathT: 0, moveDir: null,
      intent: null, action: null, heal: [], buffs: {}, frenzy: { stacks: 0, t: 0 }, invuln: 0, dead: false, chill: 0,
      poison: { dps: 0, t: 0 }, hurt: 0, xpBonus: 0, heat: 0, heatT: 0, overheat: false,
    };
    this.refreshStats();
    this.player.life = this.stats.maxLife;
    this.player.mana = this.stats.maxMana;
    const has = (id: string) => this.char.waypoints.includes(this.wpKey(id));
    this.enterArea(has('emberwatch_ruins') ? 'emberwatch_ruins' : has('tel_maresh') ? 'tel_maresh' : 'town', 'start');
  }

  // ---------------------------------------------------------------- helpers

  private id() {
    return this.nextId++;
  }

  emit(e: GameEvent) {
    this.events.push(e);
  }

  sound(id: SoundId) {
    this.emit({ type: 'sound', id });
  }

  msg(text: string, color?: string, throttleKey?: string) {
    if (throttleKey) {
      if ((this.msgCd[throttleKey] ?? 0) > this.time) return;
      this.msgCd[throttleKey] = this.time + 1.5;
    }
    this.emit({ type: 'msg', text, color });
  }

  fx(f: Omit<Fx, 't'>) {
    this.area.fx.push({ ...f, t: 0 });
  }

  floatText(x: number, y: number, text: string, color: string, size?: number) {
    this.fx({ kind: 'text', x, y, dur: size ? 1.1 : 0.9, text, color, size });
  }

  get inTown() {
    return !!this.area.def.town;
  }

  get act() {
    return areaAct(this.area.def);
  }

  /** The town this act's portals and respawns lead to. */
  get homeTown() {
    return TOWN_OF_ACT[this.act];
  }

  /** Killing Vhorza opens the road south. */
  get roadSouthOpen() {
    return this.questState('forge') === 'done' || this.questState('forge') === 'rewarded';
  }

  /** Ending Corvane opens the road back north. */
  get roadNorthOpen() {
    return this.questState('hollow_sun') === 'done' || this.questState('hollow_sun') === 'rewarded';
  }

  /** The cold is loose in this area, so the ember matters. */
  get cold() {
    return !!this.area.def.cold;
  }

  /** How far the hero can see: the ember's light shrinks as it dies, and storms close it in. */
  get sight() {
    return this.area.def.light * (1 - 0.42 * this.storm) * (this.cold ? 0.55 + 0.45 * this.ember : 1);
  }

  get difficulty() {
    return this.char.difficulty;
  }

  /** An area's definition by id. Underforge floors are rolled, so theirs live with the floor. */
  defOf(id: string): AreaDef {
    return this.areas.get(id)?.def ?? AREA_BY_ID[id];
  }

  /** The Underforge floor the hero is on, or 0 anywhere else. */
  get depth() {
    return this.area.def.depth ?? 0;
  }

  wpKey(area: string) {
    return `${this.char.difficulty}:${area}`;
  }

  questState(id: string) {
    return this.char.quests[this.wpKey(id)] ?? 'none';
  }

  /** Plays a story beat, once per difficulty. */
  tellOnce(id: StoryId) {
    const k = this.wpKey(`story_${id}`);
    if (this.char.quests[k]) return;
    this.char.quests[k] = 'done';
    this.emit({ type: 'story', id });
  }

  setQuest(id: string, s: 'active' | 'done' | 'rewarded') {
    this.char.quests[this.wpKey(id)] = s;
    this.emit({ type: 'quest', id });
  }

  /**
   * The last few creatures standing in the way of the Hollow Cave purge, while the player is in there.
   * Empty until five or fewer remain: only the stragglers are hard to find, and revealing every pack would spoil the map.
   */
  questStrays(): Monster[] {
    const a = this.area;
    if (a.def.quest !== 'hollow' || this.questState('hollow') !== 'active') return [];
    const alive = a.monsters.filter((m) => !m.dead);
    return alive.length <= 5 ? alive : [];
  }

  buffTotals(): Buffs {
    const b: Buffs = {};
    const p = this.player.buffs;
    const add = (k: keyof Buffs, v: number) => (b[k] = (b[k] ?? 0) + v);
    if (p.battle_shout) add('lifePct', p.battle_shout.p.pct!), add('manaPct', p.battle_shout.p.pct!), add('defPct', p.battle_shout.p.pct2!);
    if (p.frost_shell) add('defPct', p.frost_shell.p.pct!);
    if (p.shrine_armor) add('defPct', 100);
    if (p.shrine_combat) add('edPct', 80), add('ar', 150);
    if (p.shrine_haste) add('ias', 30), add('frw', 30);
    if (p.white_heat) add('ias', p.white_heat.p.pct!);
    // A spree quickens the feet: each rank is worth a little more speed.
    if (this.streak.tier >= 0) add('frw', 5 * (this.streak.tier + 1));
    const fr = this.player.frenzy;
    if (fr.stacks > 0) {
      const lvl = skillLevel(this.char, 'frenzy');
      const pct = lvl ? SKILL_BY_ID.frenzy.params(lvl).pct! : 0;
      add('ias', fr.stacks * pct);
      add('frw', (fr.stacks * pct) / 2);
    }
    return b;
  }

  refreshStats() {
    const oldMax = this.stats?.maxLife;
    this.stats = computeStats(this.char, this.buffTotals());
    if (this.player) {
      if (oldMax && this.stats.maxLife > oldMax && this.player.buffs.battle_shout) this.player.life += this.stats.maxLife - oldMax;
      this.player.life = Math.min(this.player.life, this.stats.maxLife);
      this.player.mana = Math.min(this.player.mana, this.stats.maxMana);
    }
  }

  // ---------------------------------------------------------------- areas

  getArea(id: string): AreaState {
    const existing = this.areas.get(id);
    if (existing) return existing;
    const deep = isDepthId(id);
    const rng = new Rng(deep ? hashSeed(this.seed, id, this.char.difficulty, this.depthRun) : hashSeed(this.seed, id, this.char.difficulty));
    const def = deep ? depthDef(depthOf(id), rng) : AREA_BY_ID[id];
    const level = generateLevel(def.spec, rng);
    const a: AreaState = {
      def, level, monsters: [], ground: [], orbs: [], projectiles: [], objects: [], npcs: [], hazards: [], rings: [], fx: [],
      explored: new Uint8Array(level.w * level.h), exploredRev: 0, flow: new FlowField(level, 26),
    };
    for (const o of level.objects) {
      const obj: WorldObject = { id: this.id(), x: o.x + 0.5, y: o.y + 0.5, kind: o.kind, used: false };
      if (o.kind === 'shrine') obj.shrine = rng.pick(SHRINE_KINDS);
      a.objects.push(obj);
    }
    if (def.town) {
      for (const k of ['healer', 'smith', 'sage', 'fence'] as NpcKind[]) this.addNpc(a, k);
    } else {
      this.populate(a, rng);
    }
    this.areas.set(id, a);
    return a;
  }

  private addNpc(a: AreaState, k: NpcKind) {
    const s = a.level.spots[k];
    const info = { 1: NPC_INFO, 2: NPC_ACT2, 3: NPC_ACT3 }[areaAct(a.def)];
    a.npcs.push({ id: this.id(), kind: k, ...info[k], x: s.x + 0.5, y: s.y + 0.5, facing: Math.PI / 2 });
  }

  /** Who is in town depends on how the story has gone. */
  private syncTownNpcs(a: AreaState) {
    if (this.roadSouthOpen && !a.npcs.some((n) => n.kind === 'caravan')) this.addNpc(a, 'caravan');
    const sage = a.npcs.find((n) => n.kind === 'sage');
    if (a.def.id === 'town' && sage && this.questState('forge') === 'rewarded') {
      sage.name = 'Wren';
      sage.title = "Corvin's Apprentice";
    }
  }

  npcInfo(kind: NpcKind) {
    const n = this.area.npcs.find((x) => x.kind === kind);
    return { name: n?.name ?? NPC_INFO[kind].name, title: n?.title ?? NPC_INFO[kind].title };
  }

  private mlvl(def: AreaDef) {
    return def.alvl + DIFFICULTY_LEVELS[this.char.difficulty];
  }

  spawnMonster(a: AreaState, defId: string, x: number, y: number, rarity: MonsterRarity, opts: { mods?: UniqueMod[]; name?: string; packId?: number; level?: number; superId?: string } = {}): Monster {
    const def = MONSTERS[defId];
    const level = opts.level ?? this.mlvl(a.def);
    // An Underforge floor's afflictions are on everything that draws breath there, except what only runs.
    if (a.def.afflictions?.length && !def.thief) opts = { ...opts, mods: [...new Set([...(opts.mods ?? []), ...a.def.afflictions])] };
    const st = monsterStats(def, level, rarity, opts.mods, this.char.difficulty);
    const m: Monster = {
      id: this.id(), def, x, y, life: st.life, maxLife: st.life, level, dmgMin: st.dmgMin, dmgMax: st.dmgMax, ar: st.ar,
      def_: st.def, res: st.res, speed: st.speed, xp: st.xp, rarity, name: opts.name ?? def.name, mods: opts.mods ?? [],
      alert: false, homeX: x, homeY: y, wanderT: this.rng.range(1, 4), wanderTo: null, atkCd: 0.5, action: null,
      abilityCd: this.rng.range(2, 4), chill: 0, stun: 0, poison: { dps: 0, t: 0 }, fleeT: 0, knock: { x: 0, y: 0 },
      dead: false, deadT: 0, packId: opts.packId ?? 0, facing: this.rng.range(0, TAU), walk: 0, flash: 0, revived: 0,
      superId: opts.superId,
    };
    if (def.thief) m.thief = { t: THIEF_RUN, started: false, path: [], repath: 0, dropCd: 0, stagger: 0 };
    a.monsters.push(m);
    return m;
  }

  private populate(a: AreaState, rng: Rng) {
    const def = a.def;
    const l = a.level;
    // Corvin (and his echo) wait alone, so packs keep out of the chamber.
    const alone = def.superUnique === 'corvin' || def.superUnique === 'echo';
    const boss = alone ? l.spots.boss : undefined;
    const spots = rng.shuffle(l.spawns.filter((s) => !boss || Math.hypot(s.x - boss.x, s.y - boss.y) > 12));
    let packId = 1;
    const occupied = new Set<number>();
    const place = (cx: number, cy: number) => {
      const p = nearestFloor(l, { x: cx + rng.range(-1.5, 1.5), y: cy + rng.range(-1.5, 1.5) }, (x, y) => occupied.has(idx(l, x, y)));
      occupied.add(idx(l, p.x, p.y));
      return { x: p.x + 0.5, y: p.y + 0.5 };
    };
    if (def.depth) {
      this.placeWarden(a, rng, place);
      packId++;
    } else if (def.superUnique) {
      const sd = MONSTERS[def.superUnique];
      const spot = l.spots.boss ?? spots.pop() ?? l.start;
      const isBoss = def.superUnique === 'mother' || def.superUnique === 'corvin' || def.superUnique === 'unlit';
      const boss = this.spawnMonster(a, sd.id, spot.x + 0.5, spot.y + 0.5, 'boss', {
        packId, superId: sd.id, level: this.mlvl(def) + (isBoss ? 1 : 2), mods: isBoss || def.superUnique === 'glutton' ? [] : ['extraLife'],
      });
      boss.name = sd.name;
      const escort = { glutton: 'ghoul', bishop: 'skeleton', warden: 'skeleton', mother: 'imp', skarn: 'scorpion', karrik: 'kite', embalmer: 'mummy', frostwright: 'rime_thrall', unlit: 'rime_thrall' }[sd.id] ?? 'imp';
      for (let i = 0; i < (alone ? 0 : 4); i++) {
        const p = place(spot.x, spot.y);
        this.spawnMonster(a, escort, p.x, p.y, 'minion', { packId, name: `${MONSTERS[escort].name}` });
      }
      if (sd.id === 'mother') for (let i = 0; i < 2; i++) {
        const p = place(spot.x, spot.y);
        this.spawnMonster(a, 'hexer', p.x, p.y, 'minion', { packId });
      }
      if (sd.id === 'unlit') for (let i = 0; i < 2; i++) {
        const p = place(spot.x, spot.y);
        this.spawnMonster(a, 'hearth_eater', p.x, p.y, 'minion', { packId });
      }
      packId++;
    }
    for (let i = 0; i < def.packs && spots.length; i++) {
      const s = spots.pop()!;
      const type = rng.pick(def.monsters);
      // Elites thicken with depth: from one pack in seven at the top of the Underforge to nearly one in two.
      const deep = Math.min(1, (def.depth ?? 0) / 30);
      const roll = rng.next();
      if (roll < 0.06 + 0.12 * deep) {
        const mods = rollUniqueMods(rng, Math.min(5, this.char.difficulty + 1 + (rng.chance(0.4) ? 1 : 0) + Math.floor((def.depth ?? 0) / 8)));
        const p = place(s.x, s.y);
        this.spawnMonster(a, type, p.x, p.y, 'unique', { mods, name: uniqueName(rng), packId });
        for (let k = 0; k < rng.int(2, 4); k++) {
          const q = place(s.x, s.y);
          this.spawnMonster(a, type, q.x, q.y, 'minion', { packId });
        }
      } else if (roll < 0.15 + 0.3 * deep) {
        for (let k = 0; k < rng.int(2, 4); k++) {
          const q = place(s.x, s.y);
          this.spawnMonster(a, type, q.x, q.y, 'champion', { packId, name: `${rng.pick(['Champion', 'Berserker', 'Fanatic', 'Ghostly'])} ${MONSTERS[type].name}` });
        }
      } else if (type === 'hexer') {
        const p = place(s.x, s.y);
        this.spawnMonster(a, 'hexer', p.x, p.y, 'normal', { packId });
        for (let k = 0; k < rng.int(3, 6); k++) {
          const q = place(s.x, s.y);
          this.spawnMonster(a, 'imp', q.x, q.y, 'normal', { packId });
        }
      } else if (MONSTERS[type].pack) {
        const p = place(s.x, s.y);
        this.spawnMonster(a, type, p.x, p.y, 'normal', { packId });
        for (let k = 0; k < rng.int(3, 5); k++) {
          const q = place(s.x, s.y);
          this.spawnMonster(a, MONSTERS[type].pack!, q.x, q.y, 'normal', { packId });
        }
      } else {
        const n = ['brute', 'colossus', 'bellwarden', 'slag_golem', 'hearth_eater'].includes(type) ? rng.int(1, 3) : rng.int(3, 6);
        for (let k = 0; k < n; k++) {
          const q = place(s.x, s.y);
          this.spawnMonster(a, type, q.x, q.y, 'normal', { packId });
        }
      }
      packId++;
    }
    // Sometimes a Tithe Imp is hiding somewhere with its sack. Not in the Hollow Cave, where every last creature must die.
    if (def.quest !== 'hollow' && spots.length && rng.chance(0.4)) {
      const s = spots.pop()!;
      const p = place(s.x, s.y);
      this.spawnMonster(a, 'tithe', p.x, p.y, 'normal', { packId });
    }
  }

  /**
   * Stands a warden by the stairs of an Underforge floor: a boss on every fifth floor, a named elite on the rest.
   * It is found on the way to the stairs, so the hero is never sent back to hunt for it.
   */
  private placeWarden(a: AreaState, rng: Rng, place: (cx: number, cy: number) => Point) {
    const def = a.def;
    const l = a.level;
    const depth = def.depth!;
    const stairs = l.exits.find((e) => e.kind === 'down');
    const spot = l.spots.boss ?? (stairs ? nearestFloor(l, stairs) : l.start);
    const at = { x: spot.x + 0.5, y: spot.y + 0.5 };
    let warden: Monster;
    if (def.superUnique) {
      const sd = MONSTERS[def.superUnique];
      warden = this.spawnMonster(a, sd.id, at.x, at.y, 'boss', { packId: 1, superId: sd.id, level: this.mlvl(def) + 2 });
      // The Underforge remembers its dead: the same faces come round again, harder each time.
      const lap = Math.floor((depth / DEPTH_STRIDE - 1) / DEPTH_BOSSES.length);
      warden.name = lap ? `${sd.name} (${['Twice', 'Thrice'][lap - 1] ?? `${lap + 1} Times`} Risen)` : `${sd.name}, Risen`;
    } else {
      const steady = def.monsters.filter((id) => !MONSTERS[id].flees && !MONSTERS[id].mirage && !MONSTERS[id].drains && !['hexer', 'bat', 'kite', 'scarab', 'rime_thrall', 'burrower'].includes(id));
      const type = steady.length ? rng.pick(steady) : 'brute';
      warden = this.spawnMonster(a, type, at.x, at.y, 'unique', { packId: 1, mods: rollUniqueMods(rng, Math.min(5, 2 + Math.floor(depth / 4))), name: uniqueName(rng), level: this.mlvl(def) + 1 });
    }
    warden.warden = true;
    const escort = def.monsters.filter((id) => !MONSTERS[id].drains);
    for (let i = 0; i < 4; i++) {
      const p = place(spot.x, spot.y);
      this.spawnMonster(a, rng.pick(escort.length ? escort : ['brute']), p.x, p.y, 'minion', { packId: 1 });
    }
  }

  /** The warden still holding this floor's stairs, if there is one. */
  wardenAlive(): Monster | undefined {
    return this.area.monsters.find((m) => m.warden && !m.dead);
  }

  /** The Underforge opens, per difficulty, once the ember has been carried home on it. */
  get depthsOpen() {
    const s = this.questState('rekindle');
    return s === 'done' || s === 'rewarded';
  }

  /** The deepest floor cleared on this difficulty. */
  get deepest() {
    return this.char.deepest?.[this.char.difficulty] ?? 0;
  }

  /** Floors a new descent can start from. */
  depthStartList(): number[] {
    return this.depthsOpen ? depthStarts(this.deepest) : [];
  }

  /** Starts a fresh descent at one of the open starting floors. Whatever was left of the last one is gone. */
  descend(depth = 1): boolean {
    if (this.player.dead || !this.depthStartList().includes(depth)) return false;
    for (const id of [...this.areas.keys()]) if (isDepthId(id)) this.areas.delete(id);
    if (this.portal && isDepthId(this.portal.area)) this.portal = null;
    for (const [k, am] of this.ambushes) if (am.area.def.depth) this.ambushes.delete(k);
    this.depthRun++;
    this.sound('portal');
    this.enterArea(depthId(depth), 'start');
    return true;
  }

  /** Moves the player to an area. `via` decides where they appear. */
  enterArea(id: string, via: 'start' | 'exit' | 'waypoint' | 'portal', fromId?: string) {
    const prev = this.area;
    if (prev) prev.projectiles.length = 0;
    const a = this.getArea(id);
    this.area = a;
    // Floors left behind on the way down are let go, apart from one a town portal still leads back to.
    if (a.def.depth) for (const [k, o] of this.areas) if (o.def.depth && o.def.depth < a.def.depth && this.portal?.area !== k) this.areas.delete(k);
    const l = a.level;
    let pos: Point = l.start;
    if (via === 'exit' && fromId) {
      const ex = l.exits.find((e) => e.to === fromId);
      if (ex) pos = this.arrivalNear(l, ex);
    } else if (via === 'waypoint' && l.waypoint) {
      pos = nearestFloor(l, { x: l.waypoint.x, y: l.waypoint.y + 1 });
    } else if (via === 'portal') {
      if (a.def.town) {
        const s = this.townPortalSpot();
        pos = nearestFloor(l, { x: s.x, y: s.y + 2 });
      }
      else if (this.portal) pos = nearestFloor(l, { x: this.portal.x + 1, y: this.portal.y });
    } else if (!a.def.town) {
      pos = this.arrivalNear(l, l.start);
    }
    const p = this.player;
    p.x = Math.floor(pos.x) + 0.5;
    p.y = Math.floor(pos.y) + 0.5;
    p.path = [];
    p.intent = null;
    p.action = null;
    p.invuln = 1.2;
    if (a.def.town) this.endSpree(true);
    // The ember is fed at every town fire, and anywhere the cold is not loose.
    if (!a.def.cold) (this.ember = 1), (this.frost = 0);
    // Turrets and furnaces are left behind; anything that walks comes along.
    this.minions = this.minions.filter((mi) => !mi.dead && !mi.fixed);
    for (const mi of this.minions) this.placeMinion(mi);
    a.flow.update(p.x, p.y);
    this.markExplored(true);
    if (a.def.town) {
      this.restockVendors();
      this.syncTownNpcs(a);
    }
    if (a.def.quest && this.questState(a.def.quest) === 'none') this.setQuest(a.def.quest, 'active');
    this.emit({ type: 'area', id });
    if (a.def.depth && a.def.afflictions?.length && this.wardenAlive()) {
      this.emit({ type: 'announce', text: a.def.afflictions.map((m) => afflictionLabel(m).split(' (')[0]).join(' · '), sub: `Everything on this floor is ${a.def.afflictions.map((m) => MOD_LABEL[m]).join(', ')}`, color: '#d080ff' });
    }
  }

  private arrivalNear(l: Level, p: Point): Point {
    const dist = floodDistances(l, Math.floor(p.x), Math.floor(p.y));
    let best: Point | null = null;
    for (let y = 0; y < l.h; y++)
      for (let x = 0; x < l.w; x++) {
        const d = dist[idx(l, x, y)];
        if (d === 3) {
          best = { x, y };
          break;
        }
      }
    return best ?? nearestFloor(l, p);
  }

  townPortalSpot(): Point {
    const l = this.getArea(this.homeTown).level;
    const wp = l.waypoint!;
    return { x: wp.x + 3, y: wp.y + 1 };
  }

  restockVendors() {
    const clvl = this.char.level;
    const rng = this.rng;
    const ilvl = Math.max(1, Math.min(clvl + 2, this.mlvl(AREA_BY_ID.hellforge_heart) + 3));
    const healer: Item[] = [];
    for (const t of ['hp', 'mp'] as const) {
      const top = potionFor(t, clvl);
      const tier = Number(top.slice(2));
      for (let k = Math.max(1, tier - 1); k <= tier; k++) healer.push(makeItem(`${t}${k}`));
    }
    healer.push(makeItem('tp_scroll'));
    if (clvl >= 8) healer.push(makeItem('rejuv'));
    for (let i = 0; i < 4; i++) {
      const it = generateItem(rng, ilvl, { kinds: ['weapon'], rarity: rng.chance(0.5) ? 'magic' : 'normal', classId: 'arcanist' });
      if (['wand', 'staff'].includes(baseOf(it).cat ?? '')) healer.push(it);
    }
    const smith: Item[] = [];
    for (let i = 0; i < 18; i++) {
      const it = generateItem(rng, ilvl, {
        kinds: ['weapon', 'armor', 'helm', 'shield', 'gloves', 'boots', 'belt'],
        rarity: rng.chance(0.35) ? 'magic' : 'normal', classId: this.char.classId,
      });
      it.identified = true;
      smith.push(it);
    }
    for (const it of healer) it.identified = true;
    this.vendors = { healer, smith };
  }

  // ---------------------------------------------------------------- commands

  cmdMoveDir(dir: Point | null) {
    const p = this.player;
    if (dir && Math.hypot(dir.x, dir.y) > 0.15) {
      p.moveDir = dir;
      p.intent = null;
      p.path = [];
    } else {
      p.moveDir = null;
    }
  }

  cmdMoveTo(x: number, y: number) {
    const p = this.player;
    if (p.dead) return;
    p.intent = { kind: 'move', x, y };
    this.repath(x, y);
  }

  cmdInteract(target: Interactable) {
    if (this.player.dead) return;
    this.player.intent = { kind: 'interact', target };
    const pos = this.interactPos(target);
    if (pos) this.repath(pos.x, pos.y);
  }

  /** Use a skill at a point or on a monster. Melee attacks walk to the target first. */
  cmdSkill(skill: string, x: number, y: number, targetId?: number) {
    if (this.player.dead) return;
    if (this.inTown) return;
    this.player.intent = { kind: 'skill', skill, x, y, targetId };
  }

  /** Touch-friendly: aim a skill at the best nearby target automatically. */
  cmdAutoSkill(skill: string) {
    if (this.player.dead || this.inTown) return;
    const def = SKILL_BY_ID[skill];
    if (!def) return;
    const p = this.player;
    const self = ['buff', 'nova', 'ring', 'vent', 'quake'].includes(def.kind) || def.id === 'grave_golem';
    if (self) return this.cmdSkill(skill, p.x, p.y);
    if (def.kind === 'summon' || def.kind === 'corpse') {
      // Raise from the corpse nearest you; explode the corpse nearest your target.
      const near = def.kind === 'corpse' ? this.autoTarget(11) ?? p : p;
      const c = this.findCorpse(near.x, near.y, def.kind === 'corpse' ? 6 : 10);
      return this.cmdSkill(skill, c?.x ?? p.x, c?.y ?? p.y);
    }
    if (def.kind === 'construct') {
      // Turrets go up a step toward the enemy, the sentinel between you and them, the furnace behind you.
      const foe = this.autoTarget(10);
      const dir = (foe ? Math.atan2(foe.y - p.y, foe.x - p.x) : p.moveDir ? Math.atan2(p.moveDir.y, p.moveDir.x) : p.facing) + (def.id === 'furnace' ? Math.PI : 0);
      const dist = def.id === 'brass_sentinel' ? 1.6 : 1.2;
      return this.cmdSkill(skill, p.x + Math.cos(dir) * dist, p.y + Math.sin(dir) * dist);
    }
    const range = def.kind === 'teleport' ? 0 : this.isMeleeSkill(def) ? 5 : def.kind === 'cone' ? 6 : 11;
    const target = range ? this.autoTarget(range) : null;
    if (target) return this.cmdSkill(skill, target.x, target.y, target.id);
    const dist = def.kind === 'teleport' || def.kind === 'leap' ? 6 : 4;
    const dir = p.moveDir ? Math.atan2(p.moveDir.y, p.moveDir.x) : p.facing;
    this.cmdSkill(skill, p.x + Math.cos(dir) * dist, p.y + Math.sin(dir) * dist);
  }

  autoTarget(range: number): Monster | null {
    const p = this.player;
    let best: Monster | null = null;
    let bestScore = Infinity;
    const focus = this.area.monsters.find((m) => m.id === this.focusId && !m.dead);
    for (const m of this.area.monsters) {
      if (m.dead || m.sub) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > range || !lineOfSight(this.area.level, p, m)) continue;
      const ang = Math.abs(angleDiff(Math.atan2(m.y - p.y, m.x - p.x), p.facing));
      const score = d + ang * 1.2 - (m === focus ? 2 : 0);
      if (score < bestScore) (bestScore = score), (best = m);
    }
    return best;
  }

  isMeleeSkill(def: SkillDef) {
    return (def.kind === 'attack' && (def.weapon === 'melee' || (def.weapon === 'any' && !this.stats.isBow))) || def.kind === 'leap' || def.kind === 'whirlwind';
  }

  stop() {
    const p = this.player;
    p.intent = null;
    p.path = [];
  }

  private repath(x: number, y: number) {
    const p = this.player;
    const l = this.area.level;
    p.path = findPath(l, p, { x, y });
    p.pathT = 0.4;
    // Final step goes to the exact point when it is walkable.
    if (isWalkable(l, x, y) && p.path.length && Math.floor(x) === Math.floor(p.path[p.path.length - 1].x - 0.5) && Math.floor(y) === Math.floor(p.path[p.path.length - 1].y - 0.5)) {
      p.path[p.path.length - 1] = { x, y };
    }
  }

  // ---------------------------------------------------------------- interactables

  interactPos(t: Interactable): Point | null {
    const a = this.area;
    switch (t.kind) {
      case 'item':
        return a.ground.find((g) => g.id === t.id) ?? null;
      case 'object':
        return a.objects.find((o) => o.id === t.id) ?? null;
      case 'npc':
        return a.npcs.find((n) => n.id === t.id) ?? null;
      case 'waypoint':
        return a.level.waypoint ? { x: a.level.waypoint.x + 0.5, y: a.level.waypoint.y + 0.5 } : null;
      case 'stash':
        return a.level.spots.stash ? { x: a.level.spots.stash.x + 0.5, y: a.level.spots.stash.y + 0.5 } : null;
      case 'forge':
        return a.level.spots.forge ? { x: a.level.spots.forge.x + 0.5, y: a.level.spots.forge.y + 0.5 } : null;
      case 'portal': {
        const pp = this.portalPos();
        return pp;
      }
      case 'exit': {
        const e = a.level.exits[t.index];
        return e ? { x: e.x + 0.5, y: e.y + 0.5 } : null;
      }
    }
  }

  portalPos(): Point | null {
    if (!this.portal) return null;
    if (this.inTown) {
      if (areaAct(this.defOf(this.portal.area)) !== this.act) return null;
      const s = this.townPortalSpot();
      return { x: s.x + 0.5, y: s.y + 0.5 };
    }
    if (this.portal.area === this.area.def.id) return { x: this.portal.x, y: this.portal.y };
    return null;
  }

  interactLabel(t: Interactable): string {
    const a = this.area;
    switch (t.kind) {
      case 'item': {
        const g = a.ground.find((x) => x.id === t.id);
        return g?.gold ? `${g.gold} Gold` : g?.item ? displayName(g.item) : '';
      }
      case 'object': {
        const o = a.objects.find((x) => x.id === t.id);
        return o ? (o.kind === 'shrine' ? SHRINE_NAMES[o.shrine!] : o.kind === 'chest' ? 'Chest' : o.kind === 'brazier' ? 'Unlit Brazier' : 'Barrel') : '';
      }
      case 'npc': {
        const n = a.npcs.find((x) => x.id === t.id);
        return n ? n.name : '';
      }
      case 'waypoint':
        return 'Waypoint';
      case 'stash':
        return 'Stash';
      case 'forge':
        return 'The Forge';
      case 'portal':
        return this.inTown ? `Town Portal (${this.defOf(this.portal!.area).name})` : 'Town Portal';
      case 'exit': {
        const e = a.level.exits[t.index];
        return e ? (e.kind === 'down' && this.wardenAlive() ? 'Sealed Stairs' : e.label) : '';
      }
    }
  }

  /** Everything the player could interact with, nearest first, within `range`. */
  interactablesNear(x: number, y: number, range: number): { target: Interactable; d: number }[] {
    const a = this.area;
    const out: { target: Interactable; d: number }[] = [];
    const push = (target: Interactable, p: Point | null, bias = 0) => {
      if (!p) return;
      const d = Math.hypot(p.x - x, p.y - y) + bias;
      if (d <= range) out.push({ target, d });
    };
    for (const g of a.ground) push({ kind: 'item', id: g.id }, g, -0.1);
    for (const o of a.objects) if (!o.used) push({ kind: 'object', id: o.id }, o);
    for (const n of a.npcs) push({ kind: 'npc', id: n.id }, n, -0.3);
    if (a.level.waypoint) push({ kind: 'waypoint' }, this.interactPos({ kind: 'waypoint' }));
    if (a.level.spots.stash) push({ kind: 'stash' }, this.interactPos({ kind: 'stash' }));
    if (a.level.spots.forge) push({ kind: 'forge' }, this.interactPos({ kind: 'forge' }));
    push({ kind: 'portal' }, this.portalPos(), -0.2);
    a.level.exits.forEach((_, i) => push({ kind: 'exit', index: i }, this.interactPos({ kind: 'exit', index: i }), 0.3));
    return out.sort((p, q) => p.d - q.d);
  }

  /** Best thing under a world-space click: monsters first, then interactables. */
  pickAt(x: number, y: number): { monster?: Monster; target?: Interactable } {
    let best: Monster | undefined;
    let bd = Infinity;
    for (const m of this.area.monsters) {
      if (m.dead || m.sub) continue;
      // Hit-test slightly above the feet where the body is drawn.
      const d = Math.min(Math.hypot(m.x - x, m.y - y), Math.hypot(m.x - 0.35 * m.def.scale - x, m.y - 0.35 * m.def.scale - y));
      if (d < m.def.radius + 0.55 && d < bd) (bd = d), (best = m);
    }
    if (best) return { monster: best };
    const near = this.interactablesNear(x, y, 0.95);
    return near.length ? { target: near[0].target } : {};
  }

  private doInteract(t: Interactable) {
    const a = this.area;
    const p = this.player;
    switch (t.kind) {
      case 'item': {
        const g = a.ground.find((x) => x.id === t.id);
        if (g) this.pickup(g);
        break;
      }
      case 'object': {
        const o = a.objects.find((x) => x.id === t.id);
        if (o && !o.used) this.useObject(o);
        break;
      }
      case 'npc': {
        const n = a.npcs.find((x) => x.id === t.id);
        if (!n) break;
        n.facing = Math.atan2(p.y - n.y, p.x - n.x);
        if (n.kind === 'healer') {
          p.life = this.stats.maxLife;
          p.mana = this.stats.maxMana;
          p.poison.t = 0;
          this.fx({ kind: 'heal', x: p.x, y: p.y, dur: 0.8 });
        }
        if (n.kind === 'sage') this.sageRewards();
        this.emit({ type: 'open', panel: n.kind });
        break;
      }
      case 'waypoint':
        this.activateWaypoint();
        this.emit({ type: 'open', panel: 'waypoint' });
        break;
      case 'stash':
        this.emit({ type: 'open', panel: 'stash' });
        break;
      case 'forge':
        p.facing = -Math.PI / 2;
        this.emit({ type: 'open', panel: 'forge' });
        break;
      case 'portal':
        this.takePortal();
        break;
      case 'exit': {
        const e = a.level.exits[t.index];
        if (!e) break;
        const warden = e.kind === 'down' ? this.wardenAlive() : undefined;
        if (warden) {
          this.msg(`The stairs are sealed while ${warden.name} lives`, '#d080ff', 'sealed');
          this.sound('thud');
          break;
        }
        this.enterArea(e.to, 'exit', a.def.id);
        break;
      }
    }
  }

  private activateWaypoint() {
    const k = this.wpKey(this.area.def.id);
    if (!this.char.waypoints.includes(k)) {
      this.char.waypoints.push(k);
      this.msg('Waypoint activated', '#9fd8ff');
      this.sound('portal');
    }
  }

  waypointList() {
    const open = (act: number) => act === 1 || (act === 2 && this.roadSouthOpen) || (act === 3 && this.roadNorthOpen);
    return WAYPOINT_AREAS.filter((id) => open(areaAct(AREA_BY_ID[id]))).map((id) => ({
      id, name: AREA_BY_ID[id].name, act: areaAct(AREA_BY_ID[id]), active: this.char.waypoints.includes(this.wpKey(id)),
    }));
  }

  /** Where the caravan will go from here: the other towns the story has opened. */
  caravanStops(): string[] {
    const stops = ['town'];
    if (this.roadSouthOpen) stops.push('tel_maresh');
    if (this.roadNorthOpen) stops.push('emberwatch_ruins');
    return stops.filter((id) => id !== this.area.def.id);
  }

  /** The caravan runs between the towns once the roads are open. With no destination it goes south, or back north. */
  travelCaravan(to?: string) {
    const dest = to ?? (this.act === 1 ? 'tel_maresh' : 'town');
    if (!this.caravanStops().includes(dest)) return;
    const k = this.wpKey(dest);
    if (!this.char.waypoints.includes(k)) this.char.waypoints.push(k);
    this.sound('portal');
    this.enterArea(dest, 'start');
    if (dest === 'tel_maresh') this.tellOnce('arrive');
    if (dest === 'emberwatch_ruins') this.tellOnce('north');
  }

  useWaypoint(id: string): boolean {
    if (!this.char.waypoints.includes(this.wpKey(id))) return false;
    this.sound('portal');
    if (id !== this.area.def.id) this.enterArea(id, 'waypoint');
    return true;
  }

  castTownPortal(): boolean {
    if (this.player.dead) return false;
    if (this.inTown) {
      this.msg('You are already in town', undefined, 'tp');
      return false;
    }
    if (this.char.tpCharges <= 0) {
      this.msg('No Town Portal scrolls', '#ff8a6a', 'tp');
      return false;
    }
    this.char.tpCharges--;
    const p = this.player;
    const spot = nearestFloor(this.area.level, { x: p.x + Math.cos(p.facing) * 1.5, y: p.y + Math.sin(p.facing) * 1.5 });
    this.portal = { area: this.area.def.id, x: spot.x + 0.5, y: spot.y + 0.5 };
    this.fx({ kind: 'portal_open', x: this.portal.x, y: this.portal.y, dur: 0.8 });
    this.sound('portal');
    this.cmdInteract({ kind: 'portal' });
    return true;
  }

  private takePortal() {
    if (!this.portal) return;
    this.sound('portal');
    if (this.inTown) {
      const dest = this.portal.area;
      this.enterArea(dest, 'portal');
      this.portal = null;
    } else {
      this.enterArea(this.homeTown, 'portal');
    }
  }

  // ---------------------------------------------------------------- items

  pickup(g: GroundItem) {
    const a = this.area;
    if (g.gold) {
      this.char.gold += g.gold;
      this.sound('gold');
      a.ground.splice(a.ground.indexOf(g), 1);
      return;
    }
    const it = g.item!;
    const b = baseOf(it);
    if (b.id === 'tp_scroll' && this.char.tpCharges < 20) {
      this.char.tpCharges++;
      this.sound('item');
      a.ground.splice(a.ground.indexOf(g), 1);
      return;
    }
    if (b.kind === 'potion') {
      if (!addPotion(this.char, b.id)) return this.rejectPickup(g, 'No room for that potion', 'potfull');
      this.sound('potion');
      a.ground.splice(a.ground.indexOf(g), 1);
      return;
    }
    if (!addToInventory(this.char, it)) return this.rejectPickup(g, 'Inventory is full', 'invfull');
    this.sound('item');
    a.ground.splice(a.ground.indexOf(g), 1);
  }

  /** Replays the landing bounce with a thud. Clicks during a bounce don't restart it, so spam-clicking can't stutter. */
  private rejectPickup(g: GroundItem, text: string, throttleKey: string) {
    this.msg(text, '#ff8a6a', throttleKey);
    if (g.t < LOOT_BOUNCE) return;
    g.t = 0;
    this.sound('thud');
  }

  dropToGround(item: Item, x: number, y: number, scatter = true) {
    const l = this.area.level;
    let px = x;
    let py = y;
    if (scatter) {
      for (let i = 0; i < 8; i++) {
        const tx = x + this.rng.range(-1.3, 1.3);
        const ty = y + this.rng.range(-1.3, 1.3);
        if (isWalkable(l, tx, ty)) {
          px = tx;
          py = ty;
          break;
        }
      }
    }
    this.area.ground.push({ id: this.id(), x: px, y: py, item, t: 0 });
  }

  private spawnDrops(x: number, y: number, mlvl: number, tier: DropTier) {
    const lucky = this.player.buffs.shrine_fortune ? 1 : 0;
    // The deeper the floor, the more the dead give up.
    const deep = depthFortune(this.depth);
    const drops = rollDrops(this.rng, mlvl, tier, { mf: this.stats.mf + 75 * lucky + deep, gf: this.stats.gf + 150 * lucky + deep, classId: this.char.classId });
    for (const d of drops) {
      if (d.kind === 'gold') {
        let gx = x;
        let gy = y;
        const tx = x + this.rng.range(-1, 1);
        const ty = y + this.rng.range(-1, 1);
        if (isWalkable(this.area.level, tx, ty)) (gx = tx), (gy = ty);
        this.area.ground.push({ id: this.id(), x: gx, y: gy, gold: d.amount, t: 0 });
      } else {
        this.dropToGround(d.item, x, y);
        if (d.item.rarity === 'unique' || d.item.rarity === 'set') this.sound('unique');
        else if (d.item.rarity === 'rare') this.sound('rare');
      }
    }
  }

  dropFromInventory(uid: number) {
    const it = removeFromGrid(this.char.inventory, uid);
    if (it) this.dropToGround(it, this.player.x, this.player.y);
  }

  equip(uid: number, slot?: Slot): string | null {
    const err = equipFromInventory(this.char, uid, slot);
    if (err) this.msg(err, '#ff8a6a');
    else this.sound('item');
    this.refreshStats();
    return err;
  }

  unequip(slot: Slot): string | null {
    const err = unequip(this.char, slot);
    if (err) this.msg(err, '#ff8a6a');
    this.refreshStats();
    return err;
  }

  /** The potion this pool's key would drink now, counting healing already on its way. */
  nextPotion(pool: PotionPool): string | null {
    const p = this.player;
    const s = this.stats;
    const queued = (k: 'hp' | 'mp') => p.heal.reduce((n, h) => n + (h[k] * h.t) / 3, 0);
    const missing =
      pool === 'hp' ? s.maxLife - p.life - queued('hp')
      : pool === 'mp' ? s.maxMana - p.mana - queued('mp')
      : Math.max(1 - p.life / s.maxLife, 1 - p.mana / s.maxMana) * 100;
    return choosePotion(this.char, pool, missing);
  }

  usePotion(pool: PotionPool): boolean {
    if (this.player.dead) return false;
    const id = this.nextPotion(pool);
    if (!id) return false;
    takePotion(this.char, id);
    this.drink(id);
    return true;
  }

  private drink(baseId: string) {
    const b = baseOf(baseId);
    const pot = b.potion!;
    const p = this.player;
    if (pot.type === 'rejuv') {
      p.life = Math.min(this.stats.maxLife, p.life + (this.stats.maxLife * pot.amount) / 100);
      p.mana = Math.min(this.stats.maxMana, p.mana + (this.stats.maxMana * pot.amount) / 100);
    } else {
      p.heal.push({ hp: pot.type === 'hp' ? pot.amount : 0, mp: pot.type === 'mp' ? pot.amount : 0, t: 3 });
    }
    this.fx({ kind: 'heal', x: p.x, y: p.y, dur: 0.6, color: pot.type === 'mp' ? '#4f7dff' : '#ff4040' });
    this.sound('potion');
  }

  /** Use an inventory item: drink potions, read scrolls. Gems are socketed with socketGem. */
  useItem(uid: number): boolean {
    const e = this.char.inventory.find((x) => x.item.uid === uid);
    if (!e) return false;
    const b = baseOf(e.item);
    if (b.kind === 'potion') {
      removeFromGrid(this.char.inventory, uid);
      this.drink(b.id);
      return true;
    }
    if (b.kind === 'scroll') {
      if (this.char.tpCharges >= 20) return false;
      removeFromGrid(this.char.inventory, uid);
      this.char.tpCharges++;
      return true;
    }
    return false;
  }

  findItem(uid: number): { item: Item; where: 'inventory' | 'stash' | 'equipment'; slot?: Slot } | null {
    const inv = this.char.inventory.find((e) => e.item.uid === uid);
    if (inv) return { item: inv.item, where: 'inventory' };
    const st = this.char.stash.find((e) => e.item.uid === uid);
    if (st) return { item: st.item, where: 'stash' };
    for (const [slot, it] of Object.entries(this.char.equipment)) if (it?.uid === uid) return { item: it, where: 'equipment', slot: slot as Slot };
    return null;
  }

  socketTargets(): Item[] {
    const out: Item[] = [];
    for (const it of Object.values(this.char.equipment)) if (it && it.sockets > it.gems.length) out.push(it);
    for (const e of this.char.inventory) if (e.item.sockets > e.item.gems.length) out.push(e.item);
    return out;
  }

  socketGem(gemUid: number, targetUid: number): boolean {
    const gemEntry = this.char.inventory.find((e) => e.item.uid === gemUid);
    const target = this.findItem(targetUid);
    if (!gemEntry || !target || baseOf(gemEntry.item).kind !== 'gem') return false;
    if (target.item.sockets <= target.item.gems.length) return false;
    removeFromGrid(this.char.inventory, gemUid);
    target.item.gems.push(gemEntry.item.base);
    this.sound('item');
    this.refreshStats();
    return true;
  }

  toStash(uid: number): boolean {
    const it = this.char.inventory.find((e) => e.item.uid === uid)?.item;
    if (!it) return false;
    if (!addToGrid(this.char.stash, STASH_COLS, STASH_ROWS, it)) {
      this.msg('Stash is full', '#ff8a6a');
      return false;
    }
    removeFromGrid(this.char.inventory, uid);
    return true;
  }

  fromStash(uid: number): boolean {
    const it = this.char.stash.find((e) => e.item.uid === uid)?.item;
    if (!it) return false;
    if (baseOf(it).kind === 'potion') {
      if (!addPotion(this.char, it.base)) {
        this.msg('No room for that potion', '#ff8a6a');
        return false;
      }
      removeFromGrid(this.char.stash, uid);
      return true;
    }
    if (!addToGrid(this.char.inventory, INV_COLS, INV_ROWS, it)) {
      this.msg('Inventory is full', '#ff8a6a');
      return false;
    }
    removeFromGrid(this.char.stash, uid);
    return true;
  }

  depositGold(amount = this.char.gold) {
    const n = Math.min(amount, this.char.gold);
    this.char.gold -= n;
    this.char.stashGold += n;
  }

  withdrawGold(amount = this.char.stashGold) {
    const n = Math.min(amount, this.char.stashGold);
    this.char.stashGold -= n;
    this.char.gold += n;
  }

  buy(vendor: 'healer' | 'smith', uid: number): string | null {
    const list = this.vendors[vendor];
    const i = list.findIndex((x) => x.uid === uid);
    if (i < 0) return 'Sold out';
    const it = list[i];
    const price = buyPrice(it);
    if (this.char.gold < price) return 'Not enough gold';
    const b = baseOf(it);
    // Consumables are restocked forever; equipment is one of a kind.
    const copy = b.kind === 'potion' || b.kind === 'scroll' ? makeItem(it.base) : it;
    if (b.kind === 'scroll' && this.char.tpCharges < 20) this.char.tpCharges++;
    else if (b.kind === 'potion') {
      if (!addPotion(this.char, b.id)) return 'No room for that potion';
    } else if (!addToInventory(this.char, copy)) return 'Inventory is full';
    if (copy === it) list.splice(i, 1);
    this.char.gold -= price;
    this.sound('gold');
    return null;
  }

  sell(uid: number): string | null {
    const it = removeFromGrid(this.char.inventory, uid);
    if (!it) return 'Item not found';
    this.char.gold += sellPrice(it);
    if (!['potion', 'scroll', 'gem'].includes(baseOf(it).kind)) this.vendors.smith.unshift(it);
    this.sound('gold');
    return null;
  }

  gambleBuy(kind: ItemKind): Item | string {
    const price = gamblePrice(kind, this.char.level);
    if (this.char.gold < price) return 'Not enough gold';
    const it = gamble(this.rng, kind, this.char.level);
    it.identified = true;
    if (!addToInventory(this.char, it)) return 'Inventory is full';
    this.char.gold -= price;
    this.sound(it.rarity === 'unique' || it.rarity === 'set' ? 'unique' : 'gold');
    return it;
  }

  /** Does one job at the Forge (see forge.ts) and plays what it sounds and looks like. */
  forge(action: ForgeAction): ForgeResult {
    const r = forgeApply(this.char, this.forgeRng, action);
    if (!r.ok) return r;
    this.refreshStats();
    this.sound(r.outcome === 'shatter' ? 'shatter' : r.outcome === 'crack' ? 'crack' : r.type === 'quench' ? 'quench' : r.type === 'salvage' || r.type === 'salvageJunk' ? 'thud' : 'anvil');
    if (r.tone === 'great') this.sound(r.item && (r.item.rarity === 'unique' || r.item.rarity === 'set') && r.type === 'smelt' ? 'unique' : 'rare');
    const at = this.interactPos({ kind: 'forge' });
    // Panels pause the world, so effects wait for it to resume: one burst is enough, however many jobs were done.
    if (at && this.inTown && !this.area.fx.some((f) => f.t === 0 && f.x === at.x && f.y === at.y + 0.6)) {
      this.fx({ kind: r.type === 'quench' ? 'dust' : 'spark', x: at.x, y: at.y + 0.6, dur: 0.5, color: r.tone === 'bad' ? '#ff5030' : '#ffd070' });
      if (r.tone === 'great') this.fx({ kind: 'cinders', x: at.x, y: at.y + 0.6, dur: 0.9 });
    }
    if (r.rankUp) {
      this.msg(`Forge mastery: ${r.rankUp.name}${r.rankUp.unlock ? ` (${r.rankUp.unlock} unlocked)` : ''}`, '#e8c860');
      this.sound('quest');
    }
    return r;
  }

  identifyAll(): number {
    let n = 0;
    const all = [...this.char.inventory.map((e) => e.item), ...this.char.stash.map((e) => e.item), ...Object.values(this.char.equipment)];
    for (const it of all) if (it && !it.identified) (it.identified = true), n++;
    if (n) {
      this.sound('item');
      this.refreshStats();
    }
    return n;
  }

  private sageRewards() {
    const c = this.char;
    if (this.questState('hollow') === 'done') {
      c.skillPoints++;
      this.setQuest('hollow', 'rewarded');
      this.msg(`Quest complete: ${QUEST_BY_ID.hollow.name} (+1 Skill Point)`, '#e8c860');
      this.sound('quest');
    }
    if (this.questState('bishop') === 'done') {
      c.statPoints += 5;
      this.setQuest('bishop', 'rewarded');
      this.msg(`Quest complete: ${QUEST_BY_ID.bishop.name} (+5 Stat Points)`, '#e8c860');
      this.sound('quest');
    }
    if (this.questState('forge') === 'done') this.setQuest('forge', 'rewarded');
    // Each town's sage pays out that act's quests, by what the reward says.
    for (const q of QUESTS) {
      if ((q.act ?? 1) !== this.act || this.act === 1 || this.questState(q.id) !== 'done') continue;
      if (q.reward.includes('Skill Point')) c.skillPoints++;
      if (q.reward.includes('Stat Points')) c.statPoints += 5;
      this.setQuest(q.id, 'rewarded');
      this.msg(`Quest complete: ${q.name} (${q.reward})`, '#e8c860');
      this.sound('quest');
      if (q.id === 'hollow_sun') this.tellOnce('ember_dims');
    }
  }

  // ---------------------------------------------------------------- main loop

  step(dt: number) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.char.playTime += dt;
    const a = this.area;
    for (const f of a.fx) f.t += dt;
    a.fx = a.fx.filter((f) => f.t < f.dur);
    for (const g of a.ground) g.t += dt;
    for (const o of a.orbs) o.t += dt;
    if (a.orbs.length) a.orbs = a.orbs.filter((o) => o.t < ORB_LIFE);
    this.focusT -= dt;
    this.runTimers(dt);
    this.updatePlayer(dt);
    a.flow.update(this.player.x, this.player.y);
    this.updateMonsters(dt);
    this.updateMinions(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateRings(dt);
    this.updateStorm(dt);
    this.updateWarmth(dt);
    this.exploreT -= dt;
    if (this.exploreT <= 0) {
      this.exploreT = 0.2;
      this.markExplored(false);
    }
  }

  private markExplored(force: boolean) {
    const a = this.area;
    const l = a.level;
    const r = Math.ceil(this.sight + 2);
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    if (!force && a.def.town) return;
    let found = false;
    for (let y = py - r; y <= py + r; y++)
      for (let x = px - r; x <= px + r; x++) {
        if (x < 0 || y < 0 || x >= l.w || y >= l.h) continue;
        const i = y * l.w + x;
        if (a.explored[i] || (x - px) ** 2 + (y - py) ** 2 > r * r) continue;
        a.explored[i] = 1;
        found = true;
      }
    if (a.def.town) a.explored.fill(1);
    if (found) a.exploredRev++;
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const st = this.stats;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurt > 0) p.hurt -= dt;
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (p.dead) return;
    if (this.streak.n > 0 && (this.streak.t -= dt) <= 0) this.endSpree(false);
    if (p.buffs.shrine_storm) this.stormShrine(dt);

    // Regeneration, potions, buffs, damage over time.
    p.mana = Math.min(st.maxMana, p.mana + st.manaRegen * dt);
    this.regenAcc += dt;
    if (this.regenAcc >= 1) {
      this.regenAcc -= 1;
      p.life = Math.min(st.maxLife, p.life + st.lifeRegen);
    }
    for (const h of p.heal) {
      const k = Math.min(dt, h.t) / 3;
      p.life = Math.min(st.maxLife, p.life + h.hp * k);
      p.mana = Math.min(st.maxMana, p.mana + h.mp * k);
      h.t -= dt;
    }
    p.heal = p.heal.filter((h) => h.t > 0);
    if (p.poison.t > 0) {
      p.poison.t -= dt;
      p.life -= p.poison.dps * dt;
      if (p.life <= 0) return this.die();
    }
    if (p.chill > 0) p.chill -= dt;
    let buffChanged = false;
    for (const [k, b] of Object.entries(p.buffs)) {
      b.t -= dt;
      if (b.t <= 0) {
        delete p.buffs[k];
        buffChanged = true;
        if (k === 'shrine_experience') p.xpBonus = 0;
        // White Heat leaves the smith at the top of the gauge with nothing holding it back.
        if (k === 'white_heat') this.boilOver();
      }
    }
    if (p.frenzy.stacks > 0) {
      p.frenzy.t -= dt;
      if (p.frenzy.t <= 0) {
        p.frenzy.stacks = 0;
        buffChanged = true;
      }
    }
    if (buffChanged) this.refreshStats();
    if (this.char.classId === 'forgewright') this.updateHeat(dt);

    if (p.action) {
      this.updateAction(dt);
      return;
    }

    const speed = st.moveSpeed * (p.chill > 0 ? 0.6 : 1) * (this.inQuicksand(p) ? 0.6 : 1) * (this.frost > 0.5 ? 0.78 : 1);
    p.moving = false;
    if (p.moveDir) {
      const len = Math.hypot(p.moveDir.x, p.moveDir.y);
      const k = Math.min(1, len);
      this.moveEntity(p, (p.moveDir.x / len) * speed * k * dt, (p.moveDir.y / len) * speed * k * dt, 0.3);
      p.facing = Math.atan2(p.moveDir.y, p.moveDir.x);
      p.moving = true;
    } else if (p.intent) {
      this.processIntent(dt, speed);
    }
    if (p.moving) p.walk += dt * speed;
    this.collectOrbs();
    this.autoPickup();
    this.checkExits();
  }

  private autoPickup() {
    const p = this.player;
    const a = this.area;
    for (const g of a.ground.slice()) {
      if (Math.hypot(g.x - p.x, g.y - p.y) > 0.7) continue;
      if (g.gold) this.pickup(g);
      else if (g.item) {
        const b = baseOf(g.item);
        if (b.kind === 'potion' || b.kind === 'scroll') {
          // Only auto-grab consumables that fit somewhere without filling the bag.
          if ((b.kind === 'scroll' && this.char.tpCharges < 20) || (b.kind === 'potion' && addPotion(this.char, b.id))) {
            if (b.kind === 'scroll') this.char.tpCharges++;
            this.sound('potion');
            a.ground.splice(a.ground.indexOf(g), 1);
          }
        }
      }
    }
    if (a.level.waypoint && Math.hypot(a.level.waypoint.x + 0.5 - p.x, a.level.waypoint.y + 0.5 - p.y) < 1.4) this.activateWaypoint();
    // The ember lights any brazier the hero brushes past.
    if (a.def.cold) for (const o of a.objects) if (o.kind === 'brazier' && !o.used && Math.hypot(o.x - p.x, o.y - p.y) < 1.1) this.lightBrazier(o);
  }

  private checkExits() {
    const p = this.player;
    if (p.invuln > 0.6) return;
    const a = this.area;
    if (!p.moving) return;
    for (const e of a.level.exits) {
      // Stairs need a deliberate click/tap; edge paths trigger when walking into them.
      if (e.kind !== 'path') continue;
      const dx = e.x + 0.5 - p.x;
      const dy = e.y + 0.5 - p.y;
      if (Math.hypot(dx, dy) < 0.75 && Math.cos(Math.atan2(dy, dx) - p.facing) > 0) {
        this.enterArea(e.to, 'exit', a.def.id);
        return;
      }
    }

  }

  private followPath(dt: number, speed: number, goal: Point): boolean {
    const p = this.player;
    p.pathT -= dt;
    if (p.pathT <= 0 && !p.path.length) this.repath(goal.x, goal.y);
    const next = p.path[0];
    if (!next) return false;
    const dx = next.x - p.x;
    const dy = next.y - p.y;
    const d = Math.hypot(dx, dy);
    const stepLen = speed * dt;
    if (d <= stepLen) {
      p.x = next.x;
      p.y = next.y;
      p.path.shift();
    } else {
      this.moveEntity(p, (dx / d) * stepLen, (dy / d) * stepLen, 0.3);
    }
    if (d > 0.01) p.facing = Math.atan2(dy, dx);
    p.moving = true;
    return true;
  }

  private processIntent(dt: number, speed: number) {
    const p = this.player;
    const it = p.intent!;
    if (it.kind === 'move') {
      if (!this.followPath(dt, speed, it)) p.intent = null;
      return;
    }
    if (it.kind === 'interact') {
      const pos = this.interactPos(it.target);
      if (!pos) return void (p.intent = null);
      const reach = it.target.kind === 'npc' ? 1.6 : it.target.kind === 'exit' ? 0.7 : it.target.kind === 'forge' ? 1.3 : 1.1;
      if (Math.hypot(pos.x - p.x, pos.y - p.y) <= reach) {
        p.intent = null;
        p.path = [];
        this.doInteract(it.target);
        return;
      }
      // The forge is solid: walk to the tile in front of it.
      const dest = it.target.kind === 'forge' ? { x: pos.x, y: pos.y + 1 } : pos;
      if (!this.followPath(dt, speed, dest)) {
        if (p.pathT <= 0) this.repath(dest.x, dest.y);
        if (!p.path.length) p.intent = null;
      }
      return;
    }
    // Skill intent.
    const def = SKILL_BY_ID[it.skill];
    const target = it.targetId !== undefined ? this.area.monsters.find((m) => m.id === it.targetId && !m.dead) : undefined;
    if (it.targetId !== undefined && !target) return void (p.intent = null);
    const tx = target ? target.x : it.x;
    const ty = target ? target.y : it.y;
    if (target) this.setFocus(target);
    const melee = this.isMeleeSkill(def) && def.kind === 'attack';
    if (melee && target) {
      const reach = 0.3 + target.def.radius + this.stats.range;
      if (Math.hypot(tx - p.x, ty - p.y) > reach) {
        p.pathT -= dt;
        if (p.pathT <= 0 || !p.path.length) this.repath(tx, ty);
        if (!this.followPath(dt, speed, { x: tx, y: ty })) p.intent = null;
        return;
      }
    }
    // Ranged skills need line of sight to their target, and short-ranged ones need to get close.
    const castRange = def.kind === 'shards' ? 6.5 : def.kind === 'curse' ? 10 : def.kind === 'anvil' ? 9 : def.kind === 'cone' ? 3.2 : Infinity;
    if (target && !melee && def.kind !== 'teleport' && (!lineOfSight(this.area.level, p, target) || Math.hypot(tx - p.x, ty - p.y) > castRange)) {
      p.pathT -= dt;
      if (p.pathT <= 0 || !p.path.length) this.repath(tx, ty);
      if (!this.followPath(dt, speed, { x: tx, y: ty })) p.intent = null;
      return;
    }
    p.intent = null;
    p.path = [];
    this.startSkill(def, tx, ty, target?.id);
  }

  setFocus(m: Monster) {
    this.focusId = m.id;
    this.focusT = 4;
  }

  private startSkill(def: SkillDef, tx: number, ty: number, targetId?: number) {
    const p = this.player;
    const st = this.stats;
    const lvl = skillLevel(this.char, def.id);
    if (!lvl) return;
    if (def.weapon === 'bow' && !st.isBow) return this.msg('Requires a bow', '#ff8a6a', 'bow');
    if (def.weapon === 'melee' && st.isBow) return this.msg('Requires a melee weapon', '#ff8a6a', 'melee');
    if (def.id === 'raise_skeleton' || def.kind === 'corpse') {
      if (!this.findCorpse(tx, ty, 2.5) && !this.findCorpse(p.x, p.y, 10)) return this.msg('No corpse nearby', '#c8b890', 'corpse');
    }
    if (def.kind === 'vent' && p.heat < HEAT_VENT) return this.msg('Not enough Heat', '#ff9a5a', 'heat');
    const cost = def.mana(lvl);
    if (p.mana < cost) {
      this.msg('Not enough mana', '#7f9fff', 'mana');
      this.sound('nomana');
      return;
    }
    p.mana -= cost;
    p.facing = Math.atan2(ty - p.y, tx - p.x) || p.facing;
    const attackDur = 1 / (st.attackSpeed * (p.chill > 0 ? 0.7 : 1));
    const base = { skill: def.id, t: 0, done: false, x: tx, y: ty, targetId };
    if (def.kind === 'leap') {
      const pr = def.params(lvl);
      const d = Math.min(pr.range!, Math.hypot(tx - p.x, ty - p.y));
      const ang = Math.atan2(ty - p.y, tx - p.x);
      let land = { x: p.x, y: p.y };
      for (let s = d; s > 0.5; s -= 0.25) {
        const cx = p.x + Math.cos(ang) * s;
        const cy = p.y + Math.sin(ang) * s;
        if (isWalkable(this.area.level, cx, cy) && lineOfSight(this.area.level, p, { x: cx, y: cy })) {
          land = { x: cx, y: cy };
          break;
        }
      }
      p.action = { ...base, kind: 'leap', dur: 0.55, hitAt: 0.55, x: land.x, y: land.y, fromX: p.x, fromY: p.y };
      this.sound('swing');
      return;
    }
    if (def.kind === 'whirlwind') {
      const pr = def.params(lvl);
      const ang = Math.atan2(ty - p.y, tx - p.x);
      const d = Math.max(2, Math.min(pr.range!, Math.hypot(tx - p.x, ty - p.y)));
      p.action = { ...base, kind: 'whirl', dur: d / 7, hitAt: 0, x: p.x + Math.cos(ang) * d, y: p.y + Math.sin(ang) * d, tick: 0 };
      return;
    }
    if (def.kind === 'attack' || def.kind === 'multishot' || def.kind === 'strafe' || def.kind === 'cone' || def.kind === 'quake') {
      const bow = st.isBow && def.weapon !== 'melee';
      if (bow) {
        const dur = def.kind === 'strafe' ? attackDur * 2.2 : attackDur;
        p.action = { ...base, kind: 'shoot', dur, hitAt: def.kind === 'strafe' ? 0.15 * dur : 0.45 * dur, tick: 0 };
      } else {
        p.action = { ...base, kind: 'melee', dur: attackDur, hitAt: attackDur * 0.5 };
        this.sound('swing');
      }
      return;
    }
    const castDur = st.castTime * (def.castTime ?? 1);
    p.action = { ...base, kind: 'cast', dur: castDur, hitAt: castDur * 0.55 };
  }

  private updateAction(dt: number) {
    const p = this.player;
    const act = p.action!;
    act.t += dt;
    if (act.kind === 'dodge') {
      const step = (DODGE_DIST / DODGE_TIME) * dt;
      const moved = this.moveEntity(p, act.x * step, act.y * step, 0.3);
      p.walk += step;
      act.tick = (act.tick ?? 0) - dt;
      if (act.tick <= 0) {
        act.tick = 0.045;
        this.fx({ kind: 'dash', x: p.x, y: p.y, dur: 0.28, r: p.facing });
      }
      if (act.t >= act.dur || !moved) {
        p.action = null;
        this.collectOrbs();
        this.autoPickup();
      }
      return;
    }
    const def = SKILL_BY_ID[act.skill];
    const lvl = Math.max(1, skillLevel(this.char, act.skill));
    if (act.kind === 'leap') {
      const k = Math.min(1, act.t / act.dur);
      p.x = act.fromX! + (act.x - act.fromX!) * k;
      p.y = act.fromY! + (act.y - act.fromY!) * k;
      if (k >= 1) {
        p.action = null;
        const pr = def.params(lvl);
        this.fx({ kind: 'slam', x: p.x, y: p.y, dur: 0.5, r: pr.radius });
        this.emit({ type: 'shake', amount: 6 });
        this.sound('boom');
        for (const m of this.monstersNear(p.x, p.y, pr.radius! + 0.4)) this.playerWeaponHit(m, def, pr, { knock: 1.4 });
      }
      return;
    }
    if (act.kind === 'whirl') {
      const pr = def.params(lvl);
      const dx = act.x - p.x;
      const dy = act.y - p.y;
      const d = Math.hypot(dx, dy);
      const sp = 7 * dt;
      p.facing += dt * 25;
      if (d > 0.1) {
        const moved = this.moveEntity(p, (dx / d) * Math.min(sp, d), (dy / d) * Math.min(sp, d), 0.3);
        if (!moved) act.t = act.dur;
      }
      act.tick = (act.tick ?? 0) - dt;
      if (act.tick! <= 0) {
        act.tick = 0.2;
        this.fx({ kind: 'whirl', x: p.x, y: p.y, dur: 0.25, r: pr.radius });
        this.sound('swing');
        for (const m of this.monstersNear(p.x, p.y, pr.radius!)) this.playerWeaponHit(m, def, pr, {});
      }
      if (act.t >= act.dur || d < 0.15) p.action = null;
      return;
    }
    if (act.kind === 'shoot' && def.kind === 'strafe') {
      act.tick = (act.tick ?? 0) - dt;
      if (act.t >= act.hitAt && act.tick! <= 0 && !act.done) {
        const pr = def.params(lvl);
        const targets = this.monstersNear(p.x, p.y, 11).filter((m) => lineOfSight(this.area.level, p, m)).slice(0, pr.count!);
        if (!targets.length) {
          this.fireArrow(def, pr, Math.atan2(act.y - p.y, act.x - p.x));
        } else {
          for (const [i, m] of targets.entries()) {
            const ang = Math.atan2(m.y - p.y, m.x - p.x);
            // Stagger the volley slightly for a rapid-fire feel.
            setTimeoutSim(this, i * 0.07, () => this.fireArrow(def, pr, ang));
          }
        }
        act.done = true;
      }
    } else if (!act.done && act.t >= act.hitAt) {
      act.done = true;
      this.resolveAction(act, def, lvl);
    }
    if (act.t >= act.dur) p.action = null;
  }

  private timers: { t: number; fn: () => void }[] = [];
  addTimer(t: number, fn: () => void) {
    this.timers.push({ t, fn });
  }
  private runTimers(dt: number) {
    if (!this.timers.length) return;
    for (const tm of this.timers) tm.t -= dt;
    const due = this.timers.filter((tm) => tm.t <= 0);
    this.timers = this.timers.filter((tm) => tm.t > 0);
    for (const tm of due) tm.fn();
  }

  private resolveAction(act: PlayerAction, def: SkillDef, lvl: number) {
    const p = this.player;
    const pr = def.params(lvl);
    const ang = Math.atan2(act.y - p.y, act.x - p.x);
    if (act.kind === 'melee' && def.kind === 'cone') {
      // Shockwave: everything in an arc in front of the hammer.
      const wpr = this.withSynergy(def, pr);
      const reach = pr.range!;
      let landed = false;
      for (const m of this.monstersNear(p.x, p.y, reach)) {
        if (Math.abs(angleDiff(Math.atan2(m.y - p.y, m.x - p.x), ang)) > 0.7 || !lineOfSight(this.area.level, p, m)) continue;
        landed = this.playerWeaponHit(m, def, wpr, { knock: 1.3 }) || landed;
      }
      this.fx({ kind: 'wave', x: p.x, y: p.y, dur: 0.45, r: reach, ang });
      this.emit({ type: 'shake', amount: 4 });
      this.sound('boom');
      if (landed) this.gainHeat(12);
      return;
    }
    if (act.kind === 'melee' && def.kind === 'quake') {
      // Earthshaker: tremors that widen as they go. Whatever stands close is struck by every one.
      const wpr = this.withSynergy(def, pr);
      const a = this.area;
      const n = pr.count!;
      for (let i = 0; i < n; i++) {
        this.addTimer(i * 0.26, () => {
          if (this.area !== a || p.dead) return;
          const r = (pr.radius! * (i + 1)) / n;
          let landed = false;
          for (const m of this.monstersNear(p.x, p.y, r)) landed = this.playerWeaponHit(m, def, wpr, { knock: 0.5, stun: pr.stun }) || landed;
          this.fx({ kind: 'slam', x: p.x, y: p.y, dur: 0.5, r });
          this.emit({ type: 'shake', amount: 4 + i * 2 });
          this.sound('boom');
          if (landed) this.gainHeat(7);
        });
      }
      return;
    }
    if (act.kind === 'melee') {
      const target = act.targetId !== undefined ? this.area.monsters.find((m) => m.id === act.targetId && !m.dead) : undefined;
      const victims = target ? [target] : this.monstersNear(p.x + Math.cos(ang) * 0.7, p.y + Math.sin(ang) * 0.7, 0.9).slice(0, 1);
      for (const m of victims) {
        if (Math.hypot(m.x - p.x, m.y - p.y) > m.def.radius + this.stats.range + 0.6) continue;
        if (this.playerWeaponHit(m, def, pr, { knock: def.id === 'bash' ? 1.2 : 0 })) {
          this.gainHeat(def.id === 'attack' ? 5 : 8);
          if (def.id === 'sunder' && !m.dead) m.sunder = { t: pr.duration!, pct: pr.pct! };
        }
      }
      return;
    }
    if (act.kind === 'shoot') {
      if (def.kind === 'multishot') {
        const n = pr.count!;
        const spread = Math.min(1.1, 0.12 * n);
        for (let i = 0; i < n; i++) this.fireArrow(def, pr, ang + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1)));
      } else {
        this.fireArrow(def, pr, ang);
      }
      this.sound('bow');
      return;
    }
    // Spells.
    const syn = synergyBonus(def, this.char.skills);
    const el = def.element ?? 'phys';
    const spellDmg = (): Damage => elemDamage(el, roll(this.rng, pr.min ?? 0, pr.max ?? 0) * syn);
    if (el === 'fire') this.feedEmber(0.07);
    switch (def.kind) {
      case 'projectile': {
        const kind = def.id === 'fire_bolt' ? 'firebolt' : def.id === 'ice_bolt' ? 'icebolt' : def.id === 'bone_lance' ? 'bonelance' : 'fireball';
        this.spawnProjectile({
          x: p.x, y: p.y, ang, speed: def.id === 'fireball' ? 9 : 11, ttl: 1.3, owner: 'player', dmg: spellDmg(), kind,
          radius: 0.35, explode: pr.radius, chill: pr.chill, srcLevel: this.char.level, pierce: def.id === 'bone_lance',
        });
        this.sound(el === 'cold' ? 'cold' : el === 'phys' ? 'swing' : 'fire');
        break;
      }
      case 'shards': {
        const n = pr.count!;
        const spread = Math.min(0.9, 0.11 * n);
        for (let i = 0; i < n; i++) {
          const a2 = ang + (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1)) + this.rng.range(-0.04, 0.04);
          this.spawnProjectile({ x: p.x, y: p.y, ang: a2, speed: 13, ttl: 0.6, owner: 'player', dmg: spellDmg(), kind: 'boneshard', radius: 0.25, srcLevel: this.char.level });
        }
        this.sound('swing');
        break;
      }
      case 'ring': {
        const n = pr.count!;
        for (let i = 0; i < n; i++) {
          this.spawnProjectile({
            x: p.x, y: p.y, ang: ang + (i / n) * TAU, speed: 10, ttl: 0.9, owner: 'player', dmg: spellDmg(), kind: 'bonelance', radius: 0.35,
            pierce: true, srcLevel: this.char.level,
          });
        }
        this.fx({ kind: 'shout', x: p.x, y: p.y, dur: 0.4, r: 2, color: '#f0e6c8' });
        this.sound('nova');
        break;
      }
      case 'curse': {
        this.fx({ kind: 'curse', x: act.x, y: act.y, dur: 0.6, r: pr.radius });
        this.sound('nomana');
        for (const m of this.monstersNear(act.x, act.y, pr.radius!)) {
          m.curse = { t: pr.duration!, pct: pr.pct! };
          this.alertPack(m);
        }
        break;
      }
      case 'corpse': {
        const c = this.findCorpse(act.x, act.y, 2.5) ?? this.findCorpse(p.x, p.y, 10);
        if (!c) break;
        c.used = true;
        const amt = c.maxLife * roll(this.rng, pr.pct!, pr.pct2!) / 100;
        this.fx({ kind: 'explosion', x: c.x, y: c.y, dur: 0.5, r: pr.radius });
        this.fx({ kind: 'blood', x: c.x, y: c.y, dur: 0.6, color: '#8a1010' });
        this.emit({ type: 'shake', amount: 4 });
        this.sound('boom');
        for (const m of this.monstersNear(c.x, c.y, pr.radius!)) this.damageMonster(m, { phys: amt / 2, fire: amt / 2, cold: 0, light: 0, poison: 0 }, {});
        break;
      }
      case 'summon': {
        if (def.id === 'grave_golem') {
          for (const g of this.minions) if (g.ally === 'golem') g.dead = true;
          const at = isWalkable(this.area.level, act.x, act.y) && Math.hypot(act.x - p.x, act.y - p.y) < 8 ? { x: act.x, y: act.y } : { x: p.x + Math.cos(ang), y: p.y + Math.sin(ang) };
          this.raiseMinion('golem', at.x, at.y, pr);
        } else {
          const c = this.findCorpse(act.x, act.y, 2.5) ?? this.findCorpse(p.x, p.y, 10);
          if (!c) break;
          c.used = true;
          const skels = this.minions.filter((mi) => mi.ally === 'skeleton' && !mi.dead);
          // At the cap, the oldest skeleton crumbles to make room.
          if (skels.length >= pr.count!) skels[0].dead = true;
          this.raiseMinion('skeleton', c.x, c.y, pr);
        }
        this.minions = this.minions.filter((mi) => !mi.dead);
        this.sound('fire');
        break;
      }
      case 'construct': {
        const kind = CONSTRUCT_OF[def.id];
        const l = this.area.level;
        const ok = isWalkable(l, act.x, act.y) && Math.hypot(act.x - p.x, act.y - p.y) < 7 && lineOfSight(l, p, { x: act.x, y: act.y });
        const spot = ok ? { x: act.x, y: act.y } : nearestFloor(l, { x: p.x + Math.cos(ang) * 1.2, y: p.y + Math.sin(ang) * 1.2 });
        const at = ok ? spot : { x: spot.x + 0.5, y: spot.y + 0.5 };
        // At the cap, the oldest one is taken apart for the new one.
        const have = this.minions.filter((mi) => mi.ally === kind && !mi.dead);
        while (have.length >= (pr.count ?? 1)) this.scrapConstruct(have.shift()!);
        this.minions = this.minions.filter((mi) => !mi.dead);
        const mi = this.raiseMinion(kind, at.x, at.y, pr, synergyBonus(def, this.char.skills));
        mi.facing = ang;
        this.sound('block');
        break;
      }
      case 'anvil': {
        const wpr = this.withSynergy(def, pr);
        this.area.hazards.push({
          x: act.x, y: act.y, t: 0, delay: 0.65, dur: 0, radius: pr.radius!, dmg: this.weaponDamage(def, wpr).dmg, owner: 'player',
          burnDps: 0, srcLevel: this.char.level, fired: false, anvil: true, stun: pr.stun,
        });
        this.fx({ kind: 'anvil', x: act.x, y: act.y, dur: 0.65, r: pr.radius });
        this.sound('swing');
        break;
      }
      case 'vent': {
        // Slag Burst: everything the smith has been holding in, all at once.
        const k = Math.min(1, p.heat / HEAT_MAX);
        const r = pr.radius! + 2 * k;
        this.fx({ kind: 'explosion', x: p.x, y: p.y, dur: 0.55, r });
        this.fx({ kind: 'shout', x: p.x, y: p.y, dur: 0.45, r, color: '#ff8a30' });
        this.emit({ type: 'shake', amount: 3 + 6 * k });
        this.emit({ type: 'flash', color: '#ff7a20', a: 0.12 + 0.14 * k });
        this.sound('boom');
        for (const m of this.monstersNear(p.x, p.y, r)) {
          this.damageMonster(m, elemDamage('fire', roll(this.rng, pr.min!, pr.max!) * syn * k), { knock: { x: m.x - p.x, y: m.y - p.y, f: 0.6 } });
        }
        if (p.heat >= HEAT_SLAG) {
          this.area.hazards.push({
            x: p.x, y: p.y, t: 0, delay: 0, dur: pr.duration!, radius: r * 0.85, dmg: { ...ZERO_DAMAGE }, owner: 'player',
            burnDps: ((pr.min! + pr.max!) / 2) * syn * 0.3, srcLevel: this.char.level, fired: true, quiet: true,
          });
        }
        p.heat = 0;
        p.heatT = 0;
        p.overheat = false;
        if (p.buffs.white_heat) {
          delete p.buffs.white_heat;
          this.refreshStats();
        }
        break;
      }
      case 'bolts': {
        for (let i = 0; i < pr.count!; i++) {
          const a2 = ang + this.rng.range(-0.9, 0.9);
          this.spawnProjectile({
            x: p.x, y: p.y, ang: a2, speed: this.rng.range(4.5, 6.5), ttl: 1.6, owner: 'player', dmg: spellDmg(), kind: 'charged',
            radius: 0.3, wobble: true, srcLevel: this.char.level,
          });
        }
        this.sound('light');
        break;
      }
      case 'nova': {
        this.fx({ kind: el === 'cold' ? 'nova' : 'shout', x: p.x, y: p.y, dur: 0.45, r: pr.radius, color: el === 'cold' ? '#a8e8ff' : el === 'poison' ? '#8ad040' : '#f0d070' });
        this.sound(el === 'cold' ? 'nova' : 'roar');
        for (const m of this.monstersNear(p.x, p.y, pr.radius!)) {
          const syn2 = synergyBonus(def, this.char.skills);
          const d = elemDamage(el, roll(this.rng, pr.min!, pr.max!) * syn2);
          this.damageMonster(m, d, { chill: pr.chill, stun: pr.stun, knock: el === 'phys' ? { x: m.x - p.x, y: m.y - p.y, f: 0.8 } : undefined });
        }
        break;
      }
      case 'teleport': {
        const l = this.area.level;
        const d = Math.min(pr.range!, Math.hypot(act.x - p.x, act.y - p.y));
        let dest: Point | null = null;
        for (let s = d; s > 0.3; s -= 0.25) {
          const cx = p.x + Math.cos(ang) * s;
          const cy = p.y + Math.sin(ang) * s;
          if (isWalkable(l, cx, cy)) {
            dest = { x: cx, y: cy };
            break;
          }
        }
        if (dest) {
          this.fx({ kind: 'teleport', x: p.x, y: p.y, dur: 0.4 });
          p.x = dest.x;
          p.y = dest.y;
          this.fx({ kind: 'teleport', x: p.x, y: p.y, dur: 0.4 });
          this.sound('portal');
        }
        break;
      }
      case 'meteor': {
        const tgt = { x: act.x, y: act.y };
        this.area.hazards.push({
          x: tgt.x, y: tgt.y, t: 0, delay: 1.0, dur: pr.duration!, radius: pr.radius!, dmg: spellDmg(), owner: 'player',
          burnDps: ((pr.min! + pr.max!) / 2) * syn * 0.25, srcLevel: this.char.level, fired: false,
        });
        this.fx({ kind: 'meteor_mark', x: tgt.x, y: tgt.y, dur: 1.0, r: pr.radius });
        this.sound('fire');
        break;
      }
      case 'buff': {
        p.buffs[def.id] = { t: pr.duration!, p: pr };
        const col = def.id === 'frost_shell' ? '#bfefff' : def.id === 'bone_ward' ? '#e8dcc0' : def.id === 'white_heat' ? '#ffd8a0' : '#ffe080';
        this.fx({ kind: def.id === 'battle_shout' ? 'shout' : 'nova', x: p.x, y: p.y, dur: 0.6, r: 1.6, color: col });
        this.sound(def.id === 'battle_shout' ? 'roar' : def.id === 'bone_ward' ? 'swing' : def.id === 'white_heat' ? 'fire' : 'cold');
        if (def.id === 'white_heat') {
          p.heat = HEAT_MAX;
          p.overheat = false;
        }
        this.refreshStats();
        break;
      }
    }
  }

  private fireArrow(def: SkillDef, pr: SkillParams, ang: number) {
    const p = this.player;
    const st = this.stats;
    const d = this.weaponDamage(def, pr);
    let chains: Projectile['chains'];
    if (def.id === 'storm_arrow') chains = { n: pr.chains!, dmg: elemDamage('light', roll(this.rng, pr.min!, pr.max!)) };
    if (def.id === 'exploding_arrow') this.feedEmber(0.07);
    this.spawnProjectile({
      x: p.x, y: p.y, ang, speed: 15, ttl: 0.8, owner: 'player', dmg: d.dmg, kind: def.id === 'frost_arrow' ? 'frostarrow' : def.id === 'exploding_arrow' ? 'firearrow' : 'arrow',
      radius: 0.3, ar: st.ar * (1 + (pr.arPct ?? 0) / 100), pierce: def.id === 'power_shot', explode: def.id === 'exploding_arrow' ? pr.radius : undefined,
      chill: pr.chill, chains, srcLevel: this.char.level,
    });
  }

  /** Physical (with crits) plus elemental adds from gear and the skill. */
  private weaponDamage(def: SkillDef, pr: SkillParams): { dmg: Damage; crit: boolean } {
    const st = this.stats;
    const rng = this.rng;
    let phys = roll(rng, st.minDmg, st.maxDmg) * (1 + (pr.dmgPct ?? 0) / 100);
    const crit = rng.chance(st.crit / 100);
    if (crit) phys *= 2;
    const dmg: Damage = {
      phys,
      fire: roll(rng, st.fireMin, st.fireMax),
      cold: roll(rng, st.coldMin, st.coldMax),
      light: roll(rng, st.lightMin, st.lightMax),
      poison: st.poisonDmg,
    };
    if (def.id === 'frost_arrow') dmg.cold += roll(rng, pr.min!, pr.max!);
    if (def.id === 'exploding_arrow') dmg.fire += roll(rng, pr.min!, pr.max!);
    // Temper: a hot smith's blows burn.
    const heat = this.player.heat;
    if (heat > 0 && !st.isBow) {
      const tl = skillLevel(this.char, 'temper');
      if (tl) dmg.fire += (phys * SKILL_BY_ID.temper.params(tl).pct! * heat) / (100 * HEAT_MAX);
    }
    return { dmg, crit };
  }

  /** A weapon skill's numbers with its synergies folded into the damage bonus. */
  private withSynergy(def: SkillDef, pr: SkillParams): SkillParams {
    const syn = synergyBonus(def, this.char.skills);
    return syn === 1 ? pr : { ...pr, dmgPct: ((1 + (pr.dmgPct ?? 0) / 100) * syn - 1) * 100 };
  }

  // ---------------------------------------------------------------- heat

  /** Hammer blows that land build Heat. At the top of the gauge the smith overheats and starts to burn. */
  private gainHeat(n: number) {
    const p = this.player;
    if (this.char.classId !== 'forgewright' || p.buffs.white_heat) return;
    p.heatT = 0;
    p.heat = Math.min(HEAT_MAX, p.heat + n);
    if (p.heat >= HEAT_MAX && !p.overheat) this.boilOver();
  }

  private boilOver() {
    const p = this.player;
    p.overheat = true;
    p.heat = HEAT_MAX;
    p.heatT = 0;
    this.floatText(p.x, p.y, 'Overheated!', '#ff6a2a', 17);
    this.msg(skillLevel(this.char, 'slag_burst') ? 'Overheated! Vent with Slag Burst.' : 'Overheated! Stop swinging and cool off.', '#ff8a4a', 'overheat');
    this.sound('fire');
  }

  private updateHeat(dt: number) {
    const p = this.player;
    if (p.buffs.white_heat) {
      p.heat = HEAT_MAX;
      p.overheat = false;
      return;
    }
    if (!p.heat && !p.overheat) return;
    p.heatT += dt;
    // Heat holds while the hammer is busy, then bleeds away. Town is cool.
    if (this.inTown) p.heat = Math.max(0, p.heat - 40 * dt);
    else if (p.heatT > 1.2) p.heat = Math.max(0, p.heat - 8 * dt);
    if (!p.overheat) return;
    if (p.heat < HEAT_COOLED) return void (p.overheat = false);
    // Burning from the inside. Fire resistance only helps so much, and it never quite kills.
    const burn = this.stats.maxLife * 0.03 * (1 - Math.max(0, this.stats.res.fire) / 200) * dt;
    p.life = Math.max(1, p.life - burn);
    if (Math.floor((p.heatT - dt) * 2.5) !== Math.floor(p.heatT * 2.5)) {
      this.fx({ kind: 'burn', x: p.x + this.luck.range(-0.3, 0.3), y: p.y + this.luck.range(-0.3, 0.3), dur: 0.5 });
      p.hurt = Math.max(p.hurt, 0.12);
    }
  }

  private playerWeaponHit(m: Monster, def: SkillDef, pr: SkillParams, opts: { knock?: number; stun?: number }): boolean {
    const p = this.player;
    const { dmg, crit } = this.weaponDamage(def, pr);
    const hit = this.damageMonster(m, dmg, {
      ar: this.stats.ar * (1 + (pr.arPct ?? 0) / 100), crit, leech: true, stun: opts.stun,
      knock: opts.knock ? { x: m.x - p.x, y: m.y - p.y, f: opts.knock } : undefined,
    });
    if (hit) {
      this.sound('hit');
      // A burning blade keeps its wielder a little warmer.
      if (dmg.fire > 0) this.feedEmber(0.025);
      if (def.id === 'frenzy') {
        p.frenzy.stacks = Math.min(4, p.frenzy.stacks + 1);
        p.frenzy.t = pr.duration!;
        this.refreshStats();
      }
    } else {
      this.sound('miss');
    }
    return hit;
  }

  monstersNear(x: number, y: number, r: number): Monster[] {
    return this.area.monsters
      .filter((m) => !m.dead && !m.sub && Math.hypot(m.x - x, m.y - y) <= r + m.def.radius)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  }

  spawnProjectile(o: {
    x: number; y: number; ang: number; speed: number; ttl: number; owner: 'player' | 'monster'; dmg: Damage; kind: string;
    radius: number; ar?: number; pierce?: boolean; explode?: number; chill?: number; chains?: Projectile['chains']; wobble?: boolean;
    srcLevel: number; srcId?: number; sap?: number; servant?: Monster;
  }) {
    this.area.projectiles.push({
      id: this.id(), x: o.x + Math.cos(o.ang) * 0.3, y: o.y + Math.sin(o.ang) * 0.3, vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed,
      ttl: o.ttl, owner: o.owner, dmg: o.dmg, radius: o.radius, kind: o.kind, ar: o.ar, pierce: o.pierce, explode: o.explode,
      chill: o.chill, chains: o.chains, wobble: o.wobble, hit: new Set(), srcLevel: o.srcLevel, srcId: o.srcId, sap: o.sap, servant: o.servant,
    });
  }

  // ---------------------------------------------------------------- damage

  damageMonster(m: Monster, d: Damage, o: { ar?: number; chill?: number; stun?: number; knock?: { x: number; y: number; f: number }; crit?: boolean; leech?: boolean; minion?: Monster } = {}): boolean {
    if (m.dead || m.sub || m.invulnT) return false;
    if (m.wardId !== undefined) {
      if (this.area.monsters.some((o) => o.id === m.wardId && !o.dead)) {
        if (!o.minion) this.floatText(m.x, m.y, 'Warded', '#8ac8ff');
        return false;
      }
      m.wardId = undefined;
    }
    this.alertPack(m);
    if (o.ar !== undefined && !this.rng.chance(hitChance(o.ar, m.def_, o.minion?.level ?? this.char.level, m.level))) {
      if (!o.minion) this.floatText(m.x, m.y, 'Miss', '#9a9a9a');
      return false;
    }
    if (m.curse && m.curse.t > 0 && d.phys > 0) d = { ...d, phys: d.phys * (1 + m.curse.pct / 100) };
    if (m.sunder && m.sunder.t > 0 && d.phys > 0) d = { ...d, phys: d.phys * (1 + m.sunder.pct / 100) };
    // Struck by a servant: turn on it some of the time.
    if (o.minion && (m.foe === undefined || this.rng.chance(0.3))) m.foe = o.minion.id;
    let { total, poison } = applyResists(d, m.res);
    if (d.fire > 0 && m.res.fire < 100) m.burnT = 3;
    if (m.def.slag) {
      // Fire stokes a Slag Golem, cold tempers it. The blow lands on whatever it was a moment ago.
      const heat = m.heat ?? 0;
      if (heat >= SLAG_MOLTEN) total *= 0.85;
      if (heat <= SLAG_BRITTLE) total *= 1.6;
      if (d.fire > 0) m.heat = Math.min(1, heat + 0.4);
      else if (d.cold > 0) m.heat = Math.max(-1, heat - 0.55);
      if (heat < SLAG_MOLTEN && m.heat! >= SLAG_MOLTEN) this.floatText(m.x, m.y, 'Molten', '#ff9040', 16);
      if (heat > SLAG_BRITTLE && m.heat! <= SLAG_BRITTLE) this.floatText(m.x, m.y, 'Brittle', '#a8e0ff', 16);
    }
    if (poison > 0 && poison / 3 >= m.poison.dps * 0.9) m.poison = { dps: poison / 3, t: 3 };
    if (d.cold > 0 && m.res.cold < 100) m.chill = Math.max(m.chill, o.chill ?? 1.5);
    if (o.stun && m.rarity !== 'boss') m.stun = Math.max(m.stun, o.stun);
    if (o.knock && m.rarity !== 'boss' && m.def.ai !== 'totem') {
      const len = Math.hypot(o.knock.x, o.knock.y) || 1;
      m.knock = { x: (o.knock.x / len) * o.knock.f * 8, y: (o.knock.y / len) * o.knock.f * 8 };
    }
    let dealt = total;
    if (m.shield && dealt > 0) {
      const ab = Math.min(m.shield, dealt);
      m.shield -= ab;
      dealt -= ab;
      if (ab >= 1 && !o.minion) this.floatText(m.x, m.y, String(Math.round(ab)), '#ffd870');
    }
    m.life -= dealt;
    m.flash = 0.12;
    if (!o.minion) this.setFocus(m);
    if (total > 0) {
      this.fx({ kind: d.phys > 0 ? 'blood' : 'spark', x: m.x, y: m.y, dur: 0.35, color: elemColor(d) });
      if (o.crit) this.floatText(m.x, m.y, `${Math.round(total)}!`, '#ffd040', 21);
      else this.floatText(m.x, m.y, String(Math.round(total)), '#ffffff');
      // Heavy blows land with a brief freeze and a jolt.
      if (!o.minion && (o.crit || total > m.maxLife * 0.4)) {
        this.emit({ type: 'hitstop', t: o.crit ? 0.06 : 0.04 });
        this.emit({ type: 'shake', amount: o.crit ? 3 : 2 });
      }
    }
    // Hit recovery: big hits briefly interrupt.
    if (total > m.maxLife * 0.12 && m.rarity !== 'boss') {
      m.stun = Math.max(m.stun, 0.18);
      if (m.action && !m.action.done) m.action = null;
    }
    if (o.leech) {
      const p = this.player;
      p.life = Math.min(this.stats.maxLife, p.life + (total * this.stats.lifeSteal) / 100);
      p.mana = Math.min(this.stats.maxMana, p.mana + (total * this.stats.manaSteal) / 100);
    }
    if (m.thief && dealt > 0) this.shakeThief(m);
    if (m.mods.includes('lightEnch') && total > 0 && m.life > 0 && (m.sparkAt ?? 0) <= this.time) {
      // Lightning Enchanted: every blow shakes loose a ring of sparks.
      m.sparkAt = this.time + 1.1;
      const off = this.luck.range(0, TAU);
      for (let i = 0; i < 6; i++) {
        this.spawnProjectile({
          x: m.x, y: m.y, ang: off + (i / 6) * TAU, speed: 5.5, ttl: 0.9, owner: 'monster', dmg: elemDamage('light', (m.dmgMin + m.dmgMax) * 0.22),
          kind: 'm_light', radius: 0.26, srcLevel: m.level, srcId: m.id, wobble: true,
        });
      }
      this.sound('light');
    }
    if (m.life <= 0) this.killMonster(m, deathKindOf(d, m.res, -m.life > m.maxLife * 0.5));
    return true;
  }

  private alertPack(m: Monster) {
    if (m.alert) return;
    m.alert = true;
    for (const o of this.area.monsters) if (o.packId === m.packId && !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < 10) o.alert = true;
  }

  private killMonster(m: Monster, how: DeathKind = 'normal') {
    const a = this.area;
    if (m.illusion) return this.dispelIllusion(m);
    for (const o of a.monsters) if (o.illusion && o.ownerId === m.id && !o.dead) this.dispelIllusion(o);
    m.dead = true;
    m.life = 0;
    m.deadT = 0;
    m.action = null;
    m.deathKind = m.def.shape === 'wraith' || m.def.shape === 'bat' ? 'normal' : how;
    this.sound('death');
    this.deathEffect(m);
    this.countKill(m);
    // Kills made on a spree are worth more, rank by rank.
    const spree = 1 + 0.06 * (this.streak.tier + 1);
    const mult = xpMultiplier(m.level, this.char.level) * (1 + this.player.xpBonus / 100) * spree;
    const gained = addXp(this.char, m.xp * mult);
    if (gained) this.levelUp();
    const p = this.player;
    p.life = Math.min(this.stats.maxLife, p.life + this.stats.lifeOnKill);
    p.mana = Math.min(this.stats.maxMana, p.mana + this.stats.manaOnKill);
    const tier: DropTier = m.rarity === 'boss' ? 'boss' : m.rarity === 'unique' ? 'unique' : m.rarity === 'champion' ? 'champion' : 'normal';
    if (!m.summoned) this.spawnDrops(m.x, m.y, m.level, tier);
    if (!m.summoned) this.dropOrbs(m);
    if (m.thief) this.jackpot(m);
    if (m.ambush !== undefined) this.ambushKill(m.ambush);
    if (m.warden) this.wardenSlain(m);
    if (m.mods.includes('fireEnch')) {
      this.fx({ kind: 'explosion', x: m.x, y: m.y, dur: 0.5, r: 2 });
      this.sound('boom');
      if (Math.hypot(p.x - m.x, p.y - m.y) < 2.2) this.damagePlayer(elemDamage('fire', (m.dmgMin + m.dmgMax) * 0.8), { level: m.level });
    }
    if (m.def.burst && !(m.def.rime && how === 'burn')) {
      // A Rime-Thrall bursts into ice that chills and saps the ember, unless fire killed it: then it only melts.
      const rime = !!m.def.rime;
      const dmg = (m.dmgMin + m.dmgMax) * 0.35;
      for (let i = 0; i < m.def.burst; i++) {
        this.spawnProjectile({
          x: m.x, y: m.y, ang: (i / m.def.burst) * TAU + m.facing, speed: 7, ttl: 0.8, owner: 'monster', dmg: elemDamage(rime ? 'cold' : 'phys', dmg),
          kind: rime ? 'm_ice' : 'm_glass', radius: 0.22, srcLevel: m.level, srcId: m.id, sap: rime ? 0.08 : undefined,
        });
      }
      this.sound('cold');
    }
    // The dead give up a little heat, and the burning dead a good deal more.
    if (a.def.cold && !m.illusion) this.feedEmber(how === 'burn' || (m.burnT ?? 0) > 0 ? 0.09 : 0.02);
    if (m.def.id === 'phylactery') {
      for (const o of a.monsters) {
        if (o.wardId !== m.id || o.dead) continue;
        o.wardId = undefined;
        o.stun = 2.5;
        this.msg('The phylactery shatters. The echo falters!', '#8ac8ff');
      }
      a.rings.length = 0;
    }
    if (m.def.rises && !m.rose && !m.summoned && m.deathKind !== 'burn') {
      this.addTimer(3.5, () => {
        if (this.area !== a || !m.dead || m.used) return;
        m.rose = true;
        m.xp = 0;
        m.summoned = true;
        this.reviveMonster(m, 0.5);
      });
    }
    if (m.def.flees || m.def.id === 'imp') {
      // Imps lose their nerve when a packmate falls.
      for (const o of a.monsters) if (!o.dead && o.def.flees && Math.hypot(o.x - m.x, o.y - m.y) < 6 && this.rng.chance(0.7)) o.fleeT = this.rng.range(1.5, 3);
    }
    if (m.superId && a.def.quest && ['bishop', 'mother', 'skarn', 'karrik', 'embalmer', 'corvin', 'frostwright', 'echo', 'unlit'].includes(m.superId)) {
      if (this.questState(a.def.quest) !== 'rewarded' && this.questState(a.def.quest) !== 'done') {
        this.setQuest(a.def.quest, 'done');
        this.msg(`${m.name} has been slain!`, '#e8c860');
        this.sound('quest');
        if (m.superId === 'mother') this.tellOnce('forge_end');
        if (m.superId === 'embalmer') this.tellOnce('vizier');
        if (m.superId === 'corvin') this.tellOnce('finale');
        if (m.superId === 'frostwright') this.tellOnce('frostwright');
        if (m.superId === 'unlit') {
          // The ember is home: the Heart is warm again, and the next difficulty opens.
          this.ember = 1;
          this.frost = 0;
          for (const o of a.objects) if (o.kind === 'brazier') o.used = true;
          this.char.maxDifficulty = Math.max(this.char.maxDifficulty, Math.min(2, this.char.difficulty + 1));
          this.msg('You have earned a respec: see the Character or Skills panel', '#e8c860');
          this.emit({ type: 'victory' });
        }
      }
    }
    if (a.def.quest === 'hollow' && this.questState('hollow') === 'active' && a.monsters.every((x) => x.dead)) {
      this.setQuest('hollow', 'done');
      this.msg('The Hollow Cave has been cleansed! Return to Old Corvin.', '#e8c860');
      this.sound('quest');
    }
    this.checkPurge();
  }

  /** An Underforge floor's warden is dead: the stairs open, the Forge is paid, and the record is kept. */
  private wardenSlain(m: Monster) {
    const a = this.area;
    const depth = a.def.depth;
    if (!depth) return;
    const c = this.char;
    const cinders = depthCinders(depth);
    c.forge.cinders += cinders;
    if (m.rarity !== 'boss') this.spawnDrops(m.x, m.y, m.level, 'unique');
    const best = (c.deepest ??= []);
    const record = depth > (best[c.difficulty] ?? 0);
    if (record) best[c.difficulty] = depth;
    const start = record && depth % DEPTH_STRIDE === 0;
    this.emit({
      type: 'announce', text: `Depth ${depth} cleared`, color: '#ffb060',
      sub: `The stairs are open · +${cinders} Cinders${start ? ` · You can now start from Depth ${depth + 1}` : record ? ' · A new record' : ''}`,
    });
    this.sound('quest');
    this.emit({ type: 'quest', id: 'depths' });
  }

  /** The burst a monster dies in, by how it died, plus a jolt for elites and bosses. */
  private deathEffect(m: Monster) {
    const at = { x: m.x, y: m.y };
    switch (m.deathKind) {
      case 'shatter':
        this.fx({ kind: 'shatter', ...at, dur: 0.7, r: m.def.scale });
        this.sound('cold');
        break;
      case 'burn':
        this.fx({ kind: 'cinders', ...at, dur: 1.4, r: m.def.scale });
        break;
      case 'shock':
        this.fx({ kind: 'zap', ...at, dur: 0.45, r: m.def.scale });
        break;
      case 'gib':
        this.fx({ kind: 'gore', ...at, dur: 0.8, r: m.def.scale });
        break;
    }
    if (m.rarity === 'boss') {
      this.emit({ type: 'hitstop', t: 0.35 });
      this.emit({ type: 'shake', amount: 14 });
      this.emit({ type: 'flash', color: '#ffffff', a: 0.45 });
    } else if (m.rarity === 'unique' || m.rarity === 'champion') {
      this.emit({ type: 'hitstop', t: 0.07 });
      this.emit({ type: 'shake', amount: 4 });
    }
  }

  private levelUp() {
    this.refreshStats();
    const p = this.player;
    p.life = this.stats.maxLife;
    p.mana = this.stats.maxMana;
    this.fx({ kind: 'levelup', x: p.x, y: p.y, dur: 1.4 });
    this.sound('levelup');
    this.emit({ type: 'levelup', level: this.char.level });
    this.msg(`You have reached level ${this.char.level}!`, '#e8c860');
  }

  /** Returns whether the blow landed (it was not dodged, missed, evaded or blocked). */
  damagePlayer(d: Damage, o: { ar?: number; level: number; melee?: boolean; source?: Monster; missile?: boolean }): boolean {
    const p = this.player;
    if (p.dead || p.invuln > 0) return false;
    const st = this.stats;
    if (o.ar !== undefined && !this.rng.chance(hitChance(o.ar, st.def, o.level, this.char.level))) return false;
    if ((o.melee || o.missile) && st.evade > 0 && this.rng.chance(st.evade / 100)) {
      this.floatText(p.x, p.y, 'Evade', '#9bd39b');
      return false;
    }
    if (o.ar !== undefined && st.block > 0 && this.rng.chance(st.block / 100)) {
      this.floatText(p.x, p.y, 'Block', '#d8d8d8');
      this.sound('block');
      return false;
    }
    const res: Resists = { phys: 0, fire: st.res.fire, cold: st.res.cold, light: st.res.light, poison: st.res.poison };
    const dd = { ...d, phys: d.phys > 0 ? reducePhysical(d.phys, st.dmgReduce) : 0 };
    let { total, poison } = applyResists(dd, res);
    const ward = p.buffs.bone_ward;
    if (ward && total > 0) {
      const ab = Math.min(total, ward.p.min ?? 0);
      ward.p.min = (ward.p.min ?? 0) - ab;
      total -= ab;
      poison *= 0.5;
      if (ward.p.min <= 0) delete p.buffs.bone_ward;
      if (ab >= 1) this.floatText(p.x, p.y, String(Math.round(ab)), '#d8ccb0');
    }
    if (poison > 0) p.poison = { dps: poison / 4, t: 4 };
    if (d.cold > 0) p.chill = 1.5;
    p.life -= total;
    p.hurt = 0.25;
    if (total >= 1) this.floatText(p.x, p.y, String(Math.round(total)), '#ff5050');
    if (total > st.maxLife * 0.08) this.sound('hurt');
    if (total > st.maxLife * 0.2) {
      this.emit({ type: 'hitstop', t: 0.05 });
      this.emit({ type: 'shake', amount: 5 });
    }
    const src = o.source;
    if (src && o.melee) {
      if (st.thorns > 0) this.damageMonster(src, { phys: st.thorns, fire: 0, cold: 0, light: 0, poison: 0 });
      if (p.buffs.frost_shell) src.chill = Math.max(src.chill, 2);
      if (src.mods.includes('vampiric')) src.life = Math.min(src.maxLife, src.life + total * 0.5);
      if (src.mods.includes('coldEnch')) p.chill = 2;
    }
    if (p.life <= 0) this.die();
    return true;
  }

  private die() {
    const p = this.player;
    p.life = 0;
    p.dead = true;
    p.action = null;
    p.intent = null;
    p.path = [];
    this.minions = [];
    this.endSpree(true);
    this.sound('death');
    this.emit({ type: 'death' });
    if (this.char.hardcore) this.char.dead = true;
  }

  /** Spends a respec (see character.ts). Servants and standing spells made with the old skills go with them. */
  respec(): boolean {
    if (this.player.dead || !respec(this.char)) return false;
    const p = this.player;
    this.minions = [];
    p.buffs = Object.fromEntries(Object.entries(p.buffs).filter(([k]) => k.startsWith('shrine_')));
    p.frenzy = { stacks: 0, t: 0 };
    p.heat = 0;
    p.overheat = false;
    p.action = null;
    p.intent = null;
    this.refreshStats();
    this.sound('quest');
    this.msg('Your skills and attributes are yours to place again', '#e8c860');
    return true;
  }

  /** Softcore respawn: lose some gold (and experience on higher difficulties), wake in town. */
  respawn() {
    const c = this.char;
    const p = this.player;
    const lost = Math.floor(c.gold * 0.2);
    c.gold -= lost;
    if (c.difficulty > 0) {
      const floor = xpForLevel(c.level);
      const span = xpForLevel(c.level + 1) - floor;
      c.xp = Math.max(floor, c.xp - Math.floor(span * 0.05 * c.difficulty));
    }
    p.dead = false;
    p.buffs = {};
    this.ember = 1;
    this.frost = 0;
    p.frenzy = { stacks: 0, t: 0 };
    p.heat = 0;
    p.overheat = false;
    p.poison.t = 0;
    p.heal = [];
    this.refreshStats();
    p.life = this.stats.maxLife;
    p.mana = this.stats.maxMana;
    this.enterArea(this.homeTown, 'start');
    if (lost) this.msg(`You lost ${lost} gold`, '#ff8a6a');
  }

  // ---------------------------------------------------------------- objects

  private useObject(o: WorldObject) {
    if (o.kind === 'brazier') return this.lightBrazier(o);
    o.used = true;
    const p = this.player;
    const mlvl = this.mlvl(this.area.def);
    if (o.kind === 'shrine') {
      const k = o.shrine!;
      this.sound('shrine');
      this.fx({ kind: 'shrine', x: o.x, y: o.y, dur: 1 });
      this.msg(`${SHRINE_NAMES[k]}: ${SHRINE_TEXT[k]}`, k === 'cursed' ? '#d080ff' : '#9fd8ff');
      if (k === 'cursed') {
        this.startAmbush(o);
      } else if (k === 'refill') {
        p.life = this.stats.maxLife;
        p.mana = this.stats.maxMana;
      } else {
        p.buffs[`shrine_${k}`] = { t: SHRINE_TIME[k] ?? 90, p: {} };
        if (k === 'experience') p.xpBonus = 50;
        this.refreshStats();
      }
      return;
    }
    if (o.kind === 'barrel' && this.rng.chance(0.12)) {
      this.fx({ kind: 'explosion', x: o.x, y: o.y, dur: 0.5, r: 2.2 });
      this.sound('boom');
      this.emit({ type: 'shake', amount: 5 });
      if (Math.hypot(p.x - o.x, p.y - o.y) < 2.4) this.damagePlayer(elemDamage('fire', 3 + mlvl * 2), { level: mlvl });
      for (const m of this.monstersNear(o.x, o.y, 2.4)) this.damageMonster(m, elemDamage('fire', 6 + mlvl * 3));
      return;
    }
    this.sound('chest');
    this.spawnDrops(o.x, o.y, mlvl, o.kind === 'chest' ? 'chest' : 'barrel');
  }

  // ---------------------------------------------------------------- monsters

  private updateMonsters(dt: number) {
    const a = this.area;
    const p = this.player;
    const l = a.level;
    const safe = this.inTown || p.dead;
    for (const m of a.monsters) {
      if (m.dead) {
        m.deadT += dt;
        continue;
      }
      if (m.flash > 0) m.flash -= dt;
      if (m.curse && m.curse.t > 0) m.curse.t -= dt;
      if (m.sunder && m.sunder.t > 0) m.sunder.t -= dt;
      if (m.shieldT && (m.shieldT -= dt) <= 0) m.shield = m.shieldT = 0;
      if (m.invulnT && (m.invulnT -= dt) <= 0) m.invulnT = 0;
      if (m.burnT && (m.burnT -= dt) <= 0) m.burnT = 0;
      if (m.drainT && (m.drainT -= dt) <= 0) m.drainT = 0;
      if (Math.abs(m.x - p.x) > 32 || Math.abs(m.y - p.y) > 32) continue;
      if (m.poison.t > 0) {
        m.poison.t -= dt;
        m.life -= m.poison.dps * dt;
        if (m.life <= 0) {
          this.killMonster(m, 'melt');
          continue;
        }
      }
      if (m.knock.x || m.knock.y) {
        this.moveEntity(m, m.knock.x * dt, m.knock.y * dt, m.def.radius);
        m.knock.x *= Math.pow(0.02, dt);
        m.knock.y *= Math.pow(0.02, dt);
        if (Math.hypot(m.knock.x, m.knock.y) < 0.3) m.knock = { x: 0, y: 0 };
      }
      if (m.chill > 0) m.chill -= dt;
      if (m.def.slag) this.temper(m, dt);
      if (m.stun > 0) {
        m.stun -= dt;
        continue;
      }
      const slow = m.chill > 0 ? 0.5 : 1;
      m.atkCd -= dt * slow;
      m.abilityCd -= dt * slow;
      if (m.fleeT > 0) m.fleeT -= dt;
      // Fight the player or a servant, whichever is clearly closer (or already engaged).
      const dp = Math.hypot(p.x - m.x, p.y - m.y);
      const foe = safe ? undefined : this.monsterFoe(m, dp);
      const tgt = foe ?? p;
      const dx = tgt.x - m.x;
      const dy = tgt.y - m.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (!m.alert && !safe) {
        // Monsters can't see far through a sandstorm either.
        const aggro = (foe ? 5 : m.rarity === 'boss' ? 9 : 7.5) * (1 - 0.4 * this.storm);
        if (d < aggro && lineOfSight(l, m, tgt)) {
          this.alertPack(m);
          if (m.rarity === 'boss') this.sound('roar');
        }
      }
      if (m.superId === 'corvin' && m.alert) this.tellOnce('corvin');
      if (m.superId === 'echo' && m.alert) this.tellOnce('echo');
      if (m.superId === 'unlit' && m.alert) {
        this.tellOnce('unlit');
        // The winter feeds while the ember is out.
        if (this.cold && this.ember <= 0 && !safe && m.life < m.maxLife) m.life = Math.min(m.maxLife, m.life + m.maxLife * 0.012 * dt);
      }
      if (m.invulnT) continue;
      if (m.thief) {
        if (m.alert && !safe) this.updateThief(m, dt);
        else this.wander(m, dt);
        continue;
      }
      if (m.def.phases && !m.illusion && this.advancePhase(m)) continue;
      if (m.def.ai === 'totem') {
        // A phylactery cannot move or strike. It rings.
        if (m.action) this.updateMonsterAction(m, dt * slow);
        else if (m.alert && !safe && m.abilityCd <= 0 && dp < 13) this.startToll(m);
        continue;
      }
      if (m.sub) {
        this.updateBurrow(m, dt, tgt);
        continue;
      }
      if (m.action) {
        this.updateMonsterAction(m, dt * slow);
        continue;
      }
      if (m.charge) {
        this.updateCharge(m, dt);
        continue;
      }
      if (!m.alert || safe) {
        this.wander(m, dt);
        continue;
      }
      const temper = m.def.slag ? ((m.heat ?? 0) >= SLAG_MOLTEN ? 1.35 : (m.heat ?? 0) <= SLAG_BRITTLE ? 0.7 : 1) : 1;
      const speed = m.speed * slow * temper * (m.def.ai !== 'bat' && this.inQuicksand(m) ? 0.6 : 1);
      if (m.def.mirage && !m.split && !m.illusion) {
        m.split = true;
        this.spawnIllusions(m, 2);
      }
      if (m.def.ai === 'burrow' && m.abilityCd <= 0 && d < 9) {
        m.sub = 1.8;
        m.abilityCd = this.rng.range(5, 7);
        continue;
      }
      if (m.mods.length && this.eliteTricks(m, tgt, d)) continue;
      if (m.def.support && m.abilityCd <= 0 && this.wardAlly(m)) continue;
      if (m.def.feeds && m.abilityCd <= 0 && this.feedOnCorpse(m, dt, speed)) continue;
      if (m.def.slam && m.abilityCd <= 0 && d < 4.5 && !m.illusion) {
        this.slam(m, tgt);
        continue;
      }
      if (m.def.tolls && m.abilityCd <= 0 && dp < 6 && !m.illusion && lineOfSight(l, m, p)) {
        this.startToll(m);
        continue;
      }
      if (m.def.ai === 'eater' && this.drinkEmber(m, dt, speed, dp)) continue;
      if (m.fleeT > 0) {
        this.moveEntity(m, (-dx / d) * speed * dt, (-dy / d) * speed * dt, m.def.radius);
        m.facing = Math.atan2(-dy, -dx);
        m.walk += dt * speed;
        continue;
      }
      if (m.def.ai === 'boss' && !m.illusion && m.abilityCd <= 0 && dp < 11 && lineOfSight(l, m, p)) {
        this.bossAbility(m, dp);
        continue;
      }
      const reach = m.def.radius + 0.3 + meleeRange(m);
      const ranged = m.def.ai === 'ranged' || m.def.ai === 'caster' || m.def.ai === 'hexer' || (m.def.ai === 'boss' && !!m.def.missile && d > 2.5);
      const los = d < 14 && lineOfSight(l, m, tgt);
      if (m.def.ai === 'hexer' && m.abilityCd <= 0 && this.tryRevive(m)) continue;
      if (ranged && los && d <= m.def.range + 1) {
        if (d < 3 && m.def.ai !== 'boss') {
          // Keep some distance from the player.
          this.moveEntity(m, (-dx / d) * speed * 0.8 * dt, (-dy / d) * speed * 0.8 * dt, m.def.radius);
          m.walk += dt * speed;
          m.facing = Math.atan2(dy, dx);
          if (m.atkCd > 0) continue;
        }
        if (m.atkCd <= 0) {
          m.facing = Math.atan2(dy, dx);
          m.action = { t: 0, hitAt: 0.35, dur: 0.6, done: false, kind: m.def.ai === 'caster' ? 'cast' : 'shoot' };
          m.atkCd = 1 / m.def.attackRate + this.rng.range(0, 0.4);
        }
        continue;
      }
      if (d <= reach) {
        m.facing = Math.atan2(dy, dx);
        if (m.atkCd <= 0) {
          m.action = { t: 0, hitAt: 0.3, dur: 0.55, done: false, kind: 'melee' };
          m.atkCd = 1 / m.def.attackRate;
        }
        continue;
      }
      // Chase: straight line when visible and close, else follow the flow field.
      let tx = tgt.x;
      let ty = tgt.y;
      if (m.def.ai === 'bat') {
        const wob = Math.sin(this.time * 6 + m.id) * 1.5;
        tx += (-dy / d) * wob;
        ty += (dx / d) * wob;
      }
      if (!(los && d < 6)) {
        const n = a.flow.next(m.x, m.y);
        if (n) (tx = n.x), (ty = n.y);
        else if (!los) {
          this.wander(m, dt);
          continue;
        }
      }
      const mx = tx - m.x;
      const my = ty - m.y;
      const ml = Math.hypot(mx, my) || 1;
      this.moveEntity(m, (mx / ml) * speed * dt, (my / ml) * speed * dt, m.def.radius);
      m.facing = Math.atan2(my, mx);
      m.walk += dt * speed;
    }
    this.separate(this.minions.length ? [...a.monsters, ...this.minions] : a.monsters);
    a.monsters = a.monsters.filter((m) => !m.dead || m.deadT < 40);
  }

  /** The servant a monster should fight instead of the player, if any. */
  private monsterFoe(m: Monster, dp: number): Monster | undefined {
    if (!this.minions.length) return undefined;
    const cur = m.foe !== undefined ? this.minions.find((mi) => mi.id === m.foe && !mi.dead) : undefined;
    if (cur && Math.hypot(cur.x - m.x, cur.y - m.y) < Math.min(8, dp + 3)) return cur;
    let best: Monster | undefined;
    let bd = Math.min(8, dp - 0.75);
    for (const mi of this.minions) {
      if (mi.dead) continue;
      const d = Math.hypot(mi.x - m.x, mi.y - m.y) * (mi.ally === 'golem' || mi.ally === 'sentinel' ? 0.6 : mi.ally === 'furnace' ? 1.3 : 1);
      if (d < bd) (bd = d), (best = mi);
    }
    m.foe = best?.id;
    return best;
  }

  private wander(m: Monster, dt: number) {
    m.wanderT -= dt;
    if (m.wanderT <= 0) {
      m.wanderT = this.rng.range(2, 5);
      const tx = m.homeX + this.rng.range(-3, 3);
      const ty = m.homeY + this.rng.range(-3, 3);
      m.wanderTo = isWalkable(this.area.level, tx, ty) ? { x: tx, y: ty } : null;
    }
    if (m.wanderTo) {
      const dx = m.wanderTo.x - m.x;
      const dy = m.wanderTo.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.2) return void (m.wanderTo = null);
      const sp = m.speed * 0.35;
      if (!this.moveEntity(m, (dx / d) * sp * dt, (dy / d) * sp * dt, m.def.radius)) m.wanderTo = null;
      m.facing = Math.atan2(dy, dx);
      m.walk += dt * sp;
    }
  }

  private separate(ms: Monster[]) {
    const p = this.player;
    const live = ms.filter((m) => !m.dead && Math.abs(m.x - p.x) < 20 && Math.abs(m.y - p.y) < 20);
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.def.radius + b.def.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        // Whatever is bolted down stays put, and the other one gives all the way.
        if (!a.fixed) this.moveEntity(a, -ux * push * (b.fixed ? 2 : 1), -uy * push * (b.fixed ? 2 : 1), a.def.radius);
        if (!b.fixed) this.moveEntity(b, ux * push * (a.fixed ? 2 : 1), uy * push * (a.fixed ? 2 : 1), b.def.radius);
      }
      if (a.fixed) continue;
      // Monsters do not stand inside the player.
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const min = a.def.radius + 0.3;
      const d = Math.hypot(dx, dy);
      if (d < min && d > 0 && !p.dead) this.moveEntity(a, (dx / d) * (min - d), (dy / d) * (min - d), a.def.radius);
    }
  }

  private updateMonsterAction(m: Monster, dt: number) {
    const act = m.action!;
    const p = this.player;
    act.t += dt;
    if (act.kind === 'toll') {
      if (!act.done && act.t >= act.hitAt) {
        act.done = true;
        this.ringBell(m);
      }
      if (act.t >= act.dur) m.action = null;
      return;
    }
    if (!act.done && act.t >= act.hitAt && m.illusion) act.done = true;
    if (!act.done && act.t >= act.hitAt) {
      act.done = true;
      const foe = m.foe !== undefined ? this.minions.find((mi) => mi.id === m.foe && !mi.dead) : undefined;
      const reach = m.def.radius + 0.3 + meleeRange(m) + 0.5;
      if (act.kind === 'melee' && foe && Math.hypot(foe.x - m.x, foe.y - m.y) <= reach + foe.def.radius) {
        const dmg = elemDamage(m.def.element ?? 'phys', roll(this.rng, m.dmgMin, m.dmgMax));
        if (m.mods.includes('fireEnch')) dmg.fire += (m.dmgMin + m.dmgMax) * 0.4;
        this.damageMinion(foe, dmg, { ar: m.ar, level: m.level });
      } else if (act.kind === 'melee') {
        if (Math.hypot(p.x - m.x, p.y - m.y) <= reach) {
          const molten = m.def.slag && (m.heat ?? 0) >= SLAG_MOLTEN ? 1.5 : 1;
          const dmg = elemDamage(m.def.element ?? 'phys', roll(this.rng, m.dmgMin, m.dmgMax) * molten);
          if (m.def.element && m.def.element !== 'phys') {
            dmg.phys = dmg[m.def.element] * 0.5;
            dmg[m.def.element] *= 0.5;
          }
          if (m.mods.includes('fireEnch')) dmg.fire += (m.dmgMin + m.dmgMax) * 0.4;
          if (m.mods.includes('coldEnch')) dmg.cold += (m.dmgMin + m.dmgMax) * 0.3;
          this.damagePlayer(dmg, { ar: m.ar, level: m.level, melee: true, source: m });
        }
      } else {
        const ms = m.def.missile!;
        const aim = foe ?? p;
        const ang = Math.atan2(aim.y - m.y, aim.x - m.x) + this.rng.range(-0.06, 0.06);
        const dmg = elemDamage(ms.element, roll(this.rng, m.dmgMin, m.dmgMax));
        this.spawnProjectile({
          x: m.x, y: m.y, ang, speed: ms.speed, ttl: 1.6, owner: 'monster', dmg, kind: ms.kind, radius: 0.3,
          ar: ms.element === 'phys' ? m.ar : undefined, srcLevel: m.level, srcId: m.id,
        });
        if (ms.element === 'phys') this.sound('bow');
      }
    }
    if (act.t >= act.dur) m.action = null;
  }

  private tryRevive(m: Monster): boolean {
    const corpse = this.area.monsters.find((o) => o.dead && !o.used && o.def.id === 'imp' && o.revived < 2 && o.deadT > 1.5 && o.deadT < 30 && Math.hypot(o.x - m.x, o.y - m.y) < 7);
    if (!corpse) return false;
    m.abilityCd = 5;
    corpse.dead = false;
    corpse.life = corpse.maxLife;
    corpse.revived++;
    corpse.alert = true;
    corpse.summoned = true;
    corpse.xp = Math.floor(corpse.xp / 2);
    this.fx({ kind: 'revive', x: corpse.x, y: corpse.y, dur: 0.7 });
    this.sound('fire');
    return true;
  }

  private bossAbility(m: Monster, d: number) {
    const abilities = m.abilities ?? m.def.abilities ?? [];
    const pick = this.rng.pick(abilities);
    const p = this.player;
    m.abilityCd = this.rng.range(4, 7);
    const dmg = (el: Element, k = 1) => elemDamage(el, roll(this.rng, m.dmgMin, m.dmgMax) * k);
    // Telegraph the big moves with a flash in their colour.
    const flash = ({
      nova_fire: '#ff6020', nova_cold: '#60b0ff', fire_spread: '#ff8030', meteor_rain: '#ff3010', summon_imps: '#b040ff', summon_skeletons: '#b040ff', charge: '',
      poison_spray: '#70c030', summon_scarabs: '#40b0a0', burrow_strike: '', summon_kites: '#806050', corpse_feast: '#a02020', sun_lance: '#ffc040',
      summon_mummies: '#d8c890', raise_dead: '#d8c890', mirage_split: '#ffe0a0', summon_acolytes: '#ffc040', noon_burst: '#fff0c0',
      ice_lance: '#80c8ff', summon_thralls: '#80c8ff', summon_eaters: '#6040a0', cold_snap: '#d8f0ff', snuff: '#101828', frost_rain: '#80c8ff', toll: '#c8a860',
    } satisfies Record<BossAbility, string>)[pick];
    if (flash) this.emit({ type: 'flash', color: flash, a: 0.22 });
    switch (pick) {
      case 'nova_fire':
      case 'nova_cold': {
        const el = pick === 'nova_fire' ? 'fire' : 'cold';
        for (let i = 0; i < 18; i++) {
          this.spawnProjectile({
            x: m.x, y: m.y, ang: (i / 18) * TAU, speed: 6, ttl: 1.5, owner: 'monster', dmg: dmg(el, 0.6),
            kind: el === 'fire' ? 'm_fire' : 'm_cold', radius: 0.3, srcLevel: m.level, srcId: m.id,
          });
        }
        this.sound('nova');
        break;
      }
      case 'fire_spread': {
        const base = Math.atan2(p.y - m.y, p.x - m.x);
        for (let i = -2; i <= 2; i++) {
          this.spawnProjectile({
            x: m.x, y: m.y, ang: base + i * 0.22, speed: 8, ttl: 1.6, owner: 'monster', dmg: dmg('fire', 0.8), kind: 'm_fireball',
            radius: 0.4, explode: 1.4, srcLevel: m.level, srcId: m.id,
          });
        }
        this.sound('fire');
        break;
      }
      case 'summon_imps':
      case 'summon_skeletons':
      case 'summon_scarabs':
      case 'summon_kites':
      case 'summon_mummies':
      case 'summon_acolytes':
      case 'summon_thralls':
      case 'summon_eaters': {
        const kind = {
          summon_imps: 'imp', summon_skeletons: 'skeleton', summon_scarabs: 'scarab', summon_kites: 'kite', summon_mummies: 'mummy', summon_acolytes: 'acolyte',
          summon_thralls: 'rime_thrall', summon_eaters: 'hearth_eater',
        }[pick];
        const alive = this.area.monsters.filter((o) => !o.dead && o.summoned && !o.def.abilities).length;
        if (alive >= 8) {
          m.abilityCd = 1;
          break;
        }
        for (let i = 0; i < (pick === 'summon_eaters' ? 2 : 3); i++) {
          const s = nearestFloor(this.area.level, { x: m.x + this.rng.range(-2, 2), y: m.y + this.rng.range(-2, 2) });
          const sm = this.spawnMonster(this.area, kind, s.x + 0.5, s.y + 0.5, 'normal', { packId: m.packId, level: m.level - 1 });
          sm.alert = true;
          sm.summoned = true;
          this.fx({ kind: 'revive', x: sm.x, y: sm.y, dur: 0.7 });
        }
        this.sound('roar');
        break;
      }
      case 'charge': {
        if (d < 2.5 || d > 9) {
          m.abilityCd = 1;
          break;
        }
        m.charge = { dx: (p.x - m.x) / d, dy: (p.y - m.y) / d, t: Math.min(1, d / (m.speed * 3.2)), hit: false };
        this.sound('roar');
        break;
      }
      case 'poison_spray': {
        const base = Math.atan2(p.y - m.y, p.x - m.x);
        for (let i = -3; i <= 3; i++) {
          this.spawnProjectile({ x: m.x, y: m.y, ang: base + i * 0.17, speed: 7.5, ttl: 1.5, owner: 'monster', dmg: dmg('poison', 0.8), kind: 'm_poison', radius: 0.3, srcLevel: m.level, srcId: m.id });
        }
        this.sound('cold');
        break;
      }
      case 'burrow_strike':
        m.sub = 1.5;
        m.subStrike = true;
        m.abilityCd = this.rng.range(6, 9);
        break;
      case 'corpse_feast': {
        const corpses = this.area.monsters.filter((o) => o.dead && !o.used && !o.illusion && Math.hypot(o.x - m.x, o.y - m.y) < 10).slice(0, 8);
        if (!corpses.length) {
          m.abilityCd = 1;
          break;
        }
        for (const o of corpses) {
          o.used = true;
          this.fx({ kind: 'gore', x: o.x, y: o.y, dur: 0.6 });
        }
        m.life = Math.min(m.maxLife, m.life + m.maxLife * 0.05 * corpses.length);
        this.floatText(m.x, m.y, 'Feasts', '#d04040', 18);
        this.sound('roar');
        break;
      }
      case 'sun_lance': {
        const ang = Math.atan2(p.y - m.y, p.x - m.x);
        for (let i = 1; i <= 8; i++) {
          const x = m.x + Math.cos(ang) * i * 1.2;
          const y = m.y + Math.sin(ang) * i * 1.2;
          if (!isWalkable(this.area.level, x, y)) break;
          const delay = 0.75 + i * 0.05;
          this.area.hazards.push({ x, y, t: 0, delay, dur: 0.05, radius: 1, dmg: dmg('fire', 0.5), owner: 'monster', burnDps: 0, srcLevel: m.level, fired: false, quiet: true });
          this.fx({ kind: 'meteor_mark', x, y, dur: delay, r: 1 });
        }
        this.sound('fire');
        break;
      }
      case 'ice_lance': {
        const ang = Math.atan2(p.y - m.y, p.x - m.x);
        for (let i = 1; i <= 9; i++) {
          const x = m.x + Math.cos(ang) * i * 1.2;
          const y = m.y + Math.sin(ang) * i * 1.2;
          if (!isWalkable(this.area.level, x, y)) break;
          const delay = 0.75 + i * 0.05;
          this.area.hazards.push({ x, y, t: 0, delay, dur: 0.05, radius: 1, dmg: dmg('cold', 0.55), owner: 'monster', burnDps: 0, srcLevel: m.level, fired: false, quiet: true, cold: true });
          this.fx({ kind: 'frost_mark', x, y, dur: delay, r: 1 });
        }
        this.sound('cold');
        break;
      }
      case 'frost_rain': {
        for (let i = 0; i < 4; i++) {
          const x = p.x + this.rng.range(-3, 3);
          const y = p.y + this.rng.range(-3, 3);
          const delay = 1.1 + i * 0.25;
          this.area.hazards.push({ x, y, t: 0, delay, dur: 3, radius: 1.7, dmg: dmg('cold', 0.9), owner: 'monster', burnDps: m.dmgMax * 0.25, srcLevel: m.level, fired: false, cold: true });
          this.fx({ kind: 'frost_mark', x, y, dur: delay, r: 1.7 });
        }
        this.sound('cold');
        break;
      }
      case 'toll': {
        // Two tolls, a breath apart: roll through the first and be ready for the second.
        const a = this.area;
        this.startToll(m);
        this.addTimer(1.55, () => {
          if (!m.dead && this.area === a && !m.invulnT) this.ringBell(m);
        });
        break;
      }
      case 'cold_snap':
        this.coldSnap(m);
        break;
      case 'snuff':
        this.snuff(m);
        break;
      case 'raise_dead': {
        const dead = this.area.monsters.filter((o) => o.dead && !o.used && o.def.id === 'mummy' && Math.hypot(o.x - m.x, o.y - m.y) < 10).slice(0, 5);
        if (!dead.length) {
          m.abilityCd = 1;
          break;
        }
        for (const o of dead) {
          o.summoned = true;
          o.xp = 0;
          this.reviveMonster(o, 0.6);
        }
        break;
      }
      case 'mirage_split':
        this.spawnIllusions(m, 2);
        break;
      case 'noon_burst':
        this.noonBurst(m);
        break;
      case 'meteor_rain': {
        for (let i = 0; i < 3; i++) {
          const x = p.x + this.rng.range(-2.5, 2.5);
          const y = p.y + this.rng.range(-2.5, 2.5);
          this.area.hazards.push({ x, y, t: 0, delay: 1.3 + i * 0.3, dur: 2, radius: 1.8, dmg: dmg('fire', 1.2), owner: 'monster', burnDps: m.dmgMax * 0.3, srcLevel: m.level, fired: false });
          this.fx({ kind: 'meteor_mark', x, y, dur: 1.3 + i * 0.3, r: 1.8 });
        }
        this.sound('fire');
        break;
      }
    }
  }

  /** Enters the next boss phase once life has fallen far enough. Returns true while transforming. */
  private advancePhase(m: Monster): boolean {
    const next = m.def.phases![m.phase ?? 0];
    if (!next || m.life / m.maxLife > next.at) return false;
    m.phase = (m.phase ?? 0) + 1;
    m.abilities = next.abilities;
    if (next.shape) m.shape = next.shape;
    if (next.color) m.color = next.color;
    if (next.name) m.name = next.name;
    m.action = null;
    m.charge = undefined;
    m.invulnT = 1.6;
    m.abilityCd = 2;
    if (next.phylactery) this.spawnPhylactery(m);
    this.msg(next.line, '#ffd870');
    this.fx({ kind: 'revive', x: m.x, y: m.y, dur: 1.2 });
    this.emit({ type: 'flash', color: m.color ?? m.def.color, a: 0.35 });
    this.emit({ type: 'shake', amount: 10 });
    this.sound('roar');
    return true;
  }

  private updateBurrow(m: Monster, dt: number, tgt: { x: number; y: number }) {
    const before = m.sub!;
    m.sub = before - dt;
    const WARNING = 0.6;
    const strike = !!m.subStrike;
    if (before > WARNING) {
      const dx = tgt.x - m.x;
      const dy = tgt.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = m.speed * (strike ? 3 : 2) * dt;
      if (d > 0.4) this.moveEntity(m, (dx / d) * sp, (dy / d) * sp, m.def.radius);
      if (Math.floor(before * 9) !== Math.floor(m.sub * 9)) this.fx({ kind: 'dust', x: m.x, y: m.y, dur: 0.7 });
      if (m.sub <= WARNING) this.fx({ kind: 'meteor_mark', x: m.x, y: m.y, dur: WARNING, r: strike ? 2.2 : 1.6 });
    }
    if (m.sub > 0) return;
    m.sub = undefined;
    m.subStrike = undefined;
    m.atkCd = 0.7;
    const r = strike ? 2.2 : 1.6;
    this.fx({ kind: 'slam', x: m.x, y: m.y, dur: 0.45, r });
    this.fx({ kind: 'dust', x: m.x, y: m.y, dur: 0.9 });
    this.emit({ type: 'shake', amount: strike ? 9 : 5 });
    this.sound('boom');
    const dmg = elemDamage(m.def.element ?? 'phys', roll(this.rng, m.dmgMin, m.dmgMax) * (strike ? 1.6 : 1.25));
    const p = this.player;
    if (Math.hypot(p.x - m.x, p.y - m.y) < r + 0.3) this.damagePlayer(dmg, { level: m.level });
    for (const mi of this.minions) if (!mi.dead && Math.hypot(mi.x - m.x, mi.y - m.y) < r + mi.def.radius) this.damageMinion(mi, dmg, { level: m.level });
  }

  /** Puts a shield on a nearby ally. The caster has to die first or the ward keeps coming. */
  private wardAlly(m: Monster): boolean {
    const ally = this.area.monsters.find((o) => !o.dead && o !== m && !o.illusion && !o.shield && o.alert && Math.hypot(o.x - m.x, o.y - m.y) < 7);
    if (!ally) return false;
    ally.shield = ally.maxLife * 0.45;
    ally.shieldT = 7;
    m.abilityCd = this.rng.range(3.5, 5.5);
    this.fx({ kind: 'revive', x: ally.x, y: ally.y, dur: 0.6 });
    this.sound('portal');
    return true;
  }

  private feedOnCorpse(m: Monster, dt: number, speed: number): boolean {
    const near = this.area.monsters.filter((o) => o.dead && !o.used && !o.illusion && o.deadT > 0.4 && Math.hypot(o.x - m.x, o.y - m.y) < 6);
    if (!near.length) return false;
    const c = near.reduce((a, b) => (Math.hypot(a.x - m.x, a.y - m.y) <= Math.hypot(b.x - m.x, b.y - m.y) ? a : b));
    const dx = c.x - m.x;
    const dy = c.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.6) {
      c.used = true;
      m.life = Math.min(m.maxLife, m.life + m.maxLife * 0.4);
      m.abilityCd = 3;
      this.fx({ kind: 'gore', x: c.x, y: c.y, dur: 0.6 });
      return true;
    }
    this.moveEntity(m, (dx / d) * speed * dt, (dy / d) * speed * dt, m.def.radius);
    m.facing = Math.atan2(dy, dx);
    m.walk += dt * speed;
    return true;
  }

  private slam(m: Monster, tgt: { x: number; y: number }) {
    const delay = 0.95;
    this.area.hazards.push({ x: tgt.x, y: tgt.y, t: 0, delay, dur: 0.05, radius: 2, dmg: elemDamage('phys', roll(this.rng, m.dmgMin, m.dmgMax) * 1.5), owner: 'monster', burnDps: 0, srcLevel: m.level, fired: false });
    this.fx({ kind: 'meteor_mark', x: tgt.x, y: tgt.y, dur: delay, r: 2 });
    m.action = { t: 0, hitAt: delay, dur: delay + 0.2, done: true, kind: 'melee' };
    m.facing = Math.atan2(tgt.y - m.y, tgt.x - m.x);
    m.abilityCd = this.rng.range(4.5, 6.5);
  }

  private spawnIllusions(m: Monster, n: number) {
    const a = this.area;
    for (let i = 0; i < n; i++) {
      const ang = this.rng.range(0, TAU);
      const s = nearestFloor(a.level, { x: m.x + Math.cos(ang) * 2.5, y: m.y + Math.sin(ang) * 2.5 });
      const c = this.spawnMonster(a, m.def.id, s.x + 0.5, s.y + 0.5, m.rarity, { packId: m.packId, level: m.level, name: m.name });
      Object.assign(c, { illusion: true, ownerId: m.id, split: true, summoned: true, alert: true, life: 1, maxLife: 1, xp: 0, shape: m.shape, color: m.color });
      this.fx({ kind: 'teleport', x: c.x, y: c.y, dur: 0.5 });
    }
    this.sound('portal');
  }

  private dispelIllusion(m: Monster) {
    m.dead = true;
    m.life = 0;
    m.used = true;
    m.action = null;
    m.deadT = 99;
    this.fx({ kind: 'teleport', x: m.x, y: m.y, dur: 0.4 });
  }

  private reviveMonster(m: Monster, lifeK: number) {
    m.dead = false;
    m.deadT = 0;
    m.deathKind = undefined;
    m.life = m.maxLife * lifeK;
    m.alert = true;
    m.action = null;
    this.fx({ kind: 'revive', x: m.x, y: m.y, dur: 0.7 });
    this.sound('fire');
  }

  /** Three pools of shade appear. A moment later, the noon burns anyone outside them. */
  private noonBurst(m: Monster) {
    const a = this.area;
    const p = this.player;
    const R = 2;
    const DELAY = 2.7;
    m.abilityCd = 8;
    // Measured by walking distance: a pool behind a wall could never be reached in time.
    const l = a.level;
    const dist = floodDistances(l, Math.floor(p.x), Math.floor(p.y));
    const reachable: Point[] = [];
    for (let y = 0; y < l.h; y++)
      for (let x = 0; x < l.w; x++) {
        const d = dist[idx(l, x, y)];
        if (d >= 3 && d <= 8) reachable.push({ x: x + 0.5, y: y + 0.5 });
      }
    const spots: Point[] = [];
    for (const s of this.rng.shuffle(reachable)) {
      if (spots.every((o) => Math.hypot(o.x - s.x, o.y - s.y) > R * 1.8)) spots.push(s);
      if (spots.length === 3) break;
    }
    if (!spots.length) spots.push({ x: p.x, y: p.y });
    for (const s of spots) this.fx({ kind: 'shade_mark', ...s, dur: DELAY, r: R });
    this.msg('Find the shade!', '#ffd870', 'noon');
    this.sound('roar');
    this.addTimer(DELAY, () => {
      if (m.dead || this.area !== a || p.dead) return;
      this.emit({ type: 'flash', color: '#fff4d0', a: 0.7 });
      this.emit({ type: 'shake', amount: 12 });
      this.sound('boom');
      if (!spots.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < R + 0.3)) this.damagePlayer(elemDamage('fire', this.stats.maxLife * 0.6), { level: m.level });
    });
  }

  // ---------------------------------------------------------------- warmth

  /** How warm it is at a spot: 1 beside a fire, less beside something that is merely burning, 0 in the open cold. */
  warmthAt(x: number, y: number): number {
    const a = this.area;
    for (const o of a.objects) if (o.kind === 'brazier' && o.used && Math.hypot(o.x - x, o.y - y) <= BRAZIER_RADIUS) return 1;
    for (const h of a.hazards) if (h.fired && !h.cold && h.burnDps > 0 && Math.hypot(h.x - x, h.y - y) <= h.radius + 1) return 1;
    // A Forgewright's furnace is a fire like any other, and a smith running hot is warm company.
    for (const mi of this.minions) if (mi.ally === 'furnace' && !mi.dead && Math.hypot(mi.x - x, mi.y - y) <= mi.built!.pr.radius!) return 1;
    if (this.player.heat >= HEAT_SLAG && Math.hypot(this.player.x - x, this.player.y - y) <= 1.5) return 0.5;
    for (const m of a.monsters) {
      if (m.dead || m.sub) continue;
      const hot = (m.burnT ?? 0) > 0 || (m.heat ?? 0) >= SLAG_MOLTEN || m.mods.includes('fireEnch');
      if (hot && Math.hypot(m.x - x, m.y - y) <= 2.6 + m.def.radius) return 0.5;
    }
    return 0;
  }

  /** Fire of the hero's own making (spells, burning blades, the burning dead) puts a little heat back in the ember. */
  feedEmber(amount: number) {
    if (this.cold) this.ember = Math.min(1, this.ember + amount);
  }

  /**
   * The ember burns down in the cold, faster in a whiteout, and is fed by standing near fire. While it has any heat
   * the hero is warm. Once it is out, frostbite builds: past half it slows, and when full it wounds until a fire is found.
   */
  private updateWarmth(dt: number) {
    const p = this.player;
    if (!this.cold || p.dead) {
      this.nearFire = false;
      if (!this.cold) (this.ember = Math.min(1, this.ember + dt)), (this.frost = Math.max(0, this.frost - dt));
      return;
    }
    const fire = this.warmthAt(p.x, p.y);
    this.nearFire = fire > 0;
    const was = this.ember;
    if (fire > 0) this.ember = Math.min(1, this.ember + 0.45 * fire * dt);
    else this.ember = Math.max(0, this.ember - (dt / EMBER_TIME) * (1 + 2.5 * this.storm));
    if (was > 0 && this.ember <= 0) {
      this.msg('The ember gutters. Find a fire!', '#a8e0ff', 'ember');
      this.sound('snuff');
    }
    if (this.ember > 0 || fire > 0) {
      this.frost = Math.max(0, this.frost - dt / 3);
      return;
    }
    const before = this.frost;
    this.frost = Math.min(1, this.frost + dt / FROST_TIME);
    if (before <= 0.5 && this.frost > 0.5) this.msg('Frostbite is setting in', '#a8e0ff', 'frost');
    if (this.frost >= 1) {
      if (before < 1) this.msg('You are freezing. Get to a fire!', '#ff8a6a', 'freeze');
      p.life -= this.stats.maxLife * 0.04 * dt;
      p.hurt = Math.max(p.hurt, 0.08);
      if (p.life <= 0) this.die();
    }
  }

  private lightBrazier(o: WorldObject) {
    if (o.used) return;
    o.used = true;
    this.ember = Math.max(this.ember, 0.5);
    this.fx({ kind: 'kindle', x: o.x, y: o.y, dur: 0.8, r: BRAZIER_RADIUS });
    this.sound('kindle');
    const a = this.area;
    if (a.def.quest === 'beacons' && this.questState('beacons') === 'active') {
      const left = a.objects.filter((b) => b.kind === 'brazier' && !b.used).length;
      if (left) return this.msg(`${left} ${left === 1 ? 'beacon' : 'beacons'} still dark`, '#ffb060');
      this.setQuest('beacons', 'done');
      this.emit({ type: 'announce', text: 'The Ember Road is lit', sub: 'Return to Wren', color: '#ffb060' });
      this.sound('quest');
    }
  }

  private snuffBrazier(o: WorldObject) {
    if (!o.used) return;
    o.used = false;
    this.fx({ kind: 'snuff', x: o.x, y: o.y, dur: 0.6, r: 1.5 });
  }

  /** Braziers still dark in Rimefall Pass while the quest to light them is open. */
  unlitBeacons(): WorldObject[] {
    const a = this.area;
    if (a.def.quest !== 'beacons' || this.questState('beacons') !== 'active') return [];
    return a.objects.filter((o) => o.kind === 'brazier' && !o.used);
  }

  /** Stokes or cools a Slag Golem: firelight makes it molten, and otherwise it drifts back to plain slag. */
  private temper(m: Monster, dt: number) {
    let h = m.heat ?? 0;
    const a = this.area;
    const fire = a.objects.some((o) => o.kind === 'brazier' && o.used && Math.hypot(o.x - m.x, o.y - m.y) <= BRAZIER_RADIUS - 1)
      || a.hazards.some((z) => z.fired && !z.cold && z.burnDps > 0 && Math.hypot(z.x - m.x, z.y - m.y) <= z.radius);
    if (fire) h = Math.min(1, h + 0.35 * dt);
    else if (a.def.blizzard && this.storm > 0.5) h = Math.max(-1, h - 0.3 * dt);
    else if (h > 0) h = Math.max(0, h - 0.1 * dt);
    else if (h < 0) h = Math.min(0, h + 0.09 * dt);
    m.heat = h;
  }

  /**
   * A Hearth-Eater in sight of the hero stands off and drinks the ember, and once it is dry, the hero. It cannot
   * drink from anyone standing in firelight: then it has to come in close and claw like anything else.
   */
  private drinkEmber(m: Monster, dt: number, _speed: number, dp: number): boolean {
    const p = this.player;
    if (this.nearFire || dp > m.def.range || !lineOfSight(this.area.level, m, p)) return false;
    m.facing = Math.atan2(p.y - m.y, p.x - m.x);
    m.drainT = 0.25;
    const dry = !this.cold || this.ember <= 0;
    if (this.cold) this.ember = Math.max(0, this.ember - 0.11 * dt);
    if (m.atkCd <= 0) {
      m.atkCd = 1 / m.def.attackRate;
      m.life = Math.min(m.maxLife, m.life + m.maxLife * 0.05);
      if (dry) this.damagePlayer(elemDamage('cold', roll(this.rng, m.dmgMin, m.dmgMax) * 0.7), { level: m.level });
    }
    return true;
  }

  /** Raises the bell. The toll itself comes at the end of the wind-up. */
  private startToll(m: Monster) {
    const windup = 0.85;
    m.action = { t: 0, hitAt: windup, dur: windup + 0.3, done: false, kind: 'toll' };
    if (m.def.ai !== 'boss') m.abilityCd = m.def.ai === 'totem' ? this.rng.range(3.6, 4.6) : this.rng.range(5, 7.5);
    this.fx({ kind: 'toll_mark', x: m.x, y: m.y, dur: windup, r: 1.8 });
  }

  private ringBell(m: Monster) {
    const far = m.def.ai !== 'melee';
    this.area.rings.push({
      x: m.x, y: m.y, r: 0.4, speed: 6.5, max: far ? 11 : 7.5, dmg: elemDamage('phys', roll(this.rng, m.dmgMin, m.dmgMax) * 1.3),
      srcLevel: m.level, passed: false, hit: new Set(),
    });
    this.emit({ type: 'shake', amount: 3 });
    this.sound('bell');
  }

  /** The rings spread, and strike whoever they pass over once. Nothing can be hit mid-roll, so they can be rolled through. */
  private updateRings(dt: number) {
    const a = this.area;
    if (!a.rings.length) return;
    const p = this.player;
    for (const g of a.rings) {
      const prev = g.r;
      g.r += g.speed * dt;
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (!g.passed && d <= g.r + 0.2) {
        g.passed = true;
        if (!p.dead && !this.inTown && d >= prev - 0.6 && lineOfSight(a.level, g, p)) {
          if (p.action?.kind === 'dodge') this.floatText(p.x, p.y, 'Rolled through', '#9bd39b');
          else if (this.damagePlayer(g.dmg, { level: g.srcLevel })) this.emit({ type: 'shake', amount: 6 });
        }
      }
      for (const mi of this.minions) {
        if (mi.dead || g.hit.has(mi.id) || Math.hypot(mi.x - g.x, mi.y - g.y) > g.r) continue;
        g.hit.add(mi.id);
        this.damageMinion(mi, { ...g.dmg, phys: g.dmg.phys * 0.5 }, { level: g.srcLevel });
      }
    }
    a.rings = a.rings.filter((g) => g.r < g.max);
  }

  /** Corvane hides behind his phylactery: across the room, ringing, and he cannot be hurt until it is broken. */
  private spawnPhylactery(m: Monster) {
    const a = this.area;
    const p = this.player;
    const c = a.level.spots.boss ? { x: a.level.spots.boss.x + 0.5, y: a.level.spots.boss.y + 0.5 } : m;
    // Opposite the hero across the chamber, so getting to it means crossing its tolls.
    const ang = Math.atan2(c.y - p.y, c.x - p.x) || 0;
    const s = nearestFloor(a.level, { x: c.x + Math.cos(ang) * 4.5, y: c.y + Math.sin(ang) * 4.5 });
    const ph = this.spawnMonster(a, 'phylactery', s.x + 0.5, s.y + 0.5, 'normal', { packId: m.packId, level: m.level });
    ph.alert = true;
    ph.summoned = true;
    ph.abilityCd = 2.2;
    m.wardId = ph.id;
    this.fx({ kind: 'teleport', x: ph.x, y: ph.y, dur: 0.6 });
    this.msg('Break the phylactery!', '#8ac8ff');
  }

  /** Every lit brazier is marked. A moment later the cold strikes anyone not standing by one, and puts out the ones that sheltered them. */
  private coldSnap(m: Monster) {
    const a = this.area;
    const p = this.player;
    const DELAY = 2.8;
    const near = a.objects.filter((o) => o.kind === 'brazier' && Math.hypot(o.x - m.x, o.y - m.y) < 18);
    if (!near.length) {
      m.abilityCd = 1;
      return;
    }
    m.abilityCd = 8;
    for (const o of near) this.fx({ kind: 'warm_mark', x: o.x, y: o.y, dur: DELAY, r: BRAZIER_RADIUS });
    this.msg('The cold draws breath. Get to a lit brazier!', '#a8e0ff', 'snap');
    this.sound('roar');
    this.addTimer(DELAY, () => {
      if (m.dead || this.area !== a || p.dead) return;
      this.emit({ type: 'flash', color: '#d8f0ff', a: 0.7 });
      this.emit({ type: 'shake', amount: 12 });
      this.sound('nova');
      const shelter = a.objects.filter((o) => o.kind === 'brazier' && o.used && Math.hypot(o.x - p.x, o.y - p.y) <= BRAZIER_RADIUS + 0.3);
      if (shelter.length) {
        for (const o of shelter) this.snuffBrazier(o);
        this.floatText(p.x, p.y, 'Sheltered', '#ffb060', 16);
        return;
      }
      if (this.damagePlayer(elemDamage('cold', this.stats.maxLife * 0.6), { level: m.level })) {
        this.ember = 0;
        this.frost = Math.max(this.frost, 0.6);
      }
    });
  }

  /** The Unlit reaches for every flame around it: braziers go dark, and a hero caught in the reach loses half the ember. */
  private snuff(m: Monster) {
    const a = this.area;
    const p = this.player;
    const R = 6.5;
    const DELAY = 1.5;
    const at = { x: m.x, y: m.y };
    m.action = { t: 0, hitAt: DELAY, dur: DELAY + 0.15, done: true, kind: 'cast' };
    this.fx({ kind: 'snuff_mark', ...at, dur: DELAY, r: R });
    this.msg('It reaches for your fire. Get clear!', '#a8a0d8', 'snuff');
    this.addTimer(DELAY, () => {
      if (m.dead || this.area !== a) return;
      this.fx({ kind: 'snuff', ...at, dur: 0.6, r: R });
      this.sound('snuff');
      for (const o of a.objects) if (o.kind === 'brazier' && Math.hypot(o.x - at.x, o.y - at.y) <= R + 1.5) this.snuffBrazier(o);
      if (p.dead || Math.hypot(p.x - at.x, p.y - at.y) > R) return;
      if (this.damagePlayer(elemDamage('cold', roll(this.rng, m.dmgMin, m.dmgMax) * 0.7), { level: m.level })) this.ember = Math.max(0, this.ember - 0.5);
    });
  }

  private inQuicksand(e: { x: number; y: number }) {
    const l = this.area.level;
    return l.slow.size > 0 && l.slow.has(idx(l, Math.floor(e.x), Math.floor(e.y)));
  }

  private updateStorm(dt: number) {
    let target = 0;
    const blizzard = !!this.area.def.blizzard;
    if (this.area.def.storm || blizzard) {
      if (this.stormLeft > 0) {
        this.stormLeft -= dt;
        if (this.stormLeft <= 0) this.stormIn = this.rng.range(35, 70);
        else target = 1;
      } else {
        this.stormIn -= dt;
        if (this.stormIn <= 0) {
          this.stormLeft = this.rng.range(12, 20);
          this.msg(blizzard ? 'A whiteout comes down the pass' : 'A sandstorm rolls in', blizzard ? '#d8f0ff' : '#e0c080', 'storm');
          target = 1;
        }
      }
    }
    this.storm += Math.max(-dt / 2.5, Math.min(dt / 2.5, target - this.storm));
  }

  private updateCharge(m: Monster, dt: number) {
    const c = m.charge!;
    const p = this.player;
    const sp = m.speed * 3.2;
    const moved = this.moveEntity(m, c.dx * sp * dt, c.dy * sp * dt, m.def.radius);
    m.facing = Math.atan2(c.dy, c.dx);
    m.walk += dt * sp;
    c.t -= dt;
    if (!c.hit && Math.hypot(p.x - m.x, p.y - m.y) < m.def.radius + 0.6) {
      c.hit = true;
      this.damagePlayer(elemDamage('phys', roll(this.rng, m.dmgMin, m.dmgMax) * 1.5), { ar: m.ar * 2, level: m.level, melee: true, source: m });
      this.emit({ type: 'shake', amount: 8 });
      this.moveEntity(p, c.dx * 1.2, c.dy * 1.2, 0.3);
    }
    if (c.t <= 0 || !moved || c.hit) m.charge = undefined;
  }

  // ---------------------------------------------------------------- projectiles & hazards

  private updateProjectiles(dt: number) {
    const a = this.area;
    const l = a.level;
    const p = this.player;
    for (const pr of a.projectiles) {
      if (pr.wobble) {
        const ang = Math.atan2(pr.vy, pr.vx) + this.rng.range(-0.35, 0.35);
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(ang) * sp;
        pr.vy = Math.sin(ang) * sp;
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.ttl -= dt;
      if (!isWalkable(l, pr.x, pr.y)) {
        if (pr.explode) this.explode(pr);
        pr.ttl = 0;
        continue;
      }
      if (pr.owner === 'player') {
        for (const m of a.monsters) {
          if (m.dead || m.sub || pr.hit.has(m.id)) continue;
          if (Math.hypot(m.x - pr.x, m.y - pr.y) > m.def.radius + pr.radius) continue;
          pr.hit.add(m.id);
          if (pr.explode) {
            this.explode(pr);
            pr.ttl = 0;
            break;
          }
          const hit = this.damageMonster(m, pr.dmg, { ar: pr.ar, chill: pr.chill, leech: pr.ar !== undefined && !pr.servant, minion: pr.servant });
          if (hit && pr.chains) this.chainLightning(m, pr.chains.n, pr.chains.dmg);
          if (hit && pr.ar !== undefined) this.sound('hit');
          if (!pr.pierce) {
            pr.ttl = 0;
            break;
          }
        }
      } else if (this.minionHit(pr)) {
        pr.ttl = 0;
      } else if (!p.dead && Math.hypot(p.x - pr.x, p.y - pr.y) < 0.3 + pr.radius) {
        if (pr.explode) this.explode(pr);
        else if (this.damagePlayer(pr.dmg, { ar: pr.ar, level: pr.srcLevel, missile: true }) && pr.sap && this.cold) this.ember = Math.max(0, this.ember - pr.sap);
        pr.ttl = 0;
      }
    }
    a.projectiles = a.projectiles.filter((pr) => pr.ttl > 0);
  }

  private explode(pr: Projectile) {
    const r = pr.explode!;
    this.fx({ kind: 'explosion', x: pr.x, y: pr.y, dur: 0.45, r });
    this.sound('boom');
    if (pr.owner === 'player') {
      for (const m of this.monstersNear(pr.x, pr.y, r)) this.damageMonster(m, pr.dmg, {});
    } else {
      if (Math.hypot(this.player.x - pr.x, this.player.y - pr.y) < r + 0.3) this.damagePlayer(pr.dmg, { level: pr.srcLevel });
      for (const mi of this.minions) if (!mi.dead && Math.hypot(mi.x - pr.x, mi.y - pr.y) < r + mi.def.radius) this.damageMinion(mi, pr.dmg, { level: pr.srcLevel });
    }
  }

  /** Monster missiles also strike servants in their way. */
  private minionHit(pr: Projectile): boolean {
    for (const mi of this.minions) {
      if (mi.dead || Math.hypot(mi.x - pr.x, mi.y - pr.y) > mi.def.radius + pr.radius) continue;
      if (pr.explode) this.explode(pr);
      else this.damageMinion(mi, pr.dmg, { ar: pr.ar, level: pr.srcLevel });
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- servants

  /** Nearest unused corpse within `r` of a point. Bosses leave no usable corpse. */
  findCorpse(x: number, y: number, r: number): Monster | null {
    let best: Monster | null = null;
    let bd = r;
    for (const m of this.area.monsters) {
      if (!m.dead || m.used || m.deadT > 36 || m.rarity === 'boss' || m.deathKind === 'shatter') continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d <= bd) (bd = d), (best = m);
    }
    return best;
  }

  /** Living skeletons against the current cap, or null before Raise Skeleton is learned. */
  skeletonCount(): { alive: number; max: number } | null {
    const lvl = skillLevel(this.char, 'raise_skeleton');
    if (!lvl) return null;
    return { alive: this.minions.filter((mi) => mi.ally === 'skeleton' && !mi.dead).length, max: SKILL_BY_ID.raise_skeleton.params(lvl).count! };
  }

  /** Living constructs of the kind a skill builds against its cap, or null if the skill is not learned or builds nothing. */
  constructCount(skillId: string): { alive: number; max: number } | null {
    const kind = CONSTRUCT_OF[skillId];
    const lvl = kind ? skillLevel(this.char, skillId) : 0;
    if (!lvl) return null;
    return { alive: this.minions.filter((mi) => mi.ally === kind && !mi.dead).length, max: SKILL_BY_ID[skillId].params(lvl).count ?? 1 };
  }

  private scrapConstruct(mi: Monster) {
    mi.dead = true;
    mi.action = null;
    this.fx({ kind: 'dust', x: mi.x, y: mi.y, dur: 0.5 });
    this.fx({ kind: 'spark', x: mi.x, y: mi.y, dur: 0.5, color: '#e8b860' });
  }

  private raiseMinion(kind: Ally, x: number, y: number, pr: SkillParams, syn = 1): Monster {
    const def = MONSTERS[ALLY_DEF[kind]];
    const lvl = this.char.level;
    const undead = kind === 'skeleton' || kind === 'golem';
    const mastery = undead ? 'skeletal_mastery' : 'gearwork';
    const ml = skillLevel(this.char, mastery);
    const mp = ml ? SKILL_BY_ID[mastery].params(ml) : { pct: 0, pct2: 0 };
    const dmgK = (1 + (pr.pct ?? 0) / 100) * (1 + (mp.pct ?? 0) / 100) * syn;
    const lifeK = (1 + (pr.pct2 ?? 0) / 100) * (1 + (mp.pct2 ?? 0) / 100);
    const life = Math.round(baseLife(lvl) * def.lifeMul * lifeK);
    const dmg = baseDamage(lvl) * def.dmgMul * dmgK;
    const pos = isWalkable(this.area.level, x, y) ? { x, y } : { x: this.player.x, y: this.player.y };
    const mi: Monster = {
      id: this.id(), def, x: pos.x, y: pos.y, life, maxLife: life, level: lvl, dmgMin: Math.max(1, Math.round(dmg * 0.6)), dmgMax: Math.max(2, Math.round(dmg * 1.25)),
      ar: Math.round(20 + lvl * 13), def_: Math.round(10 + lvl * 9 * (kind === 'golem' || kind === 'sentinel' ? 1.5 : 1)), res: { phys: 0, fire: 0, cold: 0, light: 0, poison: 0, ...def.res },
      speed: def.speed, xp: 0, rarity: 'normal', name: def.name, mods: [], alert: true, homeX: pos.x, homeY: pos.y, wanderT: 0, wanderTo: null,
      atkCd: 0.4, action: null, abilityCd: 0, chill: 0, stun: 0, poison: { dps: 0, t: 0 }, fleeT: 0, knock: { x: 0, y: 0 }, dead: false, deadT: 0,
      packId: -1, facing: this.player.facing, walk: 0, flash: 0, revived: 0, ally: kind,
    };
    if (!undead) {
      mi.built = { pr, syn: syn * (1 + (mp.pct ?? 0) / 100) };
      if (!def.speed) (mi.fixed = true), (mi.ttl = pr.duration);
    }
    this.minions.push(mi);
    if (undead) this.fx({ kind: 'raise', x: pos.x, y: pos.y, dur: 0.8 });
    else {
      this.fx({ kind: 'dust', x: pos.x, y: pos.y, dur: 0.5 });
      this.fx({ kind: 'spark', x: pos.x, y: pos.y, dur: 0.5, color: '#ffd080' });
    }
    return mi;
  }

  /** Put a servant on a free tile next to the player (area change, or when it falls far behind). */
  private placeMinion(mi: Monster) {
    const p = this.player;
    const ang = this.rng.range(0, TAU);
    const s = nearestFloor(this.area.level, { x: p.x + Math.cos(ang) * 1.2, y: p.y + Math.sin(ang) * 1.2 });
    mi.x = s.x + 0.5;
    mi.y = s.y + 0.5;
    mi.foe = undefined;
    mi.action = null;
    mi.knock = { x: 0, y: 0 };
  }

  damageMinion(mi: Monster, d: Damage, o: { ar?: number; level: number }) {
    if (mi.dead) return;
    if (o.ar !== undefined && !this.rng.chance(hitChance(o.ar, mi.def_, o.level, mi.level))) return;
    const { total } = applyResists(d, mi.res);
    mi.life -= total;
    mi.flash = 0.12;
    if (d.cold > 0) mi.chill = 1.5;
    if (mi.life <= 0) {
      mi.dead = true;
      mi.life = 0;
      mi.action = null;
      this.fx({ kind: 'spark', x: mi.x, y: mi.y, dur: 0.5, color: mi.built ? '#e8b860' : '#e8e0c8' });
      if (mi.built) this.fx({ kind: 'dust', x: mi.x, y: mi.y, dur: 0.5 });
      this.sound(mi.built ? 'thud' : 'death');
    }
  }

  private updateMinions(dt: number) {
    if (!this.minions.length) return;
    const p = this.player;
    const l = this.area.level;
    const calm = this.inTown || p.dead;
    for (const mi of this.minions) {
      if (mi.dead) continue;
      if (mi.flash > 0) mi.flash -= dt;
      if (mi.chill > 0) mi.chill -= dt;
      if (mi.knock.x || mi.knock.y) mi.knock = { x: 0, y: 0 };
      const slow = mi.chill > 0 ? 0.5 : 1;
      mi.atkCd -= dt * slow;
      if (mi.ttl !== undefined && (mi.ttl -= dt) <= 0) {
        this.scrapConstruct(mi);
        continue;
      }
      if (mi.fixed) {
        this.updateConstruct(mi, dt * slow, calm);
        continue;
      }
      const dp = Math.hypot(p.x - mi.x, p.y - mi.y);
      if (dp > 16) {
        this.placeMinion(mi);
        this.fx({ kind: 'raise', x: mi.x, y: mi.y, dur: 0.5 });
        continue;
      }
      let foe = mi.foe !== undefined ? this.area.monsters.find((m) => m.id === mi.foe && !m.dead) : undefined;
      if (foe && Math.hypot(foe.x - p.x, foe.y - p.y) > 11) foe = undefined;
      mi.wanderT -= dt;
      if (!calm && (!foe || mi.wanderT <= 0)) {
        mi.wanderT = 0.6;
        let bd = foe ? Math.hypot(foe.x - mi.x, foe.y - mi.y) - 1 : 7;
        for (const m of this.area.monsters) {
          if (m.dead || m.sub || Math.abs(m.x - mi.x) > bd || Math.abs(m.y - mi.y) > bd) continue;
          const d = Math.hypot(m.x - mi.x, m.y - mi.y);
          if (d < bd && Math.hypot(m.x - p.x, m.y - p.y) < 10 && lineOfSight(l, mi, m)) (bd = d), (foe = m);
        }
        if (foe?.id !== mi.foe) mi.stuckT = 0;
      }
      if (calm) foe = undefined;
      mi.foe = foe?.id;
      if (mi.action) {
        const act = mi.action;
        act.t += dt * slow;
        if (!act.done && act.t >= act.hitAt) {
          act.done = true;
          if (foe && Math.hypot(foe.x - mi.x, foe.y - mi.y) <= mi.def.radius + foe.def.radius + mi.def.range + 0.4) {
            this.damageMonster(foe, elemDamage('phys', roll(this.rng, mi.dmgMin, mi.dmgMax)), { ar: mi.ar, minion: mi });
          }
        }
        if (act.t >= act.dur) mi.action = null;
        continue;
      }
      let goal: Point | null = null;
      let speed = mi.speed * slow;
      if (foe) {
        const d = Math.hypot(foe.x - mi.x, foe.y - mi.y);
        mi.facing = Math.atan2(foe.y - mi.y, foe.x - mi.x);
        if (d <= mi.def.radius + foe.def.radius + mi.def.range) {
          if (mi.atkCd <= 0) {
            mi.action = { t: 0, hitAt: 0.3, dur: 0.55, done: false, kind: 'melee' };
            mi.atkCd = 1 / mi.def.attackRate;
          }
          continue;
        }
        goal = foe;
      } else if (dp > 2.6) {
        goal = p;
        if (dp > 6) speed *= 1.4;
      }
      if (!goal) continue;
      let tx = goal.x;
      let ty = goal.y;
      if (!lineOfSight(l, mi, goal)) {
        // Route around walls using the flow field toward the player.
        const n = this.area.flow.next(mi.x, mi.y);
        if (n) (tx = n.x), (ty = n.y);
      }
      const mx = tx - mi.x;
      const my = ty - mi.y;
      const ml = Math.hypot(mx, my) || 1;
      const moved = this.moveEntity(mi, (mx / ml) * speed * dt, (my / ml) * speed * dt, mi.def.radius);
      mi.facing = Math.atan2(my, mx);
      mi.walk += dt * speed;
      if (!moved && foe) {
        mi.stuckT = (mi.stuckT ?? 0) + dt;
        if (mi.stuckT > 1.5) (mi.foe = undefined), (mi.wanderT = 2);
      }
    }
    this.minions = this.minions.filter((mi) => !mi.dead);
  }

  /** Turrets and the furnace: they stay where they were built and do one job. */
  private updateConstruct(mi: Monster, dt: number, calm: boolean) {
    const p = this.player;
    const l = this.area.level;
    const b = mi.built!;
    if (mi.action && (mi.action.t += dt) >= mi.action.dur) mi.action = null;
    if (mi.ally === 'furnace') {
      if (mi.atkCd > 0) return;
      mi.atkCd = 0.5;
      const r = b.pr.radius!;
      const heal = b.pr.heal! * b.syn * 0.5;
      mi.walk += 1;
      if (mi.walk % 3 === 1) this.fx({ kind: 'warmth', x: mi.x, y: mi.y, dur: 1.4, r });
      if (!p.dead && p.life < this.stats.maxLife && Math.hypot(p.x - mi.x, p.y - mi.y) <= r) {
        p.life = Math.min(this.stats.maxLife, p.life + heal);
        if (mi.walk % 2 === 0) this.fx({ kind: 'heal', x: p.x, y: p.y, dur: 0.5, color: '#ff9040' });
      }
      // Servants have a monster's life rather than a hero's, so they mend by proportion as well.
      for (const o of this.minions) {
        if (o === mi || o.dead || o.life >= o.maxLife || Math.hypot(o.x - mi.x, o.y - mi.y) > r) continue;
        o.life = Math.min(o.maxLife, o.life + Math.max(heal, o.maxLife * 0.03));
      }
      return;
    }
    if (calm) return;
    const range = b.pr.range ?? mi.def.range;
    let foe = mi.foe !== undefined ? this.area.monsters.find((m) => m.id === mi.foe && !m.dead && !m.sub) : undefined;
    if (foe && Math.hypot(foe.x - mi.x, foe.y - mi.y) > range + foe.def.radius) foe = undefined;
    mi.wanderT -= dt;
    if (!foe || mi.wanderT <= 0) {
      mi.wanderT = 0.5;
      let bd = range;
      foe = undefined;
      for (const m of this.area.monsters) {
        if (m.dead || m.sub || Math.abs(m.x - mi.x) > range + 1 || Math.abs(m.y - mi.y) > range + 1) continue;
        const d = Math.hypot(m.x - mi.x, m.y - mi.y) - m.def.radius;
        if (d < bd && lineOfSight(l, mi, m)) (bd = d), (foe = m);
      }
    }
    mi.foe = foe?.id;
    if (!foe) return;
    const ang = Math.atan2(foe.y - mi.y, foe.x - mi.x);
    mi.facing = ang;
    if (mi.atkCd > 0) return;
    mi.atkCd = 1 / mi.def.attackRate;
    if (mi.ally === 'ballista') {
      mi.action = { t: 0, hitAt: 0, dur: 0.45, done: true, kind: 'shoot' };
      this.spawnProjectile({
        x: mi.x, y: mi.y, ang, speed: 17, ttl: range / 17 + 0.15, owner: 'player', dmg: elemDamage('phys', roll(this.rng, mi.dmgMin, mi.dmgMax)), kind: 'bolt',
        radius: 0.3, srcLevel: mi.level, servant: mi,
      });
      if (Math.hypot(p.x - mi.x, p.y - mi.y) < 12) this.sound('bow');
      return;
    }
    // Bellows: a tongue of flame over everything close in front of it.
    mi.action = { t: 0, hitAt: 0, dur: 0.5, done: true, kind: 'cast' };
    this.fx({ kind: 'flame', x: mi.x, y: mi.y, dur: 0.5, r: range, ang });
    const perTick = mi.atkCd;
    for (const m of this.monstersNear(mi.x, mi.y, range)) {
      if (Math.abs(angleDiff(Math.atan2(m.y - mi.y, m.x - mi.x), ang)) > 0.75 || !lineOfSight(l, mi, m)) continue;
      this.damageMonster(m, elemDamage('fire', roll(this.rng, b.pr.min!, b.pr.max!) * b.syn * perTick), { minion: mi });
    }
  }

  private chainLightning(from: Monster, n: number, dmg: Damage) {
    const hit = new Set<number>([from.id]);
    let cur: Monster = from;
    const pts: Point[] = [{ x: cur.x, y: cur.y }];
    for (let i = 0; i < n; i++) {
      const next = this.monstersNear(cur.x, cur.y, 5).find((m) => !hit.has(m.id));
      if (!next) break;
      hit.add(next.id);
      pts.push({ x: next.x, y: next.y });
      this.damageMonster(next, dmg, {});
      cur = next;
    }
    this.damageMonster(from, dmg, {});
    this.fx({ kind: 'chain', x: from.x, y: from.y, dur: 0.3, pts });
    this.sound('light');
  }

  private updateHazards(dt: number) {
    const a = this.area;
    const p = this.player;
    for (const h of a.hazards) {
      h.t += dt;
      if (!h.fired && h.t >= h.delay) {
        h.fired = true;
        if (h.anvil) {
          this.fx({ kind: 'slam', x: h.x, y: h.y, dur: 0.5, r: h.radius });
          this.fx({ kind: 'dust', x: h.x, y: h.y, dur: 0.6 });
          this.emit({ type: 'shake', amount: 8 });
          this.emit({ type: 'hitstop', t: 0.05 });
          this.sound('boom');
          let landed = false;
          for (const m of this.monstersNear(h.x, h.y, h.radius)) landed = this.damageMonster(m, h.dmg, { stun: h.stun, leech: true }) || landed;
          if (landed) this.gainHeat(10);
          continue;
        }
        this.fx(h.cold ? { kind: 'nova', x: h.x, y: h.y, dur: 0.45, r: h.radius, color: '#a8e8ff' } : { kind: 'explosion', x: h.x, y: h.y, dur: 0.6, r: h.radius });
        if (!h.quiet) {
          this.emit({ type: 'shake', amount: 7 });
          this.sound('boom');
        }
        if (h.owner === 'player') for (const m of this.monstersNear(h.x, h.y, h.radius)) this.damageMonster(m, h.dmg, {});
        else if (Math.hypot(p.x - h.x, p.y - h.y) < h.radius) this.damagePlayer(h.dmg, { level: h.srcLevel });
      }
      if (h.fired && h.t < h.delay + h.dur) {
        if (Math.floor((h.t - dt) * 4) !== Math.floor(h.t * 4)) {
          this.fx({ kind: h.cold ? 'frost' : 'burn', x: h.x + this.rng.range(-h.radius, h.radius) * 0.6, y: h.y + this.rng.range(-h.radius, h.radius) * 0.6, dur: 0.6 });
          const burn = elemDamage(h.cold ? 'cold' : 'fire', h.burnDps / 4);
          if (h.owner === 'player') for (const m of this.monstersNear(h.x, h.y, h.radius * 0.8)) this.damageMonster(m, burn, {});
          else if (Math.hypot(p.x - h.x, p.y - h.y) < h.radius * 0.8 && this.damagePlayer(burn, { level: h.srcLevel }) && h.cold && this.cold) this.ember = Math.max(0, this.ember - 0.04);
        }
      }
    }
    a.hazards = a.hazards.filter((h) => h.t < h.delay + h.dur);
  }

  // ---------------------------------------------------------------- dodge

  /**
   * A quick roll that nothing can hit. Goes the way the hero is steering (or `dir`, or the way they face),
   * and cuts short a swing or a cast that has not landed yet.
   */
  cmdDodge(dir?: Point | null): boolean {
    const p = this.player;
    if (p.dead || this.dodgeCd > 0) return false;
    if (p.action && (p.action.kind === 'leap' || p.action.kind === 'whirl' || p.action.kind === 'dodge')) return false;
    const d = dir && Math.hypot(dir.x, dir.y) > 0.15 ? dir : p.moveDir ?? { x: Math.cos(p.facing), y: Math.sin(p.facing) };
    const len = Math.hypot(d.x, d.y) || 1;
    p.facing = Math.atan2(d.y, d.x);
    p.action = { kind: 'dodge', skill: 'attack', t: 0, dur: DODGE_TIME, hitAt: 0, done: true, x: d.x / len, y: d.y / len };
    p.intent = null;
    p.path = [];
    p.invuln = Math.max(p.invuln, DODGE_TIME + 0.1);
    this.dodgeCd = DODGE_COOLDOWN;
    this.fx({ kind: 'dust', x: p.x, y: p.y, dur: 0.5 });
    this.sound('dodge');
    return true;
  }

  // ---------------------------------------------------------------- sprees

  private countKill(m: Monster) {
    if (this.inTown) return;
    const s = this.streak;
    s.n++;
    s.t = SPREE_WINDOW + (m.rarity === 'boss' ? 4 : 0);
    let tier = s.tier;
    while (tier + 1 < SPREE_TIERS.length && s.n >= SPREE_TIERS[tier + 1].n) tier++;
    if (tier === s.tier) return;
    s.tier = tier;
    const t = SPREE_TIERS[tier];
    this.emit({ type: 'announce', text: t.title, sub: `${s.n} kills`, color: t.color });
    this.sound('spree');
    // Each new rank is a second wind.
    this.refreshStats();
    const p = this.player;
    p.life = Math.min(this.stats.maxLife, p.life + this.stats.maxLife * 0.15);
    p.mana = Math.min(this.stats.maxMana, p.mana + this.stats.maxMana * 0.15);
    this.fx({ kind: 'heal', x: p.x, y: p.y, dur: 0.6, color: '#ff4040' });
  }

  private endSpree(quiet: boolean) {
    const s = this.streak;
    const ranked = s.tier >= 0;
    if (ranked) {
      const best = this.char.bestSpree ?? 0;
      if (s.n > best) this.char.bestSpree = s.n;
      if (!quiet) this.msg(`${SPREE_TIERS[s.tier].title} over: ${s.n} kills${s.n > best && best > 0 ? ', a new best!' : ''}`, '#e8c860');
    }
    this.streak = { n: 0, t: 0, tier: -1 };
    if (ranked) this.refreshStats();
  }

  // ---------------------------------------------------------------- soul orbs

  private addOrb(x: number, y: number, kind: Orb['kind']) {
    const tx = x + this.luck.range(-0.8, 0.8);
    const ty = y + this.luck.range(-0.8, 0.8);
    const ok = isWalkable(this.area.level, tx, ty);
    this.area.orbs.push({ id: this.id(), x: ok ? tx : x, y: ok ? ty : y, kind, t: 0 });
  }

  private dropOrbs(m: Monster) {
    if (m.thief) return;
    const big = m.rarity === 'boss' || m.rarity === 'unique';
    const chance = big ? 1 : m.rarity === 'champion' ? 0.4 : m.rarity === 'minion' ? 0.15 : 0.08;
    if (!this.luck.chance(chance)) return;
    const n = m.rarity === 'boss' ? 4 : m.rarity === 'unique' ? 2 : 1;
    const first: Orb['kind'] = this.luck.chance(0.7) ? 'life' : 'mana';
    for (let i = 0; i < n; i++) this.addOrb(m.x, m.y, i % 2 === 0 ? first : first === 'life' ? 'mana' : 'life');
  }

  /** Orbs are taken by walking over them, and left where they lie when there is nothing for them to mend. */
  private collectOrbs() {
    const a = this.area;
    if (!a.orbs.length) return;
    const p = this.player;
    const st = this.stats;
    for (const o of a.orbs.slice()) {
      if (o.t < 0.3 || Math.hypot(o.x - p.x, o.y - p.y) > 1.05) continue;
      if (o.kind === 'life') {
        const hurt = this.minions.filter((mi) => !mi.dead && mi.life < mi.maxLife);
        if (p.life >= st.maxLife && !hurt.length) continue;
        p.life = Math.min(st.maxLife, p.life + st.maxLife * 0.25);
        for (const mi of hurt) mi.life = Math.min(mi.maxLife, mi.life + mi.maxLife * 0.3);
        this.fx({ kind: 'heal', x: p.x, y: p.y, dur: 0.6, color: '#ff4040' });
        this.floatText(p.x, p.y, 'Life', '#ff8088');
      } else {
        if (p.mana >= st.maxMana) continue;
        p.mana = Math.min(st.maxMana, p.mana + st.maxMana * 0.25);
        this.fx({ kind: 'heal', x: p.x, y: p.y, dur: 0.6, color: '#4f7dff' });
        this.floatText(p.x, p.y, 'Mana', '#80a8ff');
      }
      this.sound('orb');
      a.orbs.splice(a.orbs.indexOf(o), 1);
    }
  }

  // ---------------------------------------------------------------- the Tithe Imp

  /** Every blow knocks coins out of the sack and slows the imp for a moment, so it can be run down. */
  private shakeThief(m: Monster) {
    const th = m.thief!;
    th.stagger = 0.55;
    if (th.dropCd > this.time) return;
    th.dropCd = this.time + 0.4;
    const amt = Math.max(2, Math.round((4 + m.level * 2.2) * (1 + this.stats.gf / 100)));
    this.area.ground.push({ id: this.id(), x: m.x, y: m.y, gold: amt, t: 0 });
    this.sound('gold');
  }

  private updateThief(m: Monster, dt: number) {
    const th = m.thief!;
    const p = this.player;
    const l = this.area.level;
    if (!th.started) {
      th.started = true;
      this.emit({ type: 'announce', text: 'A Tithe Imp!', sub: 'Catch it before it escapes', color: '#ffd860' });
      this.sound('cackle');
    }
    const before = th.t;
    th.t -= dt;
    if (th.stagger > 0) th.stagger -= dt;
    if (th.t <= 0) {
      this.fx({ kind: 'teleport', x: m.x, y: m.y, dur: 0.5 });
      this.sound('portal');
      this.msg('The Tithe Imp escapes with its hoard.', '#c8b890');
      // Gone without a corpse.
      m.dead = true;
      m.used = true;
      m.life = 0;
      m.deadT = 999;
      return;
    }
    if (th.t <= THIEF_CHANNEL) {
      // It stands still to open its portal: the last chance to bring it down.
      if (before > THIEF_CHANNEL) {
        this.fx({ kind: 'portal_open', x: m.x, y: m.y, dur: THIEF_CHANNEL, r: 1.2 });
        this.sound('portal');
        this.msg('The Tithe Imp is opening a portal!', '#ffd860');
      }
      m.facing += dt * 9;
      return;
    }
    th.repath -= dt;
    if (!th.path.length || th.repath <= 0) {
      th.repath = 2.5;
      // Run for somewhere far from the hunter that does not mean running past them.
      const dpm = Math.hypot(m.x - p.x, m.y - p.y) || 1;
      let best: Point | null = null;
      let bs = -Infinity;
      for (const s of l.spawns) {
        const dm = Math.hypot(s.x - m.x, s.y - m.y);
        if (dm < 4) continue;
        const away = ((s.x - m.x) * (m.x - p.x) + (s.y - m.y) * (m.y - p.y)) / (dm * dpm);
        const score = Math.min(Math.hypot(s.x - p.x, s.y - p.y), 26) - dm * 0.5 + away * 7 + this.luck.range(0, 3);
        if (score > bs) (bs = score), (best = s);
      }
      th.path = best ? findPath(l, m, { x: best.x + 0.5, y: best.y + 0.5 }) : [];
    }
    const speed = m.speed * (m.chill > 0 ? 0.5 : 1) * (th.stagger > 0 ? 0.5 : 1) * (this.inQuicksand(m) ? 0.6 : 1);
    const next = th.path[0];
    let dx = m.x - p.x;
    let dy = m.y - p.y;
    if (next) {
      dx = next.x - m.x;
      dy = next.y - m.y;
      if (Math.hypot(dx, dy) < 0.35) {
        th.path.shift();
        return;
      }
    }
    const d = Math.hypot(dx, dy) || 1;
    if (!this.moveEntity(m, (dx / d) * speed * dt, (dy / d) * speed * dt, m.def.radius)) th.path = [];
    m.facing = Math.atan2(dy, dx);
    m.walk += dt * speed;
  }

  private jackpot(m: Monster) {
    const a = this.area;
    this.emit({ type: 'announce', text: 'Jackpot!', sub: 'The Tithe Imp spills its hoard', color: '#ffd860' });
    this.emit({ type: 'shake', amount: 6 });
    this.sound('jackpot');
    this.fx({ kind: 'coins', x: m.x, y: m.y, dur: 1.1, r: 2.2 });
    const gf = 1 + this.stats.gf / 100;
    const spin = this.luck.range(0, TAU);
    for (let i = 0; i < 10; i++) {
      const ang = spin + (i / 10) * TAU;
      const r = this.luck.range(0.7, 2.2);
      const x = m.x + Math.cos(ang) * r;
      const y = m.y + Math.sin(ang) * r;
      const ok = isWalkable(a.level, x, y);
      const gold = Math.round((12 + m.level * 7) * gf * this.luck.range(0.7, 1.4));
      a.ground.push({ id: this.id(), x: ok ? x : m.x, y: ok ? y : m.y, gold, t: 0 });
    }
    this.spawnDrops(m.x, m.y, m.level, 'unique');
    this.spawnDrops(m.x, m.y, m.level, 'unique');
    this.char.tithes = (this.char.tithes ?? 0) + 1;
  }

  // ---------------------------------------------------------------- cursed shrines

  private startAmbush(o: WorldObject) {
    this.ambushes.set(o.id, { area: this.area, x: o.x, y: o.y, wave: 0 });
    this.emit({ type: 'announce', text: 'Ambush!', sub: 'Break the curse to claim its hoard', color: '#d080ff' });
    this.emit({ type: 'flash', color: '#8030c0', a: 0.3 });
    this.emit({ type: 'shake', amount: 6 });
    this.sound('curse');
    this.ambushWave(o.id);
  }

  /** Three waves rise around the hero; the last is led by an elite. */
  private ambushWave(id: number) {
    const am = this.ambushes.get(id);
    if (!am) return;
    if (am.area !== this.area || this.player.dead) return void this.ambushes.delete(id);
    const a = am.area;
    const p = this.player;
    am.wave++;
    const last = am.wave === 3;
    const type = this.luck.pick(a.def.monsters);
    const big = type === 'brute' || type === 'colossus';
    const n = last ? 4 : big ? 2 + am.wave : 4 + am.wave;
    const packId = 100000 + id * 4 + am.wave;
    const spin = this.luck.range(0, TAU);
    for (let i = 0; i < n; i++) {
      const ang = spin + (i / n) * TAU;
      const r = this.luck.range(3.2, 5);
      const spot = nearestFloor(a.level, { x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r });
      const leader = last && i === 0;
      const m = this.spawnMonster(a, type, spot.x + 0.5, spot.y + 0.5, leader ? 'unique' : last ? 'minion' : 'normal', leader
        ? { packId, mods: rollUniqueMods(this.luck, 2 + this.char.difficulty), name: uniqueName(this.luck) }
        : { packId });
      m.ambush = id;
      m.alert = true;
      this.fx({ kind: 'revive', x: m.x, y: m.y, dur: 0.7 });
    }
    this.sound('fire');
  }

  private ambushKill(id: number) {
    const am = this.ambushes.get(id);
    if (!am) return;
    if (am.area.monsters.some((m) => m.ambush === id && !m.dead)) return;
    if (am.wave < 3) {
      // One timer per wave, even if something that died gets back up and dies again.
      if (am.wave < 0) return;
      const wave = am.wave;
      am.wave = -1;
      this.msg(wave === 2 ? 'Something worse is coming...' : 'More are coming...', '#d080ff');
      this.addTimer(1.3, () => {
        am.wave = wave;
        this.ambushWave(id);
      });
      return;
    }
    this.ambushes.delete(id);
    if (this.area !== am.area) return;
    this.emit({ type: 'announce', text: 'Curse Broken', sub: 'The shrine gives up its hoard', color: '#9fd8ff' });
    this.sound('quest');
    this.fx({ kind: 'shrine', x: am.x, y: am.y, dur: 1.2 });
    const mlvl = this.mlvl(am.area.def);
    this.spawnDrops(am.x, am.y, mlvl, 'unique');
    this.spawnDrops(am.x, am.y, mlvl, 'chest');
    this.spawnDrops(am.x, am.y, mlvl, 'chest');
    this.addOrb(am.x, am.y, 'life');
    this.addOrb(am.x, am.y, 'mana');
    this.checkPurge();
  }

  // ---------------------------------------------------------------- elites, shrines, purges

  /** Extra tricks from an elite's modifiers. Returns true if one of them used up its turn. */
  private eliteTricks(m: Monster, tgt: { x: number; y: number }, d: number): boolean {
    const l = this.area.level;
    if (m.mods.includes('teleport')) {
      if (m.blinkAt === undefined) m.blinkAt = this.time + 1.5;
      else if (m.blinkAt <= this.time && d > 3.5 && d < 13) {
        m.blinkAt = this.time + this.luck.range(4.5, 7);
        const ang = this.luck.range(0, TAU);
        const to = { x: tgt.x + Math.cos(ang) * 1.4, y: tgt.y + Math.sin(ang) * 1.4 };
        if (isWalkable(l, to.x, to.y) && lineOfSight(l, to, tgt)) {
          this.fx({ kind: 'teleport', x: m.x, y: m.y, dur: 0.4 });
          m.x = to.x;
          m.y = to.y;
          this.fx({ kind: 'teleport', x: m.x, y: m.y, dur: 0.4 });
          this.sound('portal');
          // A beat to react before it swings.
          m.atkCd = Math.max(m.atkCd, 0.5);
          return true;
        }
      }
    }
    if (m.mods.includes('mortar')) {
      if (m.mortarAt === undefined) m.mortarAt = this.time + 1.2;
      else if (m.mortarAt <= this.time && d < 10 && lineOfSight(l, m, tgt)) {
        m.mortarAt = this.time + 3.6;
        for (let i = 0; i < 2; i++) {
          const x = tgt.x + (i ? this.luck.range(-2, 2) : 0);
          const y = tgt.y + (i ? this.luck.range(-2, 2) : 0);
          const delay = 1.15 + i * 0.3;
          this.area.hazards.push({
            x, y, t: 0, delay, dur: 0.9, radius: 1.5, dmg: elemDamage('fire', (m.dmgMin + m.dmgMax) * 0.6), owner: 'monster',
            burnDps: m.dmgMax * 0.2, srcLevel: m.level, fired: false, quiet: true,
          });
          this.fx({ kind: 'meteor_mark', x, y, dur: delay, r: 1.5 });
        }
        this.sound('fire');
      }
    }
    return false;
  }

  /** The Storm Shrine: lightning leaps from the hero to whatever is near, and on from there. */
  private stormShrine(dt: number) {
    this.stormShrineT -= dt;
    if (this.stormShrineT > 0 || this.inTown) return;
    this.stormShrineT = 0.8;
    const p = this.player;
    const m = this.monstersNear(p.x, p.y, 7).find((x) => lineOfSight(this.area.level, p, x));
    if (!m) return;
    this.fx({ kind: 'chain', x: p.x, y: p.y, dur: 0.25, pts: [{ x: p.x, y: p.y }, { x: m.x, y: m.y }] });
    this.chainLightning(m, 2, elemDamage('light', (6 + this.char.level * 3.2) * this.luck.range(0.7, 1.3)));
  }

  /** Killing everything in an area pays out once: experience, and a pile of loot at the hero's feet. */
  private checkPurge() {
    const a = this.area;
    if (a.def.town || a.purged) return;
    if (a.monsters.some((m) => !m.dead && !m.thief)) return;
    // Not while an ambush has waves to come, or while the Embalmed Dead are still due to get back up.
    for (const am of this.ambushes.values()) if (am.area === a) return;
    if (a.monsters.some((m) => m.def.rises && !m.rose && !m.summoned && !m.used && m.deathKind !== 'burn')) return;
    a.purged = true;
    const c = this.char;
    c.purges = (c.purges ?? 0) + 1;
    this.emit({ type: 'announce', text: 'Area Purged', sub: `${a.def.name} lies silent`, color: '#9fe08a' });
    this.sound('quest');
    const gained = addXp(c, (xpForLevel(c.level + 1) - xpForLevel(c.level)) * 0.08);
    if (gained) this.levelUp();
    this.addTimer(0.7, () => {
      if (this.area !== a) return;
      const p = this.player;
      this.fx({ kind: 'coins', x: p.x, y: p.y, dur: 1.1, r: 2 });
      this.spawnDrops(p.x, p.y, this.mlvl(a.def), 'unique');
      this.spawnDrops(p.x, p.y, this.mlvl(a.def), 'chest');
    });
  }

  // ---------------------------------------------------------------- movement

  /** Axis-separated movement against walls. Returns false if fully blocked. */
  moveEntity(e: { x: number; y: number }, dx: number, dy: number, r: number): boolean {
    const l = this.area.level;
    const free = (x: number, y: number) =>
      isWalkable(l, x - r, y - r) && isWalkable(l, x + r, y - r) && isWalkable(l, x - r, y + r) && isWalkable(l, x + r, y + r);
    let moved = false;
    if (dx && free(e.x + dx, e.y)) (e.x += dx), (moved = true);
    if (dy && free(e.x, e.y + dy)) (e.y += dy), (moved = true);
    return moved;
  }

  // ---------------------------------------------------------------- queries for the UI

  get xpProgress(): number {
    const c = this.char;
    const lo = xpForLevel(c.level);
    const hi = xpForLevel(c.level + 1);
    return hi > lo ? (c.xp - lo) / (hi - lo) : 1;
  }

  focusMonster(): Monster | null {
    if (this.focusT <= 0) return null;
    const m = this.area.monsters.find((x) => x.id === this.focusId);
    return m && !m.dead ? m : null;
  }

  /**
   * The last few monsters in an area, once five or fewer are left, so that finishing it off is not a hunt in the dark.
   * In the Hollow Cave this is the quest's own list.
   */
  stragglers(): Monster[] {
    const a = this.area;
    if (a.def.quest === 'hollow' && this.questState('hollow') === 'active') return this.questStrays();
    if (a.def.town || a.purged) return [];
    const alive = a.monsters.filter((m) => !m.dead && !m.thief);
    if (alive.length <= 5) return alive;
    // An Underforge warden shows once the hero is near enough to hear it, so the stairs can be found.
    const warden = this.wardenAlive();
    return warden && Math.hypot(warden.x - this.player.x, warden.y - this.player.y) < 22 ? [warden] : [];
  }

  /** The current spree rank, if the run of kills has reached one. */
  spreeTier() {
    return this.streak.tier >= 0 ? SPREE_TIERS[this.streak.tier] : null;
  }

  groundLabel(g: GroundItem): { text: string; color: string } {
    if (g.gold) return { text: `${g.gold} Gold`, color: '#e8e2d0' };
    return { text: displayName(g.item!), color: itemColor(g.item!) };
  }

  classDef() {
    return CLASSES[this.char.classId];
  }
}

/** How far a monster's claws reach. A Hearth-Eater's long range is for drinking, not striking. */
function meleeRange(m: Monster) {
  return m.def.ai === 'eater' ? 0.5 : m.def.range;
}

function setTimeoutSim(w: World, t: number, fn: () => void) {
  if (t <= 0) fn();
  else w.addTimer(t, fn);
}

export function elemDamage(el: Element, amount: number): Damage {
  const d: Damage = { phys: 0, fire: 0, cold: 0, light: 0, poison: 0 };
  d[el] = amount;
  return d;
}

/** The damage type that dealt most of the killing blow decides the death. */
export function deathKindOf(d: Damage, res: Resists, overkill: boolean): DeathKind {
  const parts = {
    phys: d.phys * (1 - res.phys / 100), fire: d.fire * (1 - res.fire / 100), cold: d.cold * (1 - res.cold / 100), light: d.light * (1 - res.light / 100),
  };
  const top = (Object.entries(parts) as [keyof typeof parts, number][]).sort((a, b) => b[1] - a[1])[0];
  if (top[1] <= 0) return 'normal';
  if (top[0] === 'cold') return 'shatter';
  if (top[0] === 'fire') return 'burn';
  if (top[0] === 'light') return 'shock';
  return overkill ? 'gib' : 'normal';
}

function elemColor(d: Damage): string {
  if (d.fire > d.cold && d.fire > d.light) return '#ff8030';
  if (d.cold > d.light) return '#90d8ff';
  if (d.light > 0) return '#e8f0ff';
  return '#b01010';
}

export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

