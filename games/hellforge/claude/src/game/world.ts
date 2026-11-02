import { AREA_BY_ID, DIFFICULTY_LEVELS, QUEST_BY_ID, WAYPOINT_AREAS, type AreaDef } from './areas';
import {
  addToBelt, addToGrid, addToInventory, addXp, CLASSES, computeStats, equipFromInventory, INV_COLS, INV_ROWS,
  removeFromGrid, skillLevel, STASH_COLS, STASH_ROWS, takeFromBelt, unequip, xpForLevel, xpMultiplier,
  type Buffs, type Character, type Stats,
} from './character';
import { applyResists, hitChance, reducePhysical, roll, type Damage } from './combat';
import {
  baseOf, buyPrice, displayName, gamble, gamblePrice, generateItem, itemColor, makeItem, potionFor, rollDrops,
  sellPrice, type DropTier, type Item, type ItemKind, type Slot,
} from './items';
import { floodDistances, generateLevel, idx, isWalkable, nearestFloor, type Level, type Point } from './map';
import {
  MONSTERS, monsterStats, rollUniqueMods, uniqueName, type MonsterDef, type MonsterRarity, type Resists, type UniqueMod,
} from './monsters';
import { FlowField, findPath, lineOfSight } from './path';
import { hashSeed, Rng } from './rng';
import { SKILL_BY_ID, synergyBonus, type Element, type SkillDef, type SkillParams } from './skills';

export type SoundId =
  | 'swing' | 'hit' | 'miss' | 'death' | 'hurt' | 'gold' | 'item' | 'unique' | 'potion' | 'levelup' | 'fire' | 'cold'
  | 'light' | 'bow' | 'portal' | 'nova' | 'block' | 'shrine' | 'chest' | 'boom' | 'nomana' | 'roar' | 'quest' | 'step';

export type Panel = 'healer' | 'smith' | 'sage' | 'fence' | 'stash' | 'waypoint';

export type GameEvent =
  | { type: 'sound'; id: SoundId }
  | { type: 'msg'; text: string; color?: string }
  | { type: 'levelup'; level: number }
  | { type: 'open'; panel: Panel }
  | { type: 'death' }
  | { type: 'area'; id: string }
  | { type: 'quest'; id: string }
  | { type: 'victory' }
  | { type: 'shake'; amount: number };

export type FxKind =
  | 'blood' | 'spark' | 'nova' | 'explosion' | 'chain' | 'meteor_mark' | 'burn' | 'teleport' | 'levelup' | 'heal'
  | 'shrine' | 'text' | 'shout' | 'revive' | 'whirl' | 'slam' | 'portal_open';

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
}

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
  action: { t: number; hitAt: number; dur: number; done: boolean; kind: 'melee' | 'shoot' | 'cast' } | null;
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
}

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
  chains?: { n: number; dmg: Damage };
  wobble?: boolean;
  hit: Set<number>;
  srcId?: number;
}

export interface GroundItem {
  id: number;
  x: number;
  y: number;
  item?: Item;
  gold?: number;
  t: number;
}

export interface WorldObject {
  id: number;
  x: number;
  y: number;
  kind: 'chest' | 'barrel' | 'shrine';
  used: boolean;
  shrine?: ShrineKind;
}

export type ShrineKind = 'armor' | 'combat' | 'refill' | 'experience';
const SHRINE_NAMES: Record<ShrineKind, string> = {
  armor: 'Armor Shrine', combat: 'Combat Shrine', refill: 'Refilling Shrine', experience: 'Experience Shrine',
};

export type NpcKind = 'healer' | 'smith' | 'sage' | 'fence';
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
};

interface Hazard {
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
}

export interface AreaState {
  def: AreaDef;
  level: Level;
  monsters: Monster[];
  ground: GroundItem[];
  projectiles: Projectile[];
  objects: WorldObject[];
  npcs: Npc[];
  hazards: Hazard[];
  fx: Fx[];
  explored: Uint8Array;
  flow: FlowField;
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
  | { kind: 'portal' }
  | { kind: 'exit'; index: number };

interface PlayerAction {
  kind: 'melee' | 'shoot' | 'cast' | 'leap' | 'whirl';
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

export class World {
  char: Character;
  stats!: Stats;
  rng: Rng;
  seed: number;
  areas = new Map<string, AreaState>();
  area!: AreaState;
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

  constructor(char: Character, seed = Date.now() >>> 0) {
    this.char = char;
    this.seed = seed;
    this.rng = new Rng(hashSeed(seed, 'world'));
    this.player = {
      x: 0, y: 0, life: 1, mana: 1, facing: Math.PI / 4, moving: false, walk: 0, path: [], pathT: 0, moveDir: null,
      intent: null, action: null, heal: [], buffs: {}, frenzy: { stacks: 0, t: 0 }, invuln: 0, dead: false, chill: 0,
      poison: { dps: 0, t: 0 }, hurt: 0, xpBonus: 0,
    };
    this.refreshStats();
    this.player.life = this.stats.maxLife;
    this.player.mana = this.stats.maxMana;
    this.enterArea('town', 'start');
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

  floatText(x: number, y: number, text: string, color: string) {
    this.fx({ kind: 'text', x, y, dur: 0.9, text, color });
  }

  get inTown() {
    return this.area.def.id === 'town';
  }

  get difficulty() {
    return this.char.difficulty;
  }

  wpKey(area: string) {
    return `${this.char.difficulty}:${area}`;
  }

  questState(id: string) {
    return this.char.quests[this.wpKey(id)] ?? 'none';
  }

  setQuest(id: string, s: 'active' | 'done' | 'rewarded') {
    this.char.quests[this.wpKey(id)] = s;
    this.emit({ type: 'quest', id });
  }

  buffTotals(): Buffs {
    const b: Buffs = {};
    const p = this.player.buffs;
    const add = (k: keyof Buffs, v: number) => (b[k] = (b[k] ?? 0) + v);
    if (p.battle_shout) add('lifePct', p.battle_shout.p.pct!), add('manaPct', p.battle_shout.p.pct!), add('defPct', p.battle_shout.p.pct2!);
    if (p.frost_shell) add('defPct', p.frost_shell.p.pct!);
    if (p.shrine_armor) add('defPct', 100);
    if (p.shrine_combat) add('edPct', 80), add('ar', 150);
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
    const def = AREA_BY_ID[id];
    const rng = new Rng(hashSeed(this.seed, id, this.char.difficulty));
    const level = generateLevel(def.spec, rng);
    const a: AreaState = {
      def, level, monsters: [], ground: [], projectiles: [], objects: [], npcs: [], hazards: [], fx: [],
      explored: new Uint8Array(level.w * level.h), flow: new FlowField(level, 26),
    };
    for (const o of level.objects) {
      const obj: WorldObject = { id: this.id(), x: o.x + 0.5, y: o.y + 0.5, kind: o.kind, used: false };
      if (o.kind === 'shrine') obj.shrine = rng.pick(['armor', 'combat', 'refill', 'experience'] as const);
      a.objects.push(obj);
    }
    if (id === 'town') {
      for (const k of ['healer', 'smith', 'sage', 'fence'] as NpcKind[]) {
        const s = level.spots[k];
        a.npcs.push({ id: this.id(), kind: k, ...NPC_INFO[k], x: s.x + 0.5, y: s.y + 0.5, facing: Math.PI / 2 });
      }
    } else {
      this.populate(a, rng);
    }
    this.areas.set(id, a);
    return a;
  }

  private mlvl(def: AreaDef) {
    return def.alvl + DIFFICULTY_LEVELS[this.char.difficulty];
  }

  spawnMonster(a: AreaState, defId: string, x: number, y: number, rarity: MonsterRarity, opts: { mods?: UniqueMod[]; name?: string; packId?: number; level?: number; superId?: string } = {}): Monster {
    const def = MONSTERS[defId];
    const level = opts.level ?? this.mlvl(a.def);
    const st = monsterStats(def, level, rarity, opts.mods, this.char.difficulty);
    const m: Monster = {
      id: this.id(), def, x, y, life: st.life, maxLife: st.life, level, dmgMin: st.dmgMin, dmgMax: st.dmgMax, ar: st.ar,
      def_: st.def, res: st.res, speed: st.speed, xp: st.xp, rarity, name: opts.name ?? def.name, mods: opts.mods ?? [],
      alert: false, homeX: x, homeY: y, wanderT: this.rng.range(1, 4), wanderTo: null, atkCd: 0.5, action: null,
      abilityCd: this.rng.range(2, 4), chill: 0, stun: 0, poison: { dps: 0, t: 0 }, fleeT: 0, knock: { x: 0, y: 0 },
      dead: false, deadT: 0, packId: opts.packId ?? 0, facing: this.rng.range(0, TAU), walk: 0, flash: 0, revived: 0,
      superId: opts.superId,
    };
    a.monsters.push(m);
    return m;
  }

  private populate(a: AreaState, rng: Rng) {
    const def = a.def;
    const l = a.level;
    const spots = rng.shuffle(l.spawns.slice());
    let packId = 1;
    const occupied = new Set<number>();
    const place = (cx: number, cy: number) => {
      const p = nearestFloor(l, { x: cx + rng.range(-1.5, 1.5), y: cy + rng.range(-1.5, 1.5) }, (x, y) => occupied.has(idx(l, x, y)));
      occupied.add(idx(l, p.x, p.y));
      return { x: p.x + 0.5, y: p.y + 0.5 };
    };
    if (def.superUnique) {
      const sd = MONSTERS[def.superUnique];
      const spot = l.spots.boss ?? spots.pop() ?? l.start;
      const isBoss = def.superUnique === 'mother';
      const boss = this.spawnMonster(a, sd.id, spot.x + 0.5, spot.y + 0.5, 'boss', {
        packId, superId: sd.id, level: this.mlvl(def) + (isBoss ? 1 : 2), mods: isBoss ? [] : def.superUnique === 'glutton' ? ['strong'] : ['extraLife'],
      });
      boss.name = sd.name;
      const escort = { glutton: 'ghoul', bishop: 'skeleton', warden: 'skeleton', mother: 'imp' }[sd.id] ?? 'imp';
      for (let i = 0; i < 4; i++) {
        const p = place(spot.x, spot.y);
        this.spawnMonster(a, escort, p.x, p.y, 'minion', { packId, name: `${MONSTERS[escort].name}` });
      }
      if (sd.id === 'mother') for (let i = 0; i < 2; i++) {
        const p = place(spot.x, spot.y);
        this.spawnMonster(a, 'hexer', p.x, p.y, 'minion', { packId });
      }
      packId++;
    }
    for (let i = 0; i < def.packs && spots.length; i++) {
      const s = spots.pop()!;
      const type = rng.pick(def.monsters);
      const roll = rng.next();
      if (roll < 0.06) {
        const mods = rollUniqueMods(rng, this.char.difficulty + 1 + (rng.chance(0.4) ? 1 : 0));
        const p = place(s.x, s.y);
        this.spawnMonster(a, type, p.x, p.y, 'unique', { mods, name: uniqueName(rng), packId });
        for (let k = 0; k < rng.int(2, 4); k++) {
          const q = place(s.x, s.y);
          this.spawnMonster(a, type, q.x, q.y, 'minion', { packId });
        }
      } else if (roll < 0.15) {
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
      } else {
        const n = type === 'brute' ? rng.int(1, 3) : rng.int(3, 6);
        for (let k = 0; k < n; k++) {
          const q = place(s.x, s.y);
          this.spawnMonster(a, type, q.x, q.y, 'normal', { packId });
        }
      }
      packId++;
    }
  }

  /** Moves the player to an area. `via` decides where they appear. */
  enterArea(id: string, via: 'start' | 'exit' | 'waypoint' | 'portal', fromId?: string) {
    const prev = this.area;
    if (prev) prev.projectiles.length = 0;
    const a = this.getArea(id);
    this.area = a;
    const l = a.level;
    let pos: Point = l.start;
    if (via === 'exit' && fromId) {
      const ex = l.exits.find((e) => e.to === fromId);
      if (ex) pos = this.arrivalNear(l, ex);
    } else if (via === 'waypoint' && l.waypoint) {
      pos = nearestFloor(l, { x: l.waypoint.x, y: l.waypoint.y + 1 });
    } else if (via === 'portal') {
      if (id === 'town') {
        const s = this.townPortalSpot();
        pos = nearestFloor(l, { x: s.x, y: s.y + 2 });
      }
      else if (this.portal) pos = nearestFloor(l, { x: this.portal.x + 1, y: this.portal.y });
    } else if (id !== 'town') {
      pos = this.arrivalNear(l, l.start);
    }
    const p = this.player;
    p.x = Math.floor(pos.x) + 0.5;
    p.y = Math.floor(pos.y) + 0.5;
    p.path = [];
    p.intent = null;
    p.action = null;
    p.invuln = 1.2;
    a.flow.update(p.x, p.y);
    this.markExplored(true);
    if (id === 'town') this.restockVendors();
    if (a.def.quest && this.questState(a.def.quest) === 'none') this.setQuest(a.def.quest, 'active');
    this.emit({ type: 'area', id });
    this.msg(a.def.name, '#e8d9a8');
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
    const l = this.getArea('town').level;
    const wp = l.waypoint!;
    return { x: wp.x + 3, y: wp.y + 1 };
  }

  restockVendors() {
    const clvl = this.char.level;
    const rng = this.rng;
    const ilvl = Math.max(1, Math.min(clvl + 2, this.mlvl(AREA_BY_ID.hellforge) + 3));
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
    const self = ['buff', 'nova'].includes(def.kind);
    if (self) return this.cmdSkill(skill, p.x, p.y);
    const range = def.kind === 'teleport' ? 0 : this.isMeleeSkill(def) ? 5 : 11;
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
      if (m.dead) continue;
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
        return o ? (o.kind === 'shrine' ? SHRINE_NAMES[o.shrine!] : o.kind === 'chest' ? 'Chest' : 'Barrel') : '';
      }
      case 'npc': {
        const n = a.npcs.find((x) => x.id === t.id);
        return n ? n.name : '';
      }
      case 'waypoint':
        return 'Waypoint';
      case 'stash':
        return 'Stash';
      case 'portal':
        return this.inTown ? `Town Portal (${AREA_BY_ID[this.portal!.area].name})` : 'Town Portal';
      case 'exit':
        return a.level.exits[t.index]?.label ?? '';
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
    push({ kind: 'portal' }, this.portalPos(), -0.2);
    a.level.exits.forEach((_, i) => push({ kind: 'exit', index: i }, this.interactPos({ kind: 'exit', index: i }), 0.3));
    return out.sort((p, q) => p.d - q.d);
  }

  /** Best thing under a world-space click: monsters first, then interactables. */
  pickAt(x: number, y: number): { monster?: Monster; target?: Interactable } {
    let best: Monster | undefined;
    let bd = Infinity;
    for (const m of this.area.monsters) {
      if (m.dead) continue;
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
      case 'portal':
        this.takePortal();
        break;
      case 'exit': {
        const e = a.level.exits[t.index];
        if (e) this.enterArea(e.to, 'exit', a.def.id);
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
    return WAYPOINT_AREAS.map((id) => ({ id, name: AREA_BY_ID[id].name, active: this.char.waypoints.includes(this.wpKey(id)) }));
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
      this.enterArea('town', 'portal');
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
    if (b.kind === 'potion' && addToBelt(this.char, b.id)) {
      this.sound('potion');
      a.ground.splice(a.ground.indexOf(g), 1);
      return;
    }
    if (!addToInventory(this.char, it)) {
      this.msg('Inventory is full', '#ff8a6a', 'invfull');
      return;
    }
    this.sound('item');
    a.ground.splice(a.ground.indexOf(g), 1);
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
    const drops = rollDrops(this.rng, mlvl, tier, { mf: this.stats.mf, gf: this.stats.gf, classId: this.char.classId });
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
        else if (d.item.rarity === 'rare') this.sound('item');
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

  usePotion(col: number): boolean {
    if (this.player.dead) return false;
    const id = takeFromBelt(this.char, col);
    if (!id) return false;
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
    else if (!(b.kind === 'potion' && addToBelt(this.char, b.id)) && !addToInventory(this.char, copy)) return 'Inventory is full';
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
    if (this.questState('forge') === 'done') {
      this.setQuest('forge', 'rewarded');
      c.maxDifficulty = Math.max(c.maxDifficulty, Math.min(2, c.difficulty + 1));
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
    this.focusT -= dt;
    this.runTimers(dt);
    this.updatePlayer(dt);
    a.flow.update(this.player.x, this.player.y);
    this.updateMonsters(dt);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.exploreT -= dt;
    if (this.exploreT <= 0) {
      this.exploreT = 0.2;
      this.markExplored(false);
    }
  }

  private markExplored(force: boolean) {
    const a = this.area;
    const l = a.level;
    const r = Math.ceil(a.def.light + 2);
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    if (!force && a.def.id === 'town') return;
    for (let y = py - r; y <= py + r; y++)
      for (let x = px - r; x <= px + r; x++) {
        if (x < 0 || y < 0 || x >= l.w || y >= l.h) continue;
        if ((x - px) ** 2 + (y - py) ** 2 <= r * r) a.explored[y * l.w + x] = 1;
      }
    if (a.def.id === 'town') a.explored.fill(1);
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const st = this.stats;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurt > 0) p.hurt -= dt;
    if (p.dead) return;

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

    if (p.action) {
      this.updateAction(dt);
      return;
    }

    const speed = st.moveSpeed * (p.chill > 0 ? 0.6 : 1);
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
          if ((b.kind === 'scroll' && this.char.tpCharges < 20) || (b.kind === 'potion' && addToBelt(this.char, b.id))) {
            if (b.kind === 'scroll') this.char.tpCharges++;
            this.sound('potion');
            a.ground.splice(a.ground.indexOf(g), 1);
          }
        }
      }
    }
    if (a.level.waypoint && Math.hypot(a.level.waypoint.x + 0.5 - p.x, a.level.waypoint.y + 0.5 - p.y) < 1.4) this.activateWaypoint();
  }

  private checkExits() {
    const p = this.player;
    if (p.invuln > 0.6) return;
    const a = this.area;
    for (const e of a.level.exits) {
      if (Math.hypot(e.x + 0.5 - p.x, e.y + 0.5 - p.y) < 0.75) {
        this.enterArea(e.to, 'exit', a.def.id);
        return;
      }
    }
    const pp = this.portalPos();
    if (pp && p.intent?.kind !== 'interact' && Math.hypot(pp.x - p.x, pp.y - p.y) < 0.5) this.takePortal();
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
      const reach = it.target.kind === 'npc' ? 1.6 : it.target.kind === 'exit' ? 0.7 : 1.1;
      if (Math.hypot(pos.x - p.x, pos.y - p.y) <= reach) {
        p.intent = null;
        p.path = [];
        this.doInteract(it.target);
        return;
      }
      if (!this.followPath(dt, speed, pos)) {
        if (p.pathT <= 0) this.repath(pos.x, pos.y);
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
    // Ranged skills need line of sight to their target.
    if (target && !melee && !lineOfSight(this.area.level, p, target) && def.kind !== 'teleport') {
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
    if (def.kind === 'attack' || def.kind === 'multishot' || def.kind === 'strafe') {
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
    if (act.kind === 'melee') {
      const target = act.targetId !== undefined ? this.area.monsters.find((m) => m.id === act.targetId && !m.dead) : undefined;
      const victims = target ? [target] : this.monstersNear(p.x + Math.cos(ang) * 0.7, p.y + Math.sin(ang) * 0.7, 0.9).slice(0, 1);
      for (const m of victims) {
        if (Math.hypot(m.x - p.x, m.y - p.y) > m.def.radius + this.stats.range + 0.6) continue;
        this.playerWeaponHit(m, def, pr, { knock: def.id === 'bash' ? 1.2 : 0 });
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
    switch (def.kind) {
      case 'projectile': {
        const kind = def.id === 'fire_bolt' ? 'firebolt' : def.id === 'ice_bolt' ? 'icebolt' : 'fireball';
        this.spawnProjectile({
          x: p.x, y: p.y, ang, speed: def.id === 'fireball' ? 9 : 11, ttl: 1.3, owner: 'player', dmg: spellDmg(), kind,
          radius: 0.35, explode: pr.radius, chill: pr.chill, srcLevel: this.char.level,
        });
        this.sound(el === 'cold' ? 'cold' : 'fire');
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
        this.fx({ kind: el === 'cold' ? 'nova' : 'shout', x: p.x, y: p.y, dur: 0.45, r: pr.radius, color: el === 'cold' ? '#a8e8ff' : '#f0d070' });
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
        this.fx({ kind: def.id === 'frost_shell' ? 'nova' : 'shout', x: p.x, y: p.y, dur: 0.6, r: 1.6, color: def.id === 'frost_shell' ? '#bfefff' : '#ffe080' });
        this.sound(def.id === 'frost_shell' ? 'cold' : 'roar');
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
    return { dmg, crit };
  }

  private playerWeaponHit(m: Monster, def: SkillDef, pr: SkillParams, opts: { knock?: number }) {
    const p = this.player;
    const { dmg, crit } = this.weaponDamage(def, pr);
    const hit = this.damageMonster(m, dmg, {
      ar: this.stats.ar * (1 + (pr.arPct ?? 0) / 100), crit, leech: true,
      knock: opts.knock ? { x: m.x - p.x, y: m.y - p.y, f: opts.knock } : undefined,
    });
    if (hit) {
      this.sound('hit');
      if (def.id === 'frenzy') {
        p.frenzy.stacks = Math.min(4, p.frenzy.stacks + 1);
        p.frenzy.t = pr.duration!;
        this.refreshStats();
      }
    } else {
      this.sound('miss');
    }
  }

  monstersNear(x: number, y: number, r: number): Monster[] {
    return this.area.monsters
      .filter((m) => !m.dead && Math.hypot(m.x - x, m.y - y) <= r + m.def.radius)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  }

  spawnProjectile(o: {
    x: number; y: number; ang: number; speed: number; ttl: number; owner: 'player' | 'monster'; dmg: Damage; kind: string;
    radius: number; ar?: number; pierce?: boolean; explode?: number; chill?: number; chains?: Projectile['chains']; wobble?: boolean;
    srcLevel: number; srcId?: number;
  }) {
    this.area.projectiles.push({
      id: this.id(), x: o.x + Math.cos(o.ang) * 0.3, y: o.y + Math.sin(o.ang) * 0.3, vx: Math.cos(o.ang) * o.speed, vy: Math.sin(o.ang) * o.speed,
      ttl: o.ttl, owner: o.owner, dmg: o.dmg, radius: o.radius, kind: o.kind, ar: o.ar, pierce: o.pierce, explode: o.explode,
      chill: o.chill, chains: o.chains, wobble: o.wobble, hit: new Set(), srcLevel: o.srcLevel, srcId: o.srcId,
    });
  }

  // ---------------------------------------------------------------- damage

  damageMonster(m: Monster, d: Damage, o: { ar?: number; chill?: number; stun?: number; knock?: { x: number; y: number; f: number }; crit?: boolean; leech?: boolean } = {}): boolean {
    if (m.dead) return false;
    this.alertPack(m);
    if (o.ar !== undefined && !this.rng.chance(hitChance(o.ar, m.def_, this.char.level, m.level))) {
      this.floatText(m.x, m.y, 'Miss', '#9a9a9a');
      return false;
    }
    const { total, poison } = applyResists(d, m.res);
    if (poison > 0 && poison / 3 >= m.poison.dps * 0.9) m.poison = { dps: poison / 3, t: 3 };
    if (d.cold > 0 && m.res.cold < 100) m.chill = Math.max(m.chill, o.chill ?? 1.5);
    if (o.stun && m.rarity !== 'boss') m.stun = Math.max(m.stun, o.stun);
    if (o.knock && m.rarity !== 'boss') {
      const len = Math.hypot(o.knock.x, o.knock.y) || 1;
      m.knock = { x: (o.knock.x / len) * o.knock.f * 8, y: (o.knock.y / len) * o.knock.f * 8 };
    }
    m.life -= total;
    m.flash = 0.12;
    this.setFocus(m);
    if (total > 0) {
      this.fx({ kind: d.phys > 0 ? 'blood' : 'spark', x: m.x, y: m.y, dur: 0.35, color: elemColor(d) });
      this.floatText(m.x, m.y, String(Math.round(total)), o.crit ? '#ffd040' : '#ffffff');
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
    if (m.life <= 0) this.killMonster(m);
    return true;
  }

  private alertPack(m: Monster) {
    if (m.alert) return;
    m.alert = true;
    for (const o of this.area.monsters) if (o.packId === m.packId && !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < 10) o.alert = true;
  }

  private killMonster(m: Monster) {
    const a = this.area;
    m.dead = true;
    m.life = 0;
    m.deadT = 0;
    m.action = null;
    this.sound('death');
    const mult = xpMultiplier(m.level, this.char.level) * (1 + this.player.xpBonus / 100);
    const gained = addXp(this.char, m.xp * mult);
    if (gained) this.levelUp();
    const p = this.player;
    p.life = Math.min(this.stats.maxLife, p.life + this.stats.lifeOnKill);
    p.mana = Math.min(this.stats.maxMana, p.mana + this.stats.manaOnKill);
    const tier: DropTier = m.rarity === 'boss' ? 'boss' : m.rarity === 'unique' ? 'unique' : m.rarity === 'champion' ? 'champion' : 'normal';
    if (!m.summoned) this.spawnDrops(m.x, m.y, m.level, tier);
    if (m.mods.includes('fireEnch')) {
      this.fx({ kind: 'explosion', x: m.x, y: m.y, dur: 0.5, r: 2 });
      this.sound('boom');
      if (Math.hypot(p.x - m.x, p.y - m.y) < 2.2) this.damagePlayer(elemDamage('fire', (m.dmgMin + m.dmgMax) * 0.8), { level: m.level });
    }
    if (m.def.flees || m.def.id === 'imp') {
      // Imps lose their nerve when a packmate falls.
      for (const o of a.monsters) if (!o.dead && o.def.flees && Math.hypot(o.x - m.x, o.y - m.y) < 6 && this.rng.chance(0.7)) o.fleeT = this.rng.range(1.5, 3);
    }
    if (m.superId && a.def.quest && (m.superId === 'bishop' || m.superId === 'mother')) {
      if (this.questState(a.def.quest) !== 'rewarded' && this.questState(a.def.quest) !== 'done') {
        this.setQuest(a.def.quest, 'done');
        this.msg(`${m.name} has been slain!`, '#e8c860');
        this.sound('quest');
        if (m.superId === 'mother') {
          this.char.maxDifficulty = Math.max(this.char.maxDifficulty, Math.min(2, this.char.difficulty + 1));
          this.emit({ type: 'victory' });
        }
      }
    }
    if (a.def.quest === 'hollow' && this.questState('hollow') === 'active' && a.monsters.every((x) => x.dead)) {
      this.setQuest('hollow', 'done');
      this.msg('The Hollow Cave has been cleansed! Return to Old Corvin.', '#e8c860');
      this.sound('quest');
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

  damagePlayer(d: Damage, o: { ar?: number; level: number; melee?: boolean; source?: Monster; missile?: boolean }) {
    const p = this.player;
    if (p.dead || p.invuln > 0) return;
    const st = this.stats;
    if (o.ar !== undefined && !this.rng.chance(hitChance(o.ar, st.def, o.level, this.char.level))) return;
    if ((o.melee || o.missile) && st.evade > 0 && this.rng.chance(st.evade / 100)) {
      this.floatText(p.x, p.y, 'Evade', '#9bd39b');
      return;
    }
    if (o.ar !== undefined && st.block > 0 && this.rng.chance(st.block / 100)) {
      this.floatText(p.x, p.y, 'Block', '#d8d8d8');
      this.sound('block');
      return;
    }
    const res: Resists = { phys: 0, fire: st.res.fire, cold: st.res.cold, light: st.res.light, poison: st.res.poison };
    const dd = { ...d, phys: d.phys > 0 ? reducePhysical(d.phys, st.dmgReduce) : 0 };
    const { total, poison } = applyResists(dd, res);
    if (poison > 0) p.poison = { dps: poison / 4, t: 4 };
    if (d.cold > 0) p.chill = 1.5;
    p.life -= total;
    p.hurt = 0.25;
    if (total >= 1) this.floatText(p.x, p.y, String(Math.round(total)), '#ff5050');
    if (total > st.maxLife * 0.08) this.sound('hurt');
    const src = o.source;
    if (src && o.melee) {
      if (st.thorns > 0) this.damageMonster(src, { phys: st.thorns, fire: 0, cold: 0, light: 0, poison: 0 });
      if (p.buffs.frost_shell) src.chill = Math.max(src.chill, 2);
      if (src.mods.includes('vampiric')) src.life = Math.min(src.maxLife, src.life + total * 0.5);
      if (src.mods.includes('coldEnch')) p.chill = 2;
    }
    if (p.life <= 0) this.die();
  }

  private die() {
    const p = this.player;
    p.life = 0;
    p.dead = true;
    p.action = null;
    p.intent = null;
    p.path = [];
    this.sound('death');
    this.emit({ type: 'death' });
    if (this.char.hardcore) this.char.dead = true;
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
    p.frenzy = { stacks: 0, t: 0 };
    p.poison.t = 0;
    p.heal = [];
    this.refreshStats();
    p.life = this.stats.maxLife;
    p.mana = this.stats.maxMana;
    this.enterArea('town', 'start');
    if (lost) this.msg(`You lost ${lost} gold`, '#ff8a6a');
  }

  // ---------------------------------------------------------------- objects

  private useObject(o: WorldObject) {
    o.used = true;
    const p = this.player;
    const mlvl = this.mlvl(this.area.def);
    if (o.kind === 'shrine') {
      const k = o.shrine!;
      this.sound('shrine');
      this.fx({ kind: 'shrine', x: o.x, y: o.y, dur: 1 });
      this.msg(SHRINE_NAMES[k], '#9fd8ff');
      if (k === 'refill') {
        p.life = this.stats.maxLife;
        p.mana = this.stats.maxMana;
      } else {
        p.buffs[`shrine_${k}`] = { t: 90, p: {} };
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
      if (Math.abs(m.x - p.x) > 32 || Math.abs(m.y - p.y) > 32) continue;
      if (m.poison.t > 0) {
        m.poison.t -= dt;
        m.life -= m.poison.dps * dt;
        if (m.life <= 0) {
          this.killMonster(m);
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
      if (m.stun > 0) {
        m.stun -= dt;
        continue;
      }
      const slow = m.chill > 0 ? 0.5 : 1;
      m.atkCd -= dt * slow;
      m.abilityCd -= dt * slow;
      if (m.fleeT > 0) m.fleeT -= dt;
      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const d = Math.hypot(dx, dy);
      if (!m.alert && !safe) {
        const aggro = m.rarity === 'boss' ? 9 : 7.5;
        if (d < aggro && lineOfSight(l, m, p)) {
          this.alertPack(m);
          if (m.rarity === 'boss') this.sound('roar');
        }
      }
      if (m.action) {
        this.updateMonsterAction(m, dt * slow, d);
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
      const speed = m.speed * slow;
      if (m.fleeT > 0) {
        this.moveEntity(m, (-dx / d) * speed * dt, (-dy / d) * speed * dt, m.def.radius);
        m.facing = Math.atan2(-dy, -dx);
        m.walk += dt * speed;
        continue;
      }
      if (m.def.ai === 'boss' && m.abilityCd <= 0 && d < 11 && lineOfSight(l, m, p)) {
        this.bossAbility(m, d);
        continue;
      }
      const reach = m.def.radius + 0.3 + m.def.range;
      const ranged = m.def.ai === 'ranged' || m.def.ai === 'caster' || m.def.ai === 'hexer' || (m.def.ai === 'boss' && !!m.def.missile && d > 2.5);
      const los = d < 14 && lineOfSight(l, m, p);
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
      let tx = p.x;
      let ty = p.y;
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
    this.separate(a.monsters);
    a.monsters = a.monsters.filter((m) => !m.dead || m.deadT < 40);
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
        this.moveEntity(a, -ux * push, -uy * push, a.def.radius);
        this.moveEntity(b, ux * push, uy * push, b.def.radius);
      }
      // Monsters do not stand inside the player.
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const min = a.def.radius + 0.3;
      const d = Math.hypot(dx, dy);
      if (d < min && d > 0 && !p.dead) this.moveEntity(a, (dx / d) * (min - d), (dy / d) * (min - d), a.def.radius);
    }
  }

  private updateMonsterAction(m: Monster, dt: number, d: number) {
    const act = m.action!;
    const p = this.player;
    act.t += dt;
    if (!act.done && act.t >= act.hitAt) {
      act.done = true;
      if (act.kind === 'melee') {
        if (d <= m.def.radius + 0.3 + m.def.range + 0.5) {
          const dmg = elemDamage(m.def.element ?? 'phys', roll(this.rng, m.dmgMin, m.dmgMax));
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
        const ang = Math.atan2(p.y - m.y, p.x - m.x) + this.rng.range(-0.06, 0.06);
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
    const corpse = this.area.monsters.find((o) => o.dead && o.def.id === 'imp' && o.revived < 2 && o.deadT > 1.5 && o.deadT < 30 && Math.hypot(o.x - m.x, o.y - m.y) < 7);
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
    const abilities = m.def.abilities ?? [];
    const pick = this.rng.pick(abilities);
    const p = this.player;
    m.abilityCd = this.rng.range(4, 7);
    const dmg = (el: Element, k = 1) => elemDamage(el, roll(this.rng, m.dmgMin, m.dmgMax) * k);
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
      case 'summon_skeletons': {
        const kind = pick === 'summon_imps' ? 'imp' : 'skeleton';
        const alive = this.area.monsters.filter((o) => !o.dead && o.summoned && !o.def.abilities).length;
        if (alive >= 8) {
          m.abilityCd = 1;
          break;
        }
        for (let i = 0; i < 3; i++) {
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
          if (m.dead || pr.hit.has(m.id)) continue;
          if (Math.hypot(m.x - pr.x, m.y - pr.y) > m.def.radius + pr.radius) continue;
          pr.hit.add(m.id);
          if (pr.explode) {
            this.explode(pr);
            pr.ttl = 0;
            break;
          }
          const hit = this.damageMonster(m, pr.dmg, { ar: pr.ar, chill: pr.chill, leech: pr.ar !== undefined });
          if (hit && pr.chains) this.chainLightning(m, pr.chains.n, pr.chains.dmg);
          if (hit && pr.ar !== undefined) this.sound('hit');
          if (!pr.pierce) {
            pr.ttl = 0;
            break;
          }
        }
      } else if (!p.dead && Math.hypot(p.x - pr.x, p.y - pr.y) < 0.3 + pr.radius) {
        if (pr.explode) this.explode(pr);
        else this.damagePlayer(pr.dmg, { ar: pr.ar, level: pr.srcLevel, missile: true });
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
    } else if (Math.hypot(this.player.x - pr.x, this.player.y - pr.y) < r + 0.3) {
      this.damagePlayer(pr.dmg, { level: pr.srcLevel });
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
        this.fx({ kind: 'explosion', x: h.x, y: h.y, dur: 0.6, r: h.radius });
        this.emit({ type: 'shake', amount: 7 });
        this.sound('boom');
        if (h.owner === 'player') for (const m of this.monstersNear(h.x, h.y, h.radius)) this.damageMonster(m, h.dmg, {});
        else if (Math.hypot(p.x - h.x, p.y - h.y) < h.radius) this.damagePlayer(h.dmg, { level: h.srcLevel });
      }
      if (h.fired && h.t < h.delay + h.dur) {
        if (Math.floor((h.t - dt) * 4) !== Math.floor(h.t * 4)) {
          this.fx({ kind: 'burn', x: h.x + this.rng.range(-h.radius, h.radius) * 0.6, y: h.y + this.rng.range(-h.radius, h.radius) * 0.6, dur: 0.6 });
          const burn = elemDamage('fire', h.burnDps / 4);
          if (h.owner === 'player') for (const m of this.monstersNear(h.x, h.y, h.radius * 0.8)) this.damageMonster(m, burn, {});
          else if (Math.hypot(p.x - h.x, p.y - h.y) < h.radius * 0.8) this.damagePlayer(burn, { level: h.srcLevel });
        }
      }
    }
    a.hazards = a.hazards.filter((h) => h.t < h.delay + h.dur);
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

  groundLabel(g: GroundItem): { text: string; color: string } {
    if (g.gold) return { text: `${g.gold} Gold`, color: '#e8e2d0' };
    return { text: displayName(g.item!), color: itemColor(g.item!) };
  }

  classDef() {
    return CLASSES[this.char.classId];
  }
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

