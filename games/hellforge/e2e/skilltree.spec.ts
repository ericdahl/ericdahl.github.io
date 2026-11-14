import { expect, test } from '@playwright/test';

// The Skills panel is a tree: three branches, a row per level, a line for every requirement, and the details of
// whichever skill is picked beside it.
test('the skill tree shows branches, requirements and what each skill is waiting for', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?autostart&seed=5&class=necromancer');
  await page.waitForFunction(() => !!(window as any).game);
  await page.evaluate(() => {
    const g = (window as any).game;
    const c = g.world.char;
    c.level = 14;
    c.skills = { raise_skeleton: 5, bone_shards: 1, frailty: 2, skeletal_mastery: 3 };
    c.skillPoints = 3;
    g.world.refreshStats();
    g.open('skills');
  });
  const node = (id: string) => page.locator(`.tnode[data-skill="${id}"]`);
  await expect(page.locator('.tree-branch')).toHaveText(['Summoning', 'Curses', 'Bone']);
  await expect(page.locator('.tree-lv')).toHaveText(['Lv 1', 'Lv 6', 'Lv 12', 'Lv 18', 'Lv 24']);
  await expect(page.locator('.tnode')).toHaveCount(10);
  await expect(page.locator('.tree-lines line')).toHaveCount(9);
  await expect(page.locator('.tree-lines line.met')).toHaveCount(5);

  // Learned, learnable now, waiting on another skill, waiting on a level.
  await expect(node('raise_skeleton')).toHaveAttribute('data-state', 'known');
  await expect(node('raise_skeleton').locator('.tn-rank')).toHaveText('5');
  await expect(node('grave_golem')).toHaveAttribute('data-state', 'open');
  await expect(node('blight_nova')).toHaveAttribute('data-state', 'locked');
  await expect(node('blight_nova').locator('.tn-lock')).toHaveText('🔒');
  await expect(node('bone_storm').locator('.tn-lock')).toHaveText('Lv 24');
  await expect(node('bone_storm')).toHaveAttribute('aria-label', 'Bone Storm, opens at level 24');
  await expect(node('blight_nova')).toHaveAttribute('aria-label', 'Blight Nova, requires Bone Ward');

  // Nothing overlaps, and every node is on screen width-wise.
  const boxes = await page.locator('.tnode .tn-icon').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }));
  const vw = page.viewportSize()!.width;
  for (const [l, , r] of boxes) expect(l >= 0 && r <= vw).toBe(true);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    expect(a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1], `nodes ${i} and ${j} overlap`).toBe(false);
  }

  // Picking a skill shows what it needs and leads to, and lights its lines and neighbours.
  await node('bone_lance').click();
  await expect(page.locator('.skl-detail')).toHaveAttribute('data-skill', 'bone_lance');
  await expect(page.locator('.skl-detail')).toContainText('Requires: ✓ Bone Shards, ✗ Corpse Burst');
  await expect(page.locator('.skl-detail')).toContainText('Leads to: Bone Storm');
  await expect(page.locator('.skl-detail')).toContainText('Grows with: Bone Shards (+10% a rank), Bone Ward (+10% a rank)');
  await expect(page.locator('.skl-learn-btn')).toBeDisabled();
  await expect(page.locator('.skl-why')).toHaveText('Requires level 18');
  await expect(page.locator('.tree-lines line.hot')).toHaveCount(3);
  await expect(page.locator('.tnode.rel')).toHaveCount(3);
  await page.locator('.tree').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `test-results/${info.project.name}-skilltree.png` });

  // A name in the details jumps to that skill; learning it opens what it leads to.
  await page.locator('.skl-detail .skl-link', { hasText: 'Corpse Burst' }).click();
  await expect(page.locator('.skl-detail')).toHaveAttribute('data-skill', 'corpse_burst');
  await page.locator('.skl-learn-btn').click();
  await expect(node('corpse_burst')).toHaveAttribute('data-state', 'known');
  await expect(page.locator('.panel.skl .p-sub')).toHaveText('2 points to spend');
  await expect(page.locator('.tree-lines line.met')).toHaveCount(6);
  await page.locator('.skl-learn-btn').click();
  await page.locator('.skl-learn-btn').click();
  await expect(node('corpse_burst').locator('.tn-rank')).toHaveText('3');
  await expect(page.locator('.skl-learn-btn')).toBeDisabled();
  await expect(page.locator('.skl-why')).toHaveText('No skill points');
  // Out of points: what could be learned no longer asks to be.
  await expect(node('grave_golem')).toHaveAttribute('data-state', 'ready');

  // A learned skill can be put on a button from its details.
  await page.locator('.skl-detail .assign .btn', { hasText: '3' }).click();
  expect(await page.evaluate(() => (window as any).game.world.char.hotbar[2])).toBe('corpse_burst');
  await page.screenshot({ path: `test-results/${info.project.name}-skilltree-detail.png` });
  expect(errors).toEqual([]);
});

test('every class has a tree that fits', async ({ page }) => {
  for (const cls of ['reaver', 'arcanist', 'huntress', 'forgewright', 'hiveborn']) {
    await page.goto(`/?autostart&seed=5&class=${cls}`);
    await page.waitForFunction(() => !!(window as any).game);
    await page.evaluate(() => (window as any).game.open('skills'));
    await expect(page.locator('.tree-branch')).toHaveCount(3);
    const n = await page.locator('.tnode').count();
    expect(n).toBeGreaterThanOrEqual(8);
    const fits = await page.locator('.tree').evaluate((el) => { const b = el.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1; });
    expect(fits, cls).toBe(true);
    await expect(page.locator('.tnode.sel')).toHaveCount(1);
  }
});
