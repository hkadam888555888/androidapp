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

  // The signature light must be visible and moving in normal use, not merely
  // present in the stylesheet or disabled correctly for reduced-motion users.
  const initialGlow = await page.locator('.today-hero').evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    const rect = element.getBoundingClientRect();
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      opacity: Number(style.opacity),
      width: style.width,
      height: style.height,
      heroWidth: rect.width,
      heroHeight: rect.height,
    };
  });
  expect(initialGlow.animationName).toBe('marHeroLight');
  expect(initialGlow.animationDuration).toBe('10.5s');
  expect(initialGlow.opacity).toBeGreaterThan(0.2);
  expect(Number.parseFloat(initialGlow.width)).toBeGreaterThan(0);
  expect(Number.parseFloat(initialGlow.height)).toBeGreaterThan(0);

  const secondaryGlowAnimation = await page.locator('.today-hero').evaluate((element) => getComputedStyle(element, '::after').animationName);
  expect(secondaryGlowAnimation).toBe('marHeroDrift');
  await expect(page.locator('.next-session-indicator')).toHaveClass(/is-active/);
  const activeSignalAnimation = await page.locator('.next-session-indicator').evaluate((element) => getComputedStyle(element).animationName);
  expect(activeSignalAnimation).toBe('todaySignalBreathe');

  const firstFrame = await page.locator('.today-hero').evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return { opacity: style.opacity, transform: style.transform };
  });
  await page.waitForTimeout(1400);
  const nextFrame = await page.locator('.today-hero').evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return { opacity: style.opacity, transform: style.transform };
  });
  expect(
    firstFrame.opacity !== nextFrame.opacity || firstFrame.transform !== nextFrame.transform,
    'The hero glow should breathe or drift between animation frames',
  ).toBeTruthy();

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
  const ambientAnimations = await page.locator('.app-shell').evaluate((element) => ({
    primary: getComputedStyle(element, '::before').animationName,
    secondary: getComputedStyle(element, '::after').animationName,
  }));
  const heroAnimations = await page.locator('.today-hero').evaluate((element) => ({
    primary: getComputedStyle(element, '::before').animationName,
    secondary: getComputedStyle(element, '::after').animationName,
  }));
  const signalAnimation = await page.locator('.next-session-indicator').evaluate((element) => getComputedStyle(element).animationName);
  expect(ambientAnimations.primary).toBe('none');
  expect(ambientAnimations.secondary).toBe('none');
  expect(heroAnimations.primary).toBe('none');
  expect(heroAnimations.secondary).toBe('none');
  expect(signalAnimation).toBe('none');
});


test('Today review shortcut opens the date displayed on the dashboard', async ({ page }) => {
  await completeFirstRun(page);

  const expectedDate = await page.evaluate(() => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  await page.getByRole('link', { name: /Review the day/ }).click();
  await expect(page.getByRole('heading', { name: 'Daily Review' })).toBeVisible();
  await expect(page.locator('.settings-grid > .card .eyebrow').first()).toHaveText(expectedDate);
});
