# Hellforge balance report

Made by `npm run balance` from version 0.20.0: the playthrough bot (`tests/bot.ts`) plays every class through all three acts on Normal, on seeds 99, 7, 77, and the numbers below are averages over those runs.

The bot does not kite, never goes to town, hires no one and drinks a potion whenever it is hurt, so its numbers are not a player's. What they are good for is comparing the classes with each other, and comparing a change with the report before it. A class is flagged when it is out of line with the median of the classes.

To see what a change did, run it again and read the diff of this file.

## What stands out

### Likely problems

- **Huntress, Sunken Chapel**: boss survived 2 of 3 runs
- **Huntress, Sunken Chapel**: only 56% of the area cleared
- **Huntress, Catacombs Level 2**: boss survived 1 of 3 runs
- **Huntress, The Hellforge**: boss survived 1 of 3 runs
- **Reaver, Buried Imhara: Hall of Dials**: boss survived 1 of 3 runs
- **Reaver, The Noon Vault**: boss survived 1 of 3 runs
- **Arcanist, The Noon Vault**: boss survived 1 of 3 runs
- **Hiveborn, The Noon Vault**: boss survived 1 of 3 runs
- **Arcanist, The Bellfounders' Halls**: boss survived 2 of 3 runs
- **Huntress, Act 1**: 41 deaths a run, against a median of 16
- **Arcanist, Act 2**: 113 deaths a run, against a median of 23
- **Arcanist, Act 3**: 239 deaths a run, against a median of 33

### Worth a look

- Huntress, Sunken Chapel: 703s, against a median of 213s
- Huntress, Catacombs Level 2: 472s, against a median of 209s
- Huntress, The Hellforge: 469s, against a median of 245s
- Huntress, The Glass Sea: 423s, against a median of 163s
- Reaver, Buried Imhara: Hall of Dials: 654s, against a median of 347s
- Arcanist, The Bellfounders' Halls: 847s, against a median of 421s
- Huntress, Act 1: 555 potions a run, against a median of 132
- Reaver, Act 2: 517 potions a run, against a median of 203
- Necromancer, Act 2: 5 deaths a run, against a median of 23: much safer than the rest
- Forgewright, Act 3: 11 deaths a run, against a median of 33: much safer than the rest

An area left mostly uncleared can mean the bot got stuck there rather than that the class is weak: check the time it spent.

## By act

Time, deaths and potions are totals for the act. Time to kill is seconds per monster killed.

### Act 1

| Class | Time | Deaths | Potions | Time to kill | Cleared | Bosses killed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reaver | 25:40 | 29 | 258 | 3.9s | 90% | 12/12 |
| Arcanist | 18:02 | 13 | 76 | 2.7s | 91% | 12/12 |
| Huntress | 38:35 | 41 | 555 | 6.6s | 79% | 8/12 |
| Necromancer | 18:45 | 6 | 89 | 2.8s | 91% | 12/12 |
| Forgewright | 20:35 | 14 | 133 | 3.0s | 92% | 12/12 |
| Hiveborn | 20:09 | 19 | 131 | 3.0s | 92% | 12/12 |

### Act 2

| Class | Time | Deaths | Potions | Time to kill | Cleared | Bosses killed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reaver | 37:53 | 39 | 517 | 5.7s | 93% | 10/12 |
| Arcanist | 28:01 | 113 | 209 | 4.2s | 93% | 11/12 |
| Huntress | 26:03 | 33 | 367 | 4.1s | 90% | 12/12 |
| Necromancer | 15:26 | 5 | 65 | 2.3s | 94% | 12/12 |
| Forgewright | 24:00 | 12 | 194 | 3.6s | 93% | 12/12 |
| Hiveborn | 22:23 | 12 | 198 | 3.3s | 93% | 11/12 |

### Act 3

| Class | Time | Deaths | Potions | Time to kill | Cleared | Bosses killed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reaver | 31:26 | 47 | 351 | 6.8s | 93% | 9/9 |
| Arcanist | 42:37 | 239 | 314 | 9.7s | 88% | 7/9 |
| Huntress | 29:05 | 66 | 328 | 6.2s | 94% | 9/9 |
| Necromancer | 22:08 | 17 | 81 | 5.2s | 87% | 9/9 |
| Forgewright | 21:25 | 11 | 150 | 4.7s | 92% | 9/9 |
| Hiveborn | 21:55 | 19 | 153 | 4.8s | 93% | 9/9 |

## By area

Each cell is time in the area / deaths / potions. A dagger marks a boss that survived at least one run.

| Area | Level in | Reaver | Arcanist | Huntress | Necromancer | Forgewright | Hiveborn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cinder Fields | 1 | 2:57 / 0.3 / 30 | 2:13 / 0.7 / 11 | 2:38 / 0 / 17 | 2:20 / 0.3 / 16 | 2:43 / 0.3 / 19 | 2:12 / 0 / 13 |
| Hollow Cave | 3.1 | 2:30 / 1 / 25 | 1:28 / 0.3 / 3.7 | 2:19 / 1.3 / 17 | 1:52 / 0.7 / 11 | 2:42 / 3.3 / 22 | 1:53 / 0 / 12 |
| Gloomwood | 5.3 | 2:43 / 0.3 / 15 | 2:30 / 0.3 / 6 | 2:35 / 0.3 / 20 | 2:22 / 0 / 8.3 | 2:35 / 0 / 8.3 | 2:26 / 0 / 8 |
| Sunken Chapel | 7.3 | 4:32 / 12 / 41 | 2:37 / 3.3 / 13 | 11:43 / 11 / 224 † | 3:06 / 2.7 / 20 | 3:45 / 6.3 / 26 | 3:21 / 10 / 25 |
| Catacombs Level 1 | 9.9 | 3:38 / 3 / 35 | 1:49 / 0.3 / 6 | 3:40 / 9 / 42 | 2:53 / 1 / 16 | 2:28 / 1 / 17 | 2:55 / 2.7 / 21 |
| Catacombs Level 2 | 13 | 5:04 / 4.3 / 70 | 2:47 / 2.7 / 13 | 7:52 / 12 / 143 † | 3:29 / 1 / 12 | 3:06 / 2 / 24 | 3:29 / 2.3 / 25 |
| The Hellforge | 16 | 4:16 / 7.7 / 41 | 4:37 / 5.7 / 23 | 7:49 / 6.3 / 93 † | 2:44 / 0.3 / 7 | 3:16 / 1 / 19 | 3:54 / 3.3 / 27 |
| The Ashfall Road | 19 | 1:49 / 0 / 13 | 1:53 / 0.3 / 3.7 | 1:52 / 0.3 / 18 | 1:45 / 0 / 5.7 | 1:38 / 0 / 3.7 | 1:33 / 0 / 6 |
| Cistern of Whispers | 21 | 2:56 / 0.3 / 38 | 2:23 / 2.7 / 12 | 2:03 / 1 / 20 | 1:33 / 0.3 / 5.7 | 1:47 / 0.3 / 12 | 1:47 / 0 / 14 |
| The Glass Sea | 23 | 3:39 / 0.3 / 46 | 2:53 / 3.3 / 10 | 7:03 / 6.7 / 141 | 2:14 / 0.3 / 11 | 2:30 / 0.3 / 21 | 2:32 / 0.3 / 18 |
| Carrion Mesa | 25 | 4:37 / 0.3 / 64 | 2:36 / 2 / 12 | 2:53 / 2.3 / 32 | 1:53 / 0.7 / 7 | 3:22 / 1 / 32 | 2:34 / 0.7 / 19 |
| Buried Imhara: The Bazaar | 27 | 3:50 / 1.7 / 51 | 2:41 / 5.3 / 16 | 2:14 / 1.7 / 22 | 1:39 / 0 / 5.7 | 2:21 / 0.3 / 12 | 2:08 / 0.3 / 11 |
| Buried Imhara: Hall of Dials | 28 | 10:54 / 18 / 154 † | 7:00 / 23 / 55 | 5:52 / 17 / 74 | 2:49 / 1.3 / 11 | 5:42 / 3.3 / 50 | 4:09 / 1.7 / 33 |
| The Noon Vault | 31 | 10:07 / 18 / 150 † | 8:34 / 76 / 100 † | 4:07 / 4.3 / 61 | 3:34 / 2.3 / 19 | 6:40 / 6.7 / 63 | 7:39 / 8.7 / 97 † |
| Rimefall Pass | 33 | 5:07 / 4.7 / 51 | 3:32 / 5.7 / 16 | 3:52 / 3.3 / 45 | 2:26 / 0.7 / 7.7 | 3:09 / 1 / 17 | 3:09 / 1 / 20 |
| The Drowned Mines | 35 | 7:28 / 19 / 82 | 9:25 / 45 / 57 | 6:08 / 21 / 70 | 2:15 / 1 / 4.7 | 4:53 / 3.3 / 34 | 5:16 / 6.3 / 41 |
| The Bellfounders' Halls | 37 | 6:49 / 9.7 / 82 | 14:07 / 121 / 146 † | 8:12 / 13 / 90 | 7:13 / 5.7 / 39 | 4:59 / 1 / 41 | 5:44 / 4 / 42 |
| The Cold Furnace | 40 | 4:39 / 3.3 / 51 | 5:41 / 24 / 39 | 4:09 / 9 / 46 | 6:38 / 0.7 / 15 | 3:26 / 1.7 / 23 | 2:53 / 1 / 14 |
| The Hellforge's Heart | 41 | 7:23 / 11 / 85 | 9:53 / 43 / 57 | 6:44 / 20 / 77 | 3:36 / 9 / 16 | 4:58 / 4 / 36 | 4:53 / 6.7 / 36 |
