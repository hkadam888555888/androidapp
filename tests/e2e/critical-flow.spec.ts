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
    await page.locator('details.planner-details').first().locator('summary').click();
    await expect(page.getByText('Unexpected lab session', { exact: true })).toBeVisible();
  });


  test('mobile Menu opens every feature and local search uses the styled dialog', async ({ page }, testInfo) => {
    await finishFirstRunSetup(page);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/planner');

    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Schedule preview' })).toBeVisible();
    await expect(page.locator('.planner-summary-grid')).toBeVisible();
    await expect(page.locator('.planner-summary-card')).toHaveCount(3);
    await expect(page.getByText('One global capacity pool across active roadmaps', { exact: false })).toHaveCount(0);
    await expect(page.locator('details.planner-details').first()).not.toHaveAttribute('open', '');

    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.getByRole('dialog', { name: 'All features' });
    await expect(menu).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('mobile-all-features-menu.png'), fullPage: false });
    for (const feature of ['Today', 'Plan', 'Learn', 'Habits', 'Progress', 'Review', 'Calendar', 'Alerts', 'Diagnostics', 'Settings', 'Privacy']) {
      await expect(menu.getByRole('link', { name: feature, exact: true })).toBeVisible();
    }
    await menu.getByRole('link', { name: 'Diagnostics', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'System health', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Menu' }).click();
    const reopenedMenu = page.getByRole('dialog', { name: 'All features' });
    await reopenedMenu.getByRole('button', { name: 'Search tasks and pages' }).click();
    const searchDialog = page.getByRole('dialog', { name: 'Search and quick actions' });
    await expect(searchDialog).toBeVisible();
    await expect(searchDialog.locator('.command-result').first()).toHaveCSS('display', 'grid');
    const search = page.getByRole('textbox', { name: 'Search tasks, roadmaps, habits and pages' });
    await search.fill('Calendar');
    await searchDialog.getByRole('button', { name: /Calendar/ }).click();
    await expect(page.getByRole('heading', { name: 'Calendar', exact: true })).toBeVisible();
  });


  test('all primary and secondary routes render their intended page', async ({ page }) => {
    await finishFirstRunSetup(page);
    const routes = [
      ['/today', 'Today'],
      ['/planner', 'Planner'],
      ['/roadmap', 'Roadmap'],
      ['/habits', 'Habits'],
      ['/statistics', 'Statistics'],
      ['/review', 'Daily Review'],
      ['/calendar', 'Calendar'],
      ['/notifications', 'Notifications'],
      ['/diagnostics', 'System health'],
      ['/settings', 'Settings'],
      ['/privacy', 'Privacy & data handling'],
    ] as const;
    for (const [pathName, heading] of routes) {
      await page.goto(pathName);
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    }
  });

  test('key pages stay within the viewport across the supported responsive width sweep', async ({ page }, testInfo) => {
    await finishFirstRunSetup(page);
    const routes = ['/today', '/planner', '/roadmap', '/habits', '/statistics'];
    const widths = [320, 360, 393, 768, 1024, 1440];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('main#main-content h1')).toBeVisible();
        if (route === '/planner') {
          await page.screenshot({ path: testInfo.outputPath(`planner-${width}px.png`), fullPage: true });
        }
        if (route === '/statistics' && width === 1024) {
          await page.screenshot({ path: testInfo.outputPath('statistics-1024px-full-page.png'), fullPage: true });
        }
        const dimensions = await page.evaluate(() => {
          const viewport = window.innerWidth;
          const documentWidth = document.documentElement.scrollWidth;
          const bodyWidth = document.body.scrollWidth;
          const offenders = documentWidth > viewport || bodyWidth > viewport
            ? [...document.querySelectorAll('body *')].map((element) => {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                return {
                  tag: element.tagName.toLowerCase(),
                  className: typeof element.className === 'string' ? element.className.slice(0, 90) : '',
                  id: (element as HTMLElement).id,
                  left: Math.round(rect.left),
                  right: Math.round(rect.right),
                  width: Math.round(rect.width),
                  minWidth: style.minWidth,
                  display: style.display,
                  text: (element.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 100),
                  ancestors: [element.parentElement, element.parentElement?.parentElement, element.parentElement?.parentElement?.parentElement].filter(Boolean).map((parent) => ({
                    tag: parent!.tagName.toLowerCase(),
                    className: typeof parent!.className === 'string' ? parent!.className.slice(0, 90) : '',
                    text: (parent!.textContent ?? '').trim().replace(/\\s+/g, ' ').slice(0, 80),
                    right: Math.round(parent!.getBoundingClientRect().right),
                  })),
                };
              }).filter((element) => element.right > viewport + 1 && element.width > 0)
                .sort((a, b) => b.right - a.right).slice(0, 8)
            : [];
          return { viewport, document: documentWidth, body: bodyWidth, offenders };
        });
        expect(
          dimensions.document <= dimensions.viewport && dimensions.body <= dimensions.viewport,
          `Horizontal overflow on ${route} at ${width}px: document=${dimensions.document}, body=${dimensions.body}, viewport=${dimensions.viewport}; offenders=${JSON.stringify(dimensions.offenders)}`,
        ).toBeTruthy();
      }
    }
  });

  test('exercise and water logs persist and update their visible totals', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/habits');
    await page.getByRole('button', { name: 'Log exercise' }).click();
    await expect(page.getByText('Logged 30 minutes of exercise.')).toBeVisible();
    await page.getByRole('button', { name: 'Log custom' }).click();
    await expect(page.getByText('Logged +250 ml.')).toBeVisible();

    await page.reload();
    const cards = page.locator('.stats-grid .stat-card');
    await expect(cards.nth(0)).toContainText('30 min');
    await expect(cards.nth(1)).toContainText('250 ml');
  });

  test('calendar month controls and selected-day semantics stay functional', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/calendar');
    const monthHeading = page.locator('.calendar-toolbar h2');
    const initialMonth = await monthHeading.innerText();
    await page.getByRole('button', { name: '›' }).click();
    await expect(monthHeading).not.toHaveText(initialMonth);

    const day = page.getByRole('button', { name: /^Select \d{4}-\d{2}-\d{2}/ }).first();
    await day.click();
    await expect(page.locator('.calendar-day.selected')).toHaveCount(1);
    await expect(page.locator('.calendar-day.selected')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Selected day', { exact: true })).toBeVisible();
  });

  test('explicit Skip persists as a distinct outcome and never becomes completion', async ({ page }) => {
    await finishFirstRunSetup(page);
    await addFixedExternalTask(page, 'Arena skip flow task');
    await page.goto('/today');
    const task = page.locator('.timeline-card').filter({ hasText: 'Arena skip flow task' });
    await expect(task.getByRole('button', { name: 'Skip' })).toBeVisible();
    await task.getByRole('button', { name: 'Skip' }).click();
    await expect(task.getByText('Skipped', { exact: true })).toBeVisible();

    await page.reload();
    const persistedTask = page.locator('.timeline-card').filter({ hasText: 'Arena skip flow task' });
    await expect(persistedTask).toBeVisible();
    await expect(persistedTask).toContainText('Skipped');
    await expect(persistedTask.getByRole('button', { name: 'Complete' })).toHaveCount(0);
  });

  test('delete-all requires exact confirmation and theme preference survives reload', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('/settings');
    const deleteField = page.getByRole('textbox', { name: 'Type DELETE to confirm' });
    const deleteButton = page.getByRole('button', { name: 'Delete all local data' });
    await expect(deleteButton).toBeDisabled();
    await deleteField.fill('delete');
    await expect(deleteButton).toBeDisabled();
    await deleteField.fill('DELETE');
    await expect(deleteButton).toBeEnabled();
    // Do not perform the destructive action; this test verifies the guard only.

    const currentTheme = await page.locator('html').getAttribute('data-theme');
    await page.getByRole('button', { name: 'Menu' }).click();
    const desiredTheme = currentTheme === 'dark' ? 'light' : 'dark';
    await page.getByRole('button', { name: `Use ${desiredTheme} theme` }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', desiredTheme);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', desiredTheme);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('mar-theme'))).toBe(desiredTheme);
  });


  test('malformed backup import is rejected without changing existing roadmap data', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/roadmap');
    await page.getByLabel('Roadmap name').fill('Arena backup preservation');
    await page.getByRole('textbox', { name: 'Roadmap source text' }).fill('# Arena backup preservation\\n## Foundations\\n### Variables\\n### Functions');
    await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
    await expect(page.getByText('Generated tasks')).toBeVisible();
    await page.getByRole('button', { name: /Approve & use/ }).click();
    await expect(page.getByText(/Saved .* tasks\./)).toBeVisible();
    await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena backup preservation' })).toBeVisible();

    await page.goto('/settings');
    await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
      name: 'malformed-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ invalid json'),
    });
    await expect(page.locator('.notice-bar')).toContainText('Backup is not valid JSON.');

    await page.goto('/roadmap');
    await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena backup preservation' })).toBeVisible();
  });

  test('hostile roadmap text stays inert when displayed in the parsed roadmap tree', async ({ page }) => {
    await finishFirstRunSetup(page);
    await page.goto('/roadmap');
    const editor = page.getByRole('textbox', { name: 'Roadmap source text' });
    await editor.fill('# Safe roadmap\n## Foundations\n### <img src=x onerror=window.__arenaXss=true>');
    await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();

    await expect(page.locator('.roadmap-tree')).toBeVisible();
    await expect(page.locator('.roadmap-tree img')).toHaveCount(0);
    await expect(page.locator('.roadmap-tree')).toContainText('img src=x onerror=window.__arenaXss=true');
    expect(await page.evaluate(() => (window as Window & { __arenaXss?: boolean }).__arenaXss)).not.toBe(true);
  });


  test('JSON backup exports and restores records in a clean isolated browser profile', async ({ page, browser }) => {
    await finishFirstRunSetup(page);
    await page.goto('/roadmap');
    await page.getByRole('button', { name: 'Load example' }).click();
    await page.getByLabel('Roadmap name').fill('Arena round-trip roadmap');
    await page.getByRole('button', { name: 'Analyze roadmap' }).last().click();
    await expect(page.getByText('Generated tasks')).toBeVisible();
    await page.getByRole('button', { name: /Approve & use/ }).click();
    await expect(page.locator('.portfolio-main').filter({ hasText: 'Arena round-trip roadmap' })).toBeVisible();

    await page.goto('/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export JSON backup' }).click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    const baseURL = new URL(page.url()).origin;
    const cleanContext = await browser.newContext({ baseURL });
    try {
      const cleanPage = await cleanContext.newPage();
      await finishFirstRunSetup(cleanPage);
      await cleanPage.goto('/settings');
      await cleanPage.locator('input[type="file"][accept="application/json"]').setInputFiles(downloadPath!);
      await expect(cleanPage.locator('.notice-bar')).toContainText('Backup restored successfully.');
      await cleanPage.goto('/roadmap');
      await expect(cleanPage.locator('.portfolio-main').filter({ hasText: 'Arena round-trip roadmap' })).toBeVisible();
    } finally {
      await cleanContext.close();
    }
  });


  test('simultaneous conflicting reports across tabs preserve one immutable task outcome', async ({ page }) => {
    await finishFirstRunSetup(page);
    await addFixedExternalTask(page, 'Arena two-tab race task');
    await page.goto('/today');
    const secondPage = await page.context().newPage();
    await secondPage.goto('/today');

    const firstTask = page.locator('.timeline-card').filter({ hasText: 'Arena two-tab race task' });
    const secondTask = secondPage.locator('.timeline-card').filter({ hasText: 'Arena two-tab race task' });
    await expect(firstTask.getByRole('button', { name: 'Complete' })).toBeVisible();
    await expect(secondTask.getByRole('button', { name: 'Skip' })).toBeVisible();

    await Promise.all([
      firstTask.getByRole('button', { name: 'Complete' }).click(),
      secondTask.getByRole('button', { name: 'Skip' }).click(),
    ]);
    await Promise.all([page.reload(), secondPage.reload()]);

    const persistedFirst = page.locator('.timeline-card').filter({ hasText: 'Arena two-tab race task' });
    const persistedSecond = secondPage.locator('.timeline-card').filter({ hasText: 'Arena two-tab race task' });
    const firstStatus = persistedFirst.locator('.status-badge');
    const secondStatus = persistedSecond.locator('.status-badge');
    await expect(firstStatus).toBeVisible();
    await expect(secondStatus).toBeVisible();
    const outcome = (await firstStatus.innerText()).trim();
    expect(['Completed', 'Skipped']).toContain(outcome);
    await expect(secondStatus).toHaveText(outcome);
    await expect(persistedFirst.getByRole('button', { name: 'Complete' })).toHaveCount(0);
    await expect(persistedFirst.getByRole('button', { name: 'Skip' })).toHaveCount(0);
    await secondPage.close();
  });

});
