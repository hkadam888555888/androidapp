import { describe, expect, it } from 'vitest';
import { isValidISODate, localISODate, previousISO } from './date';

describe('local date helpers', () => {
  it('formats the visible local calendar date instead of converting through UTC', () => {
    const localDate = new Date(2026, 9, 9, 0, 15, 0);
    expect(localISODate(localDate)).toBe('2026-10-09');
  });

  it('computes previous dates across month and year boundaries', () => {
    expect(previousISO('2026-03-01')).toBe('2026-02-28');
    expect(previousISO('2026-01-01')).toBe('2025-12-31');
  });
  it('rejects impossible calendar dates without timezone coercion', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-2-03')).toBe(false);
  });
});
