import { describe, expect, it } from 'vitest';
import type { PlannerInput } from './planner';
import { buildDailyPlanDetailed } from './planner';

const preferences = {
  id: 'preferences', timezone: 'Asia/Kolkata', wakeTime: '05:00', sleepTime: '22:00',
  defaultStudyWindows: [{ start: '08:00', end: '10:00' }], notificationLeadMinutes: 15,
  maxStudyMinutesPerDay: 120, maxCognitiveMinutesPerDay: 120,
};

const task = { id: 't1', roadmapId: 'r1', title: 'Adapted task', estimatedMinutes: 60, priority: 'high' as const, order: 1, dependencyIds: [], completedOverall: false, active: true, taskType: 'practice' as const, category: 'ML', splittable: true };
const roadmaps = [{ id: 'r1', title: 'AI/ML', sourceText: 'x', createdAt: '2026-10-01', updatedAt: '2026-10-01', active: true, priority: 'high' as const, capacitySharePercentage: 100 }];
const base = (): PlannerInput => ({ date: '2026-10-08', roadmaps, roadmapTasks: [task], externalTasks: [], habits: [], habitLogs: [], waterLogs: [], exerciseLogs: [], busyEvents: [], preferences, plannerSettings: { id: 'planner-settings', activeMode: 'normal', busyCapacityMinutes: 60, examCapacityMinutes: 90, examRoadmapIds: [] }, estimationProfiles: [], timePatternProfiles: [], plannerOverrides: [], remainingTasks: [] });

describe('v0.7 planner adaptation', () => {
  it('honours skip-today overrides without changing task history', () => {
    const result = buildDailyPlanDetailed({ ...base(), plannerOverrides: [{ id: 'o1', taskId: 't1', date: '2026-10-08', action: 'skip_today', payload: {}, createdAt: '2026-10-08T01:00:00Z' }] });
    expect(result.slots.some((slot) => slot.sourceTaskId === 't1')).toBe(false);
  });
  it('honours a future move override on the target date', () => {
    const override = { id: 'o2', taskId: 't1', date: '2026-10-08', action: 'move' as const, payload: { targetDate: '2026-10-10' }, createdAt: '2026-10-08T01:00:00Z' };
    expect(buildDailyPlanDetailed({ ...base(), plannerOverrides: [override] }).slots.some((slot) => slot.sourceTaskId === 't1')).toBe(false);
    expect(buildDailyPlanDetailed({ ...base(), date: '2026-10-10', plannerOverrides: [override] }).slots.some((slot) => slot.sourceTaskId === 't1')).toBe(true);
  });
  it('uses a learned estimate while respecting capacity and splitting policy', () => {
    const profile = { id: 'p', scopeKey: 'r1:practice:ML', originalEstimateMinutes: 60, sampleCount: 10, medianActualMinutes: 90, varianceMinutesSquared: 25, learnedEstimateMinutes: 82, confidence: 'high' as const, updatedAt: '2026-10-08' };
    const result = buildDailyPlanDetailed({ ...base(), estimationProfiles: [profile] });
    const total = result.slots.filter((slot) => slot.sourceTaskId === 't1').reduce((sum, slot) => sum + slot.plannedMinutes, 0);
    expect(total).toBe(82);
  });
});
