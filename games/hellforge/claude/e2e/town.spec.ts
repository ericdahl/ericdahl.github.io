import { expect, test, type Page } from '@playwright/test';

async function talkTo(page: Page, kind: string) {
  await page.evaluate((k) => {
    const w = (window as any).game.world;
    const npc = w.area.npcs.find((n: any) => n.kind === k);
    w.cmdInteract({ kind: 'npc', id: npc.id });
  }, kind);
}

test('town services: smith, stash, sage and waypoint', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=5');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => ((window as any).game.world.char.gold = 50000));

  // Buy from the smith, then sell it back.
  await talkTo(page, 'smith');
  await expect(page.locator('.panel.vend')).toBeVisible({ timeout: 15000 });
  await page.locator('.vrow').first().click();
  await page.getByRole('button', { name: 'Buy' }).click();
  await expect(page.locator('.grid .itm')).toHaveCount(1);
  await page.screenshot({ path: `test-results/${info.project.name}-smith.png` });
  await page.locator('.grid .itm').first().click();
  await page.getByRole('button', { name: /^Sell/ }).click();
  await expect(page.locator('.grid .itm')).toHaveCount(0);
  await page.locator('.p-close').click();

  // Stash: deposit gold.
  await page.evaluate(() => (window as any).game.world.cmdInteract({ kind: 'stash' }));
  await expect(page.locator('.panel.stash')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Deposit gold' }).click();
  expect(await page.evaluate(() => (window as any).game.world.char.stashGold)).toBeGreaterThan(0);
  await page.locator('.p-close').click();

  // Sage lists quests.
  await talkTo(page, 'sage');
  await expect(page.locator('.panel.sage .quest')).toHaveCount(3, { timeout: 15000 });
  await page.locator('.p-close').click();

  // Waypoint shows only town as active.
  await page.evaluate(() => (window as any).game.world.cmdInteract({ kind: 'waypoint' }));
  await expect(page.locator('.panel.wpp')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.btn.wp:not(.off)')).toHaveCount(1);
  await page.locator('.p-close').click();
  expect(errors).toEqual([]);
});

test('vendor detail stays on screen after selecting an item', async ({ page }) => {
  await page.goto('/?autostart&seed=5');
  await page.waitForFunction(() => !!(window as any).game);
  await talkTo(page, 'smith');
  await expect(page.locator('.panel.vend')).toBeVisible({ timeout: 15000 });
  await page.locator('.vrow').first().click();
  await expect(page.getByRole('button', { name: 'Buy' })).toBeInViewport();
});
