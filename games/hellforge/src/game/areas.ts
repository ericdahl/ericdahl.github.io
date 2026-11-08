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
  /** Defaults to Act 1. */
  act?: 2;
  town?: boolean;
  /** Sandstorms roll through this area. */
  storm?: boolean;
}

export const AREAS: AreaDef[] = [
  {
    id: 'town', name: 'Emberwatch Camp', alvl: 0, monsters: [], packs: 0, dark: 0.25, light: 14, town: true,
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
  // ------------------------------------------------------------ Act 2: The Glass Sea
  {
    id: 'tel_maresh', name: 'Tel Maresh', alvl: 0, monsters: [], packs: 0, dark: 0.08, light: 16, town: true, act: 2,
    spec: { gen: 'town', w: 40, h: 36, theme: 'oasis', links: [{ to: 'ashfall_road', label: 'To the Ashfall Road', kind: 'path' }] },
  },
  {
    id: 'ashfall_road', name: 'The Ashfall Road', alvl: 13, monsters: ['jackal', 'scarab', 'raider', 'kite'], packs: 16, dark: 0.12, light: 13, act: 2, storm: true,
    spec: {
      gen: 'open', w: 74, h: 74, theme: 'desert', density: 0.34, waypoint: true,
      links: [
        { to: 'tel_maresh', label: 'To Tel Maresh', kind: 'path' },
        { to: 'glass_sea', label: 'To the Glass Sea', kind: 'path' },
        { to: 'whisper_cistern', label: 'Cistern of Whispers', kind: 'down' },
      ],
    },
  },
  {
    id: 'whisper_cistern', name: 'Cistern of Whispers', alvl: 15, monsters: ['scorpion', 'scarab', 'shade'], packs: 11, dark: 0.85, light: 7.5, act: 2,
    superUnique: 'skarn', quest: 'cistern',
    spec: { gen: 'rooms', w: 54, h: 54, theme: 'cistern', bossLair: true, links: [{ to: 'ashfall_road', label: 'To the Ashfall Road', kind: 'up' }] },
  },
  {
    id: 'glass_sea', name: 'The Glass Sea', alvl: 16, monsters: ['burrower', 'scarab', 'mirage', 'raider', 'kite'], packs: 18, dark: 0.2, light: 12, act: 2, storm: true,
    spec: {
      gen: 'open', w: 78, h: 78, theme: 'glass', density: 0.38, waypoint: true,
      links: [
        { to: 'ashfall_road', label: 'To the Ashfall Road', kind: 'path' },
        { to: 'buried_bazaar', label: 'The Buried Gate', kind: 'down' },
        { to: 'carrion_mesa', label: 'To Carrion Mesa', kind: 'path' },
      ],
    },
  },
  {
    id: 'carrion_mesa', name: 'Carrion Mesa', alvl: 18, monsters: ['kite', 'jackal', 'raider', 'colossus'], packs: 12, dark: 0.38, light: 11, act: 2,
    superUnique: 'karrik', quest: 'mesa',
    spec: { gen: 'open', w: 56, h: 56, theme: 'mesa', density: 0.44, links: [{ to: 'glass_sea', label: 'To the Glass Sea', kind: 'path' }] },
  },
  {
    id: 'buried_bazaar', name: 'Buried Imhara: The Bazaar', alvl: 19, monsters: ['mummy', 'acolyte', 'shade', 'scorpion'], packs: 14, dark: 0.82, light: 8, act: 2,
    spec: {
      gen: 'rooms', w: 60, h: 60, theme: 'ruins', waypoint: true,
      links: [
        { to: 'glass_sea', label: 'To the Glass Sea', kind: 'up' },
        { to: 'hall_of_dials', label: 'Buried Imhara: Hall of Dials', kind: 'down' },
      ],
    },
  },
  {
    id: 'hall_of_dials', name: 'Buried Imhara: Hall of Dials', alvl: 21, monsters: ['mummy', 'acolyte', 'mirage', 'colossus', 'shade'], packs: 15, dark: 0.86, light: 8, act: 2,
    superUnique: 'embalmer', quest: 'embalmer',
    spec: {
      gen: 'rooms', w: 62, h: 62, theme: 'ruins', waypoint: true, bossLair: true,
      links: [
        { to: 'buried_bazaar', label: 'Buried Imhara: The Bazaar', kind: 'up' },
        { to: 'noon_vault', label: 'The Noon Vault', kind: 'down' },
      ],
    },
  },
  {
    id: 'noon_vault', name: 'The Noon Vault', alvl: 22, monsters: ['acolyte', 'colossus', 'mirage', 'shade', 'mummy'], packs: 14, dark: 0.55, light: 9, act: 2,
    superUnique: 'corvin', quest: 'hollow_sun',
    spec: { gen: 'rooms', w: 60, h: 60, theme: 'vault', bossLair: true, links: [{ to: 'hall_of_dials', label: 'Buried Imhara: Hall of Dials', kind: 'up' }] },
  },
];

export const AREA_BY_ID: Record<string, AreaDef> = Object.fromEntries(AREAS.map((a) => [a.id, a]));
export const WAYPOINT_AREAS = AREAS.filter((a) => a.town || a.spec.waypoint).map((a) => a.id);

export const areaAct = (a: AreaDef): 1 | 2 => a.act ?? 1;
export const TOWN_OF_ACT: Record<1 | 2, string> = { 1: 'town', 2: 'tel_maresh' };

/** Offset added to area level per difficulty. Act 2 tops out near 24, so Nightmare has to start above it. */
export const DIFFICULTY_LEVELS = [0, 22, 36];

export interface QuestDef {
  id: string;
  name: string;
  area: string;
  intro: string;
  done: string;
  reward: string;
  /** Defaults to Act 1. */
  act?: 2;
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
    done: 'You have done what none before could. The Hellforge is cold. But the ash has not settled: it blows south, to the Glass Sea. A caravan waits at the east gate. Go to Tel Maresh and finish this. I will follow when I can.',
    reward: 'The road south opens',
  },
  {
    id: 'cistern', act: 2, name: 'The Black Water', area: 'whisper_cistern',
    intro: 'Our water comes up from the Cistern of Whispers, and for nine days it has come up black. Something has moved into the deep tanks. The drovers call it Skarn. Clear the way, and I will teach you what the old Imharans knew.',
    done: 'The water runs clear again. There was a seal at the bottom of the tank, did you see? The royal mark of Imhara. A strange thing to find down there. The queen was supposed to have fled north in shame.',
    reward: '+1 Skill Point',
  },
  {
    id: 'mesa', act: 2, name: 'The Carrion King', area: 'carrion_mesa',
    intro: 'Caravans crossing the Glass Sea are being picked clean. Karrik, the Carrion King, nests on the mesa, and his kites take the living along with the dead. One of the lost was a courier carrying a sealed ledger. Bring me what is left of it.',
    done: 'A courier\'s ledger: "Paid in northern silver by an old man with a staff of blue glass. Cargo: one lead box, hot to the touch, to be left at the Buried Gate." The same entry, the same old man, every year for a century. That cannot be right, can it?',
    reward: '+5 Stat Points',
  },
  {
    id: 'embalmer', act: 2, name: 'The Embalmer', area: 'hall_of_dials',
    intro: 'Under the glass lies Imhara, a whole city drowned in a single noon. Vizier Ohm-Tet still walks its halls, wrapping the dead and sending them up to us. Put him down. And if he will talk first, listen.',
    done: 'So that is the truth of it. She carried the star out in her own chest and shut herself in a forge to hold it. The "Mother of Cinders" was a lock. And your hand broke it, because an old man asked you to.',
    reward: '+1 Skill Point',
  },
  {
    id: 'hollow_sun', act: 2, name: 'The Hollow Sun', area: 'noon_vault',
    intro: 'Go down to the Noon Vault. Whoever has been feeding that dead star is there now, and the ash you followed here is what he feeds it. I think you already know his name.',
    done: 'It is over. The glass is cooling, for the first time since my grandmother\'s grandmother drew water here. Darker paths await the brave. I am told they always do.',
    reward: 'Next difficulty unlocked',
  },
];
export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
