import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/game/character';
import type { ClassId } from '../src/game/items';
import { classSkills } from '../src/game/skills';
import { feeds, SKILL_TREES, skillTree, unlockedBy } from '../src/game/skilltree';

const IDS = Object.keys(CLASSES) as ClassId[];

describe('skill trees', () => {
  it('places every skill of every class exactly once, in three branches', () => {
    for (const c of IDS) {
      const t = skillTree(c);
      expect(SKILL_TREES[c].length, c).toBe(3);
      expect(t.nodes.map((n) => n.skill.id).sort(), c).toEqual(classSkills(c).map((s) => s.id).sort());
      for (const n of t.nodes) expect(n.skill.classId).toBe(c);
      expect(new Set(t.nodes.map((n) => `${n.col},${n.row}`)).size, `${c}: two skills in one cell`).toBe(t.nodes.length);
    }
  });

  it('puts each skill on the row for its level and inside its own branch', () => {
    for (const c of IDS) {
      const t = skillTree(c);
      expect(t.levels).toEqual([1, 6, 12, 18, 24]);
      expect(t.cols).toBeLessThanOrEqual(4);
      expect(t.branches.reduce((n, b) => n + b.span, 0)).toBe(t.cols);
      for (const n of t.nodes) {
        expect(t.levels[n.row]).toBe(n.skill.reqLevel);
        const b = t.branches.find((x) => x.id === n.branch)!;
        expect(n.col).toBeGreaterThanOrEqual(b.col);
        expect(n.col).toBeLessThan(b.col + b.span);
      }
    }
  });

  it('draws a line for every requirement, always downwards', () => {
    for (const c of IDS) {
      const t = skillTree(c);
      expect(t.links.length).toBe(classSkills(c).reduce((n, s) => n + (s.prereq?.length ?? 0), 0));
      for (const l of t.links) expect(l.from.row, `${l.from.skill.id} -> ${l.to.skill.id}`).toBeLessThan(l.to.row);
    }
  });

  it('never runs a line through a skill it does not belong to', () => {
    for (const c of IDS) {
      const t = skillTree(c);
      for (const l of t.links) {
        for (const n of t.nodes) {
          if (n === l.from || n === l.to) continue;
          // Distance from the node's centre to the line, in cells. A node is drawn about 0.3 of a cell in radius.
          const dx = l.to.col - l.from.col;
          const dy = l.to.row - l.from.row;
          const k = Math.max(0, Math.min(1, ((n.col - l.from.col) * dx + (n.row - l.from.row) * dy) / (dx * dx + dy * dy)));
          const d = Math.hypot(l.from.col + k * dx - n.col, l.from.row + k * dy - n.row);
          expect(d, `${c}: ${l.from.skill.id} -> ${l.to.skill.id} crosses ${n.skill.id}`).toBeGreaterThan(0.4);
        }
      }
    }
  });

  it('knows what a skill leads to and what it feeds', () => {
    expect(unlockedBy('necromancer', 'bone_shards').map((s) => s.id).sort()).toEqual(['bone_lance', 'bone_ward']);
    expect(unlockedBy('necromancer', 'bone_storm')).toEqual([]);
    expect(feeds('arcanist', 'fire_bolt').map((f) => `${f.skill.id} ${f.pct}`).sort()).toEqual(['fireball 14', 'meteor 10']);
    expect(feeds('reaver', 'iron_skin')).toEqual([]);
  });
});
