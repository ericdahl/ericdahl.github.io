# Bookshelf: reading tracker

A phone-first tracker for the books you've read, are reading and want to read. You give each book your own rating and thoughts, and the app fetches the rest from Open Library: cover, description, subjects, page count, community rating and an author bio. It runs in the browser, keeps everything on the device, and exports to JSON Lines. "Add to Home Screen" gives it an app icon.

## Using it

**Shelves** has three tabs: **Reading**, **Want to read** and **Read**. Each tab can be filtered by title or author and sorted. Read books are grouped by the year you finished them, with your stars and the start of your thoughts. Reading books show a progress bar.

**Add** searches Open Library by title, author or ISBN. Tap a result and choose a shelf. You can also:

- **Scan the ISBN barcode** on the back cover. This uses the browser's barcode reader, or a WebAssembly fallback on iPhone. Price barcodes are ignored.
- **Add by hand** for books Open Library doesn't have.

**A book's page** has two parts.

Your part:

- The shelf. Starting a book fills in the start date, finishing fills in the finish date, and starting a read book again counts as a re-read.
- Page progress. Reaching the last page offers to mark the book read.
- Start and finish dates, which you can edit.
- A 1–5 star rating. Tap the same star again to clear it.
- Your thoughts, saved as you type.

What Open Library knows:

- The description and subjects.
- How its readers rated the book, and how many have it on each shelf.
- About the author.
- Links.

Details are cached, so a book's page opens instantly and works offline. Books added by hand or imported are matched to Open Library by ISBN, then by title and author. Edit (pencil) fixes the title, author, pages or ISBN, and can re-match a book that was matched wrongly.

**Stats** shows each year:

- books, pages, average rating and pages per book
- a yearly goal, with whether you're ahead of or behind schedule
- books per month and your rating distribution
- longest, shortest and 5-star books, and authors you read more than once
- a grid of the year's covers

**Data** has export, import and reset.

## Import and export

- **Export.** "Download .jsonl" or "Copy". There's one `book` line per book, with snake_case field names:

  ```jsonl
  {"type":"meta","app":"bookshelf","format_version":1,"exported_at":"…","books":42,"notes":"…"}
  {"type":"settings","yearly_goals":{"2026":24}}
  {"type":"book","id":"ol:OL21745884W","title":"Project Hail Mary","authors":["Andy Weir"],"shelf":"read","my_rating":5,"my_review":"…","date_started":"2026-02-10","date_finished":"2026-03-01","current_page":496,"pages":496,"first_published_year":2021,"isbn":"9780593135204","open_library_work":"OL21745884W","open_library_cover":11200092,"added_at":"…","updated_at":"…"}
  ```

- **Goodreads.** On Goodreads, go to My Books → Import and export → Export library, and import the CSV. It brings in shelves, ratings, reviews, dates read, ISBNs and page counts. Covers and details come from Open Library as you open each book.
- **Importing twice** doesn't duplicate anything. A book that matches one already here, by id, Open Library work, ISBN, or title and first author, is updated.
- **AI-written lines** are accepted too: code fences, plain field names like `rating`, `author` or `finished`, and shelf names like `to-read`.

## Where the data comes from

[Open Library](https://openlibrary.org) is free, needs no key and allows cross-origin requests, so a static page can call it directly. The app uses:

- `search.json` for search, ISBN lookup and matching
- `works/{id}.json` for description, subjects and links
- `works/{id}/ratings.json` and `bookshelves.json` for community ratings and reader counts
- `authors/{id}.json` for bios
- `covers.openlibrary.org` for covers

Its catalog is crowd-edited, so descriptions are cleaned up a little (series lists and markdown links removed), and list tags such as `nyt:…` are dropped from subjects.

Google Books was left out: its keyless quota is zero.

## Storage

Everything is in `localStorage` in this browser on this device. Nothing is sent anywhere except searches and lookups to Open Library. Clearing site data deletes your shelves, so export now and then.

## Development

```
npm install
npm run dev        # http://localhost:5173
npm test           # import/export, Goodreads CSV, stats, sorting, shelf moves (vitest)
npm run e2e        # Playwright, phone and desktop viewports; Open Library is stubbed
npm run build      # typecheck + static build to dist/
node scripts/icons.mjs   # re-render the PNG icons from public/icon.svg
```

Set `PW_CHROMIUM=/path/to/chrome` to run Playwright with an already-installed Chromium.

It's Vite and TypeScript with no framework, like the other apps here, and the GitHub Pages workflow builds and publishes it with them. Source:

- `src/ol.ts`: Open Library
- `src/io.ts`: JSONL and Goodreads import/export
- `src/stats.ts`: yearly stats, sorting, filtering
- `src/store.ts`: storage and shelf moves
- the `*View.ts` files: the pages
