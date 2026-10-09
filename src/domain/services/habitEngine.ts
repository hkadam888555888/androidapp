import type { ExerciseLog, Habit, HabitLog, HabitOccurrence, ISODate, WaterLog } from '../entities/models';

export interface HabitStreak { current: number; longest: number; qualifyingDays: number; }

export function isHabitDue(habit: Habit, date: ISODate): boolean {
  if (!habit.active) return false;
  if (habit.activeFrom && date < habit.activeFrom.slice(0, 10)) return false;
  if (habit.activeUntil && date > habit.activeUntil.slice(0, 10)) return false;
  // An explicitly empty weekly/custom schedule means no due days. Only a missing
  // legacy frequencyDays field gets the all-days fallback.
  const days = habit.recurrence === 'daily'
    ? [0, 1, 2, 3, 4, 5, 6]
    : Array.isArray(habit.frequencyDays) ? habit.frequencyDays : [0, 1, 2, 3, 4, 5, 6];
  return days.includes(new Date(`${date}T00:00:00`).getDay());
}

export function canReportHabitPartial(habit: Pick<Habit, 'allowPartial' | 'streakPolicy'>): boolean {
  // The minimum-value policy explicitly permits a partial result even when the
  // separate allowPartial toggle is false; the toggle still controls other policies.
  return Boolean(habit.allowPartial || habit.streakPolicy === 'minimum_value');
}

export function getHabitMinimum(habit: Habit): number {
  return Math.max(0, Math.min(habit.targetValue, habit.minimumValue ?? (habit.kind === 'exercise' ? Math.max(1, Math.round(habit.targetValue * 0.5)) : habit.targetValue)));
}

export function evaluateHabitOutcome(habit: Habit, value: number): 'completed' | 'partial' | 'skipped' {
  const safe = Math.max(0, value);
  const minimum = getHabitMinimum(habit);
  if (safe >= habit.targetValue) return 'completed';
  if (safe > 0 && (habit.allowPartial || habit.streakPolicy === 'minimum_value') && safe >= minimum) return 'partial';
  return 'skipped';
}

export function buildHabitOccurrence(habit: Habit, date: ISODate, logs: HabitLog[], waterLogs: WaterLog[], exerciseLogs: ExerciseLog[]): HabitOccurrence {
  if (!isHabitDue(habit, date)) return { id: `occurrence:${habit.id}:${date}`, habitId: habit.id, date, status: 'not_due', targetValue: habit.targetValue, minimumValue: getHabitMinimum(habit), scheduledMinutes: 0, preferredWindows: habit.preferredWindows, streakContribution: 0, carryOverEligible: false, reason: 'Habit is not scheduled for this weekday.' };
  const explicit = logs.filter((log) => log.habitId === habit.id && log.date === date);
  let value = habit.kind === 'custom' ? explicit.reduce((sum, log) => sum + log.value, 0) : 0;
  if (habit.kind === 'water') { value = waterLogs.filter((log) => log.date === date).reduce((sum, log) => sum + log.amountMl, 0); if (value === 0 && explicit.length) value = explicit.reduce((sum, log) => sum + log.value, 0); }
  if (habit.kind === 'exercise') { value = exerciseLogs.filter((log) => log.date === date).reduce((sum, log) => sum + (log.durationMinutes ?? 0), 0); if (value === 0 && explicit.length) value = explicit.reduce((sum, log) => sum + log.value, 0); }
  const status = explicit.length || value > 0 ? (habit.kind === 'water' && value > 0 && value < habit.targetValue ? 'partial' : evaluateHabitOutcome(habit, value)) : 'unreported';
  const contribution = status === 'completed' ? 1 : status === 'partial' && (habit.streakPolicy === 'target_or_partial' || habit.streakPolicy === 'minimum_value') ? 1 : 0;
  return {
    id: `occurrence:${habit.id}:${date}`, habitId: habit.id, date, status, targetValue: habit.targetValue, minimumValue: getHabitMinimum(habit),
    scheduledMinutes: habit.kind === 'water' ? 0 : Math.max(5, habit.targetValue || 30), preferredWindows: habit.preferredWindows,
    streakContribution: contribution, carryOverEligible: Boolean(habit.carryOverAllowed) && (status === 'partial' || status === 'skipped' || status === 'unreported'),
    reason: status === 'completed' ? 'Target reached.' : status === 'partial' ? 'Minimum achieved; target not reached.' : status === 'skipped' ? 'Reported below minimum.' : 'No result has been recorded yet.',
  };
}


export function calculateHabitStreak(habit: Habit, dates: ISODate[], logs: HabitLog[], waterLogs: WaterLog[], exerciseLogs: ExerciseLog[], throughDate: ISODate): HabitStreak {
  const dueDates = dates.filter((date) => date <= throughDate && isHabitDue(habit, date)).sort();
  let longest = 0, current = 0, run = 0, qualifyingDays = 0;
  for (const date of dueDates) {
    const qualifies = buildHabitOccurrence(habit, date, logs, waterLogs, exerciseLogs).streakContribution === 1;
    if (qualifies) { run += 1; qualifyingDays += 1; longest = Math.max(longest, run); }
    else run = 0;
  }
  for (let i = dueDates.length - 1; i >= 0; i -= 1) {
    const date = dueDates[i];
    if (buildHabitOccurrence(habit, date, logs, waterLogs, exerciseLogs).streakContribution !== 1) break;
    current += 1;
  }
  return { current, longest, qualifyingDays };
}

export function habitSummary(habit: Habit, startDate: ISODate, endDate: ISODate, logs: HabitLog[], waterLogs: WaterLog[], exerciseLogs: ExerciseLog[]) {
  const dates: string[] = []; const d = new Date(`${startDate}T12:00:00`); const end = new Date(`${endDate}T12:00:00`);
  while (d <= end) {
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  const due = dates.filter((x) => isHabitDue(habit, x));
  const occurrences = due.map((x) => buildHabitOccurrence(habit, x, logs, waterLogs, exerciseLogs));
  const completed = occurrences.filter((x) => x.status === 'completed').length;
  const partial = occurrences.filter((x) => x.status === 'partial').length;
  const skipped = occurrences.filter((x) => x.status === 'skipped').length;
  const unreported = occurrences.filter((x) => x.status === 'unreported').length;
  const streak = calculateHabitStreak(habit, dates, logs, waterLogs, exerciseLogs, endDate);
  return { due: due.length, completed, partial, skipped, unreported, adherenceRate: due.length ? Math.round(((completed + partial * 0.5) / due.length) * 100) : 0, ...streak };
}
