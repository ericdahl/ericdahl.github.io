import { migrateCharacter, newSharedStash, SAVE_VERSION, type Character, type SharedStash } from '../game/character';
import { bumpUid, type Item } from '../game/items';

const KEY = 'hellforge.chars.v1';
const BACKUP = `${KEY}.before-v${SAVE_VERSION}`;
const SETTINGS = 'hellforge.settings.v1';
const SHARED = 'hellforge.shared.v1';

/** Both shared stashes as stored: one for softcore heroes, one for Hardcore. */
export interface SharedStashes {
  soft: SharedStash;
  hard: SharedStash;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  weather: boolean;
  screenFx: boolean;
  labels: boolean;
  numbers: boolean;
  automap: 'off' | 'mini' | 'full';
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // Storage can be unavailable (private mode); the game still runs, it just won't persist.
  }
}

function allItems(c: Character): Item[] {
  return [
    ...c.inventory.map((e) => e.item),
    ...c.stash.map((e) => e.item),
    ...Object.values(c.equipment).filter((i): i is Item => !!i),
  ];
}

export function loadCharacters(): Character[] {
  const list = read<Character[]>(KEY, []);
  if (list.some((c) => c.version < SAVE_VERSION)) {
    if (!read<Character[] | null>(BACKUP, null)) write(BACKUP, list);
    list.forEach(migrateCharacter);
    write(KEY, list);
  }
  for (const c of list) for (const it of allItems(c)) bumpUid(it.uid);
  return list.sort((a, b) => b.created - a.created);
}

export function saveCharacter(c: Character) {
  const list = read<Character[]>(KEY, []);
  const i = list.findIndex((x) => x.id === c.id);
  if (i >= 0) list[i] = c;
  else list.push(c);
  write(KEY, list);
}

export function deleteCharacter(id: string) {
  write(KEY, read<Character[]>(KEY, []).filter((c) => c.id !== id));
}

export function loadSharedStashes(): SharedStashes {
  const s = read<Partial<SharedStashes>>(SHARED, {});
  const fix = (x?: Partial<SharedStash>): SharedStash => ({ items: Array.isArray(x?.items) ? x.items : [], gold: Number(x?.gold) || 0 });
  const out = { soft: fix(s.soft), hard: fix(s.hard) };
  for (const st of [out.soft, out.hard]) for (const e of st.items) bumpUid(e.item.uid);
  return out;
}

/** The shared stash a hero of this kind can reach. */
export function loadShared(hardcore: boolean): SharedStash {
  return loadSharedStashes()[hardcore ? 'hard' : 'soft'];
}

export function saveShared(hardcore: boolean, stash: SharedStash) {
  const all = loadSharedStashes();
  all[hardcore ? 'hard' : 'soft'] = stash;
  write(SHARED, all);
}

export function saveSharedStashes(all: SharedStashes) {
  write(SHARED, { soft: all.soft ?? newSharedStash(), hard: all.hard ?? newSharedStash() });
}

export const sharedIsEmpty = (s?: SharedStash) => !s || (!s.items.length && !s.gold);

export function loadSettings(): Settings {
  return { sound: true, music: true, weather: true, screenFx: true, labels: true, numbers: true, automap: 'mini', ...read<Partial<Settings>>(SETTINGS, {}) };
}

export function saveSettings(s: Settings) {
  write(SETTINGS, s);
}

/** Adds imported heroes, replacing any stored hero with the same id. Returns how many were replaced. */
export function importCharacters(chars: Character[]): number {
  const list = read<Character[]>(KEY, []);
  let replaced = 0;
  for (const c of chars) {
    migrateCharacter(c);
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) (list[i] = c), replaced++;
    else list.push(c);
  }
  write(KEY, list);
  return replaced;
}
