import type { ClassId } from './items';

export type Element = 'phys' | 'fire' | 'cold' | 'light' | 'poison';
export type SkillKind =
  | 'attack' | 'passive' | 'buff' | 'projectile' | 'nova' | 'teleport' | 'leap' | 'whirlwind'
  | 'meteor' | 'multishot' | 'strafe' | 'bolts'
  | 'summon' | 'curse' | 'corpse' | 'shards' | 'ring'
  | 'construct' | 'anvil' | 'cone' | 'quake' | 'vent';

export interface SkillParams {
  /** Bonus % weapon damage for attack skills. */
  dmgPct?: number;
  arPct?: number;
  min?: number;
  max?: number;
  radius?: number;
  count?: number;
  duration?: number;
  chill?: number;
  range?: number;
  pct?: number;
  pct2?: number;
  stun?: number;
  chains?: number;
  /** Minion stats for summons. */
  life?: number;
  /** Life restored per second (the Furnace). */
  heal?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  classId: ClassId | 'all';
  reqLevel: number;
  prereq?: string[];
  kind: SkillKind;
  /** Attack skills scale off the weapon; 'bow' requires one. */
  weapon?: 'melee' | 'bow' | 'any';
  element?: Element;
  mana: (l: number) => number;
  params: (l: number) => SkillParams;
  desc: string;
  lines: (p: SkillParams) => string[];
  synergies?: { skill: string; pct: number }[];
  color: string;
  glyph: string;
  /** Spell cast time multiplier (cast rate). */
  castTime?: number;
}

const dim = (base: number, per: number, l: number, cap: number) => Math.round(cap * (1 - Math.exp(-(base + per * (l - 1)) / cap)));

export const SKILLS: SkillDef[] = [
  {
    id: 'attack', name: 'Attack', classId: 'all', reqLevel: 1, kind: 'attack', weapon: 'any', mana: () => 0,
    params: () => ({}), desc: 'Strike with your weapon.', lines: () => [], color: '#c8b9a0', glyph: '⚔',
  },
  // ------------------------------------------------------------ Reaver
  {
    id: 'bash', name: 'Bash', classId: 'reaver', reqLevel: 1, kind: 'attack', weapon: 'melee',
    mana: () => 2, params: (l) => ({ dmgPct: 45 + 20 * l, arPct: 20 + 8 * l }),
    desc: 'A crushing blow that knocks enemies back.',
    lines: (p) => [`+${p.dmgPct}% Damage`, `+${p.arPct}% Attack Rating`, 'Knocks back'], color: '#d9883a', glyph: '✊',
  },
  {
    id: 'iron_skin', name: 'Iron Skin', classId: 'reaver', reqLevel: 1, kind: 'passive',
    mana: () => 0, params: (l) => ({ pct: 25 + 12 * l, pct2: Math.min(40, 4 + 2 * l) }),
    desc: 'Passive: hardened hide and thick blood.',
    lines: (p) => [`+${p.pct}% Defense`, `+${p.pct2}% Max Life`], color: '#8a8f99', glyph: '⛨',
  },
  {
    id: 'weapon_mastery', name: 'Weapon Mastery', classId: 'reaver', reqLevel: 6, kind: 'passive',
    mana: () => 0, params: (l) => ({ pct: 25 + 10 * l, pct2: 20 + 12 * l, chill: dim(3, 1.5, l, 40) }),
    desc: 'Passive: deadly skill with blades, axes and maces.',
    lines: (p) => [`+${p.pct}% Damage`, `+${p.pct2}% Attack Rating`, `${p.chill}% Critical Strike`], color: '#b7b2a6', glyph: '🗡',
  },
  {
    id: 'war_cry', name: 'War Cry', classId: 'reaver', reqLevel: 6, prereq: ['bash'], kind: 'nova', element: 'phys',
    mana: (l) => 6 + l * 0.5, params: (l) => ({ min: 4 + 4 * l, max: 8 + 6 * l, radius: 4.2, stun: 1 + 0.15 * l }),
    desc: 'A deafening howl that damages and stuns nearby foes.',
    lines: (p) => [`Damage: ${p.min}-${p.max}`, `Stun: ${p.stun!.toFixed(1)}s`, `Radius: ${p.radius} yards`], color: '#e0b347', glyph: '📣',
    synergies: [{ skill: 'battle_shout', pct: 12 }],
  },
  {
    id: 'leap', name: 'Leap Attack', classId: 'reaver', reqLevel: 12, prereq: ['war_cry'], kind: 'leap', weapon: 'melee',
    mana: () => 7, params: (l) => ({ dmgPct: 60 + 20 * l, range: Math.min(10, 5 + 0.4 * l), radius: 2 }),
    desc: 'Leap into the fray, crashing down on everything nearby.',
    lines: (p) => [`+${p.dmgPct}% Damage on landing`, `Range: ${p.range!.toFixed(1)} yards`], color: '#c96f2b', glyph: '⤴',
  },
  {
    id: 'frenzy', name: 'Frenzy', classId: 'reaver', reqLevel: 12, prereq: ['bash'], kind: 'attack', weapon: 'melee',
    mana: () => 3, params: (l) => ({ dmgPct: 40 + 12 * l, pct: 10 + 2 * l, duration: 4 }),
    desc: 'Each hit grows your fury, increasing attack and run speed (stacks 4x).',
    lines: (p) => [`+${p.dmgPct}% Damage`, `+${p.pct}% attack speed per stack`, `+${Math.round(p.pct! / 2)}% run speed per stack`], color: '#d23a2a', glyph: '♨',
  },
  {
    id: 'battle_shout', name: 'Battle Shout', classId: 'reaver', reqLevel: 18, prereq: ['war_cry'], kind: 'buff',
    mana: () => 12, params: (l) => ({ pct: 30 + 6 * l, pct2: 40 + 10 * l, duration: 40 + 5 * l }),
    desc: 'Rally yourself: more life, mana and defense.',
    lines: (p) => [`+${p.pct}% Max Life and Mana`, `+${p.pct2}% Defense`, `Duration: ${p.duration}s`], color: '#e8d27a', glyph: '♛',
  },
  {
    id: 'whirlwind', name: 'Whirlwind', classId: 'reaver', reqLevel: 24, prereq: ['leap', 'frenzy'], kind: 'whirlwind', weapon: 'melee',
    mana: () => 14, params: (l) => ({ dmgPct: 20 + 12 * l, range: 7, radius: 1.8 }),
    desc: 'Spin through enemies, striking everything in your path.',
    lines: (p) => [`+${p.dmgPct}% Damage`, `Distance: ${p.range} yards`], color: '#9fd2e6', glyph: '🌀',
  },
  // ------------------------------------------------------------ Arcanist
  {
    id: 'fire_bolt', name: 'Fire Bolt', classId: 'arcanist', reqLevel: 1, kind: 'projectile', element: 'fire',
    mana: () => 2.5, params: (l) => ({ min: 3 + 4 * (l - 1), max: 6 + 5 * (l - 1) }),
    desc: 'Hurl a bolt of flame.', lines: (p) => [`Fire Damage: ${p.min}-${p.max}`],
    synergies: [{ skill: 'fireball', pct: 14 }, { skill: 'meteor', pct: 14 }], color: '#ff7a2a', glyph: '🔥',
  },
  {
    id: 'ice_bolt', name: 'Ice Bolt', classId: 'arcanist', reqLevel: 1, kind: 'projectile', element: 'cold',
    mana: () => 3, params: (l) => ({ min: 3 + 3 * (l - 1), max: 5 + 4 * (l - 1), chill: 2 + 0.4 * l }),
    desc: 'A shard of ice that chills its target.',
    lines: (p) => [`Cold Damage: ${p.min}-${p.max}`, `Chill: ${p.chill!.toFixed(1)}s`],
    synergies: [{ skill: 'frost_nova', pct: 15 }], color: '#7fd0ff', glyph: '❄',
  },
  {
    id: 'charged_bolt', name: 'Charged Bolt', classId: 'arcanist', reqLevel: 6, kind: 'bolts', element: 'light',
    mana: (l) => 3 + 0.4 * l, params: (l) => ({ min: 1 + l, max: 4 + 2 * l, count: Math.min(12, 3 + Math.floor(l / 2)) }),
    desc: 'Release a spray of crackling, wandering bolts.',
    lines: (p) => [`Lightning Damage: ${p.min}-${p.max} each`, `Bolts: ${p.count}`], color: '#cfe3ff', glyph: '⚡',
  },
  {
    id: 'frost_shell', name: 'Frost Shell', classId: 'arcanist', reqLevel: 6, prereq: ['ice_bolt'], kind: 'buff', element: 'cold',
    mana: () => 9, params: (l) => ({ pct: 40 + 12 * l, duration: 120 + 12 * l }),
    desc: 'A shell of ice raises defense and chills melee attackers.',
    lines: (p) => [`+${p.pct}% Defense`, `Duration: ${p.duration}s`], color: '#a9e4ff', glyph: '🛡',
  },
  {
    id: 'frost_nova', name: 'Frost Nova', classId: 'arcanist', reqLevel: 12, prereq: ['frost_shell'], kind: 'nova', element: 'cold',
    mana: (l) => 9 + l, params: (l) => ({ min: 4 + 4 * l, max: 8 + 5 * l, radius: 4.5, chill: 3 + 0.3 * l }),
    desc: 'A ring of frost blasts outward from you.',
    lines: (p) => [`Cold Damage: ${p.min}-${p.max}`, `Chill: ${p.chill!.toFixed(1)}s`],
    synergies: [{ skill: 'ice_bolt', pct: 10 }], color: '#bff0ff', glyph: '✳',
  },
  {
    id: 'teleport', name: 'Teleport', classId: 'arcanist', reqLevel: 12, prereq: ['charged_bolt'], kind: 'teleport',
    mana: (l) => Math.max(8, 22 - l), params: (l) => ({ range: Math.min(14, 8 + 0.5 * l) }),
    desc: 'Instantly blink to a visible location.',
    lines: (p) => [`Range: ${p.range!.toFixed(1)} yards`], color: '#c38cff', glyph: '✧', castTime: 0.7,
  },
  {
    id: 'fireball', name: 'Fireball', classId: 'arcanist', reqLevel: 18, prereq: ['fire_bolt'], kind: 'projectile', element: 'fire',
    mana: (l) => 5 + 0.6 * l, params: (l) => ({ min: 8 + 7 * (l - 1), max: 16 + 9 * (l - 1), radius: 2.2 }),
    desc: 'An exploding sphere of flame.',
    lines: (p) => [`Fire Damage: ${p.min}-${p.max}`, `Radius: ${p.radius} yards`],
    synergies: [{ skill: 'fire_bolt', pct: 14 }, { skill: 'meteor', pct: 14 }], color: '#ffae3a', glyph: '☄',
  },
  {
    id: 'meteor', name: 'Meteor', classId: 'arcanist', reqLevel: 24, prereq: ['fireball'], kind: 'meteor', element: 'fire',
    mana: (l) => 17 + l, params: (l) => ({ min: 35 + 14 * (l - 1), max: 55 + 18 * (l - 1), radius: 3, duration: 3 }),
    desc: 'Call down a burning star from the heavens.',
    lines: (p) => [`Fire Damage: ${p.min}-${p.max}`, `Radius: ${p.radius} yards`, 'Leaves burning ground'],
    synergies: [{ skill: 'fire_bolt', pct: 10 }, { skill: 'fireball', pct: 10 }], color: '#ff5522', glyph: '☀',
  },
  // ------------------------------------------------------------ Huntress
  {
    id: 'power_shot', name: 'Power Shot', classId: 'huntress', reqLevel: 1, kind: 'attack', weapon: 'bow',
    mana: () => 1.5, params: (l) => ({ dmgPct: 50 + 20 * l, arPct: 25 + 10 * l }),
    desc: 'A carefully aimed arrow that pierces.', lines: (p) => [`+${p.dmgPct}% Damage`, `+${p.arPct}% Attack Rating`, 'Pierces'],
    color: '#d6c06a', glyph: '➶',
  },
  {
    id: 'critical_eye', name: 'Critical Eye', classId: 'huntress', reqLevel: 1, kind: 'passive',
    mana: () => 0, params: (l) => ({ pct: dim(12, 5, l, 70) }),
    desc: 'Passive: chance to deal double physical damage.', lines: (p) => [`${p.pct}% chance of double damage`],
    color: '#e6e6e6', glyph: '◎',
  },
  {
    id: 'multishot', name: 'Multishot', classId: 'huntress', reqLevel: 6, prereq: ['power_shot'], kind: 'multishot', weapon: 'bow',
    mana: (l) => 4 + 0.5 * l, params: (l) => ({ count: Math.min(15, 2 + l), dmgPct: -25 + 8 * l }),
    desc: 'Loose a fan of arrows.', lines: (p) => [`Arrows: ${p.count}`, `${p.dmgPct! >= 0 ? '+' : ''}${p.dmgPct}% Damage`],
    color: '#b9d06a', glyph: '⋔',
  },
  {
    id: 'frost_arrow', name: 'Frost Arrow', classId: 'huntress', reqLevel: 6, kind: 'attack', weapon: 'bow', element: 'cold',
    mana: () => 3, params: (l) => ({ min: 3 + 3 * l, max: 6 + 4 * l, chill: 2 + 0.3 * l }),
    desc: 'An arrow wrapped in frost that chills.', lines: (p) => [`Adds ${p.min}-${p.max} Cold Damage`, `Chill: ${p.chill!.toFixed(1)}s`],
    color: '#8fdcff', glyph: '❆',
  },
  {
    id: 'evade', name: 'Evade', classId: 'huntress', reqLevel: 12, prereq: ['critical_eye'], kind: 'passive',
    mana: () => 0, params: (l) => ({ pct: dim(8, 3, l, 55) }),
    desc: 'Passive: chance to dodge attacks and missiles.', lines: (p) => [`${p.pct}% chance to evade`],
    color: '#9bd39b', glyph: '↯',
  },
  {
    id: 'exploding_arrow', name: 'Exploding Arrow', classId: 'huntress', reqLevel: 12, prereq: ['multishot'], kind: 'attack', weapon: 'bow', element: 'fire',
    mana: (l) => 5 + 0.3 * l, params: (l) => ({ min: 4 + 5 * l, max: 8 + 7 * l, radius: 2 }),
    desc: 'An arrow that bursts into flame on impact.', lines: (p) => [`Adds ${p.min}-${p.max} Fire Damage`, `Radius: ${p.radius} yards`],
    color: '#ff8c3a', glyph: '✹',
  },
  {
    id: 'strafe', name: 'Strafe', classId: 'huntress', reqLevel: 18, prereq: ['multishot'], kind: 'strafe', weapon: 'bow',
    mana: () => 9, params: (l) => ({ count: Math.min(10, 3 + Math.floor(l / 2)), dmgPct: 20 + 10 * l }),
    desc: 'Rapidly fire at several nearby enemies.', lines: (p) => [`Targets: ${p.count}`, `+${p.dmgPct}% Damage`],
    color: '#e3d38c', glyph: '⇶',
  },
  {
    id: 'storm_arrow', name: 'Storm Arrow', classId: 'huntress', reqLevel: 24, prereq: ['exploding_arrow', 'strafe'], kind: 'attack', weapon: 'bow', element: 'light',
    mana: (l) => 10 + l * 0.5, params: (l) => ({ min: 10 + 8 * l, max: 30 + 12 * l, chains: 2 + Math.floor(l / 3) }),
    desc: 'An arrow that unleashes chain lightning on impact.',
    lines: (p) => [`Lightning Damage: ${p.min}-${p.max}`, `Chains: ${p.chains}`], color: '#d6e6ff', glyph: 'ϟ',
  },
  // ------------------------------------------------------------ Necromancer
  {
    id: 'raise_skeleton', name: 'Raise Skeleton', classId: 'necromancer', reqLevel: 1, kind: 'summon',
    mana: (l) => 5 + l * 0.5, params: (l) => ({ count: l <= 3 ? l : Math.min(12, 3 + Math.floor((l - 3) / 2)), pct: 10 * (l - 1), pct2: 8 * (l - 1) }),
    desc: 'Raise a skeleton warrior from a corpse to fight at your side.',
    lines: (p) => [`Skeletons: ${p.count}`, `+${p.pct}% Skeleton Damage`, `+${p.pct2}% Skeleton Life`, 'Needs a corpse'], color: '#e6dcc0', glyph: '☠',
  },
  {
    id: 'bone_shards', name: 'Bone Shards', classId: 'necromancer', reqLevel: 1, kind: 'shards', element: 'phys',
    mana: (l) => 2.5 + 0.25 * l, params: (l) => ({ min: 2 + 2 * (l - 1), max: 4 + 3 * (l - 1), count: Math.min(9, 2 + Math.ceil(l / 2)) }),
    desc: 'Spit a fan of razor bone splinters that never miss.',
    lines: (p) => [`Damage: ${p.min}-${p.max} each`, `Shards: ${p.count}`],
    synergies: [{ skill: 'bone_lance', pct: 12 }, { skill: 'corpse_burst', pct: 8 }], color: '#efe6cc', glyph: '⋮',
  },
  {
    id: 'frailty', name: 'Mark of Frailty', classId: 'necromancer', reqLevel: 1, kind: 'curse',
    mana: () => 4, params: (l) => ({ pct: Math.min(100, 45 + 5 * l), radius: Math.min(5, 2 + 0.3 * l), duration: 8 + 2 * l }),
    desc: 'Curse a group of enemies so they take more physical damage.',
    lines: (p) => [`+${p.pct}% Physical Damage taken`, `Radius: ${p.radius!.toFixed(1)} yards`, `Duration: ${p.duration}s`], color: '#b05ad0', glyph: '⛧',
  },
  {
    id: 'skeletal_mastery', name: 'Skeletal Mastery', classId: 'necromancer', reqLevel: 6, prereq: ['raise_skeleton'], kind: 'passive',
    mana: () => 0, params: (l) => ({ pct: 12 * l, pct2: 15 * l }),
    desc: 'Passive: your skeletons and golem hit harder and endure more.',
    lines: (p) => [`+${p.pct}% Minion Damage`, `+${p.pct2}% Minion Life`], color: '#cfc6a6', glyph: '⚚',
  },
  {
    id: 'bone_ward', name: 'Bone Ward', classId: 'necromancer', reqLevel: 6, prereq: ['bone_shards'], kind: 'buff',
    mana: (l) => 10 + l, params: (l) => ({ min: 20 + 12 * l, duration: 180 }),
    desc: 'A swirling cage of bone that absorbs damage until it breaks.',
    lines: (p) => [`Absorbs ${p.min} damage`, `Duration: ${p.duration}s`], color: '#ddd3b5', glyph: '⛉',
  },
  {
    id: 'corpse_burst', name: 'Corpse Burst', classId: 'necromancer', reqLevel: 6, prereq: ['frailty'], kind: 'corpse', element: 'fire',
    mana: (l) => 12 + l * 0.5, params: (l) => ({ pct: 50 + 5 * l, pct2: 90 + 6 * l, radius: Math.min(5, 2.6 + 0.2 * l) }),
    desc: "Detonate a corpse, blasting nearby enemies with fire and bone based on the dead creature's life.",
    lines: (p) => [`Damage: ${p.pct}-${p.pct2}% of corpse life`, `Radius: ${p.radius!.toFixed(1)} yards`], color: '#ff7a4a', glyph: '✺',
  },
  {
    id: 'blight_nova', name: 'Blight Nova', classId: 'necromancer', reqLevel: 12, prereq: ['bone_ward'], kind: 'nova', element: 'poison',
    mana: (l) => 12 + l, params: (l) => ({ min: 18 + 12 * (l - 1), max: 30 + 16 * (l - 1), radius: 5.5 }),
    desc: 'A ring of plague bursts from you, poisoning everything it touches.',
    lines: (p) => [`Poison Damage: ${p.min}-${p.max} over 3s`, `Radius: ${p.radius} yards`], color: '#8ad040', glyph: '☣',
  },
  {
    id: 'grave_golem', name: 'Grave Golem', classId: 'necromancer', reqLevel: 12, prereq: ['skeletal_mastery'], kind: 'summon',
    mana: (l) => 15 + l, params: (l) => ({ count: 1, pct: 15 * (l - 1), pct2: 25 * (l - 1) }),
    desc: 'Shape a hulking golem of grave earth that draws enemies to itself.',
    lines: (p) => [`+${p.pct}% Golem Damage`, `+${p.pct2}% Golem Life`, 'One at a time'], color: '#a08060', glyph: '⛰',
  },
  {
    id: 'bone_lance', name: 'Bone Lance', classId: 'necromancer', reqLevel: 18, prereq: ['bone_shards', 'corpse_burst'], kind: 'projectile', element: 'phys',
    mana: (l) => 7 + 0.5 * l, params: (l) => ({ min: 16 + 10 * (l - 1), max: 26 + 13 * (l - 1) }),
    desc: 'Hurl a spear of bone that pierces every enemy in its path.',
    lines: (p) => [`Damage: ${p.min}-${p.max}`, 'Pierces'],
    synergies: [{ skill: 'bone_shards', pct: 10 }, { skill: 'bone_ward', pct: 10 }], color: '#f4ecd2', glyph: '➹',
  },
  {
    id: 'bone_storm', name: 'Bone Storm', classId: 'necromancer', reqLevel: 24, prereq: ['bone_lance', 'grave_golem'], kind: 'ring', element: 'phys',
    mana: (l) => 18 + l, params: (l) => ({ min: 20 + 10 * (l - 1), max: 32 + 13 * (l - 1), count: Math.min(20, 10 + Math.floor(l / 2)) }),
    desc: 'Erupt in a storm of bone lances flying in every direction.',
    lines: (p) => [`Damage: ${p.min}-${p.max} each`, `Lances: ${p.count}`, 'Pierces'],
    synergies: [{ skill: 'bone_lance', pct: 10 }], color: '#fff6dc', glyph: '✵',
  },
  // ------------------------------------------------------------ Forgewright
  // Hammer
  {
    id: 'sunder', name: 'Sunder', classId: 'forgewright', reqLevel: 1, kind: 'attack', weapon: 'melee',
    mana: () => 2, params: (l) => ({ dmgPct: 50 + 18 * l, arPct: 20 + 8 * l, pct: Math.min(60, 12 + 3 * l), duration: 5 }),
    desc: 'A two-handed blow that cracks armor: the target takes more physical damage for a while.',
    lines: (p) => [`+${p.dmgPct}% Damage`, `+${p.arPct}% Attack Rating`, `Target takes +${p.pct}% Physical Damage for ${p.duration}s`], color: '#c9a070', glyph: '⚒',
  },
  {
    id: 'anvil_drop', name: 'Anvil Drop', classId: 'forgewright', reqLevel: 6, prereq: ['sunder'], kind: 'anvil', weapon: 'melee', element: 'phys',
    mana: (l) => 6 + 0.4 * l, params: (l) => ({ dmgPct: 90 + 30 * l, radius: 2.2, stun: 0.8 + 0.1 * l }),
    desc: 'Call an anvil down out of the smoke. It lands a moment later, crushing and stunning everything beneath it.',
    lines: (p) => [`+${p.dmgPct}% Weapon Damage`, `Stun: ${p.stun!.toFixed(1)}s`, `Radius: ${p.radius} yards`],
    synergies: [{ skill: 'sunder', pct: 6 }, { skill: 'earthshaker', pct: 8 }], color: '#8e939c', glyph: '▼', castTime: 0.8,
  },
  {
    id: 'shockwave', name: 'Shockwave', classId: 'forgewright', reqLevel: 12, prereq: ['anvil_drop'], kind: 'cone', weapon: 'melee',
    mana: (l) => 5 + 0.3 * l, params: (l) => ({ dmgPct: 30 + 14 * l, range: Math.min(7, 4.5 + 0.15 * l) }),
    desc: 'Hammer the ground and send a wave of force rolling out in front of you, throwing enemies back.',
    lines: (p) => [`+${p.dmgPct}% Weapon Damage`, `Reach: ${p.range!.toFixed(1)} yards`, 'Knocks back'],
    synergies: [{ skill: 'anvil_drop', pct: 6 }], color: '#d8c090', glyph: '⟫',
  },
  {
    id: 'earthshaker', name: 'Earthshaker', classId: 'forgewright', reqLevel: 24, prereq: ['shockwave', 'slag_burst'], kind: 'quake', weapon: 'melee',
    mana: (l) => 12 + 0.5 * l, params: (l) => ({ dmgPct: 40 + 16 * l, radius: 4.5, count: 3, stun: 0.5 }),
    desc: 'Bring the hammer down with everything you have. Three tremors roll out around you, each wider than the last.',
    lines: (p) => [`+${p.dmgPct}% Weapon Damage per tremor`, `Tremors: ${p.count}`, `Radius: up to ${p.radius} yards`],
    synergies: [{ skill: 'shockwave', pct: 6 }, { skill: 'anvil_drop', pct: 6 }], color: '#b07840', glyph: '❖',
  },
  // Constructs
  {
    id: 'ballista', name: 'Ballista Turret', classId: 'forgewright', reqLevel: 1, kind: 'construct',
    mana: (l) => 7 + 0.5 * l, params: (l) => ({ count: Math.min(3, 1 + Math.floor(l / 5)), pct: 12 * (l - 1), pct2: 10 * (l - 1), range: 8.5, duration: 30 + 2 * l }),
    desc: 'Bolt together a ballista that shoots at anything in range. Monsters will attack it.',
    lines: (p) => [`Turrets: ${p.count}`, `+${p.pct}% Bolt Damage`, `+${p.pct2}% Turret Life`, `Lasts ${p.duration}s`],
    synergies: [{ skill: 'brass_sentinel', pct: 6 }], color: '#b08a50', glyph: '⤞', castTime: 0.8,
  },
  {
    id: 'bellows', name: 'Bellows Turret', classId: 'forgewright', reqLevel: 6, prereq: ['ballista'], kind: 'construct', element: 'fire',
    mana: (l) => 9 + 0.5 * l, params: (l) => ({ count: 1, min: 3 + 3 * l, max: 6 + 4 * l, pct2: 12 * (l - 1), range: 3.6, duration: 24 + 2 * l }),
    desc: 'A forge bellows on a tripod that roasts everything close in front of it.',
    lines: (p) => [`Fire Damage: ${p.min}-${p.max} per second`, `+${p.pct2}% Turret Life`, `Reach: ${p.range} yards`, `Lasts ${p.duration}s`],
    synergies: [{ skill: 'slag_burst', pct: 8 }, { skill: 'temper', pct: 5 }], color: '#ff8a3a', glyph: '♨', castTime: 0.8,
  },
  {
    id: 'gearwork', name: 'Gearwork', classId: 'forgewright', reqLevel: 12, prereq: ['bellows'], kind: 'passive',
    mana: () => 0, params: (l) => ({ pct: 12 * l, pct2: 15 * l }),
    desc: 'Passive: better fittings. Everything you build hits harder and stands longer.',
    lines: (p) => [`+${p.pct}% Construct Damage`, `+${p.pct2}% Construct Life`], color: '#c8b060', glyph: '⚙',
  },
  {
    id: 'brass_sentinel', name: 'Brass Sentinel', classId: 'forgewright', reqLevel: 12, prereq: ['ballista'], kind: 'construct',
    mana: (l) => 14 + l, params: (l) => ({ count: 1, pct: 15 * (l - 1), pct2: 25 * (l - 1) }),
    desc: 'Wind up a brass golem that walks beside you, follows you between areas and draws enemies to itself.',
    lines: (p) => [`+${p.pct}% Sentinel Damage`, `+${p.pct2}% Sentinel Life`, 'One at a time'], color: '#d8a848', glyph: '♜',
  },
  {
    id: 'furnace', name: 'Furnace', classId: 'forgewright', reqLevel: 18, prereq: ['gearwork'], kind: 'construct',
    mana: (l) => 12 + l, params: (l) => ({ count: 1, heal: 4 + 3 * l, pct2: 15 * (l - 1), radius: 4.5, duration: 20 + l }),
    desc: 'Set down a field furnace. Its warmth mends you, your constructs and anything else on your side that stands near it.',
    lines: (p) => [`Heals ${p.heal} life per second`, `+${p.pct2}% Furnace Life`, `Radius: ${p.radius} yards`, `Lasts ${p.duration}s`],
    synergies: [{ skill: 'temper', pct: 5 }], color: '#e86a30', glyph: '♥', castTime: 0.8,
  },
  // Heat
  {
    id: 'temper', name: 'Temper', classId: 'forgewright', reqLevel: 1, kind: 'passive',
    mana: () => 0, params: (l) => ({ pct: 20 + 8 * l, pct2: Math.min(50, 8 + 3 * l) }),
    desc: 'Passive: the hotter you run, the harder you hit. Your blows add fire damage in proportion to your Heat.',
    lines: (p) => [`Up to +${p.pct}% of weapon damage as Fire at full Heat`, `+${p.pct2}% Fire Resistance`], color: '#ff9a4a', glyph: '♁',
  },
  {
    id: 'slag_burst', name: 'Slag Burst', classId: 'forgewright', reqLevel: 6, prereq: ['temper'], kind: 'vent', element: 'fire',
    mana: () => 0, params: (l) => ({ min: 14 + 10 * l, max: 24 + 14 * l, radius: 3.2, duration: 3 }),
    desc: 'Vent all your Heat as a burst of molten slag. The more Heat, the bigger the burst; above 75 it leaves the ground burning. Costs Heat, not mana.',
    lines: (p) => [`Fire Damage: ${p.min}-${p.max} at full Heat`, `Radius: ${p.radius}-${(p.radius! + 2).toFixed(1)} yards`, 'Needs 25 Heat'],
    synergies: [{ skill: 'temper', pct: 8 }, { skill: 'white_heat', pct: 6 }], color: '#ff5a1a', glyph: '✸', castTime: 0.5,
  },
  {
    id: 'white_heat', name: 'White Heat', classId: 'forgewright', reqLevel: 18, prereq: ['slag_burst'], kind: 'buff', element: 'fire',
    mana: (l) => 10 + 0.5 * l, params: (l) => ({ duration: 6 + 0.5 * l, pct: 10 + 2 * l }),
    desc: 'Stoke yourself to full Heat and hold it there without burning. When it ends you are left at full Heat: vent it or pay for it.',
    lines: (p) => [`Full Heat for ${p.duration}s`, `+${p.pct}% Attack Speed`], color: '#fff0c0', glyph: '☼', castTime: 0.6,
  },
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export function classSkills(classId: ClassId): SkillDef[] {
  return SKILLS.filter((s) => s.classId === classId);
}

/** Damage multiplier from synergies: +pct% per hard point in each synergy skill. */
export function synergyBonus(def: SkillDef, hardPoints: Record<string, number>): number {
  let pct = 0;
  for (const s of def.synergies ?? []) pct += (hardPoints[s.skill] ?? 0) * s.pct;
  return 1 + pct / 100;
}
