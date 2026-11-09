import { describe, expect, it } from 'vitest';
import { AREAS } from '../src/game/areas';
import { FLOOR, idx, WALL } from '../src/game/map';
import { makeWorld } from './helpers';

/** Clears a 7x3 floor strip with a single wall tile in its middle, and returns the strip's left end. */
function pillar(w: ReturnType<typeof makeWorld>) {
  const l = w.area.level;
  const x0 = Math.floor(l.w / 2) - 3;
  const y0 = Math.floor(l.h / 2) - 1;
  for (let y = y0 - 2; y <= y0 + 4; y++) for (let x = x0 - 2; x <= x0 + 8; x++) l.tiles[idx(l, x, y)] = FLOOR;
  l.tiles[idx(l, x0 + 3, y0 + 1)] = WALL;
  return { x: x0 + 0.5, y: y0 + 1.5, wallX: x0 + 3 };
}

describe('wall collision', () => {
  for (const r of [0.3, 0.55, 0.9]) {
    it(`an entity of radius ${r} cannot walk through a one-tile pillar`, () => {
      const w = makeWorld();
      w.enterArea('cinder_fields', 'start');
      const s = pillar(w);
      const e = { x: s.x, y: s.y };
      for (let i = 0; i < 200; i++) w.moveEntity(e, 0.05, 0, r);
      // It stops against the pillar's left face.
      expect(e.x + r).toBeLessThanOrEqual(s.wallX + 1e-9);
    });
  }

  it('big monsters never spawn wedged against a wall where they cannot move', () => {
    for (const a of AREAS) {
      for (let seed = 1; seed <= 6; seed++) {
        const w = makeWorld('reaver', seed * 101);
        w.enterArea(a.id, 'start');
        for (const m of w.area.monsters) {
          if (m.def.radius <= 0.5) continue;
          const canMove = [[0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05]].some(([dx, dy]) => w.moveEntity({ x: m.x, y: m.y }, dx, dy, m.def.radius));
          expect(canMove, `${a.id} seed ${seed}: ${m.name}`).toBe(true);
        }
      }
    }
  });
});
