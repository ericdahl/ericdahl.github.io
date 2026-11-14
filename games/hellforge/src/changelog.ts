/** Player-facing release notes, newest first. Shown from the version link on the title screen. */
export const CHANGELOG: { version: string; date: string; notes: string[] }[] = [
  {
    version: '0.18.0',
    date: '2026-11-14',
    notes: [
      'A shared stash. The stash in town now has two tabs: your hero\'s own, and one that every hero on this device can reach. Leave a bow for your Huntress with your Reaver and she will find it there.',
      'The shared stash holds gold as well as items, and is as big as a hero\'s own. Hardcore heroes share one of their own, apart from everyone else\'s.',
      'It travels with Export / Import. If the device you import onto already has things in its shared stash, you are asked before they are replaced.',
      'The sage identifies what is in the shared stash along with everything else.',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-11-14',
    notes: [
      'Hirelings. A captain now stands in every town and will hire out one companion to walk with you.',
      'Three to choose from. The Shieldbearer is tough and fights up close. The Bowman shoots from behind you. The Ember-Keeper throws fire, sets monsters alight, and is a little warm to stand beside on the Ember Road.',
      'A companion fights at your level and grows as you do, follows you between areas and through portals, and mends between fights and in town. Monsters will turn on them as they do on any servant.',
      'If they fall, any captain will bring them back for a fee, a good deal less than hiring anew. Your own death does not cost you your companion.',
      'Their name and how hurt they are show above your life orb. Hiring another kind replaces the one you have.',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-11-14',
    notes: [
      'Respec. Each difficulty you finish earns one respec: Normal, Nightmare and Hell, three in all. Heroes who have already finished a difficulty have theirs waiting.',
      'Spend it from the Character or Skills panel. Every skill point and attribute point comes back to be placed again; your gear, level and quests are untouched. It asks twice first.',
      'Skeletons, golems, turrets and standing spells made with your old skills are dismissed when you respec. Shrine blessings stay.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-11-14',
    notes: [
      'The Underforge: an endless dungeon under the Hellforge\'s Heart. Finish the Ember Road and it opens at every waypoint, on each difficulty in turn.',
      'Every floor is rolled fresh: a crypt, a cistern, a frozen mine or a storm of glass, with monsters from all three acts. Each floor is one level harder than the last, and elite packs grow thicker the deeper you go.',
      'A warden holds the stairs. Kill it and the way down opens; it shows on the automap once you are close. Every fifth floor belongs to a boss you have met before, risen again.',
      'Afflictions. From the third floor down, everything on a floor shares a modifier (Extra Fast, Extra Strong, Stone Skin and others), then two, then three.',
      'The deeper the floor, the better the dead pay: magic find and gold find rise with depth, every warden drops like an elite, and each one leaves Cinders for the Forge.',
      'Clear a boss floor and your next descent can start from the floor below it. Your deepest floor is kept on the character sheet.',
      'Cold floors bring the ember and braziers with them, and glass floors their sandstorms. A town portal still takes you home and back, and climbing out leads to Emberwatch Ruins.',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-11-12',
    notes: [
      'The Forge. A forge now stands beside the blacksmith in every town. Walk up to it (or ask the smith) to improve the gear you want to keep with the loot you do not.',
      'Salvage breaks an item into Cinders. Magic and better items also give Essences of Fire, Cold, Lightning or Poison, matching the element they carried. One button salvages every plain item in your backpack.',
      'Heat spends Cinders to add a forge level, up to +10. Each level adds 4% to a weapon\'s base damage or an armor\'s defense, and the item is shown as "+7 War Axe"; from +7 it throws sparks. Heating cannot fail up to +5. From +6 it can, and a failure cracks the item back one level. For Hardcore heroes a failed heat to +8 or beyond can shatter the item for good, and the forge asks twice first.',
      'Strike by hand, if you like: a hammer-timing game that adds up to 10% to the chance when you strike while the metal glows white. It never costs anything to miss or skip, it waits as long as you need, and it works by tap, click or the Space bar.',
      'Temper re-rolls one affix of your choice for gold and Cinders. Quench spends an Essence to add elemental damage to a weapon or a resistance to armor and jewelry, or to convert the one already there. Ember-Seal locks one affix so tempering cannot touch it; it is expensive.',
      'Smelt three items of the same type and rarity into one of the next rarity: plain to magic, magic to rare, and, for a master, rare to a unique or set piece.',
      'Forge mastery grows with every job. Each rank makes work a little cheaper and heats a little likelier, and ranks teach socket punching, Ember-Seal and smelting legends. Forgewrights pay less and fail less at the forge.',
      'Once you carry Vhorza\'s ember, the forge burns white, heats succeed more often, sealing costs half, and she has a few words for your best work.',
      'With a mouse, hover an item at the forge and press H heat, J strike by hand, T temper, Q quench, L ember-seal, P punch socket, M crucible or S salvage.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-11-12',
    notes: [
      'A fifth class: the Forgewright, a smith-warden who fights with a great two-handed hammer and builds things mid-fight. Pick one on the New Hero screen.',
      'Hammer skills. Sunder cracks armor so the target takes more physical damage, Anvil Drop brings an anvil down out of the smoke to crush and stun, Shockwave throws back everything in front of you, and Earthshaker sends out three widening tremors.',
      'Constructs. A Ballista Turret shoots whatever comes in range (up to three at once), a Bellows Turret roasts what stands in front of it, and a Furnace mends you and everything on your side that stands near it. Turrets and furnaces stay where you build them and wind down after a while. The Brass Sentinel is a wind-up golem that walks with you, follows you between areas and draws enemies to itself. Monsters attack all of them, and Gearwork makes them tougher.',
      'Heat. Every hammer blow that lands builds Heat, shown on a gauge above the experience bar. With Temper, the hotter you are the more fire your blows carry. Slag Burst spends all of it in one blast, bigger the more you had, and above 75 it leaves the ground burning. Reach 100 and you overheat: you burn until you cool below 60 or vent. White Heat holds you at full Heat without burning for a few seconds, then leaves you there.',
      'On the Ember Road, a Furnace warms the ember like a brazier, and a smith running at 75 Heat or more keeps a little of the cold off.',
      'New gear: two-handed hammers (Sledge, War Hammer, Great Maul, Obsidian Maul), which any melee class can swing; four Forgewright uniques; the Emberwright\'s Harness set; and "Smith\'s" items that add to Forgewright skills.',
      'Skill buttons for constructs show how many are standing against the limit, and Slag Burst greys out until there is enough Heat to vent.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-11-12',
    notes: [
      'Act 3: The Ember Road. The ember Vhorza left you is dying, and the cold she held back for four hundred years is loose. Finish Act 2 and the caravan will take you north, to what is left of Emberwatch under the snow.',
      'Five new areas with their own art, music and weather: Rimefall Pass, the frozen Drowned Mines, the Bellfounders\' Halls, the Cold Furnace and the Hellforge\'s Heart. Four new quests, and an ending.',
      'Warmth. In the cold your ember burns down, and its light shrinks with it. Once it is out, frostbite builds: first it slows you, then it wounds. Walk up to a brazier to light it and stand in its glow to refill the ember. Fire skills, burning blades and burning monsters keep you warm too. A meter under the area name shows how much heat you have left.',
      'Whiteouts roll down Rimefall Pass and burn the ember down faster. Light every beacon on the pass for Wren and she will teach you something.',
      'Rime-Thralls burst into shards of ice that sap your ember, unless you burn them. Bellwardens raise a bell and ring a shockwave that you have to dodge-roll through. Slag Golems turn molten in fire and firelight (stronger, faster) and brittle when chilled. Hearth-Eaters drink your ember from a distance, but cannot while you stand by a fire.',
      'Three new bosses. The Frostwright\'s cold snap spares only those sheltering at a lit brazier. Corvane\'s Echo cannot be hurt until you break his phylactery. And the Unlit, in the heart of the forge, snuffs out fires and feeds whenever your ember is dark.',
      'New gear for Act 3: fourteen new weapons and armours, ten uniques and a five-piece set, the Vigil of the Ember Road.',
      'Nightmare and Hell now unlock at the end of Act 3, and both are harder. Heroes who already unlocked them keep them.',
    ],
  },
  {
    version: '0.11.2',
    date: '2026-11-12',
    notes: ['Holding a skill button on a phone no longer pops up the skills panel in the middle of a fight. Skills are assigned from the Skills panel.'],
  },
  {
    version: '0.11.1',
    date: '2026-11-12',
    notes: [
      'Smoother on phones, most of all in long fights and on 120 Hz screens. Corpses no longer cost anything to keep on screen, the automap only redraws when you explore, and fast displays no longer draw every moment twice.',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-11-11',
    notes: [
      'Dodge roll. Press Space (or the new ➠ button) to roll out of danger. Nothing can hit you mid-roll, and it cuts short a swing or a cast.',
      'Killing sprees. Kill quickly and a counter starts to climb: Killing Spree, Rampage, Massacre and beyond. Each rank makes you run faster, makes kills worth more experience, and gives you back some life and mana.',
      'Soul orbs. The dead sometimes leave a red or blue orb behind. Walk over it to restore life or mana (and mend your servants). Elites and bosses always drop them.',
      'The Tithe Imp. A golden imp with a sack of loot may be hiding in any area. It never fights. It runs, shedding gold with every blow, and opens a portal after fifteen seconds. Kill it first for the jackpot.',
      'Four new shrines. Storm strikes nearby monsters with lightning, Fortune makes the dead give up more gold and better items, Fleet speeds you up, and the purple Cursed Shrine calls three waves of ambushers and pays out a hoard if you survive.',
      'Three new elite modifiers. Lightning Enchanted monsters throw sparks when struck, Teleporters blink to your side, and Bombardiers mark the ground before fire rains on it.',
      'Purge an area. Kill everything in an area for bonus experience and a pile of loot. The last five monsters show on the automap so you can find them.',
      'Shrine blessings now show their time left above your life orb, and the character sheet records your longest spree, imps caught and areas purged.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-11-09',
    notes: [
      'Every character has been redrawn: shaded, outlined and far more detailed, with faces, hands, boots and proper weapons.',
      'Your hero now wears what you equip. Quilted, leather, studded, mail, scale and plate armour each look different, as do caps, helms, great helms, circlets and round, heater, kite and tower shields. Magic, rare, set and unique weapons glow.',
      'Weapons swing properly: a wind-up over the shoulder, a strike, and a recovery. Bows are drawn with an arrow on the string.',
      'All monsters and bosses have new bodies, from the imps\' horns and tails to the Salt Colossus\'s crystal facets. Monsters that shared a body now look like themselves: Dust Jackals, Grave Golems, Glassbound Shades, Skarn, Karrik and the Embalmer all have their own look.',
      'Townsfolk got makeovers too, and hit flashes, chill, poison and charred corpses now tint the whole figure cleanly.',
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
