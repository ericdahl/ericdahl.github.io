import { describe, expect, it } from 'vitest';
import { learnSkill } from '../src/game/character';
import { elemDamage, type World } from '../src/game/world';
import { makeWorld, nextToMonster, run } from './helpers';

function necro(skills: Record<string, number> = {}) {
  const w = makeWorld('necromancer');
  w.char.level = 24;
  w.char.skills = { bone_shards: 1, ...skills };
  w.refreshStats();
  w.player.mana = w.stats.maxMana;
  w.enterArea('cinder_fields', 'start');
  return w;
}

/** Kills a monster next to the player and returns its corpse. */
function corpse(w: World) {
  const m = nextToMonster(w);
  w.damageMonster(m, elemDamage('phys', 1e6));
  w.player.invuln = 99;
  return m;
}

describe('necromancer', () => {
  it('starts with a wand and Bone Shards', () => {
    const w = makeWorld('necromancer');
    expect(w.char.equipment.weapon?.base).toBe('yew_wand');
    expect(w.char.hotbar).toEqual(['attack', 'bone_shards', null, null]);
  });

  it('bone shards fan out and damage monsters', () => {
    const w = necro({ bone_shards: 5 });
    const m = nextToMonster(w);
    w.player.invuln = 99;
    const life = m.life;
    w.cmdSkill('bone_shards', m.x, m.y, m.id);
    run(w, 0.4);
    expect(w.area.projectiles.filter((p) => p.kind === 'boneshard').length + (m.life < life ? 1 : 0)).toBeGreaterThan(0);
    run(w, 1);
    expect(m.life).toBeLessThan(life);
  });

  it('raises skeletons from corpses, up to the cap, and they fight', () => {
    const w = necro({ raise_skeleton: 1 });
    const c1 = corpse(w);
    w.cmdSkill('raise_skeleton', c1.x, c1.y);
    run(w, 1);
    expect(w.minions.length).toBe(1);
    expect(c1.used).toBe(true);
    // The used corpse can't be raised again, and without another nothing happens.
    w.player.mana = w.stats.maxMana;
    w.area.monsters = w.area.monsters.filter((m) => m === c1 || !m.dead);
    w.cmdSkill('raise_skeleton', c1.x, c1.y);
    run(w, 1);
    expect(w.minions.length).toBe(1);
    // Level 1 allows one skeleton: raising another replaces the first.
    const first = w.minions[0];
    const c2 = corpse(w);
    w.player.mana = w.stats.maxMana;
    w.cmdSkill('raise_skeleton', c2.x, c2.y);
    run(w, 1);
    expect(w.minions.length).toBe(1);
    expect(w.minions[0]).not.toBe(first);
    // The skeleton attacks a nearby monster.
    const target = w.area.monsters.find((m) => !m.dead && !m.superId)!;
    const life = target.life;
    w.player.x = target.x + 1;
    w.player.y = target.y;
    w.minions[0].x = target.x - 0.8;
    w.minions[0].y = target.y;
    run(w, 4, () => (w.player.invuln = 99));
    expect(target.life).toBeLessThan(life);
  });

  it('monsters fight servants that stand in their way', () => {
    const w = necro({ raise_skeleton: 3 });
    const c = corpse(w);
    w.cmdSkill('raise_skeleton', c.x, c.y);
    run(w, 1);
    const sk = w.minions[0];
    const m = w.area.monsters.find((x) => !x.dead && !x.superId)!;
    m.alert = true;
    sk.x = m.x + 0.7;
    sk.y = m.y;
    w.player.x = m.x + 6;
    w.player.y = m.y;
    sk.life = sk.maxLife;
    run(w, 4, () => (w.player.invuln = 99));
    expect(sk.life < sk.maxLife || sk.dead || m.dead).toBe(true);
  });

  it('servants follow the player to a new area and vanish on death', () => {
    const w = necro({ raise_skeleton: 3, grave_golem: 1 });
    w.cmdSkill('grave_golem', w.player.x + 1, w.player.y);
    run(w, 1);
    expect(w.minions.map((m) => m.ally)).toEqual(['golem']);
    w.enterArea('town', 'start');
    expect(w.minions.length).toBe(1);
    expect(Math.hypot(w.minions[0].x - w.player.x, w.minions[0].y - w.player.y)).toBeLessThan(3);
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 0;
    w.damagePlayer(elemDamage('fire', 1e6), { level: 1 });
    expect(w.player.dead).toBe(true);
    expect(w.minions.length).toBe(0);
  });

  it('Mark of Frailty amplifies physical damage', () => {
    const w = necro({ frailty: 5 });
    const m = nextToMonster(w);
    w.player.invuln = 99;
    w.cmdSkill('frailty', m.x, m.y);
    run(w, 1);
    expect(m.curse?.t).toBeGreaterThan(0);
    m.life = m.maxLife = 1e6;
    m.res.phys = 0;
    w.damageMonster(m, elemDamage('phys', 100));
    expect(1e6 - m.life).toBeCloseTo(100 * (1 + m.curse!.pct / 100));
  });

  it('Corpse Burst blasts monsters near a corpse', () => {
    const w = necro({ frailty: 1, corpse_burst: 5 });
    const c = corpse(w);
    const near = w.monstersNear(c.x, c.y, 2.5);
    expect(near.length).toBeGreaterThan(0);
    const before = near.map((m) => m.life);
    w.cmdSkill('corpse_burst', c.x, c.y);
    run(w, 1);
    expect(c.used).toBe(true);
    expect(near.some((m, i) => m.life < before[i])).toBe(true);
  });

  it('Bone Ward absorbs damage before life', () => {
    const w = necro({ bone_ward: 3 });
    w.cmdSkill('bone_ward', w.player.x, w.player.y);
    run(w, 1);
    const ward = w.player.buffs.bone_ward;
    expect(ward.p.min).toBe(56);
    const life = w.player.life;
    w.player.invuln = 0;
    w.damagePlayer(elemDamage('fire', 30), { level: 1 });
    expect(w.player.life).toBe(life);
    expect(ward.p.min).toBe(26);
    w.damagePlayer(elemDamage('fire', 30), { level: 1 });
    expect(w.player.buffs.bone_ward).toBeUndefined();
    expect(w.player.life).toBeLessThan(life);
  });

  it('learns its tree in order', () => {
    const w = makeWorld('necromancer');
    const c = w.char;
    c.level = 30;
    c.skillPoints = 20;
    expect(learnSkill(c, 'bone_lance')).toBe(false);
    for (const id of ['raise_skeleton', 'frailty', 'bone_ward', 'corpse_burst', 'bone_lance', 'skeletal_mastery', 'grave_golem', 'blight_nova', 'bone_storm']) {
      expect(learnSkill(c, id), id).toBe(true);
    }
  });
});
