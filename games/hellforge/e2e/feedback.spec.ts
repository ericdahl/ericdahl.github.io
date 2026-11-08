import { expect, test } from '@playwright/test';

test('kill effects by damage type, crit numbers and freeze frames', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'one run is enough');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=7');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 999;
    // Line up five monsters next to the player, one for each way to die.
    const ms = w.area.monsters.filter((m: any) => !m.dead && !m.superId).slice(0, 5);
    ms.forEach((m: any, i: number) => {
      m.x = w.player.x + 1.4 + (i % 3) * 1.3;
      m.y = w.player.y - 1 + Math.floor(i / 3) * 1.6;
      m.res = { phys: 0, fire: 0, cold: 0, light: 0, poison: 0 };
      m.alert = false;
      m.speed = 0;
    });
    (window as any).__ms = ms.map((m: any) => m.id);
  });
  await page.waitForTimeout(400);
  const freezeBefore = await page.evaluate(() => {
    const g = (window as any).game;
    const w = g.world;
    const ms = (window as any).__ms.map((id: number) => w.area.monsters.find((m: any) => m.id === id));
    const D = (k: string, v: number) => ({ phys: 0, fire: 0, cold: 0, light: 0, poison: 0, [k]: v });
    w.damageMonster(ms[0], D('cold', 1e5));
    w.damageMonster(ms[1], D('fire', 1e5));
    w.damageMonster(ms[2], D('light', 1e5));
    w.damageMonster(ms[3], D('phys', 1e5));
    ms[4].life = ms[4].maxLife = 1e6;
    w.damageMonster(ms[4], D('phys', 1234), { crit: true });
    return ms.slice(0, 4).map((m: any) => m.deathKind);
  });
  expect(freezeBefore).toEqual(['shatter', 'burn', 'shock', 'gib']);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `test-results/${info.project.name}-deaths.png` });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/${info.project.name}-deaths-after.png` });

  // A boss telegraph flashes the screen.
  await page.evaluate(() => (window as any).game.renderer.flash('#ff6020', 0.3));
  await page.waitForTimeout(30);
  await page.screenshot({ path: `test-results/${info.project.name}-flash.png` });
  expect(errors).toEqual([]);
});
