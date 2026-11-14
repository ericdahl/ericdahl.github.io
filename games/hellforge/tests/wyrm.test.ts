import { describe, expect, it } from 'vitest';
import { AREA_BY_ID, DIFFICULTY_LEVELS } from '../src/game/areas';
import { floodDistances, generateLevel, idx } from '../src/game/map';
import { MONSTERS } from '../src/game/monsters';
import { hashSeed, Rng } from '../src/game/rng';
import { ERRAND_TOWN, WYRM_AREA, WYRM_FROM, WYRM_LINES, YIELD_ANGRY, YIELD_AT } from '../src/game/wyrm';
import { elemDamage, World, type Interactable } from '../src/game/world';
import { makeWorld, run } from './helpers';

/** A hero standing in the roost, strong enough to be there and unable to be hurt unless a test says so. */
function roost(classId: Parameters<typeof makeWorld>[0] = 'reaver', seed = 1234) {
  const w = makeWorld(classId, seed);
  w.char.level = 30;
  w.refreshStats();
  w.player.life = w.stats.maxLife;
  w.enterArea(WYRM_AREA, 'exit', WYRM_FROM);
  w.player.invuln = 999;
  w.events.length = 0;
  return { w, m: w.wyrm()! };
}

const talkTo = (w: World) => {
  const m = w.wyrm()!;
  w.player.x = m.x + 2.5;
  w.player.y = m.y;
  w.cmdInteract({ kind: 'wyrm' });
  run(w, 0.5);
};
const opened = (w: World, panel: string) => w.events.some((e) => e.type === 'open' && e.panel === panel);
const hoard = (w: World) => w.area.objects.filter((o) => o.hoard);

describe('the way to the roost', () => {
  it('is added to Gloomwood without changing anything else about the wood', () => {
    for (const seed of [1, 7, 99, 1234]) {
      const w = makeWorld('reaver', seed);
      const plain = generateLevel(AREA_BY_ID[WYRM_FROM].spec, new Rng(hashSeed(seed, WYRM_FROM, 0)));
      const wood = w.getArea(WYRM_FROM);
      expect(Array.from(wood.level.tiles)).toEqual(Array.from(plain.tiles));
      expect(wood.level.spawns).toEqual(plain.spawns);
      expect(wood.level.exits.length).toBe(plain.exits.length + 1);
      const cave = wood.level.exits.find((e) => e.to === WYRM_AREA)!;
      expect(cave.kind).toBe('down');
      // It can be walked to, and it is not on top of another way out.
      const dist = floodDistances(wood.level, wood.level.start.x, wood.level.start.y);
      expect(dist[idx(wood.level, cave.x, cave.y)], `seed ${seed}`).toBeGreaterThan(10);
      for (const e of wood.level.exits) if (e !== cave) expect(Math.abs(e.x - cave.x) + Math.abs(e.y - cave.y)).toBeGreaterThan(6);
    }
  });

  it('leads up to the cave and back down to the same spot', () => {
    const w = makeWorld();
    w.enterArea(WYRM_FROM, 'start');
    const i = w.area.level.exits.findIndex((e) => e.to === WYRM_AREA);
    const e = w.area.level.exits[i];
    w.area.monsters.length = 0;
    w.player.x = e.x + 0.5;
    w.player.y = e.y + 0.5;
    w.cmdInteract({ kind: 'exit', index: i });
    run(w, 0.5);
    expect(w.area.def.id).toBe(WYRM_AREA);
    expect(w.area.def.name).toBe('The High Roost');
    const back = w.area.level.exits.findIndex((x) => x.to === WYRM_FROM);
    const b = w.area.level.exits[back];
    w.player.x = b.x + 0.5;
    w.player.y = b.y + 0.5;
    w.cmdInteract({ kind: 'exit', index: back });
    run(w, 0.5);
    expect(w.area.def.id).toBe(WYRM_FROM);
    expect(Math.hypot(w.player.x - e.x, w.player.y - e.y)).toBeLessThan(6);
  });
});

describe('the Brass Wyrm asleep', () => {
  it('lies alone on a hoard, far above the level of the wood below', () => {
    const { w, m } = roost();
    expect(w.area.monsters.length).toBe(1);
    expect(m.wyrm).toBe('asleep');
    expect(m.calm).toBe(true);
    expect(m.level).toBe(22);
    expect(m.level).toBeGreaterThan(AREA_BY_ID[WYRM_FROM].alvl + 15);
    expect(hoard(w).length).toBe(3);
    expect(hoard(w).every((o) => !o.used)).toBe(true);
    expect(MONSTERS.wyrm.flies).toBe(true);
    for (const lines of Object.values(WYRM_LINES)) expect(lines.length).toBeGreaterThan(0);
  });

  it('cannot be hurt, targeted or picked a fight with by accident, and does nothing', () => {
    const { w, m } = roost('necromancer');
    w.char.gold = 1e6;
    w.hire('guard');
    w.player.x = m.x + 2;
    w.player.y = m.y;
    w.player.invuln = 0;
    const life = w.player.life;
    expect(w.damageMonster(m, elemDamage('phys', 1e6))).toBe(false);
    expect(w.autoTarget(20)).toBeNull();
    expect(w.pickAt(m.x, m.y).monster).toBeUndefined();
    expect(w.monstersNear(m.x, m.y, 5)).toEqual([]);
    w.cmdAutoSkill('attack');
    run(w, 6);
    expect(m.life).toBe(m.maxLife);
    expect(m.wyrm).toBe('asleep');
    expect(w.player.life).toBe(life);
    expect(w.hirelingMinion()!.foe).toBeUndefined();
    expect(w.stragglers()).toEqual([]);
  });

  it('wakes when spoken to, and offers an errand, a fight or the door', () => {
    const { w, m } = roost();
    const near = w.interactablesNear(m.x + 1, m.y, 4).map((x) => x.target.kind);
    expect(near).toContain('wyrm');
    expect(w.interactLabel({ kind: 'wyrm' })).toBe('Something Asleep on a Hoard');
    talkTo(w);
    expect(opened(w, 'wyrm')).toBe(true);
    expect(m.wyrm).toBe('awake');
    expect(m.calm).toBe(true);
    expect(w.interactLabel({ kind: 'wyrm' })).toBe(m.name);
    expect(w.wyrmTalk()).toBe('greet');
    expect(w.wyrmChoices).toEqual({ errand: true, challenge: true });
    expect(w.wyrmOffers()).toEqual([]);
  });
});

describe('the errand', () => {
  it('is carried to the captain in Tel Maresh and paid for with one of three things from the hoard', () => {
    const { w } = roost();
    talkTo(w);
    expect(w.wyrmErrand()).toBe(true);
    expect(w.wyrmErrand()).toBe(false);
    expect(w.wyrmTalk()).toBe('errand_out');
    // The wrong captain will not do.
    w.enterArea('town', 'start');
    const cap = (kindOf: World) => kindOf.area.npcs.find((n) => n.kind === 'captain')!;
    const speak = () => {
      const n = cap(w);
      w.player.x = n.x + 1;
      w.player.y = n.y;
      w.cmdInteract({ kind: 'npc', id: n.id });
      run(w, 0.5);
    };
    speak();
    expect(w.questState('wyrm_errand')).toBe('active');
    w.setQuest('forge', 'rewarded');
    w.enterArea(ERRAND_TOWN, 'start');
    speak();
    expect(w.questState('wyrm_errand')).toBe('done');
    expect(w.events.some((e) => e.type === 'msg' && e.text.includes('Letter delivered'))).toBe(true);

    w.enterArea(WYRM_AREA, 'exit', WYRM_FROM);
    expect(w.wyrmTalk()).toBe('errand_pay');
    const offers = w.wyrmOffers();
    expect(offers.length).toBe(3);
    expect(w.wyrmOffers()).toBe(offers);
    expect(offers.every((it) => it.identified && it.rarity !== 'normal' && it.rarity !== 'magic')).toBe(true);
    const n = w.char.inventory.length;
    const got = w.wyrmClaim(1)!;
    expect(got).toBe(offers[1]);
    expect(w.char.inventory.length).toBe(n + 1);
    expect(w.questState('wyrm_errand')).toBe('rewarded');
    expect(w.wyrmClaim(0)).toBeNull();
    expect(w.wyrmOffers()).toEqual([]);
    // The fight is still on offer.
    expect(w.wyrmChoices).toEqual({ errand: false, challenge: true });
  });
});

describe('the fight', () => {
  it('starts only when asked for', () => {
    const { w, m } = roost();
    talkTo(w);
    expect(w.wyrmChallenge()).toBe(true);
    expect(m.wyrm).toBe('fight');
    expect(m.calm).toBe(false);
    expect(m.alert).toBe(true);
    expect(w.interactPos({ kind: 'wyrm' } as Interactable)).toBeNull();
    expect(w.autoTarget(20)).toBe(m);
    expect(w.wyrmChallenge()).toBe(false);
  });

  /** A fight in which he can only do one thing, so that thing can be watched. */
  const only = (ability: string, dist = 3) => {
    const { w, m } = roost();
    w.wyrmChallenge();
    w.player.x = m.x + dist;
    w.player.y = m.y;
    m.abilities = [ability as never];
    m.abilityCd = 0;
    m.atkCd = 99;
    return { w, m };
  };

  it('breathes a fan of fire that is marked on the ground first, and burns whoever stays in it', () => {
    const { w, m } = only('breath', 4);
    run(w, 0.3);
    const marks = w.area.hazards.filter((h) => h.owner === 'monster');
    expect(marks.length).toBeGreaterThan(8);
    expect(marks.every((h) => !h.fired && h.delay > 0.8)).toBe(true);
    // Rolling out of it in time is enough.
    const life = w.player.life;
    w.player.invuln = 0;
    m.abilityCd = 99;
    run(w, 1.6);
    expect(w.player.life).toBeLessThan(life);
  });

  it('beats his wings and throws the hero back', () => {
    const { w, m } = only('buffet');
    w.player.invuln = 0;
    const d0 = Math.hypot(w.player.x - m.x, w.player.y - m.y);
    const life = w.player.life;
    run(w, 0.6);
    expect(Math.hypot(w.player.x - m.x, w.player.y - m.y)).toBeGreaterThan(d0 + 1.5);
    expect(w.player.life).toBeLessThan(life);
  });

  it('takes wing: out of reach, raining fire, then down on top of the hero', () => {
    const { w, m } = only('take_wing', 5);
    run(w, 0.3);
    expect(m.sub).toBeGreaterThan(2);
    expect(w.damageMonster(m, elemDamage('phys', 100))).toBe(false);
    expect(w.autoTarget(20)).toBeNull();
    let fire = 0;
    run(w, 2.6, () => (fire = Math.max(fire, w.area.hazards.length)));
    expect(fire).toBeGreaterThan(1);
    m.abilityCd = 99;
    run(w, 1.5);
    expect(m.sub).toBeUndefined();
    expect(Math.hypot(w.player.x - m.x, w.player.y - m.y)).toBeLessThan(3.5);
  });

  it('splits into copies that fall to a single blow', () => {
    const { w, m } = only('mirage_split');
    run(w, 0.3);
    const copies = w.area.monsters.filter((o) => o.illusion && !o.dead);
    expect(copies.length).toBe(2);
    w.damageMonster(copies[0], elemDamage('phys', 10));
    expect(copies[0].dead).toBe(true);
    expect(m.dead).toBe(false);
  });

  it('grows more dangerous as he is worn down, and the world keeps its footing through a long fight', () => {
    for (const seed of [3, 11, 42]) {
      const { w, m } = roost('reaver', seed);
      talkTo(w);
      w.wyrmChallenge();
      w.char.gold = 1e6;
      w.hire('guard');
      run(w, 60, () => {
        if (m.wyrm === 'fight' && !m.sub && m.life > m.maxLife * 0.4) w.damageMonster(m, elemDamage('cold', m.maxLife * 0.004));
      });
      expect(m.phase, `seed ${seed}`).toBe(2);
      expect(m.abilities).toContain('take_wing');
      expect(Number.isFinite(w.player.x + w.player.y + m.x + m.y)).toBe(true);
      expect(m.dead).toBe(false);
    }
  });

  it('ends when he yields at a quarter of his life: he is not killed, and he pays', () => {
    const { w, m } = roost();
    w.wyrmChallenge();
    const cinders = w.char.forge.cinders;
    const xp = w.char.xp;
    w.damageMonster(m, elemDamage('phys', m.maxLife * 0.5));
    expect(m.wyrm).toBe('fight');
    w.damageMonster(m, elemDamage('phys', m.maxLife * 50));
    expect(m.dead).toBe(false);
    expect(m.life).toBeGreaterThan(0);
    expect(m.life).toBeLessThanOrEqual(m.maxLife * YIELD_AT);
    expect(m.wyrm).toBe('yielded');
    expect(m.calm).toBe(true);
    expect(w.area.hazards.filter((h) => h.owner === 'monster')).toEqual([]);
    expect(opened(w, 'wyrm')).toBe(true);
    expect(w.char.forge.cinders).toBe(cinders + 60);
    expect(w.char.xp).toBeGreaterThan(xp);
    expect(w.wyrmTalk()).toBe('fight_pay');
    expect(w.wyrmOffers().length).toBe(3);
    w.wyrmClaim(0);
    expect(w.questState('wyrm_fight')).toBe('rewarded');
    expect(w.wyrmChoices.challenge).toBe(false);
    expect(w.wyrmChallenge()).toBe(false);
    // No more damage, no second payout, and no robbing him afterwards.
    expect(w.damageMonster(m, elemDamage('phys', 1e9))).toBe(false);
    w.cmdInteract({ kind: 'object', id: hoard(w)[0].id });
    run(w, 6);
    expect(hoard(w).every((o) => !o.used)).toBe(true);
    expect(w.questState('wyrm_theft')).toBe('none');
  });

  it('poison cannot finish him either', () => {
    const { w, m } = roost();
    w.wyrmChallenge();
    m.life = m.maxLife * YIELD_AT + 5;
    m.poison = { dps: 1e6, t: 5 };
    run(w, 0.5);
    expect(m.dead).toBe(false);
    expect(m.wyrm).toBe('yielded');
  });

  it('walking away and coming back starts it again from the beginning', () => {
    const { w, m } = roost();
    w.wyrmChallenge();
    w.damageMonster(m, elemDamage('phys', m.maxLife * 0.5));
    w.enterArea(WYRM_FROM, 'exit', WYRM_AREA);
    w.enterArea(WYRM_AREA, 'exit', WYRM_FROM);
    expect(m.wyrm).toBe('fight');
    expect(m.life).toBe(m.maxLife);
  });

  it('a Hiveborn’s Sky Hunter counts him as a bird, and he says so', () => {
    const { w, m } = roost('hiveborn');
    w.char.skills.sky_hunter = 10;
    w.wyrmChallenge();
    const base = m.life;
    w.damageMonster(m, elemDamage('phys', 100));
    expect(base - m.life).toBeGreaterThan(100 * (1 - 0.25));
    expect(w.events.some((e) => e.type === 'msg' && e.text.includes('NOT a bird'))).toBe(true);
  });
});

describe('robbing him', () => {
  it('pays out all three chests at once, wakes him angry, and he gives nothing more when beaten', () => {
    const { w, m } = roost();
    const dmg = m.dmgMax;
    const o = hoard(w)[0];
    w.player.x = o.x + 0.6;
    w.player.y = o.y;
    w.cmdInteract({ kind: 'object', id: o.id });
    run(w, 0.5);
    expect(hoard(w).every((x) => x.used)).toBe(true);
    expect(w.area.ground.length).toBeGreaterThan(3);
    expect(w.questState('wyrm_theft')).toBe('done');
    expect(m.wyrm).toBe('fight');
    expect(m.wyrmAngry).toBe(true);
    expect(m.dmgMax).toBeGreaterThan(dmg);
    expect(w.wyrmChoices.errand).toBe(false);
    // He takes more beating before he gives up.
    w.damageMonster(m, elemDamage('phys', m.maxLife * (1 - YIELD_AT) - 1));
    w.damageMonster(m, elemDamage('phys', m.maxLife * 0.03));
    expect(m.wyrm).toBe('fight');
    const before = w.area.ground.length;
    w.damageMonster(m, elemDamage('phys', m.maxLife * 50));
    expect(m.wyrm).toBe('yielded');
    expect(m.life).toBeLessThanOrEqual(m.maxLife * YIELD_ANGRY);
    expect(w.area.ground.length).toBeGreaterThan(before);
    expect(w.questState('wyrm_fight')).toBe('rewarded');
    expect(w.wyrmTalk()).toBe('robbed');
    expect(w.wyrmOffers()).toEqual([]);
  });

  it('a thief who got away finds him awake and waiting next time', () => {
    const { w } = roost();
    w.cmdInteract({ kind: 'object', id: hoard(w)[0].id });
    run(w, 8);
    expect(w.questState('wyrm_theft')).toBe('done');
    const again = new World(JSON.parse(JSON.stringify(w.char)), 77);
    again.enterArea(WYRM_AREA, 'exit', WYRM_FROM);
    const m = again.wyrm()!;
    expect(m.wyrm).toBe('fight');
    expect(m.wyrmAngry).toBe(true);
    expect(again.area.objects.filter((o) => o.hoard).every((o) => o.used)).toBe(true);
  });
});

describe('what he remembers', () => {
  it('is kept with the hero, and each difficulty has its own', () => {
    const { w, m } = roost();
    w.wyrmChallenge();
    w.damageMonster(m, elemDamage('phys', m.maxLife * 50));
    w.wyrmClaim(2);
    const c = JSON.parse(JSON.stringify(w.char));
    const later = new World(c, 5);
    later.enterArea(WYRM_AREA, 'exit', WYRM_FROM);
    expect(later.wyrm()!.wyrm).toBe('yielded');
    expect(later.wyrmChoices).toEqual({ errand: true, challenge: false });
    c.difficulty = 1;
    const harder = new World(c, 5);
    harder.enterArea(WYRM_AREA, 'exit', WYRM_FROM);
    expect(harder.wyrm()!.wyrm).toBe('asleep');
    expect(harder.wyrm()!.level).toBe(22 + DIFFICULTY_LEVELS[1]);
    expect(harder.wyrmChoices).toEqual({ errand: true, challenge: true });
  });
});

describe('the cave itself', () => {
  it('always has a great chamber apart from the way in, with room round him to fight in', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const w = makeWorld('reaver', seed);
      const a = w.getArea(WYRM_AREA);
      const m = a.monsters.find((x) => x.wyrm)!;
      const l = a.level;
      expect(l.rooms.length, `seed ${seed}`).toBeGreaterThan(3);
      const dist = floodDistances(l, l.start.x, l.start.y);
      expect(dist[idx(l, Math.floor(m.x), Math.floor(m.y))], `seed ${seed}`).toBeGreaterThan(8);
      let open = 0;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (l.tiles[idx(l, Math.floor(m.x) + dx, Math.floor(m.y) + dy)] === 1) open++;
      expect(open, `seed ${seed}`).toBeGreaterThan(70);
    }
  });
});
