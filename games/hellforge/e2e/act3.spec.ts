import { expect, test } from '@playwright/test';

// The road north: the caravan offers Emberwatch once Corvane is dead, the ruined camp has its own people and quests,
// and out in the cold the ember meter, braziers and bell tolls all work on screen.
test('the caravan carries you north to Emberwatch, and the ember matters in the cold', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=11&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.setQuest('forge', 'rewarded');
    w.setQuest('hollow_sun', 'rewarded');
    w.enterArea('tel_maresh', 'start');
    w.cmdInteract({ kind: 'npc', id: w.area.npcs.find((n: any) => n.kind === 'caravan').id });
  });
  await expect(page.locator('.panel.caravan')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.panel.caravan .btn')).toHaveCount(2);
  await expect(page.locator('.panel.caravan .btn.primary')).toHaveText('Travel north to Emberwatch Ruins');
  await page.locator('.panel.caravan .btn.primary').click();

  await expect(page.locator('.ov-box.story .ov-title')).toHaveText('Emberwatch, Under Snow');
  await page.screenshot({ path: `test-results/${info.project.name}-act3-story.png` });
  await page.locator('.ov-box.story .btn.primary').click();
  await expect(page.locator('.overlay')).toBeHidden();
  // No ember meter by the camp fire.
  await expect(page.locator('.hud .ember')).toBeHidden();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/${info.project.name}-act3-town.png` });

  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.cmdInteract({ kind: 'npc', id: w.area.npcs.find((n: any) => n.kind === 'sage').id });
  });
  await expect(page.locator('.panel.sage .quest')).toHaveCount(4, { timeout: 15000 });
  await expect(page.locator('.panel.sage .p-title')).toContainText('Wren');
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).game.close?.());

  // Out in the pass the meter shows, and burns down.
  await page.evaluate(() => {
    const g = (window as any).game;
    g.close?.();
    const w = g.world;
    w.enterArea('rimefall_pass', 'start');
    w.player.invuln = 999;
    for (const m of w.area.monsters) m.dead = true;
    w.ember = 0.6;
  });
  await expect(page.locator('.hud .ember')).toBeVisible();
  await expect(page.locator('.hud .area-name')).toContainText('beacons dark');
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as any).game.world.ember)).toBeLessThan(0.6);

  // Ember out: the meter says so, and frostbite starts to build.
  await page.evaluate(() => ((window as any).game.world.ember = 0));
  await expect(page.locator('.hud .ember')).toHaveAttribute('data-state', 'out');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).game.world.frost)).toBeGreaterThan(0.05);
  await page.screenshot({ path: `test-results/${info.project.name}-act3-ember-out.png` });

  // Walk onto a brazier: it lights, and the meter turns warm and refills.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const o = w.area.objects.find((x: any) => x.kind === 'brazier');
    w.player.x = o.x + 0.7;
    w.player.y = o.y + 0.7;
    (window as any).game.renderer.cam.snap(w.player.x, w.player.y);
  });
  await expect(page.locator('.hud .ember')).toHaveAttribute('data-state', 'warm');
  await expect.poll(() => page.evaluate(() => (window as any).game.world.ember)).toBeGreaterThan(0.9);
  expect(await page.evaluate(() => (window as any).game.world.area.objects.filter((x: any) => x.kind === 'brazier' && x.used).length)).toBe(1);
  await page.screenshot({ path: `test-results/${info.project.name}-act3-brazier.png` });

  // A bell toll and the act's monsters all draw without errors.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const p = w.player;
    ['bellwarden', 'slag_golem', 'hearth_eater', 'rime_thrall', 'phylactery'].forEach((id, i) => {
      const m = w.spawnMonster(w.area, id, p.x + 2 + (i % 3), p.y - 2 + i, 'normal', {});
      m.stun = 99;
      if (id === 'slag_golem') m.heat = 1;
      if (id === 'bellwarden') w.ringBell(m);
    });
  });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).game.world.area.rings.length)).toBe(1);
  await page.screenshot({ path: `test-results/${info.project.name}-act3-monsters.png` });
  expect(errors).toEqual([]);
});

// Killing the Unlit plays the ending and unlocks the next difficulty.
test('rekindling the Hellforge ends the act', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'one run is enough');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=11&class=arcanist');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const g = (window as any).game;
    const w = g.world;
    w.setQuest('forge', 'rewarded');
    w.setQuest('hollow_sun', 'rewarded');
    w.char.quests['0:story_unlit'] = 'done';
    w.enterArea('hellforge_heart', 'start');
    w.player.invuln = 999;
    const boss = w.area.monsters.find((m: any) => m.superId === 'unlit');
    w.player.x = boss.x - 2.5;
    w.player.y = boss.y + 1.5;
    g.renderer.cam.snap(w.player.x, w.player.y);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/${info.project.name}-act3-unlit.png` });
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const boss = w.area.monsters.find((m: any) => m.superId === 'unlit');
    boss.phase = 99;
    boss.invulnT = 0;
    w.damageMonster(boss, { phys: 0, fire: 1e9, cold: 0, light: 0, poison: 0 });
  });
  await expect(page.locator('.ov-box.victory .ov-title')).toHaveText('Keep It Lit', { timeout: 15000 });
  await expect(page.locator('.ov-box.victory')).toContainText('Nightmare difficulty is now unlocked');
  expect(await page.evaluate(() => (window as any).game.world.char.maxDifficulty)).toBe(1);
  await page.screenshot({ path: `test-results/${info.project.name}-act3-ending.png` });
  expect(errors).toEqual([]);
});
