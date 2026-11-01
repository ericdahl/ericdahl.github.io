import { describe, expect, it } from 'vitest';
import { BUILDINGS, UNITS } from '../src/game/defs';
import { ENEMY, HUMAN } from '../src/game/world';
import { emptyWorld, run, standardWorld } from './helpers';

describe('economy', () => {
  it('starting harvesters mine crystal automatically', () => {
    const w = standardWorld();
    const start = w.players[HUMAN].crystal;
    run(w, 60);
    // 5 workers for a minute should bring in well over 150 crystal.
    expect(w.players[HUMAN].crystal - start).toBeGreaterThan(150);
    expect(w.players[ENEMY].crystal - start).toBeGreaterThan(150);
  });

  it('harvesters spread across crystal patches instead of queueing on one', () => {
    const w = standardWorld();
    run(w, 30);
    const targets = new Set(w.unitsOf(HUMAN).map((u) => (u.order.type === 'gather' ? u.order.target : 0)));
    expect(targets.size).toBeGreaterThanOrEqual(3);
  });

  it('collects flux from an extractor', () => {
    const w = standardWorld();
    w.players[HUMAN].crystal = 1000;
    const vent = w.list.find((e) => e.kind === 'vent' && Math.hypot(e.x - 12, e.y - 11) < 12)!;
    const h = w.unitsOf(HUMAN)[0];
    w.issue(HUMAN, { type: 'build', ids: [h.id], kind: 'extractor', tx: vent.tx, ty: vent.ty });
    run(w, 30);
    const ex = w.buildingsOf(HUMAN).find((b) => b.kind === 'extractor')!;
    expect(ex).toBeDefined();
    expect(ex.built).toBe(true);
    const workers = w.unitsOf(HUMAN).slice(0, 3).map((u) => u.id);
    w.issue(HUMAN, { type: 'gather', ids: workers, target: vent.id });
    run(w, 30);
    expect(w.players[HUMAN].flux).toBeGreaterThan(20);
  });
});

describe('production', () => {
  it('trains a unit, charging cost and supply', () => {
    const w = standardWorld();
    w.players[HUMAN].crystal = 200;
    const core = w.buildingsOf(HUMAN)[0];
    w.issue(HUMAN, { type: 'train', id: core.id, kind: 'harvester' });
    expect(w.players[HUMAN].crystal).toBe(150);
    expect(w.supplyUsed(HUMAN)).toBe(6);
    const before = w.unitsOf(HUMAN).length;
    run(w, UNITS.harvester.buildTime + 0.2);
    expect(w.unitsOf(HUMAN).length).toBe(before + 1);
  });

  it('refuses to train beyond supply cap', () => {
    const w = standardWorld();
    w.players[HUMAN].crystal = 10000;
    const core = w.buildingsOf(HUMAN)[0];
    for (let i = 0; i < 5; i++) w.issue(HUMAN, { type: 'train', id: core.id, kind: 'harvester' });
    expect(core.queue.length).toBe(5);
    run(w, UNITS.harvester.buildTime * 5 + 1);
    expect(w.supplyUsed(HUMAN)).toBe(10);
    w.events = [];
    w.issue(HUMAN, { type: 'train', id: core.id, kind: 'harvester' });
    expect(core.queue.length).toBe(0);
    expect(w.events.some((e) => e.type === 'error' && /supply/.test(e.msg))).toBe(true);
  });

  it('refunds cancelled training', () => {
    const w = standardWorld();
    w.players[HUMAN].crystal = 100;
    const core = w.buildingsOf(HUMAN)[0];
    w.issue(HUMAN, { type: 'train', id: core.id, kind: 'harvester' });
    w.issue(HUMAN, { type: 'cancelTrain', id: core.id });
    expect(w.players[HUMAN].crystal).toBe(100);
  });

  it('enforces tech requirements', () => {
    const w = emptyWorld();
    w.players[HUMAN].crystal = 5000;
    w.players[HUMAN].flux = 5000;
    w.placeBuilding('core', HUMAN, 2, 2, true);
    expect(w.placementError(HUMAN, 'works', 20, 20)).toMatch(/Garrison/);
    w.placeBuilding('garrison', HUMAN, 10, 2, true);
    expect(w.placementError(HUMAN, 'works', 20, 20)).toBeNull();
  });
});

describe('construction', () => {
  it('a harvester walks to the site and the building finishes', () => {
    const w = emptyWorld();
    w.players[HUMAN].crystal = 500;
    w.placeBuilding('core', HUMAN, 2, 2, true);
    const h = w.spawnUnit('harvester', HUMAN, 4, 8);
    w.issue(HUMAN, { type: 'build', ids: [h.id], kind: 'habitat', tx: 15, ty: 15 });
    run(w, 8);
    const hab = w.buildingsOf(HUMAN).find((b) => b.kind === 'habitat')!;
    expect(hab).toBeDefined();
    expect(w.players[HUMAN].crystal).toBe(400);
    expect(w.supplyCap(HUMAN)).toBe(10);
    run(w, BUILDINGS.habitat.buildTime + 0.5);
    expect(hab.built).toBe(true);
    expect(w.supplyCap(HUMAN)).toBe(18);
    expect(w.blocked(15, 15)).toBe(true);
  });

  it('rejects overlapping placement', () => {
    const w = emptyWorld();
    w.placeBuilding('core', HUMAN, 2, 2, true);
    expect(w.placementError(HUMAN, 'habitat', 3, 3)).toBe('Location blocked');
    expect(w.placementError(HUMAN, 'habitat', -1, 3)).toBe('Invalid location');
    expect(w.placementError(HUMAN, 'extractor', 20, 20)).toMatch(/vent/);
  });

  it('cancelling construction refunds 75%', () => {
    const w = emptyWorld();
    w.players[HUMAN].crystal = 0;
    const b = w.placeBuilding('habitat', HUMAN, 10, 10, false);
    w.issue(HUMAN, { type: 'cancelBuilding', id: b.id });
    expect(w.players[HUMAN].crystal).toBe(75);
    expect(w.blocked(10, 10)).toBe(false);
  });
});

describe('movement', () => {
  it('moves a group to a point around obstacles', () => {
    const w = emptyWorld();
    w.placeBuilding('core', HUMAN, 2, 2, true);
    for (let y = 5; y < 30; y++) w.terrain[y * w.w + 20] = 1;
    const ids = [0, 1, 2, 3, 4].map((i) => w.spawnUnit('trooper', HUMAN, 10 + i * 0.8, 20).id);
    w.issue(HUMAN, { type: 'move', ids, x: 30, y: 20 });
    run(w, 25);
    for (const id of ids) {
      const u = w.get(id)!;
      expect(u.order.type).toBe('idle');
      expect(Math.hypot(u.x - 30, u.y - 20)).toBeLessThan(3.5);
    }
  });

  it('air units fly over rock', () => {
    const w = emptyWorld();
    w.placeBuilding('core', HUMAN, 2, 2, true);
    for (let y = 0; y < 40; y++) w.terrain[y * w.w + 20] = 1;
    const u = w.spawnUnit('wasp', HUMAN, 10, 20);
    w.issue(HUMAN, { type: 'move', ids: [u.id], x: 30, y: 20 });
    run(w, 4);
    expect(u.x).toBeGreaterThan(25);
  });

  it('units never end up inside rock or buildings', () => {
    const w = standardWorld(3);
    const ids = w.unitsOf(HUMAN).map((u) => u.id);
    w.issue(HUMAN, { type: 'move', ids, x: w.w - 12, y: w.h - 20 });
    run(w, 30, () => {
      for (const u of w.unitsOf(HUMAN)) expect(w.blocked(Math.floor(u.x), Math.floor(u.y))).toBe(false);
    });
  });
});

describe('combat', () => {
  it('idle units auto-acquire and kill enemies in range', () => {
    const w = emptyWorld();
    w.placeBuilding('core', HUMAN, 2, 2, true);
    w.placeBuilding('core', ENEMY, 30, 30, true);
    const a = [w.spawnUnit('trooper', HUMAN, 10, 10), w.spawnUnit('trooper', HUMAN, 11, 10)];
    const e = w.spawnUnit('trooper', ENEMY, 14, 10);
    w.updateFog();
    run(w, 10);
    expect(e.dead).toBe(true);
    expect(a.some((u) => !u.dead)).toBe(true);
  });

  it('ground-only weapons ignore air units', () => {
    const w = emptyWorld();
    w.placeBuilding('core', HUMAN, 2, 2, true);
    w.placeBuilding('core', ENEMY, 30, 30, true);
    const r = w.spawnUnit('raider', HUMAN, 10, 10);
    const wasp = w.spawnUnit('wasp', ENEMY, 10.5, 10);
    expect(w.canHit(r, wasp)).toBe(false);
    run(w, 2);
    expect(wasp.hp).toBe(wasp.maxHp);
  });

  it('splash damages clustered enemies', () => {
    const w = emptyWorld();
    w.placeBuilding('core', HUMAN, 2, 2, true);
    w.placeBuilding('core', ENEMY, 30, 30, true);
    const c = w.spawnUnit('crawler', HUMAN, 10, 10);
    const t1 = w.spawnUnit('trooper', ENEMY, 17, 10);
    const t2 = w.spawnUnit('trooper', ENEMY, 17, 10.7);
    w.issue(HUMAN, { type: 'attack', ids: [c.id], target: t1.id });
    w.issue(ENEMY, { type: 'hold', ids: [t1.id, t2.id] });
    run(w, 0.2);
    expect(t1.hp).toBeLessThan(t1.maxHp);
    expect(t2.hp).toBeLessThan(t2.maxHp);
    expect(t2.hp).toBeGreaterThan(t1.hp);
  });

  it('turrets defend', () => {
    const w = emptyWorld();
    w.placeBuilding('core', HUMAN, 2, 2, true);
    w.placeBuilding('core', ENEMY, 30, 30, true);
    w.placeBuilding('turret', HUMAN, 10, 10, true);
    const e = w.spawnUnit('harvester', ENEMY, 15, 11);
    w.issue(ENEMY, { type: 'hold', ids: [e.id] });
    run(w, 6);
    expect(e.dead).toBe(true);
  });

  it('attack-move engages enemies on the way', () => {
    const w = emptyWorld();
    w.placeBuilding('core', HUMAN, 2, 2, true);
    w.placeBuilding('core', ENEMY, 34, 34, true);
    const ids = [0, 1, 2, 3].map((i) => w.spawnUnit('trooper', HUMAN, 8 + i * 0.8, 8).id);
    const e = w.spawnUnit('raider', ENEMY, 20, 20);
    w.issue(ENEMY, { type: 'hold', ids: [e.id] });
    w.issue(HUMAN, { type: 'attackMove', ids, x: 30, y: 30 });
    run(w, 20);
    expect(e.dead).toBe(true);
  });
});

describe('fog and victory', () => {
  it('reveals around own entities only', () => {
    const w = standardWorld();
    const core = w.buildingsOf(HUMAN)[0];
    const enemyCore = w.buildingsOf(ENEMY)[0];
    expect(w.isVisibleTo(core, HUMAN)).toBe(true);
    expect(w.isVisibleTo(enemyCore, HUMAN)).toBe(false);
    expect(w.players[HUMAN].vis[Math.floor(core.y) * w.w + Math.floor(core.x)]).toBe(2);
  });

  it('cannot target what you cannot see', () => {
    const w = standardWorld();
    const enemyCore = w.buildingsOf(ENEMY)[0];
    const u = w.unitsOf(HUMAN)[0];
    w.issue(HUMAN, { type: 'attack', ids: [u.id], target: enemyCore.id });
    expect(u.order.type).toBe('gather');
  });

  it('a player with no buildings loses', () => {
    const w = standardWorld();
    for (const b of w.buildingsOf(ENEMY)) w.kill(b);
    run(w, 1);
    expect(w.winner).toBe(HUMAN);
    expect(w.events.some((e) => e.type === 'gameOver')).toBe(true);
  });
});
