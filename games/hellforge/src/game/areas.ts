import type { LevelSpec } from './map';

export interface AreaDef {
  id: string;
  name: string;
  alvl: number;
  spec: LevelSpec;
  monsters: string[];
  /** Number of monster packs to place. */
  packs: number;
  /** Ambient darkness 0..1 and the player's light radius in tiles. */
  dark: number;
  light: number;
  superUnique?: string;
  quest?: string;
}

export const AREAS: AreaDef[] = [
  {
    id: 'town', name: 'Emberwatch Camp', alvl: 0, monsters: [], packs: 0, dark: 0.25, light: 14,
    spec: { gen: 'town', w: 40, h: 36, theme: 'town', links: [{ to: 'cinder_fields', label: 'To Cinder Fields', kind: 'path' }] },
  },
  {
    id: 'cinder_fields', name: 'Cinder Fields', alvl: 1, monsters: ['imp', 'hexer', 'ghoul'], packs: 16, dark: 0.45, light: 10,
    spec: {
      gen: 'open', w: 72, h: 72, theme: 'fields', density: 0.36, waypoint: true,
      links: [
        { to: 'town', label: 'To Emberwatch Camp', kind: 'path' },
        { to: 'gloomwood', label: 'To Gloomwood', kind: 'path' },
        { to: 'hollow_cave', label: 'Hollow Cave', kind: 'down' },
      ],
    },
  },
  {
    id: 'hollow_cave', name: 'Hollow Cave', alvl: 3, monsters: ['bat', 'imp', 'ghoul', 'hexer'], packs: 11, dark: 0.85, light: 7.5,
    superUnique: 'glutton', quest: 'hollow',
    spec: { gen: 'open', w: 50, h: 50, theme: 'cave', density: 0.46, links: [{ to: 'cinder_fields', label: 'To Cinder Fields', kind: 'up' }] },
  },
  {
    id: 'gloomwood', name: 'Gloomwood', alvl: 4, monsters: ['hound', 'imp', 'hexer', 'bat', 'ghoul'], packs: 18, dark: 0.62, light: 9,
    spec: {
      gen: 'open', w: 76, h: 76, theme: 'forest', density: 0.42, waypoint: true,
      links: [
        { to: 'cinder_fields', label: 'To Cinder Fields', kind: 'path' },
        { to: 'catacombs1', label: 'Catacombs Level 1', kind: 'down' },
        { to: 'sunken_chapel', label: 'Sunken Chapel', kind: 'down' },
      ],
    },
  },
  {
    id: 'sunken_chapel', name: 'Sunken Chapel', alvl: 6, monsters: ['skeleton', 'archer', 'wraith', 'ghoul'], packs: 12, dark: 0.85, light: 7.5,
    superUnique: 'bishop', quest: 'bishop',
    spec: { gen: 'rooms', w: 56, h: 56, theme: 'chapel', bossLair: true, links: [{ to: 'gloomwood', label: 'To Gloomwood', kind: 'up' }] },
  },
  {
    id: 'catacombs1', name: 'Catacombs Level 1', alvl: 8, monsters: ['skeleton', 'archer', 'wraith', 'cultist'], packs: 14, dark: 0.88, light: 7.5,
    spec: {
      gen: 'rooms', w: 60, h: 60, theme: 'crypt', waypoint: true,
      links: [
        { to: 'gloomwood', label: 'To Gloomwood', kind: 'up' },
        { to: 'catacombs2', label: 'Catacombs Level 2', kind: 'down' },
      ],
    },
  },
  {
    id: 'catacombs2', name: 'Catacombs Level 2', alvl: 10, monsters: ['wraith', 'cultist', 'brute', 'skeleton', 'archer'], packs: 15, dark: 0.9, light: 7.5,
    superUnique: 'warden',
    spec: {
      gen: 'rooms', w: 62, h: 62, theme: 'crypt', waypoint: true, bossLair: true,
      links: [
        { to: 'catacombs1', label: 'Catacombs Level 1', kind: 'up' },
        { to: 'hellforge', label: 'The Hellforge', kind: 'down' },
      ],
    },
  },
  {
    id: 'hellforge', name: 'The Hellforge', alvl: 12, monsters: ['hound', 'cultist', 'brute', 'imp', 'hexer'], packs: 14, dark: 0.7, light: 8,
    superUnique: 'mother', quest: 'forge',
    spec: { gen: 'rooms', w: 60, h: 60, theme: 'hell', bossLair: true, links: [{ to: 'catacombs2', label: 'Catacombs Level 2', kind: 'up' }] },
  },
];

export const AREA_BY_ID: Record<string, AreaDef> = Object.fromEntries(AREAS.map((a) => [a.id, a]));
export const WAYPOINT_AREAS = AREAS.filter((a) => a.id === 'town' || a.spec.waypoint).map((a) => a.id);

/** Offset added to area level per difficulty. */
export const DIFFICULTY_LEVELS = [0, 16, 32];

export interface QuestDef {
  id: string;
  name: string;
  area: string;
  intro: string;
  done: string;
  reward: string;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'hollow', name: 'The Hollow Cave', area: 'hollow_cave',
    intro: 'Something foul has nested in the Hollow Cave beyond the Cinder Fields. Our scouts no longer return. Purge every creature within, and I will teach you a secret of your craft.',
    done: 'The cave is quiet at last. As promised, a secret of your craft.',
    reward: '+1 Skill Point',
  },
  {
    id: 'bishop', name: 'The Drowned Bishop', area: 'sunken_chapel',
    intro: 'The old chapel in Gloomwood sank into the marsh a century ago, taking its bishop with it. He did not rest. Put him down and take his blessing for yourself.',
    done: 'The Bishop is gone. Drink this; his stolen blessing now strengthens you.',
    reward: '+5 Stat Points',
  },
  {
    id: 'forge', name: 'Mother of Cinders', area: 'hellforge',
    intro: 'Beneath the Catacombs lies the Hellforge, where Vhorza, Mother of Cinders, births the imps that plague this land. Descend, and end her.',
    done: 'You have done what none before could. The Hellforge is cold... for now. Darker paths await the brave.',
    reward: 'Next difficulty unlocked',
  },
];
export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
