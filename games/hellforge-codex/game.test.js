import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, CLASSES, createGame, generateMap, isFloor, stats, xpNeeded, makeItem, equipItem, attack, castSkill, drinkPotion, tick, nextFloor, serializeGame, restoreGame } from './game.js';

test('generated ruins are deterministic and every floor tile is reachable', () => {
  for (const seed of [1, 22, 98412, 1700000000]) {
    const a = generateMap(seed), b = generateMap(seed);
    assert.deepEqual(a.map, b.map);
    const start = { x: 8, y: 40 }, seen = new Set([start.y * SIZE + start.x]), queue = [start];
    assert.equal(a.map[start.y][start.x], 1);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x = p.x + dx, y = p.y + dy, key = y * SIZE + x;
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a.map[y][x] !== 1 || seen.has(key)) continue;
        seen.add(key); queue.push({ x, y });
      }
    }
    const total = a.map.flat().filter(v => v === 1).length;
    assert.equal(seen.size, total, `seed ${seed} disconnected`);
    assert.equal(a.map[8][39], 1);
  }
});

test('hero classes have different strengths and cannot move through stone', () => {
  const heroes = Object.keys(CLASSES).map(id => createGame(id, 42));
  assert.ok(stats(heroes[0]).hp > stats(heroes[2]).hp);
  assert.ok(stats(heroes[1]).speed > stats(heroes[0]).speed);
  assert.ok(stats(heroes[2]).mana > stats(heroes[1]).mana);
  const game = heroes[0];
  game.enemies = [];
  game.player.x = 3.5; game.player.y = 40.5;
  for (let i = 0; i < 100; i++) tick(game, { moveX: -1, moveY: 0 }, .05);
  assert.ok(isFloor(game, game.player.x, game.player.y));
  assert.ok(game.player.x > 3);
});

test('melee attacks kill foes, award XP and produce loot', () => {
  const game = createGame('knight', 7);
  game.enemies = [game.enemies.find(e => e.kind === 'imp')];
  const enemy = game.enemies[0]; enemy.x = game.player.x + .8; enemy.y = game.player.y; enemy.hp = 1;
  assert.equal(attack(game, enemy), true);
  assert.equal(enemy.hp <= 0, true);
  assert.equal(game.kills, 1);
  assert.ok(game.player.xp > 0);
  assert.equal(attack(game, enemy), false, 'attack cooldown applies');
});

test('ranged projectiles and skills use mana and damage nearby enemies', () => {
  const ranger = createGame('ranger', 9);
  ranger.enemies = [ranger.enemies[0]];
  const target = ranger.enemies[0]; target.x = ranger.player.x + 2; target.y = ranger.player.y; target.hp = 30;
  attack(ranger, target);
  for (let i = 0; i < 10; i++) tick(ranger, {}, .05);
  assert.ok(target.hp < 30);
  const mage = createGame('mage', 10);
  mage.enemies = [mage.enemies[0]]; mage.enemies[0].x = mage.player.x + 1; mage.enemies[0].y = mage.player.y;
  const originalHp = mage.enemies[0].hp, originalMana = mage.player.mana;
  assert.equal(castSkill(mage), true);
  assert.ok(mage.enemies[0].hp < originalHp);
  assert.ok(mage.player.mana < originalMana);
  assert.equal(castSkill(mage), false, 'skill cooldown applies');
});

test('potions, equipment and leveling respect stat caps', () => {
  const game = createGame('knight', 11), p = game.player;
  p.hp = 15; p.mana = 5;
  assert.equal(drinkPotion(game), true);
  assert.ok(p.hp > 15 && p.hp <= stats(game).hp);
  assert.equal(p.potions, 4);
  const item = makeItem(game, 'weapon');
  p.inventory.push(item);
  assert.equal(equipItem(game, item.id), true);
  assert.equal(p.equipment.weapon.id, item.id);
  assert.equal(equipItem(game, -1), false);
  p.xp = xpNeeded(1) - 1;
  const enemy = game.enemies.find(e => e.kind === 'imp');
  game.enemies = [enemy]; enemy.x = p.x + .8; enemy.y = p.y; enemy.hp = 1;
  attack(game, enemy);
  assert.equal(p.level, 2);
  assert.equal(p.hp, stats(game).hp);
});

test('boss victory carries progression into a deeper floor and saves restore state', () => {
  const game = createGame('knight', 12), boss = game.enemies.find(e => e.kind === 'boss');
  game.enemies = [boss]; boss.dormant = false; boss.x = game.player.x + .8; boss.y = game.player.y; boss.hp = 1;
  attack(game, boss);
  assert.equal(game.pendingFloor, true);
  assert.ok(game.player.inventory.some(item => item.rarity === 'rare' && item.slot === 'weapon'));
  const next = nextFloor(game);
  assert.equal(next.floor, 2);
  assert.equal(next.player.level, game.player.level);
  assert.equal(next.gold, game.gold);
  const restored = restoreGame(serializeGame(next));
  assert.equal(restored.floor, 2);
  assert.equal(restored.enemies.length, next.enemies.length);
  assert.equal(restored.player.potions, next.player.potions);
  assert.ok(isFloor(restored, restored.player.x, restored.player.y));
});
