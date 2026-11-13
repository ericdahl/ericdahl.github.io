import { expect, test, type Page } from '@playwright/test';

const world = (page: Page, fn: string) => page.evaluate(`(() => { const w = window.game.world; const c = w.char; return ${fn}; })()`);

async function start(page: Page) {
  await page.goto('/?autostart&seed=5&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  // Materials to work with, and a backpack of loot: plain junk and three magic swords.
  await world(page, `(c.gold = 50000, c.forge.cinders = 2000, c.forge.essences = { fire: 3, cold: 3, light: 3, poison: 3 },
    ['club', 'cap', 'dagger'].forEach((b, i) => c.inventory.push({ item: { uid: 9100 + i, base: b, rarity: 'normal', ilvl: 5, identified: true, mods: [], sockets: 0, gems: [], reqLvl: 1 }, x: i * 2, y: 0 })),
    [0, 1, 2].forEach((i) => c.inventory.push({ item: { uid: 9200 + i, base: 'dagger', rarity: 'magic', ilvl: 12, identified: true, mods: [{ stat: 'str', value: 2 + i }], name: 'Dagger of Strength', sockets: 0, gems: [], reqLvl: 1 }, x: 6 + i, y: 0 })))`);
}

async function openForge(page: Page) {
  await world(page, "w.cmdInteract({ kind: 'forge' })");
  await expect(page.locator('.panel.forge')).toBeVisible({ timeout: 15000 });
}

test('the forge: walk up, salvage, heat, quench, temper and smelt', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await start(page);
  await openForge(page);
  await expect(page.locator('.forge-mats')).toContainText('2000 Cinders');
  await page.screenshot({ path: `test-results/${info.project.name}-forge.png` });

  // Junk loot becomes Cinders.
  await page.getByRole('button', { name: /Salvage all 3 plain items/ }).click();
  await expect(page.locator('.forge-result')).toContainText('Salvaged 3 plain items');
  expect(await world(page, 'c.forge.cinders')).toBeGreaterThan(2000);
  await expect(page.locator('.grid .itm')).toHaveCount(3);

  // Heat the worn sword: the jobs are on screen as soon as it is selected, and its name and tile show the level.
  await page.locator('.doll .s-wpn .itm').click();
  const heat = page.getByRole('button', { name: /^Heat to \+1/ });
  await expect(heat).toBeInViewport();
  await expect(heat).toContainText('cannot fail');
  await heat.click();
  await page.getByRole('button', { name: /^Heat to \+2/ }).click();
  await expect(page.locator('.tt-name')).toHaveText('+2 Short Sword');
  await expect(page.locator('.doll .s-wpn .fplus')).toHaveText('+2');
  expect(await world(page, 'c.equipment.weapon.forge')).toBe(2);

  // Quench it in fire.
  await page.getByRole('button', { name: /^Quench/ }).click();
  await page.getByRole('button', { name: /^Fire Essence/ }).click();
  await expect(page.locator('.forge-result')).toContainText('Quenched in Fire Essence');
  expect(await world(page, 'w.stats.fireMax')).toBeGreaterThan(0);
  expect(await world(page, 'c.forge.essences.fire')).toBe(2);
  await page.getByRole('button', { name: /^Back/ }).click();

  // Temper the one affix of a magic dagger.
  await page.locator('.grid .itm').first().click();
  await page.getByRole('button', { name: /^Temper/ }).click();
  await page.screenshot({ path: `test-results/${info.project.name}-forge-temper.png` });
  await page.locator('.forge-opts .fact').first().click();
  await expect(page.locator('.forge-result')).toContainText('Tempered: +2 to Strength');
  await page.getByRole('button', { name: /^Back/ }).click();

  // Three magic daggers smelt into a rare one.
  for (const uid of [9200, 9201, 9202]) {
    const tile = page.locator(`.grid .itm[data-uid="${uid}"]`);
    if (!(await tile.evaluate((el) => el.classList.contains('sel')))) await tile.click();
    await page.getByRole('button', { name: /^Add to crucible/ }).click();
  }
  await expect(page.locator('.cru-slot.full')).toHaveCount(3);
  await page.getByRole('button', { name: 'Smelt', exact: true }).click();
  await expect(page.locator('.forge-result')).toContainText('Smelted:');
  expect(await world(page, 'c.inventory.map((e) => e.item.rarity).join()')).toBe('rare');
  await page.screenshot({ path: `test-results/${info.project.name}-forge-smelt.png` });
  expect(errors).toEqual([]);
});

test('heating by hand: the timing game can be played or skipped, and a failure never goes unexplained', async ({ page }, info) => {
  await start(page);
  await world(page, 'c.equipment.weapon.forge = 6');
  await openForge(page);
  await page.locator('.doll .s-wpn .itm').click();
  await expect(page.getByRole('button', { name: /^Heat to \+7/ })).toContainText(/\d+% success, \d+% crack/);
  await expect(page.locator('.doll .s-wpn .itm')).not.toHaveClass(/hot/);

  // Skipping heats without a bonus.
  await page.getByRole('button', { name: /^Strike by hand/ }).click();
  await expect(page.locator('.strike-bar')).toBeVisible();
  await expect(page.locator('.strike-status')).toHaveText(/Dull red|Glowing yellow|WHITE-HOT/);
  await page.screenshot({ path: `test-results/${info.project.name}-forge-strike.png` });
  await page.getByRole('button', { name: /^Skip/ }).click();
  await expect(page.locator('.strike-bar')).toHaveCount(0);
  await expect(page.locator('.forge-result')).toContainText(/takes the heat|cracks/);
  expect([5, 7]).toContain(await world(page, 'c.equipment.weapon.forge'));

  // Striking reports how well it was timed. Wait for white heat, then hit.
  await world(page, '(c.equipment.weapon.forge = 6, window.game.refresh())');
  await page.getByRole('button', { name: /^Heat to \+7/ }).waitFor();
  await page.getByRole('button', { name: /^Strike by hand/ }).click();
  await page.waitForFunction(() => (document.querySelector('.strike-bar') as HTMLElement | null)?.dataset.zone === 'bright');
  await page.locator('.strike-btn').dispatchEvent('pointerdown');
  await expect(page.locator('.forge-result')).toContainText(/A (perfect|good|cold) strike/);
  await expect(page.locator('.strike-bar')).toHaveCount(0);

  // From +7 the tile sparks.
  await world(page, 'c.equipment.weapon.forge = 7');
  await page.locator('.p-close').click();
  await openForge(page);
  await expect(page.locator('.doll .s-wpn .itm')).toHaveClass(/hot/);
});

test('the blacksmith points to the forge', async ({ page }) => {
  await start(page);
  await world(page, "w.cmdInteract({ kind: 'npc', id: w.area.npcs.find((n) => n.kind === 'smith').id })");
  await expect(page.locator('.panel.vend')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Work the Forge' }).click();
  await expect(page.locator('.panel.forge')).toBeVisible();
});

test('forge shortcuts: hover an item and press a key', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard and mouse only');
  await start(page);
  await world(page, 'c.equipment.weapon.forge = 6');
  await openForge(page);

  // H heats the hovered item without selecting it first.
  await page.locator('.grid .itm').first().hover();
  await page.keyboard.press('h');
  await expect.poll(() => world(page, 'c.inventory[0].item.forge')).toBe(1);
  await expect(page.locator('.acts kbd').first()).toHaveText('H');

  // T opens the affix list; a digit picks one; Escape backs out of the list, not the panel.
  await page.locator('.grid .itm[data-uid="9200"]').hover();
  await page.keyboard.press('t');
  await expect(page.locator('.forge-mode')).toBeVisible();
  await page.keyboard.press('1');
  await expect(page.locator('.forge-result')).toContainText('Tempered');
  await page.keyboard.press('Escape');
  await expect(page.locator('.forge-mode')).toHaveCount(0);
  await expect(page.locator('.panel.forge')).toBeVisible();

  // S salvages the hovered item.
  const n = (await world(page, 'c.inventory.length')) as number;
  await page.locator('.grid .itm[data-uid="9101"]').hover();
  await page.keyboard.press('s');
  await expect.poll(() => world(page, 'c.inventory.length')).toBe(n - 1);

  // J starts the timing game on the worn sword and Space strikes.
  await page.locator('.doll .s-wpn .itm').hover();
  await page.keyboard.press('j');
  await expect(page.locator('.strike-bar')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('.strike-bar')).toHaveCount(0);
  await expect(page.locator('.forge-result')).toContainText(/strike/);
  await expect(page.locator('.panel.forge')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.panel.forge')).toHaveCount(0);
});

test('Hardcore: a heat that can shatter asks twice', async ({ page }) => {
  await page.goto('/?autostart&seed=5&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  await world(page, '(c.hardcore = true, c.forge.cinders = 5000, c.equipment.weapon.forge = 8)');
  await openForge(page);
  await page.locator('.doll .s-wpn .itm').click();
  const heat = page.getByRole('button', { name: /^Heat to \+9/ });
  await expect(heat).toContainText('SHATTER');
  await heat.click();
  expect(await world(page, 'c.forge.cinders')).toBe(5000);
  await page.getByRole('button', { name: /may SHATTER/ }).click();
  expect(await world(page, 'c.forge.cinders')).toBeLessThan(5000);
});
