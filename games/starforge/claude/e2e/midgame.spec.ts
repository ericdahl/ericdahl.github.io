import { test } from '@playwright/test';

test('mid-game snapshot with AI on both sides', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone-landscape');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?seed=77&autostart');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(async () => {
    const g = (window as any).game;
    const { AIController } = await import('/src/game/ai.ts');
    const me = new AIController(g.world, 1, 'normal');
    g.paused = true;
    for (let i = 0; i < 20 * 400; i++) {
      me.update();
      g.ai.update();
      g.world.step();
    }
    g.paused = false;
    const core = g.world.buildingsOf(1).find((b: any) => b.kind === 'core');
    g.cam.zoom = 22;
    g.cam.centerOn(core.x + 4, core.y + 4);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/midgame-home.png` });
  await page.evaluate(() => {
    const g = (window as any).game;
    g.world.revealAll(1);
    const core = g.world.buildingsOf(2).find((b: any) => b.kind === 'core');
    g.cam.centerOn(core.x - 4, core.y - 4);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/midgame-enemy.png` });
  if (errors.length) throw new Error(errors.join('\n'));
});
