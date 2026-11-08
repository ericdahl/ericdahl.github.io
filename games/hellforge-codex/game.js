export const TILE = 48;
export const SIZE = 48;
export const CLASSES = {
  knight: { name: 'Iron Warden', title: 'Blade & bulwark', hp: 128, mana: 48, armor: 8, damage: 19, speed: 3.45, range: 1.55, attackRate: .42, color: '#d7a76d', skill: 'Cleave' },
  ranger: { name: 'Dusk Hunter', title: 'Bow & shadow', hp: 96, mana: 62, armor: 3, damage: 15, speed: 4.05, range: 6.8, attackRate: .36, color: '#97b98a', skill: 'Volley' },
  mage: { name: 'Ember Seer', title: 'Fire & storm', hp: 82, mana: 112, armor: 1, damage: 16, speed: 3.7, range: 6.3, attackRate: .5, color: '#9ebbe1', skill: 'Fire Nova' }
};
export const SLOTS = ['weapon', 'armor', 'ring'];
const PREFIXES = [
  { name: 'Cruel', stat: 'damage', min: 3, max: 8 },
  { name: 'Stalwart', stat: 'armor', min: 2, max: 7 },
  { name: 'Vigorous', stat: 'hp', min: 10, max: 24 },
  { name: 'Arcane', stat: 'mana', min: 10, max: 26 },
  { name: 'Fleet', stat: 'speed', min: .18, max: .42 }
];
const ITEM_BASES = {
  weapon: ['Rustbitten Blade', 'War Axe', 'Bone Bow', 'Ash Staff', 'Hellsteel Edge'],
  armor: ['Tattered Mail', 'Brigandine', 'Runic Vest', 'Gilded Plate', 'Demonhide'],
  ring: ['Iron Band', 'Garnet Ring', 'Oath Ring', 'Cinder Loop', 'Serpent Coil']
};
const ENEMIES = {
  imp: { name: 'Cinder Imp', hp: 32, damage: 7, speed: 2.25, radius: .29, xp: 12, color: '#b94c34', range: .75, rate: 1.35 },
  skeleton: { name: 'Hollow Legionnaire', hp: 54, damage: 11, speed: 1.75, radius: .33, xp: 18, color: '#ddd0aa', range: .9, rate: 1.55 },
  brute: { name: 'Ash Brute', hp: 104, damage: 17, speed: 1.35, radius: .43, xp: 32, color: '#a67066', range: 1, rate: 1.85 },
  shaman: { name: 'Flame Shaman', hp: 44, damage: 11, speed: 1.6, radius: .31, xp: 25, color: '#cf7e4c', range: 5.3, rate: 2.15 },
  boss: { name: 'Azrath, the Forge Tyrant', hp: 680, damage: 22, speed: 1.45, radius: .72, xp: 240, color: '#df7548', range: 1.4, rate: 1.6 }
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const randInt = (rng, n) => Math.floor(rng() * n);
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function isFloor(game, x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  return tx >= 0 && ty >= 0 && tx < SIZE && ty < SIZE && game.map[ty]?.[tx] === 1;
}
function carve(map, x, y, w, h) {
  for (let yy = Math.max(1, y); yy < Math.min(SIZE - 1, y + h); yy++)
    for (let xx = Math.max(1, x); xx < Math.min(SIZE - 1, x + w); xx++) map[yy][xx] = 1;
}
export function generateMap(seed) {
  const rng = makeRng(seed);
  const map = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  const rooms = [{ x: 3, y: 36, w: 10, h: 9 }];
  carve(map, 3, 36, 10, 9);
  for (let i = 0; i < 21; i++) {
    const w = 5 + randInt(rng, 5), h = 5 + randInt(rng, 5);
    const x = 2 + randInt(rng, SIZE - w - 4), y = 2 + randInt(rng, SIZE - h - 4);
    if (rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
    const previous = rooms[rooms.length - 1];
    const ax = previous.x + Math.floor(previous.w / 2), ay = previous.y + Math.floor(previous.h / 2);
    const bx = x + Math.floor(w / 2), by = y + Math.floor(h / 2);
    if (rng() < .5) { carve(map, Math.min(ax, bx), ay - 1, Math.abs(ax - bx) + 1, 3); carve(map, bx - 1, Math.min(ay, by), 3, Math.abs(ay - by) + 1); }
    else { carve(map, ax - 1, Math.min(ay, by), 3, Math.abs(ay - by) + 1); carve(map, Math.min(ax, bx), by - 1, Math.abs(ax - bx) + 1, 3); }
    carve(map, x, y, w, h);
    rooms.push({ x, y, w, h });
  }
  // A broad final chamber gives the boss room to move.
  carve(map, 34, 3, 11, 11);
  carve(map, 33, 9, 4, 3);
  const last = rooms[rooms.length - 1];
  const cx = last.x + Math.floor(last.w / 2), cy = last.y + Math.floor(last.h / 2);
  carve(map, Math.min(cx, 35), cy - 1, Math.abs(cx - 35) + 1, 3);
  carve(map, 34, Math.min(cy, 9), 3, Math.abs(cy - 9) + 1);
  rooms.push({ x: 34, y: 3, w: 11, h: 11, boss: true });
  return { map, rooms };
}
function center(room) { return { x: room.x + room.w / 2, y: room.y + room.h / 2 }; }
function spawnEnemy(game, kind, x, y, elite = false) {
  const data = ENEMIES[kind];
  const scale = 1 + (game.floor - 1) * .28;
  game.enemies.push({ id: ++game.nextId, kind, name: elite ? `Champion ${data.name}` : data.name, x, y, hp: Math.round(data.hp * scale * (elite ? 2.25 : 1)), maxHp: Math.round(data.hp * scale * (elite ? 2.25 : 1)), damage: Math.round(data.damage * scale * (elite ? 1.3 : 1)), speed: data.speed, radius: data.radius * (elite ? 1.13 : 1), xp: Math.round(data.xp * scale * (elite ? 2 : 1)), color: data.color, range: data.range, rate: data.rate, cooldown: .2 + game.rng(), wander: game.rng() * 6, elite, aggro: false } );
}
function populate(game) {
  const rooms = game.rooms;
  for (let i = 1; i < rooms.length - 1; i++) {
    const r = rooms[i], count = 2 + randInt(game.rng, 3);
    for (let j = 0; j < count; j++) {
      const kind = ['imp', 'skeleton', 'imp', 'shaman', 'brute'][randInt(game.rng, Math.min(3 + Math.floor(game.floor / 2), 5))];
      spawnEnemy(game, kind, r.x + 1.5 + game.rng() * (r.w - 3), r.y + 1.5 + game.rng() * (r.h - 3), j === 0 && i % 5 === 0);
    }
  }
  spawnEnemy(game, 'boss', 39.5, 8.5);
  game.enemies[game.enemies.length - 1].dormant = true;
}
export function createGame(classId = 'knight', seed = Date.now(), floor = 1) {
  if (!CLASSES[classId]) throw new Error(`Unknown class: ${classId}`);
  const { map, rooms } = generateMap(seed);
  const spec = CLASSES[classId];
  const game = { version: 1, classId, seed, floor, map, rooms, rng: makeRng(seed + 7), nextId: 0, time: 0, kills: 0, gold: 0, enemies: [], projectiles: [], effects: [], drops: [], texts: [], events: [], won: false, dead: false, pendingFloor: false,
    player: { x: 8, y: 40.5, hp: spec.hp, mana: spec.mana, level: 1, xp: 0, potions: 5, equipment: { weapon: null, armor: null, ring: null }, inventory: [], cooldown: 0, skillCooldown: 0, invulnerable: 0, facing: { x: 1, y: 0 }, attackPulse: 0 } };
  populate(game);
  event(game, `Descend into the Ashen Ruins. Slay Azrath.`, 'quest');
  return game;
}
export function stats(game) {
  const base = CLASSES[game.classId], p = game.player;
  const s = { hp: base.hp + (p.level - 1) * 12, mana: base.mana + (p.level - 1) * 7, armor: base.armor + Math.floor((p.level - 1) / 2), damage: base.damage + (p.level - 1) * 3, speed: base.speed, range: base.range, attackRate: base.attackRate };
  for (const item of Object.values(p.equipment)) if (item) s[item.stat] += item.value;
  return s;
}
export function xpNeeded(level) { return 45 + (level - 1) * 35 + (level - 1) ** 2 * 8; }
export function event(game, message, type = 'info') { game.events.push({ message, type, at: game.time }); if (game.events.length > 12) game.events.shift(); }
function floatText(game, x, y, text, color = '#f3d6aa') { game.texts.push({ x, y, text: String(text), color, age: 0 }); }
export function makeItem(game, forcedSlot) {
  const slot = forcedSlot || SLOTS[randInt(game.rng, SLOTS.length)];
  const prefix = PREFIXES[randInt(game.rng, PREFIXES.length)];
  const value = Math.round((prefix.min + game.rng() * (prefix.max - prefix.min)) * (1 + (game.floor - 1) * .35) * (1 + (game.player.level - 1) * .08) * (prefix.stat === 'speed' ? 100 : 1)) / (prefix.stat === 'speed' ? 100 : 1);
  return { id: ++game.nextId, slot, name: `${prefix.name} ${ITEM_BASES[slot][randInt(game.rng, ITEM_BASES[slot].length)]}`, stat: prefix.stat, value, rarity: game.rng() < .14 ? 'rare' : 'magic' };
}
export function itemDescription(item) { return `+${item.value}${item.stat === 'speed' ? '' : ''} ${item.stat === 'hp' ? 'life' : item.stat === 'mana' ? 'mana' : item.stat === 'armor' ? 'armor' : item.stat === 'damage' ? 'damage' : 'speed'}`; }
export function equipItem(game, id) {
  const p = game.player, index = p.inventory.findIndex(i => i.id === id);
  if (index < 0) return false;
  const item = p.inventory.splice(index, 1)[0], old = p.equipment[item.slot];
  p.equipment[item.slot] = item;
  if (old) p.inventory.push(old);
  const s = stats(game); p.hp = Math.min(p.hp, s.hp); p.mana = Math.min(p.mana, s.mana);
  event(game, `Equipped ${item.name}.`, 'loot');
  return true;
}
function move(game, entity, dx, dy, dt) {
  const stepX = dx * dt, stepY = dy * dt;
  if (isFloor(game, entity.x + stepX + Math.sign(stepX) * .22, entity.y) && isFloor(game, entity.x + stepX, entity.y + .21) && isFloor(game, entity.x + stepX, entity.y - .21)) entity.x += stepX;
  if (isFloor(game, entity.x, entity.y + stepY + Math.sign(stepY) * .22) && isFloor(game, entity.x + .21, entity.y + stepY) && isFloor(game, entity.x - .21, entity.y + stepY)) entity.y += stepY;
}
function damageEnemy(game, enemy, amount, source = 'hit') {
  if (enemy.hp <= 0) return;
  enemy.hp -= amount; enemy.aggro = true;
  floatText(game, enemy.x, enemy.y - .45, Math.round(amount), source === 'skill' ? '#ffb565' : '#f3e2bd');
  game.effects.push({ type: 'hit', x: enemy.x, y: enemy.y, age: 0, color: source === 'skill' ? '#ff9a42' : '#e6d1a2' });
  if (enemy.hp > 0) return;
  game.kills++; const p = game.player; p.xp += enemy.xp;
  if (enemy.kind === 'boss') { game.won = true; game.pendingFloor = true; const trophy = makeItem(game, 'weapon'); trophy.rarity = 'rare'; if (p.inventory.length < 18) { p.inventory.push(trophy); event(game, `Victory reward: ${trophy.name}`, 'loot'); } else game.drops.push({ x: enemy.x, y: enemy.y, type: 'item', item: trophy, age: 0 }); p.potions = Math.min(9, p.potions + 1); event(game, 'AZRATH HAS FALLEN. The forge is yours.', 'victory'); }
  else if (game.rng() < (enemy.elite ? .86 : .22)) game.drops.push({ x: enemy.x, y: enemy.y, type: 'item', item: makeItem(game), age: 0 });
  else if (game.rng() < .22) game.drops.push({ x: enemy.x, y: enemy.y, type: 'potion', age: 0 });
  const gold = 3 + Math.floor(game.rng() * 8) + game.floor * 2; game.gold += gold;
  if (enemy.elite) event(game, `${enemy.name} slain. +${enemy.xp} XP`, 'kill');
  while (p.xp >= xpNeeded(p.level)) { p.xp -= xpNeeded(p.level); p.level++; const s = stats(game); p.hp = s.hp; p.mana = s.mana; p.potions = Math.min(9, p.potions + 1); event(game, `LEVEL ${p.level}! Life and mana restored.`, 'level'); game.effects.push({ type: 'level', x: p.x, y: p.y, age: 0 }); }
}
function targetEnemy(game, aim, range) {
  const p = game.player;
  if (aim) {
    const candidate = game.enemies.filter(e => e.hp > 0 && dist(e, p) <= range).sort((a, b) => dist(a, aim) - dist(b, aim))[0];
    if (candidate && dist(candidate, aim) < 2.8) return candidate;
  }
  return game.enemies.filter(e => e.hp > 0 && dist(e, p) <= range).sort((a, b) => dist(a, p) - dist(b, p))[0];
}
export function attack(game, aim) {
  const p = game.player, s = stats(game);
  if (game.dead || p.cooldown > 0) return false;
  const target = targetEnemy(game, aim, s.range + .4);
  p.cooldown = s.attackRate; p.attackPulse = .2;
  if (target) p.facing = { x: (target.x - p.x) / (dist(target, p) || 1), y: (target.y - p.y) / (dist(target, p) || 1) };
  else if (aim) { const d = dist(p, aim) || 1; p.facing = { x: (aim.x - p.x) / d, y: (aim.y - p.y) / d }; }
  if (game.classId === 'knight') {
    game.effects.push({ type: 'slash', x: p.x, y: p.y, age: 0, angle: Math.atan2(p.facing.y, p.facing.x) });
    for (const e of game.enemies) if (e.hp > 0 && dist(e, p) < s.range + e.radius && (e === target || (e.x - p.x) * p.facing.x + (e.y - p.y) * p.facing.y > .15)) damageEnemy(game, e, s.damage * (.83 + game.rng() * .35));
  } else {
    const dir = p.facing;
    game.projectiles.push({ x: p.x + dir.x * .35, y: p.y + dir.y * .35, vx: dir.x * (game.classId === 'ranger' ? 12 : 9), vy: dir.y * (game.classId === 'ranger' ? 12 : 9), damage: s.damage * (.8 + game.rng() * .4), life: .9, type: game.classId === 'ranger' ? 'arrow' : 'fire', friendly: true });
  }
  return true;
}
export function castSkill(game, aim) {
  const p = game.player, s = stats(game), cost = game.classId === 'mage' ? 28 : game.classId === 'ranger' ? 20 : 18;
  if (game.dead || p.skillCooldown > 0 || p.mana < cost) { if (p.mana < cost) event(game, 'Not enough mana.', 'warn'); return false; }
  p.mana -= cost; p.skillCooldown = game.classId === 'mage' ? 5.8 : 4.2;
  if (game.classId === 'mage') {
    game.effects.push({ type: 'nova', x: p.x, y: p.y, age: 0 });
    for (const e of game.enemies) if (e.hp > 0 && dist(e, p) < 3.2) damageEnemy(game, e, s.damage * 2.35, 'skill');
  } else if (game.classId === 'knight') {
    const target = targetEnemy(game, aim, 2.3);
    if (target) p.facing = { x: (target.x - p.x) / dist(target, p), y: (target.y - p.y) / dist(target, p) };
    game.effects.push({ type: 'cleave', x: p.x, y: p.y, age: 0, angle: Math.atan2(p.facing.y, p.facing.x) });
    for (const e of game.enemies) if (e.hp > 0 && dist(e, p) < 2.35 && ((e.x - p.x) * p.facing.x + (e.y - p.y) * p.facing.y) > -.3) damageEnemy(game, e, s.damage * 2.1, 'skill');
  } else {
    const target = targetEnemy(game, aim, 7);
    if (target) p.facing = { x: (target.x - p.x) / dist(target, p), y: (target.y - p.y) / dist(target, p) };
    const angle = Math.atan2(p.facing.y, p.facing.x);
    for (const offset of [-.25, -.12, 0, .12, .25]) game.projectiles.push({ x: p.x, y: p.y, vx: Math.cos(angle + offset) * 13, vy: Math.sin(angle + offset) * 13, damage: s.damage * 1.22, life: .8, type: 'arrow', friendly: true });
    game.effects.push({ type: 'volley', x: p.x, y: p.y, age: 0 });
  }
  return true;
}
export function drinkPotion(game) {
  const p = game.player, s = stats(game);
  if (p.potions <= 0 || game.dead || (p.hp >= s.hp && p.mana >= s.mana)) return false;
  p.potions--; p.hp = Math.min(s.hp, p.hp + Math.ceil(s.hp * .53)); p.mana = Math.min(s.mana, p.mana + Math.ceil(s.mana * .24));
  game.effects.push({ type: 'potion', x: p.x, y: p.y, age: 0 }); floatText(game, p.x, p.y - .6, 'RESTORED', '#91daa9');
  return true;
}
export function nextFloor(game) {
  if (!game.pendingFloor) return false;
  const next = createGame(game.classId, game.seed + 8317, game.floor + 1);
  const p = game.player, q = next.player;
  q.level = p.level; q.xp = p.xp; q.inventory = p.inventory; q.equipment = p.equipment; q.potions = Math.min(9, p.potions + 2);
  const s = stats(next); q.hp = s.hp; q.mana = s.mana;
  next.gold = game.gold; next.kills = game.kills;
  event(next, `Depth ${next.floor}: the forge hungers still.`, 'quest');
  return next;
}
export function tick(game, input, dt) {
  dt = clamp(dt, 0, .05); if (game.dead) return;
  game.time += dt; const p = game.player, s = stats(game);
  p.cooldown = Math.max(0, p.cooldown - dt); p.skillCooldown = Math.max(0, p.skillCooldown - dt); p.invulnerable = Math.max(0, p.invulnerable - dt); p.attackPulse = Math.max(0, p.attackPulse - dt);
  p.mana = Math.min(s.mana, p.mana + dt * 1.45);
  let mx = input?.moveX || 0, my = input?.moveY || 0; const len = Math.hypot(mx, my);
  if (len > 0) { mx /= Math.max(1, len); my /= Math.max(1, len); move(game, p, mx * s.speed, my * s.speed, dt); if (!input?.attacking) p.facing = { x: mx, y: my }; }
  if (input?.attacking) attack(game, input.aim);
  for (const e of game.enemies) {
    if (e.hp <= 0) continue;
    e.cooldown -= dt; e.wander += dt;
    const d = dist(e, p); if (d < (e.kind === 'boss' ? 12 : 7.5)) e.aggro = true;
    if (e.dormant && d < 10) { e.dormant = false; event(game, 'AZRATH STIRS IN THE FORGE', 'boss'); }
    if (!e.aggro || e.dormant) continue;
    if (d > e.range * .82 && d < 14) move(game, e, (p.x - e.x) / (d || 1) * e.speed, (p.y - e.y) / (d || 1) * e.speed, dt);
    if (d < e.range + .38 && e.cooldown <= 0) {
      e.cooldown = e.rate; if (e.kind === 'shaman' || (e.kind === 'boss' && game.rng() < .56)) {
        const angle = Math.atan2(p.y - e.y, p.x - e.x);
        for (const offset of e.kind === 'boss' ? [-.24, 0, .24] : [0]) game.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(angle + offset) * 5.5, vy: Math.sin(angle + offset) * 5.5, damage: e.damage, life: 1.5, type: 'ember', friendly: false });
      } else hurtPlayer(game, e.damage);
    }
  }
  for (const shot of game.projectiles) {
    shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
    if (!isFloor(game, shot.x, shot.y)) shot.life = 0;
    if (shot.life <= 0) continue;
    if (shot.friendly) { for (const e of game.enemies) if (e.hp > 0 && dist(e, shot) < e.radius + .15) { damageEnemy(game, e, shot.damage, shot.type === 'fire' ? 'skill' : 'hit'); shot.life = 0; break; } }
    else if (dist(p, shot) < .42) { hurtPlayer(game, shot.damage); shot.life = 0; }
  }
  game.projectiles = game.projectiles.filter(s => s.life > 0);
  for (const drop of game.drops) {
    drop.age += dt;
    if (dist(drop, p) < .8) {
      if (drop.type === 'item' && p.inventory.length < 18) { p.inventory.push(drop.item); event(game, `Found ${drop.item.name}`, 'loot'); drop.taken = true; }
      else if (drop.type === 'potion') { p.potions = Math.min(9, p.potions + 1); event(game, 'Picked up a healing potion.', 'loot'); drop.taken = true; }
    }
  }
  game.drops = game.drops.filter(d => !d.taken);
  for (const fx of game.effects) fx.age += dt;
  game.effects = game.effects.filter(f => f.age < (f.type === 'level' ? 1.4 : .65));
  for (const t of game.texts) { t.age += dt; t.y -= dt * .55; }
  game.texts = game.texts.filter(t => t.age < .85);
}
function hurtPlayer(game, amount) {
  const p = game.player; if (p.invulnerable > 0 || game.dead) return;
  const harm = Math.max(1, Math.round(amount * 100 / (100 + stats(game).armor * 7)));
  p.hp = Math.max(0, p.hp - harm); p.invulnerable = .42;
  floatText(game, p.x, p.y - .6, `-${harm}`, '#ff6e64'); game.effects.push({ type: 'blood', x: p.x, y: p.y, age: 0 });
  if (p.hp <= 0) { game.dead = true; event(game, 'You have fallen. The forge claims another soul.', 'death'); }
}
export function serializeGame(game) {
  return JSON.stringify({ version: 1, classId: game.classId, seed: game.seed, floor: game.floor, player: game.player, gold: game.gold, kills: game.kills, won: game.won, pendingFloor: game.pendingFloor, dead: game.dead, enemies: game.enemies.map(e => ({ ...e })), drops: game.drops, nextId: game.nextId });
}
export function restoreGame(raw) {
  const data = JSON.parse(raw);
  if (data.version !== 1 || !CLASSES[data.classId]) throw new Error('Incompatible save');
  const game = createGame(data.classId, data.seed, data.floor);
  Object.assign(game, { player: data.player, gold: data.gold, kills: data.kills, won: data.won, pendingFloor: data.pendingFloor, dead: data.dead, enemies: data.enemies, drops: data.drops, nextId: data.nextId });
  game.player.cooldown = 0; game.player.skillCooldown = 0; game.player.invulnerable = 0;
  return game;
}
