import type { Book } from './types';

export interface YearStats {
  year: number;
  books: Book[];
  pages: number;
  /** Books with no page count, so "pages" is a lower bound. */
  missingPages: number;
  avgRating?: number;
  rated: number;
  /** Books finished in each month, January first. */
  byMonth: number[];
  /** How many books got each rating, 1 to 5. */
  byRating: number[];
  longest?: Book;
  shortest?: Book;
  topAuthors: { name: string; count: number }[];
}

export function yearStats(books: Book[], year: number): YearStats {
  const done = books
    .filter((b) => b.shelf === 'read' && b.finished?.startsWith(`${year}-`))
    .sort((a, b) => (a.finished ?? '').localeCompare(b.finished ?? ''));
  const byMonth = Array<number>(12).fill(0);
  const byRating = Array<number>(5).fill(0);
  let pages = 0;
  let ratingSum = 0;
  let rated = 0;
  const authors = new Map<string, number>();
  for (const b of done) {
    byMonth[Number(b.finished!.slice(5, 7)) - 1]++;
    pages += b.pages ?? 0;
    if (b.rating) {
      byRating[b.rating - 1]++;
      ratingSum += b.rating;
      rated++;
    }
    for (const a of b.authors.slice(0, 1)) authors.set(a, (authors.get(a) ?? 0) + 1);
  }
  const withPages = done.filter((b) => b.pages);
  const bySize = [...withPages].sort((a, b) => b.pages! - a.pages!);
  return {
    year,
    books: done,
    pages,
    missingPages: done.length - withPages.length,
    avgRating: rated ? ratingSum / rated : undefined,
    rated,
    byMonth,
    byRating,
    longest: bySize[0],
    shortest: bySize.length > 1 ? bySize[bySize.length - 1] : undefined,
    topAuthors: [...authors]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
  };
}

/** Years with at least one finished book, newest first, always including this year. */
export function years(books: Book[], thisYear = new Date().getFullYear()): number[] {
  const ys = new Set([thisYear]);
  for (const b of books) if (b.shelf === 'read' && b.finished) ys.add(Number(b.finished.slice(0, 4)));
  return [...ys].sort((a, b) => b - a);
}

/**
 * Whether you're ahead of or behind a yearly goal, by where you'd be if you read at an even pace.
 * Positive is ahead.
 */
export function goalPace(done: number, goal: number, year: number, today = new Date()): number {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const t = Math.min(1, Math.max(0, (today.getTime() - start) / (end - start)));
  return Math.round((done - goal * t) * 10) / 10;
}

export type Sort = 'recent' | 'title' | 'author' | 'rating' | 'finished';

const lastName = (a?: string) => (a ?? '').trim().split(/\s+/).pop() ?? '';

export function sortBooks(list: Book[], sort: Sort): Book[] {
  const out = [...list];
  const by = (f: (b: Book) => string | number, dir = 1) => (a: Book, b: Book) => {
    const x = f(a);
    const y = f(b);
    const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, undefined, { sensitivity: 'base' }) : x < y ? -1 : x > y ? 1 : 0;
    return c * dir;
  };
  const title = (b: Book) => b.title.toLowerCase().replace(/^(the|a|an) /, '');
  switch (sort) {
    case 'title':
      return out.sort(by(title));
    case 'author':
      return out.sort((a, b) => by((x) => lastName(x.authors[0]).toLowerCase())(a, b) || by(title)(a, b));
    case 'rating':
      return out.sort((a, b) => by((x) => x.rating ?? 0, -1)(a, b) || by((x) => x.finished ?? '', -1)(a, b));
    case 'finished':
      return out.sort((a, b) => by((x) => x.finished ?? '', -1)(a, b) || by((x) => x.updated, -1)(a, b));
    default:
      return out.sort(by((x) => x.updated, -1));
  }
}

/** Matches the words of a filter against title and authors, ignoring case and accents. */
export function matches(b: Book, q: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const hay = norm(`${b.title} ${b.authors.join(' ')}`);
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
