import { expect, test, type Page } from '@playwright/test';

async function world(page: Page) {
  await page.waitForFunction(() => !!(window as any).game);
}

async function areaId(page: Page) {
  return page.evaluate(() => (window as any).game.world.area.def.id as string);
}

test('create a hero from the title screen', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await expect(page.locator('.logo-main')).toContainText('NEW HERO');
  await page.locator('.class-card', { hasText: 'Arcanist' }).click();
  await page.locator('.name-in').fill('Mira');
  await page.screenshot({ path: `test-results/${info.project.name}-create.png` });
  await page.getByRole('button', { name: 'Create' }).click();
  await world(page);
  await expect(page.locator('canvas.view')).toBeVisible();
  await expect(page.locator('.orb.life .orb-txt')).toHaveText(/\d+\/\d+/);
  expect(await page.evaluate(() => (window as any).game.world.char.classId)).toBe('arcanist');
  // Reloading shows the saved hero in the list.
  await page.evaluate(() => (window as any).game.save());
  await page.goto('/');
  await expect(page.locator('.char-card')).toContainText('Mira');
  expect(errors).toEqual([]);
});

test('town, travel, combat and panels', async ({ page, isMobile }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?autostart&seed=7');
  await world(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/${info.project.name}-town.png` });

  // Walk out of the gate.
  await page.evaluate(() => (window as any).game.world.cmdInteract({ kind: 'exit', index: 0 }));
  await expect.poll(() => areaId(page), { timeout: 20000 }).toBe('cinder_fields');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/${info.project.name}-fields.png` });

  // Jump next to a monster pack and fight with the attack button.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const m = w.area.monsters.find((x: any) => !x.dead && !x.superId);
    w.player.x = m.x - 1.2;
    w.player.y = m.y;
    w.player.invuln = 2;
  });
  const btn = page.locator('.sbtn.s0');
  const box = (await btn.boundingBox())!;
  if (isMobile) {
    for (let i = 0; i < 6; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2), await page.waitForTimeout(250);
  } else {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
  }
  await page.screenshot({ path: `test-results/${info.project.name}-combat.png` });
  const damaged = await page.evaluate(() => (window as any).game.world.area.monsters.some((m: any) => m.life < m.maxLife));
  expect(damaged).toBe(true);

  // Panels.
  await page.locator('.hb-inv').click();
  await expect(page.locator('.panel.inv')).toBeVisible();
  await page.locator('.doll .itm').first().click();
  await expect(page.locator('.tt')).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-inventory.png` });
  await page.locator('.p-close').click();
  await page.locator('.hb-skills').click();
  await expect(page.locator('.panel.skl')).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-skills.png` });
  await page.locator('.p-close').click();
  await page.locator('.hb-char').click();
  await expect(page.locator('.panel.char')).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-character.png` });
  await page.locator('.p-close').click();
  await expect(page.locator('.panel-wrap')).toBeHidden();
  expect(errors).toEqual([]);
});

test('touch joystick moves the hero', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  await page.goto('/?autostart&seed=3');
  await world(page);
  const start = await page.evaluate(() => ({ ...(window as any).game.world.player }));
  const vp = page.viewportSize()!;
  const cdp = await page.context().newCDPSession(page);
  const x = vp.width * 0.18;
  const y = vp.height * 0.7;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + i * 5, y: y - i * 2, id: 1 }] });
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const end = await page.evaluate(() => ({ ...(window as any).game.world.player }));
  expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeGreaterThan(1);
});
