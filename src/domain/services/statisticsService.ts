import type { DailyTask } from '../entities/models';

export interface ReportingStats {
  completed: number;
  skipped: number;
  partial: number;
  unreported: number;
  reported: number;
  completionRate: number;
  currentReportingStreak: number;
  longestReportingStreak: number;
}

export function calculateReportingStats(tasks: DailyTask[], fromDate: string, toDate: string): ReportingStats {
  const range = tasks.filter((task) => task.date >= fromDate && task.date <= toDate);
  const completed = range.filter((t) => t.status === 'completed').length;
  const partial = range.filter((t) => t.status === 'partial').length;
  const skipped = range.filter((t) => t.status === 'skipped').length;
  const unreported = range.filter((t) => t.status === 'unreported' || t.status === 'planned').length;
  const reported = completed + partial + skipped;
  const completionRate = reported ? Math.round(((completed + partial * 0.5) / reported) * 100) : 0;

  const activeDates = [...new Set(range.filter((t) => t.status === 'completed' || t.status === 'partial' || t.status === 'skipped').map((t) => t.date))].sort();
  let longest = 0, running = 0;
  let previous: string | undefined;
  for (const date of activeDates) {
    if (!previous || dayDistance(previous, date) !== 1) running = 1; else running += 1;
    longest = Math.max(longest, running); previous = date;
  }
  let current = 0;
  if (activeDates.at(-1) === toDate) {
    for (let i = activeDates.length - 1; i >= 0; i -= 1) {
      if (i === activeDates.length - 1 || dayDistance(activeDates[i], activeDates[i + 1]) === 1) current += 1; else break;
    }
  }
  return { completed, skipped, partial, unreported, reported, completionRate, currentReportingStreak: current, longestReportingStreak: longest };
}

function dayDistance(a: string, b: string): number {
  const aa = new Date(`${a}T12:00:00`).getTime(); const bb = new Date(`${b}T12:00:00`).getTime();
  return Math.round((bb - aa) / 86_400_000);
}
