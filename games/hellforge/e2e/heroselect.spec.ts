import { expect, test } from '@playwright/test';

// New Hero: the classes stand round a fire. One is picked by tapping the figure or its name, and the scene moves.
test('the New Hero scene shows every class, picks one by tapping it, and is alive', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  if (await page.getByRole('button', { name: 'New Hero' }).count()) await page.getByRole('button', { name: 'New Hero' }).click();
  const scene = page.locator('canvas.hero-scene');
  await expect(scene).toBeVisible();
  await expect(page.locator('.class-card')).toHaveCount(6);
  await expect(page.locator('.class-card.sel')).toHaveText('Reaver');
  await expect(page.locator('.ca-name')).toHaveText('Reaver');
  await page.waitForTimeout(700);

  // It fits the screen, is drawn at the device's resolution, and has something in it.
  const box = (await scene.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
  expect(box.height).toBeGreaterThan(150);
  const sample = () => scene.evaluate((cv: HTMLCanvasElement) => {
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0;
    let sum = 0;
    for (let i = 0; i < d.length; i += 16) {
      const v = d[i] + d[i + 1] + d[i + 2];
      if (v > 120) lit++;
      sum = (sum + v * ((i >> 4) % 251)) % 1000003;
    }
    return { lit, sum, ratio: cv.width / cv.clientWidth, dpr: devicePixelRatio };
  });
  const a = await sample();
  expect(a.lit).toBeGreaterThan(500);
  expect(Math.abs(a.ratio - a.dpr)).toBeLessThan(0.05);
  // The fire flickers and the heroes shift: two moments are not the same picture.
  await page.waitForTimeout(400);
  expect((await sample()).sum).not.toBe(a.sum);

  // Tap the last figure on the right: the Hiveborn.
  await scene.click({ position: { x: box.width * 0.9, y: box.height * 0.55 } });
  await expect(page.locator('.class-card.sel')).toHaveText('Hiveborn');
  await expect(page.locator('.ca-name')).toHaveText('Hiveborn');
  await expect(page.locator('.ca-branch')).toHaveText(['Soldier', 'Archer', 'Faith']);
  await expect(scene).toHaveAttribute('aria-label', /Hiveborn is chosen/);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `test-results/${info.project.name}-heroselect-hiveborn.png` });

  // The names underneath pick too, and the choice is the hero that gets made.
  await page.locator('.class-card', { hasText: 'Arcanist' }).click();
  await expect(page.locator('.ca-branch')).toHaveText(['Fire', 'Cold', 'Storm']);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `test-results/${info.project.name}-heroselect-arcanist.png` });
  await page.locator('.name-in').fill('Vex');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForFunction(() => !!(window as any).game);
  expect(await page.evaluate(() => (window as any).game.world.char.classId)).toBe('arcanist');

  // Back at the title screen the saved hero has a portrait.
  await page.evaluate(() => (window as any).game.quitToMenu());
  await expect(page.locator('.char-card canvas.cc-figure')).toHaveCount(1);
  await page.screenshot({ path: `test-results/${info.project.name}-heroselect-list.png` });
  expect(errors).toEqual([]);
});
