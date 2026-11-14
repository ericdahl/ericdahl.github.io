import type { ClassId } from './items';
import { classSkills, SKILL_BY_ID, type SkillDef } from './skills';

/**
 * How each class's skills are laid out as a tree: three branches side by side, a row for each level the
 * skills open at, and a line from every skill to the ones it requires. This is only where things are drawn.
 * What a skill requires is still its own `prereq`, and the lines are read from that.
 */
export interface BranchDef {
  id: string;
  name: string;
  /** The branch's skills. A branch is as many columns wide as its widest row; `[id, 1]` puts a skill in its second column. */
  skills: (string | [string, number])[];
}

export const SKILL_TREES: Record<ClassId, BranchDef[]> = {
  reaver: [
    { id: 'combat', name: 'Combat', skills: ['bash', 'frenzy', ['leap', 1], 'whirlwind'] },
    { id: 'warcries', name: 'Warcries', skills: ['war_cry', 'battle_shout'] },
    { id: 'masteries', name: 'Masteries', skills: ['iron_skin', 'weapon_mastery'] },
  ],
  arcanist: [
    { id: 'fire', name: 'Fire', skills: ['fire_bolt', 'fireball', 'meteor'] },
    { id: 'cold', name: 'Cold', skills: ['ice_bolt', 'frost_shell', 'frost_nova'] },
    { id: 'lightning', name: 'Storm', skills: ['charged_bolt', 'teleport'] },
  ],
  huntress: [
    { id: 'marksmanship', name: 'Marksmanship', skills: ['power_shot', 'multishot', 'strafe'] },
    { id: 'arrows', name: 'Arrowcraft', skills: ['frost_arrow', 'exploding_arrow', 'storm_arrow'] },
    { id: 'instinct', name: 'Instinct', skills: ['critical_eye', 'evade'] },
  ],
  necromancer: [
    { id: 'summoning', name: 'Summoning', skills: ['raise_skeleton', 'skeletal_mastery', 'grave_golem'] },
    { id: 'curses', name: 'Curses', skills: ['frailty', 'corpse_burst'] },
    { id: 'bone', name: 'Bone', skills: ['bone_shards', ['bone_ward', 1], ['blight_nova', 1], 'bone_lance', 'bone_storm'] },
  ],
  forgewright: [
    { id: 'constructs', name: 'Constructs', skills: ['ballista', 'bellows', 'gearwork', ['brass_sentinel', 1], 'furnace'] },
    { id: 'hammer', name: 'Hammer', skills: ['sunder', 'anvil_drop', 'shockwave', 'earthshaker'] },
    { id: 'heat', name: 'Heat', skills: ['temper', 'slag_burst', 'white_heat'] },
  ],
  hiveborn: [
    { id: 'soldier', name: 'Soldier', skills: ['rend', 'many_hands', 'fourfold', ['carapace', 1], ['hold_the_line', 1]] },
    { id: 'archer', name: 'Archer', skills: ['loose', 'sky_hunter', 'volley', 'skyfall'] },
    { id: 'faith', name: 'Faith', skills: ['mending', 'ward_of_faith', 'congregation', 'hymn', 'judgement'] },
  ],
};

export interface TreeNode {
  skill: SkillDef;
  branch: string;
  col: number;
  row: number;
}

export interface SkillTree {
  /** The level each row opens at, top to bottom. */
  levels: number[];
  /** Branches left to right, with the column each starts at and how many it spans. */
  branches: { id: string; name: string; col: number; span: number }[];
  cols: number;
  nodes: TreeNode[];
  /** A line for each requirement: from the skill required to the skill that requires it. */
  links: { from: TreeNode; to: TreeNode }[];
}

const cache = new Map<ClassId, SkillTree>();

export function skillTree(classId: ClassId): SkillTree {
  const hit = cache.get(classId);
  if (hit) return hit;
  const levels = [...new Set(classSkills(classId).map((s) => s.reqLevel))].sort((a, b) => a - b);
  const nodes: TreeNode[] = [];
  const branches: SkillTree['branches'] = [];
  let col = 0;
  for (const b of SKILL_TREES[classId]) {
    let span = 1;
    for (const entry of b.skills) {
      const [id, sub] = typeof entry === 'string' ? [entry, 0] : entry;
      const skill = SKILL_BY_ID[id];
      span = Math.max(span, sub + 1);
      nodes.push({ skill, branch: b.id, col: col + sub, row: levels.indexOf(skill.reqLevel) });
    }
    branches.push({ id: b.id, name: b.name, col, span });
    col += span;
  }
  const at = new Map(nodes.map((n) => [n.skill.id, n]));
  const links = nodes.flatMap((to) => (to.skill.prereq ?? []).map((p) => ({ from: at.get(p)!, to })));
  const tree = { levels, branches, cols: col, nodes, links };
  cache.set(classId, tree);
  return tree;
}

/** The skills that need this one before they can be learned. */
export function unlockedBy(classId: ClassId, id: string): SkillDef[] {
  return skillTree(classId).links.filter((l) => l.from.skill.id === id).map((l) => l.to.skill);
}

/** The skills whose damage grows with points in this one. */
export function feeds(classId: ClassId, id: string): { skill: SkillDef; pct: number }[] {
  return classSkills(classId).flatMap((s) => (s.synergies ?? []).filter((x) => x.skill === id).map((x) => ({ skill: s, pct: x.pct })));
}
