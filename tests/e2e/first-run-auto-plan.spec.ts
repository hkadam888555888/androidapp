import { test, expect } from './fixtures';

test('first-run setup creates a usable Today schedule without a manual Generate action', async ({ page }) => {
  await page.goto('/');

  const roadmap = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(roadmap).toBeVisible();
  await roadmap.fill(
    '# Test roadmap\n## Python\n### Variables\n### Functions\n## Mathematics\n### Probability',
  );

  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();

  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.timeline-item').count(), {
    message: 'Today should contain scheduled work immediately after first-run setup',
    timeout: 15_000,
  }).toBeGreaterThan(0);
  await expect(page.getByText(/Today’s schedule is ready:/)).toBeVisible();
});
