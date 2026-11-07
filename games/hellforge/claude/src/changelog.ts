/** Player-facing release notes, newest first. Shown from the version link on the title screen. */
export const CHANGELOG: { version: string; date: string; notes: string[] }[] = [
  {
    version: '0.5.0',
    date: '2026-11-07',
    notes: [
      'Music: a generated score for every area, from a lute by the camp fire to war drums in the Hellforge. Drums build as fights get heavier, and a heartbeat sets in when your life runs low.',
      'Ambient sound: crackling fires, wind, owls, cave drips, distant bells, rattling chains and whispers, and rumbles from deep below.',
      'Weather: falling ash and drifting embers in the Cinder Fields, leaves and fog in Gloomwood, drips and dust underground, a storm of embers in the Hellforge.',
      'The screen edges frost over when you are chilled, turn green when poisoned and pulse red near death.',
      'New Music and Weather effects switches in the menu.',
    ],
  },
  {
    version: '0.4.2',
    date: '2026-11-07',
    notes: [
      'Inventory: worn gear sits in its own Equipped box, apart from the Backpack.',
      'Selecting gear shows it side by side with what you wear in that slot, plus every stat that would change if you equip it (green for better, red for worse). Works in the inventory, at vendors and in the stash.',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-11-07',
    notes: [
      'Item shortcuts on desktop: hover an item and press E to equip or unequip, U to use, S to sell, B to buy, D to drop, X to move between stash and inventory, or G to socket a gem (R equips a ring on the right hand).',
      'Right-click an item for its main action. Item buttons show their key.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-11-07',
    notes: [
      'New class: the Necromancer. Raise skeletons from corpses, shape a Grave Golem, curse foes with Mark of Frailty, detonate corpses and hurl bone.',
      'Ten new skills: Raise Skeleton, Bone Shards, Mark of Frailty, Skeletal Mastery, Bone Ward, Corpse Burst, Blight Nova, Grave Golem, Bone Lance and Bone Storm.',
      'New loot: Gravecaller\'s items (+1 Necromancer skills) and the unique wand Marrowcall.',
      'Boss kills now always include their promised magic items.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-07',
    notes: ['Tap the version number on the title screen to see what changed.'],
  },
  {
    version: '0.2.0',
    date: '2026-11-07',
    notes: [
      'Export / Import on the title screen: move heroes to another device with a save file or a copy/paste save code.',
      'The game version is shown on the title screen.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-03',
    notes: ['First release: three classes, seven areas, four bosses, Nightmare and Hell difficulties, hardcore mode.'],
  },
];
