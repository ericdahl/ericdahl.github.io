import { expect, test } from '@playwright/test';

test('a forgewright builds a workshop and runs hot', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?seed=7');
  const card = page.locator('.class-card', { hasText: 'Forgewright' });
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await expect(card).toHaveClass(/sel/);
  await page.screenshot({ path: `test-results/${info.project.name}-forge-create.png` });
  await page.locator('.name-in').fill('Brenna');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForFunction(() => !!(window as any).game);
  expect(await page.evaluate(() => (window as any).game.world.char.classId)).toBe('forgewright');

  // The Heat gauge is there from the start, cold.
  const heat = page.locator('.heat');
  await expect(heat).toBeVisible();
  await expect(heat.locator('.heat-txt')).toHaveText('HEAT 0');

  // Skip ahead: a level 24 smith with points in all three trees, out in the fields.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    Object.assign(w.char, { level: 24 });
    w.char.skills = { sunder: 5, anvil_drop: 3, shockwave: 3, earthshaker: 1, ballista: 5, bellows: 2, gearwork: 2, brass_sentinel: 2, furnace: 2, temper: 3, slag_burst: 3, white_heat: 1 };
    w.char.hotbar = ['sunder', 'ballista', 'slag_burst', 'brass_sentinel'];
    w.refreshStats();
    w.player.life = w.stats.maxLife;
    w.player.mana = w.stats.maxMana;
    w.cmdInteract({ kind: 'exit', index: 0 });
  });
  await expect.poll(() => page.evaluate(() => (window as any).game.world.area.def.id), { timeout: 20000 }).toBe('cinder_fields');

  // Set up next to a pack and build everything.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const pack = w.area.monsters.filter((m: any) => !m.dead && !m.superId);
    w.player.x = pack[0].x - 2;
    w.player.y = pack[0].y;
    w.player.invuln = 999;
    for (const m of pack.slice(0, 6)) m.life = m.maxLife = m.maxLife * 40;
  });
  for (const skill of ['ballista', 'ballista', 'brass_sentinel', 'bellows', 'furnace']) {
    await page.evaluate((s) => {
      const w = (window as any).game.world;
      w.player.mana = w.stats.maxMana;
      w.cmdAutoSkill(s);
    }, skill);
    await page.waitForTimeout(650);
  }
  const kinds = await page.evaluate(() => (window as any).game.world.minions.map((m: any) => m.ally).sort());
  expect(kinds).toEqual(['ballista', 'ballista', 'bellows', 'furnace', 'sentinel']);
  // The Ballista button counts what is standing against the cap.
  await expect(page.locator('.sbtn.s1 .sbadge')).toHaveText('2/2');
  await expect(page.locator('.sbtn.s3 .sbadge')).toHaveText('1/1');
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.player.mana = w.stats.maxMana;
    w.cmdAutoSkill('anvil_drop');
  });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `test-results/${info.project.name}-forge-workshop.png` });

  // Slag Burst is greyed out until there is Heat to vent.
  await expect(page.locator('.sbtn.s2')).toHaveClass(/nomana/);
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.player.heat = 82;
    w.player.heatT = 0;
  });
  await expect(heat).toHaveAttribute('data-state', 'hot');
  await expect(heat.locator('.heat-txt')).toHaveText(/HEAT (8\d|7\d)/);
  await expect(page.locator('.sbtn.s2')).not.toHaveClass(/nomana/);

  // The gauge has to be readable on a phone: big enough, on screen, and clear of the orbs and buttons.
  const box = (await heat.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.height).toBeGreaterThanOrEqual(14);
  expect(box.width).toBeGreaterThanOrEqual(110);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(Number.parseFloat(await heat.locator('.heat-txt').evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
  const overlaps = await page.evaluate(() => {
    const r = document.querySelector('.heat')!.getBoundingClientRect();
    const hit = (el: Element) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top;
    };
    return [...document.querySelectorAll('.orb, .sbtn, .dbtn, .bslot, .hbtn, .xpbar, .ctxbtn:not(.hidden)')].filter(hit).map((el) => el.className);
  });
  expect(overlaps).toEqual([]);
  await page.screenshot({ path: `test-results/${info.project.name}-forge-hot.png` });

  // Overheated: the gauge says so, and the hero burns.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.player.heat = 99;
    w.gainHeat(5);
  });
  await expect(heat).toHaveAttribute('data-state', 'over');
  await expect(heat.locator('.heat-txt')).toHaveText(/OVERHEATED/);
  await page.screenshot({ path: `test-results/${info.project.name}-forge-overheated.png` });

  // Vent it.
  await page.evaluate(() => (window as any).game.world.cmdAutoSkill('slag_burst'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `test-results/${info.project.name}-forge-slag.png` });
  await expect(heat).toHaveAttribute('data-state', 'cool');
  expect(await page.evaluate(() => (window as any).game.world.player.overheat)).toBe(false);

  // The skills panel shows the forgewright trees.
  await page.keyboard.press('k');
  await expect(page.locator('.panel.skl')).toContainText('Anvil Drop');
  await expect(page.locator('.panel.skl')).toContainText('Brass Sentinel');
  await expect(page.locator('.panel.skl')).toContainText('Slag Burst');
  await page.screenshot({ path: `test-results/${info.project.name}-forge-skills.png` });
  expect(errors).toEqual([]);
});

test('other classes have no Heat gauge', async ({ page }) => {
  await page.goto('/?autostart&class=reaver&seed=7');
  await page.waitForFunction(() => !!(window as any).game);
  await expect(page.locator('.heat')).toBeHidden();
});
