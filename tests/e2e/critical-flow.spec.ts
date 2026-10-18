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
    await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  }
}

test.describe('My Adaptive Routine critical flow', () => {
  test('roadmap -> plan -> explicit completion survives reload', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/roadmap');
    await page.getByRole('button', { name: 'Load example' }).click();
    await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
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
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible();
  });

  test('curriculum changes are visible before the next approval', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/roadmap');
    await page.getByRole('button', { name: 'Load example' }).click();
    await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
    await page.getByRole('button', { name: /Approve & use/ }).click();
    await expect(page.getByText(/Saved .* tasks\./)).toBeVisible();

    const editor = page.getByRole('textbox', { name: 'Roadmap source text' });
    await editor.fill(`${await editor.inputValue()}\n    - Model deployment`);
    await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
    await expect(page.getByText(/Changes since v1/)).toBeVisible();
    await expect(page.getByText(/change\(s\)/)).toBeVisible();
  });

  test('roadmap file import remains editable until setup is confirmed', async ({ page }) => {
    await page.goto('/');
    const roadmapBox = page.getByRole('textbox', { name: 'Paste your roadmap' });
    await expect(roadmapBox).toBeVisible();
    await page.getByLabel('Choose a Markdown or text roadmap file').setInputFiles({
      name: 'uploaded-roadmap.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Uploaded Roadmap\n## Foundations\n### Variables\n### Functions\n## Practice\n### Small exercise'),
    });
    await expect(roadmapBox).toHaveValue(/Uploaded Roadmap/);
    await page.getByRole('button', { name: 'Next: routine' }).click();
    await page.getByRole('button', { name: 'Next: review' }).click();
    await expect(page.getByRole('heading', { name: 'Ready to build your first plan?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save setup & open Today' })).toBeEnabled();
    await expect(page.getByRole('heading', { name: 'Today' })).toHaveCount(0);
  });

  test('quick actions search and open an existing destination', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.getByRole('button', { name: /Search your routine/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Search and quick actions' });
    await expect(dialog).toBeVisible();
    const search = page.getByRole('textbox', { name: 'Search tasks, roadmaps, habits and pages' });
    await search.fill('Calendar');
    await dialog.getByRole('button', { name: /Calendar/ }).click();
    await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });

  test('focus timer expiry never records task completion automatically', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/roadmap');
    await page.getByRole('button', { name: 'Load example' }).click();
    await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
    await expect(page.getByText('Generated tasks')).toBeVisible();
    await page.getByRole('button', { name: /Approve & use/ }).click();
    await expect(page.getByText(/Saved .* tasks\./)).toBeVisible();

    await page.goto('/planner');
    await page.getByRole('button', { name: 'Generate today' }).click();
    await expect(page.getByText('Schedule preview')).toBeVisible();
    await page.goto('/today');
    const focus = page.getByRole('button', { name: 'Focus' }).first();
    await expect(focus).toBeVisible();
    await focus.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Ready when you are')).toBeVisible();
    const [minutes, seconds] = (await dialog.locator('.focus-timer strong').innerText()).split(':').map(Number);
    await page.clock.install();
    await dialog.getByRole('button', { name: 'Start timer' }).click();
    await page.clock.fastForward((minutes * 60 + seconds + 2) * 1000);
    await expect(dialog.getByText('Time block ended')).toBeVisible();
    await expect(dialog.getByText('Planned', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Complete' }).first()).toBeVisible();
  });

});
