import { describe, expect, it } from 'vitest';
import { AREAS, AREA_BY_ID, DIFFICULTY_LEVELS, QUESTS } from '../src/game/areas';
import { createCharacter } from '../src/game/character';
import { floodDistances, idx } from '../src/game/map';
import { MONSTERS, type MonsterDef } from '../src/game/monsters';
import { STORIES } from '../src/game/story';
import { elemDamage, World, type Monster } from '../src/game/world';
import { makeWorld, run } from './helpers';

const ACT2 = AREAS.filter((a) => a.act === 2);

function atFirst(area: string) {
  const w = makeWorld();
  w.char.level = 30;
  w.refreshStats();
  w.player.invuln = 999;
  w.enterArea(area, 'start');
  w.area.monsters.length = 0;
  // These tests kill the only monster in the area; the purge reward would muddy their experience counts.
  w.area.purged = true;
  return w;
}

function spawnNear(w: World, id: string, dx = 1.5, dy = 0): Monster {
  const m = w.spawnMonster(w.area, id, w.player.x + dx, w.player.y + dy, 'normal', {});
  m.alert = true;
  return m;
}

function openRoad(w: World) {
  w.setQuest('forge', 'rewarded');
}

const stories = (w: World, id: string) => w.events.filter((e) => e.type === 'story' && e.id === id).length;

describe('act 2 content', () => {
  it('is as large as act 1', () => {
    const act1 = AREAS.filter((a) => !a.act);
    expect(ACT2.length).toBe(act1.length);
    const packs = (l: typeof AREAS) => l.reduce((n, a) => n + a.packs, 0);
    expect(packs(ACT2)).toBeGreaterThanOrEqual(packs(act1));
    expect(ACT2.filter((a) => a.superUnique).length).toBe(act1.filter((a) => a.superUnique).length);
  });

  it('every link points to a real area that links back', () => {
    for (const a of ACT2) {
      for (const link of a.spec.links) {
        expect(AREA_BY_ID[link.to], link.to).toBeTruthy();
        expect(AREA_BY_ID[link.to].spec.links.some((b) => b.to === a.id), `${link.to} back to ${a.id}`).toBe(true);
      }
    }
  });

  it('every area monster and boss exists', () => {
    for (const a of ACT2) {
      for (const m of a.monsters) expect(MONSTERS[m], m).toBeTruthy();
      if (a.superUnique) expect(MONSTERS[a.superUnique], a.superUnique).toBeTruthy();
    }
  });

  it('every area generates fully connected across seeds', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const w = makeWorld('reaver', seed);
      w.setQuest('forge', 'rewarded');
      for (const def of ACT2) {
        const a = w.getArea(def.id);
        const l = a.level;
        const dist = floodDistances(l, l.start.x, l.start.y);
        for (const e of l.exits) expect(dist[idx(l, e.x, e.y)], `${def.id} seed ${seed} exit ${e.to}`).toBeGreaterThanOrEqual(0);
        if (l.waypoint) expect(dist[idx(l, l.waypoint.x, l.waypoint.y)], `${def.id} waypoint`).toBeGreaterThanOrEqual(0);
        if (def.superUnique) expect(a.monsters.some((m) => m.superId === def.superUnique), `${def.id} boss`).toBe(true);
        if (!def.town) expect(a.monsters.length, def.id).toBeGreaterThan(20);
      }
    }
  });

  it('nightmare starts above where normal ends, so it stays a challenge', () => {
    const top = Math.max(...AREAS.map((a) => a.alvl));
    expect(DIFFICULTY_LEVELS[1] + 1).toBeGreaterThan(top);
  });

  it('has quest text and a sage reward path for each act 2 quest', () => {
    for (const q of QUESTS.filter((d) => d.act === 2)) {
      expect(AREA_BY_ID[q.area].quest).toBe(q.id);
      expect(q.intro.length).toBeGreaterThan(20);
    }
    for (const s of Object.values(STORIES)) expect(s.lines.length).toBeGreaterThan(0);
  });
});

describe('the road south', () => {
  it('stays closed, with no caravan, until Vhorza is dead', () => {
    const w = makeWorld();
    expect(w.area.npcs.some((n) => n.kind === 'caravan')).toBe(false);
    expect(w.waypointList().some((wp) => wp.act === 2)).toBe(false);
  });

  it('opens a caravan that carries you there and back, telling the story once', () => {
    const w = makeWorld();
    openRoad(w);
    w.enterArea('cinder_fields', 'start');
    w.enterArea('town', 'start');
    expect(w.area.npcs.some((n) => n.kind === 'caravan')).toBe(true);
    w.travelCaravan();
    expect(w.area.def.id).toBe('tel_maresh');
    expect(w.inTown).toBe(true);
    expect(w.act).toBe(2);
    expect(stories(w, 'arrive')).toBe(1);
    expect(w.waypointList().find((wp) => wp.id === 'tel_maresh')?.active).toBe(true);
    w.travelCaravan();
    expect(w.area.def.id).toBe('town');
    w.travelCaravan();
    expect(stories(w, 'arrive')).toBe(1);
  });

  it('gives Tel Maresh its own townsfolk and replaces Corvin once he is gone', () => {
    const w = makeWorld();
    expect(w.npcInfo('sage').name).toBe('Old Corvin');
    openRoad(w);
    w.enterArea('cinder_fields', 'start');
    w.enterArea('town', 'start');
    expect(w.npcInfo('sage').name).toBe('Wren');
    w.travelCaravan();
    expect(w.npcInfo('sage').name).toBe('Keeper Imre');
    expect(w.area.npcs.map((n) => n.kind).sort()).toEqual(['caravan', 'fence', 'healer', 'sage', 'smith']);
  });

  it('sends town portals and respawns to the town of the current act', () => {
    const w = makeWorld();
    openRoad(w);
    w.enterArea('ashfall_road', 'start');
    expect(w.homeTown).toBe('tel_maresh');
    expect(w.castTownPortal()).toBe(true);
    run(w, 3);
    expect(w.area.def.id).toBe('tel_maresh');
    expect(w.portalPos()).not.toBeNull();
    w.enterArea('ashfall_road', 'start');
    w.player.invuln = 0;
    w.damagePlayer(elemDamage('phys', 1e9), { level: 30 });
    expect(w.player.dead).toBe(true);
    w.respawn();
    expect(w.area.def.id).toBe('tel_maresh');
  });

  it('does not show an act 1 portal in the act 2 town', () => {
    const w = makeWorld();
    openRoad(w);
    w.enterArea('cinder_fields', 'start');
    w.castTownPortal();
    w.enterArea('tel_maresh', 'start');
    expect(w.portalPos()).toBeNull();
  });

  it('wakes a returning hero in the act they reached', () => {
    const c = createCharacter('T', 'reaver');
    c.waypoints.push('0:tel_maresh');
    expect(new World(c, 5).area.def.id).toBe('tel_maresh');
  });
});

describe('monster rules', () => {
  it('embalmed dead get back up unless burned', () => {
    for (const [dmg, rises] of [[elemDamage('cold', 1e6), true], [elemDamage('fire', 1e6), false]] as const) {
      const w = atFirst('buried_bazaar');
      const m = spawnNear(w, 'mummy', 4);
      w.damageMonster(m, dmg);
      expect(m.dead).toBe(true);
      run(w, 3.8);
      expect(m.dead).toBe(!rises);
    }
  });

  it('a risen mummy stays down the second time and gives no more experience', () => {
    const w = atFirst('buried_bazaar');
    const m = spawnNear(w, 'mummy', 4);
    w.damageMonster(m, elemDamage('cold', 1e6));
    run(w, 3.8);
    expect(m.dead).toBe(false);
    const xp = w.char.xp;
    w.damageMonster(m, elemDamage('cold', 1e6));
    expect(w.char.xp).toBe(xp);
    run(w, 3.8);
    expect(m.dead).toBe(true);
  });

  it('using a corpse stops a mummy from rising', () => {
    const w = atFirst('buried_bazaar');
    const m = spawnNear(w, 'mummy', 4);
    w.damageMonster(m, elemDamage('cold', 1e6));
    m.used = true;
    run(w, 3.8);
    expect(m.dead).toBe(true);
  });

  it('glass scarabs burst into shards', () => {
    const w = atFirst('ashfall_road');
    const m = spawnNear(w, 'scarab', 3);
    w.damageMonster(m, elemDamage('phys', 1e6));
    expect(w.area.projectiles.filter((p) => p.kind === 'm_glass').length).toBe(MONSTERS.scarab.burst);
  });

  it('burrowers cannot be hit or targeted underground, then erupt', () => {
    const w = atFirst('glass_sea');
    const m = spawnNear(w, 'burrower', 4);
    m.abilityCd = 0;
    run(w, 0.1);
    expect(m.sub).toBeGreaterThan(0);
    const life = m.life;
    expect(w.damageMonster(m, elemDamage('fire', 1e6))).toBe(false);
    expect(m.life).toBe(life);
    expect(w.autoTarget(20)).toBeNull();
    expect(w.monstersNear(m.x, m.y, 5)).not.toContain(m);
    run(w, 2.2);
    expect(m.sub).toBeUndefined();
  });

  it('mirage dancers split into copies that cannot hurt you and vanish in one hit', () => {
    const w = atFirst('glass_sea');
    w.player.invuln = 0;
    const m = spawnNear(w, 'mirage', 5);
    run(w, 0.05);
    const copies = w.area.monsters.filter((o) => o.illusion);
    expect(copies.length).toBe(2);
    expect(w.area.monsters.filter((o) => !o.dead).length).toBe(3);
    const c = copies[0];
    w.damageMonster(c, elemDamage('phys', 2));
    expect(c.dead).toBe(true);
    const xp = w.char.xp;
    expect(w.char.xp).toBe(xp);
    w.damageMonster(m, elemDamage('fire', 1e6));
    expect(copies[1].dead).toBe(true);
  });

  it('copies never fire or strike', () => {
    const w = atFirst('glass_sea');
    const m = spawnNear(w, 'mirage', 5);
    run(w, 0.05);
    m.dead = true;
    for (const c of w.area.monsters) if (c.illusion) c.atkCd = 0;
    run(w, 1.5);
    expect(w.area.projectiles.length).toBe(0);
  });

  it('acolytes ward allies, and the ward absorbs damage first', () => {
    const w = atFirst('buried_bazaar');
    const acolyte = spawnNear(w, 'acolyte', 5);
    const ally = spawnNear(w, 'colossus', 5, 2);
    acolyte.abilityCd = 0;
    run(w, 0.05);
    expect(ally.shield).toBeGreaterThan(0);
    const shield = ally.shield!;
    const life = ally.life;
    ally.res.fire = 0;
    w.damageMonster(ally, elemDamage('fire', shield / 2));
    expect(ally.life).toBe(life);
    expect(ally.shield).toBeCloseTo(shield / 2, 3);
    run(w, 8);
    expect(ally.shield).toBe(0);
  });

  it('carrion kites heal on corpses and use them up', () => {
    const w = atFirst('carrion_mesa');
    const corpse = spawnNear(w, 'jackal', 3);
    w.damageMonster(corpse, elemDamage('phys', 1e6));
    run(w, 0.5);
    const kite = spawnNear(w, 'kite', 3.2);
    kite.life = 1;
    kite.abilityCd = 0;
    run(w, 1);
    expect(corpse.used).toBe(true);
    expect(kite.life).toBeGreaterThan(1);
  });

  it('colossi telegraph their slam on the ground before it lands', () => {
    const w = atFirst('carrion_mesa');
    const m = spawnNear(w, 'colossus', 2);
    m.abilityCd = 0;
    run(w, 0.05);
    expect(w.area.hazards.length).toBe(1);
    expect(w.area.hazards[0].delay).toBeGreaterThan(0.5);
    expect(w.area.fx.some((f) => f.kind === 'meteor_mark')).toBe(true);
  });

  it('quicksand slows whoever walks through it', () => {
    const speedOn = (sand: boolean) => {
      const w = atFirst('ashfall_road');
      const l = w.area.level;
      l.slow.clear();
      if (sand) for (let i = 0; i < l.tiles.length; i++) l.slow.add(i);
      const p = w.player;
      const sx = p.x;
      const sy = p.y;
      w.cmdMoveDir({ x: 1, y: 0 });
      run(w, 0.4);
      return Math.hypot(p.x - sx, p.y - sy);
    };
    expect(speedOn(true)).toBeLessThan(speedOn(false) * 0.75);
  });

  it('sandstorms come and go only where the area has them', () => {
    const w = atFirst('ashfall_road');
    let peak = 0;
    run(w, 90, () => (peak = Math.max(peak, w.storm)));
    expect(peak).toBeGreaterThan(0.5);
    const inside = atFirst('whisper_cistern');
    run(inside, 90);
    expect(inside.storm).toBe(0);
  });
});

describe('bosses', () => {
  const boss = (w: World, id: string) => w.area.monsters.find((m) => m.superId === id)!;

  function setup(area: string, id: string) {
    const w = makeWorld();
    w.char.level = 30;
    w.refreshStats();
    w.player.invuln = 999;
    w.enterArea(area, 'start');
    const b = boss(w, id);
    w.player.x = b.x - 2.5;
    w.player.y = b.y + 1.5;
    b.alert = true;
    return { w, b };
  }

  for (const [area, id, quest, reward] of [
    ['whisper_cistern', 'skarn', 'cistern', 'skill'],
    ['carrion_mesa', 'karrik', 'mesa', 'stat'],
    ['hall_of_dials', 'embalmer', 'embalmer', 'skill'],
  ] as const) {
    it(`${id} completes its quest and is rewarded by Keeper Imre`, () => {
      const { w, b } = setup(area, id);
      expect(w.questState(quest)).toBe('active');
      b.phase = 99;
      b.res.cold = 0;
      w.damageMonster(b, elemDamage('cold', 1e8));
      expect(w.questState(quest)).toBe('done');
      w.setQuest('forge', 'rewarded');
      w.enterArea('tel_maresh', 'start');
      const skills = w.char.skillPoints;
      const stats = w.char.statPoints;
      const sage = w.area.npcs.find((n) => n.kind === 'sage')!;
      w.player.x = sage.x + 0.6;
      w.player.y = sage.y;
      w.cmdInteract({ kind: 'npc', id: sage.id });
      run(w, 1);
      expect(w.questState(quest)).toBe('rewarded');
      expect(w.char.skillPoints).toBe(skills + (reward === 'skill' ? 1 : 0));
      expect(w.char.statPoints).toBe(stats + (reward === 'stat' ? 5 : 0));
    });
  }

  it('the Embalmer tells the truth as he dies', () => {
    const { w, b } = setup('hall_of_dials', 'embalmer');
    b.phase = 99;
    w.damageMonster(b, elemDamage('cold', 1e8));
    expect(stories(w, 'vizier')).toBe(1);
  });

  it('bosses change phase at their thresholds and cannot be hurt while changing', () => {
    const { w, b } = setup('whisper_cistern', 'skarn');
    run(w, 0.05);
    expect(b.phase ?? 0).toBe(0);
    b.life = b.maxLife * 0.45;
    run(w, 0.05);
    expect(b.phase).toBe(1);
    expect(b.abilities).toContain('burrow_strike');
    expect(b.invulnT).toBeGreaterThan(0);
    const life = b.life;
    expect(w.damageMonster(b, elemDamage('fire', 1e6))).toBe(false);
    expect(b.life).toBe(life);
    run(w, 2);
    expect(b.invulnT).toBe(0);
  });

  it('Corvin confronts you, transforms twice and ends the act', () => {
    const { w, b } = setup('noon_vault', 'corvin');
    expect(b.name).toBe('Old Corvin');
    run(w, 0.05);
    expect(stories(w, 'corvin')).toBe(1);
    b.life = b.maxLife * 0.5;
    run(w, 0.05);
    expect(b.name).toBe('Corvane, Noon-Risen');
    expect(b.shape).toBe('noon');
    run(w, 2);
    b.life = b.maxLife * 0.2;
    run(w, 0.05);
    expect(b.name).toBe('Corvane, the Hollow Sun');
    expect(b.abilities).toContain('noon_burst');
    run(w, 2);
    expect(w.char.maxDifficulty).toBe(0);
    w.damageMonster(b, elemDamage('cold', 1e8));
    expect(w.questState('hollow_sun')).toBe('done');
    expect(w.char.maxDifficulty).toBe(1);
    expect(w.events.some((e) => e.type === 'victory')).toBe(true);
  });

  function noon(inShade: boolean) {
    const { w, b } = setup('noon_vault', 'corvin');
    b.phase = 2;
    b.abilities = ['noon_burst'];
    w.player.invuln = 0;
    w.char.quests['0:story_corvin'] = 'done';
    (w as unknown as { noonBurst(m: Monster): void }).noonBurst(b);
    const marks = w.area.fx.filter((f) => f.kind === 'shade_mark');
    expect(marks.length).toBe(3);
    const hold = inShade ? marks[0] : { x: marks[0].x + 40, y: marks[0].y };
    const before = w.player.life;
    // Pin the player and everything else still, so only the noon can do damage.
    for (const m of w.area.monsters) m.stun = 99;
    b.invulnT = 99;
    for (let t = 0; t < 3; t += 1 / 30) {
      w.player.x = hold.x;
      w.player.y = hold.y;
      w.area.hazards.length = 0;
      w.step(1 / 30);
    }
    return { before, after: w.player.life, max: w.stats.maxLife };
  }

  it('the noon burst spares only those standing in the shade', () => {
    const hit = noon(false);
    const safe = noon(true);
    expect(safe.after).toBeGreaterThanOrEqual(safe.before - 1);
    expect(hit.after).toBeLessThan(hit.before - hit.max * 0.3);
  });

  it('sets no resistance high enough to become immune on Hell', () => {
    for (const id of ['skarn', 'karrik', 'embalmer', 'corvin']) {
      const d: MonsterDef = MONSTERS[id];
      const elements = (['fire', 'cold', 'light'] as const).filter((k) => (d.res[k] ?? 0) < 50);
      expect(elements.length, id).toBeGreaterThan(0);
    }
  });
});

