import { test, expect } from '@playwright/test';

async function finishSetup(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Paste your roadmap' }).fill('# Settings regression\n## Foundations\n### Variables\n### Functions');
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}

test('Arena cycle 033: capacity settings reject invalid values and persist valid values', async ({ page }) => {
  await finishSetup(page);
  await page.goto('/settings');

  const study = page.getByLabel('Normal max study minutes/day');
  const focus = page.getByLabel('Max continuous focus');
  const buffer = page.getByLabel('Protected buffer %');
  const busy = page.getByLabel('Busy capacity');
  const exam = page.getByLabel('Exam capacity');
  const initialStudy = await study.inputValue();

  await study.fill('-1');
  await page.getByRole('button', { name: 'Save planner settings' }).click();
  await expect(page.getByRole('status')).toContainText('Use valid capacity values.');
  await page.reload();
  await expect(page.getByLabel('Normal max study minutes/day')).toHaveValue(initialStudy);

  await page.getByLabel('Normal max study minutes/day').fill('275');
  await page.getByLabel('Max continuous focus').fill('75');
  await page.getByLabel('Protected buffer %').fill('20');
  await page.getByLabel('Busy capacity').fill('90');
  await page.getByLabel('Exam capacity').fill('135');
  await page.getByRole('button', { name: 'Save planner settings' }).click();
  await expect(page.getByRole('status')).toContainText('Settings saved locally');
  await page.reload();

  await expect(page.getByLabel('Normal max study minutes/day')).toHaveValue('275');
  await expect(page.getByLabel('Max continuous focus')).toHaveValue('75');
  await expect(page.getByLabel('Protected buffer %')).toHaveValue('20');
  await expect(page.getByLabel('Busy capacity')).toHaveValue('90');
  await expect(page.getByLabel('Exam capacity')).toHaveValue('135');
});
