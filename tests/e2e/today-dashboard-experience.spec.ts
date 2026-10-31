import { test, expect } from './fixtures';

async function completeFirstRun(page: import('@playwright/test').Page) {
  await page.goto('/');
  const roadmap = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(roadmap).toBeVisible();
  await roadmap.fill('# Today experience test\n## Foundations\n### Variables\n### Functions\n## Practice\n### Mini project');
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}

test('Today dashboard renders real daily sections and remains usable on a narrow phone', async ({ page }, testInfo) => {
  await completeFirstRun(page);

  await expect(page.locator('.today-hero')).toBeVisible();
  await expect(page.locator('.today-progress-ring')).toBeVisible();
  await expect(page.locator('.today-metrics .today-metric')).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Your day, in focus' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Small things count' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('today-dashboard-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 320, height: 780 });
  await expect(page.locator('.today-hero')).toBeVisible();
  await expect(page.locator('.sidebar .primary-nav')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document, 'Today should not create horizontal page overflow').toBeLessThanOrEqual(widths.viewport);
  expect(widths.body, 'Today should not create horizontal body overflow').toBeLessThanOrEqual(widths.viewport);
  await page.screenshot({ path: testInfo.outputPath('today-dashboard-320px.png'), fullPage: true });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ambientAnimation = await page.locator('.app-shell').evaluate((element) => getComputedStyle(element, '::before').animationName);
  const heroAnimation = await page.locator('.today-hero').evaluate((element) => getComputedStyle(element, '::before').animationName);
  expect(ambientAnimation).toBe('none');
  expect(heroAnimation).toBe('none');
});
