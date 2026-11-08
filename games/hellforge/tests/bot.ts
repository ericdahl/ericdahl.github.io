import { allocStat, computeStats, learnSkill, requirementError, slotsFor } from '../src/game/character';
import { baseOf, type ClassId, type Item } from '../src/game/items';
import { SKILL_BY_ID } from '../src/game/skills';
import type { World } from '../src/game/world';
import { makeWorld } from './helpers';

export const ACT = ['cinder_fields', 'hollow_cave', 'gloomwood', 'sunken_chapel', 'catacombs1', 'catacombs2', 'hellforge'];

const PLAN: Record<ClassId, string[]> = {
  reaver: ['bash', 'iron_skin', 'bash', 'bash', 'bash', 'weapon_mastery', 'war_cry', 'weapon_mastery', 'iron_skin', 'weapon_mastery', 'frenzy', 'frenzy', 'frenzy', 'frenzy', 'frenzy', 'weapon_mastery', 'frenzy', 'frenzy'],
  arcanist: ['fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'ice_bolt', 'frost_shell', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'teleport', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'fire_bolt', 'fireball', 'fireball', 'fireball'],
  necromancer: ['raise_skeleton', 'raise_skeleton', 'bone_shards', 'raise_skeleton', 'frailty', 'skeletal_mastery', 'skeletal_mastery', 'raise_skeleton', 'skeletal_mastery', 'bone_ward', 'raise_skeleton', 'grave_golem', 'skeletal_mastery', 'raise_skeleton', 'bone_shards', 'skeletal_mastery', 'raise_skeleton', 'corpse_burst', 'bone_lance', 'bone_lance', 'bone_lance'],
  huntress: ['power_shot', 'critical_eye', 'power_shot', 'power_shot', 'power_shot', 'multishot', 'multishot', 'multishot', 'multishot', 'multishot', 'evade', 'multishot', 'multishot', 'multishot', 'multishot', 'multishot', 'strafe', 'strafe'],
};
const MAIN: Record<ClassId, string[]> = { reaver: ['frenzy', 'bash'], arcanist: ['fireball', 'fire_bolt'], huntress: ['multishot', 'power_shot'], necromancer: ['bone_lance', 'bone_shards'] };

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
    if (c.classId === 'reaver' && (b.cat === 'bow' || b.cat === 'wand' || b.cat === 'staff')) return -1;
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
}

/** Plays the act end to end without town trips; infinite potions are counted, not limited. */
export function playAct(classId: ClassId, seed: number, maxPerArea = 900): AreaReport[] {
  const w = makeWorld(classId, seed);
  const c = w.char;
  const reports: AreaReport[] = [];
  let planIdx = 0;
  for (const area of ACT) {
    w.enterArea(area, 'start');
    const rep: AreaReport = { area, enterLevel: c.level, time: 0, deaths: 0, potions: 0, killed: 0, total: w.area.monsters.length, bossDead: false, weapon: '' };
    let t = 0;
    let think = 0;
    let lastPos = { x: 0, y: 0, t: 0 };
    while (t < maxPerArea) {
      const dt = 1 / 30;
      t += dt;
      think -= dt;
      if (w.player.dead) {
        rep.deaths++;
        w.respawn();
        w.enterArea(area, 'start');
      }
      const p = w.player;
      const s = w.stats;
      if (p.life < s.maxLife * 0.4 && !p.heal.length) (p.heal.push({ hp: s.maxLife * 0.5, mp: 0, t: 3 }), rep.potions++);
      if (p.mana < s.maxMana * 0.15 && !p.heal.some((h) => h.mp)) (p.heal.push({ hp: 0, mp: s.maxMana * 0.6, t: 3 }), rep.potions++);
      if (think <= 0) {
        think = 0.5;
        while (c.statPoints > 0) {
          const st = computeStats(c);
          if (classId === 'reaver') allocStat(c, st.str < 60 ? 'str' : 'vit');
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
          else if (b.kind !== 'potion') w.sell(e.item.uid);
        }
        if (c.skills.frost_shell && !p.buffs.frost_shell && p.mana > 20) w.cmdSkill('frost_shell', p.x, p.y);
        if (classId === 'necromancer' && !p.action) necroThink(w);
        // Unstick: if we have not moved for a while, wander.
        if (Math.hypot(p.x - lastPos.x, p.y - lastPos.y) > 0.5) lastPos = { x: p.x, y: p.y, t };
      }
      w.refreshStats();
      for (const g of w.area.ground.slice()) if (Math.hypot(g.x - p.x, g.y - p.y) < 3 && (g.gold || (g.item && (g.item.rarity !== 'normal' || slotsFor(g.item).length)))) w.pickup(g);
      if (!p.action && !p.intent) {
        const live = w.area.monsters.filter((m) => !m.dead);
        if (!live.length) break;
        const boss = live.find((m) => m.superId);
        const alive = live.length / Math.max(1, rep.total);
        if (alive < 0.12 && !boss) break;
        live.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
        const m = live[0];
        const skill = MAIN[classId].find((id) => (c.skills[id] ?? 0) > 0 && SKILL_BY_ID[id].mana(c.skills[id]) <= p.mana) ?? 'attack';
        w.cmdSkill(skill, m.x, m.y, m.id);
      }
      w.step(dt);
    }
    rep.time = Math.round(t);
    rep.bossDead = !w.area.monsters.some((m) => m.superId && !m.dead);
    rep.weapon = c.equipment.weapon ? `${c.equipment.weapon.base}/${c.equipment.weapon.rarity}` : '-';
    rep.killed = rep.total - w.area.monsters.filter((m) => !m.dead && !m.summoned).length;
    reports.push(rep);
  }
  return reports;
}
