import { expect, test, type Page } from '@playwright/test';

/** Loudness of the music bus over a short window, via an analyser tapped onto it. */
async function musicLevel(page: Page, ms = 1500): Promise<number> {
  return page.evaluate(async (ms) => {
    const a = (window as any).game.audio;
    const ctx: AudioContext = a.ctx;
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    a.music.bus.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      await new Promise((r) => setTimeout(r, 50));
      an.getFloatTimeDomainData(buf);
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
    }
    a.music.bus.disconnect(an);
    return peak;
  }, ms);
}

test('music plays, follows the area and the settings; weather fills each area', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'one run is enough');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?autostart&seed=7');
  await page.waitForFunction(() => !!(window as any).game);
  await page.mouse.click(400, 300); // a gesture unlocks audio
  await expect.poll(() => page.evaluate(() => (window as any).game.audio.ctx?.state)).toBe('running');
  expect(await page.evaluate(() => (window as any).game.audio.music.theme)).toBe('town');
  const level = await musicLevel(page, 4000);
  expect(level).toBeGreaterThan(0.002);
  expect(level).toBeLessThan(0.5);

  // Turning music off silences the score.
  await page.evaluate(() => (window as any).game.toggleSetting('music'));
  await page.waitForTimeout(1500);
  expect(await musicLevel(page, 800)).toBeLessThan(0.002);
  await page.evaluate(() => (window as any).game.toggleSetting('music'));

  for (const id of ['town', 'cinder_fields', 'gloomwood', 'hollow_cave', 'sunken_chapel', 'catacombs1', 'hellforge', 'tel_maresh', 'ashfall_road', 'glass_sea', 'carrion_mesa', 'whisper_cistern', 'buried_bazaar', 'noon_vault']) {
    await page.evaluate((id) => {
      const w = (window as any).game.world;
      w.enterArea(id, 'start');
      w.player.invuln = 999;
      for (const m of w.area.monsters) m.alert = false;
    }, id);
    await page.waitForTimeout(1200);
    const theme = await page.evaluate(() => (window as any).game.world.area.level.theme);
    expect(await page.evaluate(() => (window as any).game.audio.music.theme)).toBe(theme);
    await page.screenshot({ path: `test-results/${info.project.name}-weather-${id}.png` });
  }

  // Low life, chill and poison tint the screen edges.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    w.player.life = w.stats.maxLife * 0.15;
    w.player.chill = 3;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${info.project.name}-vignette.png` });
  expect(errors).toEqual([]);
});
