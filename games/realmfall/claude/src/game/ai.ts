/** How monsters, soldiers, guards and wandering adventurers decide what to do. */
import { ABILITIES, conColor } from './data';
import { siteById, homeLevel, FRONTIER_R } from './geo';
import type { Entity } from './types';
import { dist, angleTo, type World } from './world';

const LEASH = 70;

function validTarget(w: World, e: Entity): Entity | null {
  const t = w.get(e.target);
  if (!t || t.dead || !w.hostile(e, t)) return null;
  return t;
}

function topThreat(w: World, e: Entity): Entity | null {
  let best: Entity | null = null, bv = -1;
  for (const [id, v] of e.threat) {
    const o = w.get(id);
    if (!o || o.dead || !w.hostile(e, o)) {
      e.threat.delete(id);
      continue;
    }
    if (dist(e, o) > 90) continue;
    if (v > bv) { bv = v; best = o; }
  }
  const taunt = e.effects.find((f) => f.type === 'taunt');
  if (taunt) {
    const t = w.get(taunt.src);
    if (t && !t.dead) return t;
  }
  return best;
}

function try_(w: World, e: Entity, ab: string, target: Entity | null = null): boolean {
  if (!e.abilities.includes(ab)) return false;
  if ((e.cds[ab] ?? 0) > w.t || e.cast) return false;
  const tgt = target ?? w.get(e.target);
  if (w.canUse(e, ab, tgt) !== null) return false;
  return w.useAbility(e, ab, tgt?.id ?? null) === null;
}

/** Walks into weapon or spell range of the target and fights. */
function fight(w: World, e: Entity, t: Entity, dt: number) {
  e.target = t.id;
  e.attacking = true;
  const d = dist(e, t) - t.radius - e.radius;
  const cls = e.cls;
  const mob = e.mob;
  const caster = cls === 'runecaller' || mob?.caster;
  const archer = cls === 'ranger' || mob?.ranged;
  const wantRange = caster ? 26 : archer ? 24 : e.weapon.range - 0.3;

  // Healing comes first for clerics.
  if (cls === 'cleric' && !e.cast) {
    if (healSomeone(w, e)) return;
  }

  if (e.cast) {
    e.facing = angleTo(e, t);
    return;
  }

  // Kiting: casters push away from melee once they have rooted it.
  if (caster && d < 7 && !mob) {
    if (try_(w, e, 'flame_ring')) return;
    if (!w.has(t, 'root') && try_(w, e, 'root', t)) return;
    if (w.has(t, 'root') || w.has(t, 'snare')) {
      const a = angleTo(t, e);
      w.moveToward(e, e.x + Math.cos(a) * 10, e.z + Math.sin(a) * 10, dt);
      return;
    }
  }

  if (d > wantRange) {
    const stop = (caster || archer ? wantRange : e.weapon.range - 0.5) + t.radius + e.radius;
    w.moveToward(e, t.x, t.z, dt, stop * 0.95);
    // instants while closing
    if (cls === 'ranger' && d < 40) try_(w, e, 'quick_shot', t);
    return;
  }
  e.facing = angleTo(e, t);

  if (mob) {
    if (mob.caster && d > 5 && (e.cds.bog_bolt ?? 0) <= w.t && w.rng.chance(0.5)) {
      w.useAbility(e, 'bog_bolt', t.id);
      e.cds.bog_bolt = w.t + w.rng.range(5, 8);
      return;
    }
    if (mob.caster && d > e.weapon.range) {
      w.moveToward(e, t.x, t.z, dt, e.weapon.range * 0.9 + t.radius + e.radius);
      return;
    }
    if (e.abilities.includes('slam') && d < 5 && (e.cds.slam ?? 0) <= w.t) w.useAbility(e, 'slam', t.id);
    if (e.abilities.includes('venom') && !e.queuedStyle && w.rng.chance(0.02)) e.queuedStyle = 'venom';
    return;
  }

  switch (cls) {
    case 'warden': {
      if (t.cast && try_(w, e, 'shield_bash', t)) return;
      if (e.hp < e.maxHp * 0.5) try_(w, e, 'rally', e);
      if (!e.queuedStyle && e.endu > 20) {
        const ld = e.lastDefense;
        if (ld && ld.kind === 'parry' && w.t - ld.t < 4 && e.abilities.includes('riposte')) e.queuedStyle = 'riposte';
        else if (e.lastStyle?.id === 'backhand' && e.abilities.includes('executioner')) e.queuedStyle = 'executioner';
        else if (e.lastStyle?.id === 'slash' && e.abilities.includes('backhand')) e.queuedStyle = 'backhand';
        else e.queuedStyle = 'slash';
      }
      break;
    }
    case 'ranger': {
      if (d < 5) {
        try_(w, e, 'quick_shot', t);
        if (e.hp < e.maxHp * 0.6) try_(w, e, 'evasion', e);
        return; // melee with the dagger
      }
      if (!w.has(t, 'snare') && t.weapon.range < 6 && try_(w, e, 'crippling_arrow', t)) return;
      if (try_(w, e, 'quick_shot', t)) return;
      if (e.level >= 15 && countNear(w, e, t, 8) >= 3 && try_(w, e, 'volley', t)) return;
      if (e.level >= 11 && t.target !== e.id && try_(w, e, 'critical_shot', t)) return;
      try_(w, e, 'aimed_shot', t);
      break;
    }
    case 'runecaller': {
      if (e.power < e.maxPower * 0.1) return; // melee with the staff
      if (e.hp < e.maxHp * 0.6) try_(w, e, 'arcane_shield', e);
      if (e.level >= 17 && countNear(w, e, t, 9) >= 3 && try_(w, e, 'meteor', t)) return;
      if (!w.has(t, 'snare') && t.weapon.range < 6 && try_(w, e, 'frost_lance', t)) return;
      if (e.level >= 13 && w.rng.chance(0.5) && try_(w, e, 'lightning', t)) return;
      try_(w, e, 'fire_bolt', t);
      break;
    }
    case 'cleric': {
      if (t.cast && try_(w, e, 'holy_stun', t)) return;
      if (d > 6 && e.power > e.maxPower * 0.4) try_(w, e, 'smite', t);
      break;
    }
  }
}

function countNear(w: World, e: Entity, t: Entity, r: number) {
  let n = 0;
  w.near(t.x, t.z, r, (o) => { if (w.hostile(e, o)) n++; });
  return n;
}

function healSomeone(w: World, e: Entity): boolean {
  let best: Entity | null = null, bf = 0.68;
  w.near(e.x, e.z, 30, (o) => {
    if (o !== e && !w.friendly(e, o)) return;
    if (o.kind === 'door') return;
    const f = o.hp / o.maxHp;
    const bias = o.kind === 'player' ? 0.08 : 0;
    if (f - bias < bf) { bf = f - bias; best = o; }
  });
  if (!best) return false;
  const tgt: Entity = best;
  if (!w.has(tgt, 'hot') && try_(w, e, 'renew', tgt)) return true;
  if (e.level >= 16 && countHurt(w, e) >= 3 && try_(w, e, 'sanctuary', e)) return true;
  if (tgt.hp / tgt.maxHp < 0.4 && try_(w, e, 'greater_mend', tgt)) return true;
  return try_(w, e, 'mend', tgt);
}

function countHurt(w: World, e: Entity) {
  let n = 0;
  w.near(e.x, e.z, 15, (o) => { if ((o === e || w.friendly(e, o)) && o.hp < o.maxHp * 0.7) n++; });
  return n;
}

// ---------- monsters ----------

export function thinkMob(w: World, e: Entity, dt: number) {
  const ai = e.ai;
  e.moved = 0;
  if (w.stunned(e)) return;
  const def = e.mob!;
  if (ai.mode === 'return') {
    const left = w.moveToward(e, e.spawn.x, e.spawn.z, dt, 0.5);
    if (left < 1) {
      ai.mode = 'idle';
      e.hp = e.maxHp;
      e.threat.clear();
      e.dmgBy.clear();
    }
    return;
  }
  if (ai.mode === 'combat' || ai.mode === 'flee') {
    const t = topThreat(w, e) ?? validTarget(w, e);
    const far = Math.hypot(e.x - e.spawn.x, e.z - e.spawn.z);
    if (!t || far > LEASH) {
      evade(w, e);
      return;
    }
    if (def.flees && !ai.fled && e.hp < e.maxHp * 0.22) {
      ai.fled = true;
      ai.mode = 'flee';
      ai.restUntil = w.t + 4;
      if (w.player && dist(w.player, e) < 40) w.log(`The ${e.name} turns to flee!`, 'system');
    }
    if (ai.mode === 'flee') {
      if (w.t > (ai.restUntil ?? 0)) ai.mode = 'combat';
      const a = angleTo(t, e);
      e.attacking = false;
      w.moveToward(e, e.x + Math.cos(a) * 10, e.z + Math.sin(a) * 10, dt, 0, 0.8);
      return;
    }
    fight(w, e, t, dt);
    separate(w, e, t);
    return;
  }
  // idle or wandering: look for trouble
  if (def.aggro > 0 && w.t >= ai.think) {
    ai.think = w.t + 0.4 + w.rng.next() * 0.4;
    const t = w.nearest(e, def.aggro * (e.named ? 1.3 : 1), (o) => (o.kind === 'player' || o.kind === 'adventurer' || o.kind === 'soldier') && w.hostile(e, o) && conColor(o.level, e.level) !== 'grey');
    if (t) {
      e.target = t.id;
      e.threat.set(t.id, 1);
      ai.mode = 'combat';
      w.engage(t, e);
      return;
    }
  }
  if (ai.mode === 'idle') {
    if ((ai.wanderAt ?? 0) < w.t) {
      ai.wanderAt = w.t + w.rng.range(6, 18);
      if (w.rng.chance(0.5)) {
        const a = w.rng.range(0, Math.PI * 2), r = w.rng.range(3, 12);
        ai.goal = { x: e.spawn.x + Math.cos(a) * r, z: e.spawn.z + Math.sin(a) * r };
        ai.mode = 'wander';
      }
    }
  } else if (ai.mode === 'wander' && ai.goal) {
    if (w.moveToward(e, ai.goal.x, ai.goal.z, dt, 0.3, 0.35) < 0.5) ai.mode = 'idle';
  }
}

function evade(_w: World, e: Entity) {
  e.ai.mode = 'return';
  e.target = null;
  e.attacking = false;
  e.cast = null;
  e.queuedStyle = null;
  e.threat.clear();
  e.ai.fled = false;
}

/** Keeps melee crowds from standing inside one another. */
function separate(w: World, e: Entity, t: Entity) {
  w.near(e.x, e.z, 2, (o) => {
    if (o === e || o === t || o.dead || o.kind === 'door' || o.kind === 'player') return;
    const dx = e.x - o.x, dz = e.z - o.z;
    const d = Math.hypot(dx, dz);
    const min = e.radius + o.radius;
    if (d > 0.01 && d < min) w.moveBy(e, (dx / d) * (min - d) * 0.3, (dz / d) * (min - d) * 0.3);
  });
}

// ---------- people ----------

export function thinkCombatant(w: World, e: Entity, dt: number) {
  e.moved = 0;
  const ai = e.ai;
  if (w.stunned(e)) return;

  // Choose an enemy.
  let t = topThreat(w, e) ?? validTarget(w, e);
  const engage = e.kind === 'soldier' ? 34 : e.kind === 'guard' ? 30 : e.kind === 'lord' ? 24 : 18;
  if (w.t >= ai.think) {
    ai.think = w.t + 0.35 + w.rng.next() * 0.3;
    if (!t || (e.kind === 'soldier' && t.kind === 'door')) {
      const pred = (o: Entity) =>
        w.hostile(e, o) && o.kind !== 'door' && (e.kind !== 'adventurer' || o.kind === 'mob') && (o.kind !== 'mob' || e.kind === 'guard' || e.kind === 'adventurer' || o.target != null);
      const n = w.nearest(e, engage, pred);
      if (n) t = n;
    }
  }
  // Soldiers following the player fight what the player fights.
  if (e.kind === 'soldier') {
    const b = w.war.band(e);
    const p = b?.follow !== undefined ? w.get(b.follow) : undefined;
    if (p && !p.dead) {
      const pt = w.get(p.target);
      if (pt && w.hostile(e, pt) && dist(p, pt) < 45 && (p.attacking || p.cast || pt.target === p.id || w.t - p.lastCombat < 4)) t = pt;
    }
  }
  if (e.cls === 'cleric' && !e.cast && w.t - e.lastCombat < 12 && healSomeone(w, e)) return;

  // Posts and leashes.
  const anchor = e.ai.post ?? (e.kind === 'soldier' ? w.war.anchorOf(e) : null);
  if (t && anchor) {
    const leash = e.kind === 'soldier' ? 70 : e.kind === 'lord' ? 30 : 48;
    if (Math.hypot(t.x - anchor.x, t.z - anchor.z) > leash) {
      t = null;
      e.threat.clear();
    }
  }

  if (t) {
    ai.mode = 'combat';
    fight(w, e, t, dt);
    return;
  }
  e.attacking = false;
  e.target = null;
  if (e.cast) return;
  if (ai.mode === 'combat') ai.mode = e.kind === 'adventurer' ? 'hunt' : 'idle';

  switch (e.kind) {
    case 'guard':
    case 'lord': {
      const p = ai.post!;
      if (w.moveToward(e, p.x, p.z, dt, 0.4) < 0.6) {
        e.facing = p.facing;
        if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt * 20 * 0.05);
      }
      return;
    }
    case 'soldier':
      w.war.soldierMove(e, dt);
      return;
    case 'adventurer':
      adventure(w, e, dt);
      return;
  }
}

function adventure(w: World, e: Entity, dt: number) {
  const ai = e.ai;
  if (ai.mode === 'rest') {
    if (e.hp >= e.maxHp * 0.95 && e.power >= e.maxPower * 0.9) ai.mode = 'hunt';
    return;
  }
  if (e.hp < e.maxHp * 0.55 || (e.maxPower && e.power < e.maxPower * 0.3)) {
    ai.mode = 'rest';
    return;
  }
  ai.mode = 'hunt';
  let prey = w.get(ai.huntId);
  if (!prey || prey.dead || (prey.target != null && prey.target !== e.id)) {
    prey = undefined;
    ai.huntId = undefined;
    let best: Entity | null = null, bd = 140;
    w.near(e.x, e.z, 140, (o) => {
      if (o.kind !== 'mob' || o.dead || o.ai.mode === 'combat' || o.ai.mode === 'return') return;
      const c = conColor(e.level, o.level);
      if (c !== 'blue' && c !== 'yellow' && c !== 'green') return;
      if (Math.hypot(o.x, o.z) < FRONTIER_R + 20) return;
      const d = dist(e, o);
      if (d < bd) { bd = d; best = o; }
    });
    if (best) ai.huntId = (best as Entity).id;
  }
  prey = w.get(ai.huntId);
  if (prey) {
    const d = dist(e, prey);
    const reach = e.cls === 'runecaller' || e.cls === 'ranger' ? 28 : e.cls === 'cleric' ? 24 : 2.5;
    if (d > reach) w.moveToward(e, prey.x, prey.z, dt, reach - 1);
    else {
      e.target = prey.id;
      w.engage(e, prey);
      ai.mode = 'combat';
    }
    return;
  }
  // nothing near: walk toward ground that suits our level
  if (!ai.goal || Math.hypot(e.x - ai.goal.x, e.z - ai.goal.z) < 6) {
    const town = siteById(`town${e.realm}`);
    const want = 60 + (e.level - 1) * 27;
    for (let i = 0; i < 12; i++) {
      const a = town.facing + w.rng.range(-1.1, 1.1);
      const x = town.x + Math.cos(a) * want, z = town.z + Math.sin(a) * want;
      if (w.geo.ridge(x, z) < 0.15 && Math.hypot(x, z) > FRONTIER_R + 40 && Math.abs(homeLevel(Math.hypot(x - town.x, z - town.z)) - e.level) <= 2) {
        ai.goal = { x, z };
        break;
      }
    }
    ai.goal ??= { x: town.x, z: town.z };
  }
  w.moveToward(e, ai.goal.x, ai.goal.z, dt, 1, 0.85);
}

export { ABILITIES };
