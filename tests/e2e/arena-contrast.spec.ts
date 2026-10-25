import { test, expect } from '@playwright/test';

type RGB = [number, number, number];

function rgb(value: string): RGB {
  const color = value.trim();
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) {
    const full = hex[1].length === 3 ? [...hex[1]].map((part) => part + part).join('') : hex[1];
    return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16)) as RGB;
  }
  const tuple = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (tuple) return [Number(tuple[1]), Number(tuple[2]), Number(tuple[3])];
  throw new Error('Unexpected color token value: ' + color);
}

function luminance(value: string): number {
  const channels = rgb(value).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test('Arena cycle 050: semantic light/dark design tokens maintain text and focus contrast', async ({ page }) => {
  await page.goto('/');
  await page.locator('body').waitFor();

  for (const theme of ['light', 'dark'] as const) {
    await page.locator('html').evaluate((element, nextTheme) => {
      element.setAttribute('data-theme', nextTheme);
    }, theme);
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        background: style.getPropertyValue('--bg').trim(),
        text: style.getPropertyValue('--text').trim(),
        muted: style.getPropertyValue('--muted').trim(),
        accent: style.getPropertyValue('--accent').trim(),
        onPrimary: style.getPropertyValue('--on-primary').trim(),
        focusRing: style.getPropertyValue('--focus-ring').trim(),
      };
    });

    expect(contrast(tokens.text, tokens.background), theme + ' primary text').toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.muted, tokens.background), theme + ' muted text').toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.onPrimary, tokens.accent), theme + ' primary button text').toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens.focusRing, tokens.background), theme + ' focus ring').toBeGreaterThanOrEqual(3);
  }
});
