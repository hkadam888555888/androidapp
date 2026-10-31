import { test, expect } from './fixtures';

async function createKnownRoadmap(page: import('@playwright/test').Page) {
  await page.goto('/');
  const roadmap = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(roadmap).toBeVisible();
  await roadmap.fill('# Backup safety roadmap\n## Foundations\n### Variables\n### Functions');
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await page.goto('/roadmap');
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Roadmap name').fill('Arena backup safety record');
  await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
  await expect(page.getByText('Generated tasks')).toBeVisible();
  await page.getByRole('button', { name: /Approve & use/ }).click();
  await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena backup safety record' })).toBeVisible();
}

test('Arena cycle 031: valid JSON with an unsupported schema version is rejected atomically', async ({ page }) => {
  await createKnownRoadmap(page);
  await page.goto('/settings');
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
    name: 'unsupported-schema.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 99, data: {} })),
  });
  await expect(page.locator('.notice-bar')).toContainText('Unsupported backup version');
  await page.goto('/roadmap');
  await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena backup safety record' })).toBeVisible();
});

test('Arena cycle 031: incomplete current-schema backup is rejected before clearing stored rows', async ({ page }) => {
  await createKnownRoadmap(page);
  await page.goto('/settings');
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
    name: 'incomplete-schema.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ schemaVersion: 9, data: {} })),
  });
  await expect(page.locator('.notice-bar')).toContainText('Backup schema 9 is incomplete');
  await page.goto('/roadmap');
  await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena backup safety record' })).toBeVisible();
});
