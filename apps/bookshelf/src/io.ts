import type { Book, Shelf } from './types';
import { SHELVES } from './types';
import type { Settings } from './store';

/**
 * JSON Lines export and import. One object per line with a "type": a "meta" line, a "settings"
 * line and one "book" line per book. Field names are snake_case and spelled out so an AI (or a
 * script) can read the file without the app.
 */

const SHELF_OUT: Record<Shelf, string> = { reading: 'currently_reading', want: 'want_to_read', read: 'read' };

export function toJsonl(books: Book[], settings: Settings, now = new Date()): string {
  const lines: unknown[] = [
    {
      type: 'meta',
      app: 'bookshelf',
      format_version: 1,
      exported_at: now.toISOString(),
      books: books.length,
      notes: 'One book per "book" line. my_rating is 1-5 (null = unrated). Dates are local YYYY-MM-DD. open_library_work is the work id at openlibrary.org/works/<id>.',
    },
    { type: 'settings', yearly_goals: settings.goals },
    ...books.map((b) => ({
      type: 'book',
      id: b.id,
      title: b.title,
      authors: b.authors,
      shelf: SHELF_OUT[b.shelf],
      my_rating: b.rating ?? null,
      my_review: b.review ?? null,
      date_started: b.started ?? null,
      date_finished: b.finished ?? null,
      current_page: b.page ?? null,
      pages: b.pages ?? null,
      first_published_year: b.year ?? null,
      isbn: b.isbn ?? null,
      open_library_work: b.work ?? null,
      open_library_cover: b.cover ?? null,
      added_at: b.added,
      updated_at: b.updated,
    })),
  ];
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

export interface Parsed {
  books: Book[];
  settings?: Partial<Settings>;
  errors: string[];
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
};
const date = (v: unknown): string | undefined => {
  const s = str(v)?.replace(/\//g, '-');
  const m = s && /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : undefined;
};

export function parseShelf(v: unknown): Shelf | undefined {
  const s = str(v)?.toLowerCase().replace(/[\s-]+/g, '_');
  if (!s) return undefined;
  if (SHELVES.includes(s as Shelf)) return s as Shelf;
  if (/^(currently_)?reading$/.test(s)) return 'reading';
  if (/^(want_to_read|to_read|tbr|wishlist)$/.test(s)) return 'want';
  if (/^((already_)?read|finished|done)$/.test(s)) return 'read';
  return undefined;
}

/** Read our own JSONL, and the looser shapes an AI tends to write (code fences, plain field names). */
export function fromJsonl(text: string, newId: () => string): Parsed {
  const out: Parsed = { books: [], errors: [] };
  const now = new Date().toISOString();
  text
    .replace(/^\s*```\w*\s*$/gm, '')
    .split('\n')
    .forEach((line, i) => {
      if (!line.trim()) return;
      let o: Record<string, unknown>;
      try {
        o = JSON.parse(line);
      } catch {
        out.errors.push(`Line ${i + 1}: not JSON`);
        return;
      }
      const type = o.type ?? (o.title ? 'book' : undefined);
      if (type === 'settings' && o.yearly_goals && typeof o.yearly_goals === 'object') {
        const goals: Record<string, number> = {};
        for (const [y, n] of Object.entries(o.yearly_goals as Record<string, unknown>)) if (num(n)) goals[y] = num(n)!;
        out.settings = { goals };
        return;
      }
      if (type !== 'book') return;
      const title = str(o.title);
      if (!title) {
        out.errors.push(`Line ${i + 1}: book has no title`);
        return;
      }
      const authors = Array.isArray(o.authors) ? o.authors.flatMap((a) => str(a) ?? []) : str(o.author) ? [str(o.author)!] : [];
      const rating = num(o.my_rating ?? o.rating);
      const work = str(o.open_library_work ?? o.work)?.replace(/^\/?works\//, '');
      out.books.push({
        id: str(o.id) ?? (work ? `ol:${work}` : newId()),
        work,
        title,
        authors,
        cover: num(o.open_library_cover ?? o.cover),
        isbn: str(o.isbn)?.replace(/[^0-9X]/gi, ''),
        year: num(o.first_published_year ?? o.year),
        pages: num(o.pages),
        shelf: parseShelf(o.shelf) ?? (date(o.date_finished ?? o.finished) ? 'read' : 'want'),
        rating: rating ? Math.min(5, Math.round(rating)) : undefined,
        review: str(o.my_review ?? o.review),
        page: num(o.current_page ?? o.page),
        started: date(o.date_started ?? o.started),
        finished: date(o.date_finished ?? o.finished),
        added: str(o.added_at) ?? now,
        updated: str(o.updated_at) ?? now,
      });
    });
  return out;
}

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/**
 * A Goodreads library export (My Books → Import and export → Export library). Goodreads writes
 * ISBNs as ="0593135202" so spreadsheets keep the leading zero, and reviews with <br/> tags.
 */
export function fromGoodreads(text: string, newId: () => string): Parsed {
  const rows = parseCsv(text);
  const out: Parsed = { books: [], errors: [] };
  if (!rows.length) return out;
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const cTitle = col('title');
  if (cTitle < 0) {
    out.errors.push('No "Title" column. Is this a Goodreads export?');
    return out;
  }
  const at = (r: string[], name: string) => {
    const i = col(name);
    return i >= 0 ? (r[i] ?? '').trim() : '';
  };
  const isbnOf = (v: string) => v.replace(/^=/, '').replace(/[^0-9X]/gi, '') || undefined;
  const now = new Date().toISOString();
  for (const r of rows.slice(1)) {
    const title = (r[cTitle] ?? '').trim();
    if (!title) continue;
    const authors = [at(r, 'author'), ...at(r, 'additional authors').split(',')].map((a) => a.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const shelf = parseShelf(at(r, 'exclusive shelf')) ?? 'want';
    const rating = Number(at(r, 'my rating'));
    const review = at(r, 'my review')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    const added = date(at(r, 'date added'));
    out.books.push({
      id: newId(),
      title,
      authors: [...new Set(authors)],
      isbn: isbnOf(at(r, 'isbn13')) ?? isbnOf(at(r, 'isbn')),
      year: num(at(r, 'original publication year')) ?? num(at(r, 'year published')),
      pages: num(at(r, 'number of pages')),
      shelf,
      rating: rating >= 1 && rating <= 5 ? rating : undefined,
      review: review || undefined,
      finished: shelf === 'read' ? date(at(r, 'date read')) : undefined,
      added: added ? new Date(`${added}T12:00:00`).toISOString() : now,
      updated: now,
    });
  }
  return out;
}

/** Whichever format the text is in. */
export function parseImport(text: string, newId: () => string): Parsed {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('```')) return fromJsonl(t, newId);
  return fromGoodreads(t, newId);
}
