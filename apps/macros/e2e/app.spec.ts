import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  // never reach the real Open Food Facts from tests
  await page.route('**/*openfoodfacts.org/**', (route) => {
    const url = route.request().url();
    if (url.includes('/api/v2/product/0748927022322')) {
      return route.fulfill({
        json: { status: 1, product: { product_name: 'Gold Standard 100% Whey Double Rich Chocolate', brands: 'Optimum Nutrition', serving_size: '1 scoop (31 g)', serving_quantity: 31, nutriments: { 'energy-kcal_100g': 387, proteins_100g: 77.4, fat_100g: 4.8, carbohydrates_100g: 9.7, fiber_100g: 3.2 } } },
      });
    }
    if (url.includes('search.openfoodfacts.org')) {
      return route.fulfill({
        json: { hits: [{ code: '0041196910759', product_name: 'Fairlife Core Power', brands: ['fairlife'], serving_quantity: 414, serving_size: '1 bottle (414 ml)', nutriments: { 'energy-kcal_100g': 41, proteins_100g: 6.3, fat_100g: 1.1, carbohydrates_100g: 1.9 } }] },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
});

async function kcalLeft(page: Page): Promise<string> {
  return (await page.locator('.kcal-center b').textContent()) ?? '';
}

test('quick-add a typical breakfast from one line of text', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.kcal-center')).toContainText('3,000');
  await page.getByLabel('Meal').first().selectOption('breakfast');
  await page.getByLabel('Quick add foods').fill('86g oatmeal dry, 100g blueberries, 2 scoops protein powder (optimum nutrition), 3 fish oil soft gels');
  const rows = page.locator('.preview .prow');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(2)).toContainText('2 scoops Gold Standard 100% Whey');
  await expect(page.locator('.preview-total')).toContainText('653 kcal');
  await page.getByLabel('Quick add foods').press('Enter');
  await expect(page.locator('.meal')).toHaveCount(1);
  await expect(page.locator('.meal .entry')).toHaveCount(4);
  await expect(page.locator('.meal-head')).toContainText('Breakfast');
  await expect(page.locator('.meal-head')).toContainText('653 kcal · P 60');
  expect(await kcalLeft(page)).toBe('2,347');
  await expect(page.locator('.bar.p')).toContainText('140g to go');
  await expect(page.getByLabel('Quick add foods')).toHaveValue('');
  await expect(page.locator('.preview .prow')).toHaveCount(0);

  // survives a reload
  await page.reload();
  await expect(page.locator('.meal .entry')).toHaveCount(4);
});

test('the saved breakfast is one tap, and undo removes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Usual breakfast/ }).click();
  await expect(page.locator('.meal .entry')).toHaveCount(4);
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.meal .entry')).toHaveCount(0);
});

test('edit an entry amount, then delete it', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Quick add foods').fill('2 eggs');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('.entry').first().click();
  const dlg = page.locator('dialog.sheet');
  await dlg.getByLabel('Amount').fill('3');
  await expect(dlg.locator('.live')).toContainText('215 kcal');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.entry')).toContainText('3 eggs');
  await page.locator('.entry').first().click();
  await page.locator('dialog.sheet').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.entry')).toHaveCount(0);
});

test('fat over the limit is flagged', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Quick add foods').fill('pizza 1200 kcal 50p 80f 70c');
  await page.getByLabel('Quick add foods').press('Enter');
  await expect(page.locator('.bar.f')).toHaveClass(/over/);
  await expect(page.locator('.bar.f')).toContainText('10g over');
});

test('unknown food links to search; Open Food Facts results can be logged and are saved', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Quick add foods').fill('1 core power');
  await expect(page.locator('.prow.miss')).toContainText('no match');
  await page.getByRole('link', { name: 'Find it →' }).click();
  await expect(page).toHaveURL(/#\/foods\?q=core%20power/);
  await page.getByRole('button', { name: 'Search Open Food Facts' }).click();
  await page.getByRole('button', { name: /Fairlife Core Power/ }).click();
  const dlg = page.locator('dialog.sheet');
  await expect(dlg.getByLabel('Unit')).toHaveValue('bottle');
  await expect(dlg.locator('.live')).toContainText('170 kcal');
  await dlg.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('h3.section', { hasText: 'Your foods (1)' })).toBeVisible();
  // now the quick-add box knows it
  await page.getByRole('link', { name: 'Today' }).click();
  await page.getByLabel('Quick add foods').fill('1 core power');
  await expect(page.locator('.prow')).toContainText('1 bottle Fairlife Core Power');
});

test('typing a barcode looks it up', async ({ page, context }) => {
  await context.grantPermissions([]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan' }).click();
  const dlg = page.locator('dialog.sheet');
  await dlg.getByLabel('Barcode').fill('0748927022322');
  await dlg.getByRole('button', { name: 'Look up' }).click();
  await expect(page.locator('dialog.sheet .food-name')).toHaveText('Gold Standard 100% Whey Double Rich Chocolate');
  await expect(page.locator('dialog.sheet').getByLabel('Unit')).toHaveValue('scoop');
});

test('create a food from a label, then quick-add it by alias', async ({ page }) => {
  await page.goto('/#/foods');
  await page.getByRole('button', { name: 'New food' }).click();
  const dlg = page.locator('dialog.sheet');
  await dlg.getByLabel('Name', { exact: true }).fill('Kirkland Greek yogurt');
  await dlg.getByLabel('Serving name').fill('cup');
  await dlg.getByLabel('Serving grams').fill('227');
  await dlg.getByLabel('kcal', { exact: true }).fill('');
  await dlg.getByLabel('Protein g').fill('22');
  await dlg.getByLabel('Fat g').fill('0');
  await dlg.getByLabel('Carbs g').fill('9');
  await dlg.getByLabel('Aliases').fill('yogurt, kirkland');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.toast')).toContainText('Saved Kirkland Greek yogurt');
  await page.goto('/');
  await page.getByLabel('Quick add foods').fill('1 cup kirkland');
  await expect(page.locator('.prow')).toContainText('1 cup Kirkland Greek yogurt');
  await expect(page.locator('.prow')).toContainText('124 kcal');
});

test('export JSONL, clear everything, import it back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Usual breakfast/ }).click();
  await page.goto('/#/data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .jsonl' }).click();
  const file = await (await download).path();
  const text = (await import('node:fs')).readFileSync(file, 'utf8');
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  expect(lines[0].type).toBe('meta');
  expect(lines.filter((l) => l.type === 'entry')).toHaveLength(4);
  expect(lines.find((l) => l.type === 'day')).toMatchObject({ kcal: 653, protein_g: 60 });

  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete all data' }).click();
  await expect(page.locator('.meal')).toHaveCount(0);
  await page.goto('/#/data');
  await page.getByLabel('Paste JSON lines').fill(text);
  await page.getByRole('button', { name: 'Import pasted text' }).click();
  await expect(page.locator('.card p.small').last()).toContainText('Imported 4 entries');
  await page.goto('/');
  await expect(page.locator('.meal .entry')).toHaveCount(4);
});

test('targets change the carbs remainder', async ({ page }) => {
  await page.goto('/#/data');
  await page.getByLabel('Calories per day').fill('2500');
  await expect(page.locator('form.card p.muted').first()).toContainText('268g');
  await page.getByRole('button', { name: 'Save targets' }).click();
  await page.goto('/');
  await expect(page.locator('.bar.c')).toContainText('268g');
});

test('history charts render', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Usual breakfast/ }).click();
  await page.goto('/#/history/7');
  await expect(page.locator('figure.chart-card')).toHaveCount(4);
  await expect(page.locator('.tile').first()).toContainText('653');
  await expect(page.locator('table.days tbody tr')).toHaveCount(1);
});

test('protein shake and egg tacos are one tap too', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Egg tacos/ }).click();
  await expect(page.locator('.meal .entry')).toHaveCount(3);
  await expect(page.locator('.meal .entry').nth(1)).toContainText('4 mini tortillas');
  await expect(page.locator('.meal-head')).toContainText('411 kcal · P 29');
  await page.getByRole('button', { name: /Protein shake/ }).click();
  await expect(page.locator('.meal .entry')).toHaveCount(4);
  await expect(page.locator('.meal-head')).toContainText('651 kcal · P 77');
});

test('new built-in meals reach existing users once, and deleted ones stay deleted', async ({ page }) => {
  // someone from before this version: breakfast renamed, no seed tracking yet
  await page.addInitScript(() => {
    if (sessionStorage.getItem('init')) return;
    sessionStorage.setItem('init', '1');
    localStorage.setItem(
      'macros.v1.routines',
      JSON.stringify([{ id: 'r:morning', name: 'My oats', meal: 'breakfast', items: [{ foodId: 'b:oats-dry', qty: 86, unit: 'g' }] }]),
    );
  });
  await page.goto('/');
  const chips = page.locator('.chip.routine');
  await expect(chips).toHaveText([/My oats/, /Protein shake/, /Egg tacos/]);

  await page.goto('/#/foods');
  await page.getByRole('button', { name: /Egg tacos/ }).click();
  page.on('dialog', (d) => d.accept());
  await page.locator('dialog.sheet').getByRole('button', { name: 'Delete' }).click();
  await page.goto('/');
  await page.reload();
  await expect(chips).toHaveText([/My oats/, /Protein shake/]);
});
