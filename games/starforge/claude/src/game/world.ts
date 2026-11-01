import {
  BUILDINGS,
  MAX_SUPPLY,
  QUEUE_LIMIT,
  RESOURCES,
  UNITS,
  isBuildingKind,
  isUnitKind,
  type BuildingKind,
  type Cost,
  type Kind,
  type UnitKind,
  type WeaponDef,
} from './defs';
import { Entity, type Order } from './entity';
import { GROUND, type MapData } from './map';
import { findPath, nearestFreeTile, smoothPath, type Grid } from './pathfinding';
import { Rng } from './rng';

export const TICK_RATE = 20;
export const DT = 1 / TICK_RATE;
export const NEUTRAL = 0;
export const HUMAN = 1;
export const ENEMY = 2;

export type Command =
  | { type: 'move'; ids: number[]; x: number; y: number }
  | { type: 'attackMove'; ids: number[]; x: number; y: number }
  | { type: 'attack'; ids: number[]; target: number }
  | { type: 'gather'; ids: number[]; target: number }
  | { type: 'smart'; ids: number[]; x: number; y: number }
  | { type: 'stop'; ids: number[] }
  | { type: 'hold'; ids: number[] }
  | { type: 'returnCargo'; ids: number[] }
  | { type: 'build'; ids: number[]; kind: BuildingKind; tx: number; ty: number }
  | { type: 'train'; id: number; kind: UnitKind }
  | { type: 'cancelTrain'; id: number }
  | { type: 'cancelBuilding'; id: number }
  | { type: 'rally'; ids: number[]; x: number; y: number };

export type GameEvent =
  | { type: 'error'; player: number; msg: string }
  | { type: 'underAttack'; player: number; x: number; y: number }
  | { type: 'unitReady'; player: number; kind: UnitKind; id: number }
  | { type: 'buildingDone'; player: number; kind: BuildingKind; id: number }
  | { type: 'death'; owner: number; kind: Kind; x: number; y: number }
  | { type: 'shot'; owner: number; fx: WeaponDef['fx']; x: number; y: number }
  | { type: 'gameOver'; winner: number };

export interface Effect {
  kind: 'shot' | 'boom' | 'ping';
  fx?: WeaponDef['fx'];
  x: number;
  y: number;
  x2: number;
  y2: number;
  owner: number;
  age: number;
  life: number;
  size: number;
}

export interface Player {
  id: number;
  crystal: number;
  flux: number;
  /** 0 = unexplored, 1 = explored, 2 = currently visible. */
  vis: Uint8Array;
  harvestMult: number;
  defeated: boolean;
  lastAlertAt: number;
  stats: { produced: number; lost: number; killed: number; gathered: number };
}

export interface WorldOptions {
  seed?: number;
  startingCrystal?: number;
}

const HASH_CELL = 4;
const GATHER_REACH = 0.35;
const PATH_BUDGET_PER_TICK = 16;

export class World implements Grid {
  readonly w: number;
  readonly h: number;
  readonly terrain: Uint8Array;
  readonly occ: Int32Array;
  readonly map: MapData;
  readonly entities = new Map<number, Entity>();
  list: Entity[] = [];
  players: Player[] = [];
  effects: Effect[] = [];
  events: GameEvent[] = [];
  time = 0;
  tickN = 0;
  winner: number | null = null;
  /** Disabled in sandbox scenarios where one side has no buildings. */
  victoryEnabled = true;
  rng: Rng;
  private nextId = 1;
  private hash: Entity[][];
  private hashCols: number;
  private hashRows: number;
  private pathBudget = PATH_BUDGET_PER_TICK;
  private sightCache = new Map<number, [number, number][]>();

  constructor(map: MapData, opts: WorldOptions = {}) {
    this.map = map;
    this.w = map.w;
    this.h = map.h;
    this.terrain = map.terrain.slice();
    this.occ = new Int32Array(this.w * this.h);
    this.rng = new Rng(opts.seed ?? map.seed);
    this.hashCols = Math.ceil(this.w / HASH_CELL);
    this.hashRows = Math.ceil(this.h / HASH_CELL);
    this.hash = Array.from({ length: this.hashCols * this.hashRows }, () => []);
    for (let i = 0; i < 3; i++) {
      this.players.push({
        id: i,
        crystal: opts.startingCrystal ?? 50,
        flux: 0,
        vis: new Uint8Array(this.w * this.h),
        harvestMult: 1,
        defeated: false,
        lastAlertAt: -100,
        stats: { produced: 0, lost: 0, killed: 0, gathered: 0 },
      });
    }
    for (const r of map.resources) this.spawnResource(r.kind, r.tx, r.ty);
  }

  /** Places each player's Command Core and starting harvesters. */
  setupStart(harvesters = 5) {
    const cores: Entity[] = [];
    for (const p of [HUMAN, ENEMY]) {
      const s = this.map.starts[p - 1];
      cores.push(this.placeBuilding('core', p, s.tx, s.ty, true));
    }
    this.updateFog();
    for (const p of [HUMAN, ENEMY]) {
      const s = this.map.starts[p - 1];
      const core = cores[p - 1];
      const ids: number[] = [];
      for (let i = 0; i < harvesters; i++) {
        const spot = nearestFreeTile(this, Math.floor(core.x - 2 + i), s.ty + 3, core.x, core.y) ?? { x: s.tx, y: s.ty + 3 };
        ids.push(this.spawnUnit('harvester', p, spot.x + 0.5, spot.y + 0.5).id);
      }
      for (const id of ids) {
        const e = this.get(id)!;
        const c = this.nearestCrystal(e.x, e.y, 15, e);
        if (c) e.order = { type: 'gather', target: c.id, phase: 'toRes' };
      }
    }
    this.updateFog();
  }

  // ---------------------------------------------------------------- grid

  blocked(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    const i = ty * this.w + tx;
    return this.terrain[i] !== GROUND || this.occ[i] !== 0;
  }

  inBounds(tx: number, ty: number) {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  // ---------------------------------------------------------------- entities

  get(id: number): Entity | undefined {
    return id ? this.entities.get(id) : undefined;
  }

  private add(e: Entity) {
    this.entities.set(e.id, e);
    this.list.push(e);
    return e;
  }

  spawnUnit(kind: UnitKind, owner: number, x: number, y: number): Entity {
    const d = UNITS[kind];
    const e = new Entity(this.nextId++, kind, 'unit', owner, x, y, d.hp, d.radius);
    e.lastX = x;
    e.lastY = y;
    e.angle = owner === ENEMY ? Math.PI * 0.75 : -Math.PI * 0.25;
    return this.add(e);
  }

  placeBuilding(kind: BuildingKind, owner: number, tx: number, ty: number, built: boolean): Entity {
    const d = BUILDINGS[kind];
    const e = new Entity(this.nextId++, kind, 'building', owner, tx + d.w / 2, ty + d.h / 2, d.hp, Math.max(d.w, d.h) / 2);
    e.tx = tx;
    e.ty = ty;
    e.w = d.w;
    e.h = d.h;
    e.built = built;
    e.progress = built ? 1 : 0;
    e.hp = built ? d.hp : Math.max(1, d.hp * 0.1);
    if (d.onVent) {
      const vent = this.get(this.occ[ty * this.w + tx]);
      if (vent && vent.kind === 'vent') {
        e.ventId = vent.id;
        vent.extractorId = e.id;
      }
    }
    this.setOcc(tx, ty, d.w, d.h, e.id);
    return this.add(e);
  }

  spawnResource(kind: 'crystal' | 'vent', tx: number, ty: number): Entity {
    const d = RESOURCES[kind];
    const e = new Entity(this.nextId++, kind, 'resource', NEUTRAL, tx + d.w / 2, ty + d.h / 2, 1, Math.max(d.w, d.h) / 2);
    e.tx = tx;
    e.ty = ty;
    e.w = d.w;
    e.h = d.h;
    e.amount = d.amount;
    this.setOcc(tx, ty, d.w, d.h, e.id);
    return this.add(e);
  }

  private setOcc(tx: number, ty: number, w: number, h: number, id: number) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (this.inBounds(x, y)) this.occ[y * this.w + x] = id;
  }

  kill(e: Entity, killer?: Entity) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    this.entities.delete(e.id);
    if (e.cls !== 'unit') {
      const vent = this.get(e.ventId);
      this.setOcc(e.tx, e.ty, e.w, e.h, vent ? vent.id : 0);
      if (vent) vent.extractorId = 0;
    }
    if (e.cls !== 'resource') {
      const big = e.cls === 'building' ? Math.max(e.w, e.h) : e.radius * 2.5;
      this.effects.push({ kind: 'boom', x: e.x, y: e.y, x2: 0, y2: 0, owner: e.owner, age: 0, life: 0.5 + big * 0.12, size: big });
      this.events.push({ type: 'death', owner: e.owner, kind: e.kind, x: e.x, y: e.y });
      this.players[e.owner].stats.lost++;
      if (killer && killer.owner !== e.owner) this.players[killer.owner].stats.killed++;
    }
  }

  // ---------------------------------------------------------------- queries

  /** Edge-to-edge distance between two entities. */
  dist(a: Entity, b: Entity): number {
    const ar = a.cls !== 'unit';
    const br = b.cls !== 'unit';
    if (ar && br) {
      const dx = Math.max(a.tx - (b.tx + b.w), b.tx - (a.tx + a.w), 0);
      const dy = Math.max(a.ty - (b.ty + b.h), b.ty - (a.ty + a.h), 0);
      return Math.hypot(dx, dy);
    }
    if (br) return Math.max(0, rectDist(b, a.x, a.y) - a.radius);
    if (ar) return Math.max(0, rectDist(a, b.x, b.y) - b.radius);
    return Math.max(0, Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius);
  }

  isAir(e: Entity) {
    return e.cls === 'unit' && !!UNITS[e.kind as UnitKind].air;
  }

  isVisibleTo(e: Entity, player: number): boolean {
    if (e.owner === player) return true;
    const vis = this.players[player].vis;
    if (e.cls === 'unit') return vis[Math.floor(e.y) * this.w + Math.floor(e.x)] === 2;
    const need = e.cls === 'resource' ? 1 : 2;
    for (let y = e.ty; y < e.ty + e.h; y++)
      for (let x = e.tx; x < e.tx + e.w; x++) if (this.inBounds(x, y) && vis[y * this.w + x] >= need) return true;
    return false;
  }

  /** Finds the most relevant entity under a world point, as seen by player. */
  entityAt(x: number, y: number, player: number, slop = 0.45): Entity | undefined {
    let best: Entity | undefined;
    let bestD = Infinity;
    for (const e of this.list) {
      if (e.dead || e.cls !== 'unit') continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.radius;
      if (d < slop && d < bestD && this.isVisibleTo(e, player)) {
        best = e;
        bestD = d;
      }
    }
    if (best) return best;
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (!this.inBounds(tx, ty)) return undefined;
    const b = this.get(this.occ[ty * this.w + tx]);
    if (b && this.isVisibleTo(b, player)) return b;
    return undefined;
  }

  unitsOf(player: number): Entity[] {
    return this.list.filter((e) => !e.dead && e.owner === player && e.cls === 'unit');
  }

  buildingsOf(player: number): Entity[] {
    return this.list.filter((e) => !e.dead && e.owner === player && e.cls === 'building');
  }

  hasBuilt(player: number, kind: BuildingKind) {
    return this.list.some((e) => !e.dead && e.owner === player && e.kind === kind && e.built);
  }

  supplyCap(player: number): number {
    let cap = 0;
    for (const e of this.list)
      if (!e.dead && e.owner === player && e.cls === 'building' && e.built) cap += BUILDINGS[e.kind as BuildingKind].supplyProvided ?? 0;
    return Math.min(MAX_SUPPLY, cap);
  }

  supplyUsed(player: number): number {
    let used = 0;
    for (const e of this.list) {
      if (e.dead || e.owner !== player) continue;
      if (e.cls === 'unit') used += UNITS[e.kind as UnitKind].supply;
      else if (e.cls === 'building') for (const q of e.queue) used += UNITS[q].supply;
    }
    return used;
  }

  canAfford(player: number, cost: Cost) {
    const p = this.players[player];
    return p.crystal >= cost.crystal && p.flux >= cost.flux;
  }

  private pay(player: number, cost: Cost, sign = 1) {
    const p = this.players[player];
    p.crystal -= cost.crystal * sign;
    p.flux -= cost.flux * sign;
  }

  missingRequirement(player: number, kind: UnitKind | BuildingKind): BuildingKind | null {
    const req = isUnitKind(kind) ? UNITS[kind].requires : BUILDINGS[kind].requires;
    for (const r of req ?? []) if (!this.hasBuilt(player, r)) return r;
    return null;
  }

  costError(player: number, cost: Cost): string | null {
    const p = this.players[player];
    if (p.crystal < cost.crystal) return 'Not enough crystal';
    if (p.flux < cost.flux) return 'Not enough flux';
    return null;
  }

  /** Returns why a building can't go at (tx, ty), or null if it can. */
  placementError(player: number, kind: BuildingKind, tx: number, ty: number): string | null {
    const d = BUILDINGS[kind];
    const req = this.missingRequirement(player, kind);
    if (req) return `Requires ${BUILDINGS[req].name}`;
    const vis = this.players[player].vis;
    let vent: Entity | undefined;
    for (let y = ty; y < ty + d.h; y++) {
      for (let x = tx; x < tx + d.w; x++) {
        if (!this.inBounds(x, y) || this.terrain[y * this.w + x] !== GROUND) return 'Invalid location';
        if (vis[y * this.w + x] === 0) return 'Location unexplored';
        const o = this.get(this.occ[y * this.w + x]);
        if (d.onVent) {
          if (!o || o.kind !== 'vent') return 'Must be placed on a flux vent';
          vent = o;
        } else if (o) return 'Location blocked';
      }
    }
    if (d.onVent && (!vent || vent.tx !== tx || vent.ty !== ty || vent.extractorId)) return 'Must be placed on a flux vent';
    for (const e of this.list) {
      if (e.dead || e.cls !== 'unit' || e.owner === player || this.isAir(e)) continue;
      if (e.x + e.radius > tx && e.x - e.radius < tx + d.w && e.y + e.radius > ty && e.y - e.radius < ty + d.h)
        return 'Location blocked';
    }
    return null;
  }

  trainError(b: Entity, kind: UnitKind): string | null {
    const d = UNITS[kind];
    if (b.cls !== 'building' || !b.built) return 'Building not ready';
    if (!BUILDINGS[b.kind as BuildingKind].trains?.includes(kind)) return 'Cannot train that here';
    const req = this.missingRequirement(b.owner, kind);
    if (req) return `Requires ${BUILDINGS[req].name}`;
    if (b.queue.length >= QUEUE_LIMIT) return 'Queue is full';
    const ce = this.costError(b.owner, d.cost);
    if (ce) return ce;
    if (this.supplyUsed(b.owner) + d.supply > this.supplyCap(b.owner)) return 'Not enough supply — build a Habitat';
    return null;
  }

  nearestCrystal(x: number, y: number, maxD: number, forUnit?: Entity, preferFree = false): Entity | undefined {
    let best: Entity | undefined;
    let bestD = Infinity;
    for (const e of this.list) {
      if (e.dead || e.kind !== 'crystal') continue;
      if (forUnit && !this.isVisibleTo(e, forUnit.owner)) continue;
      let d = Math.hypot(e.x - x, e.y - y);
      if (d > maxD) continue;
      if (preferFree && forUnit && this.minerBusy(e, forUnit)) d += 3;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  nearestDropOff(e: Entity): Entity | undefined {
    let best: Entity | undefined;
    let bestD = Infinity;
    for (const b of this.list) {
      if (b.dead || b.owner !== e.owner || b.cls !== 'building' || !b.built || !BUILDINGS[b.kind as BuildingKind].dropOff) continue;
      const d = this.dist(e, b);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private minerBusy(res: Entity, e: Entity) {
    const m = this.get(res.minerId);
    return !!m && m !== e && m.order.type === 'gather' && m.order.target === res.id && m.order.phase === 'mining';
  }

  // ---------------------------------------------------------------- commands

  issue(player: number, cmd: Command) {
    if (this.winner !== null) return;
    const own = (ids: number[]) =>
      ids.map((id) => this.get(id)).filter((e): e is Entity => !!e && e.owner === player);
    const units = (ids: number[]) => own(ids).filter((e) => e.cls === 'unit');
    switch (cmd.type) {
      case 'move':
      case 'attackMove':
        this.groupOrder(units(cmd.ids), cmd.x, cmd.y, cmd.type);
        break;
      case 'attack': {
        const t = this.get(cmd.target);
        if (!t || !this.isVisibleTo(t, player)) return;
        for (const e of units(cmd.ids)) {
          if (UNITS[e.kind as UnitKind].weapon && this.canHit(e, t) && t.owner !== player) this.setOrder(e, { type: 'attack', target: t.id });
          else this.setOrder(e, { type: 'move', x: t.x, y: t.y });
        }
        break;
      }
      case 'gather': {
        let t = this.get(cmd.target);
        if (t?.kind === 'vent') t = this.get(t.extractorId);
        if (!t) return;
        const ok = t.kind === 'crystal' || (t.kind === 'extractor' && t.owner === player && t.built);
        if (!ok) return;
        for (const e of units(cmd.ids)) {
          if (e.kind !== 'harvester') continue;
          this.setOrder(e, { type: 'gather', target: t.id, phase: e.carry > 0 ? 'toBase' : 'toRes' });
        }
        break;
      }
      case 'returnCargo':
        for (const e of units(cmd.ids)) if (e.kind === 'harvester' && e.carry > 0) this.setOrder(e, { type: 'gather', target: -1, phase: 'toBase' });
        break;
      case 'smart':
        this.smart(player, own(cmd.ids), cmd.x, cmd.y);
        break;
      case 'stop':
        for (const e of units(cmd.ids)) this.halt(e);
        break;
      case 'hold':
        for (const e of units(cmd.ids)) {
          this.halt(e);
          e.order = { type: 'hold' };
        }
        break;
      case 'build': {
        const builder = units(cmd.ids).filter((e) => e.kind === 'harvester');
        if (!builder.length) return;
        const err = this.placementError(player, cmd.kind, cmd.tx, cmd.ty) ?? this.costError(player, BUILDINGS[cmd.kind].cost);
        if (err) {
          this.events.push({ type: 'error', player, msg: err });
          return;
        }
        const d = BUILDINGS[cmd.kind];
        const cx = cmd.tx + d.w / 2;
        const cy = cmd.ty + d.h / 2;
        builder.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
        const e = builder[0];
        const resume = e.order.type === 'gather' ? { ...e.order, phase: 'toRes' as const } : null;
        this.setOrder(e, { type: 'build', kind: cmd.kind, tx: cmd.tx, ty: cmd.ty });
        e.resumeOrder = resume;
        break;
      }
      case 'train': {
        const b = own([cmd.id])[0];
        if (!b) return;
        const err = this.trainError(b, cmd.kind);
        if (err) {
          this.events.push({ type: 'error', player, msg: err });
          return;
        }
        this.pay(player, UNITS[cmd.kind].cost);
        b.queue.push(cmd.kind);
        break;
      }
      case 'cancelTrain': {
        const b = own([cmd.id])[0];
        if (!b || !b.queue.length) return;
        const k = b.queue.pop()!;
        if (!b.queue.length) b.prodTime = 0;
        this.pay(player, UNITS[k].cost, -1);
        break;
      }
      case 'cancelBuilding': {
        const b = own([cmd.id])[0];
        if (!b || b.cls !== 'building' || b.built) return;
        const c = BUILDINGS[b.kind as BuildingKind].cost;
        this.pay(player, { crystal: Math.floor(c.crystal * 0.75), flux: Math.floor(c.flux * 0.75) }, -1);
        b.dead = true;
        this.entities.delete(b.id);
        const vent = this.get(b.ventId);
        this.setOcc(b.tx, b.ty, b.w, b.h, vent ? vent.id : 0);
        if (vent) vent.extractorId = 0;
        break;
      }
      case 'rally':
        for (const b of own(cmd.ids)) this.setRally(b, cmd.x, cmd.y);
        break;
    }
  }

  private setRally(b: Entity, x: number, y: number) {
    if (b.cls !== 'building' || !BUILDINGS[b.kind as BuildingKind].trains) return;
    b.rally = { x, y };
    const t = this.entityAt(x, y, b.owner);
    b.rallyTarget = t && (t.kind === 'crystal' || t.kind === 'extractor' || t.kind === 'vent') ? t.id : 0;
  }

  private smart(player: number, sel: Entity[], x: number, y: number) {
    let target = this.entityAt(x, y, player);
    if (target?.kind === 'vent' && target.extractorId) target = this.get(target.extractorId);
    for (const b of sel) if (b.cls === 'building') this.setRally(b, x, y);
    const units = sel.filter((e) => e.cls === 'unit');
    if (!units.length) return;
    if (target && target.owner !== player && target.owner !== NEUTRAL) {
      const attackers = units.filter((e) => UNITS[e.kind as UnitKind].weapon && this.canHit(e, target!));
      const ids = attackers.map((e) => e.id);
      this.issue(player, { type: 'attack', ids, target: target.id });
      this.groupOrder(units.filter((e) => !attackers.includes(e)), x, y, 'move');
      return;
    }
    const harvesters = units.filter((e) => e.kind === 'harvester');
    const others = units.filter((e) => e.kind !== 'harvester');
    const gatherable = target && (target.kind === 'crystal' || (target.kind === 'extractor' && target.owner === player && target.built));
    if (target && gatherable && harvesters.length) {
      this.issue(player, { type: 'gather', ids: harvesters.map((e) => e.id), target: target.id });
      this.groupOrder(others, x, y, 'move');
      return;
    }
    if (target && target.owner === player && BUILDINGS[target.kind as BuildingKind]?.dropOff) {
      const carrying = harvesters.filter((e) => e.carry > 0);
      this.issue(player, { type: 'returnCargo', ids: carrying.map((e) => e.id) });
      this.groupOrder(units.filter((e) => !carrying.includes(e)), x, y, 'move');
      return;
    }
    this.groupOrder(units, x, y, 'move');
  }

  private groupOrder(units: Entity[], x: number, y: number, type: 'move' | 'attackMove') {
    if (!units.length) return;
    let cx = 0;
    let cy = 0;
    for (const u of units) {
      cx += u.x;
      cy += u.y;
    }
    cx /= units.length;
    cy /= units.length;
    let spread = 0;
    for (const u of units) spread = Math.max(spread, Math.hypot(u.x - cx, u.y - cy));
    // Keep the group's shape but compress it so units converge on the target area.
    const maxSpread = Math.max(1, Math.sqrt(units.length) * 0.75);
    const k = units.length === 1 ? 0 : Math.min(1, maxSpread / Math.max(spread, 0.001));
    for (const u of units) {
      let gx = x + (u.x - cx) * k;
      let gy = y + (u.y - cy) * k;
      if (!this.isAir(u) && this.blocked(Math.floor(gx), Math.floor(gy))) {
        const f = nearestFreeTile(this, Math.floor(gx), Math.floor(gy), Math.floor(u.x), Math.floor(u.y));
        if (f) {
          gx = f.x + 0.5;
          gy = f.y + 0.5;
        }
      }
      gx = clamp(gx, 0.5, this.w - 0.5);
      gy = clamp(gy, 0.5, this.h - 0.5);
      this.setOrder(u, { type, x: gx, y: gy });
    }
  }

  private setOrder(e: Entity, o: Order) {
    e.order = o;
    e.resumeOrder = null;
    e.path = [];
    e.navGoal = null;
    e.targetId = 0;
    e.stuck = 0;
  }

  private halt(e: Entity) {
    this.setOrder(e, { type: 'idle' });
  }

  // ---------------------------------------------------------------- simulation

  step() {
    if (this.winner !== null) {
      this.ageEffects();
      return;
    }
    this.time += DT;
    this.tickN++;
    this.pathBudget = PATH_BUDGET_PER_TICK;
    this.rebuildHash();
    const n = this.list.length;
    for (let i = 0; i < n; i++) {
      const e = this.list[i];
      if (e.dead) continue;
      if (e.cls === 'unit') this.updateUnit(e);
      else if (e.cls === 'building') this.updateBuilding(e);
    }
    this.separate();
    if (this.list.some((e) => e.dead)) this.list = this.list.filter((e) => !e.dead);
    this.ageEffects();
    if (this.tickN % 4 === 0) this.updateFog();
    if (this.victoryEnabled && this.tickN % 10 === 0) this.checkVictory();
  }

  private ageEffects() {
    for (const f of this.effects) f.age += DT;
    if (this.effects.length) this.effects = this.effects.filter((f) => f.age < f.life);
  }

  private checkVictory() {
    const alive = [HUMAN, ENEMY].filter((p) => this.list.some((e) => !e.dead && e.owner === p && e.cls === 'building'));
    for (const p of [HUMAN, ENEMY]) if (!alive.includes(p)) this.players[p].defeated = true;
    if (alive.length <= 1) {
      this.winner = alive[0] ?? NEUTRAL;
      this.events.push({ type: 'gameOver', winner: this.winner });
    }
  }

  private rebuildHash() {
    for (const c of this.hash) c.length = 0;
    for (const e of this.list) {
      if (e.dead || e.cls === 'resource') continue;
      const cx = clamp(Math.floor(e.x / HASH_CELL), 0, this.hashCols - 1);
      const cy = clamp(Math.floor(e.y / HASH_CELL), 0, this.hashRows - 1);
      this.hash[cy * this.hashCols + cx].push(e);
    }
  }

  /** Visits non-resource entities whose centers are within r (plus building slack) of (x, y). */
  private near(x: number, y: number, r: number, fn: (e: Entity) => void) {
    const pad = r + 2.5;
    const x0 = clamp(Math.floor((x - pad) / HASH_CELL), 0, this.hashCols - 1);
    const x1 = clamp(Math.floor((x + pad) / HASH_CELL), 0, this.hashCols - 1);
    const y0 = clamp(Math.floor((y - pad) / HASH_CELL), 0, this.hashRows - 1);
    const y1 = clamp(Math.floor((y + pad) / HASH_CELL), 0, this.hashRows - 1);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (const e of this.hash[cy * this.hashCols + cx]) if (!e.dead) fn(e);
  }

  private weaponOf(e: Entity): WeaponDef | undefined {
    return isUnitKind(e.kind) ? UNITS[e.kind].weapon : isBuildingKind(e.kind) ? BUILDINGS[e.kind].weapon : undefined;
  }

  canHit(e: Entity, t: Entity): boolean {
    const w = this.weaponOf(e);
    if (!w || t.cls === 'resource') return false;
    return this.isAir(t) ? w.hitsAir : w.hitsGround;
  }

  private validEnemy(e: Entity, id: number): Entity | undefined {
    const t = this.get(id);
    if (!t || t.owner === e.owner || t.owner === NEUTRAL || !this.canHit(e, t) || !this.isVisibleTo(t, e.owner)) return undefined;
    return t;
  }

  private acquire(e: Entity, range: number): Entity | undefined {
    let best: Entity | undefined;
    let bestScore = Infinity;
    this.near(e.x, e.y, range + 1, (c) => {
      if (c.owner === e.owner || c.owner === NEUTRAL || !this.canHit(e, c)) return;
      const d = this.dist(e, c);
      if (d > range || !this.isVisibleTo(c, e.owner)) return;
      const armed = !!this.weaponOf(c) && c.kind !== 'harvester';
      const score = d + (armed ? 0 : c.cls === 'building' ? 12 : 4);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    });
    return best;
  }

  private acquireRange(e: Entity) {
    const w = this.weaponOf(e)!;
    const sight = isUnitKind(e.kind) ? UNITS[e.kind].sight : w.range;
    return Math.max(w.range, sight - 1);
  }

  private updateUnit(e: Entity) {
    const def = UNITS[e.kind as UnitKind];
    const moved = Math.hypot(e.x - e.lastX, e.y - e.lastY);
    if (e.moving && moved < def.speed * DT * 0.3) e.stuck += DT;
    else e.stuck = Math.max(0, e.stuck - DT * 2);
    e.lastX = e.x;
    e.lastY = e.y;
    e.moving = false;
    e.cooldown = Math.max(0, e.cooldown - DT);
    const o = e.order;
    const canScan = (this.tickN + e.id) % 3 === 0;
    switch (o.type) {
      case 'idle': {
        if (!def.weapon) break;
        let t = this.validEnemy(e, e.targetId);
        if (t && this.dist(e, t) > this.acquireRange(e) + 3) t = undefined;
        if (!t && canScan && e.kind !== 'harvester') t = this.acquire(e, this.acquireRange(e));
        e.targetId = t?.id ?? 0;
        if (t) this.engage(e, t);
        break;
      }
      case 'hold': {
        if (!def.weapon) break;
        let t = this.validEnemy(e, e.targetId);
        if (t && this.dist(e, t) > def.weapon.range) t = undefined;
        if (!t && canScan) t = this.acquire(e, def.weapon.range);
        e.targetId = t?.id ?? 0;
        if (t) this.fireIfReady(e, t, def.weapon);
        break;
      }
      case 'move': {
        const d = Math.hypot(e.x - o.x, e.y - o.y);
        if (d < 0.15 || (e.stuck > 0.8 && d < 2.5) || e.stuck > 4) {
          this.halt(e);
          break;
        }
        if (this.navigate(e, o.x, o.y)) this.halt(e);
        break;
      }
      case 'attackMove': {
        let t: Entity | undefined;
        if (def.weapon) {
          t = this.validEnemy(e, e.targetId);
          if (t && this.dist(e, t) > this.acquireRange(e) + 3) t = undefined;
          if (!t && canScan) t = this.acquire(e, this.acquireRange(e));
        }
        e.targetId = t?.id ?? 0;
        if (t) {
          this.engage(e, t);
          break;
        }
        const d = Math.hypot(e.x - o.x, e.y - o.y);
        if (d < 0.3 || (e.stuck > 0.8 && d < 3) || e.stuck > 5) {
          this.halt(e);
          break;
        }
        if (this.navigate(e, o.x, o.y)) this.halt(e);
        break;
      }
      case 'attack': {
        const t = this.validEnemy(e, o.target);
        if (!t) {
          this.halt(e);
          break;
        }
        this.engage(e, t);
        break;
      }
      case 'gather':
        this.updateGather(e, o);
        break;
      case 'build':
        this.updateBuild(e, o);
        break;
    }
  }

  private engage(e: Entity, t: Entity) {
    const w = this.weaponOf(e)!;
    if (this.dist(e, t) <= w.range) {
      e.path = [];
      e.navGoal = null;
      this.fireIfReady(e, t, w);
    } else {
      this.navigate(e, t.x, t.y);
    }
  }

  private fireIfReady(e: Entity, t: Entity, w: WeaponDef) {
    e.angle = Math.atan2(t.y - e.y, t.x - e.x);
    if (e.cooldown > 0) return;
    e.cooldown = w.cooldown;
    this.effects.push({ kind: 'shot', fx: w.fx, x: e.x, y: e.y, x2: t.x, y2: t.y, owner: e.owner, age: 0, life: w.fx === 'shell' ? 0.35 : w.fx === 'missile' ? 0.3 : 0.12, size: 1 });
    this.events.push({ type: 'shot', owner: e.owner, fx: w.fx, x: e.x, y: e.y });
    const light = (u: Entity) => u.cls === 'unit' && !!UNITS[u.kind as UnitKind].light;
    const dmgFor = (u: Entity) => w.damage + (w.bonusVsLight && light(u) ? w.bonusVsLight : 0);
    if (w.splash) {
      const victims: Entity[] = [];
      this.near(t.x, t.y, w.splash, (c) => {
        if (c.owner === e.owner || c.owner === NEUTRAL || this.isAir(c) || c.cls === 'resource') return;
        if (c === t || Math.hypot(c.x - t.x, c.y - t.y) - c.radius <= w.splash!) victims.push(c);
      });
      for (const v of victims) this.damage(v, v === t ? dmgFor(v) : dmgFor(v) * 0.5, e);
    } else {
      this.damage(t, dmgFor(t), e);
    }
  }

  damage(t: Entity, amount: number, src?: Entity) {
    if (t.dead) return;
    const armor = isUnitKind(t.kind) ? UNITS[t.kind].armor : isBuildingKind(t.kind) ? BUILDINGS[t.kind].armor : 0;
    t.hp -= Math.max(0.5, amount - armor);
    t.lastDamagedAt = this.time;
    if (src) {
      t.lastAttackerId = src.id;
      const p = this.players[t.owner];
      if (this.time - p.lastAlertAt > 15) {
        p.lastAlertAt = this.time;
        this.events.push({ type: 'underAttack', player: t.owner, x: t.x, y: t.y });
        this.effects.push({ kind: 'ping', x: t.x, y: t.y, x2: 0, y2: 0, owner: t.owner, age: 0, life: 3, size: 1 });
      }
      this.callForHelp(t, src);
    }
    if (t.hp <= 0) this.kill(t, src);
  }

  /** Idle combat units near a victim respond to whoever attacked it. */
  private callForHelp(victim: Entity, src: Entity) {
    if (src.dead || src.owner === victim.owner) return;
    this.near(victim.x, victim.y, 7, (f) => {
      if (f.owner !== victim.owner || f.cls !== 'unit' || f.targetId || f.kind === 'harvester') return;
      if (f.order.type !== 'idle' && f.order.type !== 'attackMove') return;
      if (this.canHit(f, src) && Math.hypot(f.x - victim.x, f.y - victim.y) < 7) f.targetId = src.id;
    });
  }

  /** Moves a unit toward a point. Returns true once it can make no further progress. */
  private navigate(e: Entity, gx: number, gy: number): boolean {
    const def = UNITS[e.kind as UnitKind];
    e.moving = true;
    if (def.air) {
      return this.stepToward(e, gx, gy, def.speed);
    }
    const goalChanged = !e.navGoal || Math.hypot(e.navGoal.x - gx, e.navGoal.y - gy) > 0.75;
    const needRepath = goalChanged || ((e.stuck > 0.5 || !e.path.length) && this.time >= e.repathAt);
    if (needRepath && this.pathBudget > 0) {
      this.pathBudget--;
      e.navGoal = { x: gx, y: gy };
      e.repathAt = this.time + 0.6 + this.rng.next() * 0.4;
      let sx = Math.floor(e.x);
      let sy = Math.floor(e.y);
      if (this.blocked(sx, sy)) {
        const f = nearestFreeTile(this, sx, sy, sx, sy);
        if (f) {
          sx = f.x;
          sy = f.y;
        }
      }
      const tiles = findPath(this, sx, sy, Math.floor(gx), Math.floor(gy));
      e.path = smoothPath(this, e.x, e.y, tiles, def.radius);
      const goalFree = !this.blocked(Math.floor(gx), Math.floor(gy));
      if (goalFree && e.path.length) {
        const last = e.path[e.path.length - 1];
        if (Math.floor(last.x) === Math.floor(gx) && Math.floor(last.y) === Math.floor(gy)) e.path[e.path.length - 1] = { x: gx, y: gy };
      } else if (goalFree && !e.path.length) {
        e.path = [{ x: gx, y: gy }];
      }
    } else if (needRepath && !e.path.length) {
      return false;
    }
    while (e.path.length && Math.hypot(e.path[0].x - e.x, e.path[0].y - e.y) < 0.12) e.path.shift();
    if (!e.path.length) {
      e.moving = false;
      return true;
    }
    this.stepToward(e, e.path[0].x, e.path[0].y, def.speed);
    return false;
  }

  private stepToward(e: Entity, x: number, y: number, speed: number): boolean {
    const dx = x - e.x;
    const dy = y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.05) return true;
    const s = Math.min(d, speed * DT);
    e.x += (dx / d) * s;
    e.y += (dy / d) * s;
    e.angle = Math.atan2(dy, dx);
    return false;
  }

  private updateGather(e: Entity, o: Extract<Order, { type: 'gather' }>) {
    if (o.phase === 'toBase') {
      const base = this.nearestDropOff(e);
      if (!base) {
        this.halt(e);
        return;
      }
      if (this.dist(e, base) <= GATHER_REACH) {
        const p = this.players[e.owner];
        const amt = Math.round(e.carry * p.harvestMult);
        if (e.carryType === 'flux') p.flux += amt;
        else p.crystal += amt;
        p.stats.gathered += amt;
        e.carry = 0;
        e.carryType = null;
        e.path = [];
        if (o.target === -1) this.halt(e);
        else o.phase = 'toRes';
      } else {
        this.navigate(e, base.x, base.y);
      }
      return;
    }
    let res = this.get(o.target);
    const valid = res && (res.kind === 'crystal' || (res.kind === 'extractor' && res.built && res.owner === e.owner));
    if (!valid) {
      const next = res?.kind === 'crystal' || !res ? this.nearestCrystal(e.x, e.y, 12, e, true) : undefined;
      if (!next) {
        if (e.carry > 0) e.order = { type: 'gather', target: -1, phase: 'toBase' };
        else this.halt(e);
        return;
      }
      o.target = next.id;
      o.phase = 'toRes';
      res = next;
    }
    res = res!;
    if (o.phase === 'toRes') {
      if (this.dist(e, res) <= GATHER_REACH) {
        if (this.minerBusy(res, e)) {
          if (res.kind === 'crystal') {
            const alt = this.nearestCrystal(res.x, res.y, 5, e, true);
            if (alt && alt !== res && !this.minerBusy(alt, e)) {
              o.target = alt.id;
              return;
            }
          }
          e.path = [];
          return;
        }
        res.minerId = e.id;
        o.phase = 'mining';
        e.timer = res.kind === 'crystal' ? RESOURCES.crystal.mineTime : RESOURCES.vent.mineTime;
        e.path = [];
        e.angle = Math.atan2(res.y - e.y, res.x - e.x);
      } else {
        this.navigate(e, res.x, res.y);
      }
      return;
    }
    // mining
    e.timer -= DT;
    if (e.timer > 0) return;
    res.minerId = 0;
    if (res.kind === 'crystal') {
      const take = Math.min(RESOURCES.crystal.perTrip, res.amount);
      res.amount -= take;
      e.carry = take;
      e.carryType = 'crystal';
      if (res.amount <= 0) this.kill(res);
    } else {
      const vent = this.get(res.ventId);
      const take = vent && vent.amount > 0 ? Math.min(RESOURCES.vent.perTrip, vent.amount) : 1;
      if (vent) vent.amount = Math.max(0, vent.amount - take);
      e.carry = take;
      e.carryType = 'flux';
    }
    o.phase = 'toBase';
  }

  private updateBuild(e: Entity, o: Extract<Order, { type: 'build' }>) {
    const d = BUILDINGS[o.kind];
    const rect = { tx: o.tx, ty: o.ty, w: d.w, h: d.h };
    if (rectDist(rect, e.x, e.y) - e.radius <= 1.0) {
      const err = this.placementError(e.owner, o.kind, o.tx, o.ty) ?? this.costError(e.owner, d.cost);
      const resume = e.resumeOrder;
      if (err) {
        this.events.push({ type: 'error', player: e.owner, msg: err });
        this.halt(e);
        return;
      }
      this.pay(e.owner, d.cost);
      this.placeBuilding(o.kind, e.owner, o.tx, o.ty, false);
      this.pushOut(rect);
      this.halt(e);
      if (resume) e.order = resume;
    } else {
      this.navigate(e, o.tx + d.w / 2, o.ty + d.h / 2);
    }
  }

  /** Relocates ground units standing inside a newly placed footprint. */
  private pushOut(rect: { tx: number; ty: number; w: number; h: number }) {
    for (const u of this.list) {
      if (u.dead || u.cls !== 'unit' || this.isAir(u)) continue;
      if (u.x + u.radius > rect.tx && u.x - u.radius < rect.tx + rect.w && u.y + u.radius > rect.ty && u.y - u.radius < rect.ty + rect.h) {
        const f = nearestFreeTile(this, Math.floor(u.x), Math.floor(u.y), Math.floor(u.x), Math.floor(u.y));
        if (f) {
          u.x = f.x + 0.5;
          u.y = f.y + 0.5;
          u.path = [];
          u.navGoal = null;
        }
      }
    }
  }

  private updateBuilding(b: Entity) {
    const d = BUILDINGS[b.kind as BuildingKind];
    if (!b.built) {
      b.progress = Math.min(1, b.progress + DT / d.buildTime);
      b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.9 * DT) / d.buildTime);
      if (b.progress >= 1) {
        b.built = true;
        this.events.push({ type: 'buildingDone', player: b.owner, kind: b.kind as BuildingKind, id: b.id });
      }
      return;
    }
    if (b.queue.length) {
      b.prodTime += DT;
      const k = b.queue[0];
      if (b.prodTime >= UNITS[k].buildTime) {
        b.prodTime = 0;
        b.queue.shift();
        this.produce(b, k);
      }
    }
    if (d.weapon) {
      b.cooldown = Math.max(0, b.cooldown - DT);
      let t = this.validEnemy(b, b.targetId);
      if (t && this.dist(b, t) > d.weapon.range) t = undefined;
      if (!t && (this.tickN + b.id) % 3 === 0) t = this.acquire(b, d.weapon.range);
      b.targetId = t?.id ?? 0;
      if (t) this.fireIfReady(b, t, d.weapon);
    }
  }

  private produce(b: Entity, kind: UnitKind) {
    const def = UNITS[kind];
    const rx = b.rally?.x ?? b.x;
    const ry = b.rally?.y ?? b.ty + b.h + 1;
    let x = b.x;
    let y = b.y;
    if (!def.air) {
      const f = nearestFreeTile(this, Math.floor(clamp(rx, b.tx - 1, b.tx + b.w)), Math.floor(clamp(ry, b.ty - 1, b.ty + b.h)), Math.floor(rx), Math.floor(ry));
      if (f) {
        x = f.x + 0.5;
        y = f.y + 0.5;
      }
    }
    const u = this.spawnUnit(kind, b.owner, x, y);
    this.players[b.owner].stats.produced++;
    const rt = this.get(b.rallyTarget);
    if (kind === 'harvester' && rt) {
      this.issue(b.owner, { type: 'gather', ids: [u.id], target: rt.id });
    } else if (b.rally) {
      u.order = { type: 'move', x: b.rally.x, y: b.rally.y };
    } else if (kind === 'harvester') {
      const c = this.nearestCrystal(u.x, u.y, 14, u, true);
      if (c) u.order = { type: 'gather', target: c.id, phase: 'toRes' };
    }
    this.events.push({ type: 'unitReady', player: b.owner, kind, id: u.id });
  }

  private separate() {
    const gathering = (e: Entity) => e.kind === 'harvester' && (e.order.type === 'gather' || e.order.type === 'build');
    for (const a of this.list) {
      if (a.dead || a.cls !== 'unit') continue;
      const aAir = this.isAir(a);
      if (!gathering(a)) {
        this.near(a.x, a.y, a.radius + 0.8, (b) => {
          if (b.id <= a.id || b.cls !== 'unit' || this.isAir(b) !== aAir || gathering(b)) return;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          const min = a.radius + b.radius;
          if (d >= min) return;
          if (d < 1e-4) {
            dx = this.rng.next() - 0.5;
            dy = this.rng.next() - 0.5;
            d = Math.hypot(dx, dy);
          }
          const overlap = (min - d) * (aAir ? 0.25 : 0.5);
          let wa = 0.5;
          if (a.moving && !b.moving) wa = 0.15;
          else if (!a.moving && b.moving) wa = 0.85;
          a.x -= (dx / d) * overlap * wa * 2;
          a.y -= (dy / d) * overlap * wa * 2;
          b.x += (dx / d) * overlap * (1 - wa) * 2;
          b.y += (dy / d) * overlap * (1 - wa) * 2;
        });
      }
    }
    for (const a of this.list) if (!a.dead && a.cls === 'unit' && !this.isAir(a)) this.resolveTerrain(a);
    for (const a of this.list) {
      if (a.dead || a.cls !== 'unit') continue;
      a.x = clamp(a.x, 0.5, this.w - 0.5);
      a.y = clamp(a.y, 0.5, this.h - 0.5);
    }
  }

  private resolveTerrain(e: Entity) {
    const r = e.radius;
    if (this.blocked(Math.floor(e.x), Math.floor(e.y))) {
      const f = nearestFreeTile(this, Math.floor(e.x), Math.floor(e.y), Math.floor(e.lastX), Math.floor(e.lastY));
      if (f) {
        e.x = f.x + 0.5;
        e.y = f.y + 0.5;
      }
      return;
    }
    for (let ty = Math.floor(e.y - r); ty <= Math.floor(e.y + r); ty++) {
      for (let tx = Math.floor(e.x - r); tx <= Math.floor(e.x + r); tx++) {
        if (!this.blocked(tx, ty)) continue;
        const cx = clamp(e.x, tx, tx + 1);
        const cy = clamp(e.y, ty, ty + 1);
        const dx = e.x - cx;
        const dy = e.y - cy;
        const d = Math.hypot(dx, dy);
        if (d < r && d > 1e-6) {
          e.x += (dx / d) * (r - d);
          e.y += (dy / d) * (r - d);
        }
      }
    }
  }

  // ---------------------------------------------------------------- fog

  private sightOffsets(r: number): [number, number][] {
    let o = this.sightCache.get(r);
    if (!o) {
      o = [];
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) o.push([x, y]);
      this.sightCache.set(r, o);
    }
    return o;
  }

  updateFog() {
    for (const p of [HUMAN, ENEMY]) {
      const vis = this.players[p].vis;
      for (let i = 0; i < vis.length; i++) if (vis[i] === 2) vis[i] = 1;
    }
    for (const e of this.list) {
      if (e.dead || (e.owner !== HUMAN && e.owner !== ENEMY) || e.cls === 'resource') continue;
      const vis = this.players[e.owner].vis;
      const sight = isUnitKind(e.kind) ? UNITS[e.kind].sight : BUILDINGS[e.kind as BuildingKind].sight;
      const cx = Math.floor(e.x);
      const cy = Math.floor(e.y);
      for (const [ox, oy] of this.sightOffsets(sight)) {
        const x = cx + ox;
        const y = cy + oy;
        if (x >= 0 && y >= 0 && x < this.w && y < this.h) vis[y * this.w + x] = 2;
      }
    }
  }

  revealAll(player: number) {
    this.players[player].vis.fill(2);
  }
}

export function rectDist(r: { tx: number; ty: number; w: number; h: number }, x: number, y: number) {
  const dx = Math.max(r.tx - x, 0, x - (r.tx + r.w));
  const dy = Math.max(r.ty - y, 0, y - (r.ty + r.h));
  return Math.hypot(dx, dy);
}

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
