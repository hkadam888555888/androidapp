import type { CurriculumConcept, NormalizedRoadmapNode, TaskDefinition } from '../entities/models';
import { generateTasksForConcept } from './taskGenerator';

export interface CompiledCurriculum {
  concepts: CurriculumConcept[];
  tasks: TaskDefinition[];
}

export function compileCurriculum(nodes: NormalizedRoadmapNode[]): CompiledCurriculum {
  const concepts: CurriculumConcept[] = nodes.map((node) => ({
    id: `${node.roadmapId}:concept:${node.id.split(':').at(-1)}`,
    roadmapId: node.roadmapId,
    sourceNodeId: node.id,
    title: node.cleanedTitle,
    parentConceptId: node.parentId ? `${node.roadmapId}:concept:${node.parentId.split(':').at(-1)}` : undefined,
    nodeType: node.nodeType,
    outcomes: [`Explain ${node.cleanedTitle}`, `Apply ${node.cleanedTitle} in a small practical context`],
  }));

  const tasks = concepts.flatMap((concept, index) => generateTasksForConcept(concept, index));
  return { concepts, tasks };
}
