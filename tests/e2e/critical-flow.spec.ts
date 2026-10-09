import { test, expect } from '@playwright/test';

async function finishFirstRunSetup(page: import('@playwright/test').Page) {
  await page.goto('/');
  // Each test gets a fresh browser context; complete the first-run wizard before testing feature routes.
  const roadmapBox = page.getByRole('textbox', { name: 'Paste your roadmap' });
  if (await roadmapBox.isVisible().catch(() => false)) {
    await roadmapBox.fill('# Test roadmap\n## Foundations\n### Variables\n### Functions\n## Practice\n### Small exercise');
    await page.getByRole('button', { name: 'Next: routine' }).click();
    await page.getByRole('button', { name: 'Next: review' }).click();
    await page.getByRole('button', { name: 'Save setup & open Today' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  }
}

test.describe('My Adaptive Routine critical flow', () => {
  test('roadmap -> plan -> explicit completion survives reload', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/roadmap');
    await page.getByRole('button', { name: 'Load example' }).click();
    await page.getByRole('button', { name: 'Analyze roadmap' }).click();
    await expect(page.getByText('Generated tasks')).toBeVisible();
    await page.getByRole('button', { name: /Approve & use/ }).click();
    await expect(page.getByText(/Saved .* tasks\./)).toBeVisible();

    await page.goto('/planner');
    await page.getByRole('button', { name: 'Generate today' }).click();
    await expect(page.getByText('Schedule preview')).toBeVisible();
    await page.goto('/today');
    const complete = page.getByRole('button', { name: 'Complete' }).first();
    await expect(complete).toBeVisible();
    await complete.click();
    await expect(page.getByText('completed', { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText('completed', { exact: true }).first()).toBeVisible();
  });

  test('curriculum changes are visible before the next approval', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/roadmap');
    await page.getByRole('button', { name: 'Load example' }).click();
    await page.getByRole('button', { name: 'Analyze roadmap' }).click();
    await page.getByRole('button', { name: /Approve & use/ }).click();
    await expect(page.getByText(/Saved .* tasks\./)).toBeVisible();

    const editor = page.getByRole('textbox', { name: 'Roadmap source text' });
    await editor.fill(`${await editor.inputValue()}\n    - Model deployment`);
    await page.getByRole('button', { name: 'Analyze roadmap' }).click();
    await expect(page.getByText(/Changes since v1/)).toBeVisible();
    await expect(page.getByText(/change\(s\)/)).toBeVisible();
  });
});
