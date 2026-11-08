import { expect, test } from '@playwright/test';

test('inventory separates worn gear and compares a selected item', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=5&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  // Carry a few rolled items to compare against the starting gear.
  await page.evaluate(() => {
    const g = (window as any).game;
    const w = g.world;
    w.char.level = 12;
    w.refreshStats();
    for (const base of ['hand_axe', 'quilted_armor', 'cap']) w.char.inventory.push({ item: { uid: 8000 + w.char.inventory.length, base, rarity: 'magic', ilvl: 10, identified: true, mods: [{ stat: 'life', value: 15 }, { stat: 'fireRes', value: 12 }], sockets: 0, gems: [], reqLvl: 1 }, x: w.char.inventory.length * 2, y: 0 });
  });
  await page.keyboard.press('i');
  await expect(page.locator('.equip-box .sub')).toHaveText('Equipped');
  await page.locator('.grid .itm').first().click();
  await expect(page.locator('.cmp-h').first()).toHaveText('Selected');
  await expect(page.locator('.cmp .tt')).toHaveCount(2);
  await expect(page.locator('.delta .drow.up').first()).toBeVisible();
  await expect(page.locator('.delta')).toContainText('Fire Resist');
  await page.screenshot({ path: `test-results/${info.project.name}-compare.png` });
  // A slot with nothing worn says so.
  await page.locator('.grid .itm').nth(2).click();
  await expect(page.locator('.tt.empty')).toContainText('No helm equipped');
  // Worn items show no comparison.
  await page.locator('.doll .s-wpn .itm').click();
  await expect(page.locator('.cmp')).toHaveCount(0);
  expect(errors).toEqual([]);
});
