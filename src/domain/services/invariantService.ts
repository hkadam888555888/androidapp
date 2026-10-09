import type { DailyTask, RoadmapTask } from '../entities/models';
import { validateDependencyGraph } from '../engine/dependencyEngine';

export interface InvariantReport {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
}

export function evaluateInvariants(tasks: DailyTask[], roadmapTasks: RoadmapTask[]): InvariantReport {
  const dependency = validateDependencyGraph(roadmapTasks);
  const completionTimestamps = tasks.filter((task) => task.status === 'completed').every((task) => Boolean(task.resultReportedAt));
  const noInvalidNegativeDurations = tasks.every((task) => task.plannedMinutes > 0);
  const checks = [
    { name: 'Completion evidence', ok: completionTimestamps, detail: completionTimestamps ? 'Every completed instance has an explicit report timestamp.' : 'At least one completed instance has no report timestamp.' },
    { name: 'Positive scheduled durations', ok: noInvalidNegativeDurations, detail: noInvalidNegativeDurations ? 'All daily instances have positive planned duration.' : 'A daily instance has an invalid duration.' },
    { name: 'Dependency graph', ok: dependency.valid, detail: dependency.valid ? 'No dependency cycles or missing references.' : `${dependency.cycles.length} cycle(s), ${dependency.missing.length} missing reference(s).` },
  ];
  return { ok: checks.every((check) => check.ok), checks };
}
