import type { DailyReview, DailyTask, ISODate } from '../entities/models';
import { requiresReview } from '../policies/taskState';

export function getUnreportedTasks(tasks: DailyTask[], date: ISODate): DailyTask[] {
  return tasks.filter((task) => task.date === date && requiresReview(task));
}

export function buildDailyReview(tasks: DailyTask[], date: ISODate): DailyReview {
  const required = getUnreportedTasks(tasks, date).length > 0;
  return { id: `review:${date}`, date, required, unresolvedTaskIds: getUnreportedTasks(tasks, date).map((task) => task.id), status: required ? 'blocked_pending_report' : 'ready' };
}

export function canFinalizeNextPlan(tasks: DailyTask[], previousDate: ISODate): boolean {
  return getUnreportedTasks(tasks, previousDate).length === 0;
}
