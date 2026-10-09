import type { TaskDefinition } from '../entities/models';

export interface AIValidationResult { valid: boolean; issues: string[]; }

export function validateAITaskCandidates(tasks: TaskDefinition[]): AIValidationResult {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) issues.push(`duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (!task.title.trim() || !task.objective.trim() || !task.completionCriteria.trim()) issues.push(`incomplete task contract: ${task.id}`);
    if (task.estimatedMinutes < 15 || task.estimatedMinutes > 90) issues.push(`task duration outside default bounds: ${task.id}`);
    if (task.dependencyIds.includes(task.id)) issues.push(`self dependency: ${task.id}`);
  }
  return { valid: issues.length === 0, issues };
}
