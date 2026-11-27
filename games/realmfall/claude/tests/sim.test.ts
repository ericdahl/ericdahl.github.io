import { describe, it, expect } from 'vitest';
import { World } from '../src/game/world';
import { MOB_BY_ID } from '../src/game/data';

describe('realm war', () => {
  it('keeps change hands within twenty minutes, and no realm takes everything', () => {
    const w = new World(1, { headless: true });
    w.run(60 * 20);
    expect(w.war.history.length).toBeGreaterThan(1);
    const owners = new Set(w.keeps.map((k) => k.owner));
    expect(owners.size).toBeGreaterThan(1);
  }, 120000);
});

describe('combat', () => {
  it('a level 5 warden beats a level 5 grey wolf', () => {
    const w = new World(2, { populate: false, headless: true });
    const c = World.newChar('Bot', 0, 'warden', 2);
    c.level = 5;
    c.x = -606; c.z = 350;
    const p = w.spawnPlayer(c);
    const m = w.makeMob(MOB_BY_ID.grey_wolf, 5, -606, 345);
    w.add(m);
    p.target = m.id;
    p.attacking = true;
    for (let i = 0; i < 20 * 60 && !m.dead && !p.dead; i++) {
      if (!p.queuedStyle && p.endu > 20) w.useAbility(p, 'slash');
      w.tick(0.05);
    }
    expect(m.dead).toBe(true);
    expect(w.char!.xp).toBeGreaterThan(0);
  });

  it('a hit interrupts a spell, Focus prevents it', () => {
    const w = new World(3, { populate: false, headless: true });
    const c = World.newChar('Bot', 1, 'runecaller', 3);
    c.level = 10;
    c.x = 606; c.z = 350;
    const p = w.spawnPlayer(c);
    const m = w.makeMob(MOB_BY_ID.brigand, 10, 606, 348);
    w.add(m);
    p.target = m.id;
    w.useAbility(p, 'fire_bolt');
    expect(p.cast).not.toBeNull();
    w.damage(p, m, 5, 'melee', false, 'hit');
    expect(p.cast).toBeNull();
    p.cds = {};
    w.useAbility(p, 'focus');
    w.useAbility(p, 'fire_bolt');
    w.damage(p, m, 5, 'melee', false, 'hit');
    expect(p.cast).not.toBeNull();
  });

  it('styles chain: Backhand only follows Slash', () => {
    const w = new World(4, { populate: false, headless: true });
    const c = World.newChar('Bot', 0, 'warden', 4);
    c.level = 8;
    c.x = -606; c.z = 350;
    const p = w.spawnPlayer(c);
    const m = w.makeMob(MOB_BY_ID.boar, 8, -606, 348);
    w.add(m);
    const bh = (w as any).styleBlocked(p, m, { req: { follow: 'slash' } });
    expect(bh).toMatch(/Slash/);
    p.lastStyle = { id: 'slash', t: w.t };
    expect((w as any).styleBlocked(p, m, { req: { follow: 'slash' } })).toBeNull();
  });
});

describe('progression', () => {
  it('levels up and learns abilities', () => {
    const w = new World(5, { populate: false, headless: true });
    const p = w.spawnPlayer(World.newChar('Bot', 2, 'ranger', 5));
    w.gainXp(100000, '');
    expect(w.char!.level).toBeGreaterThan(5);
    expect(p.abilities).toContain('quick_shot');
    expect(p.maxHp).toBeGreaterThan(100);
  });
});

describe('leading a warband', () => {
  it('soldiers follow the player and fight the player’s target', () => {
    const w = new World(6, { headless: true });
    w.run(20);
    const c = World.newChar('Bot', 0, 'warden', 6);
    c.level = 18;
    const p = w.spawnPlayer(c);
    const b = w.war.bands.find((x) => x.realm === 0)!;
    const s = w.get(b.members[0])!;
    p.x = s.x + 3;
    p.z = s.z;
    w.war.lead(s, p);
    // walk the player 60 m toward the centre
    for (let i = 0; i < 20 * 12; i++) {
      const d = Math.hypot(p.x, p.z);
      w.input.mx = -p.x / d;
      w.input.mz = -p.z / d;
      w.tick(0.05);
    }
    w.input.mx = w.input.mz = 0;
    w.run(4);
    const alive = b.members.map((id) => w.get(id)!).filter((e) => !e.dead);
    const near = alive.filter((e) => Math.hypot(e.x - p.x, e.z - p.z) < 15);
    expect(near.length).toBeGreaterThan(alive.length / 2);
  });
});
