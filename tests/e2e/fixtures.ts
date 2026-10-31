import { test as base, expect } from '@playwright/test';

// Keep schedule tests deterministic: the default afternoon study window is
// still ahead when each browser scenario begins.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date('2026-10-30T08:00:00.000Z'));
    await use(page);
  },
});

export { expect };
