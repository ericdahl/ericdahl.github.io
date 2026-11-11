import { describe, expect, it } from 'vitest';
import { AREAS } from '../src/game/areas';
import { isWalkable } from '../src/game/map';
import { MOD_LABEL, UNIQUE_MODS } from '../src/game/monsters';
import { lineOfSight } from '../src/game/path';
import { DODGE_COOLDOWN, elemDamage, SPREE_TIERS, SPREE_WINDOW, type World } from '../src/game/world';
import { makeWorld, nextToMonster, run } from './helpers';

const BIG = elemDamage('phys', 1e7);

function announced(w: World, text: string) {
  return w.events.some((e) => e.type === 'announce' && e.text === text);
}

/** A world standing in an area that has a Tithe Imp in it. */
function worldWithThief() {
  for (let seed = 1; seed < 40; seed++) {
    const w = makeWorld('reaver', seed);
    w.enterArea('cinder_fields', 'start');
    const imp = w.area.monsters.find((m) => m.thief);
    if (imp) return { w, imp };
  }
  throw new Error('no Tithe Imp in forty seeds');
}

describe('dodge', () => {
  it('rolls the hero out of the way, untouchable, and then cools down', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const p = w.player;
    p.invuln = 0;
    // Find a direction with open ground.
    const from = { x: p.x, y: p.y };
    let moved = 0;
    for (const dir of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      w.dodgeCd = 0;
      p.x = from.x;
      p.y = from.y;
      expect(w.cmdDodge(dir)).toBe(true);
      expect(p.invuln).toBeGreaterThan(0);
      const life = p.life;
      w.damagePlayer(elemDamage('fire', 50), { level: 1 });
      expect(p.life).toBe(life);
      run(w, 0.4);
      moved = Math.max(moved, Math.hypot(p.x - from.x, p.y - from.y));
    }
    expect(moved).toBeGreaterThan(2);
    expect(p.action).toBeNull();
    expect(w.dodgeCd).toBeGreaterThan(0);
    expect(w.cmdDodge({ x: 1, y: 0 })).toBe(false);
    run(w, DODGE_COOLDOWN);
    expect(w.cmdDodge({ x: 1, y: 0 })).toBe(true);
  });

  it('cuts a swing short', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const m = nextToMonster(w);
    w.cmdSkill('attack', m.x, m.y, m.id);
    run(w, 0.1);
    expect(w.player.action?.kind).toBe('melee');
    expect(w.cmdDodge()).toBe(true);
    expect(w.player.action?.kind).toBe('dodge');
  });
});

describe('sprees', () => {
  it('quick kills climb the ranks, speed the hero up and are worth more', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const speed = w.stats.moveSpeed;
    const ms = w.area.monsters.filter((m) => !m.thief);
    for (const m of ms.slice(0, 4)) w.damageMonster(m, BIG);
    expect(w.streak.n).toBe(4);
    expect(w.spreeTier()).toBeNull();
    w.damageMonster(ms[4], BIG);
    expect(w.spreeTier()?.title).toBe(SPREE_TIERS[0].title);
    expect(announced(w, SPREE_TIERS[0].title)).toBe(true);
    expect(w.stats.moveSpeed).toBeGreaterThan(speed);
    for (const m of ms.slice(5, 10)) w.damageMonster(m, BIG);
    expect(w.spreeTier()?.title).toBe(SPREE_TIERS[1].title);
    // Let it lapse.
    run(w, SPREE_WINDOW + 0.2);
    expect(w.streak.n).toBe(0);
    expect(w.stats.moveSpeed).toBeCloseTo(speed);
    expect(w.char.bestSpree).toBe(10);
  });

  it('a slow kill does not start one', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const ms = w.area.monsters.filter((m) => !m.thief);
    for (const m of ms.slice(0, 8)) {
      w.damageMonster(m, BIG);
      w.player.invuln = 99;
      run(w, SPREE_WINDOW + 0.2);
    }
    expect(w.char.bestSpree).toBeUndefined();
  });
});

describe('soul orbs', () => {
  it('elites leave orbs that heal on touch and wait for a hero who is unhurt', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const m = nextToMonster(w);
    const elite = w.spawnMonster(w.area, 'ghoul', m.x, m.y, 'unique', { mods: ['extraLife'], name: 'Test the Vile' });
    w.damageMonster(elite, BIG);
    expect(w.area.orbs).toHaveLength(2);
    expect(w.area.orbs.map((o) => o.kind).sort()).toEqual(['life', 'mana']);
    const p = w.player;
    p.invuln = 99;
    const life = w.area.orbs.find((o) => o.kind === 'life')!;
    w.area.orbs = [life];
    w.area.monsters.forEach((x) => (x.alert = false));
    p.x = life.x;
    p.y = life.y;
    p.life = w.stats.maxLife;
    run(w, 1);
    expect(w.area.orbs).toHaveLength(1);
    p.life = 1;
    run(w, 2);
    expect(w.area.orbs).toHaveLength(0);
    expect(p.life).toBeGreaterThan(w.stats.maxLife * 0.2);
  });
});

describe('the Tithe Imp', () => {
  it('never hides in the Hollow Cave, where every creature must die', () => {
    for (let seed = 1; seed < 25; seed++) {
      const w = makeWorld('reaver', seed);
      w.enterArea('hollow_cave', 'start');
      expect(w.area.monsters.some((m) => m.thief)).toBe(false);
    }
  });

  it('sheds gold when struck and spills a hoard when killed', () => {
    const { w, imp } = worldWithThief();
    const gold = () => w.area.ground.filter((g) => g.gold).length;
    w.damageMonster(imp, elemDamage('phys', 1));
    expect(gold()).toBe(1);
    w.damageMonster(imp, BIG);
    expect(imp.dead).toBe(true);
    expect(gold()).toBeGreaterThanOrEqual(11);
    expect(announced(w, 'Jackpot!')).toBe(true);
    expect(w.char.tithes).toBe(1);
  });

  it('runs once it is seen, and is gone if it is not caught', () => {
    const { w, imp } = worldWithThief();
    const p = w.player;
    p.invuln = 1e6;
    for (const m of w.area.monsters) if (m !== imp) m.dead = true;
    p.x = imp.x + 1;
    p.y = imp.y;
    const start = { x: imp.x, y: imp.y };
    run(w, 6);
    expect(imp.thief!.started).toBe(true);
    expect(Math.hypot(imp.x - start.x, imp.y - start.y)).toBeGreaterThan(5);
    run(w, 12);
    expect(w.area.monsters.includes(imp)).toBe(false);
    expect(w.char.tithes).toBeUndefined();
  });
});

describe('shrines', () => {
  function shrine(w: World, kind: 'cursed' | 'storm' | 'haste' | 'fortune') {
    const m = nextToMonster(w);
    const o = { id: 99990, x: w.player.x, y: w.player.y, kind: 'shrine' as const, used: false, shrine: kind };
    w.area.objects.push(o);
    w.cmdInteract({ kind: 'object', id: o.id });
    run(w, 0.5);
    expect(o.used).toBe(true);
    return { o, m };
  }

  it('a cursed shrine calls three waves and then pays out', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 1e6;
    const before = w.area.ground.length;
    shrine(w, 'cursed');
    expect(announced(w, 'Ambush!')).toBe(true);
    for (let wave = 1; wave <= 3; wave++) {
      const pack = w.area.monsters.filter((m) => m.ambush !== undefined && !m.dead);
      expect(pack.length).toBeGreaterThan(2);
      expect(pack.every((m) => m.alert)).toBe(true);
      if (wave === 3) expect(pack.some((m) => m.rarity === 'unique')).toBe(true);
      for (const m of pack) w.damageMonster(m, BIG);
      w.events.length = wave === 3 ? w.events.length : 0;
      run(w, 2);
    }
    expect(announced(w, 'Curse Broken')).toBe(true);
    expect(w.area.monsters.some((m) => m.ambush !== undefined && !m.dead)).toBe(false);
    expect(w.area.ground.length).toBeGreaterThan(before);
  });

  it('a storm shrine strikes nearby monsters on its own', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 1e6;
    const { m } = shrine(w, 'storm');
    m.life = m.maxLife = 1e6;
    run(w, 3);
    expect(m.life).toBeLessThan(m.maxLife);
  });

  it('a fleet shrine quickens the hero', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 1e6;
    const speed = w.stats.moveSpeed;
    shrine(w, 'haste');
    expect(w.stats.moveSpeed).toBeGreaterThan(speed);
  });
});

describe('elite modifiers', () => {
  it('every modifier has a label', () => {
    for (const m of UNIQUE_MODS) expect(MOD_LABEL[m]).toBeTruthy();
  });

  it('a Lightning Enchanted elite throws sparks when struck', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const m = nextToMonster(w);
    const e = w.spawnMonster(w.area, 'ghoul', m.x, m.y, 'unique', { mods: ['lightEnch'] });
    w.damageMonster(e, elemDamage('phys', 1));
    expect(w.area.projectiles.filter((p) => p.owner === 'monster' && p.srcId === e.id)).toHaveLength(6);
    // Not again straight away.
    w.damageMonster(e, elemDamage('phys', 1));
    expect(w.area.projectiles.filter((p) => p.srcId === e.id)).toHaveLength(6);
  });

  it('a Bombardier marks the ground and a Teleporter closes the distance', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const p = w.player;
    p.invuln = 1e6;
    for (const m of w.area.monsters) m.dead = true;
    const spot = (d: number) => {
      for (let a = 0; a < 6.3; a += 0.4) {
        const x = p.x + Math.cos(a) * d;
        const y = p.y + Math.sin(a) * d;
        if (isWalkable(w.area.level, x, y) && lineOfSight(w.area.level, { x, y }, p)) return { x, y };
      }
      throw new Error('no floor');
    };
    const s1 = spot(5);
    const bomber = w.spawnMonster(w.area, 'ghoul', s1.x, s1.y, 'unique', { mods: ['mortar'] });
    bomber.alert = true;
    let marks = 0;
    run(w, 4, () => (marks = Math.max(marks, w.area.hazards.length)));
    expect(marks).toBeGreaterThanOrEqual(2);
    bomber.dead = true;
    const s2 = spot(6);
    const blinker = w.spawnMonster(w.area, 'ghoul', s2.x, s2.y, 'unique', { mods: ['teleport'] });
    blinker.alert = true;
    blinker.speed = 0.01;
    let near = false;
    run(w, 20, () => (near ||= Math.hypot(blinker.x - p.x, blinker.y - p.y) < 2.2));
    expect(near).toBe(true);
  });
});

describe('purging an area', () => {
  it('pays out once when the last monster falls, and marks the stragglers before that', () => {
    const w = makeWorld();
    w.enterArea('cinder_fields', 'start');
    const ms = w.area.monsters.filter((m) => !m.thief);
    expect(w.stragglers()).toEqual([]);
    for (const m of ms.slice(3)) w.damageMonster(m, BIG);
    expect(w.stragglers()).toHaveLength(3);
    expect(announced(w, 'Area Purged')).toBe(false);
    const xp = w.char.xp;
    for (const m of ms.slice(0, 3)) w.damageMonster(m, BIG);
    expect(announced(w, 'Area Purged')).toBe(true);
    expect(w.char.xp).toBeGreaterThan(xp);
    expect(w.area.purged).toBe(true);
    expect(w.char.purges).toBe(1);
    expect(w.stragglers()).toEqual([]);
  });

  it('every area can be generated with the new shrines and monsters', () => {
    const w = makeWorld('arcanist', 77);
    for (const a of AREAS) {
      w.enterArea(a.id, 'start');
      run(w, 0.5);
    }
  });
});
