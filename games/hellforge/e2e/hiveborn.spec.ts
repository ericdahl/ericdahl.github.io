import { expect, test } from '@playwright/test';

// The Hiveborn: created from the title screen, wears a weapon in each upper hand, and has claws on the sheet.
test('a Hiveborn holds two weapons, picks a hand for a third, and shows its claws', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  if (await page.getByRole('button', { name: 'New Hero' }).count()) await page.getByRole('button', { name: 'New Hero' }).click();
  await expect(page.locator('.class-card')).toHaveCount(6);
  await page.locator('.class-card', { hasText: 'Hiveborn' }).click();
  await page.screenshot({ path: `test-results/${info.project.name}-hive-create.png` });
  await page.locator('.name-in').fill('Bird');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForFunction(() => !!(window as any).game);
  expect(await page.evaluate(() => {
    const e = (window as any).game.world.char.equipment;
    return [e.weapon.base, e.offhand.base];
  })).toEqual(['short_sword', 'club']);

  // A dagger in the backpack offers either hand.
  // The dev server serves the game's modules, so the page can make an item the same way the game does.
  await page.evaluate(async ([itemsUrl, charUrl]) => {
    const g = (window as any).game;
    const items = await import(/* @vite-ignore */ itemsUrl);
    const char = await import(/* @vite-ignore */ charUrl);
    char.addToInventory(g.world.char, items.makeItem('dagger'));
    g.open('inventory');
  }, ['/src/game/items.ts', '/src/game/character.ts']);
  await expect(page.locator('.doll .itm')).toHaveCount(2);
  await page.locator('.grid .itm[data-from="inv"]').first().click();
  await expect(page.getByRole('button', { name: /Equip Main Hand/ })).toBeVisible();
  await expect(page.locator('.cmp-h', { hasText: 'Equipped' })).toContainText(/hand/);
  await page.screenshot({ path: `test-results/${info.project.name}-hive-inventory.png` });
  await page.getByRole('button', { name: /Equip Off Hand/ }).click();
  expect(await page.evaluate(() => {
    const c = (window as any).game.world.char;
    return [c.equipment.weapon.base, c.equipment.offhand.base, c.inventory.map((e: any) => e.item.base)];
  })).toEqual(['short_sword', 'dagger', ['club']]);

  await page.evaluate(() => (window as any).game.open('character'));
  await expect(page.locator('.panel.char')).toContainText('Claws');
  await page.evaluate(() => (window as any).game.open('skills'));
  await expect(page.locator('.tree-branch')).toHaveText(['Soldier', 'Archer', 'Faith']);
  await expect(page.locator('.tnode')).toHaveCount(14);
  await page.screenshot({ path: `test-results/${info.project.name}-hive-tree.png` });
  await page.evaluate(() => (window as any).game.close());

  // Out in the fields the claws and both weapons do their work without errors.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.enterArea('cinder_fields', 'start');
    const m = w.area.monsters.find((x: any) => !x.dead && !x.superId && !x.thief);
    w.player.x = m.x - 1;
    w.player.y = m.y;
    w.player.invuln = 30;
    (window as any).game.renderer.cam.snap(w.player.x, w.player.y);
    (window as any).__m = m;
    w.cmdSkill('rend', m.x, m.y, m.id);
  });
  await expect.poll(() => page.evaluate(() => { const w = (window as any).game.world; const m = (window as any).__m; if (!w.player.action && !w.player.intent && !m.dead) w.cmdSkill('rend', m.x, m.y, m.id); return m.dead || m.life < m.maxLife; }), { timeout: 20000 }).toBe(true);
  await page.screenshot({ path: `test-results/${info.project.name}-hive-fight.png` });
  expect(errors).toEqual([]);
});
