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

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const conceptBySourceNodeId = new Map(concepts.map((concept) => [concept.sourceNodeId, concept]));
  const conceptIndexBySourceNodeId = new Map(concepts.map((concept, index) => [concept.sourceNodeId, index]));
  const childrenByParent = new Map<string, NormalizedRoadmapNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  // Structural headings describe the roadmap; actionable leaves create work.
  // Parent projects/milestones are kept as final checkpoints after their children.
  const actionableNodes: NormalizedRoadmapNode[] = [];
  const visited = new Set<string>();
  const visit = (start: NormalizedRoadmapNode) => {
    const stack: Array<{ node: NormalizedRoadmapNode; expanded: boolean }> = [{ node: start, expanded: false }];
    while (stack.length) {
      const current = stack.pop()!;
      if (current.expanded) {
        const children = childrenByParent.get(current.node.id) ?? [];
        if (children.length === 0 || current.node.nodeType === 'project' || current.node.nodeType === 'milestone') {
          actionableNodes.push(current.node);
        }
        continue;
      }
      if (visited.has(current.node.id)) continue;
      visited.add(current.node.id);
      stack.push({ node: current.node, expanded: true });
      const children = childrenByParent.get(current.node.id) ?? [];
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: children[index], expanded: false });
      }
    }
  };

  const roots = nodes.filter((node) => !node.parentId || !nodeById.has(node.parentId));
  for (const root of roots) visit(root);
  // Keep compilation total even if a caller supplies malformed/disconnected nodes.
  for (const node of nodes) visit(node);

  const tasks: TaskDefinition[] = [];
  for (const node of actionableNodes) {
    const concept = conceptBySourceNodeId.get(node.id);
    if (!concept) continue;
    const index = conceptIndexBySourceNodeId.get(node.id) ?? 0;
    // Inherit the nearest section context so ambiguous leaf titles are classified
    // correctly (for example, Arrays under NumPy vs Arrays under Python).
    const contextTitles: string[] = [];
    let parent = node.parentId ? nodeById.get(node.parentId) : undefined;
    while (parent) {
      if (parent.nodeType !== 'subject') contextTitles.unshift(parent.cleanedTitle);
      parent = parent.parentId ? nodeById.get(parent.parentId) : undefined;
    }

    // Keep each concept's own learning/practice dependency; unrelated siblings
    // must remain independently schedulable.
    tasks.push(...generateTasksForConcept(concept, index, contextTitles));
  }

  return { concepts, tasks };
}
