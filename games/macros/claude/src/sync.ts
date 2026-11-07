import type { Entry } from './types';
import { deleteFile, GitHubError, isConflict, listFiles, readBlob, readFile, repoInfo, writeFile, type RepoConfig } from './github';
import { parseText } from './parse';
import { composeDay, entryToLine, entryTs, mergeDay, parseDayFile, sameLines, type RemoteFood } from './repoLines';
import * as store from './store';

/**
 * Optional sync of food entries to a GitHub repo of per-day JSONL files (db/YYYY/MM/DD.jsonl),
 * shared with other tools that write workouts there. Off unless connected on the Data page.
 *
 * Pull: one tree listing gives every day file's blob sha; only files whose sha changed since the
 * last sync are downloaded. Push: only days edited on this device are written, each by
 * read-merge-write with the file's sha, so a concurrent commit (say, a workout logged by Claude)
 * makes GitHub refuse the write and the day is merged again rather than overwritten.
 */

interface DayState {
  /** Blob sha of the day's file when last synced; null if it didn't exist. */
  sha: string | null;
  /** Food entry ids in the repo after that sync: the merge base. */
  ids: string[];
}

interface SyncState {
  branch: string;
  days: Record<string, DayState>;
  /** Days edited here and not yet written to the repo. */
  dirty: string[];
  lastSync: string | null;
}

export type SyncConfig = Omit<RepoConfig, 'token'>;

export interface Status {
  kind: 'off' | 'idle' | 'syncing' | 'error';
  message: string;
  pending: number;
  lastSync: string | null;
}

const EMPTY: SyncState = { branch: '', days: {}, dirty: [], lastSync: null };

let config = store.load<SyncConfig | null>('sync.config', null);
let token = store.load<string>('sync.token', '');
let state: SyncState = { ...EMPTY, ...store.load<Partial<SyncState>>('sync.state', {}) };
let status: Status = { kind: token && config ? 'idle' : 'off', message: '', pending: state.dirty.length, lastSync: state.lastSync };

const listeners = new Set<() => void>();
export function onStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setStatus(s: Partial<Status>): void {
  status = { ...status, pending: state.dirty.length, lastSync: state.lastSync, ...s };
  for (const fn of listeners) fn();
}
export function getStatus(): Status {
  return status;
}
function saveState(): void {
  store.save('sync.state', state);
}

export function getConfig(): SyncConfig | null {
  return config;
}
export function isConnected(): boolean {
  return !!(config && token);
}
function cfg(): RepoConfig {
  return { ...config!, token };
}

// ---------- paths ----------

export function dayPath(folder: string, date: string): string {
  const [y, m, d] = date.split('-');
  return `${folder ? folder.replace(/\/+$/, '') + '/' : ''}${y}/${m}/${d}.jsonl`;
}

export function pathDate(folder: string, path: string): string | null {
  const prefix = folder ? folder.replace(/\/+$/, '') + '/' : '';
  if (!path.startsWith(prefix)) return null;
  const m = /^(\d{4})\/(\d{2})\/(\d{2})\.jsonl$/.exec(path.slice(prefix.length));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ---------- connect ----------

/** Check the repo and token, then save them. The first sync uploads what's already on this device. */
export async function connect(c: SyncConfig, t: string): Promise<{ isPrivate: boolean; branch: string }> {
  const info = await repoInfo({ ...c, token: t });
  if (!info.canPush) throw new GitHubError('The token can read this repository but not write to it. Give it Contents: read and write.', 403);
  config = c;
  token = t;
  store.save('sync.config', c);
  store.save('sync.token', t);
  // days already on this device that the repo hasn't seen get merged and uploaded
  state = { ...EMPTY, branch: c.branch || info.defaultBranch, dirty: [...new Set(store.allEntries().map((e) => e.date))].sort() };
  saveState();
  setStatus({ kind: 'idle', message: '' });
  void syncNow();
  return { isPrivate: info.isPrivate, branch: state.branch };
}

/** Forget the token and sync bookkeeping. Entries stay on this device and in the repo. */
export function disconnect(): void {
  token = '';
  store.save('sync.token', '');
  state = { ...EMPTY };
  saveState();
  setStatus({ kind: 'off', message: '' });
}

// ---------- sync ----------

/** Fill in macros for repo lines that name a food but have no numbers (say, written by hand). */
function withMacros(foods: RemoteFood[]): Entry[] {
  return foods.map(({ entry, needsMacros }) => {
    if (!needsMacros) return entry;
    const [it] = parseText(`${entry.qty} ${entry.unit === 'serving' ? '' : entry.unit} ${entry.name}`, store.allFoods());
    if (!it?.food) return entry;
    return { ...entry, foodId: it.food.id, grams: it.grams, ...it.macros };
  });
}

/** Mark entries as matching what was just written, so they read as unchanged next time. */
function settled(entries: Entry[]): Entry[] {
  return entries.map((e) => ({ ...e, ts: entryTs(e), remoteLine: entryToLine(e) }));
}

function commitMessage(date: string, before: Entry[], after: Entry[]): string {
  const old = new Map(before.map((e) => [e.id, entryToLine(e)]));
  const now = new Set(after.map((e) => e.id));
  const added = after.filter((e) => !old.has(e.id));
  const editedN = after.filter((e) => old.has(e.id) && old.get(e.id) !== entryToLine(e)).length;
  const removed = before.filter((e) => !now.has(e.id)).length;
  const names = added.slice(0, 3).map((e) => e.name);
  const parts = [names.join(', ') + (added.length > 3 ? ` +${added.length - 3} more` : '')].filter(Boolean);
  if (editedN) parts.push(`edit ${editedN}`);
  if (removed) parts.push(`remove ${removed}`);
  return `food: ${date} ${parts.join('; ') || 'update'}`;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

async function pull(): Promise<void> {
  const c = cfg();
  const files = await listFiles(c, state.branch);
  const changed: { date: string; sha: string | null }[] = [];
  const seen = new Set<string>();
  for (const [path, sha] of files) {
    const date = pathDate(c.folder, path);
    if (!date) continue;
    seen.add(date);
    if (state.days[date]?.sha !== sha) changed.push({ date, sha });
  }
  // a day file deleted in the repo
  for (const [date, d] of Object.entries(state.days)) if (d.sha && !seen.has(date)) changed.push({ date, sha: null });
  if (!changed.length) return;

  const fetched: { date: string; sha: string | null; remote: Entry[] }[] = [];
  let done = 0;
  await pool(changed, 6, async ({ date, sha }) => {
    const text = sha ? await readBlob(c, sha) : '';
    fetched.push({ date, sha, remote: withMacros(parseDayFile(text, date).foods) });
    done++;
    if (changed.length > 10) setStatus({ message: `Reading ${done} of ${changed.length} days…` });
  });
  // merge synchronously against what's on the device right now, so nothing logged meanwhile is lost
  for (const { date, sha, remote } of fetched) {
    const local = store.entriesFor(date);
    const merged = mergeDay(new Set(state.days[date]?.ids ?? []), local, remote);
    if (!sameLines(merged, local)) store.replaceDay(date, merged);
    state.days[date] = { sha, ids: remote.map((e) => e.id) };
    if (!sameLines(merged, remote) && !state.dirty.includes(date)) state.dirty.push(date);
  }
  saveState();
}

/** Write one day. Returns false if it was edited again while writing and needs another push. */
async function pushDay(date: string): Promise<boolean> {
  const c = cfg();
  const path = dayPath(c.folder, date);
  for (let attempt = 0; ; attempt++) {
    const file = await readFile(c, path, state.branch);
    const day = parseDayFile(file?.text ?? '', date);
    const remote = withMacros(day.foods);
    const snapshot = store.entriesFor(date);
    const merged = mergeDay(new Set(state.days[date]?.ids ?? []), snapshot, remote);
    const text = composeDay(day.others, merged);
    try {
      let sha = file?.sha ?? null;
      if (file && text === file.text) {
        /* already up to date */
      } else if (!text) {
        if (file) await deleteFile(c, path, state.branch, file.sha, commitMessage(date, remote, merged));
        sha = null;
      } else {
        sha = await writeFile(c, path, state.branch, text, sha, commitMessage(date, remote, merged));
      }
      const clean = settled(merged);
      state.days[date] = { sha, ids: clean.map((e) => e.id) };
      // Apply to the device. Entries changed or added while writing stay as they are (still to push);
      // the rest become the clean, written versions, plus anything new that came from the repo.
      const written = new Map(merged.map((e, i) => [e.id, { line: entryToLine(e), clean: clean[i] }]));
      const had = new Set(snapshot.map((e) => e.id));
      const cur = store.entriesFor(date);
      const curIds = new Set(cur.map((e) => e.id));
      const next = [
        ...cur.map((e) => (written.get(e.id)?.line === entryToLine(e) ? written.get(e.id)!.clean : e)),
        ...clean.filter((e) => !had.has(e.id) && !curIds.has(e.id)),
      ];
      store.replaceDay(date, next);
      return sameLines(next, clean);
    } catch (e) {
      // someone else committed to this file meanwhile: read it again and redo the merge
      if (isConflict(e) && attempt < 3) continue;
      throw e;
    }
  }
}

let running: Promise<void> | null = null;
let again = false;

/** Pull changes, then push days edited here. Safe to call often; overlapping calls coalesce. */
export function syncNow(): Promise<void> {
  if (!isConnected()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      setStatus({ kind: 'syncing', message: 'Syncing…' });
      try {
        if (!state.branch) {
          state.branch = config!.branch || (await repoInfo(cfg())).defaultBranch;
          saveState();
        }
        await pull();
        for (const date of [...state.dirty].sort()) {
          // taken off the list first, so an edit made while this day is being written puts it back
          state.dirty = state.dirty.filter((d) => d !== date);
          saveState();
          try {
            if (!(await pushDay(date)) && !state.dirty.includes(date)) {
              state.dirty.push(date);
              again = true;
            }
          } catch (e) {
            if (!state.dirty.includes(date)) state.dirty.push(date);
            throw e;
          }
          saveState();
          setStatus({ message: state.dirty.length ? `Saving… ${state.dirty.length} left` : 'Saving…' });
        }
        state.lastSync = new Date().toISOString();
        saveState();
        setStatus({ kind: 'idle', message: '' });
      } catch (e) {
        saveState();
        const offline = e instanceof GitHubError && e.status === 0;
        setStatus({ kind: 'error', message: offline ? 'Offline. Changes will sync later.' : (e as Error).message });
        break;
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let timer = 0;
function soon(ms = 2000): void {
  clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), ms);
}

/** Wire up automatic syncing: after edits, on start, when the app comes back to the foreground or online. */
export function startAutoSync(): void {
  store.onDaysEdited((dates) => {
    if (!isConnected()) return;
    for (const d of dates) if (!state.dirty.includes(d)) state.dirty.push(d);
    saveState();
    setStatus({});
    soon();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') soon(300);
  });
  window.addEventListener('online', () => soon(300));
  if (isConnected()) soon(300);
}
