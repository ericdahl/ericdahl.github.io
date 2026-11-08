import { expect, test, type Page } from '@playwright/test';

const world = (page: Page, fn: string) => page.evaluate(`(() => { const w = window.game.world; return ${fn}; })()`);

async function hover(page: Page, sel: string) {
  await page.locator(sel).first().hover();
}

test('item shortcuts: hover and press a key, or right-click', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'keyboard and mouse only');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=5&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  await world(page, 'w.char.gold = 50000');

  // Inventory: E unequips the hovered weapon, E equips it back, D drops it, right-click drinks a potion.
  await page.keyboard.press('i');
  await expect(page.locator('.panel.inv')).toBeVisible();
  await hover(page, '.doll .s-wpn .itm');
  await page.keyboard.press('e');
  await expect.poll(() => world(page, '!!w.char.equipment.weapon')).toBe(false);
  await hover(page, '.grid .itm');
  await page.locator('.grid .itm').first().click();
  await expect(page.locator('.acts kbd').first()).toHaveText('E');
  await page.screenshot({ path: `test-results/${info.project.name}-keys-inv.png` });
  await page.keyboard.press('e');
  await expect.poll(() => world(page, '!!w.char.equipment.weapon')).toBe(true);
  await hover(page, '.doll .s-wpn .itm');
  await page.keyboard.press('e');
  await hover(page, '.grid .itm');
  await page.keyboard.press('d');
  await expect(page.locator('.grid .itm')).toHaveCount(0);
  expect(await world(page, 'w.area.ground.length')).toBeGreaterThan(0);
  await world(page, "(w.char.inventory.push({ item: { uid: 9001, base: 'hp1', rarity: 'normal', ilvl: 1, identified: true, mods: [], sockets: 0, gems: [], reqLvl: 1 }, x: 0, y: 0 }), w.player.life = 1)");
  await page.keyboard.press('i');
  await page.keyboard.press('i');
  await page.locator('.grid .itm').first().click({ button: 'right' });
  await expect(page.locator('.grid .itm')).toHaveCount(0);
  expect(await world(page, 'w.player.heal.length')).toBe(1);
  await page.keyboard.press('Escape');

  // Smith: B buys the hovered stock item, S sells the hovered inventory item.
  await world(page, "w.cmdInteract({ kind: 'npc', id: w.area.npcs.find((n) => n.kind === 'smith').id })");
  await expect(page.locator('.panel.vend')).toBeVisible({ timeout: 15000 });
  await hover(page, '.vrow');
  await page.keyboard.press('b');
  await expect(page.locator('.grid .itm')).toHaveCount(1);
  const gold = (await world(page, 'w.char.gold')) as number;
  await hover(page, '.grid .itm');
  await page.keyboard.press('s');
  await expect(page.locator('.grid .itm')).toHaveCount(0);
  expect(await world(page, 'w.char.gold')).toBeGreaterThan(gold);
  // With nothing under the mouse, S still opens the skills panel.
  await page.mouse.move(5, 5);
  await page.keyboard.press('s');
  await expect(page.locator('.panel.skl')).toBeVisible();
  await page.keyboard.press('Escape');

  // Stash: X moves the hovered item across.
  await world(page, "w.char.inventory.push({ item: { uid: 9002, base: 'gem_ruby_1', rarity: 'normal', ilvl: 1, identified: true, mods: [], sockets: 0, gems: [], reqLvl: 1 }, x: 0, y: 0 })");
  await world(page, "w.cmdInteract({ kind: 'stash' })");
  await expect(page.locator('.panel.stash')).toBeVisible({ timeout: 15000 });
  await hover(page, '.col:nth-child(2) .grid .itm');
  await page.keyboard.press('x');
  await expect.poll(() => world(page, 'w.char.stash.length')).toBe(1);
  await hover(page, '.col:nth-child(1) .grid .itm');
  await page.keyboard.press('x');
  await expect.poll(() => world(page, 'w.char.inventory.length')).toBe(1);
  expect(errors).toEqual([]);
});
