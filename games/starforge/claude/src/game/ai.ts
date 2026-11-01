import { BUILDINGS, UNITS, type BuildingKind, type UnitKind } from './defs';
import type { Entity } from './entity';
import { Rng } from './rng';
import { ENEMY, HUMAN, type World } from './world';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Profile {
  /** Ticks between decisions. */
  think: number;
  workers: number;
  firstAttack: number;
  attackGrowth: number;
  harvestMult: number;
  turrets: number;
  garrisons: number;
  expandAt: number;
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { think: 30, workers: 12, firstAttack: 14, attackGrowth: 4, harvestMult: 1, turrets: 0, garrisons: 1, expandAt: Infinity },
  normal: { think: 12, workers: 18, firstAttack: 20, attackGrowth: 6, harvestMult: 1, turrets: 1, garrisons: 2, expandAt: 420 },
  hard: { think: 6, workers: 22, firstAttack: 18, attackGrowth: 8, harvestMult: 1.25, turrets: 2, garrisons: 3, expandAt: 300 },
};

/** Scripted opponent that plays through the same command interface as the human. */
export class AIController {
  readonly profile: Profile;
  private rng: Rng;
  private attackThreshold: number;
  private attacking = false;
  waves = 0;

  constructor(
    private world: World,
    readonly player: number,
    readonly difficulty: Difficulty,
  ) {
    this.profile = PROFILES[difficulty];
    this.rng = new Rng(world.map.seed ^ (player * 2654435761));
    this.attackThreshold = this.profile.firstAttack;
    world.players[player].harvestMult = this.profile.harvestMult;
  }

  private get foe() {
    return this.player === HUMAN ? ENEMY : HUMAN;
  }

  update() {
    const w = this.world;
    if (w.winner !== null || (w.tickN + this.player) % this.profile.think !== 0) return;
    this.think();
  }

  private think() {
    const w = this.world;
    const me = this.player;
    const buildings = w.buildingsOf(me);
    const units = w.unitsOf(me);
    const cores = buildings.filter((b) => b.kind === 'core');
    const home = cores.find((c) => c.built) ?? buildings[0];
    if (!home) return;
    const harvesters = units.filter((u) => u.kind === 'harvester');
    const army = units.filter((u) => u.kind !== 'harvester');
    const p = w.players[me];

    const pending = (k: BuildingKind) => harvesters.filter((h) => h.order.type === 'build' && h.order.kind === k).length;
    const count = (k: BuildingKind) => buildings.filter((b) => b.kind === k).length + pending(k);
    const built = (k: BuildingKind) => buildings.some((b) => b.kind === k && b.built);

    for (const h of harvesters) {
      if (h.order.type !== 'idle') continue;
      const c = w.nearestCrystal(home.x, home.y, 14, h, true) ?? w.nearestCrystal(h.x, h.y, 40, h, true);
      if (c) w.issue(me, { type: 'gather', ids: [h.id], target: c.id });
    }

    const workerTarget = this.profile.workers + (cores.length - 1) * 10;
    const queued = cores.reduce((n, c) => n + c.queue.length, 0);
    for (const c of cores) {
      if (harvesters.length + queued < workerTarget && c.built && c.queue.length < 2 && p.crystal >= 50) {
        w.issue(me, { type: 'train', id: c.id, kind: 'harvester' });
      }
    }

    const cap = w.supplyCap(me);
    const used = w.supplyUsed(me);
    const producers = buildings.filter((b) => BUILDINGS[b.kind as BuildingKind].trains).length;
    const habitatsInProgress = buildings.filter((b) => b.kind === 'habitat' && !b.built).length + pending('habitat');
    const wantHabitat = cap < 200 && cap - used <= 2 + producers * 2 && habitatsInProgress < (producers > 2 ? 2 : 1);

    const plan: [BuildingKind, boolean][] = [
      ['habitat', wantHabitat],
      ['garrison', count('garrison') < 1 && harvesters.length >= 9],
      ['extractor', count('extractor') < 1 && count('garrison') >= 1 && harvesters.length >= 11],
      ['works', count('works') < 1 && built('garrison') && built('extractor')],
      ['garrison', count('garrison') < this.profile.garrisons && built('works') && harvesters.length >= 14],
      ['turret', count('turret') < this.profile.turrets && built('garrison') && w.time > 180],
      ['core', cores.length < 2 && w.time > this.profile.expandAt && harvesters.length >= this.profile.workers - 2],
      ['extractor', count('extractor') < cores.length && cores.length > 1 && cores.every((c) => c.built)],
      ['skyport', count('skyport') < 1 && built('works') && (this.difficulty === 'hard' || w.time > 480)],
    ];
    let saving = false;
    for (const [kind, want] of plan) {
      if (!want) continue;
      if (!w.canAfford(me, BUILDINGS[kind].cost)) {
        saving = true;
        break;
      }
      this.build(kind, home, harvesters);
    }

    const extractors = buildings.filter((b) => b.kind === 'extractor' && b.built);
    for (const ex of extractors) {
      const on = harvesters.filter((h) => h.order.type === 'gather' && h.order.target === ex.id);
      if (on.length < 3) {
        const spare = harvesters.find((h) => h.order.type === 'gather' && w.get(h.order.target)?.kind === 'crystal' && h.carry === 0);
        if (spare) w.issue(me, { type: 'gather', ids: [spare.id], target: ex.id });
      }
    }

    if (!saving || p.crystal > 300) this.produceArmy(buildings);
    this.setRallies(buildings, home);
    this.command(army, buildings, home);
  }

  private produceArmy(buildings: Entity[]) {
    const w = this.world;
    const me = this.player;
    for (const b of buildings) {
      if (!b.built || b.queue.length >= 1) continue;
      let kind: UnitKind | null = null;
      if (b.kind === 'garrison') kind = w.players[me].flux >= 25 && this.rng.next() < 0.35 ? 'ranger' : 'trooper';
      else if (b.kind === 'works') kind = w.players[me].flux >= 100 && this.rng.next() < 0.55 ? 'crawler' : 'raider';
      else if (b.kind === 'skyport') kind = 'wasp';
      if (kind && !w.trainError(b, kind)) w.issue(me, { type: 'train', id: b.id, kind });
    }
  }

  private setRallies(buildings: Entity[], home: Entity) {
    const w = this.world;
    const cx = w.w / 2;
    const cy = w.h / 2;
    const d = Math.hypot(cx - home.x, cy - home.y) || 1;
    const rx = home.x + ((cx - home.x) / d) * 7;
    const ry = home.y + ((cy - home.y) / d) * 7;
    for (const b of buildings) {
      if (b.kind !== 'core' && BUILDINGS[b.kind as BuildingKind].trains && !b.rally) w.issue(this.player, { type: 'rally', ids: [b.id], x: rx, y: ry });
    }
  }

  private command(army: Entity[], buildings: Entity[], home: Entity) {
    const w = this.world;
    const me = this.player;
    const enemies = w.list.filter((e) => !e.dead && e.owner === this.foe && e.cls === 'unit' && w.isVisibleTo(e, me));
    const threat = enemies.find((e) => buildings.some((b) => Math.hypot(b.x - e.x, b.y - e.y) < 12));
    if (threat) {
      const responders = army.filter((u) => u.order.type !== 'attack' && !(u.order.type === 'attackMove' && u.targetId));
      if (responders.length) w.issue(me, { type: 'attackMove', ids: responders.map((u) => u.id), x: threat.x, y: threat.y });
      return;
    }
    const supply = army.reduce((n, u) => n + UNITS[u.kind as UnitKind].supply, 0);
    if (!this.attacking && supply >= this.attackThreshold) {
      this.attacking = true;
      this.waves++;
      this.attackThreshold += this.profile.attackGrowth;
    }
    if (this.attacking) {
      if (supply < Math.max(4, (this.attackThreshold - this.profile.attackGrowth) * 0.3)) {
        this.attacking = false;
        const back = army.map((u) => u.id);
        if (back.length) w.issue(me, { type: 'move', ids: back, x: home.x, y: home.y + 4 });
        return;
      }
      const idle = army.filter((u) => u.order.type === 'idle' || u.order.type === 'move');
      if (idle.length) {
        const t = this.attackTarget(army);
        w.issue(me, { type: 'attackMove', ids: idle.map((u) => u.id), x: t.x, y: t.y });
      }
    }
  }

  /** Nearest opposing building to the army, falling back to the opponent's start location. */
  private attackTarget(army: Entity[]) {
    const w = this.world;
    let ax = 0;
    let ay = 0;
    for (const u of army) {
      ax += u.x;
      ay += u.y;
    }
    ax /= army.length;
    ay /= army.length;
    let best: Entity | undefined;
    let bestD = Infinity;
    for (const b of w.buildingsOf(this.foe)) {
      const d = Math.hypot(b.x - ax, b.y - ay);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) return { x: best.x, y: best.y };
    const s = w.map.starts[this.foe - 1];
    return { x: s.tx + 2, y: s.ty + 1.5 };
  }

  private build(kind: BuildingKind, home: Entity, harvesters: Entity[]) {
    const w = this.world;
    const spot = kind === 'extractor' ? this.findVent() : kind === 'core' ? this.findExpansion() : this.findSpot(kind, home);
    if (!spot) return;
    const builder = harvesters
      .filter((h) => h.order.type === 'gather' || h.order.type === 'idle')
      .sort((a, b) => Math.hypot(a.x - spot.tx, a.y - spot.ty) - Math.hypot(b.x - spot.tx, b.y - spot.ty))[0];
    if (!builder) return;
    w.issue(this.player, { type: 'build', ids: [builder.id], kind, tx: spot.tx, ty: spot.ty });
  }

  private findVent() {
    const w = this.world;
    const cores = w.buildingsOf(this.player).filter((b) => b.kind === 'core');
    let best: { tx: number; ty: number } | null = null;
    let bestD = Infinity;
    for (const v of w.list) {
      if (v.dead || v.kind !== 'vent' || v.extractorId) continue;
      if (w.placementError(this.player, 'extractor', v.tx, v.ty)) continue;
      for (const c of cores) {
        const d = Math.hypot(v.x - c.x, v.y - c.y);
        if (d < 12 && d < bestD) {
          bestD = d;
          best = { tx: v.tx, ty: v.ty };
        }
      }
    }
    return best;
  }

  private findExpansion() {
    const w = this.world;
    const home = w.map.starts[this.player - 1];
    const options = [...w.map.expansions].sort(
      (a, b) => Math.hypot(a.tx - home.tx, a.ty - home.ty) - Math.hypot(b.tx - home.tx, b.ty - home.ty),
    );
    for (const e of options) {
      if (!w.placementError(this.player, 'core', e.tx, e.ty)) return e;
      // The AI may not have scouted its natural yet; reveal the spot it intends to settle.
      const vis = w.players[this.player].vis;
      for (let y = e.ty; y < e.ty + 3; y++) for (let x = e.tx; x < e.tx + 4; x++) if (vis[y * w.w + x] === 0) vis[y * w.w + x] = 1;
      if (!w.placementError(this.player, 'core', e.tx, e.ty)) return e;
    }
    return null;
  }

  /** Spirals outward from the base, away from the mineral line, keeping a 1-tile walkway. */
  findSpot(kind: BuildingKind, home: Entity): { tx: number; ty: number } | null {
    const w = this.world;
    const d = BUILDINGS[kind];
    const resources = w.list.filter((e) => !e.dead && e.cls === 'resource' && Math.hypot(e.x - home.x, e.y - home.y) < 14);
    let rx = 0;
    let ry = 0;
    for (const r of resources) {
      rx += r.x;
      ry += r.y;
    }
    const away = resources.length ? Math.atan2(home.y - ry / resources.length, home.x - rx / resources.length) : 0;
    for (let r = 5; r < 20; r++) {
      for (let k = 0; k < 16; k++) {
        const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 8);
        const a = away + off + (this.rng.next() - 0.5) * 0.2;
        const tx = Math.round(home.x + Math.cos(a) * r - d.w / 2);
        const ty = Math.round(home.y + Math.sin(a) * r - d.h / 2);
        if (w.placementError(this.player, kind, tx, ty)) continue;
        if (!this.padded(tx, ty, d.w, d.h)) continue;
        if (resources.some((res) => Math.hypot(res.x - (tx + d.w / 2), res.y - (ty + d.h / 2)) < 4.5)) continue;
        return { tx, ty };
      }
    }
    return null;
  }

  private padded(tx: number, ty: number, fw: number, fh: number) {
    const w = this.world;
    for (let y = ty - 1; y <= ty + fh; y++)
      for (let x = tx - 1; x <= tx + fw; x++) {
        if (!w.inBounds(x, y)) return false;
        if (w.occ[y * w.w + x]) return false;
      }
    return true;
  }
}
