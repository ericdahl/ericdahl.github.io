/**
 * Release notes shown in game (click the version on the title screen).
 * Add an entry at the top with every version bump; tests/changelog.test.ts checks it matches package.json.
 * Write for players: what they will see, not what changed in the code.
 */
export interface Release { version: string; date: string; title: string; notes: string[] }

export const CHANGELOG: Release[] = [
  {
    version: '0.2.0',
    date: '2026-11-27',
    title: 'New keys, a frame-rate readout and release notes',
    notes: [
      'A and D now strafe, Q and E turn. The arrow keys still turn.',
      'X switches sprint on and off; holding Shift still sprints. Sprint stops by itself when you run out of endurance.',
      'Add ?fps to the address, or tick Show frame rate in the Menu, to see frames per second, frame times, draw calls and triangles.',
      'Click the version number on the title screen (or Release notes in the Menu) to read what changed.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-27',
    title: 'First playable',
    notes: [
      'Three realms, Valmora, Eldwyn and Hroth, each with a town, a home region and a gate onto the shared frontier.',
      'Four classes: Warden, Ranger, Runecaller and Cleric, with styles, cast interrupts and con-coloured enemies.',
      'Level 1 to 20 in monster camps that grow tougher away from town, with named monsters, loot, a merchant and kill tasks.',
      'AI warbands from every realm besiege and capture seven frontier keeps. Fight alongside them, or talk to a soldier and lead the whole warband.',
      'War map, minimap, day and night, and heroes that save to this browser.',
    ],
  },
];

export function changelogHtml(): string {
  return CHANGELOG.map((r) => `<section class="rel"><h4>${r.version} · ${r.title}</h4><small>${r.date}</small><ul>${r.notes.map((n) => `<li>${n}</li>`).join('')}</ul></section>`).join('');
}
