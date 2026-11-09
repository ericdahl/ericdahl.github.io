import { expect, test } from '@playwright/test';

// The caravan journey south: the story beat pauses the game, the new town has its own people and quests.
test('the caravan carries you to Tel Maresh', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=11&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.setQuest('forge', 'rewarded');
    w.enterArea('cinder_fields', 'start');
    w.enterArea('town', 'start');
    w.cmdInteract({ kind: 'npc', id: w.area.npcs.find((n: any) => n.kind === 'caravan').id });
  });
  await expect(page.locator('.panel.caravan')).toBeVisible({ timeout: 15000 });
  await page.locator('.panel.caravan .btn.primary').click();

  await expect(page.locator('.ov-box.story .ov-title')).toHaveText('Tel Maresh');
  const t0 = await page.evaluate(() => (window as any).game.world.time);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).game.world.time)).toBe(t0);
  await page.screenshot({ path: `test-results/${info.project.name}-act2-story.png` });
  await page.locator('.ov-box.story .btn.primary').click();
  await expect(page.locator('.overlay')).toBeHidden();

  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.cmdInteract({ kind: 'npc', id: w.area.npcs.find((n: any) => n.kind === 'sage').id });
  });
  await expect(page.locator('.panel.sage .quest')).toHaveCount(4, { timeout: 15000 });
  await expect(page.locator('.panel.sage .p-title')).toContainText('Keeper Imre');
  expect(errors).toEqual([]);
});
