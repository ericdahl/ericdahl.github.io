import { describe, expect, it } from 'vitest';
import { addToInventory, CLASSES, computeStats, createCharacter, displacedBy, equipFromInventory, fourArmed, learnSkill, OFFHAND_SHARE, slotsFor, unequip } from '../src/game/character';
import { AFFIXES, baseOf, makeItem, SETS, UNIQUES, type Item } from '../src/game/items';
import { MONSTERS } from '../src/game/monsters';
import { classSkills, SKILL_BY_ID } from '../src/game/skills';
import { compareEquip, defaultSlot } from '../src/ui/compare';
import { elemDamage, type Monster, type World } from '../src/game/world';
import { makeWorld, run } from './helpers';

function hive(level = 20) {
  const c = createCharacter('Ksm', 'hiveborn');
  c.level = level;
  c.statPoints = 0;
  c.alloc.str = 60;
  c.alloc.dex = 60;
  return c;
}

/** Puts an item in the backpack and equips it, in a chosen hand if one is given. */
function wear(c: ReturnType<typeof hive>, base: string, slot?: 'weapon' | 'offhand'): string | null {
  const it = makeItem(base);
  addToInventory(c, it);
  return equipFromInventory(c, it.uid, slot);
}

const bare = (c: ReturnType<typeof hive>) => {
  c.equipment = {};
  c.inventory = [];
};

/** A level-20 Hiveborn in open ground with one monster `dist` tiles away that cannot move. */
function arena(defId = 'ghoul', dist = 1, skills: Record<string, number> = {}) {
  const w = makeWorld('hiveborn');
  const c = w.char;
  c.level = 20;
  c.alloc.str = 60;
  c.alloc.dex = 60;
  Object.assign(c.skills, skills);
  w.refreshStats();
  w.player.life = w.stats.maxLife;
  w.player.mana = w.stats.maxMana = 500;
  w.enterArea('cinder_fields', 'start');
  w.area.monsters.length = 0;
  w.area.purged = true;
  const l = w.area.level;
  const open = (x: number, y: number) => l.tiles[Math.floor(y) * l.w + Math.floor(x)] === 1;
  find: for (let y = 5; y < l.h - 5; y++) for (let x = 5; x < l.w - 14; x++) {
    let ok = true;
    for (let dx = -2; dx <= 11 && ok; dx++) for (let dy = -2; dy <= 2 && ok; dy++) ok = open(x + dx, y + dy);
    if (ok) { w.player.x = x + 0.5; w.player.y = y + 0.5; break find; }
  }
  w.player.invuln = 999;
  const m = w.spawnMonster(w.area, defId, w.player.x + dist, w.player.y, 'normal', { level: 20 });
  m.speed = 0;
  m.life = m.maxLife = 1e7;
  m.alert = true;
  return { w, m };
}

function hits(w: World, m: Monster, skill: string, seconds = 6) {
  const before = m.life;
  run(w, seconds, () => {
    if (!w.player.action && !w.player.intent) w.cmdSkill(skill, m.x, m.y, m.id);
    w.player.mana = 500;
  });
  return before - m.life;
}

describe('the hiveborn', () => {
  it('is a sixth class with fourteen skills in three branches, a set, uniques and an affix of its own', () => {
    expect(Object.keys(CLASSES)).toContain('hiveborn');
    const skills = classSkills('hiveborn');
    expect(skills.length).toBe(14);
    for (const s of skills) {
      for (const p of s.prereq ?? []) expect(SKILL_BY_ID[p].classId).toBe('hiveborn');
      for (const y of s.synergies ?? []) expect(SKILL_BY_ID[y.skill].classId).toBe('hiveborn');
      for (const l of [1, 10, 20]) {
        expect(s.lines(s.params(l)).join(' '), `${s.id} ${l}`).not.toMatch(/undefined|NaN/);
        expect(s.mana(l)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(UNIQUES.filter((u) => u.mods.some((m) => m.stat === 'skills_hiveborn')).length).toBeGreaterThanOrEqual(3);
    const set = SETS.find((s) => s.classId === 'hiveborn')!;
    expect(set.pieces.length).toBe(4);
    expect(Object.values(set.bonuses).flat().some((m) => m.stat === 'skills_hiveborn')).toBe(true);
    expect(AFFIXES.some((a) => a.mods.some((m) => m.stat === 'skills_hiveborn'))).toBe(true);
    expect(MONSTERS.hive_worker.xpMul).toBe(0);
  });

  it('starts with a weapon in each upper hand and Rend learned', () => {
    const c = createCharacter('K', 'hiveborn');
    expect(c.equipment.weapon!.base).toBe('short_sword');
    expect(c.equipment.offhand!.base).toBe('club');
    expect(c.skills).toEqual({ rend: 1 });
    expect(c.hotbar).toEqual(['attack', 'rend', null, null]);
    // Nobody else starts with anything in the off hand but a shield.
    for (const id of Object.keys(CLASSES) as (keyof typeof CLASSES)[]) {
      const o = createCharacter('x', id).equipment.offhand;
      if (o && id !== 'hiveborn') expect(baseOf(o).kind).toBe('shield');
    }
  });
});

describe('four arms and equipment', () => {
  it('a one-handed weapon can go in either hand, for the Hiveborn only', () => {
    const sword = makeItem('long_sword');
    expect(slotsFor(sword, hive())).toEqual(['weapon', 'offhand']);
    expect(slotsFor(sword, createCharacter('r', 'reaver'))).toEqual(['weapon']);
    expect(slotsFor(sword)).toEqual(['weapon']);
    expect(slotsFor(makeItem('claymore'), hive())).toEqual(['weapon']);
    expect(slotsFor(makeItem('long_bow'), hive())).toEqual(['weapon']);
    expect(fourArmed(hive())).toBe(true);
    expect(fourArmed(createCharacter('r', 'reaver'))).toBe(false);
  });

  it('fills the empty hand first, and puts a weapon in the hand it is told to', () => {
    const c = hive();
    bare(c);
    expect(wear(c, 'hand_axe')).toBeNull();
    expect(wear(c, 'dagger')).toBeNull();
    expect([c.equipment.weapon!.base, c.equipment.offhand!.base]).toEqual(['hand_axe', 'dagger']);
    expect(wear(c, 'club', 'offhand')).toBeNull();
    expect([c.equipment.weapon!.base, c.equipment.offhand!.base]).toEqual(['hand_axe', 'club']);
    expect(c.inventory.map((e) => e.item.base)).toEqual(['dagger']);
    expect(wear(c, 'short_sword', 'weapon')).toBeNull();
    expect(c.equipment.weapon!.base).toBe('short_sword');
    expect(c.equipment.offhand!.base).toBe('club');
  });

  it('holds a two-hander or a bow beside a shield or a second weapon', () => {
    const c = hive(30);
    c.alloc.str = 120;
    bare(c);
    wear(c, 'kite_shield');
    expect(wear(c, 'claymore')).toBeNull();
    expect([c.equipment.weapon!.base, c.equipment.offhand!.base]).toEqual(['claymore', 'kite_shield']);
    expect(computeStats(c).block).toBeGreaterThan(0);
    expect(wear(c, 'long_bow')).toBeNull();
    expect(wear(c, 'dagger', 'offhand')).toBeNull();
    expect([c.equipment.weapon!.base, c.equipment.offhand!.base]).toEqual(['long_bow', 'dagger']);
    // Everyone else still has to choose.
    const r = createCharacter('r', 'reaver');
    r.level = 30;
    r.alloc.str = 120;
    const two = makeItem('claymore');
    addToInventory(r, two);
    equipFromInventory(r, two.uid);
    expect(r.equipment.offhand).toBeUndefined();
    expect(displacedBy(r, two, 'weapon')).toEqual(['weapon', 'offhand']);
    expect(displacedBy(c, two, 'weapon')).toEqual(['weapon']);
  });

  it('an off-hand weapon adds half its damage to each blow, and Many Hands adds more', () => {
    const c = hive();
    bare(c);
    wear(c, 'long_sword');
    const one = computeStats(c);
    wear(c, 'long_sword', 'offhand');
    const two = computeStats(c);
    const k = 1 + one.str / 100;
    expect(two.minDmg).toBe(Math.floor((3 + 3 * (OFFHAND_SHARE / 100)) * k));
    expect(two.maxDmg).toBe(Math.floor((13 + 13 * (OFFHAND_SHARE / 100)) * k));
    expect(two.attackSpeed).toBe(one.attackSpeed);
    c.skills.many_hands = 10;
    const many = computeStats(c);
    expect(many.maxDmg).toBe(Math.floor((13 + 13) * k));
    expect(many.attackSpeed).toBeGreaterThan(two.attackSpeed);
    // A weapon in the off hand blocks nothing, whatever the rest of the gear says.
    c.equipment.ring1 = { ...makeItem('ring'), mods: [{ stat: 'block', value: 20 }] } as Item;
    expect(computeStats(c).block).toBe(0);
  });

  it('with a bow in the upper arms, the off-hand weapon goes to the claws instead', () => {
    const c = hive();
    bare(c);
    wear(c, 'long_bow');
    const bow = computeStats(c);
    wear(c, 'long_sword', 'offhand');
    const both = computeStats(c);
    expect([both.minDmg, both.maxDmg]).toEqual([bow.minDmg, bow.maxDmg]);
    expect(both.clawMax).toBeGreaterThan(bow.clawMax);
    expect(both.isBow).toBe(true);
  });

  it('has claws that grow with level, Strength and Carapace, and nobody else has any', () => {
    const c = hive(10);
    const a = computeStats(c);
    expect(a.clawMin).toBeGreaterThan(0);
    expect(a.clawMax).toBeGreaterThan(a.clawMin);
    c.level = 30;
    const b = computeStats(c);
    expect(b.clawMax).toBeGreaterThan(a.clawMax);
    c.alloc.str += 50;
    const s = computeStats(c);
    expect(s.clawMax).toBeGreaterThan(b.clawMax);
    c.skills.carapace = 10;
    const k = computeStats(c);
    expect(k.clawMax).toBeGreaterThan(s.clawMax);
    expect(k.def).toBeGreaterThan(s.def);
    expect(k.dmgReduce).toBe(s.dmgReduce + 5);
    for (const id of ['reaver', 'arcanist', 'huntress', 'necromancer', 'forgewright'] as const) expect(computeStats(createCharacter('x', id)).clawMax).toBe(0);
  });

  it('the comparison view knows about both hands and what a two-hander no longer knocks off', () => {
    const c = hive(30);
    c.alloc.str = 120;
    bare(c);
    wear(c, 'hand_axe');
    const dagger = makeItem('dagger');
    expect(defaultSlot(c, dagger)).toBe('offhand');
    const cmp = compareEquip(c, dagger, 'offhand');
    expect(cmp.replaced).toEqual([]);
    expect(cmp.changes.find((x) => x.label === 'Damage')!.better).toBeGreaterThan(0);
    wear(c, 'kite_shield');
    const big = compareEquip(c, makeItem('claymore'), 'weapon');
    expect(big.replaced.map((i) => i.base)).toEqual(['hand_axe']);
    expect(unequip(c, 'offhand')).toBeNull();
  });
});

describe('claws in a fight', () => {
  it('are in every blow struck up close', () => {
    const { w, m } = arena();
    const st = w.stats;
    const seen: number[] = [];
    const orig = w.damageMonster.bind(w);
    w.damageMonster = (mm, d, o) => { if (o?.leech) seen.push(d.phys); return orig(mm, d, o); };
    hits(w, m, 'attack', 8);
    expect(seen.length).toBeGreaterThan(4);
    // Never less than the weakest weapon blow plus the weakest claw.
    for (const d of seen) expect(d).toBeGreaterThanOrEqual(st.minDmg + st.clawMin);
    expect(Math.max(...seen)).toBeGreaterThan(st.maxDmg);
  });

  it('with a bow, a plain attack shoots from afar and claws up close', () => {
    const far = arena('ghoul', 7);
    far.w.char.equipment = { weapon: makeItem('short_bow') };
    far.w.refreshStats();
    let arrows = 0;
    run(far.w, 3, () => {
      if (!far.w.player.action && !far.w.player.intent) far.w.cmdSkill('attack', far.m.x, far.m.y, far.m.id);
      arrows += far.w.area.projectiles.filter((p) => p.owner === 'player').length;
    });
    expect(arrows).toBeGreaterThan(0);
    expect(Math.hypot(far.m.x - far.w.player.x, far.m.y - far.w.player.y)).toBeGreaterThan(6);

    const near = arena('ghoul', 1);
    near.w.char.equipment = { weapon: makeItem('short_bow') };
    near.w.refreshStats();
    let shot = 0;
    const dealt = (() => {
      const before = near.m.life;
      run(near.w, 4, () => {
        if (!near.w.player.action && !near.w.player.intent) near.w.cmdSkill('attack', near.m.x, near.m.y, near.m.id);
        shot += near.w.area.projectiles.filter((p) => p.owner === 'player').length;
      });
      return before - near.m.life;
    })();
    expect(shot).toBe(0);
    expect(dealt).toBeGreaterThan(0);
  });

  it('Rend works with a bow in hand, by walking up and using the claws', () => {
    const { w, m } = arena('ghoul', 6);
    w.char.equipment = { weapon: makeItem('short_bow') };
    w.refreshStats();
    m.life = m.maxLife = 1e7;
    expect(hits(w, m, 'rend', 8)).toBeGreaterThan(0);
    expect(Math.hypot(m.x - w.player.x, m.y - w.player.y)).toBeLessThan(2.5);
    expect(w.events.some((e) => e.type === 'msg' && e.text === 'Requires a melee weapon')).toBe(false);
    // Anyone else with a bow is still told no.
    const h = makeWorld('huntress');
    h.char.skills.bash = 1;
    h.enterArea('cinder_fields', 'start');
    h.cmdSkill('bash', h.player.x + 1, h.player.y);
    run(h, 0.5);
    expect(h.events.some((e) => e.type === 'msg' && e.text === 'Requires a melee weapon')).toBe(true);
  });

  it('Fourfold Strike hits everything in front and nothing behind', () => {
    const { w, m } = arena('ghoul', 1.2, { many_hands: 1, fourfold: 5 });
    const beside = w.spawnMonster(w.area, 'ghoul', w.player.x + 1.2, w.player.y + 0.8, 'normal', { level: 20 });
    const behind = w.spawnMonster(w.area, 'ghoul', w.player.x - 1.5, w.player.y, 'normal', { level: 20 });
    for (const o of [beside, behind]) (o.speed = 0), (o.life = o.maxLife = 1e7);
    hits(w, m, 'fourfold', 5);
    expect(m.life).toBeLessThan(1e7);
    expect(beside.life).toBeLessThan(1e7);
    expect(behind.life).toBe(1e7);
  });

  it('Hold the Line makes the hero harder to hurt and harder-hitting while it lasts', () => {
    const { w } = arena('ghoul', 8, { carapace: 1, hold_the_line: 5 });
    const before = { def: w.stats.def, dmg: w.stats.maxDmg, claw: w.stats.clawMax };
    w.cmdSkill('hold_the_line', w.player.x, w.player.y);
    run(w, 1.5);
    expect(w.player.buffs.hold_the_line).toBeTruthy();
    expect(w.stats.def).toBeGreaterThan(before.def);
    expect(w.stats.maxDmg).toBeGreaterThan(before.dmg);
    expect(w.stats.clawMax).toBeGreaterThan(before.claw);
    w.player.buffs.hold_the_line.t = 0.01;
    run(w, 0.2);
    expect(w.stats.def).toBe(before.def);
  });
});

describe('the archer branch', () => {
  it('needs a bow', () => {
    const { w, m } = arena('ghoul', 5, { loose: 3 });
    w.cmdSkill('loose', m.x, m.y, m.id);
    run(w, 1);
    expect(w.events.some((e) => e.type === 'msg' && e.text === 'Requires a bow')).toBe(true);
  });

  it('Sky Hunter makes a bow deadlier, and everything worse for things that fly', () => {
    const a = arena('bat', 1, { loose: 1, sky_hunter: 10 });
    const b = arena('bat', 1, { loose: 1 });
    const g = arena('ghoul', 1, { loose: 1, sky_hunter: 10 });
    const one = (x: ReturnType<typeof arena>) => {
      const before = x.m.life;
      x.w.damageMonster(x.m, elemDamage('phys', 100));
      return before - x.m.life;
    };
    const plain = one(b);
    expect(one(a)).toBeCloseTo(plain * (1 + SKILL_BY_ID.sky_hunter.params(10).pct2! / 100), 3);
    expect(one(g)).toBeCloseTo(100 * (1 - (MONSTERS.ghoul.res.phys ?? 0) / 100), 3);
    expect(MONSTERS.kite.ai).toBe('bat');
    const c = hive();
    c.skills.sky_hunter = 10;
    c.equipment = { weapon: makeItem('short_bow') };
    expect(computeStats(c).crit).toBe(SKILL_BY_ID.sky_hunter.params(10).pct);
    c.equipment = { weapon: makeItem('short_sword') };
    expect(computeStats(c).crit).toBe(0);
  });

  it('Volley fans arrows out, and Skyfall sends one at everything in sight', () => {
    const { w, m } = arena('ghoul', 6, { loose: 1, sky_hunter: 1, volley: 4, skyfall: 4 });
    w.char.equipment = { weapon: makeItem('short_bow') };
    w.refreshStats();
    let most = 0;
    run(w, 2, () => {
      if (!w.player.action && !w.player.intent) w.cmdSkill('volley', m.x, m.y, m.id);
      most = Math.max(most, w.area.projectiles.length);
    });
    expect(most).toBeGreaterThanOrEqual(SKILL_BY_ID.volley.params(4).count!);
    const others = [1, -1].map((dy) => w.spawnMonster(w.area, 'ghoul', w.player.x + 5, w.player.y + dy * 2, 'normal', { level: 20 }));
    for (const o of others) (o.speed = 0), (o.life = o.maxLife = 1e7);
    w.area.projectiles.length = 0;
    w.player.action = null;
    w.cmdSkill('skyfall', m.x, m.y, m.id);
    run(w, 3);
    for (const o of others) expect(o.life).toBeLessThan(1e7);
  });
});

describe('the faith branch', () => {
  it('Prayer of Mending heals the hero and everyone at their side', () => {
    const { w } = arena('ghoul', 9, { mending: 5 });
    w.char.gold = 1e6;
    w.hire('guard');
    const mi = w.hirelingMinion()!;
    mi.x = w.player.x + 1;
    mi.y = w.player.y;
    mi.life = 1;
    w.player.life = 1;
    w.cmdSkill('mending', w.player.x, w.player.y);
    run(w, 1.5);
    const pct = SKILL_BY_ID.mending.params(5).pct! / 100;
    expect(w.player.life).toBeGreaterThanOrEqual(w.stats.maxLife * pct);
    expect(mi.life).toBeGreaterThanOrEqual(mi.maxLife * pct);
  });

  it('Ward of Faith takes blows until it breaks', () => {
    const { w } = arena('ghoul', 9, { mending: 1, ward_of_faith: 5 });
    w.cmdSkill('ward_of_faith', w.player.x, w.player.y);
    run(w, 1.5);
    const ward = SKILL_BY_ID.ward_of_faith.params(5).min!;
    expect(w.player.buffs.ward_of_faith.p.min).toBe(ward);
    w.player.invuln = 0;
    const life = w.player.life;
    w.damagePlayer(elemDamage('phys', ward - 10), { level: 1 });
    expect(w.player.life).toBe(life);
    w.player.invuln = 0;
    w.damagePlayer(elemDamage('phys', 500), { level: 1 });
    expect(w.player.life).toBeLessThan(life);
    expect(w.player.buffs.ward_of_faith).toBeUndefined();
  });

  it('Congregation calls Workers who fight, need no corpse, and go home', () => {
    const { w, m } = arena('ghoul', 2, { congregation: 4 });
    const pr = SKILL_BY_ID.congregation.params(4);
    w.cmdSkill('congregation', w.player.x, w.player.y);
    run(w, 1.5);
    const workers = () => w.minions.filter((x) => x.ally === 'worker' && !x.dead);
    expect(workers().length).toBe(pr.count);
    expect(w.constructCount('congregation')).toEqual({ alive: pr.count, max: pr.count });
    for (const x of workers()) expect(x.ttl).toBeGreaterThan(pr.duration! - 3);
    run(w, 8);
    expect(m.life).toBeLessThan(1e7);
    // Calling again replaces them: no crowd builds up.
    w.cmdSkill('congregation', w.player.x, w.player.y);
    run(w, 1.5);
    expect(workers().length).toBe(pr.count);
    for (const x of workers()) x.ttl = 0.1;
    run(w, 0.5);
    expect(workers().length).toBe(0);
  });

  it('Hymn of the Hive makes allies hit harder and the hero swing faster', () => {
    const base = arena('ghoul', 2, { congregation: 4, hymn: 5 });
    const sung = arena('ghoul', 2, { congregation: 4, hymn: 5 });
    for (const x of [base, sung]) {
      x.w.player.x -= 6;
      x.w.cmdSkill('congregation', x.w.player.x, x.w.player.y);
      run(x.w, 1.5);
      for (const mi of x.w.minions) (mi.x = x.m.x - 0.8), (mi.y = x.m.y);
    }
    const speed = sung.w.stats.attackSpeed;
    sung.w.cmdSkill('hymn', sung.w.player.x, sung.w.player.y);
    run(sung.w, 1.2);
    expect(sung.w.stats.attackSpeed).toBeGreaterThan(speed);
    sung.m.life = base.m.life = 1e7;
    run(base.w, 12);
    run(sung.w, 12);
    expect(1e7 - sung.m.life).toBeGreaterThan((1e7 - base.m.life) * 1.2);
  });

  it('Sky Above strikes and stuns what stands near', () => {
    const { w, m } = arena('ghoul', 2, { mending: 1, ward_of_faith: 1, congregation: 1, hymn: 1, judgement: 3 });
    m.maxLife = m.life = 1e7;
    w.cmdSkill('judgement', w.player.x, w.player.y);
    run(w, 1);
    expect(m.life).toBeLessThan(1e7);
    expect(m.stun).toBeGreaterThan(0);
  });

  it('every skill can be learned in order by a hero of the right level', () => {
    const c = createCharacter('K', 'hiveborn');
    c.level = 30;
    c.skillPoints = 40;
    for (let pass = 0; pass < 6; pass++) for (const s of classSkills('hiveborn')) learnSkill(c, s.id);
    expect(Object.keys(c.skills).sort()).toEqual(classSkills('hiveborn').map((s) => s.id).sort());
  });
});
