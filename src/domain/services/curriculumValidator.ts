import type { ParsedRoadmap, TaskDefinition } from '../entities/models';

export interface ValidationIssue { code: string; message: string; id?: string; }
export interface CurriculumValidationResult { valid: boolean; issues: ValidationIssue[]; }

export function validateParsedRoadmap(parsed: ParsedRoadmap): CurriculumValidationResult {
  const issues: ValidationIssue[] = parsed.issues.map((issue) => ({ code: issue.code, message: issue.message }));
  for (const node of parsed.nodes) {
    if (!node.cleanedTitle) issues.push({ code: 'empty_node', message: `Node ${node.id} has no title.`, id: node.id });
    if (node.parentId && !parsed.nodes.some((candidate) => candidate.id === node.parentId)) {
      issues.push({ code: 'missing_parent', message: `Parent ${node.parentId} does not exist.`, id: node.id });
    }
  }
  return { valid: issues.length === 0, issues };
}

export function validateTasks(tasks: TaskDefinition[]): CurriculumValidationResult {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) issues.push({ code: 'duplicate_task', message: `Duplicate task id ${task.id}`, id: task.id });
    ids.add(task.id);
    if (!task.title.trim() || !task.objective.trim() || !task.completionCriteria.trim()) {
      issues.push({ code: 'vague_task', message: `Task ${task.id} is missing required execution detail.`, id: task.id });
    }
    if (task.estimatedMinutes < task.minMinutes || task.estimatedMinutes > task.maxMinutes) {
      issues.push({ code: 'invalid_duration', message: `Task ${task.id} has inconsistent duration bounds.`, id: task.id });
    }
    if (task.estimatedMinutes < 15 || task.estimatedMinutes > 90) {
      issues.push({ code: 'granularity', message: `Task ${task.id} falls outside the default 15–90 minute target.`, id: task.id });
    }
    if (task.dependencyIds.includes(task.id)) {
      issues.push({ code: 'self_dependency', message: `Task ${task.id} depends on itself.`, id: task.id });
    }
  }
  return { valid: issues.length === 0, issues };
}
