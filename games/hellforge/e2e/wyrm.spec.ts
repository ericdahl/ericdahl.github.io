import { expect, test } from '@playwright/test';

// The Brass Wyrm: asleep on his hoard in a cave above Gloomwood. He talks first, fights if asked, and yields rather than dies.
test('the Brass Wyrm talks, fights when challenged, yields and pays from the hoard', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=17&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  // A stranger is looking the camp over. He has something to say about a cave.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const n = w.area.npcs.find((x: any) => x.kind === 'stranger');
    w.player.x = n.x - 1.5;
    w.player.y = n.y + 1;
    w.cmdInteract({ kind: 'npc', id: n.id });
  });
  await expect(page.locator('.panel.wyrm .p-title')).toHaveText('A Well-Dressed Stranger', { timeout: 15000 });
  await expect(page.locator('.panel.wyrm')).toContainText('a ridge above Gloomwood');
  await page.screenshot({ path: `test-results/${info.project.name}-wyrm-stranger.png` });
  await page.evaluate(() => (window as any).game.close());
  await page.evaluate(() => {
    const g = (window as any).game;
    const w = g.world;
    w.char.level = 30;
    w.refreshStats();
    w.player.life = w.stats.maxLife;
    w.enterArea('gloomwood', 'start');
    w.enterArea('wyrm_roost', 'exit', 'gloomwood');
    const m = w.wyrm();
    w.player.x = m.x + 4;
    w.player.y = m.y + 2.5;
    w.player.invuln = 9999;
    g.renderer.cam.snap(m.x + 1, m.y + 1);
  });
  await expect(page.locator('.hud .area-name')).toHaveText('The High Roost');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/${info.project.name}-wyrm-asleep.png` });
  expect(await page.evaluate(() => (window as any).game.world.wyrm().wyrm)).toBe('asleep');

  // Speak to him: he wakes, and says so.
  await page.evaluate(() => (window as any).game.world.cmdInteract({ kind: 'wyrm' }));
  await expect(page.locator('.panel.wyrm')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.panel.wyrm .p-title')).toContainText('Tyriach, the Brass Wyrm');
  await expect(page.locator('.wyrm-line')).toHaveCount(3);
  // To talk, he takes a man's shape.
  expect(await page.evaluate(() => (window as any).game.world.wyrm().shape)).toBe('wyrm_man');
  await expect(page.locator('.panel.wyrm .p-sub')).toHaveText('In a shape he finds more convenient');
  await expect(page.locator('.wyrm-errand')).toBeVisible();
  await expect(page.locator('.wyrm-fight')).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-wyrm-talk.png` });

  // Take the letter, then challenge him anyway.
  await page.locator('.wyrm-errand').click();
  await expect(page.locator('.wyrm-errand')).toHaveCount(0);
  await expect(page.locator('.panel.wyrm')).toContainText('Tel Maresh');
  await page.locator('.wyrm-fight').click();
  await expect(page.locator('.panel.wyrm')).toHaveCount(0);
  await expect(page.locator('.announce .an-t')).toHaveText('Tyriach, the Brass Wyrm');
  await expect.poll(() => page.evaluate(() => (window as any).game.world.wyrm().wyrm)).toBe('fight');
  // And to fight, he is the dragon again.
  expect(await page.evaluate(() => (window as any).game.world.wyrm().shape)).toBeUndefined();
  // Let him breathe once, with the hero in front of him, and look at it.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const m = w.wyrm();
    w.player.x = m.x + 4;
    w.player.y = m.y + 1;
    m.abilities = ['breath'];
    m.abilityCd = 0;
  });
  await expect.poll(() => page.evaluate(() => (window as any).game.world.area.hazards.length), { timeout: 10000 }).toBeGreaterThan(6);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `test-results/${info.project.name}-wyrm-breath.png` });
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const m = w.wyrm();
    m.abilities = ['take_wing'];
    m.abilityCd = 0;
  });
  await expect.poll(() => page.evaluate(() => !!(window as any).game.world.wyrm().sub), { timeout: 10000 }).toBe(true);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `test-results/${info.project.name}-wyrm-flying.png` });
  await expect.poll(() => page.evaluate(() => !(window as any).game.world.wyrm().sub), { timeout: 10000 }).toBe(true);

  // Beat him down: he yields, alive, and offers three things.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const m = w.wyrm();
    w.damageMonster(m, { phys: m.maxLife * 50, fire: 0, cold: 0, light: 0, poison: 0 });
  });
  await expect(page.locator('.panel.wyrm')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.wyrm-pick')).toHaveCount(3);
  await expect(page.locator('.panel.wyrm')).toContainText('I yield');
  await page.screenshot({ path: `test-results/${info.project.name}-wyrm-pay.png` });
  const before = await page.evaluate(() => (window as any).game.world.char.inventory.length);
  await page.locator('.wyrm-take').first().click();
  await expect(page.locator('.wyrm-pick')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).game.world.char.inventory.length)).toBe(before + 1);
  expect(await page.evaluate(() => { const m = (window as any).game.world.wyrm(); return [m.dead, m.wyrm]; })).toEqual([false, 'yielded']);
  // The letter is still his to be delivered; the fight is done.
  await expect(page.locator('.wyrm-fight')).toHaveCount(0);
  await expect(page.locator('.panel.wyrm')).toContainText('The letter is not');
  expect(errors).toEqual([]);
});
