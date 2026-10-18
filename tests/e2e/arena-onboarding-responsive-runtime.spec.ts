import { test, expect } from '@playwright/test';

async function finishSetup(page: import('@playwright/test').Page) {
  await page.goto('/');
  const roadmap = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(roadmap).toBeVisible();
  await roadmap.fill('# Arena onboarding recovery\n## Foundations\n### Variables\n### Functions');
  await page.getByRole('button', { name: 'Next: routine' }).click();
}

test('Arena cycle 012: invalid first-run time window is not saved and can be corrected in place', async ({ page }) => {
  await finishSetup(page);
  await page.getByLabel('Study window starts').fill('18:00');
  await page.getByLabel('Study window ends').fill('16:00');
  await page.getByRole('button', { name: 'Next: review' }).click();
  await expect(page.getByRole('button', { name: 'Save setup & open Today' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();

  await expect(page.getByRole('alert')).toContainText('Study window end must be later than its start.');
  await expect(page.getByText('Step 2 of 3 · A realistic day')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toHaveCount(0);

  await page.getByLabel('Study window ends').fill('20:00');
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByText('Arena onboarding recovery', { exact: true })).toHaveCount(1);
});

test('Arena cycles 070 and 083: capture all-route responsive evidence and report browser runtime errors', async ({ page }, testInfo) => {
  await finishSetup(page);
  await page.getByLabel('Study window starts').fill('15:00');
  await page.getByLabel('Study window ends').fill('18:00');
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();

  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  const routes = [
    ['/today', 'Today'],
    ['/planner', 'Planner'],
    ['/roadmap', 'Roadmap'],
    ['/habits', 'Habits'],
    ['/statistics', 'Statistics'],
    ['/review', 'Daily Review'],
    ['/calendar', 'Calendar'],
    ['/notifications', 'Notifications'],
    ['/diagnostics', 'System health'],
    ['/settings', 'Settings'],
    ['/privacy', 'Privacy & data handling'],
  ] as const;

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, heading] of routes) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      const bounds = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        bodyScroll: document.body.scrollWidth,
      }));
      expect(bounds.scroll, path + ' document horizontal overflow at ' + width + 'px').toBeLessThanOrEqual(bounds.viewport + 2);
      expect(bounds.bodyScroll, path + ' body horizontal overflow at ' + width + 'px').toBeLessThanOrEqual(bounds.viewport + 2);
      await page.screenshot({
        path: testInfo.outputPath('route-' + path.slice(1) + '-' + width + 'px.png'),
        fullPage: true,
      });
    }
  }
  expect(runtimeErrors, 'Unexpected page errors or console errors while sweeping core routes').toEqual([]);
});
