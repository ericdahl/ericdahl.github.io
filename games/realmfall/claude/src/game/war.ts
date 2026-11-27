/** The realm war: keeps, their garrisons, and the warbands each realm sends out to take them. */
import { REALM_DEFS, siteById, KEEP_HALF, type RealmId, type Site } from './geo';
import { CLASS_IDS, MOB_BY_ID, armorAf, realmName, type ClassId, type MobDef } from './data';
import type { Entity, Team } from './types';
import { dist, angleTo, type World } from './world';
import { Rng } from './rng';

export interface KeepState {
  index: number;
  site: Site;
  owner: Team;
  doorId: number;
  lordId: number;
  guardIds: number[];
  lastAttacked: number;
  attackers: Map<Team, number>;
  capturedAt: number;
  announcedAt: number;
  refillAt: number;
}

export interface Warband {
  id: number;
  realm: RealmId;
  members: number[];
  objective: number;
  mode: 'march' | 'rally' | 'siege' | 'hold';
  rallyAt: number;
  /** set while the band follows the player */
  follow?: number;
  holdUntil: number;
  defend: boolean;
}

interface Respawn { at: number; def: MobDef; level: number; x: number; z: number; named?: string; delay: number }

const BAND_CAP = 24;
const GUARD_SLOTS: [number, number, ClassId][] = [
  [KEEP_HALF - 6, -6, 'warden'],
  [KEEP_HALF - 6, 6, 'warden'],
  [KEEP_HALF - 12, -10, 'ranger'],
  [KEEP_HALF - 12, 10, 'cleric'],
  [-4, 12, 'runecaller'],
];
const DOOR_HP = 2600;
const RALLY_SIZE = 10;

export class War {
  private w: World;
  keeps: KeepState[] = [];
  bands: Warband[] = [];
  private respawns: Respawn[] = [];
  private nextBand: number[] = [6, 10, 14];
  private bandSeq = 1;
  private rng: Rng;
  /** Captures so far, for tests and the war map. */
  history: { t: number; keep: number; from: Team; to: Team }[] = [];

  constructor(w: World) {
    this.w = w;
    this.rng = new Rng(w.seed * 31 + 5);
  }

  addKeep(site: Site, index: number): KeepState {
    const k: KeepState = { index, site, owner: site.realm, doorId: 0, lordId: 0, guardIds: [], lastAttacked: -999, attackers: new Map(), capturedAt: -999, announcedAt: -999, refillAt: 0 };
    this.keeps.push(k);
    return k;
  }

  /** A keep's gate stops everyone but its owners. */
  doorClosed(i: number, realm: Team) {
    const k = this.keeps[i];
    if (!k || k.owner === realm) return false;
    const d = this.w.get(k.doorId);
    return !!d && !d.dead;
  }

  /** Called once the world exists: garrisons every keep and the realm gates. */
  setup() {
    for (const k of this.keeps) this.garrison(k, true);
    for (const r of REALM_DEFS) {
      const g = siteById(`gate${r.id}`);
      for (let i = 0; i < 4; i++) {
        const a = g.facing + (i - 1.5) * 0.5;
        const x = g.x + Math.cos(a) * 16, z = g.z + Math.sin(a) * 16;
        const e = this.w.makeCombatant('guard', i % 2 ? 'ranger' : 'warden', r.id, 30, x, z, `${r.adjective} Gate Warden`, 3, 2);
        e.ai.post = { x, z, facing: a };
        e.facing = a;
        this.w.add(e);
      }
    }
  }

  private guardName(owner: Team, cls: ClassId) {
    if (owner === -1) return cls === 'ranger' ? 'mistborn archer' : cls === 'runecaller' ? 'mistborn seer' : cls === 'cleric' ? 'mistborn keeper' : 'mistborn sentinel';
    const adj = REALM_DEFS[owner].adjective;
    return `${adj} ${cls === 'ranger' ? 'Archer' : cls === 'runecaller' ? 'Magus' : cls === 'cleric' ? 'Chaplain' : 'Guard'}`;
  }

  private garrison(k: KeepState, full: boolean) {
    const w = this.w;
    const owner = k.owner;
    for (const id of [k.doorId, k.lordId, ...k.guardIds]) {
      const e = w.get(id);
      if (e) w.remove(e);
    }
    k.guardIds = [];
    // the gate
    const gp = w.keepToWorld(k.site, KEEP_HALF, 0);
    const door = w.makeCombatant('door', 'warden', (owner === -1 ? 0 : owner) as RealmId, 24, gp.x, gp.z, k.site.name, 1, 0);
    door.realm = owner;
    door.cls = undefined;
    door.maxHp = door.hp = DOOR_HP;
    door.af = armorAf(24);
    door.radius = 3.4;
    door.speed = 0;
    door.parry = door.block = door.evade = 0;
    door.shield = false;
    door.facing = k.site.facing;
    door.keep = k.index;
    w.add(door);
    k.doorId = door.id;
    // the lord
    const lp = w.keepToWorld(k.site, -10, 0);
    const lordName = owner === -1 ? 'the Mist Warden' : `Lord of ${k.site.name}`;
    const lord = w.makeCombatant('lord', 'warden', (owner === -1 ? 0 : owner) as RealmId, 22, lp.x, lp.z, lordName, 5, 1.4);
    lord.realm = owner;
    lord.keep = k.index;
    lord.scale = 1.25;
    lord.ai.post = { x: lp.x, z: lp.z, facing: k.site.facing };
    lord.facing = k.site.facing;
    if (owner === -1) lord.look = { body: '#4b5a6b', trim: '#b8c6d6', helm: true };
    w.add(lord);
    k.lordId = lord.id;
    const n = full ? GUARD_SLOTS.length : 2;
    for (let i = 0; i < n; i++) this.addGuard(k, i);
    k.refillAt = w.t + 20;
  }

  private addGuard(k: KeepState, slot: number) {
    const w = this.w;
    const [u, v, cls] = GUARD_SLOTS[slot];
    const p = w.keepToWorld(k.site, u, v);
    const g = w.makeCombatant('guard', cls, (k.owner === -1 ? 0 : k.owner) as RealmId, 19, p.x, p.z, this.guardName(k.owner, cls), 1.25, 1);
    g.realm = k.owner;
    g.keep = k.index;
    g.ai.post = { x: p.x, z: p.z, facing: k.site.facing };
    g.facing = k.site.facing;
    (g as Entity & { slot?: number }).slot = slot;
    if (k.owner === -1) g.look = { body: '#3d4a5a', trim: '#9fb2c8', helm: cls === 'warden' };
    w.add(g);
    k.guardIds.push(g.id);
  }

  underAttack(i: number, attacker: Entity) {
    const k = this.keeps[i];
    if (!k || attacker.realm === k.owner) return;
    k.lastAttacked = this.w.t;
    k.attackers.set(attacker.realm, (k.attackers.get(attacker.realm) ?? 0) + 1);
    const p = this.w.player;
    if (p && k.owner === p.realm && this.w.t - k.announcedAt > 90) {
      k.announcedAt = this.w.t;
      this.w.log(`${k.site.name} is under attack!`, 'realm');
    }
  }

  breached(door: Entity) {
    const k = this.keeps[door.keep!];
    const p = this.w.player;
    if (p) this.w.log(`The gate of ${k.site.name} has been breached!`, 'realm');
    this.w.events.push({ type: 'breach', keep: k.index });
  }

  lordSlain(lord: Entity, killer: Entity) {
    const k = this.keeps[lord.keep!];
    let best: Team = killer.realm, bv = -1;
    for (const [r, v] of k.attackers) if (r !== k.owner && v > bv) { bv = v; best = r; }
    if (best === k.owner || best === -1) return;
    const from = k.owner;
    k.owner = best;
    k.capturedAt = this.w.t;
    k.attackers.clear();
    this.history.push({ t: this.w.t, keep: k.index, from, to: best });
    this.w.events.push({ type: 'capture', keep: k.index, realm: best });
    const p = this.w.player;
    if (p) {
      this.w.log(`${REALM_DEFS[best as RealmId].name} has captured ${k.site.name}!`, 'realm');
      if (p.realm === best && dist(p, k.site) < 120 && !p.dead) {
        this.w.gainRp(400);
        this.w.gainXp(Math.round(800 + this.w.char!.level * 120), ' (keep captured)');
      }
    }
    // Lord and garrison of the new owner arrive at once; the old ones are gone.
    this.garrisonLater(k);
    for (const b of this.bands) if (b.objective === k.index && b.realm === best) { b.mode = 'hold'; b.holdUntil = this.w.t + 45; }
  }

  private garrisonLater(k: KeepState) {
    // Remove the dead lord's corpse later; garrison now with a partial guard.
    this.garrison(k, false);
  }

  scheduleRespawn(e: Entity) {
    this.respawns.push({ at: this.w.t + (e.respawn ?? 60), def: e.mob!, level: e.level, x: e.spawn.x, z: e.spawn.z, named: e.named ? e.name : undefined, delay: e.respawn ?? 60 });
  }

  everySecond() {
    const w = this.w;
    // monster respawns
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      if (w.t < r.at) continue;
      // don't pop up in someone's face
      const p = w.player;
      if (p && !p.dead && Math.hypot(p.x - r.x, p.z - r.z) < 25) { r.at = w.t + 5; continue; }
      this.respawns.splice(i, 1);
      const m = w.makeMob(r.def, r.level, r.x, r.z, r.named);
      m.respawn = r.delay;
      w.add(m);
    }
    // keep upkeep: refill guards when quiet; rebuild a broken gate after a while
    for (const k of this.keeps) {
      for (const [r, v] of k.attackers) k.attackers.set(r, v * 0.995);
      const quiet = w.t - k.lastAttacked > 30;
      k.guardIds = k.guardIds.filter((id) => {
        const g = w.get(id);
        return g && !g.dead;
      });
      if (quiet && w.t >= k.refillAt && k.guardIds.length < GUARD_SLOTS.length) {
        const used = new Set(k.guardIds.map((id) => (w.get(id) as Entity & { slot?: number }).slot));
        const slot = GUARD_SLOTS.findIndex((_, i) => !used.has(i));
        if (slot >= 0) this.addGuard(k, slot);
        k.refillAt = w.t + 25;
      }
      const door = w.get(k.doorId);
      if (door?.dead && w.t - k.lastAttacked > 90) {
        w.remove(door);
        const gp = w.keepToWorld(k.site, KEEP_HALF, 0);
        const nd = w.makeCombatant('door', 'warden', 0, 24, gp.x, gp.z, k.site.name, 1, 0);
        Object.assign(nd, { realm: k.owner, cls: undefined, maxHp: DOOR_HP, hp: DOOR_HP, af: armorAf(24), radius: 3.4, speed: 0, parry: 0, block: 0, evade: 0, shield: false, facing: k.site.facing, keep: k.index });
        w.add(nd);
        k.doorId = nd.id;
      }
      const lord = w.get(k.lordId);
      if (lord?.dead && w.t - lord.deadAt > 15) {
        // the lord was killed but the keep held (no other realm had the most damage): a new lord arrives
        w.remove(lord);
        const lp = w.keepToWorld(k.site, -10, 0);
        const nl = w.makeCombatant('lord', 'warden', (k.owner === -1 ? 0 : k.owner) as RealmId, 22, lp.x, lp.z, lord.name, 5, 1.4);
        Object.assign(nl, { realm: k.owner, keep: k.index, scale: 1.25, look: lord.look });
        nl.ai.post = { x: lp.x, z: lp.z, facing: k.site.facing };
        w.add(nl);
        k.lordId = nl.id;
      }
    }
    this.director();
  }

  private director() {
    const w = this.w;
    for (const b of this.bands) b.members = b.members.filter((id) => { const e = w.get(id); return e && !e.dead; });
    this.bands = this.bands.filter((b) => b.members.length > 0);
    for (const r of REALM_DEFS) {
      const mine = this.bands.filter((b) => b.realm === r.id);
      const count = mine.reduce((s, b) => s + b.members.length, 0);
      // Defend: send the nearest marching band to a keep under attack.
      for (const k of this.keeps) {
        if (k.owner !== r.id || w.t - k.lastAttacked > 15) continue;
        if (mine.some((b) => b.objective === k.index)) continue;
        const free = mine.filter((b) => !b.defend && b.mode === 'march').sort((a, b) => this.bandDist(a, k) - this.bandDist(b, k))[0];
        if (free && this.bandDist(free, k) < 450) { free.objective = k.index; free.defend = true; free.mode = 'march'; }
      }
      for (const b of mine) {
        const k = this.keeps[b.objective];
        if (b.follow !== undefined) {
          const p = w.get(b.follow);
          const lead = w.get(b.members[0]);
          if (!p || p.dead || !lead || dist(p, lead) > 160 || Math.hypot(p.x, p.z) > 620) {
            b.follow = undefined;
            b.mode = 'march';
            b.objective = this.pickObjective(r.id, b);
            if (p && !p.dead && w.player === p) w.log(`[Realm] ${lead?.name ?? 'Your warband'}: We can't follow you there. Back to the fight at ${this.keeps[b.objective].site.name}!`, 'chat');
          }
          continue;
        }
        if (b.mode === 'hold' && w.t > b.holdUntil) {
          b.objective = this.pickObjective(r.id, b);
          b.mode = 'march';
          b.defend = false;
        } else if (k.owner === r.id && b.mode !== 'hold' && (!b.defend || w.t - k.lastAttacked > 25)) {
          b.mode = 'hold';
          b.holdUntil = w.t + (b.defend ? 20 : 40);
        }
      }
      // Bands gathered outside the same keep storm it together.
      const rallies = new Map<number, Warband[]>();
      for (const b of mine) if (b.mode === 'rally') rallies.set(b.objective, [...(rallies.get(b.objective) ?? []), b]);
      for (const group of rallies.values()) {
        const n = group.reduce((s, b) => s + b.members.length, 0);
        const waited = Math.min(...group.map((b) => b.rallyAt));
        const lead = group[0];
        const k = this.keeps[lead.objective];
        const door = w.get(k.doorId);
        if (n >= RALLY_SIZE || w.t - waited > 70 || !door || door.dead || lead.defend) {
          for (const b of group) b.mode = 'siege';
          const p = w.player;
          if (p && p.realm === r.id && dist(p, k.site) < 300) w.log(`[Realm] ${w.get(lead.members[0])?.name}: Storming ${k.site.name}, everyone in!`, 'chat');
        }
      }
      if (w.t >= this.nextBand[r.id] && count < BAND_CAP) {
        this.nextBand[r.id] = w.t + this.rng.range(45, 65);
        this.spawnBand(r.id);
      }
    }
  }

  private bandDist(b: Warband, k: KeepState) {
    const l = this.w.get(b.members[0]);
    return l ? dist(l, k.site) : 1e9;
  }

  private pickObjective(realm: RealmId, b?: Warband): number {
    const w = this.w;
    const lead = b ? w.get(b.members[0]) : undefined;
    const from = lead ?? siteById(`gate${realm}`);
    const owned = [0, 0, 0];
    for (const k of this.keeps) if (k.owner !== -1) owned[k.owner as number]++;
    // under attack and ours: defend first
    const threatened = this.keeps.find((k) => k.owner === realm && w.t - k.lastAttacked < 15 && !this.bands.some((x) => x.realm === realm && x.objective === k.index));
    if (threatened) {
      if (b) b.defend = true;
      return threatened.index;
    }
    const cands = this.keeps.filter((k) => k.owner !== realm);
    if (!cands.length) return this.keeps.find((k) => k.owner === realm)!.index;
    const pick = this.rng.weighted(cands, (k) => {
      const d = Math.max(80, dist(from, k.site));
      let wgt = 1 / Math.pow(d / 100, 1.6);
      if (k.owner === -1) wgt *= 1.4;
      else wgt *= 1 + 0.45 * Math.max(0, owned[k.owner as number] - 2);
      if (this.bands.some((x) => x.realm === realm && x.objective === k.index)) wgt *= 1.6; // join the push
      return wgt;
    });
    return pick.index;
  }

  spawnBand(realm: RealmId, size?: number) {
    const w = this.w;
    const g = siteById(`gate${realm}`);
    const b: Warband = { id: this.bandSeq++, realm, members: [], objective: 0, mode: 'march', holdUntil: 0, defend: false, rallyAt: 0 };
    b.objective = this.pickObjective(realm, b);
    const n = size ?? this.rng.int(6, 9);
    const rr = () => this.rng.next();
    for (let i = 0; i < n; i++) {
      const cls = i === 0 ? 'warden' : this.rng.weighted(CLASS_IDS, (c) => (c === 'warden' ? 0.32 : c === 'cleric' ? 0.26 : 0.21));
      const x = g.x + Math.cos(g.facing) * (12 + this.rng.range(0, 8)) + this.rng.range(-5, 5);
      const z = g.z + Math.sin(g.facing) * (12 + this.rng.range(0, 8)) + this.rng.range(-5, 5);
      const e = w.makeCombatant('soldier', cls, realm, this.rng.int(16, 20), x, z, realmName(realm, rr));
      e.warband = b.id;
      e.ai.mode = 'march';
      e.ai.offset = { x: -3 - Math.floor(i / 3) * 3, z: ((i % 3) - 1) * 3.2 };
      e.facing = g.facing;
      w.add(e);
      b.members.push(e.id);
    }
    this.bands.push(b);
    const p = w.player;
    if (p && p.realm === realm && w.t > 30) {
      const name = w.get(b.members[0])!.name;
      w.log(`[Realm] ${name}: Warband of ${n} forming at ${g.name}, heading for ${this.keeps[b.objective].site.name}!`, 'chat');
    }
    return b;
  }

  band(e: Entity) {
    return this.bands.find((b) => b.id === e.warband);
  }

  /** Where a soldier should stay near: its warband leader. */
  anchorOf(e: Entity): { x: number; z: number } | null {
    const b = this.band(e);
    if (!b) return null;
    if (b.follow !== undefined) return this.w.get(b.follow) ?? null;
    const lead = this.w.get(b.members[0]);
    if (!lead || lead === e) return { x: e.x, z: e.z };
    return lead;
  }

  soldierMove(e: Entity, dt: number) {
    const w = this.w;
    const b = this.band(e);
    if (!b) return;
    const k = this.keeps[b.objective];
    const lead = w.get(b.members[0])!;
    const H = KEEP_HALF;
    if (b.follow !== undefined) {
      const p = w.get(b.follow);
      if (p) {
        const i = b.members.indexOf(e.id);
        const o = { x: -3.5 - Math.floor(i / 3) * 2.8, z: ((i % 3) - 1) * 3 };
        const cs = Math.cos(p.facing), sn = Math.sin(p.facing);
        const tx = p.x + o.x * cs - o.z * sn, tz = p.z + o.x * sn + o.z * cs;
        const d = Math.hypot(tx - e.x, tz - e.z);
        if (d > 1.2) {
          e.sprinting = d > 12;
          w.moveToward(e, tx, tz, dt, 0.6, d > 6 ? 1.25 : 0.95);
        } else {
          e.sprinting = false;
          e.facing = p.facing;
        }
        return;
      }
    }
    if (b.mode === 'march' || b.mode === 'siege' || b.mode === 'rally') {
      const gateOut = w.keepToWorld(k.site, H + 12, 0);
      const rally = w.keepToWorld(k.site, H + 60, 0);
      const theirs = k.owner !== b.realm;
      if (theirs && b.mode === 'march' && (dist(lead, rally) < 14 || dist(lead, gateOut) < 30)) {
        b.mode = b.defend ? 'siege' : 'rally';
        b.rallyAt = w.t;
      }
      if (b.mode === 'rally' && e === lead) {
        e.facing = angleTo(e, k.site);
        return;
      }
      if (b.mode === 'siege' && theirs) {
        const door = w.get(k.doorId);
        if (door && !door.dead) {
          e.target = door.id;
          e.ai.mode = 'combat';
          w.moveToward(e, door.x, door.z, dt, 2 + door.radius);
          return;
        }
        const lord = w.get(k.lordId);
        if (lord && !lord.dead) {
          e.target = lord.id;
          e.ai.mode = 'combat';
          w.moveToward(e, lord.x, lord.z, dt, 2);
          return;
        }
        const inside = w.keepToWorld(k.site, -4, 0);
        w.moveToward(e, inside.x, inside.z, dt, 3);
        return;
      }
      if (e === lead && b.mode === 'march') {
        const dest = theirs && !b.defend ? rally : gateOut;
        w.moveToward(e, dest.x, dest.z, dt, 2, 0.8);
        return;
      }
    }
    if (b.mode === 'hold' && e === lead) {
      const inner = w.keepToWorld(k.site, 0, 0);
      w.moveToward(e, inner.x, inner.z, dt, 4, 0.7);
      return;
    }
    // follow the leader in formation
    const o = e.ai.offset ?? { x: -3, z: 0 };
    const cs = Math.cos(lead.facing), sn = Math.sin(lead.facing);
    const tx = lead.x + o.x * cs - o.z * sn, tz = lead.z + o.x * sn + o.z * cs;
    const d = Math.hypot(tx - e.x, tz - e.z);
    if (d > 1) w.moveToward(e, tx, tz, dt, 0.5, d > 8 ? 1.15 : 0.85);
    else e.facing = lead.facing;
  }

  /** The player takes command of the warband this soldier belongs to. */
  lead(soldier: Entity, player: Entity): Warband | null {
    const b = this.band(soldier);
    if (!b || b.realm !== player.realm) return null;
    for (const o of this.bands) if (o.follow === player.id && o !== b) o.follow = undefined;
    b.follow = player.id;
    return b;
  }

  release(player: Entity) {
    for (const b of this.bands) {
      if (b.follow !== player.id) continue;
      b.follow = undefined;
      b.mode = 'march';
      b.objective = this.pickObjective(b.realm, b);
    }
  }

  ledBy(player: Entity): Warband | undefined {
    return this.bands.find((b) => b.follow === player.id);
  }

  ambientChat() {
    const w = this.w;
    const p = w.player!;
    const zone = w.geo.zoneAt(p.x, p.z);
    const r = this.rng;
    if (zone.kind === 'home' && zone.realm === p.realm) {
      const advs = w.list.filter((e) => e.kind === 'adventurer' && e.realm === p.realm && !e.dead);
      if (!advs.length) return;
      const a = r.pick(advs);
      const mobs = Object.values(MOB_BY_ID).filter((m) => m.levels[0] <= a.level + 2 && m.levels[1] >= a.level - 2 && (!m.realms || m.realms.includes(p.realm as RealmId)));
      const mob = mobs.length ? r.pick(mobs).name : 'wolf';
      const owned = this.keeps.filter((k) => k.owner === p.realm);
      const lost = this.keeps.filter((k) => k.owner !== p.realm && k.site.realm === p.realm);
      const lines = [
        `LFG ${mob}s, anyone?`,
        `where do the ${mob}s spawn?`,
        `just dinged ${a.level}!`,
        `anyone else think ${mob}s hit way too hard`,
        `who's heading to the frontier tonight?`,
        `selling a Fine ${r.pick(['Broadsword', 'Longbow', 'Runed Staff', 'Hauberk', 'Jerkin'])}, pst`,
        `brb`,
        `how do I get to ${REALM_DEFS[p.realm as RealmId].gate}? talk to the porter in town?`,
        `train of ${mob}s coming down the road, sorry!!`,
      ];
      if (owned.length) lines.push(`${r.pick(owned).site.name} is still ours, nice work out there`);
      if (lost.length) lines.push(`we need to take back ${r.pick(lost).site.name}, any takers?`);
      w.log(`[Region] ${a.name}: ${r.pick(lines)}`, 'chat');
    } else if (zone.kind === 'frontier') {
      const sol = w.list.filter((e) => e.kind === 'soldier' && e.realm === p.realm && !e.dead);
      if (!sol.length) return;
      const s = r.pick(sol);
      const b = this.band(s);
      if (!b) return;
      const k = this.keeps[b.objective];
      const lines = b.mode === 'siege' ? [`on the gate of ${k.site.name}, need more bodies!`, `healers to ${k.site.name}!`] :
        b.mode === 'hold' ? [`holding ${k.site.name}`, `${k.site.name} is secure for now`] :
        [`moving on ${k.site.name}`, `group up, heading to ${k.site.name}`, `eyes open, enemies spotted near ${k.site.name}`];
      w.log(`[Realm] ${s.name}: ${r.pick(lines)}`, 'chat');
    }
  }
}

export { angleTo };
