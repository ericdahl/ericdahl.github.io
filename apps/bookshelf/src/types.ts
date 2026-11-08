export const SHELVES = ['reading', 'want', 'read'] as const;
export type Shelf = (typeof SHELVES)[number];

export const SHELF_LABEL: Record<Shelf, string> = { reading: 'Reading', want: 'Want to read', read: 'Read' };

/** One book on your shelves. Everything personal lives here; Open Library details are cached separately. */
export interface Book {
  /** "ol:OL21745884W" for an Open Library work, "m:…" for one added by hand or imported. */
  id: string;
  /** Open Library work key, "OL21745884W". Found later for hand-added and imported books. */
  work?: string;
  title: string;
  authors: string[];
  /** Open Library cover id. */
  cover?: number;
  isbn?: string;
  /** First published. */
  year?: number;
  pages?: number;
  shelf: Shelf;
  /** Your rating, 1–5. */
  rating?: number;
  /** Your thoughts, free text. */
  review?: string;
  /** Page you're on, for books you're reading. */
  page?: number;
  /** Local dates, YYYY-MM-DD. */
  started?: string;
  finished?: string;
  /** ISO 8601. */
  added: string;
  updated: string;
}

/** What Open Library knows about a work, cached so the book page works offline. */
export interface Details {
  work: string;
  description?: string;
  subjects: string[];
  links: { title: string; url: string }[];
  /** Community rating, 1–5, and how many people rated. */
  ratingAvg?: number;
  ratingCount?: number;
  ratingCounts?: Record<string, number>;
  /** How many Open Library readers have it on each shelf. */
  shelfCounts?: { want: number; reading: number; read: number };
  authors: { key: string; name: string; bio?: string; birth?: string; death?: string }[];
  firstPublished?: string;
  fetched: string;
}

/** A search hit from Open Library, before it's on a shelf. */
export interface Hit {
  work: string;
  title: string;
  authors: string[];
  cover?: number;
  isbn?: string;
  year?: number;
  pages?: number;
  ratingAvg?: number;
  ratingCount?: number;
  editions?: number;
}
