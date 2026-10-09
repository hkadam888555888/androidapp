import type { DailyTask, TaskStatus } from '../entities/models';

export const FINAL_TASK_STATUSES: ReadonlySet<TaskStatus> = new Set(['completed', 'partial', 'skipped']);

export function isExplicitlyReported(task: DailyTask): boolean {
  return FINAL_TASK_STATUSES.has(task.status) && Boolean(task.resultReportedAt);
}

export function canMoveToNextDay(task: DailyTask): boolean {
  return task.status === 'completed' || task.status === 'partial' || task.status === 'skipped' || task.status === 'rescheduled';
}

export function requiresReview(task: DailyTask): boolean {
  return task.status === 'unreported';
}

/** Only an active occurrence or one explicitly carried to review may receive its first result. */
export function assertTaskCanBeReported(task: DailyTask): void {
  if (task.status !== 'planned' && task.status !== 'unreported') {
    throw new Error('This task already has a result or is no longer active. Historical results are immutable; use an explicit correction flow if one is available.');
  }
}

export function markCompleted(task: DailyTask, reportedAt: string): DailyTask {
  if (task.status === 'completed') return task;
  if (task.status === 'skipped') {
    throw new Error('A skipped task cannot be marked completed without an explicit correction flow.');
  }
  return { ...task, status: 'completed', resultReportedAt: reportedAt };
}

export function markPartial(task: DailyTask, reportedAt: string): DailyTask {
  if (task.status === 'completed') throw new Error('A completed task cannot be marked partial without an explicit correction flow.');
  if (task.status === 'skipped') throw new Error('A skipped task cannot be marked partial without an explicit correction flow.');
  return { ...task, status: 'partial', resultReportedAt: reportedAt };
}

export function markSkipped(task: DailyTask, reportedAt: string, reason?: string): DailyTask {
  if (task.status === 'skipped') return task;
  if (task.status === 'completed') {
    throw new Error('A completed task cannot be marked skipped without an explicit correction flow.');
  }
  return {
    ...task,
    status: 'skipped',
    resultReportedAt: reportedAt,
    skipReason: reason?.trim() || undefined,
  };
}

export function closeUnreportedTask(task: DailyTask): DailyTask {
  if (task.status !== 'planned') return task;
  return { ...task, status: 'unreported' };
}
