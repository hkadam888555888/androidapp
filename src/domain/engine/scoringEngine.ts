import type { RoadmapTask, TaskPriority } from '../entities/models';

const PRIORITY: Record<TaskPriority, number> = { low: 10, medium: 20, high: 35, urgent: 50 };

export interface TaskScoreInput {
  task: RoadmapTask;
  allTasks: RoadmapTask[];
  today: string;
}

export interface TaskScore {
  value: number;
  factors: string[];
}

export function scoreRoadmapTask({ task, allTasks, today }: TaskScoreInput): TaskScore {
  const factors: string[] = [`priority +${PRIORITY[task.priority]}`];
  let value = PRIORITY[task.priority];

  if (task.dueDate) {
    const days = Math.ceil((new Date(`${task.dueDate.slice(0, 10)}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000);
    const urgency = days <= 0 ? 45 : days <= 1 ? 40 : days <= 3 ? 30 : days <= 7 ? 18 : 8;
    value += urgency; factors.push(`deadline +${urgency}`);
  }

  const carry = Math.min(20, (task.carryOverCount ?? 0) * 5);
  if (carry) { value += carry; factors.push(`carry-over +${carry}`); }

  const unlocks = allTasks.filter((candidate) => candidate.dependencyIds.includes(task.id) && !candidate.completedOverall).length;
  const unlockValue = Math.min(25, unlocks * 5);
  if (unlockValue) { value += unlockValue; factors.push(`unlocks ${unlocks} task${unlocks === 1 ? '' : 's'} +${unlockValue}`); }

  const effortPenalty = Math.max(0, Math.min(15, Math.round(task.estimatedMinutes / 30) - 1));
  if (effortPenalty) { value -= effortPenalty; factors.push(`effort -${effortPenalty}`); }

  return { value, factors };
}
