import type { CharSave } from '../game/types';
import { SAVE_VERSION } from '../game/world';
import { bumpUid } from '../game/items';

const KEY = 'realmfall.chars';

export function loadChars(): CharSave[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as CharSave[];
    const out = list.filter((c) => c && c.version <= SAVE_VERSION && c.name);
    for (const c of out) {
      for (const it of [...Object.values(c.equip), ...c.bag]) if (it) bumpUid(it.uid);
      c.task ??= null;
      c.potions ??= { health: 0, power: 0 };
    }
    return out;
  } catch {
    return [];
  }
}

export function saveChar(c: CharSave) {
  try {
    const list = loadChars().filter((x) => x.id !== c.id);
    list.unshift(c);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: play on without saving */
  }
}

export function deleteChar(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadChars().filter((x) => x.id !== id)));
  } catch {
    /* ignore */
  }
}

const SET_KEY = 'realmfall.settings';
export interface Settings { muted: boolean; shadows: boolean; fps: boolean }
export function loadSettings(): Settings {
  try {
    return { muted: false, shadows: true, fps: false, ...JSON.parse(localStorage.getItem(SET_KEY) ?? '{}') };
  } catch {
    return { muted: false, shadows: true, fps: false };
  }
}
export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SET_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
