import { describe, expect, it } from 'vitest';
import { addToInventory } from '../src/game/character';
import { makeItem } from '../src/game/items';
import { elemDamage, LOOT_BOUNCE, type World } from '../src/game/world';
import { makeWorld, nextToMonster, run } from './helpers';

describe('town', () => {
  it('starts in a safe town with vendors', () => {
    const w = makeWorld();
    expect(w.area.def.id).toBe('town');
    expect(w.area.npcs.map((n) => n.kind).sort()).toEqual(['fence', 'healer', 'sage', 'smith']);
    expect(w.area.monsters.length).toBe(0);
    expect(w.vendors.smith.length).toBeGreaterThan(5);
    w.cmdSkill('attack', w.player.x + 1, w.player.y);
    run(w, 0.5);
    expect(w.player.action).toBeNull();
  });

  it('talking to the healer restores life', () => {
    const w = makeWorld();
    w.player.life = 5;
    const healer = w.area.npcs.find((n) => n.kind === 'healer')!;
    w.cmdInteract({ kind: 'npc', id: healer.id });
    run(w, 6);
    expect(w.player.life).toBe(w.stats.maxLife);
    expect(w.events.some((e) => e.type === 'open' && e.panel === 'healer')).toBe(true);
  });

  it('buys and sells', () => {
    const w = makeWorld();
    w.char.gold = 10000;
    const item = w.vendors.smith[0];
    expect(w.buy('smith', item.uid)).toBeNull();
    expect(w.char.inventory.some((e) => e.item.uid === item.uid)).toBe(true);
    const gold = w.char.gold;
    expect(w.sell(item.uid)).toBeNull();
    expect(w.char.gold).toBeGreaterThan(gold);
  });

  it('gambles into the inventory', () => {
    const w = makeWorld();
    w.char.gold = 1e6;
    const r = w.gambleBuy('ring');
    expect(typeof r).not.toBe('string');
    expect(w.char.inventory.length).toBe(1);
  });
});

describe('travel', () => {
  it('walks out of the gate into the Cinder Fields and back', () => {
    const w = makeWorld();
    const gate = w.area.level.exits[0];
    w.cmdInteract({ kind: 'exit', index: 0 });
    run(w, 10);
    expect(w.area.def.id).toBe('cinder_fields');
    const back = w.area.level.exits.find((e) => e.to === 'town')!;
    expect(Math.hypot(back.x - w.player.x, back.y - w.player.y)).toBeGreaterThan(1.5);
    w.enterArea('town', 'exit', 'cinder_fields');
    expect(Math.hypot(gate.x - w.player.x, gate.y - w.player.y)).toBeLessThan(6);
  });

  it('town portal round trip returns to the same spot', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const tps = w.char.tpCharges;
    expect(w.castTownPortal()).toBe(true);
    run(w, 3);
    expect(w.area.def.id).toBe('town');
    expect(w.char.tpCharges).toBe(tps - 1);
    const spot = { ...w.portal! };
    w.cmdInteract({ kind: 'portal' });
    run(w, 4);
    expect(w.area.def.id).toBe('cinder_fields');
    expect(Math.hypot(spot.x - w.player.x, spot.y - w.player.y)).toBeLessThan(2.5);
    expect(w.portal).toBeNull();
  });

  it('activates waypoints and travels with them', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    expect(w.useWaypoint('cinder_fields')).toBe(false);
    w.cmdInteract({ kind: 'waypoint' });
    run(w, 10);
    expect(w.char.waypoints).toContain('0:cinder_fields');
    expect(w.useWaypoint('town')).toBe(true);
    expect(w.area.def.id).toBe('town');
    expect(w.useWaypoint('cinder_fields')).toBe(true);
    expect(w.area.def.id).toBe('cinder_fields');
  });

  it('areas persist while the game runs', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const m = w.area.monsters[0];
    m.life = 1;
    w.enterArea('town', 'start');
    w.enterArea('cinder_fields', 'start');
    expect(w.area.monsters.find((x) => x.id === m.id)?.life).toBe(1);
  });
});

describe('combat', () => {
  it('melee kills a monster and grants experience', () => {
    const w = makeWorld('reaver');
    w.enterArea('cinder_fields', 'start');
    const m = nextToMonster(w);
    const xp = w.char.xp;
    run(w, 20, () => {
      w.player.life = w.stats.maxLife;
      if (!w.player.action && !m.dead) w.cmdSkill('attack', m.x, m.y, m.id);
    });
    expect(m.dead).toBe(true);
    expect(w.char.xp).toBeGreaterThan(xp);
  });

  it('fire bolt hits at range', () => {
    const w = makeWorld('arcanist');
    w.enterArea('cinder_fields', 'start');
    const m = nextToMonster(w);
    const life = m.life;
    w.player.mana = 100;
    w.cmdSkill('fire_bolt', m.x, m.y, m.id);
    run(w, 1);
    expect(m.life).toBeLessThan(life);
  });

  it('huntress shoots arrows with a bow', () => {
    const w = makeWorld('huntress');
    w.enterArea('cinder_fields', 'start');
    const m = nextToMonster(w);
    w.player.mana = 100;
    run(w, 6, () => {
      w.player.life = w.stats.maxLife;
      if (!w.player.action && !m.dead) w.cmdSkill('power_shot', m.x, m.y, m.id);
    });
    expect(m.life).toBeLessThan(m.maxLife);
  });

  it('monsters notice and hurt an idle player', () => {
    const w = makeWorld('arcanist');
    w.enterArea('cinder_fields', 'start');
    nextToMonster(w);
    run(w, 8, () => (w.player.invuln = 0));
    expect(w.player.life < w.stats.maxLife || w.player.dead).toBe(true);
  });

  it('death drops the player in town, losing some gold', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 0;
    w.char.gold = 1000;
    w.damagePlayer(elemDamage('fire', 1e6), { level: 1 });
    expect(w.player.dead).toBe(true);
    w.respawn();
    expect(w.area.def.id).toBe('town');
    expect(w.player.life).toBe(w.stats.maxLife);
    expect(w.char.gold).toBe(800);
  });

  it('hardcore death is permanent', () => {
    const w = makeWorld();
    w.char.hardcore = true;
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 0;
    w.damagePlayer(elemDamage('phys', 1e6), { level: 1 });
    expect(w.char.dead).toBe(true);
  });
});

describe('items in the world', () => {
  it('walking over gold picks it up', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const g = w.char.gold;
    w.area.ground.push({ id: 999, x: w.player.x, y: w.player.y, gold: 50, t: 0 });
    run(w, 0.1);
    expect(w.char.gold).toBe(g + 50);
  });

  it('picks up items into the inventory and equips them', () => {
    const w = makeWorld('reaver');
    w.enterArea('cinder_fields', 'start');
    const helm = makeItem('cap');
    w.dropToGround(helm, w.player.x + 1, w.player.y, false);
    const g = w.area.ground[w.area.ground.length - 1];
    w.cmdInteract({ kind: 'item', id: g.id });
    run(w, 2);
    expect(w.char.inventory.some((e) => e.item.uid === helm.uid)).toBe(true);
    const def = w.stats.def;
    expect(w.equip(helm.uid)).toBeNull();
    expect(w.stats.def).toBeGreaterThan(def);
  });

  it('potions heal over time', () => {
    const w = makeWorld();
    w.player.life = 10;
    expect(w.usePotion('hp')).toBe(true);
    run(w, 3.5);
    expect(w.player.life).toBeGreaterThanOrEqual(Math.min(40, w.stats.maxLife));
  });

  it('drinks for what is missing, counting healing already on its way', () => {
    const w = makeWorld();
    w.char.potions = { hp1: 2, hp2: 1, hp3: 1 };
    w.stats.maxLife = 500;
    w.player.life = 450;
    expect(w.nextPotion('hp')).toBe('hp2');
    expect(w.usePotion('hp')).toBe(true);
    expect(w.char.potions.hp2).toBeUndefined();
    expect(w.nextPotion('hp')).toBe('hp1');
    w.player.life = 100;
    expect(w.nextPotion('hp')).toBe('hp3');
  });

  describe('a pickup with no room', () => {
    it('rare drops announce themselves with their own sound', () => {
      const w = makeWorld();
      const drop = w as unknown as { spawnDrops(x: number, y: number, mlvl: number, tier: 'boss'): void };
      let rares = 0;
      for (let i = 0; i < 60; i++) {
        w.area.ground.length = 0;
        w.events.length = 0;
        drop.spawnDrops(w.player.x, w.player.y, 30, 'boss');
        const dropped = w.area.ground.filter((g) => g.item?.rarity === 'rare').length;
        rares += dropped;
        expect(w.events.filter((e) => e.type === 'sound' && e.id === 'rare').length).toBe(dropped);
      }
      expect(rares).toBeGreaterThan(0);
    });

    const thuds = (w: World) => w.events.filter((e) => e.type === 'sound' && e.id === 'thud').length;
    const settled = (w: World, base: string) => {
      w.dropToGround(makeItem(base), w.player.x, w.player.y, false);
      const g = w.area.ground[w.area.ground.length - 1];
      g.t = 5;
      return g;
    };

    it('hops the potion back up with one thud, however often it is clicked', () => {
      const w = makeWorld();
      w.char.potions = { hp1: 8 };
      const g = settled(w, 'hp1');
      w.pickup(g);
      expect(g.t).toBe(0);
      expect(thuds(w)).toBe(1);
      w.pickup(g);
      expect(thuds(w)).toBe(1);
      g.t = LOOT_BOUNCE;
      w.pickup(g);
      expect(thuds(w)).toBe(2);
    });

    it('hops gear left behind by a full backpack', () => {
      const w = makeWorld();
      while (addToInventory(w.char, makeItem('quilted_armor')));
      const g = settled(w, 'quilted_armor');
      w.pickup(g);
      expect(w.area.ground).toContain(g);
      expect(g.t).toBe(0);
      expect(thuds(w)).toBe(1);
    });

    it('stays quiet when the item fits', () => {
      const w = makeWorld();
      const g = settled(w, 'quilted_armor');
      w.pickup(g);
      expect(w.area.ground).not.toContain(g);
      expect(thuds(w)).toBe(0);
    });
  });

  it('leaves potions on the ground when the pool has no room', () => {
    const w = makeWorld();
    w.char.potions = { hp1: 8 };
    const bag = w.char.inventory.length;
    w.dropToGround(makeItem('hp1'), w.player.x, w.player.y, false);
    const g = w.area.ground[w.area.ground.length - 1];
    w.pickup(g);
    expect(w.area.ground).toContain(g);
    expect(w.char.inventory.length).toBe(bag);
    w.dropToGround(makeItem('hp2'), w.player.x, w.player.y, false);
    w.pickup(w.area.ground[w.area.ground.length - 1]);
    expect(w.char.potions).toEqual({ hp1: 7, hp2: 1 });
  });

  it('identify and socket at the sage', () => {
    const w = makeWorld();
    const it = makeItem('cap');
    it.sockets = 2;
    const gem = makeItem('gem_ruby_1');
    w.char.inventory.push({ item: it, x: 0, y: 0 }, { item: gem, x: 3, y: 0 });
    expect(w.socketTargets().map((x) => x.uid)).toContain(it.uid);
    expect(w.socketGem(gem.uid, it.uid)).toBe(true);
    expect(it.gems).toEqual(['gem_ruby_1']);
    const unk = makeItem('ring', 5, 'magic');
    unk.identified = false;
    w.char.inventory.push({ item: unk, x: 5, y: 0 });
    expect(w.identifyAll()).toBe(1);
  });
});

describe('quests', () => {
  it('cleansing the Hollow Cave rewards a skill point from the sage', () => {
    const w = makeWorld();
    w.enterArea('hollow_cave', 'start');
    expect(w.questState('hollow')).toBe('active');
    for (const m of w.area.monsters) w.damageMonster(m, elemDamage('fire', 1e7));
    // The super unique resists fire partially but not fully, so everything is dead.
    expect(w.area.monsters.every((m) => m.dead)).toBe(true);
    expect(w.questState('hollow')).toBe('done');
    w.enterArea('town', 'start');
    const sp = w.char.skillPoints;
    const sage = w.area.npcs.find((n) => n.kind === 'sage')!;
    w.cmdInteract({ kind: 'npc', id: sage.id });
    run(w, 6);
    expect(w.char.skillPoints).toBe(sp + 1);
    expect(w.questState('hollow')).toBe('rewarded');
  });

  it('reveals only the last five creatures of the Hollow Cave purge', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    expect(w.questStrays()).toEqual([]);
    w.enterArea('hollow_cave', 'start');
    expect(w.questStrays()).toEqual([]);
    for (const m of w.area.monsters.slice(6)) w.damageMonster(m, elemDamage('fire', 1e7));
    expect(w.questStrays()).toEqual([]);
    w.damageMonster(w.area.monsters[5], elemDamage('fire', 1e7));
    expect(w.questStrays()).toHaveLength(5);
    w.damageMonster(w.area.monsters[0], elemDamage('fire', 1e7));
    expect(w.questStrays()).toHaveLength(4);
    for (const m of w.area.monsters) w.damageMonster(m, elemDamage('fire', 1e7));
    expect(w.questStrays()).toEqual([]);
  });

  it('killing the Mother of Cinders unlocks the next difficulty', () => {
    const w = makeWorld();
    w.enterArea('hellforge', 'start');
    const boss = w.area.monsters.find((m) => m.superId === 'mother')!;
    expect(boss).toBeTruthy();
    w.damageMonster(boss, elemDamage('cold', 1e7));
    expect(w.questState('forge')).toBe('done');
    expect(w.char.maxDifficulty).toBe(1);
    expect(w.events.some((e) => e.type === 'victory')).toBe(true);
  });
});

describe('long simulation', () => {
  for (const cls of ['reaver', 'arcanist', 'huntress'] as const) {
    it(`${cls} bot clears monsters in the Cinder Fields without errors`, () => {
      const w = makeWorld(cls, 4242);
      w.enterArea('cinder_fields', 'start');
      const skill = w.char.hotbar[1]!;
      let kills = 0;
      const total = w.area.monsters.length;
      run(w, 240, () => {
        if (w.player.dead) w.respawn(), w.enterArea('cinder_fields', 'start');
        if (w.player.life < w.stats.maxLife * 0.5) w.player.life = w.stats.maxLife;
        w.player.mana = w.stats.maxMana;
        if (w.player.action || w.player.intent) return;
        const live = w.area.monsters.filter((m) => !m.dead);
        if (!live.length) return;
        live.sort((a, b) => Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y));
        const m = live[0];
        w.cmdSkill(skill, m.x, m.y, m.id);
      });
      kills = total - w.area.monsters.filter((m) => !m.dead).length;
      expect(kills).toBeGreaterThan(15);
      expect(w.char.level).toBeGreaterThan(1);
    });
  }
});
