/** Player-facing release notes, newest first. Shown from the version link on the title screen. */
export const CHANGELOG: { version: string; date: string; notes: string[] }[] = [
  {
    version: '0.9.2',
    date: '2026-11-09',
    notes: [
      'Dying now costs your gold (and experience on Nightmare and Hell) right away. Reloading the page at the death screen no longer skips the penalty.',
      'Big monsters and bosses no longer sometimes spawn wedged against a wall, frozen in place for the whole fight.',
      'Big monsters and bosses can no longer walk through pillars and thin walls.',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-11-09',
    notes: ['The stash no longer spills over your backpack. On narrow screens the backpack now sits below the stash instead.'],
  },
  {
    version: '0.9.0',
    date: '2026-11-08',
    notes: [
      'Act 2: The Glass Sea. Vhorza\'s fire did not die with her. Kill her and a caravan will carry you south to Tel Maresh, a new town at the edge of a desert melted to glass.',
      'Seven new areas with their own art, music and weather, from the Ashfall Road to the buried city of Imhara, plus four new quests and a story that changes what you thought you knew.',
      'Eleven new monsters with rules of their own. Burn the Embalmed Dead or they get back up. Look for the shadow to find the real Mirage Dancer. Kill the Noon Acolyte before she wards the rest.',
      'Four new bosses that change as you wound them, with attacks marked on the ground before they land.',
      'Sandstorms close in your vision, but monsters cannot see you as far either. Quicksand slows everything that walks through it.',
      'New gear for Act 2: new weapons and armor, eight uniques and a new set.',
      'Nightmare and Hell are harder, and the next difficulty now unlocks at the end of Act 2.',
    ],
  },
  {
    version: '0.8.2',
    date: '2026-11-08',
    notes: ['Rare items now land with a golden beam of light and their own chime, so they stand out from the rest of the loot.'],
  },
  {
    version: '0.8.1',
    date: '2026-11-08',
    notes: ['Loot you have no room for now hops back up with a dull thud when you try to pick it up.'],
  },
  {
    version: '0.8.0',
    date: '2026-11-08',
    notes: [
      'Four new item sets, one for each class: Cinderguard Battlegear (Reaver), Starweave Vestments (Arcanist), Thornstalker\'s Kit (Huntress) and Bonewright\'s Shroud (Necromancer).',
      'Wearing all four pieces of your class\'s set grants +2 to your class skills, on top of its 2- and 3-piece bonuses.',
      'Set pieces made for your class drop more often than the others.',
    ],
  },
  {
    version: '0.7.3',
    date: '2026-11-08',
    notes: ['New uniques: Ironwrath, a war axe for the Reaver (+2 Reaver skills), and Cryptkeeper\'s Shroud, armor for the Necromancer (+1 Necromancer skills).'],
  },
  {
    version: '0.7.2',
    date: '2026-11-08',
    notes: ['Skill bonuses for another class are now dimmed and marked "(no effect)" on items, so gear no longer looks better than it is.'],
  },
  {
    version: '0.7.1',
    date: '2026-11-08',
    notes: [
      'If an item only fits after moving things around, your backpack or stash now rearranges itself to make room.',
      'New Sort button on the backpack and stash packs everything neatly.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-11-08',
    notes: [
      'Potions no longer take up your backpack. Key 1 drinks health, 2 drinks mana and 3 drinks rejuvenation, and each draws from its own supply.',
      'Each key drinks the smallest potion that covers what you are missing, or the strongest if none does. Hover or long-press a slot to see what you are carrying.',
      'Your belt now sets how many potions of each type you can carry: 8 without one, up to 20. When you are full, better potions replace your weakest.',
      'Existing heroes are converted automatically and keep every potion they had in their belt and backpack. Potions in the stash stay there until you withdraw them.',
    ],
  },
  {
    version: '0.6.1',
    date: '2026-11-08',
    notes: [
      'Hollow Cave: once five or fewer creatures remain, the area name shows how many are left and the automap marks them in gold, wherever they are.',
      'Necromancer: the Raise Skeleton button shows how many skeletons you have against your maximum, and turns green when you are at the cap.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-11-07',
    notes: [
      'Heavier hits: critical strikes and huge blows land with a brief freeze frame and a jolt, and crit numbers pop up large in gold.',
      'Monsters die by how you killed them: frozen ones shatter (and leave no corpse), burned ones char and smoulder, lightning crackles over them, poison melts them into a puddle, and huge physical overkills burst apart.',
      'Bosses flash the screen in the colour of the attack they are about to unleash, and their deaths land with a long freeze, a white flash and a big shake.',
      'New Shake & flashes switch in the menu turns off shaking, flashes and freeze frames.',
    ],
  },
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
