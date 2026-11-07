import { describe, expect, it } from 'vitest';
import { deathKindOf, elemDamage } from '../src/game/world';
import { makeWorld, nextToMonster } from './helpers';

const res = { phys: 0, fire: 0, cold: 0, light: 0, poison: 0 };

describe('hit feedback', () => {
  it('the killing blow picks the death', () => {
    expect(deathKindOf(elemDamage('cold', 50), res, false)).toBe('shatter');
    expect(deathKindOf(elemDamage('fire', 50), res, false)).toBe('burn');
    expect(deathKindOf(elemDamage('light', 50), res, false)).toBe('shock');
    expect(deathKindOf(elemDamage('phys', 50), res, false)).toBe('normal');
    expect(deathKindOf(elemDamage('phys', 50), res, true)).toBe('gib');
    // Resistances count: a fire-immune monster killed by a fire+cold blow shatters.
    expect(deathKindOf({ phys: 0, fire: 60, cold: 20, light: 0, poison: 0 }, { ...res, fire: 100 }, false)).toBe('shatter');
  });

  it('crits and big kills ask for a freeze frame and shake; poison kills melt', () => {
    const w = makeWorld('reaver');
    w.enterArea('cinder_fields', 'start');
    const m = nextToMonster(w);
    m.life = m.maxLife = 1000;
    w.events.length = 0;
    w.damageMonster(m, elemDamage('phys', 10), { crit: true });
    expect(w.events.some((e) => e.type === 'hitstop')).toBe(true);
    expect(w.area.fx.some((f) => f.kind === 'text' && f.text === '10!' && f.size)).toBe(true);
    w.events.length = 0;
    w.damageMonster(m, elemDamage('phys', 10));
    expect(w.events.some((e) => e.type === 'hitstop')).toBe(false);
    m.life = 1;
    m.poison = { dps: 50, t: 3 };
    w.player.invuln = 99;
    for (let i = 0; i < 10; i++) w.step(1 / 30);
    expect(m.dead).toBe(true);
    expect(m.deathKind).toBe('melt');
  });

  it('frozen corpses shatter and cannot be raised', () => {
    const w = makeWorld('necromancer');
    w.enterArea('cinder_fields', 'start');
    const m = nextToMonster(w);
    m.res.cold = 0;
    w.damageMonster(m, elemDamage('cold', 1e6));
    expect(m.deathKind).toBe('shatter');
    expect(w.area.fx.some((f) => f.kind === 'shatter')).toBe(true);
    expect(w.findCorpse(m.x, m.y, 0.5)).toBeNull();
  });
});
