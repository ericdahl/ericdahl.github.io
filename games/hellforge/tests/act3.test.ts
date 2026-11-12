import { describe, expect, it } from 'vitest';
import { AREAS, AREA_BY_ID, DIFFICULTY_LEVELS, QUESTS } from '../src/game/areas';
import { createCharacter } from '../src/game/character';
import { BASE_BY_ID, SETS, UNIQUES } from '../src/game/items';
import { COLD_THEMES, floodDistances, idx } from '../src/game/map';
import { MONSTERS, type MonsterDef } from '../src/game/monsters';
import { STORIES } from '../src/game/story';
import { BRAZIER_RADIUS, DODGE_COOLDOWN, elemDamage, EMBER_TIME, FROST_TIME, SLAG_BRITTLE, SLAG_MOLTEN, World, type Monster, type WorldObject } from '../src/game/world';
import { makeWorld, run } from './helpers';

const ACT3 = AREAS.filter((a) => a.act === 3);

/** A hero alone in an Act 3 area: no monsters, and (unless asked) nothing that can hurt them. */
function atFirst(area: string, invuln = true) {
  const w = makeWorld();
  w.char.level = 40;
  w.refreshStats();
  w.player.life = w.stats.maxLife;
  w.enterArea(area, 'start');
  w.player.invuln = invuln ? 999 : 0;
  w.area.monsters.length = 0;
  w.area.purged = true;
  return w;
}

function spawnNear(w: World, id: string, dx = 1.5, dy = 0): Monster {
  const m = w.spawnMonster(w.area, id, w.player.x + dx, w.player.y + dy, 'normal', {});
  m.alert = true;
  return m;
}

const braziers = (w: World) => w.area.objects.filter((o) => o.kind === 'brazier');
const stories = (w: World, id: string) => w.events.filter((e) => e.type === 'story' && e.id === id).length;
const priv = (w: World) => w as unknown as {
  coldSnap(m: Monster): void; snuff(m: Monster): void; startToll(m: Monster): void; ringBell(m: Monster): void; lightBrazier(o: WorldObject): void;
};

/** Stands the hero on a brazier's tile without lighting it. */
function standAt(w: World, o: { x: number; y: number }, dx = 0) {
  w.player.x = o.x + dx;
  w.player.y = o.y;
}

function openNorth(w: World) {
  w.setQuest('forge', 'rewarded');
  w.setQuest('hollow_sun', 'done');
}

describe('act 3 content', () => {
  it('has a town and the five areas of the Ember Road, each with its own look, score and weather', () => {
    expect(ACT3.map((a) => a.id)).toEqual(['emberwatch_ruins', 'rimefall_pass', 'drowned_mines', 'bellfounders_halls', 'cold_furnace', 'hellforge_heart']);
    const themes = ACT3.map((a) => a.spec.theme);
    expect(new Set(themes).size).toBe(ACT3.length);
    for (const a of AREAS.filter((d) => d.act !== 3)) expect(themes).not.toContain(a.spec.theme);
    for (const a of ACT3) expect(!!a.cold, a.id).toBe(!a.town);
  });

  it('every link points to a real area that links back', () => {
    for (const a of ACT3) {
      for (const link of a.spec.links) {
        expect(AREA_BY_ID[link.to], link.to).toBeTruthy();
        expect(AREA_BY_ID[link.to].spec.links.some((b) => b.to === a.id), `${link.to} back to ${a.id}`).toBe(true);
      }
    }
  });

  it('every area monster and boss exists', () => {
    for (const a of ACT3) {
      for (const m of a.monsters) expect(MONSTERS[m], m).toBeTruthy();
      if (a.superUnique) expect(MONSTERS[a.superUnique], a.superUnique).toBeTruthy();
    }
    for (const id of ['rime_thrall', 'bellwarden', 'slag_golem', 'hearth_eater']) expect(ACT3.some((a) => a.monsters.includes(id)), id).toBe(true);
  });

  it('every area generates fully connected across seeds, with braziers that can be reached', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      const w = makeWorld('reaver', seed);
      for (const def of ACT3) {
        const a = w.getArea(def.id);
        const l = a.level;
        const dist = floodDistances(l, l.start.x, l.start.y);
        for (const e of l.exits) expect(dist[idx(l, e.x, e.y)], `${def.id} seed ${seed} exit ${e.to}`).toBeGreaterThanOrEqual(0);
        if (l.waypoint) expect(dist[idx(l, l.waypoint.x, l.waypoint.y)], `${def.id} waypoint`).toBeGreaterThanOrEqual(0);
        if (def.superUnique) expect(a.monsters.some((m) => m.superId === def.superUnique), `${def.id} boss`).toBe(true);
        if (def.town) continue;
        expect(a.monsters.length, def.id).toBeGreaterThan(20);
        const bz = a.objects.filter((o) => o.kind === 'brazier');
        expect(bz.length, `${def.id} seed ${seed} braziers`).toBeGreaterThanOrEqual(4);
        for (const o of bz) {
          expect(o.used, 'starts dark').toBe(false);
          expect(dist[idx(l, Math.floor(o.x), Math.floor(o.y))], `${def.id} seed ${seed} brazier`).toBeGreaterThanOrEqual(0);
        }
        // The first fire is a few steps from the way in.
        expect(Math.min(...bz.map((o) => dist[idx(l, Math.floor(o.x), Math.floor(o.y))]))).toBeLessThanOrEqual(10);
      }
    }
  });

  it('a boss lair keeps a brazier in each corner to shelter at', () => {
    for (const id of ['drowned_mines', 'bellfounders_halls', 'hellforge_heart']) {
      const w = makeWorld('reaver', 7);
      const a = w.getArea(id);
      const b = a.level.spots.boss;
      expect(a.objects.filter((o) => o.kind === 'brazier' && Math.hypot(o.x - b.x, o.y - b.y) < 10).length, id).toBeGreaterThanOrEqual(4);
    }
  });

  it('only the cold themes get braziers, so older areas generate exactly as before', () => {
    const w = makeWorld('reaver', 7);
    for (const def of AREAS.filter((a) => !COLD_THEMES.has(a.spec.theme))) expect(w.getArea(def.id).objects.some((o) => o.kind === 'brazier'), def.id).toBe(false);
  });

  it('nightmare starts above where normal ends, so it stays a challenge', () => {
    const top = Math.max(...AREAS.map((a) => a.alvl));
    expect(top).toBe(AREA_BY_ID.hellforge_heart.alvl);
    expect(DIFFICULTY_LEVELS[1] + 1).toBeGreaterThan(top);
    expect(DIFFICULTY_LEVELS[2]).toBeGreaterThan(DIFFICULTY_LEVELS[1]);
  });

  it('has four quests, each with its text, its area and a story to go with the act', () => {
    const quests = QUESTS.filter((d) => d.act === 3);
    expect(quests.map((q) => q.id)).toEqual(['beacons', 'frostwright', 'phylactery', 'rekindle']);
    for (const q of quests) {
      expect(AREA_BY_ID[q.area].quest).toBe(q.id);
      expect(q.intro.length).toBeGreaterThan(40);
      expect(q.done.length).toBeGreaterThan(40);
    }
    expect(quests[quests.length - 1].reward).toBe('Next difficulty unlocked');
    expect(QUESTS.find((q) => q.id === 'hollow_sun')!.reward).not.toContain('difficulty');
    for (const id of ['ember_dims', 'north', 'frostwright', 'echo', 'unlit', 'rekindle'] as const) expect(STORIES[id].lines.length, id).toBeGreaterThanOrEqual(3);
  });

  it('adds gear for the act: new bases, ten uniques and a five-piece set', () => {
    const bases = ['rime_pick', 'founders_maul', 'watch_blade', 'icicle_dirk', 'ember_wand', 'bell_staff', 'horn_bow', 'fur_mantle', 'founders_plate', 'watch_helm', 'bell_shield', 'fur_mitts', 'snow_treads', 'founders_girdle'];
    for (const b of bases) expect(BASE_BY_ID[b], b).toBeTruthy();
    const top = AREA_BY_ID.hellforge_heart.alvl + 3;
    for (const b of bases) expect(BASE_BY_ID[b].qlvl, b).toBeLessThanOrEqual(top);
    const uniques = UNIQUES.filter((u) => bases.includes(u.base));
    expect(uniques.length).toBe(10);
    for (const u of uniques) expect(u.qlvl, u.id).toBeLessThanOrEqual(top);
    const set = SETS.find((s) => s.id === 'emberwatch')!;
    expect(set.pieces.length).toBe(5);
    for (const p of set.pieces) expect(bases, p.id).toContain(p.base);
    expect(Object.keys(set.bonuses)).toEqual(['2', '3', '4', '5']);
  });
});

describe('the road north', () => {
  it('stays closed until Corvane is dead', () => {
    const w = makeWorld();
    w.setQuest('forge', 'rewarded');
    expect(w.roadNorthOpen).toBe(false);
    expect(w.caravanStops()).toEqual(['tel_maresh']);
    expect(w.waypointList().some((wp) => wp.act === 3)).toBe(false);
    w.travelCaravan('emberwatch_ruins');
    expect(w.area.def.id).toBe('town');
  });

  it('the caravan carries you north once, telling the story on arrival', () => {
    const w = makeWorld();
    openNorth(w);
    w.enterArea('tel_maresh', 'start');
    expect(w.caravanStops()).toEqual(['town', 'emberwatch_ruins']);
    w.travelCaravan('emberwatch_ruins');
    expect(w.area.def.id).toBe('emberwatch_ruins');
    expect(w.act).toBe(3);
    expect(w.inTown).toBe(true);
    expect(w.homeTown).toBe('emberwatch_ruins');
    expect(stories(w, 'north')).toBe(1);
    expect(w.waypointList().find((wp) => wp.id === 'emberwatch_ruins')?.active).toBe(true);
    w.travelCaravan('tel_maresh');
    w.travelCaravan('emberwatch_ruins');
    expect(stories(w, 'north')).toBe(1);
    // With no destination it still means "back to Emberwatch Camp", as it always has.
    w.travelCaravan();
    expect(w.area.def.id).toBe('town');
  });

  it('Imre tells you the ember is dying when he pays out the Hollow Sun', () => {
    const w = makeWorld();
    openNorth(w);
    w.enterArea('tel_maresh', 'start');
    const sage = w.area.npcs.find((n) => n.kind === 'sage')!;
    w.player.x = sage.x + 0.6;
    w.player.y = sage.y;
    w.cmdInteract({ kind: 'npc', id: sage.id });
    run(w, 1);
    expect(w.questState('hollow_sun')).toBe('rewarded');
    expect(stories(w, 'ember_dims')).toBe(1);
  });

  it('Emberwatch has its survivors, with Wren keeping the watch', () => {
    const w = makeWorld();
    openNorth(w);
    w.enterArea('emberwatch_ruins', 'start');
    expect(w.area.npcs.map((n) => n.kind).sort()).toEqual(['caravan', 'fence', 'healer', 'sage', 'smith']);
    expect(w.npcInfo('sage')).toEqual({ name: 'Wren', title: 'Last of the Watch' });
    expect(w.npcInfo('fence').name).toBe('Ysolde');
    expect(w.area.level.props.some((p) => p.kind === 'hearth')).toBe(true);
  });

  it('sends town portals and respawns to Emberwatch, and wakes a returning hero there', () => {
    const w = makeWorld();
    openNorth(w);
    w.enterArea('rimefall_pass', 'start');
    expect(w.castTownPortal()).toBe(true);
    run(w, 3);
    expect(w.area.def.id).toBe('emberwatch_ruins');
    const c = createCharacter('T', 'reaver');
    c.waypoints.push('0:tel_maresh', '0:emberwatch_ruins');
    expect(new World(c, 5).area.def.id).toBe('emberwatch_ruins');
  });
});

describe('warmth', () => {
  it('the ember only burns down where the cold is loose', () => {
    const w = atFirst('rimefall_pass');
    expect(w.cold).toBe(true);
    expect(w.ember).toBe(1);
    run(w, 10);
    expect(w.ember).toBeLessThan(1);
    expect(w.ember).toBeGreaterThan(0.7);
    w.enterArea('emberwatch_ruins', 'start');
    expect(w.ember).toBe(1);
    const south = atFirst('glass_sea');
    run(south, 10);
    expect(south.ember).toBe(1);
    expect(south.frost).toBe(0);
  });

  it('a full ember lasts about a minute, and its light shrinks as it dies', () => {
    const w = atFirst('cold_furnace');
    const bright = w.sight;
    run(w, EMBER_TIME * 0.5);
    expect(w.ember).toBeGreaterThan(0.4);
    expect(w.frost).toBe(0);
    run(w, EMBER_TIME * 0.6);
    expect(w.ember).toBe(0);
    expect(w.sight).toBeLessThan(bright * 0.7);
  });

  it('once the ember is out frostbite builds: it slows first, then wounds', () => {
    const speed = (w: World) => {
      const x = w.player.x;
      const y = w.player.y;
      w.cmdMoveDir({ x: 1, y: 0 });
      run(w, 0.3);
      w.cmdMoveDir(null);
      return Math.hypot(w.player.x - x, w.player.y - y);
    };
    const w = atFirst('rimefall_pass', false);
    const warm = speed(w);
    w.ember = 0;
    run(w, FROST_TIME * 0.4);
    expect(w.frost).toBeGreaterThan(0.2);
    expect(w.frost).toBeLessThan(0.5);
    const life = w.player.life;
    run(w, FROST_TIME * 0.3);
    expect(w.frost).toBeGreaterThan(0.5);
    expect(w.player.life).toBeGreaterThanOrEqual(life);
    expect(speed(w)).toBeLessThan(warm * 0.9);
    run(w, FROST_TIME * 0.5 + 3);
    expect(w.frost).toBe(1);
    expect(w.player.life).toBeLessThan(life - w.stats.maxLife * 0.05);
  });

  it('brushing past a brazier lights it, and its firelight refills the ember and thaws frostbite', () => {
    const w = atFirst('rimefall_pass');
    const o = braziers(w)[0];
    w.ember = 0;
    w.frost = 0.8;
    standAt(w, o, 0.6);
    w.cmdMoveDir({ x: -1, y: 0 });
    run(w, 0.1);
    w.cmdMoveDir(null);
    expect(o.used).toBe(true);
    expect(w.ember).toBeGreaterThanOrEqual(0.5);
    run(w, 3);
    expect(w.nearFire).toBe(true);
    expect(w.ember).toBe(1);
    expect(w.frost).toBe(0);
    // Step out of the light and the ember starts to burn down again.
    standAt(w, o, BRAZIER_RADIUS + 2);
    run(w, 2);
    expect(w.nearFire).toBe(false);
    expect(w.ember).toBeLessThan(1);
  });

  it('a lit brazier holds the cold off for as long as you stand by it', () => {
    const w = atFirst('rimefall_pass', false);
    const o = braziers(w)[0];
    standAt(w, o, 1.5);
    priv(w).lightBrazier(o);
    run(w, 120);
    expect(w.ember).toBe(1);
    expect(w.frost).toBe(0);
    expect(w.player.life).toBe(w.stats.maxLife);
  });

  it('fire skills feed the ember; other skills do not', () => {
    const cast = (skill: string) => {
      const w = makeWorld('arcanist');
      w.char.level = 40;
      w.char.skills[skill] = 5;
      w.refreshStats();
      w.player.mana = w.stats.maxMana;
      w.enterArea('cold_furnace', 'start');
      w.area.monsters.length = 0;
      w.ember = 0.3;
      w.cmdSkill(skill, w.player.x + 3, w.player.y);
      run(w, 1.2);
      return w.ember;
    };
    expect(cast('fire_bolt')).toBeGreaterThan(0.33);
    expect(cast('ice_bolt')).toBeLessThan(0.3);
  });

  it('a burning monster is warm to stand beside, and the dead give up their heat', () => {
    const w = atFirst('cold_furnace');
    const m = spawnNear(w, 'frozen_miner', 1.5);
    m.stun = 99;
    expect(w.warmthAt(w.player.x, w.player.y)).toBe(0);
    w.damageMonster(m, elemDamage('fire', 1));
    expect(m.burnT).toBeGreaterThan(0);
    expect(w.warmthAt(w.player.x, w.player.y)).toBeGreaterThan(0);
    run(w, 4);
    expect(m.burnT).toBe(0);
    expect(w.warmthAt(w.player.x, w.player.y)).toBe(0);
    w.ember = 0.4;
    w.damageMonster(m, elemDamage('fire', 1e7));
    expect(w.ember).toBeGreaterThan(0.45);
    const cold = spawnNear(w, 'frozen_miner', 1.5);
    w.ember = 0.4;
    w.damageMonster(cold, elemDamage('phys', 1e7));
    expect(w.ember).toBeGreaterThan(0.4);
    expect(w.ember).toBeLessThan(0.45);
  });

  it('a whiteout rolls through the pass and burns the ember down faster', () => {
    const burn = (storm: number) => {
      const w = atFirst('rimefall_pass');
      (w as unknown as { stormIn: number }).stormIn = 1e9;
      w.storm = storm;
      (w as unknown as { stormLeft: number }).stormLeft = storm ? 1e9 : 0;
      run(w, 5);
      return 1 - w.ember;
    };
    expect(burn(1)).toBeGreaterThan(burn(0) * 2.5);
    const w = atFirst('rimefall_pass');
    let peak = 0;
    run(w, 90, () => (peak = Math.max(peak, w.storm)));
    expect(peak).toBeGreaterThan(0.5);
    const inside = atFirst('cold_furnace');
    run(inside, 90);
    expect(inside.storm).toBe(0);
  });

  it('dying or going back to town relights the ember', () => {
    const w = atFirst('rimefall_pass', false);
    w.ember = 0;
    w.frost = 1;
    w.damagePlayer(elemDamage('phys', 1e9), { level: 30 });
    expect(w.player.dead).toBe(true);
    w.respawn();
    expect(w.ember).toBe(1);
    expect(w.frost).toBe(0);
  });

  it('lighting every beacon in Rimefall Pass completes the quest, and Wren pays it out', () => {
    const w = makeWorld();
    openNorth(w);
    w.enterArea('rimefall_pass', 'start');
    expect(w.questState('beacons')).toBe('active');
    const all = braziers(w);
    expect(all.length).toBeGreaterThanOrEqual(8);
    expect(w.unlitBeacons().length).toBe(all.length);
    for (const o of all.slice(1)) priv(w).lightBrazier(o);
    expect(w.questState('beacons')).toBe('active');
    expect(w.unlitBeacons()).toEqual([all[0]]);
    priv(w).lightBrazier(all[0]);
    expect(w.questState('beacons')).toBe('done');
    w.enterArea('emberwatch_ruins', 'start');
    const skills = w.char.skillPoints;
    const sage = w.area.npcs.find((n) => n.kind === 'sage')!;
    w.player.x = sage.x + 0.6;
    w.player.y = sage.y;
    w.cmdInteract({ kind: 'npc', id: sage.id });
    run(w, 1);
    expect(w.questState('beacons')).toBe('rewarded');
    expect(w.char.skillPoints).toBe(skills + 1);
  });
});

describe('monster rules', () => {
  it('rime-thralls shatter into shards of ice that sap the ember', () => {
    const w = atFirst('rimefall_pass', false);
    const m = spawnNear(w, 'rime_thrall', 1.2);
    w.damageMonster(m, elemDamage('phys', 1e6));
    const shards = w.area.projectiles.filter((p) => p.kind === 'm_ice');
    expect(shards.length).toBe(MONSTERS.rime_thrall.burst);
    expect(shards.every((p) => p.dmg.cold > 0 && (p.sap ?? 0) > 0)).toBe(true);
    // Point one straight at the hero.
    const s = shards[0];
    Object.assign(s, { x: w.player.x - 0.8, y: w.player.y, vx: 7, vy: 0 });
    const ember = w.ember;
    run(w, 0.4);
    expect(w.ember).toBeLessThan(ember - 0.05);
    expect(w.player.chill).toBeGreaterThan(0);
  });

  it('a rime-thrall burned to death only melts', () => {
    const w = atFirst('rimefall_pass');
    const m = spawnNear(w, 'rime_thrall', 3);
    w.damageMonster(m, elemDamage('fire', 1e6));
    expect(m.dead).toBe(true);
    expect(w.area.projectiles.length).toBe(0);
  });

  it('a bellwarden winds up, then its toll spreads out and strikes whoever it passes', () => {
    const w = atFirst('bellfounders_halls', false);
    const m = spawnNear(w, 'bellwarden', 3);
    m.abilityCd = 0;
    m.atkCd = 99;
    run(w, 0.05);
    expect(m.action?.kind).toBe('toll');
    expect(w.area.fx.some((f) => f.kind === 'toll_mark')).toBe(true);
    expect(w.area.rings.length).toBe(0);
    const life = w.player.life;
    run(w, 0.9);
    expect(w.area.rings.length).toBe(1);
    expect(w.player.life).toBe(life);
    m.stun = 99;
    run(w, 0.8);
    expect(w.player.life).toBeLessThan(life);
    run(w, 2);
    expect(w.area.rings.length).toBe(0);
  });

  it('rolling through the toll avoids it', () => {
    const w = atFirst('bellfounders_halls', false);
    const m = spawnNear(w, 'bellwarden', 4);
    m.stun = 99;
    priv(w).ringBell(m);
    const life = w.player.life;
    // The ring crosses four tiles in a little over half a second: roll into it as it arrives.
    let rolled = false;
    run(w, 1.2, () => {
      const g = w.area.rings[0];
      if (!rolled && g && Math.hypot(w.player.x - g.x, w.player.y - g.y) - g.r < 0.8) rolled = w.cmdDodge({ x: -1, y: 0 });
    });
    expect(rolled).toBe(true);
    expect(w.player.life).toBe(life);
    expect(w.dodgeCd).toBeLessThanOrEqual(DODGE_COOLDOWN);
  });

  it('a toll does not pass through walls', () => {
    const w = atFirst('bellfounders_halls', false);
    const l = w.area.level;
    // Wall off a pocket four tiles from the hero and stand the warden in it.
    const px = Math.floor(w.player.x);
    const py = Math.floor(w.player.y);
    for (let dy = -3; dy <= 3; dy++) for (let dx = 2; dx <= 6; dx++) l.tiles[idx(l, px + dx, py + dy)] = 2;
    l.tiles[idx(l, px + 4, py)] = 1;
    const spot = { x: px + 4.5, y: py + 0.5 };
    const m = w.spawnMonster(w.area, 'bellwarden', spot.x, spot.y, 'normal', {});
    m.stun = 99;
    priv(w).ringBell(m);
    const life = w.player.life;
    run(w, 1.5);
    expect(w.player.life).toBe(life);
  });

  it('fire makes a slag golem molten: it shrugs off blows, hits harder and warms the air', () => {
    const w = atFirst('cold_furnace');
    const m = spawnNear(w, 'slag_golem', 6);
    m.stun = 99;
    m.res.phys = 0;
    w.damageMonster(m, elemDamage('fire', 1));
    expect(m.heat).toBeGreaterThanOrEqual(SLAG_MOLTEN);
    const life = m.life;
    w.damageMonster(m, elemDamage('phys', 100));
    expect(life - m.life).toBeCloseTo(85, 0);
    expect(w.warmthAt(m.x + 1, m.y)).toBeGreaterThan(0);
    // Left alone, away from any fire, it cools back to plain slag.
    run(w, 8);
    expect(m.heat).toBeLessThan(SLAG_MOLTEN);
  });

  it('cold makes a slag golem brittle, and the next blows land far harder', () => {
    const w = atFirst('cold_furnace');
    const m = spawnNear(w, 'slag_golem', 6);
    m.stun = 99;
    m.res.phys = 0;
    w.damageMonster(m, elemDamage('cold', 1));
    expect(m.heat).toBeLessThanOrEqual(SLAG_BRITTLE);
    const life = m.life;
    w.damageMonster(m, elemDamage('phys', 100));
    expect(life - m.life).toBeCloseTo(160, 0);
  });

  it('a slag golem standing in firelight heats up on its own', () => {
    const w = atFirst('cold_furnace');
    const o = braziers(w)[0];
    priv(w).lightBrazier(o);
    const near = w.spawnMonster(w.area, 'slag_golem', o.x + 1, o.y, 'normal', {});
    const far = w.spawnMonster(w.area, 'slag_golem', o.x + BRAZIER_RADIUS + 3, o.y, 'normal', {});
    standAt(w, o, 2);
    for (const m of [near, far]) m.stun = 99;
    run(w, 2);
    expect(near.heat).toBeGreaterThanOrEqual(SLAG_MOLTEN);
    expect(far.heat ?? 0).toBe(0);
  });

  it('a molten golem hits half again as hard', () => {
    const hit = (heat: number) => {
      const w = atFirst('cold_furnace', false);
      const m = spawnNear(w, 'slag_golem', 1);
      m.heat = heat;
      m.dmgMin = m.dmgMax = 40;
      m.ar = 1e9;
      m.atkCd = 0;
      m.abilityCd = 99;
      const life = w.player.life;
      run(w, 0.5);
      return life - w.player.life;
    };
    const plain = hit(0);
    expect(plain).toBeGreaterThan(0);
    expect(hit(1)).toBeCloseTo(plain * 1.5, 0);
  });

  it('a hearth-eater drinks the ember from a distance, and bites once it is dry', () => {
    const w = atFirst('rimefall_pass', false);
    const m = spawnNear(w, 'hearth_eater', 5);
    const life = w.player.life;
    run(w, 3);
    expect(m.drainT).toBeGreaterThan(0);
    expect(w.ember).toBeLessThan(0.7);
    expect(w.player.life).toBe(life);
    expect(Math.hypot(m.x - w.player.x, m.y - w.player.y)).toBeGreaterThan(4);
    w.ember = 0;
    run(w, 3);
    expect(w.player.life).toBeLessThan(life);
  });

  it('a hearth-eater cannot drink from anyone standing in firelight, and has to come in close', () => {
    const w = atFirst('rimefall_pass');
    const o = braziers(w)[0];
    priv(w).lightBrazier(o);
    standAt(w, o, 1.5);
    run(w, 0.1);
    const m = w.spawnMonster(w.area, 'hearth_eater', o.x - 1, o.y, 'normal', {});
    m.alert = true;
    run(w, 4);
    expect(w.ember).toBe(1);
    expect(m.drainT ?? 0).toBe(0);
    expect(Math.hypot(m.x - w.player.x, m.y - w.player.y)).toBeLessThan(1.6);
  });

  it('sets no boss resistance high enough to become immune on Hell', () => {
    for (const id of ['frostwright', 'echo', 'unlit', 'phylactery']) {
      const d: MonsterDef = MONSTERS[id];
      const elements = (['fire', 'cold', 'light'] as const).filter((k) => (d.res[k] ?? 0) < 50);
      expect(elements.length, id).toBe(3);
    }
  });
});

describe('bosses', () => {
  const boss = (w: World, id: string) => w.area.monsters.find((m) => m.superId === id)!;

  function setup(area: string, id: string, invuln = true) {
    const w = makeWorld();
    w.char.level = 40;
    w.refreshStats();
    w.player.life = w.stats.maxLife;
    openNorth(w);
    w.enterArea(area, 'start');
    w.player.invuln = invuln ? 999 : 0;
    const b = boss(w, id);
    w.player.x = b.x - 2.5;
    w.player.y = b.y + 1.5;
    b.alert = true;
    // Only the boss matters in these tests.
    for (const m of w.area.monsters) if (m !== b) m.dead = true;
    return { w, b };
  }

  /** Holds everything still so that only the ability under test can do anything. */
  function hold(w: World, b: Monster, at: { x: number; y: number }, seconds: number) {
    b.invulnT = 99;
    for (let t = 0; t < seconds; t += 1 / 30) {
      w.player.x = at.x;
      w.player.y = at.y;
      w.area.hazards.length = 0;
      w.step(1 / 30);
    }
  }

  it('the Frostwright changes phase, cannot be hurt while changing, and tells his story as he dies', () => {
    const { w, b } = setup('drowned_mines', 'frostwright');
    expect(w.questState('frostwright')).toBe('active');
    run(w, 0.05);
    expect(b.phase ?? 0).toBe(0);
    b.life = b.maxLife * 0.45;
    run(w, 0.05);
    expect(b.phase).toBe(1);
    expect(b.abilities).toContain('cold_snap');
    expect(w.damageMonster(b, elemDamage('fire', 1e6))).toBe(false);
    run(w, 2);
    w.damageMonster(b, elemDamage('fire', 1e8));
    expect(w.questState('frostwright')).toBe('done');
    expect(stories(w, 'frostwright')).toBe(1);
  });

  function snap(shelter: 'lit' | 'dark' | 'open') {
    const { w, b } = setup('drowned_mines', 'frostwright', false);
    const near = braziers(w).filter((o) => Math.hypot(o.x - b.x, o.y - b.y) < 18).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y));
    const o = near[0];
    if (shelter === 'lit') priv(w).lightBrazier(o);
    // 'open' is a spot out of every brazier's reach; the others stand beside one without touching it.
    const far = near[near.length - 1];
    const at = shelter === 'open' ? { x: far.x + 30, y: far.y } : { x: o.x + (o.x < b.x ? 1.5 : -1.5), y: o.y };
    w.ember = 1;
    priv(w).coldSnap(b);
    expect(w.area.fx.filter((f) => f.kind === 'warm_mark').length).toBe(near.length);
    const before = w.player.life;
    // Stand still, well short of touching the brazier, so nothing lights by accident.
    hold(w, b, at, 3.2);
    return { w, o, lost: before - w.player.life, max: w.stats.maxLife };
  }

  it('the cold snap spares only those standing by a lit brazier, and puts that brazier out', () => {
    const safe = snap('lit');
    expect(safe.lost).toBeLessThan(1);
    expect(safe.w.ember).toBeGreaterThan(0.9);
    expect(safe.o.used).toBe(false);
    for (const where of ['dark', 'open'] as const) {
      const hit = snap(where);
      expect(hit.lost, where).toBeGreaterThan(hit.max * 0.3);
      expect(hit.w.ember, where).toBe(0);
      expect(hit.w.frost, where).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("Corvane's Echo confronts you, then hides behind a phylactery that has to be broken", () => {
    const { w, b } = setup('bellfounders_halls', 'echo');
    expect(b.name).toBe('Echo of Old Corvin');
    run(w, 0.05);
    expect(stories(w, 'echo')).toBe(1);
    b.life = b.maxLife * 0.6;
    run(w, 0.05);
    expect(b.phase).toBe(1);
    const jar = w.area.monsters.find((m) => m.def.id === 'phylactery' && !m.dead)!;
    expect(jar).toBeTruthy();
    expect(b.wardId).toBe(jar.id);
    run(w, 2);
    const life = b.life;
    expect(w.damageMonster(b, elemDamage('fire', 1e6))).toBe(false);
    expect(b.life).toBe(life);
    // The phylactery does not move. It rings.
    const at = { x: jar.x, y: jar.y };
    b.stun = 99;
    run(w, 5);
    expect(Math.hypot(jar.x - at.x, jar.y - at.y)).toBeLessThan(0.5);
    expect(jar.action?.kind === 'toll' || w.area.rings.length > 0 || jar.abilityCd > 0).toBe(true);
    w.damageMonster(jar, elemDamage('fire', 1e8));
    expect(jar.dead).toBe(true);
    expect(b.wardId).toBeUndefined();
    expect(b.stun).toBeGreaterThan(1);
    expect(w.damageMonster(b, elemDamage('fire', 10))).toBe(true);
  });

  it('the Echo calls a second phylactery, becomes the Last Echo, and dying completes the quest', () => {
    const { w, b } = setup('bellfounders_halls', 'echo');
    b.life = b.maxLife * 0.6;
    run(w, 0.05);
    for (const m of w.area.monsters) if (m.def.id === 'phylactery') w.damageMonster(m, elemDamage('fire', 1e8));
    run(w, 3);
    b.life = b.maxLife * 0.3;
    b.stun = 0;
    run(w, 0.05);
    expect(b.phase).toBe(2);
    expect(b.name).toBe('Corvane, the Last Echo');
    expect(b.shape).toBe('noon');
    expect(b.abilities).toContain('toll');
    const jars = w.area.monsters.filter((m) => m.def.id === 'phylactery' && !m.dead);
    expect(jars.length).toBe(1);
    w.damageMonster(jars[0], elemDamage('fire', 1e8));
    run(w, 2);
    w.damageMonster(b, elemDamage('fire', 1e8));
    expect(b.dead).toBe(true);
    expect(w.questState('phylactery')).toBe('done');
    expect(w.char.maxDifficulty).toBe(0);
  });

  it('the Unlit snuffs braziers and takes half the ember from anyone inside its reach', () => {
    for (const inside of [true, false]) {
      const { w, b } = setup('hellforge_heart', 'unlit', false);
      const o = braziers(w).filter((x) => Math.hypot(x.x - b.x, x.y - b.y) < 7.5)[0] ?? braziers(w)[0];
      // Bring the Unlit to the fire, so the test does not depend on the lair's size.
      b.x = o.x + 3;
      b.y = o.y;
      priv(w).lightBrazier(o);
      w.ember = 1;
      priv(w).snuff(b);
      expect(w.area.fx.some((f) => f.kind === 'snuff_mark')).toBe(true);
      const at = inside ? { x: b.x - 1.5, y: b.y } : { x: b.x - 9, y: b.y };
      b.stun = 99;
      for (let t = 0; t < 2; t += 1 / 30) {
        w.player.x = at.x;
        w.player.y = at.y;
        w.step(1 / 30);
      }
      expect(o.used, 'the brazier goes dark').toBe(false);
      if (inside) expect(w.ember).toBeLessThanOrEqual(0.55);
      else expect(w.ember).toBeGreaterThan(0.9);
    }
  });

  it('the Unlit feeds while the ember is out', () => {
    const regen = (ember: number) => {
      const { w, b } = setup('hellforge_heart', 'unlit');
      b.phase = 99;
      b.invulnT = 1e9;
      b.life = b.maxLife * 0.5;
      const before = b.life;
      for (let t = 0; t < 5; t += 1 / 30) {
        w.ember = ember;
        w.step(1 / 30);
      }
      return (b.life - before) / b.maxLife;
    };
    expect(regen(0)).toBeGreaterThan(0.04);
    expect(regen(1)).toBe(0);
  });

  it('the Unlit transforms twice, and killing it brings the fire home and unlocks the next difficulty', () => {
    const { w, b } = setup('hellforge_heart', 'unlit');
    expect(b.name).toBe('The Unlit');
    expect(b.rarity).toBe('boss');
    run(w, 0.05);
    expect(stories(w, 'unlit')).toBe(1);
    b.life = b.maxLife * 0.5;
    run(w, 0.05);
    expect(b.name).toBe('The Unlit, Hungering');
    expect(b.abilities).toContain('cold_snap');
    run(w, 2);
    b.life = b.maxLife * 0.2;
    run(w, 0.05);
    expect(b.name).toBe('The Unlit, Winter Entire');
    run(w, 2);
    w.ember = 0.1;
    expect(w.char.maxDifficulty).toBe(0);
    w.damageMonster(b, elemDamage('fire', 1e8));
    expect(w.questState('rekindle')).toBe('done');
    expect(w.char.maxDifficulty).toBe(1);
    expect(w.events.some((e) => e.type === 'victory')).toBe(true);
    expect(w.ember).toBe(1);
    expect(braziers(w).every((o) => o.used)).toBe(true);
    // Wren pays out the last quest.
    w.enterArea('emberwatch_ruins', 'start');
    const sage = w.area.npcs.find((n) => n.kind === 'sage')!;
    w.player.x = sage.x + 0.6;
    w.player.y = sage.y;
    w.cmdInteract({ kind: 'npc', id: sage.id });
    run(w, 1);
    expect(w.questState('rekindle')).toBe('rewarded');
  });

  it('the next difficulty is harder all the way through the new act', () => {
    const c = createCharacter('T', 'reaver');
    c.maxDifficulty = 1;
    c.difficulty = 1;
    const w = new World(c, 3);
    const heart = w.getArea('hellforge_heart');
    expect(heart.monsters.find((m) => m.superId === 'unlit')!.level).toBeGreaterThan(AREA_BY_ID.hellforge_heart.alvl + DIFFICULTY_LEVELS[1]);
    expect(heart.monsters.length).toBeGreaterThan(20);
  });
});
