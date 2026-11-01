import { expect, test, type Page } from '@playwright/test';

/** Screen position (CSS px) of a world point using the live camera. */
async function toScreen(page: Page, x: number, y: number) {
  return page.evaluate(([wx, wy]) => {
    const g = (window as any).game;
    return g.cam.toScreen(wx, wy);
  }, [x, y]);
}

async function tap(page: Page, x: number, y: number, mobile: boolean) {
  if (mobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('menu starts a game and the HUD works', async ({ page, isMobile }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/?seed=1234');
  await expect(page.locator('h1')).toContainText('STAR');
  await page.screenshot({ path: `test-results/${info.project.name}-menu.png` });
  await page.getByRole('button', { name: 'Start Battle' }).click();
  await expect(page.locator('canvas.view')).toBeVisible();
  await expect(page.locator('[data-r="crystal"]')).toHaveText(/\d+/);
  await page.waitForTimeout(1500);

  // Select a harvester by tapping it.
  const h = await page.evaluate(() => {
    const g = (window as any).game;
    g.paused = true;
    const u = g.world.unitsOf(1)[0];
    g.cam.centerOn(u.x, u.y);
    return { x: u.x, y: u.y, id: u.id };
  });
  let s = await toScreen(page, h.x, h.y);
  await tap(page, s.x, s.y, isMobile);
  await expect.poll(() => page.evaluate(() => (window as any).game.selection.length)).toBeGreaterThan(0);
  await expect(page.locator('.card .cmd')).not.toHaveCount(0);

  // Open the build menu and place a habitat.
  await page.evaluate(() => ((window as any).game.world.players[1].crystal = 500));
  await page.locator('.cmd[aria-label="Build"]').click();
  await page.locator('.cmd[aria-label="Habitat"]').click();
  const core = await page.evaluate(() => {
    const g = (window as any).game;
    g.paused = false;
    const c = g.world.buildingsOf(1)[0];
    g.cam.centerOn(c.x + 3, c.y + 2);
    return { x: c.x, y: c.y };
  });
  s = await toScreen(page, core.x + 5, core.y + 3);
  await tap(page, s.x, s.y, isMobile);
  if (isMobile) await page.locator('.cmd[aria-label="Confirm"]').click();
  await expect
    .poll(() => page.evaluate(() => (window as any).game.world.unitsOf(1).some((u: any) => u.order.type === 'build')), { timeout: 5000 })
    .toBe(true);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `test-results/${info.project.name}-game.png` });

  // Select the core and queue a harvester.
  s = await toScreen(page, core.x, core.y);
  await tap(page, s.x, s.y, isMobile);
  await page.locator('.cmd[aria-label="Harvester"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).game.world.buildingsOf(1)[0].queue.length)).toBe(1);
  await page.screenshot({ path: `test-results/${info.project.name}-core.png` });

  // Pause menu.
  await page.locator('[data-a="menu"]').click();
  await expect(page.locator('.dialog h2')).toHaveText('Paused');
  await page.getByRole('button', { name: 'Resume' }).click();

  expect(errors).toEqual([]);
});

test('late game renders with armies on screen', async ({ page }, info) => {
  await page.goto('/?seed=99&autostart');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const g = (window as any).game;
    const w = g.world;
    w.revealAll(1);
    const core = w.buildingsOf(1)[0];
    const kinds = ['trooper', 'ranger', 'raider', 'crawler', 'wasp'];
    for (let i = 0; i < 15; i++) w.spawnUnit(kinds[i % 5], 1, core.x + 6 + (i % 5), core.y + 4 + Math.floor(i / 5));
    for (let i = 0; i < 10; i++) w.spawnUnit(kinds[i % 5], 2, core.x + 12 + (i % 5), core.y + 4 + Math.floor(i / 5));
    w.placeBuilding('garrison', 1, core.tx + 6, core.ty - 1, true);
    w.placeBuilding('turret', 1, core.tx - 1, core.ty + 5, true);
    g.selectArmy();
    g.cam.centerOn(core.x + 8, core.y + 4);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `test-results/${info.project.name}-battle.png` });
  const fps = await page.evaluate(
    () =>
      new Promise<number>((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => (++n < 60 ? requestAnimationFrame(f) : res((n * 1000) / (performance.now() - t0)));
        requestAnimationFrame(f);
      }),
  );
  console.log(`${info.project.name} fps ~${fps.toFixed(0)}`);
});
