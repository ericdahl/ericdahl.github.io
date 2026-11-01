import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, train, canTrain, supplyUsed, select, selectedUnits, command, spawn } from '../src/game.js';

const advance = (game, seconds) => { for (let i=0; i<seconds*20; i++) tick(game,.05); };

test('training spends flux, reserves supply, and produces a unit', () => {
  const game=createGame();const startingFlux=game.flux;const startingCount=game.units.length;const supply=supplyUsed(game);
  assert.equal(train(game,'soldier'),true);
  assert.equal(game.flux,startingFlux-75);
  assert.equal(supplyUsed(game),supply+2);
  advance(game,7.1);
  assert.equal(game.queue.length,0);
  assert.equal(game.units.length,startingCount+1);
});

test('workers gather flux from crystals and return it to their forge', () => {
  const game=createGame();const worker=game.units.find(u=>u.side==='player'&&u.type==='worker');const crystal=game.crystals[0];
  select(game,[worker.id]);assert.equal(command(game,crystal.x,crystal.y,crystal),true);
  advance(game,11);
  assert.ok(game.flux>240,`expected flux to increase, got ${game.flux}`);
  assert.ok(crystal.amount<440);
});

test('selection excludes hostile units and attacks can win', () => {
  const game=createGame();const enemy=game.units.find(u=>u.side==='enemy');const soldier=spawn(game,'soldier','player',enemy.x-100,enemy.y);
  select(game,[enemy.id,soldier.id]);assert.deepEqual(game.selected,[soldier.id]);
  const forge=game.bases.find(b=>b.side==='enemy');forge.hp=13;
  command(game,forge.x,forge.y,forge);
  advance(game,1);
  assert.equal(game.status,'victory');
});

test('training respects flux and supply limits', () => {
  const game=createGame();game.flux=0;assert.equal(canTrain(game,'worker'),false);
  game.flux=500;game.supplyCap=supplyUsed(game);assert.equal(canTrain(game,'soldier'),false);
});

test('first hostile reinforcement allows time to establish an economy', () => {
  const game=createGame();
  const startingEnemies=game.units.filter(u=>u.side==='enemy').length;
  advance(game,23);
  assert.equal(game.units.filter(u=>u.side==='enemy').length,startingEnemies);
  advance(game,1.1);
  assert.equal(game.units.filter(u=>u.side==='enemy').length,startingEnemies+1);
});
