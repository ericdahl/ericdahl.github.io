import { describe, expect, it } from 'vitest';
import { fromGoodreads, fromJsonl, parseCsv, parseImport, toJsonl } from '../src/io';
import type { Book } from '../src/types';

let n = 0;
const id = () => `m:${++n}`;

const book = (o: Partial<Book>): Book => ({
  id: 'ol:OL1W',
  work: 'OL1W',
  title: 'Book',
  authors: ['A. Author'],
  shelf: 'read',
  added: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-02T00:00:00.000Z',
  ...o,
});

describe('csv', () => {
  it('handles quotes, doubled quotes and newlines inside quotes', () => {
    expect(parseCsv('a,b,c\n"x, y","he said ""hi""","line1\nline2"\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['x, y', 'he said "hi"', 'line1\nline2'],
    ]);
  });
});

describe('goodreads import', () => {
  const csv = [
    'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies',
    '54493401,Project Hail Mary,Andy Weir,"Weir, Andy",,"=""0593135202""","=""9780593135204""",5,4.52,Ballantine Books,Hardcover,476,2021,2021,2024/03/09,2024/02/01,,,read,"Loved Rocky.<br/><br/>Would reread.",,,1,0',
    '1,Dune,Frank Herbert,"Herbert, Frank",,"=""""","=""""",0,4.27,Ace,Paperback,,1990,1965,,2025/01/05,to-read,to-read (#1),to-read,,,,0,0',
    '2,"The Fellowship of the Ring (The Lord of the Rings, #1)",J.R.R. Tolkien,"Tolkien, J.R.R.","Alan Lee, Christopher Tolkien",,,0,4.38,,,432,2012,1954,,2025/06/01,currently-reading,,currently-reading,,,,0,0',
  ].join('\n');

  it('maps shelves, ratings, ISBNs, dates and reviews', () => {
    const { books, errors } = fromGoodreads(csv, id);
    expect(errors).toEqual([]);
    expect(books).toHaveLength(3);
    const [phm, dune, lotr] = books;
    expect(phm).toMatchObject({ title: 'Project Hail Mary', authors: ['Andy Weir'], isbn: '9780593135204', rating: 5, pages: 476, year: 2021, shelf: 'read', finished: '2024-03-09', review: 'Loved Rocky.\n\nWould reread.' });
    expect(dune).toMatchObject({ title: 'Dune', shelf: 'want', year: 1965, rating: undefined, isbn: undefined, pages: undefined });
    expect(lotr.shelf).toBe('reading');
    expect(lotr.authors).toEqual(['J.R.R. Tolkien', 'Alan Lee', 'Christopher Tolkien']);
  });

  it('is detected by parseImport', () => {
    expect(parseImport(csv, id).books).toHaveLength(3);
  });

  it('explains a CSV that is not from Goodreads', () => {
    expect(fromGoodreads('foo,bar\n1,2', id).errors[0]).toMatch(/Title/);
  });
});

describe('jsonl', () => {
  it('round-trips books and goals', () => {
    const books = [
      book({ rating: 4, review: 'Good.\nReally.', finished: '2026-03-01', started: '2026-02-10', pages: 300, page: 300, isbn: '9780000000002', cover: 123, year: 1999 }),
      book({ id: 'm:abc', work: undefined, title: 'Zine', shelf: 'want', authors: [] }),
      book({ id: 'ol:OL2W', work: 'OL2W', shelf: 'reading', page: 40, pages: 200 }),
    ];
    const text = toJsonl(books, { goals: { '2026': 24 } });
    const back = fromJsonl(text, id);
    expect(back.errors).toEqual([]);
    expect(back.settings).toEqual({ goals: { '2026': 24 } });
    expect(back.books).toEqual(books);
  });

  it('accepts what an AI tends to write', () => {
    const text = '```jsonl\n{"title":"Piranesi","author":"Susanna Clarke","shelf":"read","rating":4.6,"finished":"2025/9/3"}\n{"type":"book","title":"Circe","shelf":"to-read"}\nnot json\n```';
    const { books, errors } = parseImport(text, id);
    expect(errors).toHaveLength(1);
    expect(books[0]).toMatchObject({ title: 'Piranesi', authors: ['Susanna Clarke'], shelf: 'read', rating: 5, finished: '2025-09-03' });
    expect(books[1]).toMatchObject({ title: 'Circe', shelf: 'want' });
  });
});
