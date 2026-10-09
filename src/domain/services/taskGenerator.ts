import type { CurriculumConcept, Difficulty, TaskDefinition, TaskPriority } from '../entities/models';

export function generateTasksForConcept(concept: CurriculumConcept, orderIndex: number): TaskDefinition[] {
  const base = concept.title;
  const rootPriority: TaskPriority = concept.nodeType === 'milestone' || concept.nodeType === 'project' ? 'high' : 'medium';
  const difficulty: Difficulty = concept.nodeType === 'project' ? 'very_hard' : concept.nodeType === 'concept' ? 'medium' : 'easy';

  const templates: Array<Omit<TaskDefinition, 'id' | 'roadmapId' | 'sourceNodeId' | 'conceptId'>> = [
    {
      title: `Understand ${base}`,
      objective: `Build a clear mental model of ${base} and its key terms.`,
      type: 'learn',
      estimatedMinutes: 30,
      minMinutes: 20,
      maxMinutes: 45,
      difficulty,
      priority: rootPriority,
      completionCriteria: `Write a 5-point explanation of ${base} in your own words.`,
      dependencyIds: [],
      confidence: 'high',
      active: true,
      splittable: false,
    },
    {
      title: `Practice ${base}`,
      objective: `Solve a focused set of exercises using ${base}.`,
      type: 'practice',
      estimatedMinutes: 45,
      minMinutes: 30,
      maxMinutes: 60,
      difficulty,
      priority: rootPriority,
      completionCriteria: `Complete at least 3 correct examples involving ${base}.`,
      dependencyIds: [],
      confidence: 'high',
      active: true,
      splittable: false,
    },
  ];

  if (concept.nodeType === 'project' || concept.nodeType === 'milestone') {
    templates.push({
      title: `Checkpoint: ${base}`,
      objective: `Demonstrate that the roadmap milestone ${base} is actionable and understood.`,
      type: 'checkpoint',
      estimatedMinutes: 30,
      minMinutes: 20,
      maxMinutes: 45,
      difficulty: 'hard',
      priority: 'high',
      completionCriteria: `Produce one concrete artifact or explanation that demonstrates ${base}.`,
      dependencyIds: [],
      confidence: 'high',
      active: true,
      splittable: false,
    });
  }

  return templates.map((template, i) => ({
    ...template,
    id: `${concept.id}:task:${orderIndex + 1}-${i + 1}`,
    roadmapId: concept.roadmapId,
    sourceNodeId: concept.sourceNodeId,
    conceptId: concept.id,
    dependencyIds: i === 0 ? [] : [`${concept.id}:task:${orderIndex + 1}-${i}`],
  }));
}
