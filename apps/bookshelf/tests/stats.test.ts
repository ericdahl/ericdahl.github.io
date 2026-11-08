import { describe, expect, it } from 'vitest';
import { cleanDescription, cleanSubjects, normalizeIsbn } from '../src/ol';
import { goalPace, matches, sortBooks, yearStats, years } from '../src/stats';
import { moveTo } from '../src/store';
import type { Book } from '../src/types';

const b = (o: Partial<Book>): Book => ({ id: o.title ?? 'x', title: 'x', authors: [], shelf: 'read', added: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z', ...o });

describe('year stats', () => {
  const books = [
    b({ title: 'A', finished: '2026-01-10', pages: 300, rating: 5, authors: ['Ann Leckie'] }),
    b({ title: 'B', finished: '2026-01-20', pages: 100, rating: 3, authors: ['Ann Leckie'] }),
    b({ title: 'C', finished: '2026-07-04', rating: 4 }),
    b({ title: 'D', finished: '2025-12-31', pages: 999 }),
    b({ title: 'E', shelf: 'reading', finished: undefined }),
  ];
  it('counts the books finished that year', () => {
    const s = yearStats(books, 2026);
    expect(s.books.map((x) => x.title)).toEqual(['A', 'B', 'C']);
    expect(s.pages).toBe(400);
    expect(s.missingPages).toBe(1);
    expect(s.avgRating).toBe(4);
    expect(s.byMonth[0]).toBe(2);
    expect(s.byMonth[6]).toBe(1);
    expect(s.byRating).toEqual([0, 0, 1, 1, 1]);
    expect(s.longest?.title).toBe('A');
    expect(s.shortest?.title).toBe('B');
    expect(s.topAuthors).toEqual([{ name: 'Ann Leckie', count: 2 }]);
  });
  it('lists years newest first, including this one', () => {
    expect(years(books, 2027)).toEqual([2027, 2026, 2025]);
  });
  it('works out goal pace', () => {
    expect(goalPace(6, 24, 2026, new Date(2026, 6, 2))).toBeCloseTo(-6, 0);
    expect(goalPace(30, 24, 2026, new Date(2026, 11, 31))).toBeGreaterThan(5);
  });
});

describe('sorting and filtering', () => {
  const list = [b({ title: 'The Zebra', authors: ['Amy Adams'] }), b({ title: 'Apple', authors: ['Zed Brown'] }), b({ title: 'Émile', authors: ['Jean-Jacques Rousseau'] })];
  it('ignores leading articles and sorts authors by last name', () => {
    expect(sortBooks(list, 'title').map((x) => x.title)).toEqual(['Apple', 'Émile', 'The Zebra']);
    expect(sortBooks(list, 'author').map((x) => x.authors[0])).toEqual(['Amy Adams', 'Zed Brown', 'Jean-Jacques Rousseau']);
  });
  it('matches every word, ignoring accents', () => {
    expect(matches(list[2], 'emile rousseau')).toBe(true);
    expect(matches(list[2], 'emile adams')).toBe(false);
  });
});

describe('moving between shelves', () => {
  const base = b({ shelf: 'want', pages: 200 });
  it('starting sets the start date, finishing sets the finish date and last page', () => {
    const r = moveTo(base, 'reading', '2026-03-01');
    expect(r).toMatchObject({ shelf: 'reading', started: '2026-03-01' });
    const d = moveTo({ ...r, page: 120 }, 'read', '2026-03-09');
    expect(d).toMatchObject({ shelf: 'read', started: '2026-03-01', finished: '2026-03-09', page: 200 });
  });
  it('starting a read book again is a re-read', () => {
    const r = moveTo(b({ shelf: 'read', started: '2020-01-01', finished: '2020-02-01', rating: 4 }), 'reading', '2026-05-05');
    expect(r).toMatchObject({ started: '2026-05-05', finished: undefined, rating: 4 });
  });
});

describe('open library helpers', () => {
  it('validates ISBNs', () => {
    expect(normalizeIsbn('978-0-593-13520-4')).toBe('9780593135204');
    expect(normalizeIsbn('0-593-13520-2')).toBe('0593135202');
    expect(normalizeIsbn('080442957X')).toBe('080442957X');
    expect(normalizeIsbn('9780593135205')).toBeNull();
    expect(normalizeIsbn('hello')).toBeNull();
  });
  it('cleans subjects', () => {
    expect(cleanSubjects(['Fiction', 'science-fiction', 'Science fiction', 'nyt:hardcover-fiction=2021', 'astronauts'])).toEqual(['Science-fiction', 'Astronauts']);
  });
  it('cleans descriptions', () => {
    expect(cleanDescription('A **great** [book][1].\r\n\r\n----------\nAlso contained in:\n[Omnibus](https://x)')).toBe('A great book.');
  });
});
