import { describe, expect, it } from 'vitest';
import { assertTaskCanBeReported, markCompleted, markSkipped, requiresReview } from './taskState';
import type { DailyTask } from '../entities/models';

const task: DailyTask = {
  id: 't1', date: '2026-10-08', title: 'Study', kind: 'roadmap', plannedMinutes: 60,
  priority: 'high', status: 'planned',
};

describe('task state policy', () => {
  it('keeps planned tasks unresolved until an explicit result exists', () => {
    expect(requiresReview({ ...task, status: 'unreported' })).toBe(true);
  });

  it('records completion explicitly', () => {
    const result = markCompleted(task, '2026-10-08T20:00:00.000Z');
    expect(result.status).toBe('completed');
    expect(result.resultReportedAt).toBeTruthy();
  });

  it('records skips explicitly', () => {
    const result = markSkipped(task, '2026-10-08T20:00:00.000Z', 'Busy day');
    expect(result.status).toBe('skipped');
    expect(result.skipReason).toBe('Busy day');
  });

  it('allows a first report from planned and unreported states', () => {
    expect(() => assertTaskCanBeReported(task)).not.toThrow();
    expect(() => assertTaskCanBeReported({ ...task, status: 'unreported' })).not.toThrow();
  });

  it.each(['completed', 'partial', 'skipped', 'cancelled', 'rescheduled'] as const)(
    'rejects a second report or report against terminal state: %s',
    (status) => {
      expect(() => assertTaskCanBeReported({ ...task, status })).toThrow(/already has a result|no longer active/u);
    },
  );
});
