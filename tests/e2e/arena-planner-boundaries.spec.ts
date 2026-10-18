import { test, expect } from '@playwright/test';

async function setup(page: import('@playwright/test').Page) {
  await page.goto('/');
  const roadmap = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(roadmap).toBeVisible();
  await roadmap.fill('# Arena boundary tests\n## Foundations\n### Variables\n### Functions');
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}

test('Arena cycle 016: busy-time reversed and zero-length intervals are rejected', async ({ page }) => {
  await setup(page);
  await page.goto('/planner');
  await page.getByRole('button', { name: 'Busy time' }).click();
  const form = page.locator('article.form-card').filter({ has: page.getByRole('heading', { name: 'Busy block' }) });
  await form.getByLabel('Title').fill('Arena invalid busy interval');

  await form.getByLabel('Start').fill('18:00');
  await form.getByLabel('End').fill('17:00');
  await form.getByRole('button', { name: 'Save busy block' }).click();
  await expect(page.getByRole('status')).toContainText('valid time range');
  await expect(form).toBeVisible();

  await form.getByLabel('Start').fill('17:00');
  await form.getByLabel('End').fill('17:00');
  await form.getByRole('button', { name: 'Save busy block' }).click();
  await expect(page.getByRole('status')).toContainText('valid time range');
  await expect(form).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Busy block' })).toHaveCount(0);
});

test('Arena cycle 016: external-task duration below and above supported bounds is rejected', async ({ page }) => {
  await setup(page);
  await page.goto('/planner');
  await page.getByRole('button', { name: /External task/ }).click();
  const form = page.locator('article.form-card').filter({ has: page.getByRole('heading', { name: 'External task' }) });

  await form.getByLabel('Title').fill('Arena too-short external task');
  await form.getByLabel('Estimated minutes').fill('4');
  await form.getByRole('button', { name: 'Save external task' }).click();
  await expect(page.getByRole('status')).toContainText('duration from 5 to 1440 minutes');
  await expect(form).toBeVisible();

  await form.getByLabel('Title').fill('Arena too-long external task');
  await form.getByLabel('Estimated minutes').fill('1441');
  await form.getByRole('button', { name: 'Save external task' }).click();
  await expect(page.getByRole('status')).toContainText('duration from 5 to 1440 minutes');
  await expect(form).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /External task/ }).click();
  await expect(page.getByLabel('Title')).toHaveValue('');
  await expect(page.getByLabel('Estimated minutes')).toHaveValue('30');
});
