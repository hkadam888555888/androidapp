import { describe, expect, it } from 'vitest';
import { calculateReportingStats } from './statisticsService';

const t = (date: string, status: 'completed'|'skipped'|'unreported') => ({ id: `${date}-${status}`, date, title: 'x', kind: 'roadmap' as const, plannedMinutes: 30, priority: 'medium' as const, status });

describe('statistics service', () => {
  it('excludes unreported work from the completion denominator', () => {
    const result = calculateReportingStats([t('2026-10-06','completed'), t('2026-10-06','unreported'), t('2026-10-07','skipped'), t('2026-10-08','completed')], '2026-10-02', '2026-10-08');
    expect(result.completed).toBe(2); expect(result.skipped).toBe(1); expect(result.unreported).toBe(1); expect(result.completionRate).toBe(67);
  });
});
