import { describe, expect, it } from 'vitest';
import { diffCurriculum } from './curriculumDiff';

const concept = (id: string, title: string) => ({ id, roadmapId: 'r', sourceNodeId: `node:${id}`, title, nodeType: 'concept' as const, outcomes: [`Explain ${title}`] });
const task = (id: string, title: string, minutes = 30) => ({ id, roadmapId: 'r', sourceNodeId: 'n', conceptId: 'c', title, objective: `Do ${title}`, type: 'learn' as const, estimatedMinutes: minutes, minMinutes: 20, maxMinutes: 45, difficulty: 'medium' as const, priority: 'medium' as const, completionCriteria: 'Produce an explanation', dependencyIds: [], confidence: 'high' as const, active: true });

describe('diffCurriculum', () => {
  it('detects added, removed and changed items while preserving unchanged identity', () => {
    const previousConcepts = [concept('c1', 'Python'), concept('c2', 'NumPy')];
    const nextConcepts = [concept('c1', 'Python'), concept('c3', 'Pandas')];
    const previousTasks = [task('t1', 'Understand Python'), task('t2', 'Practice NumPy')];
    const nextTasks = [task('t1', 'Understand Python', 45), task('t3', 'Understand Pandas')];
    const diff = diffCurriculum(previousConcepts, previousTasks, nextConcepts, nextTasks);
    expect(diff.added.map((x) => x.id)).toEqual(expect.arrayContaining(['c3', 't3']));
    expect(diff.removed.map((x) => x.id)).toEqual(expect.arrayContaining(['c2', 't2']));
    expect(diff.changed.map((x) => x.id)).toContain('t1');
    expect(diff.unchangedConcepts).toBe(1);
    expect(diff.unchangedTasks).toBe(0);
  });
});
