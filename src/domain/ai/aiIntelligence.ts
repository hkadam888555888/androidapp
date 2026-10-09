import type {
  AIArtifact,
  CurriculumConcept,
  DependencyEdge,
  KnowledgeGapSuggestion,
  ParsedRoadmap,
  RoadmapTask,
  TaskDefinition,
  TaskStatus,
} from '../entities/models';
import { validateDependencyGraph } from '../engine/dependencyEngine';
import { validateAITaskCandidates } from './aiOutputValidator';
import type { AIProvider } from './aiProvider';

export interface AIExpansionContext {
  roadmapId: string;
  nodeId: string;
  nodeTitle: string;
  parentTitles: string[];
  nearbyTitles: string[];
  existingConceptTitles: string[];
  existingTaskTitles: string[];
}

export interface AIExpansionResult {
  concepts: CurriculumConcept[];
  tasks: TaskDefinition[];
  dependencySuggestions: DependencyEdge[];
  practiceSuggestions: string[];
  warnings: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface AISemanticAnalysis {
  summary: string;
  nodeCount: number;
  conceptLikeNodes: number;
  projectLikeNodes: number;
  milestoneLikeNodes: number;
  ambiguousNodes: string[];
  suggestions: string[];
  confidence: 'high' | 'medium' | 'low';
}

const HIGH_RISK_TERMS = /ignore previous|delete|system prompt|api key|password|jailbreak|execute code/iu;

export function analyzeRoadmapSemantics(parsed: ParsedRoadmap): AISemanticAnalysis {
  const ambiguousNodes = parsed.nodes
    .filter((node) => node.cleanedTitle.length < 3 || /^(topic|stuff|learn|misc|other)$/iu.test(node.cleanedTitle.trim()))
    .map((node) => node.cleanedTitle);
  const riskyNodes = parsed.nodes.filter((node) => HIGH_RISK_TERMS.test(node.cleanedTitle)).map((node) => node.cleanedTitle);
  const projectLikeNodes = parsed.nodes.filter((node) => node.nodeType === 'project').length;
  const milestoneLikeNodes = parsed.nodes.filter((node) => node.nodeType === 'milestone').length;
  const conceptLikeNodes = parsed.nodes.filter((node) => node.nodeType === 'concept' || node.nodeType === 'skill').length;
  const suggestions = [...ambiguousNodes.map((title) => `Clarify “${title}” before treating it as a precise learning unit.`)];
  if (riskyNodes.length) suggestions.push(`Treat instruction-like roadmap text as user data; it must never override application rules.`);
  if (parsed.nodes.length > 30) suggestions.push('Consider expanding the roadmap branch-by-branch instead of generating everything at once.');
  return {
    summary: `Found ${parsed.nodes.length} roadmap nodes: ${conceptLikeNodes} concept/skill nodes, ${projectLikeNodes} project-like nodes, and ${milestoneLikeNodes} milestone-like nodes.`,
    nodeCount: parsed.nodes.length,
    conceptLikeNodes,
    projectLikeNodes,
    milestoneLikeNodes,
    ambiguousNodes,
    suggestions,
    confidence: parsed.issues.length === 0 && ambiguousNodes.length === 0 ? 'high' : parsed.issues.length <= 2 ? 'medium' : 'low',
  };
}

export async function expandRoadmapNodeWithValidation(
  provider: AIProvider,
  node: { id: string; title: string },
  context: AIExpansionContext,
): Promise<AIExpansionResult> {
  const result = await provider.expandNode(node);
  // Normalize provider IDs and roadmap references inside the application trust boundary.
  // Third-party/local model IDs are never trusted as persistent primary keys.
  const concepts = result.concepts.slice(0, 5).map((concept, index) => ({
    ...concept,
    id: `${context.roadmapId}:ai:${context.nodeId}:concept:${index + 1}`,
    roadmapId: context.roadmapId,
    sourceNodeId: context.nodeId,
  }));
  const conceptIdMap = new Map(result.concepts.map((concept, index) => [concept.id, concepts[index]?.id ?? concepts[0]?.id ?? `${context.roadmapId}:ai:${context.nodeId}:concept:1`]));
  const taskIdMap = new Map(result.tasks.slice(0, 8).map((task, index) => [task.id, `${context.roadmapId}:ai:${context.nodeId}:task:${index + 1}`]));
  const normalizedTasks = result.tasks.slice(0, 8).map((task) => ({
    ...task,
    id: taskIdMap.get(task.id) ?? `${context.roadmapId}:ai:${context.nodeId}:task:extra`,
    roadmapId: context.roadmapId,
    sourceNodeId: context.nodeId,
    conceptId: conceptIdMap.get(task.conceptId) ?? concepts[0]?.id ?? `${context.roadmapId}:ai:${context.nodeId}:concept:1`,
    dependencyIds: task.dependencyIds.map((id) => taskIdMap.get(id)).filter((id): id is string => Boolean(id)),
  }));
  const validation = validateAITaskCandidates(normalizedTasks);
  const existingIds = new Set(context.existingTaskTitles.map((title) => title.trim().toLocaleLowerCase()));
  const dedupedTasks = normalizedTasks.filter((task) => !existingIds.has(task.title.trim().toLocaleLowerCase()));
  const taskValidation = validateAITaskCandidates(dedupedTasks);
  const taskIds = new Set(dedupedTasks.map((task) => task.id));
  const sanitizedTasks = dedupedTasks.map((task) => ({
    ...task,
    dependencyIds: task.dependencyIds.filter((dependencyId) => taskIds.has(dependencyId)),
  }));
  const roadmapTasks: RoadmapTask[] = sanitizedTasks.map((task, index) => ({
    id: task.id,
    roadmapId: task.roadmapId,
    title: task.title,
    objective: task.objective,
    completionCriteria: task.completionCriteria,
    taskType: task.type,
    estimatedMinutes: task.estimatedMinutes,
    priority: task.priority,
    order: index + 1,
    dependencyIds: task.dependencyIds,
    completedOverall: false,
    active: true,
    difficulty: task.difficulty,
    splittable: task.splittable,
  }));
  const dependencyValidation = validateDependencyGraph(roadmapTasks);
  const warnings = [
    ...result.warnings,
    ...validation.issues.map((issue) => `AI output issue: ${issue}`),
    ...taskValidation.issues.map((issue) => `Filtered output issue: ${issue}`),
    ...(!dependencyValidation.valid ? [`AI dependency suggestions were filtered because the proposed task graph is not valid.`] : []),
    ...(result.tasks.length !== sanitizedTasks.length ? ['Duplicate or unsafe AI task candidates were removed; existing task history was preserved.'] : []),
  ];
  const dependencySuggestions = dependencyValidation.valid ? await provider.suggestDependencies(sanitizedTasks) : [];
  const practiceSuggestions = await provider.generatePractice({ conceptTitle: node.title });
  return {
    concepts: concepts.filter((concept) => concept.title.trim()),
    tasks: sanitizedTasks,
    dependencySuggestions,
    practiceSuggestions,
    warnings,
    confidence: warnings.length === 0 && result.confidence >= 0.9 ? 'high' : result.confidence >= 0.65 ? 'medium' : 'low',
  };
}

export function detectKnowledgeGaps(
  roadmapId: string,
  tasks: RoadmapTask[],
  dailyTasks: Array<{ sourceTaskId?: string; status: TaskStatus; resultNote?: string; energy?: 'low' | 'medium' | 'high' }>,
): KnowledgeGapSuggestion[] {
  const suggestions: KnowledgeGapSuggestion[] = [];
  for (const task of tasks.filter((candidate) => candidate.roadmapId === roadmapId && candidate.active !== false)) {
    const evidence = dailyTasks.filter((daily) => daily.sourceTaskId === task.id);
    const skips = evidence.filter((daily) => daily.status === 'skipped').length;
    const partials = evidence.filter((daily) => daily.status === 'partial').length;
    const notes = evidence.map((daily) => daily.resultNote ?? '').join(' ').toLocaleLowerCase();
    const confused = /confused|unclear|stuck|didn.?t understand|too hard|hard to follow/iu.test(notes);
    if (skips >= 2 || partials >= 2 || confused) {
      suggestions.push({
        id: `gap:${roadmapId}:${task.id}`,
        roadmapId,
        taskId: task.id,
        title: `Review ${task.title}`,
        reasonCodes: [
          ...(skips >= 2 ? ['repeated_skip' as const] : []),
          ...(partials >= 2 ? ['repeated_partial' as const] : []),
          ...(confused ? ['confusion_note' as const] : []),
        ],
        evidenceCount: evidence.length,
        suggestion: `You may benefit from a smaller review step before continuing with “${task.title}”.`,
        confidence: evidence.length >= 4 ? 'high' : 'medium',
        generatedAt: new Date().toISOString(),
      });
    }
  }
  return suggestions;
}

export function toAIArtifact(input: {
  kind: AIArtifact['kind'];
  roadmapId: string;
  sourceNodeId?: string;
  modelName: string;
  modelVersion: string;
  promptVersion: string;
  confidence: 'high' | 'medium' | 'low';
  payload: AIArtifact['payload'];
}): AIArtifact {
  return {
    id: `ai:${input.kind}:${input.roadmapId}:${input.sourceNodeId ?? 'global'}:${Date.now()}`,
    kind: input.kind,
    roadmapId: input.roadmapId,
    sourceNodeId: input.sourceNodeId,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    promptVersion: input.promptVersion,
    schemaVersion: 1,
    confidence: input.confidence,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };
}
