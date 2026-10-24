import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function finishSetup(page: Page) {
  await page.goto('/');
  const roadmap = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(roadmap).toBeVisible();
  await roadmap.fill('# Test roadmap\n## Foundations\n### Variables\n### Functions\n## Practice\n### Small exercise');
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}

async function addFixedExternalTask(page: Page, title: string) {
  await page.goto('/planner');
  await page.getByRole('button', { name: /External task/ }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Estimated minutes').fill('5');
  await page.getByRole('checkbox').check();
  await page.getByLabel('Start').fill('15:00');
  await page.getByLabel('End', { exact: true }).fill('16:00');
  await page.getByRole('button', { name: 'Save external task' }).click();
  await page.getByRole('button', { name: 'Generate today' }).click();
  await expect(page.locator('article.card').filter({ has: page.getByRole('heading', { name: 'Schedule preview' }) }).getByText(title, { exact: true })).toBeVisible();
}

test('Arena cycle 015: repeated completion activation preserves one outcome after reload', async ({ page }) => {
  await finishSetup(page);
  await addFixedExternalTask(page, 'Arena repeated completion task');
  await page.goto('/today');
  const task = page.locator('.timeline-card').filter({ hasText: 'Arena repeated completion task' });
  const complete = task.getByRole('button', { name: 'Complete' });
  await expect(complete).toBeVisible();

  // Deliver two consecutive activations without waiting for an intervening render.
  await complete.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });

  await expect(task.getByText('Completed', { exact: true })).toBeVisible();
  await expect(task.locator('.status-badge')).toHaveCount(1);
  await expect(task.getByRole('button', { name: 'Complete' })).toHaveCount(0);
  await expect(task.getByRole('button', { name: 'Skip' })).toHaveCount(0);
  await page.reload();
  const persisted = page.locator('.timeline-card').filter({ hasText: 'Arena repeated completion task' });
  await expect(persisted.getByText('Completed', { exact: true })).toBeVisible();
  await expect(persisted.locator('.status-badge')).toHaveCount(1);
});
