import { describe, expect, it } from 'vitest';
import { buildDailyPlanDetailed } from './planner';
import type { PlannerInput } from './planner';

const preferences = {
  id: 'p', timezone: 'Asia/Kolkata', wakeTime: '05:00', sleepTime: '22:00',
  defaultStudyWindows: [{ start: '09:00', end: '15:00' }], notificationLeadMinutes: 15,
  maxStudyMinutesPerDay: 180, maxCognitiveMinutesPerDay: 180, maxContinuousFocusMinutes: 90, bufferPercentage: 0,
};

const base = (overrides: Partial<PlannerInput> = {}): PlannerInput => ({
  date: '2026-10-08',
  roadmaps: [], roadmapTasks: [], externalTasks: [], habits: [], busyEvents: [], preferences, remainingTasks: [],
  plannerSettings: { id: 'settings', activeMode: 'normal', busyCapacityMinutes: 60, examCapacityMinutes: 180, examRoadmapIds: [] },
  ...overrides,
});

describe('v0.5 multi-roadmap planner', () => {
  it('uses one global pool while respecting optional roadmap shares', () => {
    const result = buildDailyPlanDetailed(base({
      roadmaps: [
        { id: 'ai', title: 'AI/ML', sourceText: '', createdAt: '', updatedAt: '', active: true, priority: 'high', capacitySharePercentage: 50 },
        { id: 'dsa', title: 'DSA', sourceText: '', createdAt: '', updatedAt: '', active: true, priority: 'medium', capacitySharePercentage: 50 },
      ],
      roadmapTasks: [
        { id: 'ai-task', roadmapId: 'ai', title: 'AI task', estimatedMinutes: 90, priority: 'medium', order: 1, dependencyIds: [], completedOverall: false },
        { id: 'dsa-task', roadmapId: 'dsa', title: 'DSA task', estimatedMinutes: 90, priority: 'medium', order: 1, dependencyIds: [], completedOverall: false },
      ],
    }));
    expect(result.slots.map((slot) => slot.roadmapId)).toEqual(['ai', 'dsa']);
    expect(result.slots.reduce((sum, slot) => sum + slot.plannedMinutes, 0)).toBe(180);
    expect(result.roadmapBudgets).toEqual({ ai: 90, dsa: 90 });
  });

  it('excludes inactive roadmaps from the global pool', () => {
    const result = buildDailyPlanDetailed(base({
      roadmaps: [
        { id: 'active', title: 'Active', sourceText: '', createdAt: '', updatedAt: '', active: true },
        { id: 'off', title: 'Off', sourceText: '', createdAt: '', updatedAt: '', active: false },
      ],
      roadmapTasks: [
        { id: 'a', roadmapId: 'active', title: 'Active task', estimatedMinutes: 60, priority: 'medium', order: 1, dependencyIds: [], completedOverall: false },
        { id: 'b', roadmapId: 'off', title: 'Inactive task', estimatedMinutes: 60, priority: 'urgent', order: 2, dependencyIds: [], completedOverall: false },
      ],
    }));
    expect(result.slots.every((slot) => slot.sourceTaskId !== 'b')).toBe(true);
    expect(result.decisions.some((decision) => decision.candidateId === 'roadmap:b' && decision.rejectedReason === 'roadmap is inactive')).toBe(true);
  });

  it('busy mode explicitly reduces planning capacity', () => {
    const result = buildDailyPlanDetailed(base({
      plannerSettings: { id: 'settings', activeMode: 'busy', busyCapacityMinutes: 60, examCapacityMinutes: 180, examRoadmapIds: [] },
      roadmapTasks: [{ id: 'a', roadmapId: 'r', title: 'Task', estimatedMinutes: 120, priority: 'high', order: 1, dependencyIds: [], completedOverall: false }],
      roadmaps: [{ id: 'r', title: 'Roadmap', sourceText: '', createdAt: '', updatedAt: '', active: true }],
    }));
    expect(result.mode).toBe('busy');
    expect(result.capacity.effectiveStudyMinutes).toBe(60);
    expect(result.slots).toHaveLength(0); // non-splittable task protects its full-duration contract.
  });

  it('urgent external work can borrow the global pool ahead of lower-priority roadmap work', () => {
    const result = buildDailyPlanDetailed(base({
      roadmapTasks: [{ id: 'r1', roadmapId: 'r', title: 'Study', estimatedMinutes: 90, priority: 'medium', order: 1, dependencyIds: [], completedOverall: false }],
      roadmaps: [{ id: 'r', title: 'Study roadmap', sourceText: '', createdAt: '', updatedAt: '', active: true, capacitySharePercentage: 100 }],
      externalTasks: [{ id: 'x1', title: 'Submit form', category: 'URGENT', estimatedMinutes: 30, priority: 'urgent', dueDate: '2026-10-08', status: 'planned', active: true, createdAt: '', updatedAt: '' }],
    }));
    expect(result.slots[0].sourceExternalTaskId).toBe('x1');
    expect(result.slots[0].reason).toContain('protect deadline');
  });

  it('exam mode boosts configured exam roadmaps', () => {
    const result = buildDailyPlanDetailed(base({
      plannerSettings: { id: 'settings', activeMode: 'exam', busyCapacityMinutes: 60, examCapacityMinutes: 60, examRoadmapIds: ['exam'] },
      roadmapTasks: [
        { id: 'normal', roadmapId: 'normal', title: 'Normal', estimatedMinutes: 30, priority: 'medium', order: 1, dependencyIds: [], completedOverall: false },
        { id: 'exam', roadmapId: 'exam', title: 'Exam', estimatedMinutes: 30, priority: 'medium', order: 1, dependencyIds: [], completedOverall: false },
      ],
      roadmaps: [
        { id: 'normal', title: 'Normal', sourceText: '', createdAt: '', updatedAt: '', active: true, priority: 'medium', capacitySharePercentage: 50 },
        { id: 'exam', title: 'Exam subject', sourceText: '', createdAt: '', updatedAt: '', active: true, priority: 'medium', capacitySharePercentage: 50 },
      ],
    }));
    expect(result.mode).toBe('exam');
    expect(result.slots[0].roadmapId).toBe('exam');
    expect(result.decisions.find((d) => d.candidateId === 'roadmap:exam')?.reasonCodes).toContain('EXAM_FOCUS');
  });
});
