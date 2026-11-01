export const WORLD = { width: 1600, height: 1000 };
export const COST = { worker: 50, soldier: 75, tank: 140 };
export const UNIT = {
  worker: { name: 'Forge Drone', hp: 55, speed: 92, radius: 13, range: 70, damage: 5, cooldown: 1.1, supply: 1, build: 5.5 },
  soldier: { name: 'Vanguard', hp: 90, speed: 78, radius: 15, range: 155, damage: 13, cooldown: .82, supply: 2, build: 7 },
  tank: { name: 'Bulwark', hp: 230, speed: 49, radius: 22, range: 205, damage: 31, cooldown: 1.75, supply: 4, build: 12 }
};
let nextId = 1;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
export function createGame() {
  nextId = 1;
  const game = { time: 0, flux: 240, infiniteFlux: false, supplyCap: 24, selected: [], units: [], bases: [], crystals: [], shots: [], sparks: [], queue: [], enemyClock: -6, status: 'playing', message: 'Secure the nearby flux field, then build your army.', messageUntil: 8 };
  game.bases.push({ id: nextId++, side: 'player', x: 285, y: 505, radius: 64, hp: 1100, maxHp: 1100, name: 'Frontier Forge' });
  game.bases.push({ id: nextId++, side: 'enemy', x: 1320, y: 490, radius: 64, hp: 1100, maxHp: 1100, name: 'Hostile Forge' });
  [[505,290],[560,340],[485,390],[558,640],[480,710],[780,190],[820,270],[810,735],[860,815],[1060,310],[1100,390],[1060,680],[1140,740]].forEach(([x,y], i) => game.crystals.push({ id: nextId++, x, y, amount: i < 5 ? 440 : 310, radius: 23 }));
  [[395,455],[405,540],[358,603]].forEach(([x,y]) => spawn(game, 'worker', 'player', x, y));
  [[385,370],[400,645]].forEach(([x,y]) => spawn(game, 'soldier', 'player', x, y));
  [[1200,430],[1210,575]].forEach(([x,y]) => spawn(game, 'soldier', 'enemy', x, y));
  spawn(game, 'worker', 'enemy', 1205, 645);
  return game;
}
export function spawn(game, type, side, x, y) {
  const spec = UNIT[type];
  const unit = { id: nextId++, type, side, x, y, hp: spec.hp, maxHp: spec.hp, radius: spec.radius, target: null, targetId: null, task: 'idle', carrying: 0, harvestId: null, cooldown: 0, phase: Math.random() * 6.28 };
  game.units.push(unit);
  return unit;
}
export function supplyUsed(game) { return game.units.filter(u => u.side === 'player' && u.hp > 0).reduce((n,u) => n + UNIT[u.type].supply, 0) + game.queue.reduce((n,q) => n + UNIT[q.type].supply, 0); }
export function canTrain(game, type) { return game.status === 'playing' && !!UNIT[type] && (game.infiniteFlux || game.flux >= COST[type]) && supplyUsed(game) + UNIT[type].supply <= game.supplyCap; }
export function train(game, type) {
  if (!canTrain(game, type)) return false;
  if (!game.infiniteFlux) game.flux -= COST[type];
  game.queue.push({ type, remaining: UNIT[type].build, total: UNIT[type].build });
  return true;
}
export function entityAt(game, x, y) {
  const candidates = [...game.units, ...game.bases, ...game.crystals].filter(e => e.hp === undefined || e.hp > 0);
  return candidates.reverse().find(e => distance(e, {x,y}) <= e.radius + 8) || null;
}
export function select(game, ids, additive = false) {
  const valid = ids.filter(id => game.units.some(u => u.id === id && u.side === 'player' && u.hp > 0) || game.bases.some(b => b.id === id && b.side === 'player' && b.hp > 0));
  game.selected = additive ? [...new Set([...game.selected, ...valid])] : valid;
}
export function selectedUnits(game) { return game.units.filter(u => u.side === 'player' && game.selected.includes(u.id) && u.hp > 0); }
export function command(game, x, y, target = null, attackMove = false) {
  const units = selectedUnits(game);
  if (!units.length) return false;
  units.forEach((u, i) => {
    const offset = units.length > 1 ? { x: ((i % 5) - 2) * 33, y: (Math.floor(i / 5) - Math.floor(units.length / 10)) * 33 } : {x:0,y:0};
    if (target && target.amount !== undefined && u.type === 'worker') { u.task = 'harvest'; u.harvestId = target.id; u.target = {x:target.x,y:target.y}; u.targetId = null; }
    else if (target && target.side === 'enemy') { u.task = 'attack'; u.targetId = target.id; u.target = {x:target.x,y:target.y}; u.harvestId = null; }
    else { u.task = attackMove ? 'attackMove' : 'move'; u.target = {x:clamp(x + offset.x, 25, WORLD.width-25),y:clamp(y + offset.y, 25, WORLD.height-25)}; u.targetId = null; u.harvestId = null; }
  });
  return true;
}
export function stop(game) { selectedUnits(game).forEach(u => { u.task = 'idle'; u.target = null; u.targetId = null; u.harvestId = null; }); }
function moveToward(u, point, dt, stopAt = 0) {
  const d = distance(u, point);
  if (d <= stopAt + .5) return true;
  const step = Math.min(UNIT[u.type].speed * dt, d - stopAt);
  u.x = clamp(u.x + (point.x - u.x) / d * step, u.radius, WORLD.width-u.radius);
  u.y = clamp(u.y + (point.y - u.y) / d * step, u.radius, WORLD.height-u.radius);
  return false;
}
function nearestEnemy(game, u, radius) {
  return [...game.units, ...game.bases].filter(e => e.side !== u.side && e.hp > 0 && distance(u,e) <= radius).sort((a,b) => distance(u,a)-distance(u,b))[0];
}
function shoot(game, u, enemy) {
  const spec = UNIT[u.type];
  if (u.cooldown > 0 || distance(u, enemy) > spec.range + enemy.radius) return;
  u.cooldown = spec.cooldown;
  enemy.hp = Math.max(0, enemy.hp - spec.damage);
  game.shots.push({x:u.x,y:u.y,tx:enemy.x,ty:enemy.y,side:u.side,life:.18,maxLife:.18,heavy:u.type==='tank'});
  game.sparks.push({x:enemy.x,y:enemy.y,life:.34,side:u.side});
  if (enemy.hp === 0 && enemy.radius === 64) game.status = enemy.side === 'enemy' ? 'victory' : 'defeat';
}
function updateWorker(game, u, dt) {
  const crystal = game.crystals.find(c => c.id === u.harvestId && c.amount > 0);
  const base = game.bases.find(b => b.side === u.side && b.hp > 0);
  if (!crystal || !base) { u.task = 'idle'; u.target = null; return; }
  if (u.carrying > 0) {
    if (!moveToward(u, base, dt, base.radius + u.radius - 3)) return;
    if (u.side === 'player') game.flux += u.carrying;
    u.carrying = 0;
  } else if (moveToward(u, crystal, dt, crystal.radius + u.radius - 2)) {
    const mined = Math.min(15, crystal.amount);
    crystal.amount -= mined;
    u.carrying = mined;
    game.sparks.push({x:crystal.x,y:crystal.y,life:.45,side:'flux'});
  }
}
function enemyAI(game, dt) {
  game.enemyClock += dt;
  if (game.enemyClock < 18) return;
  game.enemyClock = 0;
  const base = game.bases.find(b => b.side === 'enemy');
  if (!base || base.hp <= 0) return;
  const type = game.time > 85 && Math.random() > .58 ? 'tank' : 'soldier';
  const u = spawn(game, type, 'enemy', base.x - 105, base.y + (Math.random()-.5)*120);
  u.task = 'attackMove'; u.target = {x:285,y:505};
  game.message = 'Hostile reinforcements detected.'; game.messageUntil = game.time + 4;
}
export function tick(game, dt) {
  if (game.status !== 'playing') return;
  dt = Math.min(dt, .05);
  game.time += dt;
  if (game.queue.length) {
    game.queue[0].remaining -= dt;
    if (game.queue[0].remaining <= 0) {
      const {type} = game.queue.shift(); const base = game.bases[0];
      const angle = Math.random() * Math.PI * 2;
      spawn(game, type, 'player', base.x + Math.cos(angle)*100, base.y + Math.sin(angle)*100);
    }
  }
  enemyAI(game, dt);
  for (const u of game.units) {
    if (u.hp <= 0) continue;
    u.cooldown = Math.max(0, u.cooldown-dt);
    const spec = UNIT[u.type];
    let enemy = u.targetId ? [...game.units,...game.bases].find(e => e.id === u.targetId && e.hp > 0) : null;
    if (!enemy && (u.task === 'attackMove' || u.task === 'idle' || u.task === 'attack') && u.type !== 'worker') enemy = nearestEnemy(game,u,spec.range + (u.task === 'idle' ? 35 : 105));
    if (enemy) {
      u.targetId = enemy.id;
      if (distance(u,enemy) <= spec.range + enemy.radius) shoot(game,u,enemy);
      else if (u.task !== 'idle') moveToward(u,enemy,dt,spec.range + enemy.radius - 4);
      continue;
    }
    if (u.task === 'harvest' && u.type === 'worker') updateWorker(game,u,dt);
    else if (u.target && (u.task === 'move' || u.task === 'attackMove')) {
      if (moveToward(u,u.target,dt,3)) { u.target = null; u.task = 'idle'; }
    } else if (u.task === 'attack') { u.task = 'idle'; u.targetId = null; }
  }
  game.units = game.units.filter(u => u.hp > 0);
  game.selected = game.selected.filter(id => [...game.units,...game.bases].some(e => e.id === id && e.hp > 0));
  game.shots.forEach(s => s.life -= dt); game.shots = game.shots.filter(s => s.life > 0);
  game.sparks.forEach(s => s.life -= dt); game.sparks = game.sparks.filter(s => s.life > 0);
}
