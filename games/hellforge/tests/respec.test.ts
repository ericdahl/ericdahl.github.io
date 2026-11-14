import { describe, expect, it } from 'vitest';
import { allocStat, CLASSES, computeStats, createCharacter, difficultiesFinished, hasSpentPoints, learnSkill, respec, respecsLeft } from '../src/game/character';
import { classSkills } from '../src/game/skills';
import { elemDamage } from '../src/game/world';
import { makeWorld, run } from './helpers';

/** A level-30 hero with every point spent on something. */
function built(classId: Parameters<typeof createCharacter>[1] = 'reaver') {
  const c = createCharacter('Test', classId);
  c.level = 30;
  c.statPoints = 145;
  c.skillPoints = 31;
  for (let i = 0; i < 145; i++) allocStat(c, (['str', 'dex', 'vit', 'ene'] as const)[i % 4]);
  for (let pass = 0; pass < 40 && c.skillPoints > 0; pass++) for (const s of classSkills(classId)) learnSkill(c, s.id);
  return c;
}

const finish = (c: ReturnType<typeof createCharacter>, d: number, state = 'rewarded') => (c.quests[`${d}:rekindle`] = state as 'done');

describe('respec', () => {
  it('none to spend until a difficulty is finished, then one for each', () => {
    const c = built();
    expect(respecsLeft(c)).toBe(0);
    expect(respec(c)).toBe(false);
    finish(c, 0, 'active');
    expect(respecsLeft(c)).toBe(0);
    finish(c, 0, 'done');
    expect(difficultiesFinished(c)).toBe(1);
    expect(respecsLeft(c)).toBe(1);
    finish(c, 1);
    finish(c, 2);
    expect(respecsLeft(c)).toBe(3);
  });

  it('gives back every point and leaves the hero as a fresh one of the same level', () => {
    for (const cls of Object.keys(CLASSES) as (keyof typeof CLASSES)[]) {
      const c = built(cls);
      const starter = CLASSES[cls].starter;
      const skillTotal = c.skillPoints + Object.values(c.skills).reduce((n, v) => n + v, 0);
      const statTotal = c.statPoints + c.alloc.str + c.alloc.dex + c.alloc.vit + c.alloc.ene;
      expect(Object.keys(c.skills).length, cls).toBeGreaterThan(3);
      finish(c, 0);
      expect(respec(c)).toBe(true);
      expect(c.skills).toEqual({ [starter]: 1 });
      expect(c.skillPoints, cls).toBe(skillTotal - 1);
      expect(c.statPoints).toBe(statTotal);
      expect(c.alloc).toEqual({ str: 0, dex: 0, vit: 0, ene: 0 });
      expect(c.hotbar).toEqual(['attack', starter, null, null]);
      const fresh = createCharacter('Fresh', cls);
      fresh.level = c.level;
      fresh.equipment = c.equipment;
      expect(computeStats(c)).toEqual(computeStats(fresh));
    }
  });

  it('is spent once: the next one has to be earned', () => {
    const c = built();
    finish(c, 0);
    expect(respec(c)).toBe(true);
    expect(respecsLeft(c)).toBe(0);
    learnSkill(c, 'bash');
    expect(respec(c)).toBe(false);
    expect(c.skills.bash).toBe(2);
    finish(c, 1);
    expect(respecsLeft(c)).toBe(1);
    expect(respec(c)).toBe(true);
    expect(c.respecsUsed).toBe(2);
  });

  it('is not wasted on a hero with nothing spent', () => {
    const c = createCharacter('New', 'arcanist');
    finish(c, 0);
    expect(hasSpentPoints(c)).toBe(false);
    expect(respec(c)).toBe(false);
    expect(respecsLeft(c)).toBe(1);
    c.statPoints = 1;
    allocStat(c, 'vit');
    expect(hasSpentPoints(c)).toBe(true);
  });

  it('the points can be placed again', () => {
    const c = built('arcanist');
    finish(c, 0);
    respec(c);
    const pts = c.skillPoints;
    expect(learnSkill(c, 'fire_bolt')).toBe(true);
    expect(c.skillPoints).toBe(pts - 1);
    expect(allocStat(c, 'ene')).toBe(true);
  });
});

describe('respec in the world', () => {
  it('dismisses servants and spells made with the old skills, and keeps shrine blessings', () => {
    const w = makeWorld('necromancer');
    const c = w.char;
    c.level = 30;
    c.skillPoints = 20;
    for (let i = 0; i < 6; i++) learnSkill(c, 'raise_skeleton');
    learnSkill(c, 'bone_ward');
    w.setQuest('rekindle', 'done');
    w.enterArea('cinder_fields', 'start');
    const priv = w as unknown as { raiseMinion(k: string, x: number, y: number, pr: object): unknown };
    priv.raiseMinion('skeleton', w.player.x, w.player.y, {});
    w.player.buffs.bone_ward = { t: 30, p: { min: 50 } };
    w.player.buffs.shrine_armor = { t: 30, p: {} };
    expect(w.minions.length).toBe(1);
    expect(w.respec()).toBe(true);
    expect(w.minions).toEqual([]);
    expect(Object.keys(w.player.buffs)).toEqual(['shrine_armor']);
    expect(w.skeletonCount()).toBeNull();
    expect(w.respec()).toBe(false);
  });

  it('never leaves life or mana above the new maximum', () => {
    const w = makeWorld('reaver');
    const c = w.char;
    c.level = 20;
    c.statPoints = 95;
    for (let i = 0; i < 95; i++) allocStat(c, 'vit');
    w.refreshStats();
    w.player.life = w.stats.maxLife;
    const before = w.stats.maxLife;
    w.setQuest('rekindle', 'done');
    w.respec();
    expect(w.stats.maxLife).toBeLessThan(before);
    expect(w.player.life).toBe(w.stats.maxLife);
  });

  it('the dead cannot respec', () => {
    const w = makeWorld();
    w.char.statPoints = 1;
    allocStat(w.char, 'str');
    w.setQuest('rekindle', 'done');
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 0;
    w.damagePlayer(elemDamage('fire', 1e9), { level: 99 });
    expect(w.respec()).toBe(false);
  });

  it('killing the Unlit earns one on that difficulty', () => {
    const w = makeWorld();
    w.char.level = 40;
    w.enterArea('hellforge_heart', 'start');
    expect(respecsLeft(w.char)).toBe(0);
    const boss = w.area.monsters.find((m) => m.superId === 'unlit')!;
    w.player.invuln = 999;
    w.damageMonster(boss, elemDamage('phys', boss.maxLife * 50));
    run(w, 0.2);
    expect(respecsLeft(w.char)).toBe(1);
  });
});
