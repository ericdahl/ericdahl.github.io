import { describe, expect, it } from 'vitest';
import { canLearn, computeStats, createCharacter, learnSkill } from '../src/game/character';
import { AFFIXES, SETS, UNIQUES, baseOf } from '../src/game/items';
import { classSkills, SKILL_BY_ID } from '../src/game/skills';
import { elemDamage, HEAT_MAX, type Monster, type World } from '../src/game/world';
import { makeWorld, nextToMonster, run } from './helpers';

function smith(skills: Record<string, number> = {}, level = 24) {
  const w = makeWorld('forgewright');
  w.char.level = level;
  w.char.skills = { sunder: 1, ...skills };
  w.refreshStats();
  w.player.life = w.stats.maxLife;
  w.player.mana = w.stats.maxMana;
  w.enterArea('cinder_fields', 'start');
  return w;
}

/** Stands the hero next to a monster that will not die or fight back for the length of a test. */
function dummy(w: World): Monster {
  const m = nextToMonster(w);
  m.life = m.maxLife = 1e7;
  m.dmgMin = m.dmgMax = 0;
  w.player.facing = Math.atan2(m.y - w.player.y, m.x - w.player.x);
  return m;
}

const calm = (w: World) => () => {
  w.player.invuln = 99;
  w.player.mana = w.stats.maxMana;
};

describe('forgewright', () => {
  it('starts with a sledge and Sunder', () => {
    const w = makeWorld('forgewright');
    expect(w.char.equipment.weapon?.base).toBe('sledge');
    expect(baseOf('sledge').twoHanded).toBe(true);
    expect(w.char.hotbar).toEqual(['attack', 'sunder', null, null]);
    expect(w.player.heat).toBe(0);
  });

  it('has three trees with level requirements, prerequisites and synergies', () => {
    const skills = classSkills('forgewright');
    expect(skills.map((s) => s.id).sort()).toEqual([
      'anvil_drop', 'ballista', 'bellows', 'brass_sentinel', 'earthshaker', 'furnace', 'gearwork', 'shockwave', 'slag_burst', 'sunder', 'temper', 'white_heat',
    ]);
    for (const s of skills) {
      for (const p of s.prereq ?? []) {
        expect(SKILL_BY_ID[p].classId).toBe('forgewright');
        expect(SKILL_BY_ID[p].reqLevel).toBeLessThanOrEqual(s.reqLevel);
      }
      for (const y of s.synergies ?? []) expect(SKILL_BY_ID[y.skill].classId).toBe('forgewright');
      expect(s.lines(s.params(1)).length).toBeGreaterThan(0);
    }
    expect(skills.filter((s) => s.synergies).length).toBeGreaterThanOrEqual(6);
    const c = createCharacter('F', 'forgewright');
    c.skillPoints = 5;
    expect(canLearn(c, SKILL_BY_ID.anvil_drop)).toBe('Requires level 6');
    c.level = 12;
    expect(canLearn(c, SKILL_BY_ID.brass_sentinel)).toBe('Requires Ballista Turret');
    expect(learnSkill(c, 'ballista')).toBe(true);
    expect(learnSkill(c, 'brass_sentinel')).toBe(true);
    expect(c.hotbar).toEqual(['attack', 'sunder', 'ballista', 'brass_sentinel']);
  });

  it('Sunder cracks armor so the target takes more physical damage', () => {
    const w = smith({ sunder: 5 });
    const m = dummy(w);
    run(w, 3, () => {
      calm(w)();
      if (!w.player.action) w.cmdSkill('sunder', m.x, m.y, m.id);
    });
    expect(m.sunder!.t).toBeGreaterThan(0);
    expect(m.sunder!.pct).toBe(SKILL_BY_ID.sunder.params(5).pct);
    const before = m.life;
    w.damageMonster(m, elemDamage('phys', 100));
    expect(before - m.life).toBeCloseTo(100 * (1 + m.sunder!.pct / 100) * (1 - m.res.phys / 100), 3);
  });

  it('hammer blows build Heat, and Temper turns Heat into fire damage', () => {
    const w = smith({ temper: 5 });
    const m = dummy(w);
    run(w, 4, () => {
      calm(w)();
      if (!w.player.action) w.cmdSkill('sunder', m.x, m.y, m.id);
    });
    expect(w.player.heat).toBeGreaterThan(15);
    // Same swing, cold and hot: only the hot one burns.
    const fire = (heat: number) => {
      w.player.heat = heat;
      return (w as any).weaponDamage(SKILL_BY_ID.attack, {}).dmg.fire as number;
    };
    expect(fire(0)).toBe(0);
    expect(fire(100)).toBeGreaterThan(fire(50));
    expect(fire(50)).toBeGreaterThan(0);
    expect(computeStats(w.char).res.fire).toBe(SKILL_BY_ID.temper.params(5).pct2);
  });

  it('other classes never build Heat', () => {
    const w = makeWorld('reaver');
    w.enterArea('cinder_fields', 'start');
    const m = dummy(w);
    run(w, 3, () => {
      calm(w)();
      if (!w.player.action) w.cmdSkill('bash', m.x, m.y, m.id);
    });
    expect(w.player.heat).toBe(0);
  });

  it('overheating burns the hero without killing, until the Heat bleeds off', () => {
    const w = smith();
    w.player.invuln = 99;
    w.player.heat = 96;
    (w as any).gainHeat(8);
    expect(w.player.heat).toBe(HEAT_MAX);
    expect(w.player.overheat).toBe(true);
    const life = w.player.life;
    run(w, 1);
    expect(w.player.life).toBeLessThan(life);
    // Keep it pinned at the top: it hurts all the way down but stops at 1.
    run(w, 60, () => (w.player.heatT = 0));
    expect(w.player.life).toBe(1);
    expect(w.player.dead).toBe(false);
    // Left alone, it cools and the burning stops.
    run(w, 8);
    expect(w.player.overheat).toBe(false);
    expect(w.player.heat).toBeLessThan(60);
    const cooled = w.player.life;
    run(w, 2);
    expect(w.player.life).toBeGreaterThanOrEqual(cooled);
  });

  it('Slag Burst vents Heat as fire, and needs some Heat to vent', () => {
    const w = smith({ temper: 1, slag_burst: 5 });
    const m = dummy(w);
    w.player.invuln = 99;
    w.player.heat = 10;
    w.cmdSkill('slag_burst', w.player.x, w.player.y);
    run(w, 1);
    expect(w.player.heat).toBeGreaterThan(0);
    expect(m.life).toBe(m.maxLife);
    // Half Heat: a burst, no burning ground.
    w.player.heat = 50;
    w.player.heatT = 0;
    w.cmdSkill('slag_burst', w.player.x, w.player.y);
    run(w, 0.6);
    const half = m.maxLife - m.life;
    expect(half).toBeGreaterThan(0);
    expect(w.player.heat).toBe(0);
    expect(w.area.hazards.length).toBe(0);
    // Full, overheated: twice the burst, the burning stops, and slag is left on the ground.
    m.life = m.maxLife;
    w.player.heat = HEAT_MAX;
    w.player.overheat = true;
    w.cmdSkill('slag_burst', w.player.x, w.player.y);
    run(w, 0.6);
    expect(w.player.overheat).toBe(false);
    expect(w.area.hazards.length).toBe(1);
    expect(m.maxLife - m.life).toBeGreaterThan(half * 1.2);
    expect(SKILL_BY_ID.slag_burst.mana(5)).toBe(0);
  });

  it('White Heat holds full Heat without burning, then leaves you overheated', () => {
    const w = smith({ temper: 1, slag_burst: 1, white_heat: 1 });
    w.cmdSkill('white_heat', w.player.x, w.player.y);
    run(w, 1, () => (w.player.invuln = 99));
    expect(w.player.buffs.white_heat).toBeTruthy();
    expect(w.player.heat).toBe(HEAT_MAX);
    expect(w.player.overheat).toBe(false);
    const life = w.player.life;
    run(w, 3, () => (w.player.invuln = 99));
    expect(w.player.life).toBe(life);
    run(w, SKILL_BY_ID.white_heat.params(1).duration!, () => (w.player.invuln = 99));
    expect(w.player.buffs.white_heat).toBeUndefined();
    expect(w.player.overheat).toBe(true);
  });

  it('Anvil Drop lands after a moment, crushing and stunning', () => {
    const w = smith({ anvil_drop: 3 });
    const m = dummy(w);
    w.player.invuln = 99;
    w.cmdSkill('anvil_drop', m.x, m.y, m.id);
    run(w, 0.5);
    expect(w.area.hazards.some((h) => h.anvil)).toBe(true);
    expect(m.life).toBe(m.maxLife);
    run(w, 1);
    expect(m.life).toBeLessThan(m.maxLife);
    expect(m.stun).toBeGreaterThan(0);
    expect(w.player.heat).toBeGreaterThan(0);
  });

  it('Shockwave strikes everything in front and nothing behind', () => {
    const w = smith({ anvil_drop: 1, shockwave: 5 });
    const p = w.player;
    const m = dummy(w);
    const ang = Math.atan2(m.y - p.y, m.x - p.x);
    const others = w.area.monsters.filter((o) => o !== m && !o.dead).slice(0, 2);
    const [front, behind] = others;
    for (const o of others) (o.life = o.maxLife = 1e7), (o.dmgMin = o.dmgMax = 0);
    // Put them on tiles known to be open: along the line to the first monster, and at the hero's back.
    front.x = p.x + Math.cos(ang) * 0.5 + Math.cos(ang + 0.4) * 0.3;
    front.y = p.y + Math.sin(ang) * 0.5 + Math.sin(ang + 0.4) * 0.3;
    behind.x = p.x - Math.cos(ang) * 0.4;
    behind.y = p.y - Math.sin(ang) * 0.4;
    for (let i = 0; i < 8 && (m.life === m.maxLife || front.life === front.maxLife); i++) {
      w.player.mana = w.stats.maxMana;
      w.player.invuln = 99;
      behind.knock = { x: 0, y: 0 };
      w.cmdSkill('shockwave', m.x, m.y);
      run(w, 1.2, () => (w.player.invuln = 99));
    }
    expect(m.life).toBeLessThan(m.maxLife);
    expect(front.life).toBeLessThan(front.maxLife);
    expect(behind.life).toBe(behind.maxLife);
  });

  it('Earthshaker sends out three tremors', () => {
    const w = smith({ earthshaker: 1 });
    const m = dummy(w);
    m.def_ = 0;
    let hits = 0;
    let last = m.life;
    w.cmdSkill('earthshaker', w.player.x, w.player.y);
    run(w, 3, () => {
      w.player.invuln = 99;
      if (m.life < last) hits++;
      last = m.life;
    });
    expect(hits).toBe(3);
  });

  it('builds ballistas up to the cap, and they shoot', () => {
    const w = smith({ ballista: 1 });
    expect(w.constructCount('ballista')).toEqual({ alive: 0, max: 1 });
    expect(w.constructCount('sunder')).toBeNull();
    const m = dummy(w);
    w.cmdAutoSkill('ballista');
    run(w, 1, calm(w));
    expect(w.minions.map((mi) => mi.ally)).toEqual(['ballista']);
    const first = w.minions[0];
    expect(first.fixed).toBe(true);
    const at = { x: first.x, y: first.y };
    run(w, 3, calm(w));
    expect(m.life).toBeLessThan(m.maxLife);
    expect(w.minions[0].x).toBe(at.x);
    expect(w.minions[0].y).toBe(at.y);
    // Level 1 allows one: building another scraps the first.
    w.cmdAutoSkill('ballista');
    run(w, 1, calm(w));
    expect(w.minions.length).toBe(1);
    expect(w.minions[0]).not.toBe(first);
    // Level 5 allows two.
    w.char.skills.ballista = 5;
    w.cmdAutoSkill('ballista');
    run(w, 1, calm(w));
    expect(w.constructCount('ballista')).toEqual({ alive: 2, max: 2 });
  });

  it('monsters attack constructs, and can destroy them', () => {
    const w = smith({ ballista: 1 });
    const m = nextToMonster(w);
    m.life = m.maxLife = 1e7;
    w.cmdSkill('ballista', m.x + 0.6, m.y);
    run(w, 1, calm(w));
    const turret = w.minions[0];
    expect(turret).toBeTruthy();
    // Step well away, so the turret is the only thing in reach.
    turret.x = m.x + 0.7;
    turret.y = m.y;
    m.alert = true;
    m.foe = turret.id;
    const life = turret.life;
    m.dmgMin = m.dmgMax = Math.ceil(life / 3);
    m.ar = 1e6;
    m.level = w.char.level;
    run(w, 12, calm(w));
    expect(turret.life).toBeLessThan(life);
    expect(turret.dead).toBe(true);
    expect(w.minions).not.toContain(turret);
  });

  it('turrets wind down, and are left behind when the hero moves on', () => {
    const w = smith({ ballista: 1, bellows: 1 });
    w.cmdAutoSkill('ballista');
    run(w, 1, calm(w));
    w.cmdAutoSkill('bellows');
    run(w, 1, calm(w));
    expect(w.minions.map((mi) => mi.ally).sort()).toEqual(['ballista', 'bellows']);
    run(w, SKILL_BY_ID.ballista.params(1).duration! + 1, calm(w));
    expect(w.minions.length).toBe(0);
    w.cmdAutoSkill('ballista');
    run(w, 1, calm(w));
    expect(w.minions.length).toBe(1);
    w.enterArea('hollow_cave', 'exit', 'cinder_fields');
    expect(w.minions.length).toBe(0);
  });

  it('the Bellows turret roasts what stands in front of it', () => {
    const w = smith({ ballista: 1, bellows: 3 });
    const m = dummy(w);
    w.cmdAutoSkill('bellows');
    run(w, 3, calm(w));
    expect(w.minions[0].ally).toBe('bellows');
    expect(m.life).toBeLessThan(m.maxLife);
    expect(w.area.fx.some((f) => f.kind === 'flame')).toBe(true);
  });

  it('the Brass Sentinel fights, and follows between areas', () => {
    const w = smith({ ballista: 1, brass_sentinel: 2 });
    const m = dummy(w);
    w.cmdAutoSkill('brass_sentinel');
    run(w, 1, calm(w));
    const s = w.minions[0];
    expect(s.ally).toBe('sentinel');
    expect(s.fixed).toBeFalsy();
    run(w, 5, calm(w));
    expect(m.life).toBeLessThan(m.maxLife);
    // A second one replaces the first.
    w.cmdAutoSkill('brass_sentinel');
    run(w, 1, calm(w));
    expect(w.minions.filter((mi) => mi.ally === 'sentinel').length).toBe(1);
    w.enterArea('hollow_cave', 'exit', 'cinder_fields');
    expect(w.minions.map((mi) => mi.ally)).toEqual(['sentinel']);
    expect(Math.hypot(w.minions[0].x - w.player.x, w.minions[0].y - w.player.y)).toBeLessThan(4);
  });

  it('the Furnace heals the hero and constructs that stand near it', () => {
    const w = smith({ ballista: 1, bellows: 1, gearwork: 1, brass_sentinel: 1, furnace: 3 });
    // Somewhere quiet, so nothing but the furnace changes anyone's life.
    w.area.monsters.length = 0;
    w.cmdAutoSkill('brass_sentinel');
    run(w, 1, calm(w));
    w.cmdAutoSkill('furnace');
    run(w, 1, calm(w));
    const f = w.minions.find((mi) => mi.ally === 'furnace')!;
    const s = w.minions.find((mi) => mi.ally === 'sentinel')!;
    expect(f.fixed).toBe(true);
    w.player.life = 10;
    s.life = 1;
    run(w, 4);
    const near = w.player.life;
    expect(near).toBeGreaterThan(10 + SKILL_BY_ID.furnace.params(3).heal! * 3);
    expect(s.life).toBeGreaterThan(1);
    expect(w.area.fx.some((x) => x.kind === 'warmth') || near > 10).toBe(true);
    // Out of its warmth, nothing.
    w.player.x = f.x + 9;
    w.player.life = 10;
    const regen = w.stats.lifeRegen;
    run(w, 2, () => w.cmdMoveDir(null));
    expect(w.player.life).toBeLessThanOrEqual(10 + regen * 3 + 0.001);
  });

  it('on the Ember Road, a furnace and a hot smith both keep the cold off', () => {
    const w = smith({ ballista: 1, bellows: 1, gearwork: 1, furnace: 1 }, 30);
    w.enterArea('rimefall_pass', 'start');
    w.area.monsters.length = 0;
    const p = w.player;
    expect(w.cold).toBe(true);
    expect(w.warmthAt(p.x, p.y)).toBe(0);
    p.heat = 90;
    expect(w.warmthAt(p.x, p.y)).toBe(0.5);
    p.heat = 0;
    w.cmdAutoSkill('furnace');
    run(w, 1, calm(w));
    expect(w.minions[0].ally).toBe('furnace');
    expect(w.warmthAt(p.x, p.y)).toBe(1);
    w.ember = 0.2;
    run(w, 2, calm(w));
    expect(w.ember).toBeGreaterThan(0.2);
  });

  it('Gearwork makes constructs tougher', () => {
    const a = smith({ ballista: 1 });
    const b = smith({ ballista: 1, bellows: 1, gearwork: 5 });
    for (const w of [a, b]) {
      w.cmdAutoSkill('ballista');
      run(w, 1, calm(w));
    }
    expect(b.minions[0].maxLife).toBeGreaterThan(a.minions[0].maxLife);
    expect(b.minions[0].dmgMax).toBeGreaterThan(a.minions[0].dmgMax);
  });

  it('has its own uniques, item set and skill affix', () => {
    const own = UNIQUES.filter((u) => u.mods.some((m) => m.stat === 'skills_forgewright'));
    expect(own.length).toBeGreaterThanOrEqual(3);
    for (const u of own) expect(baseOf(u.base)).toBeTruthy();
    const set = SETS.find((s) => s.classId === 'forgewright')!;
    expect(set.pieces.length).toBe(4);
    expect(Object.values(set.bonuses).flat().some((m) => m.stat === 'skills_forgewright')).toBe(true);
    expect(AFFIXES.some((a) => a.mods.some((m) => m.stat === 'skills_forgewright'))).toBe(true);
    // +skills only count for the class they name.
    const c = createCharacter('F', 'forgewright');
    const r = createCharacter('R', 'reaver');
    for (const ch of [c, r]) ch.equipment.amulet = { uid: 1, base: 'amulet', rarity: 'magic', ilvl: 10, identified: true, mods: [{ stat: 'skills_forgewright', value: 2 }], sockets: 0, gems: [], reqLvl: 1 };
    expect(computeStats(c).skillBonus).toBe(2);
    expect(computeStats(r).skillBonus).toBe(0);
  });
});
