import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from './planner';
import type { PlannerInput } from './planner';

const baseInput = (overrides: Partial<PlannerInput> = {}): PlannerInput => ({
  date: '2026-10-08',
  roadmapTasks: [
    { id: 'a', roadmapId: 'r', title: 'Prerequisite', estimatedMinutes: 60, priority: 'high', order: 0, dependencyIds: [], completedOverall: false },
    { id: 'b', roadmapId: 'r', title: 'Dependent', estimatedMinutes: 60, priority: 'urgent', order: 1, dependencyIds: ['a'], completedOverall: false },
  ],
  habits: [],
  busyEvents: [{ id: 'busy', date: '2026-10-08', title: 'Appointment', window: { start: '15:00', end: '16:00' }, priority: 'urgent', blocksPlanning: true }],
  preferences: {
    id: 'p', timezone: 'Asia/Kolkata', wakeTime: '05:00', sleepTime: '22:00',
    defaultStudyWindows: [{ start: '14:00', end: '18:00' }], notificationLeadMinutes: 15,
    maxStudyMinutesPerDay: 120, maxCognitiveMinutesPerDay: 120, maxDeepWorkSessions: 4,
    maxContinuousFocusMinutes: 90, minimumBreakMinutes: 10, bufferPercentage: 0,
  },
  remainingTasks: [],
  ...overrides,
});

describe('deterministic planner', () => {
  it('does not schedule an unsatisfied dependent task', () => {
    const plan = buildDailyPlan(baseInput());
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ taskId: 'roadmap:a', start: '14:00', end: '15:00' });
  });

  it('respects the buffer-adjusted capacity', () => {
    const plan = buildDailyPlan(baseInput({
      roadmapTasks: [
        { id: 'a', roadmapId: 'r', title: 'A', estimatedMinutes: 90, priority: 'high', order: 0, dependencyIds: [], completedOverall: false },
        { id: 'b', roadmapId: 'r', title: 'B', estimatedMinutes: 90, priority: 'medium', order: 1, dependencyIds: [], completedOverall: false },
      ],
      preferences: {
        ...baseInput().preferences,
        maxStudyMinutesPerDay: 120,
        maxCognitiveMinutesPerDay: 120,
        bufferPercentage: 25,
      },
    }));
    const total = plan.reduce((sum, slot) => sum + (Number(slot.end.slice(0, 2)) * 60 + Number(slot.end.slice(3)) - Number(slot.start.slice(0, 2)) * 60 - Number(slot.start.slice(3))), 0);
    expect(total).toBeLessThanOrEqual(90);
  });
  it('does not silently split a non-splittable task across focus windows', () => {
    const plan = buildDailyPlan(baseInput({
      roadmapTasks: [{ id: 'a', roadmapId: 'r', title: 'Long task', estimatedMinutes: 100, priority: 'high', order: 0, dependencyIds: [], completedOverall: false, splittable: false }],
      preferences: { ...baseInput().preferences, maxStudyMinutesPerDay: 120, maxCognitiveMinutesPerDay: 120, maxContinuousFocusMinutes: 90 },
    }));
    expect(plan).toHaveLength(0);
  });

  it('allows splitting only when the task explicitly permits it', () => {
    const plan = buildDailyPlan(baseInput({
      roadmapTasks: [{ id: 'a', roadmapId: 'r', title: 'Splittable project', estimatedMinutes: 100, priority: 'high', order: 0, dependencyIds: [], completedOverall: false, splittable: true }],
      preferences: { ...baseInput().preferences, defaultStudyWindows: [{ start: '14:00', end: '15:00' }, { start: '16:00', end: '17:00' }], maxStudyMinutesPerDay: 120, maxCognitiveMinutesPerDay: 120, maxContinuousFocusMinutes: 60, bufferPercentage: 0 },
    }));
    expect(plan.map((slot) => slot.plannedMinutes)).toEqual([60, 40]);
  });

});
