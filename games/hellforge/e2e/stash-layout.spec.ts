import { expect, test } from '@playwright/test';

// The stash and backpack grids are both 10 cells wide. Neither may spill into the other
// column or past the panel, at any window size.
for (const vp of [
  { width: 1000, height: 1200 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1100 },
  { width: 900, height: 700 },
  { width: 700, height: 900 },
]) {
  test(`stash and inventory grids do not overlap at ${vp.width}x${vp.height}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'viewports are set per test');
    await page.setViewportSize(vp);
    await page.goto('/?autostart&seed=5');
    await page.waitForFunction(() => !!(window as any).game);
    await page.evaluate(() => (window as any).game.world.cmdInteract({ kind: 'stash' }));
    await expect(page.locator('.panel.stash')).toBeVisible({ timeout: 15000 });
    const boxes = await page.locator('.panel.stash .grid').evaluateAll((els) =>
      els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
    expect(boxes).toHaveLength(2);
    const [a, b] = boxes;
    const overlap = a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    await page.screenshot({ path: `test-results/stash-${vp.width}x${vp.height}.png` });
    expect(overlap, JSON.stringify(boxes)).toBe(false);
    const body = await page.locator('.panel.stash .p-body').evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
    expect(body.sw, 'no horizontal scroll').toBeLessThanOrEqual(body.cw + 1);
  });
}
