import { describe, expect, it } from 'vitest';
import { AIController } from '../src/game/ai';
import { ENEMY, HUMAN } from '../src/game/world';
import { run, standardWorld } from './helpers';

describe('AI', () => {
  it('builds an economy, tech and an army', () => {
    const w = standardWorld(11);
    const ai = new AIController(w, ENEMY, 'normal');
    run(w, 300, () => ai.update());
    const kinds = new Set(w.buildingsOf(ENEMY).map((b) => b.kind));
    expect(kinds.has('garrison')).toBe(true);
    expect(kinds.has('habitat')).toBe(true);
    expect(kinds.has('extractor')).toBe(true);
    expect(w.unitsOf(ENEMY).filter((u) => u.kind === 'harvester').length).toBeGreaterThanOrEqual(14);
    expect(w.unitsOf(ENEMY).filter((u) => u.kind !== 'harvester').length + ai.waves).toBeGreaterThan(3);
    expect(w.players[ENEMY].flux).toBeGreaterThanOrEqual(0);
  });

  it('attacks a passive opponent and wins', () => {
    const w = standardWorld(12);
    const ai = new AIController(w, ENEMY, 'hard');
    run(w, 900, () => ai.update());
    expect(ai.waves).toBeGreaterThan(0);
    expect(w.winner).toBe(ENEMY);
  });

  it('AI vs AI plays to completion without errors', () => {
    const w = standardWorld(13);
    const a = new AIController(w, HUMAN, 'hard');
    const b = new AIController(w, ENEMY, 'easy');
    run(w, 1500, () => {
      a.update();
      b.update();
    });
    expect(a.waves + b.waves).toBeGreaterThan(0);
    expect(w.winner).toBe(HUMAN);
  });
});
