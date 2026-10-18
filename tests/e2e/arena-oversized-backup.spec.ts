import { test, expect } from '@playwright/test';

async function createSyntheticRoadmap(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Paste your roadmap' }).fill('# Oversized backup safety\n## Foundations\n### Variables\n### Functions');
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.goto('/roadmap');
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Roadmap name').fill('Arena oversized backup preservation');
  await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
  await page.getByRole('button', { name: 'Generated work', exact: true }).click();
  await expect(page.getByText('Generated tasks')).toBeVisible();
  await page.getByRole('button', { name: /Approve & use/ }).click();
  await page.getByRole('button', { name: 'Roadmap library', exact: true }).click();
  await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena oversized backup preservation' })).toBeVisible();
}

test('Arena cycle 040: oversized backup is rejected without clearing existing app data', async ({ page }) => {
  await createSyntheticRoadmap(page);
  await page.goto('/settings');
  const tooLarge = ' '.repeat(5_000_001);
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
    name: 'oversized-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(tooLarge),
  });
  await expect(page.locator('.notice-bar')).toContainText('Backup is too large (maximum 5 MB).');
  await page.goto('/roadmap');
  await page.getByRole('button', { name: 'Roadmap library', exact: true }).click();
  await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena oversized backup preservation' })).toBeVisible();
});
