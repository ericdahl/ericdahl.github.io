import { expect, test, type Locator } from '@playwright/test';

/** The Chinese characters inside an element, without the pinyin above them. */
async function hanzi(loc: Locator): Promise<string> {
  return (await loc.locator('.hz').allTextContents()).join('');
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

test('library lists stories and poems', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(15); // 10 stories, 4 poems, "your own text"
  await expect(page.locator('.card').first()).toContainText('My Family');
  await page.getByRole('button', { name: /Simplified and Traditional/ }).click();
  await expect.poll(() => hanzi(page.locator('.card-title').nth(2))).toBe('小雨點去旅行');
  await page.getByRole('button', { name: /Simplified and Traditional/ }).click();
});

test('narration highlights each character as it is read', async ({ page }) => {
  await page.goto('/#/read/01-my-family');
  await expect(page.locator('.story .c').first()).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  // the title is read first, then line 1 "我叫乐乐。"
  await expect(page.locator('.c.cur .hz')).toHaveText('我', { timeout: 5000 });
  await expect(page.locator('.sent.cur')).toHaveAttribute('data-s', '1', { timeout: 5000 });
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const t = await page.locator('.c.cur .hz').textContent().catch(() => null);
    if (t) seen.add(t);
    await page.waitForTimeout(100);
  }
  expect([...seen].some((c) => '叫乐'.includes(c))).toBe(true);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('next line and line-by-line mode', async ({ page }) => {
  await page.goto('/#/read/01-my-family');
  await page.getByRole('button', { name: 'Next line' }).click();
  await page.getByRole('button', { name: 'Next line' }).click();
  await expect(page.locator('.sent.cur')).toHaveAttribute('data-s', '2');
  await page.getByRole('button', { name: /Reading mode/ }).click();
  await expect(page.getByRole('button', { name: /One line at a time/ })).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  // "我今年六岁。" is about 2 s; playback stops by itself at the end of the line
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.sent.cur')).toHaveAttribute('data-s', '2');
  // reset the mode for other tests
  await page.getByRole('button', { name: /Reading mode/ }).click();
  await page.getByRole('button', { name: /Reading mode/ }).click();
});

test('tapping a word shows it with pinyin', async ({ page }) => {
  await page.goto('/#/read/02-little-bear-birthday');
  await page.locator('.w', { hasText: 'dàn' }).first().click();
  const card = page.locator('.wordcard');
  await expect(card).toBeVisible();
  await expect(card.locator('.card-word')).toContainText('蛋');
  await expect(card.locator('.card-word')).toContainText('dàn');
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(card).toBeHidden();
});

test('display settings: hide pinyin, Traditional characters', async ({ page }) => {
  await page.goto('/#/read/01-my-family');
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('button', { name: '隐藏 Hide' }).first().click();
  await expect(page.locator('.story .py').first()).toBeHidden();
  await page.getByRole('button', { name: '繁體' }).click();
  await expect.poll(() => hanzi(page.locator('.story'))).toContain('媽媽');
  // put things back
  await page.getByRole('button', { name: '显示 Show' }).first().click();
  await page.getByRole('button', { name: '简体' }).click();
  await expect.poll(() => hanzi(page.locator('.story'))).toContain('妈妈');
});

test('pasted text gets pinyin', async ({ page }) => {
  await page.goto('/#/mine');
  await page.locator('textarea').fill('我喜欢看书。今天天气很好！');
  await page.getByRole('button', { name: /Read it/ }).click();
  await expect(page.locator('.story .sent')).toHaveCount(2);
  await expect(page.locator('.story')).toContainText('xǐ');
  expect(await hanzi(page.locator('.story .w').nth(1))).toBe('喜欢');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.saved-item')).toHaveCount(1);
});
