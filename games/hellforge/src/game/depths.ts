import { AREAS, type AreaDef } from './areas';
import type { ThemeId } from './map';
import { MOD_LABEL, type UniqueMod } from './monsters';
import type { Rng } from './rng';

/**
 * The Underforge: an endless descent that opens under Emberwatch once the ember is home.
 * Every floor is rolled fresh from the run's seed, one monster level deeper than the last.
 * A warden holds the stairs on each floor, every fifth floor belongs to a boss, and from the
 * third floor down the whole floor carries afflictions that every creature on it shares.
 */

const PREFIX = 'depth:';
export const depthId = (d: number) => `${PREFIX}${d}`;
export const isDepthId = (id: string) => id.startsWith(PREFIX);
export const depthOf = (id: string) => (isDepthId(id) ? Number(id.slice(PREFIX.length)) : 0);

/** The town the Underforge is under: portals and respawns lead here. */
export const DEPTHS_TOWN = 'emberwatch_ruins';
/** Area level of the first floor before the difficulty offset, just past the Hellforge's Heart. */
export const DEPTH_BASE_LEVEL = 33;
/** Every this-many floors is a boss floor, and clearing one opens a place to start the next descent from. */
export const DEPTH_STRIDE = 5;

interface Layout {
  theme: ThemeId;
  gen: 'open' | 'rooms';
  pool: string[];
  cold?: boolean;
  storm?: boolean;
}

const LAYOUTS: Layout[] = [
  { theme: 'crypt', gen: 'rooms', pool: ['skeleton', 'archer', 'wraith', 'cultist', 'brute'] },
  { theme: 'hell', gen: 'rooms', pool: ['hound', 'cultist', 'brute', 'imp', 'hexer'] },
  { theme: 'cave', gen: 'open', pool: ['bat', 'ghoul', 'imp', 'hexer', 'hound'] },
  { theme: 'cistern', gen: 'rooms', pool: ['scorpion', 'scarab', 'shade', 'burrower'] },
  { theme: 'ruins', gen: 'rooms', pool: ['mummy', 'acolyte', 'shade', 'mirage', 'colossus'] },
  { theme: 'vault', gen: 'rooms', pool: ['acolyte', 'colossus', 'mirage', 'shade', 'raider'] },
  { theme: 'glass', gen: 'open', storm: true, pool: ['burrower', 'scarab', 'mirage', 'raider', 'kite'] },
  { theme: 'icemine', gen: 'rooms', cold: true, pool: ['frozen_miner', 'rime_thrall', 'slag_golem', 'snow_shade', 'frozen_bowman'] },
  { theme: 'foundry', gen: 'rooms', cold: true, pool: ['bellwarden', 'slag_golem', 'frozen_miner', 'hearth_eater', 'frozen_bowman'] },
  { theme: 'furnace', gen: 'rooms', cold: true, pool: ['slag_golem', 'bellwarden', 'hearth_eater', 'rime_thrall', 'rime_hound'] },
];

/** Monsters that can turn up on any floor, whatever it looks like. None of them needs its home area's rules. */
const INTRUDERS = ['imp', 'ghoul', 'skeleton', 'archer', 'bat', 'hound', 'brute', 'wraith', 'cultist', 'jackal', 'scarab', 'raider', 'kite', 'scorpion', 'burrower', 'mummy', 'colossus', 'shade', 'rime_hound', 'snow_shade', 'frozen_miner', 'frozen_bowman', 'slag_golem'];

/** Bosses that come back on the boss floors. Only ones whose fights need nothing from their old lairs. */
export const DEPTH_BOSSES = ['glutton', 'bishop', 'warden', 'skarn', 'karrik', 'embalmer', 'mother'];

/** Afflictions a floor can carry. Every monster on the floor has them, on top of its own. */
export const AFFLICTIONS: UniqueMod[] = ['fast', 'strong', 'stoneskin', 'extraLife', 'vampiric', 'fireEnch', 'coldEnch'];
const AFFLICTION_NAME: Partial<Record<UniqueMod, string>> = {
  fast: 'Hasted', strong: 'Mighty', stoneskin: 'Stoneclad', extraLife: 'Bloated', vampiric: 'Thirsting', fireEnch: 'Smouldering', coldEnch: 'Rimed',
};

export function afflictionLabel(m: UniqueMod): string {
  return `${AFFLICTION_NAME[m] ?? MOD_LABEL[m]} (${MOD_LABEL[m]})`;
}

/** How many afflictions a floor carries: none on the first two, then one more every ten floors, up to three. */
export function afflictionCount(depth: number): number {
  return depth < 3 ? 0 : Math.min(3, 1 + Math.floor(depth / 10));
}

export const isBossDepth = (depth: number) => depth % DEPTH_STRIDE === 0;

/** How much better the dead pay out down here, as magic find and gold find. */
export function depthFortune(depth: number): number {
  return Math.min(300, depth * 6);
}

/** Cinders a floor's warden leaves for the Forge. */
export function depthCinders(depth: number): number {
  return 6 + depth * 2 + (isBossDepth(depth) ? 20 + depth * 2 : 0);
}

/**
 * Floors a descent can start from: the first, and the one below each boss floor already cleared.
 * `best` is the deepest floor whose warden has fallen.
 */
export function depthStarts(best: number): number[] {
  const out = [1];
  for (let d = DEPTH_STRIDE; d <= best; d += DEPTH_STRIDE) out.push(d + 1);
  return out;
}

/** Rolls a floor. The same depth and rng always give the same floor. */
export function depthDef(depth: number, rng: Rng): AreaDef {
  const lay = rng.pick(LAYOUTS);
  const like = AREAS.find((a) => a.spec.theme === lay.theme)!;
  const boss = isBossDepth(depth);
  const monsters = rng.shuffle(lay.pool.slice()).slice(0, 4);
  // One or two strangers from elsewhere, so no two floors of a kind fight the same.
  for (const id of rng.shuffle(INTRUDERS.slice()).slice(0, rng.int(1, 2))) if (!monsters.includes(id)) monsters.push(id);
  const size = lay.gen === 'open' ? rng.int(58, 66) : rng.int(54, 62);
  return {
    id: depthId(depth),
    name: `The Underforge: Depth ${depth}`,
    alvl: DEPTH_BASE_LEVEL + depth,
    monsters,
    packs: Math.min(20, 11 + Math.floor(depth / 3)),
    dark: like.dark,
    light: like.light,
    act: 3,
    cold: lay.cold,
    storm: lay.storm,
    depth,
    afflictions: rng.shuffle(AFFLICTIONS.slice()).slice(0, afflictionCount(depth)),
    superUnique: boss ? DEPTH_BOSSES[(depth / DEPTH_STRIDE - 1) % DEPTH_BOSSES.length] : undefined,
    spec: {
      gen: lay.gen, w: size, h: size, theme: lay.theme, density: 0.4, bossLair: lay.gen === 'rooms',
      links: [
        { to: DEPTHS_TOWN, label: 'Climb out to Emberwatch Ruins', kind: 'up' },
        { to: depthId(depth + 1), label: `Descend to Depth ${depth + 1}`, kind: 'down' },
      ],
    },
  };
}
