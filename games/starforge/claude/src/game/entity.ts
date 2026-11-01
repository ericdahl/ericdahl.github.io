import type { BuildingKind, Kind, UnitKind } from './defs';
import type { Vec } from './pathfinding';

export type Order =
  | { type: 'idle' }
  | { type: 'hold' }
  | { type: 'move'; x: number; y: number }
  | { type: 'attackMove'; x: number; y: number }
  | { type: 'attack'; target: number }
  /** target is a crystal or an extractor; -1 means "just return cargo". */
  | { type: 'gather'; target: number; phase: 'toRes' | 'mining' | 'toBase' }
  | { type: 'build'; kind: BuildingKind; tx: number; ty: number };

export type EntityClass = 'unit' | 'building' | 'resource';

export class Entity {
  dead = false;
  hp: number;
  /** Facing angle in radians (units, turrets). */
  angle = 0;

  // units
  order: Order = { type: 'idle' };
  /** Order to resume after finishing a build (keeps harvesters mining). */
  resumeOrder: Order | null = null;
  path: Vec[] = [];
  navGoal: Vec | null = null;
  repathAt = 0;
  stuck = 0;
  targetId = 0;
  cooldown = 0;
  carry = 0;
  carryType: 'crystal' | 'flux' | null = null;
  timer = 0;
  moving = false;
  lastX = 0;
  lastY = 0;

  // buildings
  tx = 0;
  ty = 0;
  w = 0;
  h = 0;
  built = true;
  progress = 1;
  queue: UnitKind[] = [];
  prodTime = 0;
  rally: Vec | null = null;
  rallyTarget = 0;
  ventId = 0;

  // resources
  amount = 0;
  minerId = 0;
  extractorId = 0;

  lastDamagedAt = -100;
  lastAttackerId = 0;

  constructor(
    public id: number,
    public kind: Kind,
    public cls: EntityClass,
    public owner: number,
    public x: number,
    public y: number,
    public maxHp: number,
    public radius: number,
  ) {
    this.hp = maxHp;
  }
}
