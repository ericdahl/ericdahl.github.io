# Hellforge balance report

Made by `npm run balance` from version 0.18.0: the playthrough bot (`tests/bot.ts`) plays every class through all three acts on Normal, on seeds 99, 7, 77, and the numbers below are averages over those runs.

The bot does not kite, never goes to town, hires no one and drinks a potion whenever it is hurt, so its numbers are not a player's. What they are good for is comparing the classes with each other, and comparing a change with the report before it. A class is flagged when it is out of line with the median of the classes.

To see what a change did, run it again and read the diff of this file.

## What stands out

### Likely problems

- **Huntress, Sunken Chapel**: boss survived 1 of 3 runs
- **Huntress, Catacombs Level 1**: only 52% of the area cleared
- **Huntress, Catacombs Level 2**: boss survived 2 of 3 runs
- **Forgewright, The Hellforge**: boss survived 1 of 3 runs
- **Arcanist, The Noon Vault**: boss survived 2 of 3 runs
- **Huntress, The Noon Vault**: boss survived 1 of 3 runs
- **Arcanist, The Bellfounders' Halls**: boss survived 1 of 3 runs
- **Huntress, The Cold Furnace**: only 60% of the area cleared
- **Necromancer, The Cold Furnace**: only 60% of the area cleared
- **Huntress, Act 1**: 47 deaths a run, against a median of 21
- **Arcanist, Act 2**: 130 deaths a run, against a median of 28
- **Huntress, Act 2**: 59 deaths a run, against a median of 28
- **Arcanist, Act 3**: 162 deaths a run, against a median of 43

### Worth a look

- Huntress, Sunken Chapel: 506s, against a median of 251s
- Huntress, Catacombs Level 1: 651s, against a median of 187s
- Huntress, Catacombs Level 2: 666s, against a median of 258s
- Huntress, The Glass Sea: 432s, against a median of 214s
- Forgewright, Buried Imhara: The Bazaar: 375s, against a median of 175s
- Reaver, Buried Imhara: Hall of Dials: 618s, against a median of 312s
- Arcanist, The Noon Vault: 680s, against a median of 344s
- Arcanist, The Bellfounders' Halls: 804s, against a median of 373s
- Huntress, Act 1: 641 potions a run, against a median of 165
- Necromancer, Act 2: 5 deaths a run, against a median of 28: much safer than the rest
- Forgewright, Act 2: 5 deaths a run, against a median of 28: much safer than the rest
- Necromancer, Act 3: 10 deaths a run, against a median of 43: much safer than the rest
- Forgewright, Act 3: 11 deaths a run, against a median of 43: much safer than the rest

An area left mostly uncleared can mean the bot got stuck there rather than that the class is weak: check the time it spent.

## By act

Time, deaths and potions are totals for the act. Time to kill is seconds per monster killed.

### Act 1

| Class | Time | Deaths | Potions | Time to kill | Cleared | Bosses killed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reaver | 25:14 | 29 | 270 | 3.8s | 91% | 12/12 |
| Arcanist | 17:57 | 13 | 79 | 2.7s | 91% | 12/12 |
| Huntress | 42:41 | 47 | 641 | 7.2s | 79% | 9/12 |
| Necromancer | 19:10 | 7.3 | 91 | 2.8s | 91% | 12/12 |
| Forgewright | 27:09 | 21 | 165 | 4.1s | 90% | 11/12 |

### Act 2

| Class | Time | Deaths | Potions | Time to kill | Cleared | Bosses killed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reaver | 31:14 | 28 | 351 | 4.7s | 92% | 12/12 |
| Arcanist | 30:44 | 130 | 252 | 4.6s | 92% | 10/12 |
| Huntress | 29:33 | 59 | 395 | 4.6s | 90% | 11/12 |
| Necromancer | 15:15 | 5.3 | 53 | 2.3s | 93% | 12/12 |
| Forgewright | 27:14 | 4.7 | 222 | 4.1s | 92% | 12/12 |

### Act 3

| Class | Time | Deaths | Potions | Time to kill | Cleared | Bosses killed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Reaver | 29:20 | 47 | 300 | 6.4s | 94% | 9/9 |
| Arcanist | 40:22 | 162 | 249 | 8.7s | 94% | 8/9 |
| Huntress | 29:05 | 43 | 296 | 6.7s | 88% | 9/9 |
| Necromancer | 17:49 | 10 | 46 | 4.2s | 87% | 9/9 |
| Forgewright | 24:21 | 11 | 148 | 5.3s | 93% | 9/9 |

## By area

Each cell is time in the area / deaths / potions. A dagger marks a boss that survived at least one run.

| Area | Level in | Reaver | Arcanist | Huntress | Necromancer | Forgewright |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Cinder Fields | 1 | 2:57 / 0.3 / 30 | 2:13 / 0.7 / 11 | 2:38 / 0 / 17 | 2:20 / 0.3 / 16 | 2:43 / 0.3 / 19 |
| Hollow Cave | 3.1 | 2:30 / 1 / 25 | 1:28 / 0.3 / 3.7 | 2:25 / 1.7 / 17 | 1:52 / 0.7 / 11 | 2:46 / 3.3 / 22 |
| Gloomwood | 5.3 | 2:43 / 0.3 / 15 | 2:30 / 0.3 / 6 | 2:39 / 0.3 / 21 | 2:22 / 0 / 8.3 | 2:44 / 0.3 / 11 |
| Sunken Chapel | 7.3 | 4:34 / 12 / 45 | 2:38 / 3.3 / 13 | 8:26 / 16 / 134 † | 3:06 / 2.7 / 20 | 4:11 / 7 / 31 |
| Catacombs Level 1 | 10 | 3:06 / 1.3 / 32 | 1:50 / 0.3 / 6.7 | 10:51 / 6 / 210 | 3:07 / 2.3 / 17 | 3:37 / 5.3 / 22 |
| Catacombs Level 2 | 12 | 5:19 / 9.3 / 73 | 2:52 / 3 / 13 | 11:06 / 15 / 190 † | 3:36 / 0.7 / 13 | 4:18 / 3.7 / 35 |
| The Hellforge | 16 | 4:04 / 5 / 50 | 4:25 / 5 / 25 | 4:35 / 7.3 / 52 | 2:46 / 0.7 / 5.7 | 6:49 / 0.7 / 25 † |
| The Ashfall Road | 19 | 1:42 / 0 / 9 | 1:51 / 0.3 / 2.7 | 2:03 / 0 / 21 | 1:57 / 0 / 6 | 1:50 / 0 / 4.3 |
| Cistern of Whispers | 21 | 2:40 / 1.3 / 32 | 2:16 / 2 / 11 | 2:14 / 2.3 / 18 | 1:31 / 0.7 / 4 | 2:32 / 0 / 16 |
| The Glass Sea | 23 | 3:34 / 0 / 39 | 2:54 / 4.3 / 12 | 7:12 / 5 / 130 | 2:11 / 0.7 / 11 | 3:42 / 1.7 / 25 |
| Carrion Mesa | 25 | 3:44 / 1.7 / 44 | 2:41 / 2.3 / 15 | 3:09 / 2 / 33 | 1:50 / 0 / 7.7 | 3:56 / 2 / 32 |
| Buried Imhara: The Bazaar | 27 | 3:34 / 2.3 / 39 | 2:55 / 5.3 / 17 | 2:04 / 2 / 17 | 1:44 / 0.3 / 3.3 | 6:15 / 0 / 85 |
| Buried Imhara: Hall of Dials | 28 | 10:18 / 19 / 124 | 6:46 / 16 / 50 | 5:12 / 7.3 / 62 | 3:19 / 3.3 / 9.3 | 4:08 / 0 / 29 |
| The Noon Vault | 31 | 5:44 / 4.3 / 64 | 11:20 / 99 / 144 † | 7:38 / 40 / 114 † | 2:41 / 0.3 / 12 | 4:50 / 1 / 31 |
| Rimefall Pass | 33 | 4:23 / 3 / 39 | 3:20 / 3.3 / 12 | 3:26 / 3.3 / 37 | 2:15 / 0 / 5.3 | 3:42 / 1.7 / 19 |
| The Drowned Mines | 35 | 7:51 / 26 / 86 | 8:06 / 41 / 61 | 5:01 / 12 / 50 | 2:10 / 0.3 / 4.7 | 5:31 / 2.7 / 37 |
| The Bellfounders' Halls | 37 | 6:13 / 6 / 62 | 13:24 / 45 / 87 † | 6:32 / 10 / 72 | 3:54 / 1.7 / 16 | 6:06 / 2 / 38 |
| The Cold Furnace | 40 | 4:14 / 2 / 42 | 5:50 / 25 / 35 | 6:36 / 1.3 / 64 | 6:41 / 1.3 / 8 | 3:39 / 1.3 / 16 |
| The Hellforge's Heart | 41 | 6:38 / 10 / 71 | 9:40 / 48 / 55 | 7:30 / 16 / 73 | 2:50 / 6.7 / 12 | 5:22 / 3.7 / 38 |
