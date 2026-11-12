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
  act?: 2 | 3;
  town?: boolean;
  /** Sandstorms roll through this area. */
  storm?: boolean;
  /** The cold is loose here: the ember burns down, and frostbite follows once it is out. */
  cold?: boolean;
  /** Whiteouts roll through this area, and the ember burns down faster while they last. */
  blizzard?: boolean;
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
  // ------------------------------------------------------------ Act 3: The Ember Road
  {
    id: 'emberwatch_ruins', name: 'Emberwatch Ruins', alvl: 0, monsters: [], packs: 0, dark: 0.5, light: 13, town: true, act: 3,
    spec: { gen: 'town', w: 40, h: 36, theme: 'snowtown', links: [{ to: 'rimefall_pass', label: 'To Rimefall Pass', kind: 'path' }] },
  },
  {
    id: 'rimefall_pass', name: 'Rimefall Pass', alvl: 25, monsters: ['rime_thrall', 'rime_hound', 'snow_shade', 'hearth_eater', 'frozen_bowman'], packs: 19, dark: 0.5, light: 11, act: 3,
    cold: true, blizzard: true, quest: 'beacons',
    spec: {
      gen: 'open', w: 80, h: 80, theme: 'snow', density: 0.36, waypoint: true,
      links: [
        { to: 'emberwatch_ruins', label: 'To Emberwatch Ruins', kind: 'path' },
        { to: 'bellfounders_halls', label: "The Founders' Gate", kind: 'down' },
        { to: 'drowned_mines', label: 'The Drowned Mines', kind: 'down' },
      ],
    },
  },
  {
    id: 'drowned_mines', name: 'The Drowned Mines', alvl: 27, monsters: ['frozen_miner', 'rime_thrall', 'slag_golem', 'snow_shade', 'frozen_bowman'], packs: 15, dark: 0.86, light: 8, act: 3,
    cold: true, superUnique: 'frostwright', quest: 'frostwright',
    spec: { gen: 'rooms', w: 62, h: 62, theme: 'icemine', bossLair: true, links: [{ to: 'rimefall_pass', label: 'To Rimefall Pass', kind: 'up' }] },
  },
  {
    id: 'bellfounders_halls', name: "The Bellfounders' Halls", alvl: 29, monsters: ['bellwarden', 'slag_golem', 'frozen_miner', 'hearth_eater', 'frozen_bowman'], packs: 17, dark: 0.84, light: 8, act: 3,
    cold: true, superUnique: 'echo', quest: 'phylactery',
    spec: {
      gen: 'rooms', w: 66, h: 66, theme: 'foundry', waypoint: true, bossLair: true,
      links: [
        { to: 'rimefall_pass', label: 'To Rimefall Pass', kind: 'up' },
        { to: 'cold_furnace', label: 'The Cold Furnace', kind: 'down' },
      ],
    },
  },
  {
    id: 'cold_furnace', name: 'The Cold Furnace', alvl: 31, monsters: ['slag_golem', 'bellwarden', 'hearth_eater', 'rime_thrall', 'snow_shade'], packs: 17, dark: 0.88, light: 8, act: 3,
    cold: true,
    spec: {
      gen: 'rooms', w: 64, h: 64, theme: 'furnace', waypoint: true,
      links: [
        { to: 'bellfounders_halls', label: "The Bellfounders' Halls", kind: 'up' },
        { to: 'hellforge_heart', label: "The Hellforge's Heart", kind: 'down' },
      ],
    },
  },
  {
    id: 'hellforge_heart', name: "The Hellforge's Heart", alvl: 32, monsters: ['hearth_eater', 'rime_thrall', 'slag_golem', 'bellwarden', 'snow_shade'], packs: 15, dark: 0.8, light: 8.5, act: 3,
    cold: true, superUnique: 'unlit', quest: 'rekindle',
    spec: { gen: 'rooms', w: 62, h: 62, theme: 'heart', bossLair: true, links: [{ to: 'cold_furnace', label: 'The Cold Furnace', kind: 'up' }] },
  },
];

export const AREA_BY_ID: Record<string, AreaDef> = Object.fromEntries(AREAS.map((a) => [a.id, a]));
export const WAYPOINT_AREAS = AREAS.filter((a) => a.town || a.spec.waypoint).map((a) => a.id);

export type Act = 1 | 2 | 3;
export const areaAct = (a: AreaDef): Act => a.act ?? 1;
export const TOWN_OF_ACT: Record<Act, string> = { 1: 'town', 2: 'tel_maresh', 3: 'emberwatch_ruins' };
export const ACT_NAMES: Record<Act, string> = { 1: 'The Hellforge', 2: 'The Glass Sea', 3: 'The Ember Road' };

/** Offset added to area level per difficulty. Act 3 tops out near 33, so Nightmare has to start above it. */
export const DIFFICULTY_LEVELS = [0, 32, 42];

export interface QuestDef {
  id: string;
  name: string;
  area: string;
  intro: string;
  done: string;
  reward: string;
  /** Defaults to Act 1. */
  act?: 2 | 3;
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
    done: 'It is over. The glass is cooling, for the first time since my grandmother\'s grandmother drew water here. But open your hand. That ember is cooling too, and there is frost on the letters from the north. Dov will take you. Go home.',
    reward: 'The road north opens',
  },
  {
    id: 'beacons', act: 3, name: 'The Ember Road', area: 'rimefall_pass',
    intro: 'The old watch kept braziers all the way up Rimefall Pass, a fire in sight of a fire, so that no one walked it cold. They are all out. Light every one of them. You will need the road, and so will whoever comes down it after you.',
    done: 'I can see them from here. A line of lights going up into the dark, like it used to be. Sit a moment. This is the trick the watch knew: stand in the firelight and the cold cannot find you, however thin that ember gets.',
    reward: '+1 Skill Point',
  },
  {
    id: 'frostwright', act: 3, name: 'The Frostwright', area: 'drowned_mines',
    intro: 'The imps we fought all my life were sparks. What comes down the pass now is ice in the same shape, and somebody is making them. The miners say there is a forge lit blue at the bottom of the Drowned Mines, and a smith at it who does not stop. Stop him.',
    done: 'A Bellfounder, alive since the pouring? Then it is true the forge is a bell. Set the ember at the lip, he said. Corvin\'s books say the bowl. Corvin\'s books say a great many things, and I have stopped believing the handwriting.',
    reward: '+5 Stat Points',
  },
  {
    id: 'phylactery', act: 3, name: 'The Last Phylactery', area: 'bellfounders_halls',
    intro: 'There is a bell ringing under the mountain. The founders are four hundred years dead and the wardens they left have no hands to ring it. I know that note. He used to hum it over his books. Whatever is left of my master is in those halls. Break it.',
    done: 'So that is the last of him. I kept waiting to feel something. He taught me my letters, you know. He taught me them so I could copy out his lies in a fair hand. Go on down. I will keep this fire.',
    reward: '+1 Skill Point',
  },
  {
    id: 'rekindle', act: 3, name: 'Keep It Lit', area: 'hellforge_heart',
    intro: 'Past the Cold Furnace is the Heart, where you killed her. Something is waiting in the bowl, and it wants that ember more than you do. If the ember goes out down there, it will not be a monster you have made. It will be a winter. Bring the fire home.',
    done: 'We heard the bell. All of us, the whole camp, in the middle of the night, and then the snow turned to rain. Darker paths await the brave. They always do. But you will not walk them cold.',
    reward: 'Next difficulty unlocked',
  },
];
export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
