import { test, expect } from '@playwright/test';

test('Arena retry smoke: invalid external-task interval is rejected', async ({ page }) => {
  await page.goto('/');
  const roadmap = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(roadmap).toBeVisible();
  await roadmap.fill('# Test roadmap\n## Foundations\n### Variables\n### Functions\n## Practice\n### Small exercise');
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await page.getByRole('heading', { name: 'Today', exact: true }).waitFor();

  await page.goto('/planner');
  await page.getByRole('button', { name: /External task/ }).click();
  await page.getByLabel('Title').fill('Arena invalid fixed-window task');
  await page.getByLabel('Estimated minutes').fill('30');
  await page.getByRole('checkbox').check();
  await page.getByLabel('Start').fill('17:00');
  await page.getByLabel('End', { exact: true }).fill('17:10');
  await page.getByRole('button', { name: 'Save external task' }).click();
  await expect(page.getByRole('status')).toContainText('fixed time window is shorter');
  await expect(page.getByText('Arena invalid fixed-window task', { exact: true })).toHaveCount(0);
});