import type { DailyTask } from '../domain/entities/models';

export interface ReconciledPlanTasks {
  tasks: DailyTask[];
  cancelled: DailyTask[];
}

/**
 * Reconcile newly proposed instances against today's persisted instances.
 * A repeated generation may update a still-planned instance, but must never
 * overwrite a reported result (or silently leave an obsolete planned block active).
 */
export function reconcilePlanTasks(
  proposed: DailyTask[],
  currentDateTasks: DailyTask[],
  planVersion: number,
): ReconciledPlanTasks {
  const currentById = new Map(currentDateTasks.map((task) => [task.id, task]));

  const tasks = proposed.map((candidate) => {
    const currentBase = currentById.get(candidate.id);
    if (!currentBase || currentBase.status === 'planned') return candidate;

    // If a previously versioned occurrence is still pending, reschedule that
    // same instance. Otherwise create a new occurrence and preserve the old one.
    const versionPrefix = `${candidate.id}:v`;
    const pendingVersioned = currentDateTasks
      .filter((task) => task.id.startsWith(versionPrefix) && task.status === 'planned')
      .sort((a, b) => versionNumber(b.id, versionPrefix) - versionNumber(a.id, versionPrefix))[0];

    return {
      ...candidate,
      id: pendingVersioned?.id ?? `${candidate.id}:v${planVersion}`,
    };
  });

  const plannedIds = new Set(tasks.map((task) => task.id));
  const cancelled = currentDateTasks
    .filter((task) => task.status === 'planned' && !plannedIds.has(task.id))
    .map((task) => ({
      ...task,
      status: 'cancelled' as const,
      resultNote: 'Removed from a regenerated plan. No completion was inferred.',
    }));

  return { tasks, cancelled };
}

function versionNumber(id: string, prefix: string): number {
  const match = id.slice(prefix.length).match(/^(\d+)$/u);
  return match ? Number(match[1]) : 0;
}
