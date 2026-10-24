import { describe, expect, it } from 'vitest';
import { isValidISODate, previousISO, isoToLabel } from './date';

describe('Arena date boundaries', () => {
  it('validates calendar dates without accepting overflow or non-padded fields', () => {
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2026-01-01')).toBe(true);
    expect(isValidISODate('2023-02-29')).toBe(false);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-2-01')).toBe(false);
    expect(isValidISODate('2026-01-1')).toBe(false);
    expect(isValidISODate('2026-01-01T00:00:00Z')).toBe(false);
  });

  it('moves to the previous local calendar day across leap day, month and year boundaries', () => {
    expect(previousISO('2024-03-01')).toBe('2024-02-29');
    expect(previousISO('2026-03-01')).toBe('2026-02-28');
    expect(previousISO('2026-01-01')).toBe('2025-12-31');
  });

  it('labels an ISO date using local calendar components rather than UTC rollover', () => {
    const label = isoToLabel('2026-01-01');
    expect(label).toContain('2026');
    expect(label).toContain('1');
  });
});
