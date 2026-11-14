import { describe, expect, it } from 'vitest';
import { hireCost, HIRE_KINDS, HIRELINGS, reviveCost } from '../src/game/hireling';
import { MONSTERS } from '../src/game/monsters';
import { elemDamage, World, type Monster } from '../src/game/world';
import { makeWorld, run } from './helpers';

function rich(classId: Parameters<typeof makeWorld>[0] = 'reaver', level = 20) {
  const w = makeWorld(classId);
  w.char.level = level;
  w.char.gold = 100000;
  w.refreshStats();
  w.player.life = w.stats.maxLife;
  return w;
}

/** A quiet spot in the wilds with one monster standing `dist` tiles from the hero. */
function duel(w: World, id: string, dist: number): Monster {
  w.enterArea('cinder_fields', 'start');
  w.area.monsters.length = 0;
  w.area.purged = true;
  w.player.invuln = 999;
  // Stand somewhere with a clear line `dist` tiles long, so walls play no part.
  const l = w.area.level;
  const open = (x: number, y: number) => l.tiles[Math.floor(y) * l.w + Math.floor(x)] === 1;
  let at = { x: w.player.x, y: w.player.y };
  find: for (let y = 4; y < l.h - 4; y++) for (let x = 4; x < l.w - dist - 4; x++) {
    let ok = true;
    for (let dx = -2; dx <= dist + 2 && ok; dx++) for (let dy = -2; dy <= 2 && ok; dy++) ok = open(x + dx, y + dy);
    if (ok) { at = { x: x + 0.5, y: y + 0.5 }; break find; }
  }
  w.player.x = at.x;
  w.player.y = at.y;
  // Beside the hero, not behind: nothing walks through the hero to reach a fight.
  for (const mi of w.minions) (mi.x = at.x), (mi.y = at.y + 1);
  const m = w.spawnMonster(w.area, id, w.player.x + dist, w.player.y, 'normal', { level: w.char.level });
  m.alert = true;
  return m;
}

describe('the captain', () => {
  it('stands in every town on walkable ground and opens the hiring panel', () => {
    const w = makeWorld();
    w.setQuest('forge', 'rewarded');
    w.setQuest('hollow_sun', 'rewarded');
    const names = new Set<string>();
    for (const town of ['town', 'tel_maresh', 'emberwatch_ruins']) {
      w.enterArea(town, 'start');
      const cap = w.area.npcs.find((n) => n.kind === 'captain')!;
      expect(cap, town).toBeTruthy();
      names.add(`${cap.name}/${cap.title}`);
      const l = w.area.level;
      expect(l.tiles[Math.floor(cap.y) * l.w + Math.floor(cap.x)]).toBe(1);
      for (const o of w.area.npcs) if (o !== cap) expect(Math.hypot(o.x - cap.x, o.y - cap.y)).toBeGreaterThan(2);
      w.events.length = 0;
      w.cmdInteract({ kind: 'npc', id: cap.id });
      run(w, 8);
      expect(w.events.some((e) => e.type === 'open' && e.panel === 'captain'), town).toBe(true);
    }
    expect(names.size).toBe(3);
  });

  it('offers three kinds, each with a body of its own', () => {
    expect(HIRE_KINDS.length).toBe(3);
    for (const k of HIRE_KINDS) {
      const d = MONSTERS[HIRELINGS[k].def];
      expect(d.xpMul).toBe(0);
      expect(d.speed).toBeGreaterThan(3.5);
      expect(HIRELINGS[k].names.length).toBeGreaterThan(4);
    }
    expect(hireCost(40)).toBeGreaterThan(hireCost(10));
    expect(reviveCost(20)).toBeLessThan(hireCost(20));
  });
});

describe('hiring', () => {
  it('costs gold and puts a named companion at the hero’s side, at the hero’s level', () => {
    const w = rich();
    expect(w.hirelingMinion()).toBeUndefined();
    expect(w.hire('guard')).toBeNull();
    expect(w.char.gold).toBe(100000 - hireCost(20));
    const mi = w.hirelingMinion()!;
    expect(mi.name).toBe(w.char.hireling!.name);
    expect(HIRELINGS.guard.names).toContain(mi.name);
    expect(mi.level).toBe(20);
    expect(mi.life).toBe(mi.maxLife);
    expect(mi.maxLife).toBeGreaterThan(w.stats.maxLife);
    expect(Math.hypot(mi.x - w.player.x, mi.y - w.player.y)).toBeLessThan(3);
    expect(w.hire('guard')).toBe('Already at your side');
  });

  it('is refused without the gold', () => {
    const w = rich();
    w.char.gold = hireCost(20) - 1;
    expect(w.hire('archer')).toBe('Not enough gold');
    expect(w.char.hireling).toBeUndefined();
    expect(w.minions).toEqual([]);
  });

  it('hiring another replaces the first, and dismissing leaves no one', () => {
    const w = rich();
    w.hire('guard');
    w.hire('mage');
    expect(w.minions.filter((m) => m.ally === 'hireling').length).toBe(1);
    expect(w.hirelingMinion()!.def.id).toBe('hire_mage');
    w.dismissHireling();
    expect(w.char.hireling).toBeUndefined();
    expect(w.minions).toEqual([]);
  });

  it('the companion follows between areas, grows with the hero, and is there when the game is loaded again', () => {
    const w = rich();
    w.hire('archer');
    const before = w.hirelingMinion()!.maxLife;
    w.enterArea('cinder_fields', 'start');
    expect(w.hirelingMinion()).toBeTruthy();
    w.char.xp = 1e12;
    const m = duel(w, 'imp', 1);
    w.damageMonster(m, elemDamage('phys', 1e6));
    expect(w.char.level).toBeGreaterThan(20);
    expect(w.hirelingMinion()!.level).toBe(w.char.level);
    expect(w.hirelingMinion()!.maxLife).toBeGreaterThan(before);
    const again = new World(JSON.parse(JSON.stringify(w.char)), 5);
    expect(again.hirelingMinion()!.name).toBe(w.char.hireling!.name);
    expect(again.hirelingMinion()!.def.id).toBe('hire_archer');
  });

  it('a fallen companion stays down until the captain is paid', () => {
    const w = rich();
    w.hire('guard');
    w.enterArea('cinder_fields', 'start');
    const mi = w.hirelingMinion()!;
    w.damageMinion(mi, elemDamage('phys', 1e9), { level: 99 });
    run(w, 0.1);
    expect(w.char.hireling!.dead).toBe(true);
    expect(w.hirelingMinion()).toBeUndefined();
    w.enterArea('town', 'start');
    expect(w.hirelingMinion()).toBeUndefined();
    expect(new World(JSON.parse(JSON.stringify(w.char)), 5).hirelingMinion()).toBeUndefined();
    const gold = w.char.gold;
    expect(w.reviveHireling()).toBeNull();
    expect(w.char.gold).toBe(gold - reviveCost(20));
    expect(w.hirelingMinion()!.life).toBe(w.hirelingMinion()!.maxLife);
    expect(w.reviveHireling()).toBe('No one to bring back');
  });

  it('the hero’s own death does not cost them their companion', () => {
    const w = rich();
    w.hire('guard');
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 0;
    w.damagePlayer(elemDamage('fire', 1e9), { level: 99 });
    expect(w.player.dead).toBe(true);
    w.respawn();
    expect(w.char.hireling!.dead).toBeFalsy();
    expect(w.hirelingMinion()).toBeTruthy();
  });

  it('a respec keeps the companion and dismisses the rest', () => {
    const w = rich('necromancer');
    w.hire('guard');
    w.char.statPoints = 1;
    w.char.alloc.vit = 1;
    w.setQuest('rekindle', 'done');
    (w as unknown as { raiseMinion(k: string, x: number, y: number, pr: object): unknown }).raiseMinion('skeleton', w.player.x, w.player.y, {});
    expect(w.minions.length).toBe(2);
    expect(w.respec()).toBe(true);
    expect(w.minions.map((m) => m.ally)).toEqual(['hireling']);
  });

  it('wounds mend between fights and in town', () => {
    const w = rich();
    w.hire('guard');
    w.enterArea('cinder_fields', 'start');
    w.area.monsters.length = 0;
    const mi = w.hirelingMinion()!;
    mi.life = mi.maxLife * 0.5;
    run(w, 5);
    expect(mi.life).toBeGreaterThan(mi.maxLife * 0.6);
    mi.life = 1;
    w.enterArea('town', 'start');
    expect(mi.life).toBe(mi.maxLife);
  });
});

describe('hirelings in a fight', () => {
  it('the shieldbearer closes and kills', () => {
    const w = rich();
    w.hire('guard');
    const m = duel(w, 'ghoul', 3);
    run(w, 30);
    expect(m.dead).toBe(true);
  });

  it('the bowman shoots from where he stands', () => {
    const w = rich();
    w.hire('archer');
    const m = duel(w, 'ghoul', 6);
    m.speed = 0;
    const mi = w.hirelingMinion()!;
    let shots = 0;
    run(w, 6, () => (shots += w.area.projectiles.filter((p) => p.servant === mi).length ? 1 : 0));
    expect(shots).toBeGreaterThan(0);
    expect(m.life).toBeLessThan(m.maxLife);
    expect(Math.hypot(mi.x - m.x, mi.y - m.y)).toBeGreaterThan(3);
  });

  it('the Ember-Keeper sets things alight and is warm to stand beside in the cold', () => {
    const w = rich('reaver', 40);
    w.hire('mage');
    const m = duel(w, 'ghoul', 5);
    m.speed = 0;
    let burned = false;
    run(w, 6, () => (burned ||= (m.burnT ?? 0) > 0));
    expect(burned).toBe(true);
    w.enterArea('rimefall_pass', 'start');
    w.area.monsters.length = 0;
    const mi = w.hirelingMinion()!;
    expect(w.warmthAt(mi.x, mi.y)).toBe(0.5);
    expect(w.warmthAt(mi.x + 8, mi.y)).toBe(0);
  });

  it('monsters turn on a hireling as they do on any servant', () => {
    const w = rich();
    w.hire('guard');
    const m = duel(w, 'ghoul', 2);
    w.player.x -= 6;
    const mi = w.hirelingMinion()!;
    mi.x = m.x - 1;
    mi.y = m.y;
    const life = mi.life;
    run(w, 6);
    expect(mi.life < life || m.dead).toBe(true);
  });
});
