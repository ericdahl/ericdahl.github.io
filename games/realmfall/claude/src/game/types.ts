import type { RealmId } from './geo';
import type { ClassId, MobDef, StatId, WeaponKind } from './data';
import type { Item, Slot } from './items';

export type Team = RealmId | -1;
export type Kind = 'player' | 'mob' | 'soldier' | 'guard' | 'lord' | 'door' | 'npc' | 'adventurer';
export type NpcRole = 'merchant' | 'teleporter' | 'healer' | 'taskmaster' | 'gatekeeper';

export interface Effect {
  type: 'stun' | 'root' | 'snare' | 'dot' | 'hot' | 'buff' | 'absorb' | 'focus' | 'taunt';
  name: string;
  until: number;
  start: number;
  value: number;
  stat?: 'dmg' | 'armor' | 'evade' | 'speed';
  src: number;
  nextTick?: number;
  perTick?: number;
}

export interface Weapon {
  kind: WeaponKind;
  dps: number;
  speed: number;
  range: number;
  ranged: boolean;
}

export interface Cast {
  ab: string;
  start: number;
  end: number;
  target: number;
  focus: boolean;
}

export interface AiState {
  mode: 'idle' | 'wander' | 'combat' | 'return' | 'flee' | 'march' | 'rest' | 'hunt';
  think: number; // next think time
  goal?: { x: number; z: number };
  wanderAt?: number;
  fled?: boolean;
  post?: { x: number; z: number; facing: number };
  offset?: { x: number; z: number };
  huntId?: number;
  restUntil?: number;
}

export interface Entity {
  id: number;
  kind: Kind;
  name: string;
  realm: Team;
  level: number;
  cls?: ClassId;
  mob?: MobDef;
  named?: boolean;
  role?: NpcRole;
  hpMul: number;
  dmgMul: number;
  x: number;
  z: number;
  y: number;
  vy: number;
  facing: number;
  speed: number; // base m/s
  moved: number; // metres moved this tick (for animation)
  radius: number;
  scale: number;
  hp: number;
  maxHp: number;
  power: number;
  maxPower: number;
  endu: number;
  stats: Record<StatId, number>;
  weapon: Weapon;
  af: number;
  parry: number;
  block: number;
  evade: number;
  shield: boolean;
  target: number | null;
  attacking: boolean;
  swingAt: number;
  queuedStyle: string | null;
  lastStyle: { id: string; t: number } | null;
  lastDefense: { kind: 'parry' | 'block' | 'evade'; t: number } | null;
  cast: Cast | null;
  cds: Record<string, number>;
  effects: Effect[];
  dead: boolean;
  deadAt: number;
  lastCombat: number;
  lastHurt: number;
  threat: Map<number, number>;
  dmgBy: Map<number, number>;
  spawn: { x: number; z: number };
  ai: AiState;
  keep?: number; // index into world.keeps for guards, lords and doors
  warband?: number;
  respawn?: number; // seconds until a mob respawns after death (mobs only)
  sprinting: boolean;
  invulnerable?: boolean;
  look?: { body: string; trim: string; weapon?: string; helm?: boolean; bones?: boolean };
  title?: string;
  abilities: string[];
}

export interface Task {
  mob: string;
  mobName: string;
  need: number;
  have: number;
  xp: number;
  copper: number;
  zone: string;
}

export interface CharSave {
  version: number;
  id: string;
  name: string;
  realm: RealmId;
  cls: ClassId;
  level: number;
  xp: number;
  copper: number;
  rp: number;
  equip: Record<Slot, Item>;
  bag: Item[];
  potions: { health: number; power: number };
  hotbar: (string | null)[];
  x: number;
  z: number;
  kills: number;
  realmKills: number;
  deaths: number;
  task: Task | null;
  created: number;
  played: number;
}

export type GameEvent =
  | { type: 'swing'; id: number; target: number; style?: string }
  | { type: 'dmg'; id: number; src: number; amount: number; crit: boolean; school: string; result: 'hit' | 'miss' | 'parry' | 'block' | 'evade' | 'resist' }
  | { type: 'heal'; id: number; src: number; amount: number }
  | { type: 'castStart'; id: number; ab: string }
  | { type: 'castEnd'; id: number; ab: string; ok: boolean }
  | { type: 'projectile'; from: number; to: number; school: string }
  | { type: 'aoe'; x: number; z: number; r: number; school: string; id: number }
  | { type: 'death'; id: number }
  | { type: 'levelup'; level: number }
  | { type: 'capture'; keep: number; realm: Team }
  | { type: 'breach'; keep: number }
  | { type: 'spawn'; id: number }
  | { type: 'despawn'; id: number }
  | { type: 'buff'; id: number; name: string };

export type LogKind = 'hit-out' | 'hit-in' | 'miss' | 'spell' | 'heal' | 'xp' | 'loot' | 'system' | 'realm' | 'chat' | 'say' | 'error' | 'death';
