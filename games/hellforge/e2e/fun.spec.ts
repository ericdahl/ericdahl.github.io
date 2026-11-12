import { expect, test, type Page } from '@playwright/test';

async function fields(page: Page) {
  await page.goto('/?autostart&seed=7&class=reaver');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.enterArea('cinder_fields', 'start');
    w.player.invuln = 1e6;
  });
}

test('a spree shows its counter and announces its rank', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await fields(page);
  await expect(page.locator('.spree')).toBeHidden();
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const ms = w.area.monsters.filter((m: any) => !m.thief);
    for (const m of ms.slice(0, 6)) w.damageMonster(m, { phys: 1e7, fire: 0, cold: 0, light: 0, poison: 0 });
  });
  await expect(page.locator('.spree-n')).toHaveText('×6');
  await expect(page.locator('.spree-t')).toHaveText('Killing Spree');
  await expect(page.locator('.announce .an-t')).toHaveText('Killing Spree');
  await page.screenshot({ path: `test-results/${info.project.name}-spree.png` });
  // It lapses when the killing stops.
  await expect(page.locator('.spree')).toBeHidden({ timeout: 8000 });
  expect(errors).toEqual([]);
});

test('the dodge button rolls the hero and goes on cooldown', async ({ page, isMobile }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await fields(page);
  const pos = () => page.evaluate(() => ({ x: (window as any).game.world.player.x, y: (window as any).game.world.player.y }));
  const from = await pos();
  const btn = page.locator('.dbtn');
  await expect(btn).toBeVisible();
  if (isMobile) await btn.tap();
  else {
    // Space rolls toward the cursor: point it at open ground first.
    const aim = await page.evaluate(() => {
      const g = (window as any).game;
      const w = g.world;
      const p = w.player;
      for (let a = 0; a < 6.3; a += 0.3) {
        let open = true;
        for (let d = 0.5; d <= 4; d += 0.5) open &&= w.area.level.tiles[Math.floor(p.y + Math.sin(a) * d) * w.area.level.w + Math.floor(p.x + Math.cos(a) * d)] === 1;
        if (open) return g.renderer.cam.toScreen(p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3);
      }
      return null;
    });
    expect(aim).not.toBeNull();
    await page.mouse.move(aim!.x, aim!.y);
    await page.keyboard.press('Space');
  }
  await expect(btn).toHaveClass(/cooling/);
  await page.screenshot({ path: `test-results/${info.project.name}-dodge.png` });
  await expect.poll(async () => { const p = await pos(); return Math.hypot(p.x - from.x, p.y - from.y); }).toBeGreaterThan(0.5);
  await expect(btn).not.toHaveClass(/cooling/, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('soul orbs, a Tithe Imp and a cursed shrine draw without errors', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await fields(page);
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const p = w.player;
    w.area.orbs.push({ id: 90001, x: p.x + 1.5, y: p.y + 0.5, kind: 'life', t: 1 }, { id: 90002, x: p.x + 0.5, y: p.y + 1.8, kind: 'mana', t: 1 });
    w.area.objects.push({ id: 90003, x: p.x - 1.5, y: p.y + 1.5, kind: 'shrine', used: false, shrine: 'cursed' });
    const imp = w.spawnMonster(w.area, 'tithe', p.x + 2.5, p.y + 2, 'normal', {});
    imp.alert = true;
    p.buffs.shrine_storm = { t: 40, p: {} };
    w.cmdInteract({ kind: 'object', id: 90003 });
  });
  await expect(page.locator('.announce .an-t')).toHaveText(/Ambush!|A Tithe Imp!/);
  await expect(page.locator('.buff')).toContainText('Storm');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `test-results/${info.project.name}-ambush.png` });
  expect(await page.evaluate(() => (window as any).game.world.area.monsters.some((m: any) => m.ambush !== undefined))).toBe(true);
  expect(errors).toEqual([]);
});

test('holding a skill button keeps casting and never opens the skills panel', async ({ page }) => {
  await fields(page);
  const btn = page.locator('.sbtn.s0');
  // A long press on a phone is delivered as a context menu event.
  await btn.dispatchEvent('pointerdown');
  await btn.dispatchEvent('contextmenu');
  await page.waitForTimeout(300);
  await expect(page.locator('.panel-wrap')).toBeHidden();
  expect(await page.evaluate(() => (window as any).game.panel)).toBeNull();
  await btn.dispatchEvent('pointerup');
});
