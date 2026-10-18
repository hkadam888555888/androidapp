import { test, expect } from '@playwright/test';

async function finishFirstRunSetup(page: import('@playwright/test').Page) {
  await page.goto('/');
  // App bootstrap is asynchronous. Wait for the first-run route instead of silently skipping setup
  // during the brief loading window in a fresh browser context.
  const roadmapBox = page.getByRole('textbox', { name: 'Paste your roadmap' });
  await expect(roadmapBox).toBeVisible();
  await roadmapBox.fill('# Test roadmap\n## Foundations\n### Variables\n### Functions\n## Practice\n### Small exercise');
  await page.getByRole('button', { name: 'Next: routine' }).click();
  await page.getByRole('button', { name: 'Next: review' }).click();
  await page.getByRole('button', { name: 'Save setup & open Today' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}

async function addFixedExternalTask(page: import('@playwright/test').Page, title: string) {
  await page.goto('/planner');
  await page.getByRole('button', { name: /External task/ }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Category').selectOption('URGENT');
  await page.getByLabel('Priority').selectOption('urgent');
  await page.getByLabel('Estimated minutes').fill('5');
  await page.getByRole('checkbox').check();
  await page.getByLabel('Start').fill('15:00');
  await page.getByLabel('End').fill('16:00');
  await page.getByRole('button', { name: 'Save external task' }).click();
  await page.getByRole('button', { name: 'Generate today' }).click();
  const schedulePreview = page.locator('article.card').filter({
    has: page.getByRole('heading', { name: 'Schedule preview' }),
  });
  await expect(schedulePreview.getByText(title, { exact: true })).toBeVisible();
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

    await addFixedExternalTask(page, 'Explicit completion test task');
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
    await expect(page.getByRole('heading', { name: /Changes since v\d+/ })).toBeVisible();
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

    await addFixedExternalTask(page, 'Focus timer test task');
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


  test('urgent-day adaptation previews first and persists only after explicit apply', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/planner');
    await page.getByRole('button', { name: 'Adapt today' }).click();
    const panel = page.getByRole('article', { name: /Adapt today/ });
    await page.getByLabel('What changed today?').fill('Unexpected lab session');
    await page.getByLabel('Start time').fill('15:00');
    await page.getByLabel('End time').fill('16:00');
    await panel.getByRole('button', { name: 'Preview changes' }).click();
    await expect(panel.getByText(/Preview only — nothing has been saved yet/)).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Proposed schedule' })).toBeVisible();
    await panel.getByRole('button', { name: 'Cancel adaptation' }).click();
    await expect(page.getByText('Unexpected lab session', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Adapt today' }).click();
    const secondPanel = page.getByRole('article', { name: /Adapt today/ });
    await page.getByLabel('What changed today?').fill('Unexpected lab session');
    await page.getByLabel('Start time').fill('15:00');
    await page.getByLabel('End time').fill('16:00');
    await secondPanel.getByRole('button', { name: 'Preview changes' }).click();
    await secondPanel.getByRole('button', { name: 'Apply adaptation' }).click();
    await expect(page.getByRole('status')).toContainText('Applied');
    await expect(page.getByText('Unexpected lab session', { exact: true })).toBeVisible();
  });

});
