import { expect, test } from '@playwright/test';

// One respec for each difficulty finished, spent from the Character or Skills panel behind a second ask.
test('a finished difficulty earns a respec that gives every point back', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=5&class=arcanist');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const g = (window as any).game;
    const c = g.world.char;
    c.level = 20;
    c.skills = { fire_bolt: 8, ice_bolt: 5 };
    c.alloc = { str: 5, dex: 0, vit: 40, ene: 50 };
    g.world.refreshStats();
    g.open('skills');
  });
  await expect(page.locator('.panel.skl .respec')).toContainText('Finish a difficulty to earn a respec');
  await expect(page.locator('.respec-btn')).toHaveCount(0);

  await page.evaluate(() => {
    const g = (window as any).game;
    g.world.setQuest('rekindle', 'rewarded');
    g.refresh();
  });
  await expect(page.locator('.respec-btn')).toHaveText('Respec (1 respec left)');
  await page.locator('.respec-btn').scrollIntoViewIfNeeded();
  await page.locator('.respec-btn').click();
  await expect(page.locator('.respec')).toContainText('it is your last');
  await page.screenshot({ path: `test-results/${info.project.name}-respec-ask.png` });
  // Backing out changes nothing.
  await page.locator('.respec-no').click();
  expect(await page.evaluate(() => (window as any).game.world.char.skills.fire_bolt)).toBe(8);

  await page.locator('.respec-btn').click();
  await page.locator('.respec-yes').click();
  const c = await page.evaluate(() => {
    const ch = (window as any).game.world.char;
    return { skills: ch.skills, sp: ch.skillPoints, st: ch.statPoints, alloc: ch.alloc, used: ch.respecsUsed };
  });
  expect(c).toEqual({ skills: { fire_bolt: 1 }, sp: 12, st: 95, alloc: { str: 0, dex: 0, vit: 0, ene: 0 }, used: 1 });
  await expect(page.locator('.panel.skl .p-sub')).toHaveText('12 points to spend');
  await expect(page.locator('.respec')).toContainText('Finish Nightmare to earn another');

  await page.evaluate(() => (window as any).game.open('character'));
  await expect(page.locator('.panel.char')).toContainText('Stat points: 95');
  await expect(page.locator('.panel.char .respec')).toContainText('Finish Nightmare to earn another');
  await page.screenshot({ path: `test-results/${info.project.name}-respec-done.png` });
  expect(errors).toEqual([]);
});
