import type { Book, Details, Shelf } from './types';

/** localStorage that never throws (private browsing, blocked storage) and falls back to memory. */
const memory = new Map<string, string>();
const PREFIX = 'bookshelf.v1.';

function load<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    raw = memory.get(key) ?? null;
  }
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    /* storage unavailable or full: keep the in-memory copy */
  }
}

export interface Settings {
  /** Yearly reading goal, books per year, keyed by year. */
  goals: Record<string, number>;
}

interface State {
  books: Book[];
  details: Record<string, Details>;
  settings: Settings;
}

const state: State = {
  books: load<Book[]>('books', []),
  details: load<Record<string, Details>>('details', {}),
  settings: { goals: {}, ...load<Partial<Settings>>('settings', {}) },
};

const listeners = new Set<() => void>();
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed(...keys: (keyof State)[]): void {
  for (const k of keys) save(k, state[k]);
  for (const fn of listeners) fn();
}

export function uid(prefix = ''): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14);
  return prefix + r;
}

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- books ----

export function books(): Book[] {
  return state.books;
}

export function getBook(id: string): Book | undefined {
  return state.books.find((b) => b.id === id);
}

/** A book already on a shelf that is the same as this work or ISBN. */
export function findSame(work?: string, isbn?: string): Book | undefined {
  return state.books.find((b) => (work && b.work === work) || (isbn && b.isbn === isbn));
}

export function upsertBook(book: Book): void {
  book.updated = new Date().toISOString();
  const i = state.books.findIndex((b) => b.id === book.id);
  if (i >= 0) state.books[i] = book;
  else state.books.unshift(book);
  changed('books');
}

export function deleteBook(id: string): Book | undefined {
  const b = getBook(id);
  state.books = state.books.filter((x) => x.id !== id);
  changed('books');
  return b;
}

/**
 * Move a book to a shelf, filling in the dates that go with it: starting a book sets "started" to
 * today, finishing sets "finished" (and the page to the last page). Dates you already set are kept.
 */
export function moveTo(book: Book, shelf: Shelf, today = localDate()): Book {
  const b = { ...book, shelf };
  if (shelf === 'reading') {
    b.started ??= today;
    if (book.shelf === 'read') {
      // starting it again: a re-read
      b.started = today;
      b.finished = undefined;
      b.page = undefined;
    }
  }
  if (shelf === 'read') {
    b.finished ??= today;
    if (b.pages) b.page = b.pages;
  }
  if (shelf === 'want') {
    b.started = undefined;
    b.finished = undefined;
    b.page = undefined;
  }
  return b;
}

// ---- Open Library details ----

export function details(work: string | undefined): Details | undefined {
  return work ? state.details[work] : undefined;
}

export function setDetails(d: Details): void {
  state.details[d.work] = d;
  changed('details');
}

// ---- settings ----

export function goal(year: number): number | undefined {
  return state.settings.goals[String(year)];
}

export function setGoal(year: number, n: number | undefined): void {
  if (n && n > 0) state.settings.goals[String(year)] = n;
  else delete state.settings.goals[String(year)];
  changed('settings');
}

export function settings(): Settings {
  return state.settings;
}

/**
 * Merge imported books. A book with the same id, Open Library work or ISBN as one already on a
 * shelf replaces it (keeping the existing id), so importing twice doesn't duplicate anything.
 */
export function merge(data: { books?: Book[]; settings?: Partial<Settings> }): { added: number; updated: number } {
  let added = 0;
  let updated = 0;
  for (const b of data.books ?? []) {
    const i = state.books.findIndex((x) => x.id === b.id || (b.work && x.work === b.work) || (b.isbn && x.isbn === b.isbn) || sameTitle(x, b));
    if (i >= 0) {
      const old = state.books[i];
      state.books[i] = { ...old, ...stripUndefined(b), id: old.id, work: b.work ?? old.work, cover: b.cover ?? old.cover };
      updated++;
    } else {
      state.books.push(b);
      added++;
    }
  }
  if (data.settings?.goals) state.settings.goals = { ...state.settings.goals, ...data.settings.goals };
  changed('books', 'settings');
  return { added, updated };
}

const norm = (s = '') => s.normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

/** Same title and first author, for books with no ISBN (common in Goodreads exports). */
function sameTitle(a: Book, b: Book): boolean {
  return norm(a.title) === norm(b.title) && norm(a.authors[0]) === norm(b.authors[0]);
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function clearAll(): void {
  state.books = [];
  state.details = {};
  state.settings = { goals: {} };
  changed('books', 'details', 'settings');
}
