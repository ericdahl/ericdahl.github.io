import { expect, test } from '@playwright/test';

test('a necromancer raises a skeleton army', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/?seed=7');
  await page.locator('.class-card', { hasText: 'Necromancer' }).click();
  await page.locator('.name-in').fill('Morwen');
  await page.screenshot({ path: `test-results/${info.project.name}-necro-create.png` });
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForFunction(() => !!(window as any).game);
  expect(await page.evaluate(() => (window as any).game.world.char.classId)).toBe('necromancer');

  // Skip ahead: a level 12 necromancer with a few points in each tree, out in the fields.
  await page.evaluate(() => {
    const w = (window as any).game.world;
    Object.assign(w.char, { level: 12 });
    w.char.skills = { bone_shards: 3, raise_skeleton: 5, frailty: 2, skeletal_mastery: 2, bone_ward: 1, grave_golem: 1 };
    w.char.hotbar = ['bone_shards', 'raise_skeleton', 'grave_golem', 'bone_ward'];
    w.refreshStats();
    w.player.life = w.stats.maxLife;
    w.player.mana = w.stats.maxMana;
    w.cmdInteract({ kind: 'exit', index: 0 });
  });
  await expect.poll(() => page.evaluate(() => (window as any).game.world.area.def.id), { timeout: 20000 }).toBe('cinder_fields');

  // Make corpses next to a pack, then raise them with the skill button (auto-targets the nearest corpse).
  await page.evaluate(() => {
    const w = (window as any).game.world;
    const pack = w.area.monsters.filter((m: any) => !m.dead && !m.superId).slice(0, 8);
    w.player.x = pack[0].x - 1.5;
    w.player.y = pack[0].y;
    w.player.invuln = 999;
    for (const m of pack.slice(0, 4)) w.damageMonster(m, { phys: 1e6, fire: 0, cold: 0, light: 0, poison: 0 });
  });
  await page.evaluate(() => (window as any).game.ui?.refresh?.());
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      const w = (window as any).game.world;
      w.player.mana = w.stats.maxMana;
      w.cmdAutoSkill('raise_skeleton');
    });
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => (window as any).game.world.cmdAutoSkill('grave_golem'));
  await page.waitForTimeout(700);
  await page.evaluate(() => (window as any).game.world.cmdAutoSkill('bone_ward'));
  await page.waitForTimeout(900);
  const kinds = await page.evaluate(() => (window as any).game.world.minions.map((m: any) => m.ally).sort());
  expect(kinds).toEqual(['golem', 'skeleton', 'skeleton', 'skeleton', 'skeleton']);
  await page.screenshot({ path: `test-results/${info.project.name}-necro-army.png` });
  await page.evaluate(() => (window as any).game.world.cmdAutoSkill('bone_shards'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `test-results/${info.project.name}-necro-fight.png` });

  // The skills panel shows the necromancer tree.
  await page.keyboard.press('k');
  await expect(page.locator('.panel.skl')).toContainText('Raise Skeleton');
  await expect(page.locator('.panel.skl')).toContainText('Bone Storm');
  await page.screenshot({ path: `test-results/${info.project.name}-necro-skills.png` });
  expect(errors).toEqual([]);
});
