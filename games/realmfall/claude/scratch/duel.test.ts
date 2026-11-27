import { it } from 'vitest';
import { World, dist } from '../src/game/world';
import { MOB_BY_ID, CLASS_IDS, ABILITIES, CLASSES } from '../src/game/data';
import { makeItem, SLOTS } from '../src/game/items';
import { Rng } from '../src/game/rng';

function duel(cls: any, level: number, mobId: string, mobLevel: number, seed: number) {
  const w = new World(seed, { populate: false, headless: true });
  const c = World.newChar('Bot', 0, cls, seed);
  c.level = level;
  const r = new Rng(seed);
  for (const s of SLOTS) c.equip[s] = makeItem(r, cls, level, { slot: s, rarity: 0, quality: 0.93 });
  c.x = -606; c.z = 350;
  const p = w.spawnPlayer(c);
  const m = w.makeMob(MOB_BY_ID[mobId], mobLevel, -606, 320);
  w.add(m);
  p.target = m.id;
  const abil = CLASSES[cls as keyof typeof CLASSES].abilities.filter((a) => ABILITIES[a].level <= level);
  let t = 0;
  const startHp = p.hp;
  // simple bot: open with ranged, keep styles/spells going
  while (t < 120 && !p.dead && !m.dead) {
    const d = dist(p, m);
    if (!p.cast) {
      if (cls === 'warden' || cls === 'cleric') {
        if (d > 3) { w.input.mx = (m.x - p.x) / d; w.input.mz = (m.z - p.z) / d; } else { w.input.mx = w.input.mz = 0; }
        p.attacking = true;
        if (cls === 'cleric' && p.hp < p.maxHp * 0.5 && p.power > 20) w.useAbility(p, 'mend', p.id);
        else if (cls === 'cleric' && d > 8) w.useAbility(p, 'smite');
        if (cls === 'warden' && !p.queuedStyle) {
          for (const a of ['executioner', 'backhand', 'riposte', 'slash']) if (abil.includes(a) && !w.styleBlocked(p, m, ABILITIES[a])) { w.useAbility(p, a); break; }
        }
      } else {
        w.input.mx = w.input.mz = 0;
        p.attacking = true;
        for (const a of cls === 'ranger' ? ['quick_shot', 'crippling_arrow', 'aimed_shot'] : ['frost_lance', 'fire_bolt']) {
          if (a === 'crippling_arrow' && w.has(m, 'snare')) continue;
          if (a === 'frost_lance' && w.has(m, 'snare')) continue;
          if (abil.includes(a) && w.canUse(p, a, m) === null) { w.useAbility(p, a); break; }
        }
      }
    } else { w.input.mx = w.input.mz = 0; }
    p.facing = Math.atan2(m.z - p.z, m.x - p.x);
    w.tick(0.05);
    t += 0.05;
  }
  return { win: m.dead, t, hpLeft: p.dead ? 0 : p.hp / startHp };
}

it('duels', () => {
  for (const cls of CLASS_IDS) {
    const rows: string[] = [];
    for (const L of [1, 5, 10, 15, 19]) {
      const mob = L <= 3 ? 'young_wolf' : L <= 9 ? 'grey_wolf' : L <= 12 ? 'brigand' : 'dire_wolf';
      for (const dl of [0, 2]) {
        let wins = 0, tt = 0, hp = 0;
        const N = 8;
        for (let s = 1; s <= N; s++) { const r = duel(cls, L, mob, L + dl, s * 31 + L); wins += +r.win; tt += r.t; hp += r.hpLeft; }
        rows.push(`L${L}${dl ? '+' + dl : '  '} ${mob.padEnd(10)} win ${wins}/${N} t ${(tt / N).toFixed(0)}s hp ${Math.round((hp / N) * 100)}%`);
      }
    }
    console.log(cls + '\n  ' + rows.join('\n  '));
  }
}, 300000);
