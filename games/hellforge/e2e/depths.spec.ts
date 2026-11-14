import { expect, test } from '@playwright/test';

// The Underforge: offered at a waypoint once the ember is home, a floor at a time, with the stairs sealed by a warden.
test('the Underforge opens at the waypoint and goes down a floor at a time', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=21&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  const openWaypoint = () => page.evaluate(() => {
    const g = (window as any).game;
    g.world.enterArea('emberwatch_ruins', 'start');
    g.world.cmdInteract({ kind: 'waypoint' });
  });

  // Closed to a hero who has not finished the road.
  await openWaypoint();
  await expect(page.locator('.panel.wpp')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.btn.wp.depth')).toHaveCount(0);
  await page.evaluate(() => (window as any).game.close());

  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.char.level = 45;
    w.setQuest('forge', 'rewarded');
    w.setQuest('hollow_sun', 'rewarded');
    w.setQuest('rekindle', 'rewarded');
    w.char.deepest = [7];
    w.refreshStats();
  });
  await openWaypoint();
  await expect(page.locator('.btn.wp.depth')).toHaveCount(2, { timeout: 15000 });
  await expect(page.locator('.btn.wp.depth.primary')).toContainText('Descend from Depth 6');
  await expect(page.locator('.depth-say')).toContainText('Deepest floor cleared: 7');
  await page.screenshot({ path: `test-results/${info.project.name}-depths-waypoint.png` });
  await page.locator('.btn.wp.depth', { hasText: 'from the top' }).click();

  await expect.poll(() => page.evaluate(() => (window as any).game.world.depth)).toBe(1);
  await expect(page.locator('.hud .area-name')).toHaveText('The Underforge: Depth 1 · stairs sealed');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/${info.project.name}-depths-floor.png` });

  // Stand by the stairs: sealed until the warden falls.
  const label = () => page.evaluate(() => {
    const w = (window as any).game.world;
    const i = w.area.level.exits.findIndex((e: any) => e.kind === 'down');
    const e = w.area.level.exits[i];
    w.player.invuln = 999;
    w.player.x = e.x + 1.5;
    w.player.y = e.y + 0.5;
    (window as any).game.renderer.cam.snap(w.player.x, w.player.y);
    return w.interactLabel({ kind: 'exit', index: i });
  });
  expect(await label()).toBe('Sealed Stairs');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/${info.project.name}-depths-warden.png` });
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const m = w.wardenAlive();
    w.damageMonster(m, { phys: m.maxLife * 50, fire: 0, cold: 0, light: 0, poison: 0 });
  });
  await expect(page.locator('.announce .an-t')).toHaveText('Depth 1 cleared');
  await expect(page.locator('.hud .area-name')).toHaveText('The Underforge: Depth 1 · stairs open');
  expect(await label()).toBe('Descend to Depth 2');
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.cmdInteract({ kind: 'exit', index: w.area.level.exits.findIndex((e: any) => e.kind === 'down') });
  });
  await expect.poll(() => page.evaluate(() => (window as any).game.world.depth), { timeout: 15000 }).toBe(2);

  // The record is on the character sheet.
  await page.evaluate(() => (window as any).game.open('character'));
  await expect(page.locator('.panel.char')).toContainText('Underforge');
  await expect(page.locator('.panel.char')).toContainText('Depth 7');
  expect(errors).toEqual([]);
});
