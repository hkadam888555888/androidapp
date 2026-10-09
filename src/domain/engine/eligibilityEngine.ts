import type { ISODate, RoadmapTask } from '../entities/models';

export interface EligibilityResult {
  taskId: string;
  eligible: boolean;
  reasons: string[];
}

export function evaluateEligibility(task: RoadmapTask, date: ISODate): EligibilityResult {
  const reasons: string[] = [];
  if (!task.completedOverall) {
    // continue
  } else reasons.push('task already completed overall');
  if (task.manuallyBlocked) reasons.push('manual blocker is active');
  if (task.availableFrom && date < task.availableFrom) reasons.push(`available from ${task.availableFrom}`);
  if (task.availableUntil && date > task.availableUntil) reasons.push(`availability window ended ${task.availableUntil}`);
  if (!task.title.trim()) reasons.push('missing task title');
  return { taskId: task.id, eligible: reasons.length === 0, reasons };
}
