import { test, expect } from '@playwright/test';

test('create a hero, talk to the porter and reach the frontier', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).game, null, { timeout: 90_000 });
  await expect(page.locator('#title h1')).toHaveText(/Realmfall/i);
  await page.locator('.cls[data-c="ranger"]').click();
  await page.locator('#title input').fill('Smoketest');
  await page.locator('[data-go]').click();
  await expect(page.locator('#pframe .nm')).toHaveText('Smoketest', { timeout: 20_000 });
  await page.screenshot({ path: 'test-results/town.png' });

  // walk up to the porter and travel
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const porter = w.list.find((e: any) => e.role === 'teleporter' && e.realm === w.player.realm);
    w.player.x = porter.x + 2;
    w.player.z = porter.z;
  });
  await expect(page.locator('#prompt')).toContainText('Porter', { timeout: 10_000 });
  await page.keyboard.press('f');
  await page.locator('[data-travel]').filter({ hasText: 'Frontier' }).click();
  await expect(page.locator('#mm .zone')).toContainText(/Gate/, { timeout: 15_000 });

  // panels open and close
  await page.keyboard.press('m');
  await expect(page.locator('.panel[data-id="map"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/map.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel[data-id="map"]')).toBeHidden();

  // the hero was saved
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('realmfall.chars') ?? '[]').length);
  expect(saved).toBe(1);
  expect(errors).toEqual([]);
});
