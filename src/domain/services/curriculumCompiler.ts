import type { CurriculumConcept, NormalizedRoadmapNode, TaskDefinition } from '../entities/models';
import { generateTasksForConcept } from './taskGenerator';

export interface CompiledCurriculum {
  concepts: CurriculumConcept[];
  tasks: TaskDefinition[];
}

export function compileCurriculum(nodes: NormalizedRoadmapNode[]): CompiledCurriculum {
  const parentIds = new Set(nodes.flatMap((node) => node.parentId ? [node.parentId] : []));
  // Structural headings and parent/group nodes organize the roadmap; only terminal
  // learning nodes should create schedulable concepts and work.
  const learnableNodes = nodes.filter((node) =>
    !parentIds.has(node.id)
    && node.marker !== 'heading'
    && node.nodeType !== 'subject'
    && node.nodeType !== 'module'
    && node.nodeType !== 'unknown'
  );

  const concepts: CurriculumConcept[] = learnableNodes.map((node) => ({
    id: `${node.roadmapId}:concept:${node.id.split(':').at(-1)}`,
    roadmapId: node.roadmapId,
    sourceNodeId: node.id,
    title: node.cleanedTitle,
    nodeType: node.nodeType,
    outcomes: [`Explain ${node.cleanedTitle}`, `Apply ${node.cleanedTitle} in a small practical context`],
  }));

  const tasks: TaskDefinition[] = [];
  let previousTaskId: string | undefined;

  concepts.forEach((concept, index) => {
    const conceptTasks = generateTasksForConcept(concept, index);
    if (previousTaskId && conceptTasks.length > 0) {
      conceptTasks[0] = {
        ...conceptTasks[0],
        dependencyIds: [...new Set([...conceptTasks[0].dependencyIds, previousTaskId])],
      };
    }
    tasks.push(...conceptTasks);
    previousTaskId = conceptTasks.at(-1)?.id ?? previousTaskId;
  });

  return { concepts, tasks };
}
