import { allocStat, computeStats, learnSkill, requirementError, slotsFor } from '../src/game/character';
import { baseOf, type ClassId, type Item } from '../src/game/items';
import { heatOdds } from '../src/game/forge';
import { SKILL_BY_ID } from '../src/game/skills';
import { SLAG_BRITTLE, type World } from '../src/game/world';
import { makeWorld } from './helpers';

export const ACT = ['cinder_fields', 'hollow_cave', 'gloomwood', 'sunken_chapel', 'catacombs1', 'catacombs2', 'hellforge'];
export const ACT3 = ['rimefall_pass', 'drowned_mines', 'bellfounders_halls', 'cold_furnace', 'hellforge_heart'];
export const ACT2 = ['ashfall_road', 'whisper_cistern', 'glass_sea', 'carrion_mesa', 'buried_bazaar', 'hall_of_dials', 'noon_vault'];

const PLAN: Record<ClassId, string[]> = {
  reaver: ['bash', 'iron_skin', 'bash', 'bash', 'bash', 'weapon_mastery', 'war_cry', 'weapon_mastery', 'iron_skin', 'weapon_mastery', 'frenzy', 'frenzy', 'frenzy', 'frenzy', 'frenzy', 'weapon_mastery', 'frenzy', 'frenzy'],
  arcanist: ['fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'ice_bolt', 'frost_shell', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'teleport', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'fireball', 'fireball', 'fireball'],
  necromancer: ['raise_skeleton', 'raise_skeleton', 'bone_shards', 'raise_skeleton', 'frailty', 'skeletal_mastery', 'skeletal_mastery', 'raise_skeleton', 'skeletal_mastery', 'bone_ward', 'raise_skeleton', 'grave_golem', 'skeletal_mastery', 'raise_skeleton', 'bone_shards', 'skeletal_mastery', 'raise_skeleton', 'corpse_burst', 'bone_lance', 'bone_lance', 'bone_lance'],
  forgewright: ['ballista', 'temper', 'sunder', 'sunder', 'slag_burst', 'anvil_drop', 'sunder', 'temper', 'ballista', 'sunder', 'shockwave', 'brass_sentinel', 'shockwave', 'bellows', 'shockwave', 'gearwork', 'furnace', 'shockwave', 'slag_burst', 'white_heat', 'shockwave', 'gearwork', 'earthshaker', 'earthshaker', 'temper'],
  huntress: ['power_shot', 'critical_eye', 'power_shot', 'power_shot', 'power_shot', 'multishot', 'multishot', 'multishot', 'multishot', 'multishot', 'evade', 'multishot', 'multishot', 'multishot', 'multishot', 'multishot', 'strafe', 'strafe'],
};
const MAIN: Record<ClassId, string[]> = { reaver: ['frenzy', 'bash'], arcanist: ['fireball', 'fire_bolt'], huntress: ['multishot', 'power_shot'], necromancer: ['bone_lance', 'bone_shards'], forgewright: ['shockwave', 'sunder'] };

function score(w: World, it: Item): number {
  const b = baseOf(it);
  const c = w.char;
  const before = computeStats(c);
  const slot = slotsFor(it)[0];
  const old = c.equipment[slot];
  c.equipment[slot] = it;
  const after = computeStats(c);
  if (old) c.equipment[slot] = old;
  else delete c.equipment[slot];
  if (b.kind === 'weapon') {
    const want = c.classId === 'huntress' ? 'bow' : c.classId === 'arcanist' ? 'staff' : null;
    if (want === 'bow' && b.cat !== 'bow') return -1;
    if ((c.classId === 'reaver' || c.classId === 'forgewright') && (b.cat === 'bow' || b.cat === 'wand' || b.cat === 'staff')) return -1;
    if (c.classId === 'arcanist' || c.classId === 'necromancer') return after.skillBonus - before.skillBonus + (after.maxLife - before.maxLife) / 20;
    return (after.minDmg + after.maxDmg) * after.attackSpeed - (before.minDmg + before.maxDmg) * before.attackSpeed;
  }
  if (b.kind === 'shield' && c.equipment.weapon && baseOf(c.equipment.weapon).twoHanded) return -1;
  const r = after.res;
  const r0 = before.res;
  return (after.def - before.def) / 4 + (after.maxLife - before.maxLife) + (r.fire + r.cold + r.light + r.poison - r0.fire - r0.cold - r0.light - r0.poison) / 3 + (after.skillBonus - before.skillBonus) * 30;
}

/** Keep the army up: raise skeletons from fresh corpses, re-make the golem, ward and curse. */
function necroThink(w: World) {
  const c = w.char;
  const p = w.player;
  const lvl = (id: string) => c.skills[id] ?? 0;
  const skels = w.minions.filter((m) => m.ally === 'skeleton').length;
  const max = lvl('raise_skeleton') ? SKILL_BY_ID.raise_skeleton.params(lvl('raise_skeleton')).count! : 0;
  const corpse = w.findCorpse(p.x, p.y, 9);
  if (lvl('bone_ward') && !p.buffs.bone_ward && p.mana > 30) return w.cmdSkill('bone_ward', p.x, p.y);
  if (lvl('grave_golem') && !w.minions.some((m) => m.ally === 'golem') && p.mana > 40) return w.cmdSkill('grave_golem', p.x + 1, p.y);
  if (corpse && skels < max) return w.cmdSkill('raise_skeleton', corpse.x, corpse.y);
  const boss = w.area.monsters.find((m) => !m.dead && m.superId && Math.hypot(m.x - p.x, m.y - p.y) < 8);
  if (lvl('frailty') && boss && !(boss.curse && boss.curse.t > 0)) w.cmdSkill('frailty', boss.x, boss.y);
}

/**
 * Act 3's rules. Roll through a bell's toll just before it arrives, and when the ember is nearly out,
 * walk to the nearest brazier (touching it lights it) rather than fight on in the cold.
 */
function emberThink(w: World, t: number, seek: { since: number; restUntil: number }): boolean {
  const p = w.player;
  for (const g of w.area.rings) {
    const gap = Math.hypot(p.x - g.x, p.y - g.y) - g.r;
    if (!g.passed && gap > -0.2 && gap < 1.1 && w.cmdDodge({ x: g.x - p.x, y: g.y - p.y })) return true;
  }
  if (!w.cold || w.ember > 0.15 || w.nearFire || p.action || t < seek.restUntil) {
    seek.since = -1;
    return false;
  }
  // A brazier that cannot be reached in a few seconds is not worth dying for: fight on, and try again later.
  if (seek.since < 0) seek.since = t;
  if (t - seek.since > 7) {
    seek.restUntil = t + 15;
    w.stop();
    return false;
  }
  let best: { x: number; y: number } | null = null;
  let bd = 16;
  for (const o of w.area.objects) {
    if (o.kind !== 'brazier') continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < bd) (bd = d), (best = o);
  }
  if (!best) return false;
  if (p.intent?.kind !== 'move' || !p.path.length) w.cmdMoveTo(best.x, best.y);
  return true;
}

/** Test hook for looking over the bot's shoulder. */
export let DEBUG: ((w: World, t: number) => void) | undefined;
export const setDebug = (f: typeof DEBUG) => (DEBUG = f);

/** Keep the workshop running: vent Heat before it burns, keep the sentinel wound and turrets up, light the furnace when hurt. */
function forgeThink(w: World) {
  const c = w.char;
  const p = w.player;
  const has = (id: string) => (c.skills[id] ?? 0) > 0 && SKILL_BY_ID[id].mana(c.skills[id]) <= p.mana;
  const near = (r: number) => w.area.monsters.find((m) => !m.dead && !m.sub && Math.hypot(m.x - p.x, m.y - p.y) < r);
  const up = (id: string) => w.constructCount(id);
  if (c.skills.slag_burst && (p.overheat || p.heat >= 80) && near(4)) return w.cmdSkill('slag_burst', p.x, p.y);
  if (has('brass_sentinel') && !up('brass_sentinel')!.alive) return w.cmdAutoSkill('brass_sentinel');
  if (!near(9)) return;
  if (has('ballista') && up('ballista')!.alive < up('ballista')!.max) return w.cmdAutoSkill('ballista');
  if (has('furnace') && !up('furnace')!.alive && p.life < w.stats.maxLife * 0.6) return w.cmdAutoSkill('furnace');
  if (has('bellows') && !up('bellows')!.alive && near(4)) return w.cmdAutoSkill('bellows');
  const boss = w.area.monsters.find((m) => !m.dead && m.superId && Math.hypot(m.x - p.x, m.y - p.y) < 8);
  if (boss && has('white_heat') && !p.buffs.white_heat && !p.overheat) return w.cmdSkill('white_heat', p.x, p.y);
  if (boss && has('anvil_drop') && p.mana > 20) w.cmdSkill('anvil_drop', boss.x, boss.y, boss.id);
}

export interface AreaReport {
  area: string;
  enterLevel: number;
  time: number;
  deaths: number;
  potions: number;
  killed: number;
  total: number;
  bossDead: boolean;
  weapon: string;
  /** Forge levels on worn gear when the hero left (only a bot that uses the forge has any). */
  forged: number;
  /** Seconds spent with frostbite at full, taking damage from the cold. */
  frozen: number;
  /** Braziers alight when the hero left. */
  braziers: number;
}

/** Plays the act end to end without town trips; infinite potions are counted, not limited. */
/** With `forge`, loot is salvaged rather than sold and the Cinders go into heating worn gear as far as it is safe. */
export function playAct(classId: ClassId, seed: number, maxPerArea = 900, route = ACT, opts: { forge?: boolean } = {}): AreaReport[] {
  const w = makeWorld(classId, seed);
  const c = w.char;
  const reports: AreaReport[] = [];
  let planIdx = 0;
  for (const area of route) {
    w.enterArea(area, 'start');
    const rep: AreaReport = { area, enterLevel: c.level, time: 0, deaths: 0, potions: 0, killed: 0, total: w.area.monsters.length, bossDead: false, weapon: '', forged: 0, frozen: 0, braziers: 0 };
    let t = 0;
    let think = 0;
    let lastPos = { x: 0, y: 0, t: 0 };
    let lastKill = { n: -1, t: 0 };
    const seek = { since: -1, restUntil: 0 };
    let still = { x: 0, y: 0, t: 0 };
    while (t < maxPerArea) {
      const dt = 1 / 30;
      t += dt;
      think -= dt;
      if (w.player.dead) {
        rep.deaths++;
        w.respawn();
        w.enterArea(area, 'start');
      }
      // Chasing something past the way in can carry the hero out of the area: turn round and come back.
      if (w.area.def.id !== area) w.enterArea(area, 'start');
      const p = w.player;
      const s = w.stats;
      if (p.life < s.maxLife * 0.4 && !p.heal.length) (p.heal.push({ hp: s.maxLife * 0.5, mp: 0, t: 3 }), rep.potions++);
      if (p.mana < s.maxMana * 0.15 && !p.heal.some((h) => h.mp)) (p.heal.push({ hp: 0, mp: s.maxMana * 0.6, t: 3 }), rep.potions++);
      if (think <= 0) {
        think = 0.5;
        while (c.statPoints > 0) {
          const st = computeStats(c);
          if (classId === 'reaver') allocStat(c, st.str < 60 ? 'str' : 'vit');
          else if (classId === 'forgewright') allocStat(c, st.str < 75 ? 'str' : 'vit');
          else if (classId === 'huntress') allocStat(c, st.dex < 70 ? 'dex' : 'vit');
          else allocStat(c, c.alloc.vit <= c.alloc.ene * 2 ? 'vit' : 'ene');
        }
        while (c.skillPoints > 0 && planIdx < PLAN[classId].length * 3) {
          const id = PLAN[classId][planIdx % PLAN[classId].length];
          if (learnSkill(c, id)) planIdx++;
          else if (!learnSkill(c, MAIN[classId][1])) break;
        }
        for (const e of c.inventory.slice()) {
          e.item.identified = true;
          const b = baseOf(e.item);
          if (!slotsFor(e.item).length || requirementError(c, e.item)) continue;
          if (score(w, e.item) > 0) w.equip(e.item.uid);
          else if (opts.forge && w.forge({ type: 'salvage', uid: e.item.uid }).ok) continue;
          else if (b.kind !== 'potion') w.sell(e.item.uid);
        }
        if (opts.forge) {
          // Weapon first, then armor, and only while a heat cannot fail.
          for (const it of [c.equipment.weapon, c.equipment.body, c.equipment.head, c.equipment.offhand]) {
            while (it && heatOdds(c, it).success === 100 && w.forge({ type: 'heat', uid: it.uid }).ok);
          }
        }
        if (c.skills.frost_shell && !p.buffs.frost_shell && p.mana > 20) w.cmdSkill('frost_shell', p.x, p.y);
        if (classId === 'necromancer' && !p.action) necroThink(w);
        if (classId === 'forgewright' && !p.action) forgeThink(w);
        // Unstick: if we have not moved for a while, wander.
        if (Math.hypot(p.x - lastPos.x, p.y - lastPos.y) > 0.5) lastPos = { x: p.x, y: p.y, t };
      }
      DEBUG?.(w, t);
      // Walking somewhere but going nowhere (snagged on a corner): step back onto the middle of the tile.
      if (Math.hypot(w.player.x - still.x, w.player.y - still.y) > 0.05 || w.player.intent?.kind !== 'move') still = { x: w.player.x, y: w.player.y, t };
      else if (t - still.t > 1.5) {
        const cx = Math.floor(w.player.x) + 0.5 - w.player.x;
        const cy = Math.floor(w.player.y) + 0.5 - w.player.y;
        w.stop();
        if (Math.hypot(cx, cy) > 0.05) w.cmdDodge({ x: cx, y: cy });
        still.t = t;
      }
      w.refreshStats();
      if (w.frost >= 1) rep.frozen += dt;
      if (emberThink(w, t, seek)) {
        w.step(dt);
        continue;
      }
      for (const g of w.area.ground.slice()) if (Math.hypot(g.x - p.x, g.y - p.y) < 3 && (g.gold || (g.item && (g.item.rarity !== 'normal' || slotsFor(g.item).length)))) w.pickup(g);
      if (!p.action && !p.intent) {
        // A boss behind a phylactery cannot be hurt: go for the phylactery.
        const warded = (m: { wardId?: number }) => m.wardId !== undefined && w.area.monsters.some((o) => o.id === m.wardId && !o.dead);
        const all = w.area.monsters.filter((m) => !m.dead);
        const live = all.some((m) => !warded(m)) ? all.filter((m) => !warded(m)) : all;
        if (!all.length) break;
        const boss = all.find((m) => m.superId);
        const alive = live.length / Math.max(1, rep.total);
        if (alive < 0.12 && !boss) break;
        live.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        const m = live[0];
        // Nothing has died for a while and the nearest monster is out of reach: stop shooting at walls and walk to it.
        if (all.length !== lastKill.n) lastKill = { n: all.length, t };
        if (t - lastKill.t > 8 && Math.hypot(m.x - p.x, m.y - p.y) > 10) {
          w.cmdMoveTo(m.x, m.y);
          w.step(dt);
          continue;
        }
        let skill = MAIN[classId].find((id) => (c.skills[id] ?? 0) > 0 && SKILL_BY_ID[id].mana(c.skills[id]) <= p.mana) ?? 'attack';
        // Fire stokes a Slag Golem: an Arcanist tempers it brittle with ice first, then goes back to fire.
        if (m.def.slag && (m.heat ?? 0) > SLAG_BRITTLE && (c.skills.ice_bolt ?? 0) > 0 && SKILL_BY_ID.ice_bolt.mana(c.skills.ice_bolt) <= p.mana) skill = 'ice_bolt';
        w.cmdSkill(skill, m.x, m.y, m.id);
      }
      w.step(dt);
    }
    rep.time = Math.round(t);
    rep.bossDead = !w.area.monsters.some((m) => m.superId && !m.dead);
    rep.forged = Object.values(c.equipment).reduce((n, it) => n + (it?.forge ?? 0), 0);
    rep.weapon = c.equipment.weapon ? `${c.equipment.weapon.base}/${c.equipment.weapon.rarity}` : '-';
    rep.killed = rep.total - w.area.monsters.filter((m) => !m.dead && !m.summoned).length;
    rep.braziers = w.area.objects.filter((o) => o.kind === 'brazier' && o.used).length;
    reports.push(rep);
  }
  return reports;
}
