import { describe, expect, it } from 'vitest';
import type { DailyTask } from '../domain/entities/models';
import { reconcilePlanTasks } from './planInstances';

function task(id: string, status: DailyTask['status'] = 'planned'): DailyTask {
  return {
    id, date: '2026-10-09', title: 'Review vectors', kind: 'roadmap', plannedMinutes: 30,
    plannedWindow: { start: '09:00', end: '09:30' }, priority: 'medium', status,
    sourceTaskId: 'vectors',
  };
}

describe('plan instance reconciliation', () => {
  it('preserves explicit completion when the same daily plan is regenerated', () => {
    const result = reconcilePlanTasks([task('daily:2026-10-09:roadmap:vectors:1')], [task('daily:2026-10-09:roadmap:vectors:1', 'completed')], 2);
    expect(result.tasks[0].id).toBe('daily:2026-10-09:roadmap:vectors:1:v2');
    expect(result.tasks[0].status).toBe('planned');
    expect(result.cancelled).toHaveLength(0);
  });

  it('reuses a still-planned versioned instance on another regeneration', () => {
    const base = 'daily:2026-10-09:roadmap:vectors:1';
    const result = reconcilePlanTasks([task(base)], [task(base, 'completed'), task(`${base}:v2`, 'planned')], 3);
    expect(result.tasks[0].id).toBe(`${base}:v2`);
  });

  it('cancels a stale planned block but does not mutate previously reported history', () => {
    const stale = task('daily:2026-10-09:roadmap:old:1');
    const done = task('daily:2026-10-09:roadmap:done:1', 'completed');
    const result = reconcilePlanTasks([task('daily:2026-10-09:roadmap:new:1')], [stale, done], 2);
    expect(result.cancelled).toEqual([{ ...stale, status: 'cancelled', resultNote: 'Removed from a regenerated plan. No completion was inferred.' }]);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toContain('roadmap:new');
  });

  it('updates an existing pending instance without changing its identity', () => {
    const base = 'daily:2026-10-09:roadmap:vectors:1';
    const current = { ...task(base), plannedWindow: { start: '10:00', end: '10:30' } };
    const proposed = { ...task(base), plannedWindow: { start: '11:00', end: '11:30' } };
    const result = reconcilePlanTasks([proposed], [current], 2);
    expect(result.tasks[0].id).toBe(base);
    expect(result.tasks[0].plannedWindow?.start).toBe('11:00');
    expect(result.cancelled).toHaveLength(0);
  });
});
