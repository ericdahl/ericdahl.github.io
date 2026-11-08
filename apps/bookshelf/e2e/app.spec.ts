import { expect, test, type Page } from '@playwright/test';

const PHM = { key: '/works/OL21745884W', title: 'Project Hail Mary', author_name: ['Andy Weir'], cover_i: 11200092, isbn: ['0593135202', '9780593135204'], first_publish_year: 2021, number_of_pages_median: 496, ratings_average: 4.53, ratings_count: 197, edition_count: 32 };
const MARTIAN = { key: '/works/OL17091839W', title: 'The Martian', author_name: ['Andy Weir'], first_publish_year: 2011, number_of_pages_median: 384, edition_count: 80 };

const calls: string[] = [];

test.beforeEach(async ({ page }) => {
  calls.length = 0;
  page.on('pageerror', (e) => {
    throw e;
  });
  // never reach the real Open Library from tests
  await page.route('**/covers.openlibrary.org/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/openlibrary.org/**', (route) => {
    const url = new URL(route.request().url());
    calls.push(url.pathname + url.search);
    const p = url.pathname;
    if (p === '/search.json') {
      if (url.searchParams.get('isbn') === '9780593135204') return route.fulfill({ json: { docs: [PHM] } });
      if (url.searchParams.get('title')?.toLowerCase().includes('hail mary')) return route.fulfill({ json: { docs: [PHM] } });
      if (url.searchParams.get('q')?.toLowerCase().includes('weir')) return route.fulfill({ json: { docs: [PHM, MARTIAN] } });
      return route.fulfill({ json: { docs: [] } });
    }
    if (p === '/works/OL21745884W.json')
      return route.fulfill({
        json: {
          description: { value: 'Ryland Grace is the sole survivor on a desperate, last-chance mission.\r\n\r\n----------\nAlso contained in: something' },
          subjects: ['Fiction', 'Hard science fiction', 'nyt:hardcover-fiction=2021-05-23', 'Astronauts'],
          authors: [{ author: { key: '/authors/OL7234434A' } }],
          links: [{ title: 'Author site', url: 'https://www.andyweirauthor.com/' }],
        },
      });
    if (p === '/works/OL21745884W/ratings.json') return route.fulfill({ json: { summary: { average: 4.53, count: 197 }, counts: { 1: 1, 2: 5, 3: 11, 4: 52, 5: 128 } } });
    if (p === '/works/OL21745884W/bookshelves.json') return route.fulfill({ json: { counts: { want_to_read: 1173, currently_reading: 46, already_read: 305 } } });
    if (p === '/authors/OL7234434A.json') return route.fulfill({ json: { name: 'Andy Weir', bio: 'A lifelong space nerd.', birth_date: '16 June 1972' } });
    if (p.startsWith('/works/OL17091839W')) return route.fulfill({ json: {} });
    return route.fulfill({ status: 404, json: {} });
  });
});

async function addFromSearch(page: Page, q: string, title: string, shelf: string) {
  await page.goto('/#/add');
  await page.getByLabel('Search books').fill(q);
  await page.locator('.results .book', { hasText: title }).click();
  await page.locator('dialog.sheet').getByRole('button', { name: shelf, exact: true }).click();
}

test('search, add to Want to read, start reading, track progress, finish and rate', async ({ page }) => {
  await addFromSearch(page, 'andy weir', 'Project Hail Mary', 'Want to read');
  await expect(page.locator('.results .book', { hasText: 'Project Hail Mary' })).toContainText('On Want to read');

  await page.getByRole('link', { name: 'Shelves' }).click();
  await expect(page.locator('.seg a.on')).toContainText('Want to read');
  await page.locator('.book', { hasText: 'Project Hail Mary' }).click();

  // details fetched from Open Library
  const about = page.locator('.about');
  await expect(about).toContainText('Ryland Grace is the sole survivor');
  await expect(about).not.toContainText('Also contained in');
  await expect(about).toContainText('Hard science fiction');
  await expect(about.locator('.chip', { hasText: /^nyt/ })).toHaveCount(0);
  await expect(about).toContainText('About Andy Weir');
  await expect(about).toContainText('305 have read it');
  await expect(page.locator('.hero')).toContainText('4.53');

  await page.getByRole('group', { name: 'Shelf' }).getByRole('button', { name: 'Reading' }).click();
  await page.getByLabel('Current page').fill('124');
  await page.getByLabel('Current page').press('Tab');
  await expect(page.locator('.progress.big')).toContainText('25%');
  await expect(page.locator('.progress.big')).toContainText('372 pages to go');

  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.locator('.seg a.on')).toContainText('Reading');
  await expect(page.locator('.book')).toContainText('25% · p. 124 of 496');

  await page.locator('.book').click();
  await page.getByRole('button', { name: 'Finished it' }).click();
  await page.getByRole('radio', { name: '4 stars' }).click();
  await page.getByLabel('Your thoughts').fill('Rocky is the best.');
  await expect(page.locator('.saved')).toHaveText('Saved');
  await expect(page.getByLabel('Finished')).not.toHaveValue('');

  await page.reload();
  await expect(page.getByRole('radio', { name: '4 stars' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByLabel('Your thoughts')).toHaveValue('Rocky is the best.');
  await expect(page.locator('.about')).toContainText('You gave it 4★');

  await page.goto('/#/shelf/read');
  const year = String(new Date().getFullYear());
  await expect(page.locator('.group h3')).toContainText(year);
  await expect(page.locator('.book')).toContainText('Rocky is the best.');
  await expect(page.locator('.book .stars')).toHaveAttribute('aria-label', '4 out of 5 stars');

  await page.getByRole('link', { name: 'Stats' }).click();
  await expect(page.locator('.tile').first()).toContainText('1');
  await expect(page.locator('.tile').nth(1)).toContainText('496');
});

test('cached details show without refetching', async ({ page }) => {
  await addFromSearch(page, 'andy weir', 'Project Hail Mary', 'Read');
  await expect(page.locator('.about')).toContainText('Ryland Grace');
  const n = calls.filter((c) => c.startsWith('/works/OL21745884W.json')).length;
  await page.reload();
  await expect(page.locator('.about')).toContainText('Ryland Grace');
  expect(calls.filter((c) => c.startsWith('/works/OL21745884W.json')).length).toBe(n);
});

test('add by hand, then it gets matched to Open Library', async ({ page }) => {
  await page.goto('/#/add');
  await page.getByRole('button', { name: 'Add by hand' }).click();
  const dlg = page.locator('dialog.sheet');
  await dlg.getByLabel('Title').fill('Project Hail Mary');
  await dlg.getByLabel('Authors').fill('Andy Weir');
  await dlg.getByLabel('Shelf').selectOption('reading');
  await dlg.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.hero h1')).toHaveText('Project Hail Mary');
  await expect(page.locator('.about')).toContainText('Ryland Grace');
  // pages came from Open Library
  await expect(page.getByLabel('Total pages')).toHaveValue('496');
});

test('a book Open Library does not know still works', async ({ page }) => {
  await page.goto('/#/add');
  await page.getByLabel('Search books').fill('my zine');
  await expect(page.locator('.results')).toContainText('Nothing found');
  await page.locator('.results').getByRole('button', { name: 'Add it by hand' }).click();
  await page.locator('dialog.sheet').getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.hero h1')).toHaveText('my zine');
  await expect(page.locator('.about')).toContainText('Couldn’t find this book on Open Library');
  await expect(page.locator('.hero .cover.none')).toBeVisible();
});

test('import a Goodreads export, then export JSONL', async ({ page }) => {
  await page.goto('/#/data');
  const csv = [
    'Book Id,Title,Author,Additional Authors,ISBN,ISBN13,My Rating,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Exclusive Shelf,My Review',
    '1,Project Hail Mary,Andy Weir,,"=""0593135202""","=""9780593135204""",5,476,2021,2021,2025/03/09,2025/02/01,read,Great.',
    '2,Dune,Frank Herbert,,,,0,,1990,1965,,2025/01/05,to-read,',
  ].join('\n');
  await page.getByLabel('Paste data to import').fill(csv);
  await page.getByRole('button', { name: 'Import pasted' }).click();
  await expect(page.locator('.toast')).toContainText('2 new books');
  // importing again updates rather than duplicates
  await page.getByLabel('Paste data to import').fill(csv);
  await page.getByRole('button', { name: 'Import pasted' }).click();
  await expect(page.locator('.toast')).toContainText('0 new books, 2 books updated');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .jsonl' }).click();
  const file = await download;
  const text = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  expect(lines[0]).toMatchObject({ type: 'meta', app: 'bookshelf', books: 2 });
  expect(lines.find((l) => l.title === 'Project Hail Mary')).toMatchObject({ shelf: 'read', my_rating: 5, date_finished: '2025-03-09', my_review: 'Great.', isbn: '9780593135204' });

  await page.goto('/#/stats/2025');
  await expect(page.locator('.tile').first()).toContainText('1');
  await page.goto('/#/shelf/want');
  await expect(page.locator('.book')).toContainText('Dune');
});

test('remove a book and undo', async ({ page }) => {
  await addFromSearch(page, 'andy weir', 'The Martian', 'Want to read');
  await page.goto('/#/shelf/want');
  await page.locator('.book').click();
  await page.getByRole('button', { name: 'Remove book' }).click();
  await expect(page.locator('.empty')).toBeVisible();
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.book')).toContainText('The Martian');
});

test('reading goal', async ({ page }) => {
  await page.goto('/#/stats');
  await page.getByRole('button', { name: 'Set a goal' }).click();
  await page.locator('dialog.sheet').getByLabel('Books').fill('24');
  await page.locator('dialog.sheet').getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.goal')).toContainText('0 of 24 books');
});

test('no horizontal scroll on any page', async ({ page }) => {
  await addFromSearch(page, 'andy weir', 'Project Hail Mary', 'Reading');
  for (const hash of ['#/', '#/shelf/read', '#/add', '#/stats', '#/data', '#/book/ol%3AOL21745884W']) {
    await page.goto(`/${hash}`);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, hash).toBeLessThanOrEqual(0);
  }
});
