import { expect, test } from '@playwright/test';

// The captain stands in town and hires out a companion, who then walks with the hero and shows on the HUD.
test('hire a companion from the captain, lose them, and bring them back', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=13&class=arcanist');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.char.gold = 5000;
    w.char.level = 12;
    w.refreshStats();
    const cap = w.area.npcs.find((n: any) => n.kind === 'captain');
    w.player.x = cap.x + 2;
    w.player.y = cap.y + 1;
    (window as any).game.renderer.cam.snap(w.player.x, w.player.y);
    w.cmdInteract({ kind: 'npc', id: cap.id });
  });
  await expect(page.locator('.panel.captain')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.panel.captain .p-title')).toContainText('Captain Hale');
  await expect(page.locator('.hire-btn')).toHaveCount(3);
  await expect(page.locator('.hire-btn').first()).toHaveText('Hire (870)');
  await page.screenshot({ path: `test-results/${info.project.name}-hire-panel.png` });
  await page.locator('.hire-btn[data-kind="guard"]').click();
  await expect(page.locator('.hire-btn[data-kind="guard"]')).toHaveText('Hired');
  await expect(page.locator('.hire-btn[data-kind="guard"]')).toBeDisabled();
  await expect(page.locator('.hire-now')).toContainText('At your side');
  expect(await page.evaluate(() => (window as any).game.world.char.gold)).toBe(5000 - 870);
  await page.evaluate(() => (window as any).game.close());
  await expect(page.locator('.hud .buff.b-hire')).toContainText('100%');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/${info.project.name}-hire-town.png` });

  // Out in the fields they come along, and when they fall the HUD says so.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 999;
    const mi = w.hirelingMinion();
    w.damageMinion(mi, { phys: 1e9, fire: 0, cold: 0, light: 0, poison: 0 }, { level: 99 });
  });
  await expect(page.locator('.hud .buff.b-hiredown')).toContainText('has fallen');
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.enterArea('town', 'start');
    w.cmdInteract({ kind: 'npc', id: w.area.npcs.find((n: any) => n.kind === 'captain').id });
  });
  await expect(page.locator('.hire-revive')).toHaveText('Bring back (290 gold)', { timeout: 15000 });
  await page.locator('.hire-revive').click();
  await expect(page.locator('.hire-now')).toContainText('At your side');
  await page.locator('.hire-dismiss').click();
  await expect(page.locator('.hire-now')).toContainText('No one is with you');
  expect(errors).toEqual([]);
});
