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

  // Keep every node for hierarchy/context, but create schedulable work only from
  // actionable leaves. Parent modules are labels for their children, not extra
  // duplicate lessons. Parent projects/milestones retain one checkpoint task.
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentIds = new Set(nodes.flatMap((node) => node.parentId ? [node.parentId] : []));
  const tasks = concepts.flatMap((concept, index) => {
    const node = nodeById.get(concept.sourceNodeId);
    if (!node || node.nodeType === 'subject') return [];

    const hasChildren = parentIds.has(node.id);
    const isCheckpointContainer = node.nodeType === 'project' || node.nodeType === 'milestone';
    if (hasChildren && !isCheckpointContainer) return [];

    return generateTasksForConcept(concept, index, { checkpointOnly: hasChildren });
  });
  return { concepts, tasks };
}
