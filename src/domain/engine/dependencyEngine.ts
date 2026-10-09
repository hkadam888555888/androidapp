import type { DependencyEdge, RoadmapTask } from '../entities/models';

export interface DependencyValidationResult { valid: boolean; cycles: string[][]; missing: string[]; selfDependencies: string[]; }

export function buildHardDependencies(tasks: RoadmapTask[]): DependencyEdge[] {
  return tasks.flatMap((task) => task.dependencyIds.map((dependencyId) => ({
    fromTaskId: dependencyId,
    toTaskId: task.id,
    type: 'hard' as const,
    confidence: 'high' as const,
  })));
}

export function validateDependencyGraph(tasks: RoadmapTask[]): DependencyValidationResult {
  const ids = new Set(tasks.map((task) => task.id));
  const missing: string[] = [];
  const selfDependencies: string[] = [];
  const adjacency = new Map<string, string[]>();

  for (const task of tasks) adjacency.set(task.id, []);

  for (const task of tasks) {
    for (const dep of task.dependencyIds) {
      if (!ids.has(dep)) missing.push(`${task.id}->${dep}`);
      if (dep === task.id) selfDependencies.push(task.id);
      else if (ids.has(dep)) adjacency.get(dep)!.push(task.id);
    }
  }

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(id: string): void {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      if (start >= 0) cycles.push([...path.slice(start), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    path.push(id);
    for (const child of adjacency.get(id) ?? []) visit(child);
    path.pop();
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of ids) visit(id);
  return { valid: missing.length === 0 && selfDependencies.length === 0 && cycles.length === 0, cycles, missing, selfDependencies };
}

export function readyTaskIds(tasks: RoadmapTask[]): string[] {
  const completed = new Set(tasks.filter((task) => task.completedOverall).map((task) => task.id));
  return tasks
    .filter((task) => task.active !== false)
    .filter((task) => !task.completedOverall)
    .filter((task) => !task.manuallyBlocked)
    .filter((task) => task.dependencyIds.every((dep) => completed.has(dep)))
    .map((task) => task.id);
}
