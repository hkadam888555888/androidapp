import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from './planner';

const preferences = { id:'preferences', timezone:'Asia/Kolkata', wakeTime:'05:00', sleepTime:'22:00', defaultStudyWindows:[{start:'05:00', end:'12:00'}], notificationLeadMinutes:15, bufferPercentage:0 };

describe('planner integrity', () => {
  it('refuses invalid dependency graphs', () => {
    expect(() => buildDailyPlan({ date:'2026-10-08', roadmapTasks:[{id:'a', roadmapId:'r', title:'A', estimatedMinutes:30, priority:'medium', order:1, dependencyIds:['b'], completedOverall:false},{id:'b', roadmapId:'r', title:'B', estimatedMinutes:30, priority:'medium', order:2, dependencyIds:['a'], completedOverall:false}], habits:[], busyEvents:[], preferences, remainingTasks:[] })).toThrow(/dependency integrity/);
  });

  it('prefers a habit window when one overlaps availability', () => {
    const slots = buildDailyPlan({ date:'2026-10-08', roadmapTasks:[], habits:[{id:'h', name:'Exercise', kind:'exercise', targetValue:30, unit:'minutes', active:true, preferredWindows:[{start:'06:00', end:'08:00'}], reminderTimes:[], frequencyDays:[4]}], busyEvents:[], preferences:{...preferences, defaultStudyWindows:[{start:'06:00', end:'10:00'}]}, remainingTasks:[] });
    expect(slots[0]?.sourceHabitId).toBe('h');
    expect(slots[0]?.start).toBe('06:00');
  });
});
