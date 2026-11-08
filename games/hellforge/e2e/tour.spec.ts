import { expect, test } from '@playwright/test';

const AREAS = ['hollow_cave', 'gloomwood', 'sunken_chapel', 'catacombs2', 'hellforge'];

// Visits every area (and the bosses) and measures frame time, saving screenshots for review.
test('area tour renders every theme', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-landscape');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=11&class=arcanist');
  await page.waitForFunction(() => !!(window as any).game);
  for (const id of AREAS) {
    await page.evaluate((area) => {
      const g = (window as any).game;
      g.world.enterArea(area, 'start');
      g.world.player.invuln = 999;
      const boss = g.world.area.monsters.find((m: any) => m.superId);
      if (boss) {
        g.world.player.x = boss.x - 2.5;
        g.world.player.y = boss.y + 1.5;
        g.renderer.cam.snap(g.world.player.x, g.world.player.y);
      }
    }, id);
    await page.waitForTimeout(1200);
    const ms = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const tick = () => (++n < 30 ? requestAnimationFrame(tick) : resolve((performance.now() - t0) / 30));
          requestAnimationFrame(tick);
        }),
    );
    console.log(`${id}: ${ms.toFixed(1)} ms/frame`);
    await page.screenshot({ path: `test-results/tour-${id}.png` });
  }
  expect(errors).toEqual([]);
});
