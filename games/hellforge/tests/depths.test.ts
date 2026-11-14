import { describe, expect, it } from 'vitest';
import { AREA_BY_ID, DIFFICULTY_LEVELS } from '../src/game/areas';
import {
  afflictionCount, AFFLICTIONS, DEPTH_BASE_LEVEL, DEPTH_BOSSES, depthCinders, depthDef, depthFortune, depthId, depthOf, depthStarts,
  DEPTHS_TOWN, isBossDepth, isDepthId,
} from '../src/game/depths';
import { floodDistances, idx } from '../src/game/map';
import { MONSTERS } from '../src/game/monsters';
import { Rng } from '../src/game/rng';
import { elemDamage, type World } from '../src/game/world';
import { makeWorld, run } from './helpers';

/** A hero strong enough to stand in the Underforge, with it open. */
function deepWorld(seed = 1234) {
  const w = makeWorld('reaver', seed);
  w.char.level = 45;
  w.setQuest('rekindle', 'rewarded');
  w.refreshStats();
  w.player.life = w.stats.maxLife;
  w.events.length = 0;
  return w;
}

function slay(w: World, m = w.wardenAlive()!) {
  w.player.invuln = 999;
  m.shield = 0;
  w.damageMonster(m, elemDamage('phys', m.maxLife * 50));
  return m;
}

const downStairs = (w: World) => w.area.level.exits.findIndex((e) => e.kind === 'down');

describe('underforge floors', () => {
  it('ids round-trip and are told apart from the fixed areas', () => {
    expect(depthOf(depthId(17))).toBe(17);
    expect(isDepthId(depthId(1))).toBe(true);
    expect(isDepthId('hellforge_heart')).toBe(false);
    expect(depthOf('town')).toBe(0);
  });

  it('rolls the same floor from the same seed, and different floors from different ones', () => {
    const a = depthDef(7, new Rng(5));
    expect(depthDef(7, new Rng(5))).toEqual(a);
    const looks = new Set(Array.from({ length: 30 }, (_, i) => depthDef(7, new Rng(i + 1)).spec.theme));
    expect(looks.size).toBeGreaterThan(4);
  });

  it('gets one level harder a floor, thicker with packs, and richer', () => {
    for (let d = 1; d < 60; d++) {
      const def = depthDef(d, new Rng(d));
      expect(def.alvl).toBe(DEPTH_BASE_LEVEL + d);
      expect(def.depth).toBe(d);
      expect(def.act).toBe(3);
      for (const id of def.monsters) expect(MONSTERS[id], id).toBeTruthy();
      expect(def.spec.links[0].to).toBe(DEPTHS_TOWN);
      expect(def.spec.links[1].to).toBe(depthId(d + 1));
      expect(depthFortune(d + 1)).toBeGreaterThanOrEqual(depthFortune(d));
      expect(depthDef(d + 1, new Rng(d)).packs).toBeGreaterThanOrEqual(def.packs);
    }
    expect(depthDef(1, new Rng(1)).alvl).toBeGreaterThan(AREA_BY_ID.hellforge_heart.alvl);
    expect(depthFortune(1000)).toBe(300);
  });

  it('carries no afflictions at first, then up to three', () => {
    expect([1, 2, 3, 9, 10, 20, 500].map(afflictionCount)).toEqual([0, 0, 1, 1, 2, 3, 3]);
    for (const d of [3, 12, 40]) {
      const af = depthDef(d, new Rng(d)).afflictions!;
      expect(af.length).toBe(afflictionCount(d));
      expect(new Set(af).size).toBe(af.length);
      for (const m of af) expect(AFFLICTIONS).toContain(m);
    }
  });

  it('gives every fifth floor to a boss, in turn', () => {
    expect([4, 5, 6, 10].map(isBossDepth)).toEqual([false, true, false, true]);
    expect(depthDef(4, new Rng(1)).superUnique).toBeUndefined();
    const bosses = DEPTH_BOSSES.map((_, i) => depthDef((i + 1) * 5, new Rng(i)).superUnique);
    expect(bosses).toEqual(DEPTH_BOSSES);
    expect(depthDef((DEPTH_BOSSES.length + 1) * 5, new Rng(1)).superUnique).toBe(DEPTH_BOSSES[0]);
    for (const id of DEPTH_BOSSES) expect(MONSTERS[id].ai).toBe('boss');
    expect(depthCinders(5)).toBeGreaterThan(depthCinders(6));
  });

  it('opens a new starting floor below each boss floor cleared', () => {
    expect(depthStarts(0)).toEqual([1]);
    expect(depthStarts(4)).toEqual([1]);
    expect(depthStarts(5)).toEqual([1, 6]);
    expect(depthStarts(13)).toEqual([1, 6, 11]);
  });
});

describe('descending', () => {
  it('is closed until the ember is home on this difficulty', () => {
    const w = makeWorld();
    expect(w.depthsOpen).toBe(false);
    expect(w.depthStartList()).toEqual([]);
    expect(w.descend(1)).toBe(false);
    expect(w.area.def.id).toBe('town');
    w.setQuest('rekindle', 'done');
    expect(w.depthStartList()).toEqual([1]);
    // Nightmare has its own road to walk first.
    w.char.difficulty = 1;
    expect(w.depthsOpen).toBe(false);
  });

  it('puts the hero on a walkable floor with a warden by the stairs and a way down that can be reached', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const w = deepWorld(seed);
      expect(w.descend(1)).toBe(true);
      expect(w.depth).toBe(1);
      expect(w.act).toBe(3);
      expect(w.homeTown).toBe(DEPTHS_TOWN);
      const l = w.area.level;
      const dist = floodDistances(l, Math.floor(w.player.x), Math.floor(w.player.y));
      const stairs = l.exits[downStairs(w)];
      expect(dist[idx(l, stairs.x, stairs.y)], `seed ${seed}`).toBeGreaterThan(0);
      const warden = w.wardenAlive()!;
      expect(warden.rarity).toBe('unique');
      expect(dist[idx(l, Math.floor(warden.x), Math.floor(warden.y))], `seed ${seed}`).toBeGreaterThan(0);
      expect(Math.hypot(warden.x - stairs.x, warden.y - stairs.y)).toBeLessThan(14);
      expect(w.area.monsters.length).toBeGreaterThan(20);
      expect(w.area.monsters.every((m) => m.level >= DEPTH_BASE_LEVEL + 1)).toBe(true);
    }
  });

  it('seals the stairs until the warden is dead', () => {
    const w = deepWorld();
    w.descend(1);
    const stairs = downStairs(w);
    const e = w.area.level.exits[stairs];
    w.player.x = e.x + 0.5;
    w.player.y = e.y + 0.5;
    w.player.invuln = 999;
    expect(w.interactLabel({ kind: 'exit', index: stairs })).toBe('Sealed Stairs');
    w.cmdInteract({ kind: 'exit', index: stairs });
    run(w, 0.5);
    expect(w.depth).toBe(1);
    expect(w.events.some((ev) => ev.type === 'msg' && ev.text.includes('sealed'))).toBe(true);

    const cinders = w.char.forge.cinders;
    slay(w);
    expect(w.char.forge.cinders).toBe(cinders + depthCinders(1));
    expect(w.char.deepest).toEqual([1]);
    expect(w.interactLabel({ kind: 'exit', index: stairs })).toBe('Descend to Depth 2');
    w.player.x = e.x + 0.5;
    w.player.y = e.y + 0.5;
    w.cmdInteract({ kind: 'exit', index: stairs });
    run(w, 0.5);
    expect(w.depth).toBe(2);
    expect(w.wardenAlive()).toBeTruthy();
    // The floor above is let go.
    expect(w.areas.has(depthId(1))).toBe(false);
  });

  it('keeps a record per difficulty and only moves it forward', () => {
    const w = deepWorld();
    w.descend(1);
    slay(w);
    w.enterArea(depthId(2), 'exit', depthId(1));
    slay(w);
    expect(w.deepest).toBe(2);
    w.descend(1);
    slay(w);
    expect(w.deepest).toBe(2);
    w.char.difficulty = 1;
    expect(w.deepest).toBe(0);
  });

  it('a new descent rolls new floors, and a fixed seed rolls the same ones', () => {
    const a = deepWorld(42);
    const b = deepWorld(42);
    a.descend(1);
    b.descend(1);
    expect(b.area.def).toEqual(a.area.def);
    expect(Array.from(b.area.level.tiles)).toEqual(Array.from(a.area.level.tiles));
    const first = a.area;
    a.descend(1);
    expect(a.area).not.toBe(first);
    const again = Array.from({ length: 6 }, () => (a.descend(1), a.area.def.spec.theme + a.area.level.w));
    expect(new Set([first.def.spec.theme + first.level.w, ...again]).size).toBeGreaterThan(1);
  });

  it('boss floors are held by a boss, and clearing one opens the floor below as a start', () => {
    const w = deepWorld();
    w.char.deepest = [4];
    w.descend(1);
    w.enterArea(depthId(5), 'exit', depthId(4));
    const boss = w.wardenAlive()!;
    expect(boss.rarity).toBe('boss');
    expect(boss.superId).toBe(DEPTH_BOSSES[0]);
    expect(boss.name).toContain('Risen');
    expect(boss.level).toBe(DEPTH_BASE_LEVEL + 5 + 2);
    slay(w, boss);
    expect(w.depthStartList()).toEqual([1, 6]);
    expect(w.descend(6)).toBe(true);
    expect(w.depth).toBe(6);
    expect(w.descend(11)).toBe(false);
  });

  it('puts the floor’s afflictions on everything that lives there', () => {
    const w = deepWorld();
    w.char.deepest = [10];
    w.descend(11);
    const af = w.area.def.afflictions!;
    expect(af.length).toBe(2);
    for (const m of w.area.monsters) if (!m.def.thief) for (const a of af) expect(m.mods, m.name).toContain(a);
    // Servants are not of the floor.
    const nec = makeWorld('necromancer');
    nec.setQuest('rekindle', 'done');
    nec.char.deepest = [10];
    nec.descend(11);
    const mi = (nec as unknown as { raiseMinion(k: string, x: number, y: number, pr: object): { mods: string[] } }).raiseMinion('skeleton', nec.player.x, nec.player.y, {});
    expect(mi.mods).toEqual([]);
  });

  it('scales with difficulty', () => {
    const w = deepWorld();
    w.char.difficulty = 2;
    w.setQuest('rekindle', 'done');
    w.descend(1);
    expect(w.wardenAlive()!.level).toBe(DEPTH_BASE_LEVEL + 1 + DIFFICULTY_LEVELS[2] + 1);
  });

  it('a town portal leads back to the floor, and climbing out ends in Emberwatch Ruins', () => {
    const w = deepWorld();
    w.descend(1);
    w.player.invuln = 999;
    expect(w.castTownPortal()).toBe(true);
    run(w, 2);
    expect(w.area.def.id).toBe(DEPTHS_TOWN);
    expect(w.interactLabel({ kind: 'portal' })).toBe('Town Portal (The Underforge: Depth 1)');
    w.cmdInteract({ kind: 'portal' });
    run(w, 3);
    expect(w.depth).toBe(1);
    const up = w.area.level.exits.findIndex((e) => e.kind === 'up');
    const e = w.area.level.exits[up];
    w.player.x = e.x + 0.5;
    w.player.y = e.y + 0.5;
    w.cmdInteract({ kind: 'exit', index: up });
    run(w, 0.5);
    expect(w.area.def.id).toBe(DEPTHS_TOWN);
  });

  it('a softcore death wakes the hero in Emberwatch Ruins', () => {
    const w = deepWorld();
    w.descend(1);
    w.player.invuln = 0;
    w.damagePlayer(elemDamage('fire', 1e9), { level: 99 });
    expect(w.player.dead).toBe(true);
    w.respawn();
    expect(w.area.def.id).toBe(DEPTHS_TOWN);
  });

  it('every kind of floor can be stood on and fought in without the world tripping over it', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const w = deepWorld(seed);
      w.char.deepest = [10];
      w.descend(seed % 2 ? 6 : 11);
      seen.add(w.area.def.spec.theme);
      const m = w.area.monsters.find((x) => !x.dead && !x.warden)!;
      w.player.x = m.x;
      w.player.y = m.y;
      w.player.invuln = 999;
      run(w, 12, () => {
        const t = w.autoTarget(8);
        if (t && !w.player.action) w.cmdSkill('attack', t.x, t.y, t.id);
      });
      expect(w.area.monsters.some((x) => x.alert), `seed ${seed}`).toBe(true);
      expect(Number.isFinite(w.player.x + w.player.y + w.player.life)).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});
