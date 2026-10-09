import type { CurriculumConcept, TaskDefinition } from '../entities/models';

export type CurriculumDiffKind = 'added' | 'removed' | 'changed';
export interface CurriculumDiffItem {
  kind: CurriculumDiffKind;
  entity: 'concept' | 'task';
  id: string;
  title: string;
  detail: string;
}

export interface CurriculumDiff {
  added: CurriculumDiffItem[];
  removed: CurriculumDiffItem[];
  changed: CurriculumDiffItem[];
  unchangedConcepts: number;
  unchangedTasks: number;
}

function taskFingerprint(task: TaskDefinition): string {
  return [task.title, task.objective, task.type, task.estimatedMinutes, task.minMinutes, task.maxMinutes, task.difficulty, task.priority, task.completionCriteria, [...task.dependencyIds].sort().join(','), task.splittable ?? false].join('|');
}

function conceptFingerprint(concept: CurriculumConcept): string {
  return [concept.title, concept.parentConceptId ?? '', concept.nodeType, concept.outcomes.join('|')].join('|');
}

export function diffCurriculum(previousConcepts: CurriculumConcept[], previousTasks: TaskDefinition[], nextConcepts: CurriculumConcept[], nextTasks: TaskDefinition[]): CurriculumDiff {
  const added: CurriculumDiffItem[] = [];
  const removed: CurriculumDiffItem[] = [];
  const changed: CurriculumDiffItem[] = [];

  const compare = <T extends { id: string; title: string }>(previous: T[], next: T[], fingerprint: (item: T) => string, entity: 'concept' | 'task') => {
    const oldMap = new Map(previous.map((item) => [item.id, item]));
    const nextMap = new Map(next.map((item) => [item.id, item]));
    for (const item of next) {
      if (!oldMap.has(item.id)) added.push({ kind: 'added', entity, id: item.id, title: item.title, detail: 'New in this curriculum version.' });
      else if (fingerprint(oldMap.get(item.id)!) !== fingerprint(item)) changed.push({ kind: 'changed', entity, id: item.id, title: item.title, detail: 'Existing item changed; history remains attached to prior instances.' });
    }
    for (const item of previous) {
      if (!nextMap.has(item.id)) removed.push({ kind: 'removed', entity, id: item.id, title: item.title, detail: 'Removed from the proposed curriculum version; prior history must remain preserved.' });
    }
    return previous.filter((item) => nextMap.has(item.id) && fingerprint(oldMap.get(item.id)!) === fingerprint(nextMap.get(item.id)!)).length;
  };

  const unchangedConcepts = compare(previousConcepts, nextConcepts, conceptFingerprint, 'concept');
  const unchangedTasks = compare(previousTasks, nextTasks, taskFingerprint, 'task');
  return { added, removed, changed, unchangedConcepts, unchangedTasks };
}
