import { expect, test } from '@playwright/test';

// The stash has two tabs: the hero's own, and one every hero on the device shares. What one hero leaves, the next finds.
test('one hero leaves an item in the shared stash and another takes it out', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=3&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  const openStash = () => page.evaluate(() => {
    const g = (window as any).game;
    g.world.char.gold = 900;
    g.open('stash');
  });
  await openStash();
  await expect(page.locator('.stash-tabs .btn.tab')).toHaveCount(2);
  await expect(page.locator('.stash-tabs .btn.tab.on')).toHaveText('Tester');

  // The starting sword goes into the shared tab, with some gold.
  await page.evaluate(() => {
    const g = (window as any).game;
    g.world.unequip('weapon');
    g.refresh();
  });
  await page.locator('.stash-tabs [data-tab="shared"]').click();
  await expect(page.locator('.shared-say')).toContainText('Every hero on this device');
  await page.locator('.panel.stash .grid .itm[data-from="inv"]').first().click();
  await page.getByRole('button', { name: /To Shared Stash/ }).click();
  await page.getByRole('button', { name: 'Deposit gold' }).click();
  await expect(page.locator('.panel.stash .sub-row').first()).toContainText('Shared stash · 900 gold');
  await expect(page.locator('.panel.stash .grid .itm[data-from="stash"]')).toHaveCount(1);
  await page.screenshot({ path: `test-results/${info.project.name}-shared-stash.png` });
  // The hero's own tab is still empty.
  await page.locator('.stash-tabs [data-tab="own"]').click();
  await expect(page.locator('.panel.stash .grid .itm[data-from="stash"]')).toHaveCount(0);
  await page.evaluate(() => (window as any).game.close());

  // A second hero, after a reload, finds both.
  await page.goto('/?autostart&seed=4&class=arcanist');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => (window as any).game.open('stash'));
  await page.locator('.stash-tabs [data-tab="shared"]').click();
  await expect(page.locator('.panel.stash .sub-row').first()).toContainText('900 gold');
  await page.locator('.panel.stash .grid .itm[data-from="stash"]').click();
  await expect(page.locator('.detail .tt').first()).toContainText('Short Sword');
  await page.getByRole('button', { name: /To Inventory/ }).click();
  await expect(page.locator('.panel.stash .grid .itm[data-from="stash"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).game.world.char.inventory.some((e: any) => e.item.base === 'short_sword'))).toBe(true);
  expect(errors).toEqual([]);
});
