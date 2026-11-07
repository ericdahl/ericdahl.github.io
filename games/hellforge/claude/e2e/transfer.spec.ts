import { expect, test } from '@playwright/test';

test('export a hero as a code and import it back', async ({ page, context, browserName }, info) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.locator('.name-in').fill('Mira');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => (window as any).game.save());
  await page.goto('/');
  await expect(page.locator('.char-card')).toContainText('Mira');

  // Export: file download and save code.
  await page.getByRole('button', { name: 'Export / Import' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download file' }).click();
  expect((await dl).suggestedFilename()).toMatch(/^hellforge-save-.*\.json$/);
  await page.getByRole('button', { name: 'Copy save code' }).click();
  await expect(page.locator('.xfer-code')).toHaveValue(/^HF1\./);
  const code = await page.locator('.xfer-code').inputValue();
  await page.screenshot({ path: `test-results/${info.project.name}-transfer.png` });
  await page.getByRole('button', { name: 'Close' }).click();

  // Wipe the hero, then import it from the code.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.char-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Export / Import' }).click();
  await page.locator('.xfer-code').fill('garbage');
  await page.getByRole('button', { name: 'Import code' }).click();
  await expect(page.locator('.xfer-status.bad')).toBeVisible();
  await page.locator('.xfer-code').fill(code);
  await page.getByRole('button', { name: 'Import code' }).click();
  await expect(page.locator('.char-card')).toContainText('Mira');
  // The version number opens the changelog.
  await page.locator('.ver-link').click();
  await expect(page.locator('.changelog .cl-ver').first()).toHaveText(/^v\d+\.\d+\.\d+$/);
  await page.screenshot({ path: `test-results/${info.project.name}-changelog.png` });
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.changelog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
