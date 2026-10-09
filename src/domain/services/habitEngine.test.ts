import { describe, expect, it } from 'vitest';
import { buildHabitOccurrence, calculateHabitStreak, canReportHabitPartial, evaluateHabitOutcome, isHabitDue } from './habitEngine';
import type { Habit } from '../entities/models';

const exercise: Habit = { id:'h', name:'Exercise', kind:'exercise', targetValue:60, minimumValue:30, unit:'minutes', active:true, preferredWindows:[{start:'05:00',end:'07:00'}], reminderTimes:['05:15'], frequencyDays:[1,2,3,4,5,6,0], recurrence:'daily', streakPolicy:'target_or_partial', allowPartial:true, carryOverAllowed:false, priority:'high' };

describe('habit outcome edge cases', () => {
  it('keeps the partial-report permission aligned with the configured policy', () => {
    expect(canReportHabitPartial({ allowPartial: false, streakPolicy: 'minimum_value' })).toBe(true);
    expect(canReportHabitPartial({ allowPartial: false, streakPolicy: 'target_or_partial' })).toBe(false);
    expect(canReportHabitPartial({ allowPartial: true, streakPolicy: 'strict' })).toBe(true);
  });

  it('does not count zero activity as partial when the minimum is zero', () => {
    const habit: Habit = { ...exercise, minimumValue: 0, targetValue: 30 };
    expect(evaluateHabitOutcome(habit, 0)).toBe('skipped');
    expect(evaluateHabitOutcome(habit, 1)).toBe('partial');
  });
});

describe('v0.6 habit engine', () => {
  it('respects recurrence and active bounds', () => {
    expect(isHabitDue(exercise, '2026-10-08')).toBe(true);
    expect(isHabitDue({...exercise, frequencyDays:[1], recurrence:'custom'}, '2026-10-08')).toBe(false);
  });
  it('does not treat an explicitly empty weekly/custom schedule as daily', () => {
    expect(isHabitDue({ ...exercise, recurrence: 'weekly', frequencyDays: [] }, '2026-10-08')).toBe(false);
    expect(isHabitDue({ ...exercise, recurrence: 'custom', frequencyDays: [] }, '2026-10-08')).toBe(false);
    expect(isHabitDue({ ...exercise, recurrence: 'daily', frequencyDays: [] }, '2026-10-08')).toBe(true);
  });

  it('classifies full, partial and insufficient values', () => {
    expect(evaluateHabitOutcome(exercise, 60)).toBe('completed');
    expect(evaluateHabitOutcome(exercise, 40)).toBe('partial');
    expect(evaluateHabitOutcome(exercise, 10)).toBe('skipped');
    expect(evaluateHabitOutcome({...exercise, allowPartial:false, streakPolicy:'minimum_value'}, 30)).toBe('partial');
  });
  it('keeps missing result unreported', () => {
    expect(buildHabitOccurrence(exercise, '2026-10-08', [], [], []).status).toBe('unreported');
    expect(buildHabitOccurrence({...exercise, kind:'water', targetValue:2500, unit:'ml', allowPartial:false, streakPolicy:'strict'}, '2026-10-08', [], [{id:'w', date:'2026-10-08', amountMl:1000, recordedAt:'2026-10-08T08:00:00Z'}], []).status).toBe('partial');
  });
  it('streaks across weekly scheduled days rather than requiring daily scheduling', () => {
    const weekly = { ...exercise, frequencyDays:[1,3,5], recurrence:'weekly' as const, streakPolicy:'strict' as const, allowPartial:false };
    const dates=['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09'];
    const logs = ['2026-10-05','2026-10-07','2026-10-09'].map((date, i) => ({ id:`w${i}`, habitId:'h', date, status:'completed' as const, value:60, targetValue:60, minimumValue:30, recordedAt:`${date}T08:00:00Z` }));
    expect(calculateHabitStreak(weekly, dates, logs, [], [], '2026-10-09').current).toBe(3);
  });
  it('counts partial days under target_or_partial streak policy', () => {
    const logs = ['2026-10-06','2026-10-07','2026-10-08'].map((date, i) => ({ id:`l${i}`, habitId:'h', date, status:'partial' as const, value:30, targetValue:60, minimumValue:30, recordedAt:`${date}T08:00:00Z` }));
    const dates=['2026-10-06','2026-10-07','2026-10-08'];
    expect(calculateHabitStreak(exercise, dates, logs, [], [], '2026-10-08').current).toBe(3);
  });
});
