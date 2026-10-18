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
  // actionable leaves. Checkpoint containers retain one checkpoint after their
  // descendants, so completing the last child can unlock the parent checkpoint.
  const taskGroups = new Map<string, TaskDefinition[]>();
  concepts.forEach((concept, index) => {
    const node = nodes[index];
    if (node.nodeType === 'subject') return;

    const hasChildren = nodes.some((candidate) => candidate.parentId === node.id);
    const isCheckpointContainer = node.nodeType === 'project' || node.nodeType === 'milestone';
    if (hasChildren && !isCheckpointContainer) return;

    taskGroups.set(node.id, generateTasksForConcept(concept, index, { checkpointOnly: hasChildren }));
  });

  const nodesByRoadmap = new Map<string, NormalizedRoadmapNode[]>();
  for (const node of nodes) {
    const group = nodesByRoadmap.get(node.roadmapId) ?? [];
    group.push(node);
    nodesByRoadmap.set(node.roadmapId, group);
  }

  const tasks: TaskDefinition[] = [];
  for (const roadmapNodes of nodesByRoadmap.values()) {
    const nodeIds = new Set(roadmapNodes.map((node) => node.id));
    const childrenByParent = new Map<string, NormalizedRoadmapNode[]>();
    for (const node of roadmapNodes) {
      if (!node.parentId || !nodeIds.has(node.parentId)) continue;
      const children = childrenByParent.get(node.parentId) ?? [];
      children.push(node);
      childrenByParent.set(node.parentId, children);
    }
    for (const children of childrenByParent.values()) {
      children.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    const orderedNodes = roadmapNodes.slice().sort((a, b) => a.orderIndex - b.orderIndex);
    const roots = orderedNodes.filter((node) => !node.parentId || !nodeIds.has(node.parentId));
    const visited = new Set<string>();
    const orderedTasks: TaskDefinition[] = [];

    function appendSubtree(node: NormalizedRoadmapNode): void {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      const children = childrenByParent.get(node.id) ?? [];
      for (const child of children) appendSubtree(child);

      // Post-order means checkpoints for projects/milestones follow their
      // contained lessons instead of appearing before their prerequisites.
      orderedTasks.push(...(taskGroups.get(node.id) ?? []));
    }

    for (const root of roots) appendSubtree(root);
    // Preserve orphaned/corrupt nodes if compileCurriculum is called without
    // the parser's validation gate; do not silently drop their generated work.
    for (const node of orderedNodes) appendSubtree(node);

    // A roadmap advances in source order: each task depends on the preceding
    // task in that same roadmap. Separate roadmaps still progress independently.
    let previousTaskId: string | undefined;
    for (const task of orderedTasks) {
      const dependencyIds = previousTaskId
        ? [...new Set([...task.dependencyIds, previousTaskId])]
        : task.dependencyIds;
      tasks.push({ ...task, dependencyIds });
      previousTaskId = task.id;
    }
  }

  return { concepts, tasks };
}
