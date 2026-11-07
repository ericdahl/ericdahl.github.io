import { createHash } from 'node:crypto';
import { expect, test, type Page, type Route } from '@playwright/test';

/** An in-memory GitHub with just the endpoints the app uses. */
class FakeGitHub {
  files = new Map<string, string>(); // path -> text
  blobs = new Map<string, string>(); // sha -> text
  commits: string[] = [];
  requests = 0;
  /** Called before a write is accepted; return true to refuse it with 409 (the file changed meanwhile). */
  beforeWrite: ((path: string) => boolean) | null = null;

  sha(text: string): string {
    const s = createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0${text}`).digest('hex');
    this.blobs.set(s, text);
    return s;
  }
  set(path: string, text: string) {
    this.files.set(path, text);
    this.sha(text);
  }
  lines(path: string): Record<string, unknown>[] {
    return (this.files.get(path) ?? '').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  async handle(route: Route) {
    this.requests++;
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/repos\/me\/fitness/, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body, headers: { 'access-control-allow-origin': '*' } });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (req.headers()['authorization'] !== 'Bearer github_pat_test') return json({ message: 'Bad credentials' }, 401);
    if (p === '') return json({ default_branch: 'main', private: true, permissions: { push: true } });
    if (p.startsWith('/git/trees/')) return json({ truncated: false, tree: [...this.files].map(([path, text]) => ({ path, type: 'blob', sha: this.sha(text) })) });
    if (p.startsWith('/git/blobs/')) {
      const text = this.blobs.get(p.split('/').pop()!);
      return text == null ? json({ message: 'Not Found' }, 404) : json({ content: Buffer.from(text).toString('base64'), encoding: 'base64' });
    }
    if (p.startsWith('/contents/')) {
      const path = decodeURIComponent(p.slice('/contents/'.length));
      const cur = this.files.get(path);
      if (req.method() === 'GET') return cur == null ? json({ message: 'Not Found' }, 404) : json({ content: Buffer.from(cur).toString('base64'), encoding: 'base64', sha: this.sha(cur) });
      const body = req.postDataJSON() as { content?: string; sha?: string; message: string };
      if ((cur == null ? undefined : this.sha(cur)) !== body.sha) return json({ message: 'sha mismatch' }, 409);
      if (this.beforeWrite?.(path)) return json({ message: 'is at a different sha' }, 409);
      this.commits.push(body.message);
      if (req.method() === 'DELETE') {
        this.files.delete(path);
        return json({ commit: {} });
      }
      const text = Buffer.from(body.content!, 'base64').toString('utf8');
      this.set(path, text);
      return json({ content: { sha: this.sha(text) } });
    }
    return json({ message: 'Not Found' }, 404);
  }
}

const RUN = '{"ts": "2026-01-01T07:10:00-08:00", "type": "cardio", "modality": "run", "distance_miles": 3.1, "source": "cli", "raw": "/log run 3.1"}';

let gh: FakeGitHub;
let today: string;
let todayPath: string;

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  gh = new FakeGitHub();
  await page.route('https://api.github.com/**', (r) => gh.handle(r));
  await page.goto('/');
  today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  todayPath = `db/${today.replace(/-/g, '/')}.jsonl`;
});

const run = () => RUN.replace('2026-01-01', today);
const bench = () => `{"ts": "${today}T17:45:00-08:00", "type": "strength", "exercise": "bench_press", "unit": "lb", "sets": [{"weight": 275.0, "reps": 3}], "source": "claude", "raw": "bench 275 3"}`;

async function connect(page: Page) {
  await page.goto('/#/data');
  await page.getByLabel('Repository').fill('me/fitness');
  await page.getByLabel('Token').fill('github_pat_test');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.locator('.sync-card')).toContainText(/Synced/, { timeout: 10_000 });
}

const foods = () => gh.lines(todayPath).filter((l) => l.type === 'food');

test('standalone by default: nothing talks to GitHub', async ({ page }) => {
  await page.getByLabel('Quick add foods').fill('2 eggs');
  await page.getByLabel('Quick add foods').press('Enter');
  await expect(page.locator('.entry')).toHaveCount(1);
  await expect(page.locator('.sync-pill')).toBeHidden();
  await page.waitForTimeout(2500);
  expect(gh.requests).toBe(0);
});

test('connecting uploads what is on the device, beside the workouts already in the file', async ({ page }) => {
  gh.set(todayPath, run() + '\n');
  await page.getByRole('button', { name: /Usual breakfast/ }).click();
  await connect(page);
  await expect.poll(foods).toHaveLength(4);
  const text = gh.files.get(todayPath)!;
  expect(text.split('\n')[0]).toBe(run()); // the workout line is untouched, and still first (07:10)
  expect(foods()[0]).toMatchObject({ type: 'food', meal: 'breakfast', food: 'Rolled oats (dry)', qty: 86, unit: 'g', kcal: 326, protein_g: 11.4, source: 'app', raw: 'saved meal: Usual breakfast' });
  expect(gh.commits).toEqual([expect.stringMatching(/^food: \d{4}-\d{2}-\d{2} Rolled oats \(dry\), Blueberries, Gold Standard 100% Whey \(Optimum Nutrition\) \+1 more$/)]);
});

test('logging, editing and deleting are pushed; Claude’s lines and workouts survive', async ({ page }) => {
  gh.set(
    todayPath,
    run() + '\n' + `{"ts": "${today}T12:30:00-08:00", "type": "food", "food": "Chipotle bowl", "calories": 665, "protein": 52, "fat": 24, "carbs": 63, "source": "claude", "raw": "chipotle bowl"}\n`,
  );
  await connect(page);
  await page.goto('/');
  // pulled in from the repo
  await expect(page.locator('.entry')).toContainText(['Chipotle bowl']);
  await expect(page.locator('.sync-pill')).toContainText('Synced');

  await page.getByLabel('Quick add foods').fill('4 eggs');
  await page.getByLabel('Quick add foods').press('Enter');
  await expect.poll(() => foods().map((f) => f.food), { timeout: 10_000 }).toContain('Egg, large');
  // Claude's line is written back exactly as it was, not rewritten with an id
  expect(gh.files.get(todayPath)!.split('\n')).toContain(
    `{"ts": "${today}T12:30:00-08:00", "type": "food", "food": "Chipotle bowl", "calories": 665, "protein": 52, "fat": 24, "carbs": 63, "source": "claude", "raw": "chipotle bowl"}`,
  );

  // edit the eggs
  await page.locator('.entry', { hasText: 'Egg' }).click();
  await page.locator('dialog.sheet').getByLabel('Amount').fill('3');
  await page.locator('dialog.sheet').getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => foods().find((f) => f.food === 'Egg, large')?.qty, { timeout: 10_000 }).toBe(3);

  // delete Claude's bowl from the app
  await page.locator('.entry', { hasText: 'Chipotle' }).click();
  await page.locator('dialog.sheet').getByRole('button', { name: 'Delete' }).click();
  await expect.poll(() => foods().map((f) => f.food), { timeout: 10_000 }).toEqual(['Egg, large']);
  expect(gh.lines(todayPath)[0]).toMatchObject({ type: 'cardio' });
  expect(gh.commits.at(-1)).toMatch(/remove 1/);
});

test('a workout committed while saving is kept: the write is refused and redone', async ({ page }) => {
  gh.set(todayPath, run() + '\n');
  await connect(page);
  await page.goto('/');
  let raced = false;
  gh.beforeWrite = (path) => {
    if (raced) return false;
    raced = true;
    gh.set(path, gh.files.get(path)! + bench() + '\n'); // Claude logs bench at the same moment
    return true;
  };
  await page.getByLabel('Quick add foods').fill('2 scoops whey');
  await page.getByLabel('Quick add foods').press('Enter');
  await expect.poll(foods, { timeout: 10_000 }).toHaveLength(1);
  expect(gh.lines(todayPath).map((l) => l.type)).toContain('strength');
  expect(gh.files.get(todayPath)).toContain(bench());
});

test('changes made in the repo show up in the app', async ({ page }) => {
  await connect(page);
  await page.goto('/');
  await page.getByLabel('Quick add foods').fill('1 banana');
  await page.getByLabel('Quick add foods').press('Enter');
  await expect.poll(foods, { timeout: 10_000 }).toHaveLength(1);
  // Claude removes the banana and logs a burrito in the repo
  gh.set(todayPath, `{"ts": "${today}T13:00:00-08:00", "type": "food", "food": "Burrito", "kcal": 1000, "protein_g": 50, "fat_g": 40, "carbs_g": 110, "source": "claude", "raw": "burrito"}\n`);
  await page.locator('.sync-pill').click();
  await expect(page.locator('.entry')).toHaveCount(1);
  await expect(page.locator('.entry')).toContainText('Burrito');
  await expect(page.locator('.kcal-center b')).toHaveText('2,000');
});

test('a bad token is reported and nothing is saved', async ({ page }) => {
  await page.goto('/#/data');
  await page.getByLabel('Repository').fill('me/fitness');
  await page.getByLabel('Token').fill('nope');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.locator('.sync-card .warn')).toContainText('token was rejected');
  await page.goto('/');
  await expect(page.locator('.sync-pill')).toBeHidden();
});

test('disconnect keeps the entries', async ({ page }) => {
  gh.set(todayPath, `{"ts": "${today}T13:00:00-08:00", "type": "food", "food": "Burrito", "kcal": 1000, "source": "claude", "raw": "burrito"}\n`);
  await connect(page);
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.entry')).toContainText('Burrito');
  await expect(page.locator('.sync-pill')).toBeHidden();
});
