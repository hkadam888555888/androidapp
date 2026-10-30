import { test, expect } from './fixtures';

async function createSyntheticRoadmap(page: import('@playwright/test').Page, name: string) {
  await page.goto('/');
  const source = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(source).toBeVisible();
  await source.fill('# Arena reset integrity\n## Foundations\n### Variables\n### Functions');
  await page.getByLabel('Roadmap title').fill(name);
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();

  await page.goto('/roadmap');
  await page.getByRole('button', { name: 'Load example' }).click();
  await page.getByLabel('Roadmap name').fill(name);
  await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
  await expect(page.getByText('Generated tasks')).toBeVisible();
  await page.getByRole('button', { name: /Approve & use/ }).click();
  await expect(page.getByText(/Saved .* tasks\./)).toBeVisible();
  await expect(page.locator('.portfolio-main').filter({ hasText: name })).toBeVisible();
}

test('Arena cycle 032: exact DELETE clears synthetic records and returns to first-run setup', async ({ page }) => {
  const recordName = 'Arena reset synthetic roadmap';
  await createSyntheticRoadmap(page, recordName);

  await page.goto('/settings');
  const confirmation = page.getByRole('textbox', { name: 'Type DELETE to confirm' });
  const deleteButton = page.getByRole('button', { name: 'Delete all local data' });
  await expect(deleteButton).toBeDisabled();
  await confirmation.fill('DELETE ');
  await expect(deleteButton).toBeDisabled();
  await confirmation.fill('DELETE');
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  await expect(page.getByRole('heading', { name: 'Turn your goals into a routine.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Turn your goals into a routine.' })).toBeVisible();

  await createSyntheticRoadmap(page, 'Arena fresh workspace after reset');
  await page.goto('/roadmap');
  await expect(page.locator('.portfolio-main').filter({ hasText: recordName })).toHaveCount(0);
  await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena fresh workspace after reset' })).toBeVisible();
});
