import type { Details, Hit } from './types';

/**
 * Open Library (openlibrary.org): free, no API key, CORS enabled. Search, ISBN lookup, work
 * descriptions and subjects, community ratings and covers. Google Books was left out because its
 * keyless quota is zero.
 */

const OL = 'https://openlibrary.org';
const FIELDS = 'key,title,author_name,cover_i,isbn,first_publish_year,number_of_pages_median,ratings_average,ratings_count,edition_count';

interface Doc {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  isbn?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  ratings_average?: number;
  ratings_count?: number;
  edition_count?: number;
}

/** "/works/OL21745884W" → "OL21745884W". */
export function workId(key: string): string {
  return key.replace(/^\/?works\//, '');
}

function docToHit(d: Doc, isbn?: string): Hit | null {
  if (!d.key || !d.title) return null;
  return {
    work: workId(d.key),
    title: d.title,
    authors: d.author_name ?? [],
    cover: d.cover_i,
    isbn: isbn ?? pickIsbn(d.isbn),
    year: d.first_publish_year,
    pages: d.number_of_pages_median,
    ratingAvg: d.ratings_average,
    ratingCount: d.ratings_count,
    editions: d.edition_count,
  };
}

/** Prefer an ISBN-13 from the English-language ranges (978-0/978-1), else any ISBN-13. */
function pickIsbn(list?: string[]): string | undefined {
  const isbn13 = (list ?? []).filter((x) => /^97[89]\d{10}$/.test(x));
  return isbn13.find((x) => /^978[01]/.test(x)) ?? isbn13[0] ?? list?.[0];
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
  return (await res.json()) as T;
}

export async function search(q: string, signal?: AbortSignal): Promise<Hit[]> {
  const data = await get<{ docs?: Doc[] }>(`${OL}/search.json?q=${encodeURIComponent(q)}&limit=20&fields=${FIELDS}`, signal);
  return (data.docs ?? []).flatMap((d) => docToHit(d) ?? []);
}

export async function byIsbn(isbn: string, signal?: AbortSignal): Promise<Hit | null> {
  const data = await get<{ docs?: Doc[] }>(`${OL}/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=${FIELDS}`, signal);
  return data.docs?.[0] ? docToHit(data.docs[0], isbn) : null;
}

/** Best match for a book you only have a title and author for (imports, hand-added books). */
export async function match(title: string, author?: string, signal?: AbortSignal): Promise<Hit | null> {
  const q = `title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ''}`;
  const data = await get<{ docs?: Doc[] }>(`${OL}/search.json?${q}&limit=1&fields=${FIELDS}`, signal);
  return data.docs?.[0] ? docToHit(data.docs[0]) : null;
}

type Text = string | { value?: string } | undefined;
const text = (t: Text): string | undefined => (typeof t === 'string' ? t : t?.value)?.trim() || undefined;

/** Description, subjects, links, ratings, reader counts and author bios, fetched in parallel. */
export async function fetchDetails(work: string, signal?: AbortSignal): Promise<Details> {
  const w = await get<{
    description?: Text;
    subjects?: string[];
    links?: { title?: string; url?: string }[];
    authors?: { author?: { key?: string } }[];
    first_publish_date?: string;
  }>(`${OL}/works/${work}.json`, signal);
  const authorKeys = (w.authors ?? []).flatMap((a) => (a.author?.key ? [a.author.key.replace('/authors/', '')] : [])).slice(0, 3);
  const [ratings, shelves, ...authors] = await Promise.all([
    get<{ summary?: { average?: number; count?: number }; counts?: Record<string, number> }>(`${OL}/works/${work}/ratings.json`, signal).catch(() => null),
    get<{ counts?: { want_to_read?: number; currently_reading?: number; already_read?: number } }>(`${OL}/works/${work}/bookshelves.json`, signal).catch(() => null),
    ...authorKeys.map((k) =>
      get<{ name?: string; bio?: Text; birth_date?: string; death_date?: string }>(`${OL}/authors/${k}.json`, signal)
        .then((a) => ({ key: k, name: a.name ?? '', bio: text(a.bio), birth: a.birth_date, death: a.death_date }))
        .catch(() => null),
    ),
  ]);
  const sc = shelves?.counts;
  return {
    work,
    description: cleanDescription(text(w.description)),
    subjects: cleanSubjects(w.subjects ?? []),
    links: (w.links ?? []).flatMap((l) => (l.url && /^https?:/.test(l.url) ? [{ title: l.title || l.url, url: l.url }] : [])),
    ratingAvg: ratings?.summary?.average,
    ratingCount: ratings?.summary?.count,
    ratingCounts: ratings?.counts,
    shelfCounts: sc ? { want: sc.want_to_read ?? 0, reading: sc.currently_reading ?? 0, read: sc.already_read ?? 0 } : undefined,
    authors: authors.filter((a): a is NonNullable<typeof a> => !!a && !!a.name),
    firstPublished: w.first_publish_date,
    fetched: new Date().toISOString(),
  };
}

/** Drop the "----------\nAlso contained in:" tails and markdown links Open Library descriptions often carry. */
export function cleanDescription(d?: string): string | undefined {
  if (!d) return undefined;
  return d
    .replace(/\r\n/g, '\n')
    .split(/\n-{3,}\s*\n/)[0]
    .replace(/\[([^\]]+)\]\[\d+\]/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
    .replace(/^\s*\[\d+\]:.*$/gm, '')
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .trim();
}

/** Subjects without list tags ("nyt:…", "series:…") or near-duplicates, capped at 12. */
export function cleanSubjects(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    if (/[:=]/.test(s) || s.length > 40 || /^(fiction|general|accessible book|protected daisy|in library|large type books)$/i.test(s)) continue;
    const k = s.toLowerCase().replace(/[^a-z]/g, '');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s.replace(/^./, (c) => c.toUpperCase()));
    if (out.length >= 12) break;
  }
  return out;
}

export function coverUrl(b: { cover?: number; isbn?: string }, size: 'S' | 'M' | 'L' = 'M'): string | undefined {
  if (b.cover) return `https://covers.openlibrary.org/b/id/${b.cover}-${size}.jpg`;
  if (b.isbn) return `https://covers.openlibrary.org/b/isbn/${b.isbn}-${size}.jpg?default=false`;
  return undefined;
}

export function workUrl(work: string): string {
  return `${OL}/works/${work}`;
}

/** An ISBN-10 or ISBN-13 with a valid check digit, normalized to digits (and X). */
export function normalizeIsbn(raw: string): string | null {
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (/^\d{13}$/.test(s)) {
    const sum = [...s].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? s : null;
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((a, c, i) => a + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0 ? s : null;
  }
  return null;
}
